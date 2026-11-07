/**
 * Slot balance (thread "Balance Classic classes from panel findings", 2026-11-01): what one class adds to
 * a party in real Engine fights. A frame party (Guard line front, Blade line front, Mender line back)
 * plus one slot that rotates through every class, grown along its line with the class lab's carries;
 * bestiary encounters built for the party's level and played by the Engine's own AI on both sides
 * through the combat director. Morale is off (foes fight to the end), so a win is a real win.
 *
 *   tsx scripts/class-lab/slot-balance.ts [fights] [classIds,...]
 *
 * Env: LEVELS=16,26 (else each tier's levels), DIFF=hard,deadly, BOSS=0|1|mix, FRAME=std|noheal,
 * SKILLS=1 (per-skill casts, damage, healing), STYLE=classic|tactical, JSON=out.json.
 */
import { keepFightReasons } from "./reasons-log.js";
import { writeFileSync } from "node:fs";
import {
  commandCombatDirector,
  createCombatDirector,
  marinaraBoardTurn,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import { marinaraAiAction } from "../../packages/server/src/services/game/marinara-director.service.js";
import { marinaraFightStart } from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import {
  MARINARA_CLASSES,
  marinaraClass,
  marinaraRandom,
  setMarinaraCarried,
  MARINARA_CARRY_SLOTS,
  type MarinaraClassDef,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  MARINARA_BESTIARY_SETTINGS,
  marinaraBuildEncounter,
  marinaraEnemyFamily,
  marinaraEnemyName,
  type MarinaraEncounterDifficulty,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import type { TacticalUnit } from "../../packages/shared/src/features/tactical-combat/types.js";
import type { Combatant } from "../../packages/shared/src/index.js";
import { buildCharacter } from "./class-lab.js";

const count = Number(process.argv[2] ?? 24);
const only = process.argv[3]?.split(",").filter(Boolean);
const DIFFS = (process.env.DIFF ?? "hard,deadly").split(",") as MarinaraEncounterDifficulty[];
const style = (process.env.STYLE ?? "classic") as "classic" | "tactical";
const SETTINGS = MARINARA_BESTIARY_SETTINGS.filter((s) => s !== "modern_day");

const levelsFor = (def: MarinaraClassDef) =>
  process.env.LEVELS
    ? process.env.LEVELS.split(",")
        .map(Number)
        .filter((l) => tierAt(l) === def.tier)
    : def.tier === "base"
      ? [6]
      : def.tier === "advanced"
        ? [16]
        : [25, 30];
const tierAt = (level: number) => (level < 10 ? "base" : level < 20 ? "advanced" : "master");

/** The frame's class of a line at a level. */
const LINES: Record<string, string[]> = {
  guard: ["guard", "sentinel", "stonewall"],
  blade: ["blade", "bloodsworn", "cleaver"],
  mender: ["mender", "cleric", "saint"],
  channeler: ["channeler", "elementalist", "stormcaller"],
  marksman: ["marksman", "sharpshooter", "farshot"],
  aegis: ["guard", "aegis", "bulwark"],
  shade: ["scout", "shade", "shroud"],
};
const lineAt = (line: string, level: number) => LINES[line]![level < 10 ? 0 : level < 20 ? 1 : 2]!;
const FRAMES: Record<string, string[]> = {
  std: ["guard", "blade", "mender"],
  noheal: ["guard", "blade", "marksman"],
};

interface SkillTally {
  casts: number;
  damage: number;
  heal: number;
}
interface Row {
  classId: string;
  level: number;
  fights: number;
  wins: number;
  rounds: number;
  hpLeft: number;
  slotDamage: number;
  partyDamage: number;
  slotHeal: number;
  partyHeal: number;
  slotDown: number;
  foeHeal: number;
  skills: Record<string, SkillTally>;
}

const SKILLS = process.env.SKILLS === "1";

function playFight(slot: MarinaraClassDef, level: number, n: number, row: Row) {
  const frame = FRAMES[process.env.FRAME ?? "std"] ?? process.env.FRAME!.split(",");
  const seed = `slot:${level}:${n}`;
  const random = marinaraRandom(seed);
  const members = [...frame.map((line) => marinaraClass(lineAt(line, level))!), slot];
  const cards = members.map((def, i) => {
    let p = buildCharacter(def, level, `${seed}:${i}:${def.id}`);
    // SLOT_TRAIN=guard:5 trains the slot in another class too; SLOT_CARRY=id,id puts those first.
    if (i === frame.length && process.env.SLOT_TRAIN) {
      const levels = { ...p.classLevels };
      for (const part of process.env.SLOT_TRAIN.split(",")) {
        const [id, lvl] = part.split(":");
        levels[id!] = Math.max(levels[id!] ?? 0, Number(lvl));
      }
      p = { ...p, classLevels: levels };
    }
    if (i === frame.length && process.env.SLOT_CARRY) {
      const want = process.env.SLOT_CARRY.split(",");
      p = setMarinaraCarried(
        p,
        [...want, ...p.carried.filter((id) => !want.includes(id))].slice(0, MARINARA_CARRY_SLOTS),
      );
    }
    return { name: `M${i}`, shortDescription: def.label, marinara: p };
  });
  const setting = SETTINGS[n % SETTINGS.length]!;
  const difficulty = DIFFS[n % DIFFS.length]!;
  const bossMode = process.env.BOSS ?? "mix";
  const boss = bossMode === "1" || (bossMode === "mix" && Math.floor(n / DIFFS.length) % 2 === 1);
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
  // Every party turn comes to this harness (the director would hand companions to its own AI).
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
  // Foes fight to the end: the panel's surrenders ended fights early and counted as wins.
  if (process.env.MORALE !== "1") delete (s as { morale?: unknown }).morale;
  const slotId = "p3";
  const fighters = () => s.marinara!.fighters;
  const nameOf = new Map(fighters().map((f) => [f.name, f]));
  let seen = 0;
  const tallyLog = (skillOf: (actorId: string) => string | undefined) => {
    let previous = "";
    for (const l of s.log) {
      if (l.id <= seen) continue;
      seen = l.id;
      if (!l.kind.startsWith("marinara:")) continue;
      const kind = l.kind.slice(9);
      const reaction = previous === `${l.actorId}:counter` || previous === `${l.actorId}:ward`;
      previous = `${l.actorId}:${kind}`;
      const actor = fighters().find((f) => f.id === l.actorId);
      if (!actor) continue;
      const amount = Number(
        / for (\d+)/.exec(l.text)?.[1] ??
          /(?:heals|regenerates) (\d+)/.exec(l.text)?.[1] ??
          /takes (\d+)/.exec(l.text)?.[1] ??
          0,
      );
      if (kind === "hit" || kind === "rider") {
        const target = /hits (.+?)(?: with | for )/.exec(l.text)?.[1] ?? /burns (.+?) for/.exec(l.text)?.[1];
        const tf = target ? nameOf.get(target) : undefined;
        if (!tf || tf.side === actor.side) continue;
        if (actor.side === "party") {
          row.partyDamage += amount;
          if (actor.id === slotId) {
            row.slotDamage += amount;
            const sk =
              /with (.+?) for/.exec(l.text)?.[1] ??
              (kind === "rider" ? "rider" : reaction ? "(counter)" : (skillOf(actor.id) ?? "(counter)"));
            const t = (row.skills[sk] ??= { casts: 0, damage: 0, heal: 0 });
            t.damage += amount;
          }
        }
      } else if (kind === "tick" && actor.side !== "party") {
        // Damage over time on a foe: the caster who put it there.
        const status = /from (\w+)/.exec(l.text)?.[1];
        const by = actor.statuses.find((x) => x.status === status)?.by ?? lastBy.get(`${actor.id}:${status}`);
        const caster = fighters().find((f) => f.id === by);
        if (caster?.side === "party") {
          row.partyDamage += amount;
          if (caster.id === slotId) {
            row.slotDamage += amount;
            const t = (row.skills[`(${status} ticks)`] ??= { casts: 0, damage: 0, heal: 0 });
            t.damage += amount;
          }
        }
      } else if (kind === "heal" || kind === "revive") {
        if (actor.side === "party") {
          row.partyHeal += amount;
          if (actor.id === slotId) {
            row.slotHeal += amount;
            const sk =
              /with (.+?) for/.exec(l.text)?.[1] ??
              (/regenerates/.test(l.text) ? "(regen)" : kind === "revive" ? "Revive" : "(drain/other heal)");
            const t = (row.skills[sk] ??= { casts: 0, damage: 0, heal: 0 });
            t.heal += amount;
          }
        } else row.foeHeal += amount;
      }
    }
  };
  const lastBy = new Map<string, string>();
  const remember = () => {
    for (const f of fighters()) for (const st of f.statuses) if (st.by) lastBy.set(`${f.id}:${st.status}`, st.by);
  };
  for (let step = 0; step < 8000 && !s.outcome && s.round <= 60; step++) {
    remember();
    if (s.tactical) {
      if (s.stage === "action" && s.actorId) {
        const unit = s.tactical.units.find((u) => u.id === s.actorId) as TacticalUnit;
        commandCombatDirector(s, { type: "tactical", action: marinaraBoardTurn(s, unit) as never });
      } else if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
      else if (s.stage === "select") {
        const next = s.tactical.units.find((u) => u.side === "party" && u.hp > 0 && !u.hasActed);
        commandCombatDirector(s, next ? { type: "begin", unitId: next.id } : { type: "continue" });
      } else commandCombatDirector(s, { type: "continue" });
      tallyLog(() => undefined);
      continue;
    }
    if (s.stage === "action" && s.actorId) {
      const unit = [...s.party, ...s.enemies].find((u) => u.id === s.actorId)!;
      const action = marinaraAiAction(s.marinara!, unit, s.round, "normal", false);
      const label =
        action.type === "skill"
          ? (fighters()
              .find((f) => f.id === unit.id)
              ?.skills.find((k) => k.id === action.skillId)?.label ?? action.skillId)
          : action.type === "attack"
            ? "Attack"
            : action.type;
      if (unit.id === slotId) (row.skills[label] ??= { casts: 0, damage: 0, heal: 0 }).casts++;
      commandCombatDirector(s, { type: "classic", action });
      tallyLog((id) => (id === unit.id ? label : undefined));
    } else {
      if (s.window) commandCombatDirector(s, { type: "fallback" }, "fallback");
      else commandCombatDirector(s, { type: "continue" });
      tallyLog(() => undefined);
    }
  }
  keepFightReasons("slot-balance", `${slot.id}:L${level}:${row}:${n}`, s);
  if (process.env.DEBUG && n === 0) for (const l of s.log.slice(0, 80)) console.log(l.actorId, l.kind, l.text);
  row.fights++;
  row.rounds += s.round;
  if (s.outcome === "victory") {
    row.wins++;
    const max = s.party.reduce((a, u) => a + u.maxHp, 0);
    row.hpLeft += s.party.reduce((a, u) => a + Math.max(0, u.hp), 0) / max;
  }
  if ((s.party.find((u) => u.id === slotId)?.hp ?? 1) <= 0) row.slotDown++;
}

const rows: Row[] = [];
for (const def of MARINARA_CLASSES) {
  if (only && !only.includes(def.id)) continue;
  for (const level of levelsFor(def)) {
    const row: Row = {
      classId: def.id,
      level,
      fights: 0,
      wins: 0,
      rounds: 0,
      hpLeft: 0,
      slotDamage: 0,
      partyDamage: 0,
      slotHeal: 0,
      partyHeal: 0,
      slotDown: 0,
      foeHeal: 0,
      skills: {},
    };
    for (let n = 0; n < count; n++) playFight(def, level, n, row);
    rows.push(row);
    const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
    // Value: wins, and how much of the party was left standing in them.
    const value = (row.wins + row.hpLeft) / (2 * row.fights);
    console.log(
      [
        def.label.padEnd(16),
        `L${level}`.padEnd(4),
        `win ${pct(row.wins, row.fights)}`.padEnd(9),
        `value ${(value * 100).toFixed(0)}`.padEnd(9),
        `rnd ${(row.rounds / row.fights).toFixed(1)}`.padEnd(9),
        `dmg ${pct(row.slotDamage, row.partyDamage)}`.padEnd(9),
        `heal ${pct(row.slotHeal, row.partyHeal)}`.padEnd(10),
        `down ${pct(row.slotDown, row.fights)}`,
      ].join(" "),
    );
    if (SKILLS) {
      const casts = Object.values(row.skills).reduce((a, t) => a + t.casts, 0);
      for (const [k, t] of Object.entries(row.skills).sort(
        (a, b) => b[1].damage + b[1].heal - (a[1].damage + a[1].heal),
      ))
        console.log(
          `    ${k.padEnd(22)} ${t.casts ? `${pct(t.casts, casts)} of turns`.padEnd(14) : "".padEnd(14)} dmg ${String(Math.round(t.damage / row.fights)).padStart(5)}/fight${t.casts && t.damage ? ` (${Math.round(t.damage / t.casts)}/cast)` : ""}  heal ${Math.round(t.heal / row.fights)}/fight`,
        );
    }
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows));
