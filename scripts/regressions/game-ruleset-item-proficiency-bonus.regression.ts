/**
 * An item that adds to its holder's proficiency bonus (Capability API 1.639): 5e's Ioun Stone of
 * Mastery, "Your proficiency bonus increases by 1 while this pale green prism orbits your head."
 *
 *   - Worn, it adds to the bonus and to everything that reads it: a trained skill and save, the spell
 *     save DC. Carried and not worn, it does nothing; two of them add once.
 *   - Refused at 0.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-proficiency-bonus-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 639);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (bonus: number = 1) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "head", label: "Head", count: 4 }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "mastery",
          label: "Ioun Stone of Mastery",
          item: { category: "gear", slots: { head: 1 }, worn: { proficiencyBonus: bonus } },
        },
      ],
    });
    return doc;
  };
  const parsed = parseRulesetDefinition(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const stone = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, spellcasting_ability: "wis" },
    skills: { athletics: "proficient" },
    saves: { wis_save: "proficient" },
  });
  const held = (worn: boolean): RulesetSheetItem =>
    ({ item: stone, quantity: 1, worn, name: "Ioun Stone of Mastery" }) as RulesetSheetItem;
  const sheet = (items: RulesetSheetItem[]) => evaluateRulesetSheetLive(definition, build, undefined, items);

  const bare = sheet([]);
  assert.equal(bare.proficiencyBonus, 3);
  const worn = sheet([held(true)]);
  assert.equal(worn.proficiencyBonus, 4);
  assert.equal(worn.derived.proficiency_bonus, 4);
  assert.equal(worn.skillMods.athletics, bare.skillMods.athletics! + 1);
  assert.equal(worn.saveMods.wis_save, bare.saveMods.wis_save! + 1);
  assert.equal(worn.derived.spell_save_dc, bare.derived.spell_save_dc! + 1);
  assert.equal(sheet([held(false)]).proficiencyBonus, 3, "carried, not worn");
  assert.equal(sheet([held(true), held(true)]).proficiencyBonus, 4, "one item's effect once");

  // ── Refused at 0 ──
  {
    const result = parseRulesetDefinition(document(0));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /proficiencyBonus/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that adds to its holder's proficiency bonus (proficiencyBonus) requires schemaVersion 2 and capabilityApi 1.639 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(638) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(639) as never, document()), gate);
  }

  console.log(
    "Ioun Stone of Mastery: worn, it adds 1 to the proficiency bonus and everything reading it; gated at 1.639.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
