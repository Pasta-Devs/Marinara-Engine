// ──────────────────────────────────────────────
// Routes: board packs (fight-board art slots, Capability API 1.333)
//
// The art fights' boards are drawn with, made in Pixelforge or imported from a file, filed under
// `local/<id>` as creature packs are. A board reads the pack it names, else the library's pack for its
// environment, else the Engine's built-in `board/<environment>` (shipped in src/assets/board-packs, when
// there is one), else none and today's drawing; its props also read the library's props pack, else the
// built-in `board/props`. Icons (1.338) and portraits (1.338) are packs of their own kind, read the same
// way: the library's `icons` or `portraits` pack, else the built-in one. Saving, importing and removing are administrative acts behind
// `requirePrivilegedAccess`.
// ──────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  ART_PACK_KINDS,
  BOARD_PACK_MAX_BYTES,
  BOARD_PROPS_PACK_ID,
  TACTICAL_ENVIRONMENTS,
  boardBuiltInPackId,
  parseBoardPack,
  type BoardPack,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import {
  BoardPackVersionConflictError,
  createGameBoardPacksStorage,
  type GameBoardPackRow,
} from "../services/storage/game-board-packs.storage.js";

const BUILT_IN_DIR = fileURLToPath(new URL("../assets/board-packs/", import.meta.url));
const LOCAL = "local/";
/** A pack saved from the maker is no larger than a share file can be. */
const SAVE_BODY_LIMIT = BOARD_PACK_MAX_BYTES + 16_384;
/** A share file sent as text. */
const IMPORT_BODY_LIMIT = BOARD_PACK_MAX_BYTES * 2 + 16_384;

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
function packOf(row: GameBoardPackRow): BoardPack | null {
  const read = parseBoardPack(row.definition);
  return read.ok ? { ...read.pack, id: row.packId } : null;
}

/** The Engine's own pack for an environment (`forest`) or for props (`props`), when one is shipped. */
async function builtIn(name: string): Promise<BoardPack | null> {
  if (![...TACTICAL_ENVIRONMENTS, "props", ...ART_PACK_KINDS].includes(name)) return null;
  let text: string;
  try {
    text = await readFile(`${BUILT_IN_DIR}${name}.json`, "utf8");
  } catch {
    return null;
  }
  const read = parseBoardPack(text);
  if (!read.ok) {
    logger.error("[game/board-packs] The built-in %s pack does not read: %s", name, read.issues.join("; "));
    return null;
  }
  return read.pack;
}

export async function gameBoardPacksRoutes(app: FastifyInstance) {
  const store = createGameBoardPacksStorage(app.db);

  /** A pack by id: the library's, or a built-in one named `board/<name>`. */
  const byId = async (id: string): Promise<BoardPack | null> => {
    const row = await store.latestOf(id);
    if (row) return packOf(row);
    return id.startsWith("board/") ? builtIn(id.slice("board/".length)) : null;
  };
  /** Stored packs as read, by row, so /for and /art do not read every pack again on each call. A pack
   *  removed and saved again may come back under the same row id, so its hash is checked too. */
  const read = new Map<string, { sha256: string; pack: BoardPack | null }>();
  const cachedPackOf = (row: GameBoardPackRow) => {
    const known = read.get(row.id);
    if (known && known.sha256 === row.sha256) return known.pack;
    const pack = packOf(row);
    read.set(row.id, { sha256: row.sha256, pack });
    return pack;
  };
  /** The library's pack for an environment (or props), the first by name, else the built-in one. */
  const forEnvironment = async (environment: string): Promise<BoardPack | null> => {
    const rows = await store.latest();
    // Drop what a removed or replaced version left behind.
    const live = new Set(rows.map((row) => row.id));
    for (const id of read.keys()) if (!live.has(id)) read.delete(id);
    for (const row of rows) {
      const pack = cachedPackOf(row);
      if (pack?.environment === environment) return pack;
    }
    return byId(environment === "props" ? BOARD_PROPS_PACK_ID : boardBuiltInPackId(environment));
  };

  const save = async (reply: FastifyReply, pack: BoardPack, notes: string[]) => {
    const id = localId(pack.id);
    if (!id) return reply.status(400).send({ error: "The board pack's id is too long." });
    const filed = { ...pack, id };
    try {
      const { status, row } = await store.put(filed, JSON.stringify(filed));
      logger.info("[game/board-packs] %s version %d: %s", row.packId, row.version, status);
      return { status, pack: { id: row.packId, version: row.version, name: row.name, tiles: row.tiles }, notes };
    } catch (error) {
      if (error instanceof BoardPackVersionConflictError) {
        return reply.status(409).send({ error: error.message, code: "board_pack_version_conflict" });
      }
      throw error;
    }
  };
  const refuse = (reply: FastifyReply, issues: string[]) =>
    reply.status(400).send({ error: `The board pack is not usable: ${issues.slice(0, 5).join("; ")}` });

  // ── GET /api/game-tile-packs/boards/for?pack=&environment= ── what a board is drawn with: its pack
  // (the one it names, else its environment's), and the props pack; either may be none.
  app.get("/for", async (req) => {
    const { pack, environment } = z
      .object({ pack: packIdSchema.optional(), environment: z.string().max(40).optional() })
      .parse(req.query);
    const named = pack ? await byId(pack) : null;
    const board =
      named ??
      (environment && (TACTICAL_ENVIRONMENTS as readonly string[]).includes(environment)
        ? await forEnvironment(environment)
        : null);
    const props = board?.environment === "props" ? board : await forEnvironment("props");
    return { board, props };
  });

  // ── GET /api/game-tile-packs/boards/art?kind=icons|portraits ── the game's icons (1.338) or portraits
  // (1.338): the library's pack of that kind, else the built-in `board/<kind>`; none draws as today.
  app.get("/art", async (req) => {
    const { kind } = z.object({ kind: z.enum(ART_PACK_KINDS) }).parse(req.query);
    return { pack: await forEnvironment(kind) };
  });

  // ── GET /api/game-tile-packs/boards/library ── the stored packs.
  app.get("/library", async () => ({
    packs: (await store.latest()).map((row) => ({
      id: row.packId,
      name: row.name,
      version: row.version,
      tiles: row.tiles,
    })),
  }));

  // ── GET /api/game-tile-packs/boards/pack?id= ── a stored pack's latest version, or a built-in one.
  app.get("/pack", async (req, reply) => {
    const { id } = z.object({ id: packIdSchema }).parse(req.query);
    const pack = await byId(id);
    if (!pack) return reply.status(404).send({ error: "No such board pack." });
    return { pack };
  });

  // ── POST /api/game-tile-packs/boards ── a pack saved from the maker.
  app.post("/", { bodyLimit: SAVE_BODY_LIMIT }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Board pack save" })) return;
    const read = parseBoardPack(z.object({ pack: z.unknown().optional() }).parse(req.body).pack);
    return read.ok ? save(reply, read.pack, read.notes) : refuse(reply, read.issues);
  });

  // ── POST /api/game-tile-packs/boards/import ── a share file.
  app.post("/import", { bodyLimit: IMPORT_BODY_LIMIT }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Board pack import" })) return;
    const read = parseBoardPack(z.object({ definition: z.string().min(1) }).parse(req.body).definition);
    return read.ok ? save(reply, read.pack, read.notes) : refuse(reply, read.issues);
  });

  // ── DELETE /api/game-tile-packs/boards?id= ── every version.
  app.delete("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Board pack removal" })) return;
    const { id } = z.object({ id: packIdSchema }).parse(req.query);
    const removed = await store.removeAll(removalId(id));
    if (!removed) return reply.status(404).send({ error: "No such board pack." });
    return { removed };
  });
}
