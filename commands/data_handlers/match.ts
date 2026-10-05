import { ApplicationCommandOptionWithChoicesMixin, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import { addMatchPlayer, BracketType, createMatch, deleteMatch, findMatch, findTeam, findTeamById, getMatchesByTeam, MatchData, MatchType, resolveMatchTeamNames, resultContent, setScore } from "../../shared/functions.js";
import { db } from "../../shared/database.js";

export default {
    data: new SlashCommandBuilder()
        .setName("match")
        .setDescription("Mecze w bazie danych")
        .addSubcommand(sub => sub
            .setName("create")
            .setDescription("Tworzy nowy mecz")
            .addStringOption(o => o
                .setName("team1")
                .setDescription("Nazwa lub ID drużyny 1")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("team2")
                .setDescription("Nazwa lub ID drużyny 2")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("date")
                .setDescription("Data meczu DD.MM.RRRR")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("time")
                .setDescription("Godzina meczu HH:MM")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("matchtype")
                .setDescription("Typ meczu (default grupowe)")
                .setChoices(
                    { name: "Grupowa", value: "group" },
                    { name: "Ósemka", value: "eight" },
                    { name: "Ćwierćfinał", value: "four" },
                    { name: "Półfinał", value: "two" },
                    { name: "Mini Finał", value: "three" },
                    { name: "Finał", value: "one" }
                )
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("bracket")
                .setDescription("Bracket ID")
                .setChoices(
                    { name: "1/8 P", value: "p" },
                    { name: "1/8 R", value: "r" },
                    { name: "1/8 S", value: "s" },
                    { name: "1/8 T", value: "t" },
                    { name: "1/8 W", value: "w" },
                    { name: "1/8 X", value: "x" },
                    { name: "1/8 Y", value: "y" },
                    { name: "1/8 Z", value: "z" },

                    { name: "QF1", value: "qf1" },
                    { name: "QF2", value: "qf2" },
                    { name: "QF3", value: "qf3" },
                    { name: "QF4", value: "qf4" },

                    { name: "SF1", value: "sf1" },
                    { name: "SF2", value: "sf2" },

                    { name: "Final", value: "fin" },
                    { name: "Mini final", value: "mfin" },
                )
            )
        )
        .addSubcommand(sub => sub
            .setName("info")
            .setDescription("Wyświetla informacje o meczu")
            .addStringOption(o => o
                .setName("match_id")
                .setDescription("ID meczu")
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("team")
                .setDescription("Nazwa lub ID drużyny - wyświetla wszystkie mecze drużyny")
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName("modify")
            .setDescription("Zmienia informacje meczu")
            .addStringOption(o => o
                .setName("matchid")
                .setDescription("ID meczu")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("date")
                .setDescription("Nowa data meczu DD.MM.RRRR")
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("time")
                .setDescription("Nowa godzina meczu HH:MM")
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("score")
                .setDescription("Inny wynik meczu")
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("matchtype")
                .setDescription("Typ meczu (default grupowe)")
                .setChoices(
                    { name: "Grupowa", value: "group" },
                    { name: "Ósemka", value: "eight" },
                    { name: "Ćwierćfinał", value: "four" },
                    { name: "Półfinał", value: "two" },
                    { name: "Mini Finał", value: "three" },
                    { name: "Finał", value: "one" }
                )
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName("bracket")
                .setDescription("Bracket ID")
                .setChoices(
                    { name: "1/8 P", value: "p" },
                    { name: "1/8 R", value: "r" },
                    { name: "1/8 S", value: "s" },
                    { name: "1/8 T", value: "t" },
                    { name: "1/8 W", value: "w" },
                    { name: "1/8 X", value: "x" },
                    { name: "1/8 Y", value: "y" },
                    { name: "1/8 Z", value: "z" },

                    { name: "QF1", value: "qf1" },
                    { name: "QF2", value: "qf2" },
                    { name: "QF3", value: "qf3" },
                    { name: "QF4", value: "qf4" },

                    { name: "SF1", value: "sf1" },
                    { name: "SF2", value: "sf2" },

                    { name: "Final", value: "fin" },
                    { name: "Mini final", value: "mfin" },
                )
            )
        )
        .addSubcommand(sub => sub
            .setName("complete")
            .setDescription("Tworzy wynik i tabelę graczy meczu")
            .addStringOption(o => o
                .setName("matchid")
                .setDescription("ID meczu")
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName("score")
                .setDescription("Wynik meczu")
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName("delete")
            .setDescription("Usuwa mecz z bazy")
            .addStringOption(o => o
                .setName("matchid")
                .setDescription("ID meczu")
                .setRequired(true)
            )
        ),
    async execute(interaction: ChatInputCommandInteraction) {

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
            await interaction.deferReply();
            const team1 = interaction.options.getString("team1", true);
            const team2 = interaction.options.getString("team2", true);
            const dateStr = interaction.options.getString("date", true);
            const timeStr = interaction.options.getString("time", true);
            const matchType = interaction.options.getString("type", false) as MatchType ?? null;
            const bracket = interaction.options.getString("bracket", false) as BracketType ?? null

            // Teams sanity check

            const team1Info = await findTeam(team1);
            const team2Info = await findTeam(team2);

            if (!team1Info || !team2Info)
                return interaction.editReply({ content: `Jedna z drużyn nie istnieje! ${team1} ${team2}` });

            const dateParts = dateStr.split(".");
            const timeParts = timeStr.split(":");

            // Date sanity check

            if (dateParts.length !== 3 || timeParts.length !== 2)
                return interaction.editReply({ content: "❌ Nieprawidłowy format daty lub godziny. Użyj DD.MM.RRRR i HH:MM." });

            const [day, month, year] = dateParts.map(Number);
            const [hours, minutes] = timeParts.map(Number);

            if ([day, month, year, hours, minutes].some(isNaN))
                return interaction.editReply({ content: "❌ Data lub godzina zawiera nieprawidłowe wartości." });

            const matchDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+02:00`);
            if (isNaN(matchDate.getTime()))
                return interaction.editReply({ content: "❌ Nieprawidłowa data meczu." });

            const result = await createMatch({
                date: matchDate,
                finished: false,
                score: "",
                team1: team1Info.id,
                team2: team2Info.id,
                type: matchType ?? "group",
                bracket: bracket ?? null,
                Players: {}
            });

            await interaction.editReply({ content: resultContent(result) });
        } else if (subcommand === "info") {
            await interaction.deferReply();
            const matchId = interaction.options.getString("match_id", false);
            const teamResolv = interaction.options.getString("team", false);

            if (!matchId && !teamResolv)
                return interaction.editReply({ content: "❌ Podaj ID meczu lub nazwę drużyny." });

            if (matchId) {
                const match = await findMatch(matchId);
                if (!match)
                    return interaction.editReply({ content: `❌ Mecz **${matchId}** nie istnieje.` });

                const d = match.data;
                const { team1Name, team2Name } = await resolveMatchTeamNames(d);
                const date = new Date((d.date as any)._seconds * 1000);

                const playerLines = Object.entries(d.Players ?? {}).map(([, p]) =>
                    `• **${p.username}** - K: ${p.kills} D: ${p.deaths} A: ${p.assists}`
                );

                const team1Lines = playerLines.filter((_, i) =>
                    Object.values(d.Players ?? {})[i]?.teamId === d.team1
                ).join('\n') || '-';

                const team2Lines = playerLines.filter((_, i) =>
                    Object.values(d.Players ?? {})[i]?.teamId === d.team2
                ).join('\n') || '-';

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`⚔️ ${team1Name} vs ${team2Name}`)
                            .setColor(d.finished ? 0x57f287 : 0xFFAA08)
                            .addFields(
                                { name: "Data", value: date.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }), inline: true },
                                { name: "Wynik", value: d.finished ? d.score : "Nie rozegrany", inline: true },
                                { name: "Status", value: d.finished ? "Zakończony" : "Nadchodzący", inline: true },
                                { name: `🗿 TYP`, value: d.type ?? "Grupowy", inline: true },
                                { name: `🗿 BRACKET`, value: d.bracket ?? "-", inline: true },
                                { name: `👥 ${team1Name}`, value: team1Lines, inline: true },
                                { name: `👥 ${team2Name}`, value: team2Lines, inline: true },
                                { name: "ID", value: match.id, inline: false },
                            )
                            .setTimestamp()
                    ]
                });

            } else if (teamResolv) {
                const matches = await getMatchesByTeam(teamResolv);

                if (matches.length === 0)
                    return interaction.editReply({ content: `❌ Brak meczów dla drużyny **${teamResolv}**.` });

                const sorted = matches.sort((a, b) => {
                    const aDate = (a.data.date as any)._seconds ?? 0;
                    const bDate = (b.data.date as any)._seconds ?? 0;
                    return aDate - bDate;
                });

                const upcoming = sorted.filter(m => !m.data.finished);
                const finished = sorted.filter(m => m.data.finished);

                const formatLine = async (m: { id: string; data: MatchData }) => {
                    const { team1Name, team2Name } = await resolveMatchTeamNames(m.data);
                    const date = new Date((m.data.date as any)._seconds * 1000)
                        .toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' });
                    return `• **${team1Name}** vs **${team2Name}** | ${date} | ${m.data.finished ? m.data.score : "Nadchodzący"} | \`${m.id}\``;
                };

                const upcomingLines = await Promise.all(upcoming.map(formatLine));
                const finishedLines = await Promise.all(finished.map(formatLine));

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`📋 Mecze drużyny ${teamResolv}`)
                            .setColor(0x5eebc5)
                            .addFields(
                                { name: `⏳ Nadchodzące (${upcoming.length})`, value: upcomingLines.join('\n') || '-', inline: false },
                                { name: `✅ Zakończone (${finished.length})`, value: finishedLines.join('\n') || '-', inline: false },
                            )
                            .setTimestamp()
                    ]
                });
            }
        } else if (subcommand === "modify") {
            await interaction.deferReply();
            const matchId = interaction.options.getString("matchid", true);
            const newDate = interaction.options.getString("date");
            const newTime = interaction.options.getString("time");
            const newScore = interaction.options.getString("score");
            const newType = interaction.options.getString("type", false) as MatchType ?? null
            const bracket = interaction.options.getString("bracket", false) as BracketType ?? null

            const matchDoc = await findMatch(matchId);
            if (!matchDoc)
                return interaction.editReply({ content: `❌ Nie znaleziono meczu o ID **${matchId}**.` });

            const { team1Name, team2Name } = await resolveMatchTeamNames(matchDoc.data);

            const updates: Record<string, any> = {};

            if (newDate || newTime) {
                const dateStr = newDate ?? new Date((matchDoc.data.date as any)._seconds * 1000).toLocaleDateString('pl-PL').split('.').join('.');
                const timeStr = newTime ?? new Date((matchDoc.data.date as any)._seconds * 1000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

                const dateParts = dateStr.split(".");
                const timeParts = timeStr.split(":");

                if (dateParts.length !== 3 || timeParts.length !== 2)
                    return interaction.editReply({ content: "❌ Nieprawidłowy format daty lub godziny. Użyj DD.MM.RRRR i HH:MM." });

                const [day, month, year] = dateParts.map(Number);
                const [hours, minutes] = timeParts.map(Number);

                if ([day, month, year, hours, minutes].some(isNaN))
                    return interaction.editReply({ content: "❌ Data lub godzina zawiera nieprawidłowe wartości." });

                const matchDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+02:00`);
                if (isNaN(matchDate.getTime()))
                    return interaction.editReply({ content: "❌ Nieprawidłowa data meczu." });

                updates.date = matchDate;
            }

            if (newScore) {
                const scoreParts = newScore.split(":");
                if (scoreParts.length !== 2 || scoreParts.some(p => isNaN(Number(p))))
                    return interaction.editReply({ content: "❌ Wynik musi być w formacie X:Y (np. 2:1)." });
                updates.score = newScore;
            }

            if (newType) {
                updates.type = newType
            }

            if (bracket) {
                updates.bracketId = bracket
            }

            if (Object.keys(updates).length === 0)
                return interaction.editReply({ content: "❌ Nie podano żadnych zmian." });

            await db.collection("Matches").doc(matchId).set(updates, { merge: true });
            await interaction.editReply({ content: `✅ Mecz **${team1Name}** vs **${team2Name}** został zaktualizowany.` });

        } else if (subcommand === "complete") {
            const matchId = interaction.options.getString("matchid", true);
            const score = interaction.options.getString("score", true);

            const matchDoc = await findMatch(matchId);
            if (!matchDoc)
                return interaction.reply({ content: `❌ Nie znaleziono meczu o ID **${matchId}**.`, flags: MessageFlags.Ephemeral });

            const scoreParts = score.split(":");
            if (scoreParts.length !== 2 || scoreParts.some(p => isNaN(Number(p))))
                return interaction.reply({ content: "❌ Wynik musi być w formacie X:Y.", flags: MessageFlags.Ephemeral });

            await db.collection("Matches").doc(matchId).set({ score, finished: true }, { merge: true });

            const [score1, score2] = scoreParts.map(Number);

            await db.collection("Matches").doc(matchId).set({ score, finished: true }, { merge: true });

            if (score1 !== score2) {
                const winnerTeam = score1 > score2 ? matchDoc.data.team1 : matchDoc.data.team2;
                const loserTeam = score1 > score2 ? matchDoc.data.team2 : matchDoc.data.team1;

                const winnerDoc = await findTeamById(winnerTeam);
                const loserDoc = await findTeamById(loserTeam);

                await Promise.all([
                    setScore(winnerTeam, (winnerDoc?.data.wins ?? 0) + 1, undefined),
                    setScore(loserTeam, undefined, (loserDoc?.data.loses ?? 0) + 1),
                ]);
            }

            const { team1Name, team2Name } = await resolveMatchTeamNames(matchDoc.data);

            const reply = await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: [
                    `⚔️ **${team1Name}** vs **${team2Name}** | Wynik: **${score}**`,
                    ``,
                    `Podaj statystyki graczy po jednym na wiadomość w formacie:`,
                    `\`username K D A\` (np. \`amalgat 10 3 5\`)`,
                    ``,
                    `Wpisz \`koniec\` aby zakończyć.`,
                ].join('\n')
            });

            const saved: string[] = [];
            const channel = interaction.channel! as TextChannel;

            const collector = channel.createMessageCollector({
                filter: m => m.author.id === interaction.user.id,
                time: 5 * 60 * 1000, // 5 minutes
            });

            collector.on("collect", async (msg) => {
                await msg.delete().catch(() => null);

                if (msg.content.trim().toLowerCase() === "koniec") {
                    collector.stop("done");
                    return;
                }

                const parts = msg.content.trim().split(/\s+/);
                if (parts.length !== 4) {
                    const err = await channel.send({ content: "❌ Format: `username K D A`" });
                    setTimeout(() => err.delete().catch(() => null), 3000);
                    return;
                }

                const [username, k, d, a] = parts;
                const result = await addMatchPlayer(matchId, username, parseInt(k), parseInt(d), parseInt(a));

                if (result.code === 0) saved.push(result.message);

                const feedback = await channel.send({ content: result.message });
                setTimeout(() => feedback.delete().catch(() => null), 4000);
            });

            collector.on("end", async (_, reason) => {
                const summary = saved.length > 0
                    ? `✅ Zapisano ${saved.length} graczy:\n${saved.join('\n')}`
                    : `⚠️ Nie zapisano żadnych graczy.`;

                await reply.edit({ content: summary });
            });
        } else if (subcommand === "delete") {
            const matchId = interaction.options.getString("matchid", true);
            const result = await deleteMatch(matchId);
            await interaction.editReply({ content: resultContent(result) });
        }
    }
};