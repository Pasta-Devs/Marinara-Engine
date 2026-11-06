/**
 * Swallowing, regurgitating, room by size, climbing out of a corpse, and what a sequence does once
 * all of it hit (Capability API 1.405).
 *
 *   - A behir's swallow: dealt 30 or more from inside in one turn, it saves or lets them out prone.
 *   - A purple worm's corpse: swallowed, its holder slain, they stay inside until they climb out
 *     for 20 feet of their walk, prone.
 *   - Whelm's room: one Large creature or two Medium ones.
 *   - A shambling mound's Multiattack: both Slams hit a Medium target, it is grappled and engulfed.
 *   - A creature action aimed only at a size (Constrict).
 *   - Refusals and the install gate.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  RULESET_CLIMB_OUT_OPTION,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-swallow-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 405);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creature = (id: string, size: string, actions: Record<string, unknown>[]) => ({
    id,
    label: id,
    creature: {
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 40,
      size,
      tier: "cr_2",
      saves: { con_save: 0, dex_save: 0, str_save: 0 },
      actions,
    },
  });
  const behir = creature("behir", "huge", [
    {
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 30,
      damage: { flat: 5, type: "piercing" },
      reach: 10,
      applies: [{ condition: "swallowed", duration: "instant" }],
    },
    {
      id: "constrict",
      name: "Constrict",
      budget: "action",
      toHit: 30,
      damage: { flat: 5, type: "bludgeoning" },
      reach: 10,
      targetTypes: { is: { upToSize: "large" } },
    },
  ]);
  const elemental = creature("water-elemental", "large", [
    {
      id: "whelm",
      name: "Whelm",
      budget: "action",
      save: { save: "str_save", difficulty: 15, onSuccess: "negates" },
      targetCount: 3,
      reach: 30,
      applies: [{ condition: "whelmed", duration: "instant" }],
    },
  ]);
  const moundActions = (allHit: Record<string, unknown> = {}) => [
    { id: "slam", name: "Slam", budget: "action", toHit: 0, damage: { flat: 3, type: "bludgeoning" }, reach: 5 },
    {
      id: "engulf",
      name: "Engulf",
      budget: "action",
      engulf: { upToSize: "medium", save: { save: "dex_save", difficulty: 12 }, room: { of: 1 } },
      applies: [{ condition: "mound_engulfed", duration: "instant" }],
    },
    {
      id: "multiattack",
      name: "Multiattack",
      budget: "action",
      sequence: [{ action: "slam", times: 2 }],
      allHit: {
        targetIs: { upToSize: "medium" },
        applies: [{ condition: "grappled", duration: "instant", escapeDc: 14 }],
        uses: "engulf",
        ...allHit,
      },
    },
  ];
  const mound = creature("shambling-mound", "large", moundActions());
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(behir), structuredClone(elemental), structuredClone(mound));
    doc.sheet.live.conditions.push(
      { id: "swallowed", label: "Swallowed" },
      { id: "whelmed", label: "Whelmed" },
      { id: "mound_engulfed", label: "Engulfed" },
    );
    doc.combat.conditions.push(
      {
        condition: "swallowed",
        effects: ["speed-zero"],
        inside: {
          releasedWhen: { dealt: 30, save: { save: "con_save", difficulty: 14 }, prone: true },
          corpse: { costs: 20, prone: true },
        },
        endsWhenSourceDown: true,
      },
      { condition: "whelmed", effects: ["speed-zero"], inside: { room: { of: 2, takes: { large: 2 } } } },
      { condition: "mound_engulfed", effects: ["speed-zero"], inside: true, endsWhenSourceDown: true },
    );
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
        { id: "huge", label: "Huge", cells: 3 },
      ],
      default: "medium",
    };
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hero = (size = "medium", blow = 35): RulesetStatBlock => ({
    health: 60,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    size,
    saves: { dex_save: 0, con_save: 0, str_save: 0 },
    actions: [{ id: "blade", name: "Blade", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: blow } }],
  });
  const definition = parsed(document());
  const block = (id: string, def: RulesetDefinition = definition) =>
    rulesetCreatureBlock(
      def,
      def.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!.find((one) => one.id === id),
    )!;
  const has = (def: RulesetDefinition, state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(def, who(state, id)).includes(condition);

  /** One creature at 0,0, heroes in a column at x 3 and a lurker far off, taking turns in that order. */
  const fight = (
    monster: string,
    heroes: Record<string, RulesetStatBlock>,
    def: RulesetDefinition = definition,
    column = 3,
  ): RulesetEncounterState => {
    // Somebody else on its side far off, so the fight goes on once it falls.
    const places: Record<string, { x: number; y: number }> = { monster: { x: 0, y: 0 }, lurker: { x: 11, y: 7 } };
    Object.keys(heroes).forEach((id, index) => (places[id] = { x: column, y: index * 2 }));
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "monster", name: monster, side: "enemy", block: block(monster, def) },
        ...Object.entries(heroes).map(([id, stats]) => ({ id, name: id, side: "enemy" as const, block: stats })),
        { id: "lurker", name: "Lurker", side: "enemy", block: hero() },
      ],
      board: {
        grid: {
          width: 12,
          height: 8,
          tiles: Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => "plains")),
        } as never,
        placements: places,
      },
    });
    for (const id of Object.keys(heroes)) who(state, id).side = "party";
    state.order = ["monster", ...Object.keys(heroes), "lurker"];
    state.turn = 0;
    return state;
  };
  const choose = (
    def: RulesetDefinition,
    state: RulesetEncounterState,
    actorId: string,
    actionId: string,
    targetIds: string[],
    roller: RulesetCombatRoller = () => 10,
  ) => {
    const option = rulesetCombatOptions(def, state, actorId).find(
      (one) => one.id === actionId || one.id.endsWith(`:${actionId}`) || one.id.startsWith(`${actionId}`),
    );
    assert.ok(option, `${actorId} has ${actionId}: ${rulesetCombatOptions(def, state, actorId).map((one) => one.id)}`);
    const done = applyRulesetCombatChoice(def, state, { actorId, optionId: option.id, targetIds }, roller);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  /** These rolls in order, then 10s. */
  const queue =
    (...rolls: number[]): RulesetCombatRoller =>
    () =>
      rolls.shift() ?? 10;
  const endTurn = (def: RulesetDefinition, state: RulesetEncounterState, roller: RulesetCombatRoller = () => 10) =>
    applyRulesetCombatChoice(
      def,
      state,
      { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] },
      roller,
    );

  /** The behir swallows brenna, and it is her turn. */
  const swallowed = (def: RulesetDefinition = definition, blow = 35, others: Record<string, RulesetStatBlock> = {}) => {
    const heroes = { brenna: hero("medium", blow), ...others };
    const bitten = choose(def, fight("behir", heroes, def), "monster", "bite", ["brenna"]);
    assert.equal(who(bitten.state, "brenna").insideOf, "monster", JSON.stringify(bitten.events));
    const turn = endTurn(def, bitten.state);
    assert.equal(turn.state.order[turn.state.turn], "brenna");
    return turn.state;
  };

  // ── Regurgitate: 30 or more from inside in one turn, the behir fails its save ──
  {
    const hit = choose(definition, swallowed(), "brenna", "blade", ["monster"]);
    assert.equal(who(hit.state, "brenna").insideOf, "monster", "still inside until the turn ends");
    const ended = endTurn(definition, hit.state, () => 10);
    const saves = of(ended.events, "save").filter((one) => one.actorId === "monster");
    assert.equal(saves.length, 1, JSON.stringify(ended.events));
    assert.equal(who(ended.state, "brenna").insideOf, undefined, "let out");
    assert.ok(of(ended.events, "inside").some((one) => one.targetId === "brenna" && one.out));
    assert.ok(has(definition, ended.state, "brenna", "prone"), "let out prone");
    assert.ok(!has(definition, ended.state, "brenna", "swallowed"));
  }
  // Saved: kept.
  {
    const hit = choose(definition, swallowed(), "brenna", "blade", ["monster"]);
    const ended = endTurn(definition, hit.state, () => 20);
    assert.equal(who(ended.state, "brenna").insideOf, "monster");
    assert.ok(!has(definition, ended.state, "brenna", "prone"));
  }
  // Less than 30: no save at all.
  {
    const hit = choose(definition, swallowed(definition, 20), "brenna", "blade", ["monster"]);
    const ended = endTurn(definition, hit.state, () => 10);
    assert.equal(of(ended.events, "save").filter((one) => one.actorId === "monster").length, 0);
    assert.equal(who(ended.state, "brenna").insideOf, "monster");
  }

  // ── The corpse: slain from inside, she climbs out for 20 feet of her walk, prone ──
  {
    const state = swallowed();
    assert.ok(
      !rulesetCombatOptions(definition, state, "brenna").some((one) => one.id === RULESET_CLIMB_OUT_OPTION),
      "nothing to climb out of while it stands",
    );
    const low = structuredClone(state);
    const monster = who(low, "monster");
    monster.health = { ...monster.health!, value: 1 };
    const slain = choose(definition, low, "brenna", "blade", ["monster"]);
    assert.ok(who(slain.state, "monster").defeated);
    assert.ok(!has(definition, slain.state, "brenna", "swallowed"), "the condition ended with it");
    assert.equal(who(slain.state, "brenna").insideOf, "monster", "still inside the corpse");
    const climb = rulesetCombatOptions(definition, slain.state, "brenna").find(
      (one) => one.id === RULESET_CLIMB_OUT_OPTION,
    );
    assert.ok(climb, JSON.stringify(rulesetCombatOptions(definition, slain.state, "brenna").map((one) => one.id)));
    assert.equal(climb.movementCost, 4, "20 feet is four cells");
    const left = who(slain.state, "brenna").movementLeft!;
    const out = applyRulesetCombatChoice(
      definition,
      slain.state,
      { actorId: "brenna", optionId: RULESET_CLIMB_OUT_OPTION, targetIds: [] },
      () => 10,
    );
    assert.deepEqual(of(out.events, "refused"), [], JSON.stringify(out.events));
    assert.equal(who(out.state, "brenna").insideOf, undefined);
    assert.equal(who(out.state, "brenna").movementLeft, left - 4);
    assert.ok(has(definition, out.state, "brenna", "prone"));
    const placed = who(out.state, "brenna");
    assert.ok(placed.x! >= 3 || placed.y! >= 3, "set down outside the corpse");
  }
  // Slain from outside, out of turn: on her own turn she has her walk to climb out with.
  {
    const low = endTurn(definition, swallowed(definition, 35, { archer: hero() })).state;
    assert.equal(low.order[low.turn], "archer");
    const monster = who(low, "monster");
    monster.health = { ...monster.health!, value: 1 };
    const slain = choose(definition, low, "archer", "blade", ["monster"]);
    assert.ok(who(slain.state, "monster").defeated);
    let next = slain.state;
    for (let step = 0; step < 4 && next.order[next.turn] !== "brenna"; step++) next = endTurn(definition, next).state;
    assert.equal(next.order[next.turn], "brenna");
    assert.equal(who(next, "brenna").insideOf, "monster");
    assert.ok(rulesetCombatOptions(definition, next, "brenna").some((one) => one.id === RULESET_CLIMB_OUT_OPTION));
  }

  // ── Whelm: one Large, or two Medium ──
  {
    const state = fight("water-elemental", { big: hero("large"), anna: hero(), bert: hero() });
    const whelmed = choose(definition, state, "monster", "whelm", ["big", "anna", "bert"], () => 1);
    assert.equal(who(whelmed.state, "big").insideOf, "monster");
    for (const id of ["anna", "bert"]) {
      assert.equal(who(whelmed.state, id).insideOf, undefined, `${id} does not fit`);
      assert.ok(!has(definition, whelmed.state, id, "whelmed"));
    }
    assert.ok(
      of(whelmed.events, "condition").some((one) => one.targetId === "anna" && one.reason === "full"),
      JSON.stringify(of(whelmed.events, "condition")),
    );
    const two = choose(
      definition,
      fight("water-elemental", { anna: hero(), bert: hero(), cora: hero() }),
      "monster",
      "whelm",
      ["anna", "bert", "cora"],
      () => 1,
    );
    assert.equal(who(two.state, "anna").insideOf, "monster");
    assert.equal(who(two.state, "bert").insideOf, "monster");
    assert.equal(who(two.state, "cora").insideOf, undefined, "a third Medium does not fit");
  }

  // ── A shambling mound: both Slams hit a Medium target, grappled and engulfed ──
  {
    const both = choose(
      definition,
      fight("shambling-mound", { brenna: hero() }, definition, 2),
      "monster",
      "multiattack",
      ["brenna"],
      queue(15, 15, 1),
    );
    assert.equal(of(both.events, "attack").filter((one) => one.outcome !== "miss").length, 2);
    assert.ok(has(definition, both.state, "brenna", "grappled"), JSON.stringify(both.events));
    const grip = who(both.state, "brenna").tracked.find((one) => one.condition === "grappled");
    assert.equal(grip?.source, "monster");
    assert.equal(who(both.state, "brenna").insideOf, "monster", "engulfed on a failed save");
    assert.ok(has(definition, both.state, "brenna", "mound_engulfed"));
    // One missed: nothing more.
    const rolls = [15, 5];
    const once = choose(
      definition,
      fight("shambling-mound", { brenna: hero() }, definition, 2),
      "monster",
      "multiattack",
      ["brenna"],
      () => rolls.shift() ?? 10,
    );
    assert.equal(of(once.events, "attack").filter((one) => one.outcome !== "miss").length, 1);
    assert.ok(!has(definition, once.state, "brenna", "grappled"));
    assert.equal(who(once.state, "brenna").insideOf, undefined);
    // A Large target: hit twice, never grappled.
    const large = choose(
      definition,
      fight("shambling-mound", { big: hero("large") }, definition, 2),
      "monster",
      "multiattack",
      ["big"],
      queue(15, 15, 1),
    );
    assert.equal(of(large.events, "attack").filter((one) => one.outcome !== "miss").length, 2);
    assert.ok(!has(definition, large.state, "big", "grappled"));
    assert.equal(who(large.state, "big").insideOf, undefined);
    // Its engulf full (room of one): grappled, not taken in.
    const first = both.state;
    who(first, "monster").budgets.action = 1;
    const tamsin = { ...who(first, "brenna"), id: "tamsin", name: "tamsin", x: 2, y: 1, tracked: [] };
    delete (tamsin as { insideOf?: string }).insideOf;
    first.combatants.push(tamsin as never);
    const full = choose(definition, first, "monster", "multiattack", ["tamsin"], queue(15, 15, 1));
    assert.ok(has(definition, full.state, "tamsin", "grappled"));
    assert.equal(who(full.state, "tamsin").insideOf, undefined, "no room left inside");
  }

  // ── Constrict: aimed only at Large or smaller ──
  {
    const state = fight("behir", { brenna: hero(), giant: hero("huge") });
    const option = rulesetCombatOptions(definition, state, "monster").find((one) => one.id.endsWith("constrict"))!;
    const ids = rulesetOptionTargets(definition, state, "monster", option);
    assert.ok(ids.includes("brenna"), JSON.stringify(ids));
    assert.ok(!ids.includes("giant"), JSON.stringify(ids));
  }

  // ── Refusals ──
  {
    const condition = (id: string, edit: (one: Record<string, any>) => void) =>
      document((doc) => edit(doc.combat.conditions.find((one: { condition: string }) => one.condition === id)));
    refused(
      condition("whelmed", (one) => (one.inside.room.takes = { titanic: 2 })),
      /Unknown size "titanic"/,
    );
    refused(
      condition("swallowed", (one) => (one.inside.releasedWhen.save.save = "luck_save")),
      /Unknown save "luck_save"/,
    );
    const withMound = (actions: Record<string, unknown>[]) =>
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.find((entry: { id: string }) => entry.id === "shambling-mound").creature.actions = actions;
      });
    refused(withMound(moundActions({ uses: "nothing" })), /"nothing" is not one of its actions/);
    refused(withMound(moundActions({ uses: "multiattack" })), /is a sequence/);
    refused(
      withMound(moundActions({ applies: [{ condition: "nowhere", duration: "instant" }] })),
      /Unknown condition "nowhere"/,
    );
    refused(
      withMound([...moundActions().slice(0, 2), { ...moundActions()[0]!, id: "lone", allHit: { uses: "engulf" } }]),
      /"allHit" is what a sequence does/,
    );
    refused(
      withMound([
        ...moundActions().slice(0, 2),
        { id: "bad", name: "Bad", budget: "action", toHit: 0, reach: 5, targetTypes: { is: { upToSize: "titanic" } } },
      ]),
      /Unknown size "titanic"|titanic/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that holds inside by size, lets out on the blows dealt from inside or out of a fallen holder, or with a creature action aimed by type or with what follows all of a sequence hitting, requires schemaVersion 2 and capabilityApi 1.405 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(404) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(405) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(404) as never, JSON.parse(fiveEText)), gate);
    // A creature action aimed by type alone.
    const typed = JSON.parse(fiveEText);
    typed.catalogs.find(
      (catalog: { holds?: string }) => catalog.holds === "creatures",
    ).entries[0].creature.actions[0].targetTypes = { is: { types: ["humanoid"] } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(404) as never, typed), gate);
  }

  console.log(
    "Swallow: let out prone on 30 from inside and a failed save, kept on a made one; climbed out of a corpse for 20 feet, prone; Whelm holds one Large or two Medium; a mound grapples and engulfs once both Slams hit a Medium target; Constrict only at Large or smaller; gated at 1.405.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
