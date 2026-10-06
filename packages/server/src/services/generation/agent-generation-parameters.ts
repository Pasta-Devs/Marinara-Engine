import {
  relevantGenerationParameters,
  type CapabilityLanguageModelCompletionOptions,
  type ChatOptions,
  type GenerationParameterSendMap,
  type ManagedGenerationParameterDefinition,
} from "@marinara-engine/shared";
import { resolveModelAccessPolicy } from "./model-access-policy.js";
import { clampGenerationMaxOutputTokens, resolveThinkingHeadroom } from "./output-token-limits.js";
import {
  resolveGenerationParameters,
  type GenerationParameterArgs,
  type ResolvedGenerationParameters,
} from "./provider-generation-runtime.js";

/**
 * The saved connection parameters an agent call sends (#7131), resolved by the same code as the main chat. Fields are
 * present only when the connection saved them, so an agent on a connection without custom defaults sends what it
 * always did.
 */
export type AgentGenerationParameters = {
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  verbosity?: "low" | "medium" | "high";
  serviceTier?: "flex" | "priority";
  /** The model rejects sampling parameters, so the agent's own temperature is not sent either. */
  omitTemperature?: true;
  /** Present only when the connection chose a reasoning level or Off; it replaces the agent's own default. */
  reasoning?: { reasoningEffort?: ChatOptions["reasoningEffort"]; enableThinking: boolean };
  /** The provider counts thinking inside max tokens, so a call that thinks needs room left for the answer. */
  thinkingHeadroom?: true;
};

export type AgentConnectionParameters = {
  customParameters: Record<string, unknown>;
  temperature?: number;
  enabledParameters?: GenerationParameterSendMap;
  generation: AgentGenerationParameters;
};

type ConnectionParameterSource = {
  provider: string;
  model: string;
  maxContext?: unknown;
  maxTokensOverride?: number | null;
  defaultParameters: unknown;
  managedParameterDefinitions?: ManagedGenerationParameterDefinition[];
};

/**
 * Anthropic sizes its own thinking budget on top of max tokens; Codex, Claude Subscription and the Grok CLI never send
 * max tokens. Every other provider counts reasoning inside the limit.
 */
const PROVIDERS_WITHOUT_THINKING_HEADROOM = new Set([
  "anthropic",
  "claude_subscription",
  "openai_chatgpt",
  "grok_subscription",
]);

/** Connection-only starting point: nothing is chosen, so only what the connection saved is sent. */
function connectionOnlyBaseline(): GenerationParameterArgs["initial"] {
  return {
    temperature: undefined,
    maxTokens: 0,
    topP: undefined,
    topK: 0,
    minP: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    showThoughts: false,
    reasoningEffort: undefined,
    verbosity: null,
    serviceTier: null,
    assistantPrefill: "",
    assistantReasoningPrefill: "",
    customThinkingTags: [],
    customParameters: {},
    enabledParameters: undefined,
    stopSequences: [],
    effectiveMaxContext: undefined,
  };
}

/**
 * Resolve one connection's saved parameters through the main chat's rules (send switches, reasoning normalisation,
 * Codex Default, Claude sampling limits, managed custom parameters) without a preset, a chat layer or scene forcing.
 */
export function resolveConnectionGenerationParameters(source: ConnectionParameterSource): ResolvedGenerationParameters {
  return resolveGenerationParameters({
    connection: {
      provider: source.provider,
      model: source.model,
      maxTokensOverride: source.maxTokensOverride,
      defaultParameters: source.defaultParameters,
    },
    chatMode: "agent",
    isSceneChat: false,
    chatParameters: null,
    managedParameterDefinitions: source.managedParameterDefinitions ?? [],
    modelAccessPolicy: resolveModelAccessPolicy({
      provider: source.provider,
      model: source.model,
      maxContext: source.maxContext,
    }),
    initial: connectionOnlyBaseline(),
  });
}

/** The connection's own Send switch for a parameter; on unless it was switched off. */
function connectionSends(resolved: ResolvedGenerationParameters, key: keyof GenerationParameterSendMap): boolean {
  return resolved.enabledParameters?.[key] !== false;
}

/**
 * A level counts as chosen only when the connection saved one, sends it, and shows Reasoning Effort for this model.
 * Codex keeps its own level while the saved value is Default (null).
 */
function connectionChoseReasoning(source: ConnectionParameterSource, resolved: ResolvedGenerationParameters): boolean {
  if (resolved.parameterSources.reasoningEffort !== "connection" || !connectionSends(resolved, "reasoningEffort")) {
    return false;
  }
  if (source.provider.toLowerCase() === "openai_chatgpt" && resolved.reasoningEffort == null) return false;
  return relevantGenerationParameters({ provider: source.provider, model: source.model }).has("reasoningEffort");
}

function definedOnly<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/**
 * What a connection contributes to the agent calls made through it. Values behind a switched-off Send switch are left
 * out here, so an agent on the chat's connection, which sends with the chat's switches, still never sends them.
 */
export function resolveAgentConnectionParameters(source: ConnectionParameterSource): AgentConnectionParameters {
  const resolved = resolveConnectionGenerationParameters(source);
  const sent = <T>(key: keyof GenerationParameterSendMap, value: T) =>
    connectionSends(resolved, key) ? value : undefined;
  const reasoning = connectionChoseReasoning(source, resolved)
    ? { reasoningEffort: resolved.providerReasoningEffort, enableThinking: resolved.enableThinking }
    : undefined;
  return {
    customParameters: resolved.customParameters,
    temperature: resolved.temperature,
    enabledParameters: resolved.enabledParameters,
    generation: definedOnly<AgentGenerationParameters>({
      topP: sent("topP", resolved.topP),
      topK: sent("topK", resolved.providerTopK),
      minP: resolved.minP || undefined,
      frequencyPenalty: sent("frequencyPenalty", resolved.frequencyPenalty || undefined),
      presencePenalty: sent("presencePenalty", resolved.presencePenalty || undefined),
      verbosity: sent("verbosity", resolved.verbosity ?? undefined),
      serviceTier: resolved.serviceTier ?? undefined,
      omitTemperature: resolved.isClaudeNoSampling ? true : undefined,
      reasoning: reasoning ? definedOnly(reasoning) : undefined,
      thinkingHeadroom: PROVIDERS_WITHOUT_THINKING_HEADROOM.has(source.provider.toLowerCase()) ? undefined : true,
    }),
  };
}

/** The visible answer budget plus room for thinking, when this call thinks on a provider that counts it. */
export function withThinkingHeadroom(
  visibleMaxTokens: number,
  generation: AgentGenerationParameters | undefined,
  enabledParameters: GenerationParameterSendMap | undefined,
): number {
  const effort = generation?.reasoning?.reasoningEffort;
  if (!generation?.thinkingHeadroom || !effort || effort === "none") return visibleMaxTokens;
  if (enabledParameters?.reasoningEffort === false) return visibleMaxTokens;
  return visibleMaxTokens + resolveThinkingHeadroom(effort, visibleMaxTokens);
}

type CapabilityChatOptions = Pick<
  ChatOptions,
  | "temperature"
  | "maxTokens"
  | "topP"
  | "topK"
  | "minP"
  | "frequencyPenalty"
  | "presencePenalty"
  | "reasoningEffort"
  | "enableThinking"
  | "verbosity"
  | "serviceTier"
  | "customParameters"
  | "enabledParameters"
>;

/**
 * Merge a package's language-model request with the connection's saved parameters (#7131). A value the connection
 * saved and sends wins; anything it leaves unset keeps the package's own request, as before. A switched-off Reasoning
 * Effort or Max Tokens is not sent at all, as on chat and agent calls; Temperature and Verbosity start switched off,
 * so there the package's own value stays. Max tokens stays the package's, plus thinking room when the connection
 * raised the reasoning level.
 */
export function resolveCapabilityChatOptions(
  source: ConnectionParameterSource,
  options: Pick<
    CapabilityLanguageModelCompletionOptions,
    "temperature" | "maxTokens" | "reasoningEffort" | "verbosity"
  >,
): CapabilityChatOptions {
  const resolved = resolveConnectionGenerationParameters(source);
  const sends = (key: keyof GenerationParameterSendMap) => connectionSends(resolved, key);
  const saved = (key: string) => resolved.parameterSources[key] === "connection";
  const merged: CapabilityChatOptions = {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    reasoningEffort: options.reasoningEffort,
    verbosity: options.verbosity,
  };
  if (saved("temperature") && sends("temperature") && resolved.temperature !== undefined) {
    merged.temperature = resolved.temperature;
  }
  if (resolved.isClaudeNoSampling) merged.temperature = undefined;
  if (sends("topP")) merged.topP = resolved.topP;
  if (sends("topK")) merged.topK = resolved.providerTopK;
  merged.minP = resolved.minP || undefined;
  if (sends("frequencyPenalty")) merged.frequencyPenalty = resolved.frequencyPenalty || undefined;
  if (sends("presencePenalty")) merged.presencePenalty = resolved.presencePenalty || undefined;
  if (saved("verbosity") && sends("verbosity") && resolved.verbosity) merged.verbosity = resolved.verbosity;
  if (saved("serviceTier") && resolved.serviceTier) merged.serviceTier = resolved.serviceTier;
  if (Object.keys(resolved.customParameters).length > 0) merged.customParameters = resolved.customParameters;
  const switchedOff = (["reasoningEffort", "maxTokens"] as const).filter((key) => !sends(key));
  if (switchedOff.length > 0) merged.enabledParameters = Object.fromEntries(switchedOff.map((key) => [key, false]));

  const effort = resolved.providerReasoningEffort;
  if (connectionChoseReasoning(source, resolved) && effort) {
    merged.reasoningEffort = effort;
    merged.enableThinking = resolved.enableThinking;
    if (
      effort !== "none" &&
      effort !== options.reasoningEffort &&
      typeof options.maxTokens === "number" &&
      !PROVIDERS_WITHOUT_THINKING_HEADROOM.has(source.provider.toLowerCase())
    ) {
      // The caps only trim the added room; the package's own request is never cut below what it asked for.
      merged.maxTokens = Math.max(
        options.maxTokens,
        clampGenerationMaxOutputTokens({
          provider: source.provider,
          model: source.model,
          maxTokens: options.maxTokens + resolveThinkingHeadroom(effort, options.maxTokens),
          maxTokensOverride: source.maxTokensOverride,
        }),
      );
    }
  }
  return definedOnly(merged);
}
