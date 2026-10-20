import assert from "node:assert/strict";
import { connectionBalanceSource, modelCost } from "../../packages/shared/src/index.js";
import {
  fetchConnectionBalance,
  parseDeepSeekBalance,
  parseLinkApiAccount,
  parseLinkApiKeyUsage,
  parseMoonshotBalance,
  parseOpenRouterKey,
} from "../../packages/server/src/services/connections/balance.js";
import {
  linkApiPrices,
  modelsDevPrice,
  parseLinkApiPricing,
  parseLinkApiStatus,
  parseModelsDev,
} from "../../packages/server/src/services/connections/price-catalog.js";

// All HTTP answers below are made up; no credential is used.
const status = parseLinkApiStatus({
  data: { quota_per_unit: 500000, quota_display_type: "CNY", usd_exchange_rate: 1 },
});
assert.deepEqual(status, { quotaPerUnit: 500000, unit: "CNY", rate: 1 });

// ── Which Connections have a balance ──
assert.equal(connectionBalanceSource({ provider: "custom", baseUrl: "https://linkapi.ai/v1" }), "linkapi");
assert.equal(connectionBalanceSource({ provider: "custom", baseUrl: "https://api.linkapi.ai/v1" }), "linkapi");
assert.equal(connectionBalanceSource({ provider: "custom", baseUrl: "https://notlinkapi.ai/v1" }), null);
assert.equal(connectionBalanceSource({ provider: "openrouter" }), "openrouter");
assert.equal(connectionBalanceSource({ provider: "deepseek" }), "deepseek");
assert.equal(connectionBalanceSource({ provider: "custom", baseUrl: "https://api.moonshot.cn/v1" }), "moonshot");
assert.equal(connectionBalanceSource({ provider: "openai" }), null);

// ── LinkAPI prices ──
const pricing = parseLinkApiPricing({
  data: [
    // Plain ratios: input = ratio × 2, output/cache by ratio.
    { model_name: "claude-sonnet-4-6-r", quota_type: 0, model_ratio: 0.75, completion_ratio: 5, cache_ratio: 0.1, create_cache_ratio: 1.25 },
    // A tiered expression names the base prices directly.
    {
      model_name: "claude-opus-5-r",
      quota_type: 0,
      model_ratio: 9,
      completion_ratio: 9,
      billing_mode: "tiered_expr",
      billing_expr: 'tier("base", p * 2.5 + c * 12.5 + cr * 0.25 + cc * 3.125 + cc1h * 5)',
    },
    // Per call.
    { model_name: "image-model", quota_type: 1, model_price: 0.3, billing_mode: "tiered_expr", billing_expr: 'tier("image", fixed(0.2))' },
  ],
  group_ratio: { default: 1, Deepseek: 0.2, ClaudeMax: 1.6 },
});
const base = linkApiPrices(pricing, status, undefined, "2026-10-20T00:00:00.000Z");
assert.deepEqual(base.get("claude-sonnet-4-6-r"), {
  currency: "CNY",
  source: "linkapi",
  fetchedAt: "2026-10-20T00:00:00.000Z",
  beforeGroupDiscount: true,
  prompt: 1.5,
  completion: 7.5,
  cacheRead: 0.15,
  cacheWrite: 1.875,
});
assert.deepEqual(
  [base.get("claude-opus-5-r")?.prompt, base.get("claude-opus-5-r")?.completion, base.get("claude-opus-5-r")?.cacheRead, base.get("claude-opus-5-r")?.cacheWrite],
  [2.5, 12.5, 0.25, 3.125],
);
assert.equal(base.get("image-model")?.perCall, 0.3);
assert.equal(modelCost({ pricing: base.get("image-model") }, null), "paid");
// A known group multiplies and drops the "before group discount" mark.
const grouped = linkApiPrices(pricing, status, "ClaudeMax", "x");
assert.equal(grouped.get("claude-sonnet-4-6-r")?.prompt, 2.4);
assert.equal(grouped.get("claude-sonnet-4-6-r")?.completion, 12);
assert.equal(grouped.get("claude-sonnet-4-6-r")?.beforeGroupDiscount, undefined);
// A USD display unit leaves out the currency.
assert.equal(linkApiPrices(pricing, parseLinkApiStatus({ data: {} }), "default", "x").get("claude-sonnet-4-6-r")?.currency, undefined);

// ── models.dev ──
const index = parseModelsDev({
  anthropic: { models: { "claude-x": { cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 } }, nocost: {} } },
  moonshotai: { models: { "kimi-k3": { cost: { input: 0.6, output: 2.5 } } } },
});
assert.deepEqual(modelsDevPrice(index, { provider: "anthropic" }, "claude-x"), { prompt: 3, completion: 15, cacheRead: 0.3, cacheWrite: 3.75 });
assert.equal(modelsDevPrice(index, { provider: "anthropic" }, "nocost"), undefined);
assert.equal(modelsDevPrice(index, { provider: "custom", baseUrl: "https://api.moonshot.ai/v1" }, "kimi-k3")?.prompt, 0.6);
assert.equal(modelsDevPrice(index, { provider: "custom", baseUrl: "http://localhost:8080/v1" }, "anthropic/claude-x")?.prompt, 3);

// ── Balance parsers ──
const keyUsage = parseLinkApiKeyUsage(
  { code: true, data: { total_used: 1225335000, total_granted: 1500000000, total_available: 274665000, unlimited_quota: false } },
  status,
);
assert.deepEqual([keyUsage.scope, keyUsage.unit, keyUsage.left, keyUsage.used, keyUsage.granted], ["key", "CNY", 549.33, 2450.67, 3000]);
const unlimited = parseLinkApiKeyUsage({ data: { total_used: 500000, total_available: -500000, unlimited_quota: true } }, status);
assert.equal(unlimited.left, null);
assert.equal(unlimited.used, 1);

const account = parseLinkApiAccount({ success: true, data: { quota: 278220000, used_quota: 1225915000, request_count: 31131, group: "default" } }, status);
assert.deepEqual([account.scope, account.left, account.used, account.requests, account.group], ["account", 556.44, 2451.83, 31131, "default"]);

const limited = parseOpenRouterKey({ data: { limit: 20, limit_remaining: 12.5, usage: 7.5, usage_monthly: 3 } });
assert.deepEqual([limited.scope, limited.left, limited.used], ["key", 12.5, 7.5]);
const open = parseOpenRouterKey({ data: { limit: null, limit_remaining: null, usage: 40, usage_monthly: 3.25 } });
assert.deepEqual([open.scope, open.left, open.used], ["month", null, 3.25]);

const deepseek = parseDeepSeekBalance({
  is_available: true,
  balance_infos: [{ currency: "CNY", total_balance: "110.00", granted_balance: "10.00", topped_up_balance: "100.00" }],
});
assert.deepEqual([deepseek.unit, deepseek.left, deepseek.parts], ["CNY", 110, [{ id: "granted", amount: 10 }, { id: "toppedUp", amount: 100 }]]);

const kimi = parseMoonshotBalance({ code: 0, data: { available_balance: 49.5, voucher_balance: 10, cash_balance: 39.5 }, status: true }, "USD");
assert.deepEqual([kimi.left, kimi.parts], [49.5, [{ id: "voucher", amount: 10 }, { id: "cash", amount: 39.5 }]]);

// ── LinkAPI flow: account token, a token without profile:read, and the key fallback ──
const calls: Array<{ url: string; headers: Record<string, string> }> = [];
const fake =
  (answers: Record<string, [number, unknown]>) =>
  async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    const [code, body] = answers[url] ?? [404, {}];
    return new Response(JSON.stringify(body), { status: code });
  };
const SELF = "https://api.linkapi.ai/api/user/self";
const KEY = "https://api.linkapi.ai/api/usage/token/";
const creds = { provider: "custom", baseUrl: "https://linkapi.ai/v1", apiKey: "test-key", balanceToken: "test-token" };

const viaAccount = await fetchConnectionBalance(
  creds,
  fake({ [SELF]: [200, { success: true, data: { quota: 500000, used_quota: 0 } }] }),
  status,
);
assert.equal(viaAccount.balance?.scope, "account");
assert.equal(viaAccount.notice, undefined);
// No user id set: no New-Api-User header.
assert.equal(calls.at(-1)?.headers["New-Api-User"], undefined);

await fetchConnectionBalance({ ...creds, balanceUserId: "42" }, fake({ [SELF]: [200, { success: true, data: { quota: 0 } }] }), status);
assert.equal(calls.at(-1)?.headers["New-Api-User"], "42");

const missingScope = await fetchConnectionBalance(
  creds,
  fake({
    [SELF]: [403, { success: false, message: "The access token lacks the required permission: profile:read" }],
    [KEY]: [200, { data: { total_used: 500000, total_available: 1000000, unlimited_quota: false } }],
  }),
  status,
);
assert.equal(missingScope.notice, "linkapi_missing_profile_read");
assert.deepEqual([missingScope.balance?.scope, missingScope.balance?.left], ["key", 2]);
assert.equal(calls.at(-1)?.url, KEY);

const rejected = await fetchConnectionBalance(
  creds,
  fake({ [SELF]: [401, { success: false, message: "invalid token" }], [KEY]: [200, { data: { total_used: 0, total_available: 0 } }] }),
  status,
);
assert.equal(rejected.notice, "linkapi_token_rejected");

const noBalance = await fetchConnectionBalance({ provider: "openai", apiKey: "test-key" }, fake({}), status);
assert.deepEqual(noBalance, { balance: null });

console.log("connection balance and prices: ok");
