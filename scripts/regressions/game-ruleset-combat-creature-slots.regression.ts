/**
 * A creature's spell slots, shared by its coven, and a spell of its trait with its own numbers
 * (Capability API 1.642): 5e's hag covens, "1st level (4 slots)", and a hag's innate spells at their
 * own DC.
 *
 *   - A spell with no uses spends a slot of its level, else the lowest higher one left; none left, it
 *     is not offered. The menu shows what is left.
 *   - A coven spends one pool, whoever casts.
 *   - A spell's own save difficulty and attack.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  parseRulesetDefinition,
  parseRulesetCatalogFile,
  rulesetBestiarySheetCatalogIds,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetCreatureSchema,
  rulesetOptionTargets,
  rulesetProposedStatBlock,
  rulesetProposedCreatureSchema,
  rulesetSheetBuildSchema,
  rulesetPaidLevel,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-slots-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown> = {}) => ({
    id,
    label: id,
    rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      range: 60,
      budget: "action",
      autoHit: true,
      amount: { flat: 3 },
      cost: [{ pool: "slots_1", amount: 1 }],
      ...mechanics,
    },
  });
  const creature = () => ({
    id: "dryad",
    label: "Dryad",
    creature: {
      tier: "cr_5",
      health: 100,
      defense: 13,
      initiativeModifier: 20,
      actions: [{ id: "claw", name: "Claw", budget: "action", damage: { flat: 1 } }],
      spellcasting: {
        saveDifficulty: 14,
        toHit: 7,
        slots: { "1": 2, "2": 1 },
        spells: [
          { entry: "spells/spark" },
          { entry: "spells/daily", uses: { per: "day", count: 1 } },
          { entry: "spells/bolt", toHit: 3 },
          { entry: "spells/save", saveDifficulty: 11 },
          { entry: "spells/scaled", level: 3 },
          { entry: "spells/heal" },
          { entry: "spells/self" },
        ],
      },
    },
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        spell("spark"),
        spell("daily"),
        spell("bolt", { autoHit: false, attackRoll: true }),
        spell("save", { autoHit: false, save: { save: "dex_save", onSuccess: "negates" } }),
        spell("scaled", { amount: { dice: "1d6", flat: 1 }, perCostStep: { dice: "1d6", flat: 2 } }),
        spell("heal", { kind: "heal", autoHit: false, amount: { flat: 7 } }),
        spell("self", { kind: "buff", autoHit: false, targets: "self", amount: undefined, temporary: { flat: 5 } }),
      ],
    });
    doc.catalogs.push({ id: "fey", label: "Fey", holds: "creatures", entries: [creature()] });
    edit(doc);
    return doc;
  };
  const casting = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].creature.spellcasting;
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(fiveE(edit));
    assert.equal(parsed.ok, false, `must refuse ${pattern}`);
    if (!parsed.ok) assert.match(parsed.issues.join("; "), pattern);
  };
  const definition = parsedOrThrow(fiveE());
  const catalogs = (rules = definition) =>
    Object.fromEntries(rules.catalogs!.map((catalog) => [catalog.id, catalog.entries ?? []]));
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `ran out of dice for d${sides}`);
      const face = faces[index++]!;
      assert.ok(face >= 1 && face <= sides);
      return face;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const fight = (rules = definition, members = 1, board = false): RulesetEncounterState =>
    createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      bestiary: catalogs(rules),
      ...(board
        ? {
            board: {
              grid: { width: 20, height: 1, tiles: [Array.from({ length: 20 }, () => "plains")] },
              placements: {
                dryad: { x: 0, y: 0 },
                sister1: { x: 2, y: 0 },
                sister2: { x: 6, y: 0 },
                hero: { x: 4, y: 0 },
              },
            },
          }
        : {}),
      combatants: [
        ...Array.from({ length: members }, (_, i) => ({
          id: i === 0 ? "dryad" : `sister${i}`,
          name: "Dryad",
          side: "enemy" as const,
          creature: { catalogId: "fey", entryId: "dryad" },
        })),
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 13, hp_max: 300, speed: 30 },
          }),
          live: {},
        },
      ],
    });
  const actor = (state: RulesetEncounterState, id = "dryad") => rulesetCombatant(state, id)!;
  const option = (state: RulesetEncounterState, id: string, rules = definition, who = "dryad") => {
    state.turn = state.order.indexOf(who);
    actor(state, who).budgets.action = 1;
    return rulesetCombatOptions(rules, state, who).find((entry) => entry.id === `spells/${id}`);
  };
  const cast = (state: RulesetEncounterState, id: string, rules = definition, who = "dryad") => {
    state.turn = state.order.indexOf(who);
    actor(state, who).budgets.action = 1;
    const result = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: who, optionId: `spells/${id}`, targetIds: ["hero"] },
      () => 10,
    );
    assert.deepEqual(eventsOf(result.events, "refused"), [], JSON.stringify(eventsOf(result.events, "refused")));
    return result;
  };
  void dice;
  void casting;
  void refused;

  // ── Its own slots: first level, then the lowest higher one, then none ──
  {
    let state = fight();
    assert.equal(option(state, "spark")!.left, 2);
    assert.equal(option(state, "daily")!.left, 1, "a spell with uses keeps its own");
    state = cast(state, "spark").state;
    assert.equal(actor(state).uses["slot:1"], 1);
    state = cast(state, "spark").state;
    assert.equal(actor(state).uses["slot:1"], 0);
    assert.equal(option(state, "spark")!.left, 1, "a 2nd-level slot left");
    state = cast(state, "spark").state;
    assert.equal(actor(state).uses["slot:2"], 0);
    assert.equal(option(state, "spark"), undefined, "no slot left");
    assert.equal(option(state, "scaled"), undefined, "no 3rd-level slot at all");
    assert.ok(option(state, "daily"), "uses of its own still");
  }

  // ── Its own numbers ──
  {
    const state = fight();
    const dryad = actor(state);
    assert.equal(dryad.actions.find((one) => one.id === "spells/bolt")!.toHit, 3);
    assert.equal(dryad.actions.find((one) => one.id === "spells/save")!.saveDifficulty, 11);
    assert.equal(dryad.actions.find((one) => one.id === "spells/bolt")!.saveDifficulty, 14, "the trait's");
  }

  // ── A coven's one pool ──
  {
    const covenRules = parsedOrThrow(
      fiveE((doc) => {
        casting(doc).coven = { id: "sisters", size: 3, within: 30 };
        casting(doc).spells[0].coven = true;
      }),
    );
    let state = fight(covenRules, 3);
    state = cast(state, "spark", covenRules, "dryad").state;
    state = cast(state, "spark", covenRules, "sister1").state;
    assert.equal(state.covenUses!["sisters/slot:1"], 0);
    assert.equal(option(state, "spark", covenRules, "sister2")!.left, 1, "the coven's 2nd-level slot");
    state = cast(state, "spark", covenRules, "sister2").state;
    assert.equal(option(state, "spark", covenRules, "dryad"), undefined, "the coven's slots are spent");
    assert.equal(actor(state).uses["slot:1"], 2, "her own slots, for spells outside the coven, untouched");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's spell slots or a spell of its trait with its own numbers (spellcasting.slots, spells[].saveDifficulty) requires schemaVersion 2 and capabilityApi 1.642 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(641) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(642) as never, fiveE()), gate);
  }

  console.log("Hag covens: creature spell slots, shared by a coven, and spells at their own numbers; gated at 1.642.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
