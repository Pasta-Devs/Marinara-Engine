// ──────────────────────────────────────────────
// Routes: the library of worlds (worldgen W9f)
//
// Worlds made outside any game: from a kit and a seed, or a world file, edited by hand and given a
// story in a maker, then picked in a new game's setup (which takes a copy) and shipped in map packs.
// Each world has the same editor routes a game's world has (world/edit, world/edits, world/people,
// world/file, story), so a maker edits either the same way. Writing to the library is an
// administrative act behind `requirePrivilegedAccess`, as the tile-pack library's is.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_SHARE_FILE_MAX_BYTES,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  gameWorldFromSnapshot,
  worldMadeByThisGenerator,
  worldSnapshot,
  readWorldFile,
  worldEditIssues,
  worldTownEditIssues,
  worldEditsEmpty,
  worldEditsVersioned,
  worldEditsSchema,
  worldFile,
  worldKitArtFamily,
  WORLD_GROUNDINGS,
  type GameWorld,
  type StoryScript,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { GAME_WORLDS_RATE_LIMIT } from "../middleware/rate-limit.js";
import {
  editsStoryRefusal,
  storyNamesOf,
  worldForEditor,
  worldPeopleOf,
  worldTownForEditor,
  worldInteriorForEditor,
} from "../services/game/world-editor.service.js";
import { createGameWorldsStorage, type GameWorldRow } from "../services/storage/game-worlds.storage.js";

const nameSchema = z.string().trim().min(1).max(120);

/** A library world as kept: its world (hand edits applied), story and name, read from its snapshot when
 *  another generator made it (W11); null when its file no longer reads. */
function readRow(row: GameWorldRow): { game: GameWorld; story: StoryScript | null } | null {
  const read = readWorldFile(row.file);
  if (!read.ok) return null;
  if (read.snapshot) return { game: gameWorldFromSnapshot(read.snapshot), story: read.story ?? null };
  const inputs = {
    kit: read.kit,
    seed: read.world.seed,
    grounding: read.world.grounding,
    brief: read.world.brief,
    generatorVersion: read.world.generatorVersion,
    ...(read.world.edits ? { edits: read.world.edits } : {}),
  };
  return { game: { ...inputs, world: compileGameWorld(inputs) }, story: read.story ?? null };
}

/** A world as its share file's text, with its snapshot (W11). */
function fileOf(name: string, game: GameWorld | Omit<GameWorld, "world">, story: StoryScript | null): string {
  const full: GameWorld = "world" in game ? game : { ...game, world: compileGameWorld(game) };
  return JSON.stringify(
    worldFile(
      name,
      full.kit,
      {
        seed: full.seed,
        generatorVersion: full.frozen?.generatorVersion ?? full.generatorVersion ?? WORLD_GENERATOR_VERSION,
        grounding: full.grounding,
        brief: full.brief,
        ...(full.edits && !worldEditsEmpty(full.edits) ? { edits: full.edits } : {}),
      },
      story,
      worldSnapshot(full),
    ),
  );
}

/** A library world's new file, or why it cannot be kept: one larger than a share file can be would no
 *  longer read, and the world would be lost. */
function kept(name: string, game: GameWorld | Omit<GameWorld, "world">, story: StoryScript | null) {
  const file = fileOf(name, game, story);
  return Buffer.byteLength(file) > WORLD_SHARE_FILE_MAX_BYTES
    ? { refused: "This world would be larger than a world file can be, so it was not saved." }
    : { name, file };
}

/** Why a library world from an earlier generator cannot be edited (W11). */
const OLD_GENERATOR_REFUSAL =
  "This world was made by an earlier version of the world generator. It plays on as it was made, but it can no longer be edited.";

export async function gameWorldsRoutes(app: FastifyInstance) {
  const store = createGameWorldsStorage(app.db);
  const summary = (row: GameWorldRow) => {
    const read = readRow(row);
    return {
      id: row.id,
      name: row.name,
      kit: read?.game.kit.label ?? null,
      family: read ? (worldKitArtFamily(read.game.kit) ?? null) : null,
      seed: read?.game.seed ?? null,
      edited: Boolean(read && !worldEditsEmpty(read.game.edits)),
      story: Boolean(read?.story),
      reads: Boolean(read),
      updatedAt: row.updatedAt,
    };
  };
  /** The world by id, read; a 404 sent when there is none (or it no longer reads). */
  const worldOr404 = async (id: string, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    const row = await store.get(id);
    const read = row ? readRow(row) : null;
    if (!row || !read) {
      reply.status(404).send({ error: row ? "This world no longer reads." : "No such world." });
      return null;
    }
    return { row, ...read };
  };

  // ── GET /api/game-worlds ── the library.
  app.get("/", { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } }, async () => ({
    worlds: (await store.list()).map(summary),
  }));

  // ── POST /api/game-worlds {name, kit, seed?, grounding?} ── a world of the kit alone, its summary as the
  // premise, as a new game makes one with no brief written.
  app.post("/", { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "World library save" })) return;
    const body = z
      .object({
        name: nameSchema,
        kit: z.unknown().optional(),
        seed: z.number().int().min(0).max(0xffffffff).optional(),
        grounding: z.enum(WORLD_GROUNDINGS).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "A world needs a name and a setting kit." });
    const kit = parseWorldKit(body.data.kit);
    if (!kit.ok)
      return reply.status(400).send({ error: `The kit does not read: ${kit.issues[0]}`, issues: kit.issues });
    const brief = checkWorldBrief(kit.kit, {
      briefVersion: 1,
      premise: kit.kit.summary,
      places: [],
      placeNames: [],
      events: [],
    });
    if (!brief.ok) return reply.status(400).send({ error: `The world does not hold together: ${brief.issues[0]}` });
    const seed = body.data.seed ?? Math.floor(Math.random() * 0xffffffff);
    const row = await store.create(
      body.data.name,
      fileOf(
        body.data.name,
        { kit: kit.kit, seed, grounding: body.data.grounding ?? "expand", brief: brief.brief },
        null,
      ),
    );
    logger.info("[game/worlds] %s: made from the kit %s", row.id, kit.kit.id);
    return { world: summary(row) };
  });

  // ── POST /api/game-worlds/import {text} ── a world file, read as a new game's setup reads one.
  // A share file's own cap, with room for the JSON escaping of its text, as the other imports allow.
  app.post(
    "/import",
    { bodyLimit: WORLD_SHARE_FILE_MAX_BYTES * 6 + 16_384, config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "World library import" })) return;
      const text = z.object({ text: z.string() }).safeParse(req.body);
      if (!text.success) return reply.status(400).send({ error: "Send the world file's text." });
      const read = readWorldFile(text.data.text);
      if (!read.ok)
        return reply
          .status(400)
          .send({ error: `The world file does not read: ${read.issues[0]}`, issues: read.issues });
      // Another generator's world is kept as its snapshot has it (W11), never made again from the recipe.
      const game = read.snapshot ? gameWorldFromSnapshot(read.snapshot) : { kit: read.kit, ...read.world };
      const file = kept(read.name, game, read.story ?? null);
      if ("refused" in file) return reply.status(400).send({ error: file.refused });
      const row = await store.create(read.name, file.file);
      logger.info("[game/worlds] %s: imported", row.id);
      return { world: summary(row), notes: read.notes };
    },
  );

  // ── PUT /api/game-worlds/:id {name} ──
  app.put<{ Params: { id: string } }>("/:id", { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "World library rename" })) return;
    const name = nameSchema.safeParse((req.body as { name?: unknown } | undefined)?.name);
    if (!name.success) return reply.status(400).send({ error: "A world needs a name." });
    const updated = await store.update(req.params.id, (row) => {
      const read = readRow(row);
      if (!read) return { refused: "This world no longer reads." };
      return kept(name.data, read.game, read.story);
    });
    if (!updated) return reply.status(404).send({ error: "No such world." });
    if ("refused" in updated) return reply.status(409).send({ error: updated.refused });
    return { world: summary(updated.row) };
  });

  // ── DELETE /api/game-worlds/:id ── games made from it keep their own copy.
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "World library removal" })) return;
      if (!(await store.remove(req.params.id))) return reply.status(404).send({ error: "No such world." });
      logger.info("[game/worlds] %s: removed", req.params.id);
      return { removed: true };
    },
  );

  // ── The editor's routes, as a game's world has them ──

  app.get<{ Params: { id: string } }>(
    "/:id/world/file",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const world = await worldOr404(req.params.id, reply);
      // The world as this Engine reads it (what its editor shows), not merely the text kept.
      return world ? JSON.parse(fileOf(world.row.name, world.game, world.story)) : undefined;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/world/edit",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const world = await worldOr404(req.params.id, reply);
      if (!world) return;
      if (!worldMadeByThisGenerator(world.game)) return reply.status(409).send({ error: OLD_GENERATOR_REFUSAL });
      return { world: worldForEditor(world.game), edits: world.game.edits ?? null, links: world.game.world.links };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/world/town",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const { settlement } = z.object({ settlement: z.string().min(1).max(16) }).parse(req.query);
      const world = await worldOr404(req.params.id, reply);
      if (!world) return;
      if (!worldMadeByThisGenerator(world.game)) return reply.status(409).send({ error: OLD_GENERATOR_REFUSAL });
      const found = worldTownForEditor(world.game, settlement);
      return found ?? reply.status(404).send({ error: "No such settlement in this world." });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/world/interior",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const { settlement, building } = z
        .object({ settlement: z.string().min(1).max(16), building: z.string().min(1).max(16) })
        .parse(req.query);
      const world = await worldOr404(req.params.id, reply);
      if (!world) return;
      if (!worldMadeByThisGenerator(world.game)) return reply.status(409).send({ error: OLD_GENERATOR_REFUSAL });
      const found = worldInteriorForEditor(world.game, settlement, building);
      return found ?? reply.status(404).send({ error: "No building with rooms there." });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/world/people",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const { place } = z.object({ place: z.string().min(1).max(16) }).parse(req.query);
      const world = await worldOr404(req.params.id, reply);
      return world ? { people: worldPeopleOf(world.game, place) } : undefined;
    },
  );

  // PUT /:id/world/edits: the whole edit layer, checked against the world (and its story) as it is when
  // written; an empty one clears it.
  app.put<{ Params: { id: string } }>(
    "/:id/world/edits",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "World library edit" })) return;
      const parsed = worldEditsSchema.safeParse((req.body as { edits?: unknown } | undefined)?.edits);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return reply.status(400).send({ error: `The edits do not read: ${issue?.path.join(".")}: ${issue?.message}` });
      }
      const edits = worldEditsEmpty(parsed.data) ? undefined : worldEditsVersioned(parsed.data);
      const updated = await store.update(req.params.id, (row) => {
        const read = readRow(row);
        if (!read) return { refused: "This world no longer reads." };
        if (!worldMadeByThisGenerator(read.game)) return { refused: OLD_GENERATOR_REFUSAL };
        const worldIssues = edits ? worldEditIssues(read.game, edits) : [];
        const issues = worldIssues.length || !edits ? worldIssues : worldTownEditIssues(read.game, edits);
        if (issues.length) return { refused: issues.join(" "), issues };
        const storyRefusal = editsStoryRefusal(read.game, edits, read.story);
        if (storyRefusal) return { refused: storyRefusal.error, issues: storyRefusal.issues };
        const { edits: _old, world: _compiled, frozen: _frozen, compiled: _preEdit, ...inputs } = read.game;
        return kept(row.name, { ...inputs, ...(edits ? { edits } : {}) }, read.story);
      });
      if (!updated) return reply.status(404).send({ error: "No such world." });
      if ("refused" in updated) return reply.status(400).send({ error: updated.refused, issues: updated.issues ?? [] });
      const game = readRow(updated.row)?.game;
      if (!game) return reply.status(409).send({ error: "This world no longer reads." });
      return { edits: game.edits ?? null, links: game.world.links };
    },
  );

  // ── Its story (worldgen W10): read, saved (checked against the world as it is when written), taken
  // away. A library world is not played, so it has no state yet. ──

  app.get<{ Params: { id: string } }>(
    "/:id/story",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      const world = await worldOr404(req.params.id, reply);
      if (!world) return;
      return { story: world.story, state: null, names: storyNamesOf(world.game) };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/:id/story",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "World library story" })) return;
      const input = (req.body as { story?: unknown } | undefined)?.story;
      const updated = await store.update(req.params.id, (row) => {
        const read = readRow(row);
        if (!read) return { refused: "This world no longer reads." };
        const checked = checkStoryScript(read.game, input);
        if (!checked.ok)
          return { refused: `The story does not fit this world: ${checked.issues[0]}`, issues: checked.issues };
        return kept(row.name, read.game, checked.story);
      });
      if (!updated) return reply.status(404).send({ error: "No such world." });
      if ("refused" in updated) return reply.status(400).send({ error: updated.refused, issues: updated.issues ?? [] });
      return { story: readRow(updated.row)?.story ?? null };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id/story",
    { config: { rateLimit: GAME_WORLDS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "World library story" })) return;
      const updated = await store.update(req.params.id, (row) => {
        const read = readRow(row);
        if (!read) return { refused: "This world no longer reads." };
        return kept(row.name, read.game, null);
      });
      if (!updated) return reply.status(404).send({ error: "No such world." });
      if ("refused" in updated) return reply.status(409).send({ error: updated.refused });
      return { story: null };
    },
  );
}
