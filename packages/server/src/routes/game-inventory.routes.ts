// One route for every change the player makes to Game Mode's inventory. The screen sends
// operations; the server applies them to the stacks as saved and writes the stacks, the detailed
// inventory and the journal together, then answers with what the inventory now is.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { applyGameInventoryOps, gameInventoryOpsRequestSchema, rulesetLiveStateSchema } from "@marinara-engine/shared";
import { commitGameInventoryChange, loadGameInventoryItemBook } from "../services/game/game-inventory.service.js";
import {
  gameRulesetRestOffers,
  restGameRulesetCharacter,
  setGameRulesetLive,
  useGameRulesetItem,
} from "../services/game/game-item-use.service.js";
import { lootGameFight } from "../services/game/game-loot.service.js";
import { takeGameStartingGear } from "../services/game/game-starting-gear.service.js";
import { rollDieSecurely } from "../services/game/dice-rng.js";

const restRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    character: z.string().min(1).max(200),
    rest: z.string().min(1).max(64),
    /** The dice spent to heal first, by pool (a Short rest's hit dice). */
    diceFrom: z
      .record(z.string().min(1).max(64), z.number().int().min(0).max(100))
      .refine((dice) => Object.keys(dice).length <= 12, { message: "Too many pools" })
      .optional(),
    /** The features chosen to use as it ends (1.789), each with the spent pools it gives back. */
    recover: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            recover: z
              .array(z.object({ pool: z.string().min(1).max(64), count: z.number().int().min(1).max(20) }).strict())
              .min(1)
              .max(12),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();
const restOffersRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    character: z.string().min(1).max(200),
    rest: z.string().min(1).max(64),
  })
  .strict();
const liveRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    character: z.string().min(1).max(200),
    live: rulesetLiveStateSchema.nullable(),
  })
  .strict();
const lootRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    fight: z.string().min(1).max(200),
    defeated: z.number().int().min(1).max(20),
  })
  .strict();
const itemUseRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    stackId: z.string().min(1).max(200),
    /** One of the item's further uses (Capability API 1.519), by its place in `moreUses` from 1. */
    more: z.number().int().min(1).max(16).optional(),
    /** How long what it makes lasts (Capability API 1.760), by its place in `makesItems.lasts` from 1. */
    lasts: z.number().int().min(1).max(8).optional(),
  })
  .strict();
const startingGearRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    holder: z.string().min(1).max(200).optional(),
    selection: z
      .object({
        gear: z.string().min(1).max(64),
        choices: z.array(z.number().int().min(0).max(5)).max(8),
        picks: z.record(z.string().regex(/^\d{1,2}(?:\.\d{1,2})?$/), z.string().min(1).max(81)).prefault({}),
      })
      .strict(),
    again: z.boolean().optional(),
    /** Taken with Free edit on: into the bag even past what its bearer can carry. */
    pastLimit: z.boolean().optional(),
  })
  .strict();

/** A value as JSON keeps it, so an absent field and an undefined one compare equal; null for none. */
const plainValue = (value: unknown) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

export async function gameInventoryRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = gameInventoryOpsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid inventory change", issues: parsed.error.issues.slice(0, 10) });
    }
    const { chatId, ops, expected } = parsed.data;
    // The ruleset's items, read before the change so no catalog is read with the chat's queue held.
    const rules = await loadGameInventoryItemBook(app.db, { chatId }, "player");
    let stale: string[] | null = null;
    const committed = await commitGameInventoryChange(app.db, chatId, (stacks) => {
      // The stacks the caller read, compared inside the queue: one changed since is not overwritten.
      if (expected) {
        const changed = Object.entries(expected)
          .filter(
            ([id, was]) => !isDeepStrictEqual(plainValue(stacks.find((stack) => stack.id === id)), plainValue(was)),
          )
          .map(([id]) => id);
        if (changed.length > 0) {
          stale = changed;
          return { stacks, journal: [], value: [] as ReturnType<typeof applyGameInventoryOps>["results"] };
        }
      }
      // The Engine's own dice, for an item that may break as a fight spends its last charge.
      const outcome = applyGameInventoryOps(stacks, ops, undefined, rules, rollDieSecurely);
      return { stacks: outcome.stacks, journal: outcome.journal, value: outcome.results };
    });
    if (!committed) return reply.status(404).send({ error: "Chat not found" });
    // Read through a typed local: assigned only inside the change, so TS would narrow it to null here.
    const staleIds = stale as string[] | null;
    if (staleIds)
      return reply.status(409).send({
        reason: "stale",
        error: "The inventory changed meanwhile.",
        stacks: staleIds,
        inventory: committed.stacks,
      });
    return {
      inventory: committed.stacks,
      results: committed.value,
      ...(committed.playerStats ? { playerStats: committed.playerStats } : {}),
      ...(committed.foundOut ? { foundOut: committed.foundOut } : {}),
    };
  });

  // Using one of the ruleset's items outside a fight: what it does to whoever carries it lands on
  // their sheet, the item is spent, and the answer carries the line the Game Master is told.
  app.post("/use", async (req, reply) => {
    const parsed = itemUseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid item use", issues: parsed.error.issues.slice(0, 10) });
    }
    const used = await useGameRulesetItem(
      app.db,
      parsed.data.chatId,
      parsed.data.stackId,
      undefined,
      parsed.data.more,
      parsed.data.lasts,
    );
    if (!used.ok)
      return reply.status(used.status).send({
        error: used.error,
        ...(used.reason ? { reason: used.reason } : {}),
        ...(used.heldBy ? { heldBy: used.heldBy } : {}),
      });
    return {
      inventory: used.inventory,
      rulesetLive: used.rulesetLive,
      said: used.said,
      line: used.line,
      ...(used.playerStats ? { playerStats: used.playerStats } : {}),
    };
  });

  // Starting gear (Capability API 1.78): a ruleset's gear into one character's bag, once for each kind
  // of gear unless the player asks again, all of it or none of it.
  app.post("/starting-gear", async (req, reply) => {
    const parsed = startingGearRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid starting gear", issues: parsed.error.issues.slice(0, 10) });
    }
    const taken = await takeGameStartingGear(app.db, parsed.data);
    if (!taken.ok) return reply.status(taken.status).send({ error: taken.error, reason: taken.reason });
    const { ok: _ok, ...answer } = taken;
    return answer;
  });

  // A won fight the director did not run: its loot, dropped once into the bags. A directed fight drops
  // its own on the step that wins it.
  app.post("/loot", async (req, reply) => {
    const parsed = lootRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid loot", issues: parsed.error.issues.slice(0, 10) });
    }
    const looted = await lootGameFight(app.db, parsed.data.chatId, parsed.data.fight, parsed.data.defeated);
    if (!looted) return reply.status(404).send({ error: "Chat not found" });
    return looted;
  });

  // The sheet's Rest button: a rest on one character's sheet, and the charges it brings back to what
  // they carry, written together.
  app.post("/rest", async (req, reply) => {
    const parsed = restRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid rest", issues: parsed.error.issues.slice(0, 10) });
    }
    const rested = await restGameRulesetCharacter(
      app.db,
      parsed.data.chatId,
      parsed.data.character,
      parsed.data.rest,
      undefined,
      parsed.data.diceFrom,
      parsed.data.recover,
    );
    if (!rested.ok)
      return reply
        .status(rested.status)
        .send({ error: rested.error, ...(rested.reason ? { reason: rested.reason } : {}) });
    const { ok: _ok, ...answer } = rested;
    return answer;
  });

  // The features a rest offers this character to use as it ends (1.789), for the sheet's rest buttons.
  app.post("/rest-offers", async (req, reply) => {
    const parsed = restOffersRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid rest", issues: parsed.error.issues.slice(0, 10) });
    }
    const offered = await gameRulesetRestOffers(app.db, parsed.data.chatId, parsed.data.character, parsed.data.rest);
    if (!offered.ok) return reply.status(offered.status).send({ error: offered.error });
    return { offers: offered.offers };
  });

  // One character's sheet set from the in-game sheet while the screen has no game state to patch
  // (before the first turn): merged into the others here, and the row made if there is none.
  app.post("/live", async (req, reply) => {
    const parsed = liveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid sheet state", issues: parsed.error.issues.slice(0, 10) });
    }
    const set = await setGameRulesetLive(app.db, parsed.data.chatId, parsed.data.character, parsed.data.live);
    if (!set.ok) return reply.status(set.status).send({ error: set.error });
    return { rulesetLive: set.rulesetLive };
  });
}
