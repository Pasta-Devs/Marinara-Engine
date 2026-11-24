/**
 * A Model's own address: the Connection's server with a path of the Model's own. Some proxies serve each model
 * family on its own path ("/proxy/google-ai", "/proxy/zai"), so the field takes either the full address
 * ("https://host/proxy/zai") or only the path ("/proxy/zai" or "proxy/zai"), which is read against the
 * Connection's server. A path survives the server's address changing (a quick tunnel's new name); either form
 * only ever reaches the Connection's own server, because the Model sends the Connection's key.
 */

/** Only path characters: no "//host", "\host", "user@", spaces or a scheme can sneak another server in. */
const PATH_ONLY = /^\/?(?!\/)[A-Za-z0-9._~%+\-/]*$/u;

/** Whether the value is the path form (not a full address). */
export function isModelAddressPath(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return !!trimmed && !/^[a-z][a-z0-9+.-]*:/iu.test(trimmed);
}

function originOf(address: string): string | null {
  try {
    const url = new URL(address.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The full address a Model's own address stands for on its Connection's server, or null when it is empty,
 * malformed, or on another server.
 */
export function resolveModelAddress(
  own: string | null | undefined,
  connectionBaseUrl: string | null | undefined,
): string | null {
  const value = own?.trim();
  const origin = originOf(connectionBaseUrl ?? "");
  if (!value || !origin) return null;
  if (!isModelAddressPath(value)) return originOf(value) === origin ? value : null;
  if (!PATH_ONLY.test(value)) return null;
  const path = value.replace(/^\/+/u, "");
  if (!path) return null;
  const resolved = `${origin}/${path}`;
  // Belt and braces: the parsed result must still be on the Connection's server.
  return originOf(resolved) === origin ? resolved : null;
}

/** The path form of a full address ("https://host/proxy/zai" -> "/proxy/zai"), so it can move with its server. */
export function modelAddressPathOf(address: string): string | null {
  try {
    const url = new URL(address.trim());
    if (url.search || url.hash) return null;
    const path = url.pathname.replace(/\/+$/u, "");
    return path && PATH_ONLY.test(path) ? path : null;
  } catch {
    return null;
  }
}
