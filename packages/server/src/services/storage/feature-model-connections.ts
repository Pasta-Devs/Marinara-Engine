// ──────────────────────────────────────────────
// Storage: global per-feature Model choices
// ──────────────────────────────────────────────
import {
  FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY,
  featureModelConnectionsSchema,
  LOCAL_SIDECAR_CONNECTION_ID,
  type FeatureModelConnections,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";

export const DEFAULT_FEATURE_MODEL_CONNECTIONS: FeatureModelConnections = {
  mariConnectionId: null,
  omnibarAsideConnectionId: LOCAL_SIDECAR_CONNECTION_ID,
  impersonateConnectionId: null,
  visionConnectionId: null,
};

/** The stored choices with defaults filled in. A missing or unreadable value is the defaults. */
export async function readFeatureModelConnections(db: DB): Promise<FeatureModelConnections> {
  const raw = await createAppSettingsStorage(db).get(FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY);
  if (!raw) return DEFAULT_FEATURE_MODEL_CONNECTIONS;
  try {
    const stored = featureModelConnectionsSchema.partial().parse(JSON.parse(raw));
    return {
      mariConnectionId: stored.mariConnectionId ?? null,
      // A cleared aside choice (e.g. its Model was deleted) goes back to the local model.
      omnibarAsideConnectionId: stored.omnibarAsideConnectionId ?? LOCAL_SIDECAR_CONNECTION_ID,
      impersonateConnectionId: stored.impersonateConnectionId ?? null,
      visionConnectionId: stored.visionConnectionId ?? null,
    };
  } catch (error) {
    logger.warn(error, "Ignoring invalid stored feature-model-connections setting");
    return DEFAULT_FEATURE_MODEL_CONNECTIONS;
  }
}
