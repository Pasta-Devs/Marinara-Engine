import { generationParametersSchema } from "@marinara-engine/shared";

import type { ChatCompletionResult, ChatMessage, ChatOptions, LLMUsage } from "./base-provider.js";
import { BaseLLMProvider } from "./base-provider.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isUnsafeCustomParameterKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function cloneCustomParameterValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneCustomParameterValue);
  if (isPlainRecord(value)) return mergeCustomParameters({}, value);
  return value;
}

function mergeCustomParameters(
  base: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base ?? {})) {
    if (!isUnsafeCustomParameterKey(key) && value !== undefined) merged[key] = cloneCustomParameterValue(value);
  }
  for (const [key, value] of Object.entries(next ?? {})) {
    if (isUnsafeCustomParameterKey(key) || value === undefined) continue;
    const current = merged[key];
    merged[key] =
      isPlainRecord(current) && isPlainRecord(value)
        ? mergeCustomParameters(current, value)
        : cloneCustomParameterValue(value);
  }
  return merged;
}

export function parseConnectionCustomParameters(defaultParameters: unknown): Record<string, unknown> {
  let parsed = defaultParameters;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!isPlainRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, "customParameters")) return {};
  const result = generationParametersSchema.shape.customParameters.safeParse(parsed.customParameters);
  return result.success ? mergeCustomParameters({}, result.data) : {};
}

class ConnectionDefaultProvider extends BaseLLMProvider {
  constructor(
    private readonly provider: BaseLLMProvider,
    private readonly defaultCustomParameters: Record<string, unknown>,
  ) {
    // This facade delegates all I/O; keep connection credentials confined to the wrapped provider.
    super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
  }

  private withDefaults(options: ChatOptions): ChatOptions {
    return {
      ...options,
      customParameters: mergeCustomParameters(this.defaultCustomParameters, options.customParameters),
    };
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    return yield* this.provider.chat(messages, this.withDefaults(options));
  }

  override chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    return this.provider.chatComplete(messages, this.withDefaults(options));
  }

  override embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    return this.provider.embed(texts, model, signal);
  }
}

/** Bind connection-scoped Custom Parameters to every text generation made through this provider. */
export function withConnectionDefaultParameters(
  provider: BaseLLMProvider,
  defaultParameters: unknown,
): BaseLLMProvider {
  const customParameters = parseConnectionCustomParameters(defaultParameters);
  return Object.keys(customParameters).length > 0
    ? new ConnectionDefaultProvider(provider, customParameters)
    : provider;
}
