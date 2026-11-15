/**
 * Wounds that stack, sworn enemies, and monster attacks by ability (Capability API 1.189).
 *
 *   - `harms`: a condition deals damage as its holder's turn starts (or ends), from its source, before
 *     the save that may end it; `stacks` puts it on again up to a most, and harms once for each.
 *   - `onePerSource`: an oathbow's sworn enemy leaves the last one when it is put on another.
 *   - An item attack's `against` by `marked` with `mode`, `ignoresCover` and `ignoresLongRange`, and
 *     a `plus` clause by `marked`: the oathbow's advantage, cover, long range and 3d6.
 *   - A creature action's `ability`: Weakening Breath and Ray of Enfeeblement reach an ogre's club.
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCreatureBlock,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetDefenseAgainst,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-marks-wounds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 184);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const added = [
    {
      condition: "wounded",
      harms: { at: "turn-start", dice: "1d4", type: "necrotic" },
      stacks: 3,
    },
    { condition: "scorched", harms: { at: "turn-end", flat: 3, type: "fire" } },
    { condition: "sworn", onePerSource: true },
    { condition: "weakened", modifiers: [{ to: "attacks", flat: -20, ability: "str" }] },
    { condition: "enfeebled", modifiers: [{ to: "damage", times: 0.5, ability: "str" }] },
  ];
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    for (const entry of added) {
      doc.sheet.live.conditions.push({ id: entry.condition, label: entry.condition });
      doc.combat.conditions.push(entry);
    }
    doc.combat.creatureTypes = { types: [{ id: "construct", label: "Construct" }] };
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
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
  const wounding = weapon("Wounding", {
    onHit: [{ condition: "wounded", atLeast: 1, saveEnds: { save: "con_save", difficulty: 15, at: "turn-start" } }],
  });
  const scorching = weapon("Scorching", { onHit: [{ condition: "scorched", atLeast: 1 }] });
  const marker = weapon("Marker", { onHit: [{ condition: "sworn", atLeast: 1 }] });
  const oathbow = weapon("Oathbow", {
    toHit: { abilities: ["dex"] },
    damage: { dice: "1d8", abilities: ["dex"], type: "piercing" },
    range: { normal: 30, long: 120 },
    against: [{ marked: "sworn", mode: "advantage", ignoresCover: true, ignoresLongRange: true }],
    plus: [{ dice: "3d6", type: "force", marked: "sworn" }],
  });
  const smiter = weapon("Smiter", { against: [{ is: { types: ["construct"] }, mode: "advantage" }] });
  const creature = (id: string, extra: Partial<RulesetStatBlock> = {}) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 200,
      defense: 10,
      initiativeModifier: -20,
      saves: { con_save: -20 },
      actions: [
        {
          id: "club",
          name: "Club",
          budget: "action",
          toHit: 5,
          ability: "str",
          damage: { count: 2, sides: 8, flat: 4 },
        },
        { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 2, sides: 8, flat: 4 } },
      ],
      ...extra,
    } as RulesetStatBlock,
  });
  const ogreBlock = (ability: string) => ({
    health: 59,
    defense: 11,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "club", name: "Club", budget: "action", toHit: 6, ability, damage: { dice: "2d8", flat: 4 } }],
    tier: "cr_0",
  });
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(30).fill("plains")),
  });
  let d20 = 10;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (
    items: RulesetSheetItem[],
    options: { foes?: string[]; at?: Record<string, number>; forest?: boolean; heroConditions?: string[] } = {},
  ) => {
    const foes = options.foes ?? ["foe"];
    const board = grid();
    const placements: Record<string, { x: number; y: number }> = { hero: { x: 2, y: 5 } };
    foes.forEach((id, index) => {
      placements[id] = { x: options.at?.[id] ?? 3, y: 5 - index };
      if (options.forest) board.tiles[placements[id]!.y]![placements[id]!.x] = "forest";
    });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: { conditions: options.heroConditions ?? [] }, items },
        ...foes.map((id) => creature(id)),
      ],
      board: { grid: board, placements },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, actor: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const act = (state: RulesetEncounterState, label: string, target = "foe", actor = "hero") => {
    who(state, actor).budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: optionOf(state, actor, label).id, targetIds: [target] },
      roller,
    );
    // The fight goes on from what the choice left, in the same object the test holds.
    Object.assign(state, step.state);
    return step.events;
  };
  const attackOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "attack");
    assert.ok(event && event.type === "attack");
    return event;
  };
  const damageOf = (events: RulesetCombatEvent[], type?: string) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .filter((one) => type === undefined || one.damageType === type)
      .reduce((total, one) => total + one.dealt, 0);
  const tracked = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.find((entry) => entry.condition === condition);
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const toTurnOf = (state: RulesetEncounterState, id: string) => {
    const events: RulesetCombatEvent[] = [];
    for (let guard = 0; guard < 10; guard++) {
      const step = advanceRulesetTurn(definition, state, roller);
      events.push(...step.events);
      Object.assign(state, step.state);
      if (state.order[state.turn] === id) return events;
    }
    assert.fail(`never reached ${id}`);
  };

  // ── A sword of wounding: wounds stack, harm each turn, and a save ends them all ──
  {
    const state = fight([wounding]);
    const first = act(state, "Wounding");
    assert.ok(first.some((one) => one.type === "condition" && one.condition === "wounded" && one.reason === "applied"));
    assert.equal(tracked(state, "foe", "wounded")!.stacks, undefined, "one wound");
    const second = act(state, "Wounding");
    const stacked = second.find((one) => one.type === "condition" && one.reason === "stacked");
    assert.ok(stacked && stacked.type === "condition" && stacked.stacks === 2, "a second wound");
    assert.equal(tracked(state, "foe", "wounded")!.stacks, 2);
    assert.equal(tracked(state, "foe", "wounded")!.source, "hero", "still the wielder's");
    act(state, "Wounding");
    act(state, "Wounding");
    assert.equal(tracked(state, "foe", "wounded")!.stacks, 3, "no more than three");
    const before = health(state, "foe");
    const turn = toTurnOf(state, "foe");
    const necrotic = turn.find((one) => one.type === "damage" && one.damageType === "necrotic");
    assert.ok(necrotic && necrotic.type === "damage", "the wounds bleed as the turn starts");
    assert.equal(necrotic.dealt, 6, "1d4 for each of three wounds, every die a 2");
    assert.equal(necrotic.sourceId, "hero", "the wielder's doing");
    assert.equal(before - health(state, "foe"), 6);
    // Harm first, then the save: the save comes after the damage in the log.
    const saveAt = turn.findIndex((one) => one.type === "save");
    assert.ok(saveAt > turn.indexOf(necrotic), "the save is rolled after the wounds bleed");
    assert.ok(tracked(state, "foe", "wounded"), "the failed save keeps them");
    // A made save ends every wound at once.
    who(state, "foe").saves = { con_save: 20 };
    toTurnOf(state, "hero");
    const later = toTurnOf(state, "foe");
    assert.equal(damageOf(later, "necrotic"), 6, "it bled once more first");
    assert.equal(tracked(state, "foe", "wounded"), undefined, "then all the wounds closed");
  }

  // ── Wounds that kill roll no save ──
  {
    const state = fight([wounding]);
    act(state, "Wounding");
    who(state, "foe").health = { ...who(state, "foe").health!, value: 1 };
    const turn = toTurnOf(state, "foe");
    assert.ok(
      turn.some((one) => one.type === "defeated" && one.actorId === "foe"),
      "bled out",
    );
    assert.ok(!turn.some((one) => one.type === "save"), "and rolled nothing after");
  }

  // ── Harm as a turn ends ──
  {
    const state = fight([scorching]);
    act(state, "Scorching");
    const start = toTurnOf(state, "foe");
    assert.equal(damageOf(start, "fire"), 0, "nothing as the turn starts");
    const end = toTurnOf(state, "hero");
    assert.equal(damageOf(end, "fire"), 3, "3 fire as it ends");
  }

  // ── An oathbow's sworn enemy ──
  {
    // The mark keeps to one target of the hero's.
    const two = fight([marker, oathbow], { foes: ["foe", "other"] });
    act(two, "Marker", "foe");
    assert.ok(tracked(two, "foe", "sworn"));
    const moved = act(two, "Marker", "other");
    assert.ok(moved.some((one) => one.type === "condition" && one.targetId === "foe" && one.reason === "moved"));
    assert.equal(tracked(two, "foe", "sworn"), undefined, "it left the first");
    assert.ok(tracked(two, "other", "sworn"), "for the second");
    // Somebody else's mark on the first stays put.
    const others = fight([marker], { foes: ["foe", "other"] });
    who(others, "foe").tracked.push({ condition: "sworn", source: "somebody", rounds: null });
    act(others, "Marker", "other");
    assert.ok(tracked(others, "foe", "sworn"), "only the hero's own mark moves");

    const sworn = (state: RulesetEncounterState, id = "foe") =>
      who(state, id).tracked.push({ condition: "sworn", source: "hero", rounds: null });
    // Advantage and the 3d6, at the sworn enemy only.
    const plain = fight([oathbow], { at: { foe: 6 } });
    const plainShot = act(plain, "Oathbow");
    assert.equal(attackOf(plainShot).mode, "normal");
    assert.equal(damageOf(plainShot, "force"), 0, "no 3d6 at anybody else");
    const marked = fight([oathbow], { at: { foe: 6 } });
    sworn(marked);
    const markedShot = act(marked, "Oathbow");
    assert.equal(attackOf(markedShot).mode, "advantage");
    assert.equal(damageOf(markedShot, "force"), 6, "3d6, every die a 2");
    // Sworn by somebody else is not the hero's sworn enemy.
    const theirs = fight([oathbow], { at: { foe: 6 } });
    who(theirs, "foe").tracked.push({ condition: "sworn", source: "somebody", rounds: null });
    assert.equal(attackOf(act(theirs, "Oathbow")).mode, "normal");
    // Long range: disadvantage at anybody else, none at the sworn enemy.
    const far = fight([oathbow], { at: { foe: 20 } });
    assert.equal(attackOf(act(far, "Oathbow")).mode, "disadvantage", "long range");
    const farSworn = fight([oathbow], { at: { foe: 20 } });
    sworn(farSworn);
    assert.equal(attackOf(act(farSworn, "Oathbow")).mode, "advantage", "no disadvantage for the distance");
    // Cover: counted for anybody else, not for the sworn enemy.
    const covered = fight([oathbow], { at: { foe: 6 }, forest: true });
    const bow = who(covered, "hero").actions.find((one) => one.name === "Oathbow" || one.label === "Oathbow");
    assert.ok(bow);
    const cover = () =>
      rulesetDefenseAgainst(definition, definition.combat!, covered, who(covered, "foe"), who(covered, "hero"), bow)
        .cover;
    assert.equal(cover(), 2, "the forest covers");
    sworn(covered);
    assert.equal(cover(), 0, "not from the oathbow");
    const chance = (marks: boolean) => {
      const state = fight([oathbow], { at: { foe: 6 }, forest: true });
      if (marks) sworn(state);
      return optionOf(state, "hero", "Oathbow").forecast?.hitChance ?? 0;
    };
    const open = fight([oathbow], { at: { foe: 6 } });
    sworn(open);
    assert.equal(
      chance(true),
      optionOf(open, "hero", "Oathbow").forecast?.hitChance,
      "the forecast ignores the forest",
    );
    assert.ok(chance(true) > chance(false));
    // The forecast's damage counts the 3d6 against the sworn enemy only.
    const average = (marks: boolean) => {
      const state = fight([oathbow], { at: { foe: 6 } });
      if (marks) sworn(state);
      return optionOf(state, "hero", "Oathbow").forecast?.averageDamage ?? 0;
    };
    assert.ok(average(true) > average(false));
  }

  // ── By what the target is, a roll mode too ──
  {
    assert.equal(attackOf(act(fight([smiter]), "Smiter")).mode, "normal", "not a construct");
    const golem = fight([smiter]);
    who(golem, "foe").block!.type = "construct";
    assert.equal(attackOf(act(golem, "Smiter")).mode, "advantage", "a construct");
  }

  // ── A monster's Strength attack ──
  {
    const club = (conditions: string[], label = "Club") => {
      const state = fight([], {});
      for (const condition of conditions) who(state, "foe").tracked.push({ condition, source: "hero", rounds: null });
      state.turn = state.order.indexOf("foe");
      return act(state, label, "hero", "foe");
    };
    assert.equal(attackOf(club([])).outcome, "hit");
    assert.equal(attackOf(club(["weakened"])).outcome, "miss", "Weakening Breath on a club made with Strength");
    assert.equal(attackOf(club(["weakened"], "Claw")).outcome, "hit", "a claw that names no ability is untouched");
    assert.equal(damageOf(club([])), 8, "2d8 + 4");
    assert.equal(damageOf(club(["enfeebled"])), 4, "Ray of Enfeeblement halves it");
    assert.equal(damageOf(club(["enfeebled"], "Claw")), 8);
    // A bestiary's creature carries it into its block.
    const ogre = parse(
      document((doc) => {
        doc.catalogs.push({
          id: "beasts",
          label: "Beasts",
          holds: "creatures",
          entries: [{ id: "ogre", label: "Ogre", creature: ogreBlock("str") }],
        });
      }),
    );
    const entry = ogre.catalogs!.find((one) => one.id === "beasts")!.entries[0]!;
    const block = rulesetCreatureBlock(ogre, entry);
    assert.ok(block && "actions" in block);
    assert.equal((block.actions[0] as { ability?: string }).ability, "str");
  }

  // ── Refusals ──
  {
    const condition = (entry: Record<string, unknown>) =>
      document((doc) => {
        doc.sheet.live.conditions.push({ id: "extra", label: "Extra" });
        doc.combat.conditions.push({ condition: "extra", ...entry });
      });
    refused(condition({ stacks: 3 }), /Stacks multiply what a condition harms with/);
    refused(condition({ harms: { at: "turn-start" } }), /names dice, a flat amount, or both/);
    refused(condition({ harms: { at: "turn-start", flat: 2, type: "sorrow" } }), /Unknown damage type "sorrow"/);
    refused(condition({ stacks: 1, harms: { at: "turn-start", flat: 1 } }), /stacks/);
    const withItem = (attack: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "w", label: "W", item: weapon("W", attack).item }],
        });
      });
    refused(withItem({ against: [{ toHit: 2 }] }), /names who it is against/);
    refused(withItem({ against: [{ marked: "sworn" }] }), /changes something/);
    refused(withItem({ against: [{ marked: "vowed", toHit: 1 }] }), /Unknown condition "vowed"/);
    refused(withItem({ plus: [{ dice: "1d6", marked: "vowed" }] }), /Unknown condition "vowed"/);
    refused(
      document((doc) => {
        doc.catalogs.push({
          id: "beasts",
          label: "Beasts",
          holds: "creatures",
          entries: [
            {
              id: "ogre",
              label: "Ogre",
              creature: ogreBlock("luck"),
            },
          ],
        });
      }),
      /Unknown ability "luck"/,
    );
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
      "A ruleset with conditions that harm each turn, stack or keep to one holder per source, weapons that mark a sworn enemy, or creature actions that name their ability requires schemaVersion 2 and capabilityApi 1.189 or newer";
    const condition = (entry: Record<string, unknown>) => {
      const doc = JSON.parse(fiveE);
      doc.combat.conditions.push({ condition: "poisoned", ...entry });
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
    const ogre = (() => {
      const doc = JSON.parse(fiveE);
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "ogre",
            label: "Ogre",
            creature: ogreBlock("str"),
          },
        ],
      });
      return doc;
    })();
    for (const [label, doc] of [
      ["harms", condition({ harms: { at: "turn-start", flat: 1 } })],
      ["stacks", condition({ stacks: 2 })],
      ["onePerSource", condition({ onePerSource: true })],
      ["against marked", withItem({ against: [{ marked: "poisoned", toHit: 1 }] })],
      ["against mode", withItem({ against: [{ is: { types: ["undead"] }, mode: "advantage" }] })],
      ["against cover", withItem({ against: [{ is: { types: ["undead"] }, ignoresCover: true }] })],
      ["against range", withItem({ against: [{ is: { types: ["undead"] }, ignoresLongRange: true }] })],
      ["plus marked", withItem({ plus: [{ dice: "1d6", marked: "poisoned" }] })],
      ["creature ability", ogre],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(188) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(189) as never, doc), gate, label);
    }
    // A 1.187 smiting entry, by what the target is and with toHit, is not this minor's.
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(188) as never,
        withItem({ against: [{ is: { types: ["undead"] }, toHit: 2 }] }),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(188) as never, JSON.parse(fiveE)), gate, "plain 5e");
  }

  console.log(
    "Ruleset marks and wounds: wounds stack and bleed each turn until a save closes them all, an oathbow's sworn enemy is struck with advantage through cover and at long range, and a monster's club is weakened by what weakens Strength.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
