/**
 * Rescues after the roll (Capability API 1.249).
 *
 *   - A change's `rescue`: held back from the roll, added only when the holder's own attack, save or
 *     check falls short by no more than its most, and its condition is then spent: Bardic
 *     Inspiration. A roll it could not turn, or one that needed nothing, keeps it.
 *   - An entry's `rescue`: never on the menu, spent with its uses when its holder's own roll of that
 *     kind fails: a save rolled again (Indomitable), a miss or failed check turned (Stroke of Luck).
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rescue-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 244);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
  const features = [indomitable, luck, checkLuck] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "inspired", label: "Inspired" });
    doc.combat.conditions.push({
      condition: "inspired",
      effects: [],
      modifiers: [
        { to: "attacks", dice: "1d6", rescue: true },
        { to: "saves", dice: "1d6", rescue: true },
        { to: "checks", dice: "1d6", rescue: true },
      ],
    });
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
    without: string[] = ["indomitable", "stroke-of-luck", "check-luck"],
    defense = 20,
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
          catalogs: { heroic: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(defense) },
      ],
    });
    state.order = ["hero", "foe"];
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
    state.turn = 1;
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

  // ── Bardic Inspiration on an attack: only when it can turn the miss ──
  {
    // 10 + 8 is 2 short of 20: the d6's 3 makes it 21, and the die is spent.
    const turned = swing(fight(true), 10);
    const attack = of(turned.events, "attack")[0]!;
    assert.equal(attack.outcome, "hit");
    assert.equal(attack.total, 21);
    assert.deepEqual(attack.bonuses, [{ condition: "inspired", value: 3, rolls: [3], rescue: true }]);
    assert.equal(inspired(turned.state), false, "spent");
    // 5 + 8 is 7 short: no d6 makes that up, so it is kept.
    const hopeless = swing(fight(true), 5);
    assert.equal(of(hopeless.events, "attack")[0]!.outcome, "miss");
    assert.equal(of(hopeless.events, "attack")[0]!.bonuses, undefined);
    assert.equal(inspired(hopeless.state), true);
    // A hit needs nothing: kept.
    const hit = swing(fight(true), 15);
    assert.equal(of(hit.events, "attack")[0]!.total, 23);
    assert.equal(inspired(hit.state), true);
    // A natural 1 misses whatever is added, so nothing is spent on it, even 3 short of a 12.
    const natural = swing(fight(true, undefined, 12), 1);
    assert.equal(of(natural.events, "attack")[0]!.outcome, "miss");
    assert.equal(inspired(natural.state), true);
    // Without it, the menu's chance and the roll are what they always were.
    assert.equal(of(swing(fight(), 10).events, "attack")[0]!.outcome, "miss");
  }

  // ── On a save ──
  {
    // 12 + 0 is 3 short of 15: the d6's 3 saves it.
    const saved = glared(fight(true), 12);
    const save = of(saved.events, "save")[0]!;
    assert.equal(save.success, true);
    assert.equal(save.total, 15);
    assert.equal(inspired(saved.state), false);
    assert.equal(of(saved.events, "damage").length, 0, "negated");
    // A made save keeps it.
    assert.equal(inspired(glared(fight(true), 16).state), true);
  }

  // ── Indomitable: a failed save rolled again, once, and the new roll stands ──
  {
    const again = glared(fight(false, ["stroke-of-luck", "check-luck"]), 4, 17);
    const saves = of(again.events, "save");
    assert.deepEqual(
      saves.map((one) => [one.kept, one.success]),
      [
        [4, false],
        [17, true],
      ],
    );
    assert.deepEqual(of(again.events, "rescued"), [
      {
        type: "rescued",
        actorId: "hero",
        optionId: of(again.events, "rescued")[0]!.optionId,
        label: "Indomitable",
        by: "reroll",
      },
    ]);
    assert.equal(counter(again.state, "counters:indomitable uses"), 1);
    // The second roll stands even when it fails too, with a use still left.
    const still = glared(fight(false, ["stroke-of-luck", "check-luck"]), 4, 6);
    assert.deepEqual(
      of(still.events, "save").map((one) => one.success),
      [false, false],
    );
    assert.equal(counter(still.state, "counters:indomitable uses"), 1);
    // The last use, then nothing left for the next one.
    const last = glared(still.state, 4, 5);
    assert.equal(of(last.events, "rescued").length, 1);
    assert.equal(counter(last.state, "counters:indomitable uses"), 0);
    const spent = glared(last.state, 4);
    assert.equal(of(spent.events, "rescued").length, 0);
    assert.equal(of(spent.events, "save").length, 1);
    // Inspiration comes first: Indomitable is kept when the die is enough.
    const both = glared(fight(true, ["stroke-of-luck", "check-luck"]), 12);
    assert.equal(of(both.events, "rescued").length, 0);
    assert.equal(counter(both.state, "counters:indomitable uses"), 2);
    // Never on the menu.
    assert.ok(!rulesetCombatOptions(definition, fight(false, []), "hero").some((one) => one.label === "Indomitable"));
  }

  // ── Stroke of Luck: a miss becomes a hit, once ──
  {
    const lucky = swing(fight(false, ["indomitable", "check-luck"]), 3);
    assert.equal(of(lucky.events, "rescued")[0]?.label, "Stroke of Luck");
    assert.equal(of(lucky.events, "attack")[0]!.outcome, "hit");
    assert.equal(of(lucky.events, "damage").length, 1);
    assert.equal(counter(lucky.state, "counters:luck"), 0);
    // Saves are not what it turns.
    assert.equal(of(glared(fight(false, ["indomitable", "check-luck"]), 4).events, "rescued").length, 0);
  }

  // ── Checks: a contest's loser adds what it held back, or turns the loss ──
  {
    const grapple = (state: RulesetEncounterState, ...rolls: number[]) => {
      d20s = rolls;
      return of(take(state, "Grapple", "hero", ["foe"]).events, "contest")[0]!;
    };
    // 6 + 4 is 10 against the foe's 12: the d6's 3 makes it 13.
    const plain = grapple(fight(), 6, 12);
    assert.equal(plain.winner, "target");
    const short = plain.defender.total - plain.attacker.total;
    assert.ok(short > 0 && short < 3, `short by ${short}`);
    const state = fight(true);
    const helped = grapple(state, 6, 12);
    assert.equal(helped.winner, "actor");
    assert.deepEqual(helped.attacker.bonuses, [{ condition: "inspired", value: 3, rolls: [3], rescue: true }]);
    // Turned outright, once.
    const gripping = fight(false, ["indomitable", "stroke-of-luck"]);
    d20s = [2, 18];
    const lucky = take(gripping, "Grapple", "hero", ["foe"]);
    assert.equal(of(lucky.events, "rescued")[0]?.label, "Lucky Grip");
    assert.equal(of(lucky.events, "contest")[0]!.winner, "actor");
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
    const modifier = (doc: Record<string, any>) =>
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "inspired").modifiers[0];
    const entry = (doc: Record<string, any>, at: number) =>
      doc.catalogs.find((one: { id: string }) => one.id === "heroic").entries[at].mechanics;
    const message = /"rescue" adds dice or a positive flat number/;
    refused((doc) => (modifier(doc).to = "damage"), message);
    refused((doc) => (modifier(doc).mode = "advantage"), message);
    refused((doc) => (modifier(doc).minus = true), message);
    refused((doc) => Object.assign(modifier(doc), { dice: undefined, flat: -2 }), message);
    refused((doc) => (entry(doc, 1).rescue.by = "reroll"), /Only a failed save is rolled again/);
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
      "A ruleset with changes held back until a roll falls short, or entries spent on a failed roll, requires schemaVersion 2 and capabilityApi 1.249 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { modifiers: [{ to: "saves", dice: "1d6", rescue: true }] },
      { mechanics: { rescue: { roll: "saves", by: "reroll" } } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(248, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(249, document), gate);
    }
    assert.notEqual(issue(248, without), gate);
    assert.equal(issue(248, without, new Map([["heroic.json", { entries: [luck] }]])), gate);
  }

  console.log(
    "Ruleset rescue: Bardic Inspiration's die is added after the roll only when it can turn it, Indomitable rolls a failed save again and Stroke of Luck turns a miss into a hit; gated at 1.249.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
