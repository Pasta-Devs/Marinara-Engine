/**
 * Weapons as items (#6855, Capability API 1.55).
 *
 *   - An item's `attack` is read and checked at import: the ids it names, the kind of every stat it
 *     reads, and only what this ruleset's fights can do. A ruleset with no combat block carries one
 *     and reads nothing. The install gate asks for 1.55, in the ruleset file and in a catalog file.
 *   - A worn weapon is an attack in a ruleset fight: to hit from the best of its abilities with its
 *     skill, the proficiency bonus, its bonus; damage with the best of its damage abilities; reach
 *     and range in cells (both: thrown); versatile dice with a hand free; strikes; each value read
 *     off the item's own stat where it says so. One put away offers nothing.
 *   - In a pool fight a weapon's own target is the per-die target its attack is thrown against, and
 *     its forecast counts it.
 *   - A creature's resistance or immunity may name item tags a blow gets through it with, and a
 *     weapon's tags are what its blows carry.
 *   - Item facts and the Game Master's line say the attack, and an item invented like a weapon fights
 *     with its own stats.
 *   - A rider may name held weapons by item tag (1.70), so a held weapon carries it as a row does.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  inventRulesetItem,
  parseRulesetDefinition,
  RULESET_CATALOG_ROW_KEY,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatAction,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-weapons-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

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
  const creatureEntry = (doc: Record<string, any>, id: string) =>
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );

  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  const itemOf = (book: typeof emberBook, ref: string): RulesetCatalogItem => {
    const found = book.itemOf(ref)?.entry.item;
    assert.ok(found, `the book has ${ref}`);
    return found;
  };
  const held = (item: RulesetCatalogItem, name: string, worn = true, quantity = 1): RulesetSheetItem => ({
    item,
    quantity,
    worn,
    name,
  });
  const build = (definition: RulesetDefinition, abilities: Record<string, number>) => ({
    ...defaultRulesetSheetBuild(definition),
    abilities: { ...defaultRulesetSheetBuild(definition).abilities, ...abilities },
  });
  const axe = itemOf(emberBook, "outfitter/hand-axe");
  const spear = itemOf(emberBook, "outfitter/boar-spear");
  const bow = itemOf(emberBook, "outfitter/hunting-bow");
  const spade = itemOf(graveBook, "kit/grave-spade");
  const nail = itemOf(graveBook, "kit/silver-nail");

  // ── Import ──
  {
    assert.deepEqual(axe.attack, {
      budget: "act",
      toHit: { abilities: { stat: "swing" } },
      damage: { dice: { stat: "damage" }, abilities: { stat: "swing" }, type: "cut" },
      reach: 2,
      range: { normal: 10, long: 20 },
    });
    const attack = (id: string, edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, id).item.attack);
    const cases: Array<[string, string, (doc: Record<string, any>) => void, RegExp]> = [
      ["an unknown budget", emberText, attack("hand-axe", (a) => (a.budget = "swing")), /Unknown budget "swing"/],
      [
        "an unknown ability",
        emberText,
        attack("hand-axe", (a) => (a.toHit.abilities = ["might"])),
        /attack\.toHit\.abilities\.0: Unknown ability "might"/,
      ],
      [
        "abilities off a stat that is no enum",
        emberText,
        attack("hand-axe", (a) => (a.toHit.abilities = { stat: "bulk" })),
        /Item stat "bulk" must be enum/,
      ],
      [
        "abilities off an enum of other words",
        emberText,
        attack("hand-axe", (a) => (a.toHit.abilities = { stat: "reach" })),
        /Item stat "reach" holds "close", which is not an ability/,
      ],
      ["an unknown skill", emberText, attack("hand-axe", (a) => (a.toHit.skill = "fly")), /Unknown skill "fly"/],
      [
        "a skill off an enum of abilities",
        emberText,
        attack("hand-axe", (a) => (a.toHit.skill = { stat: "swing" })),
        /Item stat "swing" holds "brawn", which is not a skill/,
      ],
      [
        "a bonus off a dice stat",
        emberText,
        attack("hand-axe", (a) => (a.toHit.bonus = { stat: "damage" })),
        /Item stat "damage" must be number/,
      ],
      [
        "dice off a number stat",
        emberText,
        attack("hand-axe", (a) => (a.damage.dice = { stat: "bulk" })),
        /Item stat "bulk" must be dice/,
      ],
      [
        "a type off a number stat",
        emberText,
        attack("hand-axe", (a) => (a.damage.type = { stat: "bulk" })),
        /Item stat "bulk" must be text or enum/,
      ],
      [
        "an unknown stat",
        emberText,
        attack("hand-axe", (a) => (a.reach = { stat: "heft" })),
        /attack\.reach\.stat: Unknown item stat "heft"/,
      ],
      [
        "a type the ruleset does not have",
        gravewatchText,
        attack("grave-spade", (a) => (a.damage.type = "cut")),
        /Unknown damage type "cut"/,
      ],
      [
        "a type off an enum of other words",
        gravewatchText,
        attack("grave-spade", (a) => (a.damage.type = { stat: "conceal" })),
        /Item stat "conceal" holds "pocket", which is not a damage type/,
      ],
      [
        "no dice in a summed fight",
        emberText,
        attack("hand-axe", (a) => delete a.damage.dice),
        /attack\.damage\.dice: A weapon deals dice, a bonus, or what its hit puts on/,
      ],
      [
        "a target in a summed fight",
        emberText,
        attack("hand-axe", (a) => (a.toHit.target = 7)),
        /A weapon's own target is a pool fight's; in this ruleset its bonus says the same/,
      ],
      [
        "a target where the pool's cannot move",
        gravewatchText,
        (doc) => (doc.resolution.target = { default: 7, min: 7, max: 7 }),
        /A weapon's own target moves the pool's, so target\.min is below target\.max/,
      ],
      [
        "a long distance short of the ordinary one",
        emberText,
        attack("hand-axe", (a) => (a.range = { normal: 10, long: 4 })),
        /The long distance is at least the ordinary one/,
      ],
      [
        "a weapon nobody can wear",
        emberText,
        (doc) => delete itemEntry(doc, "hand-axe").item.slots,
        /A weapon is used while it is worn, so it takes a slot or binds/,
      ],
      [
        "versatile dice with no slot",
        emberText,
        (doc) => {
          const entry = itemEntry(doc, "boar-spear");
          delete entry.item.slots;
          entry.item.binds = {};
          doc.items.binding = doc.items.binding ?? { label: "Bound", max: { const: 3 } };
        },
        /Versatile dice are for a hand free beside the weapon, so it takes a slot/,
      ],
      [
        "no strike at all",
        emberText,
        attack("hand-axe", (a) => (a.strikes = { const: 0 })),
        /One spend buys at least one strike/,
      ],
      [
        "proficiency off an unknown value",
        emberText,
        attack("hand-axe", (a) => (a.toHit.proficiency = { derived: "martial" })),
        /Unknown derived value "martial"/,
      ],
      [
        "a sheet bonus off an unknown value (1.95)",
        emberText,
        attack("hand-axe", (a) => (a.toHit.sheetBonus = { derived: "aim" })),
        /Unknown derived value "aim"/,
      ],
      [
        "a distance with no cell to measure it in",
        emberText,
        (doc) => {
          delete doc.combat.distance;
          delete doc.combat.economy.movement;
          for (const source of doc.combat.attacks) delete source.reach;
        },
        /attack\.reach: "reach" is measured in cells, so the combat block declares "distance" too/,
      ],
    ];
    for (const [what, text, edit, pattern] of cases) refused(text, edit, pattern, what);
    // A type read off an enum is matched as the ruleset's damage types are: trimmed, in any case.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const harm = doc.items.stats.find((stat: { id: string }) => stat.id === "harm");
        harm.values = harm.values.map((word: string) => (word === "blunt" ? " Blunt " : word));
        for (const entry of itemCatalogOf(doc).entries) {
          if (entry.item.stats?.harm === "blunt") entry.item.stats.harm = " Blunt ";
        }
      }),
      "a damage type written loosely in an enum",
    );
    // A pool fight's weapon may deal nothing past its successes; a ruleset with no combat block
    // carries a weapon and reads nothing.
    parsedOrThrow(
      variant(gravewatchText, (doc) => delete itemEntry(doc, "grave-spade").item.attack.damage.dice),
      "a pool weapon with no dice of its own",
    );
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        delete doc.combat;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
      }),
      "a weapon in a ruleset with no fights",
    );

    // What gets through a resistance is a weapon's tags, so the ruleset's item tags.
    assert.deepEqual(rulesetCombatantResist(), [{ type: "tearing", except: ["silver"] }]);
    const wight = (edit: (creature: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(creatureEntry(doc, "grave-wight").creature);
    refused(
      gravewatchText,
      wight((creature) => (creature.resist[0].except = ["gold"])),
      /resist\.0\.except\.0: Unknown item tag "gold"/,
      "an unknown tag",
    );
    refused(
      gravewatchText,
      wight((creature) => (creature.immune = [{ type: "cut", except: ["silver"] }])),
      /immune\.0\.type: Unknown damage type "cut"/,
      "an unknown type beside what gets through",
    );
    refused(
      gravewatchText,
      (doc) => {
        delete doc.items.tags;
        for (const entry of itemCatalogOf(doc).entries) delete entry.item.tags;
      },
      /This ruleset declares no item tags for a blow to carry/,
      "no tags to name",
    );
    refused(
      gravewatchText,
      wight((creature) => (creature.resist[0].except = [])),
      /except/,
      "an exception that names nothing",
    );
  }

  /** The grave wight's resistance, as a fight builds its block out of the bestiary. */
  function rulesetCombatantResist() {
    const state = createRulesetEncounter({
      definition: gravewatch,
      seed: 1,
      bestiary: entriesOf(gravewatch),
      combatants: [
        { id: "wight", name: "Grave wight", side: "enemy", creature: { catalogId: "night", entryId: "grave-wight" } },
      ],
    });
    return rulesetCombatant(state, "wight")!.block?.resist;
  }

  // ── Install gate: 1.55, in the ruleset file and in a catalog file ──
  {
    /** Less what the examples' items do in a fight, what their weapons shoot and load, the other ways
     *  they fight and what their items do when used, which are 1.56's to 1.59's and have lanes of
     *  their own. */
    const withoutArmor = (text: string) =>
      JSON.stringify(
        variant(text, (doc) => {
          // And the loot, which is 1.63's.
          delete doc.items?.lootTables;
          for (const catalog of doc.catalogs) for (const entry of catalog.entries ?? []) delete entry.creature?.loot;
          for (const layer of doc.layers ?? []) delete layer.currencies;
          // And the market, which is 1.65's.
          delete doc.items?.market;
          for (const catalog of doc.catalogs ?? []) {
            for (const entry of catalog.entries ?? []) {
              delete entry.item?.sold;
              delete entry.item?.service;
            }
          }
          delete doc.combat?.offHand;
          for (const catalog of doc.catalogs) {
            for (const entry of catalog.entries ?? []) {
              for (const key of ["ammo", "clip", "modes", "offHand", "floor", "onHit"]) {
                delete entry.item?.attack?.[key];
              }
              delete entry.item?.use;
              delete entry.item?.charges;
              for (const when of ["worn", "carried"]) {
                const effect = entry.item?.[when];
                if (!effect) continue;
                for (const key of ["resist", "vulnerable", "immune", "conditionImmunities"]) delete effect[key];
                effect.modifiers = effect.modifiers?.filter((one: { to: string }) =>
                  ["checks", "saves"].includes(one.to),
                );
                if (!effect.modifiers?.length) delete effect.modifiers;
                if (Object.keys(effect).every((key) => key === "$comment")) delete entry.item[when];
              }
            }
          }
        }),
      );
    const emberBefore156 = withoutArmor(emberText);
    const gravewatchBefore156 = withoutArmor(gravewatchText);
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-weapons",
      name: "Weapons",
      version: "0.1.0",
      description: "A packaged ruleset whose items are weapons.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /items are weapons, or whose creatures name what gets through.*capabilityApi 1\.55/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const withoutWeapons = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) delete entry.item.attack;
    };
    const withoutWight = (doc: Record<string, any>) => {
      const bestiary = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
      bestiary.entries = bestiary.entries.filter((entry: { id: string }) => entry.id !== "grave-wight");
    };
    assert.match(issue(54, variant(emberBefore156)) ?? "", gateIssue);
    assert.equal(issue(55, variant(emberBefore156)), null);
    assert.equal(issue(54, variant(emberBefore156, withoutWeapons)), null, "the rest of the example stays 1.54");
    assert.match(issue(54, variant(gravewatchBefore156, withoutWeapons)) ?? "", gateIssue, "the wight on its own");
    assert.match(issue(54, variant(gravewatchBefore156, withoutWight)) ?? "", gateIssue, "the weapons on their own");
    assert.equal(
      issue(
        54,
        variant(gravewatchBefore156, (doc) => {
          withoutWeapons(doc);
          withoutWight(doc);
        }),
      ),
      null,
      "Gravewatch without either",
    );
    // A resistance written as a word is what it always was.
    assert.equal(
      issue(
        54,
        variant(gravewatchBefore156, (doc) => {
          withoutWeapons(doc);
          creatureEntry(doc, "grave-wight").creature.resist = ["tearing"];
        }),
      ),
      null,
    );
    const inFile = variant(emberBefore156, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = itemCatalogOf(variant(emberBefore156)).entries;
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(54, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(55, inFile, paths, files), null);
  }

  // ── A worn weapon is an attack in a fight (Ember Roads, a summed fight) ──
  const hound: RulesetCombatantInput = {
    id: "hound",
    name: "Hound",
    side: "enemy",
    block: { health: 30, defense: 6, initiativeModifier: -5, actions: [] },
  };
  // Less the tags each carries for what follows the attack action (1.246), checked once below.
  const weaponsOf = (state: RulesetEncounterState, id = "juno"): RulesetCombatAction[] =>
    rulesetCombatant(state, id)!
      .actions.filter((action) => action.id.startsWith("item:"))
      .map(({ itemTags: _itemTags, ...action }) => action);
  const emberFight = (
    items: RulesetSheetItem[],
    abilities: Record<string, number> = { brawn: 2, wits: 1 },
    definition = ember,
    skills: Record<string, string> = {},
  ) =>
    createRulesetEncounter({
      definition,
      seed: 5,
      roller: () => 4,
      combatants: [
        { id: "juno", name: "Juno", side: "party", build: { ...build(definition, abilities), skills }, items },
        hound,
      ],
    });
  {
    const both = emberFight([held(axe, "Hand axe"), held(spear, "Boar spear"), held(bow, "Hunting bow", false)]);
    assert.deepEqual(rulesetCombatant(both, "juno")!.actions.find((one) => one.id === "item:0")?.itemTags, ["thrown"]);
    assert.deepEqual(weaponsOf(both), [
      {
        id: "item:0",
        kind: "attack",
        label: "Hand axe",
        budget: "act",
        targets: { side: "enemy", count: 1 },
        // Two paces a cell: a swing one cell off, a throw five, ten at the longest.
        reach: 1,
        range: { normal: 5, long: 10 },
        ability: "brawn",
        toHit: 2,
        damage: { count: 1, sides: 6, flat: 2, type: "cut", qualities: ["thrown"] },
        damageAddsAbility: true,
      },
      {
        id: "item:1",
        kind: "attack",
        label: "Boar spear",
        budget: "act",
        targets: { side: "enemy", count: 1 },
        reach: 2,
        range: { normal: 5 },
        ability: "brawn",
        toHit: 2,
        // Both hands are full, so the spear deals its own die rather than its versatile one.
        damage: { count: 1, sides: 6, flat: 2, type: "cut", qualities: ["thrown"] },
        damageAddsAbility: true,
      },
    ]);
    assert.ok(
      rulesetCombatOptions(ember, both, "juno").some((option) => option.id === "item:0" && option.label === "Hand axe"),
      "on the menu",
    );
    // With a hand free beside it, the spear is driven in with both.
    assert.deepEqual(weaponsOf(emberFight([held(spear, "Boar spear")]))[0]!.damage, {
      count: 1,
      sides: 8,
      flat: 2,
      type: "cut",
      qualities: ["thrown"],
    });
    // Two spears fill both hands between them.
    assert.equal(weaponsOf(emberFight([held(spear, "Boar spears", true, 2)]))[0]!.damage!.sides, 6);
    // The bow is carried, not held, so it offers nothing; held, it shoots and swings at nothing.
    assert.deepEqual(weaponsOf(emberFight([held(bow, "Hunting bow", false)])), []);
    const shot = weaponsOf(emberFight([held(bow, "Hunting bow")]))[0]!;
    assert.deepEqual(
      [shot.reach, shot.range, shot.toHit, shot.damage?.flat],
      [undefined, { normal: 15, long: 30 }, 1, 1],
    );

    // Each value read off the item's stat: another swing is another ability, and a stat the item
    // gives nothing is as if the value were not written.
    const wits = { ...axe, stats: { ...axe.stats, swing: "wits", damage: "1d10" } };
    assert.deepEqual(
      [
        weaponsOf(emberFight([held(wits, "Wits axe")]))[0]!.toHit,
        weaponsOf(emberFight([held(wits, "Wits axe")]))[0]!.damage,
      ],
      [1, { count: 1, sides: 10, flat: 1, type: "cut", qualities: ["thrown"] }],
    );
    const noSwing = { ...axe, stats: { bulk: 1, damage: "1d6" } };
    assert.deepEqual(
      [
        weaponsOf(emberFight([held(noSwing, "Plain axe")]))[0]!.toHit,
        weaponsOf(emberFight([held(noSwing, "Plain axe")]))[0]!.damage!.flat,
      ],
      [0, 0],
    );
    assert.deepEqual(
      weaponsOf(emberFight([held({ ...axe, stats: { bulk: 1 } }, "No head")])),
      [],
      "no dice, no attack",
    );

    // The best of several abilities, a skill with the attack's ability in place of its own, the
    // proficiency bonus where the holder reads as proficient, and bonuses.
    const proficient = parsedOrThrow(
      variant(emberText, (doc) => (doc.resolution.proficiency = { bonus: { const: 2 } })),
      "Ember Roads with a proficiency bonus",
    );
    const fancy: RulesetCatalogItem = {
      ...axe,
      attack: {
        budget: "act",
        toHit: { abilities: ["brawn", "wits"], skill: "scrap", proficiency: { const: 1 }, bonus: 1 },
        damage: { dice: "1d6", abilities: ["heart", "wits"], bonus: -1, type: "cut" },
        strikes: { const: 2 },
      },
    };
    const expert = { scrap: "expert" };
    const fancyFight = emberFight([held(fancy, "Fancy axe")], { brawn: 1, wits: 3, heart: 0 }, proficient, expert);
    const fancyAttack = weaponsOf(fancyFight)[0]!;
    // Scrap is Brawn's skill: with Wits in its place (3, the better of the two) an expert adds 5,
    // then 2 for proficiency and 1 more.
    assert.deepEqual([fancyAttack.toHit, fancyAttack.damage?.flat, fancyAttack.strikes], [8, 2, 2]);
    const notProficient = {
      ...fancy,
      attack: { ...fancy.attack!, toHit: { ...fancy.attack!.toHit, proficiency: { const: 0 } } },
    };
    assert.equal(
      weaponsOf(emberFight([held(notProficient, "Fancy axe")], { brawn: 1, wits: 3 }, proficient, expert))[0]!.toHit,
      6,
    );

    // Swung: the log's attack carries the weapon's name, and its harm its type.
    const swing = applyRulesetCombatChoice(
      ember,
      both,
      { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
      () => 4,
    );
    const attackEvent = swing.events.find((event) => event.type === "attack") as Extract<
      RulesetCombatEvent,
      { type: "attack" }
    >;
    assert.deepEqual([attackEvent.label, attackEvent.total, attackEvent.outcome], ["Hand axe", 10, "hit"]);
    const harm = swing.events.find((event) => event.type === "damage") as Extract<
      RulesetCombatEvent,
      { type: "damage" }
    >;
    assert.deepEqual([harm.damageType, harm.amount], ["cut", 6]);
  }

  // ── No damage dice (1.511): a bonus alone, or nothing but what the hit puts on ──
  {
    const blowgun = { ...axe, attack: { ...axe.attack!, damage: { bonus: 1, type: "pierce" } } };
    const net = {
      ...axe,
      attack: {
        ...axe.attack!,
        damage: {},
        onHit: [{ condition: "pinned", atLeast: 0, checkEnds: { check: "brawn", difficulty: 10 } }],
      },
    };
    const shot = emberFight([held(blowgun, "Blowgun")]);
    assert.deepEqual(weaponsOf(shot)[0]?.damage, {
      count: 0,
      sides: 0,
      flat: 1,
      type: "pierce",
      qualities: ["thrown"],
    });
    const puff = applyRulesetCombatChoice(
      ember,
      shot,
      { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
      () => 4,
    );
    const pricked = puff.events.find((event) => event.type === "damage") as Extract<
      RulesetCombatEvent,
      { type: "damage" }
    >;
    assert.equal(pricked?.amount, 1, JSON.stringify(puff.events));
    const netted = emberFight([held(net, "Net")]);
    assert.ok(weaponsOf(netted)[0], "a net is a weapon with nothing to deal");
    const thrown = applyRulesetCombatChoice(
      ember,
      netted,
      { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
      () => 4,
    );
    const pin = rulesetCombatant(thrown.state, "hound")!.tracked.find((one) => one.condition === "pinned");
    assert.deepEqual(pin?.checkEnds, { check: "brawn", difficulty: 10 }, JSON.stringify(thrown.events));
    // Gated at 1.511; the example's own weapons, with their dice, are not.
    const gate1458 =
      "A ruleset whose items attack with no damage dice, or whose weapons put a condition on with any hit or one a check ends (an attack without damage dice, onHit atLeast 0 or checkEnds) requires schemaVersion 2 and capabilityApi 1.511 or newer";
    const at = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ember",
      name: "Ember",
      version: "0.1.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const diceless = variant(emberText, (doc) => (itemEntry(doc, "hand-axe").item.attack.damage = { bonus: 1 }));
    assert.equal(getCapabilityPackageInstallIssue(at(510) as never, diceless), gate1458);
    // And a ruleset file holding them is read (a bonus alone, or only an onHit), not refused.
    const readOk = (doc: unknown) => {
      const result = parseRulesetDefinition(doc);
      assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    };
    readOk(diceless);
    readOk(
      variant(emberText, (doc) => {
        const attack = itemEntry(doc, "hand-axe").item.attack;
        attack.damage = {};
        attack.onHit = [{ condition: "pinned", atLeast: 0, checkEnds: { check: "brawn", difficulty: 10 } }];
      }),
    );
    assert.notEqual(getCapabilityPackageInstallIssue(at(511) as never, diceless), gate1458);
    const anyHit = variant(
      emberText,
      (doc) => (itemEntry(doc, "hand-axe").item.attack.onHit = [{ condition: "pinned", atLeast: 0 }]),
    );
    assert.equal(getCapabilityPackageInstallIssue(at(510) as never, anyHit), gate1458);
    assert.notEqual(getCapabilityPackageInstallIssue(at(510) as never, variant(emberText)), gate1458);
    refused(
      emberText,
      (doc) =>
        (itemEntry(doc, "hand-axe").item.attack.onHit = [
          { condition: "pinned", atLeast: 0, checkEnds: { check: "luck", difficulty: 10 } },
        ]),
      /Unknown check "luck"/,
      "a net's check the ruleset lacks",
    );
  }

  // ── A pool fight: a weapon's own target, and what gets through a resistance (Gravewatch) ──
  {
    const graveFight = (
      items: RulesetSheetItem[],
      foe: Partial<RulesetCombatantInput & { block: any }> = {},
      face = 6,
    ) =>
      createRulesetEncounter({
        definition: gravewatch,
        seed: 5,
        roller: () => face,
        combatants: [
          { id: "ada", name: "Ada", side: "party", build: build(gravewatch, { sinew: 3, nerve: 3 }), items },
          {
            id: "wight",
            name: "Wight",
            side: "enemy",
            block: { health: 30, defense: 1, initiativeModifier: -5, actions: [], ...(foe.block ?? {}) },
          } as RulesetCombatantInput,
        ],
      });
    const spadeFight = graveFight([held(spade, "Grave spade")]);
    const dug = weaponsOf(spadeFight, "ada")[0]!;
    assert.deepEqual(
      [dug.label, dug.target, dug.damage?.count, dug.damage?.sides, dug.damage?.type],
      ["Grave spade", 6, 1, 10, "blunt"],
    );
    // Every die a six: on the spade's own target of 6 each counts, on the pool's 7 none would.
    const struck = applyRulesetCombatChoice(
      gravewatch,
      spadeFight,
      { actorId: "ada", optionId: "item:0", targetIds: ["wight"] },
      () => 6,
    );
    const spadeAttack = struck.events.find((event) => event.type === "attack") as Extract<
      RulesetCombatEvent,
      { type: "attack" }
    >;
    assert.equal(spadeAttack.pool?.target, 6);
    assert.equal(spadeAttack.outcome, "hit");
    const nailFight = graveFight([held(nail, "Silver coffin nail")]);
    const missed = applyRulesetCombatChoice(
      gravewatch,
      nailFight,
      { actorId: "ada", optionId: "item:0", targetIds: ["wight"] },
      () => 6,
    );
    const nailAttack = missed.events.find((event) => event.type === "attack") as Extract<
      RulesetCombatEvent,
      { type: "attack" }
    >;
    assert.deepEqual([nailAttack.pool?.target, nailAttack.outcome], [7, "miss"]);
    // And the forecast counts it: the spade's 6 hits more often than the same pool on 7.
    const chance = (state: RulesetEncounterState) =>
      rulesetCombatOptions(gravewatch, state, "ada").find((option) => option.id === "item:0")?.forecast?.hitChance ?? 0;
    const sameOn7 = graveFight([held({ ...spade, stats: { ...spade.stats, target: 7 } }, "Grave spade")]);
    assert.ok(chance(spadeFight) > chance(sameOn7), `${chance(spadeFight)} against ${chance(sameOn7)}`);

    // Silver gets through: a blow carries the weapon's tags.
    const tearing = (item: RulesetCatalogItem, hide: Record<string, unknown>) => {
      const state = graveFight([held(item, "Nail")], { block: hide }, 8);
      const after = applyRulesetCombatChoice(
        gravewatch,
        state,
        { actorId: "ada", optionId: "item:0", targetIds: ["wight"] },
        () => 8,
      );
      const damage = after.events.find((event) => event.type === "damage") as Extract<
        RulesetCombatEvent,
        { type: "damage" }
      >;
      return damage.adjust;
    };
    const plainNail = { ...nail, tags: ["hidden"] };
    const resist = { resist: [{ type: "tearing", except: ["silver"] }] };
    assert.equal(tearing(nail, resist), "none", "silver gets through");
    assert.equal(tearing(plainNail, resist), "resist", "iron does not");
    assert.equal(tearing(plainNail, { resist: ["tearing"] }), "resist", "a word is what it always was");
    const immune = { immune: [{ type: "tearing", except: ["silver"] }] };
    assert.equal(tearing(nail, immune), "none");
    assert.equal(tearing(plainNail, immune), "immune");
  }

  // ── A rider on held weapons (1.70) ──
  {
    // Ember Roads with a knack that adds a die to the first hit of a turn made with a thrown weapon:
    // the knacks list's rows know nothing of the outfitter's items, so the rider names their tag.
    const ambush = (rider: Record<string, unknown>) => (doc: Record<string, any>) =>
      doc.catalogs
        .find((catalog: { id: string }) => catalog.id === "knacks")
        .entries.push({
          id: "ambush",
          label: "Ambush",
          summary: "A throw nobody saw coming.",
          rows: [{ list: "knacks", values: { name: "Ambush" } }],
          mechanics: { kind: "rider", rider: { on: "hit", oncePer: "turn", amount: { dice: "1d4" }, ...rider } },
        });
    const thrown = { weapons: { tags: ["thrown"] } };
    const withAmbush = parsedOrThrow(variant(emberText, ambush(thrown)), "a rider on thrown weapons");
    refused(
      emberText,
      ambush({ weapons: { tags: ["glass"] } }),
      /rider\.weapons\.tags\.0: Unknown item tag "glass"/,
      "an unknown tag",
    );
    refused(emberText, ambush({ weapons: { tags: [] } }), /weapons\.tags/, "a rider on no tag");
    const riderFight = (definition: RulesetDefinition, items: RulesetSheetItem[], gear: string[] = []) =>
      createRulesetEncounter({
        definition,
        seed: 5,
        roller: () => 4,
        combatants: [
          {
            id: "juno",
            name: "Juno",
            side: "party",
            build: {
              ...build(definition, { brawn: 2, wits: 1 }),
              lists: {
                knacks: [{ name: "Ambush", [RULESET_CATALOG_ROW_KEY]: "knacks/ambush" }],
                gear: gear.map((name) => ({ name, swing: "brawn", damage: "1d4", harm: "cut" })),
              },
            },
            items,
            // Every catalog, rows and all: the knack's entry is in one that writes rows.
            catalogs: Object.fromEntries(
              (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
            ),
          },
          hound,
        ],
      });
    const ridersOf = (state: RulesetEncounterState) =>
      rulesetCombatant(state, "juno")!.riders?.map((rider) => rider.actions);
    // The axe, never the bow, and only held.
    assert.deepEqual(ridersOf(riderFight(withAmbush, [held(axe, "Hand axe"), held(bow, "Hunting bow")])), [["item:0"]]);
    assert.deepEqual(ridersOf(riderFight(withAmbush, [held(axe, "Hand axe", false)])), [[]], "put away");
    assert.deepEqual(
      ridersOf(riderFight(withAmbush, [held(axe, "Hand axe")], ["Knife"])),
      [["item:0"]],
      "a rider that names only weapons fires on no row",
    );
    // An off hand strikes with the same weapon, so it carries the rider too.
    const offHanded = { ...axe, attack: { ...axe.attack!, offHand: true } };
    assert.deepEqual(ridersOf(riderFight(withAmbush, [held(offHanded, "Hand axe")])), [["item:0", "offhand:0"]]);
    // A hit with the axe carries it; one with the bow does not.
    const riders = (state: RulesetEncounterState) =>
      applyRulesetCombatChoice(
        withAmbush,
        state,
        { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
        () => 4,
      ).events.filter((event) => event.type === "rider").length;
    assert.equal(riders(riderFight(withAmbush, [held(axe, "Hand axe")])), 1);
    assert.equal(riders(riderFight(withAmbush, [held(bow, "Hunting bow")])), 0);
    // A rider that names rows fires on no held weapon, as before 1.70; one that names both, on both.
    const onRows = parsedOrThrow(variant(emberText, ambush({ sources: ["gear"] })), "a rider on gear rows");
    assert.deepEqual(ridersOf(riderFight(onRows, [held(axe, "Hand axe")], ["Knife"])), [["attack:0:0"]]);
    const onBoth = parsedOrThrow(variant(emberText, ambush({ sources: ["gear"], ...thrown })), "a rider on both");
    assert.deepEqual(ridersOf(riderFight(onBoth, [held(axe, "Hand axe")], ["Knife"])), [["item:0", "attack:0:0"]]);
    // One that names nothing still fires on any hit.
    assert.deepEqual(ridersOf(riderFight(parsedOrThrow(variant(emberText, ambush({})), "any hit"), [])), [undefined]);

    // The install gate: 1.70, in the ruleset file and in a catalog file.
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-held-riders",
      name: "Held riders",
      version: "0.1.0",
      description: "A packaged ruleset whose riders fire on held weapons.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const heldIssue = /riders fire on held weapons.*capabilityApi 1\.70/;
    const document = variant(emberText, ambush(thrown));
    assert.match(getCapabilityPackageInstallIssue(manifest(69) as any, document) ?? "", heldIssue);
    assert.equal(getCapabilityPackageInstallIssue(manifest(70) as any, document), null);
    assert.equal(getCapabilityPackageInstallIssue(manifest(69) as any, variant(emberText, ambush({}))), null);
    const knacks = document.catalogs.find((catalog: { id: string }) => catalog.id === "knacks");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((catalog: { id: string }) =>
        catalog.id === "knacks" ? { ...catalog, entries: undefined, asset: "catalogs/knacks.json" } : catalog,
      ),
    };
    const paths = ["ruleset.json", "catalogs/knacks.json"];
    const files = new Map<string, unknown>([["catalogs/knacks.json", { entries: knacks.entries }]]);
    assert.match(
      getCapabilityPackageInstallIssue(manifest(69, paths) as any, inFile, files) ?? "",
      heldIssue,
      "a catalog file",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(70, paths) as any, inFile, files), null);
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(ember, spear).attack, {
      budget: "Action",
      toHit: "Brawn",
      damage: "1d6 + Brawn",
      type: "cut",
      reach: 4,
      range: { normal: 10 },
      unit: "paces",
      versatile: "1d8",
    });
    assert.deepEqual(rulesetItemFacts(gravewatch, spade).attack, {
      budget: "Act",
      toHit: "Sinew + Dig",
      target: 6,
      damage: "1d10",
      type: "blunt",
      floor: 1,
    });
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, bow)),
      /; attack \(Action\): Wits to hit, 1d8 \+ Wits cut, range 30 to 60 paces, ammunition Arrow \(1 an attack, 50% picked up after a won fight\), modes Volley \(2 shots, -2 to hit, up to 2 targets\)$/,
    );
    const fancy = {
      ...axe,
      attack: {
        budget: "act",
        toHit: { abilities: ["brawn", "wits"], proficiency: { const: 1 }, bonus: -1 },
        damage: { dice: "1d6", bonus: 2 },
      },
    };
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, fancy)),
      /; attack \(Action\): Brawn\/Wits - 1 \+ proficiency to hit, 1d6 \+ 2$/,
    );
  }

  // ── Invented weapons ──
  {
    const edge = inventRulesetItem(ember, { category: "weapon", rarity: "common", stats: { damage: "1d10" } }, axe)!;
    assert.deepEqual(edge.item.attack, axe.attack, "a weapon made like the axe is a weapon");
    // And it fights with its own damage stat.
    assert.deepEqual(weaponsOf(emberFight([held(edge.item, "Mourning edge")]))[0]!.damage, {
      count: 1,
      sides: 10,
      flat: 2,
      type: "cut",
      qualities: ["thrown"],
    });
    // A weapon the Game Master describes with nothing to start from fights as the ruleset's own weapon
    // of its category it is most like by name, or else the first, and says so.
    const gm = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });
    const proposed = (name: string, extra: Record<string, unknown> = {}) => {
      const made = gm.invent!({ name, category: "weapon", rarity: "common", slots: { hands: "1" }, ...extra }, []);
      assert.ok("item" in made, `${name} is made`);
      const entry = gm.itemOf(made.item)!;
      return { attack: entry.entry.item!.attack, notes: made.notes, stats: entry.entry.item!.stats };
    };
    const heavy = proposed("Heavy Axe", { stats: { damage: "1d8", swing: "brawn" } });
    assert.deepEqual(heavy.attack, axe.attack);
    assert.deepEqual(heavy.notes, ["It fights as Hand axe does."]);
    assert.deepEqual(proposed("Long Crossbow", { slots: { hands: "2" } }).attack, bow.attack, "crossbow is a bow");
    assert.deepEqual(proposed("Warhammer").attack, axe.attack, "the first weapon when no name is shared");
    assert.deepEqual(proposed("Spear of the Ford").attack, spear.attack);
    // What its attack reads that the proposal left out comes from that weapon, so it swings with
    // Brawn as the hand axe does; what the proposal gave stays its own.
    const plain = proposed("Plain axe", { stats: { damage: "1d8" } });
    assert.deepEqual(plain.stats, { damage: "1d8", swing: "brawn" });
    const plainItem = gm.itemOf(gm.itemNamed("Plain axe")!.item)!.entry.item!;
    const plainAttack = weaponsOf(emberFight([held(plainItem, "Plain axe")]))[0]!;
    assert.deepEqual([plainAttack.toHit, plainAttack.damage], [2, { count: 1, sides: 8, flat: 2, type: "cut" }]);
    const knife = proposed("Sheathed knife", { slots: {} });
    assert.equal(knife.attack, undefined, "never worn, never armed");
    assert.equal(knife.stats, undefined, "nor given the stats an attack would read");
    assert.deepEqual(knife.notes, []);
    const charm = gm.invent!({ name: "Axe charm", category: "gear", rarity: "common" }, []);
    assert.equal("item" in charm && gm.itemOf(charm.item)!.entry.item!.attack, undefined, "not a weapon");
    const likeRations = gm.invent!(
      { name: "Axe bread", category: "weapon", like: "Road rations", slots: { hands: "1" } },
      [],
    );
    assert.equal(
      "item" in likeRations && gm.itemOf(likeRations.item)!.entry.item!.attack,
      undefined,
      "like= said what it starts from",
    );

    const pocket = inventRulesetItem(ember, { category: "weapon", slots: { none: "" } }, axe)!;
    assert.equal(pocket.item.slots, undefined);
    assert.equal(pocket.item.attack, undefined);
    assert.match(pocket.notes.join(" "), /never worn, and the attack it started from was left out/);
  }

  // ── What the holder brings to a weapon off their own sheet (1.95: 5e's Archery) ──
  {
    const archer = (sheetBonus: Record<string, unknown>): RulesetCatalogItem => ({
      ...axe,
      attack: { ...axe.attack!, toHit: { ...axe.attack!.toHit, sheetBonus } as never },
    });
    const plain = weaponsOf(emberFight([held(axe, "Hand axe")]))[0]!.toHit!;
    assert.equal(
      weaponsOf(emberFight([held(archer({ const: 2 }), "Hand axe")]))[0]!.toHit,
      plain + 2,
      "+2 as it stands",
    );
    assert.equal(
      weaponsOf(emberFight([held(archer({ abilityMod: "wits" }), "Hand axe")], { brawn: 2, wits: 3 }))[0]!.toHit,
      weaponsOf(emberFight([held(axe, "Hand axe")], { brawn: 2, wits: 3 }))[0]!.toHit! + 3,
      "read off the holder's own sheet",
    );
    assert.equal(
      weaponsOf(emberFight([held(archer({ const: 2.7 }), "Hand axe")]))[0]!.toHit,
      plain + 2,
      "a fraction is cut toward zero",
    );
    assert.equal(
      weaponsOf(emberFight([held(archer({ const: 0 }), "Hand axe")]))[0]!.toHit,
      plain,
      "nothing for no one",
    );
    // The item's facts name it by its name on the sheet.
    assert.equal(rulesetItemFacts(ember, archer({ abilityMod: "wits" })).attack!.toHit, "Brawn + Wits modifier");
    // Checked at import like any of the weapon's values, and gated at 1.95 in the ruleset file and a catalog file.
    const withBonus = variant(emberText, (doc) => {
      itemEntry(doc, "hand-axe").item.attack.toHit.sheetBonus = { abilityMod: "wits" };
    });
    parsedOrThrow(withBonus, "a weapon with a sheet bonus");
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-sheet-bonus",
      name: "Sheet bonus",
      version: "0.1.0",
      description: "A packaged ruleset whose weapons add a bonus off their holder's sheet.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /bonus to hit read off their holder's sheet.*capabilityApi 1\.95/;
    assert.match(getCapabilityPackageInstallIssue(manifest(94) as any, withBonus) ?? "", gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(95) as any, withBonus), null);
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(94) as any, variant(emberText)) ?? "", gate);
    // An item's use that rolls to hit reads it the same way, and asks the same.
    const onUse = variant(emberText, (doc) => {
      itemEntry(doc, "hand-axe").item.use = { toHit: { sheetBonus: { const: 2 } } };
    });
    assert.match(getCapabilityPackageInstallIssue(manifest(94) as any, onUse) ?? "", gate, "an item's use");
    const outfitter = itemCatalogOf(withBonus);
    const inFile = {
      ...withBonus,
      catalogs: withBonus.catalogs.map((catalog: { id: string }) =>
        catalog.id === outfitter.id
          ? { ...catalog, entries: undefined, asset: `catalogs/${outfitter.id}.json` }
          : catalog,
      ),
    };
    const paths = ["ruleset.json", `catalogs/${outfitter.id}.json`];
    const files = new Map<string, unknown>([[`catalogs/${outfitter.id}.json`, { entries: outfitter.entries }]]);
    assert.match(
      getCapabilityPackageInstallIssue(manifest(94, paths) as any, inFile, files) ?? "",
      gate,
      "a catalog file",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(95, paths) as any, inFile, files), null);
  }

  // ── Damage the holder brings off their own sheet, in one hand (1.97: 5e's Dueling) ──
  {
    const attack = (id: string, edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, id).item.attack);
    const dueling = (item: RulesetCatalogItem, damage: Record<string, unknown>): RulesetCatalogItem => ({
      ...item,
      attack: { ...item.attack!, damage: { ...item.attack!.damage, ...damage } } as never,
    });
    const flatOf = (items: RulesetSheetItem[], label: string) =>
      weaponsOf(emberFight(items)).find((action) => action.label === label)!.damage!.flat;
    const plainAxe = flatOf([held(axe, "Hand axe")], "Hand axe");
    assert.equal(flatOf([held(dueling(axe, { sheetBonus: { const: 2 } }), "Hand axe")], "Hand axe"), plainAxe + 2);
    assert.equal(
      flatOf([held(dueling(axe, { sheetBonus: { const: 2.9 } }), "Hand axe")], "Hand axe"),
      plainAxe + 2,
      "cut toward zero",
    );
    // A versatile spear alone is wielded with both hands: no one-handed bonus. Beside an axe it is
    // held in one, and the bonus counts.
    const duelSpear = dueling(spear, { sheetBonus: { const: 2 }, oneHanded: true });
    const spearAlone = flatOf([held(spear, "Boar spear")], "Boar spear");
    assert.equal(flatOf([held(duelSpear, "Boar spear")], "Boar spear"), spearAlone, "two-handed: none");
    assert.equal(
      flatOf([held(duelSpear, "Boar spear"), held(axe, "Hand axe")], "Boar spear"),
      flatOf([held(spear, "Boar spear"), held(axe, "Hand axe")], "Boar spear") + 2,
      "one-handed: +2",
    );
    // One that takes two hands is never one-handed.
    const duelBow = dueling(bow, { sheetBonus: { const: 2 }, oneHanded: true });
    assert.equal(
      flatOf([held(duelBow, "Hunting bow")], "Hunting bow"),
      flatOf([held(bow, "Hunting bow")], "Hunting bow"),
    );
    // Without oneHanded it counts however the weapon is held.
    assert.equal(
      flatOf([held(dueling(spear, { sheetBonus: { const: 2 } }), "Boar spear")], "Boar spear"),
      spearAlone + 2,
    );
    // The facts name it by its name on the sheet.
    assert.match(
      rulesetItemFacts(ember, dueling(axe, { sheetBonus: { abilityMod: "wits" } })).attack!.damage,
      /Wits modifier/,
    );
    // Refused: an unknown value, and oneHanded with nothing to gate.
    refused(
      emberText,
      attack("hand-axe", (a) => (a.damage.sheetBonus = { derived: "duel" })),
      /Unknown derived value "duel"/,
      "damage sheet bonus off nothing",
    );
    refused(
      emberText,
      attack("hand-axe", (a) => (a.damage.oneHanded = true)),
      /oneHanded says when the damage's sheetBonus counts/,
      "oneHanded alone",
    );
    // Gated at 1.97.
    const withDamage = variant(emberText, (doc) => {
      itemEntry(doc, "hand-axe").item.attack.damage.sheetBonus = { const: 2 };
    });
    parsedOrThrow(withDamage, "a weapon with a damage sheet bonus");
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-damage-bonus",
      name: "Damage bonus",
      version: "0.1.0",
      description: "A packaged ruleset whose weapons add damage off their holder's sheet.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /add damage off the sheet.*capabilityApi 1\.97/;
    assert.match(getCapabilityPackageInstallIssue(manifest(96) as any, withDamage) ?? "", gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(97) as any, withDamage), null);

    // ── Low damage dice thrown again, two-handed (1.98: 5e's Great Weapon Fighting) ──
    const greatSpear = dueling(spear, { rerollUpTo: { const: 2 } });
    const rerollOf = (items: RulesetSheetItem[], label: string) =>
      weaponsOf(emberFight(items)).find((action) => action.label === label)!.damage!.reroll;
    assert.equal(rerollOf([held(greatSpear, "Boar spear")], "Boar spear"), 2, "a versatile spear in both hands");
    assert.equal(
      rerollOf([held(greatSpear, "Boar spear"), held(axe, "Hand axe")], "Boar spear"),
      undefined,
      "one hand: none",
    );
    assert.equal(
      rerollOf([held(dueling(bow, { rerollUpTo: { const: 2 } }), "Hunting bow")], "Hunting bow"),
      2,
      "two of a slot",
    );
    assert.equal(
      rerollOf([held(dueling(spear, { rerollUpTo: { const: 0 } }), "Boar spear")], "Boar spear"),
      undefined,
      "0: none",
    );
    assert.equal(
      rerollOf([held(dueling(spear, { rerollUpTo: { const: 99 } }), "Boar spear")], "Boar spear"),
      7,
      "never every face",
    );
    // A 1 is thrown again and the new face stands; a 3 is not. The two-handed spear deals a d8.
    const swing = (item: RulesetCatalogItem, faces: number[]) => {
      const queue = [...faces];
      const state = emberFight([held(item, "Boar spear")]);
      const result = applyRulesetCombatChoice(
        ember,
        state,
        { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
        (sides) => (sides === 8 ? (queue.shift() ?? 8) : 6),
      );
      return result.events.find((event) => event.type === "damage") as { rolls?: number[] } | undefined;
    };
    assert.deepEqual(swing(greatSpear, [1, 5])?.rolls, [5], "a 1 becomes the 5 thrown again");
    assert.deepEqual(swing(greatSpear, [3, 5])?.rolls, [3], "a 3 stands");
    assert.deepEqual(swing(spear, [1, 5])?.rolls, [1], "without it the 1 stands");
    assert.deepEqual(swing(greatSpear, [2, 4])?.rolls, [4], "a 2 is thrown again too");
    // A critical's extra dice are thrown again the same way.
    const critical = parsedOrThrow(
      variant(emberText, (doc) => {
        doc.combat.attackRoll = {
          dice: { count: 1, sides: 20 },
          naturals: { max: "critical" },
          critical: "double-dice",
        };
      }),
      "a d20 fight with criticals",
    );
    const queue = [1, 5, 2, 7];
    const critState = emberFight([held(greatSpear, "Boar spear")], { brawn: 2, wits: 1 }, critical);
    const crit = applyRulesetCombatChoice(
      critical,
      critState,
      { actorId: "juno", optionId: "item:0", targetIds: ["hound"] },
      (sides) => (sides === 8 ? (queue.shift() ?? 8) : sides),
    ).events.find((event) => event.type === "damage") as { rolls?: number[]; critical?: boolean } | undefined;
    assert.deepEqual([crit?.critical, crit?.rolls], [true, [5, 7]], "the critical's 2 is thrown again as well");
    // Refused: an unknown value, and in a pool fight. Gated at 1.98.
    refused(
      emberText,
      attack("boar-spear", (a) => (a.damage.rerollUpTo = { derived: "gwf" })),
      /Unknown derived value "gwf"/,
      "reroll off nothing",
    );
    refused(
      gravewatchText,
      attack("grave-spade", (a) => (a.damage.rerollUpTo = { const: 2 })),
      /nothing to reroll/,
      "reroll in a pool fight",
    );
    const withReroll = variant(emberText, (doc) => {
      itemEntry(doc, "boar-spear").item.attack.damage.rerollUpTo = { const: 2 };
    });
    parsedOrThrow(withReroll, "a weapon that rerolls");
    const rerollGate = /reroll low damage dice.*capabilityApi 1\.98/;
    assert.match(getCapabilityPackageInstallIssue(manifest(97) as any, withReroll) ?? "", rerollGate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(98) as any, withReroll), null);
  }

  console.log(
    "Ruleset weapons: import checks, the 1.55 gate, weapons in summed and pool fights, a weapon's own target, what gets through a resistance, item facts and invented weapons passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
