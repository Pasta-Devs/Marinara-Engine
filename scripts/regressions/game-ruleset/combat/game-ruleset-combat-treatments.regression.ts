/**
 * Treatments and wounds only a rest closes (Capability API 1.193).
 *
 *   - A contest rolled against a fixed `difficulty`: nobody rolls against the actor, who wins on
 *     meeting it. 5e's DC 15 Wisdom (Medicine) check that closes a sword of wounding's wounds.
 *   - `targets`: the other side, the actor's own, or anybody, the actor included.
 *   - `targetHolds` and `targetDying`: offered only on the wounded, or the dying not yet stable.
 *   - `onWin.stabilizes`: the DC 10 Medicine check that keeps the dying from dying.
 *   - An item attack's and a condition's harm `healedOnlyByRest`: hit points they take are sealed, no
 *     heal lifts past them, and any rest gives them back.
 *   - The director treats a friend, the log line, import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetContestChance,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-treatments-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, syncRulesetCombatants, rulesetDirectorStage } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { rulesetCombatEventLine, rulesetCombatNames } =
  await import("../../../../packages/client/src/lib/ruleset-combat-log.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 188);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const treat = {
    id: "treat",
    label: "Treat wounds",
    budget: "action",
    attacker: { checks: ["medicine"] },
    difficulty: 15,
    targets: "any",
    targetHolds: "wounded",
    onWin: { ends: [{ condition: "wounded", on: "target" }] },
  };
  const steady = {
    id: "steady",
    label: "Steady",
    budget: "action",
    attacker: { checks: ["medicine"] },
    difficulty: 10,
    targets: "ally",
    targetDying: true,
    onWin: { stabilizes: true },
  };
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.sheet.live.conditions.push({ id: "wounded", label: "Wounded" });
    doc.combat.conditions.push({
      condition: "wounded",
      harms: { at: "turn-start", dice: "1d4", type: "necrotic", healedOnlyByRest: true },
    });
    doc.combat.checks.push({ id: "medicine", label: "Medicine", value: { skillMod: "medicine" } });
    doc.combat.contests.push(treat, steady);
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parse(document());
  // Wisdom 16: Medicine +3.
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
  });
  const weapon = (name: string, attack: Record<string, unknown>) =>
    ({
      name,
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        attack: {
          budget: "action",
          toHit: { abilities: ["str"] },
          damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
          ...attack,
        },
      } as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const wounding = weapon("Wounding", { healedOnlyByRest: true });
  const plain = weapon("Plain", {});
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 30,
      defense: 5,
      initiativeModifier: -20,
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  let d20 = 12;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (items: RulesetSheetItem[] = []) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items },
        { id: "friend", name: "Friend", side: "party", build },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
  const targetsOf = (state: RulesetEncounterState, label: string) => {
    const option = optionOf(state, label);
    return option ? rulesetOptionTargets(definition, state, "hero", option).sort() : [];
  };
  const act = (state: RulesetEncounterState, label: string, target: string) => {
    who(state, "hero").budgets.action = 1;
    const option = optionOf(state, label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: [target] },
      roller,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const wound = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.push({ condition: "wounded", source: "foe", rounds: null });
  const holds = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.some((entry) => entry.condition === "wounded");
  const contestOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "contest");
    assert.ok(event && event.type === "contest");
    return event;
  };
  const dying = (state: RulesetEncounterState, id: string) => {
    Object.assign(who(state, id), { down: true, dying: true, stable: false });
  };

  // ── Treating the wounded: a DC 15 Medicine check, the actor's own side or the actor ──
  {
    const state = fight();
    assert.deepEqual(targetsOf(state, "Treat wounds"), [], "nobody holds a wound");
    wound(state, "friend");
    wound(state, "foe");
    assert.deepEqual(targetsOf(state, "Treat wounds"), ["foe", "friend"], "anybody wounded");
    wound(state, "hero");
    assert.deepEqual(targetsOf(state, "Treat wounds"), ["foe", "friend", "hero"], "the actor too");
    d20 = 12;
    const won = contestOf(act(state, "Treat wounds", "friend"));
    // 12 + 3 meets 15, and nobody threw against it.
    assert.equal(won.attacker.total, 15);
    assert.equal(won.defender.total, 15);
    assert.deepEqual(won.defender.rolls, []);
    assert.equal(won.difficulty, 15);
    assert.equal("escapeDc" in won, false, "not an escape");
    assert.equal(won.winner, "actor");
    assert.equal(holds(state, "friend"), false, "the wounds closed");
    assert.equal(holds(state, "hero"), true, "on the one treated only");
    d20 = 11;
    const lost = contestOf(act(state, "Treat wounds", "hero"));
    assert.equal(lost.winner, "target", "one short");
    assert.equal(holds(state, "hero"), true);
    d20 = 12;
    act(state, "Treat wounds", "hero");
    assert.equal(holds(state, "hero"), false, "on oneself");
    // The chance reads the number too: 15 on 1d20 + 3 is 9 in 20.
    const contest = who(state, "hero").actions.find((entry) => entry.id === "contest:treat")!.contest!;
    const chance = rulesetContestChance(definition, definition.combat!, who(state, "hero"), who(state, "foe"), contest);
    assert.ok(Math.abs(chance! - 0.45) < 1e-9, String(chance));
    // The log says it as a check against a number, in the English the app ships.
    const en = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../../packages/client/src/localization/locales/en.json", import.meta.url)),
        "utf8",
      ),
    );
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      String(en[key]).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name]))) as never;
    const names = rulesetCombatNames(definition, { combatants: state.combatants } as never, t);
    assert.equal(
      rulesetCombatEventLine(won as never, names, t),
      "Hero tries Treat wounds on Friend: 12 + 3 = 15 with Medicine against DC 15, and succeeds.",
    );
    assert.equal(
      rulesetCombatEventLine(lost as never, names, t),
      "Hero tries Treat wounds on Hero: 11 + 3 = 14 with Medicine against DC 15, and fails.",
    );
  }

  // ── Steadying the dying: a DC 10 Medicine check, on the actor's own side ──
  {
    const state = fight();
    assert.deepEqual(targetsOf(state, "Steady"), [], "nobody is dying");
    dying(state, "friend");
    assert.deepEqual(targetsOf(state, "Steady"), ["friend"]);
    dying(state, "foe");
    assert.deepEqual(targetsOf(state, "Steady"), ["friend"], "never the other side");
    // Nobody left standing on the other side would end the fight.
    Object.assign(who(state, "foe"), { down: false, dying: false });
    d20 = 6;
    act(state, "Steady", "friend");
    assert.equal(who(state, "friend").stable, false, "9 misses 10");
    d20 = 7;
    const events = act(state, "Steady", "friend");
    assert.equal(who(state, "friend").stable, true);
    assert.ok(events.some((one) => one.type === "stabilized" && one.targetId === "friend" && one.sourceId === "hero"));
    assert.deepEqual(targetsOf(state, "Steady"), [], "a stable one needs no more");
    const steadied = fight();
    Object.assign(who(steadied, "friend"), { down: true, dying: true, stable: true });
    assert.deepEqual(targetsOf(steadied, "Steady"), [], "nor one already stable, however it got there");
    // Treating a wound is not steadying the dying.
    const both = fight();
    dying(both, "friend");
    wound(both, "friend");
    d20 = 20;
    assert.ok(!act(both, "Treat wounds", "friend").some((one) => one.type === "stabilized"));
    assert.equal(who(both, "friend").stable, false);
    // A grapple still goes to the other side.
    assert.deepEqual(targetsOf(fight(), "Grapple"), ["foe"]);
  }

  // ── Wounds only a rest closes: on a stat block ──
  {
    d20 = 12;
    const cut = fight([wounding, plain]);
    act(cut, "Wounding", "foe");
    // 2 on the d8, +3 Strength.
    assert.equal(who(cut, "foe").health!.value, 25);
    assert.equal(who(cut, "foe").health!.sealed, 5);
    act(cut, "Plain", "foe");
    assert.equal(who(cut, "foe").health!.value, 20);
    assert.equal(who(cut, "foe").health!.sealed, 5, "a plain blow seals nothing");
    const foe = who(cut, "foe");
    foe.actions.push({
      id: "mend",
      label: "Mend",
      kind: "block",
      budget: "action",
      targets: { side: "self", count: 1 },
      heal: { count: 0, sides: 0, flat: 100 },
    } as never);
    cut.turn = cut.order.indexOf("foe");
    foe.budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      cut,
      { actorId: "foe", optionId: "mend", targetIds: ["foe"] },
      roller,
    );
    assert.ok(
      step.events.some((one) => one.type === "heal"),
      JSON.stringify(step.events),
    );
    assert.equal(rulesetCombatant(step.state, "foe")!.health!.value, 25, "healed up to the seal");
    // Temporary points are a buffer, not hit points lost.
    const buffered = fight([wounding]);
    who(buffered, "foe").health!.temp = 3;
    act(buffered, "Wounding", "foe");
    assert.equal(who(buffered, "foe").health!.value, 28);
    assert.equal(who(buffered, "foe").health!.sealed, 2);
    // A wound's own harm seals too, as its holder's turn starts: 2 on the d4.
    const harmed = fight();
    wound(harmed, "foe");
    harmed.turn = harmed.order.indexOf("friend");
    const ended = applyRulesetCombatChoice(
      definition,
      harmed,
      { actorId: "friend", optionId: "end-turn", targetIds: [] },
      roller,
    );
    assert.ok(ended.events.some((one) => one.type === "damage" && one.targetId === "foe"));
    assert.equal(rulesetCombatant(ended.state, "foe")!.health!.value, 28);
    assert.equal(rulesetCombatant(ended.state, "foe")!.health!.sealed, 2, "what the wound took is sealed");
  }

  // ── Wounds only a rest closes: on a sheet ──
  {
    const hp = (stored: unknown) => readRulesetLive(definition, build, stored).pools.find((pool) => pool.key === "hp")!;
    const apply = (stored: unknown, op: Parameters<typeof applyRulesetSheetOp>[3]) => {
      const result = applyRulesetSheetOp(definition, build, stored, op);
      assert.ok(result.ok, result.ok ? "" : result.reason);
      return result.live;
    };
    let live: unknown = apply({}, { op: "damage", pool: "hp", amount: 10, seals: true });
    assert.equal(hp(live).value, 30);
    assert.equal(hp(live).sealed, 10);
    live = apply(live, { op: "damage", pool: "hp", amount: 5 });
    assert.equal(hp(live).sealed, 10, "a plain blow seals nothing");
    live = apply(live, { op: "restore", pool: "hp", amount: 100 });
    assert.equal(hp(live).value, 30, "healed up to the seal");
    live = apply(live, { op: "rest", rest: "short" });
    assert.equal(hp(live).sealed, 0, "any rest gives it back");
    live = apply(live, { op: "restore", pool: "hp", amount: 100 });
    assert.equal(hp(live).value, 40);
    // Never more sealed than the pool holds, and never more than was lost.
    live = apply({}, { op: "temp", pool: "hp", amount: 4 });
    live = apply(live, { op: "damage", pool: "hp", amount: 10, seals: true });
    assert.equal(hp(live).sealed, 6, "the buffer is not hit points lost");
    live = apply(live, { op: "damage", pool: "hp", amount: 100, seals: true });
    assert.equal(hp(live).sealed, 40);
    // In a fight, a sheet's hit points are sealed through the same op: a wound on the hero, whose
    // turn comes round.
    const sheetHarmed = fight();
    wound(sheetHarmed, "hero");
    sheetHarmed.turn = sheetHarmed.order.indexOf("foe");
    const round = applyRulesetCombatChoice(
      definition,
      sheetHarmed,
      { actorId: "foe", optionId: "end-turn", targetIds: [] },
      roller,
    );
    assert.ok(round.events.some((one) => one.type === "damage" && one.targetId === "hero"));
    const heroHp = hp(rulesetCombatant(round.state, "hero")!.sheet!.live);
    assert.equal(heroHp.value, 38);
    assert.equal(heroHp.sealed, 2);
  }

  // ── The director treats a friend ──
  {
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 40,
      maxHp: 40,
      attack: 5,
      defense: 12,
      speed: 30,
      level: 1,
      skills: [],
    });
    const directed = (
      setup: (encounter: RulesetEncounterState) => void,
      using = definition,
      given?: RulesetEncounterState,
    ) => {
      const encounter = given ?? fight();
      if (!given) {
        who(encounter, "hero").actions = who(encounter, "hero").actions.filter(
          (entry) => entry.id === "contest:treat" || entry.id === "contest:steady",
        );
      }
      setup(encounter);
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("hero", "player"), unit("friend", "player")],
        enemies: [unit("foe", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 1,
      } as never);
      state.rulesetFight = {
        encounter,
        eventSeq: 0,
        events: [],
        controllers: { hero: "ai", friend: "manual" },
        bosses: [],
        adjustments: [],
      };
      syncRulesetCombatants(using, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(commandRulesetCombatDirector(using, state, { type: "continue" }).ok);
      return state.rulesetFight.events.map((entry) => entry.event);
    };
    d20 = 12;
    assert.ok(
      directed((encounter) => dying(encounter, "friend")).some(
        (one) => one.type === "contest" && one.optionId === "contest:steady" && one.targetId === "friend",
      ),
      "steadies a dying friend",
    );
    assert.ok(
      directed((encounter) => {
        wound(encounter, "friend");
        wound(encounter, "foe");
      }).some((one) => one.type === "contest" && one.optionId === "contest:treat" && one.targetId === "friend"),
      "treats a friend, not the foe",
    );
    // A contest that holds whoever loses is never taken on a friend, even one any side may be.
    const bindDefinition = parse(
      document((doc) => {
        // Nobody to help, so a bind on a friend would be what it picks.
        doc.combat.standard = doc.combat.standard.filter((id: string) => id !== "help");
        doc.combat.contests.push({
          id: "bind",
          label: "Bind",
          budget: "action",
          attacker: { checks: ["might"] },
          defender: { checks: ["might"] },
          targets: "any",
          onWin: { applies: [{ condition: "restrained" }] },
        });
      }),
    );
    const bound = createRulesetEncounter({
      definition: bindDefinition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build },
        { id: "friend", name: "Friend", side: "party", build },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    who(bound, "hero").actions = who(bound, "hero").actions.filter((entry) => entry.id === "contest:bind");
    who(bound, "foe").tracked.push({ condition: "restrained", source: "hero", rounds: null });
    assert.ok(
      !directed(() => {}, bindDefinition, bound).some((one) => one.type === "contest" && one.targetId === "friend"),
      "never binds a friend",
    );
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => doc.combat.contests.push({ ...treat, id: "both", defender: { checks: ["might"] } })),
      /"defender" or a fixed "difficulty"/,
    );
    refused(
      document((doc) => {
        const { difficulty: _difficulty, ...none } = treat;
        doc.combat.contests.push({ ...none, id: "neither" });
      }),
      /"defender" or a fixed "difficulty"/,
    );
    refused(
      document((doc) => doc.combat.contests.push({ ...treat, id: "odd", targetHolds: "bleeding" })),
      /Unknown condition "bleeding"/,
    );
    refused(
      document((doc) => doc.combat.contests.push({ ...steady, id: "bare", onWin: {} })),
      /applies, ends, pushes or stabilizes/,
    );
    refused(
      document((doc) => doc.combat.contests.push({ ...treat, id: "unknown", attacker: { checks: ["herbalism"] } })),
      /Unknown contest check "herbalism"/,
    );
    // A pool fight counts successes: a fixed number is no match for them.
    const gravewatch = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../docs/examples/rulesets/gravewatch.json", import.meta.url)), "utf8"),
    );
    delete gravewatch.combat.initiative.each;
    gravewatch.combat.checks = [{ id: "might", label: "Might", value: { abilityMod: "sinew" } }];
    const poolContest = { id: "lift", label: "Lift", budget: "act", attacker: { checks: ["might"] } };
    gravewatch.combat.contests = [
      { ...poolContest, defender: { checks: ["might"] }, onWin: { ends: [{ condition: "rattled", on: "target" }] } },
    ];
    parse(gravewatch);
    gravewatch.combat.contests = [
      { ...poolContest, difficulty: 3, onWin: { ends: [{ condition: "rattled", on: "target" }] } },
    ];
    refused(gravewatch, /A pool fight counts successes/);
  }

  // ── The gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset with contests rolled against a fixed number, taken on allies, the wounded or the dying, contests that stabilize, or weapons whose damage only a rest restores requires schemaVersion 2 and capabilityApi 1.193 or newer";
    const withContest = (extra: Record<string, unknown>, onWin?: Record<string, unknown>) => {
      const doc = JSON.parse(fiveE);
      const grapple = doc.combat.contests[0];
      doc.combat.contests[0] = { ...grapple, ...extra, ...(onWin ? { onWin: { ...grapple.onWin, ...onWin } } : {}) };
      return doc;
    };
    const withItem = (attack: Record<string, unknown>) => {
      const doc = JSON.parse(fiveE);
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "w", label: "W", item: weapon("W", attack).item }],
      });
      return doc;
    };
    const withHarm = () => {
      const doc = JSON.parse(fiveE);
      doc.combat.conditions.push({
        condition: "poisoned",
        harms: { at: "turn-start", flat: 1, healedOnlyByRest: true },
      });
      return doc;
    };
    for (const [label, doc] of [
      ["difficulty", withContest({ difficulty: 10 })],
      ["targets", withContest({ targets: "ally" })],
      ["target holds", withContest({ targetHolds: "poisoned" })],
      ["target dying", withContest({ targetDying: true })],
      ["stabilizes", withContest({}, { stabilizes: true })],
      ["a weapon", withItem({ healedOnlyByRest: true })],
      ["a harm", withHarm()],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(192) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(193) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(192) as never, JSON.parse(fiveE)), gate, "plain 5e");
  }

  console.log(
    "Ruleset treatments: a Medicine check closes a sword of wounding's wounds or steadies the dying, a contest can be rolled against a fixed number and taken on friends, and hit points only a rest gives back stay sealed until one.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
