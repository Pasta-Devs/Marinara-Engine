/**
 * Ruleset combat: an attack list's `abilityChoices` (Capability API 1.793).
 *
 * A value of a row's ability column may stand for several abilities: the row swings with whichever
 * adds the most to hit and deals its damage with that one too (SRD 5.1 Finesse: "you can use your
 * choice of your Strength or Dexterity modifier for the attack and damage rolls"). A row that names
 * one ability, and a list that declares no choices, are read as before.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  type RulesetCombatantInput,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const text = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const variant = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const withChoices = (choices: unknown, values = ["str", "dex", "con", "int", "wis", "cha", "finesse"]) =>
  variant((doc) => {
    const list = doc.sheet.lists.find((entry: { id: string }) => entry.id === "attacks");
    list.columns.find((column: { id: string }) => column.id === "ability").values = values;
    doc.combat.attacks[0].abilityChoices = choices;
  });
const parsed = (document: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(document);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const refusal = (document: unknown): string => {
  const result = parseRulesetDefinition(document);
  assert.ok(!result.ok, "this document was supposed to be refused");
  return result.issues.join("; ");
};

const finesse = parsed(withChoices({ finesse: ["str", "dex"] }));

const rogue = (abilities: Record<string, number>, ability: string): RulesetCombatantInput => ({
  id: "pip",
  name: "Pip",
  side: "party",
  build: rulesetSheetBuildSchema.parse({
    abilities: { con: 12, int: 10, wis: 10, cha: 10, ...abilities },
    fields: { level: 1, ac: 14, speed: 30, hp_max: 10 },
    lists: {
      attacks: [{ name: "Dagger", ability, proficient: true, bonus: 0, damage: "1d4", damage_type: "piercing" }],
    },
  }),
  live: {},
  catalogs: {},
});
const sack: RulesetCombatantInput = {
  id: "sack",
  name: "Sack",
  side: "enemy",
  block: { health: 30, defense: 5, initiativeModifier: 0, actions: [] },
};
const dagger = (definition: RulesetDefinition, abilities: Record<string, number>, ability: string) => {
  const state = createRulesetEncounter({
    definition,
    seed: 7,
    combatants: [rogue(abilities, ability), sack],
    roller: () => 10,
  });
  return rulesetCombatant(state, "pip")!.actions.find((action) => action.label === "Dagger")!;
};

// The better of the two, to hit and for damage: DEX 18 over STR 10, then STR 16 over DEX 12.
{
  const nimble = dagger(finesse, { str: 10, dex: 18 }, "finesse");
  assert.equal(nimble.ability, "dex");
  assert.equal(nimble.toHit, 4 + 2, "DEX +4 and proficiency +2");
  assert.equal(nimble.damage?.flat, 4, "and DEX's +4 on the damage");
  const strong = dagger(finesse, { str: 16, dex: 12 }, "finesse");
  assert.equal(strong.ability, "str");
  assert.equal(strong.toHit, 3 + 2);
  assert.equal(strong.damage?.flat, 3);
}

// A row naming one ability keeps it, choices or not.
{
  const plain = dagger(finesse, { str: 10, dex: 18 }, "str");
  assert.equal(plain.ability, "str");
  assert.equal(plain.toHit, 0 + 2);
  assert.equal(plain.damage?.flat, 0);
}

// Refusals: an ability is not a choice of them, the abilities are the sheet's, and the value is one
// the ability column offers.
assert.match(refusal(withChoices({ str: ["str", "dex"] })), /"str" is an ability, not a choice of them/);
assert.match(refusal(withChoices({ finesse: ["str", "luck"] })), /Unknown ability "luck"/);
assert.match(
  refusal(withChoices({ finesse: ["str", "dex"] }, ["str", "dex", "con", "int", "wis", "cha"])),
  /No ability column of this list offers "finesse"/,
);
assert.match(refusal(withChoices({ finesse: ["str", "str"] })), /An ability is named twice/);

// Installing a ruleset that declares choices needs 1.793.
{
  const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-ability-choices-"));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
  try {
    const { getCapabilityPackageInstallIssue } =
      await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      }) as never;
    const ruleset = {
      combat: { attacks: [{ list: "attacks", abilityChoices: { finesse: ["str", "dex"] } }] },
    } as never;
    const issue =
      /choose the best of several abilities \(abilityChoices\) requires schemaVersion 2 and capabilityApi 1\.793/;
    assert.match(getCapabilityPackageInstallIssue(manifest(383), ruleset) ?? "", issue);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(793), ruleset) ?? "", issue);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }
}

// A number off the sheet to hit on the rows a column picks out (1.800): Archery's +2 on a bow, and
// none on a thrown dagger, which reaches up close.
{
  const archery = parsed(
    variant((doc) => {
      doc.sheet.lists
        .find((entry: { id: string }) => entry.id === "features")
        .columns.push({ id: "ranged_to_hit", label: "Ranged to hit", type: "number", min: 0, max: 10, default: 0 });
      doc.combat.attacks[0].toHit.sheetBonus = {
        value: { listSum: { list: "features", column: "ranged_to_hit" } },
        when: { column: "reach", equals: 0 },
      };
    }),
  );
  const state = createRulesetEncounter({
    definition: archery,
    seed: 7,
    roller: () => 10,
    combatants: [
      {
        id: "ira",
        name: "Ira",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
          fields: { level: 1, ac: 14, speed: 30, hp_max: 10 },
          lists: {
            features: [{ name: "Fighting Style: Archery", text: "", ranged_to_hit: 2 }],
            attacks: [
              {
                name: "Longbow",
                ability: "dex",
                proficient: true,
                damage: "1d8",
                reach: 0,
                range: 150,
                long_range: 600,
              },
              { name: "Dagger", ability: "dex", proficient: true, damage: "1d4", reach: 5, range: 20, long_range: 60 },
            ],
          },
        }),
        live: {},
        catalogs: {},
      },
      sack,
    ],
  });
  const toHit = (label: string) =>
    rulesetCombatant(state, "ira")!.actions.find((action) => action.label === label)!.toHit;
  assert.equal(toHit("Longbow"), 4 + 2 + 2, "DEX, proficiency and Archery");
  assert.equal(toHit("Dagger"), 4 + 2, "a thrown dagger takes none");
  assert.match(
    refusal(
      variant((doc) => {
        doc.combat.attacks[0].toHit.sheetBonus = { value: { const: 1 }, when: { column: "nope", equals: 0 } };
      }),
    ),
    /Unknown column "nope"/,
  );
  const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sheet-bonus-"));
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
  try {
    const { getCapabilityPackageInstallIssue } =
      await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      }) as never;
    const ruleset = {
      combat: { attacks: [{ list: "attacks", toHit: { sheetBonus: { value: { const: 2 } } } }] },
    } as never;
    const issue =
      /add a number off the sheet to hit \(toHit\.sheetBonus\) requires schemaVersion 2 and capabilityApi 1\.800/;
    assert.match(getCapabilityPackageInstallIssue(manifest(799), ruleset) ?? "", issue);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(800), ruleset) ?? "", issue);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

console.log(
  "Ruleset combat ability choices: a row's choice of abilities swings with the best, for damage too; a sheet bonus to hit on the rows a column picks out.",
);
