import { audioConnectionSupportsGeneration, TTS_SETTINGS_KEY, ttsConfigSchema } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { apiConnections, appSettings } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";

const LEGACY_CONFIG_MARKER = "generativeAudioLegacyConfigMigrated";
const warnedInvalidConfigs = new WeakSet<DB>();

function warnInvalidConfig(db: DB, failure: "json" | "schema", issues?: Array<{ path: string; code: string }>) {
  if (warnedInvalidConfigs.has(db)) return;
  warnedInvalidConfigs.add(db);
  logger.warn(
    { settingsKey: TTS_SETTINGS_KEY, failure, ...(issues ? { issues } : {}) },
    "[migration] Legacy TTS settings are unreadable; deferring their music and sound-effect split",
  );
}

/** Split only enabled legacy generation settings. Speech rows, voices and old profile IDs survive. */
export async function migrateGenerativeAudioConnections(db: DB): Promise<void> {
  let created = 0;
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(apiConnections);
    const settings = await tx.select().from(appSettings);
    const raw = settings.find((row) => row.key === TTS_SETTINGS_KEY)?.value;
    let stored: unknown;
    try {
      stored = raw === undefined ? undefined : JSON.parse(raw);
    } catch {
      warnInvalidConfig(db, "json");
    }
    const parsed = ttsConfigSchema.safeParse(stored);
    if (raw !== undefined && stored !== undefined && !parsed.success) {
      warnInvalidConfig(
        db,
        "schema",
        parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), code: issue.code })),
      );
    }
    const cfg = parsed.success ? parsed.data : null;
    const chosenId = cfg?.connectionId.trim() ?? "";
    let hasDefault = rows.some(
      (row) =>
        row.provider === "audio_generation" &&
        row.profileImportReviewRequired !== "true" &&
        row.defaultForAgents === "true",
    );
    let hasFallback = rows.some(
      (row) =>
        row.provider === "audio_generation" &&
        row.profileImportReviewRequired !== "true" &&
        row.fallbackForAgents === "true",
    );
    const hasLegacyFallback = rows.some(
      (row) =>
        row.provider === "audio" &&
        row.profileImportReviewRequired !== "true" &&
        row.fallbackForAgents === "true" &&
        (audioConnectionSupportsGeneration(row, "music") || audioConnectionSupportsGeneration(row, "sfx")),
    );
    for (const row of rows) {
      if (row.provider !== "audio" || row.profileImportReviewRequired === "true") continue;
      const music = audioConnectionSupportsGeneration(row, "music");
      const sfx = audioConnectionSupportsGeneration(row, "sfx");
      if (!music && !sfx) continue;
      const existing = rows.find(
        (candidate) =>
          candidate.provider === "audio_generation" && candidate.audioGenerationLegacyConnectionId === row.id,
      );
      if (!existing) {
        const timestamp = now();
        // Match the old generation resolver's address/model fallback, including a
        // custom endpoint stored in the source profile rather than the row.
        const source = row.audioSource ?? "elevenlabs";
        const connectionProfile = chosenId === row.id ? cfg : cfg?.connectionProfiles[row.id];
        const sourceProfile =
          source === cfg?.source && !chosenId ? cfg : cfg?.sourceProfiles[source as "openai" | "elevenlabs"];
        const defaultBase = source === "openai" ? "https://api.openai.com/v1" : "https://api.elevenlabs.io";
        const baseUrl = row.baseUrl || (connectionProfile ? defaultBase : sourceProfile?.baseUrl || defaultBase);
        const becomesDefault = !hasDefault && (chosenId ? row.id === chosenId : row.defaultForAgents === "true");
        const becomesFallback =
          !hasFallback && !becomesDefault && (row.fallbackForAgents === "true" || (!hasDefault && !hasLegacyFallback));
        await tx.insert(apiConnections).values({
          ...row,
          id: newId(),
          name: `${row.name} — Music & Sound Effects`,
          provider: "audio_generation",
          audioGenerationSource: row.audioSource === "openai" ? "custom" : "elevenlabs",
          audioGenerationLegacyConnectionId: row.id,
          audioSource: null,
          audioVoice: null,
          baseUrl,
          model:
            source === "elevenlabs"
              ? "music_v1"
              : row.model || (connectionProfile ? "tts-1" : sourceProfile?.model || "tts-1"),
          audioSoundEffectsModel: source === "elevenlabs" ? "eleven_text_to_sound_v2" : null,
          audioMusic: String(music),
          audioSoundEffects: String(sfx),
          defaultForAgents: String(becomesDefault),
          fallbackForAgents: String(becomesFallback),
          isDefault: "false",
          fallbackForMain: "false",
          useForRandom: "false",
          audioGenerationCallbackUrl: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        hasDefault ||= becomesDefault;
        hasFallback ||= becomesFallback;
        created++;
      }
      // Clearing these retired switches makes deletion of the new connection permanent;
      // the next boot cannot recreate a connection the user deliberately removed.
      await tx
        .update(apiConnections)
        .set({ audioMusic: "false", audioSoundEffects: "false" })
        .where(eq(apiConnections.id, row.id));
    }

    // Before first-class TTS connections, Game generation could be on while speech was off.
    // Preserve that case without creating or enabling a speech connection.
    if (
      !settings.some((row) => row.key === LEGACY_CONFIG_MARKER) &&
      cfg &&
      !chosenId &&
      !rows.some(
        (row) =>
          row.provider === "audio" &&
          row.profileImportReviewRequired !== "true" &&
          (row.defaultForAgents === "true" || row.fallbackForAgents === "true"),
      ) &&
      cfg.source === "elevenlabs" &&
      (cfg.elevenLabsGameMusic || cfg.elevenLabsGameSoundEffects)
    ) {
      const timestamp = now();
      await tx.insert(apiConnections).values({
        id: newId(),
        name: "ElevenLabs — Music & Sound Effects",
        provider: "audio_generation",
        baseUrl: cfg.baseUrl || "https://api.elevenlabs.io",
        apiKeyEncrypted: cfg.apiKey,
        model: "music_v1",
        audioGenerationSource: "elevenlabs",
        audioSoundEffectsModel: "eleven_text_to_sound_v2",
        audioMusic: String(cfg.elevenLabsGameMusic),
        audioSoundEffects: String(cfg.elevenLabsGameSoundEffects),
        defaultForAgents: String(!hasDefault),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      created++;
    }
    if (
      !settings.some((row) => row.key === LEGACY_CONFIG_MARKER) &&
      created > 0 &&
      (raw === undefined || parsed.success)
    ) {
      // A row-based split also consumes the old blob's generation decision.
      // Deleting its new connection and then its speech row must not resurrect it.
      const timestamp = now();
      await tx.insert(appSettings).values({ key: LEGACY_CONFIG_MARKER, value: "true", updatedAt: timestamp });
    }
  });
  if (created) logger.info("[migration] Split %d legacy music and sound-effect connections from speech", created);
}
