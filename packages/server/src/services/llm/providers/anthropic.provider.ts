// ──────────────────────────────────────────────
// LLM Provider — Anthropic Claude
// ──────────────────────────────────────────────
import {
  BaseLLMProvider,
  sanitizeApiError,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../base-provider.js";

/**
 * Handles Anthropic Claude API (Messages API).
 */
export class AnthropicProvider extends BaseLLMProvider {
  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const url = `${this.baseUrl}/messages`;

    // Claude requires system prompt separate from messages — filter out empty-content messages
    const systemMessages = messages.filter((m) => m.role === "system" && m.content?.trim());
    const chatMessages = messages.filter((m) => m.role !== "system" && m.content?.trim());

    // Ensure alternating user/assistant pattern (Claude requirement)
    const mergedMessages = this.mergeConsecutiveMessages(chatMessages);

    const enableCaching = options.enableCaching ?? false;

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

    // When caching, find the last user message index for the cache breakpoint
    const lastUserIdx = enableCaching ? mergedMessages.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1) : -1;

    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(systemField !== undefined && { system: systemField }),
      messages: mergedMessages.map((m, i) => {
        // Build content parts (text + optional images)
        const parts: Array<Record<string, unknown>> = [];
        if (m.images?.length) {
          for (const img of m.images) {
            const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (match) {
              parts.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
            }
          }
        }
        if (m.content) {
          const textBlock: Record<string, unknown> = { type: "text", text: m.content };
          if (i === lastUserIdx) textBlock.cache_control = { type: "ephemeral" };
          parts.push(textBlock);
        }
        // Use content array if we have images or cache control, otherwise string
        if (m.images?.length || i === lastUserIdx) {
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      }),
      stream: options.stream ?? true,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.topK ? { top_k: options.topK } : {}),
    };

    // Enable extended thinking for reasoning models
    if (options.enableThinking) {
      const budgetTokens = Math.max(1024, Math.min(options.maxTokens ?? 4096, 16000));
      body.thinking = { type: "enabled", budget_tokens: budgetTokens };
      // Anthropic requires max_tokens to be > budget_tokens
      body.max_tokens = (options.maxTokens ?? 4096) + budgetTokens;
      // Cannot use temperature with extended thinking
      delete body.temperature;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
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

    const decoder = new TextDecoder();
    let buffer = "";
    let currentBlockType = "text"; // track whether we're in a thinking or text block
    let inputTokens = 0;
    let outputTokens = 0;

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
      } else {
        merged.push({ ...msg });
      }
    }
    // Ensure starts with user
    if (merged.length > 0 && merged[0]!.role !== "user") {
      merged.unshift({ role: "user", content: "[Start]" });
    }
    return merged;
  }
}
