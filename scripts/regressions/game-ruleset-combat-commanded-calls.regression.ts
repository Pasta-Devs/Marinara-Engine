/**
 * Creatures built from their caller and acting only as commanded (Capability API 1.558): 5e's
 * Arcane Hand.
 *
 *   - `fromCaller`: the hand's health is its caller's maximum, its fist's bonus and an added amount
 *     are read off its caller's sheet.
 *   - `commandedWith`: its first turn is free; later, its caller pays a bonus action for each, or it
 *     waits.
 *   - Refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-commanded-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 558);
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
    fromCaller: { health: true, toHit: { abilityMod: "wis" }, adds: { abilityMod: "wis" } },
    commandedWith: "bonus",
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
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const roll = (sides: number) => (sides === 20 ? 15 : 1);
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

  // ── Cast: built from its caller ──
  const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Arcane Hand")!;
  step({ actorId: "wizard", optionId: option.id });
  const handId = state.combatants.find((one) => one.calledBy === "wizard")!.id;
  const theHand = () => rulesetCombatant(state, handId)!;
  assert.deepEqual(theHand().health, { value: 40, max: 40, temp: 0 }, "its caller's health maximum");
  const fist = theHand().actions.find((one) => one.label === "Clenched Fist")!;
  assert.equal(fist.toHit, 4, "its caller's Wisdom modifier as its bonus");
  assert.equal(fist.damage!.flat, 14, "and added to its damage");
  assert.deepEqual(state.order, ["wizard", handId, "brute"], "right after its caller");

  // ── Its first turn is free ──
  {
    const events = step({ actorId: "wizard", optionId: "end-turn" });
    assert.equal(state.order[state.turn], handId);
    assert.deepEqual(of(events, "skip"), []);
    assert.equal(wizard().budgets.bonus, 1, "nothing paid");
  }

  // ── Later turns: its caller's bonus action, or it waits ──
  {
    step({ actorId: handId, optionId: "end-turn" });
    step({ actorId: "brute", optionId: "end-turn" });
    // The wizard's turn: they keep their bonus action, and the hand's turn spends it.
    const events = step({ actorId: "wizard", optionId: "end-turn" });
    assert.equal(state.order[state.turn], handId);
    assert.deepEqual(of(events, "skip"), []);
    assert.equal(wizard().budgets.bonus, 0, "paid with the bonus action");
    step({ actorId: handId, optionId: "end-turn" });
    step({ actorId: "brute", optionId: "end-turn" });
    // Spent on its own turn: the hand waits.
    wizard().budgets.bonus = 0;
    const waited = step({ actorId: "wizard", optionId: "end-turn" });
    assert.deepEqual(of(waited, "skip"), [{ type: "skip", actorId: handId, reason: "uncommanded" }]);
    assert.equal(state.order[state.turn], "brute", "its turn passed");
  }

  // ── Refusals ──
  refused(document({ fromCaller: {} }), /Say what they take from their caller/);
  refused(document({ commandedWith: "nonsense" }), /Unknown budget "nonsense"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with creatures built from their caller or commanded by them (calls.fromCaller, calls.commandedWith) requires schemaVersion 2 and capabilityApi 1.558 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(557) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(558) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(557) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Commanded calls: Arcane Hand takes its caller's health maximum, bonus and modifier, acts free as cast, then only on its caller's bonus action; gated at 1.558.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
