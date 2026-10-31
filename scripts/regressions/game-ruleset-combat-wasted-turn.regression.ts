/**
 * Wasting a turn to a condition (Capability API 1.463).
 *
 *   - Bestow Curse's wasted turn: a cursed foe failing its Wisdom save as its turn starts has no
 *     action that turn; one that makes it keeps its action.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wasted-turn-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 463);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const curse = {
    id: "curse",
    label: "Curse",
    rows: [{ list: "spells", values: { name: "Curse", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      range: 30,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "cursed", duration: { rounds: 10 } }],
    },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (wastes: Record<string, unknown> = { save: "wis_save", budget: "action" }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "cursed", label: "Cursed" });
    doc.combat.conditions.push({ condition: "cursed", effects: [], behavior: { wastes } });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [curse] });
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
  const block: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  } as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    combatants: [
      {
        id: "mage",
        name: "Mage",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
          lists: { spells: rowsFromCatalogEntry("spells", curse).map((row) => row.row) },
        }),
        catalogs: { spells: [curse] },
      },
      { id: "thug", name: "Thug", side: "enemy", block },
    ],
  });
  state.order = ["mage", "thug"];
  state.turn = 0;
  const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Curse");
  assert.ok(option, "no Curse");
  const cast = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "mage", optionId: option.id, targetIds: ["thug"] },
    roll,
  );
  assert.deepEqual(of(cast.events, "refused"), []);
  const cursed = cast.state;
  assert.ok(
    rulesetCombatant(cursed, "thug")!.tracked.some((one) => one.condition === "cursed"),
    "the curse took",
  );
  const claw = (s: RulesetEncounterState) =>
    rulesetCombatOptions(definition, s, "thug").some((one) => one.label === "Claw");

  // ── Failing its save as its turn starts, it has no action ──
  {
    const step = advanceRulesetTurn(definition, structuredClone(cursed), roll);
    assert.equal(step.state.order[step.state.turn], "thug");
    assert.deepEqual(
      of(step.events, "wasted").map((one) => [one.actorId, one.condition, one.budget]),
      [["thug", "cursed", "action"]],
    );
    assert.equal(rulesetCombatant(step.state, "thug")!.budgets.action, 0);
    assert.equal(claw(step.state), false, "no claw this turn");
  }

  // ── Making it, it keeps its action ──
  {
    const next = structuredClone(cursed);
    rulesetCombatant(next, "thug")!.saves.wis_save = 30;
    const step = advanceRulesetTurn(definition, next, roll);
    assert.deepEqual(of(step.events, "wasted"), []);
    assert.equal(rulesetCombatant(step.state, "thug")!.budgets.action, 1);
    assert.equal(claw(step.state), true);
  }

  // ── Refusals ──
  refused(fiveE({ save: "nope", budget: "action" }), /Unknown save "nope"/);
  refused(fiveE({ save: "wis_save", budget: "nope" }), /Unknown budget "nope"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions waste a turn's budget on a failed save (behavior wastes) requires schemaVersion 2 and capabilityApi 1.463 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(462) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(463) as never, fiveE()), gate);
  }

  console.log(
    "Wasted turn: a cursed foe failing its save as its turn starts loses its action, one making it keeps it; gated at 1.463.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
