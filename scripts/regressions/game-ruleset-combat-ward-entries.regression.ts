/**
 * Wards of only some entries (Capability API 1.645).
 *
 *   - `where`: Mind Blank's divination spells are kept off its holder, an evocation is not.
 *   - `entries`: Wish's "immunity to a single spell" keeps that spell off, and no other.
 *   - The same on a zone's ward; what import refuses, and the install gate.
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
  rulesetSheetBuildSchema,
  rulesetWarded,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ward-entries-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 645);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, school: string, level: number) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      filters: { school, level },
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        damageType: "fire",
        range: 120,
        amount: { flat: 5 },
        cost: [{ pool: `slots_${level}`, amount: 1 }],
      },
    }) as unknown as RulesetCatalogEntry;
  const spells = [spell("bolt", "evocation", 1), spell("scry", "divination", 1), spell("great", "evocation", 7)];
  const document = (wards: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "warded", label: "Warded" });
    doc.combat.conditions.push({ condition: "warded", effects: [], wards });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      filters: [
        { id: "school", label: "School", type: "text" },
        { id: "level", label: "Level", type: "number" },
      ],
      entries: spells,
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const block = (keepsOn?: string[]): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...(keepsOn ? { keepsOn } : {}),
    }) as unknown as RulesetStatBlock;
  const warded = (definition: RulesetDefinition) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 13,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_7: 1,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "seer", name: "Seer", side: "enemy", block: block(["warded"]) },
      ],
    });
    const mage = rulesetCombatant(state, "mage")!;
    const seer = rulesetCombatant(state, "seer")!;
    return (label: string) =>
      rulesetWarded(
        definition,
        state,
        mage,
        mage.actions.find((one) => one.label === label)!,
        seer,
      );
  };

  // ── Mind Blank: divination only ──
  {
    const reaches = warded(
      parsed(document({ catalogs: ["spells"], maxLevel: 9, where: { filter: "school", equals: "Divination" } })),
    );
    assert.equal(reaches("Scry"), true, "a divination is kept off");
    assert.equal(reaches("Bolt"), false, "an evocation is not");
    // The same with the spells in a catalog file of their own, as a game reads the ruleset: the
    // definition's catalog holds no entries, and the filters ride on the cast.
    const fromFile = parsed(
      document({ catalogs: ["spells"], maxLevel: 9, where: { filter: "school", equals: "Divination" } }),
    );
    delete fromFile.catalogs!.find((one) => one.id === "spells")!.entries;
    const reachesFromFile = warded(fromFile);
    assert.equal(reachesFromFile("Scry"), true, "a divination from a catalog file is kept off");
    assert.equal(reachesFromFile("Bolt"), false, "an evocation from a catalog file is not");
  }

  // ── Wish: one spell ──
  {
    const reaches = warded(parsed(document({ catalogs: ["spells"], maxLevel: 9, entries: ["spells/great"] })));
    assert.equal(reaches("Great"), true, "that spell is kept off");
    assert.equal(reaches("Bolt"), false, "no other");
  }

  // ── What import refuses ──
  {
    const result = parseRulesetDefinition(document({ catalogs: ["spells"], maxLevel: 9, entries: ["gear/bolt"] }));
    assert.ok(!result.ok);
    assert.match(result.issues.join("; "), /not of a catalog this ward names/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a ward of only some entries (wards.where, wards.entries) requires schemaVersion 2 and capabilityApi 1.645 or newer";
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
    const doc = () => document({ catalogs: ["spells"], maxLevel: 9, entries: ["spells/great"] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(644) as never, doc()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(645) as never, doc()), gate);
  }

  console.log(
    "Ward entries: Mind Blank keeps divination off, Wish one spell; a ward's entries are of its catalogs; gated at 1.645.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
