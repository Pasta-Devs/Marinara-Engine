/**
 * Bestiary verification: builds random encounters with the bestiary's own builder for every setting,
 * level and difficulty, plays them through the combat director (the Engine's combat AI on both
 * sides) against the reference parties, and reports how each difficulty plays (win rate, party HP
 * lost, the worst encounters), which families drift from their rating, and the biggest plain hit any
 * foe can land on a party member.
 *
 *   tsx scripts/class-lab/bestiary-verify.ts <out.md> [encountersPerCell] [fightsPerParty]
 *   (SETTINGS=a,b to limit; SHARD=k/n to split the cells over processes; merge with "merge <out.md> a.json b.json ...")
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  MARINARA_BESTIARY,
  MARINARA_BESTIARY_SETTINGS,
  MARINARA_ENCOUNTER_BUDGET,
  MARINARA_TIER_RULES,
  marinaraBuildEncounter,
  marinaraCheckEncounter,
  marinaraEnemySpec,
  type MarinaraEncounterDifficulty,
  type MarinaraEncounterFoe,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import { marinaraHitNumbers, type MarinaraFighter } from "../../packages/shared/src/features/marinara-combat.js";
import { marinaraRandom } from "../../packages/shared/src/features/marinara-classes.js";
import { enemyFighter, playFight, referenceParty, REFERENCE_PARTIES, seedOf } from "./bestiary-units.js";
import { foes as familyFoes, settingOf } from "./bestiary-lab.js";

export const VERIFY_LEVELS = [2, 6, 10, 14, 18, 22, 26, 30];
const DIFFICULTIES = Object.keys(MARINARA_ENCOUNTER_BUDGET) as MarinaraEncounterDifficulty[];

export interface EncounterResult {
  setting: string;
  level: number;
  difficulty: MarinaraEncounterDifficulty;
  boss: boolean;
  foes: MarinaraEncounterFoe[];
  threat: number;
  wins: number;
  lost: number;
  downed: number;
  /** Share of fights the director called off with neither side able to finish the other. */
  stalls?: number;
}

export function playEncounter(
  setting: string,
  level: number,
  foes: MarinaraEncounterFoe[],
  fights: number,
  key: string,
) {
  let wins = 0;
  let lost = 0;
  let downed = 0;
  let stalls = 0;
  let total = 0;
  for (const name of Object.keys(REFERENCE_PARTIES))
    for (let i = 0; i < fights; i++) {
      const units = foes.map((foe, j) =>
        enemyFighter(marinaraEnemySpec({ ...foe, setting: setting as never, id: `e${j}` })),
      );
      const fight = playFight(
        referenceParty(name, level, `v${i}`),
        units,
        seedOf(`verify:${key}:${name}:${i}`),
        `${key} L${level} ${name}`,
      );
      total++;
      if (fight.victory) wins++;
      if (fight.stalled) stalls++;
      lost += fight.lost;
      downed += fight.downed;
    }
  return { wins: wins / total, lost: lost / total, downed: downed / total, stalls: stalls / total };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

function run(perCell: number, fights: number): EncounterResult[] {
  const results: EncounterResult[] = [];
  const settings = process.env.SETTINGS?.split(",") ?? [...MARINARA_BESTIARY_SETTINGS];
  const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];
  let cell = 0;
  for (const setting of settings)
    for (const level of VERIFY_LEVELS)
      for (const difficulty of DIFFICULTIES) {
        if (cell++ % shards !== shard) continue;
        for (let e = 0; e < perCell; e++) {
          const random = marinaraRandom(`build:${setting}:${level}:${difficulty}:${e}`);
          const boss = difficulty !== "easy" && level >= 5 && e % 4 === 3;
          const built = marinaraBuildEncounter({
            setting: setting as never,
            party: { level, size: 4 },
            difficulty,
            random,
            boss,
          });
          if (!built.foes.length) continue;
          const check = marinaraCheckEncounter({
            setting: setting as never,
            party: { level, size: 4 },
            foes: built.foes,
          });
          if (check.problems.length) console.error(`builder made a bad fight: ${check.problems.join("; ")}`);
          const played = playEncounter(setting, level, built.foes, fights, `${setting}:${level}:${difficulty}:${e}`);
          results.push({
            setting,
            level,
            difficulty,
            boss: built.foes.some((f) => f.tier === "boss"),
            foes: built.foes,
            threat: built.threat,
            ...played,
          });
        }
      }
  return results;
}

/** The biggest plain (non-crit) hit each family's foes can land on a reference party member, as a
 *  share of that member's max HP, at every sample level and tier. */
function biggestHits(): Array<{
  family: string;
  tier: string;
  level: number;
  share: number;
  what: string;
  on: string;
}> {
  const out: Array<{ family: string; tier: string; level: number; share: number; what: string; on: string }> = [];
  for (const family of MARINARA_BESTIARY)
    for (const tier of family.tiers)
      for (const level of [4, 8, 12, 16, 20, 24, 28]) {
        if (level < family.levels[0] || level > family.levels[1] || level < MARINARA_TIER_RULES[tier].minLevel)
          continue;
        if (!settingOf(family, level)) continue;
        const foe = familyFoes(family, tier, level, 1)[0]!;
        let best = { share: 0, what: "", on: "" };
        for (const name of Object.keys(REFERENCE_PARTIES)) {
          const party = referenceParty(name, level, "hit");
          const all: MarinaraFighter[] = [...party, foe];
          const attacks = [
            {
              id: "attack",
              effect: {
                kind: "damage",
                target: "enemy",
                scales: foe.magicBasic ? "magic" : "strength",
                power: 5,
                damage: foe.magicBasic ? "magic" : "physical",
                basic: true,
              },
            },
            ...(foe.enemySkills ?? []).map((id) => ({ id, effect: enemySkill(id) })),
          ];
          for (const member of party)
            for (const { id, effect } of attacks) {
              if (!effect || effect.kind !== "damage") continue;
              const numbers = marinaraHitNumbers(foe, member, effect as never, all);
              // Back-row melee takes half in Classic; an area hit spreads.
              const reachHalf = member.row === "back" && !effect.ranged && !foe.rangedBasic ? 0.5 : 1;
              const spread =
                effect.target === "all-enemies" || effect.target === "front-row" ? (effect.spread ?? 0.6) : 1;
              const share = (numbers.damage * reachHalf * spread * (effect.hits ?? 1)) / member.maxHp;
              if (share > best.share) best = { share, what: id, on: member.name };
            }
        }
        out.push({ family: family.id, tier, level, ...best });
      }
  return out;
}

import { MARINARA_ENEMY_SKILLS } from "../../packages/shared/src/features/marinara-combat.js";
function enemySkill(id: string) {
  return MARINARA_ENEMY_SKILLS[id] as
    | { kind: string; target: string; ranged?: boolean; spread?: number; hits?: number }
    | undefined;
}

export function report(results: EncounterResult[]): string {
  const lines: string[] = [];
  lines.push(
    "| Difficulty | Encounters | Wins (mean) | Wins (worst 10% of encounters) | HP lost (mean) | Allies down per fight | Foes per fight | Stalled |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const difficulty of DIFFICULTIES) {
    const rows = results.filter((r) => r.difficulty === difficulty);
    const mean = (f: (r: EncounterResult) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length);
    lines.push(
      `| ${difficulty} | ${rows.length} | ${pct(mean((r) => r.wins))} | ${pct(
        quantile(
          rows.map((r) => r.wins),
          0.1,
        ),
      )} | ${pct(mean((r) => r.lost))} | ${mean((r) => r.downed).toFixed(2)} | ${mean((r) => r.foes.length).toFixed(1)} | ${pct(mean((r) => r.stalls ?? 0))} |`,
    );
  }
  const bossRows = results.filter((r) => r.boss);
  if (bossRows.length)
    lines.push(
      "",
      `Fights led by a boss: ${bossRows.length}, wins ${pct(bossRows.reduce((s, r) => s + r.wins, 0) / bossRows.length)}, HP lost ${pct(bossRows.reduce((s, r) => s + r.lost, 0) / bossRows.length)}.`,
    );
  lines.push("", "By level (wins, mean party HP lost):", "");
  lines.push("| Level | Easy | Normal | Hard | Deadly |", "| --- | --- | --- | --- | --- |");
  for (const level of VERIFY_LEVELS) {
    const cell = (d: MarinaraEncounterDifficulty) => {
      const rows = results.filter((r) => r.level === level && r.difficulty === d);
      if (!rows.length) return "–";
      return `${pct(rows.reduce((s, r) => s + r.wins, 0) / rows.length)} (${pct(rows.reduce((s, r) => s + r.lost, 0) / rows.length)})`;
    };
    lines.push(`| ${level} | ${cell("easy")} | ${cell("normal")} | ${cell("hard")} | ${cell("deadly")} |`);
  }
  lines.push("", "By setting (wins on Normal and Hard):", "");
  lines.push("| Setting | Normal | Hard |", "| --- | --- | --- |");
  for (const setting of MARINARA_BESTIARY_SETTINGS) {
    const cell = (d: MarinaraEncounterDifficulty) => {
      const rows = results.filter((r) => r.setting === setting && r.difficulty === d);
      return rows.length ? pct(rows.reduce((s, r) => s + r.wins, 0) / rows.length) : "–";
    };
    lines.push(`| ${setting} | ${cell("normal")} | ${cell("hard")} |`);
  }
  // Drift: how far an encounter's HP loss lands from its difficulty's mark, by family in it.
  const target: Record<MarinaraEncounterDifficulty, number> = { easy: 0.18, normal: 0.35, hard: 0.55, deadly: 0.75 };
  const blame: Record<string, { n: number; over: number }> = {};
  for (const r of results)
    for (const id of new Set(r.foes.map((f) => f.familyId))) {
      const entry = (blame[id] ??= { n: 0, over: 0 });
      entry.n++;
      entry.over += r.lost - target[r.difficulty];
    }
  lines.push(
    "",
    "Family drift: mean party HP lost above (+) or below (−) the difficulty's mark (Easy 18%, Normal 35%, Hard 55%, Deadly 75%), in the encounters it was in:",
    "",
  );
  lines.push("| Family | Encounters | Drift (points) |", "| --- | --- | --- |");
  for (const [id, entry] of Object.entries(blame).sort((a, b) => b[1].over / b[1].n - a[1].over / a[1].n))
    lines.push(
      `| ${id} | ${entry.n} | ${entry.over / entry.n >= 0 ? "+" : ""}${Math.round((entry.over / entry.n) * 100)} |`,
    );
  const worst = [...results].sort((a, b) => a.wins - b.wins || b.lost - a.lost).slice(0, 12);
  lines.push("", "The hardest encounters for their rating:", "");
  lines.push("| Setting | Level | Difficulty | Foes | Wins | HP lost |", "| --- | --- | --- | --- | --- | --- |");
  for (const r of worst)
    lines.push(
      `| ${r.setting} | ${r.level} | ${r.difficulty} | ${r.foes.map((f) => `${f.familyId} ${f.tier}${f.level !== r.level ? ` L${f.level}` : ""}`).join(", ")} | ${pct(r.wins)} | ${pct(r.lost)} |`,
    );
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("bestiary-verify.ts")) {
  if (process.argv[2] === "merge") {
    const out = process.argv[3]!;
    const results = process.argv
      .slice(4)
      .flatMap((file) => JSON.parse(readFileSync(file, "utf8")) as EncounterResult[]);
    writeFileSync(out, `${report(results)}\n`);
    console.log(report(results));
  } else if (process.argv[2] === "hits") {
    const hits = biggestHits().sort((a, b) => b.share - a.share);
    const lines = [
      "| Family | Tier | Level | Biggest plain hit | With | On |",
      "| --- | --- | --- | --- | --- | --- |",
    ];
    for (const h of hits.slice(0, Number(process.argv[4] ?? 40)))
      lines.push(`| ${h.family} | ${h.tier} | ${h.level} | ${pct(h.share)} | ${h.what} | ${h.on} |`);
    writeFileSync(process.argv[3]!, `${lines.join("\n")}\n`);
    console.log(lines.join("\n"));
  } else {
    const out = process.argv[2]!;
    const results = run(Number(process.argv[3] ?? 3), Number(process.argv[4] ?? 2));
    writeFileSync(`${out}.json`, JSON.stringify(results));
    writeFileSync(out, `${report(results)}\n`);
    console.log(report(results));
  }
}
