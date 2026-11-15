/**
 * Props in a boss's rules, and an aura that feeds (Capability API 1.331).
 *
 *   - A condition's `whileNearProp {prop, within}`: held only within that distance of a standing prop
 *     named by id or loosely by label (the Wheel's Favour by The Year-Wheel); held off elsewhere, or once it is broken.
 *   - A creature area's `aroundProp`: a burst around every standing prop of that label, wherever it is
 *     aimed (Shelves Lean around the shelf rows).
 *   - An aura's `feeds`: its holder regains that much when somebody it reaches falls (The Owed's
 *     Collector).
 *   - Refused shapes; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatEffects,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-props-feed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 331);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push(
      { id: "favour", label: "The Wheel's Favour" },
      { id: "collector", label: "Collector" },
    );
    doc.combat.conditions.push(
      { condition: "favour", effects: ["resist-all"], whileNearProp: { prop: "Year-Wheel", within: 10 } },
      { condition: "collector", effects: [], auras: [{ distance: 20, side: "enemies", feeds: 15 }] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const combat = definition.combat!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 10, reach: 5, damage: { count: 1, sides: 4, flat: 0 } },
        {
          id: "lean",
          name: "Shelves Lean",
          budget: "action",
          range: 60,
          area: { shape: "burst", size: 5, aroundProp: "Shelf" },
          save: { save: "dex_save", difficulty: 30, onSuccess: "negates" },
          damage: { count: 2, sides: 6, flat: 0, type: "bludgeoning" },
        },
      ],
      ...extra,
    }) as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  type Spot = { x: number; y: number };
  const fight = (at: Record<"bard" | "ally" | "foe", Spot>, props: unknown[] = []): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live: {} },
        { id: "ally", name: "Ally", side: "party", build, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 24, height: 15, tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")) },
        placements: at,
        props: props as never,
      },
    });
    state.order = ["foe", "bard", "ally"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const at = { bard: { x: 2, y: 2 }, ally: { x: 4, y: 2 }, foe: { x: 10, y: 7 } };

  // ── The Wheel's Favour: only within 10 feet of the Year-Wheel ──
  {
    const wheel = { id: "p1", label: "Year-Wheel", cells: [{ x: 12, y: 7 }], health: 20, blocks: { move: true } };
    const state = fight(at, [wheel]);
    who(state, "foe").tracked.push({ condition: "favour", rounds: null, kept: true });
    const resists = (current: RulesetEncounterState) =>
      rulesetCombatEffects(definition, combat, who(current, "foe"), current).has("resist-all");
    assert.ok(resists(state), "two squares from the Wheel");
    who(state, "foe").x = 9;
    assert.ok(!resists(state), "three squares off: held off");
    who(state, "foe").x = 11;
    state.board!.props![0]!.health = 0;
    assert.ok(!resists(state), "the Wheel broken");
    assert.ok(rulesetCombatEffects(definition, combat, who(state, "foe")).has("resist-all"), "no board, held");
    // Named loosely, or by its id: b24's Wheel is p1, "The Year-Wheel".
    const b24 = fight(at, [{ ...wheel, label: "The Year-Wheel" }]);
    who(b24, "foe").tracked.push({ condition: "favour", rounds: null, kept: true });
    assert.ok(resists(b24), "the label read loosely");
    const other = fight(at, [{ ...wheel, label: "Wheel" }]);
    who(other, "foe").tracked.push({ condition: "favour", rounds: null, kept: true });
    assert.ok(!resists(other), "another prop");
    const byId = parsed(
      document((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "favour").whileNearProp.prop =
          "p1";
      }),
    );
    assert.ok(rulesetCombatEffects(byId, byId.combat!, who(other, "foe"), other).has("resist-all"), "by its id");
  }

  // ── Shelves Lean: around every shelf, wherever it is aimed ──
  {
    const shelves = [
      {
        id: "p1",
        label: "Shelf",
        cells: [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
        ],
        health: 20,
      },
    ];
    const state = fight({ bard: { x: 5, y: 6 }, ally: { x: 8, y: 5 }, foe: { x: 10, y: 7 } }, shelves);
    const leaned = act(state, { actorId: "foe", optionId: "lean", targetIds: [], at: { x: 14, y: 7 } });
    assert.deepEqual(
      of(leaned.events, "damage").map((one) => one.targetId),
      ["bard"],
      "beside the shelf, not two squares off it",
    );
  }

  // ── Collector: the Owed regains 15 when somebody its aura reaches falls ──
  {
    const state = fight({ bard: { x: 2, y: 2 }, ally: { x: 9, y: 7 }, foe: { x: 10, y: 7 } });
    const foe = who(state, "foe");
    foe.tracked.push({ condition: "collector", rounds: null, kept: true });
    foe.health!.value = 50;
    const pool = (combat.health as { pool: string }).pool;
    const ally = who(state, "ally").sheet!;
    ally.live = { ...(ally.live as object), pools: { [pool]: { value: 1 } } };
    const fed = act(state, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.ok(who(fed.state, "ally").down);
    assert.deepEqual(
      of(fed.events, "heal").map((one) => [one.targetId, one.amount]),
      [["foe", 15]],
    );
    assert.equal(who(fed.state, "foe").health?.value, 65);
  }

  // ── A broken prop is nobody: Collector does not feed on its own shelf falling ──
  {
    const shelf = { id: "p1", label: "Shelf", cells: [{ x: 9, y: 7 }], health: 1 };
    const state = fight({ bard: { x: 2, y: 2 }, ally: { x: 2, y: 4 }, foe: { x: 12, y: 7 } }, [shelf]);
    const foe = who(state, "foe");
    foe.tracked.push({ condition: "collector", rounds: null, kept: true });
    foe.health!.value = 50;
    const leaned = act(state, { actorId: "foe", optionId: "lean", targetIds: [], at: { x: 9, y: 7 } });
    assert.equal(leaned.state.board?.props?.[0]?.health, 0, "the shelf is broken");
    assert.deepEqual(of(leaned.events, "heal"), []);
    assert.equal(who(leaned.state, "foe").health?.value, 50);
  }

  // ── Refused, and the gate ──
  {
    const bad = parseRulesetDefinition(
      document((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "favour").whileNearProp = {
          prop: "",
          within: 10,
        };
      }),
    );
    assert.equal(bad.ok, false);
    const gate =
      "A ruleset with a condition held only near a prop, an area around props, or an aura that feeds on the felled requires schemaVersion 2 and capabilityApi 1.331 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(330) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(331) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(330) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Props and feeding: the Favour holds only by the Wheel, Shelves Lean falls around the shelves, and Collector feeds on the fallen.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
