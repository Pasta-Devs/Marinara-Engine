import type { ChatUserIdentity } from "../chat-user-identity.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { CONVERSATION_COMMAND_KEYS, ROLEPLAY_COMMAND_KEYS } from "@marinara-engine/shared";
import { buildPartyNpcId, isPartyNpcId } from "../generation/game-party-utils.js";

/** Only the host's room coordinator constructs this authority; it is never request JSON. */
export interface GenerationRoomContext {
  roomId: string;
  epoch: string;
  operationId: string;
  signal?: AbortSignal;
}

type Participant = { id: string; displayName: string; persona: { name: string; description: string }; isHost: boolean };
export interface RoomGenerationPolicy extends GenerationRoomContext {
  chatId: string;
  characterIds: readonly string[];
  characters: readonly { id: string; name: string; role: "character" | "gm" }[];
  lorebookIds: readonly string[];
  participants: readonly Participant[];
  memories: Record<string, Array<{ from: string; summary: string }>>;
}

const roomGeneration = new AsyncLocalStorage<RoomGenerationPolicy | null>();
export const currentRoomGeneration = (): RoomGenerationPolicy | undefined => roomGeneration.getStore() ?? undefined;
export function runWithRoomGeneration<T>(policy: RoomGenerationPolicy | null, operation: () => T): T {
  return roomGeneration.run(policy, operation);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function resolveRoomGenerationPolicy(
  chatId: string,
  metadata: Record<string, unknown>,
  _characterIds: readonly string[],
  authority?: GenerationRoomContext,
): RoomGenerationPolicy | null {
  authority?.signal?.throwIfAborted();
  const room = record(metadata.multiplayer);
  if (room.role !== "host" || room.status === "ended") {
    if (authority) throw new Error("The room generation authority is no longer active.");
    return null;
  }
  if (
    room.version !== 1 ||
    room.status !== "active" ||
    !authority ||
    room.roomId !== authority.roomId ||
    room.epoch !== authority.epoch ||
    room.generationOperationId !== authority.operationId ||
    typeof authority.operationId !== "string" ||
    !/^[A-Za-z0-9_-]{8,64}$/u.test(authority.operationId)
  )
    throw new Error("Shared-room generation must be coordinated by the active host room.");
  const participants = Array.isArray(room.participants)
    ? room.participants.filter((value): value is Participant => {
        const participant = record(value);
        const persona = record(participant.persona);
        return (
          participant.joinsNextRound !== true &&
          typeof participant.id === "string" &&
          typeof participant.displayName === "string" &&
          typeof persona.name === "string" &&
          typeof persona.description === "string" &&
          typeof participant.isHost === "boolean"
        );
      })
    : [];
  if (!participants.length || participants.filter((participant) => participant.isHost).length !== 1)
    throw new Error("The room's approved roster is invalid.");
  const characters: RoomGenerationPolicy["characters"] = Array.isArray(room.characters)
    ? room.characters.flatMap((value) => {
        const character = record(value);
        return typeof character.id === "string" &&
          typeof character.name === "string" &&
          (character.role === "character" || character.role === "gm")
          ? [{ id: character.id, name: character.name, role: character.role }]
          : [];
      })
    : [];
  const approvedCharacterIds = characters.map((character) => character.id);
  const memories: RoomGenerationPolicy["memories"] = {};
  for (const [id, values] of Object.entries(record(metadata.multiplayerCharacterMemories))) {
    if (!approvedCharacterIds.includes(id) || !Array.isArray(values)) continue;
    memories[id] = values
      .flatMap((value) => {
        const memory = record(value);
        return typeof memory.from === "string" && typeof memory.summary === "string"
          ? [{ from: memory.from, summary: memory.summary }]
          : [];
      })
      .slice(-12);
  }
  const lorebookIds = Array.isArray(metadata.activeLorebookIds)
    ? metadata.activeLorebookIds.filter((id): id is string => typeof id === "string")
    : [];
  return { ...authority, chatId, characterIds: approvedCharacterIds, characters, lorebookIds, participants, memories };
}

const ROOM_TOOLS = new Set([
  "roll_dice",
  "set_expression",
  "update_game_state",
  "trigger_event",
  "search_lorebook",
  "read_chat_summary",
  "append_chat_summary",
  "read_chat_variable",
  "write_chat_variable",
]);
const ROOM_CONVERSATION_COMMANDS = new Set(["schedule_update", "memory", "react"]);
const ROOM_ROLEPLAY_COMMANDS = new Set(["notes", "dismiss_notes", "memory", "dismiss_memory", "roll", "whisper"]);
const ROOM_AGENT_RESULTS: Record<string, readonly string[]> = {
  "world-state": ["game_state_update"],
  combat: ["game_state_update"],
  "character-tracker": ["character_tracker_update"],
  "persona-stats": ["persona_stats_update"],
  "inventory-tracker": ["inventory_tracker_update"],
  "custom-tracker": ["custom_tracker_update"],
  quest: ["quest_update"],
  expression: ["sprite_change"],
  cyoa: ["cyoa_choices"],
  director: ["director_event", "secret_plot"],
  "prose-guardian": ["text_rewrite"],
  continuity: ["text_rewrite"],
};

export function roomToolAllowed(name: string): boolean {
  const room = currentRoomGeneration();
  return !room || (!room.signal?.aborted && ROOM_TOOLS.has(name));
}

export function roomConversationCommandAllowed(type: string): boolean {
  const room = currentRoomGeneration();
  return !room || (!room.signal?.aborted && ROOM_CONVERSATION_COMMANDS.has(type));
}

export function roomRoleplayCommandAllowed(type: string): boolean {
  const room = currentRoomGeneration();
  return !room || (!room.signal?.aborted && ROOM_ROLEPLAY_COMMANDS.has(type));
}

export function roomAgentAllowed(type: string, settings?: unknown): boolean {
  const room = currentRoomGeneration();
  if (!room) return true;
  if (room.signal?.aborted) return false;
  const results = ROOM_AGENT_RESULTS[type];
  if (!results) return false;
  const resultType = record(settings).resultType;
  return resultType === undefined || (typeof resultType === "string" && results.includes(resultType));
}

/** Tracked NPC companions are room state; they never authorize a library-card lookup. */
export function filterRoomGamePartyCharacterIds(
  metadata: Record<string, unknown>,
  approvedCharacterIds: readonly string[],
): string[] {
  const trackedNpcIds = new Set(
    (Array.isArray(metadata.gameNpcs) ? metadata.gameNpcs : []).flatMap((value) => {
      const name = record(value).name;
      return typeof name === "string" && name.trim() ? [buildPartyNpcId(name)] : [];
    }),
  );
  return Array.isArray(metadata.gamePartyCharacterIds)
    ? metadata.gamePartyCharacterIds.filter(
        (id): id is string =>
          typeof id === "string" && (isPartyNpcId(id) ? trackedNpcIds.has(id) : approvedCharacterIds.includes(id)),
      )
    : [];
}

/** Preserve prompts and user text verbatim; restrict executable configuration, not prose. */
export function roomGenerationMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const room = currentRoomGeneration();
  if (!room) return metadata;
  return {
    ...metadata,
    crossChatAwareness: false,
    gamePartyCharacterIds: filterRoomGamePartyCharacterIds(metadata, room.characterIds),
    discordWebhookUrl: "",
    conversationCommandToggles: {
      ...record(metadata.conversationCommandToggles),
      ...Object.fromEntries(
        CONVERSATION_COMMAND_KEYS.filter((key) => !ROOM_CONVERSATION_COMMANDS.has(key)).map((key) => [key, false]),
      ),
    },
    roleplayCommandToggles: {
      ...record(metadata.roleplayCommandToggles),
      ...Object.fromEntries(
        ROLEPLAY_COMMAND_KEYS.filter((key) => !ROOM_ROLEPLAY_COMMANDS.has(key)).map((key) => [key, false]),
      ),
    },
    activeAgentIds: Array.isArray(metadata.activeAgentIds)
      ? metadata.activeAgentIds.filter((id) => typeof id === "string" && roomAgentAllowed(id))
      : [],
    gameUseMusicDj: false,
    gameUseSpotifyMusic: false,
  };
}

export function roomRosterPrompt(): string | null {
  const room = currentRoomGeneration();
  if (!room) return null;
  return [
    "[Shared room human participants]",
    "Each participant controls only their own persona. Never invent actions or dialogue for any human-controlled persona. AI characters and the GM remain separate from these human players. The existing user macro does not change ownership when another participant speaks. In Game mode, name the acting persona with who= on every skill check or sheet/inventory command; never substitute one participant's stats or possessions for another's.",
    ...room.participants.map(
      (participant) =>
        `${participant.displayName} controls ${participant.persona.name}${participant.isHost ? " (host)" : ""}:\n${participant.persona.description}`,
    ),
    "[End shared room human participants]",
    "[Approved AI roles]",
    "AI characters speak and act as their own characters. An approved GM narrates the shared scene, manages the situation and adjudicates declared actions in this mode, without taking over human personas. Follow the approved role of the current speaker.",
    ...room.characters.map((character) => `${character.name}: ${character.role === "gm" ? "GM" : "AI character"}`),
    "[End approved AI roles]",
  ].join("\n\n");
}

/** Prompt-local identity: a guest message never switches the host's {{user}} binding. */
export function roomHostIdentity(): ChatUserIdentity | null {
  const host = currentRoomGeneration()?.participants.find((participant) => participant.isHost);
  if (!host) return null;
  return {
    source: "persona",
    id: host.id,
    name: host.persona.name,
    description: host.persona.description,
    phoneticName: "",
    personality: "",
    scenario: "",
    backstory: "",
    appearance: "",
    avatarPath: null,
    avatarCrop: null,
    nameColor: null,
    dialogueColor: null,
    boxColor: null,
    tags: [],
    aboutMe: "",
    convoDisplayName: "",
    characterSheetImageId: null,
    useCharacterSheetAsReference: false,
  };
}
