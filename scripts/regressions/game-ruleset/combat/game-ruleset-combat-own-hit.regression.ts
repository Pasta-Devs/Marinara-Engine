/**
 * Answers to one's own hit (Capability API 1.241), opportunity attacks' included (1.243).
 *
 *   - A `"hit"` reaction with `"by": "self"` is offered to the attacker once their roll has hit,
 *     after the one it hit has answered, aimed at whoever it hit; `"weapon": true` narrows it to a
 *     weapon's blow. Choosing it is not stopped by what stops reactions.
 *   - `addsToBlow`: an attack entry's amount joins that blow, rolled as it lands, doubled by its
 *     critical, its clauses only on a target they reach: Divine Smite, with the 1d8 against fiends.
 *   - `perCostStepsMax`: the most steps of a higher cost that count (Smite stops at 5d8).
 *   - The maker answers once with each thing they hold, until they pass: smite and stun one blow.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRulesetLive } from "../../../../packages/shared/src/features/rulesets/live-state.js";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_PASS_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_MOVE_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-own-hit-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 238);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const smite = {
    id: "divine-smite",
    label: "Divine Smite",
    rows: [{ list: "features", values: { name: "Divine Smite" } }],
    mechanics: {
      kind: "attack",
      free: true,
      reaction: { on: "hit", by: "self", weapon: true, blow: "melee", at: "target" },
      addsToBlow: true,
      amount: { dice: "2d8" },
      damageType: "radiant",
      plus: [{ dice: "1d8", type: "radiant", targetIs: { types: ["fiend", "undead"] } }],
      cost: [{ pool: "slots_1", amount: 1 }],
      perCostStep: { dice: "1d8" },
      perCostStepsMax: 3,
    },
  };
  const stun = {
    id: "stunning-strike",
    label: "Stunning Strike",
    rows: [
      { list: "features", values: { name: "Stunning Strike" } },
      { list: "counters", values: { name: "Ki", max: 2, recharge: "short" } },
    ],
    mechanics: {
      kind: "debuff",
      free: true,
      usesOf: "Ki",
      reaction: { on: "hit", by: "self", weapon: true, blow: "melee", at: "target" },
      save: { save: "con_save", onSuccess: "negates" },
      applies: [{ condition: "stunned", duration: { rounds: 1, of: "source" } }],
    },
  };
  /** A touch that is no weapon's blow. */
  const touch = {
    id: "searing-touch",
    label: "Searing Touch",
    rows: [{ list: "features", values: { name: "Searing Touch" } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d6" }, damageType: "fire" },
  };
  const features = [smite, stun, touch] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend", "undead"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    // Shocking Grasp's: no reactions until its next turn.
    doc.sheet.live.conditions.push({ id: "shocked", label: "Shocked" });
    doc.combat.conditions.push({ condition: "shocked", effects: ["cannot-react"] });
    // What a monk's ki save is rolled against; the example's features have none.
    Object.assign(
      doc.combat.abilities.find((one: { list: string }) => one.list === "features"),
      { saveDifficulty: { derived: "spell_save_dc" }, toHit: { derived: "spell_attack" } },
    );
    doc.catalogs.push({
      id: "paladin",
      label: "Paladin",
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
  // A d20 shows `d20`; every other die shows 3.
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 80,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { con_save: -20 },
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 0, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
      ],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("paladin", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const fight = (
    foe: Partial<RulesetStatBlock> = {},
    attacks?: unknown[],
    board?: { grid: TacticalGrid; placements: Record<string, { x: number; y: number }> },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      ...(board ? { board } : {}),
      roller: roll,
      combatants: [
        {
          id: "pal",
          name: "Pal",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
            fields: {
              level: 9,
              ac: 18,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "cha",
              slots_max_1: 4,
              slots_max_2: 3,
              slots_max_3: 2,
              slots_max_4: 1,
              slots_max_5: 1,
            },
            lists: {
              attacks: attacks ?? [
                {
                  name: "Longsword",
                  ability: "str",
                  proficient: true,
                  bonus: 0,
                  damage: "1d8",
                  damage_type: "slashing",
                  reach: 5,
                },
                {
                  name: "Longbow",
                  ability: "dex",
                  proficient: true,
                  bonus: 0,
                  damage: "1d8",
                  damage_type: "piercing",
                  range: 150,
                  long_range: 600,
                },
              ],
              features: rows("features"),
              counters: rows("counters"),
            },
          }),
          live: {},
          catalogs: { paladin: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
        {
          id: "squire",
          name: "Squire",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 10 },
            lists: { attacks: [{ name: "Claw", ability: "str", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
          }),
          live: {},
        },
      ],
    });
    state.order = ["pal", "foe", "squire"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, "foe")).value;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (
    state: RulesetEncounterState,
    optionId: string,
    extra: { targetIds?: string[]; payWith?: string } = {},
  ) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "pal",
        optionId,
        targetIds: extra.targetIds ?? [],
        ...(extra.payWith ? { payWith: extra.payWith } : {}),
      },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const strike = (state: RulesetEncounterState, label = "Longsword") => {
    const option = rulesetCombatOptions(definition, state, "pal").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return choose(state, option.id, { targetIds: ["foe"] });
  };
  const answers = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "pal");
  const answer = (state: RulesetEncounterState, label: string, payWith?: string) => {
    const option = answers(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${answers(state).map((one) => one.label)}`);
    return choose(state, option.id, payWith ? { payWith } : {});
  };
  const pass = (state: RulesetEncounterState) => choose(state, RULESET_PASS_OPTION);

  // ── The hit is held for its maker: Smite and Stunning Strike are offered, aimed at the one hit ──
  {
    d20 = 15;
    const hit = strike(fight());
    assert.equal(hit.state.window?.trigger.kind, "hit");
    assert.deepEqual(hit.state.window?.waiting, ["pal"]);
    assert.equal(of(hit.events, "damage").length, 0, "nothing lands before the maker has chosen");
    const offered = answers(hit.state);
    assert.deepEqual(
      offered.map((one) => one.label),
      ["Divine Smite", "Stunning Strike"],
    );
    assert.deepEqual(offered.find((one) => one.label === "Divine Smite")!.payWith, [
      "slots_2",
      "slots_3",
      "slots_4",
      "slots_5",
    ]);
    // Passing lets the blow land as it was: 1d8 + 4.
    const plain = pass(hit.state);
    assert.equal(plain.state.window, undefined);
    assert.equal(80 - hp(plain.state), 7);
  }

  // ── Smite with a 2nd-level slot: 3d8 radiant joins the blow ──
  {
    d20 = 15;
    const smitten = answer(strike(fight()).state, "Divine Smite", "slots_2");
    assert.deepEqual(
      of(smitten.events, "added").map((one) => [one.actorId, one.targetId, one.label, one.to]),
      [["pal", "foe", "Divine Smite", "Longsword"]],
    );
    assert.deepEqual(
      of(smitten.events, "spend").map((one) => one.pool),
      ["slots_2"],
    );
    // Still asked: Stunning Strike is left. The blow lands once they pass.
    assert.deepEqual(
      answers(smitten.state).map((one) => one.label),
      ["Stunning Strike"],
    );
    const landed = pass(smitten.state);
    assert.equal(80 - hp(landed.state), 7 + 9, "1d8 + 4, then 3d8");
    assert.ok(of(landed.events, "damage").some((one) => one.label === "Divine Smite"));
  }

  // ── Against a fiend, 1d8 more; a 5th-level slot counts as a 4th: 5d8 at most ──
  {
    d20 = 15;
    const fiend = pass(answer(strike(fight({ type: "fiend" } as never)).state, "Divine Smite", "slots_5").state);
    assert.equal(80 - hp(fiend.state), 7 + 15 + 3, "5d8, then the fiend's 1d8");
  }

  // ── A critical doubles the smite's dice with the weapon's ──
  {
    d20 = 20;
    const critical = pass(answer(strike(fight()).state, "Divine Smite", "slots_2").state);
    assert.equal(80 - hp(critical.state), 2 * 3 + 4 + 6 * 3, "2d8 + 4, then 6d8");
    d20 = 15;
  }

  // ── Smite and stun the same blow: the save fails and the foe is stunned; a ki is spent ──
  {
    d20 = 15;
    const smitten = answer(strike(fight()).state, "Divine Smite");
    const stunned = answer(smitten.state, "Stunning Strike");
    assert.equal(stunned.state.window, undefined, "nothing left to answer with, the blow lands");
    assert.ok(rulesetCombatConditions(definition, who(stunned.state, "foe")).includes("stunned"));
    assert.equal(of(stunned.events, "save")[0]?.success, false);
    assert.equal(80 - hp(stunned.state), 7 + 6);
    // One ki of two left.
    const pal = who(stunned.state, "pal");
    assert.deepEqual(
      readRulesetLive(definition, pal.sheet!.build, pal.sheet!.live)
        .pools.filter((one) => one.key === "counters:ki")
        .map((one) => one.value),
      [1],
    );
  }

  // ── An opportunity attack's hit is held too (1.243): smite and stun it, then the walk goes on ──
  {
    //    0 1 2 3 4 5 6
    //  0 Q . . . . . .     The squire is out of everybody's reach.
    //  1 . P F . . . .     The foe walks from 2,1 to 5,1, out of the paladin's reach.
    //  2 . . . . . . .
    const grid: TacticalGrid = {
      width: 7,
      height: 3,
      tiles: Array.from({ length: 3 }, () => Array.from({ length: 7 }, () => "plains" as const)),
    };
    const walking = () => {
      const state = fight({}, undefined, {
        grid,
        placements: { pal: { x: 1, y: 1 }, foe: { x: 2, y: 1 }, squire: { x: 0, y: 0 } },
      });
      state.turn = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "foe", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } },
        roll,
      );
      assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
      assert.equal(step.state.window?.trigger.kind, "leaves-reach");
      assert.deepEqual(step.state.window?.waiting, ["pal"]);
      return step.state;
    };
    const opportunity = (state: RulesetEncounterState) => {
      const [only] = answers(state);
      assert.equal(only?.label, "Longsword");
      return choose(state, only.id);
    };
    const at = (state: RulesetEncounterState) => {
      const foe = who(state, "foe");
      return { x: foe.x, y: foe.y };
    };

    d20 = 15;
    const held = opportunity(walking());
    assert.equal(of(held.events, "opportunity").length, 1);
    assert.equal(held.state.window?.trigger.kind, "hit", "the strike is held where it hit");
    assert.deepEqual(held.state.window?.waiting, ["pal"]);
    assert.equal(of(held.events, "damage").length, 0);
    assert.deepEqual(at(held.state), { x: 2, y: 1 }, "the walk waits behind it");
    assert.deepEqual(
      answers(held.state).map((one) => one.label),
      ["Divine Smite", "Stunning Strike"],
    );

    // Smitten only: the blow lands with the smite and the walk finishes where it was going.
    const smitten = pass(answer(held.state, "Divine Smite").state);
    assert.equal(80 - hp(smitten.state), 7 + 6);
    assert.equal(smitten.state.window, undefined);
    assert.deepEqual(at(smitten.state), { x: 5, y: 1 });
    assert.equal(of(smitten.events, "move").length, 1);
    assert.equal(who(smitten.state, "pal").budgets.reaction, 0, "the strike cost the reaction");

    // Smitten and stunned: the walk stops where it was struck.
    const stunned = answer(answer(held.state, "Divine Smite").state, "Stunning Strike");
    assert.equal(stunned.state.window, undefined);
    assert.ok(rulesetCombatConditions(definition, who(stunned.state, "foe")).includes("stunned"));
    assert.deepEqual(at(stunned.state), { x: 2, y: 1 }, "a stunned walker goes no further");
    assert.equal(of(stunned.events, "move")[0]?.stopped, true);

    // Passed: the plain blow, and the walk goes on.
    const plain = pass(held.state);
    assert.equal(80 - hp(plain.state), 7);
    assert.deepEqual(at(plain.state), { x: 5, y: 1 });

    // The walk's window waits behind the hit's, its striker already answered: the squire, whose
    // reach the same step leaves, is asked next, and nobody passes for the paladin.
    {
      const state = fight({}, undefined, {
        grid,
        placements: { pal: { x: 1, y: 1 }, foe: { x: 2, y: 1 }, squire: { x: 1, y: 2 } },
      });
      state.turn = 1;
      const walk = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "foe", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 1 } },
        roll,
      );
      const outer = walk.state.window!;
      assert.deepEqual(outer.waiting, ["pal", "squire"]);
      const landed = pass(answer(opportunity(walk.state).state, "Divine Smite").state);
      assert.equal(landed.state.window?.id, outer.id, "the walk's own window again");
      assert.deepEqual(landed.state.window?.waiting, ["squire"]);
      assert.equal(
        of(landed.events, "pass").filter((one) => one.window === outer.id).length,
        0,
        "the paladin answered it with the strike",
      );
      assert.deepEqual(at(landed.state), { x: 2, y: 1 });
      const squired = applyRulesetCombatChoice(
        definition,
        landed.state,
        { actorId: "squire", optionId: RULESET_PASS_OPTION, targetIds: [] },
        roll,
      );
      assert.equal(squired.state.window, undefined);
      assert.deepEqual(at(squired.state), { x: 5, y: 1 });
    }

    // A miss holds nothing: the walk simply goes on.
    d20 = 1;
    const missed = opportunity(walking());
    assert.equal(missed.state.window, undefined);
    assert.equal(hp(missed.state), 80);
    assert.deepEqual(at(missed.state), { x: 5, y: 1 });
    d20 = 15;
  }

  // ── A bow is no melee blow, a touch no weapon, and a miss holds nothing ──
  {
    d20 = 15;
    const shot = strike(fight(), "Longbow");
    assert.equal(shot.state.window, undefined);
    const touched = strike(fight(), "Searing Touch");
    assert.equal(of(touched.events, "attack")[0]?.outcome, "hit");
    assert.equal(touched.state.window, undefined, "a touch is no weapon");
    // Somebody else's hit is not the paladin's to smite.
    const state = fight();
    state.turn = 2;
    const claw = rulesetCombatOptions(definition, state, "squire").find((one) => one.label === "Claw")!;
    const clawed = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "squire", optionId: claw.id, targetIds: ["foe"] },
      roll,
    );
    assert.equal(of(clawed.events, "attack")[0]?.outcome, "hit");
    assert.equal(clawed.state.window, undefined, "an ally's hit");
    d20 = 1;
    const missed = strike(fight());
    assert.equal(missed.state.window, undefined);
    d20 = 15;
  }

  // ── What stops reactions does not stop choosing what one's own hit does ──
  {
    d20 = 15;
    const state = fight();
    who(state, "pal").tracked.push({ condition: "shocked", rounds: 1 } as never);
    const hit = strike(state);
    assert.deepEqual(
      answers(hit.state).map((one) => one.label),
      ["Divine Smite", "Stunning Strike"],
    );
  }

  // ── The one hit is asked first, the maker last ──
  {
    d20 = 15;
    const parry = {
      id: "parry",
      name: "Parry",
      budget: "reaction",
      self: true,
      reaction: { on: "hit", at: "source" },
      applies: [{ condition: "prone", duration: "instant" }],
    };
    const hit = strike(fight({ actions: [parry] } as never));
    assert.deepEqual(hit.state.window?.waiting, ["foe", "pal"]);
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
      doc.catalogs.at(-1).entries.find((one: { id: string }) => one.id === id).mechanics;
    refused((doc) => (entry(doc, "divine-smite").reaction.by = "ally"), /reaction/);
    refused((doc) => (entry(doc, "divine-smite").reaction.on = "harmed"), /"by" narrows a hit/);
    refused((doc) => (entry(doc, "divine-smite").reaction.for = "ally"), /"by" goes without "for"/);
    refused((doc) => (entry(doc, "divine-smite").reaction.at = "source"), /"at": "target"/);
    refused((doc) => delete entry(doc, "divine-smite").reaction.by, /"addsToBlow" is an attack/);
    refused((doc) => (entry(doc, "stunning-strike").addsToBlow = true), /"addsToBlow" is an attack/);
    refused((doc) => delete entry(doc, "divine-smite").perCostStep, /"perCostStepsMax" caps/);
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
      "A ruleset with reactions to their holder's own hit or to a weapon's, uses added to that blow, or a most for a higher cost's steps, requires schemaVersion 2 and capabilityApi 1.241 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const mechanics of [
      { reaction: { on: "hit", by: "self" } },
      { reaction: { on: "hit", weapon: true } },
      { reaction: { on: "aimed", also: [{ on: "hit", weapon: true }] } },
      { addsToBlow: true },
      { perCostStepsMax: 3 },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: { mechanics } };
      assert.equal(issue(240, document), gate, JSON.stringify(mechanics));
      assert.notEqual(issue(241, document), gate);
    }
    assert.notEqual(issue(240, without), gate);
    assert.equal(issue(240, without, new Map([["paladin.json", { entries: [smite] }]])), gate);
  }

  console.log(
    "Ruleset own hit: a weapon's hit is held for its maker, who may smite (added to the blow, doubled by a critical, 5d8 at most, more against fiends) and stun it; gated at 1.241.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
