import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider } from "./base-provider.js";
import { createLLMProvider } from "./provider-registry.js";
import { withRateLimitAwareProvider } from "./rate-limit-aware-provider.js";
import { mergeCustomParameters, parseStoredGenerationParameters } from "../../routes/generate/generate-route-utils.js";
import { logger } from "../../lib/logger.js";
import { notifyGenerationFallback, type GenerationFallbackNotifier } from "../generation/fallback-notification.js";
import {
  isConnectionAdmissionFailure,
  splitConnectionAttemptAcrossFallback,
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

export type GenerationProviderOrigin = { kind: "primary" } | { kind: "fallback"; provider: string; model: string };

type ConnectionFallbackProviderArgs = {
  primary: BaseLLMProvider;
  primaryConnectionId: string;
  fallbackConnection: FallbackConnection | null | undefined;
  fallbackBaseUrl: string;
  category: "main" | "agents";
  onFallback?: GenerationFallbackNotifier;
  onProviderUsed?: (origin: GenerationProviderOrigin) => void;
  admissionMode?: ConnectionAdmissionMode;
  primarySupportsAssistantReasoningPrefill?: boolean;
  fallbackSupportsAssistantReasoningPrefill?: boolean;
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

export function prepareAssistantReasoningPrefillMessages(messages: ChatMessage[], supported: boolean): ChatMessage[] {
  if (supported) return messages;

  return messages.flatMap((message) => {
    const metadata = message.providerMetadata;
    if (metadata?.partial !== true || typeof metadata.reasoning_content !== "string") return [message];

    const { partial: _partial, reasoning_content: _reasoningContent, ...remainingMetadata } = metadata;
    const next: ChatMessage = { ...message };
    if (Object.keys(remainingMetadata).length > 0) next.providerMetadata = remainingMetadata;
    else delete next.providerMetadata;

    const hasPayload =
      !!next.content.trim() ||
      !!next.images?.length ||
      !!next.files?.length ||
      Object.keys(next.providerMetadata ?? {}).length > 0 ||
      !!next.tool_calls?.length ||
      !!next.tool_call_id;
    return hasPayload ? [next] : [];
  });
}

export function isFallbackConnectionUsable(
  fallbackConnection: FallbackConnection | null | undefined,
  primaryConnectionId: string,
  fallbackBaseUrl: string,
): fallbackConnection is FallbackConnection {
  return (
    !!fallbackConnection &&
    fallbackConnection.id !== primaryConnectionId &&
    !!fallbackConnection.model?.trim() &&
    !!fallbackBaseUrl.trim()
  );
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
    /** Reports the one logical attempt's outcome once the primary-plus-fallback chain settles. */
    private readonly settleAttempt?: (outcome: "completed" | "failed") => Promise<void>,
    private readonly onProviderUsed?: (origin: GenerationProviderOrigin) => void,
    private readonly primarySupportsAssistantReasoningPrefill = true,
    private readonly fallbackSupportsAssistantReasoningPrefill = true,
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
    // Only the whole chain's result is the logical attempt's outcome. Reporting a leg's own
    // result would record a successful fallback as the primary's failure, and would call an
    // empty-primary-then-rejected-fallback chain completed.
    //
    // Delivered output settles the attempt just as completion does: a consumer that walks away
    // after reading usable tokens, or a stream that breaks after emitting them, got what the
    // attempt was for. Tracking here rather than reusing chatChain's own flag covers tokens the
    // fallback leg delivered too — that flag only watches the primary.
    let delivered = false;
    let outcome: "completed" | "failed" = "failed";
    const chain = this.chatChain(messages, options);
    try {
      let result = await chain.next();
      while (!result.done) {
        delivered ||= result.value.trim().length > 0;
        yield result.value;
        result = await chain.next();
      }
      outcome = "completed";
      return result.value;
    } finally {
      // The manual loop does not forward an early return the way `yield*` would, so close the
      // chain explicitly or its own cleanup — and the admission slots it holds — never runs.
      await chain.return(undefined).catch((closeError: unknown) => {
        logger.warn(closeError, "[%s-fallback] Failed to close the fallback chain", this.category);
      });
      await this.settleAttempt?.(outcome === "completed" || delivered ? "completed" : "failed");
    }
  }

  private async *chatChain(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<string, LLMUsage | void, unknown> {
    let emittedUsableOutput = false;
    let reportedPrimary = false;
    const reportPrimary = () => {
      if (reportedPrimary) return;
      reportedPrimary = true;
      this.onProviderUsed?.({ kind: "primary" });
    };
    try {
      const primaryOptions = options.onToken
        ? {
            ...options,
            onToken: async (chunk: string) => {
              emittedUsableOutput ||= chunk.trim().length > 0;
              if (chunk.trim().length > 0) reportPrimary();
              await options.onToken?.(chunk);
            },
          }
        : options;
      const generation = this.primary.chat(
        prepareAssistantReasoningPrefillMessages(messages, this.primarySupportsAssistantReasoningPrefill),
        primaryOptions,
      );
      try {
        let result = await generation.next();
        while (!result.done) {
          emittedUsableOutput ||= result.value.trim().length > 0;
          if (result.value.trim().length > 0) reportPrimary();
          yield result.value;
          result = await generation.next();
        }
        if (emittedUsableOutput || options.signal?.aborted) {
          if (emittedUsableOutput) reportPrimary();
          return result.value;
        }
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
      if (emittedUsableOutput || isAbortFailure(error, options.signal) || isConnectionAdmissionFailure(error))
        throw error;
      await this.logFallback(error);
    }
    options.signal?.throwIfAborted();
    let reportedFallback = false;
    const reportFallback = () => {
      if (reportedFallback) return;
      reportedFallback = true;
      this.onProviderUsed?.({
        kind: "fallback",
        provider: this.connection.provider,
        model: this.connection.model,
      });
    };
    const nextOptions = fallbackOptions(options, this.connection);
    if (nextOptions.onToken) {
      const onToken = nextOptions.onToken;
      nextOptions.onToken = async (chunk: string) => {
        if (chunk.trim().length > 0) reportFallback();
        await onToken(chunk);
      };
    }
    const fallbackGeneration = this.fallback.chat(
      prepareAssistantReasoningPrefillMessages(messages, this.fallbackSupportsAssistantReasoningPrefill),
      nextOptions,
    );
    try {
      let result = await fallbackGeneration.next();
      while (!result.done) {
        if (result.value.trim().length > 0) reportFallback();
        yield result.value;
        result = await fallbackGeneration.next();
      }
      reportFallback();
      return result.value;
    } finally {
      await fallbackGeneration.return(undefined).catch((closeError: unknown) => {
        logger.warn(closeError, "[%s-fallback] Failed to close the fallback generation stream", this.category);
      });
    }
  }

  async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    let outcome: "completed" | "failed" = "failed";
    try {
      const result = await this.chatCompleteChain(messages, options);
      outcome = "completed";
      return result;
    } finally {
      await this.settleAttempt?.(outcome);
    }
  }

  private async chatCompleteChain(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    try {
      const result = await this.primary.chatComplete(
        prepareAssistantReasoningPrefillMessages(messages, this.primarySupportsAssistantReasoningPrefill),
        options,
      );
      const hasUsableOutput = Boolean(result.content?.trim()) || result.toolCalls.length > 0;
      if (hasUsableOutput || options.signal?.aborted) {
        if (hasUsableOutput) this.onProviderUsed?.({ kind: "primary" });
        return result;
      }
      await this.logFallback(new Error("Primary provider returned an empty completion"));
    } catch (error) {
      if (isAbortFailure(error, options.signal) || isConnectionAdmissionFailure(error)) throw error;
      await this.logFallback(error);
    }
    options.signal?.throwIfAborted();
    const result = await this.fallback.chatComplete(
      prepareAssistantReasoningPrefillMessages(messages, this.fallbackSupportsAssistantReasoningPrefill),
      fallbackOptions(options, this.connection),
    );
    this.onProviderUsed?.({
      kind: "fallback",
      provider: this.connection.provider,
      model: this.connection.model,
    });
    return result;
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
  onProviderUsed,
  admissionMode = { kind: "foreground" },
  primarySupportsAssistantReasoningPrefill = true,
  fallbackSupportsAssistantReasoningPrefill = true,
}: ConnectionFallbackProviderArgs): BaseLLMProvider {
  const { primaryMode, fallbackMode, settle } = splitConnectionAttemptAcrossFallback(admissionMode);
  if (!isFallbackConnectionUsable(fallbackConnection, primaryConnectionId, fallbackBaseUrl)) {
    // No fallback exists, so the primary is the whole logical attempt and owns its own outcome.
    // Rate-limit-aware wraps outside admission so a 429 pauses/retries this connection here too —
    // the main chat/agent path builds `primary` without a connectionId, so it is added here.
    return withRateLimitAwareProvider(
      withConnectionAdmissionProvider(primary, primaryConnectionId, admissionMode),
      primaryConnectionId,
    );
  }
  const admittedPrimary = withRateLimitAwareProvider(
    withConnectionAdmissionProvider(primary, primaryConnectionId, primaryMode),
    primaryConnectionId,
  );
  const fallback = withRateLimitAwareProvider(
    withConnectionAdmissionProvider(
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
      fallbackMode,
    ),
    fallbackConnection.id,
  );
  return new ConnectionFallbackProvider(
    admittedPrimary,
    fallback,
    fallbackConnection,
    category,
    onFallback,
    settle,
    onProviderUsed,
    primarySupportsAssistantReasoningPrefill,
    fallbackSupportsAssistantReasoningPrefill,
  );
}
