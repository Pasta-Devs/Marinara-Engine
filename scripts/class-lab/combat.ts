/**
 * Class lab combat: runs Classic Marinara's fight math (packages/shared/src/features/marinara-combat.ts,
 * the same math the Engine's fights use) headless, with the lab's own simple AIs, so class balance
 * can be measured before any of it is played. The lab's party AI picks the best expected value; its
 * foes attack at random, or focus the back row with `focus`. The Engine's fights are run by the
 * Engine's own combat AI instead (scripts/regressions/game-marinara-director-balance.regression.ts).
 */
import {
  MARINARA_STATS,
  marinaraAffinityMultiplier,
  type MarinaraArchetype,
  type MarinaraSkillDef,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  MARINARA_TUNING,
  MARINARA_SKILL_EFFECTS,
  MARINARA_ENEMY_SKILLS,
  MARINARA_PASSIVES,
  beginMarinaraTurn,
  makeMarinaraFighter,
  marinaraBasicAttack,
  marinaraDebuffBurden,
  marinaraDefend,
  marinaraEffectiveStat,
  marinaraExpectedHit,
  marinaraHasHoldTheLine,
  marinaraHoldTheLine,
  marinaraPassiveHooks,
  marinaraSkillCost,
  marinaraActionWeight,
  marinaraTargetsFor,
  marinaraUsable,
  nextMarinaraActor,
  performMarinaraOption,
  releaseMarinaraCharge,
  startMarinaraClock,
  type MarinaraEffect,
  type MarinaraFighter,
  type MarinaraFighterInput,
  type MarinaraFightContext,
  type MarinaraOption,
} from "../../packages/shared/src/features/marinara-combat.js";

export const TUNING = MARINARA_TUNING;
export const SKILL_EFFECTS = MARINARA_SKILL_EFFECTS;
export const ENEMY_SKILLS = MARINARA_ENEMY_SKILLS;
export const PASSIVES = MARINARA_PASSIVES;
export type Effect = MarinaraEffect;
export type LabUnit = MarinaraFighter;
export const passiveHooks = marinaraPassiveHooks;

export function makeUnit(
  input: Omit<MarinaraFighterInput, "carriedIds"> & { carriedIds?: ReadonlySet<string> | readonly string[] },
): LabUnit {
  const { carriedIds, ...rest } = input;
  return makeMarinaraFighter({ ...rest, ...(carriedIds ? { carriedIds: [...carriedIds] } : {}) });
}

// ── The fight ──

export interface FightLog {
  rounds: number;
  winner: "party" | "enemy" | "timeout";
  damageDealt: Record<string, number>;
  damageTaken: Record<string, number>;
  healingDone: Record<string, number>;
  mpSpent: Record<string, number>;
  staminaSpent: Record<string, number>;
  /** Damage dealt by actions that cost MP, by actor. */
  mpSkillDamage: Record<string, number>;
  actions: Record<string, number>;
  /** Party HP lost as a share of party max HP. */
  partyHpLostPct: number;
  downed: string[];
}

export interface FightOptions {
  random: () => number;
  /** A front-row area attack hits every foe (grouped) or only the one targeted (spread out). */
  grouped: boolean;
  maxActions?: number;
  /** Enemies go for the weakest reachable target, back row first, instead of at random. */
  focus?: boolean;
  /** Tactical-style: no rows; Hold the Line stops melee foes heading past a guard. */
  tactical?: boolean;
  /** End the fight (as an enemy win) when any of these units falls. */
  stopWhenDowned?: string[];
}

const living = (units: LabUnit[]) => units.filter((unit) => unit.hp > 0);
const bump = (record: Record<string, number>, id: string, amount: number) => {
  record[id] = (record[id] ?? 0) + amount;
};

/** What the unit with id "slot" chose, across fights (for the lab's trace report). */
export const skillTally: Record<string, number> = {};

export function runFight(party: LabUnit[], enemies: LabUnit[], options: FightOptions): FightLog {
  const all = [...party, ...enemies];
  const log: FightLog = {
    rounds: 0,
    winner: "timeout",
    damageDealt: {},
    damageTaken: {},
    healingDone: {},
    mpSpent: {},
    staminaSpent: {},
    mpSkillDamage: {},
    actions: {},
    partyHpLostPct: 0,
    downed: [],
  };
  const partyMax = party.reduce((sum, unit) => sum + unit.maxHp, 0);
  const partyStart = party.reduce((sum, unit) => sum + unit.hp, 0);
  startMarinaraClock(all, options.random);
  const maxActions = options.maxActions ?? 400;
  let total = 0;
  let clock = 0;
  while (total < maxActions) {
    if (living(enemies).length === 0) {
      log.winner = "party";
      break;
    }
    if (
      living(party).length === 0 ||
      (options.stopWhenDowned && all.some((u) => options.stopWhenDowned!.includes(u.id) && u.hp <= 0))
    ) {
      log.winner = "enemy";
      break;
    }
    // Dummies never act, but the fight still has to move on when only dummies stand against the party.
    const actor = nextMarinaraActor(all) ?? living(all).sort((a, b) => a.next - b.next)[0]!;
    if (!actor.bonusTurns) clock = actor.next;
    takeTurn(actor, all, options, log);
    total++;
  }
  log.rounds = clock / (TUNING.timeline / (15 + TUNING.speedFloor));
  const partyEnd = party.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0);
  log.partyHpLostPct = partyMax ? Math.max(0, partyStart - partyEnd) / partyMax : 0;
  log.downed = party.filter((unit) => unit.hp <= 0).map((unit) => unit.id);
  return log;
}

/** Tallies what a turn's events did into the fight log. */
function record(ctx: MarinaraFightContext, log: FightLog) {
  for (const event of ctx.events) {
    if (event.kind === "hit" || event.kind === "rider") {
      bump(log.damageDealt, event.actorId, event.amount ?? 0);
      bump(log.damageTaken, event.targetId!, event.amount ?? 0);
    } else if (event.kind === "tick" && (event.amount ?? 0) > 0) bump(log.damageTaken, event.actorId, event.amount!);
    else if (event.kind === "heal" || event.kind === "revive") bump(log.healingDone, event.actorId, event.amount ?? 0);
    else if (event.kind === "down" && event.targetId === event.actorId && !log.downed.includes(event.actorId))
      log.downed.push(event.actorId);
  }
  ctx.events.length = 0;
}

function takeTurn(actor: LabUnit, all: LabUnit[], options: FightOptions, log: FightLog) {
  const ctx: MarinaraFightContext = {
    random: options.random,
    tactical: options.tactical,
    grouped: options.grouped ? undefined : false,
    events: [],
  };
  const start = beginMarinaraTurn(actor, all, ctx);
  record(ctx, log);
  if (actor.hp <= 0 || actor.dummy) return;
  if (start.release) {
    bump(log.actions, actor.id, 1);
    releaseMarinaraCharge(actor, start.release, all, ctx);
    record(ctx, log);
    return;
  }
  if (!start.acts) return;
  bump(log.actions, actor.id, 1);
  const choice = actor.side === "party" ? choose(actor, all, options) : enemyChoose(actor, all, options, log);
  if (!choice) return;
  if (actor.id === "slot") bump(skillTally, choice === "defend" ? "defend" : (choice.option.id ?? "attack"), 1);
  if (choice === "defend") {
    marinaraDefend(actor, ctx);
    record(ctx, log);
    return;
  }
  const mp = actor.mp;
  const stamina = actor.stamina;
  const dealtBefore = log.damageDealt[actor.id] ?? 0;
  performMarinaraOption(actor, choice.option, choice.targets, all, ctx);
  record(ctx, log);
  if (mp > actor.mp) bump(log.mpSpent, actor.id, mp - actor.mp);
  if (stamina > actor.stamina) bump(log.staminaSpent, actor.id, stamina - actor.stamina);
  if (choice.option.skill?.resource === "mp" && choice.option.skill.cost)
    bump(log.mpSkillDamage, actor.id, (log.damageDealt[actor.id] ?? 0) - dealtBefore);
}

type Choice = { option: MarinaraOption; targets: LabUnit[] } | "defend";

/** The lab's party AI: the best expected value with simple rules for support. */
function choose(actor: LabUnit, all: LabUnit[], fight: FightOptions): Choice | null {
  const tactical = !!fight.tactical;
  const grouped = fight.grouped;
  const options = marinaraUsable(actor);
  const friends = living(all.filter((unit) => unit.side === actor.side));
  const foes = living(all.filter((unit) => unit.side !== actor.side));
  if (!foes.length) return null;
  const threatened = foes.some((foe) => !foe.dummy);
  const eff = (unit: LabUnit, stat: Parameters<typeof marinaraEffectiveStat>[1]) =>
    marinaraEffectiveStat(unit, stat, all);
  const hit = (from: LabUnit, to: LabUnit, effect: Effect) => marinaraExpectedHit(from, to, effect, all, tactical);
  let best: { option: MarinaraOption; targets: LabUnit[]; score: number } | null = null;
  const consider = (option: MarinaraOption, targets: LabUnit[], score: number) => {
    const weight = marinaraActionWeight(option.effect);
    const perTime = score / weight;
    const price = option.skill ? marinaraSkillCost(actor, option.skill) : null;
    // MP is a budget: spend it when it pays, not on trifles. Stamina comes back, so it matters less.
    const adjusted =
      perTime - (price ? price.cost * (price.resource === "mp" ? TUNING.mpCostWeight : TUNING.staminaCostWeight) : 0);
    if (!best || adjusted > best.score) best = { option, targets, score: adjusted };
  };
  for (const option of options) {
    const { effect, skill } = option;
    if (option.id?.startsWith("enemy:")) continue;
    const pool = marinaraTargetsFor(actor, effect, all);
    if (!pool.length) continue;
    switch (effect.kind) {
      case "damage": {
        if (effect.target === "all-enemies" || effect.target === "front-row") {
          const reach = effect.target === "front-row" ? pool.filter((u) => u.row === "front") : pool;
          const front = reach.length ? reach : pool;
          const struck = effect.target === "front-row" && !grouped ? front.slice(0, 1) : front;
          const spread = struck.length > 1 ? { ...effect, spread: TUNING.areaSpreadPct } : effect;
          const value = struck.reduce((sum, target) => sum + Math.min(target.hp, hit(actor, target, spread)), 0);
          consider(option, struck, effect.charge ? value / 2 : value);
        } else {
          for (const target of pool) {
            const value = Math.min(target.hp * 1.2, hit(actor, target, effect));
            consider(option, [target], effect.charge ? value / 2 : value);
          }
        }
        break;
      }
      case "heal": {
        if (effect.target === "self") {
          if (!threatened || actor.hp > actor.maxHp * 0.6) break;
          consider(option, [actor], Math.min(actor.maxHp - actor.hp, actor.maxHp * (effect.pctOfMax ?? 0)) * 1.3);
          break;
        }
        const amount = eff(actor, "magic") * TUNING.healMagicPct + (effect.power ?? 0);
        const wound = (u: LabUnit) => (u.statuses.some((s) => s.status === "wound") ? TUNING.woundHealing : 1);
        const healValue = (u: LabUnit) =>
          Math.min(u.maxHp - u.hp, amount * wound(u)) * (u.hp < u.maxHp * 0.6 ? 1 : 0.3);
        const cleanValue = (u: LabUnit) =>
          effect.cleanse === "all"
            ? marinaraDebuffBurden(u, all)
            : effect.cleanse === "one"
              ? marinaraDebuffBurden(u, all) * 0.6
              : 0;
        if (effect.target === "party") {
          const value = friends.reduce((sum, u) => sum + healValue(u) + cleanValue(u), 0);
          if (friends.some((u) => u.hp < u.maxHp * 0.6) || value > 0) consider(option, friends, value * 1.1);
        } else {
          const ranked = [...friends].sort((a, b) => healValue(b) + cleanValue(b) - healValue(a) - cleanValue(a))[0]!;
          const value = healValue(ranked) + cleanValue(ranked);
          if (value > 0) consider(option, [ranked], value * 1.3);
        }
        break;
      }
      case "cleanse": {
        const ranked = [...friends].sort((a, b) => marinaraDebuffBurden(b, all) - marinaraDebuffBurden(a, all))[0];
        if (ranked && marinaraDebuffBurden(ranked, all) > 0)
          consider(option, [ranked], marinaraDebuffBurden(ranked, all) * 1.2);
        break;
      }
      case "revive": {
        const down = all.filter((u) => u.side === actor.side && u.hp <= 0);
        if (down.length) consider(option, [down[0]!], down[0]!.maxHp * (effect.power ?? 0.25) * 3);
        break;
      }
      case "shield": {
        if (!threatened) break;
        const front = friends.filter((u) => u.row === "front" && u.shield <= 0)[0];
        if (front) consider(option, [front], (eff(actor, "magic") + (effect.power ?? 0)) * 0.9);
        break;
      }
      case "buff": {
        const already = (effect.target === "self" ? [actor] : friends).some((u) =>
          u.mods.some((m) => m.source === skill!.id),
        );
        if (already) break;
        if (effect.stat === "imbue") {
          // Each imbued fighter's gain (the whole party for Edge Runes and Grand Inscription), plus
          // Grand Inscription's damage rider, as the Engine's AI values them.
          const who = effect.target === "self" ? [actor] : friends;
          let value = 0;
          for (const u of who) {
            if (u.mods.some((m) => m.stat === "imbue")) continue;
            const plain = bestDamage(u, all, tactical);
            u.mods.push({ stat: "imbue", pct: 1, turns: 1, source: "probe" });
            const imbued = bestDamage(u, all, tactical);
            u.mods = u.mods.filter((m) => m.source !== "probe");
            value += Math.max(0, imbued - plain) * (effect.duration ?? 3) * 0.8;
          }
          for (const also of effect.alsoMods ?? [])
            if (also.stat === "damage")
              value +=
                who.reduce((sum, u) => sum + bestDamage(u, all, tactical), 0) * also.pct * (effect.duration ?? 1) * 0.7;
          if (value > 0) consider(option, who, value);
          break;
        }
        if (effect.exposeNext) {
          if (actor.exposeNext) break;
          const others = friends
            .filter((u) => u.id !== actor.id)
            .reduce((sum, u) => sum + bestDamage(u, all, tactical), 0);
          consider(
            option,
            [actor],
            bestDamage(actor, all, tactical) * (effect.pct ?? 0) +
              others * effect.exposeNext * 2 * 0.6 +
              (threatened ? actor.maxHp * 0.05 : 0),
          );
          break;
        }
        if (effect.stat === "damage-taken" || effect.stat === "resistance") {
          if (!threatened) break;
          const incoming = foes.reduce((sum, foe) => sum + eff(foe, "strength"), 0);
          consider(
            option,
            effect.target === "self" ? [actor] : friends,
            incoming * Math.abs(effect.pct ?? 0) * (effect.duration ?? 1) * 0.8,
          );
        } else {
          const damagers = effect.target === "self" ? [actor] : friends;
          const dealt = damagers.reduce((sum, u) => sum + eff(u, u.magicBasic ? "magic" : "strength"), 0);
          consider(option, damagers, dealt * (effect.pct ?? 0) * (effect.duration ?? 1) * 0.7);
        }
        break;
      }
      case "debuff": {
        const fresh = pool.filter((u) => !u.mods.some((m) => m.source === skill!.id));
        if (!fresh.length) break;
        if ((effect.stat === "damage" || effect.stat === "speed") && !threatened) break;
        // One mark at a time, as the Engine AI: the party focuses the marked foe.
        if (
          effect.stat === "damage-taken" &&
          effect.target === "enemy" &&
          foes.some((u) => u.mods.some((m) => m.source === skill!.id))
        )
          break;
        const value =
          effect.stat === "damage-taken"
            ? friends.reduce((sum, u) => sum + eff(u, "strength") * 0.5, 0) * (effect.pct ?? 0) * (effect.duration ?? 1)
            : fresh.reduce((sum, foe) => sum + eff(foe, "strength"), 0) *
              Math.abs(effect.pct ?? 0) *
              (effect.duration ?? 1) *
              0.6;
        // A mark goes on the foe nearest to falling, which the party can finish under it.
        const pick =
          effect.stat === "damage-taken"
            ? fresh.sort((a, b) => a.hp - b.hp)[0]!
            : fresh.sort((a, b) => b.hp - a.hp)[0]!;
        consider(option, effect.target === "all-enemies" ? fresh : [pick], value);
        break;
      }
      case "status": {
        if (effect.status === "regen") {
          if (!threatened || friends.some((u) => u.statuses.some((s) => s.status === "regen"))) break;
          consider(
            option,
            friends,
            friends.reduce((s, u) => s + u.maxHp * (effect.power ?? 0.1), 0) * (effect.duration ?? 1) * 0.6,
          );
          break;
        }
        const fresh = pool.filter((u) => !u.statuses.some((s) => s.status === effect.status));
        if (!fresh.length) break;
        if ((effect.status === "sleep" || effect.status === "stun" || effect.status === "confuse") && !threatened)
          break;
        const target = fresh.sort((a, b) => b.hp - a.hp)[0]!;
        const value =
          effect.status === "poison" || effect.status === "wither"
            ? target.maxHp *
              (effect.power ?? 0.08) *
              (effect.duration ?? 3) *
              (effect.chance ?? 1) *
              (effect.status === "poison" ? marinaraAffinityMultiplier(target.affinities, "poison") : 1)
            : effect.status === "doom"
              ? Math.min(target.hp, target.maxHp * (target.maxHp > 300 ? TUNING.doomBossPct : TUNING.doomPct)) *
                (effect.chance ?? 1) *
                0.8
              : eff(target, "strength") *
                1.5 *
                (effect.duration ?? 1) *
                (effect.chance ?? 1) *
                (effect.target === "all-enemies" ? fresh.length : 1);
        consider(option, effect.target === "all-enemies" ? fresh : [target], value);
        break;
      }
      case "cover": {
        if (!threatened || actor.covering) break;
        const exposed = friends
          .filter((u) => u.id !== actor.id && !friends.some((f) => f.covering === u.id))
          .sort((a, b) => Number(b.row === "back") - Number(a.row === "back") || a.hp - b.hp)[0];
        if (exposed) {
          const incoming = foes.reduce((sum, foe) => sum + Math.max(eff(foe, "strength"), eff(foe, "magic")), 0);
          consider(option, [exposed], incoming * (exposed.hp < exposed.maxHp * 0.6 ? 1.2 : 0.8));
        }
        break;
      }
      case "provoke": {
        if (!threatened || actor.provoking > 0 || friends.length < 2) break;
        consider(option, [actor], foes.reduce((s, f) => s + eff(f, "strength"), 0) * 0.5);
        break;
      }
      case "taunt": {
        if (!threatened || friends.length < 2) break;
        const loose = foes.filter((f) => !(f.tauntTurns > 0 && f.tauntedBy === actor.id) && !f.dummy);
        if (!loose.length) break;
        const target = loose.sort(
          (a, b) => eff(b, "strength") + eff(b, "magic") - eff(a, "strength") - eff(a, "magic"),
        )[0]!;
        consider(option, [target], Math.max(eff(target, "strength"), eff(target, "magic")) * 1.2);
        break;
      }
      case "ward": {
        if (!threatened || friends.length < 2 || actor.wardTurns > 0) break;
        const others = friends.filter((u) => u.id !== actor.id);
        const ward = others.sort(
          (a, b) => Number(b.row === "front") - Number(a.row === "front") || a.hp / a.maxHp - b.hp / b.maxHp,
        )[0]!;
        consider(option, [ward], bestDamage(actor, all, tactical) * (effect.duration ?? 3) * 0.5);
        break;
      }
      case "extra-turn":
        consider(option, [actor], bestDamage(actor, all, tactical) * 0.9);
        break;
      case "command": {
        const others = friends.filter((u) => u.id !== actor.id);
        if (!others.length) break;
        const value =
          effect.target === "party"
            ? others.reduce((s, u) => s + bestDamage(u, all, tactical), 0) * 0.9
            : Math.max(...others.map((u) => bestDamage(u, all, tactical)));
        consider(
          option,
          effect.target === "party"
            ? others
            : [others.sort((a, b) => bestDamage(b, all, tactical) - bestDamage(a, all, tactical))[0]!],
          value,
        );
        break;
      }
    }
  }
  // Defending: worth it only when hurt and threatened.
  const picked = best as { option: MarinaraOption; targets: LabUnit[]; score: number } | null;
  if (threatened && actor.hp < actor.maxHp * 0.3 && picked && picked.score < actor.maxHp * 0.15) return "defend";
  return picked;
}

function bestDamage(unit: LabUnit, all: LabUnit[], tactical: boolean): number {
  const foes = living(all.filter((u) => u.side !== unit.side));
  if (!foes.length) return 0;
  let best = 0;
  for (const { effect } of marinaraUsable(unit)) {
    if (effect.kind !== "damage") continue;
    for (const target of marinaraTargetsFor(unit, effect, all))
      best = Math.max(best, marinaraExpectedHit(unit, target, effect, all, tactical));
  }
  return best;
}

function enemyChoose(actor: LabUnit, all: LabUnit[], options: FightOptions, log: FightLog): Choice | null {
  const { random } = options;
  const usable = marinaraUsable(actor);
  const basic = usable[0]!;
  const effect = marinaraBasicAttack(actor);
  const pool = marinaraTargetsFor(actor, effect, all);
  // A confused foe's swing may go astray: the shared math decides that as it lands.
  const confused = actor.statuses.some((s) => s.status === "confuse");
  if (!pool.length) return null;
  let target = pool[Math.floor(random() * pool.length)]!;
  if (options.focus && !confused) {
    // Back row first, then whoever would fall soonest.
    target = [...pool].sort(
      (a, b) =>
        Number(b.row === "back") - Number(a.row === "back") ||
        a.hp / Math.max(1, marinaraExpectedHit(actor, a, effect, all, !!options.tactical)) -
          b.hp / Math.max(1, marinaraExpectedHit(actor, b, effect, all, !!options.tactical)),
    )[0]!;
  }
  // Hold the Line (Tactical): a melee foe heading past a guard to the back row is stopped beside it,
  // takes a free attack, and fights the guard instead.
  if (options.tactical && !effect.ranged && target.row === "back") {
    const guard = living(all.filter((u) => u.side === target.side && marinaraHasHoldTheLine(u)))[0];
    if (guard) {
      const ctx: MarinaraFightContext = { random, tactical: true, events: [] };
      const stands = marinaraHoldTheLine(guard, actor, all, ctx);
      record(ctx, log);
      if (!stands) return null;
      target = guard;
    }
  }
  // Foes use an ability now and then, on a target that doesn't already suffer it.
  for (const option of usable.filter((o) => o.id?.startsWith("enemy:"))) {
    if (confused || random() >= 0.4) continue;
    const ability = option.effect;
    const reach = marinaraTargetsFor(actor, ability, all);
    const fresh = reach.filter(
      (u) => !(ability.applies && u.statuses.some((s) => s.status === ability.applies!.status)),
    );
    if (!fresh.length) continue;
    const picked = fresh.includes(target) ? target : fresh[0]!;
    return { option, targets: [picked] };
  }
  return { option: basic, targets: [target] };
}

export { MARINARA_STATS, nextMarinaraActor };
export type { MarinaraArchetype, MarinaraSkillDef };
