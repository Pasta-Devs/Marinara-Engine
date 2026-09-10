// ──────────────────────────────────────────────
// Routes: Turn-Games (UNO, Chess, Poker, Eight Ball, and future turn-based games)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listTurnGames } from "@marinara-engine/shared";
import {
  applyTurnGameMove,
  getTurnGameView,
  resignTurnGame,
  startTurnGame,
} from "../services/turn-games/turn-game-runner.service.js";

const startSchema = z.object({
  gameType: z.string().min(1),
  config: z.unknown().optional(),
  botCharacterIds: z.array(z.string()).optional(),
  seatOrder: z.array(z.string()).optional(),
  humanFirst: z.boolean().optional(),
  seed: z.number().optional(),
});

const moveSchema = z.object({
  move: z.record(z.string(), z.unknown()),
});

// True while `/api/generate` is actively running for this chat (it owns the
// bot-turn loop). State-mutating game endpoints must defer to it: the bot loop
// and a route handler both read-modify-write the same snapshot across awaits,
// so letting them interleave races the runner and loses updates. Mirrors the
// guard in generate.routes.ts and the autonomous scheduler.
function generationInProgress(app: FastifyInstance, chatId: string): boolean {
  return app.activeGenerations?.has(chatId) ?? false;
}

export async function turnGamesRoutes(app: FastifyInstance) {
  // Catalog of available games (for the client picker).
  app.get("/catalog", async () => ({ games: listTurnGames() }));

  // Current board view for a chat, always from the chat's human seat. The viewer is
  // inferred server-side so a client can't request another seat's perspective and
  // reveal that seat's hidden hand.
  app.get("/:chatId/state", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const view = await getTurnGameView(app.db, chatId);
    if (!view) return reply.status(404).send({ error: "No active game in this chat." });
    return { view };
  });

  // Start a game.
  app.post("/:chatId/start", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    if (generationInProgress(app, chatId)) {
      return reply.status(409).send({ error: "A turn is being generated for this chat — try again once it finishes." });
    }
    const parsed = startSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid start payload", details: parsed.error.flatten() });
    }
    const result = await startTurnGame(app.db, chatId, parsed.data);
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result;
  });

  // Apply a move. The acting seat is always the chat's human seat, inferred
  // server-side — a client can never drive a bot or another player's seat. Bot
  // seats are advanced only by the server-authoritative bot loop.
  app.post("/:chatId/move", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    if (generationInProgress(app, chatId)) {
      return reply.status(409).send({ error: "A turn is being generated for this chat — try again once it finishes." });
    }
    const parsed = moveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid move payload", details: parsed.error.flatten() });
    }
    const result = await applyTurnGameMove(app.db, chatId, parsed.data.move);
    if (!result.ok) {
      // "No active game" is a missing resource (404, matching GET /state); an
      // illegal move against a live game is a genuine conflict (409) and carries
      // the legal moves the client can retry with.
      return reply.status(result.legalMoves ? 409 : 404).send(result);
    }
    return result;
  });

  // Resign / end the game.
  app.post("/:chatId/resign", async (req) => {
    const { chatId } = req.params as { chatId: string };
    await resignTurnGame(app.db, chatId);
    return { ok: true };
  });
}
