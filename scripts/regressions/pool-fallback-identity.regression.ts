import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GenerationFallbackNotice } from "@marinara-engine/shared";
import {
  BaseLLMProvider,
  LLMHttpError,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../../packages/server/src/services/llm/base-provider.js";
import {
  describeFallbackFailure,
  withConnectionFallbackProvider,
  type FallbackConnection,
} from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import { buildGenerationInfoExtra } from "../../packages/server/src/routes/generate/saved-message-extra.js";

// #7697: when a random pool's pick fails and the fallback answers, the toast and the reply name
// the failed connection, its model and a short reason, not only the fallback.
const { i18n } = await import("../../packages/client/src/localization/i18n.js");
const { toast } = await import("../../packages/client/node_modules/sonner/dist/index.mjs");
const { describeGenerationFallback, showGenerationFallbackToast } =
  await import("../../packages/client/src/lib/generation-fallback-notice.js");
i18n.addResourceBundle(
  "en",
  "translation",
  JSON.parse(readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8")),
);

class FailingProvider extends BaseLLMProvider {
  constructor(private readonly failure?: Error) {
    super("", "");
  }

  // Without a failure it returns an empty completion, which also hands over to the fallback.
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    if (this.failure) throw this.failure;
  }
}

const fallbackConnection: FallbackConnection = {
  id: "fallback-connection",
  name: "Backup",
  provider: "custom",
  baseUrl: "http://127.0.0.1:9/v1",
  apiKey: "test",
  model: "backup-model",
};

async function noticeFor(primary: BaseLLMProvider, primaryConnectionName?: string): Promise<GenerationFallbackNotice> {
  const notices: GenerationFallbackNotice[] = [];
  const controller = new AbortController();
  const provider = withConnectionFallbackProvider({
    primary,
    primaryConnectionId: "pool-pick",
    primaryConnectionName,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection.baseUrl!,
    category: "main",
    onFallback: (notice) => {
      notices.push(notice);
      // Stop before the fallback's own request: the notice is what this proves.
      controller.abort();
    },
  });
  await assert.rejects(async () => {
    for await (const _chunk of provider.chat([{ role: "user", content: "Hi" }], {
      model: "pool-model",
      signal: controller.signal,
    })) {
      // drain
    }
  });
  assert.equal(notices.length, 1, "the fallback is announced once");
  return notices[0]!;
}

// The notice names the pool's pick, its model and why it failed, beside the fallback.
const authNotice = await noticeFor(new FailingProvider(new LLMHttpError("bad key", { status: 401 })), "Pool A");
assert.deepEqual(authNotice, {
  category: "main",
  connectionId: "fallback-connection",
  connectionName: "Backup",
  model: "backup-model",
  failed: { connectionId: "pool-pick", connectionName: "Pool A", model: "pool-model", reason: "auth", status: 401 },
});
// An empty reply is its own reason; an unnamed pick is still named by its model.
assert.deepEqual((await noticeFor(new FailingProvider())).failed, {
  connectionId: "pool-pick",
  model: "pool-model",
  reason: "empty",
});

// Each failure gets one short reason.
const networkFailure = new TypeError("fetch failed", {
  cause: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }),
});
for (const [error, expected] of [
  [new LLMHttpError("slow down", { status: 429 }), { reason: "rate_limit", status: 429 }],
  [new LLMHttpError("throttled", { status: 503, retryAfterMs: 1000 }), { reason: "rate_limit", status: 503 }],
  // A 403 can be moderation or region, and a 529 is the provider overloaded: neither blames the key.
  [new LLMHttpError("flagged", { status: 403 }), { reason: "error", status: 403 }],
  [new LLMHttpError("overloaded", { status: 529 }), { reason: "server", status: 529 }],
  [new LLMHttpError("no such model", { status: 404 }), { reason: "not_found", status: 404 }],
  [new LLMHttpError("gateway timeout", { status: 504 }), { reason: "timeout", status: 504 }],
  [new LLMHttpError("down", { status: 503 }), { reason: "server", status: 503 }],
  [new LLMHttpError("bad request", { status: 400 }), { reason: "error", status: 400 }],
  [networkFailure, { reason: "network" }],
  [
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect timed out"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
    }),
    { reason: "timeout" },
  ],
  [Object.assign(new Error("timed out"), { name: "TimeoutError" }), { reason: "timeout" }],
  [new Error("something else"), { reason: "error" }],
] as const) {
  assert.deepEqual(describeFallbackFailure(error), expected, String(error));
}

// The reply keeps the notice, so its model label and Peek can show the failed pick later.
const savedInfo = (fallback?: GenerationFallbackNotice, continuedFallback?: GenerationFallbackNotice) =>
  buildGenerationInfoExtra({
    chatMode: "roleplay",
    gameOutcomeNarrationFailed: false,
    marketWorldPlace: undefined,
    gameToolPlan: null,
    gameToolConnection: null,
    generationProviderOrigin: { model: "current-model", provider: "openai", fallback },
    continuedFallback,
    temperature: undefined,
    effectiveMaxTokensForSend: undefined,
    suppressModelParameters: false,
    effectiveMaxContext: undefined,
    connectionMaxContext: undefined,
    showThoughts: undefined,
    resolvedEffort: undefined,
    reasoningEffort: null,
    verbosity: null,
    serviceTier: null,
    assistantPrefill: "",
    assistantReasoningPrefill: "",
    customParameters: {},
    usage: undefined,
    tokensContext: null,
    tokensLastRequestInput: null,
    requestCount: 1,
    durationMs: 5,
    reasoningDurationMs: null,
    finishReason: undefined,
    lastContextFit: undefined,
    fullThinking: "",
    geminiResponseParts: null,
    chatCompletionsReasoning: null,
    encryptedReasoningItems: [],
    contextInjections: [],
  }).generationInfo as Record<string, unknown>;
assert.deepEqual(savedInfo(authNotice).fallback, authNotice);
assert.equal("fallback" in savedInfo(), false, "a reply the chosen connection wrote keeps no fallback");
assert.deepEqual(savedInfo(undefined, authNotice).fallback, authNotice, "a continuation keeps the prior fallback");
assert.equal(savedInfo(undefined, authNotice).model, "current-model", "the continuation keeps its new model");
assert.equal(savedInfo(undefined, authNotice).provider, "openai", "the continuation keeps its new provider");
const newerNotice = { ...authNotice, model: "newer-backup" };
assert.deepEqual(savedInfo(newerNotice, authNotice).fallback, newerNotice, "a new fallback replaces the prior notice");

// The main reply's route passes the pick's name and stores the notice with the reply.
const runtimeSource = readFileSync(
  new URL("../../packages/server/src/services/generation/provider-generation-runtime.ts", import.meta.url),
  "utf8",
);
assert.match(runtimeSource, /primaryConnectionName: args\.connection\.name,/u);
const routeSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
assert.match(routeSource, /mainFallbackNotice = notice;\s*return onFallback\(notice\);/u);
assert.match(routeSource, /\{ model: origin\.model, provider: origin\.provider, fallback: mainFallbackNotice \}/u);
assert.match(
  routeSource,
  /continuedFallback: input\.continueMessageId\s*\? \(parseExtra\(savedMsg\.extra\)\.generationInfo as GenerationInfo \| undefined\)\?\.fallback\s*: undefined/u,
);
assert.match(
  routeSource,
  /if \(generationProviderOrigin\.fallback\) everyPart\.generationInfo = generationProviderOrigin;/u,
);
assert.match(
  routeSource,
  /replyParts\.slice\(0, -1\)\.entries\(\)[\s\S]*?updateMessageExtraForSwipe\(part\.message\.id, 0, \{\s*\.\.\.everyPart,/u,
);

// The saved reply's note says both, in plain words.
const failedOver = "Pool A (pool-model) failed (key rejected); answered with Backup (backup-model).";
assert.equal(describeGenerationFallback(authNotice), failedOver);
assert.equal(
  describeGenerationFallback({ ...authNotice, failed: { connectionId: "pool-pick", reason: "error", status: 400 } }),
  "pool-pick failed (error 400); answered with Backup (backup-model).",
);
assert.equal(describeGenerationFallback({ ...authNotice, failed: undefined }), null);

toast.dismiss();
showGenerationFallbackToast(authNotice);
const shown = toast.getToasts().at(-1) as { title?: unknown; description?: unknown } | undefined;
assert.equal(shown?.title, "Main switched to Backup (backup-model).");
// The toast comes before the fallback's request, which can fail too, so it never says the fallback answered.
assert.equal(shown?.description, "Pool A (pool-model) failed (key rejected).");

// A notice that does not name the failed connection keeps the old wording.
showGenerationFallbackToast({ category: "illustrator", connectionName: "Images", model: "img-1" });
const older = toast.getToasts().at(-1) as { title?: unknown; description?: unknown } | undefined;
assert.equal(older?.title, "Illustrator switched to Images (img-1).");
assert.equal(older?.description, "The primary generation failed, so Marinara retried with your configured fallback.");

console.log("pool fallback identity regression passed");
