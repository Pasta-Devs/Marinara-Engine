/**
 * A priced material (Capability API 1.790): an entry's `material`.
 *
 *   - Only items of its `items` or `tags` count, by their own cost: a cheaper pearl, a component
 *     pouch or a fake never stands in. A kept material is only looked at; a consumed one takes the
 *     one item worth the least while still enough, else the dearest first.
 *   - In a fight it is offered only while its caster carries enough; a consumed one comes out of the
 *     bag as it is cast, so it is gone from the next turn's menu and written back to its stack.
 *   - A Game Master's `use` outside a fight is refused without it, and a consumed one is reported
 *     for the stacks it comes out of.
 *   - Checked at import, and the install gate asks for 1.790.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applySheetCommandTags,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_CATALOG_ROW_KEY,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetMaterialFor,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-material-774-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 790);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const pearl = { label: "a pearl worth at least 100 gp", worth: { amount: 100, unit: "gp" }, tags: ["pearl"] };
  const diamonds = {
    label: "diamonds worth 300 gp",
    worth: { amount: 300, unit: "gp" },
    items: ["gear/diamond"],
    consumed: true,
  };
  const spell = (id: string, label: string, material: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { flat: 1 }, material },
  });
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      currencies: [
        {
          id: "coin",
          label: "Coins",
          units: [
            { id: "cp", label: "copper pieces", value: 1 },
            { id: "gp", label: "gold pieces", value: 100 },
          ],
        },
      ],
    };
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [spell("identify", "Identify", pearl), spell("revivify", "Revivify", diamonds)],
    });
    edit(doc);
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const catalogs = { spells: definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! };

  let stackIds = 0;
  const held = (ref: string, quantity: number, item: Partial<RulesetCatalogItem>, extra = {}): RulesetSheetItem =>
    ({
      name: ref.slice(ref.indexOf("/") + 1),
      quantity,
      worn: false,
      item: { category: "gear", ...item } as RulesetCatalogItem,
      stack: { id: `s${++stackIds}`, ref },
      ...extra,
    }) as RulesetSheetItem;
  const gp = (amount: number) => ({ amount, unit: "gp" });
  const goodPearl = held("gear/pearl", 1, { tags: ["pearl"], cost: gp(100) });
  const cheapPearl = held("gear/small-pearl", 2, { tags: ["pearl"], cost: gp(50) });
  const pouch = held("gear/component-pouch", 1, { tags: ["focus"], cost: gp(25) });
  const fakePearl = held("gear/pearl", 1, { tags: ["pearl"], cost: gp(100) }, { truly: { item: {}, name: "Glass" } });
  const smallDiamonds = held("gear/diamond", 3, { cost: gp(100) });
  const bigDiamond = held("gear/diamond", 1, { cost: gp(500) });
  const material = (which: Record<string, unknown>) => which as never;

  // ── What counts ──
  assert.deepEqual(rulesetMaterialFor(definition, material(pearl), [pouch, goodPearl]), [{ index: 1, count: 1 }]);
  assert.equal(
    rulesetMaterialFor(definition, material(pearl), [{ ...cheapPearl, quantity: 1 }, pouch, fakePearl]),
    null,
  );
  // Two 50 gp pearls make 100 gp between them.
  assert.deepEqual(rulesetMaterialFor(definition, material(pearl), [{ ...cheapPearl }]), [{ index: 0, count: 2 }]);
  assert.equal(rulesetMaterialFor(definition, material(pearl), [cheapPearl], { 0: 1 }), null, "one used already");
  assert.deepEqual(rulesetMaterialFor(definition, material(diamonds), [smallDiamonds]), [{ index: 0, count: 3 }]);
  // The one big diamond, not three small ones, and the cheapest one that is enough.
  assert.deepEqual(rulesetMaterialFor(definition, material(diamonds), [smallDiamonds, bigDiamond]), [
    { index: 1, count: 1 },
  ]);
  assert.equal(
    rulesetMaterialFor(definition, material(diamonds), [goodPearl, held("gear/diamond", 2, { cost: gp(100) })]),
    null,
  );

  // ── In a fight ──
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    fields: { level: 5, hp_max: 30 },
    lists: {
      spells: [
        { name: "Identify", level: 0, prepared: true, [RULESET_CATALOG_ROW_KEY]: "spells/identify" },
        { name: "Revivify", level: 0, prepared: true, [RULESET_CATALOG_ROW_KEY]: "spells/revivify" },
      ],
    },
  });
  const fight = (items: RulesetSheetItem[]) => {
    let initiative = 0;
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => (initiative++ === 0 ? 20 : 1),
      combatants: [
        { id: "caster", name: "Caster", side: "party", build, live: {}, items, catalogs },
        {
          id: "target",
          name: "Target",
          side: "enemy",
          block: { health: 100, defense: 5, initiativeModifier: 0, actions: [] },
        },
      ],
    });
  };
  const labels = (state: ReturnType<typeof fight>) =>
    rulesetCombatOptions(definition, state, "caster")
      .map((option) => option.label)
      .filter((label) => label === "Identify" || label === "Revivify");
  assert.deepEqual(labels(fight([pouch, { ...cheapPearl, quantity: 1 }, fakePearl])), []);
  assert.deepEqual(labels(fight([goodPearl, smallDiamonds])), ["Identify", "Revivify"]);
  const before = fight([goodPearl, smallDiamonds]);
  const option = rulesetCombatOptions(definition, before, "caster").find((one) => one.label === "Revivify")!;
  const cast = applyRulesetCombatChoice(
    definition,
    before,
    { actorId: "caster", optionId: option.id, targetIds: ["target"] },
    () => 10,
  );
  assert.ok(!cast.events.some((event) => event.type === "refused"), JSON.stringify(cast.events));
  const caster = rulesetCombatant(cast.state, "caster")!;
  assert.deepEqual(caster.itemsUsed, { 1: 3 }, "the three diamonds are used up");
  assert.equal(rulesetCombatant(before, "caster")!.itemsUsed, undefined, "the earlier state is untouched");
  const changes = rulesetFightItemChanges(before, cast.state);
  assert.deepEqual(
    changes.map((change) => [change.stack.ref, change.taken]),
    [["gear/diamond", 3]],
  );
  // The pearl stays: Identify is still there on a later turn, Revivify is not.
  const later = structuredClone(cast.state);
  later.turn = later.order.indexOf("caster");
  const laterCaster = rulesetCombatant(later, "caster")!;
  laterCaster.budgets = structuredClone(rulesetCombatant(before, "caster")!.budgets);
  assert.deepEqual(labels(later), ["Identify"]);

  // ── A Game Master's use outside a fight ──
  const tell = (text: string, items: RulesetSheetItem[]) =>
    applySheetCommandTags(text, {
      definition,
      cards: [{ name: "Ada", build, items }],
      playerName: "Ada",
      live: {},
      catalogs,
    });
  const without = tell(`[sheet: who="Ada" op="use" name="Identify"]`, [
    { ...cheapPearl, quantity: 1 },
    pouch,
    fakePearl,
  ]);
  assert.equal(without.outcomes[0]!.ok, false);
  assert.equal(without.outcomes[0]!.reason, "no-material: a pearl worth at least 100 gp");
  const kept = tell(`[sheet: who="Ada" op="use" name="Identify"]`, [goodPearl]);
  assert.equal(kept.outcomes[0]!.ok, true, JSON.stringify(kept.outcomes));
  assert.deepEqual(kept.materials, []);
  const raised = tell(`[sheet: who="Ada" op="use" name="Revivify"] [sheet: who="Ada" op="use" name="Revivify"]`, [
    smallDiamonds,
    bigDiamond,
  ]);
  assert.deepEqual(
    raised.outcomes.map((one) => one.ok),
    [true, true],
    JSON.stringify(raised.outcomes),
  );
  assert.match(raised.outcomes[0]!.now!, /diamonds worth 300 gp used up/);
  assert.deepEqual(raised.materials, [
    { who: "Ada", stacks: [{ id: bigDiamond.stack!.id, count: 1 }] },
    { who: "Ada", stacks: [{ id: smallDiamonds.stack!.id, count: 3 }] },
  ]);
  // Taken off the stacks they came out of once the reply is saved.
  const { gameInventoryMaterialsTaken } =
    await import("../../packages/server/src/services/game/game-item-use.service.js");
  const bag = [
    { id: smallDiamonds.stack!.id, name: "Diamond", item: "gear/diamond", quantity: 4 },
    { id: bigDiamond.stack!.id, name: "Diamond", item: "gear/diamond", quantity: 1 },
  ];
  assert.deepEqual(
    gameInventoryMaterialsTaken(raised.materials)(bag as never).map((stack) => [stack.id, stack.quantity]),
    [[smallDiamonds.stack!.id, 1]],
  );
  // A third has nothing left to take.
  const third = tell(
    `[sheet: who="Ada" op="use" name="Revivify"] [sheet: who="Ada" op="use" name="Revivify"] [sheet: who="Ada" op="use" name="Revivify"]`,
    [smallDiamonds, bigDiamond],
  );
  assert.deepEqual(
    third.outcomes.map((one) => one.ok),
    [true, true, false],
  );

  // ── Checked at import ──
  const withSpell = (edit: (entry: any) => void) =>
    document((doc) => edit(doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries[0]));
  refused(
    withSpell((entry) => (entry.mechanics.material.worth.unit = "zz")),
    /Unknown currency unit "zz"/,
  );
  refused(
    withSpell((entry) => delete entry.mechanics.material.tags),
    /Say what counts: "items", "tags" or both/,
  );
  refused(
    document((doc) =>
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "spells")
        .entries.push({
          id: "wand",
          label: "Wand",
          item: {
            category: "gear",
            use: { kind: "attack", budget: "action", attackRoll: true, amount: { flat: 1 }, material: pearl },
          },
        }),
    ),
    /material is for an entry cast from a sheet/,
  );

  // ── The install gate ──
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
    "A ruleset with an entry needing a priced material (material) requires schemaVersion 2 and capabilityApi 1.790 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(789) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(790) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(789) as never, JSON.parse(fiveEText)), gate);

  console.log(
    "Priced material 1.790: only what is worth enough counts, a fight offers and uses it up, a Game Master's use is refused without it, and the gate asks for 1.790.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
