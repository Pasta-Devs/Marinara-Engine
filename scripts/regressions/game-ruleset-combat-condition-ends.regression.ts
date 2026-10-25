/**
 * Conditions end when their own sentence says (Capability API 1.125): Charm Person, Dominate
 * Person and Hypnotic Pattern. Harm still resolves in full; damage saves use the applying DC.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetOptionLabel } from "../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-ends-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 120);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    spell("charm", { kind: "debuff", applies: [{ condition: "charmed", duration: { rounds: 10 } }] }),
    spell("dominate", {
      kind: "debuff",
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "dominated", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }],
    }),
    spell("pattern", { kind: "debuff", applies: [{ condition: "stupor", duration: { rounds: 10 } }] }),
    spell("bless", { kind: "buff", targets: "any", applies: [{ condition: "blessed", duration: { rounds: 2 } }] }),
    spell("willing", {
      kind: "buff",
      targets: "any",
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "blessed", duration: { rounds: 2 } }],
    }),
    spell("weapon", {
      kind: "attack",
      autoHit: true,
      amount: { flat: 4 },
      summons: { budget: "bonus", rounds: 10, move: 20, reach: 5 },
    }),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    for (const [id, label] of [
      ["dominated", "Dominated"],
      ["stupor", "Stupor"],
      ["blessed", "Blessed"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.find((entry: any) => entry.condition === "charmed").endsWhen = ["harmed-by-source-side"];
    doc.combat.conditions.push({ condition: "dominated", saveWhenDamaged: true });
    doc.combat.conditions.push({ condition: "stupor", endsWhen: ["damaged"], shakeOff: { budget: "action" } });
    doc.combat.conditions.push({ condition: "blessed", effects: [] });
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(doc);
    assert.equal(parsed.ok, false, "the file should be refused");
    if (!parsed.ok) assert.match(parsed.issues.join("; "), pattern);
  };
  const definition = parsedOrThrow(document());
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
  const block = (actions: RulesetStatBlock["actions"] = []): RulesetStatBlock => ({
    health: 80,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 3 },
    actions,
  });
  const bite = { id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 8 } };
  const fight = (
    rules = definition,
    actions: RulesetStatBlock["actions"] = [bite],
    extra: Partial<RulesetStatBlock> = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      bestiary: { spells: rules.catalogs!.find((entry) => entry.id === "spells")!.entries! },
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 20, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 80, spellcasting_ability: "int" },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: rules.catalogs!.find((entry) => entry.id === "spells")!.entries! },
        },
        { id: "ally", name: "Ally", side: "enemy", block: { ...block(actions), ...extra } },
        { id: "holder", name: "Holder", side: "enemy", block: block([bite]) },
        { id: "friend", name: "Friend", side: "enemy", block: block([bite]) },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] },
        placements: { corwin: { x: 0, y: 0 }, ally: { x: 1, y: 0 }, holder: { x: 2, y: 0 }, friend: { x: 3, y: 0 } },
      },
    });
    rulesetCombatant(state, "ally")!.side = "party";
    return state;
  };
  const who = (state: RulesetEncounterState, id = "holder") => rulesetCombatant(state, id)!;
  const turn = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    return state;
  };
  const give = (state: RulesetEncounterState, condition: string, source = "corwin", target = "holder") => {
    who(state, target).tracked.push({ condition, source, rounds: null });
    return state;
  };
  const has = (state: RulesetEncounterState, condition: string, target = "holder", rules = definition) =>
    rulesetCombatConditions(rules, who(state, target)).includes(condition);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, faces: number[] = [], rules = definition) => {
    const step = applyRulesetCombatChoice(rules, state, choice, dice(...faces));
    assert.deepEqual(eventsOf(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const use = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    faces: number[] = [],
    rules = definition,
    targetIds = ["holder"],
  ) => {
    const option = rulesetCombatOptions(rules, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has ${label}`);
    return act(state, { actorId, optionId: option.id, targetIds }, faces, rules);
  };
  const harm = (condition: string, actions = [bite], faces = [10], source = "corwin") =>
    use(turn(give(fight(definition, actions), condition, source), "ally"), "ally", actions[0]!.name, faces);

  // The full blow lands before the charm ends, including its damage clauses and rider.
  {
    const state = fight();
    const charmed = use(state, "corwin", "charm").state;
    assert.ok(has(charmed, "charmed"), "the charm does not end on its own applies");
    const struck = use(turn(charmed, "ally"), "ally", "Bite", [10]);
    assert.equal(who(struck.state).health!.value, 72);
    assert.equal(has(struck.state, "charmed"), false);
    assert.equal(eventsOf(struck.events, "condition").at(-1)?.reason, "harmed");
    assert.ok(
      struck.events.findIndex((event) => event.type === "damage") <
        struck.events.findIndex((event) => event.type === "condition"),
    );
    const resistant = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions.find((entry: any) => entry.condition === "charmed").effects.push("resist-all");
      }),
    );
    const many = turn(give(fight(resistant), "charmed"), "ally");
    who(many, "ally").actions[0]!.damage!.plus = [{ count: 0, sides: 0, flat: 6 }];
    const compound = use(many, "ally", "Bite", [10], resistant);
    assert.deepEqual(
      eventsOf(compound.events, "damage").map((event) => event.dealt),
      [4, 3],
    );
    assert.equal(has(compound.state, "charmed"), false);
    assert.equal(has(harm("charmed", [bite], [10], "friend").state, "charmed"), true, "the other side leaves it");
    assert.equal(has(harm("charmed", [bite], [1]).state, "charmed"), false, "a harmful miss still ends a charm");
    const caster = give(fight(), "charmed");
    assert.equal(has(use(caster, "corwin", "bless").state, "charmed"), true, "a helpful applies is not harm");
    assert.equal(
      has(use(give(fight(), "charmed"), "corwin", "pattern").state, "charmed"),
      false,
      "a debuff without damage is harm",
    );
    assert.equal(
      has(
        harm(
          "charmed",
          [
            {
              id: "glare",
              name: "Glare",
              budget: "action",
              save: { save: "wis_save", difficulty: 16, onSuccess: "negates" },
            } as any,
          ],
          [20],
        ).state,
        "charmed",
      ),
      false,
    );
    assert.equal(
      has(use(give(fight(), "charmed"), "corwin", "willing", [1]).state, "charmed"),
      true,
      "a buff is not a harmful catalog action even when it asks for a save",
    );
    const refreshed = use(give(fight(), "charmed"), "corwin", "charm");
    assert.ok(has(refreshed.state, "charmed"), "a replacement charm is not the old condition ending");
    assert.equal(
      has(
        harm("charmed", [{ id: "touch", name: "Touch", budget: "action", damage: { flat: 0 } }] as any, []).state,
        "charmed",
      ),
      false,
    );
    assert.equal(
      has(
        harm(
          "charmed",
          [
            { id: "hold", name: "Hold", budget: "action", applies: [{ condition: "stupor", duration: "instant" }] },
          ] as any,
          [],
        ).state,
        "charmed",
      ),
      false,
    );
    const missing = give(fight(), "charmed", "gone");
    assert.equal(has(use(turn(missing, "ally"), "ally", "Bite", [10]).state, "charmed"), true);
  }

  // Any positive damage ends the stupor, including from its own side; a miss or zero does not.
  {
    assert.equal(has(harm("stupor").state, "stupor"), false);
    assert.equal(has(harm("stupor", [bite], [1]).state, "stupor"), true);
    assert.equal(has(harm("stupor", [{ ...bite, damage: { flat: 0 } }]).state, "stupor"), true);
    const ownSide = turn(give(fight(), "stupor"), "friend");
    who(ownSide, "friend").actions[0]!.targets.side = "any";
    assert.equal(has(use(ownSide, "friend", "Bite", [10]).state, "stupor"), false);
    const immune = turn(give(fight(), "stupor"), "ally");
    who(immune).block!.immune = ["fire"];
    who(immune, "ally").actions[0]!.damage!.type = "fire";
    assert.equal(has(use(immune, "ally", "Bite", [10]).state, "stupor"), true);
  }

  // The applying action supplies the save and DC, not the damaging action or a new default.
  {
    for (const [face, remains] of [
      [9, true],
      [10, false],
    ] as const) {
      const applied = use(fight(), "corwin", "dominate", [1]);
      const tracked = who(applied.state).tracked.find((entry) => entry.condition === "dominated")!;
      assert.equal(tracked.difficulty, 13);
      assert.deepEqual(tracked.saveEnds, { save: "wis_save", at: "turn-end" });
      const hit = use(turn(JSON.parse(JSON.stringify(applied.state)), "ally"), "ally", "Bite", [10, face]);
      assert.equal(has(hit.state, "dominated"), remains);
      const [save] = eventsOf(hit.events, "save");
      assert.deepEqual(
        [save?.save, save?.difficulty, save?.sourceId, save?.success],
        ["wis_save", 13, "corwin", !remains],
      );
      assert.equal(who(hit.state).health!.value, 72);
      assert.equal(eventsOf(hit.events, "condition").filter((event) => !event.active).length, remains ? 0 : 1);
    }
    assert.deepEqual(eventsOf(harm("dominated").events, "save"), [], "no stored save rolls nothing");
    const noSave = give(fight(), "dominated");
    who(noSave).tracked[0]!.difficulty = 13;
    assert.deepEqual(eventsOf(use(turn(noSave, "ally"), "ally", "Bite", [10]).events, "save"), []);
    const noDc = give(fight(), "dominated");
    who(noDc).tracked[0]!.saveEnds = { save: "wis_save", at: "turn-end" };
    assert.deepEqual(eventsOf(use(turn(noDc, "ally"), "ally", "Bite", [10]).events, "save"), []);
    for (const [damage, faces] of [
      [0, [10]],
      [8, [1]],
    ] as const) {
      const state = use(fight(definition, [{ ...bite, damage: { flat: damage } }]), "corwin", "dominate", [1]).state;
      assert.deepEqual(eventsOf(use(turn(state, "ally"), "ally", "Bite", [...faces]).events, "save"), []);
    }
  }

  // One menu option per nearby ally and condition; its own budget is spent exactly once.
  {
    const state = turn(give(fight(), "stupor"), "friend");
    const id = "shake:stupor@holder";
    const offered = (state: RulesetEncounterState, actor = "friend", rules = definition) =>
      rulesetCombatOptions(rules, state, actor).filter((option) => option.id.startsWith("shake:"));
    const [option] = offered(state);
    assert.equal(option?.id, id);
    assert.equal(option?.budget, "action");
    assert.equal(option?.label, "Shake Holder out of Stupor");
    const t = ((key: string, values: any) => `${key}:${values.name}:${values.condition}`) as any;
    assert.equal(rulesetOptionLabel(option as any, t), "game.combat.ruleset.menu.shakeOff:Holder:Stupor");
    const shaken = act(JSON.parse(JSON.stringify(state)), { actorId: "friend", optionId: id, targetIds: [] });
    assert.equal(has(shaken.state, "stupor"), false);
    assert.equal(who(shaken.state, "friend").budgets.action, 0);
    assert.equal(eventsOf(shaken.events, "condition")[0]?.reason, "shaken");
    assert.deepEqual(offered(shaken.state), []);
    for (const alter of [
      (s: RulesetEncounterState) => {
        who(s, "friend").budgets.action = 0;
      },
      (s: RulesetEncounterState) => {
        who(s, "friend").x = 4;
      },
      (s: RulesetEncounterState) => {
        who(s, "friend").side = "party";
      },
      (s: RulesetEncounterState) => {
        who(s, "friend").down = true;
      },
      (s: RulesetEncounterState) => {
        give(s, "stunned", "corwin", "friend");
      },
      (s: RulesetEncounterState) => {
        turn(s, "ally");
      },
    ]) {
      const unavailable = structuredClone(state);
      alter(unavailable);
      assert.deepEqual(offered(unavailable), []);
      assert.equal(
        eventsOf(
          applyRulesetCombatChoice(definition, unavailable, { actorId: "friend", optionId: id, targetIds: [] }, dice())
            .events,
          "refused",
        ).length,
        1,
      );
    }
    assert.deepEqual(offered(turn(structuredClone(state), "holder"), "holder"), [], "not oneself");
    const bonus = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions.find((entry: any) => entry.condition === "stupor").shakeOff.budget = "bonus";
        doc.combat.conditions.find((entry: any) => entry.condition === "dominated").shakeOff = { budget: "bonus" };
      }),
    );
    const several = turn(
      give(
        give(give(fight(bonus), "stupor", "holder", "corwin"), "dominated", "holder", "corwin"),
        "stupor",
        "holder",
        "friend",
      ),
      "ally",
    );
    who(several, "friend").side = "party";
    who(several, "friend").x = 2;
    assert.deepEqual(
      offered(several, "ally", bonus)
        .map((option) => option.id)
        .sort(),
      ["shake:dominated@corwin", "shake:stupor@corwin", "shake:stupor@friend"],
    );
    const freed = act(several, { actorId: "ally", optionId: "shake:stupor@corwin", targetIds: [] }, [], bonus);
    assert.equal(who(freed.state, "ally").budgets.bonus, 0);
    assert.equal(who(freed.state, "ally").budgets.action, 1);
    assert.equal(has(freed.state, "stupor", "corwin", bonus), false);
    assert.equal(has(freed.state, "dominated", "corwin", bonus), true);
    assert.equal(has(freed.state, "stupor", "friend", bonus), true);
    const longer = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions.find((entry: any) => entry.condition === "stupor").shakeOff.reach = 10;
      }),
    );
    const distant = structuredClone(state);
    who(distant, "friend").x = 4;
    assert.equal(offered(distant, "friend", longer).length, 1, "ten feet is two cells");
    who(distant, "friend").x = 5;
    assert.equal(offered(distant, "friend", longer).length, 0);
    delete distant.board;
    assert.equal(offered(distant, "friend", longer).length, 1, "no board measures no distance");
  }

  // Areas, reactions and the summoned weapon all use the same damage and targeting paths.
  {
    const area = {
      id: "burst",
      name: "Burst",
      budget: "action",
      damage: { flat: 6 },
      save: { save: "wis_save", difficulty: 16, onSuccess: "half" },
      range: 60,
      area: { shape: "burst", size: 5 },
    } as const;
    const state = turn(give(give(fight(definition, [area]), "charmed"), "stupor"), "ally");
    const option = rulesetCombatOptions(definition, state, "ally").find((one) => one.label === "Burst")!;
    const hit = act(state, { actorId: "ally", optionId: option.id, targetIds: [], at: { x: 2, y: 0 } }, [1, 1, 1, 1]);
    assert.equal(has(hit.state, "charmed"), false);
    assert.equal(has(hit.state, "stupor"), false);
    assert.ok(eventsOf(hit.events, "damage").some((event) => event.targetId === "holder" && event.dealt === 6));

    const reacting = give(
      give(fight(definition, [{ ...bite, budget: "reaction", reaction: { on: "aimed" } }]), "charmed"),
      "stupor",
    );
    turn(reacting, "holder");
    const held = use(reacting, "holder", "Bite", [], definition, ["ally"]);
    assert.ok(held.state.window);
    const answer = rulesetWindowOptions(definition, held.state, "ally").find((one) => one.label === "Bite");
    assert.ok(answer);
    const answered = act(
      held.state,
      { actorId: "ally", optionId: answer.id, targetIds: [], window: held.state.window.id },
      [10, 10],
    );
    assert.equal(has(answered.state, "charmed"), false);
    assert.equal(has(answered.state, "stupor"), false);
    assert.equal(who(answered.state).health!.value, 72);

    const summoned = use(fight(), "corwin", "weapon").state;
    give(give(summoned, "charmed"), "stupor");
    const strike = rulesetCombatOptions(definition, summoned, "corwin").find((one) => one.id.startsWith("summon:"));
    assert.ok(strike);
    const struck = act(JSON.parse(JSON.stringify(summoned)), {
      actorId: "corwin",
      optionId: strike.id,
      targetIds: ["holder"],
    });
    assert.equal(has(struck.state, "charmed"), false);
    assert.equal(has(struck.state, "stupor"), false);
    assert.equal(eventsOf(struck.events, "damage")[0]?.dealt, 4);
  }

  // A rider is damage too; a second amount repeats a failed ending save. An immediate damage
  // ending changes the next amount, whereas a source-side ending waits for the complete blow.
  {
    const state = use(fight(), "corwin", "dominate", [1]).state;
    give(state, "stupor");
    const actor = who(state, "ally");
    actor.actions[0]!.damage!.flat = 0;
    actor.riders = [
      { id: "sting", label: "Sting", on: "hit", oncePer: "turn", amount: { count: 0, sides: 0, flat: 3 } },
    ];
    const hit = use(turn(state, "ally"), "ally", "Bite", [10, 10]);
    assert.deepEqual(
      eventsOf(hit.events, "damage").map((event) => event.dealt),
      [0, 3],
    );
    assert.equal(has(hit.state, "stupor"), false);
    assert.equal(has(hit.state, "dominated"), false);
    const repeated = use(fight(), "corwin", "dominate", [1]).state;
    who(repeated, "ally").actions[0]!.damage!.plus = [{ count: 0, sides: 0, flat: 3 }];
    const twice = use(turn(repeated, "ally"), "ally", "Bite", [10, 9, 10]);
    assert.deepEqual(
      eventsOf(twice.events, "save").map((save) => [save.difficulty, save.success]),
      [
        [13, false],
        [13, true],
      ],
    );
    const immediate = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions.find((entry: any) => entry.condition === "stupor").effects = ["resist-all"];
      }),
    );
    const amounts = give(fight(immediate), "stupor");
    who(amounts, "ally").actions[0]!.damage!.plus = [{ count: 0, sides: 0, flat: 6 }];
    assert.deepEqual(
      eventsOf(use(turn(amounts, "ally"), "ally", "Bite", [10], immediate).events, "damage").map(
        (event) => event.dealt,
      ),
      [4, 6],
    );
  }

  // A held hit keeps the charm until the answer and then the blow have both resolved.
  {
    const state = turn(give(fight(), "charmed"), "ally");
    who(state).actions.push({
      id: "mend",
      label: "Mend",
      kind: "block",
      budget: "reaction",
      targets: { side: "self", count: 0 },
      reaction: { on: "hit", at: "source" },
      heal: { count: 0, sides: 0, flat: 1 },
    });
    const held = use(state, "ally", "Bite", [10]);
    assert.equal(held.state.window?.trigger.kind, "hit");
    assert.equal(has(held.state, "charmed"), true);
    const answer = rulesetWindowOptions(definition, held.state, "holder").find((entry) => entry.id === "mend")!;
    assert.ok(answer);
    const resumed = act(JSON.parse(JSON.stringify(held.state)), {
      actorId: "holder",
      optionId: answer.id,
      targetIds: [],
      window: held.state.window!.id,
    });
    assert.equal(who(resumed.state).health!.value, 72);
    assert.equal(has(resumed.state, "charmed"), false);
  }

  // Innate spells and falls use the same hooks as ordinary actions.
  {
    const innate = turn(
      give(
        give(
          fight(definition, [bite], {
            spellcasting: { spells: [{ entry: "spells/weapon" }], saveDifficulty: 15, toHit: 4 },
          }),
          "charmed",
        ),
        "stupor",
      ),
      "ally",
    );
    const cast = use(innate, "ally", "weapon");
    assert.equal(has(cast.state, "charmed"), false);
    assert.equal(has(cast.state, "stupor"), false);
    const falling = parsedOrThrow(
      document((doc) => {
        doc.combat.elevation = {
          levelHeight: 5,
          falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
        };
      }),
    );
    const state = turn(give(give(fight(falling), "charmed"), "stupor"), "ally");
    who(state, "friend").x = 7;
    state.board!.grid.elevation = [[4, 4, 4, ...Array(9).fill(0)]];
    const fell = use(state, "ally", "Shove away", [18, 1, 3, 4], falling);
    assert.equal(eventsOf(fell.events, "damage")[0]?.label, "fall");
    assert.equal(eventsOf(fell.events, "damage")[0]?.dealt, 7);
    assert.equal(has(fell.state, "charmed"), false);
    assert.equal(has(fell.state, "stupor"), false);
    const pending = turn(give(give(fight(falling), "charmed"), "stupor"), "ally");
    pending.pendingFalls = [{ actorId: "ally", targetId: "holder", levels: 4 }];
    const landed = use(pending, "ally", "dodge", [3, 4], falling, []);
    assert.equal(has(landed.state, "charmed"), false);
    assert.equal(has(landed.state, "stupor"), false);
  }

  // An old saved fight without these keys gives the same state, events and dice cursor.
  {
    const old = parsedOrThrow(
      document((doc) => {
        for (const condition of doc.combat.conditions) {
          delete condition.endsWhen;
          delete condition.saveWhenDamaged;
          delete condition.shakeOff;
        }
      }),
    );
    const state = turn(give(give(fight(old), "charmed"), "stupor"), "ally");
    const choice = { actorId: "ally", optionId: who(state, "ally").actions[0]!.id, targetIds: ["holder"] };
    for (const actor of state.combatants) for (const action of actor.actions) delete action.harmful;
    const saved = JSON.parse(JSON.stringify(state));
    const step = act(saved, choice, [10], old);
    assert.deepEqual(step, act(state, choice, [10], old));
    assert.deepEqual(eventsOf(step.events, "condition"), []);
    assert.equal(has(step.state, "charmed", "holder", old), true);
    assert.equal(has(step.state, "stupor", "holder", old), true);
    assert.equal(step.state.cursor, state.cursor + 1);
    assert.equal(who(step.state).health!.value, 72);
  }

  // Import refuses malformed endings, flags and budgets; both ending triggers may be combined.
  {
    const withKeys = (keys: Record<string, unknown>) =>
      document((doc) => {
        Object.assign(
          doc.combat.conditions.find((entry: any) => entry.condition === "stupor"),
          keys,
        );
      });
    for (const value of [
      [],
      ["damaged", "damaged"],
      ["damaged", "harmed-by-source-side", "damaged"],
      ["hit"],
      "damaged",
    ]) {
      refused(withKeys({ endsWhen: value }), /endsWhen|unique/);
    }
    refused(
      withKeys({ endsWhen: ["damaged", "harmed-by-source-side", "attacked", "ally-harmed-in-sight", "damaged"] }),
      /endsWhen: Too big: expected array to have <=4 items/,
    );
    refused(withKeys({ shakeOff: {} }), /shakeOff\.budget: Invalid input: expected string, received undefined/);
    for (const value of [false, "true", 1, null]) refused(withKeys({ saveWhenDamaged: value }), /saveWhenDamaged/);
    for (const value of [
      {},
      { budget: "missing" },
      { budget: "action", reach: 0 },
      { budget: "action", reach: -1 },
      { budget: "action", reach: 10001 },
      { budget: "action", reach: "5" },
      { budget: "action", extra: true },
    ]) {
      refused(withKeys({ shakeOff: value }), /shakeOff|missing|Unrecognized/);
    }
    const both = parsedOrThrow(withKeys({ endsWhen: ["damaged", "harmed-by-source-side"], saveWhenDamaged: true }));
    assert.deepEqual(both.combat!.conditions!.find((entry) => entry.condition === "stupor")!.endsWhen, [
      "damaged",
      "harmed-by-source-side",
    ]);
    const editor = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    const condition = editor.properties.combat.properties.conditions.items.properties;
    assert.deepEqual(condition.endsWhen.items.enum, [
      "damaged",
      "harmed-by-source-side",
      "attacked",
      "ally-harmed-in-sight",
    ]);
    assert.equal(condition.endsWhen.minItems, 1);
    assert.equal(condition.endsWhen.maxItems, 4);
    assert.equal(condition.endsWhen.uniqueItems, true);
    assert.equal(condition.saveWhenDamaged.const, true);
    assert.deepEqual(condition.shakeOff.required, ["budget"]);
    assert.equal(condition.shakeOff.additionalProperties, false);
    assert.equal(condition.shakeOff.properties.reach.exclusiveMinimum, 0);
    assert.equal(condition.shakeOff.properties.reach.maximum, 10000);
  }

  // Each key requires 1.125, including an old manifest; unchanged files need no new API.
  {
    const manifest = (minor: number, schemaVersion = 2) => ({
      schemaVersion,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-condition-ends",
      name: "Condition endings",
      version: "0.1.0",
      description: "A packaged ruleset whose conditions end on harm.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset whose conditions end on harm, a new save or being shaken out requires schemaVersion 2 and capabilityApi 1.125 or newer";
    for (const keys of [{ endsWhen: ["damaged"] }, { saveWhenDamaged: true }, { shakeOff: { budget: "action" } }]) {
      const doc = JSON.parse(fiveEText);
      Object.assign(doc.combat.conditions[0], keys);
      assert.equal(getCapabilityPackageInstallIssue(manifest(124) as any, doc), gate);
      assert.equal(getCapabilityPackageInstallIssue(manifest(125) as any, doc), null);
    }
    const legacy = JSON.parse(fiveEText);
    Object.assign(legacy.combat.conditions[0], { endsWhen: ["damaged"] });
    assert.match(getCapabilityPackageInstallIssue(manifest(125, 1) as any, legacy) ?? "", /requires schemaVersion 2/);
    assert.equal(getCapabilityPackageInstallIssue(manifest(124) as any, JSON.parse(fiveEText)), null);
  }
  console.log("Condition endings: harm, damage saves and an ally's shake-off, gated at 1.125.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
