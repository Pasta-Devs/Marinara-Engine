import type { GenerationEngineDeps, StartGenerationInput } from "../../../generation/start-generation";
import { startGeneration } from "../../../generation/start-generation";
import { isRecord, parseRecord, readString, type JsonRecord } from "../../../generation/runtime-records";

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

  yield* startGeneration(deps, generationInput, signal);
}
