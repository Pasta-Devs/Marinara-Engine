/**
 * Zones that keep some kinds out, or in (Capability API 1.452).
 *
 *   - Magic Circle against humanoids: one outside cannot walk into it, though a fiend may; their
 *     attacks at whoever stands inside have disadvantage; they cannot frighten anybody inside.
 *   - Turned inward (`way: "out"`): one inside cannot walk out.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-keeps-out-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 452);
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
  const reach = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    rulesetCombatant(state, id)!.movementLeft = 6;
    return new Set(rulesetReachableCells(definition, state, id).map((cell) => `${cell.x},${cell.y}`));
  };

  // ── Magic Circle against humanoids, round the imp's ground ──
  {
    const { definition, state, cast } = setUp();
    // Centred on (9,4): its cells are (8..10, 3..5).
    const placed = cast(state, "Circle", { at: { x: 9, y: 4 } }).state;
    const thugGoes = reach(definition, placed, "thug");
    assert.ok(!thugGoes.has("9,4") && !thugGoes.has("8,4"), "the humanoid cannot walk in");
    assert.ok(thugGoes.has("11,4"), "but may walk round it");
    const impGoes = reach(definition, placed, "imp");
    assert.ok(impGoes.has("8,4"), "a fiend walks in");
    // The imp inside: the mage's attacks at it have disadvantage, and its fear does not take.
    rulesetCombatant(placed, "imp")!.x = 9;
    rulesetCombatant(placed, "imp")!.y = 4;
    assert.equal(
      rulesetAttackMode(
        definition,
        definition.combat!,
        rulesetCombatant(placed, "mage")!,
        rulesetCombatant(placed, "imp")!,
        {
          state: placed,
          optionId: "spells/bolt",
        },
      ),
      "disadvantage",
    );
    assert.equal(
      rulesetAttackMode(
        definition,
        definition.combat!,
        rulesetCombatant(placed, "mage")!,
        rulesetCombatant(placed, "thug")!,
        {
          state: placed,
          optionId: "spells/bolt",
        },
      ),
      "normal",
      "outside: as ever",
    );
    const scared = cast(structuredClone(placed), "Scare", { targetIds: ["imp"] });
    assert.deepEqual(
      of(scared.events, "condition").map((one) => [one.targetId, one.active, "reason" in one ? one.reason : undefined]),
      [["imp", false, "warded"]],
    );
    assert.ok(!rulesetCombatant(scared.state, "imp")!.tracked.some((one) => one.condition === "frightened"));
    const outside = cast(structuredClone(placed), "Scare", { targetIds: ["thug"] });
    assert.ok(rulesetCombatant(outside.state, "thug")!.tracked.some((one) => one.condition === "frightened"));
  }

  // ── Turned inward: the thug inside cannot walk out ──
  {
    const { definition, state, cast } = setUp({ is: { types: ["humanoid"] }, way: "out" });
    const placed = cast(state, "Circle", { at: { x: 6, y: 4 } }).state;
    const goes = reach(definition, placed, "thug");
    assert.ok(goes.has("7,4"), "about inside");
    assert.ok(!goes.has("8,4") && !goes.has("3,4"), "never out");
  }

  // ── Refusals ──
  refused(fiveE({ is: { types: ["dragon"] } }), /dragon/);
  refused(fiveE({ ...against, cantGive: ["nonsense"] }), /Unknown condition "nonsense"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones keep some kinds out or in (keepsOut) requires schemaVersion 2 and capabilityApi 1.452 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(451) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(452) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(451) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Keeps out: Magic Circle bars humanoids' steps in, gives their attacks into it disadvantage and keeps their fear off those inside; turned inward it holds one in; gated at 1.452.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
