/**
 * Several languages in one row, and a sheet with none written down (Capability API 1.589).
 *
 *   - `combat.languages.split`: 5e's `[", ", " and "]`, so "Languages: Common and Dwarvish" names two.
 *   - A sheet with no language row has its languages unwritten: Suggestion keeps nobody out for it.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLanguages,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-language-split-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 589);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = {
    id: "suggestion",
    label: "Suggestion",
    rows: [{ list: "spells", values: { name: "Suggestion", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      budget: "action",
      range: 30,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "charmed", duration: { rounds: 10 } }],
      targetTypes: { understands: true },
    },
  };
  const document = (split = true): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.languages = {
      list: "proficiencies",
      column: "name",
      prefix: "Languages: ",
      ...(split ? { split: [", ", " and "] } : {}),
    };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(spell)] });
    return doc;
  };
  const result = parseRulesetDefinition(document());
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const creature = (languages?: string[]): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      ...(languages ? { languages } : {}),
      actions: [],
    }) as unknown as RulesetStatBlock;
  const caster = (id: string, proficiencies: Record<string, string>[]) => ({
    id,
    name: id,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 18 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha", slots_max_1: 4 },
      lists: {
        spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
        proficiencies,
      },
    }),
    live: {},
    catalogs: { spells: entries },
  });
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      caster("dwarf", [{ name: "Languages: Common and Dwarvish" }, { name: "Languages: Elvish, Gnomish and Goblin" }]),
      caster("stranger", [{ name: "Thieves' Tools" }]),
      { id: "goblin", name: "Goblin", side: "enemy", block: creature(["Goblin"]) },
      { id: "demon", name: "Demon", side: "enemy", block: creature(["Abyssal"]) },
    ],
  });
  state.order = ["dwarf", "stranger", "goblin", "demon"];
  state.turn = 0;

  // ── Split rows ──
  assert.deepEqual(rulesetLanguages(definition, rulesetCombatant(state, "dwarf")!), [
    "common",
    "dwarvish",
    "elvish",
    "gnomish",
    "goblin",
  ]);
  const targets = (who: string) => {
    state.turn = state.order.indexOf(who);
    const option = rulesetCombatOptions(definition, state, who).find((one) => one.label === "Suggestion");
    assert.ok(option, `offered to the ${who}`);
    return rulesetOptionTargets(definition, state, who, option!).sort();
  };
  assert.deepEqual(targets("dwarf"), ["goblin"], "the dwarf reaches the goblin through Goblin, not the demon");

  // ── No language row: unwritten, keeping nobody out ──
  assert.equal(rulesetLanguages(definition, rulesetCombatant(state, "stranger")!), undefined);
  assert.deepEqual(targets("stranger"), ["demon", "goblin"], "unwritten languages keep nobody out");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with several languages in one row (combat.languages.split) requires schemaVersion 2 and capabilityApi 1.589 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(588) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(589) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(588) as never, document(false)), gate);
  }

  console.log(
    "Language split: one row names several languages; a sheet with none written down keeps nobody out; gated at 1.589.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
