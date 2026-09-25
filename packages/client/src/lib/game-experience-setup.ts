import type { GameSetupConfig, InstalledCapabilityPackage } from "@marinara-engine/shared";

/** World seeds are written as unsigned 32-bit integers, so a package always reads back what the field shows. */
export const MAX_EXPERIENCE_SEED = 0xffffffff;

export function isExperienceSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_EXPERIENCE_SEED;
}

// Digits only, with optional surrounding whitespace. Number() and parseInt() both salvage a different number
// out of "1.5", "12abc", "1e3" or "0x10", which would build a world the player never asked for, so those are
// refused instead: a refusal is visible, a silently different world is not.
export function parseExperienceSeed(value: unknown): number | null {
  if (isExperienceSeed(value)) return value;
  if (typeof value !== "string" || !/^\s*\d+\s*$/u.test(value)) return null;
  const seed = Number.parseInt(value, 10);
  return isExperienceSeed(seed) ? seed : null;
}

export function buildExperienceSetup(
  experience: InstalledCapabilityPackage | null,
  seedInput: string,
  isNewGame: boolean,
): Pick<GameSetupConfig, "gameExperienceId" | "experienceConfig"> {
  const setup = experience?.manifest.contributions?.gameSurface?.setup;
  if (!isNewGame || !experience || !setup) return {};
  const seed = parseExperienceSeed(seedInput);
  return {
    gameExperienceId: experience.id,
    experienceConfig: { ...setup.config, ...(setup.seed && seed !== null ? { [setup.seed.key]: seed } : {}) },
  };
}
