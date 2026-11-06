/**
 * Who understands whom (Capability API 1.561): 5e's Suggestion and Command.
 *
 *   - `combat.languages` reads a character's languages off a sheet list; a creature names its own.
 *   - `targetTypes.understands` keeps out a creature that shares no language with its user; one whose
 *     languages are not written down is not kept out.
 *   - Refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-languages-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 561);
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
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.languages = { list: "proficiencies", column: "name", prefix: "Languages: " };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(spell)] });
    edit(doc);
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
  const definition = parsed(document());
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
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "bard",
        name: "Bard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 18 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha", slots_max_1: 4 },
          lists: {
            spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            proficiencies: [{ name: "Languages: Common" }, { name: "Thieves' Tools" }, { name: "languages: elvish" }],
          },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      { id: "orc", name: "Orc", side: "enemy", block: creature(["Common", "Orc"]) },
      { id: "demon", name: "Demon", side: "enemy", block: creature(["Abyssal"]) },
      { id: "beast", name: "Beast", side: "enemy", block: creature() },
    ],
  });
  state.order = ["bard", "orc", "demon", "beast"];
  state.turn = 0;

  // ── Languages read ──
  assert.deepEqual(rulesetLanguages(definition, rulesetCombatant(state, "bard")!), ["common", "elvish"]);
  assert.deepEqual(rulesetLanguages(definition, rulesetCombatant(state, "demon")!), ["abyssal"]);
  assert.equal(rulesetLanguages(definition, rulesetCombatant(state, "beast")!), undefined);

  // ── Only who understands ──
  const option = rulesetCombatOptions(definition, state, "bard").find((one) => one.label === "Suggestion");
  assert.ok(option, "offered");
  assert.deepEqual(
    rulesetOptionTargets(definition, state, "bard", option!).sort(),
    ["beast", "orc"],
    "not the demon, who shares no language; the beast's are not written down",
  );

  // ── Refusals ──
  refused(
    document((doc) => (doc.combat.languages.list = "nonsense")),
    /Unknown list "nonsense"/,
  );
  refused(
    document((doc) => (doc.combat.languages.column = "nonsense")),
    /"proficiencies" has no column "nonsense"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with languages read in a fight (combat.languages, a creature's languages, targetTypes.understands) requires schemaVersion 2 and capabilityApi 1.561 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(560) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(561) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(560) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Languages: read off a sheet list and a stat block; Suggestion passes over a creature that shares no language, not one whose languages are unwritten; gated at 1.561.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
