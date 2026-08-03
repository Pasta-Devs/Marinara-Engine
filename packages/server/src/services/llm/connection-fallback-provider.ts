import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider } from "./base-provider.js";
import { createLLMProvider } from "./provider-registry.js";
import {
  mergeCustomParameters,
  parseStoredGenerationParameters,
} from "../../routes/generate/generate-route-utils.js";
import { logger } from "../../lib/logger.js";
import { notifyGenerationFallback, type GenerationFallbackNotifier } from "../generation/fallback-notification.js";
import {
  isConnectionAdmissionFailure,
  withConnectionAdmissionProvider,
  type ConnectionAdmissionMode,
} from "../generation/connection-admission.js";

export type FallbackConnection = {
  id: string;
  name?: string | null;
  provider: string;
  baseUrl: string | null;
  apiKey: string;
  model: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  defaultParameters?: unknown;
  maxParallelJobs?: number | null;
  enableCaching?: string | boolean | null;
  anthropicExtendedCacheTtl?: string | boolean | null;
  cachingAtDepth?: number | null;
  claudeFastMode?: string | boolean | null;
  treatAsLocalEndpoint?: string | boolean | null;
};

type ConnectionFallbackProviderArgs = {
  primary: BaseLLMProvider;
  primaryConnectionId: string;
  fallbackConnection: FallbackConnection | null | undefined;
  fallbackBaseUrl: string;
  category: "main" | "agents";
  onFallback?: GenerationFallbackNotifier;
  admissionMode?: ConnectionAdmissionMode;
};

function isEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function isAbortFailure(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "AbortError" || candidate.code === "ABORT_ERR";
}

function fallbackOptions(options: ChatOptions, connection: FallbackConnection): ChatOptions {
  const stored = parseStoredGenerationParameters(connection.defaultParameters);
  const maxTokensOverride =
    typeof connection.maxTokensOverride === "number" && connection.maxTokensOverride > 0
      ? Math.floor(connection.maxTokensOverride)
      : null;
  const maxTokens =
    typeof stored?.maxTokens === "number"
      ? stored.maxTokens
      : typeof options.maxTokens === "number"
        ? options.maxTokens
        : undefined;
  const reasoningSendDisabled = stored?.enabledParameters?.reasoningEffort === false;
  const hasStoredReasoningEffort = stored?.reasoningEffort !== undefined;
  const reasoningEffort = reasoningSendDisabled
    ? undefined
    : stored?.reasoningEffort === "maximum"
      ? "max"
      : stored?.reasoningEffort === null
        ? "none"
        : (stored?.reasoningEffort ?? options.reasoningEffort);
  const enableThinking = reasoningSendDisabled
    ? false
    : hasStoredReasoningEffort
      ? stored?.reasoningEffort !== null
      : options.enableThinking;

  return {
    ...options,
    model: connection.model,
    maxContext:
      typeof connection.maxContext === "number" && connection.maxContext > 0
        ? Math.floor(connection.maxContext)
        : options.maxContext,
    maxTokens: typeof maxTokens === "number" && maxTokensOverride ? Math.min(maxTokens, maxTokensOverride) : maxTokens,
    temperature: stored?.temperature ?? options.temperature,
    topP: stored?.topP ?? options.topP,
    topK: stored?.topK ?? options.topK,
    minP: stored?.minP ?? options.minP,
    frequencyPenalty: stored?.frequencyPenalty ?? options.frequencyPenalty,
    presencePenalty: stored?.presencePenalty ?? options.presencePenalty,
    reasoningEffort,
    enableThinking,
    verbosity: stored?.verbosity === null ? undefined : (stored?.verbosity ?? options.verbosity),
    serviceTier: stored?.serviceTier ?? options.serviceTier,
    stop: stored?.stopSequences ?? options.stop,
    customParameters: mergeCustomParameters(stored?.customParameters, options.customParameters),
    enabledParameters: stored?.enabledParameters,
    enableCaching: isEnabled(connection.enableCaching),
    anthropicExtendedCacheTtl: isEnabled(connection.anthropicExtendedCacheTtl),
    cachingAtDepth:
      typeof connection.cachingAtDepth === "number" && connection.cachingAtDepth >= 0 ? connection.cachingAtDepth : 5,
    openrouterProvider: connection.openrouterProvider ?? undefined,
    encryptedReasoningItems: undefined,
  };
}

export class ConnectionFallbackProvider extends BaseLLMProvider {
  constructor(
    private readonly primary: BaseLLMProvider,
    private readonly fallback: BaseLLMProvider,
    private readonly connection: FallbackConnection,
    private readonly category: "main" | "agents",
    private readonly onFallback?: GenerationFallbackNotifier,
  ) {
    super("", "", primary.maxContextValue ?? undefined, null, primary.maxTokensOverrideValue);
  }

  private async logFallback(error: unknown): Promise<void> {
    logger.warn(
      error,
      "[%s-fallback] Primary generation failed before producing usable output; retrying with %s (%s)",
      this.category,
      this.connection.name?.trim() || this.connection.id,
      this.connection.model,
    );
    try {
      await (this.onFallback ?? notifyGenerationFallback)({
        category: this.category,
        connectionId: this.connection.id,
        connectionName: this.connection.name?.trim() || this.connection.id,
        model: this.connection.model,
      });
    } catch (noticeError) {
      logger.warn(noticeError, "[%s-fallback] Failed to report fallback activation", this.category);
    }
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    let emittedUsableOutput = false;
    try {
      const primaryOptions = options.onToken
        ? {
            ...options,
            onToken: async (chunk: string) => {
              emittedUsableOutput ||= chunk.trim().length > 0;
              await options.onToken?.(chunk);
            },
          }
        : options;
      const generation = this.primary.chat(messages, primaryOptions);
      try {
        let result = await generation.next();
        while (!result.done) {
          emittedUsableOutput ||= result.value.trim().length > 0;
          yield result.value;
          result = await generation.next();
        }
        if (emittedUsableOutput || options.signal?.aborted) return result.value;
      } finally {
        // Drive the primary to completion if our consumer abandoned us mid-stream. The manual
        // loop above does not forward an early return the way `yield*` would, so without this
        // an admission wrapper around the primary never runs its own finally and leaks the
        // connection's foreground slot for the lifetime of the process. A cleanup rejection is
        // logged rather than thrown: the provider error the catch below inspects is what decides
        // whether we fall back, and it must not be replaced by a teardown failure.
        await generation.return(undefined).catch((closeError: unknown) => {
          logger.warn(closeError, "[%s-fallback] Failed to close the primary generation stream", this.category);
        });
      }
      await this.logFallback(new Error("Primary provider returned an empty completion"));
    } catch (error) {
      if (emittedUsableOutput || isAbortFailure(error, options.signal) || isConnectionAdmissionFailure(error)) throw error;
      await this.logFallback(error);
    }
    options.signal?.throwIfAborted();
    return yield* this.fallback.chat(messages, fallbackOptions(options, this.connection));
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    try {
      const result = await this.primary.chatComplete(messages, options);
      const hasUsableOutput = Boolean(result.content?.trim()) || result.toolCalls.length > 0;
      if (hasUsableOutput || options.signal?.aborted) return result;
      await this.logFallback(new Error("Primary provider returned an empty completion"));
    } catch (error) {
      if (isAbortFailure(error, options.signal) || isConnectionAdmissionFailure(error)) throw error;
      await this.logFallback(error);
    }
    options.signal?.throwIfAborted();
    return this.fallback.chatComplete(messages, fallbackOptions(options, this.connection));
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    return this.primary.embed(texts, model, signal);
  }
}

export function withConnectionFallbackProvider({
  primary,
  primaryConnectionId,
  fallbackConnection,
  fallbackBaseUrl,
  category,
  onFallback,
  admissionMode = { kind: "foreground" },
}: ConnectionFallbackProviderArgs): BaseLLMProvider {
  const admittedPrimary = withConnectionAdmissionProvider(primary, primaryConnectionId, admissionMode);
  if (
    !fallbackConnection ||
    fallbackConnection.id === primaryConnectionId ||
    !fallbackConnection.model?.trim() ||
    !fallbackBaseUrl
  ) {
    return admittedPrimary;
  }
  const fallback = withConnectionAdmissionProvider(
    createLLMProvider(
      fallbackConnection.provider,
      fallbackBaseUrl,
      fallbackConnection.apiKey,
      fallbackConnection.maxContext,
      fallbackConnection.openrouterProvider,
      fallbackConnection.maxTokensOverride,
      isEnabled(fallbackConnection.claudeFastMode),
      isEnabled(fallbackConnection.treatAsLocalEndpoint),
      fallbackConnection.defaultParameters,
    ),
    fallbackConnection.id,
    admissionMode,
  );
  return new ConnectionFallbackProvider(admittedPrimary, fallback, fallbackConnection, category, onFallback);
}
