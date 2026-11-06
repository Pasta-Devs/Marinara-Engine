/**
 * Swallowing, continued (Capability API 1.407).
 *
 *   - A kraken's Bite: hits anybody, swallows only whom the kraken grapples, and the grapple ends.
 *   - A gelatinous cube's engulfed pulled out by an ally beside it: DC 12, 3d6 acid to whoever tries.
 *   - A water elemental's Whelm: DC 14, nothing to the puller.
 *   - A rug of smothering's Damage Transfer: half of each blow onto whom it smothers, one at a time.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pull-out-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 407);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creature = (id: string, actions: Record<string, unknown>[]) => ({
    id,
    label: id,
    creature: {
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 40,
      size: "large",
      tier: "cr_2",
      saves: { con_save: 0, dex_save: 0, str_save: 0 },
      actions,
    },
  });
  const kraken = creature("kraken", [
    {
      id: "tentacle",
      name: "Tentacle",
      budget: "action",
      toHit: 30,
      damage: { flat: 2, type: "bludgeoning" },
      reach: 10,
      applies: [{ condition: "grappled", duration: "instant", escapeDc: 18 }],
    },
    {
      id: "bite",
      name: "Bite",
      budget: "action",
      toHit: 30,
      damage: { flat: 3, type: "piercing" },
      reach: 10,
      applies: [
        {
          condition: "swallowed",
          duration: "instant",
          targetHolds: { fromSelf: ["grappled"] },
          endsOnTarget: ["grappled"],
        },
      ],
    },
  ]);
  const holder = (id: string, applied: Record<string, unknown>) =>
    creature(id, [
      {
        id: "take",
        name: "Take in",
        budget: "action",
        toHit: 30,
        damage: { flat: 1, type: "acid" },
        reach: 5,
        applies: [{ condition: "engulfed", duration: "instant", ...applied }],
      },
    ]);
  const cube = holder("cube", { escapeDc: 12, harmsPuller: { dice: "3d6", type: "acid" } });
  const elemental = holder("whelmer", { escapeDc: 14 });
  const loose = holder("loose", {});
  const rug = creature("rug", [
    {
      id: "smother",
      name: "Smother",
      budget: "action",
      toHit: 30,
      damage: { flat: 1, type: "bludgeoning" },
      reach: 5,
      applies: [
        { condition: "grappled", duration: "instant", escapeDc: 13 },
        { condition: "smothered", duration: "instant", endsWith: "grappled", heldAtMost: 1 },
      ],
    },
  ]);
  const pullOut = {
    id: "pull_out",
    label: "Pull out",
    budget: "action",
    pulls: true,
    targets: "ally",
    targetHolds: "engulfed",
    attacker: { checks: ["might"] },
    onWin: { ends: [{ condition: "engulfed", on: "target" }] },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(...[kraken, cube, elemental, loose, rug].map((one) => structuredClone(one)));
    doc.sheet.live.conditions.push(
      { id: "swallowed", label: "Swallowed" },
      { id: "engulfed", label: "Engulfed" },
      { id: "smothered", label: "Smothered" },
    );
    doc.combat.conditions.push(
      { condition: "swallowed", effects: ["speed-zero"], inside: true, endsWhenSourceDown: true },
      { condition: "engulfed", effects: ["speed-zero"], inside: true, endsWhenSourceDown: true },
      { condition: "smothered", effects: [], takesSourceHarm: { share: 0.5 } },
    );
    doc.combat.contests.push(structuredClone(pullOut));
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
  const hero = (blow = 1): RulesetStatBlock => ({
    health: 60,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    size: "medium",
    saves: { dex_save: 0, con_save: 0, str_save: 0 },
    actions: [{ id: "blade", name: "Blade", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: blow } }],
  });
  const definition = parsed(document());
  const block = (id: string) =>
    rulesetCreatureBlock(
      definition,
      definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!.find((one) => one.id === id),
    )!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);

  /** One creature filling 0,0 to 1,1; brenna beside it at 2,0; `helper` at its place; a lurker far off. */
  const fight = (monster: string, helper: { x: number; y: number } = { x: 2, y: 1 }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "monster", name: monster, side: "enemy", block: block(monster) },
        { id: "brenna", name: "Brenna", side: "party", block: hero() },
        { id: "cael", name: "Cael", side: "party", block: hero(7) },
        { id: "lurker", name: "Lurker", side: "enemy", block: hero() },
      ],
      board: {
        grid: {
          width: 12,
          height: 8,
          tiles: Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => "plains")),
        } as never,
        placements: { monster: { x: 0, y: 0 }, brenna: { x: 2, y: 0 }, cael: helper, lurker: { x: 11, y: 7 } },
      },
    });
    state.order = ["monster", "brenna", "cael", "lurker"];
    state.turn = 0;
    return state;
  };
  const choose = (
    state: RulesetEncounterState,
    actorId: string,
    actionId: string,
    targetIds: string[],
    roller: RulesetCombatRoller = () => 10,
  ) => {
    const option = rulesetCombatOptions(definition, state, actorId).find(
      (one) => one.id === actionId || one.id.endsWith(`:${actionId}`),
    );
    assert.ok(
      option,
      `${actorId} has ${actionId}: ${rulesetCombatOptions(definition, state, actorId).map((one) => one.id)}`,
    );
    const done = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, roller);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const endTurn = (state: RulesetEncounterState) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: state.order[state.turn]!, optionId: "end-turn", targetIds: [] },
      () => 10,
    );
  /** The monster takes brenna in, and it is cael's turn. */
  const takenIn = (monster: string, helper?: { x: number; y: number }) => {
    const taken = choose(fight(monster, helper), "monster", "take", ["brenna"]);
    assert.equal(who(taken.state, "brenna").insideOf, "monster", JSON.stringify(taken.events));
    let state = endTurn(taken.state).state;
    state = endTurn(state).state;
    assert.equal(state.order[state.turn], "cael");
    return state;
  };

  // ── The kraken's Bite ──
  {
    // Not held: bitten, not swallowed.
    const bitten = choose(fight("kraken"), "monster", "bite", ["brenna"]);
    assert.ok(
      of(bitten.events, "damage").some((one) => one.targetId === "brenna"),
      "the bite still lands",
    );
    assert.ok(!has(bitten.state, "brenna", "swallowed"));
    assert.equal(who(bitten.state, "brenna").insideOf, undefined);
    // Held by the kraken: swallowed, and the grapple is over.
    const state = fight("kraken");
    state.combatants
      .find((one) => one.id === "brenna")!
      .tracked.push({
        condition: "grappled",
        rounds: null,
        source: "monster",
        escapeDc: 18,
      } as never);
    const swallowed = choose(state, "monster", "bite", ["brenna"]);
    assert.ok(has(swallowed.state, "brenna", "swallowed"), JSON.stringify(swallowed.events));
    assert.equal(who(swallowed.state, "brenna").insideOf, "monster");
    assert.ok(!has(swallowed.state, "brenna", "grappled"), "the grapple ends");
    // Grappled by somebody else: no swallow, and that grapple stays.
    const other = fight("kraken");
    other.combatants
      .find((one) => one.id === "brenna")!
      .tracked.push({
        condition: "grappled",
        rounds: null,
        source: "lurker",
      } as never);
    const missed = choose(other, "monster", "bite", ["brenna"]);
    assert.ok(!has(missed.state, "brenna", "swallowed"));
    assert.ok(has(missed.state, "brenna", "grappled"));
  }

  // ── The cube: pulled out by an ally beside it ──
  {
    const state = takenIn("cube");
    const pull = rulesetCombatOptions(definition, state, "cael").find((one) => one.id === "contest:pull_out");
    assert.ok(pull, "offered beside the cube");
    assert.deepEqual(rulesetOptionTargets(definition, state, "cael", pull), ["brenna"]);
    // Nobody else reaches inside.
    assert.ok(
      !rulesetOptionTargets(definition, state, "cael", { id: "blade", targets: { side: "enemy", count: 1 } }).includes(
        "brenna",
      ),
    );
    // Short of 12: still inside, and the acid burns all the same.
    const before = who(state, "cael").health!.value;
    const failed = choose(state, "cael", "pull_out", ["brenna"], () => 5);
    const contest = of(failed.events, "contest")[0]!;
    assert.equal(contest.difficulty, 12, JSON.stringify(contest));
    assert.equal(contest.winner, "target");
    const burned = of(failed.events, "damage").find((one) => one.targetId === "cael");
    assert.ok(burned, JSON.stringify(failed.events));
    assert.equal(burned.damageType, "acid");
    assert.equal(burned.rolls.length, 3, "3d6");
    assert.ok(who(failed.state, "cael").health!.value < before);
    assert.equal(who(failed.state, "brenna").insideOf, "monster");
    // Met: out beside the cube, burned too.
    const won = choose(takenIn("cube"), "cael", "pull_out", ["brenna"], () => 15);
    assert.equal(of(won.events, "contest")[0]!.winner, "actor");
    assert.ok(of(won.events, "damage").some((one) => one.targetId === "cael"));
    assert.equal(who(won.state, "brenna").insideOf, undefined, JSON.stringify(won.events));
    assert.ok(!has(won.state, "brenna", "engulfed"));
    assert.ok(of(won.events, "inside").some((one) => one.targetId === "brenna" && one.out));
    // Too far from the cube: not offered on her.
    const far = takenIn("cube", { x: 6, y: 5 });
    assert.deepEqual(rulesetOptionTargets(definition, far, "cael", pull), []);
  }

  // ── Whelm: DC 14, nothing to the puller; a hold with no number is not pulled against ──
  {
    const state = takenIn("whelmer");
    const failed = choose(state, "cael", "pull_out", ["brenna"], () => 13);
    assert.equal(of(failed.events, "contest")[0]!.difficulty, 14);
    assert.equal(of(failed.events, "contest")[0]!.winner, "target");
    assert.ok(!of(failed.events, "damage").some((one) => one.targetId === "cael"));
    const loose = takenIn("loose");
    const pull = rulesetCombatOptions(definition, loose, "cael").find((one) => one.id === "contest:pull_out");
    assert.ok(!pull || rulesetOptionTargets(definition, loose, "cael", pull).length === 0, "no number to meet");
  }

  // ── The rug: 7 to it is 3 to the rug and 4 to brenna; one smothered at a time ──
  {
    const smothered = choose(fight("rug"), "monster", "smother", ["brenna"]);
    assert.ok(has(smothered.state, "brenna", "smothered"), JSON.stringify(smothered.events));
    let state = endTurn(smothered.state).state;
    state = endTurn(state).state;
    const rugBefore = who(state, "monster").health!.value;
    const brennaBefore = who(state, "brenna").health!.value;
    const hit = choose(state, "cael", "blade", ["monster"]);
    const blows = of(hit.events, "damage");
    assert.deepEqual(
      blows.map((one) => [one.targetId, one.dealt]),
      [
        ["monster", 3],
        ["brenna", 4],
      ],
      JSON.stringify(blows),
    );
    assert.equal(blows[1]!.label, "Smothered");
    assert.equal(who(hit.state, "monster").health!.value, rugBefore - 3);
    assert.equal(who(hit.state, "brenna").health!.value, brennaBefore - 4);
    // A second target is not smothered while the first is.
    const again = fight("rug", { x: 2, y: 1 });
    const first = choose(again, "monster", "smother", ["brenna"]);
    first.state.combatants.find((one) => one.id === "monster")!.budgets.action = 1;
    const second = choose(first.state, "monster", "smother", ["cael"]);
    assert.ok(!has(second.state, "cael", "smothered"));
    // Free of the grapple, free of the rug: the whole blow stays on it.
    const free = structuredClone(hit.state);
    free.combatants.find((one) => one.id === "brenna")!.tracked = [];
    free.combatants.find((one) => one.id === "cael")!.budgets.action = 1;
    const alone = choose(free, "cael", "blade", ["monster"]);
    assert.deepEqual(
      of(alone.events, "damage").map((one) => [one.targetId, one.dealt]),
      [["monster", 7]],
    );
  }

  // ── Refusals ──
  {
    const contestWith = (change: Record<string, unknown>) =>
      document((doc) => {
        Object.assign(doc.combat.contests.at(-1), change);
      });
    refused(contestWith({ defender: { checks: ["might"] } }), /"defender" or a fixed "difficulty"/);
    refused(contestWith({ targetHolds: undefined }), /names the hold it pulls out of/);
    refused(contestWith({ targetHolds: "grappled" }), /"grappled" keeps nobody inside a creature/);
    const appliesWith = (change: Record<string, unknown>) =>
      document((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        Object.assign(
          creatures.entries.find((one: { id: string }) => one.id === "cube").creature.actions[0].applies[0],
          change,
        );
      });
    refused(appliesWith({ condition: "grappled" }), /"grappled" keeps nobody inside a creature to be pulled out of/);
    refused(appliesWith({ endsOnTarget: ["engulfed"] }), /does not end itself/);
    refused(appliesWith({ endsOnTarget: ["nothing_here"] }), /Unknown condition "nothing_here"/);
    refused(appliesWith({ targetHolds: { fromSelf: ["nothing_here"] } }), /Unknown condition "nothing_here"/);
    refused(appliesWith({ harmsPuller: { dice: "3d6", type: "sorrow" } }), /Unknown damage type "sorrow"/);
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).takesSourceHarm = { share: 1 };
      }),
      /takesSourceHarm/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that pulls somebody out of a creature, puts a condition on only a held target or ends one with it, or shares a holder's harm (a contest's pulls, targetHolds, endsOnTarget or harmsPuller on what an action puts on, or a condition's takesSourceHarm), requires schemaVersion 2 and capabilityApi 1.407 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(406) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(407) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(406) as never, JSON.parse(fiveEText)), gate);
    // Each on its own.
    const only = (edit: (doc: Record<string, any>) => void) => {
      const doc = JSON.parse(fiveEText);
      edit(doc);
      return getCapabilityPackageInstallIssue(manifest(406) as never, doc);
    };
    assert.equal(
      only((doc) => doc.combat.contests.push({ ...pullOut, targetHolds: "grappled" })),
      gate,
    );
    assert.equal(
      only((doc) =>
        doc.combat.conditions.push({ condition: "grappled", effects: [], takesSourceHarm: { share: 0.5 } }),
      ),
      gate,
    );
    assert.equal(
      only((doc) =>
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.push(structuredClone(kraken)),
      ),
      gate,
    );
  }

  console.log(
    "Pull out: a kraken swallows only whom it grapples and the grapple ends; an ally beside a cube pulls its engulfed out at DC 12 and is burned win or lose; Whelm at 14; a rug passes half of each blow to whom it smothers; gated at 1.407.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
