import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    TextChannel,
    Role,
} from "discord.js";
import { createChannelName, findPlayer, findTeam, sync_player_roles } from "../../shared/functions.js";
import { db } from "../../shared/database.js";
import { randomUUID } from "node:crypto";

export default {
    data: new SlashCommandBuilder()
        .setName("rename_team")
        .setDescription("Dodaje do drużyny")
        .addStringOption(option =>
            option.setName("team")
                .setDescription("ID lub nazwa druzyny")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("new")
                .setDescription("nowa nazwa druzyny")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("short").setDescription("Skrót nowej drużyny").setRequired(true)
        )
    ,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const teamResolvable = interaction.options.getString("team", true);
        const newName = interaction.options.getString("new", true);
        const newShort = interaction.options.getString("short", true)

        const team = await findTeam(teamResolvable)

        if (!team) {
            return interaction.editReply(`Drużyna ${teamResolvable} nie znaleźona`)
        }

        db.collection("Drużyny").doc(team.id).set({
            name: newName,
            short: newShort
        }, { merge: true })

        const newOptions = { name: createChannelName(newShort, newName) }
        let channelSuccess = false
        let roleSuccess = false

        const textChannel = await interaction.guild?.channels.fetch(team.data.channel_id) as TextChannel
        if (textChannel) {
            await textChannel.edit(newOptions)
            channelSuccess = true
        }

        const teamRole = await interaction.guild?.roles.fetch(team.data.role_id)
        if (teamRole) {
            await teamRole.edit(newOptions)
            roleSuccess = true
        }

        interaction.editReply(`Team renamed ${channelSuccess ? "| Channel renamed success" : ""} ${roleSuccess ? "| Role renamed success" : ""}`)
    }
}