import type { CharacterStat } from "@marinara-engine/shared";
import {
  PERSONA_ADD_STAT_DENSITY_HEIGHT_REM,
  PERSONA_STAT_DENSITY_HEIGHT_REM,
} from "./tracker-panel.constants";
import type { TrackerStatDensity, TrackerStatDisplayScale } from "../tracker-panel.types";

export function trackerStatStackHeight(statCount: number, density: TrackerStatDensity, includeAdd: boolean) {
  return (
    statCount * PERSONA_STAT_DENSITY_HEIGHT_REM[density] +
    (includeAdd ? PERSONA_ADD_STAT_DENSITY_HEIGHT_REM[density] : 0)
  );
}

export function getTrackerStatDensity(
  statCount: number,
  includeAdd: boolean,
  allowance: number,
): TrackerStatDensity {
  if (trackerStatStackHeight(statCount, "normal", includeAdd) <= allowance) return "normal";
  if (trackerStatStackHeight(statCount, "compact", includeAdd) <= allowance) return "compact";
  return "tight";
}

export function getTrackerStatDisplayScale(
  statCount: number,
  density: TrackerStatDensity,
  fillAvailable: boolean,
  includeAdd: boolean,
): TrackerStatDisplayScale {
  if (!fillAvailable || density !== "normal") return "standard";
  return statCount + (includeAdd ? 1 : 0) <= 4 ? "spacious" : "roomy";
}

export function coerceStatNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getStatPercent(stat: CharacterStat) {
  const max = coerceStatNumber(stat.max);
  if (max <= 0) return 0;
  const value = coerceStatNumber(stat.value);
  return Math.max(0, Math.min(100, (value / max) * 100));
}
