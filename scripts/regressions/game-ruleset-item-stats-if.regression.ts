/**
 * An item's stats for some wearers only (Capability API 1.700): the Talisman of Pure Good's "+2 to
 * spell attack rolls" for a good cleric or paladin, any other wearer getting nothing of it.
 *
 *   - Worn by a cleric or a paladin, the stat reads 2 more; by a fighter, nothing more; carried, nothing.
 *   - Two lines met add up; the item's own stat is added to.
 *   - In a fight the held item carries the added stat.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-stats-if-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 700);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const holy = {
    needs: [
      { value: { field: "cleric_level" }, atLeast: 1 },
      { value: { field: "paladin_level" }, atLeast: 1 },
    ],
    needsAny: true,
    add: { spell_attack_bonus: 2 },
  };
  const fiveE = (statsIf: unknown[] = [holy], stats: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.fields.push(
      { id: "cleric_level", label: "Cleric level", type: "number", default: 0, min: 0, max: 20 },
      { id: "paladin_level", label: "Paladin level", type: "number", default: 0, min: 0, max: 20 },
    );
    doc.sheet.derived.push({
      id: "item_spell_attack",
      label: "Item spell attack",
      op: "sum",
      of: [{ itemStat: { stat: "spell_attack_bonus", from: "worn", pick: "sum", default: 0 } }],
    });
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      slots: [{ id: "neck", label: "Neck", count: 1 }],
      stats: [
        { id: "spell_attack_bonus", label: "Spell attack", type: "number", min: 0, max: 10 },
        { id: "note", label: "Note", type: "text", maxLength: 40 },
      ],
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "talisman",
          label: "Talisman of Pure Good",
          item: { category: "gear", slots: { neck: 1 }, stats, statsIf },
        },
      ],
    });
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
  const build = (fields: Record<string, number>) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 30, ...fields },
    });
  const read = (definition: RulesetDefinition, fields: Record<string, number>, worn = true) => {
    const talisman: RulesetSheetItem = {
      item: definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!,
      quantity: 1,
      worn,
      name: "Talisman of Pure Good",
      stack: { id: "st-talisman", ref: "kit/talisman" },
    };
    return {
      talisman,
      bonus: evaluateRulesetSheetLive(definition, build(fields), {}, [talisman]).derived.item_spell_attack,
    };
  };

  // ── For a cleric or a paladin, worn ──
  {
    const definition = parsed(fiveE());
    assert.equal(read(definition, { cleric_level: 5 }).bonus, 2, "a cleric");
    assert.equal(read(definition, { paladin_level: 3 }).bonus, 2, "a paladin");
    assert.equal(read(definition, {}).bonus, 0, "a fighter");
    assert.equal(read(definition, { cleric_level: 5 }, false).bonus, 0, "carried");
  }
  // ── Two lines met add up, on the item's own stat ──
  {
    const definition = parsed(
      fiveE([holy, { needs: [{ value: { field: "cleric_level" }, atLeast: 9 }], add: { spell_attack_bonus: 1 } }], {
        spell_attack_bonus: 1,
      }),
    );
    assert.equal(read(definition, { cleric_level: 9 }).bonus, 4);
    assert.equal(read(definition, { cleric_level: 5 }).bonus, 3);
    assert.equal(read(definition, {}).bonus, 1);
  }
  // ── In a fight ──
  {
    const definition = parsed(fiveE());
    const { talisman } = read(definition, {});
    const fight = (fields: Record<string, number>) =>
      createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build: build(fields), live: {}, items: [talisman] },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
          },
        ],
      }).combatants[0]!.sheet!.items![0]!.item.stats?.spell_attack_bonus;
    assert.equal(fight({ paladin_level: 2 }), 2);
    assert.equal(fight({}), undefined);
  }

  // ── Refused ──
  refused(fiveE([{ ...holy, add: { luck: 1 } }]), /Unknown stat "luck"/);
  refused(fiveE([{ ...holy, add: { note: 1 } }]), /"note" is not a number stat/);
  refused(fiveE([{ ...holy, add: {} }]), /A line adds to 1 to 12 stats/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item's stats added to while its wearer meets what it asks (statsIf) requires schemaVersion 2 and capabilityApi 1.700 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(699) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(700) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(699) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Item stats for some wearers: the Talisman's +2 for a cleric or paladin only; gated at 1.700.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
