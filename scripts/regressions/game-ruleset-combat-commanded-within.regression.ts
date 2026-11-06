/**
 * A call commanded only within some distance of its caller (Capability API 1.620): 5e's Staff of the
 * Python, "if it is within 60 feet of you and you aren't incapacitated".
 *
 *   - Within reach and able to act: the caller pays its bonus action for the snake's turn, as ever.
 *   - Too far, or the caller incapacitated: the snake acts on its own, run by the Engine even where
 *     the player took it, and nothing is paid or skipped.
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
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-commanded-within-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetController } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 620);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hand = {
    id: "arcane-hand",
    label: "Arcane Hand",
    creature: {
      health: 1,
      defense: 20,
      initiativeModifier: 0,
      speed: 60,
      tier: "cr_1",
      actions: [{ id: "fist", name: "Clenched Fist", budget: "action", toHit: 0, damage: { flat: 10 }, reach: 5 }],
    },
  };
  const calls = {
    creature: "creatures/arcane-hand",
    count: { flat: 1 },
    initiative: "after",
    commandedWith: "bonus",
    commandedWithin: 60,
  };
  const spell = (more: Record<string, unknown> = {}) => ({
    id: "arcane-hand",
    label: "Arcane Hand",
    rows: [{ list: "spells", values: { name: "Arcane Hand", level: 1, prepared: true } }],
    mechanics: { kind: "utility", targets: "self", budget: "action", calls: { ...calls, ...more } },
  });
  const document = (more?: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(hand));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell(more)] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const roll = (sides: number) => (sides === 20 ? 15 : 1);
  const grid = { width: 40, height: 10, tiles: Array.from({ length: 10 }, () => Array(40).fill("plains")) };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  let state: RulesetEncounterState = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    bestiary,
    combatants: [
      {
        id: "wizard",
        name: "Wizard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      {
        id: "brute",
        name: "Brute",
        side: "enemy",
        block: { health: 100, defense: 10, initiativeModifier: -5, speed: 30, actions: [] } as never,
      },
    ],
    board: { grid, placements: { wizard: { x: 1, y: 1 }, brute: { x: 30, y: 8 } } } as never,
  });
  state.order = ["wizard", "brute"];
  state.turn = 0;
  const step = (choice: Record<string, unknown>) => {
    const taken = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice } as never, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    state = taken.state;
    return taken.events;
  };
  const wizard = () => rulesetCombatant(state, "wizard")!;

  // ── Cast; its first turn is free ──
  const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Arcane Hand")!;
  step({ actorId: "wizard", optionId: option.id });
  const snakeId = state.combatants.find((one) => one.calledBy === "wizard")!.id;
  const snake = () => rulesetCombatant(state, snakeId)!;
  assert.equal(snake().calledCommandWithin, 12, "60 feet in cells");
  step({ actorId: "wizard", optionId: "end-turn" });
  assert.equal(snake().calledOnOwn, undefined);
  const round = () => {
    step({ actorId: snakeId, optionId: "end-turn" });
    step({ actorId: "brute", optionId: "end-turn" });
    wizard().budgets.bonus = 1;
    return step({ actorId: "wizard", optionId: "end-turn" });
  };

  // ── Within reach: commanded, and paid for ──
  {
    const events = round();
    assert.equal(state.order[state.turn], snakeId);
    assert.deepEqual(of(events, "skip"), []);
    assert.equal(wizard().budgets.bonus, 0, "paid with the bonus action");
    assert.equal(snake().calledOnOwn, undefined);
  }
  // ── Too far: on its own, nothing paid, never skipped ──
  {
    wizard().x = 30;
    wizard().y = 1;
    const events = round();
    assert.equal(state.order[state.turn], snakeId);
    assert.deepEqual(of(events, "skip"), []);
    assert.equal(wizard().budgets.bonus, 1, "nothing paid");
    assert.equal(snake().calledOnOwn, true);
    assert.equal(
      rulesetController({} as never, { controllers: { [snakeId]: "manual" } } as never, snake()),
      "ai",
      "the Engine runs it, whoever took it",
    );
  }
  // ── Back within reach, but incapacitated: on its own still ──
  {
    wizard().x = snake().x! + 1;
    wizard().y = snake().y!;
    wizard().tracked.push({ condition: "stunned", rounds: 10 });
    const events = round();
    assert.deepEqual(of(events, "skip"), []);
    assert.equal(snake().calledOnOwn, true);
    wizard().tracked = wizard().tracked.filter((one) => one.condition !== "stunned");
    round();
    assert.equal(snake().calledOnOwn, undefined, "commanded again");
    assert.equal(rulesetController({} as never, { controllers: { [snakeId]: "manual" } } as never, snake()), "manual");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a call commanded only within some distance of its caller (calls.commandedWithin) requires schemaVersion 2 and capabilityApi 1.620 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(619) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(620) as never, document()), gate);
  }

  console.log(
    "calls.commandedWithin: commanded and paid for within 60 feet, on its own and run by the Engine when too far or its caller is incapacitated; gated at 1.620.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
