import {
  DECISION_SOURCE_BASE_URLS,
  defaultDecisionStateTokens,
  resolveDecisionConnectionTimeoutMs,
} from "@marinara-engine/shared";

export interface DecisionConnectionRow {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  decisionSource?: string | null;
  credentialsFromConnectionId?: string | null;
  maxStateTokens?: number | null;
  decisionTimeoutMs?: number | null;
}

export interface DecisionConnection {
  endpoint: string;
  apiKey: string;
  model: string;
  maxStateTokens: number;
  /** The connection's own time limit. Unset on the managed sidecar, which has its own budget. */
  timeoutMs?: number;
}

export type DecisionConnectionError = "invalid_source" | "invalid_url" | "needs_relinking" | "missing_key";

/** Always resolve keys on use, so key rotation and import quarantine apply immediately. */
export async function resolveDecisionConnection(
  row: DecisionConnectionRow,
  getWithKey: (id: string) => Promise<DecisionConnectionRow | null>,
): Promise<{ connection: DecisionConnection; error?: never } | { connection: null; error: DecisionConnectionError }> {
  const source = row.decisionSource ?? "typesafe";
  if (row.provider !== "decision" || !Object.hasOwn(DECISION_SOURCE_BASE_URLS, source)) {
    return { connection: null, error: "invalid_source" };
  }
  let endpoint: URL;
  try {
    const base = source === "custom" ? row.baseUrl : DECISION_SOURCE_BASE_URLS[source as "typesafe" | "openrouter"];
    endpoint = new URL(`${base.replace(/\/+$/, "")}/v1/systemone`);
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      return { connection: null, error: "invalid_url" };
    }
  } catch {
    return { connection: null, error: "invalid_url" };
  }
  let apiKey = row.apiKey;
  if (row.credentialsFromConnectionId) {
    const linked = await getWithKey(row.credentialsFromConnectionId);
    if (!linked || linked.id === row.id || linked.credentialsFromConnectionId) {
      return { connection: null, error: "needs_relinking" };
    }
    // A link never lends a provider key to another host, including after either row is edited.
    const expectedProvider = source === "openrouter" ? "openrouter" : source === "custom" ? "custom" : null;
    try {
      const linkedOrigin = new URL(
        linked.baseUrl || (linked.provider === "openrouter" ? DECISION_SOURCE_BASE_URLS.openrouter : ""),
      ).origin;
      if (!expectedProvider || linked.provider !== expectedProvider || linkedOrigin !== endpoint.origin) {
        return { connection: null, error: "needs_relinking" };
      }
    } catch {
      return { connection: null, error: "needs_relinking" };
    }
    apiKey = linked.apiKey;
  }
  if (source !== "custom" && !apiKey.trim()) return { connection: null, error: "missing_key" };
  return {
    connection: {
      endpoint: endpoint.href,
      apiKey,
      model: row.model.trim() || "jev-latest",
      maxStateTokens: Math.min(
        30000,
        Math.max(
          1,
          typeof row.maxStateTokens === "number" && Number.isFinite(row.maxStateTokens)
            ? Math.floor(row.maxStateTokens)
            : defaultDecisionStateTokens(source),
        ),
      ),
      timeoutMs: resolveDecisionConnectionTimeoutMs(row.decisionTimeoutMs),
    },
  };
}
