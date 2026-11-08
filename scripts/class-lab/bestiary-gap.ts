/**
 * Measures how a foe's worth changes per level it stands above or below the party
 * (MARINARA_LEVEL_GAP_THREAT): three standard foes at the party's level, 3 above and 3 below, each
 * scaled to the Normal mark; the per-level factor is the cube root of the worth ratio.
 *
 *   tsx scripts/class-lab/bestiary-gap.ts   (FAMILIES=a,b to pick)
 */
import { MARINARA_BESTIARY } from "../../packages/shared/src/features/marinara-bestiary.js";
import { foes, normalScale } from "./bestiary-lab.js";

const families = (process.env.FAMILIES ?? "sellsword,hound,adept,gel,shade").split(",");
const ratios: number[] = [];
for (const partyLevel of [6, 14, 22]) {
  for (const id of families) {
    const family = MARINARA_BESTIARY.find((f) => f.id === id)!;
    const worth: Record<number, number> = {};
    for (const gap of [-3, 0, 3]) {
      const level = partyLevel + gap;
      if (level < family.levels[0]) continue;
      // The foes stand at `level`; the party at `partyLevel`.
      const s = normalScale(
        (k) => foes(family, "standard", level, 3, k, k),
        partyLevel,
        3,
        `gap:${id}:${partyLevel}:${gap}`,
        8,
      );
      worth[gap] = 4 / (3 * s);
    }
    const up = worth[3] && worth[0] ? Math.pow(worth[3] / worth[0], 1 / 3) : NaN;
    const down = worth[-3] && worth[0] ? Math.pow(worth[0] / worth[-3], 1 / 3) : NaN;
    if (Number.isFinite(up)) ratios.push(up);
    if (Number.isFinite(down)) ratios.push(down);
    console.log(
      `party L${partyLevel} ${id}: -3 ${worth[-3]?.toFixed(2)} 0 ${worth[0]?.toFixed(2)} +3 ${worth[3]?.toFixed(2)}  per level up ${up.toFixed(3)} down ${down.toFixed(3)}`,
    );
  }
}
ratios.sort((a, b) => a - b);
console.log(`median per-level factor ${ratios[Math.floor(ratios.length / 2)]!.toFixed(3)}`);
