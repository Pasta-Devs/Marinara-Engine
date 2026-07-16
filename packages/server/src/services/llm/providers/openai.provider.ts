// ──────────────────────────────────────────────
// LLM Provider — OpenAI (& OAI-Compatible)
// ──────────────────────────────────────────────
import {
  BaseLLMProvider,
  llmFetch,
  sanitizeApiError,
  type ChatMessage,
  type ChatOptions,
  type ChatCompletionResult,
  type LLMToolCall,
  type LLMToolDefinition,
  type LLMUsage,
} from "../base-provider.js";
import { parseTextualToolCalls } from "../textual-tool-call-parser.js";
import {
  isClaudeAdaptiveOnlyNoSamplingModel,
  isOpenAIGpt56Model,
  isOpenAIGpt56SolProAlias,
  isXaiAutoReasoningModel,
  isXaiConfigurableReasoningModel,
  resolveOpenAIGpt56ModelForRequest,
  shouldSuppressUnknownModelParameters,
} from "@marinara-engine/shared";
import { logger } from "../../../lib/logger.js";
import { applyGlmThinkingParameters } from "./glm-request-compat.js";

/**
 * Models that ONLY support the Responses API (`/responses`) and not Chat Completions.
 * GPT-5.6, GPT-5.5, GPT-5.4 variants (base, pro, mini, dated snapshots), and Codex models use Responses.
 * Matching is case-insensitive.
 */
const RESPONSES_ONLY_PREFIXES = ["gpt-5.6", "gpt-5.5", "gpt-5.4", "codex-"];
const RESPONSES_ONLY_SUFFIXES = ["-codex", "-codex-max", "-codex-mini"];

type ChatCompletionsUsagePayload = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
};

type ResponsesUsagePayload = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
};

type OpenAIProviderKind =
  | "openai"
  | "openrouter"
  | "nanogpt"
  | "xai"
  | "mistral"
  | "cohere"
  | "custom"
  | "openai-chatgpt"
  | "local-sidecar";

export function normalizeOpenAIChatCompletionsResponseFormat(
  responseFormat: { type: string; [key: string]: unknown } | undefined,
): unknown | undefined {
  if (!responseFormat) return undefined;

  if (responseFormat.type === "json_schema") {
    if (responseFormat.json_schema && typeof responseFormat.json_schema === "object") return responseFormat;
    if (
      typeof responseFormat.name === "string" &&
      responseFormat.schema &&
      typeof responseFormat.schema === "object"
    ) {
      return {
        type: "json_schema",
        json_schema: {
          name: responseFormat.name,
          schema: responseFormat.schema,
          strict: responseFormat.strict === true,
        },
      };
    }
  }

  return responseFormat;
}

/**
 * Handles OpenAI, OpenRouter, Mistral, Cohere, and any OpenAI-compatible endpoint.
 */
export class OpenAIProvider extends BaseLLMProvider {
  constructor(
    baseUrl: string,
    apiKey: string,
    defaultMaxContext?: number,
    defaultOpenrouterProvider?: string | null,
    maxTokensOverride?: number | null,
    private readonly providerKind: OpenAIProviderKind = "openai",
    private readonly extraHeaders?: Record<string, string>,
    /** When true, body.tools is sent even if the model name triggers parameter suppression. */
    private readonly allowsToolCalling: boolean = false,
  ) {
    super(baseUrl, apiKey, defaultMaxContext, defaultOpenrouterProvider, maxTokensOverride);
  }

  private static openAIFileContentParts(
    files: ChatMessage["files"] | undefined,
    mode: "chat_completions" | "responses",
  ): Array<Record<string, unknown>> {
    if (!files?.length) return [];
    return files.map((file) =>
      mode === "responses"
        ? {
            type: "input_file",
            filename: file.filename ?? "attachment.pdf",
            file_data: file.data,
          }
        : {
            type: "file",
            file: {
              filename: file.filename ?? "attachment.pdf",
              file_data: file.data,
            },
          },
    );
  }

  private static dataUrlPayload(data: string): { mimeType: string; base64: string } | null {
    const match = data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1]?.toLowerCase() ?? "", base64: match[2] ?? "" };
  }

  private static openAIAudioFormat(mimeType: string, filename?: string): "wav" | "mp3" | null {
    const normalized = mimeType.toLowerCase().split(";", 1)[0] ?? "";
    const ext = filename?.toLowerCase().split(".").pop();
    if (normalized === "audio/wav" || normalized === "audio/x-wav" || normalized === "audio/wave" || ext === "wav") {
      return "wav";
    }
    if (normalized === "audio/mpeg" || normalized === "audio/mp3" || ext === "mp3") return "mp3";
    return null;
  }

  private static openAIMediaContentParts(media: ChatMessage["media"] | undefined): Array<Record<string, unknown>> {
    if (!media?.length) return [];
    const parts: Array<Record<string, unknown>> = [];
    for (const item of media) {
      if (item.kind !== "audio") continue;
      const payload = OpenAIProvider.dataUrlPayload(item.data);
      if (!payload) continue;
      const format = OpenAIProvider.openAIAudioFormat(item.mimeType || payload.mimeType, item.filename);
      if (!format) continue;
      parts.push({ type: "input_audio", input_audio: { data: payload.base64, format } });
    }
    return parts;
  }

  private static hasProviderNativeMedia(messages: ChatMessage[]): boolean {
    return messages.some((message) => message.media?.length);
  }

  private static async parseJsonBody<T>(response: Response, context: string): Promise<T> {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as T;
    } catch (jsonErr) {
      // Some provider/proxy stacks may ignore stream=false and still return SSE frames.
      const ssePayload = OpenAIProvider.extractSseJsonPayload(raw);
      if (ssePayload) {
        try {
          return JSON.parse(ssePayload) as T;
        } catch {
          // Fall through to the detailed error below.
        }
      }

      const preview = raw.slice(0, 200).replace(/\s+/g, " ");
      const message = jsonErr instanceof Error ? jsonErr.message : "Unknown JSON parse failure";
      throw new Error(`${context}: Failed to parse JSON response (${message}). Body starts with: ${preview}`);
    }
  }

  private shouldSuppressModelParameters(options: ChatOptions): boolean {
    return (
      options.suppressModelParameters === true || shouldSuppressUnknownModelParameters(this.providerKind, options.model)
    );
  }

  private static extractSseJsonPayload(raw: string): string | null {
    const lines = raw.split(/\r?\n/);
    let fallbackPayload: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      const payload = OpenAIProvider.extractSseData(trimmed);
      if (payload == null) continue;
      if (!payload || payload === "[DONE]") continue;
      fallbackPayload = payload;
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const firstChoice = Array.isArray(parsed.choices)
          ? (parsed.choices[0] as { message?: { content?: unknown }; delta?: { content?: unknown } } | undefined)
          : undefined;
        const content = firstChoice?.message?.content ?? firstChoice?.delta?.content;
        if ((typeof content === "string" && content.trim()) || (Array.isArray(content) && content.length > 0)) {
          return payload;
        }
      } catch {
        // Keep scanning. parseJsonBody reports the detailed error if recovery fails.
      }
    }
    return fallbackPayload;
  }

  private static extractSseData(trimmedLine: string): string | null {
    if (!trimmedLine.startsWith("data:")) return null;
    return trimmedLine.slice(5).trimStart();
  }

  private static extractSseEvent(trimmedLine: string): string | null {
    if (!trimmedLine.startsWith("event:")) return null;
    return trimmedLine.slice(6).trimStart();
  }

  private static extractProviderErrorMessage(json: Record<string, unknown>): string {
    const error = json.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string") return message;
    }
    const message = json.message;
    return typeof message === "string" ? message : "";
  }

  private static requireChatCompletionsChoices<T>(json: Record<string, unknown>, context: string): T[] {
    if (Array.isArray(json.choices)) return json.choices as T[];
    const providerMessage = OpenAIProvider.extractProviderErrorMessage(json);
    const detail = providerMessage ? `: ${sanitizeApiError(providerMessage)}` : "";
    throw new Error(`${context}: OpenAI API response missing choices${detail}`);
  }

  private static assertResponsesSucceeded(json: Record<string, unknown>, context: string): void {
    const status = typeof json.status === "string" ? json.status : "";
    if (status === "failed") {
      const providerMessage = OpenAIProvider.extractProviderErrorMessage(json);
      const detail = providerMessage ? `: ${sanitizeApiError(providerMessage)}` : "";
      throw new Error(`${context}: OpenAI Responses API response failed${detail}`);
    }
    if (status === "incomplete") {
      const reason = (json.incomplete_details as Record<string, unknown> | undefined)?.reason ?? "unknown";
      logger.warn("[OpenAI Responses] %s returned incomplete response (reason=%s)", context, reason);
    }
  }

  private static normalizeResponsesIncompleteFinishReason(reason: unknown): string {
    const normalized = typeof reason === "string" ? reason.trim().toLowerCase() : "";
    if (!normalized) return "unknown";
    if (normalized === "max_output_tokens" || normalized === "max_tokens" || normalized === "length") {
      return "length";
    }
    return normalized;
  }

  private static normalizeTopP(topP: number | null | undefined): number | undefined {
    if (topP == null || !Number.isFinite(topP)) return undefined;
    if (topP < 0) return undefined;
    return Math.min(topP, 1);
  }

  private normalizeChatCompletionsResponseFormat(responseFormat?: { type: string }): unknown | undefined {
    return normalizeOpenAIChatCompletionsResponseFormat(responseFormat);
  }

  /**
   * Extract text and thinking from an OpenRouter/Anthropic-style content block array.
   * OpenRouter may return `content` as an array of typed blocks instead of a plain string:
   *   [{ type: "thinking", thinking: "..." }, { type: "text", text: "..." }]
   */
  private static extractContentBlocks(content: unknown): { text: string; thinking: string } | null {
    if (!Array.isArray(content)) return null;
    let text = "";
    let thinking = "";
    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b.type === "thinking" && typeof b.thinking === "string") {
        thinking += b.thinking;
      } else if (b.type === "text" && typeof b.text === "string") {
        text += b.text;
      }
    }
    return { text, thinking };
  }

  private shouldSendTopK(): boolean {
    return this.apiKey === "local-sidecar";
  }

  /**
   * Extract reasoning/thinking from an OpenAI-compatible message or delta object.
   * Handles multiple provider formats:
   *   - `reasoning_content` (DeepSeek native)
   *   - `reasoning` (OpenRouter / NanoGPT)
   *   - `reasoning_details` array (OpenRouter newer format)
   */
  private static extractReasoning(obj: Record<string, unknown> | undefined | null): string {
    if (!obj) return "";
    // Plain string fields
    if (typeof obj.reasoning_content === "string" && obj.reasoning_content) return obj.reasoning_content;
    if (typeof obj.reasoning === "string" && obj.reasoning) return obj.reasoning;
    // reasoning_details array: [{type:"reasoning.text", text:"..."}, {type:"reasoning.summary", summary:"..."}]
    if (Array.isArray(obj.reasoning_details)) {
      let text = "";
      for (const item of obj.reasoning_details) {
        if (typeof item !== "object" || item === null) continue;
        const d = item as Record<string, unknown>;
        if (d.type === "reasoning.text" && typeof d.text === "string") text += d.text;
        else if (d.type === "reasoning.summary" && typeof d.summary === "string") text += d.summary;
      }
      if (text) return text;
    }
    return "";
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private static toolCallId(index: number): string {
    return `call_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private static stringifyToolArguments(value: unknown): string {
    if (typeof value === "string") return value.trim() ? value : "{}";
    if (value === undefined || value === null) return "{}";
    try {
      return JSON.stringify(value);
    } catch {
      return "{}";
    }
  }

  private static normalizeToolCall(value: unknown, index: number): LLMToolCall | null {
    const raw = OpenAIProvider.asRecord(value);
    if (!raw) return null;
    const fn = OpenAIProvider.asRecord(raw.function) ?? raw;
    const name = typeof fn.name === "string" ? fn.name : typeof raw.name === "string" ? raw.name : "";
    if (!name) return null;
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : typeof raw.call_id === "string" && raw.call_id.trim()
          ? raw.call_id
          : OpenAIProvider.toolCallId(index);
    return {
      id,
      type: "function",
      function: {
        name,
        // "parameters" is used by some models instead of the OpenAI-standard "arguments"
        arguments: OpenAIProvider.stringifyToolArguments(
          fn.arguments ?? fn.parameters ?? raw.arguments ?? raw.args ?? raw.parameters,
        ),
      },
    };
  }

  private static normalizeToolCalls(value: unknown): LLMToolCall[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => OpenAIProvider.normalizeToolCall(item, index))
      .filter((call): call is LLMToolCall => call !== null);
  }

  /**
   * Preserve provider-native Chat Completions reasoning fields for replay.
   * DeepSeek thinking + tool calls requires `reasoning_content` to be passed
   * back on the assistant tool-call message. OpenRouter may also expose
   * `reasoning` or `reasoning_details` for the same continuity purpose.
   */
  private static extractReasoningMetadata(obj: Record<string, unknown> | undefined | null): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (!obj) return metadata;
    if (typeof obj.reasoning_content === "string" && obj.reasoning_content) {
      metadata.reasoning_content = obj.reasoning_content;
    }
    if (typeof obj.reasoning === "string" && obj.reasoning) {
      metadata.reasoning = obj.reasoning;
    }
    if (Array.isArray(obj.reasoning_details) && obj.reasoning_details.length) {
      metadata.reasoning_details = OpenAIProvider.mergeReasoningDetails([], obj.reasoning_details);
    }
    return metadata;
  }

  private static reasoningDetailMergeKey(item: Record<string, unknown>): string | null {
    const type = typeof item.type === "string" ? item.type : "";
    const format = typeof item.format === "string" ? item.format : "";
    const id =
      typeof item.id === "string"
        ? item.id
        : typeof item.signature === "string"
          ? item.signature
          : typeof item.index === "number"
            ? String(item.index)
            : "";
    if (!id) return null;
    return `${type}|${format}|${id}`;
  }

  private static mergeReasoningDetailStrings(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): void {
    for (const field of ["text", "summary", "thinking"] as const) {
      const next = incoming[field];
      if (typeof next !== "string" || next.length === 0) continue;
      const current = existing[field];
      existing[field] = typeof current === "string" ? `${current}${next}` : next;
    }
  }

  private static mergeReasoningDetails(existing: unknown[], incoming: unknown[]): Record<string, unknown>[] {
    const merged: Record<string, unknown>[] = existing
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({ ...item }));
    const keyed = new Map<string, Record<string, unknown>>();
    for (const item of merged) {
      const key = OpenAIProvider.reasoningDetailMergeKey(item);
      if (key) keyed.set(key, item);
    }

    for (const item of incoming) {
      if (typeof item !== "object" || item === null) continue;
      const incomingDetail = item as Record<string, unknown>;
      const key = OpenAIProvider.reasoningDetailMergeKey(incomingDetail);
      const existingDetail = key ? keyed.get(key) : undefined;
      if (!existingDetail) {
        const clone = { ...incomingDetail };
        merged.push(clone);
        if (key) keyed.set(key, clone);
        continue;
      }

      OpenAIProvider.mergeReasoningDetailStrings(existingDetail, incomingDetail);
      for (const [field, value] of Object.entries(incomingDetail)) {
        if (field === "text" || field === "summary" || field === "thinking") continue;
        if (value !== undefined && value !== null) {
          existingDetail[field] = value;
        }
      }
    }

    return merged;
  }

  private static appendReasoningMetadata(
    target: Record<string, unknown>,
    obj: Record<string, unknown> | undefined | null,
  ): void {
    const metadata = OpenAIProvider.extractReasoningMetadata(obj);
    if (typeof metadata.reasoning_content === "string") {
      const current = typeof target.reasoning_content === "string" ? target.reasoning_content : "";
      target.reasoning_content = `${current}${metadata.reasoning_content}`;
    }
    if (typeof metadata.reasoning === "string") {
      const current = typeof target.reasoning === "string" ? target.reasoning : "";
      target.reasoning = `${current}${metadata.reasoning}`;
    }
    if (Array.isArray(metadata.reasoning_details)) {
      target.reasoning_details = OpenAIProvider.mergeReasoningDetails(
        Array.isArray(target.reasoning_details) ? target.reasoning_details : [],
        metadata.reasoning_details,
      );
    }
  }

  private static hasReasoningMetadata(metadata: Record<string, unknown> | undefined | null): boolean {
    if (!metadata) return false;
    return (
      (typeof metadata.reasoning_content === "string" && metadata.reasoning_content.length > 0) ||
      (typeof metadata.reasoning === "string" && metadata.reasoning.length > 0) ||
      (Array.isArray(metadata.reasoning_details) && metadata.reasoning_details.length > 0)
    );
  }

  private assistantReasoningPayload(
    providerMetadata: Record<string, unknown> | undefined,
    model?: string,
  ): Record<string, unknown> {
    if (!providerMetadata) return {};
    if (model && !this.shouldReplayChatCompletionsReasoning(model)) return {};
    const metadata = OpenAIProvider.extractReasoningMetadata(providerMetadata);
    if (Array.isArray(metadata.reasoning_details) && metadata.reasoning_details.length) {
      return { reasoning_details: metadata.reasoning_details };
    }
    return metadata;
  }

  private emitChatCompletionsReasoning(options: ChatOptions, metadata: Record<string, unknown>): void {
    if (!this.shouldReplayChatCompletionsReasoning(options.model)) return;
    if (OpenAIProvider.hasReasoningMetadata(metadata)) {
      options.onChatCompletionsReasoning?.(metadata);
    }
  }

  /** Build standard request headers. OpenRouter attribution is enforced by safeFetch. */
  private buildHeaders(): Record<string, string> {
    const apiKey = this.apiKey.trim();
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      // Only send auth when a real key is present: a blank `Bearer ` (a decrypt
      // failure, a whitespace-only key, or an intentionally keyless local
      // endpoint) is worse than none.
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(this.extraHeaders ?? {}),
    };
    return h;
  }

  private isGenericCustomProvider(): boolean {
    return this.providerKind === "custom";
  }

  private isOpenAIChatGPTProvider(): boolean {
    return this.providerKind === "openai-chatgpt";
  }

  private chatCompletionsErrorLabel(): string {
    switch (this.providerKind) {
      case "custom":
        return "Custom OpenAI-compatible endpoint";
      case "openrouter":
        return "OpenRouter API";
      case "nanogpt":
        return "NanoGPT API";
      case "xai":
        return "xAI API";
      case "mistral":
        return "Mistral API";
      case "cohere":
        return "Cohere OpenAI-compatible API";
      case "local-sidecar":
        return "Local sidecar OpenAI-compatible endpoint";
      case "openai-chatgpt":
        return "OpenAI ChatGPT endpoint";
      case "openai":
      default:
        return "OpenAI API";
    }
  }

  private formatChatCompletionsHttpError(status: number, errorText: string, stream: boolean): string {
    const detail = sanitizeApiError(errorText);
    const streamingHint =
      this.isGenericCustomProvider() && stream && /\bstream(?:ing)?\b/i.test(detail)
        ? " This custom endpoint rejected token streaming; disable token streaming and retry, or choose a model that supports streaming."
        : "";
    return `${this.chatCompletionsErrorLabel()} error ${status}: ${detail}${streamingHint}`;
  }

  private isGpt55Model(model: string): boolean {
    return model.toLowerCase().startsWith("gpt-5.5");
  }

  private isOpenAIGpt55Or56Model(model: string): boolean {
    const normalized = model.toLowerCase();
    return normalized.startsWith("gpt-5.5") || isOpenAIGpt56Model(normalized);
  }

  private isResponsesStreamingUnsupportedModel(model: string): boolean {
    const normalized = model.toLowerCase();
    // GPT-5.6 Pro mode is an execution mode that returns a single final answer;
    // only our app-level Sol Pro alias opts into it automatically.
    return normalized.startsWith("gpt-5.5-pro") || isOpenAIGpt56SolProAlias(normalized);
  }

  /** Check if a model ID represents an OpenAI reasoning model */
  private isReasoningModel(model: string): boolean {
    if (this.isGenericCustomProvider() && !this.isOpenAIGpt55Or56Model(model)) return false;
    const m = model.toLowerCase();
    return /^(o1|o3|o4)/.test(m) || m.startsWith("gpt-5");
  }

  private isXAIEndpoint(): boolean {
    if (this.isGenericCustomProvider()) return false;
    const baseUrl = this.baseUrl.toLowerCase();
    return baseUrl.includes("api.x.ai") || baseUrl.includes("x.ai/");
  }

  private isOpenRouterXAIModel(model: string): boolean {
    return (
      !this.isGenericCustomProvider() &&
      this.baseUrl.includes("openrouter.ai") &&
      model.toLowerCase().startsWith("x-ai/grok-")
    );
  }

  private isXAIMultiAgentModel(model: string): boolean {
    if (this.isGenericCustomProvider()) return false;
    return model.toLowerCase() === "grok-4.20-multi-agent";
  }

  private isNativeXAIConfigurableReasoningModel(model: string): boolean {
    return this.isXAIEndpoint() && isXaiConfigurableReasoningModel(model);
  }

  private isXAIReasoningModel(model: string): boolean {
    if (!this.isXAIEndpoint() && !this.isOpenRouterXAIModel(model)) return false;
    const m = model.toLowerCase();
    return (
      m.startsWith("x-ai/grok-") ||
      isXaiConfigurableReasoningModel(m) ||
      isXaiAutoReasoningModel(m) ||
      this.isXAIMultiAgentModel(model)
    );
  }

  private resolveXAIReasoningEffort(reasoningEffort?: string | null): "none" | "low" | "medium" | "high" | null {
    switch (reasoningEffort) {
      case "none":
      case "low":
      case "medium":
      case "high":
        return reasoningEffort;
      case "xhigh":
      case "max":
      case "maximum":
        return "high";
      default:
        return null;
    }
  }

  private shouldSendStopSequences(model: string): boolean {
    return !this.isXAIReasoningModel(model);
  }

  private shouldSendPenaltyParams(model: string): boolean {
    return !this.isXAIReasoningModel(model);
  }

  /**
   * Check if a model/config does NOT support temperature/topP.
   * o-series models never do.
   * GPT-5.6/GPT-5.5 reject sampling params entirely; older GPT-5.x models only
   * reject them when reasoning effort is active.
   */
  private isNoTemperatureModel(model: string, reasoningEffort?: string): boolean {
    if (this.isGenericCustomProvider() && !this.isOpenAIGpt55Or56Model(model)) return false;
    const m = model.toLowerCase();
    if (/^(o1|o3|o4)/.test(m)) return true;
    if (isOpenAIGpt56Model(m)) return true;
    if (this.isGpt55Model(model)) return true;
    if (m.startsWith("gpt-5") && reasoningEffort && reasoningEffort !== "none") return true;
    // Claude adaptive-only models forbid all sampling params (covers reverse proxies).
    if (isClaudeAdaptiveOnlyNoSamplingModel(m)) return true;
    return false;
  }

  private stripUnsupportedSamplerParameters(body: Record<string, unknown>, options: ChatOptions): void {
    if (!this.isNoTemperatureModel(options.model, options.reasoningEffort)) return;
    delete body.temperature;
    delete body.top_p;
    delete body.top_k;
    delete body.min_p;
    delete body.frequency_penalty;
    delete body.presence_penalty;
  }

  private hasActiveReasoningEffort(reasoningEffort?: string | null): boolean {
    return !!reasoningEffort && reasoningEffort !== "none";
  }

  private requestReasoningLogValue(body: Record<string, unknown>): string {
    if (typeof body.reasoning_effort === "string") return body.reasoning_effort;
    if (!body.reasoning || typeof body.reasoning !== "object" || Array.isArray(body.reasoning)) return "none";
    const reasoning = body.reasoning as Record<string, unknown>;
    if (typeof reasoning.effort === "string") return reasoning.effort;
    if (reasoning.enabled === true) return "enabled";
    return Object.keys(reasoning).length > 0 ? "configured" : "none";
  }

  private isOpenRouterEndpoint(): boolean {
    return (
      this.providerKind === "openrouter" || (!this.isGenericCustomProvider() && this.baseUrl.includes("openrouter.ai"))
    );
  }

  private supportsOpenRouterUnifiedReasoning(model: string): boolean {
    if (!this.isOpenRouterEndpoint()) return false;
    const m = model.toLowerCase();
    return (
      m.includes("claude-3.7") ||
      /claude-(?:opus|sonnet|haiku)-4(?:[.-]|\b)/.test(m) ||
      isClaudeAdaptiveOnlyNoSamplingModel(m)
    );
  }

  private isOpenRouterGeminiModel(model: string): boolean {
    if (!this.isOpenRouterEndpoint()) return false;
    const m = model.toLowerCase();
    return m.startsWith("google/gemini") || m.includes("/gemini-");
  }

  private shouldReplayChatCompletionsReasoning(model: string): boolean {
    return !this.isOpenRouterGeminiModel(model) && !this.supportsOpenRouterUnifiedReasoning(model);
  }

  private shouldSendReasoningEffort(model: string, reasoningEffort?: string | null): boolean {
    return this.isReasoningModel(model) && this.hasActiveReasoningEffort(reasoningEffort);
  }

  private applyChatCompletionsReasoning(body: Record<string, unknown>, options: ChatOptions): void {
    if (this.isNativeXAIConfigurableReasoningModel(options.model)) {
      const effort = this.resolveXAIReasoningEffort(options.reasoningEffort);
      if (effort) body.reasoning_effort = effort;
      return;
    }

    if (this.isXAIReasoningModel(options.model)) {
      return;
    }

    if (
      applyGlmThinkingParameters(body, {
        model: options.model,
        baseUrl: this.baseUrl,
        providerKind: this.providerKind,
        enableThinking: options.enableThinking,
        reasoningEffort: options.reasoningEffort,
      })
    )
      return;

    if (this.isOpenRouterEndpoint() && this.hasActiveReasoningEffort(options.reasoningEffort)) {
      const existingReasoning =
        body.reasoning && typeof body.reasoning === "object" && !Array.isArray(body.reasoning)
          ? (body.reasoning as Record<string, unknown>)
          : {};
      body.reasoning = { ...existingReasoning, effort: options.reasoningEffort };
      return;
    }

    if (this.shouldSendReasoningEffort(options.model, options.reasoningEffort)) {
      body.reasoning_effort = options.reasoningEffort;
    }
  }

  private applyResponsesReasoning(body: Record<string, unknown>, options: ChatOptions): void {
    if (this.isXAIMultiAgentModel(options.model)) {
      if (this.hasActiveReasoningEffort(options.reasoningEffort)) {
        body.reasoning = { effort: options.reasoningEffort };
      }
      return;
    }

    if (this.isNativeXAIConfigurableReasoningModel(options.model)) {
      const effort = this.resolveXAIReasoningEffort(options.reasoningEffort);
      if (effort) body.reasoning = { effort };
      return;
    }

    if (this.isXAIReasoningModel(options.model)) {
      return;
    }

    if (
      applyGlmThinkingParameters(body, {
        model: options.model,
        baseUrl: this.baseUrl,
        providerKind: this.providerKind,
        enableThinking: options.enableThinking,
        reasoningEffort: options.reasoningEffort,
      })
    )
      return;

    if (!this.isReasoningModel(options.model)) {
      return;
    }

    const reasoning: Record<string, unknown> = {};
    if (
      this.shouldSendParameter(options, "reasoningEffort") &&
      this.hasActiveReasoningEffort(options.reasoningEffort)
    ) {
      reasoning.effort = options.reasoningEffort;
    }
    const normalizedModel = options.model.toLowerCase();
    if (isOpenAIGpt56SolProAlias(normalizedModel)) {
      reasoning.mode = "pro";
    }
    if (isOpenAIGpt56Model(normalizedModel) && options.excludePastReasoning !== undefined) {
      reasoning.context = options.excludePastReasoning ? "current_turn" : "all_turns";
    }
    if (options.enableThinking) {
      reasoning.summary = "auto";
    }
    if (Object.keys(reasoning).length > 0) {
      body.reasoning = reasoning;
    }
  }

  /** Check if a model requires or benefits from the Responses API instead of Chat Completions */
  private useResponsesAPI(model: string, options?: Pick<ChatOptions, "captureReasoning">): boolean {
    if (this.isOpenAIChatGPTProvider()) return true;
    // Custom providers generally only implement /chat/completions — never force
    // /responses for them, even for GPT-5.5. Reasoning-model parameter tweaks
    // (max_completion_tokens, temperature suppression) still apply via
    // isReasoningModel / isNoTemperatureModel which have their own GPT-5.5 gates.
    if (this.isGenericCustomProvider()) return false;
    if (this.isGpt55Model(model)) return true;
    const m = model.toLowerCase();
    return (
      this.isXAIMultiAgentModel(model) ||
      (!!options?.captureReasoning && this.isXAIReasoningModel(model)) ||
      RESPONSES_ONLY_PREFIXES.some((p) => m.startsWith(p)) ||
      RESPONSES_ONLY_SUFFIXES.some((s) => m.endsWith(s))
    );
  }

  private shouldUseOpenRouterPromptCaching(options: ChatOptions): boolean {
    return (
      !this.isGenericCustomProvider() &&
      this.baseUrl.includes("openrouter.ai") &&
      !!options.enableCaching &&
      options.model.toLowerCase().includes("claude")
    );
  }

  private applyOpenRouterPromptCaching(body: Record<string, unknown>, options: ChatOptions): void {
    if (!this.shouldUseOpenRouterPromptCaching(options)) return;
    body.cache_control = { type: "ephemeral" };
    logger.debug("[OpenAI] Enabling OpenRouter prompt caching for model=%s", options.model);
  }

  private supportsGpt5Verbosity(model: string): boolean {
    if (this.isOpenAIChatGPTProvider()) return false;
    return (
      (!this.isGenericCustomProvider() || this.isOpenAIGpt55Or56Model(model)) && model.toLowerCase().startsWith("gpt-5")
    );
  }

  private applyResponsesTextOptions(body: Record<string, unknown>, options: ChatOptions): void {
    const textOptions =
      body.text && typeof body.text === "object" && !Array.isArray(body.text)
        ? (body.text as Record<string, unknown>)
        : {};

    if (
      this.shouldSendParameter(options, "verbosity") &&
      options.verbosity &&
      this.supportsGpt5Verbosity(options.model)
    ) {
      textOptions.verbosity = options.verbosity;
    }

    if (options.responseFormat) {
      textOptions.format = options.responseFormat;
    }

    if (Object.keys(textOptions).length > 0) {
      body.text = textOptions;
    }
  }

  private shouldApplyOpenRouterProviderOverride(openrouterProvider?: string | null): boolean {
    return !!openrouterProvider && !this.isGenericCustomProvider() && this.baseUrl.includes("openrouter.ai");
  }

  private resolveOpenRouterServiceTier(serviceTier?: string | null): "flex" | "priority" | null {
    if (serviceTier !== "flex" && serviceTier !== "priority") return null;
    if (this.isGenericCustomProvider() || !this.baseUrl.includes("openrouter.ai")) return null;
    return serviceTier;
  }

  private applyOpenRouterServiceTier(body: Record<string, unknown>, options: ChatOptions): void {
    const serviceTier = this.resolveOpenRouterServiceTier(options.serviceTier);
    if (serviceTier) body.service_tier = serviceTier;
  }

  private static extractChatCompletionsUsage(usage: ChatCompletionsUsagePayload | undefined): LLMUsage | undefined {
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
      cachedPromptTokens: usage.prompt_tokens_details?.cached_tokens,
      cacheWritePromptTokens: usage.prompt_tokens_details?.cache_write_tokens,
      completionReasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
      completionAudioTokens: usage.completion_tokens_details?.audio_tokens,
      acceptedPredictionTokens: usage.completion_tokens_details?.accepted_prediction_tokens,
      rejectedPredictionTokens: usage.completion_tokens_details?.rejected_prediction_tokens,
    };
  }

  /**
   * Whether this model uses "developer" role instead of "system" in Chat Completions.
   * OpenAI GPT-5.x and o-series models use "developer" for system-level instructions.
   */
  private usesDeveloperRole(model: string): boolean {
    if (this.isGenericCustomProvider()) return false;
    const m = model.toLowerCase();
    return m.startsWith("gpt-5") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
  }

  private formatMessages(messages: ChatMessage[], model?: string) {
    const devRole = model && this.usesDeveloperRole(model);
    return messages
      .filter((m) => {
        // Keep tool messages and assistant messages with tool_calls regardless of content
        if (m.role === "tool") return true;
        if (m.role === "assistant" && m.tool_calls?.length) return true;
        // Drop messages with no text or provider-native attachments.
        return m.content?.trim() || m.images?.length || m.files?.length || m.media?.length;
      })
      .map((m) => {
        const reasoningPayload =
          m.role === "assistant" ? this.assistantReasoningPayload(m.providerMetadata, model) : {};
        if (m.role === "tool") {
          return { role: "tool" as const, content: m.content, tool_call_id: m.tool_call_id };
        }
        if (m.role === "assistant" && m.tool_calls?.length) {
          return {
            role: "assistant" as const,
            content: m.content || null,
            tool_calls: m.tool_calls,
            ...reasoningPayload,
          };
        }
        // Multimodal/file input: use content array format
        if (m.images?.length || m.files?.length || m.media?.length) {
          const parts: Array<Record<string, unknown>> = [
            ...OpenAIProvider.openAIFileContentParts(m.files, "chat_completions"),
          ];
          if (m.content) parts.push({ type: "text", text: m.content });
          for (const img of m.images ?? []) {
            parts.push({ type: "image_url", image_url: { url: img } });
          }
          parts.push(...OpenAIProvider.openAIMediaContentParts(m.media));
          return { role: m.role, content: parts };
        }
        // Map system → developer for newer OpenAI models
        const role = m.role === "system" && devRole ? "developer" : m.role;
        return { role, content: m.content, ...reasoningPayload };
      });
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const suppressModelParameters = this.shouldSuppressModelParameters(options);
    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model);
    const maxTokens =
      configuredMaxTokens === undefined
        ? undefined
        : this.applyMaxTokensCap(contextFit.maxTokens ?? configuredMaxTokens);

    // Route to Responses API for models that require it
    if (!OpenAIProvider.hasProviderNativeMedia(messages) && this.useResponsesAPI(options.model, options)) {
      logger.debug(
        "[OpenAI] Routing chat() to Responses API for model=%s stream=%s",
        options.model,
        options.stream ?? true,
      );
      return yield* this.chatResponses(messages, { ...options, maxTokens });
    }

    const url = `${this.baseUrl}/chat/completions`;
    const reasoning = this.isReasoningModel(options.model);

    const formatted = this.formatMessages(messages, options.model);
    // Ensure at least one non-system message exists (some providers like Gemini
    // reject requests with only system messages)
    if (!formatted.some((m) => m.role !== "system" && m.role !== "developer")) {
      formatted.push({ role: "user", content: "Continue." });
    }

    const effectiveStream = options.stream ?? true;

    const body: Record<string, unknown> = {
      model: options.model,
      messages: formatted,
    };
    if (effectiveStream || !suppressModelParameters) {
      body.stream = effectiveStream;
    }

    if (this.shouldSendParameter(options, "maxTokens") && reasoning) {
      // Reasoning models use max_completion_tokens instead of max_tokens
      body.max_completion_tokens = maxTokens;
    } else if (this.shouldSendParameter(options, "maxTokens")) {
      body.max_tokens = maxTokens;
    }

    if (!suppressModelParameters) {
      if (this.shouldSendStopSequences(options.model) && options.stop?.length) body.stop = options.stop;
      if (options.tools?.length && !options.forceTextualToolCalls) body.tools = options.tools;
      if (effectiveStream) body.stream_options = { include_usage: true };

      // o-series models never support temperature/topP; GPT-5.x only with effort=none
      if (!this.isNoTemperatureModel(options.model, options.reasoningEffort)) {
        if (this.shouldSendParameter(options, "temperature")) body.temperature = options.temperature ?? 1;
        const topP = this.shouldSendParameter(options, "topP") ? OpenAIProvider.normalizeTopP(options.topP) : undefined;
        if (topP != null) body.top_p = topP;
        if (
          this.shouldSendParameter(options, "topK") &&
          this.shouldSendTopK() &&
          typeof options.topK === "number" &&
          Number.isFinite(options.topK) &&
          options.topK > 0
        ) {
          body.top_k = Math.round(options.topK);
        }
        // min_p, like top_k, is a non-standard sampler only sent where the backend
        // is known to accept it (the bundled local model); other backends can use
        // the customParameters escape hatch. minP=0 means "disabled" → omit it.
        if (
          this.shouldSendTopK() &&
          typeof options.minP === "number" &&
          Number.isFinite(options.minP) &&
          options.minP > 0
        ) {
          body.min_p = options.minP;
        }
        if (this.shouldSendPenaltyParams(options.model)) {
          if (this.shouldSendParameter(options, "frequencyPenalty") && options.frequencyPenalty) {
            body.frequency_penalty = options.frequencyPenalty;
          }
          if (this.shouldSendParameter(options, "presencePenalty") && options.presencePenalty) {
            body.presence_penalty = options.presencePenalty;
          }
        }
      }

      if (
        this.shouldSendParameter(options, "verbosity") &&
        options.verbosity &&
        this.supportsGpt5Verbosity(options.model)
      ) {
        body.verbosity = options.verbosity;
      }

      // OpenRouter provider routing preference
      const openrouterProvider = this.resolveOpenrouterProvider(options.openrouterProvider);
      if (this.shouldApplyOpenRouterProviderOverride(openrouterProvider)) {
        body.provider = { order: [openrouterProvider] };
      }

      this.applyOpenRouterPromptCaching(body, options);

      // Force response format (e.g. JSON mode)
      const normalizedResponseFormat = this.normalizeChatCompletionsResponseFormat(options.responseFormat);
      if (normalizedResponseFormat) {
        body.response_format = normalizedResponseFormat;
      }
    }

    if (
      this.shouldSendParameter(options, "reasoningEffort") &&
      (!suppressModelParameters || this.isOpenRouterEndpoint())
    ) {
      this.applyChatCompletionsReasoning(body, options);
    }

    this.applyOpenRouterServiceTier(body, options);
    this.applyCustomParameters(body, options);
    this.stripUnsupportedSamplerParameters(body, options);

    logger.debug(
      "[OpenAI chat()] stream=%s model=%s reasoning=%s enableThinking=%s verbosity=%s max_completion_tokens=%s max_tokens=%s temperature=%s top_p=%s tools=%s",
      body.stream,
      body.model,
      this.requestReasoningLogValue(body),
      !!options.enableThinking,
      body.verbosity ?? "default",
      body.max_completion_tokens ?? "n/a",
      body.max_tokens ?? "n/a",
      body.temperature ?? "default",
      body.top_p ?? "default",
      Array.isArray(body.tools) ? body.tools.length : 0,
    );

    const response = await llmFetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      bufferResponse: !effectiveStream,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatChatCompletionsHttpError(response.status, errorText, effectiveStream));
    }

    if (!effectiveStream) {
      const json = await OpenAIProvider.parseJsonBody<Record<string, unknown>>(
        response,
        "OpenAI chat() non-stream response",
      );
      const choices = OpenAIProvider.requireChatCompletionsChoices<{
        finish_reason?: string | null;
        message: Record<string, unknown> & { content: string | unknown[] | null; refusal?: string };
      }>(json, "OpenAI chat() non-stream response");
      const msg = choices[0]?.message;
      const refusal = typeof msg?.refusal === "string" && msg.refusal ? msg.refusal : "";
      const reasoningMetadata = OpenAIProvider.extractReasoningMetadata(msg);
      this.emitChatCompletionsReasoning(options, reasoningMetadata);
      const reasoning = OpenAIProvider.extractReasoning(msg);
      if (reasoning && options.onThinking) {
        options.onThinking(reasoning);
      }
      // Handle OpenRouter content block arrays (Anthropic-style)
      const blocks = OpenAIProvider.extractContentBlocks(msg?.content);
      if (blocks) {
        if (!reasoning && blocks.thinking && options.onThinking) options.onThinking(blocks.thinking);
        yield blocks.text || refusal;
      } else {
        yield (typeof msg?.content === "string" ? msg.content : "") || refusal;
      }
      const usage = OpenAIProvider.extractChatCompletionsUsage(json.usage as ChatCompletionsUsagePayload | undefined);
      const finishReason = choices[0]?.finish_reason;
      return usage && finishReason ? { ...usage, finishReason } : usage;
    }

    // Stream SSE response
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    // Ensure aborting the signal cancels the reader (closes the TCP connection
    // to the backend), even if undici doesn't propagate the abort automatically.
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
    let finishReason: string | undefined;
    const reasoningMetadata: Record<string, unknown> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();

        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          const data = OpenAIProvider.extractSseData(trimmed);
          if (data == null) continue;
          if (data === "[DONE]") {
            this.emitChatCompletionsReasoning(options, reasoningMetadata);
            if (streamUsage) return finishReason ? { ...streamUsage, finishReason } : streamUsage;
            return;
          }

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            // Skip malformed JSON lines
            continue;
          }
          // Capture usage from the final chunk (OpenAI sends it with stream_options)
          if (parsed.usage) {
            streamUsage = OpenAIProvider.extractChatCompletionsUsage(parsed.usage as ChatCompletionsUsagePayload);
          }
          if (!Array.isArray(parsed.choices)) {
            const providerMessage = OpenAIProvider.extractProviderErrorMessage(parsed);
            if (providerMessage) {
              throw new Error(`OpenAI chat() stream response missing choices: ${sanitizeApiError(providerMessage)}`);
            }
            continue;
          }
          const choice0 = parsed.choices[0] as
            | {
                finish_reason?: string | null;
                delta?: Record<string, unknown> & { content?: string | unknown[]; refusal?: string };
                message?: Record<string, unknown> & { content?: string | unknown[] | null; refusal?: string };
              }
            | undefined;
          if (choice0?.finish_reason) finishReason = choice0.finish_reason;
          const delta = choice0?.delta;
          const message = choice0?.message;
          OpenAIProvider.appendReasoningMetadata(reasoningMetadata, delta ?? message);
          const reasoning = OpenAIProvider.extractReasoning(delta ?? message);
          if (reasoning && options.onThinking) {
            options.onThinking(reasoning);
          }
          // Handle OpenRouter content block arrays (Anthropic-style)
          const content = delta?.content ?? message?.content;
          const refusal =
            (typeof delta?.refusal === "string" && delta.refusal) ||
            (typeof message?.refusal === "string" && message.refusal) ||
            "";
          const blocks = OpenAIProvider.extractContentBlocks(content);
          if (blocks) {
            if (!reasoning && blocks.thinking && options.onThinking) options.onThinking(blocks.thinking);
            if (blocks.text) yield blocks.text;
          } else if (typeof content === "string" && content) {
            yield content;
          } else if (refusal) {
            yield refusal;
          }
        }
        if (done) break;
      }
    } finally {
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    }
    this.emitChatCompletionsReasoning(options, reasoningMetadata);
    if (streamUsage) return finishReason ? { ...streamUsage, finishReason } : streamUsage;
  }

  /** Non-streaming completion with tool-call support */
  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const suppressModelParameters = this.shouldSuppressModelParameters(options);
    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model);
    const maxTokens =
      configuredMaxTokens === undefined
        ? undefined
        : this.applyMaxTokensCap(contextFit.maxTokens ?? configuredMaxTokens);

    // Route to Responses API for models that require it
    if (!OpenAIProvider.hasProviderNativeMedia(messages) && this.useResponsesAPI(options.model, options)) {
      logger.debug(
        "[OpenAI] Routing chatComplete() to Responses API for model=%s onToken=%s",
        options.model,
        !!options.onToken,
      );
      return this.chatCompleteResponses(messages, { ...options, maxTokens });
    }

    const url = `${this.baseUrl}/chat/completions`;
    const reasoning = this.isReasoningModel(options.model);

    const useStream = options.stream ?? !!options.onToken;

    const formatted = this.formatMessages(messages, options.model);
    if (!formatted.some((m) => m.role !== "system" && m.role !== "developer")) {
      formatted.push({ role: "user", content: "Continue." });
    }

    const body: Record<string, unknown> = {
      model: options.model,
      messages: formatted,
    };
    if (useStream || !suppressModelParameters) {
      body.stream = useStream;
    }

    if (this.shouldSendParameter(options, "maxTokens") && reasoning) {
      body.max_completion_tokens = maxTokens;
    } else if (this.shouldSendParameter(options, "maxTokens")) {
      body.max_tokens = maxTokens;
    }

    if (
      options.tools?.length &&
      !options.forceTextualToolCalls &&
      (!suppressModelParameters || this.allowsToolCalling)
    ) {
      body.tools = options.tools;
      body.tool_choice = "auto";
    }

    if (!suppressModelParameters) {
      if (this.shouldSendStopSequences(options.model) && options.stop?.length) body.stop = options.stop;
      if (useStream) body.stream_options = { include_usage: true };

      // o-series models never support temperature/topP; GPT-5.x only with effort=none
      if (!this.isNoTemperatureModel(options.model, options.reasoningEffort)) {
        if (this.shouldSendParameter(options, "temperature")) body.temperature = options.temperature ?? 1;
        const topP = this.shouldSendParameter(options, "topP") ? OpenAIProvider.normalizeTopP(options.topP) : undefined;
        if (topP != null) body.top_p = topP;
        if (
          this.shouldSendParameter(options, "topK") &&
          this.shouldSendTopK() &&
          typeof options.topK === "number" &&
          Number.isFinite(options.topK) &&
          options.topK > 0
        ) {
          body.top_k = Math.round(options.topK);
        }
        // min_p, like top_k, is a non-standard sampler only sent where the backend
        // is known to accept it (the bundled local model); other backends can use
        // the customParameters escape hatch. minP=0 means "disabled" → omit it.
        if (
          this.shouldSendTopK() &&
          typeof options.minP === "number" &&
          Number.isFinite(options.minP) &&
          options.minP > 0
        ) {
          body.min_p = options.minP;
        }
        if (this.shouldSendPenaltyParams(options.model)) {
          if (this.shouldSendParameter(options, "frequencyPenalty") && options.frequencyPenalty) {
            body.frequency_penalty = options.frequencyPenalty;
          }
          if (this.shouldSendParameter(options, "presencePenalty") && options.presencePenalty) {
            body.presence_penalty = options.presencePenalty;
          }
        }
      }

      if (
        this.shouldSendParameter(options, "verbosity") &&
        options.verbosity &&
        this.supportsGpt5Verbosity(options.model)
      ) {
        body.verbosity = options.verbosity;
      }

      // OpenRouter provider routing preference
      const openrouterProvider = this.resolveOpenrouterProvider(options.openrouterProvider);
      if (this.shouldApplyOpenRouterProviderOverride(openrouterProvider)) {
        body.provider = { order: [openrouterProvider] };
      }

      this.applyOpenRouterPromptCaching(body, options);

      // Force response format (e.g. JSON mode)
      const normalizedResponseFormat = this.normalizeChatCompletionsResponseFormat(options.responseFormat);
      if (normalizedResponseFormat) {
        body.response_format = normalizedResponseFormat;
      }
    }

    if (
      this.shouldSendParameter(options, "reasoningEffort") &&
      (!suppressModelParameters || this.isOpenRouterEndpoint())
    ) {
      this.applyChatCompletionsReasoning(body, options);
    }

    this.applyOpenRouterServiceTier(body, options);
    this.applyCustomParameters(body, options);
    this.stripUnsupportedSamplerParameters(body, options);

    logger.debug(
      "[OpenAI chatComplete()] stream=%s model=%s reasoning=%s enableThinking=%s verbosity=%s onToken=%s",
      useStream,
      body.model,
      this.requestReasoningLogValue(body),
      !!options.enableThinking,
      body.verbosity ?? "default",
      !!options.onToken,
    );

    const response = await llmFetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      bufferResponse: !useStream,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatChatCompletionsHttpError(response.status, errorText, useStream));
    }

    if (!useStream) {
      // Non-streaming path (no onToken callback)
      const json = await OpenAIProvider.parseJsonBody<Record<string, unknown>>(
        response,
        "OpenAI chatComplete() non-stream response",
      );
      const choices = OpenAIProvider.requireChatCompletionsChoices<{
        message: Record<string, unknown> & {
          content: string | unknown[] | null;
          tool_calls?: unknown;
          refusal?: string;
        };
        finish_reason?: string;
      }>(json, "OpenAI chatComplete() non-stream response");

      const choice = choices[0];
      const reasoningMetadata = OpenAIProvider.extractReasoningMetadata(choice?.message);
      this.emitChatCompletionsReasoning(options, reasoningMetadata);
      const reasoning = OpenAIProvider.extractReasoning(choice?.message);
      if (reasoning && options.onThinking) {
        options.onThinking(reasoning);
      }
      // Handle OpenRouter content block arrays (Anthropic-style)
      let resolvedContent: string | null = null;
      const blocks = OpenAIProvider.extractContentBlocks(choice?.message?.content);
      if (blocks) {
        if (!reasoning && blocks.thinking && options.onThinking) options.onThinking(blocks.thinking);
        resolvedContent = blocks.text || null;
      } else {
        resolvedContent = (choice?.message?.content as string) ?? null;
      }
      // Fall back to refusal text so the user sees why the model declined
      if (!resolvedContent && typeof choice?.message?.refusal === "string" && choice.message.refusal) {
        resolvedContent = choice.message.refusal;
      }
      const usage = OpenAIProvider.extractChatCompletionsUsage(json.usage as ChatCompletionsUsagePayload | undefined);
      let toolCalls = OpenAIProvider.normalizeToolCalls(choice?.message?.tool_calls);
      if (toolCalls.length === 0 && resolvedContent && options.tools?.length) {
        toolCalls = parseTextualToolCalls(resolvedContent, options.tools);
        if (toolCalls.length > 0) resolvedContent = null;
      }
      return {
        content: resolvedContent,
        toolCalls,
        finishReason: toolCalls.length > 0 ? "tool_calls" : (choice?.finish_reason ?? "stop"),
        usage,
        ...(OpenAIProvider.hasReasoningMetadata(reasoningMetadata) ? { providerMetadata: reasoningMetadata } : {}),
      };
    }

    // ── Streaming path: stream text tokens via onToken, collect tool calls ──
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const onAbort = () => reader.cancel().catch(() => {});
    if (options.signal) {
      if (options.signal.aborted) {
        await reader.cancel().catch(() => {});
        return { content: null, toolCalls: [], finishReason: "abort", usage: undefined };
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let finishReason = "stop";
    let streamUsage: LLMUsage | undefined;
    const reasoningMetadata: Record<string, unknown> = {};

    // Accumulate tool calls from deltas
    const toolCallsMap = new Map<
      number,
      { id: string; type: "function"; function: { name: string; arguments: string } }
    >();

    try {
      while (true) {
        const { done, value } = await reader.read();

        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();
          const data = OpenAIProvider.extractSseData(trimmed);
          if (data == null) continue;
          if (data === "[DONE]") break;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            // Skip malformed JSON lines
            continue;
          }

          if (parsed.usage) {
            streamUsage = OpenAIProvider.extractChatCompletionsUsage(parsed.usage as ChatCompletionsUsagePayload);
          }

          if (!Array.isArray(parsed.choices)) {
            const providerMessage = OpenAIProvider.extractProviderErrorMessage(parsed);
            if (providerMessage) {
              throw new Error(
                `OpenAI chatComplete() stream response missing choices: ${sanitizeApiError(providerMessage)}`,
              );
            }
            continue;
          }

          const choice = (
            parsed.choices as Array<{
              delta?: Record<string, unknown> & {
                content?: string | unknown[];
                refusal?: string;
                tool_calls?: unknown;
              };
              message?: Record<string, unknown> & {
                content?: string | unknown[] | null;
                refusal?: string;
              };
              finish_reason?: string;
            }>
          )[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;
          const message = choice.message;
          OpenAIProvider.appendReasoningMetadata(reasoningMetadata, delta ?? message);

          // Stream reasoning/thinking
          const reasoning = OpenAIProvider.extractReasoning(delta ?? message);
          if (reasoning && options.onThinking) {
            options.onThinking(reasoning);
          }

          // Handle OpenRouter content block arrays (Anthropic-style)
          const textContent = delta?.content ?? message?.content;
          const refusal =
            (typeof delta?.refusal === "string" && delta.refusal) ||
            (typeof message?.refusal === "string" && message.refusal) ||
            "";
          const blocks = OpenAIProvider.extractContentBlocks(textContent);
          if (blocks) {
            if (!reasoning && blocks.thinking && options.onThinking) options.onThinking(blocks.thinking);
            if (blocks.text) {
              content += blocks.text;
              await options.onToken?.(blocks.text);
            }
          } else if (typeof textContent === "string" && textContent) {
            content += textContent;
            await options.onToken?.(textContent);
          } else if (refusal) {
            content += refusal;
            await options.onToken?.(refusal);
          }

          // Accumulate tool call deltas. Some OpenAI-compatible backends (including llama.cpp)
          // may stream tool calls as { name, arguments } instead of { function: { ... } }.
          if (Array.isArray(delta?.tool_calls)) {
            for (const [fallbackIndex, rawToolCall] of delta.tool_calls.entries()) {
              const tc = OpenAIProvider.asRecord(rawToolCall);
              if (!tc) continue;
              const fn = OpenAIProvider.asRecord(tc.function) ?? tc;
              const index = typeof tc.index === "number" ? tc.index : fallbackIndex;
              const nameDelta = typeof fn.name === "string" ? fn.name : typeof tc.name === "string" ? tc.name : "";
              const argumentDelta =
                typeof fn.arguments === "string"
                  ? fn.arguments
                  : typeof tc.arguments === "string"
                    ? tc.arguments
                    : typeof fn.parameters === "string"
                      ? fn.parameters
                      : typeof tc.parameters === "string"
                        ? tc.parameters
                        : fn.arguments !== undefined ||
                            tc.arguments !== undefined ||
                            fn.parameters !== undefined ||
                            tc.parameters !== undefined
                          ? OpenAIProvider.stringifyToolArguments(
                              fn.arguments ?? tc.arguments ?? fn.parameters ?? tc.parameters,
                            )
                          : "";
              const existing = toolCallsMap.get(index);
              if (!existing) {
                toolCallsMap.set(index, {
                  id: typeof tc.id === "string" ? tc.id : typeof tc.call_id === "string" ? tc.call_id : "",
                  type: "function",
                  function: {
                    name: nameDelta,
                    arguments: argumentDelta,
                  },
                });
              } else {
                if (typeof tc.id === "string" && tc.id) existing.id = tc.id;
                else if (typeof tc.call_id === "string" && tc.call_id) existing.id = tc.call_id;
                if (nameDelta) existing.function.name += nameDelta;
                if (argumentDelta) existing.function.arguments += argumentDelta;
              }
            }
          }
        }
        if (done) break;
      }
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
    }

    // Collect tool calls in order
    let toolCalls: LLMToolCall[] = [];
    const sortedKeys = [...toolCallsMap.keys()].sort((a, b) => a - b);
    for (const key of sortedKeys) {
      const normalized = OpenAIProvider.normalizeToolCall(toolCallsMap.get(key), key);
      if (normalized) toolCalls.push(normalized);
    }
    if (toolCalls.length === 0 && content && options.tools?.length) {
      toolCalls = parseTextualToolCalls(content, options.tools);
      if (toolCalls.length > 0) content = "";
    }

    this.emitChatCompletionsReasoning(options, reasoningMetadata);

    return {
      content: content || null,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : finishReason,
      usage: streamUsage,
      ...(OpenAIProvider.hasReasoningMetadata(reasoningMetadata) ? { providerMetadata: reasoningMetadata } : {}),
    };
  }

  // ══════════════════════════════════════════════
  // OpenAI Responses API (/responses)
  // ══════════════════════════════════════════════

  /**
   * Convert chat-completion-style messages into Responses API `input` items.
   * Leading system messages are extracted into the top-level `instructions`
   * field. Later system messages keep their position so post-history
   * instruction sections do not lose recency.
   * Tool messages become `function_call_output` items.
   * Assistant messages with tool_calls become `function_call` items.
   */
  private formatResponsesInput(messages: ChatMessage[]): {
    instructions: string | undefined;
    input: Array<Record<string, unknown>>;
  } {
    // The Responses API requires function-call IDs to start with "fc_".
    // Tool calls coming from Chat Completions history use "call_" prefix.
    // Re-map consistently so both function_call and function_call_output match.
    const idMap = new Map<string, string>();
    let fcCounter = 0;
    const ensureFcId = (id: string): string => {
      if (id.startsWith("fc_")) return id;
      const existing = idMap.get(id);
      if (existing) return existing;
      const mapped = `fc_mapped_${++fcCounter}`;
      idMap.set(id, mapped);
      return mapped;
    };

    let instructions: string | undefined;
    const input: Array<Record<string, unknown>> = [];

    let sawNonSystemInput = false;
    for (const m of messages) {
      if (m.role === "system") {
        if (m.content?.trim()) {
          if (!sawNonSystemInput) {
            // Leading system/developer messages belong in the top-level
            // instructions field for Responses.
            if (instructions) {
              instructions += "\n\n" + m.content;
            } else {
              instructions = m.content;
            }
          } else {
            input.push({ role: "system", content: m.content });
          }
        }
        continue;
      }

      sawNonSystemInput = true;

      if (m.role === "tool") {
        // Tool result → function_call_output item
        input.push({
          type: "function_call_output",
          call_id: m.tool_call_id ? ensureFcId(m.tool_call_id) : m.tool_call_id,
          output: m.content,
        });
        continue;
      }

      if (m.role === "assistant" && m.tool_calls?.length) {
        // First emit the text content if any
        if (m.content) {
          input.push({ role: "assistant", content: m.content });
        }
        // Then emit each tool call as a function_call item
        for (const tc of m.tool_calls) {
          const fcId = ensureFcId(tc.id);
          input.push({
            type: "function_call",
            id: fcId,
            call_id: fcId,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
        continue;
      }

      if (m.role === "user" && (m.images?.length || m.files?.length)) {
        // Multimodal/file user message
        const content: Array<Record<string, unknown>> = [];
        content.push(...OpenAIProvider.openAIFileContentParts(m.files, "responses"));
        if (m.content) content.push({ type: "input_text", text: m.content });
        for (const img of m.images ?? []) {
          content.push({ type: "input_image", image_url: img });
        }
        input.push({ role: "user", content });
        continue;
      }

      // Regular user or assistant message — skip empty content
      if (!m.content?.trim()) continue;
      input.push({ role: m.role, content: m.content });
    }

    if (input.length === 0) {
      input.push({ role: "user", content: "Continue." });
    }

    return { instructions, input };
  }

  /** Convert LLMToolDefinition[] to Responses API tool format */
  private formatResponsesTools(tools: LLMToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((t) => ({
      type: "function",
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  }

  /** Check if a Responses API error is due to stale/corrupt encrypted reasoning items */
  private isEncryptedContentError(errorText: string): boolean {
    return errorText.includes("encrypted content") && errorText.includes("could not be");
  }

  /** Strip encrypted reasoning items from a Responses API body for retry */
  private stripEncryptedItems(body: Record<string, unknown>): Record<string, unknown> {
    const input = body.input as Array<Record<string, unknown>> | undefined;
    if (input) {
      body.input = input.filter((item) => item.type !== "reasoning");
    }
    return body;
  }

  /** Build the Responses API request body */
  private buildResponsesBody(messages: ChatMessage[], options: ChatOptions): Record<string, unknown> {
    const { instructions, input } = this.formatResponsesInput(messages);
    const isOpenAIChatGPT = this.isOpenAIChatGPTProvider();
    const suppressModelParameters = this.shouldSuppressModelParameters(options);

    // Replay encrypted reasoning items from the previous turn so the model
    // retains its reasoning context and avoids re-deriving (and re-narrating) the same conclusions.
    if (!isOpenAIChatGPT && options.encryptedReasoningItems?.length) {
      let lastAssistantIdx = -1;
      for (let i = input.length - 1; i >= 0; i--) {
        if ((input[i] as Record<string, unknown>).role === "assistant") {
          lastAssistantIdx = i;
          break;
        }
      }
      if (lastAssistantIdx >= 0) {
        input.splice(lastAssistantIdx, 0, ...(options.encryptedReasoningItems as Array<Record<string, unknown>>));
      }
    }

    const body: Record<string, unknown> = {
      model: resolveOpenAIGpt56ModelForRequest(options.model),
      input,
      store: false, // don't persist responses on OpenAI side
    };
    const shouldStreamResponses =
      !this.isResponsesStreamingUnsupportedModel(options.model) && (isOpenAIChatGPT || (options.stream ?? true));

    if (shouldStreamResponses) {
      body.stream = true;
    } else if (!suppressModelParameters) {
      body.stream = false;
    }

    if (!isOpenAIChatGPT && !suppressModelParameters) {
      // Request encrypted reasoning items so we can replay them on the next turn.
      body.include = ["reasoning.encrypted_content"];
    }

    if (instructions || isOpenAIChatGPT) {
      body.instructions = instructions || "You are a helpful assistant.";
    }

    if (
      !isOpenAIChatGPT &&
      this.shouldSendParameter(options, "maxTokens") &&
      options.maxTokens &&
      !this.isXAIMultiAgentModel(options.model)
    ) {
      body.max_output_tokens = options.maxTokens;
    }

    // o-series models never support temperature/topP; GPT-5.x only with effort=none
    if (
      !isOpenAIChatGPT &&
      !suppressModelParameters &&
      !this.isNoTemperatureModel(options.model, options.reasoningEffort)
    ) {
      if (this.shouldSendParameter(options, "temperature") && options.temperature != null)
        body.temperature = options.temperature;
      const topP = this.shouldSendParameter(options, "topP") ? OpenAIProvider.normalizeTopP(options.topP) : undefined;
      if (topP != null) body.top_p = topP;
    }

    if (!isOpenAIChatGPT && !suppressModelParameters) {
      this.applyResponsesReasoning(body, options);
    }

    // GPT-5+ verbosity and Responses structured output / JSON mode.
    if (!isOpenAIChatGPT && !suppressModelParameters) {
      this.applyResponsesTextOptions(body, options);
    }

    const openrouterProvider = this.resolveOpenrouterProvider(options.openrouterProvider);
    if (
      !isOpenAIChatGPT &&
      !suppressModelParameters &&
      this.shouldApplyOpenRouterProviderOverride(openrouterProvider)
    ) {
      body.provider = { order: [openrouterProvider] };
    }

    if (!isOpenAIChatGPT) {
      this.applyOpenRouterServiceTier(body, options);
    }

    if (
      !isOpenAIChatGPT &&
      !suppressModelParameters &&
      options.tools?.length &&
      !this.isXAIMultiAgentModel(options.model)
    ) {
      body.tools = this.formatResponsesTools(options.tools);
    }

    if (!isOpenAIChatGPT) {
      this.applyCustomParameters(body, options);
      this.stripUnsupportedSamplerParameters(body, options);
    }

    return body;
  }

  /**
   * Streaming generation using the Responses API.
   * SSE events use typed event names like `response.output_text.delta`.
   */
  private async *chatResponses(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<string, LLMUsage | void, unknown> {
    const url = `${this.baseUrl}/responses`;
    const body = this.buildResponsesBody(messages, options);
    const parseAsStream = body.stream === true;
    logger.debug(
      "[OpenAI chatResponses] model=%s stream=%s reasoning=%j enableThinking=%s verbosity=%s max_output_tokens=%s tools=%s",
      body.model,
      body.stream,
      body.reasoning ?? {},
      !!options.enableThinking,
      typeof body.text === "object" && body.text && "verbosity" in body.text
        ? ((body.text as { verbosity?: string }).verbosity ?? "default")
        : "default",
      body.max_output_tokens ?? "n/a",
      Array.isArray(body.tools) ? body.tools.length : 0,
    );

    let response = await llmFetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      bufferResponse: !parseAsStream,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Retry without encrypted reasoning items if they're stale/corrupt
      if (
        response.status === 400 &&
        this.isEncryptedContentError(errorText) &&
        options.encryptedReasoningItems?.length
      ) {
        logger.warn("[OpenAI chatResponses] Encrypted reasoning items rejected, retrying without them");
        options.onEncryptedReasoning?.([]); // clear the cache
        this.stripEncryptedItems(body);
        response = await llmFetch(url, {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
          bufferResponse: !parseAsStream,
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!response.ok) {
          const retryError = await response.text();
          throw new Error(`OpenAI Responses API error ${response.status}: ${sanitizeApiError(retryError)}`);
        }
      } else {
        throw new Error(`OpenAI Responses API error ${response.status}: ${sanitizeApiError(errorText)}`);
      }
    }

    if (!parseAsStream) {
      // Non-streaming: parse the full response
      const json = await OpenAIProvider.parseJsonBody<Record<string, unknown>>(
        response,
        "OpenAI chatResponses() non-stream response",
      );
      OpenAIProvider.assertResponsesSucceeded(json, "OpenAI chatResponses() non-stream response");
      // Extract reasoning summaries for non-streaming
      if (options.onThinking) {
        const output = json.output as Array<Record<string, unknown>> | undefined;
        if (output) {
          for (const item of output) {
            if (item.type === "reasoning") {
              const summary = item.summary as Array<Record<string, unknown>> | undefined;
              if (summary) {
                for (const part of summary) {
                  if (part.type === "summary_text" && typeof part.text === "string") {
                    options.onThinking(part.text);
                  }
                }
              }
            }
          }
        }
      }
      // Emit encrypted reasoning items for multi-turn context
      this.emitEncryptedReasoning(json, options);
      const text = this.extractResponsesText(json);
      if (text) yield text;
      const usage = this.extractResponsesUsage(json);
      return usage && json.status === "incomplete"
        ? {
            ...usage,
            finishReason: OpenAIProvider.normalizeResponsesIncompleteFinishReason(
              (json.incomplete_details as Record<string, unknown> | undefined)?.reason,
            ),
          }
        : usage;
    }

    // Stream SSE
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const onAbortResponses = () => reader.cancel().catch(() => {});
    if (options.signal) {
      if (options.signal.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
      options.signal.addEventListener("abort", onAbortResponses, { once: true });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let streamUsage: LLMUsage | undefined;
    let yieldedAny = false;
    let currentEvent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();

          // SSE event type line
          const eventName = OpenAIProvider.extractSseEvent(trimmed);
          if (eventName != null) {
            currentEvent = eventName;
            continue;
          }

          const data = OpenAIProvider.extractSseData(trimmed);
          if (data == null) {
            if (trimmed === "") currentEvent = ""; // reset on blank line
            continue;
          }

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            currentEvent = "";
            continue;
          }
          // Use SSE event: field if present, otherwise fall back to the JSON type field.
          // Some proxies strip SSE event names and only forward data lines.
          const eventType = currentEvent || (parsed.type as string) || "";

          switch (eventType) {
            case "response.text.delta":
            case "response.output_text.delta": {
              const delta = parsed.delta as string | undefined;
              if (delta) {
                yieldedAny = true;
                yield delta;
              }
              break;
            }
            case "response.reasoning_summary_text.delta": {
              const delta = parsed.delta as string | undefined;
              if (delta && options.onThinking) options.onThinking(delta);
              break;
            }
            case "response.refusal.delta": {
              // Treat refusals as regular text so the user sees the message
              const delta = parsed.delta as string | undefined;
              if (delta) {
                yieldedAny = true;
                yield delta;
              }
              break;
            }
            case "response.completed": {
              // Extract usage and encrypted reasoning from the completed response
              const resp = parsed.response as Record<string, unknown> | undefined;
              if (resp) {
                streamUsage = this.extractResponsesUsage(resp);
                if (resp.status === "incomplete" && streamUsage) {
                  streamUsage = {
                    ...streamUsage,
                    finishReason: OpenAIProvider.normalizeResponsesIncompleteFinishReason(
                      (resp.incomplete_details as Record<string, unknown> | undefined)?.reason,
                    ),
                  };
                }
                this.emitEncryptedReasoning(resp, options);
                // If no text was streamed (e.g. refusal or content only in the
                // completed payload), extract it as a last-resort fallback.
                if (!yieldedAny) {
                  const fallback = this.extractResponsesText(resp);
                  if (fallback) {
                    yieldedAny = true;
                    yield fallback;
                  }
                }
              }
              break;
            }
            case "response.failed": {
              const resp = parsed.response as Record<string, unknown> | undefined;
              const error = resp?.error as Record<string, unknown> | undefined;
              const msg = (error?.message as string) ?? "unknown error";
              logger.error(new Error(msg), "[OpenAI Responses] Stream ended with response.failed");
              throw new Error(`OpenAI Responses stream failed: ${msg}`);
            }
            case "response.incomplete": {
              const resp = parsed.response as Record<string, unknown> | undefined;
              const reason = (resp?.incomplete_details as Record<string, unknown>)?.reason ?? "unknown";
              logger.warn("[OpenAI Responses] Stream ended with response.incomplete (reason=%s)", reason);
              if (resp) {
                streamUsage = this.extractResponsesUsage(resp);
                this.emitEncryptedReasoning(resp, options);
                if (!yieldedAny) {
                  const fallback = this.extractResponsesText(resp);
                  if (fallback) {
                    yieldedAny = true;
                    yield fallback;
                  }
                }
              }
              streamUsage = {
                ...(streamUsage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
                finishReason: OpenAIProvider.normalizeResponsesIncompleteFinishReason(reason),
              };
              break;
            }
            // Ignore other event types (response.created, response.in_progress, etc.)
          }
          currentEvent = "";
        }
        if (done) break;
      }
    } finally {
      options.signal?.removeEventListener("abort", onAbortResponses);
    }

    if (streamUsage) return streamUsage;
  }

  /**
   * Non-streaming completion with tool-call support via the Responses API.
   */
  private async chatCompleteResponses(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const url = `${this.baseUrl}/responses`;
    const callerWantsStream = options.stream ?? !!options.onToken;
    const useStream =
      !this.isResponsesStreamingUnsupportedModel(options.model) &&
      (this.isOpenAIChatGPTProvider() || callerWantsStream);
    const body = this.buildResponsesBody(messages, { ...options, stream: useStream });
    logger.debug(
      "[OpenAI chatCompleteResponses] reasoning=%s onThinking=%s",
      JSON.stringify(body.reasoning ?? null),
      !!options.onThinking,
    );

    let response = await llmFetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      bufferResponse: !useStream,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Retry without encrypted reasoning items if they're stale/corrupt
      if (
        response.status === 400 &&
        this.isEncryptedContentError(errorText) &&
        options.encryptedReasoningItems?.length
      ) {
        logger.warn("[OpenAI chatCompleteResponses] Encrypted reasoning items rejected, retrying without them");
        options.onEncryptedReasoning?.([]); // clear the cache
        this.stripEncryptedItems(body);
        response = await llmFetch(url, {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
          bufferResponse: !useStream,
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!response.ok) {
          const retryError = await response.text();
          throw new Error(`OpenAI Responses API error ${response.status}: ${sanitizeApiError(retryError)}`);
        }
      } else {
        throw new Error(`OpenAI Responses API error ${response.status}: ${sanitizeApiError(errorText)}`);
      }
    }

    if (!useStream) {
      // Non-streaming: parse the full response
      const json = await OpenAIProvider.parseJsonBody<Record<string, unknown>>(
        response,
        "OpenAI chatCompleteResponses() non-stream response",
      );
      OpenAIProvider.assertResponsesSucceeded(json, "OpenAI chatCompleteResponses() non-stream response");
      // Extract reasoning summaries
      if (options.onThinking) {
        const output = json.output as Array<Record<string, unknown>> | undefined;
        if (output) {
          for (const item of output) {
            if (item.type === "reasoning") {
              const summary = item.summary as Array<Record<string, unknown>> | undefined;
              if (summary) {
                for (const part of summary) {
                  if (part.type === "summary_text" && typeof part.text === "string") {
                    options.onThinking(part.text);
                  }
                }
              }
            }
          }
        }
      }
      // Emit encrypted reasoning items for multi-turn context
      this.emitEncryptedReasoning(json, options);
      return this.parseResponsesResult(json);
    }

    // Streaming path: stream text tokens, accumulate function calls
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const onAbortCCR = () => reader.cancel().catch(() => {});
    if (options.signal) {
      if (options.signal.aborted) {
        await reader.cancel().catch(() => {});
        return { content: null, toolCalls: [], finishReason: "stop", usage: undefined };
      }
      options.signal.addEventListener("abort", onAbortCCR, { once: true });
    }

    const decoder = new TextDecoder();
    let sseBuffer = "";
    let content = "";
    let finishReason = "stop";
    let streamUsage: LLMUsage | undefined;
    const functionCalls: LLMToolCall[] = [];
    // Track in-progress function call argument deltas keyed by call_id
    const fnCallArgs = new Map<string, { id: string; name: string; arguments: string }>();
    let currentEvent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        sseBuffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = done ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          const trimmed = line.trim();

          const eventName = OpenAIProvider.extractSseEvent(trimmed);
          if (eventName != null) {
            currentEvent = eventName;
            continue;
          }

          const data = OpenAIProvider.extractSseData(trimmed);
          if (data == null) {
            if (trimmed === "") currentEvent = "";
            continue;
          }

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            currentEvent = "";
            continue;
          }
          // Use SSE event: field if present, otherwise fall back to the JSON type field.
          // Some proxies strip SSE event names and only forward data lines.
          const eventType = currentEvent || (parsed.type as string) || "";

          switch (eventType) {
            case "response.text.delta":
            case "response.output_text.delta": {
              const delta = parsed.delta as string | undefined;
              if (delta) {
                content += delta;
                await options.onToken?.(delta);
              }
              break;
            }

            case "response.refusal.delta": {
              const delta = parsed.delta as string | undefined;
              if (delta) {
                content += delta;
                await options.onToken?.(delta);
              }
              break;
            }

            case "response.reasoning_summary_text.delta": {
              const delta = parsed.delta as string | undefined;
              if (delta && options.onThinking) options.onThinking(delta);
              break;
            }

            case "response.output_item.added": {
              // A new output item appeared — could be a function_call
              const item = parsed.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const callId = (item.call_id ?? item.id) as string;
                fnCallArgs.set(callId, {
                  id: callId,
                  name: (item.name as string) ?? "",
                  arguments: (item.arguments as string) ?? "",
                });
              }
              break;
            }

            case "response.function_call_arguments.delta": {
              const callId = parsed.call_id as string | undefined;
              const delta = parsed.delta as string | undefined;
              if (callId && delta) {
                const entry = fnCallArgs.get(callId);
                if (entry) entry.arguments += delta;
              }
              break;
            }

            case "response.function_call_arguments.done": {
              const callId = parsed.call_id as string | undefined;
              if (callId) {
                const entry = fnCallArgs.get(callId);
                if (entry) {
                  // Overwrite with the final arguments if provided
                  const args = parsed.arguments as string | undefined;
                  if (args) entry.arguments = args;
                }
              }
              break;
            }

            case "response.output_item.done": {
              // Finalize function_call items
              const item = parsed.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const callId = ((item.call_id ?? item.id) as string) ?? "";
                const entry = fnCallArgs.get(callId);
                functionCalls.push({
                  id: callId,
                  type: "function",
                  function: {
                    name: entry?.name ?? (item.name as string) ?? "",
                    arguments: entry?.arguments ?? (item.arguments as string) ?? "",
                  },
                });
              }
              break;
            }

            case "response.completed": {
              const resp = parsed.response as Record<string, unknown> | undefined;
              if (resp) {
                streamUsage = this.extractResponsesUsage(resp);
                this.emitEncryptedReasoning(resp, options);
                const status = resp.status as string | undefined;
                if (status === "incomplete") {
                  finishReason = OpenAIProvider.normalizeResponsesIncompleteFinishReason(
                    (resp.incomplete_details as Record<string, unknown> | undefined)?.reason,
                  );
                }
                // Fallback: extract text/refusal from the completed response
                // if nothing was streamed (e.g. model returned only in payload)
                if (!content) {
                  const fallback = this.extractResponsesText(resp);
                  if (fallback) {
                    content = fallback;
                    await options.onToken?.(fallback);
                  }
                }
              }
              break;
            }
            case "response.failed": {
              const resp = parsed.response as Record<string, unknown> | undefined;
              const error = resp?.error as Record<string, unknown> | undefined;
              const msg = (error?.message as string) ?? "unknown error";
              logger.error(new Error(msg), "[OpenAI Responses] chatCompleteResponses stream failed");
              throw new Error(`OpenAI Responses stream failed: ${msg}`);
            }
            case "response.incomplete": {
              const resp = parsed.response as Record<string, unknown> | undefined;
              const reason = (resp?.incomplete_details as Record<string, unknown>)?.reason ?? "unknown";
              logger.warn("[OpenAI Responses] chatCompleteResponses stream incomplete (reason=%s)", reason);
              finishReason = OpenAIProvider.normalizeResponsesIncompleteFinishReason(reason);
              break;
            }
          }
          currentEvent = "";
        }
        if (done) break;
      }
    } finally {
      options.signal?.removeEventListener("abort", onAbortCCR);
    }
    // Check if we got tool calls
    if (functionCalls.length > 0) {
      finishReason = "tool_calls";
    }

    return {
      content: content || null,
      toolCalls: functionCalls,
      finishReason,
      usage: streamUsage,
    };
  }

  /** Extract output text from a non-streaming Responses API result */
  private extractResponsesText(json: Record<string, unknown>): string {
    // output_text is a convenience field
    if (typeof json.output_text === "string") return json.output_text;

    // Otherwise walk the output items
    const output = json.output as Array<Record<string, unknown>> | undefined;
    if (!output) {
      // Fall back to top-level refusal field
      if (typeof json.refusal === "string" && json.refusal) return json.refusal;
      return "";
    }

    let text = "";
    for (const item of output) {
      if (item.type === "message") {
        if (typeof item.content === "string") {
          text += item.content;
          continue;
        }
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content)) {
          for (const part of content) {
            if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
              text += part.text;
            } else if (part.type === "refusal" && typeof part.refusal === "string") {
              text += part.refusal;
            }
          }
        }
      }
    }
    // Fall back to top-level refusal if no text was found in output items
    if (!text && typeof json.refusal === "string" && json.refusal) {
      text = json.refusal;
    }
    return text;
  }

  /**
   * Extract encrypted reasoning items from a Responses API result's output array.
   * These are opaque `{ type: "reasoning", encrypted_content: "..." }` objects
   * that can be replayed in the next turn's input for reasoning continuity.
   */
  private extractEncryptedReasoningItems(json: Record<string, unknown>): unknown[] {
    const output = json.output as Array<Record<string, unknown>> | undefined;
    if (!output) return [];
    return output.filter((item) => item.type === "reasoning" && typeof item.encrypted_content === "string");
  }

  /** Emit encrypted reasoning items via the callback if present */
  private emitEncryptedReasoning(json: Record<string, unknown>, options: ChatOptions): void {
    if (!options.onEncryptedReasoning) return;
    const items = this.extractEncryptedReasoningItems(json);
    if (items.length > 0) options.onEncryptedReasoning(items);
  }

  /** Extract usage from a Responses API result */
  private extractResponsesUsage(json: Record<string, unknown>): LLMUsage | undefined {
    const usage = json.usage as ResponsesUsagePayload | undefined;
    if (!usage) return undefined;
    return {
      promptTokens: usage.input_tokens ?? 0,
      completionTokens: usage.output_tokens ?? 0,
      totalTokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      cachedPromptTokens: usage.input_tokens_details?.cached_tokens,
      cacheWritePromptTokens: usage.input_tokens_details?.cache_write_tokens,
      completionReasoningTokens: usage.output_tokens_details?.reasoning_tokens,
      completionAudioTokens: usage.output_tokens_details?.audio_tokens,
      acceptedPredictionTokens: usage.output_tokens_details?.accepted_prediction_tokens,
      rejectedPredictionTokens: usage.output_tokens_details?.rejected_prediction_tokens,
    };
  }

  /** Parse a non-streaming Responses API result into ChatCompletionResult */
  private parseResponsesResult(json: Record<string, unknown>): ChatCompletionResult {
    const text = this.extractResponsesText(json);
    const usage = this.extractResponsesUsage(json);
    const output = json.output as Array<Record<string, unknown>> | undefined;

    // Extract function calls from output items
    const toolCalls: LLMToolCall[] = [];
    if (output) {
      for (const item of output) {
        if (item.type === "function_call") {
          toolCalls.push({
            id: ((item.call_id ?? item.id) as string) ?? "",
            type: "function",
            function: {
              name: (item.name as string) ?? "",
              arguments: (item.arguments as string) ?? "",
            },
          });
        }
      }
    }

    const status = json.status as string | undefined;
    let finishReason: string;
    if (toolCalls.length > 0) {
      finishReason = "tool_calls";
    } else if (status === "incomplete") {
      finishReason = OpenAIProvider.normalizeResponsesIncompleteFinishReason(
        (json.incomplete_details as Record<string, unknown> | undefined)?.reason,
      );
    } else {
      finishReason = "stop";
    }

    return {
      content: text || null,
      toolCalls,
      finishReason,
      usage,
    };
  }
}
