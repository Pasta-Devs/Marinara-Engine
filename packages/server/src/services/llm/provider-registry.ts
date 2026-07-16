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
import { withConnectionDefaultParameters } from "./connection-default-provider.js";

export function normalizeCohereOpenAIBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const lower = trimmed.toLowerCase();

  if (lower.includes("/compatibility/v1")) return trimmed;
  if (
    lower === "https://api.cohere.com" ||
    lower === "https://api.cohere.ai" ||
    lower === "https://api.cohere.com/v1" ||
    lower === "https://api.cohere.ai/v1" ||
    lower === "https://api.cohere.com/v2" ||
    lower === "https://api.cohere.ai/v2"
  ) {
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
  /** Stored connection defaults. Custom Parameters are bound to every text request made by this provider. */
  defaultParameters?: unknown,
): BaseLLMProvider {
  const normalizedMaxContext =
    typeof maxContext === "number" && Number.isFinite(maxContext) && maxContext > 0
      ? Math.floor(maxContext)
      : undefined;
  const normalizedMaxTokensOverride =
    typeof maxTokensOverride === "number" && Number.isFinite(maxTokensOverride) && maxTokensOverride > 0
      ? Math.floor(maxTokensOverride)
      : undefined;

  let resolved: BaseLLMProvider;
  switch (provider) {
    case "openai":
    case "openrouter":
    case "nanogpt":
    case "xai":
    case "mistral":
      resolved = new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        provider,
      );
      break;
    case "custom":
      resolved = new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "custom",
        undefined,
        !(treatAsLocalEndpoint ?? false),
      );
      break;
    case "openai_chatgpt":
      resolved = new OpenAIChatGPTProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
      break;
    case "cohere":
      resolved = new OpenAIProvider(
        normalizeCohereOpenAIBaseUrl(baseUrl),
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "cohere",
      );
      break;
    case "anthropic":
      resolved = new AnthropicProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
      break;
    case "claude_subscription":
      resolved = new ClaudeSubscriptionProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        claudeFastMode ?? false,
      );
      break;
    case "grok_subscription":
      resolved = new GrokSubscriptionProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
      );
      break;
    case "google":
      resolved = new GoogleProvider(baseUrl, apiKey, normalizedMaxContext, openrouterProvider, normalizedMaxTokensOverride);
      break;
    case "google_vertex":
      resolved = new GoogleProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "google_vertex",
      );
      break;
    default:
      resolved = new OpenAIProvider(
        baseUrl,
        apiKey,
        normalizedMaxContext,
        openrouterProvider,
        normalizedMaxTokensOverride,
        "custom",
        undefined,
        !(treatAsLocalEndpoint ?? false),
      );
      break;
  }
  return withConnectionDefaultParameters(resolved, defaultParameters);
}
