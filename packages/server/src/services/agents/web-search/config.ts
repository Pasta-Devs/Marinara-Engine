// ──────────────────────────────────────────────
// Oracle Config Loader — Reads/Writes OracleConfig in appSettings
// ──────────────────────────────────────────────
// Follows the TTS pattern: config JSON-serialized under key "oracle",
// API key encrypted at rest via the project-wide AES-256-GCM utility.
// ──────────────────────────────────────────────
import { oracleConfigSchema, ORACLE_SETTINGS_KEY, type OracleConfig } from "@marinara-engine/shared";
import type { createAppSettingsStorage } from "../../storage/app-settings.storage.js";
import { decryptApiKey, encryptApiKey } from "../../../utils/crypto.js";

type AppSettingsStore = ReturnType<typeof createAppSettingsStorage>;

/**
 * Parse the raw JSON blob from appSettings into a validated OracleConfig.
 * Returns a default config on any parse/validation failure so a corrupted
 * row never breaks the pipeline — the user can re-save via the UI.
 */
function parseStoredConfig(raw: string | null): OracleConfig {
  if (!raw) return oracleConfigSchema.parse({});
  try {
    return oracleConfigSchema.parse(JSON.parse(raw));
  } catch {
    return oracleConfigSchema.parse({});
  }
}

/**
 * Load the stored config and decrypt the API key.
 * The returned config contains the plain-text key — callers MUST NOT send it to the client.
 */
export async function loadOracleConfig(storage: AppSettingsStore): Promise<OracleConfig> {
  const raw = await storage.get(ORACLE_SETTINGS_KEY);
  const cfg = parseStoredConfig(raw);
  cfg.apiKey = decryptApiKey(cfg.apiKey);
  return cfg;
}

/** Load the raw (still encrypted) config — used by the GET route to mask the key. */
export async function loadRawOracleConfig(storage: AppSettingsStore): Promise<OracleConfig> {
  return parseStoredConfig(await storage.get(ORACLE_SETTINGS_KEY));
}

/**
 * Persist a config payload. Encrypts the API key before storage.
 * Callers pass a plain-text apiKey; this function encrypts it.
 */
export async function saveOracleConfig(storage: AppSettingsStore, input: OracleConfig): Promise<void> {
  const encrypted: OracleConfig = {
    ...input,
    apiKey: input.apiKey ? encryptApiKey(input.apiKey) : "",
  };
  await storage.set(ORACLE_SETTINGS_KEY, JSON.stringify(encrypted));
}
