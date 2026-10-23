export type RuntimeHealth = {
  version: string;
  build?: string | null;
};

export function formatRuntimeBuild(version: string, commit: string | null) {
  return commit ? `${version}+${commit}` : version;
}

export function getServerRuntimeBuild(health: RuntimeHealth) {
  return health.build?.trim() || health.version;
}

export function isRuntimeBuildCurrent(clientVersion: string, clientBuild: string, health: RuntimeHealth) {
  const serverBuild = health.build?.trim();
  if (!serverBuild || serverBuild === health.version) {
    return health.version === clientVersion;
  }

  return serverBuild === clientBuild;
}

/**
 * Whether the server still serves the build this page runs. A new service worker waiting after a
 * server restart says nothing about the page itself: a page loaded after the new build was already
 * serving is that build, and asking it to refresh would be a false alarm (playtest 2026-10-23).
 * Unknown (no answer, an untrusted caller's bare health) reads as not served, so the prompt shows.
 */
export async function runningBuildIsServed(
  clientVersion: string,
  clientBuild: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<boolean> {
  try {
    const res = await fetcher("/api/health", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const health = (await res.json()) as Partial<RuntimeHealth> | null;
    if (!health?.version) return false;
    return isRuntimeBuildCurrent(clientVersion, clientBuild, health as RuntimeHealth);
  } catch {
    return false;
  }
}
