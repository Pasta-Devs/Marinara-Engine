/**
 * What an item asks of its bearer or user (Capability API 1.667): 5e's attunement "by a cleric", a
 * spell scroll read only by a class whose list has the spell, and the rogue's Use Magic Device, "you
 * ignore all class, race, and level requirements on the use of magic items".
 *
 *   - Bound by somebody whose sheet does not meet its `binds.needs`, an item reads as not worn: its
 *     worn effect does not count, in a fight or out of one.
 *   - An item with `userNeeds` is not used by somebody who does not meet them: refused out of a
 *     fight, not offered in one.
 *   - `items.needsWaivedBy` above zero waives both.
 *   - The install gate.
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
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-needs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 667);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // A cleric's level, and Use Magic Device, read off two fields of the sheet.
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.fields.push(
      { id: "cleric_level", label: "Cleric level", type: "number", default: 0, min: 0, max: 20 },
      { id: "use_magic_device", label: "Use Magic Device", type: "number", default: 0, min: 0, max: 1 },
    );
    doc.sheet.derived.push({
      id: "worn_ward",
      label: "Worn ward",
      op: "sum",
      of: [{ itemStat: { stat: "ward", from: "worn", pick: "sum", default: 0 } }],
    });
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      slots: [{ id: "neck", label: "Neck", count: 1 }],
      stats: [{ id: "ward", label: "Ward", type: "number", min: 0, max: 10 }],
      binding: { label: "Attunement", max: { const: 3 } },
      needsWaivedBy: { field: "use_magic_device" },
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "talisman",
          label: "Talisman of Pure Good",
          item: {
            category: "gear",
            slots: { neck: 1 },
            binds: { needs: [{ value: { field: "cleric_level" }, atLeast: 1 }] },
            stats: { ward: 2 },
          },
        },
        {
          id: "scroll",
          label: "Scroll of Cure Wounds",
          item: {
            category: "gear",
            userNeeds: [{ value: { field: "cleric_level" }, atLeast: 1 }],
            use: {
              kind: "heal",
              budget: "action",
              label: "Read",
              targets: "self",
              amount: { dice: "1d8" },
              consumes: true,
            },
          },
        },
      ],
    });
    return doc;
  };
  const result = parseRulesetDefinition(fiveE());
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const entries = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries);
  const kit = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries!;
  const build = (fields: Record<string, number>) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 30, ...fields },
    });
  const talisman: RulesetSheetItem = {
    item: kit[0]!.item!,
    quantity: 1,
    worn: true,
    name: "Talisman of Pure Good",
    stack: { id: "st-talisman", ref: "kit/talisman" },
  };
  const ac = (fields: Record<string, number>) =>
    evaluateRulesetSheetLive(definition, build(fields), {}, [talisman]).derived.worn_ward;
  const cleric = { cleric_level: 5 };
  const fighter = { cleric_level: 0 };
  const rogue = { cleric_level: 0, use_magic_device: 1 };

  // ── Bound: its worn effect counts only for a sheet that meets what it asks, or waives it ──
  const without = 0;
  assert.equal(ac(cleric), without + 2, "a cleric");
  assert.equal(ac(fighter), without, "not a cleric");
  assert.equal(ac(rogue), without + 2, "Use Magic Device");

  // ── In a fight, the same ──
  {
    const fight = (fields: Record<string, number>, items: RulesetSheetItem[]) =>
      createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build: build(fields), live: {}, items },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
          },
        ],
      });
    const worn = (fields: Record<string, number>) => fight(fields, [talisman]).combatants[0]!.sheet!.items![0]!.worn;
    assert.equal(worn(cleric), true);
    assert.equal(worn(fighter), false);
    assert.equal(worn(rogue), true);
    const scroll: RulesetSheetItem = {
      item: kit[1]!.item!,
      quantity: 1,
      worn: false,
      name: "Scroll of Cure Wounds",
      stack: { id: "st-scroll", ref: "kit/scroll" },
    };
    const offered = (fields: Record<string, number>) => {
      const state = fight(fields, [scroll]);
      state.order = ["hero", "foe"];
      state.turn = 0;
      return rulesetCombatOptions(definition, state, "hero").some((one) => /Scroll of Cure Wounds/.test(one.label));
    };
    assert.equal(offered(cleric), true, "a cleric reads it");
    assert.equal(offered(fighter), false, "nobody else");
    assert.equal(offered(rogue), true, "Use Magic Device");
  }

  // ── Out of a fight: read only by a cleric, or with Use Magic Device ──
  {
    const read = (fields: Record<string, number>) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks: [{ id: "st-scroll", name: "Scroll of Cure Wounds", item: "kit/scroll", quantity: 1 }],
        stackId: "st-scroll",
        user: { name: "Hero", build: build(fields), live: {} },
        roll: () => 4,
      });
    assert.equal(read(cleric).ok, true);
    const refused = read(fighter);
    assert.equal(refused.ok, false);
    assert.equal(!refused.ok && refused.reason, "needs-unmet");
    assert.equal(read(rogue).ok, true);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items ask something of their bearer or user (binds.needs, userNeeds or items.needsWaivedBy) requires schemaVersion 2 and capabilityApi 1.667 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(666) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(667) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(666) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item needs: a talisman bound by a non-cleric reads as not worn, a cleric's scroll is read by clerics alone, and Use Magic Device waives both; gated at 1.667.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
