/** Summarises boss-sim JSON files: tsx boss-sim-report.ts a.json b.json ... */
import { readFileSync } from "node:fs";
const rows = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as Array<Record<string, any>>);
const med = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const line = (label: string, list: typeof rows) => {
  if (!list.length) return;
  const swings = list.reduce((s, r) => s + r.swings, 0);
  const phys = list.reduce((s, r) => s + r.physical, 0);
  const other = list.reduce((s, r) => s + r.other, 0);
  console.log(
    `| ${label} | ${list.length} | ${Math.round((list.filter((r) => r.victory).length / list.length) * 100)}% | ${med(list.map((r) => r.rounds))} | ${Math.round(list.reduce((s, r) => s + r.chanceSum, 0) / Math.max(1, swings))}% | ${Math.round((list.reduce((s, r) => s + r.hits, 0) / Math.max(1, swings)) * 100)}% | ${Math.round((phys / Math.max(1, phys + other)) * 100)}% |`,
  );
};
console.log(
  "| Slice | Fights | Wins | Median rounds | Mean hit chance on boss | Hits landed | Physical share of boss damage |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- |");
line("all", rows);
for (const d of ["hard", "deadly"])
  line(
    d,
    rows.filter((r) => r.difficulty === d),
  );
for (const l of [12, 18, 24, 30])
  line(
    `L${l}`,
    rows.filter((r) => r.level === l),
  );
const fams = [...new Set(rows.map((r) => r.boss))].sort();
for (const f of fams)
  line(
    f,
    rows.filter((r) => r.boss === f),
  );
