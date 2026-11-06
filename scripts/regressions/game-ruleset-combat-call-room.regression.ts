/**
 * What a call brings is set down where ALL of it fits (cloud AI fights 2026-10-25): eight Draft
 * Horses called by Conjure Animals were set down by one cell each, so a Large horse stood on the
 * Gladiator it was called to fight and on the party beside it.
 *
 *   - Large ones called beside a caller in a crowd stand clear of everybody, and of each other.
 *   - One of a cell still comes to the nearest open cell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCallCreatures,
  rulesetFootprint,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const fiveEText = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const slam = { id: "slam", name: "Slam", budget: "action", toHit: 5, reach: 5, damage: { flat: 3 } };
const creature = (actions: unknown[], size?: string) => ({
  health: 20,
  defense: 12,
  initiativeModifier: 0,
  speed: 30,
  tier: "cr_1",
  ...(size ? { size } : {}),
  actions,
});
const definitionWith = (size: string): RulesetDefinition => {
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  doc.combat.sizes = {
    order: [
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large", cells: 2 },
    ],
    default: "medium",
  };
  doc.catalogs
    .find((catalog: { holds?: string }) => catalog.holds === "creatures")
    .entries.push(
      {
        id: "druid",
        label: "Druid",
        creature: creature([
          slam,
          {
            id: "conjure",
            name: "Conjure Animals",
            budget: "action",
            uses: { per: "day", count: 1 },
            calls: { creature: "creatures/horse", count: { flat: 4 } },
          },
        ]),
      },
      { id: "horse", label: "Draft Horse", creature: creature([slam], size) },
    );
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const roll = (sides: number) => Math.min(sides, 10);
const hero = (id: string) => ({
  id,
  name: id,
  side: "party" as const,
  build: rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 30 },
  }),
  live: {},
});

const calledInto = (definition: RulesetDefinition): RulesetEncounterState => {
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  // The druid in a crowd: a foe right beside it and the party around, single cells open between them.
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    bestiary,
    combatants: [
      { id: "druid", name: "Druid", side: "enemy", creature: { catalogId: "creatures", entryId: "druid" } },
      hero("ada"),
      hero("bo"),
      hero("cy"),
    ],
    board: {
      grid: {
        width: 12,
        height: 8,
        tiles: Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => "plains")),
      },
      placements: { druid: { x: 5, y: 3 }, ada: { x: 6, y: 4 }, bo: { x: 4, y: 2 }, cy: { x: 6, y: 2 } },
    },
  });
  state.order = ["druid", "ada", "bo", "cy"];
  state.turn = 0;
  const taken = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "druid", optionId: "conjure", targetIds: [] },
    roll,
  );
  return taken.state;
};

const overlaps = (state: RulesetEncounterState) => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const one of state.combatants) {
    if (one.defeated) continue;
    for (const cell of rulesetFootprint(one)) {
      const key = `${cell.x},${cell.y}`;
      const other = seen.get(key);
      if (other) clashes.push(`${one.id} on ${other} at ${key}`);
      else seen.set(key, one.id);
    }
  }
  return clashes;
};

// ── Large ones stand clear of everybody, and of each other ──
{
  const state = calledInto(definitionWith("large"));
  const horses = state.combatants.filter((one) => one.calledBy === "druid");
  assert.equal(horses.length, 4, "all four came");
  for (const horse of horses) assert.equal(horse.span, 2, `${horse.id} fills its size`);
  assert.deepEqual(overlaps(state), [], "nobody stands on anybody");
}

// ── One of a cell, as ever, at the nearest open cells ──
{
  const state = calledInto(definitionWith("medium"));
  const horses = state.combatants.filter((one) => one.calledBy === "druid");
  assert.equal(horses.length, 4);
  assert.deepEqual(overlaps(state), []);
  for (const horse of horses) {
    assert.ok(Math.max(Math.abs(horse.x! - 5), Math.abs(horse.y! - 3)) <= 1, `${horse.id} beside the druid`);
  }
}

// ── Only in its area: every one where all of it fits inside (Ruleset 0.435 proof
//    2026-10-25: of Giant Insect's three Large spiders, only two came) ──
{
  const definition = definitionWith("large");
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    bestiary,
    combatants: [
      { id: "druid", name: "Druid", side: "enemy", creature: { catalogId: "creatures", entryId: "druid" } },
      hero("ogre"),
    ],
    board: {
      grid: {
        width: 30,
        height: 14,
        tiles: Array.from({ length: 14 }, () => Array.from({ length: 30 }, () => "plains")),
      },
      placements: { druid: { x: 6, y: 6 }, ogre: { x: 25, y: 12 } },
    },
  });
  const druid = state.combatants.find((one) => one.id === "druid")!;
  const conjure = druid.actions.find((action) => action.id === "conjure")!;
  const area = Array.from({ length: 14 }, (_, y) => Array.from({ length: 30 }, (_, x) => ({ x, y })))
    .flat()
    .filter((cell) => Math.max(Math.abs(cell.x - 6), Math.abs(cell.y - 6)) <= 6)
    // Nearest the ogre first, as a call within range orders them.
    .sort(
      (a, b) => Math.max(Math.abs(a.x - 25), Math.abs(a.y - 12)) - Math.max(Math.abs(b.x - 25), Math.abs(b.y - 12)),
    );
  const came = rulesetCallCreatures(definition, state, druid, conjure, 3, roll, area, true);
  assert.equal(came.length, 3, "all three came");
  const spiders = state.combatants.filter((one) => came.includes(one.id));
  for (const one of spiders) {
    assert.ok(
      area.some((cell) => cell.x === one.x && cell.y === one.y),
      `${one.id} in the area`,
    );
  }
  assert.deepEqual(overlaps(state), []);
}

console.log("Called creatures are set down where all of each one fits, clear of everybody already in the fight.");
