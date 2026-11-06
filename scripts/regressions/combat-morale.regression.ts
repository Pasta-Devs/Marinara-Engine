import assert from "node:assert/strict";
import {
  createCombatDirector,
  commandCombatDirector,
  combatDirectorView,
  chooseDirectorFallback,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

// Losing heart in a Classic or Tactical fight (combat AI E1): the old games' morale rule, driven by
// the mind and temperament the story gives each opponent.
const unit = (id: string, side: Combatant["side"], extra: Partial<Combatant> = {}): Combatant => ({
  id,
  name: id,
  side,
  hp: 100,
  maxHp: 100,
  mp: 0,
  maxMp: 0,
  attack: 1,
  defense: 50,
  speed: 10,
  level: 5,
  skills: [],
  ...extra,
});
// A hero nobody can hurt much, who only ever guards: whatever ends the fight is the other side's heart.
const hero = unit("hero", "player", { hp: 5000, maxHp: 5000, defense: 200 });
const fight = (
  enemies: Combatant[],
  style: "classic" | "tactical" = "classic",
  extra: Partial<Parameters<typeof createCombatDirector>[0]> = {},
) =>
  createCombatDirector({
    id: "enc",
    anchor: "anchor",
    party: [hero],
    enemies,
    style,
    gm: false,
    difficulty: "normal",
    seed: 7,
    ...extra,
  });
/** Plays the fight out with the hero guarding every turn, for at most `steps` commands. */
const play = (s: CombatDirectorState, steps = 60) => {
  for (let i = 0; i < steps && !s.outcome; i++) {
    if (s.stage === "select") commandCombatDirector(s, { type: "begin", unitId: "hero" });
    else if (s.stage === "decision")
      commandCombatDirector(s, { type: "choose", candidateId: chooseDirectorFallback(s) });
    else if (s.style === "tactical")
      commandCombatDirector(s, { type: "tactical", action: { type: "defend", unitId: "hero" } });
    else commandCombatDirector(s, { type: "classic", action: { type: "defend" } });
  }
  return s;
};
const keys = (s: CombatDirectorState) => s.log.flatMap((entry) => (entry.message ? [entry.message.key] : []));

// ── Scores: the story's, else read off mind and temperament; none for a boss or the mindless ──
{
  const s = fight([
    unit("steady", "enemy", { aiHints: { morale: 12 } }),
    unit("zombie", "enemy", { aiHints: { mind: "mindless", morale: 2 } }),
    unit("chief", "enemy", {
      aiHints: { leader: true },
      boss: { points: 3, anticipation: false, attackCost: 1, defendCost: 1, moveCost: 1 },
    }),
    unit("wolf", "enemy", { aiHints: { category: "beast" } }),
  ]);
  assert.equal(s.morale?.steady?.score, 12);
  assert.equal(s.morale?.zombie?.score, undefined, "the mindless never break");
  assert.equal(s.morale?.chief?.score, undefined, "a boss gives up when its story says so");
  assert.equal(s.morale?.chief?.leader, true, "a boss is followed");
  const zealot = fight([unit("zealot", "enemy", { tactics: undefined, aiHints: { morale: 4 } })]);
  zealot.enemies[0]!.tactics!.adjective = "fanatical";
  assert.equal(
    fight([{ ...unit("z", "enemy"), tactics: { ...zealot.enemies[0]!.tactics! } } as Combatant]).morale?.z?.score,
    undefined,
    "a fanatic never breaks",
  );
  const wolf = s.morale?.wolf?.score;
  assert.ok(wolf !== undefined && wolf >= 4 && wolf <= 9, `an animal's nerve is its nature: ${wolf}`);
}

// ── Classic: hurt below half, a thinking opponent gives up and an animal runs; the fight is won ──
{
  const s = play(
    fight([
      unit("goblin", "enemy", { hp: 30, aiHints: { mind: "cunning", morale: 2 } }),
      unit("wolf", "enemy", { hp: 30, aiHints: { category: "beast", mind: "instinct", morale: 2 } }),
    ]),
  );
  assert.equal(s.outcome, "victory");
  assert.deepEqual((s.gone ?? []).map((one) => [one.id, one.left]).sort(), [
    ["goblin", "surrendered"],
    ["wolf", "fled"],
  ]);
  assert.ok(keys(s).includes("game.combat.event.moraleBreaks"));
  assert.ok(keys(s).includes("game.combat.event.surrendered"));
  const summary = combatDirectorView(s).summary!;
  assert.deepEqual(summary.enemies.map((one) => [one.name, one.defeated, one.left]).sort(), [
    ["goblin", false, "surrendered"],
    ["wolf", false, "fled"],
  ]);
}

// ── Never asked: the mindless, the unshakeable, and anybody with nothing to shake it yet ──
{
  const s = play(
    fight([
      unit("zombie", "enemy", { hp: 10, aiHints: { mind: "mindless", morale: 2 } }),
      unit("knight", "enemy", { hp: 10, aiHints: { mind: "tactical", morale: 12 } }),
      unit("fresh", "enemy", { aiHints: { mind: "cunning", morale: 2 } }),
    ]),
    12,
  );
  assert.equal(s.outcome, undefined);
  assert.deepEqual(s.gone ?? [], []);
  assert.deepEqual(s.morale?.knight?.checked, ["hurt"], "checked once, and held");
  assert.ok(keys(s).includes("game.combat.event.moraleHeld"));
  assert.equal(s.morale?.fresh?.checked, undefined);
  assert.equal(s.morale?.zombie?.checked, undefined);
}

// ── Its leader down, or caught unaware: each checked first, as its turn starts ──
{
  const led = play(
    fight([
      unit("chief", "enemy", { hp: 0, aiHints: { leader: true } }),
      unit("bandit", "enemy", { aiHints: { mind: "tactical", morale: 2 } }),
    ]),
  );
  assert.deepEqual(led.morale?.bandit?.checked, ["leader-down"]);
  assert.deepEqual(
    led.gone?.map((one) => one.left),
    ["surrendered"],
  );
  const caught = play(
    fight([unit("guard", "enemy", { aiHints: { mind: "cunning", morale: 2 } })], "classic", { surprised: ["guard"] }),
  );
  assert.deepEqual(caught.morale?.guard?.checked, ["surprised"]);
  assert.equal(caught.outcome, "victory");
}

// ── Tactical: one with room to run walks for the edge and gets away from it ──
{
  const s = fight(
    [unit("wolf", "enemy", { hp: 30, aiHints: { category: "beast", mind: "instinct", morale: 2 } })],
    "tactical",
  );
  const start = s.tactical!.units.find((one) => one.id === "wolf")!;
  const grid = s.tactical!.grid;
  const edge = (x: number, y: number) => Math.min(x, y, grid.width - 1 - x, grid.height - 1 - y);
  const from = edge(start.x, start.y);
  play(s, 200);
  assert.equal(s.outcome, "victory");
  assert.deepEqual(
    s.gone?.map((one) => [one.id, one.left]),
    [["wolf", "fled"]],
  );
  assert.ok(from > 0 ? s.morale?.wolf?.routed === true : true, "it ran before it got away");
  assert.ok(keys(s).includes("game.combat.event.fled"));
}

// ── Turned by what happens (combat AI T7): bloodied, a proud one fights methodically ──
{
  const s = play(
    fight([
      unit("duelist", "enemy", {
        hp: 40,
        aiHints: {
          mind: "tactical",
          morale: 12,
          temperament: "opportunistic",
          shifts: [{ on: "bloodied", to: "methodical" }],
        },
      }),
    ]),
    6,
  );
  const duelist = s.enemies.find((one) => one.id === "duelist")!;
  assert.equal(duelist.tactics?.adjective, "methodical");
  assert.equal(duelist.tactics?.shifted, true);
}

// ── A fight saved before morale: nobody breaks ──
{
  const s = fight([unit("goblin", "enemy", { aiHints: { mind: "cunning", morale: 2 } })]);
  delete s.morale;
  s.enemies[0]!.hp = 10;
  play(s, 12);
  assert.deepEqual(s.gone ?? [], []);
}

console.log(
  "Combat morale: scores from the story or mind and temperament, none for bosses and the mindless; hurt, leader down and surprise each checked once; a thinker beside its foe gives up, an animal or one with room runs off the board; the recap says who fled and who surrendered.",
);
