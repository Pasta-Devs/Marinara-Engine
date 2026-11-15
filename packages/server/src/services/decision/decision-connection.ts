import {
  DECISION_SOURCE_BASE_URLS,
  NATIVE_DECISION_SOURCES,
  PROVIDERS,
  speaksOpenAIChat,
  type APIProvider,
  decisionSourcePath,
  decisionSourceTakesUrl,
  defaultDecisionStateTokens,
  normalizeCustomRequestHeaders,
  resolveDecisionConnectionTimeoutMs,
} from "@marinara-engine/shared";
import { decryptCustomHeaders } from "../../utils/stored-secrets.js";

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
  /** The Model's settings JSON; only its Custom Request Headers apply to a decision request. */
  defaultParameters?: string | null;
  /**
   * The Connection it belongs to, filled in by the storage for decision rows with an account, with what that
   * Connection's catalog says about the model: a decision model (NanoGPT's `decisions` output) and its context.
   */
  account?: { provider: string; baseUrl: string; decisionModel?: boolean; context?: number } | null;
}

export interface DecisionConnection {
  /**
   * How the endpoint is asked. `system_one` posts the System One body (to `/v1/systemone`, or
   * NanoGPT's `/v1/decisions`); `chat_logprobs` is an ordinary chat model at `/chat/completions`,
   * answered the way a local slot is.
   */
  protocol: "system_one" | "chat_logprobs";
  endpoint: string;
  apiKey: string;
  model: string;
  maxStateTokens: number;
  /** The connection's own time limit. Unset on the managed sidecar, which has its own budget. */
  timeoutMs?: number;
  /** The Model's non-secret Custom Request Headers, such as NanoGPT's `x-billing-mode`. */
  headers?: Record<string, string>;
  /** Gemini's Decisions API: `input` for the state, `x-goog-api-key` for the key, plain ids for the questions. */
  dialect?: "gemini";
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

/** The Custom Request Headers saved in a Model's settings, validated like a chat Model's. Bad JSON sends none. */
function customHeadersOf(defaultParameters: string | null | undefined): Record<string, string> | undefined {
  if (!defaultParameters) return undefined;
  try {
    const parsed = JSON.parse(defaultParameters) as { customHeaders?: unknown } | null;
    // Header values are stored encrypted (and older rows plain); requests get the usable values.
    const headers = parsed?.customHeaders;
    return normalizeCustomRequestHeaders(
      headers && typeof headers === "object" && !Array.isArray(headers)
        ? decryptCustomHeaders(headers as Record<string, string>)
        : headers,
    );
  } catch {
    return undefined;
  }
}

/**
 * The default chat budget, capped below a model's own context when its catalog gives one: Clef takes 1,800
 * tokens in all, and a request past a model's context gives no answer. A quarter is left for the questions.
 */
function catalogStateBudget(fallback: number, context: number | undefined): number {
  return context && context > 0 ? Math.min(fallback, Math.max(1, Math.floor(context * 0.75))) : fallback;
}

/** Always resolve keys on use, so key rotation and import quarantine apply immediately. */
export async function resolveDecisionConnection(
  row: DecisionConnectionRow,
  getWithKey: (id: string) => Promise<DecisionConnectionRow | null>,
): Promise<{ connection: DecisionConnection; error?: never } | { connection: null; error: DecisionConnectionError }> {
  if (row.provider !== "decision") return { connection: null, error: "invalid_source" };
  // A Model under a vendor's Connection asks that vendor in OpenAI-style chat and reads the
  // log-probabilities, at the Connection's address. Older rows (and Connections of the old
  // "Decision" kind) keep their own source.
  const vendor = row.account && row.account.provider !== "decision" ? row.account.provider : null;
  const native = vendor ? NATIVE_DECISION_SOURCES[vendor as APIProvider] : undefined;
  const nativeDecisions = !!native && (row.decisionSource === native || row.account?.decisionModel === true);
  // A vendor that does not speak OpenAI chat (Gemini) has no log-probabilities: only its native decision model works.
  if (vendor && !speaksOpenAIChat(vendor) && !nativeDecisions) return { connection: null, error: "invalid_source" };
  if (vendor && vendor !== "custom" && !row.apiKey.trim()) return { connection: null, error: "missing_key" };
  // NanoGPT's decision models answer only at its Decisions API and reject chat requests (#9310); OpenRouter's
  // answer at its System One endpoint. A chat model of either picked for decisions keeps the log-probability path.
  // The account's catalog entry says so too, so a row any picker made for a native decision model is asked right.
  const source = nativeDecisions ? native : vendor ? "openai_compatible" : (row.decisionSource ?? "typesafe");
  if (!Object.hasOwn(DECISION_SOURCE_BASE_URLS, source)) {
    return { connection: null, error: "invalid_source" };
  }
  let endpoint: URL;
  try {
    // TypeSafe may be sent to another address that serves its API (#7084). It keeps
    // TypeSafe's key rules and defaults; a blank address is TypeSafe's own.
    // A native account's chat address ends in /api/v1 (NanoGPT, OpenRouter); its decision endpoint is under the
    // same /api. The path before /v1 is kept, so a gateway prefix (…/openrouter/api/v1) still applies; an address
    // without /v1 falls back to the host's /api.
    const accountBase = row.account?.baseUrl.trim() || PROVIDERS[vendor as APIProvider]?.defaultBaseUrl || "";
    const nativeBase = () => {
      const url = new URL(accountBase);
      const path = url.pathname.replace(/\/+$/, "");
      return /\/v1$/.test(path) ? `${url.origin}${path.slice(0, -3)}` : `${url.origin}/api`;
    };
    // A google row without an account (imported, or its account removed) asks Google's own address.
    const googleBase = accountBase || DECISION_SOURCE_BASE_URLS.google;
    const base =
      source === "google"
        ? // Gemini's decision endpoint sits under the account's /v1beta root.
          (googleBase.match(/^(.*?\/v1beta)(?:\/|$)/)?.[1] ?? `${googleBase.replace(/\/+$/, "")}/v1beta`)
        : nativeDecisions
          ? nativeBase()
          : vendor
            ? accountBase
            : decisionSourceTakesUrl(source)
              ? row.baseUrl
              : (source === "typesafe" && row.baseUrl?.trim()) ||
                DECISION_SOURCE_BASE_URLS[source as "typesafe" | "openrouter" | "nanogpt"];
    endpoint = new URL(
      source === "openai_compatible"
        ? decisionChatCompletionsUrl(base)
        : `${base.replace(/\/+$/, "")}${decisionSourcePath(source)}`,
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
    const expectedProvider =
      source === "openrouter" || source === "nanogpt" ? source : decisionSourceTakesUrl(source) ? "custom" : null;
    try {
      const linkedOrigin = new URL(
        linked.baseUrl ||
          (linked.provider === "openrouter" || linked.provider === "nanogpt"
            ? DECISION_SOURCE_BASE_URLS[linked.provider]
            : ""),
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
  const headers = customHeadersOf(row.defaultParameters);
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
            : catalogStateBudget(
                defaultDecisionStateTokens(source),
                nativeDecisions ? row.account?.context : undefined,
              ),
        ),
      ),
      timeoutMs: resolveDecisionConnectionTimeoutMs(row.decisionTimeoutMs, source),
      ...(headers ? { headers } : {}),
      ...(source === "google" ? { dialect: "gemini" as const } : {}),
    },
  };
}
