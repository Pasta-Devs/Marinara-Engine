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
}

export const LOCAL_AUTH_PROVIDERS = ["openai_chatgpt", "claude_subscription", "grok_subscription"] as const;

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
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: "x-api-key",
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
  },
  google: {
    id: "google",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: "x-goog-api-key",
  },
  google_vertex: {
    id: "google_vertex",
    name: "Google Vertex AI",
    defaultBaseUrl: "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1",
    modelsEndpoint: "/publishers/google/models",
    supportsStreaming: true,
    usesAuthHeader: false,
    apiKeyHeader: null,
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    defaultBaseUrl: "https://api.cohere.ai/compatibility/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  nanogpt: {
    id: "nanogpt",
    name: "NanoGPT",
    defaultBaseUrl: "https://nano-gpt.com/api/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  xai: {
    id: "xai",
    name: "xAI / Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
  },
  custom: {
    id: "custom",
    name: "Custom (OAI-Compatible)",
    defaultBaseUrl: "",
    modelsEndpoint: "/models",
    supportsStreaming: true,
    usesAuthHeader: true,
    apiKeyHeader: null,
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
};
