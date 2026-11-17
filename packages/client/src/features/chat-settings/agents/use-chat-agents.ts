import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { type CastCharacter } from "../sections/cast-shared";
import { type ChatConnectionOption } from "../sections/ConnectionSection";
import { AVATAR_AGENT_IDS, BUILT_IN_AGENTS, estimateTextTokens } from "@marinara-engine/shared";
import { showAlertDialog, showConfirmDialog } from "../../../lib/app-dialogs";
import { type AvatarLayoutControls } from "../../../components/chat/AvatarLayoutSettings";
import { useCharacters, usePersonas, type SpriteInfo } from "../../../hooks/use-characters";
import { lorebookKeys, useLorebooks } from "../../../hooks/use-lorebooks";
import { useGenerate } from "../../../hooks/use-generate";
import {
  useCapabilityAgentRegistry,
  useInstalledCapabilityPackages,
  usePackageTurnGameCommands,
} from "../../../hooks/use-capability-packages";
import { useUpdateChatMetadata, useChatMessagePeek, useGenerationStatus, chatKeys } from "../../../hooks/use-chats";
import { api } from "../../../lib/api-client";
import { trackChatMetadataSave, waitForPendingChatMetadataSaves } from "../../../lib/chat-metadata-save-barrier";
import { createSerializedMutationQueue } from "../../../lib/serialized-mutation-queue";
import { getChatActiveLorebookIds } from "../../../lib/chat-lorebooks";
import { getAgentRunIntervalMeta } from "../../../lib/agent-cadence";
import { buildRoleplayAgentSettingsOrder, hasStandaloneRoleplayAgentSettings } from "../../../lib/agent-settings-order";
import { useUIStore } from "../../../stores/ui.store";
import { abortGenerationForChat, useChatStore } from "../../../stores/chat.store";
import type {
  AgentPhase,
  ChatMode,
  KnowledgeAgentSourceSettings,
  Message,
  MusicDjFolderSource,
} from "@marinara-engine/shared";
import {
  customAgentHasCapability,
  normalizeIllustratorImagesPerGeneration,
  normalizeIllustratorRunInterval,
  normalizeSpotifySourceType,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import { useCreateAgent, useUpdateAgent, type AgentConfigRow } from "../../../hooks/use-agents";
import { useAgentStore } from "../../../stores/agent.store";
import {
  DEFAULT_AGENT_CONTEXT_SIZE,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_AGENT_MAX_TOKENS,
  getDefaultAgentPrompt,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
  MIN_AGENT_MAX_TOKENS,
  STORYBOARD_AGENT_ID,
  estimateAgentLoadCost,
  getAgentPromptTemplateOptions,
  mergeBuiltInAgentSettings,
  readMusicDjCharacterFolders,
  resolveMusicDjExternalFolder,
  withMusicDjCharacterFolder,
  normalizeManualTrackerAgentTypes,
  normalizeAgentPhaseForType,
  normalizeAgentPromptTemplateSelectionMap,
  resolveDefaultAgentPromptTemplateId,
  resolveAgentPromptTemplate,
} from "@marinara-engine/shared";
import type { Chat, Lorebook, SpriteCharacterVisualSettings } from "@marinara-engine/shared";
import { normalizeSpritePlacements } from "../../../components/chat/sprite-placement";
import {
  normalizeSpriteCharacterVisualSettingsMap,
  type LocalSpriteVisualSettings,
} from "../../../components/chat/local-sprite-visual-settings";
import {
  DEFAULT_SPRITE_DISPLAY_MODES,
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_OPACITY_PERCENT_MAX,
  SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
  SPRITE_DISPLAY_SCALE_PERCENT_MAX,
  SPRITE_DISPLAY_SCALE_PERCENT_MIN,
  normalizeSpriteDisplayModes,
  type SpriteDisplayMode,
} from "../../../components/chat/sprite-display-modes";
import {
  applyAgentAddSetupToAgentSettings,
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
  initialMusicFolderTarget,
  normalizeChatCustomMusicFolder,
  normalizeCustomMusicExternalFolder,
  normalizeCustomMusicFolder,
  normalizeCustomMusicSource,
  type AgentAddSetupState,
  type AgentAddSpriteSubject,
  type CustomMusicSource,
  type MusicProvider,
} from "../../../components/chat/AgentAddSetupFields";
import { CHAT_RESOURCE_AGENT_SETUP_EVENT, takePendingChatAgentSetupIds } from "../../../lib/chat-resource-drag";
import { isRecord } from "../lib/is-record";
import { type KnowledgeAgentType, normalizeKnowledgeAgentSourceSettings } from "./knowledge-agent-settings";
import {
  normalizeGameVideoPromptTemplates,
  getGameVideoPromptTemplateOptions,
  resolveSelectedGameVideoPromptTemplateId,
} from "../lib/game-video-prompt-templates";
import {
  buildConversationCommandToggleOptions,
  readConversationCommandToggles,
} from "../lib/conversation-command-toggles";

export const DEFAULT_PROSE_GUARDIAN_BANNED_WORDS = "ozone";
export const DEFAULT_PROSE_GUARDIAN_AVOID =
  "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose";
const PROSE_GUARDIAN_TEXT_FIELDS = new Set<string>([
  "proseGuardianBannedWords",
  "proseGuardianAvoidInstructions",
  "proseGuardianStyleInstructions",
]);

export function getAgentSettingsMenuId(chatId: string, agentId: string): string {
  return `chat-settings-agent-menu-${chatId}-${agentId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

const ACTIVE_AGENT_SETUP_DESCRIPTION_MARKERS = [
  "Add the Agent in Chat Settings",
  "Add as both a Command and an Agent in Chat Settings",
  "Enable it per chat from Chat Settings",
] as const;

export function getActiveAgentMenuDescription(description: string): string {
  const cutoff = ACTIVE_AGENT_SETUP_DESCRIPTION_MARKERS.reduce((earliest, marker) => {
    const index = description.indexOf(marker);
    return index >= 0 ? Math.min(earliest, index) : earliest;
  }, description.length);
  return description.slice(0, cutoff).trim();
}

export type AvailableAgent = {
  id: string;
  name: string;
  description: string;
  category: string;
  phase: AgentPhase;
  builtIn: boolean;
  runtimeDisabled?: boolean;
  execution?: "pipeline" | "feature" | "host";
};

type AgentAddPreview = {
  agent: AvailableAgent;
  config: AgentConfigRow | null;
  contextSize: number;
  maxTokens: number;
  runInterval: number | null;
  setup: AgentAddSetupState;
};

type CustomAgentImageSetting = {
  imageConnectionId?: string | null;
  styleProfileId?: string | null;
};

export function normalizePositiveInteger(value: unknown, fallback: number, max: number, min = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function normalizeAgentMaxTokens(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_AGENT_MAX_TOKENS;
  return Math.max(MIN_AGENT_MAX_TOKENS, Math.trunc(value));
}

function normalizeSpriteDisplayValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function getChatActiveAgentIds(chat: Chat): string[] {
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
  const activeIds =
    metadata && typeof metadata === "object" ? (metadata as { activeAgentIds?: unknown }).activeAgentIds : [];
  return Array.isArray(activeIds) ? activeIds.filter((id): id is string => typeof id === "string") : [];
}

/** What the drawer passes in: the chat, and the values other sections use too. */
export interface UseChatAgentsOptions {
  chat: Chat;
  onResetSpritePlacements?: () => void;
  onResetSpriteCharacterVisualSettings?: (characterId: string) => void;
  onSpriteSideChange?: (side: "left" | "right", characterId?: string) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
  avatarLayout?: AvatarLayoutControls;
  /** The window shows, or one of its sections is popped out. */
  open: boolean;
  updateMeta: ReturnType<typeof useUpdateChatMetadata>;
  allCharacters: ReturnType<typeof useCharacters>["data"];
  lorebooks: ReturnType<typeof useLorebooks>["data"];
  installedAgentManifests: NonNullable<ReturnType<typeof useCapabilityAgentRegistry>["data"]>;
  installedCapabilities: NonNullable<ReturnType<typeof useInstalledCapabilityPackages>["data"]>;
  chatMode: ChatMode;
  isGame: boolean;
  isRoleplayMode: boolean;
  /** `chat.metadata` parsed; untyped, as it is in the drawer. */
  metadata: any;
  connectionRows: ChatConnectionOption[];
  allPersonas: ReturnType<typeof usePersonas>["data"];
  personas: NonNullable<ReturnType<typeof usePersonas>["data"]>;
  chatCharIds: string[];
  closeForSurface: () => void;
  activeLorebookIds: ReturnType<typeof getChatActiveLorebookIds>;
  gameLorebookKeeperEnabled: boolean;
  gameLorebookKeeperLorebookId: string | null;
  agentConfigsByType: Map<string, AgentConfigRow>;
  installedAgentIds: Set<string>;
  deletedBuiltInAgentTypes: Set<string>;
  activeAgentIds: string[];
  spriteCharacterIds: string[];
  availableAgents: AvailableAgent[];
  activeTrackerAgents: AvailableAgent[];
  manualTrackerAgentTypes: ReturnType<typeof normalizeManualTrackerAgentTypes>;
  characters: CastCharacter[];
  chatCharacters: Array<{ id: string; data: string; avatarPath: string | null }>;
  charNameMap: Map<string, string>;
  charName: (c: { id?: string; data: string | Record<string, unknown>; comment?: string | null }) => string;
  charTitle: (c: { id?: string; data: string | Record<string, unknown>; comment?: string | null }) => string | null;
  gameSetupConfig: Record<string, unknown>;
}

export type ChatAgents = ReturnType<typeof useChatAgents>;

/**
 * Agents' state, effects and handlers for Chat Settings. The drawer calls it once, before its guarded close, and
 * draws both faces of Agents from the result.
 */
export function useChatAgents({
  chat,
  onResetSpritePlacements,
  onResetSpriteCharacterVisualSettings,
  onSpriteSideChange,
  spriteVisualSettings,
  onSpriteVisualSettingsChange,
  avatarLayout,
  open,
  updateMeta,
  allCharacters,
  lorebooks,
  installedAgentManifests,
  installedCapabilities,
  chatMode,
  isGame,
  isRoleplayMode,
  metadata,
  connectionRows,
  allPersonas,
  personas,
  chatCharIds,
  closeForSurface,
  activeLorebookIds,
  gameLorebookKeeperEnabled,
  gameLorebookKeeperLorebookId,
  agentConfigsByType,
  installedAgentIds,
  deletedBuiltInAgentTypes,
  activeAgentIds,
  spriteCharacterIds,
  availableAgents,
  activeTrackerAgents,
  manualTrackerAgentTypes,
  characters,
  chatCharacters,
  charNameMap,
  charName,
  charTitle,
  gameSetupConfig,
}: UseChatAgentsOptions) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  // Each tracker schedule switch saves the whole map, so quick clicks must reach the server in order.
  const updateTrackerScheduleMeta = useUpdateChatMetadata({ serialize: true });
  const updateMetaMutateAsyncRef = useRef(updateMeta.mutateAsync);
  const pendingCustomAgentImageSettingsRef = useRef<{
    chatId: string;
    revision: number;
    settings: Record<string, CustomAgentImageSetting>;
  } | null>(null);
  const pendingCustomAgentImageSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customAgentImageSettingsRevisionRef = useRef(0);
  const customAgentImageSettingsWriteQueueRef = useRef(createSerializedMutationQueue());
  const removingAgentImageSettingsRef = useRef(new Set<string>());
  const [customAgentImageSettingsDraft, setCustomAgentImageSettingsDraft] = useState<{
    chatId: string;
    revision: number;
    patch: Partial<Record<string, CustomAgentImageSetting | null>>;
  } | null>(null);
  updateMetaMutateAsyncRef.current = updateMeta.mutateAsync;
  const updateAgentConfig = useUpdateAgent();
  const createAgent = useCreateAgent();
  const { retryAgents } = useGenerate();
  const agentProcessing = useAgentStore((s) => s.processingChatIds.includes(chat.id));
  const hasLocalGeneration = useChatStore((s) => s.abortControllers.has(chat.id));
  const [stoppingGeneration, setStoppingGeneration] = useState(false);
  const scheduleGenerationPreferences = useUIStore((s) => s.scheduleGenerationPreferences);
  const setScheduleGenerationPreferences = useUIStore((s) => s.setScheduleGenerationPreferences);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const imageSelfieWidth = useUIStore((s) => s.imageSelfieWidth);
  const imageSelfieHeight = useUIStore((s) => s.imageSelfieHeight);
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openAgentCatalog = useUIStore((s) => s.openAgentCatalog);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const musicPlayerSource = useUIStore((s) => s.musicPlayerSource);
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  const debugMode = useUIStore((s) => s.debugMode);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const callsSettingsMenuId = getAgentSettingsMenuId(chat.id, "conversation-calls");
  const callsSettingsOpen = useUIStore((s) => s.chatSettingsExpandedSections[callsSettingsMenuId] ?? false);
  const setChatSettingsSectionExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);
  const roleplayAgentSettingsOrder = useMemo(
    () => buildRoleplayAgentSettingsOrder(installedAgentManifests),
    [installedAgentManifests],
  );
  const customAgentSettingsOrder = roleplayAgentSettingsOrder.size + 100;
  const getRoleplayAgentSettingsOrder = useCallback(
    (agentId: string) => roleplayAgentSettingsOrder.get(agentId) ?? customAgentSettingsOrder,
    [customAgentSettingsOrder, roleplayAgentSettingsOrder],
  );
  const { data: generationStatus, refetch: refetchGenerationStatus } = useGenerationStatus(
    chat.id,
    open && isRoleplayMode,
  );
  const activeGeneration = hasLocalGeneration || generationStatus?.active === true;
  const handleStopActiveGeneration = useCallback(async () => {
    setStoppingGeneration(true);
    try {
      const controller = useChatStore.getState().abortControllers.get(chat.id);
      await abortGenerationForChat(chat.id, controller);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.couldNotStopGeneration"),
      );
    } finally {
      await refetchGenerationStatus();
      setStoppingGeneration(false);
    }
  }, [chat.id, localizeUi, refetchGenerationStatus]);
  const worldMapsSettingsDescription = localizeUi("ui.chat.chatsettingsdrawer.worldMapsFeatureSummary");
  const supportsNarrativeDirectorSecretPlot = chatMode === "roleplay";
  const videoConnectionsList = useMemo(
    () => connectionRows.filter((c) => c.provider === "video_generation"),
    [connectionRows],
  );
  const conversationCommandToggles = useMemo(
    () => readConversationCommandToggles(metadata.conversationCommandToggles),
    [metadata.conversationCommandToggles],
  );
  const conversationCommandsEnabled = metadata.characterCommands !== false;
  const selfieConnectionId = typeof metadata.imageGenConnectionId === "string" ? metadata.imageGenConnectionId : "";
  const selfieCommandAllowed = conversationCommandToggles.selfie !== false;
  const selfieSettingsOpen =
    selfieCommandAllowed && (conversationCommandToggles.selfie === true || selfieConnectionId.length > 0);
  const selfieFeatureEnabled = conversationCommandsEnabled && selfieSettingsOpen;
  const toggleConversationSelfies = useCallback(() => {
    const nextEnabled = !selfieFeatureEnabled;
    updateMeta.mutate({
      id: chat.id,
      ...(nextEnabled ? { characterCommands: true } : {}),
      conversationCommandToggles: {
        ...conversationCommandToggles,
        selfie: nextEnabled,
      },
    });
  }, [chat.id, conversationCommandToggles, selfieFeatureEnabled, updateMeta]);
  const openGenerationSettings = useCallback(() => {
    setSettingsTab("generations");
    openRightPanel("settings");
  }, [openRightPanel, setSettingsTab]);
  const openDownloadAgents = useCallback(() => {
    closeForSurface();
    openRightPanel("agents");
    openAgentCatalog();
  }, [closeForSurface, openAgentCatalog, openRightPanel]);
  const refreshLorebooks = useCallback(() => qc.invalidateQueries({ queryKey: lorebookKeys.all }), [qc]);
  const openLorebookFromSettings = useCallback(
    (lorebookId: string) => {
      void refreshLorebooks();
      closeForSurface();
      openLorebookDetail(lorebookId);
    },
    [closeForSurface, openLorebookDetail, refreshLorebooks],
  );
  const mapsPackage = installedCapabilities.find(
    (item) => item.status === "active" && item.manifest.kind.includes("maps") && item.manifest.entrypoints.client,
  );
  const mapsPackageEnabledForChat =
    metadata.enableAgents === true && Boolean(mapsPackage && activeAgentIds.includes(mapsPackage.id));
  const ltmPackage = installedCapabilities.find(
    (item) => item.status === "active" && item.id === "long-term-memory" && item.manifest.entrypoints.client,
  );
  const ltmPackageId = ltmPackage?.id;
  const callsPackage = installedCapabilities.find(
    (item) =>
      item.status === "active" && item.manifest.kind.includes("conversation-calls") && item.manifest.entrypoints.client,
  );
  const chatSettingsPackageByAgentId = useMemo(() => {
    const packages = new Map<string, (typeof installedCapabilities)[number]>();
    for (const item of installedCapabilities) {
      if (
        item.status === "active" &&
        item.manifest.entrypoints.client &&
        item.manifest.contributions?.slots?.includes("chat-settings")
      ) {
        packages.set(item.id, item);
      }
    }
    return packages;
  }, [installedCapabilities]);
  const packageTurnGameCommands = usePackageTurnGameCommands(chatMode === "conversation").data;
  const availableConversationCommandOptions = useMemo(
    () => buildConversationCommandToggleOptions(installedAgentIds, packageTurnGameCommands ?? []),
    [installedAgentIds, packageTurnGameCommands],
  );
  const hasConversationCommands = availableConversationCommandOptions.length > 0;
  const illustratorInstalled = installedAgentIds.has("illustrator");
  const readLatestActiveAgentIds = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const ids = latestChat ? getChatActiveAgentIds(latestChat) : [...activeAgentIds];
    return ids.filter((id) => !deletedBuiltInAgentTypes.has(id));
  }, [activeAgentIds, chat.id, deletedBuiltInAgentTypes, qc]);
  const setMapsEnabledForChat = useCallback(
    async (enabled: boolean) => {
      if (!mapsPackage) return;
      const current = readLatestActiveAgentIds();
      await updateMeta.mutateAsync({
        id: chat.id,
        ...(enabled ? { enableAgents: true } : {}),
        activeAgentIds: enabled
          ? Array.from(new Set([...current, mapsPackage.id]))
          : current.filter((id) => id !== mapsPackage.id),
      });
    },
    [chat.id, mapsPackage, readLatestActiveAgentIds, updateMeta],
  );
  const setLtmEnabledForChat = useCallback(
    async (enabled: boolean) => {
      if (!ltmPackageId) return;
      const current = readLatestActiveAgentIds();
      await updateMeta.mutateAsync({
        id: chat.id,
        ...(enabled ? { enableAgents: true } : {}),
        activeAgentIds: enabled
          ? Array.from(new Set([...current, ltmPackageId]))
          : current.filter((id) => id !== ltmPackageId),
      });
    },
    [chat.id, ltmPackageId, readLatestActiveAgentIds, updateMeta],
  );
  const spotifyActive = activeAgentIds.includes("spotify");
  const gameLorebookKeeperLorebook = gameLorebookKeeperLorebookId
    ? ((lorebooks ?? []) as Array<{ id: string; name: string }>).find(
        (book) => book.id === gameLorebookKeeperLorebookId,
      )
    : null;
  const spotifySourceType = normalizeSpotifySourceType(metadata.spotifySourceType);
  const spotifyPlaylistId = typeof metadata.spotifyPlaylistId === "string" ? metadata.spotifyPlaylistId : "";
  const spotifyArtist = typeof metadata.spotifyArtist === "string" ? metadata.spotifyArtist : "";
  const gameUseSpotifyMusic = metadata.gameUseSpotifyMusic === true;
  const gameSpotifySourceType = metadata.gameSpotifySourceType ?? "liked";
  const gameSpotifyPlaylistId =
    typeof metadata.gameSpotifyPlaylistId === "string" ? metadata.gameSpotifyPlaylistId : "";
  const gameSpotifyArtist = typeof metadata.gameSpotifyArtist === "string" ? metadata.gameSpotifyArtist : "";
  const musicDjSettings = mergeBuiltInAgentSettings("spotify", agentConfigsByType.get("spotify")?.settings);
  // The default source and folder for all chats. A chat or character folder can take over (#8901), but only
  // these defaults are ever written back to the Music DJ settings.
  const customMusicSource = normalizeCustomMusicSource(musicDjSettings);
  const customMusicFolder = normalizeCustomMusicFolder(musicDjSettings.customMusicFolder);
  // This chat's own Game Assets subfolder (#8916); empty uses the default above.
  const chatCustomMusicFolder = normalizeChatCustomMusicFolder(metadata.customMusicGameAssetsFolder);
  const defaultCustomMusicExternalFolder = normalizeCustomMusicExternalFolder(
    musicDjSettings.customMusicExternalFolder ?? musicDjSettings.localMusicExternalFolder,
  );
  const musicFolderInUse = resolveMusicDjExternalFolder({
    settings: musicDjSettings,
    chatMetadata: metadata,
    chatCharacterIds: chatCharIds,
  });
  const effectiveCustomMusicSource: CustomMusicSource =
    musicFolderInUse.source === "default" ? customMusicSource : "folder";
  const chatMusicFolder = normalizeCustomMusicExternalFolder(metadata.customMusicExternalFolder);
  const characterMusicFolder = musicFolderInUse.characterId
    ? (readMusicDjCharacterFolders(musicDjSettings)[musicFolderInUse.characterId] ?? "")
    : "";
  const [musicFolderTargetChoice, setMusicFolderTargetChoice] = useState<{
    chatId: string;
    target: MusicDjFolderSource;
  } | null>(null);
  const requestedMusicFolderTarget =
    musicFolderTargetChoice?.chatId === chat.id
      ? musicFolderTargetChoice.target
      : initialMusicFolderTarget(musicFolderInUse, customMusicSource, chatCustomMusicFolder);
  const musicFolderTarget: MusicDjFolderSource =
    requestedMusicFolderTarget === "character" && !musicFolderInUse.characterId ? "chat" : requestedMusicFolderTarget;
  const targetMusicFolder =
    musicFolderTarget === "chat"
      ? chatMusicFolder
      : musicFolderTarget === "character"
        ? characterMusicFolder
        : defaultCustomMusicExternalFolder;
  const gameMusicDjEnabled =
    metadata.gameUseMusicDj === true || gameUseSpotifyMusic || activeAgentIds.includes("youtube");
  const spriteDisplayModes = normalizeSpriteDisplayModes(metadata.spriteDisplayModes);
  const spritePosition: "left" | "right" =
    spriteVisualSettings?.spritePosition ?? (metadata.spritePosition === "right" ? "right" : "left");
  const spriteScale = normalizeSpriteDisplayValue(
    metadata.spriteScale,
    roleplaySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const expressionSpriteScale = normalizeSpriteDisplayValue(
    spriteVisualSettings?.expressionSpriteScale ?? metadata.expressionSpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const fullBodySpriteScale = normalizeSpriteDisplayValue(
    spriteVisualSettings?.fullBodySpriteScale ?? metadata.fullBodySpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const spriteOpacity = normalizeSpriteDisplayValue(
    metadata.spriteOpacity,
    1,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const expressionSpriteOpacity = normalizeSpriteDisplayValue(
    spriteVisualSettings?.expressionSpriteOpacity ?? metadata.expressionSpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const fullBodySpriteOpacity = normalizeSpriteDisplayValue(
    spriteVisualSettings?.fullBodySpriteOpacity ?? metadata.fullBodySpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const expressionAvatarsEnabled =
    (spriteVisualSettings?.expressionAvatarsEnabled ?? metadata.expressionAvatarsEnabled) === true;
  const hasLocalCharacterVisualSettings =
    !!spriteVisualSettings && Object.prototype.hasOwnProperty.call(spriteVisualSettings, "characterOverrides");
  const spriteCharacterVisualSettings = normalizeSpriteCharacterVisualSettingsMap(
    hasLocalCharacterVisualSettings ? spriteVisualSettings?.characterOverrides : metadata.spriteCharacterVisualSettings,
  );
  const [selectedSpriteLayoutCharacterId, setSelectedSpriteLayoutCharacterId] = useState<string | null>(null);
  const selectedSpriteCharacterVisualSettings = selectedSpriteLayoutCharacterId
    ? spriteCharacterVisualSettings[selectedSpriteLayoutCharacterId]
    : undefined;
  const editedSpritePosition = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.spritePosition ?? spritePosition)
    : spritePosition;
  const editedExpressionSpriteScale = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.expressionSpriteScale ?? expressionSpriteScale)
    : expressionSpriteScale;
  const editedFullBodySpriteScale = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.fullBodySpriteScale ?? fullBodySpriteScale)
    : fullBodySpriteScale;
  const editedExpressionSpriteOpacity = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.expressionSpriteOpacity ?? expressionSpriteOpacity)
    : expressionSpriteOpacity;
  const editedFullBodySpriteOpacity = selectedSpriteLayoutCharacterId
    ? (selectedSpriteCharacterVisualSettings?.fullBodySpriteOpacity ?? fullBodySpriteOpacity)
    : fullBodySpriteOpacity;
  const [expressionSpriteScalePercent, setExpressionSpriteScalePercent] = useState(() =>
    Math.round(editedExpressionSpriteScale * 100),
  );
  const [fullBodySpriteScalePercent, setFullBodySpriteScalePercent] = useState(() =>
    Math.round(editedFullBodySpriteScale * 100),
  );
  const [expressionSpriteOpacityPercent, setExpressionSpriteOpacityPercent] = useState(() =>
    Math.round(editedExpressionSpriteOpacity * 100),
  );
  const [fullBodySpriteOpacityPercent, setFullBodySpriteOpacityPercent] = useState(() =>
    Math.round(editedFullBodySpriteOpacity * 100),
  );
  const hasLocalSpritePlacements =
    !!spriteVisualSettings && Object.prototype.hasOwnProperty.call(spriteVisualSettings, "spritePlacements");
  const spritePlacementSource = hasLocalSpritePlacements
    ? spriteVisualSettings?.spritePlacements
    : metadata.spritePlacements;
  const hasCustomSpritePlacements = Object.keys(normalizeSpritePlacements(spritePlacementSource)).length > 0;
  const spotifyPlaylistsQuery = useQuery({
    queryKey: ["spotify", "playlists", 50],
    queryFn: () =>
      api.get<{
        playlists: Array<{
          id: string;
          name: string;
          uri: string;
          trackCount: number | null;
          owned: boolean | null;
        }>;
      }>("/spotify/playlists?limit=50"),
    enabled:
      open &&
      ((isGame && gameMusicDjEnabled && musicPlayerSource === "spotify" && gameSpotifySourceType === "playlist") ||
        (isRoleplayMode &&
          metadata.enableAgents &&
          spotifyActive &&
          musicPlayerSource === "spotify" &&
          spotifySourceType === "playlist")),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    setExpressionSpriteScalePercent(Math.round(editedExpressionSpriteScale * 100));
  }, [editedExpressionSpriteScale]);

  useEffect(() => {
    setFullBodySpriteScalePercent(Math.round(editedFullBodySpriteScale * 100));
  }, [editedFullBodySpriteScale]);

  useEffect(() => {
    setExpressionSpriteOpacityPercent(Math.round(editedExpressionSpriteOpacity * 100));
  }, [editedExpressionSpriteOpacity]);

  useEffect(() => {
    setFullBodySpriteOpacityPercent(Math.round(editedFullBodySpriteOpacity * 100));
  }, [editedFullBodySpriteOpacity]);

  const agentPromptTemplateSelections = useMemo(
    () => normalizeAgentPromptTemplateSelectionMap(metadata.agentPromptTemplateIds),
    [metadata.agentPromptTemplateIds],
  );
  const readLatestAgentPromptTemplateSelections = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const latestMetadata =
      latestChat && typeof latestChat.metadata === "string"
        ? JSON.parse(latestChat.metadata)
        : (latestChat?.metadata ?? metadata);
    return normalizeAgentPromptTemplateSelectionMap(
      latestMetadata && typeof latestMetadata === "object"
        ? (latestMetadata as { agentPromptTemplateIds?: unknown }).agentPromptTemplateIds
        : undefined,
    );
  }, [chat.id, metadata, qc]);
  const getPromptOptionsForAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      const settings = mergeBuiltInAgentSettings(agentId, cfg?.settings);
      return getAgentPromptTemplateOptions({
        promptTemplate: cfg?.promptTemplate || "",
        fallbackPromptTemplate: getDefaultAgentPrompt(agentId),
        settings,
      });
    },
    [agentConfigsByType],
  );
  const getDefaultPromptTemplateIdForAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      return resolveDefaultAgentPromptTemplateId(mergeBuiltInAgentSettings(agentId, cfg?.settings));
    },
    [agentConfigsByType],
  );
  const visibleActiveAgentIds = useMemo(
    () => activeAgentIds.filter((agentId) => availableAgents.some((agent) => agent.id === agentId)),
    [activeAgentIds, availableAgents],
  );
  const toggleManualTrackerAgent = useCallback(
    (agentId: string) => {
      if (metadata.manualTrackers === true) {
        // The removed Manual Trackers switch made every tracker manual. Keep the others manual and drop it,
        // so from now on only the individual choices count.
        // Also pin active trackers this list cannot show right now (uninstalled or turned off), and unknown ids,
        // which may be trackers, plus every installed tracker not added yet, which the old switch also covered.
        // Entries for non-trackers are ignored by the HUD and the server.
        const next: Record<string, boolean> = { ...manualTrackerAgentTypes };
        for (const id of Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : []) {
          if (typeof id !== "string") continue;
          const category = BUILT_IN_AGENTS.find((agent) => agent.id === id)?.category;
          if (category === undefined || category === "tracker") next[id] = true;
        }
        for (const agent of BUILT_IN_AGENTS) if (agent.category === "tracker") next[agent.id] = true;
        for (const agent of activeTrackerAgents) next[agent.id] = true;
        next[agentId] = false;
        updateTrackerScheduleMeta.mutate({ id: chat.id, manualTrackerAgentTypes: next, manualTrackers: false });
        return;
      }
      const next = { ...manualTrackerAgentTypes };
      if (next[agentId] === true) {
        delete next[agentId];
      } else {
        next[agentId] = true;
      }
      updateTrackerScheduleMeta.mutate({ id: chat.id, manualTrackerAgentTypes: next });
    },
    [
      activeTrackerAgents,
      chat.id,
      manualTrackerAgentTypes,
      metadata.activeAgentIds,
      metadata.manualTrackers,
      updateTrackerScheduleMeta,
    ],
  );
  const agentSuiteAgents = useMemo(
    () =>
      visibleActiveAgentIds
        .map((agentId) => availableAgents.find((agent) => agent.id === agentId))
        .filter((agent): agent is AvailableAgent => !!agent),
    [availableAgents, visibleActiveAgentIds],
  );
  const getAgentDisplayMeta = useCallback(
    (agentId: string, fallback: { name: string; description: string }) => {
      const available = availableAgents.find((agent) => agent.id === agentId);
      const builtIn = installedAgentManifests.find((agent) => agent.id === agentId);
      const config = agentConfigsByType.get(agentId);
      const description = available?.description ?? config?.description ?? builtIn?.description ?? fallback.description;
      return {
        name: available?.name ?? builtIn?.name ?? config?.name ?? fallback.name,
        description: getActiveAgentMenuDescription(description),
      };
    },
    [agentConfigsByType, availableAgents, installedAgentManifests],
  );
  const lorebookKeeperAgentMeta = getAgentDisplayMeta("lorebook-keeper", {
    name: "Lorebook Keeper",
    description: "Saves important story facts to the chat's lorebook as you play.",
  });
  const cardEvolutionAuditorAgentMeta = getAgentDisplayMeta("card-evolution-auditor", {
    name: "Card Evolution Auditor",
    description: "Suggests character card updates when the story changes a character, for you to approve.",
  });
  const proseGuardianAgentMeta = getAgentDisplayMeta("prose-guardian", {
    name: "Prose Guardian",
    description: "Cleans up repetitive or unwanted writing habits in AI messages.",
  });
  const continuityAgentMeta = getAgentDisplayMeta("continuity", {
    name: "Continuity Checker",
    description: "Fixes mistakes about places, time, and physical details in AI messages.",
  });
  const htmlAgentMeta = getAgentDisplayMeta("html", {
    name: "Immersive HTML",
    description: "Adds HTML/CSS/JS visual effects to AI messages.",
  });
  const directorAgentMeta = getAgentDisplayMeta("director", {
    name: "Narrative Director",
    description: "Gives the story a push in a new direction when you ask for it.",
  });
  const expressionAgentMeta = getAgentDisplayMeta("expression", {
    name: "Expression Engine",
    description: "Changes character sprites to match how they feel.",
  });
  const illustratorAgentMeta = getAgentDisplayMeta("illustrator", {
    name: "Illustrator",
    description: "Creates images and videos for your chats.",
  });
  const echoChamberAgentMeta = getAgentDisplayMeta("echo-chamber", {
    name: "Echo Chamber",
    description: "Shows a live stream-style chat reacting to your roleplay.",
  });
  const musicDjAgentMeta = getAgentDisplayMeta("spotify", {
    name: "Music DJ",
    description: "Plays music that fits the mood of the story, from Spotify, YouTube, or your own Game Assets music.",
  });
  const knowledgeRetrievalAgentMeta = getAgentDisplayMeta("knowledge-retrieval", {
    name: "Knowledge Retrieval",
    description: "Finds facts in your lorebooks and files that matter for the current scene.",
  });
  const knowledgeRouterAgentMeta = getAgentDisplayMeta("knowledge-router", {
    name: "Knowledge Router",
    description: "Picks the lorebook entries that fit the scene and gives them to the AI.",
  });
  const hapticAgentMeta = getAgentDisplayMeta("haptic", {
    name: "Haptic Feedback",
    description: "Controls connected intimate toys to match what happens in the story.",
  });

  // Estimate the per-turn cost of the active agent loadout — feeds the readout
  // in the agents picker header and the per-row token badges. Approximate; see
  // `estimateAgentLoadCost` doc comment for what's counted vs not.
  const agentLoadCost = useMemo(() => {
    const inputs = activeAgentIds.flatMap((id) => {
      const meta = availableAgents.find((a) => a.id === id);
      if (!meta) return [];
      const cfg = agentConfigsByType.get(id);
      const settings = mergeBuiltInAgentSettings(id, cfg?.settings);
      const promptTemplate = resolveAgentPromptTemplate({
        promptTemplate: cfg?.promptTemplate || "",
        fallbackPromptTemplate: getDefaultAgentPrompt(id),
        settings,
        selectedPromptTemplateId: agentPromptTemplateSelections[id] ?? null,
      });
      return [
        {
          type: id,
          phase: meta.phase,
          connectionId: cfg?.connectionId ?? null,
          promptTemplate,
          resultType: typeof settings.resultType === "string" ? settings.resultType : undefined,
          ownRequest: settings.batchWithOtherAgents === false,
        },
      ];
    });
    const tokensByType = new Map<string, number>(inputs.map((i) => [i.type, estimateTextTokens(i.promptTemplate)]));
    return {
      cost: estimateAgentLoadCost(inputs, chat.connectionId ?? null),
      tokensByType,
    };
  }, [activeAgentIds, agentConfigsByType, agentPromptTemplateSelections, availableAgents, chat.connectionId]);

  const lorebookKeeperActive = activeAgentIds.includes("lorebook-keeper");
  const cardEvolutionAuditorActive = activeAgentIds.includes("card-evolution-auditor");
  const expressionActive = activeAgentIds.includes("expression");
  // One drawer for the 2D and 3D Avatars agents, in chats whose stage can show avatars.
  const avatarLayoutActive =
    metadata.enableAgents === true &&
    Boolean(avatarLayout) &&
    AVATAR_AGENT_IDS.some((id) => activeAgentIds.includes(id));
  const avatarSettingsOrder = Math.min(...AVATAR_AGENT_IDS.map(getRoleplayAgentSettingsOrder));
  const illustratorActive = activeAgentIds.includes("illustrator");
  const echoChamberActive = activeAgentIds.includes("echo-chamber");
  const proseGuardianActive = activeAgentIds.includes("prose-guardian");
  const continuityActive = activeAgentIds.includes("continuity");
  const htmlActive = activeAgentIds.includes("html");
  const directorActive = activeAgentIds.includes("director");
  const hapticActive = activeAgentIds.includes("haptic");
  const agentWriteApprovalRequired = metadata.agentWriteApprovalRequired === true;
  const knowledgeRetrievalActive = activeAgentIds.includes("knowledge-retrieval");
  const knowledgeRouterActive = activeAgentIds.includes("knowledge-router");
  const illustratorConfig = agentConfigsByType.get("illustrator");
  const proseGuardianConfig = agentConfigsByType.get("prose-guardian");
  const continuityConfig = agentConfigsByType.get("continuity");
  const htmlConfig = agentConfigsByType.get("html");
  const directorConfig = agentConfigsByType.get("director");
  const illustratorDefaults = useMemo(
    () => mergeBuiltInAgentSettings("illustrator", illustratorConfig?.settings),
    [illustratorConfig?.settings],
  );
  const proseGuardianDefaults = useMemo(
    () => mergeBuiltInAgentSettings("prose-guardian", proseGuardianConfig?.settings),
    [proseGuardianConfig?.settings],
  );
  const continuityDefaults = useMemo(
    () => mergeBuiltInAgentSettings("continuity", continuityConfig?.settings),
    [continuityConfig?.settings],
  );
  const htmlDefaults = useMemo(() => mergeBuiltInAgentSettings("html", htmlConfig?.settings), [htmlConfig?.settings]);
  const directorDefaults = useMemo(
    () => mergeBuiltInAgentSettings("director", directorConfig?.settings),
    [directorConfig?.settings],
  );
  const narrativeDirectorSecretPlotEnabled =
    typeof metadata.narrativeDirectorSecretPlotEnabled === "boolean"
      ? metadata.narrativeDirectorSecretPlotEnabled
      : directorDefaults.secretPlotEnabled === true;
  const narrativeDirectorSecretPlotRunInterval = normalizePositiveInteger(
    metadata.narrativeDirectorSecretPlotRunInterval ?? directorDefaults.secretPlotRunInterval,
    8,
    100,
  );
  // #4721: this reader must NOT observe the shared chatKeys.messages infinite
  // query — pageSize lives in that query's option closures (not its key), so a
  // second observer with pageSize 100 hijacks the transcript's queryFn and
  // getNextPageParam: refetches fetch 100 rows regardless of the user's
  // messages-per-page and hasNextPage mis-evaluates, hiding "Load More". The
  // peek hook keys by limit and returns the same newest-N window.
  const secretPlotMessagesQuery = useChatMessagePeek(
    chat.id,
    100,
    open && directorActive && supportsNarrativeDirectorSecretPlot && narrativeDirectorSecretPlotEnabled,
  );
  const secretPlotMessages = useMemo<Message[]>(
    () => secretPlotMessagesQuery.data ?? [],
    [secretPlotMessagesQuery.data],
  );
  const illustratorIncludeCharacterAppearance =
    typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
      ? metadata.illustratorIncludeCharacterAppearance
      : illustratorDefaults.includeCharacterAppearance === true;
  const illustratorUseAvatarReferences =
    typeof metadata.illustratorUseAvatarReferences === "boolean"
      ? metadata.illustratorUseAvatarReferences
      : illustratorDefaults.useAvatarReferences === true;
  const illustratorPromptConnectionId =
    typeof metadata.illustratorPromptConnectionId === "string" ? metadata.illustratorPromptConnectionId : "";
  const illustratorImageConnectionId =
    typeof metadata.illustratorImageConnectionId === "string" ? metadata.illustratorImageConnectionId : "";
  const illustratorImagesPerGeneration = normalizeIllustratorImagesPerGeneration(
    metadata.illustratorImagesPerGeneration,
  );
  // This chat's Run Interval, else the Agent Editor's (which is only the default for chats).
  const illustratorChatRunInterval = normalizeIllustratorRunInterval(metadata.illustratorRunInterval);
  // The agent's value may be saved as text ("0"); read it the way the server does.
  const illustratorRunInterval =
    illustratorChatRunInterval ?? normalizeIllustratorRunInterval(illustratorDefaults.runInterval) ?? 5;
  // Videos made on their own: this chat's Video Run Interval, else the agent's, else the server default (5).
  const illustratorChatVideoRunInterval = normalizeIllustratorRunInterval(metadata.illustratorVideoRunInterval);
  const illustratorVideoRunInterval =
    illustratorChatVideoRunInterval ?? normalizeIllustratorRunInterval(illustratorDefaults.videoRunInterval) ?? 5;
  const illustratorAutoBackgroundsEnabled = metadata.illustratorAutoBackgroundsEnabled === true;
  const selfieUseAvatarReferences = metadata.selfieUseAvatarReferences === true;
  const selfieIncludeCharacterAppearance = metadata.selfieIncludeCharacterAppearance === true;
  const gameImageUseAvatarReferences = metadata.gameImageUseAvatarReferences !== false;
  const gameImageIncludeCharacterAppearance = metadata.gameImageIncludeCharacterAppearance !== false;
  const gameImageAutoGenerationEnabled = metadata.gameImageAutoGenerationEnabled !== false;
  const gameImageDynamicPromptEnabled = metadata.gameImageDynamicPromptEnabled === true;
  const gameSceneVideosEnabled =
    metadata.gameSceneVideosEnabled === true ||
    (metadata.gameSceneVideosEnabled !== false &&
      typeof metadata.gameVideoConnectionId === "string" &&
      metadata.gameVideoConnectionId.trim().length > 0);
  const gameVideoPromptTemplates = useMemo(
    () => normalizeGameVideoPromptTemplates(metadata.gameVideoPromptTemplates),
    [metadata.gameVideoPromptTemplates],
  );
  const gameVideoPromptOptions = useMemo(
    () => getGameVideoPromptTemplateOptions(gameVideoPromptTemplates),
    [gameVideoPromptTemplates],
  );
  const selectedGameVideoPromptTemplateId = useMemo(
    () => resolveSelectedGameVideoPromptTemplateId(metadata.gameVideoPromptTemplateId, gameVideoPromptOptions),
    [gameVideoPromptOptions, metadata.gameVideoPromptTemplateId],
  );
  const updateGameVideoPromptSelection = useCallback(
    (promptTemplateId: string) => {
      updateMeta.mutate({
        id: chat.id,
        gameVideoPromptTemplateId: promptTemplateId === GAME_VIDEO_PROMPT_TEMPLATE_ID ? null : promptTemplateId,
      });
    },
    [chat.id, updateMeta],
  );
  const toggleIllustratorCharacterAppearance = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorIncludeCharacterAppearance: !illustratorIncludeCharacterAppearance,
    });
  }, [chat.id, illustratorIncludeCharacterAppearance, updateMeta]);
  const toggleIllustratorAvatarReferences = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorUseAvatarReferences: !illustratorUseAvatarReferences,
    });
  }, [chat.id, illustratorUseAvatarReferences, updateMeta]);
  const resetIllustratorCharacterAppearance = useCallback(() => {
    // Both halves of Attach Card Appearance: images back to the agent's default, videos back to off.
    updateMeta.mutate({
      id: chat.id,
      illustratorIncludeCharacterAppearance: null,
      illustratorVideoIncludeCharacterAppearance: null,
    });
  }, [chat.id, updateMeta]);
  const resetIllustratorAvatarReferences = useCallback(() => {
    // Both halves of Send Avatar References: images back to the agent's default, videos back to off.
    updateMeta.mutate({ id: chat.id, illustratorUseAvatarReferences: null, illustratorVideoUseAvatarReferences: null });
  }, [chat.id, updateMeta]);
  const toggleIllustratorAutoBackgrounds = useCallback(() => {
    updateMeta.mutate({
      id: chat.id,
      illustratorAutoBackgroundsEnabled: !illustratorAutoBackgroundsEnabled,
    });
  }, [chat.id, illustratorAutoBackgroundsEnabled, updateMeta]);
  const proseGuardianBannedWords =
    typeof metadata.proseGuardianBannedWords === "string"
      ? metadata.proseGuardianBannedWords
      : typeof proseGuardianDefaults.banned === "string"
        ? proseGuardianDefaults.banned
        : DEFAULT_PROSE_GUARDIAN_BANNED_WORDS;
  const proseGuardianAvoidInstructions =
    typeof metadata.proseGuardianAvoidInstructions === "string"
      ? metadata.proseGuardianAvoidInstructions
      : typeof proseGuardianDefaults.avoid === "string"
        ? proseGuardianDefaults.avoid
        : DEFAULT_PROSE_GUARDIAN_AVOID;
  const proseGuardianStyleInstructions =
    typeof metadata.proseGuardianStyleInstructions === "string"
      ? metadata.proseGuardianStyleInstructions
      : typeof proseGuardianDefaults.prefer === "string"
        ? proseGuardianDefaults.prefer
        : "";
  const proseGuardianHoldForRewrite =
    typeof metadata.proseGuardianHoldForRewrite === "boolean"
      ? metadata.proseGuardianHoldForRewrite
      : (proseGuardianActive && proseGuardianDefaults.holdForRewrite !== false) ||
        (continuityActive && continuityDefaults.holdForRewrite !== false) ||
        (htmlActive && htmlDefaults.holdForRewrite !== false);
  const [proseGuardianBannedDraft, setProseGuardianBannedDraft] = useState(proseGuardianBannedWords);
  const [proseGuardianAvoidDraft, setProseGuardianAvoidDraft] = useState(proseGuardianAvoidInstructions);
  const [proseGuardianStyleDraft, setProseGuardianStyleDraft] = useState(proseGuardianStyleInstructions);
  // This chat's Prose Guardian text fields whose save is running or failed. A failed save puts the old text back in
  // the chat's metadata; those fields keep what was typed, so it can be saved again rather than lost.
  const unsavedProseGuardianFields = useRef({
    chatId: chat.id,
    fields: new Map<string, { save: symbol; failed: boolean }>(),
  });
  const getUnsavedProseGuardianFields = useCallback(() => {
    if (unsavedProseGuardianFields.current.chatId !== chat.id) {
      unsavedProseGuardianFields.current = { chatId: chat.id, fields: new Map() };
    }
    return unsavedProseGuardianFields.current.fields;
  }, [chat.id]);
  useEffect(() => {
    if (!getUnsavedProseGuardianFields().has("proseGuardianBannedWords")) {
      setProseGuardianBannedDraft(proseGuardianBannedWords);
    }
  }, [getUnsavedProseGuardianFields, proseGuardianBannedWords]);

  useEffect(() => {
    if (!getUnsavedProseGuardianFields().has("proseGuardianAvoidInstructions")) {
      setProseGuardianAvoidDraft(proseGuardianAvoidInstructions);
    }
  }, [getUnsavedProseGuardianFields, proseGuardianAvoidInstructions]);

  useEffect(() => {
    if (!getUnsavedProseGuardianFields().has("proseGuardianStyleInstructions")) {
      setProseGuardianStyleDraft(proseGuardianStyleInstructions);
    }
  }, [getUnsavedProseGuardianFields, proseGuardianStyleInstructions]);

  const updateMetaAsync = updateMeta.mutateAsync;
  const saveProseGuardianSettings = useCallback(
    async (patch: Record<string, unknown>) => {
      const unsaved = getUnsavedProseGuardianFields();
      const save = Symbol("prose-guardian-save");
      const fields = Object.keys(patch).filter((key) => PROSE_GUARDIAN_TEXT_FIELDS.has(key));
      for (const field of fields) unsaved.set(field, { save, failed: false });
      // A later save of the same field may be queued behind this one; that save owns the mark.
      const ownMarks = () => fields.filter((field) => unsaved.get(field)?.save === save);
      try {
        await trackChatMetadataSave(chat.id, () => updateMetaAsync({ id: chat.id, ...patch }));
      } catch (error) {
        for (const field of ownMarks()) unsaved.set(field, { save, failed: true });
        throw error;
      }
      for (const field of ownMarks()) unsaved.delete(field);
    },
    [chat.id, getUnsavedProseGuardianFields, updateMetaAsync],
  );
  const showProseGuardianSaveError = useCallback(() => {
    // One id, so a failed save on leaving a field and the close's failed retry show one message.
    toast.error(localizeUi("ui.chat.chatsettingsdrawer.failedToSaveProseGuardianChanges"), {
      id: "prose-guardian-save-failed",
    });
  }, [localizeUi]);
  const commitProseGuardianSettings = useCallback(
    (patch: Record<string, unknown>) => {
      void saveProseGuardianSettings(patch).catch(showProseGuardianSaveError);
    },
    [saveProseGuardianSettings, showProseGuardianSaveError],
  );
  const flushProseGuardianDrafts = useCallback(async () => {
    const drafts: Record<string, string> = {
      proseGuardianBannedWords: proseGuardianBannedDraft.trim(),
      proseGuardianAvoidInstructions: proseGuardianAvoidDraft.trim(),
      proseGuardianStyleInstructions: proseGuardianStyleDraft.trim(),
    };
    const saved: Record<string, string> = {
      proseGuardianBannedWords: proseGuardianBannedWords,
      proseGuardianAvoidInstructions: proseGuardianAvoidInstructions,
      proseGuardianStyleInstructions: proseGuardianStyleInstructions,
    };
    const unsaved = getUnsavedProseGuardianFields();
    // A field whose save failed but whose text is back to the saved text has nothing left to save.
    for (const [field, mark] of unsaved) {
      if (mark.failed && drafts[field] === saved[field]) unsaved.delete(field);
    }
    const changed = Object.keys(drafts).filter((field) => drafts[field] !== saved[field]);
    try {
      // Saves for one chat run in order, so either way every save already started has settled after this.
      if (changed.length > 0) {
        await saveProseGuardianSettings(Object.fromEntries(changed.map((field) => [field, drafts[field]])));
      } else {
        await waitForPendingChatMetadataSaves(chat.id);
      }
    } catch {
      showProseGuardianSaveError();
      return false;
    }
    // A field still marked had its own save fail (it started on leaving the field), or one started meanwhile. Stay
    // open with its text: the next close sees it as changed and saves it.
    if (unsaved.size === 0) return true;
    if ([...unsaved.values()].some((mark) => mark.failed)) showProseGuardianSaveError();
    return false;
  }, [
    chat.id,
    getUnsavedProseGuardianFields,
    proseGuardianAvoidDraft,
    proseGuardianAvoidInstructions,
    proseGuardianBannedDraft,
    proseGuardianBannedWords,
    proseGuardianStyleDraft,
    proseGuardianStyleInstructions,
    saveProseGuardianSettings,
    showProseGuardianSaveError,
  ]);
  const getKnowledgeAgentSourceSettings = useCallback(
    (agentType: KnowledgeAgentType) => {
      const config = agentConfigsByType.get(agentType);
      const baseSettings = mergeBuiltInAgentSettings(agentType, config?.settings);
      return normalizeKnowledgeAgentSourceSettings(agentType, baseSettings, metadata.knowledgeAgentSources);
    },
    [agentConfigsByType, metadata.knowledgeAgentSources],
  );
  const updateKnowledgeAgentSourceSettings = useCallback(
    (agentType: KnowledgeAgentType, patch: Partial<KnowledgeAgentSourceSettings>) => {
      const currentSources = isRecord(metadata.knowledgeAgentSources) ? metadata.knowledgeAgentSources : {};
      const nextEntry: KnowledgeAgentSourceSettings = {
        ...getKnowledgeAgentSourceSettings(agentType),
        ...patch,
      };
      if (agentType === "knowledge-router") {
        delete nextEntry.sourceFileIds;
      }
      updateMeta.mutate({
        id: chat.id,
        knowledgeAgentSources: {
          ...currentSources,
          [agentType]: nextEntry,
        },
      });
    },
    [chat.id, getKnowledgeAgentSourceSettings, metadata.knowledgeAgentSources, updateMeta],
  );

  const customAgents = useMemo(() => availableAgents.filter((agent) => agent.category === "custom"), [availableAgents]);
  const activeCustomAgents = useMemo(
    () => customAgents.filter((agent) => activeAgentIds.includes(agent.id)),
    [activeAgentIds, customAgents],
  );
  const inactiveCustomAgents = useMemo(
    () => customAgents.filter((agent) => !activeAgentIds.includes(agent.id)),
    [activeAgentIds, customAgents],
  );
  const mapsAgent = availableAgents.find((agent) => agent.id === mapsPackage?.id);
  const ltmAgent = availableAgents.find((agent) => agent.id === ltmPackage?.id);
  const storyboardAgent = availableAgents.find((agent) => agent.id === STORYBOARD_AGENT_ID);
  const beholderAgent = availableAgents.find((agent) => agent.id === "beholder");
  const standaloneRoleplayAgents = useMemo(
    () =>
      metadata.enableAgents === true && isRoleplayMode
        ? availableAgents.filter((agent) => {
            if (!activeAgentIds.includes(agent.id) || !hasStandaloneRoleplayAgentSettings(agent.id)) return false;
            if (agent.id === "hierarchical-maps") return Boolean(mapsPackage);
            if (agent.id === "long-term-memory") return Boolean(ltmPackage);
            if (agent.id === STORYBOARD_AGENT_ID || agent.id === "beholder") return true;
            return chatSettingsPackageByAgentId.has(agent.id);
          })
        : [],
    [
      activeAgentIds,
      availableAgents,
      chatSettingsPackageByAgentId,
      isRoleplayMode,
      ltmPackage,
      mapsPackage,
      metadata.enableAgents,
    ],
  );
  const standaloneRoleplayAgentIds = useMemo(
    () => new Set(standaloneRoleplayAgents.map((agent) => agent.id)),
    [standaloneRoleplayAgents],
  );
  const [pendingAgentMenuTargetId, setPendingAgentMenuTargetId] = useState<string | null>(null);
  const roleplayAgentMenuLinks = useMemo(() => {
    if (!metadata.enableAgents || !isRoleplayMode || isGame) return [];
    const links: Array<{
      id: string;
      label: string;
      targetId: string;
      order: number;
      count?: number;
    }> = [];
    const addLink = (agentId: string, active: boolean, label: string) => {
      if (!active) return;
      links.push({
        id: agentId,
        label,
        targetId: getAgentSettingsMenuId(chat.id, agentId),
        order: getRoleplayAgentSettingsOrder(agentId),
      });
    };
    addLink("lorebook-keeper", lorebookKeeperActive, lorebookKeeperAgentMeta.name);
    addLink("card-evolution-auditor", cardEvolutionAuditorActive, cardEvolutionAuditorAgentMeta.name);
    addLink("prose-guardian", proseGuardianActive, proseGuardianAgentMeta.name);
    addLink("director", directorActive, directorAgentMeta.name);
    addLink("continuity", continuityActive, continuityAgentMeta.name);
    addLink("html", htmlActive, htmlAgentMeta.name);
    addLink("knowledge-retrieval", knowledgeRetrievalActive, knowledgeRetrievalAgentMeta.name);
    addLink("knowledge-router", knowledgeRouterActive, knowledgeRouterAgentMeta.name);
    addLink("expression", expressionActive, expressionAgentMeta.name);
    addLink("echo-chamber", echoChamberActive, echoChamberAgentMeta.name);
    addLink("illustrator", illustratorActive, illustratorAgentMeta.name);
    addLink("spotify", spotifyActive, musicDjAgentMeta.name);
    addLink("haptic", hapticActive, hapticAgentMeta.name);
    if (ltmAgent && ltmPackage) {
      addLink(ltmPackage.id, metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id), ltmAgent.name);
    }
    if (storyboardAgent) {
      addLink(STORYBOARD_AGENT_ID, activeAgentIds.includes(STORYBOARD_AGENT_ID), storyboardAgent.name);
    }
    if (beholderAgent) addLink("beholder", activeAgentIds.includes("beholder"), beholderAgent.name);
    if (mapsAgent && mapsPackage) addLink(mapsPackage.id, mapsPackageEnabledForChat, mapsAgent.name);
    for (const [agentId, capabilityPackage] of chatSettingsPackageByAgentId) {
      if (
        agentId === "hierarchical-maps" ||
        agentId === "long-term-memory" ||
        links.some((link) => link.id === agentId)
      ) {
        continue;
      }
      const agent = availableAgents.find((candidate) => candidate.id === agentId);
      addLink(agentId, activeAgentIds.includes(agentId), agent?.name ?? capabilityPackage.manifest.name);
    }
    if (avatarLayoutActive) {
      links.push({
        id: "avatars",
        label: localizeUi("avatars.setup.title"),
        targetId: getAgentSettingsMenuId(chat.id, "avatars"),
        order: avatarSettingsOrder,
      });
    }
    if (activeCustomAgents.length > 0) {
      links.push({
        id: "custom-agents",
        label: activeCustomAgents.length === 1 ? activeCustomAgents[0]!.name : "Custom Agents",
        targetId: getAgentSettingsMenuId(chat.id, "custom-agents"),
        order: customAgentSettingsOrder,
        count: activeCustomAgents.length > 1 ? activeCustomAgents.length : undefined,
      });
    }
    return links.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [
    activeCustomAgents,
    activeAgentIds,
    availableAgents,
    avatarLayoutActive,
    avatarSettingsOrder,
    beholderAgent,
    cardEvolutionAuditorActive,
    cardEvolutionAuditorAgentMeta.name,
    chatSettingsPackageByAgentId,
    chat.id,
    continuityActive,
    continuityAgentMeta.name,
    customAgentSettingsOrder,
    directorActive,
    directorAgentMeta.name,
    echoChamberActive,
    echoChamberAgentMeta.name,
    expressionActive,
    expressionAgentMeta.name,
    hapticActive,
    hapticAgentMeta.name,
    htmlActive,
    htmlAgentMeta.name,
    illustratorActive,
    illustratorAgentMeta.name,
    isGame,
    isRoleplayMode,
    getRoleplayAgentSettingsOrder,
    localizeUi,
    knowledgeRetrievalActive,
    knowledgeRetrievalAgentMeta.name,
    knowledgeRouterActive,
    knowledgeRouterAgentMeta.name,
    ltmAgent,
    ltmPackage,
    lorebookKeeperActive,
    lorebookKeeperAgentMeta.name,
    mapsAgent,
    mapsPackage,
    mapsPackageEnabledForChat,
    metadata.enableAgents,
    musicDjAgentMeta.name,
    proseGuardianActive,
    proseGuardianAgentMeta.name,
    spotifyActive,
    storyboardAgent,
  ]);
  const focusAgentMenu = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    return true;
  }, []);
  const scrollToAgentMenu = useCallback(
    (targetId: string) => {
      if (!focusAgentMenu(targetId)) setPendingAgentMenuTargetId(targetId);
    },
    [focusAgentMenu],
  );
  const showMemoryNagSetupReminder = useCallback(async () => {
    await showAlertDialog({
      title: localizeUi("ui.chat.chatsettingsdrawer.memoryNagSetupTitle"),
      message: localizeUi("ui.chat.chatsettingsdrawer.memoryNagSetupMessage"),
      confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.memoryNagSetupOkay"),
      tone: "accent",
    });
    const targetId = getAgentSettingsMenuId(chat.id, "memory-nag");
    setChatSettingsSectionExpanded(targetId, true);
    scrollToAgentMenu(targetId);
  }, [chat.id, localizeUi, scrollToAgentMenu, setChatSettingsSectionExpanded]);
  useEffect(() => {
    if (!pendingAgentMenuTargetId) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (focusAgentMenu(pendingAgentMenuTargetId)) setPendingAgentMenuTargetId(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [focusAgentMenu, pendingAgentMenuTargetId]);
  const gameAgentFeatureCount =
    (metadata.enableAgents ? 1 : 0) +
    (gameLorebookKeeperEnabled ? 1 : 0) +
    (gameMusicDjEnabled ? 1 : 0) +
    activeCustomAgents.length;
  const lorebookKeeperTargetLorebookId =
    typeof metadata.lorebookKeeperTargetLorebookId === "string" ? metadata.lorebookKeeperTargetLorebookId : "";
  const lorebookKeeperReadBehindMessages = normalizeNonNegativeInteger(
    metadata.lorebookKeeperReadBehindMessages,
    0,
    100,
  );

  const activePersona = useMemo(
    () => (chat.personaId ? (personas.find((persona) => persona.id === chat.personaId) ?? null) : null),
    [chat.personaId, personas],
  );
  const activeIdentityCharacter = useMemo(
    () =>
      chat.personaCharacterId
        ? (characters.find((character) => character.id === chat.personaCharacterId) ?? null)
        : null,
    [chat.personaCharacterId, characters],
  );

  const chatSpriteSubjects = useMemo(
    () => [
      ...chatCharacters.map((character) => ({ kind: "character" as const, id: character.id, character })),
      ...(activeIdentityCharacter && !chatCharacters.some((character) => character.id === activeIdentityCharacter.id)
        ? [{ kind: "character" as const, id: activeIdentityCharacter.id, character: activeIdentityCharacter }]
        : []),
      ...(activePersona ? [{ kind: "persona" as const, id: activePersona.id, persona: activePersona }] : []),
    ],
    [activeIdentityCharacter, activePersona, chatCharacters],
  );

  const chatSpriteQueries = useQueries({
    queries: chatSpriteSubjects.map((subject) => ({
      queryKey: ["sprites", subject.id],
      queryFn: () => api.get<SpriteInfo[]>(`/sprites/${subject.id}`),
      enabled: !!subject.id,
      staleTime: 5 * 60_000,
    })),
  });

  const chatSpriteSubjectsWithSprites = chatSpriteSubjects.filter((_, index) => {
    const sprites = chatSpriteQueries[index]?.data;
    return Array.isArray(sprites) && sprites.length > 0;
  });
  const chatSpriteSubjectsLoading =
    (chatCharIds.length > 0 && allCharacters == null) ||
    (!!chat.personaId && allPersonas == null) ||
    (!!chat.personaCharacterId && allCharacters == null);
  const chatSpriteChoicesLoading =
    chatSpriteSubjects.length > 0 &&
    chatSpriteSubjectsWithSprites.length === 0 &&
    chatSpriteQueries.some((query) => query.isLoading);

  const agentAddSpriteSubjects = useMemo<AgentAddSpriteSubject[]>(
    () =>
      chatSpriteSubjects.map((subject) => {
        if (subject.kind === "persona") {
          return {
            id: subject.id,
            name: subject.persona.name,
            subtitle: subject.persona.comment || "Persona",
            avatarPath: subject.persona.avatarPath ?? null,
          };
        }
        return {
          id: subject.id,
          name: charName(subject.character),
          subtitle: charTitle(subject.character),
          avatarPath: subject.character.avatarPath ?? null,
        };
      }),
    [chatSpriteSubjects, charName, charTitle],
  );
  const spriteLayoutSubjects = useMemo(
    () => agentAddSpriteSubjects.filter((subject) => spriteCharacterIds.includes(subject.id)),
    [agentAddSpriteSubjects, spriteCharacterIds],
  );

  useEffect(() => {
    setSelectedSpriteLayoutCharacterId(null);
  }, [chat.id]);

  useEffect(() => {
    setSelectedSpriteLayoutCharacterId((current) => {
      if (current && spriteLayoutSubjects.some((subject) => subject.id === current)) return current;
      return null;
    });
  }, [spriteLayoutSubjects]);

  const toggleSprite = (charId: string) => {
    const current = [...spriteCharacterIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(charId);
    }
    updateMeta.mutate({ id: chat.id, spriteCharacterIds: current });
  };

  const toggleSpriteDisplayMode = (mode: SpriteDisplayMode) => {
    const current = normalizeSpriteDisplayModes(metadata.spriteDisplayModes);
    const active = current.includes(mode);
    const next = active ? current.filter((value) => value !== mode) : [...current, mode];
    updateMeta.mutate({
      id: chat.id,
      spriteDisplayModes: next.length > 0 ? next : [...DEFAULT_SPRITE_DISPLAY_MODES],
    });
  };

  const updateSpriteCharacterVisualSettings = useCallback(
    (nextSettings: Record<string, SpriteCharacterVisualSettings>) => {
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ characterOverrides: nextSettings });
        return;
      }
      updateMeta.mutate({ id: chat.id, spriteCharacterVisualSettings: nextSettings });
    },
    [chat.id, onSpriteVisualSettingsChange, updateMeta],
  );

  const patchSelectedSpriteCharacterVisualSettings = useCallback(
    (patch: Partial<SpriteCharacterVisualSettings>) => {
      if (!selectedSpriteLayoutCharacterId) return false;
      updateSpriteCharacterVisualSettings({
        ...spriteCharacterVisualSettings,
        [selectedSpriteLayoutCharacterId]: {
          ...(spriteCharacterVisualSettings[selectedSpriteLayoutCharacterId] ?? {}),
          ...patch,
        },
      });
      return true;
    },
    [selectedSpriteLayoutCharacterId, spriteCharacterVisualSettings, updateSpriteCharacterVisualSettings],
  );

  const resetSelectedSpriteCharacterVisualSettings = useCallback(() => {
    if (!selectedSpriteLayoutCharacterId) return;
    if (onResetSpriteCharacterVisualSettings) {
      onResetSpriteCharacterVisualSettings(selectedSpriteLayoutCharacterId);
      return;
    }
    const nextSettings = { ...spriteCharacterVisualSettings };
    delete nextSettings[selectedSpriteLayoutCharacterId];
    updateSpriteCharacterVisualSettings(nextSettings);
  }, [
    onResetSpriteCharacterVisualSettings,
    selectedSpriteLayoutCharacterId,
    spriteCharacterVisualSettings,
    updateSpriteCharacterVisualSettings,
  ]);

  const setSpriteSide = useCallback(
    (nextSide: "left" | "right") => {
      if (selectedSpriteLayoutCharacterId) {
        if (onSpriteSideChange) {
          onSpriteSideChange(nextSide, selectedSpriteLayoutCharacterId);
          return;
        }
        patchSelectedSpriteCharacterVisualSettings({ spritePosition: nextSide });
        return;
      }
      if (nextSide === editedSpritePosition) return;
      if (onSpriteSideChange) {
        onSpriteSideChange(nextSide);
        return;
      }
      updateMeta.mutate({ id: chat.id, spritePosition: nextSide });
    },
    [
      chat.id,
      editedSpritePosition,
      onSpriteSideChange,
      patchSelectedSpriteCharacterVisualSettings,
      selectedSpriteLayoutCharacterId,
      updateMeta,
    ],
  );

  const resetSpritePlacements = useCallback(() => {
    if (onResetSpritePlacements) {
      onResetSpritePlacements();
      return;
    }
    updateMeta.mutate({ id: chat.id, spritePlacements: {} });
  }, [chat.id, onResetSpritePlacements, updateMeta]);

  const setExpressionSpriteScale = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_SCALE_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, nextPercent),
      );
      setExpressionSpriteScalePercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ expressionSpriteScale: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ expressionSpriteScale: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        expressionSpriteScale: clampedPercent / 100,
        spriteScale: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setFullBodySpriteScale = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_SCALE_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_SCALE_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteScalePercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ fullBodySpriteScale: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteScale: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteScale: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setExpressionSpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setExpressionSpriteOpacityPercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ expressionSpriteOpacity: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ expressionSpriteOpacity: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        expressionSpriteOpacity: clampedPercent / 100,
        spriteOpacity: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  const setFullBodySpriteOpacity = useCallback(
    (nextPercent: number) => {
      const clampedPercent = Math.max(
        SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
        Math.min(SPRITE_DISPLAY_OPACITY_PERCENT_MAX, nextPercent),
      );
      setFullBodySpriteOpacityPercent(clampedPercent);
      if (patchSelectedSpriteCharacterVisualSettings({ fullBodySpriteOpacity: clampedPercent / 100 })) return;
      if (onSpriteVisualSettingsChange) {
        onSpriteVisualSettingsChange({ fullBodySpriteOpacity: clampedPercent / 100 });
        return;
      }
      updateMeta.mutate({
        id: chat.id,
        fullBodySpriteOpacity: clampedPercent / 100,
      });
    },
    [chat.id, onSpriteVisualSettingsChange, patchSelectedSpriteCharacterVisualSettings, updateMeta],
  );

  // ── Character drag-and-drop reordering ──
  const hasSecretPlotMemory = (memory: Record<string, unknown> | null | undefined) => {
    if (!memory) return false;
    const arc = memory.overarchingArc;
    if (typeof arc === "string" && arc.trim()) return true;
    if (arc && typeof arc === "object") {
      const arcRecord = arc as Record<string, unknown>;
      if (
        String(arcRecord.description ?? "").trim() ||
        String(arcRecord.protagonistArc ?? "").trim() ||
        String(arcRecord.characterArc ?? "").trim() ||
        arcRecord.completed === true
      ) {
        return true;
      }
    }
    return false;
  };

  const getNarrativeDirectorRemovalWarning = async (): Promise<string | null> => {
    let shouldWarn: boolean;
    try {
      const res = await api.get<{ memory: Record<string, unknown> }>(`/agents/memory/director/${chat.id}`);
      shouldWarn = hasSecretPlotMemory(res.memory);
    } catch {
      shouldWarn = true;
    }
    return shouldWarn
      ? "Are you sure you want to remove Narrative Director from this chat? This will wipe its hidden secret plot arc for this chat. This cannot be undone."
      : null;
  };

  const toggleAgent = async (agentId: string, options?: { skipDirectorRemovalWarning?: boolean }) => {
    const wasRemoving = readLatestActiveAgentIds().includes(agentId);
    if (wasRemoving && agentId === "director" && !options?.skipDirectorRemovalWarning) {
      const warningMessage = await getNarrativeDirectorRemovalWarning();
      if (warningMessage) {
        const ok = await showConfirmDialog({
          title: localizeUi("ui.chat.chatsettingsdrawer.removeNarrativeDirector"),
          message: warningMessage,
          confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.removeAgent"),
          tone: "destructive",
        });
        if (!ok) return;
      }
    }

    const current = readLatestActiveAgentIds();
    const idx = current.indexOf(agentId);
    const isRemoving = idx >= 0;
    if (isRemoving) current.splice(idx, 1);
    else current.push(agentId);
    const latestPromptTemplateSelections = readLatestAgentPromptTemplateSelections();
    const nextPromptTemplateSelections =
      isRemoving && latestPromptTemplateSelections[agentId]
        ? (() => {
            const next = { ...latestPromptTemplateSelections };
            delete next[agentId];
            return next;
          })()
        : null;
    let metadataSaved = false;
    if (isRemoving) removingAgentImageSettingsRef.current.add(agentId);
    try {
      if (isRemoving) {
        do {
          await flushPendingCustomAgentImageSettings().catch(() => undefined);
          await customAgentImageSettingsWriteQueueRef.current.waitForIdle();
        } while (pendingCustomAgentImageSettingsRef.current?.chatId === chat.id);
      }
      const latestImageSettings = readLatestCustomAgentImageSettings();
      const nextImageSettings =
        isRemoving && latestImageSettings[agentId]
          ? (() => {
              const next = { ...latestImageSettings };
              delete next[agentId];
              return next;
            })()
          : null;
      const saveAgentSelection = async () => {
        await updateMeta.mutateAsync(
          {
            id: chat.id,
            activeAgentIds: current,
            ...(nextPromptTemplateSelections ? { agentPromptTemplateIds: nextPromptTemplateSelections } : {}),
            ...(nextImageSettings ? { customAgentImageSettings: nextImageSettings } : {}),
          },
          {
            onSuccess: async () => {
              metadataSaved = true;
              // When removing an agent that stores persistent memory, clean it up after metadata is saved.
              if (isRemoving && agentId === "director") {
                await api.delete(`/agents/memory/${agentId}/${chat.id}`);
              }
            },
          },
        );
      };
      if (isRemoving) await customAgentImageSettingsWriteQueueRef.current.enqueue(saveAgentSelection);
      else await saveAgentSelection();
      if (!isRemoving && agentId === "memory-nag" && isRoleplayMode) {
        await showMemoryNagSetupReminder();
      }
    } catch (error) {
      if (metadataSaved && isRemoving && agentId === "director") {
        const rollbackIds = Array.from(new Set([...readLatestActiveAgentIds(), agentId]));
        await updateMeta.mutateAsync({ id: chat.id, activeAgentIds: rollbackIds }).catch(() => undefined);
      }
      await showAlertDialog({
        title: isRemoving ? "Couldn't Remove Agent" : "Couldn't Add Agent",
        message: error instanceof Error ? error.message : "The agent list could not be updated. Please try again.",
      });
    } finally {
      if (isRemoving) removingAgentImageSettingsRef.current.delete(agentId);
    }
  };

  const removeAgentFromMenu = async (agentId: string, agentName: string) => {
    const warningMessage = agentId === "director" ? await getNarrativeDirectorRemovalWarning() : null;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.chatsettingsdrawer.removeValue1", { value1: agentName }),
      message: warningMessage ?? `Are you sure you want to remove ${agentName} from this chat?`,
      confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.removeAgent"),
      tone: "destructive",
    });
    if (!ok) return;
    await toggleAgent(agentId, { skipDirectorRemovalWarning: true });
  };

  const getRoleplayAgentMenuRemoveHandler = (agentId: string, agentName: string) => {
    if (!isRoleplayMode) return undefined;
    return () => {
      void removeAgentFromMenu(agentId, agentName);
    };
  };

  const updateAgentPromptTemplateSelection = useCallback(
    (agentId: string, promptTemplateId: string) => {
      const next = { ...readLatestAgentPromptTemplateSelections() };
      if (!promptTemplateId || promptTemplateId === getDefaultPromptTemplateIdForAgent(agentId)) {
        delete next[agentId];
      } else {
        next[agentId] = promptTemplateId;
      }
      updateMeta.mutate({ id: chat.id, agentPromptTemplateIds: next });
    },
    [chat.id, getDefaultPromptTemplateIdForAgent, readLatestAgentPromptTemplateSelections, updateMeta],
  );

  const handleLorebookKeeperBackfill = useCallback(async () => {
    await retryAgents(chat.id, ["lorebook-keeper"], { lorebookKeeperBackfill: true });
  }, [chat.id, retryAgents]);

  const handleRerunCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId]);
    },
    [chat.id, retryAgents],
  );

  const handleBackfillCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId], { customLorebookBackfill: true });
    },
    [chat.id, retryAgents],
  );

  const updateCustomAgentBackfillSettings = useCallback(
    async (agentId: string, patch: Record<string, unknown>) => {
      const config = agentConfigsByType.get(agentId);
      if (!config) return;
      try {
        await updateAgentConfig.mutateAsync({
          id: config.id,
          settings: { ...parseAgentSettingsRecord(config.settings), ...patch },
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.chat.customAgentBackfill.couldNotSaveSettings"),
        );
      }
    },
    [agentConfigsByType, localizeUi, updateAgentConfig],
  );

  const customAgentImageSelections = useMemo(() => {
    const raw = metadata.customAgentImageSettings;
    const persisted =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Partial<Record<string, CustomAgentImageSetting>>)
        : {};
    if (customAgentImageSettingsDraft?.chatId !== chat.id) return persisted;
    const merged = { ...persisted };
    for (const [agentId, settings] of Object.entries(customAgentImageSettingsDraft.patch)) {
      if (settings) merged[agentId] = settings;
      else delete merged[agentId];
    }
    return merged;
  }, [chat.id, customAgentImageSettingsDraft, metadata.customAgentImageSettings]);
  const readLatestCustomAgentImageSettings = useCallback(() => {
    const latestChat = qc.getQueryData<Chat>(chatKeys.detail(chat.id));
    const latestMetadata =
      latestChat && typeof latestChat.metadata === "string"
        ? JSON.parse(latestChat.metadata)
        : (latestChat?.metadata ?? metadata);
    const raw =
      latestMetadata && typeof latestMetadata === "object"
        ? (latestMetadata as { customAgentImageSettings?: unknown }).customAgentImageSettings
        : undefined;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? {
          ...(raw as Record<string, CustomAgentImageSetting>),
        }
      : {};
  }, [chat.id, metadata, qc]);
  const flushPendingCustomAgentImageSettings = useCallback((): Promise<void> => {
    if (pendingCustomAgentImageSettingsTimerRef.current !== null) {
      clearTimeout(pendingCustomAgentImageSettingsTimerRef.current);
      pendingCustomAgentImageSettingsTimerRef.current = null;
    }
    const pending = pendingCustomAgentImageSettingsRef.current;
    if (!pending) return customAgentImageSettingsWriteQueueRef.current.waitForIdle();
    pendingCustomAgentImageSettingsRef.current = null;
    return customAgentImageSettingsWriteQueueRef.current
      .enqueue(async () => {
        await updateMetaMutateAsyncRef.current({
          id: pending.chatId,
          customAgentImageSettings: pending.settings,
        });
      })
      .finally(() => {
        setCustomAgentImageSettingsDraft((current) =>
          current?.chatId === pending.chatId && current.revision === pending.revision ? null : current,
        );
      });
  }, []);
  useEffect(
    () => () => {
      void flushPendingCustomAgentImageSettings().catch(() => undefined);
    },
    [chat.id, flushPendingCustomAgentImageSettings],
  );
  const updateCustomAgentImageSetting = useCallback(
    (agentId: string, field: "imageConnectionId" | "styleProfileId", value: string) => {
      if (removingAgentImageSettingsRef.current.has(agentId)) return;
      const pending = pendingCustomAgentImageSettingsRef.current;
      if (pending && pending.chatId !== chat.id) {
        void flushPendingCustomAgentImageSettings().catch(() => undefined);
      }
      const next = pending?.chatId === chat.id ? { ...pending.settings } : readLatestCustomAgentImageSettings();
      const agentSettings = { ...next[agentId] };
      if (value) agentSettings[field] = value;
      else delete agentSettings[field];
      const hasAgentSettings = !!(agentSettings.imageConnectionId || agentSettings.styleProfileId);
      if (hasAgentSettings) next[agentId] = agentSettings;
      else delete next[agentId];
      const revision = customAgentImageSettingsRevisionRef.current + 1;
      customAgentImageSettingsRevisionRef.current = revision;
      pendingCustomAgentImageSettingsRef.current = { chatId: chat.id, revision, settings: next };
      setCustomAgentImageSettingsDraft((current) => ({
        chatId: chat.id,
        revision,
        patch: {
          ...(current?.chatId === chat.id ? current.patch : {}),
          [agentId]: hasAgentSettings ? agentSettings : null,
        },
      }));
      if (pendingCustomAgentImageSettingsTimerRef.current !== null) {
        clearTimeout(pendingCustomAgentImageSettingsTimerRef.current);
      }
      pendingCustomAgentImageSettingsTimerRef.current = setTimeout(() => {
        void flushPendingCustomAgentImageSettings().catch(() => undefined);
      }, 150);
    },
    [chat.id, flushPendingCustomAgentImageSettings, readLatestCustomAgentImageSettings],
  );
  const updateCustomAgentImageConnection = useCallback(
    (agentId: string, connectionId: string) =>
      updateCustomAgentImageSetting(agentId, "imageConnectionId", connectionId),
    [updateCustomAgentImageSetting],
  );
  const updateCustomAgentImageStyle = useCallback(
    (agentId: string, styleProfileId: string) =>
      updateCustomAgentImageSetting(agentId, "styleProfileId", styleProfileId),
    [updateCustomAgentImageSetting],
  );
  const isImageCapableCustomAgent = useCallback(
    (agentId: string) => {
      const cfg = agentConfigsByType.get(agentId);
      return !!cfg && customAgentHasCapability(parseAgentSettingsRecord(cfg.settings), "trigger_image_generation");
    },
    [agentConfigsByType],
  );
  const handleSnapshotCustomAgent = useCallback(
    async (agentId: string) => {
      await retryAgents(chat.id, [agentId], { forceImageGeneration: true });
    },
    [chat.id, retryAgents],
  );
  const [agentAddPreview, setAgentAddPreview] = useState<AgentAddPreview | null>(null);
  const [agentSetupQueue, setAgentSetupQueue] = useState<string[]>([]);
  const [agentAddCadenceInputFocused, setAgentAddCadenceInputFocused] = useState(false);
  const [addingAgentToChat, setAddingAgentToChat] = useState(false);
  const gameAgentPool = useMemo(
    () =>
      availableAgents.filter(
        (agent) =>
          agent.builtIn &&
          agent.id !== "spotify" &&
          agent.id !== "youtube" &&
          agent.id !== "lorebook-keeper" &&
          agent.category !== "custom",
      ),
    [availableAgents],
  );
  const [gameImagePromptInstructionsDraft, setGameImagePromptInstructionsDraft] = useState(
    (metadata.gameImagePromptInstructions as string) ?? "",
  );
  const campaignArtStyle = typeof gameSetupConfig.artStylePrompt === "string" ? gameSetupConfig.artStylePrompt : "";
  const generatedCampaignArtStyle =
    typeof gameSetupConfig.generatedArtStylePrompt === "string" ? gameSetupConfig.generatedArtStylePrompt : "";
  const useCampaignArtStyle = gameSetupConfig.useCampaignArtStyle !== false;
  const [campaignArtStyleDraft, setCampaignArtStyleDraft] = useState(campaignArtStyle);
  const [spotifyArtistDraft, setSpotifyArtistDraft] = useState(spotifyArtist);
  const [gameSpotifyArtistDraft, setGameSpotifyArtistDraft] = useState(gameSpotifyArtist);

  useEffect(() => {
    if (!open) {
      setAgentAddPreview(null);
      setAddingAgentToChat(false);
    }
  }, [open]);

  useEffect(() => {
    setGameImagePromptInstructionsDraft((metadata.gameImagePromptInstructions as string) ?? "");
  }, [chat.id, metadata.gameImagePromptInstructions]);

  useEffect(() => {
    setCampaignArtStyleDraft(campaignArtStyle);
  }, [campaignArtStyle, chat.id]);

  const commitCampaignArtStyle = () => {
    const nextArtStyle = campaignArtStyleDraft.trim();
    if (nextArtStyle === campaignArtStyle) return;
    updateMeta.mutate({
      id: chat.id,
      gameSetupConfig: {
        ...gameSetupConfig,
        artStylePrompt: nextArtStyle,
        generatedArtStylePrompt: generatedCampaignArtStyle || campaignArtStyle,
      },
    });
  };

  const commitGameImagePromptInstructions = () => {
    const stored = (metadata.gameImagePromptInstructions as string) ?? "";
    if (gameImagePromptInstructionsDraft === stored) return;
    updateMeta.mutate({
      id: chat.id,
      gameImagePromptInstructions: gameImagePromptInstructionsDraft.trim() || null,
    });
  };

  useEffect(() => {
    setGameSpotifyArtistDraft(gameSpotifyArtist);
  }, [chat.id, gameSpotifyArtist]);

  useEffect(() => {
    setSpotifyArtistDraft(spotifyArtist);
  }, [chat.id, spotifyArtist]);

  const openAgentAddModal = useCallback(
    (agent: AvailableAgent) => {
      setAgentAddCadenceInputFocused(false);
      const config = agentConfigsByType.get(agent.id) ?? null;
      const mergedSettings = mergeBuiltInAgentSettings(agent.id, config?.settings);
      const intervalMeta = getAgentRunIntervalMeta(agent.id, agent.builtIn);
      setAgentAddPreview({
        agent,
        config,
        contextSize: normalizePositiveInteger(mergedSettings.contextSize, DEFAULT_AGENT_CONTEXT_SIZE, 200),
        maxTokens: normalizeAgentMaxTokens(mergedSettings.maxTokens),
        runInterval: !intervalMeta
          ? null
          : agent.id === "illustrator"
            ? // Illustrator's Run Interval belongs to this chat; the agent's value (maybe saved as text) is only its default.
              (normalizeIllustratorRunInterval(metadata.illustratorRunInterval) ??
              normalizeIllustratorRunInterval(mergedSettings.runInterval) ??
              intervalMeta.defaultValue)
            : normalizePositiveInteger(
                mergedSettings.runInterval,
                intervalMeta.defaultValue,
                intervalMeta.max,
                intervalMeta.min,
              ),
        setup: buildInitialAgentAddSetupState({
          agentId: agent.id,
          settings: mergedSettings,
          metadata,
          musicPlayerSource,
          roleplaySpriteScale,
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
          chatCharacters: chatCharIds.map((id) => ({ id, name: charNameMap.get(id) ?? id })),
        }),
      });
    },
    [
      agentConfigsByType,
      charNameMap,
      chatCharIds,
      metadata,
      musicPlayerSource,
      roleplaySpriteScale,
      supportsNarrativeDirectorSecretPlot,
    ],
  );

  useEffect(() => {
    setAgentAddPreview(null);
    setAgentSetupQueue([]);
  }, [chat.id]);

  useEffect(() => {
    if (!open) return;
    const consumeRequest = () => {
      const ids = takePendingChatAgentSetupIds(chat.id);
      if (ids.length > 0) {
        // Dropped agents are already active by this point, so only dedupe against the setup queue.
        setAgentSetupQueue((current) => Array.from(new Set([...current, ...ids])));
      }
    };
    consumeRequest();
    window.addEventListener(CHAT_RESOURCE_AGENT_SETUP_EVENT, consumeRequest);
    return () => window.removeEventListener(CHAT_RESOURCE_AGENT_SETUP_EVENT, consumeRequest);
  }, [chat.id, open]);

  useEffect(() => {
    if (!open || agentAddPreview || agentSetupQueue.length === 0) return;
    const agent = availableAgents.find((entry) => entry.id === agentSetupQueue[0]);
    if (!agent) {
      setAgentSetupQueue((current) => current.slice(1));
      toast.error(localizeUi("ui.chat.chatresourcedropoverlay.agentUnavailable"));
      return;
    }
    openAgentAddModal(agent);
  }, [agentAddPreview, agentSetupQueue, availableAgents, open, openAgentAddModal, localizeUi]);

  const confirmAddAgent = async () => {
    if (!agentAddPreview) return;

    const { agent, config, contextSize, maxTokens, runInterval, setup } = agentAddPreview;
    const normalizedMaxTokens = normalizeAgentMaxTokens(maxTokens);
    const builtInMeta = installedAgentManifests.find((entry) => entry.id === agent.id) ?? null;
    let nextSettings: Record<string, unknown> = {
      ...mergeBuiltInAgentSettings(agent.id, config?.settings),
      contextSize,
      maxTokens: normalizedMaxTokens,
    };
    const intervalMeta = getAgentRunIntervalMeta(agent.id, !!builtInMeta);
    // Illustrator saves its Run Interval to this chat, so the agent's value stays the default for other chats.
    if (intervalMeta && runInterval != null && agent.id !== "illustrator") {
      nextSettings.runInterval = runInterval;
    }
    nextSettings = applyAgentAddSetupToAgentSettings(agent.id, setup, nextSettings, {
      allowSecretPlot: supportsNarrativeDirectorSecretPlot,
    });
    const nextEnabledTools = nextSettings.enabledTools;
    if (
      builtInMeta &&
      (!Array.isArray(nextEnabledTools) ||
        (agent.id === "spotify" && nextSettings.musicProvider === "spotify" && nextEnabledTools.length === 0))
    ) {
      nextSettings.enabledTools = DEFAULT_AGENT_TOOLS[agent.id] ?? [];
    }

    setAddingAgentToChat(true);
    try {
      if (builtInMeta?.execution === "feature") {
        // Feature packages own their settings and runtime; chat activation is enough.
      } else if (config) {
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
      } else if (builtInMeta) {
        await createAgent.mutateAsync({
          type: builtInMeta.id,
          name: agent.name,
          description: agent.description,
          phase: normalizeAgentPhaseForType(agent.id, agent.phase),
          connectionId: null,
          promptTemplate: "",
          settings: nextSettings,
        });
      }

      await updateMeta.mutateAsync({
        id: chat.id,
        enableAgents: true,
        activeAgentIds: Array.from(new Set([...readLatestActiveAgentIds(), agent.id])),
        ...buildAgentAddMetadataPatch(agent.id, setup, metadata, {
          allowSecretPlot: supportsNarrativeDirectorSecretPlot,
          defaultPromptTemplateId: resolveDefaultAgentPromptTemplateId(nextSettings),
          runInterval: isRoleplayMode ? runInterval : null,
          illustratorDefaults: {
            includeCharacterAppearance: nextSettings.includeCharacterAppearance === true,
            useAvatarReferences: nextSettings.useAvatarReferences === true,
            runInterval: intervalMeta
              ? (normalizeIllustratorRunInterval(nextSettings.runInterval) ?? intervalMeta.defaultValue)
              : undefined,
          },
        }),
      });
      toast.success(
        localizeUi("ui.chat.chatsettingsdrawer.addedValue1YouCanAccessItsSettingsInAgents", { value1: agent.name }),
      );
      setAgentAddPreview(null);
      setAgentSetupQueue((current) => (current[0] === agent.id ? current.slice(1) : current));
      if (agent.id === "memory-nag" && isRoleplayMode) {
        await showMemoryNagSetupReminder();
      }
    } catch (error) {
      await showAlertDialog({
        title: "Couldn’t Add Agent",
        message: error instanceof Error ? error.message : "Failed to add the agent to this chat.",
      });
    } finally {
      setAddingAgentToChat(false);
    }
  };

  const ensureMusicDjAgent = useCallback(
    async (provider: MusicProvider) => {
      const builtInMeta = installedAgentManifests.find((entry) => entry.id === "spotify");
      if (!builtInMeta) throw new Error("Music DJ agent metadata is missing.");
      const config = agentConfigsByType.get("spotify") ?? null;
      const nextSettings: Record<string, unknown> = {
        ...mergeBuiltInAgentSettings("spotify", config?.settings),
        musicProvider: provider,
        musicPlayerSource: provider,
        customMusicSource,
        customMusicFolder,
        customMusicExternalFolder: defaultCustomMusicExternalFolder,
        enabledTools: provider === "spotify" ? (DEFAULT_AGENT_TOOLS.spotify ?? []) : [],
      };

      if (config) {
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
        return;
      }

      await createAgent.mutateAsync({
        type: builtInMeta.id,
        name: builtInMeta.name,
        description: builtInMeta.description,
        phase: normalizeAgentPhaseForType(builtInMeta.id, builtInMeta.phase),
        connectionId: null,
        promptTemplate: "",
        settings: nextSettings,
      });
    },
    [
      agentConfigsByType,
      createAgent,
      defaultCustomMusicExternalFolder,
      customMusicFolder,
      customMusicSource,
      installedAgentManifests,
      updateAgentConfig,
    ],
  );

  const changeMusicDjProvider = useCallback(
    async (provider: MusicProvider) => {
      setMusicPlayerSource(provider);
      const musicDjActive = gameMusicDjEnabled || activeAgentIds.includes("spotify");
      if (!musicDjActive) return;
      try {
        await ensureMusicDjAgent(provider);
        if (isGame && gameMusicDjEnabled) {
          updateMeta.mutate({
            id: chat.id,
            gameUseSpotifyMusic: provider === "spotify",
          });
        }
      } catch (error) {
        await showAlertDialog({
          title: "Couldn't Update Music DJ",
          message: error instanceof Error ? error.message : "Music DJ provider could not be updated.",
        });
      }
    },
    [activeAgentIds, chat.id, ensureMusicDjAgent, gameMusicDjEnabled, isGame, setMusicPlayerSource, updateMeta],
  );

  const updateCustomMusicLibrary = useCallback(
    async (patch: Record<string, unknown>, where: "agent" | "chat" = "agent") => {
      try {
        if (where === "chat") {
          await updateMeta.mutateAsync({ id: chat.id, ...patch });
          return;
        }
        const config = agentConfigsByType.get("spotify") ?? null;
        if (!config) throw new Error("Music DJ agent settings are missing.");
        const nextSettings = {
          ...mergeBuiltInAgentSettings("spotify", config.settings),
          ...patch,
        };
        await updateAgentConfig.mutateAsync({ id: config.id, settings: nextSettings });
      } catch (error) {
        await showAlertDialog({
          title: "Couldn't Update Music Folder",
          message: error instanceof Error ? error.message : "The custom music folder could not be updated.",
        });
      }
    },
    [agentConfigsByType, chat.id, updateAgentConfig, updateMeta],
  );

  // The Game Assets subfolder of "All chats" or of this chat (#8916), each saved only to its own place.
  const saveCustomMusicFolder = (target: "chat" | "default", value: string) => {
    if (target === "chat") {
      // Stay on This chat: once its subfolder is cleared, the derived target would fall back to All chats.
      setMusicFolderTargetChoice({ chatId: chat.id, target: "chat" });
      const folder = normalizeChatCustomMusicFolder(value);
      if (folder !== chatCustomMusicFolder) {
        void updateCustomMusicLibrary({ customMusicGameAssetsFolder: folder || null }, "chat");
      }
      return;
    }
    const folder = normalizeCustomMusicFolder(value);
    if (folder !== customMusicFolder) void updateCustomMusicLibrary({ customMusicFolder: folder });
  };

  // Each "Apply to" choice writes only its own folder (#8901).
  const saveCustomMusicExternalFolder = (target: MusicDjFolderSource, folder: string) => {
    if (target === "chat") return updateCustomMusicLibrary({ customMusicExternalFolder: folder || null }, "chat");
    if (target === "character") {
      if (!musicFolderInUse.characterId) return;
      return updateCustomMusicLibrary({
        customMusicCharacterFolders: withMusicDjCharacterFolder(musicDjSettings, musicFolderInUse.characterId, folder),
      });
    }
    return updateCustomMusicLibrary({ customMusicSource: "folder", customMusicExternalFolder: folder });
  };

  const selectCustomMusicExternalFolder = async (target: MusicDjFolderSource) => {
    try {
      const data = await api.post<{ success: boolean; path: string }>("/game-assets/pick-local-music-folder");
      if (data.success !== true || !data.path) throw new Error("No folder selected.");
      await saveCustomMusicExternalFolder(target, data.path);
    } catch (error) {
      await showAlertDialog({
        title: "Couldn't Select Music Folder",
        message: error instanceof Error ? error.message : "The music folder could not be selected.",
      });
    }
  };

  const musicFolderCharacter = musicFolderInUse.characterId
    ? {
        id: musicFolderInUse.characterId,
        name: charNameMap.get(musicFolderInUse.characterId) ?? musicFolderInUse.characterId,
      }
    : null;

  const toggleGameMusicDj = useCallback(async () => {
    const latestActiveAgentIds = readLatestActiveAgentIds();
    if (gameMusicDjEnabled) {
      await updateMeta.mutateAsync({
        id: chat.id,
        gameUseMusicDj: false,
        gameUseSpotifyMusic: false,
        activeAgentIds: latestActiveAgentIds.filter((id) => id !== "spotify" && id !== "youtube"),
      });
      return;
    }

    try {
      await ensureMusicDjAgent(musicPlayerSource);
      await updateMeta.mutateAsync({
        id: chat.id,
        enableAgents: true,
        gameUseMusicDj: true,
        gameUseSpotifyMusic: musicPlayerSource === "spotify",
        gameSpotifySourceType,
        activeAgentIds: Array.from(new Set([...latestActiveAgentIds.filter((id) => id !== "youtube"), "spotify"])),
      });
    } catch (error) {
      await showAlertDialog({
        title: "Couldn't Enable Music DJ",
        message:
          error instanceof Error
            ? error.message
            : "Music DJ could not be enabled for this game. Check the setup and try again.",
      });
    }
  }, [
    chat.id,
    ensureMusicDjAgent,
    gameMusicDjEnabled,
    gameSpotifySourceType,
    musicPlayerSource,
    readLatestActiveAgentIds,
    updateMeta,
  ]);

  const toggleGameLorebookKeeper = useCallback(() => {
    const latestActiveAgentIds = readLatestActiveAgentIds();
    const nextActiveAgentIds = latestActiveAgentIds.filter((id) => id !== "lorebook-keeper");
    if (gameLorebookKeeperEnabled) {
      const keeperLorebookIds = new Set(
        ((lorebooks ?? []) as Lorebook[])
          .filter((lorebook) => lorebook.sourceAgentId === "game-lorebook-keeper")
          .map((lorebook) => lorebook.id),
      );
      if (gameLorebookKeeperLorebookId) keeperLorebookIds.add(gameLorebookKeeperLorebookId);
      updateMeta.mutate({
        id: chat.id,
        gameLorebookKeeperEnabled: false,
        activeAgentIds: nextActiveAgentIds,
        activeLorebookIds: activeLorebookIds.filter((id) => !keeperLorebookIds.has(id)),
      });
      return;
    }

    updateMeta.mutate({
      id: chat.id,
      gameLorebookKeeperEnabled: true,
      activeAgentIds: nextActiveAgentIds,
    });
  }, [
    activeLorebookIds,
    chat.id,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    lorebooks,
    readLatestActiveAgentIds,
    updateMeta,
  ]);

  // Illustrator's Run Interval is a Roleplay chat setting; Game orders its illustrations by scenes instead.
  const agentAddIntervalMeta =
    agentAddPreview && !(agentAddPreview.agent.id === "illustrator" && !isRoleplayMode)
      ? getAgentRunIntervalMeta(agentAddPreview.agent.id, agentAddPreview.agent.builtIn)
      : null;
  const agentAddIsRuntimeDisabled = agentAddPreview?.agent.runtimeDisabled === true;
  const agentAddIsFeature = agentAddPreview?.agent.execution === "feature";

  return {
    updateAgentConfig,
    agentProcessing,
    stoppingGeneration,
    scheduleGenerationPreferences,
    setScheduleGenerationPreferences,
    imageSelfieWidth,
    imageSelfieHeight,
    imageStyleProfiles,
    musicPlayerSource,
    debugMode,
    setEditorDirty,
    callsSettingsMenuId,
    callsSettingsOpen,
    setChatSettingsSectionExpanded,
    customAgentSettingsOrder,
    getRoleplayAgentSettingsOrder,
    activeGeneration,
    handleStopActiveGeneration,
    worldMapsSettingsDescription,
    supportsNarrativeDirectorSecretPlot,
    videoConnectionsList,
    conversationCommandToggles,
    conversationCommandsEnabled,
    selfieConnectionId,
    selfieSettingsOpen,
    selfieFeatureEnabled,
    toggleConversationSelfies,
    openGenerationSettings,
    openDownloadAgents,
    refreshLorebooks,
    openLorebookFromSettings,
    mapsPackage,
    mapsPackageEnabledForChat,
    ltmPackage,
    callsPackage,
    chatSettingsPackageByAgentId,
    availableConversationCommandOptions,
    hasConversationCommands,
    illustratorInstalled,
    readLatestActiveAgentIds,
    setMapsEnabledForChat,
    setLtmEnabledForChat,
    spotifyActive,
    gameLorebookKeeperLorebook,
    spotifySourceType,
    spotifyPlaylistId,
    gameSpotifySourceType,
    gameSpotifyPlaylistId,
    customMusicSource,
    customMusicFolder,
    chatCustomMusicFolder,
    musicFolderInUse,
    effectiveCustomMusicSource,
    chatMusicFolder,
    characterMusicFolder,
    setMusicFolderTargetChoice,
    musicFolderTarget,
    targetMusicFolder,
    gameMusicDjEnabled,
    spriteDisplayModes,
    expressionAvatarsEnabled,
    selectedSpriteLayoutCharacterId,
    setSelectedSpriteLayoutCharacterId,
    selectedSpriteCharacterVisualSettings,
    editedSpritePosition,
    expressionSpriteScalePercent,
    fullBodySpriteScalePercent,
    expressionSpriteOpacityPercent,
    fullBodySpriteOpacityPercent,
    hasCustomSpritePlacements,
    spotifyPlaylistsQuery,
    agentPromptTemplateSelections,
    getPromptOptionsForAgent,
    getDefaultPromptTemplateIdForAgent,
    visibleActiveAgentIds,
    toggleManualTrackerAgent,
    agentSuiteAgents,
    lorebookKeeperAgentMeta,
    cardEvolutionAuditorAgentMeta,
    proseGuardianAgentMeta,
    continuityAgentMeta,
    htmlAgentMeta,
    directorAgentMeta,
    expressionAgentMeta,
    illustratorAgentMeta,
    echoChamberAgentMeta,
    musicDjAgentMeta,
    knowledgeRetrievalAgentMeta,
    knowledgeRouterAgentMeta,
    hapticAgentMeta,
    agentLoadCost,
    lorebookKeeperActive,
    cardEvolutionAuditorActive,
    expressionActive,
    avatarLayoutActive,
    avatarSettingsOrder,
    illustratorActive,
    echoChamberActive,
    proseGuardianActive,
    continuityActive,
    htmlActive,
    directorActive,
    hapticActive,
    agentWriteApprovalRequired,
    knowledgeRetrievalActive,
    knowledgeRouterActive,
    illustratorConfig,
    narrativeDirectorSecretPlotEnabled,
    narrativeDirectorSecretPlotRunInterval,
    secretPlotMessages,
    illustratorIncludeCharacterAppearance,
    illustratorUseAvatarReferences,
    illustratorPromptConnectionId,
    illustratorImageConnectionId,
    illustratorImagesPerGeneration,
    illustratorChatRunInterval,
    illustratorRunInterval,
    illustratorChatVideoRunInterval,
    illustratorVideoRunInterval,
    illustratorAutoBackgroundsEnabled,
    selfieUseAvatarReferences,
    selfieIncludeCharacterAppearance,
    gameImageUseAvatarReferences,
    gameImageIncludeCharacterAppearance,
    gameImageAutoGenerationEnabled,
    gameImageDynamicPromptEnabled,
    gameSceneVideosEnabled,
    gameVideoPromptOptions,
    selectedGameVideoPromptTemplateId,
    updateGameVideoPromptSelection,
    toggleIllustratorCharacterAppearance,
    toggleIllustratorAvatarReferences,
    resetIllustratorCharacterAppearance,
    resetIllustratorAvatarReferences,
    toggleIllustratorAutoBackgrounds,
    proseGuardianBannedWords,
    proseGuardianAvoidInstructions,
    proseGuardianStyleInstructions,
    proseGuardianHoldForRewrite,
    proseGuardianBannedDraft,
    setProseGuardianBannedDraft,
    proseGuardianAvoidDraft,
    setProseGuardianAvoidDraft,
    proseGuardianStyleDraft,
    setProseGuardianStyleDraft,
    commitProseGuardianSettings,
    flushProseGuardianDrafts,
    getKnowledgeAgentSourceSettings,
    updateKnowledgeAgentSourceSettings,
    customAgents,
    activeCustomAgents,
    inactiveCustomAgents,
    standaloneRoleplayAgents,
    standaloneRoleplayAgentIds,
    pendingAgentMenuTargetId,
    roleplayAgentMenuLinks,
    scrollToAgentMenu,
    gameAgentFeatureCount,
    lorebookKeeperTargetLorebookId,
    lorebookKeeperReadBehindMessages,
    chatSpriteSubjects,
    chatSpriteSubjectsWithSprites,
    chatSpriteSubjectsLoading,
    chatSpriteChoicesLoading,
    agentAddSpriteSubjects,
    spriteLayoutSubjects,
    toggleSprite,
    toggleSpriteDisplayMode,
    resetSelectedSpriteCharacterVisualSettings,
    setSpriteSide,
    resetSpritePlacements,
    setExpressionSpriteScale,
    setFullBodySpriteScale,
    setExpressionSpriteOpacity,
    setFullBodySpriteOpacity,
    toggleAgent,
    getRoleplayAgentMenuRemoveHandler,
    updateAgentPromptTemplateSelection,
    handleLorebookKeeperBackfill,
    handleRerunCustomAgent,
    handleBackfillCustomAgent,
    updateCustomAgentBackfillSettings,
    customAgentImageSelections,
    updateCustomAgentImageConnection,
    updateCustomAgentImageStyle,
    isImageCapableCustomAgent,
    handleSnapshotCustomAgent,
    agentAddPreview,
    setAgentAddPreview,
    setAgentSetupQueue,
    agentAddCadenceInputFocused,
    setAgentAddCadenceInputFocused,
    addingAgentToChat,
    gameAgentPool,
    gameImagePromptInstructionsDraft,
    setGameImagePromptInstructionsDraft,
    generatedCampaignArtStyle,
    useCampaignArtStyle,
    campaignArtStyleDraft,
    setCampaignArtStyleDraft,
    spotifyArtistDraft,
    setSpotifyArtistDraft,
    gameSpotifyArtistDraft,
    setGameSpotifyArtistDraft,
    commitCampaignArtStyle,
    commitGameImagePromptInstructions,
    openAgentAddModal,
    confirmAddAgent,
    changeMusicDjProvider,
    updateCustomMusicLibrary,
    saveCustomMusicFolder,
    saveCustomMusicExternalFolder,
    selectCustomMusicExternalFolder,
    musicFolderCharacter,
    toggleGameMusicDj,
    toggleGameLorebookKeeper,
    agentAddIntervalMeta,
    agentAddIsRuntimeDisabled,
    agentAddIsFeature,
  };
}
