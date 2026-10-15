import { z } from "zod";

// Global (server-side) Model choices for features that used to be per-browser.
// The ids are Model (api_connections) ids, so the dangling-reference sweep may null them.
export const FEATURE_MODEL_CONNECTIONS_SETTINGS_KEY = "feature-model-connections";

export const featureModelConnectionsSchema = z.object({
  mariConnectionId: z.string().nullable(),
  omnibarAsideConnectionId: z.string().nullable(),
  impersonateConnectionId: z.string().nullable(),
});

export type FeatureModelConnections = z.infer<typeof featureModelConnectionsSchema>;
