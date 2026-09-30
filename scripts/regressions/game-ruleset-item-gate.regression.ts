/**
 * Item gates (#6892, Capability API 1.62).
 *
 *   - A use's `gate` is a check its user passes before the item works, unless a value on their sheet
 *     is high enough; a failed check uses the item up for nothing.
 *   - In a fight the fight engine rolls it as the item is spent (the sheet's number read as the fight
 *     began, with what conditions and worn items add to that check); outside a fight the Use button
 *     and the Game Master's use roll it with the ruleset's own dice, wound penalty and check effects.
 *   - Checked at import, gated at 1.62, and said in the item's facts and the Game Master's line.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetConditionModifiers,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetItemUseLine,
  rulesetPoolMaxSuccesses,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetCombatEventLine, rulesetCombatNames } =
  await import("../../packages/client/src/lib/ruleset-combat-log.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
  const parsed = parseRulesetDefinition(variant(gravewatchText, edit));
  assert.equal(parsed.ok, false, `${what}: the file should be refused`);
  if (parsed.ok) return;
  assert.ok(
    parsed.issues.some((issue) => pattern.test(issue)),
    `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
  );
};
const itemCatalogOf = (doc: Record<string, any>) =>
  doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "items");
const itemEntry = (doc: Record<string, any>, id: string) =>
  itemCatalogOf(doc).entries.find((entry: { id: string }) => entry.id === id);
const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
  Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
  const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
  assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
  return found;
};
const words = ((key: string, params?: Record<string, unknown>) =>
  [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;

const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
const book = rulesetItemBook(gravewatch, entriesOf(gravewatch));
const page = book.itemOf("kit/litany-page")!.entry.item!;
const bell = book.itemOf("kit/dawn-bell")!.entry.item!;
const withNerve = (nerve: number): RulesetSheetBuild => {
  const build = defaultRulesetSheetBuild(gravewatch);
  return { ...build, abilities: { ...build.abilities, nerve } };
};

// ── Import ──
{
  assert.deepEqual(page.use?.gate, {
    check: { skill: "ward" },
    difficulty: 2,
    unless: { value: { abilityScore: "nerve" }, atLeast: 3 },
  });
  const gate = (edit: (gate: Record<string, any>) => void) => (doc: Record<string, any>) =>
    edit(itemEntry(doc, "litany-page").item.use.gate);
  refused(
    gate((g) => (g.check = { skill: "pray" })),
    /use\.gate\.check\.skill: Unknown skill "pray"/,
    "a skill",
  );
  refused(
    gate((g) => (g.check = { ability: "faith" })),
    /use\.gate\.check\.ability: Unknown ability "faith"/,
    "an ability",
  );
  refused(
    gate((g) => (g.check = { value: { derived: "piety" } })),
    /use\.gate\.check\.value\.derived/,
    "a value",
  );
  refused(
    gate((g) => (g.unless.value = { abilityScore: "faith" })),
    /use\.gate\.unless\.value\.abilityScore/,
    "an unless value",
  );
  refused(
    gate((g) => (g.difficulty = { stat: "rank" })),
    /use\.gate\.difficulty\.stat: Unknown item stat "rank"/,
    "a difficulty stat",
  );
  refused(
    gate((g) => (g.check = { skill: "ward", ability: "nerve" })),
    /use\.gate\.check/,
    "two things rolled",
  );
  refused(
    gate((g) => (g.difficulty = 0)),
    /use\.gate\.difficulty/,
    "a difficulty of nothing",
  );
  refused(
    gate((g) => (g.unless.more = 1)),
    /Unrecognized key/,
    "a key nobody reads",
  );
  parsedOrThrow(
    variant(
      gravewatchText,
      gate((g) => {
        g.check = { value: { derived: "light_nerve" } };
        delete g.unless;
      }),
    ),
    "a value off the sheet, and no way round it",
  );
}

// ── Install gate: 1.62 ──
{
  const manifest = (minor: number, paths = ["ruleset.json"]) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-item-gate",
    name: "Item gates",
    version: "0.1.0",
    description: "A packaged ruleset whose items ask a check first.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths } },
    files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
    permissions: [],
    restartRequired: false,
  });
  const gateIssue = /items ask a check before they work.*capabilityApi 1\.62/;
  const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
    getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
  assert.match(issue(61, variant(gravewatchText)) ?? "", gateIssue);
  assert.equal(issue(62, variant(gravewatchText)), null);
  const ungated = (doc: Record<string, any>) => delete itemEntry(doc, "litany-page").item.use.gate;
  assert.equal(issue(61, variant(gravewatchText, ungated)), null, "the rest of the example stays 1.61");
  const inFile = variant(gravewatchText, (doc) => {
    const catalog = itemCatalogOf(doc);
    delete catalog.entries;
    catalog.asset = "catalogs/kit.json";
  });
  const paths = ["ruleset.json", "catalogs/kit.json"];
  const files = new Map<string, unknown>([
    ["catalogs/kit.json", { entries: itemCatalogOf(variant(gravewatchText)).entries }],
  ]);
  assert.match(issue(61, inFile, paths, files) ?? "", gateIssue, "a catalog file");
  assert.equal(issue(62, inFile, paths, files), null);
}

// ── In a fight ──
const carried = (item: RulesetSheetItem["item"], name: string, id: string, ref: string, worn = false) =>
  ({ item, quantity: 2, worn, name, stack: { id, ref } }) satisfies RulesetSheetItem;
const pageHeld = () => carried(page, "Page of the vigil litany", "st-page", "kit/litany-page");
const fight = (definition: RulesetDefinition, build: RulesetSheetBuild, items: RulesetSheetItem[]) =>
  createRulesetEncounter({
    definition,
    seed: 5,
    roller: () => 4,
    combatants: [
      { id: "ada", name: "Ada", side: "party", build, items, live: { pools: { resolve: { value: 0 } } } },
      {
        id: "foe",
        name: "Foe",
        side: "enemy",
        block: { health: 30, defense: 1, initiativeModifier: -20, actions: [] },
      },
    ],
  });
const use = (
  definition: RulesetDefinition,
  state: ReturnType<typeof fight>,
  face: (sides: number) => number,
  optionId = "use:0",
) => applyRulesetCombatChoice(definition, state, { actorId: "ada", optionId, targetIds: ["ada"] }, face);
{
  // Nerve under 3: the Ward check is on the page's use, read as the fight began.
  const start = fight(gravewatch, withNerve(1), [pageHeld()]);
  const action = rulesetCombatant(start, "ada")!.actions.find((entry) => entry.id === "use:0")!;
  assert.deepEqual(
    { ...action.itemUse!.gate!, modifier: typeof action.itemUse!.gate!.modifier },
    { check: "Ward", skill: "ward", modifier: "number", difficulty: 2 },
  );
  // Every die a 10: the reading holds, and the Resolve comes back.
  const read = use(gravewatch, start, () => 10);
  const passed = firstOf(read.events, "gate");
  assert.equal(passed.success, true);
  assert.equal(passed.difficulty, 2);
  assert.ok(passed.pool, "a pool fight throws the check as a pool");
  assert.ok(read.events.some((event) => event.type === "restored"));
  // A difficulty past what the pool can count is held to it, as the Use button holds it.
  const steepPage = parsedOrThrow(
    variant(gravewatchText, (doc) => (itemEntry(doc, "litany-page").item.use.gate.difficulty = 100)),
    "Gravewatch with a steep page",
  );
  const steepHeld = carried(
    rulesetItemBook(steepPage, entriesOf(steepPage)).itemOf("kit/litany-page")!.entry.item!,
    "Page of the vigil litany",
    "st-page",
    "kit/litany-page",
  );
  assert.ok(steepPage.resolution.kind === "dice-pool");
  assert.equal(
    firstOf(use(steepPage, fight(steepPage, withNerve(1), [steepHeld]), () => 1).events, "gate").difficulty,
    rulesetPoolMaxSuccesses(steepPage.resolution),
  );
  // Every die a 1: it fails, nothing it does happens, and the page is still spent.
  const stumbled = use(gravewatch, start, () => 1);
  const failed = firstOf(stumbled.events, "gate");
  assert.equal(failed.success, false);
  assert.equal(
    stumbled.events.some((event) => event.type === "restored"),
    false,
  );
  const changes = rulesetFightItemChanges(start, stumbled.state);
  assert.deepEqual(changes, [
    { stack: { id: "st-page", ref: "kit/litany-page" }, name: "Page of the vigil litany", taken: 1 },
  ]);
  const written = applyRulesetFightItemChanges(
    [{ id: "st-page", name: "Page of the vigil litany", item: "kit/litany-page", quantity: 2 }],
    changes,
  )!;
  assert.deepEqual(written.stacks[0]?.quantity, 1);
  assert.deepEqual(written.journal, [{ item: "Page of the vigil litany", action: "used", quantity: 1 }]);
  // Said in the fight log, pass or fail.
  const names = rulesetCombatNames(gravewatch, { combatants: stumbled.state.combatants } as never, words);
  assert.match(
    rulesetCombatEventLine(failed, names, words),
    /^game\.combat\.ruleset\.event\.gatePoolFailure\|Ada\|Ward\|Page of the vigil litany\|/,
  );
  assert.match(
    rulesetCombatEventLine(passed, names, words),
    /^game\.combat\.ruleset\.event\.gatePoolSuccess\|Ada\|Ward\|Page of the vigil litany\|/,
  );
  // Nerve 3: read straight through, with no check at all.
  const steady = fight(gravewatch, withNerve(3), [pageHeld()]);
  assert.equal(
    rulesetCombatant(steady, "ada")!.actions.find((entry) => entry.id === "use:0")!.itemUse!.gate,
    undefined,
  );
  const straight = use(gravewatch, steady, () => 1);
  assert.equal(
    straight.events.some((event) => event.type === "gate"),
    false,
  );
  assert.ok(straight.events.some((event) => event.type === "restored"));
  // The bound dawn bell's +1 to Ward reaches a Ward gate in a fight, narrowed as it is.
  const bellWorn: RulesetSheetItem = {
    item: bell,
    quantity: 1,
    worn: true,
    name: "Dawn bell",
    stack: { id: "st-bell", ref: "kit/dawn-bell" },
  };
  const blessed = use(gravewatch, fight(gravewatch, withNerve(1), [pageHeld(), bellWorn]), () => 10);
  assert.deepEqual(
    firstOf(blessed.events, "gate").bonuses?.map((bonus) => bonus.value),
    [1],
    "the bell's Ward bonus is on the check",
  );
}

// ── A summed fight: Ember Roads ──
{
  const ember = parsedOrThrow(
    variant(emberText, (doc) => {
      const poultice = itemEntry(doc, "poultice").item;
      poultice.stats = { ...(poultice.stats ?? {}), know: 30 };
      doc.items.stats = [
        ...(doc.items.stats ?? []),
        { id: "know", label: "Know-how", type: "number", min: 0, max: 40 },
      ];
      poultice.use.gate = { check: { skill: "sneak" }, difficulty: { stat: "know" } };
    }),
    "Ember with a gated poultice",
  );
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const poultice = emberBook.itemOf("outfitter/poultice")!.entry.item!;
  const coat = emberBook.itemOf("outfitter/leather-coat")!.entry.item!;
  const build = defaultRulesetSheetBuild(ember);
  const held = [carried(poultice, "Poultice", "st-poultice", "outfitter/poultice")];
  const start = fight(ember, build, held);
  const tried = firstOf(use(ember, start, () => 6).events, "gate");
  assert.deepEqual([tried.rolls, tried.kept, tried.difficulty, tried.success], [[6, 6], 12, 30, false]);
  assert.equal(tried.total, 12 + tried.modifier);
  // The leather coat's -1 to Sneak is on a Sneak gate, and on no other.
  const coatWorn = carried(coat, "Leather coat", "st-coat", "outfitter/leather-coat", true);
  const sneaking = firstOf(use(ember, fight(ember, build, [...held, coatWorn]), () => 6).events, "gate");
  assert.deepEqual(
    sneaking.bonuses?.map((bonus) => bonus.value),
    [-1],
  );
  assert.equal(sneaking.total, tried.total - 1);
  // Narrowed to Sneak, the coat reaches a check that names Sneak, and never a contest, which names none.
  const coated = rulesetCombatant(fight(ember, build, [...held, coatWorn]), "ada")!;
  assert.deepEqual(rulesetConditionModifiers(ember, ember.combat!, coated, "checks"), []);
  assert.deepEqual(
    rulesetConditionModifiers(ember, ember.combat!, coated, "checks", undefined, "sneak").map(
      (entry) => entry.modifier.flat,
    ),
    [-1],
  );
  // A total that meets the difficulty passes: two 6s and a value of 0 against 12.
  const meets = parsedOrThrow(
    variant(emberText, (doc) => {
      itemEntry(doc, "poultice").item.use.gate = { check: { value: { const: 0 } }, difficulty: 12 };
    }),
    "Ember with a gate a 12 meets",
  );
  const met = firstOf(
    use(
      meets,
      fight(meets, build, [
        carried(
          rulesetItemBook(meets, entriesOf(meets)).itemOf("outfitter/poultice")!.entry.item!,
          "Poultice",
          "st-poultice",
          "outfitter/poultice",
        ),
      ]),
      () => 6,
    ).events,
    "gate",
  );
  assert.deepEqual([met.total, met.success], [12, true]);
  const tinkering = parsedOrThrow(
    variant(emberText, (doc) => {
      itemEntry(doc, "poultice").item.use.gate = { check: { skill: "tinker" }, difficulty: 2 };
    }),
    "Ember with a Tinker gate",
  );
  const tinkerBook = rulesetItemBook(tinkering, entriesOf(tinkering));
  const tinkerHeld = [
    carried(tinkerBook.itemOf("outfitter/poultice")!.entry.item!, "Poultice", "st-poultice", "outfitter/poultice"),
    carried(
      tinkerBook.itemOf("outfitter/leather-coat")!.entry.item!,
      "Leather coat",
      "st-coat",
      "outfitter/leather-coat",
      true,
    ),
  ];
  const fixed = firstOf(use(tinkering, fight(tinkering, build, tinkerHeld), () => 6).events, "gate");
  assert.equal(fixed.bonuses, undefined, "a Tinker gate reads nothing narrowed to Sneak");
  assert.equal(fixed.success, true);
  assert.match(
    rulesetCombatEventLine(fixed, rulesetCombatNames(tinkering, { combatants: [] } as never, words), words),
    /^game\.combat\.ruleset\.event\.gateSuccess\|/,
  );
  // A difficulty off a stat the item does not give leaves the use off the menu.
  const missing = parsedOrThrow(
    variant(emberText, (doc) => {
      itemEntry(doc, "poultice").item.use.gate = { check: { skill: "sneak" }, difficulty: { stat: "know" } };
      doc.items.stats = [
        ...(doc.items.stats ?? []),
        { id: "know", label: "Know-how", type: "number", min: 0, max: 40 },
      ];
    }),
    "Ember with a stat the poultice does not give",
  );
  const missingBook = rulesetItemBook(missing, entriesOf(missing));
  const offMenu = fight(missing, build, [
    carried(missingBook.itemOf("outfitter/poultice")!.entry.item!, "Poultice", "st-poultice", "outfitter/poultice"),
  ]);
  assert.equal(
    rulesetCombatant(offMenu, "ada")!.actions.some((entry) => entry.id === "use:0"),
    false,
  );
}

// ── Outside a fight ──
{
  const stacks = (extra: GameInventoryStack[] = []): GameInventoryStack[] => [
    { id: "st-page", name: "Page of the vigil litany", item: "kit/litany-page", quantity: 2 },
    ...extra,
  ];
  const outside = (
    build: RulesetSheetBuild,
    face: number,
    live: unknown = { pools: { resolve: { value: 0 } } },
    extra: GameInventoryStack[] = [],
  ) =>
    useRulesetItemOutsideFight({
      definition: gravewatch,
      itemOf: book.itemOf,
      stacks: stacks(extra),
      stackId: "st-page",
      user: { name: "Ada", build, live },
      roll: () => face,
    });
  const failed = outside(withNerve(1), 1);
  assert.ok(failed.ok);
  assert.equal(failed.said.gate?.success, false);
  assert.equal(failed.said.gate?.check, "Ward");
  assert.deepEqual(failed.said.parts, []);
  assert.equal(failed.stacks[0]?.quantity, 1, "a failed reading still uses the page up");
  assert.deepEqual(failed.journal, [{ item: "Page of the vigil litany", action: "used", quantity: 1 }]);
  assert.deepEqual(failed.live, { pools: { resolve: { value: 0 } } }, "and nothing lands on the sheet");
  assert.match(
    rulesetItemUseLine(failed.said),
    /^Ada uses Page of the vigil litany: Ward check \d+ against 2, failed; it is used up for nothing\. 1 left\.$/,
  );
  // Nerve 2 throws two dice, still short of the 3 that skips the check. Every die an 8 counts once,
  // since only a 10 is thrown again.
  const passed = outside(withNerve(2), 8);
  assert.ok(passed.ok);
  assert.equal(passed.said.gate?.success, true);
  assert.deepEqual(
    passed.said.parts.map((part) => part.kind),
    ["restore"],
  );
  assert.match(
    rulesetItemUseLine(passed.said),
    /^Ada uses Page of the vigil litany: Ward check \d+ against 2, passed; restores 2 Resolve/,
  );
  const steady = outside(withNerve(3), 1);
  assert.ok(steady.ok);
  assert.equal(steady.said.gate, undefined, "Nerve 3 reads it straight through");
  assert.deepEqual(
    steady.said.parts.map((part) => part.kind),
    ["restore"],
  );
  // The check is the sheet's own: a wound's penalty takes a die off it, and the bound bell adds one.
  const whole = passed.said.gate!.total;
  const winded = applyRulesetSheetOp(
    gravewatch,
    withNerve(2),
    { pools: { resolve: { value: 0 } } },
    {
      op: "damage",
      track: "harm",
      kind: "knock",
      amount: 2,
    },
  );
  assert.ok(winded.ok);
  const hurt = outside(withNerve(2), 8, winded.live);
  assert.ok(hurt.ok);
  assert.equal(hurt.said.gate!.total, whole - 1, "Winded takes a die off the check");
  const blessed = outside(withNerve(2), 8, undefined, [
    { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true },
  ]);
  assert.ok(blessed.ok);
  assert.equal(blessed.said.gate!.total, whole + 1, "the bound bell's +1 to Ward");
  // Ember Roads sums its dice: 2d6 and the sheet's number against the item's own stat.
  const ember = parsedOrThrow(
    variant(emberText, (doc) => {
      const poultice = itemEntry(doc, "poultice").item;
      poultice.stats = { ...(poultice.stats ?? {}), know: 9 };
      doc.items.stats = [
        ...(doc.items.stats ?? []),
        { id: "know", label: "Know-how", type: "number", min: 0, max: 40 },
      ];
      poultice.use.gate = { check: { ability: "wits" }, difficulty: { stat: "know" } };
    }),
    "Ember with a gated poultice",
  );
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const summed = (face: number) =>
    useRulesetItemOutsideFight({
      definition: ember,
      itemOf: emberBook.itemOf,
      stacks: [{ id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2, holder: "Juno" }],
      stackId: "st-poultice",
      user: { name: "Juno", build: defaultRulesetSheetBuild(ember), live: { pools: { grit: { value: 0 } } } },
      roll: () => face,
    });
  const low = summed(1);
  assert.ok(low.ok);
  assert.deepEqual([low.said.gate?.rolls, low.said.gate?.difficulty, low.said.gate?.success], [[1, 1], 9, false]);
  const high = summed(6);
  assert.ok(high.ok);
  assert.deepEqual([high.said.gate?.rolls, high.said.gate?.success], [[6, 6], true]);
  assert.equal(high.said.gate!.total - 12, low.said.gate!.total - 2, "the same number beside the dice");
  // A difficulty the item cannot say is a use the Engine cannot make.
  const unread = parsedOrThrow(
    variant(emberText, (doc) => {
      itemEntry(doc, "poultice").item.use.gate = { check: { ability: "wits" }, difficulty: { stat: "know" } };
      doc.items.stats = [
        ...(doc.items.stats ?? []),
        { id: "know", label: "Know-how", type: "number", min: 0, max: 40 },
      ];
    }),
    "Ember with a stat the poultice does not give",
  );
  const refusedUse = useRulesetItemOutsideFight({
    definition: unread,
    itemOf: rulesetItemBook(unread, entriesOf(unread)).itemOf,
    stacks: [{ id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2 }],
    stackId: "st-poultice",
    user: { name: "Juno", build: defaultRulesetSheetBuild(unread), live: {} },
    roll: () => 6,
  });
  assert.deepEqual(refusedUse, { ok: false, reason: "no-use" });
  // A value off the sheet is the check's number, and `resolution.adjust` is added to it as it is to
  // every check: two 1s and a value of 5 meet 7, and a -1 adjust leaves it short.
  const valued = (adjust: boolean) => {
    const definition = parsedOrThrow(
      variant(emberText, (doc) => {
        itemEntry(doc, "poultice").item.use.gate = { check: { value: { const: 5 } }, difficulty: 7 };
        if (adjust) doc.resolution.adjust = [...(doc.resolution.adjust ?? []), { value: { const: -1 } }];
      }),
      "Ember with a gate that reads a value",
    );
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: rulesetItemBook(definition, entriesOf(definition)).itemOf,
      stacks: [{ id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2 }],
      stackId: "st-poultice",
      user: { name: "Juno", build: defaultRulesetSheetBuild(definition), live: {} },
      roll: () => 1,
    });
    assert.ok(used.ok);
    return [used.said.gate?.total, used.said.gate?.success];
  };
  assert.deepEqual(valued(false), [7, true]);
  assert.deepEqual(valued(true), [6, false]);
  // A pool counts no more successes than it can: a difficulty past that is held to it.
  const steep = parsedOrThrow(
    variant(gravewatchText, (doc) => (itemEntry(doc, "litany-page").item.use.gate.difficulty = 100)),
    "Gravewatch with a steep page",
  );
  const clamped = useRulesetItemOutsideFight({
    definition: steep,
    itemOf: rulesetItemBook(steep, entriesOf(steep)).itemOf,
    stacks: stacks(),
    stackId: "st-page",
    user: { name: "Ada", build: withNerve(1), live: {} },
    roll: () => 8,
  });
  assert.ok(clamped.ok);
  assert.ok(steep.resolution.kind === "dice-pool");
  assert.equal(clamped.said.gate?.difficulty, rulesetPoolMaxSuccesses(steep.resolution));
  // A failed gate on an item aimed at somebody else does nothing to them either, so nothing is told.
  const warded = parsedOrThrow(
    variant(gravewatchText, (doc) => {
      itemEntry(doc, "dawn-bell").item.use.gate = { check: { skill: "ward" }, difficulty: 30 };
    }),
    "Gravewatch with a gated bell",
  );
  const rung = useRulesetItemOutsideFight({
    definition: warded,
    itemOf: rulesetItemBook(warded, entriesOf(warded)).itemOf,
    stacks: [{ id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true }],
    stackId: "st-bell",
    user: { name: "Ada", build: withNerve(1), live: {} },
    roll: () => 2,
  });
  assert.ok(rung.ok);
  assert.equal(rung.said.gate?.success, false);
  assert.equal(rung.said.aimed, undefined);
  assert.match(rulesetItemUseLine(rung.said), /failed; it is used up for nothing\. 2 of 3 charges left\.$/);
}

// ── What an item says ──
{
  assert.deepEqual(rulesetItemFacts(gravewatch, page).use?.gate, {
    check: "Ward",
    difficulty: 2,
    unless: { what: "Nerve", atLeast: 3 },
  });
  assert.match(
    rulesetItemPromptFacts(rulesetItemFacts(gravewatch, page)),
    /restores 2 Resolve, used up, needs a Ward check against 2 first, unless Nerve is 3 or more; failed, it is used up for nothing$/,
  );
}

console.log(
  "Ruleset item gates: import checks, the 1.62 gate, pool and summed fights (pass, fail, skip, effects narrowed to the skill, a difficulty off a stat), the Use button's gate (wounds and worn items on the check) and item facts passed.",
);
