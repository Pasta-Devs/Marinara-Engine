// ──────────────────────────────────────────────
// OpenAI (ChatGPT) plan usage
// ──────────────────────────────────────────────
//
// Reads the Codex rate-limit windows of the ChatGPT plan behind the host's
// `codex login`, for the subscription usage widget. This is the endpoint the
// Codex CLI reads for its own `/status` display (`get_rate_limits` in
// codex-rs/backend-client). It is a plain GET with the login's token, so a
// reading spends nothing from the plan.
//
// The windows count all Codex use on the account, and they are percentages
// only.

import type { PlanUsage, PlanUsageWindow } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { safeFetch } from "../../utils/security.js";
import { buildOpenAIChatGPTHeaders, getOpenAIChatGPTAuth } from "./openai-chatgpt-auth.js";
import { isRecord } from "../../utils/large-json.js";

const OPENAI_CHATGPT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

/** Usage reads are informational, so they fail fast rather than hold a handler open. */
const OPENAI_CHATGPT_USAGE_TIMEOUT_MS = 10_000;

/** A window at least this long is the weekly one; ChatGPT plans pair a 5-hour window with a 7-day one. */
const WEEKLY_WINDOW_MIN_SECONDS = 6 * 24 * 60 * 60;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ponytail: the two bars are labelled "5-hour" and "Weekly", so a window is
// sorted into one of those by its length. Upgrade path: if OpenAI changes the
// window lengths, carry `limit_window_seconds` to the widget and label from it.
function normalizeWindow(value: unknown): PlanUsageWindow | null {
  if (!isRecord(value)) return null;
  const usedPercent = finiteNumber(value.used_percent);
  const windowSeconds = finiteNumber(value.limit_window_seconds);
  const resetAtSeconds = finiteNumber(value.reset_at);
  return {
    id: windowSeconds !== null && windowSeconds >= WEEKLY_WINDOW_MIN_SECONDS ? "seven_day" : "five_hour",
    used: null,
    remaining: null,
    // The endpoint reports 0-100; the widget's windows carry fractions.
    percentUsed: usedPercent === null ? null : usedPercent / 100,
    resetAt: resetAtSeconds !== null && resetAtSeconds > 0 ? resetAtSeconds * 1000 : null,
    degraded: false,
  };
}

/** Normalize the usage answer. Returns null when it carries no rate-limit block at all. */
export function normalizeOpenAIChatGPTPlanUsage(raw: unknown): PlanUsage | null {
  if (!isRecord(raw) || !isRecord(raw.rate_limit)) return null;
  const byId = new Map<string, PlanUsageWindow>();
  for (const value of [raw.rate_limit.primary_window, raw.rate_limit.secondary_window]) {
    const window = normalizeWindow(value);
    // Two windows of the same kind would draw two bars with one label; keep the first.
    if (window && !byId.has(window.id)) byId.set(window.id, window);
  }
  return {
    provider: "openai_chatgpt",
    plan: typeof raw.plan_type === "string" ? raw.plan_type : null,
    windows: [...byId.values()].sort((a, b) => (a.id === b.id ? 0 : a.id === "five_hour" ? -1 : 1)),
  };
}

export async function fetchOpenAIChatGPTPlanUsage(): Promise<PlanUsage> {
  const auth = await getOpenAIChatGPTAuth();
  const res = await safeFetch(OPENAI_CHATGPT_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
      ...buildOpenAIChatGPTHeaders(auth),
    },
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
      flagName: "OPENAI_CHATGPT_AUTH",
    },
    maxResponseBytes: 1024 * 1024,
    decodeCompressedResponse: true,
    signal: AbortSignal.timeout(OPENAI_CHATGPT_USAGE_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Never log the token or the authorization header.
    logger.warn("[openai-chatgpt/usage] Plan usage request failed with %d", res.status);
    throw new Error(
      res.status === 401 || res.status === 403
        ? "ChatGPT rejected the Codex login. Run `codex login` on the Marinara host, then try again."
        : `ChatGPT returned ${res.status} for the plan usage lookup`,
    );
  }

  const usage = normalizeOpenAIChatGPTPlanUsage(await res.json());
  if (!usage) throw new Error("ChatGPT reported no plan limits for this login");
  logger.debug({ plan: usage.plan, windows: usage.windows }, "[openai-chatgpt/usage] plan usage");
  return usage;
}
