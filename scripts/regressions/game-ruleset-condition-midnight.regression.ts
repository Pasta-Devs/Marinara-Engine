/**
 * Conditions until midnight, and what one deals as it ends saved against for half (Capability API
 * 1.751): 5e's Midnight tears, "no effect until the stroke of midnight. If the poison has not been
 * neutralized before then, the creature must succeed on a DC 17 Constitution saving throw, taking 31
 * (9d6) poison damage on a failed save, or half as much damage on a successful one."
 *
 *   - `lastsDays: "midnight"` puts it on with no clock in the fight and, on a sheet, until its next
 *     `pass`.
 *   - `onEnd.harm.save` is rolled as it is dealt, for half on a success, in a fight and as days pass;
 *     with `when: ["expired"]` it is not dealt when the condition is cured instead.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-midnight-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 751);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const tears = (applies: Record<string, unknown>) => ({
    id: "tears",
    label: "Midnight tears",
    rows: [{ list: "spells", values: { name: "Midnight tears", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      budget: "action",
      range: 5,
      targets: "ally",
      applies: [{ condition: "weeping", ...applies }],
    },
  });
  const endHarm = { dice: "9d6", type: "poison", save: { save: "con_save", difficulty: 17, onSuccess: "half" } };
  const fiveE = (
    applies: Record<string, unknown> = { duration: "until-dispelled", lastsDays: "midnight" },
    harm: Record<string, unknown> = endHarm,
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "weeping", label: "Midnight tears" });
    doc.combat.conditions.push({ condition: "weeping", effects: [], onEnd: { harm, when: ["expired"] } });
    doc.catalogs.push({ id: "poisons", label: "Poisons", feeds: ["spells"], entries: [tears(applies)] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "poisons")!.entries! as RulesetCatalogEntry[];
  const allyBuild = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 60 },
  });
  // A d20 of `save`, every other die a 4.
  const dice = (save: number) => (sides: number) => (sides === 20 ? save : 4);
  const fight = (live: unknown = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "poisoner",
          name: "Poisoner",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            fields: { level: 5, ac: 14, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          catalogs: { spells: entries },
        },
        { id: "ally", name: "Ally", side: "party", build: allyBuild, live },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { poisoner: { x: 1, y: 1 }, ally: { x: 2, y: 1 }, foe: { x: 6, y: 1 } },
      },
    });
    state.order = ["poisoner", "ally", "foe"];
    state.turn = 0;
    return state;
  };

  // ── In the fight: on with no clock; the fight over, until the sheet's next day ──
  let live: RulesetLiveState;
  {
    let state = fight();
    const option = rulesetCombatOptions(definition, state, "poisoner").find((one) => one.label === "Midnight tears");
    assert.ok(option, "offered");
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "poisoner", optionId: option.id, targetIds: ["ally"] },
      () => 10,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    state = result.state;
    const ally = rulesetCombatant(state, "ally")!;
    const entry = ally.tracked.find((one) => one.condition === "weeping");
    assert.ok(entry, JSON.stringify(result.events));
    assert.equal(entry.rounds, null, "no clock in the fight");
    assert.equal(of(result.events, "damage").length, 0, "no effect until midnight");
    liftRulesetFightEffects(definition, state);
    live = ally.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.conditions, ["weeping"]);
    assert.deepEqual(live.dayClocks, { weeping: 1 });
  }

  const pass = (from: RulesetLiveState, rolled: number) => {
    const result = applyRulesetSheetOp(definition, allyBuild, from, { op: "pass", days: 1 }, dice(rolled));
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  };
  // ── Midnight: 9d6 poison, a failed save ──
  {
    const step = pass(live, 2);
    assert.match(
      step.now,
      /Midnight tears ended, Constitution save 2 against 17, took 36 poison \(Hit points 24\/60\)/,
    );
    assert.ok(!(step.live.conditions ?? []).includes("weeping"));
    assert.equal(step.live.dayClocks, undefined);
  }
  // ── A made save, half ──
  {
    const step = pass(live, 18);
    assert.match(step.now, /Constitution save 18 against 17 for half, took 18 poison \(Hit points 42\/60\)/);
  }
  // ── Neutralized before midnight: nothing ──
  {
    const cured = applyRulesetSheetOp(definition, allyBuild, live, {
      op: "condition",
      condition: "weeping",
      active: false,
    });
    assert.ok(cured.ok);
    assert.equal(cured.live.pools?.hp, undefined, "cured, it deals nothing");
    assert.equal(cured.live.dayClocks, undefined);
  }

  // ── In a fight, a clock that runs out deals it with its save ──
  {
    for (const [save, health] of [
      [2, 24],
      [18, 42],
    ] as const) {
      let state = fight({});
      rulesetCombatant(state, "ally")!.tracked.push({ condition: "weeping", rounds: 1, source: "poisoner" });
      rulesetCombatant(state, "ally")!.sheet!.live = { conditions: ["weeping"] };
      state.turn = 1;
      const ended = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "ally", optionId: "end-turn", targetIds: [] },
        dice(save),
      );
      state = ended.state;
      const damage = of(ended.events, "damage").find((one) => one.targetId === "ally");
      assert.ok(damage, JSON.stringify(ended.events));
      const ally = rulesetCombatant(state, "ally")!;
      assert.equal((ally.sheet!.live as RulesetLiveState).pools?.hp?.value, health, `a d20 of ${save}`);
    }
  }

  // ── Refused ──
  refused(
    fiveE(undefined, { dice: "9d6", type: "poison", save: { save: "nerve_save", difficulty: 17, onSuccess: "half" } }),
    /Unknown save "nerve_save"/,
  );
  refused(
    fiveE(undefined, { dice: "9d6", save: { save: "con_save", difficulty: 17, onSuccess: "negates" } }),
    /onSuccess/,
  );
  refused(fiveE({ duration: { rounds: 10 }, lastsDays: "midnight" }), /"lastsDays" is its clock outside a fight/);

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a condition lasting until midnight (lastsDays "midnight") or one whose onEnd harm is saved against (onEnd.harm.save) requires schemaVersion 2 and capabilityApi 1.751 or newer';
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(750) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(750) as never,
        fiveE({ duration: "until-dispelled", lastsDays: { const: 1 } }),
      ),
      gate,
      "the save for half alone",
    );
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(750) as never, fiveE(undefined, { dice: "9d6", type: "poison" })),
      gate,
      "midnight alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(751) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(750) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Condition midnight: Midnight tears has no clock in the fight, lasts on the sheet until its next day, then deals 9d6 poison saved against for half, nothing once cured; a fight's clock deals it with its save; gated at 1.751.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
