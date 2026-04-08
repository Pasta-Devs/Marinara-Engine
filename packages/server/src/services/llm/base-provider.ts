// ──────────────────────────────────────────────
// LLM Provider — Abstract Base
// ──────────────────────────────────────────────
import { Agent } from "undici";

/**
 * Shared undici Agent with a 5-minute headers timeout (time to first byte)
 * and no body timeout — prevents indefinite hangs while still allowing
 * long-running streaming responses to complete.
 */
const LLM_HEADERS_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const llmDispatcher = new Agent({ bodyTimeout: 0, headersTimeout: LLM_HEADERS_TIMEOUT });

/**
 * Drop-in replacement for `fetch()` that uses a custom undici dispatcher
 * with no body/headers timeout. Use this for all outgoing LLM requests.
 */
export function llmFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, dispatcher: llmDispatcher } as unknown as RequestInit);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** For tool result messages */
  tool_call_id?: string;
  /** For assistant messages with tool calls */
  tool_calls?: LLMToolCall[];
  /** Base64 data URLs for multimodal image inputs */
  images?: string[];
  /** Provider-specific metadata (e.g. Gemini parts with thought signatures) */
  providerMetadata?: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  /** Tool/function definitions for function calling */
  tools?: LLMToolDefinition[];
  /** Enable Anthropic prompt caching */
  enableCaching?: boolean;
  /** Callback for streaming thinking/reasoning content */
  onThinking?: (chunk: string) => void;
  /** Callback for streaming text tokens as they arrive (used in tool path) */
  onToken?: (chunk: string) => void;
  /** Enable extended thinking (reasoning models) */
  enableThinking?: boolean;
  /** Reasoning effort level for models that support it */
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  /** Output verbosity for GPT-5+ models */
  verbosity?: "low" | "medium" | "high";
  /** Abort signal — when triggered, the in-flight LLM request should be cancelled. */
  signal?: AbortSignal;
  /** Callback to receive the full response parts (for providers that return structured metadata like Gemini thought signatures) */
  onResponseParts?: (parts: unknown[]) => void;
  /** OpenRouter: preferred provider for model routing */
  openrouterProvider?: string | null;
  /** Encrypted reasoning items from a previous Responses API turn to replay for reasoning continuity */
  encryptedReasoningItems?: unknown[];
  /** Callback to receive encrypted reasoning items from the current response (store for next turn) */
  onEncryptedReasoning?: (items: unknown[]) => void;
}

/** Token usage statistics returned by the model */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Result from a non-streaming chat call that may include tool calls */
export interface ChatCompletionResult {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | string;
  usage?: LLMUsage;
}

/**
 * Sanitise raw error response text for display.
 * Strips HTML (Cloudflare/proxy error pages), extracts the title, and truncates.
 */
export function sanitizeApiError(raw: string, maxLen = 300): string {
  // If it looks like HTML, pull out the <title> or strip all tags
  if (raw.includes("<html") || raw.includes("<!DOCTYPE")) {
    const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch?.[1]) return titleMatch[1].trim().slice(0, maxLen);
    // Strip tags and collapse whitespace
    const stripped = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, maxLen) || "HTML error page (no details)";
  }
  // Try to parse as JSON and extract an error message
  try {
    const json = JSON.parse(raw);
    const msg = json?.error?.message ?? json?.error ?? json?.message;
    if (typeof msg === "string") return msg.slice(0, maxLen);
  } catch {
    // not JSON — return as-is
  }
  return raw.slice(0, maxLen);
}

/**
 * Abstract base for all LLM providers.
 * Every provider must implement the `chat` method as an async generator.
 */
export abstract class BaseLLMProvider {
  constructor(
    protected baseUrl: string,
    protected apiKey: string,
  ) {}

  /**
   * Stream a chat completion. Yields text chunks, optionally returns usage on completion.
   */
  abstract chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown>;

  /**
   * Non-streaming chat completion with tool-use support.
   * Default implementation collects from the streaming generator.
   * If onToken is provided, streams text chunks in real time.
   */
  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    let content = "";
    const useStream = !!options.onToken;
    const gen = this.chat(messages, { ...options, stream: useStream });
    let result = await gen.next();
    while (!result.done) {
      content += result.value;
      if (options.onToken) {
        options.onToken(result.value);
      }
      result = await gen.next();
    }
    const usage = result.value || undefined;
    return { content, toolCalls: [], finishReason: "stop", usage };
  }

  /**
   * Generate embeddings for one or more texts.
   * Default implementation calls the OpenAI-compatible /embeddings endpoint.
   * Override in provider subclasses that use a different API shape.
   */
  async embed(texts: string[], model: string): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://github.com/Pasta-Devs/Marinara-Engine";
      headers["X-Title"] = "Marinara Engine";
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: texts, model }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding request failed (${res.status}): ${sanitizeApiError(body)}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data.map((d) => d.embedding);
  }
}
