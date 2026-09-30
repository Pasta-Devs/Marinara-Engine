/**
 * Ammunition and reloading for weapons in ruleset fights (#6871, Capability API 1.57).
 *
 *   - A weapon's `ammo` draws `perAttack` of a carried item with its tag each attack, first stack
 *     first, and is offered only while its holder carries enough. After a fight the party wins,
 *     `recover` of what was shot comes back, rounded down once.
 *   - A weapon's `clip` is a loaded count kept on its inventory stack: attacks spend what is loaded,
 *     and a Reload option on the named budget fills it, out of what it shoots where it shoots any.
 *   - What a fight shot, loaded and won back is written onto those very stacks.
 *   - Checked at import, and the install gate asks for 1.57. Item facts, the Game Master's line, the
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
  rulesetItemAttackStats,
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
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-ammo-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { getCapabilityPackageInstallIssue },
  { rulesetCombatEventLine, rulesetCombatNames },
  { createCombatDirector },
  { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants },
] = await Promise.all([
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/client/src/lib/ruleset-combat-log.js"),
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
  const pistol = itemOf(gravewatch, "kit/watch-pistol");
  const shot = itemOf(gravewatch, "kit/shot-and-powder");

  // ── Import ──
  {
    assert.deepEqual(bow.attack?.ammo, { tag: "arrow", recover: 0.5 });
    assert.deepEqual(pistol.attack?.ammo, { tag: "shot" });
    assert.deepEqual(pistol.attack?.clip, { max: 1, reload: "act" });
    const bowAttack = (edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "hunting-bow").item.attack);
    const pistolAttack = (edit: (attack: Record<string, any>) => void) => (doc: Record<string, any>) =>
      edit(itemEntry(doc, "watch-pistol").item.attack);
    refused(
      emberText,
      bowAttack((attack) => (attack.ammo.tag = "bolt")),
      /ammo\.tag: Unknown item tag "bolt"/,
      "a tag",
    );
    refused(
      gravewatchText,
      pistolAttack((attack) => (attack.clip.reload = "rest")),
      /clip\.reload: Unknown budget "rest"/,
      "a reload's budget",
    );
    refused(
      gravewatchText,
      pistolAttack((attack) => (attack.clip.max = { stat: "damage" })),
      /clip\.max\.stat: Item stat "damage" must be number/,
      "a clip read off a stat that is no number",
    );
    refused(
      gravewatchText,
      pistolAttack((attack) => (attack.clip.max = { stat: "reach" })),
      /clip\.max\.stat: Unknown item stat "reach"/,
      "a clip read off no stat",
    );
    refused(
      gravewatchText,
      pistolAttack((attack) => (attack.ammo.recover = 0.5)),
      /ammo\.recover: A clip's rounds are not picked up after a fight/,
      "recover beside a clip",
    );
    refused(
      gravewatchText,
      pistolAttack((attack) => (attack.ammo.perAttack = 2)),
      /ammo\.perAttack: One attack would shoot more than the clip holds/,
      "an attack bigger than the clip",
    );
    refused(
      emberText,
      bowAttack((attack) => (attack.ammo.perAttack = 0)),
      /perAttack/,
      "no shots an attack",
    );
    refused(
      emberText,
      bowAttack((attack) => (attack.ammo.recover = 2)),
      /recover/,
      "more back than was shot",
    );
    refused(
      emberText,
      bowAttack((attack) => (attack.ammo.from = "quiver")),
      /Unrecognized key/,
      "a key nobody reads",
    );
    // A clip read off the item's own number stat is fine, and one bigger than a shot is too.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const attack = itemEntry(doc, "watch-pistol").item.attack;
        attack.clip.max = { stat: "target" };
        attack.ammo.perAttack = 2;
      }),
      "a clip read off a stat",
    );
    // A ruleset with no fight carries a weapon and reads nothing of it, as it reads nothing else.
    parsedOrThrow(
      variant(gravewatchText, (doc) => {
        delete doc.combat;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
        itemEntry(doc, "watch-pistol").item.attack.clip.reload = "nothing";
      }),
      "a weapon in a ruleset without fights",
    );
  }

  // ── Install gate: 1.57 ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-ammo",
      name: "Ammunition",
      version: "0.1.0",
      description: "A packaged ruleset whose weapons shoot.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /weapons shoot ammunition or keep a loaded count.*capabilityApi 1\.57/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    /** The examples less what their weapons shoot and load. */
    const withoutAmmo = (doc: Record<string, any>) => {
      for (const entry of itemCatalogOf(doc).entries) {
        delete entry.item.attack?.ammo;
        delete entry.item.attack?.clip;
      }
    };
    /** Less the other ways their weapons fight and what their items do when used, which are 1.58's
     *  and 1.59's and have lanes of their own. */
    const withoutWays = (doc: Record<string, any>) => {
      delete doc.combat?.offHand;
      for (const entry of itemCatalogOf(doc).entries) {
        for (const key of ["modes", "offHand", "floor", "onHit"]) delete entry.item.attack?.[key];
        delete entry.item.use;
        delete entry.item.charges;
      }
    };
    for (const text of [emberText, gravewatchText].map((each) => JSON.stringify(variant(each, withoutWays)))) {
      assert.match(issue(56, variant(text)) ?? "", gateIssue);
      assert.equal(issue(57, variant(text)), null);
      assert.equal(issue(56, variant(text, withoutAmmo)), null, "the rest of the example stays 1.56");
    }
    const onlyClip = variant(gravewatchText, (doc) => {
      withoutAmmo(doc);
      withoutWays(doc);
      itemEntry(doc, "watch-pistol").item.attack.clip = { max: 1, reload: "act" };
    });
    assert.match(issue(56, onlyClip) ?? "", gateIssue, "a clip alone");
    assert.equal(issue(57, onlyClip), null);
    // In a catalog file.
    const inFile = variant(emberText, (doc) => {
      const catalog = itemCatalogOf(doc);
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = itemCatalogOf(variant(emberText, withoutWays)).entries;
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(56, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(57, inFile, paths, files), null);
  }

  // ── A fight shoots ──
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const found = events.find((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };
  const fight = (
    definition: RulesetDefinition,
    items: RulesetSheetItem[],
    options: { health?: number; face?: number; abilities?: Record<string, number> } = {},
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
          block: { health: options.health ?? 60, defense: 1, initiativeModifier: -20, actions: [] },
        },
      ],
    });
  const ada = (state: RulesetEncounterState) => rulesetCombatant(state, "ada")!;
  const optionOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "ada").find((option) => option.id === id);
  const take = (definition: RulesetDefinition, state: RulesetEncounterState, optionId: string, face = 4) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId, targetIds: optionId.startsWith("item:") ? ["foe"] : [] },
      () => face,
    );
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
      `${optionId} is taken: ${JSON.stringify(step.events)}`,
    );
    return step;
  };
  /** Ada's turn over and back again: the foe has nothing to do. */
  const nextTurn = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    let now = take(definition, state, "end-turn").state;
    if (now.order[now.turn] !== "ada")
      now = applyRulesetCombatChoice(
        definition,
        now,
        { actorId: "foe", optionId: "end-turn", targetIds: [] },
        () => 4,
      ).state;
    assert.equal(now.order[now.turn], "ada");
    return now;
  };
  const t = ((key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {}).map(String)].join("|")) as never;

  {
    // The bow, held, with a quiver of three: offered with what it can shoot, and each shot is one
    // arrow off the quiver.
    const start = fight(ember, [held(bow, "Hunting bow"), held(arrows, "Arrows", false, 3)]);
    assert.equal(optionOf(ember, start, "item:0")?.ammo, 3);
    const first = take(ember, start, "item:0");
    assert.deepEqual(firstOf(first.events, "shot"), {
      type: "shot",
      actorId: "ada",
      optionId: "item:0",
      label: "Hunting bow",
      left: 2,
    });
    assert.deepEqual(ada(first.state).itemsUsed, { 1: 1 });
    assert.deepEqual(ada(first.state).recoverable, { 1: 0.5 });
    const names = rulesetCombatNames(ember, { combatants: first.state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(first.events, "shot"), names, t),
      "game.combat.ruleset.event.shot|Hunting bow|2",
    );
    // Shot out, it is not on the menu, and naming it is refused.
    let now = first.state;
    for (let i = 0; i < 2; i++) now = take(ember, nextTurn(ember, now), "item:0").state;
    now = nextTurn(ember, now);
    assert.equal(optionOf(ember, now, "item:0"), undefined, "no arrows, no bow");
    const refused = applyRulesetCombatChoice(
      ember,
      now,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 4,
    );
    assert.deepEqual(firstOf(refused.events, "refused").reason, "insufficient");
    // Without a single arrow it never was.
    assert.equal(optionOf(ember, fight(ember, [held(bow, "Hunting bow")]), "item:0"), undefined);
    // Only what carries the tag is shot: a bow and a spear are not arrows.
    assert.equal(
      optionOf(
        ember,
        fight(ember, [held(bow, "Hunting bow"), held(itemOf(ember, "outfitter/boar-spear"), "Spear", false)]),
        "item:0",
      ),
      undefined,
    );
  }
  {
    // Two quivers: the first is emptied before the second is touched, and more than one an attack
    // takes from both.
    const twice = parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "hunting-bow").item.attack.ammo.perAttack = 2)),
      "a bow that shoots two",
    );
    const twiceBow = itemOf(twice, "outfitter/hunting-bow");
    const start = fight(twice, [
      held(twiceBow, "Bow"),
      held(arrows, "Quiver", false, 1),
      held(arrows, "Spare", false, 5),
    ]);
    assert.equal(optionOf(twice, start, "item:0")?.ammo, 6);
    const shotTwice = take(twice, start, "item:0");
    assert.deepEqual(ada(shotTwice.state).itemsUsed, { 1: 1, 2: 1 });
    assert.equal(firstOf(shotTwice.events, "shot").left, 4);
    // One arrow left is not enough for an attack that shoots two.
    assert.equal(
      optionOf(twice, fight(twice, [held(twiceBow, "Bow"), held(arrows, "Quiver", false, 1)]), "item:0"),
      undefined,
    );
  }

  // ── After a fight ──
  {
    // Won: half of what was shot comes back, rounded down once for the whole fight.
    const hitsHard = { face: 6, abilities: { wits: 3 } };
    let now = fight(ember, [held(bow, "Hunting bow"), held(arrows, "Arrows", false, 5)], { health: 17, ...hitsHard });
    const events: RulesetCombatEvent[] = [];
    for (let i = 0; i < 5 && ada(now).itemsUsed?.[1] !== 3; i++) {
      if (i > 0) now = nextTurn(ember, now);
      const step = take(ember, now, "item:0", 6);
      events.push(...step.events);
      now = step.state;
      if (step.events.some((event) => event.type === "outcome")) break;
    }
    const outcome = events.find((event) => event.type === "outcome");
    assert.ok(outcome && outcome.type === "outcome" && outcome.outcome === "victory", "the foe goes down");
    const shots = events.filter((event) => event.type === "shot").length;
    assert.ok(shots >= 2, `at least two arrows were shot, ${shots} were`);
    const back = Math.floor(shots * 0.5);
    assert.deepEqual(firstOf(events, "recovered"), { type: "recovered", actorId: "ada", label: "Arrows", count: back });
    assert.deepEqual(ada(now).itemsUsed, { 1: shots - back });
    assert.equal(ada(now).recoverable, undefined, "counted once");
    const names = rulesetCombatNames(ember, { combatants: now.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(events, "recovered"), names, t),
      `game.combat.ruleset.event.recovered|Ada|Arrows|${back}`,
    );
    // A share is rounded down once: six tenths of the one arrow shot is none.
    const most = parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "hunting-bow").item.attack.ammo.recover = 0.6)),
      "a bow whose arrows mostly come back",
    );
    const oneShot = take(
      most,
      fight(most, [held(itemOf(most, "outfitter/hunting-bow"), "Hunting bow"), held(arrows, "Arrows", false, 5)], {
        health: 1,
        face: 6,
        abilities: { wits: 3 },
      }),
      "item:0",
      6,
    );
    assert.equal(firstOf(oneShot.events, "outcome").outcome, "victory");
    assert.equal(
      oneShot.events.some((event) => event.type === "recovered"),
      false,
    );
    assert.deepEqual(ada(oneShot.state).itemsUsed, { 1: 1 });
    // Lost: nothing comes back, even from a bow whose every arrow would.
    const keeper = parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "hunting-bow").item.attack.ammo.recover = 1)),
      "a bow whose arrows all come back",
    );
    const lost = createRulesetEncounter({
      definition: keeper,
      seed: 5,
      roller: () => 6,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: build(keeper),
          items: [held(itemOf(keeper, "outfitter/hunting-bow"), "Hunting bow"), held(arrows, "Arrows", false, 5)],
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 60,
            defense: 1,
            initiativeModifier: -20,
            actions: [
              { id: "maul", name: "Maul", budget: "act", toHit: 20, damage: { count: 10, sides: 10, flat: 100 } },
            ],
          },
        },
      ],
    });
    const shotOnce = take(keeper, lost, "item:0", 6).state;
    assert.deepEqual(ada(shotOnce).recoverable, { 1: 1 });
    let losing = take(keeper, shotOnce, "end-turn", 6).state;
    const lostEvents: RulesetCombatEvent[] = [];
    for (let i = 0; i < 20 && !lostEvents.some((event) => event.type === "outcome"); i++) {
      const actor = losing.order[losing.turn]!;
      const option = actor === "foe" ? "maul" : "end-turn";
      const step = applyRulesetCombatChoice(
        keeper,
        losing,
        { actorId: actor, optionId: option, targetIds: option === "maul" ? ["ada"] : [] },
        () => 6,
      );
      lostEvents.push(...step.events);
      losing = step.state;
    }
    const lostOutcome = lostEvents.find((event) => event.type === "outcome");
    assert.ok(lostOutcome && lostOutcome.type === "outcome" && lostOutcome.outcome === "defeat", "the party is beaten");
    assert.equal(
      lostEvents.some((event) => event.type === "recovered"),
      false,
      "a lost fight picks nothing up",
    );
    assert.deepEqual(ada(losing).itemsUsed, { 1: 1 });
  }

  // ── A clip ──
  {
    // The pistol loaded at the start of the fight: one shot, then empty until reloaded out of the bag.
    const start = fight(gravewatch, [held(pistol, "Watch pistol"), held(shot, "Shot and powder", false, 2)], {
      face: 8,
    });
    assert.deepEqual(optionOf(gravewatch, start, "item:0")?.loaded, { now: 1, max: 1 });
    assert.equal(optionOf(gravewatch, start, "item:0")?.ammo, 2);
    assert.equal(optionOf(gravewatch, start, "reload:0"), undefined, "a full clip is not reloaded");
    const fired = take(gravewatch, start, "item:0", 8);
    assert.deepEqual(firstOf(fired.events, "shot"), {
      type: "shot",
      actorId: "ada",
      optionId: "item:0",
      label: "Watch pistol",
      left: 0,
      of: 1,
    });
    assert.equal(ada(fired.state).itemsUsed, undefined, "what was loaded is what was shot");
    assert.deepEqual(ada(fired.state).loaded, { 0: 0 });
    const names = rulesetCombatNames(gravewatch, { combatants: fired.state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(firstOf(fired.events, "shot"), names, t),
      "game.combat.ruleset.event.shotLoaded|Watch pistol|0|1",
    );
    const empty = nextTurn(gravewatch, fired.state);
    assert.equal(optionOf(gravewatch, empty, "item:0"), undefined, "an empty pistol fires nothing");
    const reload = optionOf(gravewatch, empty, "reload:0");
    assert.deepEqual(
      reload && {
        kind: reload.kind,
        label: reload.label,
        budget: reload.budget,
        targets: reload.targets,
        loaded: reload.loaded,
        ammo: reload.ammo,
      },
      {
        kind: "reload",
        label: "Watch pistol",
        budget: "act",
        targets: { side: "self", count: 0 },
        loaded: { now: 0, max: 1 },
        ammo: 2,
      },
    );
    const reloaded = take(gravewatch, empty, "reload:0");
    assert.deepEqual(firstOf(reloaded.events, "budget"), { type: "budget", actorId: "ada", budget: "act", left: 0 });
    assert.deepEqual(firstOf(reloaded.events, "reload"), {
      type: "reload",
      actorId: "ada",
      optionId: "reload:0",
      label: "Watch pistol",
      loaded: 1,
      of: 1,
      drew: 1,
    });
    assert.deepEqual(ada(reloaded.state).itemsUsed, { 1: 1 });
    assert.equal(
      rulesetCombatEventLine(firstOf(reloaded.events, "reload"), names, t),
      "game.combat.ruleset.event.reloadDrew|Ada|Watch pistol|1|1|1",
    );
    // Reloading spent the act, so it cannot also be fired this turn, and it is loaded next turn.
    assert.equal(optionOf(gravewatch, reloaded.state, "item:0"), undefined);
    assert.deepEqual(optionOf(gravewatch, nextTurn(gravewatch, reloaded.state), "item:0")?.loaded, { now: 1, max: 1 });
    // A strike at somebody walking away is made with a loaded weapon only.
    assert.equal(rulesetOpportunityAttack(ada(start))?.id, "item:0");
    assert.equal(rulesetOpportunityAttack(ada(empty)), null, "an empty pistol strikes nobody in passing");
    // Nothing to load: no reload.
    const dry = fight(gravewatch, [held(pistol, "Watch pistol")]);
    assert.ok(optionOf(gravewatch, dry, "item:0"), "loaded, it fires without any shot in the bag");
    assert.equal(
      optionOf(gravewatch, nextTurn(gravewatch, take(gravewatch, dry, "item:0", 8).state), "reload:0"),
      undefined,
    );
    // What the stack kept is what the fight starts with.
    const keptEmpty = fight(gravewatch, [{ ...held(pistol, "Watch pistol"), loaded: 0 }, held(shot, "Shot", false, 2)]);
    assert.equal(optionOf(gravewatch, keptEmpty, "item:0"), undefined);
    assert.ok(optionOf(gravewatch, keptEmpty, "reload:0"));
    // A clip that draws nothing fills for free, and a bigger one fills to its most.
    const sixGun = parsedOrThrow(
      variant(gravewatchText, (doc) => {
        const attack = itemEntry(doc, "watch-pistol").item.attack;
        delete attack.ammo;
        attack.clip.max = 6;
      }),
      "a six-shot pistol",
    );
    const six = itemOf(sixGun, "kit/watch-pistol");
    const halfEmpty = fight(sixGun, [{ ...held(six, "Six-gun"), loaded: 2 }]);
    assert.deepEqual(optionOf(sixGun, halfEmpty, "item:0")?.loaded, { now: 2, max: 6 });
    assert.equal(optionOf(sixGun, halfEmpty, "item:0")?.ammo, undefined);
    const full = take(sixGun, halfEmpty, "reload:0");
    assert.deepEqual(firstOf(full.events, "reload"), {
      type: "reload",
      actorId: "ada",
      optionId: "reload:0",
      label: "Six-gun",
      loaded: 6,
      of: 6,
    });
    assert.equal(
      rulesetCombatEventLine(
        firstOf(full.events, "reload"),
        rulesetCombatNames(sixGun, { combatants: full.state.combatants } as never, t),
        t,
      ),
      "game.combat.ruleset.event.reload|Ada|Six-gun|6|6",
    );
    // A clip bigger than what is left in the bag takes what there is.
    const sixDrawing = parsedOrThrow(
      variant(gravewatchText, (doc) => (itemEntry(doc, "watch-pistol").item.attack.clip.max = 6)),
      "a six-shot pistol that loads shot",
    );
    const drawing = take(
      sixDrawing,
      fight(sixDrawing, [
        { ...held(itemOf(sixDrawing, "kit/watch-pistol"), "Six-gun"), loaded: 1 },
        held(shot, "Shot", false, 2),
      ]),
      "reload:0",
    );
    assert.equal(firstOf(drawing.events, "reload").loaded, 3);
    assert.equal(firstOf(drawing.events, "reload").drew, 2);
    // A clip read off a stat the item does not give is a weapon that never fires.
    const byStat = parsedOrThrow(
      variant(gravewatchText, (doc) => (itemEntry(doc, "watch-pistol").item.attack.clip.max = { stat: "target" })),
      "a clip read off a stat",
    );
    const statless = { ...itemOf(byStat, "kit/watch-pistol"), stats: { damage: "2d10", harm: "tearing" } };
    const noClip = fight(byStat, [held(statless, "Pistol"), held(shot, "Shot", false, 2)]);
    assert.equal(optionOf(byStat, noClip, "item:0"), undefined);
    assert.equal(optionOf(byStat, noClip, "reload:0"), undefined);
    assert.deepEqual(
      optionOf(byStat, fight(byStat, [held(itemOf(byStat, "kit/watch-pistol"), "Pistol")]), "item:0")?.loaded,
      {
        now: 7,
        max: 7,
      },
    );
  }

  // ── Written to the inventory ──
  {
    const book = rulesetItemBook(ember, entriesOf(ember));
    const stacks: GameInventoryStack[] = [
      { id: "st-bow", name: "Hunting bow", item: "outfitter/hunting-bow", quantity: 1, equipped: true },
      { id: "st-arrows", name: "Arrows", item: "outfitter/arrows", quantity: 2 },
      { id: "st-juno", name: "Arrows", item: "outfitter/arrows", quantity: 4, holder: "Juno" },
    ];
    const items = rulesetSheetItems(book, stacks, undefined);
    assert.deepEqual(
      items.map((each) => each.stack),
      [
        { id: "st-bow", ref: "outfitter/hunting-bow" },
        { id: "st-arrows", ref: "outfitter/arrows" },
      ],
      "only the player's own bag, each with the stack it is",
    );
    assert.deepEqual(rulesetSheetItems(book, stacks, "Juno")[0]!.stack, {
      id: "st-juno",
      ref: "outfitter/arrows",
      holder: "Juno",
    });
    const start = fight(ember, items);
    const once = take(ember, start, "item:0");
    const changes = rulesetFightItemChanges(start, once.state);
    assert.deepEqual(changes, [{ stack: { id: "st-arrows", ref: "outfitter/arrows" }, name: "Arrows", taken: 1 }]);
    assert.deepEqual(rulesetFightItemChanges(once.state, once.state), [], "a step that shot nothing writes nothing");
    const written = applyRulesetFightItemChanges(stacks, changes)!;
    assert.equal(written.stacks.find((stack) => stack.id === "st-arrows")!.quantity, 1);
    assert.deepEqual(written.journal, [{ item: "Arrows", action: "used", quantity: 1 }]);
    // The last one out takes the stack with it, and what a won fight gives back makes it again.
    const twice = take(ember, nextTurn(ember, once.state), "item:0");
    const emptied = applyRulesetFightItemChanges(written.stacks, rulesetFightItemChanges(once.state, twice.state))!;
    assert.equal(
      emptied.stacks.some((stack) => stack.id === "st-arrows"),
      false,
    );
    const back = applyRulesetFightItemChanges(emptied.stacks, [
      { stack: { id: "st-arrows", ref: "outfitter/arrows" }, name: "Arrows", taken: -1 },
    ])!;
    assert.deepEqual(
      back.stacks.find((stack) => stack.id === "st-arrows"),
      {
        id: "st-arrows",
        name: "Arrows",
        item: "outfitter/arrows",
        quantity: 1,
      },
    );
    assert.deepEqual(back.journal, [{ item: "Arrows", action: "acquired", quantity: 1 }]);
    const home = applyRulesetFightItemChanges(emptied.stacks, [
      { stack: { id: "st-juno", ref: "outfitter/arrows", holder: "Juno" }, name: "Arrows", taken: -1 },
    ])!;
    assert.equal(
      home.stacks.find((stack) => stack.id === "st-juno")!.quantity,
      5,
      "into the stack that is still there",
    );
    // The inventory no longer holds what the fight counted on: refused, so the step is too.
    assert.equal(applyRulesetFightItemChanges(emptied.stacks, changes), null, "a shot out of a stack that is gone");
    assert.equal(
      applyRulesetFightItemChanges([{ ...stacks[1]!, item: "outfitter/road-rations" }], changes),
      null,
      "another item under the stack's id",
    );
    assert.equal(
      applyRulesetFightItemChanges([{ ...stacks[1]!, holder: "Juno" }], changes),
      null,
      "the stack given to somebody else",
    );
    assert.equal(
      applyRulesetFightItemChanges([{ ...stacks[1]!, quantity: 0 + 1 }], [{ ...changes[0]!, taken: 2 }]),
      null,
      "more shot than the stack holds",
    );
    // A pistol's loaded count is kept on its stack.
    const kit = rulesetItemBook(gravewatch, entriesOf(gravewatch));
    const gunStacks: GameInventoryStack[] = [
      { id: "st-gun", name: "Watch pistol", item: "kit/watch-pistol", quantity: 1, equipped: true, loaded: 0 },
      { id: "st-shot", name: "Shot and powder", item: "kit/shot-and-powder", quantity: 3 },
    ];
    const gunItems = rulesetSheetItems(kit, gunStacks, undefined);
    assert.equal(gunItems[0]!.loaded, 0);
    const gunFight = fight(gravewatch, gunItems);
    const loadedUp = take(gravewatch, gunFight, "reload:0");
    const gunChanges = rulesetFightItemChanges(gunFight, loadedUp.state);
    assert.deepEqual(gunChanges, [
      { stack: { id: "st-gun", ref: "kit/watch-pistol" }, name: "Watch pistol", taken: 0, loaded: 1 },
      { stack: { id: "st-shot", ref: "kit/shot-and-powder" }, name: "Shot and powder", taken: 1 },
    ]);
    const gunWritten = applyRulesetFightItemChanges(gunStacks, gunChanges)!;
    assert.deepEqual(
      gunWritten.stacks.map((stack) => [stack.id, stack.quantity, stack.loaded]),
      [
        ["st-gun", 1, 1],
        ["st-shot", 2, undefined],
      ],
    );
    assert.deepEqual(gunWritten.journal, [{ item: "Shot and powder", action: "used", quantity: 1 }]);
  }

  // ── An AI-played fighter reloads an empty weapon, and then fires it ──
  {
    const bestiary = Object.fromEntries(
      (gravewatch.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const built = createRulesetFight({
      definition: gravewatch,
      seed: 3,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: build(gravewatch, { nerve: 3 }) } }],
      playerName: null,
      live: null,
      items: () => [{ ...held(pistol, "Watch pistol"), loaded: 0 }, held(shot, "Shot and powder", false, 3)],
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
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("rats", "Grave-rat swarm", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = built.fight;
    syncRulesetCombatants(gravewatch, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(gravewatch, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    const said = () => state.rulesetFight!.events.map((entry) => entry.event);
    let guard = 0;
    while (!state.outcome && !said().some((event) => event.type === "shot") && guard++ < 40) {
      assert.ok(commandRulesetCombatDirector(gravewatch, state, { type: "continue" }).ok);
    }
    const events = said();
    const reloadAt = events.findIndex((event) => event.type === "reload" && event.actorId === "ada");
    const shotAt = events.findIndex((event) => event.type === "shot" && event.actorId === "ada");
    assert.ok(reloadAt >= 0, "it reloaded");
    assert.ok(shotAt > reloadAt, "and fired what it loaded");
  }

  // ── Kept on a stack of one ──
  {
    const [kept, many] = normalizeGameInventoryStacks([
      { id: "a", name: "Watch pistol", item: "kit/watch-pistol", quantity: 1, loaded: 0 },
      { id: "b", name: "Watch pistol", item: "kit/watch-pistol", quantity: 2, loaded: 1 },
    ]);
    assert.equal(kept!.loaded, 0);
    assert.equal(many!.loaded, undefined, "a count is one weapon's");
    for (const bad of [-1, 1.5, "1", null]) {
      assert.equal(
        normalizeGameInventoryStacks([{ id: "c", name: "Gun", quantity: 1, loaded: bad }])[0]!.loaded,
        undefined,
      );
    }
    const poured = mergeGameInventoryStacks(
      [
        { id: "a", name: "Watch pistol", item: "kit/watch-pistol", quantity: 1, loaded: 0 },
        { id: "b", name: "Watch pistol", item: "kit/watch-pistol", quantity: 1, loaded: 1 },
      ],
      "a",
      "b",
    );
    assert.deepEqual(poured, [{ id: "b", name: "Watch pistol", item: "kit/watch-pistol", quantity: 2 }]);
  }

  // ── What an item says ──
  {
    assert.deepEqual(rulesetItemFacts(ember, bow).attack?.ammo, { what: "Arrow", per: 1, recover: 0.5 });
    assert.deepEqual(rulesetItemFacts(gravewatch, pistol).attack, {
      budget: "Act",
      toHit: "Nerve",
      target: 7,
      damage: "2d10",
      type: "tearing",
      ammo: { what: "Shot", per: 1 },
      clip: { max: 1, reload: "Act" },
    });
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(ember, bow)),
      /, range 30 to 60 paces, ammunition Arrow \(1 an attack, 50% picked up after a won fight\), modes Volley/,
    );
    assert.match(
      rulesetItemPromptFacts(rulesetItemFacts(gravewatch, pistol)),
      /; attack \(Act\): Nerve to hit at 7, 2d10 tearing, ammunition Shot \(1 an attack\), holds 1, reload \(Act\)$/,
    );
    // A clip read off a stat says what the stat gives.
    const statClip = {
      ...pistol,
      stats: { ...pistol.stats, target: 5 },
      attack: { ...pistol.attack!, clip: { max: { stat: "target" }, reload: "act" } },
    };
    assert.deepEqual(rulesetItemFacts(gravewatch, statClip as RulesetCatalogItem).attack?.clip, {
      max: 5,
      reload: "Act",
    });
    // A clip read off a stat is a stat the attack reads, so a weapon invented like it copies it.
    const soakClip = { ...pistol.attack!, clip: { max: { stat: "soak_blunt" }, reload: "act" } };
    assert.equal(rulesetItemAttackStats(pistol.attack!).includes("soak_blunt"), false);
    assert.ok(rulesetItemAttackStats(soakClip as never).includes("soak_blunt"), "a clip off a stat reads it");
    // A bow the Game Master invents with nothing to start from fights as the hunting bow, arrows and
    // all, and one made like the pistol keeps its clip.
    const gm = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });
    const longbow = gm.invent!({ name: "Longbow", category: "weapon", rarity: "common", slots: { hands: "2" } }, []);
    assert.ok("item" in longbow, "the longbow is made");
    assert.deepEqual(gm.itemOf(longbow.item)!.entry.item!.attack?.ammo, { tag: "arrow", recover: 0.5 });
    assert.deepEqual(longbow.notes, ["It fights as Hunting bow does."]);
    const kitGm = rulesetItemBook(gravewatch, entriesOf(gravewatch), { actor: "game-master" });
    const dragon = kitGm.invent!(
      { name: "Dragoon pistol", category: "arm", rarity: "rare", slots: { hands: "1" }, like: "Watch pistol" },
      [],
    );
    assert.ok("item" in dragon, "the dragoon pistol is made");
    assert.deepEqual(kitGm.itemOf(dragon.item)!.entry.item!.attack?.clip, { max: 1, reload: "act" });
    // More than one an attack is said as it is.
    const twice = parsedOrThrow(
      variant(emberText, (doc) => (itemEntry(doc, "hunting-bow").item.attack.ammo.perAttack = 2)),
      "a bow that shoots two",
    );
    assert.deepEqual(rulesetItemFacts(twice, itemOf(twice, "outfitter/hunting-bow")).attack?.ammo, {
      what: "Arrow",
      per: 2,
      recover: 0.5,
    });
  }

  console.log(
    "Ruleset ammunition: import checks, the 1.57 gate, shooting from the bag, recovery after a won fight, a clip and its reload, the inventory write-back and item facts passed.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
