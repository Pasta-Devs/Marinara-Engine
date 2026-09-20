import { randomUUID } from "node:crypto";
import type { DiagnosticContext } from "../../lib/diagnostics.js";
import { getDiagnosticContext, withDiagnosticContext } from "../../lib/diagnostics.js";
import { reportDiagnosticError } from "../../lib/diagnostic-operation.js";
import { logger } from "../../lib/logger.js";
import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider } from "./base-provider.js";

type ProviderOperationContext = DiagnosticContext & {
  operationId: string;
  provider: string;
  model?: string;
  connectionId?: string;
};

function operationContext(
  provider: string,
  connectionId: string | undefined,
  model?: string,
): ProviderOperationContext {
  return {
    ...getDiagnosticContext(),
    operation: "llm.provider",
    stage: "completion",
    operationId: randomUUID(),
    provider,
    ...(connectionId ? { connectionId } : {}),
    ...(model ? { model } : {}),
  };
}

function safeLength(value: unknown): number | undefined {
  return typeof value === "string" ? value.length : undefined;
}

function logFailure(context: ProviderOperationContext, error: unknown, startedAt: number, stage: string): void {
  const diagnostic = reportDiagnosticError(error, { ...context, stage });
  logger.error(
    { ...context, ...diagnostic, diagnostic, stage, elapsedMs: Date.now() - startedAt },
    "LLM provider operation failed",
  );
}

function logCompletion(context: ProviderOperationContext, startedAt: number, result: ChatCompletionResult): void {
  const cancelled = result.finishReason === "abort";
  const degraded = result.finishReason === "error";
  const record = {
    ...context,
    stage: cancelled ? "cancelled" : degraded ? "partial-stream" : "success",
    elapsedMs: Date.now() - startedAt,
    finishReason: result.finishReason,
    outputLength: safeLength(result.content),
    usage: result.usage
      ? {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          cachedPromptTokens: result.usage.cachedPromptTokens,
          cacheWritePromptTokens: result.usage.cacheWritePromptTokens,
          finishReason: result.usage.finishReason,
        }
      : undefined,
  };
  if (cancelled) logger.warn(record, "LLM provider completion cancelled");
  else if (degraded) logger.warn(record, "LLM provider completion degraded after partial output");
  else logger.info(record, "LLM provider completion succeeded");
}

function wrapChatIterator(
  iterator: AsyncGenerator<string, LLMUsage | void, unknown>,
  context: ProviderOperationContext,
  startedAt: number,
  signal?: AbortSignal,
): AsyncGenerator<string, LLMUsage | void, unknown> {
  let outputLength = 0;
  let firstYieldMs: number | undefined;
  let settled = false;
  const run = <T>(operation: () => Promise<T>): Promise<T> => withDiagnosticContext(context, operation);
  const finishFailure = (error: unknown) => {
    if (settled) return;
    settled = true;
    logFailure(
      context,
      error,
      startedAt,
      signal?.aborted ? "cancelled" : outputLength > 0 ? "partial-stream" : "failure",
    );
  };
  const finishSuccess = (usage: LLMUsage | void) => {
    if (settled) return;
    settled = true;
    const stage =
      usage && (usage.finishReason === "abort" || usage.finishReason === "error")
        ? usage.finishReason === "abort"
          ? "cancelled"
          : "partial-stream"
        : "success";
    const record = {
      ...context,
      stage,
      elapsedMs: Date.now() - startedAt,
      firstYieldMs,
      outputLength,
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            cachedPromptTokens: usage.cachedPromptTokens,
            cacheWritePromptTokens: usage.cacheWritePromptTokens,
            finishReason: usage.finishReason,
          }
        : undefined,
    };
    if (stage === "cancelled") logger.warn(record, "LLM provider stream cancelled");
    else if (stage === "partial-stream") logger.warn(record, "LLM provider stream degraded after partial output");
    else logger.info(record, "LLM provider stream succeeded");
  };
  const wrapped = {
    next(value?: unknown) {
      return run(() => iterator.next(value)).then(
        (result) => {
          if (result.done) finishSuccess(result.value);
          else {
            outputLength += result.value.length;
            firstYieldMs ??= Date.now() - startedAt;
          }
          return result;
        },
        (error) => {
          finishFailure(error);
          throw error;
        },
      );
    },
    return(value?: LLMUsage | void) {
      return run(() => iterator.return(value)).then(
        (result) => {
          if (!settled) {
            settled = true;
            logger.info(
              { ...context, stage: "cancelled", elapsedMs: Date.now() - startedAt, outputLength },
              "LLM provider stream closed early",
            );
          }
          return result;
        },
        (error) => {
          finishFailure(error);
          throw error;
        },
      );
    },
    throw(error?: unknown) {
      return run(() => iterator.throw(error)).then(
        (result) => {
          if (result.done) finishSuccess(result.value);
          else {
            outputLength += result.value.length;
            firstYieldMs ??= Date.now() - startedAt;
          }
          return result;
        },
        (failure) => {
          finishFailure(failure);
          throw failure;
        },
      );
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as AsyncGenerator<string, LLMUsage | void, unknown>;
  return wrapped;
}

class DiagnosticProvider extends BaseLLMProvider {
  constructor(
    private readonly provider: BaseLLMProvider,
    private readonly providerName: string,
    private readonly connectionId?: string,
  ) {
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
  }

  override setCustomRequestHeaders(headers: Record<string, string>): void {
    super.setCustomRequestHeaders(headers);
    this.provider.setCustomRequestHeaders(headers);
  }

  chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const context = operationContext(this.providerName, this.connectionId, options.model);
    const startedAt = Date.now();
    logger.info({ ...context, stage: "start" }, "LLM provider stream started");
    try {
      const iterator = withDiagnosticContext(context, () => this.provider.chat(messages, options));
      return wrapChatIterator(iterator, context, startedAt, options.signal);
    } catch (error) {
      logFailure(context, error, startedAt, options.signal?.aborted ? "cancelled" : "failure");
      throw error;
    }
  }

  override chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    const startedAt = Date.now();
    const context = operationContext(this.providerName, this.connectionId, options.model);
    logger.info({ ...context, stage: "start" }, "LLM provider completion started");
    let result: Promise<ChatCompletionResult>;
    try {
      result = withDiagnosticContext(context, () => this.provider.chatComplete(messages, options));
    } catch (error) {
      logFailure(context, error, startedAt, "failure");
      throw error;
    }
    return result.then(
      (value) => {
        logCompletion(context, startedAt, value);
        return value;
      },
      (error) => {
        logFailure(context, error, startedAt, options.signal?.aborted ? "cancelled" : "failure");
        throw error;
      },
    );
  }

  override embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    const startedAt = Date.now();
    const context = operationContext(this.providerName, this.connectionId, model);
    logger.info({ ...context, stage: "start" }, "LLM provider embedding started");
    let result: Promise<number[][]>;
    try {
      result = withDiagnosticContext(context, () => this.provider.embed(texts, model, signal));
    } catch (error) {
      logFailure(context, error, startedAt, "failure");
      throw error;
    }
    return result.then(
      (value) => {
        logger.info(
          { ...context, stage: "success", elapsedMs: Date.now() - startedAt, outputLength: value.length },
          "LLM provider embedding succeeded",
        );
        return value;
      },
      (error) => {
        logFailure(context, error, startedAt, signal?.aborted ? "cancelled" : "failure");
        throw error;
      },
    );
  }
}

export function withDiagnosticProvider(
  provider: BaseLLMProvider,
  providerName: string,
  connectionId?: string,
): BaseLLMProvider {
  if (provider instanceof DiagnosticProvider) return provider;
  return new DiagnosticProvider(provider, providerName, connectionId);
}
