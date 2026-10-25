// ──────────────────────────────────────────────
// Routes: creature packs (design-game-creature-art.md)
//
// Art for the creatures Game Mode fights, made in Pixelforge or imported from a file, filed under
// `local/<id>` as tile packs are; one is chosen for every fight (the library's "creatures" selection),
// and fights read the chosen one from `GET /api/game-tile-packs/creatures` (none: today's tokens).
// Saving, importing and removing are administrative acts behind `requirePrivilegedAccess`; the choice is
// a preference.
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { CREATURE_PACK_MAX_BYTES, parseCreaturePack, type CreaturePack } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { GAME_RULESETS_RATE_LIMIT } from "../middleware/rate-limit.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import {
  createGameCreaturePacksStorage,
  CreaturePackVersionConflictError,
  type GameCreaturePackRow,
} from "../services/storage/game-creature-packs.storage.js";

/** The stored pack every fight is drawn with, in app settings. */
const SELECTION_KEY = "gameCreaturePackSelection";
const LOCAL = "local/";
/** A pack saved from the maker is no larger than a share file can be. */
const SAVE_BODY_LIMIT = CREATURE_PACK_MAX_BYTES + 16_384;
/** A share file sent as text (a sheet's base64 never needs escaping; the rest is small). */
const IMPORT_BODY_LIMIT = CREATURE_PACK_MAX_BYTES * 2 + 16_384;

/** Where a saved pack is filed: under `local/` by its own name, whatever namespace it came with
 *  (`board/forest` edited in the maker is filed as `local/forest`), as a pack's id has one at most. */
const localId = (id: string) => {
  const filed = `${LOCAL}${id.slice(id.indexOf("/") + 1)}`;
  return filed.length <= 80 ? filed : null;
};
/** The pack a removal names: an id without a namespace is a library one, as it was filed. */
const removalId = (id: string) => (id.includes("/") ? id : `${LOCAL}${id}`);
const packIdSchema = z.string().min(1).max(80);

/** A stored row read back as a pack, under the id it is filed by. */
function packOf(row: GameCreaturePackRow): CreaturePack | null {
  const read = parseCreaturePack(row.definition);
  return read.ok ? { ...read.pack, id: row.packId } : null;
}

export async function gameCreaturePacksRoutes(app: FastifyInstance) {
  const store = createGameCreaturePacksStorage(app.db);
  const settings = createAppSettingsStorage(app.db);
  const readSelection = async (): Promise<string | null> => {
    const value = await settings.get(SELECTION_KEY);
    return value ? value : null;
  };

  const save = async (reply: FastifyReply, pack: CreaturePack, notes: string[]) => {
    const id = localId(pack.id);
    if (!id) return reply.status(400).send({ error: "The creature pack's id is too long." });
    const filed = { ...pack, id };
    try {
      const { status, row } = await store.put(filed, JSON.stringify(filed));
      logger.info("[game/creature-packs] %s version %d: %s", row.packId, row.version, status);
      return {
        status,
        pack: { id: row.packId, version: row.version, name: row.name, creatures: row.creatures },
        notes,
      };
    } catch (error) {
      if (error instanceof CreaturePackVersionConflictError) {
        return reply.status(409).send({ error: error.message, code: "creature_pack_version_conflict" });
      }
      throw error;
    }
  };
  const refuse = (reply: FastifyReply, issues: string[]) =>
    reply.status(400).send({ error: `The creature pack is not usable: ${issues.slice(0, 5).join("; ")}` });

  // ── GET /api/game-tile-packs/creatures ── the pack fights are drawn with, or none.
  app.get("/", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async () => {
    const chosen = await readSelection();
    const row = chosen ? await store.latestOf(chosen) : null;
    return { pack: row ? packOf(row) : null };
  });

  // ── GET /api/game-tile-packs/creatures/library ── the stored packs and the one chosen.
  app.get("/library", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async () => ({
    packs: (await store.latest()).map((row) => ({
      id: row.packId,
      name: row.name,
      version: row.version,
      creatures: row.creatures,
    })),
    selection: await readSelection(),
  }));

  // ── GET /api/game-tile-packs/creatures/pack?id= ── a stored pack's latest version.
  app.get("/pack", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    const { id } = z.object({ id: packIdSchema }).parse(req.query);
    const row = await store.latestOf(id);
    const pack = row ? packOf(row) : null;
    if (!pack) return reply.status(404).send({ error: "No such creature pack." });
    return { pack };
  });

  // ── POST /api/game-tile-packs/creatures ── a pack saved from the maker.
  app.post("/", { bodyLimit: SAVE_BODY_LIMIT, config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Creature pack save" })) return;
    const read = parseCreaturePack(z.object({ pack: z.unknown().optional() }).parse(req.body).pack);
    return read.ok ? save(reply, read.pack, read.notes) : refuse(reply, read.issues);
  });

  // ── POST /api/game-tile-packs/creatures/import ── a share file.
  app.post(
    "/import",
    { bodyLimit: IMPORT_BODY_LIMIT, config: { rateLimit: GAME_RULESETS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Creature pack import" })) return;
      const read = parseCreaturePack(z.object({ definition: z.string().min(1) }).parse(req.body).definition);
      return read.ok ? save(reply, read.pack, read.notes) : refuse(reply, read.issues);
    },
  );

  // ── DELETE /api/game-tile-packs/creatures?id= ── every version; if it was chosen, fights go back to tokens.
  app.delete("/", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Creature pack removal" })) return;
    const { id } = z.object({ id: packIdSchema }).parse(req.query);
    const filed = removalId(id);
    const removed = await store.removeAll(filed);
    if (!removed) return reply.status(404).send({ error: "No such creature pack." });
    if ((await readSelection()) === filed) await settings.set(SELECTION_KEY, "");
    return { removed };
  });

  // ── PUT /api/game-tile-packs/creatures/selection ── the pack fights are drawn with; none for tokens.
  app.put("/selection", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    const { packId } = z.object({ packId: packIdSchema.nullable() }).parse(req.body);
    if (packId && !(await store.latestOf(packId))) return reply.status(404).send({ error: "No such creature pack." });
    await settings.set(SELECTION_KEY, packId ?? "");
    return { selection: packId };
  });
}
