// ──────────────────────────────────────────────
// LLM Provider — Anthropic Claude
// ──────────────────────────────────────────────
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
import { isClaudeAdaptiveOnlyNoSamplingModel, shouldSuppressUnknownModelParameters } from "@marinara-engine/shared";
import { logger } from "../../../lib/logger.js";

const DEFAULT_CACHING_AT_DEPTH = 5;

function normalizeCachingAtDepth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return DEFAULT_CACHING_AT_DEPTH;
  return Math.floor(value);
}

function resolveCacheControlMessageIndex(messages: ChatMessage[], cachingAtDepth: number): number {
  if (messages.length === 0) return -1;
  return Math.max(0, messages.length - 1 - cachingAtDepth);
}

function stripAnthropicSamplingParameters(body: Record<string, unknown>): void {
  delete body.temperature;
  delete body.top_k;
  delete body.top_p;
}

function resolveAdaptiveThinkingHeadroom(options: ChatOptions, visibleMaxTokens: number): number {
  const effort = options.reasoningEffort ?? "high";
  const effortHeadroom: Record<string, number> = {
    low: 1024,
    medium: 4096,
    high: 8192,
    xhigh: 12288,
    max: 16384,
  };
  const requested = effortHeadroom[effort] ?? 8192;
  const boundedByVisibleBudget = Math.max(1024, Math.floor(visibleMaxTokens * 2));
  return Math.min(requested, boundedByVisibleBudget);
}

function applyAdaptiveThinkingConfig(
  body: Record<string, unknown>,
  options: ChatOptions,
  visibleMaxTokens?: number,
): void {
  body.thinking = { type: "adaptive", display: "summarized" };
  body.output_config = { effort: options.reasoningEffort ?? "high" };
  if (typeof visibleMaxTokens === "number" && Number.isFinite(visibleMaxTokens) && visibleMaxTokens > 0) {
    body.max_tokens = Math.floor(visibleMaxTokens) + resolveAdaptiveThinkingHeadroom(options, visibleMaxTokens);
  }
}

type AnthropicRole = "user" | "assistant";
type AnthropicContentBlock = Record<string, unknown> & {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
};
interface AnthropicMessagePayload {
  role: AnthropicRole;
  content: AnthropicContentBlock[];
}
interface AnthropicMessageResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatAnthropicTools(tools: LLMToolDefinition[] | undefined): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));
}

function imageContentBlocks(images?: string[]): AnthropicContentBlock[] {
  if (!images?.length) return [];
  const blocks: AnthropicContentBlock[] = [];
  for (const img of images) {
    const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
    }
  }
  return blocks;
}

function fileContentBlocks(files?: ChatMessage["files"]): AnthropicContentBlock[] {
  if (!files?.length) return [];
  const blocks: AnthropicContentBlock[] = [];
  for (const file of files) {
    const match = file.data.match(/^data:(application\/pdf);base64,(.+)$/);
    if (match) {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: match[1], data: match[2] },
        ...(file.filename ? { title: file.filename } : {}),
      });
    } else {
      logger.warn("Skipping unsupported Anthropic file attachment %s", file.filename ?? "unnamed file");
    }
  }
  return blocks;
}

function mergeAnthropicPayloadMessages(messages: AnthropicMessagePayload[]): AnthropicMessagePayload[] {
  const merged: AnthropicMessagePayload[] = [];
  for (const message of messages) {
    if (message.content.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content.push(...message.content);
    } else {
      merged.push({ role: message.role, content: [...message.content] });
    }
  }

  if (merged.length === 0) {
    merged.push({ role: "user", content: [{ type: "text", text: "[Start]" }] });
  } else if (merged[0]!.role !== "user") {
    merged.unshift({ role: "user", content: [{ type: "text", text: "[Start]" }] });
  }
  return merged;
}

function formatAnthropicPayloadMessages(messages: ChatMessage[]): AnthropicMessagePayload[] {
  const payload: AnthropicMessagePayload[] = [];

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "assistant" && message.tool_calls?.length) {
      const content: AnthropicContentBlock[] = [];
      if (message.content?.trim()) content.push({ type: "text", text: message.content });
      for (const call of message.tool_calls) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.function.name,
          input: parseToolArguments(call.function.arguments),
        });
      }
      payload.push({ role: "assistant", content });
      continue;
    }

    if (message.role === "tool") {
      if (!message.tool_call_id) {
        payload.push({ role: "user", content: [{ type: "text", text: `Tool result: ${message.content || " "}` }] });
        continue;
      }
      payload.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id,
            content: message.content || " ",
          },
        ],
      });
      continue;
    }

    if (message.role === "user" || message.role === "assistant") {
      const content = [...fileContentBlocks(message.files), ...imageContentBlocks(message.images)];
      if (message.content?.trim()) content.push({ type: "text", text: message.content });
      payload.push({ role: message.role === "assistant" ? "assistant" : "user", content });
    }
  }

  return mergeAnthropicPayloadMessages(payload);
}

function anthropicToolCallFromBlock(block: AnthropicContentBlock): LLMToolCall | null {
  if (block.type !== "tool_use" || typeof block.name !== "string") return null;
  const id =
    typeof block.id === "string" && block.id.trim()
      ? block.id
      : `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const args = isRecord(block.input) ? block.input : {};
  return {
    id,
    type: "function",
    function: { name: block.name, arguments: JSON.stringify(args) },
  };
}

/**
 * Handles Anthropic Claude API (Messages API).
 */
export class AnthropicProvider extends BaseLLMProvider {
  private shouldSuppressModelParameters(options: ChatOptions): boolean {
    return options.suppressModelParameters === true || shouldSuppressUnknownModelParameters("anthropic", options.model);
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    if (this.shouldSuppressModelParameters(options) || !options.tools?.length)
      return super.chatComplete(messages, options);

    const configuredMaxTokens = options.maxTokens ?? 4096;
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model);
    const maxTokens = contextFit.maxTokens ?? configuredMaxTokens;

    const url = `${this.baseUrl}/messages`;
    const systemMessages = messages.filter((m) => m.role === "system" && m.content?.trim());
    const systemField = systemMessages.length > 0 ? systemMessages.map((m) => m.content).join("\n\n") : undefined;

    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: maxTokens,
      ...(systemField !== undefined ? { system: systemField } : {}),
      messages: formatAnthropicPayloadMessages(messages),
      tools: formatAnthropicTools(options.tools),
      stream: false,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.topK ? { top_k: options.topK } : {}),
    };

    const modelLower = options.model.toLowerCase();
    const isAdaptiveOnly = isClaudeAdaptiveOnlyNoSamplingModel(options.model);
    if (isAdaptiveOnly) stripAnthropicSamplingParameters(body);

    if (options.enableThinking) {
      if (isAdaptiveOnly) {
        applyAdaptiveThinkingConfig(body, options, maxTokens);
      } else {
        const supportsAdaptive = /claude-(opus|sonnet)-4-[56]/.test(modelLower);
        if (supportsAdaptive) {
          applyAdaptiveThinkingConfig(body, options, maxTokens);
          delete body.temperature;
        } else {
          const budgetTokens = Math.max(1024, Math.min(maxTokens, 16000));
          body.thinking = { type: "enabled", budget_tokens: budgetTokens };
          body.max_tokens = maxTokens + budgetTokens;
          delete body.temperature;
        }
      }
    }

    this.applyCustomParameters(body, options);
    if (isAdaptiveOnly) {
      stripAnthropicSamplingParameters(body);
      if (options.enableThinking) applyAdaptiveThinkingConfig(body, options);
    }

    const response = await llmFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      bufferResponse: true,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${sanitizeApiError(errorText)}`);
    }

    const json = (await response.json()) as AnthropicMessageResponse;
    const blocks = Array.isArray(json.content) ? json.content : [];
    const text = blocks
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    for (const block of blocks) {
      if (block.type === "thinking" && typeof block.thinking === "string") options.onThinking?.(block.thinking);
    }
    if (text && options.onToken) options.onToken(text);

    const toolCalls = blocks
      .map((block) => anthropicToolCallFromBlock(block))
      .filter((call): call is LLMToolCall => call !== null);
    return {
      content: text || null,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : (json.stop_reason ?? "stop"),
      usage:
        typeof json.usage?.input_tokens === "number" && typeof json.usage.output_tokens === "number"
          ? {
              promptTokens: json.usage.input_tokens,
              completionTokens: json.usage.output_tokens,
              totalTokens: json.usage.input_tokens + json.usage.output_tokens,
            }
          : undefined,
    };
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const suppressModelParameters = this.shouldSuppressModelParameters(options);
    const configuredMaxTokens = suppressModelParameters ? undefined : (options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, { ...options, maxTokens: configuredMaxTokens });
    messages = contextFit.messages;
    this.logContextTrim(contextFit, options.model);
    const maxTokens = configuredMaxTokens === undefined ? undefined : (contextFit.maxTokens ?? configuredMaxTokens);

    const url = `${this.baseUrl}/messages`;

    // Claude requires system prompt separate from messages — filter out empty-content messages
    const systemMessages = messages.filter((m) => m.role === "system" && m.content?.trim());
    const chatMessages = messages.filter((m) => m.role !== "system" && (m.content?.trim() || m.images?.length || m.files?.length));

    // Ensure alternating user/assistant pattern (Claude requirement)
    const mergedMessages = this.mergeConsecutiveMessages(chatMessages);

    const enableCaching = options.enableCaching ?? false;
    const cachingAtDepth = normalizeCachingAtDepth(options.cachingAtDepth);

    // Build system field — use content blocks with cache_control when caching is on
    let systemField: string | Array<{ type: string; text: string; cache_control?: { type: string } }> | undefined;
    if (systemMessages.length > 0) {
      if (enableCaching) {
        // Array of content blocks with cache_control on the last one
        const blocks = systemMessages.map((m, i) => ({
          type: "text" as const,
          text: m.content,
          ...(i === systemMessages.length - 1 && { cache_control: { type: "ephemeral" } }),
        }));
        systemField = blocks;
      } else {
        systemField = systemMessages.map((m) => m.content).join("\n\n");
      }
    }

    const cacheControlMessageIndex = enableCaching
      ? resolveCacheControlMessageIndex(mergedMessages, cachingAtDepth)
      : -1;

    const body: Record<string, unknown> = {
      model: options.model,
      ...(systemField !== undefined && { system: systemField }),
      messages: mergedMessages.map((m, i) => {
        // Build content parts (documents + images + text)
        const parts: Array<Record<string, unknown>> = [...fileContentBlocks(m.files), ...imageContentBlocks(m.images)];
        if (m.content) {
          const textBlock: Record<string, unknown> = { type: "text", text: m.content };
          if (i === cacheControlMessageIndex) textBlock.cache_control = { type: "ephemeral" };
          parts.push(textBlock);
        }
        // Use content array if we have attachments or cache control, otherwise string
        if (m.images?.length || m.files?.length || i === cacheControlMessageIndex) {
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      }),
    };
    if (!suppressModelParameters) {
      const outputMaxTokens = maxTokens ?? 4096;
      body.max_tokens = outputMaxTokens;
      body.stream = options.stream ?? true;
      if (options.temperature !== undefined) body.temperature = options.temperature;
      if (options.topK) body.top_k = options.topK;
    } else {
      body.max_tokens = maxTokens ?? 4096;
      if (options.stream) body.stream = true;
    }

    // Claude adaptive-only models reject sampling parameters (400 error).
    // Strip temperature, top_k, top_p regardless of thinking mode.
    const modelLower = options.model.toLowerCase();
    const isAdaptiveOnly = isClaudeAdaptiveOnlyNoSamplingModel(options.model);
    if (isAdaptiveOnly && !suppressModelParameters) {
      stripAnthropicSamplingParameters(body);
    }

    // Enable extended thinking for reasoning models
    if (!suppressModelParameters && options.enableThinking) {
      const outputMaxTokens = maxTokens ?? 4096;
      if (isAdaptiveOnly) {
        // Adaptive-only Claude models use adaptive thinking (budget_tokens removed).
        // display defaults to "omitted" on 4.7+; summarized is what the UI
        // can safely capture and render in View Thoughts.
        applyAdaptiveThinkingConfig(body, options, outputMaxTokens);
      } else {
        // Opus 4.6 / Sonnet 4.6: prefer adaptive thinking (budget_tokens deprecated).
        const supportsAdaptive = /claude-(opus|sonnet)-4-[56]/.test(modelLower);
        if (supportsAdaptive) {
          applyAdaptiveThinkingConfig(body, options, outputMaxTokens);
          // Cannot use temperature with extended thinking
          delete body.temperature;
        } else {
          const budgetTokens = Math.max(1024, Math.min(outputMaxTokens, 16000));
          body.thinking = { type: "enabled", budget_tokens: budgetTokens };
          // Anthropic requires max_tokens to be > budget_tokens
          body.max_tokens = outputMaxTokens + budgetTokens;
          // Cannot use temperature with extended thinking
          delete body.temperature;
        }
      }
    }

    this.applyCustomParameters(body, options);
    if (isAdaptiveOnly && !suppressModelParameters) {
      stripAnthropicSamplingParameters(body);
      if (options.enableThinking) {
        applyAdaptiveThinkingConfig(body, options);
      }
    }

    const response = await llmFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      bufferResponse: options.stream === false,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${sanitizeApiError(errorText)}`);
    }

    if (!options.stream) {
      const json = (await response.json()) as {
        content: Array<{ type: string; text?: string; thinking?: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };
      // Extract thinking content if present
      const thinkingBlock = json.content.find((c) => c.type === "thinking");
      if (thinkingBlock?.thinking && options.onThinking) {
        options.onThinking(thinkingBlock.thinking);
      }
      yield json.content.find((c) => c.type === "text")?.text ?? "";
      if (json.usage) {
        return {
          promptTokens: json.usage.input_tokens,
          completionTokens: json.usage.output_tokens,
          totalTokens: json.usage.input_tokens + json.usage.output_tokens,
        };
      }
      return;
    }

    // Stream SSE
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
    let currentBlockType = "text"; // track whether we're in a thinking or text block
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);

          try {
            const event = JSON.parse(data) as {
              type: string;
              message?: { usage?: { input_tokens: number; output_tokens: number } };
              content_block?: { type: string };
              delta?: { type: string; text?: string; thinking?: string };
              usage?: { output_tokens: number };
            };
            // Capture input token count from message_start
            if (event.type === "message_start" && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens;
              outputTokens = event.message.usage.output_tokens;
            }
            // Capture final output token count from message_delta
            if (event.type === "message_delta" && event.usage) {
              outputTokens = event.usage.output_tokens;
            }
            // Track block type (thinking vs text)
            if (event.type === "content_block_start" && event.content_block) {
              currentBlockType = event.content_block.type;
            }
            if (event.type === "content_block_delta") {
              if (currentBlockType === "thinking" && event.delta?.thinking && options.onThinking) {
                options.onThinking(event.delta.thinking);
              } else if (event.delta?.text) {
                yield event.delta.text;
              }
            }
            if (event.type === "message_stop") {
              if (inputTokens || outputTokens) {
                return {
                  promptTokens: inputTokens,
                  completionTokens: outputTokens,
                  totalTokens: inputTokens + outputTokens,
                };
              }
              return;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    }
    if (inputTokens || outputTokens) {
      return { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens };
    }
  }

  /**
   * Merge consecutive same-role messages (Claude requires alternation).
   */
  private mergeConsecutiveMessages(messages: ChatMessage[]): ChatMessage[] {
    const merged: ChatMessage[] = [];
    for (const msg of messages) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role) {
        last.content += "\n\n" + msg.content;
        if (msg.images?.length) last.images = [...(last.images ?? []), ...msg.images];
        if (msg.files?.length) last.files = [...(last.files ?? []), ...msg.files];
      } else {
        merged.push({
          ...msg,
          ...(msg.images ? { images: [...msg.images] } : {}),
          ...(msg.files ? { files: msg.files.map((file) => ({ ...file })) } : {}),
        });
      }
    }
    // Claude requires at least one message; ensure it starts with a user turn
    if (merged.length === 0) {
      merged.push({ role: "user", content: "[Start]" });
    } else if (merged[0]!.role !== "user") {
      merged.unshift({ role: "user", content: "[Start]" });
    }
    return merged;
  }
}
