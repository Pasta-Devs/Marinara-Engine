// ──────────────────────────────────────────────
// Routes: Generation (SSE Streaming with Tool Use + Agent Pipeline)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  generateRequestSchema,
  BUILT_IN_AGENTS,
  DEFAULT_CHAT_SUMMARY_PROMPT,
  getDefaultBuiltInAgentSettings,
  resolveMacros,
  resolveDeferredCharacterMacros,
  hasDeferredCharacterMacros,
  LIMITS,
  coerceGameStateTextValue,
  appendChatSummaryEntryToMetadata,
  applyQuestUpdatesToPlayerStats,
  buildQuestJournalData,
  isClaudeAdaptiveOnlyNoSamplingModel,
  isAgentAvailableInChatMode,
  isAgentConfigDeleted,
  normalizeAgentPromptTemplateSelectionMap,
  normalizeThinkingTagPairs,
  applyTrackerFieldLocksToGameStatePatch,
  normalizeTrackerFieldLocksForState,
  trackerFieldLocksAreEmpty,
  customAgentHasCapability,
  supportsXhighReasoningEffort,
  DEFAULT_CONVERSATION_PROMPT,
  CONVERSATION_COMMAND_KEYS,
  unwrapConversationInstructions,
  wrapConversationInstructions,
  NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
  findKnownModel,
  normalizeTextForMatch,
  type APIProvider,
} from "@marinara-engine/shared";
import type {
  AgentContext,
  AgentCallDebugEvent,
  AgentResult,
  AgentPhase,
  CharacterStat,
  GameState,
  HapticDeviceCommand,
  PlayerStats,
  LorebookEntryTimingState,
  ChatSummaryEntry,
  ChatMode,
  ThinkingTagPair,
  ConversationCommandKey,
} from "@marinara-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createGameStateStorage } from "../services/storage/game-state.storage.js";
import { createCustomToolsStorage } from "../services/storage/custom-tools.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createRegexScriptsStorage } from "../services/storage/regex-scripts.storage.js";
import { createCustomEmojisStorage } from "../services/storage/custom-emojis.storage.js";
import { createCustomStickersStorage } from "../services/storage/custom-stickers.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../services/storage/persona-gallery.storage.js";
import { localEmbed, isLocalEmbedderAvailable } from "../services/local-embedder.js";
import { cosineSimilarity } from "../services/lorebook/embeddings.js";
import { applyRegexScriptsToPromptMessages } from "../services/regex/regex-application.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { resolveConversationSelfieSystemPrompt } from "../services/conversation/selfie-prompt.js";
import { filterRelevantLorebooks, processLorebooks, type LorebookScanResult } from "../services/lorebook/index.js";
import {
  filterGameInternalAgentIds,
  resolveLorebookScopeExclusions,
} from "../services/lorebook/game-lorebook-scope.js";
import { lorebookEntryPassesContextFilters, type GameStateForScanning } from "../services/lorebook/keyword-scanner.js";
import { injectAtDepth } from "../services/lorebook/prompt-injector.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { resolveChatSummaryConnection } from "../services/chat-summary/connection-resolution.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { textRewriteDropsProtectedMarkup } from "../services/generation/text-rewrite-safety.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { extractLeadingThinkingBlocks } from "../services/llm/inline-thinking.js";
import { resolveSpotifyCredentials, spotifyHasScope } from "../services/spotify/spotify.service.js";
import { buildSpotifyDjConstraints } from "../services/spotify/spotify-dj-constraints.js";
import {
  assemblePrompt,
  buildPromptMacroContext,
  collectCharacterDepthPromptEntries,
  resolveCharacterMacroData,
  resolveMacrosWithVariableSnapshot,
  resolvePromptIdleDuration,
  resolvePromptLastGenerationType,
  resolvePromptMessageMacros,
  type AssemblerInput,
} from "../services/prompt/index.js";
import { wrapContent } from "../services/prompt/format-engine.js";
import { yieldToEventLoop, type ChatMessage, type LLMUsage } from "../services/llm/base-provider.js";
import { executeToolCalls } from "../services/tools/tool-executor.js";
import { createAgentPipeline, type ResolvedAgent, type AgentInjection } from "../services/agents/agent-pipeline.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { executeAgent, normalizeAgentContextSize, resolveAgentResultType } from "../services/agents/agent-executor.js";
import { matchCustomAgentActivation } from "./generate/agent-activation.js";
import { listCharacterSprites } from "../services/game/sprite.service.js";
import { generateChatBackground } from "../services/game/game-asset-generation.js";
import { sanitizeGameNpcAvatarUrls } from "../services/game/npc-avatar-utils.js";
import {
  parseCharacterCommands,
  parseDirectMessageCommands,
  parseDuration,
  type CharacterCommand,
  type ScheduleUpdateCommand,
  type CrossPostCommand,
  type SelfieCommand,
  type MemoryCommand,
  type InfluenceCommand,
  type NoteCommand,
  type DirectMessageCommand,
  type SceneCommand,
  type HapticCommand,
  type SpotifyCommand,
  type YouTubeCommand,
  type ReactCommand,
  type CreatePersonaCommand,
  type CreateCharacterCommand,
  type UpdateCharacterCommand,
  type UpdatePersonaCommand,
  type CreateLorebookCommand,
  type UpdateLorebookCommand,
  type CreatePresetCommand,
  type CreateChatCommand,
  type NavigateCommand,
  type FetchCommand,
} from "../services/conversation/character-commands.js";
import {
  ILLUSTRATOR_TEXT_NEGATIVE_PROMPT,
  resolveIllustratorCharacterReferences,
} from "./generate/illustrator-references.js";
import {
  ConversationSpotifyCommandError,
  isSilentConversationSpotifyCommandError,
  playConversationSpotifyCommand,
} from "../services/spotify/conversation-spotify-command.service.js";
import {
  buildAutonomousDailyBudgetPatch,
  clearGenerationInProgress,
  dailyCapForCharacter,
  getAutonomousDailyBudget,
  markGenerationInProgress,
  recordAssistantActivity,
  recordUserActivity,
} from "../services/conversation/autonomous.service.js";
import { buildIntentCooldownPatch, getIntentHint, isMessageIntent } from "../services/conversation/intent.service.js";
import { buildImpersonateInstruction } from "../services/conversation/impersonate-prompt.js";
import { stripConversationPromptTimestamps } from "../services/conversation/transcript-sanitize.js";
import {
  formatZonedConversationDate,
  formatZonedConversationTime,
  getZonedWeekdayName,
  isSameZonedLogicalDay,
  normalizePromptTimeZone,
  toZonedWallClockDate,
} from "../services/conversation/timezone.js";
import {
  formatConversationDateKey,
  generateMissingConversationSummaries,
  parseConversationDateKey,
} from "../services/conversation/auto-summary.service.js";
import { MARI_ASSISTANT_PROMPT } from "../db/seed-mari.js";
import { executeKnowledgeRetrieval } from "../services/agents/knowledge-retrieval.js";
import { executeKnowledgeRouter } from "../services/agents/knowledge-router.js";
import { extractFileText, getSourceFilePath } from "./knowledge-sources.routes.js";
import { gameStateSnapshots as gameStateSnapshotsTable } from "../db/schema/index.js";
import { chats as chatsTable } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import {
  PROFESSOR_MARI_ID,
  normalizeCustomEmojiSelection,
  type CustomEmojiSelectionPrefs,
  type GenerationParameterSendMap,
  type MessageReaction,
} from "@marinara-engine/shared";
import { chunkAndEmbedMessages, embedMemoryRecallTexts } from "../services/memory-recall.js";
import {
  isMemoryRecallVectorizerAvailable,
  resolveMemoryRecallEmbeddingSource,
} from "../services/memory-recall-embedding.js";
import { postToDiscordWebhook } from "../services/discord-webhook.js";
import { newId } from "../utils/id-generator.js";
import {
  appendGenerationTailMessages,
  canUseMessageForUserRegeneration,
  dedupeLastMessageWrappers,
  findLastIndex,
  findTrackerContextInsertIndex,
  appendReadableAttachmentsToContent,
  extractFileAttachmentInputs,
  buildUserMessageRegenerationPromptFromSource,
  buildUserMessageRegenerationSourceMessage,
  buildLockedPlayerStatsArrayPatch,
  buildLockedPersonaTrackerPatch,
  extractImageAttachmentDataUrls,
  appendNonLeadingSystemMessagesToLastUser,
  computeSummaryHideIds,
  injectIntoOutputFormatOrLastUser,
  isManualTrackerCharacterId,
  isMessageHiddenFromAI,
  mergeCustomParameters,
  parseExtra,
  parseJsonField,
  parseStoredGenerationParameters,
  parseGameStateRow,
  parseSnapshotPlayerStats,
  isRoleplaySummaryMode,
  preserveTrackerCharacterUiFields,
  prefixGroupIndividualHistorySpeakers,
  resolveActiveCharacterIds,
  resolveBaseUrl,
  resolveRoleplaySummaryTail,
  resolveCharacterNameMap,
  resolvePromptCharacterIdsForTarget,
  resolveRegenerationGameStateFallbackMessageIds,
  resolveRegenerationGameStateAnchor,
  resolveRoleplayChatSummary,
  resolveUserRegenerationPersistentAttachments,
  resolveVisibleGameStateAnchor,
  resolveProviderTopK,
  normalizeServiceTier,
  resolveKnowledgeSourceLorebookIds,
  shouldPreferLatestVisibleGameState,
  shouldAbortOnPassiveGenerationDisconnect,
  shouldEnableAgentsForGeneration,
  shouldInjectIdentityFallback,
  type PromptAttachment,
  type SimpleMessage,
} from "./generate/generate-route-utils.js";
import {
  buildAvailableSpriteCharacter,
  completeRequiredSpriteExpressionEntries,
  normalizeRequiredSpriteExpressionIds,
  normalizeSpriteDisplayModes,
  validateSpriteExpressionEntries,
} from "./generate/expression-agent-utils.js";
import { logger, logDebugOverride } from "../lib/logger.js";
import {
  buildHistoricalLorebookKeeperContext,
  getLorebookKeeperAutomaticPendingCount,
  getLorebookKeeperAutomaticTarget,
  getLorebookKeeperSettings,
  loadLorebookKeeperExistingEntries,
  persistLorebookKeeperUpdates,
  resolveLorebookKeeperTarget,
} from "./generate/lorebook-keeper-utils.js";
import { registerDryRunRoute } from "./generate/dry-run-route.js";
import { registerRetryAgentsRoute } from "./generate/retry-agents-route.js";
import { fingerprintChatSummary } from "../services/prompt/chat-summary-fingerprint.js";
import { sendSseEvent, startSseKeepalive, startSseReply, trySendSseEvent } from "./generate/sse.js";
import { runTurnGameBotTurns } from "../services/turn-games/turn-game-bot-runner.service.js";
import {
  getActiveTurnGame,
  getTurnGameContextText,
  startTurnGame,
} from "../services/turn-games/turn-game-runner.service.js";
import { normalizeContextInjections } from "./generate/agent-normalizers.js";
import {
  buildGenerationPromptPresetCandidates,
  type PromptPresetCandidateSource,
} from "./generate/prompt-preset-selection.js";
import {
  applyGenerationReplayToRegenerateInput,
  buildGenerationReplay,
  normalizeGenerationReplay,
} from "./generate/generation-replay.js";
import {
  MAX_AGENT_HAPTIC_COMMANDS,
  formatHapticSettingsForPrompt,
  getChatHapticIntifaceUrl,
  getChatHapticSettings,
  normalizeHapticAgentCommand,
  normalizeHapticAgentCommands,
} from "../services/generation/haptic-runtime.js";
import { getMaxToolRounds } from "../config/runtime-config.js";
import {
  REVIEWABLE_WRITER_AGENT_TYPES,
  buildRuntimeAgentSectionEligibleTypes,
  clearUnusedRuntimeAgentSections,
  formatAgentInjections,
  makeRuntimeAgentSectionTokens,
  pruneEmptyPromptWrappers,
  replaceRuntimeAgentSection,
  splitRuntimeHandledAgentInjections,
  toRuntimeAgentSectionType,
  type RuntimeAgentSectionTokens,
  type RuntimeAgentSectionType,
} from "../services/generation/runtime-agent-sections.js";
import { applySpotifyAgentPlaybackFallbacks } from "../services/generation/spotify-agent-runtime.js";
import {
  MAX_MARI_FETCHED_PRESET_CONTEXT_CHARS,
  normalizeAssistantPresetIdentifier,
  normalizeAssistantPresetOptionId,
  normalizeAssistantPresetVariableName,
  parseMariJsonArray,
  parseMariJsonRecord,
  resolveAssistantPresetInjectionPosition,
  resolveAssistantPresetRole,
  resolveAssistantPresetWrapFormat,
  truncateMariFetchedText,
} from "../services/generation/assistant-preset-utils.js";
import {
  formatUnresolvedRoleplayDmFallback,
  parseChatCharacterIdsForDm,
  replaceRoleplayDmCommandText,
  resolveRoleplayDmTarget,
} from "../services/generation/roleplay-dm-utils.js";
import {
  bumpCharacterVersion,
  cardPromptText,
  formatConversationPromptTurn,
  getHiddenCompletionTokens,
  getVisibleCompletionTokens,
  sanitizeConnectedGameTranscript,
  stripSpacesBeforeLineBreaks,
  trimIncompleteModelEnding,
} from "../services/generation/generation-text-utils.js";
import {
  areConversationSchedulesEnabled,
  getEnabledConversationSchedules,
  parseConversationStatusOverrides,
  parsePromptPresetChoices,
} from "../services/generation/conversation-context-utils.js";
import { recoverImplicitSelfieCommand } from "../services/generation/selfie-command-recovery.js";
import {
  buildLorebookScanMessagesWithGenerationGuide,
  persistLorebookRuntimeState,
  rememberKnowledgeRouterActivatedLorebookIds,
  resolveLorebookGenerationTriggers,
  resolveLorebookTokenBudget,
} from "../services/generation/lorebook-generation-runtime.js";
import {
  addLocationEntry,
  addEventEntry,
  addInventoryEntry,
  upsertQuest,
  addNpcEntry,
} from "../services/game/journal.service.js";
import { updateJournal } from "../services/generation/game-journal-runtime.js";
import { buildGmFormatReminder } from "../services/game/gm-prompts.js";
import {
  applyMapUpdateCommand,
  getGameMapsFromMeta,
  parseMapUpdateCommands,
  syncGameMapMetaPartyPosition,
  withActiveGameMapMeta,
} from "../services/game/map-position.service.js";
import { applyAllSegmentEdits } from "../services/game/segment-edits.js";
import type { GameMap, GameNpc, Lorebook, LorebookEntry } from "@marinara-engine/shared";
import {
  isStandaloneCharacterProfileBlock,
  scopeIndividualGroupMessagesForTarget,
  type GenerationPromptMessage,
} from "../services/generation/prompt-message-scope.js";
import {
  applyProviderMaxTokensOverride,
  normalizeAgentMaxTokens,
  normalizeChatTopP,
  readChatCompletionsReasoningMetadata,
  shouldReplayStoredChatCompletionsReasoning,
} from "../services/generation/generation-parameters.js";
import {
  fitMessagesForModelAccess,
  mergeModelContextLimit,
  resolveModelAccessPolicy,
  resolveStoredModelContextLimit,
} from "../services/generation/model-access-policy.js";
import { resolveAgentPipelineAgents } from "../services/generation/agent-resolution.js";
import { applyImmersiveHtmlPromptInjection } from "../services/generation/immersive-html-injection.js";
import { resolveGenerationTools } from "../services/generation/tool-resolution-runtime.js";
import {
  buildCharacterMacroProfilesById,
  injectIdentityFallbackMessages,
  loadCharacterPromptInfo,
} from "../services/generation/character-prompt-context.js";
import { injectSceneContextMessages } from "../services/generation/scene-context-runtime.js";
import { injectCommittedTrackerContext } from "../services/generation/committed-tracker-context.js";
import { injectGameGmPromptRuntime } from "../services/generation/game-gm-prompt-runtime.js";
import { mergeConversationCharacterMemories } from "../services/generation/conversation-memory-context.js";
import { injectMemoryRecallContext } from "../services/generation/memory-recall-context.js";
import { resolveAgentRunInterval, shouldSkipAgentByAssistantInterval } from "../services/generation/agent-cadence.js";
import {
  createAgentEventDispatcher,
  shouldDeferExpressionAgentEvent,
} from "../services/generation/agent-event-dispatcher.js";
import { findLastUserMessageIdBefore } from "../services/generation/message-history.js";
import {
  getTextRewritePendingState,
  mergePairedBuiltInRewriteAgents,
  PROSE_GUARDIAN_PENDING_MESSAGE,
  shouldHoldForProseGuardianRewrite,
} from "../services/generation/prose-guardian-settings.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
  buildSummaryWriteApprovalProposal,
  isAgentWriteApprovalEnvelope,
} from "./generate/agent-write-approval.js";

const PROFESSOR_MARI_INTERNAL_CHAT_MARKER = "professor-mari";

type LorebookScanSnapshot = {
  activatedEntries: LorebookScanResult["activatedEntries"];
  budgetSkippedEntries: LorebookScanResult["budgetSkippedEntries"];
  totalTokensEstimate: number;
  totalEntries: number;
};

function emptyLorebookScanSnapshot(): LorebookScanSnapshot {
  return {
    activatedEntries: [],
    budgetSkippedEntries: [],
    totalTokensEstimate: 0,
    totalEntries: 0,
  };
}

function toLorebookScanSnapshot(result: LorebookScanResult | null | undefined): LorebookScanSnapshot {
  if (!result) return emptyLorebookScanSnapshot();
  return {
    activatedEntries: result.activatedEntries,
    budgetSkippedEntries: result.budgetSkippedEntries,
    totalTokensEstimate: result.totalTokensEstimate,
    totalEntries: result.totalEntries,
  };
}

function findResultAgent(result: AgentResult, agents: ResolvedAgent[]): ResolvedAgent | null {
  return agents.find((agent) => agent.id === result.agentId || agent.type === result.agentType) ?? null;
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function customAgentCanApplyResult(
  result: AgentResult,
  agents: ResolvedAgent[],
  builtInAgentTypes: Set<string>,
  capability: Parameters<typeof customAgentHasCapability>[1],
): boolean {
  if (builtInAgentTypes.has(result.agentType)) return true;
  const agent = findResultAgent(result, agents);
  return agent ? customAgentHasCapability(agent.settings, capability) : false;
}

function customAgentCanEmitResult(
  result: AgentResult,
  agents: ResolvedAgent[],
  builtInAgentTypes: Set<string>,
): boolean {
  if (builtInAgentTypes.has(result.agentType)) return true;
  switch (result.type) {
    case "text_rewrite":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_messages");
    case "lorebook_update":
      return (
        customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_lorebooks") ||
        customAgentCanApplyResult(result, agents, builtInAgentTypes, "create_lorebooks")
      );
    case "game_state_update":
    case "character_tracker_update":
    case "persona_stats_update":
    case "custom_tracker_update":
    case "quest_update":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_trackers");
    case "image_prompt":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "trigger_image_generation");
    case "prompt_patch":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "edit_main_prompt");
    case "frontend_theme_update":
      return customAgentCanApplyResult(result, agents, builtInAgentTypes, "change_frontend_styling");
    default:
      return true;
  }
}

function presetStringField(preset: Record<string, unknown> | null | undefined, field: string): string {
  const value = preset?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function resolvePresetModePrompt(
  preset: Record<string, unknown> | null | undefined,
  mode: "conversation" | "game",
): string {
  return mode === "conversation"
    ? presetStringField(preset, "conversationPrompt")
    : presetStringField(preset, "gamePrompt");
}

type PromptChoiceBlockRow = {
  variableName: string;
  options: unknown;
  multiSelect?: unknown;
  randomPick?: unknown;
  separator?: unknown;
};

function parseModePromptChoiceOptions(value: unknown): Array<{ value: string }> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) return [];
      const rawValue = (option as Record<string, unknown>).value;
      return typeof rawValue === "string" ? [{ value: rawValue }] : [];
    });
  } catch {
    return [];
  }
}

function resolveModePromptChoiceVariables(
  choiceBlocks: PromptChoiceBlockRow[],
  chatChoices: Record<string, string | string[]>,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const block of choiceBlocks) {
    const options = parseModePromptChoiceOptions(block.options);
    const optionValues = new Set(options.map((option) => option.value));
    const fallback = options[0]?.value ?? "";
    const selected = chatChoices[block.variableName];
    const isMulti = block.multiSelect === true || block.multiSelect === "true";
    const isRandom = block.randomPick === true || block.randomPick === "true";
    const separator = typeof block.separator === "string" ? block.separator : ", ";

    if (isMulti) {
      const selectedValues = Array.isArray(selected)
        ? selected.filter((value) => optionValues.has(value))
        : typeof selected === "string" && optionValues.has(selected)
          ? [selected]
          : [];
      if (selectedValues.length === 0) {
        variables[block.variableName] = fallback;
      } else if (isRandom) {
        variables[block.variableName] = selectedValues[Math.floor(Math.random() * selectedValues.length)] ?? "";
      } else {
        variables[block.variableName] = selectedValues.join(separator);
      }
      continue;
    }

    variables[block.variableName] = typeof selected === "string" && optionValues.has(selected) ? selected : fallback;
  }
  return variables;
}

const DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL = 8;
const DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY = "secretPlotLastAssistantMessageId";

function normalizeDirectorSecretPlotRunInterval(value: unknown): number {
  return resolveAgentRunInterval({ runInterval: value }, DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL);
}

function resolveDirectorSecretPlotEnabled(
  settings: Record<string, unknown>,
  chatMeta: Record<string, unknown>,
  chatMode: ChatMode,
): boolean {
  if (chatMode !== "roleplay") return false;
  if (typeof chatMeta.narrativeDirectorSecretPlotEnabled === "boolean") {
    return chatMeta.narrativeDirectorSecretPlotEnabled;
  }
  return settings.secretPlotEnabled === true;
}

function resolveDirectorSecretPlotRunInterval(
  settings: Record<string, unknown>,
  chatMeta: Record<string, unknown>,
): number {
  return normalizeDirectorSecretPlotRunInterval(
    chatMeta.narrativeDirectorSecretPlotRunInterval ?? settings.secretPlotRunInterval,
  );
}

function normalizeSecretPlotArc(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const description = raw.trim();
    return description ? { description, completed: false } : null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const arc = raw as Record<string, unknown>;
  const description = typeof arc.description === "string" ? arc.description.trim() : "";
  const protagonistArc = typeof arc.protagonistArc === "string" ? arc.protagonistArc.trim() : "";
  const characterArc = typeof arc.characterArc === "string" ? arc.characterArc.trim() : "";
  const normalized: Record<string, unknown> = {
    ...(description ? { description } : {}),
    ...(protagonistArc ? { protagonistArc } : {}),
    ...(characterArc ? { characterArc } : {}),
    completed: arc.completed === true,
  };
  return Object.keys(normalized).length > 1 || normalized.completed === true ? normalized : null;
}

function buildSecretPlotStateFromMemory(memory: Record<string, unknown>): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  const arc = normalizeSecretPlotArc(memory.overarchingArc);
  if (arc) state.overarchingArc = arc;
  return state;
}

function secretPlotArcIsCompleted(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const arc = normalizeSecretPlotArc((data as Record<string, unknown>).overarchingArc);
  return arc?.completed === true;
}

function shouldRunDirectorSecretPlotMaintenance(args: {
  memory: Record<string, unknown>;
  runInterval: number;
  messages: Array<{ id?: string | null; role?: string | null }>;
}): boolean {
  const state = buildSecretPlotStateFromMemory(args.memory);
  const arc = normalizeSecretPlotArc(state.overarchingArc);
  if (!arc) return true;
  if (arc.completed === true) return true;
  if (args.runInterval <= 1) return true;

  const lastMessageId = args.memory[DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY];
  if (typeof lastMessageId !== "string" || !lastMessageId) return true;
  const lastIndex = args.messages.findIndex((message) => message.id === lastMessageId);
  if (lastIndex < 0) return true;
  const assistantMessagesSince = args.messages
    .slice(lastIndex + 1)
    .filter((message) => message.role === "assistant").length;
  return assistantMessagesSince + 1 >= args.runInterval;
}

function formatSecretPlotSystemBlock(arcRaw: unknown, wrapFormat: "xml" | "markdown" | "none"): string {
  const arc = normalizeSecretPlotArc(arcRaw);
  if (!arc) return "";
  const payload = JSON.stringify({ overarchingArc: arc }, null, 2);
  if (wrapFormat === "none") return `Secret plot\n${payload}`;
  return wrapContent(payload, "Secret plot", wrapFormat);
}

function appendSecretPlotSystemMessage(
  messages: Array<{ role: string; content: string; [key: string]: unknown }>,
  content: string,
): void {
  if (!content.trim()) return;
  const firstChatIndex = messages.findIndex((message) => message.role === "user" || message.role === "assistant");
  const insertAt = firstChatIndex >= 0 ? firstChatIndex : messages.length;
  messages.splice(insertAt, 0, { role: "system", content });
}

function buildDirectorSecretPlotAgent(agent: ResolvedAgent): ResolvedAgent {
  return {
    ...agent,
    promptTemplate: NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
    settings: {
      ...agent.settings,
      resultType: "secret_plot",
    },
  };
}

function resolveCustomWritableLorebookIds(settings: Record<string, unknown>): string[] | null {
  const ids: string[] = [];
  for (const key of ["writableLorebookId", "targetLorebookId"]) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) ids.push(value.trim());
  }
  const arrayValue = settings.writableLorebookIds;
  if (Array.isArray(arrayValue)) {
    for (const value of arrayValue) {
      if (typeof value === "string" && value.trim()) ids.push(value.trim());
    }
  }
  return ids.length > 0 ? Array.from(new Set(ids)) : null;
}

function promptPreviewForAgents(messages: ChatMessage[]): string {
  const preview = messages
    .map((message, index) => {
      const content = String(message.content ?? "").slice(0, 3000);
      return `<message index="${index}" role="${message.role}">\n${content}\n</message>`;
    })
    .join("\n\n");
  return preview.slice(0, 24_000);
}

const RETIRED_CHAT_SUMMARY_AGENT_ID = "chat-summary";
const DEFAULT_AUTOMATIC_SUMMARY_INTERVAL = 5;
const MIN_AUTOMATIC_SUMMARY_INTERVAL = 1;
const MAX_AUTOMATIC_SUMMARY_INTERVAL = 200;
const MIN_SUMMARY_CONTEXT_SIZE = 5;
const MAX_SUMMARY_CONTEXT_SIZE = 500;

function clampRoleplaySummaryInterval(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUTOMATIC_SUMMARY_INTERVAL;
  return Math.max(MIN_AUTOMATIC_SUMMARY_INTERVAL, Math.min(MAX_AUTOMATIC_SUMMARY_INTERVAL, Math.trunc(parsed)));
}

function clampRoleplaySummaryContextSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.max(MIN_SUMMARY_CONTEXT_SIZE, Math.min(MAX_SUMMARY_CONTEXT_SIZE, Math.trunc(parsed)));
}

function appendContinuationMessageContent(existingContent: unknown, continuation: string): string {
  const existing = typeof existingContent === "string" ? existingContent : "";
  if (!existing) return continuation;
  if (!continuation) return existing;
  return `${existing}${continuation}`;
}

const CONTINUE_ASSISTANT_MESSAGE_PROMPT = "Your last message got cut off! Please, continue!";

function isAutomaticRoleplaySummaryEnabled(chatMetadata: Record<string, unknown>): boolean {
  if (chatMetadata.automaticSummaryEnabled === false) return false;
  if (chatMetadata.automaticSummaryEnabled === true) return true;
  const activeAgentIds = Array.isArray(chatMetadata.activeAgentIds) ? chatMetadata.activeAgentIds : [];
  return chatMetadata.enableAgents === true && activeAgentIds.includes(RETIRED_CHAT_SUMMARY_AGENT_ID);
}

function withoutRetiredChatSummaryAgentIds(chatMetadata: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(chatMetadata.activeAgentIds)) return undefined;
  return chatMetadata.activeAgentIds.filter((agentId): agentId is string => {
    return typeof agentId === "string" && agentId !== RETIRED_CHAT_SUMMARY_AGENT_ID;
  });
}

function countUserMessagesAfterAnchor(messages: Array<{ id: string; role: string }>, anchorMessageId: string | null) {
  if (!anchorMessageId) return Number.POSITIVE_INFINITY;
  const anchorIndex = messages.findIndex((message) => message.id === anchorMessageId);
  if (anchorIndex < 0) return Number.POSITIVE_INFINITY;
  return messages.slice(anchorIndex + 1).filter((message) => message.role === "user").length;
}

function resolveChatSummaryPromptFromMetadata(chatMetadata: Record<string, unknown>): string {
  const selectedId =
    typeof chatMetadata.activeSummaryPromptTemplateId === "string"
      ? chatMetadata.activeSummaryPromptTemplateId.trim()
      : "";
  const templates = Array.isArray(chatMetadata.summaryPromptTemplates) ? chatMetadata.summaryPromptTemplates : [];
  const selected = selectedId
    ? templates.find((template) => {
        if (!template || typeof template !== "object" || Array.isArray(template)) return false;
        const record = template as Record<string, unknown>;
        return record.id === selectedId && typeof record.prompt === "string" && record.prompt.trim().length > 0;
      })
    : null;
  if (selected && typeof (selected as Record<string, unknown>).prompt === "string") {
    return ((selected as Record<string, unknown>).prompt as string).trim();
  }
  return DEFAULT_CHAT_SUMMARY_PROMPT;
}

function parseChatSummaryText(rawContent: string): string {
  const cleaned = rawContent
    .trim()
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "");
  try {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(cleaned.slice(first, last + 1)) as { summary?: unknown };
      return typeof parsed.summary === "string" ? parsed.summary.trim() : cleaned.trim();
    }
  } catch {
    // Fall through to raw text.
  }
  return cleaned.trim();
}

function findLastPromptMessageIndex(messages: ChatMessage[], role: ChatMessage["role"]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}

function applyPromptPatchOperations(messages: ChatMessage[], data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const rawOperations = Array.isArray((data as Record<string, unknown>).operations)
    ? ((data as Record<string, unknown>).operations as unknown[])
    : [data];
  let applied = 0;

  for (const rawOperation of rawOperations.slice(0, 12)) {
    if (!rawOperation || typeof rawOperation !== "object") continue;
    const operation = rawOperation as Record<string, unknown>;
    const content = typeof operation.content === "string" ? operation.content.slice(0, 12_000) : "";
    if (!content.trim()) continue;
    const target = typeof operation.target === "string" ? operation.target : "last_user";
    const mode =
      operation.mode === "replace" || operation.mode === "prepend" || operation.mode === "append"
        ? operation.mode
        : "append";

    if (target === "append_system" || target === "prepend_system") {
      const message = { role: "system" as const, content };
      if (target === "prepend_system") messages.unshift(message);
      else messages.push(message);
      applied++;
      continue;
    }

    const index =
      target === "first_system"
        ? messages.findIndex((message) => message.role === "system")
        : target === "last_message"
          ? messages.length - 1
          : findLastPromptMessageIndex(messages, "user");
    if (index < 0 || !messages[index]) continue;

    const current = messages[index]!;
    const nextContent =
      mode === "replace"
        ? content
        : mode === "prepend"
          ? `${content}\n\n${current.content}`
          : `${current.content}\n\n${content}`;
    messages[index] = { ...current, content: nextContent };
    applied++;
  }

  return applied;
}

function readConversationCommandToggles(
  metadata: Record<string, unknown>,
): Partial<Record<ConversationCommandKey, boolean>> {
  const raw = metadata.conversationCommandToggles;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const toggles: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    if (typeof source[key] === "boolean") toggles[key] = source[key] as boolean;
  }
  return toggles;
}

function isConversationCommandEnabled(metadata: Record<string, unknown>, key: ConversationCommandKey): boolean {
  return readConversationCommandToggles(metadata)[key] !== false;
}

function getConversationCommandKey(command: CharacterCommand): ConversationCommandKey | null {
  switch (command.type) {
    case "schedule_update":
      return "schedule_update";
    case "cross_post":
      return "cross_post";
    case "selfie":
      return "selfie";
    case "memory":
      return "memory";
    case "scene":
      return "scene";
    case "uno":
      return "uno";
    case "spotify":
    case "youtube":
      return "music";
    case "haptic":
      return "haptic";
    case "influence":
      return "influence";
    case "note":
      return "note";
    default:
      return null;
  }
}

function filterEnabledConversationCommands(
  commands: CharacterCommand[],
  metadata: Record<string, unknown>,
): CharacterCommand[] {
  return commands.filter((command) => {
    const key = getConversationCommandKey(command);
    return key === null || isConversationCommandEnabled(metadata, key);
  });
}

function parseStoredAgentSettingsValue(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function isConversationYoutubeCommandAvailable(storage: {
  getByType(type: string): Promise<{ settings?: unknown } | null>;
}): Promise<boolean> {
  const agent = (await storage.getByType("spotify")) ?? (await storage.getByType("youtube"));
  const settings = parseStoredAgentSettingsValue(agent?.settings);
  return typeof settings.youtubeApiKey === "string" && settings.youtubeApiKey.trim().length > 0;
}

function resolveKnownMaxOutputTokens(provider: APIProvider | string | null | undefined, model: string): number | null {
  const knownModel = provider ? findKnownModel(provider as APIProvider, model.trim()) : undefined;
  return knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null;
}

function clampGenerationMaxOutputTokens(args: {
  provider: APIProvider | string | null | undefined;
  model: string;
  maxTokens: number;
  maxTokensOverride?: number | null;
}): number {
  let capped = Math.max(1, Math.floor(args.maxTokens));
  const knownMaxOutput = resolveKnownMaxOutputTokens(args.provider, args.model);
  if (knownMaxOutput !== null) capped = Math.min(capped, knownMaxOutput);
  if (
    typeof args.maxTokensOverride === "number" &&
    Number.isFinite(args.maxTokensOverride) &&
    args.maxTokensOverride > 0
  ) {
    capped = Math.min(capped, Math.floor(args.maxTokensOverride));
  }
  return capped;
}

/** Fisher-Yates shuffle (in place); used for random emoji selection. */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Order emoji names by semantic relevance to `query` via the local embedder. Returns null when unavailable. */
async function rankEmojiNamesBySemantic(names: string[], query: string): Promise<string[] | null> {
  if (names.length <= 1 || !query.trim() || !isLocalEmbedderAvailable()) return null;
  try {
    const vectors = await localEmbed([query, ...names.map((name) => name.replace(/_/g, " "))]);
    if (!vectors || vectors.length !== names.length + 1) return null;
    const queryVector = vectors[0]!;
    return names
      .map((name, index) => ({ name, score: cosineSimilarity(queryVector, vectors[index + 1]!) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.name);
  } catch (err) {
    logger.debug(err, "[custom-emoji] semantic ranking failed; falling back to random");
    return null;
  }
}

/** Order a pool of emoji names per the selection mode (does NOT cap — the formatter slices to maxCount). */
async function orderEmojiNames(names: string[], prefs: CustomEmojiSelectionPrefs, query: string): Promise<string[]> {
  if (names.length <= 1) return names;
  // Reached for random/semantic, and as the tool-call fallback path — rank semantically when possible.
  if (prefs.mode === "semantic" || prefs.mode === "tool-call") {
    const ranked = await rankEmojiNamesBySemantic(names, query);
    if (ranked) return ranked;
  }
  return shuffleInPlace([...names]);
}

/**
 * Tool-call selection: one short auxiliary completion (on the chosen connection)
 * picks which candidate asset names fit the latest message. Returns the validated
 * picks (≤ maxCount), or null on any failure so the caller can fall back to
 * semantic/random. Never throws — generation must not depend on it.
 */
async function selectCustomAssetNamesByToolCall(
  assetLabel: string,
  tokenExample: string,
  candidates: string[],
  query: string,
  connectionId: string,
  connections: ReturnType<typeof createConnectionsStorage>,
  maxCount: number,
): Promise<string[] | null> {
  if (candidates.length === 0 || !query.trim()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("custom-emoji tool-call timeout")), 5000);
  try {
    const conn = await connections.getWithKey(connectionId);
    if (!conn?.model) return null;
    const provider = createLLMProvider(
      conn.provider,
      resolveBaseUrl(conn),
      conn.apiKey,
      conn.maxContext,
      conn.openrouterProvider,
      conn.maxTokensOverride,
    );
    const result = await provider.chatComplete(
      [
        {
          role: "system",
          content:
            `You select which custom ${assetLabel}s fit the current moment in a chat. You receive a list of available ${assetLabel} names and the latest message. ` +
            `Reply with ONLY a comma-separated list of at most ${maxCount} names taken verbatim from the list (most fitting first), or "none". No other text. Do not include ${tokenExample} syntax.`,
        },
        {
          role: "user",
          content: `Available custom ${assetLabel}s: ${candidates.join(", ")}\n\nLatest message: "${query}"\n\nFitting ${assetLabel} names:`,
        },
      ],
      { model: conn.model, temperature: 0.3, maxTokens: 200, signal: controller.signal },
    );
    const text = (result.content ?? "").toLowerCase().trim();
    if (text.replace(/[^a-z0-9_]/g, "") === "none") return [];
    const candidateSet = new Set(candidates);
    const picked: string[] = [];
    for (const token of text.split(/[\s,]+/)) {
      const name = token.replace(/[^a-z0-9_]/g, "");
      if (name && candidateSet.has(name) && !picked.includes(name)) {
        picked.push(name);
        if (picked.length >= maxCount) break;
      }
    }
    return picked.length > 0 ? picked : null;
  } catch (err) {
    logger.debug(err, "[custom-%s] tool-call selection failed; falling back to semantic/random", assetLabel);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueEmojiNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

function appendToFirstSystemMessage(messages: GenerationPromptMessage[], content: string): void {
  const systemMessage = messages.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = systemMessage.content ? `${systemMessage.content}\n\n${content}` : content;
    return;
  }
  messages.unshift({ role: "system", content });
}

function latestHistoryUserContent(messages: GenerationPromptMessage[]): string {
  const historyTurn = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.contextKind === "history");
  if (historyTurn) return historyTurn.content;
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function conversationPromptHistoryContent(
  message: { role?: unknown; content?: unknown; extra?: unknown },
  chatMode: string,
): string {
  if (chatMode === "conversation" && message.role === "assistant") {
    const commandContent = parseExtra(message.extra).conversationCommandContent;
    if (typeof commandContent === "string" && commandContent.trim()) {
      return commandContent;
    }
  }
  return typeof message.content === "string" ? message.content : "";
}

/**
 * Build the Conversation-mode system-prompt block that tells the responding
 * character(s) which custom emojis they may use (`:name:`). A character gets its
 * own gallery emojis first (weighted above global), then the global pool, capped
 * at maxCount; the name pools arrive already ordered by the active selection mode.
 * Returns null when there are no custom emojis to advertise.
 */
function buildCustomEmojiAdvertisement(
  responders: { charId: string; name: string }[],
  orderedGlobal: string[],
  orderedOwnByChar: Map<string, string[]>,
  maxCount: number,
): string | null {
  const toTokens = (names: string[]) => names.map((name) => `:${name}:`).join(" ");
  const lead =
    "You can use custom emojis in your reply by writing their name between colons, e.g. :name: — they render as small inline images. Use them only where they fit naturally; do not overuse them.";

  // Single responder (1:1 chats and individual-turn group mode): own first, then global, capped to maxCount total.
  if (responders.length === 1) {
    const merged = [...(orderedOwnByChar.get(responders[0]!.charId) ?? [])];
    for (const name of orderedGlobal) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(name)) merged.push(name);
    }
    const capped = merged.slice(0, maxCount);
    if (capped.length === 0) return null;
    return `${lead}\nBeyond the full standard emoji set, you may use these custom emojis: ${toTokens(capped)}`;
  }

  // Multiple responders (merged group mode): shared global pool + each character's own, each capped to maxCount.
  const lines: string[] = [];
  const global = orderedGlobal.slice(0, maxCount);
  if (global.length > 0) lines.push(`Available to everyone: ${toTokens(global)}`);
  for (const responder of responders) {
    const own = (orderedOwnByChar.get(responder.charId) ?? []).slice(0, maxCount);
    if (own.length > 0) lines.push(`${responder.name} also has: ${toTokens(own)}`);
  }
  if (lines.length === 0) return null;
  return `${lead}\nBeyond the full standard emoji set, these custom emojis are available (use by typing :name:):\n${lines.join("\n")}`;
}

/**
 * Build the Conversation-mode system-prompt block telling the responding
 * character(s) which custom stickers they may send (`sticker:name:`, a block
 * image). Mirrors the emoji advertisement: own gallery stickers first, then the
 * global pool, capped at maxCount; pools arrive pre-ordered by the selection mode.
 * Returns null when there are no stickers to advertise.
 */
function buildCustomStickerAdvertisement(
  responders: { charId: string; name: string }[],
  orderedGlobal: string[],
  orderedOwnByChar: Map<string, string[]>,
  maxCount: number,
): string | null {
  const toTokens = (names: string[]) => names.map((name) => `sticker:${name}:`).join(" ");
  const lead =
    "You can send a sticker by writing its name as sticker:name: — it posts as a large block image on its own line. Send one only when it genuinely fits the moment, not in every message.";

  if (responders.length === 1) {
    const merged = [...(orderedOwnByChar.get(responders[0]!.charId) ?? [])];
    for (const name of orderedGlobal) {
      if (merged.length >= maxCount) break;
      if (!merged.includes(name)) merged.push(name);
    }
    const capped = merged.slice(0, maxCount);
    if (capped.length === 0) return null;
    return `${lead}\nAvailable stickers: ${toTokens(capped)}`;
  }

  const lines: string[] = [];
  const global = orderedGlobal.slice(0, maxCount);
  if (global.length > 0) lines.push(`Available to everyone: ${toTokens(global)}`);
  for (const responder of responders) {
    const own = (orderedOwnByChar.get(responder.charId) ?? []).slice(0, maxCount);
    if (own.length > 0) lines.push(`${responder.name} also has: ${toTokens(own)}`);
  }
  if (lines.length === 0) return null;
  return `${lead}\nAvailable stickers (send by writing sticker:name:):\n${lines.join("\n")}`;
}

/**
 * Build a compact reaction note for a message's prompt content so the responding
 * character perceives who reacted to it and with what. Reactions live on
 * `message.extra.reactions` (one `{ emoji, by[] }` entry per emoji); `emoji` is a
 * unicode emoji or a custom-emoji token (`:name:`, already advertised separately).
 * The note is appended to the message content (like the `[Sent a photo]` marker)
 * and is deliberately not timestamp-shaped, so the conversation timestamp stripper
 * leaves it intact. `resolveReactorName` maps a reactor id ("user" or a character
 * id) to a display name. Returns "" when there is nothing to annotate.
 */
function buildReactionAnnotation(reactions: unknown, resolveReactorName: (reactorId: string) => string): string {
  if (!Array.isArray(reactions) || reactions.length === 0) return "";
  const parts: string[] = [];
  for (const entry of reactions as Array<{ emoji?: unknown; by?: unknown }>) {
    const emoji = typeof entry.emoji === "string" ? entry.emoji : null;
    const reactors = Array.isArray(entry.by) ? entry.by.filter((id): id is string => typeof id === "string") : [];
    if (!emoji || reactors.length === 0) continue;
    const names = reactors.map(resolveReactorName);
    const who =
      names.length === 1
        ? names[0]!
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    parts.push(`${who} reacted with ${emoji}`);
  }
  return parts.length === 0 ? "" : `\n[${parts.join("; ")}]`;
}

/**
 * Add a reactor to a message's reactions (add-only, idempotent — a no-op if the
 * reactor already reacted with this emoji). Applies a character's `[react:]`
 * directive server-side. `imageUrl` is stored for a custom (`:name:`) reaction so
 * the chip renders without re-resolving the gallery. Pure — returns a new array.
 */
function addMessageReactor(
  reactions: unknown,
  emoji: string,
  reactor: string,
  imageUrl: string | null,
): MessageReaction[] {
  const current = Array.isArray(reactions) ? (reactions as MessageReaction[]) : [];
  const index = current.findIndex((r) => r.emoji === emoji);
  if (index === -1) {
    const entry: MessageReaction = { emoji, by: [reactor] };
    if (imageUrl) entry.imageUrl = imageUrl;
    return [...current, entry];
  }
  const entry = current[index]!;
  if (entry.by.includes(reactor)) return current;
  const next = [...current];
  next[index] = { ...entry, by: [...entry.by, reactor], ...(imageUrl && !entry.imageUrl ? { imageUrl } : {}) };
  return next;
}

function buildGlobalCustomEmojiUrl(filePath: string): string {
  return `/api/custom-emojis/file/${encodeURIComponent(filePath)}`;
}

function buildConversationCustomEmojiKey(
  scope: "global" | "persona" | "character",
  scopeId: string | null,
  name: string,
): string {
  return scopeId ? `${scope}:${scopeId}:${name}` : `${scope}:${name}`;
}

function getStoredFilename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function buildCharacterGalleryEmojiUrl(characterId: string, filename: string): string {
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

function buildPersonaGalleryEmojiUrl(personaId: string, filename: string): string {
  return `/api/characters/personas/${encodeURIComponent(personaId)}/gallery/file/${encodeURIComponent(filename)}`;
}

export async function generateRoutes(app: FastifyInstance) {
  const isDebug = logger.isLevelEnabled("debug");

  const chats = createChatsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const presets = createPromptsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const agentsStore = createAgentsStorage(app.db);
  const gameStateStore = createGameStateStorage(app.db);
  const customToolsStore = createCustomToolsStorage(app.db);
  const lorebooksStore = createLorebooksStorage(app.db);
  const regexScriptsStore = createRegexScriptsStorage(app.db);
  const customEmojisStore = createCustomEmojisStorage(app.db);
  const customStickersStore = createCustomStickersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const personaGallery = createPersonaGalleryStorage(app.db);

  /**
   * In-memory cache for OpenAI Responses API encrypted reasoning items.
   * Keyed by chatId → opaque reasoning items from the last response.
   * These are replayed on the next turn so the model can continue its reasoning chain.
   */
  const encryptedReasoningCache = new Map<string, unknown[]>();

  /**
   * POST /api/generate
   * Streams AI generation via Server-Sent Events.
   */
  app.post("/", async (req, reply) => {
    const input = generateRequestSchema.parse(req.body);
    const requestDebug = input.debugMode === true;
    const debugLog = (message: string, ...args: any[]) => {
      logDebugOverride(requestDebug, message, ...args);
    };

    // Resolve the chat
    const chat = await chats.getById(input.chatId);
    if (!chat) {
      return reply.status(404).send({ error: "Chat not found" });
    }
    const requestChatMode = (chat.mode as ChatMode) ?? "roleplay";
    if (requestChatMode === "conversation" && input.impersonate) {
      return reply.status(400).send({ error: "Impersonate is not available in Conversation mode" });
    }
    if (input.regenerateMessageId && input.continueMessageId) {
      return reply.status(400).send({ error: "Choose either regenerateMessageId or continueMessageId, not both" });
    }
    let continueTargetMessage: any = null;
    if (input.continueMessageId) {
      if (input.impersonate) {
        return reply.status(400).send({ error: "Cannot continue a message while impersonating" });
      }
      continueTargetMessage = await chats.getMessage(input.continueMessageId);
      if (!continueTargetMessage || continueTargetMessage.chatId !== input.chatId) {
        return reply.status(404).send({ error: "Continued message not found" });
      }
      if (continueTargetMessage.role !== "assistant") {
        return reply.status(400).send({ error: "Only assistant messages can be continued" });
      }
      if (!input.forCharacterId && continueTargetMessage.characterId) {
        input.forCharacterId = continueTargetMessage.characterId;
      }
    }
    let conversationGenerationStartedAt: number | null = null;
    let conversationAssistantSaved = false;
    const conversationCustomEmojiUrlByName = new Map<string, string>();
    const earlyMeta = parseExtra(chat.metadata) as Record<string, unknown>;
    const shouldAccountAutonomousGeneration =
      requestChatMode === "conversation" &&
      input.autonomous === true &&
      earlyMeta.internalAssistant !== PROFESSOR_MARI_INTERNAL_CHAT_MARKER &&
      !input.impersonate &&
      !input.regenerateMessageId;
    const activeGenerations = (app as any).activeGenerations as Map<
      string,
      { abortController: AbortController; backendUrl: string | null }
    >;
    if (activeGenerations?.has(input.chatId)) {
      return reply.status(409).send({ error: "A generation is already in progress for this chat" });
    }
    // Register immediately after the concurrency check. The rest of setup
    // awaits DB/connection work, so delaying this left a small double-submit
    // window where two requests for the same chat could both pass the guard.
    const abortController = new AbortController();
    if (activeGenerations) {
      activeGenerations.set(input.chatId, { abortController, backendUrl: null });
    }
    const releaseActiveGeneration = () => {
      if (activeGenerations?.get(input.chatId)?.abortController === abortController) {
        activeGenerations.delete(input.chatId);
      }
    };
    const releaseActiveGenerationAndRethrow = (err: unknown): never => {
      releaseActiveGeneration();
      throw err;
    };

    if (input.regenerateMessageId) {
      const regenCandidate = await chats.getMessage(input.regenerateMessageId).catch(releaseActiveGenerationAndRethrow);
      if (regenCandidate?.chatId === input.chatId) {
        const replay = normalizeGenerationReplay(parseExtra(regenCandidate.extra).generationReplay);
        applyGenerationReplayToRegenerateInput(input, replay);
        if (!input.forCharacterId && regenCandidate.characterId) {
          input.forCharacterId = regenCandidate.characterId;
        }
      }
    }
    const requestedNarrativeDirectorMode =
      input.narrativeDirectorMode === "random" || input.narrativeDirectorMode === "natural"
        ? input.narrativeDirectorMode
        : null;

    // ── Discord webhook URL (parsed once, used for mirroring below) ──
    const discordWebhookUrl = typeof earlyMeta.discordWebhookUrl === "string" ? earlyMeta.discordWebhookUrl : "";
    let pendingUserDiscordMsg = "";
    let currentTurnUserMessageId: string | null = null;

    // Save user message — skip for impersonate (no real user message to save)
    if (!input.impersonate && (input.userMessage || input.attachments?.length)) {
      // ── Commit game state: lock in the game state the user was seeing ──
      // Find the last assistant message's active swipe and commit its game state.
      // This ensures swipes/regens always use the state from the user's accepted turn.
      const preMessages = await chats.listMessages(input.chatId).catch(releaseActiveGenerationAndRethrow);
      for (let i = preMessages.length - 1; i >= 0; i--) {
        if (preMessages[i]!.role === "assistant") {
          const lastAsstMsg = preMessages[i]!;
          const gs = await gameStateStore
            .getByMessage(lastAsstMsg.id, lastAsstMsg.activeSwipeIndex)
            .catch(releaseActiveGenerationAndRethrow);
          if (gs) await gameStateStore.commit(gs.id).catch(releaseActiveGenerationAndRethrow);
          break;
        }
      }

      const userMsg = await chats
        .createMessage({
          chatId: input.chatId,
          role: "user",
          characterId: null,
          content: input.userMessage ?? "",
        })
        .catch(releaseActiveGenerationAndRethrow);
      currentTurnUserMessageId = userMsg?.id ?? null;
      if (requestChatMode === "conversation") {
        recordUserActivity(input.chatId);
      }

      // Store attachments in message extra if present
      if (input.attachments?.length && userMsg?.id) {
        await chats.updateMessageExtra(userMsg.id, { attachments: input.attachments }).catch(releaseActiveGenerationAndRethrow);
      }

      // Snapshot persona info for per-message persona tracking
      if (userMsg?.id) {
        const snapshotPersonas = await chars.listPersonas().catch(releaseActiveGenerationAndRethrow);
        const snapshotPersona =
          (chat.personaId ? snapshotPersonas.find((p: any) => p.id === chat.personaId) : null) ??
          snapshotPersonas.find((p: any) => p.isActive === "true");
        if (snapshotPersona) {
          await chats
            .updateMessageExtra(userMsg.id, {
              personaSnapshot: {
                personaId: snapshotPersona.id,
                name: snapshotPersona.name,
                description: snapshotPersona.description ?? "",
                personality: snapshotPersona.personality ?? "",
                scenario: snapshotPersona.scenario ?? "",
                backstory: snapshotPersona.backstory ?? "",
                appearance: snapshotPersona.appearance ?? "",
                avatarUrl: snapshotPersona.avatarPath || null,
                nameColor: snapshotPersona.nameColor || null,
                dialogueColor: snapshotPersona.dialogueColor || null,
                boxColor: snapshotPersona.boxColor || null,
              },
            })
            .catch(releaseActiveGenerationAndRethrow);
        }
      }

      // Mirror user message to Discord (deferred — personaName resolved later)
      pendingUserDiscordMsg = discordWebhookUrl && input.userMessage ? input.userMessage : "";
    }

    // Resolve connection
    const impersonateConnectionOverride =
      input.impersonate && input.impersonateConnectionId ? input.impersonateConnectionId : null;
    const fallbackConnectionId = input.connectionId || chat.connectionId;
    let connId = impersonateConnectionOverride || fallbackConnectionId;

    // ── Random connection: pick one from the random pool ──
    if (connId === "random") {
      const pool = await connections.listRandomPool().catch(releaseActiveGenerationAndRethrow);
      if (!pool.length) {
        releaseActiveGeneration();
        return reply.status(400).send({ error: "No connections are marked for the random pool" });
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      connId = picked.id;
    }

    if (!connId) {
      releaseActiveGeneration();
      return reply.status(400).send({ error: "No API connection configured for this chat" });
    }
    let conn = await connections.getWithKey(connId).catch(releaseActiveGenerationAndRethrow);
    if (!conn && impersonateConnectionOverride && connId === impersonateConnectionOverride && fallbackConnectionId) {
      logger.warn(
        "[generate] Impersonate connection override %s was not found; falling back to chat/request connection",
        impersonateConnectionOverride,
      );
      connId = fallbackConnectionId;
      if (connId === "random") {
        const pool = await connections.listRandomPool().catch(releaseActiveGenerationAndRethrow);
        if (!pool.length) {
          releaseActiveGeneration();
          return reply.status(400).send({ error: "No connections are marked for the random pool" });
        }
        const picked = pool[Math.floor(Math.random() * pool.length)];
        connId = picked.id;
      }
      conn = connId ? await connections.getWithKey(connId).catch(releaseActiveGenerationAndRethrow) : null;
    }
    if (!conn) {
      releaseActiveGeneration();
      return reply.status(400).send({ error: "API connection not found" });
    }

    // Resolve base URL — fall back to provider default if empty
    const baseUrl = resolveBaseUrl(conn);
    if (!baseUrl) {
      releaseActiveGeneration();
      return reply.status(400).send({ error: "No base URL configured for this connection" });
    }
    let chatMeta = parseExtra(chat.metadata) as Record<string, unknown>;
    const promptTimeZone =
      normalizePromptTimeZone(chatMeta.promptTimeZone) ?? normalizePromptTimeZone(input.userTimeZone);
    const promptNow = toZonedWallClockDate(new Date(), promptTimeZone);
    const excludePastReasoning = chatMeta.excludePastReasoning !== false;
    let memoryRecallEmbeddingSource: Awaited<ReturnType<typeof resolveMemoryRecallEmbeddingSource>> | null = null;
    try {
      memoryRecallEmbeddingSource = await resolveMemoryRecallEmbeddingSource(app.db, {
        chatMetadata: chatMeta,
        activeConnection: conn,
        activeBaseUrl: baseUrl,
      });
    } catch (err) {
      logger.warn(err, "[memory-recall] Embedding source resolution failed; using default embedding path");
    }
    let memoryRecallVectorizerAvailable = memoryRecallEmbeddingSource !== null;
    if (!memoryRecallVectorizerAvailable) {
      try {
        memoryRecallVectorizerAvailable = await isMemoryRecallVectorizerAvailable(app.db, {
          chatMetadata: chatMeta,
          activeConnection: conn,
          activeBaseUrl: baseUrl,
        });
      } catch (err) {
        logger.warn(err, "[memory-recall] Embedding availability check failed; memory recall will stay disabled");
      }
    }

    if (activeGenerations) {
      activeGenerations.set(input.chatId, { abortController, backendUrl: baseUrl });
    }

    // Set up SSE headers
    startSseReply(reply, { "X-Accel-Buffering": "no" });

    let generationComplete = false;
    let clientDisconnected = false;
    const originalSseWrite = reply.raw.write.bind(reply.raw);
    reply.raw.write = ((chunk: any, encodingOrCallback?: any, callback?: any) => {
      if (clientDisconnected || reply.raw.destroyed) return false;
      try {
        return originalSseWrite(chunk, encodingOrCallback, callback);
      } catch {
        return false;
      }
    }) as typeof reply.raw.write;
    const stopSseKeepalive = startSseKeepalive(reply);

    const onClose = () => {
      if (generationComplete) return;
      clientDisconnected = true;
      if (!shouldAbortOnPassiveGenerationDisconnect({ chatMode: requestChatMode, impersonate: input.impersonate })) {
        logger.info("[generate] Conversation client disconnected; generation will continue for chat: %s", input.chatId);
        return;
      }
      logger.info("[abort] Client disconnected — aborting generation");
      abortController.abort();
      if (baseUrl) {
        const backendRoot = baseUrl.replace(/\/v1\/?$/, "");
        fetch(backendRoot + "/api/extra/abort", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    };
    reply.raw.on("close", onClose);
    if (requestChatMode === "conversation" && !input.impersonate) {
      conversationGenerationStartedAt = markGenerationInProgress(input.chatId);
    }

    const recordSavedAutonomousGeneration = async (characterId: string | null | undefined) => {
      if (!shouldAccountAutonomousGeneration || !characterId) return;
      try {
        const updatedChat = await chats.patchMetadata(
          input.chatId,
          (current) => ({
            ...buildAutonomousDailyBudgetPatch(current, characterId),
            ...(isMessageIntent(input.autonomousIntentKey)
              ? buildIntentCooldownPatch(current, characterId, input.autonomousIntentKey)
              : {}),
          }),
          { touchUpdatedAt: false },
        );
        if (updatedChat) {
          chatMeta = parseExtra(updatedChat.metadata) as Record<string, unknown>;
        }
      } catch (err) {
        logger.warn(err, "[generate] Failed to record autonomous accounting for chat %s", input.chatId);
      }
    };

    // ── SSE progress helper: tells the client what phase we're in ──
    const sendProgress = (phase: string) => {
      trySendSseEvent(reply, { type: "progress", data: { phase } });
    };

    try {
      // ── Turn-game bot seats (UNO, etc.): drive the active game's bot players and
      //    short-circuit the normal conversation pipeline. Gated by an explicit
      //    flag so it can never affect a regular chat/roleplay generation. ──
      if (input.turnGameBots && requestChatMode === "conversation") {
        await runTurnGameBotTurns({
          db: app.db,
          chatId: input.chatId,
          conn,
          baseUrl,
          reply,
          signal: abortController.signal,
        });
        generationComplete = true;
        sendSseEvent(reply, { type: "done", data: "" });
        return;
      }

      // Get chat messages
      const allChatMessages = await chats.listMessages(input.chatId);
      const chatMode = requestChatMode;
      const lorebookGenerationTriggers = resolveLorebookGenerationTriggers(input, chatMode);
      const supportsHiddenFromAI =
        chatMode === "conversation" || chatMode === "roleplay" || chatMode === "visual_novel";
      const preferLatestVisibleGameState = shouldPreferLatestVisibleGameState(input);

      // ── Conversation-start filter: find the latest "isConversationStart" marker ──
      let startIdx = 0;
      for (let i = allChatMessages.length - 1; i >= 0; i--) {
        const extra = parseExtra(allChatMessages[i]!.extra);
        if (extra.isConversationStart) {
          startIdx = i;
          break;
        }
      }
      const scopedMessages = startIdx > 0 ? allChatMessages.slice(startIdx) : allChatMessages;
      let chatMessages = supportsHiddenFromAI
        ? scopedMessages.filter((message: any) => !isMessageHiddenFromAI(message))
        : scopedMessages;
      let lorebookKeeperMessages = chatMessages;
      let regenMsg: any;
      let regenerateUserMessage: SimpleMessage | null = null;
      let regenerateUserSourceMessage: SimpleMessage | null = null;

      // ── Regeneration as swipe: exclude the target message from context ──
      if (input.regenerateMessageId) {
        regenMsg = scopedMessages.find((m: any) => m.id === input.regenerateMessageId);
        if (!regenMsg) {
          sendSseEvent(reply, { type: "error", data: "Regenerated message not found" });
          return;
        }
        if (!canUseMessageForUserRegeneration({ message: regenMsg, supportsHiddenFromAI })) {
          sendSseEvent(reply, { type: "error", data: "Cannot regenerate a message hidden from AI" });
          return;
        }
        if (regenMsg.role === "user") {
          regenerateUserSourceMessage = buildUserMessageRegenerationSourceMessage(regenMsg);
        }
        chatMessages = chatMessages.filter((m: any) => m.id !== input.regenerateMessageId);
        lorebookKeeperMessages = lorebookKeeperMessages.filter((m: any) => m.id !== input.regenerateMessageId);
      }
      const promptLastGenerationType = resolvePromptLastGenerationType(input);
      const promptIdleDuration = resolvePromptIdleDuration(chatMessages, {
        excludeMessageId: currentTurnUserMessageId,
      });
      const visibleGameStateAnchor = input.regenerateMessageId
        ? resolveRegenerationGameStateAnchor(scopedMessages, input.regenerateMessageId)
        : resolveVisibleGameStateAnchor(allChatMessages);
      const gameStateGenerationOptions = {
        preferLatestVisible: preferLatestVisibleGameState,
        visibleAnchor: visibleGameStateAnchor,
        excludeMessageId: input.regenerateMessageId ?? null,
        fallbackMessageIds: resolveRegenerationGameStateFallbackMessageIds(scopedMessages, input.regenerateMessageId),
      };
      const selectedGameStateSnapshotPromise = gameStateStore.getForGeneration(
        input.chatId,
        gameStateGenerationOptions,
      );
      const selectedGameStateForPrompt = async (): Promise<Record<string, unknown> | null> => {
        const row = await selectedGameStateSnapshotPromise;
        return row ? (parseGameStateRow(row as Record<string, unknown>) as unknown as Record<string, unknown>) : null;
      };

      // ── Context message limit (from chat metadata, off by default) ──
      const lorebookKeeperSettings = getLorebookKeeperSettings(chatMeta);
      const contextMessageLimit = chatMeta.contextMessageLimit as number | null;
      if (contextMessageLimit && contextMessageLimit > 0 && chatMessages.length > contextMessageLimit) {
        chatMessages = chatMessages.slice(-contextMessageLimit);
      }

      const isGoogleProvider = conn.provider === "google" || conn.provider === "google_vertex";

      const mappedMessages = chatMessages.map((m: any) => {
        const extra = parseExtra(m.extra);
        const attachments = extra.attachments as PromptAttachment[] | undefined;
        const images = extractImageAttachmentDataUrls(attachments);
        const files = extractFileAttachmentInputs(attachments);
        const providerMetadata: Record<string, unknown> = {};
        // For Google connections, carry stored Gemini parts (thought signatures) on assistant messages
        if (!excludePastReasoning && isGoogleProvider && m.role === "assistant" && extra.geminiParts) {
          providerMetadata.geminiParts = extra.geminiParts;
        }
        const chatCompletionsReasoning =
          !excludePastReasoning &&
          m.role === "assistant" &&
          shouldReplayStoredChatCompletionsReasoning(conn.provider, conn.model)
            ? readChatCompletionsReasoningMetadata(extra.chatCompletionsReasoning)
            : undefined;
        if (chatCompletionsReasoning) {
          Object.assign(providerMetadata, chatCompletionsReasoning);
        }

        // Annotate assistant messages that have user-uploaded image attachments
        // so the model is aware it sent a photo in prior turns.
        // Skip illustration/selfie attachments (type "image") — those are generated
        // by agents and should be invisible to the main model.
        let content = appendReadableAttachmentsToContent(conversationPromptHistoryContent(m, chatMode), attachments);
        const userUploadedImages = attachments?.filter((a) => a.type?.startsWith("image/"));
        if (m.role === "assistant" && userUploadedImages?.length) {
          const photoName = userUploadedImages[0]?.filename ?? userUploadedImages[0]?.name;
          content += `\n[Sent a photo${photoName ? `: ${photoName}` : ""}]`;
        }

        return {
          role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
          content,
          contextKind: "history" as const,
          characterId: typeof m.characterId === "string" && m.characterId ? m.characterId : null,
          ...(images?.length ? { images } : {}),
          ...(files.length ? { files } : {}),
          ...(Object.keys(providerMetadata).length ? { providerMetadata } : {}),
        };
      });

      // Attach current request's provider inputs to the last user message (they're already saved in extra,
      // but the message was just created and may be the last in mappedMessages)
      if (input.attachments?.length && !input.impersonate) {
        const imageAttachments = extractImageAttachmentDataUrls(input.attachments);
        const fileAttachments = extractFileAttachmentInputs(input.attachments);
        if (imageAttachments.length || fileAttachments.length) {
          // Find the last user message and attach provider-native inputs.
          for (let i = mappedMessages.length - 1; i >= 0; i--) {
            if (mappedMessages[i]!.role === "user") {
              mappedMessages[i] = {
                ...mappedMessages[i]!,
                ...(imageAttachments.length ? { images: imageAttachments } : {}),
                ...(fileAttachments.length ? { files: fileAttachments } : {}),
              };
              break;
            }
          }
        }
      }

      // Always collapse 3+ consecutive blank lines into a double newline —
      // these waste tokens and produce messy logs regardless of user regex settings.
      // Matches pure newlines AND lines that contain only whitespace.
      for (const msg of mappedMessages) {
        msg.content = msg.content.replace(/\n([ \t]*\n){2,}/g, "\n\n");
      }

      const allCharacterIds: string[] = JSON.parse(chat.characterIds as string);
      const characterIds = resolveActiveCharacterIds(allCharacterIds, chatMeta, {
        mode: chatMode,
        allowEmpty: true,
      });
      const isHomeProfessorMariAssistantChat =
        chatMeta.internalAssistant === PROFESSOR_MARI_INTERNAL_CHAT_MARKER && characterIds.includes(PROFESSOR_MARI_ID);
      if (allCharacterIds.length > 0 && characterIds.length === 0 && chatMode !== "game") {
        throw new Error("All characters in this chat are disabled. Enable at least one character before generating.");
      }

      // Resolve persona — prefer per-chat personaId, fall back to globally active persona
      // (Game mode skips the fallback — persona must be explicitly selected in the setup wizard)
      let personaId: string | null = null;
      let personaName = "User";
      let personaDescription = "";
      let personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string } = {};
      const allPersonas = await chars.listPersonas();
      // ── Game mode: apply segment edit overlays to message content ──
      // Users can edit individual narration/dialogue segments in the VN UI.
      // Edits are stored as chat-metadata overlays; apply them so the model
      // sees the corrected text in its conversation history.
      if (chatMode === "game") {
        applyAllSegmentEdits(mappedMessages, chatMeta as Record<string, unknown>, chatMessages);
      }

      // User-message regeneration removes the target turn from real chat history,
      // but prompt shaping still needs that original user input for macros,
      // lorebook matching, semantic embeddings, and memory recall. Keep this
      // separate from the final Gemini rewrite instruction appended near send time.
      const currentInputMessages = (): SimpleMessage[] =>
        regenerateUserSourceMessage ? [...mappedMessages, regenerateUserSourceMessage] : mappedMessages;
      const currentUserInputContent = (): string | undefined =>
        [...currentInputMessages()].reverse().find((message) => message.role === "user")?.content;

      const persona =
        (chat.personaId ? allPersonas.find((p: any) => p.id === chat.personaId) : null) ??
        (chatMode !== "game" ? allPersonas.find((p: any) => p.isActive === "true") : null);
      if (persona) {
        personaId = persona.id as string;
        personaName = persona.name;
        personaDescription = cardPromptText(persona.description);

        personaFields = {
          personality: cardPromptText(persona.personality),
          scenario: cardPromptText(persona.scenario),
          backstory: cardPromptText(persona.backstory),
          appearance: cardPromptText(persona.appearance),
        };
      }

      // Mirror user message to Discord now that personaName is resolved
      if (pendingUserDiscordMsg) {
        postToDiscordWebhook(discordWebhookUrl, { content: pendingUserDiscordMsg, username: personaName });
      }

      // ── Assembler path: use the highest-priority prompt preset for this generation ──
      const chatPromptPresetId = (chat.promptPresetId as string | null) ?? null;
      const presetCandidates = buildGenerationPromptPresetCandidates({
        chatMode,
        chatPromptPresetId,
        connectionPromptPresetId: conn.promptPresetId,
        impersonate: input.impersonate,
        impersonatePromptPresetId: input.impersonatePresetId,
      });
      let presetId: string | undefined;
      let resolvedPreset: Awaited<ReturnType<typeof presets.getById>> | null = null;
      let presetSource: PromptPresetCandidateSource | null = null;
      for (const candidate of presetCandidates) {
        const candidatePreset = await presets.getById(candidate.id);
        if (candidatePreset) {
          presetId = candidate.id;
          resolvedPreset = candidatePreset;
          presetSource = candidate.source;
          break;
        }
        if (candidate.source !== "chat") {
          logger.warn(
            "[generate] %s prompt preset override %s was not found; falling back to the next preset candidate",
            candidate.source,
            candidate.id,
          );
        }
      }
      const selectedPresetDiffersFromChat = !!resolvedPreset && !!presetId && presetId !== chatPromptPresetId;
      const overrideDefaultChoices =
        selectedPresetDiffersFromChat && presetSource !== "chat"
          ? (parsePromptPresetChoices((resolvedPreset as { defaultChoices?: unknown }).defaultChoices) ?? {})
          : null;
      const chatChoices: Record<string, string | string[]> =
        overrideDefaultChoices ?? ((chatMeta.presetChoices ?? {}) as Record<string, string | string[]>);
      let groupHistoryCharacterNamesByIdPromise: Promise<Map<string, string>> | null = null;
      const getGroupHistoryCharacterNamesById = () => {
        groupHistoryCharacterNamesByIdPromise ??= resolveCharacterNameMap(allCharacterIds, (id) => chars.getById(id));
        return groupHistoryCharacterNamesByIdPromise;
      };

      // ── Professor Mari fetch follow-up loop ──
      // After Mari executes a [fetch:], the fetched data is persisted to
      // chatMeta.mariContext but only injected into the prompt at the START
      // of a generation pass. Without a follow-up turn she goes silent
      // ("snackbar without follow-up", #898). The loop re-runs the generation
      // up to MAX_FOLLOW_UP_ITERATIONS additional times if a fetch fired in
      // the previous pass, so Mari can speak to the data she just pulled.
      let runningMessagesForFollowUp: GenerationPromptMessage[] = [...mappedMessages];
      let followUpIteration = 0;
      const MAX_FOLLOW_UP_ITERATIONS = 2;

      // Hoisted out of the loop so the SSE flush, OOC posting, and
      // illustration await at the end see state from the latest iteration.
      let firstSavedMsg: any = null;
      let lastSavedMsg: any = null;
      let pendingIllustration: Promise<void> | null = null;
      const collectedCommands: Array<{
        command: CharacterCommand;
        characterId: string | null;
        messageId: string;
        swipeIndex: number;
      }> = [];
      const collectedOocMessages: string[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Per-iteration flag: set when a Mari [fetch:] command actually returned
        // data AND persisted mariContext. The follow-up branch at the bottom of
        // the loop body gates on this so a fetch that found nothing or threw
        // doesn't burn an extra generation pass with no new context to read.
        let mariFetchSucceededThisIteration = false;
        let finalMessages: GenerationPromptMessage[] = [...runningMessagesForFollowUp];
        let conversationCommandsReminder: string | null = null;
        const conversationCommandsEnabled = chatMode === "conversation" && chatMeta.characterCommands !== false;
        let temperature: number | undefined = 1;
        let maxTokens = 4096;
        let topP: number | undefined = 1;
        let topK = 0;
        let minP = 0;
        let frequencyPenalty = 0;
        let presencePenalty = 0;
        let showThoughts = true;
        let reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null = null;
        let verbosity: "low" | "medium" | "high" | null = null;
        let serviceTier: "flex" | "priority" | null = null;
        let assistantPrefill = "";
        let customThinkingTags: ThinkingTagPair[] = [];
        let customParameters: Record<string, unknown> = {};
        let enabledParameters: GenerationParameterSendMap | undefined;
        let stopSequences: string[] = [];
        let wrapFormat: "xml" | "markdown" | "none" = "xml";
        const runtimeAgentSectionTypes = new Set<RuntimeAgentSectionType>();
        const runtimeAgentSectionTokens = new Map<RuntimeAgentSectionType, RuntimeAgentSectionTokens>();
        const modelAccessPolicy = resolveModelAccessPolicy({
          provider: conn.provider,
          model: conn.model,
          maxContext: conn.maxContext,
        });
        const { suppressModelParameters, connectionMaxContext } = modelAccessPolicy;
        let effectiveMaxContext = modelAccessPolicy.effectiveMaxContext;

        // Determine whether agents are enabled for this chat (needed by assembler + agent pipeline).
        // Mode policy filters which agents may run for conversation, roleplay, visual novel, and game chats.
        logger.info("[generate] chatId=%s, chatMode=%s", input.chatId, chatMode);
        const activeMusicPlayerSource =
          input.musicPlayerEnabled === false
            ? null
            : input.musicPlayerSource === "youtube" || input.musicPlayerSource === "custom"
              ? input.musicPlayerSource
              : "spotify";
        const chatEnableAgents = shouldEnableAgentsForGeneration({
          chatEnableAgents: chatMeta.enableAgents === true,
          chatMode,
          impersonate: input.impersonate,
          impersonateBlockAgents: input.impersonateBlockAgents,
        });
        const persistedChatActiveAgentIds: string[] = Array.isArray(chatMeta.activeAgentIds)
          ? (chatMeta.activeAgentIds as string[])
          : [];
        const gameMusicDjEnabled =
          chatMode === "game" &&
          (chatMeta.gameUseMusicDj === true ||
            chatMeta.gameUseSpotifyMusic === true ||
            persistedChatActiveAgentIds.includes("youtube"));
        const gameSpotifyMusicEnabled = gameMusicDjEnabled && activeMusicPlayerSource === "spotify";
        const normalizedPersistedChatActiveAgentIds = persistedChatActiveAgentIds.map((agentId) =>
          agentId === "youtube" ? "spotify" : agentId,
        );
        if (gameMusicDjEnabled && !normalizedPersistedChatActiveAgentIds.includes("spotify")) {
          normalizedPersistedChatActiveAgentIds.push("spotify");
        }
        const rawChatActiveAgentIds: string[] = filterGameInternalAgentIds(
          chatMode,
          normalizedPersistedChatActiveAgentIds,
        )
          .filter((agentId) => isAgentAvailableInChatMode(chatMode, agentId))
          .filter((agentId) => !(gameSpotifyMusicEnabled && agentId === "spotify"));
        const configuredPromptAgents =
          chatEnableAgents && rawChatActiveAgentIds.length > 0 ? await agentsStore.list() : [];
        const deletedBuiltInAgentTypes = new Set(
          configuredPromptAgents
            .filter((agent) => BUILT_IN_AGENTS.some((builtIn) => builtIn.id === agent.type))
            .filter((agent) => isAgentConfigDeleted(agent.settings))
            .map((agent) => agent.type as string),
        );
        const chatActiveAgentIds = rawChatActiveAgentIds.filter((agentId) => !deletedBuiltInAgentTypes.has(agentId));
        const agentPromptTemplateSelections = normalizeAgentPromptTemplateSelectionMap(chatMeta.agentPromptTemplateIds);
        const hasPerChatAgentList = chatActiveAgentIds.length > 0;
        const perChatAgentSet = new Set(chatActiveAgentIds);
        const activeChatSummary = resolveRoleplayChatSummary(chatMode, chatMeta);
        const runtimeSectionEligibleAgentTypes = buildRuntimeAgentSectionEligibleTypes({
          enableAgents: chatEnableAgents,
          activeAgentIds: chatActiveAgentIds,
          chatMode,
          configuredAgents: configuredPromptAgents.map((agent) => ({
            type: agent.type,
            phase: agent.phase,
            settings: agent.settings,
          })),
        });
        const chatActiveLorebookIds: string[] = Array.isArray(chatMeta.activeLorebookIds)
          ? (chatMeta.activeLorebookIds as string[])
          : [];
        const lorebookScopeExclusions = resolveLorebookScopeExclusions(chatMode, chatMeta);
        let lorebookScanSnapshot: LorebookScanSnapshot = emptyLorebookScanSnapshot();
        let presetHandledLorebooks = false;
        const presetHasLorebookMarker = (sections: Array<{ isMarker: string; markerConfig: string | null }>) =>
          sections.some((section) => {
            if (section.isMarker !== "true" || !section.markerConfig) return false;
            try {
              const markerType = (JSON.parse(section.markerConfig) as { type?: unknown }).type;
              return (
                markerType === "lorebook" || markerType === "world_info_before" || markerType === "world_info_after"
              );
            } catch {
              return false;
            }
          });
        const promptGroupResponseOrder = (chatMeta.groupResponseOrder as string) ?? "sequential";
        const promptGroupChatMode =
          chatMode === "conversation"
            ? promptGroupResponseOrder === "manual"
              ? "individual"
              : "merged"
            : ((chatMeta.groupChatMode as string) ?? "merged");
        const promptTargetCharacterId =
          typeof input.forCharacterId === "string" && characterIds.includes(input.forCharacterId)
            ? input.forCharacterId
            : null;
        const promptCharacterIds = resolvePromptCharacterIdsForTarget(characterIds, promptTargetCharacterId);
        const deferCharacterMacros =
          characterIds.length > 1 &&
          promptGroupChatMode === "individual" &&
          promptGroupResponseOrder !== "manual" &&
          input.impersonate !== true;
        const shouldPrefixGroupHistorySpeakers =
          chatMeta.groupSpeakerNamesInHistory === true &&
          characterIds.length > 1 &&
          chatMode !== "conversation" &&
          chatMode !== "game" &&
          promptGroupChatMode === "individual";
        const modePromptChoiceBlocks =
          presetId && resolvedPreset && (chatMode === "conversation" || chatMode === "game")
            ? await presets.listChoiceBlocksForPreset(presetId)
            : [];
        const modePromptVariables = resolveModePromptChoiceVariables(
          modePromptChoiceBlocks as PromptChoiceBlockRow[],
          chatChoices,
        );
        const promptMacroContext = await buildPromptMacroContext({
          db: app.db,
          characterIds: promptCharacterIds,
          personaName,
          personaDescription,
          personaFields,
          variables: modePromptVariables,
          groupScenarioOverrideText:
            typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
              ? (chatMeta.groupScenarioText as string).trim()
              : null,
          lastInput: currentUserInputContent(),
          chatId: input.chatId,
          model: conn.model,
          lastGenerationType: promptLastGenerationType,
          idleDuration: promptIdleDuration,
          timeZone: promptTimeZone,
        });
        const historyMacroProfilesById = (await resolveCharacterMacroData(app.db, allCharacterIds)).profilesById;
        const resolveHistoryMessageMacros = <T extends { content: string; characterId?: string | null }>(
          messages: T[],
        ): T[] => resolvePromptMessageMacros(messages, promptMacroContext, historyMacroProfilesById);
        const resolvePromptMacros = (value: string) => resolveMacros(value, promptMacroContext);
        const resolvePromptMacrosForLorebook = (value: string) =>
          resolveMacrosWithVariableSnapshot(
            value,
            promptMacroContext,
            deferCharacterMacros ? { deferCharacterMacros: "names" } : undefined,
          );
        let promptRegexScripts: Awaited<ReturnType<typeof regexScriptsStore.list>> | null = null;
        const getPromptRegexScripts = async () => {
          promptRegexScripts ??= await regexScriptsStore.list();
          return promptRegexScripts;
        };

        // ── Apply regex scripts to prompt message content ──
        // Macro context is available now, so regex find/replace/trim fields can use prompt macros.
        // Gated to iteration 0 because applyRegexScriptsToPromptMessages mutates
        // message.content in place — running it again on a Mari follow-up pass
        // would stack non-idempotent user regex scripts on already-rewritten text.
        // The newly appended Mari turn is run through the same transforms below
        // before it lands in runningMessagesForFollowUp, so each message still
        // gets exactly one pass.
        if (followUpIteration === 0) {
          const regexScripts = await getPromptRegexScripts();
          applyRegexScriptsToPromptMessages(mappedMessages, regexScripts, {
            resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
            targetCharacterId: promptTargetCharacterId,
          });
          if (regenerateUserSourceMessage) {
            const sourceMessages = [regenerateUserSourceMessage];
            applyRegexScriptsToPromptMessages(sourceMessages, regexScripts, {
              resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
              targetCharacterId: promptTargetCharacterId,
            });
          }

          // Always collapse 3+ consecutive blank lines into a double newline —
          // these waste tokens and produce messy logs regardless of user regex settings.
          // Matches pure newlines AND lines that contain only whitespace.
          for (const msg of mappedMessages) {
            msg.content = msg.content.replace(/\n([ \t]*\n){2,}/g, "\n\n");
          }
          if (regenerateUserSourceMessage) {
            regenerateUserSourceMessage.content = regenerateUserSourceMessage.content.replace(
              /\n([ \t]*\n){2,}/g,
              "\n\n",
            );
          }
          mappedMessages.splice(0, mappedMessages.length, ...resolveHistoryMessageMacros(mappedMessages));
          if (regenerateUserSourceMessage) {
            regenerateUserSourceMessage = resolveHistoryMessageMacros([regenerateUserSourceMessage])[0] ?? null;
          }
          lorebookKeeperMessages = resolveHistoryMessageMacros(
            lorebookKeeperMessages.map((message: any) => ({
              ...message,
              content: conversationPromptHistoryContent(message, chatMode),
              characterId: typeof message.characterId === "string" && message.characterId ? message.characterId : null,
            })),
          );
          if (shouldPrefixGroupHistorySpeakers) {
            const characterNamesById = await getGroupHistoryCharacterNamesById();
            mappedMessages.splice(
              0,
              mappedMessages.length,
              ...prefixGroupIndividualHistorySpeakers(mappedMessages, {
                personaName,
                characterNamesById,
              }),
            );
          }
        }
        if (followUpIteration === 0) {
          runningMessagesForFollowUp = [...mappedMessages];
          finalMessages = [...runningMessagesForFollowUp];
        }
        if (regenerateUserSourceMessage) {
          regenerateUserMessage = buildUserMessageRegenerationPromptFromSource(regenerateUserSourceMessage);
        }
        promptMacroContext.lastInput = currentUserInputContent();
        const toLorebookScanMessages = () =>
          buildLorebookScanMessagesWithGenerationGuide(
            currentInputMessages().map((m) => ({
              role: m.role,
              content: m.content,
            })),
            input,
          );
        let promptScopedLorebookIdSetPromise: Promise<Set<string>> | null = null;
        const getPromptScopedLorebookIdSet = () => {
          promptScopedLorebookIdSetPromise ??= (async () => {
            const allLorebooks = (await lorebooksStore.list()) as unknown as Lorebook[];
            const relevantLorebooks = filterRelevantLorebooks(allLorebooks, {
              chatId: input.chatId,
              characterIds: promptCharacterIds,
              personaId,
              activeLorebookIds: chatActiveLorebookIds,
              excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
              excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            });
            return new Set(relevantLorebooks.map((lorebook) => lorebook.id));
          })();
          return promptScopedLorebookIdSetPromise;
        };
        const filterChatActiveLorebookSourceIdsForPrompt = async (
          sourceIds: string[],
          source: "manual" | "chat_active" | "none",
        ) => {
          if (source !== "chat_active" || sourceIds.length === 0) return sourceIds;
          const scopedIds = await getPromptScopedLorebookIdSet();
          return sourceIds.filter((id) => scopedIds.has(id));
        };

        // ── Compute chat embedding for semantic lorebook matching (if any entries are vectorized) ──
        sendProgress("embedding");
        const _tEmbed = Date.now();
        let chatContextEmbedding: number[] | null = null;
        const knowledgeRouterActivatedLorebookEntryIds = new Set<string>();
        const knowledgeRouterExcludedLorebookEntryIds = new Set<string>();
        let knowledgeRouterActivationPassCompleted = false;
        try {
          const activeEntries = (await lorebooksStore.listActiveEntries({
            chatId: input.chatId,
            characterIds: promptCharacterIds,
            personaId,
            activeLorebookIds: chatActiveLorebookIds,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
          })) as LorebookEntry[];
          const hasVectorizedEntries = activeEntries.some(
            (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0,
          );
          if (hasVectorizedEntries && memoryRecallVectorizerAvailable) {
            const recentMsgs = currentInputMessages()
              .slice(-10)
              .map((m) => m.content)
              .join("\n");
            if (recentMsgs.trim()) {
              const embeddings = await embedMemoryRecallTexts([recentMsgs], {
                embeddingSource: memoryRecallEmbeddingSource,
                signal: abortController.signal,
              });
              chatContextEmbedding = embeddings[0] ?? null;
            }
          }
        } catch {
          // Embedding generation is optional — if it fails, fall back to keyword-only matching
        }
        logger.debug(`[timing] Embedding: ${Date.now() - _tEmbed}ms`);

        sendProgress("assembling");
        const _tAssemble = Date.now();
        if (presetId && resolvedPreset && chatMode !== "conversation" && chatMode !== "game") {
          const preset = resolvedPreset;
          wrapFormat = (preset.wrapFormat as "xml" | "markdown" | "none") || "xml";
          const [sections, groups, choiceBlocks] = await Promise.all([
            presets.listSections(presetId),
            presets.listGroups(presetId),
            presets.listChoiceBlocksForPreset(presetId),
          ]);
          for (const section of sections) {
            if (section.enabled !== "true" || section.isMarker !== "true" || !section.markerConfig) continue;
            try {
              const markerConfig = JSON.parse(section.markerConfig) as { type?: unknown; agentType?: unknown };
              const runtimeType =
                markerConfig.type === "agent_data" && typeof markerConfig.agentType === "string"
                  ? toRuntimeAgentSectionType(markerConfig.agentType, runtimeSectionEligibleAgentTypes)
                  : null;
              if (runtimeType) runtimeAgentSectionTypes.add(runtimeType);
            } catch {
              /* ignore malformed marker config */
            }
          }
          const runtimeAgentNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
          const runtimeAgentData = Object.fromEntries(
            Array.from(runtimeAgentSectionTypes).map((agentType) => {
              const tokens = makeRuntimeAgentSectionTokens(agentType, runtimeAgentNonce);
              runtimeAgentSectionTokens.set(agentType, tokens);
              return [
                agentType,
                {
                  text: tokens.placeholder,
                  startToken: tokens.start,
                  endToken: tokens.end,
                },
              ];
            }),
          );

          const assemblerInput: AssemblerInput = {
            db: app.db,
            preset: preset as any,
            sections: sections as any,
            groups: groups as any,
            choiceBlocks: choiceBlocks as any,
            chatChoices,
            chatId: input.chatId,
            characterIds: promptCharacterIds,
            personaId,
            personaName,
            personaDescription,
            personaFields,
            personaStats: (() => {
              if (!persona?.personaStats) return undefined;
              if (typeof persona.personaStats !== "string") return persona.personaStats;
              try {
                return JSON.parse(persona.personaStats);
              } catch {
                return undefined;
              }
            })(),
            chatMessages: mappedMessages,
            lorebookScanMessages: toLorebookScanMessages(),
            chatSummary: activeChatSummary,
            enableAgents: chatEnableAgents,
            activeAgentIds: chatActiveAgentIds,
            activeLorebookIds: chatActiveLorebookIds,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            lorebookTokenBudget: resolveLorebookTokenBudget(chatMeta),
            chatEmbedding: chatContextEmbedding,
            entryStateOverrides:
              (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
              undefined,
            entryTimingStates: (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
            gameState: null,
            generationTriggers: lorebookGenerationTriggers,
            groupScenarioOverrideText:
              typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
                ? (chatMeta.groupScenarioText as string).trim()
                : null,
            runtimeAgentData,
            lastGenerationType: promptLastGenerationType,
            idleDuration: promptIdleDuration,
            timeZone: promptTimeZone,
            deferCharacterMacros,
          };

          const assembled = await assemblePrompt(assemblerInput);
          if (assembled.lorebookActivatedEntries || assembled.lorebookBudgetSkippedEntries) {
            lorebookScanSnapshot = {
              activatedEntries: assembled.lorebookActivatedEntries ?? [],
              budgetSkippedEntries: assembled.lorebookBudgetSkippedEntries ?? [],
              totalTokensEstimate: Math.ceil(
                (assembled.lorebookActivatedEntries ?? []).reduce((total, entry) => total + entry.content.length, 0) /
                  4,
              ),
              totalEntries: (assembled.lorebookActivatedEntries ?? []).length,
            };
          }
          presetHandledLorebooks =
            presetHasLorebookMarker(sections) ||
            assembled.lorebookDepthEntriesCount > 0 ||
            !!assembled.updatedEntryStateOverrides ||
            assembled.updatedEntryTimingStates !== undefined;
          if (assembled.lorebookActivatedEntries || assembled.lorebookBudgetSkippedEntries) {
            rememberKnowledgeRouterActivatedLorebookIds(
              knowledgeRouterActivatedLorebookEntryIds,
              knowledgeRouterExcludedLorebookEntryIds,
              {
                activatedEntries: assembled.lorebookActivatedEntries ?? [],
                budgetSkippedEntries: assembled.lorebookBudgetSkippedEntries ?? [],
              },
            );
            knowledgeRouterActivationPassCompleted = true;
          } else if (presetHandledLorebooks) {
            knowledgeRouterActivationPassCompleted = true;
          }
          finalMessages = assembled.messages;
          temperature = assembled.parameters.temperature;
          maxTokens = assembled.parameters.maxTokens;
          topP = assembled.parameters.topP ?? 1;
          topK = assembled.parameters.topK ?? 0;
          minP = assembled.parameters.minP ?? 0;
          frequencyPenalty = assembled.parameters.frequencyPenalty ?? 0;
          presencePenalty = assembled.parameters.presencePenalty ?? 0;
          showThoughts = assembled.parameters.showThoughts ?? true;
          reasoningEffort = assembled.parameters.reasoningEffort ?? null;
          verbosity = assembled.parameters.verbosity ?? null;
          serviceTier = assembled.parameters.serviceTier ?? null;
          assistantPrefill = assembled.parameters.assistantPrefill ?? "";
          customThinkingTags = normalizeThinkingTagPairs(assembled.parameters.customThinkingTags);
          customParameters = mergeCustomParameters(customParameters, assembled.parameters.customParameters);
          if (assembled.parameters.enabledParameters) {
            enabledParameters = { ...(enabledParameters ?? {}), ...assembled.parameters.enabledParameters };
          }
          stopSequences = (assembled.parameters.stopSequences ?? [])
            .map((value) => value.trim())
            .filter((value) => value.length > 0);

          effectiveMaxContext = mergeModelContextLimit(
            modelAccessPolicy,
            effectiveMaxContext,
            resolveStoredModelContextLimit(modelAccessPolicy, assembled.parameters),
          );

          if (assembled.updatedEntryStateOverrides) chatMeta.entryStateOverrides = assembled.updatedEntryStateOverrides;
          if (assembled.updatedEntryTimingStates) chatMeta.entryTimingStates = assembled.updatedEntryTimingStates;
          await persistLorebookRuntimeState({
            chats,
            chatId: input.chatId,
            fallbackMeta: chatMeta,
            entryStateOverrides: assembled.updatedEntryStateOverrides,
            entryTimingStates: assembled.updatedEntryTimingStates,
          });
        }

        // ── Conversation mode: inject built-in DM-style system prompt ──
        let convoAwarenessBlock: string | null = null;
        if (chatMode === "conversation") {
          // Gather character names and status for the prompt.
          // If schedules exist in chat metadata, derive status dynamically.
          const schedules: Record<string, import("../services/conversation/schedule.service.js").WeekSchedule> =
            getEnabledConversationSchedules(chatMeta) as Record<
              string,
              import("../services/conversation/schedule.service.js").WeekSchedule
            >;
          const statusOverrides = parseConversationStatusOverrides(chatMeta.conversationStatusOverrides);
          const convoCharInfo: {
            charId: string;
            name: string;
            status: string;
            activity: string;
            todaySchedule: string;
          }[] = [];
          for (const cid of characterIds) {
            const charRow = await chars.getById(cid);
            if (charRow) {
              const d = JSON.parse(charRow.data as string);
              const schedSvc = await import("../services/conversation/schedule.service.js");
              const override = statusOverrides[cid];
              // Schedules are chat-scoped. If this chat has no schedule for the character,
              // don't inherit a stale conversationStatus from some other chat.
              const fallback = schedSvc.getEffectiveCurrentStatus(undefined, override, promptNow, "");
              let status = fallback.status;
              let activity = fallback.activity;
              let todaySchedule = "";
              const schedule = schedules[cid];
              if (schedule) {
                const derived = schedSvc.getEffectiveCurrentStatus(schedule, override, promptNow);
                status = derived.status;
                activity = derived.activity;
                todaySchedule = schedSvc.getTodaySchedule(schedule, promptNow);
              }
              convoCharInfo.push({ charId: cid, name: d.name ?? "Unknown", status, activity, todaySchedule });
            }
          }
          // Persist per-chat presence state so sidebar dots stay scoped to this chat.
          if (convoCharInfo.length > 0) {
            void chats
              .patchMetadata(
                input.chatId,
                (current) => ({
                  conversationCharacterStatuses: {
                    ...(current.conversationCharacterStatuses ?? {}),
                    ...Object.fromEntries(
                      convoCharInfo.map((c) => [c.charId, { status: c.status, activity: c.activity }]),
                    ),
                  },
                }),
                { touchUpdatedAt: false },
              )
              .catch(() => {});
          }
          const convoCharNames = convoCharInfo.map((c) => c.name);
          const charNameList = convoCharNames.length ? convoCharNames.join(", ") : "the character";
          const manualTargetCharId =
            typeof input.forCharacterId === "string" && characterIds.includes(input.forCharacterId)
              ? input.forCharacterId
              : null;
          const requestedMentionNames = new Set(
            (input.mentionedCharacterNames ?? []).map((name: string) => normalizeTextForMatch(name)),
          );
          const scopedConvoCharInfo = manualTargetCharId
            ? convoCharInfo.filter((c) => c.charId === manualTargetCharId)
            : requestedMentionNames.size > 0
              ? convoCharInfo.filter((c) => requestedMentionNames.has(normalizeTextForMatch(c.name)))
              : convoCharInfo;
          let respondingConvoCharInfo = scopedConvoCharInfo.length > 0 ? scopedConvoCharInfo : convoCharInfo;

          if (shouldAccountAutonomousGeneration && !input.regenerateMessageId && !input.impersonate) {
            const budget = getAutonomousDailyBudget(chatMeta);
            respondingConvoCharInfo = respondingConvoCharInfo.filter((character) => {
              const count = budget.counts[character.charId] ?? 0;
              const cap = dailyCapForCharacter(schedules[character.charId], chatMeta);
              return count < cap;
            });

            if (respondingConvoCharInfo.length === 0) {
              reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
              reply.raw.end();
              return;
            }
          }

          const respondingConvoCharNames = respondingConvoCharInfo.map((c) => c.name);

          // Characters seated at an ACTIVE turn-game are present at the table:
          // treat them as online so their schedule's offline-skip + typing delay
          // don't make a player at the table go silent or reply minutes late.
          let seatedGameCharIds = new Set<string>();
          {
            const activeGameForSchedule = await getActiveTurnGame(app.db, input.chatId);
            const seatOrder = activeGameForSchedule?.state?.seatOrder;
            if (Array.isArray(seatOrder)) {
              seatedGameCharIds = new Set(seatOrder.filter((x: unknown): x is string => typeof x === "string"));
            }
          }
          const effectiveStatus = (c: { charId: string; status: string }): string =>
            seatedGameCharIds.has(c.charId) ? "online" : c.status;

          // ── Offline skip: if ALL characters are offline, don't generate ──
          // The user message is already saved. When the character comes back online,
          // the autonomous messaging system will trigger a catch-up generation.
          const allOffline =
            respondingConvoCharInfo.length > 0 &&
            respondingConvoCharInfo.every((c) => effectiveStatus(c) === "offline");
          if (allOffline && !input.regenerateMessageId && !input.impersonate) {
            reply.raw.write(`data: ${JSON.stringify({ type: "offline", characters: respondingConvoCharNames })}\n\n`);
            reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
            reply.raw.end();
            return;
          }

          // ── Typing delay: DND/idle characters don't respond instantly ──
          if (!input.regenerateMessageId && !input.impersonate && !input.skipPresenceDelay) {
            const schedSvc = await import("../services/conversation/schedule.service.js");
            // Check if any characters were @mentioned
            const hasMentions = requestedMentionNames.size > 0 || !!manualTargetCharId;
            // Use the "worst" (longest-delay) status among all characters
            const worstStatus = respondingConvoCharInfo.reduce((worst, c) => {
              const rank = { online: 0, idle: 1, dnd: 2, offline: 3 } as Record<string, number>;
              const cStatus = effectiveStatus(c);
              return (rank[cStatus] ?? 0) > (rank[worst] ?? 0) ? cStatus : worst;
            }, "online");
            // If user @mentioned a character, use reduced mention delay instead.
            // Otherwise use the slowest configured delay among the responding characters.
            const delayMs = hasMentions
              ? schedSvc.getMentionDelay(worstStatus as "online" | "idle" | "dnd" | "offline")
              : respondingConvoCharInfo.reduce((maxDelay, character) => {
                  const schedule = schedules[character.charId];
                  return Math.max(
                    maxDelay,
                    schedSvc.getDirectMessageDelay(
                      effectiveStatus(character) as "online" | "idle" | "dnd" | "offline",
                      schedule,
                    ),
                  );
                }, 0);
            if (delayMs > 0) {
              const characterStatuses = Object.fromEntries(
                respondingConvoCharInfo.map((character) => [character.charId, character.status]),
              );
              // Send "delayed" event first — client shows "will respond in a moment" / "when they're back"
              reply.raw.write(
                `data: ${JSON.stringify({
                  type: "delayed",
                  characters: respondingConvoCharNames,
                  characterIds: respondingConvoCharInfo.map((character) => character.charId),
                  characterStatuses,
                  status: worstStatus,
                  delayMs,
                })}\n\n`,
              );
              await new Promise<void>((resolve) => {
                if (abortController.signal.aborted) {
                  resolve();
                  return;
                }
                const timeout = setTimeout(resolve, delayMs);
                abortController.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timeout);
                    resolve();
                  },
                  { once: true },
                );
              });
              if (abortController.signal.aborted) return;

              // Re-read messages after the delay — the user may have sent
              // follow-up messages while the character was busy/idle.
              const refreshed = await chats.listMessages(input.chatId);
              let rStartIdx = 0;
              for (let i = refreshed.length - 1; i >= 0; i--) {
                const ex = parseExtra(refreshed[i]!.extra);
                if (ex.isConversationStart) {
                  rStartIdx = i;
                  break;
                }
              }
              const rScoped = rStartIdx > 0 ? refreshed.slice(rStartIdx) : refreshed;
              chatMessages = supportsHiddenFromAI ? rScoped.filter((m: any) => !isMessageHiddenFromAI(m)) : rScoped;
              if (contextMessageLimit && contextMessageLimit > 0 && chatMessages.length > contextMessageLimit) {
                chatMessages = chatMessages.slice(-contextMessageLimit);
              }
              finalMessages = chatMessages.map((m: any) => {
                const ex = parseExtra(m.extra);
                const att = ex.attachments as PromptAttachment[] | undefined;
                const imgs = extractImageAttachmentDataUrls(att);
                const files = extractFileAttachmentInputs(att);
                return {
                  role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
                  content: appendReadableAttachmentsToContent(conversationPromptHistoryContent(m, chatMode), att),
                  contextKind: "history" as const,
                  characterId: typeof m.characterId === "string" && m.characterId ? m.characterId : null,
                  ...(imgs?.length ? { images: imgs } : {}),
                  ...(files.length ? { files } : {}),
                };
              });
              finalMessages = resolveHistoryMessageMacros(finalMessages);
            }
            // Send "typing" event — client switches to "X is typing..."
            reply.raw.write(`data: ${JSON.stringify({ type: "typing", characters: respondingConvoCharNames })}\n\n`);
          }

          // For regenerations, skip the delay but still send the typing indicator
          if (input.regenerateMessageId) {
            reply.raw.write(`data: ${JSON.stringify({ type: "typing", characters: convoCharNames })}\n\n`);
          }

          const isGroup = convoCharNames.length > 1;

          // Inject timestamps: today's messages get [HH:MM] per message,
          // older messages are grouped by date inside <date="DD.MM.YYYY"> blocks.
          // The "day" boundary is shifted by dayRolloverHour so a late-night
          // session doesn't get split when calendar midnight passes.
          const nowInstant = new Date();
          const rolloverHour = Math.max(
            0,
            Math.min(11, Math.floor((chatMeta.dayRolloverHour as number | undefined) ?? 4)),
          );
          const isSameDay = (ts: Date) => isSameZonedLogicalDay(ts, nowInstant, promptTimeZone, rolloverHour);
          const fmtDate = (ts: Date) => formatZonedConversationDate(ts, promptTimeZone, rolloverHour);
          const todayDateKey = fmtDate(nowInstant);
          const fmtTime = (ts: Date) => formatZonedConversationTime(ts, promptTimeZone);

          // Strip leaked [HH:MM] or [DD.MM.YYYY] timestamps that models sometimes echo
          const stripLeakedTimestamps = stripConversationPromptTimestamps;

          // Build character name lookup for past-day author attribution
          const charIdToName = new Map<string, string>();
          for (let ci = 0; ci < characterIds.length; ci++) {
            if (convoCharInfo[ci]) charIdToName.set(characterIds[ci]!, convoCharInfo[ci]!.name);
          }

          // Annotate each message with its reactions so the responding character
          // perceives who reacted and with what. finalMessages[i] is index-aligned
          // with chatMessages[i] here (same invariant the bucket loop below relies
          // on); the note rides on the content through the formatting that follows.
          // "user" is the human reactor (matches the client USER_REACTOR sentinel);
          // any other id is a character.
          const reactorDisplayName = (reactorId: string): string =>
            reactorId === "user" ? personaName : (charIdToName.get(reactorId) ?? "a character");
          for (let i = 0; i < finalMessages.length; i++) {
            const raw = chatMessages[i];
            if (!raw) continue;
            const note = buildReactionAnnotation(parseExtra(raw.extra).reactions, reactorDisplayName);
            if (note) finalMessages[i]!.content += note;
          }

          // Separate into past-day groups and today's messages, preserving order
          type BucketMsg = { role: string; content: string; author: string; ts: Date };
          type Bucket = { date: string; msgs: BucketMsg[] };
          const buckets: Array<Bucket | { role: string; content: string }> = [];
          let currentBucket: Bucket | null = null;
          // Index of today's first verbatim message in the buckets array. Used
          // to splice the tail block in immediately before today begins.
          let firstTodayIdx: number | null = null;

          for (let i = 0; i < finalMessages.length; i++) {
            const msg = finalMessages[i]!;
            const raw = chatMessages[i];
            if (!raw?.createdAt || msg.role === "system") {
              // Flush open bucket
              if (currentBucket) {
                buckets.push(currentBucket);
                currentBucket = null;
              }
              buckets.push(msg);
              continue;
            }
            const ts = new Date(raw.createdAt as string);
            // Resolve author name for this message
            const author =
              msg.role === "user"
                ? personaName
                : ((raw.characterId ? charIdToName.get(raw.characterId as string) : null) ??
                  convoCharNames[0] ??
                  "Character");
            if (isSameDay(ts)) {
              // Flush open bucket
              if (currentBucket) {
                buckets.push(currentBucket);
                currentBucket = null;
              }
              if (firstTodayIdx === null) firstTodayIdx = buckets.length;
              const promptContent = formatConversationPromptTurn(
                stripLeakedTimestamps(msg.content),
                msg.role,
                personaName,
              );
              buckets.push({ ...msg, content: `[${fmtTime(ts)}] ${promptContent}` });
            } else {
              const dateKey = fmtDate(ts);
              if (currentBucket && currentBucket.date === dateKey) {
                currentBucket.msgs.push({ ...msg, content: stripLeakedTimestamps(msg.content), author, ts });
              } else {
                if (currentBucket) buckets.push(currentBucket);
                currentBucket = {
                  date: dateKey,
                  msgs: [{ ...msg, content: stripLeakedTimestamps(msg.content), author, ts }],
                };
              }
            }
          }
          if (currentBucket) buckets.push(currentBucket);

          // ── Auto-summarize missing past days and completed weeks ──
          // This scans the full scoped conversation, not the display/context-limited
          // prompt slice, so a failed day can still be retried after it ages out of
          // the latest visible window.
          const parseDateKey = parseConversationDateKey;
          const fmtDateKey = formatConversationDateKey;
          const summarySourceMessages = input.regenerateMessageId
            ? scopedMessages.filter((m: any) => m.id !== input.regenerateMessageId)
            : scopedMessages;
          const summaryProvider = createLLMProvider(
            conn.provider,
            baseUrl,
            conn.apiKey,
            conn.maxContext,
            conn.openrouterProvider,
            conn.maxTokensOverride,
          );
          const summaryRun = await generateMissingConversationSummaries({
            messages: summarySourceMessages,
            metadata: chatMeta,
            provider: summaryProvider,
            model: conn.model,
            personaName,
            charIdToName,
            now: nowInstant,
            rolloverHour,
            timeZone: promptTimeZone,
            maxMissingDays: 2,
          });
          for (const failure of summaryRun.failedDays) {
            logger.warn(
              { chatId: input.chatId, date: failure.date, err: failure.error },
              "[conversation-summary] failed to generate day summary",
            );
          }
          for (const failure of summaryRun.failedWeeks) {
            logger.warn(
              { chatId: input.chatId, weekKey: failure.weekKey, err: failure.error },
              "[conversation-summary] failed to consolidate week summary",
            );
          }

          const hasNewSummaries =
            Object.keys(summaryRun.newlyGeneratedDays).length > 0 ||
            Object.keys(summaryRun.newlyConsolidatedWeeks).length > 0;
          if (hasNewSummaries) {
            await chats.patchMetadata(input.chatId, (freshMeta) => {
              const existingDaySummaries = (freshMeta.daySummaries as Record<string, unknown> | undefined) ?? {};
              const existingWeekSummaries = (freshMeta.weekSummaries as Record<string, unknown> | undefined) ?? {};
              return {
                ...freshMeta,
                daySummaries: { ...existingDaySummaries, ...summaryRun.newlyGeneratedDays },
                weekSummaries: { ...existingWeekSummaries, ...summaryRun.newlyConsolidatedWeeks },
              };
            });
            chatMeta.daySummaries = {
              ...((chatMeta.daySummaries as Record<string, unknown> | undefined) ?? {}),
              ...summaryRun.newlyGeneratedDays,
            };
            chatMeta.weekSummaries = {
              ...((chatMeta.weekSummaries as Record<string, unknown> | undefined) ?? {}),
              ...summaryRun.newlyConsolidatedWeeks,
            };
          }

          const daySummaries = summaryRun.daySummaries;
          const weekSummaries = summaryRun.weekSummaries;

          // Build a lookup: dateKey → weekKey for days that belong to a consolidated week
          const dayToWeek = new Map<string, string>();
          for (const [weekKey] of Object.entries(weekSummaries)) {
            const monday = parseDateKey(weekKey);
            for (let i = 0; i < 7; i++) {
              const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
              dayToWeek.set(fmtDateKey(d), weekKey);
            }
          }

          // Collect all key details for persistent memory injection
          // Use week-level details for consolidated weeks, day-level for the rest
          const allKeyDetails: { label: string; details: string[] }[] = [];
          const weekDetailsEmitted = new Set<string>();
          // First: week summaries (chronological by week start)
          const sortedWeekKeys = Object.keys(weekSummaries).sort(
            (a, b) => parseDateKey(a).getTime() - parseDateKey(b).getTime(),
          );
          for (const wk of sortedWeekKeys) {
            const entry = weekSummaries[wk]!;
            if (entry.keyDetails.length > 0) {
              const monday = parseDateKey(wk);
              const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
              allKeyDetails.push({
                label: `Week of ${wk} – ${fmtDateKey(sunday)}`,
                details: entry.keyDetails,
              });
            }
            weekDetailsEmitted.add(wk);
          }
          // Then: non-consolidated day details
          for (const [date, entry] of Object.entries(daySummaries)) {
            if (dayToWeek.has(date)) continue; // covered by week summary
            if (entry.keyDetails.length > 0) {
              allKeyDetails.push({ label: date, details: entry.keyDetails });
            }
          }

          // Tail messages: pull the last N messages from past-summarized buckets
          // so the model has concrete recent dialogue to continue from, not just
          // the gist of yesterday's summary. Walks across day boundaries when
          // earlier buckets are short.
          const tailCount = Math.max(
            0,
            Math.min(50, Math.floor((chatMeta.summaryTailMessages as number | undefined) ?? 10)),
          );
          const tailEntries: BucketMsg[] = [];
          if (tailCount > 0) {
            outer: for (let bi = buckets.length - 1; bi >= 0; bi--) {
              const b = buckets[bi]!;
              if (!("date" in b && "msgs" in b)) continue;
              const bucket = b as Bucket;
              // Pull only from summarized past days. Today's messages are already
              // verbatim, and unsummarized past days will be emitted verbatim too,
              // so neither needs duplicating into a tail block.
              if (bucket.date === todayDateKey) continue;
              if (!daySummaries[bucket.date]) continue;
              for (let mi = bucket.msgs.length - 1; mi >= 0; mi--) {
                tailEntries.unshift(bucket.msgs[mi]!);
                if (tailEntries.length >= tailCount) break outer;
              }
            }
          }

          // Flatten: consolidated weeks → single <summary week="..."> block,
          // non-consolidated summarized days → <summary date="..."> block,
          // today → individual timestamped messages.
          // The tail block is spliced in at firstTodayIdx so it sits between
          // the last summary and today's first verbatim message.
          const weekBlocksEmitted = new Set<string>();
          const fmtTailPrefix = (ts: Date) => {
            const date = formatZonedConversationDate(ts, promptTimeZone).slice(0, 5);
            return `[${date} ${formatZonedConversationTime(ts, promptTimeZone)}]`;
          };
          const buildTailTurns = () => {
            if (tailEntries.length === 0) return [];
            // Match today's verbatim format: timestamp prefix, with user turns speaker-labeled.
            // The [DD.MM HH:MM] prefix unambiguously distinguishes tail turns
            // from today's [HH:MM] turns, so no wrapper tag is needed — the
            // model can see from the timestamps alone where today begins.
            return tailEntries.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: `${fmtTailPrefix(m.ts)} ${formatConversationPromptTurn(m.content, m.role, personaName)}`,
            }));
          };

          finalMessages = buckets.flatMap((b, bIdx) => {
            // Splice the tail in immediately before today's first verbatim
            // message. firstTodayIdx is null when today has no messages yet —
            // in that case we fall through to the post-loop append below.
            const prefix = bIdx === firstTodayIdx ? buildTailTurns() : [];

            if ("date" in b && "msgs" in b) {
              const bucket = b as Bucket;
              const weekKey = dayToWeek.get(bucket.date);

              // Day belongs to a consolidated week → emit one week summary block (first occurrence)
              if (weekKey && weekSummaries[weekKey]) {
                if (weekBlocksEmitted.has(weekKey)) return prefix; // already emitted for this week
                weekBlocksEmitted.add(weekKey);
                const wEntry = weekSummaries[weekKey]!;
                const monday = parseDateKey(weekKey);
                const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
                // Key details are surfaced separately via <important_memories> in the system prompt.
                return [
                  ...prefix,
                  {
                    role: "system" as const,
                    content: `<summary week="${weekKey} – ${fmtDateKey(sunday)}">\n${wEntry.summary}\n</summary>`,
                  },
                ];
              }

              // Non-consolidated day with a summary
              const entry = daySummaries[bucket.date];
              if (entry) {
                // Key details are surfaced separately via <important_memories> in the system prompt.
                return [
                  ...prefix,
                  {
                    role: "system" as const,
                    content: `<summary date="${bucket.date}">\n${entry.summary}\n</summary>`,
                  },
                ];
              }
              // Unsummarized past day — keep each message as its own turn
              const turns = bucket.msgs.map((m, idx) => {
                let content = `${m.author}: ${m.content}`;
                if (idx === 0) content = `<date="${bucket.date}">\n${content}`;
                if (idx === bucket.msgs.length - 1) content = `${content}\n</date>`;
                return { role: m.role as "user" | "assistant" | "system", content };
              });
              return [...prefix, ...turns];
            }
            return [...prefix, b as { role: "system" | "user" | "assistant"; content: string }];
          });

          // Edge case: today has no messages yet (firstTodayIdx is null).
          // Append the tail at the end so it still bridges into the upcoming
          // generation rather than being silently dropped.
          if (firstTodayIdx === null && tailEntries.length > 0) {
            finalMessages = [...finalMessages, ...buildTailTurns()];
          }

          // Build the system prompt
          // Use custom system prompt if set, otherwise the built-in default
          const customPrompt =
            typeof chatMeta.customSystemPrompt === "string" && chatMeta.customSystemPrompt.trim()
              ? (chatMeta.customSystemPrompt as string)
              : null;
          const selectedConversationPrompt =
            resolvedPreset && chatMode === "conversation"
              ? resolvePresetModePrompt(resolvedPreset as Record<string, unknown>, "conversation")
              : "";

          const earlyGroupResponseOrder = (chatMeta.groupResponseOrder as string) ?? "sequential";
          const earlyGroupMode =
            chatMode === "conversation"
              ? earlyGroupResponseOrder === "manual"
                ? "individual"
                : "merged"
              : ((chatMeta.groupChatMode as string) ?? "merged");
          const conversationPromptTemplate =
            customPrompt ?? (selectedConversationPrompt || DEFAULT_CONVERSATION_PROMPT);
          const renderedConversationPrompt = resolveMacros(
            conversationPromptTemplate
              .replace(/\{\{charName\}\}/g, charNameList)
              .replace(/\{\{userName\}\}/g, personaName),
            promptMacroContext,
          );
          const conversationInstructionParts = [unwrapConversationInstructions(renderedConversationPrompt)];

          if (isGroup && earlyGroupMode !== "individual") {
            conversationInstructionParts.push(
              [
                `This is a group DM. Each character responds in their own voice and personality. Not every character needs to respond every time; only those who would naturally react.`,
                `IMPORTANT: Prefix each character's line with their name. Example:`,
                `${convoCharNames[0] ?? "Alice"}: hey whats up`,
                `${convoCharNames[1] ?? "Bob"}: not much lol`,
                ``,
                `If a character sends multiple lines in a row, only prefix the first line:`,
                `${convoCharNames[0] ?? "Alice"}: so anyway`,
                `i was thinking about that`,
                `${convoCharNames[1] ?? "Bob"}: yeah?`,
              ].join("\n"),
            );
          } else if (isGroup && earlyGroupMode === "individual") {
            conversationInstructionParts.push(
              `This is a group DM. Each character responds in their own voice and personality. You will be told which character to respond as. Do NOT prefix your message with the character name; just respond naturally as that character.`,
            );
          }

          let conversationSystemPrompt = wrapConversationInstructions(
            conversationInstructionParts.filter((part) => part.trim().length > 0).join("\n\n"),
          );

          // ── Character Commands: build a commands block if any features are enabled ──
          if (conversationCommandsEnabled) {
            const scheduleCommandEnabled = isConversationCommandEnabled(chatMeta, "schedule_update");
            const crossPostCommandEnabled = isConversationCommandEnabled(chatMeta, "cross_post");
            const selfieCommandEnabled = isConversationCommandEnabled(chatMeta, "selfie");
            const memoryCommandEnabled = isConversationCommandEnabled(chatMeta, "memory");
            const sceneCommandEnabled = isConversationCommandEnabled(chatMeta, "scene");
            const musicCommandEnabled = isConversationCommandEnabled(chatMeta, "music");
            const hapticCommandEnabled = isConversationCommandEnabled(chatMeta, "haptic");
            const activeMusicCommandSource =
              input.musicPlayerEnabled === false
                ? null
                : input.musicPlayerSource === "youtube" || input.musicPlayerSource === "custom"
                  ? input.musicPlayerSource
                  : "spotify";

            // Discover other chats this character is in (for cross_post targets + memory targets)
            const allChatsForCrossPost = await chats.list();
            const crossPostTargets: string[] = [];
            const memoryTargetCharIds = new Set<string>();
            for (const c of allChatsForCrossPost) {
              if (c.id === input.chatId || c.mode !== "conversation") continue;
              const cCharIds: string[] =
                typeof c.characterIds === "string"
                  ? JSON.parse(c.characterIds as string)
                  : (c.characterIds as string[]);
              if (characterIds.some((id) => cCharIds.includes(id))) {
                crossPostTargets.push(c.name || c.id);
                // Collect character IDs from shared group chats (groups = 2+ characters)
                if (cCharIds.length > 1) {
                  for (const id of cCharIds) {
                    if (!characterIds.includes(id)) memoryTargetCharIds.add(id);
                  }
                }
              }
            }
            // Also check if the CURRENT chat is a group — characters in this chat can target each other
            if (characterIds.length > 1) {
              for (const id of characterIds) memoryTargetCharIds.add(id);
            }

            // Resolve memory target names
            const memoryTargetNames: string[] = [];
            for (const tid of memoryTargetCharIds) {
              const tRow = await chars.getById(tid);
              if (tRow) {
                const tData = JSON.parse(tRow.data as string);
                if (tData.name) memoryTargetNames.push(tData.name);
              }
            }

            // Check if selfie is enabled for this chat (user picked an image gen connection)
            const hasImageGen = !!chatMeta.imageGenConnectionId;
            let conversationSpotifyCommandsAvailable = false;
            let conversationYoutubeCommandsAvailable = false;
            if (chatMode === "conversation" && musicCommandEnabled && activeMusicCommandSource === "spotify") {
              try {
                const spotifyCredentials = await resolveSpotifyCredentials(agentsStore, { refreshSkewMs: 60_000 });
                if (
                  "accessToken" in spotifyCredentials &&
                  spotifyHasScope(spotifyCredentials.scopes, "user-modify-playback-state")
                ) {
                  conversationSpotifyCommandsAvailable = true;
                } else {
                  const spotifyReason =
                    "error" in spotifyCredentials
                      ? spotifyCredentials.error
                      : "missing user-modify-playback-state scope";
                  logger.debug("[spotify/conversation] Song command unavailable: %s", spotifyReason);
                }
              } catch (err) {
                logger.debug(err, "[spotify/conversation] Failed to check Spotify command availability");
              }
            } else if (chatMode === "conversation" && musicCommandEnabled && activeMusicCommandSource === "youtube") {
              conversationYoutubeCommandsAvailable = await isConversationYoutubeCommandAvailable(agentsStore);
            }

            const commandLines: string[] = [
              `<commands>`,
              `Here are your optional, hidden commands you may use if you wish to, but only when they genuinely fit the conversation:`,
              ``,
            ];
            let availableCommandCount = 0;
            const addCommandLines = (...lines: string[]) => {
              commandLines.push(...lines, ``);
              availableCommandCount += 1;
            };

            if (scheduleCommandEnabled) {
              addCommandLines(
                `- [schedule_update: status="online|idle|dnd|offline", activity="activity name", duration="number of hours (e.g., 1h)"] - only if you change your own status/activity, for example, if the user asks you to stop what you're doing or if you decide to change them yourself.`,
              );
            }

            if (crossPostCommandEnabled && crossPostTargets.length > 0) {
              addCommandLines(
                `- [cross_post: target="${crossPostTargets.map((t) => `"${t}"`).join("|")}"] - if you want to redirect your message to a different chat. Use this when the user suggests you say something in another chat, or when it makes sense to message someone else.`,
                ` Example: ${personaName} says "maybe ask about that in the group chat?" → You respond: [cross_post: target="${crossPostTargets[0] ?? "group chat"}"] Hey guys, does anyone know about…`,
              );
            }

            if (selfieCommandEnabled && hasImageGen) {
              addCommandLines(
                `- [selfie] or [selfie: context="description of what the selfie shows"] - you send a photo of yourself. Use this when the user asks for a selfie, photo, or pic, or when you want to share what you look like right now.`,
                `   If you say you are sending, sharing, taking, or attaching a selfie/photo/pic, include [selfie] in that same response. Do not only narrate the action.`,
              );
            }

            // Memory command — only available when there are valid targets (characters in shared group chats)
            if (memoryCommandEnabled && memoryTargetNames.length > 0) {
              addCommandLines(
                `- [memory: target="${memoryTargetNames.map((n) => `"${n}"`).join("|")}", summary="brief description of what happened"] - create a memory that another character will remember. Use this when something notable happens between you and another character that they would naturally remember (e.g., shared a meal, had an argument, made plans). Don't overuse this; only for genuinely memorable moments.`,
                `   Example: [memory: target="${memoryTargetNames[0]}", summary="watched a movie together and argued about the ending"]`,
              );
            }

            // Scene command — only in conversation mode
            if (sceneCommandEnabled && chatMode === "conversation") {
              addCommandLines(
                `- [scene: scenario="brief description of what happens in this scene", background="place"] - initiate a mini-roleplay scene branching from this conversation. The system will plan and create a complete immersive scene for you.`,
                `   Example: You agree to go stargazing → include [scene: scenario="lying on a blanket in the park, looking at the stars together", background="park"]`,
                `   WHEN TO USE: You SHOULD proactively trigger a scene whenever the conversation naturally leads to an activity, outing, or situation that would be more immersive as a scene. Examples:`,
                `   - {{user}} says "I'm coming over" or "Let's go to the park" → trigger a scene for arriving/being at that location.`,
                `   - You invite {{user}} somewhere and they accept → trigger a scene for that activity.`,
                `   - A plan is made (date, trip, hangout, confrontation) and the moment arrives → trigger a scene.`,
                `   Do NOT wait for {{user}} to explicitly ask for a scene. If the conversation implies you and {{user}} are about to DO something together, initiate the scene yourself.`,
                `   EXCEPTION: Do NOT start a scene for playing UNO, cards, or other board/table games — those have their own [uno] command. Use [uno], not [scene], for a game of UNO.`,
              );
            }

            // UNO turn-game — conversation mode only, when no game is running yet
            // and at least one other character is present to play with.
            if (
              chatMode === "conversation" &&
              isConversationCommandEnabled(chatMeta, "uno") &&
              characterIds.length >= 1 &&
              !(await getActiveTurnGame(app.db, input.chatId))
            ) {
              addCommandLines(
                `- [uno] - start a game of UNO at the table. Include this ONLY when ${personaName} proposes playing UNO (or cards) and you are willing to play right now. The system deals the cards and runs the game — you do NOT narrate dealing or describe the hands.`,
                `   If you are busy, tired, or simply don't feel like it, just say so in character and do NOT include [uno]. Agreeing to play IS including [uno].`,
                `   Example: ${personaName} says "anyone up for a round of uno?" and you're in → "Oh, you're SO on. [uno]"`,
              );
            }

            if (conversationSpotifyCommandsAvailable) {
              addCommandLines(
                `- [spotify: title="Song title", artist="Artist"] - only if you want to play a selected song on the user's active Spotify player. Use this sparingly, when the song choice genuinely fits the moment.`,
              );
            }

            if (conversationYoutubeCommandsAvailable) {
              addCommandLines(
                `- [youtube: query="Song title Artist"] - only if you want to play a selected song on the user's active YouTube player. Use this sparingly, when the song choice genuinely fits the moment.`,
              );
            }

            // Haptic command — only when devices are connected and haptic feedback is enabled
            const hapticEnabled = chatMeta.enableHapticFeedback === true;
            if (hapticCommandEnabled && hapticEnabled) {
              const { hapticService } = await import("../services/haptic/buttplug-service.js");
              // Auto-connect to Intiface Central if not already connected
              if (!hapticService.connected) {
                try {
                  await hapticService.connect(getChatHapticIntifaceUrl(chatMeta));
                } catch {
                  logger.warn("[haptic] Auto-connect to Intiface Central failed — is the server running?");
                }
              }
              if (hapticService.connected && hapticService.devices.length > 0) {
                const deviceNames = hapticService.devices.map((d) => d.name).join(", ");
                addCommandLines(
                  `- [haptic: action="vibrate|oscillate|rotate|position|stop", intensity=0.0-1.0, duration=seconds (0 = loop until next command)] or [haptic: action="stop"] - control or stop the user's connected intimate device(s) (${deviceNames}). Use this during physical/intimate/sensual moments to provide haptic feedback that matches the narrative. Vary intensity based on the scene.`,
                  `   You can include multiple [haptic] commands in one message for patterns (e.g., escalating: 0.2 → 0.5 → 0.8).`,
                  `   Example: *trails a finger slowly down your arm* [haptic: action="vibrate", intensity=0.3, duration=2]`,
                );
              }
            }

            if (availableCommandCount > 0) {
              commandLines.push(
                `IMPORTANT: Commands are stripped from your message before the user sees it. The rest of your message is shown normally. You can include multiple commands in one message, but you do not need to use any of them unless it makes sense in context.`,
                `</commands>`,
              );

              conversationCommandsReminder = resolvePromptMacros(commandLines.join("\n"));
            }
          }

          // ── React capability ──
          // Tell the character it can react to the user's latest message. Standard
          // emojis always work; any custom emojis are advertised in the shared
          // conversation asset context below. Whether
          // to react — and how warmly or dryly — is emergent from personality, not
          // dictated here.
          conversationSystemPrompt +=
            '\n\nYou can react to the user\'s most recent message with a single emoji by writing [react: emoji="😂"] on its own line — any standard emoji, or a custom one you have access to as [react: emoji=":name:"]. It posts as a small badge on their message, the way you\'d react in a chat app. Use it only when it genuinely fits how your character feels in the moment; it is optional, may stand alone or sit alongside your reply, and choosing a flat reaction or none at all is itself a valid choice.';
          // ── Home Professor Mari: inject assistant knowledge & commands ──
          if (isHomeProfessorMariAssistantChat) {
            conversationSystemPrompt += "\n\n" + MARI_ASSISTANT_PROMPT;

            // Inject names-only lists so Mari knows what's available (not full data)
            try {
              const allChars = await chars.list();
              const allPersonasList = await chars.listPersonas();
              const allLorebooks = await lorebooksStore.list();
              const allChats = await chats.list();
              const allPresets = await presets.list();

              const charNames = allChars
                .filter((c: any) => c.id !== PROFESSOR_MARI_ID)
                .map((c: any) => {
                  const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
                  return d.name;
                })
                .filter(Boolean);

              const personaNames = allPersonasList.map((p: any) => p.name).filter(Boolean);
              const lorebookNames = allLorebooks.map((lb: any) => lb.name).filter(Boolean);
              const chatNames = allChats
                .slice(0, 50)
                .map((c: any) => c.name)
                .filter(Boolean);
              const presetNames = (allPresets as any[]).map((preset: any) => preset.name).filter(Boolean);

              const namesSections: string[] = [];
              if (charNames.length > 0)
                namesSections.push(`<available_names type="character">\n${charNames.join(", ")}\n</available_names>`);
              if (personaNames.length > 0)
                namesSections.push(`<available_names type="persona">\n${personaNames.join(", ")}\n</available_names>`);
              if (lorebookNames.length > 0)
                namesSections.push(
                  `<available_names type="lorebook">\n${lorebookNames.join(", ")}\n</available_names>`,
                );
              if (chatNames.length > 0)
                namesSections.push(`<available_names type="chat">\n${chatNames.join(", ")}\n</available_names>`);
              if (presetNames.length > 0)
                namesSections.push(`<available_names type="preset">\n${presetNames.join(", ")}\n</available_names>`);

              if (namesSections.length > 0) {
                conversationSystemPrompt += "\n\n" + namesSections.join("\n\n");
              }
            } catch {
              // Non-critical — continue without name lists
            }

            // Inject previously fetched context from chatMeta.mariContext
            const mariContext = chatMeta.mariContext as Record<string, string> | undefined;
            if (mariContext && Object.keys(mariContext).length > 0) {
              const contextSections: string[] = [];
              for (const [key, value] of Object.entries(mariContext)) {
                contextSections.push(`<fetched_data key="${key}">\n${value}\n</fetched_data>`);
              }
              conversationSystemPrompt +=
                "\n\n<loaded_context>\nThe following items were previously fetched and are available for reference:\n\n" +
                contextSections.join("\n\n") +
                "\n</loaded_context>";
            }
          }

          // Build the context injection (last user-role message before generation)
          const timeStr = formatZonedConversationTime(nowInstant, promptTimeZone);
          const dateStr = formatZonedConversationDate(nowInstant, promptTimeZone);
          const dayName = getZonedWeekdayName(nowInstant, promptTimeZone);

          const scheduleLines: string[] = [];
          for (const c of convoCharInfo) {
            if (c.todaySchedule) {
              const prefix =
                convoCharInfo.length > 1
                  ? `${c.name}'s schedule today (${dayName}): `
                  : `Your schedule today (${dayName}): `;
              scheduleLines.push(prefix + c.todaySchedule);
            }
          }

          // Build status line for the context injection
          const statusLabels: Record<string, string> = {
            online: "online and active",
            idle: "idle / away",
            dnd: "busy / do not disturb",
            offline: "offline",
          };
          const buildCharStatus = (c: { name: string; status: string; activity: string }) => {
            const label = statusLabels[c.status] ?? "online and active";
            return c.activity ? `${label} (${c.activity})` : label;
          };
          const statusLine =
            convoCharInfo.length === 1
              ? buildCharStatus(convoCharInfo[0]!)
              : convoCharInfo.map((c) => `${c.name}: ${buildCharStatus(c)}`).join("; ");

          // Build user status label
          const userStatusLabels: Record<string, string> = {
            active: "active",
            idle: "idle / away from the computer",
            dnd: "do not disturb",
          };
          const shouldIncludeUserStatus = input.userStatus !== "invisible";
          const userStatusLabel = userStatusLabels[input.userStatus ?? "active"] ?? "active";
          const userActivity = input.userActivity?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
          const userStatusLine = userActivity ? `${userStatusLabel} - ${userActivity}` : userStatusLabel;

          // Build @mention line — tells the LLM which characters were directly pinged
          const mentionedNames = (input.mentionedCharacterNames ?? []).filter((n: string) =>
            convoCharInfo.some((c) => normalizeTextForMatch(c.name) === normalizeTextForMatch(n)),
          );
          let mentionLine: string | null = null;
          if (mentionedNames.length > 0) {
            if (convoCharInfo.length === 1) {
              mentionLine = `${personaName} @mentioned you directly — treat this as an urgent ping that demands your attention even if you are busy or away.`;
            } else {
              mentionLine = `${personaName} @mentioned: ${mentionedNames.join(", ")} — this is an urgent ping directed at ${mentionedNames.length === 1 ? "that person" : "those people"} specifically. The mentioned character(s) should feel compelled to respond promptly even if busy or away.`;
            }
          }

          const latestVisiblePromptTurn = [...finalMessages]
            .reverse()
            .find((message) => message.role === "user" || message.role === "assistant");
          const proactiveTurnLine =
            latestVisiblePromptTurn?.role === "assistant" && !input.userMessage?.trim()
              ? `No new message from ${personaName} was sent in this request; this is a proactive/autonomous turn. Do not write ${personaName}'s side of the conversation.`
              : null;
          const intentHint = isMessageIntent(input.autonomousIntentKey) ? getIntentHint(input.autonomousIntentKey) : "";

          const contextBlock = [
            `<context>`,
            `Your current status: ${statusLine}.`,
            ...(shouldIncludeUserStatus ? [`${personaName}'s status: ${userStatusLine}.`] : []),
            ...(proactiveTurnLine ? [proactiveTurnLine] : []),
            ...(mentionLine ? [mentionLine] : []),
            ...(intentHint ? [`What prompted this message: ${intentHint}`] : []),
            ...scheduleLines,
            `The current time and date: ${timeStr}, ${dateStr}.`,
            ...(isGroup && earlyGroupMode !== "individual"
              ? [`- Remember to prefix messages with \`Name: message\`!`]
              : []),
            `</context>`,
          ].join("\n");

          // ── Cross-chat awareness: show messages from other chats this character is in ──
          // (awarenessBlock is injected later, after persona info)
          const crossChatEnabled = chatMeta.crossChatAwareness !== false; // on by default
          if (crossChatEnabled && !input.regenerateMessageId) {
            const { buildAwarenessBlock } = await import("../services/conversation/awareness.service.js");
            const charNameMap = new Map<string, string>();
            for (let ci = 0; ci < characterIds.length; ci++) {
              if (convoCharInfo[ci]) charNameMap.set(characterIds[ci]!, convoCharInfo[ci]!.name);
            }
            convoAwarenessBlock = await buildAwarenessBlock(
              app.db,
              input.chatId,
              characterIds,
              charNameMap,
              personaName,
              input.userMessage ?? "",
              1500,
              promptTimeZone,
            );
          }

          // ── Connected chat context: inject linked roleplay/game details ──
          let connectedChatBlock: string | null = null;
          const connectedInfluenceCommandEnabled =
            conversationCommandsEnabled && isConversationCommandEnabled(chatMeta, "influence");
          const connectedNoteCommandEnabled =
            conversationCommandsEnabled && isConversationCommandEnabled(chatMeta, "note");
          if (chat.connectedChatId) {
            const connectedChat = await chats.getById(chat.connectedChatId as string);
            if (connectedChat && connectedChat.mode === "roleplay") {
              const rpMessages = await chats.listMessages(connectedChat.id);
              const recentRp = rpMessages.slice(-20);

              // Resolve character names for the RP
              const rpCharIds: string[] =
                typeof connectedChat.characterIds === "string"
                  ? JSON.parse(connectedChat.characterIds as string)
                  : (connectedChat.characterIds as string[]);
              const rpCharNames = new Map<string, string>();
              for (const cid of rpCharIds) {
                const row = await chars.getById(cid);
                if (row) {
                  const d = JSON.parse(row.data as string);
                  rpCharNames.set(cid, d.name ?? "Unknown");
                }
              }

              const rpLines: string[] = [`<connected_roleplay name="${connectedChat.name}">`];
              rpLines.push(`<recent_messages>`);
              for (const m of recentRp) {
                const speaker =
                  m.role === "user"
                    ? personaName
                    : m.characterId
                      ? (rpCharNames.get(m.characterId) ?? "Character")
                      : "Narrator";
                rpLines.push(`[${speaker}]: ${(m.content as string).slice(0, 500)}`);
              }
              rpLines.push(`</recent_messages>`);
              rpLines.push(`</connected_roleplay>`);

              connectedChatBlock = rpLines.join("\n");

              if (connectedInfluenceCommandEnabled || connectedNoteCommandEnabled) {
                const connectedInstructionLines = [
                  `<connected_roleplay_instructions>`,
                  `You have access to context from a connected roleplay: "${connectedChat.name}".`,
                  `Recent messages from that roleplay are provided so you can naturally reference or discuss events happening there.`,
                ];
                if (connectedInfluenceCommandEnabled) {
                  connectedInstructionLines.push(
                    ``,
                    `If something said in THIS conversation should affect or influence the roleplay, you can create an influence tag:`,
                    `<influence>description of what should happen or change in the roleplay based on this conversation</influence>`,
                    `Example: if the user says "tell ${rpCharNames.values().next().value ?? "them"} to meet us at the tavern", you could respond normally AND include:`,
                    `<influence>The group discussed meeting at the tavern. ${personaName} wants everyone to head there.</influence>`,
                    ``,
                    `Influences are injected into the roleplay's context before the next generation. Use them sparingly; only when conversation content genuinely should cross over into the roleplay.`,
                    `The influence tag is stripped from your visible message. The rest of your response is shown normally.`,
                  );
                }
                if (connectedNoteCommandEnabled) {
                  connectedInstructionLines.push(
                    ``,
                    `If something said in this conversation should durably persist in the roleplay's context across many turns (a fact the character should keep remembering, a promise made, a secret revealed, a name learned), create a note tag instead of an influence:`,
                    `<note>fact, decision, or detail the roleplay character should keep remembering</note>`,
                    `Notes are shown to the roleplay character on every future turn until the user clears them. Use influences for one-shot mid-scene steering; use notes for things that should remain true going forward. Use notes sparingly; every saved note costs prompt budget on every roleplay turn.`,
                    `The note tag is stripped from your visible message.`,
                  );
                }
                connectedInstructionLines.push(`</connected_roleplay_instructions>`);
                conversationSystemPrompt += "\n\n" + connectedInstructionLines.join("\n");
              }
            } else if (connectedChat && connectedChat.mode === "game") {
              const gameMeta =
                typeof connectedChat.metadata === "string"
                  ? JSON.parse(connectedChat.metadata)
                  : (connectedChat.metadata ?? {});
              const sessionNumber = (gameMeta.gameSessionNumber as number) ?? 1;
              const sessionStatus = (gameMeta.gameSessionStatus as string) ?? "setup";
              const activeState = (gameMeta.gameActiveState as string) ?? "exploration";
              const storedSummaries = Array.isArray(gameMeta.gamePreviousSessionSummaries)
                ? (gameMeta.gamePreviousSessionSummaries as Array<{
                    summary?: string;
                    resumePoint?: string;
                    partyDynamics?: string;
                    keyDiscoveries?: string[];
                  }>)
                : [];
              const latestSummary = storedSummaries[storedSummaries.length - 1] ?? null;
              const gameMessages = await chats.listMessages(connectedChat.id);
              const recentGame = gameMessages.slice(-20);
              const latestConnectedState =
                (await gameStateStore.getLatestCommitted(connectedChat.id)) ??
                (await gameStateStore.getLatest(connectedChat.id));
              const linkedGameState = latestConnectedState
                ? parseGameStateRow(latestConnectedState as Record<string, unknown>)
                : null;

              const gameLines: string[] = [`<connected_game name="${connectedChat.name}">`];
              gameLines.push(`<status>Session ${sessionNumber} (${sessionStatus}), state: ${activeState}</status>`);
              if (linkedGameState) {
                const sceneDetails = [
                  linkedGameState.location ? `Location: ${linkedGameState.location}` : null,
                  linkedGameState.time ? `Time: ${linkedGameState.time}` : null,
                  linkedGameState.date ? `Date: ${linkedGameState.date}` : null,
                  linkedGameState.weather ? `Weather: ${linkedGameState.weather}` : null,
                  linkedGameState.temperature ? `Temperature: ${linkedGameState.temperature}` : null,
                ].filter(Boolean);
                if (sceneDetails.length > 0) {
                  gameLines.push(`<scene>${sceneDetails.join(" | ")}</scene>`);
                }
                if (linkedGameState.presentCharacters.length > 0) {
                  gameLines.push(
                    `<present_characters>${linkedGameState.presentCharacters.map((c) => c.name).join(", ")}</present_characters>`,
                  );
                }
                if (linkedGameState.recentEvents.length > 0) {
                  gameLines.push(`<recent_events>`);
                  for (const event of linkedGameState.recentEvents.slice(-5)) {
                    gameLines.push(`- ${event.slice(0, 300)}`);
                  }
                  gameLines.push(`</recent_events>`);
                }
              }
              if (latestSummary?.summary) {
                gameLines.push(`<latest_session_summary>${latestSummary.summary}</latest_session_summary>`);
                if (latestSummary.resumePoint) {
                  gameLines.push(`<resume_point>${latestSummary.resumePoint}</resume_point>`);
                }
                if (latestSummary.partyDynamics) {
                  gameLines.push(`<party_dynamics>${latestSummary.partyDynamics}</party_dynamics>`);
                }
                if (Array.isArray(latestSummary.keyDiscoveries) && latestSummary.keyDiscoveries.length > 0) {
                  gameLines.push(`<key_discoveries>${latestSummary.keyDiscoveries.join("; ")}</key_discoveries>`);
                }
              }
              gameLines.push(`<recent_messages>`);
              for (const m of recentGame) {
                const speaker = m.role === "user" ? personaName : m.role === "narrator" ? "Narrator" : "Game Master";
                const content = sanitizeConnectedGameTranscript(m.content as string);
                if (!content) continue;
                gameLines.push(`[${speaker}]: ${content.slice(0, 500)}`);
              }
              gameLines.push(`</recent_messages>`);
              gameLines.push(`</connected_game>`);

              connectedChatBlock = gameLines.join("\n");

              if (connectedInfluenceCommandEnabled || connectedNoteCommandEnabled) {
                const connectedInstructionLines = [
                  `<connected_game_instructions>`,
                  `You have access to context from a connected game: "${connectedChat.name}".`,
                  `The current scene, session summary, and recent game messages are provided so you can naturally answer questions or comment on what is happening in that game.`,
                ];
                if (connectedInfluenceCommandEnabled) {
                  connectedInstructionLines.push(
                    ``,
                    `If something said in THIS conversation should affect or influence the game, you can create an influence tag:`,
                    `<influence>description of what should happen or change in the game based on this conversation</influence>`,
                    `Example: if the group agrees they want to visit the merchant district next, you could respond normally AND include:`,
                    `<influence>The group agreed they want to head to the merchant district next and look for supplies.</influence>`,
                    ``,
                    `Influences are injected into the game's context before the next generation. Use them sparingly; only when conversation content genuinely should cross over into the game.`,
                    `The influence tag is stripped from your visible message. The rest of your response is shown normally.`,
                  );
                }
                if (connectedNoteCommandEnabled) {
                  connectedInstructionLines.push(
                    ``,
                    `If something said in this conversation should durably persist in the game's context across many turns (an established world fact, an ongoing party dynamic, a recurring NPC trait, a secret the GM should keep remembering), create a note tag instead of an influence:`,
                    `<note>fact, decision, or detail the game should keep remembering</note>`,
                    `Notes are shown to the game on every future turn until the user clears them. Use influences for one-shot mid-scene steering; use notes for things that should remain true going forward. Use notes sparingly; every saved note costs prompt budget on every game turn.`,
                    `The note tag is stripped from your visible message.`,
                  );
                }
                connectedInstructionLines.push(`</connected_game_instructions>`);
                conversationSystemPrompt += "\n\n" + connectedInstructionLines.join("\n");
              }
            }
          }

          // Inject key details from past-day summaries as persistent memory
          if (allKeyDetails.length > 0) {
            // Sort chronologically so the model sees the most recent details last
            allKeyDetails.sort((a, b) => {
              // Parse the first date-like token from each label for ordering
              const extractDate = (s: string) => {
                const m = s.match(/(\d{2}\.\d{2}\.\d{4})/);
                return m ? parseDateKey(m[1]!).getTime() : 0;
              };
              return extractDate(a.label) - extractDate(b.label);
            });
            const memoryLines = [`<important_memories>`, `Things you must remember from past conversations:`];
            for (const { label, details } of allKeyDetails) {
              memoryLines.push(`[${label}]`);
              for (const d of details) memoryLines.push(`- ${d}`);
            }
            memoryLines.push(`</important_memories>`);
            conversationSystemPrompt += "\n\n" + memoryLines.join("\n");
          }

          conversationSystemPrompt = resolvePromptMacros(conversationSystemPrompt);

          finalMessages = [
            { role: "system" as const, content: conversationSystemPrompt },
            ...finalMessages,
            ...(connectedChatBlock ? [{ role: "user" as const, content: connectedChatBlock }] : []),
            { role: "user" as const, content: contextBlock },
          ];

          // ── Lorebook injection for conversation mode ──
          {
            sendProgress("lorebooks");
            const lorebookResult = await processLorebooks(app.db, toLorebookScanMessages(), null, {
              chatId: input.chatId,
              characterIds: promptCharacterIds,
              personaId,
              activeLorebookIds: chatActiveLorebookIds,
              excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
              excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
              tokenBudget: resolveLorebookTokenBudget(chatMeta),
              chatEmbedding: chatContextEmbedding,
              entryStateOverrides:
                (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
                undefined,
              entryTimingStates: (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
              generationTriggers: lorebookGenerationTriggers,
              resolveContent: resolvePromptMacrosForLorebook,
            });
            lorebookScanSnapshot = toLorebookScanSnapshot(lorebookResult);
            rememberKnowledgeRouterActivatedLorebookIds(
              knowledgeRouterActivatedLorebookEntryIds,
              knowledgeRouterExcludedLorebookEntryIds,
              lorebookResult,
            );
            knowledgeRouterActivationPassCompleted = true;

            if (lorebookResult.updatedEntryStateOverrides)
              chatMeta.entryStateOverrides = lorebookResult.updatedEntryStateOverrides;
            if (lorebookResult.updatedEntryTimingStates)
              chatMeta.entryTimingStates = lorebookResult.updatedEntryTimingStates;
            await persistLorebookRuntimeState({
              chats,
              chatId: input.chatId,
              fallbackMeta: chatMeta,
              entryStateOverrides: lorebookResult.updatedEntryStateOverrides,
              entryTimingStates: lorebookResult.updatedEntryTimingStates,
            });
            const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
              .filter(Boolean)
              .join("\n");
            if (loreContent) {
              const loreBlock = `<lore>\n${loreContent}\n</lore>`;
              // Inject before the awareness block (or before first user/assistant message)
              const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
              const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
              finalMessages.splice(insertAt, 0, { role: "system" as const, content: loreBlock });
            }
            // Inject depth-based lorebook entries into the message array
            if (lorebookResult.depthEntries.length > 0) {
              finalMessages = injectAtDepth(finalMessages, lorebookResult.depthEntries);
            }
          }
        }

        // ── Lorebook injection for preset-less roleplay / visual_novel ──
        // Conversation mode handles this above; game mode handles it below;
        // preset-driven chats get lorebook content via the preset assembler.
        if (!presetId && (chatMode === "roleplay" || chatMode === "visual_novel")) {
          sendProgress("lorebooks");
          const lorebookResult = await processLorebooks(app.db, toLorebookScanMessages(), null, {
            chatId: input.chatId,
            characterIds: promptCharacterIds,
            personaId,
            activeLorebookIds: chatActiveLorebookIds,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            tokenBudget: resolveLorebookTokenBudget(chatMeta),
            chatEmbedding: chatContextEmbedding,
            entryStateOverrides:
              (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
              undefined,
            entryTimingStates: (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
            generationTriggers: lorebookGenerationTriggers,
            resolveContent: resolvePromptMacrosForLorebook,
          });
          lorebookScanSnapshot = toLorebookScanSnapshot(lorebookResult);
          rememberKnowledgeRouterActivatedLorebookIds(
            knowledgeRouterActivatedLorebookEntryIds,
            knowledgeRouterExcludedLorebookEntryIds,
            lorebookResult,
          );
          knowledgeRouterActivationPassCompleted = true;

          if (lorebookResult.updatedEntryStateOverrides)
            chatMeta.entryStateOverrides = lorebookResult.updatedEntryStateOverrides;
          if (lorebookResult.updatedEntryTimingStates)
            chatMeta.entryTimingStates = lorebookResult.updatedEntryTimingStates;
          await persistLorebookRuntimeState({
            chats,
            chatId: input.chatId,
            fallbackMeta: chatMeta,
            entryStateOverrides: lorebookResult.updatedEntryStateOverrides,
            entryTimingStates: lorebookResult.updatedEntryTimingStates,
          });
          const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
            .filter(Boolean)
            .join("\n");
          if (loreContent) {
            const loreBlock = `<lore>\n${loreContent}\n</lore>`;
            const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
            const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
            finalMessages.splice(insertAt, 0, { role: "system" as const, content: loreBlock });
          }
          if (lorebookResult.depthEntries.length > 0) {
            finalMessages = injectAtDepth(finalMessages, lorebookResult.depthEntries);
          }
        }

        if (!presetId && chatMode !== "game") {
          const characterDepthEntries = await collectCharacterDepthPromptEntries(
            app.db,
            promptCharacterIds,
            promptMacroContext,
          );
          if (characterDepthEntries.length > 0) {
            finalMessages = injectAtDepth(finalMessages, characterDepthEntries);
          }
        }

        // ── Author's Notes injection ──
        const authorNotes = (chatMeta.authorNotes as string | undefined)?.trim();
        if (authorNotes) {
          const authorNotesDepth = (chatMeta.authorNotesDepth as number) ?? 4;
          finalMessages = injectAtDepth(finalMessages, [
            { content: authorNotes, role: "system", depth: authorNotesDepth },
          ]);
        }

        // ── Roleplay/Game: inject pending OOC influences from connected conversation ──
        // Skip OOC injection entirely for scene chats — scenes are self-contained
        const isSceneChat = chatMeta.sceneStatus === "active";
        if ((chatMode === "roleplay" || chatMode === "game") && chat.connectedChatId && !isSceneChat) {
          const pendingInfluences = await chats.listPendingInfluences(input.chatId);
          if (pendingInfluences.length > 0) {
            const influenceLines = pendingInfluences
              .map((inf: any) => stripConversationPromptTimestamps(String(inf.content ?? "")))
              .filter((content: string) => content.length > 0)
              .map((content: string) => `- ${content}`);

            if (influenceLines.length > 0) {
              const influenceBlock = [
                `<ooc_influences>`,
                chatMode === "game"
                  ? `The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside the game. Use them to steer the next scene, NPC reactions, objectives, or world state when appropriate — don't mention them explicitly as "OOC" in the narrative.`
                  : `The following out-of-character notes come from a connected conversation. They represent things the players discussed or decided outside of the roleplay. Weave them naturally into the story — don't mention them explicitly as "OOC" in the narrative.`,
                ...influenceLines,
                `</ooc_influences>`,
              ].join("\n");

              // Inject before the last user message
              const lastUserIdx = finalMessages.map((m) => m.role).lastIndexOf("user");
              if (lastUserIdx >= 0) {
                finalMessages.splice(lastUserIdx, 0, { role: "system" as const, content: influenceBlock });
              } else {
                finalMessages.push({ role: "system" as const, content: influenceBlock });
              }
            }

            // Mark influences as consumed
            for (const inf of pendingInfluences) {
              await chats.markInfluenceConsumed(inf.id);
            }
          }
        }

        // ── Roleplay/Game: inject durable conversation notes (persist until cleared) ──
        // Same scene bypass as influences — scenes are self-contained.
        if ((chatMode === "roleplay" || chatMode === "game") && chat.connectedChatId && !isSceneChat) {
          const persistentNotes = await chats.listNotes(input.chatId);
          if (persistentNotes.length > 0) {
            const noteLines = persistentNotes
              .map((n: any) => stripConversationPromptTimestamps(String(n.content ?? "")))
              .filter((content: string) => content.length > 0)
              .map((content: string) => `- ${content}`);

            if (noteLines.length > 0) {
              const noteBlock = [
                `<conversation_notes>`,
                chatMode === "game"
                  ? `Durable notes from a connected conversation. These persist across every turn until the user clears them and represent things the players have established as ongoing truth — character knowledge, world facts, recurring dynamics. Use them to inform NPC behavior, world state, and scene framing — don't reference them explicitly as "notes" in the narrative.`
                  : `Durable notes from a connected conversation. These persist across every turn until the user clears them and represent things the character has been told to durably remember about themselves, the user, or the world. Use them to inform behavior, knowledge, and reactions naturally — don't reference them explicitly as "notes" in the narrative.`,
                ...noteLines,
                `</conversation_notes>`,
              ].join("\n");

              // Inject before the last user message (parallel to the influence block)
              const lastUserIdx = finalMessages.map((m) => m.role).lastIndexOf("user");
              if (lastUserIdx >= 0) {
                finalMessages.splice(lastUserIdx, 0, { role: "system" as const, content: noteBlock });
              } else {
                finalMessages.push({ role: "system" as const, content: noteBlock });
              }
            }
          }
        }

        if (chatMode === "roleplay" && chat.connectedChatId && !isSceneChat) {
          // Add <ooc> instruction: characters can post comments to the connected conversation
          const convChat = await chats.getById(chat.connectedChatId as string);
          if (convChat && convChat.mode === "conversation") {
            const oocInstruction = [
              `<ooc_instruction>`,
              `You have a connected out-of-character conversation: "${convChat.name}".`,
              `If a character wants to break the fourth wall and comment on something happening in the roleplay, post a reaction, or chat casually with the user "outside" the story, they can use an <ooc> tag:`,
              `<ooc>casual comment or reaction about what just happened in the RP</ooc>`,
              ``,
              `The <ooc> text is stripped from the roleplay response and posted as a message in the conversation chat.`,
              `Use this very sparingly — only when a character would genuinely want to comment out-of-character. Most RP responses should NOT include <ooc> tags.`,
              `</ooc_instruction>`,
            ].join("\n");

            // Inject early in the messages (after the first system message)
            const firstSysIdx = finalMessages.findIndex((m) => m.role === "system");
            if (firstSysIdx >= 0) {
              finalMessages.splice(firstSysIdx + 1, 0, { role: "system" as const, content: oocInstruction });
            } else {
              finalMessages.unshift({ role: "system" as const, content: oocInstruction });
            }
          }
        }

        // ── Connection defaults + per-chat overrides (Chat Settings → Advanced Parameters) ──
        const connectionParams = parseStoredGenerationParameters(conn.defaultParameters);
        const chatParams = parseStoredGenerationParameters(chatMeta.chatParameters);

        const applyParameterOverrides = (params: typeof connectionParams) => {
          if (!params) return;
          if (typeof params.temperature === "number") temperature = params.temperature;
          if (typeof params.maxTokens === "number") maxTokens = params.maxTokens;
          topP = normalizeChatTopP(params.topP) ?? topP;
          if (typeof params.topK === "number") topK = params.topK;
          if (typeof params.minP === "number") minP = params.minP;
          if (typeof params.frequencyPenalty === "number") frequencyPenalty = params.frequencyPenalty;
          if (typeof params.presencePenalty === "number") presencePenalty = params.presencePenalty;
          if (typeof params.showThoughts === "boolean") showThoughts = params.showThoughts;
          if (params.reasoningEffort !== undefined) reasoningEffort = params.reasoningEffort;
          if (params.verbosity !== undefined) verbosity = params.verbosity;
          if (params.serviceTier !== undefined) serviceTier = normalizeServiceTier(params.serviceTier);
          if (typeof params.assistantPrefill === "string") assistantPrefill = params.assistantPrefill;
          if (params.customThinkingTags !== undefined) {
            customThinkingTags = normalizeThinkingTagPairs(params.customThinkingTags);
          }
          customParameters = mergeCustomParameters(customParameters, params.customParameters);
          if (params.enabledParameters) enabledParameters = { ...(enabledParameters ?? {}), ...params.enabledParameters };
          if (Array.isArray(params.stopSequences)) {
            stopSequences = params.stopSequences.map((value) => value.trim()).filter((value) => value.length > 0);
          }

          effectiveMaxContext = mergeModelContextLimit(
            modelAccessPolicy,
            effectiveMaxContext,
            resolveStoredModelContextLimit(modelAccessPolicy, params),
          );
        };

        // Scene chats use roleplay-friendly defaults before applying user overrides
        if (isSceneChat) {
          maxTokens = 8192;
          reasoningEffort = "maximum";
          verbosity = "high";
        }

        const isLocalGemma = (conn.model ?? "").toLowerCase().includes("gemma");
        // Connection defaults are the user's selected defaults for this model.
        // Apply them after preset assembly so Roleplay presets don't mask saved
        // output length/reasoning defaults, then let per-chat overrides win below.
        applyParameterOverrides(connectionParams);
        applyParameterOverrides(chatParams);

        // Game mode: force optimal generation defaults after Advanced Parameters
        // so leftover chat/connection overrides cannot sabotage structured GM output.
        if (chatMode === "game" && !isLocalGemma) {
          temperature = 1;
          maxTokens = 16_384;
          topP = 1;
          topK = 0;
          minP = 0;
          frequencyPenalty = 0;
          presencePenalty = 0;
          reasoningEffort = "maximum";
          verbosity = null;
        } else if (chatMode === "game") {
          // Local Gemma: just ensure generous output unless the chat set its own budget.
          if (typeof chatParams?.maxTokens !== "number") {
            maxTokens = Math.max(maxTokens, 16_384);
          }
        }

        if (chatMode === "game") {
          maxTokens = clampGenerationMaxOutputTokens({
            provider: conn.provider,
            model: conn.model,
            maxTokens: Math.max(maxTokens, 16_384),
            maxTokensOverride: conn.maxTokensOverride,
          });
        }

        const modelLower = (conn.model ?? "").toLowerCase();
        const providerLower = (conn.provider ?? "").toLowerCase();

        // Resolve "xhigh" and "maximum" reasoning effort to provider-facing levels.
        // Native Anthropic/Claude subscription adaptive-only models use "max";
        // OpenAI-compatible Claude routes keep "xhigh". All other models get "high".
        let resolvedEffort: "low" | "medium" | "high" | "xhigh" | "max" | null =
          reasoningEffort !== "maximum" ? reasoningEffort : null;
        const supportsXhigh = supportsXhighReasoningEffort(modelLower);
        if (reasoningEffort === "xhigh" && !supportsXhigh) {
          resolvedEffort = "high";
        }
        if (reasoningEffort === "maximum") {
          const isNativeAnthropicAdaptiveOnly =
            (providerLower === "anthropic" || providerLower === "claude_subscription") &&
            isClaudeAdaptiveOnlyNoSamplingModel(modelLower);
          resolvedEffort = isNativeAnthropicAdaptiveOnly ? "max" : supportsXhigh ? "xhigh" : "high";
        }

        const isXaiAutoReasoningModel =
          (providerLower === "xai" && (modelLower.startsWith("grok-4.3") || modelLower.startsWith("grok-4-1-fast"))) ||
          (providerLower === "openrouter" && modelLower.startsWith("x-ai/grok-"));
        if (isXaiAutoReasoningModel) {
          resolvedEffort = null;
        }

        // When reasoning effort is set, enable thinking so thoughts are captured/displayed
        if (resolvedEffort && !showThoughts) {
          showThoughts = true;
        }

        // enableThinking tells providers to activate reasoning mode (e.g. Anthropic
        // extended thinking, Gemini thinkingConfig). Only true when the user has
        // explicitly requested reasoning via reasoningEffort — showThoughts alone
        // just controls whether thinking tokens are *displayed*, not whether
        // reasoning mode is activated.
        const enableThinking = !!resolvedEffort;

        // ── Claude 4.5+ sampling parameter restrictions ──
        const modelLc = (conn.model ?? "").toLowerCase();

        // Claude adaptive-only models: ALL sampling params removed (temperature, top_p, top_k
        // return 400). Strip everything regardless of provider (covers reverse proxies).
        const isClaudeNoSampling = isClaudeAdaptiveOnlyNoSamplingModel(modelLc);
        if (isClaudeNoSampling) {
          temperature = undefined;
          topP = undefined;
          topK = 0;
          frequencyPenalty = 0;
          presencePenalty = 0;
        }

        // Claude 4.5/4.6: only temperature is supported — strip other sampling params.
        const isClaudeTemperatureOnly =
          !isClaudeNoSampling &&
          (/claude-(opus|sonnet)-4-[56]/.test(modelLc) || /claude-(opus|sonnet)-4\.[56]/.test(modelLc));
        if (isClaudeTemperatureOnly) {
          topP = undefined;
          topK = 0;
          frequencyPenalty = 0;
          presencePenalty = 0;
        }
        const providerTopK = resolveProviderTopK(conn.provider, topK);

        // Create provider
        const provider = createLLMProvider(
          conn.provider,
          baseUrl,
          conn.apiKey,
          conn.maxContext,
          conn.openrouterProvider,
          conn.maxTokensOverride,
          conn.claudeFastMode === "true",
          conn.treatAsLocalEndpoint === "true",
        );

        const chatConnectionMaxParallelJobs = Number(conn.maxParallelJobs) || 1;
        const chatConnectionKnownModel = findKnownModel(conn.provider as APIProvider, conn.model.trim());
        const chatConnectionMaxOutputTokens =
          chatConnectionKnownModel?.maxOutput && chatConnectionKnownModel.maxOutput > 0
            ? Math.floor(chatConnectionKnownModel.maxOutput)
            : null;
        const { enabledConfigs, resolvedAgents, agentConnectionWarnings } = await resolveAgentPipelineAgents({
          connections,
          configuredAgents: configuredPromptAgents,
          chatId: input.chatId,
          chatEnableAgents,
          hasPerChatAgentList,
          perChatAgentSet,
          agentPromptTemplateSelections,
          chatProvider: provider,
          chatModel: conn.model,
          chatCustomParameters: connectionParams?.customParameters ?? {},
          chatMaxOutputTokens: chatConnectionMaxOutputTokens,
          chatMaxParallelJobs: chatConnectionMaxParallelJobs,
          activeMusicPlayerSource,
          chatMetadata: chatMeta,
          resolveBaseUrl,
        });

        const builtInAgentTypes = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));
        const userMessagesSinceLastAgentRun = async (agentType: string) => {
          const lastRun = await agentsStore.getLastSuccessfulRunByType(agentType, input.chatId);
          if (!lastRun) return Number.POSITIVE_INFINITY;

          const lastRunIdx = allChatMessages.findIndex((message: any) => message.id === lastRun.messageId);
          if (lastRunIdx < 0) return Number.POSITIVE_INFINITY;

          return allChatMessages.slice(lastRunIdx + 1).filter((message: any) => message.role === "user").length;
        };

        for (let index = resolvedAgents.length - 1; index >= 0; index--) {
          const agent = resolvedAgents[index]!;
          if (builtInAgentTypes.has(agent.type)) continue;

          const activation = matchCustomAgentActivation(agent.settings, chatMessages);
          if (activation.configured && !activation.matched) {
            logger.debug(
              "[agents] Skipping custom agent %s because no activation keywords matched in the last %d messages",
              agent.type,
              activation.scanDepth,
            );
            resolvedAgents.splice(index, 1);
            continue;
          }

          const runInterval = Number(agent.settings.runInterval ?? 0);
          if (!Number.isFinite(runInterval) || runInterval <= 1) continue;

          const userMessageCount = await userMessagesSinceLastAgentRun(agent.type);
          if (userMessageCount < runInterval) {
            logger.debug(
              "[agents] Skipping custom agent %s until cadence threshold: %d/%d user messages",
              agent.type,
              userMessageCount,
              runInterval,
            );
            resolvedAgents.splice(index, 1);
          }
        }

        const charInfo = await loadCharacterPromptInfo({ chars, characterIds, chatMode });
        for (const character of charInfo) {
          const resolveCharacterPromptText = (value: string): string =>
            resolveHistoryMessageMacros([{ content: value, characterId: character.id }])[0]?.content ?? value;
          character.description = resolveCharacterPromptText(character.description);
          character.personality = resolveCharacterPromptText(character.personality);
          character.scenario = resolveCharacterPromptText(character.scenario);
          character.creatorNotes = resolveCharacterPromptText(character.creatorNotes);
          character.systemPrompt = resolveCharacterPromptText(character.systemPrompt);
          character.backstory = resolveCharacterPromptText(character.backstory);
          character.appearance = resolveCharacterPromptText(character.appearance);
          character.mesExample = resolveCharacterPromptText(character.mesExample);
          character.firstMes = resolveCharacterPromptText(character.firstMes);
          character.postHistoryInstructions = resolveCharacterPromptText(character.postHistoryInstructions);
        }
        const characterMacroProfilesById = buildCharacterMacroProfilesById(charInfo);

        // ── Custom emoji/sticker assets: advertise available tokens to Conversation responders ──
        if (chatMode === "conversation") {
          const mentionedNames = new Set(
            (input.mentionedCharacterNames ?? [])
              .map((name: string) => normalizeTextForMatch(name))
              .filter((name: string) => name.length > 0),
          );
          const scopedResponders = promptTargetCharacterId
            ? charInfo.filter((character) => character.id === promptTargetCharacterId)
            : mentionedNames.size > 0
              ? charInfo.filter((character) => mentionedNames.has(normalizeTextForMatch(character.name)))
              : charInfo;
          const respondingConversationChars = (scopedResponders.length > 0 ? scopedResponders : charInfo).map(
            (character) => ({
              charId: character.id,
              name: character.name,
            }),
          );

          const [globalEmojiRows, globalStickerRows, personaAssetRows] = await Promise.all([
            customEmojisStore.list(),
            customStickersStore.list(),
            personaId ? personaGallery.listByPersonaId(personaId) : Promise.resolve([]),
          ]);
          for (const emoji of globalEmojiRows) {
            if (emoji.name && emoji.filePath) {
              conversationCustomEmojiUrlByName.set(
                buildConversationCustomEmojiKey("global", null, String(emoji.name)),
                buildGlobalCustomEmojiUrl(String(emoji.filePath)),
              );
            }
          }
          if (personaId) {
            for (const img of personaAssetRows) {
              if (img.customKind === "emoji" && img.customName && img.filePath) {
                conversationCustomEmojiUrlByName.set(
                  buildConversationCustomEmojiKey("persona", personaId, img.customName),
                  buildPersonaGalleryEmojiUrl(personaId, getStoredFilename(String(img.filePath))),
                );
              }
            }
          }
          const personaEmojiNames = uniqueEmojiNames(
            personaAssetRows
              .filter((img) => img.customKind === "emoji" && img.customName)
              .map((img) => img.customName as string),
          );
          const personaStickerNames = uniqueEmojiNames(
            personaAssetRows
              .filter((img) => img.customKind === "sticker" && img.customName)
              .map((img) => img.customName as string),
          );
          const sharedEmojiNames = uniqueEmojiNames([
            ...personaEmojiNames,
            ...globalEmojiRows.map((emoji) => emoji.name as string),
          ]);
          const sharedStickerNames = uniqueEmojiNames([
            ...personaStickerNames,
            ...globalStickerRows.map((sticker) => sticker.name as string),
          ]);
          const ownEmojisByChar = new Map<string, string[]>();
          const ownStickersByChar = new Map<string, string[]>();
          for (const info of respondingConversationChars) {
            const images = await characterGallery.listByCharacterId(info.charId);
            const emojiNames = uniqueEmojiNames(
              images
                .filter((img) => img.customKind === "emoji" && img.customName)
                .map((img) => img.customName as string),
            );
            for (const img of images) {
              if (img.customKind === "emoji" && img.customName && img.filePath) {
                conversationCustomEmojiUrlByName.set(
                  img.customName,
                  buildCharacterGalleryEmojiUrl(info.charId, getStoredFilename(String(img.filePath))),
                );
              }
            }
            const stickerNames = uniqueEmojiNames(
              images
                .filter((img) => img.customKind === "sticker" && img.customName)
                .map((img) => img.customName as string),
            );
            if (emojiNames.length > 0) ownEmojisByChar.set(info.charId, emojiNames);
            if (stickerNames.length > 0) ownStickersByChar.set(info.charId, stickerNames);
          }

          const assetQuery = latestHistoryUserContent(finalMessages) || currentUserInputContent() || "";

          if (sharedEmojiNames.length > 0 || ownEmojisByChar.size > 0) {
            const emojiPrefs = normalizeCustomEmojiSelection(chatMeta.customEmojiSelection);
            let emojiAdvertisement: string | null = null;
            let toolSelectionHandled = false;

            // Tool-call mode (single responder only): one model call picks from the full candidate set.
            if (
              emojiPrefs.mode === "tool-call" &&
              emojiPrefs.toolConnectionId &&
              respondingConversationChars.length === 1
            ) {
              const responder = respondingConversationChars[0]!;
              const candidates = uniqueEmojiNames([
                ...(ownEmojisByChar.get(responder.charId) ?? []),
                ...sharedEmojiNames,
              ]);
              const picked = await selectCustomAssetNamesByToolCall(
                "emoji",
                ":name:",
                candidates,
                assetQuery,
                emojiPrefs.toolConnectionId,
                connections,
                emojiPrefs.maxCount,
              );
              if (picked !== null) {
                toolSelectionHandled = true;
                if (picked.length > 0) {
                  emojiAdvertisement = buildCustomEmojiAdvertisement(
                    respondingConversationChars,
                    [],
                    new Map([[responder.charId, picked]]),
                    emojiPrefs.maxCount,
                  );
                }
              }
            }

            // Random/semantic — and the fallback when tool-call is unset, multi-responder, or failed.
            if (!toolSelectionHandled && !emojiAdvertisement) {
              const orderedShared = await orderEmojiNames(sharedEmojiNames, emojiPrefs, assetQuery);
              const orderedOwnByChar = new Map<string, string[]>();
              for (const [charId, names] of ownEmojisByChar) {
                orderedOwnByChar.set(charId, await orderEmojiNames(names, emojiPrefs, assetQuery));
              }
              emojiAdvertisement = buildCustomEmojiAdvertisement(
                respondingConversationChars,
                orderedShared,
                orderedOwnByChar,
                emojiPrefs.maxCount,
              );
            }

            if (emojiAdvertisement) appendToFirstSystemMessage(finalMessages, emojiAdvertisement);
          }

          if (sharedStickerNames.length > 0 || ownStickersByChar.size > 0) {
            const stickerPrefs = normalizeCustomEmojiSelection(chatMeta.customEmojiSelection);
            let stickerAdvertisement: string | null = null;
            let toolSelectionHandled = false;

            if (
              stickerPrefs.mode === "tool-call" &&
              stickerPrefs.toolConnectionId &&
              respondingConversationChars.length === 1
            ) {
              const responder = respondingConversationChars[0]!;
              const candidates = uniqueEmojiNames([
                ...(ownStickersByChar.get(responder.charId) ?? []),
                ...sharedStickerNames,
              ]);
              const picked = await selectCustomAssetNamesByToolCall(
                "sticker",
                "sticker:name:",
                candidates,
                assetQuery,
                stickerPrefs.toolConnectionId,
                connections,
                stickerPrefs.maxCount,
              );
              if (picked !== null) {
                toolSelectionHandled = true;
                if (picked.length > 0) {
                  stickerAdvertisement = buildCustomStickerAdvertisement(
                    respondingConversationChars,
                    [],
                    new Map([[responder.charId, picked]]),
                    stickerPrefs.maxCount,
                  );
                }
              }
            }

            if (!toolSelectionHandled && !stickerAdvertisement) {
              const orderedShared = await orderEmojiNames(sharedStickerNames, stickerPrefs, assetQuery);
              const orderedOwnByChar = new Map<string, string[]>();
              for (const [charId, names] of ownStickersByChar) {
                orderedOwnByChar.set(charId, await orderEmojiNames(names, stickerPrefs, assetQuery));
              }
              stickerAdvertisement = buildCustomStickerAdvertisement(
                respondingConversationChars,
                orderedShared,
                orderedOwnByChar,
                stickerPrefs.maxCount,
              );
            }

            if (stickerAdvertisement) appendToFirstSystemMessage(finalMessages, stickerAdvertisement);
          }
        }

        let resolvedGameDiscordSpeakerName: string | null = null;
        let gameDiscordSpeakerResolved = false;

        const resolveGameDiscordSpeakerName = async (): Promise<string> => {
          if (gameDiscordSpeakerResolved) {
            return resolvedGameDiscordSpeakerName ?? "Narrator";
          }

          gameDiscordSpeakerResolved = true;
          const gmMode = typeof earlyMeta.gameGmMode === "string" ? earlyMeta.gameGmMode : "";
          const gmCharacterId =
            typeof earlyMeta.gameGmCharacterId === "string" && earlyMeta.gameGmCharacterId.trim()
              ? earlyMeta.gameGmCharacterId.trim()
              : null;

          if (chatMode === "game" && gmMode === "character" && gmCharacterId) {
            const knownCharacter = charInfo.find((character) => character.id === gmCharacterId);
            if (knownCharacter?.name) {
              resolvedGameDiscordSpeakerName = knownCharacter.name;
              return knownCharacter.name;
            }

            const gmRow = await chars.getById(gmCharacterId);
            if (gmRow) {
              try {
                const gmData = JSON.parse(gmRow.data as string);
                if (typeof gmData.name === "string" && gmData.name.trim()) {
                  const gmName = gmData.name.trim();
                  resolvedGameDiscordSpeakerName = gmName;
                  return gmName;
                }
              } catch {
                /* ignore malformed GM card data */
              }
            }
          }

          resolvedGameDiscordSpeakerName = "Narrator";
          return "Narrator";
        };

        if (shouldInjectIdentityFallback({ chatMode, presetId })) {
          injectIdentityFallbackMessages({
            messages: finalMessages,
            charInfo,
            promptTargetCharacterId,
            promptMacroContext,
            wrapFormat,
            personaName,
            personaDescription,
            personaFields,
            persona,
            resolvePromptMacros,
          });
        }

        if (isSceneChat) {
          injectSceneContextMessages({ messages: finalMessages, chatMetadata: chatMeta, charInfo, personaName });
        }

        if (chatMode === "game") {
          const selectedGamePrompt =
            resolvedPreset && presetId
              ? resolvePresetModePrompt(resolvedPreset as Record<string, unknown>, "game")
              : "";
          const gamePromptMetadata =
            selectedGamePrompt &&
            !(typeof chatMeta.gameSystemPrompt === "string" && chatMeta.gameSystemPrompt.trim().length > 0)
              ? { ...chatMeta, gameSystemPrompt: selectedGamePrompt }
              : chatMeta;
          const { gmCtx, gameActiveState, sessionNumber, gameTurnNumber, gameTime, gameMap, hasSceneModel } =
            await injectGameGmPromptRuntime({
              messages: finalMessages,
              chatId: input.chatId,
              chat,
              chatMetadata: gamePromptMetadata,
              characterIds,
              chars,
              chats,
              selectedGameStateSnapshotPromise,
              mappedMessages,
              personaName,
              resolvePromptMacros,
            });

          // ── Lorebook injection for game mode ──
          if (!presetHandledLorebooks) {
            sendProgress("lorebooks");
            const lorebookResult = await processLorebooks(
              app.db,
              toLorebookScanMessages(),
              await selectedGameStateForPrompt(),
              {
                chatId: input.chatId,
                characterIds,
                personaId,
                activeLorebookIds: chatActiveLorebookIds,
                excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
                excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
                tokenBudget: resolveLorebookTokenBudget(chatMeta),
                chatEmbedding: chatContextEmbedding,
                entryStateOverrides:
                  (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
                  undefined,
                entryTimingStates:
                  (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
                generationTriggers: lorebookGenerationTriggers,
                resolveContent: resolvePromptMacrosForLorebook,
              },
            );
            lorebookScanSnapshot = toLorebookScanSnapshot(lorebookResult);
            rememberKnowledgeRouterActivatedLorebookIds(
              knowledgeRouterActivatedLorebookEntryIds,
              knowledgeRouterExcludedLorebookEntryIds,
              lorebookResult,
            );
            knowledgeRouterActivationPassCompleted = true;

            if (lorebookResult.updatedEntryStateOverrides)
              chatMeta.entryStateOverrides = lorebookResult.updatedEntryStateOverrides;
            if (lorebookResult.updatedEntryTimingStates)
              chatMeta.entryTimingStates = lorebookResult.updatedEntryTimingStates;
            await persistLorebookRuntimeState({
              chats,
              chatId: input.chatId,
              fallbackMeta: chatMeta,
              entryStateOverrides: lorebookResult.updatedEntryStateOverrides,
              entryTimingStates: lorebookResult.updatedEntryTimingStates,
            });
            const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
              .filter(Boolean)
              .join("\n");
            if (loreContent) {
              const loreBlock = `<lore>\n${loreContent}\n</lore>`;
              // Append lore to the GM system prompt
              const sysMsg = finalMessages.find((m) => m.role === "system");
              if (sysMsg) {
                sysMsg.content += "\n\n" + loreBlock;
              } else {
                finalMessages.unshift({ role: "system" as const, content: loreBlock });
              }
            }
            if (lorebookResult.depthEntries.length > 0) {
              finalMessages = injectAtDepth(finalMessages, lorebookResult.depthEntries);
            }
          }

          // LOG_LEVEL=debug or Settings -> Advanced -> Debug mode: log game-mode prompt details.
          if (isDebug || requestDebug) {
            const gameSystemChars = finalMessages
              .filter((message) => message.role === "system")
              .reduce((total, message) => total + message.content.length, 0);
            const gameHistoryMessages = finalMessages.filter(
              (message) => message.role === "user" || message.role === "assistant",
            ).length;
            debugLog(
              "[debug/game] GM prompt assembled before final format reminder: systemChars=%d, historyMessages=%d, messages=%d. Full provider prompt is logged once by [debug] Prompt sent to model.",
              gameSystemChars,
              gameHistoryMessages,
              finalMessages.length,
            );
            debugLog(
              "[debug/game] GM context: storyArc=%s, map=%s, npcs=%d, widgets=%s, hasSceneModel=%s, state=%s",
              !!gmCtx.storyArc,
              !!gmCtx.map,
              gmCtx.npcs.length,
              !!gmCtx.hudWidgets?.length,
              gmCtx.hasSceneModel,
              gmCtx.gameActiveState,
            );
          }

          // Inject the output format + commands as the last user message so they
          // sit closest to generation in the model's attention window.
          // Detect special address prefixes from the latest user message so the
          // prompt block is only sent when actually relevant.
          const latestUserMsg = [...finalMessages].reverse().find((m) => m.role === "user");
          const latestUserContent = latestUserMsg?.content.trimStart() ?? "";
          const addressMode = latestUserContent.startsWith("[To the party]")
            ? "party"
            : latestUserContent.startsWith("[To the GM]")
              ? "gm"
              : undefined;
          const playerDiceRollSubmitted = /\[dice\b/i.test(latestUserContent);
          const formatReminder = resolvePromptMacros(
            buildGmFormatReminder({
              hasSceneModel,
              hudWidgets: gmCtx.hudWidgets,
              turnNumber: gameTurnNumber,
              gameActiveState: gameActiveState as import("@marinara-engine/shared").GameActiveState,
              sessionNumber,
              gameTime,
              map: gameMap,
              partyNames: gmCtx.partyNames,
              playerName: gmCtx.playerName,
              characterSprites: gmCtx.characterSprites,
              language: gmCtx.language,
              rating: gmCtx.rating,
              gameSpecialInstructions: gmCtx.gameSpecialInstructions,
              canGenerateBackgrounds: gmCtx.canGenerateBackgrounds,
              artStylePrompt: gmCtx.artStylePrompt,
              addressMode,
              playerDiceRollSubmitted,
              playerInventory: (() => {
                try {
                  const inv = (chatMeta.gameInventory as Array<{ name: string; quantity: number }>) ?? [];
                  return inv.length > 0 ? inv : undefined;
                } catch {
                  return undefined;
                }
              })(),
            }),
          );
          finalMessages.push({ role: "user" as const, content: formatReminder });
          logger.debug(
            "[generate/game] Injected format reminder (%d chars) as last user message",
            formatReminder.length,
          );
        }

        if (chatMode === "conversation") {
          convoAwarenessBlock = await mergeConversationCharacterMemories({
            chars,
            characterIds,
            awarenessBlock: convoAwarenessBlock,
          });
        }

        // ── Inject cross-chat awareness (after persona info so it appears right before chat history) ──
        if (convoAwarenessBlock) {
          const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
          const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
          finalMessages.splice(insertAt, 0, { role: "system", content: convoAwarenessBlock });
        }

        // ── Memory recall: semantic retrieval of relevant past conversation fragments ──
        // Default: on for conversation mode and scene chats, off for roleplay (opt-in via chat settings)
        const memoryRecallDefault = chatMode === "conversation" || isSceneChat;
        const enableMemoryRecall =
          chatMeta.enableMemoryRecall !== undefined ? chatMeta.enableMemoryRecall === true : memoryRecallDefault;
        if (enableMemoryRecall && memoryRecallVectorizerAvailable) {
          await injectMemoryRecallContext({
            db: app.db,
            messages: finalMessages,
            currentInputMessages: currentInputMessages(),
            chatId: input.chatId,
            embeddingSource: memoryRecallEmbeddingSource,
            contextLimit: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
            sendProgress,
            signal: abortController.signal,
          });
        }

        if (chatMode === "conversation" && conversationCommandsReminder && !input.impersonate) {
          finalMessages.push({ role: "user" as const, content: conversationCommandsReminder });
          logger.debug(
            "[generate/conversation] Injected commands reminder (%d chars) as last user message",
            conversationCommandsReminder.length,
          );
        }

        const roleplayDmCommandsEnabled =
          (chatMode === "roleplay" || chatMode === "visual_novel") &&
          chatMeta.roleplayDmCommandsEnabled === true &&
          !input.impersonate;
        if (roleplayDmCommandsEnabled) {
          const dmTargetHint =
            charInfo
              .map((character) => character.name.replace(/"/g, "'"))
              .filter(Boolean)
              .join(" | ") || "character name";
          const dmCommandReminder = resolvePromptMacros(
            [
              `<dm_commands>`,
              `Optional hidden command, use only when it naturally fits the scene:`,
              `- [dm: character="${dmTargetHint}" message="short text"] - only if a roleplay character sends {{user}} a direct message through a phone, communicator, letter app, terminal, or similar in-world channel. Marinara strips the command from the roleplay reply and posts the full message into the linked conversation when one exists; otherwise it creates a new DM conversation with that character.`,
              `Only use one of the listed character names/IDs. Do not use this command for incidental NPCs without a character card.`,
              `Do not also quote the exact same direct-message text in the roleplay narration unless the user should see it in both places.`,
              `</dm_commands>`,
            ].join("\n"),
          );
          const lastUserIdx = findLastIndex(finalMessages, "user");
          if (lastUserIdx >= 0) {
            const target = finalMessages[lastUserIdx]!;
            finalMessages[lastUserIdx] = { ...target, content: `${target.content}\n\n${dmCommandReminder}` };
          } else {
            finalMessages.push({ role: "user" as const, content: dmCommandReminder });
          }
          logger.debug(
            "[generate/roleplay] Injected DM command reminder (%d chars) into last user message",
            dmCommandReminder.length,
          );
        }

        if (input.continueMessageId) {
          finalMessages.push({ role: "user" as const, content: CONTINUE_ASSISTANT_MESSAGE_PROMPT });
          logger.debug(
            "[generate] Injected continuation prompt for assistant message %s",
            input.continueMessageId,
          );
        }

        // ── Group chat processing ──
        const isGroupChat = characterIds.length > 1;
        const groupResponseOrder = (chatMeta.groupResponseOrder as string) ?? "sequential";
        // Conversation mode stays merged by default, but Manual uses the same individual
        // one-character-at-a-time trigger path as roleplay.
        const groupChatMode =
          chatMode === "conversation"
            ? groupResponseOrder === "manual"
              ? "individual"
              : "merged"
            : ((chatMeta.groupChatMode as string) ?? "merged");
        // Auto-enable speaker colors for conversation mode groups (system prompt already requests tags)
        const groupSpeakerColors = chatMeta.groupSpeakerColors === true || (chatMode === "conversation" && isGroupChat);
        const groupTurnPromptEnabled = chatMeta.groupTurnPromptEnabled !== false;

        if (isGroupChat && chatMode !== "conversation") {
          // Strip <speaker> tags from history to save tokens in roleplay mode.
          // Just remove the tags, keep the dialogue content as-is.
          const speakerCloseRegex = /<\/speaker>/g;
          for (let i = 0; i < finalMessages.length; i++) {
            const msg = finalMessages[i]!;
            if (msg.role === "system") continue;
            if (msg.content.includes("<speaker=")) {
              let converted = msg.content;
              converted = converted.replace(/<speaker="[^"]*">/g, "");
              converted = converted.replace(speakerCloseRegex, "");
              converted = converted.replace(/^\s*\n/gm, "").trim();
              finalMessages[i] = { ...msg, content: converted };
            }
          }
        }

        if (isGroupChat) {
          // Inject group chat instructions at the end of the last user message
          const groupInstructions: string[] = [];

          if (groupChatMode === "merged" && groupSpeakerColors && chatMode !== "conversation") {
            const charNames = charInfo.map((c) => c.name);
            groupInstructions.push(
              `- Since this is a group chat, wrap each character's dialogue in <speaker="name"> tags. Tags can appear inline with narration, they don't need to be on separate lines. Example: <speaker="${charNames[0] ?? "John"}">"Hello there,"</speaker> [action beat/dialogue tag].`,
            );
          }

          if (groupChatMode === "individual" && !input.regenerateMessageId) {
            // targetCharName is set later in the multi-char loop; for now placeholder
            // The actual injection happens per-character in the generation loop below
          }

          if (groupInstructions.length > 0) {
            const rawBlock = groupInstructions.join("\n");
            const instructionBlock = wrapFormat === "markdown" ? `\n## Group Chat\n${rawBlock}` : rawBlock;

            // Inject into the <output_format> section if present, otherwise append to last user message
            injectIntoOutputFormatOrLastUser(finalMessages, instructionBlock, { indent: true });
          }
        }

        // Get current game state (if any)
        // Prefer committed game state after a real user turn, but keep visible
        // uncommitted tracker edits authoritative for continue/impersonate flows.
        // Regenerate uses the previous assistant's tracker snapshot as the prompt baseline.
        const latestGameState = await selectedGameStateSnapshotPromise;
        const baseGameStateSnapshot = latestGameState;
        const allowLatestGameStateFallback = !input.regenerateMessageId;
        const gameState = latestGameState ? parseGameStateRow(latestGameState as Record<string, unknown>) : null;

        // Build base agent context (without mainResponse — that comes after generation)
        // Fetch enough history for the hungriest agent — individual agents trim to their own contextSize.
        const agentContextSize =
          resolvedAgents.length > 0
            ? Math.max(...resolvedAgents.map((a) => normalizeAgentContextSize(a.settings.contextSize)))
            : 5;
        const agentSlice = chatMessages.slice(-agentContextSize);
        const resolvedAgentSlice = resolveHistoryMessageMacros(
          agentSlice.map((message: any) => ({
            ...message,
            content: conversationPromptHistoryContent(message, chatMode),
            characterId: typeof message.characterId === "string" && message.characterId ? message.characterId : null,
          })),
        );

        // Batch-fetch committed game state snapshots for assistant messages in the agent context
        const committedSnapshots = await gameStateStore.getCommittedForMessages(
          agentSlice.filter((m: any) => m.role === "assistant"),
        );
        const visibleHistorySnapshot =
          latestGameState &&
          visibleGameStateAnchor &&
          latestGameState.messageId === visibleGameStateAnchor.messageId &&
          latestGameState.swipeIndex === visibleGameStateAnchor.swipeIndex
            ? latestGameState
            : null;

        const recentMsgs = agentSlice.map((m: any, index: number) => {
          const resolved = resolvedAgentSlice[index];
          const msg: AgentContext["recentMessages"][number] = {
            id: typeof m.id === "string" ? m.id : undefined,
            role: m.role as string,
            content: resolved?.content ?? (m.content as string),
            characterId: m.characterId ?? undefined,
          };
          if (m.role === "assistant") {
            const messageSwipeIndex =
              typeof m.activeSwipeIndex === "number" && Number.isInteger(m.activeSwipeIndex) && m.activeSwipeIndex >= 0
                ? m.activeSwipeIndex
                : 0;
            const snapRow =
              visibleHistorySnapshot &&
              m.id === visibleHistorySnapshot.messageId &&
              messageSwipeIndex === visibleHistorySnapshot.swipeIndex
                ? visibleHistorySnapshot
                : committedSnapshots.get(m.id as string);
            if (snapRow) {
              msg.gameState = parseGameStateRow(snapRow as Record<string, unknown>);
            }
          }
          return msg;
        });
        const resolvePersonaPromptText = (value?: string): string | undefined => {
          if (!value) return value;
          return resolveHistoryMessageMacros([{ content: value, characterId: null }])[0]?.content ?? value;
        };

        const agentContext: AgentContext = {
          chatId: input.chatId,
          chatMode,
          wrapFormat,
          recentMessages: recentMsgs,
          mainResponse: null,
          gameState,
          characters: charInfo,
          persona:
            personaName !== "User"
              ? {
                  name: personaName,
                  description: resolvePersonaPromptText(personaDescription) ?? "",
                  personality: resolvePersonaPromptText(personaFields.personality) || undefined,
                  backstory: resolvePersonaPromptText(personaFields.backstory) || undefined,
                  appearance: resolvePersonaPromptText(personaFields.appearance) || undefined,
                  scenario: resolvePersonaPromptText(personaFields.scenario) || undefined,
                  ...(persona?.personaStats
                    ? (() => {
                        let pStats: any;
                        try {
                          pStats =
                            typeof persona.personaStats === "string"
                              ? JSON.parse(persona.personaStats)
                              : persona.personaStats;
                        } catch {
                          return {};
                        }
                        // Merge current values from gameState so the agent sees
                        // live stats instead of the persona's default config.
                        if (pStats?.bars && gameState?.personaStats && Array.isArray(gameState.personaStats)) {
                          const currentByName = new Map(
                            (gameState.personaStats as Array<{ name: string; value: number }>).map((s) => [
                              s.name,
                              s.value,
                            ]),
                          );
                          pStats.bars = pStats.bars.map((bar: any) => ({
                            ...bar,
                            value: currentByName.has(bar.name) ? currentByName.get(bar.name) : bar.value,
                          }));
                        }
                        // Only include enabled bars
                        if (pStats && !pStats.enabled) delete pStats.bars;
                        const result: Record<string, unknown> = { personaStats: pStats };
                        if (pStats?.rpgStats?.enabled) {
                          result.rpgStats = pStats.rpgStats;
                        }
                        return result;
                      })()
                    : {}),
                }
              : null,
          memory: {},
          activatedLorebookEntries: null,
          writableLorebookIds: null,
          chatSummary: activeChatSummary,
          streaming: input.streaming,
          ...(requestDebug
            ? {
                agentDebug: (event: AgentCallDebugEvent) => {
                  trySendSseEvent(reply, { type: "agent_debug", data: event });
                },
              }
            : {}),
          signal: abortController.signal,
        };

        if (personaId) {
          agentContext.memory._personaId = personaId;
          agentContext.memory._personaAvatarPath =
            persona && typeof persona.avatarPath === "string" ? persona.avatarPath : null;
        }
        const getLatestUserExpressionSource = () =>
          (
            [...agentContext.recentMessages]
              .reverse()
              .find((message) => message.role === "user" && message.content.trim())?.content ??
            currentUserInputContent() ??
            input.userMessage ??
            ""
          ).trim();

        const directorAgent = resolvedAgents.find((a) => a.type === "director");
        let directorSecretPlotAgent: ResolvedAgent | null = null;
        let directorSecretPlotMemory: Record<string, unknown> = {};
        let directorSecretPlotRunInterval = DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL;
        let shouldRunDirectorSecretPlot = false;
        if (directorAgent) {
          const secretPlotEnabled = resolveDirectorSecretPlotEnabled(directorAgent.settings, chatMeta, chatMode);
          directorSecretPlotRunInterval = resolveDirectorSecretPlotRunInterval(directorAgent.settings, chatMeta);
          directorAgent.settings = {
            ...directorAgent.settings,
            secretPlotEnabled,
            secretPlotRunInterval: directorSecretPlotRunInterval,
          };
          if (secretPlotEnabled) {
            directorSecretPlotAgent = { ...directorAgent };
            try {
              directorSecretPlotMemory = await agentsStore.getMemory(directorAgent.id, input.chatId);
              const state = buildSecretPlotStateFromMemory(directorSecretPlotMemory);
              if (Object.keys(state).length > 0) {
                agentContext.memory._secretPlotState = state;
              }
              shouldRunDirectorSecretPlot =
                !input.regenerateMessageId &&
                shouldRunDirectorSecretPlotMaintenance({
                  memory: directorSecretPlotMemory,
                  runInterval: directorSecretPlotRunInterval,
                  messages: allChatMessages,
                });
            } catch (err) {
              logger.warn(err, "[narrative-director] Failed to load secret plot memory");
              shouldRunDirectorSecretPlot = !input.regenerateMessageId;
            }
          }
          if (!requestedNarrativeDirectorMode) {
            resolvedAgents.splice(resolvedAgents.indexOf(directorAgent), 1);
          } else {
            directorAgent.settings = {
              ...directorAgent.settings,
              directorMode: requestedNarrativeDirectorMode,
            };
          }
        }

        const illustratorAgentForInterval = resolvedAgents.find((a) => a.type === "illustrator");
        if (
          illustratorAgentForInterval &&
          (await shouldSkipAgentByAssistantInterval({
            agentsStore,
            chatId: input.chatId,
            agentType: "illustrator",
            settings: illustratorAgentForInterval.settings,
            fallbackInterval: (getDefaultBuiltInAgentSettings("illustrator").runInterval as number) ?? 5,
            messages: allChatMessages,
          }))
        ) {
          resolvedAgents.splice(resolvedAgents.indexOf(illustratorAgentForInterval), 1);
        }

        // Populate writable lorebook IDs for the lorebook-keeper agent
        if (resolvedAgents.some((a) => a.type === "lorebook-keeper")) {
          const { writableLorebookIds, targetLorebookId, targetLorebookName } = await resolveLorebookKeeperTarget({
            lorebooksStore,
            chatId: input.chatId,
            characterIds,
            personaId,
            activeLorebookIds: chatActiveLorebookIds,
            preferredTargetLorebookId: lorebookKeeperSettings.targetLorebookId,
          });
          agentContext.writableLorebookIds = writableLorebookIds;
          if (targetLorebookId) {
            agentContext.memory._lorebookKeeperTargetLorebookId = targetLorebookId;
          }
          if (targetLorebookName) {
            agentContext.memory._lorebookKeeperTargetLorebookName = targetLorebookName;
          }

          // ── Interval gating: only run every N assistant messages ──
          const lkAgent = resolvedAgents.find((a) => a.type === "lorebook-keeper")!;
          const runInterval = (lkAgent.settings.runInterval as number) ?? 8;
          const lastRun = await agentsStore.getLastSuccessfulRunByType("lorebook-keeper", input.chatId);
          const pendingLorebookMessages = getLorebookKeeperAutomaticPendingCount(
            lorebookKeeperMessages,
            lorebookKeeperSettings.readBehindMessages,
            lastRun?.messageId ?? null,
          );
          const historicalLorebookTarget = getLorebookKeeperAutomaticTarget(
            lorebookKeeperMessages,
            lorebookKeeperSettings.readBehindMessages,
          );
          if (lorebookKeeperSettings.readBehindMessages > 0 && !historicalLorebookTarget) {
            resolvedAgents.splice(resolvedAgents.indexOf(lkAgent), 1);
          } else if (runInterval > 1 && pendingLorebookMessages < runInterval) {
            // Not enough canon messages since the last successful run — remove from pipeline.
            resolvedAgents.splice(resolvedAgents.indexOf(lkAgent), 1);
          }

          // ── Feed existing target-lorebook entries to the agent for deduplication ──
          if (resolvedAgents.some((a) => a.type === "lorebook-keeper")) {
            try {
              const existingEntries = await loadLorebookKeeperExistingEntries(lorebooksStore, targetLorebookId);
              if (existingEntries.length > 0) {
                agentContext.memory._existingLorebookEntries = existingEntries;
              }
            } catch {
              /* non-critical */
            }
          }
        }

        // If the expression agent is enabled, load available sprite expressions per character
        if (resolvedAgents.some((a) => a.type === "expression")) {
          try {
            const spriteDisplayModes = normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes);
            const selectedSpriteIds = new Set(
              Array.isArray(chatMeta.spriteCharacterIds)
                ? chatMeta.spriteCharacterIds.filter((id): id is string => typeof id === "string")
                : [],
            );
            const restrictToSelectedSprites = selectedSpriteIds.size > 0;
            const perChar: Array<{
              characterId: string;
              characterName: string;
              expressions: string[];
              expressionChoices?: string[];
            }> = [];
            for (const char of agentContext.characters) {
              if (restrictToSelectedSprites && !selectedSpriteIds.has(char.id)) continue;
              const sprites = listCharacterSprites(char.id);
              if (!sprites) continue;
              const spriteCharacter = buildAvailableSpriteCharacter(char.id, char.name, sprites, spriteDisplayModes);
              if (spriteCharacter) perChar.push(spriteCharacter);
            }
            const includePersonaSprite =
              !!personaId &&
              (Boolean(getLatestUserExpressionSource()) ||
                !restrictToSelectedSprites ||
                selectedSpriteIds.has(personaId) ||
                chatMeta.expressionAvatarsEnabled === true);
            if (personaId && includePersonaSprite) {
              const sprites = listCharacterSprites(personaId);
              if (sprites) {
                const spritePersona = buildAvailableSpriteCharacter(
                  personaId,
                  personaName,
                  sprites,
                  spriteDisplayModes,
                );
                if (spritePersona) perChar.push(spritePersona);
              }
            }
            if (perChar.length > 0) {
              agentContext.memory._availableSprites = perChar;
            }
          } catch {
            /* non-critical */
          }
        }

        // If the background agent is enabled, load available backgrounds + tags into context
        const backgroundAgent = resolvedAgents.find((a) => a.type === "background");
        if (backgroundAgent) {
          agentContext.memory._availableBackgrounds = [];
          agentContext.memory._currentBackground = chatMeta.background ?? null;
          if (backgroundAgent.settings?.autoGenerateBackgrounds === true) {
            agentContext.memory._backgroundGenerationEnabled = true;
          }
          if (backgroundAgent.settings?.autoGenerateBackgrounds === true) {
            const setupConfigForBackground =
              chatMeta.gameSetupConfig &&
              typeof chatMeta.gameSetupConfig === "object" &&
              !Array.isArray(chatMeta.gameSetupConfig)
                ? (chatMeta.gameSetupConfig as Record<string, unknown>)
                : null;
            agentContext.memory._backgroundWorldContext = {
              genre: (setupConfigForBackground?.genre as string | undefined) ?? null,
              setting: (setupConfigForBackground?.setting as string | undefined) ?? null,
              location: gameState?.location ?? null,
              weather: gameState?.weather ?? null,
              timeOfDay: gameState?.time ?? null,
              worldOverview: (chatMeta.gameWorldOverview as string | undefined) ?? null,
            };
          }
          try {
            const { readdirSync, readFileSync, existsSync } = await import("fs");
            const { join, extname } = await import("path");
            const bgDir = join(DATA_DIR, "backgrounds");
            if (existsSync(bgDir)) {
              const exts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
              const files = readdirSync(bgDir).filter((f: string) => exts.has(extname(f).toLowerCase()));

              // Load metadata (tags + original names)
              let meta: Record<string, { originalName?: string; tags: string[] }> = {};
              const metaPath = join(bgDir, "meta.json");
              if (existsSync(metaPath)) {
                try {
                  meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                } catch {
                  /* */
                }
              }

              agentContext.memory._availableBackgrounds = files.map((f: string) => ({
                filename: f,
                originalName: meta[f]?.originalName ?? null,
                tags: meta[f]?.tags ?? [],
              }));
            }
          } catch {
            /* non-critical */
          }
        }

        const spotifyMusicAgents = resolvedAgents.filter(
          (agent) =>
            agent.type === "spotify" &&
            agent.settings?.musicProvider !== "youtube" &&
            agent.settings?.musicPlayerSource !== "youtube" &&
            agent.settings?.musicProvider !== "custom" &&
            agent.settings?.musicPlayerSource !== "custom",
        );
        if (spotifyMusicAgents.length > 0) {
          agentContext.memory._spotifyDjConstraints = buildSpotifyDjConstraints({ chatMode, chatMeta });
        }

        // If the haptic agent is enabled, inject connected device info (names + capabilities) into context
        if (resolvedAgents.some((a) => a.type === "haptic")) {
          try {
            const { hapticService } = await import("../services/haptic/buttplug-service.js");
            const hapticSettings = getChatHapticSettings(chatMeta);
            agentContext.memory._hapticSettings = formatHapticSettingsForPrompt(hapticSettings);
            // Auto-connect to Intiface Central if not already connected
            if (!hapticService.connected) {
              try {
                await hapticService.connect(getChatHapticIntifaceUrl(chatMeta));
              } catch {
                logger.warn("[haptic] Auto-connect to Intiface Central failed — is the server running?");
              }
            }
            if (hapticService.connected && hapticService.devices.length > 0) {
              agentContext.memory._connectedDevices = hapticService.devices.map((d) => ({
                name: d.name,
                index: d.index,
                capabilities: d.capabilities,
              }));
              logger.debug(`[haptic] Injected ${hapticService.devices.length} device(s) into agent context`);
            } else if (!hapticService.connected) {
              logger.warn("[haptic] Agent enabled but Intiface Central is not connected — skipping device injection");
            } else {
              logger.warn("[haptic] Agent enabled and connected, but no devices found — did you scan for devices?");
            }
          } catch (err) {
            logger.error(err, "[haptic] Failed to inject device info");
          }
        }

        // If the CYOA agent is enabled, inject previous choices for anti-repetition
        if (resolvedAgents.some((a) => a.type === "cyoa")) {
          const lastAssistantMsg = chatMessages.filter((m: any) => m.role === "assistant").at(-1);
          if (lastAssistantMsg) {
            const lastExtra = parseExtra((lastAssistantMsg as any).extra);
            if (lastExtra.cyoaChoices) {
              agentContext.memory._lastCyoaChoices = lastExtra.cyoaChoices;
            }
          }
        }

        // If the knowledge-retrieval agent is enabled, load lorebook + file source material
        const knowledgeRetrievalAgent = resolvedAgents.find((a) => a.type === "knowledge-retrieval");
        if (knowledgeRetrievalAgent) {
          const materialParts: string[] = [];

          // Load lorebook entries
          try {
            const { sourceLorebookIds: rawSourceIds, source } = resolveKnowledgeSourceLorebookIds({
              settings: knowledgeRetrievalAgent.settings,
              chatActiveLorebookIds: chatActiveLorebookIds,
            });
            const sourceIds = await filterChatActiveLorebookSourceIdsForPrompt(rawSourceIds, source);
            if (sourceIds.length > 0) {
              const entries = await lorebooksStore.listEntriesByLorebooks(sourceIds);
              const activeEntries = entries.filter((e: any) => e.enabled !== false);
              if (activeEntries.length > 0) {
                const formatted = activeEntries
                  .map((e: any) => {
                    const header = e.name || e.keys?.join(", ") || "Entry";
                    return `## ${header}\n${e.content}`;
                  })
                  .join("\n\n");
                materialParts.push(formatted);
              }
            }
          } catch {
            /* non-critical */
          }

          // Load uploaded file sources
          try {
            const sourceFileIds = (knowledgeRetrievalAgent.settings.sourceFileIds as string[]) ?? [];
            if (sourceFileIds.length > 0) {
              for (const fileId of sourceFileIds) {
                try {
                  const sourceInfo = await getSourceFilePath(fileId);
                  if (!sourceInfo) continue;
                  const { filePath, originalName, size, uploadedAt } = sourceInfo;
                  const text = await extractFileText(filePath, fileId, { size, uploadedAt });
                  if (text.trim()) {
                    materialParts.push(`## File: ${originalName}\n${text}`);
                  }
                } catch {
                  /* skip unreadable or missing files */
                }
              }
            }
          } catch {
            /* non-critical */
          }

          if (materialParts.length > 0) {
            agentContext.memory._knowledgeRetrievalMaterial = materialParts.join("\n\n");
          }
        }

        // If the knowledge-router agent is enabled, load candidate lorebook entries
        // for routing. The router picks IDs from this list and the selected entries
        // are injected verbatim — no per-entry summarization pass.
        const knowledgeRouterAgent = resolvedAgents.find((a) => a.type === "knowledge-router");
        const promptCharacterIdSet = new Set(promptCharacterIds);
        const knowledgeRouterActiveCharacterTags = Array.from(
          new Set(
            charInfo
              .filter((character) => promptCharacterIdSet.has(character.id))
              .flatMap((character) => character.tags),
          ),
        );
        let knowledgeRouterEntries: LorebookEntry[] = [];
        let knowledgeRouterActivatedEntries: LorebookEntry[] = [];
        let knowledgeRouterKeywordScanEntries: LorebookEntry[] = [];
        if (knowledgeRouterAgent) {
          try {
            const { sourceLorebookIds: rawSourceIds, source } = resolveKnowledgeSourceLorebookIds({
              settings: knowledgeRouterAgent.settings,
              chatActiveLorebookIds: chatActiveLorebookIds,
            });
            const sourceIds = await filterChatActiveLorebookSourceIdsForPrompt(rawSourceIds, source);
            if (sourceIds.length > 0) {
              const entries = (await lorebooksStore.listEntriesByLorebooks(sourceIds)) as LorebookEntry[];
              // Honor per-chat entry state overrides — a user can disable an entry for
              // this chat without touching the global lorebook, and ephemeral entries
              // carry per-chat countdown state. Mirrors the projection the standard
              // lorebook activation pipeline does in services/lorebook/index.ts.
              const entryStateOverrides =
                (chatMeta.entryStateOverrides as Record<string, { enabled?: boolean; ephemeral?: number | null }>) ??
                {};
              // Skip:
              //   - Disabled entries (off-limits, by global flag or per-chat override).
              //   - Chat-active constant entries, which are already injected by the standard lorebook path.
              //   - Exhausted ephemeral entries (countdown reached 0 in this chat).
              //   - Entries excluded by character/tag/generation-trigger filters.
              knowledgeRouterEntries = entries
                .filter((e: LorebookEntry) => {
                  if (source === "chat_active" && e.constant === true) return false;
                  const ov = entryStateOverrides[e.id];
                  const isEnabled = ov?.enabled ?? e.enabled !== false;
                  if (!isEnabled) return false;
                  // Project the ephemeral override here so the exhaustion check uses
                  // the per-chat remaining count, not the stale global default.
                  const effectiveEphemeral = ov?.ephemeral !== undefined ? ov.ephemeral : e.ephemeral;
                  if (effectiveEphemeral === 0) return false;
                  if (
                    !lorebookEntryPassesContextFilters(e, {
                      activeCharacterIds: promptCharacterIds,
                      activeCharacterTags: knowledgeRouterActiveCharacterTags,
                      generationTriggers: lorebookGenerationTriggers,
                    })
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((e: LorebookEntry) => {
                  const ov = entryStateOverrides[e.id];
                  return ov?.ephemeral !== undefined ? { ...e, ephemeral: ov.ephemeral } : e;
                });
              knowledgeRouterActivatedEntries = knowledgeRouterEntries.filter((entry) =>
                knowledgeRouterActivatedLorebookEntryIds.has(entry.id),
              );
              knowledgeRouterKeywordScanEntries = knowledgeRouterActivationPassCompleted
                ? knowledgeRouterEntries.filter(
                    (entry) =>
                      !knowledgeRouterActivatedLorebookEntryIds.has(entry.id) &&
                      !knowledgeRouterExcludedLorebookEntryIds.has(entry.id),
                  )
                : knowledgeRouterEntries;
            }
          } catch (err) {
            // Non-critical: the router simply skips this turn if loading fails. Log
            // so the failure is diagnosable instead of looking like "no matches found".
            logger.warn(err, "[knowledge-router] failed to load source lorebook entries");
          }
        }

        // ────────────────────────────────────────
        // Tracker Data Injection
        // ────────────────────────────────────────
        // The Card Evolution Auditor proposes user-facing character-card edits,
        // so gate it by assistant-message cadence instead of auditing every turn.
        if (resolvedAgents.some((a) => a.type === "card-evolution-auditor")) {
          const ceaAgent = resolvedAgents.find((a) => a.type === "card-evolution-auditor")!;
          if (
            await shouldSkipAgentByAssistantInterval({
              agentsStore,
              chatId: input.chatId,
              agentType: "card-evolution-auditor",
              settings: ceaAgent.settings,
              fallbackInterval: (getDefaultBuiltInAgentSettings("card-evolution-auditor").runInterval as number) ?? 8,
              messages: allChatMessages,
            })
          ) {
            resolvedAgents.splice(resolvedAgents.indexOf(ceaAgent), 1);
          }
        }

        injectCommittedTrackerContext({
          messages: finalMessages,
          chatEnableAgents,
          activeAgentIds: chatActiveAgentIds,
          latestGameState,
          chatMetadata: chatMeta,
          wrapFormat,
          dedupeLastMessageWrappers,
          findTrackerContextInsertIndex,
        });

        const agentEventResolvedAgents =
          directorSecretPlotAgent && !resolvedAgents.some((agent) => agent.type === "director")
            ? [...resolvedAgents, directorSecretPlotAgent]
            : resolvedAgents;
        const requireAgentWriteApproval = agentWriteApprovalRequired(chatMeta);
        const markLorebookResultForApproval = (result: AgentResult): AgentResult => {
          if (
            !requireAgentWriteApproval ||
            !result.success ||
            result.type !== "lorebook_update" ||
            !result.data ||
            typeof result.data !== "object" ||
            isAgentWriteApprovalEnvelope(result.data)
          ) {
            return result;
          }

          const lkData = result.data as Record<string, unknown>;
          const updates = Array.isArray(lkData.updates)
            ? lkData.updates.filter((update): update is Record<string, unknown> => {
                return !!update && typeof update === "object" && !Array.isArray(update);
              })
            : [];
          if (updates.length === 0) return result;

          const resultAgent = findResultAgent(result, resolvedAgents);
          const isBuiltInLorebookAgent = builtInAgentTypes.has(result.agentType);
          const customCanEditLorebooks =
            isBuiltInLorebookAgent ||
            (resultAgent ? customAgentHasCapability(resultAgent.settings, "edit_lorebooks") : false);
          const customCanCreateLorebooks =
            isBuiltInLorebookAgent ||
            (resultAgent ? customAgentHasCapability(resultAgent.settings, "create_lorebooks") : false);
          if (!customCanEditLorebooks && !customCanCreateLorebooks) return result;

          const customWritableLorebookIds =
            !isBuiltInLorebookAgent && resultAgent
              ? resolveCustomWritableLorebookIds(resultAgent.settings)
              : agentContext.writableLorebookIds;
          const writableLorebookIds = customCanEditLorebooks ? customWritableLorebookIds : null;
          const preferredTargetLorebookId =
            !isBuiltInLorebookAgent && resultAgent
              ? (writableLorebookIds?.[0] ?? null)
              : typeof agentContext.memory._lorebookKeeperTargetLorebookId === "string"
                ? (agentContext.memory._lorebookKeeperTargetLorebookId as string)
                : null;
          if (!customCanCreateLorebooks && !preferredTargetLorebookId && !writableLorebookIds?.length) {
            return result;
          }

          const agentName = resultAgent?.name ?? result.agentType;
          return {
            ...result,
            data: {
              ...lkData,
              requiresApproval: true,
              approval: buildLorebookWriteApprovalProposal({
                chatId: input.chatId,
                agentType: result.agentType,
                agentName,
                updates,
                preferredTargetLorebookId,
                writableLorebookIds,
              }),
            },
          };
        };
        const { sendAgentEvent: sendRawAgentEvent, sendAgentResultEvent: sendRawAgentResultEvent } =
          createAgentEventDispatcher({
            resolvedAgents: agentEventResolvedAgents,
            sendEvent: (payload) => trySendSseEvent(reply, payload),
          });
        const sendAgentEvent = (result: AgentResult, options?: { finalized?: boolean }) => {
          const nextResult = markLorebookResultForApproval(result);
          if (!customAgentCanEmitResult(nextResult, resolvedAgents, builtInAgentTypes)) return;
          sendRawAgentEvent(nextResult, options);
        };
        const sendAgentResultEvent = (result: AgentResult) => {
          const nextResult = markLorebookResultForApproval(result);
          if (!customAgentCanEmitResult(nextResult, resolvedAgents, builtInAgentTypes)) return;
          sendRawAgentResultEvent(nextResult);
        };

        for (const warning of agentConnectionWarnings) {
          trySendSseEvent(reply, { type: "agent_warning", data: warning });
        }

        // Create the pipeline (exclude text rewrite agents — they run last,
        // after all other post-processing agents have produced their context).
        const textRewriteAgents = resolvedAgents.filter(
          (a) => a.phase === "post_processing" && resolveAgentResultType(a) === "text_rewrite",
        );
        const textRewriteRunAgents = mergePairedBuiltInRewriteAgents(textRewriteAgents);
        const textRewritePendingState = getTextRewritePendingState(textRewriteAgents);
        const holdForProseGuardianRewrite = shouldHoldForProseGuardianRewrite(textRewriteAgents);
        const textRewriteAgentIds = new Set(textRewriteAgents.map((a) => a.id));
        const lorebookKeeperAgent = resolvedAgents.find((a) => a.type === "lorebook-keeper") ?? null;
        let pipelineAgents = resolvedAgents.filter(
          (a) => !textRewriteAgentIds.has(a.id) && a.type !== "lorebook-keeper",
        );

        // When manualTrackers is enabled, strip tracker-category agents from the
        // automatic pipeline — the user will trigger them manually via retry-agents.
        const manualTrackers = chatMeta.manualTrackers === true;
        if (manualTrackers) {
          const trackerIds = new Set(BUILT_IN_AGENTS.filter((a) => a.category === "tracker").map((a) => a.id));
          pipelineAgents = pipelineAgents.filter((a) => !trackerIds.has(a.type));
        }

        // Echo Chamber should only fire on fresh user messages, not swipes/regenerates
        if (input.regenerateMessageId) {
          pipelineAgents = pipelineAgents.filter((a) => a.type !== "echo-chamber");
        }

        // Combat agent only needs to run when an encounter is active.
        // If the last combat result stored encounterActive = false, skip it.
        if (chatMeta.encounterActive === false) {
          pipelineAgents = pipelineAgents.filter((a) => a.type !== "combat");
        }

        const {
          enableChatTools,
          chatResolvedToolNames,
          toolDefs,
          baseToolExecutionContext,
          updateChatMetadataForTools,
        } = await resolveGenerationTools({
          requestBody: req.body as Record<string, unknown>,
          chatId: input.chatId,
          chatMetadata: chatMeta,
          chats,
          agentsStore,
          customToolsStore,
          lorebooksStore,
          resolvedAgents,
          enabledConfigs,
          promptCharacterIds,
          personaId,
          activeLorebookIds: chatActiveLorebookIds,
          excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
          excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
          gameState,
          gameSpotifyMusicEnabled,
          agentContext,
          emitMetadataPatch: (patch) => trySendSseEvent(reply, { type: "metadata_patch", data: patch }),
        });
        if (enableChatTools && toolDefs && toolDefs.length > 0 && conn.treatAsLocalEndpoint === "true") {
          const toolLines = toolDefs.map(
            (t) =>
              `- ${t.function.name}: ${t.function.description}\n  Parameters: ${JSON.stringify(t.function.parameters)}`,
          );
          const toolBlock = `<available_functions>\nYou may call the following functions when appropriate. To invoke a function, include a tool_call block in your response:\n<tool_call>{"name": "function_name", "arguments": {"param_name": param_value}}</tool_call>\n\nAvailable functions:\n${toolLines.join("\n")}\n</available_functions>`;
          appendToFirstSystemMessage(finalMessages, toolBlock);
        }
        // Pre-generation prompt-patch agents read the assembled prompt here; this is overwritten
        // with the fitted provider prompt before each main model call.
        agentContext.memory._mainPromptPreview = promptPreviewForAgents(finalMessages);
        const pipeline = createAgentPipeline(pipelineAgents, agentContext, sendAgentEvent);
        let directorSecretPlotResults: AgentResult[] = [];
        let directorSecretPlotArcForPrompt: unknown = directorSecretPlotMemory.overarchingArc;

        // ────────────────────────────────────────
        // Phase 1: Pre-generation agents
        // ────────────────────────────────────────
        logger.debug(`[timing] Prompt assembly + context: ${Date.now() - _tAssemble}ms`);
        // Only run pre-gen agents on fresh generations (user sent a new message),
        // NOT on regenerations/swipes — EXCEPT for context-injection agents (like
        // prose-guardian) which improve writing quality and should run every time.
        // On regens, reuse cached injections from the first generation to save tokens.
        // Post-gen agents still run after every response.
        const agentNameByType = new Map(resolvedAgents.map((agent) => [agent.type, agent.name] as const));
        const attachAgentName = (entry: AgentInjection): AgentInjection => ({
          ...entry,
          agentName: agentNameByType.get(entry.agentType) ?? entry.agentName,
        });
        const reviewedAgentInjections: AgentInjection[] = input.agentInjectionOverrides
          .map((entry) =>
            attachAgentName({ agentType: entry.agentType.trim(), agentName: entry.agentName, text: entry.text }),
          )
          .filter((entry) => entry.agentType && entry.text.trim().length > 0);
        const reviewedAgentTypes = new Set(reviewedAgentInjections.map((entry) => entry.agentType));
        let contextInjections: AgentInjection[] = reviewedAgentInjections;
        const SEPARATE_INJECTION_AGENTS = new Set(["director", "knowledge-retrieval", "knowledge-router"]);
        const EXCLUDED_FROM_PIPELINE = new Set(["knowledge-retrieval", "knowledge-router"]);
        const hasPreGenAgents = resolvedAgents.some(
          (a) => a.phase === "pre_generation" && !EXCLUDED_FROM_PIPELINE.has(a.type) && !reviewedAgentTypes.has(a.type),
        );

        // ── Run pre-gen agents, knowledge retrieval, and knowledge router in parallel when possible ──
        const shouldRunKR = !!(
          knowledgeRetrievalAgent &&
          agentContext.memory._knowledgeRetrievalMaterial &&
          !input.regenerateMessageId
        );
        const shouldRunRouter = !!(
          knowledgeRouterAgent &&
          knowledgeRouterEntries.length > 0 &&
          !input.regenerateMessageId
        );
        const shouldRunPreGen = (hasPreGenAgents || reviewedAgentInjections.length > 0) && !input.regenerateMessageId;
        const runDirectorSecretPlotMaintenance = async (): Promise<AgentResult[]> => {
          if (!directorSecretPlotAgent) return [];
          reply.raw.write(
            `data: ${JSON.stringify({ type: "agent_start", data: { phase: "pre_generation", agentType: "director" } })}\n\n`,
          );
          const secretAgent = buildDirectorSecretPlotAgent(directorSecretPlotAgent);
          const runOnce = async (state: Record<string, unknown>): Promise<AgentResult> => {
            const secretContext: AgentContext = {
              ...agentContext,
              memory: {
                ...agentContext.memory,
                ...(Object.keys(state).length > 0 ? { _secretPlotState: state } : {}),
              },
            };
            const result = await executeAgent(secretAgent, secretContext, secretAgent.provider, secretAgent.model);
            sendAgentEvent(result);
            if (result.success && result.data && typeof result.data === "object") {
              const plotData = result.data as Record<string, unknown>;
              if (plotData.overarchingArc !== undefined) {
                directorSecretPlotArcForPrompt = plotData.overarchingArc;
                try {
                  await agentsStore.setMemory(secretAgent.id, input.chatId, "overarchingArc", plotData.overarchingArc);
                  const nextState = buildSecretPlotStateFromMemory({ overarchingArc: plotData.overarchingArc });
                  if (Object.keys(nextState).length > 0) {
                    agentContext.memory._secretPlotState = nextState;
                  }
                } catch (err) {
                  logger.warn(err, "[narrative-director] Failed to persist secret plot arc");
                }
              }
            }
            return result;
          };

          const initialState = buildSecretPlotStateFromMemory(directorSecretPlotMemory);
          const firstResult = await runOnce(initialState);
          const results = [firstResult];
          if (firstResult.success && secretPlotArcIsCompleted(firstResult.data)) {
            const completedState =
              firstResult.data && typeof firstResult.data === "object"
                ? buildSecretPlotStateFromMemory(firstResult.data as Record<string, unknown>)
                : {};
            const nextResult = await runOnce(completedState);
            results.push(nextResult);
          }
          return results;
        };

        // Helper: wrap a separate-injection agent's text and append it to the last
        // user message. Used by both knowledge-retrieval and knowledge-router on
        // both fresh generations AND regen-cache replays — keeping the wrap+append
        // in one place prevents the two paths from drifting again (PR #228 had to
        // fix exactly that drift once already).
        const appendSeparateAgentInjection = (agentType: string, text: string): void => {
          const meta =
            agentType === "knowledge-router"
              ? { heading: "Knowledge Router", tag: "knowledge_router" }
              : agentType === "knowledge-retrieval"
                ? { heading: "Knowledge Retrieval", tag: "knowledge_retrieval" }
                : agentType === "director"
                  ? { heading: "Narrative Director", tag: "narrative_director" }
                  : { heading: agentType, tag: agentType.replace(/[^a-z0-9_-]/gi, "_") };
          // Honor all three wrapFormat values (the previous KR-only injection had
          // a markdown-or-xml-fallback bug that "none" silently fell into).
          const wrapped =
            wrapFormat === "none"
              ? `\n\n${meta.heading}:\n${text}`
              : wrapFormat === "markdown"
                ? `\n\n## ${meta.heading}\n${text}`
                : `\n\n<${meta.tag}>\n${text}\n</${meta.tag}>`;
          const lastUserIdx = findLastIndex(finalMessages, "user");
          if (lastUserIdx >= 0) {
            const target = finalMessages[lastUserIdx]!;
            finalMessages[lastUserIdx] = { ...target, content: target.content + wrapped };
          } else {
            const last = finalMessages[finalMessages.length - 1]!;
            finalMessages[finalMessages.length - 1] = { ...last, content: last.content + wrapped };
          }
        };

        if (shouldRunDirectorSecretPlot || shouldRunPreGen || shouldRunKR || shouldRunRouter) {
          sendProgress("agents");

          if (shouldRunDirectorSecretPlot) {
            const _tSecretPlot = Date.now();
            directorSecretPlotResults = await runDirectorSecretPlotMaintenance();
            logger.debug("[timing] Narrative Director secret plot: %dms", Date.now() - _tSecretPlot);
          }

          // Build the pre-gen promise
          const preGenPromise = hasPreGenAgents
            ? (async () => {
                reply.raw.write(
                  `data: ${JSON.stringify({ type: "agent_start", data: { phase: "pre_generation" } })}\n\n`,
                );
                if (isDebug) {
                  const preGenAgents = pipelineAgents.filter(
                    (a) => a.phase === "pre_generation" && !EXCLUDED_FROM_PIPELINE.has(a.type),
                  );
                  app.log.debug(
                    "[debug] Pre-generation agents (%d): %s",
                    preGenAgents.length,
                    preGenAgents.map((a) => `${a.name} (${a.model})`).join(", "),
                  );
                }
                const _tAgents = Date.now();
                const injections = (
                  await pipeline.preGenerate((t) => !EXCLUDED_FROM_PIPELINE.has(t) && !reviewedAgentTypes.has(t))
                ).map(attachAgentName);
                logger.debug(`[timing] Pre-gen agents: ${Date.now() - _tAgents}ms`);
                return injections;
              })()
            : Promise.resolve([] as AgentInjection[]);

          // Build the knowledge retrieval promise
          // Wrapped in try/catch so a KR failure (LLM error, parse error, etc.) never
          // aborts the whole generation — knowledge retrieval is an optional enhancement,
          // not a critical dependency. (Same pattern as the router promise below.)
          const krPromise = shouldRunKR
            ? (async () => {
                const _tKR = Date.now();
                try {
                  reply.raw.write(
                    `data: ${JSON.stringify({ type: "agent_start", data: { phase: "pre_generation", agentType: "knowledge-retrieval" } })}\n\n`,
                  );
                  const krConfig = {
                    id: knowledgeRetrievalAgent!.id,
                    type: knowledgeRetrievalAgent!.type,
                    name: knowledgeRetrievalAgent!.name,
                    phase: knowledgeRetrievalAgent!.phase,
                    promptTemplate: knowledgeRetrievalAgent!.promptTemplate,
                    connectionId: knowledgeRetrievalAgent!.connectionId,
                    settings: knowledgeRetrievalAgent!.settings,
                  };
                  const sourceMaterial = agentContext.memory._knowledgeRetrievalMaterial as string;
                  const krResult = await executeKnowledgeRetrieval(
                    krConfig,
                    agentContext,
                    knowledgeRetrievalAgent!.provider,
                    knowledgeRetrievalAgent!.model,
                    sourceMaterial,
                  );
                  sendAgentEvent(krResult);
                  logger.debug(`[timing] Knowledge retrieval: ${Date.now() - _tKR}ms`);
                  return krResult;
                } catch (err) {
                  // Emit agent_error so the client closes the pending state opened by
                  // agent_start above — without this the UI shows the agent as forever-
                  // running. (Mirrors the Illustrator agent's failure protocol.)
                  // Use trySendSseEvent rather than reply.raw.write so a disconnected
                  // client doesn't turn this caught failure back into a rejected promise.
                  logger.warn(err, "[knowledge-retrieval] failed — continuing generation without retrieved context");
                  trySendSseEvent(reply, {
                    type: "agent_error",
                    data: {
                      agentType: "knowledge-retrieval",
                      agentName: knowledgeRetrievalAgent!.name,
                      error: err instanceof Error ? err.message : "Knowledge retrieval failed",
                    },
                  });
                  return null;
                }
              })()
            : Promise.resolve(null);

          // Build the knowledge router promise
          // Wrapped in try/catch so a router failure (LLM error, parse error, etc.)
          // never aborts the whole generation — routing is an optional enhancement,
          // not a critical dependency.
          const krRouterPromise = shouldRunRouter
            ? (async () => {
                const _tRouter = Date.now();
                try {
                  reply.raw.write(
                    `data: ${JSON.stringify({ type: "agent_start", data: { phase: "pre_generation", agentType: "knowledge-router" } })}\n\n`,
                  );
                  const routerConfig = {
                    id: knowledgeRouterAgent!.id,
                    type: knowledgeRouterAgent!.type,
                    name: knowledgeRouterAgent!.name,
                    phase: knowledgeRouterAgent!.phase,
                    promptTemplate: knowledgeRouterAgent!.promptTemplate,
                    connectionId: knowledgeRouterAgent!.connectionId,
                    settings: knowledgeRouterAgent!.settings,
                  };
                  const routerResult = await executeKnowledgeRouter(
                    routerConfig,
                    agentContext,
                    knowledgeRouterAgent!.provider,
                    knowledgeRouterAgent!.model,
                    knowledgeRouterEntries,
                    {
                      embeddingSource: memoryRecallEmbeddingSource,
                      semanticEnabled: memoryRecallVectorizerAvailable,
                      semanticTopK: knowledgeRouterAgent!.settings.semanticTopK,
                      ...(knowledgeRouterActivationPassCompleted
                        ? { activatedEntries: knowledgeRouterActivatedEntries }
                        : {}),
                      keywordScanEntries: knowledgeRouterKeywordScanEntries,
                      scanMessages: toLorebookScanMessages(),
                      scanOptions: {
                        gameState: gameState as GameStateForScanning | null,
                        activeCharacterIds: promptCharacterIds,
                        activeCharacterTags: knowledgeRouterActiveCharacterTags,
                        generationTriggers: lorebookGenerationTriggers,
                      },
                    },
                  );
                  sendAgentEvent(routerResult);
                  logger.debug(`[timing] Knowledge router: ${Date.now() - _tRouter}ms`);
                  return routerResult;
                } catch (err) {
                  // Emit agent_error so the client closes the pending state opened by
                  // agent_start above — without this the UI shows the agent as forever-
                  // running. (Mirrors the Illustrator agent's failure protocol.)
                  // Use trySendSseEvent rather than reply.raw.write so a disconnected
                  // client doesn't turn this caught failure back into a rejected promise.
                  logger.warn(err, "[knowledge-router] failed — continuing generation without routed context");
                  trySendSseEvent(reply, {
                    type: "agent_error",
                    data: {
                      agentType: "knowledge-router",
                      error: err instanceof Error ? err.message : "Knowledge router failed",
                    },
                  });
                  return null;
                }
              })()
            : Promise.resolve(null);

          // Run all three in parallel
          const [preGenResult, krResult, routerResult] = await Promise.all([preGenPromise, krPromise, krRouterPromise]);
          contextInjections = [...reviewedAgentInjections, ...preGenResult];

          // ── Failure gate: only block generation if a critical pre-gen agent failed ──
          // Secret plot maintenance shapes the hidden arc — generating without
          // it would produce incoherent output. Other agents are enhancement-only.
          const preGenResults = [
            ...directorSecretPlotResults,
            ...pipeline.results.filter(
              (r) => r.agentType !== "knowledge-retrieval" && r.agentType !== "knowledge-router",
            ),
          ];
          const latestUserMessageForPreGenRun = [...allChatMessages]
            .reverse()
            .find((message: any) => message.role === "user");
          const preGenRunMessageId = latestUserMessageForPreGenRun?.id ?? "";
          if (preGenRunMessageId) {
            for (const result of preGenResults) {
              if (builtInAgentTypes.has(result.agentType)) continue;
              try {
                await agentsStore.saveRun({
                  agentConfigId: result.agentId,
                  chatId: input.chatId,
                  messageId: preGenRunMessageId,
                  result,
                });
              } catch {
                // Non-critical — cadence should not block the generation pipeline.
              }
            }
          }
          const criticalFailed = preGenResults.filter((r) => !r.success && r.type === "secret_plot");
          const nonCriticalFailed = preGenResults.filter((r) => !r.success && r.type !== "secret_plot");
          if (criticalFailed.length > 0) {
            const failedNames = criticalFailed.map((r) => r.agentType).join(", ");
            const firstError = criticalFailed[0]!.error ?? "unknown error";
            logger.error(`[pre-gen] FATAL: critical agent(s) failed (${failedNames}) — aborting generation`);
            sendSseEvent(reply, {
              type: "error",
              data: `Critical pre-generation agent failed (${failedNames}): ${firstError}. Please try again.`,
            });
            return;
          }
          if (nonCriticalFailed.length > 0) {
            const failedNames = nonCriticalFailed.map((r) => r.agentType).join(", ");
            logger.warn(`[pre-gen] Non-critical agent(s) failed (${failedNames}) — continuing generation`);
          }

          for (const result of preGenResults) {
            if (!result.success || result.type !== "prompt_patch") continue;
            if (!customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_main_prompt")) continue;
            const applied = applyPromptPatchOperations(finalMessages, result.data);
            if (applied > 0) {
              logger.info("[custom-agent] Applied %d prompt patch operation(s) from %s", applied, result.agentType);
              trySendSseEvent(reply, {
                type: "prompt_patch",
                data: { agentType: result.agentType, applied },
              });
            }
          }

          const shouldReviewWriterAgentOutputs =
            (chatMode === "roleplay" || chatMode === "visual_novel") &&
            requireAgentWriteApproval &&
            reviewedAgentInjections.length === 0 &&
            !input.regenerateMessageId;
          const reviewableWriterInjections = contextInjections.filter((entry) =>
            REVIEWABLE_WRITER_AGENT_TYPES.has(entry.agentType),
          );
          if (shouldReviewWriterAgentOutputs && reviewableWriterInjections.length > 0) {
            const agentNames = new Map(resolvedAgents.map((agent) => [agent.type, agent.name] as const));
            sendSseEvent(reply, {
              type: "agent_injection_review",
              data: {
                chatId: input.chatId,
                injections: reviewableWriterInjections.map((entry) => ({
                  agentType: entry.agentType,
                  agentName: agentNames.get(entry.agentType) ?? entry.agentType,
                  text: entry.text,
                })),
              },
            });
            return;
          }

          const runtimeHandledPreGen = splitRuntimeHandledAgentInjections(
            finalMessages,
            runtimeAgentSectionTokens,
            contextInjections,
          );

          // Inject pre-gen agent context at depth 0 (very bottom of prompt)
          const fallbackPreGenInjections = runtimeHandledPreGen.fallbackInjections.filter(
            (inj) => !SEPARATE_INJECTION_AGENTS.has(inj.agentType),
          );
          const separatePreGenInjections = runtimeHandledPreGen.fallbackInjections.filter((inj) =>
            SEPARATE_INJECTION_AGENTS.has(inj.agentType),
          );
          if (fallbackPreGenInjections.length > 0) {
            const wrapped = formatAgentInjections(fallbackPreGenInjections, wrapFormat);
            finalMessages = injectAtDepth(finalMessages, [{ content: wrapped, role: "system", depth: 0 }]);
          }
          for (const inj of separatePreGenInjections) {
            appendSeparateAgentInjection(inj.agentType, inj.text);
          }

          // Inject KR output into the prompt
          if (krResult?.success && krResult.data) {
            const krText =
              typeof krResult.data === "string" ? krResult.data : ((krResult.data as { text?: string })?.text ?? "");
            if (krText) {
              const tokens = runtimeAgentSectionTokens.get("knowledge-retrieval");
              const handledByPresetSection =
                !runtimeHandledPreGen.handledTypes.has("knowledge-retrieval") &&
                tokens !== undefined &&
                replaceRuntimeAgentSection(finalMessages, tokens, krText);
              if (!handledByPresetSection) {
                appendSeparateAgentInjection("knowledge-retrieval", krText);
              }
              contextInjections.push({ agentType: "knowledge-retrieval", text: krText });
            }
          }

          // Inject Router output into the prompt
          if (routerResult?.success && routerResult.data) {
            const routerText =
              typeof routerResult.data === "string"
                ? routerResult.data
                : ((routerResult.data as { text?: string })?.text ?? "");
            if (routerText) {
              const tokens = runtimeAgentSectionTokens.get("knowledge-router");
              const handledByPresetSection =
                !runtimeHandledPreGen.handledTypes.has("knowledge-router") &&
                tokens !== undefined &&
                replaceRuntimeAgentSection(finalMessages, tokens, routerText);
              if (!handledByPresetSection) {
                appendSeparateAgentInjection("knowledge-router", routerText);
              }
              contextInjections.push({ agentType: "knowledge-router", text: routerText });
            }
          }
          clearUnusedRuntimeAgentSections(finalMessages, runtimeAgentSectionTokens);
        } else if (input.regenerateMessageId) {
          // Regeneration — try to reuse cached context injections from the original generation.
          // This must run regardless of whether `hasPreGenAgents` is true, because the cached
          // injections may have come from agents in `EXCLUDED_FROM_PIPELINE` (knowledge-retrieval,
          // knowledge-router) — which `hasPreGenAgents` excludes. Without this, a chat whose
          // only pre-gen agent is KR or Router would silently drop the lore on every regen.
          const regenExtra = parseExtra(regenMsg?.extra);
          // Backwards compat: old caches stored plain string[], and some edited
          // caches may contain a mix of legacy strings and object-shaped entries.
          const cached = normalizeContextInjections(regenExtra.contextInjections);
          // Secret plot is applied from Director memory, not from message cache (legacy entries ignored).
          const cachedSansSecret = cached.filter((i) => i.agentType !== "secret-plot-driver");

          if (cachedSansSecret && cachedSansSecret.length > 0) {
            contextInjections = cachedSansSecret;
            for (const inj of cachedSansSecret) {
              reply.raw.write(
                `data: ${JSON.stringify({
                  type: "agent_result",
                  data: {
                    agentType: inj.agentType,
                    agentName: agentNameByType.get(inj.agentType) ?? inj.agentName ?? inj.agentType,
                    resultType: "context_injection",
                    data: { text: inj.text },
                    tokensUsed: 0,
                    success: true,
                    error: null,
                    durationMs: 0,
                    cached: true,
                  },
                })}\n\n`,
              );
            }
          } else if (hasPreGenAgents) {
            const hasContextInjectionAgents = resolvedAgents.some(
              (a) => a.phase === "pre_generation" && !EXCLUDED_FROM_PIPELINE.has(a.type),
            );
            if (hasContextInjectionAgents) {
              reply.raw.write(
                `data: ${JSON.stringify({ type: "agent_start", data: { phase: "pre_generation" } })}\n\n`,
              );
              // On regens, exclude legacy Secret Plot Driver cache entries.
              contextInjections = (
                await pipeline.preGenerate(
                  (agentType) => !EXCLUDED_FROM_PIPELINE.has(agentType) && agentType !== "secret-plot-driver",
                )
              ).map(attachAgentName);

              // Failure gate — same as the new-message path
              const regenPreGenResults = pipeline.results.filter(
                (r) =>
                  r.agentType !== "knowledge-retrieval" &&
                  r.agentType !== "knowledge-router" &&
                  r.agentType !== "secret-plot-driver",
              );
              const failedRegen = regenPreGenResults.filter((r) => !r.success);
              if (failedRegen.length > 0) {
                const failedNames = failedRegen.map((r) => r.agentType).join(", ");
                const firstError = failedRegen[0]!.error ?? "unknown error";
                logger.error(
                  `[pre-gen] FATAL: ${failedRegen.length} agent(s) failed on regen (${failedNames}) — aborting generation`,
                );
                sendSseEvent(reply, {
                  type: "error",
                  data: `Pre-generation agent${failedRegen.length > 1 ? "s" : ""} failed (${failedNames}): ${firstError}. Please try again.`,
                });
                return;
              }
            }
          }

          // Split cached injections by injection placement, mirroring the fresh-generation path:
          //   - Pipeline agents (prose-guardian, etc.) inject at depth 0 as system context.
          //   - Separate-injection agents (director, knowledge-retrieval, knowledge-router) append
          //     to the last user message wrapped in their own tags.
          // Without this split, KR/Router cached output would be replayed in the wrong prompt
          // position with different wrapping than the original generation, subtly changing the
          // model's behavior on regenerate/swipe.
          const runtimeHandledCached = splitRuntimeHandledAgentInjections(
            finalMessages,
            runtimeAgentSectionTokens,
            contextInjections,
          );

          const cachedPipelineInjections = runtimeHandledCached.fallbackInjections.filter(
            (inj) => !SEPARATE_INJECTION_AGENTS.has(inj.agentType),
          );
          const cachedSeparateInjections = runtimeHandledCached.fallbackInjections.filter((inj) =>
            SEPARATE_INJECTION_AGENTS.has(inj.agentType),
          );

          if (cachedPipelineInjections.length > 0) {
            const wrapped = formatAgentInjections(cachedPipelineInjections, wrapFormat);
            finalMessages = injectAtDepth(finalMessages, [{ content: wrapped, role: "system", depth: 0 }]);
          }

          for (const inj of cachedSeparateInjections) {
            const runtimeType = toRuntimeAgentSectionType(inj.agentType, runtimeSectionEligibleAgentTypes);
            const tokens = runtimeType ? runtimeAgentSectionTokens.get(runtimeType) : undefined;
            const handledByPresetSection =
              tokens !== undefined && replaceRuntimeAgentSection(finalMessages, tokens, inj.text);
            if (!handledByPresetSection) {
              appendSeparateAgentInjection(inj.agentType, inj.text);
            }
          }
          clearUnusedRuntimeAgentSections(finalMessages, runtimeAgentSectionTokens);
        } else {
          clearUnusedRuntimeAgentSections(finalMessages, runtimeAgentSectionTokens);
        }

        if (directorSecretPlotAgent) {
          try {
            const plotMem = await agentsStore.getMemory(directorSecretPlotAgent.id, input.chatId);
            const secretPlotBlock = formatSecretPlotSystemBlock(
              directorSecretPlotArcForPrompt ?? plotMem.overarchingArc,
              wrapFormat,
            );
            appendSecretPlotSystemMessage(finalMessages, secretPlotBlock);
          } catch (plotInjectErr) {
            logger.error(plotInjectErr, "[narrative-director] Failed to inject secret plot");
            const secretPlotBlock = formatSecretPlotSystemBlock(directorSecretPlotArcForPrompt, wrapFormat);
            appendSecretPlotSystemMessage(finalMessages, secretPlotBlock);
          }
        }

        // Static injection: Immersive HTML is a prompt directive, not a runtime LLM agent.
        const immersiveHtmlResult = await applyImmersiveHtmlPromptInjection({
          chatMode,
          enableAgents: chatEnableAgents,
          activeAgentIds: chatActiveAgentIds,
          wrapFormat,
          messages: finalMessages,
          getHtmlAgentConfig: () => agentsStore.getByType("html"),
        });
        if (immersiveHtmlResult) {
          trySendSseEvent(reply, { type: "agent_result", data: immersiveHtmlResult });
        }

        // ── Early exit if client disconnected during knowledge retrieval / injection ──
        if (abortController.signal.aborted) return;

        // ── Main Generation Tool Configuration ──
        // Tool definitions (toolDefs) and custom tool metadata (customToolDefs)
        // were already resolved earlier for the agent pipeline and are reused here.

        // ── Impersonate: inject instruction to respond as the user's character ──
        // Only on the user's actual turn (iteration 0). A Mari follow-up pass
        // is a continuation of the assistant's prior message, not a new user
        // turn, so re-injecting impersonate/prefill would scramble the prompt.
        if (input.impersonate && followUpIteration === 0) {
          const impersonateInstruction = buildImpersonateInstruction({
            customPrompt: input.impersonatePromptTemplate || chatMeta.impersonatePrompt,
            direction: input.userMessage,
            personaName,
            personaDescription,
          });
          finalMessages.push({ role: "user", content: impersonateInstruction });
        }

        const tailMessages = appendGenerationTailMessages(finalMessages, {
          assistantPrefill,
          followUpIteration,
          impersonate: input.impersonate,
          isGoogleProvider,
          regenerateUserMessage,
        });
        if (tailMessages.assistantPrefillInjected) {
          const prefillPosition = tailMessages.googleUserRegenerationInjected
            ? "before final user message"
            : "as final assistant message";
          logger.debug("[generate] Injected assistant prefill (%d chars) %s", assistantPrefill.length, prefillPosition);
        }
        if (tailMessages.googleUserRegenerationInjected && assistantPrefill.trim()) {
          logger.debug("[generate] Preserved assistant prefill before Gemini user-message regeneration instruction");
        }

        let fullResponse = "";
        let fullThinking = "";
        let providerThinking = "";
        let allResponses: string[] = [];
        const generatedExpressionTargetIds = new Set<string>();
        const recordExpressionTarget = (savedMsg: any, fallbackCharacterId: string | null) => {
          const savedRole =
            typeof savedMsg?.role === "string" ? savedMsg.role : input.impersonate ? "user" : "assistant";
          if (savedRole === "assistant" && fallbackCharacterId) {
            generatedExpressionTargetIds.add(fallbackCharacterId);
          } else if (savedRole === "user" && personaId) {
            generatedExpressionTargetIds.add(personaId);
          }
        };

        const onThinking = (chunk: string) => {
          providerThinking += chunk;
          if (showThoughts) {
            fullThinking += chunk;
            trySendSseEvent(reply, { type: "thinking", data: chunk });
          }
        };
        const captureReasoning = chatMode === "roleplay" && showThoughts;

        // Helper: write text content progressively as small SSE token chunks.
        // Some providers dump a full buffered response through the streaming
        // path; yield periodically so health checks and chat navigation are not
        // starved while we fan that response out to the client.
        const TOKEN_CHUNK_SIZE = 6;
        const TOKEN_CHUNK_YIELD_EVERY = 64;
        let tokenChunksSinceYield = 0;
        const sendTokenTextChunked = async (text: string) => {
          for (let i = 0; i < text.length; i += TOKEN_CHUNK_SIZE) {
            const chunk = text.slice(i, i + TOKEN_CHUNK_SIZE);
            trySendSseEvent(reply, { type: "token", data: chunk });
            tokenChunksSinceYield += 1;
            if (tokenChunksSinceYield % TOKEN_CHUNK_YIELD_EVERY === 0) {
              await yieldToEventLoop();
            }
          }
        };
        const writeContentChunked = async (text: string) => {
          for (let i = 0; i < text.length; i += TOKEN_CHUNK_SIZE) {
            const chunk = text.slice(i, i + TOKEN_CHUNK_SIZE);
            fullResponse += chunk;
            tokenChunksSinceYield += 1;
            if (!holdForProseGuardianRewrite) {
              trySendSseEvent(reply, { type: "token", data: chunk });
            }
            if (tokenChunksSinceYield % TOKEN_CHUNK_YIELD_EVERY === 0) {
              await yieldToEventLoop();
            }
          }
        };

        const resolveMessageSpeakerName = (message: any): string => {
          if (message.role === "user") return personaName;
          if (message.characterId) return charInfo.find((c) => c.id === message.characterId)?.name ?? "Character";
          return chatMode === "conversation" ? "another group member" : "the narrator";
        };

        const latestVisibleSenderOtherThan = (targetCharId: string): string | null => {
          for (let i = chatMessages.length - 1; i >= 0; i--) {
            const message = chatMessages[i]!;
            if (message.role !== "user" && message.role !== "assistant") continue;
            if (message.role === "assistant" && message.characterId === targetCharId) continue;
            return resolveMessageSpeakerName(message);
          }
          return null;
        };

        const getExplicitlyMentionedCharacterIds = (): string[] => {
          const latestUserText =
            typeof input.userMessage === "string" && input.userMessage.trim()
              ? input.userMessage
              : String([...chatMessages].reverse().find((message: any) => message.role === "user")?.content ?? "");
          const requestedNames = new Set(
            (input.mentionedCharacterNames ?? []).map((name: string) => normalizeTextForMatch(name)),
          );

          return charInfo
            .filter((character) => {
              if (requestedNames.has(normalizeTextForMatch(character.name))) return true;
              const escaped = character.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              return new RegExp(`@${escaped}(?=$|[\\s\\p{P}\\p{S}])`, "iu").test(latestUserText);
            })
            .map((character) => character.id);
        };

        const parseSmartGroupSelectionIds = (raw: string): string[] => {
          const cleaned = raw
            .trim()
            .replace(/```(?:json)?\s*/gi, "")
            .replace(/```/g, "");
          const arrayStart = cleaned.indexOf("[");
          const arrayEnd = cleaned.lastIndexOf("]");
          const objectStart = cleaned.indexOf("{");
          const objectEnd = cleaned.lastIndexOf("}");
          if (arrayStart < 0 && objectStart < 0) return [];

          const parsed: unknown =
            arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)
              ? JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1))
              : JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
          const parsedRecord =
            parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
          const rawIds = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsedRecord.characterIds)
              ? parsedRecord.characterIds
              : Array.isArray(parsedRecord.characters)
                ? parsedRecord.characters
                : [];
          const validIds = new Set(characterIds);
          const namesByLower = new Map(
            charInfo.map((character) => [normalizeTextForMatch(character.name), character.id]),
          );
          const selected: string[] = [];

          for (const rawId of rawIds) {
            const value = String(rawId).trim();
            const id = validIds.has(value) ? value : (namesByLower.get(normalizeTextForMatch(value)) ?? "");
            if (validIds.has(id) && !selected.includes(id)) selected.push(id);
          }

          return selected;
        };

        const selectSmartGroupResponders = async (): Promise<string[]> => {
          const explicitMentionIds = getExplicitlyMentionedCharacterIds();
          if (explicitMentionIds.length > 0) return explicitMentionIds;

          const recentTranscript = chatMessages
            .filter((message: any) => message.role === "user" || message.role === "assistant")
            .slice(-5)
            .map((message: any) => {
              const speaker = resolveMessageSpeakerName(message);
              const content = stripConversationPromptTimestamps(conversationPromptHistoryContent(message, chatMode))
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 900);
              return `${speaker}: ${content}`;
            })
            .filter(Boolean)
            .join("\n");

          const candidates = charInfo
            .map((character) =>
              [
                `- id: ${character.id}`,
                `  name: ${character.name}`,
                `  talkativeness: ${Math.round(character.talkativeness * 100)}%`,
                character.personality ? `  personality: ${character.personality.slice(0, 500)}` : null,
                character.description ? `  description: ${character.description.slice(0, 500)}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
            )
            .join("\n\n");

          const selectionPrompt: ChatMessage[] = [
            {
              role: "system",
              content: [
                `You are a hidden response orchestrator for a roleplay group chat.`,
                `Choose which character or characters should respond next, based on the latest user message, recent scene context, relevance, personality, and who has spoken recently.`,
                `Usually choose exactly one character. Choose multiple only when multiple characters have a strong immediate reason to answer.`,
                `Do not always choose the first character. Avoid making the same character speak twice in a row unless the context clearly calls for it.`,
                `Return ONLY a valid JSON array of character IDs, such as ["character-id"]. No prose, no object wrapper, no markdown.`,
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `<persona>${personaName}</persona>`,
                `<candidates>`,
                candidates,
                `</candidates>`,
                `<recent_transcript>`,
                recentTranscript || "No recent transcript.",
                `</recent_transcript>`,
              ].join("\n"),
            },
          ];

          try {
            const selectorProvider = provider;
            const selectorModel = conn.model;
            const selectorMaxTokens = applyProviderMaxTokensOverride(selectorProvider, 512);

            const result = await selectorProvider.chatComplete(selectionPrompt, {
              model: selectorModel,
              ...(suppressModelParameters
                ? {}
                : {
                    temperature: 0.2,
                    maxTokens: selectorMaxTokens,
                    maxContext: effectiveMaxContext,
                    topP: 1,
                    serviceTier,
                  }),
              suppressModelParameters,
              stream: false,
              signal: abortController.signal,
            });
            const selectedIds = parseSmartGroupSelectionIds(result.content ?? "");
            if (selectedIds.length > 0) {
              logger.debug(
                "[group-smart] selected responders for chat %s: %s",
                input.chatId,
                selectedIds.map((id) => charInfo.find((character) => character.id === id)?.name ?? id).join(", "),
              );
              return selectedIds;
            }
            logger.warn(
              { chatId: input.chatId, raw: (result.content ?? "").slice(0, 500) },
              "[group-smart] Selector returned no valid character IDs",
            );
          } catch (error) {
            if (abortController.signal.aborted) return [];
            logger.warn({ err: error, chatId: input.chatId }, "[group-smart] Selector failed; aborting generation");
          }

          return [];
        };

        // ── Determine characters to generate for ──
        // Individual group mode: each character responds separately
        // Merged/single: one generation for the first (or mentioned) character
        const useIndividualLoop = isGroupChat && groupChatMode === "individual" && !input.regenerateMessageId; // regeneration always targets one message
        const regenGroupChatIndividual = isGroupChat && groupChatMode === "individual" && input.regenerateMessageId;
        const mentionedConversationCharacters =
          chatMode === "conversation" && isGroupChat && !input.impersonate
            ? charInfo.filter((character) =>
                (input.mentionedCharacterNames ?? []).some(
                  (name: string) => normalizeTextForMatch(name) === normalizeTextForMatch(character.name),
                ),
              )
            : [];

        const smartResponseQueue =
          useIndividualLoop && groupResponseOrder === "smart" && !input.forCharacterId
            ? await selectSmartGroupResponders()
            : null;

        if (smartResponseQueue && smartResponseQueue.length > 0) {
          sendSseEvent(reply, {
            type: "response_queue",
            data: {
              characterIds: smartResponseQueue,
              characters: smartResponseQueue.map((id, index) => ({
                id,
                name: charInfo.find((character) => character.id === id)?.name ?? "Character",
                order: index + 1,
              })),
            },
          });
        }

        if (
          useIndividualLoop &&
          groupResponseOrder === "smart" &&
          !input.forCharacterId &&
          (!smartResponseQueue || smartResponseQueue.length === 0)
        ) {
          sendSseEvent(reply, { type: "response_queue_failed", data: "No response queue was created." });
          sendSseEvent(reply, { type: "done", data: "" });
          return;
        }

        // Turn-game board awareness: when a UNO (etc.) game is active, tell the
        // responding bots the current board so their free-chat replies know a
        // game is in progress (the move-narration path is already board-aware).
        if (chatMode === "conversation") {
          const turnGameContext = await getTurnGameContextText(app.db, input.chatId);
          if (turnGameContext) {
            finalMessages = injectAtDepth(finalMessages, [{ content: turnGameContext, role: "system", depth: 0 }]);
          }
        }

        // Manual mode with forCharacterId: only generate for the specified character
        // Sequential: all characters respond. Smart: generate the first queued character only.
        const respondingCharIds = useIndividualLoop
          ? input.forCharacterId && characterIds.includes(input.forCharacterId)
            ? [input.forCharacterId]
            : groupResponseOrder === "manual"
              ? [] // manual mode without forCharacterId: no auto-generation
              : groupResponseOrder === "sequential"
                ? [...characterIds]
                : smartResponseQueue?.[0]
                  ? [smartResponseQueue[0]]
                  : []
          : [characterIds[0] ?? null];

        /** Generate a single response for a given character and save it. */
        const generateForCharacter = async (
          targetCharId: string | null,
          messagesForGen: GenerationPromptMessage[],
          markGenerationCommitted = false,
        ): Promise<{
          savedMsg: Awaited<ReturnType<typeof chats.createMessage>>;
          response: string;
          commands: CharacterCommand[];
          oocMessages: string[];
          characterId: string | null;
        } | null> => {
          const targetCharacterProfile =
            deferCharacterMacros && targetCharId ? characterMacroProfilesById.get(targetCharId) : undefined;
          const scopedMessagesForGen =
            isGroupChat && groupChatMode === "individual" && chatMode !== "conversation" && targetCharId
              ? scopeIndividualGroupMessagesForTarget(messagesForGen, targetCharId, charInfo)
              : messagesForGen;
          const targetScopedMessagesForGen =
            !promptTargetCharacterId && targetCharId
              ? scopedMessagesForGen.map((message) => ({ ...message }))
              : scopedMessagesForGen;
          if (!promptTargetCharacterId && targetCharId) {
            applyRegexScriptsToPromptMessages(targetScopedMessagesForGen, await getPromptRegexScripts(), {
              resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
              targetCharacterId: targetCharId,
              targetedOnly: true,
            });
          }
          const preparedMessagesForGen = targetScopedMessagesForGen.map((message) => ({
            ...message,
            content: (targetCharacterProfile
              ? resolveDeferredCharacterMacros(message.content, targetCharacterProfile, promptMacroContext)
              : message.content
            ).replace(/\n([ \t]*\n){2,}/g, "\n\n"),
          }));
          dedupeLastMessageWrappers(preparedMessagesForGen);
          if (
            deferCharacterMacros &&
            preparedMessagesForGen.some((message) => hasDeferredCharacterMacros(message.content))
          ) {
            logger.error(
              { chatId: input.chatId, targetCharId },
              "[generate] Deferred character macro placeholder remained before provider request",
            );
            sendSseEvent(reply, { type: "error", data: "Prompt preparation failed before generation" });
            return null;
          }

          const toProviderMessages = (promptMessages: GenerationPromptMessage[]): ChatMessage[] =>
            promptMessages.map((message) => ({
              role: message.role,
              content: message.content,
              ...(message.contextKind ? { contextKind: message.contextKind } : {}),
              ...(message.images?.length ? { images: message.images } : {}),
              ...(message.files?.length ? { files: message.files } : {}),
              ...(message.providerMetadata ? { providerMetadata: message.providerMetadata } : {}),
            }));

          const mergeProviderAdjacentMessages = (messages: ChatMessage[]): ChatMessage[] => {
            const merged: ChatMessage[] = [];
            for (const message of messages) {
              if (!message.content.trim() && !message.images?.length && !message.files?.length) continue;

              const last = merged[merged.length - 1];
              if (last && last.role === message.role) {
                last.content = `${last.content}\n\n${message.content}`;
                delete last.contextKind;
                if (message.images?.length) {
                  last.images = [...(last.images ?? []), ...message.images];
                }
                if (message.files?.length) {
                  last.files = [...(last.files ?? []), ...message.files];
                }
                if (message.providerMetadata) {
                  last.providerMetadata = message.providerMetadata;
                }
              } else {
                merged.push({
                  ...message,
                  ...(message.images?.length ? { images: [...message.images] } : {}),
                  ...(message.files?.length ? { files: message.files.map((file) => ({ ...file })) } : {}),
                });
              }
            }
            return merged;
          };

          const prepareProviderMessages = (messages: ChatMessage[]): ChatMessage[] => {
            // Append mid-prompt system messages to the last user turn after context fitting.
            // This keeps prompt/injection system blocks protected while trimming history,
            // then preserves provider alternation rules for the actual request.
            return mergeProviderAdjacentMessages(appendNonLeadingSystemMessagesToLastUser(messages));
          };

          let finalPromptSent: ChatMessage[] = [];
          const rememberMainPromptPreviewForAgents = (messages: ChatMessage[]) => {
            agentContext.memory._mainPromptPreview = promptPreviewForAgents(messages);
          };
          let effectiveMaxTokensForSend: number | undefined = maxTokens;
          const fitPromptForSend = (candidateMessages: ChatMessage[]): ChatMessage[] => {
            const fit = fitMessagesForModelAccess({
              messages: candidateMessages,
              policy: { ...modelAccessPolicy, effectiveMaxContext },
              maxTokens,
              tools: toolDefs,
            });
            finalPromptSent = fit.messages;
            effectiveMaxTokensForSend = fit.maxTokensForSend;
            return fit.messages;
          };

          const initialProviderMessages = prepareProviderMessages(
            fitPromptForSend(toProviderMessages(preparedMessagesForGen)),
          );
          finalPromptSent = initialProviderMessages;
          rememberMainPromptPreviewForAgents(initialProviderMessages);

          // Reset per-character accumulators
          fullResponse = "";
          fullThinking = "";
          providerThinking = "";
          if (
            tailMessages.assistantPrefillInjected &&
            !tailMessages.googleUserRegenerationInjected &&
            assistantPrefill
          ) {
            await writeContentChunked(assistantPrefill);
          }
          let geminiResponseParts: unknown[] | null = null;
          let chatCompletionsReasoning: Record<string, unknown> | null = null;
          const rememberChatCompletionsReasoning = (metadata: Record<string, unknown>) => {
            chatCompletionsReasoning = readChatCompletionsReasoningMetadata(metadata) ?? metadata;
          };

          // Track timing and usage
          const genStartTime = Date.now();
          let usage: LLMUsage | undefined;
          let finishReason: string | undefined;

          const logPromptSentToModel = (messages: ChatMessage[], label = "Prompt sent to model") => {
            if (isDebug || requestDebug) {
              const effModel = conn.model.toLowerCase();
              const tempSuppressed =
                ((conn.provider === "openai" || conn.provider === "openrouter") &&
                  (/^(o1|o3|o4)/.test(effModel) || (effModel.startsWith("gpt-5") && !!resolvedEffort))) ||
                isClaudeNoSampling;
              const effTemp = tempSuppressed ? "N/A" : temperature;
              const effTopP = tempSuppressed ? "N/A" : topP;

              debugLog(
                "\n[debug] %s (%d messages):\n  Model: %s (%s)  Temp: %s  MaxTokens: %s  MaxContext: %s  TopP: %s  TopK: %s  EnableThinking: %s  ShowThoughts: %s  Effort: %s  Verbosity: %s  Stream: %s",
                label,
                messages.length,
                conn.model,
                conn.provider,
                effTemp,
                effectiveMaxTokensForSend,
                effectiveMaxContext ?? connectionMaxContext ?? "default",
                effTopP,
                providerTopK ?? "default",
                enableThinking,
                showThoughts,
                resolvedEffort ?? "none",
                verbosity ?? "default",
                input.streaming,
              );
              for (const m of messages) {
                const extras: string[] = [];
                if (m.images?.length) extras.push(`images=${m.images.length}`);
                if (m.files?.length) extras.push(`files=${m.files.length}`);
                if (m.tool_call_id) extras.push(`tool_call_id=${m.tool_call_id}`);
                if (m.tool_calls?.length) extras.push(`tool_calls=${JSON.stringify(m.tool_calls)}`);
                if (m.providerMetadata)
                  extras.push(`providerMetadataKeys=${Object.keys(m.providerMetadata).join(",")}`);
                debugLog("  [%s]%s %s", m.role.toUpperCase(), extras.length ? ` ${extras.join(" ")}` : "", m.content);
              }
            }
          };

          if (enableChatTools && provider.chatComplete) {
            const maxToolRounds = getMaxToolRounds();
            let loopMessages: ChatMessage[] = initialProviderMessages;
            // ── Seed encrypted reasoning cache from DB ──
            // OpenAI Responses API uses encrypted reasoning items for multi-turn continuity.
            // These must be replayed on each request. If the in-memory cache was lost (e.g. server
            // restart), recover from the last assistant message's persisted extra.
            // On regens/swipes: clear the cache so we re-derive from the filtered chatMessages
            // (which excludes the message being regenerated). Otherwise we'd replay the reasoning
            // from the discarded response instead of the turn before it.
            if (input.regenerateMessageId) {
              encryptedReasoningCache.delete(input.chatId);
            }
            if (excludePastReasoning) {
              encryptedReasoningCache.delete(input.chatId);
            } else if (!encryptedReasoningCache.has(input.chatId)) {
              for (let i = chatMessages.length - 1; i >= 0; i--) {
                const msg = chatMessages[i]!;
                if (msg.role === "assistant") {
                  const ex = parseExtra(msg.extra);
                  if (Array.isArray(ex.encryptedReasoning) && ex.encryptedReasoning.length > 0) {
                    encryptedReasoningCache.set(input.chatId, ex.encryptedReasoning);
                  }
                  break;
                }
              }
            }

            // Stream tokens in real-time via onToken callback.
            // Some providers (e.g. Gemini with thinking) return the entire response
            // in one chunk. Break large chunks into small pieces so the client sees
            // progressive streaming instead of the whole message appearing at once.
            const onToken = async (chunk: string) => {
              // If the request has been aborted, skip emitting any further tokens.
              if (abortController.signal.aborted) {
                return;
              }
              fullResponse += chunk;
              if (holdForProseGuardianRewrite) {
                return;
              }
              await sendTokenTextChunked(chunk);
            };

            for (let round = 0; round < maxToolRounds; round++) {
              // Treat abort as a silent cancellation: stop the pipeline immediately.
              if (abortController.signal.aborted) {
                return null;
              }

              let result;
              try {
                loopMessages = fitPromptForSend(loopMessages);
                rememberMainPromptPreviewForAgents(loopMessages);
                logPromptSentToModel(
                  loopMessages,
                  round === 0 ? "Prompt sent to model" : `Prompt sent to model (tool round ${round + 1})`,
                );
                result = await provider.chatComplete(loopMessages, {
                  model: conn.model,
                  temperature,
                  maxTokens: effectiveMaxTokensForSend,
                  maxContext: effectiveMaxContext,
                  topP,
                  topK: providerTopK,
                  frequencyPenalty: frequencyPenalty || undefined,
                  presencePenalty: presencePenalty || undefined,
                  minP: minP || undefined,
                  stop: stopSequences.length ? stopSequences : undefined,
                  tools: toolDefs,
                  enableCaching: conn.enableCaching === "true",
                  cachingAtDepth: conn.cachingAtDepth ?? 5,
                  enableThinking,
                  captureReasoning,
                  reasoningEffort: resolvedEffort ?? undefined,
                  verbosity: verbosity ?? undefined,
                  serviceTier,
                  customParameters,
                  enabledParameters,
                  suppressModelParameters,
                  onThinking,
                  onToken: input.streaming ? onToken : undefined,
                  openrouterProvider: conn.openrouterProvider ?? undefined,
                  signal: abortController.signal,
                  encryptedReasoningItems: excludePastReasoning ? undefined : encryptedReasoningCache.get(input.chatId),
                  onEncryptedReasoning: excludePastReasoning
                    ? undefined
                    : (items) => encryptedReasoningCache.set(input.chatId, items),
                  onChatCompletionsReasoning: rememberChatCompletionsReasoning,
                });
              } catch (err: any) {
                // If the error was caused by an abort, cancel silently and skip post-processing.
                if (abortController.signal.aborted || (err && err.name === "AbortError")) {
                  return null;
                }
                throw err;
              }

              // If abort was triggered during chat completion, exit before using the result.
              if (abortController.signal.aborted) {
                return null;
              }

              // If provider doesn't support onToken (fell back to non-streaming),
              // write the content conventionally
              if (result.content && !fullResponse.endsWith(result.content)) {
                await writeContentChunked(result.content);
              }

              // Accumulate usage across tool rounds
              if (result.usage) {
                if (!usage) {
                  usage = { ...result.usage };
                } else {
                  usage.promptTokens += result.usage.promptTokens;
                  usage.completionTokens += result.usage.completionTokens;
                  usage.totalTokens += result.usage.totalTokens;
                  if (result.usage.cachedPromptTokens != null) {
                    usage.cachedPromptTokens = (usage.cachedPromptTokens ?? 0) + result.usage.cachedPromptTokens;
                  }
                  if (result.usage.cacheWritePromptTokens != null) {
                    usage.cacheWritePromptTokens =
                      (usage.cacheWritePromptTokens ?? 0) + result.usage.cacheWritePromptTokens;
                  }
                }
              }
              finishReason = result.finishReason;

              if (!result.toolCalls.length) break;

              loopMessages.push({
                role: "assistant",
                content: result.content ?? "",
                tool_calls: result.toolCalls,
                ...(result.providerMetadata ? { providerMetadata: result.providerMetadata } : {}),
              });

              const permittedToolCalls = result.toolCalls.filter((call) =>
                chatResolvedToolNames.has(call.function.name),
              );
              const deniedToolResults = result.toolCalls
                .filter((call) => !chatResolvedToolNames.has(call.function.name))
                .map((call) => ({
                  toolCallId: call.id,
                  name: call.function.name,
                  result: JSON.stringify({
                    error: `Tool not allowed in this context: ${call.function.name}`,
                    allowed: Array.from(chatResolvedToolNames),
                  }),
                  success: false,
                }));

              const executedToolResults = await executeToolCalls(permittedToolCalls, {
                ...baseToolExecutionContext,
              });
              const toolResultsById = new Map(
                [...executedToolResults, ...deniedToolResults].map((result) => [result.toolCallId, result]),
              );
              const toolResults = result.toolCalls
                .map((call) => toolResultsById.get(call.id))
                .filter((toolResult): toolResult is NonNullable<typeof toolResult> => toolResult != null);

              for (const tr of toolResults) {
                reply.raw.write(
                  `data: ${JSON.stringify({
                    type: "tool_result",
                    data: { name: tr.name, result: tr.result, success: tr.success },
                  })}\n\n`,
                );

                // Persist update_game_state tool calls to the game state DB
                if (tr.name === "update_game_state" && tr.success) {
                  try {
                    const parsed = JSON.parse(tr.result);
                    if (parsed.applied && parsed.update) {
                      const latest = await gameStateStore.getLatest(input.chatId);
                      if (latest) {
                        const u = parsed.update;
                        const updates: Record<string, unknown> = {};
                        if (u.type === "location_change") updates.location = u.value;
                        if (u.type === "time_advance") updates.time = u.value;
                        if (Object.keys(updates).length > 0) {
                          const lockedUpdates = applyTrackerFieldLocksToGameStatePatch(
                            updates,
                            parseGameStateRow(latest as Record<string, unknown>),
                          );
                          await gameStateStore.updateLatest(input.chatId, lockedUpdates);
                          Object.assign(updates, lockedUpdates);
                        }
                        // Send game_state_patch so HUD updates live
                        logger.debug("[game_state_patch] tool update_game_state: %j", updates);
                        reply.raw.write(`data: ${JSON.stringify({ type: "game_state_patch", data: updates })}\n\n`);
                      }
                    }
                  } catch {
                    // Non-critical
                  }
                }
              }

              for (const tr of toolResults) {
                loopMessages.push({
                  role: "tool",
                  content: tr.result,
                  tool_call_id: tr.toolCallId,
                });
              }

              if (round === maxToolRounds - 1) {
                // Reset per-character accumulator for final round content
                const prevLen = fullResponse.length;
                loopMessages = fitPromptForSend(loopMessages);
                rememberMainPromptPreviewForAgents(loopMessages);
                logPromptSentToModel(loopMessages, "Prompt sent to model (final tool follow-up)");
                const finalResult = await provider.chatComplete(loopMessages, {
                  model: conn.model,
                  temperature,
                  maxTokens: effectiveMaxTokensForSend,
                  maxContext: effectiveMaxContext,
                  topP,
                  topK: providerTopK,
                  frequencyPenalty: frequencyPenalty || undefined,
                  presencePenalty: presencePenalty || undefined,
                  minP: minP || undefined,
                  stop: stopSequences.length ? stopSequences : undefined,
                  enableCaching: conn.enableCaching === "true",
                  cachingAtDepth: conn.cachingAtDepth ?? 5,
                  enableThinking,
                  captureReasoning,
                  reasoningEffort: resolvedEffort ?? undefined,
                  verbosity: verbosity ?? undefined,
                  serviceTier,
                  customParameters,
                  enabledParameters,
                  suppressModelParameters,
                  onThinking,
                  onToken: input.streaming ? onToken : undefined,
                  openrouterProvider: conn.openrouterProvider ?? undefined,
                  signal: abortController.signal,
                  encryptedReasoningItems: excludePastReasoning ? undefined : encryptedReasoningCache.get(input.chatId),
                  onEncryptedReasoning: excludePastReasoning
                    ? undefined
                    : (items) => encryptedReasoningCache.set(input.chatId, items),
                  onChatCompletionsReasoning: rememberChatCompletionsReasoning,
                });
                if (finalResult.content && fullResponse.length === prevLen) {
                  await writeContentChunked(finalResult.content);
                }
                if (finalResult.usage) {
                  if (!usage) {
                    usage = { ...finalResult.usage };
                  } else {
                    usage.promptTokens += finalResult.usage.promptTokens;
                    usage.completionTokens += finalResult.usage.completionTokens;
                    usage.totalTokens += finalResult.usage.totalTokens;
                    if (finalResult.usage.cachedPromptTokens != null) {
                      usage.cachedPromptTokens = (usage.cachedPromptTokens ?? 0) + finalResult.usage.cachedPromptTokens;
                    }
                    if (finalResult.usage.cacheWritePromptTokens != null) {
                      usage.cacheWritePromptTokens =
                        (usage.cacheWritePromptTokens ?? 0) + finalResult.usage.cacheWritePromptTokens;
                    }
                  }
                }
                finishReason = finalResult.finishReason;
              }
            }
          } else {
            logPromptSentToModel(initialProviderMessages);
            const gen = provider.chat(initialProviderMessages, {
              model: conn.model,
              temperature,
              maxTokens: effectiveMaxTokensForSend,
              maxContext: effectiveMaxContext,
              topP,
              topK: providerTopK,
              frequencyPenalty: frequencyPenalty || undefined,
              presencePenalty: presencePenalty || undefined,
              minP: minP || undefined,
              stop: stopSequences.length ? stopSequences : undefined,
              stream: input.streaming,
              enableCaching: conn.enableCaching === "true",
              cachingAtDepth: conn.cachingAtDepth ?? 5,
              enableThinking,
              captureReasoning,
              reasoningEffort: resolvedEffort ?? undefined,
              verbosity: verbosity ?? undefined,
              serviceTier,
              customParameters,
              enabledParameters,
              suppressModelParameters,
              openrouterProvider: conn.openrouterProvider ?? undefined,
              onThinking,
              onResponseParts: (parts) => {
                geminiResponseParts = parts;
              },
              signal: abortController.signal,
              encryptedReasoningItems: excludePastReasoning ? undefined : encryptedReasoningCache.get(input.chatId),
              onEncryptedReasoning: excludePastReasoning
                ? undefined
                : (items) => encryptedReasoningCache.set(input.chatId, items),
              onChatCompletionsReasoning: rememberChatCompletionsReasoning,
            });
            try {
              let result = await gen.next();
              while (!result.done) {
                if (abortController.signal.aborted) {
                  return null;
                }
                fullResponse += result.value;
                // Break large chunks (e.g. Gemini non-streaming) into small pieces
                // so the client sees progressive streaming.
                const val = result.value;
                if (holdForProseGuardianRewrite) {
                  result = await gen.next();
                  continue;
                }
                await sendTokenTextChunked(val);
                result = await gen.next();
              }
              // Generator return value contains usage
              if (result.value) usage = result.value;
            } catch (err) {
              if (abortController.signal.aborted || isAbortLikeError(err)) {
                return null;
              }
              throw err;
            }
            if (abortController.signal.aborted) {
              return null;
            }
          }

          const durationMs = Date.now() - genStartTime;

          if (input.debugMode && chatMode === "game") {
            debugLog(
              "[generate/game/raw] chatId=%s characterId=%s chars=%d BEGIN",
              input.chatId,
              targetCharId ?? "gm",
              fullResponse.length,
            );
            debugLog("[generate/game/raw] %s", fullResponse);
            debugLog("[generate/game/raw] chatId=%s characterId=%s END", input.chatId, targetCharId ?? "gm");
          }

          // Some models inline reasoning blocks instead of using provider-native
          // thinking channels. Lift those blocks into message.extra.thinking.
          const inlineThinking = extractLeadingThinkingBlocks(fullResponse, customThinkingTags);
          if (inlineThinking.stripped) {
            if (inlineThinking.thinking) {
              fullThinking = fullThinking ? fullThinking + "\n\n" + inlineThinking.thinking : inlineThinking.thinking;
            }
            fullResponse = inlineThinking.content;
            if (!holdForProseGuardianRewrite) {
              reply.raw.write(`data: ${JSON.stringify({ type: "content_replace", data: fullResponse })}\n\n`);
            }
          }

          // ── LOG_LEVEL=debug or Settings -> Advanced -> Debug mode: log full response + usage to server console ──
          if (isDebug || requestDebug) {
            debugLog("[debug] LLM response (%d chars, %dms):\n%s", fullResponse.length, durationMs, fullResponse);
            if (fullThinking) {
              debugLog("[debug] Thinking tokens (%d chars):\n%s", fullThinking.length, fullThinking);
            }
            if (usage) {
              const hiddenCompletionTokens = getHiddenCompletionTokens(usage);
              const visibleCompletionTokens = getVisibleCompletionTokens(usage);
              const hiddenThinkingUnreported = fullThinking.trim().length > 0 && hiddenCompletionTokens == null;
              debugLog(
                "[debug] Token usage — prompt: %s  completion: %s  visibleCompletion: %s  reasoning: %s  total: %s  cached: %s  cacheWrite: %s  finish: %s",
                usage.promptTokens ?? "N/A",
                usage.completionTokens ?? "N/A",
                hiddenThinkingUnreported
                  ? "unknown (provider did not split hidden thinking)"
                  : (visibleCompletionTokens ?? "N/A"),
                usage.completionReasoningTokens ?? (hiddenThinkingUnreported ? "unreported" : "N/A"),
                usage.totalTokens ?? "N/A",
                usage.cachedPromptTokens ?? "N/A",
                usage.cacheWritePromptTokens ?? "N/A",
                finishReason ?? "N/A",
              );
              if (
                fullThinking.trim().length > 0 &&
                typeof usage.completionTokens === "number" &&
                typeof effectiveMaxTokensForSend === "number" &&
                usage.completionTokens >= effectiveMaxTokensForSend
              ) {
                debugLog(
                  "[debug] Completion budget warning — hidden thinking was present and completion usage reached maxTokens=%s; visible response may be short even when finish=%s.",
                  effectiveMaxTokensForSend,
                  finishReason ?? "N/A",
                );
              }
            }
          }

          // ── Parse and strip hidden character commands ──
          let parsedCommands: CharacterCommand[] = [];
          let conversationCommandContent: string | null = null;
          let contentReplaced = false;
          if (tailMessages.assistantPrefillInjected && assistantPrefill && fullResponse.startsWith(assistantPrefill)) {
            const responseAfterPrefill = fullResponse.slice(assistantPrefill.length);
            if (responseAfterPrefill.startsWith(assistantPrefill)) {
              fullResponse = assistantPrefill + responseAfterPrefill.slice(assistantPrefill.length);
              contentReplaced = true;
            }
          }
          const promotableThinking = providerThinking.trim() || fullThinking.trim();
          // Some OpenAI-compatible providers misplace the actual assistant text
          // in reasoning/thinking fields. Conversation mode only recovers when
          // reasoning was not requested; game mode requests reasoning by default,
          // so it still needs the recovery path to avoid empty GM turns.
          const isGlmModel = conn.model.toLowerCase().includes("glm");
          const shouldPromoteThinkingOnlyResponse =
            chatMode === "conversation" ? !enableThinking && !resolvedEffort : chatMode === "game";
          if (!fullResponse.trim() && promotableThinking && shouldPromoteThinkingOnlyResponse) {
            if (isGlmModel) {
              logger.warn(
                "[generate] Refusing to promote GLM thinking-only response for chat %s (char: %s, model: %s)",
                input.chatId,
                targetCharId,
                conn.model,
              );
            } else {
              logger.warn(
                "[generate] Promoting thinking-only response to visible text for %s chat %s (char: %s, model: %s)",
                chatMode,
                input.chatId,
                targetCharId,
                conn.model,
              );
              fullResponse = promotableThinking;
              fullThinking = "";
              providerThinking = "";
              contentReplaced = true;
            }
          }
          if (conversationCommandsEnabled && !input.impersonate) {
            const responseBeforeCommandParsing = fullResponse;
            const parsed = parseCharacterCommands(fullResponse);
            if (parsed.commands.length > 0) {
              parsedCommands = filterEnabledConversationCommands(parsed.commands, chatMeta);
              if (parsedCommands.length > 0) {
                conversationCommandContent = responseBeforeCommandParsing.trim();
              }
              fullResponse = parsed.cleanContent;
              contentReplaced = true;
              logger.info(
                "[generate] Parsed %d character command(s), %d enabled: %j",
                parsed.commands.length,
                parsedCommands.length,
                parsedCommands.map((c) => c.type),
              );
            }
            const recoveredSelfieCommand = recoverImplicitSelfieCommand({
              response: fullResponse,
              latestUserMessage: input.userMessage,
              imageGenerationEnabled:
                isConversationCommandEnabled(chatMeta, "selfie") &&
                typeof chatMeta.imageGenConnectionId === "string" &&
                chatMeta.imageGenConnectionId.trim().length > 0,
              existingCommands: parsedCommands,
            });
            if (recoveredSelfieCommand) {
              parsedCommands = [...parsedCommands, recoveredSelfieCommand];
              logger.info("[generate] Recovered implicit selfie command for chat %s", input.chatId);
            }
          }
          if (roleplayDmCommandsEnabled) {
            const parsed = parseDirectMessageCommands(fullResponse);
            if (parsed.commands.length > 0) {
              const allCharacters = (await chars.list()) as Array<{ id: string; data?: unknown }>;
              const executableCommands: DirectMessageCommand[] = [];
              const skippedTargets: string[] = [];
              let nextResponse = fullResponse;

              for (const command of parsed.commands) {
                const target = resolveRoleplayDmTarget(command.character, charInfo, allCharacters);
                if (target) {
                  executableCommands.push({
                    ...command,
                    resolvedCharacterId: target.id,
                    resolvedCharacterName: target.name,
                  });
                  nextResponse = replaceRoleplayDmCommandText(nextResponse, command, "");
                } else {
                  skippedTargets.push(command.character);
                  nextResponse = replaceRoleplayDmCommandText(
                    nextResponse,
                    command,
                    formatUnresolvedRoleplayDmFallback(command),
                  );
                }
              }

              if (executableCommands.length > 0) {
                parsedCommands = [...parsedCommands, ...executableCommands];
              }
              fullResponse = nextResponse.replace(/\n{3,}/g, "\n\n").trim();
              contentReplaced = true;
              logger.info(
                "[generate] Parsed %d executable roleplay DM command(s), skipped %d cardless target(s): %j",
                executableCommands.length,
                skippedTargets.length,
                executableCommands.map((c) => c.resolvedCharacterName ?? c.character),
              );
              for (const target of skippedTargets) {
                logger.warn('[generate] Skipped roleplay DM command for cardless target "%s"', target);
              }
            }
          }

          // ── Extract <ooc> tags from roleplay responses and post to connected conversation ──
          let oocMessages: string[] = [];
          if (chatMode === "roleplay" && !input.impersonate && chat.connectedChatId) {
            const OOC_RE = /<ooc>([\s\S]*?)<\/ooc>/gi;
            for (const match of fullResponse.matchAll(OOC_RE)) {
              const text = match[1]!.trim();
              if (text) oocMessages.push(text);
            }
            if (oocMessages.length > 0) {
              fullResponse = fullResponse
                .replace(OOC_RE, "")
                .replace(/\n{3,}/g, "\n\n")
                .trim();
              contentReplaced = true;
              logger.info(
                `[generate] Extracted ${oocMessages.length} OOC message(s) for conversation ${chat.connectedChatId}`,
              );
            }
          }

          // ── Strip character name prefix in individual group mode ──
          // LLMs often prefix the response with the character name even when told not to.
          // Also strip any leftover <speaker> tags from individual mode responses.
          if (isGroupChat && groupChatMode === "individual" && targetCharId) {
            const charRow = charInfo.find((c) => c.id === targetCharId);
            if (charRow) {
              const cName = charRow.name;
              const escapedName = cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              // Strip <speaker="Name">...</speaker> wrapper if present
              const speakerWrap = new RegExp(`^\\s*<speaker="${escapedName}">[\\s\\S]*?<\\/speaker>\\s*$`, "i");
              const speakerMatch = fullResponse.match(speakerWrap);
              if (speakerMatch) {
                fullResponse = fullResponse
                  .replace(/<speaker="[^"]*">/gi, "")
                  .replace(/<\/speaker>/gi, "")
                  .trim();
                contentReplaced = true;
              }
              // Strip plain name prefixes: "Dottore: text" or "Dottore\ntext".
              const beforeNamePrefixStrip = fullResponse;
              fullResponse = fullResponse
                .replace(new RegExp(`^\\s*${escapedName}\\s*:\\s*`, "i"), "")
                .replace(new RegExp(`^\\s*${escapedName}\\s*\\n+`, "i"), "")
                .trimStart();
              if (fullResponse !== beforeNamePrefixStrip) {
                contentReplaced = true;
              }
            }
          }

          // ── Strip leaked timestamps from conversation mode responses ──
          // Models sometimes echo [HH:MM] timestamps despite instructions not to.
          // Strip them before storage to prevent compounding on future generations.
          if (chatMode === "conversation" && !input.impersonate) {
            const beforeStrip = fullResponse;
            fullResponse = fullResponse
              .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/gm, "")
              .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/gm, "")
              .trim();
            if (fullResponse !== beforeStrip) {
              contentReplaced = true;
            }
          }

          if (input.trimIncompleteModelOutput && !input.impersonate) {
            const beforeTrim = fullResponse;
            fullResponse = trimIncompleteModelEnding(fullResponse);
            if (fullResponse !== beforeTrim) {
              contentReplaced = true;
              logger.debug(
                "[generate] Trimmed incomplete model ending for chat %s (%d -> %d chars)",
                input.chatId,
                beforeTrim.length,
                fullResponse.length,
              );
            }
          }

          if (chatMode === "roleplay") {
            const beforeRoleplayWhitespace = fullResponse;
            fullResponse = stripSpacesBeforeLineBreaks(fullResponse).trim();
            if (fullResponse !== beforeRoleplayWhitespace) {
              contentReplaced = true;
            }
          }

          if (contentReplaced) {
            if (!holdForProseGuardianRewrite) {
              reply.raw.write(`data: ${JSON.stringify({ type: "content_replace", data: fullResponse })}\n\n`);
            }
          }

          // Guard: don't save empty responses — the model returned nothing useful.
          // Exception: if the model emitted character commands (e.g. [fetch:...]) with
          // no surrounding prose, treat the commands as the useful output. Skip saving
          // a blank assistant bubble but still return the commands so they execute.
          if (!fullResponse.trim()) {
            if (!input.impersonate && parsedCommands.length > 0) {
              logger.info(
                "[generate] Model emitted %d command(s) with no visible prose for chat %s; saving hidden command anchor",
                parsedCommands.length,
                input.chatId,
              );
              const savedMsg = await chats.createMessage({
                chatId: input.chatId,
                role: "assistant",
                characterId: targetCharId,
                content: "",
              });
              const anchoredMsg = savedMsg?.id
                ? await chats.updateMessageExtra(savedMsg.id, {
                    hiddenFromUser: true,
                    hiddenFromAI: !conversationCommandContent,
                    commandOnly: true,
                    conversationCommandContent: conversationCommandContent ?? null,
                    isGenerated: true,
                  })
                : savedMsg;
              if (markGenerationCommitted && anchoredMsg?.id) {
                generationComplete = true;
              }
              if (chatMode === "conversation" && !input.regenerateMessageId) {
                recordAssistantActivity(input.chatId, targetCharId ?? undefined);
                conversationAssistantSaved = true;
              }
              await recordSavedAutonomousGeneration(targetCharId);
              return {
                savedMsg: anchoredMsg,
                response: "",
                commands: parsedCommands,
                oocMessages,
                characterId: targetCharId,
              };
            }
            logger.warn(`[generate] Empty response from model for chat ${input.chatId} (char: ${targetCharId})`);
            reply.raw.write(
              `data: ${JSON.stringify({ type: "error", data: "The AI returned an empty response. Try sending your message again." })}\n\n`,
            );
            return null;
          }

          // Save assistant message (or user message for impersonate)
          let savedMsg: any;
          if (input.regenerateMessageId) {
            savedMsg = await chats.addSwipe(input.regenerateMessageId, fullResponse);
            savedMsg = await chats.getMessage(input.regenerateMessageId);
          } else if (input.continueMessageId) {
            const targetMessage = (await chats.getMessage(input.continueMessageId)) ?? continueTargetMessage;
            savedMsg = await chats.updateMessageContent(
              input.continueMessageId,
              appendContinuationMessageContent(targetMessage?.content, fullResponse),
            );
          } else {
            savedMsg = await chats.createMessage({
              chatId: input.chatId,
              role: input.impersonate ? "user" : "assistant",
              characterId: input.impersonate ? null : targetCharId,
              content: fullResponse,
            });
          }
          if (markGenerationCommitted && savedMsg?.id) {
            generationComplete = true;
          }
          if (chatMode === "conversation" && !input.impersonate && !input.regenerateMessageId) {
            recordAssistantActivity(input.chatId, targetCharId ?? undefined);
            await recordSavedAutonomousGeneration(targetCharId);
            conversationAssistantSaved = true;
          }

          // Persist thinking/reasoning and generation info
          if (savedMsg?.id) {
            const extraUpdate: Record<string, unknown> = {
              generationInfo: {
                model: conn.model,
                provider: conn.provider,
                temperature: temperature ?? null,
                maxTokens: effectiveMaxTokensForSend ?? null,
                maxContext: suppressModelParameters ? null : (effectiveMaxContext ?? connectionMaxContext ?? null),
                showThoughts: showThoughts ?? null,
                reasoningEffort: resolvedEffort ?? reasoningEffort ?? null,
                verbosity: verbosity ?? null,
                serviceTier,
                assistantPrefill: assistantPrefill || null,
                customParameters: Object.keys(customParameters).length > 0 ? customParameters : null,
                tokensPrompt: usage?.promptTokens ?? null,
                tokensCompletion: usage?.completionTokens ?? null,
                tokensVisibleCompletion: getVisibleCompletionTokens(usage) ?? null,
                tokensReasoning: usage?.completionReasoningTokens ?? null,
                tokensCompletionAudio: usage?.completionAudioTokens ?? null,
                tokensRejectedPrediction: usage?.rejectedPredictionTokens ?? null,
                tokensCachedPrompt: usage?.cachedPromptTokens ?? null,
                tokensCacheWritePrompt: usage?.cacheWritePromptTokens ?? null,
                durationMs,
                finishReason: finishReason ?? null,
              },
            };
            if (fullThinking) extraUpdate.thinking = fullThinking;
            else extraUpdate.thinking = null;
            // Store Gemini response parts (thought signatures + summaries) for multi-turn continuity
            if (geminiResponseParts) extraUpdate.geminiParts = geminiResponseParts;
            // Store Chat Completions reasoning fields for providers that require replay (DeepSeek/OpenRouter)
            if (chatCompletionsReasoning) extraUpdate.chatCompletionsReasoning = chatCompletionsReasoning;
            else extraUpdate.chatCompletionsReasoning = null;
            // Store OpenAI Responses API encrypted reasoning items for multi-turn continuity
            const cachedReasoning = encryptedReasoningCache.get(input.chatId);
            if (cachedReasoning?.length) extraUpdate.encryptedReasoning = cachedReasoning;
            else extraUpdate.encryptedReasoning = null;
            // Cache the exact prompt injections used for this swipe so future
            // regenerations and swipe switches replay the same guidance.
            extraUpdate.contextInjections = contextInjections.length > 0 ? contextInjections : null;
            extraUpdate.conversationCommandContent =
              chatMode === "conversation" && !input.impersonate ? conversationCommandContent : null;
            extraUpdate.generationReplay = buildGenerationReplay(input);
            // Cache the final prompt (what was actually sent to the model) for Peek Prompt
            extraUpdate.cachedPrompt = finalPromptSent.map((m) => ({ role: m.role, content: m.content }));
            // Cache the lorebook scan that produced the prompt so Active Context
            // reflects the last generation instead of a best-effort rescan.
            extraUpdate.lorebookScan = lorebookScanSnapshot;
            extraUpdate.chatSummaryFingerprint = fingerprintChatSummary(chatMeta.summary);
            const persistentAttachments = resolveUserRegenerationPersistentAttachments(regenMsg ?? {});
            if (persistentAttachments) extraUpdate.attachments = persistentAttachments;
            await chats.updateMessageExtra(savedMsg.id, extraUpdate);
            // Also persist on the active swipe so switching swipes preserves per-swipe extras
            const refreshedMsg = await chats.getMessage(savedMsg.id);
            if (refreshedMsg) {
              await chats.updateSwipeExtra(savedMsg.id, refreshedMsg.activeSwipeIndex, extraUpdate);
            }

            const savedMessagePayload =
              holdForProseGuardianRewrite && !input.impersonate
                ? {
                    ...(refreshedMsg ?? savedMsg),
                    content: textRewritePendingState?.message ?? PROSE_GUARDIAN_PENDING_MESSAGE,
                    extra: {
                      ...parseExtra((refreshedMsg ?? savedMsg).extra),
                      postProcessingPending: {
                        agentType: textRewritePendingState?.agentType ?? "prose-guardian",
                        message: textRewritePendingState?.message ?? PROSE_GUARDIAN_PENDING_MESSAGE,
                      },
                    },
                  }
                : (refreshedMsg ?? savedMsg);
            sendSseEvent(reply, {
              type: "message_saved",
              data: savedMessagePayload,
            });

            if (chatMode === "game" && !input.impersonate) {
              const mapUpdates = parseMapUpdateCommands(fullResponse);
              if (mapUpdates.length > 0) {
                try {
                  const freshChat = await chats.getById(input.chatId);
                  const freshMeta = freshChat ? (parseExtra(freshChat.metadata) as Record<string, unknown>) : chatMeta;
                  const originalMap = (freshMeta.gameMap as GameMap | null) ?? null;
                  let nextMap = originalMap;
                  let latestLocation: string | null = null;

                  for (const command of mapUpdates) {
                    const updatedMap = applyMapUpdateCommand(nextMap, command);
                    if (!updatedMap) continue;
                    nextMap = updatedMap;
                    latestLocation = command.newLocation;
                  }

                  if (nextMap && nextMap !== originalMap) {
                    const nextMeta = withActiveGameMapMeta(freshMeta, nextMap);
                    await chats.updateMetadata(input.chatId, nextMeta);
                    chatMeta.gameMap = nextMeta.gameMap;
                    chatMeta.gameMaps = nextMeta.gameMaps;
                    chatMeta.activeGameMapId = nextMeta.activeGameMapId;
                    sendSseEvent(reply, { type: "game_map_update", data: nextMeta.gameMap });

                    const persistedMsg = refreshedMsg ?? savedMsg;
                    if (latestLocation && persistedMsg?.id) {
                      const persistedSwipeIndex = persistedMsg.activeSwipeIndex ?? 0;
                      const targetSnapshot =
                        (await gameStateStore.getByMessage(persistedMsg.id, persistedSwipeIndex)) ??
                        baseGameStateSnapshot;
                      const locationPatch = applyTrackerFieldLocksToGameStatePatch(
                        { location: latestLocation },
                        targetSnapshot ? parseGameStateRow(targetSnapshot as Record<string, unknown>) : null,
                      );
                      await gameStateStore.updateByMessage(
                        persistedMsg.id,
                        persistedSwipeIndex,
                        input.chatId,
                        locationPatch,
                        undefined,
                        { baseSnapshot: baseGameStateSnapshot },
                      );
                      sendSseEvent(reply, { type: "game_state_patch", data: locationPatch });
                    }

                    logger.info(
                      "[generate/game/map_update] chatId=%s applied=%d location=%s",
                      input.chatId,
                      mapUpdates.length,
                      latestLocation ?? "",
                    );
                  }
                } catch (err) {
                  logger.warn(err, "[generate/game/map_update] Failed to apply map_update");
                }
              }
            }

            // Evict cachedPrompt from older messages to save storage (keep last 2 assistant msgs)
            const allMsgs = await chats.listMessages(input.chatId);
            const assistantMsgIds = allMsgs.filter((m) => m.role === "assistant").map((m) => m.id);
            const staleIds = assistantMsgIds.slice(0, -2);
            for (const staleId of staleIds) {
              const staleMsg = await chats.getMessage(staleId);
              if (!staleMsg) continue;
              const staleExtra =
                typeof staleMsg.extra === "string" ? JSON.parse(staleMsg.extra) : (staleMsg.extra ?? {});
              if (!staleExtra.cachedPrompt) continue;
              await chats.updateMessageExtra(staleId, { cachedPrompt: null });
              // Also clean swipes
              const swipes = await chats.getSwipes(staleId);
              for (const sw of swipes) {
                const swExtra = typeof sw.extra === "string" ? JSON.parse(sw.extra) : (sw.extra ?? {});
                if (swExtra.cachedPrompt) {
                  await chats.updateSwipeExtra(staleId, sw.index, { cachedPrompt: null });
                }
              }
            }
          }

          // Mirror character response to Discord (fire-and-forget, skip regens/swipes)
          if (discordWebhookUrl && fullResponse.trim() && !input.impersonate && !input.regenerateMessageId) {
            const charName =
              chatMode === "game"
                ? await resolveGameDiscordSpeakerName()
                : (charInfo.find((c) => c.id === targetCharId)?.name ?? "Character");
            postToDiscordWebhook(discordWebhookUrl, { content: fullResponse, username: charName });
          }

          return {
            savedMsg,
            response: fullResponse,
            commands: parsedCommands,
            oocMessages,
            characterId: targetCharId,
          };
        };

        // ────────────────────────────────────────
        // Phase 2: Fire parallel agents alongside the main generation
        // ────────────────────────────────────────
        const hasParallelAgents = pipelineAgents.some((a) => a.phase === "parallel");
        let parallelPromise: Promise<AgentResult[]> | null = null;
        if (hasParallelAgents && !abortController.signal.aborted) {
          trySendSseEvent(reply, { type: "agent_start", data: { phase: "parallel" } });
          parallelPromise = pipeline.runParallel();
        }

        // ── Run generation ──
        // (firstSavedMsg/lastSavedMsg/collectedCommands/collectedOocMessages
        // are declared above the follow-up loop so they survive iterations.)

        const normalizedGenerationGuide = typeof input.generationGuide === "string" ? input.generationGuide.trim() : "";
        const generationGuideInstruction = normalizedGenerationGuide
          ? `Take the following into special consideration for your next message: ${normalizedGenerationGuide}`
          : null;
        const filterManualTargetProfileBlocks = (messages: typeof finalMessages, targetCharId: string) => {
          if (groupResponseOrder !== "manual") return messages;
          const otherNames = charInfo.filter((c) => c.id !== targetCharId).map((c) => c.name);
          if (otherNames.length === 0) return messages;
          return messages.filter((message) => {
            if (message.role !== "system") return true;
            return !otherNames.some((name) => isStandaloneCharacterProfileBlock(message.content, name));
          });
        };
        const buildCharacterInstruction = (charId: string, charName: string) => {
          if (chatMode !== "conversation") {
            return groupTurnPromptEnabled ? `Respond ONLY as ${charName}.` : null;
          }
          if (groupResponseOrder !== "manual") return `Respond ONLY as ${charName}.`;
          const latestOtherSender = latestVisibleSenderOtherThan(charId);
          return [
            `Respond ONLY as ${charName}.`,
            `This is an invisible manual trigger, not a visible message from ${personaName}. Do not mention being pinged, summoned, selected, or called by the user.`,
            latestOtherSender
              ? `Reply naturally to the latest visible sender other than yourself: ${latestOtherSender}.`
              : `Reply naturally to the ongoing group context.`,
            `If your own previous message is the most relevant last beat, continue naturally instead of answering the hidden trigger as if it came from ${personaName}.`,
            `You may address ${personaName} or another character if that is what the context calls for, but do not speak or act for them.`,
          ].join("\n");
        };

        if (useIndividualLoop) {
          // Individual group mode: generate one response per character
          sendProgress("generating");
          let runningMessages = [...finalMessages];

          if (generationGuideInstruction) {
            runningMessages.push({ role: "system", content: generationGuideInstruction });
          }

          for (let ci = 0; ci < respondingCharIds.length; ci++) {
            if (abortController.signal.aborted) break;
            const charId = respondingCharIds[ci]!;
            const charName = charInfo.find((c) => c.id === charId)?.name ?? "Character";

            // Tell the client which character is responding next
            reply.raw.write(
              `data: ${JSON.stringify({ type: "group_turn", data: { characterId: charId, characterName: charName, index: ci } })}\n\n`,
            );

            // Append "Respond ONLY as [name]" instruction
            const charInstruction = buildCharacterInstruction(charId, charName);
            const messagesWithInstruction = [...filterManualTargetProfileBlocks(runningMessages, charId)];
            // Add as a system message at the end (just before any trailing user message)
            if (charInstruction) {
              messagesWithInstruction.push({ role: "system", content: charInstruction });
            }

            const genResult = await generateForCharacter(
              charId,
              messagesWithInstruction,
              ci === respondingCharIds.length - 1,
            );
            if (!genResult) break; // aborted
            firstSavedMsg ??= genResult.savedMsg;
            lastSavedMsg = genResult.savedMsg;
            recordExpressionTarget(genResult.savedMsg, charId);
            allResponses.push(genResult.response);
            for (const cmd of genResult.commands) {
              collectedCommands.push({
                command: cmd,
                characterId: charId,
                messageId: genResult.savedMsg?.id ?? "",
                swipeIndex: genResult.savedMsg?.activeSwipeIndex ?? 0,
              });
            }
            collectedOocMessages.push(...genResult.oocMessages);

            // Add this character's response to the running context for the next character
            runningMessages.push({
              role: "assistant",
              content: genResult.response,
              contextKind: "history",
              characterId: charId,
            });
          }
        } else {
          // Single/merged: one generation
          sendProgress("generating");
          let targetCharId = characterIds[0] ?? null;
          const sentMessages = [...finalMessages];

          if (generationGuideInstruction) {
            sentMessages.push({ role: "system", content: generationGuideInstruction });
          }

          if (mentionedConversationCharacters.length > 0 && !regenGroupChatIndividual) {
            const mentionedNames = mentionedConversationCharacters.map((character) => character.name);

            if (mentionedConversationCharacters.length === 1) {
              const mentionedCharacter = mentionedConversationCharacters[0]!;
              targetCharId = mentionedCharacter.id;
              sentMessages.push({
                role: "system",
                content: `Respond ONLY as ${mentionedCharacter.name}. The user's latest message explicitly @mentions ${mentionedCharacter.name}, so no other character should reply to this turn.`,
              });
            } else {
              sentMessages.push({
                role: "system",
                content: `The user's latest message explicitly @mentions ${mentionedNames.join(", ")}. Only those mentioned characters may reply to this turn. Do not include any response lines from any other character.`,
              });
            }
          }

          if (regenGroupChatIndividual) {
            if (regenMsg?.chatId !== input.chatId) {
              sendSseEvent(reply, { type: "error", data: "Regenerated message does not belong to this chat" });
              return;
            }
            if (!regenMsg?.characterId) {
              sendSseEvent(reply, { type: "error", data: "Regenerated message is missing character" });
              return;
            }

            // Get character of regenerated message and append "Respond ONLY as [name]" instruction
            targetCharId = regenMsg?.characterId ?? null;
            const targetCharName = charInfo.find((c) => c.id === targetCharId)?.name ?? "Character";
            const charInstruction = targetCharId
              ? buildCharacterInstruction(targetCharId, targetCharName)
              : groupTurnPromptEnabled
                ? `Respond ONLY as ${targetCharName}.`
                : null;
            if (charInstruction) {
              sentMessages.push({ role: "system", content: charInstruction });
            }
          }

          const genResult = await generateForCharacter(targetCharId, sentMessages, true);
          if (genResult) {
            firstSavedMsg ??= genResult.savedMsg;
            lastSavedMsg = genResult.savedMsg;
            recordExpressionTarget(genResult.savedMsg, genResult.characterId);
            for (const cmd of genResult.commands) {
              collectedCommands.push({
                command: cmd,
                characterId: genResult.characterId,
                messageId: genResult.savedMsg?.id ?? "",
                swipeIndex: genResult.savedMsg?.activeSwipeIndex ?? 0,
              });
            }
            collectedOocMessages.push(...genResult.oocMessages);
          }
          allResponses.push(fullResponse);
        }

        // ────────────────────────────────────────
        // Collect parallel results + Phase 3: Post-processing agents
        // ────────────────────────────────────────
        // Await parallel agents that were started alongside the generation
        let parallelResults: AgentResult[] = [];
        if (parallelPromise) {
          try {
            parallelResults = await parallelPromise;
          } catch {
            // Non-critical — parallel agents may fail independently
          }
        }

        // Persist successful one-shot Narrative Director runs for agent history.
        // Pre-gen runs before the assistant message exists, so anchor the run to
        // the first saved assistant message from this turn.
        const preGenAnchorMessageId =
          (firstSavedMsg as any)?.role === "assistant" ? ((firstSavedMsg as any)?.id ?? "") : "";
        if (preGenAnchorMessageId && !input.regenerateMessageId && !abortController.signal.aborted) {
          const preGenSuccessful = pipeline.results.filter((r) => {
            if (!r.success || r.agentType !== "director") return false;
            const cfg = pipelineAgents.find((a) => a.type === r.agentType);
            return cfg?.phase === "pre_generation";
          });
          const directorSecretPlotSuccessful = directorSecretPlotResults.filter(
            (result) => result.success && result.agentType === "director" && result.type === "secret_plot",
          );
          for (const result of [...preGenSuccessful, ...directorSecretPlotSuccessful]) {
            try {
              await agentsStore.saveRun({
                agentConfigId: result.agentId,
                chatId: input.chatId,
                messageId: preGenAnchorMessageId,
                result,
              });
            } catch (err) {
              logger.warn(err, "[agents] Failed to persist Narrative Director run");
            }
          }
          if (directorSecretPlotSuccessful.length > 0) {
            try {
              await agentsStore.setMemory(
                directorSecretPlotSuccessful.at(-1)!.agentId,
                input.chatId,
                DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY,
                preGenAnchorMessageId,
              );
            } catch (err) {
              logger.warn(err, "[narrative-director] Failed to persist secret plot cadence anchor");
            }
          }
        }

        const hasPostProcessingAgents = resolvedAgents.some((a) => a.phase === "post_processing");
        const combinedResponse = allResponses.join("\n\n");
        let lorebookKeeperProcessedMessageId = "";
        // Illustration runs asynchronously so it doesn't block other agents.
        // (pendingIllustration is hoisted above the follow-up loop.)
        const hasPostWork = hasPostProcessingAgents || parallelResults.length > 0;
        const latestAssistantMessageId =
          (lastSavedMsg as any)?.role === "assistant" ? ((lastSavedMsg as any)?.id ?? "") : "";

        const runAutomaticRoleplaySummary = async () => {
          if (
            !latestAssistantMessageId ||
            !isRoleplaySummaryMode(chatMode) ||
            !isAutomaticRoleplaySummaryEnabled(chatMeta) ||
            abortController.signal.aborted
          ) {
            return;
          }

          const freshMessages = await chats.listMessages(input.chatId);
          const lastAutomaticSummaryMessageId =
            typeof chatMeta.lastAutomaticSummaryMessageId === "string" && chatMeta.lastAutomaticSummaryMessageId.trim()
              ? chatMeta.lastAutomaticSummaryMessageId.trim()
              : null;
          const messagesSinceLastSummary = countUserMessagesAfterAnchor(freshMessages, lastAutomaticSummaryMessageId);
          const interval = clampRoleplaySummaryInterval(chatMeta.summaryRunInterval);
          if (messagesSinceLastSummary < interval) return;

          const contextSize = clampRoleplaySummaryContextSize(chatMeta.summaryContextSize);
          const selectedMessages = freshMessages
            .filter((message: any) => !isMessageHiddenFromAI(message))
            .slice(-contextSize);
          if (selectedMessages.length === 0) return;

          const resolvedSummaryConnection = await resolveChatSummaryConnection({
            chatConnectionId: chat.connectionId,
            chatMetadata: chatMeta,
            connections,
            resolveBaseUrl,
          });
          if (!resolvedSummaryConnection.ok) {
            logger.warn(
              { chatId: input.chatId, warnings: resolvedSummaryConnection.warnings },
              "[chat-summary] Skipping automatic summary because no summary connection is usable",
            );
            return;
          }
          if (resolvedSummaryConnection.warnings.length > 0) {
            logger.warn(
              {
                chatId: input.chatId,
                connectionId: resolvedSummaryConnection.connectionId,
                source: resolvedSummaryConnection.source,
                warnings: resolvedSummaryConnection.warnings,
              },
              "[chat-summary] Resolved automatic summary connection after fallback",
            );
          }
          const summaryProvider = resolvedSummaryConnection.provider;
          const summaryModel = resolvedSummaryConnection.model;

          const chatLog = selectedMessages
            .map((message: any) => `[${message.role}]: ${(message.content as string).slice(0, 2000)}`)
            .join("\n\n");
          const previousSummary = typeof chatMeta.summary === "string" ? chatMeta.summary.trim() : "";
          const result = await summaryProvider.chatComplete(
            [
              { role: "system", content: resolveChatSummaryPromptFromMetadata(chatMeta) },
              {
                role: "user",
                content:
                  (previousSummary ? `Previous summary:\n${previousSummary}\n\n` : "") +
                  `Recent conversation:\n${chatLog}`,
              },
            ],
            {
              model: summaryModel,
              temperature: 0.5,
              maxTokens: 2048,
              signal: abortController.signal,
            },
          );
          if (abortController.signal.aborted) return;
          const newText = result.content ? parseChatSummaryText(result.content) : "";

          let createdEntry: ChatSummaryEntry | null = null;
          let summaryEntries: ChatSummaryEntry[] = [];
          const shouldReviewSummary = requireAgentWriteApproval && !!newText;
          const autoEntryMessageIds = selectedMessages.map((message: any) => message.id);
          // Compute the hide subset up front so it can be persisted on the entry
          // (deletion restores exactly this set) and reused for the actual hide.
          const autoHideIds =
            newText && !shouldReviewSummary && chatMeta.hideSummarisedMessages === true
              ? computeSummaryHideIds({
                  messages: freshMessages,
                  entryMessageIds: autoEntryMessageIds,
                  tail: resolveRoleplaySummaryTail(chatMeta.summaryTailMessages),
                })
              : [];
          const updatedChat = await chats.patchMetadata(
            input.chatId,
            (currentMeta) => {
              const activeAgentIds = withoutRetiredChatSummaryAgentIds(currentMeta);
              const basePatch: Record<string, unknown> = {
                automaticSummaryEnabled: true,
                lastAutomaticSummaryMessageId: latestAssistantMessageId,
                ...(activeAgentIds ? { activeAgentIds } : {}),
              };
              if (!newText || shouldReviewSummary) return basePatch;

              const now = new Date().toISOString();
              const appended = appendChatSummaryEntryToMetadata(
                currentMeta,
                {
                  kind: "rolling",
                  origin: "automated",
                  sourceMode: "agent",
                  content: newText,
                  enabled: true,
                  messageCount: selectedMessages.length,
                  messageIds: autoEntryMessageIds,
                  ...(autoHideIds.length > 0 ? { hiddenMessageIds: autoHideIds } : {}),
                  promptTemplateId:
                    typeof chatMeta.activeSummaryPromptTemplateId === "string"
                      ? chatMeta.activeSummaryPromptTemplateId
                      : null,
                  createdAt: now,
                  updatedAt: now,
                },
                { createId: newId, now },
              );
              createdEntry = appended.entry;
              summaryEntries = appended.entries;
              return { ...basePatch, summary: appended.summary, summaryEntries: appended.entries };
            },
            { touchUpdatedAt: false },
          );

          if (updatedChat) {
            chatMeta = parseExtra(updatedChat.metadata) as Record<string, unknown>;
          }
          if (newText) {
            if (shouldReviewSummary) {
              trySendSseEvent(reply, {
                type: "agent_write_proposal",
                data: buildSummaryWriteApprovalProposal({
                  chatId: input.chatId,
                  agentType: null,
                  agentName: "Automatic Summary",
                  text: newText,
                  payload: {
                    messageIds: selectedMessages.map((message: any) => message.id),
                    messageCount: selectedMessages.length,
                    promptTemplateId:
                      typeof chatMeta.activeSummaryPromptTemplateId === "string"
                        ? chatMeta.activeSummaryPromptTemplateId
                        : null,
                  },
                }),
              });
            } else {
              const combined = typeof chatMeta.summary === "string" ? chatMeta.summary : newText;
              // Opt-in token compression: hide the messages this summary covered
              // (except the protected recent tail, already excluded in autoHideIds)
              // so the summary is a net token reduction. Best-effort; never aborts
              // the stream. The same set is persisted on the entry above.
              let hiddenMessageIds: string[] = [];
              if (autoHideIds.length > 0) {
                try {
                  await chats.bulkSetHiddenFromAI(input.chatId, autoHideIds, true);
                  hiddenMessageIds = autoHideIds;
                } catch (err) {
                  logger.error(err, "[chat-summary] Failed to auto-hide summarized roleplay messages");
                }
              }
              reply.raw.write(
                `data: ${JSON.stringify({
                  type: "chat_summary",
                  data: { summary: combined, entry: createdEntry, entries: summaryEntries, hiddenMessageIds },
                })}\n\n`,
              );
            }
          }
        };

        if (hasPostWork && combinedResponse && !abortController.signal.aborted) {
          if (personaId && getLatestUserExpressionSource() && Array.isArray(agentContext.memory._availableSprites)) {
            generatedExpressionTargetIds.add(personaId);
          }
          if (generatedExpressionTargetIds.size > 0 && Array.isArray(agentContext.memory._availableSprites)) {
            agentContext.memory._availableSprites = (
              agentContext.memory._availableSprites as Array<{ characterId: string }>
            ).filter((sprite) => generatedExpressionTargetIds.has(sprite.characterId));
            agentContext.memory._expressionTargetIds = [...generatedExpressionTargetIds];
          }
          if (hasPostProcessingAgents) {
            reply.raw.write(`data: ${JSON.stringify({ type: "agent_start", data: { phase: "post_generation" } })}\n\n`);
          }

          // LOG_LEVEL=debug: log post-processing agents
          if (isDebug) {
            const postAgents = pipelineAgents.filter((a) => a.phase === "post_processing");
            app.log.debug(
              "[debug] Post-generation agents (%d): %s",
              postAgents.length,
              postAgents.map((a) => `${a.name} (${a.model})`).join(", "),
            );
          }

          const postAgentContext: AgentContext = {
            ...agentContext,
            mainResponse: combinedResponse,
            preGenInjections: contextInjections,
            parallelResults,
          };

          const finalizeExpressionAgentResult = (result: AgentResult): AgentResult => {
            if (!result.success || result.type !== "sprite_change" || !result.data || typeof result.data !== "object") {
              return result;
            }

            const spriteData = { ...(result.data as Record<string, unknown>) } as {
              expressions?: Array<{
                characterId?: string;
                characterName?: string;
                expression?: string;
                transition?: string;
              }>;
            };
            const availableSprites = agentContext.memory._availableSprites as
              | Array<{ characterId: string; characterName: string; expressions: string[] }>
              | undefined;
            const rawExpressions = Array.isArray(spriteData.expressions) ? spriteData.expressions : [];
            const validation = validateSpriteExpressionEntries(rawExpressions, availableSprites);
            let validatedExpressions = validation.expressions as typeof spriteData.expressions;
            if (!Array.isArray(spriteData.expressions) && rawExpressions.length === 0) {
              logger.warn("[generate] Expression agent returned no expression entries — filling required targets");
            }
            for (const warning of validation.warnings) {
              logger.warn("[generate] %s", warning.message);
            }
            const requiredExpressionTargetIds = normalizeRequiredSpriteExpressionIds(
              agentContext.memory._expressionTargetIds,
            );
            if (requiredExpressionTargetIds.length > 0) {
              const latestUserExpressionSource = getLatestUserExpressionSource();
              const sourceTextByCharacterId = new Map<string, string>();
              if (personaId && latestUserExpressionSource) {
                sourceTextByCharacterId.set(personaId, latestUserExpressionSource);
              }
              const completion = completeRequiredSpriteExpressionEntries(
                validatedExpressions ?? [],
                availableSprites,
                requiredExpressionTargetIds,
                {
                  defaultSourceText: combinedResponse,
                  sourceTextByCharacterId,
                },
              );
              validatedExpressions = completion.expressions as typeof spriteData.expressions;
              for (const warning of completion.warnings) {
                logger.warn("[generate] %s", warning.message);
              }
            }
            spriteData.expressions = validatedExpressions;

            return { ...result, data: spriteData };
          };

          let postResults = hasPostProcessingAgents
            ? [
                ...(await pipeline.postGenerate(combinedResponse, {
                  preGenInjections: contextInjections,
                  parallelResults,
                })),
                ...parallelResults,
              ]
            : [...parallelResults];

          if (lorebookKeeperAgent) {
            const historicalLorebookTarget = getLorebookKeeperAutomaticTarget(
              lorebookKeeperMessages,
              lorebookKeeperSettings.readBehindMessages,
            );
            const lorebookKeeperContext = historicalLorebookTarget
              ? buildHistoricalLorebookKeeperContext(agentContext, lorebookKeeperMessages, historicalLorebookTarget.id)
              : { ...agentContext, mainResponse: combinedResponse };
            const processedMessageId = historicalLorebookTarget?.id ?? (lastSavedMsg as any)?.id ?? "";

            if (lorebookKeeperContext && processedMessageId) {
              lorebookKeeperProcessedMessageId = processedMessageId;
              const lorebookKeeperResult = await executeAgent(
                lorebookKeeperAgent,
                lorebookKeeperContext,
                lorebookKeeperAgent.provider,
                lorebookKeeperAgent.model,
              );
              const finalizedLorebookKeeperResult = markLorebookResultForApproval(lorebookKeeperResult);
              sendAgentEvent(finalizedLorebookKeeperResult);
              postResults.push(finalizedLorebookKeeperResult);
            }
          }

          const spotifyFallbackInputResults = postResults;
          postResults = await applySpotifyAgentPlaybackFallbacks(postResults, resolvedAgents, postAgentContext);
          postResults = postResults.map(markLorebookResultForApproval);
          for (let i = 0; i < postResults.length; i++) {
            const result = postResults[i];
            if (!result) continue;
            if (
              result.agentType === "spotify" ||
              (result.type !== "lorebook_update" && result !== spotifyFallbackInputResults[i])
            ) {
              sendAgentEvent(result, { finalized: result.agentType === "spotify" });
            }
          }

          // ── Auto-retry failed agents once ──
          const failedResults = postResults.filter((r) => !r.success);
          if (failedResults.length > 0 && !abortController.signal.aborted) {
            const retryResults: AgentResult[] = [];
            for (const failed of failedResults) {
              const agentCfg = resolvedAgents.find((a) => a.type === failed.agentType);
              if (!agentCfg) continue;
              try {
                const historicalLorebookTarget =
                  failed.agentType === "lorebook-keeper"
                    ? getLorebookKeeperAutomaticTarget(
                        lorebookKeeperMessages,
                        lorebookKeeperSettings.readBehindMessages,
                      )
                    : null;
                const phaseRetryContext: AgentContext =
                  agentCfg.phase === "post_processing"
                    ? { ...agentContext, mainResponse: combinedResponse }
                    : agentContext;
                const retryCtx: AgentContext = historicalLorebookTarget
                  ? (buildHistoricalLorebookKeeperContext(
                      agentContext,
                      lorebookKeeperMessages,
                      historicalLorebookTarget.id,
                    ) ?? phaseRetryContext)
                  : phaseRetryContext;
                const retried = await executeAgent(
                  agentCfg,
                  retryCtx,
                  agentCfg.provider,
                  agentCfg.model,
                  agentCfg.type === "spotify" ? undefined : agentCfg.toolContext,
                );
                const finalizedRetryResults = await applySpotifyAgentPlaybackFallbacks(
                  [retried],
                  resolvedAgents,
                  retryCtx,
                );
                const finalizedRetry = finalizedRetryResults[0] ?? retried;
                sendAgentEvent(finalizedRetry, { finalized: finalizedRetry.agentType === "spotify" });
                retryResults.push(finalizedRetry);
              } catch {
                retryResults.push(failed);
              }
            }
            // Replace original failed results with retry outcomes
            postResults = postResults.map((r) => {
              if (r.success) return r;
              const retried = retryResults.find((rr) => rr.agentType === r.agentType);
              return retried ?? r;
            });

            // Notify client about agents that still failed after retry
            // Use postResults (not retryResults) so agents skipped during retry (e.g. agentCfg not found) are included
            const stillFailed = postResults.filter((r) => !r.success);
            if (stillFailed.length > 0) {
              reply.raw.write(
                `data: ${JSON.stringify({
                  type: "agents_retry_failed",
                  data: stillFailed.map((r) => ({
                    agentType: r.agentType,
                    agentName: resolvedAgents.find((agent) => agent.type === r.agentType)?.name ?? r.agentType,
                    error: r.error,
                  })),
                })}\n\n`,
              );
            }
          }

          postResults = postResults.map(markLorebookResultForApproval);

          // Finalize expression results before streaming/persisting them so
          // required persona/character entries are visible immediately.
          postResults = postResults.map(finalizeExpressionAgentResult);
          for (const result of postResults) {
            if (shouldDeferExpressionAgentEvent(result)) {
              sendAgentResultEvent(result);
            }
          }

          // LOG_LEVEL=debug: log post-generation agent results
          if (isDebug) {
            for (const r of postResults) {
              app.log.debug(
                "[debug] Agent result: %s — %s (%dms, %d tokens)%s",
                r.agentType,
                r.success ? "OK" : "FAILED",
                r.durationMs,
                r.tokensUsed,
                r.error ? ` — ${r.error}` : "",
              );
            }
          }

          // Persist agent runs to DB + handle game state updates
          // Sort so game_state_update (world-state) is processed before dependent types
          // (character_tracker_update, persona_stats_update) that merge into the snapshot.
          const RESULT_ORDER: Record<string, number> = { game_state_update: 0 };
          const sortedResults = [...postResults].sort(
            (a, b) => (RESULT_ORDER[a.type] ?? 1) - (RESULT_ORDER[b.type] ?? 1),
          );
          const messageId = (lastSavedMsg as any)?.id ?? "";
          // Determine swipe index for this generation so ALL tracker agents target the
          // same (messageId, swipeIndex) snapshot that the world-state agent creates.
          let targetSwipeIndex = 0;
          if (input.regenerateMessageId && messageId) {
            const refreshedForSwipe = await chats.getMessage(messageId);
            if (refreshedForSwipe) targetSwipeIndex = refreshedForSwipe.activeSwipeIndex ?? 0;
          }
          const siblingSwipeSnapshot =
            input.regenerateMessageId && messageId && targetSwipeIndex > 0
              ? await gameStateStore.getByMessage(messageId, targetSwipeIndex - 1)
              : null;
          const trackerBaseGameStateSnapshot = siblingSwipeSnapshot ?? baseGameStateSnapshot;
          const serializeMigratedTrackerLocks = (state: ReturnType<typeof parseGameStateRow> | null) => {
            const locks = normalizeTrackerFieldLocksForState(state?.fieldLocks, state);
            return trackerFieldLocksAreEmpty(locks) ? null : JSON.stringify(locks);
          };

          const resolveAgentImageConnectionId = async (agent: ResolvedAgent | undefined): Promise<string | null> => {
            let imgConnId = (agent?.settings?.imageConnectionId as string) ?? null;
            if (!imgConnId) {
              const defaultImageConn = (await connections.list()).find(
                (c) =>
                  c.provider === "image_generation" && (c.defaultForAgents === true || c.defaultForAgents === "true"),
              );
              imgConnId = defaultImageConn?.id ?? null;
            }
            return imgConnId;
          };

          for (const result of sortedResults) {
            const resultMessageId =
              result.agentType === "lorebook-keeper" && lorebookKeeperProcessedMessageId
                ? lorebookKeeperProcessedMessageId
                : messageId;

            // Validate background agent result — reject hallucinated filenames
            if (
              result.success &&
              result.type === "background_change" &&
              result.data &&
              typeof result.data === "object"
            ) {
              const bgData = result.data as {
                chosen?: string | null;
                generate?: {
                  location?: unknown;
                  locationSlug?: unknown;
                  slug?: unknown;
                  prompt?: unknown;
                  description?: unknown;
                  reason?: unknown;
                } | null;
                generated?: boolean;
                error?: string;
              };
              if (typeof bgData.chosen === "string") {
                bgData.chosen = bgData.chosen.trim() || null;
              } else {
                bgData.chosen = null;
              }
              if (bgData.chosen) {
                const availableBgs = agentContext.memory._availableBackgrounds as
                  | Array<{ filename: string }>
                  | undefined;
                if (availableBgs) {
                  const valid = availableBgs.some((b) => b.filename === bgData.chosen);
                  if (!valid) {
                    logger.warn(`[generate] Background agent chose "${bgData.chosen}" which doesn't exist — rejecting`);
                    bgData.chosen = null;
                  }
                }
              }

              const generationRequest =
                bgData.generate && typeof bgData.generate === "object" && !Array.isArray(bgData.generate)
                  ? bgData.generate
                  : null;
              const currentBackgroundAgent = resolvedAgents.find(
                (a) => a.id === result.agentId || a.type === "background",
              );
              const canGenerateBackground = currentBackgroundAgent?.settings?.autoGenerateBackgrounds === true;
              if (!bgData.chosen && canGenerateBackground && generationRequest) {
                const promptText =
                  typeof generationRequest.prompt === "string" && generationRequest.prompt.trim()
                    ? generationRequest.prompt.trim()
                    : typeof generationRequest.description === "string"
                      ? generationRequest.description.trim()
                      : "";
                const locationSource =
                  typeof generationRequest.location === "string" && generationRequest.location.trim()
                    ? generationRequest.location
                    : typeof generationRequest.locationSlug === "string" && generationRequest.locationSlug.trim()
                      ? generationRequest.locationSlug
                      : typeof generationRequest.slug === "string" && generationRequest.slug.trim()
                        ? generationRequest.slug
                        : typeof generationRequest.reason === "string" && generationRequest.reason.trim()
                          ? generationRequest.reason
                          : promptText;
                const locationText = locationSource.trim();
                if (promptText && locationText) {
                  try {
                    const imgConnId = await resolveAgentImageConnectionId(currentBackgroundAgent);
                    if (!imgConnId) {
                      bgData.error =
                        "No image generation connection set on the Background agent, and no default agent image connection is configured.";
                      trySendSseEvent(reply, {
                        type: "agent_error",
                        data: {
                          agentType: "background",
                          agentName: currentBackgroundAgent?.name ?? "Background",
                          error:
                            "No image generation connection set on the Background agent, and no default agent image connection is configured. Assign one in Settings → Agents → Background.",
                        },
                      });
                    } else {
                      const imgConnFull = await connections.getWithKey(imgConnId);
                      if (!imgConnFull) throw new Error("Cannot resolve Background agent image connection");

                      const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
                      const imageSettings = await loadImageGenerationUserSettings(app.db);
                      const promptOverridesStorage = createPromptOverridesStorage(app.db);
                      const setupConfigForImage =
                        chatMeta.gameSetupConfig &&
                        typeof chatMeta.gameSetupConfig === "object" &&
                        !Array.isArray(chatMeta.gameSetupConfig)
                          ? (chatMeta.gameSetupConfig as Record<string, unknown>)
                          : null;
                      const styleProfileId =
                        (setupConfigForImage?.imageStyleProfileId as string | undefined) ??
                        (chatMeta.imageStyleProfileId as string | undefined) ??
                        null;
                      const generatedFilename = await generateChatBackground({
                        chatId: input.chatId,
                        locationSlug: locationText.slice(0, 120),
                        sceneDescription: promptText.slice(0, 1000),
                        genre: (setupConfigForImage?.genre as string | undefined) ?? undefined,
                        setting: (setupConfigForImage?.setting as string | undefined) ?? undefined,
                        currentLocation: gameState?.location ?? null,
                        currentWeather: gameState?.weather ?? null,
                        currentTimeOfDay: gameState?.time ?? null,
                        worldOverview: (chatMeta.gameWorldOverview as string | undefined) ?? null,
                        artStyle: (setupConfigForImage?.artStylePrompt as string | undefined) ?? undefined,
                        reason:
                          typeof generationRequest.reason === "string"
                            ? generationRequest.reason.trim().slice(0, 300)
                            : undefined,
                        imgModel: imgConnFull.model || "",
                        imgBaseUrl: imgConnFull.baseUrl || "https://image.pollinations.ai",
                        imgApiKey: imgConnFull.apiKey || "",
                        imgSource: (imgConnFull as any).imageGenerationSource || imgConnFull.model || "",
                        imgService: imgConnFull.imageService || (imgConnFull as any).imageGenerationSource || "",
                        imgEndpointId: imgConnFull.imageEndpointId || undefined,
                        imgComfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
                        imgDefaults: imageDefaults,
                        styleProfiles: imageSettings.styleProfiles,
                        styleProfileId,
                        promptOverridesStorage,
                        size: {
                          width: imageSettings.background.width,
                          height: imageSettings.background.height,
                        },
                        debugLog,
                      });
                      if (generatedFilename) {
                        bgData.chosen = generatedFilename;
                        bgData.generated = true;
                        trySendSseEvent(reply, {
                          type: "agent_result",
                          data: {
                            agentType: result.agentType,
                            agentName: currentBackgroundAgent?.name ?? "Background",
                            resultType: result.type,
                            data: bgData,
                            tokensUsed: result.tokensUsed,
                            success: result.success,
                            error: result.error,
                            durationMs: result.durationMs,
                          },
                        });
                      } else {
                        bgData.error = "Background image generation failed";
                        trySendSseEvent(reply, {
                          type: "agent_error",
                          data: {
                            agentType: "background",
                            agentName: currentBackgroundAgent?.name ?? "Background",
                            error: "Background image generation failed. Check the image connection and server logs.",
                          },
                        });
                      }
                    }
                  } catch (bgErr) {
                    logger.error(bgErr, "[background-agent] Image generation failed");
                    bgData.error = bgErr instanceof Error ? bgErr.message : "Background image generation failed";
                    trySendSseEvent(reply, {
                      type: "agent_error",
                      data: {
                        agentType: "background",
                        agentName: currentBackgroundAgent?.name ?? "Background",
                        error: `Background image generation failed: ${bgData.error}`,
                      },
                    });
                  }
                }
              }

              // Persist the validated background to chat metadata so it restores on reload
              if (bgData.chosen) {
                try {
                  await updateChatMetadataForTools({ background: bgData.chosen });
                } catch {
                  /* non-critical */
                }
              }
            }

            if (result.agentType !== "illustrator" && result.type !== "image_prompt") {
              try {
                await agentsStore.saveRun({
                  agentConfigId: result.agentId,
                  chatId: input.chatId,
                  messageId: resultMessageId,
                  result,
                });
              } catch {
                // Non-critical — don't fail the whole generation
              }
            }

            // Validate expression agent results — reject hallucinated expressions and unknown characters
            if (result.success && result.type === "sprite_change" && result.data && typeof result.data === "object") {
              const spriteData = result.data as {
                expressions?: Array<{
                  characterId?: string;
                  characterName?: string;
                  expression?: string;
                  transition?: string;
                }>;
              };
              const availableSprites = agentContext.memory._availableSprites as
                | Array<{ characterId: string; characterName: string; expressions: string[] }>
                | undefined;
              if (Array.isArray(spriteData.expressions)) {
                const validation = validateSpriteExpressionEntries(spriteData.expressions, availableSprites);
                let validatedExpressions = validation.expressions as typeof spriteData.expressions;
                for (const warning of validation.warnings) {
                  logger.warn("[generate] %s", warning.message);
                }
                const requiredExpressionTargetIds = normalizeRequiredSpriteExpressionIds(
                  agentContext.memory._expressionTargetIds,
                );
                if (requiredExpressionTargetIds.length > 0) {
                  const latestUserExpressionSource = getLatestUserExpressionSource();
                  const sourceTextByCharacterId = new Map<string, string>();
                  if (personaId && latestUserExpressionSource) {
                    sourceTextByCharacterId.set(personaId, latestUserExpressionSource);
                  }
                  const completion = completeRequiredSpriteExpressionEntries(
                    validatedExpressions ?? [],
                    availableSprites,
                    requiredExpressionTargetIds,
                    {
                      defaultSourceText: combinedResponse,
                      sourceTextByCharacterId,
                    },
                  );
                  validatedExpressions = completion.expressions as typeof spriteData.expressions;
                  for (const warning of completion.warnings) {
                    logger.warn("[generate] %s", warning.message);
                  }
                }
                spriteData.expressions = validatedExpressions;
              }
              // Persist validated expressions onto the message/swipe extra so they survive page refresh
              // and swipe switching. The chat-level metadata is also updated for backward compat.
              const persistedExpressions =
                spriteData.expressions?.filter(
                  (entry): entry is { characterId: string; expression: string } =>
                    typeof entry.characterId === "string" && typeof entry.expression === "string",
                ) ?? [];
              if (persistedExpressions.length > 0) {
                const exprMap: Record<string, string> = {};
                const personaExprMap: Record<string, string> = {};
                for (const e of persistedExpressions) {
                  if (personaId && e.characterId === personaId) {
                    personaExprMap[e.characterId] = e.expression;
                  } else {
                    exprMap[e.characterId] = e.expression;
                  }
                }
                try {
                  if (Object.keys(exprMap).length > 0) {
                    await chats.updateMessageExtra(messageId, { spriteExpressions: exprMap });
                    await chats.updateSwipeExtra(messageId, targetSwipeIndex, { spriteExpressions: exprMap });
                  }
                  if (Object.keys(personaExprMap).length > 0) {
                    const personaMessageId =
                      currentTurnUserMessageId ?? (await findLastUserMessageIdBefore(chats, input.chatId, messageId));
                    if (personaMessageId) {
                      await chats.updateMessageExtra(personaMessageId, { spriteExpressions: personaExprMap });
                    }
                  }
                } catch {
                  /* non-critical */
                }
              }
            }

            // Persist CYOA choices onto message/swipe extra so they survive page refresh
            if (result.success && result.type === "cyoa_choices" && result.data && typeof result.data === "object") {
              const cyoaData = result.data as { choices?: Array<{ label: string; text: string }> };
              if (cyoaData.choices && cyoaData.choices.length > 0) {
                try {
                  await chats.updateMessageExtra(messageId, { cyoaChoices: cyoaData.choices });
                  await chats.updateSwipeExtra(messageId, targetSwipeIndex, { cyoaChoices: cyoaData.choices });
                } catch {
                  /* non-critical */
                }
              }
            }

            // Persist game state snapshots from world-state agent
            if (
              result.success &&
              result.type === "game_state_update" &&
              result.agentType !== "combat" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_trackers")
            ) {
              try {
                const gs = result.data as Record<string, unknown>;

                // Manual overrides are one-shot: they live on the snapshot the user
                // edited and are visible to the agent as the prevSnap values, but they
                // are NOT carried forward to new snapshots.  The agent naturally reads
                // the edited prevSnap values and produces its own output.
                const prevSnap =
                  trackerBaseGameStateSnapshot ??
                  (allowLatestGameStateFallback ? await gameStateStore.getLatest(input.chatId) : null);

                // Build the new snapshot from agent output, falling back to previous snapshot.
                let newDate = coerceGameStateTextValue(gs.date) ?? coerceGameStateTextValue(prevSnap?.date);
                let newTime = coerceGameStateTextValue(gs.time) ?? coerceGameStateTextValue(prevSnap?.time);
                let newLocation = coerceGameStateTextValue(gs.location) ?? coerceGameStateTextValue(prevSnap?.location);
                let newWeather = coerceGameStateTextValue(gs.weather) ?? coerceGameStateTextValue(prevSnap?.weather);
                let newTemperature =
                  coerceGameStateTextValue(gs.temperature) ?? coerceGameStateTextValue(prevSnap?.temperature);

                // The world-state agent ONLY produces date/time/location/weather/temperature
                // (and optionally recentEvents).  In batch mode the model often cross-
                // contaminates the world-state result with fields from other agent task
                // schemas (presentCharacters, personaStats, playerStats).  Even a partial
                // cross-contaminated playerStats (e.g. { status: "...", activeQuests: [] })
                // would clobber the real data and break downstream handlers (quest, persona-
                // stats) that read from this snapshot.  Therefore we ALWAYS carry forward
                // these fields from the previous snapshot — the dedicated tracker agents
                // (character-tracker, persona-stats, quest, custom-tracker) will update
                // them with authoritative data in their own handler blocks below.
                const snapshotChars = parseJsonField<any[]>(prevSnap?.presentCharacters, []);
                const snapshotPersonaStats = parseJsonField<any[] | null>(prevSnap?.personaStats, null);
                const snapshotPlayerStats = parseJsonField<PlayerStats | null>(prevSnap?.playerStats, null);
                const currentGameStateForLocks = prevSnap
                  ? parseGameStateRow(prevSnap as Record<string, unknown>)
                  : null;
                const lockedWorldStatePatch = applyTrackerFieldLocksToGameStatePatch(
                  {
                    date: newDate,
                    time: newTime,
                    location: newLocation,
                    weather: newWeather,
                    temperature: newTemperature,
                  },
                  currentGameStateForLocks,
                );
                newDate = coerceGameStateTextValue(lockedWorldStatePatch.date);
                newTime = coerceGameStateTextValue(lockedWorldStatePatch.time);
                newLocation = coerceGameStateTextValue(lockedWorldStatePatch.location);
                newWeather = coerceGameStateTextValue(lockedWorldStatePatch.weather);
                newTemperature = coerceGameStateTextValue(lockedWorldStatePatch.temperature);
                logger.info(
                  `[generate] world-state snapshot: chars=${snapshotChars.length} (prev), personaStats=${snapshotPersonaStats ? "present" : "null"} (prev)`,
                );
                await gameStateStore.create(
                  {
                    chatId: input.chatId,
                    messageId,
                    swipeIndex: targetSwipeIndex,
                    date: newDate,
                    time: newTime,
                    location: newLocation,
                    weather: newWeather,
                    temperature: newTemperature,
                    presentCharacters: snapshotChars,
                    recentEvents: (gs.recentEvents as string[]) ?? [],
                    playerStats: snapshotPlayerStats,
                    personaStats: snapshotPersonaStats,
                    fieldLocks: normalizeTrackerFieldLocksForState(
                      currentGameStateForLocks?.fieldLocks,
                      currentGameStateForLocks,
                    ),
                  },
                  null, // manual overrides are one-shot — never carry forward
                );
                // Send game state to client so HUD updates live
                // ONLY send the fields world-state actually produces (date/time/location/weather/temperature).
                // Do NOT spread the whole `gs` — in batch mode the model may cross-contaminate
                // fields like presentCharacters:[] from other agent tasks, clobbering the HUD.
                const worldStatePatch = {
                  date: newDate,
                  time: newTime,
                  location: newLocation,
                  weather: newWeather,
                  temperature: newTemperature,
                };
                logger.debug("[game_state_patch] world-state: %j", worldStatePatch);
                reply.raw.write(`data: ${JSON.stringify({ type: "game_state_patch", data: worldStatePatch })}\n\n`);

                const existingGameMap = (chatMeta.gameMap as GameMap | null) ?? null;
                const syncedMeta = syncGameMapMetaPartyPosition(chatMeta, newLocation);
                const syncedGameMap = (syncedMeta.gameMap as GameMap | null) ?? null;
                if (syncedGameMap && syncedGameMap !== existingGameMap) {
                  Object.assign(chatMeta, syncedMeta);
                  // Re-fetch fresh metadata before write so we don't clobber concurrent updates
                  // (e.g. /game/start flipping gameSessionStatus from "ready" to "active").
                  const freshChat = await chats.getById(input.chatId);
                  const freshMeta = freshChat ? (parseExtra(freshChat.metadata) as Record<string, unknown>) : chatMeta;
                  await chats.updateMetadata(input.chatId, {
                    ...freshMeta,
                    gameMap: syncedMeta.gameMap,
                    gameMaps: syncedMeta.gameMaps,
                    activeGameMapId: syncedMeta.activeGameMapId,
                  });
                  sendSseEvent(reply, { type: "game_map_update", data: syncedGameMap });
                } else if (getGameMapsFromMeta(syncedMeta).length > 0) {
                  Object.assign(chatMeta, syncedMeta);
                }

                // Auto-populate journal: location change
                const prevLocation = prevSnap?.location as string | null;
                if (newLocation && newLocation !== prevLocation) {
                  updateJournal(app.db, input.chatId, (j) =>
                    addLocationEntry(
                      j,
                      newLocation,
                      `Arrived at ${newLocation}${newWeather ? ` (${newWeather})` : ""}`,
                    ),
                  );
                }
              } catch (err) {
                logger.error(err, "[generate] Failed to apply world-state tracker update");
              }
            }

            // Character Tracker agent → merge presentCharacters into latest game state
            if (
              result.success &&
              result.type === "character_tracker_update" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_trackers")
            ) {
              try {
                const ctData = result.data as Record<string, unknown>;
                if (!Array.isArray(ctData.presentCharacters) || ctData.presentCharacters.length === 0) {
                  logger.debug("[generate] character-tracker emitted no presentCharacters; keeping existing snapshot");
                  continue;
                }
                let chars = ctData.presentCharacters as any[];
                const snapBeforeUpdate = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                const previousCharacterSnapshot =
                  snapBeforeUpdate ??
                  trackerBaseGameStateSnapshot ??
                  (allowLatestGameStateFallback ? await gameStateStore.getLatest(input.chatId) : null);
                const oldChars = parseJsonField<any[]>(previousCharacterSnapshot?.presentCharacters, []);
                preserveTrackerCharacterUiFields(chars, oldChars);
                const characterLockState = previousCharacterSnapshot
                  ? parseGameStateRow(previousCharacterSnapshot as Record<string, unknown>)
                  : null;
                const lockedCharacterPatch = applyTrackerFieldLocksToGameStatePatch(
                  { presentCharacters: chars },
                  characterLockState,
                );
                chars = Array.isArray(lockedCharacterPatch.presentCharacters)
                  ? lockedCharacterPatch.presentCharacters
                  : chars;

                // ── Enrich with avatar paths ──
                // 1. Match against known character records in this chat
                // 2. Fall back to stored NPC avatars (per-chat generated/uploaded)
                const NPC_AVATAR_DIR = join(DATA_DIR, "avatars", "npc");
                const storedNpcAvatarByName = new Map<string, string>();
                const gameNpcs = sanitizeGameNpcAvatarUrls((chatMeta.gameNpcs as GameNpc[]) ?? []);
                if (gameNpcs !== chatMeta.gameNpcs) {
                  chatMeta.gameNpcs = gameNpcs;
                }
                for (const npc of gameNpcs) {
                  const name = normalizeTextForMatch(npc.name);
                  if (name && npc.avatarUrl) storedNpcAvatarByName.set(name, npc.avatarUrl);
                }

                for (const char of chars) {
                  if (char.avatarPath) continue; // already set
                  if (isManualTrackerCharacterId(char.characterId)) continue;
                  const name = (char.name as string) ?? "";
                  // Try matching against the chat's character cards (case-insensitive)
                  const matched = charInfo.find((c) => normalizeTextForMatch(c.name) === normalizeTextForMatch(name));
                  if (matched?.avatarPath) {
                    char.avatarPath = matched.avatarPath;
                    continue;
                  }
                  const storedNpcAvatar = storedNpcAvatarByName.get(normalizeTextForMatch(name));
                  if (storedNpcAvatar) {
                    char.avatarPath = storedNpcAvatar;
                    continue;
                  }
                  // Try loading a stored NPC avatar from disk
                  const safeName = name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "");
                  if (safeName) {
                    const npcAvatarPath = join(NPC_AVATAR_DIR, input.chatId, `${safeName}.png`);
                    if (existsSync(npcAvatarPath)) {
                      char.avatarPath = `/api/avatars/npc/${input.chatId}/${safeName}.png`;
                    }
                  }
                }

                logger.info(
                  `[generate] character-tracker: ${chars.length} characters to persist (msg=${messageId}, swipe=${targetSwipeIndex})`,
                );

                // ── Auto-generate NPC avatars if enabled ──
                const charTrackerAgent = resolvedAgents.find((a) => a.type === "character-tracker");
                const autoGenAvatars = !!charTrackerAgent?.settings?.autoGenerateAvatars;
                const npcImgConnId = (charTrackerAgent?.settings?.imageConnectionId as string) ?? null;
                if (autoGenAvatars && npcImgConnId) {
                  const charsNeedingAvatars = chars.filter(
                    (c: any) =>
                      !c.avatarPath &&
                      !isManualTrackerCharacterId(c.characterId) &&
                      (c.name as string) &&
                      (c.appearance as string),
                  );
                  if (charsNeedingAvatars.length > 0) {
                    // Fire-and-forget: generate avatars in background so we don't block
                    (async () => {
                      try {
                        const imgConnFull = await connections.getWithKey(npcImgConnId);
                        if (!imgConnFull) return;
                        const { generateImage } = await import("../services/image/image-generation.js");
                        const imgModel = imgConnFull.model || "";
                        const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
                        const imgApiKey = imgConnFull.apiKey || "";
                        const imgSource = (imgConnFull as any).imageGenerationSource || imgModel;
                        const imgServiceHint = imgConnFull.imageService || imgSource;
                        const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
                        const imageSettings = await loadImageGenerationUserSettings(app.db);
                        const styleProfileId =
                          ((chatMeta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as
                            | string
                            | undefined) ??
                          (chatMeta.imageStyleProfileId as string | undefined) ??
                          null;
                        const generatedAvatarPaths = new Map<string, string>();
                        const avatarMatchKey = (character: Record<string, unknown>) =>
                          String(character.characterId ?? character.name ?? "")
                            .trim()
                            .toLowerCase();

                        for (const npc of charsNeedingAvatars) {
                          try {
                            const npcName = npc.name as string;
                            const appearance = (npc.appearance as string) || "";
                            const outfit = (npc.outfit as string) || "";
                            const prompt =
                              `Portrait of ${npcName}, ${appearance}${outfit ? `, wearing ${outfit}` : ""}. Character portrait, head and shoulders, detailed face, high quality`.slice(
                                0,
                                1000,
                              );
                            const compiledPrompt = compileImagePrompt({
                              kind: "portrait",
                              prompt,
                              styleProfiles: imageSettings.styleProfiles,
                              styleProfileId,
                              imageDefaults,
                            });

                            const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                              prompt: compiledPrompt.prompt,
                              negativePrompt: compiledPrompt.negativePrompt || undefined,
                              model: imgModel,
                              width: imageSettings.portrait.width,
                              height: imageSettings.portrait.height,
                              imageEndpointId: imgConnFull.imageEndpointId || undefined,
                              comfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
                              imageDefaults,
                            });

                            // Save to NPC avatars directory
                            const safeName = npcName
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/(^-|-$)/g, "");
                            const npcDir = join(NPC_AVATAR_DIR, input.chatId);
                            if (!existsSync(npcDir)) mkdirSync(npcDir, { recursive: true });
                            writeFileSync(join(npcDir, `${safeName}.png`), Buffer.from(imageResult.base64, "base64"));

                            // Update the character's avatarPath and stream to client
                            npc.avatarPath = `/api/avatars/npc/${input.chatId}/${safeName}.png`;
                            const key = avatarMatchKey(npc);
                            if (key) generatedAvatarPaths.set(key, npc.avatarPath);
                            logger.info(`[character-tracker] Generated avatar for NPC "${npcName}"`);
                          } catch (err) {
                            logger.warn(err, '[character-tracker] Failed to generate avatar for "%s"', npc.name);
                          }
                        }

                        if (generatedAvatarPaths.size === 0) return;

                        // Re-persist with avatar paths and notify client
                        const latestAvatarSnapshot =
                          (await gameStateStore.getByMessage(messageId, targetSwipeIndex)) ??
                          trackerBaseGameStateSnapshot;
                        const latestAvatarState = latestAvatarSnapshot
                          ? parseGameStateRow(latestAvatarSnapshot as Record<string, unknown>)
                          : null;
                        const currentCharacters = Array.isArray(latestAvatarState?.presentCharacters)
                          ? latestAvatarState.presentCharacters
                          : chars;
                        const mergedAvatarCharacters = currentCharacters.map((character: any) => {
                          const avatarPath = generatedAvatarPaths.get(avatarMatchKey(character));
                          return avatarPath ? { ...character, avatarPath } : character;
                        });
                        const lockedAvatarPatch = applyTrackerFieldLocksToGameStatePatch(
                          { presentCharacters: mergedAvatarCharacters },
                          latestAvatarState,
                        );
                        const presentCharacters = Array.isArray(lockedAvatarPatch.presentCharacters)
                          ? lockedAvatarPatch.presentCharacters
                          : mergedAvatarCharacters;

                        await gameStateStore.updateByMessage(
                          messageId,
                          targetSwipeIndex,
                          input.chatId,
                          {
                            presentCharacters,
                          },
                          undefined,
                          { baseSnapshot: trackerBaseGameStateSnapshot },
                        );
                        try {
                          logger.debug(
                            "[game_state_patch] character-tracker (avatar update): %d chars",
                            presentCharacters.length,
                          );
                          reply.raw.write(
                            `data: ${JSON.stringify({ type: "game_state_patch", data: { presentCharacters } })}\n\n`,
                          );
                        } catch {
                          /* stream closed */
                        }
                      } catch (err) {
                        logger.warn(err, "[character-tracker] Avatar generation error");
                      }
                    })();
                  }
                }

                const updated = await gameStateStore.updateByMessage(
                  messageId,
                  targetSwipeIndex,
                  input.chatId,
                  {
                    presentCharacters: chars,
                  },
                  undefined,
                  { baseSnapshot: trackerBaseGameStateSnapshot },
                );
                logger.info(
                  `[generate] character-tracker: updateByMessage returned ${updated ? "ok" : "null (no snapshot)"}`,
                );
                // Merge into the game_state SSE event for the HUD
                try {
                  logger.debug(
                    "[game_state_patch] character-tracker: %s",
                    chars.map((c: any) => c.name ?? c).join(", "),
                  );
                  reply.raw.write(
                    `data: ${JSON.stringify({ type: "game_state_patch", data: { presentCharacters: chars } })}\n\n`,
                  );
                } catch {
                  /* stream closed */
                }

                // Auto-populate journal: NPC encounters
                try {
                  const prevNames = new Set(oldChars.map((c: any) => normalizeTextForMatch(c.name)));
                  for (const char of chars) {
                    const name = (char.name as string) ?? "";
                    if (!name || prevNames.has(normalizeTextForMatch(name))) continue;
                    // Skip player-character cards — only track NPCs
                    if (charInfo.some((c) => normalizeTextForMatch(c.name) === normalizeTextForMatch(name))) continue;
                    const appearance = (char.appearance as string) || "";
                    const mood = (char.mood as string) || "";
                    const npc: GameNpc = {
                      id: normalizeTextForMatch(name).replace(/[^\p{L}\p{N}]+/gu, "-") || newId(),
                      name,
                      emoji: "👤",
                      description: appearance,
                      location: "",
                      reputation: 0,
                      notes: [],
                    };
                    const interaction = mood ? `Encountered (${mood})` : "Encountered";
                    updateJournal(app.db, input.chatId, (j) => addNpcEntry(j, npc, interaction));
                  }
                } catch {
                  // Non-critical
                }
              } catch (err) {
                logger.error(err, "[generate] character-tracker persistence error");
              }
            }

            // Persona Stats agent → update personaStats on the latest game state snapshot
            if (
              result.success &&
              result.type === "persona_stats_update" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_trackers")
            ) {
              try {
                const psData = result.data as Record<string, unknown>;
                const hasStats = Array.isArray(psData.stats);
                const hasStatus = typeof psData.status === "string";
                const hasInventory = Array.isArray(psData.inventory);
                const bars = hasStats ? (psData.stats as any[]) : [];
                const status = hasStatus ? (psData.status as string) : "";
                const inventory = hasInventory ? (psData.inventory as any[]) : [];

                // Ensure a snapshot exists for this (messageId, swipeIndex).
                // If world-state didn't create one, updateByMessage clones the
                // generation baseline into a new row so we don't corrupt old data.
                let snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                if (!snap) {
                  await gameStateStore.updateByMessage(messageId, targetSwipeIndex, input.chatId, {}, undefined, {
                    baseSnapshot: trackerBaseGameStateSnapshot,
                  });
                  snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                }
                const personaLockState = snap ? parseGameStateRow(snap as Record<string, unknown>) : null;
                const personaPatch = buildLockedPersonaTrackerPatch({
                  stats: bars,
                  status,
                  inventory,
                  hasStats,
                  hasStatus,
                  hasInventory,
                  snapshot: snap,
                  lockState: personaLockState,
                });
                if (snap && Object.keys(personaPatch.updates).length > 0) {
                  await app.db
                    .update(gameStateSnapshotsTable)
                    .set({ ...personaPatch.updates, fieldLocks: serializeMigratedTrackerLocks(personaLockState) })
                    .where(eq(gameStateSnapshotsTable.id, snap.id));
                }
                if (personaPatch.changed) {
                  logger.debug("[game_state_patch] persona-stats: %j", personaPatch.patch);
                  reply.raw.write(
                    `data: ${JSON.stringify({ type: "game_state_patch", data: personaPatch.patch })}\n\n`,
                  );
                }

                // Auto-populate journal: inventory changes
                if (snap && personaPatch.inventory.length > 0) {
                  const existingInv = snap?.playerStats
                    ? typeof snap.playerStats === "string"
                      ? ((JSON.parse(snap.playerStats) as any).inventory ?? [])
                      : ((snap.playerStats as any).inventory ?? [])
                    : [];
                  const oldNames = new Set((existingInv as any[]).map((i: any) => i.name));
                  for (const item of personaPatch.inventory) {
                    if (!oldNames.has(item.name)) {
                      updateJournal(app.db, input.chatId, (j) =>
                        addInventoryEntry(j, item.name, "acquired", item.quantity ?? 1),
                      );
                    }
                  }
                }
              } catch (err) {
                logger.error(err, "[generate] Failed to apply persona-stats tracker update");
              }
            }

            // Custom Tracker agent → merge custom fields into playerStats.customTrackerFields
            if (
              result.success &&
              result.type === "custom_tracker_update" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_trackers")
            ) {
              try {
                const ctData = result.data as Record<string, unknown>;
                const hasFields = Array.isArray(ctData.fields);
                const rawFields = hasFields ? (ctData.fields as any[]) : [];
                if (hasFields) {
                  // Ensure a snapshot exists for this (messageId, swipeIndex)
                  let snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                  if (!snap) {
                    await gameStateStore.updateByMessage(messageId, targetSwipeIndex, input.chatId, {}, undefined, {
                      baseSnapshot: trackerBaseGameStateSnapshot,
                    });
                    snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                  }
                  const customLockState = snap ? parseGameStateRow(snap as Record<string, unknown>) : null;
                  const customTrackerPatch = buildLockedPlayerStatsArrayPatch<any>({
                    field: "customTrackerFields",
                    values: rawFields,
                    snapshot: snap,
                    lockState: customLockState,
                  });
                  if (snap && customTrackerPatch.changed) {
                    await app.db
                      .update(gameStateSnapshotsTable)
                      .set({
                        playerStats: JSON.stringify(customTrackerPatch.playerStats),
                        fieldLocks: serializeMigratedTrackerLocks(customLockState),
                      })
                      .where(eq(gameStateSnapshotsTable.id, snap.id));
                  }
                  if (customTrackerPatch.changed) {
                    logger.debug("[game_state_patch] custom-tracker: %j", customTrackerPatch.values);
                    reply.raw.write(
                      `data: ${JSON.stringify({ type: "game_state_patch", data: customTrackerPatch.patch })}\n\n`,
                    );
                  }
                }
              } catch (err) {
                logger.error(err, "[generate] Failed to apply custom tracker update");
              }
            }

            // Quest Tracker agent → merge quest updates into playerStats.activeQuests
            if (
              result.success &&
              result.type === "quest_update" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "edit_trackers")
            ) {
              try {
                const qData = result.data as Record<string, unknown>;
                const updates = Array.isArray(qData.updates) ? qData.updates : [];
                logger.debug(
                  "[generate] Quest agent result — updates: %d, data keys: %s %s",
                  updates.length,
                  Object.keys(qData).join(","),
                  JSON.stringify(qData).slice(0, 500),
                );
                if (updates.length > 0) {
                  // Ensure a snapshot exists for this (messageId, swipeIndex)
                  let snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                  if (!snap) {
                    await gameStateStore.updateByMessage(messageId, targetSwipeIndex, input.chatId, {}, undefined, {
                      baseSnapshot: trackerBaseGameStateSnapshot,
                    });
                    snap = await gameStateStore.getByMessage(messageId, targetSwipeIndex);
                  }
                  const existingPS = parseSnapshotPlayerStats(snap);
                  const questMerge = applyQuestUpdatesToPlayerStats(existingPS, updates, {
                    autoRemoveFullyCompleted: true,
                  });
                  const questLockState = snap ? parseGameStateRow(snap as Record<string, unknown>) : null;
                  const questTrackerPatch = buildLockedPlayerStatsArrayPatch<any>({
                    field: "activeQuests",
                    values: questMerge.quests,
                    snapshot: snap,
                    lockState: questLockState,
                    basePlayerStats: questMerge.playerStats,
                  });

                  // Only persist + send if quests actually changed
                  if (questMerge.changed && questTrackerPatch.changed) {
                    if (snap) {
                      await app.db
                        .update(gameStateSnapshotsTable)
                        .set({
                          playerStats: JSON.stringify(questTrackerPatch.playerStats),
                          fieldLocks: serializeMigratedTrackerLocks(questLockState),
                        })
                        .where(eq(gameStateSnapshotsTable.id, snap.id));
                    }
                    logger.debug("[game_state_patch] quests: %j", questTrackerPatch.values);
                    reply.raw.write(
                      `data: ${JSON.stringify({ type: "game_state_patch", data: questTrackerPatch.patch })}\n\n`,
                    );

                    // Auto-populate journal: quest updates
                    for (const u of questMerge.updates) {
                      const questData = buildQuestJournalData(u);
                      updateJournal(app.db, input.chatId, (j) => upsertQuest(j, questData));
                    }
                  }
                }
              } catch (err) {
                logger.warn(err, "[generate] Quest tracker persistence failed");
              }
            }

            // Lorebook Keeper agent → persist new/updated entries to the database
            if (result.success && result.type === "lorebook_update" && result.data && typeof result.data === "object") {
              try {
                if (isAgentWriteApprovalEnvelope(result.data)) continue;
                const resultAgent = findResultAgent(result, resolvedAgents);
                const isBuiltInLorebookAgent = builtInAgentTypes.has(result.agentType);
                const customCanEditLorebooks =
                  isBuiltInLorebookAgent ||
                  (resultAgent ? customAgentHasCapability(resultAgent.settings, "edit_lorebooks") : false);
                const customCanCreateLorebooks =
                  isBuiltInLorebookAgent ||
                  (resultAgent ? customAgentHasCapability(resultAgent.settings, "create_lorebooks") : false);
                if (!customCanEditLorebooks && !customCanCreateLorebooks) continue;

                const lkData = result.data as Record<string, unknown>;
                const updates = (lkData.updates as any[]) ?? [];
                if (updates.length > 0) {
                  const customWritableLorebookIds =
                    !isBuiltInLorebookAgent && resultAgent
                      ? resolveCustomWritableLorebookIds(resultAgent.settings)
                      : agentContext.writableLorebookIds;
                  const writableLorebookIds = customCanEditLorebooks ? customWritableLorebookIds : null;
                  const preferredTargetLorebookId =
                    !isBuiltInLorebookAgent && resultAgent
                      ? (writableLorebookIds?.[0] ?? null)
                      : typeof agentContext.memory._lorebookKeeperTargetLorebookId === "string"
                        ? (agentContext.memory._lorebookKeeperTargetLorebookId as string)
                        : null;
                  if (!customCanCreateLorebooks && !preferredTargetLorebookId && !writableLorebookIds?.length) {
                    continue;
                  }
                  await persistLorebookKeeperUpdates({
                    lorebooksStore,
                    chatId: input.chatId,
                    chatName: chat.name,
                    preferredTargetLorebookId,
                    writableLorebookIds,
                    updates,
                  });
                }
              } catch {
                // Non-critical
              }
            }

            // Combat agent → persist encounterActive flag to chatMeta so we can
            // skip the combat agent on subsequent generations when no encounter is running.
            if (result.success && result.agentType === "combat" && result.data && typeof result.data === "object") {
              try {
                const combatData = result.data as Record<string, unknown>;
                const isActive = combatData.encounterActive === true;
                const freshChat = await chats.getById(input.chatId);
                if (freshChat) {
                  const freshMeta = parseExtra(freshChat.metadata);
                  await chats.updateMetadata(input.chatId, { ...freshMeta, encounterActive: isActive });
                }
              } catch {
                // Non-critical
              }
            }

            // ── Haptic agent: execute device commands from agent output ──
            if (result.success && result.type === "haptic_command" && result.data && typeof result.data === "object") {
              try {
                const hData = result.data as Record<string, unknown>;
                if (hData.parseError) {
                  logger.warn(
                    "[haptic] Agent output could not be parsed as JSON: %s",
                    (hData.raw as string)?.slice(0, 200),
                  );
                } else {
                  const cmds = normalizeHapticAgentCommands(hData).slice(0, MAX_AGENT_HAPTIC_COMMANDS);
                  if (cmds.length > 0) {
                    const hapticSettings = getChatHapticSettings(chatMeta);
                    const { hapticService } = await import("../services/haptic/buttplug-service.js");
                    if (hapticService.connected) {
                      const executedCommands: HapticDeviceCommand[] = [];
                      for (const cmd of cmds) {
                        const hapticCommand = normalizeHapticAgentCommand(cmd, hapticSettings);
                        if (!hapticCommand) {
                          logger.warn("[haptic] Agent produced unsupported command action: %s", String(cmd.action));
                          continue;
                        }

                        try {
                          await hapticService.executeCommand(hapticCommand);
                          executedCommands.push(hapticCommand);
                        } catch (commandErr) {
                          logger.warn(commandErr, "[haptic] Agent command %s skipped", hapticCommand.action);
                        }
                      }
                      if (executedCommands.length > 0) {
                        reply.raw.write(
                          `data: ${JSON.stringify({ type: "haptic_command", data: { commands: executedCommands, reasoning: hData.reasoning } })}\n\n`,
                        );
                        logger.info(
                          "[haptic] Agent executed %d command(s): %s",
                          executedCommands.length,
                          hData.reasoning ?? "",
                        );
                      } else {
                        logger.warn(
                          "[haptic] Agent produced %d command(s), but none could be executed: %s",
                          cmds.length,
                          hData.reasoning ?? "",
                        );
                      }
                    } else {
                      logger.warn(
                        `[haptic] Agent produced ${cmds.length} command(s) but Intiface Central is disconnected — commands dropped`,
                      );
                    }
                  } else {
                    logger.debug(
                      `[haptic] Agent returned no commands (reasoning: ${(hData.reasoning as string) ?? "none"})`,
                    );
                  }
                }
              } catch (hapErr) {
                logger.error(hapErr, "[haptic] Agent command execution failed");
              }
            }

            // ── ILLUSTRATOR HANDLER: generate image from agent prompt ──
            if (
              result.success &&
              result.type === "image_prompt" &&
              result.data &&
              typeof result.data === "object" &&
              customAgentCanApplyResult(result, resolvedAgents, builtInAgentTypes, "trigger_image_generation")
            ) {
              const illData = result.data as Record<string, unknown>;
              const shouldGenerate = illData.shouldGenerate === true;
              const imagePrompt = ((illData.prompt as string) ?? "").trim();
              const negativePrompt = ((illData.negativePrompt as string) ?? "").trim();
              const style = ((illData.style as string) ?? "").trim();
              const illCharacters = Array.isArray(illData.characters) ? (illData.characters as string[]) : [];

              // Always log what the illustrator decided
              logger.debug(
                `[illustrator] shouldGenerate=${shouldGenerate}, reason="${(illData.reason as string) ?? "none"}", prompt="${imagePrompt.slice(0, 500) || "(empty)"}"${illData.parseError ? " [JSON PARSE ERROR — raw: " + ((illData.raw as string) ?? "").slice(0, 300) + "]" : ""}`,
              );

              if (shouldGenerate && imagePrompt) {
                // Resolve connections: text LLM = connectionId, image gen = settings.imageConnectionId
                const illustratorAgent = resolvedAgents.find(
                  (a) => a.id === result.agentId || a.type === "illustrator",
                );
                const imagePositivePrompt = ((illustratorAgent?.settings?.imagePositivePrompt as string) ?? "").trim();
                const savedNegativePrompt = ((illustratorAgent?.settings?.imageNegativePrompt as string) ?? "").trim();
                const chatGameImageConnectionId =
                  typeof chatMeta.gameImageConnectionId === "string" ? chatMeta.gameImageConnectionId.trim() : "";
                const agentImageConnectionId = (
                  (illustratorAgent?.settings?.imageConnectionId as string) ?? ""
                ).trim();
                const imageConnectionOverride = chatGameImageConnectionId || agentImageConnectionId;
                let imgConnFull = imageConnectionOverride
                  ? await connections.getWithKey(imageConnectionOverride)
                  : null;
                if (imageConnectionOverride && !imgConnFull) {
                  logger.warn(
                    "[illustrator] Image connection %s could not be resolved; falling back to default Illustrator connection",
                    imageConnectionOverride,
                  );
                }
                imgConnFull ??= await connections.getDefaultForImageGeneration();
                if (imgConnFull) {
                  const resolvedImageConnection = imgConnFull;
                  // Queue image generation to run after the result loop so it doesn't
                  // block other agents (game state, trackers, rewrite agents).
                  pendingIllustration = (async () => {
                    try {
                      const imgConnFull = resolvedImageConnection;
                      const { generateImage, saveImageToDisk } = await import("../services/image/image-generation.js");
                      const { createGalleryStorage } = await import("../services/storage/gallery.storage.js");
                      const galleryStore = createGalleryStorage(app.db);

                      const imgModel = imgConnFull.model || "";
                      const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
                      const imgApiKey = imgConnFull.apiKey || "";
                      const imgSource = (imgConnFull as any).imageGenerationSource || imgModel;
                      const imgServiceHint = imgConnFull.imageService || imgSource;
                      const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
                      const imageSettings = await loadImageGenerationUserSettings(app.db);
                      const styleProfileId =
                        ((chatMeta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as
                          | string
                          | undefined) ??
                        (chatMeta.imageStyleProfileId as string | undefined) ??
                        null;

                      const imgWidth = imageSettings.illustration.width;
                      const imgHeight = imageSettings.illustration.height;

                      // Prepend style to the prompt for better results
                      let fullPrompt = style ? `${style}, ${imagePrompt}` : imagePrompt;
                      if (imagePositivePrompt) {
                        fullPrompt = `${fullPrompt}, ${imagePositivePrompt}`;
                      }
                      const finalNegativePrompt = [
                        negativePrompt,
                        savedNegativePrompt,
                        ILLUSTRATOR_TEXT_NEGATIVE_PROMPT,
                      ]
                        .filter(Boolean)
                        .join(", ");

                      logger.debug(`[illustrator] Starting image generation (${imgWidth}x${imgHeight})...`);

                      // Collect optional character visual context. Prefer full-body
                      // sprites for references, then fall back to avatar portraits.
                      const useAvatarRefs =
                        typeof chatMeta.illustratorUseAvatarReferences === "boolean"
                          ? chatMeta.illustratorUseAvatarReferences
                          : illustratorAgent?.settings?.useAvatarReferences === true;
                      const includeCharacterAppearance =
                        typeof chatMeta.illustratorIncludeCharacterAppearance === "boolean"
                          ? chatMeta.illustratorIncludeCharacterAppearance
                          : illustratorAgent?.settings?.includeCharacterAppearance === true;
                      let illustratorRefImages: string[] | undefined;
                      if (useAvatarRefs || includeCharacterAppearance) {
                        const referenceResolution = await resolveIllustratorCharacterReferences({
                          charactersStore: chars,
                          chatCharacters: charInfo.map((character) => ({
                            id: character.id,
                            name: character.name,
                            avatarPath: character.avatarPath,
                            appearance: character.appearance,
                          })),
                          persona: persona
                            ? {
                                id: personaId,
                                name: personaName,
                                avatarPath: persona.avatarPath as string | null,
                                appearance: personaFields.appearance,
                              }
                            : null,
                          requestedNames: illCharacters.filter((name): name is string => typeof name === "string"),
                          promptText: [
                            imagePrompt,
                            style,
                            typeof illData.reason === "string" ? illData.reason : "",
                            combinedResponse,
                          ].join("\n"),
                          fallbackToChatCharacters: false,
                        });
                        if (includeCharacterAppearance && referenceResolution.appearanceBlock) {
                          fullPrompt += `\n\n${referenceResolution.appearanceBlock}`;
                          logger.debug(
                            "[illustrator] Added character appearance notes for: %s",
                            referenceResolution.appearanceNames.join(", "),
                          );
                        }
                        if (useAvatarRefs && referenceResolution.referenceImages.length > 0) {
                          illustratorRefImages = referenceResolution.referenceImages;
                          if (referenceResolution.referenceLine)
                            fullPrompt += `\n\n${referenceResolution.referenceLine}`;
                          logger.debug(
                            "[illustrator] Sending %d character reference(s) for: %s",
                            referenceResolution.referenceImages.length,
                            referenceResolution.referenceNames.join(", "),
                          );
                        }
                      }

                      const compiledPrompt = compileImagePrompt({
                        kind: "illustration",
                        prompt: fullPrompt,
                        negativePrompt: finalNegativePrompt || undefined,
                        styleProfiles: imageSettings.styleProfiles,
                        styleProfileId,
                        imageDefaults,
                        generatedStyle: style,
                      });
                      fullPrompt = compiledPrompt.prompt;

                      const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                        prompt: compiledPrompt.prompt,
                        negativePrompt: compiledPrompt.negativePrompt || undefined,
                        model: imgModel,
                        width: imgWidth,
                        height: imgHeight,
                        imageEndpointId: imgConnFull.imageEndpointId || undefined,
                        comfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
                        imageDefaults,
                        referenceImages: illustratorRefImages,
                      });

                      // Save to disk
                      const filePath = saveImageToDisk(input.chatId, imageResult.base64, imageResult.ext);

                      // Save to gallery
                      const galleryEntry = await galleryStore.create({
                        chatId: input.chatId,
                        filePath,
                        prompt: fullPrompt,
                        provider: "image_generation",
                        model: imgModel || "unknown",
                        width: imgWidth,
                        height: imgHeight,
                      });

                      // Attach to the assistant message + its specific swipe row
                      const filename = filePath.split("/").pop()!;
                      const imageUrl = `/api/gallery/file/${input.chatId}/${encodeURIComponent(filename)}`;
                      if (messageId) {
                        const attachment = {
                          type: "image",
                          url: imageUrl,
                          filename: `illustration.${imageResult.ext}`,
                          prompt: fullPrompt,
                          galleryId: (galleryEntry as any)?.id,
                        };

                        // Always persist to the swipe row so the attachment survives
                        // swipe switches even if the user has already navigated away.
                        await chats.appendSwipeAttachment(messageId, targetSwipeIndex, attachment);

                        // Also update the live message row if this swipe is still active,
                        // so the SSE illustration event is immediately visible.
                        const msgRow = await chats.getMessage(messageId);
                        if (msgRow && (msgRow.activeSwipeIndex ?? 0) === targetSwipeIndex) {
                          await chats.appendMessageAttachment(messageId, attachment);
                        }
                      }

                      // Notify client
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "illustration",
                          data: {
                            messageId,
                            imageUrl,
                            prompt: fullPrompt,
                            reason: illData.reason,
                            galleryId: (galleryEntry as any)?.id,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        `[illustrator] Generated illustration: ${(illData.reason as string)?.slice(0, 80) ?? imagePrompt.slice(0, 80)}...`,
                      );
                      if (resultMessageId) {
                        try {
                          await agentsStore.saveRun({
                            agentConfigId: result.agentId,
                            chatId: input.chatId,
                            messageId: resultMessageId,
                            result,
                          });
                        } catch (err) {
                          logger.warn(err, "[illustrator] Failed to persist successful illustration run");
                        }
                      }
                    } catch (illErr) {
                      logger.error(illErr, "[illustrator] Image generation failed");
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "agent_error",
                          data: {
                            agentType: "illustrator",
                            agentName: illustratorAgent?.name ?? "Illustrator",
                            error: `Image generation failed: ${illErr instanceof Error ? illErr.message : String(illErr)}`,
                          },
                        })}\n\n`,
                      );
                    }
                  })();
                } else {
                  logger.warn("[illustrator] Agent wants to generate but no image generation connection configured");
                  reply.raw.write(
                    `data: ${JSON.stringify({
                      type: "agent_error",
                      data: {
                        agentType: "illustrator",
                        agentName: illustratorAgent?.name ?? "Illustrator",
                        error:
                          "No image generation connection set on the Illustrator agent, and no default Illustrator image connection is configured. Go to Settings → Connections and mark an image generation connection as the default for Illustrator, or assign one directly in Settings → Agents → Illustrator.",
                      },
                    })}\n\n`,
                  );
                }
              }
            }
          }

          // ── Text rewrite/editing agents: run after ALL other agents ──
          if (textRewriteRunAgents.length > 0 && messageId && !abortController.signal.aborted) {
            let currentResponseForRewrite = combinedResponse;
            const originalResponseBeforeRewrite = combinedResponse;
            let textRewriteApplied = false;

            for (const textRewriteAgent of textRewriteRunAgents) {
              if (abortController.signal.aborted) break;
              try {
                // Collect all successful agent outputs as a summary for rewrite agents.
                const agentSummary: Record<string, unknown> = {};
                for (const result of postResults) {
                  if (result.success && result.data) {
                    agentSummary[result.agentType ?? result.type] = result.data;
                  }
                }

                const editorContext: AgentContext = {
                  ...agentContext,
                  mainResponse: currentResponseForRewrite,
                  preGenInjections:
                    textRewriteAgent.settings.includePreGenInjections === true ? contextInjections : undefined,
                  parallelResults:
                    textRewriteAgent.settings.includeParallelResults === true ? parallelResults : undefined,
                  memory: { ...agentContext.memory, _agentResults: agentSummary },
                };

                const editorResult = await executeAgent(
                  textRewriteAgent,
                  editorContext,
                  textRewriteAgent.provider,
                  textRewriteAgent.model,
                );
                sendAgentEvent(editorResult);

                try {
                  await agentsStore.saveRun({
                    agentConfigId: editorResult.agentId,
                    chatId: input.chatId,
                    messageId,
                    result: editorResult,
                  });
                } catch {
                  /* Non-critical */
                }

                if (
                  editorResult.success &&
                  editorResult.type === "text_rewrite" &&
                  editorResult.data &&
                  customAgentCanApplyResult(editorResult, resolvedAgents, builtInAgentTypes, "edit_messages")
                ) {
                  const edData = editorResult.data as Record<string, unknown>;
                  const editedText = typeof edData.editedText === "string" ? edData.editedText : "";
                  const changes = Array.isArray(edData.changes)
                    ? (edData.changes as Array<{ description: string }>)
                    : [{ description: "Rewrote the assistant response." }];
                  const editNeededValue = edData.editNeeded;
                  const strictEditNeeded =
                    editorResult.agentType === "prose-guardian" || editorResult.agentType === "continuity";
                  const rewriteAllowed =
                    editNeededValue === false ? false : strictEditNeeded ? editNeededValue === true : true;
                  const droppedProtectedMarkup =
                    strictEditNeeded && textRewriteDropsProtectedMarkup(currentResponseForRewrite, editedText);
                  if (droppedProtectedMarkup) {
                    logger.warn(
                      "[text-rewrite] Skipping %s rewrite because it dropped protected markup from message %s",
                      editorResult.agentType,
                      messageId,
                    );
                  }
                  const changedMessage =
                    rewriteAllowed &&
                    !droppedProtectedMarkup &&
                    editedText.trim().length > 0 &&
                    editedText !== currentResponseForRewrite;
                  if (changedMessage) {
                    const originalText = strictEditNeeded ? originalResponseBeforeRewrite : null;
                    currentResponseForRewrite = editedText;
                    await chats.updateMessageContent(messageId, editedText);
                    if (originalText) {
                      await chats.updateMessageExtra(messageId, {
                        proseGuardianOriginalText: originalText,
                        proseGuardianRewrittenAt: new Date().toISOString(),
                      });
                    }
                    textRewriteApplied = true;
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "text_rewrite",
                        data: {
                          editedText,
                          changes,
                          rewriteApplied: true,
                          ...(originalText ? { originalText, agentType: editorResult.agentType } : {}),
                        },
                      })}\n\n`,
                    );
                  }
                }
              } catch {
                // Non-critical — don't fail generation if a rewrite agent errors.
              }
            }

            if (holdForProseGuardianRewrite && !textRewriteApplied && !abortController.signal.aborted) {
              reply.raw.write(
                `data: ${JSON.stringify({
                  type: "text_rewrite",
                  data: {
                    editedText: originalResponseBeforeRewrite,
                    changes: [],
                    rewriteApplied: false,
                  },
                })}\n\n`,
              );
            }
          }
        }

        if (!abortController.signal.aborted) {
          try {
            await runAutomaticRoleplaySummary();
          } catch (summaryErr) {
            logger.warn(summaryErr, "[chat-summary] Automatic summary update failed");
          }
        }

        // ────────────────────────────────────────
        // Character Command Execution (Conversation mode)
        // ────────────────────────────────────────
        if (collectedCommands.length > 0 && !abortController.signal.aborted) {
          const professorMariCommandTypes = new Set([
            "create_persona",
            "create_character",
            "update_character",
            "update_persona",
            "create_lorebook",
            "update_lorebook",
            "create_preset",
            "create_chat",
            "navigate",
            "fetch",
          ]);
          const professorMariCommandCount = collectedCommands.filter(({ command }) =>
            professorMariCommandTypes.has(command.type),
          ).length;
          trySendSseEvent(reply, {
            type: "assistant_commands_start",
            data: { count: collectedCommands.length, professorMariCommandCount },
          });
          try {
            for (const { command, characterId, messageId, swipeIndex } of collectedCommands) {
              try {
                if (command.type === "schedule_update") {
                  // ── Schedule Update: modify the character's current schedule block ──
                  const schedCmd = command as ScheduleUpdateCommand;
                  if (characterId && (schedCmd.status || schedCmd.activity)) {
                    const freshChat = await chats.getById(input.chatId);
                    const freshMeta =
                      typeof freshChat?.metadata === "string"
                        ? JSON.parse(freshChat.metadata)
                        : (freshChat?.metadata ?? {});
                    const schedules: Record<string, any> = getEnabledConversationSchedules(freshMeta);
                    const schedule = schedules[characterId];
                    if (schedule) {
                      const nowDate = new Date();
                      const DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                      const dayName = DAYS_LIST[(nowDate.getDay() + 6) % 7]!;
                      const daySchedule: Array<{ time: string; activity: string; status: string }> =
                        schedule.days?.[dayName] ?? [];
                      const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

                      // Find the current time block and update it
                      let updated = false;
                      for (const block of daySchedule) {
                        const [startStr, endStr] = block.time.split("-");
                        if (!startStr || !endStr) continue;
                        const [sh, sm] = startStr.split(":").map(Number);
                        const [eh, em] = endStr.split(":").map(Number);
                        const startMin = (sh ?? 0) * 60 + (sm ?? 0);
                        const endMin = (eh ?? 0) * 60 + (em ?? 0);
                        if (startMin <= currentMinutes && currentMinutes < endMin) {
                          if (schedCmd.status) block.status = schedCmd.status;
                          if (schedCmd.activity) block.activity = schedCmd.activity;

                          // If duration specified, split the block
                          if (schedCmd.duration) {
                            const durationMin = parseDuration(schedCmd.duration);
                            if (durationMin && currentMinutes + durationMin < endMin) {
                              const splitTime = currentMinutes + durationMin;
                              const splitH = String(Math.floor(splitTime / 60)).padStart(2, "0");
                              const splitM = String(splitTime % 60).padStart(2, "0");
                              // Shorten current block to end at the split point
                              block.time = `${startStr}-${splitH}:${splitM}`;
                              // Insert a new block for the remainder with the original activity/status
                              const idx = daySchedule.indexOf(block);
                              daySchedule.splice(idx + 1, 0, {
                                time: `${splitH}:${splitM}-${endStr}`,
                                activity: "free time",
                                status: "online",
                              });
                            }
                          }
                          updated = true;
                          break;
                        }
                      }

                      if (updated) {
                        schedule.days[dayName] = daySchedule;
                        schedules[characterId] = schedule;
                        await chats.updateMetadata(input.chatId, { ...freshMeta, characterSchedules: schedules });

                        reply.raw.write(
                          `data: ${JSON.stringify({
                            type: "schedule_updated",
                            data: { characterId, status: schedCmd.status, activity: schedCmd.activity },
                          })}\n\n`,
                        );
                        logger.info(
                          `[commands] Schedule updated for ${characterId}: status=${schedCmd.status}, activity=${schedCmd.activity}`,
                        );
                      }
                    }
                  }
                } else if (command.type === "cross_post") {
                  // ── Cross-Post: copy/redirect message to another chat ──
                  const crossCmd = command as CrossPostCommand;
                  const targetName = normalizeTextForMatch(crossCmd.target);

                  // Find the target chat by name
                  const allChatsList = await chats.list();
                  const targetChat = allChatsList.find(
                    (c: any) =>
                      c.mode === "conversation" &&
                      c.id !== input.chatId &&
                      (normalizeTextForMatch(c.name).includes(targetName) || c.id === crossCmd.target),
                  );

                  if (targetChat) {
                    // Get the clean response (commands already stripped)
                    const msgRow = messageId ? await chats.getMessage(messageId) : null;
                    const msgContent = msgRow?.content ?? fullResponse;

                    // Create the message in the target chat
                    await chats.createMessage({
                      chatId: targetChat.id,
                      role: "assistant",
                      characterId,
                      content: msgContent,
                    });

                    // Remove the original message from the source chat (redirect, not copy)
                    if (messageId) {
                      await chats.removeMessage(messageId);
                    }

                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "cross_post",
                        data: {
                          targetChatId: targetChat.id,
                          targetChatName: targetChat.name,
                          sourceChatId: input.chatId,
                          characterId,
                        },
                      })}\n\n`,
                    );
                    logger.info(`[commands] Cross-posted message to chat "${targetChat.name}" (${targetChat.id})`);
                  } else {
                    logger.warn(`[commands] Cross-post target "${crossCmd.target}" not found`);
                  }
                } else if (command.type === "selfie") {
                  // ── Selfie: generate an image from the character's appearance ──
                  const selfieCmd = command as SelfieCommand;

                  // Use the chat-level image gen connection (set by user in chat settings)
                  const imgConnId = chatMeta.imageGenConnectionId as string | undefined;
                  if (imgConnId) {
                    // Show typing indicator while generating the selfie
                    const charRow = characterId ? await chars.getById(characterId) : null;
                    const charData = charRow ? JSON.parse(charRow.data as string) : null;
                    const charName = charData?.name ?? "character";
                    reply.raw.write(`data: ${JSON.stringify({ type: "typing", characters: [charName] })}\n\n`);

                    try {
                      const imgConnFull = await connections.getWithKey(imgConnId);
                      if (!imgConnFull) throw new Error("Cannot decrypt image generation connection");

                      // Build selfie prompt from character appearance + context
                      const appearance = charData?.extensions?.appearance ?? charData?.description ?? "";

                      // Use the LLM to build a proper image prompt
                      const selfieTags: string[] = Array.isArray(chatMeta.selfieTags)
                        ? (chatMeta.selfieTags as string[])
                        : [];
                      const selfiePositivePrompt =
                        typeof chatMeta.selfiePositivePrompt === "string"
                          ? chatMeta.selfiePositivePrompt.trim()
                          : selfieTags.join(", ").trim();
                      const selfieNegativePrompt = ((chatMeta.selfieNegativePrompt as string) ?? "").trim();
                      const selfiePromptTemplate =
                        typeof chatMeta.selfiePrompt === "string" ? chatMeta.selfiePrompt.trim() : "";
                      const promptBuilder = createLLMProvider(
                        conn.provider,
                        baseUrl,
                        conn.apiKey,
                        conn.maxContext,
                        conn.openrouterProvider,
                        conn.maxTokensOverride,
                      );
                      const selfieSystemPrompt = await resolveConversationSelfieSystemPrompt({
                        promptOverridesStorage: createPromptOverridesStorage(app.db),
                        chatPromptTemplate: selfiePromptTemplate,
                        appearance,
                        charName,
                      });
                      const promptResult = await promptBuilder.chatComplete(
                        [
                          {
                            role: "system",
                            content: selfieSystemPrompt,
                          },
                          {
                            role: "user",
                            content: selfieCmd.context
                              ? `Context for the selfie: ${selfieCmd.context}`
                              : `Generate a casual selfie of ${charName} based on the current conversation context.`,
                          },
                        ],
                        {
                          model: conn.model,
                          ...(suppressModelParameters ? {} : { temperature: 0.7, maxTokens: 8196, serviceTier }),
                          suppressModelParameters,
                        },
                      );

                      const imagePrompt = (promptResult.content ?? "").trim();
                      if (imagePrompt) {
                        let finalSelfiePrompt = selfiePositivePrompt
                          ? `${imagePrompt}, ${selfiePositivePrompt}`
                          : imagePrompt;
                        let selfieReferenceImages: string[] | undefined;
                        if (chatMeta.selfieUseAvatarReferences === true) {
                          const referenceResolution = await resolveIllustratorCharacterReferences({
                            charactersStore: chars,
                            chatCharacters: charInfo.map((character) => ({
                              id: character.id,
                              name: character.name,
                              avatarPath: character.avatarPath,
                              appearance: character.appearance,
                            })),
                            persona: persona
                              ? {
                                  id: personaId,
                                  name: personaName,
                                  avatarPath: persona.avatarPath as string | null,
                                  appearance: personaFields.appearance,
                                }
                              : null,
                            requestedNames: [charName],
                            promptText: [charName, selfieCmd.context ?? "", imagePrompt].join("\n"),
                            fallbackToChatCharacters: false,
                            maxReferences: 1,
                          });
                          if (referenceResolution.referenceImages.length > 0) {
                            selfieReferenceImages = referenceResolution.referenceImages;
                            if (referenceResolution.referenceLine) {
                              finalSelfiePrompt += `\n\n${referenceResolution.referenceLine}`;
                            }
                            logger.debug(
                              "[selfie] Sending character reference for: %s",
                              referenceResolution.referenceNames.join(", "),
                            );
                          }
                        }
                        const { generateImage, saveImageToDisk } =
                          await import("../services/image/image-generation.js");
                        const { createGalleryStorage } = await import("../services/storage/gallery.storage.js");
                        const galleryStore = createGalleryStorage(app.db);

                        const imgModel = imgConnFull.model || "";
                        const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
                        const imgApiKey = imgConnFull.apiKey || "";
                        const imgSource = (imgConnFull as any).imageGenerationSource || imgModel;
                        const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
                        const imageSettings = await loadImageGenerationUserSettings(app.db);
                        const configuredStyleProfileId =
                          ((chatMeta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as
                            | string
                            | undefined) ??
                          (chatMeta.imageStyleProfileId as string | undefined) ??
                          null;
                        const styleProfileId =
                          typeof configuredStyleProfileId === "string" && configuredStyleProfileId.trim()
                            ? configuredStyleProfileId.trim()
                            : imageSettings.styleProfiles.defaultProfileId;

                        // Parse per-chat selfie resolution, otherwise use the global selfie canvas.
                        const selfieRes = (chatMeta.selfieResolution as string) ?? "";
                        const [selfieW, selfieH] = selfieRes.split("x").map(Number) as [number, number];

                        const serviceHint = imgConnFull.imageService || "";
                        const compiledSelfiePrompt = compileImagePrompt({
                          kind: "selfie",
                          prompt: finalSelfiePrompt,
                          negativePrompt: selfieNegativePrompt || undefined,
                          styleProfiles: imageSettings.styleProfiles,
                          styleProfileId,
                          imageDefaults,
                        });
                        const imageResult = await generateImage(
                          imgModel,
                          imgBaseUrl,
                          imgApiKey,
                          serviceHint || imgSource,
                          {
                            prompt: compiledSelfiePrompt.prompt,
                            negativePrompt: compiledSelfiePrompt.negativePrompt || undefined,
                            model: imgModel,
                            width: selfieW || imageSettings.selfie.width,
                            height: selfieH || imageSettings.selfie.height,
                            imageEndpointId: imgConnFull.imageEndpointId || undefined,
                            comfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
                            imageDefaults,
                            referenceImages: selfieReferenceImages,
                          },
                        );

                        // Save to disk and DB
                        const filePath = saveImageToDisk(input.chatId, imageResult.base64, imageResult.ext);
                        const galleryEntry = await galleryStore.create({
                          chatId: input.chatId,
                          filePath,
                          prompt: compiledSelfiePrompt.prompt,
                          provider: imgConnFull.provider ?? "image_generation",
                          model: imgModel || "unknown",
                          width: selfieW || imageSettings.selfie.width,
                          height: selfieH || imageSettings.selfie.height,
                        });

                        // Attach the image to the message
                        const filename = filePath.split("/").pop()!;
                        const imageUrl = `/api/gallery/file/${input.chatId}/${encodeURIComponent(filename)}`;
                        if (messageId) {
                          const generationSwipeIndex = Number.isInteger(swipeIndex) ? swipeIndex : 0;
                          const attachment = {
                            type: "image",
                            url: imageUrl,
                            filename: `selfie_${charName.toLowerCase().replace(/\s+/g, "_")}.${imageResult.ext}`,
                            prompt: compiledSelfiePrompt.prompt,
                            galleryId: (galleryEntry as any)?.id,
                          };
                          await chats.appendSwipeAttachment(messageId, generationSwipeIndex, attachment);

                          const currentMsgRow = await chats.getMessage(messageId);
                          if (currentMsgRow && (currentMsgRow.activeSwipeIndex ?? 0) === generationSwipeIndex) {
                            await chats.appendMessageAttachment(messageId, attachment);
                          }
                        }

                        // Send selfie event to client
                        reply.raw.write(
                          `data: ${JSON.stringify({
                            type: "selfie",
                            data: {
                              characterId,
                              characterName: charName,
                              messageId,
                              imageUrl,
                              prompt: compiledSelfiePrompt.prompt,
                              galleryId: (galleryEntry as any)?.id,
                            },
                          })}\n\n`,
                        );
                        logger.debug("[commands] Selfie generated for %s", charName);
                      }
                    } catch (imgErr) {
                      logger.error(imgErr, "[commands] Selfie generation failed");
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "selfie_error",
                          data: {
                            characterId,
                            error: imgErr instanceof Error ? imgErr.message : "Image generation failed",
                          },
                        })}\n\n`,
                      );
                    }
                  } else {
                    logger.warn("[commands] Selfie requested but no imageGenConnectionId set on chat metadata");
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "selfie_error",
                        data: {
                          characterId,
                          error: "No image generation connection configured for this chat. Set one in Chat Settings.",
                        },
                      })}\n\n`,
                    );
                  }
                } else if (command.type === "memory") {
                  // ── Memory: store a fake memory on the target character ──
                  const memCmd = command as MemoryCommand;
                  const targetName = normalizeTextForMatch(memCmd.target);

                  // Resolve source character name
                  const srcCharRow = characterId ? await chars.getById(characterId) : null;
                  const srcCharData = srcCharRow ? JSON.parse(srcCharRow.data as string) : null;
                  const srcCharName = srcCharData?.name ?? "Unknown";

                  // Find target character by name across all characters
                  const allCharsList = await chars.list();
                  const targetChar = allCharsList.find((c: any) => {
                    const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
                    return normalizeTextForMatch(d.name) === targetName;
                  });

                  if (targetChar) {
                    const targetData =
                      typeof targetChar.data === "string" ? JSON.parse(targetChar.data as string) : targetChar.data;
                    const extensions = { ...(targetData.extensions ?? {}) };
                    const memories: Array<{ from: string; fromCharId: string; summary: string; createdAt: string }> =
                      extensions.characterMemories ?? [];

                    memories.push({
                      from: srcCharName,
                      fromCharId: characterId ?? "",
                      summary: memCmd.summary,
                      createdAt: new Date().toISOString(),
                    });

                    extensions.characterMemories = memories;
                    await chars.update(targetChar.id, { extensions } as any);

                    logger.info(
                      `[commands] Memory created: "${srcCharName}" → "${targetData.name}": ${memCmd.summary}`,
                    );
                  } else {
                    logger.warn(`[commands] Memory target character "${memCmd.target}" not found`);
                  }
                }

                if (command.type === "influence") {
                  // ── Influence: queue OOC influence for the connected chat ──
                  const infCmd = command as InfluenceCommand;
                  const freshChat = await chats.getById(input.chatId);
                  const connectedId = freshChat?.connectedChatId as string | null;
                  if (connectedId) {
                    const influenceContent = stripConversationPromptTimestamps(infCmd.content);
                    if (!influenceContent) continue;
                    await chats.createInfluence(input.chatId, connectedId, influenceContent, messageId);
                    logger.info(
                      `[commands] OOC influence queued for connected chat ${connectedId}: "${influenceContent.slice(0, 80)}..."`,
                    );
                  } else {
                    logger.warn("[commands] Influence command used but no connected chat");
                  }
                }

                if (command.type === "note") {
                  // ── Note: persist a durable note in the connected roleplay's prompt ──
                  const noteCmd = command as NoteCommand;
                  const freshChat = await chats.getById(input.chatId);
                  const connectedId = freshChat?.connectedChatId as string | null;
                  if (connectedId) {
                    const noteContent = stripConversationPromptTimestamps(noteCmd.content);
                    if (!noteContent) continue;
                    await chats.createNote(input.chatId, connectedId, noteContent, messageId);
                    logger.info(
                      `[commands] Conversation note saved for connected chat ${connectedId}: "${noteContent.slice(0, 80)}..."`,
                    );
                  } else {
                    logger.warn("[commands] Note command used but no connected chat");
                  }
                }

                if (command.type === "spotify") {
                  // ── Spotify: play a selected track on the user's active Spotify player ──
                  const spotifyCmd = command as SpotifyCommand;
                  if (chatMode !== "conversation") {
                    logger.debug("[spotify/conversation] Ignored song command outside conversation mode");
                    continue;
                  }
                  try {
                    const result = await playConversationSpotifyCommand({
                      storage: agentsStore,
                      title: spotifyCmd.title,
                      artist: spotifyCmd.artist,
                    });
                    trySendSseEvent(reply, {
                      type: "spotify_command",
                      data: {
                        title: spotifyCmd.title,
                        artist: spotifyCmd.artist,
                        track: result.track,
                      },
                    });
                    logger.info(
                      '[spotify/conversation] Played "%s" by "%s" for chat %s',
                      result.track.name,
                      result.track.artist,
                      input.chatId,
                    );
                  } catch (err) {
                    if (isSilentConversationSpotifyCommandError(err)) {
                      logger.debug(
                        '[spotify/conversation] Dropped unavailable song command: "%s" by "%s" - %s',
                        spotifyCmd.title,
                        spotifyCmd.artist,
                        err.message,
                      );
                      continue;
                    }
                    const message = err instanceof Error ? err.message : "Spotify song command failed.";
                    trySendSseEvent(reply, {
                      type: "spotify_command_error",
                      data: {
                        title: spotifyCmd.title,
                        artist: spotifyCmd.artist,
                        error: message,
                      },
                    });
                    if (err instanceof ConversationSpotifyCommandError) {
                      logger.warn(
                        '[spotify/conversation] Song command failed (%d): "%s" by "%s" - %s',
                        err.status,
                        spotifyCmd.title,
                        spotifyCmd.artist,
                        err.message,
                      );
                    } else {
                      logger.warn(err, "[spotify/conversation] Song command failed");
                    }
                  }
                }

                if (command.type === "youtube") {
                  const youtubeCmd = command as YouTubeCommand;
                  if (chatMode !== "conversation") {
                    logger.debug("[youtube/conversation] Ignored song command outside conversation mode");
                    continue;
                  }
                  trySendSseEvent(reply, {
                    type: "youtube_command",
                    data: {
                      searchQuery: youtubeCmd.query,
                      mood: "Conversation music command",
                    },
                  });
                  logger.info('[youtube/conversation] Requested "%s" for chat %s', youtubeCmd.query, input.chatId);
                }

                if (command.type === "react") {
                  const reactCmd = command as ReactCommand;
                  if (chatMode !== "conversation") {
                    logger.debug("[react/conversation] Ignored react command outside conversation mode");
                    continue;
                  }
                  if (characterId && reactCmd.emoji) {
                    // React to the user's most recent message — the turn being answered.
                    const targetId = [...chatMessages].reverse().find((m: any) => m.role === "user")?.id as
                      | string
                      | undefined;
                    if (targetId) {
                      // Resolve a custom-emoji (:name:) image so the chip renders without
                      // re-resolving the gallery on the client (same URL form the picker uses).
                      let imageUrl: string | null = null;
                      const customName = reactCmd.emoji.match(/^:([a-zA-Z0-9_]+):$/)?.[1];
                      if (customName) {
                        const emojiLookupKeys = [
                          characterId ? buildConversationCustomEmojiKey("character", characterId, customName) : null,
                          personaId ? buildConversationCustomEmojiKey("persona", personaId, customName) : null,
                          buildConversationCustomEmojiKey("global", null, customName),
                        ].filter((key): key is string => Boolean(key));
                        for (const key of emojiLookupKeys) {
                          imageUrl = conversationCustomEmojiUrlByName.get(key) ?? null;
                          if (imageUrl) break;
                        }
                        if (!imageUrl) {
                          const row = await customEmojisStore.getByName(customName);
                          if (row?.filePath) imageUrl = buildGlobalCustomEmojiUrl(String(row.filePath));
                        }
                      }
                      const targetMsg = await chats.getMessage(targetId);
                      if (targetMsg) {
                        const ex = parseExtra(targetMsg.extra);
                        const reactions = addMessageReactor(ex.reactions, reactCmd.emoji, characterId, imageUrl);
                        await chats.updateMessageExtra(targetId, { reactions });
                        logger.info(
                          "[react/conversation] %s reacted with %s on message %s",
                          characterId,
                          reactCmd.emoji,
                          targetId,
                        );
                      }
                    }
                  }
                }

                if (command.type === "dm") {
                  // ── Roleplay DM: post into the linked conversation when available; otherwise create a DM chat ──
                  const dmCmd = command as DirectMessageCommand;
                  try {
                    const messageText = stripConversationPromptTimestamps(dmCmd.message).trim().slice(0, 4000);
                    const targetCharId = dmCmd.resolvedCharacterId ?? null;
                    const targetName = dmCmd.resolvedCharacterName ?? dmCmd.character.trim();

                    if (!targetCharId) {
                      logger.warn('[commands] DM target character "%s" not found', dmCmd.character);
                      continue;
                    }
                    if (!messageText) continue;

                    const sourceUserMessage = [...allChatMessages]
                      .reverse()
                      .find((m: any) => m.role === "user" && !isMessageHiddenFromAI(m));
                    const sourceUserText = sourceUserMessage
                      ? stripConversationPromptTimestamps(String(sourceUserMessage.content ?? ""))
                          .trim()
                          .slice(0, 4000)
                      : "";
                    const ensureSourceUserMessage = async (targetChatId: string, dedupePerTarget: boolean) => {
                      if (!sourceUserMessage?.id || !sourceUserText) return null;

                      const targetMessages = await chats.listMessages(targetChatId);
                      const alreadyMirrored = targetMessages.some((m: any) => {
                        const extra = parseExtra(m.extra) as Record<string, unknown>;
                        if (
                          extra.roleplayDmSourceChatId !== input.chatId ||
                          extra.roleplayDmSourceUserMessageId !== sourceUserMessage.id
                        ) {
                          return false;
                        }
                        return !dedupePerTarget || extra.roleplayDmTargetCharacterId === targetCharId;
                      });
                      if (alreadyMirrored) return null;

                      const userMsg = await chats.createMessage({
                        chatId: targetChatId,
                        role: "user",
                        characterId: null,
                        content: sourceUserText,
                      });
                      if (userMsg?.id) {
                        await chats.updateMessageExtra(userMsg.id, {
                          roleplayDmSourceChatId: input.chatId,
                          roleplayDmSourceUserMessageId: sourceUserMessage.id,
                          roleplayDmTargetCharacterId: targetCharId,
                        });
                      }
                      recordUserActivity(targetChatId);
                      return userMsg;
                    };

                    const freshChat = await chats.getById(input.chatId);
                    const connectedId = freshChat?.connectedChatId as string | null;
                    const connectedChat = connectedId ? await chats.getById(connectedId) : null;
                    const linkedConversationId = connectedChat?.mode === "conversation" ? connectedChat.id : null;

                    if (linkedConversationId) {
                      const sourceUserDmMessage = await ensureSourceUserMessage(linkedConversationId, false);
                      const dmMessage = await chats.createMessage({
                        chatId: linkedConversationId,
                        role: "assistant",
                        characterId: targetCharId,
                        content: messageText,
                      });
                      recordAssistantActivity(linkedConversationId, targetCharId);

                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: {
                            action: "dm_posted",
                            chatId: linkedConversationId,
                            mode: "conversation",
                            characterName: targetName,
                            sourceChatId: input.chatId,
                            sourceMessageId: messageId || null,
                            sourceUserMessageId: sourceUserMessage?.id ?? null,
                            userMessageId: sourceUserDmMessage?.id ?? null,
                            messageId: dmMessage?.id ?? null,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        '[commands] Roleplay DM from "%s" posted to linked conversation %s from chat %s',
                        targetName,
                        linkedConversationId,
                        input.chatId,
                      );
                      continue;
                    }

                    const allChatsList = await chats.list();
                    const existingDmChat = allChatsList.find((candidate: any) => {
                      if (candidate.mode !== "conversation" || candidate.id === input.chatId) return false;
                      const meta = parseExtra(candidate.metadata) as Record<string, unknown>;
                      if (meta.dmOriginChatId !== input.chatId) return false;
                      if (typeof meta.dmTargetCharacterId === "string" && meta.dmTargetCharacterId !== targetCharId) {
                        return false;
                      }
                      return parseChatCharacterIdsForDm(candidate.characterIds).includes(targetCharId);
                    });

                    const targetChat =
                      existingDmChat ??
                      (await chats.create({
                        name: `DM with ${targetName}`,
                        mode: "conversation",
                        characterIds: [targetCharId],
                        groupId: null,
                        personaId: (chat.personaId as string | null) ?? null,
                        promptPresetId: null,
                        connectionId: (chat.connectionId as string | null) ?? null,
                      }));
                    if (!targetChat) throw new Error("Failed to create DM conversation");

                    await chats.patchMetadata(targetChat.id, {
                      dmOriginChatId: input.chatId,
                      dmOriginChatName: chat.name ?? null,
                      dmOriginMessageId: messageId || null,
                      dmSourceUserMessageId: sourceUserMessage?.id ?? null,
                      dmTargetCharacterId: targetCharId,
                      roleplayDmThread: true,
                    });
                    const sourceUserDmMessage = await ensureSourceUserMessage(targetChat.id, true);
                    const dmMessage = await chats.createMessage({
                      chatId: targetChat.id,
                      role: "assistant",
                      characterId: targetCharId,
                      content: messageText,
                    });
                    recordAssistantActivity(targetChat.id, targetCharId);

                    const createdNewChat = !existingDmChat;

                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "assistant_action",
                        data: {
                          action: createdNewChat ? "chat_created" : "dm_posted",
                          chatId: targetChat.id,
                          chatName: targetChat.name ?? `DM with ${targetName}`,
                          mode: "conversation",
                          characterName: targetName,
                          sourceChatId: input.chatId,
                          sourceMessageId: messageId || null,
                          sourceUserMessageId: sourceUserMessage?.id ?? null,
                          userMessageId: sourceUserDmMessage?.id ?? null,
                          messageId: dmMessage?.id ?? null,
                        },
                      })}\n\n`,
                    );
                    logger.info(
                      createdNewChat
                        ? '[commands] Roleplay DM conversation created with "%s" (%s) from chat %s'
                        : '[commands] Roleplay DM from "%s" reused conversation %s from chat %s',
                      targetName,
                      targetChat.id,
                      input.chatId,
                    );
                  } catch (err) {
                    logger.error(err, "[commands] Roleplay DM creation failed");
                  }
                }

                if (command.type === "haptic") {
                  // ── Haptic: send command to connected intimate devices ──
                  const hapCmd = command as HapticCommand;
                  try {
                    const { hapticService } = await import("../services/haptic/buttplug-service.js");
                    if (hapticService.connected && hapticService.devices.length > 0) {
                      await hapticService.executeCommand({
                        deviceIndex: "all",
                        action: hapCmd.action,
                        intensity: hapCmd.intensity,
                        duration: hapCmd.duration,
                      });
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "haptic_command",
                          data: { action: hapCmd.action, intensity: hapCmd.intensity, duration: hapCmd.duration },
                        })}\n\n`,
                      );
                      logger.info(
                        `[commands] Haptic: ${hapCmd.action} intensity=${hapCmd.intensity ?? "default"} duration=${hapCmd.duration ?? "indefinite"}`,
                      );
                    } else if (!hapticService.connected) {
                      logger.warn(
                        `[commands] Haptic command [${hapCmd.action}] skipped — Intiface Central not connected`,
                      );
                    } else {
                      logger.warn(`[commands] Haptic command [${hapCmd.action}] skipped — no devices found`);
                    }
                  } catch (hapErr) {
                    logger.error(hapErr, "[commands] Haptic command failed");
                  }
                }

                if (command.type === "scene") {
                  // ── Scene: plan + create a mini-roleplay branching from this conversation ──
                  const scnCmd = command as SceneCommand;
                  try {
                    const originChat = await chats.getById(input.chatId);
                    if (!originChat) throw new Error("Origin chat not found");

                    const originCharIds: string[] =
                      typeof originChat.characterIds === "string"
                        ? JSON.parse(originChat.characterIds)
                        : (originChat.characterIds as string[]);

                    // Resolve initiator name
                    const initiatorRow = characterId ? await chars.getById(characterId) : null;
                    const initiatorData = initiatorRow
                      ? typeof initiatorRow.data === "string"
                        ? JSON.parse(initiatorRow.data as string)
                        : initiatorRow.data
                      : null;
                    const initiatorName = initiatorData?.name ?? "Character";

                    // Call /scene/plan internally to get a comprehensive plan
                    const planRes = await app.inject({
                      method: "POST",
                      url: "/api/scene/plan",
                      payload: {
                        chatId: input.chatId,
                        prompt: scnCmd.scenario,
                        connectionId: null,
                      },
                    });
                    const planBody = JSON.parse(planRes.body);
                    if (!planBody.plan) throw new Error("Scene plan failed");

                    // Override background if the character specified one
                    if (scnCmd.background) {
                      planBody.plan.background = scnCmd.background;
                    }

                    // Call /scene/create with the full plan
                    const createRes = await app.inject({
                      method: "POST",
                      url: "/api/scene/create",
                      payload: {
                        originChatId: input.chatId,
                        initiatorCharId: characterId,
                        plan: planBody.plan,
                        connectionId: null,
                      },
                    });
                    const createBody = JSON.parse(createRes.body);

                    if (createBody.chatId) {
                      // Notify client
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "scene_created",
                          data: {
                            sceneChatId: createBody.chatId,
                            sceneChatName: createBody.chatName,
                            description: createBody.description,
                            background: createBody.background ?? null,
                            initiatorCharId: characterId,
                            initiatorCharName: initiatorName,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        `[commands] Scene created: "${createBody.chatName}" (${createBody.chatId}) from chat ${input.chatId}`,
                      );
                    }
                  } catch (sceneErr) {
                    logger.error(sceneErr, "[commands] Scene creation failed");
                  }
                }

                if (command.type === "uno") {
                  // ── UNO: a character agreed to play — deal a game at the table ──
                  try {
                    const existingGame = await getActiveTurnGame(app.db, input.chatId);
                    if (existingGame) {
                      logger.info("[commands] UNO requested but a game is already active in chat %s", input.chatId);
                    } else {
                      const unoChat = await chats.getById(input.chatId);
                      // Parse defensively so malformed chat metadata can't throw and
                      // silently abort the command (mirrors resolveSeats).
                      let unoCharIds: string[] = [];
                      try {
                        const rawCharIds = unoChat?.characterIds;
                        const parsedCharIds = typeof rawCharIds === "string" ? JSON.parse(rawCharIds) : rawCharIds;
                        if (Array.isArray(parsedCharIds)) {
                          unoCharIds = parsedCharIds.filter((x): x is string => typeof x === "string");
                        }
                      } catch {
                        unoCharIds = [];
                      }
                      // Seat the human + every character who isn't offline (asleep) right now.
                      const unoSchedules = getEnabledConversationSchedules(chatMeta) as Record<
                        string,
                        import("../services/conversation/schedule.service.js").WeekSchedule
                      >;
                      const unoSchedSvc = await import("../services/conversation/schedule.service.js");
                      const seatBotIds = unoCharIds.filter((cid) => {
                        const sched = unoSchedules[cid];
                        return !sched || unoSchedSvc.getCurrentStatus(sched).status !== "offline";
                      });
                      // The agreeing character is always seated, even if their schedule says otherwise.
                      if (characterId && unoCharIds.includes(characterId) && !seatBotIds.includes(characterId)) {
                        seatBotIds.push(characterId);
                      }
                      const outcome = await startTurnGame(app.db, input.chatId, {
                        gameType: "uno",
                        botCharacterIds: seatBotIds,
                        humanFirst: true,
                      });
                      if (outcome.ok) {
                        reply.raw.write(
                          `data: ${JSON.stringify({ type: "turn_game_state_patch", data: outcome.view })}\n\n`,
                        );
                        logger.info(
                          "[commands] UNO started in chat %s with %d player(s)",
                          input.chatId,
                          seatBotIds.length + 1,
                        );
                        // If the opening card landed the first turn on a bot (skip/reverse/draw2),
                        // advance the bot seats now so the deal resolves to the human's turn.
                        await runTurnGameBotTurns({
                          db: app.db,
                          chatId: input.chatId,
                          conn,
                          baseUrl,
                          reply,
                          signal: abortController.signal,
                        });
                      } else {
                        logger.warn("[commands] UNO start failed in chat %s: %s", input.chatId, outcome.error ?? "");
                      }
                    }
                  } catch (unoErr) {
                    logger.error(unoErr, "[commands] UNO start failed");
                  }
                }

                // ── Assistant commands (Professor Mari) ──
                if (command.type === "create_persona") {
                  const cpCmd = command as CreatePersonaCommand;
                  try {
                    const persona = await chars.createPersona(cpCmd.name, cpCmd.description ?? "", undefined, {
                      personality: cpCmd.personality,
                      appearance: cpCmd.appearance,
                    });
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "assistant_action",
                        data: { action: "persona_created", id: persona?.id, name: cpCmd.name },
                      })}\n\n`,
                    );
                    logger.info(`[commands] Assistant created persona: "${cpCmd.name}" (${persona?.id})`);
                  } catch (err) {
                    logger.error(err, "[commands] Create persona failed");
                  }
                }

                if (command.type === "create_character") {
                  const ccCmd = command as CreateCharacterCommand;
                  try {
                    const charData = {
                      name: ccCmd.name,
                      description: ccCmd.description ?? "",
                      personality: ccCmd.personality ?? "",
                      first_mes: ccCmd.firstMessage ?? "",
                      scenario: ccCmd.scenario ?? "",
                      mes_example: ccCmd.mesExample ?? "",
                      creator_notes: ccCmd.creatorNotes ?? "",
                      system_prompt: ccCmd.systemPrompt ?? "",
                      post_history_instructions: ccCmd.postHistoryInstructions ?? "",
                      tags: ccCmd.tags ?? ([] as string[]),
                      creator: ccCmd.creator ?? "",
                      character_version: ccCmd.characterVersion ?? "",
                      alternate_greetings: ccCmd.alternateGreetings ?? ([] as string[]),
                      extensions: {
                        talkativeness: ccCmd.talkativeness ?? 0.5,
                        fav: ccCmd.fav ?? false,
                        world: ccCmd.world ?? "",
                        depth_prompt: {
                          prompt: ccCmd.depthPrompt ?? "",
                          depth: ccCmd.depthPromptDepth ?? 4,
                          role: ccCmd.depthPromptRole ?? "system",
                        },
                        backstory: ccCmd.backstory ?? "",
                        appearance: ccCmd.appearance ?? "",
                      },
                      character_book: null,
                    };
                    const created = await chars.create(charData as any);
                    if (created) {
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: { action: "character_created", id: created.id, name: ccCmd.name },
                        })}\n\n`,
                      );
                      logger.info(`[commands] Assistant created character: "${ccCmd.name}" (${created.id})`);
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Create character failed");
                  }
                }

                if (command.type === "update_character") {
                  const ucCmd = command as UpdateCharacterCommand;
                  try {
                    const allCharsList = await chars.list();
                    const targetChar = allCharsList.find((c: any) => {
                      const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
                      return normalizeTextForMatch(d.name) === normalizeTextForMatch(ucCmd.name);
                    });
                    if (targetChar) {
                      const latestTargetChar = await chars.getById(targetChar.id);
                      if (!latestTargetChar) {
                        logger.warn(`[commands] Update character: "${ucCmd.name}" disappeared before update`);
                        continue;
                      }
                      const existingData =
                        typeof latestTargetChar.data === "string"
                          ? JSON.parse(latestTargetChar.data as string)
                          : latestTargetChar.data;
                      const updates: Record<string, unknown> = {};
                      const extensionUpdates: Record<string, unknown> = {};
                      if (ucCmd.description !== undefined) updates.description = ucCmd.description;
                      if (ucCmd.personality !== undefined) updates.personality = ucCmd.personality;
                      if (ucCmd.firstMessage !== undefined) updates.first_mes = ucCmd.firstMessage;
                      if (ucCmd.scenario !== undefined) updates.scenario = ucCmd.scenario;
                      if (ucCmd.mesExample !== undefined) updates.mes_example = ucCmd.mesExample;
                      if (ucCmd.creatorNotes !== undefined) updates.creator_notes = ucCmd.creatorNotes;
                      if (ucCmd.systemPrompt !== undefined) updates.system_prompt = ucCmd.systemPrompt;
                      if (ucCmd.postHistoryInstructions !== undefined) {
                        updates.post_history_instructions = ucCmd.postHistoryInstructions;
                      }
                      if (ucCmd.creator !== undefined) updates.creator = ucCmd.creator;
                      if (ucCmd.characterVersion !== undefined) updates.character_version = ucCmd.characterVersion;
                      if (ucCmd.tags !== undefined) updates.tags = ucCmd.tags;
                      if (ucCmd.alternateGreetings !== undefined) {
                        updates.alternate_greetings = ucCmd.alternateGreetings;
                      }
                      if (ucCmd.backstory !== undefined) extensionUpdates.backstory = ucCmd.backstory;
                      if (ucCmd.appearance !== undefined) extensionUpdates.appearance = ucCmd.appearance;
                      if (ucCmd.talkativeness !== undefined) extensionUpdates.talkativeness = ucCmd.talkativeness;
                      if (ucCmd.fav !== undefined) extensionUpdates.fav = ucCmd.fav;
                      if (ucCmd.world !== undefined) extensionUpdates.world = ucCmd.world;
                      if (
                        ucCmd.depthPrompt !== undefined ||
                        ucCmd.depthPromptDepth !== undefined ||
                        ucCmd.depthPromptRole !== undefined
                      ) {
                        const existingDepthPrompt = existingData.extensions?.depth_prompt ?? {};
                        extensionUpdates.depth_prompt = {
                          ...existingDepthPrompt,
                          ...(ucCmd.depthPrompt !== undefined ? { prompt: ucCmd.depthPrompt } : {}),
                          ...(ucCmd.depthPromptDepth !== undefined ? { depth: ucCmd.depthPromptDepth } : {}),
                          ...(ucCmd.depthPromptRole !== undefined ? { role: ucCmd.depthPromptRole } : {}),
                        };
                      }
                      if (Object.keys(extensionUpdates).length > 0) {
                        updates.extensions = { ...(existingData.extensions ?? {}), ...extensionUpdates };
                      }
                      if (ucCmd.characterVersion === undefined && Object.keys(updates).length > 0) {
                        updates.character_version = bumpCharacterVersion(existingData.character_version);
                      }
                      await chars.update(targetChar.id, updates, undefined, {
                        versionSource: "command",
                        versionReason: "Assistant update_character command",
                      });
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: { action: "character_updated", id: targetChar.id, name: ucCmd.name },
                        })}\n\n`,
                      );
                      logger.info(`[commands] Assistant updated character: "${ucCmd.name}" (${targetChar.id})`);
                    } else {
                      logger.warn(`[commands] Update character: "${ucCmd.name}" not found`);
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Update character failed");
                  }
                }

                if (command.type === "update_persona") {
                  const upCmd = command as UpdatePersonaCommand;
                  try {
                    const allPersonas = await chars.listPersonas();
                    const targetPersona = allPersonas.find((p: any) => {
                      return normalizeTextForMatch(p.name) === normalizeTextForMatch(upCmd.name);
                    });
                    if (targetPersona) {
                      const sets: Record<string, unknown> = {};
                      if (upCmd.description !== undefined) sets.description = upCmd.description;
                      if (upCmd.personality !== undefined) sets.personality = upCmd.personality;
                      if (upCmd.appearance !== undefined) sets.appearance = upCmd.appearance;
                      if (upCmd.scenario !== undefined) sets.scenario = upCmd.scenario;
                      if (upCmd.backstory !== undefined) sets.backstory = upCmd.backstory;
                      await chars.updatePersona(targetPersona.id, sets as any);
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: { action: "persona_updated", id: targetPersona.id, name: upCmd.name },
                        })}\n\n`,
                      );
                      logger.info(`[commands] Assistant updated persona: "${upCmd.name}" (${targetPersona.id})`);
                    } else {
                      logger.warn(`[commands] Update persona: "${upCmd.name}" not found`);
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Update persona failed");
                  }
                }

                if (command.type === "create_lorebook") {
                  const clCmd = command as CreateLorebookCommand;
                  try {
                    const category =
                      clCmd.category === "character" ||
                      clCmd.category === "world" ||
                      clCmd.category === "npc" ||
                      clCmd.category === "spellbook"
                        ? clCmd.category
                        : "uncategorized";
                    const created = await lorebooksStore.create({
                      name: clCmd.name,
                      description: clCmd.description ?? "",
                      category,
                      tags: clCmd.tags ?? [],
                      enabled: true,
                      generatedBy: "agent",
                      sourceAgentId: PROFESSOR_MARI_ID,
                    });

                    if (created) {
                      const createdLorebook = created as unknown as { id: string };
                      let entryCount = 0;
                      for (const entry of clCmd.entries ?? []) {
                        await lorebooksStore.createEntry({
                          lorebookId: createdLorebook.id,
                          name: entry.name,
                          content: entry.content ?? "",
                          description: entry.description ?? "",
                          keys: entry.keys ?? [],
                          secondaryKeys: entry.secondaryKeys ?? [],
                          tag: entry.tag ?? "",
                          constant: entry.constant ?? false,
                          selective: entry.selective ?? false,
                          enabled: true,
                        });
                        entryCount += 1;
                      }

                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: {
                            action: "lorebook_created",
                            id: createdLorebook.id,
                            name: clCmd.name,
                            entryCount,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        '[commands] Assistant created lorebook: "%s" (%s) with %d entries',
                        clCmd.name,
                        createdLorebook.id,
                        entryCount,
                      );
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Create lorebook failed");
                  }
                }

                if (command.type === "update_lorebook") {
                  const ulCmd = command as UpdateLorebookCommand;
                  try {
                    const allLorebooks = await lorebooksStore.list();
                    const targetLorebook = (allLorebooks as any[]).find((lb: any) => {
                      if (lb.id === ulCmd.name) return true;
                      return normalizeTextForMatch(lb.name) === normalizeTextForMatch(ulCmd.name);
                    });

                    if (!targetLorebook) {
                      logger.warn('[commands] Update lorebook: "%s" not found', ulCmd.name);
                    } else {
                      const category =
                        ulCmd.category === "character" ||
                        ulCmd.category === "world" ||
                        ulCmd.category === "npc" ||
                        ulCmd.category === "spellbook" ||
                        ulCmd.category === "uncategorized"
                          ? ulCmd.category
                          : undefined;
                      const lorebookUpdates: Record<string, unknown> = {};
                      if (ulCmd.newName !== undefined && ulCmd.newName.trim()) lorebookUpdates.name = ulCmd.newName;
                      if (ulCmd.description !== undefined) lorebookUpdates.description = ulCmd.description;
                      if (category !== undefined) lorebookUpdates.category = category;
                      if (ulCmd.tags !== undefined) lorebookUpdates.tags = ulCmd.tags;
                      if (Object.keys(lorebookUpdates).length > 0) {
                        await lorebooksStore.update(targetLorebook.id, lorebookUpdates as any);
                      }

                      const existingEntries = (await lorebooksStore.listEntries(targetLorebook.id)) as any[];
                      const existingByName = new Map(
                        existingEntries.map((entry) => [
                          String(entry.name ?? "")
                            .trim()
                            .toLowerCase(),
                          entry,
                        ]),
                      );
                      let updatedEntryCount = 0;
                      let createdEntryCount = 0;

                      for (const entry of ulCmd.entries ?? []) {
                        const matchName = (entry.matchName || entry.name).trim().toLowerCase();
                        const existingEntry = existingByName.get(matchName);
                        if (existingEntry) {
                          const entryUpdates: Record<string, unknown> = {};
                          if (entry.name !== undefined) entryUpdates.name = entry.name;
                          if (entry.content !== undefined) entryUpdates.content = entry.content;
                          if (entry.description !== undefined) entryUpdates.description = entry.description;
                          if (entry.keys !== undefined) entryUpdates.keys = entry.keys;
                          if (entry.secondaryKeys !== undefined) entryUpdates.secondaryKeys = entry.secondaryKeys;
                          if (entry.tag !== undefined) entryUpdates.tag = entry.tag;
                          if (entry.constant !== undefined) entryUpdates.constant = entry.constant;
                          if (entry.selective !== undefined) entryUpdates.selective = entry.selective;
                          if (Object.keys(entryUpdates).length > 0) {
                            const updatedEntry = await lorebooksStore.updateEntry(
                              existingEntry.id,
                              entryUpdates as any,
                            );
                            if (updatedEntry) {
                              updatedEntryCount += 1;
                              existingByName.delete(matchName);
                              existingByName.set(entry.name.trim().toLowerCase(), updatedEntry);
                            }
                          }
                        } else {
                          const createdEntry = await lorebooksStore.createEntry({
                            lorebookId: targetLorebook.id,
                            name: entry.name,
                            content: entry.content ?? "",
                            description: entry.description ?? "",
                            keys: entry.keys ?? [],
                            secondaryKeys: entry.secondaryKeys ?? [],
                            tag: entry.tag ?? "",
                            constant: entry.constant ?? false,
                            selective: entry.selective ?? false,
                            enabled: true,
                          });
                          if (createdEntry) {
                            createdEntryCount += 1;
                            existingByName.set(entry.name.trim().toLowerCase(), createdEntry);
                          }
                        }
                      }

                      const finalName = ulCmd.newName?.trim() || targetLorebook.name || ulCmd.name;
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: {
                            action: "lorebook_updated",
                            id: targetLorebook.id,
                            name: finalName,
                            updatedEntryCount,
                            createdEntryCount,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        '[commands] Assistant updated lorebook: "%s" (%s), entries updated=%d created=%d',
                        finalName,
                        targetLorebook.id,
                        updatedEntryCount,
                        createdEntryCount,
                      );
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Update lorebook failed");
                  }
                }

                if (command.type === "create_preset") {
                  const presetCmd = command as CreatePresetCommand;
                  try {
                    const createdPresetAction = await app.db.transaction(async (tx) => {
                      const txPresets = createPromptsStorage(tx as unknown as typeof app.db);
                      const created = await txPresets.create({
                        name: presetCmd.name,
                        description: presetCmd.description ?? "",
                        wrapFormat: resolveAssistantPresetWrapFormat(presetCmd.wrapFormat),
                        isDefault: false,
                        author: presetCmd.author ?? "Professor Mari",
                      });

                      if (!created) return null;

                      const createdPreset = created as unknown as { id: string };
                      const groupIds = new Map<string, string>();
                      const groupKey = (name: string) => name.trim().toLowerCase();

                      const ensureGroup = async (
                        name: string,
                        order?: number,
                        enabled?: boolean,
                      ): Promise<string | null> => {
                        const trimmed = name.trim();
                        if (!trimmed) return null;
                        const key = groupKey(trimmed);
                        const existing = groupIds.get(key);
                        if (existing) return existing;
                        const group = await txPresets.createGroup({
                          presetId: createdPreset.id,
                          name: trimmed,
                          order: order ?? (groupIds.size + 1) * 100,
                          enabled: enabled ?? true,
                        });
                        if (!group) return null;
                        groupIds.set(key, group.id);
                        return group.id;
                      };

                      for (const group of presetCmd.groups ?? []) {
                        await ensureGroup(group.name, group.order, group.enabled);
                      }

                      for (const group of presetCmd.groups ?? []) {
                        if (!group.parentGroupName) continue;
                        const childId = groupIds.get(groupKey(group.name));
                        const parentId = await ensureGroup(group.parentGroupName);
                        if (childId && parentId) {
                          await txPresets.updateGroup(childId, { parentGroupId: parentId });
                        }
                      }

                      const usedIdentifiers = new Set<string>();
                      let sectionCount = 0;
                      for (const [index, section] of (presetCmd.sections ?? []).entries()) {
                        const groupId = section.groupName ? await ensureGroup(section.groupName) : null;
                        await txPresets.createSection({
                          presetId: createdPreset.id,
                          identifier: normalizeAssistantPresetIdentifier(
                            section.identifier ?? section.name,
                            index,
                            usedIdentifiers,
                          ),
                          name: section.name,
                          content: section.content ?? "",
                          role: resolveAssistantPresetRole(section.role),
                          enabled: section.enabled ?? true,
                          isMarker: false,
                          groupId,
                          markerConfig: null,
                          injectionPosition: resolveAssistantPresetInjectionPosition(section.injectionPosition),
                          injectionDepth: Math.max(0, section.injectionDepth ?? 0),
                          injectionOrder: section.injectionOrder ?? (index + 1) * 100,
                          forbidOverrides: section.forbidOverrides ?? false,
                        });
                        sectionCount += 1;
                      }

                      const usedVariableNames = new Set<string>();
                      let choiceBlockCount = 0;
                      for (const [index, choiceBlock] of (presetCmd.choiceBlocks ?? []).entries()) {
                        const optionIds = new Set<string>();
                        await txPresets.createChoiceBlock({
                          presetId: createdPreset.id,
                          variableName: normalizeAssistantPresetVariableName(
                            choiceBlock.variableName,
                            index,
                            usedVariableNames,
                          ),
                          question: choiceBlock.question,
                          options: choiceBlock.options.map((option, optionIndex) => ({
                            id: normalizeAssistantPresetOptionId(option.id ?? option.label, optionIndex, optionIds),
                            label: option.label,
                            value: option.value,
                          })),
                          multiSelect: choiceBlock.multiSelect ?? false,
                          separator: choiceBlock.separator ?? ", ",
                          randomPick: choiceBlock.randomPick ?? false,
                          displayMode: choiceBlock.displayMode ?? "auto",
                          optionSort: choiceBlock.optionSort ?? "manual",
                        });
                        choiceBlockCount += 1;
                      }

                      return {
                        id: createdPreset.id,
                        name: presetCmd.name,
                        sectionCount,
                        choiceBlockCount,
                      };
                    });

                    if (createdPresetAction) {
                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: {
                            action: "preset_created",
                            id: createdPresetAction.id,
                            name: createdPresetAction.name,
                            sectionCount: createdPresetAction.sectionCount,
                            choiceBlockCount: createdPresetAction.choiceBlockCount,
                          },
                        })}\n\n`,
                      );
                      logger.info(
                        '[commands] Assistant created preset: "%s" (%s), sections=%d choiceBlocks=%d',
                        createdPresetAction.name,
                        createdPresetAction.id,
                        createdPresetAction.sectionCount,
                        createdPresetAction.choiceBlockCount,
                      );
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Create preset failed");
                  }
                }

                if (command.type === "create_chat") {
                  const ctCmd = command as CreateChatCommand;
                  try {
                    // Resolve character by name or ID
                    const allCharsList = await chars.list();
                    const targetChar = allCharsList.find((c: any) => {
                      if (c.id === ctCmd.character) return true;
                      const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
                      return normalizeTextForMatch(d.name) === normalizeTextForMatch(ctCmd.character);
                    });
                    if (targetChar) {
                      const targetData =
                        typeof targetChar.data === "string" ? JSON.parse(targetChar.data as string) : targetChar.data;
                      const mode = ctCmd.mode ?? "conversation";
                      const newChat = await chats.create({
                        name: `Chat with ${targetData.name}`,
                        mode,
                        characterIds: [targetChar.id],
                        groupId: null,
                        personaId: null,
                        promptPresetId: null,
                        connectionId: null,
                      });
                      if (newChat) {
                        reply.raw.write(
                          `data: ${JSON.stringify({
                            type: "assistant_action",
                            data: {
                              action: "chat_created",
                              chatId: newChat.id,
                              chatName: newChat.name ?? `Chat with ${targetData.name}`,
                              mode,
                              characterName: targetData.name,
                            },
                          })}\n\n`,
                        );
                        logger.info(
                          `[commands] Assistant created ${mode} chat with "${targetData.name}" (${newChat.id})`,
                        );
                      }
                    } else {
                      logger.warn(`[commands] Create chat: character "${ctCmd.character}" not found`);
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Create chat failed");
                  }
                }

                if (command.type === "navigate") {
                  const navCmd = command as NavigateCommand;
                  reply.raw.write(
                    `data: ${JSON.stringify({
                      type: "assistant_action",
                      data: { action: "navigate", panel: navCmd.panel, tab: navCmd.tab ?? null },
                    })}\n\n`,
                  );
                  logger.info(`[commands] Assistant navigate: panel=${navCmd.panel}, tab=${navCmd.tab ?? "none"}`);
                }

                // ── Fetch command (Professor Mari) ──
                if (command.type === "fetch") {
                  const fetchCmd = command as FetchCommand;
                  try {
                    let fetchedContent = "";
                    const contextKey = `${fetchCmd.fetchType}:${fetchCmd.name}`;

                    if (fetchCmd.fetchType === "character") {
                      const allCharsList = await chars.list();
                      const found = allCharsList.find((c: any) => {
                        const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
                        return normalizeTextForMatch(d.name) === normalizeTextForMatch(fetchCmd.name);
                      });
                      if (found) {
                        const d = typeof found.data === "string" ? JSON.parse(found.data as string) : found.data;
                        const parts = [`Name: ${d.name}`];
                        if (d.description) parts.push(`Description: ${d.description}`);
                        if (d.personality) parts.push(`Personality: ${d.personality}`);
                        if (d.scenario) parts.push(`Scenario: ${d.scenario}`);
                        if (d.mes_example) parts.push(`Example Messages: ${d.mes_example}`);
                        if (d.system_prompt) parts.push(`System Prompt: ${d.system_prompt}`);
                        if (d.post_history_instructions) {
                          parts.push(`Post-History Instructions: ${d.post_history_instructions}`);
                        }
                        if (d.first_mes) parts.push(`First Message: ${d.first_mes}`);
                        if (d.creator_notes) parts.push(`Creator Notes: ${d.creator_notes}`);
                        if (d.extensions?.appearance) parts.push(`Appearance: ${d.extensions.appearance}`);
                        if (d.extensions?.backstory) parts.push(`Backstory: ${d.extensions.backstory}`);
                        fetchedContent = parts.join("\n");
                      }
                    } else if (fetchCmd.fetchType === "persona") {
                      const allPersonasList = await chars.listPersonas();
                      const found = allPersonasList.find(
                        (p: any) => normalizeTextForMatch(p.name) === normalizeTextForMatch(fetchCmd.name),
                      );
                      if (found) {
                        const parts = [`Name: ${found.name}`];
                        if (found.description) parts.push(`Description: ${found.description}`);
                        if (found.personality) parts.push(`Personality: ${found.personality}`);
                        if (found.scenario) parts.push(`Scenario: ${found.scenario}`);
                        if (found.appearance) parts.push(`Appearance: ${found.appearance}`);
                        if (found.backstory) parts.push(`Backstory: ${found.backstory}`);
                        fetchedContent = parts.join("\n");
                      }
                    } else if (fetchCmd.fetchType === "lorebook") {
                      const allLorebooks = await lorebooksStore.list();
                      const found = (allLorebooks as any[]).find(
                        (lb: any) => normalizeTextForMatch(lb.name) === normalizeTextForMatch(fetchCmd.name),
                      );
                      if (found) {
                        const entries = await lorebooksStore.listEntries(found.id);
                        const parts = [`Lorebook: ${found.name}`];
                        if (found.description) parts.push(`Description: ${found.description}`);
                        if (found.category) parts.push(`Category: ${found.category}`);
                        parts.push(`Entries (${entries.length}):`);
                        for (const entry of entries as any[]) {
                          parts.push(
                            `\n  Entry: ${entry.name}\n  Keys: ${(Array.isArray(entry.keys) ? entry.keys : []).join(", ")}\n  Content: ${entry.content}`,
                          );
                        }
                        fetchedContent = parts.join("\n");
                      }
                    } else if (fetchCmd.fetchType === "chat") {
                      const allChats = await chats.list();
                      const found = (allChats as any[]).find(
                        (c: any) => normalizeTextForMatch(c.name) === normalizeTextForMatch(fetchCmd.name),
                      );
                      if (found) {
                        const parts = [`Chat: ${found.name}`, `Mode: ${found.mode}`];
                        const recentMsgs = await chats.listMessagesPaginated(found.id, 20);
                        if (recentMsgs.length > 0) {
                          parts.push(`Recent Messages (${recentMsgs.length}):`);
                          for (const msg of recentMsgs) {
                            const role =
                              msg.role === "assistant" ? (msg.characterId ? "Character" : "Assistant") : "User";
                            parts.push(`  [${role}]: ${(msg.content as string).slice(0, 300)}`);
                          }
                        }
                        fetchedContent = parts.join("\n");
                      }
                    } else if (fetchCmd.fetchType === "preset") {
                      const allPresetsList = await presets.list();
                      const found = (allPresetsList as any[]).find(
                        (p: any) =>
                          p.id === fetchCmd.name ||
                          normalizeTextForMatch(p.name) === normalizeTextForMatch(fetchCmd.name),
                      );
                      if (found) {
                        const sections = await presets.listSections(found.id);
                        const groups = await presets.listGroups(found.id);
                        const choiceBlocks = await presets.listChoiceBlocksForPreset(found.id);
                        const groupById = new Map((groups as any[]).map((group: any) => [group.id, group]));
                        const parameters = parseMariJsonRecord(found.parameters);
                        const defaultChoices = parseMariJsonRecord(found.defaultChoices);
                        const parts = [`Preset: ${found.name}`];
                        parts.push(`ID: ${found.id}`);
                        if (found.description) parts.push(`Description: ${found.description}`);
                        if (found.author) parts.push(`Author: ${found.author}`);
                        parts.push(`Wrap Format: ${found.wrapFormat ?? "xml"}`);
                        parts.push(`Default Preset: ${String(found.isDefault) === "true" ? "yes" : "no"}`);
                        if (Object.keys(parameters).length > 0) {
                          parts.push(
                            `Generation Parameters: ${truncateMariFetchedText(JSON.stringify(parameters), 1200)}`,
                          );
                        }
                        if (Object.keys(defaultChoices).length > 0) {
                          parts.push(
                            `Default Choices: ${truncateMariFetchedText(JSON.stringify(defaultChoices), 1200)}`,
                          );
                        }
                        if ((groups as any[]).length > 0) {
                          parts.push(`Groups (${(groups as any[]).length}):`);
                          for (const group of groups as any[]) {
                            const parent = group.parentGroupId ? groupById.get(group.parentGroupId) : null;
                            parts.push(
                              `  - ${group.name} (enabled=${String(group.enabled) === "true" ? "true" : "false"}, order=${group.order}, parent=${parent?.name ?? "none"})`,
                            );
                          }
                        }
                        parts.push(`Sections (${sections.length}):`);
                        for (const sec of sections) {
                          const group = sec.groupId ? groupById.get(sec.groupId) : null;
                          parts.push(
                            [
                              `\n  Section: ${sec.name ?? "Untitled"}`,
                              `  Identifier: ${sec.identifier}`,
                              `  Role: ${sec.role}`,
                              `  Enabled: ${String(sec.enabled) === "true" ? "true" : "false"}`,
                              `  Group: ${group?.name ?? "none"}`,
                              `  Injection: ${sec.injectionPosition} depth=${sec.injectionDepth} order=${sec.injectionOrder}`,
                              `  Forbid Overrides: ${String(sec.forbidOverrides) === "true" ? "true" : "false"}`,
                              `  Content:\n${truncateMariFetchedText(sec.content, 3000)}`,
                            ].join("\n"),
                          );
                        }
                        if ((choiceBlocks as any[]).length > 0) {
                          parts.push(`Choice Blocks (${(choiceBlocks as any[]).length}):`);
                          for (const block of choiceBlocks as any[]) {
                            const options = parseMariJsonArray(block.options)
                              .map((option) => {
                                const data = parseMariJsonRecord(option);
                                return `${data.label ?? "Option"} => ${truncateMariFetchedText(data.value, 500)}`;
                              })
                              .join(" | ");
                            parts.push(
                              [
                                `\n  Variable: ${block.variableName}`,
                                `  Question: ${block.question}`,
                                `  Multi Select: ${String(block.multiSelect) === "true" ? "true" : "false"}`,
                                `  Random Pick: ${String(block.randomPick) === "true" ? "true" : "false"}`,
                                `  Separator: ${block.separator ?? ", "}`,
                                `  Options: ${options}`,
                              ].join("\n"),
                            );
                          }
                        }
                        fetchedContent = truncateMariFetchedText(
                          parts.join("\n"),
                          MAX_MARI_FETCHED_PRESET_CONTEXT_CHARS,
                        );
                      }
                    }

                    if (fetchedContent) {
                      // Persist to chatMeta.mariContext so it's available in subsequent messages.
                      // Re-fetch fresh metadata so concurrent writes (e.g. /game/start) aren't clobbered.
                      const freshChat = await chats.getById(input.chatId);
                      const currentMeta = freshChat
                        ? (parseExtra(freshChat.metadata) as Record<string, unknown>)
                        : (parseExtra(chat.metadata) as Record<string, unknown>);
                      const mariContext = (currentMeta.mariContext as Record<string, string>) ?? {};
                      mariContext[contextKey] = fetchedContent;
                      currentMeta.mariContext = mariContext;
                      await chats.updateMetadata(input.chatId, currentMeta);

                      // Record success for the follow-up trigger only for the
                      // internal Home Professor Mari assistant. Legacy Mari
                      // character chats should stay personality-only.
                      if (
                        isHomeProfessorMariAssistantChat &&
                        (characterId === PROFESSOR_MARI_ID || characterId === null)
                      ) {
                        mariFetchSucceededThisIteration = true;
                      }

                      reply.raw.write(
                        `data: ${JSON.stringify({
                          type: "assistant_action",
                          data: {
                            action: "data_fetched",
                            fetchType: fetchCmd.fetchType,
                            name: fetchCmd.name,
                          },
                        })}\n\n`,
                      );
                      logger.info(`[commands] Assistant fetched ${fetchCmd.fetchType}: "${fetchCmd.name}"`);
                    } else {
                      logger.warn(`[commands] Fetch: ${fetchCmd.fetchType} "${fetchCmd.name}" not found`);
                    }
                  } catch (err) {
                    logger.error(err, "[commands] Fetch failed");
                  }
                }
              } catch (cmdErr) {
                logger.error(cmdErr, `[commands] Error processing ${command.type} command`);
              }
            }
          } finally {
            trySendSseEvent(reply, {
              type: "assistant_commands_end",
              data: {},
            });
          }
        }

        // ── Trigger follow-up generation if Professor Mari's fetch landed ──
        // Mari's fetched payload was persisted to chatMeta.mariContext by the
        // fetch handler above, but mariContext is only read into the prompt at
        // the start of a generation pass — without a follow-up turn Mari would
        // go silent right after the fetch snackbar. Gating on the success flag
        // (rather than just the presence of a parsed [fetch:]) avoids burning
        // an extra pass when the fetch handler found nothing or threw.
        if (
          mariFetchSucceededThisIteration &&
          chatMode === "conversation" &&
          !input.impersonate &&
          !input.regenerateMessageId &&
          !abortController.signal.aborted &&
          followUpIteration < MAX_FOLLOW_UP_ITERATIONS
        ) {
          followUpIteration++;
          logger.info(
            "[generate] Professor Mari fetch succeeded; triggering follow-up generation (iteration %d)",
            followUpIteration,
          );

          // Carry the just-streamed assistant turn into the next prompt so
          // Mari sees her own prior message before speaking again. Apply the
          // same regex-script + blank-line compaction transforms here, since
          // the iteration-0 block above only runs on the original history.
          const lastResponseText = allResponses.join("\n\n");
          if (lastResponseText) {
            const newMariMsg: GenerationPromptMessage = {
              role: "assistant",
              content: lastResponseText,
              characterId: null,
            };
            applyRegexScriptsToPromptMessages([newMariMsg], await regexScriptsStore.list(), {
              resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
            });
            newMariMsg.content = newMariMsg.content.replace(/\n([ \t]*\n){2,}/g, "\n\n");
            runningMessagesForFollowUp.push(resolveHistoryMessageMacros([newMariMsg])[0] ?? newMariMsg);
          }

          // Re-read chat metadata so the freshly-persisted mariContext is
          // visible to the next pass.
          const freshChat = await chats.getById(input.chatId);
          if (freshChat) {
            chatMeta = parseExtra(freshChat.metadata) as Record<string, unknown>;
          }

          // Reset hoisted per-iteration accumulators before continuing.
          // (firstSavedMsg stays — it's "first across the whole turn".
          //  lastSavedMsg, pendingIllustration are overwritten naturally.)
          collectedCommands.length = 0;
          collectedOocMessages.length = 0;

          continue;
        }

        // ── Background: chunk & embed new messages for memory recall ──
        // Runs once on the final iteration (fire-and-forget). Lives inside the
        // loop because charInfo is scoped here; only executes when we break.
        {
          const charNameMap: Record<string, string> = {};
          for (const ci of charInfo) {
            charNameMap[ci.id] = ci.name;
          }
          if (memoryRecallVectorizerAvailable) {
            chunkAndEmbedMessages(
              app.db,
              input.chatId,
              { userName: personaName, characterNames: charNameMap },
              { embeddingSource: memoryRecallEmbeddingSource },
            ).catch((err) => logger.error(err, "[memory-recall] Background chunking failed"));
          }
        }
        break;
      } // end of Professor Mari follow-up loop

      // ── Post OOC messages to connected conversation (Roleplay → Conversation) ──
      if (collectedOocMessages.length > 0 && chat.connectedChatId && !abortController.signal.aborted) {
        try {
          for (const oocText of collectedOocMessages) {
            await chats.createMessage({
              chatId: chat.connectedChatId as string,
              role: "assistant",
              characterId: lastSavedMsg?.characterId ?? characterIds[0] ?? null,
              content: oocText,
            });
          }
          logger.info(
            `[generate] Posted ${collectedOocMessages.length} OOC message(s) to conversation ${chat.connectedChatId}`,
          );
          reply.raw.write(
            `data: ${JSON.stringify({ type: "ooc_posted", data: { chatId: chat.connectedChatId, count: collectedOocMessages.length } })}\n\n`,
          );
        } catch (oocErr) {
          logger.error(oocErr, "[generate] Failed to post OOC messages");
        }
      }

      // Signal completion before the slow illustration tail. The client keeps
      // listening until the HTTP stream closes, so late illustration events can
      // still arrive without holding the chat's generation lock hostage.
      sendSseEvent(reply, { type: "done", data: "" });
      releaseActiveGeneration();

      // Wait for illustration to finish before closing the SSE stream.
      if (pendingIllustration) {
        try {
          await pendingIllustration;
        } catch {
          /* errors already handled inside the promise */
        }
      }
    } catch (err) {
      if (abortController.signal.aborted || isAbortLikeError(err)) {
        return;
      }
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
      const message =
        err instanceof Error
          ? (err as { cause?: unknown }).cause instanceof Error
            ? `${err.message}: ${(err as { cause?: Error }).cause!.message}`
            : err.message
          : "Generation failed";
      sendSseEvent(reply, { type: "error", data: message });
    } finally {
      if (conversationGenerationStartedAt != null && !conversationAssistantSaved) {
        clearGenerationInProgress(input.chatId, conversationGenerationStartedAt);
      }
      stopSseKeepalive();
      reply.raw.off("close", onClose);
      releaseActiveGeneration();
      if (!clientDisconnected && !reply.raw.destroyed) {
        reply.raw.end();
      }
    }
  });

  // ── Active generation tracking for explicit abort ──
  const activeGenerations = new Map<string, { abortController: AbortController; backendUrl: string | null }>();

  // Expose the map so the route handler can register/unregister generations
  app.decorate("activeGenerations", activeGenerations);

  /**
   * POST /api/generate/abort
   * Explicitly abort an in-progress generation for a given chat.
   */
  app.post("/abort", async (req, reply) => {
    const body = req.body as { chatId?: string };
    const chatId = body?.chatId;
    if (!chatId) return reply.status(400).send({ error: "chatId is required" });

    const gen = activeGenerations.get(chatId);
    if (!gen) return reply.send({ aborted: false, reason: "No active generation for this chat" });

    logger.info("[abort] Explicit abort requested for chat: %s", chatId);
    gen.abortController.abort();

    // Send abort to backend (KoboldCPP etc.)
    if (gen.backendUrl) {
      const backendRoot = gen.backendUrl.replace(/\/v1\/?$/, "");
      const abortUrl = backendRoot + "/api/extra/abort";
      logger.info("[abort] Sending abort to backend: %s", abortUrl);
      try {
        await fetch(abortUrl, { method: "POST", signal: AbortSignal.timeout(5000) });
        logger.info("[abort] Backend abort sent successfully");
      } catch (err) {
        logger.warn(err, "[abort] Backend abort failed");
      }
    }

    // Keep the entry registered until the generation route reaches its
    // identity-checked finally block. Deleting here opens a same-chat race where
    // a replacement request can register before the aborted request has unwound.
    return reply.send({ aborted: true });
  });

  await registerDryRunRoute(app);
  await registerRetryAgentsRoute(app);
}
