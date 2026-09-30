/**
 * Armor and worn effects in a fight, `resolution.adjust` in fights, and hardness (#6857, Capability
 * API 1.56).
 *
 *   - What an item does while worn or carried may change a fight: modifiers to defense, attacks and
 *     speed, the fight's condition effects (not the four a level cannot have), and the kinds of harm
 *     and conditions it keeps off. Checked at import, and the install gate asks for 1.56.
 *   - A fight reads them for the holder, each item once, named for the stack, with an unmet
 *     requirement's `otherwise`: attacks, defense, speed, effects, failed saves, harm and conditions.
 *   - Every roll a fight builds from a sheet adds `resolution.adjust`, as a check does: attack rows,
 *     weapons, contest checks, saves and initiative, as it opens and as it is thrown again.
 *   - Hardness: a spending blow whose dice are below the target's lands and does nothing, and the menu
 *     forecasts nothing for it.
 *   - Item facts, the Game Master's line, the fight log and invented items say it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  inventRulesetItem,
  parseRulesetDefinition,
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCombatFailsSave,
  rulesetCombatHide,
  rulesetCombatOptions,
  rulesetConditionModifiers,
  rulesetDefenseAgainst,
  rulesetImmuneToCondition,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetItemStatsRead,
  rulesetMovementAllowance,
  rulesetProposedStatBlock,
  rowsFromCatalogEntry,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-armor-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [{ getCapabilityPackageInstallIssue }, { rulesetCombatEventLine, rulesetCombatNames }] = await Promise.all([
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
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
  const itemOf = (definition: RulesetDefinition, ref: string): RulesetCatalogItem => {
    const found = rulesetItemBook(definition, entriesOf(definition)).itemOf(ref)?.entry.item;
    assert.ok(found, `the book has ${ref}`);
    return found;
  };
  const held = (item: RulesetCatalogItem, name: string, worn = true, quantity = 1): RulesetSheetItem => ({
    item,
    quantity,
    worn,
    name,
  });
  const build = (definition: RulesetDefinition, abilities: Record<string, number> = {}) => ({
    ...defaultRulesetSheetBuild(definition),
    abilities: { ...defaultRulesetSheetBuild(definition).abilities, ...abilities },
  });
  const waystone = itemOf(ember, "outfitter/waystone");
  const ring = itemOf(gravewatch, "kit/widows-ring");
  const bell = itemOf(gravewatch, "kit/dawn-bell");
  const coat = itemOf(ember, "outfitter/leather-coat");

  // ── Import ──
  {
    assert.deepEqual(waystone.carried, {
      modifiers: [{ to: "checks", skills: ["sway"], flat: 1 }],
      resist: ["burn"],
    });
    assert.deepEqual(ring.worn, { modifiers: [{ to: "attacks", flat: -1 }] });
    assert.deepEqual(bell.worn?.conditionImmunities, ["rattled"]);
    const worn = (effect: unknown) => (doc: Record<string, any>) => (itemEntry(doc, "leather-coat").item.worn = effect);
    for (const effect of [
      { effects: ["cannot-act", "attacks-against-disadvantage", "resist-all", "speed-zero"] },
      {
        modifiers: [
          { to: "defense", flat: 1 },
          { to: "attacks", dice: "1d4" },
          { to: "speed", times: 0.5 },
        ],
      },
      { resist: ["burn"] },
      { vulnerable: ["cut"] },
      { immune: ["rust"] },
      { conditionImmunities: ["shaken"] },
    ]) {
      parsedOrThrow(variant(emberText, worn(effect)), JSON.stringify(effect));
    }
    for (const effect of ["half-move-to-stand", "ends-on-damage", "cannot-target-source", "cannot-approach-source"]) {
      refused(emberText, worn({ effects: [effect] }), /Invalid enum value/, effect);
    }
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "lantern-coat").item.worn = { resist: ["cut"] }),
      /worn\.resist\.0: Unknown damage type "cut"/,
      "a damage type the ruleset does not have",
    );
    refused(
      emberText,
      worn({ conditionImmunities: ["asleep"] }),
      /worn\.conditionImmunities\.0: Unknown condition "asleep"/,
      "an unknown condition",
    );
    refused(emberText, worn({ modifiers: [{ to: "defense", dice: "1d4" }] }), /Dice are rolled/, "dice on defense");
    // A pool fight adds a flat number of dice, as a condition's modifier does.
    parsedOrThrow(variant(emberText, worn({ modifiers: [{ to: "attacks", dice: "1d4" }] })), "dice on attacks, summed");
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "lantern-coat").item.worn = { modifiers: [{ to: "attacks", dice: "1d4" }] }),
      /worn\.modifiers\.0\.dice: A "dice-pool" fight adds dice to a pool, so a modifier gives a flat number of dice/,
      "dice on attacks in a pool",
    );
    // Dice on checks and saves were a pool ruleset's before 1.56, and a fight adds what they roll as
    // dice, as a pool check outside one does, so they still import.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "lantern-coat").item.worn = {
          modifiers: [
            { to: "saves", dice: "1d4" },
            { to: "checks", dice: "1d4" },
          ],
        };
      }),
      "dice on checks and saves in a pool",
    );
    // What an unmet requirement costs may be a fight's too.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "grave-spade").item.requires[0].otherwise = { modifiers: [{ to: "attacks", flat: -1 }] };
      }),
      "a requirement that costs a die on attacks",
    );
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "grave-spade").item.requires[0].otherwise = { immune: ["cut"] }),
      /otherwise\.immune\.0: Unknown damage type "cut"/,
      "an unmet requirement's harm, checked",
    );
  }

  // Gravewatch with initiative a number attacks move (as the Storyteller lane plays it), with hardness.
  const moveInitiative = (doc: Record<string, any>) => {
    doc.combat.initiative = {
      pool: { abilityMod: "nerve" },
      plus: 3,
      resource: {
        base: 3,
        styles: [
          { id: "press", label: "Press", takes: { gain: 1 } },
          { id: "telling", label: "Telling blow", spends: { onMiss: [[0, 1]] } },
        ],
      },
    };
    doc.combat.pool.hardness = { abilityMod: "sinew" };
  };

  // ── Hardness at import ──
  {
    const hard = parsedOrThrow(variant(gravewatchText, moveInitiative), "Gravewatch with hardness");
    assert.deepEqual(hard.combat!.pool!.hardness, { abilityMod: "sinew" });
    refused(
      gravewatchText,
      (doc) => (doc.combat.pool.hardness = { const: 2 }),
      /pool\.hardness: Hardness stops a spending blow, so initiative is a number attacks move with a style that spends it/,
      "hardness with no spending blow",
    );
    refused(
      gravewatchText,
      (doc) => (creatureEntry(doc, "hollow-warden").creature.hardness = 3),
      /hollow-warden|hardness: Hardness stops a spending blow/,
      "a creature's hardness with no spending blow",
    );
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        moveInitiative(doc);
        creatureEntry(doc, "hollow-warden").creature.hardness = 3;
      }),
      "a creature's hardness",
    );
    // A creature written as a sheet takes its hardness from the sheet, as it takes its soak.
    refused(
      emberText,
      (doc) => (creatureEntry(doc, "toll-warden").creature.hardness = 2),
      /A creature with a sheet takes its hardness from the sheet/,
      "a sheet creature's own hardness",
    );
    refused(
      gravewatchText,
      (doc) => {
        moveInitiative(doc);
        doc.combat.pool.hardness = { derived: "nerve_left" };
      },
      /Unknown derived value "nerve_left"/,
      "hardness off an unknown value",
    );
  }

  // ── Install gate: 1.56 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-armor",
      name: "Armor",
      version: "0.1.0",
      description: "A packaged ruleset whose items change a fight.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /items change a fight while worn or carried, or with hardness.*capabilityApi 1\.56/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    /** The examples less what their items do in a fight. */
    /** Less what the examples' weapons shoot and load, the other ways they fight and what their items
     *  do when used, which are 1.57's, 1.58's and 1.59's and have lanes of their own. */
    const withoutAmmo = (doc: Record<string, any>) => {
      delete doc.combat?.offHand;
      for (const entry of itemCatalogOf(doc).entries) {
        for (const key of ["ammo", "clip", "modes", "offHand", "floor", "onHit"]) delete entry.item.attack?.[key];
        delete entry.item.use;
        delete entry.item.charges;
      }
    };
    const withoutArmor = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) {
        for (const when of ["worn", "carried"]) {
          const effect = entry.item[when];
          if (!effect) continue;
          delete effect.resist;
          delete effect.conditionImmunities;
          effect.modifiers = effect.modifiers?.filter((one: { to: string }) => ["checks", "saves"].includes(one.to));
          if (!effect.modifiers?.length) delete effect.modifiers;
          if (Object.keys(effect).every((key) => key === "$comment")) delete entry.item[when];
        }
      }
    };
    for (const text of [emberText, gravewatchText].map((each) => JSON.stringify(variant(each, withoutAmmo)))) {
      assert.match(issue(55, variant(text)) ?? "", gateIssue);
      assert.equal(issue(56, variant(text)), null);
      assert.equal(issue(55, variant(text, withoutArmor)), null, "the rest of the example stays 1.55");
    }
    const bare = (edit: (doc: Record<string, any>) => void) =>
      variant(emberText, (doc) => {
        withoutAmmo(doc);
        withoutArmor(doc);
        edit(doc);
      });
    const coatWorn = (effect: unknown) => (doc: Record<string, any>) =>
      (itemEntry(doc, "leather-coat").item.worn = effect);
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["a fight effect", coatWorn({ effects: ["attacks-against-disadvantage"] })],
      ["a modifier to defense", coatWorn({ modifiers: [{ to: "defense", flat: 1 }] })],
      ["a modifier to speed", coatWorn({ modifiers: [{ to: "speed", flat: -2 }] })],
      ["a resistance", coatWorn({ resist: ["burn"] })],
      ["a vulnerability", coatWorn({ vulnerable: ["burn"] })],
      ["an immunity", coatWorn({ immune: ["burn"] })],
      ["a condition kept off", coatWorn({ conditionImmunities: ["shaken"] })],
      [
        "a requirement's cost in a fight",
        (doc) =>
          (itemEntry(doc, "hand-axe").item.requires = [
            { value: { abilityScore: "brawn" }, atLeast: 1, otherwise: { modifiers: [{ to: "attacks", flat: -1 }] } },
          ]),
      ],
    ];
    for (const [what, edit] of cases) {
      assert.match(issue(55, bare(edit)) ?? "", gateIssue, what);
      assert.equal(issue(56, bare(edit)), null, what);
    }
    // A check's effect alone stays what it was.
    assert.equal(issue(55, bare(coatWorn({ effects: ["own-checks-disadvantage"] }))), null);
    // Hardness, on the fighters and on a creature.
    const hardText = JSON.stringify(
      variant(gravewatchText, (doc) => {
        withoutAmmo(doc);
        withoutArmor(doc);
        moveInitiative(doc);
      }),
    );
    assert.match(issue(55, variant(hardText)) ?? "", gateIssue, "combat.pool.hardness");
    const creatureOnly = variant(hardText, (doc) => {
      delete doc.combat.pool.hardness;
      creatureEntry(doc, "hollow-warden").creature.hardness = 3;
    });
    assert.match(issue(55, creatureOnly) ?? "", gateIssue, "a creature's hardness");
    assert.equal(issue(56, creatureOnly), null);
    // In a catalog file.
    const inFile = variant(emberText, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = itemCatalogOf(variant(emberText, withoutAmmo)).entries;
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(55, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(56, inFile, paths, files), null);
  }

  // ── A fight reads what items do ──
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const fight = (
    definition: RulesetDefinition,
    items: RulesetSheetItem[],
    foe: Record<string, unknown> = {},
    options: { abilities?: Record<string, number>; face?: number; foeFirst?: boolean } = {},
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 5,
      roller: () => options.face ?? 4,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build: build(definition, options.abilities ?? {}), items },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 30,
            defense: 1,
            initiativeModifier: options.foeFirst ? 20 : -5,
            actions: [],
            ...foe,
          },
        } as RulesetCombatantInput,
      ],
    });
  const ada = (state: RulesetEncounterState) => rulesetCombatant(state, "ada")!;
  {
    // The widow's ring, bound: a die fewer on attacks, named for the ring.
    const ringed = fight(gravewatch, [held(ring, "Widow's ring")]);
    assert.deepEqual(
      rulesetConditionModifiers(gravewatch, gravewatch.combat!, ada(ringed), "attacks").map((entry) => [
        entry.condition,
        entry.item,
        entry.modifier.flat,
      ]),
      [["Widow's ring", true, -1]],
    );
    // Even where no condition or level of the ruleset changes a number.
    const quiet = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        for (const entry of doc.combat.conditions) delete entry.modifiers;
      }),
      "Gravewatch whose conditions change no number",
    );
    assert.deepEqual(
      rulesetConditionModifiers(quiet, quiet.combat!, ada(fight(quiet, [held(ring, "Widow's ring")])), "attacks").map(
        (entry) => entry.modifier.flat,
      ),
      [-1],
    );
    // Two of them are one ring's worth, and one only carried does nothing.
    assert.equal(
      rulesetConditionModifiers(
        gravewatch,
        gravewatch.combat!,
        ada(fight(gravewatch, [held(ring, "Rings", true, 2)])),
        "attacks",
      ).length,
      1,
    );
    assert.deepEqual(
      rulesetConditionModifiers(
        gravewatch,
        gravewatch.combat!,
        ada(fight(gravewatch, [held(ring, "Ring", false)])),
        "attacks",
      ),
      [],
    );
    // The bound Dawn bell keeps Rattled off.
    const belled = fight(gravewatch, [held(bell, "Dawn bell")]);
    assert.equal(rulesetImmuneToCondition(ada(belled), "rattled", gravewatch), true);
    assert.equal(rulesetImmuneToCondition(ada(belled), "rattled"), false, "without the ruleset, the block alone");
    assert.equal(rulesetImmuneToCondition(ada(fight(gravewatch, [])), "rattled", gravewatch), false);

    // A condition a blow puts on is kept off too: the hollow warden's grip rattles, but not the belled.
    const gripped = (items: RulesetSheetItem[]) => {
      let state = createRulesetEncounter({
        definition: gravewatch,
        seed: 5,
        roller: () => 9,
        bestiary: entriesOf(gravewatch),
        combatants: [
          { id: "ada", name: "Ada", side: "party", build: build(gravewatch), items },
          { id: "warden", name: "Warden", side: "enemy", creature: { catalogId: "night", entryId: "hollow-warden" } },
        ],
      });
      if (state.order[state.turn] !== "warden") {
        state = applyRulesetCombatChoice(
          gravewatch,
          state,
          { actorId: "ada", optionId: "end-turn", targetIds: [] },
          () => 9,
        ).state;
      }
      return applyRulesetCombatChoice(
        gravewatch,
        state,
        { actorId: "warden", optionId: "grip", targetIds: ["ada"] },
        () => 9,
      ).events.flatMap((event) =>
        event.type === "condition" && event.condition === "rattled" ? [[event.active, event.reason]] : [],
      );
    };
    assert.deepEqual(gripped([]), [[true, "applied"]]);
    assert.deepEqual(gripped([held(bell, "Dawn bell")]), [[false, "immune"]]);

    // Defense, speed, effects and failed saves, from worn items of Ember Roads.
    const vest = (effect: RulesetCatalogItem["worn"]) => held({ ...coat, worn: effect }, "Odd coat");
    const guarded = fight(ember, [vest({ modifiers: [{ to: "defense", flat: 2 }] })]);
    const plain = fight(ember, [vest(undefined)]);
    const against = (state: RulesetEncounterState) => rulesetDefenseAgainst(ember, ember.combat!, state, ada(state));
    assert.equal(against(guarded).defense, against(plain).defense + 2, "on top of the coat's own guard");
    assert.deepEqual(against(guarded).guards, [{ condition: "Odd coat", item: true, value: 2 }]);
    const allowance = (state: RulesetEncounterState) =>
      rulesetMovementAllowance(ember, ember.combat!, ada(state), state);
    assert.ok(allowance(plain) > 0);
    assert.ok(allowance(fight(ember, [vest({ modifiers: [{ to: "speed", flat: -4 }] })])) < allowance(plain));
    assert.equal(allowance(fight(ember, [vest({ effects: ["speed-zero"] })])), 0, "cannot move");
    const fighter = parsedOrThrow(
      variant(emberText, (doc) => (doc.combat.attackRoll.advantage = true)),
      "Ember Roads rolling twice",
    );
    const cloaked = fight(fighter, [held({ ...coat, worn: { effects: ["attacks-against-disadvantage"] } }, "Cloak")]);
    assert.equal(
      rulesetAttackMode(fighter, fighter.combat!, rulesetCombatant(cloaked, "foe")!, ada(cloaked)),
      "disadvantage",
    );
    assert.equal(
      rulesetAttackMode(fighter, fighter.combat!, ada(cloaked), rulesetCombatant(cloaked, "foe")!),
      "normal",
    );
    const failing = fight(gravewatch, [held({ ...ring, worn: { failsSaves: ["steel"] } }, "Cold ring")]);
    assert.equal(rulesetCombatFailsSave(gravewatch, gravewatch.combat!, ada(failing), "steel"), true);

    // The waystone, carried, halves burn: the cinder-moth's wing dust.
    const moth = createRulesetEncounter({
      definition: ember,
      seed: 5,
      roller: () => 4,
      bestiary: entriesOf(ember),
      combatants: [
        { id: "ada", name: "Ada", side: "party", build: build(ember), items: [held(waystone, "Waystone", false)] },
        { id: "moth", name: "Moth", side: "enemy", creature: { catalogId: "road_trouble", entryId: "cinder-moth" } },
      ],
    });
    assert.deepEqual(rulesetCombatHide(ember, ada(moth)).resist, ["burn"]);
    const mothTurn =
      moth.order[moth.turn] === "moth"
        ? moth
        : applyRulesetCombatChoice(ember, moth, { actorId: "ada", optionId: "end-turn", targetIds: [] }, () => 4).state;
    const dusted = applyRulesetCombatChoice(
      ember,
      mothTurn,
      { actorId: "moth", optionId: "dust", targetIds: ["ada"] },
      () => 6,
    );
    const burn = firstOf(dusted.events, "damage");
    assert.deepEqual([burn.damageType, burn.adjust, burn.dealt], ["burn", "resist", Math.floor(burn.amount / 2)]);

    // An unmet requirement's cost in a fight: the gauntlets on somebody too weak for them.
    const gauntlets = itemOf(ember, "outfitter/ox-hide-gauntlets");
    const strict = {
      ...gauntlets,
      worn: undefined,
      requires: [
        {
          value: { abilityScore: "brawn" },
          atLeast: 3,
          otherwise: { modifiers: [{ to: "attacks" as const, flat: -1 }] },
        },
      ],
    };
    const weak = fight(ember, [held(strict, "Gauntlets")], {}, { abilities: { brawn: 1 } });
    assert.deepEqual(
      rulesetConditionModifiers(ember, ember.combat!, ada(weak), "attacks").map((entry) => [
        entry.condition,
        entry.modifier.flat,
      ]),
      [["Gauntlets", -1]],
    );
    const strong = fight(ember, [held(strict, "Gauntlets")], {}, { abilities: { brawn: 3 } });
    assert.deepEqual(rulesetConditionModifiers(ember, ember.combat!, ada(strong), "attacks"), []);

    // The ring's die in a real throw, and the log names the ring.
    const nail = itemOf(gravewatch, "kit/silver-nail");
    const armed = fight(
      gravewatch,
      [held(nail, "Silver coffin nail"), held(ring, "Widow's ring")],
      {},
      { abilities: { nerve: 3 }, face: 8 },
    );
    const thrown = applyRulesetCombatChoice(
      gravewatch,
      armed,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 8,
    );
    const attack = firstOf(thrown.events, "attack");
    assert.deepEqual(attack.bonuses, [{ condition: "Widow's ring", item: true, value: -1 }]);
    const t = ((key: string, params?: Record<string, unknown>) =>
      [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;
    const names = rulesetCombatNames(gravewatch, { combatants: armed.combatants } as never, t);
    assert.match(rulesetCombatEventLine(attack, names, t)!, /Widow's ring/);
    // A stack named like a condition is still the stack, not the condition's label.
    const named = { ...attack, bonuses: [{ condition: "rattled", item: true as const, value: -1 }] };
    assert.doesNotMatch(rulesetCombatEventLine(named, names, t)!, /Rattled/);
  }

  // ── resolution.adjust in a fight ──
  {
    // Two more for every roll made with Brawn, and one for every roll.
    const adjusted = (text: string, abilityOf: string) =>
      parsedOrThrow(
        variant(text, (doc) => {
          doc.resolution.adjust = [
            ...(doc.resolution.adjust ?? []),
            { value: { const: 2 }, abilities: [abilityOf] },
            { value: { const: 1 } },
          ];
        }),
        "an adjusted ruleset",
      );
    const emberPlus = adjusted(emberText, "brawn");
    const axe = itemOf(ember, "outfitter/hand-axe");
    const juno = (definition: RulesetDefinition) =>
      rulesetCombatant(
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
                lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
              },
              items: [held(axe, "Hand axe")],
            },
          ],
        }),
        "juno",
      )!;
    const before = juno(ember);
    const after = juno(emberPlus);
    const toHit = (who: typeof before, label: string) => who.actions.find((action) => action.label === label)!.toHit!;
    assert.equal(toHit(after, "Road axe") - toHit(before, "Road axe"), 3, "an attack row swung with Brawn");
    assert.equal(toHit(after, "Hand axe") - toHit(before, "Hand axe"), 3, "a weapon swung with Brawn");
    assert.equal(after.checks!.brawn! - before.checks!.brawn!, 3, "a contest on Brawn");
    assert.equal(after.checks!.wits! - before.checks!.wits!, 1, "a contest on Wits takes only the one for all");
    assert.equal(after.initiativeModifier - before.initiativeModifier, 1, "initiative, off Wits");
    // An entry off a list of abilities that rolls to hit, off Wits: only the one for all rolls.
    const rolling = (text: string) =>
      variant(text, (doc) => {
        doc.combat.abilities[0].toHit = { abilityMod: "wits" };
        const knacks = doc.catalogs.find((catalog: { id: string }) => catalog.id === "knacks");
        knacks.entries.find((entry: { id: string }) => entry.id === "coldfire-toss").mechanics.attackRoll = true;
      });
    const tossing = (definition: RulesetDefinition) => {
      const knacks = entriesOf(definition).knacks ?? definition.catalogs!.find((c) => c.id === "knacks")!.entries!;
      const toss = knacks.find((entry) => entry.id === "coldfire-toss")!;
      const state = createRulesetEncounter({
        definition,
        seed: 5,
        roller: () => 4,
        combatants: [
          {
            id: "juno",
            name: "Juno",
            side: "party",
            build: {
              ...build(definition, { wits: 1 }),
              lists: { knacks: rowsFromCatalogEntry("knacks", toss).map((row) => row.row) },
            },
            catalogs: { knacks },
          },
        ],
      });
      return rulesetCombatant(state, "juno")!.actions.find((action) => action.label === "Coldfire Toss")!.toHit!;
    };
    const plainToss = parsedOrThrow(rolling(emberText), "a toss that rolls");
    const adjustedToss = parsedOrThrow(
      rolling(
        JSON.stringify(
          variant(emberText, (doc) => {
            doc.resolution.adjust = [
              ...doc.resolution.adjust,
              { value: { const: 2 }, abilities: ["brawn"] },
              { value: { const: 1 } },
            ];
          }),
        ),
      ),
      "a toss that rolls, adjusted",
    );
    assert.equal(tossing(adjustedToss) - tossing(plainToss), 1, "an ability entry's roll");
    // A save, and initiative thrown again each round, on Gravewatch's Nerve.
    // Gravewatch with contest checks off a save and a skill, both rolled with Nerve.
    const checked = JSON.stringify(
      variant(gravewatchText, (doc) => {
        doc.combat.checks = [
          { id: "steel", label: "Steel", value: { saveMod: "steel" } },
          { id: "ward", label: "Ward", value: { skillMod: "ward" } },
        ];
      }),
    );
    const graveChecked = parsedOrThrow(JSON.parse(checked), "Gravewatch with contest checks");
    const gravePlus = adjusted(checked, "nerve");
    const warden = (definition: RulesetDefinition) =>
      createRulesetEncounter({
        definition,
        seed: 5,
        roller: () => 4,
        combatants: [
          { id: "ada", name: "Ada", side: "party", build: build(definition, { nerve: 2 }) },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 9, defense: 1, initiativeModifier: 0, actions: [] },
          },
        ],
      });
    const graveBefore = warden(graveChecked);
    const graveAfter = warden(gravePlus);
    assert.equal(ada(graveAfter).saves.steel! - ada(graveBefore).saves.steel!, 3, "Steel, a save rolled with Nerve");
    assert.equal(ada(graveAfter).initiativeModifier - ada(graveBefore).initiativeModifier, 3);
    assert.equal(ada(graveAfter).checks!.steel! - ada(graveBefore).checks!.steel!, 3, "a contest off a save");
    assert.equal(ada(graveAfter).checks!.ward! - ada(graveBefore).checks!.ward!, 3, "a contest off a skill");
    // A weapon thrown with a skill, Nerve's Wrestle: the silver nail.
    const nailOf = (definition: RulesetDefinition) =>
      rulesetCombatant(
        createRulesetEncounter({
          definition,
          seed: 5,
          roller: () => 4,
          combatants: [
            {
              id: "ada",
              name: "Ada",
              side: "party",
              build: build(definition, { nerve: 2 }),
              items: [held(itemOf(gravewatch, "kit/silver-nail"), "Nail")],
            },
          ],
        }),
        "ada",
      )!.actions.find((action) => action.id === "item:0")!.toHit!;
    assert.equal(nailOf(gravePlus) - nailOf(graveChecked), 3, "a weapon's skill rolled with Nerve");
    // And initiative thrown as a pool, where it is a number attacks move.
    const poolOf = (text: string) =>
      rulesetCombatant(
        createRulesetEncounter({
          definition: parsedOrThrow(variant(text, moveInitiative), "a moving Gravewatch"),
          seed: 5,
          roller: () => 4,
          combatants: [{ id: "ada", name: "Ada", side: "party", build: build(gravewatch, { nerve: 2 }) }],
        }),
        "ada",
      )!.initiativeModifier;
    assert.equal(
      poolOf(
        JSON.stringify(
          variant(checked, (doc) => {
            doc.resolution.adjust = [
              ...doc.resolution.adjust,
              { value: { const: 2 }, abilities: ["nerve"] },
              { value: { const: 1 } },
            ];
          }),
        ),
      ) - poolOf(checked),
      3,
      "a pool of initiative",
    );
    // Through a whole round, so the number is thrown again with the adjust in it.
    let round = graveAfter;
    for (let guard = 0; guard < 4 && round.round === 1; guard++) {
      round = applyRulesetCombatChoice(
        gravePlus,
        round,
        { actorId: round.order[round.turn]!, optionId: "end-turn", targetIds: [] },
        () => 4,
      ).state;
    }
    assert.equal(round.round, 2);
    assert.equal(ada(round).initiativeModifier, ada(graveAfter).initiativeModifier, "thrown again the same way");
  }

  // ── Hardness ──
  {
    const hard = parsedOrThrow(variant(gravewatchText, moveInitiative), "Gravewatch with hardness");
    const spade = itemOf(gravewatch, "kit/grave-spade");
    // Every die an eight: Ada's two dice of Nerve are two successes, plus three, so her number is 5.
    const against = (hardness: number) =>
      createRulesetEncounter({
        definition: hard,
        seed: 5,
        roller: () => 8,
        combatants: [
          {
            id: "ada",
            name: "Ada",
            side: "party",
            build: build(hard, { sinew: 3, nerve: 2 }),
            items: [held(spade, "Grave spade")],
          },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 30, defense: 1, initiativeModifier: 0, hardness, actions: [] },
          },
        ],
      });
    const turned = against(6);
    assert.equal(ada(turned).initiative, 5);
    assert.equal(ada(turned).hardness, 3, "her own, off her Sinew");
    assert.equal(rulesetCombatant(turned, "foe")!.hardness, 6);
    // The menu forecasts nothing for a spending blow below it, and harm for one that is not.
    const spending = (state: RulesetEncounterState) =>
      rulesetCombatOptions(hard, state, "ada")
        .find((option) => option.id === "item:0")!
        .styles!.find((style) => style.id === "telling")!.forecast!.averageDamage;
    assert.equal(spending(turned), 0);
    assert.ok(spending(against(5))! > 0);
    const blow = applyRulesetCombatChoice(
      hard,
      turned,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"], style: "telling" },
      () => 8,
    );
    assert.equal(firstOf(blow.events, "attack").outcome, "hit");
    assert.deepEqual(firstOf(blow.events, "hardness"), {
      type: "hardness",
      targetId: "foe",
      sourceId: "ada",
      label: "Grave spade",
      hardness: 6,
      dice: 5,
    });
    assert.equal(
      blow.events.some((event) => event.type === "damage"),
      false,
      "it does nothing",
    );
    assert.equal(ada(blow.state).initiative, 3, "and her number goes back to the base, as a blow that landed");
    const t = ((key: string, params?: Record<string, unknown>) =>
      [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;
    const names = rulesetCombatNames(hard, { combatants: blow.state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(blow.events, "hardness"), names, t),
      "game.combat.ruleset.event.hardness|Ada|Foe|Grave spade|5|6",
    );
    // At the hardness, it lands in full.
    const through = applyRulesetCombatChoice(
      hard,
      against(5),
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"], style: "telling" },
      () => 8,
    );
    assert.equal(
      through.events.some((event) => event.type === "hardness"),
      false,
    );
    assert.ok(firstOf(through.events, "damage").dealt > 0);
    // An item keeps a crash's condition off too: somebody who opens at the line is crashed, not marked.
    const crashing = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        moveInitiative(doc);
        doc.combat.initiative.plus = 0;
        doc.combat.initiative.resource.crash = { at: 0, condition: "marked" };
      }),
      "a crash that marks",
    );
    const opening = (items: RulesetSheetItem[]) =>
      createRulesetEncounter({
        definition: crashing,
        seed: 5,
        roller: () => 2,
        combatants: [{ id: "ada", name: "Ada", side: "party", build: build(crashing, { nerve: 1 }), items }],
      }).opening.filter((event) => event.type === "condition");
    assert.deepEqual(
      opening([]).map((event) => [event.condition, event.active]),
      [["marked", true]],
    );
    assert.deepEqual(
      opening([held({ ...bell, worn: { conditionImmunities: ["marked"] } }, "Bell")]).map((event) => [
        event.condition,
        event.active,
        event.reason,
      ]),
      [["marked", false, "immune"]],
    );
    // A creature's hardness comes out of the bestiary.
    const warded = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        moveInitiative(doc);
        creatureEntry(doc, "hollow-warden").creature.hardness = 4;
      }),
      "a hard warden",
    );
    const bestiary = createRulesetEncounter({
      definition: warded,
      seed: 1,
      bestiary: entriesOf(warded),
      combatants: [
        {
          id: "warden",
          name: "Hollow warden",
          side: "enemy",
          creature: { catalogId: "night", entryId: "hollow-warden" },
        },
      ],
    });
    assert.equal(rulesetCombatant(bestiary, "warden")!.hardness, 4);
    // One the Game Master invents has none: no tier bounds it, as none bounds soak.
    const invented = clampRulesetStatBlock(
      hard,
      rulesetProposedStatBlock(hard, {
        tier: hard.combat!.threat!.tiers[0]!.id,
        health: 3,
        defense: 1,
        initiativeModifier: 1,
        hardness: 9,
        actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 2, damage: { dice: "1d10" } }],
      } as never)!,
      hard.combat!.threat!.tiers[0]!.id,
    );
    assert.equal(invented.block.hardness, undefined);
    assert.ok(invented.adjusted.some((line) => /has no hardness/.test(line)));
    // An area names nobody, so its spending forecast reads the first combatant any legal aim catches.
    const boarded = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        moveInitiative(doc);
        doc.combat.initiative.plus = 0;
        doc.combat.distance = { label: "paces", perCell: 2 };
      }),
      "Gravewatch with hardness and a board",
    );
    const sweeping = (sinew: number) =>
      rulesetCombatOptions(
        boarded,
        createRulesetEncounter({
          definition: boarded,
          seed: 5,
          roller: () => 8,
          board: {
            grid: { width: 5, height: 1, tiles: [Array.from({ length: 5 }, () => "plains" as const)] },
            placements: { ada: { x: 0, y: 0 }, wight: { x: 2, y: 0 } },
          },
          combatants: [
            { id: "ada", name: "Ada", side: "party", build: build(boarded, { sinew, nerve: 1 }) },
            {
              id: "wight",
              name: "Wight",
              side: "enemy",
              block: {
                health: 30,
                defense: 1,
                initiativeModifier: 2,
                actions: [
                  {
                    id: "sweep",
                    name: "Sweep",
                    budget: "act",
                    toHit: 2,
                    damage: { count: 1, sides: 10, flat: 0 },
                    area: { shape: "burst", size: 4, friendlyFire: false },
                  },
                ],
              },
            },
          ],
        }),
        "wight",
      )
        .find((option) => option.id === "sweep")!
        .styles!.find((style) => style.id === "telling")!.forecast!.averageDamage;
    // The wight's number is 2: Ada's hardness of 3 turns it, and one of 2 does not.
    assert.equal(sweeping(3), 0);
    assert.ok(sweeping(2)! > 0);
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(ember, waystone).carried, [
      { to: "checks", names: ["Sway"], change: { value: "+1" } },
      { to: "harm", names: ["burn"], change: { hide: "resist" } },
    ]);
    assert.deepEqual(rulesetItemFacts(gravewatch, ring).worn, [{ to: "attacks", names: [], change: { value: "-1" } }]);
    assert.deepEqual(rulesetItemFacts(gravewatch, bell).worn?.at(-1), {
      to: "conditions",
      names: ["Rattled"],
      change: { hide: "immune" },
    });
    const everything = rulesetItemFacts(ember, {
      ...coat,
      worn: {
        effects: ["own-attacks-advantage", "attacks-against-disadvantage", "speed-zero"],
        modifiers: [
          { to: "defense", flat: 1 },
          { to: "speed", flat: -2 },
          { to: "speed", times: 0.5 },
        ],
        vulnerable: ["rust"],
        immune: ["burn"],
      },
    });
    assert.match(
      rulesetItemPromptFacts(everything),
      /worn: advantage on attacks, attacks against them have disadvantage, cannot move, \+1 Guard, -2 speed, half speed, vulnerable to rust, immune to burn$/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, waystone)),
      /carried: \+1 on checks \(Sway\), resists burn$/,
    );
    // A defense written as a number has no name of its own: Gravewatch's.
    assert.match(
      rulesetItemPromptFacts(
        rulesetItemFacts(gravewatch, { ...ring, worn: { modifiers: [{ to: "defense", flat: 1 }] } }),
      ),
      /worn: \+1 defense$/,
    );
  }

  // ── Invented items: attacks and defense, held to the rarity ──
  {
    // The form tells the Game Master which item stats a defense already counts: Ember Roads' Guard
    // adds up the guard of what is worn, and Gravewatch's defense is a number.
    assert.deepEqual(rulesetItemStatsRead(ember, ember.combat!.defense), ["guard"]);
    assert.deepEqual(rulesetItemStatsRead(gravewatch, gravewatch.combat!.defense), []);
    const invent = (proposal: Record<string, string>, like?: RulesetCatalogItem) =>
      inventRulesetItem(ember, { category: "gear", ...proposal }, like)!;
    const storied = invent({ rarity: "storied", worn: "+2 attack roll bonus; +1 Guard; advantage on attacks" });
    assert.deepEqual(storied.item.worn, {
      effects: ["own-attacks-advantage"],
      modifiers: [
        { to: "attacks", flat: 2 },
        { to: "defense", flat: 1 },
      ],
    });
    const capped = invent({ rarity: "common", worn: "+2 attack rolls; defense +2; +1d4 Guard" });
    assert.deepEqual(capped.item.worn, {
      modifiers: [
        { to: "attacks", flat: 1 },
        { to: "defense", flat: 1 },
      ],
    });
    assert.match(capped.notes.join(" "), /Defense takes a number such as \+1, so "\+1d4 Guard" left it out\./);
    // A stat Guard already adds up is how armor raises it, so "+1 Guard" beside it is left out rather
    // than counted twice; without the stat, the change stands.
    const bracer = inventRulesetItem(
      ember,
      { category: "armor", rarity: "common", worn: "+1 Guard; +1 attacks" },
      undefined,
    )!;
    assert.deepEqual(bracer.item.worn, {
      modifiers: [
        { to: "defense", flat: 1 },
        { to: "attacks", flat: 1 },
      ],
    });
    const doubled = inventRulesetItem(
      ember,
      { category: "armor", rarity: "common", stats: { guard: "1" }, slots: { body: "1" }, worn: "+1 Guard" },
      undefined,
    )!;
    assert.equal(doubled.item.worn, undefined);
    assert.equal(doubled.item.stats?.guard, 1);
    assert.match(
      doubled.notes.join(" "),
      /Guard already counts an item's Guard stat, so a change to it while worn was left out\./,
    );
    const both = inventRulesetItem(
      ember,
      { category: "armor", rarity: "common", stats: { guard: "1" }, worn: "+1 Guard; +1 attacks" },
      undefined,
    )!;
    assert.deepEqual(both.item.worn, { modifiers: [{ to: "attacks", flat: 1 }] });
    // In a pool fight an attack takes a flat number of dice, so dice are left out there.
    const pooled = inventRulesetItem(
      gravewatch,
      { category: "token", rarity: "rare", worn: "+1d4 attacks; +1 attacks" },
      undefined,
    )!;
    assert.deepEqual(pooled.item.worn, { modifiers: [{ to: "attacks", flat: 1 }] });
    assert.match(pooled.notes.join(" "), /Attacks take a number such as \+1, so "\+1d4 attacks" left it out\./);
    // Copied from `like`, what an item keeps off and its speed are kept, and only bonuses are capped.
    const kept = invent({ rarity: "common" }, {
      ...coat,
      worn: { resist: ["burn"], modifiers: [{ to: "speed", flat: 4 }] },
    } as RulesetCatalogItem);
    assert.deepEqual(kept.item.worn, { resist: ["burn"], modifiers: [{ to: "speed", flat: 4 }] });
    // A set ability is left out at a capped rarity, and what it keeps off is still what the item does.
    const shielded = invent({ rarity: "common" }, {
      ...coat,
      worn: { abilities: { brawn: { set: 2 } }, resist: ["burn"] },
    } as RulesetCatalogItem);
    assert.deepEqual(shielded.item.worn, { resist: ["burn"] });
  }

  console.log(
    "Ruleset armor: import checks, the 1.56 gate, items in fights, resolution.adjust on every fight roll, hardness, item facts and invented items passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
