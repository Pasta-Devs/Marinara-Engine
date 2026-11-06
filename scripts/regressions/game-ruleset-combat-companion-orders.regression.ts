/**
 * A companion's standing orders (combat AI P7).
 *
 *   - By default it guards the leader: an opponent beside them comes first.
 *   - `follow` goes at whoever the leader went at; `protect` at whoever is beside its charge.
 *   - `heal` heals the hurt before it fights; `spare` does not finish anybody off with a shot.
 *   - `hold` never walks anywhere; `retreat` takes a getaway or a dodge.
 *   - `conserve` keeps what costs for later.
 *   - The commands: set, cleared, and protecting oneself refused.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chooseCombatCandidate,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatantRole,
  type CombatOrders,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-companion-orders-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { commandCombatDirector, createCombatDirector } =
  await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, pickRulesetChoice } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(JSON.parse(fiveEText));
  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const bolt = {
    id: "bolt",
    name: "Bolt",
    budget: "action",
    toHit: 6,
    range: { normal: 90 },
    damage: { count: 2, sides: 6, flat: 0 },
  };
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 6,
    reach: 1,
    damage: { count: 1, sides: 8, flat: 2 },
  };
  const mend = {
    id: "mend",
    name: "Mend",
    budget: "action",
    targets: "ally",
    range: { normal: 30 },
    heal: { count: 2, sides: 8, flat: 3 },
  };
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 60,
    maxHp: 60,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 9,
    skills: [],
    aiHints: { proficiency: "master" as const },
  });
  type Scene = Record<string, { side: "party" | "enemy"; block: RulesetStatBlock; at: { x: number; y: number } }>;
  const fight = (blocks: Scene, events: unknown[] = []) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: Object.entries(blocks).map(([id, one]) => ({ id, name: id, side: one.side, block: one.block })),
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: Object.fromEntries(Object.entries(blocks).map(([id, one]) => [id, one.at])),
      } as never,
    });
    encounter.order = Object.keys(blocks);
    // Mira's turn.
    encounter.turn = Math.max(0, encounter.order.indexOf("mira"));
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: Object.entries(blocks)
        .filter(([, one]) => one.side === "party")
        .map(([id]) => unit(id, "player")),
      enemies: Object.entries(blocks)
        .filter(([, one]) => one.side === "enemy")
        .map(([id]) => unit(id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = {
      encounter,
      events: events.map((event, seq) => ({ seq, event })),
      eventSeq: events.length,
      controllers: { ada: "manual", mira: "ai", bram: "ai" },
      bosses: [],
    } as never;
    return { encounter, state };
  };
  const pick = (
    blocks: Scene,
    orders?: CombatOrders,
    events: unknown[] = [],
    before?: (e: RulesetEncounterState) => void,
    adjective: "disciplined" | "patient" = "disciplined",
  ) => {
    const { encounter, state } = fight(blocks, events);
    const mira = state.party.find((one) => one.id === "mira")!;
    mira.tactics = {
      version: 1,
      seed: 0,
      category: "unknown",
      proficiency: "master",
      // What its actions make it, so its pinned temperament is not drawn again for another role.
      role: rulesetCombatantRole(rulesetCombatant(encounter, "mira")!, definition, encounter),
      adjective,
    };
    if (orders) mira.orders = orders;
    before?.(encounter);
    return pickRulesetChoice(definition, state, encounter, "mira");
  };
  // Ada fights an orc; a frail goblin stands off to one side; Mira shoots from the back.
  const field = (miraActions: unknown[] = [bolt], extra: Scene = {}): Scene => ({
    ada: { side: "party", block: block([smash]), at: { x: 8, y: 2 } },
    mira: { side: "party", block: block(miraActions), at: { x: 2, y: 5 } },
    orc: { side: "enemy", block: block([smash]), at: { x: 9, y: 2 } },
    goblin: { side: "enemy", block: block([smash], { health: 20 }), at: { x: 9, y: 8 } },
    ...extra,
  });

  // ── Guarding the leader, its default ──
  assert.equal(pick(field())?.targetId, "orc", "by default the one on the leader");
  assert.equal(
    pick(field(), { posture: "hold" }, [], undefined, "patient")?.targetId,
    "goblin",
    "left to itself, the frail one",
  );
  // A disciplined one (combat AI T1) keeps formation: it joins the leader on the orc.
  assert.equal(pick(field(), { posture: "hold" })?.targetId, "orc", "a disciplined one joins its side");

  // ── Follow and protect ──
  {
    const scene = field([bolt], {
      ogre: { side: "enemy", block: block([smash]), at: { x: 14, y: 5 } },
    });
    const hit = { type: "damage", sourceId: "ada", targetId: "ogre", dealt: 3 };
    assert.equal(pick(scene, { posture: "follow" }, [hit])?.targetId, "ogre", "whoever the leader went at");
    const guarded = field([bolt], {
      bram: { side: "party", block: block([smash]), at: { x: 14, y: 5 } },
      ogre: { side: "enemy", block: block([smash]), at: { x: 14, y: 6 } },
    });
    assert.equal(pick(guarded, { posture: "protect", protectId: "bram" })?.targetId, "ogre", "the one on its charge");
  }

  // ── On a leash: nothing is worth walking more than three squares from its charge for ──
  {
    const loose = field([smash], {
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 9 } },
      goblin: { side: "enemy", block: block([smash], { health: 20 }), at: { x: 4, y: 9 } },
    });
    const picked = pick(loose);
    const gap = (to: { x: number; y: number }) => Math.max(Math.abs(to.x - 8), Math.abs(to.y - 2));
    assert.ok(!picked?.to || gap(picked.to) <= 3, `it stays by Ada: ${JSON.stringify(picked?.choice)}`);
    // Fighting on its own it has no leash: it goes after a foe however far that takes it from Ada.
    const roaming = pick(loose, { posture: "free" });
    assert.ok(roaming?.to && gap(roaming.to) > 3, `it goes after them: ${JSON.stringify(roaming?.choice)}`);
    // Strayed off it with nobody in reach, it neither hides nor waits where it is: it walks back.
    const strayed = field([smash], {
      mira: { side: "party", block: block([smash]), at: { x: 1, y: 9 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 9 } },
      goblin: { side: "enemy", block: block([smash], { health: 20 }), at: { x: 15, y: 0 } },
    });
    const back = pick(strayed, { posture: "protect", protectId: "ada" }, [], (encounter) => {
      const mira = rulesetCombatant(encounter, "mira")!;
      mira.health = { ...mira.health!, value: 10 };
    });
    assert.ok(
      !back || (!back.defensive && back.option.kind !== "end-turn" && !!back.to && gap(back.to) < 7),
      `it heads back to Ada: ${JSON.stringify(back?.choice)}`,
    );
  }

  // ── Heal first ──
  {
    const hurt = (encounter: RulesetEncounterState) => {
      const ada = rulesetCombatant(encounter, "ada")!;
      ada.health = { ...ada.health!, value: 45 };
    };
    assert.equal(pick(field([bolt, mend]), { posture: "hold" }, [], hurt)?.option.id, "bolt", "a scratch can wait");
    assert.equal(
      pick(field([bolt, mend]), { posture: "hold", heal: true }, [], hurt)?.option.id,
      "mend",
      "told to heal first",
    );
  }

  // ── Spare ──
  {
    const frail = (encounter: RulesetEncounterState) => {
      const goblin = rulesetCombatant(encounter, "goblin")!;
      goblin.health = { ...goblin.health!, value: 3 };
    };
    assert.equal(pick(field(), { posture: "hold" }, [], frail)?.targetId, "goblin", "it finishes the goblin");
    assert.equal(pick(field(), { posture: "hold", spare: true }, [], frail)?.targetId, "orc", "not when told to spare");
  }

  // ── Spare with nothing but killing shots: it shoots nobody (re-test 2026-10-23) ──
  {
    const frail = (encounter: RulesetEncounterState) => {
      for (const id of ["orc", "goblin"]) {
        const one = rulesetCombatant(encounter, id)!;
        one.health = { ...one.health!, value: 3 };
      }
    };
    const spared = pick(field(), { posture: "hold", spare: true }, [], frail);
    assert.notEqual(spared?.option.id, "bolt", `no killing bolt: ${JSON.stringify(spared?.choice)}`);
    // It says it held back to spare them, not that nothing was worth the price (laptop 2026-10-25).
    assert.equal(spared?.spares, true, `its turn ends to spare them: ${spared?.option.kind}`);
    // The last of its side still up, it stops sparing them to survive (cloud AI fights 2026-10-25:
    // a sparing Professor shot dead over ten rounds by a Cultist at full health).
    const alone = pick(field(), { posture: "hold", spare: true }, [], (encounter) => {
      frail(encounter);
      const ada = rulesetCombatant(encounter, "ada")!;
      ada.health = { ...ada.health!, value: 0 };
      ada.down = true;
    });
    assert.equal(alone?.option.id, "bolt", `it fights for its life: ${JSON.stringify(alone?.choice)}`);
    assert.equal(alone?.spareYields, true);
  }

  // ── Spare counts a blow lethal by the most its dice can roll (re-test 2026-10-23) ──
  {
    const wounded = (encounter: RulesetEncounterState) => {
      for (const id of ["orc", "goblin"]) {
        const one = rulesetCombatant(encounter, id)!;
        one.health = { ...one.health!, value: 11 };
      }
    };
    const spared = pick(field(), { posture: "hold", spare: true }, [], wounded);
    assert.notEqual(spared?.option.id, "bolt", `2d6 can roll 12: ${JSON.stringify(spared?.choice)}`);
    // Its own end of turn kept beside what it may still do says it spared them (cloud 2026-10-25).
    assert.equal(spared?.option.kind, "end-turn", JSON.stringify(spared?.choice));
    assert.equal(spared?.spares, true);
  }

  // ── Spare counts every dart on the one it drops (re-test round 2) ──
  {
    const darts = {
      id: "darts",
      name: "Darts",
      budget: "action",
      range: { normal: 120 },
      targets: "enemy",
      targetCount: 3,
      autoHit: true,
      damage: { count: 1, sides: 4, flat: 1 },
    };
    const frail = (encounter: RulesetEncounterState) => {
      const goblin = rulesetCombatant(encounter, "goblin")!;
      goblin.health = { ...goblin.health!, value: 8 };
      // Every dart may go at the same one, as Magic Missile's.
      rulesetCombatant(encounter, "mira")!.actions.find((action) => action.id === "darts")!.targets = {
        side: "enemy",
        count: 3,
        repeat: true,
      };
    };
    const spared = pick(field([darts]), { posture: "hold", spare: true }, [], frail, "patient");
    const onGoblin = (spared?.choice.targetIds ?? []).filter((id) => id === "goblin").length;
    assert.ok(onGoblin <= 1, `two darts can roll 10: ${JSON.stringify(spared?.choice)}`);
  }

  // ── Spare holds back an area that could kill, by the most its dice can roll (re-test 2026-10-24) ──
  {
    const flare = {
      id: "flare",
      name: "Flare",
      budget: "action",
      range: { normal: 150 },
      area: { shape: "burst", size: 20 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
      damage: { count: 8, sides: 6, flat: 0 },
    };
    const sturdy = (encounter: RulesetEncounterState) => {
      for (const id of ["orc", "goblin"]) {
        const one = rulesetCombatant(encounter, id)!;
        one.health = { ...one.health!, value: 40, max: 40 };
      }
    };
    assert.equal(
      pick(field([flare]), { posture: "hold" }, [], sturdy)?.option.id,
      "flare",
      "it blasts when not told to spare",
    );
    const spared = pick(field([flare]), { posture: "hold", spare: true }, [], sturdy);
    assert.notEqual(spared?.option.id, "flare", `8d6 can roll 48: ${JSON.stringify(spared?.choice)}`);
  }

  // ── Whoever drops areas on the party comes first (re-test round 2, the cult mage) ──
  {
    const blast = {
      id: "blast",
      name: "Blast",
      budget: "action",
      range: { normal: 150 },
      area: { shape: "burst", size: 20 },
      save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
      damage: { count: 8, sides: 6, flat: 0 },
    };
    const scene = field([bolt], { mage: { side: "enemy", block: block([blast]), at: { x: 15, y: 8 } } });
    const landed = { type: "area", actorId: "mage", optionId: "blast", label: "Blast", at: { x: 8, y: 3 }, cells: [] };
    const picked = pick(scene, undefined, [landed]);
    assert.equal(picked?.targetId, "mage", `the one throwing them: ${JSON.stringify(picked?.choice)}`);
    assert.equal(pick(field([bolt]))?.targetId, "orc", "with nobody throwing them, the one on the leader");
    // Out of its reach, it steps up to where it can reach them (re-test round 3: the mage stood
    // twelve squares back and nobody went near it).
    const spark = { ...bolt, id: "spark", name: "Spark", range: { normal: 30 } };
    const { state } = fight(
      {
        ada: { side: "party", block: block([smash]), at: { x: 8, y: 2 } },
        mira: { side: "party", block: block([spark]), at: { x: 5, y: 5 } },
        orc: { side: "enemy", block: block([smash]), at: { x: 9, y: 2 } },
        mage: { side: "enemy", block: block([blast]), at: { x: 15, y: 5 } },
      },
      [landed],
    );
    const seen = state.rulesetFight!.eventSeq;
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const turn = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
    const mira = rulesetCombatant(state.rulesetFight!.encounter, "mira")!;
    assert.ok(
      turn.some((event) => event.type === "attack" && event.actorId === "mira" && event.targetId === "mage"),
      `Mira goes at the mage from ${mira.x},${mira.y}: ${JSON.stringify(turn.filter((event) => "actorId" in event && event.actorId === "mira"))}`,
    );
  }

  // ── A friend down comes first, ordered or not (re-test 2026-10-23) ──
  {
    const downed = (encounter: RulesetEncounterState) => {
      const ada = rulesetCombatant(encounter, "ada")!;
      ada.health = { ...ada.health!, value: 0 };
      ada.down = true;
    };
    const raised = pick(field([bolt, mend]), undefined, [], downed);
    assert.equal(raised?.option.id, "mend", `it gets Ada up: ${JSON.stringify(raised?.choice)}`);
    assert.equal(raised?.targetId, "ada");
    // A spell to hold on a friend does not come first either (re-test round 2: Bless, then Spirit
    // Guardians, while the rogue failed death saves).
    const rally = {
      id: "rally",
      name: "Rally",
      budget: "action",
      targets: "ally",
      targetCount: 3,
      range: { normal: 30 },
      concentration: true,
      applies: [{ condition: "invisible", duration: { rounds: 10 } }],
    };
    const lifted = pick(field([rally, bolt, mend]), undefined, [], downed);
    assert.equal(lifted?.option.id, "mend", `Ada before a held spell: ${JSON.stringify(lifted?.choice)}`);
  }

  // ── Following a leader who has struck nobody yet, it stays by them (re-test 2026-10-23) ──
  {
    const scene = field([smash], {
      ogre: { side: "enemy", block: block([smash]), at: { x: 15, y: 9 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 0 } },
      goblin: { side: "enemy", block: block([smash], { health: 20 }), at: { x: 1, y: 9 } },
    });
    const picked = pick(scene, { posture: "follow" });
    const gap = (to: { x: number; y: number }) => Math.max(Math.abs(to.x - 8), Math.abs(to.y - 2));
    assert.ok(!picked?.to || gap(picked.to) <= 1, `it stays by Ada: ${JSON.stringify(picked?.choice)}`);
    // Beside her, not three squares on (round 2: a rogue walked up beside the leader, then Dashed on).
    const { state } = fight({
      ada: { side: "party", block: block([smash]), at: { x: 4, y: 5 } },
      mira: { side: "party", block: block([smash]), at: { x: 1, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 5 } },
    });
    state.party.find((one) => one.id === "mira")!.orders = { posture: "follow" };
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const mira = rulesetCombatant(state.rulesetFight!.encounter, "mira")!;
    assert.ok(Math.max(Math.abs(mira.x! - 4), Math.abs(mira.y! - 5)) <= 1, `beside Ada: ${mira.x},${mira.y}`);
  }

  // ── Retreating with nobody near, it does not Dodge the air (re-test 2026-10-23) ──
  {
    const calm = pick(field(), { posture: "retreat" });
    assert.notEqual(calm?.defensive, "dodge", `no dodge with nobody near: ${JSON.stringify(calm?.choice)}`);
  }

  // ── Hold and retreat ──
  {
    const far = field([smash]);
    const held = pick(far, { posture: "hold" });
    assert.ok(!held?.to, `holding, it walks nowhere: ${JSON.stringify(held?.choice)}`);
    assert.ok(pick(far)?.to, "otherwise it walks up to fight");
    const close = field([smash], {
      mira: { side: "party", block: block([smash], { health: 20 }), at: { x: 9, y: 7 } },
    });
    const away = pick(close, { posture: "retreat" });
    assert.ok(away?.defensive, `retreating, it gets away or dodges: ${JSON.stringify(away?.choice)}`);
  }

  // ── Guarding, it never sprints to the end of its leash ──
  {
    // The orc is far off and Mira may not stray from Ada: the walk stops at the leash with movement
    // to spare, so a sprint would only be her action thrown away.
    const { state } = fight({
      ada: { side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      mira: { side: "party", block: block([smash]), at: { x: 1, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 5 } },
    });
    const seen = state.rulesetFight!.eventSeq;
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const turn = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
    const sprints = turn.filter((event) => event.type === "standard" && event.actorId === "mira");
    assert.deepEqual(
      sprints,
      [],
      `no sprint: ${JSON.stringify(turn.filter((event) => "actorId" in event && event.actorId === "mira"))}`,
    );
    assert.ok(rulesetCombatant(state.rulesetFight!.encounter, "mira")!.x <= 2 + 3, "and she stays by Ada");
  }

  // ── Already at the end of its leash, a turn it spends nowhere says whom it stays beside (laptop
  //    playtest 2026-10-24: "nothing it could do was worth the price") ──
  {
    const { state } = fight({
      ada: { side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      mira: { side: "party", block: block([smash]), at: { x: 5, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 15, y: 5 } },
    });
    const seen = state.rulesetFight!.eventSeq;
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const turn = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
    const why = turn.flatMap((event) => (event.type === "reasoning" && event.actorId === "mira" ? event.reasons : []));
    assert.deepEqual(why, [{ why: "guarding", targetId: "ada" }], JSON.stringify(turn));
  }

  // ── Guarding a leader who hangs back, it goes to the friend fighting alone (re-test 9) ──
  {
    const { state } = fight({
      ada: { side: "party", block: block([smash]), at: { x: 1, y: 5 } },
      mira: { side: "party", block: block([smash]), at: { x: 2, y: 5 } },
      bram: { side: "party", block: block([smash]), at: { x: 8, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 9, y: 5 } },
    });
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const mira = rulesetCombatant(state.rulesetFight!.encounter, "mira")!;
    assert.ok(mira.x >= 5, `Mira heads for Bram and the orc: ${mira.x},${mira.y}`);
  }

  // ── A caster with somebody in range does not drift in to its leader's melee (re-test 2026-10-23) ──
  {
    const { state } = fight({
      ada: { side: "party", block: block([smash]), at: { x: 8, y: 2 } },
      mira: { side: "party", block: block([bolt, mend]), at: { x: 2, y: 5 } },
      orc: { side: "enemy", block: block([smash]), at: { x: 9, y: 2 } },
    });
    const ada = rulesetCombatant(state.rulesetFight!.encounter, "ada")!;
    ada.health = { ...ada.health!, value: 20 };
    const mira = state.party.find((one) => one.id === "mira")!;
    mira.orders = { heal: true };
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    const after = rulesetCombatant(state.rulesetFight!.encounter, "mira")!;
    assert.deepEqual([after.x, after.y], [2, 5], `she stays where she can shoot from: ${after.x},${after.y}`);
  }

  // ── Conserve ──
  {
    const one = {
      ...unit("mira", "player"),
      tactics: {
        version: 1 as const,
        seed: 0,
        category: "unknown" as const,
        proficiency: "master" as const,
        role: "spellcaster" as const,
        adjective: "disciplined" as const,
      },
    };
    const options = () => [
      { action: "big", damage: 0.6, cost: 0.4 },
      { action: "small", damage: 0.4 },
    ];
    assert.equal(chooseCombatCandidate(one, options(), 1), "big");
    assert.equal(chooseCombatCandidate(one, options(), 1, "normal", { conserve: true }), "small");
  }

  // ── The command ──
  {
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "classic",
      party: [unit("ada", "player"), unit("mira", "player")],
      // Sturdy enough that a companion's opening blow never ends the fight before the commands below
      // (initiative is rolled with real dice, so mira sometimes strikes first and the orc gave up).
      enemies: [{ ...unit("orc", "enemy"), hp: 600, maxHp: 600 }],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    commandCombatDirector(state, {
      type: "orders",
      unitId: "mira",
      orders: { posture: "protect", protectId: "ada", heal: true },
    });
    assert.deepEqual(state.party.find((one) => one.id === "mira")!.orders, {
      posture: "protect",
      protectId: "ada",
      heal: true,
    });
    assert.throws(() =>
      commandCombatDirector(state, {
        type: "orders",
        unitId: "mira",
        orders: { posture: "protect", protectId: "mira" },
      }),
    );
    assert.throws(() => commandCombatDirector(state, { type: "orders", unitId: "orc", orders: { posture: "hold" } }));
    commandCombatDirector(state, { type: "orders", unitId: "mira", orders: null });
    assert.equal(state.party.find((one) => one.id === "mira")!.orders, undefined);
  }

  console.log(
    "Companion orders: it guards the leader by default, follows, protects, heals first, spares, holds, retreats and conserves; set and cleared by command.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
