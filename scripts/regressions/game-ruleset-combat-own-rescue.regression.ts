/**
 * A holder's own rescues, not-self targets and one-at-a-time conditions (Capability API 1.256).
 *
 *   - An entry's `rescue` by `twenty`: a failed check's d20 counts as a 20, spent only where that
 *     makes it (Stroke of Luck). By `die`: a die of the holder's own added where it could make up the
 *     difference, `dice` or one `die` sized by a value (Peerless Skill, Dark One's Own Luck).
 *   - `notSelf`: Bardic Inspiration is never pointed at the bard.
 *   - A combat condition's `oneAtATime`: a second inspiration die, of any size, does not go on.
 *   - Import refusals and the install gate.
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { letAnswerThrough } from "./fixtures/ruleset-counter-pass.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-own-rescue-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 251);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const indomitable = {
    id: "indomitable",
    label: "Indomitable",
    rows: [
      { list: "features", values: { name: "Indomitable" } },
      { list: "counters", values: { name: "Indomitable Uses", max: 2, recharge: "long" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Indomitable Uses",
      rescue: { roll: "saves", by: "reroll" },
    },
  };
  const luck = {
    id: "stroke-of-luck",
    label: "Stroke of Luck",
    rows: [
      { list: "features", values: { name: "Stroke of Luck" } },
      { list: "counters", values: { name: "Luck", max: 1, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Luck",
      rescue: { roll: "attacks", by: "success" },
    },
  };
  const checkLuck = {
    id: "check-luck",
    label: "Lucky Grip",
    rows: [
      { list: "features", values: { name: "Lucky Grip" } },
      { list: "counters", values: { name: "Grip", max: 1, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Grip",
      rescue: { roll: "checks", by: "success" },
    },
  };
  const twenty = {
    id: "luck-twenty",
    label: "Stroke of Luck",
    rows: [
      { list: "features", values: { name: "Stroke of Luck" } },
      { list: "counters", values: { name: "Luck", max: 1, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Luck",
      rescue: { roll: "checks", by: "twenty" },
    },
  };
  const peerless = {
    id: "peerless",
    label: "Peerless Skill",
    rows: [
      { list: "features", values: { name: "Peerless Skill" } },
      { list: "counters", values: { name: "Inspiration", max: 3, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Inspiration",
      rescue: {
        roll: "checks",
        by: "die",
        die: {
          from: { field: "level" },
          table: [
            [1, 6],
            [5, 8],
            [10, 10],
            [15, 12],
          ],
        },
      },
    },
  };
  const darkLuck = {
    id: "dark-luck",
    label: "Dark One's Own Luck",
    rows: [
      { list: "features", values: { name: "Dark One's Own Luck" } },
      { list: "counters", values: { name: "Dark Luck", max: 1, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      free: true,
      usesOf: "Dark Luck",
      rescue: { roll: "saves", by: "die", dice: "1d10" },
    },
  };
  const inspire = (id: string, label: string, condition: string) => ({
    id,
    label,
    rows: [{ list: "features", values: { name: label } }],
    mechanics: {
      kind: "buff",
      budget: "bonus",
      targets: "ally",
      notSelf: true,
      range: 60,
      applies: [{ condition, duration: { rounds: 100 } }],
    },
  });
  const features = [
    twenty,
    peerless,
    darkLuck,
    inspire("inspire", "Bardic Inspiration", "inspired"),
    inspire("inspire-d8", "Bardic Inspiration d8", "inspired_d8"),
  ] as unknown as RulesetCatalogEntry[];
  const ALL = features.map((entry) => entry.id);
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "inspired", label: "Inspired" },
      { id: "inspired_d8", label: "Inspired (d8)" },
    );
    for (const [condition, dice] of [
      ["inspired", "1d6"],
      ["inspired_d8", "1d8"],
    ]) {
      doc.combat.conditions.push({
        condition,
        effects: [],
        oneAtATime: "bardic",
        modifiers: [{ to: "checks", dice, rescue: true }],
      });
    }
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "heroic",
      label: "Heroic",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  // The d20s in the order they are thrown; every other die shows 3.
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const glare = {
    id: "glare",
    name: "Glare",
    budget: "action",
    range: 60,
    save: { save: "wis_save", difficulty: 15, onSuccess: "negates" as const },
    damage: { count: 0, sides: 0, flat: 5, type: "psychic" },
  };
  const block = (defense: number): RulesetStatBlock =>
    ({ health: 200, defense, initiativeModifier: 0, speed: 30, actions: [glare] }) as unknown as RulesetStatBlock;
  const rows = (list: string, without: string[]) =>
    features
      .filter((entry) => !without.includes(entry.id))
      .flatMap((entry) => rowsFromCatalogEntry("heroic", entry).flatMap((one) => (one.list === list ? [one.row] : [])));
  const fight = (
    inspired = false,
    without: string[] = ALL,
    defense = 20,
    items: RulesetSheetItem[] = [],
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            // +4 Strength and +4 proficiency: a Greataxe at +8. Wisdom saves at +0.
            abilities: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
            fields: { level: 9, ac: 15, speed: 30, hp_max: 90 },
            lists: {
              attacks: [{ name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 }],
              features: rows("features", without),
              counters: rows("counters", without),
            },
          }),
          live: {},
          items,
          catalogs: { heroic: features },
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 10 },
          }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(defense) },
      ],
    });
    state.order = ["hero", "friend", "foe"];
    state.turn = 0;
    if (inspired) rulesetCombatant(state, "hero")!.tracked.push({ condition: "inspired", rounds: null });
    return state;
  };
  const who = (state: RulesetEncounterState, id = "hero") => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const take = (state: RulesetEncounterState, label: string, actorId: string, targetIds: string[]) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const swing = (state: RulesetEncounterState, ...rolls: number[]) => {
    d20s = rolls;
    return take(state, "Greataxe", "hero", ["foe"]);
  };
  const glared = (state: RulesetEncounterState, ...rolls: number[]) => {
    state.turn = 2;
    who(state, "foe").budgets.action = 1;
    d20s = rolls;
    return take(state, "Glare", "foe", ["hero"]);
  };
  const inspired = (state: RulesetEncounterState) =>
    rulesetCombatConditions(definition, who(state)).includes("inspired");
  const counter = (state: RulesetEncounterState, key: string) => {
    const hero = who(state);
    return readRulesetLive(definition, hero.sheet!.build, hero.sheet!.live).pools.find((one) => one.key === key)?.value;
  };

  const but = (...keep: string[]) => ALL.filter((id) => !keep.includes(id));
  const grapple = (state: RulesetEncounterState, ...rolls: number[]) => {
    d20s = rolls;
    return take(state, "Grapple", "hero", ["foe"]);
  };

  // ── Stroke of Luck on a check: the d20 counts as a 20, only where that wins it ──
  {
    const state = fight(false, but("luck-twenty"));
    const won = grapple(state, 2, 18);
    const contest = of(won.events, "contest")[0]!;
    assert.equal(contest.winner, "actor");
    assert.equal(contest.attacker.total, 24, "20 and the +4");
    assert.equal(of(won.events, "rescued")[0]?.by, "twenty");
    assert.equal(counter(won.state, "counters:luck"), 0);
    // Winning anyway, it is kept.
    const fine = grapple(fight(false, but("luck-twenty")), 18, 2);
    assert.equal(of(fine.events, "rescued").length, 0);
    // An item's check before it works: 2 and the +4 is 6 against 22, and a 20 makes it 24.
    const tome = {
      name: "Tome",
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        use: {
          kind: "heal",
          budget: "action",
          targets: "self",
          amount: { flat: 1 },
          gate: { check: { ability: "str" }, difficulty: 22 },
        },
      } as unknown as RulesetCatalogItem,
    } as RulesetSheetItem;
    const reader = fight(false, but("luck-twenty"), 20, [tome]);
    d20s = [2];
    const read = take(reader, "Tome", "hero", ["hero"]);
    const gate = of(read.events, "gate")[0]!;
    assert.equal(gate.success, true, "the gate made with a 20");
    assert.equal(gate.total, 6, "the roll itself stands");
    assert.equal(counter(read.state, "counters:luck"), 0);
  }

  // ── Stroke of Luck on Counterspell's check above its reach ──
  {
    const spells = [
      {
        id: "bolt",
        label: "Bolt",
        rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          autoHit: true,
          amount: { flat: 3 },
          damageType: "fire",
          cost: [{ pool: "slots_1", amount: 1 }],
        },
      },
      {
        id: "counter",
        label: "Counter",
        rows: [{ list: "spells", values: { name: "Counter", level: 3, prepared: true } }],
        mechanics: {
          kind: "utility",
          budget: "reaction",
          cost: [{ pool: "slots_3", amount: 1 }],
          reaction: {
            on: "used",
            cancels: true,
            against: { catalogs: ["spells"] },
            upTo: "paid",
            above: { check: { abilityModFromField: "spellcasting_ability" }, dc: 10 },
          },
        },
      },
    ] as unknown as RulesetCatalogEntry[];
    const caster = (abilities: Record<string, number>, lists: Record<string, unknown> = {}) =>
      rulesetSheetBuildSchema.parse({
        abilities: { str: 8, con: 12, wis: 12, cha: 10, ...abilities },
        fields: {
          level: 9,
          ac: 12,
          speed: 30,
          hp_max: 40,
          spellcasting_ability: "int",
          slots_max_1: 4,
          slots_max_3: 3,
          slots_max_5: 1,
        },
        lists: {
          spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
          ...lists,
        },
      });
    const counterFight = (lucky: boolean) => {
      const without = lucky ? but("luck-twenty") : ALL;
      return createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        bestiary: { spells },
        combatants: [
          {
            id: "mage",
            name: "Mage",
            side: "enemy",
            block: { sheet: caster({ dex: 20, int: 16 }), actions: [] },
          } as RulesetCombatantInput,
          {
            id: "corwin",
            name: "Corwin",
            side: "party",
            // Int 18: +4 on the check against 10 and the bolt's 5.
            build: caster(
              { dex: 1, int: 18 },
              { features: rows("features", without), counters: rows("counters", without) },
            ),
            live: {},
            catalogs: { spells, heroic: features },
          },
        ],
      });
    };
    const answered = (lucky: boolean) => {
      const state = counterFight(lucky);
      const bolt = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Bolt")!;
      const held = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: bolt.id, targetIds: ["corwin"], payWith: "slots_5" },
        () => 10,
      );
      assert.ok(held.state.window, JSON.stringify(held.events));
      const counter = rulesetWindowOptions(definition, held.state, "corwin").find((one) => one.label === "Counter")!;
      const roller = (sides: number) => (sides === 20 ? 2 : 3);
      return letAnswerThrough(
        definition,
        applyRulesetCombatChoice(
          definition,
          held.state,
          { actorId: "corwin", optionId: counter.id, targetIds: [], window: held.state.window!.id },
          roller,
        ),
        roller,
      );
    };
    assert.equal(of(answered(true).events, "cancelled").length, 1, "6 against 15, and a 20 makes it 24");
    assert.equal(of(answered(false).events, "cancelled").length, 0, "without the luck, the bolt lands");
  }

  // ── Peerless Skill: a bardic die of the holder's own, sized by level, on a check ──
  {
    // 6 + 4 is 10 against 12: the d8's 3 makes it 13.
    const state = fight(false, but("peerless"));
    const helped = grapple(state, 6, 12);
    const contest = of(helped.events, "contest")[0]!;
    assert.equal(contest.winner, "actor");
    assert.deepEqual(contest.attacker.bonuses, [
      { condition: "Peerless Skill", entry: true, value: 3, rolls: [3], rescue: true },
    ]);
    assert.equal(of(helped.events, "rescued")[0]?.by, "die");
    assert.equal(counter(helped.state, "counters:inspiration"), 2);
    // Too far short for a d8: not spent.
    const hopeless = grapple(fight(false, but("peerless")), 2, 20);
    assert.equal(of(hopeless.events, "rescued").length, 0);
    assert.equal(counter(hopeless.state, "counters:inspiration"), 3);
    // 2 and the +4 is 6 against 13: only a d8 could make up 7, and its 3 does not.
    const tried = grapple(fight(false, but("peerless")), 2, 13);
    assert.equal(of(tried.events, "rescued")[0]?.by, "die", "a d8 at level 9, not a d6");
    assert.equal(of(tried.events, "contest")[0]!.winner, "target");
    assert.equal(counter(tried.state, "counters:inspiration"), 2);
    // A condition given them is tried first.
    const given = fight(false, but("peerless"));
    who(given).tracked.push({ condition: "inspired", rounds: null });
    const first = grapple(given, 6, 12);
    assert.equal(of(first.events, "contest")[0]!.attacker.bonuses![0]!.condition, "inspired");
    assert.equal(counter(first.state, "counters:inspiration"), 3);
  }

  // ── Dark One's Own Luck: a d10 on a save ──
  {
    const state = fight(false, but("dark-luck"));
    const step = glared(state, 13);
    const save = of(step.events, "save")[0]!;
    assert.equal(save.success, true, "13 and the d10's 3 is 16");
    assert.deepEqual(save.bonuses, [
      { condition: "Dark One's Own Luck", entry: true, value: 3, rolls: [3], rescue: true },
    ]);
    assert.equal(counter(step.state, "counters:dark luck"), 0);
    // A check is not a save.
    assert.equal(of(grapple(fight(false, but("dark-luck")), 6, 12).events, "rescued").length, 0);
  }

  // ── Bardic Inspiration: never on the bard, and one die at a time ──
  {
    const state = fight(false, but("inspire", "inspire-d8"));
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Bardic Inspiration")!;
    assert.deepEqual(rulesetOptionTargets(definition, state, "hero", option), ["friend"], "never the bard");
    const self = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["hero"] },
      roll,
    );
    assert.equal(of(self.events, "refused").length, 1);
    const given = take(state, "Bardic Inspiration", "hero", ["friend"]);
    assert.ok(who(given.state, "friend").tracked.some((one) => one.condition === "inspired"));
    who(given.state, "hero").budgets.bonus = 1;
    const second = take(given.state, "Bardic Inspiration d8", "hero", ["friend"]);
    const refusedOn = of(second.events, "condition").find((one) => one.condition === "inspired_d8");
    assert.equal(refusedOn?.reason, "already");
    assert.ok(!who(second.state, "friend").tracked.some((one) => one.condition === "inspired_d8"), "not a second die");
    who(second.state, "hero").budgets.bonus = 1;
    const same = take(second.state, "Bardic Inspiration", "hero", ["friend"]);
    assert.equal(of(same.events, "condition").find((one) => one.condition === "inspired")?.reason, "already");
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs
        .find((one: { id: string }) => one.id === "heroic")
        .entries.find((one: { id: string }) => one.id === id).mechanics;
    refused((doc) => (entry(doc, "luck-twenty").rescue.roll = "saves"), /"twenty" goes with "checks"/);
    refused((doc) => delete entry(doc, "dark-luck").rescue.dice, /"die" adds "dice" or one "die"/);
    refused((doc) => (entry(doc, "luck-twenty").rescue.dice = "1d4"), /and only "die" does/);
    refused(
      (doc) => (entry(doc, "dark-luck").rescue.die = { from: { field: "level" }, table: [[1, 6]] }),
      /one of them/,
    );
    refused((doc) => (entry(doc, "inspire").targets = "enemy"), /"notSelf" is on an entry pointed at/);
  }

  // ── The install gate ──
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
      "A ruleset with rescues counting a d20 as 20 or adding a holder's own die, entries never on their user, or conditions one of a kind at a time, requires schemaVersion 2 and capabilityApi 1.256 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { mechanics: { rescue: { roll: "checks", by: "twenty" } } },
      { mechanics: { rescue: { roll: "saves", by: "die", dice: "1d10" } } },
      { mechanics: { notSelf: true } },
      { oneAtATime: "bardic" },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(255, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(256, document), gate);
    }
    const older = structuredClone(without);
    older.extra = { entry: { mechanics: { rescue: { roll: "saves", by: "reroll" } } } };
    assert.notEqual(issue(255, older), gate, "a reroll is older");
    assert.notEqual(issue(255, without), gate);
    assert.equal(issue(255, without, new Map([["heroic.json", { entries: [peerless] }]])), gate);
  }

  console.log(
    "Ruleset own rescues: Stroke of Luck counts a check's d20 as 20, Peerless Skill and Dark One's Own Luck add the holder's own die, Bardic Inspiration is never on the bard and one die at a time; gated at 1.256.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
