import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { findTeam } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("fix_pbt")
        .setDescription("Zbiera zawodników z dokumentu drużyny i na jego podstawie aktualizuje dokumenty zawodników")
        .addStringOption(option => option
            .setName("team_resolvable")
            .setDescription("Nazwa lub ID teamu. Jeżeli brak, loopuje wszystkie drużyny")
            .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const teamResolvable = interaction.options.getString("team_resolvable");
        const fixed: string[] = [];
        const failed: string[] = [];

        async function fixTeam(teamId: string) {
            const playersSnap = await db.collection("Drużyny").doc(teamId).collection("Players").get();
            console.log(`Fixing ${teamId}`);

            await Promise.all(playersSnap.docs.map(async playerDoc => {
                const playerData = playerDoc.data();
                const playerUUID = playerDoc.id;

                const zawodnikDoc = await db.collection("Zawodnicy").doc(playerUUID).get();
                if (!zawodnikDoc.exists) {
                    console.log(`User ${playerUUID} from ${teamId} doesnt exist.`)
                    failed.push(`${playerUUID} (brak w Zawodnicy)`);
                    return;
                }

                await zawodnikDoc.ref.set({
                    teamId: teamId,
                    captain: playerData.captain ?? null,
                    reserve: playerData.reserve ?? null,
                    username: playerData.username ?? zawodnikDoc.data()!.username,
                }, { merge: true });

                fixed.push(playerData.username ?? playerUUID);
            }));
        }

        if (teamResolvable) {
            const team = await findTeam(teamResolvable);
            if (!team)
                return interaction.editReply({ content: `❌ Drużyna **${teamResolvable}** nie istnieje.` });

            await fixTeam(team.id);
        } else {
            const teamsSnap = await db.collection("Drużyny").get();
            await Promise.all(teamsSnap.docs.map(doc => fixTeam(doc.id)));
        }

        const lines = [
            fixed.length > 0 ? `✅ Naprawiono (${fixed.length}):\n${fixed.map(p => `• ${p}`).join('\n')}` : '',
            failed.length > 0 ? `❌ Błędy (${failed.length}):\n${failed.map(p => `• ${p}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n');

        await interaction.editReply({
            content: (lines || '✅ Brak zawodników do naprawy.').slice(0, 2000)
        });
    }
};