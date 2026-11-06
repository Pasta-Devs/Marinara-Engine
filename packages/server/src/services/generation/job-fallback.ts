// ──────────────────────────────────────────────
// "If it fails": the Model a job (Prof. Mari, Quick answers, Impersonate, Image reading) switches to
// when its own Model's call fails. Main, Agents, Images, Video and Voice keep their row flags.
// ──────────────────────────────────────────────
import { isChatProvider, type FeatureModelConnections } from "@marinara-engine/shared";
import type { createConnectionsStorage } from "../storage/connections.storage.js";

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
type JobFallbackKey = Extract<keyof FeatureModelConnections, `${string}FallbackConnectionId`>;

/** The job's chosen fallback row, or null when none is set, it is the primary itself, or it cannot answer. */
export async function readJobFallback(
  connections: Pick<ConnectionsStorage, "getWithKey" | "unavailableReason">,
  settings: FeatureModelConnections,
  key: JobFallbackKey,
  primaryId: string | null | undefined,
) {
  const id = settings[key];
  if (!id || id === primaryId || (await connections.unavailableReason(id))) return null;
  const row = await connections.getWithKey(id);
  return row && isChatProvider(row.provider) ? row : null;
}

/** The Image reading Model and its "If it fails" Model, as the captioning runtime takes them. */
export const visionCaptionSettings = (settings: FeatureModelConnections | null) => ({
  visionConnectionId: settings?.visionConnectionId ?? null,
  visionFallbackConnectionId: settings?.visionFallbackConnectionId ?? null,
});
