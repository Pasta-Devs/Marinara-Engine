/**
 * A row that stands for another entry than the one that writes it (Capability API 1.493).
 *
 *   - Pact of the Chain writes a Find Familiar row onto the spells list that stands for the spell:
 *     the fight offers it and casts it as the spell, while the row still belongs to the feature.
 *   - Without `standsFor` the row is the feature's, which does nothing in a fight.
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
  RULESET_CATALOG_ROW_KEY,
  RULESET_STANDS_FOR_ROW_KEY,
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
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stands-for-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 493);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spells = [
    {
      id: "find-familiar",
      label: "Find Familiar",
      rows: [{ list: "spells", values: { name: "Find Familiar", level: 1, prepared: true } }],
      mechanics: {
        kind: "debuff",
        targets: "enemy",
        range: 60,
        applies: [{ condition: "watched", duration: { rounds: 10 } }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const pact = (standsFor = "spells/find-familiar") =>
    [
      {
        id: "pact-of-the-chain",
        label: "Pact of the Chain",
        rows: [
          {
            list: "spells",
            values: { name: "Find Familiar", level: 1, prepared: true },
            ...(standsFor ? { standsFor } : {}),
          },
        ],
      },
    ] as unknown as RulesetCatalogEntry[];
  const fiveE = (pacts: RulesetCatalogEntry[] = pact()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "watched", label: "watched" });
    doc.combat.conditions.push({ condition: "watched", effects: [] });
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "pacts", label: "Pacts", feeds: ["spells"], entries: structuredClone(pacts) },
    );
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
  const block = (): RulesetStatBlock =>
    ({ health: 30, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")),
  });
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (definition: RulesetDefinition, pacts: RulesetCatalogEntry[]): RulesetEncounterState => {
    const rows = rowsFromCatalogEntry("pacts", pacts[0]!).map((one) => one.row);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "warlock",
          name: "Warlock",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 },
            fields: { level: 3, ac: 13, speed: 30, hp_max: 20, spellcasting_ability: "cha" },
            lists: { spells: rows },
          }),
          live: {},
          catalogs: { spells, pacts },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { warlock: { x: 2, y: 1 }, foe: { x: 4, y: 1 } } },
    });
    state.order = ["warlock", "foe"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  // ── The row stands for the spell ──
  {
    const definition = parsed(fiveE());
    const written = rowsFromCatalogEntry("pacts", pact()[0]!)[0]!.row;
    assert.equal(written[RULESET_CATALOG_ROW_KEY], "pacts/pact-of-the-chain", "the row still belongs to the pact");
    assert.equal(written[RULESET_STANDS_FOR_ROW_KEY], "spells/find-familiar");
    const state = fight(definition, pact());
    const cast = rulesetCombatOptions(definition, state, "warlock").find((one) => one.label === "Find Familiar");
    assert.ok(
      cast,
      rulesetCombatOptions(definition, state, "warlock")
        .map((one) => one.label)
        .join(", "),
    );
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "warlock", optionId: cast.id, targetIds: ["foe"] },
      roll,
    );
    assert.deepEqual(of(taken.events, "refused"), []);
    assert.ok(
      rulesetCombatant(taken.state, "foe")!.tracked.some((one) => one.condition === "watched"),
      "cast as the spell",
    );
  }

  // ── Without it the row is the feature's, and nothing to cast ──
  {
    const definition = parsed(fiveE(pact("")));
    const state = fight(definition, pact(""));
    assert.ok(!rulesetCombatOptions(definition, state, "warlock").some((one) => one.label === "Find Familiar"));
  }

  // ── Refusals ──
  refused(fiveE(pact("nowhere/find-familiar")), /No catalog "nowhere" feeds the list "spells"/);
  refused(fiveE(pact("spells/no-such-spell")), /Catalog "spells" has no entry "no-such-spell"/);
  refused(fiveE(pact("find-familiar")), /standsFor is a <catalog>\/<entry> reference/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries write rows that stand for another entry in a fight (standsFor) requires schemaVersion 2 and capabilityApi 1.493 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(492) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(493) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(492) as never, fiveE(pact(""))), gate);
  }

  console.log(
    "Stands for: Pact of the Chain's Find Familiar row is cast as the spell while it still belongs to the pact; without standsFor it is the feature's and offers nothing; gated at 1.493.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
