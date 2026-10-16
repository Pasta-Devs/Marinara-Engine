import type { GenerationFallbackNotice } from "@marinara-engine/shared";
import type { LLMUsage } from "../../services/llm/base-provider.js";
import { getVisibleCompletionTokens } from "../../services/generation/generation-text-utils.js";
import { GAME_MARKET_PLACE_EXTRA } from "../../services/game/game-market.service.js";

/**
 * Builds the extra a saved reply gets after generation: game flags, the game tool-planning
 * connection, generationInfo and the per-swipe reasoning/injection fields. An absent value is
 * stored as null, not left out, so a regenerated swipe clears what the previous swipe saved.
 */
export function buildGenerationInfoExtra(o: {
  chatMode: string;
  gameOutcomeNarrationFailed: boolean;
  marketWorldPlace: string | null | undefined;
  gameToolPlan: { usage?: LLMUsage | null } | null | undefined;
  gameToolConnection: { id: string; model: string; provider: string } | null | undefined;
  generationProviderOrigin: { model: string; provider: string; fallback?: GenerationFallbackNotice };
  /** A continuation keeps the fallback that wrote the existing part of its swipe. */
  continuedFallback?: GenerationFallbackNotice | null;
  temperature: number | undefined;
  effectiveMaxTokensForSend: number | undefined;
  suppressModelParameters: boolean;
  effectiveMaxContext: number | null | undefined;
  connectionMaxContext: number | null | undefined;
  showThoughts: boolean | null | undefined;
  resolvedEffort: string | null | undefined;
  reasoningEffort: string | null | undefined;
  verbosity: string | null | undefined;
  serviceTier: string | null;
  assistantPrefill: string;
  assistantReasoningPrefill: string;
  customParameters: Record<string, unknown>;
  usage: LLMUsage | undefined;
  tokensContext: number | null;
  tokensLastRequestInput: number | null;
  requestCount: number;
  durationMs: number;
  reasoningDurationMs: number | null;
  finishReason: string | undefined;
  lastContextFit: unknown;
  fullThinking: string;
  geminiResponseParts: unknown[] | null;
  chatCompletionsReasoning: Record<string, unknown> | null;
  encryptedReasoningItems: unknown[] | undefined;
  contextInjections: unknown[];
}): Record<string, unknown> {
  const {
    chatMode,
    gameOutcomeNarrationFailed,
    marketWorldPlace,
    gameToolPlan,
    gameToolConnection,
    generationProviderOrigin,
    continuedFallback,
    temperature,
    effectiveMaxTokensForSend,
    suppressModelParameters,
    effectiveMaxContext,
    connectionMaxContext,
    showThoughts,
    resolvedEffort,
    reasoningEffort,
    verbosity,
    serviceTier,
    assistantPrefill,
    assistantReasoningPrefill,
    customParameters,
    usage,
    tokensContext,
    tokensLastRequestInput,
    requestCount,
    durationMs,
    reasoningDurationMs,
    finishReason,
    lastContextFit,
    fullThinking,
    geminiResponseParts,
    chatCompletionsReasoning,
    encryptedReasoningItems,
    contextInjections,
  } = o;
  const fallback = generationProviderOrigin.fallback ?? continuedFallback;
  const extraUpdate: Record<string, unknown> = {
    ...(chatMode === "game" ? { gameOutcomeNarrationFailed } : {}),
    // Set, or cleared on a regeneration at a place a tag named.
    ...(chatMode === "game" ? { [GAME_MARKET_PLACE_EXTRA]: marketWorldPlace ?? null } : {}),
    ...(gameToolPlan && gameToolConnection
      ? {
          gameToolPlanning: {
            connectionId: gameToolConnection.id,
            model: gameToolConnection.model,
            provider: gameToolConnection.provider,
            usage: gameToolPlan.usage ?? null,
          },
        }
      : {}),
    generationInfo: {
      model: generationProviderOrigin.model,
      provider: generationProviderOrigin.provider,
      temperature: temperature ?? null,
      maxTokens: effectiveMaxTokensForSend ?? null,
      maxContext: suppressModelParameters ? null : (effectiveMaxContext ?? connectionMaxContext ?? null),
      showThoughts: showThoughts ?? null,
      reasoningEffort: resolvedEffort ?? reasoningEffort ?? null,
      verbosity: verbosity ?? null,
      serviceTier,
      assistantPrefill: assistantPrefill || null,
      assistantReasoningPrefill: assistantReasoningPrefill || null,
      customParameters: Object.keys(customParameters).length > 0 ? customParameters : null,
      tokensPrompt: usage?.promptTokens ?? null,
      tokensContext,
      tokensLastRequestInput,
      requestCount,
      tokensCompletion: usage?.completionTokens ?? null,
      tokensVisibleCompletion: getVisibleCompletionTokens(usage) ?? null,
      tokensReasoning: usage?.completionReasoningTokens ?? null,
      tokensCompletionAudio: usage?.completionAudioTokens ?? null,
      tokensRejectedPrediction: usage?.rejectedPredictionTokens ?? null,
      tokensAcceptedPrediction: usage?.acceptedPredictionTokens ?? null,
      tokensCachedPrompt: usage?.cachedPromptTokens ?? null,
      tokensCacheWritePrompt: usage?.cacheWritePromptTokens ?? null,
      durationMs,
      reasoningDurationMs,
      finishReason: finishReason ?? null,
      contextFit: lastContextFit ?? null,
      // A fresh reply clears the prior swipe's notice; a continuation keeps it with the retained text.
      ...(fallback ? { fallback } : {}),
    },
  };
  if (fullThinking) extraUpdate.thinking = fullThinking;
  else extraUpdate.thinking = null;
  // Store Gemini response parts (thought signatures + summaries) for multi-turn continuity
  if (geminiResponseParts) extraUpdate.geminiParts = geminiResponseParts;
  else extraUpdate.geminiParts = null;
  // Store Chat Completions reasoning fields for providers that require replay (DeepSeek/OpenRouter)
  if (chatCompletionsReasoning) extraUpdate.chatCompletionsReasoning = chatCompletionsReasoning;
  else extraUpdate.chatCompletionsReasoning = null;
  // Store OpenAI Responses API encrypted reasoning items for multi-turn continuity
  if (encryptedReasoningItems?.length) extraUpdate.encryptedReasoning = encryptedReasoningItems;
  else extraUpdate.encryptedReasoning = null;
  // Cache the exact prompt injections used for this swipe so future
  // regenerations and swipe switches replay the same guidance.
  extraUpdate.contextInjections = contextInjections.length > 0 ? contextInjections : null;
  return extraUpdate;
}
