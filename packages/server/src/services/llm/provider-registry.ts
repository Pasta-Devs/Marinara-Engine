// ──────────────────────────────────────────────
// LLM Provider — Registry & Factory
// ──────────────────────────────────────────────
import { OpenAIProvider } from "./providers/openai.provider.js";
import { OpenAIChatGPTProvider } from "./providers/openai-chatgpt.provider.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { ClaudeSubscriptionProvider } from "./providers/claude-subscription.provider.js";
import { GrokSubscriptionProvider } from "./providers/grok-subscription.provider.js";
import { GoogleProvider } from "./providers/google.provider.js";
import type { BaseLLMProvider } from "./base-provider.js";

function normalizeCohereOpenAIBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const lower = trimmed.toLowerCase();

  if (lower.includes("/compatibility/v1")) return trimmed;
  if (lower === "https://api.cohere.com/v2" || lower === "https://api.cohere.ai/v2") {
    return "https://api.cohere.ai/compatibility/v1";
  }

  return trimmed;
}

/**
 * Factory that creates the correct LLM provider for a given provider type.
 */
export function createLLMProvider(
  provider: string,
  baseUrl: string,
  apiKey: string,
  maxContext?: number | null,
  openrouterProvider?: string | null,
  maxTokensOverride?: number | null,
  /** Claude (Subscription) only. When true, asks the Agent SDK to use fast-mode routing. */
  claudeFastMode?: boolean,
  /**
   * Custom endpoints: when false, body.tools is sent to the API even when the model name is
   * not in the OpenAI catalog (suppression bypass). Mirrors the connection's treatAsLocalEndpoint flag.
   */
  treatAsLocalEndpoint?: boolean,
): BaseLLMProvider {
  const normalizedMaxContext =
    typeof maxContext === "number" && Number.isFinite(maxContext) && maxContext > 0
      ? Math.floor(maxContext)
      : undefined;
  const normalizedMaxTokensOverride =
    typeof maxTokensOverride === "number" && Number.isFinite(maxTokensOverride) && maxTokensOverride > 0
      ? Math.floor(maxTokensOverride)
      : undefined;

  switch (provider) {
    case "openai":
    case "openrouter":
    case "nanogpt":
    case "xai":
    case "mistral":
      return new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        provider,
      );
    case "custom":
      return new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "custom",
        undefined,
        !(treatAsLocalEndpoint ?? false),
      );
    case "openai_chatgpt":
      return new OpenAIChatGPTProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
    case "cohere":
      return new OpenAIProvider(
        normalizeCohereOpenAIBaseUrl(baseUrl),
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "cohere",
      );
    case "anthropic":
      return new AnthropicProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
    case "claude_subscription":
      return new ClaudeSubscriptionProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        claudeFastMode ?? false,
      );
    case "grok_subscription":
      return new GrokSubscriptionProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
    case "google":
      return new GoogleProvider(baseUrl, apiKey, normalizedMaxContext, openrouterProvider, normalizedMaxTokensOverride);
    case "google_vertex":
      return new GoogleProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "google_vertex",
      );
    default:
      return new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "custom",
        undefined,
        !(treatAsLocalEndpoint ?? false),
      );
  }
}
