import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ButtonInteraction, ChatInputCommandInteraction, Client, Collection, Events, EmbedBuilder, GatewayIntentBits, GuildMemberRoleManager, MessageFlags, PermissionsBitField, TextChannel, Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, Role, ModalSubmitInteraction } from 'discord.js';

import './shared/database.js';
import './shared/deploy-commands.js';
import permissions from './permissions.json' with { type: 'json' };
import config from './config.json' with { type: 'json' };
import { generateAcceptance } from './shared/functions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const perms = permissions as Record<string, string[]>;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
(client as any).commands = new Collection();
(client as any).buttons = new Collection();
(client as any).modals = new Collection();

const foldersPath = join(__dirname, 'commands');

for (const folder of readdirSync(foldersPath)) {
    const commandsPath = join(foldersPath, folder);

    for (const file of readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts') && statSync(join(commandsPath, file)).isFile())) {
        const filePath = join(commandsPath, file);
        const command = (await import(pathToFileURL(filePath).href)).default;
        if (command?.data && command?.execute) {
            (client as any).commands.set(command.data.name, command);
        }
    }
}

const buttonsPath = join(__dirname, 'buttons');

for (const file of readdirSync(buttonsPath).filter((file: string) => file.endsWith('.ts') || file.endsWith('.js'))) {
    const filePath = join(buttonsPath, file);
    const button = (await import(pathToFileURL(filePath).href)).default;
    const buttonId = file.replace(/\.(ts|js)$/, "");
    (client as any).buttons.set(buttonId, button);
}

const modalsPath = join(__dirname, 'modals');

for (const file of readdirSync(modalsPath).filter((file: string) => file.endsWith(".ts"))) {
    const filePath = join(modalsPath, file);
    const modal = (await import(pathToFileURL(filePath).href)).default;
    const modalId = file.replace(/\.ts$/, '');
    (client as any).modals.set(modalId, modal);
}

async function handleChatInput(interaction: ChatInputCommandInteraction) {
    const command = (client as any).commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error in ${interaction.commandName}:`, error);
        const method = (interaction.replied || interaction.deferred) ? 'followUp' : 'reply';
        await (interaction as any)[method]({
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleButton(interaction: ButtonInteraction) {
    const buttonFunc = (client as any).buttons.get(interaction.customId);
    if (!buttonFunc) return;

    try {
        await buttonFunc(interaction);
    } catch (error) {
        console.error(`Error in button ${interaction.customId}:`, error);
    }
}

async function handleModal(interaction: ModalSubmitInteraction) {
    let modalFunc = (client as any).modals.get(interaction.customId);

    if (!modalFunc) {
        const key = [...(client as any).modals.keys()].find((k: string) =>
            interaction.customId.startsWith(k)
        );
        if (key) modalFunc = (client as any).modals.get(key);
    }

    if (!modalFunc) return;

    try {
        await modalFunc(interaction);
    } catch (error) {
        console.error(`Error in modal ${interaction.customId}:`, error);
    }
}

async function sendInteractionLog(interaction: ChatInputCommandInteraction | ButtonInteraction, authRole: { name: string } | undefined) {
    const LogIgnore = ["help", "ticket"];

    const interactionName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId;
    if (LogIgnore.includes(interactionName)) return;

    const logChannel = await client.channels.fetch(config.LogsChannel).catch(() => null) as TextChannel | null;
    if (!logChannel) return;

    const currentTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const authorized = !!authRole;

    const logEmbed = new EmbedBuilder()
        .setTitle("Interaction Log")
        .setDescription(authorized ? "Interaction created" : "<:error:1480571711660364006> Interaction failed: 401")
        .setColor(authorized ? 0xFFAA08 : 0xD90301)
        .addFields(
            { name: "Author:", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Channel:", value: `<#${interaction.channelId}>`, inline: true },
            { name: "Permitting role:", value: `**${authRole?.name ?? "NONE"}**`, inline: true },
            { name: "Interaction:", value: interaction.isChatInputCommand() ? `**Command:** /${interaction.commandName}` : `**Button:** ${interaction.customId}`, inline: true }
        )
        .setFooter({ text: `Timestamp: ${currentTime}` })
        .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(console.error);
}

function isAuthorized(interaction: ChatInputCommandInteraction | ButtonInteraction): [boolean, { name: string }?] {
    if (!interaction.member) return [false];

    let permKey = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId;

    if (interaction.isChatInputCommand()) {
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand)
            permKey = `${interaction.commandName}_${subcommand}`; // command + subcommand concat
    }

    const requiredRoles = perms[permKey];

    if (!requiredRoles) {
        // auto accept admins, otherwise perms werent specified, so we deny ts
        const isAdmin = interaction.member?.permissions instanceof PermissionsBitField
            && interaction.member.permissions.has('Administrator');
        return isAdmin ? [true, { name: "Administrator" }] : [false];
    }

    if (requiredRoles.length === 0) return [true, { name: "Public Access" }];

    const foundRole = interaction.member?.roles instanceof GuildMemberRoleManager
        ? interaction.member.roles.cache.find((role: { name: string }) => requiredRoles.includes(role.name))
        : null;

    return foundRole ? [true, foundRole] : [false];
}

client.once(Events.ClientReady, (c: Client<true>) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    c.user.setPresence({ activities: [{ name: "/ticket" }], status: "online" });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isModalSubmit()) {
        await handleModal(interaction);
        return;
    }
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    const authData = isAuthorized(interaction);
    const isAuth = authData[0];
    const authRole = authData[1];
    sendInteractionLog(interaction, authRole);
    if (!isAuth) {
        return interaction.reply({
            content: "<:error:1480571711660364006> Nie masz uprawnień.",
            flags: MessageFlags.Ephemeral
        });
    }

    if (interaction.isChatInputCommand()) {
        await handleChatInput(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    }
});

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.channelId !== config.WebhookChannelId) return;
    if (!message.webhookId) return;

    generateAcceptance(message);
});

const shutdown = (signal: string) => {
    console.log(`\nGraceful shutdown (${signal})`);
    client.destroy();
    process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection!: ", reason);
    process.exit(1);
});

client.login(process.env.DISCORD_TOKEN);