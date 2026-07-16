import type { FastifyReply } from "fastify";
import { getTurnGameEngine } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { getEnabledConversationSchedules } from "./conversation-context-utils.js";
import { getCurrentStatus, type WeekSchedule } from "../conversation/schedule.service.js";
import { resolveConversationTimeZone, toZonedWallClockDate } from "../conversation/timezone.js";
import { runTurnGameBotTurns } from "../turn-games/turn-game-bot-runner.service.js";
import { getActiveTurnGame, startTurnGame } from "../turn-games/turn-game-runner.service.js";

interface TurnGameCommandArgs {
  commandType: string;
  characterId: string | null;
  chatId: string;
  chatMeta: Record<string, unknown>;
  db: DB;
  chats: { getById(id: string): Promise<{ characterIds?: unknown } | null> };
  conn: unknown;
  baseUrl: string;
  reply: FastifyReply;
  signal: AbortSignal;
}

function normalizeGameType(commandType: string) {
  return commandType.replaceAll("_", "-");
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
  const gameType = normalizeGameType(args.commandType);
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
    const scheduleNow = toZonedWallClockDate(new Date(), resolveConversationTimeZone(args.chatMeta));
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
    if (botCharacterIds.length + 1 < engine.minPlayers) {
      logger.warn("[commands] %s requested without enough available players in chat %s", gameType, args.chatId);
      return true;
    }

    const outcome = await startTurnGame(args.db, args.chatId, {
      gameType,
      botCharacterIds,
      humanFirst: true,
    });
    if (!outcome.ok) {
      logger.warn("[commands] %s start failed in chat %s: %s", gameType, args.chatId, outcome.error ?? "");
      return true;
    }

    args.reply.raw.write(`data: ${JSON.stringify({ type: "turn_game_state_patch", data: outcome.view })}\n\n`);
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
    });
    return true;
  } catch (error) {
    logger.error(error, "[commands] %s start failed", gameType);
    return true;
  }
}
