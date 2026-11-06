/**
 * A condition kept on only while a sheet value reads above zero (Capability API 1.653): 5e's Holy
 * Avenger aura, 30 feet from paladin level 17, and Aura of Protection's from level 18.
 *
 *   - An item's worn `keepsOn` line with a `when`: on while it reads above zero, off otherwise; a
 *     plain line stays on.
 *   - A sheet entry's `keepsOn` line with a `when`, read as the fight begins.
 *   - What import refuses, and the install gate.
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
  rulesetCombatConditions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-kept-when-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 653);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (when: Record<string, unknown> = { abilityMod: "cha" }, condition = "aura_wide") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "aura_wide", label: "Wide Aura" }, { id: "aura_near", label: "Near Aura" });
    doc.combat.conditions.push({ condition: "aura_wide", effects: [] }, { condition: "aura_near", effects: [] });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "aura",
          label: "Aura of Protection",
          rows: [{ list: "spells", values: { name: "Aura of Protection", level: 0, prepared: true } }],
          mechanics: { kind: "utility", keepsOn: [{ condition, when }, "aura_near"] },
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
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const fight = (cha: number, rows: boolean) =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "paladin",
          name: "Paladin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha },
            fields: { level: 18, ac: 18, speed: 30, hp_max: 150 },
            lists: rows
              ? { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) }
              : {},
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "orc",
          name: "Orc",
          side: "enemy",
          block: { health: 15, defense: 13, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
    });
  const held = (state: ReturnType<typeof fight>) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, "paladin")!).sort();

  // ── A sheet entry's line, read as the fight begins ──
  assert.deepEqual(held(fight(14, true)), ["aura_near", "aura_wide"], "Charisma +2: both");
  assert.deepEqual(held(fight(10, true)), ["aura_near"], "Charisma +0: the plain line only");

  // ── An item's worn line ──
  for (const [cha, expected] of [
    [14, ["aura_near", "aura_wide"]],
    [10, ["aura_near"]],
  ] as const) {
    const state = fight(cha, false);
    const paladin = rulesetCombatant(state, "paladin")!;
    paladin.sheet!.items = [
      {
        name: "Holy Avenger",
        quantity: 1,
        worn: true,
        item: {
          category: "gear",
          worn: { keepsOn: [{ condition: "aura_wide", when: { abilityMod: "cha" } }, "aura_near"] },
        },
      } as never,
    ];
    assert.deepEqual(held(state), [...expected], `Charisma ${cha}`);
  }

  // ── What import refuses ──
  refused(document({ abilityMod: "nonsense" }), /nonsense/);
  refused(document({ abilityMod: "cha" }, "nonsense"), /Unknown condition "nonsense"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition kept on only while a sheet value reads above zero (keepsOn[].when) requires schemaVersion 2 and capabilityApi 1.653 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(652) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(653) as never, document()), gate);
  }

  console.log("Kept on when: an aura kept on only while the sheet says so, from an item or an entry; gated at 1.653.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
