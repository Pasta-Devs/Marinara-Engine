import {
  DECISION_SOURCE_BASE_URLS,
  decisionSourceTakesUrl,
  defaultDecisionStateTokens,
  resolveDecisionConnectionTimeoutMs,
} from "@marinara-engine/shared";

export interface DecisionConnectionRow {
  id: string;
  name?: string;
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
  /**
   * How the endpoint is asked. `system_one` posts to `/v1/systemone`; `chat_logprobs`
   * is an ordinary chat model at `/chat/completions`, answered the way a local slot is.
   */
  protocol: "system_one" | "chat_logprobs";
  endpoint: string;
  apiKey: string;
  model: string;
  maxStateTokens: number;
  /** The connection's own time limit. Unset on the managed sidecar, which has its own budget. */
  timeoutMs?: number;
}

export type DecisionConnectionError =
  "invalid_source" | "invalid_url" | "needs_relinking" | "missing_key" | "missing_model";

/**
 * The chat completions URL for a chat-model Decision connection.
 *
 * Takes the same base URL as the user's Custom chat connection (`http://host:11434/v1`),
 * so a key can be linked across by origin, and appends `/chat/completions` the way that
 * connection does. A bare host gets `/v1` too, and a full endpoint is kept as entered.
 */
export function decisionChatCompletionsUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  return new URL(trimmed).pathname.replace(/\/+$/, "")
    ? `${trimmed}/chat/completions`
    : `${trimmed}/v1/chat/completions`;
}

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
    // TypeSafe may be sent to another address that serves its API (#7084). It keeps
    // TypeSafe's key rules and defaults; a blank address is TypeSafe's own.
    const base = decisionSourceTakesUrl(source)
      ? row.baseUrl
      : (source === "typesafe" && row.baseUrl?.trim()) ||
        DECISION_SOURCE_BASE_URLS[source as "typesafe" | "openrouter"];
    endpoint = new URL(
      source === "openai_compatible" ? decisionChatCompletionsUrl(base) : `${base.replace(/\/+$/, "")}/v1/systemone`,
    );
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
    const expectedProvider = source === "openrouter" ? "openrouter" : decisionSourceTakesUrl(source) ? "custom" : null;
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
  if (!decisionSourceTakesUrl(source) && !apiKey.trim()) return { connection: null, error: "missing_key" };
  const chat = source === "openai_compatible";
  // A chat server serves many models and needs to be told which; "jev-latest" means
  // nothing to it, so there is no default to fall back on.
  if (chat && !row.model.trim()) return { connection: null, error: "missing_model" };
  return {
    connection: {
      protocol: chat ? "chat_logprobs" : "system_one",
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
      timeoutMs: resolveDecisionConnectionTimeoutMs(row.decisionTimeoutMs, source),
    },
  };
}
