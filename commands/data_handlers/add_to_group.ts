import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { findTeam } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("group_add")
        .setDescription("Dodaje druzyne do grupy")
        .addStringOption(option => option
            .setName("team")
            .setDescription("ID lub nazwa drużyny")
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName("group")
            .setDescription("Grupa A-F")
            .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const teamResolvable = interaction.options.getString("team", true);
        const newGroup = interaction.options.getString("group", true).toUpperCase().trim();

        const team = await findTeam(teamResolvable)

        if (!team) {
            return interaction.editReply(`Drużyna ${teamResolvable} nie znaleziona.`)
        }

        const prevGroup = team.data.group;

        await db.collection("Drużyny").doc(team.id).set({
            group: newGroup
        }, { merge: true });

        await interaction.editReply(prevGroup ? `Zmieniono grupę drużyny z ${prevGroup} na ${newGroup}` : `Ustawiono grupę drużyny na ${newGroup}`)
    }
};