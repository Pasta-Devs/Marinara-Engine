/** Prints the bestiary as a markdown catalogue (for the design doc). */
import { MARINARA_BESTIARY, MARINARA_BESTIARY_SETTINGS } from "../../packages/shared/src/features/marinara-bestiary.js";
const rows: string[] = [
  "| Family | Role | Tiers | Levels | Settings | Example names (low → high) |",
  "|---|---|---|---|---|---|",
];
for (const f of MARINARA_BESTIARY as any[]) {
  const settings = Object.keys(f.names);
  const ex = (settings.includes("high_fantasy") ? f.names.high_fantasy : f.names[settings[0]!]) as any[];
  const names = ex.map((b: any) => b.name ?? b[0] ?? JSON.stringify(b)).filter(Boolean);
  rows.push(
    `| ${f.id} | ${f.role} | ${f.tiers.join(", ")} | ${f.levels?.join?.("–") ?? JSON.stringify(f.levels)} | ${settings.length === MARINARA_BESTIARY_SETTINGS.length ? "all" : settings.join(", ")} | ${names.slice(0, 3).join(" → ")} |`,
  );
}
console.log(rows.join("\n"));
