/**
 * Ruleset combat: initiative as a number attacks move (#6740), in a `dice-pool` fight.
 *
 * What is pinned here, on a Gravewatch variant with scripted dice:
 *   - Initiative thrown as a pool: its successes plus `plus`, a creature's initiative number as its
 *     pool, and the same pool thrown again every round where the ruleset asks for that.
 *   - Every attack offered once per style, each with its own forecast, and a crashed maker offered
 *     only the styles that take. A style the attack is not offered in is refused and changes nothing.
 *   - A blow that takes: its damage dice, soaked as usual, come off the target's number and never
 *     their health, and its maker gains them and the style's own gain; taking somebody to the line
 *     crashes them, with the ruleset's condition and the crash bonus.
 *   - A blow that spends: the maker's number thrown as damage dice, with nothing the weapon adds,
 *     nothing past the needed successes and no soak, then the number back to the base; a miss costs
 *     what the step table says at the number, and may crash its own maker.
 *   - The order following the numbers as each round begins, without a die thrown.
 *   - A crash lifting when the number rises above the line, when the ruleset's count of turns runs
 *     out, and when the fight ends; somebody who opens at the line starting the fight crashed, or
 *     immune to its condition.
 *   - A held hit keeping its style and the number it was made with, a reaction's attack made in the
 *     first style, an action made of several only ever taking, and a between-turns window naming
 *     nobody before a new round.
 *   - Every import refusal, the 1.48 install gate, the menu's words and the log lines.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  type DirectedRulesetOption,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-moving-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    { getCapabilityPackageInstallIssue },
    { rulesetCombatEventLine, rulesetCombatNames },
    { rulesetOptionForecastText, rulesetStyleForecastText },
  ] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
    import("../../packages/client/src/lib/ruleset-combat-menu.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
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

  /** Initiative as a number attacks move: a pool of Nerve plus three, a style that takes (and gains
   *  one more) and one that spends, and a crash at zero that puts Reeling on, is worth five to
   *  whoever caused it, and lifts after three of the crashed one's own turns. */
  const moveInitiative = (doc: Record<string, any>) => {
    doc.sheet.live.conditions.push({ id: "reeling", label: "Reeling" });
    doc.combat.initiative = {
      pool: { abilityMod: "nerve" },
      plus: 3,
      resource: {
        base: 3,
        styles: [
          { id: "press", label: "Press", takes: { gain: 1 } },
          {
            id: "telling",
            label: "Telling blow",
            spends: {
              onMiss: [
                [0, 1],
                [6, 2],
                [11, 3],
              ],
            },
          },
        ],
        crash: { at: 0, condition: "reeling", bonus: 5, recoverAfter: 3 },
      },
    };
  };
  const movingText = JSON.stringify(edited(gravewatchText, moveInitiative));
  const variantOf = (edit: (doc: Record<string, any>) => void = () => {}) =>
    parsedOrThrow(edited(movingText, edit), "the moving-initiative Gravewatch");
  const moving = variantOf();

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
  const shifts = (events: RulesetCombatEvent[]) =>
    eventsOf(events, "shift").map((event) => [event.actorId, event.reason, event.amount, event.total]);

  const catalogsOf = (definition: RulesetDefinition) =>
    Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
  /** A warden: Sinew 3, Nerve 2 (two dice of initiative); Dig 1, so her Spade throws four dice and
   *  deals 2d10 tearing. */
  const warden = (definition: RulesetDefinition, id: string, charms: string[] = []): RulesetCombatantInput => {
    const catalogs = catalogsOf(definition);
    const charmRows = charms.flatMap((charm) =>
      rowsFromCatalogEntry(
        "charms",
        (catalogs.charms ?? []).find((entry) => entry.id === charm)!,
      ).map((row) => row.row),
    );
    return {
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      side: "party",
      build: rulesetSheetBuildSchema.parse({
        abilities: { sinew: 3, nerve: 2, warmth: 2 },
        skills: { dig: "rating_1", wrestle: "rating_2", ward: "rating_2" },
        lists: {
          arms: [{ name: "Spade", rating: "sinew", trade: "dig", dice: "2d10", harm: "tearing" }],
          charms: charmRows,
        },
      }),
      live: {},
      catalogs,
    } as RulesetCombatantInput;
  };
  const creature = (id: string, entryId: string): RulesetCombatantInput => ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    side: "enemy",
    creature: { catalogId: "night", entryId },
  });
  const fight = (definition: RulesetDefinition, combatants: RulesetCombatantInput[], ...faces: number[]) =>
    createRulesetEncounter({
      definition,
      seed: 3,
      combatants,
      bestiary: catalogsOf(definition),
      roller: dice(...faces),
    });
  const act = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: RulesetCombatChoice,
    ...faces: number[]
  ) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
  const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, ...faces: number[]) =>
    act(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, ...faces);
  const optionOf = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((entry) => entry.label === label);
    assert.ok(option, `${actorId} has no "${label}"`);
    return option;
  };
  const swing = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    targetId: string,
    style: string | undefined,
    ...faces: number[]
  ) =>
    act(
      definition,
      state,
      {
        actorId,
        optionId: optionOf(definition, state, actorId, label).id,
        targetIds: [targetId],
        ...(style ? { style } : {}),
      },
      ...faces,
    );
  const numberOf = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!.initiative;
  const health = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const reeling = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes("reeling");

  const t = ((key: string, params: Record<string, unknown> = {}) => {
    const count = typeof params.count === "number" ? params.count : undefined;
    const template =
      (count !== undefined ? english[`${key}_${count === 1 ? "one" : "other"}`] : undefined) ??
      english[key] ??
      (params.defaultValue as string | undefined) ??
      key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ""));
  }) as never;

  // ── The variant imports; Gravewatch as shipped and Ember Roads are untouched ──
  {
    const initiative = moving.combat!.initiative;
    assert.deepEqual(initiative.pool, { abilityMod: "nerve" });
    assert.equal(initiative.plus, 3);
    assert.equal(initiative.dice, undefined);
    assert.equal(initiative.resource?.styles.length, 2);
    assert.deepEqual(initiative.resource?.crash, { at: 0, condition: "reeling", bonus: 5, recoverAfter: 3 });
    // A crash with nothing but a line: the defaults.
    const bare = variantOf((doc) => (doc.combat.initiative.resource.crash = {}));
    assert.deepEqual(bare.combat!.initiative.resource!.crash, { at: 0, bonus: 0 });
    const shipped = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
    assert.equal(shipped.combat!.initiative.resource, undefined);
    assert.ok(shipped.combat!.initiative.dice);
    const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
    assert.equal(ember.combat!.initiative.pool, undefined);
  }

  // ── Refused at import ──
  {
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.dice = { count: 1, sides: 10 }),
      /Initiative is thrown as dice or as a pool: one of the two/,
      "both dice and a pool",
    );
    refuses(
      movingText,
      (doc) => delete doc.combat.initiative.pool,
      /Initiative is thrown as dice or as a pool: one of the two/,
      "neither dice nor a pool",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.modifier = { const: 1 }),
      /A modifier is added to initiative dice, and there are none/,
      "a modifier beside a pool",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.combat.initiative.plus = 2),
      /plus is added to a pool's successes, and initiative is not a pool/,
      "plus beside dice",
    );
    refuses(
      emberText,
      (doc) => {
        delete doc.combat.initiative.dice;
        delete doc.combat.initiative.modifier;
        doc.combat.initiative.pool = { const: 2 };
      },
      /Initiative thrown as a pool is for a "dice-pool" fight/,
      "a pool on a summed fight",
    );
    refuses(
      emberText,
      (doc) =>
        (doc.combat.initiative.resource = { base: 3, styles: [{ id: "press", label: "Press", takes: { gain: 1 } }] }),
      /Initiative that attacks move is for a "dice-pool" fight/,
      "a moving number on a summed fight",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.each = "round"),
      /A number attacks move is kept, never thrown again, and orders every round by itself/,
      "a moving number thrown again",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.resource.styles[1].id = "press"),
      /"press"/,
      "two styles of one id",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.resource.styles[0].spends = {}),
      /A style either takes or spends/,
      "a style that does both",
    );
    refuses(
      movingText,
      (doc) => delete doc.combat.initiative.resource.styles[0].takes,
      /A style either takes or spends/,
      "a style that does neither",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.resource.styles[1].spends.onMiss[0][1] = -1),
      /A miss costs nothing or more/,
      "a miss that pays",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.resource.crash.condition = "dazed"),
      /Unknown condition "dazed"/,
      "a crash condition the sheet does not have",
    );
    refuses(
      movingText,
      (doc) => (doc.combat.initiative.resource.base = 0),
      /The base is what a number goes back to, so it is above 0/,
      "a base on the crash line",
    );
    refuses(movingText, (doc) => (doc.combat.initiative.resource.styles = []), /styles/, "no style at all");
    refuses(
      movingText,
      (doc) => {
        delete doc.combat.initiative.pool;
        delete doc.combat.initiative.plus;
        doc.combat.initiative.dice = { count: 1, sides: 10 };
      },
      /A number attacks move opens as a thrown pool, so initiative needs pool/,
      "a number attacks move opened by summed dice",
    );
    refuses(
      movingText,
      (doc) => doc.combat.initiative.resource.styles.shift(),
      /At least one style takes: a crashed combatant attacks in one/,
      "only styles that spend",
    );
  }

  // ── Opening: a pool's successes and plus, a creature's number as its pool ──
  {
    // Ada throws her Nerve (two dice): 8 and 9, two successes, five. The rats throw three dice: 2, 3,
    // 4, nothing, three.
    const state = fight(moving, [warden(moving, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    const ada = rulesetCombatant(state, "ada")!;
    assert.deepEqual([ada.initiativeRoll, ada.initiativeModifier, ada.initiative], [[8, 9], 2, 5]);
    const rats = rulesetCombatant(state, "rats")!;
    assert.deepEqual([rats.initiativeRoll, rats.initiativeModifier, rats.initiative], [[2, 3, 4], 3, 3]);
    assert.deepEqual(state.order, ["ada", "rats"]);
    assert.equal(state.cursor, 5, "five dice thrown, and nothing else");
    assert.equal(ada.crashedTurns, undefined);
  }

  // ── The menu: one attack, once per style ──
  {
    const state = fight(moving, [warden(moving, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    const spade = optionOf(moving, state, "ada", "Spade");
    assert.deepEqual(
      spade.styles?.map((style) => style.id),
      ["press", "telling"],
    );
    const [press, telling] = spade.styles!;
    assert.equal(press!.forecast?.hitChance, spade.forecast?.hitChance);
    assert.equal(press!.forecast?.shift, spade.forecast?.averageDamage, "a taking style takes what its dice are worth");
    assert.equal(telling!.forecast?.hitChance, spade.forecast?.hitChance);
    assert.equal(telling!.forecast?.averageDamage, 2.5, "five dice at six or more on a d10: half a success each");
    // Ending a turn is not an attack.
    assert.equal(optionOf(moving, state, "ada", "End turn").styles, undefined);
    // What the menu says: the option names only its chance, each style what it does.
    const shown = { ...spade, targetIds: ["rats"] } as DirectedRulesetOption;
    assert.equal(rulesetOptionForecastText(shown, t), `${Math.round(spade.forecast!.hitChance! * 100)}% to hit`);
    assert.equal(
      rulesetStyleForecastText(telling!, t),
      `${Math.round(spade.forecast!.hitChance! * 100)}% to hit, about 3 damage`,
    );
    assert.match(rulesetStyleForecastText(press!, t), /% to hit, about \d+ initiative taken$/);
    // A style the attack is not offered in is refused, and changes nothing.
    const frozen = JSON.stringify(state);
    const refused = act(moving, state, {
      actorId: "ada",
      optionId: spade.id,
      targetIds: ["rats"],
      style: "sneak",
    });
    assert.equal(firstOf(refused.events, "refused").reason, "unknown-style");
    assert.equal(JSON.stringify(refused.state), frozen);
  }

  // ── A blow that takes, and the crash it causes ──
  {
    const state = fight(moving, [warden(moving, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    // Three successes on four dice against one needed: two extra damage dice, so four in all, and
    // three of them reach six. The rats soak no tearing, so three come off their three.
    const pressed = swing(moving, state, "ada", "Spade", "rats", "press", 8, 8, 8, 2, 6, 6, 6, 2);
    assert.equal(firstOf(pressed.events, "attack").style, "press");
    assert.equal(eventsOf(pressed.events, "damage").length, 0, "nothing lands on health");
    assert.equal(health(moving, pressed.state, "rats"), 3);
    assert.deepEqual(shifts(pressed.events), [
      ["rats", "taken", -3, 0],
      ["ada", "gained", 4, 9],
      ["ada", "crash", 5, 14],
    ]);
    const taken = firstOf(pressed.events, "shift");
    assert.equal(taken.sourceId, "ada");
    assert.deepEqual(taken.rolls, [6, 6, 6, 2]);
    assert.equal(taken.pool?.successes, 3);
    const crashed = eventsOf(pressed.events, "condition").find((event) => event.condition === "reeling");
    assert.deepEqual(crashed && [crashed.targetId, crashed.active, crashed.reason], ["rats", true, "applied"]);
    const rats = rulesetCombatant(pressed.state, "rats")!;
    assert.equal(rats.tracked.find((entry) => entry.condition === "reeling")?.source, "ada");
    assert.equal(rats.crashedTurns, 0);
    // The order stands until the round turns.
    assert.deepEqual(pressed.state.order, ["ada", "rats"]);

    // The log.
    const names = rulesetCombatNames(
      moving,
      {
        combatants: [
          { id: "ada", name: "Ada" },
          { id: "rats", name: "Rats" },
        ],
      } as never,
      t,
    );
    const lines = pressed.events.map((event) => rulesetCombatEventLine(event as never, names, t)).filter(Boolean);
    assert.ok(
      lines.includes(
        "Ada attacks Rats with Spade (Press): 3 successes from 4 dice at 7 or more (8, 8, 8, 2), needing 1 success, a hit.",
      ),
      JSON.stringify(lines),
    );
    assert.ok(
      lines.includes(
        "The damage: 3 successes from 4 dice at 6 or more (6, 6, 6, 2). Rats loses 3 initiative, and is on 0.",
      ),
      JSON.stringify(lines),
    );
    assert.ok(lines.includes("Ada gains 4 initiative, and is on 9."), JSON.stringify(lines));
    assert.ok(lines.includes("Rats is now Reeling."), JSON.stringify(lines));
    assert.ok(lines.includes("Ada gains 5 initiative for crashing Rats, and is on 14."), JSON.stringify(lines));

    // Crashed, the rats are offered only the style that takes, and a spending one is refused.
    let next = endTurn(moving, pressed.state, "ada").state;
    const gnaw = optionOf(moving, next, "rats", "Gnaw");
    assert.deepEqual(
      gnaw.styles?.map((style) => style.id),
      ["press"],
    );
    const spend = act(moving, next, { actorId: "rats", optionId: gnaw.id, targetIds: ["ada"], style: "telling" });
    assert.equal(firstOf(spend.events, "refused").reason, "unknown-style");
    assert.equal(rulesetCombatant(next, "rats")!.crashedTurns, 1, "one of their own turns begun crashed");

    // The round turns: the order follows the numbers, and not a die is thrown for it.
    const round = endTurn(moving, next, "rats");
    assert.deepEqual(
      firstOf(round.events, "initiative").entries.map((entry) => [entry.actorId, entry.total]),
      [
        ["ada", 14],
        ["rats", 0],
      ],
    );
    assert.equal(round.state.cursor, next.cursor, "nothing thrown");
    next = endTurn(moving, round.state, "ada").state;
    assert.equal(rulesetCombatant(next, "rats")!.crashedTurns, 2);
    // The third turn they begin crashed: back to the base, and Reeling comes off.
    const recovered = endTurn(moving, endTurn(moving, next, "rats").state, "ada");
    assert.deepEqual(shifts(recovered.events), [["rats", "recovered", 3, 3]]);
    const lifted = eventsOf(recovered.events, "condition").find((event) => event.condition === "reeling");
    assert.deepEqual(lifted && [lifted.active, lifted.reason], [false, "recovered"]);
    assert.equal(rulesetCombatant(recovered.state, "rats")!.crashedTurns, undefined);
    assert.equal(reeling(moving, recovered.state, "rats"), false);
    const recoveredLines = recovered.events
      .map((event) => rulesetCombatEventLine(event as never, names, t))
      .filter(Boolean);
    assert.ok(
      recoveredLines.includes("Rats recovers, and their initiative is back to 3."),
      JSON.stringify(recoveredLines),
    );
    assert.ok(recoveredLines.includes("Rats is no longer Reeling."), JSON.stringify(recoveredLines));
  }

  // ── Soak comes off what a taking blow takes ──
  {
    // Ada five (8, 9), the warden three (2, 3).
    const state = fight(moving, [warden(moving, "ada"), creature("hollow", "hollow-warden")], 8, 9, 2, 3);
    // Three successes against two needed: three damage dice, all reaching six; the warden soaks a
    // tear with one die, which reaches six too. Two are taken.
    const pressed = swing(moving, state, "ada", "Spade", "hollow", "press", 8, 8, 8, 2, 6, 6, 6, 6);
    const taken = firstOf(pressed.events, "shift");
    assert.deepEqual([taken.actorId, taken.amount, taken.total], ["hollow", -2, 1]);
    assert.deepEqual(taken.pool?.soak, { value: 1, rolls: [6], taken: 1 });
    assert.deepEqual(shifts(pressed.events)[1], ["ada", "gained", 3, 8]);
  }

  // ── A blow that spends: the number as damage dice, no soak, and back to the base ──
  {
    // Ada opens at four (8 and 2: one success, and three). The warden throws 2 and 3: three.
    const state = fight(moving, [warden(moving, "ada"), creature("hollow", "hollow-warden")], 8, 2, 2, 3);
    assert.equal(numberOf(state, "ada"), 4);
    // Three successes against the two needed: a hit, and the one extra adds nothing. Her four dice
    // are the damage, and the warden's soak is never thrown (the script would run out if it were).
    const spent = swing(moving, state, "ada", "Spade", "hollow", "telling", 8, 8, 8, 2, 6, 6, 6, 2);
    assert.equal(firstOf(spent.events, "attack").style, "telling");
    const damage = firstOf(spent.events, "damage");
    assert.deepEqual(damage.rolls, [6, 6, 6, 2]);
    assert.equal(damage.pool?.soak, undefined);
    assert.equal(damage.dealt, 3);
    assert.equal(health(moving, spent.state, "hollow"), 3);
    assert.deepEqual(shifts(spent.events), [["ada", "spent", -1, 3]]);
    const names = rulesetCombatNames(moving, { combatants: [{ id: "ada", name: "Ada" }] } as never, t);
    assert.equal(
      rulesetCombatEventLine(eventsOf(spent.events, "shift")[0]!, names, t),
      "Ada spends their initiative, and it goes back to 3.",
    );

    // A miss costs what the table says at the number: at six, two.
    const high = fight(moving, [warden(moving, "ada"), creature("hollow", "hollow-warden")], 10, 9, 8, 2, 3);
    assert.equal(numberOf(high, "ada"), 6, "a ten throws another die");
    const missed = swing(moving, high, "ada", "Spade", "hollow", "telling", 2, 3, 4, 5);
    assert.equal(firstOf(missed.events, "attack").outcome, "miss");
    assert.equal(eventsOf(missed.events, "damage").length, 0);
    assert.deepEqual(shifts(missed.events), [["ada", "missed", -2, 4]]);
    assert.equal(
      rulesetCombatEventLine(eventsOf(missed.events, "shift")[0]!, names, t),
      "Ada loses 2 initiative for missing, and is on 4.",
    );
  }

  // ── A miss that crashes its own maker, and rising above the line lifting it ──
  {
    // No plus: Ada opens at one (8 and 2), the rats at two (7, 7, 2).
    const bare = variantOf((doc) => delete doc.combat.initiative.plus);
    const state = fight(bare, [warden(bare, "ada"), creature("rats", "grave-rats")], 8, 2, 7, 7, 2);
    assert.deepEqual(state.order, ["rats", "ada"]);
    const ready = endTurn(bare, state, "rats").state;
    assert.equal(numberOf(ready, "ada"), 1);
    const missed = swing(bare, ready, "ada", "Spade", "rats", "telling", 2, 3, 4, 5);
    assert.deepEqual(shifts(missed.events), [["ada", "missed", -1, 0]], "no bonus: nobody crashed her");
    assert.equal(reeling(bare, missed.state, "ada"), true);
    assert.equal(
      rulesetCombatant(missed.state, "ada")!.tracked.find((entry) => entry.condition === "reeling")?.source,
      undefined,
    );
    // Her sheet says so too.
    assert.ok(
      JSON.stringify(rulesetCombatant(missed.state, "ada")!.sheet!.live).includes("reeling"),
      "the crash is on her sheet while it lasts",
    );
    // The round turns (rats two, Ada nought), and on her turn she may only take.
    let next = endTurn(bare, endTurn(bare, missed.state, "ada").state, "rats").state;
    assert.equal(next.order[next.turn], "ada");
    assert.deepEqual(
      optionOf(bare, next, "ada", "Spade").styles?.map((style) => style.id),
      ["press"],
    );
    // One success against one needed: two damage dice, one reaches six. Taking one off the rats
    // lifts her to two, and Reeling with it.
    const pressed = swing(bare, next, "ada", "Spade", "rats", undefined, 7, 2, 3, 4, 6, 2);
    assert.equal(firstOf(pressed.events, "attack").style, "press", "the first style when none is named");
    assert.deepEqual(shifts(pressed.events), [
      ["rats", "taken", -1, 1],
      ["ada", "gained", 2, 2],
    ]);
    const lifted = eventsOf(pressed.events, "condition").find((event) => event.condition === "reeling");
    assert.deepEqual(lifted && [lifted.targetId, lifted.active, lifted.reason], ["ada", false, "recovered"]);
    assert.equal(rulesetCombatant(pressed.state, "ada")!.crashedTurns, undefined);
    next = pressed.state;
    assert.ok(!JSON.stringify(rulesetCombatant(next, "ada")!.sheet!.live).includes("reeling"));
  }

  // ── Somebody who opens at the line starts crashed ──
  {
    const bare = variantOf((doc) => delete doc.combat.initiative.plus);
    // The rats throw nothing (2, 3, 4) and open at nought.
    const state = fight(bare, [warden(bare, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    assert.equal(numberOf(state, "rats"), 0);
    assert.equal(rulesetCombatant(state, "rats")!.crashedTurns, 0);
    assert.equal(reeling(bare, state, "rats"), true);
    const opening = state.opening.map((event) => event.type);
    assert.deepEqual(opening, ["initiative", "condition", "round", "turn"]);
    // A creature that shrugs the condition off is still crashed, and the opening says it is immune.
    const steady = variantOf((doc) => {
      delete doc.combat.initiative.plus;
      doc.catalogs[1].entries[0].creature.conditionImmunities = ["reeling"];
    });
    const unshaken = fight(steady, [warden(steady, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    assert.equal(rulesetCombatant(unshaken, "rats")!.crashedTurns, 0);
    assert.equal(reeling(steady, unshaken, "rats"), false);
    const immune = unshaken.opening.find((event) => event.type === "condition");
    assert.deepEqual(immune && immune.type === "condition" && [immune.targetId, immune.reason], ["rats", "immune"]);
  }

  // ── The fight ending lifts every crash ──
  {
    const bare = variantOf((doc) => delete doc.combat.initiative.plus);
    // Ada at one, Bram at two (7, 7), the rats at nought.
    let state = fight(
      bare,
      [warden(bare, "ada"), warden(bare, "bram"), creature("rats", "grave-rats")],
      8,
      2,
      7,
      7,
      2,
      3,
      4,
    );
    assert.deepEqual(state.order, ["bram", "ada", "rats"]);
    state = endTurn(bare, state, "bram").state;
    state = swing(bare, state, "ada", "Spade", "rats", "telling", 2, 3, 4, 5).state;
    assert.equal(reeling(bare, state, "ada"), true);
    state = endTurn(bare, state, "ada").state;
    state = endTurn(bare, state, "rats").state;
    // Bram spends two dice on the rats: both reach six, two of their three. Then again for the last.
    assert.equal(state.order[state.turn], "bram");
    const first = swing(bare, state, "bram", "Spade", "rats", "telling", 8, 2, 3, 4, 6, 6);
    assert.equal(health(bare, first.state, "rats"), 1);
    assert.equal(numberOf(first.state, "bram"), 3, "back to the base");
    // Both crashed at nought, the rats ahead of Ada on their larger pool.
    assert.deepEqual(first.state.order, ["bram", "rats", "ada"]);
    state = endTurn(bare, first.state, "bram").state;
    state = endTurn(bare, state, "rats").state;
    state = endTurn(bare, state, "ada").state;
    const last = swing(bare, state, "bram", "Spade", "rats", "telling", 8, 2, 3, 4, 6, 2, 2);
    assert.equal(firstOf(last.events, "outcome").outcome, "victory");
    const lifted = eventsOf(last.events, "condition").filter((event) => event.condition === "reeling");
    assert.deepEqual(lifted.map((event) => [event.targetId, event.active, event.reason]).sort(), [
      ["ada", false, "recovered"],
      ["rats", false, "recovered"],
    ]);
    assert.equal(reeling(bare, last.state, "ada"), false);
    assert.ok(!JSON.stringify(rulesetCombatant(last.state, "ada")!.sheet!.live).includes("reeling"));
  }

  // ── A held hit keeps its style ──
  {
    const braced = variantOf((doc) => {
      doc.catalogs[0].entries.push({
        id: "brace",
        label: "Brace",
        rows: [{ list: "charms", values: { name: "Brace" } }],
        mechanics: {
          kind: "buff",
          targets: "self",
          budget: "quick",
          reaction: { on: "hit" },
          applies: [{ condition: "reeling", duration: { rounds: 1 } }],
        },
      });
    });
    // The rats open at five (7, 7, 2), Ada at four (8, 2).
    const state = fight(braced, [warden(braced, "ada", ["brace"]), creature("rats", "grave-rats")], 8, 2, 7, 7, 2);
    assert.deepEqual(state.order, ["rats", "ada"]);
    // Two successes on the gnaw against one needed: a hit, held before anything lands.
    const gnaw = swing(braced, state, "rats", "Gnaw", "ada", "telling", 7, 7, 2, 3, 4);
    assert.equal(gnaw.state.window?.trigger.kind, "hit");
    assert.ok(rulesetWindowOptions(braced, gnaw.state, "ada").some((option) => option.label === "Brace"));
    // Ada lets it go: the blow lands as the telling blow it was, five dice of the rats' own number.
    const landed = act(
      braced,
      gnaw.state,
      { actorId: "ada", optionId: RULESET_PASS_OPTION, targetIds: [], window: gnaw.state.window!.id },
      6,
      6,
      2,
      2,
      2,
    );
    const damage = firstOf(landed.events, "damage");
    assert.deepEqual(damage.rolls, [6, 6, 2, 2, 2]);
    assert.equal(damage.dealt, 2);
    assert.deepEqual(shifts(landed.events), [["rats", "spent", -2, 3]]);
  }

  // ── A reaction that attacks is made in the first style, with no style to choose ──
  {
    const answering = variantOf((doc) => {
      doc.catalogs[0].entries.push({
        id: "riposte",
        label: "Riposte",
        rows: [{ list: "charms", values: { name: "Riposte" } }],
        mechanics: {
          kind: "attack",
          attackRoll: true,
          budget: "quick",
          reaction: { on: "hit" },
          amount: { dice: "1d10" },
          damageType: "tearing",
        },
      });
    });
    // The rats open at five (7, 7, 2), Ada at four (8, 2).
    const state = fight(
      answering,
      [warden(answering, "ada", ["riposte"]), creature("rats", "grave-rats")],
      8,
      2,
      7,
      7,
      2,
    );
    // The gnaw hits (two successes, one needed) and is held.
    const gnaw = swing(answering, state, "rats", "Gnaw", "ada", "press", 7, 7, 2, 3, 4);
    const riposte = rulesetWindowOptions(answering, gnaw.state, "ada").find((option) => option.label === "Riposte");
    assert.ok(riposte, "the riposte is offered at the hit");
    assert.equal(riposte.styles, undefined, "and offers no style: it is made in the first");
    // Her Ward throws four dice: two successes, one extra die, two damage dice that both reach six.
    // Then the held gnaw lands: two dice, one reaching six.
    const answered = act(
      answering,
      gnaw.state,
      { actorId: "ada", optionId: riposte.id, targetIds: [], window: gnaw.state.window!.id },
      8,
      8,
      2,
      3,
      6,
      6,
      6,
      2,
    );
    const attacks = eventsOf(answered.events, "attack");
    assert.deepEqual(
      attacks.map((event) => [event.actorId, event.style]),
      [["ada", "press"]],
      "the riposte is a taking blow",
    );
    assert.deepEqual(shifts(answered.events), [
      ["rats", "taken", -2, 3],
      ["ada", "gained", 3, 7],
      ["ada", "taken", -1, 6],
      ["rats", "gained", 2, 5],
    ]);
    assert.equal(eventsOf(answered.events, "damage").length, 0, "nobody's health moved");
  }

  // ── A held spending blow throws the number it was made with ──
  {
    const answering = variantOf((doc) => {
      doc.catalogs[0].entries.push({
        id: "riposte",
        label: "Riposte",
        rows: [{ list: "charms", values: { name: "Riposte" } }],
        mechanics: {
          kind: "attack",
          attackRoll: true,
          budget: "quick",
          reaction: { on: "hit" },
          amount: { dice: "1d10" },
          damageType: "tearing",
        },
      });
    });
    // The rats open at five (7, 7, 2), Ada at four (8, 2).
    const state = fight(
      answering,
      [warden(answering, "ada", ["riposte"]), creature("rats", "grave-rats")],
      8,
      2,
      7,
      7,
      2,
    );
    // A telling gnaw hits and is held. Ada's riposte throws a ten that throws again: five successes,
    // five damage dice, all five of the rats' number taken, and the rats crash before the gnaw lands.
    const gnaw = swing(answering, state, "rats", "Gnaw", "ada", "telling", 7, 7, 2, 3, 4);
    const riposte = rulesetWindowOptions(answering, gnaw.state, "ada").find((option) => option.label === "Riposte")!;
    const answered = act(
      answering,
      gnaw.state,
      { actorId: "ada", optionId: riposte.id, targetIds: [], window: gnaw.state.window!.id },
      10,
      8,
      8,
      8,
      8,
      6,
      6,
      6,
      6,
      6,
      6,
      6,
      2,
      2,
      2,
    );
    // Still a telling blow, crashed or not, and still five dice: what the rats had when they made it.
    const damage = eventsOf(answered.events, "damage").find((event) => event.targetId === "ada");
    assert.deepEqual(damage?.rolls, [6, 6, 2, 2, 2]);
    assert.deepEqual(shifts(answered.events), [
      ["rats", "taken", -5, 0],
      ["ada", "gained", 6, 10],
      ["ada", "crash", 5, 15],
      ["rats", "spent", 3, 3],
    ]);
    assert.equal(reeling(answering, answered.state, "rats"), false, "back at the base, and no longer crashed");
  }

  // ── An action made of several only ever takes ──
  {
    const swarming = variantOf((doc) => {
      doc.catalogs[1].entries[0].creature.actions.push({
        id: "swarm",
        name: "Swarm",
        budget: "act",
        sequence: [{ action: "gnaw", times: 2 }],
      });
    });
    // The rats open at five (7, 7, 2), Ada at four (8, 2).
    const state = fight(swarming, [warden(swarming, "ada"), creature("rats", "grave-rats")], 8, 2, 7, 7, 2);
    const swarm = optionOf(swarming, state, "rats", "Swarm");
    assert.deepEqual(
      swarm.styles?.map((style) => style.id),
      ["press"],
      "a number is spent on one blow",
    );
    const spend = act(swarming, state, { actorId: "rats", optionId: swarm.id, targetIds: ["ada"], style: "telling" });
    assert.equal(firstOf(spend.events, "refused").reason, "unknown-style");
    // Both gnaws are made as presses: each misses (nothing reaches seven), and nothing is spent.
    const pressed = act(
      swarming,
      state,
      { actorId: "rats", optionId: swarm.id, targetIds: ["ada"] },
      2,
      3,
      4,
      5,
      6,
      2,
      3,
      4,
      5,
      6,
    );
    assert.deepEqual(
      eventsOf(pressed.events, "attack").map((event) => event.style),
      ["press", "press"],
    );
    assert.deepEqual(shifts(pressed.events), []);
  }

  // ── A window between turns names nobody before a round the numbers re-sort ──
  {
    const signing = variantOf((doc) => {
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
    // Ada five, the rats three, the warden three: the round ends on the warden's turn.
    let state = fight(
      signing,
      [warden(signing, "ada"), creature("rats", "grave-rats"), creature("hollow", "hollow-warden")],
      8,
      9,
      2,
      3,
      4,
      2,
      3,
    );
    assert.deepEqual(state.order, ["ada", "rats", "hollow"]);
    state = endTurn(signing, state, "ada").state;
    if (state.window) {
      state = act(signing, state, {
        actorId: "rats",
        optionId: RULESET_PASS_OPTION,
        targetIds: [],
        window: state.window.id,
      }).state;
    }
    state = endTurn(signing, state, "rats").state;
    const lastTurn = endTurn(signing, state, "hollow");
    assert.deepEqual(lastTurn.state.window?.trigger, { kind: "between-turns", nextActorId: "" });
  }

  // ── A pool thrown again every round, without a number that moves ──
  {
    const rethrowing = variantOf((doc) => {
      delete doc.combat.initiative.resource;
      doc.combat.initiative.each = "round";
    });
    const state = fight(rethrowing, [warden(rethrowing, "ada"), creature("rats", "grave-rats")], 8, 9, 2, 3, 4);
    // As the round turns Ada throws 2, 3 (three) and the rats 7, 8, 9 (six).
    const round = endTurn(rethrowing, endTurn(rethrowing, state, "ada").state, "rats", 2, 3, 7, 8, 9);
    assert.deepEqual(
      firstOf(round.events, "initiative").entries.map((entry) => [entry.actorId, entry.total]),
      [
        ["rats", 6],
        ["ada", 3],
      ],
    );
    assert.deepEqual(rulesetCombatant(round.state, "rats")!.initiativeRoll, [7, 8, 9]);
  }

  // ── Every new key needs 1.48 to install ──
  {
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      }) as never;
    const issue = /throw initiative as a pool or let attacks move it requires schemaVersion 2 and capabilityApi 1\.48/;
    for (const [what, initiative] of [
      ["a pool", { pool: { const: 2 } }],
      ["plus", { plus: 1 }],
      ["a number attacks move", { resource: { base: 3, styles: [] } }],
    ] as const) {
      const ruleset = { combat: { initiative } } as never;
      assert.match(getCapabilityPackageInstallIssue(manifest(47), ruleset) ?? "", issue, what);
      assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(48), ruleset) ?? "", issue, what);
    }
    assert.doesNotMatch(
      getCapabilityPackageInstallIssue(manifest(47), {
        combat: { initiative: { dice: { count: 1, sides: 10 } } },
      } as never) ?? "",
      issue,
      "initiative dice are older than this",
    );
  }

  console.log("game-ruleset-combat-moving-initiative regression passed");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dataDir, { recursive: true, force: true });
}
