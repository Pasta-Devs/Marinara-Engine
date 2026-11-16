/**
 * Bestiary lab: measures what each foe family is worth in an encounter budget (Alyssa 2026-10-31:
 * balanced encounters, as the SRD's CR does), in fights the combat director plays with the Engine's
 * own combat AI on both sides, against reference parties of four grown with real level-ups and
 * wearing standard gear.
 *
 *   tsx scripts/class-lab/bestiary-lab.ts measure <out.json> [fightsPerParty]   (FAMILIES=a,b to limit)
 *   tsx scripts/class-lab/bestiary-lab.ts table <out.ts> <in.json> [more.json ...]
 *
 * Measure: for each family, tier and sample level, a group of copies (four minions, three standard,
 * two elite, one boss) fights each reference party; their HP is scaled until the party loses 35% of
 * its HP on average (the Normal mark). A group that needs its HP scaled by h to get there is worth
 * 4 / (copies × √h) party members each: worth goes as the square root of HP times damage
 * (Lanchester's square law), so h in HP is √h in worth. Resumable: combos in the JSON are kept.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  MARINARA_BESTIARY,
  MARINARA_TIER_RULES,
  marinaraEnemyName,
  marinaraEnemySpec,
  type MarinaraBestiarySetting,
  type MarinaraEnemyFamily,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import type { MarinaraEnemyTier, MarinaraFighter } from "../../packages/shared/src/features/marinara-combat.js";
import { enemyFighter, playFight, referenceParty, REFERENCE_PARTIES, seedOf } from "./bestiary-units.js";

export const SAMPLE_LEVELS = [1, 4, 8, 12, 16, 20, 24, 28, 30] as const;
export const NORMAL_HP_LOST = 0.35;
const COPIES: Record<MarinaraEnemyTier, number> = { minion: 4, standard: 3, elite: 2, boss: 1 };

export function settingOf(family: MarinaraEnemyFamily, level: number): MarinaraBestiarySetting | null {
  for (const setting of Object.keys(family.names) as MarinaraBestiarySetting[])
    if (marinaraEnemyName(family, setting, level)) return setting;
  return null;
}

export function foes(
  family: MarinaraEnemyFamily,
  tier: MarinaraEnemyTier,
  level: number,
  count: number,
  hpScale = 1,
  damageScale = 1,
): MarinaraFighter[] {
  const setting = settingOf(family, level)!;
  return Array.from({ length: count }, (_, j) => {
    const unit = enemyFighter(marinaraEnemySpec({ familyId: family.id, setting, level, tier, id: `e${j}` }));
    unit.maxHp = unit.hp = Math.max(1, Math.round(unit.maxHp * hpScale));
    // A lasting damage modifier (the same one war cries use) scales everything the foe deals.
    if (damageScale !== 1) unit.mods.push({ stat: "damage", pct: damageScale - 1, turns: 99999, source: "lab-scale" });
    return unit;
  });
}

/** Mean party HP lost (all of it on a loss) and win rate over the reference parties. */
export function outcome(
  make: () => MarinaraFighter[],
  level: number,
  fightsPerParty: number,
  key: string,
): { lost: number; wins: number } {
  let lost = 0;
  let wins = 0;
  let total = 0;
  for (const name of Object.keys(REFERENCE_PARTIES))
    for (let i = 0; i < fightsPerParty; i++) {
      const fight = playFight(
        referenceParty(name, level, `${i}`),
        make(),
        seedOf(`bl:${key}:${name}:${i}`),
        `${key} L${level} ${name}`,
      );
      lost += fight.lost;
      if (fight.victory) wins++;
      total++;
    }
  return { lost: lost / total, wins: wins / total };
}

/** The HP scale that puts a group at the Normal mark (log-space bisection, common seeds). */
export function normalScale(
  make: (hp: number) => MarinaraFighter[],
  level: number,
  fights: number,
  key: string,
  steps = 9,
) {
  let lo = Math.log(0.15);
  let hi = Math.log(6);
  for (let step = 0; step < steps; step++) {
    const mid = (lo + hi) / 2;
    const { lost } = outcome(() => make(Math.exp(mid)), level, fights, key);
    if (lost < NORMAL_HP_LOST) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

export type ThreatTable = Record<string, Record<string, Record<string, number>>>;

function measure(out: string, fights: number) {
  const table: ThreatTable = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const only = process.env.FAMILIES?.split(",");
  for (const family of MARINARA_BESTIARY) {
    if (only && !only.includes(family.id)) continue;
    if (family.role === "treasure") continue; // priced by MARINARA_TREASURE_THREAT, not measured
    for (const tier of family.tiers)
      for (const level of SAMPLE_LEVELS) {
        if (level < family.levels[0] || level > family.levels[1] || level < MARINARA_TIER_RULES[tier].minLevel)
          continue;
        if (!settingOf(family, level)) continue;
        if (table[family.id]?.[tier]?.[level] !== undefined) continue;
        const copies = COPIES[tier];
        // HP and damage are scaled together (a group at scale s is as strong as s times as many
        // foes, Lanchester's square law), which keeps fight length near the real one; scaling HP
        // alone overrated hard hitters measured far from full size.
        const s = normalScale(
          (k) => foes(family, tier, level, copies, k, k),
          level,
          fights,
          `${family.id}:${tier}:${level}`,
        );
        const threat = 4 / (copies * s);
        ((table[family.id] ??= {})[tier] ??= {})[level] = Math.round(threat * 1000) / 1000;
        writeFileSync(out, JSON.stringify(table, null, 1));
        console.log(`${new Date().toISOString().slice(11, 19)} ${family.id} ${tier} L${level}: ${threat.toFixed(3)}`);
      }
  }
}

function emitTable(out: string, inputs: string[]) {
  const table: ThreatTable = {};
  for (const input of inputs) {
    const part: ThreatTable = JSON.parse(readFileSync(input, "utf8"));
    for (const [family, tiers] of Object.entries(part)) table[family] = { ...(table[family] ?? {}), ...tiers };
  }
  // A sample far under both its neighbours is measurement noise more often than a real weak spot, and a
  // low worth packs extra foes in (Engine playtest 2026-11-03: L8 sampled at half its neighbours, and L8
  // fights lost 7 points). Lift each inner sample to at least 80% of its neighbours' mean.
  for (const tiers of Object.values(table))
    for (const levels of Object.values(tiers)) {
      if (!levels) continue;
      const keys = Object.keys(levels)
        .map(Number)
        .sort((a, b) => a - b);
      const raw = keys.map((key) => levels[key]!);
      for (let i = 1; i < keys.length - 1; i++)
        levels[keys[i]!] = Math.max(raw[i]!, 0.8 * ((raw[i - 1]! + raw[i + 1]!) / 2));
    }
  const order = MARINARA_BESTIARY.map((family) => family.id).filter((id) => table[id]);
  const lines = [
    "// Generated by scripts/class-lab/bestiary-lab.ts (table); do not edit by hand. Re-measure after",
    "// changing a family, an ability, the tier sizes, the fight math or the class trees.",
    "//",
    "// What one foe of a family is worth in an encounter budget, by tier, at the lab's sample levels,",
    "// in party members (a party of four's Normal budget is 4). Levels between samples interpolate.",
    "",
    `export const MARINARA_BESTIARY_SAMPLE_LEVELS = ${JSON.stringify(SAMPLE_LEVELS)} as const;`,
    "",
    "export const MARINARA_BESTIARY_THREAT: Record<string, Partial<Record<string, Record<number, number>>>> = {",
  ];
  for (const family of order) {
    lines.push(`  "${family}": {`);
    for (const tier of ["minion", "standard", "elite", "boss"]) {
      const levels = table[family]![tier];
      if (!levels) continue;
      lines.push(
        `    ${tier}: { ${Object.entries(levels)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([level, value]) => `${level}: ${Number(value).toFixed(2)}`)
          .join(", ")} },`,
      );
    }
    lines.push("  },");
  }
  lines.push("};", "");
  writeFileSync(out, lines.join("\n"));
}

if (process.argv[1]?.endsWith("bestiary-lab.ts")) {
  const command = process.argv[2];
  if (command === "measure") measure(process.argv[3]!, Number(process.argv[4] ?? 4));
  else if (command === "table") emitTable(process.argv[3]!, process.argv.slice(4));
  else console.error("measure <out.json> [fights] | table <out.ts> <in.json...>");
}
