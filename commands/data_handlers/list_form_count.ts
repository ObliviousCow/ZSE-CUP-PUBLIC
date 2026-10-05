import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("list_form_counts")
        .setDescription("Wyświetla liczbę zgłoszeń każdego użytkownika"),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snap = await db.collection("RegisterCount").get();

        if (snap.empty)
            return interaction.editReply({ content: '📋 Brak zgłoszeń w bazie.' });

        const entries = snap.docs
            .map(doc => ({ username: doc.id, count: doc.data().count as number }))
            .sort((a, b) => b.count - a.count);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('📋 Lista zgłoszeń')
                    .setColor(0xFFAA08)
                    .setDescription(entries.map(e => `• **${e.username}** — ${e.count}/2`).join('\n'))
                    .setTimestamp()
            ]
        });
    }
};