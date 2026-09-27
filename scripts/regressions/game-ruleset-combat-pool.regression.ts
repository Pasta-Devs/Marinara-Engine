/**
 * Ruleset combat: the `dice-pool` kind (#6736), a fight thrown in the ruleset's own pools.
 *
 * What is pinned here, on Gravewatch, the Engine's own pool example, with scripted dice:
 *   - The principle: every number a roll ADDS is dice, and every number it MEETS is successes. A
 *     to-hit number is the pool (an Arm's rating and trade, with the trade's own rating and the row's
 *     ability swapped in), a defense is the successes a blow needs and never fewer than one, and each
 *     success past those adds a damage die.
 *   - The ruleset's own faces: a ten explodes, a one cancels, and a throw with no success and a one on
 *     it botches, which misses whatever it counted.
 *   - Damage dice counted against the damage target with nothing else to them, automatic successes,
 *     and soak by kind of harm, thrown or taken off the dice, never below zero and never thrown for a
 *     blow that counted nothing.
 *   - The wound penalty and a condition's modifier, as dice off the pool; a roll that leans thrown twice
 *     with the better kept; saves and contests as pools; a held hit checked again against successes.
 *   - Initiative thrown again every round, with the modifier as it stands then.
 *   - What one combatant may spend of a pool per turn.
 *   - The forecast, exact on a pool small enough to count by hand.
 *   - A bestiary creature's soak surviving the copy into a stat block.
 *   - Every import refusal, the 1.47 install gate and the log lines.
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
  parseRulesetDefinition,
  planRulesetCombatCost,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetContestChance,
  rulesetProposedStatBlock,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-pool-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [{ getCapabilityPackageInstallIssue }, { rulesetCombatEventLine, rulesetCombatNames }] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;

  const edited = (text: string, edit: (doc: Record<string, any>) => void) => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refuses = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(edited(text, edit));
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };
  /** Gravewatch as shipped, or edited first. Most cases leave initiative to the whole fight, so the
   *  dice a script hands out are only the ones the case is about. */
  const gravewatch = (edit: (doc: Record<string, any>) => void = () => {}) =>
    parsedOrThrow(edited(gravewatchText, edit), "Gravewatch");
  const shipped = gravewatch();
  const once = gravewatch((doc) => delete doc.combat.initiative.each);

  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T> => {
    const found = eventsOf(events, type)[0];
    assert.ok(found, `no ${type} event in ${JSON.stringify(events.map((event) => event.type))}`);
    return found;
  };

  const catalogsOf = (definition: RulesetDefinition) =>
    Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
  /** Ada, a warden: Sinew 3, Nerve 2, Warmth 2; Dig 1, Wrestle 2, Ward 2. Her Spade throws Sinew and
   *  Dig (four dice), her Hook throws Dig with Nerve (three), and she knows both fight charms. */
  const ada = (
    definition: RulesetDefinition,
    live: Record<string, unknown> = {},
    charms = ["lantern-flare", "stern-word"],
  ) => {
    const catalogs = catalogsOf(definition);
    const charmRows = charms.flatMap((id) =>
      rowsFromCatalogEntry(
        "charms",
        (catalogs.charms ?? []).find((entry) => entry.id === id)!,
      ).map((row) => row.row),
    );
    return {
      id: "ada",
      name: "Ada",
      side: "party",
      build: rulesetSheetBuildSchema.parse({
        abilities: { sinew: 3, nerve: 2, warmth: 2 },
        skills: { dig: "rating_1", wrestle: "rating_2", ward: "rating_2" },
        lists: {
          arms: [
            { name: "Spade", rating: "sinew", trade: "dig", dice: "2d10", harm: "tearing" },
            { name: "Hook", rating: "nerve", trade: "dig", dice: "1d10+1", harm: "tearing" },
          ],
          charms: charmRows,
        },
      }),
      live,
      catalogs,
    } as RulesetCombatantInput;
  };
  const creature = (id: string, entryId: string): RulesetCombatantInput => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    side: "enemy",
    creature: { catalogId: "night", entryId },
  });
  /** Ada first: a 10 on her initiative die and a 1 on everybody else's. */
  const fight = (definition: RulesetDefinition, combatants: RulesetCombatantInput[]): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 3,
      combatants,
      bestiary: catalogsOf(definition),
      roller: dice(...combatants.map((one) => (one.side === "party" ? 10 : 1))),
    });
  const act = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: RulesetCombatChoice,
    ...faces: number[]
  ) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
  const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, ...faces: number[]) =>
    act(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, ...faces).state;
  const optionId = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((entry) => entry.label === label);
    assert.ok(option, `${actorId} has no "${label}"`);
    return option.id;
  };
  const swing = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    targetId: string,
    ...faces: number[]
  ) =>
    act(
      definition,
      state,
      { actorId, optionId: optionId(definition, state, actorId, label), targetIds: [targetId] },
      ...faces,
    );
  const health = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;

  // ── The example imports, with every rule this kind reads ──
  {
    const combat = shipped.combat!;
    assert.equal(combat.kind, "dice-pool");
    assert.equal(combat.attackRoll, undefined);
    assert.deepEqual(combat.pool?.soak, { roll: true, byKind: { knock: { abilityMod: "sinew" } } });
    assert.equal(combat.initiative.each, "round");
    assert.deepEqual(combat.spendLimits, [{ pool: "resolve", max: { const: 1 }, per: "turn" }]);
    assert.equal(shipped.coverage.combat, true);
    // The summed example is what it was: attack dice, no pool block, once a fight.
    const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
    assert.equal(ember.combat!.kind, "attack-vs-defense");
    assert.ok(ember.combat!.attackRoll);
    assert.equal(ember.combat!.pool, undefined);
    assert.equal(ember.combat!.initiative.each, undefined);
  }

  // ── Refused at import ──
  {
    refuses(
      emberText,
      (doc) => (doc.combat.kind = "dice-pool"),
      /A "dice-pool" fight throws the ruleset's own pools, so resolution.kind is "dice-pool" too/,
      "a pool fight on a summed ruleset",
    );
    refuses(
      emberText,
      (doc) => (doc.combat.kind = "dice-pool"),
      /so it rolls no attack dice/,
      "attack dice beside pools",
    );
    refuses(emberText, (doc) => (doc.combat.kind = "dice-pool"), /says how it rolls damage in "pool"/, "no pool block");
    refuses(
      emberText,
      (doc) => (doc.combat.pool = { soak: { roll: true, all: { const: 1 } } }),
      /"pool" is for a "dice-pool" fight/,
      "a pool block on attack-vs-defense",
    );
    refuses(
      fiveEText,
      (doc) => delete doc.combat.attackRoll,
      /An "attack-vs-defense" fight says what an attack rolls/,
      "no attack dice",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.attackRoll = { dice: { count: 1, sides: 10 } }),
      /rolls no attack dice/,
      "attack dice on a pool fight",
    );
    refuses(
      gravewatchText,
      (doc) => delete doc.combat.pool,
      /says how it rolls damage in "pool"/,
      "a pool fight with no pool block",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.pool.damageTarget = 11),
      /A 10-sided die never reaches 11/,
      "a damage target past the die",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.pool.soak.byKind = { scorch: { const: 1 } }),
      /"scorch" is not a kind of the health track/,
      "soak by a kind the track does not have",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.pool.soak = { roll: true }),
      /Soak soaks something/,
      "soak of nothing",
    );
    refuses(
      gravewatchText,
      (doc) => {
        doc.combat.health = { pool: "resolve" };
        delete doc.combat.damageKinds;
      },
      /Soak by kind needs health to be a wound track with kinds/,
      "soak by kind on pool health",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.pool.soak.byKind.knock = { abilityMod: "grit" }),
      /Unknown ability "grit"/,
      "a soak read off an ability the sheet does not have",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.spendLimits[0].pool = "grit"),
      /Unknown live pool "grit"/,
      "a limit on no pool",
    );
    refuses(
      gravewatchText,
      (doc) => doc.combat.spendLimits.push({ pool: "resolve", max: { const: 2 }, per: "round" }),
      /"resolve" is limited twice/,
      "one pool limited twice",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.conditions[0].modifiers = [{ to: "attacks", dice: "1d4" }]),
      /A "dice-pool" fight adds dice to a pool, so a modifier gives a flat number of dice/,
      "a rolled modifier in a pool fight",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.levels = [{ track: "harm", at: 1, modifiers: [{ to: "saves", dice: "1d6" }] }]),
      /a modifier gives a flat number of dice/,
      "a rolled modifier on a level",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.catalogs[1].entries[0].creature.actions[0].damage.dice = "1d6"),
      /A "dice-pool" fight throws d10s, so damage dice are d10s/,
      "a creature's damage on another die",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.catalogs[0].entries[2].mechanics.amount.dice = "2d6"),
      /throws d10s, so damage dice are d10s/,
      "an entry's damage on another die",
    );
    refuses(
      gravewatchText,
      (doc) =>
        (doc.catalogs[1].entries[0].creature.riders = [
          { id: "pack", name: "Pack", on: "hit", oncePer: "turn", amount: { dice: "1d6" } },
        ]),
      /riders\.0\.amount\.dice: A "dice-pool" fight throws d10s/,
      "a creature's rider on another die",
    );
    refuses(
      gravewatchText,
      (doc) =>
        doc.catalogs[0].entries.push({
          id: "sly",
          label: "Sly",
          rows: [{ list: "charms", values: { name: "Sly" } }],
          mechanics: { kind: "rider", rider: { on: "hit", oncePer: "turn", amount: { dice: "1d6" } } },
        }),
      /mechanics\.rider\.amount\.dice: A "dice-pool" fight throws d10s/,
      "an entry's rider on another die",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.catalogs[1].entries[0].creature.soak = { byKind: { scorch: 1 } }),
      /"scorch" is not a kind of the health track/,
      "a creature soaking a kind the track does not have",
    );
    refuses(
      fiveEText,
      (doc) => {
        const bestiary = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        bestiary.entries.find((entry: { creature?: { sheet?: unknown } }) => !entry.creature?.sheet).creature.soak = {
          all: 1,
        };
      },
      /Soak is for a "dice-pool" fight/,
      "soak outside a pool fight",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.attacks[0].toHit.skill = { column: "dice" }),
      /Must name a enum column/,
      "a skill read off a column that holds no skill",
    );
    refuses(
      gravewatchText,
      (doc) => delete doc.combat.pool.soak,
      /says nothing about soak, so there is no way to take it/,
      "a creature's soak with no rule for how soak is taken",
    );
    // Healing is an amount, not a roll against anything, so it keeps whatever dice it names.
    gravewatch((doc) =>
      doc.catalogs[0].entries.push({
        id: "salve",
        label: "Salve",
        rows: [{ list: "charms", values: { name: "Salve" } }],
        mechanics: { kind: "heal", targets: "ally", amount: { dice: "1d6" } },
      }),
    );
  }

  // ── An attack: the pool, the successes it needs, and what the rest are worth ──
  {
    const state = fight(once, [ada(once), creature("rats", "grave-rats")]);
    const adaNow = rulesetCombatant(state, "ada")!;
    const toHit = (label: string) => adaNow.actions.find((action) => action.label === label)!.toHit;
    assert.equal(toHit("Spade"), 4, "Sinew 3 and Dig 1");
    assert.equal(toHit("Hook"), 3, "Dig 1 with Nerve 2 in place of Sinew");
    assert.equal(toHit("Lantern Flare"), 4, "Ward, as the abilities say");
    const hook = adaNow.actions.find((action) => action.label === "Hook")!;
    assert.deepEqual(hook.damage, { count: 1, sides: 10, flat: 1, type: "tearing" }, "one die and one automatic");

    // 8 and 7 reach the target of 7: two successes, one needed, one past it for another damage die.
    const hit = swing(once, state, "ada", "Spade", "rats", 8, 7, 3, 2, 6, 6, 2);
    const attack = firstOf(hit.events, "attack");
    assert.equal(attack.total, 2);
    assert.equal(attack.defense, 1);
    assert.equal(attack.outcome, "hit");
    assert.deepEqual(attack.pool, { dice: 4, target: 7 });
    const damage = firstOf(hit.events, "damage");
    assert.deepEqual(damage.rolls, [6, 6, 2], "two dice of its own and one the hit earned, against six");
    assert.equal(damage.amount, 2);
    assert.equal(damage.dealt, 2);
    assert.deepEqual(damage.pool, { target: 6, successes: 2 }, "the rats soak no tears");
    assert.equal(health(once, hit.state, "rats"), 1);

    // A one cancels a success; no success at all and a one on the table is a botch.
    const cancelled = swing(once, state, "ada", "Spade", "rats", 1, 7, 3, 2);
    assert.equal(firstOf(cancelled.events, "attack").outcome, "miss");
    assert.equal(firstOf(cancelled.events, "attack").pool?.botch, undefined, "a success was rolled, then cancelled");
    assert.equal(eventsOf(cancelled.events, "damage").length, 0);
    const botched = swing(once, state, "ada", "Spade", "rats", 1, 3, 2, 4);
    assert.equal(firstOf(botched.events, "attack").outcome, "miss");
    assert.equal(firstOf(botched.events, "attack").pool?.botch, true);

    // A ten explodes into another die, which counts like any other; the pool is still four dice.
    const exploded = swing(once, state, "ada", "Spade", "rats", 10, 3, 2, 4, 7, 2, 2, 2);
    assert.equal(firstOf(exploded.events, "attack").total, 2);
    assert.equal(firstOf(exploded.events, "attack").pool?.dice, 4);
    assert.equal(firstOf(exploded.events, "damage").dealt, 0, "three damage dice, none reaching six");

    // Automatic successes are never thrown.
    const hooked = swing(once, state, "ada", "Hook", "rats", 7, 2, 3, 2);
    assert.deepEqual(firstOf(hooked.events, "damage").rolls, [2]);
    assert.equal(firstOf(hooked.events, "damage").dealt, 1, "the Hook's one automatic success");
  }

  // ── Defense, and soak thrown by kind ──
  {
    const state = fight(once, [ada(once), creature("hollow", "hollow-warden")]);
    const hollow = rulesetCombatant(state, "hollow")!;
    assert.deepEqual(hollow.soak, { all: 1, byKind: { knock: 3 } }, "read out of the bestiary, not dropped on the way");
    // Two successes meet its two exactly: a hit, with nothing past it.
    const hit = swing(once, state, "ada", "Spade", "hollow", 7, 8, 2, 3, 6, 6, 6);
    assert.equal(firstOf(hit.events, "attack").defense, 2);
    const damage = firstOf(hit.events, "damage");
    assert.deepEqual(damage.rolls, [6, 6]);
    assert.deepEqual(damage.pool, { target: 6, successes: 2, soak: { value: 1, rolls: [6], taken: 1 } });
    assert.equal(damage.dealt, 1, "a tear, soaked by its one for any harm");
    const short = swing(once, state, "ada", "Spade", "hollow", 7, 2, 3, 4);
    assert.equal(firstOf(short.events, "attack").outcome, "miss", "one success is not two");
    // Nothing counted, nothing to soak: no soak die is thrown for it.
    const nothing = swing(once, state, "ada", "Spade", "hollow", 7, 8, 2, 3, 2, 2);
    assert.equal(firstOf(nothing.events, "damage").pool?.soak, undefined);

    // Its grip on Ada: three successes, two past the one needed; four damage dice all land, and she
    // soaks the knock with her Sinew of three, two of which come up.
    const hollowsTurn = endTurn(once, state, "ada");
    const gripped = swing(once, hollowsTurn, "hollow", "Cold grip", "ada", 7, 7, 7, 2, 3, 4, 6, 6, 6, 6, 6, 6, 2);
    const grip = firstOf(gripped.events, "damage");
    assert.deepEqual(grip.pool, { target: 6, successes: 4, soak: { value: 3, rolls: [6, 6, 2], taken: 2 } });
    assert.equal(grip.dealt, 2);
    assert.equal(health(once, gripped.state, "ada"), 2, "two knocks on her Harm");
    assert.ok(eventsOf(gripped.events, "condition").some((event) => event.condition === "rattled" && event.active));

    // The wound penalty and the rattle, as dice off her next pool: four less one, less one.
    const adasTurn = endTurn(once, gripped.state, "hollow");
    const weaker = swing(once, adasTurn, "ada", "Spade", "hollow", 7, 7, 2, 2);
    const attack = firstOf(weaker.events, "attack");
    assert.deepEqual(attack.pool, { dice: 2, target: 7, penalty: -1 });
    assert.deepEqual(attack.bonuses, [{ condition: "rattled", value: -1 }]);
    assert.equal(attack.modifier, 4, "what the pool started from");

    // Soak taken off the dice rather than thrown: three off the grip's four, and one die thrown.
    const offTheDice = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      doc.combat.pool.soak.roll = false;
    });
    const again = endTurn(offTheDice, fight(offTheDice, [ada(offTheDice), creature("hollow", "hollow-warden")]), "ada");
    const taken = swing(offTheDice, again, "hollow", "Cold grip", "ada", 7, 7, 7, 2, 3, 4, 6);
    const off = firstOf(taken.events, "damage");
    assert.deepEqual(off.rolls, [6]);
    assert.deepEqual(off.pool, { target: 6, successes: 1, soak: { value: 3, taken: 3 } });
    assert.equal(off.dealt, 1);
  }

  // ── A roll that leans is thrown twice, and the better kept ──
  {
    const state = endTurn(
      once,
      fight(once, [ada(once, { conditions: ["marked"] }), creature("hollow", "hollow-warden")]),
      "ada",
    );
    const marked = swing(
      once,
      state,
      "hollow",
      "Cold grip",
      "ada",
      // No success on the first throw; a ten and a seven on the second, and the ten throws one more.
      ...[2, 3, 4, 5, 6, 2],
      ...[10, 7, 2, 3, 4, 5, 2],
      ...[2, 2, 2],
    );
    const attack = firstOf(marked.events, "attack");
    assert.equal(attack.mode, "advantage");
    assert.equal(attack.rolls.length, 13);
    assert.equal(attack.total, 2, "the second throw's two, not the first throw's none");
    assert.equal(attack.pool?.dice, 6, "the pool is six dice, whatever exploded out of it");
    // A ruleset that never leans throws once whatever its conditions say.
    const flat = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      doc.combat.pool.advantage = false;
    });
    const straight = endTurn(
      flat,
      fight(flat, [ada(flat, { conditions: ["marked"] }), creature("hollow", "hollow-warden")]),
      "ada",
    );
    const once_ = swing(flat, straight, "hollow", "Cold grip", "ada", 2, 3, 4, 5, 6, 2);
    assert.equal(firstOf(once_.events, "attack").mode, "normal");
  }

  // ── Saves are pools too, and a pool may only be spent so fast ──
  {
    const state = fight(once, [ada(once), creature("hollow", "hollow-warden")]);
    // Stern Word asks for Steel against two successes. Its three dice find two: it holds.
    const held = swing(once, state, "ada", "Stern Word", "hollow", 7, 8, 2);
    const save = firstOf(held.events, "save");
    assert.equal(save.difficulty, 2);
    assert.equal(save.total, 2);
    assert.equal(save.success, true);
    assert.deepEqual(save.pool, { dice: 3, target: 7 });
    assert.equal(eventsOf(held.events, "condition").length, 0);
    const broke = swing(once, state, "ada", "Stern Word", "hollow", 7, 2, 3);
    assert.equal(firstOf(broke.events, "save").success, false);
    assert.ok(eventsOf(broke.events, "condition").some((event) => event.condition === "rattled" && event.active));

    // One point of Resolve a turn: after the Flare, the Word is not on offer, though Resolve is left.
    const flared = swing(once, state, "ada", "Lantern Flare", "hollow", 8, 7, 3, 4, 2, 2);
    assert.equal(firstOf(flared.events, "spend").pool, "resolve");
    assert.ok(!rulesetCombatOptions(once, flared.state, "ada").some((option) => option.label === "Stern Word"));
    const adaNow = rulesetCombatant(flared.state, "ada")!;
    assert.deepEqual(adaNow.limits, { resolve: { max: 1, per: "turn", spent: 1 } });
    const word = adaNow.actions.find((action) => action.label === "Stern Word")!;
    assert.equal(planRulesetCombatCost(once, adaNow, word), null, "priced as not affordable");
    // Her next turn it is.
    const next = endTurn(once, endTurn(once, flared.state, "ada"), "hollow");
    assert.ok(rulesetCombatOptions(once, next, "ada").some((option) => option.label === "Stern Word"));
    assert.equal(rulesetCombatant(next, "ada")!.limits!.resolve!.spent, 0);
  }

  // ── Contests are thrown as pools ──
  {
    const contesting = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      doc.combat.checks = [{ id: "might", label: "Might", value: { abilityMod: "sinew" } }];
      doc.combat.contests = [
        {
          id: "shove",
          label: "Shove",
          budget: "act",
          attacker: { checks: ["might"] },
          defender: { checks: ["might"] },
          onWin: { applies: [{ condition: "rattled", rounds: 1 }] },
        },
      ];
      doc.catalogs[1].entries[0].creature.checks = { might: 2 };
    });
    const state = fight(contesting, [ada(contesting), creature("rats", "grave-rats")]);
    const shove = rulesetCombatant(state, "ada")!.actions.find((action) => action.contest)!.contest!;
    const chance = (actorId: string, targetId: string) =>
      rulesetContestChance(
        contesting,
        contesting.combat!,
        rulesetCombatant(state, actorId)!,
        rulesetCombatant(state, targetId)!,
        shove,
        state,
      )!;
    // A tie goes to the defender, so three dice against two is not better than even, but it is better
    // than two against three.
    assert.ok(
      chance("ada", "rats") > chance("rats", "ada"),
      `${chance("ada", "rats")} against ${chance("rats", "ada")}`,
    );
    const shoved = swing(contesting, state, "ada", "Shove", "rats", 7, 8, 2, 7, 3);
    const contest = firstOf(shoved.events, "contest");
    assert.equal(contest.attacker.total, 2);
    assert.deepEqual(contest.attacker.pool, { dice: 3, target: 7 });
    assert.equal(contest.defender.total, 1);
    assert.equal(contest.winner, "actor");
  }

  // ── A held hit is checked again in successes ──
  {
    const braced = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      doc.sheet.live.conditions.push({ id: "braced", label: "Braced" });
      doc.combat.conditions.push({ condition: "braced", modifiers: [{ to: "defense", flat: 2 }] });
      doc.catalogs[0].entries.push({
        id: "brace",
        label: "Brace",
        rows: [{ list: "charms", values: { name: "Brace" } }],
        mechanics: {
          kind: "buff",
          targets: "self",
          budget: "quick",
          reaction: { on: "hit" },
          applies: [{ condition: "braced", duration: { rounds: 1 }, endsAfter: "attacked" }],
          cost: [{ pool: "resolve", amount: 1 }],
        },
      });
    });
    const state = endTurn(braced, fight(braced, [ada(braced, {}, ["brace"]), creature("rats", "grave-rats")]), "ada");
    // Two successes on the gnaw: a hit, held before any damage.
    const gnaw = swing(braced, state, "rats", "Gnaw", "ada", 7, 7, 2, 3, 4);
    assert.equal(gnaw.state.window?.trigger.kind, "hit");
    const brace = rulesetWindowOptions(braced, gnaw.state, "ada").find((option) => option.label === "Brace")!;
    const answered = act(braced, gnaw.state, {
      actorId: "ada",
      optionId: brace.id,
      targetIds: [],
      window: gnaw.state.window!.id,
    });
    const recheck = firstOf(answered.events, "recheck");
    assert.equal(recheck.total, 2);
    assert.equal(recheck.defense, 3, "one needed, and two more for bracing");
    assert.equal(recheck.outcome, "miss");
    assert.equal(eventsOf(answered.events, "damage").length, 0);
    // Paid for out of turn, and counted against what she may spend before her own turn comes round.
    assert.equal(rulesetCombatant(answered.state, "ada")!.limits!.resolve!.spent, 1);
  }

  // ── A window between two turns names nobody before a round that throws initiative again ──
  {
    const signing = (each: boolean) =>
      gravewatch((doc) => {
        if (!each) delete doc.combat.initiative.each;
        const rats = doc.catalogs[1].entries[0].creature;
        rats.signaturePoints = 1;
        rats.actions.push({
          id: "skitter",
          name: "Skitter",
          budget: "act",
          signature: { cost: 1 },
          toHit: 5,
          damage: { dice: "1d10" },
        });
      });
    for (const [each, expected] of [
      [true, ""],
      [false, "ada"],
    ] as const) {
      const definition = signing(each);
      // Ada, then the rats, then the warden: the round ends on the warden's turn, and the rats may act
      // between it and whoever is next.
      let state = fight(definition, [
        ada(definition),
        creature("rats", "grave-rats"),
        creature("hollow", "hollow-warden"),
      ]);
      assert.deepEqual(state.order, ["ada", "rats", "hollow"]);
      state = act(definition, state, { actorId: "ada", optionId: "end-turn", targetIds: [] }).state;
      if (state.window)
        state = act(definition, state, {
          actorId: "rats",
          optionId: RULESET_PASS_OPTION,
          targetIds: [],
          window: state.window.id,
        }).state;
      state = act(definition, state, { actorId: "rats", optionId: "end-turn", targetIds: [] }).state;
      const lastTurn = act(definition, state, { actorId: "hollow", optionId: "end-turn", targetIds: [] });
      assert.deepEqual(
        lastTurn.state.window?.trigger,
        { kind: "between-turns", nextActorId: expected },
        `each round: ${each}`,
      );
    }
  }

  // ── A defense of nothing still needs one success ──
  {
    const open = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      doc.combat.defense = { const: 0 };
    });
    const state = endTurn(open, fight(open, [ada(open), creature("rats", "grave-rats")]), "ada");
    const gnaw = swing(open, state, "rats", "Gnaw", "ada", 2, 3, 4, 5, 6);
    assert.equal(firstOf(gnaw.events, "attack").defense, 1);
    assert.equal(firstOf(gnaw.events, "attack").outcome, "miss");
  }

  // ── Initiative thrown again every round ──
  {
    const state = fight(shipped, [ada(shipped), creature("rats", "grave-rats")]);
    assert.deepEqual(state.order, ["ada", "rats"]);
    const rethrown = act(
      shipped,
      endTurn(shipped, state, "ada"),
      { actorId: "rats", optionId: "end-turn", targetIds: [] },
      1,
      10,
    );
    const initiative = firstOf(rethrown.events, "initiative");
    assert.deepEqual(
      initiative.entries.map((entry) => [entry.actorId, entry.total]),
      [
        ["rats", 13],
        ["ada", 3],
      ],
    );
    assert.deepEqual(rethrown.state.order, ["rats", "ada"]);
    assert.equal(firstOf(rethrown.events, "turn").actorId, "rats", "the new round starts at the new first");
    assert.deepEqual(
      rethrown.events.map((event) => event.type).filter((type) => ["round", "initiative", "turn"].includes(type)),
      ["round", "initiative", "turn"],
    );

    // With a modifier that reads her Harm, a wound counts the next time it is thrown.
    const hurt = gravewatch((doc) => (doc.combat.initiative.modifier = { derived: "harm_left" }));
    const start = fight(hurt, [ada(hurt), creature("hollow", "hollow-warden")]);
    assert.equal(rulesetCombatant(start, "ada")!.initiativeModifier, 4);
    const gripped = swing(
      hurt,
      endTurn(hurt, start, "ada"),
      "hollow",
      "Cold grip",
      "ada",
      7,
      7,
      7,
      2,
      3,
      4,
      6,
      6,
      6,
      6,
      6,
      6,
      2,
    );
    const nextRound = act(hurt, gripped.state, { actorId: "hollow", optionId: "end-turn", targetIds: [] }, 5, 5);
    assert.equal(rulesetCombatant(nextRound.state, "ada")!.initiativeModifier, 2, "four left on Harm, less two knocks");
    // A fight that throws once never throws again.
    const onlyOnce = act(once, endTurn(once, fight(once, [ada(once), creature("rats", "grave-rats")]), "ada"), {
      actorId: "rats",
      optionId: "end-turn",
      targetIds: [],
    });
    assert.equal(eventsOf(onlyOnce.events, "initiative").length, 0);
  }

  // ── The forecast ──
  {
    // Counted by hand on a ruleset whose tens do not explode: four ten-sided dice, a success on 7 or
    // more, a one cancelling one, and at least one net success needed.
    const plain = gravewatch((doc) => {
      delete doc.combat.initiative.each;
      delete doc.resolution.explode;
      doc.catalogs[0].entries = doc.catalogs[0].entries.filter((entry: { id: string }) => entry.id !== "grave-sight");
    });
    let reached = 0;
    for (let face = 0; face < 10 ** 4; face++) {
      const faces = [0, 1, 2, 3].map((index) => (Math.floor(face / 10 ** index) % 10) + 1);
      const net = faces.filter((one) => one >= 7).length - faces.filter((one) => one === 1).length;
      if (net >= 1) reached += 1;
    }
    const exact = Math.round((reached / 10 ** 4) * 1000) / 1000;
    const plainState = fight(plain, [ada(plain), creature("rats", "grave-rats")]);
    const spade = rulesetCombatOptions(plain, plainState, "ada").find((option) => option.label === "Spade")!;
    assert.equal(spade.forecast?.hitChance, exact);
    assert.equal(spade.forecast?.averageDamage, 1, "two dice at six, and the rats soak no tears");
    // Exploding tens only ever help.
    const explodingState = fight(once, [ada(once), creature("rats", "grave-rats")]);
    const exploding = rulesetCombatOptions(once, explodingState, "ada").find((option) => option.label === "Spade")!;
    assert.ok(exploding.forecast!.hitChance! > exact);
    // Against the warden's one for any harm, thrown: half a success less.
    const hollowState = fight(plain, [ada(plain), creature("hollow", "hollow-warden")]);
    const againstHollow = rulesetCombatOptions(plain, hollowState, "ada").find((option) => option.label === "Spade")!;
    assert.equal(againstHollow.forecast?.averageDamage, 0.5);
  }

  // ── The log ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) => {
      const count = params.count;
      const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
      const text = english[key] ?? english[plural] ?? key;
      return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""));
    }) as never;
    const state = fight(once, [ada(once), creature("hollow", "hollow-warden")]);
    const view = { combatants: state.combatants.map((one) => ({ id: one.id, name: one.name })) } as never;
    const names = rulesetCombatNames(once, view, t);
    const hit = swing(once, state, "ada", "Spade", "hollow", 7, 8, 2, 3, 6, 6, 6);
    assert.equal(
      rulesetCombatEventLine(firstOf(hit.events, "attack"), names, t),
      "Ada attacks Hollow with Spade: 2 successes from 4 dice at 7 or more (7, 8, 2, 3), needing 2 successes, a hit.",
    );
    assert.equal(
      rulesetCombatEventLine(firstOf(hit.events, "damage"), names, t),
      "The damage: 2 successes from 2 dice at 6 or more (6, 6). Hollow soaks 1: 1 success from 1 die at 6 or more (6). Hollow takes 1 tearing damage, and is on 5 of 6.",
    );
    const hooked = swing(once, state, "ada", "Hook", "hollow", 7, 8, 2, 2, 6);
    assert.equal(
      rulesetCombatEventLine(firstOf(hooked.events, "damage"), names, t),
      "The damage: 0 successes from 1 die at 6 or more (2), and 1 automatic success. Hollow soaks 1: 1 success from 1 die at 6 or more (6). Hollow takes 0 tearing damage, and is on 6 of 6.",
    );
    const saved = swing(once, state, "ada", "Stern Word", "hollow", 7, 8, 2);
    assert.equal(
      rulesetCombatEventLine(firstOf(saved.events, "save"), names, t),
      "Hollow rolls Steel: 2 successes from 3 dice at 7 or more (7, 8, 2), needing 2 successes, a success.",
    );
    const gripped = swing(
      once,
      endTurn(once, state, "ada"),
      "hollow",
      "Cold grip",
      "ada",
      7,
      7,
      7,
      2,
      3,
      4,
      6,
      6,
      6,
      6,
      6,
      6,
      2,
    );
    const weaker = swing(once, endTurn(once, gripped.state, "hollow"), "ada", "Spade", "hollow", 7, 7, 2, 2);
    assert.equal(
      rulesetCombatEventLine(firstOf(weaker.events, "attack"), names, t),
      "Ada attacks Hollow with Spade: 2 successes from 2 dice (4 - 1 (Rattled) - 1 (wounds)) at 7 or more (7, 7), needing 2 successes, a hit.",
    );
  }

  // ── An opponent made up for one fight soaks nothing ──
  {
    const proposed = rulesetProposedStatBlock(shipped, {
      tier: "nuisance",
      health: 3,
      defense: 1,
      initiativeModifier: 1,
      soak: { all: 9 },
      actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 4, damage: { dice: "1d10" } }],
    } as never)!;
    assert.deepEqual(proposed.soak, { all: 9 }, "read the way a bestiary creature is");
    const clamped = clampRulesetStatBlock(shipped, proposed, "nuisance");
    assert.equal(clamped.block.soak, undefined);
    assert.ok(clamped.adjusted.some((line) => /soaks nothing/.test(line)));
  }

  // ── Every new key needs 1.47 to install ──
  {
    assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 47 });
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json", "catalogs/extra.json"] } },
      }) as never;
    const issue =
      /throw dice pools, soak, throw initiative every round or limit spending per turn requires schemaVersion 2 and capabilityApi 1\.47 or newer/;
    const cases: Array<[string, unknown, Map<string, unknown>?]> = [
      ["a pool fight", { combat: { kind: "dice-pool" } }],
      ["a pool block", { combat: { pool: {} } }],
      ["spending limits", { combat: { spendLimits: [] } }],
      ["initiative every round", { combat: { initiative: { each: "round" } } }],
      ["an attack row's skill", { combat: { attacks: [{ toHit: { skill: { column: "trade" } } }] } }],
      ["a creature that soaks", { catalogs: [{ id: "c", entries: [{ id: "a", creature: { soak: { all: 1 } } }] }] }],
      [
        "a creature that soaks, in a catalog file",
        { catalogs: [{ id: "c", asset: "catalogs/extra.json" }] },
        new Map<string, unknown>([
          [
            "catalogs/extra.json",
            { schemaVersion: 1, catalog: "c", entries: [{ id: "a", creature: { soak: { all: 1 } } }] },
          ],
        ]),
      ],
    ];
    for (const [what, ruleset, assets] of cases) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(46), ruleset as never, assets as never) ?? "",
        issue,
        what,
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(47), ruleset as never, assets as never), null, what);
    }
    // A fight that adds dice up asks for nothing new.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(46), { combat: { kind: "attack-vs-defense" } } as never),
      null,
    );
  }

  console.info("game ruleset combat pool regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
