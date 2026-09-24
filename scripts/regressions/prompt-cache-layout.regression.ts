/**
 * Cache-friendly prompt layout (Settings > Advanced > Features, `cacheFriendlyPromptLayout`, off by default).
 *
 * Off must leave every request exactly as upstream builds it: no markers, the assembled order, the keyword
 * lore scan, a plain string system prompt on Claude (Subscription). On, a subscription request carries the
 * whole lorebook scope as one stable `<lore>` prefix, keeps macro (and decision) lore in a `<lore_dynamic>`
 * block after the cache boundary, and moves marked runtime blocks next to the current turn.
 *
 * The first half pins the helpers; the second half runs real /api/generate turns on a Claude (Subscription)
 * connection against a mocked Agent SDK and compares what the SDK receives with the switch off and on.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-cache-layout-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.CLAUDE_SUBSCRIPTION_USE_RESUME = "true";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.FORCE_PROMPT_CACHING_5M;

const { resetFeatureSettingsForTests } =
  await import("../../packages/server/src/services/features/feature-settings.js");
const layout = await import("../../packages/server/src/services/generation/prompt-cache-layout.js");
const { mergeAdjacentMessages, squashLeadingSystemMessages } =
  await import("../../packages/server/src/services/prompt/merger.js");
const { appendFallbackChatSummaryToSystemPrompt } =
  await import("../../packages/server/src/services/prompt/assembler.js");
const { fitMessagesToContext } = await import("../../packages/server/src/services/llm/base-provider.js");
const { buildFullLorebookContext, scopeLorebookScanResultToCharacterContext } =
  await import("../../packages/server/src/services/lorebook/index.js");

type Message = import("../../packages/server/src/services/generation/prompt-cache-layout.js").PromptCacheLayoutMessage;
const bytes = (value: unknown) => JSON.stringify(value);
const runtime = (content: string): Message => ({
  role: "system",
  content,
  contextKind: "injection",
  providerMetadata: { marinaraRuntimeContext: true },
});
const marked: Message[] = [
  { role: "system", content: "Rules", contextKind: "prompt" },
  runtime("Recalled memory: the lantern was lit."),
  { role: "system", content: "Full lore", contextKind: "prompt", providerMetadata: { marinaraFullLoreContext: true } },
  { role: "assistant", content: "Earlier answer.", contextKind: "history" },
  { role: "user", content: "Current question.", contextKind: "history" },
];

// ── Switch off: helpers leave everything as assembled ─────────────────────────
resetFeatureSettingsForTests();
assert.equal(layout.isCacheFriendlyPromptLayoutActive("claude_subscription"), false);
assert.equal(layout.shouldUseFullLorebookContext("openai_chatgpt", false), false, "off: keyword lore scan");
assert.equal(bytes(layout.normalizePromptCacheLayout(marked)), bytes(marked), "off: order and bytes unchanged");
assert.notEqual(layout.normalizePromptCacheLayout(marked)[0], marked[0], "off still returns copies");
assert.deepEqual(layout.runtimeContextMarker(false), {}, "off: a runtime block gets no extra fields");
const plainBlock = { role: "system" as const, content: "Awareness" };
assert.equal(bytes({ ...plainBlock, ...layout.runtimeContextMarker(false) }), bytes(plainBlock));

// Unmarked messages merge and squash exactly as before.
const unmarked = [
  { role: "system" as const, content: "A" },
  { role: "system" as const, content: "B" },
  { role: "user" as const, content: "C" },
  { role: "user" as const, content: "D" },
];
assert.deepEqual(
  mergeAdjacentMessages(squashLeadingSystemMessages(unmarked)).map((message) => message.content),
  ["A\n\nB", "C\n\nD"],
);

// The fallback chat summary still joins the last leading system message.
const macroCtx = { user: "User", char: "Mira", characters: ["Mira"], variables: {} } as never;
const summaryOff = appendFallbackChatSummaryToSystemPrompt(
  [
    { role: "system", content: "Rules" },
    { role: "user", content: "Hi", contextKind: "history" },
  ],
  "They met at the gate.",
  "xml",
  macroCtx,
);
assert.equal(summaryOff.length, 2);
assert.match(summaryOff[0]!.content, /^Rules\n\n<Chat_Summary>|^Rules\n\n<chat_summary>|^Rules\n\n</u);
assert.equal(summaryOff[0]!.providerMetadata, undefined);

// ── Switch on: helpers ─────────────────────────────────────────────────────────
resetFeatureSettingsForTests({ cacheFriendlyPromptLayout: true });
assert.equal(layout.isCacheFriendlyPromptLayoutActive("claude_subscription"), true);
assert.equal(layout.isCacheFriendlyPromptLayoutActive("openai_chatgpt"), true);
assert.equal(layout.isCacheFriendlyPromptLayoutActive("openai"), false, "other providers never use it");
assert.equal(layout.shouldUseFullLorebookContext("claude_subscription", false), true, "on: full lore is the default");
assert.equal(layout.shouldUseFullLorebookContext("claude_subscription", true), false, "a chat can opt out");
assert.deepEqual(
  layout.normalizePromptCacheLayout(marked).map((message) => message.content),
  ["Full lore", "Rules", "Earlier answer.", "Recalled memory: the lantern was lit.", "Current question."],
  "on: the lore leads and the runtime block moves next to the current turn",
);
const userAuthored: Message = { role: "system", content: "User placement", contextKind: "injection" };
assert.deepEqual(
  layout
    .normalizePromptCacheLayout([marked[2]!, userAuthored, marked[3]!, marked[4]!])
    .map((message) => message.content),
  ["Full lore", "User placement", "Earlier answer.", "Current question."],
  "unmarked injections keep their place",
);
const summaryOn = appendFallbackChatSummaryToSystemPrompt(
  [
    { role: "system", content: "Rules" },
    { role: "user", content: "Hi", contextKind: "history" },
  ],
  "They met at the gate.",
  "xml",
  macroCtx,
  undefined,
  { markRuntimeContext: true },
);
assert.equal(summaryOn[0]!.content, "Rules", "on: the summary no longer rewrites the system prompt");
assert.equal(summaryOn[1]!.providerMetadata?.marinaraRuntimeContext, true);

// Marked blocks are never merged into a neighbour.
const withBoundary = mergeAdjacentMessages(
  squashLeadingSystemMessages([marked[2]!, { role: "system", content: "Rules" }, runtime("State")] as never),
);
assert.deepEqual(
  withBoundary.map((message) => message.content),
  ["Full lore", "Rules", "State"],
);

// Trimming never removes or cuts the full-lore prefix.
const protectedLore = {
  role: "system" as const,
  content: "Protected canon. ".repeat(180),
  contextKind: "prompt" as const,
  providerMetadata: { marinaraFullLoreContext: true },
};
const fitted = fitMessagesToContext(
  [
    protectedLore,
    { role: "user", content: "Old history. ".repeat(900), contextKind: "history" },
    { role: "user", content: "Now.", contextKind: "history" },
  ],
  { maxContext: 4096, maxTokens: 256 },
);
assert.equal(fitted.messages[0]?.content, protectedLore.content);
assert.ok(fitted.trimmed);
assert.throws(
  () =>
    fitMessagesToContext(
      [
        protectedLore,
        { role: "system", content: "Required rules. ".repeat(800) },
        { role: "user", content: "Now.", contextKind: "history" },
      ],
      { maxContext: 4096, maxTokens: 256 },
    ),
  /Full lore exceeds/u,
  "full lore that cannot fit refuses instead of cutting the instructions",
);
assert.doesNotThrow(
  () =>
    fitMessagesToContext(
      [
        { ...protectedLore, providerMetadata: undefined },
        { role: "system", content: "Required rules. ".repeat(800) },
        { role: "user", content: "Now.", contextKind: "history" },
      ],
      { maxContext: 4096, maxTokens: 256 },
    ),
  "unmarked prompts keep the ordinary trimming",
);

// Full lore: deterministic order, macro and decision entries kept apart as the dynamic part.
const entry = (id: string, lorebookId: string, order: number, content: string) =>
  ({ id, lorebookId, order, content, name: id }) as never;
const fullEntries = [
  entry("b-1", "book-b", 5, "Harbour canon."),
  entry("a-2", "book-a", 20, "Tower canon."),
  entry("a-1", "book-a", 10, `{{#if decision:"Mira is angry"}}She is furious.{{/if}}`),
  entry("a-3", "book-a", 30, "Clock reads {{time}}."),
];
let committed = 0;
const full = buildFullLorebookContext(fullEntries, (value: string) => ({
  content: value.replace("{{time}}", "noon"),
  commit: () => {
    committed += 1;
  },
}));
assert.equal(full.stableFullContext, "Tower canon.\n\nHarbour canon.");
assert.equal(full.dynamicFullContext, `{{#if decision:"Mira is angry"}}She is furious.{{/if}}\n\nClock reads noon.`);
assert.equal(committed, 4);
assert.deepEqual(full.depthEntries, []);
assert.equal(full.worldInfoBefore, "");
assert.equal(
  buildFullLorebookContext([...fullEntries].reverse()).stableFullContext,
  full.stableFullContext,
  "storage order cannot reshuffle the prefix",
);
const scoped = scopeLorebookScanResultToCharacterContext(full, fullEntries, { characterId: "c1" });
assert.equal(scoped.stableFullContext, full.stableFullContext);
assert.equal(scoped.worldInfoBefore, "", "scoping never copies full lore into the positioned blocks");
assert.deepEqual(layout.splitFullLorebookContext(full), {
  stable: full.stableFullContext,
  dynamic: full.dynamicFullContext,
});
resetFeatureSettingsForTests();

// ── Real generate turns on a Claude (Subscription) connection ─────────────────
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { __setSdkForTesting } =
  await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");

type Capture = { options: Record<string, unknown>; history: unknown[]; current: unknown };
const captures: Capture[] = [];
__setSdkForTesting({
  query: ((args: { options: Record<string, unknown>; prompt: unknown }) => {
    const capture: Capture = { options: args.options, history: [], current: null };
    captures.push(capture);
    return (async function* () {
      const store = args.options.sessionStore as
        | { load: (key: { sessionId: string; projectKey: string }) => Promise<unknown[]> }
        | undefined;
      if (store) {
        capture.history = await store.load({ sessionId: String(args.options.resume), projectKey: "fixture" });
      }
      if (typeof args.prompt === "string") capture.current = args.prompt;
      else for await (const item of args.prompt as AsyncIterable<unknown>) capture.current = item;
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
try {
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.create({ name: "Harbour lore" } as never);
  assert(book);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Lighthouse",
    content: "LORE_LIGHTHOUSE: the lighthouse keeper is Oren.",
    keys: ["lighthouse"],
    order: 10,
  } as never);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Vault",
    content: "LORE_VAULT: the vault is under the chapel.",
    keys: ["vault"],
    order: 20,
  } as never);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Weather",
    content: "LORE_WEATHER: it is {{random::rainy::windy}} today.",
    keys: ["weather"],
    order: 30,
  } as never);

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
  const preset = await presets.create({ name: "Layout preset", parameters: { maxTokens: 256, maxContext: 200000 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "RULES: stay in character.",
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "world",
    name: "World Info",
    isMarker: true,
    markerConfig: { type: "world_info_before" },
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
    name: "Layout fixture",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  } as never);
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    activeLorebookIds: [book.id],
  });
  await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: "We sail at dawn." });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: character.id,
    content: "Mira checks the ropes.",
  });

  const send = async (userMessage: string) => {
    const before = captures.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(captures.length, before + 1, "one SDK request per turn");
    return captures.at(-1)!;
  };
  const text = (value: unknown) => JSON.stringify(value);

  // Off: upstream request shape.
  resetFeatureSettingsForTests();
  const off = await send("Is the lighthouse lit?");
  assert.equal(typeof off.options.systemPrompt, "string", "off: one string system prompt");
  const offSystem = off.options.systemPrompt as string;
  assert.ok(!offSystem.includes("__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__"));
  assert.ok(!offSystem.includes("<lore>"), "off: no full-lore prefix");
  assert.match(offSystem, /RULES: stay in character\./u);
  assert.match(offSystem, /LORE_LIGHTHOUSE/u, "off: the keyword scan activates the matched entry");
  assert.ok(!offSystem.includes("LORE_VAULT"), "off: an unmatched entry stays out");
  assert.ok(!text(off.history).includes("cache_control"), "off: no history cache marker");
  assert.equal((off.options.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, undefined);
  for (const item of off.history as Array<{ type: string; message: { content: unknown } }>) {
    if (item.type === "user") assert.equal(typeof item.message.content, "string", "off: plain string user entries");
  }

  // On: stable full lore before the boundary, macro lore after it, a history marker.
  resetFeatureSettingsForTests({ cacheFriendlyPromptLayout: true });
  const on = await send("And the vault?");
  assert.ok(Array.isArray(on.options.systemPrompt), "on: boundary-split system prompt");
  const onSystem = on.options.systemPrompt as string[];
  const boundary = onSystem.indexOf("__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__");
  assert.ok(boundary > 0);
  assert.match(onSystem[0]!, /^<lore>\nLORE_LIGHTHOUSE[^]*LORE_VAULT[^]*<\/lore>$/u, "on: every entry, lore first");
  assert.ok(!onSystem[0]!.includes("LORE_WEATHER"), "on: macro lore stays out of the stable prefix");
  // The dynamic lore block is a per-turn injection at the end of the request (after the user turn), so it
  // travels as the SDK's current turn and the user turn joins the replayed history before it.
  const current = on.current as { message: { content: unknown } };
  assert.match(
    String(current.message.content),
    /^<lore_dynamic>\nLORE_WEATHER: it is (rainy|windy) today\.\n<\/lore_dynamic>$/u,
  );
  assert.ok(!onSystem.slice(0, boundary).join("\n").includes("LORE_WEATHER"));
  assert.ok(text(on.history).includes('"cache_control":{"type":"ephemeral","ttl":"1h"}'), "on: history marker");
  assert.equal((on.options.env as Record<string, unknown>).ENABLE_PROMPT_CACHING_1H, "1");

  // A second turn keeps the same stable prefix byte for byte.
  const again = await send("Thanks.");
  assert.equal((again.options.systemPrompt as string[])[0], onSystem[0], "on: the lore prefix is stable across turns");

  // A chat that opts out gets the keyword scan again.
  await chats.patchMetadata(chat.id, { fullLorebookContext: false });
  const optedOut = await send("The lighthouse again?");
  const optedOutSystem = Array.isArray(optedOut.options.systemPrompt)
    ? (optedOut.options.systemPrompt as string[]).join("\n")
    : String(optedOut.options.systemPrompt);
  assert.ok(!optedOutSystem.includes("<lore>"));
  assert.ok(!optedOutSystem.includes("LORE_VAULT"));
} finally {
  resetFeatureSettingsForTests();
  __setSdkForTesting(null);
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("prompt-cache-layout regression passed");
