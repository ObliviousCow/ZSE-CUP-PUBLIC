import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("get_players")
        .setDescription("Wyświetla wszystkich uzytkownikow"),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const snap = await db.collection("Zawodnicy").get();

        if (snap.empty)
            return interaction.editReply({ content: '📋 Brak zawodników w bazie.' });

        const teamsSnap = await db.collection("Drużyny").get();
        const teamNameMap = new Map<string, string>(
            teamsSnap.docs.map(doc => [doc.id, doc.data().name as string])
        );

        const entries = snap.docs
            .map(doc => {
                const d = doc.data();
                const teamName = d.teamId ? (teamNameMap.get(d.teamId) ?? `⚠️ ${d.teamId}`) : null;
                return {
                    teamId: d.teamId ?? null,
                    teamName: teamName,
                    line: `→ **${d.username ?? "-"}** - ${teamName ? `✅ ${teamName}` : "❌ Brak drużyny"} | ${d.name ?? "-"} ${d.surname ?? "-"} | ${d.class ?? "-"}`
                };
            })
            .sort((a, b) => {
                if (!a.teamId && !b.teamId) return 0;
                if (!a.teamId) return 1;
                if (!b.teamId) return -1;
                return (a.teamName ?? "").localeCompare(b.teamName ?? "");
            })
            .map(e => e.line);

        const chunks: string[] = [];
        let current = "";

        for (const entry of entries) {
            if ((current + "\n" + entry).length > 1900) {
                chunks.push(current);
                current = entry;
            } else {
                current += (current ? "\n" : "") + entry;
            }
        }
        if (current) chunks.push(current);

        await interaction.editReply({ content: `📋 **Lista zawodników (${snap.size}):**\n${chunks[0]}` });
        for (let i = 1; i < chunks.length; i++)
            await interaction.followUp({ content: chunks[i], flags: MessageFlags.Ephemeral });
    }
};