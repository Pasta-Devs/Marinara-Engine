// ──────────────────────────────────────────────
// Routes: Translation — multi-provider message translation
// ──────────────────────────────────────────────
import type { DB } from "../db/connection.js";
import { z } from "zod";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { logDebugOverride } from "../lib/logger.js";
import { createConnectionsStorage } from "./storage/connections.storage.js";
import { createChatsStorage } from "./storage/chats.storage.js";
import { parseExtra } from "./generation/prompt-attachments.js";
import { createLLMProvider } from "./llm/provider-registry.js";
import { withConnectionFallbackProvider } from "./llm/connection-fallback-provider.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "./generation/generation-parameters.js";
import {
  DEFAULT_TRANSLATION_SYSTEM_PROMPT,
  PROVIDERS,
  localAuthProviderBaseUrl,
  resolveTranslationSystemPrompt,
  stripGmTagsKeepReadables,
  type TranslationConfig,
} from "@marinara-engine/shared";
import { isDeeplxLocalUrlsEnabled } from "../config/runtime-config.js";
import { safeFetch, validateOutboundUrl } from "../utils/security.js";
import { resolveBaseUrl } from "../routes/generate/generate-route-utils.js";
import type { GenerationFallbackNotifier } from "./generation/fallback-notification.js";

const GOOGLE_MAX_LENGTH = 5000;

/** Parse a provider's JSON reply, turning a non-JSON body (proxy or login page) into a 502 that names it. */
async function parseProviderJson<T>(response: Response, provider: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw Object.assign(new Error(`${provider} returned a non-JSON response`), { statusCode: 502 });
  }
}

const translateSchema = z.object({
  chatId: z.string().optional(),
  debugMode: z.boolean().optional(),
  text: z.string().min(1).max(50000),
  provider: z.enum(["ai", "deeplx", "deepl", "google"]),
  targetLanguage: z.string().trim().min(1).max(100),
  connectionId: z.string().optional(),
  systemPrompt: z.string().max(5000).optional().nullable(),
  deeplApiKey: z.string().optional(),
  deeplxUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "DeepLX URL must use http or https",
    })
    .optional(),
});

export async function translateText(db: DB, body: unknown, onFallback?: GenerationFallbackNotifier) {
  const input = translateSchema.parse(body);
  const connections = createConnectionsStorage(db);
  switch (input.provider) {
    case "ai":
      return translateWithAI(input, connections, onFallback);
    case "deeplx":
      return translateWithDeepLX(input);
    case "deepl":
      return translateWithDeepL(input);
    case "google":
      return translateWithGoogle(input);
  }
}

/** Translate the saved, final swipe so closing the browser cannot skip translation or its persistence. */
export async function translateGeneratedMessage(
  db: DB,
  input: {
    chatId: string;
    messageId: string;
    swipeIndex: number;
    mode: string;
    config: TranslationConfig;
    debugMode?: boolean;
  },
  onFallback?: GenerationFallbackNotifier,
) {
  const chats = createChatsStorage(db);
  const message = await chats.getMessage(input.messageId);
  if (!message || message.chatId !== input.chatId || message.role !== "assistant") return null;
  const swipe = (await chats.getSwipes(message.id)).find((row) => row.index === input.swipeIndex);
  if (!swipe) return null;
  const extra = parseExtra(swipe.extra);
  if (extra.translationHidden === true || extra.hiddenFromUser === true || extra.commandOnly === true) return null;
  const text = input.mode === "game" ? stripGmTagsKeepReadables(swipe.content) : swipe.content;
  if (!text.trim() || (extra.translationSource === text && typeof extra.translation === "string" && extra.translation))
    return null;
  // Game can backfill older narration in the browser. Mark this source before
  // the provider call so a reconnect cannot start a second automatic attempt.
  if (
    !(await chats.updateMessageExtraForSwipe(
      message.id,
      swipe.index,
      { automaticTranslationSource: swipe.content },
      swipe.content,
    ))
  )
    return null;
  const { config } = input;
  const { translatedText } = await translateText(
    db,
    {
      chatId: input.chatId,
      text,
      provider: config.provider,
      targetLanguage: config.outputTargetLanguage,
      connectionId: config.connectionId,
      systemPrompt: config.outputSystemPrompt,
      deeplApiKey: config.deeplApiKey,
      deeplxUrl: config.deeplxUrl,
      debugMode: input.debugMode,
    },
    onFallback,
  );
  if (!translatedText.trim()) throw new Error("Translation provider returned no text");
  return chats.updateMessageExtraForSwipe(
    message.id,
    swipe.index,
    {
      translation: translatedText,
      translationSource: text,
      translationHidden: false,
    },
    swipe.content,
  );
}

// ── AI Translation (via configured LLM connection) ──
async function translateWithAI(
  input: z.infer<typeof translateSchema>,
  connections: ReturnType<typeof createConnectionsStorage>,
  onFallback?: GenerationFallbackNotifier,
) {
  if (!input.connectionId) {
    throw Object.assign(new Error("Connection ID is required for AI translation"), { statusCode: 400 });
  }

  const conn = await connections.getWithKey(input.connectionId);
  if (!conn) {
    throw Object.assign(new Error("API connection not found"), { statusCode: 400 });
  }

  let baseUrl = conn.baseUrl;
  if (!baseUrl) {
    const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
    baseUrl = providerDef?.defaultBaseUrl ?? "";
  }
  const localAuthBaseUrl = localAuthProviderBaseUrl(conn.provider);
  if (!baseUrl && localAuthBaseUrl) baseUrl = localAuthBaseUrl;
  if (!baseUrl) {
    throw Object.assign(new Error("No base URL configured for this connection"), { statusCode: 400 });
  }

  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      conn.provider,
      baseUrl,
      conn.apiKey,
      conn.maxContext,
      conn.openrouterProvider,
      conn.maxTokensOverride,
      conn.claudeFastMode === "true",
      conn.treatAsLocalEndpoint === "true",
      conn.defaultParameters,
    ),
    primaryConnectionId: conn.id,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
    category: "main",
    onFallback,
  });
  const systemPrompt = resolveTranslationSystemPrompt(
    input.systemPrompt?.trim() || DEFAULT_TRANSLATION_SYSTEM_PROMPT,
    input.targetLanguage,
  );
  const { enabledParameters } = resolveStoredChatOptions(conn.defaultParameters, conn.provider, conn.model);
  logDebugOverride(
    input.debugMode === true || isDebugAgentsEnabled(),
    "[translate] system=%s user=%s",
    systemPrompt,
    `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`,
  );
  const result = await provider.chatComplete(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`,
      },
    ],
    {
      model: conn.model,
      debugMode: input.debugMode,
      temperature: 0.3,
      maxTokens: resolveStoredMaxTokens(conn.defaultParameters, provider.maxTokensOverrideValue ?? 4096),
      enabledParameters: { maxTokens: enabledParameters?.maxTokens },
    },
  );

  return { translatedText: (result.content ?? "").trim() };
}

// ── DeepLX Translation (self-hosted endpoint) ──
async function translateWithDeepLX(input: z.infer<typeof translateSchema>) {
  if (!input.deeplxUrl) {
    throw Object.assign(new Error("DeepLX URL is required"), { statusCode: 400 });
  }

  let url: URL;
  try {
    url = new URL("/translate", input.deeplxUrl);
  } catch {
    throw Object.assign(new Error("Invalid DeepLX URL"), { statusCode: 400 });
  }

  await validateOutboundUrl(url, {
    allowLocal: isDeeplxLocalUrlsEnabled(),
    allowedProtocols: ["https:", "http:"],
    flagName: "DEEPLX_LOCAL_URLS_ENABLED",
  }).catch((err) => {
    throw Object.assign(new Error(err instanceof Error ? err.message : "DeepLX URL is not allowed"), {
      statusCode: 400,
    });
  });

  const response = await safeFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      source_lang: "auto",
      target_lang: input.targetLanguage.toUpperCase(),
    }),
    signal: AbortSignal.timeout(15_000),
    policy: {
      allowLocal: isDeeplxLocalUrlsEnabled(),
      allowedProtocols: ["https:", "http:"],
      flagName: "DEEPLX_LOCAL_URLS_ENABLED",
    },
    maxResponseBytes: 1024 * 1024,
  }).catch((err) => {
    if (err.name === "TimeoutError") throw Object.assign(new Error("DeepLX request timed out"), { statusCode: 502 });
    throw err;
  });

  if (!response.ok) {
    throw Object.assign(new Error(`DeepLX returned ${response.status}`), { statusCode: 502 });
  }

  const data = await parseProviderJson<{ data?: string; alternatives?: string[] }>(response, "DeepLX");
  const translated = data.data || data.alternatives?.[0] || "";
  return { translatedText: translated };
}

// ── DeepL API Translation (official) ──
async function translateWithDeepL(input: z.infer<typeof translateSchema>) {
  if (!input.deeplApiKey) {
    throw Object.assign(new Error("DeepL API key is required"), { statusCode: 400 });
  }

  const isFree = input.deeplApiKey.endsWith(":fx");
  const apiUrl = isFree ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";

  const response = await safeFetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${input.deeplApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [input.text],
      target_lang: input.targetLanguage.toUpperCase(),
    }),
    signal: AbortSignal.timeout(15_000),
    maxResponseBytes: 1024 * 1024,
  }).catch((err) => {
    if (err.name === "TimeoutError") throw Object.assign(new Error("DeepL request timed out"), { statusCode: 502 });
    throw err;
  });

  if (!response.ok) {
    throw Object.assign(new Error(`DeepL API returned ${response.status}`), { statusCode: 502 });
  }

  const data = await parseProviderJson<{ translations?: Array<{ text: string }> }>(response, "DeepL API");
  return { translatedText: data.translations?.[0]?.text ?? "" };
}

// ── Google Translate (free API) ──
async function translateWithGoogle(input: z.infer<typeof translateSchema>) {
  if (input.text.length > GOOGLE_MAX_LENGTH) {
    throw Object.assign(
      new Error(
        `Text too long for Google Translate (max ${GOOGLE_MAX_LENGTH} characters). Use DeepL or AI provider for longer texts.`,
      ),
      { statusCode: 400 },
    );
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", input.targetLanguage);
  url.searchParams.set("dt", "t");

  // The text goes in a form body, not the query string: percent-encoded non-Latin text
  // grows 6-9x and overflows Google's URL length limit well under GOOGLE_MAX_LENGTH.
  const response = await safeFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: input.text }).toString(),
    signal: AbortSignal.timeout(15_000),
    maxResponseBytes: 1024 * 1024,
  }).catch((err) => {
    if (err.name === "TimeoutError")
      throw Object.assign(new Error("Google Translate request timed out"), { statusCode: 502 });
    throw err;
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Google Translate returned ${response.status}`), { statusCode: 502 });
  }

  const data = await parseProviderJson<unknown>(response, "Google Translate");

  // Google returns nested arrays: [[["translated text", "original text", ...], ...], ...]
  let translated = "";
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const segment of data[0]) {
      if (Array.isArray(segment) && segment[0]) {
        translated += segment[0];
      }
    }
  }

  return { translatedText: translated };
}
