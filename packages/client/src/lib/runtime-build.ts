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

/** How long the served-build probe waits for the server's answer. */
const RUNNING_BUILD_TIMEOUT_MS = 10_000;

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
  // A frozen server can take the connection and never answer, which would hold back the prompt
  // and the update both: past this it reads as unknown, as the startup version check does.
  timeoutMs = RUNNING_BUILD_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher("/api/health", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const health = (await res.json()) as Partial<RuntimeHealth> | null;
    if (!health?.version) return false;
    return isRuntimeBuildCurrent(clientVersion, clientBuild, health as RuntimeHealth);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
