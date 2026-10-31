/**
 * How much thought a creature puts into a fight (Capability API 1.761), and the rest of what the Engine
 * weighs for the creatures it plays.
 *
 *   - A creature's mind is its own `mind`, else its type's, else the tier its `combat.minds` ability
 *     reaches; legendary makes `tactical` a `genius`. With nothing said, a beast fights by instinct and
 *     a construct or an ooze never thinks.
 *   - A mindless creature goes at whoever is nearest and stays on them; a thinking one finishes the
 *     weak. A cowardly one that is hurt gets away; a protective one goes at whoever is on its hurt friend.
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
  RULESET_PASS_OPTION,
  rulesetCombatantMind,
  rulesetReachableCells,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type CombatAiHints,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetAreaCells } from "../../packages/shared/src/features/ruleset-combat/grid.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-minds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, pickRulesetChoice } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 761);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const types = [
    { id: "beast", label: "Beast", mind: "instinct" },
    { id: "construct", label: "Construct", mind: "mindless" },
    { id: "humanoid", label: "Humanoid" },
    { id: "monstrosity", label: "Monstrosity" },
    { id: "undead", label: "Undead" },
    { id: "ooze", label: "Ooze" },
  ];
  const minds = {
    ability: "int",
    tiers: [
      { atLeast: 0, mind: "mindless" },
      { atLeast: 3, mind: "cunning" },
      { atLeast: 8, mind: "tactical" },
      { atLeast: 15, mind: "genius" },
    ],
  };
  const fiveE = (options: { types?: unknown; minds?: unknown } = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = { types: options.types ?? types };
    if (options.minds !== null) doc.combat.minds = options.minds ?? minds;
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const claw = {
    id: "claw",
    name: "Claw",
    budget: "action",
    toHit: 4,
    damage: { count: 1, sides: 6, flat: 2 },
    reach: 1,
  };
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      actions: [claw],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const definition = parsed(fiveE());

  // ── Its mind, from its own data ──
  {
    const mindOf = (def: RulesetDefinition, extra: Record<string, unknown>) => {
      const state = createRulesetEncounter({
        definition: def,
        seed: 1,
        roller: () => 10,
        combatants: [{ id: "it", name: "It", side: "enemy", block: block(extra) }],
      });
      return rulesetCombatantMind(def, rulesetCombatant(state, "it")!);
    };
    const int = (score: number) => ({ abilities: { str: 10, dex: 10, con: 10, int: score, wis: 10, cha: 10 } });
    assert.equal(mindOf(definition, { type: "monstrosity", ...int(22) }), "genius", "a kraken");
    assert.equal(mindOf(definition, { type: "beast", ...int(6) }), "instinct", "an ape, by its type");
    assert.equal(mindOf(definition, { type: "construct", ...int(6) }), "mindless", "a golem, by its type");
    assert.equal(mindOf(definition, { type: "undead", ...int(3), mind: "mindless" }), "mindless", "a zombie, its own");
    assert.equal(mindOf(definition, { type: "humanoid", ...int(7) }), "cunning", "an orc");
    assert.equal(mindOf(definition, { type: "humanoid", ...int(10) }), "tactical", "a soldier");
    assert.equal(
      mindOf(definition, { type: "humanoid", ...int(12), legendaryResistance: 3 }),
      "genius",
      "legendary makes a tactician a genius",
    );
    assert.equal(mindOf(definition, { type: "undead", ...int(1) }), "mindless", "Intelligence 1");
    // A ruleset that says nothing of minds still knows an animal and a thing that never thinks.
    const bare = parsed(fiveE({ types: types.map(({ mind: _mind, ...one }) => one), minds: null }));
    assert.equal(mindOf(bare, { type: "beast" }), "instinct");
    assert.equal(mindOf(bare, { type: "ooze" }), "mindless");
    assert.equal(mindOf(bare, { type: "humanoid" }), undefined, "played as it always was");

    // A bestiary creature's own mind, morale and leader reach the fight (1.761, 1.762).
    const doc = fiveE();
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const lurker = creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker");
    Object.assign(lurker.creature, { type: "undead", mind: "mindless", morale: 8, leader: true });
    const withLurker = parsed(doc);
    const entry = withLurker
      .catalogs!.find((one) => one.holds === "creatures")!
      .entries!.find((one) => one.id === "thorn-lurker")!;
    const built = rulesetStatBlockFromCreature(withLurker, (entry as { creature: never }).creature)!;
    const state = createRulesetEncounter({
      definition: withLurker,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "it", name: "It", side: "enemy", block: built }],
    });
    const it = rulesetCombatant(state, "it")!;
    assert.equal(rulesetCombatantMind(withLurker, it), "mindless", "a zombie's own mind, from the bestiary");
    assert.equal(it.block?.morale, 8);
    assert.equal(it.block?.leader, true);
  }

  // ── How the Engine plays them ──
  const unit = (id: string, side: "player" | "enemy", aiHints?: CombatAiHints) => ({
    id,
    name: id,
    side,
    hp: 20,
    maxHp: 20,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 9,
    skills: [],
    ...(aiHints ? { aiHints } : {}),
  });
  const fight = (
    placements: Record<string, { x: number; y: number }>,
    blocks: Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; health?: number }>,
    hints: Record<string, CombatAiHints> = {},
  ) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 10, height: 6, tiles: Array.from({ length: 6 }, () => Array(10).fill("plains")) },
        placements,
      } as never,
    });
    for (const [id, one] of Object.entries(blocks))
      if (one.health !== undefined) {
        const combatant = rulesetCombatant(encounter, id)!;
        combatant.health = { ...combatant.health!, value: one.health };
      }
    encounter.order = Object.keys(blocks);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: Object.entries(blocks)
        .filter(([, one]) => one.side === "party")
        .map(([id]) => unit(id, "player", hints[id])),
      enemies: Object.entries(blocks)
        .filter(([, one]) => one.side === "enemy")
        .map(([id]) => unit(id, "enemy", hints[id])),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    // A temperament asked for is the one it has, not merely the likeliest.
    for (const one of [...state.party, ...state.enemies]) {
      const temperament = hints[one.id]?.temperament;
      if (temperament && one.tactics) one.tactics.adjective = temperament;
    }
    return { encounter, state };
  };
  const master = { proficiency: "master" as const };

  // A mindless zombie goes at the nearest; a thinking one at whoever it can finish.
  for (const [mind, expected] of [
    ["mindless", "tank"],
    ["tactical", "weak"],
  ] as const) {
    const { encounter, state } = fight(
      { it: { x: 2, y: 2 }, tank: { x: 3, y: 2 }, weak: { x: 4, y: 4 } },
      {
        it: { side: "enemy", block: block({ type: "undead", mind }) },
        tank: { side: "party", block: block({ health: 40 }) },
        weak: { side: "party", block: block(), health: 1 },
      },
      { it: master },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "it");
    assert.equal(picked?.targetId, expected, `${mind}: ${JSON.stringify(picked?.choice)}`);
    assert.equal(state.enemies[0]!.tactics!.mind, mind, "its profile made with its mind");
  }

  // Whom it goes for by what it is (P6): a genius at whoever has done its side the most harm, an animal
  // at the weaker.
  for (const [mind, expected] of [
    ["genius", "striker"],
    ["instinct", "near"],
  ] as const) {
    const { encounter, state } = fight(
      { it: { x: 2, y: 2 }, near: { x: 3, y: 2 }, striker: { x: 3, y: 3 } },
      {
        it: { side: "enemy", block: block({ type: mind === "genius" ? "monstrosity" : "beast", mind }) },
        near: { side: "party", block: block({ health: 30 }), health: 20 },
        striker: { side: "party", block: block({ health: 30 }) },
      },
      { it: master },
    );
    rulesetCombatant(encounter, "striker")!.done = { dealt: 40 };
    encounter.round = 2;
    const picked = pickRulesetChoice(definition, state, encounter, "it");
    assert.equal(picked?.targetId, expected, `${mind}: ${JSON.stringify(picked?.choice)}`);
    // What it then deals is counted to it, against the other side only.
    const step = applyRulesetCombatChoice(definition, encounter, picked!.choice, () => 19);
    assert.ok((rulesetCombatant(step.state, "it")!.done?.dealt ?? 0) > 0, JSON.stringify(step.events.slice(0, 4)));
  }

  // A cowardly goblin that is hurt gets away; a reckless one fights on.
  for (const [temperament, gets] of [
    ["cowardly", true],
    ["reckless", false],
  ] as const) {
    const { encounter, state } = fight(
      { goblin: { x: 4, y: 2 }, hero: { x: 5, y: 2 } },
      {
        goblin: { side: "enemy", block: block({ type: "humanoid" }), health: 2 },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { goblin: { ...master, temperament } },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "goblin");
    assert.equal(picked?.defensive === "disengage", gets, `${temperament}: ${JSON.stringify(picked?.choice)}`);
    if (gets) assert.ok(picked!.to && picked!.to.x < 4, "and runs from the hero");
  }

  // A hurt animal hides for two turns at most, then fights; after a blow it is careful for one turn
  // at most before it goes back in, not two more.
  {
    const { encounter, state } = fight(
      { wolf: { x: 0, y: 0 }, hero: { x: 6, y: 0 } },
      {
        wolf: { side: "enemy", block: block({ type: "beast", mind: "instinct" }), health: 2 },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { wolf: master },
    );
    const picks = Array.from({ length: 5 }, () => pickRulesetChoice(definition, state, encounter, "wolf"));
    assert.ok(picks[0]?.defensive, `it starts careful: ${JSON.stringify(picks[0]?.choice)}`);
    const seen = JSON.stringify(picks.map((one) => one?.choice.optionId));
    assert.ok(picks[1]?.defensive && !picks[2]?.defensive, `two turns of it, then it fights: ${seen}`);
    assert.ok(!picks[4]?.defensive, `one careful turn after a blow: ${seen}`);
  }

  // Standing in burning oil, it steps out of it to fight rather than taking the flames next turn.
  {
    const { encounter, state } = fight(
      { wolf: { x: 4, y: 2 }, hero: { x: 5, y: 2 } },
      {
        wolf: { side: "enemy", block: block({ type: "beast", mind: "instinct" }) },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { wolf: master },
    );
    const hero = rulesetCombatant(encounter, "hero")!;
    const rule = { rounds: 10, anchor: "point", triggers: ["turn-start"], atCast: false };
    hero.actions.push({
      ...hero.actions[0]!,
      id: "oil",
      label: "Burning oil",
      damage: { count: 3, sides: 6, flat: 0 },
      zone: rule,
    } as never);
    hero.zones = [
      { actionId: "oil", label: "Burning oil", ...rule, at: { x: 4, y: 2 }, cells: [{ x: 4, y: 2 }] } as never,
    ];
    const picked = pickRulesetChoice(definition, state, encounter, "wolf");
    assert.ok(
      picked?.to && (picked.to.x !== 4 || picked.to.y !== 2),
      `it steps out of the fire: ${JSON.stringify(picked?.to)}`,
    );
  }

  // Of two walks that cost the same, the one round a friend's burning oil rather than through it.
  {
    const { encounter } = fight(
      { wolf: { x: 1, y: 2 }, hero: { x: 8, y: 4 }, ally: { x: 0, y: 5 } },
      {
        wolf: { side: "enemy", block: block({ type: "beast", mind: "instinct" }) },
        hero: { side: "party", block: block({ health: 40 }) },
        ally: { side: "enemy", block: block({}) },
      },
    );
    const ally = rulesetCombatant(encounter, "ally")!;
    const rule = { rounds: 10, anchor: "point", triggers: ["enter"], atCast: false };
    ally.actions.push({
      ...ally.actions[0]!,
      id: "oil",
      label: "Burning oil",
      damage: { count: 3, sides: 6, flat: 0 },
      zone: rule,
    } as never);
    const route = () =>
      rulesetReachableCells(definition, encounter, "wolf").find((cell) => cell.x === 3 && cell.y === 1)?.path;
    assert.ok(route()?.length, "it can get there");
    ally.zones = [
      { actionId: "oil", label: "Burning oil", ...rule, at: { x: 2, y: 1 }, cells: [{ x: 2, y: 1 }] } as never,
    ];
    const path = route();
    assert.ok(
      path && !path.some((cell) => cell.x === 2 && cell.y === 1),
      `it goes round the fire: ${JSON.stringify(path)}`,
    );
    // A friend down on the ground is walked over, never stood on.
    ally.zones = [];
    Object.assign(ally, { x: 2, y: 2, down: true });
    const cells = rulesetReachableCells(definition, encounter, "wolf");
    assert.ok(!cells.some((cell) => cell.x === 2 && cell.y === 2), "nobody stops on a fallen friend");
    assert.ok(
      cells.some((cell) => cell.path.some((step) => step.x === 2 && step.y === 2)),
      "but may walk across them",
    );
  }

  // A healthy wolf beside its prey bites; a hurt coward with nobody beside it never Disengages.
  {
    const { encounter, state } = fight(
      { wolf: { x: 4, y: 2 }, hero: { x: 5, y: 2 } },
      {
        wolf: { side: "enemy", block: block({ type: "beast", mind: "instinct" }) },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { wolf: master },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "wolf");
    assert.equal(picked?.targetId, "hero", `it bites: ${JSON.stringify(picked?.choice)}`);
  }
  {
    const { encounter, state } = fight(
      { goblin: { x: 0, y: 0 }, hero: { x: 9, y: 5 } },
      {
        goblin: { side: "enemy", block: block({ type: "humanoid" }), health: 2 },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { goblin: { ...master, temperament: "cowardly" } },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "goblin");
    assert.notEqual(picked?.defensive, "disengage", `nobody to get away from: ${JSON.stringify(picked?.choice)}`);
  }

  // A protective guard goes at whoever is on its hurt friend.
  {
    const { encounter, state } = fight(
      { guard: { x: 4, y: 2 }, friend: { x: 4, y: 4 }, near: { x: 5, y: 2 }, bully: { x: 5, y: 4 } },
      {
        guard: { side: "enemy", block: block({ type: "humanoid" }) },
        friend: { side: "enemy", block: block({ type: "humanoid" }), health: 4 },
        near: { side: "party", block: block() },
        bully: { side: "party", block: block() },
      },
      { guard: { ...master, temperament: "protective" } },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "guard");
    assert.equal(picked?.targetId, "bully", JSON.stringify(picked?.choice));
  }

  // A blow that does no harm is never what it swings: a mage's 0-damage punch beside a knight, when
  // its dagger lands far less often but hurts.
  {
    const punch = { id: "punch", name: "Punch", budget: "action", toHit: 12, damage: { flat: 0 }, reach: 1 };
    const dagger = { ...claw, id: "dagger", name: "Dagger", toHit: -4 };
    const { encounter, state } = fight(
      { mage: { x: 4, y: 2 }, knight: { x: 5, y: 2 } },
      {
        mage: { side: "enemy", block: block({ type: "humanoid", actions: [punch, dagger] }), health: 5 },
        knight: { side: "party", block: block({ health: 60 }) },
      },
      { mage: { ...master, temperament: "disciplined" } },
    );
    const picked = pickRulesetChoice(definition, state, encounter, "mage");
    assert.notEqual(picked?.choice.optionId, "punch", JSON.stringify(picked?.choice));
  }

  // What an opponent cannot use is no danger: a caster's Sunbeam line before it holds the spell
  // does not keep a brute from the one it can finish beside that caster.
  {
    const { encounter, state } = fight(
      { it: { x: 4, y: 2 }, far: { x: 2, y: 2 }, weak: { x: 6, y: 2 }, caster: { x: 9, y: 2 } },
      {
        it: { side: "enemy", block: block({ type: "humanoid" }) },
        far: { side: "party", block: block({ health: 40 }) },
        weak: { side: "party", block: block(), health: 2 },
        caster: { side: "party", block: block() },
      },
      { it: { ...master, temperament: "disciplined" } },
    );
    rulesetCombatant(encounter, "caster")!.actions.push({
      id: "beam",
      label: "Beam",
      kind: "attack",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      toHit: 5,
      damage: { flat: 60 },
      reach: 1,
      whileHolds: "glowing",
    } as never);
    const picked = pickRulesetChoice(definition, state, encounter, "it");
    assert.equal(picked?.targetId, "weak", JSON.stringify(picked?.choice));
  }

  // Action Surge only once its own action is spent, and then for a blow it can reach: never with the
  // only foe left across water it cannot walk round, nor with its walk spent and the only blow that
  // reaches one it has no use of now (a handaxe in its pack).
  for (const [spent, river, surges, pack] of [
    [false, false, false, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, false, false, true],
  ] as const) {
    const { encounter, state } = fight(
      { it: { x: 1, y: 2 }, hero: river ? { x: 4, y: 2 } : pack ? { x: 7, y: 2 } : { x: 2, y: 2 } },
      {
        it: { side: "enemy", block: block({ type: "humanoid" }) },
        hero: { side: "party", block: block({ health: 40 }) },
      },
      { it: { ...master, temperament: "methodical" } },
    );
    const it = rulesetCombatant(encounter, "it")!;
    it.actions.push({
      id: "surge",
      label: "Surge",
      kind: "ability",
      budget: "action",
      free: true,
      targets: { side: "self", count: 0 },
      gives: [{ budget: "action", count: 1 }],
    } as never);
    if (spent) it.budgets.action = 0;
    if (pack) {
      it.actions.push({
        id: "handaxe",
        label: "Handaxe",
        kind: "attack",
        budget: "action",
        targets: { side: "enemy", count: 1 },
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2 },
        reach: 1,
        range: { normal: 4, long: 12 },
        whileHolds: "glowing",
      } as never);
      it.movementLeft = 0;
    }
    if (river) for (const row of encounter.board!.grid.tiles) row.splice(2, 2, "water", "water");
    const picked = pickRulesetChoice(definition, state, encounter, "it");
    assert.equal(
      picked?.choice.optionId === "surge",
      surges,
      `spent ${spent}, river ${river}, pack ${pack}: ${JSON.stringify(picked?.choice)}`,
    );
  }

  // A captain one step from a sturdy fighter, with the healer it would rather see fall 25 ft off,
  // walks round the fighter's reach to the healer for its whole Multiattack: never a dagger thrown at
  // long range and then a step.
  {
    const scimitar = {
      id: "scimitar",
      name: "Scimitar",
      budget: "action",
      toHit: 5,
      reach: 1,
      damage: { count: 1, sides: 6, flat: 3 },
    };
    const dagger = {
      id: "dagger",
      name: "Dagger",
      budget: "action",
      toHit: 5,
      reach: 1,
      range: { normal: 20, long: 60 },
      damage: { count: 1, sides: 4, flat: 3 },
    };
    const multiattack = {
      id: "multiattack",
      name: "Multiattack",
      budget: "action",
      sequence: [
        { action: "scimitar", times: 2 },
        { action: "dagger", times: 1 },
      ],
    };
    const { encounter, state } = fight(
      { captain: { x: 4, y: 2 }, fighter: { x: 6, y: 0 }, healer: { x: 9, y: 0 } },
      {
        captain: {
          side: "enemy",
          block: block({ type: "humanoid", mind: "tactical", actions: [scimitar, dagger, multiattack] }),
        },
        fighter: { side: "party", block: block({ health: 84, defense: 18 }) },
        healer: { side: "party", block: block({ health: 62, defense: 13 }) },
      },
      { captain: { ...master, temperament: "disciplined" } },
    );
    rulesetCombatant(encounter, "healer")!.done = { dealt: 40 };
    encounter.round = 3;
    const picked = pickRulesetChoice(definition, state, encounter, "captain");
    assert.equal(picked?.choice.optionId, "multiattack", JSON.stringify(picked?.choice));
    assert.equal(picked?.targetId, "healer", "on the healer");
    assert.ok(picked?.to && Math.max(Math.abs(picked.to.x - 9), Math.abs(picked.to.y)) === 1, "from beside her");
    assert.ok(
      !picked?.to ||
        rulesetReachableCells(definition, encounter, "captain").find(
          (cell) => cell.x === picked.to!.x && cell.y === picked.to!.y,
        )?.provokes.length === 0,
      "walking round the fighter's reach",
    );
  }

  // The fighter two steps off and the wizard far behind him (re-test 12): the captain steps in on the
  // fighter for its whole Multiattack, never two daggers at the wizard from long range, whatever its
  // temperament.
  {
    const scimitar = {
      id: "scimitar",
      name: "Scimitar",
      budget: "action",
      toHit: 5,
      reach: 1,
      damage: { count: 1, sides: 6, flat: 3 },
    };
    const dagger = {
      id: "dagger",
      name: "Dagger",
      budget: "action",
      toHit: 5,
      reach: 1,
      range: { normal: 20, long: 60 },
      damage: { count: 1, sides: 4, flat: 3 },
    };
    const melee = {
      id: "melee",
      name: "Multiattack (melee)",
      budget: "action",
      sequence: [
        { action: "scimitar", times: 2 },
        { action: "dagger", times: 1 },
      ],
    };
    const ranged = {
      id: "ranged",
      name: "Multiattack (ranged)",
      budget: "action",
      sequence: [{ action: "dagger", times: 2 }],
    };
    // Two swings of a longsword: a fifth of the captain's health in a turn.
    const longsword = {
      id: "longsword",
      name: "Longsword",
      budget: "action",
      toHit: 7,
      reach: 1,
      damage: { count: 2, sides: 8, flat: 4 },
    };
    const target = (
      gap: number,
      armour: number,
      temperament: CombatAiHints["temperament"],
      how: {
        seed?: number;
        proficiency?: CombatAiHints["proficiency"];
        locked?: boolean;
        speed?: number;
        placements?: Record<"captain" | "brom" | "elara", { x: number; y: number }>;
        round?: number;
        knight?: boolean;
      } = {},
    ) => {
      const blocks = {
        captain: {
          side: "enemy" as const,
          block: block({
            type: "humanoid",
            mind: "tactical",
            health: 65,
            speed: how.speed ?? 30,
            actions: [scimitar, dagger, melee, ranged],
          }),
        },
        brom: {
          side: "party" as const,
          block: block({ health: 70, defense: armour, ...(how.knight ? { actions: [longsword] } : {}) }),
        },
        elara: {
          side: "party" as const,
          block: block({
            health: 40,
            defense: 12,
            actions: [
              how.knight
                ? {
                    id: "bolt",
                    name: "Fire Bolt",
                    budget: "action",
                    toHit: 7,
                    range: { normal: 120 },
                    damage: { count: 3, sides: 10, flat: 0 },
                    components: ["verbal"],
                  }
                : { ...claw, components: ["verbal"] },
            ],
          }),
        },
      };
      const placements = how.placements ?? {
        captain: { x: 4, y: 3 },
        brom: { x: 6, y: 3 },
        elara: { x: 4 + gap, y: 3 },
      };
      const encounter: RulesetEncounterState = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
        board: {
          grid: { width: 20, height: 8, tiles: Array.from({ length: 8 }, () => Array(20).fill("plains")) },
          placements,
        } as never,
      });
      encounter.order = ["captain", "brom", "elara"];
      encounter.turn = 0;
      encounter.round = how.round ?? 2;
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("brom", "player"), unit("elara", "player")],
        enemies: [unit("captain", "enemy", { proficiency: how.proficiency ?? "master", temperament })],
        gm: false,
        difficulty: "normal",
        seed: how.seed ?? 3,
      } as never);
      state.enemies[0]!.tactics!.adjective = temperament!;
      if (how.locked) state.enemies[0]!.tactics!.targetId = "elara";
      return pickRulesetChoice(definition, state, encounter, "captain")?.targetId;
    };
    for (const temperament of ["disciplined", "opportunistic", "cautious", "reckless"] as const) {
      assert.equal(target(10, 18, temperament), "brom", `${temperament}: no throw at long range`);
      assert.equal(target(11, 18, temperament), "brom", `${temperament}: nor further`);
    }
    // Two daggers at the wizard in normal range do some 93 hundredths of the Multiattack on the knight
    // in plate (re-test 13), with her too far over rough ground to walk to: neither its liking for the
    // dangerous one, nor having last gone for her, nor a novice's wavering throws them past it. A
    // methodical one sticks with whom it went for: that is what it is.
    for (let seed = 1; seed <= 12; seed++)
      for (const temperament of ["disciplined", "opportunistic", "reckless"] as const)
        for (const proficiency of ["novice", "trained", "master"] as const)
          for (const gap of [4, 5])
            assert.equal(
              target(gap, 17, temperament, { seed, proficiency, locked: true, speed: 10 }),
              "brom",
              `${temperament} ${proficiency} seed ${seed} gap ${gap}: the harder blow`,
            );
    // The opening of the far layout (re-test 14): the knight dashed to two squares off the captain,
    // the wizard eleven squares off across the field. Walking six squares away from the knight to
    // throw from one square past the daggers' normal range is two thirds of the Multiattack, and
    // the knight walks up and strikes it there all the same.
    for (let seed = 1; seed <= 12; seed++)
      for (const temperament of ["disciplined", "patient", "protective", "cowardly", "reckless", "methodical"] as const)
        for (const [captain, brom] of [
          [
            { x: 11, y: 4 },
            { x: 9, y: 4 },
          ],
          [
            { x: 13, y: 2 },
            { x: 14, y: 0 },
          ],
          [
            { x: 13, y: 4 },
            { x: 15, y: 4 },
          ],
          [
            { x: 13, y: 6 },
            { x: 15, y: 7 },
          ],
        ] as const) {
          assert.equal(
            target(0, 18, temperament, {
              seed,
              proficiency: "novice",
              placements: { captain, brom, elara: { x: 0, y: 4 } },
              round: 1,
              knight: true,
            }),
            "brom",
            `${temperament} seed ${seed} captain at ${captain.x},${captain.y}, knight at ${brom.x},${brom.y}: in on the knight`,
          );
        }
  }

  // A tactician keeps the slot its Counterspell needs (P8): with one 3rd-level slot left it casts its
  // cantrip, and spends the slot freely with another left or as a creature that thinks less.
  {
    const caster = [
      {
        id: "counter",
        name: "Counter",
        budget: "reaction",
        range: { normal: 60 },
        reaction: { on: "aimed", cancels: true },
      },
      {
        id: "bolt",
        name: "Bolt",
        budget: "action",
        toHit: 20,
        range: { normal: 120 },
        damage: { count: 4, sides: 6, flat: 0 },
      },
      {
        id: "spark",
        name: "Spark",
        budget: "action",
        toHit: 20,
        range: { normal: 120 },
        damage: { count: 3, sides: 6, flat: 0 },
      },
    ];
    const cast = (mind: string, slots: Record<string, number>) => {
      const { encounter, state } = fight(
        { mage: { x: 1, y: 2 }, knight: { x: 8, y: 2 } },
        {
          mage: { side: "enemy", block: block({ type: "humanoid", mind, actions: caster }) },
          knight: { side: "party", block: block({ health: 60 }) },
        },
        { mage: { ...master, temperament: "disciplined" } },
      );
      // Both of its trait's spells cast from 3rd-level slots (1.642), as a bestiary mage's are.
      const mage = rulesetCombatant(encounter, "mage")!;
      for (const action of mage.actions)
        if (action.id === "counter" || action.id === "bolt") action.innate = { level: 3, baseLevel: 3, slot: 3, slots };
      for (const [level, count] of Object.entries(slots)) mage.uses[`slot:${level}`] = count;
      return pickRulesetChoice(definition, state, encounter, "mage")?.choice.optionId;
    };
    assert.equal(cast("tactical", { "3": 1 }), "spark", "the last slot is kept for the answer");
    assert.equal(cast("genius", { "3": 1 }), "spark");
    assert.equal(cast("tactical", { "3": 2 }), "bolt", "with another left it is spent");
    assert.equal(cast("cunning", { "3": 1 }), "bolt", "a cunning creature does not plan for it");
  }

  // ── Planning ahead (P8): a help put up while the fight is far, and keeping its distance ──
  {
    const wide = (
      placements: Record<string, { x: number; y: number }>,
      blocks: Record<string, { side: "party" | "enemy"; block: RulesetStatBlock }>,
      hints: Record<string, CombatAiHints>,
    ) => {
      const encounter: RulesetEncounterState = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
        board: {
          grid: { width: 24, height: 8, tiles: Array.from({ length: 8 }, () => Array(24).fill("plains")) },
          placements,
        } as never,
      });
      encounter.order = Object.keys(blocks);
      encounter.turn = 0;
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: Object.entries(blocks)
          .filter(([, one]) => one.side === "party")
          .map(([id]) => unit(id, "player", hints[id])),
        enemies: Object.entries(blocks)
          .filter(([, one]) => one.side === "enemy")
          .map(([id]) => unit(id, "enemy", hints[id])),
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      for (const one of [...state.party, ...state.enemies]) {
        const temperament = hints[one.id]?.temperament;
        if (temperament && one.tactics) one.tactics.adjective = temperament;
      }
      return { encounter, state };
    };
    const spark = {
      id: "spark",
      name: "Spark",
      budget: "action",
      toHit: 6,
      range: { normal: 120 },
      damage: { count: 1, sides: 6, flat: 0 },
    };
    // A modest help that lasts a minute, held by concentration: Shield of Faith.
    const veil = {
      id: "veil",
      name: "Ward",
      budget: "action",
      targets: "ally",
      range: { normal: 30 },
      concentration: true,
      applies: [{ condition: "parrying", duration: { rounds: 10 } }],
    };
    const prepares = (mind: string, knightAt: number) => {
      const { encounter, state } = wide(
        { mage: { x: 1, y: 3 }, knight: { x: knightAt, y: 3 } },
        {
          mage: { side: "enemy", block: block({ type: "humanoid", mind, actions: [spark, veil] }) },
          knight: { side: "party", block: block({ health: 40 }) },
        },
        { mage: { ...master, temperament: "disciplined" } },
      );
      return pickRulesetChoice(definition, state, encounter, "mage")?.choice;
    };
    // A Sleep whose pool cannot cover anybody it catches is worth nothing (re-test 10).
    {
      const nap = {
        id: "nap",
        name: "Nap",
        budget: "action",
        range: { normal: 90 },
        area: { shape: "burst", size: 20 },
        applies: [{ condition: "unconscious", duration: { rounds: 10 } }],
      };
      const naps = (health: number) => {
        const { encounter, state } = wide(
          { mage: { x: 1, y: 3 }, a: { x: 8, y: 3 }, b: { x: 8, y: 4 } },
          {
            mage: { side: "enemy", block: block({ type: "humanoid", mind: "tactical", actions: [spark, nap] }) },
            a: { side: "party", block: block({ health }) },
            b: { side: "party", block: block({ health }) },
          },
          { mage: { ...master, temperament: "disciplined" } },
        );
        const held = rulesetCombatant(encounter, "mage")!.actions.find((one) => one.id === "nap")!;
        held.healthPool = { count: 5, sides: 8, flat: 0 };
        return pickRulesetChoice(definition, state, encounter, "mage")?.choice.optionId;
      };
      assert.equal(naps(80), "spark", "5d8 puts nobody with 80 health to sleep");
      assert.equal(naps(10), "nap", "two with 10 each it does");
    }
    const far = prepares("tactical", 20);
    assert.equal(far?.optionId, "veil", `with the knight far off, a tactician wards itself: ${JSON.stringify(far)}`);
    assert.deepEqual(far?.targetIds, ["mage"]);
    assert.equal(prepares("genius", 20)?.optionId, "veil");
    assert.equal(prepares("cunning", 20)?.optionId, "spark", "a cunning one just shoots");
    // With the knight a walk away the ward is worth the blows it turns aside before long (class pass
    // 2026-10-24: Shield of Faith never cast), more than a 1d6 chip shot.
    assert.equal(prepares("tactical", 6)?.optionId, "veil", "with the knight a walk away, it wards itself");

    // Keeping its distance: a tactician shoots and steps back out of the knight's walk; a cunning one
    // walks in after its shot.
    const bow = { ...spark, id: "bow", name: "Shortbow", range: { normal: 80, long: 320 } };
    // A thrown dagger is a melee weapon thrown: its thrower walks in after it.
    const dagger = { ...spark, id: "dagger", name: "Dagger", reach: 5, range: { normal: 20, long: 60 } };
    const kites = (mind: string, weapon: Record<string, unknown> = bow) => {
      const { encounter, state } = wide(
        { archer: { x: 6, y: 3 }, knight: { x: 2, y: 3 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind, actions: [weapon] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      const seen = state.rulesetFight!.eventSeq;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
      const archer = rulesetCombatant(state.rulesetFight!.encounter, "archer")!;
      return { gap: archer.x! - 2, turn };
    };
    const tactician = kites("tactical");
    assert.ok(
      tactician.turn.some((event) => "actorId" in event && event.actorId === "archer" && event.type !== "move"),
      `it shot: ${JSON.stringify(tactician.turn)}`,
    );
    assert.ok(tactician.gap > 7, `and stepped out of the knight's walk: ${tactician.gap}`);
    // In normal range already, it shoots from where it stands rather than walking in first (re-test 9).
    const first = tactician.turn.find((event) => "actorId" in event && event.actorId === "archer");
    assert.notEqual(first?.type, "move", `no walk in before the shot: ${JSON.stringify(tactician.turn)}`);
    // A shot that opens a window on a person's own reaction (Shield) leaves the rest of the turn
    // waiting, and it then keeps its distance as it would have: no walk in once the window is
    // answered (re-test 11).
    {
      const brace = {
        id: "brace",
        name: "Brace",
        budget: "reaction",
        self: true,
        reaction: { on: "hit" },
        applies: [{ condition: "prone", duration: { rounds: 1 } }],
      };
      const { encounter, state } = wide(
        { archer: { x: 9, y: 3 }, knight: { x: 2, y: 3 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", actions: [bow] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw, brace] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      assert.deepEqual(state.rulesetFight!.encounter.window?.waiting, ["knight"], "the knight is asked");
      assert.ok(
        commandRulesetCombatDirector(definition, state, {
          type: "ruleset",
          optionId: RULESET_PASS_OPTION,
          targetIds: [],
        } as never).ok,
      );
      for (
        let guard = 0;
        guard < 3 && state.rulesetFight!.encounter.order[state.rulesetFight!.encounter.turn] === "archer";
        guard++
      )
        assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const archer = rulesetCombatant(state.rulesetFight!.encounter, "archer")!;
      assert.ok(archer.x! >= 9, `it stayed where it shot from: ${archer.x},${archer.y}`);
    }
    // In range behind a hill, it walks to where it can see before it shoots, rather than standing
    // idle all turn (re-test 10).
    {
      const { encounter, state } = wide(
        { archer: { x: 10, y: 3 }, knight: { x: 2, y: 3 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind: "tactical", actions: [bow] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      for (let y = 1; y <= 6; y++) encounter.board!.grid.tiles[y]![6] = "mountain";
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      assert.ok(
        turn.some((event) => event.type === "attack" && "actorId" in event && event.actorId === "archer"),
        `it found a clear line and shot: ${JSON.stringify(turn)}`,
      );
    }
    assert.ok(kites("cunning").gap <= 4, "a cunning one does not step back");
    assert.ok(kites("tactical", dagger).gap <= 4, "nor does one that threw a dagger");
    // Beside the knight, it gets clear by a Misty Step its bonus action pays for, then shoots (re-test 9).
    {
      const misty = { id: "misty", name: "Misty Step", budget: "bonus", teleport: { distance: 30 } };
      const { encounter, state } = wide(
        { archer: { x: 3, y: 3 }, knight: { x: 2, y: 3 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", actions: [bow, misty] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      const shot = turn.find((event) => event.type === "attack" && "actorId" in event && event.actorId === "archer") as
        { mode?: string } | undefined;
      const archer = rulesetCombatant(state.rulesetFight!.encounter, "archer")!;
      const gap = Math.max(Math.abs(archer.x! - 2), Math.abs(archer.y! - 3));
      assert.ok(
        gap > 1 && shot && turn.some((event) => event.type === "teleported"),
        `stepped clear, then shot: ${JSON.stringify(turn)}`,
      );
      assert.notEqual(shot?.mode, "disadvantage", "and not at disadvantage");
    }
    // Hurt, it steps out of the reach of a glaive that reaches two squares, not just off the cell
    // beside it (AI pass 2026-10-24: a Misty Step two squares from a young dragon, in its bite).
    {
      const misty = { id: "misty", name: "Misty Step", budget: "bonus", teleport: { distance: 10 } };
      const glaive = { ...claw, id: "glaive", name: "Glaive", reach: 10 };
      const { encounter, state } = wide(
        { archer: { x: 5, y: 3 }, knight: { x: 5, y: 2 }, orc: { x: 5, y: 6 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", actions: [claw, misty] }) },
          knight: { side: "party", block: block({ health: 80, actions: [glaive] }) },
          orc: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      const archer = rulesetCombatant(encounter, "archer")!;
      archer.health = { ...archer.health!, value: 6 };
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual", orc: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      const went = turn.find((event) => event.type === "teleported") as { to: { x: number; y: number } } | undefined;
      assert.ok(went, `it gets away: ${JSON.stringify(turn)}`);
      assert.ok(
        Math.max(Math.abs(went!.to.x - 5), Math.abs(went!.to.y - 2)) > 2,
        `out of the glaive's reach: ${JSON.stringify(went)}`,
      );
    }
    // Nearly dead, and every cell it could step to lies in the knight's aura: it does not teleport into
    // it to die there (playtest: a mage at 4 health that Misty Stepped into Spirit Guardians).
    for (const health of [4, 60]) {
      const misty = { id: "misty", name: "Misty Step", budget: "bonus", teleport: { distance: 30 } };
      const { encounter, state } = wide(
        { archer: { x: 3, y: 3 }, knight: { x: 2, y: 3 } },
        {
          archer: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", health, actions: [bow, misty] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { archer: { ...master, temperament: "disciplined" } },
      );
      const knight = rulesetCombatant(encounter, "knight")!;
      const triggers = ["enter", "turn-start"];
      knight.actions.push({
        id: "guardians",
        label: "Guardians",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 0 },
        area: { shape: "burst", size: 12 },
        damage: { count: 3, sides: 8, flat: 0 },
        zone: { rounds: 10, triggers, anchor: "caster" },
      } as never);
      knight.zones = [{ actionId: "guardians", label: "Guardians", rounds: 10, anchor: "caster", triggers } as never];
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      assert.equal(
        turn.some((event) => event.type === "teleported"),
        health > 4,
        `${health} health: ${JSON.stringify(turn)}`,
      );
    }
    // Nearly dead and standing in the knight's aura, whose next start-of-turn tick would finish it: it
    // walks out and shoots from the edge rather than staying to claw and die (playtest 2026-10-23: two
    // cultists that stayed in Spirit Guardians). With health to spare it may stay.
    {
      const stays = (health: number) => {
        const { encounter, state } = wide(
          { cultist: { x: 3, y: 3 }, knight: { x: 2, y: 3 } },
          {
            cultist: {
              side: "enemy",
              block: block({ type: "humanoid", mind: "cunning", health, actions: [claw, bow] }),
            },
            knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
          },
          { cultist: { ...master, temperament: "disciplined" } },
        );
        const knight = rulesetCombatant(encounter, "knight")!;
        const triggers = ["enter", "turn-start"];
        knight.actions.push({
          id: "guardians",
          label: "Guardians",
          kind: "attack",
          budget: "action",
          autoHit: true,
          targets: { side: "enemy", count: 0 },
          area: { shape: "burst", size: 2 },
          damage: { count: 3, sides: 8, flat: 0 },
          zone: { rounds: 10, triggers, anchor: "caster" },
        } as never);
        knight.zones = [{ actionId: "guardians", label: "Guardians", rounds: 10, anchor: "caster", triggers } as never];
        state.rulesetFight = {
          encounter,
          events: [],
          eventSeq: 0,
          controllers: { knight: "manual" },
          bosses: [],
        } as never;
        // It walks out first, past the knight's reach (whose reaction the knight's player answers).
        const picked = pickRulesetChoice(definition, state, encounter, "cultist");
        const to = picked?.to ?? { x: 3, y: 3 };
        return Math.max(Math.abs(to.x - 2), Math.abs(to.y - 3)) <= 2;
      };
      assert.equal(stays(4), false, "at 4 health it leaves the aura");
    }
    // With nothing worth doing at all, it does not end its turn inside the aura either: it steps out
    // (re-test 2026-10-24: a cleric at 8 health stood up in Spirit Guardians and stood there).
    {
      const { encounter, state } = wide(
        { cultist: { x: 3, y: 3 }, knight: { x: 2, y: 3 } },
        {
          cultist: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", health: 30, actions: [] }) },
          knight: { side: "party", block: block({ health: 80, actions: [claw] }) },
        },
        { cultist: { ...master, temperament: "disciplined" } },
      );
      const knight = rulesetCombatant(encounter, "knight")!;
      const triggers = ["turn-start"];
      knight.actions.push({
        id: "guardians",
        label: "Guardians",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 0 },
        area: { shape: "burst", size: 2 },
        damage: { count: 3, sides: 8, flat: 0 },
        zone: { rounds: 10, triggers, anchor: "caster" },
      } as never);
      knight.zones = [{ actionId: "guardians", label: "Guardians", rounds: 10, anchor: "caster", triggers } as never];
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      // Out past the knight's reach, whose blow the knight's player is asked about first.
      const out = turn.find((event) => event.type === "move" && event.actorId === "cultist");
      const asked = turn.some((event) => event.type === "window" && event.moverId === "cultist");
      assert.ok(
        asked || (out?.type === "move" && Math.max(Math.abs(out.to.x - 2), Math.abs(out.to.y - 3)) > 2),
        `it steps out of the aura: ${JSON.stringify(turn)}`,
      );
      assert.ok(
        turn.some((event) => event.type === "reasoning" && event.reasons.some((reason) => reason.why === "leavesHarm")),
        "and says why",
      );
    }
    // It does not walk through its own burning oil to reach whoever it goes for when another is as
    // near on its own side of it (I3 re-test 2026-10-24: a rogue that walked through his own oil to
    // reach a ghoul).
    {
      const stab = {
        id: "stab",
        name: "Stab",
        budget: "action",
        toHit: 5,
        reach: 1,
        damage: { count: 1, sides: 6, flat: 3 },
      };
      const oil = {
        id: "oil",
        label: "Oil",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 0 },
        area: { shape: "box", size: 1 },
        damage: { count: 0, sides: 0, flat: 5, type: "fire" },
        zone: { rounds: 10, triggers: ["enter"], anchor: "point" },
      };
      const { encounter, state } = wide(
        { pip: { x: 4, y: 4 }, beyond: { x: 7, y: 4 }, before: { x: 1, y: 4 } },
        {
          pip: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", health: 30, actions: [stab] }) },
          beyond: { side: "party", block: block({ health: 24, actions: [claw] }) },
          before: { side: "party", block: block({ health: 24, actions: [claw] }) },
        },
        { pip: { ...master, temperament: "disciplined" } },
      );
      const pip = rulesetCombatant(encounter, "pip")!;
      pip.actions.push(oil as never);
      const cells = Array.from({ length: 8 }, (_, y) => ({ x: 5, y }));
      pip.zones = [
        {
          actionId: "oil",
          label: "Oil",
          rounds: 10,
          anchor: "point",
          triggers: ["enter"],
          at: { x: 5, y: 4 },
          cells,
        } as never,
      ];
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { beyond: "manual", before: "manual" },
        bosses: [],
      } as never;
      const picked = pickRulesetChoice(definition, state, encounter, "pip");
      assert.equal(
        picked?.choice.targetIds[0],
        "before",
        `the one on its own side of the oil: ${JSON.stringify(picked)}`,
      );
    }
    // Nor steps into it to strike the one beyond it (re-test 2026-10-24: a rogue at 7 health that
    // stepped into his own burning oil to stab an ogre, and again to scatter caltrops).
    {
      const stab = {
        id: "stab",
        name: "Stab",
        budget: "action",
        toHit: 5,
        reach: 1,
        damage: { count: 1, sides: 6, flat: 3 },
      };
      const { encounter, state } = wide(
        { pip: { x: 3, y: 4 }, beyond: { x: 6, y: 4 } },
        {
          pip: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", health: 30, actions: [stab] }) },
          beyond: { side: "party", block: block({ health: 24, actions: [claw] }) },
        },
        { pip: { ...master, temperament: "disciplined" } },
      );
      const pip = rulesetCombatant(encounter, "pip")!;
      pip.actions.push({
        id: "oil",
        label: "Oil",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 0 },
        area: { shape: "box", size: 1 },
        damage: { count: 0, sides: 0, flat: 5, type: "fire" },
        zone: { rounds: 10, triggers: ["enter"], anchor: "point" },
      } as never);
      pip.zones = [
        {
          actionId: "oil",
          label: "Oil",
          rounds: 10,
          anchor: "point",
          triggers: ["enter"],
          at: { x: 5, y: 4 },
          cells: Array.from({ length: 20 }, (_, y) => ({ x: 5, y })),
        } as never,
      ];
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { beyond: "manual" },
        bosses: [],
      } as never;
      const picked = pickRulesetChoice(definition, state, encounter, "pip");
      assert.ok(!picked?.to || picked.to.x < 5, `it stays out of its own oil: ${JSON.stringify(picked)}`);
    }
    // Nor sprints through it, or its caltrops, to close on somebody far off: it stops short of them
    // (AI pass 2026-10-24: a rogue dashed through his own burning oil and caltrops).
    {
      const stab = {
        id: "stab",
        name: "Stab",
        budget: "action",
        toHit: 5,
        reach: 1,
        damage: { count: 1, sides: 6, flat: 3 },
      };
      const { encounter, state } = wide(
        { pip: { x: 2, y: 4 }, far: { x: 20, y: 4 } },
        {
          pip: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", health: 30, actions: [stab] }) },
          far: { side: "party", block: block({ health: 24, actions: [claw] }) },
        },
        { pip: { ...master, temperament: "disciplined" } },
      );
      const pip = rulesetCombatant(encounter, "pip")!;
      pip.actions.push({
        id: "oil",
        label: "Oil",
        kind: "attack",
        budget: "action",
        autoHit: true,
        targets: { side: "enemy", count: 0 },
        area: { shape: "box", size: 1 },
        damage: { count: 0, sides: 0, flat: 5, type: "fire" },
        zone: { rounds: 10, triggers: ["enter"], anchor: "point" },
      } as never);
      pip.zones = [
        {
          actionId: "oil",
          label: "Oil",
          rounds: 10,
          anchor: "point",
          triggers: ["enter"],
          at: { x: 6, y: 4 },
          cells: Array.from({ length: 8 }, (_, y) => ({ x: 6, y })),
        } as never,
      ];
      state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: { far: "manual" }, bosses: [] } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      const after = rulesetCombatant(state.rulesetFight!.encounter, "pip")!;
      assert.ok(after.x! < 6, `it stays on its own side of the oil: ${after.x},${after.y} ${JSON.stringify(turn)}`);
      assert.ok(
        !turn.some((event) => event.type === "damage" && event.targetId === "pip"),
        `and is not burned: ${JSON.stringify(turn)}`,
      );
    }
    // Nor poured beside a friend at grips with somebody, who steps where the fight goes and into it
    // (re-test 2026-10-24: burning oil a cell from the fighter brawling the ghouls).
    {
      const pour = {
        id: "pour",
        label: "Pour",
        kind: "attack",
        budget: "action",
        targets: { side: "enemy", count: 1 },
        range: { normal: 60 },
        area: { shape: "box", size: 1 },
        save: { save: "dex_save", difficulty: 15, onSuccess: "negates" },
        damage: { count: 0, sides: 0, flat: 5, type: "fire" },
        zone: { rounds: 10, triggers: ["enter"] },
      };
      const pours = (brawling: boolean) => {
        const { encounter, state } = wide(
          {
            pip: { x: 3, y: 4 },
            orc: { x: brawling ? 8 : 4, y: brawling ? 4 : 1 },
            knight: { x: 9, y: 4 },
            squire: { x: 9, y: 5 },
          },
          {
            pip: { side: "enemy", block: block({ type: "humanoid", mind: "tactical", health: 30, actions: [] }) },
            orc: { side: "enemy", block: block({ type: "humanoid", health: 30, actions: [claw] }) },
            knight: { side: "party", block: block({ health: 12, actions: [claw] }) },
            squire: { side: "party", block: block({ health: 12, actions: [claw] }) },
          },
          { pip: { ...master, temperament: "disciplined" } },
        );
        rulesetCombatant(encounter, "pip")!.actions.push(pour as never);
        state.rulesetFight = {
          encounter,
          events: [],
          eventSeq: 0,
          controllers: { knight: "manual", squire: "manual" },
          bosses: [],
        } as never;
        return pickRulesetChoice(definition, state, encounter, "pip");
      };
      const apart = pours(false);
      assert.equal(apart?.choice.optionId, "pour", `with nobody of its own there, it pours: ${JSON.stringify(apart)}`);
      const there = pours(true);
      const at = there?.choice.at;
      assert.ok(
        there?.choice.optionId !== "pour" || (!!at && Math.max(Math.abs(at.x - 8), Math.abs(at.y - 4)) > 2),
        `not beside the orc at grips with the knight: ${JSON.stringify(there)}`,
      );
    }
    // Nor poured on a square one of its own stands on, to catch the foe beside them (re-test
    // 2026-10-24: burning oil on the fighter's square to reach a wolf).
    {
      const pour = {
        id: "pour",
        label: "Pour",
        kind: "attack",
        budget: "action",
        targets: { side: "enemy", count: 1 },
        range: { normal: 60 },
        area: { shape: "box", size: 2 },
        save: { save: "dex_save", difficulty: 15, onSuccess: "negates" },
        damage: { count: 0, sides: 0, flat: 5, type: "fire" },
        zone: { rounds: 10, triggers: ["enter", "end"] },
      };
      const { encounter, state } = wide(
        {
          pip: { x: 2, y: 4 },
          orc: { x: 9, y: 3 },
          knight: { x: 9, y: 4 },
          squire: { x: 10, y: 4 },
          page: { x: 10, y: 3 },
        },
        {
          pip: { side: "enemy", block: block({ type: "humanoid", mind: "tactical", health: 30, actions: [] }) },
          orc: { side: "enemy", block: block({ type: "humanoid", health: 30, actions: [claw] }) },
          knight: { side: "party", block: block({ health: 12, actions: [claw] }) },
          squire: { side: "party", block: block({ health: 12, actions: [claw] }) },
          page: { side: "party", block: block({ health: 12, actions: [claw] }) },
        },
        { pip: { ...master, temperament: "disciplined" } },
      );
      rulesetCombatant(encounter, "pip")!.actions.push(pour as never);
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual", squire: "manual", page: "manual" },
        bosses: [],
      } as never;
      const picked = pickRulesetChoice(definition, state, encounter, "pip");
      const at = picked?.choice.at;
      assert.ok(
        picked?.choice.optionId !== "pour" ||
          (!!at &&
            !rulesetAreaCells("box", 2, { x: 2, y: 4 }, at, encounter.board!.grid!).some(
              (cell) => cell.x === 9 && cell.y === 3,
            )),
        `not on the orc's square: ${JSON.stringify(picked)}`,
      );
    }
    // A blow worth little against a sturdy target still says why it was struck (re-test 2026-10-24:
    // a zombie's slam on the fighter with no reason given).
    {
      const tap = {
        id: "tap",
        name: "Tap",
        budget: "action",
        toHit: 3,
        reach: 1,
        damage: { count: 1, sides: 2, flat: 0 },
      };
      const { encounter, state } = wide(
        { zombie: { x: 3, y: 3 }, knight: { x: 2, y: 3 } },
        {
          zombie: { side: "enemy", block: block({ type: "undead", mind: "mindless", health: 22, actions: [tap] }) },
          knight: { side: "party", block: block({ health: 400, actions: [claw] }) },
        },
        {},
      );
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "manual" },
        bosses: [],
      } as never;
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      const turn = state.rulesetFight!.events.map((entry) => entry.event);
      assert.ok(
        turn.some((event) => event.type === "attack" && event.actorId === "zombie"),
        JSON.stringify(turn),
      );
      assert.ok(
        turn.some((event) => event.type === "reasoning" && event.actorId === "zombie"),
        `the slam says why: ${JSON.stringify(turn)}`,
      );
    }
    // A fight in which nothing can change is called off rather than played for ever (K1, K6, K8: a
    // board nobody could cross, spare orders that never knock anybody out, a hill both sides stood on).
    {
      const { encounter, state } = wide(
        { guard: { x: 2, y: 3 }, knight: { x: 12, y: 3 } },
        {
          guard: { side: "enemy", block: block({ type: "humanoid", mind: "cunning", speed: 0, actions: [] }) },
          knight: { side: "party", block: block({ health: 40, speed: 0, actions: [] }) },
        },
        {},
      );
      state.rulesetFight = {
        encounter,
        events: [],
        eventSeq: 0,
        controllers: { knight: "ai" },
        bosses: [],
      } as never;
      for (let step = 0; step < 200 && !state.outcome; step += 1)
        assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      assert.equal(state.outcome, "flee", "the fight is called off");
      assert.equal(state.stalled, true);
      assert.equal(state.summary?.stalled, true, "and the recap says it broke off");
      const round = state.rulesetFight!.encounter.round;
      assert.ok(round >= 10 && round <= 13, `after ten rounds of nothing: ${round}`);
      assert.ok(
        state.rulesetFight!.events.some(
          (entry) => entry.event.type === "outcome" && entry.event.outcome === "fled" && entry.event.stalled,
        ),
        "the log says so",
      );
      assert.equal(state.stage, "finished");
    }
  }

  // ── Refused ──
  refused(
    fiveE({
      minds: {
        ability: "int",
        tiers: [
          { atLeast: 8, mind: "tactical" },
          { atLeast: 3, mind: "cunning" },
        ],
      },
    }),
    /Each tier starts above/,
  );
  refused(fiveE({ types: [{ id: "beast", label: "Beast", mind: "clever" }] }), /mind/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with how much thought a creature puts into a fight (a creature's or a creature type's mind, or combat.minds) requires schemaVersion 2 and capabilityApi 1.761 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(760) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(760) as never, fiveE({ types: [{ id: "x", label: "X" }] })),
      gate,
      "combat.minds alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(761) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(760) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Combat minds: a kraken a genius, an ape by instinct, a golem and a zombie mindless; the mindless go at the nearest, a hurt coward gets away, a guard goes at whoever is on its friend, a genius at whoever does its side most harm, an animal at the weaker; a tactician keeps its last slot for its answer, wards itself while the fight is far and steps back after a shot; gated at 1.761.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
