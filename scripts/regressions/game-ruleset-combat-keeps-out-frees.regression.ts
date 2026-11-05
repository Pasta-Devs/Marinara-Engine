/**
 * Hallowed ground that frees whoever steps in (Capability API 1.459).
 *
 *   - A circle against fiends: the thug steps in and the imp's fear comes off it, while a charm the
 *     mage put on stays; stepping elsewhere, nothing comes off.
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
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-keeps-out-frees-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 459);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const circle = (keepsOut: Record<string, unknown>) =>
    spell("circle", "Circle", {
      kind: "utility",
      area: { shape: "burst", size: 5 },
      range: 60,
      zone: { rounds: 600, triggers: [], keepsOut },
    });
  const scare = spell("scare", "Scare", {
    kind: "debuff",
    targets: "enemy",
    range: 60,
    autoHit: true,
    applies: [{ condition: "frightened", duration: { rounds: 10 } }],
  });
  const bolt = spell("bolt", "Bolt", { kind: "attack", range: 60, amount: { flat: 1 }, damageType: "fire" });
  const against = { is: { types: ["humanoid"] }, attacksInto: "disadvantage", cantGive: ["frightened"] };
  const hallow = { is: { types: ["fiend"] }, cantGive: ["frightened"], frees: ["frightened", "charmed"] };
  const fiveE = (keepsOut: Record<string, unknown> = against): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [circle(keepsOut), scare, bolt] });
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
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
  const block = (type: string): RulesetStatBlock =>
    ({ health: 40, defense: 10, initiativeModifier: 0, speed: 30, actions: [], type }) as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const setUp = (keepsOut?: Record<string, unknown>) => {
    const definition = parsed(fiveE(keepsOut));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: (sides) => (sides === 20 ? 15 : 3),
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "thug", name: "Thug", side: "enemy", block: block("humanoid") },
        { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
      ],
      board: {
        grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
        placements: { mage: { x: 2, y: 4 }, thug: { x: 6, y: 4 }, imp: { x: 6, y: 6 } },
      },
    });
    state.order = ["mage", "thug", "imp"];
    state.turn = 0;
    const cast = (s: RulesetEncounterState, label: string, choice: Record<string, unknown>) => {
      s.turn = s.order.indexOf("mage");
      rulesetCombatant(s, "mage")!.budgets.action = 1;
      const option = rulesetCombatOptions(definition, s, "mage").find((one) => one.label === label);
      assert.ok(option, `no ${label}`);
      const step = applyRulesetCombatChoice(
        definition,
        s,
        { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
        (sides) => (sides === 20 ? 15 : 3),
      );
      assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
      return step;
    };
    return { definition, state, cast };
  };
  const walk = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    id: string,
    to: { x: number; y: number },
  ) => {
    state.turn = state.order.indexOf(id);
    rulesetCombatant(state, id)!.movementLeft = 6;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: id, optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      (sides) => (sides === 20 ? 15 : 3),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!
      .tracked.map((one) => one.condition)
      .sort();

  // ── Hallowed against fiends: the thug steps in and the imp's fear comes off ──
  {
    const { definition, state, cast } = setUp(hallow);
    // Centred on (9,4): its cells are (8..10, 3..5).
    const placed = cast(state, "Circle", { at: { x: 9, y: 4 } }).state;
    const thug = rulesetCombatant(placed, "thug")!;
    thug.tracked.push(
      { condition: "frightened", rounds: 10, source: "imp" } as never,
      { condition: "charmed", rounds: 10, source: "mage" } as never,
    );
    const stepped = walk(definition, placed, "thug", { x: 8, y: 4 });
    assert.deepEqual(holds(stepped.state, "thug"), ["charmed"], "the fiend's fear is gone; the mage's charm stays");
    assert.deepEqual(
      of(stepped.events, "condition").map((one) => [one.targetId, one.condition, one.reason]),
      [["thug", "frightened", "freed"]],
    );
    // Outside, nothing comes off.
    const still = walk(definition, structuredClone(placed), "thug", { x: 6, y: 2 });
    assert.deepEqual(holds(still.state, "thug"), ["charmed", "frightened"]);
  }

  // ── Refusals ──
  refused(fiveE({ ...hallow, frees: ["nonsense"] }), /Unknown condition "nonsense"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones free whoever steps in of what those they keep out put on them (keepsOut frees) requires schemaVersion 2 and capabilityApi 1.459 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(458) as never, fiveE(hallow)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(459) as never, fiveE(hallow)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(458) as never, fiveE()), gate);
  }

  console.log(
    "Keeps out frees: stepping into hallowed ground takes off what a kept-out fiend put on, and nothing else; gated at 1.459.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
