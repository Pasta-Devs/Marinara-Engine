import { findKnownModel, shouldSuppressUnknownModelParameters, type APIProvider } from "@marinara-engine/shared";
import {
  fitMessagesToContext,
  type ChatMessage,
  type ChatOptions,
  type ContextFitResult,
} from "../llm/base-provider.js";
import { minContextLimit, normalizeMaxContext } from "./generation-parameters.js";

export interface ModelAccessPolicy {
  suppressModelParameters: boolean;
  connectionMaxContext?: number;
  knownModelContext?: number;
  effectiveMaxContext?: number;
}

export function resolveModelAccessPolicy(args: {
  provider: string | null | undefined;
  model: string | null | undefined;
  maxContext?: unknown;
}): ModelAccessPolicy {
  const connectionMaxContext = normalizeMaxContext(args.maxContext);
  const suppressModelParameters = shouldSuppressUnknownModelParameters(args.provider, args.model);
  const knownModelContext =
    suppressModelParameters || !args.provider || !args.model
      ? undefined
      : normalizeMaxContext(findKnownModel(args.provider as APIProvider, args.model)?.context);
  return {
    suppressModelParameters,
    connectionMaxContext,
    knownModelContext,
    effectiveMaxContext: suppressModelParameters
      ? connectionMaxContext
      : minContextLimit(connectionMaxContext, knownModelContext),
  };
}

export function mergeModelContextLimit(
  _policy: ModelAccessPolicy,
  current: number | undefined,
  requested: number | undefined,
): number | undefined {
  return minContextLimit(current, requested);
}

export function resolveStoredModelContextLimit(
  policy: ModelAccessPolicy,
  params: { useMaxContext?: boolean; maxContext?: unknown } | null | undefined,
): number | undefined {
  if (!params) return undefined;
  if (params.useMaxContext) return policy.knownModelContext ?? policy.connectionMaxContext;
  return normalizeMaxContext(params.maxContext);
}

export function modelAccessOptions<T extends ChatOptions>(options: T, policy: ModelAccessPolicy): T {
  return policy.suppressModelParameters ? { ...options, suppressModelParameters: true } : options;
}

export function fitMessagesToModelAccessContext(args: {
  messages: ChatMessage[];
  policy: ModelAccessPolicy;
  maxTokens?: number;
  tools?: ChatOptions["tools"];
  responseFormat?: ChatOptions["responseFormat"];
}): ContextFitResult {
  return fitMessagesToContext(
    args.messages,
    {
      maxContext: args.policy.effectiveMaxContext,
      maxTokens: args.maxTokens,
      tools: args.tools,
      responseFormat: args.responseFormat,
      suppressModelParameters: false,
    },
    args.policy.connectionMaxContext,
  );
}

export function fitMessagesForModelAccess(args: {
  messages: ChatMessage[];
  policy: ModelAccessPolicy;
  maxTokens?: number;
  tools?: ChatOptions["tools"];
  responseFormat?: ChatOptions["responseFormat"];
}): { messages: ChatMessage[]; maxTokensForSend?: number } {
  const fit = fitMessagesToModelAccessContext(args);
  return {
    messages: fit.messages,
    maxTokensForSend: fit.maxTokens ?? args.maxTokens,
  };
}
