import { Guild, TextChannel, ChannelType, PermissionFlagsBits, CategoryChannel, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ComponentType, ButtonStyle, Message, EmbedBuilder } from "discord.js";
import { db } from "./database.js";
import { exp } from "firebase/firestore/pipelines";
import { generateKey, randomUUID } from "node:crypto";

export type SchoolClass = "1B" | "1C" | "1D" | "1E" | "1F" | "1G" | "1KP" | "1O" | "1P"
    | "2B" | "2C" | "2D" | "2E" | "2F" | "2O" | "2P"
    | "3B" | "3C" | "3D" | "3E" | "3F" | "3G" | "3K" | "3O" | "3P"
    | "4C" | "4D" | "4E" | "4F" | "4G" | "4O" | "4P" | "4K"
    | "5C" | "5D" | "5E" | "5F" | "5G" | "5K" | "5P" | "5O"

export type TeamData = {
    name: string;
    short: string;
    captain_user: string;
    captain_email: string,
    role_id: string;
    channel_id: string;
    group: string;
    verified: boolean;
    id: string;
    wins: number;
    loses: number;
}

export type PlayerData = {
    username: string;
    faceit?: string;
    name: string;
    surname: string;
    class: SchoolClass;
    teamId?: string;
    verified?: boolean;

    // should always be from team document (sometimes exists in the player's own document idk why)
    captain: boolean;
    reserve: boolean;
}

export type MatchType = "group" | "eight" | "four" | "three" | "two" | "one"

export type MatchData = {
    date: Date,
    finished: boolean,
    score: string,
    team1: string,
    team2: string,
    type?: MatchType,
    bracket?: BracketType
    Players: {
        [playerId: string]: {
            assists: number,
            deaths: number,
            kills: number,
            username: string,
            teamId: string
        }
    }
}

export type BracketType = "p" | "r" | "s" | "t" | "w" | "x" | "y" | "z" | "qf1" | "qf2" | "qf3" | "qf4" | "sf1" | "sf2" | "fin" | "mfin"

export type FunctionResult =
    | { code: 0; message: string }
    | { code: 1; message: string }
    | { code: 2; message: string }

const ROLE_TEMPLATE_ID = "1480659284332384349";
const TEAM_CATEGORY_ID = "1480337748870299668";
const KANDYDAT_ROLE_ID = "1477338780796190863";
const KAPITAN_ROLE_ID = "1488252169487384719";
const REZERWA_ROLE_ID = "1490781094717554688";

const MAX_TEAM_SIZE = 6;

export const formatTeamName = (short: string, name: string) => `「${short}」- ${name}`;

// RUN

export function createChannelName(short: string, name: string) {
    return `「${short}」- ${name}`
}

export async function verify_team(guild: Guild, teamId: string): Promise<FunctionResult> {

    const teamDoc = await db.collection("Drużyny").doc(teamId).get();
    if (!teamDoc.exists)
        return { code: 1, message: `Drużyna o ID ${teamId} nie istnieje` };

    const teamData = teamDoc.data() as TeamData & { captain_email: string; verified: boolean };

    if (teamData.verified)
        return { code: 1, message: `Drużyna ${teamData.name} jest już zweryfikowana` };

    const playersSnap = await db.collection("Drużyny").doc(teamId).collection("Players").get();
    const playerUsernames = playersSnap.docs.map(doc => ({
        playerId: doc.id,
        username: doc.data().username,
        reserve: doc.data().reserve ?? false,
        captain: doc.data().captain ?? false,
    }));

    const FullTeamName = createChannelName(teamData.short, teamData.name)
    const templateRole = guild.roles.cache.get(ROLE_TEMPLATE_ID);
    if (!templateRole)
        return { code: 1, message: `Role template o ID ${ROLE_TEMPLATE_ID} nie znaleziona.` };

    const kandydatRole = guild.roles.cache.get(KANDYDAT_ROLE_ID);

    const teamRole = guild.roles.cache.find(role => role.name === FullTeamName) ?? await guild.roles.create({
        name: FullTeamName,
        color: 0x5eebc5,
        hoist: true,
        permissions: templateRole.permissions,
        position: kandydatRole ? kandydatRole.position + 1 : undefined,
    });

    const teamChannel = guild.channels.cache.find(ch => ch.name === FullTeamName) ?? await guild.channels.create({
        name: FullTeamName,
        topic: "Wasz kanał drużyny",
        type: ChannelType.GuildText,
        parent: TEAM_CATEGORY_ID,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: teamRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory,
                ]
            },
            {
                id: "1486371266968424598",
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks
                ]
            }
        ],
    }) as TextChannel;

    const categoriesWithTemplateRole = guild.channels.cache.filter(category =>
        category.type === ChannelType.GuildCategory &&
        'permissionOverwrites' in category &&
        category.permissionOverwrites.cache.has(templateRole.id)
    );

    for (const [, category] of categoriesWithTemplateRole) {
        const templateOverwrite = (category as CategoryChannel).permissionOverwrites.cache.get(templateRole.id);
        if (!templateOverwrite) continue;

        await (category as CategoryChannel).permissionOverwrites.create(teamRole, {
            ViewChannel: templateOverwrite.allow.has(PermissionFlagsBits.ViewChannel),
            SendMessages: templateOverwrite.allow.has(PermissionFlagsBits.SendMessages),
            AttachFiles: templateOverwrite.allow.has(PermissionFlagsBits.AttachFiles),
            ReadMessageHistory: templateOverwrite.allow.has(PermissionFlagsBits.ReadMessageHistory),
        });
    }

    await db.collection("Drużyny").doc(teamId).set({
        verified: true,
        role_id: teamRole.id,
        channel_id: teamChannel.id,
    }, { merge: true });

    await Promise.all(playerUsernames.map(async (player) => {
        await db.collection("Zawodnicy").doc(player.playerId).set({
            verified: true
        }, { merge: true });

        await sync_player_roles(guild, player.username);
    }));

    return { code: 0, message: `Drużyna ${teamData.name} została zweryfikowana pomyślnie` };
}

export async function remove_team(guild: Guild, teamId: string, purgeMembers: boolean = false): Promise<FunctionResult> {
    const teamDoc = await db.collection("Drużyny").doc(teamId).get();
    if (!teamDoc.exists)
        return { code: 1, message: `Drużyna o ID ${teamId} nie istnieje` };

    const teamData = teamDoc.data() as TeamData;

    const playersSnap = await db.collection("Drużyny").doc(teamId).collection("Players").get();
    const playerUsernames = playersSnap.docs.map(doc => ({
        id: doc.id,
        username: doc.data().username
    }));

    const kandydatRole = guild.roles.cache.get(KANDYDAT_ROLE_ID);
    const kapitanRole = guild.roles.cache.get(KAPITAN_ROLE_ID);
    const rezerwaRole = guild.roles.cache.get(REZERWA_ROLE_ID);

    const teamRole = teamData.role_id ? guild.roles.cache.get(teamData.role_id) : undefined;

    await Promise.all(playerUsernames.map(async (player) => {
        if (purgeMembers) {
            await db.collection("Zawodnicy").doc(player.id).delete();
        } else {
            await db.collection("Zawodnicy").doc(player.id).set({
                teamId: null,
                captain: null,
                reserve: null
            }, { merge: true });
        }

        await playersSnap.docs.find(d => d.id === player.id)?.ref.delete();

        const members = await guild.members.fetch({ query: player.username, limit: 1 });
        const member = members.first();
        if (!member) return;

        if (kapitanRole) await member.roles.remove(kapitanRole).catch(console.error);
        if (rezerwaRole) await member.roles.remove(rezerwaRole).catch(console.error);
        if (!purgeMembers && kandydatRole) await member.roles.add(kandydatRole).catch(console.error);
    }));

    if (teamRole) {
        await teamRole.delete(`Usunięcie drużyny: ${teamData.name}`).catch(console.error);
    }

    if (teamData.channel_id) {
        const teamChannel = guild.channels.cache.get(teamData.channel_id);
        if (teamChannel) await teamChannel.delete(`Usunięcie drużyny: ${teamData.name}`).catch(console.error);
    }

    await db.collection("Drużyny").doc(teamId).delete();

    const memberAction = purgeMembers ? 'usunięci z bazy' : 'odłączeni od drużyny';
    return { code: 0, message: `Drużyna ${teamData.name} została usunięta. Gracze: ${memberAction}.` };
}

export async function sync_player_roles(guild: Guild, username: string): Promise<FunctionResult> {
    const playerSnap = await db.collection("Zawodnicy")
        .where("username", "==", username)
        .limit(1)
        .get();

    const uczestnikRole = guild.roles.cache.get("1492243654201577664");
    if (!uczestnikRole)
        return { code: 1, message: `Rola uczestnik nie istnieje.` };

    const member = (await guild.members.fetch({ query: username, limit: 1 })).first();
    if (!member?.roles.cache.has("1470849814471249951") && !member?.roles.cache.has("1492243654201577664") && !member?.roles.cache.has("1486371266968424598"))
        await member?.roles.add(uczestnikRole).catch(err => console.error(err));

    if (playerSnap.empty) {

        const kandydatRole = guild.roles.cache.get(KANDYDAT_ROLE_ID);
        if (member && kandydatRole) await member.roles.add(kandydatRole).catch(console.error);
        return { code: 2, message: `Nie jesteś nigdzie przypisany. Przyznano rolę kandydat` };
    }

    const playerDoc = playerSnap.docs[0];
    const data = playerDoc.data()!;
    if (!member)
        return { code: 1, message: `Nie znaleziono gracza ${username} na serwerze` };

    const kandydatRole = guild.roles.cache.get(KANDYDAT_ROLE_ID);
    const kapitanRole = guild.roles.cache.get(KAPITAN_ROLE_ID);
    const rezerwaRole = guild.roles.cache.get(REZERWA_ROLE_ID);

    // Remove all team-related roles first
    const allTeamsSnap = await db.collection("Drużyny").get();
    const allRoleIds = allTeamsSnap.docs.map(d => d.data().role_id as string).filter(Boolean);

    const rolesToRemove = member.roles.cache.filter(r =>
        allRoleIds.includes(r.id) ||
        r.id === KANDYDAT_ROLE_ID ||
        r.id === KAPITAN_ROLE_ID ||
        r.id === REZERWA_ROLE_ID
    );

    if (rolesToRemove.size > 0) await member.roles.remove(rolesToRemove).catch(console.error);

    if (!data.teamId) {
        if (kandydatRole) await member.roles.add(kandydatRole).catch(console.error);
        return { code: 0, message: `Gracz ${username} nie ma drużyny - przyznano rolę Kandydat` };
    }

    const teamDoc = await db.collection("Drużyny").doc(data.teamId).get();
    if (!teamDoc.exists)
        return { code: 1, message: `Drużyna gracza ${username} nie istnieje w bazie` };

    const teamData = teamDoc.data()!;
    if (!teamData.verified)
        return { code: 0, message: `Twoja drużyna nie została jeszcze zaakceptowana. Spróbuj ponownie później 🗿👍` }

    const playerDoc2 = await teamDoc.ref.collection("Players").doc(playerDoc.id).get()
    const playerData = playerDoc2.data()

    const teamRole = guild.roles.cache.get(teamData.role_id);

    if (teamRole) await member.roles.add(teamRole).catch(console.error);
    if (playerData!.captain && kapitanRole) await member.roles.add(kapitanRole).catch(console.error);
    if (playerData!.reserve && rezerwaRole) await member.roles.add(rezerwaRole).catch(console.error);

    return { code: 0, message: `Zsynchronizowano role gracza ${username}` };
}

export async function remove_player_from_team(username: string): Promise<FunctionResult> {
    // const playerDoc = await db.collection("Zawodnicy").doc(username).get();
    const playerSnap = await db.collection("Zawodnicy")
        .where("username", "==", username)
        .limit(1)
        .get();
    const playerDoc = playerSnap.docs[0];

    if (!playerDoc.exists)
        return { code: 1, message: `Gracz ${username} nie istnieje w bazie danych` };

    const data = playerDoc.data()!;
    if (!data.teamId)
        return { code: 1, message: `Gracz ${username} nie należy do żadnej drużyny` };

    const teamId = data.teamId as string;

    await db.collection("Drużyny").doc(teamId).collection("Players").doc(playerDoc.id).delete();
    await db.collection("Zawodnicy").doc(playerDoc.id).set({
        teamId: null,
        captain: null,
        reserve: null,
    }, { merge: true });

    return { code: 0, message: `Gracz ${username} został usunięty z drużyny` };
}

export async function showTeamsCollector(interaction: ChatInputCommandInteraction, triggerMessage: string) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('show_teams')
            .setLabel('📋 Pokaż wszystkie drużyny')
            .setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.editReply({ content: triggerMessage, components: [row] });

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        max: 1,
    });

    collector.on('collect', async (i) => {
        const teamsSnap = await db.collection("Drużyny").get();
        const teamNames = teamsSnap.docs.map(doc => doc.data().name as string);
        await i.update({
            content: teamNames.length > 0
                ? `📋 **Wszystkie drużyny:**\n${teamNames.map(n => `• ${n}`).join('\n')}`
                : '📋 Brak drużyn w bazie danych.',
            components: []
        });
    });

    collector.on('end', (collected) => {
        if (collected.size === 0)
            interaction.editReply({ content: triggerMessage, components: [] });
    });
}

export async function createMatch(matchData: MatchData): Promise<FunctionResult> {
    if (!matchData.team1 || !matchData.team2)
        return { code: 1, message: "Obie drużyny muszą być podane." };

    if (matchData.team1 === matchData.team2)
        return { code: 1, message: "Drużyny nie mogą być takie same." };

    const [team1, team2] = await Promise.all([
        findTeam(matchData.team1),
        findTeam(matchData.team2),
    ]);

    if (!team1) return { code: 1, message: `Drużyna **${matchData.team1}** nie istnieje.` };
    if (!team2) return { code: 1, message: `Drużyna **${matchData.team2}** nie istnieje.` };

    if (!matchData.date || isNaN(new Date(matchData.date).getTime()))
        return { code: 1, message: "Nieprawidłowa data meczu." };

    if (matchData.finished) {
        if (!matchData.score)
            return { code: 1, message: "Zakończony mecz musi mieć wynik." };

        const scoreRegex = /^\d+:\d+$/;
        if (!scoreRegex.test(matchData.score))
            return { code: 1, message: "Wynik musi być w formacie X:Y (np. 2:1)." };

        if (matchData.Players && Object.keys(matchData.Players).length > 0) {
            for (const [playerId, playerStats] of Object.entries(matchData.Players)) {
                if (!playerStats.username)
                    return { code: 1, message: `Gracz ${playerId} nie ma nazwy użytkownika.` };
                if (!playerStats.teamId)
                    return { code: 1, message: `Gracz ${playerStats.username} nie ma przypisanej drużyny.` };
                if (playerStats.teamId !== team1.id && playerStats.teamId !== team2.id)
                    return { code: 1, message: `Gracz **${playerStats.username}** nie należy do żadnej z grających drużyn.` };
                if (playerStats.kills < 0 || playerStats.deaths < 0 || playerStats.assists < 0)
                    return { code: 1, message: `Gracz **${playerStats.username}** ma nieprawidłowe statystyki.` };
            }
        }
    }

    const matchId = randomUUID();
    await db.collection("Matches").doc(matchId).set({
        finished: matchData.finished,
        score: matchData.score,
        team1: matchData.team1,
        team2: matchData.team2,
        id: matchId,
        date: matchData.date instanceof Date ? matchData.date : new Date(matchData.date),
    });

    await db.collection("Matches").doc(matchId).collection("Players").select()

    const { team1Name, team2Name } = await resolveMatchTeamNames(matchData);
    return { code: 0, message: `Mecz ${team1Name} vs ${team2Name} został utworzony.` };
}

export async function addMatchPlayer(
    matchId: string,
    username: string,
    kills: number,
    deaths: number,
    assists: number
): Promise<FunctionResult> {
    const matchDoc = await findMatch(matchId);
    if (!matchDoc) return { code: 1, message: `Mecz ${matchId} nie istnieje.` };

    const [team1, team2] = await Promise.all([
        findTeamById(matchDoc.data.team1),
        findTeamById(matchDoc.data.team2),
    ]);

    if (!team1 || !team2) return { code: 1, message: "Nie znaleziono drużyn meczu." };

    const player = await findPlayer(username);
    if (!player) return { code: 1, message: `Gracz **${username}** nie istnieje w bazie.` };

    if ([kills, deaths, assists].some(v => isNaN(v) || v < 0))
        return { code: 1, message: `Nieprawidłowe statystyki dla gracza **${username}**.` };

    const teamId = player.data.teamId as string | null;
    if (!teamId)
        return { code: 1, message: `Gracz **${username}** nie należy do żadnej drużyny.` };

    if (teamId !== team1.id && teamId !== team2.id)
        return { code: 1, message: `Gracz **${username}** nie gra w tym meczu.` };

    await db.collection("Matches").doc(matchId).collection("Players").doc(player.id).set({
        username,
        kills,
        deaths,
        assists,
        teamId,
    });

    const teamName = teamId === team1.id ? team1.data.name : team2.data.name;
    return { code: 0, message: `✅ **${username}** [${teamName}] — K:${kills} D:${deaths} A:${assists}` };
}

export async function deleteMatch(matchId: string): Promise<FunctionResult> {
    const matchDoc = await findMatch(matchId);
    if (!matchDoc)
        return { code: 1, message: `Mecz o ID ${matchId} nie istnieje.` };

    const { team1Name, team2Name } = await resolveMatchTeamNames(matchDoc.data);

    const playersSnap = await db.collection("Matches").doc(matchId).collection("Players").get();
    await Promise.all(playersSnap.docs.map(doc => doc.ref.delete()));
    await db.collection("Matches").doc(matchId).delete();

    return { code: 0, message: `Mecz **${team1Name}** vs **${team2Name}** został usunięty.` };
}

export async function setScore(teamResolvable: string, wins?: number | null, loses?: number | null): Promise<FunctionResult> {
    const team = await findTeam(teamResolvable);
    if (!team)
        return { code: 1, message: `Team ${teamResolvable} not found` };

    const updates: Record<string, number> = {};
    if (wins !== undefined && wins !== null) updates.wins = wins;
    if (loses !== undefined && loses !== null) updates.loses = loses;

    if (Object.keys(updates).length === 0)
        return { code: 1, message: "Didnt update anything" };

    await db.collection("Drużyny").doc(team.id).set(updates, { merge: true });

    const parts = [
        wins !== undefined && wins !== null ? `Wygrane: ${wins}` : null,
        loses !== undefined && loses !== null ? `Przegrane: ${loses}` : null,
    ].filter(Boolean).join(", ");

    return { code: 0, message: `Updated team **${team.data.name}**: ${parts}` };
}

// FIND IN DATABASE

export async function findTeam(teamResolvable: string): Promise<{ id: string; data: TeamData } | null> {
    let snap = await db.collection("Drużyny").where("name", "==", teamResolvable).limit(1).get();
    if (snap.empty) {
        snap = await db.collection("Drużyny").where("short", "==", teamResolvable.toUpperCase()).limit(1).get();
    }

    if (snap.empty) {
        const response = await findTeamById(teamResolvable)
        return response
    };
    return { id: snap.docs[0].id, data: snap.docs[0].data() as TeamData };
}

export async function findTeamById(teamId: string): Promise<{ id: string; data: TeamData } | null> {
    const doc = await db.collection("Drużyny").doc(teamId).get();
    if (!doc.exists) return null;
    const data = doc.data() as TeamData
    return { id: doc.id, data: data };
}

export async function findPlayer(playerResolvable: string): Promise<{ id: string; data: PlayerData } | null> {
    const snap = await db.collection("Zawodnicy").where("username", "==", playerResolvable)?.limit(1).get();
    if (snap.empty) {
        const response = await findPlayerById(playerResolvable)
        return response
    };
    const playerData = snap.docs[0].data();

    if (!playerData.teamId) {
        return { id: snap.docs[0].id, data: playerData as PlayerData }
    }

    const snap2 = await db.collection("Drużyny").doc(playerData.teamId ?? "")?.collection("Players").doc(playerData.id).get();

    if (!snap2.exists) return { id: snap.docs[0].id, data: playerData as PlayerData };

    const playerTeamData = snap2.data();

    const merged = { ...playerData, ...playerTeamData };
    return { id: snap.docs[0].id, data: merged as PlayerData };
}

export async function findPlayerById(playerId: string): Promise<{ id: string; data: PlayerData } | null> {
    const doc = await db.collection("Zawodnicy").doc(playerId).get();
    if (!doc.exists) return null;
    const playerData = doc.data() as PlayerData
    const doc2 = await db.collection("Drużyny").doc(playerData.teamId || "")?.collection("Players").doc(playerId).get();
    if (!doc2.exists) {
        return { id: doc.id, data: doc.data() as PlayerData }
    }
    const playerTeamData = doc2.data() as { username: string, captain: boolean, reserve: boolean }
    const merged = { ...playerData, ...playerTeamData }
    return { id: doc.id, data: merged }
}

export async function findMatch(matchId: string): Promise<{ id: string; data: MatchData } | null> {
    const doc = await db.collection("Matches").doc(matchId).get();
    if (!doc.exists) return null;

    const playersSnap = await db.collection("Matches").doc(matchId).collection("Players").get();
    const players: MatchData["Players"] = {};

    playersSnap.docs.forEach(playerDoc => {
        players[playerDoc.id] = playerDoc.data() as MatchData["Players"][string];
    });

    return {
        id: doc.id,
        data: {
            ...doc.data() as MatchData,
            Players: players
        }
    };
}

export async function getMatchesByTeam(teamResolvable: string): Promise<{ id: string; data: MatchData }[]> {
    const team = await findTeam(teamResolvable);
    console.log(teamResolvable);
    if (!team) return [];
    console.log(`team found`);
    const [snap1, snap2] = await Promise.all([
        db.collection("Matches").where("team1", "==", team.data.id).get(),
        db.collection("Matches").where("team2", "==", team.data.id).get(),
    ]);

    return [...snap1.docs, ...snap2.docs].map(doc => ({ id: doc.id, data: doc.data() as MatchData }));
}

// UTIL

export async function resolveMatchTeamNames(data: MatchData): Promise<{ team1Name: string; team2Name: string }> {
    const [team1, team2] = await Promise.all([
        findTeamById(data.team1),
        findTeamById(data.team2),
    ]);
    return {
        team1Name: team1?.data.name ?? data.team1,
        team2Name: team2?.data.name ?? data.team2,
    };
}

export function resultContent(result: FunctionResult): string {
    return result.code === 0 ? `✅ ${result.message}` : `<:error:1480571711660364006> ${result.message}`;
}

// DEBUG

export async function generateAcceptance(message: Message) {
    const originalEmbed = message.embeds[0];
    if (!originalEmbed) return;

    await message.reply({
        embeds: [EmbedBuilder.from(originalEmbed)],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`reg_accept`)
                    .setLabel('✅ Zatwierdź')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reg_reject`)
                    .setLabel('❌ Odrzuć')
                    .setStyle(ButtonStyle.Danger)
            )
        ]
    });
    await message.delete();
}

export async function cleanup_old_players(): Promise<FunctionResult> {
    const snap = await db.collection("Zawodnicy").get();

    const toDelete = snap.docs.filter(doc => doc.id === doc.data().username);

    if (toDelete.length === 0)
        return { code: 0, message: "Brak dokumentów do usunięcia." };

    await Promise.all(toDelete.map(doc => doc.ref.delete()));

    return { code: 0, message: `Usunięto ${toDelete.length} przestarzałych dokumentów.` };
}

export async function fix_missing_team_ids(): Promise<FunctionResult> {
    const playersSnap = await db.collection("Zawodnicy").get();
    const teamsSnap = await db.collection("Drużyny").get();

    const playerTeamMap = new Map<string, string>();

    await Promise.all(teamsSnap.docs.map(async teamDoc => {
        const playersSubSnap = await teamDoc.ref.collection("Players").get();
        playersSubSnap.docs.forEach(playerDoc => {
            playerTeamMap.set(playerDoc.id, teamDoc.id);
        });
    }));

    const fixed: string[] = [];
    const missing: string[] = [];

    await Promise.all(playersSnap.docs.map(async playerDoc => {
        const data = playerDoc.data();
        if (data.teamId) return;

        const teamId = playerTeamMap.get(playerDoc.id);
        if (teamId) {
            await playerDoc.ref.set({ teamId }, { merge: true });
            fixed.push(data.username ?? playerDoc.id);
        } else {
            missing.push(data.username ?? playerDoc.id);
        }
    }));

    const lines = [
        fixed.length > 0 ? `✅ Naprawiono (${fixed.length}):\n${fixed.map(p => `• ${p}`).join('\n')}` : '',
        missing.length > 0 ? `⚠️ Nie znaleziono drużyny (${missing.length}):\n${missing.map(p => `• ${p}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    return {
        code: 0,
        message: lines || "Wszyscy gracze mają przypisane drużyny."
    };
}

export async function fix_player_usernames_in_team(teamId: string) {
    const playersSnap = await db.collection("Drużyny").doc(teamId).collection("Players").get();
    playersSnap.docs.forEach(async (doc) => {
        console.log(`Reading through team/player document ${doc.id}`)
        const userId = doc.id
        const playerDoc = await db.collection("Zawodnicy").doc(userId).get();
        if (!playerDoc.exists)
            return console.log(`[!!!] Player doc doesn't exist for ${userId}`)
        const playerUsername = playerDoc.data()?.username
        console.log(`Retrieved username ${playerUsername} for ${userId}`)
        await doc.ref.set({
            username: playerUsername
        }, { merge: true })
        console.log(`Successfully added username field.`)
    })
}