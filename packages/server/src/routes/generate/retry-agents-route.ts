import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { logger, logDebugOverride } from "../../lib/logger.js";
import {
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  applyQuestUpdatesToPlayerStats,
  applyTrackerFieldLocksToGameStatePatch,
  getCustomAgentResultCapability,
  NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
  customAgentHasCapability,
  isAgentAvailableInChatMode,
  isAgentConfigDeleted,
  isExternallyImportedAgent,
  isBuiltInAgentRuntimeDisabled,
  isBuiltInAgentHostManaged,
  isRetiredBuiltInAgentId,
  normalizeWorldCustomFields,
  normalizeAgentPhaseValue,
  normalizeAgentPromptTemplateSelectionMap,
  normalizeImagePromptInstructions,
  resolveMacros,
  resolveGameSetupArtStylePrompt,
  resolveAgentPromptTemplate,
  findKnownModel,
  shouldSuppressUnknownModelParameters,
  type AgentCallDebugEvent,
  type AgentContext,
  type AgentResult,
  type APIProvider,
  type ChatMode,
  type GameMap,
  type WrapFormat,
  type GenerationParameterSendMap,
} from "@marinara-engine/shared";
import { eq } from "../../db/file-query.js";
import { listCharacterSprites } from "../../services/game/sprite.service.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import {
  AGENT_PHASE_MAX_CONCURRENT_GROUPS,
  getAgentBatchLane,
  normalizeAgentMaxParallelJobs,
  settleAgentJobsWithConcurrencyLimit,
  shouldUseToolsDuringAgentExecution,
  type ResolvedAgent,
} from "../../services/agents/agent-pipeline.js";
import { executeAgent, executeAgentBatch, normalizeAgentContextSize } from "../../services/agents/agent-executor.js";
import type { BaseLLMProvider } from "../../services/llm/base-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../../services/llm/local-sidecar.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../services/llm/connection-fallback-provider.js";
import { sidecarModelService } from "../../services/sidecar/sidecar-model.service.js";
import { buildSpotifyDjConstraints } from "../../services/spotify/spotify-dj-constraints.js";
import { fingerprintChatSummary } from "../../services/prompt/chat-summary-fingerprint.js";
import {
  buildPromptMacroContext,
  normalizeChatMacroVariables,
  resolveCharacterMacroData,
  resolvePromptIdleDuration,
  resolvePromptMessageMacros,
} from "../../services/prompt/index.js";
import { cardPromptText } from "../../services/prompt/card-text.js";
import { getAssetManifest } from "../../services/game/asset-manifest.service.js";
import { createAgentsStorage } from "../../services/storage/agents.storage.js";
import { loadPriorBeholderState } from "../../services/agents/beholder-state.js";
import { getCustomAgentImportPolicy } from "../../services/agents/custom-agent-import-policy.service.js";
import { createCharactersStorage } from "../../services/storage/characters.storage.js";
import { createChatsStorage } from "../../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { createCharacterGalleryStorage } from "../../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../../services/storage/persona-gallery.storage.js";
import { createPromptsStorage } from "../../services/storage/prompts.storage.js";
import { findLastUserMessageIdBefore } from "../../services/generation/message-history.js";
import { textRewriteDropsProtectedMarkup } from "../../services/generation/text-rewrite-safety.js";
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
} from "../../services/image/image-generation-defaults.js";
import { injectMemoryRecallContext } from "../../services/generation/memory-recall-context.js";
import {
  appendTrackerLorebookBatchContextKey,
  applyTrackerLorebookContextPolicy,
  getTrackerAgentTypes,
} from "../../services/generation/tracker-agent-context.js";
import {
  isMemoryRecallVectorizerAvailable,
  resolveMemoryRecallEmbeddingSource,
} from "../../services/memory-recall-embedding.js";
import {
  loadImageGenerationUserSettings,
  resolveIllustratorImageSize,
} from "../../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../../services/image/image-prompt-compiler.js";
import {
  mergeSpatialLocationReferenceImages,
  resolveSpatialLocationReferenceImage,
  SPATIAL_LOCATION_REFERENCE_PROMPT_LINE,
} from "../../services/image/spatial-location-reference.js";
import { persistGeneratedImageToEntityGalleries } from "../../services/image/generated-image-entity-gallery.js";
import { resolveImageConnectionFallback } from "../../services/generation/media-connection-fallback.js";
import type { GenerationFallbackNotifier } from "../../services/generation/fallback-notification.js";
import { createReplyFallbackNotifier } from "./fallback-notification.js";
import { runImageGenerationRequest } from "../../services/image/image-generation-queue.js";
import { generateIllustratorImageVariants } from "../../services/image/illustrator-image-variants.js";
import { resolveImagePromptReviewSize } from "../../services/image/image-prompt-review.js";
import {
  parseIllustratorPromptReviewOverride,
  resolveIllustratorPromptSubmission,
  type IllustratorPromptReviewOverride,
} from "../../services/image/illustrator-prompt-review.js";
import { createGameStateStorage } from "../../services/storage/game-state.storage.js";
import { normalizeCharacterRpgStats } from "../../services/generation/character-prompt-context.js";
import { createLorebooksStorage } from "../../services/storage/lorebooks.storage.js";
import { createCustomToolsStorage } from "../../services/storage/custom-tools.storage.js";
import { syncGameMapMetaPartyPosition } from "../../services/game/map-position.service.js";
import {
  formatOwnerSpatialBreadcrumb,
  omitAuthoritativeGameLocation,
  projectGameSnapshotLocation,
  resolveOwnerSpatialProjection,
} from "../../services/spatial-context/projection.js";
import { gameStateSnapshots as gameStateSnapshotsTable } from "../../db/schema/index.js";
import {
  buildLockedPlayerStatsArrayPatch,
  buildLockedInventoryTrackerPatch,
  buildLockedPersonaTrackerPatch,
  applyTrackerCharacterCardIdentity,
  collectLatestTrackerCharacterHistory,
  isMessageHiddenFromAI,
  parseExtra,
  parseStoredGenerationParameters,
  parseGameStateRow,
  parseSnapshotPlayerStats,
  preserveTrackerCharacterUiFields,
  resolveActiveCharacterIds,
  resolveBaseUrl,
  resolveRoleplayChatSummaryForPrompt,
  resolveVisibleGameStateAnchor,
} from "./generate-route-utils.js";
import {
  buildHistoricalLorebookKeeperContext,
  CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY,
  customAgentUsesLorebookBackfill,
  customAgentUsesLorebookReadBehind,
  customLorebookReadBehindRunKey,
  getCustomLorebookBackfillChunk,
  getCustomLorebookBackfillSettings,
  getCustomLorebookReadBehindMessages,
  getLorebookKeeperBackfillTargets,
  getLorebookNamingScheme,
  getLorebookKeeperSettings,
  loadLorebookKeeperExistingEntries,
  persistLorebookKeeperUpdates,
  resolveLorebookKeeperTarget,
  tryClaimCustomLorebookReadBehindRun,
} from "./lorebook-keeper-utils.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
  isAgentWriteApprovalEnvelope,
} from "./agent-write-approval.js";
import {
  filterGameInternalAgentIds,
  resolveLorebookScopeExclusions,
} from "../../services/lorebook/game-lorebook-scope.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { isSseReplyWritable, sendSseEvent, startSseKeepalive, startSseReply } from "./sse.js";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection.js";
import {
  buildAgentConnectionUnavailableWarning,
  buildDefaultAgentConnectionWarning,
  buildLocalSidecarUnavailableWarning,
  isLocalSidecarConnectionId,
  resolveAgentConnectionId,
  type AgentConnectionWarning,
} from "./agent-connection-guards.js";
import {
  buildAvailableSpriteCharacter,
  completeRequiredSpriteExpressionEntries,
  normalizeRequiredSpriteExpressionIds,
  normalizeSpriteDisplayModes,
  validateSpriteExpressionEntries,
} from "./expression-agent-utils.js";
import {
  suppressesReferencePromptLine,
  mergeIllustratorNegativePrompt,
  illustratorPromptTemplateOwnsComposition,
  resolveIllustratorCharacterReferences,
} from "./illustrator-references.js";
import {
  explicitlyRequestsTextRewrite,
  isBuiltInTextRewriteAgentType,
  mergePairedBuiltInRewriteAgents,
  normalizeProseGuardianPromptTemplate,
} from "../../services/generation/prose-guardian-settings.js";
import {
  forceImageGenerationScopeError,
  needsForcedSnapshotFallback,
  resolveCustomAgentStyleProfileId,
} from "../../services/generation/custom-agent-image-settings.js";
import {
  generateIllustratorSceneBackground,
  illustratorBackgroundGenerationEnabled,
  illustratorRequestedBackground,
  illustratorTrackerLocationChanged,
  parseIllustratorBackgroundPlan,
  previewIllustratorSceneBackground,
  resolveIllustratorImageConnectionId,
  resolveIllustratorPromptStyle,
} from "../../services/generation/illustrator-background-generation.js";
import { writeManualIllustratorPromptPlan } from "../../services/generation/illustrator-manual-prompt-generation.js";
import {
  isExclusiveIllustratorRetryTarget,
  parseIllustratorRetryTargets,
  shouldRetryIllustratorTarget,
  type IllustratorRetryTarget,
} from "../../services/generation/illustrator-retry-targets.js";
import { normalizeContextInjections } from "./agent-normalizers.js";
import { resolveCustomWritableLorebookIds } from "../../services/generation/agent-prompt-runtime.js";
import {
  getAgentFallbackPrompt,
  musicAgentUsesSource,
  resolveEffectiveAgentSettings,
} from "../../services/generation/agent-resolution.js";
import { resolveAgentGenerationTools } from "../../services/generation/tool-resolution-runtime.js";
import {
  readSpotifyPlaybackTrackUri,
  readSpotifyStringField,
  readSpotifyTrackUris,
  type SpotifyRuntimeAgent,
} from "../../services/generation/spotify-agent-runtime.js";

type PersonaContext = {
  personaId: string | null;
  personaName: string;
  personaDescription: string;
  personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string };
  personaAvatarPath?: string | null;
  personaStats: any;
  rpgStats: any;
};

type ResolvedRetryAgent = {
  cfg: any;
  resolved: ResolvedAgent;
  agentProvider: any;
  agentModel: string;
};

type RetryLorebookEffectStatus = "applied" | "pending_approval" | "failed";

const isBuiltInAgentType = (agentType: string) => BUILT_IN_AGENTS.some((agent) => agent.id === agentType);

function findRetryResultAgent(result: AgentResult, agents: ResolvedRetryAgent[]): ResolvedAgent | null {
  return (
    agents.find((entry) => entry.resolved.id === result.agentId || entry.resolved.type === result.agentType)
      ?.resolved ?? null
  );
}

function customAgentCanApplyRetryResult(
  result: AgentResult,
  agents: ResolvedRetryAgent[],
  capability: Parameters<typeof customAgentHasCapability>[1],
): boolean {
  if (isBuiltInAgentType(result.agentType)) return true;
  const agent = findRetryResultAgent(result, agents);
  return agent ? customAgentHasCapability(agent.settings, capability) : false;
}

function customAgentCanEmitRetryResult(result: AgentResult, agents: ResolvedRetryAgent[]): boolean {
  if (isBuiltInAgentType(result.agentType)) return true;
  if (result.type === "lorebook_update") {
    return (
      customAgentCanApplyRetryResult(result, agents, "edit_lorebooks") ||
      customAgentCanApplyRetryResult(result, agents, "create_lorebooks")
    );
  }
  const capability = getCustomAgentResultCapability(result.type);
  return capability ? customAgentCanApplyRetryResult(result, agents, capability) : true;
}

function hasAgentJsonParseError(result: AgentResult): boolean {
  return (
    result.success &&
    !!result.data &&
    typeof result.data === "object" &&
    (result.data as { parseError?: unknown }).parseError === true
  );
}

function markInvalidJsonAgentResult(result: AgentResult): AgentResult {
  if (!hasAgentJsonParseError(result)) return result;
  return {
    ...result,
    success: false,
    error: `Agent returned invalid JSON instead of the requested ${result.type} format. Check this agent's model/connection settings and try again.`,
  };
}

function markRetryLorebookResultForApproval(args: {
  result: AgentResult;
  chatId: string;
  chatName: string | null | undefined;
  agentContext: AgentContext;
  resolvedAgents: ResolvedRetryAgent[];
}): AgentResult {
  const { result, chatId, chatName, agentContext, resolvedAgents } = args;
  if (
    !result.success ||
    result.type !== "lorebook_update" ||
    !result.data ||
    typeof result.data !== "object" ||
    isAgentWriteApprovalEnvelope(result.data)
  ) {
    return result;
  }
  const data = result.data as Record<string, unknown>;
  const updates = Array.isArray(data.updates)
    ? data.updates.filter((update): update is Record<string, unknown> => {
        return !!update && typeof update === "object" && !Array.isArray(update);
      })
    : [];
  if (updates.length === 0) return result;

  const entry = resolvedAgents.find(
    (candidate) => candidate.resolved.id === result.agentId || candidate.resolved.type === result.agentType,
  );
  const resultAgent = entry?.resolved;
  const isBuiltInLorebookAgent = isBuiltInAgentType(result.agentType);
  const customCanEditLorebooks =
    isBuiltInLorebookAgent || (resultAgent ? customAgentHasCapability(resultAgent.settings, "edit_lorebooks") : false);
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
  if (!customCanCreateLorebooks && !preferredTargetLorebookId && !writableLorebookIds?.length) return result;

  const writableLorebookIdSet = writableLorebookIds ? new Set(writableLorebookIds) : null;
  const writableLorebooks = Array.isArray(agentContext.memory._writableLorebooks)
    ? (agentContext.memory._writableLorebooks as Array<{ id: string; name: string }>).filter(
        (book) => !writableLorebookIdSet || writableLorebookIdSet.has(book.id),
      )
    : undefined;
  const existingEntries = Array.isArray(agentContext.memory._existingLorebookEntries)
    ? (agentContext.memory._existingLorebookEntries as Array<{ name?: string | null; content?: string | null }>)
    : undefined;
  return {
    ...result,
    data: {
      ...data,
      requiresApproval: true,
      approval: buildLorebookWriteApprovalProposal({
        chatId,
        agentType: result.agentType,
        agentName: entry?.cfg?.name ?? entry?.resolved.name ?? result.agentType,
        updates,
        preferredTargetLorebookId,
        writableLorebookIds,
        writableLorebooks,
        lorebookNamingScheme: getLorebookNamingScheme(resultAgent?.settings),
        worldName: agentContext.characters[0]?.world ?? chatName,
        existingEntries,
      }),
    },
  };
}

type ResolvedRetryAgents = {
  conn: any;
  enabledConfigs: any[];
  resolvedAgents: ResolvedRetryAgent[];
  warnings: AgentConnectionWarning[];
};

function parseJsonIfString<T>(value: T | string): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function parseSettingsRecord(value: unknown): Record<string, unknown> {
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
  const arc = normalizeSecretPlotArc(memory.overarchingArc);
  return arc ? { overarchingArc: arc } : {};
}

function normalizeWrapFormat(value: unknown): WrapFormat {
  return value === "markdown" || value === "none" || value === "xml" ? value : "xml";
}

function isChatAgentsEnabled(chatMeta: Record<string, unknown>): boolean {
  if (chatMeta.enableAgents === true || chatMeta.enableAgents === "true") return true;
  if (chatMeta.enableAgents === false || chatMeta.enableAgents === "false") return false;
  return Array.isArray(chatMeta.activeAgentIds)
    ? chatMeta.activeAgentIds.some((id) => typeof id === "string" && id.trim().length > 0)
    : false;
}

function normalizeRetryAgentTypeId(agentType: string): string {
  return agentType === "youtube" ? "spotify" : agentType;
}

function resolveActiveRetryAgentTypes(chatMode: ChatMode, chatMeta: Record<string, unknown>): Set<string> {
  if (!isChatAgentsEnabled(chatMeta)) return new Set();
  const activeAgentIds = Array.isArray(chatMeta.activeAgentIds)
    ? chatMeta.activeAgentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const normalizedActiveIds = activeAgentIds.map((agentType) => normalizeRetryAgentTypeId(agentType.trim()));
  return new Set(
    filterGameInternalAgentIds(chatMode, normalizedActiveIds).filter((agentType) =>
      isAgentAvailableInChatMode(chatMode, agentType),
    ),
  );
}

async function resolveRetryAgentWrapFormat(args: {
  chat: any;
  chatMode: ChatMode;
  conn: any | null;
  presets: ReturnType<typeof createPromptsStorage>;
}): Promise<WrapFormat> {
  if (args.chatMode === "conversation" || args.chatMode === "game") {
    return "xml";
  }

  const candidates = buildGenerationPromptPresetCandidates({
    chatMode: args.chatMode,
    chatPromptPresetId: args.chat.promptPresetId,
    connectionPromptPresetId: args.conn?.promptPresetId,
  });
  for (const candidate of candidates) {
    const preset = await args.presets.getById(candidate.id);
    if (preset) return normalizeWrapFormat(preset.wrapFormat);
  }
  return "xml";
}

function getGameImageStylePrompt(chat: any, chatMeta: Record<string, unknown>): string {
  if (((chat as any).mode ?? "conversation") !== "game") return "";
  const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
  return resolveGameSetupArtStylePrompt(setupConfig);
}

function buildIllustratorImagePrompt(args: {
  gameArtStylePrompt: string;
  style: string;
  imagePrompt: string;
  imagePositivePrompt: string;
}): string {
  const imagePrompt = args.imagePrompt.trim();
  const imagePromptLower = imagePrompt.toLowerCase();
  const prefixParts: string[] = [];
  const seen = new Set<string>();

  for (const part of [args.gameArtStylePrompt, args.style]) {
    const trimmed = part.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key) || imagePromptLower.includes(key)) continue;
    seen.add(key);
    prefixParts.push(trimmed);
  }

  const fullPrompt = [...prefixParts, imagePrompt].join(", ");
  return args.imagePositivePrompt ? `${fullPrompt}, ${args.imagePositivePrompt}` : fullPrompt;
}

async function resolveManualIllustratorStyleInstruction(args: {
  app: FastifyInstance;
  chatMode: unknown;
  chatMeta: Record<string, unknown>;
  conns: ReturnType<typeof createConnectionsStorage>;
  illustratorAgent: ResolvedAgent;
}): Promise<string> {
  return (
    await resolveIllustratorPromptStyle({
      db: args.app.db,
      connections: args.conns,
      illustratorAgent: args.illustratorAgent,
      chatMode: args.chatMode,
      chatMetadata: args.chatMeta,
    })
  ).styleInstruction;
}

async function executeManualIllustratorPromptRequest(args: {
  app: FastifyInstance;
  chat: any;
  chatMeta: Record<string, unknown>;
  conns: ReturnType<typeof createConnectionsStorage>;
  illustratorEntry: ResolvedRetryAgent;
  agentContext: AgentContext;
  debugMode: boolean;
}): Promise<AgentResult> {
  const startedAt = Date.now();
  try {
    const cachedStyleInstruction = args.agentContext.memory._illustratorImageStyleInstruction;
    const styleInstruction =
      typeof cachedStyleInstruction === "string"
        ? cachedStyleInstruction
        : await resolveManualIllustratorStyleInstruction({
            app: args.app,
            chatMode: args.chat.mode,
            chatMeta: args.chatMeta,
            conns: args.conns,
            illustratorAgent: args.illustratorEntry.resolved,
          });
    const imageConnectionId = resolveIllustratorImageConnectionId(
      args.chat.mode,
      args.chatMeta,
      args.illustratorEntry.resolved.settings.imageConnectionId,
    );
    let imageConnection = imageConnectionId ? await args.conns.getById(imageConnectionId).catch(() => null) : null;
    imageConnection ??= await args.conns.getDefaultForImageGeneration().catch(() => null);
    const generated = await writeManualIllustratorPromptPlan({
      illustratorAgent: args.illustratorEntry.resolved,
      context: args.agentContext,
      styleInstruction,
      imagePromptInstructions: normalizeImagePromptInstructions(imageConnection?.imagePromptInstructions) ?? undefined,
      signal: args.agentContext.signal,
      debugLog: (message, ...values) => logDebugOverride(args.debugMode || isDebugAgentsEnabled(), message, ...values),
    });
    return {
      agentId: args.illustratorEntry.resolved.id,
      agentType: "illustrator",
      type: "image_prompt",
      data: {
        ...generated.plan,
        // The host owns this decision because the user already pressed Illustration.
        shouldGenerate: true,
        _styleProfileInstructionApplied: true,
      },
      tokensUsed: generated.tokensUsed,
      durationMs: Date.now() - startedAt,
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      agentId: args.illustratorEntry.resolved.id,
      agentType: "illustrator",
      type: "image_prompt",
      data: null,
      tokensUsed: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "Manual Illustrator prompt generation failed",
    };
  }
}

async function resolvePersonaContext(
  chars: ReturnType<typeof createCharactersStorage>,
  chat: any,
): Promise<PersonaContext> {
  let personaName = "User";
  let personaId: string | null = null;
  let personaDescription = "";
  let personaFields: PersonaContext["personaFields"] = {};
  let personaStats: any = null;
  let rpgStats: any = null;

  const allPersonas = await chars.listPersonas();
  const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
  const persona =
    (chat.personaId ? allPersonas.find((p: any) => p.id === chat.personaId) : null) ??
    (chatMode !== "game" ? allPersonas.find((p: any) => p.isActive === "true") : null);

  if (!persona) {
    return { personaId, personaName, personaDescription, personaFields, personaStats, rpgStats };
  }

  personaId = persona.id as string;
  personaName = persona.name;
  personaDescription = cardPromptText(persona.description);
  const personaAvatarPath = typeof persona.avatarPath === "string" ? persona.avatarPath : null;
  personaFields = {
    personality: cardPromptText(persona.personality),
    scenario: cardPromptText(persona.scenario),
    backstory: cardPromptText(persona.backstory),
    appearance: cardPromptText(persona.appearance),
  };

  if (persona.personaStats) {
    try {
      const parsed = parseJsonIfString<any>(persona.personaStats);
      if (parsed?.enabled) personaStats = parsed;
      if (parsed?.rpgStats?.enabled) rpgStats = parsed.rpgStats;
    } catch {
      // Ignore malformed JSON in legacy rows.
    }
  }

  return { personaId, personaName, personaDescription, personaFields, personaAvatarPath, personaStats, rpgStats };
}

export function resolveRetryAgentContextPolicy(resolvedAgents: readonly ResolvedAgent[]): {
  contextSize: number;
  customAgentVectorAccessEnabled: boolean;
  musicPlayerSource: "spotify" | "youtube" | "custom" | null;
} {
  const contextSize =
    resolvedAgents.length > 0
      ? Math.max(...resolvedAgents.map((agent) => normalizeAgentContextSize(agent.settings.contextSize)))
      : normalizeAgentContextSize(undefined);
  const customAgentVectorAccessEnabled = resolvedAgents.some((agent) =>
    customAgentHasCapability(agent.settings, "access_vectors"),
  );
  const musicAgent = resolvedAgents.find((agent) => agent.type === "spotify" || agent.type === "youtube");
  const musicSettings = musicAgent?.settings ?? {};
  const musicPlayerSource = musicAgent
    ? musicAgent.type === "youtube" || musicAgentUsesSource(musicSettings, "youtube")
      ? "youtube"
      : musicAgentUsesSource(musicSettings, "custom")
        ? "custom"
        : "spotify"
    : null;
  return { contextSize, customAgentVectorAccessEnabled, musicPlayerSource };
}

export function resolveLorebookKeeperRetryAnchor(target: { id: string; activeSwipeIndex?: number | null }): {
  messageId: string;
  swipeIndex: number;
} {
  return { messageId: target.id, swipeIndex: target.activeSwipeIndex ?? 0 };
}

type RetryAgentPhaseToolInputs = {
  requestBody: Record<string, unknown>;
  promptCharacterIds: string[];
  agentContext: AgentContext;
};

export function resolveRetryAgentPhaseToolInputs(args: {
  requestBody: Record<string, unknown>;
  agentContext: AgentContext;
  preGenerationAgentContext: AgentContext | null;
  selectedTargetMessage: { role?: unknown; characterId?: unknown } | null | undefined;
}): {
  default: RetryAgentPhaseToolInputs;
  preGeneration: RetryAgentPhaseToolInputs | null;
} {
  const resolveForContext = (agentContext: AgentContext): RetryAgentPhaseToolInputs => {
    const activeCharacterIds = agentContext.characters.map((character) => character.id);
    const targetCharacterId =
      args.selectedTargetMessage?.role === "assistant" &&
      typeof args.selectedTargetMessage.characterId === "string" &&
      activeCharacterIds.includes(args.selectedTargetMessage.characterId)
        ? args.selectedTargetMessage.characterId
        : null;
    const requestBody = { ...args.requestBody };
    if (targetCharacterId) {
      requestBody.forCharacterId = targetCharacterId;
    } else {
      delete requestBody.forCharacterId;
    }
    return {
      agentContext,
      requestBody,
      promptCharacterIds: targetCharacterId ? [targetCharacterId] : activeCharacterIds,
    };
  };
  return {
    default: resolveForContext(args.agentContext),
    preGeneration: args.preGenerationAgentContext ? resolveForContext(args.preGenerationAgentContext) : null,
  };
}

async function buildRetryAgentContext(args: {
  cyoaAgentWillRun: boolean;
  chatId: string;
  db: Parameters<typeof buildPromptMacroContext>[0]["db"];
  chat: any;
  chatMeta: Record<string, unknown>;
  currentBackground: string | null;
  recentMessages: any[];
  resolvedAgents: ResolvedAgent[];
  lastAssistant: any;
  chars: ReturnType<typeof createCharactersStorage>;
  gameStateStore: ReturnType<typeof createGameStateStorage>;
  lorebooksStore: ReturnType<typeof createLorebooksStorage>;
  streaming: boolean;
  wrapFormat: WrapFormat;
  forceIllustratorBackgroundGeneration: boolean;
  forceIllustratorImageGeneration: boolean;
  /** Snapshot button (#4682): tell retried custom image agents the user explicitly requested an image. */
  forceCustomImageGeneration: boolean;
  /**
   * When retrying agents for a specific assistant message (e.g. refreshing cached prompt injections),
   * use the game-state snapshot committed for that message+swipe — not the latest chat snapshot.
   */
  historicalGameStateAnchor?: { messageId: string; swipeIndex: number } | null;
  /** When false, do not fall back to the current latest snapshot if no historical anchor exists. */
  useLatestGameStateFallback?: boolean;
}) {
  const {
    cyoaAgentWillRun,
    chatId,
    db,
    chat,
    chatMeta,
    currentBackground,
    recentMessages,
    resolvedAgents,
    lastAssistant,
    chars,
    gameStateStore,
    lorebooksStore,
    streaming,
    wrapFormat,
    forceIllustratorBackgroundGeneration,
    forceIllustratorImageGeneration,
    forceCustomImageGeneration,
    historicalGameStateAnchor,
    useLatestGameStateFallback = true,
  } = args;
  const resolvedAgentTypes = new Set(resolvedAgents.map((agent) => agent.type));

  const allCharacterIds: string[] =
    typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? []);
  const characterIds = resolveActiveCharacterIds(allCharacterIds, chatMeta, {
    mode: (chat as any).mode ?? "conversation",
    allowEmpty: true,
  });
  const activeLorebookIds: string[] = Array.isArray(chatMeta.activeLorebookIds)
    ? (chatMeta.activeLorebookIds as string[])
    : [];
  const charInfo: AgentContext["characters"] = [];
  for (const cid of characterIds) {
    const charRow = await chars.getById(cid);
    if (!charRow) continue;
    const charData = parseJsonIfString<Record<string, unknown>>(charRow.data as string);
    const extensions =
      charData.extensions && typeof charData.extensions === "object" && !Array.isArray(charData.extensions)
        ? (charData.extensions as Record<string, unknown>)
        : {};
    charInfo.push({
      id: cid,
      name: (charData.name as string | undefined) ?? "Unknown",
      world: cardPromptText(extensions.world) || undefined,
      description: cardPromptText(charData.description),
      personality: cardPromptText(charData.personality) || undefined,
      scenario: cardPromptText(charData.scenario) || undefined,
      creatorNotes: cardPromptText(charData.creator_notes) || undefined,
      systemPrompt: cardPromptText(charData.system_prompt) || undefined,
      backstory: cardPromptText(extensions.backstory ?? charData.backstory) || undefined,
      appearance: cardPromptText(extensions.appearance ?? charData.appearance) || undefined,
      mesExample: cardPromptText(charData.mes_example) || undefined,
      firstMes: cardPromptText(charData.first_mes) || undefined,
      postHistoryInstructions: cardPromptText(charData.post_history_instructions) || undefined,
      avatarPath: typeof charRow.avatarPath === "string" ? charRow.avatarPath : null,
      avatarCrop: extensions.avatarCrop ?? null,
      rpgStats: normalizeCharacterRpgStats(extensions.rpgStats),
    });
  }

  const personaContext = await resolvePersonaContext(chars, chat);
  const initialMacroVariables = normalizeChatMacroVariables(chatMeta.macroVariables);
  const retryMacroVariables = { ...initialMacroVariables };
  const promptMacroContext = await buildPromptMacroContext({
    db,
    characterIds,
    personaName: personaContext.personaName,
    personaDescription: personaContext.personaDescription,
    personaFields: personaContext.personaFields,
    variables: {},
    localVariables: retryMacroVariables,
    groupScenarioOverrideText:
      typeof chatMeta.groupScenarioText === "string" && (chatMeta.groupScenarioText as string).trim()
        ? (chatMeta.groupScenarioText as string).trim()
        : null,
    lastInput: [...recentMessages].reverse().find((message: any) => message.role === "user")?.content,
    chatId,
    lastGenerationType: "retry_agents",
    idleDuration: resolvePromptIdleDuration(recentMessages),
  });
  const historyMacroProfilesById = (await resolveCharacterMacroData(db, allCharacterIds)).profilesById;
  const resolveHistoryMessageMacros = <T extends { content: string; characterId?: string | null }>(
    messages: T[],
  ): T[] => resolvePromptMessageMacros(messages, promptMacroContext, historyMacroProfilesById);
  for (const character of charInfo) {
    const resolveCharacterPromptText = (value?: string): string | undefined => {
      if (!value) return value;
      return resolveHistoryMessageMacros([{ content: value, characterId: character.id }])[0]?.content ?? value;
    };
    character.description = resolveCharacterPromptText(character.description) ?? "";
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
  const contextPolicy = resolveRetryAgentContextPolicy(resolvedAgents);
  const agentSlice = recentMessages.slice(-contextPolicy.contextSize);
  const resolvedAgentSlice = resolveHistoryMessageMacros(
    agentSlice.map((message: any) => ({
      ...message,
      content: (message.content as string) ?? "",
      characterId: typeof message.characterId === "string" && message.characterId ? message.characterId : null,
    })),
  );
  const retryCommittedSnapshots = await gameStateStore.getCommittedForMessages(
    agentSlice.filter((message: any) => message.role === "assistant"),
  );
  const retryVisibleAnchor =
    historicalGameStateAnchor ??
    (useLatestGameStateFallback && lastAssistant ? resolveVisibleGameStateAnchor([lastAssistant]) : null);
  const retryVisibleHistorySnapshot = retryVisibleAnchor
    ? await gameStateStore.getByChatAndMessage(chatId, retryVisibleAnchor.messageId, retryVisibleAnchor.swipeIndex)
    : null;
  const characterTrackerHistory = resolvedAgentTypes.has("character-tracker")
    ? collectLatestTrackerCharacterHistory(
        await gameStateStore.getRecent(chatId, 100, retryVisibleHistorySnapshot?.createdAt),
      )
    : [];
  const retryOwnerSpatialProjection = retryVisibleAnchor
    ? ((await resolveOwnerSpatialProjection(chatId, { exactAnchor: retryVisibleAnchor }, chatMeta)) ??
      (await resolveOwnerSpatialProjection(chatId, { throughMessageId: retryVisibleAnchor.messageId }, chatMeta)))
    : await resolveOwnerSpatialProjection(chatId, {}, chatMeta);
  const resolvedLastAssistantContent = lastAssistant
    ? (resolveHistoryMessageMacros([
        {
          content: (lastAssistant.content as string) ?? "",
          characterId:
            typeof lastAssistant.characterId === "string" && lastAssistant.characterId
              ? lastAssistant.characterId
              : null,
        },
      ])[0]?.content ??
      ((lastAssistant.content as string) || ""))
    : "";
  const resolvePersonaPromptText = (value?: string): string | undefined => {
    if (!value) return value;
    return resolveHistoryMessageMacros([{ content: value, characterId: null }])[0]?.content ?? value;
  };

  const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
  const customAgentVectorAccessEnabled = contextPolicy.customAgentVectorAccessEnabled;
  const lastAssistantExtra = lastAssistant ? parseExtra((lastAssistant as any).extra) : {};
  const rawLorebookScan =
    lastAssistantExtra.lorebookScan &&
    typeof lastAssistantExtra.lorebookScan === "object" &&
    !Array.isArray(lastAssistantExtra.lorebookScan)
      ? (lastAssistantExtra.lorebookScan as Record<string, unknown>)
      : {};
  const activatedLorebookEntries = (
    Array.isArray(rawLorebookScan.activatedEntries) ? rawLorebookScan.activatedEntries : []
  ).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.content === "string" ? [{ id: row.id, content: row.content }] : [];
  });
  const semanticLorebookEntries = (
    Array.isArray(rawLorebookScan.activatedEntries) ? rawLorebookScan.activatedEntries : []
  ).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const activationSources = Array.isArray(row.activationSources) ? row.activationSources : [];
    const matchedKeys = Array.isArray(row.matchedKeys) ? row.matchedKeys : [];
    const semanticMatch =
      row.matchType === "semantic" ||
      activationSources.includes("semantic") ||
      matchedKeys.some((key) => typeof key === "string" && key.startsWith("[semantic:"));
    if (!semanticMatch || typeof row.id !== "string" || typeof row.content !== "string") return [];
    return [
      {
        id: row.id,
        content: row.content,
        ...(typeof row.semanticScore === "number" && Number.isFinite(row.semanticScore)
          ? { semanticScore: row.semanticScore }
          : {}),
      },
    ];
  });
  let recalledAgentVectorMemories: string[] = [];
  let embeddingSource: Awaited<ReturnType<typeof resolveMemoryRecallEmbeddingSource>> | null = null;
  let summaryVectorizerAvailable = false;
  if (customAgentVectorAccessEnabled || chatMeta.semanticSummaryRetrievalEnabled === true) {
    try {
      const connectionId = typeof chat.connectionId === "string" ? chat.connectionId : null;
      embeddingSource = await resolveMemoryRecallEmbeddingSource(db, {
        chatMetadata: chatMeta,
        connectionId,
      });
      if (chatMeta.semanticSummaryRetrievalEnabled === true) {
        summaryVectorizerAvailable =
          embeddingSource !== null ||
          (await isMemoryRecallVectorizerAvailable(db, {
            chatMetadata: chatMeta,
            connectionId,
          }));
      }
    } catch (err) {
      logger.warn(err, "[retry-agents] Failed to resolve vector context");
    }
  }
  if (customAgentVectorAccessEnabled) {
    try {
      const latestUserMessage = [...resolvedAgentSlice]
        .reverse()
        .find((message: any) => message.role === "user" && message.content?.trim());
      recalledAgentVectorMemories = await injectMemoryRecallContext({
        db,
        messages: [],
        currentInputMessages: latestUserMessage ? [{ role: "user", content: String(latestUserMessage.content) }] : [],
        chatId,
        embeddingSource,
        contextLimit: undefined,
        sendProgress: () => {},
        resolveMacros: (value) => resolveMacros(value, promptMacroContext, { trimResult: false }),
        wrapFormat,
      });
    } catch (err) {
      logger.warn(err, "[retry-agents] Failed to resolve custom-agent vector context");
    }
  }
  const activeChatSummary = await resolveRoleplayChatSummaryForPrompt({
    chatMode,
    chatMetadata: chatMeta,
    messages: resolvedAgentSlice,
    vectorizerAvailable: summaryVectorizerAvailable,
    embeddingOptions: { embeddingSource },
  });
  const agentContext: AgentContext = {
    chatId,
    chatMode,
    wrapFormat,
    recentMessages: agentSlice.map((message: any, index: number) => {
      const resolved = resolvedAgentSlice[index];
      const nextMessage: AgentContext["recentMessages"][number] = {
        id: typeof message.id === "string" ? message.id : undefined,
        role: message.role,
        content: resolved?.content ?? message.content,
        characterId: message.characterId ?? undefined,
      };
      if (message.role === "assistant") {
        const messageSwipeIndex =
          typeof message.activeSwipeIndex === "number" &&
          Number.isInteger(message.activeSwipeIndex) &&
          message.activeSwipeIndex >= 0
            ? message.activeSwipeIndex
            : 0;
        const snapRow =
          retryVisibleHistorySnapshot &&
          message.id === retryVisibleHistorySnapshot.messageId &&
          messageSwipeIndex === retryVisibleHistorySnapshot.swipeIndex
            ? retryVisibleHistorySnapshot
            : retryCommittedSnapshots.get(message.id as string);
        if (snapRow) {
          nextMessage.gameState = parseGameStateRow(snapRow as Record<string, unknown>);
        }
      }
      return nextMessage;
    }),
    mainResponse: resolvedLastAssistantContent,
    gameState: null,
    characters: charInfo,
    characterTrackerHistory: characterTrackerHistory as unknown as AgentContext["characterTrackerHistory"],
    persona:
      personaContext.personaName !== "User"
        ? {
            name: personaContext.personaName,
            description: resolvePersonaPromptText(personaContext.personaDescription) ?? "",
            personality: resolvePersonaPromptText(personaContext.personaFields.personality) || undefined,
            backstory: resolvePersonaPromptText(personaContext.personaFields.backstory) || undefined,
            appearance: resolvePersonaPromptText(personaContext.personaFields.appearance) || undefined,
            scenario: resolvePersonaPromptText(personaContext.personaFields.scenario) || undefined,
            ...(personaContext.personaStats ? { personaStats: personaContext.personaStats } : {}),
            ...(personaContext.rpgStats ? { rpgStats: personaContext.rpgStats } : {}),
          }
        : null,
    writableLorebookIds: null,
    chatSummary: activeChatSummary,
    authorNotes:
      typeof chatMeta.authorNotes === "string" && chatMeta.authorNotes.trim()
        ? resolveMacros(chatMeta.authorNotes, promptMacroContext, { trimResult: false }).trim()
        : null,
    activatedLorebookEntries,
    ...(customAgentVectorAccessEnabled
      ? {
          vectorContext: {
            recalledMemories: recalledAgentVectorMemories,
            semanticLorebookEntries,
          },
        }
      : {}),
    streaming,
    memory: {},
  };

  const previousBeholderState = await loadPriorBeholderState({
    agentsStore: createAgentsStorage(db),
    chatId,
    chatMode,
    activeAgentIds: resolvedAgentTypes,
    chatEnableAgents: isChatAgentsEnabled(chatMeta),
    excludeMessageId: typeof lastAssistant?.id === "string" ? lastAssistant.id : null,
  });
  if (previousBeholderState) agentContext.memory._beholderState = previousBeholderState;

  const gameImageStylePrompt = getGameImageStylePrompt(chat, chatMeta);
  if (gameImageStylePrompt) {
    agentContext.memory._gameImageStylePrompt = gameImageStylePrompt;
  }
  if (personaContext.personaId) {
    agentContext.memory._personaId = personaContext.personaId;
    agentContext.memory._personaAvatarPath = personaContext.personaAvatarPath ?? null;
  }

  if (resolvedAgentTypes.has("lorebook-keeper")) {
    const lorebookKeeperSettings = getLorebookKeeperSettings(chatMeta);
    const { writableLorebookIds, writableLorebooks, targetLorebookId, targetLorebookName } =
      await resolveLorebookKeeperTarget({
        lorebooksStore,
        chatId,
        characterIds,
        personaId: personaContext.personaId,
        activeLorebookIds,
        preferredTargetLorebookId: lorebookKeeperSettings.targetLorebookId,
      });
    agentContext.writableLorebookIds = writableLorebookIds;
    agentContext.memory._writableLorebooks = writableLorebooks;
    if (targetLorebookId) {
      agentContext.memory._lorebookKeeperTargetLorebookId = targetLorebookId;
    }
    if (targetLorebookName) {
      agentContext.memory._lorebookKeeperTargetLorebookName = targetLorebookName;
    }
    const existingEntries = await loadLorebookKeeperExistingEntries(lorebooksStore, targetLorebookId);
    if (existingEntries.length > 0) {
      agentContext.memory._existingLorebookEntries = existingEntries;
    }
  }

  const customWritableLorebookIds = new Set(
    resolvedAgents
      .filter((agent) => agent.isCustomAgent === true && customAgentHasCapability(agent.settings, "edit_lorebooks"))
      .flatMap((agent) => resolveCustomWritableLorebookIds(agent.settings) ?? []),
  );
  if (customWritableLorebookIds.size > 0) {
    const allLorebooks = (await lorebooksStore.list()) as unknown as Array<{ id: string; name?: string | null }>;
    const writableLorebooks = new Map(
      (Array.isArray(agentContext.memory._writableLorebooks)
        ? (agentContext.memory._writableLorebooks as Array<{ id: string; name: string }>)
        : []
      ).map((book) => [book.id, book]),
    );
    for (const book of allLorebooks) {
      if (customWritableLorebookIds.has(book.id)) {
        writableLorebooks.set(book.id, { id: book.id, name: book.name?.trim() || book.id });
      }
    }
    agentContext.memory._writableLorebooks = [...writableLorebooks.values()];
  }

  if (historicalGameStateAnchor) {
    const snap = await gameStateStore.getByChatAndMessage(
      chatId,
      historicalGameStateAnchor.messageId,
      historicalGameStateAnchor.swipeIndex,
    );
    if (snap) {
      const parsedGameState = parseGameStateRow(snap as Record<string, unknown>);
      agentContext.gameState =
        projectGameSnapshotLocation(parsedGameState, retryOwnerSpatialProjection) ?? parsedGameState;
    } else {
      agentContext.gameState = null;
    }
  } else if (useLatestGameStateFallback) {
    const visibleAnchor = lastAssistant ? resolveVisibleGameStateAnchor([lastAssistant]) : null;
    const latestGS = await gameStateStore.getForGeneration(chatId, {
      preferLatestVisible: true,
      visibleAnchor,
    });
    if (latestGS) {
      const parsedGameState = parseGameStateRow(latestGS as Record<string, unknown>);
      agentContext.gameState =
        projectGameSnapshotLocation(parsedGameState, retryOwnerSpatialProjection) ?? parsedGameState;
    }
  }

  // CYOA re-rolls: inject the previous choices so the agent generates a fresh,
  // meaningfully different set instead of repeating the last batch. Mirrors
  // the same injection in the main generate route.
  if (cyoaAgentWillRun && lastAssistant) {
    const lastExtra = parseExtra((lastAssistant as any).extra);
    if (lastExtra.cyoaChoices) {
      agentContext.memory._lastCyoaChoices = lastExtra.cyoaChoices;
    }
  }

  // If the expression agent is being retried, load available sprite expressions per character
  if (resolvedAgentTypes.has("expression")) {
    try {
      const spriteDisplayModes = normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes);
      const selectedSpriteIds = new Set(
        Array.isArray(chatMeta.spriteCharacterIds)
          ? chatMeta.spriteCharacterIds.filter((id): id is string => typeof id === "string")
          : [],
      );
      const restrictToSelectedSprites = selectedSpriteIds.size > 0;
      const hasPersonaExpressionSource = agentContext.recentMessages.some(
        (message) => message.role === "user" && message.content.trim(),
      );
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
        !!personaContext.personaId &&
        (hasPersonaExpressionSource ||
          !restrictToSelectedSprites ||
          selectedSpriteIds.has(personaContext.personaId) ||
          chatMeta.expressionAvatarsEnabled === true);
      if (personaContext.personaId && includePersonaSprite) {
        const sprites = listCharacterSprites(personaContext.personaId);
        if (sprites) {
          const spritePersona = buildAvailableSpriteCharacter(
            personaContext.personaId,
            personaContext.personaName,
            sprites,
            spriteDisplayModes,
          );
          if (spritePersona) perChar.push(spritePersona);
        }
      }
      const expressionTargetIds = new Set<string>();
      if (lastAssistant?.characterId && typeof lastAssistant.characterId === "string") {
        expressionTargetIds.add(lastAssistant.characterId);
      } else if (lastAssistant?.role === "user" && personaContext.personaId) {
        expressionTargetIds.add(personaContext.personaId);
      }
      if (
        personaContext.personaId &&
        agentContext.recentMessages.some((message) => message.role === "user" && message.content.trim())
      ) {
        expressionTargetIds.add(personaContext.personaId);
      }
      const targetedSprites =
        expressionTargetIds.size > 0
          ? perChar.filter((sprite) => expressionTargetIds.has(sprite.characterId))
          : perChar;
      if (targetedSprites.length > 0 || expressionTargetIds.size > 0) {
        agentContext.memory._availableSprites = targetedSprites;
        if (expressionTargetIds.size > 0) {
          agentContext.memory._expressionTargetIds = [...expressionTargetIds];
        }
      }
    } catch (err) {
      logger.warn(err, "[retry-agents] Failed to load available sprites for retry");
    }
  }

  // If the background agent is being retried, load available backgrounds into context
  if (resolvedAgentTypes.has("background")) {
    try {
      const { readdirSync, readFileSync, existsSync } = await import("fs");
      const { join, extname } = await import("path");
      const availableBackgrounds: Array<{
        filename: string;
        tags: string[];
        source?: "user" | "game_asset";
      }> = [];
      const bgDir = join(DATA_DIR, "backgrounds");
      if (existsSync(bgDir)) {
        const exts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
        const files = readdirSync(bgDir).filter((f: string) => exts.has(extname(f).toLowerCase()));
        let meta: Record<string, { tags: string[] }> = {};
        const metaPath = join(bgDir, "meta.json");
        if (existsSync(metaPath)) {
          try {
            meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          } catch {
            /* */
          }
        }
        availableBackgrounds.push(
          ...files.map((f: string) => ({
            filename: f,
            tags: meta[f]?.tags ?? [],
            source: "user" as const,
          })),
        );
      }
      availableBackgrounds.push(
        ...(getAssetManifest().byCategory.backgrounds ?? [])
          .filter((entry) => !entry.path.startsWith("__user_bg__/"))
          .map((entry) => ({
            filename: `gameAsset:${entry.path}`,
            tags: entry.subcategory ? [entry.subcategory] : [],
            source: "game_asset" as const,
          })),
      );
      agentContext.memory._availableBackgrounds = availableBackgrounds;
      agentContext.memory._currentBackground = currentBackground;
    } catch (err) {
      logger.warn(err, "[retry-agents] Failed to load available backgrounds for retry");
    }
  }

  if (
    resolvedAgentTypes.has("illustrator") &&
    (forceIllustratorBackgroundGeneration ||
      illustratorBackgroundGenerationEnabled((chat as { mode?: unknown }).mode, chatMeta))
  ) {
    agentContext.memory._illustratorBackgroundGenerationEnabled = true;
    agentContext.memory._currentBackground = currentBackground;
  }

  if (resolvedAgentTypes.has("illustrator") && forceIllustratorImageGeneration) {
    agentContext.memory._forceIllustratorImageGeneration = true;
  }

  // Scoped to single-agent retries: memory is shared across the batch, and the
  // snapshot button (#4682) only ever targets one agent — enforce that here so
  // a multi-agent force request can't leak the directive to unrelated agents.
  if (forceCustomImageGeneration && resolvedAgentTypes.size === 1) {
    agentContext.memory._forceImageGeneration = true;
  }

  if (contextPolicy.musicPlayerSource === "youtube") {
    const mode = ((chat as any).mode ?? "conversation") as string;
    agentContext.memory._youtubeDjConstraints = {
      manualRetry: true,
      forceFreshPick: true,
      mode,
      retryNote:
        mode === "game"
          ? "This is a manual Music DJ YouTube retry from game mode. Pick a fresh fitting track now with action 'play' and a new searchQuery; do not keep the current track merely because it still fits."
          : "This is a manual Music DJ YouTube retry. Pick a fresh fitting track now with action 'play' and a new searchQuery.",
    };
  }

  if (contextPolicy.musicPlayerSource === "custom") {
    const mode = ((chat as any).mode ?? "conversation") as string;
    agentContext.memory._customMusicDjConstraints = {
      manualRetry: true,
      forceFreshPick: true,
      mode,
      retryNote:
        mode === "game"
          ? "This is a manual Music DJ Custom retry from game mode. Pick a fresh fitting local track path now with action 'play'; do not keep the current track merely because it still fits."
          : "This is a manual Music DJ Custom retry. Pick a fresh fitting local track path now with action 'play'.",
    };
  }

  if (contextPolicy.musicPlayerSource === "spotify") {
    const mode = ((chat as any).mode ?? "conversation") as string;
    agentContext.memory._spotifyDjConstraints = {
      ...buildSpotifyDjConstraints({
        chatMode: mode,
        chatMeta,
        manualRetry: true,
        forceFreshPick: true,
      }),
      retryNote:
        mode === "game"
          ? "This is a manual Music DJ Spotify retry from game mode. Pick a fresh fitting track now and call spotify_play unless Spotify playback is unavailable; do not keep the current track merely because it still fits."
          : "This is a manual Music DJ Spotify retry from roleplay. Pick a fresh fitting queue now and call spotify_play unless Spotify playback is unavailable.",
    };
  }

  return { agentContext, initialMacroVariables, macroVariables: retryMacroVariables };
}

async function persistRetryMacroVariables(
  chats: ReturnType<typeof createChatsStorage>,
  chatId: string,
  initialVariables: Record<string, string>,
  macroVariables: Record<string, string>,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const normalizedVariables = normalizeChatMacroVariables(macroVariables);
  const requestChanges = Object.fromEntries(
    Object.entries(normalizedVariables).filter(([name, value]) => initialVariables[name] !== value),
  );
  if (Object.keys(requestChanges).length === 0) return;
  await chats.patchMetadata(
    chatId,
    (current) => {
      signal.throwIfAborted();
      return {
        ...current,
        macroVariables: normalizeChatMacroVariables({
          ...normalizeChatMacroVariables(current.macroVariables),
          ...requestChanges,
        }),
      };
    },
    { touchUpdatedAt: false },
  );
  signal.throwIfAborted();
}

function readTrimmedRetryString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveRetryAgentConnectionRequest(args: {
  agentType: string;
  configuredConnectionId: string | null | undefined;
  defaultAgentConnectionId: string | null | undefined;
  chatMeta: Record<string, unknown>;
  localSidecarAvailable: boolean;
}): string | null | "skip-local-sidecar" {
  if (args.agentType !== "illustrator") {
    return resolveAgentConnectionId({
      requestedConnectionId: args.configuredConnectionId,
      defaultAgentConnectionId: args.defaultAgentConnectionId,
      localSidecarAvailable: args.localSidecarAvailable,
    });
  }

  const promptConnectionId = readTrimmedRetryString(args.chatMeta.illustratorPromptConnectionId);
  const configuredConnectionId = readTrimmedRetryString(args.configuredConnectionId);
  const requestedConnectionId = promptConnectionId ?? configuredConnectionId;

  return resolveAgentConnectionId({
    requestedConnectionId,
    defaultAgentConnectionId: promptConnectionId ? null : configuredConnectionId ? args.defaultAgentConnectionId : null,
    localSidecarAvailable: args.localSidecarAvailable,
  });
}

async function resolveRetryAgents(args: {
  agentTypes: string[];
  chat: any;
  conns: ReturnType<typeof createConnectionsStorage>;
  agentsStore: ReturnType<typeof createAgentsStorage>;
  agentPromptTemplateIds?: unknown;
  activeMusicPlayerSource?: "spotify" | "youtube" | "custom" | null;
  allowExternalAgentImports: boolean;
  onFallback?: GenerationFallbackNotifier;
}): Promise<ResolvedRetryAgents> {
  const { agentTypes, chat, conns, agentsStore, agentPromptTemplateIds, activeMusicPlayerSource, onFallback } = args;
  const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
  const chatMeta = parseExtra((chat as { metadata?: unknown }).metadata);
  const agentPromptTemplateSelections = {
    ...normalizeAgentPromptTemplateSelectionMap(chatMeta.agentPromptTemplateIds),
    ...normalizeAgentPromptTemplateSelectionMap(agentPromptTemplateIds),
  };
  const activeAgentTypeSet = resolveActiveRetryAgentTypes(chatMode, chatMeta);
  const normalizedAgentTypes = agentTypes.map(normalizeRetryAgentTypeId);
  const agentTypeSet = new Set(
    filterGameInternalAgentIds(chatMode, normalizedAgentTypes)
      .filter((agentType) => isAgentAvailableInChatMode(chatMode, agentType))
      .filter((agentType) => activeAgentTypeSet.has(agentType)),
  );
  const allConfigs = await agentsStore.list();
  const skippedImportedConfigs = args.allowExternalAgentImports
    ? []
    : allConfigs.filter((config) => isExternallyImportedAgent(config.type, config.settings));
  if (skippedImportedConfigs.length > 0) {
    logger.debug(
      "[agents] Retry skipped %d externally imported Agent configurations because custom imports are disabled",
      skippedImportedConfigs.length,
    );
  }
  const configs = allConfigs.filter(
    (config) => args.allowExternalAgentImports || !isExternallyImportedAgent(config.type, config.settings),
  );
  const deletedBuiltInTypes = new Set(
    configs
      .filter((config: any) => BUILT_IN_AGENTS.some((agent) => agent.id === config.type))
      .filter((config: any) => isAgentConfigDeleted(config.settings))
      .map((config: any) => config.type as string),
  );
  for (const agentType of deletedBuiltInTypes) {
    agentTypeSet.delete(agentType);
  }
  const enabledConfigs = configs.filter(
    (config: any) =>
      !isAgentConfigDeleted(config.settings) &&
      !isBuiltInAgentRuntimeDisabled(config.type) &&
      !isBuiltInAgentHostManaged(config.type) &&
      !isRetiredBuiltInAgentId(config.type) &&
      agentTypeSet.has(config.type),
  );
  const resolvedTypeSet = new Set(enabledConfigs.map((config: any) => config.type));
  const builtInFallbackConfigs = BUILT_IN_AGENTS.filter(
    (agent) =>
      agentTypeSet.has(agent.id) &&
      !resolvedTypeSet.has(agent.id) &&
      !isBuiltInAgentRuntimeDisabled(agent.id) &&
      !isBuiltInAgentHostManaged(agent.id) &&
      !isRetiredBuiltInAgentId(agent.id),
  );

  const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
  const gameSceneConnectionId =
    typeof chatMeta.gameSceneConnectionId === "string" ? chatMeta.gameSceneConnectionId.trim() : "";
  const setupSceneConnectionId =
    typeof setupConfig.sceneConnectionId === "string" ? setupConfig.sceneConnectionId.trim() : "";
  const defaultAgentConn = await conns.getDefaultForAgents();
  const fallbackAgentConn = await conns.getFallbackForAgents();
  const wrapRetryAgentProvider = (primary: BaseLLMProvider, primaryConnectionId: string) =>
    withConnectionFallbackProvider({
      primary,
      primaryConnectionId,
      fallbackConnection: fallbackAgentConn,
      fallbackBaseUrl: fallbackAgentConn ? resolveBaseUrl(fallbackAgentConn) : "",
      category: "agents",
      onFallback,
    });
  type RetryAgentConnectionResolution = {
    entry: {
      connectionId: string | null;
      provider: any;
      model: string;
      customParameters: Record<string, unknown>;
      temperature?: number;
      enabledParameters?: GenerationParameterSendMap;
      suppressModelParameters: boolean;
      maxOutputTokens: number | null;
      maxParallelJobs: number;
      enableCaching: boolean;
      anthropicExtendedCacheTtl: boolean;
      cachingAtDepth: number;
    } | null;
    unavailableReason?: string;
    connectionName?: string;
  };
  let connForPromptDefaults: any | null = null;
  const resolveStoredRetryConnection = (
    connectionId: string | null,
    storedConn: any,
  ): RetryAgentConnectionResolution => {
    const model = typeof storedConn.model === "string" ? storedConn.model.trim() : "";
    if (!model) {
      return { entry: null, unavailableReason: "no model is selected", connectionName: storedConn.name };
    }

    const baseUrl = resolveBaseUrl(storedConn);
    if (!baseUrl) {
      return {
        entry: null,
        unavailableReason: "the Base URL is empty or cannot be resolved",
        connectionName: storedConn.name,
      };
    }

    const knownModel = findKnownModel(storedConn.provider as APIProvider, model);
    const storedParameters = parseStoredGenerationParameters(storedConn.defaultParameters);
    connForPromptDefaults ??= storedConn;
    const primaryProvider = createLLMProvider(
      storedConn.provider,
      baseUrl,
      storedConn.apiKey,
      storedConn.maxContext,
      storedConn.openrouterProvider,
      storedConn.maxTokensOverride,
      storedConn.claudeFastMode === "true",
      storedConn.treatAsLocalEndpoint === "true",
      storedConn.defaultParameters,
    );
    return {
      entry: {
        connectionId,
        provider: wrapRetryAgentProvider(primaryProvider, connectionId ?? storedConn.id),
        model,
        customParameters: storedParameters?.customParameters ?? {},
        temperature: storedParameters?.temperature,
        enabledParameters: storedParameters?.enabledParameters,
        suppressModelParameters: shouldSuppressUnknownModelParameters(storedConn.provider, model),
        maxOutputTokens: knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null,
        maxParallelJobs: Number(storedConn.maxParallelJobs) || 1,
        enableCaching: storedConn.enableCaching === "true",
        anthropicExtendedCacheTtl: storedConn.anthropicExtendedCacheTtl === "true",
        cachingAtDepth: Number(storedConn.cachingAtDepth) || 5,
      },
    };
  };
  const resolveFallbackRetryConnection = async (): Promise<RetryAgentConnectionResolution> => {
    let connId =
      typeof chat.connectionId === "string" && chat.connectionId.trim()
        ? chat.connectionId.trim()
        : gameSceneConnectionId || setupSceneConnectionId || defaultAgentConn?.id || null;

    if (!connId) {
      return {
        entry: null,
        unavailableReason: "no chat, game scene, or default agent connection is configured",
      };
    }

    if (connId === "random") {
      const pool = await conns.listRandomPool();
      if (!pool.length) {
        return {
          entry: null,
          unavailableReason: "no connections are marked for the random pool",
        };
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      connId = picked.id;
    }

    const fallbackConn = await conns.getWithKey(connId);
    if (!fallbackConn) {
      return { entry: null, unavailableReason: "the configured fallback connection was deleted" };
    }

    return resolveStoredRetryConnection(null, fallbackConn);
  };
  const fallbackConnection = await resolveFallbackRetryConnection();
  const retryAgentConnectionCache = new Map<string, RetryAgentConnectionResolution>();
  const resolvedAgents: ResolvedRetryAgent[] = [];
  const skippedLocalSidecarAgents: string[] = [];
  const defaultAgentConnectionAgents: string[] = [];
  // Explicit per-agent sidecar selection is valid independently of the global
  // tracker default; the provider starts the configured model on demand.
  const localSidecarAvailableForTrackers = sidecarModelService.getConfiguredModelRef() !== null;
  const unavailableConnectionWarnings = new Map<
    string,
    { reason: string; connectionName?: string; agentNames: string[] }
  >();
  const addUnavailableConnectionWarning = (
    agentName: string,
    resolution: { unavailableReason?: string; connectionName?: string },
  ) => {
    const reason = resolution.unavailableReason ?? "the connection is unavailable";
    const key = `${resolution.connectionName ?? ""}:${reason}`;
    const existing = unavailableConnectionWarnings.get(key);
    if (existing) {
      existing.agentNames.push(agentName);
    } else {
      unavailableConnectionWarnings.set(key, {
        reason,
        connectionName: resolution.connectionName,
        agentNames: [agentName],
      });
    }
  };
  const resolveRetryAgentConnection = async (connectionId: string | null): Promise<RetryAgentConnectionResolution> => {
    if (!connectionId) {
      return fallbackConnection;
    }

    const cachedConnection = retryAgentConnectionCache.get(connectionId);
    if (cachedConnection) return cachedConnection;

    let resolution: RetryAgentConnectionResolution;
    if (isLocalSidecarConnectionId(connectionId) && localSidecarAvailableForTrackers) {
      const primaryProvider = getLocalSidecarProvider();
      resolution = {
        entry: {
          connectionId,
          provider: wrapRetryAgentProvider(primaryProvider, connectionId),
          model: LOCAL_SIDECAR_MODEL,
          customParameters: {},
          temperature: sidecarModelService.getConfig().temperature,
          enabledParameters: { temperature: true },
          suppressModelParameters: false,
          maxOutputTokens: null,
          maxParallelJobs: sidecarModelService.getConfig().maxParallelJobs,
          enableCaching: false,
          anthropicExtendedCacheTtl: false,
          cachingAtDepth: 5,
        },
      };
    } else {
      const agentConn = await conns.getWithKey(connectionId);
      resolution = agentConn
        ? resolveStoredRetryConnection(connectionId, agentConn)
        : { entry: null, unavailableReason: "the configured connection was deleted" };
    }

    retryAgentConnectionCache.set(connectionId, resolution);
    return resolution;
  };
  const defaultAgentConnection = defaultAgentConn
    ? await resolveRetryAgentConnection(defaultAgentConn.id as string)
    : null;

  for (const cfg of enabledConfigs) {
    const effectiveConnectionId = resolveRetryAgentConnectionRequest({
      agentType: cfg.type as string,
      configuredConnectionId: cfg.connectionId as string | null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
      chatMeta,
      localSidecarAvailable: localSidecarAvailableForTrackers,
    });

    if (effectiveConnectionId === "skip-local-sidecar") {
      skippedLocalSidecarAgents.push(cfg.name ?? cfg.type);
      logger.warn(
        "[retry-agents] Skipping agent %s because Local Model was requested but the sidecar is unavailable",
        cfg.type,
      );
      continue;
    }

    const agentConnection = await resolveRetryAgentConnection(effectiveConnectionId);
    if (!agentConnection.entry) {
      addUnavailableConnectionWarning(cfg.name ?? cfg.type, agentConnection);
      logger.warn(
        "[retry-agents] Skipping agent %s because its connection is unavailable: %s",
        cfg.type,
        agentConnection.unavailableReason ?? "unknown reason",
      );
      continue;
    }
    if (defaultAgentConn && effectiveConnectionId === defaultAgentConn.id) {
      defaultAgentConnectionAgents.push(cfg.name ?? cfg.type);
    }

    const settings = resolveEffectiveAgentSettings({
      agentType: cfg.type as string,
      settings: cfg.settings,
      activeMusicPlayerSource,
      chatMetadata: chatMeta,
    });
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      promptTemplate: normalizeProseGuardianPromptTemplate(cfg.type as string, cfg.promptTemplate),
      fallbackPromptTemplate: getAgentFallbackPrompt(cfg.type as string, settings),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[cfg.type as string] ?? null,
    });

    resolvedAgents.push({
      cfg,
      resolved: {
        id: cfg.id,
        type: cfg.type,
        name: cfg.name,
        isCustomAgent: !BUILT_IN_AGENTS.some((agent) => agent.id === cfg.type),
        phase: normalizeAgentPhaseValue(cfg.phase),
        promptTemplate: selectedPromptTemplate,
        connectionId: effectiveConnectionId,
        settings,
        customParameters: agentConnection.entry.customParameters,
        temperature: agentConnection.entry.temperature,
        enabledParameters: agentConnection.entry.enabledParameters,
        suppressModelParameters: agentConnection.entry.suppressModelParameters,
        maxOutputTokens: agentConnection.entry.maxOutputTokens,
        enableCaching: agentConnection.entry.enableCaching,
        anthropicExtendedCacheTtl: agentConnection.entry.anthropicExtendedCacheTtl,
        cachingAtDepth: agentConnection.entry.cachingAtDepth,
        provider: agentConnection.entry.provider,
        model: agentConnection.entry.model,
        maxParallelJobs: agentConnection.entry.maxParallelJobs,
      },
      agentProvider: agentConnection.entry.provider,
      agentModel: agentConnection.entry.model,
    });
  }

  const warnings: AgentConnectionWarning[] = [];

  for (const builtIn of builtInFallbackConfigs) {
    const builtInConnectionId = resolveRetryAgentConnectionRequest({
      agentType: builtIn.id,
      configuredConnectionId: null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
      chatMeta,
      localSidecarAvailable: localSidecarAvailableForTrackers,
    });

    if (builtInConnectionId === "skip-local-sidecar") {
      skippedLocalSidecarAgents.push(builtIn.name);
      logger.warn(
        "[retry-agents] Skipping built-in agent %s because Local Model was requested but the sidecar is unavailable",
        builtIn.id,
      );
      continue;
    }

    const builtInConnection =
      defaultAgentConn && builtInConnectionId === defaultAgentConn.id
        ? defaultAgentConnection
        : await resolveRetryAgentConnection(builtInConnectionId);
    if (!builtInConnection?.entry) {
      addUnavailableConnectionWarning(builtIn.name, builtInConnection ?? {});
      logger.warn(
        "[retry-agents] Skipping built-in agent %s because its connection is unavailable: %s",
        builtIn.id,
        builtInConnection?.unavailableReason ?? "unknown reason",
      );
      continue;
    }
    if (defaultAgentConn && builtInConnectionId === defaultAgentConn.id)
      defaultAgentConnectionAgents.push(builtIn.name);

    const settings = resolveEffectiveAgentSettings({
      agentType: builtIn.id,
      settings: undefined,
      activeMusicPlayerSource,
      chatMetadata: chatMeta,
    });
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      promptTemplate: "",
      fallbackPromptTemplate: getAgentFallbackPrompt(builtIn.id, settings),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[builtIn.id] ?? null,
    });

    resolvedAgents.push({
      cfg: { id: `builtin:${builtIn.id}`, type: builtIn.id, name: builtIn.name } as any,
      resolved: {
        id: `builtin:${builtIn.id}`,
        type: builtIn.id,
        name: builtIn.name,
        isCustomAgent: false,
        phase: normalizeAgentPhaseValue(builtIn.phase),
        promptTemplate: selectedPromptTemplate,
        connectionId: builtInConnection.entry.connectionId,
        settings,
        customParameters: builtInConnection.entry.customParameters,
        temperature: builtInConnection.entry.temperature,
        enabledParameters: builtInConnection.entry.enabledParameters,
        suppressModelParameters: builtInConnection.entry.suppressModelParameters,
        maxOutputTokens: builtInConnection.entry.maxOutputTokens,
        enableCaching: builtInConnection.entry.enableCaching,
        anthropicExtendedCacheTtl: builtInConnection.entry.anthropicExtendedCacheTtl,
        cachingAtDepth: builtInConnection.entry.cachingAtDepth,
        provider: builtInConnection.entry.provider,
        model: builtInConnection.entry.model,
        maxParallelJobs: builtInConnection.entry.maxParallelJobs,
      },
      agentProvider: builtInConnection.entry.provider,
      agentModel: builtInConnection.entry.model,
    });
  }

  for (const warning of unavailableConnectionWarnings.values()) {
    warnings.push(buildAgentConnectionUnavailableWarning(warning));
  }

  if (skippedLocalSidecarAgents.length > 0) {
    warnings.push(buildLocalSidecarUnavailableWarning(skippedLocalSidecarAgents));
  }

  if (defaultAgentConn && defaultAgentConnectionAgents.length > 0) {
    warnings.push(
      buildDefaultAgentConnectionWarning({
        agentNames: defaultAgentConnectionAgents,
        connectionId: defaultAgentConn.id,
        connectionName: defaultAgentConn.name,
        model: String(defaultAgentConn.model ?? "").trim(),
      }),
    );
  }

  return { conn: connForPromptDefaults, enabledConfigs, resolvedAgents, warnings };
}

const retryProviderIds = new WeakMap<object, number>();
let nextRetryProviderId = 0;

function retryProviderKey(provider: unknown): string {
  if ((typeof provider !== "object" && typeof provider !== "function") || provider === null) {
    return `primitive:${String(provider)}`;
  }
  let id = retryProviderIds.get(provider);
  if (id === undefined) {
    id = nextRetryProviderId++;
    retryProviderIds.set(provider, id);
  }
  return `provider:${id}`;
}

async function executeSpotifyRetryToolJson(
  entry: ResolvedRetryAgent,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!entry.resolved.toolContext) return { error: "Spotify tool context is unavailable." };
  const raw = await entry.resolved.toolContext.executeToolCall({
    id: `spotify-retry-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  });
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { raw };
  } catch {
    return { raw };
  }
}

function getSpotifyTracks(data: Record<string, unknown>): Array<{ uri: string; name: string; artist: string }> {
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  return tracks
    .map((track) => {
      if (!track || typeof track !== "object") return null;
      const record = track as Record<string, unknown>;
      const uri = typeof record.uri === "string" ? record.uri : "";
      if (!uri.startsWith("spotify:track:")) return null;
      return {
        uri,
        name: typeof record.name === "string" ? record.name : "Unknown track",
        artist: typeof record.artist === "string" ? record.artist : "",
      };
    })
    .filter((track): track is { uri: string; name: string; artist: string } => track !== null);
}

function buildSpotifyRetryQuery(result: AgentResult, context: AgentContext): { query: string; mood: string } {
  const mood = readSpotifyStringField(result.data, "mood");
  const searchQuery = readSpotifyStringField(result.data, "searchQuery");
  const scene = typeof context.mainResponse === "string" ? context.mainResponse.replace(/\[[^\]]+\]/g, " ") : "";
  const compactScene = scene.replace(/\s+/g, " ").trim().slice(0, 600);
  return {
    query: [searchQuery, mood, compactScene].filter(Boolean).join(" "),
    mood,
  };
}

function isBlockingSpotifyRetryToolError(error: string | null | undefined): error is string {
  return (
    !!error && /(not configured|not connected|token|scope|premium|active spotify device|playback failed)/i.test(error)
  );
}

async function applyDeterministicSpotifyRetryFallback(args: {
  entry: ResolvedRetryAgent;
  result: AgentResult;
  context: AgentContext;
  constraints: Record<string, unknown>;
}): Promise<AgentResult> {
  const { entry, result, context, constraints } = args;
  if (!entry.resolved.toolContext) {
    return { ...result, success: false, error: "Spotify tool context is unavailable." };
  }

  const { query, mood } = buildSpotifyRetryQuery(result, context);
  const current = await executeSpotifyRetryToolJson(entry, "spotify_get_current_playback", {});
  const currentUri = readSpotifyPlaybackTrackUri(current) ?? "";

  const artist = typeof constraints.artist === "string" ? constraints.artist.trim() : "";
  const sourceType = typeof constraints.sourceType === "string" ? constraints.sourceType : "liked";
  const playlistId =
    typeof constraints.playlistId === "string" && constraints.playlistId.trim()
      ? constraints.playlistId.trim()
      : sourceType === "playlist"
        ? ""
        : "liked";

  let sourceResult: Record<string, unknown>;
  if (artist) {
    sourceResult = await executeSpotifyRetryToolJson(entry, "spotify_search", {
      query: [`artist:"${artist}"`, query || mood || "instrumental scene music"].filter(Boolean).join(" "),
      limit: 20,
    });
  } else {
    sourceResult = await executeSpotifyRetryToolJson(entry, "spotify_get_playlist_tracks", {
      playlistId: playlistId || "liked",
      query: query || mood || "scene instrumental",
      mood: mood || undefined,
      candidateLimit: 40,
    });
  }

  const tracks = getSpotifyTracks(sourceResult);
  if (tracks.length === 0) {
    const sourceError = typeof sourceResult.error === "string" ? sourceResult.error : "No Spotify candidates found.";
    return { ...result, success: false, error: sourceError };
  }

  const picked = tracks.find((track) => track.uri !== currentUri) ?? tracks[0]!;
  const play = await executeSpotifyRetryToolJson(entry, "spotify_play", {
    uri: picked.uri,
    reason: "Manual Music DJ Spotify retry fallback",
  });
  if (play.applied !== true) {
    const playError = typeof play.error === "string" ? play.error : "Spotify play did not apply playback.";
    return { ...result, success: false, error: playError };
  }
  const playbackPending = play.playbackPending === true;
  const playedUri = readSpotifyPlaybackTrackUri(play);
  if (!playbackPending && playedUri !== picked.uri) {
    return {
      ...result,
      success: false,
      error: "Spotify accepted the retry, but the active track did not change to the selected song.",
    };
  }
  const repeatState = readSpotifyStringField(play, "repeatState") || readSpotifyStringField(play, "repeat");
  if (!playbackPending && repeatState && repeatState !== "track") {
    return {
      ...result,
      success: false,
      error: `Spotify accepted the retry, but repeat-track did not stick (current repeat: ${repeatState}).`,
    };
  }

  return {
    ...result,
    success: true,
    error: null,
    data: {
      action: "play",
      mood: mood || null,
      searchQuery: query || null,
      trackUris: [picked.uri],
      trackNames: [`${picked.name}${picked.artist ? ` — ${picked.artist}` : ""}`],
      volume: null,
      deterministicFallbackApplied: true,
      repeat: play.repeat ?? null,
      repeatState: repeatState || null,
      currentUri: playedUri ?? null,
      device: readSpotifyStringField(play, "device") || null,
      display: readSpotifyStringField(play, "display") || null,
      playbackPending,
    },
  };
}

export async function validateSpotifyRetryPlayback(
  entry: ResolvedRetryAgent,
  result: AgentResult,
  context: AgentContext,
): Promise<AgentResult> {
  if (entry.resolved.type !== "spotify") return result;
  if (result.type !== "spotify_control") return result;
  const spotifyAgent = entry.resolved as SpotifyRuntimeAgent;
  const spotifyToolError = spotifyAgent.__spotifyToolError;
  if (isBlockingSpotifyRetryToolError(spotifyToolError)) {
    return { ...result, success: false, error: spotifyToolError };
  }

  const constraints =
    context.memory._spotifyDjConstraints && typeof context.memory._spotifyDjConstraints === "object"
      ? (context.memory._spotifyDjConstraints as Record<string, unknown>)
      : {};
  const forceFreshPick = constraints.manualRetry === true || constraints.forceFreshPick === true;
  if (!forceFreshPick) return result;

  const toolCalls = spotifyAgent.__spotifyToolCalls;
  const spotifyPlayCalled = toolCalls instanceof Set && toolCalls.has("spotify_play");
  const spotifyPlayApplied = spotifyAgent.__spotifyPlayApplied === true;
  const spotifyPlayError = spotifyAgent.__spotifyPlayError;
  const spotifyPlayUris = Array.isArray(spotifyAgent.__spotifyPlayUris) ? spotifyAgent.__spotifyPlayUris : [];
  const spotifyPlayUri = spotifyPlayUris.length === 1 ? spotifyPlayUris[0] : null;
  const spotifyPlayIsSingleTrack = !!spotifyPlayUri && spotifyPlayUri.startsWith("spotify:track:");
  const currentBeforePlay = spotifyAgent.__spotifyCurrentBeforePlayUri;
  const currentAfterPlay = spotifyAgent.__spotifyCurrentAfterPlayUri;
  const repeatAfterPlay = spotifyAgent.__spotifyRepeatAfterPlayState;
  const playbackPending = spotifyAgent.__spotifyPlaybackPending === true;
  if (constraints.mode !== "game" && spotifyPlayCalled && spotifyPlayApplied) {
    return result;
  }

  if (
    spotifyPlayCalled &&
    spotifyPlayApplied &&
    spotifyPlayIsSingleTrack &&
    currentBeforePlay !== spotifyPlayUri &&
    currentAfterPlay === spotifyPlayUri &&
    (!repeatAfterPlay || repeatAfterPlay === "track")
  ) {
    return result;
  }

  if (spotifyPlayCalled && spotifyPlayApplied && playbackPending) {
    return {
      ...result,
      success: true,
      error: null,
      data:
        result.data && typeof result.data === "object"
          ? {
              ...(result.data as Record<string, unknown>),
              playbackPending: true,
              toolPlaybackApplied: true,
              currentUri: currentAfterPlay ?? null,
              repeatState: repeatAfterPlay || null,
            }
          : {
              action: "play",
              trackUris: spotifyPlayUris,
              playbackPending: true,
              toolPlaybackApplied: true,
              currentUri: currentAfterPlay ?? null,
              repeatState: repeatAfterPlay || null,
            },
    };
  }

  if (spotifyPlayCalled && spotifyPlayApplied) {
    return applyDeterministicSpotifyRetryFallback({ entry, result, context, constraints });
  }

  const uris = readSpotifyTrackUris(result.data);
  const requestedTrackUri = uris.find((uri) => uri.startsWith("spotify:track:")) ?? null;
  if (!spotifyPlayCalled && result.success && requestedTrackUri && entry.resolved.toolContext) {
    const fallbackResult = await entry.resolved.toolContext.executeToolCall({
      id: `spotify-retry-fallback-${Date.now()}`,
      type: "function",
      function: {
        name: "spotify_play",
        arguments: JSON.stringify({
          uri: requestedTrackUri,
          reason: "Manual Music DJ Spotify retry fallback",
        }),
      },
    });
    try {
      const parsed = JSON.parse(fallbackResult) as Record<string, unknown>;
      if (parsed.applied === true) {
        const fallbackCurrentBefore = spotifyAgent.__spotifyCurrentBeforePlayUri;
        const fallbackPlayedUri = readSpotifyPlaybackTrackUri(parsed);
        const fallbackRepeatState =
          readSpotifyStringField(parsed, "repeatState") || readSpotifyStringField(parsed, "repeat");
        const fallbackPlaybackPending = parsed.playbackPending === true;
        if (
          !fallbackPlaybackPending &&
          (fallbackCurrentBefore === requestedTrackUri ||
            fallbackPlayedUri !== requestedTrackUri ||
            (fallbackRepeatState && fallbackRepeatState !== "track"))
        ) {
          return applyDeterministicSpotifyRetryFallback({ entry, result, context, constraints });
        }
        return {
          ...result,
          data:
            result.data && typeof result.data === "object"
              ? {
                  ...(result.data as Record<string, unknown>),
                  toolFallbackApplied: true,
                  currentUri: fallbackPlayedUri,
                  repeatState: fallbackRepeatState || null,
                  playbackPending: fallbackPlaybackPending,
                }
              : {
                  action: "play",
                  trackUris: [requestedTrackUri],
                  toolFallbackApplied: true,
                  currentUri: fallbackPlayedUri,
                  repeatState: fallbackRepeatState || null,
                  playbackPending: fallbackPlaybackPending,
                },
        };
      }
      if (typeof parsed.error === "string") {
        return { ...result, success: false, error: parsed.error };
      }
    } catch {
      // Fall through to explicit failure below.
    }
  }

  if (!spotifyPlayCalled) {
    return applyDeterministicSpotifyRetryFallback({ entry, result, context, constraints });
  }

  return {
    ...result,
    success: false,
    error:
      typeof spotifyPlayError === "string" && spotifyPlayError.trim()
        ? spotifyPlayError
        : "Music DJ Spotify retry finished without applying spotify_play.",
  };
}

function isImagePromptRetryAgent(entry: ResolvedRetryAgent): boolean {
  return (
    entry.resolved.type === "illustrator" ||
    (entry.resolved.isCustomAgent === true &&
      customAgentHasCapability(entry.resolved.settings, "trigger_image_generation"))
  );
}

async function resolveRetryImagePromptContext(args: {
  entry: ResolvedRetryAgent;
  context: AgentContext;
  conns?: ReturnType<typeof createConnectionsStorage>;
  chatMode?: ChatMode;
  chatMeta?: Record<string, unknown>;
}): Promise<AgentContext> {
  const memory = { ...args.context.memory };
  delete memory._imagePromptInstructions;

  if (!args.conns || !args.chatMode || !args.chatMeta) {
    return { ...args.context, memory };
  }

  const imageConnectionId =
    args.entry.resolved.type === "illustrator"
      ? resolveIllustratorImageConnectionId(
          args.chatMode,
          args.chatMeta,
          args.entry.resolved.settings.imageConnectionId,
        )
      : typeof args.entry.resolved.settings.imageConnectionId === "string"
        ? args.entry.resolved.settings.imageConnectionId.trim()
        : "";
  let imageConnection = imageConnectionId ? await args.conns.getById(imageConnectionId).catch(() => null) : null;
  imageConnection ??= await args.conns.getDefaultForImageGeneration().catch(() => null);
  const imagePromptInstructions = normalizeImagePromptInstructions(imageConnection?.imagePromptInstructions);
  if (imagePromptInstructions) memory._imagePromptInstructions = imagePromptInstructions;
  return { ...args.context, memory };
}

async function executeRetryBatches(
  agentContext: AgentContext,
  resolvedAgents: ResolvedRetryAgent[],
  preGenerationContext?: AgentContext | null,
  conns?: ReturnType<typeof createConnectionsStorage>,
  chatMode?: ChatMode,
  chatMeta?: Record<string, unknown>,
  customLorebookReadBehindContexts: ReadonlyMap<string, AgentContext> = new Map(),
) {
  const retryAgents = mergeRetryPairedBuiltInRewriteAgents(resolvedAgents);
  const effectiveChatMode: ChatMode = chatMode ?? (agentContext.chatMode as ChatMode);
  const attachLorebooksToTrackers = effectiveChatMode === "roleplay" && chatMeta?.attachLorebooksToTrackers === true;
  const trackerAgentTypes = getTrackerAgentTypes();
  const providerModelGroups = new Map<
    string,
    { agents: ResolvedRetryAgent[]; provider: any; model: string; context: AgentContext; maxParallelJobs: number }
  >();

  for (const entry of retryAgents) {
    const phaseContext =
      preGenerationContext && entry.resolved.phase === "pre_generation" ? preGenerationContext : agentContext;
    const baseContext = customLorebookReadBehindContexts.get(entry.resolved.id) ?? phaseContext;
    const isTracker = trackerAgentTypes.has(entry.resolved.type);
    const context = applyTrackerLorebookContextPolicy({
      context: baseContext,
      chatMode: effectiveChatMode,
      isTracker,
      attachLorebooksToTrackers,
    });
    const baseContextKind = customLorebookReadBehindContexts.has(entry.resolved.id)
      ? `read-behind:${entry.resolved.batchContextKey ?? entry.resolved.id}`
      : baseContext === preGenerationContext
        ? "pre_generation"
        : "default";
    const contextKind =
      effectiveChatMode === "roleplay" && isTracker
        ? appendTrackerLorebookBatchContextKey(baseContextKind, attachLorebooksToTrackers)
        : baseContextKind;
    const key = `${retryProviderKey(entry.agentProvider)}::${entry.agentModel}::${contextKind}::${getAgentBatchLane(entry.resolved)}`;
    if (!providerModelGroups.has(key)) {
      providerModelGroups.set(key, {
        agents: [],
        provider: entry.agentProvider,
        model: entry.agentModel,
        context,
        maxParallelJobs: normalizeAgentMaxParallelJobs(entry.resolved.maxParallelJobs),
      });
    } else {
      const group = providerModelGroups.get(key)!;
      group.maxParallelJobs = Math.max(
        group.maxParallelJobs,
        normalizeAgentMaxParallelJobs(entry.resolved.maxParallelJobs),
      );
    }
    providerModelGroups.get(key)!.agents.push(entry);
  }

  const jobGroups = [...providerModelGroups.values()].flatMap((group) => {
    const jobCount = Math.min(normalizeAgentMaxParallelJobs(group.maxParallelJobs), group.agents.length);
    if (jobCount <= 1) return [group];
    const chunks = Array.from({ length: jobCount }, () => [] as ResolvedRetryAgent[]);
    for (let index = 0; index < group.agents.length; index++) {
      chunks[index % jobCount]!.push(group.agents[index]!);
    }
    return chunks
      .filter((agents) => agents.length > 0)
      .map((agents) => ({
        ...group,
        agents,
      }));
  });

  if (jobGroups.length > AGENT_PHASE_MAX_CONCURRENT_GROUPS) {
    logger.warn(
      "[retry-agents] Limiting %d job groups to %d concurrent agent request group(s)",
      jobGroups.length,
      AGENT_PHASE_MAX_CONCURRENT_GROUPS,
    );
  }

  const results: AgentResult[] = [];
  const groupSettled = await settleAgentJobsWithConcurrencyLimit(
    jobGroups,
    AGENT_PHASE_MAX_CONCURRENT_GROUPS,
    async (group) => {
      const toolAgents = group.agents.filter((agent) => shouldUseToolsDuringAgentExecution(agent.resolved));
      const batchAgents = group.agents.filter((agent) => !shouldUseToolsDuringAgentExecution(agent.resolved));
      const imagePromptAgents = batchAgents.filter(isImagePromptRetryAgent);
      const regularBatchAgents = batchAgents.filter((agent) => !isImagePromptRetryAgent(agent));
      const groupResults: AgentResult[] = [];

      if (regularBatchAgents.length > 0) {
        const configs = regularBatchAgents.map((agent) => agent.resolved);
        const batchResults = await executeAgentBatch(configs, group.context, group.provider, group.model);
        for (const result of batchResults) {
          const entry = regularBatchAgents.find(
            (agent) => agent.resolved.id === result.agentId || agent.resolved.type === result.agentType,
          );
          groupResults.push(
            entry?.resolved.type === "spotify"
              ? await validateSpotifyRetryPlayback(entry, result, group.context)
              : result,
          );
        }
      }

      for (const entry of imagePromptAgents) {
        const imagePromptContext = await resolveRetryImagePromptContext({
          entry,
          context: group.context,
          conns,
          chatMode,
          chatMeta,
        });
        groupResults.push(
          await executeAgent(
            entry.resolved,
            imagePromptContext,
            group.provider,
            group.model,
            entry.resolved.toolContext,
          ),
        );
      }

      for (const entry of toolAgents) {
        const toolContext = isImagePromptRetryAgent(entry)
          ? await resolveRetryImagePromptContext({ entry, context: group.context, conns, chatMode, chatMeta })
          : group.context;
        const result = await executeAgent(
          entry.resolved,
          toolContext,
          group.provider,
          group.model,
          entry.resolved.toolContext,
        );
        groupResults.push(await validateSpotifyRetryPlayback(entry, result, group.context));
      }

      return groupResults;
    },
  );

  for (const outcome of groupSettled) {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      logger.error(outcome.reason, "[retry-agents] Group failed");
    }
  }

  return results;
}

function mergeRetryPairedBuiltInRewriteAgents(entries: ResolvedRetryAgent[]): ResolvedRetryAgent[] {
  const builtInRewriteEntries = entries.filter((entry) => isBuiltInTextRewriteAgentType(entry.resolved.type));
  if (builtInRewriteEntries.length <= 1) return entries;

  const firstMergeIndex = Math.min(...builtInRewriteEntries.map((entry) => entries.indexOf(entry)));
  const mergedResolved = mergePairedBuiltInRewriteAgents(builtInRewriteEntries.map((entry) => entry.resolved))[0];
  if (!mergedResolved) return entries;
  const mergedEntry: ResolvedRetryAgent = {
    ...builtInRewriteEntries[0]!,
    resolved: mergedResolved,
  };

  const merged: ResolvedRetryAgent[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (index === firstMergeIndex) merged.push(mergedEntry);
    if (isBuiltInTextRewriteAgentType(entry.resolved.type)) continue;
    merged.push(entry);
  }
  return merged;
}

async function persistRetryResults(
  agentsStore: ReturnType<typeof createAgentsStorage>,
  chatId: string,
  messageId: string,
  results: AgentResult[],
  messageIdsByAgentId: ReadonlyMap<string, string> = new Map(),
  signal?: AbortSignal,
) {
  for (const result of results) {
    if (signal?.aborted) return;
    if (result.agentType === "illustrator" || result.type === "image_prompt") continue;
    try {
      await agentsStore.saveRun({
        agentConfigId: result.agentId,
        chatId,
        messageId: messageIdsByAgentId.get(result.agentId) ?? messageId,
        result,
      });
    } catch {
      // Non-critical write; keep streaming the rest of the results.
    }
  }
}

async function executeLorebookKeeperRetries(args: {
  lorebookKeeperAgent: ResolvedRetryAgent;
  baseContext: AgentContext;
  messages: any[];
  readBehindMessages: number;
  lastProcessedMessageId: string | null;
  backfillUnprocessed: boolean;
  lorebooksStore: ReturnType<typeof createLorebooksStorage>;
  chatId: string;
  chatName: string | null | undefined;
  requireApproval: boolean;
}): Promise<Array<{ messageId: string; swipeIndex: number; result: AgentResult }>> {
  const {
    lorebookKeeperAgent,
    baseContext,
    messages,
    readBehindMessages,
    lastProcessedMessageId,
    backfillUnprocessed,
    lorebooksStore,
    chatId,
    chatName,
    requireApproval,
  } = args;

  const eligibleTargets = getLorebookKeeperBackfillTargets(messages, readBehindMessages, lastProcessedMessageId);
  const targets = backfillUnprocessed ? eligibleTargets : eligibleTargets.slice(-1);
  if (targets.length === 0) return [];

  let preferredTargetLorebookId =
    typeof baseContext.memory._lorebookKeeperTargetLorebookId === "string"
      ? (baseContext.memory._lorebookKeeperTargetLorebookId as string)
      : null;

  const results: Array<{ messageId: string; swipeIndex: number; result: AgentResult }> = [];
  for (const target of targets) {
    if (baseContext.signal?.aborted) return results;
    const startedAt = Date.now();
    try {
      const retryContext = buildHistoricalLorebookKeeperContext(baseContext, messages, target.id);
      if (!retryContext) continue;

      if (preferredTargetLorebookId) {
        retryContext.memory._lorebookKeeperTargetLorebookId = preferredTargetLorebookId;
      }
      const existingEntries = await loadLorebookKeeperExistingEntries(lorebooksStore, preferredTargetLorebookId);
      if (baseContext.signal?.aborted) return results;
      if (existingEntries.length > 0) {
        retryContext.memory._existingLorebookEntries = existingEntries;
      }

      const rawResult = await executeAgent(
        lorebookKeeperAgent.resolved,
        retryContext,
        lorebookKeeperAgent.agentProvider,
        lorebookKeeperAgent.agentModel,
      );
      if (baseContext.signal?.aborted) return results;
      const result = requireApproval
        ? markRetryLorebookResultForApproval({
            result: rawResult,
            chatId,
            chatName,
            agentContext: retryContext,
            resolvedAgents: [lorebookKeeperAgent],
          })
        : rawResult;

      if (
        result.success &&
        result.type === "lorebook_update" &&
        result.data &&
        typeof result.data === "object" &&
        !isAgentWriteApprovalEnvelope(result.data)
      ) {
        const lkData = result.data as Record<string, unknown>;
        const updates = (lkData.updates as Array<Record<string, unknown>>) ?? [];
        if (updates.length > 0) {
          if (baseContext.signal?.aborted) return results;
          preferredTargetLorebookId = await persistLorebookKeeperUpdates({
            lorebooksStore,
            chatId,
            chatName,
            preferredTargetLorebookId,
            writableLorebookIds: retryContext.writableLorebookIds,
            writableLorebooks: Array.isArray(retryContext.memory._writableLorebooks)
              ? (retryContext.memory._writableLorebooks as Array<{ id: string; name: string }>)
              : undefined,
            lorebookNamingScheme: getLorebookNamingScheme(lorebookKeeperAgent.resolved.settings),
            worldName: retryContext.characters[0]?.world ?? chatName,
            updates,
            signal: baseContext.signal,
          });
          if (baseContext.signal?.aborted) return results;
        }
      }

      if (baseContext.signal?.aborted) return results;
      results.push({ ...resolveLorebookKeeperRetryAnchor(target), result });
    } catch (err) {
      if (baseContext.signal?.aborted) return results;
      logger.error(err, "[retry-agents] Lorebook Keeper retry failed for target message %s", target.id);
      results.push({
        ...resolveLorebookKeeperRetryAnchor(target),
        result: {
          agentId: lorebookKeeperAgent.resolved.id,
          agentType: lorebookKeeperAgent.resolved.type,
          type: "lorebook_update",
          data: null,
          tokensUsed: 0,
          durationMs: Date.now() - startedAt,
          success: false,
          error: err instanceof Error ? err.message : "Lorebook Keeper failed",
        },
      });
    }
  }

  return results;
}

async function applyRetryResultEffects(args: {
  app: FastifyInstance;
  reply: any;
  chatId: string;
  chat: any;
  retryMessageId: string;
  retrySwipeIndex: number;
  generationId: string;
  results: AgentResult[];
  agentContext: AgentContext;
  /** Raw (unresolved) stored content of the message being retried, used as the
   *  stale-edit baseline so macros in the message do not falsely trip the guard. */
  mainResponseRaw: string;
  lorebooksStore: ReturnType<typeof createLorebooksStorage>;
  gameStateStore: ReturnType<typeof createGameStateStorage>;
  conns: ReturnType<typeof createConnectionsStorage>;
  chars: ReturnType<typeof createCharactersStorage>;
  resolvedAgents: ResolvedRetryAgent[];
  queueImageGenerationRequests: boolean;
  reviewImagePromptsBeforeSend: boolean;
  illustratorPromptReviewOverride: IllustratorPromptReviewOverride | null;
  illustratorRetryTargets: IllustratorRetryTarget[] | undefined;
  forceImageGeneration: boolean;
  debugMode: boolean;
  secretPlotRerollMode?: "full" | "turn_only";
  signal: AbortSignal;
  onLorebookEffectStatus?: (agentId: string, status: RetryLorebookEffectStatus) => void;
}) {
  const {
    app,
    reply,
    chatId,
    chat,
    retryMessageId,
    retrySwipeIndex,
    generationId,
    results,
    agentContext,
    mainResponseRaw,
    lorebooksStore,
    gameStateStore,
    conns,
    chars,
    resolvedAgents,
    queueImageGenerationRequests,
    reviewImagePromptsBeforeSend,
    illustratorPromptReviewOverride,
    illustratorRetryTargets,
    forceImageGeneration,
    debugMode,
    secretPlotRerollMode,
    signal,
    onLorebookEffectStatus,
  } = args;
  const assertRetryActive = () => signal.throwIfAborted();
  assertRetryActive();
  const sortedResults = [...results].sort(
    (a, b) => (a.type === "game_state_update" ? 0 : 1) - (b.type === "game_state_update" ? 0 : 1),
  );
  const chats = createChatsStorage(app.db);
  const agentsStore = createAgentsStorage(app.db);
  const chatMeta = parseExtra(chat.metadata) as Record<string, unknown>;
  const isManualIllustratorBackgroundRequest = isExclusiveIllustratorRetryTarget(illustratorRetryTargets, "background");
  const isManualIllustratorImageRequest = isExclusiveIllustratorRetryTarget(illustratorRetryTargets, "illustration");
  let currentResponseForRewrite = agentContext.mainResponse;
  const retryOwnerSpatialProjection =
    (retryMessageId
      ? await resolveOwnerSpatialProjection(
          chatId,
          {
            exactAnchor: { messageId: retryMessageId, swipeIndex: retrySwipeIndex },
          },
          chatMeta,
        )
      : null) ??
    (retryMessageId
      ? await resolveOwnerSpatialProjection(chatId, { throughMessageId: retryMessageId }, chatMeta)
      : await resolveOwnerSpatialProjection(chatId, {}, chatMeta));
  assertRetryActive();
  const retryCompatibilityLocation =
    retryOwnerSpatialProjection?.ownerMode === "game"
      ? formatOwnerSpatialBreadcrumb(retryOwnerSpatialProjection)
      : null;
  const originalResponseBeforeRewrite = agentContext.mainResponse;
  // Stale-edit baseline tracked in the raw (unresolved) domain to match the
  // stored message content. `currentResponseForRewrite` is macro-resolved, so
  // comparing it against the raw stored content falsely trips on any message
  // containing literal {{...}} macros.
  let expectedStoredMessageContent = mainResponseRaw;
  let retryBaseGameStateSnapshotPromise: ReturnType<typeof gameStateStore.getForGeneration> | null = null;
  const loadRetryBaseGameStateSnapshot = async () => {
    assertRetryActive();
    retryBaseGameStateSnapshotPromise ??= gameStateStore
      .getForGeneration(chatId, {
        preferLatestVisible: true,
        visibleAnchor: retryMessageId ? { messageId: retryMessageId, swipeIndex: retrySwipeIndex } : null,
        excludeMessageId: retryMessageId || null,
      })
      .then((snapshot) => projectGameSnapshotLocation(snapshot, retryOwnerSpatialProjection));
    const snapshot = await retryBaseGameStateSnapshotPromise;
    assertRetryActive();
    return snapshot;
  };
  const buildSnapshotUpdateOptions = async () => {
    const baseSnapshot = await loadRetryBaseGameStateSnapshot();
    assertRetryActive();
    return {
      baseSnapshot,
      ...(retryCompatibilityLocation !== null ? { compatibilityLocation: retryCompatibilityLocation } : {}),
    };
  };
  const loadRetryTargetGameStateSnapshot = async () => {
    assertRetryActive();
    if (!retryMessageId) {
      const latest = await gameStateStore.getLatest(chatId);
      assertRetryActive();
      if (latest) return projectGameSnapshotLocation(latest, retryOwnerSpatialProjection);

      assertRetryActive();
      await gameStateStore.create({
        chatId,
        messageId: "",
        swipeIndex: 0,
        date: null,
        time: null,
        location: retryCompatibilityLocation,
        weather: null,
        temperature: null,
        worldCustomFields: [],
        presentCharacters: [],
        recentEvents: [],
        playerStats: null,
        personaStats: null,
        fieldLocks: null,
        hiddenTrackerFields: null,
      });
      assertRetryActive();
      const created = await gameStateStore.getLatest(chatId);
      assertRetryActive();
      return projectGameSnapshotLocation(created, retryOwnerSpatialProjection);
    }
    const existing = await gameStateStore.getByMessage(retryMessageId, retrySwipeIndex);
    assertRetryActive();
    if (existing) return projectGameSnapshotLocation(existing, retryOwnerSpatialProjection);
    const updateOptions = await buildSnapshotUpdateOptions();
    assertRetryActive();
    const created = await gameStateStore.updateByMessage(
      retryMessageId,
      retrySwipeIndex,
      chatId,
      {},
      undefined,
      updateOptions,
    );
    assertRetryActive();
    return created;
  };
  const updateRetryTargetGameStateSnapshot = async (fields: Record<string, unknown>) => {
    assertRetryActive();
    if (retryMessageId) {
      const updateOptions = await buildSnapshotUpdateOptions();
      assertRetryActive();
      const updated = await gameStateStore.updateByMessage(
        retryMessageId,
        retrySwipeIndex,
        chatId,
        fields as any,
        undefined,
        updateOptions,
      );
      assertRetryActive();
      return updated;
    }
    await loadRetryTargetGameStateSnapshot();
    assertRetryActive();
    const updated = await gameStateStore.updateLatest(chatId, fields as any);
    assertRetryActive();
    return updated;
  };

  for (const result of sortedResults) {
    if (signal.aborted) return;
    if (result.success && result.type === "text_rewrite" && result.data && typeof result.data === "object") {
      try {
        const rewriteData = result.data as Record<string, unknown>;
        const editedText = typeof rewriteData.editedText === "string" ? rewriteData.editedText : "";
        const changes = Array.isArray(rewriteData.changes)
          ? (rewriteData.changes as Array<{ description: string }>)
          : [{ description: "Rewrote the assistant response." }];
        const editNeededValue = rewriteData.editNeeded;
        const strictEditNeeded = isBuiltInTextRewriteAgentType(result.agentType);
        const rewriteAllowed =
          editNeededValue === false ? false : strictEditNeeded ? explicitlyRequestsTextRewrite(editNeededValue) : true;
        const droppedProtectedMarkup =
          strictEditNeeded && textRewriteDropsProtectedMarkup(currentResponseForRewrite, editedText);
        if (droppedProtectedMarkup) {
          logger.warn(
            "[retry-agents] Skipping %s rewrite because it dropped protected markup from message %s",
            result.agentType,
            retryMessageId,
          );
        }
        const changedMessage =
          rewriteAllowed &&
          !droppedProtectedMarkup &&
          editedText.trim().length > 0 &&
          editedText !== currentResponseForRewrite;
        if (retryMessageId && changedMessage) {
          const currentMessage = await chats.getMessage(retryMessageId);
          assertRetryActive();
          if ((currentMessage?.content ?? "") !== expectedStoredMessageContent) {
            logger.info(
              "[retry-agents] Skipping rewrite for message %s because the message was edited during agent retry",
              retryMessageId,
            );
            // Skip only this stale rewrite — later results (tracker, quest, persona,
            // cyoa, illustrator, sprite) must still be applied.
            continue;
          }
          currentResponseForRewrite = editedText;
          // We just wrote editedText, so that becomes the new expected stored content.
          expectedStoredMessageContent = editedText;
          assertRetryActive();
          await chats.updateMessageContent(retryMessageId, editedText);
          assertRetryActive();
          const originalText = strictEditNeeded ? originalResponseBeforeRewrite : null;
          if (originalText) {
            assertRetryActive();
            await chats.updateMessageExtra(retryMessageId, {
              proseGuardianOriginalText: originalText,
              proseGuardianRewrittenText: editedText,
              proseGuardianRewrittenAt: new Date().toISOString(),
            });
            assertRetryActive();
          }
          assertRetryActive();
          sendSseEvent(reply, {
            type: "text_rewrite",
            data: {
              editedText,
              changes,
              rewriteApplied: true,
              ...(originalText ? { originalText, agentType: result.agentType } : {}),
            },
          });
        }
      } catch (err) {
        assertRetryActive();
        logger.warn(err, "[retry-agents] Failed to apply text rewrite");
      }
    }

    if (
      result.success &&
      result.type === "game_state_update" &&
      result.agentType !== "combat" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const gs = result.data as Record<string, unknown>;
        const proposedWorldStatePatch: Record<string, unknown> = {};
        if (gs.date != null) proposedWorldStatePatch.date = gs.date as string;
        if (gs.time != null) proposedWorldStatePatch.time = gs.time as string;
        if (gs.location != null) proposedWorldStatePatch.location = gs.location as string;
        if (gs.weather != null) proposedWorldStatePatch.weather = gs.weather as string;
        if (gs.temperature != null) proposedWorldStatePatch.temperature = gs.temperature as string;
        if (gs.worldCustomFields !== undefined)
          proposedWorldStatePatch.worldCustomFields = normalizeWorldCustomFields(gs.worldCustomFields);
        if (retryCompatibilityLocation !== null && gs.location != null) {
          logger.debug("[retry-agents] Ignoring generated Game location for spatially authoritative chat %s", chatId);
        }
        const worldStatePatch = omitAuthoritativeGameLocation(proposedWorldStatePatch, retryOwnerSpatialProjection);
        const lockSnapshot = (await loadRetryTargetGameStateSnapshot()) ?? (await loadRetryBaseGameStateSnapshot());
        assertRetryActive();
        const lockedWorldStatePatch = applyTrackerFieldLocksToGameStatePatch(
          worldStatePatch,
          lockSnapshot ? parseGameStateRow(lockSnapshot as Record<string, unknown>) : null,
        );
        if (retryCompatibilityLocation !== null) {
          lockedWorldStatePatch.location = retryCompatibilityLocation;
        }
        if (Object.keys(worldStatePatch).length > 0 || retryCompatibilityLocation !== null) {
          await updateRetryTargetGameStateSnapshot(lockedWorldStatePatch);
          assertRetryActive();
        }

        const nextLocation = typeof lockedWorldStatePatch.location === "string" ? lockedWorldStatePatch.location : null;
        if (retryCompatibilityLocation === null) {
          const existingGameMap = (chatMeta.gameMap as GameMap | null) ?? null;
          const syncedMeta = syncGameMapMetaPartyPosition(chatMeta, nextLocation);
          const syncedGameMap = (syncedMeta.gameMap as GameMap | null) ?? null;
          if (syncedGameMap && syncedGameMap !== existingGameMap) {
            Object.assign(chatMeta, syncedMeta);
            assertRetryActive();
            await chats.updateMetadata(chatId, chatMeta);
            assertRetryActive();
            sendSseEvent(reply, { type: "game_map_update", data: syncedGameMap });
          }
        }

        assertRetryActive();
        sendSseEvent(reply, { type: "game_state_patch", data: lockedWorldStatePatch });
      } catch (err) {
        assertRetryActive();
        logger.error(err, "[retry-agents] Failed to apply world-state tracker update");
      }
    }

    // Keep message.extra.contextInjections in sync when retrying agents that emit injectable text,
    // so regenerate/swipe replays the edited or re-run snippet instead of stale cache.
    if (
      retryMessageId &&
      result.success &&
      result.agentType !== "beholder" &&
      (result.type === "context_injection" || result.type === "director_event")
    ) {
      const text =
        typeof result.data === "string"
          ? result.data
          : result.data && typeof result.data === "object"
            ? String((result.data as { text?: string }).text ?? "")
            : "";
      try {
        const msg = await chats.getMessage(retryMessageId);
        assertRetryActive();
        if (msg) {
          const extra = parseExtra(msg.extra) as Record<string, unknown>;
          let list = normalizeContextInjections(extra.contextInjections).filter(
            (entry) => entry.agentType !== "secret-plot-driver",
          );
          const trimmedText = text.trim();
          if (trimmedText) {
            const agentName = resolvedAgents.find((entry) => entry.resolved.type === result.agentType)?.cfg.name;
            const entry = { agentType: result.agentType, agentName, text: trimmedText };
            const idx = list.findIndex((e) => e.agentType === result.agentType);
            if (idx >= 0) list[idx] = entry;
            else list.push(entry);
          } else {
            list = list.filter((e) => e.agentType !== result.agentType);
          }
          const chatSummaryFingerprint = fingerprintChatSummary(chatMeta.summary);
          assertRetryActive();
          await chats.updateMessageExtraForSwipe(retryMessageId, retrySwipeIndex, {
            contextInjections: list,
            chatSummaryFingerprint,
          });
          assertRetryActive();
        }
      } catch {
        assertRetryActive();
        /* non-critical */
      }
    }

    if (
      result.success &&
      result.type === "character_tracker_update" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const ctData = result.data as Record<string, unknown>;
        if (!Array.isArray(ctData.presentCharacters) || ctData.presentCharacters.length === 0) {
          logger.debug("[retry-agents] character-tracker emitted no presentCharacters; keeping existing snapshot");
          continue;
        }
        let presentCharacters = ctData.presentCharacters as any[];
        const previousSnapshot = await loadRetryTargetGameStateSnapshot();
        assertRetryActive();
        let previousCharacters: any[] = [];
        if (previousSnapshot?.presentCharacters) {
          try {
            const parsed =
              typeof previousSnapshot.presentCharacters === "string"
                ? JSON.parse(previousSnapshot.presentCharacters)
                : previousSnapshot.presentCharacters;
            previousCharacters = Array.isArray(parsed) ? parsed : [];
          } catch {
            previousCharacters = [];
          }
        }
        applyTrackerCharacterCardIdentity(presentCharacters, agentContext.characters);
        preserveTrackerCharacterUiFields(presentCharacters, previousCharacters);
        preserveTrackerCharacterUiFields(
          presentCharacters,
          (agentContext.characterTrackerHistory ?? []) as unknown as Array<Record<string, unknown>>,
        );
        const lockedCharacterPatch = applyTrackerFieldLocksToGameStatePatch(
          { presentCharacters },
          previousSnapshot ? parseGameStateRow(previousSnapshot as Record<string, unknown>) : null,
        );
        presentCharacters = Array.isArray(lockedCharacterPatch.presentCharacters)
          ? lockedCharacterPatch.presentCharacters
          : presentCharacters;
        await updateRetryTargetGameStateSnapshot({ presentCharacters });
        assertRetryActive();
        sendSseEvent(reply, { type: "game_state_patch", data: { presentCharacters } });
      } catch (err) {
        assertRetryActive();
        logger.error(err, "[retry-agents] Failed to apply character-tracker update");
      }
    }

    if (
      result.success &&
      result.type === "persona_stats_update" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const psData = result.data as Record<string, unknown>;
        const hasStats = Array.isArray(psData.stats);
        const hasStatus = typeof psData.status === "string";
        const hasInventory = Array.isArray(psData.inventory);
        const bars = hasStats ? (psData.stats as any[]) : [];
        const status = hasStatus ? (psData.status as string) : "";
        const inventory = hasInventory ? (psData.inventory as any[]) : [];
        const latest = await loadRetryTargetGameStateSnapshot();
        assertRetryActive();
        const personaPatch = buildLockedPersonaTrackerPatch({
          stats: bars,
          status,
          inventory,
          hasStats,
          hasStatus,
          hasInventory,
          snapshot: latest,
          lockState: latest ? parseGameStateRow(latest as Record<string, unknown>) : null,
        });
        if (latest) {
          if (Object.keys(personaPatch.updates).length > 0) {
            assertRetryActive();
            await app.db
              .update(gameStateSnapshotsTable)
              .set(personaPatch.updates)
              .where(eq(gameStateSnapshotsTable.id, latest.id));
            assertRetryActive();
          }
        }
        if (personaPatch.changed) {
          assertRetryActive();
          sendSseEvent(reply, { type: "game_state_patch", data: personaPatch.patch });
        }
      } catch (err) {
        assertRetryActive();
        logger.error(err, "[retry-agents] Failed to apply persona-stats tracker update");
      }
    }

    if (result.success && result.type === "secret_plot" && result.data && typeof result.data === "object") {
      try {
        const plotData = result.data as Record<string, unknown>;
        const agentConfigId = resolvedAgents.find((entry) => entry.resolved.type === "director")?.resolved.id ?? null;
        if (agentConfigId) {
          if (secretPlotRerollMode !== "turn_only" && plotData.overarchingArc !== undefined) {
            assertRetryActive();
            await agentsStore.setMemory(agentConfigId, chatId, "overarchingArc", plotData.overarchingArc ?? null);
            assertRetryActive();
          }
        }
      } catch (err) {
        assertRetryActive();
        logger.warn(err, "[retry-agents] Failed to persist secret plot memory");
      }
    }

    if (result.success && result.type === "lorebook_update" && result.data && typeof result.data === "object") {
      try {
        if (isAgentWriteApprovalEnvelope(result.data)) {
          onLorebookEffectStatus?.(result.agentId, "pending_approval");
          continue;
        }
        const resultAgent = findRetryResultAgent(result, resolvedAgents);
        const isBuiltInLorebookAgent = isBuiltInAgentType(result.agentType);
        const customCanEditLorebooks =
          isBuiltInLorebookAgent ||
          (resultAgent ? customAgentHasCapability(resultAgent.settings, "edit_lorebooks") : false);
        const customCanCreateLorebooks =
          isBuiltInLorebookAgent ||
          (resultAgent ? customAgentHasCapability(resultAgent.settings, "create_lorebooks") : false);
        if (!customCanEditLorebooks && !customCanCreateLorebooks) {
          onLorebookEffectStatus?.(result.agentId, "failed");
          continue;
        }

        const lkData = result.data as Record<string, unknown>;
        const retryUpdates = (lkData.updates as any[]) ?? [];
        if (retryUpdates.length > 0) {
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
            onLorebookEffectStatus?.(result.agentId, "failed");
            continue;
          }
          assertRetryActive();
          await persistLorebookKeeperUpdates({
            lorebooksStore,
            chatId,
            chatName: (chat as any).name,
            preferredTargetLorebookId,
            writableLorebookIds,
            writableLorebooks: Array.isArray(agentContext.memory._writableLorebooks)
              ? (agentContext.memory._writableLorebooks as Array<{ id: string; name: string }>)
              : undefined,
            lorebookNamingScheme: getLorebookNamingScheme(resultAgent?.settings),
            worldName: agentContext.characters[0]?.world ?? (chat as any).name,
            updates: retryUpdates,
            signal,
          });
          assertRetryActive();
        }
        onLorebookEffectStatus?.(result.agentId, "applied");
      } catch (err) {
        assertRetryActive();
        onLorebookEffectStatus?.(result.agentId, "failed");
        logger.error(err, "[retry-agents] Failed to apply lorebook update");
      }
    }

    if (
      result.success &&
      result.type === "quest_update" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const qData = result.data as Record<string, unknown>;
        const updates = Array.isArray(qData.updates) ? qData.updates : [];
        logger.debug(
          "[retry-agents] Quest agent result — updates: %d, data keys: %s %s",
          updates.length,
          Object.keys(qData).join(","),
          JSON.stringify(qData).slice(0, 500),
        );
        if (updates.length > 0) {
          const snap = await loadRetryTargetGameStateSnapshot();
          assertRetryActive();
          const existingPS = parseSnapshotPlayerStats(snap);
          const questMerge = applyQuestUpdatesToPlayerStats(existingPS, updates, {
            autoRemoveFullyCompleted: true,
          });
          const questTrackerPatch = buildLockedPlayerStatsArrayPatch<any>({
            field: "activeQuests",
            values: questMerge.quests,
            snapshot: snap,
            lockState: snap ? parseGameStateRow(snap as Record<string, unknown>) : null,
            basePlayerStats: questMerge.playerStats,
          });
          if (questMerge.changed && questTrackerPatch.changed) {
            if (snap) {
              assertRetryActive();
              await app.db
                .update(gameStateSnapshotsTable)
                .set({ playerStats: JSON.stringify(questTrackerPatch.playerStats) })
                .where(eq(gameStateSnapshotsTable.id, snap.id));
              assertRetryActive();
            }
            assertRetryActive();
            sendSseEvent(reply, { type: "game_state_patch", data: questTrackerPatch.patch });
          }
        }
      } catch (err) {
        assertRetryActive();
        logger.warn(err, "[retry-agents] Quest tracker persistence failed");
      }
    }

    // Persist re-rolled CYOA choices onto the last assistant message + active swipe
    // so they survive a page refresh, and broadcast them to the client store.
    if (result.success && result.type === "cyoa_choices" && result.data && typeof result.data === "object") {
      try {
        const cyoaData = result.data as { choices?: Array<{ label: string; text: string }> };
        if (retryMessageId && cyoaData.choices && cyoaData.choices.length > 0) {
          assertRetryActive();
          await chats.updateMessageExtraForSwipe(retryMessageId, retrySwipeIndex, { cyoaChoices: cyoaData.choices });
          assertRetryActive();
          logger.info(
            "[retry-agents] CYOA choices persisted chatId=%s messageId=%s swipeIndex=%d choiceCount=%d",
            chatId,
            retryMessageId,
            retrySwipeIndex,
            cyoaData.choices.length,
          );
        }
      } catch (err) {
        assertRetryActive();
        logger.warn(
          err,
          "[retry-agents] CYOA choices persistence failed chatId=%s messageId=%s",
          chatId,
          retryMessageId,
        );
      }
    }

    if (
      result.success &&
      result.type === "inventory_tracker_update" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const snap = await loadRetryTargetGameStateSnapshot();
        assertRetryActive();
        const inventoryTrackerPatch = buildLockedInventoryTrackerPatch({
          data: result.data as Record<string, unknown>,
          snapshot: snap,
          lockState: snap ? parseGameStateRow(snap as Record<string, unknown>) : null,
        });
        if (snap && inventoryTrackerPatch.changed) {
          assertRetryActive();
          await app.db
            .update(gameStateSnapshotsTable)
            .set({ playerStats: JSON.stringify(inventoryTrackerPatch.playerStats) })
            .where(eq(gameStateSnapshotsTable.id, snap.id));
          assertRetryActive();
        }
        if (inventoryTrackerPatch.changed) {
          assertRetryActive();
          sendSseEvent(reply, { type: "game_state_patch", data: inventoryTrackerPatch.patch });
        }
      } catch (err) {
        assertRetryActive();
        logger.error(err, "[retry-agents] Failed to apply inventory tracker update");
      }
    }

    if (
      result.success &&
      result.type === "custom_tracker_update" &&
      result.data &&
      typeof result.data === "object" &&
      customAgentCanApplyRetryResult(result, resolvedAgents, "edit_trackers")
    ) {
      try {
        const ctData = result.data as Record<string, unknown>;
        const hasFields = Array.isArray(ctData.fields);
        const rawFields = hasFields ? (ctData.fields as any[]) : [];
        if (hasFields) {
          const snap = await loadRetryTargetGameStateSnapshot();
          assertRetryActive();
          const customTrackerPatch = buildLockedPlayerStatsArrayPatch<any>({
            field: "customTrackerFields",
            values: rawFields,
            snapshot: snap,
            lockState: snap ? parseGameStateRow(snap as Record<string, unknown>) : null,
          });
          if (snap && customTrackerPatch.changed) {
            assertRetryActive();
            await app.db
              .update(gameStateSnapshotsTable)
              .set({ playerStats: JSON.stringify(customTrackerPatch.playerStats) })
              .where(eq(gameStateSnapshotsTable.id, snap.id));
            assertRetryActive();
          }
          if (customTrackerPatch.changed) {
            assertRetryActive();
            sendSseEvent(reply, { type: "game_state_patch", data: customTrackerPatch.patch });
          }
        }
      } catch {
        assertRetryActive();
        // Non-critical patching failure.
      }
    }

    // ── ILLUSTRATOR: generate image from agent prompt ──
    if (
      shouldRetryIllustratorTarget(illustratorRetryTargets, "illustration") &&
      result.success &&
      result.type === "image_prompt" &&
      result.data &&
      typeof result.data === "object"
    ) {
      const resultAgent = resolvedAgents.find((agent) => agent.resolved.id === result.agentId);
      const fallbackIllustratorAgent = resolvedAgents.find((agent) => agent.resolved.type === "illustrator");
      const imagePromptAgent =
        resultAgent ?? (result.agentType === "illustrator" ? fallbackIllustratorAgent : undefined);
      const usesChatIllustratorSettings =
        resultAgent?.resolved.type === "illustrator" || (!resultAgent && result.agentType === "illustrator");
      const illustratorFailureName = imagePromptAgent?.cfg.name ?? "Illustrator";
      try {
        const illData = result.data as Record<string, unknown>;
        // Snapshot button (#4682): force generation for custom image agents only —
        // the vanilla Illustrator has its own manual path (illustratorRetryTargets).
        const shouldGenerate =
          isManualIllustratorImageRequest ||
          (forceImageGeneration && !usesChatIllustratorSettings) ||
          illData.shouldGenerate === true;
        const imagePrompt = ((illData.prompt as string) ?? "").trim();
        const negativePrompt = ((illData.negativePrompt as string) ?? "").trim();
        const style = ((illData.style as string) ?? "").trim();
        const illCharacters = Array.isArray(illData.characters) ? (illData.characters as string[]) : [];

        if (shouldGenerate && imagePrompt) {
          const rawImagePositivePrompt = imagePromptAgent?.resolved.settings?.imagePositivePrompt;
          const rawSavedNegativePrompt = imagePromptAgent?.resolved.settings?.imageNegativePrompt;
          const imagePositivePrompt = typeof rawImagePositivePrompt === "string" ? rawImagePositivePrompt.trim() : "";
          const savedNegativePrompt = typeof rawSavedNegativePrompt === "string" ? rawSavedNegativePrompt.trim() : "";
          const imageConnectionOverride = usesChatIllustratorSettings
            ? resolveIllustratorImageConnectionId(
                chat.mode,
                chatMeta,
                imagePromptAgent?.resolved.settings?.imageConnectionId,
              )
            : typeof imagePromptAgent?.resolved.settings?.imageConnectionId === "string"
              ? imagePromptAgent.resolved.settings.imageConnectionId.trim()
              : "";
          let imgConnFull = imageConnectionOverride ? await conns.getWithKey(imageConnectionOverride) : null;
          assertRetryActive();
          if (imageConnectionOverride && !imgConnFull) {
            logger.warn(
              "[retry-agents] Illustrator image connection %s could not be resolved; falling back to the default Images connection",
              imageConnectionOverride,
            );
          }
          imgConnFull ??= await conns.getDefaultForImageGeneration();
          assertRetryActive();
          if (imgConnFull) {
            const { generateImage, saveImageToDisk } = await import("../../services/image/image-generation.js");
            assertRetryActive();
            const { createGalleryStorage } = await import("../../services/storage/gallery.storage.js");
            assertRetryActive();
            const galleryStore = createGalleryStorage(app.db);
            const notifyImageFallback = createReplyFallbackNotifier(reply);

            const imgModel = imgConnFull.model || "";
            const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
            const imgApiKey = imgConnFull.apiKey || "";
            const imgSource = (imgConnFull as any).imageGenerationSource || imgModel;
            const imgServiceHint = imgConnFull.imageService || imgSource;
            const imageFallback = await resolveImageConnectionFallback(conns, imgConnFull.id);
            assertRetryActive();
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
            assertRetryActive();

            const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
            const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
            const styleProfileId = resolveCustomAgentStyleProfileId({
              usesChatIllustratorSettings,
              agentSettings: imagePromptAgent?.resolved.settings,
              availableProfiles: imageSettings.styleProfiles.profiles,
              gameStyleProfileId: setupConfig.imageStyleProfileId,
              chatStyleProfileId: chatMeta.imageStyleProfileId,
            });
            const illustrationSize = resolveIllustratorImageSize(
              chat.mode === "game" ? imageSettings.game : imageSettings.illustration,
              illData.aspectRatio,
            );
            const imgWidth = illustrationSize.width;
            const imgHeight = illustrationSize.height;

            const gameArtStylePrompt =
              typeof agentContext.memory._gameImageStylePrompt === "string"
                ? agentContext.memory._gameImageStylePrompt
                : "";
            let fullPrompt = buildIllustratorImagePrompt({
              gameArtStylePrompt,
              style,
              imagePrompt,
              imagePositivePrompt,
            });
            const requestedNegativePrompt = [negativePrompt, savedNegativePrompt].filter(Boolean).join(", ");

            // Collect optional character visual context. Prefer avatar portraits
            // for references, then fall back to full-body sprites.
            const useAvatarRefs =
              usesChatIllustratorSettings && typeof chatMeta.illustratorUseAvatarReferences === "boolean"
                ? chatMeta.illustratorUseAvatarReferences
                : imagePromptAgent?.resolved.settings?.useAvatarReferences === true;
            const includeCharacterAppearance =
              usesChatIllustratorSettings && typeof chatMeta.illustratorIncludeCharacterAppearance === "boolean"
                ? chatMeta.illustratorIncludeCharacterAppearance
                : imagePromptAgent?.resolved.settings?.includeCharacterAppearance === true;
            const spatialLocationReferenceImage = await resolveSpatialLocationReferenceImage({
              db: app.db,
              chatId,
              projection: retryOwnerSpatialProjection?.ownerMode === "roleplay" ? retryOwnerSpatialProjection : null,
            });
            assertRetryActive();
            let referenceImages: string[] | undefined;
            const retryPersonaId =
              typeof agentContext.memory._personaId === "string" ? agentContext.memory._personaId : null;
            const retryPersonaReference = retryPersonaId ? await chars.getPersona(retryPersonaId) : null;
            assertRetryActive();
            const referenceResolution = await resolveIllustratorCharacterReferences({
              charactersStore: chars,
              characterGallery: createCharacterGalleryStorage(app.db),
              personaGallery: createPersonaGalleryStorage(app.db),
              chatCharacters: agentContext.characters.map((character) => ({
                id: character.id,
                name: character.name,
                appearance: character.appearance,
              })),
              persona: agentContext.persona
                ? {
                    id: retryPersonaId,
                    name: agentContext.persona.name,
                    avatarPath:
                      typeof retryPersonaReference?.avatarPath === "string"
                        ? retryPersonaReference.avatarPath
                        : typeof agentContext.memory._personaAvatarPath === "string"
                          ? agentContext.memory._personaAvatarPath
                          : null,
                    appearance: agentContext.persona.appearance,
                    characterSheetImageId:
                      typeof retryPersonaReference?.characterSheetImageId === "string"
                        ? retryPersonaReference.characterSheetImageId
                        : null,
                    useCharacterSheetAsReference: retryPersonaReference?.useCharacterSheetAsReference === "true",
                  }
                : null,
              requestedNames: illCharacters.filter((name): name is string => typeof name === "string"),
              promptText: [
                [...agentContext.recentMessages].reverse().find((message) => message.role === "user")?.content ?? "",
                imagePrompt,
                style,
                typeof illData.reason === "string" ? illData.reason : "",
                agentContext.mainResponse ?? "",
              ].join("\n"),
              fallbackToChatCharacters: false,
              includeReferenceImages: useAvatarRefs,
              includePersonaWhenMentionedInPrompt: false,
              maxReferences: spatialLocationReferenceImage ? 5 : 6,
            });
            assertRetryActive();
            if (includeCharacterAppearance && referenceResolution.appearanceBlock) {
              fullPrompt += `\n\n${referenceResolution.appearanceBlock}`;
              logger.debug(
                "[retry-agents] Illustrator added character appearance notes for: %s",
                referenceResolution.appearanceNames.join(", "),
              );
            }
            if (useAvatarRefs && referenceResolution.referenceImages.length > 0) {
              if (referenceResolution.referenceLine && !suppressReferencePromptLine)
                fullPrompt += `\n\n${referenceResolution.referenceLine}`;
              logger.debug(
                "[retry-agents] Illustrator sending %d character reference(s) for: %s",
                referenceResolution.referenceImages.length,
                referenceResolution.referenceNames.join(", "),
              );
            }
            const mergedReferenceImages = mergeSpatialLocationReferenceImages(
              spatialLocationReferenceImage,
              useAvatarRefs ? referenceResolution.referenceImages : [],
              6,
            );
            if (mergedReferenceImages.length > 0) {
              referenceImages = mergedReferenceImages;
            }
            if (spatialLocationReferenceImage) {
              fullPrompt += `\n\n${SPATIAL_LOCATION_REFERENCE_PROMPT_LINE}`;
              logger.debug("[retry-agents] Illustrator sending the current Maps location reference image first");
            }

            const compiledPrompt = compileImagePrompt({
              kind: "illustration",
              prompt: fullPrompt,
              negativePrompt: requestedNegativePrompt || undefined,
              styleProfiles: imageSettings.styleProfiles,
              styleProfileId,
              imageDefaults,
              generatedStyle: style,
              omitProfileStyleText:
                illData._styleProfileInstructionApplied === true ||
                typeof agentContext.memory._illustratorImageStyleInstruction === "string",
              omitProfileSubjectTags: illustratorPromptTemplateOwnsComposition(
                imagePromptAgent?.resolved.promptTemplate ?? "",
              ),
            });
            const finalNegativePrompt = mergeIllustratorNegativePrompt(
              compiledPrompt.prompt,
              compiledPrompt.negativePrompt,
              requestedNegativePrompt,
              imgConnFull,
            );
            const promptSubmission = resolveIllustratorPromptSubmission({
              generatedPrompt: compiledPrompt.prompt,
              generatedNegativePrompt: finalNegativePrompt,
              reviewOverride: illustratorPromptReviewOverride,
            });
            const fallbackCompiledPrompt = imageFallback
              ? compileImagePrompt({
                  kind: "illustration",
                  prompt: fullPrompt,
                  negativePrompt: requestedNegativePrompt || undefined,
                  styleProfiles: imageSettings.styleProfiles,
                  styleProfileId,
                  imageDefaults: imageFallback.imageDefaults,
                  generatedStyle: style,
                  omitProfileStyleText:
                    illData._styleProfileInstructionApplied === true ||
                    typeof agentContext.memory._illustratorImageStyleInstruction === "string",
                  omitProfileSubjectTags: illustratorPromptTemplateOwnsComposition(
                    imagePromptAgent?.resolved.promptTemplate ?? "",
                  ),
                })
              : null;
            const fallbackPromptSubmission =
              imageFallback && fallbackCompiledPrompt
                ? resolveIllustratorPromptSubmission({
                    generatedPrompt: fallbackCompiledPrompt.prompt,
                    generatedNegativePrompt: mergeIllustratorNegativePrompt(
                      fallbackCompiledPrompt.prompt,
                      fallbackCompiledPrompt.negativePrompt,
                      requestedNegativePrompt,
                      imageFallback,
                    ),
                    reviewOverride: illustratorPromptReviewOverride,
                  })
                : null;
            const providerAwareImageFallback =
              imageFallback && fallbackPromptSubmission
                ? {
                    ...imageFallback,
                    prompt: fallbackPromptSubmission.prompt,
                    negativePrompt: fallbackPromptSubmission.negativePrompt || null,
                  }
                : undefined;

            // A forced custom-agent snapshot (#4682) skips prompt review: the
            // camera press is itself the explicit user request, and the review
            // approval round-trip only supports the vanilla Illustrator.
            const skipReviewForForcedSnapshot = forceImageGeneration && !usesChatIllustratorSettings;
            if (reviewImagePromptsBeforeSend && !illustratorPromptReviewOverride && !skipReviewForForcedSnapshot) {
              const previewSize = resolveImagePromptReviewSize({
                connection: imgConnFull,
                prompt: promptSubmission.prompt,
                width: imgWidth,
                height: imgHeight,
                imageDefaults,
              });
              assertRetryActive();
              sendSseEvent(reply, {
                type: "image_prompt_review",
                data: {
                  chatId,
                  item: {
                    id: "roleplay-scene-illustration",
                    kind: "illustration",
                    title: "Scene illustration",
                    prompt: promptSubmission.prompt,
                    ...(promptSubmission.negativePrompt ? { negativePrompt: promptSubmission.negativePrompt } : {}),
                    width: previewSize.width,
                    height: previewSize.height,
                  },
                  resultData: illData,
                },
              });
              continue;
            }

            const debugOverrideEnabled = debugMode || isDebugAgentsEnabled();
            logDebugOverride(
              debugOverrideEnabled,
              "[debug/retry-agents/illustrator] final prompt:\n%s",
              promptSubmission.prompt,
            );
            if (promptSubmission.negativePrompt) {
              logDebugOverride(
                debugOverrideEnabled,
                "[debug/retry-agents/illustrator] final negative prompt:\n%s",
                promptSubmission.negativePrompt,
              );
            }
            const imageConnectionQueueKey = imgConnFull.id?.trim() || `${imgServiceHint}:${imgBaseUrl}:${imgModel}`;
            logger.debug(
              "[retry-agents] Illustrator image request queue=%s connection=%s",
              queueImageGenerationRequests ? "enabled" : "disabled",
              imageConnectionQueueKey,
            );
            assertRetryActive();
            sendSseEvent(reply, {
              type: "illustration_queued",
              data: { messageId: retryMessageId },
            });
            const imageResults = await generateIllustratorImageVariants({
              count: chatMeta.illustratorImagesPerGeneration,
              generate: () =>
                runImageGenerationRequest({
                  connectionKey: imageConnectionQueueKey,
                  queue: queueImageGenerationRequests,
                  signal: agentContext.signal,
                  task: () =>
                    generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                      prompt: promptSubmission.prompt,
                      negativePrompt: promptSubmission.negativePrompt || undefined,
                      model: imgModel,
                      width: imgWidth,
                      height: imgHeight,
                      imageEndpointId: imgConnFull.imageEndpointId || undefined,
                      comfyWorkflow: (imgConnFull as any).comfyuiWorkflow || undefined,
                      imageDefaults,
                      quality: resolveConnectionImageQuality(imgConnFull),
                      referenceImages,
                      signal: agentContext.signal,
                      fallback: providerAwareImageFallback,
                      onFallback: (notice) => {
                        assertRetryActive();
                        notifyImageFallback(notice);
                      },
                    }),
                }),
              onVariantError: (error, index) =>
                logger.warn(error, "[retry-agents] Illustrator image variant %d failed", index + 1),
            });
            assertRetryActive();

            for (const [variantIndex, imageResult] of imageResults.entries()) {
              assertRetryActive();
              const renderedPrompt = imageResult.effectivePrompt ?? promptSubmission.prompt;
              assertRetryActive();
              const filePath = saveImageToDisk(chatId, imageResult.base64, imageResult.ext, { shared: true });
              // A fallback connection may have rendered this variant; record
              // the connection that actually produced it.
              const effectiveImageProvider =
                imageResult.effectiveConnection?.provider ?? imgConnFull.provider ?? "image_generation";
              const effectiveImageModel = imageResult.effectiveConnection?.model || imgModel || "unknown";
              const galleryEntry = await galleryStore.create({
                chatId,
                filePath,
                prompt: renderedPrompt,
                provider: effectiveImageProvider,
                model: effectiveImageModel,
                width: imgWidth,
                height: imgHeight,
              });
              assertRetryActive();
              await persistGeneratedImageToEntityGalleries({
                sourceFilePath: filePath,
                sourceChatImageId: galleryEntry?.id,
                characterIds: referenceResolution.characterIds,
                personaIds: referenceResolution.personaId ? [referenceResolution.personaId] : [],
                characterGallery: createCharacterGalleryStorage(app.db),
                personaGallery: createPersonaGalleryStorage(app.db),
                prompt: renderedPrompt,
                provider: effectiveImageProvider,
                model: effectiveImageModel,
                width: imgWidth,
                height: imgHeight,
                signal,
              });
              assertRetryActive();

              const filename = filePath.split("/").pop()!;
              const imageUrl = `/api/gallery/file/${chatId}/${encodeURIComponent(filename)}`;

              // Attach to message
              if (retryMessageId) {
                const chatsDb = createChatsStorage(app.db);
                const attachment = {
                  type: "image",
                  url: imageUrl,
                  filename: `illustration_${variantIndex + 1}.${imageResult.ext}`,
                  prompt: renderedPrompt,
                  galleryId: (galleryEntry as any)?.id,
                };
                assertRetryActive();
                await chatsDb.appendSwipeAttachment(retryMessageId, retrySwipeIndex, attachment);
                assertRetryActive();
                await chatsDb.appendMessageAttachmentForActiveSwipe(retryMessageId, retrySwipeIndex, attachment);
                assertRetryActive();
              }

              assertRetryActive();
              sendSseEvent(reply, {
                type: "illustration",
                data: {
                  messageId: retryMessageId,
                  imageUrl,
                  prompt: renderedPrompt,
                  reason: illData.reason,
                  galleryId: (galleryEntry as any)?.id,
                },
              });
            }
            logger.info(
              "[retry-agents] Illustrator generated %d image(s): %s...",
              imageResults.length,
              (illData.reason as string | undefined)?.slice(0, 80) ?? imagePrompt.slice(0, 80),
            );
            if (retryMessageId) {
              try {
                assertRetryActive();
                await agentsStore.saveRun({
                  agentConfigId: result.agentId,
                  chatId,
                  messageId: retryMessageId,
                  result,
                });
                assertRetryActive();
              } catch (err) {
                assertRetryActive();
                logger.warn(err, "[retry-agents] Failed to persist successful Illustrator run");
              }
            }
          } else {
            logger.warn(
              "[retry-agents] Illustrator wants to generate but no image generation connection is configured",
            );
            assertRetryActive();
            sendSseEvent(reply, {
              type: "agent_error",
              data: {
                // Attribute to the agent that actually ran (custom snapshot vs vanilla).
                agentType: result.agentType,
                agentName: illustratorFailureName,
                retryTarget: "illustration",
                error:
                  "No image generation connection is set on this agent or under Settings -> Connections -> Defaults -> Images. Choose one there, or assign one in the agent's settings.",
              },
            });
          }
        } else if (forceImageGeneration && !usesChatIllustratorSettings) {
          // Snapshot button (#4682): the forced agent still declined or returned
          // no prompt — surface it so the camera press never looks like a no-op.
          assertRetryActive();
          sendSseEvent(reply, {
            type: "agent_error",
            data: {
              agentType: result.agentType,
              agentName: illustratorFailureName,
              retryTarget: "illustration",
              error:
                "The agent ran but did not produce an image prompt. Try again, or adjust its prompt template so it always returns a prompt when an image is requested.",
            },
          });
        }
      } catch (illErr) {
        assertRetryActive();
        logger.error(illErr, "[retry-agents] Illustrator image generation failed");
        assertRetryActive();
        sendSseEvent(reply, {
          type: "agent_error",
          data: {
            // Attribute the failure to the agent that actually ran — a custom
            // agent's snapshot failure must not be reported as the Illustrator.
            agentType: result.agentType,
            agentName: illustratorFailureName,
            retryTarget: "illustration",
            error: illErr instanceof Error ? illErr.message : "Image generation failed",
          },
        });
      }
    } else if (needsForcedSnapshotFallback(forceImageGeneration === true, result)) {
      // Snapshot button (#4682): the forced agent SUCCEEDED without a usable
      // image_prompt payload (different result type, or null data), so nothing
      // above surfaces the outcome — without this the camera press would be a
      // silent no-op. Failed results already reach the client via agent_result.
      const forcedAgent = resolvedAgents.find((agent) => agent.resolved.id === result.agentId);
      if (forcedAgent && forcedAgent.resolved.type !== "illustrator") {
        assertRetryActive();
        sendSseEvent(reply, {
          type: "agent_error",
          data: {
            agentType: result.agentType,
            agentName: forcedAgent.cfg.name ?? "Agent",
            retryTarget: "illustration",
            error:
              "The agent completed without producing an image prompt. Check that its result type is set to Image Prompt and that its template returns a prompt when an image is requested.",
          },
        });
      }
    }

    // ── EXPRESSION ENGINE: persist validated sprite expressions ──
    // Validation already happened before SSE send; here we just persist to DB.
    if (
      retryMessageId &&
      result.success &&
      result.type === "sprite_change" &&
      result.data &&
      typeof result.data === "object"
    ) {
      const spriteData = result.data as { expressions?: Array<{ characterId: string; expression: string }> };
      const exprMap: Record<string, string> = {};
      const personaExprMap: Record<string, string> = {};
      const personaId = typeof agentContext.memory._personaId === "string" ? agentContext.memory._personaId : null;
      if (Array.isArray(spriteData.expressions)) {
        for (const e of spriteData.expressions) {
          if (personaId && e.characterId === personaId) {
            personaExprMap[e.characterId] = e.expression;
          } else {
            exprMap[e.characterId] = e.expression;
          }
        }
      }
      try {
        const chatsDb = createChatsStorage(app.db);
        if (Object.keys(exprMap).length > 0) {
          assertRetryActive();
          await chatsDb.updateMessageExtraForSwipe(retryMessageId, retrySwipeIndex, { spriteExpressions: exprMap });
          assertRetryActive();
        }
        if (Object.keys(personaExprMap).length > 0) {
          const personaMessageId = await findLastUserMessageIdBefore(chatsDb, chatId, retryMessageId);
          assertRetryActive();
          if (personaMessageId) {
            assertRetryActive();
            await chatsDb.updateMessageExtra(personaMessageId, { spriteExpressions: personaExprMap });
            assertRetryActive();
          }
        }
      } catch (err) {
        assertRetryActive();
        logger.warn(err, "[retry-agents] Failed to persist validated sprite expressions");
      }
    }
  }

  assertRetryActive();
  const illustratorResult = sortedResults.find(
    (result) =>
      result.success &&
      result.type === "image_prompt" &&
      result.data &&
      typeof result.data === "object" &&
      (result.agentType === "illustrator" ||
        resolvedAgents.some((entry) => entry.resolved.id === result.agentId && entry.resolved.type === "illustrator")),
  );
  const resultEntry = illustratorResult
    ? resolvedAgents.find((entry) => entry.resolved.id === illustratorResult.agentId)
    : null;
  const illustratorEntry = illustratorResult
    ? resultEntry?.resolved.type === "illustrator"
      ? resultEntry
      : resolvedAgents.find((entry) => entry.resolved.type === "illustrator")
    : null;
  if (
    illustratorResult &&
    illustratorEntry &&
    shouldRetryIllustratorTarget(illustratorRetryTargets, "background") &&
    (isManualIllustratorBackgroundRequest ||
      illustratorBackgroundGenerationEnabled((chat as { mode?: unknown }).mode, chatMeta))
  ) {
    const backgroundAtDecision =
      typeof chatMeta.background === "string" && chatMeta.background.trim() ? chatMeta.background.trim() : null;
    try {
      const freshChat = await chats.getById(chatId);
      assertRetryActive();
      const freshMeta = parseExtra(freshChat?.metadata) as Record<string, unknown>;
      const backgroundBeforeGeneration =
        typeof freshMeta.background === "string" && freshMeta.background.trim() ? freshMeta.background.trim() : null;
      if (backgroundBeforeGeneration !== backgroundAtDecision) {
        logger.info(
          "[retry-agents/illustrator-background] Skipping automatic background because the active background changed after the Illustrator decision",
        );
        return;
      }

      const latestSnapshot = await loadRetryTargetGameStateSnapshot();
      assertRetryActive();
      const latestGameState = latestSnapshot
        ? parseGameStateRow(latestSnapshot as Record<string, unknown>)
        : agentContext.gameState;
      const illData = illustratorResult.data as Record<string, unknown>;
      const requestedBackground =
        isManualIllustratorBackgroundRequest || illustratorRequestedBackground(illData.generateBackground);
      const trackerLocationChanged = illustratorTrackerLocationChanged(
        agentContext.gameState?.location,
        latestGameState?.location,
      );
      if (!requestedBackground && !trackerLocationChanged) return;
      const backgroundDecisionReason = isManualIllustratorBackgroundRequest
        ? "Manual Gallery background request"
        : requestedBackground
          ? typeof illData.reason === "string"
            ? illData.reason
            : undefined
          : `Tracker location changed from ${agentContext.gameState?.location || "an unspecified location"} to ${latestGameState?.location}.`;
      if (trackerLocationChanged && !requestedBackground) {
        logger.info(
          '[retry-agents/illustrator-background] Tracker location changed from "%s" to "%s"; generating despite a false Illustrator background decision',
          agentContext.gameState?.location || "(none)",
          latestGameState?.location,
        );
      }
      const backgroundArgs = {
        db: app.db,
        chatId,
        chatName: chat.name,
        chatMode: ((chat as { mode?: unknown }).mode === "game" ? "game" : "roleplay") as "game" | "roleplay",
        chatMetadata: freshMeta,
        currentBackground:
          backgroundBeforeGeneration ??
          (typeof agentContext.memory._currentBackground === "string" ? agentContext.memory._currentBackground : null),
        illustratorAgent: illustratorEntry.resolved,
        assistantResponse: agentContext.mainResponse ?? "",
        decisionReason: backgroundDecisionReason,
        gameState: latestGameState,
        recentMessages: agentContext.recentMessages,
        force: isManualIllustratorBackgroundRequest,
        signal: agentContext.signal,
        debugLog: (message: string, ...values: unknown[]) =>
          logDebugOverride(debugMode || isDebugAgentsEnabled(), message, ...values),
      };
      if (isManualIllustratorBackgroundRequest && reviewImagePromptsBeforeSend && !illustratorPromptReviewOverride) {
        const preview = await previewIllustratorSceneBackground(backgroundArgs);
        assertRetryActive();
        sendSseEvent(reply, {
          type: "image_prompt_review",
          data: {
            chatId,
            item: {
              id: "roleplay-scene-background",
              kind: "background",
              title: "Scene background",
              prompt: preview.prompt,
              ...(preview.negativePrompt ? { negativePrompt: preview.negativePrompt } : {}),
              width: preview.width,
              height: preview.height,
            },
            resultData: { ...illData, generateBackground: true, backgroundPlan: preview.plan },
          },
        });
        return;
      }

      const generated = await generateIllustratorSceneBackground({
        ...backgroundArgs,
        planOverride: illustratorPromptReviewOverride
          ? (parseIllustratorBackgroundPlan(illData.backgroundPlan) ?? undefined)
          : undefined,
        promptOverride: illustratorPromptReviewOverride?.prompt,
        negativePromptOverride: illustratorPromptReviewOverride?.negativePrompt,
      });
      assertRetryActive();

      const chatAfterGeneration = await chats.getById(chatId);
      assertRetryActive();
      const metaAfterGeneration = parseExtra(chatAfterGeneration?.metadata) as Record<string, unknown>;
      const backgroundAfterGeneration =
        typeof metaAfterGeneration.background === "string" && metaAfterGeneration.background.trim()
          ? metaAfterGeneration.background.trim()
          : null;
      if (backgroundAfterGeneration !== backgroundAtDecision) {
        logger.info(
          "[retry-agents/illustrator-background] Saved %s without activating it because the background changed during generation",
          generated.filename,
        );
        return;
      }

      assertRetryActive();
      await chats.patchMetadata(chatId, { background: generated.filename });
      assertRetryActive();
      sendSseEvent(reply, {
        type: "agent_result",
        data: {
          agentType: "illustrator",
          agentName: illustratorEntry.cfg?.name ?? illustratorEntry.resolved.name ?? "Illustrator",
          resultType: "background_change",
          data: {
            chosen: generated.filename,
            generated: true,
            location: generated.locationName,
            reason: generated.reason,
            tags: generated.tags,
          },
          success: true,
          error: null,
          chatId,
          messageId: retryMessageId || null,
          swipeIndex: retryMessageId ? retrySwipeIndex : null,
          generationId,
        },
      });
      logger.info(
        '[retry-agents/illustrator-background] Generated and activated "%s" for %s',
        generated.filename,
        generated.locationName,
      );
    } catch (backgroundError) {
      assertRetryActive();
      logger.error(backgroundError, "[retry-agents/illustrator-background] Automatic scene background failed");
      assertRetryActive();
      sendSseEvent(reply, {
        type: "agent_error",
        data: {
          agentType: "illustrator",
          agentName: illustratorEntry.cfg?.name ?? illustratorEntry.resolved.name ?? "Illustrator",
          retryTarget: "background",
          error: `Background generation failed: ${
            backgroundError instanceof Error ? backgroundError.message : String(backgroundError)
          }`,
        },
      });
    }
  }
}

export type ActiveAgentRun = {
  abortController: AbortController;
  backendUrl: string | null;
  messageId: string | null;
  swipeIndex: number | null;
};

export async function runRetrySetupPhase<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  const result = await operation();
  signal.throwIfAborted();
  return result;
}

export async function registerRetryAgentsRoute(
  app: FastifyInstance,
  activeCustomLorebookReadBehindRuns: Set<string>,
  activeAgentRuns: Map<string, Set<ActiveAgentRun>>,
) {
  const chats = createChatsStorage(app.db);
  const conns = createConnectionsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const agentsStore = createAgentsStorage(app.db);
  const gameStateStore = createGameStateStorage(app.db);
  const lorebooksStore = createLorebooksStorage(app.db);
  const customToolsStore = createCustomToolsStorage(app.db);
  const presets = createPromptsStorage(app.db);

  app.post<{
    Body: {
      chatId: string;
      agentTypes: string[];
      streaming?: boolean;
      debugMode?: boolean;
      /** Background currently displayed on the active chat surface. */
      currentBackground?: string | null;
      /** Serialize Roleplay Illustrator provider calls when enabled. */
      queueImageGenerationRequests?: boolean;
      /** Pause a manual Illustrator retry after prompt compilation so the client can review it. */
      reviewImagePromptsBeforeSend?: boolean;
      /** Override prompt modes for this retry without changing the chat's saved selections. */
      agentPromptTemplateIds?: unknown;
      /** Resume a reviewed Illustrator retry without running the Illustrator LLM a second time. */
      illustratorPromptReviewOverride?: unknown;
      /** Limit an Illustrator retry to visual jobs that failed in the original run. */
      illustratorRetryTargets?: unknown;
      /** Force image generation for retried custom image agents' results (snapshot button, #4682). */
      forceImageGeneration?: boolean;
      lorebookKeeperBackfill?: boolean;
      customLorebookBackfill?: boolean;
      /** When set, scope history and game state to this assistant message (as at original generation), not the latest turn. */
      forMessageId?: string;
      musicPlayerSource?: "spotify" | "youtube" | "custom";
      musicPlayerEnabled?: boolean;
      /** Secret Plot re-run mode: full = refresh arc+turn data, turn_only = preserve arc and refresh only turn guidance. */
      secretPlotRerollMode?: "full" | "turn_only";
    };
  }>("/retry-agents", async (request, reply) => {
    const {
      chatId,
      agentTypes,
      streaming = true,
      debugMode = false,
      currentBackground: requestedCurrentBackground,
      queueImageGenerationRequests = true,
      reviewImagePromptsBeforeSend = false,
      agentPromptTemplateIds,
      illustratorPromptReviewOverride: rawIllustratorPromptReviewOverride,
      illustratorRetryTargets: rawIllustratorRetryTargets,
      forceImageGeneration = false,
      lorebookKeeperBackfill = false,
      customLorebookBackfill = false,
      forMessageId,
      musicPlayerSource = "spotify",
      musicPlayerEnabled = true,
      secretPlotRerollMode,
    } = request.body;
    const illustratorPromptReviewOverride = rawIllustratorPromptReviewOverride
      ? parseIllustratorPromptReviewOverride(rawIllustratorPromptReviewOverride)
      : null;
    const illustratorRetryTargets = parseIllustratorRetryTargets(rawIllustratorRetryTargets);
    if (!chatId || !agentTypes?.length) {
      return reply.status(400).send({ error: "chatId and agentTypes are required" });
    }
    if (rawIllustratorPromptReviewOverride && !illustratorPromptReviewOverride) {
      return reply.status(400).send({ error: "Invalid Illustrator prompt review override" });
    }
    if (illustratorRetryTargets === null) {
      return reply.status(400).send({ error: "Invalid Illustrator retry targets" });
    }
    if (illustratorRetryTargets && !agentTypes.includes("illustrator")) {
      return reply.status(400).send({ error: "Illustrator retry targets require an Illustrator retry" });
    }
    if (customLorebookBackfill && (agentTypes.length !== 1 || lorebookKeeperBackfill || forMessageId)) {
      return reply.status(400).send({ error: "Custom lorebook backfill requires exactly one custom agent" });
    }
    const isManualIllustratorBackgroundRequest = isExclusiveIllustratorRetryTarget(
      illustratorRetryTargets,
      "background",
    );
    const isManualIllustratorImageRequest = isExclusiveIllustratorRetryTarget(illustratorRetryTargets, "illustration");

    startSseReply(reply, { "X-Accel-Buffering": "no" });

    // Abort in-flight agent LLM calls when the client disconnects, and stop
    // writing to a closed socket. Mirrors the main /generate handler so a dropped
    // retry tab does not leak upstream provider requests to completion.
    const abortController = new AbortController();
    const assertRetrySetupActive = () => abortController.signal.throwIfAborted();
    const notifyFallback = createReplyFallbackNotifier(reply);
    const onFallback: typeof notifyFallback = (notice) => {
      if (!abortController.signal.aborted) notifyFallback(notice);
    };
    const activeAgentRun: ActiveAgentRun = {
      abortController,
      backendUrl: null,
      messageId: null,
      swipeIndex: null,
    };
    const runs = activeAgentRuns.get(chatId) ?? new Set<ActiveAgentRun>();
    runs.add(activeAgentRun);
    activeAgentRuns.set(chatId, runs);
    const generationId = randomUUID();
    const customLorebookReadBehindRunKeys = new Set<string>();
    let clientDisconnected = false;
    const stopSseKeepalive = startSseKeepalive(reply);
    const onClientClose = () => {
      clientDisconnected = true;
      abortController.abort();
    };
    reply.raw.on("close", onClientClose);

    try {
      const chat = await runRetrySetupPhase(abortController.signal, () => chats.getById(chatId));
      if (!chat) {
        throw new Error("Chat not found");
      }

      const chatMeta = parseExtra(chat.metadata);
      const currentBackgroundSource =
        requestedCurrentBackground !== undefined ? requestedCurrentBackground : chatMeta.background;
      const currentBackground =
        typeof currentBackgroundSource === "string" && currentBackgroundSource.trim()
          ? currentBackgroundSource.trim()
          : null;
      const requireAgentWriteApproval = agentWriteApprovalRequired(chatMeta);
      const allMessages = await runRetrySetupPhase(abortController.signal, () => chats.listMessages(chatId));
      let startIdx = 0;
      for (let index = allMessages.length - 1; index >= 0; index--) {
        const extra = parseExtra(allMessages[index]!.extra);
        if (extra.isConversationStart) {
          startIdx = index;
          break;
        }
      }
      let recentMessages = startIdx > 0 ? allMessages.slice(startIdx) : allMessages;
      let lastAssistant = [...recentMessages].reverse().find((message: any) => message.role === "assistant");
      let historicalGameStateAnchor: { messageId: string; swipeIndex: number } | null = null;
      let preGenerationRecentMessages: any[] | null = null;
      let preGenerationGameStateAnchor: { messageId: string; swipeIndex: number } | null = null;

      if (forMessageId) {
        const anchor = allMessages.find((m) => m.id === forMessageId);
        if (!anchor || anchor.role !== "assistant") {
          throw new Error("forMessageId must refer to an assistant message in this chat");
        }
        const anchorIdx = allMessages.findIndex((m) => m.id === forMessageId);
        if (anchorIdx < startIdx) {
          throw new Error("Anchor message is before the conversation start marker");
        }
        preGenerationRecentMessages = allMessages.slice(startIdx, anchorIdx);
        recentMessages = allMessages.slice(startIdx, anchorIdx + 1);
        lastAssistant = anchor;
        historicalGameStateAnchor = {
          messageId: anchor.id,
          swipeIndex: anchor.activeSwipeIndex ?? 0,
        };
      }

      const unfilteredRecentMessages = recentMessages;

      const supportsHiddenFromAI = chat.mode === "conversation" || chat.mode === "roleplay";
      if (supportsHiddenFromAI) {
        recentMessages = recentMessages.filter((message: any) => !isMessageHiddenFromAI(message));
        if (preGenerationRecentMessages) {
          preGenerationRecentMessages = preGenerationRecentMessages.filter(
            (message: any) => !isMessageHiddenFromAI(message),
          );
        }
        if (!forMessageId) {
          lastAssistant = [...recentMessages].reverse().find((message: any) => message.role === "assistant");
        }
      }
      const preGenerationLastAssistant = preGenerationRecentMessages
        ? [...preGenerationRecentMessages].reverse().find((message: any) => message.role === "assistant")
        : null;
      if (preGenerationLastAssistant) {
        preGenerationGameStateAnchor = {
          messageId: preGenerationLastAssistant.id,
          swipeIndex: preGenerationLastAssistant.activeSwipeIndex ?? 0,
        };
      }
      let retryMessageId = lastAssistant?.id ?? "";
      let retrySwipeIndex = lastAssistant?.activeSwipeIndex ?? 0;
      activeAgentRun.messageId = retryMessageId || null;
      activeAgentRun.swipeIndex = retryMessageId ? retrySwipeIndex : null;

      const activeMusicPlayerSource =
        musicPlayerEnabled === false
          ? null
          : musicPlayerSource === "youtube" || musicPlayerSource === "custom"
            ? musicPlayerSource
            : "spotify";
      const customAgentImportPolicy = await runRetrySetupPhase(abortController.signal, () =>
        getCustomAgentImportPolicy(app.db),
      );
      const { conn, enabledConfigs, resolvedAgents, warnings } = await runRetrySetupPhase(abortController.signal, () =>
        resolveRetryAgents({
          agentTypes,
          chat,
          conns,
          agentsStore,
          agentPromptTemplateIds,
          activeMusicPlayerSource,
          allowExternalAgentImports: customAgentImportPolicy.enabled,
          onFallback,
        }),
      );
      let customLorebookBackfillTarget: { agentConfigId: string; messageId: string; swipeIndex: number } | null = null;
      if (customLorebookBackfill) {
        const entry = resolvedAgents[0];
        if (!entry || resolvedAgents.length !== 1 || !customAgentUsesLorebookBackfill(entry.resolved)) {
          throw new Error("This custom agent is not configured for lorebook history backfill");
        }
        const settings = getCustomLorebookBackfillSettings(entry.resolved.settings);
        const memory = await runRetrySetupPhase(abortController.signal, () =>
          agentsStore.getMemory(entry.resolved.id, chatId),
        );
        const cursor =
          typeof memory[CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY] === "string"
            ? (memory[CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY] as string)
            : null;
        const chunk = getCustomLorebookBackfillChunk(
          recentMessages,
          getCustomLorebookReadBehindMessages(entry.resolved.settings),
          cursor,
          settings.chunkSize,
          unfilteredRecentMessages,
        );
        if (!chunk) {
          sendSseEvent(reply, {
            type: "custom_lorebook_backfill_empty",
            data: { agentType: entry.resolved.type },
          });
          sendSseEvent(reply, { type: "done", data: "" });
          return;
        }
        const runKey = customLorebookReadBehindRunKey(chatId, entry.resolved.id, chunk.target.id);
        if (!tryClaimCustomLorebookReadBehindRun(activeCustomLorebookReadBehindRuns, runKey)) {
          throw new Error("This custom agent backfill chunk is already running");
        }
        customLorebookReadBehindRunKeys.add(runKey);
        recentMessages = chunk.messages;
        lastAssistant = chunk.target;
        retryMessageId = chunk.target.id;
        retrySwipeIndex = chunk.target.activeSwipeIndex ?? 0;
        activeAgentRun.messageId = retryMessageId;
        activeAgentRun.swipeIndex = retrySwipeIndex;
        historicalGameStateAnchor = resolveLorebookKeeperRetryAnchor(chunk.target);
        entry.resolved.settings = {
          ...entry.resolved.settings,
          contextSize: Math.max(1, chunk.messages.length),
        };
        customLorebookBackfillTarget = {
          agentConfigId: entry.resolved.id,
          ...resolveLorebookKeeperRetryAnchor(chunk.target),
        };
      }
      const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
      const retryWrapFormat = await runRetrySetupPhase(abortController.signal, () =>
        resolveRetryAgentWrapFormat({
          chat,
          chatMode,
          conn,
          presets,
        }),
      );
      const secretPlotDirectorRetry =
        secretPlotRerollMode && resolvedAgents.find((entry) => entry.resolved.type === "director");
      if (secretPlotDirectorRetry) {
        secretPlotDirectorRetry.resolved = {
          ...secretPlotDirectorRetry.resolved,
          promptTemplate: NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
          settings: {
            ...secretPlotDirectorRetry.resolved.settings,
            resultType: "secret_plot",
          },
        };
      }
      const cyoaAgentWillRun = resolvedAgents.some((e) => e.resolved.type === "cyoa");
      const agentContextResult = await runRetrySetupPhase(abortController.signal, () =>
        buildRetryAgentContext({
          cyoaAgentWillRun,
          chatId,
          db: app.db,
          chat,
          chatMeta,
          currentBackground,
          recentMessages,
          resolvedAgents: resolvedAgents.map((entry) => entry.resolved),
          lastAssistant,
          chars,
          gameStateStore,
          lorebooksStore,
          streaming,
          wrapFormat: retryWrapFormat,
          forceIllustratorBackgroundGeneration: isManualIllustratorBackgroundRequest,
          forceIllustratorImageGeneration: isManualIllustratorImageRequest,
          forceCustomImageGeneration: forceImageGeneration === true,
          historicalGameStateAnchor,
        }),
      );
      const agentContext = agentContextResult.agentContext;
      agentContext.signal = abortController.signal;
      const hasPreGenerationRetries = resolvedAgents.some((entry) => entry.resolved.phase === "pre_generation");
      const preGenerationAgentContextResult =
        hasPreGenerationRetries && preGenerationRecentMessages
          ? await runRetrySetupPhase(abortController.signal, () =>
              buildRetryAgentContext({
                cyoaAgentWillRun: false,
                chatId,
                db: app.db,
                chat,
                chatMeta,
                currentBackground,
                recentMessages: preGenerationRecentMessages,
                resolvedAgents: resolvedAgents.map((entry) => entry.resolved),
                lastAssistant: null,
                chars,
                gameStateStore,
                lorebooksStore,
                streaming,
                wrapFormat: retryWrapFormat,
                forceIllustratorBackgroundGeneration: isManualIllustratorBackgroundRequest,
                forceIllustratorImageGeneration: isManualIllustratorImageRequest,
                forceCustomImageGeneration: forceImageGeneration === true,
                historicalGameStateAnchor: preGenerationGameStateAnchor,
                useLatestGameStateFallback: false,
              }),
            )
          : null;
      const preGenerationAgentContext = preGenerationAgentContextResult?.agentContext ?? null;
      if (preGenerationAgentContext) preGenerationAgentContext.signal = abortController.signal;
      await runRetrySetupPhase(abortController.signal, () =>
        persistRetryMacroVariables(
          chats,
          chatId,
          agentContextResult.initialMacroVariables,
          agentContextResult.macroVariables,
          abortController.signal,
        ),
      );
      if (preGenerationAgentContextResult) {
        await runRetrySetupPhase(abortController.signal, () =>
          persistRetryMacroVariables(
            chats,
            chatId,
            preGenerationAgentContextResult.initialMacroVariables,
            preGenerationAgentContextResult.macroVariables,
            abortController.signal,
          ),
        );
      }

      const activeLorebookIds = Array.isArray(chatMeta.activeLorebookIds)
        ? chatMeta.activeLorebookIds.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          )
        : [];
      const lorebookScopeExclusions = resolveLorebookScopeExclusions(chatMode, chatMeta);
      const phaseToolInputs = resolveRetryAgentPhaseToolInputs({
        requestBody: request.body as unknown as Record<string, unknown>,
        agentContext,
        preGenerationAgentContext,
        selectedTargetMessage: lastAssistant,
      });
      const attachAgentTools = async (entries: ResolvedRetryAgent[], toolInputs: RetryAgentPhaseToolInputs) => {
        assertRetrySetupActive();
        if (entries.length === 0) return;
        const context = toolInputs.agentContext;
        const toolAgents = entries.map((entry) => entry.resolved);
        if (customLorebookBackfill) {
          for (const agent of toolAgents) {
            const enabledTools = Array.isArray(agent.settings.enabledTools) ? agent.settings.enabledTools : [];
            agent.settings = {
              ...agent.settings,
              enabledTools: enabledTools.filter((toolName) => toolName === "save_lorebook_entry"),
            };
          }
        }
        if (activeMusicPlayerSource === null) {
          const spotifyToolNames = new Set(DEFAULT_AGENT_TOOLS.spotify ?? []);
          for (const agent of toolAgents) {
            const enabledTools = Array.isArray(agent.settings.enabledTools) ? agent.settings.enabledTools : [];
            agent.settings = {
              ...agent.settings,
              enabledTools: enabledTools.filter(
                (toolName): toolName is string => typeof toolName === "string" && !spotifyToolNames.has(toolName),
              ),
            };
          }
        }
        await resolveAgentGenerationTools({
          requestBody: toolInputs.requestBody,
          chatId,
          chatMetadata: chatMeta,
          chats,
          agentsStore,
          customToolsStore,
          lorebooksStore,
          resolvedAgents: toolAgents,
          enabledConfigs,
          promptCharacterIds: toolInputs.promptCharacterIds,
          personaId:
            typeof context.memory._personaId === "string" && context.memory._personaId.trim()
              ? context.memory._personaId
              : null,
          activeLorebookIds,
          excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
          excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
          gameState: context.gameState,
          gameSpotifyMusicEnabled: activeMusicPlayerSource !== null,
          agentContext: context,
          emitMetadataPatch: (patch) => {
            assertRetrySetupActive();
            sendSseEvent(reply, { type: "metadata_patch", data: patch });
          },
          observeSpotifyPlaybackBeforePlay: true,
        });
        assertRetrySetupActive();
      };
      const preGenerationToolAgents = preGenerationAgentContext
        ? resolvedAgents.filter((entry) => entry.resolved.phase === "pre_generation")
        : [];
      if (phaseToolInputs.preGeneration) {
        await runRetrySetupPhase(abortController.signal, () =>
          attachAgentTools(preGenerationToolAgents, phaseToolInputs.preGeneration!),
        );
      }
      await runRetrySetupPhase(abortController.signal, () =>
        attachAgentTools(
          resolvedAgents.filter((entry) => !preGenerationToolAgents.includes(entry)),
          phaseToolInputs.default,
        ),
      );

      const retryIllustratorPromptAgent = resolvedAgents.find((entry) => entry.resolved.type === "illustrator");
      if (retryIllustratorPromptAgent) {
        try {
          const { styleInstruction } = await runRetrySetupPhase(abortController.signal, () =>
            resolveIllustratorPromptStyle({
              db: app.db,
              connections: conns,
              illustratorAgent: retryIllustratorPromptAgent.resolved,
              chatMode,
              chatMetadata: chatMeta,
            }),
          );
          agentContext.memory._illustratorImageStyleInstruction = styleInstruction;
          if (preGenerationAgentContext) {
            preGenerationAgentContext.memory._illustratorImageStyleInstruction = styleInstruction;
          }
        } catch (error) {
          if (abortController.signal.aborted) throw error;
          logger.warn(error, "[retry-agents] Failed to resolve image style instruction for the prompt writer");
        }
      }
      if (debugMode) {
        const emitRetryAgentDebug = (event: AgentCallDebugEvent) => {
          if (abortController.signal.aborted) return;
          sendSseEvent(reply, { type: "agent_debug", data: event });
        };
        agentContext.agentDebug = emitRetryAgentDebug;
        if (preGenerationAgentContext) preGenerationAgentContext.agentDebug = emitRetryAgentDebug;
      }
      if (secretPlotDirectorRetry && secretPlotRerollMode === "turn_only") {
        try {
          const memory = await runRetrySetupPhase(abortController.signal, () =>
            agentsStore.getMemory(secretPlotDirectorRetry.resolved.id, chatId),
          );
          const state = buildSecretPlotStateFromMemory(memory);
          if (Object.keys(state).length > 0) {
            agentContext.memory._secretPlotState = state;
            if (preGenerationAgentContext) preGenerationAgentContext.memory._secretPlotState = state;
          }
        } catch (err) {
          if (abortController.signal.aborted) throw err;
          logger.warn(err, "[retry-agents] Failed to load Narrative Director secret plot memory");
        }
      }

      assertRetrySetupActive();
      sendSseEvent(reply, { type: "agent_start", data: { phase: "retry" } });
      for (const warning of warnings) {
        assertRetrySetupActive();
        sendSseEvent(reply, { type: "agent_warning", data: warning });
      }
      if (resolvedAgents.length === 0) {
        logger.warn("[retry-agents] No runnable agents resolved for chatId=%s agentTypes=%j", chatId, agentTypes);
        throw new Error(
          "No runnable agents were found for this retry. Add tracker agents to this chat or check their connection settings.",
        );
      }
      // Snapshot force (#4682) is a single-custom-image-agent contract: the flag
      // applies to every image_prompt result in the batch and its directive only
      // makes sense for agents that can emit one, so reject ineligible forced
      // requests up front instead of guarding each downstream effect site.
      const forceScopeError = forceImageGenerationScopeError(
        forceImageGeneration === true,
        resolvedAgents.map((entry) => ({
          isCustomAgent: entry.resolved.isCustomAgent,
          canEmitImagePrompt: customAgentHasCapability(entry.resolved.settings, "trigger_image_generation"),
        })),
      );
      if (forceScopeError) {
        logger.warn(
          "[retry-agents] Rejected forceImageGeneration: %d agents resolved for chatId=%s agentTypes=%j",
          resolvedAgents.length,
          chatId,
          agentTypes,
        );
        throw new Error(forceScopeError);
      }
      const lorebookKeeperAgent = resolvedAgents.find((entry) => entry.resolved.type === "lorebook-keeper") ?? null;
      const customLorebookReadBehindTargets = new Map<
        string,
        { context: AgentContext; messageId: string; swipeIndex: number }
      >();
      const nonLorebookAgents = resolvedAgents.filter((entry) => {
        if (entry.resolved.type === "lorebook-keeper") return false;
        if (customLorebookBackfillTarget) {
          const context = buildHistoricalLorebookKeeperContext(
            agentContext,
            recentMessages,
            customLorebookBackfillTarget.messageId,
          );
          if (!context || entry.resolved.id !== customLorebookBackfillTarget.agentConfigId) return false;
          customLorebookReadBehindTargets.set(entry.resolved.id, {
            context,
            messageId: customLorebookBackfillTarget.messageId,
            swipeIndex: customLorebookBackfillTarget.swipeIndex,
          });
          return true;
        }
        const readBehindMessages = getCustomLorebookReadBehindMessages(entry.resolved.settings);
        const usesCustomLorebookReadBehind = customAgentUsesLorebookReadBehind(entry.resolved);
        if (!usesCustomLorebookReadBehind) return true;

        const target = getLorebookKeeperBackfillTargets(recentMessages, readBehindMessages, null).at(-1);
        if (!target) return false;
        const context = buildHistoricalLorebookKeeperContext(agentContext, recentMessages, target.id);
        if (!context) return false;
        const runKey = customLorebookReadBehindRunKey(chatId, entry.resolved.id, target.id);
        if (!tryClaimCustomLorebookReadBehindRun(activeCustomLorebookReadBehindRuns, runKey)) return false;
        customLorebookReadBehindRunKeys.add(runKey);
        entry.resolved.batchContextKey = `message:${target.id}`;
        customLorebookReadBehindTargets.set(entry.resolved.id, {
          context,
          ...resolveLorebookKeeperRetryAnchor(target),
        });
        return true;
      });
      if (
        (illustratorPromptReviewOverride || isManualIllustratorBackgroundRequest || isManualIllustratorImageRequest) &&
        (nonLorebookAgents.length !== 1 || nonLorebookAgents[0]?.resolved.type !== "illustrator")
      ) {
        throw new Error("Manual Illustrator requests require exactly one resolved Illustrator agent");
      }
      if (cyoaAgentWillRun) {
        logger.info("[retry-agents] CYOA re-roll chatId=%s assistantMessageId=%s", chatId, lastAssistant?.id ?? "none");
      }
      const rawResults = illustratorPromptReviewOverride
        ? [
            {
              agentId: nonLorebookAgents[0]!.resolved.id,
              agentType: "illustrator",
              type: "image_prompt",
              data: { ...illustratorPromptReviewOverride.resultData, shouldGenerate: true },
              tokensUsed: 0,
              durationMs: 0,
              success: true,
              error: null,
            } satisfies AgentResult,
          ]
        : isManualIllustratorBackgroundRequest
          ? [
              {
                agentId: nonLorebookAgents[0]!.resolved.id,
                agentType: "illustrator",
                type: "image_prompt",
                data: {
                  generateBackground: true,
                  reason: "Manual Gallery background request",
                },
                tokensUsed: 0,
                durationMs: 0,
                success: true,
                error: null,
              } satisfies AgentResult,
            ]
          : isManualIllustratorImageRequest
            ? [
                await executeManualIllustratorPromptRequest({
                  app,
                  chat,
                  chatMeta,
                  conns,
                  illustratorEntry: nonLorebookAgents[0]!,
                  agentContext,
                  debugMode,
                }),
              ]
            : nonLorebookAgents.length > 0
              ? await executeRetryBatches(
                  agentContext,
                  nonLorebookAgents,
                  preGenerationAgentContext,
                  conns,
                  chatMode,
                  chatMeta,
                  new Map([...customLorebookReadBehindTargets].map(([agentId, target]) => [agentId, target.context])),
                )
              : [];
      if (abortController.signal.aborted) return;
      const results = rawResults.map(markInvalidJsonAgentResult).map((result) =>
        requireAgentWriteApproval
          ? markRetryLorebookResultForApproval({
              result,
              chatId,
              chatName: (chat as any).name,
              agentContext,
              resolvedAgents: nonLorebookAgents,
            })
          : result,
      );
      let rawLorebookKeeperRunEntries: Array<{ messageId: string; swipeIndex: number; result: AgentResult }> = [];
      if (lorebookKeeperAgent) {
        try {
          rawLorebookKeeperRunEntries = await executeLorebookKeeperRetries({
            lorebookKeeperAgent,
            baseContext: agentContext,
            messages: recentMessages,
            readBehindMessages: getLorebookKeeperSettings(chatMeta).readBehindMessages,
            lastProcessedMessageId:
              (await agentsStore.getLastSuccessfulRunByType("lorebook-keeper", chatId))?.messageId ?? null,
            backfillUnprocessed: lorebookKeeperBackfill,
            lorebooksStore,
            chatId,
            chatName: (chat as any).name,
            requireApproval: requireAgentWriteApproval,
          });
        } catch (err) {
          if (abortController.signal.aborted) return;
          logger.error(err, "[retry-agents] Lorebook Keeper retry failed; applying other agent results");
          sendSseEvent(reply, {
            type: "agent_error",
            data: {
              agentType: "lorebook-keeper",
              agentName: lorebookKeeperAgent.cfg?.name ?? "Lorebook Keeper",
              error: err instanceof Error ? err.message : "Lorebook Keeper failed",
            },
          });
        }
      }
      const lorebookKeeperRunEntries = rawLorebookKeeperRunEntries.map((entry) => ({
        ...entry,
        result: markInvalidJsonAgentResult(entry.result),
      }));
      if (abortController.signal.aborted) return;

      // ── Pre-validate expression results before sending SSE events ──
      // Validation must happen before the SSE send, otherwise the client receives
      // unvalidated expressions that may not have matching sprite files.
      for (const result of results) {
        if (result.success && result.type === "sprite_change" && result.data && typeof result.data === "object") {
          const spriteData = result.data as {
            expressions?: Array<{
              characterId: string;
              characterName?: string;
              expression: string;
              transition?: string;
            }>;
          };
          const availableSprites = agentContext.memory._availableSprites as
            | Array<{ characterId: string; characterName: string; expressions: string[] }>
            | undefined;
          if (Array.isArray(availableSprites)) {
            const rawExpressions = Array.isArray(spriteData.expressions) ? spriteData.expressions : [];
            const validation = validateSpriteExpressionEntries(rawExpressions, availableSprites);
            let validatedExpressions = validation.expressions;
            if (!Array.isArray(spriteData.expressions) && rawExpressions.length === 0) {
              logger.warn("[retry-agents] Expression agent returned no expression entries — filling required targets");
            }
            for (const warning of validation.warnings) {
              logger.warn("[retry-agents] %s", warning.message);
            }
            const requiredExpressionTargetIds = normalizeRequiredSpriteExpressionIds(
              agentContext.memory._expressionTargetIds,
            );
            if (requiredExpressionTargetIds.length > 0) {
              const latestUserExpressionSource =
                [...agentContext.recentMessages]
                  .reverse()
                  .find((message) => message.role === "user" && message.content.trim())?.content ?? "";
              const personaId =
                typeof agentContext.memory._personaId === "string" ? agentContext.memory._personaId : "";
              const sourceTextByCharacterId = new Map<string, string>();
              if (personaId && latestUserExpressionSource.trim()) {
                sourceTextByCharacterId.set(personaId, latestUserExpressionSource);
              }
              const completion = completeRequiredSpriteExpressionEntries(
                validatedExpressions,
                availableSprites,
                requiredExpressionTargetIds,
                {
                  defaultSourceText: agentContext.mainResponse ?? "",
                  sourceTextByCharacterId,
                },
              );
              validatedExpressions = completion.expressions;
              for (const warning of completion.warnings) {
                logger.warn("[retry-agents] %s", warning.message);
              }
            }
            spriteData.expressions = validatedExpressions;
          } else if (!Array.isArray(availableSprites)) {
            // No sprite catalog loaded — drop expressions entirely so unvalidated data is never forwarded
            spriteData.expressions = [];
          }
        }
      }

      for (const result of results) {
        if (abortController.signal.aborted) return;
        if (!customAgentCanEmitRetryResult(result, resolvedAgents)) continue;
        const cfg = resolvedAgents.find((entry) => entry.resolved.type === result.agentType)?.cfg;
        const historicalTarget = customLorebookReadBehindTargets.get(result.agentId);
        sendSseEvent(reply, {
          type: "agent_result",
          data: {
            agentType: result.agentType,
            agentName: cfg?.name ?? result.agentType,
            resultType: result.type,
            data: result.data,
            tokensUsed: result.tokensUsed,
            success: result.success,
            error: result.error,
            durationMs: result.durationMs,
            chatId,
            messageId: historicalTarget?.messageId ?? (retryMessageId || null),
            swipeIndex: historicalTarget?.swipeIndex ?? (retryMessageId ? retrySwipeIndex : null),
            generationId,
          },
        });
      }

      if (cyoaAgentWillRun) {
        const cyoaRetry = results.find((r) => r.agentType === "cyoa");
        if (cyoaRetry && !cyoaRetry.success) {
          logger.warn("[retry-agents] CYOA re-roll failed chatId=%s: %s", chatId, cyoaRetry.error ?? "unknown");
        }
      }

      for (const entry of lorebookKeeperRunEntries) {
        if (abortController.signal.aborted) return;
        if (!customAgentCanEmitRetryResult(entry.result, resolvedAgents)) continue;
        const cfg = lorebookKeeperAgent?.cfg;
        sendSseEvent(reply, {
          type: "agent_result",
          data: {
            agentType: entry.result.agentType,
            agentName: cfg?.name ?? entry.result.agentType,
            resultType: entry.result.type,
            data: entry.result.data,
            tokensUsed: entry.result.tokensUsed,
            success: entry.result.success,
            error: entry.result.error,
            durationMs: entry.result.durationMs,
            chatId,
            messageId: entry.messageId,
            swipeIndex: entry.swipeIndex,
            generationId,
          },
        });
      }

      const permittedResults = results.filter((result) => customAgentCanEmitRetryResult(result, resolvedAgents));
      if (abortController.signal.aborted) return;
      await persistRetryResults(
        agentsStore,
        chatId,
        retryMessageId,
        permittedResults,
        new Map([...customLorebookReadBehindTargets].map(([agentId, target]) => [agentId, target.messageId])),
        abortController.signal,
      );
      for (const entry of lorebookKeeperRunEntries) {
        if (abortController.signal.aborted) return;
        try {
          await agentsStore.saveRun({
            agentConfigId: entry.result.agentId,
            chatId,
            messageId: entry.messageId,
            result: entry.result,
          });
        } catch {
          // Non-critical write; keep processing remaining results.
        }
      }
      if (abortController.signal.aborted) return;
      let customLorebookBackfillEffectStatus: RetryLorebookEffectStatus | null = null;
      await applyRetryResultEffects({
        app,
        reply,
        chatId,
        chat,
        retryMessageId,
        retrySwipeIndex,
        generationId,
        results: customLorebookBackfillTarget
          ? permittedResults.filter((result) => result.type === "lorebook_update")
          : permittedResults,
        agentContext,
        mainResponseRaw: (lastAssistant?.content as string) ?? "",
        lorebooksStore,
        gameStateStore,
        conns,
        chars,
        resolvedAgents: nonLorebookAgents,
        queueImageGenerationRequests,
        reviewImagePromptsBeforeSend,
        illustratorPromptReviewOverride,
        illustratorRetryTargets,
        forceImageGeneration: forceImageGeneration === true,
        debugMode,
        secretPlotRerollMode,
        signal: abortController.signal,
        onLorebookEffectStatus: customLorebookBackfillTarget
          ? (agentId, status) => {
              if (agentId === customLorebookBackfillTarget.agentConfigId) {
                customLorebookBackfillEffectStatus = status;
              }
            }
          : undefined,
      });

      if (customLorebookBackfillTarget && customLorebookBackfillEffectStatus === "applied") {
        // Backfill exposes only idempotent lorebook writes, so a cursor write
        // failure can safely retry this chunk without duplicating effects.
        await agentsStore.setMemory(
          customLorebookBackfillTarget.agentConfigId,
          chatId,
          CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY,
          customLorebookBackfillTarget.messageId,
        );
      }

      if (abortController.signal.aborted) return;
      sendSseEvent(reply, { type: "done", data: "" });
    } catch (err) {
      if (abortController.signal.aborted) return;
      const message =
        err instanceof Error
          ? (err as { cause?: unknown }).cause instanceof Error
            ? `${err.message}: ${(err as { cause?: Error }).cause!.message}`
            : err.message
          : "Agent retry failed";
      sendSseEvent(reply, { type: "error", data: message });
    } finally {
      const activeRunsForChat = activeAgentRuns.get(chatId);
      activeRunsForChat?.delete(activeAgentRun);
      if (activeRunsForChat?.size === 0) activeAgentRuns.delete(chatId);
      for (const runKey of customLorebookReadBehindRunKeys) {
        activeCustomLorebookReadBehindRuns.delete(runKey);
      }
      stopSseKeepalive();
      reply.raw.off("close", onClientClose);
      if (!clientDisconnected && isSseReplyWritable(reply)) {
        reply.raw.end();
      }
    }
  });
}
