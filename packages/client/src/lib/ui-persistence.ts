export const UI_PERSISTENCE = { name: "marinara-engine-ui", version: 104 } as const;

// ponytail: package clients built before the host namespace (lib/marinara-host.ts) bundle their own copy of this
// store at v74 and save over this key with only the settings that copy knows. The Engine cannot stop that write, so
// each save also goes to a host-only copy, and a load ignores a blob older than this version while that copy is
// current. Ceiling: settings lost before this Engine ran cannot come back, and leaving an older Engine (before this
// copy existed) for this one brings back the settings saved here before, not the ones changed there. Remove it once
// no supported package bundles the UI store.
export const UI_PERSISTENCE_HOST_COPY = `${UI_PERSISTENCE.name}:host`;

function storedVersion(raw: string | null): number | null {
  try {
    const parsed = raw ? (JSON.parse(raw) as { state?: unknown; version?: unknown } | null) : null;
    return parsed?.state && typeof parsed.state === "object" && typeof parsed.version === "number"
      ? parsed.version
      : null;
  } catch {
    return null;
  }
}

/** The saved UI settings to load: the host copy when an older blob has replaced the Engine's own save. */
export function readUIPersistence(stored: string | null, hostCopy: string | null): string | null {
  const version = storedVersion(stored);
  return version !== null && version < UI_PERSISTENCE.version && storedVersion(hostCopy) === UI_PERSISTENCE.version
    ? hostCopy
    : stored;
}
