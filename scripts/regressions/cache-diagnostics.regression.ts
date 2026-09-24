/**
 * Prompt-cache diagnostics, the next-turn Peek Prompt preview, and the per-turn cache share in the token usage
 * label.
 *
 * - Claude (Subscription) and OpenAI Responses diagnostics write nothing at the default log level, and with
 *   MARINARA_CACHE_DIAGNOSTICS=1 write hashes, lengths and counts (never prompt text), with a running prefix hash
 *   that shows where two requests start to differ.
 * - layoutAsNextTurn is the identity while the cache-friendly layout is off, and places runtime blocks where the
 *   next real turn carries them when it is on; the live Peek Prompt preview then says `layout: "next-turn"`.
 * - normalizeGenerationTokenUsage computes the cache share for Claude-native and OpenAI-style usage.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-cache-diagnostics-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
delete process.env.MARINARA_CACHE_DIAGNOSTICS;

const { logger } = await import("../../packages/server/src/lib/logger.js");
const claude = await import("../../packages/server/src/services/llm/providers/claude-cache-diagnostics.js");
const openai = await import("../../packages/server/src/services/llm/providers/openai-cache-diagnostics.js");
const { resetFeatureSettingsForTests } =
  await import("../../packages/server/src/services/features/feature-settings.js");
const { layoutAsNextTurn } = await import("../../packages/server/src/services/generation/prompt-cache-layout.js");
const { normalizeGenerationTokenUsage } = await import("../../packages/client/src/lib/generation-token-usage.js");

// Capture what the diagnostics write at info and debug.
logger.level = "info";
const lines: Array<{ level: string; data: Record<string, unknown>; message: string }> = [];
const capture =
  (level: string) =>
  (data: unknown, message?: unknown): void => {
    lines.push({ level, data: (data ?? {}) as Record<string, unknown>, message: String(message ?? "") });
  };
const originalInfo = logger.info;
const originalDebug = logger.debug;
(logger as unknown as Record<string, unknown>).info = capture("info");
(logger as unknown as Record<string, unknown>).debug = capture("debug");

const SECRET = "PROMPT_TEXT_SENTINEL";
const shared = [
  { role: "system", content: `Rules ${SECRET}` },
  { role: "user", content: "First turn" },
  { role: "assistant", content: "First answer" },
];
try {
  // ── Off by default: nothing written ──
  const quiet = claude.beginClaudeCacheDiagnostic(
    [...shared, { role: "user", content: "Now" }],
    { model: "claude-opus-5" },
    { requestedModel: "claude-opus-5", path: "fold", systemPrompt: "Rules" },
  );
  claude.logClaudeCacheResult(quiet, { subtype: "success", usage: { cache_read_input_tokens: 5 } });
  const quietResponses = openai.beginResponsesRequestAttempt({ model: "gpt-5", input: [] }, "chatResponses");
  openai.logResponsesProviderEvent(quietResponses, "completed", { id: "resp_1" }, { input_tokens: 10 });
  assert.equal(lines.length, 0, "no diagnostic lines at the default level");

  // ── MARINARA_CACHE_DIAGNOSTICS=1: hashes and counts at info ──
  process.env.MARINARA_CACHE_DIAGNOSTICS = "1";
  const first = claude.beginClaudeCacheDiagnostic(
    [...shared, { role: "user", content: "Now A" }],
    { model: "claude-opus-5" },
    {
      requestedModel: "claude-opus-5",
      path: "resume",
      sessionHash: "session-1",
      systemPrompt: ["Stable", "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__", "Dynamic"],
    },
  );
  const second = claude.beginClaudeCacheDiagnostic(
    [...shared, { role: "user", content: "Now B" }],
    { model: "claude-opus-5" },
    { requestedModel: "claude-opus-5", path: "resume", sessionHash: "session-2", systemPrompt: "Stable" },
  );
  claude.logClaudeCacheResult(first, {
    subtype: "success",
    usage: {
      input_tokens: 10,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 90,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 90 },
    },
  });
  const attemptLine = lines.find((line) => line.message === "Claude SDK request attempt");
  assert.ok(attemptLine && attemptLine.level === "info");
  const system = attemptLine.data.system as Record<string, unknown>;
  assert.equal(system.staticCount, 1);
  assert.equal(system.dynamicCount, 1);
  assert.equal(system.dynamicBoundaryIndex, 1);
  const batches = lines.filter((line) => line.message === "Claude SDK request input batch");
  const firstMessages = batches.find((line) => line.data.cacheRequestId === first.cacheRequestId)!.data
    .inputMessages as Array<{ prefixHash: string }>;
  const secondMessages = batches.find((line) => line.data.cacheRequestId === second.cacheRequestId)!.data
    .inputMessages as Array<{ prefixHash: string }>;
  assert.deepEqual(
    firstMessages.slice(0, 3).map((message) => message.prefixHash),
    secondMessages.slice(0, 3).map((message) => message.prefixHash),
    "shared leading messages share the prefix hash",
  );
  assert.notEqual(firstMessages[3]!.prefixHash, secondMessages[3]!.prefixHash, "the first changed message shows");
  const result = lines.find((line) => line.message === "Claude SDK provider result")!;
  assert.deepEqual(result.data.usage, {
    inputTokens: 10,
    outputTokens: null,
    cachedInputTokens: 900,
    cacheWriteInputTokens: 90,
    ephemeral5mInputTokens: 0,
    ephemeral1hInputTokens: 90,
  });

  const responses = openai.beginResponsesRequestAttempt(
    {
      model: "gpt-5",
      instructions: `Lore ${SECRET}`,
      input: [{ role: "user", content: "Hi" }],
      prompt_cache_key: "me-lore-x",
    },
    "chatResponses",
  );
  openai.logResponsesProviderEvent(
    responses,
    "completed",
    { id: "resp_2", model: "gpt-5", status: "completed" },
    { input_tokens: 2000, output_tokens: 5, input_tokens_details: { cached_tokens: 1500 } },
  );
  const responsesAttempt = lines.find((line) => line.message === "OpenAI Responses request attempt")!;
  assert.equal((responsesAttempt.data.requestFields as Record<string, unknown>).input, 1);
  const responsesEvent = lines.find((line) => line.message === "OpenAI Responses provider event")!;
  assert.equal((responsesEvent.data.usage as Record<string, unknown>).cachedInputTokens, 1500);
  assert.ok(!JSON.stringify(lines).includes(SECRET), "prompt text never reaches the log");
} finally {
  delete process.env.MARINARA_CACHE_DIAGNOSTICS;
  (logger as unknown as Record<string, unknown>).info = originalInfo;
  (logger as unknown as Record<string, unknown>).debug = originalDebug;
  logger.level = "silent";
}

// ── layoutAsNextTurn ──
const preview = [
  { role: "system" as const, content: "Rules", contextKind: "prompt" as const },
  {
    role: "system" as const,
    content: "Recalled memory",
    contextKind: "injection" as const,
    providerMetadata: { marinaraRuntimeContext: true },
  },
  { role: "user" as const, content: "Earlier", contextKind: "history" as const },
  { role: "assistant" as const, content: "Answer", contextKind: "history" as const },
];
resetFeatureSettingsForTests();
assert.equal(
  JSON.stringify(layoutAsNextTurn(preview, { provider: "claude_subscription" })),
  JSON.stringify(preview),
  "off: the preview keeps the assembled order",
);
resetFeatureSettingsForTests({ cacheFriendlyPromptLayout: true });
assert.deepEqual(
  layoutAsNextTurn(preview, { provider: "claude_subscription" }).map((message) => message.content),
  ["Rules", "Earlier", "Answer", "Recalled memory"],
  "on: the runtime block sits where the next turn carries it, and no placeholder is left",
);
assert.deepEqual(
  layoutAsNextTurn(preview, { provider: "openai" }).map((message) => message.content),
  preview.map((message) => message.content),
  "other providers keep the assembled order",
);
resetFeatureSettingsForTests();

// ── Per-turn cache share ──
const claudeUsage = normalizeGenerationTokenUsage({
  provider: "claude_subscription",
  tokensPrompt: 100,
  tokensCachedPrompt: 800,
  tokensCacheWritePrompt: 100,
  tokensCompletion: 50,
})!;
assert.equal(claudeUsage.inputTotal, 1000, "Claude reports fresh input apart from cache reads and writes");
assert.equal(claudeUsage.cacheHitRatio, 0.8);
const openaiUsage = normalizeGenerationTokenUsage({
  provider: "openai_chatgpt",
  tokensPrompt: 2000,
  tokensCachedPrompt: 1500,
})!;
assert.equal(openaiUsage.cacheHitRatio, 0.75, "OpenAI reports cached input inside the prompt total");
assert.equal(
  normalizeGenerationTokenUsage({ provider: "claude_subscription", tokensPrompt: 100, tokensCachedPrompt: 800 })!
    .cacheHitRatio,
  null,
  "an incomplete Claude subscription report gives no share",
);

// ── Live Peek Prompt preview on a Claude (Subscription) chat ──
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.create({ name: "Harbour lore" } as never);
  assert(book);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Vault",
    content: "LORE_VAULT: the vault is under the chapel.",
    keys: ["vault"],
  } as never);
  const connection = await createConnectionsStorage(db).create({
    name: "Subscription fixture",
    provider: "claude_subscription",
    model: "claude-opus-5",
    maxContext: 200000,
  } as never);
  assert(connection);
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Mira", description: "A harbour pilot." }),
  );
  assert(character);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Peek preset" });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "RULES: stay in character.",
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  } as never);
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Peek fixture",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  } as never);
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, activeLorebookIds: [book.id] });
  await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: "We sail at dawn." });

  const peek = async () => {
    const response = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { source?: string; layout?: string; messages: Array<{ content: string }> };
  };
  const off = await peek();
  assert.equal(off.source, "live_preview");
  assert.equal(off.layout, undefined, "off: an ordinary live preview");
  assert.ok(!off.messages.some((message) => message.content.includes("LORE_VAULT")), "off: keyword scan, no match");

  resetFeatureSettingsForTests({ cacheFriendlyPromptLayout: true });
  const on = await peek();
  assert.equal(on.layout, "next-turn");
  assert.match(on.messages[0]!.content, /^<lore>\nLORE_VAULT/u, "on: the preview shows the full-lore prefix first");
} finally {
  resetFeatureSettingsForTests();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("cache-diagnostics regression passed");
