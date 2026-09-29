/**
 * Requirements, abilities from items, and levels off a derived value (#6846, Capability API 1.54).
 *
 *   - An item's `requires`, a worn or carried effect's `abilities`, and a level's `derived` are read and
 *     checked at import, and the install gate asks for 1.54 for any of them, in the ruleset file and in
 *     a catalog file.
 *   - A worn or carried item sets an ability to at least a number or adds to it, before the sheet is
 *     worked out, inside the ability's own range: everything that reads the ability reads the changed
 *     one (a derived value, the Game Master's sheet block, a fight).
 *   - A worn item's requirement the wearer falls short of applies what it says on their checks.
 *   - A level may read a derived value: on checks outside a fight, and in a fight.
 *   - Item facts say all of it, and invented items may raise an ability, held to their rarity.
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
  evaluateRulesetSheetLive,
  inventRulesetItem,
  matchRulesetCheckTarget,
  parseRulesetDefinition,
  rulesetCheckEffects,
  rulesetCheckSources,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetConditionModifiers,
  rulesetDefenseAgainst,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetProposalParts,
  rulesetValueRefLabel,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-requirements-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { getCapabilityPackageInstallIssue },
  { renderGameRulesetSheetBlocks },
  { rulesetCombatEventLine, rulesetCombatNames },
] = await Promise.all([
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js"),
  import("../../packages/client/src/lib/ruleset-combat-log.js"),
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
  const itemEntry = (doc: Record<string, any>, id: string) =>
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "items")
      .entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
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
  const gauntlets = itemOf(emberBook, "outfitter/ox-hide-gauntlets");
  const spade = itemOf(graveBook, "kit/grave-spade");
  const build = (definition: RulesetDefinition, abilities: Record<string, number>): RulesetSheetBuild => ({
    ...defaultRulesetSheetBuild(definition),
    abilities: { ...defaultRulesetSheetBuild(definition).abilities, ...abilities },
  });

  // ── Import ──
  {
    assert.deepEqual(gauntlets.worn, { abilities: { brawn: { set: 2 } } });
    assert.deepEqual(spade.requires, [
      {
        value: { abilityScore: "sinew" },
        atLeast: 3,
        otherwise: { modifiers: [{ to: "checks", skills: ["dig"], flat: -1 }] },
      },
    ]);
    const worn = (effect: unknown) => (doc: Record<string, any>) =>
      (itemEntry(doc, "ox-hide-gauntlets").item.worn = effect);
    parsedOrThrow(variant(emberText, worn({ abilities: { heart: { add: -1 } } })), "an ability lowered");
    refused(emberText, worn({ abilities: { might: { add: 1 } } }), /Unknown ability "might"/, "an unknown ability");
    refused(emberText, worn({ abilities: { brawn: { set: 9 } } }), /"brawn" runs from -1 to 3/, "a set out of range");
    refused(emberText, worn({ abilities: { brawn: { add: 0 } } }), /Adding 0 changes nothing/, "adding nothing");
    refused(emberText, worn({ abilities: { brawn: { set: 2, add: 1 } } }), /abilities/, "set and add at once");
    const requires = (requirement: unknown) => (doc: Record<string, any>) =>
      (itemEntry(doc, "grave-spade").item.requires = [requirement]);
    const otherwise = { modifiers: [{ to: "checks", skills: ["dig"], flat: -1 }] };
    refused(
      gravewatchText,
      requires({ value: { abilityScore: "might" }, atLeast: 3, otherwise }),
      /Unknown ability "might"/,
      "a requirement on an unknown ability",
    );
    refused(
      gravewatchText,
      requires({ value: { abilityScore: "sinew" }, atLeast: 3, otherwise: { abilities: { sinew: { add: 1 } } } }),
      /An unmet requirement cannot change an ability/,
      "a requirement that changes an ability",
    );
    refused(
      gravewatchText,
      requires({
        value: { abilityScore: "sinew" },
        atLeast: 3,
        otherwise: { modifiers: [{ to: "checks", skills: ["fly"], flat: -1 }] },
      }),
      /Unknown skill "fly"/,
      "a requirement's unknown skill",
    );
    parsedOrThrow(
      variant(gravewatchText, requires({ value: { liveTrack: "harm", read: "remaining" }, atLeast: 1, otherwise })),
      "a requirement off the live state",
    );
    const level = (entry: unknown) => (doc: Record<string, any>) => doc.combat.levels.push(entry);
    refused(
      emberText,
      level({ track: "heat", derived: "load", at: 2, effects: ["cannot-act"] }),
      /A level reads a live track or a derived value: one of them/,
      "both",
    );
    refused(emberText, level({ at: 2, effects: ["cannot-act"] }), /one of them/, "neither");
    refused(
      emberText,
      level({ derived: "might", at: 2, effects: ["cannot-act"] }),
      /Unknown derived value "might"/,
      "unknown",
    );
    refused(
      emberText,
      level({ derived: "bulk_carried", at: 10, effects: ["cannot-act"] }),
      /Level 10 of "bulk_carried" is given twice/,
      "twice",
    );
    // A derived value may share a track's id; a level on each at the same point is two levels.
    parsedOrThrow(
      variant(emberText, (doc) => {
        const bulk = doc.sheet.derived.find((entry: { id: string }) => entry.id === "bulk_carried");
        doc.sheet.derived.push({ ...bulk, id: "heat", label: "Heat carried" });
        doc.combat.levels.push({ derived: "heat", at: 3, modifiers: [{ to: "speed", flat: -1 }] });
      }),
      "a track's level and a derived value's of the same id",
    );
    refused(
      emberText,
      level({ derived: "bulk_carried", at: 11, effects: ["ends-on-damage"] }),
      /ends only when what it reads goes down/,
      "an effect that ends by itself",
    );
  }

  // ── Install gate: every 1.54 key, in the ruleset file and in a catalog file ──
  {
    /** Less what the examples' items do in a fight, which is 1.56's and has a lane of its own. */
    const withoutArmor = (text: string) =>
      JSON.stringify(
        variant(text, (doc) => {
          for (const catalog of doc.catalogs) {
            for (const entry of catalog.entries ?? []) {
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
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-requirements",
      name: "Requirements",
      version: "0.1.0",
      description: "A packaged ruleset whose items ask something and change abilities.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /ask something of their wearer or change an ability.*capabilityApi 1\.54/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    /** Less the example's weapons, which are 1.55's and have a lane of their own. */
    const withoutWeapons = (doc: Record<string, any>) => {
      for (const entry of doc.catalogs.find((each: { holds?: string }) => each.holds === "items").entries) {
        delete entry.item.attack;
      }
    };
    /** Ember Roads less its own 1.54 keys, to add one back at a time. */
    const bare = (edit: (doc: Record<string, any>) => void = () => {}) =>
      variant(emberBefore156, (doc) => {
        delete itemEntry(doc, "ox-hide-gauntlets").item.worn;
        doc.combat.levels = doc.combat.levels.filter((entry: { derived?: string }) => entry.derived === undefined);
        withoutWeapons(doc);
        edit(doc);
      });
    assert.equal(issue(53, bare()), null, "the rest of the example stays 1.53");
    assert.match(issue(53, variant(emberBefore156, withoutWeapons)) ?? "", gateIssue);
    assert.equal(issue(54, variant(emberBefore156, withoutWeapons)), null);
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      [
        "a worn ability",
        (doc) => (itemEntry(doc, "ox-hide-gauntlets").item.worn = { abilities: { brawn: { add: 1 } } }),
      ],
      [
        "a carried ability",
        (doc) => (itemEntry(doc, "road-rations").item.carried = { abilities: { heart: { add: 1 } } }),
      ],
      [
        "a requirement",
        (doc) =>
          (itemEntry(doc, "hand-axe").item.requires = [
            { value: { abilityScore: "brawn" }, atLeast: 1, otherwise: { effects: ["own-checks-disadvantage"] } },
          ]),
      ],
      ["a derived level", (doc) => doc.combat.levels.push({ derived: "load", at: 9, effects: ["cannot-act"] })],
    ];
    for (const [what, edit] of cases) assert.match(issue(53, bare(edit)) ?? "", gateIssue, what);
    const inFile = bare((doc) => {
      const catalog = doc.catalogs.find((each: { holds?: string }) => each.holds === "items");
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = bare().catalogs.find((each: { holds?: string }) => each.holds === "items").entries;
    entries.find((entry: { id: string }) => entry.id === "hand-axe").item.requires = [
      { value: { abilityScore: "brawn" }, atLeast: 1, otherwise: { effects: ["own-checks-disadvantage"] } },
    ];
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(53, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(54, inFile, paths, files), null);
  }

  // ── Abilities from items: a floor, additions on top, the ability's own range ──
  {
    const on = (item: RulesetCatalogItem, worn = true, name = "It"): RulesetSheetItem => ({
      item,
      quantity: 1,
      worn,
      name,
    });
    const brawnOf = (abilities: Record<string, number>, items?: RulesetSheetItem[]) =>
      evaluateRulesetSheetLive(ember, build(ember, abilities), undefined, items).abilityScores.brawn;
    assert.equal(brawnOf({ brawn: 0 }, [on(gauntlets)]), 2, "set to at least 2");
    assert.equal(brawnOf({ brawn: 3 }, [on(gauntlets)]), 3, "a higher score stays");
    assert.equal(brawnOf({ brawn: 0 }, [on(gauntlets, false)]), 0, "only while worn");
    assert.equal(brawnOf({ brawn: 0 }), 0, "outside a game nobody holds anything");
    const charm = { category: "gear", carried: { abilities: { brawn: { add: 1 } } } } as RulesetCatalogItem;
    const belt = { category: "gear", worn: { abilities: { brawn: { set: 1 } } } } as RulesetCatalogItem;
    assert.equal(brawnOf({ brawn: 0 }, [on(charm, false)]), 1, "added while only carried");
    assert.equal(brawnOf({ brawn: 0 }, [on(charm, false), on(charm, false)]), 1, "one item once");
    assert.equal(brawnOf({ brawn: 2 }, [on(charm, false), on(gauntlets)]), 3, "the addition, then the floor");
    assert.equal(brawnOf({ brawn: 0 }, [on(belt), on(gauntlets)]), 2, "the highest floor");
    assert.equal(brawnOf({ brawn: 3 }, [on(charm, false)]), 3, "held to the ability's own top");
    // Everything that reads the ability reads the changed one: Load is 6 + Brawn.
    const loadOf = (items?: RulesetSheetItem[]) =>
      evaluateRulesetSheetLive(ember, build(ember, { brawn: 0 }), undefined, items).derived.load;
    assert.equal(loadOf([on(gauntlets)]), loadOf() + 2);
    // And the Game Master's sheet block.
    const cards = [{ name: "Juno", rulesetSheet: { v: 1, build: build(ember, { brawn: 0 }) } }];
    const [block] = renderGameRulesetSheetBlocks(
      ember,
      cards,
      null,
      {},
      {
        book: emberBook,
        stacks: [
          { id: "s", name: "Ox-hide gauntlets", quantity: 1, item: "outfitter/ox-hide-gauntlets", equipped: true },
        ],
        playerName: null,
      },
    );
    assert.match(block!, /BRN \+2/, `the block: ${block}`);
    // A ruleset with items but nothing that reads a stat of them is read the same way.
    const bracing = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "lantern-coat").item.worn = { abilities: { sinew: { set: 4 } } };
      }),
      "a coat that sets Sinew",
    );
    const wardens = [{ name: "Mira", rulesetSheet: { v: 1, build: build(bracing, { sinew: 2 }) } }];
    const coat = [{ id: "c", name: "Lantern-keeper's coat", quantity: 1, item: "kit/lantern-coat", equipped: true }];
    const [braced] = renderGameRulesetSheetBlocks(
      bracing,
      wardens,
      null,
      {},
      {
        book: rulesetItemBook(bracing, entriesOf(bracing)),
        stacks: coat,
        playerName: null,
      },
    );
    const [unbraced] = renderGameRulesetSheetBlocks(bracing, wardens, null);
    assert.notEqual(braced, unbraced, `Sinew 4 with the coat on: ${braced} / ${unbraced}`);
    // And a fight, whose initiative here reads Brawn.
    const brawnFirst = parsedOrThrow(
      variant(emberText, (doc) => (doc.combat.initiative.modifier = { abilityMod: "brawn" })),
      "initiative off Brawn",
    );
    const fighter = createRulesetEncounter({
      definition: brawnFirst,
      seed: 5,
      combatants: [
        { id: "juno", name: "Juno", side: "party", build: build(brawnFirst, { brawn: 0 }), items: [on(gauntlets)] },
      ],
    });
    assert.equal(rulesetCombatant(fighter, "juno")!.initiativeModifier, 2, "a fight reads the changed ability");
  }

  // ── Requirements on checks ──
  {
    const dig = matchRulesetCheckTarget(gravewatch, "Dig");
    const digEffects = (sinew: number, items: RulesetSheetItem[]) =>
      rulesetCheckEffects(rulesetCheckSources(gravewatch, build(gravewatch, { sinew }), undefined, items), dig);
    const held = (worn: boolean): RulesetSheetItem[] => [{ item: spade, quantity: 1, worn, name: "Grave spade" }];
    assert.deepEqual(
      digEffects(2, held(true)).modifiers.map((entry) => [entry.from, entry.modifier.flat]),
      [["Grave spade", -1]],
      "Sinew 2 falls short of the spade's 3",
    );
    assert.deepEqual(digEffects(3, held(true)).modifiers, [], "Sinew 3 is enough");
    assert.deepEqual(digEffects(2, held(false)).modifiers, [], "only while worn");
    assert.deepEqual(
      rulesetCheckEffects(
        rulesetCheckSources(gravewatch, build(gravewatch, { sinew: 2 }), undefined, held(true)),
        matchRulesetCheckTarget(gravewatch, "Ward"),
      ).modifiers,
      [],
      "and only on what it names",
    );
    // A requirement reads the ability as the wearer's items leave it.
    const bracer = { category: "coat", worn: { abilities: { sinew: { set: 3 } } } } as RulesetCatalogItem;
    assert.deepEqual(
      digEffects(2, [...held(true), { item: bracer, quantity: 1, worn: true, name: "Bracer" }]).modifiers,
      [],
      "a bracer that sets Sinew to 3 meets it",
    );
  }

  // ── Levels off a derived value: checks outside a fight, and fights ──
  {
    const rations = itemOf(emberBook, "outfitter/road-rations");
    const pack = (bulk: number): RulesetSheetItem[] => [
      { item: rations, quantity: bulk, worn: false, name: "Road rations" },
    ];
    const sources = (bulk: number) =>
      rulesetCheckSources(ember, build(ember, { brawn: 0 }), undefined, pack(bulk)).map((source) => source.name);
    assert.deepEqual(sources(9), [], "below 10 bulk");
    assert.deepEqual(sources(10), ["Bulk carried 10"], "at 10");
    const sneak = rulesetCheckEffects(
      rulesetCheckSources(ember, build(ember, { brawn: 0 }), undefined, pack(12)),
      matchRulesetCheckTarget(ember, "Sneak"),
    );
    assert.deepEqual(
      sneak.modifiers.map((entry) => [entry.from, entry.modifier.flat]),
      [["Bulk carried 10", -1]],
    );
    const slowed = (bulk: number) =>
      rulesetConditionModifiers(
        ember,
        ember.combat!,
        rulesetCombatant(
          createRulesetEncounter({
            definition: ember,
            seed: 5,
            combatants: [
              { id: "juno", name: "Juno", side: "party", build: build(ember, { brawn: 0 }), items: pack(bulk) },
            ],
          }),
          "juno",
        )!,
        "speed",
      ).map((entry) => [entry.condition, entry.level, entry.derived, entry.modifier.flat]);
    assert.deepEqual(slowed(12), [["bulk_carried", 10, true, -2]], "a fight reads the level too");
    assert.deepEqual(slowed(9), []);

    // A derived value may share a track's id (Heat), so a level says which it reads, from the fight's
    // modifiers to the roll it changed and the log line that names it.
    const hot = parsedOrThrow(
      variant(emberText, (doc) => {
        const bulk = doc.sheet.derived.find((entry: { id: string }) => entry.id === "bulk_carried");
        doc.sheet.derived.push({ ...bulk, id: "heat", label: "Heat carried" });
        doc.combat.levels.push({
          derived: "heat",
          at: 3,
          modifiers: [
            { to: "attacks", flat: -1 },
            { to: "defense", flat: -1 },
          ],
        });
      }),
      "a derived value named like a track",
    );
    const axe = { name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" };
    const fight = createRulesetEncounter({
      definition: hot,
      seed: 5,
      roller: () => 3,
      combatants: [
        {
          id: "juno",
          name: "Juno",
          side: "party",
          build: { ...build(hot, { brawn: 2 }), lists: { gear: [axe] } },
          items: pack(12),
        },
        {
          id: "hound",
          name: "Hound",
          side: "enemy",
          block: { health: 20, defense: 6, initiativeModifier: -5, actions: [] },
        },
      ],
    });
    assert.deepEqual(
      rulesetDefenseAgainst(hot, hot.combat!, fight, rulesetCombatant(fight, "juno")!).guards,
      [{ condition: "heat", level: 3, derived: true, value: -1 }],
      "her defense",
    );
    const swing = rulesetCombatOptions(hot, fight, "juno").find((option) => option.label === "Road axe");
    assert.ok(swing, "Juno swings the axe");
    const struck = applyRulesetCombatChoice(
      hot,
      fight,
      { actorId: "juno", optionId: swing.id, targetIds: ["hound"] },
      () => 3,
    );
    const attack = struck.events.find((event) => event.type === "attack");
    assert.ok(attack && attack.type === "attack");
    assert.deepEqual(attack.bonuses, [{ condition: "heat", level: 3, derived: true, value: -1 }], "her attack");
    const t = ((key: string, params?: Record<string, unknown>) =>
      [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;
    const names = rulesetCombatNames(hot, { combatants: fight.combatants } as never, t);
    assert.equal(names.track("heat"), "Heat");
    assert.equal(names.derived("heat"), "Heat carried");
    assert.match(rulesetCombatEventLine(attack, names, t)!, /roll\.level\|Heat carried\|3/);
    const fromTrack = { ...attack, bonuses: [{ condition: "heat", level: 3, value: -1 }] };
    assert.match(rulesetCombatEventLine(fromTrack, names, t)!, /roll\.level\|Heat\|3/);
  }

  // ── What an item says ──
  {
    const gauntletFacts = rulesetItemFacts(ember, gauntlets);
    assert.deepEqual(gauntletFacts.worn, [{ to: "ability", names: ["Brawn"], change: { atLeast: 2 } }]);
    assert.match(rulesetItemPromptFacts(gauntletFacts), /; worn: Brawn at least 2$/);
    const spadeFacts = rulesetItemFacts(gravewatch, spade);
    assert.deepEqual(spadeFacts.requires, [
      { what: "Sinew", atLeast: 3, otherwise: [{ to: "checks", names: ["Dig"], change: { value: "-1" } }] },
    ]);
    assert.match(
      rulesetItemPromptFacts(spadeFacts),
      /; needs Sinew 3, otherwise -1 on checks \(Dig\); attack \(Act\): /,
    );
    // Every kind of value a requirement may read has a label, and a modifier or a count of items says so.
    const labels = (
      [
        [{ abilityScore: "sinew" }, { what: "Sinew" }],
        [{ abilityMod: "sinew" }, { what: "Sinew", of: "modifier" }],
        [{ abilityModFromField: "watch" }, { what: "Watch", of: "modifier" }],
        [{ field: "lantern" }, { what: "Lantern oil" }],
        [{ derived: "harm_left" }, { what: gravewatch.sheet.derived.find((e) => e.id === "harm_left")!.label }],
        [{ listSum: { list: "scars", column: "levels" } }, { what: "Levels (Scars)" }],
        [{ liveTrack: "harm", read: "remaining" }, { what: "Harm" }],
        [{ itemStat: { from: "carried", pick: "count", tag: "silver" } }, { what: "Silver", of: "items" }],
        [{ itemStat: { from: "all", pick: "count" } }, { what: "", of: "items" }],
        [{ const: 2 }, { what: "2" }],
      ] as const
    ).map(([value, expected]) => {
      assert.deepEqual(rulesetValueRefLabel(gravewatch, value), expected, JSON.stringify(value));
      return rulesetItemPromptFacts(
        rulesetItemFacts(gravewatch, { ...spade, requires: [{ ...spade.requires![0], value }] }),
      ).replace(/^.*; needs (.*) 3, otherwise.*$/, "$1");
    });
    assert.deepEqual(labels, [
      "Sinew",
      "Sinew modifier",
      "Watch modifier",
      "Lantern oil",
      labels[4],
      "Levels (Scars)",
      "Harm",
      "Silver items",
      "items",
      "2",
    ]);
    assert.ok(labels.every(Boolean), "no requirement reads as nothing");
    const charmFacts = rulesetItemFacts(ember, {
      category: "gear",
      carried: { abilities: { heart: { add: 1 } } },
    } as RulesetCatalogItem);
    assert.match(rulesetItemPromptFacts(charmFacts), /carried: \+1 Heart$/);
  }

  // ── Invented items: an ability raised, held to the rarity ──
  {
    const invent = (proposal: Record<string, string>, like?: RulesetCatalogItem) =>
      inventRulesetItem(ember, { category: "gear", ...proposal }, like)!;
    const strong = invent({ rarity: "storied", carried: "+2 Brawn" });
    assert.deepEqual(strong.item.carried, { abilities: { brawn: { add: 2 } } });
    const capped = invent({ rarity: "common", carried: "+2 Brawn; advantage on Heart" });
    assert.deepEqual(capped.item.carried, { abilities: { brawn: { add: 1 } } });
    assert.deepEqual(capped.notes, [
      'An ability takes a number such as +1, so "advantage on Heart" left it out.',
      "A bonus while carried is +1 instead of +2, the most at Common.",
    ]);
    const copied = invent({ rarity: "common" }, gauntlets);
    assert.equal(copied.item.worn, undefined, "a set from like= cannot be held to a rarity's most");
    assert.match(copied.notes.join(" "), /An ability set by an invented item cannot be held to Common's most/);
    const graveCopy = inventRulesetItem(gravewatch, { category: "arm" }, spade)!;
    assert.deepEqual(graveCopy.item.requires, spade.requires, "what it asks comes with the item it started from");
    // The number may follow the name, as a small model often writes it.
    assert.deepEqual(invent({ worn: "Brawn +1; Sneak -1" }).item.worn, {
      abilities: { brawn: { add: 1 } },
      modifiers: [{ to: "checks", flat: -1, skills: ["sneak"] }],
    });

    // What a small model writes inside stats= is lifted out, unless the ruleset has a stat of that name or
    // the part was also given on its own.
    assert.deepEqual(
      rulesetProposalParts(ember, { category: "gear", stats: { Worn: "+1 Brawn", bulk: "1", summary: "Iron." } }),
      { category: "gear", worn: "+1 Brawn", summary: "Iron.", stats: { bulk: "1" } },
    );
    assert.deepEqual(rulesetProposalParts(ember, { category: "gear", stats: { carried: "+1 Heart" } }), {
      category: "gear",
      carried: "+1 Heart",
    });
    const both = { category: "gear", worn: "+1 Wits", stats: { worn: "+1 Brawn" } };
    assert.deepEqual(rulesetProposalParts(ember, both), both, "a part given on its own is kept");
    const wornStat: RulesetDefinition = {
      ...ember,
      items: { ...ember.items!, stats: [...ember.items!.stats!, { id: "worn", label: "Worn", type: "text" }] },
    };
    const stat = { category: "gear", stats: { worn: "Frayed" } };
    assert.deepEqual(rulesetProposalParts(wornStat, stat), stat, "a ruleset stat of that name stays a stat");
    const gm = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });
    assert.deepEqual(
      gm.invent!({ name: "Iron ring", category: "gear", rarity: "common", stats: { worn: "Brawn +1" } }, []),
      { item: "invented:iron-ring", notes: [] },
    );
    assert.deepEqual(gm.itemOf("invented:iron-ring")?.facts.worn, [
      { to: "ability", names: ["Brawn"], change: { value: "+1" } },
    ]);
  }

  console.log(
    "Ruleset requirements: import checks, the 1.54 gate, abilities from items, requirements and derived levels on checks and in fights, item facts and invented items passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
