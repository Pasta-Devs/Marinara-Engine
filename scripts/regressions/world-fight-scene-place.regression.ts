/**
 * A fight's board follows the place the Game Master described (cheap-GM playtest 2026-10-26: an iron
 * arena and an underground cistern were fought on Plains boards).
 *
 *   - A scene word that is no scene is read for the place it names, then for the description.
 *   - Plains said of a place under a roof or underground is that place; plains said of open ground, and
 *     every other engine scene, stay as named.
 *   - A setting's own scene is kept as the setting says it.
 *   - The encounter route lays the board out by it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  WORLD_DEFAULT_BATTLEFIELDS,
  WORLD_STARTER_KITS,
  parseWorldKit,
  worldBattlefields,
  worldSceneForPlace,
  worldSceneLike,
} from "../../packages/shared/src/index.js";

const engine = WORLD_DEFAULT_BATTLEFIELDS;
const laidOut = (word: string, description: string) =>
  worldSceneLike(engine, worldSceneForPlace(engine, word, description));

// ── The playtest's two places ──
assert.equal(laidOut("plains", "A ring of iron plates, the Iron Arena, under a soot-black dome."), "castle");
assert.equal(laidOut("plains", "An underground cistern, knee-deep water between brick pillars."), "dungeon");
assert.equal(laidOut("arena", "The pit is ringed with iron bars."), "castle");
assert.equal(laidOut("cistern", ""), "dungeon");
assert.equal(laidOut("", "A flooded cistern far below the city."), "dungeon");
assert.equal(laidOut("Tavern", ""), "mansion");
assert.equal(laidOut("grotto", ""), "cave");

// ── Open ground and every other engine scene stay as named ──
assert.equal(laidOut("plains", "Rolling grassland under a wide sky."), "plains");
assert.equal(laidOut("plains", "The open field below the castle walls."), "plains");
assert.equal(laidOut("forest", "Old temple stones among the trees."), "forest");
assert.equal(laidOut("dungeon", "A great hall of the crypt."), "dungeon");
assert.equal(worldSceneForPlace(engine, "somewhere", "A foggy nowhere."), "somewhere", "nothing to read");
assert.equal(worldSceneForPlace(engine, "", ""), undefined);

// ── A setting's own scene is the setting's ──
const starter = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "cyberpunk"));
assert.ok(starter.ok);
const cyber = worldBattlefields(starter.kit);
assert.equal(worldSceneForPlace(cyber, "Rooftop", "A rooftop above the old cistern."), "Rooftop");
assert.equal(worldSceneLike(cyber, worldSceneForPlace(cyber, "Sewer", "")), "dungeon");

// ── The encounter route lays the board out by it ──
const route = readFileSync(
  fileURLToPath(new URL("../../packages/server/src/routes/encounter.routes.ts", import.meta.url)),
  "utf8",
);
assert.match(route, /worldSceneForPlace\(\s*gameWorldBattlefields\(chatMeta\)/);

console.log("world-fight-scene-place: ok");
