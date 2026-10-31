import { z } from "zod";

// Global (server-side) Model choices for features that used to be per-browser.
// The ids are Model (api_connections) ids, so the dangling-reference sweep may null them.
export const FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY = "feature-model-connections";

export const featureModelConnectionsSchema = z.object({
  mariConnectionId: z.string().min(1).nullable(),
  omnibarAsideConnectionId: z.string().min(1).nullable(),
  impersonateConnectionId: z.string().min(1).nullable(),
  /** Reads images for chat Models that cannot (Image reading default). */
  visionConnectionId: z.string().min(1).nullable(),
  /** "If it fails": the Model a feature uses when its own Model's call fails. */
  mariFallbackConnectionId: z.string().min(1).nullable(),
  omnibarAsideFallbackConnectionId: z.string().min(1).nullable(),
  impersonateFallbackConnectionId: z.string().min(1).nullable(),
  visionFallbackConnectionId: z.string().min(1).nullable(),
});

export type FeatureModelConnections = z.infer<typeof featureModelConnectionsSchema>;
