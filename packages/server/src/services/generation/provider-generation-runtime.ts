import {
  isClaudeAdaptiveOnlyNoSamplingModel,
  isXaiAutoReasoningModel,
  normalizeThinkingTagPairs,
  supportsXhighReasoningEffort,
  type GenerationParameterSendMap,
  type ThinkingTagPair,
} from "@marinara-engine/shared";

import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { createLLMProvider } from "../llm/provider-registry.js";
import { getLocalSidecarProvider } from "../llm/local-sidecar.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import {
  mergeCustomParameters,
  normalizeServiceTier,
  parseStoredGenerationParameters,
  resolveProviderTopK,
} from "../../routes/generate/generate-route-utils.js";
import {
  mergeModelContextLimit,
  resolveStoredModelContextLimit,
} from "./model-access-policy.js";
import {
  normalizeChatTopP,
} from "./generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "./output-token-limits.js";

type GenerationConnection = {
  provider: string;
  model: string;
  apiKey: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  defaultParameters?: unknown;
  claudeFastMode?: unknown;
  treatAsLocalEndpoint?: unknown;
};

type GenerationProviderRuntimeArgs = {
  connectionId: string;
  connection: GenerationConnection;
  baseUrl: string;
  chatMode: string;
  isSceneChat: boolean;
  chatParameters: unknown;
  modelAccessPolicy: Parameters<typeof mergeModelContextLimit>[0];
  initial: {
    temperature: number | undefined;
    maxTokens: number;
    topP: number | undefined;
    topK: number;
    minP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    showThoughts: boolean;
    reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null;
    verbosity: "low" | "medium" | "high" | null;
    serviceTier: "flex" | "priority" | null;
    assistantPrefill: string;
    customThinkingTags: ThinkingTagPair[];
    customParameters: Record<string, unknown>;
    enabledParameters: GenerationParameterSendMap | undefined;
    stopSequences: string[];
    effectiveMaxContext: number | undefined;
  };
};

export type GenerationProviderRuntime = GenerationProviderRuntimeArgs["initial"] & {
  connectionParams: ReturnType<typeof parseStoredGenerationParameters>;
  chatParams: ReturnType<typeof parseStoredGenerationParameters>;
  resolvedEffort: "low" | "medium" | "high" | "xhigh" | "max" | null;
  enableThinking: boolean;
  isClaudeNoSampling: boolean;
  providerTopK: number | undefined;
  provider: BaseLLMProvider;
};

export function resolveGenerationProviderRuntime(args: GenerationProviderRuntimeArgs): GenerationProviderRuntime {
  const connectionParams = parseStoredGenerationParameters(args.connection.defaultParameters);
  const chatParams = parseStoredGenerationParameters(args.chatParameters);
  const runtime = { ...args.initial };

  const applyParameterOverrides = (params: ReturnType<typeof parseStoredGenerationParameters>) => {
    if (!params) return;
    if (typeof params.temperature === "number") runtime.temperature = params.temperature;
    if (typeof params.maxTokens === "number") runtime.maxTokens = params.maxTokens;
    runtime.topP = normalizeChatTopP(params.topP) ?? runtime.topP;
    if (typeof params.topK === "number") runtime.topK = params.topK;
    if (typeof params.minP === "number") runtime.minP = params.minP;
    if (typeof params.frequencyPenalty === "number") runtime.frequencyPenalty = params.frequencyPenalty;
    if (typeof params.presencePenalty === "number") runtime.presencePenalty = params.presencePenalty;
    if (typeof params.showThoughts === "boolean") runtime.showThoughts = params.showThoughts;
    if (params.reasoningEffort !== undefined) runtime.reasoningEffort = params.reasoningEffort;
    if (params.verbosity !== undefined) runtime.verbosity = params.verbosity;
    if (params.serviceTier !== undefined) runtime.serviceTier = normalizeServiceTier(params.serviceTier);
    if (typeof params.assistantPrefill === "string") runtime.assistantPrefill = params.assistantPrefill;
    if (params.customThinkingTags !== undefined) {
      runtime.customThinkingTags = normalizeThinkingTagPairs(params.customThinkingTags);
    }
    runtime.customParameters = mergeCustomParameters(runtime.customParameters, params.customParameters);
    if (params.enabledParameters) {
      runtime.enabledParameters = { ...(runtime.enabledParameters ?? {}), ...params.enabledParameters };
    }
    if (Array.isArray(params.stopSequences)) {
      runtime.stopSequences = params.stopSequences.map((value) => value.trim()).filter((value) => value.length > 0);
    }

    runtime.effectiveMaxContext = mergeModelContextLimit(
      args.modelAccessPolicy,
      runtime.effectiveMaxContext,
      resolveStoredModelContextLimit(args.modelAccessPolicy, params),
    );
  };

  const isLocalGemma = (args.connection.model ?? "").toLowerCase().includes("gemma");
  applyParameterOverrides(connectionParams);
  applyParameterOverrides(chatParams);

  if (args.isSceneChat) {
    runtime.maxTokens = 8192;
    runtime.reasoningEffort = "maximum";
    runtime.verbosity = "high";
  }

  if (args.chatMode === "game" && !isLocalGemma) {
    runtime.temperature = 1;
    runtime.maxTokens = 16_384;
    runtime.topP = 1;
    runtime.topK = 0;
    runtime.minP = 0;
    runtime.frequencyPenalty = 0;
    runtime.presencePenalty = 0;
    runtime.reasoningEffort = "maximum";
    runtime.verbosity = null;
  } else if (args.chatMode === "game" && typeof chatParams?.maxTokens !== "number") {
    runtime.maxTokens = Math.max(runtime.maxTokens, 16_384);
  }

  if (args.chatMode === "game") {
    runtime.maxTokens = clampGenerationMaxOutputTokens({
      provider: args.connection.provider,
      model: args.connection.model,
      maxTokens: Math.max(runtime.maxTokens, 16_384),
      maxTokensOverride: args.connection.maxTokensOverride,
    });
  }

  const modelLower = (args.connection.model ?? "").toLowerCase();
  const providerLower = (args.connection.provider ?? "").toLowerCase();
  let resolvedEffort: "low" | "medium" | "high" | "xhigh" | "max" | null =
    runtime.reasoningEffort !== "maximum" ? runtime.reasoningEffort : null;
  const supportsXhigh = supportsXhighReasoningEffort(modelLower);
  if (runtime.reasoningEffort === "xhigh" && !supportsXhigh) {
    resolvedEffort = "high";
  }
  if (runtime.reasoningEffort === "maximum") {
    const isNativeAnthropicAdaptiveOnly =
      (providerLower === "anthropic" || providerLower === "claude_subscription") &&
      isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
    resolvedEffort = isNativeAnthropicAdaptiveOnly ? "max" : supportsXhigh ? "xhigh" : "high";
  }

  const xaiUsesAutoReasoning =
    (providerLower === "xai" && isXaiAutoReasoningModel(modelLower)) ||
    (providerLower === "openrouter" && modelLower.startsWith("x-ai/grok-"));
  if (xaiUsesAutoReasoning) {
    resolvedEffort = null;
  }
  if (resolvedEffort && !runtime.showThoughts) {
    runtime.showThoughts = true;
  }

  const enableThinking = !!resolvedEffort;
  const isClaudeNoSampling = isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
  if (isClaudeNoSampling) {
    runtime.temperature = undefined;
    runtime.topP = undefined;
    runtime.topK = 0;
    runtime.frequencyPenalty = 0;
    runtime.presencePenalty = 0;
  }

  const isClaudeTemperatureOnly =
    !isClaudeNoSampling &&
    (/claude-(opus|sonnet)-4-[56]/.test(modelLower) || /claude-(opus|sonnet)-4\.[56]/.test(modelLower));
  if (isClaudeTemperatureOnly) {
    runtime.topP = undefined;
    runtime.topK = 0;
    runtime.frequencyPenalty = 0;
    runtime.presencePenalty = 0;
  }

  const providerTopK = resolveProviderTopK(args.connection.provider, runtime.topK);
  const provider =
    args.connectionId === LOCAL_SIDECAR_CONNECTION_ID
      ? getLocalSidecarProvider()
      : createLLMProvider(
          args.connection.provider,
          args.baseUrl,
          args.connection.apiKey,
          args.connection.maxContext,
          args.connection.openrouterProvider,
          args.connection.maxTokensOverride,
          args.connection.claudeFastMode === "true",
          args.connection.treatAsLocalEndpoint === "true",
        );

  return {
    ...runtime,
    connectionParams,
    chatParams,
    resolvedEffort,
    enableThinking,
    isClaudeNoSampling,
    providerTopK,
    provider,
  };
}
