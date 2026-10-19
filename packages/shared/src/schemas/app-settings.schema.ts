// ──────────────────────────────────────────────
// App Settings Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

export const MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS = 100;

export const managedGenerationParameterDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  requestKey: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  min: z.number().finite(),
  max: z.number().finite(),
  tooltip: z.string().trim().max(500).optional(),
});

export const managedGenerationParameterDefinitionsSchema = z
  .array(managedGenerationParameterDefinitionSchema)
  .max(MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS);

export type ManagedGenerationParameterDefinitionInput = z.infer<typeof managedGenerationParameterDefinitionSchema>;

/**
 * Longest settings value the server stores. The "ui" value holds every image style profile, which has no count
 * limit; a typical profile is about 1,000 characters, so this leaves room for thousands of profiles. The server copy
 * is the source of truth: if a browser cannot cache the whole value locally, the next load restores it from here.
 */
export const MAX_APP_SETTINGS_VALUE_LENGTH = 4_000_000;

/** Payload for PUT /api/app-settings/:key — the opaque serialized settings blob. */
export const appSettingsUpdateSchema = z.object({
  value: z.string().max(MAX_APP_SETTINGS_VALUE_LENGTH),
});

/** Response shape for GET /api/app-settings/:key. */
export const appSettingsResponseSchema = z.object({
  value: z.string().nullable(),
});

export type AppSettingsUpdateInput = z.infer<typeof appSettingsUpdateSchema>;
export type AppSettingsResponse = z.infer<typeof appSettingsResponseSchema>;
