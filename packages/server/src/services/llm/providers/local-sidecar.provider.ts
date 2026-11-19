import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "../base-provider.js";
import { BaseLLMProvider, llmFetch, parseEmbeddingResponse, sanitizeApiError } from "../base-provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import { sidecarModelService } from "../../sidecar/sidecar-model.service.js";
import { sidecarProcessService } from "../../sidecar/sidecar-process.service.js";
import { resolveSidecarRequestModel } from "../../sidecar/sidecar-request-model.js";
import { acquireMainModelTurn, runOnMainModel } from "../../sidecar/main-model-turns.js";
import { getEmbeddingRequestTimeoutMs } from "../../../config/runtime-config.js";
import { logger } from "../../../lib/logger.js";

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /\(404\)|\b404\b|\(501\)|\b501\b|not enabled|not supported/i.test(error.message);
}

let warnedNativeToolCallsDisabled = false;

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

  private assertToolCallsAvailable(options: ChatOptions): void {
    if (!options.tools?.length) return;
    const config = sidecarModelService.getConfig();
    if (sidecarModelService.getResolvedBackend() === "mlx") {
      throw new Error(
        "Local sidecar tool calls are not supported on the MLX backend. Use llama.cpp with Native Tool Calls enabled or choose a remote tool-capable connection.",
      );
    }
    if (sidecarModelService.getResolvedBackend() === "llama_cpp" && !config.enableNativeToolCalls) {
      if (!warnedNativeToolCallsDisabled) {
        warnedNativeToolCallsDisabled = true;
        logger.warn(
          "[local-sidecar] Native tool calls are disabled (no --jinja); tool definitions will not be sent to the API. " +
            "Tool calls in the model response will be extracted via textual parsing only.",
        );
      }
    }
  }

  private isTextualToolCallFallback(): boolean {
    const config = sidecarModelService.getConfig();
    return sidecarModelService.getResolvedBackend() === "llama_cpp" && !config.enableNativeToolCalls;
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
      // Chat/preset Advanced Parameters are per-request and should win over the local runtime fallback.
      maxTokens: requestedMaxTokens ?? config.maxTokens,
      temperature: structuredOutput ? 0 : (options.temperature ?? config.temperature),
      topP: structuredOutput ? 1 : (options.topP ?? config.topP),
      topK: structuredOutput ? 0 : (options.topK ?? config.topK),
      minP: structuredOutput ? 0 : options.minP,
    };
  }

  private applyBackendRequestConstraints(options: ChatOptions): ChatOptions {
    if (sidecarModelService.getResolvedBackend() !== "mlx") {
      return options;
    }

    return {
      ...options,
      responseFormat: undefined,
    };
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    this.assertToolCallsAvailable(options);
    // The turn is held for the whole stream, so the slot it uses is counted until the last token.
    const release = await acquireMainModelTurn(options.localPriority, options.signal);
    try {
      const delegate = await this.createDelegate();
      const runtimeOptions = this.applyBackendRequestConstraints(this.applyRuntimeSettings(options));
      const forceTextual = this.isTextualToolCallFallback() && !!runtimeOptions.tools?.length;
      return yield* delegate.chat(messages, {
        ...runtimeOptions,
        model: this.getRequestModel(),
        ...(forceTextual ? { forceTextualToolCalls: true } : {}),
      });
    } finally {
      release();
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.assertToolCallsAvailable(options);
    return runOnMainModel(options.localPriority, options.signal, async () => {
      const delegate = await this.createDelegate();
      const runtimeOptions = this.applyBackendRequestConstraints(this.applyRuntimeSettings(options));
      const forceTextual = this.isTextualToolCallFallback() && !!runtimeOptions.tools?.length;
      return delegate.chatComplete(messages, {
        ...runtimeOptions,
        model: this.getRequestModel(),
        ...(forceTextual ? { forceTextualToolCalls: true } : {}),
      });
    });
  }

  async embed(texts: string[], _model: string, signal?: AbortSignal): Promise<number[][]> {
    if (sidecarModelService.getResolvedBackend() === "mlx") {
      throw new Error("Local sidecar embeddings are not supported on the MLX backend.");
    }
    if (!sidecarModelService.isEnabled()) {
      throw new Error(
        "Local sidecar embeddings require the local model to be enabled for trackers or game scene analysis.",
      );
    }

    return runOnMainModel(undefined, signal, async () => {
      const baseUrl = await sidecarProcessService.ensureReady();
      const requestModel = this.getRequestModel();

      try {
        return await this.requestOpenAIEmbeddings(baseUrl, texts, requestModel, signal);
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
        return this.requestLegacyEmbeddings(baseUrl, texts, signal);
      }
    });
  }

  private async requestOpenAIEmbeddings(
    baseUrl: string,
    texts: string[],
    model: string,
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const timeoutMs = getEmbeddingRequestTimeoutMs();
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const response = await llmFetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts, model }),
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      agentOptions: { bodyTimeout: timeoutMs, headersTimeout: timeoutMs },
      bufferResponse: true,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Local sidecar embedding request failed (${response.status}): ${sanitizeApiError(body)}`);
    }
    return parseEmbeddingResponse(await response.json());
  }

  private async requestLegacyEmbeddings(baseUrl: string, texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const timeoutMs = getEmbeddingRequestTimeoutMs();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const response = await llmFetch(`${baseUrl}/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
        agentOptions: { bodyTimeout: timeoutMs, headersTimeout: timeoutMs },
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
