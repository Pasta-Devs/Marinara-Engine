// ──────────────────────────────────────────────
// Migration: legacy TTS settings blob → first-class audio connection (#5146)
// ──────────────────────────────────────────────
// Runs on every boot (app.ts chain) and is idempotent: it does nothing once
// any audio connection exists or once the completion marker is set. The marker
// lives in its OWN app-settings key — never inside the TTS blob, which
// PUT /api/tts/config rebuilds through ttsConfigSchema (strip-unknown) on
// every settings save. The blob itself is NEVER deleted — it remains the knob
// store (speed, stability, extractor settings) and the resolution fallback
// for anything that predates connections, so an upgrade changes no behavior:
// the synthesized connection reproduces exactly what the blob configured, and
// a blob the user had switched off migrates to no connection at all.
import { ttsConfigSchema, TTS_SETTINGS_KEY } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { decryptApiKey } from "../../utils/crypto.js";
import { logger } from "../../lib/logger.js";

const MIGRATION_MARKER_KEY = "ttsAudioConnectionMigrated";

export async function migrateTtsSettingsToAudioConnection(db: DB) {
  const settings = createAppSettingsStorage(db);
  const connections = createConnectionsStorage(db);

  if ((await settings.get(MIGRATION_MARKER_KEY)) === "true") return;

  const raw = await settings.get(TTS_SETTINGS_KEY);
  if (!raw) {
    // Fresh install: nothing to migrate, and nothing ever will be.
    await settings.set(MIGRATION_MARKER_KEY, "true");
    return;
  }
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    stored = null;
  }
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    logger.warn("[migration] TTS settings blob is unreadable; skipping audio-connection migration");
    return;
  }

  const existingAudio = (await connections.list()).some((connection) => connection.provider === "audio");
  if (existingAudio) {
    await settings.set(MIGRATION_MARKER_KEY, "true");
    return;
  }

  const parsed = ttsConfigSchema.safeParse(stored);
  if (!parsed.success) {
    logger.warn("[migration] TTS settings blob failed validation; skipping audio-connection migration");
    return;
  }
  const cfg = parsed.data;
  const apiKey = decryptApiKey(cfg.apiKey ?? "");
  if (cfg.apiKey && !apiKey) {
    // A stored key that no longer decrypts (rotated/missing encryption key) is
    // a transient state — skip WITHOUT the marker so a later boot with working
    // crypto still completes the migration.
    logger.warn("[migration] TTS API key could not be decrypted; deferring audio-connection migration");
    return;
  }
  // Only a configuration the user could actually hear becomes a connection:
  // the master toggle must be on, and a remote source needs its key. A keyed
  // blob the user explicitly disabled stays a blob — resolution keeps hitting
  // the legacy path and /speak keeps refusing, exactly as before the upgrade.
  const configured = Boolean(cfg.enabled) && (cfg.source === "pockettts" || Boolean(apiKey));
  if (!configured) {
    await settings.set(MIGRATION_MARKER_KEY, "true");
    return;
  }

  const sourceNames: Record<string, string> = {
    openai: "OpenAI Audio",
    elevenlabs: "ElevenLabs",
    pockettts: "PocketTTS (local)",
    xai: "xAI Audio",
  };
  await connections.create({
    name: sourceNames[cfg.source] ?? "Audio",
    provider: "audio",
    baseUrl: cfg.baseUrl ?? "",
    apiKey,
    model: cfg.model ?? "",
    audioSource: cfg.source,
    audioVoice: cfg.voice || null,
    audioSoundEffects: cfg.elevenLabsGameSoundEffects === true,
    audioMusic: cfg.elevenLabsGameMusic === true,
    // The migrated connection becomes the category default so resolution
    // keeps producing exactly the pre-upgrade behavior.
    defaultForAgents: true,
  } as Parameters<typeof connections.create>[0]);
  await settings.set(MIGRATION_MARKER_KEY, "true");
  logger.info("[migration] Created an audio connection from the legacy TTS settings (%s)", cfg.source);
}
