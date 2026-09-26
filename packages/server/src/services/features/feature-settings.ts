// ──────────────────────────────────────────────
// App-wide feature switches (Settings > Advanced > Features)
// ──────────────────────────────────────────────
// One cached copy of the `features` app setting. Reads are synchronous and allocation free so hot
// paths (every provider call, every lorebook scan) can ask without touching storage. The cache is
// loaded when the app-settings routes register and replaced whenever app-settings storage writes
// or removes the key, so a save takes effect on the next call. The switch list and the defaults
// (all off) live in the shared registry, schemas/feature-settings.schema.ts.
import {
  FEATURE_SETTINGS_KEY,
  normalizeFeatureSettings,
  resolveFeatureEnabled,
  type FeatureSettings,
  type FeatureSettingsResponse,
  type FeatureSwitchName,
} from "@marinara-engine/shared";
import { readEnvFlagOverride } from "../../config/runtime-config.js";
import { logger } from "../../lib/logger.js";

/**
 * Switches an operator can pin from the environment. When the variable is set it wins, both on
 * and off; unset or blank falls through to the saved setting, then to the default.
 */
export const FEATURE_ENV_FLAG_OVERRIDES: Partial<Record<FeatureSwitchName, string>> = {
  stableLorebookGroupPicks: "LOREBOOK_STABLE_GROUP_WINNERS",
  providerRetry: "PROVIDER_RETRY_TRANSIENT_ERRORS",
};

let cached: FeatureSettings = {};
const changeListeners = new Set<() => void>();

/**
 * Run `listener` after every change that can flip a switch: a save, a key removal, a raw row
 * write picked up by reloadFeatureSettingsIfTouched, or a `.env` reload (env overrides). Services
 * that must start or stop something at once subscribe here. Returns the unsubscribe function.
 */
export function onFeatureSettingsChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** Tell the listeners the effective switches may have changed. A throwing listener never breaks the writer. */
export function notifyFeatureSettingsChange(): void {
  for (const listener of [...changeListeners]) {
    try {
      listener();
    } catch (err) {
      logger.warn({ err, event: "feature_settings.change" }, "[features] A feature switch listener failed");
    }
  }
}

/** Replace the cache from a stored JSON string (null = key removed). Bad JSON falls back to defaults. */
export function applyFeatureSettingsValue(value: string | null): FeatureSettings {
  let parsed: unknown = null;
  if (value) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  cached = normalizeFeatureSettings(parsed);
  notifyFeatureSettingsChange();
  return cached;
}

/** Load the cache from storage. Called once at startup; writes keep it current afterwards. */
export async function loadFeatureSettings(storage: { get(key: string): Promise<string | null> }) {
  return applyFeatureSettingsValue(await storage.get(FEATURE_SETTINGS_KEY));
}

/**
 * Reload the cache after a write that bypassed app-settings storage (Professor Mari's generic
 * database commands and their restore). Returns true when the `features` row was touched.
 */
export async function reloadFeatureSettingsIfTouched(
  changes: ReadonlyArray<{ table: string; id: string }>,
  storage: { get(key: string): Promise<string | null> },
): Promise<boolean> {
  if (!changes.some((change) => change.table === "app_settings" && change.id === FEATURE_SETTINGS_KEY)) return false;
  await loadFeatureSettings(storage);
  return true;
}

export function getFeatureSettings(): FeatureSettings {
  return cached;
}

/** Whether a switch is on: its environment variable when set, else the saved setting, else the default (off). */
export function isFeatureEnabled(name: FeatureSwitchName): boolean {
  const envVar = FEATURE_ENV_FLAG_OVERRIDES[name];
  if (envVar) {
    const override = readEnvFlagOverride(envVar);
    if (override !== null) return override;
  }
  return resolveFeatureEnabled(cached, name);
}

export function featureEnvOverrides(): FeatureSettingsResponse["envOverrides"] {
  const overrides: FeatureSettingsResponse["envOverrides"] = {};
  for (const [name, envVar] of Object.entries(FEATURE_ENV_FLAG_OVERRIDES) as Array<[FeatureSwitchName, string]>) {
    if (readEnvFlagOverride(envVar) !== null) overrides[name] = envVar;
  }
  return overrides;
}

/** The in-effect value of each switch an environment variable pins, so the UI shows it. */
export function featureEnvEffective(): NonNullable<FeatureSettingsResponse["effective"]> {
  const effective: NonNullable<FeatureSettingsResponse["effective"]> = {};
  for (const [name, envVar] of Object.entries(FEATURE_ENV_FLAG_OVERRIDES) as Array<[FeatureSwitchName, string]>) {
    const override = readEnvFlagOverride(envVar);
    if (override !== null) effective[name] = override;
  }
  return effective;
}

/** The GET and PUT response of `/api/app-settings/features`. */
export function featureSettingsResponse(): FeatureSettingsResponse {
  return {
    settings: getFeatureSettings(),
    envOverrides: featureEnvOverrides(),
    effective: featureEnvEffective(),
  };
}

/** Tests only. Also notifies the change listeners, like a save would. */
export function resetFeatureSettingsForTests(settings: FeatureSettings = {}): void {
  cached = normalizeFeatureSettings(settings);
  notifyFeatureSettingsChange();
}
