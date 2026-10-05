import {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ComponentType,
    ChannelType,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    TextChannel,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    MessageFlags,
    Guild,
} from "discord.js";
import config from '../../config.json' with { type: 'json' };

const SEVERITY_CONFIG: Record<string, { label: string; color: number; emoji: string }> = {
    low: { label: "🟢 Lekkie", color: 0x57f287, emoji: "🟢" },
    medium: { label: "🟡 Średnie", color: 0xfee75c, emoji: "🟡" },
    critical: { label: "🔴 Krytyczne", color: 0xed4245, emoji: "🔴" },
};

type SeverityInfo = { label: string; color: number; emoji: string };

function buildSeveritySelect() {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select_severity")
            .setPlaceholder("Wybierz krytyczność problemu…")
            .addOptions([
                { label: "🟢 Lekkie", description: "Drobny problem, nieblokujący działania.", value: "low" },
                { label: "🟡 Średnie", description: "Problem utrudniający pracę.", value: "medium" },
                { label: "🔴 Krytyczne", description: "Poważny błąd wymagający natychmiastowej reakcji.", value: "critical" },
            ])
    );
}

function buildTicketModal() {
    return new ModalBuilder()
        .setCustomId("modal_ticket")
        .setTitle("Utwórz Ticket")
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("ticket_subject")
                    .setLabel("Temat")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Krótki temat zgłoszenia…")
                    .setMinLength(3)
                    .setMaxLength(100)
                    .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("ticket_description")
                    .setLabel("Opis problemu")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Opisz szczegółowo problem…")
                    .setMinLength(10)
                    .setMaxLength(1000)
                    .setRequired(true)
            )
        );
}

function buildCloseRow() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("btn_ticket_close").setLabel("🔒 Zamknij Ticket").setStyle(ButtonStyle.Danger)
    );
}

function buildPreviewEmbed(subject: string, description: string, severityInfo: SeverityInfo, userId: string) {
    return new EmbedBuilder()
        .setTitle("🎫 Podgląd ticketu")
        .setColor(severityInfo.color)
        .addFields(
            { name: "📌 Temat", value: subject, inline: true },
            { name: "⚡ Krytyczność", value: severityInfo.label, inline: true },
            { name: "👤 Zgłaszający", value: `<@${userId}>`, inline: true },
            { name: "📝 Opis problemu", value: description, inline: false }
        )
        .setFooter({ text: "Zatwierdź lub anuluj zgłoszenie." })
        .setTimestamp();
}

function buildThreadEmbed(subject: string, description: string, severityInfo: SeverityInfo, interaction: ChatInputCommandInteraction) {
    return new EmbedBuilder()
        .setTitle(`🎫 Ticket • ${severityInfo.label}`)
        .setColor(severityInfo.color)
        .addFields(
            { name: "📌 Temat", value: subject, inline: true },
            { name: "⚡ Krytyczność", value: severityInfo.label, inline: true },
            { name: "👤 Zgłaszający", value: `<@${interaction.user.id}>`, inline: true },
            { name: "📝 Opis problemu", value: description, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `Serwer: ${interaction.guild!.name}` });
}

function buildAdminEmbed(subject: string, description: string, severityInfo: SeverityInfo, interaction: ChatInputCommandInteraction, ticketThread: TextChannel) {
    return new EmbedBuilder()
        .setTitle(`🎫 Nowy Ticket • ${severityInfo.label}`)
        .setColor(severityInfo.color)
        .addFields(
            { name: "📌 Temat", value: subject, inline: true },
            { name: "⚡ Krytyczność", value: severityInfo.label, inline: true },
            { name: "👤 Zgłaszający", value: `<@${interaction.user.id}>`, inline: true },
            { name: "📢 Kanał", value: `${ticketThread}`, inline: true },
            { name: "📝 Opis problemu", value: description, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `Serwer: ${interaction.guild!.name}` });
}

async function stepSeverity(interaction: ChatInputCommandInteraction): Promise<StringSelectMenuInteraction | null> {
    await interaction.reply({
        content: "## 🎫 Nowy Ticket\nZacznij od wybrania **krytyczności** problemu:",
        components: [buildSeveritySelect()],
        flags: MessageFlags.Ephemeral,
    });

    try {
        return await interaction.channel!.awaitMessageComponent({
            filter: (i) => i.customId === "select_severity" && i.user.id === interaction.user.id,
            componentType: ComponentType.StringSelect,
            time: 120_000,
        });
    } catch {
        await interaction.editReply({ content: "⏰ Czas na wybór krytyczności minął.", components: [] });
        return null;
    }
}

async function stepModal(severityInteraction: StringSelectMenuInteraction, interaction: ChatInputCommandInteraction): Promise<ModalSubmitInteraction | null> {
    await severityInteraction.showModal(buildTicketModal());

    try {
        return await severityInteraction.awaitModalSubmit({
            filter: (i) => i.customId === "modal_ticket" && i.user.id === interaction.user.id,
            time: 180_000,
        });
    } catch {
        await interaction.editReply({ content: "⏰ Czas na wypełnienie formularza minął.", components: [] });
        return null;
    }
}

async function createTicketChannel(guild: Guild, subject: string, severityInfo: SeverityInfo, userId: string): Promise<TextChannel | null> {
    const safeSubject = subject.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-ąćęłńóśźżА-яёіїє]/gi, "").slice(0, 80);

    try {
        const channel = await guild.channels.create({
            name: `${severityInfo.emoji}・${safeSubject}`,
            type: ChannelType.GuildText,
            parent: config.TicketCategoryId
        }) as TextChannel;
        await channel.permissionOverwrites.edit(userId, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            EmbedLinks: true,
            ReadMessageHistory: true,
            UseApplicationCommands: true
        });
        return channel
    } catch (err) {
        console.error("[ticket] Błąd tworzenia kanału:", err);
        return null;
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Utwórz nowy ticket wsparcia"),

    async execute(interaction: ChatInputCommandInteraction) {
        const severityInteraction = await stepSeverity(interaction);
        if (!severityInteraction) return;

        const severityInfo = SEVERITY_CONFIG[severityInteraction.values[0]];

        const modalInteraction = await stepModal(severityInteraction, interaction);
        if (!modalInteraction) return;

        const subject = modalInteraction.fields.getTextInputValue("ticket_subject").trim();
        const description = modalInteraction.fields.getTextInputValue("ticket_description").trim();

        await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketThread = await createTicketChannel(interaction.guild!, subject, severityInfo, interaction.user.id);
        if (!ticketThread) {
            await modalInteraction.editReply({ content: `❌ Nie udało się utworzyć kanału ticketu.` });
            return;
        }

        await ticketThread.send({
            content: `<@${interaction.user.id}> — Twój ticket został utworzony.`,
            embeds: [buildThreadEmbed(subject, description, severityInfo, interaction)],
            components: [buildCloseRow()],
        });

        const ticketChannel = interaction.guild!.channels.cache.get(config.TicketChannelId) as TextChannel | undefined;
        if (ticketChannel) {
            await ticketChannel.send({ embeds: [buildAdminEmbed(subject, description, severityInfo, interaction, ticketThread)] });
        }

        await modalInteraction.editReply({
            content: `✅ Twój ticket został utworzony!\nPrzejdź tutaj: ${ticketThread}\nOdpowiemy tak szybko, jak to możliwe.`,
        });
    },
};