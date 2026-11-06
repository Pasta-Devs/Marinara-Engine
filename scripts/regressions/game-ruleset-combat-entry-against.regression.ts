/**
 * An entry's or an item use's attack that rolls differently against some targets (Capability API
 * 1.738): 5e's Shocking Grasp, advantage at a target wearing metal.
 *
 *   - `against` on an item's `use` (and an entry's `mechanics`) reaches its attack: advantage at the
 *     knight in metal armor, none at the cultist.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetAttackMode,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-entry-against-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 738);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const metal = [{ is: { wears: { tags: ["metal"] } }, mode: "advantage" }];
  const grasp = (against: unknown = metal) => ({
    category: "gear",
    stack: 1,
    use: {
      label: "Shocking Grasp",
      kind: "attack",
      budget: "action",
      range: 5,
      attackRoll: true,
      toHit: { bonus: 5 },
      amount: { dice: "1d8" },
      damageType: "lightning",
      ...(against !== null ? { against } : {}),
    },
  });
  const document = (against: unknown = metal): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "grasp", label: "Ring of Shocking Grasp", item: grasp(against) }],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const foe = (wears?: string[]) =>
    ({
      health: 50,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      ...(wears ? { wears } : {}),
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    }) as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "hero",
        name: "Hero",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          lists: {},
        }),
        live: {},
        items: [
          {
            name: "Ring of Shocking Grasp",
            quantity: 1,
            worn: true,
            item: grasp() as unknown as RulesetCatalogItem,
            stack: { id: "st", ref: "gear/grasp" },
          },
        ],
      },
      { id: "knight", name: "Knight", side: "enemy", block: foe(["armor", "metal"]) },
      { id: "cultist", name: "Cultist", side: "enemy", block: foe() },
    ],
  });
  const hero = rulesetCombatant(state, "hero")!;
  const use = hero.actions.find((one) => one.id === "use:0");
  assert.ok(use, JSON.stringify(hero.actions.map((one) => one.id)));
  assert.deepEqual(use.against, metal);
  const mode = (target: string) =>
    rulesetAttackMode(definition, definition.combat!, hero, rulesetCombatant(state, target)!, {
      state,
      optionId: "use:0",
      action: use,
    });
  assert.equal(mode("knight"), "advantage");
  assert.equal(mode("cultist"), "normal");

  // ── Refusals ──
  for (const bad of [[{ mode: "advantage" }], [{ is: { types: ["undead"] } }], []]) {
    assert.equal(parseRulesetDefinition(document(bad)).ok, false, JSON.stringify(bad));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a catalog entry's or an item use's attack that rolls differently against some targets (mechanics.against or use.against) requires schemaVersion 2 and capabilityApi 1.738 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(737) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(738) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(737) as never, document(null)), gate);
  }

  console.log("Entry against: Shocking Grasp rolls with advantage at the knight in metal armor only; gated at 1.738.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
