import { ChatInputCommandInteraction, TextChannel, SlashCommandBuilder, ChannelType, SlashCommandChannelOption, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Tworzy ticketer dla rejerstrujących'),
    async execute(interaction: ChatInputCommandInteraction) {
        const configPath = join(__dirname, "../../config.json");
        const configData = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configData);

        const registerChannel = await interaction.client.channels.fetch(config.RegisterChannel) as TextChannel;

        if (!registerChannel) {
            console.error("failed to get register and logs channels!")
            return process.exit(1);
        }

        await registerChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Zarejestruj się!")
                    .setDescription("Po naciśnięciu powinieneś/aś otrzymać rolę Kandydat, lub jeżeli jesteś w drużynie to rolę swojej drużyny.")
                    .setColor("#d6fd28")
                    .addFields(
                        { name: "W przypadku błędów:", value: "Skontaktuj się z administracją." }
                    )
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(new ButtonBuilder({
                        custom_id: "sign_in",
                        style: ButtonStyle.Primary,
                        label: "Dołącz do turnieju",
                        emoji: "✅"
                    }))
            ]
        });
    },
};