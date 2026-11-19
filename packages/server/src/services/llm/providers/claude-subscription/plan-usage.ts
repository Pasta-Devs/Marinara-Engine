// ──────────────────────────────────────────────
// Claude (Subscription) plan usage
// ──────────────────────────────────────────────
//
// Reads the 5-hour and weekly rate-limit windows of the Claude plan that the
// host's `claude login` belongs to, for the subscription usage widget. This is
// the data behind Claude Code's own `/usage` command. It starts the Claude Code
// process, asks it one control question and stops it: no prompt is sent and no
// model runs, so a reading spends nothing from the plan.
//
// The windows count everything on the account (Claude Code, claude.ai and
// Marinara together), and they are percentages only — the plan reports no token
// counts.
//
// ponytail: the SDK marks this call experimental and says its name will change.
// It is kept to this one file, so an SDK bump that renames it fails `pnpm check`
// here. Upgrade path: switch to the stable name once the SDK has one.

import type { PlanUsage, PlanUsageWindow, PlanUsageWindowId } from "@marinara-engine/shared";
import { logger } from "../../../../lib/logger.js";
import { loadSdk } from "../claude-subscription.provider.js";
import { claudeCodeExecutableOption } from "./installed-cli.js";
import { isRecord } from "../../../../utils/large-json.js";

/** Usage reads are informational, so they fail fast rather than hold a handler open. */
const CLAUDE_PLAN_USAGE_TIMEOUT_MS = 15_000;

function normalizeWindow(id: PlanUsageWindowId, value: unknown): PlanUsageWindow | null {
  if (!isRecord(value)) return null;
  const utilization =
    typeof value.utilization === "number" && Number.isFinite(value.utilization) ? value.utilization : null;
  const resetAt = typeof value.resets_at === "string" ? Date.parse(value.resets_at) : Number.NaN;
  return {
    id,
    used: null,
    remaining: null,
    // The SDK reports 0-100; the widget's windows carry fractions.
    percentUsed: utilization === null ? null : utilization / 100,
    resetAt: Number.isFinite(resetAt) ? resetAt : null,
    degraded: false,
  };
}

/**
 * Normalize the SDK's usage answer. Returns null when plan limits do not apply
 * to the session (API-key billing, or a login without a plan).
 */
export function normalizeClaudePlanUsage(raw: unknown): PlanUsage | null {
  if (!isRecord(raw) || raw.rate_limits_available !== true || !isRecord(raw.rate_limits)) return null;
  const windows = [
    normalizeWindow("five_hour", raw.rate_limits.five_hour),
    normalizeWindow("seven_day", raw.rate_limits.seven_day),
  ].filter((window): window is PlanUsageWindow => window !== null);
  return {
    provider: "claude_subscription",
    plan: typeof raw.subscription_type === "string" ? raw.subscription_type : null,
    windows,
  };
}

async function readClaudePlanUsage(): Promise<PlanUsage> {
  const { query } = await loadSdk();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), CLAUDE_PLAN_USAGE_TIMEOUT_MS);
  // A prompt that never yields keeps the process open for the control question
  // without sending the model anything.
  async function* noPrompt(): AsyncGenerator<never> {
    await new Promise<void>((resolve) => abortController.signal.addEventListener("abort", () => resolve()));
  }
  try {
    const handle = query({
      prompt: noPrompt(),
      options: {
        abortController,
        tools: [],
        skills: [],
        settingSources: [],
        maxTurns: 1,
        // The same Claude Code the chat runs, so the login and version match.
        ...(await claudeCodeExecutableOption()),
        // No ANTHROPIC_API_KEY override: the plan windows belong to the login.
        env: { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
      },
    });
    const raw = await handle.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
    const usage = normalizeClaudePlanUsage(raw);
    if (!usage) {
      throw new Error(
        "Claude reported no plan limits for this login. Run `claude login` with a Pro or Max account as the same OS user as the Marinara server.",
      );
    }
    logger.debug({ plan: usage.plan, windows: usage.windows }, "[claude-subscription] plan usage");
    return usage;
  } catch (err) {
    if (abortController.signal.aborted) throw new Error("Claude Code did not answer the usage lookup in time");
    throw err;
  } finally {
    clearTimeout(timeout);
    abortController.abort();
  }
}

let inFlight: Promise<PlanUsage> | null = null;

/**
 * Read the plan windows. Every Claude (Subscription) connection shares the one
 * host login, so concurrent reads share one Claude Code process.
 */
export function fetchClaudePlanUsage(): Promise<PlanUsage> {
  inFlight ??= readClaudePlanUsage().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
