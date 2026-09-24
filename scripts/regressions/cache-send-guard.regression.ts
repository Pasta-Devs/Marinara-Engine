/**
 * "Warn before a low-cache send" (per chat, chat metadata `cacheSendGuard`, off unless `enabled: true`).
 *
 * Before a chat's main request goes out, the built prompt is compared with the last one sent for that chat and
 * connection. When the predicted cached share is under the chat's threshold (80% by default) the send is held
 * before any model call and the client asks whether to send anyway.
 *
 * The first half pins the prediction; the second half runs real /api/generate turns on a Claude (Subscription)
 * connection against a mocked Agent SDK: off (the default) never holds or writes anything, on holds a turn whose
 * prompt changed near the top, and an acknowledged resend goes through.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-cache-guard-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = "true";

const guard = await import("../../packages/server/src/services/generation/cache-send-guard.js");
const { i18n } = await import("../../packages/client/src/localization/i18n.js");
const { cacheGuardWarningMessage, isCacheGuardWarning } =
  await import("../../packages/client/src/lib/cache-guard-warning.js");
// The real English strings, so the wording below is what a player reads.
i18n.addResourceBundle(
  "en",
  "translation",
  JSON.parse(readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8")),
  true,
  true,
);

// ── Settings: off unless enabled ──
assert.deepEqual(guard.readCacheGuardSettings({}), { enabled: false, thresholdPercent: 80, ttlMinutes: 60 });
assert.equal(guard.readCacheGuardSettings({ cacheSendGuard: {} }).enabled, false, "missing enabled means off");
assert.equal(guard.readCacheGuardSettings({ cacheSendGuard: { enabled: "yes" } }).enabled, false);
assert.deepEqual(
  guard.readCacheGuardSettings({ cacheSendGuard: { enabled: true, thresholdPercent: 150, ttlMinutes: 0 } }),
  { enabled: true, thresholdPercent: 100, ttlMinutes: 1 },
);
assert.equal(guard.cacheGuardApplies("claude_subscription"), true);
assert.equal(guard.cacheGuardApplies("anthropic"), true);
assert.equal(guard.cacheGuardApplies("openai"), false, "providers without this cache model are never held");
assert.equal(guard.cacheGuardApplies("openai_chatgpt", [{ role: "system", content: "plain" }]), false);
assert.equal(
  guard.cacheGuardApplies("openai_chatgpt", [
    { role: "system", content: "lore", providerMetadata: { marinaraFullLoreContext: true } },
  ]),
  true,
  "ChatGPT only with the cache-friendly layout's lore prefix",
);

// ── Prediction ──
const scope = {
  provider: "claude_subscription",
  model: "claude-opus-5",
  connectionId: "connection-1",
  requestKind: "narrator" as const,
};
const on = guard.readCacheGuardSettings({ cacheSendGuard: { enabled: true } });
const lore = { role: "system", content: "<lore>" + "atlas ".repeat(20_000) + "</lore>" };
const card = { role: "user", content: "<character_card>\nName: Mira\noriginal" };
const history = Array.from({ length: 40 }, (_, i) => ({
  role: i % 2 ? "assistant" : "user",
  content: `turn ${i} `.repeat(300),
}));
const now = Date.parse("2026-09-17T08:00:00Z");
const previous = guard.fingerprintPrompt(
  [lore, card, ...history, { role: "user", content: "old" }],
  now - 300_000,
  scope,
);
const next = guard.fingerprintPrompt(
  [lore, card, ...history, { role: "assistant", content: "reply" }, { role: "user", content: "new" }],
  now,
  scope,
);
const normal = guard.predictCacheHit(previous, next, on, now)!;
assert.ok(normal.percent >= 95, `a normal next turn predicts a high hit (${normal.percent}%)`);
const changedCard = { ...card, content: card.content.replace("original", "rewritten") };
const broken = guard.fingerprintPrompt([lore, changedCard, ...history, { role: "user", content: "new" }], now, scope);
const low = guard.predictCacheHit(previous, broken, on, now)!;
assert.equal(low.reason, "changed");
assert.equal(low.firstChange?.index, 1);
assert.match(low.firstChange?.label ?? "", /character_card/u);
assert.ok(low.percent < on.thresholdPercent, `a change high in the prompt predicts a low hit (${low.percent}%)`);
const expired = guard.predictCacheHit(previous, next, on, now + 2 * 60 * 60_000)!;
assert.equal(expired.percent, 0);
assert.equal(expired.reason, "expired");
assert.equal(guard.predictCacheHit(null, next, on, now), null, "no earlier send, nothing to compare");
assert.equal(
  guard.predictCacheHit(
    previous,
    guard.fingerprintPrompt([lore], now, { ...scope, requestKind: "tool-round" }),
    on,
    now,
  ),
  null,
  "request kinds never cross-compare",
);
const prefixPrediction = guard.predictCacheHit(previous, next, on, now + 2 * 60 * 60_000, "openai-prefix")!;
assert.equal(prefixPrediction.reason, "changed", "ChatGPT prefix estimates do not use the Anthropic expiry rule");

// The hold carries what the client needs, and the client words it plainly.
const hold = new guard.CacheGuardHold({ ...low, thresholdPercent: on.thresholdPercent });
assert.ok(isCacheGuardWarning(hold.prediction));
const text = cacheGuardWarningMessage(hold.prediction);
assert.match(text, new RegExp(`Only about ${low.percent}%`, "u"));
assert.match(text, /The prompt first changes at: user <character_card>/u);
assert.match(text, /Your message is saved/u);
assert.match(cacheGuardWarningMessage({ ...expired, thresholdPercent: 80 }), /cache has likely expired/u);
assert.match(
  cacheGuardWarningMessage({ ...prefixPrediction, thresholdPercent: 80, mode: "openai-prefix" }),
  /estimated reusable prompt prefix, not a measured cache hit/u,
);
assert.ok(!text.includes("\u2014"), "no em dashes in user-facing text");

// ── Real generate turns ──
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { __setSdkForTesting } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

let sdkCalls = 0;
__setSdkForTesting({
  query: ((args: { prompt: unknown }) => {
    sdkCalls += 1;
    return (async function* () {
      if (typeof args.prompt !== "string") for await (const _item of args.prompt as AsyncIterable<unknown>) void _item;
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "Reply." } },
      };
      yield {
        type: "result",
        subtype: "success",
        result: "",
        usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        modelUsage: { "claude-opus-5": {} },
        fast_mode_state: "off",
      };
    })();
  }) as never,
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
const guardDir = join(dir, "cache-guard");
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Subscription fixture",
    provider: "claude_subscription",
    model: "claude-opus-5",
    maxContext: 200000,
    maxTokensOverride: 256,
  } as never);
  assert(connection);
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Mira", description: "A harbour pilot." }),
  );
  assert(character);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Guard preset", parameters: { maxTokens: 256, maxContext: 200000 } });
  assert(preset);
  const rules = await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "RULES: stay in character. " + "Keep the harbour details consistent. ".repeat(200),
  } as never);
  assert(rules);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  } as never);
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Guard fixture",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  } as never);
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableMemoryRecall: false });

  const send = async (payload: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    return response.body;
  };

  // Off (no metadata): never held, nothing fingerprinted or written.
  await send({ userMessage: "We sail at dawn." });
  await presets.updateSection(rules.id, { content: "RULES: changed at the top. " + "x ".repeat(2000) } as never);
  const offBody = await send({ userMessage: "Check the ropes." });
  assert.ok(!offBody.includes("cache_warning"), "off: a changed prompt is never held");
  assert.equal(sdkCalls, 2);
  assert.equal(existsSync(guardDir) ? readdirSync(guardDir).length : 0, 0, "off: nothing stored");

  // On: the first send records, a send whose prompt changed near the top is held before the model call.
  await chats.patchMetadata(chat.id, { cacheSendGuard: { enabled: true } });
  await send({ userMessage: "Raise the sail." });
  assert.equal(sdkCalls, 3);
  assert.ok(readdirSync(guardDir).length > 0, "on: the sent prompt's fingerprint is stored");
  await presets.updateSection(rules.id, { content: "RULES: changed again at the top. " + "y ".repeat(2000) } as never);
  const heldBody = await send({ userMessage: "Steer north." });
  assert.match(heldBody, /"type":"cache_warning"/u, "on: the send is held with a warning");
  assert.equal(sdkCalls, 3, "on: no model call for a held send");
  const warning = JSON.parse(/data: (\{"type":"cache_warning".*\})/u.exec(heldBody)![1]!).data;
  assert.ok(isCacheGuardWarning({ ...warning }));
  assert.ok(warning.percent < 80);
  assert.equal(warning.thresholdPercent, 80);

  // The resend with the acknowledgement goes through, and a normal next turn is not held.
  const ackBody = await send({ cacheGuardAcknowledged: true });
  assert.ok(!ackBody.includes("cache_warning"));
  assert.equal(sdkCalls, 4, "an acknowledged resend reaches the model");
  const nextBody = await send({ userMessage: "Drop anchor." });
  assert.ok(!nextBody.includes("cache_warning"), "an unchanged prefix is not held");
  assert.equal(sdkCalls, 5);
} finally {
  __setSdkForTesting(null);
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("cache-send-guard regression passed");
