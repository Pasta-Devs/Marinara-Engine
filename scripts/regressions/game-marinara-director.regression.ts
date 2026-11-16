/**
 * Classic Marinara fights in the combat director (2026-11-01): a Classic fight of fighters built from
 * the class tables runs on the timeline with the shared math, the Engine's combat AI plays every unit
 * the player doesn't, the director's units mirror the fighters, a manual party member is asked for
 * its action on its own turn, and a Game Master's window offers the fighter's own options.
 */
import assert from "node:assert/strict";
import {
  commandCombatDirector,
  createCombatDirector,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  marinaraAiAction,
  marinaraCombatant,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  awardMarinaraXp,
  createMarinaraProgression,
  marinaraRandom,
  type MarinaraArchetype,
  type MarinaraPartyTemperament,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  buildMarinaraEnemy,
  buildMarinaraPartyFighter,
  type MarinaraEnemyTier,
} from "../../packages/shared/src/features/marinara-combat.js";

function hero(id: string, primary: MarinaraArchetype, temperament: MarinaraPartyTemperament, level: number) {
  let progression = createMarinaraProgression({ seed: `t:${id}`, primary, temperament });
  if (level > 1)
    progression = awardMarinaraXp(progression, (level - 1) * 100, marinaraRandom(`t:${id}:xp`)).progression;
  return buildMarinaraPartyFighter({ id, name: id, progression });
}

function fight(seed: number, level: number, tiers: MarinaraEnemyTier[], gm = false) {
  const party = [
    hero("ana", "blade", "reckless", level),
    hero("bo", "guard", "protective", level),
    hero("cy", "channeler", "methodical", level),
    hero("di", "mender", "supportive", level),
  ];
  const kinds: MarinaraArchetype[] = ["blade", "marksman", "hexer", "guard"];
  const foes = tiers.map((tier, i) =>
    buildMarinaraEnemy({
      id: `foe${i}`,
      name: `Foe ${i}`,
      archetype: kinds[i % kinds.length],
      level,
      tier,
      ...(i === 0 ? { enemySkills: ["rend"] } : {}),
    }),
  );
  return createCombatDirector({
    id: `enc${seed}`,
    anchor: "anchor",
    party: party.map((f) =>
      marinaraCombatant(f, { aiHints: { temperament: f.id === "ana" ? "reckless" : "supportive", kept: true } }),
    ),
    enemies: foes.map((f) => marinaraCombatant(f)),
    style: "classic",
    gm,
    difficulty: "normal",
    seed,
    marinara: [...party, ...foes],
  });
}

/** Plays a fight out, the leader too, as the Engine's AI would. */
function playOut(s: CombatDirectorState) {
  for (let step = 0; step < 2000 && !s.outcome; step++) {
    if (s.stage === "action" && s.actorId) {
      const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
      const action = marinaraAiAction(s.marinara!, unit, s.round, "normal", false);
      commandCombatDirector(s, { type: "classic", action });
    } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
    else commandCombatDirector(s, { type: "continue" });
  }
  return s;
}

// A fight starts on the leader's turn or plays the foes first; either way the units mirror fighters.
const s = fight(7, 5, ["standard", "standard", "minion"]);
assert.ok(s.marinara, "the fight keeps its Classic Marinara fighters");
for (const unit of [...s.party, ...s.enemies]) {
  const fighter = s.marinara!.fighters.find((f) => f.id === unit.id)!;
  assert.equal(unit.hp, Math.round(fighter.hp));
  assert.equal(unit.maxHp, fighter.maxHp);
  assert.ok(unit.marinara, "a unit carries what the screen shows of its fighter");
}
assert.equal(s.order.length, 0, "no rolled initiative: the timeline decides");
if (s.stage === "action") assert.equal(s.actorId, "ana", "the leader is asked for its own action");

// A wrong target is refused with the reason; a heal can't be aimed at a foe.
if (s.stage === "action" && s.actorId === "ana") {
  assert.throws(
    () => commandCombatDirector(s, { type: "classic", action: { type: "attack", targetId: "bo" } }),
    /target/i,
  );
}

// Played out, the fight ends, and every line of its log is plain words.
playOut(s);
assert.ok(s.outcome === "victory" || s.outcome === "defeat", `ended: ${s.outcome}`);
assert.ok(
  s.log.some((line) => line.kind.startsWith("marinara:")),
  "the log reads the shared math's events",
);
assert.ok(
  s.log.every((line) => !/undefined|NaN/.test(line.text)),
  "no broken log lines",
);
assert.ok(s.round >= 2, "rounds count on the timeline");

// The same seed plays the same fight.
const again = playOut(fight(7, 5, ["standard", "standard", "minion"]));
assert.equal(again.outcome, s.outcome);
assert.deepEqual(
  again.log.map((line) => line.text),
  s.log.map((line) => line.text),
);

// A Game Master playing a boss is offered that fighter's own options, and the Engine marks its picks.
const bossFight = fight(11, 8, ["boss"], true);
bossFight.enemies[0]!.boss = { points: 0, anticipation: false };
const withBoss = createCombatDirector({
  id: "boss",
  anchor: "anchor",
  party: bossFight.party,
  enemies: [{ ...bossFight.enemies[0]!, boss: { points: 2, anticipation: true } }],
  style: "classic",
  gm: true,
  difficulty: "normal",
  seed: 11,
  marinara: structuredClone(bossFight.marinara!.fighters),
});
for (let step = 0; step < 400 && !withBoss.outcome && !withBoss.window; step++) {
  if (withBoss.stage === "action" && withBoss.actorId) {
    const unit = withBoss.party.find((u) => u.id === withBoss.actorId)!;
    commandCombatDirector(withBoss, {
      type: "classic",
      action: marinaraAiAction(withBoss.marinara!, unit, withBoss.round, "normal", false),
    });
  } else commandCombatDirector(withBoss, { type: "continue" });
}
assert.ok(withBoss.window, "the Game Master is asked for the boss's turn");
assert.equal(withBoss.window!.kind, "ordinary");
assert.ok(withBoss.window!.options.some((o) => o.kind === "attack"));
assert.ok(
  withBoss.window!.options.some((o) => o.suggested),
  "the Engine's picks are marked",
);
assert.equal(withBoss.budgets.foe0?.legendary ?? 0, 0, "no legendary actions on the timeline");

// A fighter with 0 Speed still takes its turns (playtest 2026-11-01: a heavy-kit Guard never acted).
{
  const slow = fight(21, 1, ["standard"]);
  const bo = slow.marinara!.fighters.find((f) => f.id === "bo")!;
  bo.stats.speed = 0;
  playOut(slow);
  assert.ok(
    slow.log.some(
      (line) => line.actorId === "bo" && line.kind.startsWith("marinara:") && line.kind !== "marinara:tick",
    ),
    "a 0-Speed fighter still acts",
  );
}

console.log("game-marinara-director: ok");

// Classic UI review (2026-11-01): the log says when a side's back row becomes its front, and a roll reads
// in words ("rolled 63, needed under 34"), not "(63 vs 34%)".
{
  const { createMarinaraDirectorState, performMarinaraAction, marinaraEventText } =
    await import("../../packages/server/src/services/game/marinara-director.service.js");
  const tank = hero("tank", "guard", "protective", 5);
  const mage = hero("mage", "channeler", "methodical", 5);
  tank.row = "front";
  mage.row = "back";
  const brute = buildMarinaraEnemy({ id: "brute", name: "Brute", archetype: "blade", level: 9, tier: "elite" });
  const state = createMarinaraDirectorState([tank, mage, brute], 7);
  const lines: string[] = [];
  for (let n = 0; n < 40 && state.fighters.find((f) => f.id === "tank")!.hp > 0; n++) {
    state.fighters.find((f) => f.id === "tank")!.hp = 1;
    performMarinaraAction(state, "brute", { type: "attack", targetId: "tank" }, 100 + n, false, (text) =>
      lines.push(text),
    );
  }
  assert.ok(
    lines.some((line) => /front row now: its back row is the front/.test(line)),
    `the log says the back row is now the front: ${lines.join(" | ")}`,
  );
  assert.ok(!lines.some((line) => / vs \d+%\)/.test(line)), "no bare '(roll vs chance%)' readout");
  const missed = marinaraEventText(state, {
    kind: "miss",
    actorId: "brute",
    targetId: "mage",
    chance: 34,
    roll: 63,
  } as Parameters<typeof marinaraEventText>[1]);
  assert.match(missed, /\(rolled 63, needed under 34\)/);
}

// The AI's reasons (Debug log, Alyssa's playtest rule): every pick the Engine makes for a foe is logged
// with its score, its largest parts and the runner-up, under its own kind; explaining a pick never
// changes it.
{
  const played = playOut(fight(11, 8, ["standard", "standard", "minion"]));
  const reasons = played.log.filter((entry) => entry.kind === "marinara:reasoning");
  assert.ok(reasons.length > 0, "foe picks say why");
  // Always kept on the fight state too, even for picks a harness asked for itself with no explain.
  assert.ok((played.marinara!.aiReasons?.length ?? 0) >= reasons.length, "the reasons log is never off");
  assert.match(
    reasons[0]!.text,
    /^AI: .+ picks .+ \(-?\d+\.\d\d.*\)(; runner-up .+ \(-?\d+\.\d\d\)|; no other choice)\.$/,
  );
  const live = fight(12, 8, ["standard", "standard"]);
  for (let step = 0; step < 40 && !live.outcome; step++) {
    if (live.stage === "action" && live.actorId) {
      const unit = [...live.party, ...live.enemies].find((u) => u.id === live.actorId)!;
      const plain = marinaraAiAction(
        structuredClone(live.marinara!),
        structuredClone(unit),
        live.round,
        "normal",
        false,
      );
      let told = 0;
      const explained = marinaraAiAction(
        structuredClone(live.marinara!),
        structuredClone(unit),
        live.round,
        "normal",
        false,
        undefined,
        () => told++,
      );
      assert.deepEqual(explained, plain, "explaining a pick doesn't change it");
      assert.equal(told, 1);
      commandCombatDirector(live, { type: "classic", action: plain });
    } else if (live.window) commandCombatDirector(live, { type: "fallback" }, "fallback");
    else commandCombatDirector(live, { type: "continue" });
  }
}
