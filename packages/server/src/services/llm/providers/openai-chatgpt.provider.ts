// ──────────────────────────────────────────────
// LLM Provider - OpenAI (ChatGPT login via Codex auth)
// ──────────────────────────────────────────────
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../base-provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import {
  OPENAI_CHATGPT_CODEX_BASE_URL,
  buildOpenAIChatGPTHeaders,
  getOpenAIChatGPTAuth,
} from "../openai-chatgpt-auth.js";
import { resolveOpenAIChatGPTCacheSession } from "./openai-chatgpt-cache.js";

export { resolveOpenAIChatGPTCacheSession };

/**
 * Routes OpenAI Responses API calls through the user's local Codex ChatGPT
 * login instead of an API key. The auth helper reads and refreshes the same
 * `auth.json` created by `codex login`.
 */
export class OpenAIChatGPTProvider extends BaseLLMProvider {
  private async delegate(messages: ChatMessage[]): Promise<OpenAIProvider> {
    const auth = await getOpenAIChatGPTAuth();
    const headers = buildOpenAIChatGPTHeaders(auth);
    // Cache-friendly prompt layout: keep a chat's full-lore requests on one cache session. ChatGPT's
    // Responses cache affinity uses the hyphenated `session-id` header.
    const sessionId = resolveOpenAIChatGPTCacheSession(messages);
    if (sessionId) headers["session-id"] = sessionId;
    return new OpenAIProvider(
      OPENAI_CHATGPT_CODEX_BASE_URL,
      auth.accessToken,
      this.defaultMaxContext,
      this.defaultOpenrouterProvider,
      this.maxTokensOverride,
      "openai-chatgpt",
      headers,
    );
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const provider = await this.delegate(messages);
    return yield* provider.chat(messages, options);
  }

  override async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const provider = await this.delegate(messages);
    return provider.chatComplete(messages, options);
  }
}
