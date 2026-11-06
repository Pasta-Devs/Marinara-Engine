/**
 * Ways over the ground (Capability API 1.432).
 *
 *   - `ignoresHardGround` (Land's Stride, kept on by a feature): forest and growth cost a plain step,
 *     and the hard going a lasting area makes still counts in full.
 *   - `runsAcross` (Unarmored Movement at 9th level, a level on a derived value): steps of any
 *     height on foot, water crossed but never offered as somewhere to stop, and a walk held still on
 *     the water comes out on the nearest open ground. Not below 9th level.
 *   - The install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_MOVE_OPTION,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetSlowedStep } from "../../packages/shared/src/features/ruleset-combat/grid.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ground-ways-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 432);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const stride = {
    id: "lands-stride",
    label: "Land's Stride",
    rows: [{ list: "features", values: { name: "Land's Stride" } }],
    mechanics: { kind: "utility", keepsOn: ["strider"] },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "strider", label: "Land's Stride" });
    doc.combat.conditions.push({ condition: "strider", effects: [], ignoresHardGround: true });
    doc.sheet.derived.push({
      id: "wall_runner",
      label: "Unarmored Movement: walls and water",
      op: "stepTable",
      from: { field: "level" },
      table: [
        [0, 0],
        [9, 1],
      ],
    });
    doc.combat.levels = [...(doc.combat.levels ?? []), { derived: "wall_runner", at: 1, runsAcross: true }];
    doc.catalogs.push({ id: "druid", label: "Druid", feeds: ["features"], entries: [structuredClone(stride)] });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((one) => one.id === "druid")!.entries!;
  const block = (): RulesetStatBlock =>
    ({
      health: 80,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
    }) as unknown as RulesetStatBlock;
  // Forest down column 3, water down columns 5 to 7, and a ledge two levels up at (2, 0).
  const grid = (): TacticalGrid => {
    const tiles = Array.from({ length: 9 }, () => Array(12).fill("plains"));
    for (const row of tiles) {
      row[3] = "forest";
      row[5] = row[6] = row[7] = "water";
    }
    const elevation = Array.from({ length: 9 }, () => Array(12).fill(0));
    elevation[0]![2] = 2;
    return { width: 12, height: 9, tiles, elevation };
  };
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (
    options: { level?: number; strides?: boolean; at?: { x: number; y: number } } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
            fields: { level: options.level ?? 9, ac: 16, speed: 30, hp_max: 60 },
            lists: options.strides
              ? { features: entries.flatMap((entry) => rowsFromCatalogEntry("druid", entry).map((row) => row.row)) }
              : {},
          }),
          live: {},
          ...(options.strides ? { catalogs: { druid: entries } } : {}),
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { hero: options.at ?? { x: 4, y: 4 }, foe: { x: 3, y: 4 } },
      },
    });
    state.order = ["hero", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const cells = (state: RulesetEncounterState) =>
    new Map(
      (rulesetCombatOptions(definition, state, "hero").find((one) => one.id === RULESET_MOVE_OPTION)?.cells ?? []).map(
        (cell) => [`${cell.x},${cell.y}`, cell.cost],
      ),
    );

  // ── Land's Stride ──
  {
    const plain = fight({ level: 6, at: { x: 1, y: 4 } });
    const strider = fight({ level: 6, strides: true, at: { x: 1, y: 4 } });
    assert.equal(who(plain, "hero").ignoresHardGround, undefined);
    assert.equal(who(strider, "hero").ignoresHardGround, true, "kept on by the feature");
    assert.equal(cells(plain).get("2,4"), 1);
    assert.equal(cells(plain).get("3,3"), 3, "forest costs double");
    assert.equal(cells(strider).get("3,3"), 2, "forest costs a plain step");
    // Growth too.
    for (const state of [plain, strider]) state.board!.grid.ground = { "2,3": { growth: true } };
    assert.equal(cells(plain).get("2,3"), 2);
    assert.equal(cells(strider).get("2,3"), 1);
    // An area's hard going counts in full, and still does not stack with the ground's for anybody else.
    const slowed = new Map([
      ["2,4", { times: 2, halves: false }],
      ["3,4", { times: 2, halves: false }],
    ]);
    const board = plain.board!.grid;
    const from = { x: 1, y: 4 };
    assert.equal(rulesetSlowedStep(board, { x: 2, y: 4 }, 1, slowed, from, who(strider, "hero")), 2);
    assert.equal(rulesetSlowedStep(board, { x: 3, y: 4 }, 1, slowed, from, who(strider, "hero")), 2);
    assert.equal(rulesetSlowedStep(board, { x: 3, y: 4 }, 2, slowed, from, who(plain, "hero")), 2);
    // Water is still water.
    assert.equal(cells(strider).has("5,4"), false);
  }

  // ── Unarmored Movement at 9th level ──
  {
    const early = fight({ level: 8 });
    assert.equal(who(early, "hero").runsAcross, undefined);
    assert.equal(cells(early).has("8,4"), false, "nobody walks across water");
    const runner = fight({ level: 9 });
    assert.equal(who(runner, "hero").runsAcross, true);
    const reach = cells(runner);
    assert.equal(reach.get("8,4"), 4, "across the water for a plain step each");
    assert.equal(reach.has("5,4") || reach.has("6,4") || reach.has("7,4"), false, "never stopped on");
    const across = applyRulesetCombatChoice(
      definition,
      runner,
      { actorId: "hero", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 8, y: 4 } } as RulesetCombatChoice,
      roll,
    );
    assert.equal(of(across.events, "refused").length, 0, JSON.stringify(of(across.events, "refused")));
    assert.deepEqual({ x: who(across.state, "hero").x, y: who(across.state, "hero").y }, { x: 8, y: 4 });
    // Up the ledge two levels high, which nobody else walks.
    const low = fight({ level: 8, at: { x: 2, y: 1 } });
    const high = fight({ level: 9, at: { x: 2, y: 1 } });
    assert.equal(cells(low).has("2,0"), false);
    assert.equal(cells(high).get("2,0"), 1);
  }

  // ── Held still on the water ──
  {
    const state = fight({ level: 9, at: { x: 4, y: 4 } });
    // A grab that reaches two cells, and holds whoever it hits where they are.
    who(state, "foe").actions.push({
      id: "grab",
      label: "Grab",
      kind: "attack",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      reach: 2,
      toHit: 20,
      damage: { count: 0, sides: 0, flat: 1 },
      applies: [{ condition: "grappled", duration: "instant" }],
    } as never);
    let step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 8, y: 4 } } as RulesetCombatChoice,
      roll,
    );
    assert.equal(step.state.window?.trigger.kind, "leaves-reach", "the step off the water leaves the grab's reach");
    const events = [...step.events];
    for (let guard = 0; step.state.window && guard < 6; guard++) {
      const window = step.state.window;
      const asking = window.waiting[0]!;
      const option = rulesetWindowOptions(definition, step.state, asking).find((one) => one.id !== RULESET_PASS_OPTION);
      step = applyRulesetCombatChoice(
        definition,
        step.state,
        { actorId: asking, optionId: option?.id ?? RULESET_PASS_OPTION, targetIds: [], window: window.id },
        roll,
      );
      events.push(...step.events);
    }
    const move = of(events, "move").at(-1)!;
    assert.equal(move.stopped, true, JSON.stringify(of(events, "move")));
    assert.equal(move.to.x, 5, "held on the water");
    const ashore = of(events, "ashore");
    assert.equal(ashore.length, 1, JSON.stringify(events.map((one) => one.type)));
    assert.equal(ashore[0]!.to.x, 4, "out on the nearest open ground");
    const hero = who(step.state, "hero");
    assert.deepEqual({ x: hero.x, y: hero.y }, ashore[0]!.to);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or levels ignore ground hard going of itself (ignoresHardGround) or run up heights and across water (runsAcross) requires schemaVersion 2 and capabilityApi 1.432 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(431) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(432) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(431) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ground ways: Land's Stride walks forest and growth for a plain step while an area's hard going still counts; Unarmored Movement at 9th level runs up a ledge and across water, never stops on it, and a walk held on the water comes ashore; gated at 1.432.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
