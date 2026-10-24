/**
 * A game moved onto a newer stored version of its imported ruleset (POST
 * /api/game-rulesets/game-version, the Journal's "Update this game"). An imported ruleset keeps
 * every version it was imported at and a game reads the one it was created on, so an old save kept
 * its old rules after an update (laptop playtest 2026-10-24: a game on 0.398 of a ruleset at 0.423).
 *
 *   - The pin moves to the version asked for, its options kept, and the game resolves to it.
 *   - Only forward, only to a stored version, only for a game with a pin.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "marinara-game-ruleset-version-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRulesetsRoutes } = await import("../../packages/server/src/routes/game-rulesets.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameRulesetsStorage } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { loadRulesetRegistry, resolveGameRuleset } =
  await import("../../packages/server/src/services/game/ruleset-registry.service.js");

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
try {
  const ember = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
  ) as Record<string, any>;
  const rulesets = createGameRulesetsStorage(db);
  for (const version of [1, 2, 3]) {
    await rulesets.put({
      rulesetId: "local/ember-roads",
      version,
      sourceKind: "local",
      definition: JSON.stringify({ ...ember, version, name: `Ember Roads ${version}` }),
    });
  }
  const pinOf = async (chatId: string) => {
    const row = await chats.getById(chatId);
    return (typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata) as Record<string, any>;
  };
  const game = async (mode: "game" | "roleplay" = "game", pinned = true) => {
    const made = await chats.create({
      name: "Old save",
      mode,
      characterIds: [],
      connectionId: null,
      promptPresetId: null,
    });
    assert.ok(made);
    if (pinned) {
      await chats.patchMetadata(made.id, {
        gameRuleset: { id: "local/ember-roads", version: 1, packageId: null, options: { kept: true } },
      });
    }
    return made.id;
  };
  const move = (chatId: string, version: number) =>
    app.inject({ method: "POST", url: "/api/game-rulesets/game-version", payload: { chatId, version } });

  const old = await game();
  const moved = await move(old, 3);
  assert.equal(moved.statusCode, 200, moved.body);
  assert.deepEqual(JSON.parse(moved.body), { version: 3 });
  const meta = await pinOf(old);
  assert.equal(meta.gameRuleset.version, 3);
  assert.deepEqual(meta.gameRuleset.options, { kept: true }, "the game's options stay");
  const resolved = resolveGameRuleset(meta, await loadRulesetRegistry(db));
  assert.equal(resolved.status, "ok");
  assert.equal(resolved.status === "ok" && resolved.definition.name, "Ember Roads 3");

  // Never back, nor to where it already is.
  assert.equal((await move(old, 2)).statusCode, 409);
  assert.equal((await move(old, 3)).statusCode, 409);
  assert.equal((await pinOf(old)).gameRuleset.version, 3);
  // Only to a version that is stored.
  assert.equal((await move(await game(), 7)).statusCode, 409);
  // Only a game, and only one with a pin.
  assert.equal((await move(await game("roleplay"), 3)).statusCode, 409);
  assert.equal((await move(await game("game", false), 3)).statusCode, 409);
  assert.equal((await move("no-such-chat", 3)).statusCode, 404);
  assert.equal((await move(old, 0)).statusCode, 400);

  console.log("game-ruleset-game-version: ok");
} finally {
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
