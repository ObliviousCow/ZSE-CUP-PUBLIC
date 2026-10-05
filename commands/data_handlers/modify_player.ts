import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { db } from "../../shared/database.js";
import { sync_player_roles, remove_player_from_team, findTeam, findPlayer, resultContent } from "../../shared/functions.js";

export default {
    data: new SlashCommandBuilder()
        .setName("modify_player")
        .setDescription("Modyfikuje dane zawodnika w bazie danych")
        .addStringOption(option =>
            option.setName("username").setDescription("Nazwa Discord zawodnika").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("newusername").setDescription("Nowa nazwa discord").setRequired(false)
        )
        .addStringOption(option =>
            option.setName("team").setDescription("Nazwa drużyny (zostaw puste żeby usunąć z drużyny)").setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName("reserve").setDescription("Czy zawodnik jest rezerwowym?").setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName("captain").setDescription("Czy zawodnik jest kapitanem?").setRequired(false)
        )
        .addStringOption(option =>
            option.setName("name").setDescription("Imię zawodnika").setRequired(false)
        )
        .addStringOption(option =>
            option.setName("surname").setDescription("Nazwisko zawodnika").setRequired(false)
        )
        .addStringOption(option =>
            option.setName("class").setDescription("Klasa zawodnika").setRequired(false)
        )
        .addStringOption(option => option
            .setName("faceit").setDescription("Nazwa faceit").setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const username = interaction.options.getString("username", true).trim().toLowerCase();
        const newusername = interaction.options.getString("newusername")
        const teamName = interaction.options.getString("team");
        const reserve = interaction.options.getBoolean("reserve");
        const captain = interaction.options.getBoolean("captain");
        const name = interaction.options.getString("name");
        const surname = interaction.options.getString("surname");
        const schoolClass = interaction.options.getString("class");
        const faceit = interaction.options.getString("faceit");

        const player = await findPlayer(username);
        if (!player)
            return interaction.editReply({ content: `❌ Gracz **${username}** nie istnieje w bazie danych.` });

        const updates: Record<string, any> = {};

        if (newusername) updates.username = newusername.trim().toLowerCase();
        if (name) updates.name = name.trim();
        if (surname) updates.surname = surname.trim();
        if (schoolClass) updates.class = schoolClass.trim().toUpperCase();
        if (reserve !== null) updates.reserve = reserve;
        if (captain !== null) updates.captain = captain;
        updates.faceit = faceit;

        if (teamName === null) {
            // No team provided
        } else if (teamName.trim() === "") {
            // team is set to null, delete from team
            const removeResult = await remove_player_from_team(username);
            if (removeResult.code === 1)
                return interaction.editReply({ content: resultContent(removeResult) });
            updates.teamId = null;
            updates.captain = null;
            updates.reserve = null;
        } else {
            const team = await findTeam(teamName.trim());
            if (!team)
                return interaction.editReply({ content: `❌ Drużyna **${teamName}** nie istnieje.` });

            const oldTeamId = player.data.teamId;
            if (oldTeamId && oldTeamId !== team.id)
                await db.collection("Drużyny").doc(oldTeamId).collection("Players").doc(player.id).delete();

            updates.teamId = team.id;
        }

        if (Object.keys(updates).length > 0)
            await db.collection("Zawodnicy").doc(player.id).set(updates, { merge: true });

        const currentTeamId = updates.teamId ?? player.data.teamId;
        if (currentTeamId && updates.teamId !== null) {
            await db.collection("Drużyny").doc(currentTeamId).collection("Players").doc(player.id).set({
                username: newusername ?? username,
                captain: captain ?? player.data.captain ?? false,
                reserve: reserve ?? player.data.reserve ?? false,
            }, { merge: true });
        }

        const syncResult = await sync_player_roles(interaction.guild!, newusername ?? username);

        await interaction.editReply({
            content: syncResult.code === 0
                ? `✅ Zaktualizowano dane gracza **${username}**.\n${syncResult.message}`
                : `⚠️ Dane zaktualizowane, ale błąd synchronizacji ról: ${syncResult.message}`
        });
    }
};