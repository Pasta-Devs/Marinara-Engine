/**
 * A zone moved on a check that a talisman helps with (Capability API 1.703): 5e's Talisman of the
 * Sphere, "you double your proficiency bonus on the check ... levitate it 10 feet plus a number of
 * additional feet equal to 10 × your Intelligence modifier".
 *
 *   - Without the talisman the wizard's 10 + 4 falls short of 18; holding it, 10 + 4 + 4 meets it.
 *   - Not yet in control, as far as 5 × Intelligence modifier; in control, 10 + 10 × it.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_ZONE_CHECK_OPTION_PREFIX,
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
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sphere-talisman-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 703);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const check = {
    check: "arcana",
    difficulty: 18,
    within: 60,
    distanceBy: { abilityMod: "int", times: 5, atLeast: 5 },
    holding: {
      tags: ["sphere_talisman"],
      adds: { derived: "proficiency_bonus" },
      distanceBy: { abilityMod: "int", times: 10, add: 10 },
    },
  };
  const document = (moveCheck: Record<string, unknown> = check) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push({ id: "arcana", label: "Arcana", value: { abilityMod: "int" } });
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      slots: [{ id: "hands", label: "Hands", count: 2 }],
      tags: [{ id: "sphere_talisman", label: "Talisman of the Sphere" }],
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "talisman",
          label: "Talisman of the Sphere",
          item: { category: "gear", slots: { hands: 1 }, tags: ["sphere_talisman"] },
        },
      ],
    });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sphere",
          label: "Sphere",
          rows: [{ list: "spells", values: { name: "Sphere", level: 5, prepared: true } }],
          mechanics: {
            kind: "attack",
            area: { shape: "burst", size: 5 },
            range: 60,
            amount: { dice: "4d10" },
            damageType: "force",
            save: { save: "dex_save", onSuccess: "negates" },
            zone: {
              rounds: 100,
              outlasts: true,
              triggers: ["enter"],
              atCast: false,
              move: { budget: "action", distance: 5, check: moveCheck },
            },
          },
        },
      ],
    });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const talisman = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const fight = (holding: boolean) => {
    const items: RulesetSheetItem[] = holding
      ? [
          {
            item: talisman,
            quantity: 1,
            worn: true,
            name: "Talisman of the Sphere",
            stack: { id: "st-t", ref: "kit/talisman" },
          },
        ]
      : [];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
            lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
          items,
        },
      ],
      board: {
        grid: { width: 30, height: 9, tiles: Array.from({ length: 9 }, () => Array(30).fill("plains")) },
        placements: { wizard: { x: 2, y: 4 } },
      },
    } as never);
    state.order = ["wizard"];
    state.turn = 0;
    const castOption = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Sphere");
    assert.ok(castOption, "offered");
    const cast = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: castOption.id, targetIds: [], at: { x: 10, y: 4 } },
      () => 10,
    );
    assert.deepEqual(of(cast.events, "refused"), []);
    return cast.state;
  };
  const move = (from: RulesetEncounterState) => {
    const turn = structuredClone(from);
    rulesetCombatant(turn, "wizard")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, turn, "wizard").find((one) =>
      one.id.startsWith(RULESET_ZONE_CHECK_OPTION_PREFIX),
    );
    assert.ok(option, "may try to move it");
    const zone = rulesetCombatant(turn, "wizard")!.zones![0]!;
    const reach = Math.max(
      ...option.cells!.map((cell) => Math.max(Math.abs(cell.x - zone.at!.x), Math.abs(cell.y - zone.at!.y))),
    );
    const to = option.cells!.reduce((far, cell) => (cell.x > far.x ? cell : far));
    const step = applyRulesetCombatChoice(
      definition,
      turn,
      { actorId: "wizard", optionId: option.id, targetIds: [], to },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return { reach, contest: of(step.events, "contest")[0]!, state: step.state };
  };

  // ── Without the talisman: 10 + 4 against 18 ──
  {
    const bare = move(fight(false));
    assert.equal(bare.contest.attacker.total, 14);
    assert.equal(bare.contest.winner, "target");
  }
  // ── Holding it: 10 + 4 + 4 meets 18; 5 × 4 = 20 feet the first time, 10 + 10 × 4 = 50 once in control ──
  {
    const first = move(fight(true));
    assert.equal(first.contest.attacker.total, 18);
    assert.equal(first.contest.winner, "actor");
    assert.equal(first.reach, 4);
    assert.equal(rulesetCombatant(first.state, "wizard")!.zones![0]!.heldBy, "wizard");
    const again = move(first.state);
    assert.equal(again.reach, 10, "in control, the talisman's reach");
  }

  // ── Refused ──
  refused(document({ ...check, holding: { tags: ["sphere_talisman"] } }), /Holding it does something/);
  refused(document({ ...check, holding: { tags: ["amulet"], advantage: true } }), /Unknown item tag "amulet"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone moved on a check that a mover holding something does better (zone.move.check.holding) requires schemaVersion 2 and capabilityApi 1.703 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(702) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(703) as never, document()), gate);
    const { holding: _holding, ...plain } = check;
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(702) as never, document(plain)), gate);
  }

  console.log("Talisman of the Sphere: its proficiency on the check, and its reach once in control; gated at 1.703.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
