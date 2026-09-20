// ──────────────────────────────────────────────
// Service: MuAPI image helpers
// ──────────────────────────────────────────────

export const DEFAULT_MUAPI_BASE_URL = "https://api.muapi.ai/v1";

export type MuApiEndpoint = "models" | "images/generations";

export type MuApiModel = {
  id: string;
  name: string;
};

/**
 * Build an OpenAI-compatible MuAPI endpoint from either the documented /v1
 * base URL or a root URL pasted into the connection editor.
 */
export function buildMuApiUrl(baseUrl: string, endpoint: MuApiEndpoint): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const targetPath = `/${endpoint}`;

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (/\/(?:models|images\/generations)$/i.test(path)) {
      parsed.pathname = path.replace(/\/(?:models|images\/generations)$/i, targetPath);
    } else if (path === "" || path === "/") {
      parsed.pathname = `/v1${targetPath}`;
    } else if (path.endsWith("/api/v1")) {
      parsed.pathname = `${path.slice(0, -"/api/v1".length)}/v1${targetPath}`;
    } else if (path.endsWith("/api")) {
      parsed.pathname = `${path.slice(0, -"/api".length)}/v1${targetPath}`;
    } else if (path.endsWith("/v1")) {
      parsed.pathname = `${path}${targetPath}`;
    } else {
      parsed.pathname = `${path}${targetPath}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return `${trimmed}${targetPath}`;
  }
}

/** Parse the OpenAI-compatible { data: [{ id, name? }] } model response. */
export function parseMuApiModels(payload: unknown): MuApiModel[] | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;

  const seen = new Set<string>();
  const models: MuApiModel[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as { id?: unknown; name?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seen.has(id)) continue;
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : id;
    seen.add(id);
    models.push({ id, name });
  }
  return models;
}
