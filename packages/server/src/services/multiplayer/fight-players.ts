import {
  marinaraPartyLevel,
  normalizeCharacterLookupName,
  readMarinaraCardProgression,
  type DirectedRulesetPlayer,
} from "@marinara-engine/shared";
import { record } from "./room-projection.js";

/** Who plays another room player's own character as a fight begins: that player (2026-10-27), who sees
 *  the fight and commands it through the room. One not connected as it begins has the Engine play it. */
export const ROOM_GUEST_FIGHT_CONTROLLER: "manual" | "ai" = "manual";

/**
 * The room player whose own character each name is, by the name's lookup key (2026-10-26), read from the
 * host's live room: a player's character is the game card bound to them, else their persona's name. A
 * room that has ended, or a chat that is no room, has no players, and the host commands the whole party
 * as in a solo game. Two players whose characters share a name are left out rather than guessed between.
 */
export function roomPlayersByName(
  metadata: Record<string, unknown>,
): Record<string, DirectedRulesetPlayer> | undefined {
  const room = record(metadata.multiplayer);
  if (room.version !== 1 || room.role !== "host" || room.status === "ended" || !Array.isArray(room.participants))
    return undefined;
  const cards = Array.isArray(metadata.gameCharacterCards) ? metadata.gameCharacterCards.map(record) : [];
  const players: Record<string, DirectedRulesetPlayer> = {};
  const shared = new Set<string>();
  for (const participant of room.participants.map(record)) {
    if (typeof participant.id !== "string" || !participant.id) continue;
    const bound = cards.find((card) => card.multiplayerParticipantId === participant.id);
    const name = typeof bound?.name === "string" ? bound.name : record(participant.persona).name;
    const key = typeof name === "string" ? normalizeCharacterLookupName(name) : "";
    if (!key) continue;
    if (players[key]) shared.add(key);
    const displayName =
      typeof participant.displayName === "string" && participant.displayName.trim()
        ? participant.displayName.trim().slice(0, 80)
        : String(name).slice(0, 80);
    players[key] = {
      participantId: participant.id,
      name: displayName,
      ...(participant.isHost === true ? { host: true as const } : {}),
    };
  }
  for (const key of shared) delete players[key];
  return Object.keys(players).length > 0 ? players : undefined;
}

/** The same, by party member id: the one member carrying each player's character's name, never a guess
 *  between two members of one name. */
export function roomFightPlayers(
  metadata: Record<string, unknown>,
  party: ReadonlyArray<{ id: string; name: string }>,
): Record<string, DirectedRulesetPlayer> | undefined {
  const byName = roomPlayersByName(metadata);
  if (!byName) return undefined;
  const players: Record<string, DirectedRulesetPlayer> = {};
  for (const [key, player] of Object.entries(byName)) {
    const matches = party.filter((member) => normalizeCharacterLookupName(member.name) === key);
    if (matches.length === 1) players[matches[0]!.id] = player;
  }
  return Object.keys(players).length > 0 ? players : undefined;
}

/** The characters the players of a room this Engine hosts play, by name: the host's own and every other
 *  player's (2026-10-27), each the game card bound to them, else their persona's name. Null outside a
 *  hosted room. A fight is set up around them, so every player's character is in it. */
export function roomCharacterNames(
  metadata: Record<string, unknown> | null | undefined,
): { host: { name: string; description: string } | null; others: string[] } | null {
  const room = record(metadata?.multiplayer);
  if (room.version !== 1 || room.role !== "host" || room.status === "ended" || !Array.isArray(room.participants))
    return null;
  const cards = Array.isArray(metadata?.gameCharacterCards) ? metadata.gameCharacterCards.map(record) : [];
  let host: { name: string; description: string } | null = null;
  const others: string[] = [];
  for (const participant of room.participants.map(record)) {
    if (typeof participant.id !== "string" || participant.joinsNextRound === true) continue;
    const persona = record(participant.persona);
    const bound = cards.find((card) => card.multiplayerParticipantId === participant.id);
    const raw = typeof bound?.name === "string" ? bound.name : persona.name;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (participant.isHost === true)
      host = { name, description: typeof persona.description === "string" ? persona.description : "" };
    else others.push(name);
  }
  return { host, others };
}

/**
 * The room players' characters who are away (owner 2026-11-06: a guest who played to level 3 comes back
 * to that same character, even after the host went on alone to level 10). A character bound to a room
 * player who isn't seated in the live room this Engine hosts (they left, were removed, or the room ended)
 * stays on its card with its level, gear and beasts, but sits out MRPG fights and earns nothing until
 * their player is back. The host's own character is never away, and a chat that never had a room has
 * nobody away. By lookup name.
 */
export function roomAwayCharacters(metadata: Record<string, unknown> | null | undefined): Set<string> {
  const away = new Set<string>();
  const room = record(metadata?.multiplayer);
  if (room.version !== 1 || room.role !== "host" || !Array.isArray(room.participants)) return away;
  const participants = room.participants.map(record);
  const live = room.status !== "ended";
  const seated = new Set(
    participants.flatMap((participant) => (live && typeof participant.id === "string" ? [participant.id] : [])),
  );
  const hosts = new Set(
    participants.flatMap((participant) =>
      participant.isHost === true && typeof participant.id === "string" ? [participant.id] : [],
    ),
  );
  const cards = Array.isArray(metadata?.gameCharacterCards) ? metadata.gameCharacterCards.map(record) : [];
  for (const card of cards) {
    const owner = card.multiplayerParticipantId;
    if (typeof owner !== "string" || !owner || seated.has(owner) || hosts.has(owner)) continue;
    if (typeof card.name === "string" && card.name.trim()) away.add(normalizeCharacterLookupName(card.name));
  }
  return away;
}

/**
 * What the Game Master is told about a room's players in an MRPG game (owner 2026-11-06): the characters
 * who are away (see `roomAwayCharacters`), and the seated guests whose character has no MRPG class yet,
 * whom the GM onboards with `[mrpg_join]`: it always picks their sister tree, and their growths and stats
 * if it likes. Their level is its call only once the game is `underWay` (someone has levelled or earned
 * experience); in a new game they start at level 1 with everyone else. `partyLevel` leaves out the away.
 */
export function roomMrpgRoster(metadata: Record<string, unknown> | null | undefined): {
  away: string[];
  newcomers: string[];
  partyLevel: number;
  underWay: boolean;
} {
  const awayKeys = roomAwayCharacters(metadata);
  const cards = Array.isArray(metadata?.gameCharacterCards) ? metadata.gameCharacterCards.map(record) : [];
  const named = cards.filter(
    (card): card is Record<string, unknown> & { name: string } =>
      typeof card.name === "string" && Boolean(card.name.trim()),
  );
  const away = named.filter((card) => awayKeys.has(normalizeCharacterLookupName(card.name))).map((card) => card.name);
  const progressions = named.flatMap((card) => {
    const progression = readMarinaraCardProgression(card.marinara);
    return progression ? [{ card, progression }] : [];
  });
  const underWay = progressions.some(({ progression }) => progression.level > 1 || progression.xp > 0);
  const levels = progressions
    .filter(({ card, progression }) => !progression.fallen && !awayKeys.has(normalizeCharacterLookupName(card.name)))
    .map(({ progression }) => progression.level);
  const room = record(metadata?.multiplayer);
  const newcomers: string[] = [];
  if (room.version === 1 && room.role === "host" && room.status !== "ended") {
    const participants = Array.isArray(room.participants) ? room.participants.map(record) : [];
    for (const participant of participants) {
      if (participant.isHost === true || participant.joinsNextRound === true || typeof participant.id !== "string")
        continue;
      const bound = named.find((card) => card.multiplayerParticipantId === participant.id);
      if (bound && !readMarinaraCardProgression(bound.marinara)) newcomers.push(bound.name);
    }
  }
  return { away, newcomers, partyLevel: marinaraPartyLevel(levels), underWay };
}
