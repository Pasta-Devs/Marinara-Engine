/**
 * Using items in ruleset fights (#6880, Capability API 1.59).
 *
 *   - An item's `use` is what using it does, said as an ability's mechanics are (a heal, an attack, a
 *     buff or a debuff), on a budget or free. An item that takes a slot or binds is used while worn;
 *     any other while carried. It pays with itself: `consumes` takes one off its stack, and `charges`
 *     spends what the item's own `charges` hold.
 *   - What a fight used up and the charges left are written onto those very stacks, and a stack of
 *     one keeps its charges between fights.
 *   - Checked at import, and the install gate asks for 1.59. Item facts, the Game Master's line, the
 *     fight menu and the fight log say it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  mergeGameInventoryStacks,
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetOpportunityAttack,
  rulesetSheetItems,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-item-use-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { getCapabilityPackageInstallIssue },
  { rulesetCombatEventLine, rulesetCombatNames },
  { rulesetMenuGroups },
  { createCombatDirector },
  { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants },
] = await Promise.all([
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/client/src/lib/ruleset-combat-log.js"),
  import("../../packages/client/src/lib/ruleset-combat-menu.js"),
  import("../../packages/server/src/services/game/combat-director.service.js"),
  import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
]);

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");

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
  const refused = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(text, edit));
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

  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const itemOf = (definition: RulesetDefinition, ref: string): RulesetCatalogItem => {
    const found = rulesetItemBook(definition, entriesOf(definition)).itemOf(ref)?.entry.item;
    assert.ok(found, `the book has ${ref}`);
    return found;
  };
  const held = (item: RulesetCatalogItem, name: string, worn = false, quantity = 1): RulesetSheetItem => ({
    item,
    quantity,
    worn,
    name,
  });
  const poultice = itemOf(ember, "outfitter/poultice");
  const tonic = itemOf(gravewatch, "kit/warming-tonic");
  const bell = itemOf(gravewatch, "kit/dawn-bell");
  const spade = itemOf(gravewatch, "kit/grave-spade");

  // ── Import ──
  {
    assert.deepEqual(poultice.use, {
      kind: "heal",
      budget: "act",
      range: 0,
      targets: "ally",
      amount: { dice: "1d4", flat: 1 },
      consumes: true,
    });
    assert.equal(bell.charges?.max, 3);
    assert.equal(bell.use?.charges, 1);
    const tonicUse = (edit: (use: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "warming-tonic").item.use);
    const bellItem = (edit: (item: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "dawn-bell").item);
    refused(
      gravewatchText,
      tonicUse((use) => (use.budget = "rest")),
      /use\.budget: Unknown budget "rest"/,
      "a budget",
    );
    refused(
      gravewatchText,
      tonicUse((use) => delete use.budget),
      /use\.budget: A use spends a budget, or is free/,
      "neither a budget nor free",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.free = true)),
      /use\.free: Something free spends no budget, so it names none/,
      "free and a budget",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.charges = 1)),
      /use\.charges: A use that uses the item up spends no charges of it/,
      "used up and charges",
    );
    refused(
      gravewatchText,
      tonicUse((use) => {
        delete use.consumes;
        use.charges = 1;
      }),
      /use\.charges: A use that spends charges is on an item that holds some/,
      "charges spent off an item without any",
    );
    refused(
      gravewatchText,
      bellItem((item) => delete item.use.charges),
      /charges: An item's charges are spent by its use, so its use spends some/,
      "charges nothing spends",
    );
    refused(
      gravewatchText,
      bellItem((item) => delete item.stack),
      /stack: An item that holds charges is one to a stack, so its stack is 1/,
      "charges on a stack of several",
    );
    refused(
      gravewatchText,
      bellItem((item) => (item.charges.max = { stat: "damage" })),
      /charges\.max\.stat: Item stat "damage" must be number/,
      "charges read off a stat that is no number",
    );
    refused(
      gravewatchText,
      (doc) => {
        doc.items.stats.push({ id: "peals", label: "Peals", type: "number", min: 0, max: 9 });
        Object.assign(itemEntry(doc, "dawn-bell").item, { charges: { max: { stat: "peals" } } });
        itemEntry(doc, "dawn-bell").item.stats.peals = 0;
      },
      /stats\.peals: An item that holds charges holds at least one/,
      "charges read off a stat the item gives as none",
    );
    refused(
      gravewatchText,
      bellItem((item) => (item.use.saveDifficulty = { stat: "conceal" })),
      /saveDifficulty\.stat: Item stat "conceal" must be number/,
      "a save's number read off a stat that is no number",
    );
    refused(
      gravewatchText,
      bellItem((item) => delete item.use.saveDifficulty),
      /use\.saveDifficulty: A use that asks for a save says the number it is saved against/,
      "a save against nothing",
    );
    refused(
      gravewatchText,
      bellItem((item) => (item.use.save.save = "grit")),
      /use\.save\.save: Unknown save "grit"/,
      "a save",
    );
    refused(
      gravewatchText,
      bellItem((item) => (item.use.applies[0].condition = "frozen")),
      /use\.applies\.0\.condition: Unknown condition "frozen"/,
      "a condition",
    );
    refused(
      gravewatchText,
      tonicUse((use) => {
        use.kind = "attack";
        use.amount = { dice: "1d10" };
        use.damageType = "frost";
      }),
      /use\.damageType: Unknown damage type "frost"/,
      "a damage type",
    );
    refused(
      gravewatchText,
      tonicUse((use) => {
        use.kind = "attack";
        use.amount = { dice: "1d6" };
      }),
      /use\.amount\.dice: A "dice-pool" fight throws d10s, so damage dice are d10s/,
      "a pool fight's die",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.temporary = { flat: 1 })),
      /use\.temporary: Health is the wound track "harm", which carries no buffer for temporary points/,
      "temporary points on a wound track",
    );
    refused(
      gravewatchText,
      tonicUse((use) => (use.toHit = { bonus: 1 })),
      /use\.toHit: A to-hit is for a use that rolls to hit/,
      "a to-hit on a use that rolls none",
    );
    refused(
      emberText,
      (doc) => {
        const use = itemEntry(doc, "poultice").item.use;
        use.kind = "attack";
        use.attackRoll = true;
        use.toHit = { abilities: ["grace"] };
      },
      /use\.toHit\.abilities\.0: Unknown ability "grace"/,
      "a to-hit's ability",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "poultice").item.use.plus = [{ dice: "1d4" }]),
      /use\.plus: A heal carries no damage clauses/,
      "a clause on a heal",
    );
    refused(
      emberText,
      (doc) => {
        const use = itemEntry(doc, "poultice").item.use;
        use.kind = "attack";
        delete use.amount;
        use.plus = [{ dice: "1d4", type: "burn" }];
      },
      /use\.plus: A clause needs an amount beside it/,
      "a clause with no amount",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "poultice").item.use.kind = "utility"),
      /use\.kind/,
      "a kind no item use has",
    );
    refused(
      emberText,
      (doc) => (itemEntry(doc, "poultice").item.use.cost = [{ pool: "grit", amount: 1 }]),
      /Unrecognized key/,
      "a cost, which only a sheet row pays",
    );
    // A to-hit on a use that rolls one, read off the sheet, is fine; so is a use that is free.
    parsedOrThrow(
      variant(emberText, (doc) => {
        const use = itemEntry(doc, "poultice").item.use;
        use.kind = "attack";
        use.attackRoll = true;
        use.toHit = { abilities: ["wits"], bonus: 1 };
        delete use.budget;
        use.free = true;
      }),
      "a free use that rolls to hit",
    );
    // A ruleset with no fight carries a use and reads nothing of it but what it names.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        delete doc.combat;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
        for (const entry of itemCatalogOf(doc).entries) {
          delete entry.item.attack;
          if (entry.item.use) entry.item.use.budget = "nothing";
        }
      }),
      "a use in a ruleset without fights",
    );
  }

  // ── Install gate: 1.59 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-item-use",
      name: "Item use",
      version: "0.1.0",
      description: "A packaged ruleset whose items are used in fights.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /items are used in a fight or hold charges.*capabilityApi 1\.59/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    /** The examples less what their items do when used. */
    const withoutUse = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) {
        delete entry.item.use;
        delete entry.item.charges;
      }
    };
    /** Less what a use restores, what brings charges back or breaks an item, and a use's gate, which
     *  are 1.60's, 1.61's and 1.62's and have lanes of their own. */
    const withoutRestore = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) {
        delete entry.item.use?.restore;
        delete entry.item.use?.gate;
        // And its charges' recharge and break, which are 1.61's.
        delete entry.item.charges?.recharge;
        delete entry.item.charges?.breaksOn;
      }
    };
    for (const text of [emberText, gravewatchText].map((each) => JSON.stringify(variant(each, withoutRestore)))) {
      assert.match(issue(58, variant(text)) ?? "", gateIssue);
      assert.equal(issue(59, variant(text)), null);
      assert.equal(issue(58, variant(text, withoutUse)), null, "the rest of the example stays 1.58");
    }
    const onlyCharges = variant(gravewatchText, (doc) => {
      withoutUse(doc);
      itemEntry(doc, "dawn-bell").item.charges = { max: 3 };
    });
    assert.match(issue(58, onlyCharges) ?? "", gateIssue, "charges alone");
    // In a catalog file.
    const inFile = variant(emberText, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = itemCatalogOf(variant(emberText)).entries;
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(58, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(59, inFile, paths, files), null);
  }

  // ── A fight ──
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const fight = (
    definition: RulesetDefinition,
    items: RulesetSheetItem[],
    live?: unknown,
    options: { friend?: unknown; face?: number } = {},
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 5,
      roller: () => options.face ?? 4,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: defaultRulesetSheetBuild(definition),
          items,
          ...(live ? { live } : {}),
        },
        {
          id: "bo",
          name: "Bo",
          side: "party",
          build: defaultRulesetSheetBuild(definition),
          ...(options.friend ? { live: options.friend } : {}),
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 30, defense: 1, initiativeModifier: -20, actions: [] },
        },
      ],
    });
  const ada = (state: RulesetEncounterState) => rulesetCombatant(state, "ada")!;
  const optionOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "ada").find((option) => option.id === id);
  const take = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    optionId: string,
    targetIds: string[] = [],
    face = 4,
  ) => {
    const step = applyRulesetCombatChoice(definition, state, { actorId: "ada", optionId, targetIds }, () => face);
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
      `${optionId} is taken: ${JSON.stringify(step.events)}`,
    );
    return step;
  };
  /** Ada's turn over and back again: nobody else does anything. */
  const nextTurn = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    let now = take(definition, state, "end-turn").state;
    for (let i = 0; i < 4 && now.order[now.turn] !== "ada"; i++) {
      now = applyRulesetCombatChoice(
        definition,
        now,
        { actorId: now.order[now.turn]!, optionId: "end-turn", targetIds: [] },
        () => 4,
      ).state;
    }
    assert.equal(now.order[now.turn], "ada");
    return now;
  };
  const t = ((key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;
  const hurt = { pools: { grit: { value: 2 } } };

  {
    // Two poultices, carried: offered on the Action with how many are left, pressed on Ada herself or
    // on Bo beside her, and each one used is one off the stack.
    const start = fight(ember, [held(poultice, "Poultice", false, 2)], hurt, { friend: hurt });
    const offered = optionOf(ember, start, "use:0");
    assert.deepEqual(
      offered && {
        kind: offered.kind,
        label: offered.label,
        budget: offered.budget,
        targets: offered.targets,
        heals: offered.heals,
        left: offered.left,
      },
      { kind: "item", label: "Poultice", budget: "act", targets: { side: "ally", count: 1 }, heals: true, left: 2 },
    );
    const first = take(ember, start, "use:0", ["ada"], 3);
    assert.deepEqual(firstOf(first.events, "uses"), {
      type: "uses",
      actorId: "ada",
      optionId: "use:0",
      label: "Poultice",
      left: 1,
      of: 2,
    });
    assert.deepEqual(firstOf(first.events, "heal"), {
      type: "heal",
      targetId: "ada",
      sourceId: "ada",
      rolls: [3],
      flat: 1,
      amount: 4,
      health: 6,
      maxHealth: 6,
    });
    assert.deepEqual(ada(first.state).itemsUsed, { 0: 1 });
    const names = rulesetCombatNames(ember, { combatants: first.state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(first.events, "uses"), names, t),
      "game.combat.ruleset.event.uses|Poultice|1|2",
    );
    // It spent the Action, so nothing else on it this turn.
    assert.equal(optionOf(ember, first.state, "use:0"), undefined);
    // Never on the other side.
    const onFoe = applyRulesetCombatChoice(
      ember,
      start,
      { actorId: "ada", optionId: "use:0", targetIds: ["foe"] },
      () => 3,
    );
    assert.equal(firstOf(onFoe.events, "refused").reason, "bad-target");
    // The second on Bo, and then there are none.
    const second = take(ember, nextTurn(ember, first.state), "use:0", ["bo"], 3);
    assert.equal(firstOf(second.events, "heal").targetId, "bo");
    assert.equal(firstOf(second.events, "uses").left, 0);
    const out = nextTurn(ember, second.state);
    assert.equal(optionOf(ember, out, "use:0"), undefined, "none left, none offered");
    const gone = applyRulesetCombatChoice(
      ember,
      out,
      { actorId: "ada", optionId: "use:0", targetIds: ["ada"] },
      () => 3,
    );
    assert.equal(firstOf(gone.events, "refused").reason, "insufficient");
    // In the Items group of the menu, after the abilities.
    const menu = rulesetMenuGroups(rulesetCombatOptions(ember, start, "ada") as never);
    assert.deepEqual(
      menu.map((group) => group.kind),
      ["item", "contest", "standard", "end-turn"],
    );
    assert.deepEqual(
      [menu[0]!.labelKey, menu[0]!.options.map((option) => option.id)],
      ["game.combat.ruleset.group.item", ["use:0"]],
    );
  }
  {
    // A tonic on the quick budget leaves the act for a blow, and it clears a box of harm.
    const start = fight(gravewatch, [held(spade, "Grave spade", true), held(tonic, "Warming tonic")], {
      wounds: { harm: { marks: ["knock", "knock"] } },
    });
    assert.deepEqual(optionOf(gravewatch, start, "use:1")?.targets, { side: "self", count: 1 });
    const swallowed = take(gravewatch, start, "use:1", ["ada"]);
    assert.deepEqual(firstOf(swallowed.events, "budget"), { type: "budget", actorId: "ada", budget: "quick", left: 0 });
    assert.equal(firstOf(swallowed.events, "heal").amount, 1);
    assert.ok(optionOf(gravewatch, swallowed.state, "item:0"), "the spade still swings on the act");
    assert.equal(optionOf(gravewatch, swallowed.state, "use:1"), undefined, "and the only tonic is gone");
    // A worn spade is not used, and a tonic that is not carried is not either.
    assert.equal(optionOf(gravewatch, start, "use:0"), undefined);
    assert.equal(optionOf(gravewatch, fight(gravewatch, [held(spade, "Grave spade", true)]), "use:1"), undefined);
  }
  {
    // The bell rings only while worn (and bound, which is what worn means for it). Its three charges
    // are all there when its stack keeps no count, and each ring spends one.
    assert.equal(optionOf(gravewatch, fight(gravewatch, [held(bell, "Dawn bell")]), "use:0"), undefined);
    const start = fight(gravewatch, [held(bell, "Dawn bell", true)]);
    const offered = optionOf(gravewatch, start, "use:0");
    assert.deepEqual(
      offered && { kind: offered.kind, budget: offered.budget, targets: offered.targets, left: offered.left },
      { kind: "item", budget: "act", targets: { side: "enemy", count: 1 }, left: 3 },
    );
    const rung = take(gravewatch, start, "use:0", ["foe"], 1);
    assert.deepEqual(firstOf(rung.events, "uses"), {
      type: "uses",
      actorId: "ada",
      optionId: "use:0",
      label: "Dawn bell",
      left: 2,
      of: 3,
    });
    const save = firstOf(rung.events, "save");
    assert.deepEqual([save.save, save.difficulty, save.success], ["steel", 7, false]);
    assert.deepEqual(firstOf(rung.events, "condition"), {
      type: "condition",
      targetId: "foe",
      condition: "rattled",
      active: true,
      reason: "applied",
    });
    assert.deepEqual(ada(rung.state).charges, { 0: 2 });
    assert.equal(ada(rung.state).itemsUsed, undefined, "a bell is not used up");
    assert.equal(optionOf(gravewatch, nextTurn(gravewatch, rung.state), "use:0")?.left, 2);
    // What its stack kept is what the fight starts with, and a bell with none left is not rung.
    const lastOne = fight(gravewatch, [{ ...held(bell, "Dawn bell", true), charges: 1 }]);
    assert.equal(optionOf(gravewatch, lastOne, "use:0")?.left, 1);
    const spent = take(gravewatch, lastOne, "use:0", ["foe"], 1);
    assert.equal(firstOf(spent.events, "uses").left, 0);
    assert.equal(optionOf(gravewatch, nextTurn(gravewatch, spent.state), "use:0"), undefined);
    assert.equal(
      optionOf(gravewatch, fight(gravewatch, [{ ...held(bell, "Dawn bell", true), charges: 0 }]), "use:0"),
      undefined,
    );
    // A use that spends two needs two, and more kept than it holds reads as full.
    const twice = parsedOrThrow(
      variant(gravewatchText, (doc) => (itemEntry(doc, "dawn-bell").item.use.charges = 2)),
      "a bell that spends two",
    );
    const twiceBell = itemOf(twice, "kit/dawn-bell");
    assert.equal(optionOf(twice, fight(twice, [{ ...held(twiceBell, "Bell", true), charges: 1 }]), "use:0"), undefined);
    assert.equal(optionOf(twice, fight(twice, [{ ...held(twiceBell, "Bell", true), charges: 9 }]), "use:0")?.left, 3);
    const rungTwice = take(twice, fight(twice, [held(twiceBell, "Bell", true)]), "use:0", ["foe"], 1);
    assert.deepEqual([firstOf(rungTwice.events, "uses").left, ada(rungTwice.state).charges], [1, { 0: 1 }]);
    // Charges read off a stat the item does not give are a bell that never rings.
    const byStat = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        doc.items.stats.push({ id: "peals", label: "Peals", type: "number", min: 0, max: 9 });
        const item = itemEntry(doc, "dawn-bell").item;
        item.charges.max = { stat: "peals" };
        item.stats.peals = 5;
      }),
      "charges read off a stat",
    );
    const statBell = itemOf(byStat, "kit/dawn-bell");
    assert.equal(optionOf(byStat, fight(byStat, [held(statBell, "Bell", true)]), "use:0")?.left, 5);
    // A stat is held to the most charges a written count may be, so the stack never keeps more.
    const loud = { ...statBell, stats: { ...statBell.stats, peals: 500 } };
    assert.equal(optionOf(byStat, fight(byStat, [held(loud, "Bell", true)]), "use:0")?.left, 100);
    const loudCharges = rulesetItemFacts(byStat, loud).use?.charges;
    assert.deepEqual([loudCharges?.cost, loudCharges?.max], [1, 100]);
    const statless = { ...statBell, stats: { conceal: "pocket" } };
    assert.equal(optionOf(byStat, fight(byStat, [held(statless, "Bell", true)]), "use:0"), undefined);
    // A use that rolls to hit adds its own to-hit, as a weapon's does, and a pool fight's its target.
    const thrownAt = (toHit?: Record<string, unknown>) =>
      parsedOrThrow(
        variant(emberText, (doc) => {
          Object.assign(itemEntry(doc, "poultice").item.use, {
            kind: "attack",
            attackRoll: true,
            targets: "enemy",
            range: 6,
            amount: { dice: "1d6" },
            ...(toHit ? { toHit } : {}),
          });
        }),
        "a poultice thrown",
      );
    const actionOf = (definition: RulesetDefinition, items: RulesetSheetItem[]) =>
      ada(fight(definition, items)).actions.find((action) => action.id === "use:0");
    const aimed = thrownAt({ abilities: ["wits"], bonus: 2 });
    const plain = thrownAt();
    const wits = { ...defaultRulesetSheetBuild(ember).abilities };
    assert.equal(
      actionOf(plain, [held(itemOf(plain, "outfitter/poultice"), "Poultice")])?.toHit,
      0,
      "nothing without one",
    );
    assert.equal(
      actionOf(aimed, [held(itemOf(aimed, "outfitter/poultice"), "Poultice")])?.toHit,
      (wits.wits ?? 0) + 2,
      "wits and the bonus",
    );
    const flung = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const use = itemEntry(doc, "warming-tonic").item.use;
        // A blow restores nobody's pool.
        delete use.restore;
        Object.assign(use, {
          kind: "attack",
          attackRoll: true,
          targets: "enemy",
          amount: { dice: "1d10" },
          toHit: { abilities: ["nerve"], target: 8 },
        });
      }),
      "a tonic flung",
    );
    assert.equal(actionOf(flung, [held(itemOf(flung, "kit/warming-tonic"), "Tonic")])?.target, 8);
    // And the facts and the Game Master's line say that target, as a weapon's do.
    const flungFacts = rulesetItemFacts(flung, itemOf(flung, "kit/warming-tonic"));
    assert.equal(flungFacts.use?.target, 8);
    assert.match(rulesetItemPromptFacts(flungFacts), /; use \(Quick\): 1d10, Nerve to hit at 8, used up$/);
    // So is a save whose number is read off a stat the item does not give; one it gives is the number.
    const saveByStat = parsedOrThrow(
      variant(gravewatchText, (doc) => (itemEntry(doc, "dawn-bell").item.use.saveDifficulty = { stat: "target" })),
      "a save's number read off a stat",
    );
    const unmarked = itemOf(saveByStat, "kit/dawn-bell");
    assert.equal(optionOf(saveByStat, fight(saveByStat, [held(unmarked, "Bell", true)]), "use:0"), undefined);
    const marked = { ...unmarked, stats: { ...unmarked.stats, target: 6 } };
    const rungAt = take(saveByStat, fight(saveByStat, [held(marked, "Bell", true)]), "use:0", ["foe"], 1);
    assert.equal(firstOf(rungAt.events, "save").difficulty, 6);
    // A use that harms is still nobody's strike at a passer-by.
    const harms = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const use = itemEntry(doc, "warming-tonic").item.use;
        delete use.restore;
        use.kind = "attack";
        use.targets = "enemy";
        use.amount = { dice: "2d10" };
      }),
      "a tonic thrown",
    );
    assert.equal(
      rulesetOpportunityAttack(ada(fight(harms, [held(itemOf(harms, "kit/warming-tonic"), "Tonic")]))),
      null,
    );
  }

  // ── Written to the inventory ──
  {
    const book = rulesetItemBook(ember, entriesOf(ember));
    const stacks: GameInventoryStack[] = [
      { id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2 },
    ];
    const start = fight(ember, rulesetSheetItems(book, stacks, undefined), hurt);
    const used = take(ember, start, "use:0", ["ada"]);
    const changes = rulesetFightItemChanges(start, used.state);
    assert.deepEqual(changes, [
      { stack: { id: "st-poultice", ref: "outfitter/poultice" }, name: "Poultice", taken: 1 },
    ]);
    const written = applyRulesetFightItemChanges(stacks, changes)!;
    assert.equal(written.stacks[0]!.quantity, 1);
    assert.deepEqual(written.journal, [{ item: "Poultice", action: "used", quantity: 1 }]);
    // A bell's charges are kept on its stack, and read back from it.
    const kit = rulesetItemBook(gravewatch, entriesOf(gravewatch));
    const bellStacks: GameInventoryStack[] = [
      { id: "st-bell", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, equipped: true, bound: true, charges: 2 },
    ];
    const bellItems = rulesetSheetItems(kit, bellStacks, undefined);
    assert.equal(bellItems[0]!.charges, 2);
    assert.equal(bellItems[0]!.worn, true);
    const bellFight = fight(gravewatch, bellItems);
    const rung = take(gravewatch, bellFight, "use:0", ["foe"], 1);
    const bellChanges = rulesetFightItemChanges(bellFight, rung.state);
    assert.deepEqual(bellChanges, [
      { stack: { id: "st-bell", ref: "kit/dawn-bell" }, name: "Dawn bell", taken: 0, charges: 1 },
    ]);
    assert.deepEqual(rulesetFightItemChanges(rung.state, rung.state), [], "a step that rang nothing writes nothing");
    const bellWritten = applyRulesetFightItemChanges(bellStacks, bellChanges)!;
    assert.equal(bellWritten.stacks[0]!.charges, 1);
    assert.deepEqual(bellWritten.journal, []);
    // A bell given away or gone is refused, so the step is too.
    assert.equal(applyRulesetFightItemChanges([], bellChanges), null, "the stack is gone");
    assert.equal(
      applyRulesetFightItemChanges([{ ...bellStacks[0]!, holder: "Juno" }], bellChanges),
      null,
      "the stack given to somebody else",
    );
  }

  // ── Kept on a stack of one ──
  {
    const [kept, many] = normalizeGameInventoryStacks([
      { id: "a", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, charges: 0 },
      { id: "b", name: "Dawn bell", item: "kit/dawn-bell", quantity: 2, charges: 1 },
    ]);
    assert.equal(kept!.charges, 0);
    assert.equal(many!.charges, undefined, "charges are one item's");
    for (const bad of [-1, 1.5, "1", null]) {
      assert.equal(
        normalizeGameInventoryStacks([{ id: "c", name: "Bell", quantity: 1, charges: bad }])[0]!.charges,
        undefined,
      );
    }
    const poured = mergeGameInventoryStacks(
      [
        { id: "a", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, charges: 0 },
        { id: "b", name: "Dawn bell", item: "kit/dawn-bell", quantity: 1, charges: 3 },
      ],
      "a",
      "b",
    );
    assert.deepEqual(poured, [{ id: "b", name: "Dawn bell", item: "kit/dawn-bell", quantity: 2 }]);
  }

  // ── A party member the Engine plays uses a poultice on whoever is hurt ──
  {
    const bestiary = Object.fromEntries(
      (ember.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const built = createRulesetFight({
      definition: ember,
      seed: 3,
      party: [
        { id: "ada", name: "Ada" },
        { id: "bo", name: "Bo" },
      ],
      enemies: [{ id: "moth", name: "Cinder-moth", creature: "road_trouble/cinder-moth" }],
      cards: [
        { name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(ember) } },
        { name: "Bo", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(ember) } },
      ],
      playerName: null,
      live: { bo: hurt },
      items: (name: string) => (name === "Ada" ? [held(poultice, "Poultice", false, 1)] : []),
      partyCatalogs: {},
      bestiary,
    });
    assert.ok(built.ok, built.ok ? "" : built.error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player"), unit("bo", "Bo", "player")],
      enemies: [unit("moth", "Cinder-moth", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = built.fight;
    syncRulesetCombatants(ember, state);
    state.stage = rulesetDirectorStage(state);
    for (const unitId of ["ada", "bo"]) {
      assert.ok(commandRulesetCombatDirector(ember, state, { type: "control", unitId, controller: "ai" }).ok);
    }
    const said = () => state.rulesetFight!.events.map((entry) => entry.event);
    let guard = 0;
    while (!state.outcome && !said().some((event) => event.type === "uses") && guard++ < 40) {
      assert.ok(commandRulesetCombatDirector(ember, state, { type: "continue" }).ok);
    }
    const events = said();
    const usedAt = events.findIndex((event) => event.type === "uses" && event.actorId === "ada");
    assert.ok(usedAt >= 0, `Ada used the poultice: ${JSON.stringify(events.map((event) => event.type))}`);
    const healed = events.slice(usedAt).find((event) => event.type === "heal");
    assert.equal(healed && healed.type === "heal" ? healed.targetId : undefined, "bo", "on Bo, who was hurt");
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(ember, poultice).use, {
      budget: "Action",
      kind: "heal",
      amount: "1d4 + 1",
      range: 0,
      unit: "paces",
      consumes: true,
    });
    assert.deepEqual(rulesetItemFacts(gravewatch, bell).use, {
      budget: "Act",
      kind: "debuff",
      save: { save: "Steel", difficulty: 7, onSuccess: "negates" },
      applies: ["Rattled"],
      charges: {
        cost: 1,
        max: 3,
        recharge: { rests: ["Stand down from the vigil"], amount: "max" },
        breaksOn: { die: 20, atMost: 1 },
      },
    });
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, poultice)),
      /; use \(Action\): heals 1d4 \+ 1, range 0 paces, used up$/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, tonic)),
      /; use \(Quick\): heals 1, restores 1 Resolve, used up$/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, bell)),
      /; use \(Act\): Steel 7 save negates it, Rattled, spends 1 of 3 charges, regains all on Stand down from the vigil, breaks on a 1 on a d20 when emptied$/,
    );
    // A free use, a typed blow that rolls to hit and asks a save for half, and temporary points.
    const thrown = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.sheet.saves = [{ id: "nerve", label: "Nerve", ability: "heart" }];
        const use = itemEntry(doc, "poultice").item.use;
        Object.assign(use, {
          kind: "attack",
          attackRoll: true,
          toHit: { abilities: ["wits"], bonus: 1 },
          targets: "enemy",
          range: 6,
          area: { shape: "burst", size: 2 },
          amount: { dice: "2d6" },
          damageType: "burn",
          save: { save: "nerve", onSuccess: "half" },
          saveDifficulty: 12,
          temporary: { flat: 2 },
          free: true,
        });
        delete use.budget;
      }),
      "a poultice thrown",
    );
    const thrownFacts = rulesetItemFacts(thrown, itemOf(thrown, "outfitter/poultice")).use;
    assert.equal(thrownFacts?.budget, undefined);
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(thrown, itemOf(thrown, "outfitter/poultice"))),
      /; use \(free\): 2d6 burn, Wits \+ 1 to hit, Nerve 12 save for half, 2 temporary, range 6 paces, burst 2 paces, used up$/,
    );
    // An item the Game Master invents like the bell rings as the bell does, charges and all.
    const kitGm = rulesetItemBook(gravewatch, entriesOf(gravewatch), { actor: "game-master" });
    const chime = kitGm.invent!(
      { name: "Vesper chime", category: "token", rarity: "relic", slots: { worn: "1" }, like: "Dawn bell" },
      [],
    );
    assert.ok("item" in chime, "the chime is made");
    const made = kitGm.itemOf(chime.item)!.entry.item!;
    assert.deepEqual([made.use?.kind, made.use?.charges, made.charges, made.stack], ["debuff", 1, bell.charges, 1]);
    const tonicGm = kitGm.invent!({ name: "Hot cordial", category: "tonic", like: "Warming tonic" }, []);
    assert.ok("item" in tonicGm, "the cordial is made");
    assert.equal(kitGm.itemOf(tonicGm.item)!.entry.item!.use?.consumes, true);
  }

  console.log(
    "Ruleset item use: import checks, the 1.59 gate, using an item up or spending its charges in a fight, the inventory write-back, the Engine's own party member, and item facts passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
