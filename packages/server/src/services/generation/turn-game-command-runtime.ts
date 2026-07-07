import type { FastifyReply } from "fastify";

import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { getEnabledConversationSchedules } from "./conversation-context-utils.js";
import { getCurrentStatus, type WeekSchedule } from "../conversation/schedule.service.js";
import { runTurnGameBotTurns } from "../turn-games/turn-game-bot-runner.service.js";
import { getActiveTurnGame, startTurnGame } from "../turn-games/turn-game-runner.service.js";

export async function handleTurnGameCommand(args: {
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
}): Promise<boolean> {
  if (args.commandType === "uno") {
    await startUnoFromCommand(args);
    return true;
  }
  if (args.commandType === "chess") {
    await startChessFromCommand(args);
    return true;
  }
  return false;
}

async function startUnoFromCommand(args: Parameters<typeof handleTurnGameCommand>[0]): Promise<void> {
  try {
    const existingGame = await getActiveTurnGame(args.db, args.chatId);
    if (existingGame) {
      logger.info("[commands] UNO requested but a game is already active in chat %s", args.chatId);
      return;
    }

    const unoChat = await args.chats.getById(args.chatId);
    let unoCharIds: string[] = [];
    try {
      const rawCharIds = unoChat?.characterIds;
      const parsedCharIds = typeof rawCharIds === "string" ? JSON.parse(rawCharIds) : rawCharIds;
      if (Array.isArray(parsedCharIds)) {
        unoCharIds = parsedCharIds.filter((value): value is string => typeof value === "string");
      }
    } catch {
      unoCharIds = [];
    }

    const unoSchedules = getEnabledConversationSchedules(args.chatMeta) as Record<string, WeekSchedule>;
    const seatBotIds = unoCharIds.filter((cid) => {
      const sched = unoSchedules[cid];
      return !sched || getCurrentStatus(sched).status !== "offline";
    });
    if (args.characterId && unoCharIds.includes(args.characterId) && !seatBotIds.includes(args.characterId)) {
      seatBotIds.push(args.characterId);
    }

    const outcome = await startTurnGame(args.db, args.chatId, {
      gameType: "uno",
      botCharacterIds: seatBotIds,
      humanFirst: true,
    });
    if (outcome.ok) {
      args.reply.raw.write(`data: ${JSON.stringify({ type: "turn_game_state_patch", data: outcome.view })}\n\n`);
      logger.info("[commands] UNO started in chat %s with %d player(s)", args.chatId, seatBotIds.length + 1);
      await runTurnGameBotTurns({
        db: args.db,
        chatId: args.chatId,
        conn: args.conn,
        baseUrl: args.baseUrl,
        reply: args.reply,
        signal: args.signal,
      });
    } else {
      logger.warn("[commands] UNO start failed in chat %s: %s", args.chatId, outcome.error ?? "");
    }
  } catch (err) {
    logger.error(err, "[commands] UNO start failed");
  }
}

async function startChessFromCommand(args: Parameters<typeof handleTurnGameCommand>[0]): Promise<void> {
  try {
    const existingGame = await getActiveTurnGame(args.db, args.chatId);
    if (existingGame) {
      logger.info("[commands] chess requested but a game is already active in chat %s", args.chatId);
      return;
    }
    if (!args.characterId) {
      logger.warn("[commands] chess requested without an agreeing character in chat %s", args.chatId);
      return;
    }

    const outcome = await startTurnGame(args.db, args.chatId, {
      gameType: "chess",
      botCharacterIds: [args.characterId],
      humanFirst: true,
    });
    if (outcome.ok) {
      args.reply.raw.write(`data: ${JSON.stringify({ type: "turn_game_state_patch", data: outcome.view })}\n\n`);
      logger.info("[commands] chess started in chat %s against %s", args.chatId, args.characterId);
      await runTurnGameBotTurns({
        db: args.db,
        chatId: args.chatId,
        conn: args.conn,
        baseUrl: args.baseUrl,
        reply: args.reply,
        signal: args.signal,
      });
    } else {
      logger.warn("[commands] chess start failed in chat %s: %s", args.chatId, outcome.error ?? "");
    }
  } catch (err) {
    logger.error(err, "[commands] chess start failed");
  }
}
