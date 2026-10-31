/**
 * A condition saying what its holder understands (Capability API 1.648): 5e's Feeblemind and Tongues.
 *
 *   - `languages: "all"` on the caster: a Suggestion reaches one who shares no language with them.
 *   - `languages: "none"` on a target keeps them out; on the caster, nobody is reached; it wins over
 *     `all`.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-languages-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 648);
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
    doc.sheet.live.conditions.push(
      { id: "feebleminded", label: "Feebleminded" },
      { id: "tongued", label: "Tongues" },
      { id: "comprehending", label: "Comprehend Languages" },
    );
    doc.combat.conditions.push(
      { condition: "feebleminded", effects: [], languages: "none" },
      { condition: "tongued", effects: [], languages: "all" },
      { condition: "comprehending", effects: [], languages: "understands" },
    );
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
  const fight = () => {
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
    return state;
  };

  const reached = (holds: Record<string, string[]>) => {
    const state = fight();
    for (const [id, conditions] of Object.entries(holds)) {
      for (const condition of conditions)
        rulesetCombatant(state, id)!.tracked.push({ condition, rounds: null } as never);
    }
    const option = rulesetCombatOptions(definition, state, "bard").find((one) => one.label === "Suggestion");
    return option ? rulesetOptionTargets(definition, state, "bard", option).sort() : [];
  };

  assert.deepEqual(reached({}), ["beast", "orc"], "as before: not the demon");
  assert.deepEqual(reached({ bard: ["tongued"] }), ["beast", "demon", "orc"], "Tongues: the demon understands");
  assert.deepEqual(reached({ demon: ["tongued"] }), ["beast", "demon", "orc"], "or the demon understands all");
  assert.deepEqual(reached({ orc: ["feebleminded"] }), ["beast"], "Feeblemind: the orc understands nothing");
  assert.deepEqual(reached({ bard: ["feebleminded"] }), [], "nobody understands the bard");
  assert.deepEqual(reached({ bard: ["feebleminded", "tongued"] }), [], "none wins over all");
  // Comprehend Languages (1.734): the demon understands the bard; the bard understanding all helps
  // nobody understand her.
  assert.deepEqual(reached({ demon: ["comprehending"] }), ["beast", "demon", "orc"], "the demon comprehends");
  assert.deepEqual(reached({ bard: ["comprehending"] }), ["beast", "orc"], "comprehending is not being understood");
  assert.deepEqual(reached({ demon: ["comprehending", "feebleminded"] }), ["beast", "orc"], "none wins over it");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition saying what its holder understands (languages none or all) requires schemaVersion 2 and capabilityApi 1.648 or newer";
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
    const older = () => document((doc) => (doc.combat.conditions.at(-1).languages = "all"));
    assert.equal(getCapabilityPackageInstallIssue(manifest(647) as never, older()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(648) as never, older()), gate);
    const understands =
      "A ruleset with a condition whose holder understands every language (languages understands) requires schemaVersion 2 and capabilityApi 1.734 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(733) as never, document()), understands);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(734) as never, document()), understands);
  }

  console.log("Feeblemind and Tongues: a holder understanding nothing or everything; gated at 1.648.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
