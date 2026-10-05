import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { remove_team, findTeam, showTeamsCollector, resultContent, findPlayer } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Usuwa dane z bazy")
        .addSubcommand(sub => sub
            .setName("team")
            .setDescription("Usuwa drużynę z bazy danych")
            .addStringOption(o => o
                .setName("name")
                .setDescription("Nazwa lub ID drużyny")
                .setRequired(true)
            )
            .addBooleanOption(o => o
                .setName("purge")
                .setDescription("Usuwa zawodników drużyny z bazy danych")
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName("player")
            .setDescription("Usuwa gracza z bazy danych")
            .addStringOption(o => o
                .setName("username")
                .setDescription("username lub databaseID lub discordID użytkownika (można wypisywać po przecinku)")
                .setRequired(false)
            )
            .addUserOption(o => o
                .setName("user")
                .setDescription("Użytkownik do usunięcia")
                .setRequired(false)
            )
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();

        if (sub == "team") {
            const teamResolvable = interaction.options.getString("name", true);
            const purgeMembers = interaction.options.getBoolean("purge") ?? false;

            const team = await findTeam(teamResolvable);
            if (!team) {
                await showTeamsCollector(interaction, `❌ Drużyna **${teamResolvable}** nie istnieje.`);
                return;
            }

            const result = await remove_team(interaction.guild!, team.id, purgeMembers);
            await interaction.editReply({ content: resultContent(result) });

        } else if (sub == "player") {
            const playerResolvableArray = interaction.options.getString("username")?.trim().toLowerCase().split(",");
            const user = interaction.options.getUser("user")?.username
            if (user)
                playerResolvableArray?.push(user)

            const unresolved: string[] = []
            const removed: string[] = []
            playerResolvableArray?.forEach(async playerResolvable => {
                const response = await findPlayer(playerResolvable)
                if (!response) {
                    unresolved.push(playerResolvable)
                    return
                }
                await db.collection("Zawodnicy").doc(response.id)?.delete()
                await db.collection("Drużyny").doc(response.data.teamId || "")?.collection("Players").doc(response.id)?.delete()

                removed.push(response.data.username)
            })

            interaction.editReply(`
                Pomyślnie usunięto graczy: ${removed.join(", ")}
                `)
        }


    }
};