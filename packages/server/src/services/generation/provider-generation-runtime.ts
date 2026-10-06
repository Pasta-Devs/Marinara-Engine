import {
  isClaudeAdaptiveOnlyNoSamplingModel,
  normalizeThinkingTagPairs,
  resolveManagedGenerationParameters,
  resolveProviderReasoningEffort,
  type GenerationParameterSendMap,
  type ManagedGenerationParameterDefinition,
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
import { mergeModelContextLimit, resolveStoredModelContextLimit } from "./model-access-policy.js";
import {
  keepsCodexDefaultEffort,
  normalizeChatTopP,
  supportsAssistantReasoningPrefill,
} from "./generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "./output-token-limits.js";
import {
  isFallbackConnectionUsable,
  withConnectionFallbackProvider,
  type FallbackConnection,
  type GenerationProviderOrigin,
} from "../llm/connection-fallback-provider.js";
import type { GenerationFallbackNotifier } from "./fallback-notification.js";

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

type GenerationParameterValues = {
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
  assistantReasoningPrefill: string;
  customThinkingTags: ThinkingTagPair[];
  customParameters: Record<string, unknown>;
  enabledParameters: GenerationParameterSendMap | undefined;
  stopSequences: string[];
  effectiveMaxContext: number | undefined;
};

export type GenerationParameterArgs = {
  connection: Pick<GenerationConnection, "provider" | "model" | "maxTokensOverride" | "defaultParameters">;
  chatMode: string;
  isSceneChat: boolean;
  chatParameters: unknown;
  managedParameterDefinitions: ManagedGenerationParameterDefinition[];
  modelAccessPolicy: Parameters<typeof mergeModelContextLimit>[0];
  initialSources?: Record<string, string>;
  /** A reasoning effort of `undefined` means nothing chose one yet: no level is sent and thinking stays off. */
  initial: Omit<GenerationParameterValues, "reasoningEffort"> & {
    reasoningEffort: GenerationParameterValues["reasoningEffort"] | undefined;
  };
};

type GenerationProviderRuntimeArgs = GenerationParameterArgs & {
  connectionId: string;
  connection: GenerationConnection;
  baseUrl: string;
  fallbackConnection?: FallbackConnection | null;
  fallbackBaseUrl?: string;
  onFallback?: GenerationFallbackNotifier;
  onProviderUsed?: (origin: GenerationProviderOrigin) => void;
  wrapProvider?: (provider: BaseLLMProvider) => BaseLLMProvider;
  initial: GenerationParameterValues;
};

export type ResolvedGenerationParameters = GenerationParameterArgs["initial"] & {
  parameterSources: Record<string, string>;
  connectionParams: ReturnType<typeof parseStoredGenerationParameters>;
  chatParams: ReturnType<typeof parseStoredGenerationParameters>;
  resolvedEffort: "low" | "medium" | "high" | "xhigh" | "max" | null;
  providerReasoningEffort: "none" | "low" | "medium" | "high" | "xhigh" | "max" | undefined;
  enableThinking: boolean;
  isClaudeNoSampling: boolean;
  providerTopK: number | undefined;
};

export type GenerationProviderRuntime = GenerationParameterValues &
  Omit<ResolvedGenerationParameters, keyof GenerationParameterValues> & {
    supportsAssistantReasoningPrefill: boolean;
    primaryProvider: BaseLLMProvider;
    provider: BaseLLMProvider;
  };

/**
 * Layer the saved generation parameters (defaults, then connection, then chat) and apply the provider and model rules
 * the main chat sends with. Agent calls and package calls reuse it with the connection layer alone (#7131).
 */
export function resolveGenerationParameters(args: GenerationParameterArgs): ResolvedGenerationParameters {
  const connectionParams = parseStoredGenerationParameters(args.connection.defaultParameters);
  const chatParams = parseStoredGenerationParameters(args.chatParameters);
  const runtime = { ...args.initial };
  const parameterSources = Object.fromEntries(
    Object.keys(runtime).map((key) => [key, args.initialSources?.[key] ?? "defaults"]),
  );
  const forceParameters = (source: string, values: Partial<typeof runtime>) => {
    Object.assign(runtime, values);
    for (const key of Object.keys(values)) parameterSources[key] = source;
  };

  const applyParameterOverrides = (params: ReturnType<typeof parseStoredGenerationParameters>, source: string) => {
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
    if (typeof params.assistantReasoningPrefill === "string") {
      runtime.assistantReasoningPrefill = params.assistantReasoningPrefill;
    }
    if (params.customThinkingTags !== undefined) {
      runtime.customThinkingTags = normalizeThinkingTagPairs(params.customThinkingTags);
    }
    runtime.customParameters = mergeCustomParameters(runtime.customParameters, params.customParameters);
    if (params.enabledParameters) {
      runtime.enabledParameters = { ...(runtime.enabledParameters ?? {}), ...params.enabledParameters };
      for (const key of Object.keys(params.enabledParameters)) parameterSources[`send:${key}`] = source;
    }
    if (Array.isArray(params.stopSequences)) {
      runtime.stopSequences = params.stopSequences.map((value) => value.trim()).filter((value) => value.length > 0);
    }

    for (const key of Object.keys(runtime) as Array<keyof typeof runtime>) {
      const value = params[key as keyof typeof params];
      if (value !== undefined && (value === null || typeof value === typeof runtime[key]))
        parameterSources[key] = source;
    }
    const previousContext = runtime.effectiveMaxContext;
    runtime.effectiveMaxContext = mergeModelContextLimit(
      args.modelAccessPolicy,
      runtime.effectiveMaxContext,
      resolveStoredModelContextLimit(args.modelAccessPolicy, params),
    );
    if (runtime.effectiveMaxContext !== previousContext) parameterSources.effectiveMaxContext = source;
  };

  applyParameterOverrides(connectionParams, "connection");
  applyParameterOverrides(chatParams, "chat");
  runtime.customParameters = mergeCustomParameters(
    runtime.customParameters,
    resolveManagedGenerationParameters(
      args.managedParameterDefinitions,
      connectionParams?.managedCustomParameters,
      chatParams?.managedCustomParameters,
    ),
  );

  if (args.isSceneChat) {
    forceParameters("scene", { maxTokens: 8192, reasoningEffort: "maximum", verbosity: "high" });
  }

  if (args.chatMode === "game") {
    const capped = clampGenerationMaxOutputTokens({
      provider: args.connection.provider,
      model: args.connection.model,
      maxTokens: runtime.maxTokens,
      maxTokensOverride: args.connection.maxTokensOverride,
    });
    if (capped < runtime.maxTokens) forceParameters("outputCap", { maxTokens: capped });
  }

  const modelLower = (args.connection.model ?? "").toLowerCase();
  const providerLower = (args.connection.provider ?? "").toLowerCase();
  const isCodex = providerLower === "openai_chatgpt";
  if (runtime.reasoningEffort !== null && keepsCodexDefaultEffort(providerLower, connectionParams, chatParams)) {
    forceParameters("defaults", { reasoningEffort: null });
  }
  let resolvedEffort = resolveProviderReasoningEffort({
    provider: providerLower,
    model: modelLower,
    reasoningEffort: runtime.reasoningEffort,
  });

  if (resolvedEffort && !runtime.showThoughts) {
    runtime.showThoughts = true;
  }

  const enableThinking = !!resolvedEffort;
  const providerReasoningEffort =
    runtime.enabledParameters?.reasoningEffort === false
      ? undefined
      : runtime.reasoningEffort === null
        ? isCodex
          ? undefined
          : "none"
        : (resolvedEffort ?? undefined);
  const isClaudeNoSampling = isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
  if (isClaudeNoSampling) {
    forceParameters("provider", {
      temperature: undefined,
      topP: undefined,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });
  }

  const isClaudeTemperatureOnly =
    !isClaudeNoSampling &&
    (/claude-(opus|sonnet)-4-[56]/.test(modelLower) || /claude-(opus|sonnet)-4\.[56]/.test(modelLower));
  if (isClaudeTemperatureOnly) {
    forceParameters("provider", { topP: undefined, topK: 0, frequencyPenalty: 0, presencePenalty: 0 });
  }

  const providerTopK = resolveProviderTopK(runtime.topK);
  return {
    ...runtime,
    parameterSources,
    connectionParams,
    chatParams,
    resolvedEffort,
    providerReasoningEffort,
    enableThinking,
    isClaudeNoSampling,
    providerTopK,
  };
}

export function resolveGenerationProviderRuntime(args: GenerationProviderRuntimeArgs): GenerationProviderRuntime {
  const parameters = resolveGenerationParameters(args);
  const primaryProvider =
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
          args.connection.defaultParameters,
        );
  const primarySupportsAssistantReasoningPrefill = supportsAssistantReasoningPrefill(args.connection.provider);
  const hasUsableFallback = isFallbackConnectionUsable(
    args.fallbackConnection,
    args.connectionId,
    args.fallbackBaseUrl ?? "",
  );
  const fallbackSupportsAssistantReasoningPrefill = Boolean(
    hasUsableFallback && args.fallbackConnection && supportsAssistantReasoningPrefill(args.fallbackConnection.provider),
  );
  const provider = withConnectionFallbackProvider({
    primary: primaryProvider,
    wrapProvider: args.wrapProvider,
    primaryConnectionId: args.connectionId,
    fallbackConnection: args.fallbackConnection,
    fallbackBaseUrl: args.fallbackBaseUrl ?? "",
    category: "main",
    onFallback: args.onFallback,
    onProviderUsed: args.onProviderUsed,
    primarySupportsAssistantReasoningPrefill,
    fallbackSupportsAssistantReasoningPrefill,
  });

  return {
    ...parameters,
    // The main chat always starts from a chosen level or Off, so this never turns undefined into null.
    reasoningEffort: parameters.reasoningEffort ?? null,
    supportsAssistantReasoningPrefill:
      primarySupportsAssistantReasoningPrefill || fallbackSupportsAssistantReasoningPrefill,
    primaryProvider,
    provider,
  };
}
