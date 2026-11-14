/** Conditions applied only while the applier's sheet allows (Capability API 1.167): Rage's damage
 *  bonus by barbarian level, read off whoever applies it as it goes on. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-applies-when-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 162);
  const text = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const level = { field: "level" };
  const bonus = (step: number, bounds: { atLeast?: number; atMost?: number }) => ({
    condition: `raging_damage_${step}`,
    duration: { rounds: 10 },
    when: { value: level, ...bounds },
  });
  const rage = {
    id: "rage",
    label: "Rage",
    rows: [{ list: "spells", values: { name: "Rage", level: 0, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "action",
      applies: [
        { condition: "raging", duration: { rounds: 10 } },
        bonus(2, { atMost: 8 }),
        bonus(3, { atLeast: 9, atMost: 15 }),
        bonus(4, { atLeast: 16 }),
      ],
    },
  };
  const document = (entries: unknown[] = [rage], mutate?: (doc: any) => void) => {
    const doc = JSON.parse(text);
    doc.sheet.live.conditions.push(
      { id: "raging", label: "Raging" },
      { id: "raging_damage_2", label: "Rage damage +2" },
      { id: "raging_damage_3", label: "Rage damage +3" },
      { id: "raging_damage_4", label: "Rage damage +4" },
    );
    doc.combat.conditions.push({ condition: "raging", modifiers: [{ to: "defense", flat: 1 }] });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      units: { distance: { label: "ft", perCell: 5 } },
      entries,
    });
    mutate?.(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = parse(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;

  const fight = (at: number) => {
    const entries = [rage] as RulesetCatalogEntry[];
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 40, defense: 12, initiativeModifier: -20, speed: 30, actions: [] },
        },
        {
          id: "barbarian",
          name: "Barbarian",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 30, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: at, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: [Array(10).fill("plains")], elevation: [Array(10).fill(0)] },
        placements: { foe: { x: 1, y: 0 }, barbarian: { x: 3, y: 0 } },
      },
    });
  };
  const raged = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "barbarian").find((one) => one.label === "Rage");
    assert.ok(option, "Rage is offered");
    const after = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "barbarian", optionId: option.id, targetIds: ["barbarian"] },
      () => 10,
    ).state;
    return rulesetCombatConditions(definition, rulesetCombatant(after, "barbarian")!)
      .filter((condition) => condition.startsWith("raging"))
      .sort();
  };

  // One bonus, by level; the condition without `when` always goes on.
  {
    for (const [at, step] of [
      [1, 2],
      [8, 2],
      [9, 3],
      [15, 3],
      [16, 4],
      [20, 4],
    ] as const) {
      assert.deepEqual(raged(fight(at)), ["raging", `raging_damage_${step}`], `level ${at} rages for +${step}`);
    }
    // Read as it applies, not when the fight began.
    const later = fight(3);
    const sheet = rulesetCombatant(later, "barbarian")!.sheet!;
    sheet.build = { ...sheet.build, fields: { ...sheet.build.fields, level: 12 } };
    assert.deepEqual(raged(later), ["raging", "raging_damage_3"], "a level gained mid-fight counts");
  }

  // Import refusals.
  {
    const refused = (doc: unknown, pattern: RegExp) => {
      const result = parse(doc);
      assert.ok(!result.ok, `must refuse ${pattern}`);
      assert.match(result.issues.join("; "), pattern);
    };
    const with_ = (when: unknown) => {
      const entry = structuredClone(rage);
      (entry.mechanics.applies[1] as Record<string, unknown>).when = when;
      return document([entry]);
    };
    refused(with_({ value: level }), /"when" says at least one of "atLeast" and "atMost"/);
    refused(with_({ value: level, atLeast: 9, atMost: 8 }), /never applied/);
    refused(with_({ value: { field: "no_such_field" }, atLeast: 1 }), /no_such_field/);
    refused(
      document([rage], (doc) => {
        doc.combat.conditions.push({
          condition: "raging_damage_2",
          onEnd: { applies: [{ condition: "raging", duration: { rounds: 1 }, when: { value: level, atLeast: 1 } }] },
        });
      }),
      /leaves behind has no sheet/,
    );
  }

  // The gate.
  {
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
    const gate =
      "A ruleset whose conditions are applied only while the applier's sheet allows requires schemaVersion 2 and capabilityApi 1.167 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(166) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(167) as never, document()), gate);
    const plain = structuredClone(rage);
    plain.mechanics.applies = [plain.mechanics.applies[0]!] as typeof plain.mechanics.applies;
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(166) as never, document([plain])), gate);
  }

  console.log("Applied only while the applier's sheet allows: Rage's +2/+3/+4 by level, gated at 1.167.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
