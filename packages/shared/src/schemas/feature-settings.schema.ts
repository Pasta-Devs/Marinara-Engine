import { z } from "zod";

/**
 * App-wide feature switches (Settings > Advanced > Features), stored as one JSON
 * object in the `features` app setting. This file is the single registry: every
 * switch and its default live here.
 *
 * Every switch defaults OFF, so an install that never opens the Features section
 * behaves exactly as before. An absent key means "use the default"; the client
 * only stores values that differ from it.
 */
export const FEATURE_SETTINGS_KEY = "features";

export const FEATURE_SWITCH_NAMES = ["stableLorebookGroupPicks", "providerRetry"] as const;
export type FeatureSwitchName = (typeof FEATURE_SWITCH_NAMES)[number];

/** Default of each switch when nothing is saved and no environment variable pins it. */
export const FEATURE_SWITCH_DEFAULTS: Readonly<Record<FeatureSwitchName, boolean>> = {
  stableLorebookGroupPicks: false,
  providerRetry: false,
};

export type FeatureSettings = Partial<Record<FeatureSwitchName, boolean>>;

export const featureSettingsSchema = z
  .object({
    stableLorebookGroupPicks: z.boolean().optional(),
    providerRetry: z.boolean().optional(),
  })
  .strict();

/** Keep only well-formed keys from a stored value; anything else falls back to the default. */
export function normalizeFeatureSettings(value: unknown): FeatureSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const settings: FeatureSettings = {};
  for (const name of FEATURE_SWITCH_NAMES) {
    if (typeof raw[name] === "boolean") settings[name] = raw[name];
  }
  return settings;
}

export function resolveFeatureEnabled(settings: FeatureSettings | null | undefined, name: FeatureSwitchName): boolean {
  return settings?.[name] ?? FEATURE_SWITCH_DEFAULTS[name];
}

export interface FeatureSettingsResponse {
  /** What is saved; absent keys use their defaults. */
  settings: FeatureSettings;
  /** Switches pinned by a server environment variable, with the variable name. Env wins over the saved value. */
  envOverrides: Partial<Record<FeatureSwitchName, string>>;
  /** For switches pinned by an environment variable: the value actually in effect. */
  effective?: Partial<Record<FeatureSwitchName, boolean>>;
}
