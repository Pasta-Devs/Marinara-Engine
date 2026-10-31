/**
 * Further uses' counts rolled for each stack (Capability API 1.746): 5e's Necklace of Prayer Beads,
 * 1d4 + 2 beads, each of six kinds picked on a d20 (6, 6, 4, 2, 1, 1).
 *
 *   - Each stack's beads are thrown once, the same at every reading: 3 to 6 of them, each counted
 *     toward its kind's uses; a kind with none is never offered.
 *   - A fight offers each kind's count; a use outside a fight of a kind with none is refused; a rest
 *     brings a kind back to its own count.
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
  rulesetRolledPieces,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-rolled-kinds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 746);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const light = { kind: "heal", budget: "action", targets: "self", amount: { dice: "1d4" } };
  const kinds = ["Blessing", "Curing", "Favor", "Smiting", "Summons", "Wind Walking"];
  const document = (edit: (item: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "worn", label: "Worn" }] };
    const necklace: Record<string, any> = {
      category: "worn",
      stack: 1,
      use: { label: "Pray", ...light },
      moreUses: kinds.map((label) => ({
        label,
        use: { ...light },
        uses: { max: 6, recharge: { rests: ["long"], amount: "max" } },
      })),
      moreUsesRolled: { dice: "1d4+2", weights: [6, 6, 4, 2, 1, 1] },
    };
    edit(necklace);
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "beads", label: "Necklace of Prayer Beads", item: necklace }],
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "gear")!.entries! as RulesetCatalogEntry[];
  const necklace = entries[0]!.item!;
  const rolled = necklace.moreUsesRolled!;
  const book = rulesetItemBook(definition, { gear: entries });
  const counts = (stackId: string) =>
    necklace.moreUses!.map((more, n) => rulesetOwnUsesMax(more.uses!, stackId, n + 1, rolled));

  // ── Thrown once for each stack: 3 to 6 beads, each one kind's ──
  {
    const totals = Array.from({ length: 60 }, (_, at) => counts(`st-${at}`).reduce((sum, one) => sum + one, 0));
    assert.ok(
      totals.every((one) => one >= 3 && one <= 6),
      JSON.stringify(totals),
    );
    assert.ok(new Set(totals).size > 1, "different stacks hold different numbers of beads");
    for (let at = 0; at < 60; at++) {
      assert.equal(rulesetRolledPieces(rolled, `st-${at}`).length, totals[at]);
    }
    assert.deepEqual(counts("st-7"), counts("st-7"), "the same at every reading");
    const picked = new Set(Array.from({ length: 60 }, (_, at) => rulesetRolledPieces(rolled, `st-${at}`)).flat());
    assert.ok(picked.has(0) && picked.has(1) && picked.has(2), "the common kinds come up");
  }

  // A stack with some kind it holds none of.
  const stackId = Array.from({ length: 60 }, (_, at) => `st-${at}`).find((id) => counts(id).includes(0))!;
  assert.ok(stackId);
  const held = counts(stackId);
  const none = held.indexOf(0) + 1;
  const some = held.findIndex((one) => one > 0) + 1;

  // ── A fight offers each kind's own count, and never one with none ──
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
          id: "cleric",
          name: "Cleric",
          side: "party",
          build,
          live: {},
          items: [
            {
              item: necklace,
              quantity: 1,
              name: "Necklace of Prayer Beads",
              worn: true,
              stack: { id: stackId, ref: "gear/beads" },
            } as RulesetSheetItem,
          ],
        },
      ],
    });
    const actions = rulesetCombatant(state, "cleric")!.actions;
    assert.equal(actions.find((one) => one.id === `use:0:${some}`)?.itemUse?.ownUses?.max, held[some - 1]);
    const empty = actions.find((one) => one.id === `use:0:${none}`);
    assert.ok(!empty || empty.itemUse?.ownUses?.max === 0);
  }

  // ── Outside a fight: a kind with none is refused; one with some counts down ──
  {
    const stacks: GameInventoryStack[] = [
      { id: stackId, name: "Necklace of Prayer Beads", item: "gear/beads", quantity: 1, equipped: true },
    ];
    const use = (more: number) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks,
        stackId,
        user: { name: "Cleric", build: rulesetSheetBuildSchema.parse({}), live: {} },
        roll: () => 2,
        more,
      });
    const refusedUse = use(none);
    assert.equal(refusedUse.ok, false);
    if (!refusedUse.ok) assert.equal(refusedUse.reason, "none-left");
    const used = use(some);
    assert.ok(used.ok, used.ok ? "" : used.reason);
    assert.equal(used.stacks[0]!.usesLeft?.[String(some)], held[some - 1]! - 1);
    // ── A long rest brings it back to the stack's own count ──
    const back = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks: used.stacks,
      holder: undefined,
      rest: "long",
      roll: () => 1,
    });
    assert.deepEqual(back.recharged, [
      { item: `Necklace of Prayer Beads: ${kinds[some - 1]}`, now: held[some - 1], max: held[some - 1], uses: true },
    ]);
  }

  // ── Refusals ──
  refused(
    document((item) => (item.moreUsesRolled.weights = [1, 1])),
    /Rolled counts weigh each further use, one weight apiece/,
  );
  refused(
    document((item) => delete item.moreUses[0].uses),
    /Rolled counts are counts of further uses that count their own uses/,
  );
  refused(
    document((item) => (item.moreUsesRolled.weights = [0, 0, 0, 0, 0, 0])),
    /Rolled counts weigh some further use above nothing/,
  );

  // ── The install gate ──
  const gate =
    "A ruleset with an item whose further uses' counts are rolled (item.moreUsesRolled) requires schemaVersion 2 and capabilityApi 1.746 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(745) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(746) as never, document()), gate);
  assert.notEqual(
    getCapabilityPackageInstallIssue(
      manifest(745) as never,
      document((item) => delete item.moreUsesRolled),
    ),
    gate,
  );

  console.log(
    "Item rolled kinds: a Necklace of Prayer Beads' 1d4+2 beads thrown once for each stack, each one kind's use by weight, offered in a fight, refused outside one where none, brought back by a rest; refusals and the gate at 1.746.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
