import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCombatDirector,
  commandCombatDirector,
  combatDirectorView,
  chooseDirectorFallback,
} from "../../packages/server/src/services/game/combat-director.service.js";
import { buildCombatBossPrompt } from "../../packages/server/src/services/game/combat-boss.service.js";
import type { Combatant, CombatSkill } from "../../packages/shared/src/types/game.js";
const unit = (id: string, side: Combatant["side"]): Combatant => ({
  id,
  name: id,
  side,
  hp: 100,
  maxHp: 100,
  mp: 30,
  maxMp: 30,
  attack: 12,
  defense: 5,
  speed: 10,
  level: 5,
  skills: [],
});
const fire: CombatSkill = {
  id: "fire",
  name: "Fireball",
  type: "attack",
  mpCost: 8,
  power: 2,
  cooldown: 2,
  spell: true,
  range: 8,
};
const counter: CombatSkill = {
  id: "counter",
  name: "Unweave",
  type: "debuff",
  mpCost: 6,
  power: 0,
  reaction: "counterspell",
  spell: true,
  range: 8,
};
const hero = { ...unit("hero", "player"), skills: [fire, counter] },
  boss = {
    ...unit("boss", "enemy"),
    skills: [fire, counter],
    boss: { points: 3, anticipation: true, attackCost: 1, defendCost: 1, moveCost: 1 },
  };
const make = (style: "classic" | "tactical" = "tactical") =>
  createCombatDirector({
    id: "enc",
    anchor: "anchor",
    party: [hero],
    enemies: [boss],
    style,
    gm: true,
    difficulty: "normal",
    seed: 42,
  });
let s = make();
assert.equal(s.stage, "select");
commandCombatDirector(s, { type: "begin", unitId: "hero" });
assert.equal(s.window?.kind, "anticipation");
assert.throws(() => commandCombatDirector(s, { type: "begin", unitId: "hero" }), /committed/);
const prompt = buildCombatBossPrompt(s)
  .map((m) => m.content)
  .join("\n");
assert.match(prompt, /Fireball/);
assert.match(prompt, /"mp":30/);
assert.doesNotMatch(prompt, /"tasks"|"seed"|"pending"|"serial"/);
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
assert.equal(s.stage, "action");
assert.equal(s.actorId, "hero");
const before = structuredClone(s);
assert.throws(
  () =>
    commandCombatDirector(s, {
      type: "tactical",
      action: { type: "skill", unitId: "hero", skillName: "Unweave", targetId: "boss" },
    }),
  /reaction window/,
);
s = before;
// Use adjacent positions to prove the reaction trigger, not incidental procedural distance.
s.tactical!.units[0]!.x = 1;
s.tactical!.units[0]!.y = 1;
s.tactical!.units[1]!.x = 2;
s.tactical!.units[1]!.y = 1;
s.tactical!.grid.tiles = s.tactical!.grid.tiles.map((row) => row.map(() => "plains"));
commandCombatDirector(s, {
  type: "tactical",
  action: { type: "skill", unitId: "hero", skillName: "Fireball", targetId: "boss" },
});
assert.equal(s.window?.kind, "reaction");
assert.equal(s.window?.actorId, "boss");
assert.equal(s.tactical!.units[0]!.mp, 22, "cast charged before its reaction window");
const react = s.window!.options.find((c) => c.kind !== "pass")!;
commandCombatDirector(s, { type: "choose", candidateId: react.id }, "gm");
assert.equal(s.window?.controller, "manual", "player can counter the counter");
assert.equal(s.budgets.boss?.reaction, 0);
assert.equal(s.tactical!.units[1]!.mp, 24);
commandCombatDirector(s, { type: "choose", candidateId: "pass" });
assert.equal(s.window?.kind, "legendary");
assert.equal(s.tactical!.units[0]!.mp, 22, "failed/interrupted cast cannot refund generic MP");
const restored = JSON.parse(JSON.stringify(s));
assert.deepEqual(
  JSON.parse(JSON.stringify(combatDirectorView(restored))),
  JSON.parse(JSON.stringify(combatDirectorView(s))),
);
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
assert.equal(s.window?.kind, "ordinary");
const attack = s.window!.options.find((c) => c.kind === "attack")!;
commandCombatDirector(s, { type: "choose", candidateId: attack.id }, "gm");
assert.equal(s.round, 2);
assert.equal(s.stage, "select");
assert.equal(s.budgets.boss?.legendary, 3, "boss allowance refreshes at its ordinary activation");
assert.equal(s.budgets.hero?.reaction, 1, "passing preserves reaction");
// Legendary defend spends points and preserves the boss's ordinary activation.
s = make();
commandCombatDirector(s, { type: "begin", unitId: "hero" });
const defend = s.window!.options.find((c) => c.kind === "defend")!;
commandCombatDirector(s, { type: "choose", candidateId: defend.id }, "gm");
assert.equal(s.budgets.boss?.legendary, 2);
assert.equal(s.tactical!.units[1]!.hasActed, false);
assert.equal(s.stage, "action");
// Explicit zero budget never generates legendary windows, and named non-bosses never get GM turns.
s = createCombatDirector({
  id: "plain",
  anchor: "a",
  party: [hero],
  enemies: [unit("large", "enemy")],
  style: "tactical",
  gm: true,
  difficulty: "normal",
  seed: 8,
});
commandCombatDirector(s, { type: "begin", unitId: "hero" });
assert.equal(s.window, undefined);
assert.equal(s.stage, "action");
// Classic has a real initiative cursor and one actor command per slot.
s = make("classic");
for (let i = 0; i < 25 && s.round === 1; i++) {
  if (s.window)
    commandCombatDirector(
      s,
      {
        type: "choose",
        candidateId: s.window.kind === "ordinary" ? s.window.options.find((c) => c.kind === "defend")!.id : "pass",
      },
      s.window.controller === "gm" ? "gm" : "manual",
    );
  else if (s.stage === "action") commandCombatDirector(s, { type: "classic", action: { type: "defend" } });
}
assert.equal(s.round, 2);
// Local policy can pass a low-value spell and spend on a lethal one.
s = make();
commandCombatDirector(s, { type: "begin", unitId: "hero" });
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
s.tactical!.units[0]!.x = 1;
s.tactical!.units[0]!.y = 1;
s.tactical!.units[1]!.x = 2;
s.tactical!.units[1]!.y = 1;
s.tactical!.grid.tiles = s.tactical!.grid.tiles.map((row) => row.map(() => "plains"));
s.tactical!.units[1]!.tactics!.adjective = "patient";
s.tactical!.units[0]!.attack = 1;
commandCombatDirector(s, {
  type: "tactical",
  action: { type: "skill", unitId: "hero", skillName: "Fireball", targetId: "boss" },
});
assert.equal(chooseDirectorFallback(s), "pass");
s.tactical!.units[1]!.hp = 1;
assert.notEqual(chooseDirectorFallback(s), "pass");
console.log(
  "Combat director: activation commitment, private-order boundary, nested reactions, costs, legendary flags, restore and both initiative modes passed.",
);
// Slot costs, area guards, blocked reactions, and incapacitated parties.
const guard: CombatSkill = {
  id: "guard",
  name: "Interpose",
  type: "buff",
  mpCost: 3,
  power: 0,
  reaction: "guard",
  range: 8,
};
const areaBoss = {
  ...boss,
  skills: [{ ...fire, areaRadius: 1, friendlyFire: true }],
  boss: { points: 0, anticipation: false },
};
s = createCombatDirector({
  id: "area",
  anchor: "a",
  party: [{ ...hero, skills: [guard] }, unit("ally", "player")],
  enemies: [areaBoss],
  style: "tactical",
  gm: true,
  difficulty: "normal",
  seed: 11,
});
s.tactical!.grid.tiles = s.tactical!.grid.tiles.map((row) => row.map(() => "plains"));
for (const [i, u] of s.tactical!.units.entries()) {
  u.x = i + 1;
  u.y = 1;
}
commandCombatDirector(s, { type: "tactical", action: { type: "endTurn" } });
assert.equal(s.window?.kind, "ordinary");
const areaCast = s.window!.options.find((c) => c.skillName === "Fireball" && c.targetId === "hero")!;
assert.ok(areaCast);
commandCombatDirector(s, { type: "choose", candidateId: areaCast.id }, "gm");
assert.equal(s.window?.kind, "reaction");
assert.deepEqual(
  s
    .window!.options.filter((c) => c.kind === "skill")
    .map((c) => c.targetId)
    .sort(),
  ["ally", "hero"],
  "guard offers each threatened ally in the blast",
);
const guardAlly = s.window!.options.find((c) => c.targetId === "ally")!;
commandCombatDirector(s, { type: "choose", candidateId: guardAlly.id });
assert.equal(s.party[0]!.mp, 27);
assert.equal(s.budgets.hero?.reaction, 0);
assert.equal(s.enemies[0]!.mp, 22, "area spell paid once, regardless of target count");
assert.equal(s.tactical!.units[0]!.defending, false, "one-hit guard does not leak into later actions");
assert.ok(s.log.some((e) => /guards an ally/.test(e.text)));
// One remaining slot supports a response with zero MP, and is exhausted at declaration.
s = make();
commandCombatDirector(s, { type: "begin", unitId: "hero" });
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
s.tactical!.units[0]!.x = 1;
s.tactical!.units[0]!.y = 1;
s.tactical!.units[1]!.x = 2;
s.tactical!.units[1]!.y = 1;
s.tactical!.grid.tiles = s.tactical!.grid.tiles.map((row) => row.map(() => "plains"));
s.tactical!.units[1]!.skills.find((k) => k.id === "counter")!.slotLevel = 3;
s.tactical!.units[1]!.spellSlots = { "3": 1 };
s.tactical!.units[1]!.mp = 0;
commandCombatDirector(s, {
  type: "tactical",
  action: { type: "skill", unitId: "hero", skillName: "Fireball", targetId: "boss" },
});
assert.equal(s.window?.kind, "reaction");
commandCombatDirector(s, { type: "choose", candidateId: s.window!.options[0]!.id }, "gm");
assert.equal(s.tactical!.units[1]!.spellSlots!["3"], 0);
assert.equal(s.tactical!.units[1]!.mp, 0);
commandCombatDirector(s, { type: "choose", candidateId: "pass" });
assert.equal(s.tactical!.units[1]!.spellSlots!["3"], 0);
// A wall blocks Counterspell even when ordinary ranged attacks keep their legacy reach.
s = make();
commandCombatDirector(s, { type: "begin", unitId: "hero" });
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
s.tactical!.units[0]!.x = 1;
s.tactical!.units[0]!.y = 1;
s.tactical!.units[1]!.x = 3;
s.tactical!.units[1]!.y = 1;
s.tactical!.grid.tiles[1]![2] = "wall";
commandCombatDirector(s, {
  type: "tactical",
  action: { type: "skill", unitId: "hero", skillName: "Fireball", targetId: "boss" },
});
assert.equal(s.window?.kind, "legendary");
assert.equal(s.enemies[0]!.mp, 30, "blocked reaction never spends MP");
// Depleted MP + no slot gives no reaction, even when the spell would be lethal.
s = make();
commandCombatDirector(s, { type: "begin", unitId: "hero" });
commandCombatDirector(s, { type: "choose", candidateId: "pass" }, "gm");
s.tactical!.units[0]!.x = 1;
s.tactical!.units[0]!.y = 1;
s.tactical!.units[1]!.x = 2;
s.tactical!.units[1]!.y = 1;
s.tactical!.units[1]!.mp = 0;
commandCombatDirector(s, {
  type: "tactical",
  action: { type: "skill", unitId: "hero", skillName: "Fireball", targetId: "boss" },
});
assert.notEqual(s.window?.kind, "reaction");
const frozen = { name: "frozen", stat: "speed" as const, modifier: 0, turnsLeft: 3 };
s = createCombatDirector({
  id: "frozen",
  anchor: "a",
  party: [{ ...hero, statusEffects: [frozen] }],
  enemies: [{ ...unit("foe", "enemy"), statusEffects: [frozen] }],
  style: "classic",
  gm: false,
  difficulty: "normal",
  seed: 1,
});
assert.equal(s.stage, "select");
commandCombatDirector(s, { type: "continue" });
assert.equal(s.round, 3);
commandCombatDirector(s, { type: "continue" });
assert.equal(s.stage, "action");
console.log(
  "Combat director: area protection, spell-slot exhaustion, visibility, empty resources and disabled-turn recovery passed.",
);

// Existing scripted round effects remain visible to both the player and the next GM decision.
s = createCombatDirector({
  id: "mechanics",
  anchor: "a",
  party: [{ ...hero, speed: 10000 }],
  enemies: [unit("pulse-boss", "enemy")],
  style: "classic",
  gm: false,
  difficulty: "normal",
  seed: 1,
  mechanics: [
    {
      name: "Pulse",
      description: "A periodic pulse",
      trigger: "round_interval",
      interval: 1,
      effectType: "damage_all",
      power: 0.1,
      ownerName: "pulse-boss",
    },
  ],
});
commandCombatDirector(s, { type: "classic", action: { type: "defend" } });
assert.equal(s.round, 2);
assert.ok(s.log.some((e) => e.kind === "mechanic" && e.text.includes("Pulse")));

const english = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
);
for (const event of s.log) {
  assert.ok(event.message, `New event ${event.kind} must retain a localizable message`);
  const template = english[event.message.key] ?? english[`${event.message.key}_other`];
  assert.equal(typeof template, "string", `Missing event key ${event.message.key}`);
  for (const [, param] of template.matchAll(/{{(\w+)}}/g))
    assert.ok(param in (event.message.params ?? {}), `Missing ${param}`);
}
// Default skills are ready on the next ordinary activation in both engines: legacy cooldown 1 ticks to 0 at round end.
for (const style of ["classic", "tactical"] as const) {
  const repeat = createCombatDirector({
    id: "repeat",
    anchor: "a",
    party: [
      { ...unit("hero", "player"), speed: 10000, skills: [{ ...fire, cooldown: undefined, spell: false, power: 0.1 }] },
    ],
    enemies: [{ ...unit("target", "enemy"), hp: 10000, maxHp: 10000 }],
    style,
    gm: false,
    difficulty: "normal",
    seed: 4,
  });
  if (repeat.tactical) {
    repeat.tactical.units[0]!.x = 1;
    repeat.tactical.units[0]!.y = 1;
    repeat.tactical.units[1]!.x = 2;
    repeat.tactical.units[1]!.y = 1;
    commandCombatDirector(repeat, { type: "begin", unitId: "hero" });
  }
  const cast =
    style === "classic"
      ? { type: "classic" as const, action: { type: "skill" as const, skillId: "fire", targetId: "target" } }
      : {
          type: "tactical" as const,
          action: { type: "skill" as const, unitId: "hero", skillName: "Fireball", targetId: "target" },
        };
  commandCombatDirector(repeat, cast);
  assert.equal(repeat.round, 2);
  if (repeat.tactical) commandCombatDirector(repeat, { type: "begin", unitId: "hero" });
  commandCombatDirector(repeat, cast);
  assert.equal(repeat.party[0]!.mp, 14, "Default skill can be used on consecutive rounds and pays once each time");
  assert.ok(
    repeat.log.every((event) => event.message),
    "Tactical and Classic resolver events keep localization metadata",
  );
}
