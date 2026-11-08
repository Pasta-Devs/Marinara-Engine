/**
 * Boss-fight sim: builds Hard and Deadly boss encounters with the bestiary's builder in every setting
 * at L12-30, plays them through the combat director against the reference parties (reasons log on,
 * as every lab fight), and reports rounds per fight, the party's hit chance on the boss, and how the
 * party's damage to the boss splits between physical (slash, pierce, blunt) and everything else.
 *
 *   tsx scripts/class-lab/boss-sim.ts <out.json> [encountersPerCell] [fightsPerParty]   (SHARD=k/n)
 */
import { writeFileSync } from "node:fs";
import {
  MARINARA_BESTIARY_SETTINGS,
  marinaraBuildEncounter,
  marinaraEnemySpec,
} from "../../packages/shared/src/features/marinara-bestiary.js";
import type { MarinaraEvent } from "../../packages/shared/src/features/marinara-combat.js";
import { marinaraRandom } from "../../packages/shared/src/features/marinara-classes.js";
import { enemyFighter, playFight, referenceParty, REFERENCE_PARTIES, seedOf } from "./bestiary-units.js";

const LEVELS = [12, 18, 24, 30];
const DIFFICULTIES = ["hard", "deadly"] as const;
const PHYSICAL = new Set(["slash", "pierce", "blunt"]);
const [out, perCell = "2", fpp = "2"] = process.argv.slice(2);
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];

interface Row {
  setting: string;
  level: number;
  difficulty: string;
  boss: string;
  party: string;
  victory: boolean;
  rounds: number;
  swings: number;
  hits: number;
  chanceSum: number;
  physical: number;
  other: number;
  bossHp: number;
}
const rows: Row[] = [];
let cell = 0;
for (const setting of MARINARA_BESTIARY_SETTINGS)
  for (const level of LEVELS)
    for (const difficulty of DIFFICULTIES) {
      if (cell++ % shards !== shard) continue;
      for (let e = 0; e < Number(perCell); e++) {
        const built = marinaraBuildEncounter({
          setting,
          party: { level, size: 4 },
          difficulty,
          random: marinaraRandom(`boss:${setting}:${level}:${difficulty}:${e}`),
          boss: true,
        });
        const boss = built.foes.find((foe) => foe.tier === "boss");
        if (!boss) continue;
        for (const name of Object.keys(REFERENCE_PARTIES))
          for (let i = 0; i < Number(fpp); i++) {
            const units = built.foes.map((foe, j) =>
              enemyFighter(marinaraEnemySpec({ ...foe, setting: setting as never, id: `e${j}` })),
            );
            const bossId = `e${built.foes.indexOf(boss)}`;
            const tap: MarinaraEvent[] = [];
            const key = `${setting}:${level}:${difficulty}:${e}`;
            const fight = playFight(
              referenceParty(name, level, `b${i}`),
              units,
              seedOf(`boss:${key}:${name}:${i}`),
              `boss ${key} ${name}`,
              tap,
            );
            const onBoss = tap.filter((ev) => ev.targetId === bossId && ev.actorId.startsWith("p"));
            const swings = onBoss.filter((ev) => ev.kind === "hit" || ev.kind === "miss");
            const hits = swings.filter((ev) => ev.kind === "hit");
            rows.push({
              setting,
              level,
              difficulty,
              boss: boss.familyId,
              party: name,
              victory: fight.victory,
              rounds: fight.rounds,
              swings: swings.length,
              hits: hits.length,
              chanceSum: swings.reduce((sum, ev) => sum + (ev.chance ?? 0), 0),
              physical: hits.filter((ev) => PHYSICAL.has(ev.type ?? "")).reduce((s, ev) => s + (ev.amount ?? 0), 0),
              other: hits.filter((ev) => !PHYSICAL.has(ev.type ?? "")).reduce((s, ev) => s + (ev.amount ?? 0), 0),
              bossHp: units[built.foes.indexOf(boss)]!.maxHp,
            });
          }
      }
    }
writeFileSync(out, JSON.stringify(rows));
console.log(`${rows.length} boss fights`);
