import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("reset_form_count")
        .setDescription("Resetuje liczbę stworzonych zgłoszeń danego uczestnika")
        .addStringOption(option => option
            .setName("user")
            .setDescription("Użytkownik discord")
            .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const username = interaction.options.getString("user", true).toLowerCase().trim();

        const snap = await db.collection("RegisterCount").doc(username).get();
        if (!snap.exists) {
            const allSnap = await db.collection("RegisterCount").get();
            const userList = allSnap.docs.map(d => d.id).join("\n - ");
            return interaction.editReply(`❌ Nie znaleziono użytkownika **${username}** w bazie.\n\nLista dostępnych użytkowników:\n - ${userList}`);
        }

        await snap.ref.set({ count: 0 }, { merge: true });
        await interaction.editReply(`✅ Pomyślnie zresetowano liczbę zgłoszeń użytkownika **${username}**.`);
    }
};