import type { AgentResult } from "../../../contracts/types/agent";
import type { TrackerSnapshotSavedContext } from "../../../generation/tracker-snapshots";
import type { GenerationEngineDeps, StartGenerationInput } from "../../../generation/start-generation";
import { startGeneration } from "../../../generation/start-generation";
import { isRecord, parseRecord, readString, type JsonRecord } from "../../../generation/runtime-records";
import { createJournal, syncInventoryJournalFromPlayerStats, type Journal } from "../world/journal.service";

export type GameTurnKind = "start" | "turn" | "retry";

export interface StartGameTurnInput extends StartGenerationInput {
  kind: GameTurnKind;
}

const GAME_START_GENERATION_GUIDE =
  "Begin the game now with the first visible GM VN narration/dialogue segment. This is an invisible startup trigger, not a player action. Do not mention a start command.";

const GAME_TURN_GENERATION_GUIDE =
  "Continue the game from the player's latest turn. Stay on the game-mode path: respond as the Game Master, preserve party/game mechanics, emit supported game tags for state changes, and do not switch into normal conversation or roleplay-scene behavior.";

function gameGuideFor(kind: GameTurnKind): string {
  return kind === "start" ? GAME_START_GENERATION_GUIDE : GAME_TURN_GENERATION_GUIDE;
}

function gameGuideSourceFor(kind: GameTurnKind): "game_start" | "game_turn" | "game_retry" {
  if (kind === "start") return "game_start";
  if (kind === "retry") return "game_retry";
  return "game_turn";
}

function assertGameChat(chat: JsonRecord, kind: GameTurnKind): void {
  const mode = readString(chat.mode || chat.chatMode);
  if (mode !== "game") {
    throw new Error("Game turn generation can only run for game chats.");
  }

  const metadata = parseRecord(chat.metadata);
  const sessionStatus = readString(metadata.gameSessionStatus);
  if (kind !== "start" && sessionStatus === "concluded") {
    throw new Error("This game session is concluded.");
  }
}

function isPersonaStatsResult(result: AgentResult): boolean {
  return result.agentType === "persona-stats" || result.type === "persona_stats_update";
}

function journalFromMetadata(metadata: unknown): Journal {
  const raw = parseRecord(parseRecord(metadata).gameJournal);
  const empty = createJournal();
  return {
    entries: Array.isArray(raw.entries) ? (raw.entries as Journal["entries"]) : empty.entries,
    quests: Array.isArray(raw.quests) ? (raw.quests as Journal["quests"]) : empty.quests,
    locations: Array.isArray(raw.locations) ? (raw.locations as Journal["locations"]) : empty.locations,
    npcLog: Array.isArray(raw.npcLog) ? (raw.npcLog as Journal["npcLog"]) : empty.npcLog,
    inventoryLog: Array.isArray(raw.inventoryLog) ? (raw.inventoryLog as Journal["inventoryLog"]) : empty.inventoryLog,
  };
}

async function persistGameInventoryJournalFromSnapshot(
  deps: GenerationEngineDeps,
  context: TrackerSnapshotSavedContext,
): Promise<void> {
  if (!context.results.some(isPersonaStatsResult) || !context.snapshot.playerStats) return;
  const latestRawChat = await deps.storage.get("chats", context.chatId).catch(() => context.chat);
  const latestChat = isRecord(latestRawChat) ? latestRawChat : context.chat;
  if (readString(latestChat?.mode || latestChat?.chatMode).trim() !== "game") return;

  const journal = journalFromMetadata(parseRecord(latestChat?.metadata));
  const synced = syncInventoryJournalFromPlayerStats(journal, context.snapshot.playerStats);
  if (synced === journal) return;
  await deps.storage.patchChatMetadata(context.chatId, { gameJournal: synced });
}

function hasPlayerTurnInput(input: StartGameTurnInput): boolean {
  const text = readString(input.message).trim() || readString(input.userMessage).trim();
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  return !!text || attachments.length > 0;
}

export async function* startGameTurnGeneration(
  deps: GenerationEngineDeps,
  input: StartGameTurnInput,
  signal?: AbortSignal,
) {
  const chatId = readString(input.chatId).trim();
  if (!chatId) throw new Error("chatId is required");

  const rawChat = await deps.storage.get("chats", chatId);
  if (!isRecord(rawChat)) throw new Error("Chat was not found.");
  const chat = rawChat;
  assertGameChat(chat, input.kind);
  if (input.kind === "turn" && !hasPlayerTurnInput(input)) return;

  const generationInput: StartGenerationInput = {
    ...input,
    connectionId: readString(input.connectionId).trim() || null,
    generationGuide: gameGuideFor(input.kind),
    generationGuideSource: gameGuideSourceFor(input.kind),
  };

  const upstreamOnTrackerSnapshotSaved = deps.onTrackerSnapshotSaved;
  const gameDeps: GenerationEngineDeps = {
    ...deps,
    onTrackerSnapshotSaved: async (context) => {
      await upstreamOnTrackerSnapshotSaved?.(context);
      await persistGameInventoryJournalFromSnapshot(deps, context);
    },
  };

  yield* startGeneration(gameDeps, generationInput, signal);
}
