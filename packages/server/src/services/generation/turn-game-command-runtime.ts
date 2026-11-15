import type { GenerationOutput } from "../../routes/generate/sse.js";
import { getTurnGameEngine } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { sendSseEvent } from "../../routes/generate/sse.js";
import { getEnabledConversationSchedules } from "./conversation-context-utils.js";
import { getCurrentStatus, type WeekSchedule } from "../conversation/schedule.service.js";
import { resolveConversationTimeZone, toZonedWallClockDate } from "../conversation/timezone.js";
import { runTurnGameBotTurns } from "../turn-games/turn-game-bot-runner.service.js";
import { getActiveTurnGame, humanSeatIdFromChat, startTurnGame } from "../turn-games/turn-game-runner.service.js";
import {
  getCapabilityTurnGameStartConfig,
  turnGameTypeForCommand,
} from "../capability-packages/capability-command-registry.service.js";
import { withDeadline } from "../capability-packages/capability-prompt-context.service.js";

interface TurnGameCommandArgs {
  commandType: string;
  characterId: string | null;
  chatId: string;
  chatMeta: Record<string, unknown>;
  db: DB;
  chats: { getById(id: string): Promise<{ characterIds?: unknown; personaId?: string | null } | null> };
  conn: unknown;
  baseUrl: string;
  reply: GenerationOutput;
  signal: AbortSignal;
  debugLog?: (message: string, ...args: unknown[]) => void;
}

function readCharacterIds(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Package-agnostic bridge from a registered bracket command to a registered engine. */
export async function handleTurnGameCommand(args: TurnGameCommandArgs): Promise<boolean> {
  const gameType = turnGameTypeForCommand(args.commandType);
  const engine = getTurnGameEngine(gameType);
  if (!engine) return false;

  try {
    if (await getActiveTurnGame(args.db, args.chatId)) {
      logger.info("[commands] %s requested but a game is already active in chat %s", gameType, args.chatId);
      return true;
    }

    const chat = await args.chats.getById(args.chatId);
    const characterIds = readCharacterIds(chat?.characterIds);
    const schedules = getEnabledConversationSchedules(args.chatMeta) as Record<string, WeekSchedule>;
    const timeZone = resolveConversationTimeZone(args.chatMeta);
    const scheduleNow = toZonedWallClockDate(new Date(), timeZone);
    const available = characterIds.filter((characterId) => {
      const schedule = schedules[characterId];
      return !schedule || getCurrentStatus(schedule, scheduleNow).status !== "offline";
    });
    if (args.characterId && characterIds.includes(args.characterId) && !available.includes(args.characterId)) {
      available.unshift(args.characterId);
    }

    const botCapacity = Math.max(0, engine.maxPlayers - 1);
    let botCharacterIds = engine.maxPlayers === 2 ? (args.characterId ? [args.characterId] : []) : available;
    if (args.characterId && botCharacterIds.includes(args.characterId)) {
      botCharacterIds = [args.characterId, ...botCharacterIds.filter((id) => id !== args.characterId)];
    }
    botCharacterIds = botCharacterIds.slice(0, botCapacity);

    // A package can shape the game its tag starts, as its own setup screen would (Wordle's chat, day and streaks).
    let config: unknown;
    const startConfig = getCapabilityTurnGameStartConfig(args.commandType);
    if (startConfig) {
      const proposed = botCharacterIds;
      const start = await withDeadline(
        startConfig({
          chatId: args.chatId,
          characterId: args.characterId,
          botCharacterIds: [...proposed],
          humanSeatId: humanSeatIdFromChat({ personaId: chat?.personaId ?? null }),
          timeZone: timeZone ?? null,
        }),
        `${gameType} start config`,
      );
      if (start === null) {
        logger.info("[commands] %s declined to start in chat %s", gameType, args.chatId);
        return true;
      }
      config = start?.config;
      if (Array.isArray(start?.botCharacterIds)) {
        botCharacterIds = start.botCharacterIds.filter(
          (id, index, ids) => proposed.includes(id) && ids.indexOf(id) === index,
        );
      }
    }

    if (botCharacterIds.length + 1 < engine.minPlayers) {
      logger.warn("[commands] %s requested without enough available players in chat %s", gameType, args.chatId);
      return true;
    }

    // The seats were chosen above, so an empty list means the player plays alone (a one-seat game, or a package
    // that seats no one), not every character in the chat.
    const outcome = await startTurnGame(args.db, args.chatId, {
      gameType,
      botCharacterIds,
      humanFirst: true,
      exactBotCharacterIds: true,
      ...(config === undefined ? {} : { config }),
    });
    if (!outcome.ok) {
      logger.warn("[commands] %s start failed in chat %s: %s", gameType, args.chatId, outcome.error ?? "");
      return true;
    }

    sendSseEvent(args.reply, { type: "turn_game_state_patch", data: outcome.view });
    logger.info(
      "[commands] %s started in chat %s with %d player(s)",
      gameType,
      args.chatId,
      botCharacterIds.length + 1,
    );
    await runTurnGameBotTurns({
      db: args.db,
      chatId: args.chatId,
      conn: args.conn,
      baseUrl: args.baseUrl,
      reply: args.reply,
      signal: args.signal,
      debugLog: args.debugLog,
    });
    return true;
  } catch (error) {
    logger.error(error, "[commands] %s start failed", gameType);
    return true;
  }
}
