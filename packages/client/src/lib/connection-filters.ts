import {
  LOCAL_SIDECAR_CONNECTION_ID,
  hasPlanUsageWindows,
  isChatProvider,
  supportsSubscriptionUsageWidget,
} from "@marinara-engine/shared";

export type ConnectionProviderLike = {
  id?: string | null;
  name?: string | null;
  model?: string | null;
  provider?: string | null;
  isDefault?: boolean | string | null;
  isLocalSidecar?: boolean | null;
  defaultParameters?: unknown;
  useForRandom?: boolean | string | null;
};

export type LocalSidecarConnectionOption = {
  id: typeof LOCAL_SIDECAR_CONNECTION_ID;
  name: string;
  model: string;
  provider: "local_sidecar";
  isLocalSidecar: true;
  defaultParameters?: undefined;
  isDefault?: false;
  useForRandom?: "false";
};

/** Storage returns connection flags as "true"/"false" strings; client payloads use booleans. */
export function isConnectionFlagTrue(value: unknown): boolean {
  return value === true || value === "true";
}

/** For flags that default to on: only an explicit false, in either stored or client form, is off. */
export function isConnectionFlagFalse(value: unknown): boolean {
  return value === false || value === "false";
}

/** The active connection with its subscription usage meter, or null when it should not show. */
export function resolveUsageConnection<
  T extends {
    id?: string | null;
    provider?: string | null;
    showUsageWidget?: unknown;
    showUsageFiveHour?: unknown;
    showUsageWeekly?: unknown;
  },
>(connections: readonly T[] | null | undefined, connectionId: string | null | undefined): T | null {
  // A random pick has no single quota to read.
  if (!connectionId || connectionId === "random") return null;
  const connection = (connections ?? []).find((candidate) => candidate.id === connectionId);
  if (!connection || !supportsSubscriptionUsageWidget(connection.provider)) return null;
  // A plan meter with both of its windows switched off has nothing to draw.
  if (
    hasPlanUsageWindows(connection.provider) &&
    isConnectionFlagFalse(connection.showUsageFiveHour) &&
    isConnectionFlagFalse(connection.showUsageWeekly)
  ) {
    return null;
  }
  // The stored flag is a "true"/"false" string, so a strict boolean check
  // would always be false and silently hide the meter.
  return isConnectionFlagTrue(connection.showUsageWidget) ? connection : null;
}

export function isLanguageGenerationConnection(connection: ConnectionProviderLike): boolean {
  return isChatProvider(connection.provider);
}

export function filterLanguageGenerationConnections<T extends ConnectionProviderLike>(
  connections: readonly T[] | null | undefined,
): T[] {
  return (connections ?? []).filter(isLanguageGenerationConnection);
}

/**
 * Audio connections eligible for selection. Quarantined (review-required)
 * imports are excluded to mirror the server's resolution, which refuses them.
 * The loose structural constraint lets both typed rows and raw `/connections`
 * records flow through without casts.
 */
export function filterAudioGenerationConnections<
  T extends { provider?: unknown; profileImportReviewRequired?: unknown },
>(connections: readonly T[] | null | undefined): T[] {
  return (connections ?? []).filter(
    (connection) => connection.provider === "audio" && !isConnectionFlagTrue(connection.profileImportReviewRequired),
  );
}

export function createLocalSidecarConnectionOption(modelDisplayName?: string | null): LocalSidecarConnectionOption {
  const model = modelDisplayName?.trim() || "local-sidecar";
  return {
    id: LOCAL_SIDECAR_CONNECTION_ID,
    name: modelDisplayName?.trim() ? `Built-in model (${modelDisplayName.trim()})` : "Built-in model",
    model,
    provider: "local_sidecar",
    isLocalSidecar: true,
    isDefault: false,
    useForRandom: "false",
  };
}

export function isLocalSidecarConnectionOption(connection: ConnectionProviderLike): boolean {
  return connection.id === LOCAL_SIDECAR_CONNECTION_ID || connection.isLocalSidecar === true;
}

export function appendLocalSidecarConnectionOption<T extends ConnectionProviderLike>(
  connections: readonly T[] | null | undefined,
  includeLocalSidecar: boolean,
  modelDisplayName?: string | null,
): Array<T | LocalSidecarConnectionOption> {
  const languageConnections = filterLanguageGenerationConnections(connections);
  if (!includeLocalSidecar || languageConnections.some((connection) => connection.id === LOCAL_SIDECAR_CONNECTION_ID)) {
    return languageConnections;
  }
  return [...languageConnections, createLocalSidecarConnectionOption(modelDisplayName)];
}
