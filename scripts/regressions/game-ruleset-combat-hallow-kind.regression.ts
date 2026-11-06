/**
 * A kind chosen inside (Capability API 1.466).
 *
 *   - Hallow's fear set on fiends as it is cast: the fiend walking in is frightened, the humanoid
 *     untouched; cast with no kind chosen, on everybody; set up before a fight with a kind.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hallow-kind-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 466);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fear = {
    conditions: ["frightened"],
    chooses: "type",
    save: { save: "cha_save", ignoresUntilLeaves: true },
  };
  const hallow = (inside: Record<string, unknown>) =>
    ({
      id: "hallow",
      label: "Hallow",
      rows: [{ list: "spells", values: { name: "Hallow", level: 1, prepared: true } }],
      mechanics: {
        kind: "utility",
        area: { shape: "burst", size: 5 },
        range: 60,
        save: { save: "cha_save", onSuccess: "negates" },
        zone: { rounds: 600, triggers: [], inside },
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (inside: Record<string, unknown> = fear): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [hallow(inside)] });
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
  const definition = parsed(fiveE());
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
  const cast = (mode?: string) => {
    const s = structuredClone(state);
    rulesetCombatant(s, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, s, "mage").find((one) => one.label === "Hallow");
    assert.ok(option, "no Hallow");
    // Centred on (9,4): its cells are (8..10, 3..5), away from everybody.
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 9, y: 4 }, ...(mode ? { mode } : {}) },
      (sides) => (sides === 20 ? 15 : 3),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step.state;
  };
  const walk = (s: RulesetEncounterState, id: string, to: { x: number; y: number }, d20: number) => {
    s.turn = s.order.indexOf(id);
    rulesetCombatant(s, id)!.movementLeft = 6;
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: id, optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      (sides) => (sides === 20 ? d20 : 3),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const frightened = (s: RulesetEncounterState, id: string) =>
    rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(s, id)!, s).some(
      (one) => one.condition === "frightened",
    );

  // ── Set on fiends as it is cast ──
  {
    const placed = cast("kind-fiend");
    assert.deepEqual(rulesetCombatant(placed, "mage")!.zones![0]!.insideIs, { types: ["fiend"] });
    assert.equal(frightened(walk(structuredClone(placed), "imp", { x: 8, y: 5 }, 2).state, "imp"), true);
    assert.equal(frightened(walk(structuredClone(placed), "thug", { x: 8, y: 4 }, 2).state, "thug"), false);
  }

  // ── No kind chosen: on everybody ──
  {
    const placed = cast();
    assert.equal(frightened(walk(structuredClone(placed), "imp", { x: 8, y: 5 }, 2).state, "imp"), true);
    assert.equal(frightened(walk(structuredClone(placed), "thug", { x: 8, y: 4 }, 2).state, "thug"), true);
  }

  // ── Set up before the fight on a kind ──
  {
    const stood = rulesetStandingAtStart(definition, state, [{ casterId: "mage", entry: "Hallow", kind: "humanoid" }]);
    assert.deepEqual(stood.skipped, []);
    assert.deepEqual(rulesetCombatant(stood.state, "mage")!.zones![0]!.insideIs, { types: ["humanoid"] });
  }

  // ── Refusals ──
  refused(fiveE({ ...fear, is: { types: ["fiend"] } }), /chosen or named in "is", not both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose zones work inside on a kind chosen as they are cast (inside chooses) requires schemaVersion 2 and capabilityApi 1.466 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(465) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(466) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(465) as never, fiveE({ conditions: ["frightened"] })),
      gate,
    );
  }

  console.log(
    "Hallow kind: its fear set on the kind chosen as it is cast, on everybody with none chosen, and on a kind set up before the fight; gated at 1.466.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
