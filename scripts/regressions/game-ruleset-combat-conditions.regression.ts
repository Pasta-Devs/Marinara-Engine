/**
 * Ruleset combat, slice C5f (#6719): numbers a condition changes, check effects, conditions that end
 * after one use or as a turn begins, and levels of a live track.
 *
 * What is pinned here:
 *   - A condition's `modifiers`: a flat change to the holder's defense, dice added to or taken from
 *     its attack rolls, saves (narrowed by `saves`) and contest checks, and speed changed by a number
 *     or halved. Each is rolled or read where the number is used, shows on the event with the
 *     condition that gave it, and is counted by the menu's chance to hit and chance to win.
 *   - `own-checks-advantage` / `own-checks-disadvantage` on the holder's side of a contest.
 *   - `endsAfter` (own-attack, attacked, own-save) and `duration.at: "turn-start"`, and a turn's walk
 *     read again once a clock has run out as the turn began.
 *   - `combat.levels`: a live track's levels count as conditions, and add up as the track climbs.
 *   - Every import refusal, the published schema, the log, and the 1.45 gate.
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
  rulesetBonusDice,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetConditionModifiers,
  rulesetContestChance,
  rulesetHitChance,
  rulesetMovementAllowance,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-conditions-"));
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
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;
  const published = JSON.parse(read("../../docs/extending/ruleset.schema.json")) as Record<string, any>;

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const edited = (text: string, edit: (doc: Record<string, any>) => void) => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const refuses = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const parsed = parseRulesetDefinition(edited(text, edit));
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };

  /** Conditions this lane adds to the 5e reference, each changing one kind of number. */
  const EXTRA: Array<{ id: string; label: string; combat: Record<string, unknown> }> = [
    {
      id: "blessed",
      label: "Blessed",
      combat: {
        modifiers: [
          { to: "attacks", dice: "1d4" },
          { to: "saves", dice: "1d4" },
        ],
      },
    },
    { id: "baned", label: "Baned", combat: { modifiers: [{ to: "attacks", dice: "1d4", minus: true }] } },
    { id: "shielded", label: "Shielded", combat: { modifiers: [{ to: "defense", flat: 5 }] } },
    { id: "steadied", label: "Steadied", combat: { saves: ["dex_save"], modifiers: [{ to: "saves", flat: 2 }] } },
    { id: "braced", label: "Braced", combat: { modifiers: [{ to: "checks", flat: 3 }] } },
    { id: "slowed", label: "Slowed", combat: { modifiers: [{ to: "speed", times: 0.5 }] } },
    { id: "mocked", label: "Mocked", combat: { effects: ["own-attacks-disadvantage"] } },
    { id: "marked", label: "Marked", combat: { effects: ["attacks-against-advantage"] } },
    { id: "warded", label: "Warded", combat: { effects: ["resist-all"] } },
  ];
  const withExtra = (doc: Record<string, any>) => {
    for (const extra of EXTRA) {
      doc.sheet.live.conditions.push({ id: extra.id, label: extra.label });
      doc.combat.conditions.push({ condition: extra.id, ...extra.combat });
    }
  };
  const fiveE = parsedOrThrow(edited(fiveEText, withExtra), "the 5e reference with this lane's conditions");
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");

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
    assert.ok(found, `no ${type} event`);
    return found;
  };

  // Brenna fights with a longsword at +7 and has Athletics; Snag is a stat block with a scimitar at +4
  // and a few things that put a condition on whoever it points them at.
  const brenna = (live: Record<string, unknown> = {}): RulesetCombatantInput => ({
    id: "brenna",
    name: "Brenna",
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
      skills: { athletics: "proficient" },
      saves: { str_save: "proficient", con_save: "proficient" },
      fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
      lists: {
        attacks: [
          { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
        ],
      },
    }),
    live,
    catalogs: {},
  });
  const snag = (): RulesetCombatantInput => ({
    id: "snag",
    name: "Snag",
    side: "enemy",
    block: {
      health: 30,
      defense: 13,
      initiativeModifier: 2,
      speed: 30,
      saves: { dex_save: 2, con_save: 0 },
      checks: { might: 1, agility: 2 },
      actions: [
        {
          id: "scimitar",
          name: "Scimitar",
          budget: "action",
          toHit: 4,
          damage: { count: 1, sides: 6, flat: 2 },
          reach: 5,
        },
        {
          id: "mock",
          name: "Mock",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition: "mocked", duration: { rounds: 1 }, endsAfter: "own-attack" }],
        },
        {
          id: "mark",
          name: "Mark",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition: "marked", duration: { rounds: 2 }, endsAfter: "attacked" }],
        },
        {
          id: "ward",
          name: "Ward",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition: "warded", duration: { rounds: 2 }, endsAfter: "attacked" }],
        },
        {
          // Hits, and marks what it hit for the next attack at it, as Guiding Bolt does.
          id: "brand",
          name: "Brand",
          budget: "action",
          toHit: 4,
          damage: { count: 1, sides: 6, flat: 2 },
          range: 60,
          applies: [{ condition: "marked", duration: { rounds: 2 }, endsAfter: "attacked" }],
        },
        {
          id: "slow",
          name: "Slow",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition: "slowed", duration: { rounds: 1, at: "turn-start" } }],
        },
        {
          id: "drag",
          name: "Drag",
          budget: "action",
          autoHit: true,
          range: 60,
          applies: [{ condition: "slowed", duration: { rounds: 1 } }],
        },
        {
          id: "jinx",
          name: "Jinx",
          budget: "action",
          autoHit: true,
          range: 60,
          save: { save: "dex_save", difficulty: 30, onSuccess: "negates" },
          applies: [{ condition: "steadied", duration: { rounds: 5 }, endsAfter: "own-save" }],
        },
      ],
    } as RulesetStatBlock,
  });
  /** Brenna first (a 20 against Snag's 1), so every case starts on her turn. */
  const fight = (
    definition: RulesetDefinition,
    combatants: RulesetCombatantInput[],
    board?: { grid: TacticalGrid; placements: Record<string, { x: number; y: number }> },
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 11,
      combatants,
      roller: dice(...combatants.map((combatant) => (combatant.side === "party" ? 20 : 1))),
      ...(board ? { board } : {}),
    });
  const act = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: RulesetCombatChoice,
    ...faces: number[]
  ) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
  const endTurn = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, ...faces: number[]) =>
    act(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, ...faces);
  const swordOf = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "brenna").find((entry) => entry.label === "Longsword");
    assert.ok(option, "Brenna has her longsword");
    return option;
  };
  const conditionsOf = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!.tracked.map((entry) => entry.condition);
  const open = (width: number): TacticalGrid => ({
    width,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array<"plains">(width).fill("plains")),
  });

  // ── Refused at import ──
  {
    const addCondition = (doc: Record<string, any>, combat: Record<string, unknown>) => {
      doc.sheet.live.conditions.push({ id: "odd", label: "Odd" });
      doc.combat.conditions.push({ condition: "odd", ...combat });
    };
    const modifier = (value: Record<string, unknown>) => (doc: Record<string, any>) =>
      addCondition(doc, { modifiers: [value] });
    refuses(
      fiveEText,
      modifier({ to: "attacks" }),
      /by a flat amount, by dice, for speed by times, or for checks and saves by a mode/,
      "no amount",
    );
    refuses(fiveEText, modifier({ to: "attacks", flat: 0 }), /A flat change of 0 changes nothing/, "zero");
    refuses(fiveEText, modifier({ to: "defense", dice: "1d4" }), /Dice are rolled/, "dice on defense");
    refuses(fiveEText, modifier({ to: "speed", dice: "1d4" }), /Dice are rolled/, "dice on speed");
    refuses(fiveEText, modifier({ to: "attacks", flat: 1, minus: true }), /"minus" takes dice away/, "minus, no dice");
    refuses(fiveEText, modifier({ to: "attacks", times: 2 }), /"times" changes speed only/, "times on attacks");
    refuses(
      fiveEText,
      modifier({ to: "damage", flat: 2 }),
      /Invalid enum value/,
      "damage is not a number a condition changes",
    );
    refuses(
      fiveEText,
      (doc) => addCondition(doc, { saves: ["dex_save"], modifiers: [{ to: "attacks", flat: 1 }] }),
      /"saves" narrows .* and modifiers to saves/,
      "saves with nothing about saves beside it",
    );
    // Speed without a board is simply never read, as speed-zero is: a ruleset may say it either way.
    parsedOrThrow(
      edited(fiveEText, (doc) => {
        for (const key of ["distance", "ranged", "cover", "opportunity", "contests"]) delete doc.combat[key];
        for (const source of doc.combat.attacks ?? []) {
          delete source.reach;
          delete source.range;
        }
        addCondition(doc, { modifiers: [{ to: "speed", flat: 10 }] });
      }),
      "speed without a board",
    );
    // A saves modifier is enough for `saves` to narrow.
    parsedOrThrow(
      edited(fiveEText, (doc) => addCondition(doc, { saves: ["dex_save"], modifiers: [{ to: "saves", flat: 1 }] })),
      "saves narrowing a modifier",
    );

    const level = (value: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.combat.levels = [...(doc.combat.levels ?? []), value];
    };
    refuses(fiveEText, level({ track: "fatigue", at: 1, effects: ["cannot-act"] }), /Unknown track "fatigue"/, "track");
    refuses(emberText, level({ track: "strain", at: 1, effects: ["cannot-act"] }), /is a wound track/, "wound track");
    refuses(fiveEText, level({ track: "exhaustion", at: 4 }), /A level does something/, "a level that does nothing");
    refuses(
      fiveEText,
      level({ track: "exhaustion", at: 7, effects: ["cannot-act"] }),
      /"exhaustion" goes up to 6, so level 7 is never reached/,
      "a level above the top",
    );
    // A top the sheet works out is only known per character, so any level may be written against it.
    parsedOrThrow(
      edited(emberText, (doc) => {
        doc.sheet.live.tracks.push({ id: "grind", label: "Grind", min: 0, max: { const: 3 } });
        doc.combat.levels.push({ track: "grind", at: 9, effects: ["cannot-act"] });
      }),
      "a level on a worked-out top",
    );
    refuses(
      fiveEText,
      level({ track: "exhaustion", at: 4, effects: ["half-move-to-stand"] }),
      /A level cannot have "half-move-to-stand"/,
      "an effect that ends by itself",
    );
    refuses(
      fiveEText,
      level({ track: "exhaustion", at: 4, effects: ["cannot-target-source"] }),
      /A level cannot have "cannot-target-source"/,
      "an effect that needs a source",
    );
    refuses(
      fiveEText,
      level({ track: "exhaustion", at: 1, effects: ["cannot-act"] }),
      /Level 1 of "exhaustion" is given twice/,
      "twice",
    );
    refuses(
      fiveEText,
      level({ track: "exhaustion", at: 0, effects: ["cannot-act"] }),
      /greater than or equal to 1/,
      "level 0",
    );

    // The published schema says the same things to an editor.
    const levelNode = published.properties.combat.properties.levels.items;
    assert.ok(!levelNode.properties.effects.items.enum.includes("half-move-to-stand"));
    assert.ok(levelNode.properties.effects.items.enum.includes("own-checks-disadvantage"));
    const modifierNode = published.properties.combat.properties.conditions.items.properties.modifiers.items;
    assert.deepEqual(modifierNode.allOf[0], {
      anyOf: [{ required: ["flat"] }, { required: ["dice"] }, { required: ["times"] }, { required: ["mode"] }],
    });
    assert.deepEqual(modifierNode.properties.flat.not, { const: 0 });
  }

  // ── The examples ──
  {
    const reference = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
    assert.deepEqual(
      reference.combat!.levels!.map((level) => [level.track, level.at]),
      [
        ["exhaustion", 1],
        ["exhaustion", 2],
        ["exhaustion", 3],
        ["exhaustion", 5],
      ],
    );
    const poisoned = reference.combat!.conditions!.find((entry) => entry.condition === "poisoned")!;
    assert.ok(poisoned.effects.includes("own-checks-disadvantage"));
    assert.deepEqual(
      ember.combat!.levels!.map((level) => [level.track ?? level.derived, level.at, level.modifiers]),
      [
        ["heat", 3, [{ to: "attacks", flat: -1 }]],
        ["heat", 5, [{ to: "speed", times: 0.5 }]],
        [
          "bulk_carried",
          10,
          [
            { to: "speed", flat: -2 },
            { to: "checks", skills: ["sneak"], flat: -1 },
          ],
        ],
      ],
    );
  }

  // ── Defense: a flat change, read where the attack is rolled and where the chance is shown ──
  {
    const state = fight(fiveE, [brenna({ conditions: ["shielded"] }), snag()]);
    const snagTurn = endTurn(fiveE, state, "brenna").state;
    // 18 on the die and +4 is 22: a hit on her own AC 18, and a miss on the 23 Shielded makes it.
    const swing = act(fiveE, snagTurn, { actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 18, 3);
    const attack = firstOf(swing.events, "attack");
    assert.equal(attack.total, 22);
    assert.equal(attack.defense, 23, "18 and the 5 Shielded adds");
    assert.deepEqual(attack.guards, [{ condition: "shielded", value: 5 }]);
    assert.equal(attack.outcome, "miss");
    // The chance an opponent is shown counts it too: +4 needs 19 or more on a d20 against 23.
    const scimitar = rulesetCombatOptions(fiveE, snagTurn, "snag").find((entry) => entry.id === "scimitar")!;
    assert.equal(scimitar.forecast?.hitChance, 0.1);
    const bare = fight(fiveE, [brenna(), snag()]);
    const bareSword = rulesetCombatOptions(fiveE, endTurn(fiveE, bare, "brenna").state, "snag").find(
      (entry) => entry.id === "scimitar",
    )!;
    assert.equal(bareSword.forecast?.hitChance, 0.35, "without it, 14 or more");
  }

  // ── Attacks: dice added, or taken away, after the attack's own dice ──
  {
    const blessed = fight(fiveE, [brenna({ conditions: ["blessed"] }), snag()]);
    const sword = swordOf(fiveE, blessed);
    // A 5 on the d20, +7, and a 3 on the Blessed d4: 15 against 13, a hit. Then the longsword's d8.
    const hit = act(fiveE, blessed, { actorId: "brenna", optionId: sword.id, targetIds: ["snag"] }, 5, 3, 4);
    const attack = firstOf(hit.events, "attack");
    assert.deepEqual(attack.bonuses, [{ condition: "blessed", value: 3, rolls: [3] }]);
    assert.equal(attack.total, 15);
    assert.equal(attack.outcome, "hit");
    // The chance counts every face of the d4: +7 +1d4 against 13 is the average of 14..17 up.
    const expected = [1, 2, 3, 4].reduce((sum, face) => sum + rulesetHitChance(fiveE.combat!, 7 + face, 13)! / 4, 0);
    assert.equal(sword.forecast?.hitChance, Math.round(expected * 1000) / 1000);
    assert.ok(sword.forecast!.hitChance! > rulesetHitChance(fiveE.combat!, 7, 13)!);

    const baned = fight(fiveE, [brenna({ conditions: ["baned"] }), snag()]);
    const missed = act(
      fiveE,
      baned,
      { actorId: "brenna", optionId: swordOf(fiveE, baned).id, targetIds: ["snag"] },
      8,
      3,
    );
    const lessened = firstOf(missed.events, "attack");
    assert.deepEqual(lessened.bonuses, [{ condition: "baned", value: -3, rolls: [3] }]);
    assert.equal(lessened.total, 12, "8 + 7 - 3");
    assert.equal(lessened.outcome, "miss");
    // Both at once: each rolled, in the order the conditions are declared.
    const both = fight(fiveE, [brenna({ conditions: ["blessed", "baned"] }), snag()]);
    const mixed = act(
      fiveE,
      both,
      { actorId: "brenna", optionId: swordOf(fiveE, both).id, targetIds: ["snag"] },
      1,
      4,
      1,
    );
    assert.deepEqual(firstOf(mixed.events, "attack").bonuses, [
      { condition: "blessed", value: 4, rolls: [4] },
      { condition: "baned", value: -1, rolls: [1] },
    ]);
    // With nothing on, the roll is exactly the one it always was.
    const plain = fight(fiveE, [brenna(), snag()]);
    const plainHit = act(
      fiveE,
      plain,
      { actorId: "brenna", optionId: swordOf(fiveE, plain).id, targetIds: ["snag"] },
      5,
      4,
    );
    assert.equal("bonuses" in firstOf(plainHit.events, "attack"), false);
    assert.equal("guards" in firstOf(plainHit.events, "attack"), false);
  }

  // ── Saves: narrowed by `saves`, and Blessed adds to every one ──
  {
    const state = fight(fiveE, [brenna({ conditions: ["steadied", "blessed"] }), snag()]);
    const snagTurn = endTurn(fiveE, state, "brenna").state;
    // Jinx asks for a Dex save against 30: a 10 on the d20, +2 from Blessed's d4, +2 from Steadied
    // (a Dex save), and her own modifier.
    const jinxed = act(fiveE, snagTurn, { actorId: "snag", optionId: "jinx", targetIds: ["brenna"] }, 10, 2);
    const save = firstOf(jinxed.events, "save");
    assert.equal(save.save, "dex_save");
    // In the order the ruleset declares its conditions, whatever order they were put on in.
    assert.deepEqual(save.bonuses, [
      { condition: "blessed", value: 2, rolls: [2] },
      { condition: "steadied", value: 2 },
    ]);
    assert.equal(save.total, 10 + save.modifier + 4);
    // A save Steadied does not name gets only Blessed.
    const modifiers = rulesetConditionModifiers(
      fiveE,
      fiveE.combat!,
      rulesetCombatant(snagTurn, "brenna")!,
      "saves",
      snagTurn,
      "con_save",
    );
    assert.deepEqual(
      modifiers.map((entry) => entry.condition),
      ["blessed"],
    );
  }

  // ── Checks: a contest side leans, and adds ──
  {
    const state = fight(fiveE, [brenna(), snag()]);
    const grapple = rulesetCombatOptions(fiveE, state, "brenna").find((entry) => entry.id === "contest:grapple")!;
    const poisoned = fight(fiveE, [brenna({ conditions: ["poisoned"] }), snag()]);
    const poisonedGrapple = rulesetCombatOptions(fiveE, poisoned, "brenna").find(
      (entry) => entry.id === "contest:grapple",
    )!;
    assert.ok(poisonedGrapple.forecast!.hitChance! < grapple.forecast!.hitChance!, "poison makes a grab harder");
    // Thrown twice, the worse kept: 15 and 4, keeping 4.
    const tried = act(
      fiveE,
      poisoned,
      { actorId: "brenna", optionId: "contest:grapple", targetIds: ["snag"] },
      15,
      4,
      3,
    );
    const contest = firstOf(tried.events, "contest");
    assert.equal(contest.attacker.mode, "disadvantage");
    assert.deepEqual(contest.attacker.rolls, [15, 4]);
    assert.equal(contest.attacker.total, 4 + contest.attacker.modifier);
    assert.equal("mode" in contest.defender, false);

    const braced = fight(fiveE, [brenna({ conditions: ["braced"] }), snag()]);
    const bracedGrapple = rulesetCombatOptions(fiveE, braced, "brenna").find(
      (entry) => entry.id === "contest:grapple",
    )!;
    assert.ok(bracedGrapple.forecast!.hitChance! > grapple.forecast!.hitChance!);
    const won = act(fiveE, braced, { actorId: "brenna", optionId: "contest:grapple", targetIds: ["snag"] }, 5, 12);
    const side = firstOf(won.events, "contest").attacker;
    assert.deepEqual(side.bonuses, [{ condition: "braced", value: 3 }]);
    assert.equal(side.total, 5 + side.modifier + 3);
    // The same chance the menu shows, asked for directly.
    assert.equal(
      Math.round(
        rulesetContestChance(
          fiveE,
          fiveE.combat!,
          rulesetCombatant(braced, "brenna")!,
          rulesetCombatant(braced, "snag")!,
          rulesetCombatant(braced, "brenna")!.actions.find((entry) => entry.id === "contest:grapple")!.contest!,
          braced,
        )! * 1000,
      ) / 1000,
      bracedGrapple.forecast!.hitChance,
    );
  }

  // ── Speed: halved, and back as the turn begins when the clock says so ──
  {
    const board = (placements: Record<string, { x: number; y: number }>) => ({ grid: open(14), placements });
    const slowed = fight(
      fiveE,
      [brenna({ conditions: ["slowed"] }), snag()],
      board({ brenna: { x: 0, y: 1 }, snag: { x: 10, y: 1 } }),
    );
    assert.equal(rulesetMovementAllowance(fiveE, fiveE.combat!, rulesetCombatant(slowed, "brenna")!, slowed), 3);
    assert.equal(rulesetCombatant(slowed, "brenna")!.movement, 3, "30 feet halved is three squares");

    // Snag slows her until the start of her next turn: she walks her whole six squares on it.
    const start = fight(fiveE, [brenna(), snag()], board({ brenna: { x: 0, y: 1 }, snag: { x: 10, y: 1 } }));
    const snagTurn = endTurn(fiveE, start, "brenna").state;
    const slow = act(fiveE, snagTurn, { actorId: "snag", optionId: "slow", targetIds: ["brenna"] });
    assert.deepEqual(
      rulesetCombatant(slow.state, "brenna")!.tracked.find((entry) => entry.condition === "slowed"),
      {
        condition: "slowed",
        rounds: 1,
        clock: "turn-start",
        source: "snag",
      },
    );
    const hers = endTurn(fiveE, slow.state, "snag");
    assert.ok(
      eventsOf(hers.events, "condition").some((event) => event.condition === "slowed" && event.reason === "expired"),
    );
    assert.equal(rulesetCombatant(hers.state, "brenna")!.movementLeft, 6, "the walk is read again once it ran out");

    // Dragged for a round of her OWN turns instead: it holds through the whole of her next turn.
    const drag = act(fiveE, snagTurn, { actorId: "snag", optionId: "drag", targetIds: ["brenna"] });
    const dragged = endTurn(fiveE, drag.state, "snag");
    assert.ok(conditionsOf(dragged.state, "brenna").includes("slowed"));
    assert.equal(rulesetCombatant(dragged.state, "brenna")!.movementLeft, 3);
  }

  // ── One use: the holder's own attack, an attack at the holder, the holder's own save ──
  {
    const state = fight(fiveE, [brenna(), snag()]);
    const snagTurn = endTurn(fiveE, state, "brenna").state;
    const mocked = act(fiveE, snagTurn, { actorId: "snag", optionId: "mock", targetIds: ["brenna"] });
    const back = endTurn(fiveE, mocked.state, "snag").state;
    assert.ok(conditionsOf(back, "brenna").includes("mocked"));
    // Her next attack is at disadvantage, and it is spent by it.
    const swing = act(
      fiveE,
      back,
      { actorId: "brenna", optionId: swordOf(fiveE, back).id, targetIds: ["snag"] },
      18,
      2,
    );
    assert.equal(firstOf(swing.events, "attack").mode, "disadvantage");
    assert.ok(
      eventsOf(swing.events, "condition").some((event) => event.condition === "mocked" && event.reason === "spent"),
    );
    assert.ok(!conditionsOf(swing.state, "brenna").includes("mocked"));

    // Marked, for two of her turns: the next attack AT her has advantage, and then it is gone early.
    const marked = act(fiveE, snagTurn, { actorId: "snag", optionId: "mark", targetIds: ["brenna"] });
    const again = endTurn(fiveE, endTurn(fiveE, marked.state, "snag").state, "brenna").state;
    const struck = act(fiveE, again, { actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 2, 19, 3);
    assert.equal(firstOf(struck.events, "attack").mode, "advantage");
    assert.ok(!conditionsOf(struck.state, "brenna").includes("marked"));

    // A ward that lasts one attack lasts the WHOLE attack: it halves that blow's harm, then it is gone.
    const warded = act(fiveE, snagTurn, { actorId: "snag", optionId: "ward", targetIds: ["brenna"] });
    const wardedAgain = endTurn(fiveE, endTurn(fiveE, warded.state, "snag").state, "brenna").state;
    const cut = act(fiveE, wardedAgain, { actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 15, 6);
    assert.equal(firstOf(cut.events, "attack").outcome, "hit");
    assert.equal(firstOf(cut.events, "damage").dealt, 4, "6 + 2 halved");
    assert.ok(!conditionsOf(cut.state, "brenna").includes("warded"));
    // A blow that marks what it hits uses up the old mark and leaves its own.
    const brandTurn = endTurn(fiveE, endTurn(fiveE, marked.state, "snag").state, "brenna").state;
    const brand = act(fiveE, brandTurn, { actorId: "snag", optionId: "brand", targetIds: ["brenna"] }, 3, 17, 4);
    assert.equal(firstOf(brand.events, "attack").mode, "advantage", "the old mark counted");
    assert.ok(!eventsOf(brand.events, "condition").some((event) => event.reason === "spent"));
    assert.deepEqual(
      rulesetCombatant(brand.state, "brenna")!.tracked.find((entry) => entry.condition === "marked"),
      { condition: "marked", rounds: 2, endsAfter: "attacked", source: "snag" },
      "the new one, with its whole clock",
    );

    // Her own next save spends Steadied, whatever it was for.
    const jinx = act(fiveE, snagTurn, { actorId: "snag", optionId: "jinx", targetIds: ["brenna"] }, 5);
    // The save failed, so Jinx put Steadied on her; the next save she makes takes it off again.
    assert.ok(conditionsOf(jinx.state, "brenna").includes("steadied"));
    const next = act(
      fiveE,
      endTurn(fiveE, endTurn(fiveE, jinx.state, "snag").state, "brenna").state,
      { actorId: "snag", optionId: "jinx", targetIds: ["brenna"] },
      6,
    );
    assert.equal(firstOf(next.events, "save").bonuses?.[0]?.condition, "steadied", "it counted on that save");
    assert.ok(
      eventsOf(next.events, "condition").some((event) => event.condition === "steadied" && event.reason === "spent"),
    );
  }

  // ── Levels: a live track's rungs count as conditions, and add up ──
  {
    const tired = (level: number) => fight(fiveE, [brenna({ tracks: { exhaustion: level } }), snag()]);
    const modeOf = (state: RulesetEncounterState) => {
      const swing = act(
        fiveE,
        state,
        { actorId: "brenna", optionId: swordOf(fiveE, state).id, targetIds: ["snag"] },
        10,
        11,
        4,
      );
      return firstOf(swing.events, "attack").mode;
    };
    assert.equal(modeOf(tired(2)), "normal", "attacks are harder only from level 3");
    assert.equal(modeOf(tired(3)), "disadvantage");
    // Level 1 is harder checks, read at every level above it too.
    const grab = (state: RulesetEncounterState) =>
      firstOf(
        act(fiveE, state, { actorId: "brenna", optionId: "contest:grapple", targetIds: ["snag"] }, 15, 4, 3).events,
        "contest",
      ).attacker.mode;
    assert.equal(grab(tired(1)), "disadvantage");
    assert.equal(grab(tired(4)), "disadvantage");
    // Level 2 halves speed and level 5 takes it away.
    const board = { grid: open(14), placements: { brenna: { x: 0, y: 1 }, snag: { x: 10, y: 1 } } };
    const walk = (level: number) =>
      rulesetCombatant(fight(fiveE, [brenna({ tracks: { exhaustion: level } }), snag()], board), "brenna")!.movement;
    assert.deepEqual([0, 1, 2, 4, 5].map(walk), [6, 6, 3, 3, 0]);
    // The same on the reference as it ships, whose conditions change no number at all: only its
    // levels do, and they are still read.
    const shipped = parsedOrThrow(JSON.parse(fiveEText), "the 5e reference");
    assert.equal(
      rulesetCombatant(fight(shipped, [brenna({ tracks: { exhaustion: 2 } }), snag()], board), "brenna")!.movement,
      3,
    );

    // Ember reads its own Heat the same way, in numbers: -1 to attacks from 3, half speed at 5.
    const juno = (heat: number, conditions: string[] = []): RulesetCombatantInput => ({
      id: "juno",
      name: "Juno",
      side: "party",
      build: rulesetSheetBuildSchema.parse({
        abilities: { brawn: 2, wits: 0, heart: 1 },
        fields: { toughness: 4 },
        lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
      }),
      live: { tracks: { heat }, conditions },
      catalogs: {},
    });
    const hound = (): RulesetCombatantInput => ({
      id: "hound",
      name: "Ash-hound",
      side: "enemy",
      block: {
        health: 6,
        defense: 5,
        initiativeModifier: 0,
        speed: 12,
        actions: [
          { id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 6, flat: 0 }, reach: 2 },
        ],
      },
    });
    const emberFight = (heat: number, conditions: string[] = [], positioned = false) =>
      createRulesetEncounter({
        definition: ember,
        seed: 3,
        combatants: [juno(heat, conditions), hound()],
        roller: dice(6, 6, 1, 1),
        ...(positioned
          ? { board: { grid: open(12), placements: { juno: { x: 0, y: 1 }, hound: { x: 11, y: 1 } } } }
          : {}),
      });
    const axe = (state: RulesetEncounterState) =>
      rulesetCombatOptions(ember, state, "juno").find((entry) => entry.label === "Road axe")!;
    const hot = emberFight(3);
    const blow = firstOf(
      act(ember, hot, { actorId: "juno", optionId: axe(hot).id, targetIds: ["hound"] }, 3, 3, 2).events,
      "attack",
    );
    assert.deepEqual(blow.bonuses, [{ condition: "heat", level: 3, value: -1 }]);
    assert.equal(blow.total, 3 + 3 + blow.modifier - 1);
    assert.equal(
      rulesetBonusDice(rulesetConditionModifiers(ember, ember.combat!, rulesetCombatant(hot, "juno")!, "attacks", hot))
        .flat,
      -1,
    );
    const moves = (heat: number, conditions: string[] = []) =>
      rulesetCombatant(emberFight(heat, conditions, true), "juno")!.movement;
    const base = moves(0);
    assert.ok(base! > 1);
    assert.equal(moves(5), Math.floor(base! / 2), "at 5 the legs go");
    // Wounded is two paces slower, and a pace is half a cell: then halved at 5, after the flat change.
    const speed = rulesetCombatant(emberFight(0, [], true), "juno")!.speed;
    assert.equal(moves(0, ["wounded"]), Math.floor((speed - 2) / 2));
    assert.equal(moves(5, ["wounded"]), Math.floor(((speed - 2) * 0.5) / 2));
    // Wounded is easier to hit, and says so.
    const woundedFight = emberFight(0, ["wounded"]);
    const bitten = act(
      ember,
      endTurn(ember, woundedFight, "juno").state,
      { actorId: "hound", optionId: "bite", targetIds: ["juno"] },
      1,
      1,
      2,
    );
    assert.deepEqual(firstOf(bitten.events, "attack").guards, [{ condition: "wounded", value: -1 }]);
    // A creature in plain numbers has no tracks, so no level reaches it.
    assert.deepEqual(
      rulesetConditionModifiers(ember, ember.combat!, rulesetCombatant(hot, "hound")!, "attacks", hot),
      [],
    );
  }

  // ── What the screen says ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""))) as never;
    const state = fight(fiveE, [brenna({ conditions: ["blessed", "shielded"] }), snag()]);
    const view = {
      combatants: state.combatants.map((combatant) => ({ id: combatant.id, name: combatant.name })),
    } as never;
    const names = rulesetCombatNames(fiveE, view, t);
    const hit = act(
      fiveE,
      state,
      { actorId: "brenna", optionId: swordOf(fiveE, state).id, targetIds: ["snag"] },
      5,
      3,
      4,
    );
    assert.equal(
      rulesetCombatEventLine(firstOf(hit.events, "attack"), names, t),
      "Brenna attacks Snag with Longsword: 5 + 7 + 3 (Blessed) = 15 against Armor Class 13, a hit.",
    );
    const snagTurn = endTurn(fiveE, state, "brenna").state;
    const miss = act(fiveE, snagTurn, { actorId: "snag", optionId: "scimitar", targetIds: ["brenna"] }, 18, 3);
    assert.match(
      rulesetCombatEventLine(firstOf(miss.events, "attack"), names, t),
      /18 \+ 4 = 22 against Armor Class 23 \(Shielded \+ 5\), a miss\./,
    );
    const levelLine = rulesetCombatEventLine(
      { ...firstOf(hit.events, "attack"), bonuses: [{ condition: "exhaustion", level: 3, value: -1 }], total: 11 },
      names,
      t,
    );
    assert.match(levelLine, /\+ 7 - 1 \(Exhaustion 3\) = 11/);
    assert.equal(
      rulesetCombatEventLine(
        { type: "condition", targetId: "brenna", condition: "mocked", active: false, reason: "spent" },
        names,
        t,
      ),
      "Mocked is used up and ends on Brenna.",
    );
  }

  // ── Every new key needs 1.45 to install ──
  {
    assert.ok(supportedCapabilityApi.minor >= 45);
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
      /conditions change numbers or count levels, or end after one use or as a turn begins, requires schemaVersion 2 and capabilityApi 1\.45 or newer/;
    const combat = (combat: Record<string, unknown>) => ({ combat });
    const cases: Array<[string, unknown, Map<string, unknown>?]> = [
      ["levels", combat({ levels: [] })],
      ["modifiers", combat({ conditions: [{ condition: "x", modifiers: [] }] })],
      ["check effects", combat({ conditions: [{ condition: "x", effects: ["own-checks-disadvantage"] }] })],
      [
        "endsAfter inline",
        {
          catalogs: [
            { id: "k", entries: [{ id: "a", mechanics: { applies: [{ condition: "x", endsAfter: "attacked" }] } }] },
          ],
        },
      ],
      [
        "turn-start inline",
        {
          catalogs: [
            {
              id: "k",
              entries: [{ id: "a", mechanics: { applies: [{ duration: { rounds: 1, at: "turn-start" } }] } }],
            },
          ],
        },
      ],
      [
        "a creature's action",
        {
          catalogs: [
            {
              id: "c",
              entries: [{ id: "a", creature: { actions: [{ applies: [{ condition: "x", endsAfter: "own-save" }] }] } }],
            },
          ],
        },
      ],
      [
        "a catalog file",
        { catalogs: [{ id: "k", asset: "catalogs/extra.json" }] },
        new Map<string, unknown>([
          [
            "catalogs/extra.json",
            {
              schemaVersion: 1,
              catalog: "k",
              entries: [{ id: "a", mechanics: { applies: [{ endsAfter: "own-attack" }] } }],
            },
          ],
        ]),
      ],
    ];
    for (const [what, ruleset, assets] of cases) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(44), ruleset as never, assets as never) ?? "",
        issue,
        what,
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(45), ruleset as never, assets as never), null, what);
    }
    // An old effect on a condition is still only what it always needed.
    assert.equal(
      getCapabilityPackageInstallIssue(
        manifest(44),
        combat({ conditions: [{ condition: "x", effects: ["speed-zero"] }] }) as never,
      ),
      null,
    );
  }

  console.info("game ruleset combat condition regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
