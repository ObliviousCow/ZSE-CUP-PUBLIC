import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { findPlayer, findTeam, findTeamById, showTeamsCollector, PlayerData, TeamData } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("info")
        .setDescription("Wyświetla informacje o graczu lub drużynie")
        .addSubcommand(sub => sub
            .setName("player")
            .setDescription("Wyświetla informacje o zawodniku")
            .addUserOption(option =>
                option.setName("user").setDescription("Użytkownik discord").setRequired(false)
            )
            .addStringOption(option =>
                option.setName("username").setDescription("Nazwa Discord zawodnika").setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName("team")
            .setDescription("Wyświetla informacje o drużynie")
            .addStringOption(option =>
                option.setName("team_name").setDescription("Nazwa drużyny").setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName("group")
            .setDescription("Wyświetla informacje o grupie")
            .addStringOption(option => option
                .setName("group_name").setDescription("A-F").setRequired(true)
            )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "player") {
            const username = interaction.options.getUser("user")?.username
                ?? interaction.options.getString("username")?.trim().toLowerCase();

            if (!username)
                return interaction.editReply({ content: `❌ Podaj nazwę użytkownika lub oznacz gracza.` });

            const player = await findPlayer(username);
            if (!player)
                return interaction.editReply({ content: `❌ Gracz **${username}** nie istnieje w bazie danych.` });

            const d = player.data as PlayerData & {
                verified: boolean;
                banned: boolean;
                banReason: string | null;
            };

            let teamName = "";
            if (d.teamId) {
                const teamData = await findTeamById(d.teamId);
                teamName = teamData?.data ? teamData.data.name : `⚠️ Nieistniejąca drużyna (${d.teamId})`;
            }

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`👤 ${username}`)
                        .setColor(0x5eebc5)
                        .addFields(
                            { name: "Imię i nazwisko", value: `${d.name ?? "-"} ${d.surname ?? "-"}`, inline: true },
                            { name: "Klasa", value: d.class ?? "-", inline: true },
                            { name: "Drużyna", value: teamName, inline: true },
                            { name: "Kapitan", value: d.captain ? "✅" : "❌", inline: true },
                            { name: "Rezerwa", value: d.reserve ? "✅" : "❌", inline: true },
                            { name: "Zweryfikowany", value: d.verified ? "✅" : "❌", inline: true },
                            { name: "Zbanowany", value: d.banned ? `✅ - ${d.banReason ?? "Nie podano"}` : "❌", inline: false },
                            { name: "Team ID", value: d.teamId ?? "-", inline: true },
                            { name: "Player ID", value: player.id, inline: true },
                            { name: "Faceit", value: d.faceit ?? "-", inline: true }
                        )
                        .setTimestamp()
                ]
            });
        } else if (subcommand === "team") {
            const teamName = interaction.options.getString("team_name", true);
            const team = await findTeam(teamName);

            if (!team) {
                await showTeamsCollector(interaction, `❌ Drużyna **${teamName}** nie istnieje. Literówka?`);
                return;
            }

            const d = team.data as TeamData & {
                captain_email: string;
                verified: boolean;
            };

            const playersSnap = await db.collection("Drużyny").doc(team.id).collection("Players").get();
            const playerList = (await Promise.all(playersSnap.docs.map(async doc => {
                const data = doc.data();
                const flags = [
                    data.captain ? "👑" : "",
                    data.reserve ? "🔄" : "",
                ].filter(Boolean).join(" ");

                const playerDoc = await db.collection("Zawodnicy").doc(doc.id).get();
                const faceit = playerDoc.exists ? (playerDoc.data()?.faceit ?? null) : null;

                return `• ${data.username ?? doc.id}${faceit ? ` *(${faceit})*` : ""} ${flags}`;
            }))).join("\n") || "Brak graczy";

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🏷️ ${d.name} [${d.short}]`)
                        .setColor(0x5eebc5)
                        .addFields(
                            { name: "Kapitan", value: d.captain_user ?? "-", inline: true },
                            { name: "Email", value: d.captain_email ?? "-", inline: true },
                            { name: "Zweryfikowana", value: d.verified ? "✅" : "❌", inline: true },
                            { name: "Grupa", value: d.group ?? "❌", inline: true },
                            { name: "Role ID", value: d.role_id ?? "-", inline: true },
                            { name: "Kanał ID", value: d.channel_id ?? "-", inline: true },
                            { name: "Team ID", value: team.id, inline: true },
                            { name: `Gracze (${playersSnap.size})`, value: playerList, inline: false },
                        )
                        .setTimestamp()
                ]
            });
        } else if (subcommand === "group") {
            const groupName = interaction.options.getString("group_name", true).toUpperCase();
            const docs = await db.collection("Drużyny").where("group", "==", groupName).get();

            if (docs.empty)
                return interaction.editReply({ content: `Brak drużyn w grupie **${groupName}**.` });

            const teamLines = docs.docs.map(doc => {
                const d = doc.data();
                return `**[${d.short}]** - ${d.name}\nKanał: <#${d.channel_id}>`;
            }).join('\n\n');

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Grupa ${groupName}`)
                        .setColor(0x5eebc5)
                        .setDescription(teamLines)
                        .setFooter({ text: `${docs.size} drużyn` })
                        .setTimestamp()
                ]
            });
        }
    }
};