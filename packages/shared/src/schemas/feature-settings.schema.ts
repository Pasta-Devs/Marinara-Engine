import { z } from "zod";

/**
 * App-wide feature switches (Settings > Advanced > Features), stored as one JSON
 * object in the `features` app setting. This file is the single registry: every
 * switch, its default and its number settings live here.
 *
 * Every switch defaults OFF, so an install that never opens the Features section
 * behaves exactly as before. An absent key means "use the default"; the client
 * only stores values that differ from it.
 */
export const FEATURE_SETTINGS_KEY = "features";

export const FEATURE_SWITCH_NAMES = [
  "chatgptHistoryReplay",
  "cacheFriendlyPromptLayout",
  "stableLorebookGroupPicks",
  "providerRetry",
  "backgroundCallCap",
  "generationJobTracking",
  "consoleTray",
] as const;
export type FeatureSwitchName = (typeof FEATURE_SWITCH_NAMES)[number];

/** Default of each switch when nothing is saved and no environment variable pins it. */
export const FEATURE_SWITCH_DEFAULTS: Readonly<Record<FeatureSwitchName, boolean>> = {
  chatgptHistoryReplay: false,
  cacheFriendlyPromptLayout: false,
  stableLorebookGroupPicks: false,
  providerRetry: false,
  backgroundCallCap: false,
  generationJobTracking: false,
  consoleTray: false,
};

export const FEATURE_NUMBER_SETTINGS = {
  backgroundCallsPerHour: { defaultValue: 600, min: 1, max: 100_000 },
} as const;
export type FeatureNumberName = keyof typeof FEATURE_NUMBER_SETTINGS;
export const FEATURE_NUMBER_NAMES = Object.keys(FEATURE_NUMBER_SETTINGS) as FeatureNumberName[];

export type FeatureSettings = Partial<Record<FeatureSwitchName, boolean> & Record<FeatureNumberName, number>>;

const numberSchema = (name: FeatureNumberName) => {
  const { min, max } = FEATURE_NUMBER_SETTINGS[name];
  return z.number().int().min(min).max(max);
};

export const featureSettingsSchema = z
  .object({
    chatgptHistoryReplay: z.boolean().optional(),
    cacheFriendlyPromptLayout: z.boolean().optional(),
    stableLorebookGroupPicks: z.boolean().optional(),
    providerRetry: z.boolean().optional(),
    backgroundCallCap: z.boolean().optional(),
    generationJobTracking: z.boolean().optional(),
    consoleTray: z.boolean().optional(),
    backgroundCallsPerHour: numberSchema("backgroundCallsPerHour").optional(),
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
  for (const name of FEATURE_NUMBER_NAMES) {
    const parsed = numberSchema(name).safeParse(raw[name]);
    if (parsed.success) settings[name] = parsed.data;
  }
  return settings;
}

export function resolveFeatureEnabled(settings: FeatureSettings | null | undefined, name: FeatureSwitchName): boolean {
  return settings?.[name] ?? FEATURE_SWITCH_DEFAULTS[name];
}

export function resolveFeatureNumber(settings: FeatureSettings | null | undefined, name: FeatureNumberName): number {
  return settings?.[name] ?? FEATURE_NUMBER_SETTINGS[name].defaultValue;
}

/**
 * Why a switch has no effect on this server, so the UI can show it as unavailable.
 * `windowsOnly`: the switch drives a Windows-only helper (the console tray icon).
 */
export type FeatureUnavailableReason = "windowsOnly";

export interface FeatureSettingsResponse {
  /** What is saved; absent keys use their defaults. */
  settings: FeatureSettings;
  /** Settings pinned by a server environment variable, with the variable name. Env wins over the saved value. */
  envOverrides: Partial<Record<FeatureSwitchName | FeatureNumberName, string>>;
  /** For switches pinned by an on/off environment variable: the value actually in effect. */
  effective?: Partial<Record<FeatureSwitchName, boolean>>;
  /** Switches that cannot work on this server (for example a Windows-only switch on Linux), with the reason. */
  unavailable?: Partial<Record<FeatureSwitchName, FeatureUnavailableReason>>;
}
