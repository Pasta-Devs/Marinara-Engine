/**
 * Creature art in fights (design-game-creature-art.md):
 *
 *   - A creature pack reads as agreed with Pixelforge (a draft of its schema), and refuses what is not one.
 *   - A fighter's art is the pack's creature whose `match` names its bestiary entry (`catalog/entry`, or
 *     `ruleset/catalog/entry` in that ruleset only), else its name with case, punctuation and a trailing
 *     number set aside, else none; the pack's order breaks a tie.
 *   - A fighter wears the same look every time, two fighters can differ; it faces the way it moved; its
 *     frame is cut from its block by facing and step, and drawn at its own size, standing on its cell.
 *   - A ruleset opponent made from a bestiary entry keeps the entry (and one made from a block has none),
 *     and the screen's view of it carries it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createRulesetEncounter,
  creatureArtBox,
  creatureArtFrame,
  creatureArtVariant,
  creatureFacingToward,
  creaturePackSchema,
  findCreatureArt,
  parseRulesetDefinition,
  rulesetCombatant,
  type CreaturePack,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const creature = (id: string, match: string[], extra: Record<string, unknown> = {}) => ({
  id,
  match,
  size: "medium",
  w: 1,
  h: 2,
  frames: 1,
  variants: [{ sheet: "s1", x: 0, y: 0 }],
  ...extra,
});
const pack = creaturePackSchema.parse({
  creaturePackVersion: 1,
  id: "monsters",
  name: "Monsters",
  version: 1,
  tileSize: 48,
  sheets: [{ id: "s1", png: PNG, width: 960, height: 960 }],
  creatures: [
    creature("goblin", ["5e-2014/creatures/goblin", "goblin"], {
      variants: [
        { sheet: "s1", x: 0, y: 0 },
        { sheet: "s1", x: 1, y: 0 },
        { sheet: "s1", x: 2, y: 0 },
      ],
    }),
    creature("rats", ["night/grave-rats", "swarm of rats"], { size: "small", w: 1, h: 1 }),
    creature("dragon", ["red dragon"], {
      size: "huge",
      w: 3,
      h: 3,
      frames: 3,
      variants: [{ sheet: "s1", x: 4, y: 0 }],
    }),
    creature("goblin-two", ["goblin"]),
  ],
}) as CreaturePack;

// ── The pack ──
assert.equal(creaturePackSchema.safeParse({ ...pack, creaturePackVersion: 3 }).success, false, "another version");
assert.equal(
  creaturePackSchema.safeParse({ ...pack, creatures: [{ ...pack.creatures[0], frames: 2 }] }).success,
  false,
  "still or walking, nothing else",
);
assert.equal(
  creaturePackSchema.safeParse({ ...pack, creatures: [{ ...pack.creatures[0], w: 7 }] }).success,
  false,
  "six cells at most",
);
assert.equal(
  creaturePackSchema.safeParse({ ...pack, sheets: [{ ...pack.sheets[0], png: "https://example.com/a.png" }] }).success,
  false,
  "art is a PNG in the pack, never fetched",
);
assert.equal(
  creaturePackSchema.safeParse({
    ...pack,
    sheets: [{ ...pack.sheets[0], png: "data:image/png;base64,AAAA),url(https://evil.example/x.gif" }],
  }).success,
  false,
  "nothing after the picture's own base64",
);

// ── Which creature a fighter is ──
const art = (who: Parameters<typeof findCreatureArt>[1]) => findCreatureArt(pack, who)?.id ?? null;
assert.equal(art({ name: "Goblin" }), "goblin", "by name");
assert.equal(art({ name: "Goblin 2" }), "goblin", "a trailing number is not the name");
assert.equal(art({ name: "GOBLIN #3" }), "goblin");
assert.equal(art({ name: "Hobgoblin" }), null, "a name is matched whole");
assert.equal(art({ name: "Swarm-of-Rats" }), "rats", "case and punctuation set aside");
assert.equal(
  art({ creature: { catalogId: "night", entryId: "grave-rats" }, name: "Rats" }),
  "rats",
  "by its bestiary entry first",
);
assert.equal(
  art({ creature: { catalogId: "creatures", entryId: "goblin" }, rulesetId: "5e-2014", name: "Skulker" }),
  "goblin",
  "a ref naming its ruleset, in that ruleset",
);
assert.equal(
  art({ creature: { catalogId: "creatures", entryId: "goblin" }, rulesetId: "someone:5e-2014", name: "Skulker" }),
  "goblin",
  "or that ruleset under a community namespace",
);
assert.equal(
  art({ creature: { catalogId: "creatures", entryId: "goblin" }, rulesetId: "gravewatch", name: "Skulker" }),
  null,
  "never in another ruleset",
);
assert.equal(
  art({ creature: { catalogId: "creatures", entryId: "kobold" }, rulesetId: "5e-2014", name: "Goblin" }),
  "goblin",
  "else by its name",
);
assert.equal(findCreatureArt(null, { name: "Goblin" }), null, "no pack, no art");

// ── Its look, its facing, its frame and its box ──
const goblin = pack.creatures[0]!;
const looks = Array.from({ length: 12 }, (_, index) => creatureArtVariant(goblin, "fight-1", `enemy-${index}`));
assert.ok(looks.every((look) => look >= 0 && look < 3));
assert.ok(new Set(looks).size > 1, "fighters differ");
assert.equal(creatureArtVariant(goblin, "fight-1", "enemy-4"), looks[4], "the same look every time");
assert.equal(creatureFacingToward(1, 0, "down"), "right");
assert.equal(creatureFacingToward(-2, 1, "down"), "left", "the greater way");
assert.equal(creatureFacingToward(0, -3, "down"), "up");
assert.equal(creatureFacingToward(1, 1, "up"), "right", "a tie faces side-on");
assert.equal(creatureFacingToward(0, 0, "left"), "left", "no move, no turn");
assert.deepEqual(creatureArtFrame(pack, goblin, 1, "right"), { sheet: "s1", sx: 48, sy: 192, sw: 48, sh: 96 });
const dragon = pack.creatures[2]!;
assert.deepEqual(creatureArtFrame(pack, dragon, 0, "up"), {
  sheet: "s1",
  sx: 4 * 48 + 144,
  sy: 3 * 144,
  sw: 144,
  sh: 144,
});
assert.deepEqual(creatureArtFrame(pack, dragon, 0, "up", 2), {
  sheet: "s1",
  sx: 4 * 48 + 288,
  sy: 3 * 144,
  sw: 144,
  sh: 144,
});
assert.deepEqual(
  creatureArtBox(goblin),
  { left: 0, top: -1, width: 1, height: 2 },
  "a Medium creature stands a cell tall",
);
assert.deepEqual(creatureArtBox(dragon), { left: -1, top: -2, width: 3, height: 3 }, "a Huge one over its neighbours");

// ── A ruleset opponent keeps its bestiary entry ──
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const parsed = parseRulesetDefinition(JSON.parse(read("../../docs/examples/rulesets/gravewatch.json")));
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const gravewatch: RulesetDefinition = parsed.definition;
const catalogs = Object.fromEntries((gravewatch.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
const state = createRulesetEncounter({
  definition: gravewatch,
  seed: 3,
  combatants: [
    { id: "rats", name: "Rats", side: "enemy", creature: { catalogId: "night", entryId: "grave-rats" } },
    {
      id: "thing",
      name: "Thing",
      side: "enemy",
      block: { health: 5, defense: 1, initiativeModifier: 0, actions: [] },
    } as never,
  ],
  bestiary: catalogs,
  roller: () => 5,
});
assert.deepEqual(rulesetCombatant(state, "rats")?.creature, { catalogId: "night", entryId: "grave-rats" });
assert.ok(rulesetCombatant(state, "thing"), "the block's opponent is in the fight");
assert.equal(rulesetCombatant(state, "thing")!.creature, undefined, "a block has no bestiary entry");

// One described in the ruleset's own terms (a sheet) keeps it too.
const fiveE = parseRulesetDefinition(JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json")));
assert.ok(fiveE.ok, fiveE.ok ? "" : fiveE.issues.join("; "));
const fiveCatalogs = Object.fromEntries(
  (fiveE.definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
);
const sergeantFight = createRulesetEncounter({
  definition: fiveE.definition,
  seed: 3,
  combatants: [
    {
      id: "sergeant",
      name: "Toll Sergeant",
      side: "enemy",
      creature: { catalogId: "creatures", entryId: "toll-sergeant" },
    },
  ],
  bestiary: fiveCatalogs,
  roller: () => 5,
});
assert.ok(rulesetCombatant(sergeantFight, "sergeant")?.block?.sheet, "a sheet creature");
assert.deepEqual(rulesetCombatant(sergeantFight, "sergeant")?.creature, {
  catalogId: "creatures",
  entryId: "toll-sergeant",
});

console.log("Creature art: the pack, matching by bestiary entry and name, looks, facings, frames, and the entry kept.");
