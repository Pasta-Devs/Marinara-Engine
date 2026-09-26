import assert from "node:assert/strict";
import {
  describeUsageError,
  normalizeQuotaWindow,
  normalizeSubscriptionUsage,
  readNanoGptModelSubscriptionMetadata,
} from "../../packages/server/src/services/nanogpt/subscription-usage.js";

// ── Model subscription metadata ───────────────────────────────────────────────
// Shapes below are trimmed from real `GET /api/v1/models?detailed=true` output.
// `subscription.inputTokenMultiplier` is undocumented in NanoGPT's published
// schema, so these fixtures are the contract this parse is written against.

const includedModel = {
  id: "z-ai/glm-5.3-flash-uncensored",
  context_length: 1048576,
  max_output_tokens: 32768,
  pricing: { prompt: 0.25, completion: 1, currency: "USD", unit: "per_million_tokens" },
  subscription: { included: true, inputTokenMultiplier: 2, note: "Included in subscription" },
};
assert.deepEqual(readNanoGptModelSubscriptionMetadata(includedModel), {
  subscriptionIncluded: true,
  inputTokenMultiplier: 2,
});

const excludedModel = {
  id: "inference-net/schematron-v2-small",
  pricing: { prompt: 0.05, completion: 0.23 },
  subscription: { included: false, inputTokenMultiplier: 1, note: "Not included in subscription" },
};
// An excluded model reports 1, which must NOT be surfaced as a multiplier:
// it would read as "1x, fully covered by your subscription" when it is not.
assert.deepEqual(readNanoGptModelSubscriptionMetadata(excludedModel), { subscriptionIncluded: false });

// A model without the block, and malformed shapes, must not throw or invent data.
assert.deepEqual(readNanoGptModelSubscriptionMetadata({ id: "openai/gpt-5.6-sol" }), {});
assert.deepEqual(readNanoGptModelSubscriptionMetadata({ subscription: null }), {});
assert.deepEqual(readNanoGptModelSubscriptionMetadata({ subscription: "nope" }), {});
assert.deepEqual(readNanoGptModelSubscriptionMetadata({ subscription: {} }), {});
assert.deepEqual(readNanoGptModelSubscriptionMetadata({ subscription: { included: true } }), {
  subscriptionIncluded: true,
});
assert.deepEqual(
  readNanoGptModelSubscriptionMetadata({ subscription: { included: true, inputTokenMultiplier: "2" } }),
  { subscriptionIncluded: true },
  "a string multiplier is not a number and must be ignored",
);
assert.deepEqual(
  readNanoGptModelSubscriptionMetadata({ subscription: { included: true, inputTokenMultiplier: NaN } }),
  { subscriptionIncluded: true },
  "NaN must not become a multiplier pill",
);

// ── Quota windows ─────────────────────────────────────────────────────────────

const weekly = normalizeQuotaWindow({
  used: 1_500_000,
  remaining: 4_500_000,
  percentUsed: 0.25,
  resetAt: 1_788_739_200_000,
});
assert.deepEqual(weekly, {
  used: 1_500_000,
  remaining: 4_500_000,
  percentUsed: 0.25,
  resetAt: 1_788_739_200_000,
  degraded: false,
});

// percentUsed is a FRACTION and may exceed 1; the raw value is preserved and
// clamping is the renderer's job.
assert.equal(normalizeQuotaWindow({ used: 12, remaining: 0, percentUsed: 1.8, resetAt: null })?.percentUsed, 1.8);

// A degraded window keeps null counters and flags unknown, so the UI can refuse
// to draw a bar rather than implying a full allowance.
assert.deepEqual(
  normalizeQuotaWindow({ used: null, remaining: null, percentUsed: null, resetAt: null, degraded: true }),
  {
    used: null,
    remaining: null,
    percentUsed: null,
    resetAt: null,
    degraded: true,
  },
);

// Absent / non-object windows mean "not configured", which is distinct from unknown.
assert.equal(normalizeQuotaWindow(null), null);
assert.equal(normalizeQuotaWindow(undefined), null);
assert.equal(normalizeQuotaWindow("1000"), null);

// ── Full payload ──────────────────────────────────────────────────────────────
// Trimmed from the documented management-token response example.

const usage = normalizeSubscriptionUsage(
  {
    active: true,
    state: "active",
    limits: { dailyInputTokens: 1_000_000, weeklyInputTokens: 6_000_000, dailyImages: 10 },
    dailyInputTokens: { used: 250_000, remaining: 750_000, percentUsed: 0.25, resetAt: 1_788_652_800_000 },
    weeklyInputTokens: { used: 1_500_000, remaining: 4_500_000, percentUsed: 0.25, resetAt: 1_788_739_200_000 },
    dailyImages: { used: 2, remaining: 8, percentUsed: 0.2, resetAt: 1_788_652_800_000 },
    period: { currentPeriodEnd: "2026-10-05T00:00:00.000Z" },
  },
  "management_token",
);

assert.ok(usage);
assert.equal(usage.active, true);
assert.equal(usage.state, "active");
assert.equal(usage.credential, "management_token");
assert.equal(usage.limits.weeklyInputTokens, 6_000_000);
assert.equal(usage.weeklyInputTokens?.percentUsed, 0.25);
assert.equal(usage.dailyImages?.used, 2);
assert.equal(usage.currentPeriodEnd, "2026-10-05T00:00:00.000Z");

// The inference-key payload adds `routing`; it must be tolerated and ignored.
const inferenceUsage = normalizeSubscriptionUsage(
  {
    active: true,
    state: "grace",
    limits: { dailyInputTokens: null, weeklyInputTokens: 60_000_000, dailyImages: null },
    weeklyInputTokens: { used: 30_000_000, remaining: 30_000_000, percentUsed: 0.5, resetAt: null },
    routing: { recommendedMode: "subscription", reason: "quota available", subscriptionQuotaAvailable: true },
  },
  "api_key",
);
assert.ok(inferenceUsage);
assert.equal(inferenceUsage.credential, "api_key");
assert.equal(inferenceUsage.state, "grace");
assert.equal(inferenceUsage.weeklyInputTokens?.percentUsed, 0.5);
assert.equal("routing" in inferenceUsage, false, "billing-routing advice is not part of this widget's contract");

// A null weekly window stays null ("not configured") instead of becoming zero usage.
assert.equal(inferenceUsage.dailyInputTokens, null);
assert.equal(inferenceUsage.limits.dailyInputTokens, null);

// Malformed payloads return null rather than a half-built object.
assert.equal(normalizeSubscriptionUsage(null, "api_key"), null);
assert.equal(normalizeSubscriptionUsage("nope", "api_key"), null);
assert.equal(normalizeSubscriptionUsage([], "api_key"), null);

// A payload missing optional blocks must still normalize to a usable shape.
const minimal = normalizeSubscriptionUsage({ active: false, state: "inactive" }, "api_key");
assert.ok(minimal);
assert.equal(minimal.active, false);
assert.equal(minimal.weeklyInputTokens, null);
assert.equal(minimal.dailyImages, null);
assert.equal(minimal.currentPeriodEnd, null);
assert.deepEqual(minimal.limits, { dailyInputTokens: null, weeklyInputTokens: null, dailyImages: null });

// ── Error messages ────────────────────────────────────────────────────────────
// Every branch must be actionable and must never echo a credential.

assert.match(describeUsageError(401, "", true), /management token/i);
assert.match(describeUsageError(401, "", false), /API key/i);
assert.match(describeUsageError(403, "", true), /usage:read/);
assert.match(describeUsageError(429, "", true), /rate limited/i);
assert.match(describeUsageError(503, "", true), /temporarily/i);
assert.match(describeUsageError(500, "boom", true), /500: boom/);
// A long provider error body is truncated.
assert.ok(describeUsageError(500, "x".repeat(500), true).length < 260);

assert.equal(normalizeSubscriptionUsage({ active: "yes", state: 5 }, "api_key")?.active, false);
assert.equal(normalizeSubscriptionUsage({ active: "yes", state: 5 }, "api_key")?.state, "unknown");

console.info("[regression] nanogpt subscription usage: model metadata, quota windows, errors OK");
