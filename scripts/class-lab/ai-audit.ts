/**
 * AI audit (thread "Review Classic AI action weighing", 2026-11-02): what the Engine's combat AI does with
 * its turns in Classic Marinara fights, and how many of those turns are wasted. Random parties of four
 * (any class of the level's tier), bestiary encounters for the party's level, the Engine's AI on both sides.
 *
 *   tsx scripts/class-lab/ai-audit.ts [fights]
 *
 * Env: LEVELS=6,16,26, DIFF=hard,deadly, STYLE=classic|tactical, JSON=out.json, SEED=prefix.
 *
 * Counted as waste, from the state just before the turn:
 *  - renew: a timed buff (not a song) cast while every fighter it covers still has it;
 *  - idle-heal: a heal or party heal whose targets are all at 90%+ HP and have nothing to cleanse;
 *  - idle-shield: a shield on someone already shielded;
 *  - defend: a Defend while a damaging option was on the table (counted, not judged).
 * Damage choice: the expected damage of the pick over the best expected damage on the table.
 */
import { keepFightReasons } from "./reasons-log.js";
import { mkdirSync, writeFileSync } from "node:fs";
// Also a readable per-fight log (the fight's own log lines, AI reasons included) when REASONS_DIR is set.
const REASONS_DIR = process.env.REASONS_DIR;
import {
  commandCombatDirector,
  createCombatDirector,
  marinaraBoardTurn,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  marinaraAiAction,
  marinaraPickReasons,
  marinaraBoardAiAction,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  canTraverseTile,
  decideTacticalAction,
  validateTacticalUnitAction,
} from "../../packages/shared/src/features/tactical-combat/index.js";
// Tactical turns the AI spent walking (no blow, no guard): where they went and whether a blow was legal
// from where the unit stood (the r38 playtest's approach checks).
const approach = new Map<string, number>();
import { marinaraFightStart } from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import { MARINARA_CLASSES, marinaraRandom } from "../../packages/shared/src/features/marinara-classes.js";
import {
  MARINARA_BESTIARY_SETTINGS,
  marinaraBuildEncounter,
  marinaraEnemyFamily,
  marinaraEnemyName,
  type MarinaraEncounterDifficulty,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import {
  MARINARA_TUNING,
  marinaraDebuffBurden,
  marinaraExpectedHit,
  marinaraTargetsFor,
  marinaraUsable,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import { marinaraAiCandidates, chooseMarinaraAction } from "../../packages/shared/src/features/marinara-ai.js";
import type { TacticalUnit } from "../../packages/shared/src/features/tactical-combat/types.js";
import type { Combatant } from "../../packages/shared/src/index.js";
import { buildCharacter } from "./class-lab.js";

const count = Number(process.argv[2] ?? 24);
// FLOOR=0.3: the share of a hit's attack and power it always deals. PHYS=1: parties from the physical
// trees only (Blade, Guard, Scout, Marksman, Herald).
if (process.env.FLOOR) MARINARA_TUNING.minDamagePct = Number(process.env.FLOOR);
const PHYS_TREES = new Set(["blade", "guard", "scout", "marksman", "herald"]);
const LEVELS = (process.env.LEVELS ?? "6,16,26").split(",").map(Number);
const DIFFS = (process.env.DIFF ?? "hard,deadly").split(",") as MarinaraEncounterDifficulty[];
const style = (process.env.STYLE ?? "classic") as "classic" | "tactical";
const SETTINGS = MARINARA_BESTIARY_SETTINGS.filter((s) => s !== "modern_day");
const tierAt = (level: number) => (level < 10 ? "base" : level < 20 ? "advanced" : "master");

interface Tally {
  turns: number;
  partyTurns: number;
  foeTurns: number;
  renew: { party: number; foe: number; skills: Record<string, number> };
  idleHeal: { party: number; foe: number; skills: Record<string, number> };
  heals: { party: number; foe: number };
  idleShield: { party: number; foe: number };
  shields: { party: number; foe: number };
  defend: { party: number; foe: number; withDamage: number; byTemper: Record<string, number>; inReach: number };
  turnsByTemper: Record<string, number>;
  damageChoice: { picks: number; ratioSum: number; under60: number; physOverMagic: number };
  kinds: Record<string, number>;
  /** Party skills: turns it was usable, and turns it was picked. */
  avail: Record<string, number>;
  reviveChance: Record<string, number>;
  reasonLines: number;
  picked: Record<string, number>;
  stallNotes: string[];
  skills: Record<string, Record<string, number>>;
  fights: number;
  wins: number;
  stalls: number;
  rounds: number;
}
const lastPick = new Map<string, { skill?: string; round: number }>();
const tally: Tally = {
  turns: 0,
  partyTurns: 0,
  foeTurns: 0,
  renew: { party: 0, foe: 0, skills: {} },
  idleHeal: { party: 0, foe: 0, skills: {} },
  heals: { party: 0, foe: 0 },
  idleShield: { party: 0, foe: 0 },
  shields: { party: 0, foe: 0 },
  defend: { party: 0, foe: 0, withDamage: 0, byTemper: {}, inReach: 0 },
  turnsByTemper: {},
  damageChoice: { picks: 0, ratioSum: 0, under60: 0, physOverMagic: 0 },
  kinds: {},
  avail: {},
  reviveChance: {},
  reasonLines: 0,
  picked: {},
  stallNotes: [],
  skills: {},
  fights: 0,
  wins: 0,
  stalls: 0,
  rounds: 0,
};

const bump = (rec: Record<string, number>, key: string, by = 1) => (rec[key] = (rec[key] ?? 0) + by);

/** Looks at one AI pick against the state it was made in. */
function audit(
  s: CombatDirectorState,
  actor: MarinaraFighter,
  temper: string,
  pick: { kind: "attack" | "skill" | "defend" | "other"; skillId?: string; targetId?: string },
) {
  const all = s.marinara!.fighters;
  const party = actor.side === "party";
  const side = party ? "party" : "foe";
  tally.turns++;
  party ? tally.partyTurns++ : tally.foeTurns++;
  bump(tally.turnsByTemper, `${side}:${temper}`);
  const options = marinaraUsable(actor, all);
  if (
    process.env.DEBUG_MOD &&
    party &&
    all.some((u) => u.side === "party" && u.skills.some((k) => k.id === process.env.DEBUG_MOD))
  ) {
    const m = actor.mods.find((x) => x.source === process.env.DEBUG_MOD);
    console.log(
      `MOD r${s.round} ${actor.id} ${actor.classId} pick=${pick.skillId ?? pick.kind} ${process.env.DEBUG_MOD}=${m ? m.turns : "-"}`,
    );
  }
  if (process.env.DEBUG_SKILL && party && options.some((o) => o.id === process.env.DEBUG_SKILL)) {
    const cands = marinaraAiCandidates(actor, all, { tactical: style === "tactical" });
    const mine = cands.filter((c) => c.action.optionId === process.env.DEBUG_SKILL);
    const fmt = (c: (typeof cands)[number]) =>
      `${c.action.optionId}:${["damage", "finish", "healing", "support", "setup", "protection", "cost"]
        .map((k) => {
          const v = (c as Record<string, unknown>)[k];
          return typeof v === "number" && v ? `${k[0]}${v.toFixed(2)}` : "";
        })
        .filter(Boolean)
        .join(",")}`;
    console.log(
      `DBG ${actor.classId} temper=${temper} pick=${pick.skillId ?? pick.kind} | ${mine.map(fmt).join(" ")} | foes ${all
        .filter((u) => u.side !== actor.side && u.hp > 0)
        .map((u) => JSON.stringify(u.affinities))
        .join(" ")} | ${cands
        .filter((c) => c.action.optionId !== process.env.DEBUG_SKILL)
        .slice(0, 4)
        .map(fmt)
        .join(" ")}`,
    );
  }
  if (party && all.some((u) => u.side === "party" && u.hp <= 0)) {
    const rev = options.find((o) => o.effect.kind === "revive");
    if (rev) {
      bump(tally.reviveChance, "chances");
      bump(tally.reviveChance, `pick:${pick.skillId === rev.id ? "revive" : (pick.skillId ?? pick.kind)}`);
    }
  }
  {
    const key = `${actor.id}`;
    const prev = lastPick.get(key);
    const sid = pick.skillId;
    const opt = sid ? options.find((o) => o.id === sid || o.label === sid) : undefined;
    if (
      sid &&
      prev &&
      prev.skill === sid &&
      prev.round === s.round - 1 &&
      !actor.commanded &&
      (opt?.effect.cooldown ?? 0) >= 2
    )
      bump(tally.reviveChance, `cooldownBack2Back:${side}:${sid}`);
    if (!actor.commanded) lastPick.set(key, { skill: sid, round: s.round });
  }
  if (actor.commanded) bump(tally.reviveChance, `${side}:commanded:${pick.kind === "defend" ? "defend" : "act"}`);
  if (party) for (const o of options) if (o.id) bump(tally.avail, o.id);
  if (party && pick.kind === "skill" && pick.skillId) bump(tally.picked, pick.skillId);
  const friends = all.filter((u) => u.side === actor.side && u.hp > 0);
  const foes = all.filter((u) => u.side !== actor.side && u.hp > 0);
  // The best expected damage on the table.
  let best = 0;
  let bestMagic = 0;
  let bestPhys = 0;
  for (const o of options) {
    if (o.effect.kind !== "damage") continue;
    for (const t of marinaraTargetsFor(actor, o.effect, all)) {
      if (t.side === actor.side || t.hp <= 0) continue;
      const e = Math.min(t.hp, marinaraExpectedHit(actor, t, o.effect, all, style === "tactical"));
      best = Math.max(best, e);
      if (o.effect.damage === "magic") bestMagic = Math.max(bestMagic, e);
      else bestPhys = Math.max(bestPhys, e);
    }
  }
  if (pick.kind === "defend") {
    if (process.env.DEBUG_DEFEND && (process.env.DEBUG_DEFEND === "foe" ? !party : party)) {
      const cands = marinaraAiCandidates(actor, all, { tactical: style === "tactical" });
      const fmt = (c: (typeof cands)[number]) =>
        `${c.action.optionId}:${["damage", "finish", "healing", "support", "setup", "protection", "cost", "risk"]
          .map((k) => {
            const v = (c as Record<string, unknown>)[k];
            return typeof v === "number" && v ? `${k[0]}${v.toFixed(2)}` : "";
          })
          .filter(Boolean)
          .join(",")}`;
      console.log(
        `DEF ${actor.classId ?? actor.name} r${s.round} ${temper} hp ${actor.hp}/${actor.maxHp} st ${actor.stamina}/${actor.maxStamina} mp ${actor.mp} | ${cands.map(fmt).join(" ")}`,
      );
    }
    party ? tally.defend.party++ : tally.defend.foe++;
    if (best > 0) tally.defend.withDamage++;
    bump(tally.defend.byTemper, `${side}:${temper}`);
    bump(tally.kinds, `${side}:defend`);
    return;
  }
  const option =
    pick.kind === "attack" ? options.find((o) => o.id === null) : options.find((o) => o.id === pick.skillId);
  if (!option) {
    bump(tally.kinds, `${side}:unknown`);
    if (process.env.DEBUG_UNKNOWN)
      console.log(
        "unknown",
        pick.skillId,
        options.map((o) => o.label).join("/"),
        JSON.stringify(actor.enemySkills),
        JSON.stringify(actor.cooldowns),
      );
    return;
  }
  const effect = option.effect;
  bump(tally.kinds, `${side}:${effect.kind}`);
  const who = actor.classId ?? actor.familyId ?? actor.archetype ?? "?";
  bump((tally.skills[`${side}:${who}`] ??= {}), option.id ?? "attack");
  const target = all.find((u) => u.id === pick.targetId);
  if (effect.kind === "damage" && best > 0 && target && target.side !== actor.side) {
    const e = Math.min(target.hp, marinaraExpectedHit(actor, target, effect, all, style === "tactical"));
    tally.damageChoice.picks++;
    tally.damageChoice.ratioSum += e / best;
    if (e < best * 0.6) tally.damageChoice.under60++;
    if (effect.damage !== "magic" && bestMagic > bestPhys * 1.5) tally.damageChoice.physOverMagic++;
  }
  if (effect.kind === "buff" && !effect.verses && !effect.doubles) {
    const covered = effect.target === "self" ? [actor] : friends;
    const source = option.skill?.id ?? "buff";
    const on = covered.every((u) => u.mods.some((m) => m.source === source && m.stat === effect.stat && m.turns > 0));
    if (on) {
      party ? tally.renew.party++ : tally.renew.foe++;
      bump(tally.renew.skills, `${side}:${option.id}`);
    }
  }
  if (effect.kind === "heal") {
    party ? tally.heals.party++ : tally.heals.foe++;
    const covered = effect.target === "self" ? [actor] : effect.target === "party" ? friends : target ? [target] : [];
    const idle = covered.every((u) => u.hp >= u.maxHp * 0.9 && !(effect.cleanse && marinaraDebuffBurden(u, all) > 0));
    if (idle) {
      party ? tally.idleHeal.party++ : tally.idleHeal.foe++;
      bump(tally.idleHeal.skills, `${side}:${option.id}`);
    }
  }
  if (effect.kind === "shield") {
    party ? tally.shields.party++ : tally.shields.foe++;
    if (target && target.shield > 0) party ? tally.idleShield.party++ : tally.idleShield.foe++;
  }
  void foes;
}

function playFight(level: number, n: number) {
  const seed = `${process.env.SEED ?? "audit"}:${level}:${n}`;
  const random = marinaraRandom(seed);
  const pool = MARINARA_CLASSES.filter(
    (def) => def.tier === tierAt(level) && (!process.env.PHYS || PHYS_TREES.has(def.archetype)),
  );
  const members = Array.from({ length: 4 }, () => pool[Math.floor(random() * pool.length)]!);
  const cards = members.map((def, i) => ({
    name: `M${i}`,
    shortDescription: def.label,
    marinara: buildCharacter(def, level, `${seed}:${i}:${def.id}`),
  }));
  const setting = SETTINGS[n % SETTINGS.length]!;
  const difficulty = DIFFS[n % DIFFS.length]!;
  const boss = Math.floor(n / DIFFS.length) % 2 === 1;
  const built = marinaraBuildEncounter({ setting, party: { level, size: 4 }, difficulty, random, boss });
  const enemies = built.foes.map((foe, i) => {
    const family = marinaraEnemyFamily(foe.familyId)!;
    return {
      id: `e${i}`,
      name: `${marinaraEnemyName(family, setting, foe.level) ?? foe.familyId} ${i}`,
      hp: 50,
      maxHp: 50,
      attack: 5,
      defense: 5,
      speed: 5,
      level: foe.level,
      skills: [],
      side: "enemy",
      ...(foe.tier === "boss" ? { boss: { points: 0 } } : {}),
      marinara: { family: { familyId: foe.familyId, tier: foe.tier, level: foe.level }, tier: foe.tier },
    };
  });
  const party = cards.map((c, i) => ({
    id: `p${i}`,
    name: c.name,
    side: "player",
    hp: 1,
    maxHp: 1,
    attack: 1,
    defense: 1,
    speed: 1,
    level: 1,
    skills: [],
  }));
  const start = marinaraFightStart({
    gameId: seed,
    cards,
    party: party as unknown as Combatant[],
    enemies: enemies as unknown as Combatant[],
    difficulty: "normal",
    storyFight: false,
    setting,
    encounter: difficulty,
  });
  for (const u of start.party) (u as { controller?: string }).controller = "manual";
  const s: CombatDirectorState = createCombatDirector({
    id: seed,
    anchor: "a",
    party: start.party,
    enemies: start.enemies,
    style,
    gm: false,
    difficulty: "normal",
    seed: Math.floor(random() * 2 ** 31),
    ...(style === "tactical" ? { battlefield: { size: start.enemies.length > 4 ? "medium" : "small" } as never } : {}),
    marinara: start.fighters,
  });
  delete (s as { morale?: unknown }).morale;
  const fighter = (id: string) => s.marinara!.fighters.find((f) => f.id === id)!;
  const temperOf = (id: string) =>
    ([...s.party, ...s.enemies].find((u) => u.id === id)?.tactics?.adjective as string | undefined) ?? "?";
  /** Runs a command; foe turns run inside the director, so they are audited from their declarations
   *  against the state just before the command. */
  const run = (fn: () => void) => {
    const before = structuredClone(s.marinara!.fighters);
    const seen = s.serial;
    fn();
    const lines = s.log.filter((l) => l.id > seen);
    lines.forEach((l, i) => {
      if (l.kind !== "declaration" || !l.actorId) return;
      const actor = before.find((f) => f.id === l.actorId);
      if (!actor || actor.side === "party") return;
      // As its turn starts: its mods and cooldowns tick down once.
      for (const m of actor.mods) m.turns--;
      actor.mods = actor.mods.filter((m) => m.turns > 0);
      for (const k of Object.keys(actor.cooldowns)) actor.cooldowns[k] = Math.max(0, actor.cooldowns[k]! - 1);
      const label = /begins (.+)\.$/.exec(l.text)?.[1];
      const next = lines.slice(i + 1).find((m) => m.actorId === l.actorId && m.kind !== "declaration");
      const option = label ? marinaraUsable(actor, before).find((o) => o.label === label) : undefined;
      const targetName = next
        ? / (?:hits|misses|heals|over|shields|uses .+? on) (.+?)(?: with| for|\.|$)/.exec(next.text)?.[1]
        : undefined;
      const target = before.find((f) => f.name === targetName);
      const live = s.marinara!.fighters;
      s.marinara!.fighters = before;
      audit(s, actor, temperOf(actor.id), {
        kind: label ? "skill" : next?.text.endsWith("defends.") ? "defend" : "attack",
        skillId: option ? (option.id ?? undefined) : label,
        targetId: target?.id ?? (option && option.effect.target === "self" ? actor.id : undefined),
      });
      s.marinara!.fighters = live;
    });
  };
  for (let step = 0; step < 8000 && !s.outcome && s.round <= 60; step++) {
    if (s.mercy) {
      run(() => commandCombatDirector(s, { type: "mercy", choice: "spare" } as never));
      continue;
    }
    if (s.tactical) {
      if (s.stage === "action" && s.actorId) {
        const unit = s.tactical.units.find((u) => u.id === s.actorId) as TacticalUnit;
        if (process.env.DEBUG_TDEF && unit.side === "party") {
          const near = Math.min(
            ...s.tactical.units
              .filter((o) => o.side !== unit.side && o.hp > 0)
              .map((o) => Math.abs(o.x - unit.x) + Math.abs(o.y - unit.y)),
          );
          const clone = structuredClone(s);
          const cu = clone.tactical!.units.find((u) => u.id === unit.id) as TacticalUnit;
          const board = decideTacticalAction(clone.tactical!, cu) as { type: string; to?: { x: number; y: number } };
          const at = (pos: { x: number; y: number }) => (id: string) => {
            const o = clone.tactical!.units.find((u) => u.id === id);
            return o ? Math.abs(o.x - pos.x) + Math.abs(o.y - pos.y) : Infinity;
          };
          const here = marinaraBoardAiAction(
            clone.marinara!,
            cu as never,
            clone.round,
            "normal",
            at(cu),
            cu.attackRange.max,
          );
          const there = board.to
            ? marinaraBoardAiAction(
                clone.marinara!,
                cu as never,
                clone.round,
                "normal",
                at(board.to),
                cu.attackRange.max,
              )
            : null;
          const final = marinaraBoardTurn(structuredClone(s), structuredClone(unit)) as { type: string };
          if (final.type === "defend" && near <= 3 && process.env.DEBUG_TDEF === "2") {
            const actorF = clone.marinara!.fighters.find((f) => f.id === unit.id)!;
            const dist = at(cu);
            let count = 0;
            const optsSeen: string[] = [];
            chooseMarinaraAction(
              actorF,
              clone.marinara!.fighters,
              { ...cu, tactics: cu.tactics! } as never,
              clone.round,
              "normal",
              {
                tactical: true,
                reach: (o, t) => {
                  count++;
                  optsSeen.push(`${o.id ?? "atk"}>${t.id}@${dist(t.id)}`);
                  return t.id === actorF.id || dist(t.id) <= 3;
                },
                ranked: (r) =>
                  console.log(
                    "  RANK",
                    r
                      .slice(0, 5)
                      .map((x) => `${JSON.stringify(x.candidate.action)}=${x.score.toFixed(2)}`)
                      .join(" | "),
                  ),
              },
            );
            console.log(
              "  FOES",
              clone
                .marinara!.fighters.filter((f) => f.side === "enemy")
                .map(
                  (f) =>
                    `${f.id}:hp${f.hp}/${f.maxHp}:${f.row}:${(f as any).yielded ? "Y" : ""}${(f as any).hidden ? "H" : ""}:${(f.statuses ?? []).map((x: any) => x.id ?? x.kind ?? x).join("+")}`,
                )
                .join(" "),
              "| TU",
              clone
                .tactical!.units.filter((u) => u.side !== unit.side)
                .map((u) => `${u.id}:hp${u.hp}@${u.x},${u.y}`)
                .join(" "),
            );
            console.log(
              "  REACH",
              count,
              optsSeen.slice(0, 12).join(" "),
              "ids",
              clone.tactical!.units.map((u) => u.id).join(","),
              "fighters",
              clone.marinara!.fighters.map((f) => f.id).join(","),
            );
          }
          if (final.type === "defend" && near <= 3)
            console.log(
              `TDEF r${s.round} ${fighter(unit.id)?.classId} near=${near} range=${unit.attackRange.max} mv=${unit.movement} board=${board.type}${board.to ? `->(${board.to.x},${board.to.y}) from (${unit.x},${unit.y})` : ""} here=${JSON.stringify(here)} there=${JSON.stringify(there)} mp=${fighter(unit.id)?.mp}`,
            );
        }
        const action = marinaraBoardTurn(s, unit) as {
          type: string;
          skillName?: string;
          targetId?: string;
        };
        if (unit.side === "party") {
          approach.set("partyTurns", (approach.get("partyTurns") ?? 0) + 1);
          if (action.type === "wait") {
            const foesNow = s.tactical.units.filter((o) => o.side !== unit.side && o.hp > 0);
            const gap = (x: number, y: number) =>
              Math.min(...foesNow.map((o) => Math.abs(o.x - x) + Math.abs(o.y - y)));
            const to = (action as { to?: { x: number; y: number } }).to ?? { x: unit.x, y: unit.y };
            const before = gap(unit.x, unit.y);
            const after = gap(to.x, to.y);
            const legal = foesNow.some(
              (o) =>
                !validateTacticalUnitAction(s.tactical!, unit, { type: "attack", unitId: unit.id, targetId: o.id }) ||
                (unit.skills ?? []).some(
                  (k) =>
                    !validateTacticalUnitAction(s.tactical!, unit, {
                      type: "skill",
                      unitId: unit.id,
                      skillName: k.name,
                      targetId: o.id,
                    }),
                ),
            );
            // Steps by the board's own paths (round walls and other units) to stand beside a foe.
            const steps = new Map<string, number>();
            const queue = foesNow.map((o) => ({ x: o.x, y: o.y }));
            for (const o of queue) steps.set(`${o.x},${o.y}`, 0);
            for (let i = 0; i < queue.length; i++) {
              const at = queue[i]!;
              for (const [dx, dy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ] as const) {
                const next = { x: at.x + dx, y: at.y + dy };
                const k = `${next.x},${next.y}`;
                if (steps.has(k)) continue;
                if (!(next.x === unit.x && next.y === unit.y) && !canTraverseTile(s.tactical!, unit, next)) continue;
                steps.set(k, steps.get(`${at.x},${at.y}`)! + 1);
                queue.push(next);
              }
            }
            const pathBefore = steps.get(`${unit.x},${unit.y}`) ?? 1000 + before;
            const pathAfter = steps.get(`${to.x},${to.y}`) ?? 1000 + after;
            const key = `wait:${after < before ? "closer" : after === before ? "same" : "away"}${legal ? ":legal-from-here" : ""}`;
            const pathKey = `path:${pathAfter < pathBefore ? "closer" : pathAfter === pathBefore ? (to.x === unit.x && to.y === unit.y ? "stays" : "same") : "away"}`;
            approach.set(pathKey, (approach.get(pathKey) ?? 0) + 1);
            if (process.env.DEBUG_STAYS && pathKey === "path:stays" && (approach.get(pathKey) ?? 0) <= 12)
              console.log(
                `STAY r${s.round} ${unit.id} @${unit.x},${unit.y} mv${unit.movement} rng${unit.attackRange.max} path${pathBefore} board ${s.tactical.width}x${s.tactical.height} units ${s.tactical.units
                  .filter((o) => o.hp > 0)
                  .map((o) => `${o.side[0]}${o.id}@${o.x},${o.y}`)
                  .join(
                    " ",
                  )} blocked ${JSON.stringify((s.tactical as { terrain?: unknown }).terrain ?? "").slice(0, 0)}`,
              );
            approach.set(key, (approach.get(key) ?? 0) + 1);
          }
        }
        const actor = fighter(unit.id);
        if (actor && action.type === "defend") {
          const near = Math.min(
            ...s.tactical.units
              .filter((o) => o.side !== unit.side && o.hp > 0)
              .map((o) => Math.abs(o.x - unit.x) + Math.abs(o.y - unit.y)),
          );
          if (near <= unit.movement + Math.max(1, unit.attackRange.max)) tally.defend.inReach++;
          if (actor.commanded)
            bump(
              tally.reviveChance,
              `commandedDefend:${near <= unit.movement + Math.max(1, unit.attackRange.max) ? "inReach" : "far"}:${unit.hasMoved ? "moved" : "fresh"}`,
            );
        }
        if (actor) {
          const skill = action.skillName ? actor.skills.find((k) => k.label === action.skillName) : undefined;
          const enemySkill = action.skillName
            ? (actor.enemySkills ?? []).find((id) => id === action.skillName || `enemy:${id}` === action.skillName)
            : undefined;
          audit(s, actor, temperOf(unit.id), {
            kind:
              action.type === "defend"
                ? "defend"
                : action.type === "attack"
                  ? "attack"
                  : action.type === "skill"
                    ? "skill"
                    : "other",
            skillId: skill?.id ?? (enemySkill ? `enemy:${enemySkill}` : action.skillName),
            targetId: action.targetId,
          });
        }
        run(() => commandCombatDirector(s, { type: "tactical", action: action as never }, "ai"));
      } else if (s.window) run(() => commandCombatDirector(s, { type: "fallback" }, "fallback"));
      else if (s.stage === "select") {
        const next = s.tactical.units.find((u) => u.side === "party" && u.hp > 0 && !u.hasActed);
        run(() => commandCombatDirector(s, next ? { type: "begin", unitId: next.id } : { type: "continue" }));
      } else run(() => commandCombatDirector(s, { type: "continue" }));
      continue;
    }
    if (s.stage === "action" && s.actorId) {
      const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
      // The AI's reasons for every pick, as the director logs them with Debug on (Alyssa 2026-11-03: the
      // reasons log is on for every playtest and fight run).
      const action = marinaraAiAction(s.marinara!, unit, s.round, "normal", false, undefined, (ranking) => {
        const text = marinaraPickReasons(s.marinara!, unit.id, ranking);
        if (text) s.log.push({ kind: "marinara:reasoning", text, actorId: unit.id } as never);
      });
      const actor = fighter(unit.id);
      if (actor)
        audit(s, actor, temperOf(unit.id), {
          kind: action.type === "defend" ? "defend" : action.type === "attack" ? "attack" : "skill",
          skillId: action.type === "skill" ? action.skillId : undefined,
          targetId: "targetId" in action ? (action.targetId as string) : undefined,
        });
      run(() => commandCombatDirector(s, { type: "classic", action }, "ai"));
    } else if (s.window) run(() => commandCombatDirector(s, { type: "fallback" }, "fallback"));
    else run(() => commandCombatDirector(s, { type: "continue" }));
  }
  if (process.env.DEBUG && n === 1) for (const l of s.log.slice(0, 60)) console.log(l.actorId, l.kind, l.text);
  keepFightReasons("ai-audit", `${style}:L${level}:${n}`, s);
  tally.reasonLines = (tally.reasonLines ?? 0) + (s.marinara?.aiReasons?.length ?? 0);
  if (REASONS_DIR) {
    mkdirSync(REASONS_DIR, { recursive: true });
    writeFileSync(
      `${REASONS_DIR}/${style}-L${level}-${n}.log`,
      s.log.map((l) => `${l.kind ?? ""} | ${l.text}`).join("\n") + "\n",
    );
  }
  tally.fights++;
  tally.rounds += s.round;
  if (s.outcome === "victory") tally.wins++;
  else if (!s.outcome || s.round > 60) {
    tally.stalls++;
    const fs = s.marinara!.fighters;
    const alive = fs.filter((f) => f.side === "party" && f.hp > 0);
    const magicNow = alive.filter((f) =>
      marinaraUsable(f, fs).some((o) => o.effect.kind === "damage" && o.effect.damage === "magic"),
    );
    const foesLeft = fs.filter((f) => f.side !== "party" && f.hp > 0);
    const board = s.tactical
      ? ` | yielded ${fs
          .filter((f) => f.yielded)
          .map((f) => `${f.id}${s.morale?.[f.id]?.yielded ? "(morale)" : "(not in morale)"}`)
          .join(",")}` +
        ` | board ${s.tactical.units
          .filter((u) => u.hp > 0)
          .map((u) => `${u.id}@${u.x},${u.y}`)
          .join(" ")} ${s.tactical.width}x${s.tactical.height}`
      : "";
    tally.stallNotes.push(
      board +
        ` L${level} ${s.outcome ?? "none"} r${s.round}: party ${alive.map((f) => `${f.classId}(${f.hp}/${f.maxHp} mp${f.mp})`).join(" ")} | magic now ${magicNow.length} | foes ${foesLeft.map((f) => `${f.familyId ?? f.archetype}:${f.tier}(${f.hp}/${f.maxHp})`).join(" ")}`,
    );
  }
}

for (const level of LEVELS) for (let n = 0; n < count; n++) playFight(level, n);

const pct = (a: number, b: number) => `${((a / Math.max(1, b)) * 100).toFixed(1)}%`;
const top = (rec: Record<string, number>, k = 12) =>
  Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key, v]) => `${key} ${v}`)
    .join(", ");
console.log(`style ${style}, levels ${LEVELS.join("/")}, ${tally.fights} fights`);
console.log(
  `wins ${pct(tally.wins, tally.fights)}, stalls ${pct(tally.stalls, tally.fights)}, rounds ${(tally.rounds / tally.fights).toFixed(1)}`,
);
console.log(`turns: party ${tally.partyTurns}, foes ${tally.foeTurns}`);
console.log(`approach: ${[...approach].map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(
  `renew active buff: party ${tally.renew.party} (${pct(tally.renew.party, tally.partyTurns)} of turns), foes ${tally.renew.foe} (${pct(tally.renew.foe, tally.foeTurns)})  [${top(tally.renew.skills)}]`,
);
console.log(
  `heal with nobody hurt: party ${tally.idleHeal.party}/${tally.heals.party} heals, foes ${tally.idleHeal.foe}/${tally.heals.foe}  [${top(tally.idleHeal.skills)}]`,
);
console.log(
  `shield on shielded: party ${tally.idleShield.party}/${tally.shields.party}, foes ${tally.idleShield.foe}/${tally.shields.foe}`,
);
console.log(
  `defend: party ${tally.defend.party} (${pct(tally.defend.party, tally.partyTurns)}), foes ${tally.defend.foe} (${pct(tally.defend.foe, tally.foeTurns)}); with damage on the table ${tally.defend.withDamage}${style === "tactical" ? `, Tactical with a foe in move+reach ${tally.defend.inReach}` : ""}`,
);
console.log(
  `  defend by temperament: ${Object.entries(tally.defend.byTemper)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}/${tally.turnsByTemper[k]} (${pct(v, tally.turnsByTemper[k] ?? 0)})`)
    .join(", ")}`,
);
console.log(
  `damage picks: ${tally.damageChoice.picks}, mean share of best ${((tally.damageChoice.ratioSum / Math.max(1, tally.damageChoice.picks)) * 100).toFixed(0)}%, under 60% of best ${pct(tally.damageChoice.under60, tally.damageChoice.picks)}, physical while magic was 1.5x+ ${tally.damageChoice.physOverMagic}`,
);
console.log(`action kinds: ${top(tally.kinds, 30)}`);
console.log(`AI reasons kept: ${tally.reasonLines} picks`);
console.log("revive chances + commanded actions:", JSON.stringify(tally.reviveChance));
console.log("party skills, picked / turns usable:");
console.log(
  Object.entries(tally.avail)
    .filter(([, v]) => v >= 20)
    .map(([k, v]) => [k, (tally.picked[k] ?? 0) / v, v] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([k, r, v]) => `  ${k} ${(r * 100).toFixed(1)}% of ${v}`)
    .join("\n"),
);
console.log("stalls:");
for (const n of tally.stallNotes) console.log("  " + n);
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(tally, null, 1));
