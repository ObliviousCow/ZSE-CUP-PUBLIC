import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { findTeam, showTeamsCollector, sync_player_roles } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("sync_team_roles")
        .setDescription("Synchronizuje role wszystkich graczy w drużynie")
        .addStringOption(option =>
            option.setName("team_name").setDescription("Nazwa drużyny lub ID").setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const teamName = interaction.options.getString("team_name", true);
        const team = await findTeam(teamName);

        if (!team) {
            await showTeamsCollector(interaction, `❌ Drużyna **${teamName}** nie istnieje. Literówka?`);
            return;
        }

        const playersSnap = await db.collection("Drużyny").doc(team.id).collection("Players").get();
        const usernames = playersSnap.docs.map(doc => doc.data().username as string);

        const results = await Promise.all(
            usernames.map(username => sync_player_roles(interaction.guild!, username))
        );

        const failed = results.filter(r => r.code === 1).map((r, i) => `• ${usernames[i]}: ${r.message}`);

        await interaction.editReply({
            content: failed.length > 0
                ? `⚠️ Synchronizacja zakończona z błędami:\n${failed.join('\n')}`
                : `✅ Pomyślnie zsynchronizowano role ${usernames.length} graczy drużyny **${teamName}**.`
        });
    }
};