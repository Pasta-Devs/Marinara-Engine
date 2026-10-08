export const MAX_ILLUSTRATOR_IMAGES_PER_GENERATION = 4;

export function normalizeIllustratorImagesPerGeneration(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 1;
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_ILLUSTRATOR_IMAGES_PER_GENERATION, Math.trunc(parsed)));
}

export const MAX_ILLUSTRATOR_RUN_INTERVAL = 100;

/** A chat's Illustrator Run Interval as a whole number from 0 to 100, or null when the chat uses the agent's own. */
export function normalizeIllustratorRunInterval(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(MAX_ILLUSTRATOR_RUN_INTERVAL, Math.trunc(parsed)));
}
