import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "../base-provider.js";
import { BaseLLMProvider, llmFetch, parseEmbeddingResponse, sanitizeApiError } from "../base-provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import { sidecarModelService } from "../../sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../../sidecar/sidecar-process.service.js";
import { resolveSidecarRequestModel } from "../../sidecar/sidecar-request-model.js";
import { getEmbeddingRequestTimeoutMs } from "../../../config/runtime-config.js";

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /\(404\)|\b404\b/.test(error.message);
}

export class LocalSidecarProvider extends BaseLLMProvider {
  constructor() {
    super("", "");
  }

  private async createDelegate(): Promise<OpenAIProvider> {
    const baseUrl = await sidecarProcessService.ensureReady({ forceStart: true });
    const contextSize = sidecarModelService.getConfig().contextSize;
    return new OpenAIProvider(`${baseUrl}/v1`, "local-sidecar", contextSize, null, null, "local-sidecar");
  }

  private getRequestModel(): string {
    return resolveSidecarRequestModel(
      sidecarModelService.getResolvedBackend(),
      sidecarModelService.getConfiguredModelRef(),
    );
  }

  private applyRuntimeSettings(options: ChatOptions): ChatOptions {
    if (options.suppressModelParameters) return options;
    const config = sidecarModelService.getConfig();
    const structuredOutput = !!options.responseFormat || !!options.tools?.length;
    const requestedMaxTokens =
      typeof options.maxTokens === "number" && Number.isFinite(options.maxTokens)
        ? Math.max(1, Math.floor(options.maxTokens))
        : undefined;
    return {
      ...options,
      maxTokens: requestedMaxTokens !== undefined ? Math.min(requestedMaxTokens, config.maxTokens) : config.maxTokens,
      temperature: structuredOutput ? 0 : config.temperature,
      topP: structuredOutput ? 1 : config.topP,
      topK: structuredOutput ? 0 : config.topK,
    };
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const delegate = await this.createDelegate();
    return yield* delegate.chat(messages, {
      ...this.applyRuntimeSettings(options),
      model: this.getRequestModel(),
    });
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const delegate = await this.createDelegate();
    return delegate.chatComplete(messages, {
      ...this.applyRuntimeSettings(options),
      model: this.getRequestModel(),
    });
  }

  async embed(texts: string[], _model: string): Promise<number[][]> {
    const baseUrl = await sidecarProcessService.ensureReady({ forceStart: true });
    const requestModel = this.getRequestModel();

    try {
      return await this.requestOpenAIEmbeddings(baseUrl, texts, requestModel);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      return this.requestLegacyEmbeddings(baseUrl, texts);
    }
  }

  private async requestOpenAIEmbeddings(baseUrl: string, texts: string[], model: string): Promise<number[][]> {
    const timeoutMs = getEmbeddingRequestTimeoutMs();
    const response = await llmFetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model }),
      signal: AbortSignal.timeout(timeoutMs),
      agentOptions: { bodyTimeout: 0, headersTimeout: timeoutMs },
      bufferResponse: true,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Local sidecar embedding request failed (${response.status}): ${sanitizeApiError(body)}`);
    }
    return parseEmbeddingResponse(await response.json());
  }

  private async requestLegacyEmbeddings(baseUrl: string, texts: string[]): Promise<number[][]> {
    const timeoutMs = getEmbeddingRequestTimeoutMs();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const response = await llmFetch(`${baseUrl}/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: AbortSignal.timeout(timeoutMs),
        agentOptions: { bodyTimeout: 0, headersTimeout: timeoutMs },
        bufferResponse: true,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Local sidecar legacy embedding request failed (${response.status}): ${sanitizeApiError(body)}`,
        );
      }
      const json = await response.json();
      const embedding = this.parseLegacyEmbeddingResponse(json);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  private parseLegacyEmbeddingResponse(json: unknown): number[] {
    if (
      json &&
      typeof json === "object" &&
      !Array.isArray(json) &&
      Array.isArray((json as { embedding?: unknown }).embedding)
    ) {
      return (json as { embedding: number[] }).embedding;
    }
    const parsed = parseEmbeddingResponse(json);
    const embedding = parsed[0];
    if (!embedding) throw new Error("Local sidecar legacy embedding response did not include an embedding.");
    return embedding;
  }
}
