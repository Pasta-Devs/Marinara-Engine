// ──────────────────────────────────────────────
// LLM Provider — Google Gemini
// ──────────────────────────────────────────────
import { createHash, createSign } from "crypto";
import {
  BaseLLMProvider,
  llmFetch,
  sanitizeApiError,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
  type LLMToolCall,
  type LLMToolDefinition,
  type LLMUsage,
} from "../base-provider.js";
import { shouldSuppressUnknownModelParameters } from "@marinara-engine/shared";
import { decodePossiblyCompressedBody } from "../../../utils/security.js";

/** A single Gemini response part (text, thought summary, or signature-only). */
interface GeminiFunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: GeminiFunctionCall;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
  finishMessage?: string;
}

interface GeminiPromptFeedback {
  blockReason?: string;
  blockReasonMessage?: string;
}

interface GeminiApiError {
  code?: number;
  message?: string;
  status?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thoughtsTokenCount?: number;
}

interface GeminiResponsePayload {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  error?: GeminiApiError;
  usageMetadata?: GeminiUsageMetadata;
}

type GoogleProviderKind = "google" | "google_vertex";

interface GoogleServiceAccountKey {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

const GOOGLE_CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const serviceAccountTokenCache = new Map<string, { accessToken: string; expiresAtMs: number }>();
const LINKAPI_CONSOLE_HOSTS = new Set(["linkapi.ai", "www.linkapi.ai", "home.linkapi.ai"]);

function normalizeGoogleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (LINKAPI_CONSOLE_HOSTS.has(url.hostname.toLowerCase())) {
      url.hostname = "api.linkapi.ai";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseServiceAccountKey(value: string): GoogleServiceAccountKey | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as GoogleServiceAccountKey;
    return parsed?.client_email && parsed?.private_key ? parsed : null;
  } catch {
    return null;
  }
}

function looksLikeBearerToken(value: string): boolean {
  return value.startsWith("ya29.") || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

async function fetchServiceAccountAccessToken(serviceAccount: GoogleServiceAccountKey): Promise<string> {
  const clientEmail = serviceAccount.client_email!;
  const privateKey = serviceAccount.private_key!.replace(/\\n/g, "\n");
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const cacheKey = createHash("sha256").update(`${clientEmail}:${privateKey}:${tokenUri}`).digest("hex");
  const cached = serviceAccountTokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs - Date.now() > 60_000) return cached.accessToken;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claimSet = base64UrlJson({
    iss: clientEmail,
    scope: GOOGLE_CLOUD_PLATFORM_SCOPE,
    aud: tokenUri,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  });
  const unsignedJwt = `${header}.${claimSet}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await llmFetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    bufferResponse: true,
  });

  if (!response.ok) {
    throw new Error(
      `Google service account auth failed ${response.status}: ${sanitizeApiError(await response.text())}`,
    );
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Google service account auth failed: missing access_token");
  }

  const expiresInMs = Math.max(60, json.expires_in ?? 3600) * 1000;
  serviceAccountTokenCache.set(cacheKey, {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + expiresInMs,
  });
  return json.access_token;
}

export async function googleAuthHeadersForVertex(apiKey: string): Promise<Record<string, string>> {
  const credential = apiKey.trim();
  if (!credential) return {};

  const serviceAccount = parseServiceAccountKey(credential);
  if (serviceAccount) {
    return { Authorization: `Bearer ${await fetchServiceAccountAccessToken(serviceAccount)}` };
  }

  if (looksLikeBearerToken(credential)) {
    return { Authorization: `Bearer ${credential}` };
  }

  return { "x-goog-api-key": credential };
}

export function buildGoogleVertexModelUrl(
  baseUrl: string,
  model: string,
  endpoint: "generateContent" | "streamGenerateContent" | "models",
): string {
  const base = baseUrl
    .replace(/\/+$/, "")
    .replace(/\/publishers\/google\/models(?:\/[^/:]+(?::(?:generateContent|streamGenerateContent))?)?$/i, "");
  if (endpoint === "models") {
    return `${base}/publishers/google/models`;
  }
  return `${base}/publishers/google/models/${model}:${endpoint}`;
}

function capGeminiThinkingBudget(requestedBudget: number, maxOutputTokens: number): number {
  if (!Number.isFinite(maxOutputTokens) || maxOutputTokens <= 0) return requestedBudget;
  const visibleReserve = Math.min(4096, Math.max(1024, Math.floor(maxOutputTokens * 0.5)));
  const maxThinkingBudget = Math.max(0, Math.floor(maxOutputTokens) - visibleReserve);
  return Math.max(0, Math.min(requestedBudget, maxThinkingBudget));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatGeminiApiError(error: GeminiApiError | undefined): string | null {
  if (!error) return null;
  const status = typeof error.status === "string" && error.status.trim() ? error.status.trim() : null;
  const message = typeof error.message === "string" && error.message.trim() ? error.message.trim() : null;
  const code = typeof error.code === "number" ? error.code : null;
  if (status && message) return `${status}: ${sanitizeApiError(message)}`;
  if (message) return sanitizeApiError(message);
  if (status) return status;
  if (code !== null) return `code ${code}`;
  return "unknown Gemini API error";
}

function formatGeminiPromptBlock(feedback: GeminiPromptFeedback | undefined): string | null {
  const reason = typeof feedback?.blockReason === "string" ? feedback.blockReason.trim() : "";
  if (!reason) return null;
  const message = typeof feedback?.blockReasonMessage === "string" ? feedback.blockReasonMessage.trim() : "";
  return message ? `${reason}: ${message}` : reason;
}

function geminiFinishReasonError(finishReason: string | undefined, hasOutput: boolean): string | null {
  const normalized = typeof finishReason === "string" ? finishReason.trim().toUpperCase() : "";
  if (!normalized || normalized === "STOP") return null;
  if (hasOutput && normalized === "MAX_TOKENS") return null;
  if (hasOutput) return null;
  return `Gemini finished without content (${finishReason})`;
}

function assertGeminiUsableResponse(
  payload: GeminiResponsePayload,
  candidate: GeminiCandidate | undefined,
  hasOutput: boolean,
): void {
  const apiError = formatGeminiApiError(payload.error);
  if (apiError) throw new Error(`Gemini API error: ${apiError}`);

  const blockReason = formatGeminiPromptBlock(payload.promptFeedback);
  if (blockReason) throw new Error(`Gemini blocked the prompt (${blockReason})`);

  if (!candidate) throw new Error("Gemini returned no candidates. The prompt may have been blocked or filtered.");

  const finishError = geminiFinishReasonError(candidate.finishReason, hasOutput);
  if (finishError) throw new Error(finishError);

  if (!hasOutput) throw new Error("Gemini returned no content.");
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeGeminiSchema(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeGeminiSchema(entry, depth + 1));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (["$schema", "$id", "additionalProperties", "unevaluatedProperties"].includes(key)) continue;
    out[key] = sanitizeGeminiSchema(entry, depth + 1);
  }
  return out;
}

function googleResponseFormatConfig(responseFormat?: {
  type: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  if (!responseFormat) return {};
  if (responseFormat.type === "json_object") return { responseMimeType: "application/json" };
  if (responseFormat.type !== "json_schema") return {};
  const schema =
    responseFormat.schema ??
    (isRecord(responseFormat.json_schema) ? responseFormat.json_schema.schema : undefined) ??
    (isRecord(responseFormat.jsonSchema) ? responseFormat.jsonSchema.schema : undefined);
  return {
    responseMimeType: "application/json",
    ...(schema ? { responseSchema: sanitizeGeminiSchema(schema) } : {}),
  };
}

function formatGoogleTools(tools?: LLMToolDefinition[]): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: sanitizeGeminiSchema(tool.function.parameters),
      })),
    },
  ];
}

function imageParts(images?: string[]): Array<Record<string, unknown>> {
  if (!images?.length) return [];
  const parts: Array<Record<string, unknown>> = [];
  for (const img of images) {
    const match = img.match(/^data:([^;]+);base64,(.+)$/);
    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }
  return parts;
}

function fileParts(files?: ChatMessage["files"]): Array<Record<string, unknown>> {
  if (!files?.length) return [];
  const parts: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const match = file.data.match(/^data:([^;]+);base64,(.+)$/);
    if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }
  return parts;
}

function parseToolResultContent(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  if (!trimmed) return { result: "" };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : { result: parsed };
  } catch {
    return { result: content };
  }
}

function formatGoogleContents(
  messages: ChatMessage[],
): Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> {
  const contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> = [];
  const toolNamesById = new Map<string, string>();

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "assistant" && message.providerMetadata?.geminiParts) {
      contents.push({ role: "model", parts: message.providerMetadata.geminiParts as Array<Record<string, unknown>> });
      continue;
    }

    if (message.role === "assistant" && message.tool_calls?.length) {
      const parts: Array<Record<string, unknown>> = [];
      if (message.content?.trim()) parts.push({ text: message.content });
      for (const call of message.tool_calls) {
        toolNamesById.set(call.id, call.function.name);
        parts.push({ functionCall: { name: call.function.name, args: parseToolArguments(call.function.arguments) } });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    if (message.role === "tool") {
      const name = message.tool_call_id ? (toolNamesById.get(message.tool_call_id) ?? "tool_result") : "tool_result";
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name, response: parseToolResultContent(message.content || "") } }],
      });
      continue;
    }

    if (message.role === "user" || message.role === "assistant") {
      const parts = [...fileParts(message.files), ...imageParts(message.images)];
      if (message.content?.trim()) parts.push({ text: message.content });
      if (parts.length > 0) contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
    }
  }

  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Continue." }] });
  return contents;
}

function geminiToolCallFromPart(part: GeminiPart, index: number): LLMToolCall | null {
  const call = part.functionCall;
  if (!call || typeof call.name !== "string") return null;
  return {
    id: typeof call.id === "string" && call.id.trim() ? call.id : `gemini_tool_${Date.now()}_${index}`,
    type: "function",
    function: { name: call.name, arguments: JSON.stringify(isRecord(call.args) ? call.args : {}) },
  };
}

function geminiUsage(usage?: GeminiUsageMetadata): LLMUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.promptTokenCount,
    completionTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
    completionReasoningTokens: usage.thoughtsTokenCount,
  };
}

function normalizeGeminiFinishReason(reason: string | null | undefined): string {
  const normalized = typeof reason === "string" ? reason.trim().toUpperCase() : "";
  if (normalized === "MAX_TOKENS") return "length";
  if (normalized === "STOP") return "stop";
  return reason ?? "stop";
}

/**
 * Handles Google Gemini API (generateContent / streamGenerateContent).
 */
export class GoogleProvider extends BaseLLMProvider {
  constructor(
    baseUrl: string,
    apiKey: string,
    defaultMaxContext?: number,
    defaultOpenrouterProvider?: string | null,
    maxTokensOverride?: number | null,
    private readonly providerKind: GoogleProviderKind = "google",
  ) {
    super(baseUrl, apiKey, defaultMaxContext, defaultOpenrouterProvider, maxTokensOverride);
  }

  private shouldSuppressModelParameters(options: ChatOptions): boolean {
    return (
      options.suppressModelParameters === true || shouldSuppressUnknownModelParameters(this.providerKind, options.model)
    );
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    if (this.shouldSuppressModelParameters(options) || !options.tools?.length)
      return super.chatComplete(messages, options);

    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model || "gemini-2.0-flash");
    const maxTokens = this.applyMaxTokensCap(contextFit.maxTokens ?? configuredMaxTokens);
    const model = options.model || "gemini-2.0-flash";

    const isGemini3 = /gemini-3/i.test(model);
    const supportsThinking = isGemini3 || /gemini-2\.5|gemini-2\.0-flash-thinking/i.test(model);
    let thinkingConfig: Record<string, unknown> | undefined;
    if (this.shouldSendParameter(options, "reasoningEffort") && supportsThinking && (options.enableThinking || options.reasoningEffort)) {
      if (isGemini3) {
        const levelMap = { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" } as const;
        thinkingConfig = {
          thinkingLevel: options.reasoningEffort ? levelMap[options.reasoningEffort] : "high",
          includeThoughts: true,
        };
      } else {
        const budgetMap = { low: 1024, medium: 8192, high: 24576, xhigh: 24576, max: 24576 } as const;
        const requestedBudget = options.reasoningEffort ? budgetMap[options.reasoningEffort] : 8192;
        const outputMaxTokens = maxTokens ?? 4096;
        thinkingConfig = {
          thinkingBudget: capGeminiThinkingBudget(requestedBudget, outputMaxTokens),
          includeThoughts: true,
        };
      }
    }

    let base = normalizeGoogleBaseUrl(this.baseUrl);
    if (this.providerKind === "google" && !/\/v\d/.test(base)) base += "/v1beta";
    const url =
      this.providerKind === "google_vertex"
        ? buildGoogleVertexModelUrl(base, model, "generateContent")
        : `${base}/models/${model}:generateContent`;

    const systemMessages = messages.filter((m) => m.role === "system" && m.content?.trim());
    const body: Record<string, unknown> = {
      contents: formatGoogleContents(messages),
      generationConfig: {
        ...(this.shouldSendParameter(options, "temperature") ? { temperature: options.temperature ?? 1 } : {}),
        ...(this.shouldSendParameter(options, "maxTokens") ? { maxOutputTokens: maxTokens } : {}),
        ...(this.shouldSendParameter(options, "topP") ? { topP: options.topP ?? 1 } : {}),
        ...(this.shouldSendParameter(options, "topK") && typeof options.topK === "number" && Number.isFinite(options.topK)
          ? { topK: Math.max(0, Math.trunc(options.topK)) }
          : {}),
        ...(this.shouldSendParameter(options, "frequencyPenalty") && options.frequencyPenalty
          ? { frequencyPenalty: options.frequencyPenalty }
          : {}),
        ...(this.shouldSendParameter(options, "presencePenalty") && options.presencePenalty
          ? { presencePenalty: options.presencePenalty }
          : {}),
        ...(thinkingConfig ? { thinkingConfig } : {}),
        ...googleResponseFormatConfig(options.responseFormat),
        ...(options.stop?.length ? { stopSequences: options.stop } : {}),
      },
      tools: formatGoogleTools(options.tools),
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    };

    if (systemMessages.length > 0) {
      body.systemInstruction = { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] };
    }

    this.applyCustomParameters(body, options);
    const authHeaders =
      this.providerKind === "google_vertex"
        ? await googleAuthHeadersForVertex(this.apiKey)
        : this.apiKey.trim()
          ? { "x-goog-api-key": this.apiKey.trim() }
          : {};

    const response = await llmFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    const readDecodedText = async () =>
      decodePossiblyCompressedBody(Buffer.from(await response.arrayBuffer())).toString("utf8");
    if (!response.ok) {
      const errorText = await readDecodedText();
      const label = this.providerKind === "google_vertex" ? "Vertex AI Gemini API" : "Gemini API";
      throw new Error(`${label} error ${response.status}: ${sanitizeApiError(errorText)}`);
    }

    const json = JSON.parse(await readDecodedText()) as GeminiResponsePayload;
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    let content = "";
    const toolCalls: LLMToolCall[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      if (part.thought && part.text) options.onThinking?.(part.text);
      else if (part.text && !part.thought) content += part.text;
      const call = geminiToolCallFromPart(part, i);
      if (call) toolCalls.push(call);
    }
    assertGeminiUsableResponse(json, candidate, content.length > 0 || toolCalls.length > 0);
    options.onResponseParts?.(parts);
    if (content && options.onToken) await options.onToken(content);

    return {
      content: content || null,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : normalizeGeminiFinishReason(candidate?.finishReason),
      usage: geminiUsage(json.usageMetadata),
    };
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const suppressModelParameters = this.shouldSuppressModelParameters(options);
    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model || "gemini-2.0-flash");
    const maxTokens = configuredMaxTokens === undefined ? undefined : (contextFit.maxTokens ?? configuredMaxTokens);

    const model = options.model || "gemini-2.0-flash";

    // Gemini 3.x models use thinkingLevel; Gemini 2.5 uses thinkingBudget
    const isGemini3 = /gemini-3/i.test(model);

    // Only models that actually support thinking should get thinkingConfig:
    // Gemini 3.x, 2.5-flash/pro, and 2.0-flash-thinking.
    const supportsThinking =
      !suppressModelParameters && (isGemini3 || /gemini-2\.5|gemini-2\.0-flash-thinking/i.test(model));

    let thinkingConfig: Record<string, unknown> | undefined;
    if (this.shouldSendParameter(options, "reasoningEffort") && supportsThinking && (options.enableThinking || options.reasoningEffort)) {
      if (isGemini3) {
        const levelMap = { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" } as const;
        thinkingConfig = {
          thinkingLevel: options.reasoningEffort ? levelMap[options.reasoningEffort] : "high",
          includeThoughts: true,
        };
      } else {
        const budgetMap = { low: 1024, medium: 8192, high: 24576, xhigh: 24576, max: 24576 } as const;
        const requestedBudget = options.reasoningEffort ? budgetMap[options.reasoningEffort] : 8192;
        const outputMaxTokens = maxTokens ?? 4096;
        thinkingConfig = {
          thinkingBudget: capGeminiThinkingBudget(requestedBudget, outputMaxTokens),
          includeThoughts: true,
        };
      }
    }

    // Ensure the base URL includes the /v1beta path segment required by the Gemini API.
    // Proxies like api.linkapi.ai need this appended (SillyTavern does it automatically).
    let base = normalizeGoogleBaseUrl(this.baseUrl);
    if (this.providerKind === "google" && !/\/v\d/.test(base)) base += "/v1beta";

    // When thinking is enabled, force non-streaming (generateContent) because
    // proxies like linkapi.ai strip thought parts from SSE streams but return
    // them in non-streaming responses. Text is still yielded so SSE works.
    const useStreaming = options.stream && !thinkingConfig;
    const endpoint = useStreaming ? "streamGenerateContent" : "generateContent";
    const url =
      this.providerKind === "google_vertex"
        ? `${buildGoogleVertexModelUrl(base, model, endpoint)}${useStreaming ? "?alt=sse" : ""}`
        : `${base}/models/${model}:${endpoint}${useStreaming ? "?alt=sse" : ""}`;

    // Convert to Gemini format — filter out empty-content messages
    const systemMessages = messages.filter((m) => m.role === "system" && m.content?.trim());
    const chatMessages = messages.filter(
      (m) => m.role !== "system" && (m.content?.trim() || m.images?.length || m.files?.length),
    );

    const contents = chatMessages.map((m) => {
      // If this model message has stored Gemini parts (with thought signatures),
      // use them directly to preserve reasoning state across turns.
      if (m.role === "assistant" && m.providerMetadata?.geminiParts) {
        const storedParts = m.providerMetadata.geminiParts as GeminiPart[];
        return { role: "model" as const, parts: storedParts };
      }

      const parts: Array<Record<string, unknown>> = [...fileParts(m.files), ...imageParts(m.images)];
      if (m.content?.trim()) parts.push({ text: m.content });
      return {
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts,
      };
    });

    // Gemini requires at least one entry in contents — if all non-system messages
    // were empty (e.g. preset with only comments), fall back to a minimal user turn
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Continue." }] });
    }

    const body: Record<string, unknown> = {
      contents,
    };

    const outputMaxTokens = maxTokens ?? 4096;
    body.generationConfig = {
      ...(this.shouldSendParameter(options, "maxTokens") ? { maxOutputTokens: outputMaxTokens } : {}),
      ...(!suppressModelParameters
        ? {
            ...(this.shouldSendParameter(options, "temperature") ? { temperature: options.temperature ?? 1 } : {}),
            ...(this.shouldSendParameter(options, "topP") ? { topP: options.topP ?? 1 } : {}),
            ...(this.shouldSendParameter(options, "topK") &&
            typeof options.topK === "number" &&
            Number.isFinite(options.topK)
              ? { topK: Math.max(0, Math.trunc(options.topK)) }
              : {}),
            ...(this.shouldSendParameter(options, "frequencyPenalty") && options.frequencyPenalty
              ? { frequencyPenalty: options.frequencyPenalty }
              : {}),
            ...(this.shouldSendParameter(options, "presencePenalty") && options.presencePenalty
              ? { presencePenalty: options.presencePenalty }
              : {}),
            ...(thinkingConfig ? { thinkingConfig } : {}),
            ...googleResponseFormatConfig(options.responseFormat),
            ...(options.stop?.length ? { stopSequences: options.stop } : {}),
          }
        : {}),
    };

    if (systemMessages.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }],
      };
    }

    this.applyCustomParameters(body, options);

    const authHeaders =
      this.providerKind === "google_vertex"
        ? await googleAuthHeadersForVertex(this.apiKey)
        : this.apiKey.trim()
          ? { "x-goog-api-key": this.apiKey.trim() }
          : {};

    const response = await llmFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    async function readDecodedText() {
      return decodePossiblyCompressedBody(Buffer.from(await response.arrayBuffer())).toString("utf8");
    }

    if (!response.ok) {
      const errorText = await readDecodedText();
      const label = this.providerKind === "google_vertex" ? "Vertex AI Gemini API" : "Gemini API";
      throw new Error(`${label} error ${response.status}: ${sanitizeApiError(errorText)}`);
    }

    // ── Non-streaming path (also used when thinking is enabled) ──
    if (!useStreaming) {
      const json = JSON.parse(await readDecodedText()) as GeminiResponsePayload;
      const candidate = json.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const hasVisibleText = parts.some(
        (part) => !part.thought && typeof part.text === "string" && part.text.length > 0,
      );
      assertGeminiUsableResponse(json, candidate, hasVisibleText);

      // Report full parts (with thought signatures) for storage
      if (options.onResponseParts) options.onResponseParts(parts);

      for (const part of parts) {
        if (part.thought && part.text && options.onThinking) {
          options.onThinking(part.text);
        } else if (part.text && !part.thought) {
          yield part.text;
        }
      }
      if (json.usageMetadata) {
        return {
          promptTokens: json.usageMetadata.promptTokenCount,
          completionTokens: json.usageMetadata.candidatesTokenCount,
          totalTokens: json.usageMetadata.totalTokenCount,
          completionReasoningTokens: json.usageMetadata.thoughtsTokenCount,
        };
      }
      return;
    }

    // ── SSE streaming path (no thinking) ──
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const onAbort = () => reader.cancel().catch(() => {});
    if (options.signal) {
      if (options.signal.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let streamUsage: LLMUsage | undefined;

    // Accumulators for reconstructing response parts
    let thoughtText = "";
    let responseText = "";
    let lastSignature: string | undefined;
    let sawCandidate = false;
    let lastFinishReason: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trimStart();

          let parsed: GeminiResponsePayload;
          try {
            parsed = JSON.parse(data) as GeminiResponsePayload;
          } catch {
            // Skip malformed lines
            continue;
          }

          const apiError = formatGeminiApiError(parsed.error);
          if (apiError) throw new Error(`Gemini API streaming error: ${apiError}`);

          const blockReason = formatGeminiPromptBlock(parsed.promptFeedback);
          if (blockReason) throw new Error(`Gemini blocked the prompt (${blockReason})`);

          if (parsed.usageMetadata) {
            streamUsage = {
              promptTokens: parsed.usageMetadata.promptTokenCount,
              completionTokens: parsed.usageMetadata.candidatesTokenCount,
              totalTokens: parsed.usageMetadata.totalTokenCount,
              completionReasoningTokens: parsed.usageMetadata.thoughtsTokenCount,
            };
          }
          const candidate = parsed.candidates?.[0];
          const parts: GeminiPart[] = candidate?.content?.parts ?? [];
          if (candidate) {
            sawCandidate = true;
            if (candidate.finishReason) lastFinishReason = candidate.finishReason;
          }
          const finishError = geminiFinishReasonError(
            candidate?.finishReason,
            responseText.length > 0 || parts.length > 0,
          );
          if (finishError) throw new Error(finishError);

          for (const part of parts) {
            // Capture thought signature from any part
            if (part.thoughtSignature) lastSignature = part.thoughtSignature;

            if (part.thought && part.text) {
              // Thought summary part
              thoughtText += part.text;
              if (options.onThinking) options.onThinking(part.text);
            } else if (part.text && !part.thought) {
              // Regular text part
              responseText += part.text;
              yield part.text;
            }
          }
        }
        if (done) break;
      }
    } finally {
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    }

    if (!responseText) {
      const finishError = geminiFinishReasonError(lastFinishReason, false);
      if (finishError) throw new Error(finishError);
      if (!sawCandidate)
        throw new Error("Gemini stream returned no candidates. The prompt may have been blocked or filtered.");
      throw new Error("Gemini stream returned no content.");
    }

    // Reconstruct the canonical parts array for storage (thought signatures + summaries)
    if (options.onResponseParts) {
      const responseParts: GeminiPart[] = [];
      if (thoughtText) responseParts.push({ text: thoughtText, thought: true });
      const textPart: GeminiPart = { text: responseText };
      if (lastSignature) textPart.thoughtSignature = lastSignature;
      responseParts.push(textPart);
      options.onResponseParts(responseParts);
    }

    if (streamUsage) return { ...streamUsage, finishReason: normalizeGeminiFinishReason(lastFinishReason) };
  }

  override async embed(_texts: string[], _model: string, _signal?: AbortSignal): Promise<number[][]> {
    const label = this.providerKind === "google_vertex" ? "Vertex AI Gemini" : "Google Gemini";
    throw new Error(
      `${label} connections do not support embeddings through Marinara's OpenAI-compatible /embeddings path. Configure a dedicated OpenAI-compatible or local embedding connection.`,
    );
  }
}
