import { isProviderLocalUrlsEnabled } from "../../config/runtime-config.js";
import { isLocalInferenceBaseUrl } from "../../middleware/ip-allowlist.js";
import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";

type LocalConnection = { provider: string; baseUrl?: string | null; treatAsLocalEndpoint?: unknown };

export function canRefreshLocalContext(connection: LocalConnection): boolean {
  return (
    (connection.provider === "custom" || connection.provider === "openai") &&
    !!connection.baseUrl &&
    (isLocalInferenceBaseUrl(connection.baseUrl) ||
      connection.treatAsLocalEndpoint === true ||
      connection.treatAsLocalEndpoint === "true")
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Read configured runtime capacity, never the model's training window or shared cache size. */
export function readLocalContextLimit(value: unknown, endpoint: string): number | null {
  const data = record(value);
  const raw =
    endpoint === "/api/extra/true_max_context_length"
      ? data.value
      : endpoint === "/props"
        ? record(data.default_generation_settings).n_ctx
        : endpoint === "/v1/model"
          ? record(data.parameters).max_seq_len
          : (record(data.model_info).truncation_length ?? record(data.settings).truncation_length);
  const limit = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(limit) && limit > 0 ? limit : null;
}

export async function fetchLocalContextLimit(connection: LocalConnection & { apiKey: string }): Promise<number | null> {
  if (!canRefreshLocalContext(connection)) return null;
  let root: URL;
  try {
    root = new URL(connection.baseUrl!);
  } catch {
    return null;
  }
  root.pathname = root.pathname.replace(/\/(?:api\/)?v1\/?$/, "").replace(/\/+$/, "");
  root.search = "";
  root.hash = "";
  const endpoints = ["/props", "/api/extra/true_max_context_length", "/v1/model", "/v1/internal/model/info"];
  const limits = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await safeFetch(`${root.href.replace(/\/+$/, "")}${endpoint}`, {
          // Authenticated HTTP is normal for configured local providers. Every redirect stays on this exact origin.
          headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {},
          signal: AbortSignal.timeout(3000),
          maxResponseBytes: 128 * 1024,
          decodeCompressedResponse: true,
          policy: {
            allowLocal: isProviderLocalUrlsEnabled(),
            allowLoopback: true,
            allowMdns: true,
            allowedOrigins: [root.origin],
            allowedProtocols: ["http:", "https:"],
          },
        });
        return response.ok ? readLocalContextLimit(await response.json(), endpoint) : null;
      } catch (error) {
        logger.debug(error, "[connections] Local context metadata unavailable at %s", endpoint);
        return null;
      }
    }),
  );
  return limits.find((limit) => limit !== null) ?? null;
}
