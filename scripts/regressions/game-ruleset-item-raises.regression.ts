/**
 * Abilities an item raises for good (Capability API 1.516).
 *
 *   - A Manual of Gainful Exercise read outside a fight: Strength +2 and its most +2, kept in the
 *     live state, so the sheet reads it past the ruleset's own 20 when the ruleset's most is 20.
 *   - A fight never offers it.
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
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetItemUseLine,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-raises-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 516);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const manual = (use: Record<string, unknown> = {}) => ({
    category: "book",
    use: {
      label: "Study",
      kind: "buff",
      targets: "self",
      budget: "action",
      consumes: true,
      raises: { str: { by: 2, max: 2 } },
      ...use,
    },
  });
  const document = (use: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    // A most of 20, as 5e's player characters have.
    doc.sheet.abilities.find((one: { id: string }) => one.id === "str").max = 20;
    doc.items = { categories: [{ id: "book", label: "Book" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "manual", label: "Manual of Gainful Exercise", item: manual(use) }],
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
  const entriesOf = (one: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (one.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const book = rulesetItemBook(definition, entriesOf(definition));
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });

  // ── Read outside a fight: +2 Strength past 20, for good ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "m", name: "Manual of Gainful Exercise", item: "gear/manual", quantity: 1 },
    ];
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks,
      stackId: "m",
      user: { name: "Ada", build, live: {} },
      roll: () => 1,
    });
    assert.ok(used.ok, JSON.stringify(used));
    if (used.ok) {
      assert.deepEqual(used.live.abilities, { str: { score: 2, max: 2 } });
      assert.equal(evaluateRulesetSheetLive(definition, build, used.live).abilityScores.str, 22, "past 20");
      assert.equal(evaluateRulesetSheetLive(definition, build, {}).abilityScores.str, 20, "without it");
      assert.equal(used.stacks.length, 0, "the manual is used up");
      assert.match(rulesetItemUseLine(used.said), /raises Strength by 2 for good \(22\)/);
      // A second manual: 24, its most 24.
      const again = useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks,
        stackId: "m",
        user: { name: "Ada", build, live: used.live },
        roll: () => 1,
      });
      assert.ok(again.ok);
      if (again.ok) assert.equal(evaluateRulesetSheetLive(definition, build, again.live).abilityScores.str, 24);
    }
    // A raise past the most without raising it stops at the most.
    const low = parsed(document({ raises: { str: { by: 2 } } }));
    const lowBook = rulesetItemBook(low, entriesOf(low));
    const capped = useRulesetItemOutsideFight({
      definition: low,
      itemOf: lowBook.itemOf,
      stacks,
      stackId: "m",
      user: { name: "Ada", build, live: {} },
      roll: () => 1,
    });
    assert.ok(capped.ok);
    if (capped.ok) assert.equal(evaluateRulesetSheetLive(low, build, capped.live).abilityScores.str, 20);
  }

  // ── A fight never offers it ──
  {
    const item = book.itemOf("gear/manual")!.entry.item!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          items: [{ item, quantity: 1, worn: false, name: "Manual" } as RulesetSheetItem],
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    assert.ok(!rulesetCombatOptions(definition, state, "hero").some((one) => one.label.includes("Study")));
  }

  // ── Refusals ──
  refused(document({ raises: { luck: { by: 2 } } }), /Unknown ability "luck"/);
  refused(document({ targets: "ally" }), /targets "self"/);
  refused(document({ kind: "heal" }), /targets "self"/);
  refused(document({ raises: { str: { by: 0 } } }), /raises/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items raise their user's abilities for good (an item use's raises) requires schemaVersion 2 and capabilityApi 1.516 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(515) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(516) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(515) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item raises: a Manual of Gainful Exercise raises Strength and its most by 2 for good outside a fight, never offered in one; gated at 1.516.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
