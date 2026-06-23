import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import {
  BUILT_IN_AGENTS,
  BUILT_IN_TOOLS,
  DEFAULT_AGENT_TOOLS,
  getDefaultAgentPrompt,
  applyQuestUpdatesToPlayerStats,
  applyTrackerFieldLocksToGameStatePatch,
  getDefaultBuiltInAgentSettings,
  NARRATIVE_DIRECTOR_SECRET_PLOT_PROMPT,
  customAgentHasCapability,
  isAgentAvailableInChatMode,
  isAgentConfigDeleted,
  normalizeAgentPromptTemplateSelectionMap,
  resolveAgentPromptTemplate,
  stripMacroComments,
  findKnownModel,
  type AgentCallDebugEvent,
  type AgentContext,
  type AgentResult,
  type APIProvider,
  type ChatMode,
  type GameMap,
  type WrapFormat,
} from "@marinara-engine/shared";
import { eq } from "drizzle-orm";
import { listCharacterSprites } from "../../services/game/sprite.service.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import {
  AGENT_PHASE_MAX_CONCURRENT_GROUPS,
  normalizeAgentMaxParallelJobs,
  settleAgentJobsWithConcurrencyLimit,
  type ResolvedAgent,
} from "../../services/agents/agent-pipeline.js";
import { executeAgent, executeAgentBatch, normalizeAgentContextSize } from "../../services/agents/agent-executor.js";
import type { LLMToolDefinition } from "../../services/llm/base-provider.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../../services/llm/local-sidecar.js";
import { createLLMProvider } from "../../services/llm/provider-registry.js";
import { sidecarModelService } from "../../services/sidecar/sidecar-model.service.js";
import { buildSpotifyDjConstraints } from "../../services/spotify/spotify-dj-constraints.js";
import { resolveSpotifyCredentials } from "../../services/spotify/spotify.service.js";
import { fingerprintChatSummary } from "../../services/prompt/chat-summary-fingerprint.js";
import {
  buildPromptMacroContext,
  resolveCharacterMacroData,
  resolvePromptIdleDuration,
  resolvePromptMessageMacros,
} from "../../services/prompt/index.js";
import { getAssetManifest } from "../../services/game/asset-manifest.service.js";
import { createAgentsStorage } from "../../services/storage/agents.storage.js";
import { createCharactersStorage } from "../../services/storage/characters.storage.js";
import { createChatsStorage } from "../../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { createPromptsStorage } from "../../services/storage/prompts.storage.js";
import { findLastUserMessageIdBefore } from "../../services/generation/message-history.js";
import { textRewriteDropsProtectedMarkup } from "../../services/generation/text-rewrite-safety.js";
import { resolveConnectionImageDefaults } from "../../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../../services/image/image-prompt-compiler.js";
import { createGameStateStorage } from "../../services/storage/game-state.storage.js";
import { createLorebooksStorage } from "../../services/storage/lorebooks.storage.js";
import { syncGameMapMetaPartyPosition } from "../../services/game/map-position.service.js";
import { gameStateSnapshots as gameStateSnapshotsTable } from "../../db/schema/index.js";
import {
  buildLockedPlayerStatsArrayPatch,
  buildLockedPersonaTrackerPatch,
  isMessageHiddenFromAI,
  parseExtra,
  parseStoredGenerationParameters,
  parseGameStateRow,
  parseSnapshotPlayerStats,
  preserveTrackerCharacterUiFields,
  resolveActiveCharacterIds,
  resolveBaseUrl,
  resolveRoleplayChatSummary,
  resolveVisibleGameStateAnchor,
} from "./generate-route-utils.js";
import {
  buildHistoricalLorebookKeeperContext,
  getLorebookKeeperBackfillTargets,
  getLorebookKeeperSettings,
  loadLorebookKeeperExistingEntries,
  persistLorebookKeeperUpdates,
  resolveLorebookKeeperTarget,
} from "./lorebook-keeper-utils.js";
import {
  agentWriteApprovalRequired,
  buildLorebookWriteApprovalProposal,
  isAgentWriteApprovalEnvelope,
} from "./agent-write-approval.js";
import { filterGameInternalAgentIds } from "../../services/lorebook/game-lorebook-scope.js";
import { sendSseEvent, startSseKeepalive, startSseReply } from "./sse.js";
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
import { ILLUSTRATOR_TEXT_NEGATIVE_PROMPT, resolveIllustratorCharacterReferences } from "./illustrator-references.js";
import {
  applyTextRewriteAgentChatSettings,
  mergePairedBuiltInRewriteAgents,
  normalizeProseGuardianPromptTemplate,
} from "../../services/generation/prose-guardian-settings.js";
import { applyKnowledgeAgentChatSettings } from "../../services/generation/knowledge-agent-settings.js";
import { normalizeContextInjections } from "./agent-normalizers.js";
import { executeToolCalls, type MetadataPatchInput } from "../../services/tools/tool-executor.js";

type PersonaContext = {
  personaId: string | null;
  personaName: string;
  personaDescription: string;
  personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string };
  personaAvatarPath?: string | null;
  personaStats: any;
  rpgStats: any;
};

function resolveIllustratorImageSize(
  size: { width: number; height: number },
  aspectRatio: unknown,
): { width: number; height: number } {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const aspect = typeof aspectRatio === "string" ? aspectRatio.trim().toLowerCase() : "";
  if (aspect === "portrait") {
    return width <= height ? { width, height } : { width: height, height: width };
  }
  if (aspect === "landscape") {
    return width >= height ? { width, height } : { width: height, height: width };
  }
  if (aspect === "square") {
    const side = Math.min(width, height);
    return { width: side, height: side };
  }
  return { width, height };
}

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

type ResolvedRetryAgent = {
  cfg: any;
  resolved: ResolvedAgent;
  agentProvider: any;
  agentModel: string;
};

const BUILT_IN_AGENT_TYPE_SET = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));

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
  if (BUILT_IN_AGENT_TYPE_SET.has(result.agentType)) return true;
  const agent = findRetryResultAgent(result, agents);
  return agent ? customAgentHasCapability(agent.settings, capability) : false;
}

function customAgentCanEmitRetryResult(result: AgentResult, agents: ResolvedRetryAgent[]): boolean {
  if (BUILT_IN_AGENT_TYPE_SET.has(result.agentType)) return true;
  switch (result.type) {
    case "text_rewrite":
      return customAgentCanApplyRetryResult(result, agents, "edit_messages");
    case "lorebook_update":
      return (
        customAgentCanApplyRetryResult(result, agents, "edit_lorebooks") ||
        customAgentCanApplyRetryResult(result, agents, "create_lorebooks")
      );
    case "game_state_update":
    case "character_tracker_update":
    case "persona_stats_update":
    case "custom_tracker_update":
    case "quest_update":
      return customAgentCanApplyRetryResult(result, agents, "edit_trackers");
    case "image_prompt":
      return customAgentCanApplyRetryResult(result, agents, "trigger_image_generation");
    case "prompt_patch":
      return customAgentCanApplyRetryResult(result, agents, "edit_main_prompt");
    case "frontend_theme_update":
      return customAgentCanApplyRetryResult(result, agents, "change_frontend_styling");
    default:
      return true;
  }
}

function applyDefaultBuiltInAgentTools(agentType: string, settings: unknown): Record<string, unknown> {
  const next =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  if (!BUILT_IN_AGENT_TYPE_SET.has(agentType)) return next;

  const currentTools = next.enabledTools;
  if (!Array.isArray(currentTools)) {
    const defaults = DEFAULT_AGENT_TOOLS[agentType] ?? [];
    if (defaults.length > 0) next.enabledTools = [...defaults];
    return next;
  }

  if (agentType === "spotify" && currentTools.length === 0) {
    next.enabledTools = [...(DEFAULT_AGENT_TOOLS.spotify ?? [])];
  }

  return next;
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
  agentContext: AgentContext;
  resolvedAgents: ResolvedRetryAgent[];
}): AgentResult {
  const { result, chatId, agentContext, resolvedAgents } = args;
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

  const entry = resolvedAgents.find((candidate) => candidate.resolved.type === result.agentType);
  const preferredTargetLorebookId =
    typeof agentContext.memory._lorebookKeeperTargetLorebookId === "string"
      ? (agentContext.memory._lorebookKeeperTargetLorebookId as string)
      : null;
  const writableLorebookIds = agentContext.writableLorebookIds;
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

async function resolveRetryAgentWrapFormat(args: {
  chat: any;
  chatMode: ChatMode;
  conn: any | null;
  presets: ReturnType<typeof createPromptsStorage>;
}): Promise<WrapFormat> {
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

function musicAgentUsesYoutube(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.musicProvider === "youtube" || settings?.musicPlayerSource === "youtube";
}

function musicAgentUsesCustom(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.musicProvider === "custom" || settings?.musicPlayerSource === "custom";
}

function applyRetryMusicPlayerSource(
  settings: Record<string, unknown>,
  activeMusicPlayerSource: "spotify" | "youtube" | "custom" | null | undefined,
): Record<string, unknown> {
  if (!activeMusicPlayerSource) return settings;
  return {
    ...settings,
    musicProvider: activeMusicPlayerSource,
    musicPlayerSource: activeMusicPlayerSource,
    enabledTools: activeMusicPlayerSource === "spotify" ? (DEFAULT_AGENT_TOOLS.spotify ?? []) : [],
  };
}

function resolveRetryAgentRuntimePhase(agentType: string, configuredPhase: string): string {
  if (agentType === "prose-guardian" || agentType === "continuity") return "post_processing";
  return configuredPhase;
}

function getRetryAgentFallbackPrompt(agentType: string, settings: Record<string, unknown>): string {
  if (agentType === "spotify" && musicAgentUsesYoutube(settings)) {
    return getDefaultAgentPrompt("youtube");
  }
  if (agentType === "spotify" && musicAgentUsesCustom(settings)) {
    return getDefaultAgentPrompt("local-music");
  }
  return getDefaultAgentPrompt(agentType);
}

function getGameImageStylePrompt(chat: any, chatMeta: Record<string, unknown>): string {
  if (((chat as any).mode ?? "conversation") !== "game") return "";
  const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
  return typeof setupConfig.artStylePrompt === "string" ? setupConfig.artStylePrompt.trim() : "";
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
  const persona =
    (chat.personaId ? allPersonas.find((p: any) => p.id === chat.personaId) : null) ??
    allPersonas.find((p: any) => p.isActive === "true");

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

async function buildRetryAgentContext(args: {
  cyoaAgentWillRun: boolean;
  chatId: string;
  db: Parameters<typeof buildPromptMacroContext>[0]["db"];
  chat: any;
  chatMeta: Record<string, unknown>;
  recentMessages: any[];
  enabledConfigs: any[];
  resolvedAgentTypes: Set<string>;
  lastAssistant: any;
  chars: ReturnType<typeof createCharactersStorage>;
  gameStateStore: ReturnType<typeof createGameStateStorage>;
  lorebooksStore: ReturnType<typeof createLorebooksStorage>;
  streaming: boolean;
  wrapFormat: WrapFormat;
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
    recentMessages,
    enabledConfigs,
    resolvedAgentTypes,
    lastAssistant,
    chars,
    gameStateStore,
    lorebooksStore,
    streaming,
    wrapFormat,
    historicalGameStateAnchor,
    useLatestGameStateFallback = true,
  } = args;

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
    });
  }

  const personaContext = await resolvePersonaContext(chars, chat);
  const promptMacroContext = await buildPromptMacroContext({
    db,
    characterIds,
    personaName: personaContext.personaName,
    personaDescription: personaContext.personaDescription,
    personaFields: personaContext.personaFields,
    variables: {},
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
  const agentContextSize =
    enabledConfigs.length > 0
      ? Math.max(
          ...enabledConfigs.map((c: any) => {
            const settings = typeof c.settings === "string" ? JSON.parse(c.settings) : (c.settings ?? {});
            return normalizeAgentContextSize(settings.contextSize);
          }),
        )
      : 5;

  const agentSlice = recentMessages.slice(-agentContextSize);
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
    activatedLorebookEntries: null,
    writableLorebookIds: null,
    chatSummary: resolveRoleplayChatSummary(chatMode, chatMeta),
    streaming,
    memory: {},
  };

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
    const { writableLorebookIds, targetLorebookId, targetLorebookName } = await resolveLorebookKeeperTarget({
      lorebooksStore,
      chatId,
      characterIds,
      personaId: personaContext.personaId,
      activeLorebookIds,
      preferredTargetLorebookId: lorebookKeeperSettings.targetLorebookId,
    });
    agentContext.writableLorebookIds = writableLorebookIds;
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

  if (historicalGameStateAnchor) {
    const snap = await gameStateStore.getByChatAndMessage(
      chatId,
      historicalGameStateAnchor.messageId,
      historicalGameStateAnchor.swipeIndex,
    );
    if (snap) {
      agentContext.gameState = parseGameStateRow(snap as Record<string, unknown>);
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
      agentContext.gameState = parseGameStateRow(latestGS as Record<string, unknown>);
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
        originalName?: string | null;
        tags: string[];
        source?: "user" | "game_asset";
      }> = [];
      const bgDir = join(DATA_DIR, "backgrounds");
      if (existsSync(bgDir)) {
        const exts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
        const files = readdirSync(bgDir).filter((f: string) => exts.has(extname(f).toLowerCase()));
        let meta: Record<string, { originalName?: string; tags: string[] }> = {};
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
            originalName: meta[f]?.originalName ?? null,
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
            originalName: entry.tag,
            tags: entry.subcategory ? [entry.subcategory] : [],
            source: "game_asset" as const,
          })),
      );
      agentContext.memory._availableBackgrounds = availableBackgrounds;
      agentContext.memory._currentBackground = chatMeta.background ?? null;
    } catch (err) {
      logger.warn(err, "[retry-agents] Failed to load available backgrounds for retry");
    }
  }

  const spotifyRetryConfig = enabledConfigs.find((config) => config.type === "spotify");
  const spotifyMusicSettings = parseSettingsRecord(spotifyRetryConfig?.settings);
  const spotifyMusicUsesYoutube = musicAgentUsesYoutube(spotifyMusicSettings);
  const spotifyMusicUsesCustom = musicAgentUsesCustom(spotifyMusicSettings);

  if (resolvedAgentTypes.has("youtube") || (resolvedAgentTypes.has("spotify") && spotifyMusicUsesYoutube)) {
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

  if (resolvedAgentTypes.has("spotify") && spotifyMusicUsesCustom) {
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

  if (resolvedAgentTypes.has("spotify") && !spotifyMusicUsesYoutube && !spotifyMusicUsesCustom) {
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

  return agentContext;
}

async function resolveRetryAgents(args: {
  agentTypes: string[];
  chat: any;
  conns: ReturnType<typeof createConnectionsStorage>;
  agentsStore: ReturnType<typeof createAgentsStorage>;
  activeMusicPlayerSource?: "spotify" | "youtube" | "custom" | null;
}): Promise<ResolvedRetryAgents> {
  const { agentTypes, chat, conns, agentsStore, activeMusicPlayerSource } = args;
  const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
  const chatMeta = parseExtra((chat as { metadata?: unknown }).metadata);
  const agentPromptTemplateSelections = normalizeAgentPromptTemplateSelectionMap(chatMeta.agentPromptTemplateIds);
  const normalizedAgentTypes = agentTypes.map((agentType) => (agentType === "youtube" ? "spotify" : agentType));
  const agentTypeSet = new Set(
    filterGameInternalAgentIds(chatMode, normalizedAgentTypes).filter((agentType) =>
      isAgentAvailableInChatMode(chatMode, agentType),
    ),
  );
  const configs = await agentsStore.list();
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
    (config: any) => !isAgentConfigDeleted(config.settings) && agentTypeSet.has(config.type),
  );
  const resolvedTypeSet = new Set(enabledConfigs.map((config: any) => config.type));
  const builtInFallbackConfigs = BUILT_IN_AGENTS.filter(
    (agent) => agentTypeSet.has(agent.id) && !resolvedTypeSet.has(agent.id),
  );

  const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
  const gameSceneConnectionId =
    typeof chatMeta.gameSceneConnectionId === "string" ? chatMeta.gameSceneConnectionId.trim() : "";
  const setupSceneConnectionId =
    typeof setupConfig.sceneConnectionId === "string" ? setupConfig.sceneConnectionId.trim() : "";
  const defaultAgentConn = await conns.getDefaultForAgents();
  type RetryAgentConnectionResolution = {
    entry: {
      connectionId: string | null;
      provider: any;
      model: string;
      customParameters: Record<string, unknown>;
      maxOutputTokens: number | null;
      maxParallelJobs: number;
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
    connForPromptDefaults ??= storedConn;
    return {
      entry: {
        connectionId,
        provider: createLLMProvider(
          storedConn.provider,
          baseUrl,
          storedConn.apiKey,
          storedConn.maxContext,
          storedConn.openrouterProvider,
          storedConn.maxTokensOverride,
        ),
        model,
        customParameters: parseStoredGenerationParameters(storedConn.defaultParameters)?.customParameters ?? {},
        maxOutputTokens: knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null,
        maxParallelJobs: Number(storedConn.maxParallelJobs) || 1,
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
  const resolvedAgents: ResolvedRetryAgent[] = [];
  const skippedLocalSidecarAgents: string[] = [];
  const defaultAgentConnectionAgents: string[] = [];
  const localSidecarAvailableForTrackers =
    sidecarModelService.getConfig().useForTrackers && sidecarModelService.getConfiguredModelRef() !== null;
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

    if (isLocalSidecarConnectionId(connectionId) && localSidecarAvailableForTrackers) {
      return {
        entry: {
          connectionId,
          provider: getLocalSidecarProvider(),
          model: LOCAL_SIDECAR_MODEL,
          customParameters: {},
          maxOutputTokens: null,
          maxParallelJobs: 1,
        },
      };
    }

    const agentConn = await conns.getWithKey(connectionId);
    if (!agentConn) {
      return { entry: null, unavailableReason: "the configured connection was deleted" };
    }

    return resolveStoredRetryConnection(connectionId, agentConn);
  };
  const defaultAgentConnection = defaultAgentConn
    ? await resolveRetryAgentConnection(defaultAgentConn.id as string)
    : null;

  for (const cfg of enabledConfigs) {
    const effectiveConnectionId = resolveAgentConnectionId({
      requestedConnectionId: cfg.connectionId as string | null,
      defaultAgentConnectionId: defaultAgentConn?.id ?? null,
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

    const rawSettings = typeof cfg.settings === "string" ? JSON.parse(cfg.settings) : (cfg.settings ?? {});
    let settings = applyDefaultBuiltInAgentTools(cfg.type, rawSettings);
    if (cfg.type === "spotify") {
      settings = applyRetryMusicPlayerSource(settings, activeMusicPlayerSource);
    }
    settings = applyTextRewriteAgentChatSettings(cfg.type as string, settings, chatMeta);
    settings = applyKnowledgeAgentChatSettings(cfg.type as string, settings, chatMeta);
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: cfg.type as string,
      promptTemplate: normalizeProseGuardianPromptTemplate(cfg.type as string, cfg.promptTemplate),
      fallbackPromptTemplate: getRetryAgentFallbackPrompt(cfg.type as string, settings),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[cfg.type as string] ?? null,
    });

    resolvedAgents.push({
      cfg,
      resolved: {
        id: cfg.id,
        type: cfg.type,
        name: cfg.name,
        phase: resolveRetryAgentRuntimePhase(cfg.type as string, cfg.phase as string),
        promptTemplate: selectedPromptTemplate,
        connectionId: effectiveConnectionId,
        settings,
        customParameters: agentConnection.entry.customParameters,
        maxOutputTokens: agentConnection.entry.maxOutputTokens,
        provider: agentConnection.entry.provider,
        model: agentConnection.entry.model,
        maxParallelJobs: agentConnection.entry.maxParallelJobs,
      },
      agentProvider: agentConnection.entry.provider,
      agentModel: agentConnection.entry.model,
    });
  }

  const warnings =
    skippedLocalSidecarAgents.length > 0 ? [buildLocalSidecarUnavailableWarning(skippedLocalSidecarAgents)] : [];

  for (const builtIn of builtInFallbackConfigs) {
    const builtInConnection = defaultAgentConn ? defaultAgentConnection : await resolveRetryAgentConnection(null);
    if (!builtInConnection?.entry) {
      addUnavailableConnectionWarning(builtIn.name, builtInConnection ?? {});
      logger.warn(
        "[retry-agents] Skipping built-in agent %s because its connection is unavailable: %s",
        builtIn.id,
        builtInConnection?.unavailableReason ?? "unknown reason",
      );
      continue;
    }
    if (defaultAgentConn) defaultAgentConnectionAgents.push(builtIn.name);

    let settings = applyDefaultBuiltInAgentTools(builtIn.id, getDefaultBuiltInAgentSettings(builtIn.id));
    if (builtIn.id === "spotify") {
      settings = applyRetryMusicPlayerSource(settings, activeMusicPlayerSource);
    }
    settings = applyTextRewriteAgentChatSettings(builtIn.id, settings, chatMeta);
    settings = applyKnowledgeAgentChatSettings(builtIn.id, settings, chatMeta);
    const selectedPromptTemplate = resolveAgentPromptTemplate({
      agentType: builtIn.id,
      promptTemplate: "",
      fallbackPromptTemplate: getRetryAgentFallbackPrompt(builtIn.id, settings),
      settings,
      selectedPromptTemplateId: agentPromptTemplateSelections[builtIn.id] ?? null,
    });

    resolvedAgents.push({
      cfg: { id: `builtin:${builtIn.id}`, type: builtIn.id, name: builtIn.name } as any,
      resolved: {
        id: `builtin:${builtIn.id}`,
        type: builtIn.id,
        name: builtIn.name,
        phase: resolveRetryAgentRuntimePhase(builtIn.id, builtIn.phase),
        promptTemplate: selectedPromptTemplate,
        connectionId: builtInConnection.entry.connectionId,
        settings,
        customParameters: builtInConnection.entry.customParameters,
        maxOutputTokens: builtInConnection.entry.maxOutputTokens,
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

  if (defaultAgentConn && defaultAgentConnectionAgents.length > 0) {
    warnings.push(
      buildDefaultAgentConnectionWarning({
        agentNames: defaultAgentConnectionAgents,
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

function toLLMToolDefinition(toolName: string): LLMToolDefinition | null {
  const tool = BUILT_IN_TOOLS.find((entry) => entry.name === toolName);
  if (!tool) return null;
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  };
}

const CHAT_METADATA_TOOL_NAMES = new Set([
  "read_chat_summary",
  "append_chat_summary",
  "read_chat_variable",
  "write_chat_variable",
]);
const LOREBOOK_WRITE_TOOL_NAME = "save_lorebook_entry";

function resolveRetryAgentWritableLorebookId(settings: Record<string, unknown>): string | null {
  const enabledTools = Array.isArray(settings.enabledTools) ? settings.enabledTools : [];
  const lorebookWriteEnabled =
    settings.lorebookWriteEnabled === true || enabledTools.includes(LOREBOOK_WRITE_TOOL_NAME);
  if (!lorebookWriteEnabled) return null;
  for (const key of ["writableLorebookId", "targetLorebookId"]) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const writableIds = settings.writableLorebookIds;
  if (Array.isArray(writableIds)) {
    const first = writableIds.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (first) return first.trim();
  }
  return null;
}

async function attachRetryLorebookWriterToolContexts(args: {
  lorebooksStore: ReturnType<typeof createLorebooksStorage>;
  resolvedAgents: ResolvedRetryAgent[];
  requireApproval: boolean;
  chatId: string;
}) {
  const { lorebooksStore, resolvedAgents, requireApproval, chatId } = args;
  const tool = toLLMToolDefinition(LOREBOOK_WRITE_TOOL_NAME);
  if (!tool) return;

  for (const entry of resolvedAgents) {
    const settings = parseSettingsRecord(entry.resolved.settings);
    const writableLorebookId = resolveRetryAgentWritableLorebookId(settings);
    if (!writableLorebookId) continue;

    const existingContext = entry.resolved.toolContext;
    const tools = existingContext?.tools.some((item) => item.function.name === LOREBOOK_WRITE_TOOL_NAME)
      ? [...existingContext.tools]
      : [...(existingContext?.tools ?? []), tool];

    entry.resolved.toolContext = {
      tools,
      executeToolCall: async (call) => {
        if (call.function.name !== LOREBOOK_WRITE_TOOL_NAME) {
          if (existingContext) return existingContext.executeToolCall(call);
          return JSON.stringify({
            error: `Tool not allowed for agent ${entry.resolved.type}: ${call.function.name}`,
            allowed: [LOREBOOK_WRITE_TOOL_NAME],
          });
        }

        const saveLorebookEntry = async (loreEntry: {
          name: string;
          content: string;
          description?: string;
          keys: string[];
          tag?: string;
          mode: "create" | "replace" | "append";
        }) => {
          // When agent write-approval is required, never write inline — surface a
          // proposal envelope (mirroring the structured lorebook_update gate) so the
          // user approves the write before it touches the lorebook DB.
          if (requireApproval) {
            return {
              requiresApproval: true,
              approval: buildLorebookWriteApprovalProposal({
                chatId,
                agentType: entry.resolved.type,
                agentName: entry.cfg?.name ?? entry.resolved.name ?? entry.resolved.type,
                updates: [
                  {
                    action: loreEntry.mode === "create" ? "create" : "update",
                    name: loreEntry.name,
                    content: loreEntry.content,
                    description: loreEntry.description ?? "",
                    keys: loreEntry.keys,
                    tag: loreEntry.tag ?? "",
                    mode: loreEntry.mode,
                  },
                ],
                preferredTargetLorebookId: writableLorebookId,
                writableLorebookIds: [writableLorebookId],
              }),
            };
          }

          const targetLorebook = await lorebooksStore.getById(writableLorebookId);
          if (!targetLorebook) {
            return { error: "Selected lorebook is no longer available.", lorebookId: writableLorebookId };
          }
          const existingEntries = await lorebooksStore.listEntries(writableLorebookId);
          const normalizedName = loreEntry.name.trim().toLocaleLowerCase();
          const existing = existingEntries.find(
            (candidate: any) =>
              typeof candidate.name === "string" && candidate.name.trim().toLocaleLowerCase() === normalizedName,
          ) as any;
          const keys = Array.from(new Set(loreEntry.keys.map((key) => key.trim()).filter(Boolean)));

          if (!existing || loreEntry.mode === "create") {
            const created = await lorebooksStore.createEntry({
              lorebookId: writableLorebookId,
              name: loreEntry.name,
              content: loreEntry.content,
              description: loreEntry.description ?? "",
              keys,
              tag: loreEntry.tag ?? "",
              enabled: true,
              constant: false,
              selective: false,
              position: 0,
              depth: 4,
              role: "system",
            });
            return {
              applied: true,
              action: "created",
              lorebookId: writableLorebookId,
              lorebookName: (targetLorebook as any).name,
              entryId: (created as any)?.id ?? null,
              name: loreEntry.name,
              sourceAgentId: entry.resolved.id,
            };
          }

          const existingContent = typeof existing.content === "string" ? existing.content : "";
          const nextContent =
            loreEntry.mode === "append" && existingContent.trim()
              ? existingContent.includes(loreEntry.content)
                ? existingContent
                : `${existingContent.trim()}\n\n${loreEntry.content}`
              : loreEntry.content;
          const existingKeys = Array.isArray(existing.keys)
            ? existing.keys.filter((key: unknown): key is string => typeof key === "string")
            : [];
          const updated = await lorebooksStore.updateEntry(existing.id, {
            content: nextContent,
            description: loreEntry.description ?? existing.description ?? "",
            keys: Array.from(new Set([...existingKeys, ...keys])),
            ...(loreEntry.tag !== undefined ? { tag: loreEntry.tag } : {}),
            enabled: true,
          });
          return {
            applied: true,
            action: loreEntry.mode === "append" ? "appended" : "replaced",
            lorebookId: writableLorebookId,
            lorebookName: (targetLorebook as any).name,
            entryId: (updated as any)?.id ?? existing.id,
            name: loreEntry.name,
            sourceAgentId: entry.resolved.id,
          };
        };

        const results = await executeToolCalls([call], { saveLorebookEntry });
        return results[0]?.result ?? "Tool execution failed";
      },
    };
  }
}

async function attachRetryChatMetadataToolContexts(args: {
  chats: ReturnType<typeof createChatsStorage>;
  chatId: string;
  chatMeta: Record<string, unknown>;
  resolvedAgents: ResolvedRetryAgent[];
}) {
  const { chats, chatId, chatMeta, resolvedAgents } = args;

  const updateChatMetadataForTools = async (patchOrUpdater: MetadataPatchInput) => {
    let emittedPatch: Record<string, unknown> = {};
    const updatedChat = await chats.patchMetadata(chatId, async (currentMeta) => {
      const patch = typeof patchOrUpdater === "function" ? await patchOrUpdater({ ...currentMeta }) : patchOrUpdater;
      emittedPatch = patch;
      return patch;
    });
    const updatedMeta = updatedChat ? parseExtra(updatedChat.metadata) : { ...chatMeta, ...emittedPatch };
    for (const key of Object.keys(chatMeta)) {
      if (!(key in updatedMeta)) delete chatMeta[key];
    }
    Object.assign(chatMeta, updatedMeta);
    return updatedMeta;
  };

  for (const entry of resolvedAgents) {
    if (entry.resolved.toolContext?.tools.length) continue;
    const settings = parseSettingsRecord(entry.resolved.settings);
    const enabledNames = Array.isArray(settings.enabledTools) ? (settings.enabledTools as string[]) : [];
    const metadataToolNames = enabledNames.filter((name) => CHAT_METADATA_TOOL_NAMES.has(name));
    if (metadataToolNames.length === 0) continue;

    const tools = metadataToolNames
      .map((name) => toLLMToolDefinition(name))
      .filter((tool): tool is LLMToolDefinition => tool !== null);
    if (tools.length === 0) continue;

    const allowedToolNames = new Set(tools.map((tool) => tool.function.name));
    entry.resolved.toolContext = {
      tools,
      executeToolCall: async (call) => {
        if (!allowedToolNames.has(call.function.name)) {
          return JSON.stringify({
            error: `Tool not allowed for agent ${entry.resolved.type}: ${call.function.name}`,
            allowed: Array.from(allowedToolNames),
          });
        }
        const results = await executeToolCalls([call], {
          chatMeta,
          onUpdateMetadata: updateChatMetadataForTools,
        });
        return results[0]?.result ?? "Tool execution failed";
      },
    };
  }
}

async function attachRetrySpotifyToolContexts(args: {
  agentsStore: ReturnType<typeof createAgentsStorage>;
  chats: ReturnType<typeof createChatsStorage>;
  chatId: string;
  chatMeta: Record<string, unknown>;
  resolvedAgents: ResolvedRetryAgent[];
}) {
  const { agentsStore, chats, chatId, chatMeta, resolvedAgents } = args;
  const spotifyToolNames = new Set(DEFAULT_AGENT_TOOLS.spotify ?? []);
  let spotifyAccessToken: string | null = null;
  let spotifyError: string | null = null;
  let spotifyCredentialsResolved = false;

  const updateChatMetadataForTools = async (patchOrUpdater: MetadataPatchInput) => {
    let emittedPatch: Record<string, unknown> = {};
    const updatedChat = await chats.patchMetadata(chatId, async (currentMeta) => {
      const patch = typeof patchOrUpdater === "function" ? await patchOrUpdater({ ...currentMeta }) : patchOrUpdater;
      emittedPatch = patch;
      return patch;
    });
    const updatedMeta = updatedChat ? parseExtra(updatedChat.metadata) : { ...chatMeta, ...emittedPatch };
    for (const key of Object.keys(chatMeta)) {
      if (!(key in updatedMeta)) delete chatMeta[key];
    }
    Object.assign(chatMeta, updatedMeta);
    return updatedMeta;
  };

  for (const entry of resolvedAgents) {
    if (entry.resolved.toolContext?.tools.length) continue;
    const settings = parseSettingsRecord(entry.resolved.settings);
    const enabledNames = Array.isArray(settings.enabledTools) ? (settings.enabledTools as string[]) : [];
    // YouTube-mode Music DJ is a pure-JSON agent (no tools) — don't backfill the
    // Spotify tools, or it runs as a tool-caller and never emits a youtube_control result.
    const spotifyEnabledNames =
      entry.resolved.type === "spotify" &&
      !musicAgentUsesYoutube(settings) &&
      !musicAgentUsesCustom(settings) &&
      enabledNames.length === 0
        ? [...spotifyToolNames]
        : enabledNames.filter((name) => spotifyToolNames.has(name));
    if (spotifyEnabledNames.length === 0) continue;

    const tools = spotifyEnabledNames
      .map((name) => toLLMToolDefinition(name))
      .filter((tool): tool is LLMToolDefinition => tool !== null);
    if (tools.length === 0) continue;

    if (!spotifyCredentialsResolved) {
      spotifyCredentialsResolved = true;
      const credentials = await resolveSpotifyCredentials(agentsStore, { agentId: entry.resolved.id });
      if ("accessToken" in credentials) {
        spotifyAccessToken = credentials.accessToken;
      } else {
        spotifyError = credentials.error;
        logger.warn("[retry-agents] Spotify credentials unavailable: %s", credentials.error);
      }
    }

    const allowedToolNames = new Set(tools.map((tool) => tool.function.name));
    if (entry.resolved.type === "spotify") {
      entry.resolved.phase = "post_processing";
      entry.resolved.settings = {
        ...settings,
        enabledTools: spotifyEnabledNames,
      };
      (entry.resolved as any).__spotifyToolCalls = new Set<string>();
      (entry.resolved as any).__spotifyPlayApplied = false;
      (entry.resolved as any).__spotifyPlayError = null;
      (entry.resolved as any).__spotifyToolError = spotifyError;
      (entry.resolved as any).__spotifyPlaybackPending = false;
    }
    entry.resolved.toolContext = {
      tools,
      executeToolCall: async (call) => {
        const spotifyToolCalls = (entry.resolved as any).__spotifyToolCalls;
        if (spotifyToolCalls instanceof Set) {
          spotifyToolCalls.add(call.function.name);
        }
        if (!allowedToolNames.has(call.function.name)) {
          return JSON.stringify({
            error: `Tool not allowed for agent ${entry.resolved.type}: ${call.function.name}`,
            allowed: Array.from(allowedToolNames),
          });
        }
        if (!spotifyAccessToken) {
          (entry.resolved as any).__spotifyToolError =
            spotifyError ?? "Spotify is not connected. Open the Music DJ agent and connect your account.";
          return JSON.stringify({
            error: spotifyError ?? "Spotify is not connected. Open the Music DJ agent and connect your account.",
          });
        }
        if (call.function.name === "spotify_play") {
          const beforeResults = await executeToolCalls(
            [
              {
                id: `spotify-before-play-${Date.now()}`,
                type: "function",
                function: { name: "spotify_get_current_playback", arguments: "{}" },
              },
            ],
            { spotify: { accessToken: spotifyAccessToken } },
          );
          try {
            const before = JSON.parse(beforeResults[0]?.result ?? "{}");
            (entry.resolved as any).__spotifyCurrentBeforePlayUri = getSpotifyPlaybackTrackUri(before);
          } catch {
            (entry.resolved as any).__spotifyCurrentBeforePlayUri = null;
          }
        }
        const results = await executeToolCalls([call], {
          chatMeta,
          onUpdateMetadata: updateChatMetadataForTools,
          spotify: { accessToken: spotifyAccessToken },
          spotifyRepeatAfterPlay: "track",
        });
        const result = results[0]?.result ?? "Tool execution failed";
        if (call.function.name === "spotify_play") {
          try {
            const parsed = JSON.parse(result) as Record<string, unknown>;
            if (parsed.applied === true) {
              (entry.resolved as any).__spotifyPlayApplied = true;
              (entry.resolved as any).__spotifyPlayError = null;
              (entry.resolved as any).__spotifyPlaybackPending = parsed.playbackPending === true;
              (entry.resolved as any).__spotifyPlayUris = getSpotifyTrackUris(parsed);
              (entry.resolved as any).__spotifyCurrentAfterPlayUri = getSpotifyPlaybackTrackUri(parsed);
              (entry.resolved as any).__spotifyRepeatAfterPlayState =
                getStringField(parsed, "repeatState") || getStringField(parsed, "repeat");
            } else if (typeof parsed.error === "string") {
              (entry.resolved as any).__spotifyPlayError = parsed.error;
            }
          } catch {
            // Keep the raw tool result for the model; validation below handles missing playback.
          }
        }
        return result;
      },
    };
  }
}

function getSpotifyTrackUris(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const raw =
    (Array.isArray(record.trackUris) && record.trackUris) ||
    (Array.isArray(record.uris) && record.uris) ||
    (typeof record.trackUri === "string" ? [record.trackUri] : null) ||
    (typeof record.uri === "string" ? [record.uri] : null) ||
    [];
  return raw.filter((uri): uri is string => typeof uri === "string" && uri.startsWith("spotify:"));
}

function getSpotifyPlaybackTrackUri(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.currentUri === "string" && record.currentUri.startsWith("spotify:track:")) {
    return record.currentUri;
  }
  const track = record.track;
  if (track && typeof track === "object") {
    const uri = (track as Record<string, unknown>).uri;
    if (typeof uri === "string" && uri.startsWith("spotify:track:")) return uri;
  }
  return null;
}

function getStringField(data: unknown, key: string): string {
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
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
  const mood = getStringField(result.data, "mood");
  const searchQuery = getStringField(result.data, "searchQuery");
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
  const currentUri = getSpotifyPlaybackTrackUri(current) ?? "";

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
  const playedUri = getSpotifyPlaybackTrackUri(play);
  if (!playbackPending && playedUri !== picked.uri) {
    return {
      ...result,
      success: false,
      error: "Spotify accepted the retry, but the active track did not change to the selected song.",
    };
  }
  const repeatState = getStringField(play, "repeatState") || getStringField(play, "repeat");
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
      device: getStringField(play, "device") || null,
      display: getStringField(play, "display") || null,
      playbackPending,
    },
  };
}

async function validateSpotifyRetryPlayback(
  entry: ResolvedRetryAgent,
  result: AgentResult,
  context: AgentContext,
): Promise<AgentResult> {
  if (entry.resolved.type !== "spotify") return result;
  if (result.type !== "spotify_control") return result;
  const spotifyToolError = (entry.resolved as any).__spotifyToolError;
  if (isBlockingSpotifyRetryToolError(spotifyToolError)) {
    return { ...result, success: false, error: spotifyToolError };
  }

  const constraints =
    context.memory._spotifyDjConstraints && typeof context.memory._spotifyDjConstraints === "object"
      ? (context.memory._spotifyDjConstraints as Record<string, unknown>)
      : {};
  const forceFreshPick = constraints.manualRetry === true || constraints.forceFreshPick === true;
  if (!forceFreshPick || constraints.mode !== "game") return result;

  const toolCalls = (entry.resolved as any).__spotifyToolCalls;
  const spotifyPlayCalled = toolCalls instanceof Set && toolCalls.has("spotify_play");
  const spotifyPlayApplied = (entry.resolved as any).__spotifyPlayApplied === true;
  const spotifyPlayError = (entry.resolved as any).__spotifyPlayError;
  const spotifyPlayUris = Array.isArray((entry.resolved as any).__spotifyPlayUris)
    ? ((entry.resolved as any).__spotifyPlayUris as string[])
    : [];
  const spotifyPlayUri = spotifyPlayUris.length === 1 ? spotifyPlayUris[0] : null;
  const spotifyPlayIsSingleTrack = !!spotifyPlayUri && spotifyPlayUri.startsWith("spotify:track:");
  const currentBeforePlay = (entry.resolved as any).__spotifyCurrentBeforePlayUri;
  const currentAfterPlay = (entry.resolved as any).__spotifyCurrentAfterPlayUri;
  const repeatAfterPlay = (entry.resolved as any).__spotifyRepeatAfterPlayState;
  const playbackPending = (entry.resolved as any).__spotifyPlaybackPending === true;
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

  const uris = getSpotifyTrackUris(result.data);
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
        const fallbackCurrentBefore = (entry.resolved as any).__spotifyCurrentBeforePlayUri;
        const fallbackPlayedUri = getSpotifyPlaybackTrackUri(parsed);
        const fallbackRepeatState = getStringField(parsed, "repeatState") || getStringField(parsed, "repeat");
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

async function executeRetryBatches(
  agentContext: AgentContext,
  resolvedAgents: ResolvedRetryAgent[],
  preGenerationContext?: AgentContext | null,
) {
  const retryAgents = mergeRetryPairedBuiltInRewriteAgents(resolvedAgents);
  const providerModelGroups = new Map<
    string,
    { agents: ResolvedRetryAgent[]; provider: any; model: string; context: AgentContext; maxParallelJobs: number }
  >();

  for (const entry of retryAgents) {
    const context =
      preGenerationContext && entry.resolved.phase === "pre_generation" ? preGenerationContext : agentContext;
    const contextKind = context === preGenerationContext ? "pre_generation" : "default";
    const key = `${retryProviderKey(entry.agentProvider)}::${entry.agentModel}::${contextKind}`;
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
      const toolAgents = group.agents.filter((agent) => agent.resolved.toolContext?.tools.length);
      const batchAgents = group.agents.filter((agent) => !agent.resolved.toolContext?.tools.length);
      const groupResults: AgentResult[] = [];

      if (batchAgents.length > 0) {
        const configs = batchAgents.map((agent) => agent.resolved);
        groupResults.push(...(await executeAgentBatch(configs, group.context, group.provider, group.model)));
      }

      for (const entry of toolAgents) {
        const result = await executeAgent(
          entry.resolved,
          group.context,
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
  const proseGuardian = entries.find((entry) => entry.resolved.type === "prose-guardian");
  const continuity = entries.find((entry) => entry.resolved.type === "continuity");
  if (!proseGuardian || !continuity) return entries;

  const firstMergeIndex = Math.min(entries.indexOf(proseGuardian), entries.indexOf(continuity));
  const mergedResolved = mergePairedBuiltInRewriteAgents([proseGuardian.resolved, continuity.resolved])[0];
  if (!mergedResolved) return entries;
  const mergedEntry: ResolvedRetryAgent = {
    ...proseGuardian,
    resolved: mergedResolved,
  };

  const merged: ResolvedRetryAgent[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (index === firstMergeIndex) merged.push(mergedEntry);
    if (entry.resolved.type === "prose-guardian" || entry.resolved.type === "continuity") continue;
    merged.push(entry);
  }
  return merged;
}

async function persistRetryResults(
  agentsStore: ReturnType<typeof createAgentsStorage>,
  chatId: string,
  messageId: string,
  results: AgentResult[],
) {
  for (const result of results) {
    if (result.agentType === "illustrator" || result.type === "image_prompt") continue;
    try {
      await agentsStore.saveRun({
        agentConfigId: result.agentId,
        chatId,
        messageId,
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
}): Promise<Array<{ messageId: string; result: AgentResult }>> {
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

  const results: Array<{ messageId: string; result: AgentResult }> = [];
  for (const target of targets) {
    const retryContext = buildHistoricalLorebookKeeperContext(baseContext, messages, target.id);
    if (!retryContext) continue;

    if (preferredTargetLorebookId) {
      retryContext.memory._lorebookKeeperTargetLorebookId = preferredTargetLorebookId;
    }
    const existingEntries = await loadLorebookKeeperExistingEntries(lorebooksStore, preferredTargetLorebookId);
    if (existingEntries.length > 0) {
      retryContext.memory._existingLorebookEntries = existingEntries;
    }

    const rawResult = await executeAgent(
      lorebookKeeperAgent.resolved,
      retryContext,
      lorebookKeeperAgent.agentProvider,
      lorebookKeeperAgent.agentModel,
    );
    const result = requireApproval
      ? markRetryLorebookResultForApproval({
          result: rawResult,
          chatId,
          agentContext: retryContext,
          resolvedAgents: [lorebookKeeperAgent],
        })
      : rawResult;
    results.push({ messageId: target.id, result });

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
        preferredTargetLorebookId = await persistLorebookKeeperUpdates({
          lorebooksStore,
          chatId,
          chatName,
          preferredTargetLorebookId,
          writableLorebookIds: retryContext.writableLorebookIds,
          updates,
        });
      }
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
  secretPlotRerollMode?: "full" | "turn_only";
}) {
  const {
    app,
    reply,
    chatId,
    chat,
    retryMessageId,
    retrySwipeIndex,
    results,
    agentContext,
    mainResponseRaw,
    lorebooksStore,
    gameStateStore,
    conns,
    chars,
    resolvedAgents,
    secretPlotRerollMode,
  } = args;
  const sortedResults = [...results].sort(
    (a, b) => (a.type === "game_state_update" ? 0 : 1) - (b.type === "game_state_update" ? 0 : 1),
  );
  const chats = createChatsStorage(app.db);
  const agentsStore = createAgentsStorage(app.db);
  const chatMeta = parseExtra(chat.metadata) as Record<string, unknown>;
  let currentResponseForRewrite = agentContext.mainResponse;
  const originalResponseBeforeRewrite = agentContext.mainResponse;
  // Stale-edit baseline tracked in the raw (unresolved) domain to match the
  // stored message content. `currentResponseForRewrite` is macro-resolved, so
  // comparing it against the raw stored content falsely trips on any message
  // containing literal {{...}} macros.
  let expectedStoredMessageContent = mainResponseRaw;
  let retryBaseGameStateSnapshotPromise: ReturnType<typeof gameStateStore.getForGeneration> | null = null;
  const loadRetryBaseGameStateSnapshot = () => {
    retryBaseGameStateSnapshotPromise ??= gameStateStore.getForGeneration(chatId, {
      preferLatestVisible: true,
      visibleAnchor: retryMessageId ? { messageId: retryMessageId, swipeIndex: retrySwipeIndex } : null,
      excludeMessageId: retryMessageId || null,
    });
    return retryBaseGameStateSnapshotPromise;
  };
  const loadRetryTargetGameStateSnapshot = async () => {
    if (!retryMessageId) return loadRetryBaseGameStateSnapshot();
    const existing = await gameStateStore.getByMessage(retryMessageId, retrySwipeIndex);
    if (existing) return existing;
    return gameStateStore.updateByMessage(retryMessageId, retrySwipeIndex, chatId, {}, undefined, {
      baseSnapshot: await loadRetryBaseGameStateSnapshot(),
    });
  };

  for (const result of sortedResults) {
    if (result.success && result.type === "text_rewrite" && result.data && typeof result.data === "object") {
      try {
        const rewriteData = result.data as Record<string, unknown>;
        const editedText = typeof rewriteData.editedText === "string" ? rewriteData.editedText : "";
        const changes = Array.isArray(rewriteData.changes)
          ? (rewriteData.changes as Array<{ description: string }>)
          : [{ description: "Rewrote the assistant response." }];
        const editNeededValue = rewriteData.editNeeded;
        const strictEditNeeded = result.agentType === "prose-guardian" || result.agentType === "continuity";
        const rewriteAllowed = editNeededValue === false ? false : strictEditNeeded ? editNeededValue === true : true;
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
          await chats.updateMessageContent(retryMessageId, editedText);
          const originalText = strictEditNeeded ? originalResponseBeforeRewrite : null;
          if (originalText) {
            await chats.updateMessageExtra(retryMessageId, {
              proseGuardianOriginalText: originalText,
              proseGuardianRewrittenAt: new Date().toISOString(),
            });
          }
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
        const worldStatePatch: Record<string, unknown> = {};
        if (gs.date != null) worldStatePatch.date = gs.date as string;
        if (gs.time != null) worldStatePatch.time = gs.time as string;
        if (gs.location != null) worldStatePatch.location = gs.location as string;
        if (gs.weather != null) worldStatePatch.weather = gs.weather as string;
        if (gs.temperature != null) worldStatePatch.temperature = gs.temperature as string;
        const lockSnapshot = (await loadRetryTargetGameStateSnapshot()) ?? (await loadRetryBaseGameStateSnapshot());
        const lockedWorldStatePatch = applyTrackerFieldLocksToGameStatePatch(
          worldStatePatch,
          lockSnapshot ? parseGameStateRow(lockSnapshot as Record<string, unknown>) : null,
        );
        if (Object.keys(worldStatePatch).length > 0) {
          await gameStateStore.updateByMessage(
            retryMessageId,
            retrySwipeIndex,
            chatId,
            lockedWorldStatePatch as any,
            undefined,
            { baseSnapshot: await loadRetryBaseGameStateSnapshot() },
          );
        }

        const nextLocation = typeof lockedWorldStatePatch.location === "string" ? lockedWorldStatePatch.location : null;
        const existingGameMap = (chatMeta.gameMap as GameMap | null) ?? null;
        const syncedMeta = syncGameMapMetaPartyPosition(chatMeta, nextLocation);
        const syncedGameMap = (syncedMeta.gameMap as GameMap | null) ?? null;
        if (syncedGameMap && syncedGameMap !== existingGameMap) {
          Object.assign(chatMeta, syncedMeta);
          await chats.updateMetadata(chatId, chatMeta);
          sendSseEvent(reply, { type: "game_map_update", data: syncedGameMap });
        }

        sendSseEvent(reply, { type: "game_state_patch", data: lockedWorldStatePatch });
      } catch (err) {
        logger.error(err, "[retry-agents] Failed to apply world-state tracker update");
      }
    }

    // Keep message.extra.contextInjections in sync when retrying agents that emit injectable text,
    // so regenerate/swipe replays the edited or re-run snippet instead of stale cache.
    if (retryMessageId && result.success && (result.type === "context_injection" || result.type === "director_event")) {
      const text =
        typeof result.data === "string"
          ? result.data
          : result.data && typeof result.data === "object"
            ? String((result.data as { text?: string }).text ?? "")
            : "";
      try {
        const msg = await chats.getMessage(retryMessageId);
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
          await chats.updateMessageExtra(retryMessageId, { contextInjections: list, chatSummaryFingerprint });
          await chats.updateSwipeExtra(retryMessageId, retrySwipeIndex, {
            contextInjections: list,
            chatSummaryFingerprint,
          });
        }
      } catch {
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
        preserveTrackerCharacterUiFields(presentCharacters, previousCharacters);
        const lockedCharacterPatch = applyTrackerFieldLocksToGameStatePatch(
          { presentCharacters },
          previousSnapshot ? parseGameStateRow(previousSnapshot as Record<string, unknown>) : null,
        );
        presentCharacters = Array.isArray(lockedCharacterPatch.presentCharacters)
          ? lockedCharacterPatch.presentCharacters
          : presentCharacters;
        await gameStateStore.updateByMessage(
          retryMessageId,
          retrySwipeIndex,
          chatId,
          {
            presentCharacters,
          },
          undefined,
          { baseSnapshot: await loadRetryBaseGameStateSnapshot() },
        );
        sendSseEvent(reply, { type: "game_state_patch", data: { presentCharacters } });
      } catch (err) {
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
            await app.db
              .update(gameStateSnapshotsTable)
              .set(personaPatch.updates)
              .where(eq(gameStateSnapshotsTable.id, latest.id));
          }
        }
        if (personaPatch.changed) {
          sendSseEvent(reply, { type: "game_state_patch", data: personaPatch.patch });
        }
      } catch (err) {
        logger.error(err, "[retry-agents] Failed to apply persona-stats tracker update");
      }
    }

    if (result.success && result.type === "secret_plot" && result.data && typeof result.data === "object") {
      try {
        const plotData = result.data as Record<string, unknown>;
        const agentConfigId = resolvedAgents.find((entry) => entry.resolved.type === "director")?.resolved.id ?? null;
        if (agentConfigId) {
          if (secretPlotRerollMode !== "turn_only" && plotData.overarchingArc !== undefined) {
            await agentsStore.setMemory(agentConfigId, chatId, "overarchingArc", plotData.overarchingArc ?? null);
          }
        }
      } catch (err) {
        logger.warn(err, "[retry-agents] Failed to persist secret plot memory");
      }
    }

    if (result.success && result.type === "lorebook_update" && result.data && typeof result.data === "object") {
      try {
        if (isAgentWriteApprovalEnvelope(result.data)) continue;
        const lkData = result.data as Record<string, unknown>;
        const retryUpdates = (lkData.updates as any[]) ?? [];
        if (retryUpdates.length > 0) {
          await persistLorebookKeeperUpdates({
            lorebooksStore,
            chatId,
            chatName: (chat as any).name,
            preferredTargetLorebookId:
              typeof agentContext.memory._lorebookKeeperTargetLorebookId === "string"
                ? (agentContext.memory._lorebookKeeperTargetLorebookId as string)
                : null,
            writableLorebookIds: agentContext.writableLorebookIds,
            updates: retryUpdates,
          });
        }
      } catch (err) {
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
              await app.db
                .update(gameStateSnapshotsTable)
                .set({ playerStats: JSON.stringify(questTrackerPatch.playerStats) })
                .where(eq(gameStateSnapshotsTable.id, snap.id));
            }
            sendSseEvent(reply, { type: "game_state_patch", data: questTrackerPatch.patch });
          }
        }
      } catch (err) {
        logger.warn(err, "[retry-agents] Quest tracker persistence failed");
      }
    }

    // Persist re-rolled CYOA choices onto the last assistant message + active swipe
    // so they survive a page refresh, and broadcast them to the client store.
    if (result.success && result.type === "cyoa_choices" && result.data && typeof result.data === "object") {
      try {
        const cyoaData = result.data as { choices?: Array<{ label: string; text: string }> };
        if (retryMessageId && cyoaData.choices && cyoaData.choices.length > 0) {
          await chats.updateSwipeExtra(retryMessageId, retrySwipeIndex, { cyoaChoices: cyoaData.choices });
          const msgRow = await chats.getMessage(retryMessageId);
          if (msgRow && (msgRow.activeSwipeIndex ?? 0) === retrySwipeIndex) {
            await chats.updateMessageExtra(retryMessageId, { cyoaChoices: cyoaData.choices });
            logger.info(
              "[retry-agents] CYOA choices persisted chatId=%s messageId=%s choiceCount=%d",
              chatId,
              retryMessageId,
              cyoaData.choices.length,
            );
          } else {
            logger.info(
              "[retry-agents] CYOA choices persisted to swipe only (active swipe changed) chatId=%s messageId=%s retrySwipeIndex=%d activeSwipeIndex=%s choiceCount=%d",
              chatId,
              retryMessageId,
              retrySwipeIndex,
              msgRow?.activeSwipeIndex ?? "null",
              cyoaData.choices.length,
            );
          }
        }
      } catch (err) {
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
          const customTrackerPatch = buildLockedPlayerStatsArrayPatch<any>({
            field: "customTrackerFields",
            values: rawFields,
            snapshot: snap,
            lockState: snap ? parseGameStateRow(snap as Record<string, unknown>) : null,
          });
          if (snap && customTrackerPatch.changed) {
            await app.db
              .update(gameStateSnapshotsTable)
              .set({ playerStats: JSON.stringify(customTrackerPatch.playerStats) })
              .where(eq(gameStateSnapshotsTable.id, snap.id));
          }
          if (customTrackerPatch.changed) {
            sendSseEvent(reply, { type: "game_state_patch", data: customTrackerPatch.patch });
          }
        }
      } catch {
        // Non-critical patching failure.
      }
    }

    // ── ILLUSTRATOR: generate image from agent prompt ──
    if (result.success && result.type === "image_prompt" && result.data && typeof result.data === "object") {
      const illustratorFailureName =
        resolvedAgents.find((a) => a.resolved.id === result.agentId || a.resolved.type === "illustrator")?.cfg.name ??
        "Illustrator";
      try {
        const illData = result.data as Record<string, unknown>;
        const shouldGenerate = illData.shouldGenerate === true;
        const imagePrompt = ((illData.prompt as string) ?? "").trim();
        const negativePrompt = ((illData.negativePrompt as string) ?? "").trim();
        const style = ((illData.style as string) ?? "").trim();
        const illCharacters = Array.isArray(illData.characters) ? (illData.characters as string[]) : [];

        if (shouldGenerate && imagePrompt) {
          const illustratorAgent = resolvedAgents.find(
            (a) => a.resolved.id === result.agentId || a.resolved.type === "illustrator",
          );
          const rawImagePositivePrompt = illustratorAgent?.resolved.settings?.imagePositivePrompt;
          const rawSavedNegativePrompt = illustratorAgent?.resolved.settings?.imageNegativePrompt;
          const imagePositivePrompt = typeof rawImagePositivePrompt === "string" ? rawImagePositivePrompt.trim() : "";
          const savedNegativePrompt = typeof rawSavedNegativePrompt === "string" ? rawSavedNegativePrompt.trim() : "";
          const chatGameImageConnectionId =
            typeof chatMeta.gameImageConnectionId === "string" ? chatMeta.gameImageConnectionId.trim() : "";
          const configuredImgConnId = illustratorAgent?.resolved.settings?.imageConnectionId;
          const agentImageConnectionId = typeof configuredImgConnId === "string" ? configuredImgConnId.trim() : "";
          const imageConnectionOverride = chatGameImageConnectionId || agentImageConnectionId;
          let imgConnFull = imageConnectionOverride ? await conns.getWithKey(imageConnectionOverride) : null;
          if (imageConnectionOverride && !imgConnFull) {
            logger.warn(
              "[retry-agents] Illustrator image connection %s could not be resolved; falling back to default Illustrator connection",
              imageConnectionOverride,
            );
          }
          imgConnFull ??= await conns.getDefaultForImageGeneration();
          if (imgConnFull) {
            const { generateImage, saveImageToDisk } = await import("../../services/image/image-generation.js");
            const { createGalleryStorage } = await import("../../services/storage/gallery.storage.js");
            const galleryStore = createGalleryStorage(app.db);

            const imgModel = imgConnFull.model || "";
            const imgBaseUrl = imgConnFull.baseUrl || "https://image.pollinations.ai";
            const imgApiKey = imgConnFull.apiKey || "";
            const imgSource = (imgConnFull as any).imageGenerationSource || imgModel;
            const imgServiceHint = imgConnFull.imageService || imgSource;
            const imageDefaults = resolveConnectionImageDefaults(imgConnFull);
            const imageSettings = await loadImageGenerationUserSettings(app.db);

            const chatMeta = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
            const setupConfig = parseSettingsRecord(chatMeta.gameSetupConfig);
            const styleProfileId =
              (typeof setupConfig.imageStyleProfileId === "string" ? setupConfig.imageStyleProfileId : "") ||
              (typeof chatMeta.imageStyleProfileId === "string" ? chatMeta.imageStyleProfileId : "") ||
              null;
            const illustrationSize = resolveIllustratorImageSize(imageSettings.illustration, illData.aspectRatio);
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
            const finalNegativePrompt = [negativePrompt, savedNegativePrompt, ILLUSTRATOR_TEXT_NEGATIVE_PROMPT]
              .filter(Boolean)
              .join(", ");

            // Collect optional character visual context. Prefer full-body sprites
            // for references, then fall back to avatar portraits.
            const useAvatarRefs =
              typeof chatMeta.illustratorUseAvatarReferences === "boolean"
                ? chatMeta.illustratorUseAvatarReferences
                : illustratorAgent?.resolved.settings?.useAvatarReferences === true;
            const includeCharacterAppearance =
              typeof chatMeta.illustratorIncludeCharacterAppearance === "boolean"
                ? chatMeta.illustratorIncludeCharacterAppearance
                : illustratorAgent?.resolved.settings?.includeCharacterAppearance === true;
            let referenceImages: string[] | undefined;
            if (useAvatarRefs || includeCharacterAppearance) {
              const referenceResolution = await resolveIllustratorCharacterReferences({
                charactersStore: chars,
                chatCharacters: agentContext.characters.map((character) => ({
                  id: character.id,
                  name: character.name,
                  appearance: character.appearance,
                })),
                persona: agentContext.persona
                  ? {
                      id: typeof agentContext.memory._personaId === "string" ? agentContext.memory._personaId : null,
                      name: agentContext.persona.name,
                      avatarPath:
                        typeof agentContext.memory._personaAvatarPath === "string"
                          ? agentContext.memory._personaAvatarPath
                          : null,
                      appearance: agentContext.persona.appearance,
                    }
                  : null,
                requestedNames: illCharacters.filter((name): name is string => typeof name === "string"),
                promptText: [
                  imagePrompt,
                  style,
                  typeof illData.reason === "string" ? illData.reason : "",
                  agentContext.mainResponse ?? "",
                ].join("\n"),
                fallbackToChatCharacters: false,
              });
              if (includeCharacterAppearance && referenceResolution.appearanceBlock) {
                fullPrompt += `\n\n${referenceResolution.appearanceBlock}`;
                logger.debug(
                  "[retry-agents] Illustrator added character appearance notes for: %s",
                  referenceResolution.appearanceNames.join(", "),
                );
              }
              if (useAvatarRefs && referenceResolution.referenceImages.length > 0) {
                referenceImages = referenceResolution.referenceImages;
                if (referenceResolution.referenceLine) fullPrompt += `\n\n${referenceResolution.referenceLine}`;
                logger.debug(
                  "[retry-agents] Illustrator sending %d character reference(s) for: %s",
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

            const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
              prompt: compiledPrompt.prompt,
              negativePrompt: compiledPrompt.negativePrompt || undefined,
              model: imgModel,
              width: imgWidth,
              height: imgHeight,
              imageEndpointId: imgConnFull.imageEndpointId || undefined,
              comfyWorkflow: (imgConnFull as any).comfyuiWorkflow || undefined,
              imageDefaults,
              referenceImages,
            });

            const filePath = saveImageToDisk(chatId, imageResult.base64, imageResult.ext);
            const galleryEntry = await galleryStore.create({
              chatId,
              filePath,
              prompt: compiledPrompt.prompt,
              provider: "image_generation",
              model: imgModel || "unknown",
              width: imgWidth,
              height: imgHeight,
            });

            const filename = filePath.split("/").pop()!;
            const imageUrl = `/api/gallery/file/${chatId}/${encodeURIComponent(filename)}`;

            // Attach to message
            if (retryMessageId) {
              const chatsDb = createChatsStorage(app.db);
              const attachment = {
                type: "image",
                url: imageUrl,
                filename: `illustration.${imageResult.ext}`,
                prompt: compiledPrompt.prompt,
                galleryId: (galleryEntry as any)?.id,
              };
              const swipeRow = (await chatsDb.getSwipes(retryMessageId)).find((s: any) => s.index === retrySwipeIndex);
              if (swipeRow) {
                const swipeExtra =
                  typeof swipeRow.extra === "string" ? JSON.parse(swipeRow.extra) : (swipeRow.extra ?? {});
                const swipeAtts = (swipeExtra.attachments as any[]) ?? [];
                swipeAtts.push(attachment);
                await chatsDb.updateSwipeExtra(retryMessageId, retrySwipeIndex, { attachments: swipeAtts });
              }
              const msgRow = await chatsDb.getMessage(retryMessageId);
              if (msgRow && (msgRow.activeSwipeIndex ?? 0) === retrySwipeIndex) {
                const msgExtra = msgRow.extra
                  ? typeof msgRow.extra === "string"
                    ? JSON.parse(msgRow.extra)
                    : msgRow.extra
                  : {};
                const existingAttachments = (msgExtra.attachments as any[]) ?? [];
                existingAttachments.push(attachment);
                await chatsDb.updateMessageExtra(retryMessageId, { attachments: existingAttachments });
              }
            }

            sendSseEvent(reply, {
              type: "illustration",
              data: {
                messageId: retryMessageId,
                imageUrl,
                prompt: compiledPrompt.prompt,
                reason: illData.reason,
                galleryId: (galleryEntry as any)?.id,
              },
            });
            logger.info(
              "[retry-agents] Illustrator generated: %s...",
              (illData.reason as string | undefined)?.slice(0, 80) ?? imagePrompt.slice(0, 80),
            );
            if (retryMessageId) {
              try {
                await agentsStore.saveRun({
                  agentConfigId: result.agentId,
                  chatId,
                  messageId: retryMessageId,
                  result,
                });
              } catch (err) {
                logger.warn(err, "[retry-agents] Failed to persist successful Illustrator run");
              }
            }
          } else {
            logger.warn(
              "[retry-agents] Illustrator wants to generate but no image generation connection is configured",
            );
            sendSseEvent(reply, {
              type: "agent_error",
              data: {
                agentType: "illustrator",
                agentName: illustratorFailureName,
                error:
                  "No image generation connection set on the Illustrator agent, and no default Illustrator image connection is configured. Go to Settings -> Connections and mark an image generation connection as the default for Illustrator, or assign one directly in Settings -> Agents -> Illustrator.",
              },
            });
          }
        }
      } catch (illErr) {
        logger.error(illErr, "[retry-agents] Illustrator image generation failed");
        sendSseEvent(reply, {
          type: "agent_error",
          data: {
            agentType: "illustrator",
            agentName: illustratorFailureName,
            error: illErr instanceof Error ? illErr.message : "Image generation failed",
          },
        });
      }
    }

    // ── EXPRESSION ENGINE: persist validated sprite expressions ──
    // Validation already happened before SSE send; here we just persist to DB.
    if (result.success && result.type === "sprite_change" && result.data && typeof result.data === "object") {
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
          await chatsDb.updateMessageExtra(retryMessageId, { spriteExpressions: exprMap });
          await chatsDb.updateSwipeExtra(retryMessageId, retrySwipeIndex, { spriteExpressions: exprMap });
        }
        if (Object.keys(personaExprMap).length > 0) {
          const personaMessageId = await findLastUserMessageIdBefore(chatsDb, chatId, retryMessageId);
          if (personaMessageId) {
            await chatsDb.updateMessageExtra(personaMessageId, { spriteExpressions: personaExprMap });
          }
        }
      } catch (err) {
        logger.warn(err, "[retry-agents] Failed to persist validated sprite expressions");
      }
    }
  }
}

export async function registerRetryAgentsRoute(app: FastifyInstance) {
  const chats = createChatsStorage(app.db);
  const conns = createConnectionsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const agentsStore = createAgentsStorage(app.db);
  const gameStateStore = createGameStateStorage(app.db);
  const lorebooksStore = createLorebooksStorage(app.db);
  const presets = createPromptsStorage(app.db);

  app.post<{
    Body: {
      chatId: string;
      agentTypes: string[];
      streaming?: boolean;
      debugMode?: boolean;
      lorebookKeeperBackfill?: boolean;
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
      lorebookKeeperBackfill = false,
      forMessageId,
      musicPlayerSource = "spotify",
      musicPlayerEnabled = true,
      secretPlotRerollMode,
    } = request.body;
    if (!chatId || !agentTypes?.length) {
      return reply.status(400).send({ error: "chatId and agentTypes are required" });
    }

    startSseReply(reply, { "X-Accel-Buffering": "no" });

    // Abort in-flight agent LLM calls when the client disconnects, and stop
    // writing to a closed socket. Mirrors the main /generate handler so a dropped
    // retry tab does not leak upstream provider requests to completion.
    const abortController = new AbortController();
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
    const onClientClose = () => {
      clientDisconnected = true;
      abortController.abort();
    };
    reply.raw.on("close", onClientClose);

    try {
      const chat = await chats.getById(chatId);
      if (!chat) {
        throw new Error("Chat not found");
      }

      const chatMeta = parseExtra(chat.metadata);
      const requireAgentWriteApproval = agentWriteApprovalRequired(chatMeta);
      const allMessages = await chats.listMessages(chatId);
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

      const supportsHiddenFromAI =
        chat.mode === "conversation" || chat.mode === "roleplay" || chat.mode === "visual_novel";
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

      const { conn, enabledConfigs, resolvedAgents, warnings } = await resolveRetryAgents({
        agentTypes,
        chat,
        conns,
        agentsStore,
        activeMusicPlayerSource:
          musicPlayerEnabled === false
            ? null
            : musicPlayerSource === "youtube" || musicPlayerSource === "custom"
              ? musicPlayerSource
              : "spotify",
      });
      const chatMode = ((chat as { mode?: ChatMode }).mode ?? "conversation") as ChatMode;
      const retryWrapFormat = await resolveRetryAgentWrapFormat({
        chat,
        chatMode,
        conn,
        presets,
      });
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
      await attachRetrySpotifyToolContexts({ agentsStore, chats, chatId, chatMeta, resolvedAgents });
      await attachRetryChatMetadataToolContexts({ chats, chatId, chatMeta, resolvedAgents });
      await attachRetryLorebookWriterToolContexts({
        lorebooksStore,
        resolvedAgents,
        requireApproval: requireAgentWriteApproval,
        chatId,
      });
      const cyoaAgentWillRun = resolvedAgents.some((e) => e.resolved.type === "cyoa");
      const agentContext = await buildRetryAgentContext({
        cyoaAgentWillRun,
        chatId,
        db: app.db,
        chat,
        chatMeta,
        recentMessages,
        enabledConfigs,
        resolvedAgentTypes: new Set(resolvedAgents.map((a) => a.resolved.type)),
        lastAssistant,
        chars,
        gameStateStore,
        lorebooksStore,
        streaming,
        wrapFormat: retryWrapFormat,
        historicalGameStateAnchor,
      });
      agentContext.signal = abortController.signal;
      const hasPreGenerationRetries = resolvedAgents.some((entry) => entry.resolved.phase === "pre_generation");
      const preGenerationAgentContext =
        hasPreGenerationRetries && preGenerationRecentMessages
          ? await buildRetryAgentContext({
              cyoaAgentWillRun: false,
              chatId,
              db: app.db,
              chat,
              chatMeta,
              recentMessages: preGenerationRecentMessages,
              enabledConfigs,
              resolvedAgentTypes: new Set(resolvedAgents.map((a) => a.resolved.type)),
              lastAssistant: null,
              chars,
              gameStateStore,
              lorebooksStore,
              streaming,
              wrapFormat: retryWrapFormat,
              historicalGameStateAnchor: preGenerationGameStateAnchor,
              useLatestGameStateFallback: false,
            })
          : null;
      if (preGenerationAgentContext) preGenerationAgentContext.signal = abortController.signal;
      if (debugMode) {
        const emitRetryAgentDebug = (event: AgentCallDebugEvent) => {
          sendSseEvent(reply, { type: "agent_debug", data: event });
        };
        agentContext.agentDebug = emitRetryAgentDebug;
        if (preGenerationAgentContext) preGenerationAgentContext.agentDebug = emitRetryAgentDebug;
      }
      if (secretPlotDirectorRetry && secretPlotRerollMode === "turn_only") {
        try {
          const memory = await agentsStore.getMemory(secretPlotDirectorRetry.resolved.id, chatId);
          const state = buildSecretPlotStateFromMemory(memory);
          if (Object.keys(state).length > 0) {
            agentContext.memory._secretPlotState = state;
            if (preGenerationAgentContext) preGenerationAgentContext.memory._secretPlotState = state;
          }
        } catch (err) {
          logger.warn(err, "[retry-agents] Failed to load Narrative Director secret plot memory");
        }
      }

      sendSseEvent(reply, { type: "agent_start", data: { phase: "retry" } });
      for (const warning of warnings) {
        sendSseEvent(reply, { type: "agent_warning", data: warning });
      }
      if (resolvedAgents.length === 0) {
        logger.warn("[retry-agents] No runnable agents resolved for chatId=%s agentTypes=%j", chatId, agentTypes);
        throw new Error(
          "No runnable agents were found for this retry. Add tracker agents to this chat or check their connection settings.",
        );
      }
      const lorebookKeeperAgent = resolvedAgents.find((entry) => entry.resolved.type === "lorebook-keeper") ?? null;
      const nonLorebookAgents = resolvedAgents.filter((entry) => entry.resolved.type !== "lorebook-keeper");
      if (cyoaAgentWillRun) {
        logger.info("[retry-agents] CYOA re-roll chatId=%s assistantMessageId=%s", chatId, lastAssistant?.id ?? "none");
      }
      const rawResults =
        nonLorebookAgents.length > 0
          ? await executeRetryBatches(agentContext, nonLorebookAgents, preGenerationAgentContext)
          : [];
      const results = rawResults
        .map(markInvalidJsonAgentResult)
        .map((result) =>
          requireAgentWriteApproval
            ? markRetryLorebookResultForApproval({ result, chatId, agentContext, resolvedAgents: nonLorebookAgents })
            : result,
        );
      const rawLorebookKeeperRunEntries = lorebookKeeperAgent
        ? await executeLorebookKeeperRetries({
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
          })
        : [];
      const lorebookKeeperRunEntries = rawLorebookKeeperRunEntries.map((entry) => ({
        ...entry,
        result: markInvalidJsonAgentResult(entry.result),
      }));

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
        if (!customAgentCanEmitRetryResult(result, resolvedAgents)) continue;
        const cfg = resolvedAgents.find((entry) => entry.resolved.type === result.agentType)?.cfg;
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
          },
        });
      }

      const retryMessageId = lastAssistant?.id ?? "";
      const retrySwipeIndex = lastAssistant?.activeSwipeIndex ?? 0;
      await persistRetryResults(agentsStore, chatId, retryMessageId, results);
      for (const entry of lorebookKeeperRunEntries) {
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
      await applyRetryResultEffects({
        app,
        reply,
        chatId,
        chat,
        retryMessageId,
        retrySwipeIndex,
        results,
        agentContext,
        mainResponseRaw: (lastAssistant?.content as string) ?? "",
        lorebooksStore,
        gameStateStore,
        conns,
        chars,
        resolvedAgents: nonLorebookAgents,
        secretPlotRerollMode,
      });

      sendSseEvent(reply, { type: "done", data: "" });
    } catch (err) {
      const message =
        err instanceof Error
          ? (err as { cause?: unknown }).cause instanceof Error
            ? `${err.message}: ${(err as { cause?: Error }).cause!.message}`
            : err.message
          : "Agent retry failed";
      sendSseEvent(reply, { type: "error", data: message });
    } finally {
      stopSseKeepalive();
      reply.raw.off("close", onClientClose);
      reply.raw.end();
    }
  });
}
