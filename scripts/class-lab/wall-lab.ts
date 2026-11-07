/**
 * Wall lab (thread "Review Classic AI action weighing", 2026-11-02): how hard each bestiary family is to
 * hurt, per class. Every class of the level's tier against one standard foe of every family at that
 * level, as the Engine builds them at a fight's start: the best expected damage one action does (any
 * option the class has, basic attack included), as a share of the foe's HP, so "turns to kill".
 * Also with Harden on (+40% Defense) for the families that have it.
 *
 *   tsx scripts/class-lab/wall-lab.ts            (LEVELS=6,16,26, TIER=standard)
 */
import { marinaraFightStart } from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";
import {
  MARINARA_BESTIARY as MARINARA_BESTIARY_FAMILIES,
  marinaraEnemyAbilities,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import {
  MARINARA_TUNING,
  marinaraEffectiveStat,
  marinaraExpectedHit,
  marinaraTargetsFor,
  marinaraUsable,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import type { Combatant } from "../../packages/shared/src/index.js";
import { buildCharacter } from "./class-lab.js";

// FLOOR=0.25: the share of a hit's attack and power it always deals (MARINARA_TUNING.minDamagePct).
if (process.env.FLOOR) MARINARA_TUNING.minDamagePct = Number(process.env.FLOOR);
const LEVELS = (process.env.LEVELS ?? "6,16,26").split(",").map(Number);
const TIER = (process.env.TIER ?? "standard") as "standard" | "elite" | "boss";
const tierAt = (level: number) => (level < 10 ? "base" : level < 20 ? "advanced" : "master");

function fighters(level: number, classIds: string[], familyId: string, setting: string): MarinaraFighter[] {
  const cards = classIds.map((id, i) => ({
    name: `M${i}`,
    shortDescription: id,
    marinara: buildCharacter(
      MARINARA_CLASSES.find((d) => d.id === id)!,
      level,
      `wall:${level}:${i}:${id}`,
    ),
  }));
  const start = marinaraFightStart({
    gameId: `wall:${level}:${familyId}`,
    cards,
    party: cards.map((c, i) => ({
      id: `p${i}`,
      name: c.name,
      side: "player",
      hp: 1,
      maxHp: 1,
    })) as unknown as Combatant[],
    enemies: [
      {
        id: "e0",
        name: "foe",
        hp: 50,
        maxHp: 50,
        level,
        side: "enemy",
        ...(TIER === "boss" ? { boss: { points: 0 } } : {}),
        marinara: { family: { familyId, tier: TIER, level }, tier: TIER },
      },
    ] as unknown as Combatant[],
    difficulty: "normal",
    storyFight: false,
    encounter: "normal",
    setting: setting as never,
  });
  return start.fighters;
}

interface Best {
  phys: number;
  magic: number;
  basic: number;
}
function best(actor: MarinaraFighter, foe: MarinaraFighter, all: MarinaraFighter[]): Best {
  const out = { phys: 0, magic: 0, basic: 0 };
  for (const o of marinaraUsable(actor, all)) {
    if (o.effect.kind !== "damage" || o.effect.charge) continue;
    if (!marinaraTargetsFor(actor, o.effect, all).includes(foe)) continue;
    const e = marinaraExpectedHit(actor, foe, o.effect, all, false) / foe.maxHp;
    if (o.id === null) out.basic = e;
    if (o.effect.damage === "magic") out.magic = Math.max(out.magic, e);
    else out.phys = Math.max(out.phys, e);
  }
  return out;
}

for (const level of LEVELS) {
  const classes = MARINARA_CLASSES.filter((d) => d.tier === tierAt(level));
  const families = MARINARA_BESTIARY_FAMILIES.filter(
    (f) => level >= f.levels[0] && level <= f.levels[1] && f.tiers.includes(TIER),
  );
  // Per family: turns to kill for the median class, physical-best classes and magic-best classes.
  const rows: Array<{
    id: string;
    all: number;
    phys: number;
    magic: number;
    harden?: number;
    hp: number;
    def: number;
    res: number;
  }> = [];
  const perClass: Record<string, number[]> = {};
  const wallIds = new Set(["warder", "clay-spirit", "gel", "shieldbearer"]);
  const perClassWall: Record<string, number[]> = {};
  for (const fam of families) {
    // One class at a time, so no party-wide passives of the others count.
    const fights = classes.map((c) => fighters(level, [c.id], fam.id, Object.keys(fam.names)[0]!));
    if (fights.some((all) => !all.some((f) => f.side === "enemy"))) continue;
    const foe = fights[0]!.find((f) => f.side === "enemy")!;
    for (const all of fights) all.find((f) => f.side === "enemy")!.row = "front";
    const party = fights.map((all) => all.find((f) => f.side === "party")!);
    const foeIn = (i: number) => fights[i]!.find((f) => f.side === "enemy")!;
    const shares = party.map((p, i) => {
      const b = best(p, foeIn(i), fights[i]!);
      return { p, b, top: Math.max(b.phys, b.magic) };
    });
    const ttk = (x: number) => (x > 0 ? 1 / x : 999);
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)] ?? 999;
    };
    const physClasses = shares.filter((s) => s.b.phys >= s.b.magic);
    const magicClasses = shares.filter((s) => s.b.magic > s.b.phys);
    let harden: number | undefined;
    if (marinaraEnemyAbilities(fam, TIER, level).includes("harden")) {
      harden = median(
        party.map((p, i) => {
          const f = foeIn(i);
          f.mods.push({ stat: "defense", pct: 0.4, turns: 2, source: "probe" });
          const b = best(p, f, fights[i]!);
          f.mods = f.mods.filter((m) => m.source !== "probe");
          return ttk(Math.max(b.phys, b.magic));
        }),
      );
    }
    rows.push({
      id: fam.id,
      all: median(shares.map((s) => ttk(s.top))),
      phys: median(physClasses.map((s) => ttk(s.top))),
      magic: median(magicClasses.map((s) => ttk(s.top))),
      harden,
      hp: foe.maxHp,
      def: Math.round(marinaraEffectiveStat(foe, "defense", fights[0]!)),
      res: Math.round(marinaraEffectiveStat(foe, "resistance", fights[0]!)),
    });
    for (const s of shares) {
      (perClass[s.p.classId ?? "?"] ??= []).push(ttk(s.top));
      if (wallIds.has(fam.id)) (perClassWall[s.p.classId ?? "?"] ??= []).push(ttk(s.top));
    }
  }
  rows.sort((a, b) => b.all - a.all);
  console.log(`\n## L${level} ${TIER}: turns for one fighter to kill one foe alone (median class)`);
  console.log("family            hp   def res | all   phys  magic | harden");
  for (const r of rows)
    console.log(
      `${r.id.padEnd(16)} ${String(r.hp).padStart(4)} ${String(r.def).padStart(4)} ${String(r.res).padStart(3)} | ${r.all.toFixed(1).padStart(5)} ${r.phys.toFixed(1).padStart(5)} ${r.magic.toFixed(1).padStart(6)} | ${r.harden?.toFixed(1) ?? ""}`,
    );
  console.log(`\n### L${level}: per class, median turns to kill: all families / the four walls`);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 999;
  for (const [id, xs] of Object.entries(perClass).sort((a, b) => med(a[1]) - med(b[1])))
    console.log(
      `${id.padEnd(18)} ${med(xs).toFixed(1).padStart(5)} / ${med(perClassWall[id] ?? [])
        .toFixed(1)
        .padStart(5)}`,
    );
}
