/**
 * 5e's Wish, its other uses and its stress (Capability API 1.756, 1.757).
 *
 *   - 1.756: a condition's `abilities` may lower one to a number only where it is higher (`atMost`):
 *     "your Strength drops to 3, if it isn't 3 or lower already". Its `lastsDays` may be rolled
 *     (`{ dice }`), each day spent resting counting `restingCounts` (a sheet `pass` with `resting`):
 *     "for 2d4 days. For each of those days that you spend resting ..., your remaining recovery time
 *     decreases by 2 days".
 *   - 1.757: a heal of all the health each target is missing (`healsAll`): "regain all hit points".
 *   - Refusals and the install gates.
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
  evaluateRulesetSheetLive,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  rowsFromCatalogEntry,
  rulesetChangedAbilityScores,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wish-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 757);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics,
  });
  const stress = (lastsDays: unknown = { dice: "2d4", restingCounts: 2 }) =>
    spell("stress", "Stress", {
      kind: "buff",
      budget: "action",
      targets: "self",
      applies: [{ condition: "stressed", duration: "until-dispelled", lastsDays }],
    });
  const restore = (extra: Record<string, unknown> = {}) =>
    spell("restore", "Restore", {
      kind: "heal",
      budget: "action",
      range: 60,
      targets: "ally",
      healsAll: true,
      ...extra,
    });
  const fiveE = (options: { change?: unknown; entries?: unknown[] } = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "stressed", label: "Stressed" });
    doc.combat.conditions.push({
      condition: "stressed",
      effects: [],
      abilities: { str: options.change ?? { atMost: 3 } },
    });
    doc.catalogs.push({
      id: "wish",
      label: "Wish",
      feeds: ["spells"],
      entries: options.entries ?? [stress(), restore()],
    });
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "wish")!.entries! as RulesetCatalogEntry[];
  const casterBuild = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 14, int: 20, wis: 10, cha: 10 },
    fields: { level: 17, ac: 12, speed: 30, hp_max: 90, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const allyBuild = rulesetSheetBuildSchema.parse({ fields: { level: 3, ac: 12, speed: 30, hp_max: 30 } });
  const fight = (roll: (sides: number) => number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: casterBuild, catalogs: { spells: entries } },
        { id: "ally", name: "Ally", side: "party", build: allyBuild, live: { pools: { hp: { value: 4 } } } },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { mage: { x: 1, y: 1 }, ally: { x: 2, y: 1 }, foe: { x: 6, y: 1 } },
      },
    });
    state.order = ["mage", "ally", "foe"];
    state.turn = 0;
    return state;
  };
  const cast = (
    state: ReturnType<typeof fight>,
    label: string,
    targetIds: string[],
    roll: (sides: number) => number,
  ) => {
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `${label} offered`);
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds },
      roll,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    return result;
  };

  // ── 1.756: Strength at most 3, only where it is higher ──
  assert.deepEqual(rulesetChangedAbilityScores(definition, { str: 18, dex: 12 }, [{ str: { atMost: 3 } }]), {
    str: 3,
    dex: 12,
  });
  assert.deepEqual(rulesetChangedAbilityScores(definition, { str: 2 }, [{ str: { atMost: 3 } }]), { str: 2 });
  // The lowest of two, and after a raise.
  assert.deepEqual(
    rulesetChangedAbilityScores(definition, { str: 10 }, [
      { str: { atMost: 5 } },
      { str: { atMost: 3 } },
      { str: { set: 19 } },
    ]),
    { str: 3 },
  );

  // ── 1.756: put on in a fight, its days rolled; lifted onto the sheet, resting days count double ──
  let live: RulesetLiveState;
  {
    // 2d4 rolled 3 and 3: six days.
    const roll = (sides: number) => (sides === 4 ? 3 : 10);
    const step = cast(fight(roll), "Stress", ["mage"], roll);
    const mage = rulesetCombatant(step.state, "mage")!;
    const entry = mage.tracked.find((one) => one.condition === "stressed");
    assert.ok(entry, JSON.stringify(step.events));
    assert.equal(entry.rounds, null);
    assert.equal(entry.days, 6, "2d4 rolled");
    assert.equal(entry.restingCounts, 2);
    liftRulesetFightEffects(definition, step.state);
    live = mage.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.dayClocks, { stressed: 6 });
    assert.deepEqual(live.dayRests, { stressed: 2 });
    assert.equal(evaluateRulesetSheetLive(definition, casterBuild, live).abilityScores.str, 3, "Strength drops to 3");
  }
  {
    const pass = (from: RulesetLiveState, op: { days: number; resting?: true }) => {
      const result = applyRulesetSheetOp(definition, casterBuild, from, { op: "pass", ...op });
      assert.ok(result.ok, JSON.stringify(result));
      return result;
    };
    // A day of work counts one; two of rest count four.
    let step = pass(live, { days: 1 });
    assert.deepEqual(step.live.dayClocks, { stressed: 5 });
    step = pass(step.live, { days: 2, resting: true });
    assert.match(step.now, /2 days pass resting/);
    assert.deepEqual(step.live.dayClocks, { stressed: 1 });
    assert.deepEqual(step.live.dayRests, { stressed: 2 });
    step = pass(step.live, { days: 1, resting: true });
    assert.match(step.now, /Stressed ended/);
    assert.equal(step.live.dayClocks, undefined);
    assert.equal(step.live.dayRests, undefined, "what resting counts goes with it");
    assert.equal(evaluateRulesetSheetLive(definition, casterBuild, step.live).abilityScores.str, 18, "back");
    // Without restingCounts, resting counts one a day.
    const plain = applyRulesetSheetOp(
      definition,
      allyBuild,
      { conditions: ["stressed"], dayClocks: { stressed: 3 } },
      {
        op: "pass",
        days: 2,
        resting: true,
      },
    );
    assert.ok(plain.ok);
    assert.deepEqual(plain.live.dayClocks, { stressed: 1 });
  }
  // ── The Game Master's tag ──
  assert.deepEqual(parseSheetCommandTagBody('who="Mage" op="pass" days="2" resting="yes"').op, {
    op: "pass",
    days: 2,
    resting: true,
  });
  assert.deepEqual(parseSheetCommandTagBody('who="Mage" op="pass" days="2"').op, { op: "pass", days: 2 });

  // ── 1.757: all the health they are missing ──
  {
    const roll = () => 10;
    const step = cast(fight(roll), "Restore", ["ally"], roll);
    const heal = of(step.events, "heal").find((one) => one.targetId === "ally");
    assert.ok(heal, JSON.stringify(step.events));
    assert.equal(heal.amount, 26);
    assert.equal(heal.health, 30, "all of it");
  }

  // ── Refused ──
  refused(fiveE({ change: { atMost: 3, add: 1 } }), /abilities/);
  refused(fiveE({ entries: [stress({ dice: "2d4", restingCounts: 1 })] }), /lastsDays: Invalid input/);
  refused(fiveE({ entries: [stress({ dice: "lots" })] }), /lastsDays/);
  refused(fiveE({ entries: [restore({ kind: "buff" })] }), /"healsAll" heals all the health/);
  refused(
    fiveE({ entries: [restore({ sharesHeal: true, amount: { dice: "2d8" } })] }),
    /"healsAll" heals all the health/,
  );

  // ── The install gates ──
  {
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
    const stressGate =
      "A ruleset with an ability lowered only where it is higher (atMost) or a condition's days rolled (lastsDays dice) requires schemaVersion 2 and capabilityApi 1.756 or newer";
    const healGate =
      "A ruleset with a heal of all the health its targets are missing (healsAll) requires schemaVersion 2 and capabilityApi 1.757 or newer";
    const onlyStress = fiveE({ entries: [stress()] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(755) as never, onlyStress), stressGate);
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(755) as never,
        fiveE({ change: { to: 3 }, entries: [stress({ dice: "1d4" })] }),
      ),
      stressGate,
      "rolled days alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(756) as never, onlyStress), stressGate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(756) as never, fiveE()), healGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(757) as never, fiveE()), healGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(755) as never, JSON.parse(fiveEText)), stressGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(756) as never, JSON.parse(fiveEText)), healGate);
  }

  console.log(
    "Wish: its stress drops Strength to 3 only where it is higher, for 2d4 days, resting days counting two; its heal gives back all one is missing; gated at 1.756 and 1.757.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
