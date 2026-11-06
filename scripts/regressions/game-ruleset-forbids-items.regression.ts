/**
 * Items a condition forbids, and more conditions by the slot (Capability API 1.525).
 *
 *   - Feeblemind's "can't ... activate magic items": a condition whose `forbids.items` names a tag
 *     keeps that item's use off the fight menu and refuses it outside a fight; an item without the
 *     tag is still used.
 *   - An entry puts on up to 12 conditions without `appliesOneOf` when each says its `paidSteps`.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  rulesetSheetItems,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-forbids-items-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 525);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const heal = { kind: "heal", targets: "self", budget: "action", amount: { dice: "1d4" } };
  const smite = (paid: boolean) => ({
    id: "smite",
    label: "Smite",
    rows: [{ list: "spells", values: { name: "Smite", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      applies: Array.from({ length: 8 }, (_, step) => ({
        condition: "feebleminded",
        duration: { rounds: 10 },
        ...(paid ? { paidSteps: { atLeast: step, atMost: step } } : {}),
      })),
    },
  });
  const document = (
    forbids: Record<string, unknown> = { items: { tags: ["magical"] } },
    paid = true,
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "feebleminded", label: "Feebleminded" });
    doc.combat.conditions.push({ condition: "feebleminded", effects: [], forbids });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], tags: [{ id: "magical", label: "Magical" }] };
    doc.catalogs.push(
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          { id: "wand", label: "Wand", item: { category: "gear", stack: 1, tags: ["magical"], use: { ...heal } } },
          { id: "salve", label: "Salve", item: { category: "gear", stack: 5, use: { ...heal } } },
        ],
      },
      { id: "smites", label: "Smites", feeds: ["spells"], entries: [smite(paid)] },
    );
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const bag: GameInventoryStack[] = [
    { id: "w", name: "Wand", item: "gear/wand", quantity: 1 },
    { id: "s", name: "Salve", item: "gear/salve", quantity: 2 },
  ];

  // ── In a fight ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items: rulesetSheetItems(book, bag, undefined) },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    const ids = () => rulesetCombatOptions(definition, state, "hero").map((one) => one.id);
    assert.ok(ids().includes("use:0") && ids().includes("use:1"), "both, before");
    rulesetCombatant(state, "hero")!.tracked.push({ condition: "feebleminded", rounds: null, source: "foe" });
    assert.ok(!ids().includes("use:0"), "no magic item");
    assert.ok(ids().includes("use:1"), "a salve is no magic item");
  }
  // ── Outside a fight ──
  {
    const use = (stackId: string, conditions: string[]) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks: bag,
        stackId,
        user: { name: "Ada", build, live: { conditions } },
        roll: () => 2,
      });
    assert.ok(use("w", []).ok, "the wand, before");
    const stopped = use("w", ["feebleminded"]);
    assert.equal(stopped.ok ? "" : stopped.reason, "forbidden");
    assert.ok(use("s", ["feebleminded"]).ok, "the salve");
  }
  // ── Any item at all, with no tags ──
  {
    const all = parsed(document({ items: {} }));
    const allBook = rulesetItemBook(all, entries);
    const stopped = useRulesetItemOutsideFight({
      definition: all,
      itemOf: allBook.itemOf,
      stacks: bag,
      stackId: "s",
      user: { name: "Ada", build, live: { conditions: ["feebleminded"] } },
      roll: () => 2,
    });
    assert.equal(stopped.ok ? "" : stopped.reason, "forbidden");
  }

  // ── More than six conditions, each by its paidSteps ──
  refused(document(undefined, false), /up to 6 conditions; up to 12 with "appliesOneOf"/);
  refused(document({ items: { tags: ["magical", "magical"] } }), /once|Duplicate|unique/i);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions forbid using items (forbids.items) or whose entries put on more than six conditions by the steps paid (paidSteps) requires schemaVersion 2 and capabilityApi 1.525 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(524) as never, document()), gate);
    const onlyPaid = document({ casts: ["smites"] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(524) as never, onlyPaid), gate, "the applies alone");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(525) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(524) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Forbidden items: a condition that forbids magic items keeps a wand off the menu and refuses it outside a fight, a salve still used; with no tags, any item; up to 12 conditions by paidSteps; gated at 1.525.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
