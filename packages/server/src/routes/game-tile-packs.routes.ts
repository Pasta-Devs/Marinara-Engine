// ──────────────────────────────────────────────
// Routes: tile packs (worldgen W9a)
//
// The Engine's own packs, one per setting family (read only, shipped in src/assets/overworld-tiles),
// and the packs made in Pixelforge or imported from a file, filed under `local/<id>` so none can take a
// built-in family's id. Saving, importing, removing, and choosing which pack each family is drawn with
// change what every game draws, so all sit behind `requirePrivilegedAccess`, as ruleset imports do.
// ──────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  TILE_PACK_IMAGE_FILE_MAX_BYTES,
  TILE_PACK_MAX_BYTES,
  WORLD_ART_FAMILIES,
  parseTilePack,
  type TilePack,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { cleanImageTilePack } from "../services/game/tile-pack-images.service.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { GAME_TILE_PACKS_RATE_LIMIT } from "../middleware/rate-limit.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import {
  createGameTilePacksStorage,
  TilePackVersionConflictError,
  TilePackVersionTooOldError,
  type GameTilePackRow,
} from "../services/storage/game-tile-packs.storage.js";

const BUILT_IN_DIR = fileURLToPath(new URL("../assets/overworld-tiles/", import.meta.url));
/** Which stored pack each family is drawn with, in app settings. */
const SELECTION_KEY = "gameTilePackSelection";
const LOCAL = "local/";
/** A pack saved from the maker is no larger than a share file can be (an image pack's, the larger). */
const SAVE_BODY_LIMIT = TILE_PACK_IMAGE_FILE_MAX_BYTES + 16_384;
/** A share file sent as text: its JSON escaping can make a byte up to six. */
const IMPORT_BODY_LIMIT = TILE_PACK_IMAGE_FILE_MAX_BYTES * 6 + 16_384;

/** The id a pack is filed by, under `local/`; none when that would be longer than an id can be (cutting
 *  it short could file two packs as one). */
/** Where a saved pack is filed: under `local/` by its own name, whatever namespace it came with
 *  (`board/forest` edited in the maker is filed as `local/forest`), as a pack's id has one at most. */
const localId = (id: string) => {
  const filed = `${LOCAL}${id.slice(id.indexOf("/") + 1)}`;
  return filed.length <= 80 ? filed : null;
};
/** The pack a removal names: an id without a namespace is a library one, as it was filed. */
const removalId = (id: string) => (id.includes("/") ? id : `${LOCAL}${id}`);
const familySchema = z.string().trim().min(1).max(40);

/** A stored row read back as a pack, under the id it is filed by. */
function packOf(row: GameTilePackRow): TilePack | null {
  const read = parseTilePack(row.definition);
  return read.ok ? { ...read.pack, id: row.packId } : null;
}

export async function gameTilePacksRoutes(app: FastifyInstance) {
  const store = createGameTilePacksStorage(app.db);
  const settings = createAppSettingsStorage(app.db);
  const readSelection = async (): Promise<Record<string, string>> => {
    try {
      const value = JSON.parse((await settings.get(SELECTION_KEY)) ?? "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  /** Store a checked pack (a save from the maker, or an imported file) under its local id, as the same
   *  text either way, so the same tiles saved again are recognised whatever way they came. */
  const save = async (reply: FastifyReply, read: TilePack, notes: string[]) => {
    let pack = read;
    if (pack.tilePackVersion === 2) {
      const cleaned = await cleanImageTilePack(pack);
      if (!cleaned.ok) return reply.status(400).send({ error: `The tile pack is not usable: ${cleaned.issue}` });
      pack = cleaned.pack;
    }
    const id = localId(pack.id);
    if (!id) return reply.status(400).send({ error: "The tile pack's id is too long." });
    const filed = { ...pack, id };
    try {
      const { status, row } = await store.put(filed, JSON.stringify(filed));
      logger.info("[game/tile-packs] %s version %d: %s", row.packId, row.version, status);
      return { status, pack: { id: row.packId, version: row.version, name: row.name, family: row.family }, notes };
    } catch (error) {
      if (error instanceof TilePackVersionTooOldError) {
        return reply.status(409).send({ error: error.message, code: "tile_pack_version_too_old" });
      }
      if (error instanceof TilePackVersionConflictError) {
        return reply.status(409).send({ error: error.message, code: "tile_pack_version_conflict" });
      }
      throw error;
    }
  };

  // ── GET /api/game-tile-packs ── the stored packs, the families with built-in packs, and the choices.
  app.get("/", { config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } }, async () => ({
    packs: (await store.latest()).map((row) => ({
      id: row.packId,
      name: row.name,
      family: row.family,
      version: row.version,
      // Image packs (version 2) are told apart without reading their sheets: the definition is written
      // with its version first.
      tilePackVersion: row.definition.startsWith('{"tilePackVersion":2') ? 2 : 1,
    })),
    builtIn: [...WORLD_ART_FAMILIES],
    selection: await readSelection(),
  }));

  // ── GET /api/game-tile-packs/builtin/:family ──
  app.get<{ Params: { family: string } }>(
    "/builtin/:family",
    { config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } },
    async (req, reply) => {
      const family = req.params.family;
      if (!(WORLD_ART_FAMILIES as readonly string[]).includes(family)) {
        return reply.status(404).send({ error: "No built-in tile pack for that family." });
      }
      const read = parseTilePack(await readFile(`${BUILT_IN_DIR}${family}.json`, "utf8"));
      if (!read.ok) {
        logger.error("[game/tile-packs] The built-in %s pack does not read: %s", family, read.issues.join("; "));
        return reply.status(500).send({ error: "The built-in tile pack does not read." });
      }
      return { pack: read.pack };
    },
  );

  // ── GET /api/game-tile-packs/pack?id= ── a stored pack's latest version.
  app.get("/pack", { config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(80) }).parse(req.query);
    const row = await store.latestOf(id);
    const pack = row ? packOf(row) : null;
    if (!pack) return reply.status(404).send({ error: "No such tile pack." });
    return { pack };
  });

  // ── POST /api/game-tile-packs ── a pack saved from the maker.
  app.post(
    "/",
    { bodyLimit: SAVE_BODY_LIMIT, config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Tile pack save" })) return;
      const sent = z.object({ pack: z.record(z.string(), z.unknown()) }).safeParse(req.body);
      if (!sent.success) return reply.status(400).send({ error: "The tile pack is not usable: no pack was sent." });
      const body = sent.data.pack;
      // The body limit is an image pack's; a drawn pack keeps its own, smaller one.
      if (
        (body as { tilePackVersion?: unknown } | null)?.tilePackVersion !== 2 &&
        JSON.stringify(body).length > TILE_PACK_MAX_BYTES
      )
        return reply.status(413).send({ error: "The tile pack is larger than a drawn tile pack can be." });
      const read = parseTilePack(body);
      if (!read.ok)
        return reply.status(400).send({ error: `The tile pack is not usable: ${read.issues.slice(0, 5).join("; ")}` });
      return save(reply, read.pack, read.notes);
    },
  );

  // ── POST /api/game-tile-packs/import ── a share file.
  app.post(
    "/import",
    { bodyLimit: IMPORT_BODY_LIMIT, config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Tile pack import" })) return;
      const read = parseTilePack(z.object({ definition: z.string().min(1) }).parse(req.body).definition);
      if (!read.ok)
        return reply.status(400).send({ error: `The tile pack is not usable: ${read.issues.slice(0, 5).join("; ")}` });
      return save(reply, read.pack, read.notes);
    },
  );

  // ── DELETE /api/game-tile-packs?id= ── every version, and any family it was chosen for goes back to
  // the built-in pack.
  app.delete("/", { config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Tile pack removal" })) return;
    const { id } = z.object({ id: z.string().min(1).max(80) }).parse(req.query);
    const removed = await store.removeAll(removalId(id));
    if (!removed) return reply.status(404).send({ error: "No such tile pack." });
    const selection = await readSelection();
    const kept = Object.fromEntries(Object.entries(selection).filter(([, packId]) => packId !== removalId(id)));
    if (Object.keys(kept).length !== Object.keys(selection).length)
      await settings.set(SELECTION_KEY, JSON.stringify(kept));
    return { removed };
  });

  // ── PUT /api/game-tile-packs/selection ── the pack a family is drawn with; none for the built-in one.
  app.put("/selection", { config: { rateLimit: GAME_TILE_PACKS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Tile pack selection" })) return;
    const { family, packId } = z
      .object({ family: familySchema, packId: z.string().min(1).max(80).nullable() })
      .parse(req.body);
    if (packId) {
      const row = await store.latestOf(packId);
      if (!row) return reply.status(404).send({ error: "No such tile pack." });
      // Only for its own family, so the choices never name more families than the stored packs do.
      if (row.family !== family) return reply.status(400).send({ error: "That tile pack is for another setting." });
    }
    const selection = await readSelection();
    if (packId) selection[family] = packId;
    else delete selection[family];
    await settings.set(SELECTION_KEY, JSON.stringify(selection));
    return { selection };
  });
}
