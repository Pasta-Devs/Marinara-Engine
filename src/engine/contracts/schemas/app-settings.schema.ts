// ──────────────────────────────────────────────
// App Settings Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

/** Payload for writing an opaque app settings value. */
export const appSettingsUpdateSchema = z.object({
  value: z.unknown(),
});

/** Response shape for reading an app settings value. */
export const appSettingsResponseSchema = z
  .object({
    value: z.unknown().nullable().default(null),
  })
  .passthrough();

export type AppSettingsUpdateInput = z.infer<typeof appSettingsUpdateSchema>;
export type AppSettingsResponse = z.infer<typeof appSettingsResponseSchema>;
