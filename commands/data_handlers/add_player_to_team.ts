import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from "discord.js";
import { findPlayer, sync_player_roles } from "../../shared/functions.js";
import { db } from "../../shared/database.js";
import { randomUUID } from "node:crypto";

export default {
    data: new SlashCommandBuilder()
        .setName("add_player")
        .setDescription("Dodaje do drużyny")
        .addStringOption(option =>
            option.setName("user")
                .setDescription("username")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("name")
                .setDescription("Imie")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("surname")
                .setDescription("Nazwisko")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("class")
                .setDescription("Klasa")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("teamid")
                .setDescription("team id")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName("kapitan")
                .setDescription("Czy jest kapitanem")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName("rezerwa")
                .setDescription("Czy jest rezerwowym")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const username = interaction.options.getString("user", true).trim().toLowerCase();
        const name = interaction.options.getString("name", true);
        const surname = interaction.options.getString("surname", true);
        const playerClass = interaction.options.getString("class", true);
        const teamId = interaction.options.getString("teamid", true);
        const isCaptain = interaction.options.getBoolean("kapitan", true);
        const isReserve = interaction.options.getBoolean("rezerwa", true);

        const existingSnap = await db.collection("Zawodnicy")
            .where("username", "==", username)
            .limit(1)
            .get();

        if (existingSnap.empty) {
            const playerId = randomUUID();
            await db.collection("Zawodnicy").doc(playerId).set({
                id: playerId,
                name: name,
                surname: surname,
                class: playerClass,
                username: username,
                verified: false,
                teamId: teamId
            });

            await db.collection("Drużyny").doc(teamId).collection("Players").doc(playerId).set({
                username: username,
                reserve: isReserve ?? false,
                captain: isCaptain ?? false
            });

            await sync_player_roles(interaction.guild!, username);

            await interaction.editReply({
                content:
                    `✅ Dodano gracza: ${username}\n` +
                    `**${name} ${surname}**\n` +
                    `Klasa: **${playerClass}**\n` +
                    `Drużyna: **${teamId}**\n
                    ${isCaptain ? "**Kapitan**" : ""}\n
                    ${isReserve ? "*Rezerwa*" : ""}\n
                    `
            });
        } else {
            interaction.editReply(` Uzytkownik juz istnieje! ${username}`);
        }
    }
}