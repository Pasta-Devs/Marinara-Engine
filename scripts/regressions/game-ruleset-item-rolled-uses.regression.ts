/**
 * Rolled counts of an item's own uses (Capability API 1.536).
 *
 *   - A further use's `uses.rolled`: each stack of the item has that many, rolled once and the same at
 *     every reading after, never past `max`. A Helm of Brilliance's 1d10 diamonds, a Necklace of
 *     Prayer Beads' 1d4 + 2.
 *   - A fight offers that many, a rest brings it back to the stack's own count, and a use outside a
 *     fight counts down from it.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rechargeRulesetItems,
  rulesetCombatant,
  rulesetItemBook,
  rulesetOwnUsesMax,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-rolled-uses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 536);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const light = { kind: "heal", budget: "action", amount: { dice: "1d4" } };
  const document = (edit: (item: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "worn", label: "Worn" }] };
    const helm: Record<string, any> = {
      category: "worn",
      stack: 1,
      use: { label: "Look", ...light },
      moreUses: [
        { label: "Diamond", use: { ...light }, uses: { max: 10, rolled: "1d10" } },
        {
          label: "Bead",
          use: { ...light },
          uses: { max: 6, rolled: "1d4+2", recharge: { rests: ["long"], amount: { dice: "1d6", flat: 1 } } },
        },
      ],
    };
    edit(helm);
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "helm", label: "Helm", item: helm }],
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
  const entries: Record<string, RulesetCatalogEntry[]> = {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  };
  const book = rulesetItemBook(definition, entries);
  const helm = book.itemOf("gear/helm")!.entry.item!;

  // ── Rolled once for each stack: the same every reading, within the dice and never past max ──
  {
    const counts = Array.from({ length: 40 }, (_, at) => rulesetOwnUsesMax(helm.moreUses![0]!.uses!, `st-${at}`, 1));
    assert.ok(
      counts.every((one) => one >= 1 && one <= 10),
      JSON.stringify(counts),
    );
    assert.ok(new Set(counts).size > 3, "different stacks come up differently");
    assert.equal(rulesetOwnUsesMax(helm.moreUses![0]!.uses!, "st-7", 1), counts[7], "and each the same again");
    const beads = Array.from({ length: 40 }, (_, at) => rulesetOwnUsesMax(helm.moreUses![1]!.uses!, `st-${at}`, 2));
    assert.ok(
      beads.every((one) => one >= 3 && one <= 6),
      JSON.stringify(beads),
    );
    assert.equal(rulesetOwnUsesMax({ max: 4 }, "st-1", 1), 4, "nothing rolled, its max");
  }

  // ── A fight offers the stack's own count ──
  {
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
    });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          items: [
            {
              item: helm,
              quantity: 1,
              name: "Helm",
              worn: true,
              stack: { id: "st-7", ref: "gear/helm" },
            } as RulesetSheetItem,
          ],
        },
      ],
    });
    const diamond = rulesetCombatant(state, "hero")!.actions.find((one) => one.id === "use:0:1");
    assert.equal(diamond?.itemUse?.ownUses?.max, rulesetOwnUsesMax(helm.moreUses![0]!.uses!, "st-7", 1));
  }

  // ── A rest brings it back to the stack's own count ──
  {
    const most = rulesetOwnUsesMax(helm.moreUses![1]!.uses!, "st-3", 2);
    const stacks: GameInventoryStack[] = [
      { id: "st-3", name: "Helm", item: "gear/helm", quantity: 1, equipped: true, usesLeft: { "2": 0 } },
    ];
    const back = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks,
      holder: undefined,
      rest: "long",
      roll: () => 6,
    });
    assert.deepEqual(back.recharged, [{ item: "Helm: Bead", now: most, max: most, uses: true }]);
    assert.equal(back.stacks[0]!.usesLeft, undefined, "full again reads as full");
  }

  // ── Refusals ──
  refused(
    document((item) => (item.moreUses[0].uses.rolled = "2d10")),
    /A rolled count never comes up past its max, so max is its most/,
  );
  refused(
    document((item) => (item.moreUses[0].uses.rolled = "ten")),
    /Dice look like 2d6 or 1d8\+3/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item's further use whose count is rolled for each item (moreUses uses rolled) requires schemaVersion 2 and capabilityApi 1.536 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(535) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(536) as never, document()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(535) as never,
        document((item) => item.moreUses.forEach((more: any) => delete more.uses.rolled)),
      ),
      gate,
    );
  }

  console.log(
    "Item rolled uses: a further use's count rolled once for each stack (a Helm of Brilliance's 1d10 diamonds, Prayer Beads' 1d4+2), the same at every reading, offered in a fight and brought back to it by a rest; refusals and the gate at 1.536.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
