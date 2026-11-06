/**
 * What a fight's end leaves the story (laptop playtest 2026-10-25: Conjure Animals' horses joined the
 * story's party after the fight, still Squeezing).
 *
 *   - What was called into the fight is no party member in the recap the Game Master reads, and its
 *     conditions are not left to rule on; it is said apart, while it still stands.
 *   - Squeezed between walls as the fight ends: whole again, the ruleset's condition for it lifted.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rulesetEncounterSummary,
  rulesetSheetBuildSchema,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import { rulesetCombatRecapLines } from "../../packages/client/src/lib/ruleset-combat-bridge.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-fight-end-called-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { combatDirectorView, createCombatDirector } =
  await import("../../packages/server/src/services/game/combat-director.service.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const bestiary = { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 15, speed: 30, hp_max: 28, race: "Human" },
  });
  const built = createRulesetFight({
    definition,
    seed: 7,
    party: [{ id: "rook", name: "Rook" }],
    enemies: [{ id: "thing", name: "Thing", tier: "cr_1" }],
    cards: [{ name: "Rook", rulesetSheet: { v: 1, build } }],
    playerName: "Rook",
    live: null,
    partyCatalogs: {},
    bestiary,
  });
  assert.ok(built.ok, built.ok ? "" : built.error);
  const encounter = built.fight.encounter;
  const rook = encounter.combatants.find((one) => one.id === "rook")!;
  // A horse the druid called, standing, held between two walls.
  const horse = structuredClone(rook);
  Object.assign(horse, { id: "horse", name: "Draft Horse 1", calledBy: "rook" });
  delete horse.sheet;
  horse.health = { value: 19, max: 19, temp: 0 };
  horse.tracked = [{ condition: "restrained", rounds: null }];
  encounter.combatants.push(horse);

  // ── The recap: the horse is no party member ──
  const lines = rulesetCombatRecapLines(definition, rulesetEncounterSummary(definition, encounter));
  const party = lines.find((line) => line.startsWith("Party on"))!;
  assert.match(party, /Rook/);
  assert.doesNotMatch(party, /Draft Horse/, lines.join("\n"));
  assert.ok(lines.some((line) => /^Called into the fight, not party members: Draft Horse 1\./.test(line)));
  assert.ok(!lines.some((line) => line.startsWith("Still affected") && line.includes("Draft Horse")));
  // One whose dying ran out is dead to the Game Master, not down (laptop 0706 Party B).
  {
    const fallen = structuredClone(encounter);
    Object.assign(
      fallen.combatants.find((one) => one.id === "rook")!,
      { down: true, dying: false, defeated: true },
    );
    const said = rulesetCombatRecapLines(definition, rulesetEncounterSummary(definition, fallen));
    assert.match(
      said.find((line) => line.startsWith("Party on"))!,
      /Rook: [^;]*\(dead/,
      said.join("\n"),
    );
  }

  // ── Squeezed as it ends: whole again, the condition lifted ──
  const squeezing = {
    ...definition,
    combat: {
      ...definition.combat!,
      sizes: { ...definition.combat!.sizes, squeezing: { costs: 2, condition: "restrained" } },
    },
  } as RulesetDefinition;
  rook.squeezedFrom = 2;
  rook.span = 1;
  rook.tracked.push({ condition: "restrained", rounds: null });
  liftRulesetFightEffects(squeezing, encounter);
  assert.equal(rook.span, 2, "whole again");
  assert.equal(rook.squeezedFrom, undefined);
  assert.ok(!rook.tracked.some((entry) => entry.condition === "restrained"), "no longer squeezing");

  // ── A party all at 0 hit points, one still rolling to live: not lost yet (cloud re-test 2026-10-26) ──
  {
    const again = createRulesetFight({
      definition,
      seed: 7,
      party: [{ id: "rook", name: "Rook" }],
      enemies: [{ id: "thing", name: "Thing", tier: "cr_1" }],
      cards: [{ name: "Rook", rulesetSheet: { v: 1, build } }],
      playerName: "Rook",
      live: null,
      partyCatalogs: {},
      bestiary,
    });
    assert.ok(again.ok, again.ok ? "" : again.error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("rook", "Rook", "player")],
      enemies: [unit("thing", "Thing", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = again.fight;
    const fallen = again.fight.encounter.combatants.find((one) => one.id === "rook")!;
    fallen.down = true;
    fallen.dying = true;
    syncRulesetCombatants(definition, state);
    // What the Engine's own units read at 0: no unit on the party's side has hit points left.
    state.party[0]!.hp = 0;
    combatDirectorView(state);
    assert.equal(state.outcome, undefined, "a dying hero keeps the fight going");
    assert.notEqual(state.stage, "finished");
  }
  console.log("game-ruleset-fight-end-called: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
