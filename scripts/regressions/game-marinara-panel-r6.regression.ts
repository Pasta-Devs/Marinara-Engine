/**
 * Sonnet panel round 6 (2026-11-06): a hand-played Revive can aim at a fallen ally on a Tactical board;
 * a Marksman's Mark Prey reaches as far as its bow; a bonus-action skill offered on the extra action a
 * bonus gave says it takes that action; a tamed companion says what it lends as the fight starts; and a
 * dragon, which runs rather than yields, doesn't run while mostly whole.
 */
import assert from "node:assert/strict";
import {
  commandCombatDirector,
  createCombatDirector,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  createMarinaraDirectorState,
  marinaraCombatSkills,
  marinaraCombatant,
  marinaraFighter as marinaraFighterOfMaybe,
  marinaraTacticalTurnStart,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";
import {
  beginMarinaraTurn,
  buildMarinaraEnemy,
  marinaraOption,
  performMarinaraOption,
  type MarinaraEvent,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import { validateTacticalUnitAction } from "../../packages/shared/src/features/tactical-combat/engine.js";
import type { TacticalUnit } from "../../packages/shared/src/features/tactical-combat/types.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const marinaraFighterOf = (state: Parameters<typeof marinaraFighterOfMaybe>[0], id: string) =>
  marinaraFighterOfMaybe(state, id)!;
const unit = (id: string, side: "party" | "enemy", archetype: string, skills: string[] = []) => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 20, tier: "standard", archetype: archetype as never });
  fighter.side = side;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  fighter.mp = fighter.maxMp = 999;
  fighter.stamina = fighter.maxStamina = 999;
  return fighter;
};
const board = (fighters: MarinaraFighter[], seed = 1): CombatDirectorState =>
  createCombatDirector({
    id: `r6-${seed}`,
    anchor: "anchor",
    party: fighters.filter((f) => f.side === "party").map((f) => marinaraCombatant(f)),
    enemies: fighters.filter((f) => f.side === "enemy").map((f) => marinaraCombatant(f)),
    style: "tactical",
    difficulty: "normal",
    seed,
    battlefield: { size: "small" } as never,
    marinara: fighters,
  });
const tile = (s: CombatDirectorState, id: string) => s.tactical!.units.find((one) => one.id === id) as TacticalUnit;
/** Puts `id` on a free tile `gap` steps from `from`, in a straight line. */
const place = (s: CombatDirectorState, from: string, id: string, gap: number) => {
  const at = tile(s, from);
  const moving = tile(s, id);
  const taken = (x: number, y: number) => s.tactical!.units.some((one) => one.id !== id && one.x === x && one.y === y);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = at.x + dx! * gap,
      y = at.y + dy! * gap;
    if (x < 0 || y < 0 || x >= s.tactical!.grid.width || y >= s.tactical!.grid.height || taken(x, y)) continue;
    if (s.tactical!.grid.tiles[y]?.[x]?.terrain === "wall") continue;
    moving.x = x;
    moving.y = y;
    return;
  }
  throw new Error("no free tile");
};

// Revive by hand on a Tactical board: the fallen ally is a legal target within support range.
{
  const mender = unit("M", "party", "mender", ["revive"]);
  const ally = unit("A", "party", "blade");
  const foe = unit("F", "enemy", "guard");
  const s = board([mender, ally, foe]);
  const fallen = s.marinara!.fighters.find((one) => one.id === "A")!;
  fallen.hp = 0;
  tile(s, "A").hp = 0;
  place(s, "M", "A", 1);
  s.actorId = "M";
  s.stage = "action";
  const name = tile(s, "M").skills!.find((one) => one.id === "revive")!.name;
  commandCombatDirector(s, {
    type: "tactical",
    action: { type: "skill", unitId: "M", skillName: name, targetId: "A" },
  });
  assert.ok(fallen.hp > 0, "the fallen ally is back up");
}

// A skill on cooldown sent as a board action is refused, not played as a basic attack (slice s1).
{
  const hunter = unit("H", "party", "marksman", ["mark-prey"]);
  const foe = unit("F", "enemy", "guard");
  const s = board([hunter, foe], 4);
  place(s, "H", "F", 2);
  s.actorId = "H";
  s.stage = "action";
  s.marinara!.fighters.find((one) => one.id === "H")!.cooldowns["mark-prey"] = 2;
  const name = tile(s, "H").skills!.find((one) => one.id === "mark-prey")!.name;
  const hp = tile(s, "F").hp;
  assert.throws(
    () =>
      commandCombatDirector(s, {
        type: "tactical",
        action: { type: "skill", unitId: "H", skillName: name, targetId: "F" },
      }),
    /can't be used now/,
  );
  assert.equal(tile(s, "F").hp, hp, "nothing landed");
}

// Tame on a beast still above 30% HP is refused with the reason, not played as a Defend (slice s5).
{
  const tracker = unit("T", "party", "marksman", ["tame"]);
  const beast = unit("B", "enemy", "blade");
  beast.tameable = { name: "Hound", stat: "strength" };
  const s = board([tracker, beast], 5);
  place(s, "T", "B", 2);
  s.actorId = "T";
  s.stage = "action";
  const name = tile(s, "T").skills!.find((one) => one.id === "tame")!.name;
  assert.throws(
    () =>
      commandCombatDirector(s, {
        type: "tactical",
        action: { type: "skill", unitId: "T", skillName: name, targetId: "B" },
      }),
    /too strong to tame: only below 30% HP/,
  );
}

// An attack on another foe while a provoker in reach draws the blows is refused with the reason (s8).
{
  const blade = unit("B", "party", "blade");
  const bastion = unit("P", "enemy", "guard");
  const other = unit("O", "enemy", "scout");
  const s = board([blade, bastion, other], 6);
  place(s, "B", "P", 1);
  place(s, "B", "O", 1);
  s.marinara!.fighters.find((one) => one.id === "P")!.provoking = 2;
  s.actorId = "B";
  s.stage = "action";
  assert.throws(
    () => commandCombatDirector(s, { type: "tactical", action: { type: "attack", unitId: "B", targetId: "O" } }),
    /P draws B's blows: strike it instead/,
  );
}

// Mark Prey reaches 3 tiles, as far as a Marksman's bow; help for a friend stays at 2.
{
  const hunter = unit("H", "party", "marksman", ["mark-prey"]);
  const foe = unit("F", "enemy", "guard");
  const s = board([hunter, foe], 2);
  const reach = tile(s, "H").attackRange.max;
  assert.ok(reach >= 3, `a Marksman's bow reaches 3+ (${reach})`);
  place(s, "H", "F", 3);
  const name = tile(s, "H").skills!.find((one) => one.id === "mark-prey")!.name;
  const problem = validateTacticalUnitAction(s.tactical!, tile(s, "H"), {
    type: "skill",
    unitId: "H",
    skillName: name,
    targetId: "F",
  });
  assert.equal(problem, undefined, problem?.error);
}

// On the extra action a bonus gave, a bonus-action skill says it takes that action.
{
  const hunter = unit("H", "party", "marksman", ["mark-prey"]);
  const foe = unit("F", "enemy", "guard");
  const fresh = marinaraCombatSkills(hunter, [hunter, foe]).find((one) => one.id === "mark-prey")!;
  assert.equal(fresh.takesAction, undefined);
  hunter.commanded = true;
  const spent = marinaraCombatSkills(hunter, [hunter, foe]).find((one) => one.id === "mark-prey")!;
  assert.equal(spent.takesAction, true);
}

// A companion says what it lends as the fight starts.
{
  const keeper = unit("K", "party", "marksman", ["bond"]);
  keeper.companion = { name: "Ridge Hulk", stat: "hp", lends: 0.15, bond: 0.075 };
  const foe = unit("F", "enemy", "guard");
  const s = board([keeper, foe], 3);
  assert.ok(
    s.log.some((one) => one.text === "K's Ridge Hulk lends +15% HP (Bond: the rest of the party +8%)."),
    s.log.map((one) => one.text).join("\n"),
  );
}

// A cleanse says what it cleared.
{
  const mender = unit("M", "party", "mender", ["purify"]);
  const ally = unit("A", "party", "blade");
  ally.statuses.push({ status: "slow", turns: 2 });
  const events: MarinaraEvent[] = [];
  performMarinaraOption(mender, marinaraOption(mender, "purify", [mender, ally])!, [ally], [mender, ally], {
    random: () => 0.5,
    events,
  });
  assert.deepEqual(events.find((one) => one.kind === "cleanse")?.notes, ["slow"]);
}

// Draw Fire counts down on the caster's turns, so an ally who acts first still holds 2 of them (slice s4).
{
  const captain = unit("C", "party", "herald", ["draw-fire"]);
  const tank = unit("T", "party", "guard");
  const foe = unit("F", "enemy", "blade");
  const all = [captain, tank, foe];
  const c = { random: () => 0.5, events: [] as MarinaraEvent[] };
  performMarinaraOption(captain, marinaraOption(captain, "draw-fire", all)!, [tank], all, c);
  assert.equal(tank.provoking, 2);
  beginMarinaraTurn(tank, all, c);
  assert.equal(tank.provoking, 2, "the tank's own turn doesn't count it down");
  beginMarinaraTurn(captain, all, c);
  assert.equal(tank.provoking, 1, "the caster's does");
  captain.hp = 0;
  beginMarinaraTurn(tank, all, c);
  assert.equal(tank.provoking, 0, "with the caster down, its own turns count it");
}

// A counter that drops the attacker ends its flurry: no blow from the fallen (slice tester s8).
{
  const blade = unit("B", "party", "blade", ["flurry"]);
  const guard = unit("G", "enemy", "guard", ["retaliate"]);
  guard.hp = guard.maxHp = 100000;
  blade.hp = 1;
  blade.stats.defense = 0;
  const all = [blade, guard];
  let fell = false;
  for (let n = 0; n < 30 && !fell; n++) {
    blade.hp = 1;
    const events: MarinaraEvent[] = [];
    let r = n;
    performMarinaraOption(blade, marinaraOption(blade, "flurry", all)!, [guard], all, {
      random: () => (r = (r * 9301 + 49297) % 233280) / 233280,
      events,
    });
    const down = events.findIndex((one) => one.kind === "down" && one.targetId === "B");
    if (down < 0) continue;
    fell = true;
    assert.ok(
      !events.slice(down + 1).some((one) => one.actorId === "B" && (one.kind === "hit" || one.kind === "miss")),
      "no swing after it fell",
    );
  }
  assert.ok(fell, "the counter dropped the attacker in some try");
}

// A cleanse takes debuffs only: a Fortress's lowered damage taken stays, Mark Prey's raised one goes (s11).
{
  const mender = unit("M", "party", "mender", ["purify"]);
  const tank = unit("T", "party", "guard");
  tank.mods.push({ stat: "damage-taken", pct: -0.3, turns: 2, source: "fortress" });
  tank.mods.push({ stat: "damage-taken", pct: 0.35, turns: 2, source: "mark-prey" });
  const events: MarinaraEvent[] = [];
  performMarinaraOption(mender, marinaraOption(mender, "purify", [mender, tank])!, [tank], [mender, tank], {
    random: () => 0.5,
    events,
  });
  assert.deepEqual(
    tank.mods.map((one) => one.source),
    ["fortress"],
  );
  assert.deepEqual(events.find((one) => one.kind === "cleanse")?.notes, ["raised damage taken"]);
}

// Panel r7: Follow Through on a board gives a bonus action (the board's only extra turns); a foe that
// yielded doesn't strike back.
{
  const blade = unit("B", "party", "blade", ["follow-through"]);
  const foe = unit("F", "enemy", "guard");
  foe.hp = 1;
  const all = [blade, foe];
  const events: MarinaraEvent[] = [];
  performMarinaraOption(blade, marinaraOption(blade, null, all)!, [foe], all, {
    random: () => 0.01,
    events,
    tactical: true,
  });
  assert.equal(foe.hp, 0);
  assert.equal(blade.bonusTurns, 1, "a bonus action on the board");
  const guard = unit("G", "enemy", "guard", ["retaliate"]);
  guard.hp = guard.maxHp = 100000;
  guard.yielded = true;
  const striker = unit("S", "party", "blade");
  const seen: MarinaraEvent[] = [];
  for (let n = 0; n < 10; n++)
    performMarinaraOption(striker, marinaraOption(striker, null, [striker, guard])!, [guard], [striker, guard], {
      random: () => 0.3,
      events: seen,
    });
  assert.ok(!seen.some((one) => one.kind === "counter"), "a foe that yielded doesn't counter");
}

// Once slept, a foe can't be slept again until it has had a turn awake (panel r7: Lull sleeplock).
{
  const hexer = unit("H", "party", "hexer", ["lull"]);
  const foe = unit("F", "enemy", "blade");
  const all = [hexer, foe];
  const lull = () => {
    const events: MarinaraEvent[] = [];
    performMarinaraOption(hexer, marinaraOption(hexer, "lull", all)!, [foe], all, { random: () => 0, events });
    hexer.cooldowns = {};
    return events;
  };
  lull();
  assert.ok(
    foe.statuses.some((one) => one.status === "sleep"),
    "asleep",
  );
  assert.equal(marinaraOption(hexer, "lull", all), undefined, "not again while it hasn't woken");
  foe.statuses = [];
  beginMarinaraTurn(foe, all, { random: () => 0.5, events: [] });
  lull();
  assert.ok(
    foe.statuses.some((one) => one.status === "sleep"),
    "after a turn awake it can be slept again",
  );
}

// A readied blow lands only if the target is still in reach and the readier wasn't slept or stunned
// meanwhile (owner 2026-11-06): woken early it still loses the blow; on the board a target that walked
// away takes nothing.
{
  const hexer = unit("H", "party", "hexer", ["lull"]);
  const foe = unit("F", "enemy", "blade");
  const all = [hexer, foe];
  foe.charging = { skillId: "heavy-blow", targetId: hexer.id };
  performMarinaraOption(hexer, marinaraOption(hexer, "lull", all)!, [foe], all, { random: () => 0, events: [] });
  foe.statuses = [];
  const events: MarinaraEvent[] = [];
  const start = beginMarinaraTurn(foe, all, { random: () => 0.5, events });
  assert.equal(start.release, undefined, "a slept readier loses the blow even once woken");
  assert.equal(foe.charging, undefined);
  assert.equal(events.find((one) => one.kind === "charge-lost")?.status, "sleep");

  const release = (inReach: boolean) => {
    const runner = unit("R", "party", "scout");
    runner.hp = runner.maxHp = 100000;
    const caster = unit("C", "enemy", "channeler", ["convergence"]);
    caster.charging = { skillId: "convergence", targetId: runner.id };
    const state = createMarinaraDirectorState([runner, caster], 7);
    const lines: string[] = [];
    const acts = marinaraTacticalTurnStart(state, caster.id, 7, (text) => lines.push(text), {
      reaches: () => inReach,
      around: () => [],
    });
    assert.equal(acts, false, "the turn is spent either way");
    return { runner: marinaraFighterOf(state, runner.id), lines };
  };
  const away = release(false);
  assert.equal(away.runner.hp, away.runner.maxHp, "out of reach: nothing lands");
  assert.ok(
    away.lines.some((line) => line.includes("goes off at empty ground")),
    away.lines.join(" | "),
  );
  const near = release(true);
  assert.ok(near.runner.hp < near.runner.maxHp, "still in reach: it lands");

  // A readied area (Quake) goes off at the tile it was aimed at and lands on whoever still stands in
  // it, not on the one who walked away (playtest r69); with nobody left there it hits nothing.
  const quake = (inArea: (ids: { mark: string; stayer: string }) => string[]) => {
    const mark = unit("M", "party", "scout");
    const stayer = unit("S", "party", "guard");
    for (const one of [mark, stayer]) one.hp = one.maxHp = 100000;
    const golem = unit("G", "enemy", "guard");
    golem.charging = { skillId: "enemy:quake", targetId: mark.id, at: { x: 3, y: 3 } };
    const state = createMarinaraDirectorState([mark, stayer, golem], 9);
    const lines: string[] = [];
    marinaraTacticalTurnStart(state, golem.id, 9, (text) => lines.push(text), {
      reaches: () => false,
      around: (at) => {
        assert.deepEqual(at, { x: 3, y: 3 }, "it goes off at the tile it was aimed at");
        return inArea({ mark: mark.id, stayer: stayer.id });
      },
    });
    return { mark: marinaraFighterOf(state, mark.id), stayer: marinaraFighterOf(state, stayer.id), lines };
  };
  const stayed = quake(({ stayer }) => [stayer]);
  assert.equal(stayed.mark.hp, stayed.mark.maxHp, "the one who walked away is spared");
  assert.ok(stayed.stayer.hp < stayed.stayer.maxHp, "the one still in the area is hit");
  const empty = quake(() => []);
  assert.equal(empty.stayer.hp, empty.stayer.maxHp);
  assert.ok(
    empty.lines.some((line) => line.includes("nobody is left where it was aimed")),
    empty.lines.join(" | "),
  );
}

console.log("game-marinara-panel-r6: ok");
