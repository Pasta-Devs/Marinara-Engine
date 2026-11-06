/**
 * Breaths that recharge together, and a charging blow (Capability API 1.186).
 *
 *   - `recharge.group`: a dragon's two breaths. Using either spends both, and one roll at the start of
 *     its turn brings both back, or leaves both spent.
 *   - `charge`: a minotaur's gore after a run of at least 10 feet straight at its target this turn adds
 *     2d8, then a Strength save, and on a failure a 10-foot push and prone. A run that is too short,
 *     that ends with a step no closer, that was walked last turn, or a blow at somebody else, carries
 *     nothing. A bestiary minotaur charges as one written out does.
 *   - `charge.then` naming the charging action (1.574): a warhorse's Trampling Charge, its hooves again
 *     from its bonus action, carrying no charge the second time.
 *   - `charge.then` (1.546): a lion's Pounce, a bite paid from its bonus action at the one its charge
 *     knocked prone, and at nobody else; none when the charge left it standing.
 *   - Import refusals, and the install gate.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-charge-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 181);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  // Every die but the d20 rolls its lowest; a recharge's d6 rolls what `six` says.
  let six = 1;
  const roller = (sides: number) => (sides === 20 ? 10 : sides === 6 ? six : 1);

  const gore = {
    id: "gore",
    name: "Gore",
    targets: "any" as const,
    budget: "action",
    toHit: 30,
    reach: 5,
    damage: { count: 2, sides: 12, flat: 4, type: "piercing" },
    charge: {
      atLeast: 10,
      plus: [{ count: 2, sides: 8, flat: 0, type: "piercing" }],
      save: { save: "str_save", difficulty: 14 },
      push: 10,
      applies: [{ condition: "prone", duration: "instant" as const }],
    },
  };
  const fire = {
    id: "fire",
    name: "Fire Breath",
    targets: "any" as const,
    budget: "action",
    area: { shape: "cone" as const, size: 15 },
    save: { save: "dex_save", difficulty: 13, onSuccess: "half" as const },
    damage: { count: 0, sides: 6, flat: 5, type: "fire" },
    recharge: { dice: { count: 1, sides: 6 }, from: 5, group: "breath" },
  };
  const sleep = {
    id: "sleep",
    name: "Sleep Breath",
    targets: "any" as const,
    budget: "action",
    area: { shape: "cone" as const, size: 15 },
    save: { save: "con_save", difficulty: 13, onSuccess: "negates" as const },
    applies: [{ condition: "unconscious", duration: { rounds: 1 } }],
    recharge: { dice: { count: 1, sides: 6 }, from: 5, group: "breath" },
  };
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 40,
    saves: { str_save: -10, dex_save: -10, con_save: 30 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (
    places: Record<string, RulesetCombatCell>,
    hero: Partial<RulesetStatBlock> = {},
    beast: RulesetStatBlock = block({ actions: [gore as never, fire as never, sleep as never] }),
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "beast", name: "Beast", side: "enemy", block: beast },
        { id: "hero", name: "Hero", side: "enemy", block: block(hero) },
        { id: "other", name: "Other", side: "enemy", block: block(hero) },
      ],
      board: { grid: grid(), placements: { other: { x: 1, y: 1 }, ...places } as never },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const prone = (state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes("prone");
  const choose = (
    state: RulesetEncounterState,
    actorId: string,
    optionId: string,
    extra: { to?: RulesetCombatCell; at?: RulesetCombatCell; targetIds?: string[] } = {},
  ) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId, targetIds: extra.targetIds ?? [], ...extra },
      roller,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      `${actorId} ${optionId}`,
    );
    return step;
  };
  const walk = (state: RulesetEncounterState, to: RulesetCombatCell) =>
    choose(state, "beast", RULESET_MOVE_OPTION, { to }).state;
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "beast").find((one) => one.label === label);
  const strike = (state: RulesetEncounterState, targetId = "hero") =>
    choose(state, "beast", optionOf(state, "Gore")!.id, { targetIds: [targetId] });
  const charged = (events: readonly RulesetCombatEvent[]) => events.some((one) => one.type === "charged");

  // ── A straight run of six squares, then the gore ──
  {
    const ran = walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }), { x: 8, y: 7 });
    const hit = strike(ran);
    assert.ok(charged(hit.events), "the run counts");
    // 2d12 + 4 at their lowest is 6, and the charge's 2d8 adds 2.
    assert.equal(health(hit.state, "hero"), 92);
    assert.deepEqual(at(hit.state, "hero"), { x: 11, y: 7 }, "pushed two squares");
    assert.ok(prone(hit.state, "hero"));
    assert.ok(hit.events.some((one) => one.type === "save" && one.actorId === "hero"));
    const held = strike(
      walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }, { saves: { str_save: 30 } }), { x: 8, y: 7 }),
    );
    assert.equal(health(held.state, "hero"), 92, "the damage lands whatever the save");
    assert.deepEqual(at(held.state, "hero"), { x: 9, y: 7 });
    assert.ok(!prone(held.state, "hero"));
  }

  // ── Runs that carry nothing ──
  {
    const still = strike(fight({ beast: { x: 8, y: 7 }, hero: { x: 9, y: 7 } }));
    assert.ok(!charged(still.events), "no run at all");
    assert.equal(health(still.state, "hero"), 94);
    assert.deepEqual(at(still.state, "hero"), { x: 9, y: 7 });
    assert.ok(!prone(still.state, "hero"));
    assert.ok(!still.events.some((one) => one.type === "save"), "no save without the charge");
    // One square closer is five feet.
    const short = strike(walk(fight({ beast: { x: 7, y: 7 }, hero: { x: 9, y: 7 } }), { x: 8, y: 7 }));
    assert.ok(!charged(short.events), "too short");
    // Two squares closer from the side counts: each step a square nearer.
    const slant = strike(walk(fight({ beast: { x: 7, y: 5 }, hero: { x: 9, y: 7 } }), { x: 8, y: 6 }));
    assert.ok(!charged(slant.events), "one diagonal square is still five feet");
    const corner = strike(walk(fight({ beast: { x: 6, y: 4 }, hero: { x: 9, y: 7 } }), { x: 8, y: 6 }));
    assert.ok(charged(corner.events), "two diagonal squares straight at them");
    // A run that ends with a step no closer is no charge, even walked as a second move.
    const ran = walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }), { x: 8, y: 7 });
    const aside = strike(walk(ran, { x: 8, y: 8 }));
    assert.ok(!charged(aside.events), "the last step went sideways");
    // A run at the hero is no charge at somebody beside its end: the last step came no closer to them.
    const elsewhere = walk(
      walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 }, other: { x: 7, y: 8 } }), { x: 6, y: 7 }),
      { x: 7, y: 7 },
    );
    const wrong = strike(elsewhere, "other");
    assert.ok(!charged(wrong.events), "the other was not run at");
    // Moved off the end of the walk by something else, the run is over too.
    const shoved = walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }), { x: 8, y: 7 });
    who(shoved, "beast").y = 6;
    assert.ok(!charged(strike(shoved).events), "not where the run ended");
    // Walked last turn: the run is over once the turn is.
    let state = walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }), { x: 8, y: 7 });
    state = choose(state, "beast", "end-turn").state;
    state = choose(state, "hero", "end-turn").state;
    state = choose(state, "other", "end-turn").state;
    assert.equal(state.order[state.turn], "beast");
    assert.ok(!charged(strike(state).events), "last turn's run");
  }

  // ── A minotaur out of the bestiary charges as one written out does ──
  {
    const beast = rulesetCreatureBlock(definition, {
      id: "minotaur",
      label: "Minotaur",
      creature: {
        ...block(),
        actions: [
          {
            ...gore,
            damage: { dice: "2d12", flat: 4, type: "piercing" },
            charge: {
              ...gore.charge,
              // A clause's save with no number of its own takes the charge's.
              plus: [
                { dice: "2d8", type: "piercing" },
                { flat: 1, type: "poison", save: { save: "con_save", onSuccess: "half" } },
              ],
            },
          },
        ],
        tier: "cr_0",
      },
    } as never);
    assert.ok(beast);
    const hit = strike(walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 } }, {}, beast), { x: 8, y: 7 }));
    assert.ok(charged(hit.events));
    assert.equal(health(hit.state, "hero"), 92);
    assert.deepEqual(at(hit.state, "hero"), { x: 11, y: 7 }, "ten feet is two squares");
    assert.ok(prone(hit.state, "hero"));
    const poison = hit.events.find((one) => one.type === "save" && one.save === "con_save");
    assert.ok(poison && poison.type === "save" && poison.difficulty === 14, "the charge's number");
    // And a bestiary dragon's breaths recharge together.
    const wyrm = rulesetCreatureBlock(definition, {
      id: "wyrm",
      label: "Wyrm",
      creature: {
        ...block(),
        actions: [
          { ...fire, damage: { flat: 5, type: "fire" } },
          { ...sleep, applies: [{ condition: "unconscious", duration: { rounds: 1 } }] },
        ],
        tier: "cr_0",
      },
    } as never);
    let breathed = fight({ beast: { x: 5, y: 7 }, hero: { x: 6, y: 7 } }, {}, wyrm!);
    breathed = choose(breathed, "beast", optionOf(breathed, "Fire Breath")!.id, { at: { x: 6, y: 7 } }).state;
    assert.equal(who(breathed, "beast").spent.length, 2, "both of the bestiary's breaths");
  }

  // ── Two breaths, one recharge ──
  {
    six = 1;
    let state = fight({ beast: { x: 5, y: 7 }, hero: { x: 6, y: 7 } });
    assert.ok(optionOf(state, "Fire Breath") && optionOf(state, "Sleep Breath"));
    state = choose(state, "beast", optionOf(state, "Fire Breath")!.id, { at: { x: 6, y: 7 } }).state;
    assert.equal(who(state, "beast").spent.length, 2, "both breaths are spent");
    const round = (from: RulesetEncounterState) => {
      let next = choose(from, "beast", "end-turn").state;
      next = choose(next, "hero", "end-turn").state;
      return choose(next, "other", "end-turn");
    };
    // A 1 brings neither back, and it is rolled once for both.
    const missed = round(state);
    const rolls = missed.events.filter((one) => one.type === "recharge");
    assert.equal(rolls.length, 1, "one roll for the group");
    assert.ok(
      rolls[0]!.type === "recharge" &&
        !rolls[0]!.back &&
        /Fire Breath/.test(rolls[0]!.label) &&
        /Sleep Breath/.test(rolls[0]!.label),
    );
    assert.equal(optionOf(missed.state, "Sleep Breath"), undefined, "the other breath is spent too");
    assert.equal(optionOf(missed.state, "Fire Breath"), undefined);
    six = 5;
    const back = round(missed.state);
    assert.equal(back.events.filter((one) => one.type === "recharge").length, 1);
    assert.ok(optionOf(back.state, "Sleep Breath") && optionOf(back.state, "Fire Breath"), "both come back");
    six = 1;
    // A breath that recharges on its own keeps doing so.
    const alone = block({
      actions: [{ ...fire, recharge: { dice: { count: 1, sides: 6 }, from: 5 } } as never, sleep as never],
    });
    let solo = fight({ beast: { x: 5, y: 7 }, hero: { x: 6, y: 7 } }, {}, alone);
    solo = choose(solo, "beast", optionOf(solo, "Fire Breath")!.id, { at: { x: 6, y: 7 } }).state;
    assert.equal(who(solo, "beast").spent.length, 1, "a breath outside the group is spent alone");
  }

  // ── Import refusals ──
  const withCreature = (creature: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [{ id: "b", label: "B", creature }],
      });
    });
  const minotaur = {
    ...block(),
    actions: [
      {
        ...gore,
        damage: { dice: "2d12", flat: 4, type: "piercing" },
        charge: { ...gore.charge, plus: [{ dice: "2d8", type: "piercing" }] },
      },
    ],
    tier: "cr_0",
  };
  const goreWithThen = () => ({
    ...minotaur,
    actions: [
      {
        ...minotaur.actions[0],
        charge: { ...minotaur.actions[0]!.charge, then: { action: "bite", budget: "bonus", targetHolds: ["prone"] } },
      },
      { id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 5, damage: { dice: "1d10", type: "piercing" } },
    ],
  });
  const dragon = {
    ...block(),
    actions: [
      { ...fire, damage: { flat: 5, type: "fire" } },
      { ...sleep, applies: [{ condition: "unconscious", duration: { rounds: 1 } }] },
    ],
    tier: "cr_0",
  };
  {
    parsed(withCreature(minotaur));
    parsed(withCreature(dragon));
    parsed(withCreature(goreWithThen()));
    const refused = (creature: Record<string, unknown>, message: RegExp) => {
      const result = parseRulesetDefinition(withCreature(creature));
      assert.ok(
        !result.ok && result.issues.some((issue) => message.test(issue)),
        result.ok ? "accepted" : result.issues.join("; "),
      );
    };
    const goreWith = (charge: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      ...minotaur,
      actions: [{ ...minotaur.actions[0], ...extra, charge: { ...minotaur.actions[0]!.charge, ...charge } }],
    });
    refused(goreWith({ save: { save: "luck_save", difficulty: 14 } }), /Unknown save "luck_save"/);
    refused(goreWith({ applies: [{ condition: "dizzy", duration: "instant" }] }), /Unknown condition "dizzy"/);
    refused(goreWith({ plus: [{ dice: "2d8", type: "shiny" }] }), /Unknown damage type "shiny"/);
    refused(goreWith({}, { save: { save: "str_save", difficulty: 10, onSuccess: "none" } }), /cannot ask another/);
    refused(goreWith({}, { toHit: undefined }), /A charge rides a blow at one target/);
    refused(goreWith({}, { targetCount: 2 }), /A charge rides a blow at one target/);
    refused(goreWith({ plus: undefined, push: undefined, applies: undefined }), /A charge adds damage/);
    refused(goreWith({ then: { action: "maul", budget: "bonus" } }), /Unknown action "maul"/);
    refused(goreWith({ then: { action: "gore", budget: "luck" } }), /Unknown action "gore"|Unknown budget "luck"/);
    refused(
      {
        ...dragon,
        actions: [
          dragon.actions[0],
          { ...dragon.actions[1], recharge: { dice: { count: 1, sides: 6 }, from: 6, group: "breath" } },
        ],
      },
      /roll the same dice from the same number/,
    );
    refused({ ...dragon, actions: [dragon.actions[0]] }, /Only one action recharges as "breath"/);
  }

  // ── A lion's Pounce: knocked prone by the charge, a bite from its bonus action, at it alone ──
  {
    const bite = {
      id: "bite",
      name: "Bite",
      targets: "any" as const,
      budget: "action",
      toHit: 30,
      reach: 5,
      damage: { count: 1, sides: 10, flat: 0 },
    };
    const pounce = {
      ...gore,
      id: "claw",
      name: "Gore",
      charge: { ...gore.charge, push: undefined, then: { action: "bite", budget: "bonus", targetHolds: ["prone"] } },
    };
    const lion = block({ actions: [pounce as never, bite as never] });
    const run = (saves?: Record<string, number>) =>
      walk(
        fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 }, other: { x: 8, y: 8 } }, saves ? { saves } : {}, lion),
        { x: 8, y: 7 },
      );
    const hit = strike(run());
    assert.ok(charged(hit.events) && prone(hit.state, "hero"));
    const follow = optionOf(hit.state, "Bite");
    assert.ok(follow, "a bite after the pounce");
    assert.equal(follow.budget, "bonus");
    assert.deepEqual(
      rulesetOptionTargets(definition, hit.state, "beast", follow, true),
      ["hero"],
      "at the one it pounced on",
    );
    const bitten = choose(hit.state, "beast", follow.id, { targetIds: ["hero"] });
    assert.equal(who(bitten.state, "beast").budgets.bonus, 0, "its bonus action spent");
    assert.equal(optionOf(bitten.state, "Bite"), undefined, "once");
    const stood = strike(run({ str_save: 30, dex_save: -10, con_save: 30 }));
    assert.ok(!prone(stood.state, "hero"));
    assert.equal(optionOf(stood.state, "Bite"), undefined, "not prone: no bite");

    // A warhorse's Trampling Charge (1.574): its hooves again, from its bonus action, uncharged.
    const hooves = {
      ...pounce,
      charge: { ...pounce.charge, then: { action: "claw", budget: "bonus", targetHolds: ["prone"] } },
    };
    const horse = block({ actions: [hooves as never] });
    const trampled = strike(
      walk(fight({ beast: { x: 2, y: 7 }, hero: { x: 9, y: 7 }, other: { x: 8, y: 8 } }, {}, horse), { x: 8, y: 7 }),
    );
    assert.ok(charged(trampled.events) && prone(trampled.state, "hero"));
    const again = optionOf(trampled.state, "Gore");
    assert.ok(again, "the hooves again");
    assert.equal(again.budget, "bonus");
    const second = choose(trampled.state, "beast", again.id, { targetIds: ["hero"] });
    assert.ok(!charged(second.events), "no charge the second time");
    assert.equal(who(second.state, "beast").budgets.bonus, 0);
    assert.equal(optionOf(second.state, "Gore"), undefined, "once");
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
      "A ruleset with creature actions that recharge together or charge requires schemaVersion 2 and capabilityApi 1.186 or newer";
    for (const [label, doc] of [
      ["charge", withCreature(minotaur)],
      ["recharge group", withCreature(dragon)],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(185) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(186) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(185) as never, fiveE()), gate, "the plain 5e example");
    const pounced = withCreature(goreWithThen());
    const thenGate =
      "A ruleset with a charge that lets another action follow (charge then) requires schemaVersion 2 and capabilityApi 1.546 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(545) as never, pounced), thenGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(546) as never, pounced), thenGate);
    const trampling = withCreature({
      ...minotaur,
      actions: [
        {
          ...minotaur.actions[0],
          charge: { ...minotaur.actions[0]!.charge, then: { action: "gore", budget: "bonus" } },
        },
      ],
    });
    parsed(trampling);
    const againGate =
      "A ruleset with a charge followed by the charging action again (charge then) requires schemaVersion 2 and capabilityApi 1.574 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(573) as never, trampling), againGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(574) as never, trampling), againGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(573) as never, pounced), againGate);
  }

  console.log(
    "Ruleset charges and shared recharges: a gore after a straight run adds its dice, push and knockdown, a short or bent or old run adds nothing, and two breaths are spent and recharged together.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
