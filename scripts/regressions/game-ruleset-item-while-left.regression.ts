/**
 * What an item does only while something of it is left (Capability API 1.732): a Helm of Brilliance.
 *
 *   - An item effect's `whileLeft` lines name its parts that hold only while the item has charges
 *     left, or while a further use counting its own uses (1.519) has any.
 *   - On the sheet read as the stack keeps them; in a fight as the fight spends them.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHide,
  rulesetHeldItemDoes,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-while-left-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 732);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const helm = (
    whileLeft: unknown = [
      { keys: ["resist"], uses: "Wall of Fire" },
      { keys: ["keepsOn"], charges: true },
    ],
  ): Record<string, unknown> => ({
    category: "gear",
    stack: 1,
    slots: { head: 1 },
    charges: { max: 10 },
    worn: { resist: ["fire"], keepsOn: ["brilliance"], whileLeft },
    use: { kind: "attack", budget: "action", autoHit: true, amount: { flat: 4 }, damageType: "radiant", charges: 1 },
    moreUses: [
      {
        label: "Wall of Fire",
        use: { kind: "attack", budget: "action", autoHit: true, amount: { flat: 6 }, damageType: "fire" },
        uses: { max: 4 },
      },
    ],
  });
  const fiveE = (item: Record<string, unknown> = helm()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "brilliance", label: "Brilliance" });
    doc.combat.conditions.push({ condition: "brilliance", effects: [] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "head", label: "Head", count: 1 }] };
    doc.catalogs.push({
      id: "wondrous",
      label: "Wondrous Items",
      holds: "items",
      entries: [{ id: "helm-of-brilliance", label: "Helm of Brilliance", item }],
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
  const definition = parsed(fiveE());
  const item = definition.catalogs!.find((one) => one.id === "wondrous")!.entries![0]!.item! as RulesetCatalogItem;
  const held = (extra: Partial<RulesetSheetItem> = {}): RulesetSheetItem =>
    ({ name: "Helm of Brilliance", quantity: 1, worn: true, item, ...extra }) as RulesetSheetItem;

  // ── On the sheet, as the stack keeps them ──
  assert.deepEqual(rulesetHeldItemDoes(held()).worn?.resist, ["fire"], "full, all of it");
  assert.deepEqual(rulesetHeldItemDoes(held({ charges: 3, usesLeft: { "0": 1 } })).worn?.keepsOn, ["brilliance"]);
  {
    const noRubies = rulesetHeldItemDoes(held({ usesLeft: { "0": 0 } })).worn!;
    assert.equal(noRubies.resist, undefined, "no ruby, no fire resistance");
    assert.deepEqual(noRubies.keepsOn, ["brilliance"], "the diamonds still light it");
    const noDiamonds = rulesetHeldItemDoes(held({ charges: 0 })).worn!;
    assert.equal(noDiamonds.keepsOn, undefined, "no diamond, no light");
    assert.deepEqual(noDiamonds.resist, ["fire"]);
  }

  // ── In a fight, as the fight spends them ──
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const fight = (extra: Partial<RulesetSheetItem> = {}) =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "hero", name: "Hero", side: "party", build, live: {}, items: [held(extra)] }],
    });
  const fire = (state: ReturnType<typeof fight>) =>
    rulesetCombatHide(definition, rulesetCombatant(state, "hero")!, state).resist.some((one) =>
      typeof one === "string" ? one === "fire" : (one as { type?: string }).type === "fire",
    );
  const lit = (state: ReturnType<typeof fight>) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, "hero")!).includes("brilliance");
  {
    const state = fight();
    assert.equal(fire(state), true);
    assert.equal(lit(state), true);
    const hero = rulesetCombatant(state, "hero")!;
    (hero.usesLeft ??= {})["0:0"] = 0;
    assert.equal(fire(state), false, "the last ruby spent in the fight");
    assert.equal(lit(state), true);
    (hero.charges ??= {})[0] = 0;
    assert.equal(lit(state), false, "the last diamond spent in the fight");
  }
  {
    const state = fight({ charges: 0, usesLeft: { "0": 0 } });
    assert.equal(fire(state), false, "spent before the fight");
    assert.equal(lit(state), false);
  }

  // ── Refusals and the install gate ──
  refused(fiveE(helm([{ keys: ["resist"] }])), /one of them/);
  refused(fiveE(helm([{ keys: ["resist"], charges: true, uses: "Wall of Fire" }])), /one of them/);
  refused(fiveE(helm([{ keys: ["light"], charges: true }])), /"light" is not something this effect does/);
  refused(fiveE(helm([{ keys: ["resist"], uses: "Prismatic Spray" }])), /No further use "Prismatic Spray"/);
  refused(fiveE({ ...helm(), charges: undefined }), /The item has no charges to hold it/);
  const gate =
    "A ruleset with an item's effect that holds only while charges or uses are left (whileLeft) requires schemaVersion 2 and capabilityApi 1.732 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(731) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(732) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(731) as never, JSON.parse(fiveEText)), gate);

  console.log(
    "Helm of Brilliance: fire resistance while a ruby is left, its light while a diamond is, on the sheet and in a fight; gated at 1.732.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
