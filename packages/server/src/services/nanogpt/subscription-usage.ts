// ──────────────────────────────────────────────
// NanoGPT Subscription Usage
// ──────────────────────────────────────────────
//
// NanoGPT exposes subscription quotas on two different hosts with two different
// credentials, and neither URL is derivable from a stored connection base URL:
//
//   inference API key  → https://api.nano-gpt.com/api/subscription/v1/usage
//   management token   → https://nano-gpt.com/api/management/v1/subscription/usage
//
// A management token is rejected by the inference endpoint, and an inference key
// is not accepted by the management endpoint. The management token is therefore
// preferred when present because its `usage:read` scope cannot spend balance.
//
// Docs: https://docs.nano-gpt.com/api-reference/management-api#read-subscription-usage

import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";

/** The usage endpoint host for management tokens (no `api.` prefix). */
const NANOGPT_MANAGEMENT_USAGE_URL = "https://nano-gpt.com/api/management/v1/subscription/usage";

/** The provider id for readings this module returns. */
const NANOGPT_PROVIDER_ID = "nanogpt";

/** The usage endpoint host for inference API keys. */
const NANOGPT_INFERENCE_USAGE_URL = "https://api.nano-gpt.com/api/subscription/v1/usage";

/** One quota window: used / remaining / percentUsed (a fraction) / resetAt (epoch ms). */
export interface NanoGptQuotaWindow {
  used: number | null;
  remaining: number | null;
  /** A fraction, not a percentage, and it may exceed 1. */
  percentUsed: number | null;
  /** UNIX epoch milliseconds. */
  resetAt: number | null;
  /** True when the lookup was unavailable; counters are null and must read as "unknown". */
  degraded: boolean;
}

export interface NanoGptSubscriptionUsage {
  active: boolean;
  state: string;
  limits: {
    dailyInputTokens: number | null;
    weeklyInputTokens: number | null;
    dailyImages: number | null;
  };
  dailyInputTokens: NanoGptQuotaWindow | null;
  weeklyInputTokens: NanoGptQuotaWindow | null;
  dailyImages: NanoGptQuotaWindow | null;
  /** ISO timestamp or null. */
  currentPeriodEnd: string | null;
  /** Which credential answered, so the UI can explain a scope-related failure. */
  credential: "management_token" | "api_key";
  /**
   * The provider this reading belongs to, so the UI labels the meter from data
   * rather than from its own name for NanoGPT.
   */
  provider: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export interface NanoGptModelSubscriptionMetadata {
  /** True when the model is covered by the account's subscription. */
  subscriptionIncluded?: boolean;
  /** Input tokens charged per token of subscription quota (2 = 2x). */
  inputTokenMultiplier?: number;
}

/**
 * Read NanoGPT's `subscription` block from a detailed model record.
 *
 * `inputTokenMultiplier` is returned only for subscription-included models:
 * excluded models report `1`, which would otherwise read as full coverage. The
 * field is undocumented in NanoGPT's published schema, so read it defensively.
 */
export function readNanoGptModelSubscriptionMetadata(model: Record<string, unknown>): NanoGptModelSubscriptionMetadata {
  const subscription = isRecord(model.subscription) ? model.subscription : null;
  if (!subscription) return {};

  const included = typeof subscription.included === "boolean" ? subscription.included : undefined;
  const multiplier =
    typeof subscription.inputTokenMultiplier === "number" && Number.isFinite(subscription.inputTokenMultiplier)
      ? subscription.inputTokenMultiplier
      : undefined;

  return {
    ...(included !== undefined ? { subscriptionIncluded: included } : {}),
    ...(included === true && multiplier !== undefined ? { inputTokenMultiplier: multiplier } : {}),
  };
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Normalize one quota window. Returns null when the window is absent or not an
 * object, which means "not configured" — deliberately distinct from a window
 * whose counters are null and `degraded: true`, which means "unknown".
 */
export function normalizeQuotaWindow(value: unknown): NanoGptQuotaWindow | null {
  if (!isRecord(value)) return null;
  return {
    used: readFiniteNumber(value.used),
    remaining: readFiniteNumber(value.remaining),
    percentUsed: readFiniteNumber(value.percentUsed),
    resetAt: readFiniteNumber(value.resetAt),
    degraded: value.degraded === true,
  };
}

/**
 * Normalize the raw usage payload. Accepts the shared shape returned by both the
 * management and inference endpoints; the inference endpoint adds `routing`,
 * which this widget does not surface.
 */
export function normalizeSubscriptionUsage(
  raw: unknown,
  credential: NanoGptSubscriptionUsage["credential"],
  provider = "nanogpt",
): NanoGptSubscriptionUsage | null {
  if (!isRecord(raw)) return null;

  const limits = isRecord(raw.limits) ? raw.limits : {};
  const period = isRecord(raw.period) ? raw.period : {};

  return {
    active: raw.active === true,
    state: typeof raw.state === "string" ? raw.state : "unknown",
    limits: {
      dailyInputTokens: readFiniteNumber(limits.dailyInputTokens),
      weeklyInputTokens: readFiniteNumber(limits.weeklyInputTokens),
      dailyImages: readFiniteNumber(limits.dailyImages),
    },
    dailyInputTokens: normalizeQuotaWindow(raw.dailyInputTokens),
    weeklyInputTokens: normalizeQuotaWindow(raw.weeklyInputTokens),
    dailyImages: normalizeQuotaWindow(raw.dailyImages),
    currentPeriodEnd: typeof period.currentPeriodEnd === "string" ? period.currentPeriodEnd : null,
    credential,
    provider,
  };
}

export interface FetchNanoGptUsageOptions {
  /** Preferred: a `usage:read` management token. */
  managementToken?: string | null;
  /** Fallback: the connection's inference API key. */
  apiKey?: string | null;
}

/**
 * Read subscription usage. Prefers the management token so a widget-only
 * credential is used where possible; falls back to the inference key.
 *
 * Returns null when neither credential is available.
 * Throws on transport or non-OK responses.
 */
export async function fetchNanoGptSubscriptionUsage(
  options: FetchNanoGptUsageOptions,
): Promise<NanoGptSubscriptionUsage | null> {
  const managementToken = options.managementToken?.trim() ?? "";
  const apiKey = options.apiKey?.trim() ?? "";

  const useManagementToken = managementToken.length > 0;
  const credential: NanoGptSubscriptionUsage["credential"] = useManagementToken ? "management_token" : "api_key";
  const token = useManagementToken ? managementToken : apiKey;

  if (!token) return null;

  const url = useManagementToken ? NANOGPT_MANAGEMENT_USAGE_URL : NANOGPT_INFERENCE_USAGE_URL;

  const response = await safeFetch(url, {
    method: "GET",
    headers: {
      // The management API accepts only the Authorization header form.
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    // Never log the token or the authorization header.
    logger.warn("[nanogpt/usage] Subscription usage request failed with %d using %s", response.status, credential);
    throw new Error(describeUsageError(response.status, text, useManagementToken));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("NanoGPT returned invalid JSON for subscription usage");
  }

  return normalizeSubscriptionUsage(parsed, credential, NANOGPT_PROVIDER_ID);
}

/** Turn a status code into an actionable, non-secret-bearing message. */
export function describeUsageError(status: number, body: string, usedManagementToken: boolean): string {
  if (status === 401) {
    return usedManagementToken
      ? "NanoGPT rejected the management token (invalid, expired, or revoked)."
      : "NanoGPT rejected the API key. Check the key and try again.";
  }
  if (status === 403) {
    return "This management token lacks the usage:read scope. Create a token with Usage only access.";
  }
  if (status === 429) {
    return "NanoGPT rate limited the usage request. Try again shortly.";
  }
  if (status === 503) {
    return "NanoGPT is temporarily unable to report usage. Try again shortly.";
  }

  const trimmed = body.trim().slice(0, 200);
  return `NanoGPT returned ${status}${trimmed ? `: ${trimmed}` : ""}`;
}
