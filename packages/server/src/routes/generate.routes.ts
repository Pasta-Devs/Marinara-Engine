// ──────────────────────────────────────────────
// Routes: Generation (SSE Streaming with Tool Use + Agent Pipeline)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  generateRequestSchema,
  BUILT_IN_AGENTS,
  getDefaultBuiltInAgentSettings,
  resolveMacros,
  resolveDeferredCharacterMacros,
  hasDeferredCharacterMacros,
  hasDeferredRelocationConditionals,
  collectDeferredRelocationConditionOperands,
  DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE,
  parseDeferredConditionalPayload,
  selectConditionalPayloadBranch,
  LIMITS,
  coerceGameStateTextValue,
  appendChatSummaryEntryToMetadata,
  applyQuestUpdatesToPlayerStats,
  buildQuestJournalData,
  isAgentAvailableInChatMode,
  isAgentConfigDeleted,
  normalizeAgentPromptTemplateSelectionMap,
  normalizeManualTrackerAgentTypes,
  normalizeThinkingTagPairs,
  applyTrackerFieldLocksToGameStatePatch,
  normalizeWorldCustomFields,
  normalizeTrackerFieldLocksForState,
  trackerFieldLocksAreEmpty,
  customAgentHasCapability,
  CHAT_SUMMARY_PROMPT_SETTINGS_KEY,
  DEFAULT_CONVERSATION_PROMPT,
  DEFAULT_GENERATION_PARAMS,
  unwrapConversationInstructions,
  findKnownModel,
  LOCAL_SIDECAR_CONNECTION_ID,
  normalizeTextForMatch,
  normalizeGameStoryboardKeyframeCount,
  resolveGameSetupArtStylePrompt,
  type APIProvider,
  type MacroContext,
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
} from "@marinara-engine/shared";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { commitSpatialOwnerTurn, SpatialOwnerTurnError } from "../services/spatial-context/owner-turn.js";
import {
  formatOwnerSpatialBreadcrumb,
  injectOwnerSpatialPrompt,
  omitAuthoritativeGameLocation,
  projectGameSnapshotLocation,
  resolveOwnerSpatialProjection,
} from "../services/spatial-context/projection.js";
import { isHierarchicalMapsEnabledForChat } from "../services/spatial-context/activation.js";
import { materializeAssistantSpatialState } from "../services/spatial-context/state-resolution.js";
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
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { buildLorebookSemanticEmbeddingsById, warmLorebookEntryEmbeddings } from "../services/lorebook/embeddings.js";
import { applyRegexScriptsToPromptMessages } from "../services/regex/regex-application.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import {
  filterRelevantLorebooks,
  processLorebooks,
  scopeLorebookScanResultToCharacter,
  type LorebookScanResult,
} from "../services/lorebook/index.js";
import {
  filterGameInternalAgentIds,
  resolveLorebookScopeExclusions,
} from "../services/lorebook/game-lorebook-scope.js";
import { lorebookEntryPassesContextFilters, type GameStateForScanning } from "../services/lorebook/keyword-scanner.js";
import { injectAtDepth } from "../services/lorebook/prompt-injector.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { resolveChatSummaryConnection } from "../services/chat-summary/connection-resolution.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import {
  loadImageGenerationUserSettings,
  resolveIllustratorImageSize,
} from "../services/image/image-generation-settings.js";
import { textRewriteDropsProtectedMarkup } from "../services/generation/text-rewrite-safety.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { persistGeneratedImageToEntityGalleries } from "../services/image/generated-image-entity-gallery.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import { extractLeadingThinkingBlocks } from "../services/llm/inline-thinking.js";
import { buildSpotifyDjConstraints } from "../services/spotify/spotify-dj-constraints.js";
import {
  assemblePrompt,
  buildPromptMacroContext,
  collectCharacterAdvancedPromptEntries,
  resolveCharacterAdvancedPromptIds,
  resolveCharacterMacroData,
  resolveMacrosWithVariableSnapshot,
  resolvePromptIdleDuration,
  resolvePromptLastGenerationType,
  resolvePromptMessageMacros,
  scopePromptMacroContextToCharacter,
  type AssemblerInput,
} from "../services/prompt/index.js";
import { wrapContent } from "../services/prompt/format-engine.js";
import {
  withLlmRequestTimeout,
  yieldToEventLoop,
  type ChatMessage,
  type LLMUsage,
} from "../services/llm/base-provider.js";
import { executeToolCalls } from "../services/tools/tool-executor.js";
import { createAgentPipeline, type ResolvedAgent, type AgentInjection } from "../services/agents/agent-pipeline.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { executeAgent, normalizeAgentContextSize, resolveAgentResultType } from "../services/agents/agent-executor.js";
import { matchCustomAgentActivation } from "./generate/agent-activation.js";
import { listCharacterSprites } from "../services/game/sprite.service.js";
import { generateChatBackground } from "../services/game/game-asset-generation.js";
import { npcAvatarSlug, sanitizeGameNpcAvatarUrls } from "../services/game/npc-avatar-utils.js";
import {
  parseCharacterCommands,
  parseCharacterCommandsBySpeaker,
  parseDirectMessageCommands,
  type CharacterCommand,
  type DirectMessageCommand,
} from "../services/conversation/character-commands.js";
import {
  suppressesReferencePromptLine,
  mergeIllustratorNegativePrompt,
  resolveIllustratorCharacterReferences,
} from "./generate/illustrator-references.js";
import {
  buildAutonomousDailyBudgetPatch,
  clearGenerationInProgress,
  markGenerationInProgress,
  recordAssistantActivity,
  recordUserActivity,
} from "../services/conversation/autonomous.service.js";
import { buildIntentCooldownPatch, isMessageIntent } from "../services/conversation/intent.service.js";
import { buildImpersonateInstruction } from "../services/conversation/impersonate-prompt.js";
import {
  stripConversationPromptTimestamps,
  stripConversationResponseEnvelope,
} from "../services/conversation/transcript-sanitize.js";
import {
  formatZonedConversationDate,
  formatZonedConversationTime,
  normalizePromptTimeZone,
  toZonedWallClockDate,
} from "../services/conversation/timezone.js";
import { countUserMessagesAfterSummaryAnchor } from "../services/conversation/auto-summary.service.js";
import { executeKnowledgeRetrieval } from "../services/agents/knowledge-retrieval.js";
import { executeKnowledgeRouter } from "../services/agents/knowledge-router.js";
import { extractFileText, getSourceFilePath } from "./knowledge-sources.routes.js";
import { gameStateSnapshots as gameStateSnapshotsTable } from "../db/schema/index.js";
import { chats as chatsTable } from "../db/schema/index.js";
import { eq } from "../db/file-query.js";
import {
  PROFESSOR_MARI_ID,
  normalizeCustomEmojiSelection,
  type GenerationParameterSendMap,
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
  formatConversationInstructionsForWrap,
  extractFileAttachmentInputs,
  buildGenerationGuideInstruction,
  buildUserMessageRegenerationPromptFromSource,
  buildLockedPlayerStatsArrayPatch,
  buildLockedPersonaTrackerPatch,
  applyTrackerCharacterCardIdentity,
  collectLatestTrackerCharacterHistory,
  createLocalSidecarGenerationConnection,
  extractImageAttachmentDataUrls,
  appendNonLeadingSystemMessagesToLastUser,
  appendSeparateAgentInjectionMessage,
  computeSummaryHideIds,
  selectRollingSummaryMessages,
  injectIntoOutputFormatOrLastUser,
  getMessageHiddenFromAICharacterIds,
  isManualTrackerCharacterId,
  isMessageHiddenFromAI,
  mergeCustomParameters,
  normalizePromptWrapFormat,
  parseExtra,
  parseJsonField,
  parseGameStateRow,
  parseSnapshotPlayerStats,
  isRoleplaySummaryMode,
  preserveTrackerCharacterUiFields,
  prefixGroupIndividualHistorySpeakers,
  readPersonaSnapshotName,
  resolveActiveCharacterIds,
  resolveActivePersonaCandidate,
  resolveBaseUrl,
  resolveGroupGenerationMode,
  resolveRoleplaySummaryTail,
  resolveCharacterNameMap,
  resolvePromptCharacterIdsForTarget,
  resolveRegenerationGameStateFallbackMessageIds,
  resolveRegenerationGameStateAnchor,
  resolveRoleplayChatSummary,
  resolveUserRegenerationPersistentAttachments,
  resolveVisibleGameStateAnchor,
  resolveKnowledgeSourceLorebookIds,
  shouldPreferLatestVisibleGameState,
  shouldAbortOnPassiveGenerationDisconnect,
  shouldEnableAgentsForGeneration,
  shouldInjectIdentityFallback,
  shouldRestoreRegenerationCharacterTarget,
  stripSpeakerTagsExceptLastAssistant,
  type PromptAttachment,
  type SimpleMessage,
} from "./generate/generate-route-utils.js";
import {
  customAgentCanApplyResult,
  customAgentCanEmitResult,
  findResultAgent,
  isAbortLikeError,
} from "./generate/agent-result-capabilities.js";
import { appendConversationCustomAssetAdvertisements } from "./generate/conversation-custom-assets.js";
import { injectConnectedConversationPromptBlocks } from "./generate/connected-conversation-injections.js";
import { resolveConversationConnectedChatContext } from "./generate/conversation-connected-context.js";
import {
  buildConversationCurrentContextBlock,
  replaceConversationContextBlockForTarget,
} from "./generate/conversation-context-block.js";
import { prepareConversationPromptHistory } from "./generate/conversation-history-runtime.js";
import { resolveConversationPresenceRuntime } from "./generate/conversation-presence-runtime.js";
import { resolveProfessorMariPromptContext } from "./generate/professor-mari-prompt-context.js";
import {
  appendToFirstSystemMessage,
  conversationPromptHistoryContent,
  formatConversationGroupOutputFormat,
  latestHistoryUserContent,
  resolvePresetModePrompt,
} from "./generate/conversation-prompt-formatting.js";
import {
  normalizePromptAttachments,
  resolveImageCaptioningRuntime,
  resolvePromptAttachmentInputs,
  type ImageCaptioningRuntime,
} from "./generate/image-captioning-runtime.js";
import {
  emptyLorebookScanSnapshot,
  toLorebookScanSnapshot,
  type LorebookScanSnapshot,
} from "./generate/lorebook-scan-snapshot.js";
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
import { registerRawRoute } from "./generate/raw-route.js";
import { registerRetryAgentsRoute } from "./generate/retry-agents-route.js";
import { fingerprintChatSummary } from "../services/prompt/chat-summary-fingerprint.js";
import { sendSseEvent, startSseKeepalive, startSseReply, trySendSseEvent } from "./generate/sse.js";
import { runTurnGameBotTurns } from "../services/turn-games/turn-game-bot-runner.service.js";
import {
  getActiveTurnGame,
  getTurnGameContextBuilder,
  startTurnGame,
} from "../services/turn-games/turn-game-runner.service.js";
import { buildRecentSocialMediaActivityBlock } from "../services/noodle/noodle-context.js";
import { normalizeContextInjections } from "./generate/agent-normalizers.js";
import {
  buildGenerationPromptPresetCandidates,
  resolveGenerationPromptPresetChoices,
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
import {
  buildConversationCommandsReminder,
  filterEnabledConversationCommands,
  isConversationCommandEnabled,
} from "../services/generation/conversation-command-runtime.js";
import {
  DIRECTOR_SECRET_PLOT_DEFAULT_RUN_INTERVAL,
  DIRECTOR_SECRET_PLOT_LAST_MESSAGE_KEY,
  appendSecretPlotSystemMessage,
  buildDirectorSecretPlotAgent,
  buildSecretPlotStateFromMemory,
  formatSecretPlotSystemBlock,
  resolveDirectorSecretPlotEnabled,
  resolveDirectorSecretPlotRunInterval,
  secretPlotArcIsCompleted,
  shouldRunDirectorSecretPlotMaintenance,
} from "../services/generation/director-secret-plot-runtime.js";
import { applyPromptPatchOperations } from "../services/generation/prompt-patch-runtime.js";
import { resolveGenerationProviderRuntime } from "../services/generation/provider-generation-runtime.js";
import {
  countProfessorMariCommands,
  handleProfessorMariCommand,
} from "../services/generation/professor-mari-command-runtime.js";
import { handleTurnGameCommand } from "../services/generation/turn-game-command-runtime.js";
import { handleConversationSideEffectCommand } from "../services/generation/conversation-side-effect-command-runtime.js";
import { handleConversationCallCommand } from "../services/generation/conversation-call-command-runtime.js";
import { handleConversationMusicCommand } from "../services/generation/conversation-music-command-runtime.js";
import { handleConversationReactCommand } from "../services/generation/conversation-react-command-runtime.js";
import { handleRoleplayDmCommand } from "../services/generation/roleplay-dm-command-runtime.js";
import { handleConversationScheduleCommand } from "../services/generation/conversation-schedule-command-runtime.js";
import { handleConversationCrossPostCommand } from "../services/generation/conversation-cross-post-command-runtime.js";
import { handleHapticCommand } from "../services/generation/haptic-command-runtime.js";
import { handleConversationSceneCommand } from "../services/generation/conversation-scene-command-runtime.js";
import { handleConversationSelfieCommand } from "../services/generation/conversation-selfie-command-runtime.js";
import {
  CONTINUE_ASSISTANT_MESSAGE_PROMPT,
  appendContinuationMessageContent,
  clampRoleplaySummaryContextSize,
  clampRoleplaySummaryInterval,
  clampRoleplaySummaryMaxTokens,
  formatRoleplaySummaryChatLog,
  isAutomaticRoleplaySummaryEnabled,
  parseChatSummaryText,
  resolveChatSummaryPrompt,
  withoutRetiredChatSummaryAgentIds,
} from "../services/generation/roleplay-summary-runtime.js";
import { getChatGenerationTimeoutMs, getMaxToolRounds } from "../config/runtime-config.js";
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
  formatUnresolvedRoleplayDmFallback,
  replaceRoleplayDmCommandText,
  resolveRoleplayDmTarget,
} from "../services/generation/roleplay-dm-utils.js";
import {
  cardPromptText,
  getHiddenCompletionTokens,
  getVisibleCompletionTokens,
  stripSpacesBeforeLineBreaks,
  trimIncompleteModelEnding,
} from "../services/generation/generation-text-utils.js";
import {
  areConversationSchedulesEnabled,
  formatSmartGroupCandidates,
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
import type { CharacterData, GameMap, GameNpc, Lorebook, LorebookEntry } from "@marinara-engine/shared";
import {
  buildConversationProfileBlocks,
  parsePersonaConvoBehavior,
  readCharacterConvoFields,
  type ConversationProfileParticipant,
} from "../services/conversation/conversation-profiles.js";
import {
  filterPromptMessagesForCharacterAudience,
  scopeIndividualGroupMessagesForTarget,
  type GenerationPromptMessage,
} from "../services/generation/prompt-message-scope.js";
import {
  applyProviderMaxTokensOverride,
  normalizeAgentMaxTokens,
  readChatCompletionsReasoningMetadata,
  shouldReplayStoredChatCompletionsReasoning,
} from "../services/generation/generation-parameters.js";
import {
  fitMessagesForModelAccess,
  mergeModelContextLimit,
  resolveModelAccessPolicy,
  resolveStoredModelContextLimit,
} from "../services/generation/model-access-policy.js";
import {
  promptPreviewForAgents,
  resolveCustomWritableLorebookIds,
} from "../services/generation/agent-prompt-runtime.js";
import { resolveAgentPipelineAgents } from "../services/generation/agent-resolution.js";
import { createReplyFallbackNotifier } from "./generate/fallback-notification.js";
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
  isBuiltInTextRewriteAgentType,
  mergePairedBuiltInRewriteAgents,
  PROSE_GUARDIAN_PENDING_MESSAGE,
  shouldHoldForTextRewrite,
} from "../services/generation/prose-guardian-settings.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
  buildSummaryWriteApprovalProposal,
  isAgentWriteApprovalEnvelope,
} from "./generate/agent-write-approval.js";

function scopeLorebookPromptMessagesForCharacter(
  messages: GenerationPromptMessage[],
  source: LorebookScanResult,
  scoped: LorebookScanResult,
): GenerationPromptMessage[] {
  const worldInfoReplacements = [
    [source.worldInfoBefore, scoped.worldInfoBefore],
    [source.worldInfoAfter, scoped.worldInfoAfter],
  ] as const;
  const scopedDepthContents = new Set(scoped.depthEntries.map((entry) => entry.content));
  const removedDepthContents = source.depthEntries
    .map((entry) => entry.content)
    .filter((content) => !scopedDepthContents.has(content));

  return messages
    .map((message) => {
      if (message.contextKind === "history") return message;
      let content = message.content;
      for (const [currentValue, scopedValue] of worldInfoReplacements) {
        if (currentValue && currentValue !== scopedValue) {
          content = content.split(currentValue).join(scopedValue);
        }
      }
      for (const removedContent of removedDepthContents) {
        content = content.split(removedContent).join("");
      }
      return content === message.content ? message : { ...message, content };
    })
    .filter((message) => message.content.trim().length > 0);
}

const PROFESSOR_MARI_INTERNAL_CHAT_MARKER = "professor-mari";
const INDIVIDUAL_CONVERSATION_LOREBOOK_TOKEN = "__MARINARA_INDIVIDUAL_CONVERSATION_LOREBOOK__";
type ConversationContextMacroKey =
  | "context"
  | "commands"
  | "reactRules"
  | "replyRules"
  | "memories"
  | "lorebook"
  | "aboutMe";
type ConversationRelocationMacroKey = Exclude<ConversationContextMacroKey, "aboutMe">;
type ConversationContextMacroSlots = Record<ConversationContextMacroKey, boolean>;

const CONVERSATION_RELOCATION_MACRO_KEYS: readonly ConversationRelocationMacroKey[] = [
  "context",
  "commands",
  "reactRules",
  "replyRules",
  "memories",
  "lorebook",
];

const EMPTY_CONVERSATION_CONTEXT_MACRO_SLOTS: ConversationContextMacroSlots = {
  context: false,
  commands: false,
  reactRules: false,
  replyRules: false,
  memories: false,
  lorebook: false,
  aboutMe: false,
};

const CONVERSATION_CONTEXT_MACRO_ALIASES: Record<ConversationContextMacroKey, string[]> = {
  context: ["context", "status"],
  commands: ["commands", "commandList"],
  reactRules: ["reactRules", "emojiReact"],
  // Relocates the custom-emoji/sticker "reply" advertisement (the parity gap
  // next to {{reactRules}}); rendered in conversation-custom-assets.ts (#3438).
  // Single macro covering both emoji and sticker reply rules — deliberately no
  // emoji-only/sticker-only aliases, since every alias renders the same block.
  replyRules: ["replyRules"],
  memories: ["memories", "memoryRecall"],
  lorebook: ["lorebook", "lore"],
  // Detection-only slot: when the preset hand-places participant bios via the
  // {{char_about}} / {{persona_about}} field macros, suppress the automatic
  // about-me block so it isn't duplicated (#3436). No placement alias — these
  // field macros are rendered by the shared macro engine's flat pass.
  aboutMe: ["char_about", "persona_about"],
};

function conversationContextMacroPattern(key: ConversationContextMacroKey): RegExp {
  const aliases = CONVERSATION_CONTEXT_MACRO_ALIASES[key].map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\{\\{\\s*(?:${aliases.join("|")})\\s*\\}\\}`, "gi");
}

// Maps a {{#if}} operand (bare `memories` or braced `{{memories}}`) back to its
// relocation key, or null. A quoted literal (`"memories"`) or a dotted/prefixed
// operand (`user.status`) is NOT a reference; About-me fields are excluded (they
// are engine-resolved convo fields, not route-filled). Drives BOTH the defer
// predicate and the token-based slot detection so the two can never disagree —
// which a loose {{#if}}-body regex could not guarantee (#3449).
function relocationKeyForOperand(operand: string): ConversationRelocationMacroKey | null {
  const normalized = operand
    .trim()
    .replace(/^\{\{\s*|\s*\}\}$/g, "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  for (const key of CONVERSATION_RELOCATION_MACRO_KEYS) {
    if (CONVERSATION_CONTEXT_MACRO_ALIASES[key].some((alias) => alias.toLowerCase() === normalized)) return key;
  }
  return null;
}

function isRelocationConditionOperand(operand: string): boolean {
  return relocationKeyForOperand(operand) !== null;
}

// Bare-placeholder detection only. Conditional references are OR'd in afterward
// from the ACTUAL deferred tokens (collectDeferredRelocationConditionOperands +
// relocationKeyForOperand), so slot detection stays in lock-step with the defer
// decision — the previous loose regex over `{{#if …}}` bodies over-matched a
// relocation word inside a quoted literal / dotted operand and dropped the
// underlying retrieval (#3449).
function resolveConversationContextMacroSlots(template: string): ConversationContextMacroSlots {
  const slots: ConversationContextMacroSlots = { ...EMPTY_CONVERSATION_CONTEXT_MACRO_SLOTS };
  for (const key of Object.keys(CONVERSATION_CONTEXT_MACRO_ALIASES) as ConversationContextMacroKey[]) {
    slots[key] = conversationContextMacroPattern(key).test(template);
  }
  return slots;
}

/**
 * Evaluate deferred relocation {{#if}} tokens (encoded during the conversation
 * prompt pass, #3448) now that every relocation value is known, substituting
 * the inner relocation macros ({{memories}} etc.) from the same value map. The
 * values are seeded as variables under every alias spelling so bare and braced
 * operands both resolve. Mutates `messages` in place.
 */
function decodeDeferredRelocationConditionals(
  messages: GenerationPromptMessage[],
  relocationValues: Record<ConversationRelocationMacroKey, string>,
  baseContext: MacroContext,
  options: { preserveKeys?: ReadonlySet<ConversationRelocationMacroKey> } = {},
): void {
  if (!messages.some((message) => hasDeferredRelocationConditionals(message.content))) return;

  const relocationVariables: Record<string, string> = {};
  for (const key of CONVERSATION_RELOCATION_MACRO_KEYS) {
    const value = (relocationValues[key] ?? "").trim();
    for (const alias of CONVERSATION_CONTEXT_MACRO_ALIASES[key]) {
      relocationVariables[alias] = value;
      relocationVariables[alias.toLowerCase()] = value;
    }
  }
  const evalContext: MacroContext = {
    ...baseContext,
    variables: { ...baseContext.variables, ...relocationVariables },
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (!hasDeferredRelocationConditionals(message.content)) continue;
    messages[index] = {
      ...message,
      content: message.content.replace(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE, (match, encoded: string) => {
        const payload = parseDeferredConditionalPayload(encoded);
        if (!payload) {
          logger.error("[generate/conversation] Malformed deferred relocation conditional token; dropping block");
          return "";
        }
        const preserved = collectDeferredRelocationConditionOperands(match).some((operand) => {
          const key = relocationKeyForOperand(operand);
          return key ? options.preserveKeys?.has(key) === true : false;
        });
        if (preserved) return match;
        const selected = selectConditionalPayloadBranch(payload, evalContext, { trimResult: false });
        return resolveMacros(selected, evalContext, { trimResult: false });
      }),
    };
  }
}

function replaceConversationContextMacro(
  messages: GenerationPromptMessage[],
  key: ConversationContextMacroKey,
  content: string | null | undefined,
): boolean {
  const pattern = conversationContextMacroPattern(key);
  let replaced = false;
  const replacement = content?.trim() ?? "";
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    pattern.lastIndex = 0;
    if (!pattern.test(message.content)) continue;
    pattern.lastIndex = 0;
    messages[index] = {
      ...message,
      content: message.content.replace(pattern, replacement).trim(),
    };
    replaced = true;
  }
  return replaced;
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
  const appSettings = createAppSettingsStorage(app.db);

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
    const chatGenerationTimeoutMs = getChatGenerationTimeoutMs();
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
    if (input.pendingSpatialTransition && requestChatMode !== "roleplay" && requestChatMode !== "game") {
      return reply.status(400).send({
        error: "Only Roleplay and Game chats can change hierarchical location.",
        code: "spatial_mode_unsupported",
      });
    }
    if (input.pendingSpatialTransition && (input.impersonate || input.regenerateMessageId || input.continueMessageId)) {
      return reply.status(400).send({
        error: "A hierarchical location change must be submitted as a new owner turn.",
        code: "spatial_transition_requires_new_turn",
      });
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
        const regenerationCharacterIds = parseJsonField<string[]>(chat.characterIds, []);
        if (
          !input.forCharacterId &&
          regenCandidate.characterId &&
          shouldRestoreRegenerationCharacterTarget(
            requestChatMode,
            earlyMeta.groupChatMode,
            regenerationCharacterIds,
          )
        ) {
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
    let committedSpatialTransition: {
      commandId: string;
      currentLocationId: string | null;
      definitionRevision: number;
    } | null = null;

    // Save user message — skip for impersonate (no real user message to save)
    if (!input.impersonate && (input.userMessage || input.attachments?.length || input.pendingSpatialTransition)) {
      // ── Commit game state: lock in the game state the user was seeing ──
      // Find the last assistant message's active swipe and commit its game state.
      // This ensures swipes/regens always use the state from the user's accepted turn.
      let spatialGameStateSnapshotId: string | null = null;
      const preMessages = await chats.listMessages(input.chatId).catch(releaseActiveGenerationAndRethrow);
      for (let i = preMessages.length - 1; i >= 0; i--) {
        if (preMessages[i]!.role === "assistant") {
          const lastAsstMsg = preMessages[i]!;
          const gs = await gameStateStore
            .getByMessage(lastAsstMsg.id, lastAsstMsg.activeSwipeIndex)
            .catch(releaseActiveGenerationAndRethrow);
          if (gs && input.pendingSpatialTransition && requestChatMode === "game") {
            spatialGameStateSnapshotId = gs.id;
          } else if (gs) {
            await gameStateStore.commit(gs.id).catch(releaseActiveGenerationAndRethrow);
          }
          break;
        }
      }

      let userMsg: Awaited<ReturnType<typeof chats.createMessage>>;
      if (input.pendingSpatialTransition) {
        try {
          const committed = await commitSpatialOwnerTurn({
            chatId: input.chatId,
            content: input.userMessage ?? "",
            transition: input.pendingSpatialTransition,
            gameStateSnapshotId: spatialGameStateSnapshotId,
            attachments: input.attachments,
          });
          userMsg = committed.message;
          committedSpatialTransition = {
            commandId: input.pendingSpatialTransition.commandId,
            currentLocationId: committed.snapshot.currentLocationId,
            definitionRevision: committed.snapshot.definitionRevision,
          };
        } catch (error) {
          releaseActiveGeneration();
          if (error instanceof SpatialOwnerTurnError) {
            return reply.status(error.statusCode).send({
              error: error.message,
              code: error.code,
              ...(error.details ?? {}),
            });
          }
          throw error;
        }
      } else {
        userMsg = await chats
          .createMessage({
            chatId: input.chatId,
            role: "user",
            characterId: null,
            content: input.userMessage ?? "",
          })
          .catch(releaseActiveGenerationAndRethrow);
      }
      currentTurnUserMessageId = userMsg?.id ?? null;
      if (requestChatMode === "conversation") {
        recordUserActivity(input.chatId);
      }

      // Store attachments in message extra if present
      if (input.attachments?.length && userMsg?.id) {
        await chats
          .updateMessageExtra(userMsg.id, { attachments: input.attachments })
          .catch(releaseActiveGenerationAndRethrow);
      }

      // Snapshot Persona info for per-message tracking. Only Conversation may
      // fall back to the active Persona; Roleplay and Game can stay Persona-less.
      if (userMsg?.id) {
        const snapshotPersonas = await chars.listPersonas().catch(releaseActiveGenerationAndRethrow);
        const snapshotPersona = resolveActivePersonaCandidate(snapshotPersonas, chat.personaId, requestChatMode);
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
    const resolveGenerationConnection = async (connectionId: string) =>
      connectionId === LOCAL_SIDECAR_CONNECTION_ID
        ? createLocalSidecarGenerationConnection()
        : await connections.getWithKey(connectionId).catch(releaseActiveGenerationAndRethrow);

    let conn = await resolveGenerationConnection(connId);
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
      conn = connId ? await resolveGenerationConnection(connId) : null;
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
    const mainFallbackConnection = await connections.getFallbackForMain().catch(releaseActiveGenerationAndRethrow);
    const mainFallbackBaseUrl = mainFallbackConnection ? resolveBaseUrl(mainFallbackConnection) : "";
    let chatMeta = parseExtra(chat.metadata) as Record<string, unknown>;
    const requestTimeZone = normalizePromptTimeZone(input.userTimeZone);
    const storedPromptTimeZone = normalizePromptTimeZone(chatMeta.promptTimeZone);
    const conversationTimeZone =
      chat.mode === "conversation" ? normalizePromptTimeZone(chatMeta.conversationTimeZone) : undefined;
    const promptTimeZone = conversationTimeZone ?? requestTimeZone ?? storedPromptTimeZone;
    if (!input.autonomous && !conversationTimeZone && requestTimeZone && requestTimeZone !== storedPromptTimeZone) {
      try {
        const updatedChat = await chats.patchMetadata(
          input.chatId,
          (current) => ({ ...current, promptTimeZone: requestTimeZone }),
          { touchUpdatedAt: false },
        );
        if (updatedChat) chatMeta = parseExtra(updatedChat.metadata) as Record<string, unknown>;
      } catch (err) {
        logger.warn(err, "[generate] Failed to remember timezone for chat %s", input.chatId);
      }
    }
    const promptNow = toZonedWallClockDate(new Date(), promptTimeZone);
    const excludePastReasoning = chatMeta.excludePastReasoning !== false;
    const imageCaptioningRuntime: ImageCaptioningRuntime = await resolveImageCaptioningRuntime({
      chatMeta,
      fallbackConnectionId: connId,
      connections,
    });
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
    if (committedSpatialTransition) {
      sendSseEvent(reply, {
        type: "spatial_transition_committed",
        data: { chatId: input.chatId, ...committedSpatialTransition },
      });
    }
    const onFallback = createReplyFallbackNotifier(reply);

    let generationComplete = false;
    let clientDisconnected = false;
    const originalSseWrite = reply.raw.write.bind(reply.raw);
    const canWriteSse = () =>
      !clientDisconnected && !reply.raw.destroyed && !reply.raw.writableEnded && !reply.raw.writableFinished;
    reply.raw.write = ((chunk: any, encodingOrCallback?: any, callback?: any) => {
      if (!canWriteSse()) return false;
      try {
        return originalSseWrite(chunk, encodingOrCallback, callback);
      } catch {
        return false;
      }
    }) as typeof reply.raw.write;
    const stopSseKeepalive = startSseKeepalive(reply);

    const onClose = () => {
      clientDisconnected = true;
      if (generationComplete) return;
      if (!shouldAbortOnPassiveGenerationDisconnect({ impersonate: input.impersonate })) {
        logger.info(
          "[generate] Client disconnected; generation will continue for %s chat: %s",
          requestChatMode,
          input.chatId,
        );
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
      const startsNewAssistantBubble =
        chatMode === "roleplay" &&
        !input.autonomous &&
        !input.regenerateMessageId &&
        !input.continueMessageId &&
        !input.impersonate &&
        !input.turnGameBots &&
        !input.userMessage?.trim() &&
        (input.attachments?.length ?? 0) === 0;
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
          const attachments = normalizePromptAttachments(regenMsg.extra);
          const attachmentInputs = await resolvePromptAttachmentInputs({
            content: typeof regenMsg.content === "string" ? regenMsg.content : "",
            attachments,
            imageCaptioning: imageCaptioningRuntime,
            signal: abortController.signal,
            debugMode: requestDebug,
          });
          if (typeof regenMsg.id === "string" && attachmentInputs.updatedAttachments) {
            try {
              await chats.updateMessageExtra(regenMsg.id, { attachments: attachmentInputs.updatedAttachments });
              regenMsg.extra = {
                ...parseExtra(regenMsg.extra),
                attachments: attachmentInputs.updatedAttachments,
              };
            } catch (error) {
              logger.warn(error, "[image-captioning] Failed to cache image captions for message %s", regenMsg.id);
            }
          }
          regenerateUserSourceMessage = {
            role: "user",
            content: attachmentInputs.content,
            ...(attachmentInputs.images.length ? { images: attachmentInputs.images } : {}),
            ...(attachmentInputs.files.length ? { files: attachmentInputs.files } : {}),
          };
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
      const hierarchicalMapsEnabledForChat = isHierarchicalMapsEnabledForChat(chatMeta);
      const ownerSpatialProjectionPromise = resolveOwnerSpatialProjection(
        input.chatId,
        input.regenerateMessageId
          ? { beforeMessageId: input.regenerateMessageId }
          : input.continueMessageId
            ? { throughMessageId: input.continueMessageId }
            : {},
        chatMeta,
      );
      const rawSelectedGameStateSnapshotPromise = gameStateStore.getForGeneration(
        input.chatId,
        gameStateGenerationOptions,
      );
      const selectedGameStateSnapshotPromise = Promise.all([
        rawSelectedGameStateSnapshotPromise,
        ownerSpatialProjectionPromise,
      ]).then(([snapshot, projection]) => projectGameSnapshotLocation(snapshot, projection));
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
      const persistPromptAttachmentCaptions = async (
        messageId: string | null,
        updatedAttachments: PromptAttachment[] | null,
      ) => {
        if (!messageId || !updatedAttachments) return;
        try {
          await chats.updateMessageExtra(messageId, { attachments: updatedAttachments });
        } catch (error) {
          logger.warn(error, "[image-captioning] Failed to cache image captions for message %s", messageId);
        }
      };
      const mapChatHistoryMessageForPrompt = async (m: any): Promise<GenerationPromptMessage> => {
        const extra = parseExtra(m.extra);
        const personaSnapshotName = m.role === "user" ? readPersonaSnapshotName(extra) : null;
        const attachments = normalizePromptAttachments(m.extra);
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
        const attachmentInputs = await resolvePromptAttachmentInputs({
          content: conversationPromptHistoryContent(m, chatMode),
          attachments,
          imageCaptioning: imageCaptioningRuntime,
          signal: abortController.signal,
          debugMode: requestDebug,
        });
        await persistPromptAttachmentCaptions(
          typeof m.id === "string" ? m.id : null,
          attachmentInputs.updatedAttachments,
        );
        let content = attachmentInputs.content;
        const userUploadedImages = attachments?.filter((a) => a.type?.startsWith("image/"));
        if (m.role === "assistant" && userUploadedImages?.length) {
          const photoName = userUploadedImages[0]?.filename ?? userUploadedImages[0]?.name;
          content += `\n[Sent a photo${photoName ? `: ${photoName}` : ""}]`;
        }
        const hiddenFromAICharacterIds = getMessageHiddenFromAICharacterIds(m);

        return {
          id: typeof m.id === "string" ? m.id : null,
          role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
          content,
          contextKind: "history" as const,
          characterId: typeof m.characterId === "string" && m.characterId ? m.characterId : null,
          ...(personaSnapshotName ? { personaSnapshotName } : {}),
          ...(hiddenFromAICharacterIds.length ? { hiddenFromAICharacterIds } : {}),
          ...(attachmentInputs.images.length ? { images: attachmentInputs.images } : {}),
          ...(attachmentInputs.files.length ? { files: attachmentInputs.files } : {}),
          ...(Object.keys(providerMetadata).length ? { providerMetadata } : {}),
        };
      };

      const mappedMessages: GenerationPromptMessage[] = [];
      for (const message of chatMessages) {
        mappedMessages.push(await mapChatHistoryMessageForPrompt(message));
      }

      // Attach current request's provider inputs to the last user message (they're already saved in extra,
      // but the message was just created and may be the last in mappedMessages)
      if (!imageCaptioningRuntime.enabled && input.attachments?.length && !input.impersonate) {
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

      // Resolve Persona — explicit selection always wins, while only
      // Conversation may fall back to the globally active Persona.
      let personaId: string | null = null;
      let personaName = "User";
      let personaPhoneticName = "";
      let personaDescription = "";
      let personaFields: {
        phoneticName?: string;
        personality?: string;
        scenario?: string;
        backstory?: string;
        appearance?: string;
      } = {};
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

      const persona = resolveActivePersonaCandidate(allPersonas, chat.personaId, chatMode);
      if (persona) {
        personaId = persona.id as string;
        personaName = persona.name;
        personaPhoneticName = typeof persona.phoneticName === "string" ? persona.phoneticName : "";
        personaDescription = cardPromptText(persona.description);

        personaFields = {
          phoneticName: personaPhoneticName,
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
      const resolvedPresetDefaultChoices = resolvedPreset
        ? (parsePromptPresetChoices((resolvedPreset as { defaultChoices?: unknown }).defaultChoices) ?? {})
        : {};
      const chatChoices: Record<string, string | string[]> = resolveGenerationPromptPresetChoices({
        presetSource,
        selectedPresetDiffersFromChat,
        presetDefaultChoices: resolvedPresetDefaultChoices,
        chatPresetChoices: (chatMeta.presetChoices ?? {}) as Record<string, string | string[]>,
      });
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
        const ownerSpatialProjection = await ownerSpatialProjectionPromise;
        let conversationCommandsReminder: string | null = null;
        let conversationContextMacroSlots: ConversationContextMacroSlots = {
          ...EMPTY_CONVERSATION_CONTEXT_MACRO_SLOTS,
        };
        let conversationIsGroup = false;
        let conversationCharacterNames: string[] = [];
        let conversationRespondingCharacterIds: Set<string> | null = null;
        let conversationCharacterPresenceById = new Map<
          string,
          { displayName: string; status: string; activity: string; talkativeness: number }
        >();
        let conversationImportantMemoryBlock: string | null = null;
        // Relocation-macro content captured for the deferred-{{#if}} decode pass
        // (#3448) — set where each is computed, read after all are known.
        let conversationContextBlockValue = "";
        let conversationContextBlocksByCharacterId = new Map<string, string>();
        let conversationLorebookBlockValue = "";
        let conversationMemoriesBlockValue = "";
        let conversationReplyRulesBlockValue = "";
        const buildConversationRelocationValues = (
          lorebook: string,
        ): Record<ConversationRelocationMacroKey, string> => ({
          context: conversationContextBlockValue,
          commands: !input.impersonate ? (conversationCommandsReminder ?? "") : "",
          reactRules: "",
          replyRules: conversationReplyRulesBlockValue,
          memories: conversationMemoriesBlockValue,
          lorebook,
        });
        const identityFallbackPromptTemplateSources: string[] = [];
        const conversationCommandsEnabled = chatMode === "conversation" && chatMeta.characterCommands !== false;
        let temperature: number | undefined = 1;
        let maxTokens = 4096;
        let topP: number | undefined = 1;
        let topK = 0;
        let minP = 0;
        let frequencyPenalty = 0;
        let presencePenalty = 0;
        let showThoughts = true;
        let reasoningEffort: "low" | "medium" | "high" | "xhigh" | "maximum" | null =
          DEFAULT_GENERATION_PARAMS.reasoningEffort;
        let verbosity: "low" | "medium" | "high" | null = null;
        let serviceTier: "flex" | "priority" | null = null;
        let assistantPrefill = "";
        let customThinkingTags: ThinkingTagPair[] = [];
        let customParameters: Record<string, unknown> = {};
        let enabledParameters: GenerationParameterSendMap | undefined;
        let stopSequences: string[] = [];
        let wrapFormat: "xml" | "markdown" | "none" = "xml";
        if (chatMode === "conversation" && resolvedPreset) {
          wrapFormat = normalizePromptWrapFormat(resolvedPreset.wrapFormat);
        }
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
        let lorebookPromptScanResult: LorebookScanResult | null = null;
        const scopedLorebookScansByCharacterId = new Map<string, Promise<LorebookScanResult>>();
        let presetHandledLorebooks = false;
        let characterAdvancedPromptsInjected = false;
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
        const promptGroupChatMode = resolveGroupGenerationMode(chatMode, chatMeta.groupChatMode);
        const promptTargetCharacterId =
          typeof input.forCharacterId === "string" && characterIds.includes(input.forCharacterId)
            ? input.forCharacterId
            : null;
        const promptCharacterIds = resolvePromptCharacterIdsForTarget(characterIds, promptTargetCharacterId);
        const deferConversationLorebookScanToResponder =
          chatMode === "conversation" &&
          characterIds.length > 1 &&
          promptGroupChatMode === "individual" &&
          !promptTargetCharacterId &&
          input.impersonate !== true;
        const characterAdvancedPromptIds = resolveCharacterAdvancedPromptIds(promptCharacterIds, chatMode, chatMeta);
        const deferCharacterMacros =
          characterIds.length > 1 &&
          promptGroupChatMode === "individual" &&
          (promptGroupResponseOrder !== "manual" || chatMode === "conversation") &&
          input.impersonate !== true;
        const shouldPrefixGroupHistorySpeakers =
          chatMeta.groupSpeakerNamesInHistory === true &&
          characterIds.length > 1 &&
          chatMode !== "conversation" &&
          chatMode !== "game" &&
          promptGroupChatMode === "individual";
        const promptMacroContext = await buildPromptMacroContext({
          db: app.db,
          characterIds: promptCharacterIds,
          groupCharacterIds: promptTargetCharacterId ? characterIds : undefined,
          personaName,
          personaPhoneticName,
          personaDescription,
          personaFields,
          variables: {
            gameStoryboardKeyframeCount: String(
              normalizeGameStoryboardKeyframeCount(chatMeta.gameStoryboardKeyframeCount),
            ),
          },
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
        const resolvePromptMacrosWithoutVariableWrites = (value: string) =>
          resolveMacros(
            value,
            { ...promptMacroContext, variables: { ...promptMacroContext.variables } },
            { trimResult: false },
          );
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
            resolveMacros: (value, randomSeed) =>
              resolveMacros(value, promptMacroContext, { trimResult: false, randomSeed }),
            targetCharacterId: promptTargetCharacterId,
          });
          if (regenerateUserSourceMessage) {
            const sourceMessages = [regenerateUserSourceMessage];
            applyRegexScriptsToPromptMessages(sourceMessages, regexScripts, {
              resolveMacros: (value, randomSeed) =>
                resolveMacros(value, promptMacroContext, { trimResult: false, randomSeed }),
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
            resolvePromptMacrosWithoutVariableWrites,
          );
        const deferredLorebookEntryStateBaseline = deferConversationLorebookScanToResponder
          ? ((chatMeta.entryStateOverrides as Record<
              string,
              { ephemeral?: number | null; enabled?: boolean }
            >) ?? undefined)
          : undefined;
        const deferredLorebookTimingStateBaseline = deferConversationLorebookScanToResponder
          ? ((chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined)
          : undefined;
        const scanConversationLorebooks = async (
          targetCharacterIds: string[],
          options: { previewOnly?: boolean; recordSnapshot?: boolean } = {},
        ) => {
          sendProgress("lorebooks");
          const lorebookResult = await processLorebooks(app.db, toLorebookScanMessages(), null, {
            chatId: input.chatId,
            characterIds: targetCharacterIds,
            personaId,
            activeLorebookIds: chatActiveLorebookIds,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            tokenBudget: resolveLorebookTokenBudget(chatMeta),
            chatEmbedding: chatContextEmbedding,
            semanticEmbeddingsByLorebookId: lorebookSemanticEmbeddingsById,
            semanticSimilarityBaseline: lorebookSemanticSimilarityBaseline,
            entryStateOverrides: options.previewOnly
              ? deferredLorebookEntryStateBaseline
              : ((chatMeta.entryStateOverrides as Record<
                  string,
                  { ephemeral?: number | null; enabled?: boolean }
                >) ?? undefined),
            entryTimingStates: options.previewOnly
              ? deferredLorebookTimingStateBaseline
              : ((chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined),
            previewOnly: options.previewOnly,
            generationTriggers: lorebookGenerationTriggers,
            resolveContent: resolvePromptMacrosForLorebook,
          });
          if (options.recordSnapshot !== false) lorebookScanSnapshot = toLorebookScanSnapshot(lorebookResult);
          rememberKnowledgeRouterActivatedLorebookIds(
            knowledgeRouterActivatedLorebookEntryIds,
            knowledgeRouterExcludedLorebookEntryIds,
            lorebookResult,
          );
          knowledgeRouterActivationPassCompleted = true;

          if (!options.previewOnly) {
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
          }
          return lorebookResult;
        };
        const injectCharacterAdvancedPrompts = async () => {
          if (characterAdvancedPromptsInjected) return;
          const entries = await collectCharacterAdvancedPromptEntries(
            app.db,
            characterAdvancedPromptIds,
            promptMacroContext,
            wrapFormat,
          );
          if (entries.length > 0) {
            finalMessages = injectAtDepth(finalMessages, entries);
          }
          characterAdvancedPromptsInjected = true;
        };
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
        let lorebookSemanticEmbeddingsById: Map<string, number[] | null> | undefined;
        let lorebookSemanticSimilarityBaseline = 0;
        const knowledgeRouterActivatedLorebookEntryIds = new Set<string>();
        const knowledgeRouterExcludedLorebookEntryIds = new Set<string>();
        let knowledgeRouterActivationPassCompleted = false;
        try {
          const lorebookScopeFilters = {
            chatId: input.chatId,
            characterIds: promptCharacterIds,
            personaId,
            activeLorebookIds: chatActiveLorebookIds,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
          };
          const activeEntries = (await lorebooksStore.listActiveEntries({
            ...lorebookScopeFilters,
          })) as LorebookEntry[];
          const hasVectorizedEntries = activeEntries.some(
            (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0,
          );
          if (hasVectorizedEntries && memoryRecallVectorizerAvailable) {
            const allLorebooks = (await lorebooksStore.list()) as unknown as Lorebook[];
            const relevantLorebooks = filterRelevantLorebooks(allLorebooks, lorebookScopeFilters) as Lorebook[];
            const semanticEmbeddings = await buildLorebookSemanticEmbeddingsById({
              lorebooks: relevantLorebooks,
              entries: activeEntries,
              scanMessages: toLorebookScanMessages(),
              embeddingSource: memoryRecallEmbeddingSource,
              signal: abortController.signal,
            });
            chatContextEmbedding = semanticEmbeddings.defaultEmbedding;
            lorebookSemanticEmbeddingsById = semanticEmbeddings.embeddingsByLorebookId;
            lorebookSemanticSimilarityBaseline = semanticEmbeddings.similarityBaseline;
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
            groupCharacterIds: characterIds,
            personaId,
            personaName,
            personaPhoneticName,
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
            forcedLorebookEntryIds: ownerSpatialProjection?.lorebookEntryIds ?? [],
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            lorebookTokenBudget: resolveLorebookTokenBudget(chatMeta),
            chatEmbedding: chatContextEmbedding,
            semanticEmbeddingsByLorebookId: lorebookSemanticEmbeddingsById,
            semanticSimilarityBaseline: lorebookSemanticSimilarityBaseline,
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
            impersonate: input.impersonate === true,
            preserveImpersonatePresetSections: input.impersonate === true && presetSource === "impersonate",
            deferCharacterMacros,
          };

          const assembled = await assemblePrompt(assemblerInput);
          lorebookPromptScanResult = assembled.lorebookScanResult ?? null;
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
          characterAdvancedPromptsInjected = true;
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
          const presenceRuntime = await resolveConversationPresenceRuntime({
            db: app.db,
            chatId: input.chatId,
            chatMeta,
            characterIds,
            chars,
            chats,
            actualNow: new Date(),
            promptNow,
            forCharacterId: input.forCharacterId,
            mentionedCharacterNames: input.mentionedCharacterNames,
            shouldAccountAutonomousGeneration,
            regenerateMessageId: input.regenerateMessageId,
            impersonate: input.impersonate,
            skipPresenceDelay: input.skipPresenceDelay,
            supportsHiddenFromAI,
            contextMessageLimit,
            chatMessages,
            finalMessages,
            abortSignal: abortController.signal,
            writeSse: (payload) => {
              reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
            },
            endSse: () => {
              reply.raw.end();
            },
            mapChatHistoryMessageForPrompt,
            resolveHistoryMessageMacros,
          });
          if (presenceRuntime.ended || presenceRuntime.aborted) {
            return;
          }
          chatMessages = presenceRuntime.chatMessages;
          finalMessages = presenceRuntime.finalMessages;
          const { convoCharInfo, convoCharNames, charNameList, isGroup } = presenceRuntime;
          conversationIsGroup = isGroup;
          conversationCharacterNames = convoCharNames;
          conversationRespondingCharacterIds = new Set(presenceRuntime.respondingCharacterIds);
          conversationCharacterPresenceById = new Map(
            convoCharInfo.map((character) => [
              character.charId,
              {
                displayName: character.displayName,
                status: character.status,
                activity: character.activity,
                talkativeness: character.talkativeness,
              },
            ]),
          );

          const nowInstant = new Date();
          const conversationSummaryFallback = await connections.getFallbackForAgents();
          const preparedHistory = await prepareConversationPromptHistory({
            finalMessages,
            chatMessages,
            scopedMessages,
            regenerateMessageId: input.regenerateMessageId,
            chatMeta,
            chatId: input.chatId,
            chats,
            chars,
            characterIds,
            allCharacterIds,
            convoCharInfo,
            convoCharNames,
            personaName,
            nowInstant,
            promptTimeZone,
            wrapFormat,
            connection: {
              provider: conn.provider,
              apiKey: conn.apiKey,
              model: conn.model,
              maxContext: conn.maxContext,
              openrouterProvider: conn.openrouterProvider,
              maxTokensOverride: conn.maxTokensOverride,
            },
            connectionId: conn.id,
            baseUrl,
            fallbackConnection: conversationSummaryFallback,
            fallbackBaseUrl: conversationSummaryFallback ? resolveBaseUrl(conversationSummaryFallback) : "",
          });
          finalMessages = preparedHistory.finalMessages;

          // ── Conversation-mode profiles (Convo ONLY): display name, about-me, behavior ──
          // Built entirely inside this branch, so none of these fields can reach
          // RP/VN/Game prompts. `convoFields` is set on the shared macro context here
          // (never elsewhere), so {{char_about}}/{{convo_behavior}}/etc. resolve to ""
          // in every other mode even if placed in a shared card/lorebook surface.
          const aboutMeOverrides = (chatMeta.conversationAboutMeOverrides ?? {}) as Record<string, string>;
          const autoInjectAbout = chatMeta.conversationAboutMeInject !== false;
          const effectiveAbout = (id: string, fallback: string): string => {
            const override = aboutMeOverrides[id];
            return typeof override === "string" && override.trim() ? override : fallback;
          };
          const profileParticipants: ConversationProfileParticipant[] = [];
          for (const info of convoCharInfo) {
            const charRow = await chars.getById(info.charId);
            let cdata: CharacterData | null = null;
            if (charRow) {
              try {
                cdata = (typeof charRow.data === "string" ? JSON.parse(charRow.data) : charRow.data) as CharacterData;
              } catch {
                cdata = null;
              }
            }
            const cf = readCharacterConvoFields(cdata);
            profileParticipants.push({
              id: info.charId,
              name: info.name,
              displayName: cf.convoDisplayName || info.name,
              aboutMe: effectiveAbout(info.charId, cf.aboutMe),
              isPersona: false,
              behavior: cf.convoBehavior,
              postHistoryInstructions: cf.postHistoryInstructions,
            });
          }
          if (persona) {
            const personaAboutDefault = typeof persona.aboutMe === "string" ? persona.aboutMe : "";
            const personaConvoDisplay = typeof persona.convoDisplayName === "string" ? persona.convoDisplayName : "";
            profileParticipants.push({
              id: persona.id as string,
              name: persona.name,
              displayName: personaConvoDisplay || persona.name,
              aboutMe: effectiveAbout(persona.id as string, personaAboutDefault),
              isPersona: true,
              behavior: parsePersonaConvoBehavior(persona.convoBehavior),
              postHistoryInstructions: "",
            });
          }
          const convoProfileBlocks = buildConversationProfileBlocks({
            participants: profileParticipants,
            primaryCharacterId: input.forCharacterId ?? convoCharInfo[0]?.charId ?? null,
            autoInjectAbout,
            isGroup,
            resolveMacros: resolvePromptMacros,
          });
          promptMacroContext.convoFields = convoProfileBlocks.convoFields;

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

          const conversationPromptTemplate =
            customPrompt ?? (selectedConversationPrompt || DEFAULT_CONVERSATION_PROMPT);
          identityFallbackPromptTemplateSources.push(conversationPromptTemplate);
          conversationContextMacroSlots = resolveConversationContextMacroSlots(conversationPromptTemplate);
          const individualConversationGroup = isGroup && promptGroupChatMode === "individual";
          const aliasedConversationPrompt = (
            individualConversationGroup
              ? conversationPromptTemplate
              : conversationPromptTemplate.replace(/\{\{charName\}\}/g, charNameList)
          ).replace(/\{\{userName\}\}/g, personaName);
          const renderedConversationPrompt = resolveMacros(
            aliasedConversationPrompt,
            promptMacroContext,
            // Defer {{#if}} blocks that test a relocation macro — their value is
            // filled in later; the decode pass below evaluates them (#3448).
            {
              deferConditionalOperand: isRelocationConditionOperand,
              ...(deferCharacterMacros ? { deferCharacterMacros: "names" as const } : {}),
            },
          );
          // Mark each relocation macro a deferred conditional actually references
          // as "used" so its retrieval runs and its value is captured for the
          // decode. Reads the real tokens (not a regex), so it agrees exactly
          // with what was deferred above — no over/under-match (#3449).
          for (const operand of collectDeferredRelocationConditionOperands(renderedConversationPrompt)) {
            const key = relocationKeyForOperand(operand);
            if (key) conversationContextMacroSlots[key] = true;
          }
          const conversationInstructionParts = [unwrapConversationInstructions(renderedConversationPrompt)];

          if (individualConversationGroup) {
            conversationInstructionParts.push("This is a group DM with other participants.");
          } else if (isGroup) {
            conversationInstructionParts.push(
              [
                `This is a group DM. Each character responds in their own voice and personality. Not every character needs to respond every time; only those who would naturally react.`,
                `IMPORTANT: Prefix each character's line with their name. Example:`,
                `${convoCharNames[0] ?? "Alice"}: hey whats up`,
                `${convoCharNames[1] ?? "Bob"}: not much lol`,
                `If a character sends multiple lines in a row, only prefix the first line:`,
                `${convoCharNames[0] ?? "Alice"}: so anyway`,
                `i was thinking about that`,
                `${convoCharNames[1] ?? "Bob"}: yeah?`,
              ].join("\n"),
            );
          }

          let conversationSystemPrompt = formatConversationInstructionsForWrap(
            conversationInstructionParts.filter((part) => part.trim().length > 0).join("\n"),
            wrapFormat,
          );

          conversationCommandsReminder = await buildConversationCommandsReminder({
            enabled: conversationCommandsEnabled,
            chatMode,
            chatMeta,
            characterIds,
            personaName,
            chatId: input.chatId,
            musicPlayerEnabled: input.musicPlayerEnabled,
            musicPlayerSource: input.musicPlayerSource,
            chats,
            chars,
            agentsStore,
            db: app.db,
            wrapFormat,
            resolvePromptMacros,
          });

          // ── Home Professor Mari: inject assistant knowledge & commands ──
          if (isHomeProfessorMariAssistantChat) {
            conversationSystemPrompt +=
              "\n\n" + (await resolveProfessorMariPromptContext({ chatMeta, chars, lorebooksStore, chats, presets }));
          }

          // Build the context injection (last user-role message before generation)
          const contextBlock = buildConversationCurrentContextBlock({
            nowInstant,
            promptTimeZone,
            convoCharInfo,
            finalMessages,
            personaName,
            userMessage: input.userMessage,
            userStatus: input.userStatus,
            userActivity: input.userActivity,
            mentionedCharacterNames: input.mentionedCharacterNames,
            autonomousIntentKey: input.autonomousIntentKey,
            wrapFormat,
          });
          conversationContextBlockValue = contextBlock ?? "";
          if (individualConversationGroup) {
            conversationContextBlocksByCharacterId = new Map(
              convoCharInfo.map((character) => [
                character.charId,
                buildConversationCurrentContextBlock({
                  nowInstant,
                  promptTimeZone,
                  convoCharInfo,
                  finalMessages,
                  personaName,
                  userMessage: input.userMessage,
                  userStatus: input.userStatus,
                  userActivity: input.userActivity,
                  mentionedCharacterNames: input.mentionedCharacterNames,
                  autonomousIntentKey: input.autonomousIntentKey,
                  primaryCharacterId: character.charId,
                  wrapFormat,
                }),
              ]),
            );
          }

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
              wrapFormat,
            );
          }

          const { connectedChatBlock, systemPromptAppend: connectedChatSystemPrompt } =
            await resolveConversationConnectedChatContext({
              connectedChatId: chat.connectedChatId,
              conversationCommandsEnabled,
              chatMeta,
              personaName,
              chats,
              chars,
              gameStateStore,
              wrapFormat,
            });
          if (connectedChatSystemPrompt) {
            conversationSystemPrompt += "\n\n" + connectedChatSystemPrompt;
          }

          conversationImportantMemoryBlock = preparedHistory.importantMemoryBlock;
          if (conversationImportantMemoryBlock && !conversationContextMacroSlots.memories) {
            conversationSystemPrompt += "\n\n" + preparedHistory.importantMemoryBlock;
          }

          conversationSystemPrompt = resolvePromptMacros(conversationSystemPrompt);

          // Convo behavior + about-me are already macro-resolved in the helper, so
          // append them after the system prompt's own macro pass to avoid double resolution.
          if (convoProfileBlocks.behaviorConstantBefore) {
            conversationSystemPrompt = convoProfileBlocks.behaviorConstantBefore + "\n\n" + conversationSystemPrompt;
          }
          if (convoProfileBlocks.behaviorConstantAfter) {
            conversationSystemPrompt += "\n\n" + convoProfileBlocks.behaviorConstantAfter;
          }
          // Skip the automatic about-me block when the preset already places the
          // bios itself via {{char_about}}/{{persona_about}}, mirroring how the
          // other relocation macros suppress their auto insertion (#3436).
          if (convoProfileBlocks.aboutMeBlock && (!conversationContextMacroSlots.aboutMe || isGroup)) {
            conversationSystemPrompt += "\n\n" + convoProfileBlocks.aboutMeBlock;
          }

          finalMessages = [
            { role: "system" as const, content: conversationSystemPrompt },
            ...finalMessages,
            ...(connectedChatBlock ? [{ role: "user" as const, content: connectedChatBlock }] : []),
            // Post-history-strategy behavior stays near the generation tail; context remains last unless relocated.
            ...(convoProfileBlocks.behaviorPostHistoryBlock
              ? [{ role: "user" as const, content: convoProfileBlocks.behaviorPostHistoryBlock }]
              : []),
          ];
          if (conversationContextMacroSlots.context) {
            // The preset references {{context}} — as a literal placeholder or a
            // deferred {{#if context}} conditional. Rendering is owned by the
            // in-place replace or the later decode pass; don't ALSO push the tail
            // fallback, which would double-inject the context block (#3449). (A
            // deferred token has no literal to replace, so the replace() return
            // is not a reliable "inserted" signal — key on the slot instead.)
            replaceConversationContextMacro(finalMessages, "context", contextBlock);
          } else {
            finalMessages.push({ role: "user" as const, content: contextBlock });
          }
          if (conversationContextMacroSlots.reactRules) {
            replaceConversationContextMacro(finalMessages, "reactRules", null);
          }
          if (conversationContextMacroSlots.commands) {
            replaceConversationContextMacro(
              finalMessages,
              "commands",
              !input.impersonate ? conversationCommandsReminder : null,
            );
          }

          // ── Lorebook injection for conversation mode ──
          {
            if (deferConversationLorebookScanToResponder) {
              // Smart and Sequential Individual generations do not know the responder yet.
              // Preserve the requested prompt location and scan with only the target
              // character once each separate provider generation begins.
              if (conversationContextMacroSlots.lorebook) {
                replaceConversationContextMacro(finalMessages, "lorebook", INDIVIDUAL_CONVERSATION_LOREBOOK_TOKEN);
              }
            } else {
              const lorebookResult = await scanConversationLorebooks(promptCharacterIds);
              lorebookPromptScanResult = lorebookResult;
              const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
                .filter(Boolean)
                .join("\n");
              if (loreContent) {
                const loreBlock = wrapContent(loreContent, "Lore", wrapFormat);
                conversationLorebookBlockValue = loreBlock;
                if (conversationContextMacroSlots.lorebook) {
                  replaceConversationContextMacro(finalMessages, "lorebook", loreBlock);
                } else {
                  // Inject before the awareness block (or before first user/assistant message)
                  const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
                  const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
                  finalMessages.splice(insertAt, 0, { role: "system" as const, content: loreBlock });
                }
              } else if (conversationContextMacroSlots.lorebook) {
                replaceConversationContextMacro(finalMessages, "lorebook", "");
              }
              // Inject depth-based lorebook entries into the message array
              if (lorebookResult.depthEntries.length > 0) {
                finalMessages = injectAtDepth(finalMessages, lorebookResult.depthEntries);
              }
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
            forcedEntryIds:
              ownerSpatialProjection?.ownerMode === "roleplay" ? ownerSpatialProjection.lorebookEntryIds : [],
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
            tokenBudget: resolveLorebookTokenBudget(chatMeta),
            chatEmbedding: chatContextEmbedding,
            semanticEmbeddingsByLorebookId: lorebookSemanticEmbeddingsById,
            semanticSimilarityBaseline: lorebookSemanticSimilarityBaseline,
            entryStateOverrides:
              (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
              undefined,
            entryTimingStates: (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
            generationTriggers: lorebookGenerationTriggers,
            resolveContent: resolvePromptMacrosForLorebook,
          });
          lorebookPromptScanResult = lorebookResult;
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

        if (chatMode !== "game") {
          await injectCharacterAdvancedPrompts();
        }

        // ── Author's Notes injection ──
        const authorNotes = (chatMeta.authorNotes as string | undefined)?.trim();
        if (authorNotes) {
          const authorNotesDepth = (chatMeta.authorNotesDepth as number) ?? 4;
          finalMessages = injectAtDepth(finalMessages, [
            { content: authorNotes, role: "system", depth: authorNotesDepth },
          ]);
        }

        // Skip OOC injection entirely for scene chats — scenes are self-contained
        const isSceneChat = chatMeta.sceneStatus === "active";
        await injectConnectedConversationPromptBlocks({
          chatMode,
          connectedChatId: chat.connectedChatId,
          isSceneChat,
          chatId: input.chatId,
          chats,
          finalMessages,
        });

        const recentSocialMediaActivityBlock = await buildRecentSocialMediaActivityBlock({
          db: app.db,
          chatMode,
          characterIds: promptCharacterIds,
          personaId,
          wrapFormat,
        });
        if (recentSocialMediaActivityBlock) {
          const firstUserIdx = finalMessages.findIndex((m) => m.role === "user" || m.role === "assistant");
          const insertAt = firstUserIdx >= 0 ? firstUserIdx : finalMessages.length;
          finalMessages.splice(insertAt, 0, {
            role: "system" as const,
            content: recentSocialMediaActivityBlock,
            contextKind: "injection",
          });
        }

        const providerRuntime = resolveGenerationProviderRuntime({
          connectionId: connId ?? "",
          connection: conn,
          baseUrl,
          fallbackConnection: mainFallbackConnection,
          fallbackBaseUrl: mainFallbackBaseUrl,
          onFallback,
          chatMode,
          isSceneChat,
          chatParameters: chatMeta.chatParameters,
          modelAccessPolicy,
          initial: {
            temperature,
            maxTokens,
            topP,
            topK,
            minP,
            frequencyPenalty,
            presencePenalty,
            showThoughts,
            reasoningEffort,
            verbosity,
            serviceTier,
            assistantPrefill,
            customThinkingTags,
            customParameters,
            enabledParameters,
            stopSequences,
            effectiveMaxContext,
          },
        });
        const {
          connectionParams,
          chatParams,
          resolvedEffort,
          enableThinking,
          isClaudeNoSampling,
          providerTopK,
          primaryProvider: agentChatProvider,
          provider,
        } = providerRuntime;
        ({
          temperature,
          maxTokens,
          topP,
          topK,
          minP,
          frequencyPenalty,
          presencePenalty,
          showThoughts,
          reasoningEffort,
          verbosity,
          serviceTier,
          assistantPrefill,
          customThinkingTags,
          customParameters,
          enabledParameters,
          stopSequences,
          effectiveMaxContext,
        } = providerRuntime);

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
          chatProvider: agentChatProvider,
          chatConnectionId: connId ?? "",
          chatModel: conn.model,
          chatCustomParameters: connectionParams?.customParameters ?? {},
          chatMaxOutputTokens: chatConnectionMaxOutputTokens,
          chatMaxParallelJobs: chatConnectionMaxParallelJobs,
          chatEnableCaching: conn.enableCaching === "true",
          chatAnthropicExtendedCacheTtl: conn.anthropicExtendedCacheTtl === "true",
          chatCachingAtDepth: conn.cachingAtDepth ?? 5,
          activeMusicPlayerSource,
          chatMetadata: chatMeta,
          onFallback,
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
        const isAvailableGroupResponder = (characterId: string): boolean =>
          chatMode !== "conversation" || conversationRespondingCharacterIds?.has(characterId) === true;
        const availableGroupCharacters = charInfo.filter((character) => isAvailableGroupResponder(character.id));
        const groupResponderName = (characterId: string): string =>
          conversationCharacterPresenceById.get(characterId)?.displayName ??
          charInfo.find((character) => character.id === characterId)?.name ??
          "Character";

        await appendConversationCustomAssetAdvertisements({
          chatMode,
          mentionedCharacterNames: input.mentionedCharacterNames,
          promptTargetCharacterId,
          charInfo,
          personaId,
          chatMeta,
          finalMessages,
          currentUserInputContent,
          customEmojisStore,
          customStickersStore,
          personaGallery,
          characterGallery,
          connections,
          conversationCustomEmojiUrlByName,
          replyRulesMacroPlacement: conversationContextMacroSlots.replyRules
            ? (content) => {
                conversationReplyRulesBlockValue = content;
                replaceConversationContextMacro(finalMessages, "replyRules", content);
              }
            : undefined,
        });

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
            promptTemplateSources: identityFallbackPromptTemplateSources,
            resolvePromptMacros,
            isConversation: chatMode === "conversation",
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
            !(typeof chatMeta.gameSystemPrompt === "string" && chatMeta.gameSystemPrompt.trim().length > 0) &&
            !(typeof chatMeta.gameGmPromptTemplateId === "string" && chatMeta.gameGmPromptTemplateId.trim().length > 0)
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
                forcedEntryIds:
                  ownerSpatialProjection?.ownerMode === "game" ? ownerSpatialProjection.lorebookEntryIds : [],
                excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
                excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
                tokenBudget: resolveLorebookTokenBudget(chatMeta),
                chatEmbedding: chatContextEmbedding,
                semanticEmbeddingsByLorebookId: lorebookSemanticEmbeddingsById,
                semanticSimilarityBaseline: lorebookSemanticSimilarityBaseline,
                entryStateOverrides:
                  (chatMeta.entryStateOverrides as Record<string, { ephemeral?: number | null; enabled?: boolean }>) ??
                  undefined,
                entryTimingStates:
                  (chatMeta.entryTimingStates as Record<string, LorebookEntryTimingState>) ?? undefined,
                generationTriggers: lorebookGenerationTriggers,
                resolveContent: resolvePromptMacrosForLorebook,
              },
            );
            lorebookPromptScanResult = lorebookResult;
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

          // Game bypasses the preset assembler, so card-authored depth and
          // post-history instructions must be injected explicitly before the
          // final GM format reminder claims the generation tail.
          await injectCharacterAdvancedPrompts();

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
            timeZone: promptTimeZone,
            wrapFormat,
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
        if (chatMode === "conversation" && conversationContextMacroSlots.memories) {
          const memoryRecallMessages: GenerationPromptMessage[] = [];
          if (enableMemoryRecall && memoryRecallVectorizerAvailable) {
            await injectMemoryRecallContext({
              db: app.db,
              messages: memoryRecallMessages,
              currentInputMessages: currentInputMessages(),
              chatId: input.chatId,
              embeddingSource: memoryRecallEmbeddingSource,
              contextLimit: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
              sendProgress,
              signal: abortController.signal,
              resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
              wrapFormat,
            });
          }
          const memoryRecallBlock = memoryRecallMessages
            .map((message) => message.content)
            .filter(Boolean)
            .join("\n\n");
          conversationMemoriesBlockValue = [conversationImportantMemoryBlock, memoryRecallBlock]
            .filter(Boolean)
            .join("\n\n");
          replaceConversationContextMacro(finalMessages, "memories", conversationMemoriesBlockValue);
        } else if (enableMemoryRecall && memoryRecallVectorizerAvailable) {
          await injectMemoryRecallContext({
            db: app.db,
            messages: finalMessages,
            currentInputMessages: currentInputMessages(),
            chatId: input.chatId,
            embeddingSource: memoryRecallEmbeddingSource,
            contextLimit: suppressModelParameters ? undefined : (effectiveMaxContext ?? connectionMaxContext),
            sendProgress,
            signal: abortController.signal,
            resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
            wrapFormat,
          });
        }

        // ── Deferred relocation {{#if}} decode (#3448) ──
        // Every relocation value is now known: evaluate {{#if memories != ""}} /
        // {{#if lorebook contains "x"}} etc. and fill in their inner macros.
        if (chatMode === "conversation") {
          decodeDeferredRelocationConditionals(
            finalMessages,
            buildConversationRelocationValues(conversationLorebookBlockValue),
            promptMacroContext,
            deferConversationLorebookScanToResponder ? { preserveKeys: new Set(["lorebook"]) } : undefined,
          );
        }

        if (
          chatMode === "conversation" &&
          conversationCommandsReminder &&
          !input.impersonate &&
          !conversationContextMacroSlots.commands
        ) {
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
          logger.debug("[generate] Injected continuation prompt for assistant message %s", input.continueMessageId);
        }

        // ── Group chat processing ──
        const isGroupChat = characterIds.length > 1;
        const groupResponseOrder = (chatMeta.groupResponseOrder as string) ?? "sequential";
        const groupChatMode = resolveGroupGenerationMode(chatMode, chatMeta.groupChatMode);
        // Auto-enable speaker colors for conversation mode groups (system prompt already requests tags)
        const groupSpeakerColors = chatMeta.groupSpeakerColors === true || (chatMode === "conversation" && isGroupChat);
        const groupTurnPromptEnabled = chatMeta.groupTurnPromptEnabled !== false;

        if (isGroupChat && chatMode !== "conversation") {
          // Keep one concrete tagged assistant example while trimming redundant
          // wrappers from older roleplay history.
          stripSpeakerTagsExceptLastAssistant(finalMessages);
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

          if (groupInstructions.length > 0) {
            const rawBlock = groupInstructions.join("\n");
            const instructionBlock = wrapFormat === "markdown" ? `\n## Group Chat\n${rawBlock}` : rawBlock;

            // Inject into the <output_format> section if present, otherwise append to last user message
            injectIntoOutputFormatOrLastUser(finalMessages, instructionBlock, { indent: true });
          }
        }

        finalMessages = injectOwnerSpatialPrompt(finalMessages, ownerSpatialProjection);

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
        const characterTrackerHistory = resolvedAgents.some((agent) => agent.type === "character-tracker")
          ? collectLatestTrackerCharacterHistory(
              await gameStateStore.getRecent(input.chatId, 100, latestGameState?.createdAt),
            )
          : [];
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
          characterTrackerHistory: characterTrackerHistory as unknown as AgentContext["characterTrackerHistory"],
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
        const createsAssistantMessage = !input.impersonate && !input.regenerateMessageId && !input.continueMessageId;
        if (
          illustratorAgentForInterval &&
          (await shouldSkipAgentByAssistantInterval({
            agentsStore,
            chatId: input.chatId,
            agentType: "illustrator",
            settings: illustratorAgentForInterval.settings,
            fallbackInterval: (getDefaultBuiltInAgentSettings("illustrator").runInterval as number) ?? 5,
            messages: allChatMessages,
            countUpcomingAssistantMessage: createsAssistantMessage,
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

        // About Me Keeper (Convo only): give the agent each participant's current
        // public (card) + chat-specific about-me so it can decide what to update.
        if (resolvedAgents.some((a) => a.type === "about-me-keeper")) {
          const aboutMeOverridesForAgent = (chatMeta.conversationAboutMeOverrides ?? {}) as Record<string, string>;
          const aboutMeState: Array<{
            characterId: string;
            name: string;
            publicAboutMe: string;
            chatAboutMe: string;
          }> = [];
          for (const char of agentContext.characters) {
            let publicAboutMe = "";
            try {
              const row = await chars.getById(char.id);
              const data = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : null;
              const ext = (data?.extensions ?? {}) as Record<string, unknown>;
              if (typeof ext.aboutMe === "string") publicAboutMe = ext.aboutMe;
            } catch {
              /* non-critical */
            }
            const chatAboutMe =
              typeof aboutMeOverridesForAgent[char.id] === "string" ? aboutMeOverridesForAgent[char.id]! : "";
            aboutMeState.push({ characterId: char.id, name: char.name, publicAboutMe, chatAboutMe });
          }
          agentContext.memory._aboutMeState = aboutMeState;
        }

        // If the background agent is enabled, load available backgrounds + tags into context
        const backgroundAgent = resolvedAgents.find((a) => a.type === "background");
        if (backgroundAgent) {
          const backgroundGenerationEnabled =
            backgroundAgent.settings?.autoGenerateBackgrounds === true &&
            chatMeta.gameStoryboardViewerDisplayMode !== "background";
          agentContext.memory._availableBackgrounds = [];
          agentContext.memory._currentBackground = chatMeta.background ?? null;
          if (backgroundGenerationEnabled) {
            agentContext.memory._backgroundGenerationEnabled = true;
          }
          if (backgroundGenerationEnabled) {
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
              countUpcomingAssistantMessage: createsAssistantMessage,
            })
          ) {
            resolvedAgents.splice(resolvedAgents.indexOf(ceaAgent), 1);
          }
        }

        // About Me Keeper runs on its own cadence (default every 8 assistant messages).
        if (resolvedAgents.some((a) => a.type === "about-me-keeper")) {
          const amkAgent = resolvedAgents.find((a) => a.type === "about-me-keeper")!;
          if (
            await shouldSkipAgentByAssistantInterval({
              agentsStore,
              chatId: input.chatId,
              agentType: "about-me-keeper",
              settings: amkAgent.settings,
              fallbackInterval: (getDefaultBuiltInAgentSettings("about-me-keeper").runInterval as number) ?? 8,
              messages: allChatMessages,
              countUpcomingAssistantMessage: createsAssistantMessage,
            })
          ) {
            resolvedAgents.splice(resolvedAgents.indexOf(amkAgent), 1);
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
          const existingEntries =
            isBuiltInLorebookAgent && Array.isArray(agentContext.memory._existingLorebookEntries)
              ? (agentContext.memory._existingLorebookEntries as Array<{
                  name?: string | null;
                  content?: string | null;
                }>)
              : undefined;
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
                existingEntries,
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
        const deferredParallelAgentEvents: Array<{ result: AgentResult; options?: { finalized?: boolean } }> = [];
        let deferParallelAgentEvents = false;
        let parallelAgentStartPending = false;
        const sendAgentEventAfterMainStream = (result: AgentResult, options?: { finalized?: boolean }) => {
          if (deferParallelAgentEvents) {
            deferredParallelAgentEvents.push({ result, options });
            return;
          }
          sendAgentEvent(result, options);
        };
        const flushDeferredParallelAgentEvents = () => {
          if (parallelAgentStartPending) {
            trySendSseEvent(reply, { type: "agent_start", data: { phase: "parallel" } });
            parallelAgentStartPending = false;
          }
          if (deferredParallelAgentEvents.length === 0) return;
          const events = deferredParallelAgentEvents.splice(0);
          for (const event of events) {
            sendAgentEvent(event.result, event.options);
          }
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
        const holdForTextRewrite = shouldHoldForTextRewrite(textRewriteAgents);
        const textRewriteAgentIds = new Set(textRewriteAgents.map((a) => a.id));
        const lorebookKeeperAgent = resolvedAgents.find((a) => a.type === "lorebook-keeper") ?? null;
        let pipelineAgents = resolvedAgents.filter(
          (a) => !textRewriteAgentIds.has(a.id) && a.type !== "lorebook-keeper",
        );

        // Manual tracker agents are stripped from the automatic pipeline — the
        // user will trigger them manually via retry-agents.
        const manualTrackers = chatMeta.manualTrackers === true;
        const manualTrackerAgentTypes = normalizeManualTrackerAgentTypes(chatMeta.manualTrackerAgentTypes);
        if (manualTrackers || Object.keys(manualTrackerAgentTypes).length > 0) {
          const trackerIds = new Set(BUILT_IN_AGENTS.filter((a) => a.category === "tracker").map((a) => a.id));
          pipelineAgents = pipelineAgents.filter(
            (a) => !trackerIds.has(a.type) || (!manualTrackers && manualTrackerAgentTypes[a.type] !== true),
          );
        }

        // Echo Chamber should only fire on fresh user messages, not swipes/regenerates/continues.
        if (input.regenerateMessageId || input.continueMessageId) {
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
          requestBody: input as Record<string, unknown>,
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
        const pipeline = createAgentPipeline(pipelineAgents, agentContext, sendAgentEventAfterMainStream);
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

        // Helper: wrap a separate-injection agent's text as protected prompt
        // context. Used by both knowledge-retrieval and knowledge-router on both
        // fresh generations AND regen-cache replays so the two paths stay aligned.
        const appendSeparateAgentInjection = (agentType: string, text: string): void => {
          appendSeparateAgentInjectionMessage(finalMessages, agentType, text, wrapFormat);
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
              const criticalFailedRegen = regenPreGenResults.filter((r) => !r.success && r.type === "secret_plot");
              const nonCriticalFailedRegen = regenPreGenResults.filter((r) => !r.success && r.type !== "secret_plot");
              if (criticalFailedRegen.length > 0) {
                const failedNames = criticalFailedRegen.map((r) => r.agentType).join(", ");
                const firstError = criticalFailedRegen[0]!.error ?? "unknown error";
                logger.error(
                  `[pre-gen] FATAL: critical agent(s) failed on regen (${failedNames}) — aborting generation`,
                );
                sendSseEvent(reply, {
                  type: "error",
                  data: `Critical pre-generation agent failed (${failedNames}): ${firstError}. Please try again.`,
                });
                return;
              }
              if (nonCriticalFailedRegen.length > 0) {
                const failedNames = nonCriticalFailedRegen.map((r) => r.agentType).join(", ");
                logger.warn(`[pre-gen] Non-critical agent(s) failed on regen (${failedNames}) — continuing generation`);
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
            personaDescription: resolvePromptMacros(personaDescription),
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
        let continuedMessageRewriteSource: string | null = null;
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
            if (!holdForTextRewrite) {
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

        const getExplicitlyMentionedCharacterIds = (): string[] => {
          const latestUserText =
            typeof input.userMessage === "string" && input.userMessage.trim()
              ? input.userMessage
              : String([...chatMessages].reverse().find((message: any) => message.role === "user")?.content ?? "");
          const requestedNames = new Set(
            (input.mentionedCharacterNames ?? []).map((name: string) => normalizeTextForMatch(name)),
          );

          return availableGroupCharacters
            .filter((character) => {
              const names = [
                character.name,
                conversationCharacterPresenceById.get(character.id)?.displayName,
              ].filter((name): name is string => typeof name === "string" && name.trim().length > 0);
              if (names.some((name) => requestedNames.has(normalizeTextForMatch(name)))) return true;
              return names.some((name) => {
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(`@${escaped}(?=$|[\\s\\p{P}\\p{S}])`, "iu").test(latestUserText);
              });
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
          const validIds = new Set(availableGroupCharacters.map((character) => character.id));
          const namesByLower = new Map(
            availableGroupCharacters.flatMap((character) => {
              const displayName = conversationCharacterPresenceById.get(character.id)?.displayName;
              return [character.name, displayName]
                .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
                .map((name) => [normalizeTextForMatch(name), character.id] as const);
            }),
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

          const candidates = formatSmartGroupCandidates(
            availableGroupCharacters.map((character) => {
              const presence = conversationCharacterPresenceById.get(character.id);
              return {
                id: character.id,
                name: presence?.displayName ?? character.name,
                talkativeness: presence?.talkativeness ?? Math.round(character.talkativeness * 100),
                status: presence?.status,
                activity: presence?.activity,
                personality: character.personality?.slice(0, 500),
                description: character.description?.slice(0, 500),
              };
            }),
            chatMode === "conversation",
          );

          const selectorInstructions =
            chatMode === "conversation"
              ? [
                  `You are a hidden response orchestrator for a Conversation-mode group chat.`,
                  `Choose one or more available characters to respond next, based on the latest message, recent conversation, relevance, personality, current schedule status, activity, talkativeness, and who has spoken recently.`,
                  `Select every character who has a natural immediate reason to respond. One or several responders are equally valid.`,
                  `In a larger group, do not default to one responder merely because the group is large; include multiple characters when several are directly involved or independently motivated, without forcing uninvolved characters to speak.`,
                  `Prefer an online character over an idle or do-not-disturb character unless the conversation clearly calls for someone else.`,
                  `Do not always choose the first character. Avoid making the same character speak twice in a row unless the context clearly calls for it.`,
                ]
              : [
                  `You are a hidden response orchestrator for a roleplay group chat.`,
                  `Choose which character or characters should respond next, based on the latest user message, recent scene context, relevance, personality, and who has spoken recently.`,
                  `Usually choose exactly one character. Choose multiple only when multiple characters have a strong immediate reason to answer.`,
                  `Do not always choose the first character. Avoid making the same character speak twice in a row unless the context clearly calls for it.`,
                ];

          const selectionPrompt: ChatMessage[] = [
            {
              role: "system",
              content: [
                ...selectorInstructions,
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

            const result = await withLlmRequestTimeout(chatGenerationTimeoutMs, () =>
              selectorProvider.chatComplete(selectionPrompt, {
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
              }),
            );
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
            logger.warn({ err: error, chatId: input.chatId }, "[group-smart] Selector failed; using fallback");
          }

          return [];
        };

        const selectFallbackSmartGroupResponder = (): string[] => {
          const lastAssistantCharacterId = [...chatMessages]
            .reverse()
            .find((message: any) => message.role === "assistant" && typeof message.characterId === "string")
            ?.characterId as string | undefined;
          const fallback =
            availableGroupCharacters.find((character) => character.id !== lastAssistantCharacterId)?.id ??
            availableGroupCharacters[0]?.id ??
            null;
          return fallback ? [fallback] : [];
        };

        // ── Determine characters to generate for ──
        // Individual group mode: each character responds separately
        // Merged/single: one generation for the first (or mentioned) character
        const usesIndividualGroupGeneration = groupChatMode === "individual";
        const useIndividualLoop =
          isGroupChat && usesIndividualGroupGeneration && !input.regenerateMessageId && !input.impersonate;
        const regenGroupChatIndividual = isGroupChat && usesIndividualGroupGeneration && input.regenerateMessageId;
        const explicitlyMentionedConversationCharacterIds =
          chatMode === "conversation" && isGroupChat && !input.impersonate ? getExplicitlyMentionedCharacterIds() : [];
        const mentionedConversationCharacters = charInfo.filter((character) =>
          explicitlyMentionedConversationCharacterIds.includes(character.id),
        );

        const hasExplicitGenerationDirective = input.impersonate === true || Boolean(input.generationGuide?.trim());
        const selectExplicitOrFallbackSmartGroupResponder = (): string[] => {
          const explicitMentionIds = getExplicitlyMentionedCharacterIds();
          return explicitMentionIds.length > 0 ? explicitMentionIds : selectFallbackSmartGroupResponder();
        };
        const needsSmartResponseQueue =
          useIndividualLoop &&
          groupResponseOrder === "smart" &&
          !input.forCharacterId &&
          !hasExplicitGenerationDirective;
        let smartResponseQueue =
          useIndividualLoop && groupResponseOrder === "smart" && !input.forCharacterId
            ? hasExplicitGenerationDirective
              ? selectExplicitOrFallbackSmartGroupResponder()
              : await selectSmartGroupResponders()
            : null;

        if (needsSmartResponseQueue && (!smartResponseQueue || smartResponseQueue.length === 0)) {
          smartResponseQueue = selectFallbackSmartGroupResponder();
          if (smartResponseQueue.length > 0) {
            logger.warn(
              "[group-smart] Falling back to %s for chat %s after selector produced no queue",
              charInfo.find((character) => character.id === smartResponseQueue?.[0])?.name ?? smartResponseQueue[0],
              input.chatId,
            );
          }
        }

        if (smartResponseQueue && smartResponseQueue.length > 0) {
          sendSseEvent(reply, {
            type: "response_queue",
            data: {
              characterIds: smartResponseQueue,
              characters: smartResponseQueue.map((id, index) => ({
                id,
                name: groupResponderName(id),
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

        // Turn-game board awareness is injected per responding character inside
        // generateForCharacter (seat-aware: a seated character sees their own
        // hand / color / last move; everyone else gets the spectator view).
        // The game itself is loaded ONCE here — the builder closes over the
        // loaded state so each character only pays for its own summary text.
        const turnGameContextForSeat =
          chatMode === "conversation" ? await getTurnGameContextBuilder(app.db, input.chatId) : null;

        // Manual mode with forCharacterId: only generate for the specified character.
        // Sequential: all available characters respond. Smart: generate the selected queue in order.
        const respondingCharIds = useIndividualLoop
          ? input.forCharacterId && characterIds.includes(input.forCharacterId)
            ? [input.forCharacterId]
            : explicitlyMentionedConversationCharacterIds.length > 0
              ? explicitlyMentionedConversationCharacterIds
              : groupResponseOrder === "manual"
                ? [] // manual mode without forCharacterId or a mention: no auto-generation
                : groupResponseOrder === "sequential"
                  ? availableGroupCharacters.map((character) => character.id)
                  : smartResponseQueue?.length
                    ? [...smartResponseQueue]
                    : []
          : [characterIds[0] ?? null];

        if (deferConversationLorebookScanToResponder && respondingCharIds.length > 0) {
          await scanConversationLorebooks(
            respondingCharIds.filter((characterId): characterId is string => typeof characterId === "string"),
            { recordSnapshot: false },
          );
        }

        const prepareConversationLorebookForResponder = async (
          targetCharId: string | null,
          messages: GenerationPromptMessage[],
        ): Promise<GenerationPromptMessage[]> => {
          if (!deferConversationLorebookScanToResponder || !targetCharId) return messages;

          const lorebookResult = await scanConversationLorebooks([targetCharId], { previewOnly: true });

          const loreContent = [lorebookResult.worldInfoBefore, lorebookResult.worldInfoAfter]
            .filter(Boolean)
            .join("\n");
          const loreBlock = loreContent ? wrapContent(loreContent, "Lore", wrapFormat) : "";
          let prepared = messages.map((message) => ({
            ...message,
            content: message.content.split(INDIVIDUAL_CONVERSATION_LOREBOOK_TOKEN).join(loreBlock),
          }));

          if (loreBlock && !conversationContextMacroSlots.lorebook) {
            const firstUserIdx = prepared.findIndex(
              (message) => message.role === "user" || message.role === "assistant",
            );
            prepared.splice(firstUserIdx >= 0 ? firstUserIdx : prepared.length, 0, {
              role: "system" as const,
              content: loreBlock,
            });
          }
          if (lorebookResult.depthEntries.length > 0) {
            prepared = injectAtDepth(prepared, lorebookResult.depthEntries);
          }

          decodeDeferredRelocationConditionals(
            prepared,
            buildConversationRelocationValues(loreBlock),
            promptMacroContext,
          );
          return prepared;
        };

        /** Generate a single response for a given character and save it. */
        const generateForCharacter = async (
          targetCharId: string | null,
          messagesForGen: GenerationPromptMessage[],
          markGenerationCommitted = false,
          speaksOnlyTargetCharacter = true,
        ): Promise<{
          savedMsg: Awaited<ReturnType<typeof chats.createMessage>>;
          response: string;
          commands: CharacterCommand[];
          commandCharacterIds: (string | null)[] | null;
          oocMessages: string[];
          characterId: string | null;
        } | null> => {
          const targetCharacterProfile = targetCharId ? characterMacroProfilesById.get(targetCharId) : undefined;
          const deferredTargetCharacterProfile = deferCharacterMacros ? targetCharacterProfile : undefined;
          // Turn-game board awareness: when a table game is active in this chat,
          // give THIS responder the current board — from their own seat when they
          // are playing (own hand / color / last move), spectator view otherwise.
          // Injected per character so one player's private hand can never leak
          // into another responder's prompt; impersonation gets the human seat,
          // and a merged generation that may voice several characters at once
          // stays on the hand-free spectator view.
          let gameAwareMessagesForGen = await prepareConversationLorebookForResponder(targetCharId, messagesForGen);
          if (turnGameContextForSeat) {
            const viewerSeatId = input.impersonate
              ? chat.personaId || "human"
              : speaksOnlyTargetCharacter
                ? targetCharId
                : null;
            const turnGameContext = turnGameContextForSeat(viewerSeatId);
            if (turnGameContext) {
              gameAwareMessagesForGen = injectAtDepth(gameAwareMessagesForGen, [
                { content: turnGameContext, role: "system", depth: 0 },
              ]);
            }
          }
          const audienceCharacterIds = input.impersonate
            ? []
            : speaksOnlyTargetCharacter
              ? targetCharId
                ? [targetCharId]
                : []
              : characterIds;
          gameAwareMessagesForGen = filterPromptMessagesForCharacterAudience(
            gameAwareMessagesForGen,
            audienceCharacterIds,
          );
          if (
            usesIndividualGroupGeneration &&
            deferCharacterMacros &&
            promptCharacterIds.length > 1 &&
            targetCharId &&
            lorebookPromptScanResult
          ) {
            let scopedScanPromise = scopedLorebookScansByCharacterId.get(targetCharId);
            if (!scopedScanPromise) {
              scopedScanPromise = scopeLorebookScanResultToCharacter(
                app.db,
                lorebookPromptScanResult,
                targetCharId,
                lorebookGenerationTriggers,
              );
              scopedLorebookScansByCharacterId.set(targetCharId, scopedScanPromise);
            }
            const scopedLorebookScan = await scopedScanPromise;
            gameAwareMessagesForGen = scopeLorebookPromptMessagesForCharacter(
              gameAwareMessagesForGen,
              lorebookPromptScanResult,
              scopedLorebookScan,
            );
          }
          const targetContextBlock = targetCharId
            ? conversationContextBlocksByCharacterId.get(targetCharId)
            : undefined;
          if (isGroupChat && usesIndividualGroupGeneration && targetContextBlock && conversationContextBlockValue) {
            gameAwareMessagesForGen = gameAwareMessagesForGen.map((message) => ({
              ...message,
              content: replaceConversationContextBlockForTarget(
                message.content,
                conversationContextBlockValue,
                targetContextBlock,
              ),
            }));
          }
          const scopedMessagesForGen =
            isGroupChat && usesIndividualGroupGeneration && targetCharId
              ? scopeIndividualGroupMessagesForTarget(gameAwareMessagesForGen, targetCharId, charInfo)
              : gameAwareMessagesForGen;
          const targetScopedMessagesForGen =
            !promptTargetCharacterId && targetCharId
              ? scopedMessagesForGen.map((message) => ({ ...message }))
              : scopedMessagesForGen;
          if (!promptTargetCharacterId && targetCharId) {
            applyRegexScriptsToPromptMessages(targetScopedMessagesForGen, await getPromptRegexScripts(), {
              resolveMacros: (value, randomSeed) =>
                resolveMacros(value, promptMacroContext, { trimResult: false, randomSeed }),
              targetCharacterId: targetCharId,
              targetedOnly: true,
            });
          }
          const spatiallyScopedMessagesForGen = injectOwnerSpatialPrompt(
            targetScopedMessagesForGen,
            ownerSpatialProjection,
          );
          const macroScopedMessagesForGen = spatiallyScopedMessagesForGen.map((message) => ({
            ...message,
            content: (deferredTargetCharacterProfile
              ? resolveDeferredCharacterMacros(message.content, deferredTargetCharacterProfile, promptMacroContext)
              : message.content
            ).replace(/\n([ \t]*\n){2,}/g, "\n\n"),
          }));
          // Resolve again at the provider boundary. History is normally expanded
          // earlier, but guide/system/depth blocks can be appended afterward; a
          // last scoped pass prevents raw identity macros from escaping (#3704).
          const providerMacroContext = targetCharacterProfile
            ? scopePromptMacroContextToCharacter(promptMacroContext, targetCharacterProfile)
            : promptMacroContext;
          const preparedMessagesForGen = resolvePromptMessageMacros(
            macroScopedMessagesForGen,
            providerMacroContext,
            historyMacroProfilesById,
          );
          if (chatMode === "conversation" && conversationIsGroup && !input.impersonate) {
            const turnCharacterName =
              usesIndividualGroupGeneration && groupTurnPromptEnabled && speaksOnlyTargetCharacter && targetCharId
                ? (charInfo.find((character) => character.id === targetCharId)?.name ?? null)
                : null;
            if (!usesIndividualGroupGeneration || turnCharacterName) {
              preparedMessagesForGen.push({
                role: "user",
                content: formatConversationGroupOutputFormat({
                  wrapFormat,
                  characterNames: conversationCharacterNames,
                  userName: personaName,
                  turnCharacterName,
                }),
                contextKind: "injection",
              });
            }
          }
          // Defense in depth: the relocation decode pass should have consumed
          // every token already; strip any that slipped through so no control
          // sentinel reaches the provider (#3448).
          for (const message of preparedMessagesForGen) {
            if (hasDeferredRelocationConditionals(message.content)) {
              logger.error(
                { chatId: input.chatId },
                "[generate] Deferred relocation conditional token remained before provider request",
              );
              message.content = message.content.replace(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE, "");
            }
          }
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
              if (holdForTextRewrite) {
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
                result = await withLlmRequestTimeout(chatGenerationTimeoutMs, () => provider.chatComplete!(loopMessages, {
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
                  anthropicExtendedCacheTtl: conn.anthropicExtendedCacheTtl === "true",
                  cachingAtDepth: conn.cachingAtDepth ?? 5,
                  enableThinking,
                  captureReasoning,
                  reasoningEffort: resolvedEffort ?? undefined,
                  excludePastReasoning,
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
                }));
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
                // The character whose turn this is — update_about_me writes their about-me.
                // Only attribute when this generation voices exactly one character and the
                // user isn't impersonating; otherwise the caller is ambiguous (merged group)
                // and the tool refuses rather than write the wrong character's about-me.
                callingCharacterId:
                  speaksOnlyTargetCharacter && !input.impersonate
                    ? (targetCharId ?? input.forCharacterId ?? null)
                    : null,
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
                        let updates: Record<string, unknown> = {};
                        if (u.type === "location_change") updates.location = u.value;
                        if (u.type === "time_advance") updates.time = u.value;
                        if (u.type === "location_change" && ownerSpatialProjection?.ownerMode === "game") {
                          logger.debug(
                            "[generate/game] Ignored update_game_state location because Spatial Context is authoritative",
                          );
                        }
                        updates = omitAuthoritativeGameLocation(updates, ownerSpatialProjection);
                        if (Object.keys(updates).length > 0) {
                          const lockedUpdates = applyTrackerFieldLocksToGameStatePatch(
                            updates,
                            parseGameStateRow(latest as Record<string, unknown>),
                          );
                          await gameStateStore.updateLatest(input.chatId, lockedUpdates);
                          updates = lockedUpdates;
                          // Send game_state_patch so HUD updates live
                          logger.debug("[game_state_patch] tool update_game_state: %j", updates);
                          reply.raw.write(`data: ${JSON.stringify({ type: "game_state_patch", data: updates })}\n\n`);
                        }
                      }
                    }
                  } catch {
                    // Non-critical
                  }
                }

                // update_about_me public scope: route the proposed edit through the
                // character-card approval modal (the chat scope already persisted itself).
                if (tr.name === "update_about_me" && tr.success) {
                  try {
                    const parsed = JSON.parse(tr.result);
                    const proposal = parsed?.proposedCardUpdate;
                    if (parsed?.scope === "public" && proposal && typeof proposal.characterId === "string") {
                      const newText = typeof proposal.newText === "string" ? proposal.newText : "";
                      let oldText = "";
                      try {
                        const row = await chars.getById(proposal.characterId);
                        const data = row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : null;
                        const ext = (data?.extensions ?? {}) as Record<string, unknown>;
                        if (typeof ext.aboutMe === "string") oldText = ext.aboutMe;
                      } catch {
                        /* non-critical */
                      }
                      if (oldText !== newText) {
                        sendAgentResultEvent({
                          agentId: "about-me-keeper",
                          agentType: "about-me-keeper",
                          type: "character_card_update",
                          data: {
                            updates: [
                              {
                                action: "update",
                                characterId: proposal.characterId,
                                field: "aboutMe",
                                oldText,
                                newText,
                                reason: "Character updated its public about me",
                              },
                            ],
                          },
                          tokensUsed: 0,
                          durationMs: 0,
                          success: true,
                          error: null,
                        });
                      }
                    }
                  } catch {
                    /* non-critical */
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
                const finalResult = await withLlmRequestTimeout(chatGenerationTimeoutMs, () => provider.chatComplete!(loopMessages, {
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
                  anthropicExtendedCacheTtl: conn.anthropicExtendedCacheTtl === "true",
                  cachingAtDepth: conn.cachingAtDepth ?? 5,
                  enableThinking,
                  captureReasoning,
                  reasoningEffort: resolvedEffort ?? undefined,
                  excludePastReasoning,
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
                }));
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
              anthropicExtendedCacheTtl: conn.anthropicExtendedCacheTtl === "true",
              cachingAtDepth: conn.cachingAtDepth ?? 5,
              enableThinking,
              captureReasoning,
              reasoningEffort: resolvedEffort ?? undefined,
              excludePastReasoning,
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
              let result = await withLlmRequestTimeout(chatGenerationTimeoutMs, () => gen.next());
              while (!result.done) {
                if (abortController.signal.aborted) {
                  return null;
                }
                fullResponse += result.value;
                // Break large chunks (e.g. Gemini non-streaming) into small pieces
                // so the client sees progressive streaming.
                const val = result.value;
                if (holdForTextRewrite) {
                  result = await withLlmRequestTimeout(chatGenerationTimeoutMs, () => gen.next());
                  continue;
                }
                await sendTokenTextChunked(val);
                result = await withLlmRequestTimeout(chatGenerationTimeoutMs, () => gen.next());
              }
              // Generator return value contains usage
              if (result.value) {
                usage = result.value;
                finishReason = usage.finishReason ?? finishReason;
              }
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
            if (!holdForTextRewrite) {
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
          // Parallel to parsedCommands: per-command character attribution for merged
          // group conversations (null elsewhere — caller falls back to the message char).
          let parsedCommandCharacterIds: (string | null)[] | null = null;
          let parsedRawCommandCount = 0;
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
            // Merged group conversations carry multiple characters' turns in one
            // response; attribute each command to its speaker so e.g. a [selfie]
            // renders the character that took it, not always the first one.
            const useSpeakerAttribution = isGroupChat && groupChatMode === "merged" && chatMode === "conversation";
            const speakerParse = useSpeakerAttribution
              ? parseCharacterCommandsBySpeaker(fullResponse, charInfo, targetCharId)
              : null;
            const parsed = speakerParse ?? parseCharacterCommands(fullResponse);
            const speakerIdByCommand = speakerParse
              ? new Map(
                  speakerParse.commands.map(
                    (command, index) => [command, speakerParse.commandCharacterIds[index] ?? targetCharId] as const,
                  ),
                )
              : null;
            if (parsed.commands.length > 0) {
              parsedRawCommandCount += parsed.commands.length;
              parsedCommands = filterEnabledConversationCommands(parsed.commands, chatMeta);
              if (parsedCommands.length > 0) {
                conversationCommandContent = responseBeforeCommandParsing.trim();
                if (speakerIdByCommand) {
                  parsedCommandCharacterIds = parsedCommands.map(
                    (command) => speakerIdByCommand.get(command) ?? targetCharId,
                  );
                }
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
              // Recovered (implicit) selfies have no speaker prefix to attribute to;
              // fall back to the generation's character.
              if (parsedCommandCharacterIds) parsedCommandCharacterIds = [...parsedCommandCharacterIds, targetCharId];
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
          if (isGroupChat && usesIndividualGroupGeneration && targetCharId) {
            const charRow = charInfo.find((c) => c.id === targetCharId);
            if (charRow) {
              const cName = charRow.name;
              const escapedName = cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              if (chatMode === "conversation") {
                const beforeTimestampStrip = fullResponse;
                fullResponse = fullResponse
                  .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/g, "")
                  .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/g, "")
                  .trimStart();
                if (fullResponse !== beforeTimestampStrip) contentReplaced = true;
              }
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
              const targetPrefix = new RegExp(`^\\s*${escapedName}\\s*:\\s*`, "i");
              const targetLinePrefix = new RegExp(`^\\s*${escapedName}\\s*\\n+`, "i");
              const stripTargetPrefix = () => {
                fullResponse = fullResponse.replace(targetPrefix, "").replace(targetLinePrefix, "").trimStart();
              };
              const otherNames = charInfo
                .filter((character) => character.id !== targetCharId)
                .map((character) => character.name)
                .filter((name): name is string => Boolean(name))
                .filter((name) => name.trim().toLocaleLowerCase() !== cName.trim().toLocaleLowerCase())
                .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
              const otherSpeakerPrefix =
                otherNames.length > 0 ? new RegExp(`^\\s*(?:${otherNames.join("|")})\\s*:\\s*`, "i") : null;

              stripTargetPrefix();
              let prunePasses = 0;
              while (otherSpeakerPrefix?.test(fullResponse) && prunePasses++ < 6) {
                const embeddedTargetPrefix = new RegExp(`(?:^|\\n\\s*\\n)\\s*${escapedName}\\s*:\\s*`, "i");
                const targetMatch = fullResponse.match(embeddedTargetPrefix);
                if (targetMatch?.index != null && targetMatch.index > 0) {
                  fullResponse = fullResponse.slice(targetMatch.index).trimStart();
                  stripTargetPrefix();
                  continue;
                }
                const paragraphBreak = fullResponse.search(/\n(?:\s*\n)?/);
                if (paragraphBreak < 0) {
                  logger.warn(
                    {
                      chatId: input.chatId,
                      targetCharId,
                      targetName: cName,
                      responsePreview: fullResponse.slice(0, 240),
                    },
                    "[generate] Dropping wrong-speaker-only individual group response",
                  );
                  sendSseEvent(reply, { type: "content_replace", data: "" });
                  return null;
                }
                fullResponse = fullResponse.slice(paragraphBreak).trimStart();
                stripTargetPrefix();
              }
              if (chatMode === "conversation" && otherNames.length > 0) {
                const nextSpeakerPrefix = new RegExp(`\\n\\s*(?:${otherNames.join("|")})\\s*:\\s*`, "i");
                const nextSpeakerMatch = fullResponse.match(nextSpeakerPrefix);
                if (nextSpeakerMatch?.index != null) {
                  fullResponse = fullResponse.slice(0, nextSpeakerMatch.index).trimEnd();
                }
              }
              if (fullResponse !== beforeNamePrefixStrip) {
                contentReplaced = true;
              }
            }
          }

          // ── Strip leaked timestamps/speaker envelopes from Conversation responses ──
          // Models sometimes echo prompt-only metadata such as
          // `[11.07 15:53] Character: Hello!`. Keep merged group speaker
          // boundaries, but store single/individual replies as content only.
          if (chatMode === "conversation" && !input.impersonate) {
            const beforeStrip = fullResponse;
            const conversationSpeakerName = targetCharId
              ? (charInfo.find((character) => character.id === targetCharId)?.name ?? null)
              : null;
            fullResponse = stripConversationResponseEnvelope(fullResponse, {
              speakerName: conversationSpeakerName,
              speakerNames: charInfo.map((character) => character.name),
              preserveSpeakerPrefix: isGroupChat && !usesIndividualGroupGeneration,
            });
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
            if (!holdForTextRewrite) {
              reply.raw.write(`data: ${JSON.stringify({ type: "content_replace", data: fullResponse })}\n\n`);
            }
          }

          // Guard: don't save empty responses — the model returned nothing useful.
          // Exception: if the model emitted character commands (e.g. [fetch:...]) with
          // no surrounding prose, treat the commands as the useful output. Skip saving
          // a blank assistant bubble but still return the commands so they execute.
          if (!fullResponse.trim()) {
            logger.warn(
              {
                chatId: input.chatId,
                targetCharId,
                parsedCommandCount: parsedCommands.length,
                parsedRawCommandCount,
                providerThinkingLength: providerThinking.length,
                fullThinkingLength: fullThinking.length,
                contentReplaced,
                chatMode,
                groupChatMode,
              },
              "[generate] Empty response after post-processing",
            );
            if (!input.impersonate && (parsedCommands.length > 0 || parsedRawCommandCount > 0)) {
              logger.info(
                "[generate] Model emitted %d enabled command(s) (%d parsed) with no visible prose for chat %s; saving hidden command anchor",
                parsedCommands.length,
                parsedRawCommandCount,
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
              if (
                anchoredMsg?.id &&
                hierarchicalMapsEnabledForChat &&
                (requestChatMode === "roleplay" || requestChatMode === "game")
              ) {
                await materializeAssistantSpatialState(
                  {
                    chatId: input.chatId,
                    messageId: anchoredMsg.id,
                    swipeIndex: anchoredMsg.activeSwipeIndex ?? 0,
                    regenerate: false,
                    continuation: false,
                  },
                  chatMeta,
                );
              }
              if (markGenerationCommitted && anchoredMsg?.id) {
                generationComplete = true;
              }
              if (chatMode === "conversation" && !input.regenerateMessageId) {
                recordAssistantActivity(input.chatId, input.autonomous ? (targetCharId ?? undefined) : undefined);
                conversationAssistantSaved = true;
              }
              await recordSavedAutonomousGeneration(targetCharId);
              return {
                savedMsg: anchoredMsg,
                response: "",
                commands: parsedCommands,
                commandCharacterIds: parsedCommandCharacterIds,
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
          let savedSwipeIndex: number | null = null;
          if (input.regenerateMessageId) {
            const createdSwipe = await chats.addSwipe(input.regenerateMessageId, fullResponse);
            savedSwipeIndex = createdSwipe.index;
            savedMsg = await chats.getMessage(input.regenerateMessageId);
          } else if (input.continueMessageId) {
            const targetMessage = (await chats.getMessage(input.continueMessageId)) ?? continueTargetMessage;
            continuedMessageRewriteSource = appendContinuationMessageContent(targetMessage?.content, fullResponse);
            savedMsg = await chats.updateMessageContent(input.continueMessageId, continuedMessageRewriteSource);
            savedSwipeIndex =
              typeof savedMsg?.activeSwipeIndex === "number" && Number.isInteger(savedMsg.activeSwipeIndex)
                ? savedMsg.activeSwipeIndex
                : 0;
          } else {
            savedMsg = await chats.createMessage({
              chatId: input.chatId,
              role: input.impersonate ? "user" : "assistant",
              characterId: input.impersonate ? null : targetCharId,
              content: fullResponse,
            });
            savedSwipeIndex = 0;
          }
          if (
            savedMsg?.id &&
            savedSwipeIndex !== null &&
            !input.impersonate &&
            hierarchicalMapsEnabledForChat &&
            (requestChatMode === "roleplay" || requestChatMode === "game")
          ) {
            await materializeAssistantSpatialState(
              {
                chatId: input.chatId,
                messageId: savedMsg.id,
                swipeIndex: savedSwipeIndex,
                regenerate: Boolean(input.regenerateMessageId),
                continuation: Boolean(input.continueMessageId),
              },
              chatMeta,
            );
          }
          if (markGenerationCommitted && savedMsg?.id) {
            generationComplete = true;
          }
          if (chatMode === "conversation" && !input.impersonate && !input.regenerateMessageId) {
            recordAssistantActivity(input.chatId, input.autonomous ? (targetCharId ?? undefined) : undefined);
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
            else extraUpdate.geminiParts = null;
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
            extraUpdate.startsNewAssistantBubble = startsNewAssistantBubble;
            // Cache the final prompt (what was actually sent to the model) for Peek Prompt
            extraUpdate.cachedPrompt = finalPromptSent.map((m) => ({ role: m.role, content: m.content }));
            // Cache the lorebook scan that produced the prompt so Active Context
            // reflects the last generation instead of a best-effort rescan.
            extraUpdate.lorebookScan = lorebookScanSnapshot;
            extraUpdate.chatSummaryFingerprint = fingerprintChatSummary(chatMeta.summary);
            const persistentAttachments = resolveUserRegenerationPersistentAttachments(regenMsg ?? {});
            if (persistentAttachments) extraUpdate.attachments = persistentAttachments;
            const refreshedMsg =
              savedSwipeIndex !== null
                ? await chats.updateMessageExtraForSwipe(savedMsg.id, savedSwipeIndex, extraUpdate)
                : await chats.updateMessageExtra(savedMsg.id, extraUpdate);

            const savedMessagePayload =
              holdForTextRewrite && !input.impersonate
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
                    if (latestLocation && persistedMsg?.id && ownerSpatialProjection?.ownerMode !== "game") {
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

            // Evict cachedPrompt from older messages to save storage (keep last 2 assistant msgs).
            // Reuse the already-fetched message objects (they carry `extra`) rather than a
            // per-id chats.getMessage — the latter is a full table scan each in the file-native
            // store, which made this loop O(n^2) in total chat size (#3402). Only messages that
            // still hold a cachedPrompt need the (bounded) update + swipe cleanup.
            const allMsgs = await chats.listMessages(input.chatId);
            const staleAssistants = allMsgs.filter((m) => m.role === "assistant").slice(0, -2);
            for (const staleMsg of staleAssistants) {
              const staleExtra =
                typeof staleMsg.extra === "string" ? JSON.parse(staleMsg.extra) : (staleMsg.extra ?? {});
              if (!staleExtra.cachedPrompt) continue;
              await chats.updateMessageExtra(staleMsg.id, { cachedPrompt: null });
              // Also clean swipes
              const swipes = await chats.getSwipes(staleMsg.id);
              for (const sw of swipes) {
                const swExtra = typeof sw.extra === "string" ? JSON.parse(sw.extra) : (sw.extra ?? {});
                if (swExtra.cachedPrompt) {
                  await chats.updateSwipeExtra(staleMsg.id, sw.index, { cachedPrompt: null });
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
            commandCharacterIds: parsedCommandCharacterIds,
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
          deferParallelAgentEvents = true;
          parallelAgentStartPending = true;
          parallelPromise = pipeline.runParallel();
        }

        // ── Run generation ──
        // (firstSavedMsg/lastSavedMsg/collectedCommands/collectedOocMessages
        // are declared above the follow-up loop so they survive iterations.)

        const generationGuideInstruction = buildGenerationGuideInstruction(input.generationGuide, promptMacroContext);
        const buildRoleplayCharacterInstruction = (charName: string) =>
          groupTurnPromptEnabled && chatMode === "roleplay" ? `Respond ONLY as ${charName}.` : null;

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

            // Conversation puts its short turn instruction in Output Format.
            // Keep the established Roleplay instruction placement unchanged.
            const charInstruction = buildRoleplayCharacterInstruction(charName);
            const messagesWithInstruction = [...runningMessages];
            // Add as a system message at the end (just before any trailing user message)
            if (charInstruction) {
              messagesWithInstruction.push({ role: "system", content: charInstruction });
            }

            const genResult = await generateForCharacter(
              charId,
              messagesWithInstruction,
              ci === respondingCharIds.length - 1,
            );
            if (!genResult) {
              if (abortController.signal.aborted) break;
              continue;
            }
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
            const inTurnMessage = {
              role: "assistant",
              content: genResult.response,
              contextKind: "history",
              characterId: charId,
            } as const;
            if (shouldPrefixGroupHistorySpeakers) {
              const characterNamesById = await getGroupHistoryCharacterNamesById();
              const [prefixed] = prefixGroupIndividualHistorySpeakers([inTurnMessage], {
                personaName,
                characterNamesById,
              });
              runningMessages.push(prefixed ?? inTurnMessage);
            } else {
              runningMessages.push(inTurnMessage);
            }
          }
        } else {
          // Single/merged: one generation
          sendProgress("generating");
          let targetCharId =
            typeof input.forCharacterId === "string" && characterIds.includes(input.forCharacterId)
              ? input.forCharacterId
              : (characterIds[0] ?? null);
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

            // Conversation puts its short turn instruction in Output Format.
            targetCharId = regenMsg?.characterId ?? null;
            const targetCharName = charInfo.find((c) => c.id === targetCharId)?.name ?? "Character";
            const charInstruction = buildRoleplayCharacterInstruction(targetCharName);
            if (charInstruction) {
              sentMessages.push({ role: "system", content: charInstruction });
            }
          }

          // A merged group generation may voice several characters unless a regen
          // target or a single explicit @mention pins it to exactly one speaker.
          const mergedSpeaksOnlyTarget =
            !isGroupChat || Boolean(regenGroupChatIndividual) || mentionedConversationCharacters.length === 1;
          const genResult = await generateForCharacter(targetCharId, sentMessages, true, mergedSpeaksOnlyTarget);
          if (genResult) {
            firstSavedMsg ??= genResult.savedMsg;
            lastSavedMsg = genResult.savedMsg;
            recordExpressionTarget(genResult.savedMsg, genResult.characterId);
            for (let cmdIndex = 0; cmdIndex < genResult.commands.length; cmdIndex++) {
              collectedCommands.push({
                command: genResult.commands[cmdIndex]!,
                // Merged group responses attribute each command to its speaker; fall
                // back to the generation's character when no attribution is available.
                characterId: genResult.commandCharacterIds?.[cmdIndex] ?? genResult.characterId,
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
        deferParallelAgentEvents = false;
        flushDeferredParallelAgentEvents();
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
          const messagesSinceLastSummary = countUserMessagesAfterSummaryAnchor(
            freshMessages,
            lastAutomaticSummaryMessageId,
          );
          const interval = clampRoleplaySummaryInterval(chatMeta.summaryRunInterval);
          if (messagesSinceLastSummary < interval) return;

          const contextSize = clampRoleplaySummaryContextSize(chatMeta.summaryContextSize);
          const summaryMaxTokens = clampRoleplaySummaryMaxTokens(chatMeta.summaryMaxTokens);
          const selectedMessages = selectRollingSummaryMessages({
            messages: freshMessages,
            contextSize,
            summaryEntries: chatMeta.summaryEntries as ChatSummaryEntry[] | undefined,
          });
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

          const chatLog = formatRoleplaySummaryChatLog(selectedMessages);
          const previousSummary = typeof chatMeta.summary === "string" ? chatMeta.summary.trim() : "";
          const globalSummaryPromptSettings = await appSettings.get(CHAT_SUMMARY_PROMPT_SETTINGS_KEY);
          const result = await summaryProvider.chatComplete(
            [
              {
                role: "system",
                content: resolveChatSummaryPrompt({
                  chatMetadata: chatMeta,
                  globalSettingsValue: globalSummaryPromptSettings,
                }),
              },
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
              maxTokens: summaryMaxTokens,
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
          const siblingSwipeSnapshot = projectGameSnapshotLocation(
            input.regenerateMessageId && messageId && targetSwipeIndex > 0
              ? await gameStateStore.getByMessage(messageId, targetSwipeIndex - 1)
              : null,
            ownerSpatialProjection,
          );
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
              const canGenerateBackground =
                currentBackgroundAgent?.settings?.autoGenerateBackgrounds === true &&
                chatMeta.gameStoryboardViewerDisplayMode !== "background";
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
                      const imageFallback = await resolveImageConnectionFallback(connections, imgConnFull.id);
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
                        artStyle: resolveGameSetupArtStylePrompt(setupConfigForImage) || undefined,
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
                        imgFallback: imageFallback,
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
                    await chats.updateMessageExtraForSwipe(messageId, targetSwipeIndex, { spriteExpressions: exprMap });
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
                  await chats.updateMessageExtraForSwipe(messageId, targetSwipeIndex, {
                    cyoaChoices: cyoaData.choices,
                  });
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
                const authoritativeGameLocation =
                  ownerSpatialProjection?.ownerMode === "game"
                    ? formatOwnerSpatialBreadcrumb(ownerSpatialProjection)
                    : null;
                let newLocation =
                  authoritativeGameLocation ??
                  coerceGameStateTextValue(gs.location) ??
                  coerceGameStateTextValue(prevSnap?.location);
                let newWeather = coerceGameStateTextValue(gs.weather) ?? coerceGameStateTextValue(prevSnap?.weather);
                let newTemperature =
                  coerceGameStateTextValue(gs.temperature) ?? coerceGameStateTextValue(prevSnap?.temperature);

                // The world-state agent produces date/time/location/weather/temperature,
                // user-defined world fields, and optionally recentEvents. In batch mode the model often cross-
                // contaminates the world-state result with fields from other agent task
                // schemas (presentCharacters, personaStats, playerStats).  Even a partial
                // cross-contaminated playerStats (e.g. { status: "...", activeQuests: [] })
                // would clobber the real data and break downstream handlers (quest, persona-
                // stats) that read from this snapshot.  Therefore we ALWAYS carry forward
                // these fields from the previous snapshot — the dedicated tracker agents
                // (character-tracker, persona-stats, quest, custom-tracker) will update
                // them with authoritative data in their own handler blocks below.
                const snapshotChars = parseJsonField<any[]>(prevSnap?.presentCharacters, []);
                const snapshotWorldCustomFields = normalizeWorldCustomFields(
                  parseJsonField<unknown[]>(prevSnap?.worldCustomFields, []),
                );
                const snapshotPersonaStats = parseJsonField<any[] | null>(prevSnap?.personaStats, null);
                const snapshotPlayerStats = parseJsonField<PlayerStats | null>(prevSnap?.playerStats, null);
                const currentGameStateForLocks = prevSnap
                  ? parseGameStateRow(prevSnap as Record<string, unknown>)
                  : null;
                const nextWorldCustomFields =
                  gs.worldCustomFields !== undefined
                    ? normalizeWorldCustomFields(gs.worldCustomFields)
                    : snapshotWorldCustomFields;
                const lockedWorldStatePatch = applyTrackerFieldLocksToGameStatePatch(
                  {
                    date: newDate,
                    time: newTime,
                    location: newLocation,
                    weather: newWeather,
                    temperature: newTemperature,
                    worldCustomFields: nextWorldCustomFields,
                  },
                  currentGameStateForLocks,
                );
                newDate = coerceGameStateTextValue(lockedWorldStatePatch.date);
                newTime = coerceGameStateTextValue(lockedWorldStatePatch.time);
                newLocation = authoritativeGameLocation ?? coerceGameStateTextValue(lockedWorldStatePatch.location);
                newWeather = coerceGameStateTextValue(lockedWorldStatePatch.weather);
                newTemperature = coerceGameStateTextValue(lockedWorldStatePatch.temperature);
                const newWorldCustomFields = normalizeWorldCustomFields(lockedWorldStatePatch.worldCustomFields);
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
                    worldCustomFields: newWorldCustomFields,
                    presentCharacters: snapshotChars,
                    recentEvents: (gs.recentEvents as string[]) ?? [],
                    playerStats: snapshotPlayerStats,
                    personaStats: snapshotPersonaStats,
                    fieldLocks: normalizeTrackerFieldLocksForState(
                      currentGameStateForLocks?.fieldLocks,
                      currentGameStateForLocks,
                    ),
                    hiddenTrackerFields: currentGameStateForLocks?.hiddenTrackerFields,
                  },
                  null, // manual overrides are one-shot — never carry forward
                );
                // Send game state to client so HUD updates live
                // ONLY send the fields world-state actually produces.
                // Do NOT spread the whole `gs` — in batch mode the model may cross-contaminate
                // fields like presentCharacters:[] from other agent tasks, clobbering the HUD.
                const worldStatePatch = {
                  date: newDate,
                  time: newTime,
                  location: newLocation,
                  weather: newWeather,
                  temperature: newTemperature,
                  ...(gs.worldCustomFields !== undefined ? { worldCustomFields: newWorldCustomFields } : {}),
                };
                logger.debug("[game_state_patch] world-state: %j", worldStatePatch);
                reply.raw.write(`data: ${JSON.stringify({ type: "game_state_patch", data: worldStatePatch })}\n\n`);

                const existingGameMap = (chatMeta.gameMap as GameMap | null) ?? null;
                const syncedMeta =
                  ownerSpatialProjection?.ownerMode === "game"
                    ? chatMeta
                    : syncGameMapMetaPartyPosition(chatMeta, newLocation);
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
                preserveTrackerCharacterUiFields(chars, characterTrackerHistory);
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
                const cardCharacterIds = applyTrackerCharacterCardIdentity(chars, charInfo);
                const gameNpcs = sanitizeGameNpcAvatarUrls((chatMeta.gameNpcs as GameNpc[]) ?? []);
                if (gameNpcs !== chatMeta.gameNpcs) {
                  chatMeta.gameNpcs = gameNpcs;
                }
                for (const npc of gameNpcs) {
                  const name = normalizeTextForMatch(npc.name);
                  if (name && npc.avatarUrl) storedNpcAvatarByName.set(name, npc.avatarUrl);
                }

                for (const char of chars) {
                  if (isManualTrackerCharacterId(char.characterId)) continue;
                  if (cardCharacterIds.has(String(char.characterId))) continue;
                  const name = (char.name as string) ?? "";
                  // Try matching against the chat's character cards (case-insensitive)
                  const matched = charInfo.find((c) => normalizeTextForMatch(c.name) === normalizeTextForMatch(name));
                  if (!char.avatarCrop && matched?.avatarCrop) {
                    char.avatarCrop = matched.avatarCrop;
                  }
                  if (char.avatarPath) continue; // already set
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
                  const safeName = npcAvatarSlug(name);
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
                        const imageFallback = await resolveImageConnectionFallback(connections, imgConnFull.id);
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
                              debugMode: input.debugMode,
                              fallback: imageFallback,
                              onFallback,
                            });

                            // Save to NPC avatars directory
                            const safeName = npcAvatarSlug(npcName);
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
                    revectorizeEntry: memoryRecallVectorizerAvailable
                      ? async (entry) => {
                          await warmLorebookEntryEmbeddings(app.db, [entry], {
                            embeddingSource: memoryRecallEmbeddingSource,
                            signal: abortController.signal,
                          });
                        }
                      : undefined,
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

            // ── About Me Keeper: apply chat-specific overrides, re-emit public edits for approval ──
            if (result.success && result.type === "about_me_update" && result.data && typeof result.data === "object") {
              try {
                const rawUpdates = (result.data as Record<string, unknown>).updates;
                const updates = Array.isArray(rawUpdates) ? (rawUpdates as Array<Record<string, unknown>>) : [];
                const validCharIds = new Set(agentContext.characters.map((c) => c.id));
                const isUsable = (u: Record<string, unknown>) =>
                  typeof u.characterId === "string" && validCharIds.has(u.characterId) && typeof u.newText === "string";
                const chatUpdates = updates.filter((u) => u.target === "chat" && isUsable(u));
                const publicUpdates = updates.filter((u) => u.target === "public" && isUsable(u));

                // Chat-specific overrides auto-apply to chat metadata (low stakes, this chat only).
                // Use the queued patchMetadata (atomic read-modify-write) so a concurrent
                // metadata write can't clobber the override map — same path the tool uses.
                if (chatUpdates.length > 0) {
                  await chats.patchMetadata(input.chatId, (currentMeta) => {
                    const overrides = {
                      ...((currentMeta.conversationAboutMeOverrides as Record<string, string> | undefined) ?? {}),
                    };
                    for (const u of chatUpdates) {
                      const id = u.characterId as string;
                      const text = u.newText as string;
                      if (text.trim()) overrides[id] = text;
                      else delete overrides[id];
                    }
                    return { conversationAboutMeOverrides: overrides };
                  });
                }

                // Public edits change the shared card → route through the existing
                // character-card approval modal. oldText is computed server-side from
                // the known current public about-me so the modal's replace is exact.
                if (publicUpdates.length > 0) {
                  const state = (agentContext.memory._aboutMeState ?? []) as Array<{
                    characterId: string;
                    publicAboutMe: string;
                  }>;
                  const currentById = new Map(state.map((s) => [s.characterId, s.publicAboutMe]));
                  const cardUpdates = publicUpdates
                    .map((u) => {
                      const id = u.characterId as string;
                      const oldText = currentById.get(id) ?? "";
                      const newText = u.newText as string;
                      if (oldText === newText) return null;
                      return {
                        action: "update" as const,
                        characterId: id,
                        field: "aboutMe" as const,
                        oldText,
                        newText,
                        reason: typeof u.reason === "string" ? u.reason : "About Me Keeper suggested update",
                      };
                    })
                    .filter((u): u is NonNullable<typeof u> => u !== null);
                  if (cardUpdates.length > 0) {
                    sendAgentResultEvent({ ...result, type: "character_card_update", data: { updates: cardUpdates } });
                  }
                }
              } catch (err) {
                logger.warn(err, "[about-me-keeper] failed to apply results");
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
                const agentImageConnectionId = ((illustratorAgent?.settings?.imageConnectionId as string) ?? "").trim();
                const imageConnectionOverride = chatGameImageConnectionId || agentImageConnectionId;
                let imgConnFull = imageConnectionOverride
                  ? await connections.getWithKey(imageConnectionOverride)
                  : null;
                if (imageConnectionOverride && !imgConnFull) {
                  logger.warn(
                    "[illustrator] Image connection %s could not be resolved; falling back to the default Images connection",
                    imageConnectionOverride,
                  );
                }
                imgConnFull ??= await connections.getDefaultForImageGeneration();
                if (imgConnFull) {
                  const resolvedImageConnection = imgConnFull;
                  trySendSseEvent(reply, {
                    type: "illustration_queued",
                    data: { messageId },
                  });
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
                      const imageFallback = await resolveImageConnectionFallback(connections, imgConnFull.id);
                      const suppressReferencePromptLine = suppressesReferencePromptLine(
                        {
                          model: imgModel,
                          baseUrl: imgBaseUrl,
                          imageService: imgServiceHint,
                          imageGenerationSource: imgSource,
                        },
                        imageFallback,
                      );
                      const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
                      const imageSettings = await loadImageGenerationUserSettings(app.db);
                      const styleProfileId =
                        ((chatMeta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as
                          | string
                          | undefined) ??
                        (chatMeta.imageStyleProfileId as string | undefined) ??
                        null;

                      const illustrationSize = resolveIllustratorImageSize(
                        imageSettings.illustration,
                        illData.aspectRatio,
                      );
                      const imgWidth = illustrationSize.width;
                      const imgHeight = illustrationSize.height;

                      // Prepend style to the prompt for better results
                      let fullPrompt = style ? `${style}, ${imagePrompt}` : imagePrompt;
                      if (imagePositivePrompt) {
                        fullPrompt = `${fullPrompt}, ${imagePositivePrompt}`;
                      }
                      const requestedNegativePrompt = [negativePrompt, savedNegativePrompt].filter(Boolean).join(", ");

                      logger.debug(`[illustrator] Starting image generation (${imgWidth}x${imgHeight})...`);

                      // Collect optional character visual context. Prefer avatar
                      // portraits for references, then fall back to full-body sprites.
                      const useAvatarRefs =
                        typeof chatMeta.illustratorUseAvatarReferences === "boolean"
                          ? chatMeta.illustratorUseAvatarReferences
                          : illustratorAgent?.settings?.useAvatarReferences === true;
                      const includeCharacterAppearance =
                        typeof chatMeta.illustratorIncludeCharacterAppearance === "boolean"
                          ? chatMeta.illustratorIncludeCharacterAppearance
                          : illustratorAgent?.settings?.includeCharacterAppearance === true;
                      let illustratorRefImages: string[] | undefined;
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
                        includeReferenceImages: useAvatarRefs,
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
                        if (referenceResolution.referenceLine && !suppressReferencePromptLine)
                          fullPrompt += `\n\n${referenceResolution.referenceLine}`;
                        logger.debug(
                          "[illustrator] Sending %d character reference(s) for: %s",
                          referenceResolution.referenceImages.length,
                          referenceResolution.referenceNames.join(", "),
                        );
                      }

                      const compiledPrompt = compileImagePrompt({
                        kind: "illustration",
                        prompt: fullPrompt,
                        negativePrompt: requestedNegativePrompt || undefined,
                        styleProfiles: imageSettings.styleProfiles,
                        styleProfileId,
                        imageDefaults,
                        generatedStyle: style,
                      });
                      fullPrompt = compiledPrompt.prompt;
                      const finalNegativePrompt = mergeIllustratorNegativePrompt(
                        compiledPrompt.prompt,
                        compiledPrompt.negativePrompt,
                      );

                      const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                        prompt: compiledPrompt.prompt,
                        negativePrompt: finalNegativePrompt || undefined,
                        model: imgModel,
                        width: imgWidth,
                        height: imgHeight,
                        imageEndpointId: imgConnFull.imageEndpointId || undefined,
                        comfyWorkflow: imgConnFull.comfyuiWorkflow || undefined,
                        imageDefaults,
                        referenceImages: illustratorRefImages,
                        debugMode: input.debugMode,
                        fallback: imageFallback,
                        onFallback,
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
                      await persistGeneratedImageToEntityGalleries({
                        sourceFilePath: filePath,
                        characterIds: referenceResolution.characterIds,
                        personaIds: referenceResolution.personaId ? [referenceResolution.personaId] : [],
                        characterGallery,
                        personaGallery,
                        prompt: fullPrompt,
                        provider: imgConnFull.provider ?? "image_generation",
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
                          "No image generation connection is set on the Illustrator agent or under Settings → Connections → Defaults → Images. Choose one there, or assign one directly in Settings → Agents → Illustrator.",
                      },
                    })}\n\n`,
                  );
                }
              }
            }
          }

          // ── Text rewrite/editing agents: run after ALL other agents ──
          if (textRewriteRunAgents.length > 0 && messageId && !abortController.signal.aborted) {
            let currentResponseForRewrite = continuedMessageRewriteSource ?? combinedResponse;
            const originalResponseBeforeRewrite = currentResponseForRewrite;
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
                  const strictEditNeeded = isBuiltInTextRewriteAgentType(editorResult.agentType);
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
                        proseGuardianRewrittenText: editedText,
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

            if (holdForTextRewrite && !textRewriteApplied && !abortController.signal.aborted) {
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
          const professorMariCommandCount = countProfessorMariCommands(collectedCommands);
          trySendSseEvent(reply, {
            type: "assistant_commands_start",
            data: { count: collectedCommands.length, professorMariCommandCount },
          });
          // React target resolution needs the FULL chat-member list (disabled
          // members included — the client segments with them). Built lazily once
          // per request: each getById is a full-table scan in the file-native
          // store, and a multi-react group reply runs several react commands.
          let reactChatMembersCache: Array<{ id: string; name: string }> | null = null;
          const getReactChatMembers = async (): Promise<Array<{ id: string; name: string }>> => {
            if (reactChatMembersCache) return reactChatMembersCache;
            const members: Array<{ id: string; name: string }> = charInfo.map((c) => ({ id: c.id, name: c.name }));
            for (const cid of allCharacterIds) {
              if (members.some((m) => m.id === cid)) continue;
              const row = await chars.getById(cid);
              if (!row) continue;
              try {
                const name = JSON.parse(row.data as string)?.name;
                if (typeof name === "string" && name.trim()) members.push({ id: cid, name });
              } catch {
                // Malformed character data — not addressable as a react target.
              }
            }
            reactChatMembersCache = members;
            return members;
          };
          try {
            for (const { command, characterId, messageId, swipeIndex } of collectedCommands) {
              try {
                await handleConversationScheduleCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  chats,
                  sendUpdated: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "schedule_updated",
                        data,
                      })}\n\n`,
                    );
                  },
                });

                await handleConversationCrossPostCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  messageId,
                  fullResponse,
                  chats,
                  sendCrossPost: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "cross_post",
                        data,
                      })}\n\n`,
                    );
                  },
                });

                await handleConversationSelfieCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  messageId,
                  swipeIndex,
                  chatMeta,
                  charInfo,
                  persona: persona
                    ? {
                        id: personaId,
                        name: personaName,
                        avatarPath: persona.avatarPath as string | null,
                        appearance: personaFields.appearance,
                      }
                    : null,
                  promptConnection: conn,
                  promptConnectionId: conn.id,
                  debugMode: input.debugMode,
                  serviceTier,
                  db: app.db,
                  chars,
                  chats,
                  connections,
                  sendEvent: (payload) => {
                    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
                  },
                });

                await handleConversationCallCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  chatMode,
                  messageId,
                  db: app.db,
                  chats,
                  sendRingingEvent: (data) => {
                    trySendSseEvent(reply, {
                      type: "conversation_call_ringing",
                      data,
                    });
                  },
                });

                await handleConversationSideEffectCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  messageId,
                  chars,
                  chats,
                });

                await handleConversationMusicCommand({
                  command,
                  chatId: input.chatId,
                  chatMode,
                  agentsStore,
                  sendEvent: (event) => {
                    trySendSseEvent(reply, event);
                  },
                });

                await handleConversationReactCommand({
                  command,
                  characterId,
                  sourceMessageId: messageId,
                  chatMode,
                  chatMessages,
                  personaId,
                  personaName,
                  conversationCustomEmojiUrlByName,
                  customEmojisStore,
                  chars,
                  chats,
                  getReactChatMembers,
                });

                await handleRoleplayDmCommand({
                  command,
                  chatId: input.chatId,
                  sourceChat: chat,
                  messageId,
                  allChatMessages,
                  chats,
                  sendAssistantAction: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "assistant_action",
                        data,
                      })}\n\n`,
                    );
                  },
                });

                await handleHapticCommand({
                  command,
                  sendEvent: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "haptic_command",
                        data,
                      })}\n\n`,
                    );
                  },
                });

                await handleConversationSceneCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  chars,
                  sendSceneRequested: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "scene_requested",
                        data,
                      })}\n\n`,
                    );
                  },
                });

                await handleTurnGameCommand({
                  commandType: command.type === "capability" ? command.commandType : command.type,
                  characterId,
                  chatId: input.chatId,
                  chatMeta,
                  db: app.db,
                  chats,
                  conn,
                  baseUrl,
                  reply,
                  signal: abortController.signal,
                });

                const professorMariResult = await handleProfessorMariCommand({
                  command,
                  characterId,
                  chatId: input.chatId,
                  sourceChatMetadata: chat.metadata,
                  isHomeProfessorMariAssistantChat,
                  db: app.db,
                  stores: { chars, chats, lorebooksStore, presets },
                  sendAssistantAction: (data) => {
                    reply.raw.write(
                      `data: ${JSON.stringify({
                        type: "assistant_action",
                        data,
                      })}\n\n`,
                    );
                  },
                });
                if (professorMariResult.fetchSucceeded) {
                  mariFetchSucceededThisIteration = true;
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
              resolveMacros: (value, randomSeed) =>
                resolveMacros(value, promptMacroContext, { trimResult: false, randomSeed }),
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
              {
                embeddingSource: memoryRecallEmbeddingSource,
                readBehindMessageCount:
                  typeof contextMessageLimit === "number" && contextMessageLimit > 0 ? contextMessageLimit : undefined,
              },
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
          trySendSseEvent(reply, {
            type: "ooc_posted",
            data: { chatId: chat.connectedChatId, count: collectedOocMessages.length },
          });
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
      if (canWriteSse()) {
        reply.raw.end();
      }
    }
  });

  // ── Active generation tracking for explicit abort ──
  const activeGenerations = new Map<string, { abortController: AbortController; backendUrl: string | null }>();

  // Expose the map so the route handler can register/unregister generations
  app.decorate("activeGenerations", activeGenerations);

  /**
   * GET /api/generate/status/:chatId
   * Lets clients recover from passive mobile/browser stream disconnects by
   * waiting until the server-side generation has finished saving.
   */
  app.get<{ Params: { chatId: string } }>("/status/:chatId", async (req) => ({
    active: activeGenerations.has(req.params.chatId),
  }));

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
  await registerRawRoute(app);
  await registerRetryAgentsRoute(app);
}
