import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("fix_orphan_players")
        .setDescription("Naprawia graczy przypisanych do nieistniejących drużyn"),

    async execute(interaction: ChatInputCommandInteraction) {
        // TODO: Fix orphan players cmd
        if (1 == 1)
            return interaction.reply("Under maintenance.")

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const playersSnap = await db.collection("Zawodnicy").get();
        const orphans: string[] = [];

        await Promise.all(playersSnap.docs.map(async (doc) => {
            const data = doc.data();
            if (!data.teamId) return;

            const teamDoc = await db.collection("Drużyny").doc(data.teamId).get();
            if (!teamDoc.exists) {
                orphans.push(doc.id);
                await doc.ref.set({ teamId: null, captain: null, reserve: null }, { merge: true });
            }
        }));

        await interaction.editReply({
            content: orphans.length > 0
                ? `✅ Naprawiono **${orphans.length}** graczy:\n${orphans.map(o => `• ${o}`).join('\n')}`
                : `✅ Brak graczy do naprawy.`
        });
    }
};