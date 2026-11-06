import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectionBalanceSource, modelCost, upstreamBalanceSource } from "../../packages/shared/src/index.js";
import {
  fetchConnectionBalance,
  fetchUpstreamBalance,
  parseBifrostQuota,
  parseNanoGptBalance,
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
assert.equal(connectionBalanceSource({ provider: "nanogpt" }), "nanogpt");
// A Bifrost proxy is known by its virtual key, whatever the provider.
assert.equal(
  connectionBalanceSource({ provider: "custom", baseUrl: "http://llm.home.lan/v1", apiKey: "sk-bf-x" }),
  "bifrost",
);
assert.equal(connectionBalanceSource({ provider: "custom", baseUrl: "http://llm.home.lan/v1", apiKey: "sk-x" }), null);
assert.deepEqual(
  ["nanogpt", "openrouter", "linkapi", "moonshot", "deepseek", "arliai", "toString"].map(upstreamBalanceSource),
  ["nanogpt", "openrouter", "linkapi", "moonshot", "deepseek", null, null],
);

// ── LinkAPI prices ──
const pricing = parseLinkApiPricing({
  data: [
    // Plain ratios: input = ratio × 2, output/cache by ratio.
    {
      model_name: "claude-sonnet-4-6-r",
      quota_type: 0,
      model_ratio: 0.75,
      completion_ratio: 5,
      cache_ratio: 0.1,
      create_cache_ratio: 1.25,
    },
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
    {
      model_name: "image-model",
      quota_type: 1,
      model_price: 0.3,
      billing_mode: "tiered_expr",
      billing_expr: 'tier("image", fixed(0.2))',
    },
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
  [
    base.get("claude-opus-5-r")?.prompt,
    base.get("claude-opus-5-r")?.completion,
    base.get("claude-opus-5-r")?.cacheRead,
    base.get("claude-opus-5-r")?.cacheWrite,
  ],
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
assert.equal(
  linkApiPrices(pricing, parseLinkApiStatus({ data: {} }), "default", "x").get("claude-sonnet-4-6-r")?.currency,
  undefined,
);

// ── models.dev ──
const index = parseModelsDev({
  anthropic: {
    models: { "claude-x": { cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 } }, nocost: {} },
  },
  moonshotai: { models: { "kimi-k3": { cost: { input: 0.6, output: 2.5 } } } },
});
assert.deepEqual(modelsDevPrice(index, { provider: "anthropic" }, "claude-x"), {
  prompt: 3,
  completion: 15,
  cacheRead: 0.3,
  cacheWrite: 3.75,
});
assert.equal(modelsDevPrice(index, { provider: "anthropic" }, "nocost"), undefined);
assert.equal(
  modelsDevPrice(index, { provider: "custom", baseUrl: "https://api.moonshot.ai/v1" }, "kimi-k3")?.prompt,
  0.6,
);
assert.equal(
  modelsDevPrice(index, { provider: "custom", baseUrl: "http://localhost:8080/v1" }, "anthropic/claude-x")?.prompt,
  3,
);

// ── Balance parsers ──
const keyUsage = parseLinkApiKeyUsage(
  {
    code: true,
    data: { total_used: 1225335000, total_granted: 1500000000, total_available: 274665000, unlimited_quota: false },
  },
  status,
);
assert.deepEqual(
  [keyUsage.scope, keyUsage.unit, keyUsage.left, keyUsage.used, keyUsage.granted],
  ["key", "CNY", 549.33, 2450.67, 3000],
);
const unlimited = parseLinkApiKeyUsage(
  { data: { total_used: 500000, total_available: -500000, unlimited_quota: true } },
  status,
);
assert.equal(unlimited.left, null);
assert.equal(unlimited.used, 1);

const account = parseLinkApiAccount(
  { success: true, data: { quota: 278220000, used_quota: 1225915000, request_count: 31131, group: "default" } },
  status,
);
assert.deepEqual(
  [account.scope, account.left, account.used, account.requests, account.group],
  ["account", 556.44, 2451.83, 31131, "default"],
);

const limited = parseOpenRouterKey({ data: { limit: 20, limit_remaining: 12.5, usage: 7.5, usage_monthly: 3 } });
assert.deepEqual([limited.scope, limited.left, limited.used], ["key", 12.5, 7.5]);
const open = parseOpenRouterKey({ data: { limit: null, limit_remaining: null, usage: 40, usage_monthly: 3.25 } });
assert.deepEqual([open.scope, open.left, open.used], ["month", null, 3.25]);

const deepseek = parseDeepSeekBalance({
  is_available: true,
  balance_infos: [{ currency: "CNY", total_balance: "110.00", granted_balance: "10.00", topped_up_balance: "100.00" }],
});
assert.deepEqual(
  [deepseek.unit, deepseek.left, deepseek.parts],
  [
    "CNY",
    110,
    [
      { id: "granted", amount: 10 },
      { id: "toppedUp", amount: 100 },
    ],
  ],
);

const kimi = parseMoonshotBalance(
  { code: 0, data: { available_balance: 49.5, voucher_balance: 10, cash_balance: 39.5 }, status: true },
  "USD",
);
assert.deepEqual(
  [kimi.left, kimi.parts],
  [
    49.5,
    [
      { id: "voucher", amount: 10 },
      { id: "cash", amount: 39.5 },
    ],
  ],
);

// ── LinkAPI flow: account token, a token without profile:read, and the key fallback ──
const calls: Array<{ url: string; headers: Record<string, string> }> = [];
const fake =
  (answers: Record<string, [number, unknown]>) => async (url: string, init: { headers: Record<string, string> }) => {
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

await fetchConnectionBalance(
  { ...creds, balanceUserId: "42" },
  fake({ [SELF]: [200, { success: true, data: { quota: 0 } }] }),
  status,
);
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
  fake({
    [SELF]: [401, { success: false, message: "invalid token" }],
    [KEY]: [200, { data: { total_used: 0, total_available: 0 } }],
  }),
  status,
);
assert.equal(rejected.notice, "linkapi_token_rejected");

const noBalance = await fetchConnectionBalance({ provider: "openai", apiKey: "test-key" }, fake({}), status);
assert.deepEqual(noBalance, { balance: null });

// ── NanoGPT and Bifrost parsers ──
const nano = parseNanoGptBalance({ usd_balance: "129.46956147", nano_balance: "26.7", nanoDepositAddress: "nano_x" });
assert.deepEqual([nano.source, nano.scope, nano.unit, nano.left], ["nanogpt", "account", "USD", 129.469561]);
assert.throws(() => parseNanoGptBalance({ error: 1 }));
const quota = parseBifrostQuota({ virtual_key_name: "vk", budgets: [{ max_limit: 20, current_usage: 4.12 }] });
assert.deepEqual([quota?.left, quota?.used, quota?.granted, quota?.scope], [15.88, 4.12, 20, "key"]);
assert.equal(parseBifrostQuota({ virtual_key_name: "vk", budgets: null }), null);

// ── A usage-only key goes only to its upstream's own host, never to a proxy ──
const nanoCall = await fetchUpstreamBalance(
  "nanogpt",
  "fixture-usage-key",
  fake({ "https://nano-gpt.com/api/check-balance": [200, { usd_balance: "3.2" }] }),
);
assert.equal(nanoCall.balance?.left, 3.2);
assert.deepEqual(
  [calls.at(-1)?.url, calls.at(-1)?.headers["x-api-key"]],
  ["https://nano-gpt.com/api/check-balance", "fixture-usage-key"],
);
const before = calls.length;
await fetchUpstreamBalance(
  "linkapi",
  "fixture-dashboard-token",
  fake({ [SELF]: [200, { success: true, data: { quota: 500000 } }] }),
  status,
);
assert.deepEqual(
  calls.slice(before).map((call) => new URL(call.url).host),
  ["api.linkapi.ai"],
);
assert.deepEqual(await fetchUpstreamBalance("arliai", "fixture-usage-key", fake({})), { balance: null });

// ── Routes: the consent gate, a linked Connection, a pasted key, masking ──
const directory = mkdtempSync(join(tmpdir(), "marinara-connection-balance-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { connectionAccountsRoutes } = await import("../../packages/server/src/routes/connection-accounts.routes.js");
const { migrateOutsideReadsSetting } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { withoutUsageKeyTokens } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(connectionAccountsRoutes, { prefix: "/accounts" });
const settings = createAppSettingsStorage(db);
const request = async (method: "GET" | "PUT" | "POST" | "DELETE", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  return { status: response.statusCode, body: response.body, data: response.body ? JSON.parse(response.body) : null };
};
const realFetch = globalThis.fetch;
const sent: Array<{ url: string; headers: Headers }> = [];
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  sent.push({ url: String(url), headers: new Headers(init?.headers) });
  const answer = String(url).endsWith("/check-balance")
    ? { usd_balance: "7.5" }
    : { virtual_key_name: "vk", budgets: [{ max_limit: 20, current_usage: 5 }] };
  return new Response(JSON.stringify(answer), { headers: { "content-type": "application/json" } });
}) as typeof fetch;
try {
  const proxy = (
    await request("POST", "/accounts", {
      provider: "custom",
      baseUrl: "http://127.0.0.1:4000/v1",
      apiKey: "sk-bf-fixture-proxy-key",
      model: "nanogpt/glm",
    })
  ).data.account;
  assert.equal(proxy.balanceSource, "bifrost");
  const nanoAccount = (
    await request("POST", "/accounts", { provider: "nanogpt", apiKey: "fixture-nano-key", model: "glm" })
  ).data.account;

  // Unset consent: no read at all.
  assert.deepEqual((await request("GET", `/accounts/${proxy.id}/balance`)).data, { balance: null });
  assert.equal(sent.length, 0);

  await settings.set("outside-reads", "on");
  const own = await request("GET", `/accounts/${proxy.id}/balance`);
  assert.equal(own.data.balance.left, 15);
  assert.equal(sent.at(-1)?.url, "http://127.0.0.1:4000/api/governance/virtual-keys/quota");

  // Linked Connection: its own key, to NanoGPT.
  assert.equal((await request("PUT", `/accounts/${proxy.id}/usage-keys/nanogpt`, { accountId: proxy.id })).status, 400);
  assert.equal((await request("PUT", `/accounts/${proxy.id}/usage-keys/arliai`, { key: "fixture-x" })).status, 400);
  const linked = await request("PUT", `/accounts/${proxy.id}/usage-keys/nanogpt`, { accountId: nanoAccount.id });
  assert.deepEqual(linked.data.usageKeys, { nanogpt: { accountId: nanoAccount.id, hasKey: false } });
  const viaLinked = await request("GET", `/accounts/${proxy.id}/usage-keys/nanogpt/balance?refresh=true`);
  assert.equal(viaLinked.data.balance.left, 7.5);
  assert.deepEqual(
    [sent.at(-1)?.url, sent.at(-1)?.headers.get("x-api-key")],
    ["https://nano-gpt.com/api/check-balance", "fixture-nano-key"],
  );

  // Pasted key: masked in answers, sent only to nano-gpt.com.
  const pasted = await request("PUT", `/accounts/${proxy.id}/usage-keys/nanogpt`, { key: "fixture-usage-only-key" });
  assert(!pasted.body.includes("fixture-usage-only-key"));
  assert.deepEqual(pasted.data.usageKeys, { nanogpt: { hasKey: true } });
  const list = await request("GET", "/accounts");
  assert(!list.body.includes("fixture-usage-only-key"));
  await request("GET", `/accounts/${proxy.id}/usage-keys/nanogpt/balance`);
  const withKey = sent.filter((call) =>
    [...call.headers.values()].some((value) => value.includes("fixture-usage-only")),
  );
  assert.deepEqual(
    withKey.map((call) => new URL(call.url).host),
    ["nano-gpt.com"],
  );

  // Consent off again: no reads.
  await settings.set("outside-reads", "off");
  const count = sent.length;
  assert.deepEqual((await request("GET", `/accounts/${proxy.id}/usage-keys/nanogpt/balance?refresh=true`)).data, {
    balance: null,
  });
  assert.equal(sent.length, count);

  // Backups keep links, not pasted keys.
  assert.equal(withoutUsageKeyTokens(JSON.stringify({ nanogpt: { tokenEncrypted: "x" } })), null);
  assert.equal(
    withoutUsageKeyTokens(JSON.stringify({ nanogpt: { tokenEncrypted: "x" }, openrouter: { accountId: "a" } })),
    JSON.stringify({ openrouter: { accountId: "a" } }),
  );

  const removed = await request("DELETE", `/accounts/${proxy.id}/usage-keys/nanogpt`);
  assert.deepEqual(removed.data.usageKeys, {});
} finally {
  globalThis.fetch = realFetch;
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}

// ── One switch: either old "on" turns it on; an old "off" stays off; unset stays unset ──
const memory = (values: Record<string, string>) => ({
  values,
  get: async (key: string) => values[key] ?? null,
  set: async (key: string, value: string) => void (values[key] = value),
});
for (const [old, expected] of [
  [{ "nanogpt-plan-badges": "on" }, "on"],
  [{ "price-catalog": "on", "nanogpt-plan-badges": "off" }, "on"],
  [{ "price-catalog": "off" }, "off"],
  [{}, undefined],
  [{ "outside-reads": "off", "price-catalog": "on" }, "off"],
] as const) {
  const store = memory({ ...old });
  await migrateOutsideReadsSetting(store);
  assert.equal(store.values["outside-reads"], expected, JSON.stringify(old));
}

console.log("connection balance and prices: ok");
