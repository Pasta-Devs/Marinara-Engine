import type { FeatureModelConnections } from "@marinara-engine/shared";
import { readLegacyMariConnectionId } from "./omnibar-aside-text";

// The feature Model picks used to live in ui.store (per browser). The store migration stages them here
// until useMigrateFeatureModels has copied them to the server.
const STAGED_KEY = "marinara:legacy-feature-models";

/** Moves the old picks out of a persisted ui.store snapshot (version <= 103) and into the staging key. */
export function stageLegacyFeatureModels(persisted: Record<string, unknown>, version: number) {
  const str = (value: unknown) => (typeof value === "string" && value ? value : null);
  const staged: FeatureModelConnections = {
    // Before v103 Mari's pick lived under its own browser key.
    mariConnectionId: str(persisted.mariConnectionId) ?? (version <= 102 ? readLegacyMariConnectionId() : null),
    omnibarAsideConnectionId: str(persisted.omnibarAsideConnectionId),
    impersonateConnectionId: str(persisted.impersonateConnectionId),
  };
  delete persisted.mariConnectionId;
  delete persisted.omnibarAsideConnectionId;
  delete persisted.impersonateConnectionId;
  try {
    if (Object.values(staged).some(Boolean)) localStorage.setItem(STAGED_KEY, JSON.stringify(staged));
  } catch {
    /* storage unavailable: the picks fall back to the server defaults */
  }
}

export function readStagedFeatureModels(): FeatureModelConnections | null {
  try {
    const raw = localStorage.getItem(STAGED_KEY);
    return raw ? (JSON.parse(raw) as FeatureModelConnections) : null;
  } catch {
    return null;
  }
}

export function clearStagedFeatureModels() {
  try {
    localStorage.removeItem(STAGED_KEY);
  } catch {
    /* ignore */
  }
}
