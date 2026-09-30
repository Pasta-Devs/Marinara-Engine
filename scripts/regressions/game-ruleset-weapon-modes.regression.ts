/**
 * Fire modes, off-hand attacks, a damage floor and conditions on a hit (#6875, Capability API 1.58).
 *
 *   - A weapon's `modes` are other ways to make its attack: how many it shoots, what it adds to hit,
 *     a pool fight's per-die target moved, and how many it may be aimed at. The menu offers the ones
 *     its holder has the shots for, each with its forecast; a choice names one, and a party member
 *     the Engine plays weighs them too.
 *   - `combat.offHand` names the off-hand budget; a weapon marked `offHand` strikes again on it once
 *     its holder has attacked with another such weapon this turn, with a positive damage ability or
 *     without it.
 *   - `floor` is the least a hit deals before a resistance halves it; `onHit` puts a condition on the
 *     target when the harm dealt reached a number.
 *   - Checked at import, and the install gate asks for 1.58. Item facts, the Game Master's line and
 *     the log say it.
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
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemAttackStats,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetOpportunityAttack,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-weapon-modes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { getCapabilityPackageInstallIssue },
  { rulesetCombatEventLine, rulesetCombatNames },
  { rulesetModeText, rulesetOptionLabel },
  { createCombatDirector },
  { commandRulesetCombatDirector, createRulesetFight, priced, rulesetDirectorStage, syncRulesetCombatants },
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
  const build = (definition: RulesetDefinition, abilities: Record<string, number> = {}) => ({
    ...defaultRulesetSheetBuild(definition),
    abilities: { ...defaultRulesetSheetBuild(definition).abilities, ...abilities },
  });
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
  const bow = itemOf(ember, "outfitter/hunting-bow");
  const arrows = itemOf(ember, "outfitter/arrows");
  const nail = itemOf(gravewatch, "kit/silver-nail");
  const spade = itemOf(gravewatch, "kit/grave-spade");

  // ── Import ──
  {
    assert.deepEqual(bow.attack?.modes, [{ id: "volley", label: "Volley", ammo: 2, toHit: -2, targets: 2 }]);
    assert.equal(nail.attack?.offHand, true);
    assert.deepEqual(nail.attack?.onHit, [{ condition: "marked", atLeast: 2, rounds: 2 }]);
    assert.equal(spade.attack?.floor, 1);
    assert.deepEqual(gravewatch.combat?.offHand, { budget: "quick", ability: "full" });
    const bowAttack = (edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "hunting-bow").item.attack);
    const nailAttack = (edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "silver-nail").item.attack);
    refused(
      emberText,
      bowAttack((attack) => attack.modes.push({ id: "volley", label: "Again" })),
      /modes\.1\.id: The mode "volley" is listed twice/,
      "a mode twice",
    );
    refused(
      gravewatchText,
      nailAttack((attack) => (attack.modes = [{ id: "flurry", label: "Flurry", ammo: 2 }])),
      /modes\.0\.ammo: A mode's ammo is what one attack in it shoots, so the weapon shoots something/,
      "a mode that shoots from a weapon that shoots nothing",
    );
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "watch-pistol").item.attack.modes = [{ id: "fan", label: "Fan", ammo: 2 }]),
      /modes\.0\.ammo: One attack in this mode would shoot more than the clip holds/,
      "a mode bigger than the clip",
    );
    refused(
      emberText,
      bowAttack((attack) => (attack.modes[0].target = 1)),
      /modes\.0\.target: A mode's target moves a pool fight's own, so the pool's target can move/,
      "a target in a summed fight",
    );
    refused(
      gravewatchText,
      (doc) => {
        delete doc.combat.offHand;
      },
      /offHand: An off-hand attack spends combat\.offHand's budget, so the combat block declares one/,
      "an off-hand weapon with no off-hand budget",
    );
    refused(
      gravewatchText,
      (doc) => (doc.combat.offHand.budget = "bonus"),
      /offHand\.budget: Unknown budget "bonus"/,
      "an off-hand budget nobody has",
    );
    refused(
      gravewatchText,
      nailAttack((attack) => (attack.onHit[0].condition = "staked")),
      /onHit\.0\.condition: Unknown condition "staked"/,
      "a condition nobody has",
    );
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "grave-spade").item.attack.floor = { stat: "harm" }),
      /floor\.stat: Item stat "harm" must be number/,
      "a floor off a word",
    );
    refused(gravewatchText, (doc) => (doc.combat.offHand.ability = "half"), /ability/, "an ability rule nobody has");
    refused(
      gravewatchText,
      nailAttack((attack) => (attack.onHit[0].atLeast = 0)),
      /atLeast/,
      "a hit of none",
    );
    refused(
      gravewatchText,
      nailAttack((attack) => (attack.offHand = false)),
      /offHand/,
      "offHand is true or absent",
    );
    refused(
      emberText,
      bowAttack((attack) => {
        attack.modes = Array.from({ length: 7 }, (_, index) => ({ id: `m${index}`, label: `M${index}` }));
      }),
      /modes/,
      "more than six modes",
    );
    // A pool mode may move the target, and a floor may read a number stat.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "grave-spade").item.attack.modes = [{ id: "heave", label: "Heave", toHit: -1, target: -1 }];
        itemEntry(doc, "grave-spade").item.attack.floor = { stat: "target" };
      }),
      "a pool mode and a floor off a stat",
    );
  }

  // ── Install gate: 1.58 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-weapon-modes",
      name: "Weapon modes",
      version: "0.1.0",
      description: "A packaged ruleset whose weapons have modes.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /weapons have modes, an off-hand attack, a floor or conditions on a hit.*capabilityApi 1\.58/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const withoutWays = (doc: Record<string, any>) => {
      delete doc.combat.offHand;
      for (const entry of itemCatalogOf(doc).entries) {
        for (const key of ["modes", "offHand", "floor", "onHit"]) delete entry.item.attack?.[key];
      }
    };
    /** Less what the examples' items do when used, which is 1.59's and has a lane of its own. */
    const withoutUse = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) {
        delete entry.item.use;
        delete entry.item.charges;
      }
    };
    for (const text of [emberText, gravewatchText].map((each) => JSON.stringify(variant(each, withoutUse)))) {
      assert.match(issue(57, variant(text)) ?? "", gateIssue);
      assert.equal(issue(58, variant(text)), null);
      assert.equal(issue(57, variant(text, withoutWays)), null, "the rest of the example stays 1.57");
    }
    const one = (edit: (doc: Record<string, any>) => void) =>
      variant(gravewatchText, (doc) => {
        withoutWays(doc);
        withoutUse(doc);
        edit(doc);
      });
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["the off-hand budget alone", (doc) => (doc.combat.offHand = { budget: "quick" })],
      ["a floor", (doc) => (itemEntry(doc, "grave-spade").item.attack.floor = 1)],
      [
        "conditions on a hit",
        (doc) => (itemEntry(doc, "grave-spade").item.attack.onHit = [{ condition: "marked", atLeast: 1 }]),
      ],
      ["a mode", (doc) => (itemEntry(doc, "grave-spade").item.attack.modes = [{ id: "heave", label: "Heave" }])],
      [
        "an off-hand weapon",
        (doc) => {
          doc.combat.offHand = { budget: "quick" };
          itemEntry(doc, "silver-nail").item.attack.offHand = true;
        },
      ],
    ];
    for (const [what, edit] of cases) {
      assert.match(issue(57, one(edit)) ?? "", gateIssue, what);
      assert.equal(issue(58, one(edit)), null, what);
    }
    // In a catalog file.
    const inFile = variant(emberText, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = itemCatalogOf(variant(emberText, withoutUse)).entries;
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(57, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(58, inFile, paths, files), null);
  }

  // ── Fights ──
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const allOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
  const fight = (
    definition: RulesetDefinition,
    items: RulesetSheetItem[],
    options: {
      face?: number;
      abilities?: Record<string, number>;
      foes?: Array<Record<string, unknown>>;
    } = {},
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 5,
      roller: () => options.face ?? 4,
      combatants: [
        { id: "ada", name: "Ada", side: "party", build: build(definition, options.abilities ?? {}), items },
        ...(options.foes ?? [{}]).map((foe, index) => ({
          id: index === 0 ? "foe" : `foe${index + 1}`,
          name: index === 0 ? "Foe" : `Foe ${index + 1}`,
          side: "enemy" as const,
          block: { health: 60, defense: 1, initiativeModifier: -20, actions: [], ...foe } as never,
        })),
      ],
    });
  const ada = (state: RulesetEncounterState) => rulesetCombatant(state, "ada")!;
  const optionOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "ada").find((option) => option.id === id);
  const choose = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: { optionId: string; targetIds?: string[]; mode?: string },
    face = 4,
  ) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", targetIds: choice.targetIds ?? ["foe"], ...choice },
      () => face,
    );
  const taken = (step: ReturnType<typeof choose>, what: string) => {
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
      `${what} is taken: ${JSON.stringify(step.events.filter((event) => event.type === "refused"))}`,
    );
    return step;
  };
  const nextTurn = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    let now = taken(choose(definition, state, { optionId: "end-turn", targetIds: [] }), "end-turn").state;
    while (now.order[now.turn] !== "ada") {
      now = applyRulesetCombatChoice(
        definition,
        now,
        { actorId: now.order[now.turn]!, optionId: "end-turn", targetIds: [] },
        () => 4,
      ).state;
    }
    return now;
  };
  const t = ((key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;

  // ── A volley ──
  {
    const two = [{ defense: 9 }, { defense: 9 }];
    const start = fight(ember, [held(bow, "Hunting bow"), held(arrows, "Arrows", false, 5)], { face: 6, foes: two });
    const option = optionOf(ember, start, "item:0")!;
    assert.equal(option.modes?.length, 1);
    const volley = option.modes![0]!;
    assert.deepEqual([volley.id, volley.label, volley.targets], ["volley", "Volley", 2]);
    assert.ok(
      volley.forecast!.hitChance! < option.forecast!.hitChance!,
      "the volley is wilder than one arrow, and the forecast says so",
    );
    // Two targets, one roll each, two arrows, and the attack named for its mode.
    const loosed = taken(
      choose(ember, start, { optionId: "item:0", targetIds: ["foe", "foe2"], mode: "volley" }, 6),
      "a volley",
    );
    const attacks = allOf(loosed.events, "attack");
    assert.deepEqual(
      attacks.map((attack) => [attack.targetId, attack.label]),
      [
        ["foe", "Hunting bow (Volley)"],
        ["foe2", "Hunting bow (Volley)"],
      ],
    );
    assert.equal(attacks[1]!.modifier, attacks[0]!.modifier);
    const single = allOf(taken(choose(ember, start, { optionId: "item:0" }, 6), "one arrow").events, "attack")[0]!;
    assert.equal(attacks[0]!.modifier, single.modifier - 2, "two less to hit than one arrow");
    assert.deepEqual(ada(loosed.state).itemsUsed, { 1: 2 });
    assert.equal(firstOf(loosed.events, "shot").label, "Hunting bow (Volley)");
    // At one target it still looses two.
    const atOne = taken(choose(ember, start, { optionId: "item:0", mode: "volley" }, 6), "a volley at one");
    assert.equal(allOf(atOne.events, "attack").length, 1);
    assert.deepEqual(ada(atOne.state).itemsUsed, { 1: 2 });
    // At three it is refused, and so is a mode the bow does not have.
    assert.equal(
      firstOf(
        choose(ember, fight(ember, [held(bow, "Bow"), held(arrows, "Arrows", false, 5)], { foes: [{}, {}, {}] }), {
          optionId: "item:0",
          targetIds: ["foe", "foe2", "foe3"],
          mode: "volley",
        }).events,
        "refused",
      ).reason,
      "bad-target",
    );
    assert.equal(
      firstOf(choose(ember, start, { optionId: "item:0", mode: "rain" }).events, "refused").reason,
      "unknown-mode",
    );
    // One arrow is not a volley: the mode is not offered, and naming it is refused.
    const lastArrow = fight(ember, [held(bow, "Hunting bow"), held(arrows, "Arrows", false, 1)]);
    assert.equal(optionOf(ember, lastArrow, "item:0")?.modes, undefined);
    assert.equal(
      firstOf(choose(ember, lastArrow, { optionId: "item:0", mode: "volley" }).events, "refused").reason,
      "unknown-mode",
    );
    // The menu's words.
    const words = rulesetModeText(option as never, volley, t);
    assert.ok(
      words.startsWith(`game.combat.ruleset.option.forecastHit|${Math.round(volley.forecast!.hitChance! * 100)}`),
      words,
    );
    assert.ok(words.endsWith(" · game.combat.ruleset.mode.targets|2"), words);
    assert.equal(
      rulesetModeText(option as never, { ...volley, targets: 1 }, t).includes("mode.targets"),
      false,
      "one target goes without saying",
    );
  }

  // ── A volley held by a window picks up as a volley ──
  {
    const flinching = [
      {
        defense: 1,
        actions: [{ id: "flinch", name: "Flinch", budget: "act", self: true, reaction: { on: "hit" } }],
      },
    ];
    const start = fight(ember, [held(bow, "Hunting bow"), held(arrows, "Arrows", false, 5)], {
      face: 6,
      foes: flinching,
    });
    const aimed = taken(choose(ember, start, { optionId: "item:0", mode: "volley" }, 6), "a volley at a flincher");
    assert.ok(aimed.state.window, "the hit is held while the foe is asked");
    const passed = applyRulesetCombatChoice(
      ember,
      aimed.state,
      { actorId: "foe", optionId: RULESET_PASS_OPTION, targetIds: [], window: aimed.state.window!.id },
      () => 6,
    );
    assert.equal(firstOf(passed.events, "damage").label, "Hunting bow (Volley)");
    assert.deepEqual(ada(passed.state).itemsUsed, { 1: 2 }, "and it was paid for once, as a volley");
  }

  // ── The Engine's picker makes each mode in every initiative style ──
  {
    const both = parsedOrThrow(
      variant(gravewatchText, (doc) => {
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
        itemEntry(doc, "grave-spade").item.attack.modes = [{ id: "heave", label: "Heave", toHit: -1 }];
      }),
      "a spade that heaves where initiative moves",
    );
    const state = fight(both, [held(itemOf(both, "kit/grave-spade"), "Grave spade")], {
      face: 8,
      abilities: { sinew: 3, nerve: 3 },
    });
    const ways = priced(both, state, ada(state)).filter((way) => way.option.id === "item:0");
    const heaveMenu = optionOf(both, state, "item:0")!.modes!.find((mode) => mode.id === "heave")!;
    const pressed = ways.find((way) => way.mode === "heave" && way.style === "press")!;
    assert.ok(pressed, "the heave is made in the style that takes");
    assert.equal(pressed.option.forecast?.averageDamage, 0, "a taking blow does no harm");
    assert.equal(pressed.takes?.shift, heaveMenu.forecast!.averageDamage, "it takes what a heave would deal");
    assert.equal(pressed.option.label, "Grave spade (Heave), Press");
    assert.ok(ways.some((way) => way.mode === "heave" && way.style === "telling"));
    assert.ok(ways.some((way) => way.mode === undefined && way.style === "press"));
  }

  // ── A pool mode moves the per-die target ──
  {
    const heaving = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        itemEntry(doc, "grave-spade").item.attack.modes = [{ id: "heave", label: "Heave", toHit: -1, target: -1 }];
      }),
      "a spade that heaves",
    );
    const heavy = itemOf(heaving, "kit/grave-spade");
    const start = fight(heaving, [held(heavy, "Grave spade")], { face: 8, abilities: { sinew: 3 } });
    const plain = allOf(taken(choose(heaving, start, { optionId: "item:0" }, 8), "a swing").events, "attack")[0]!;
    const heave = allOf(
      taken(choose(heaving, start, { optionId: "item:0", mode: "heave" }, 8), "a heave").events,
      "attack",
    )[0]!;
    assert.equal(plain.pool!.target, 6, "the spade's own target");
    assert.equal(heave.pool!.target, 5, "moved down one by the mode");
    assert.equal(heave.rolls.length, plain.rolls.length - 1, "a die fewer");
    assert.equal(heave.label, "Grave spade (Heave)");
  }

  // ── The off hand ──
  {
    const two = [held(nail, "Silver coffin nail"), held(nail, "Left nail")];
    const start = fight(gravewatch, two, { face: 8, abilities: { nerve: 3 } });
    assert.equal(optionOf(gravewatch, start, "offhand:0"), undefined, "nothing in the off hand before an attack");
    assert.equal(optionOf(gravewatch, start, "offhand:1"), undefined);
    const first = taken(choose(gravewatch, start, { optionId: "item:0" }, 8), "the first nail");
    assert.equal(ada(first.state).flags.offHand, 0);
    assert.equal(optionOf(gravewatch, first.state, "offhand:0"), undefined, "not the same nail again");
    const second = optionOf(gravewatch, first.state, "offhand:1")!;
    assert.deepEqual([second.budget, second.offHand, second.label], ["quick", true, "Left nail"]);
    assert.equal(rulesetOptionLabel(second as never, t), "game.combat.ruleset.menu.offHand|Left nail");
    const struck = taken(choose(gravewatch, first.state, { optionId: "offhand:1" }, 8), "the off-hand nail");
    assert.deepEqual(firstOf(struck.events, "budget"), { type: "budget", actorId: "ada", budget: "quick", left: 0 });
    assert.equal(firstOf(struck.events, "attack").label, "Left nail");
    // Next turn it waits for another first attack.
    assert.equal(optionOf(gravewatch, nextTurn(gravewatch, struck.state), "offhand:1"), undefined);
    // One nail has no partner, and a spade in both hands is no off-hand weapon.
    const alone = taken(
      choose(gravewatch, fight(gravewatch, [held(nail, "Nail")], { face: 8 }), { optionId: "item:0" }, 8),
      "alone",
    );
    assert.equal(optionOf(gravewatch, alone.state, "offhand:0"), undefined);
    const spadeFirst = taken(
      choose(
        gravewatch,
        fight(gravewatch, [held(spade, "Spade"), held(nail, "Nail")], { face: 8, abilities: { sinew: 3 } }),
        { optionId: "item:0" },
        8,
      ),
      "the spade",
    );
    assert.equal(ada(spadeFirst.state).flags.offHand, undefined, "a spade lets no nail follow it");
    assert.equal(optionOf(gravewatch, spadeFirst.state, "offhand:1"), undefined);
    // Never a strike at somebody walking away: an off-hand attack follows its holder's own.
    const onlyOff = {
      ...ada(first.state),
      actions: ada(first.state).actions.filter((action) => action.offHandOf !== undefined),
    };
    assert.equal(rulesetOpportunityAttack(onlyOff), null);
    // With `penalty-only`, the off hand keeps a damage ability only when it takes something away.
    const keeping = (rule: "full" | "penalty-only", nerve: number) => {
      const ruled = parsedOrThrow(
        variant(gravewatchText, (doc) => {
          doc.combat.offHand.ability = rule;
          itemEntry(doc, "silver-nail").item.attack.damage.abilities = ["nerve"];
        }),
        `an off hand that is ${rule}`,
      );
      const armed = itemOf(ruled, "kit/silver-nail");
      const state = fight(ruled, [held(armed, "Nail"), held(armed, "Left nail")], { abilities: { nerve } });
      const actions = ada(state).actions;
      return [
        actions.find((action) => action.id === "item:1")!.damage!.count,
        actions.find((action) => action.id === "offhand:1")!.damage!.count,
      ];
    };
    const [main, offFull] = keeping("full", 3);
    assert.equal(offFull, main, "full keeps it");
    const [mainKept, offKept] = keeping("penalty-only", 3);
    assert.equal(offKept, mainKept - 3, "penalty-only drops a bonus");
    // An off-hand attack is one blow, whatever strikes the main attack buys.
    const twice = parsedOrThrow(
      variant(gravewatchText, (doc) => (itemEntry(doc, "silver-nail").item.attack.strikes = { const: 2 })),
      "a nail that strikes twice",
    );
    const quick = itemOf(twice, "kit/silver-nail");
    const bothHands = ada(fight(twice, [held(quick, "Nail"), held(quick, "Left nail")])).actions;
    assert.equal(bothHands.find((action) => action.id === "item:1")!.strikes, 2);
    assert.equal(bothHands.find((action) => action.id === "offhand:1")!.strikes, undefined);
  }

  // ── A floor ──
  {
    // Gravewatch's spade against something that soaks every die: never less than one.
    const soaker = fight(gravewatch, [held(spade, "Grave spade")], {
      face: 8,
      abilities: { sinew: 3 },
      foes: [{ soak: { all: 40 } }],
    });
    const swung = taken(choose(gravewatch, soaker, { optionId: "item:0" }, 8), "a swing into soak");
    const damage = firstOf(swung.events, "damage");
    assert.equal(damage.pool!.soak!.taken > 0, true, "the soak took it all");
    assert.deepEqual([damage.amount, damage.floor, damage.dealt], [1, 1, 1]);
    const names = rulesetCombatNames(gravewatch, { combatants: swung.state.combatants } as never, t);
    assert.match(rulesetCombatEventLine(damage, names, t) ?? "", /game\.combat\.ruleset\.event\.damageFloor\|1$/);
    // A hit that deals more is untouched, and says nothing of a floor.
    const clean = firstOf(
      taken(
        choose(
          gravewatch,
          fight(gravewatch, [held(spade, "Spade")], { face: 8, abilities: { sinew: 3 } }),
          { optionId: "item:0" },
          8,
        ),
        "a clean swing",
      ).events,
      "damage",
    );
    assert.ok(clean.amount > 1);
    assert.equal(clean.floor, undefined);
    // A summed fight: an axe that never deals less than nine, halved by a resistance after.
    const heavy = parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "hand-axe").item.attack.floor = 9)),
      "an axe with a floor",
    );
    const axe = itemOf(heavy, "outfitter/hand-axe");
    const low = firstOf(
      taken(choose(heavy, fight(heavy, [held(axe, "Axe")], { face: 1 }), { optionId: "item:0" }, 1), "a weak chop")
        .events,
      "damage",
    );
    assert.deepEqual([low.amount, low.floor], [9, 9]);
    const resisted = firstOf(
      taken(
        choose(
          heavy,
          fight(heavy, [held(axe, "Axe")], { face: 1, foes: [{ resist: ["cut"] }] }),
          { optionId: "item:0" },
          1,
        ),
        "into a resistance",
      ).events,
      "damage",
    );
    assert.deepEqual([resisted.amount, resisted.dealt, resisted.adjust], [9, 4, "resist"]);
  }

  // ── On a hit ──
  {
    const start = fight(gravewatch, [held(nail, "Silver coffin nail")], { face: 8, abilities: { nerve: 3 } });
    const driven = taken(choose(gravewatch, start, { optionId: "item:0" }, 8), "a nail driven in");
    const dealt = firstOf(driven.events, "damage").dealt;
    assert.ok(dealt >= 2, `deep enough: ${dealt}`);
    assert.deepEqual(
      allOf(driven.events, "condition").map((event) => [event.targetId, event.condition, event.active, event.reason]),
      [["foe", "marked", true, "applied"]],
    );
    assert.deepEqual(
      rulesetCombatant(driven.state, "foe")!.tracked.map((entry) => [entry.condition, entry.rounds, entry.source]),
      [["marked", 2, "ada"]],
    );
    // Exactly at the number is enough; one short is not.
    const at = (atLeast: number) => {
      const ruled = parsedOrThrow(
        variant(gravewatchText, (doc) => (itemEntry(doc, "silver-nail").item.attack.onHit[0].atLeast = atLeast)),
        `a nail that marks at ${atLeast}`,
      );
      return allOf(
        taken(
          choose(
            ruled,
            fight(ruled, [held(itemOf(ruled, "kit/silver-nail"), "Nail")], { face: 8, abilities: { nerve: 3 } }),
            { optionId: "item:0" },
            8,
          ),
          "a nail",
        ).events,
        "condition",
      ).length;
    };
    assert.equal(at(dealt), 1);
    assert.equal(at(dealt + 1), 0);
    // A condition that ends when its bearer is harmed is put on after the blow's harm, so the blow
    // that marks does not also take the mark off.
    const fragile = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const marked = doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "marked");
        marked.effects = [...(marked.effects ?? []), "ends-on-damage"];
      }),
      "a mark the next harm takes off",
    );
    const staying = taken(
      choose(
        fragile,
        fight(fragile, [held(itemOf(fragile, "kit/silver-nail"), "Nail")], { face: 8, abilities: { nerve: 3 } }),
        {
          optionId: "item:0",
        },
        8,
      ),
      "a fragile mark",
    );
    assert.deepEqual(
      rulesetCombatant(staying.state, "foe")!.tracked.map((entry) => entry.condition),
      ["marked"],
    );
    // Without rounds it lasts until something takes it off, and a creature immune to it is not marked.
    const lasting = parsedOrThrow(
      variant(gravewatchText, (doc) => delete itemEntry(doc, "silver-nail").item.attack.onHit[0].rounds),
      "a nail whose mark lasts",
    );
    const kept = taken(
      choose(
        lasting,
        fight(lasting, [held(itemOf(lasting, "kit/silver-nail"), "Nail")], { face: 8, abilities: { nerve: 3 } }),
        { optionId: "item:0" },
        8,
      ),
      "a lasting mark",
    );
    assert.deepEqual(
      rulesetCombatant(kept.state, "foe")!.tracked.map((entry) => entry.rounds),
      [null],
    );
    const immune = taken(
      choose(
        gravewatch,
        fight(gravewatch, [held(nail, "Nail")], {
          face: 8,
          abilities: { nerve: 3 },
          foes: [{ conditionImmunities: ["marked"] }],
        }),
        { optionId: "item:0" },
        8,
      ),
      "at the immune",
    );
    assert.deepEqual(
      allOf(immune.events, "condition").map((event) => [event.active, event.reason]),
      [[false, "immune"]],
    );
  }

  // ── Through the director: a player's mode, and a party member the Engine plays ──
  {
    const bestiary = Object.fromEntries(
      (ember.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
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
    const director = (definition: RulesetDefinition, bowItem: RulesetCatalogItem) => {
      const built = createRulesetFight({
        definition,
        seed: 3,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "moth", name: "Cinder-moth", creature: "road_trouble/cinder-moth" }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: build(definition, { wits: 3 }) } }],
        playerName: null,
        live: null,
        items: () => [held(bowItem, "Hunting bow"), held(arrows, "Arrows", false, 9)],
        partyCatalogs: {},
        bestiary,
      });
      assert.ok(built.ok, built.ok ? "" : built.error);
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("ada", "Ada", "player")],
        enemies: [unit("moth", "Cinder-moth", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      state.rulesetFight = built.fight;
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      return state;
    };
    const said = (state: ReturnType<typeof director>) => state.rulesetFight!.events.map((entry) => entry.event);
    // A player's command names the mode.
    const played = director(ember, bow);
    let guard = 0;
    while (played.rulesetFight!.encounter.order[played.rulesetFight!.encounter.turn] !== "ada" && guard++ < 10) {
      assert.ok(commandRulesetCombatDirector(ember, played, { type: "continue" }).ok);
    }
    const unknown = commandRulesetCombatDirector(ember, played, {
      type: "ruleset",
      optionId: "item:0",
      targetIds: ["moth"],
      mode: "rain",
    });
    assert.deepEqual(unknown.ok ? null : unknown.code, "ruleset_combat_unknown-mode");
    assert.ok(
      commandRulesetCombatDirector(ember, played, {
        type: "ruleset",
        optionId: "item:0",
        targetIds: ["moth"],
        mode: "volley",
      }).ok,
    );
    assert.ok(said(played).some((event) => event.type === "attack" && event.label === "Hunting bow (Volley)"));
    // The Engine's own picker weighs a mode aimed at one target like any other way to attack: one
    // that is far likelier to land is the one it takes.
    const aiming = parsedOrThrow(
      variant(emberText, (doc) => {
        // Loosed as it is, it cannot reach the moth's Guard at all; aimed, it can hardly miss.
        itemEntry(doc, "hunting-bow").item.attack.toHit.bonus = -12;
        itemEntry(doc, "hunting-bow").item.attack.modes = [{ id: "aimed", label: "Aimed", toHit: 14 }];
      }),
      "a bow that aims",
    );
    const auto = director(aiming, itemOf(aiming, "outfitter/hunting-bow"));
    assert.ok(commandRulesetCombatDirector(aiming, auto, { type: "control", unitId: "ada", controller: "ai" }).ok);
    guard = 0;
    while (
      !said(auto).some((event) => event.type === "attack" && event.actorId === "ada") &&
      !auto.outcome &&
      guard++ < 20
    ) {
      assert.ok(commandRulesetCombatDirector(aiming, auto, { type: "continue" }).ok);
    }
    assert.equal(
      said(auto).find((event) => event.type === "attack" && event.actorId === "ada")?.label,
      "Hunting bow (Aimed)",
    );
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(ember, bow).attack?.modes, [{ label: "Volley", ammo: 2, toHit: -2, targets: 2 }]);
    const nailFacts = rulesetItemFacts(gravewatch, nail).attack!;
    assert.deepEqual(nailFacts.offHand, { budget: "Quick" });
    assert.deepEqual(nailFacts.onHit, [{ condition: "Marked", atLeast: 2, rounds: 2 }]);
    assert.equal(rulesetItemFacts(gravewatch, spade).attack?.floor, 1);
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, bow)),
      /, modes Volley \(2 shots, -2 to hit, up to 2 targets\)$/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, nail)),
      /, off hand \(Quick\), Marked for 2 rounds when a hit deals 2 or more$/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, spade)),
      /, at least 1 on a hit before resistance$/,
    );
    // A floor read off a stat is a stat the attack reads, and says what the stat gives.
    const statFloor = { ...spade, attack: { ...spade.attack!, floor: { stat: "target" } } };
    const soakFloor = { ...spade.attack!, floor: { stat: "soak_blunt" } };
    assert.equal(rulesetItemAttackStats(spade.attack!).includes("soak_blunt"), false);
    assert.ok(rulesetItemAttackStats(soakFloor as never).includes("soak_blunt"), "a floor off a stat reads it");
    assert.equal(rulesetItemFacts(gravewatch, statFloor as RulesetCatalogItem).attack?.floor, 6);
    const pool = {
      ...spade,
      attack: { ...spade.attack!, modes: [{ id: "heave", label: "Heave", toHit: -1, target: -1 }] },
    };
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, pool as RulesetCatalogItem)),
      /modes Heave \(-1 to hit, target -1\)/,
    );
  }

  console.log(
    "Ruleset weapon modes: import checks, the 1.58 gate, modes on the menu and in the director, the off hand, a floor, conditions on a hit and item facts passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
