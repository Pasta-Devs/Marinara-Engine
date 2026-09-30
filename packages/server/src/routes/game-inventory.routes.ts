// One route for every change the player makes to Game Mode's inventory. The screen sends
// operations; the server applies them to the stacks as saved and writes the stacks, the detailed
// inventory and the journal together, then answers with what the inventory now is.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { applyGameInventoryOps, gameInventoryOpsRequestSchema } from "@marinara-engine/shared";
import { commitGameInventoryChange, loadGameInventoryItemBook } from "../services/game/game-inventory.service.js";
import { restGameRulesetCharacter, useGameRulesetItem } from "../services/game/game-item-use.service.js";

const restRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    character: z.string().min(1).max(200),
    rest: z.string().min(1).max(64),
  })
  .strict();
const itemUseRequestSchema = z
  .object({ chatId: z.string().min(1).max(200), stackId: z.string().min(1).max(200) })
  .strict();

export async function gameInventoryRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = gameInventoryOpsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid inventory change", issues: parsed.error.issues.slice(0, 10) });
    }
    const { chatId, ops } = parsed.data;
    // The ruleset's items, read before the change so no catalog is read with the chat's queue held.
    const rules = await loadGameInventoryItemBook(app.db, { chatId }, "player");
    const committed = await commitGameInventoryChange(app.db, chatId, (stacks) => {
      const outcome = applyGameInventoryOps(stacks, ops, undefined, rules);
      return { stacks: outcome.stacks, journal: outcome.journal, value: outcome.results };
    });
    if (!committed) return reply.status(404).send({ error: "Chat not found" });
    return {
      inventory: committed.stacks,
      results: committed.value,
      ...(committed.playerStats ? { playerStats: committed.playerStats } : {}),
    };
  });

  // Using one of the ruleset's items outside a fight: what it does to whoever carries it lands on
  // their sheet, the item is spent, and the answer carries the line the Game Master is told.
  app.post("/use", async (req, reply) => {
    const parsed = itemUseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid item use", issues: parsed.error.issues.slice(0, 10) });
    }
    const used = await useGameRulesetItem(app.db, parsed.data.chatId, parsed.data.stackId);
    if (!used.ok)
      return reply.status(used.status).send({ error: used.error, ...(used.reason ? { reason: used.reason } : {}) });
    return {
      inventory: used.inventory,
      rulesetLive: used.rulesetLive,
      said: used.said,
      line: used.line,
      ...(used.playerStats ? { playerStats: used.playerStats } : {}),
    };
  });

  // The sheet's Rest button: a rest on one character's sheet, and the charges it brings back to what
  // they carry, written together.
  app.post("/rest", async (req, reply) => {
    const parsed = restRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid rest", issues: parsed.error.issues.slice(0, 10) });
    }
    const rested = await restGameRulesetCharacter(app.db, parsed.data.chatId, parsed.data.character, parsed.data.rest);
    if (!rested.ok)
      return reply
        .status(rested.status)
        .send({ error: rested.error, ...(rested.reason ? { reason: rested.reason } : {}) });
    const { ok: _ok, ...answer } = rested;
    return answer;
  });
}
