// The blueprint a game's setup reply carries (campaign plan, HUD widgets, intro, theme), read as
// tolerantly as it can be: a model writes what it writes, and one value past a cap would otherwise
// fail the whole parse and drop the blueprint.
import { z } from "zod";

/** A string held to `max` characters: a longer one is cut at the last word that fits, never refused
 *  (laptop playtest 2026-10-24: one encounter principle over 160 characters dropped a blueprint). */
export function clipText(value: string, max: number): string {
  if (value.length <= max) return value;
  let cut = value.slice(0, max - 1);
  // Never half of a pair: an emoji straddling the cut goes whole.
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
const clipped = (max: number) =>
  z.preprocess((value) => (typeof value === "string" ? clipText(value.trim(), max) : value), z.string().max(max));

// Coerce LLM output into the campaign-plan ranges rather than rejecting it.
// The LLM occasionally exceeds the array caps or the pressure-clock step
// count; without preprocessing, a single out-of-range value would fail
// safeParse and silently drop the entire blueprint — including hudWidgets,
// which is what the user actually configured.
const sliceArray = (max: number) => (val: unknown) => (Array.isArray(val) ? val.slice(0, max) : val);
const clampInt = (min: number, max: number) => (val: unknown) =>
  typeof val === "number" && Number.isFinite(val) ? Math.max(min, Math.min(max, Math.trunc(val))) : val;
const campaignPlanSchema = z
  .object({
    openingSituation: clipped(240).optional().default(""),
    pressureClocks: z.preprocess(
      sliceArray(2),
      z
        .array(
          z.object({
            name: clipped(80),
            steps: z.preprocess(clampInt(1, 12), z.number().int().min(1).max(12).default(4)),
            current: z.preprocess(clampInt(0, 12), z.number().int().min(0).max(12).default(0)),
            failure: clipped(180).default(""),
          }),
        )
        .default([]),
    ),
    factions: z.preprocess(
      sliceArray(2),
      z
        .array(
          z.object({
            name: clipped(80),
            goal: clipped(160),
            method: clipped(160).optional(),
            secret: clipped(180).optional(),
          }),
        )
        .default([]),
    ),
    questSeeds: z.preprocess(sliceArray(3), z.array(clipped(180)).default([])),
    encounterPrinciples: z.preprocess(sliceArray(2), z.array(clipped(160)).default([])),
  })
  .optional()
  .nullable()
  .transform((plan) => plan ?? undefined);
export const gameSetupBlueprintSchema = z.object({
  campaignPlan: campaignPlanSchema,
  hudWidgets: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum([
          "progress_bar",
          "gauge",
          "relationship_meter",
          "counter",
          "stat_block",
          "list",
          "inventory_grid",
          "timer",
        ]),
        label: z.string(),
        icon: z.string().optional(),
        position: z.enum(["hud_left", "hud_right"]),
        accent: z.string().optional(),
        config: z.record(z.string(), z.unknown()),
      }),
    )
    .default([]),
  introSequence: z
    .array(
      z.object({
        effect: z.string(),
        duration: z.number().optional(),
        intensity: z.number().min(0).max(1).optional(),
        target: z.enum(["background", "content", "all"]).optional(),
        params: z.record(z.string(), z.string()).optional(),
      }),
    )
    .default([]),
  visualTheme: z
    .object({
      palette: z.string(),
      uiStyle: z.string(),
      moodDefault: z.string(),
    })
    .optional(),
});
