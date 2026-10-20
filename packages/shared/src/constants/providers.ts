// ──────────────────────────────────────────────
// API Provider Definitions
// ──────────────────────────────────────────────
import type { APIProvider } from "../types/connection.js";

export interface ProviderDefinition {
  id: APIProvider;
  name: string;
  defaultBaseUrl: string;
  modelsEndpoint: string;
  supportsStreaming: boolean;
  /** Whether the API key is sent via Authorization header (vs custom header) */
  usesAuthHeader: boolean;
  /** Custom header name for API key (e.g. "x-api-key" for Anthropic) */
  apiKeyHeader: string | null;
  /** Where a user gets a key for this service (Add connection and the connection editor link to it). */
  keyUrl?: string;
  /** How the service is paid for, shown as a badge when adding a connection. No prices: they change. */
  billing?: ProviderBilling;
}

export type ProviderBilling = "pay_per_use" | "plan" | "local" | "free_tier";

/** Connections that can't answer a chat request: pictures, video, audio and decisions. */
export const NON_CHAT_PROVIDERS: readonly APIProvider[] = ["image_generation", "video_generation", "audio", "decision"];

/** Whether a connection of this provider can answer a chat or agent request. */
export function isChatProvider(provider: unknown): boolean {
  return !(NON_CHAT_PROVIDERS as readonly unknown[]).includes(provider);
}

/** Whether a connection keeps its fetched model list. Claude (Subscription) answers from a built-in list. */
export function connectionSavesModelList(provider: string): boolean {
  return isChatProvider(provider) && provider !== "claude_subscription";
}

export const LOCAL_AUTH_PROVIDERS = ["openai_chatgpt", "claude_subscription", "grok_subscription"] as const;

/** These subscription transports send text only; they ignore native tool schemas. */
export function supportsNativeToolCalls(provider: string | null | undefined): boolean {
  return !!provider && provider !== "claude_subscription" && provider !== "grok_subscription";
}

/**
 * Providers whose usage meter shows a plan's rate-limit windows (a short one and
 * a weekly one, as percentages) that the connection can switch on separately.
 */
export function hasPlanUsageWindows(provider: string | null | undefined): boolean {
  return provider === "claude_subscription" || provider === "openai_chatgpt";
}

/** Providers whose connections can show a subscription usage meter. */
export function supportsSubscriptionUsageWidget(provider: string | null | undefined): boolean {
  return provider === "nanogpt" || hasPlanUsageWindows(provider);
}

export function isLocalAuthProvider(provider: string | null | undefined): boolean {
  return LOCAL_AUTH_PROVIDERS.includes(provider as (typeof LOCAL_AUTH_PROVIDERS)[number]);
}

export function localAuthProviderBaseUrl(provider: string | null | undefined): string | null {
  switch (provider) {
    case "claude_subscription":
      return "claude-agent-sdk://local";
    case "openai_chatgpt":
      return "openai-chatgpt://codex-auth";
    case "grok_subscription":
      return "grok-cli://local";
    default:
      return null;
  }
}

export const PROVIDERS: Record<APIProvider, ProviderDefinition> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://platform.openai.com/api-keys",
    billing: "pay_per_use",
  },
  openai_chatgpt: {
    id: "openai_chatgpt",
    name: "OpenAI (ChatGPT)",
    // No user-entered endpoint or API key. Marinara reads the local Codex
    // ChatGPT login and routes through ChatGPT's Codex backend.
    defaultBaseUrl: "",
    modelsEndpoint: "",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: null,
    billing: "plan",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: "x-api-key",
    keyUrl: "https://console.anthropic.com/settings/keys",
    billing: "pay_per_use",
  },
  claude_subscription: {
    id: "claude_subscription",
    name: "Claude (Subscription)",
    // No base URL — the Claude Agent SDK reads credentials stored locally by the
    // Claude Code CLI (`claude login`) and routes requests through Anthropic's
    // first-party endpoints on behalf of the signed-in Pro / Max account.
    defaultBaseUrl: "",
    modelsEndpoint: "",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: null,
    billing: "plan",
  },
  grok_subscription: {
    id: "grok_subscription",
    name: "Grok CLI (Subscription)",
    // No user-entered endpoint or API key. Marinara shells out to the local
    // Grok Build CLI, which reads credentials from `grok login`.
    defaultBaseUrl: "",
    modelsEndpoint: "",
    supportsStreaming: false,
    usesAuthHeader: false,
    apiKeyHeader: null,
    billing: "plan",
  },
  google: {
    id: "google",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: "x-goog-api-key",
    keyUrl: "https://aistudio.google.com/apikey",
    billing: "free_tier",
  },
  google_vertex: {
    id: "google_vertex",
    name: "Google Vertex AI",
    defaultBaseUrl: "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1",
    modelsEndpoint: "/publishers/google/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: null,
    keyUrl: "https://cloud.google.com/vertex-ai/docs/authentication",
    billing: "pay_per_use",
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://console.mistral.ai/api-keys",
    billing: "pay_per_use",
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    defaultBaseUrl: "https://api.cohere.ai/compatibility/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://dashboard.cohere.com/api-keys",
    billing: "pay_per_use",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://openrouter.ai/keys",
    billing: "free_tier",
  },
  nanogpt: {
    id: "nanogpt",
    name: "NanoGPT",
    defaultBaseUrl: "https://nano-gpt.com/api/v1",
    // Detailed catalog: the plain one omits context_length and max_output_tokens.
    modelsEndpoint: "/models?detailed=true",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://nano-gpt.com/api",
    billing: "pay_per_use",
  },
  xai: {
    id: "xai",
    name: "xAI / Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://console.x.ai",
    billing: "pay_per_use",
  },
  arli: {
    id: "arli",
    name: "Arli AI",
    defaultBaseUrl: "https://api.arliai.com/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://www.arliai.com/account",
    // Flat monthly plans: every model is in the plan, the tier limits size and speed.
    billing: "plan",
  },
  zai: {
    id: "zai",
    name: "Z.AI",
    // Pay-as-you-go endpoint. The Coding Plan endpoint (/api/coding/paas/v4)
    // is licensed for Z.AI's listed tools only, so it is not the default here.
    defaultBaseUrl: "https://api.z.ai/api/paas/v4",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    billing: "pay_per_use",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    // The OpenAI-format endpoint. DeepSeek also serves an Anthropic-format
    // endpoint at /anthropic, which this provider does not use.
    defaultBaseUrl: "https://api.deepseek.com/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    keyUrl: "https://platform.deepseek.com/api_keys",
    billing: "pay_per_use",
  },
  custom: {
    id: "custom",
    name: "OpenAI-compatible",
    defaultBaseUrl: "",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
    // No billing word: the address can be a free local server or a paid online service.
  },
  image_generation: {
    id: "image_generation",
    name: "Image Generation",
    defaultBaseUrl: "",
    modelsEndpoint: "",
    supportsStreaming: false,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  video_generation: {
    id: "video_generation",
    name: "Video Generation",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsEndpoint: "",
    supportsStreaming: false,
    usesAuthHeader: false,
    apiKeyHeader: "x-goog-api-key",
  },
  decision: {
    id: "decision",
    name: "Decision",
    defaultBaseUrl: "https://api.typesafe.ai",
    modelsEndpoint: "",
    supportsStreaming: false,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  audio: {
    id: "audio",
    name: "Audio",
    // The per-source default is applied by the audio resolver; ElevenLabs is
    // the fullest-featured backend (speech + sound effects + music).
    defaultBaseUrl: "https://api.elevenlabs.io",
    modelsEndpoint: "",
    supportsStreaming: false,
    usesAuthHeader: false,
    apiKeyHeader: "xi-api-key",
  },
};
