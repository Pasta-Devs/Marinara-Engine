import { ChatButtonLayoutSettings } from "./ChatButtonLayoutSettings";
// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { lazy, Suspense, useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChatBranchesPanel } from "./ChatBranchesPanel";
import { ChatMessageSearch } from "./ChatMessageSearch";
import { ChatWindowFavoriteButton } from "./ChatWindowFavoriteButton";
import { listCombatStyles, resolveCombatStyle } from "../../components/game/combat-styles";
import { AgentActivitySection } from "../../components/agents/AgentActivitySection";
import { withAgentActivityStatus } from "../../components/agents/AgentActivityIcon";
import {
  X,
  Check,
  RotateCcw,
  Settings2,
  Info,
  Activity,
  GitBranch,
  ScrollText,
  PenLine,
  Images,
  ScanText,
  Wallpaper,
  Search,
  Dices,
} from "lucide-react";
import { RoleplayRulesetSettings } from "../../components/chat/RoleplayRuleset";
import { NEUTRAL_PANEL_SCROLL_AREA } from "../../components/ui/neutral-surface-styles";
import { FloatingWindow } from "../../components/ui/FloatingWindow";
import { TrackerPanelIcon } from "../../components/ui/TrackerPanelIcon";
import { type ChatToolbarFloatingPanelAnchor } from "../../components/chat/ChatToolbarControls";
import { changedId } from "../../components/characters/CharacterSelect";
import { ChatSettingsSection as Section } from "./ChatSettingsSection";
import { ActiveChatBackgroundPicker } from "../../components/panels/settings/BackgroundPicker";
import { LocationBackgroundPins } from "./LocationBackgroundPins";
import { AdvancedParametersSection } from "./sections/AdvancedParametersSection";
import { CardFieldAlternativesSection } from "./sections/CardFieldAlternativesSection";
import { ChatNameSection } from "./sections/ChatNameSection";
import { ChatVariablesSection } from "./sections/ChatVariablesSection";
import { ScopedRegexSection } from "./sections/ScopedRegexSection";
import { GroupChatSection } from "./sections/GroupChatSection";
import { GameWidgetsSection } from "./sections/GameWidgetsSection";
import { SettingsProfilesSection } from "./sections/SettingsProfilesSection";
import { ConnectedChatsSection } from "./sections/ConnectedChatsSection";
import { AutonomousMessagingSection } from "./sections/AutonomousMessagingSection";
import { AutomaticSummarizationSection } from "./sections/AutomaticSummarizationSection";
import { MemoryRecallSection } from "./sections/MemoryRecallSection";
import { type CastCharacter } from "./sections/cast-shared";
import { PersonaSection } from "./sections/PersonaSection";
import { CharactersSection } from "./sections/CharactersSection";
import { GamePartySection } from "./sections/GamePartySection";
import { ConversationAgentsSection } from "./agents/ConversationAgentsSection";
import { GameAgentsSection } from "./agents/GameAgentsSection";
import { RoleplayAgentsSection } from "./agents/RoleplayAgentsSection";
import { createAgentSettingsRenderers } from "./agents/agent-settings-renderers";
import { ConversationNotesSection } from "./sections/ConversationNotesSection";
import { CombatStyleSection } from "./sections/CombatStyleSection";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { isRulesetCombatFight } from "../../lib/ruleset-combat-bridge";
import { resolvePersonaInlineNames } from "../../lib/inline-name-colors";
import { ConnectionSection, type ChatConnectionOption } from "./sections/ConnectionSection";
import { ConversationPromptSection } from "./sections/ConversationPromptSection";
import { FunctionCallingSection } from "./sections/FunctionCallingSection";
import { GameExtraPromptSection } from "./sections/GameExtraPromptSection";
import { ImpersonateSection } from "./sections/ImpersonateSection";
import { LorebooksSection } from "./sections/LorebooksSection";
import { PromptPresetSection } from "./sections/PromptPresetSection";
import { SceneInstructionsSection } from "./sections/SceneInstructionsSection";
import { TranslationSection } from "./sections/TranslationSection";
import type { AutoActiveCharactersMode, MultiplayerHostAction } from "@marinara-engine/shared";
import {
  type CardOnboarding,
  canBuildPersona,
  getRelevantCardVariables,
  hasOnboardingContent,
  readCardOnboarding,
  DEFAULT_GAME_DICE_POOL_AGE_TURNS as DEFAULT_DICE_POOL_AGE_TURNS,
  DEFAULT_GAME_DICE_POOL_WINDOW as DEFAULT_DICE_POOL_WINDOW,
  advancedMemoryProblems,
  normalizeAdvancedMemorySettings,
  normalizeGroupChatMode,
  resolveScopedRegexMode,
  resolveGameStoryStyle,
  parseGamePresetStorySettings,
  applyGamePresetStorySettings,
  resolveGameViolenceLevel,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { HelpTooltip } from "../../components/ui/HelpTooltip";
import { type AvatarLayoutControls } from "../../components/chat/AvatarLayoutSettings";
import { SettingsSwitch } from "../../components/panels/settings/SettingControls";
import { ChoiceSelectionModal } from "../../components/presets/ChoiceSelectionModal";
import { CharacterOnboardingModal } from "../../components/characters/CharacterOnboardingModal";
import { SummariesEditorModal } from "./SummariesEditorModal";
import { useAdvancedMemoryStatus } from "../../hooks/use-advanced-memory";
import { AgentSuiteModal } from "./agents/AgentSuiteModal";
import { RoleplayMessagePreview } from "../../components/chat/ChatMessage";
import { resolveChatContextBudget } from "../../lib/professor-mari-context-budget";
import { CHAT_SETTINGS_SURFACES } from "./chat-settings-surfaces";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useDefaultPreset, usePresetFull, usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import {
  isCapabilityPackageAvailable,
  useCapabilityAgentRegistry,
  useInstalledCapabilityPackages,
} from "../../hooks/use-capability-packages";
import {
  useUpdateChat,
  useUpdateChatMetadata,
  useCreateMessage,
  useChats,
  useChatMessagePeek,
  useChatGroup,
  chatKeys,
} from "../../hooks/use-chats";
import { api } from "../../lib/api-client";
import { readCharacterGreetings, type CharacterGreeting } from "../../lib/character-greetings";
import {
  appendLocalSidecarConnectionOption,
  filterLanguageGenerationConnections,
  isConnectionFlagTrue,
} from "../../lib/connection-filters";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
  type ActiveLorebookView,
} from "../../lib/chat-lorebooks";
import { getChatCharacterIds, resolveGreetingPreview } from "../../lib/chat-macros";
import { cardAnswerValues } from "../../lib/onboarding-preview-highlight";
import { getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { extractCreatorNotesCss } from "../../lib/creator-notes-css";
import { isLorebookScopeActiveForChat } from "../../lib/lorebook-scope";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { useUIStore } from "../../stores/ui.store";
import { blurActiveChatFloatingUiControl } from "../../lib/chat-floating-ui-events";
import { requestChatHelp } from "../../lib/chat-help-events";
import {
  CHAT_SETTINGS_WINDOW_ID,
  PHONE_LAYOUT_QUERY,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";
import { getChatSettingsWindowProps, useTrackerPanelClearance } from "../../components/chat/chat-settings-window";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useChatControlDockStore, useHostHasDetachedDrawers } from "../../components/ui/drawer-host";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import type { ChatMode, ChatPreset, PromptPreset } from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  GAME_GM_BUILT_IN_PROMPT_TEMPLATES,
  isAgentManifestAvailableInChatMode,
  isAgentConfigDeleted,
  isBuiltInAgentRuntimeDisabled,
  isRetiredBuiltInAgentId,
  normalizeManualTrackerAgentTypes,
  normalizeAgentPhaseForType,
  normalizeChatSummaryEntries,
  rulesetCombatStyle,
  rulesetCombatStyles,
} from "@marinara-engine/shared";
import type { Chat, GameCombatStyle, Lorebook } from "@marinara-engine/shared";
import { normalizeSpritePlacements } from "../../components/chat/sprite-placement";
import { type LocalSpriteVisualSettings } from "../../components/chat/local-sprite-visual-settings";
import { takePendingChatResourcePanelRestore } from "../../lib/chat-resource-drag";
import { MultiplayerPlayersSection, type MultiplayerGameStart } from "../multiplayer/MultiplayerHostControls";
import { multiplayerGuestErrorLabelKey } from "../multiplayer/multiplayer-guest-labels";
import { multiplayerActionError, useMultiplayerMutation } from "../../hooks/use-multiplayer";
import { MemoryRecallMemoriesModal } from "./MemoryRecallMemoriesModal";
import { getAgentSettingsMenuId, type AvailableAgent, useChatAgents } from "./agents/use-chat-agents";
import { AgentAddModal } from "./agents/AgentAddModal";
import { Spinner } from "../../components/ui/Spinner";

const QuickPresetSectionsEditor = lazy(() =>
  import("../../components/presets/PresetEditor").then((module) => ({ default: module.QuickPresetSectionsEditor })),
);
const InlineChatCardEditor = lazy(() =>
  import("./inline-editors/InlineChatCardEditor").then((module) => ({
    default: module.InlineChatCardEditor,
  })),
);
const InlineLorebookEntriesEditor = lazy(() =>
  import("./inline-editors/InlineLorebookEntriesEditor").then((module) => ({
    default: module.InlineLorebookEntriesEditor,
  })),
);
const ChatGalleryPanel = lazy(() =>
  import("./ChatGalleryPanel").then((module) => ({ default: module.ChatGalleryPanel })),
);
const ActiveLorebookEntriesContent = lazy(() =>
  import("../../components/chat/ChatRoleplayPanels").then((module) => ({
    default: module.ActiveLorebookEntriesContent,
  })),
);

const DRAWER_WINDOW_SCROLL_AREA = cn(NEUTRAL_PANEL_SCROLL_AREA, "@container");

/** Chat tools that used to be top buttons, which only the chat surface can fill. */
export interface ChatSettingsTools {
  /** Roleplay: the Chat Summary drawer. */
  summary?: ReactNode;
  /** Roleplay: the cards, lorebooks and preset in use. Without it, Active Context lists the active lorebook entries. */
  activeContext?: ReactNode;
  /** Roleplay: the Author's Notes drawer. */
  authorNotes?: ReactNode;
}

interface ChatSettingsDrawerProps {
  chat: Chat;
  /** The window shows. While it is closed, popped-out sections keep it mounted out of sight. */
  open: boolean;
  /** `force` closes a pinned window too; without it, a pinned window stays open. */
  onClose: (options?: { force?: boolean }) => void;
  anchor?: ChatToolbarFloatingPanelAnchor;
  /** Show the Help Layout button beside the title (chats that mount the Help overlay). */
  showHelpLayout?: boolean;
  initialSection?:
    | "autonomous"
    | "memory-recall"
    | "multiplayer"
    | "summary"
    | "active-context"
    | "message-search"
    // R2: the reply checkup's links to Max output tokens and the lorebook token budget.
    | "advanced-parameters"
    | "lorebooks"
    // The agents panel's "In this chat" rows: opens Agents at that agent's menu.
    | `agent:${string}`
    | null;
  /**
   * Chat Branches, Search, Active Context, Gallery and the drawers in `ChatSettingsTools`. Regular chats
   * pass it; multiplayer hosting does not.
   */
  chatTools?: ChatSettingsTools;
  multiplayerGameStart?: MultiplayerGameStart;
  spriteArrangeMode?: boolean;
  onToggleSpriteArrange?: () => void;
  onResetSpritePlacements?: () => void;
  onResetSpriteCharacterVisualSettings?: (characterId: string) => void;
  onSpriteSideChange?: (side: "left" | "right", characterId?: string) => void;
  spriteVisualSettings?: LocalSpriteVisualSettings;
  onSpriteVisualSettingsChange?: (patch: Partial<LocalSpriteVisualSettings>) => void;
  /** The Avatars drawer's controls, in chats whose stage can show avatars. */
  avatarLayout?: AvatarLayoutControls;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
}

const MARINARA_UNIVERSAL_PRESET_NAME = "Marinara's Universal Preset";
const MARINARA_UNIVERSAL_PRESET_AUTHOR = "Marinara";

// Opening Chat settings read every card's onboarding JSON again; cache it per card object (the
// query cache keeps a card's identity until it changes), checked against the same data string.
const cardOnboardingCache = new WeakMap<object, { data: string; value: ReturnType<typeof readCardOnboarding> }>();
function readCardOnboardingCached(character: { data: string }) {
  const cached = cardOnboardingCache.get(character);
  if (cached && cached.data === character.data) return cached.value;
  const value = readCardOnboarding(character.data);
  cardOnboardingCache.set(character, { data: character.data, value });
  return value;
}

export function ChatSettingsDrawer({
  chat,
  open: windowOpen,
  onClose,
  anchor,
  showHelpLayout = false,
  initialSection,
  chatTools,
  multiplayerGameStart,
  spriteArrangeMode = false,
  onToggleSpriteArrange,
  onResetSpritePlacements,
  onResetSpriteCharacterVisualSettings,
  onSpriteSideChange,
  spriteVisualSettings,
  onSpriteVisualSettingsChange,
  avatarLayout,
  onOpenScheduleEditor,
}: ChatSettingsDrawerProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const qc = useQueryClient();
  // Popped-out sections render from here, so the settings stay live while any of them is open.
  const sectionsPoppedOut = useHostHasDetachedDrawers(CHAT_SETTINGS_WINDOW_ID);
  const open = windowOpen || sectionsPoppedOut;
  const setControlDockHost = useChatControlDockStore((state) => state.setElement);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // On phones the sheet keeps the field being typed in (a summary, the notes) above the keyboard.
  const modePromptDefaultAppliedRef = useRef<string | null>(null);
  const agentSuiteCloseGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const drawerClosingRef = useRef(false);
  const updateChat = useUpdateChat();
  const roomRoster = useMultiplayerMutation<unknown, MultiplayerHostAction>("/multiplayer/host/actions");
  const updateMeta = useUpdateChatMetadata();
  const updateTranslationMeta = useUpdateChatMetadata({ serialize: true });
  const createMessage = useCreateMessage(chat.id);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const showContextUsage = useUIStore((s) => s.showContextUsage);
  const chatHelpButtonHidden = useUIStore((s) => s.chatHelpButtonHidden ?? false);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  // Phones show Chat Settings as a full-width sheet.
  const phoneLayout = useMatchMedia(PHONE_LAYOUT_QUERY);
  const trackerPanelClearance = useTrackerPanelClearance(!phoneLayout);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const setTrackerPanelEnabled = useUIStore((s) => s.setTrackerPanelEnabled);
  const resetView = useFloatingWindowStore((s) => s.resetView);

  const { data: allCharacters } = useCharacters({ includeBuiltIn: true });
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: defaultPromptPreset } = useDefaultPreset();
  const { data: installedAgentManifests = [] } = useCapabilityAgentRegistry();
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages(open);
  const persistedChatMode = (chat as unknown as { mode?: unknown }).mode;
  const chatMode: ChatMode =
    persistedChatMode === "conversation" || persistedChatMode === "roleplay" || persistedChatMode === "game"
      ? persistedChatMode
      : "roleplay";
  const isConversation = chatMode === "conversation";
  const isGame = chatMode === "game";
  const isRoleplayMode = chatMode === "roleplay";
  const modeSettingsSurfaces = CHAT_SETTINGS_SURFACES[chatMode];
  const metadata = useMemo(
    () => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {})),
    [chat.metadata],
  );
  const groupChatMode = normalizeGroupChatMode(metadata.groupChatMode);
  // The dice in the title bar: one click turns the Tracker Panel on and shows it, the next turns it off.
  const trackerPanelToggleAvailable =
    isRoleplayMode && (metadata.enableAgents === true || metadata.advancedMemory?.enabled === true);
  const trackerPanelShown = trackerPanelEnabled && trackerPanelOpen;
  const toggleTrackerPanel = () => {
    if (trackerPanelShown) {
      setTrackerPanelOpen(false, chat.id);
      return;
    }
    // Open needs the panel enabled first.
    setTrackerPanelEnabled(true);
    setTrackerPanelOpen(true, chat.id);
  };
  // Chat variables live in the same map {{setvar}} writes, so a value a prompt
  // or lorebook set shows up here as an editable row.
  const chatMacroVariables = useMemo<Record<string, string>>(() => {
    const stored: unknown = metadata.macroVariables;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }, [metadata.macroVariables]);
  const { data: currentPromptPresetFull } = usePresetFull(isRoleplayMode ? (chat.promptPresetId ?? null) : null);
  const promptPresetOptionsLoaded = Array.isArray(presets);
  const promptPresetOptions = useMemo(() => (presets ?? []) as PromptPreset[], [presets]);
  const marinaraUniversalPromptPreset = useMemo(
    () =>
      promptPresetOptions.find(
        (preset) =>
          preset.name === MARINARA_UNIVERSAL_PRESET_NAME && preset.author === MARINARA_UNIVERSAL_PRESET_AUTHOR,
      ) ?? null,
    [promptPresetOptions],
  );
  const fallbackPromptPreset = useMemo(() => {
    return (
      marinaraUniversalPromptPreset ??
      defaultPromptPreset ??
      promptPresetOptions.find((preset) => preset.isDefault) ??
      null
    );
  }, [defaultPromptPreset, marinaraUniversalPromptPreset, promptPresetOptions]);
  const hasModeCustomPrompt =
    isConversation && typeof metadata.customSystemPrompt === "string" && metadata.customSystemPrompt.trim().length > 0
      ? true
      : isGame && typeof metadata.gameSystemPrompt === "string" && metadata.gameSystemPrompt.trim().length > 0;
  const shouldApplyModePromptDefault = (isConversation || isGame) && promptPresetOptionsLoaded && !hasModeCustomPrompt;
  const effectiveModePromptPresetId =
    chat.promptPresetId ?? (shouldApplyModePromptDefault ? (fallbackPromptPreset?.id ?? null) : null);
  const selectedModePromptPreset = useMemo(() => {
    if (!effectiveModePromptPresetId) return null;
    return (
      promptPresetOptions.find((preset) => preset.id === effectiveModePromptPresetId) ??
      (fallbackPromptPreset?.id === effectiveModePromptPresetId ? fallbackPromptPreset : null)
    );
  }, [effectiveModePromptPresetId, fallbackPromptPreset, promptPresetOptions]);
  const { data: connections } = useConnections();
  // The chat Connection section reads `showUsageWidget` to gate the NanoGPT
  // usage meter, so keep these rows typed instead of casting fields away.
  const connectionRows = useMemo(() => (connections as ChatConnectionOption[] | undefined) ?? [], [connections]);
  const textConnectionsList = useMemo(() => filterLanguageGenerationConnections(connectionRows), [connectionRows]);
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const sidecarMaxContext = useSidecarStore((state) => state.config.contextSize);
  const chatGenerationConnectionsList = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        textConnectionsList,
        !isGame && sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [isGame, sidecarModelDisplayName, sidecarModelDownloaded, textConnectionsList],
  );
  const gameContextMessagesQuery = useChatMessagePeek(chat.id, 20, open && isGame && showContextUsage);
  const gameContextBudget = useMemo(
    () =>
      isGame && showContextUsage
        ? resolveChatContextBudget(
            gameContextMessagesQuery.data ?? [],
            chat.connectionId,
            connections ?? [],
            sidecarMaxContext,
          )
        : null,
    [chat.connectionId, connections, gameContextMessagesQuery.data, isGame, showContextUsage, sidecarMaxContext],
  );
  const { data: allPersonas } = usePersonas();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: allChats } = useChats({ refetchOnMount: false });
  const personas = useMemo(() => allPersonas ?? [], [allPersonas]);

  const chatCharIds: string[] = useMemo(
    () => getChatCharacterIds({ characterIds: chat.characterIds }),
    [chat.characterIds],
  );

  // Creator-notes card CSS: the current per-chat mode (default "chat"), and
  // whether any active character actually ships CSS — the CSS mode buttons
  // only appear when one does, so they never clutter chats they can't affect.
  const cardCssMode: "disabled" | "exclusive" | "chat" =
    metadata.cardCssMode === "exclusive" || metadata.cardCssMode === "chat" ? metadata.cardCssMode : "disabled";
  // ponytail: chats that never set it inherit the retired global Text Rules switch, so it stays on for its users.
  const legacyColorInlineNames = useUIStore((s) => s.colorInlineNames);
  const colorInlineNames =
    typeof metadata.colorInlineNames === "boolean" ? metadata.colorInlineNames : legacyColorInlineNames;
  // Unset follows the character switch, so a chat with coloring off stays unchanged.
  const colorPersonaInlineNames = resolvePersonaInlineNames(metadata.colorPersonaInlineNames, colorInlineNames);
  const activeCardsHaveCss = useMemo(() => {
    if (!allCharacters) return false;
    const byId = new Map((allCharacters as Array<{ id: string; data: unknown }>).map((c) => [c.id, c]));
    return chatCharIds.some((id) => {
      const row = byId.get(id);
      if (!row) return false;
      let parsed: Record<string, unknown>;
      try {
        if (typeof row.data === "string") parsed = JSON.parse(row.data) as Record<string, unknown>;
        else if (row.data && typeof row.data === "object") parsed = row.data as Record<string, unknown>;
        else return false;
      } catch {
        return false;
      }
      const notes = (parsed as { creator_notes?: string }).creator_notes;
      return typeof notes === "string" && extractCreatorNotesCss(notes).css.trim().length > 0;
    });
  }, [allCharacters, chatCharIds]);
  // Unset chat choices inherit the selected preset; explicit choices remain overrides.
  const presetScopedRegexMode = resolveScopedRegexMode(
    promptPresetOptions.find((preset) => preset.id === chat.promptPresetId)?.scopedRegexMode,
  );
  const inheritsScopedRegexMode = metadata.scopedRegexMode == null;
  const scopedRegexMode = resolveScopedRegexMode(metadata.scopedRegexMode, presetScopedRegexMode);
  // A full-page surface opened from this drawer: Back from it reopens the drawer (see `chatSettingsReturn`).
  const rememberSettingsReturn = useCallback(
    () => useUIStore.getState().setChatSettingsReturn({ chatId: chat.id, section: initialSection ?? null }),
    [chat.id, initialSection],
  );
  const closeForSurface = useCallback(() => {
    rememberSettingsReturn();
    onClose();
  }, [onClose, rememberSettingsReturn]);
  const inactiveCharacterIds = useMemo<string[]>(
    () =>
      Array.isArray(metadata.inactiveCharacterIds)
        ? metadata.inactiveCharacterIds.filter(
            (id: unknown): id is string => typeof id === "string" && chatCharIds.includes(id),
          )
        : [],
    [chatCharIds, metadata.inactiveCharacterIds],
  );
  const activeCharacterIds = useMemo<string[]>(
    () => chatCharIds.filter((id) => !inactiveCharacterIds.includes(id)),
    [chatCharIds, inactiveCharacterIds],
  );
  const supportsCharacterActivityToggle = chatCharIds.length > 1 && !isGame;
  const { data: chatBranches } = useChatGroup(chatTools ? (chat.groupId ?? null) : null);
  const branchCount = Math.max(1, chatBranches?.length ?? 0);
  const enabledSummaryCount = useMemo(
    () =>
      normalizeChatSummaryEntries(Array.isArray(metadata.summaryEntries) ? metadata.summaryEntries : [], {
        legacySummary: typeof metadata.summary === "string" ? metadata.summary : null,
      }).filter((entry) => entry.enabled).length,
    [metadata.summary, metadata.summaryEntries],
  );
  useEffect(() => {
    if (!open || initialSection !== "memory-recall" || !isRoleplayMode) return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector('[data-chat-settings-section="roleplay-memory-recall"]')
        ?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, isRoleplayMode, open]);
  useEffect(() => {
    const sectionId =
      initialSection === "summary"
        ? "chat-summary"
        : initialSection === "active-context"
          ? "active-context"
          : initialSection === "message-search"
            ? "message-search"
            : null;
    if (!open || !sectionId) return;
    const frame = window.requestAnimationFrame(() => {
      const section = panelRef.current?.querySelector(`[data-chat-settings-section="${chatMode}-${sectionId}"]`);
      section?.scrollIntoView({ block: "start" });
      // The omnibar's "Search this chat" lands in the search field, ready to type.
      if (sectionId === "message-search") section?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatMode, initialSection, open]);
  useEffect(() => {
    if (
      !open ||
      (initialSection !== "multiplayer" && initialSection !== "advanced-parameters" && initialSection !== "lorebooks")
    )
      return;
    const frame = window.requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector(`[data-chat-settings-section="${initialSection}"]`)
        ?.scrollIntoView({ block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, open]);
  const activeLorebookIds = useMemo(() => getChatActiveLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  const excludedLorebookIds = useMemo(() => getChatExcludedLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  const gameLorebookKeeperEnabled = metadata.gameLorebookKeeperEnabled === true;
  const gameLorebookKeeperLorebookId =
    typeof metadata.gameLorebookKeeperLorebookId === "string" ? metadata.gameLorebookKeeperLorebookId : null;
  const activeLorebooks = useMemo<ActiveLorebookView[]>(() => {
    return deriveActiveLorebookViews({
      activeLorebookIds,
      chat,
      excludedLorebookIds,
      excludeGameLorebookKeeper: isGame && !gameLorebookKeeperEnabled,
      gameLorebookKeeperLorebookId,
      lorebooks: (lorebooks ?? []) as Lorebook[],
    });
  }, [
    activeLorebookIds,
    excludedLorebookIds,
    chat,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    isGame,
    lorebooks,
  ]);
  const agentConfigsByType = useMemo(() => {
    const map = new Map<string, AgentConfigRow>();
    for (const config of (agentConfigs ?? []) as AgentConfigRow[]) {
      map.set(config.type, config);
    }
    return map;
  }, [agentConfigs]);
  const installedAgentIds = useMemo(
    () => new Set(installedAgentManifests.map((agent) => agent.id)),
    [installedAgentManifests],
  );
  const deletedBuiltInAgentTypes = useMemo(
    () =>
      new Set(
        ((agentConfigs ?? []) as AgentConfigRow[])
          .filter((config) => installedAgentIds.has(config.type))
          .filter((config) => isAgentConfigDeleted(config.settings))
          .map((config) => config.type),
      ),
    [agentConfigs, installedAgentIds],
  );
  const activeAgentIds = useMemo<string[]>(
    () =>
      (Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : []).filter(
        (id: unknown): id is string => typeof id === "string" && !deletedBuiltInAgentTypes.has(id),
      ),
    [deletedBuiltInAgentTypes, metadata.activeAgentIds],
  );
  // Automated active characters run only in Merged Roleplay groups; anywhere else the setting is ignored.
  const autoActiveCharactersMode: AutoActiveCharactersMode =
    isRoleplayMode && groupChatMode === "merged" && chatCharIds.length > 1
      ? metadata.autoActiveCharacters === "decision" || metadata.autoActiveCharacters === "tracker"
        ? metadata.autoActiveCharacters
        : "off"
      : "off";
  const autoActiveCharacterPins = useMemo<string[]>(
    () =>
      Array.isArray(metadata.autoActiveCharacterPins)
        ? metadata.autoActiveCharacterPins.filter((id: unknown): id is string => typeof id === "string")
        : [],
    [metadata.autoActiveCharacterPins],
  );
  const activeToolIds: string[] = metadata.activeToolIds ?? [];
  const spriteCharacterIds = useMemo<string[]>(
    () => (Array.isArray(metadata.spriteCharacterIds) ? metadata.spriteCharacterIds : []),
    [metadata.spriteCharacterIds],
  );
  // Build the available agent list: built-in + custom agents from DB
  // Mode capabilities decide which built-ins are exposed for each chat mode.
  // Custom agents are user-authored and can be attached to any chat mode.
  const availableAgents = useMemo(() => {
    const agents: AvailableAgent[] = [];
    for (const a of installedAgentManifests) {
      if (a.libraryHidden) continue;
      if (!isAgentManifestAvailableInChatMode(chatMode, a)) continue;
      const existing = agentConfigsByType.get(a.id);
      if (existing && isAgentConfigDeleted(existing.settings)) continue;
      agents.push({
        id: a.id,
        name: a.name,
        description: existing?.description ?? a.description,
        category: a.category,
        phase: normalizeAgentPhaseForType(a.id, existing?.phase ?? a.phase),
        builtIn: true,
        runtimeDisabled: isBuiltInAgentRuntimeDisabled(a.id),
        execution: a.execution,
      });
    }
    // Custom agents from DB
    if (agentConfigs) {
      for (const c of agentConfigs as AgentConfigRow[]) {
        if (isAgentConfigDeleted(c.settings)) continue;
        if (isRetiredBuiltInAgentId(c.type)) continue;
        if (!installedAgentIds.has(c.type)) {
          agents.push({
            id: c.type,
            name: c.name,
            description: c.description,
            category: "custom",
            phase: normalizeAgentPhaseForType(c.type, c.phase),
            builtIn: false,
            runtimeDisabled: false,
            execution: "pipeline",
          });
        }
      }
    }
    return agents;
  }, [agentConfigs, agentConfigsByType, chatMode, installedAgentIds, installedAgentManifests]);
  const activeTrackerAgents = useMemo(
    () =>
      availableAgents.filter(
        (agent) => agent.category === "tracker" && activeAgentIds.includes(agent.id) && !agent.runtimeDisabled,
      ),
    [activeAgentIds, availableAgents],
  );
  const manualTrackerAgentTypes = useMemo(
    () => normalizeManualTrackerAgentTypes(metadata.manualTrackerAgentTypes),
    [metadata.manualTrackerAgentTypes],
  );
  const activeManualTrackerTypes = useMemo(() => {
    const set = new Set<string>();
    for (const agent of activeTrackerAgents) {
      if (metadata.manualTrackers === true || manualTrackerAgentTypes[agent.id] === true) set.add(agent.id);
    }
    return set;
  }, [activeTrackerAgents, manualTrackerAgentTypes, metadata.manualTrackers]);
  // A missing choice is by side: every game before turn order was a choice played that way (combat C6c).
  const effectiveTurnOrder: "side" | "initiative" =
    ((metadata.gameTacticalTurnOrder ?? metadata.gameSetupConfig?.tacticalTurnOrder) as string | undefined) ===
    "initiative"
      ? "initiative"
      : "side";
  // Whether this game's battles are the ruleset's own. Read from the block the file declares and
  // from the director being on, never from the coverage flag the file claims.
  const gameRuleset = useGameRuleset(isGame ? metadata : null);
  const rulesetResolvesFights =
    gameRuleset.status === "ok" &&
    isRulesetCombatFight({
      combatDirector: (metadata.gameSetupConfig as Record<string, unknown> | undefined)?.combatDirector === true,
      definition: gameRuleset.definition,
      // The preference is settled before any fight, so there is no anchor to read here: what this
      // line says is what will happen the next time a battle starts.
      anchor: "settings",
    });
  // And whether that ruleset says what one cell of a board is worth, which is what turns the
  // preference below from a kept-and-unused choice into the one that decides whether the fight has
  // positions.
  const rulesetHasPositions =
    rulesetResolvesFights && gameRuleset.status === "ok" && !!gameRuleset.definition.combat?.distance;
  // The styles that ruleset lets the game play (1.379): a saved one it leaves out shows, and plays, as
  // the first it lists.
  const rulesetDefinition = gameRuleset.status === "ok" ? gameRuleset.definition : null;
  const allowedCombatStyles = rulesetCombatStyles(rulesetDefinition);
  const effectiveCombatStyle: GameCombatStyle = resolveCombatStyle(
    rulesetCombatStyle(
      rulesetDefinition,
      (metadata.gameCombatStyle as GameCombatStyle | undefined) ??
        (metadata.gameSetupConfig?.combatStyle as GameCombatStyle | undefined),
      listCombatStyles(),
    ),
  );
  const selectedGameGmPromptTemplateId = useMemo(() => {
    const selected = typeof metadata.gameGmPromptTemplateId === "string" ? metadata.gameGmPromptTemplateId.trim() : "";
    return selected && GAME_GM_BUILT_IN_PROMPT_TEMPLATES.some((template) => template.id === selected) ? selected : null;
  }, [metadata.gameGmPromptTemplateId]);
  const updateGameGmPromptTemplateSelection = useCallback(
    (templateId: string | null) => {
      updateMeta.mutate({ id: chat.id, gameGmPromptTemplateId: templateId });
    },
    [chat.id, updateMeta],
  );

  // ── Helpers ──
  const characters = useMemo(() => (allCharacters ?? []) as CastCharacter[], [allCharacters]);

  const chatCharacters = useMemo(
    () =>
      chatCharIds
        .map((characterId) => characters.find((character) => character.id === characterId))
        .filter((character): character is { id: string; data: string; avatarPath: string | null } => !!character),
    [chatCharIds, characters],
  );

  // One parse pass over every card, shared by the available-list badge, the
  // persona rows and the in-chat question action. The gate is the wizard's:
  // onboarding is enabled and offers something. A card that is enabled but empty
  // never shows a marker or a row.
  const onboardingByCharacterId = useMemo(() => {
    const byId = new Map<string, CardOnboarding>();
    for (const character of characters) {
      const cardOnboarding = readCardOnboardingCached(character);
      if (!cardOnboarding?.onboarding.enabled || !hasOnboardingContent(cardOnboarding.onboarding)) continue;
      byId.set(character.id, cardOnboarding);
    }
    return byId;
  }, [characters]);

  // Every character in this chat whose card can build a persona from interactive
  // onboarding. Roleplay only: the Roleplay wizard is what asks onboarding, and
  // Game Mode's party uses a separate picker. The wizard offers exactly the same
  // rows (`canBuildPersona`), so a card is offered here under the same rule.
  const onboardingPersonaTemplates = useMemo(() => {
    if (isGame || isConversation) return [];
    return chatCharIds.flatMap((characterId) => {
      const character = characters.find((entry) => entry.id === characterId);
      const cardOnboarding = onboardingByCharacterId.get(characterId);
      if (!character || !cardOnboarding || !canBuildPersona(cardOnboarding.onboarding)) return [];
      return [{ character, cardOnboarding }];
    });
  }, [characters, chatCharIds, isConversation, isGame, onboardingByCharacterId]);

  // The characters whose cards declare questions the CURRENT no-answer context
  // makes relevant: exactly the rule the wizard uses to decide whether to ask a
  // card at all. The marker on a Characters row opens this card's questions alone,
  // so an answer can be changed or restored after the setup wizard is gone.
  // Roleplay only, like the persona rows above.
  const onboardingCardQuestionTargets = useMemo(() => {
    if (isGame || isConversation) return [];
    return chatCharIds.flatMap((characterId) => {
      const character = characters.find((entry) => entry.id === characterId);
      const cardOnboarding = onboardingByCharacterId.get(characterId);
      if (!character || !cardOnboarding) return [];
      const questions = getRelevantCardVariables(cardOnboarding.onboarding, cardOnboarding.cardFields, {});
      if (questions.length === 0) return [];
      return [{ character, cardOnboarding }];
    });
  }, [characters, chatCharIds, isConversation, isGame, onboardingByCharacterId]);
  // Lookup for the row render; the list is rebuilt only when the roster changes.
  const onboardingCardQuestionsById = useMemo(
    () => new Map(onboardingCardQuestionTargets.map((entry) => [entry.character.id, entry])),
    [onboardingCardQuestionTargets],
  );

  const chatCharacterCount = allCharacters == null ? chatCharIds.length : chatCharacters.length;

  // Memoize character name parsing — avoids repeated JSON.parse per render
  const charInfoMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof parseCharacterDisplayData>>();
    for (const c of characters) {
      map.set(c.id, parseCharacterDisplayData(c));
    }
    return map;
  }, [characters]);

  const charNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, info] of charInfoMap) {
      map.set(id, info.name);
    }
    return map;
  }, [charInfoMap]);

  const getCharacterInfo = useCallback(
    (c: { id?: string; data: string | Record<string, unknown>; comment?: string | null }) => {
      if (c.id && charInfoMap.has(c.id)) return charInfoMap.get(c.id)!;
      return parseCharacterDisplayData(c);
    },
    [charInfoMap],
  );

  const charName = useCallback(
    (c: { id?: string; data: string | Record<string, unknown>; comment?: string | null }) => getCharacterInfo(c).name,
    [getCharacterInfo],
  );

  const charTitle = useCallback(
    (c: { id?: string; data: string | Record<string, unknown>; comment?: string | null }) =>
      getCharacterTitle(getCharacterInfo(c)),
    [getCharacterInfo],
  );

  const renderInlineCardEditor = (kind: "character" | "persona", id: string, displayName: string) => {
    if (inlineResourceEditor?.kind !== kind || inlineResourceEditor.id !== id) return null;
    return (
      <Suspense
        fallback={
          <div className="mari-chat-settings-inline-editor mt-2 space-y-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5">
            <div className="shimmer h-7 rounded-lg" />
            <div className="shimmer h-14 rounded-lg" />
            <div className="shimmer h-14 rounded-lg" />
          </div>
        }
      >
        <InlineChatCardEditor
          key={`${kind}:${id}`}
          entityKind={kind}
          entityId={id}
          displayName={displayName}
          onClose={() => setInlineResourceEditor(null)}
          onFlushChange={handleInlineCardFlushChange}
        />
      </Suspense>
    );
  };

  // ── First message confirm state ──
  type FirstMesConfirm = {
    charId: string;
    charName: string;
    dialogueColor?: string;
    greetings: CharacterGreeting[];
    selectedIndex: number;
  };
  const [firstMesConfirm, setFirstMesConfirm] = useState<FirstMesConfirm | null>(null);
  // A card just added to this chat. Its questions (if it has any) come before its
  // greeting, so the greeting waits here until the chat reports the card and the
  // answers the server seeded for it.
  const [pendingAddedCard, setPendingAddedCard] = useState<{
    charId: string;
    greeting: FirstMesConfirm | null;
  } | null>(null);
  // The player's answers to this card's questions, read live from the chat so the
  // dialog shows what was just saved once the chat refreshes. Marked in the previews.
  const greetingAnswerValues = useMemo(
    () =>
      firstMesConfirm
        ? cardAnswerValues(
            onboardingByCharacterId.get(firstMesConfirm.charId)?.onboarding.cardVariables ?? [],
            chatMacroVariables,
          )
        : [],
    [chatMacroVariables, firstMesConfirm, onboardingByCharacterId],
  );
  const greetingDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusScope(firstMesConfirm !== null, greetingDialogRef);

  useEffect(() => {
    if (!firstMesConfirm) return;
    const dismissGreetingDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFirstMesConfirm(null);
    };
    document.addEventListener("keydown", dismissGreetingDialog);
    return () => document.removeEventListener("keydown", dismissGreetingDialog);
  }, [firstMesConfirm]);

  const handleFirstMesConfirm = useCallback(async () => {
    if (!firstMesConfirm) return;
    const confirmation = firstMesConfirm;
    const selectedGreeting = confirmation.greetings[confirmation.selectedIndex];
    if (!selectedGreeting) return;
    let messageId: string | null;
    try {
      const msg = await createMessage.mutateAsync({
        role: "assistant",
        content: selectedGreeting.text,
        characterId: confirmation.charId,
      });
      messageId = msg?.id ?? null;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
      return;
    }

    const remainingGreetings = confirmation.greetings
      .filter((_greeting, index) => index !== confirmation.selectedIndex)
      .map((greeting) => greeting.text);
    try {
      if (messageId && remainingGreetings.length > 0) {
        await addSilentGreetingSwipes(chat.id, messageId, remainingGreetings);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
    }
    try {
      await qc.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"),
      );
    }
    setFirstMesConfirm((current) => (current === confirmation ? null : current));
  }, [firstMesConfirm, createMessage, chat.id, qc, localizeUi]);

  // ── Mutations ──
  const syncGamePartyMetadata = (nextCharacterIds: string[]) => {
    if (!isGame) return;
    const storedPartyIds: unknown[] = Array.isArray(metadata.gamePartyCharacterIds)
      ? metadata.gamePartyCharacterIds
      : Array.isArray((metadata.gameSetupConfig as { partyCharacterIds?: unknown[] } | undefined)?.partyCharacterIds)
        ? (metadata.gameSetupConfig as { partyCharacterIds: unknown[] }).partyCharacterIds
        : [];
    const npcPartyIds = storedPartyIds.filter((id): id is string => typeof id === "string" && id.startsWith("npc:"));
    const nextPartyIds = Array.from(new Set([...nextCharacterIds, ...npcPartyIds]));
    const gameSetupConfig =
      metadata.gameSetupConfig && typeof metadata.gameSetupConfig === "object"
        ? { ...(metadata.gameSetupConfig as Record<string, unknown>), partyCharacterIds: nextPartyIds }
        : metadata.gameSetupConfig;
    updateMeta.mutate({
      id: chat.id,
      gamePartyCharacterIds: nextPartyIds,
      ...(gameSetupConfig ? { gameSetupConfig } : {}),
    });
  };

  // A removed character also leaves the chat's sprite and inactive-character lists.
  const clearRemovedCharacterMetadata = (charId: string) => {
    if (spriteCharacterIds.includes(charId)) {
      const nextSpritePlacements = { ...normalizeSpritePlacements(metadata.spritePlacements) };
      delete nextSpritePlacements[charId];
      delete nextSpritePlacements[`${charId}:expressions`];
      delete nextSpritePlacements[`${charId}:full-body`];
      updateMeta.mutate({
        id: chat.id,
        spriteCharacterIds: spriteCharacterIds.filter((id) => id !== charId),
        spritePlacements: nextSpritePlacements,
      });
    }
    if (inactiveCharacterIds.includes(charId)) {
      updateMeta.mutate({
        id: chat.id,
        inactiveCharacterIds: inactiveCharacterIds.filter((id) => id !== charId),
      });
    }
  };

  // A hosted room keeps its AI roster in the room, so roster changes go through the room and replies keep working.
  const hostedRoom = metadata.multiplayer?.role === "host";
  const changeRoomCharacters = async (add: string[], remove: string[]) => {
    try {
      for (const characterId of remove) {
        await roomRoster.mutateAsync({ type: "remove-character", characterId });
        clearRemovedCharacterMetadata(characterId);
      }
      for (const characterId of add)
        await roomRoster.mutateAsync({ type: "add-character", characterId, role: "character" });
    } catch (error) {
      const code = multiplayerActionError(error);
      toast.error(t(code === "identity-conflict" ? multiplayerGuestErrorLabelKey(code) : "multiplayer.actionFailed"));
    }
  };

  const toggleCharacter = (charId: string) => {
    if (hostedRoom) {
      const removing = chatCharIds.includes(charId);
      void changeRoomCharacters(removing ? [] : [charId], removing ? [charId] : []);
      return;
    }
    const current = [...chatCharIds];
    const idx = current.indexOf(charId);
    if (idx >= 0) {
      current.splice(idx, 1);
      updateChat.mutate(
        { id: chat.id, characterIds: current },
        {
          onSuccess: () => syncGamePartyMetadata(current),
        },
      );
      clearRemovedCharacterMetadata(charId);
      setPendingAddedCard((pending) => (pending?.charId === charId ? null : pending));
    } else {
      current.push(charId);
      updateChat.mutate(
        { id: chat.id, characterIds: current },
        {
          onSuccess: () => {
            syncGamePartyMetadata(current);
            // Skip auto-greeting for conversation mode
            if (isConversation) return;
            const char = characters.find((c) => c.id === charId);
            if (!char) return;
            const { greetings, dialogueColor } = readCharacterGreetings(char.data);
            // The card's questions (if any) open first; the effect below then shows the greeting.
            setPendingAddedCard({
              charId,
              greeting:
                greetings.length > 0
                  ? { charId, charName: charName(char), dialogueColor, greetings, selectedIndex: 0 }
                  : null,
            });
          },
        },
      );
    }
  };

  const toggleChangedCharacter = (ids: string[]) => {
    const id = changedId(chatCharIds, ids);
    if (id) toggleCharacter(id);
  };

  const handleCreateCustomTool = () => {
    rememberSettingsReturn();
    openToolDetail("__new__");
    onClose();
  };

  const currentPromptPresetHasVariables = (currentPromptPresetFull?.choiceBlocks?.length ?? 0) > 0;
  const currentPromptPresetHasLorebookMarker = useMemo(() => {
    const sections = currentPromptPresetFull?.sections ?? [];
    return sections.some((section) => {
      const enabled = (section as { enabled?: boolean | string }).enabled;
      const isMarker = (section as { isMarker?: boolean | string }).isMarker;
      if (enabled === false || enabled === "false") return false;
      if (isMarker !== true && isMarker !== "true") return false;
      try {
        const config =
          typeof section.markerConfig === "string" ? JSON.parse(section.markerConfig) : section.markerConfig;
        return (
          config?.type === "lorebook" || config?.type === "world_info_before" || config?.type === "world_info_after"
        );
      } catch {
        return false;
      }
    });
  }, [currentPromptPresetFull?.sections]);
  const hasScopedOrGlobalLorebooks = useMemo(() => {
    return ((lorebooks ?? []) as Lorebook[]).some(
      (lorebook) =>
        lorebook.enabled !== false &&
        isLorebookScopeActiveForChat(lorebook.scope, chat.id) &&
        !(
          isGame &&
          !gameLorebookKeeperEnabled &&
          (lorebook.id === gameLorebookKeeperLorebookId || lorebook.sourceAgentId === "game-lorebook-keeper")
        ) &&
        (lorebook.isGlobal ||
          activeLorebookIds.includes(lorebook.id) ||
          lorebook.characterIds?.some((id) => chatCharIds.includes(id)) ||
          (lorebook.characterId && chatCharIds.includes(lorebook.characterId)) ||
          (chat.personaId && lorebook.personaIds?.includes(chat.personaId)) ||
          (lorebook.personaId && lorebook.personaId === chat.personaId) ||
          (lorebook.chatId && lorebook.chatId === chat.id)),
    );
  }, [
    activeLorebookIds,
    chat.id,
    chat.personaId,
    chatCharIds,
    gameLorebookKeeperEnabled,
    gameLorebookKeeperLorebookId,
    isGame,
    lorebooks,
  ]);
  const showLorebookMarkerWarning =
    !!chat.promptPresetId &&
    !isConversation &&
    !isGame &&
    hasScopedOrGlobalLorebooks &&
    !currentPromptPresetHasLorebookMarker;

  const [choiceModalPresetId, setChoiceModalPresetId] = useState<string | null>(null);
  const setPreset = useCallback(
    (presetId: string | null) => {
      updateChat.mutate(
        { id: chat.id, promptPresetId: presetId },
        {
          onSuccess: async () => {
            if (!presetId || !isRoleplayMode) {
              setChoiceModalPresetId(null);
              return;
            }

            try {
              const presetFull = await api.get<{ choiceBlocks?: unknown[] }>(`/prompts/${presetId}/full`);
              if ((presetFull.choiceBlocks?.length ?? 0) > 0) {
                setChoiceModalPresetId(presetId);
              } else {
                setChoiceModalPresetId(null);
              }
            } catch {
              setChoiceModalPresetId(null);
            }
          },
        },
      );
    },
    [chat.id, isRoleplayMode, updateChat],
  );
  const assignEditablePresetCopy = useCallback(
    (presetId: string) => {
      updateChat.mutate({ id: chat.id, promptPresetId: presetId });
    },
    [chat.id, updateChat],
  );

  const setConnection = (connectionId: string | null) => {
    updateChat.mutate({ id: chat.id, connectionId });
  };

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(chat.name);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showSummariesModal, setShowSummariesModal] = useState(false);
  const [showAgentSuiteModal, setShowAgentSuiteModal] = useState(false);
  const [memoryView, setMemoryView] = useState<"advanced" | "standard" | null>(null);
  // Game chats keep their memory with the GM as its only reader.
  const advancedMemoryAvailable = isRoleplayMode || isGame;
  const advancedMemoryStatus = useAdvancedMemoryStatus(chat.id, open && advancedMemoryAvailable);
  const advancedMemoryEnabled =
    advancedMemoryAvailable &&
    (advancedMemoryStatus.data?.settings ?? normalizeAdvancedMemorySettings(metadata.advancedMemory)).enabled;
  useEffect(() => setMemoryView(null), [advancedMemoryEnabled, chat.id]);
  // A scene number in the Fix box (or a notice) opens Access memories at that scene.
  const advancedMemorySceneRequest = useUIStore((state) =>
    state.advancedMemoryRequest?.chatId === chat.id ? state.advancedMemoryRequest.sceneId : undefined,
  );
  useEffect(() => {
    if (advancedMemorySceneRequest && advancedMemoryEnabled) setMemoryView("advanced");
  }, [advancedMemoryEnabled, advancedMemorySceneRequest]);
  const advancedMemoryNeedsReview = useMemo(() => {
    const problems = advancedMemoryStatus.data ? advancedMemoryProblems(advancedMemoryStatus.data) : null;
    return !!problems && problems.fixSceneIds.length + problems.reviewSceneIds.length > 0;
  }, [advancedMemoryStatus.data]);
  const [inlineResourceEditor, setInlineResourceEditor] = useState<{
    kind: "character" | "persona" | "lorebook";
    id: string;
  } | null>(null);
  const toggleInlineResourceEditor = useCallback((kind: "character" | "persona" | "lorebook", id: string) => {
    setInlineResourceEditor((current) => (current?.kind === kind && current.id === id ? null : { kind, id }));
  }, []);
  useEffect(() => {
    setInlineResourceEditor(null);
  }, [chat.id]);

  const gameSetupConfig = useMemo(
    () =>
      metadata.gameSetupConfig && typeof metadata.gameSetupConfig === "object"
        ? (metadata.gameSetupConfig as Record<string, unknown>)
        : {},
    [metadata.gameSetupConfig],
  );
  // Agents' state, effects and handlers. The Agents render helpers below and the guarded close (`requestClose`,
  // which saves Prose Guardian's drafts) read them, so the hook is called before both.
  const chatAgents = useChatAgents({
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
  });
  const { agentSuiteAgents, flushProseGuardianDrafts, scrollToAgentMenu } = chatAgents;

  const initialAgentId = initialSection?.startsWith("agent:") ? initialSection.slice("agent:".length) : null;
  useEffect(() => {
    if (!open || !initialAgentId) return;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector(`[data-chat-settings-section="${chatMode}-agents"]`)
        ?.scrollIntoView({ block: "start" });
      scrollToAgentMenu(getAgentSettingsMenuId(chat.id, initialAgentId));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat.id, chatMode, initialAgentId, open, scrollToAgentMenu]);

  const handleAgentSuiteCloseGuardChange = useCallback((guard: (() => Promise<boolean>) | null) => {
    agentSuiteCloseGuardRef.current = guard;
  }, []);
  // The open inline card editor's saves, finished before the drawer closes (#8933): a card opened next must not load
  // the text an inline save is still writing, then overwrite it.
  const inlineCardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const handleInlineCardFlushChange = useCallback((flush: (() => Promise<boolean>) | null) => {
    inlineCardFlushRef.current = flush;
  }, []);
  /** Closes after the drawer's guards pass; `force: false` keeps a pinned drawer open (opening a card from it). */
  const requestClose = useCallback(
    async (force = true) => {
      if (drawerClosingRef.current) return false;
      blurActiveChatFloatingUiControl();
      drawerClosingRef.current = true;
      try {
        const canCloseAgentSuite =
          !showAgentSuiteModal || (await (agentSuiteCloseGuardRef.current?.() ?? Promise.resolve(true)));
        if (!canCloseAgentSuite) return false;
        if (!(await flushProseGuardianDrafts())) return false;
        if (!(await (inlineCardFlushRef.current?.() ?? Promise.resolve(true)))) return false;
        setShowAgentSuiteModal(false);
        onClose({ force });
        return true;
      } finally {
        drawerClosingRef.current = false;
      }
    },
    [flushProseGuardianDrafts, onClose, showAgentSuiteModal],
  );
  // The onboarding template whose questions window is open, picked from the
  // persona picker. A character, not a persona: nothing exists until Create.
  const [onboardingTemplateId, setOnboardingTemplateId] = useState<string | null>(null);
  const onboardingTemplate = onboardingTemplateId
    ? (onboardingPersonaTemplates.find((entry) => entry.character.id === onboardingTemplateId) ?? null)
    : null;
  // The card can leave the chat while its window is open. Drop the stale choice
  // with it, or re-adding the card later would pop the window open again.
  useEffect(() => {
    if (onboardingTemplateId && !onboardingTemplate) setOnboardingTemplateId(null);
  }, [onboardingTemplate, onboardingTemplateId]);
  useEffect(() => {
    setOnboardingTemplateId(null);
  }, [chat.id]);
  /**
   * A persona created from a card's onboarding questions in this drawer (#7796).
   * The persona already exists by the time this runs, so a failed selection must
   * close the window: leaving it open would let a second Create duplicate it. The
   * persona stays in the library, and the picker opens so it can be picked there.
   */
  const handleOnboardingPersonaCreated = useCallback(
    async (personaId: string | null) => {
      setOnboardingTemplateId(null);
      if (!personaId) return;
      try {
        await updateChat.mutateAsync({ id: chat.id, personaId, personaCharacterId: null });
      } catch {
        toast.error(localizeUi("ui.characters.onboarding.selectFailed"));
        setShowPersonaPicker(true);
      }
    },
    [chat.id, localizeUi, updateChat],
  );

  // The card whose character questions are open from the Characters list. Kept
  // separate from the persona template: this window writes chat variables only.
  const [onboardingQuestionsCharacterId, setOnboardingQuestionsCharacterId] = useState<string | null>(null);
  // A greeting or onboarding dialog opens under the add-character picker, so close the picker first.
  useEffect(() => {
    if (pendingAddedCard?.greeting || onboardingQuestionsCharacterId) setShowCharPicker(false);
  }, [pendingAddedCard, onboardingQuestionsCharacterId]);
  const onboardingQuestionsTarget = onboardingQuestionsCharacterId
    ? (onboardingCardQuestionsById.get(onboardingQuestionsCharacterId) ?? null)
    : null;
  // The card can leave the chat while its questions are open; drop the stale id
  // with it so re-adding the card doesn't reopen the window.
  useEffect(() => {
    if (onboardingQuestionsCharacterId && !onboardingQuestionsTarget) setOnboardingQuestionsCharacterId(null);
  }, [onboardingQuestionsCharacterId, onboardingQuestionsTarget]);
  useEffect(() => {
    setOnboardingQuestionsCharacterId(null);
    setPendingAddedCard(null);
  }, [chat.id]);
  // A card added to this chat: wait until the chat itself lists it. That is when
  // `chat` carries both the new roster and the answers the server seeded for the
  // card, so the questions window opens on them (it reads them once, on mount) and
  // the stale-id effect above doesn't close it for a card it can't see yet. The
  // card list is already loaded here (the card was picked from it), so whether it
  // has questions is known without waiting on anything else.
  useEffect(() => {
    if (!pendingAddedCard || !chatCharIds.includes(pendingAddedCard.charId)) return;
    if (onboardingCardQuestionsById.has(pendingAddedCard.charId)) {
      setOnboardingQuestionsCharacterId(pendingAddedCard.charId);
      return;
    }
    if (pendingAddedCard.greeting) setFirstMesConfirm(pendingAddedCard.greeting);
    setPendingAddedCard(null);
  }, [chatCharIds, onboardingCardQuestionsById, pendingAddedCard]);
  // The questions window is done (saved or backed out): the added card's greeting is next.
  const continueAddedCardGreeting = useCallback(
    (charId: string | null) => {
      if (!pendingAddedCard || pendingAddedCard.charId !== charId) return;
      if (pendingAddedCard.greeting) setFirstMesConfirm(pendingAddedCard.greeting);
      setPendingAddedCard(null);
    },
    [pendingAddedCard],
  );
  /**
   * Save the answers from an isolated character-questions window (#7797). The
   * merge is the wizard's own, so untouched questions carry their default value
   * (which restores a deleted one) and every other card's variables stay as they
   * were.
   */
  const handleOnboardingAnswersSaved = useCallback(
    async (_personaId: string | null, cardVariables: Record<string, string>) => {
      if (Object.keys(cardVariables).length > 0) {
        try {
          await updateMeta.mutateAsync({ id: chat.id, macroVariables: cardVariables });
        } catch {
          // Nothing was created here, so a retry is safe: keep the window (and the
          // answers it holds) open instead of discarding the player's edits.
          toast.error(localizeUi("ui.characters.onboarding.cardVariablesFailed"));
          return;
        }
      }
      continueAddedCardGreeting(onboardingQuestionsCharacterId);
      setOnboardingQuestionsCharacterId(null);
    },
    [chat.id, continueAddedCardGreeting, localizeUi, onboardingQuestionsCharacterId, updateMeta],
  );
  const handleOnboardingQuestionsBack = useCallback(() => {
    continueAddedCardGreeting(onboardingQuestionsCharacterId);
    setOnboardingQuestionsCharacterId(null);
  }, [continueAddedCardGreeting, onboardingQuestionsCharacterId]);
  const [scenePromptExpanded, setScenePromptExpanded] = useState(false);
  const [scenePromptDraft, setScenePromptDraft] = useState(metadata.sceneSystemPrompt ?? "");
  const [gameSpecialInstructionsDraft, setGameSpecialInstructionsDraft] = useState(
    (metadata.gameSpecialInstructions as string) ?? "",
  );

  useEffect(() => {
    modePromptDefaultAppliedRef.current = null;
  }, [chat.id]);

  useEffect(() => {
    // A hidden host may only be mounted to render detached tools; that must not change AI settings.
    if (!windowOpen || !shouldApplyModePromptDefault || chat.promptPresetId || !fallbackPromptPreset?.id) return;
    const fallbackKey = `${chat.id}:${fallbackPromptPreset.id}`;
    if (modePromptDefaultAppliedRef.current === fallbackKey) return;
    modePromptDefaultAppliedRef.current = fallbackKey;
    updateChat.mutate({ id: chat.id, promptPresetId: fallbackPromptPreset.id });
  }, [chat.id, chat.promptPresetId, fallbackPromptPreset?.id, windowOpen, shouldApplyModePromptDefault, updateChat]);

  useEffect(() => {
    setGameSpecialInstructionsDraft((metadata.gameSpecialInstructions as string) ?? "");
  }, [chat.id, metadata.gameSpecialInstructions]);

  const handleModePromptPresetChange = useCallback(
    (promptPresetId: string | null) => {
      if (!promptPresetId && fallbackPromptPreset?.id) {
        modePromptDefaultAppliedRef.current = `${chat.id}:${fallbackPromptPreset.id}`;
      }
      setPreset(promptPresetId);
      if (isConversation) {
        updateMeta.mutate({ id: chat.id, customSystemPrompt: null });
      }
      if (isGame) {
        // A preset that carries story settings brings its style and violence, and adds its boundaries.
        const carried = promptPresetId
          ? parseGamePresetStorySettings(
              promptPresetOptions.find((preset) => preset.id === promptPresetId)?.gameStorySettings,
            )
          : null;
        const next = carried
          ? applyGamePresetStorySettings(
              {
                storyStyle: resolveGameStoryStyle(gameSetupConfig),
                violence: null,
                contentBoundaries:
                  typeof gameSetupConfig.contentBoundaries === "string" ? gameSetupConfig.contentBoundaries : "",
              },
              carried,
            )
          : null;
        updateMeta.mutate({
          id: chat.id,
          gameSystemPrompt: null,
          ...(next
            ? {
                gameSetupConfig: {
                  ...gameSetupConfig,
                  storyStyle: next.storyStyle,
                  violence: next.violence ?? undefined,
                  contentBoundaries: next.contentBoundaries || null,
                },
              }
            : {}),
        });
      }
    },
    [
      chat.id,
      fallbackPromptPreset?.id,
      gameSetupConfig,
      isConversation,
      isGame,
      promptPresetOptions,
      setPreset,
      updateMeta,
    ],
  );

  // A mobile dock drop closed the library panel and handed the restore to this drawer, so the user
  // only goes back to the library once the agent setup modal is done with.
  useEffect(() => {
    if (!open) return;
    return () => {
      const panel = takePendingChatResourcePanelRestore();
      if (panel && !useUIStore.getState().rightPanelOpen) useUIStore.getState().openRightPanel(panel);
    };
  }, [open]);

  // "New" starts the builder from this chat's settings, persona and lorebooks (the old "Save as").
  // The builder's open state stays here because the window's ignoreOutsidePointer reads it.
  const [profileBuilder, setProfileBuilder] = useState<ChatPreset | "new" | null>(null);
  useEffect(() => {
    // A modeless editor must not silently retarget another chat's profile.
    setProfileBuilder(null);
  }, [chat.id]);

  const saveName = () => {
    if (nameVal.trim() && nameVal !== chat.name) {
      updateChat.mutate({ id: chat.id, name: nameVal.trim() });
    }
    setEditingName(false);
  };

  const agentRenderers = createAgentSettingsRenderers(chatAgents, {
    chat,
    metadata,
    chatMode,
    isGame,
    activeAgentIds,
    availableAgents,
    agentConfigsByType,
    avatarLayout,
    updateMeta,
    closeForSurface,
    chatGenerationConnectionsList,
    sidecarModelDownloaded,
    requestClose,
    rememberSettingsReturn,
    t,
    localizeUi,
  });
  if (!open) return null;
  // Only the loaded settings add the Chat Settings classes below; themes and select styling target them.
  const windowProps = getChatSettingsWindowProps(anchor);
  const personaSectionProps = {
    updateChat,
    chat,
    chatMode,
    isRoleplayMode,
    characters,
    personas,
    charNameMap,
    getCharacterInfo,
    charName,
    charTitle,
    onboardingPersonaTemplates,
    setOnboardingTemplateId,
    showPersonaPicker,
    setShowPersonaPicker,
    colorPersonaInlineNames,
    toggleInlineResourceEditor,
    renderInlineCardEditor,
  };
  // On purpose: Memory recall has two renders, one for Conversation and one for the other modes, so switching a
  // chat between them mounts a fresh section.
  const memoryRecallSectionProps = {
    chat,
    metadata,
    chatMode,
    isConversation,
    isRoleplayMode,
    isGame,
    initialSection,
    groupChatMode,
    chatCharIds,
    charNameMap,
    memoryView,
    setMemoryView,
    advancedMemoryAvailable,
    advancedMemoryEnabled,
    advancedMemoryNeedsReview,
  };
  const helpLayoutButton =
    showHelpLayout && !chatHelpButtonHidden ? (
      <span data-chat-help="help" className="inline-flex">
        <HelpTooltip
          text={localizeUi("chat.settings.helpLayoutHint")}
          ariaLabel={localizeUi("chat.help.button")}
          side="bottom"
          buttonClassName="h-6 w-6 justify-center max-md:h-9 max-md:w-9"
          onActivate={() => {
            // A phone's sheet covers the chat, so it closes first and Help labels what is under it.
            if (!phoneLayout) requestChatHelp(chatMode);
            else void requestClose().then((closed) => closed && requestChatHelp(chatMode));
          }}
        />
      </span>
    ) : null;

  const resetViewLabel = localizeUi("chat.settings.resetView");
  const trackerPanelLabel = localizeUi("ui.panels.trackerpanelappearancedrawer.trackerPanel");
  const handleResetView = async (button: HTMLButtonElement) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("chat.settings.resetViewConfirm.title"),
      message: localizeUi("chat.settings.resetViewConfirm.message"),
      confirmLabel: localizeUi("chat.settings.resetViewConfirm.confirm"),
      cancelLabel: localizeUi("chat.delete.dialog.cancel"),
    });
    if (confirmed) resetView();
    if (button.isConnected) button.focus({ preventScroll: true });
  };
  // Reset View and the favorite arrangement, then the Tracker Panel dice and window controls.
  const headerControls = (
    <>
      <button
        type="button"
        data-chat-help="reset-view"
        data-chat-settings-control="reset-view"
        aria-label={resetViewLabel}
        title={resetViewLabel}
        className="mari-window__control"
        onClick={(event) => void handleResetView(event.currentTarget)}
      >
        <RotateCcw size="0.8125rem" />
      </button>
      <ChatWindowFavoriteButton
        mode={chatMode}
        hintsDismissed={metadata.chatSettingsHintDismissed === true}
        scopedRegexMode={inheritsScopedRegexMode ? null : scopedRegexMode}
      />
      {trackerPanelToggleAvailable && (
        <button
          type="button"
          data-tracker-panel-toggle="chat-settings"
          data-chat-settings-control="tracker-panel"
          aria-pressed={trackerPanelShown}
          aria-label={trackerPanelLabel}
          title={trackerPanelLabel}
          className="mari-window__control"
          onClick={toggleTrackerPanel}
        >
          <TrackerPanelIcon size="0.9375rem" />
        </button>
      )}
    </>
  );
  const cardThemingControls =
    isRoleplayMode || activeCardsHaveCss ? (
      <div className="mt-2 space-y-2">
        {isRoleplayMode && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.colorCharacterNamesInText")}
            description={localizeUi("ui.chat.chatsettingsdrawer.colorCharacterNamesInTextDescription")}
            checked={colorInlineNames}
            onChange={(checked) => updateMeta.mutate({ id: chat.id, colorInlineNames: checked })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              colorInlineNames
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-[0.6875rem] font-medium"
          />
        )}
        {activeCardsHaveCss && (
          <div className={cn("space-y-2", isRoleplayMode && "mt-2")}>
            <div
              className="flex rounded-lg ring-1 ring-[var(--border)]"
              role="group"
              aria-label={localizeUi("ui.chat.chatsettingsdrawer.cardTheming")}
            >
              <button
                onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "disabled" })}
                aria-pressed={cardCssMode === "disabled"}
                className={cn(
                  "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-l-lg",
                  cardCssMode === "disabled"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {localizeUi("ui.agents.agenteditor.disabled")}
              </button>
              <button
                onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "exclusive" })}
                aria-pressed={cardCssMode === "exclusive"}
                className={cn(
                  "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                  cardCssMode === "exclusive"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {localizeUi("ui.chat.chatsettingsdrawer.exclusive")}
              </button>
              <button
                onClick={() => updateMeta.mutate({ id: chat.id, cardCssMode: "chat" })}
                aria-pressed={cardCssMode === "chat"}
                className={cn(
                  "flex-1 px-3 py-2 text-[0.6875rem] font-medium transition-colors rounded-r-lg",
                  cardCssMode === "chat"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {localizeUi("ui.chat.chatsettingsdrawer.chat")}
              </button>
            </div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {cardCssMode === "disabled"
                ? localizeUi("ui.chat.chatsettingsdrawer.cardCssIsOffNoCharacterStylingIsApplied")
                : cardCssMode === "exclusive"
                  ? localizeUi("ui.chat.chatsettingsdrawer.eachCharacterSCssOnlyAffectsTheirOwnMessages")
                  : localizeUi("ui.chat.chatsettingsdrawer.allCardCssAffectsTheEntireChatAreaIncluding")}
            </p>
          </div>
        )}
      </div>
    ) : null;
  const charactersSectionProps = {
    chat,
    chatMode,
    isConversation,
    characters,
    chatCharIds,
    chatCharacterCount,
    activeCharacterIds,
    inactiveCharacterIds,
    supportsCharacterActivityToggle,
    autoActiveCharactersMode,
    autoActiveCharacterPins,
    cardThemingControls,
    hostedRoom,
    changeRoomCharacters,
    roomRosterPending: roomRoster.isPending,
    // The drawer's own, so the picker shows busy while an add or remove it started is saving.
    updateChat,
    getCharacterInfo,
    charName,
    charTitle,
    onboardingByCharacterId,
    onboardingCardQuestionsById,
    setOnboardingQuestionsCharacterId,
    rememberSettingsReturn,
    requestClose,
    showCharPicker,
    setShowCharPicker,
    toggleCharacter,
    toggleChangedCharacter,
    toggleInlineResourceEditor,
    renderInlineCardEditor,
  };
  const gamePartySectionProps = {
    // Game party takes Persona's place, since a Game chat shows no Persona section.
    chat,
    characters,
    personas,
    chatCharIds,
    chatCharacterCount,
    activeCardsHaveCss,
    cardThemingControls,
    roomRosterPending: roomRoster.isPending,
    // The drawer's own, so the picker shows busy while an add or remove it started is saving.
    updateChat,
    getCharacterInfo,
    charName,
    charTitle,
    rememberSettingsReturn,
    requestClose,
    showCharPicker,
    setShowCharPicker,
    showPersonaPicker,
    setShowPersonaPicker,
    toggleCharacter,
    toggleChangedCharacter,
    toggleInlineResourceEditor,
    renderInlineCardEditor,
  };

  return (
    <>
      <FloatingWindow
        id={CHAT_SETTINGS_WINDOW_ID}
        hidden={!windowOpen}
        // Sections pop out into windows that look like this one.
        drawerHost={{ title: localizeUi("chat.toolbar.settings"), scrollClassName: DRAWER_WINDOW_SCROLL_AREA }}
        presentation={phoneLayout ? "sheet" : "window"}
        title={localizeUi("chat.toolbar.settings")}
        titleIcon={<Settings2 size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />}
        titleAccessory={helpLayoutButton}
        headerControls={headerControls}
        closeLabel={localizeUi("ui.chat.chatsettingsdrawer.closeChatSettings")}
        {...windowProps}
        // Sidebar presses belong to the modeless profile editor while it is open.
        ignoreOutsidePointer={(target) => profileBuilder !== null || windowProps.ignoreOutsidePointer(target)}
        // A window the user has not moved opens beside a right-side Tracker Panel, not over it.
        defaultLayoutKey={`${trackerPanelSide}:${trackerPanelClearance}`}
        className={cn(windowProps.className, "mari-chat-settings-popover mari-chat-settings-drawer")}
        bodyRef={panelRef}
        onRequestClose={() => requestClose()}
      >
        {/* Desktop-only: drag-and-drop hint (sidebar drag is disabled on mobile overlays) */}
        {metadata.chatSettingsHintDismissed !== true && (
          <div
            data-chat-settings-top-row
            className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] px-4 py-2 text-[0.6875rem] leading-snug text-[var(--muted-foreground)] max-md:hidden"
          >
            <Info size="0.8125rem" className="mt-px shrink-0" />
            {/* The slash-joined list has no spaces, so let it wrap in a narrow window. */}
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {localizeUi("chat.settings.dragDropHint")} {localizeUi("chat.settings.moveResizeHint")}{" "}
              {localizeUi("chat.settings.dragOutHint")}
              {modeSettingsSurfaces.showSettingsProfiles && <> {localizeUi("chat.settings.profilesHint")}</>}{" "}
              {localizeUi("chat.settings.favoriteLayout.hint")}
            </span>
            <button
              type="button"
              onClick={() => updateMeta.mutate({ id: chat.id, chatSettingsHintDismissed: true })}
              disabled={updateMeta.isPending}
              aria-label={localizeUi("chat.settings.dismissHints")}
              title={localizeUi("chat.settings.dismissHints")}
              className="shrink-0 rounded p-1.5 hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
            >
              <X size="0.875rem" aria-hidden="true" />
            </button>
          </div>
        )}

        <ChatButtonLayoutSettings />

        <div
          className={cn(
            NEUTRAL_PANEL_SCROLL_AREA,
            "@container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(1rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))]",
          )}
        >
          {/* Settings profile bar — hidden in Game Mode. Scene chats keep it, but scene instructions stay chat-owned. */}
          {modeSettingsSurfaces.showSettingsProfiles && (
            <SettingsProfilesSection
              chat={chat}
              chatMode={chatMode}
              isRoleplayMode={isRoleplayMode}
              metadata={metadata}
              activeLorebookIds={activeLorebookIds}
              profileBuilder={profileBuilder}
              setProfileBuilder={setProfileBuilder}
            />
          )}

          {chatTools && !isGame && (
            <Section
              id={`${chatMode}-message-search`}
              label={localizeUi("chat.toolbar.searchMessages")}
              icon={<Search size="0.875rem" />}
              help={localizeUi("chat.settings.searchMessagesHelp")}
              forceOpen={initialSection === "message-search"}
              contentClassName="pt-0"
            >
              <div data-chat-settings-search>
                <ChatMessageSearch chatId={chat.id} />
              </div>
            </Section>
          )}

          <div ref={setControlDockHost} data-chat-control-dock />

          {metadata.multiplayer && (
            <MultiplayerPlayersSection
              chatId={chat.id}
              forceOpen={initialSection === "multiplayer"}
              gameStart={multiplayerGameStart}
            />
          )}

          <ChatNameSection
            chatId={chat.id}
            chatName={chat.name}
            editingName={editingName}
            nameValue={nameVal}
            onBeginEdit={() => {
              setNameVal(chat.name);
              setEditingName(true);
            }}
            onNameValueChange={setNameVal}
            onSaveName={saveName}
          />

          {chatTools && (
            <Section
              id={`${chatMode}-chat-branches`}
              label={localizeUi("chat.settings.branches")}
              icon={<GitBranch size="0.875rem" />}
              count={branchCount}
              help={localizeUi("chat.settings.branchesHelp")}
            >
              <ChatBranchesPanel
                activeChatId={chat.id}
                activeChatName={chat.name}
                groupId={chat.groupId ?? null}
                allowRangeExport={!isGame}
              />
            </Section>
          )}

          <ConnectionSection
            chatId={chat.id}
            connectionId={chat.connectionId ?? null}
            connections={chatGenerationConnectionsList}
            contextBudget={gameContextBudget}
            isGame={isGame}
            onConnectionChange={setConnection}
          />

          {/* Roleplay prompt preset */}
          {modeSettingsSurfaces.promptSettingsSurface === "roleplay" && (
            <PromptPresetSection
              promptPresetId={chat.promptPresetId ?? null}
              presets={promptPresetOptions}
              hasVariables={currentPromptPresetHasVariables}
              quickEditor={
                chat.promptPresetId ? (
                  <Suspense
                    fallback={
                      <div className="mari-editor-empty flex min-h-24 items-center justify-center px-3 py-6 text-xs">
                        {t("chat.settings.promptPreset.quickEdit.loading")}
                      </div>
                    }
                  >
                    <QuickPresetSectionsEditor
                      presetId={chat.promptPresetId}
                      parentChatHasLorebook={activeLorebooks.length > 0}
                      onEditableCopyCreated={assignEditablePresetCopy}
                    />
                  </Suspense>
                ) : null
              }
              showLorebookMarkerWarning={showLorebookMarkerWarning}
              onEditVariables={() => {
                if (chat.promptPresetId) setChoiceModalPresetId(chat.promptPresetId);
              }}
              onPromptPresetChange={setPreset}
            />
          )}

          {/* Conversation/Game prompt preset */}
          {modeSettingsSurfaces.promptSettingsSurface === "conversation" && (
            <ConversationPromptSection
              chatId={chat.id}
              customPrompt={(metadata.customSystemPrompt as string) ?? ""}
              promptPresetId={effectiveModePromptPresetId}
              promptPresets={promptPresetOptions}
              selectedPresetPrompt={selectedModePromptPreset?.conversationPrompt ?? ""}
              onCustomPromptChange={(id, customSystemPrompt) => updateMeta.mutate({ id, customSystemPrompt })}
              onPromptPresetChange={handleModePromptPresetChange}
            />
          )}

          {modeSettingsSurfaces.promptSettingsSurface === "game" && (
            <GameExtraPromptSection
              storedValue={(metadata.gameSystemPrompt as string) ?? ""}
              specialInstructionsValue={gameSpecialInstructionsDraft}
              promptPresetId={effectiveModePromptPresetId}
              promptPresets={promptPresetOptions}
              selectedPresetPrompt={selectedModePromptPreset?.gamePrompt ?? ""}
              gmPromptTemplateId={selectedGameGmPromptTemplateId}
              gmPromptTemplates={GAME_GM_BUILT_IN_PROMPT_TEMPLATES}
              onCommit={(gameSystemPrompt) => updateMeta.mutate({ id: chat.id, gameSystemPrompt })}
              onSpecialInstructionsCommit={(gameSpecialInstructions) =>
                updateMeta.mutate({ id: chat.id, gameSpecialInstructions })
              }
              onSpecialInstructionsChange={setGameSpecialInstructionsDraft}
              onPromptPresetChange={handleModePromptPresetChange}
              onGmPromptTemplateChange={updateGameGmPromptTemplateSelection}
              rating={gameSetupConfig.rating === "nsfw" ? "nsfw" : "sfw"}
              ratingGuidelinesValue={
                typeof gameSetupConfig.ratingGuidelines === "string" ? gameSetupConfig.ratingGuidelines : ""
              }
              onRatingGuidelinesCommit={(ratingGuidelines) =>
                updateMeta.mutate({ id: chat.id, gameSetupConfig: { ...gameSetupConfig, ratingGuidelines } })
              }
              storySettings={{
                storyStyle: resolveGameStoryStyle(gameSetupConfig),
                violence: resolveGameViolenceLevel(gameSetupConfig),
                contentBoundaries:
                  typeof gameSetupConfig.contentBoundaries === "string" ? gameSetupConfig.contentBoundaries : "",
              }}
              onStorySettingsCommit={(patch) =>
                updateMeta.mutate({
                  id: chat.id,
                  gameSetupConfig: {
                    ...gameSetupConfig,
                    ...patch,
                    ...(patch.contentBoundaries !== undefined
                      ? { contentBoundaries: patch.contentBoundaries || null }
                      : {}),
                  },
                })
              }
            />
          )}

          {/* Advanced Parameters */}
          <AdvancedParametersSection
            forceOpen={initialSection === "advanced-parameters"}
            metadata={metadata}
            isConversation={isConversation}
            connectionId={chat.connectionId ?? null}
            connections={chatGenerationConnectionsList}
            contextMessageLimit={metadata.contextMessageLimit as number | null | undefined}
            advancedMemoryManagesHistory={advancedMemoryEnabled}
            excludePastReasoning={metadata.excludePastReasoning as boolean | undefined}
            imageCaptioningEnabled={metadata.imageCaptioningEnabled as boolean | undefined}
            imageCaptioningConnectionId={
              Object.prototype.hasOwnProperty.call(metadata, "imageCaptioningConnectionId")
                ? typeof metadata.imageCaptioningConnectionId === "string"
                  ? metadata.imageCaptioningConnectionId
                  : null
                : undefined
            }
            onChatParametersChange={(chatParameters) => updateMeta.mutate({ id: chat.id, chatParameters })}
            onContextMessageLimitChange={(contextMessageLimit) =>
              updateMeta.mutate({ id: chat.id, contextMessageLimit })
            }
            onExcludePastReasoningChange={(excludePastReasoning) =>
              updateMeta.mutate({ id: chat.id, excludePastReasoning })
            }
            onPastReasoningLimitChange={(pastReasoningLimit) => updateMeta.mutate({ id: chat.id, pastReasoningLimit })}
            onImageCaptioningChange={(patch) => updateMeta.mutate({ id: chat.id, ...patch })}
          />

          {/* Party (game mode) */}
          {isGame && <GamePartySection {...gamePartySectionProps} />}

          {/* Persona */}
          {!isGame && <PersonaSection {...personaSectionProps} />}

          {/* Characters — only show added ones + add button */}
          {!isGame && <CharactersSection {...charactersSectionProps} />}

          {/* Ruleset — a Roleplay chat played by a Game Mode ruleset */}
          {isRoleplayMode && !metadata.multiplayer && (
            <Section
              id="roleplay-ruleset"
              label={localizeUi("chat.settings.ruleset.label")}
              icon={<Dices size="0.875rem" />}
              help={localizeUi("chat.settings.ruleset.help")}
            >
              <RoleplayRulesetSettings chatId={chat.id} metadata={metadata} />
            </Section>
          )}

          {/* Card field alternatives — hidden when no card in this chat has any */}
          <CardFieldAlternativesSection chat={chat} characters={characters} personas={personas} />

          {/* Every existing and new multi-character chat gets this section. Missing mode metadata means Grouped. */}
          <GroupChatSection
            sectionId={`${chatMode}-group-chat`}
            visible={chatCharIds.length > 1 && modeSettingsSurfaces.showGroupChatControls}
            chat={chat}
            metadata={metadata}
            isConversation={isConversation}
            isRoleplayMode={isRoleplayMode}
            groupChatMode={groupChatMode}
            autoActiveCharactersMode={autoActiveCharactersMode}
            activeManualTrackerTypes={activeManualTrackerTypes}
            activeAgentIds={activeAgentIds}
          />

          {/* Scoped Regex Scripts — only shown when a chat character has scoped scripts */}
          <ScopedRegexSection
            sectionId={`${chatMode}-scoped-regex`}
            chat={chat}
            chatCharIds={chatCharIds}
            scopedRegexMode={scopedRegexMode}
            inheritsScopedRegexMode={inheritsScopedRegexMode}
            presetScopedRegexMode={presetScopedRegexMode}
          />

          <ChatVariablesSection
            key={chat.id}
            sectionId={`${chatMode}-chat-variables`}
            chatId={chat.id}
            variables={chatMacroVariables}
          />

          <ConnectedChatsSection
            chat={chat}
            metadata={metadata}
            chatMode={chatMode}
            allChats={allChats as Chat[] | undefined}
            noodleInstalled={isCapabilityPackageAvailable(installedCapabilities, "noodle")}
            slurp2Installed={isCapabilityPackageAvailable(installedCapabilities, "slurp2")}
          />

          {/* Notes from Conversation — durable notes saved by the connected conversation's character */}
          {!isConversation && chat.connectedChatId && <ConversationNotesSection chatId={chat.id} />}

          <LorebooksSection
            forceOpen={initialSection === "lorebooks"}
            chatId={chat.id}
            metadata={metadata}
            activeLorebookIds={activeLorebookIds}
            excludedLorebookIds={excludedLorebookIds}
            activeLorebooks={activeLorebooks}
            lorebooks={(lorebooks ?? []) as Lorebook[]}
            onEditLorebook={(lorebookId) => toggleInlineResourceEditor("lorebook", lorebookId)}
            editingLorebookId={inlineResourceEditor?.kind === "lorebook" ? inlineResourceEditor.id : null}
            inlineLorebookEditor={
              inlineResourceEditor?.kind === "lorebook" ? (
                <Suspense
                  fallback={
                    <div className="mari-chat-settings-inline-editor mt-2 space-y-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5">
                      <div className="shimmer h-8 rounded-lg" />
                      <div className="shimmer h-9 rounded-lg" />
                      <div className="shimmer h-9 rounded-lg" />
                    </div>
                  }
                >
                  <InlineLorebookEntriesEditor
                    key={inlineResourceEditor.id}
                    chatId={chat.id}
                    entryStateOverrides={metadata.entryStateOverrides}
                    lorebookId={inlineResourceEditor.id}
                    lorebookName={
                      activeLorebooks.find((lorebook) => lorebook.id === inlineResourceEditor.id)?.name ?? "Lorebook"
                    }
                    characterRows={characters}
                    onClose={() => setInlineResourceEditor(null)}
                  />
                </Suspense>
              ) : null
            }
          />

          {chatTools?.summary && (
            <Section
              id={`${chatMode}-chat-summary`}
              label={localizeUi("chat.settings.summary")}
              icon={<ScrollText size="0.875rem" />}
              count={enabledSummaryCount}
              help={localizeUi("chat.settings.summaryHelp")}
              forceOpen={initialSection === "summary"}
            >
              {chatTools.summary}
            </Section>
          )}

          {chatTools && (
            <Section
              id={`${chatMode}-active-context`}
              label={localizeUi("chat.settings.activeContext")}
              icon={<ScanText size="0.875rem" />}
              help={localizeUi("chat.settings.activeContextHelp")}
              forceOpen={initialSection === "active-context"}
            >
              {chatTools.activeContext ?? (
                <Suspense fallback={<ChatToolLoading />}>
                  <ActiveLorebookEntriesContent chatId={chat.id} />
                </Suspense>
              )}
            </Section>
          )}

          {/* Conversation feature packages expose commands and settings as soon as they are installed. */}
          {modeSettingsSurfaces.agentSettingsSurface === "conversation" && (
            <ConversationAgentsSection
              agents={chatAgents}
              chat={chat}
              metadata={metadata}
              activeAgentIds={activeAgentIds}
              textConnectionsList={textConnectionsList}
              requestClose={requestClose}
              rememberSettingsReturn={rememberSettingsReturn}
              renderers={agentRenderers}
            />
          )}

          {/* Agents */}
          {modeSettingsSurfaces.agentSettingsSurface === "generation" &&
            (isGame ? (
              <GameAgentsSection
                agents={chatAgents}
                renderers={agentRenderers}
                chat={chat}
                metadata={metadata}
                chatMode={chatMode}
                activeAgentIds={activeAgentIds}
                availableAgents={availableAgents}
                closeForSurface={closeForSurface}
                gameLorebookKeeperEnabled={gameLorebookKeeperEnabled}
                gameSetupConfig={gameSetupConfig}
                lorebooks={lorebooks}
                updateMeta={updateMeta}
                connections={connections}
                initialAgentId={initialAgentId}
                requestClose={requestClose}
                rememberSettingsReturn={rememberSettingsReturn}
                setShowAgentSuiteModal={setShowAgentSuiteModal}
              />
            ) : (
              <RoleplayAgentsSection
                agents={chatAgents}
                renderers={agentRenderers}
                chat={chat}
                metadata={metadata}
                chatMode={chatMode}
                activeAgentIds={activeAgentIds}
                availableAgents={availableAgents}
                activeTrackerAgents={activeTrackerAgents}
                chatCharacters={chatCharacters}
                charName={charName}
                charTitle={charTitle}
                closeForSurface={closeForSurface}
                lorebooks={lorebooks}
                spriteCharacterIds={spriteCharacterIds}
                updateMeta={updateMeta}
                onSpriteVisualSettingsChange={onSpriteVisualSettingsChange}
                connections={connections}
                activeManualTrackerTypes={activeManualTrackerTypes}
                getCharacterInfo={getCharacterInfo}
                initialAgentId={initialAgentId}
                spriteArrangeMode={spriteArrangeMode}
                onToggleSpriteArrange={onToggleSpriteArrange}
                setShowAgentSuiteModal={setShowAgentSuiteModal}
              />
            ))}

          {/* Agent activity: its own section right below Agents, while agents or Advanced Memory run. */}
          {chatTools &&
            isRoleplayMode &&
            (metadata.enableAgents === true || metadata.advancedMemory?.enabled === true) && (
              <Section
                id={`${chatMode}-agent-activity`}
                label={localizeUi("chat.settings.agentActivity")}
                icon={withAgentActivityStatus(chat.id, <Activity size="0.875rem" />)}
                help={localizeUi("chat.settings.agentActivityHelp")}
              >
                <AgentActivitySection
                  chatId={chat.id}
                  className="overflow-hidden rounded-lg border border-[var(--border)]"
                />
              </Section>
            )}

          {chatTools?.authorNotes && (
            <Section
              id={`${chatMode}-author-notes`}
              label={localizeUi("chat.settings.authorNotes")}
              icon={<PenLine size="0.875rem" />}
              help={localizeUi("chat.settings.authorNotesHelp")}
              fill
            >
              {chatTools.authorNotes}
            </Section>
          )}

          {(isRoleplayMode || isGame) && (
            <Section
              id={`${chatMode}-background`}
              label={localizeUi("chat.settings.background")}
              icon={<Wallpaper size="0.875rem" />}
              help={localizeUi("chat.settings.backgroundHelp")}
            >
              <ActiveChatBackgroundPicker game={isGame} />
              {isRoleplayMode && <LocationBackgroundPins chatId={chat.id} metadata={chat.metadata} />}
            </Section>
          )}

          {chatTools && (
            <Section
              id={`${chatMode}-gallery`}
              label={localizeUi("chat.settings.gallery")}
              icon={<Images size="0.875rem" />}
              help={localizeUi("chat.settings.galleryHelp")}
              contentClassName="pt-2"
            >
              <Suspense fallback={<ChatToolLoading />}>
                <ChatGalleryPanel chat={chat} />
              </Suspense>
            </Section>
          )}

          {/* Combat Style — game mode only */}
          {isGame && (
            <CombatStyleSection
              combatStyle={effectiveCombatStyle}
              rulesetResolvesFights={rulesetResolvesFights}
              rulesetHasPositions={rulesetHasPositions}
              allowedStyles={allowedCombatStyles}
              onCombatStyleChange={(gameCombatStyle) => updateMeta.mutate({ id: chat.id, gameCombatStyle })}
              turnOrder={effectiveTurnOrder}
              onTurnOrderChange={(gameTacticalTurnOrder) => updateMeta.mutate({ id: chat.id, gameTacticalTurnOrder })}
            />
          )}

          {isGame && <GameWidgetsSection chat={chat} metadata={metadata} />}

          {!isConversation && !isGame && (
            <ImpersonateSection presets={(presets ?? []) as Array<{ id: string; name: string }>} />
          )}

          {/* Memory Recall — Conversation */}
          {isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
            <MemoryRecallSection {...memoryRecallSectionProps} />
          )}

          {/* Memory Recall — Roleplay and Game */}
          {!isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
            <MemoryRecallSection {...memoryRecallSectionProps} />
          )}

          <FunctionCallingSection
            chatConnectionId={chat.connectionId}
            isGameMode={isGame}
            isConversation={isConversation}
            narratorProvider={
              (
                chatGenerationConnectionsList as Array<{
                  id: string;
                  provider?: string;
                  isDefault?: boolean | string;
                }>
              ).find((connection) =>
                chat.connectionId ? connection.id === chat.connectionId : isConnectionFlagTrue(connection.isDefault),
              )?.provider
            }
            connections={textConnectionsList}
            toolConnectionId={(metadata.gameGmToolConnectionId as string) ?? ""}
            onToolConnectionChange={(gameGmToolConnectionId) =>
              updateMeta.mutate({ id: chat.id, gameGmToolConnectionId })
            }
            gameLorebookSearch={metadata.gameLorebookSearch === true}
            onGameLorebookSearchChange={(gameLorebookSearch) => updateMeta.mutate({ id: chat.id, gameLorebookSearch })}
            gameDiceOutcomeNarration={metadata.gameDiceOutcomeNarration !== false}
            onGameDiceOutcomeNarrationChange={(gameDiceOutcomeNarration) =>
              updateMeta.mutate({ id: chat.id, gameDiceOutcomeNarration })
            }
            gameOneRequestDice={metadata.gameOneRequestDice !== false}
            onGameOneRequestDiceChange={(gameOneRequestDice) => updateMeta.mutate({ id: chat.id, gameOneRequestDice })}
            gameDicePoolMode={metadata.gameDicePoolMode === true}
            onGameDicePoolModeChange={(gameDicePoolMode) => updateMeta.mutate({ id: chat.id, gameDicePoolMode })}
            gameDicePoolWindow={
              typeof metadata.gameDicePoolWindow === "number" ? metadata.gameDicePoolWindow : DEFAULT_DICE_POOL_WINDOW
            }
            onGameDicePoolWindowChange={(gameDicePoolWindow) => updateMeta.mutate({ id: chat.id, gameDicePoolWindow })}
            gameDicePoolAgeTurns={
              typeof metadata.gameDicePoolAgeTurns === "number"
                ? metadata.gameDicePoolAgeTurns
                : DEFAULT_DICE_POOL_AGE_TURNS
            }
            onGameDicePoolAgeTurnsChange={(gameDicePoolAgeTurns) =>
              updateMeta.mutate({ id: chat.id, gameDicePoolAgeTurns })
            }
            enableTools={metadata.enableTools as boolean | undefined}
            forceToolCall={metadata.forceToolCall as boolean | undefined}
            activeToolIds={activeToolIds}
            onEnableToolsChange={(enableTools) => updateMeta.mutate({ id: chat.id, enableTools })}
            onForceToolCallChange={(forceToolCall) => updateMeta.mutate({ id: chat.id, forceToolCall })}
            onActiveToolIdsChange={(next) => updateMeta.mutate({ id: chat.id, activeToolIds: next })}
            onCreateCustomTool={handleCreateCustomTool}
          />

          <TranslationSection
            chatId={chat.id}
            metadata={metadata}
            onMetadataChange={(patch) => updateTranslationMeta.mutate({ id: chat.id, ...patch })}
          />

          {/* Scene System Prompt — shown only for scene-created chats */}
          {metadata.sceneSystemPrompt && (
            <SceneInstructionsSection
              expanded={scenePromptExpanded}
              storedValue={metadata.sceneSystemPrompt as string}
              value={scenePromptDraft}
              onCommit={(sceneSystemPrompt) => updateMeta.mutate({ id: chat.id, sceneSystemPrompt })}
              onExpandedChange={setScenePromptExpanded}
              onValueChange={setScenePromptDraft}
            />
          )}

          {/* Autonomous Messaging — conversation mode only */}
          {isConversation && (
            <AutonomousMessagingSection
              chat={chat}
              metadata={metadata}
              chatCharIds={chatCharIds}
              charNameMap={charNameMap}
              open={open}
              initialSection={initialSection}
              isConversation={isConversation}
              onOpenScheduleEditor={onOpenScheduleEditor}
            />
          )}

          {/* Automatic Summarization — conversation mode only. Opens a modal to edit per-day and per-week summaries. */}
          {isConversation && (
            <AutomaticSummarizationSection
              chat={chat}
              metadata={metadata}
              setShowSummariesModal={setShowSummariesModal}
            />
          )}
        </div>
      </FloatingWindow>

      {/* Choice selection modal for preset variables */}
      <ChoiceSelectionModal
        open={isRoleplayMode && !!choiceModalPresetId}
        onClose={() => setChoiceModalPresetId(null)}
        presetId={choiceModalPresetId}
        chatId={chat.id}
        existingChoices={metadata.presetChoices ?? {}}
        chatFloatingPanel
      />

      {/* Create a persona from a card's onboarding questions (#7796). Persona
          questions only: `cards` is empty on purpose, so opening this window in a
          running chat can never replace character-question answers with defaults. */}
      {onboardingTemplate && (
        <CharacterOnboardingModal
          // Re-keyed by the template so switching cards starts from fresh answers.
          key={onboardingTemplate.character.id}
          open
          cards={[]}
          participantNames={[onboardingTemplate.cardOnboarding.name || charName(onboardingTemplate.character)]}
          persona={{
            characterName: onboardingTemplate.cardOnboarding.name || charName(onboardingTemplate.character),
            onboarding: onboardingTemplate.cardOnboarding.onboarding,
          }}
          withPersona
          chatFloatingPanel
          onBack={() => setOnboardingTemplateId(null)}
          onCreated={handleOnboardingPersonaCreated}
        />
      )}

      {/* Re-answer ONE card's character questions from the Characters list
          (#7797). Isolated on purpose: the window asks only this card, so it can
          never overwrite another card's answers. */}
      {onboardingQuestionsTarget && (
        <CharacterOnboardingModal
          key={onboardingQuestionsTarget.character.id}
          open
          cards={[
            {
              characterId: onboardingQuestionsTarget.character.id,
              name: onboardingQuestionsTarget.cardOnboarding.name || charName(onboardingQuestionsTarget.character),
              onboarding: onboardingQuestionsTarget.cardOnboarding.onboarding,
              cardFields: onboardingQuestionsTarget.cardOnboarding.cardFields,
            },
          ]}
          participantNames={[
            onboardingQuestionsTarget.cardOnboarding.name || charName(onboardingQuestionsTarget.character),
          ]}
          // The answers this chat already holds, so the window opens on them: an
          // untouched question keeps its value instead of being reset to its first
          // option by the save.
          initialAnswers={chatMacroVariables}
          withPersona={false}
          chatFloatingPanel
          onBack={handleOnboardingQuestionsBack}
          onCreated={handleOnboardingAnswersSaved}
        />
      )}

      {/* Automatic summarization editor */}
      <SummariesEditorModal chat={chat} open={showSummariesModal} onClose={() => setShowSummariesModal(false)} />

      {/* Agent Suite — stored agent data viewer/editor */}
      <AgentSuiteModal
        chat={chat}
        open={showAgentSuiteModal}
        onClose={() => setShowAgentSuiteModal(false)}
        onCloseGuardChange={handleAgentSuiteCloseGuardChange}
        agents={agentSuiteAgents}
      />

      {/* Memory recall chunk viewer */}
      <MemoryRecallMemoriesModal
        chatId={chat.id}
        open={memoryView === "standard"}
        onClose={() => setMemoryView(null)}
        chatFloatingPanel
      />

      <AgentAddModal agents={chatAgents} />

      {/* First message confirmation dialog */}
      {firstMesConfirm && (
        <div
          data-chat-floating-panel
          data-component="ChatSettingsDrawer.GreetingDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-settings-greeting-title"
          aria-describedby="chat-settings-greeting-description"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 max-md:pt-[env(safe-area-inset-top)]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFirstMesConfirm(null);
          }}
        >
          <div
            ref={greetingDialogRef}
            tabIndex={-1}
            className="mari-chrome-token-scope relative mx-4 flex w-full max-w-sm flex-col rounded-xl bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl ring-1 ring-[var(--marinara-chat-chrome-panel-border)]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              data-component="ChatSettingsDrawer.GreetingDialogHeader"
              className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3"
            >
              <span id="chat-settings-greeting-title" className="mari-chrome-text-strong text-sm font-semibold">
                {localizeUi("ui.chat.chatsettingsdrawer.chooseGreeting")}
              </span>
            </div>
            <div className="min-h-0 px-4 py-3">
              <p id="chat-settings-greeting-description" className="mari-chrome-text text-xs leading-relaxed">
                {localizeUi("ui.chat.chatsettingsdrawer.chooseGreetingForValue1", {
                  value1: firstMesConfirm.charName,
                })}
              </p>
              <div className="mt-3 max-h-[min(50dvh,22rem)] space-y-2 overflow-y-auto pr-1">
                {firstMesConfirm.greetings.map((greeting, index) => {
                  const selected = index === firstMesConfirm.selectedIndex;
                  const greetingCard = characters.find((c) => c.id === firstMesConfirm.charId);
                  // Resolved before the cut, so the cut can't split a {{tag}}.
                  const preview = greetingCard
                    ? resolveGreetingPreview(greeting.text, {
                        character: greetingCard,
                        chat,
                        characters,
                        personas,
                        chatVariables: chatMacroVariables,
                      })
                    : {
                        text: greeting.text.slice(0, 500),
                        cut: greeting.text.length > 500,
                      };
                  return (
                    <button
                      key={`${greeting.alternateIndex ?? "first"}:${greeting.text.slice(0, 32)}`}
                      type="button"
                      onClick={() =>
                        setFirstMesConfirm((current) => (current ? { ...current, selectedIndex: index } : current))
                      }
                      aria-pressed={selected}
                      className={cn(
                        "mari-chat-option-field w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected && "mari-chat-option-field--active",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="mari-chrome-text-strong text-[0.6875rem] font-semibold">
                          {greeting.alternateIndex === null
                            ? localizeUi("ui.characters.dialoguetab.firstMessage")
                            : localizeUi("ui.characters.dialoguetab.alternateGreetingValue1", {
                                value1: greeting.alternateIndex,
                              })}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                              : "border-[var(--marinara-chat-chrome-button-border)] text-transparent",
                          )}
                        >
                          {selected && <Check size="0.625rem" />}
                        </span>
                      </span>
                      <RoleplayMessagePreview
                        content={
                          preview.cut
                            ? localizeUi("ui.chat.chatsettingsdrawer.value1_30f5501", { value1: preview.text })
                            : preview.text
                        }
                        dialogueColor={firstMesConfirm.dialogueColor}
                        className="mt-1 text-[0.6875rem] leading-relaxed"
                        selfCharacterId={firstMesConfirm.charId}
                        answerValues={greetingAnswerValues}
                        answerTemplate={greeting.text}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
              <button
                type="button"
                onClick={() => setFirstMesConfirm(null)}
                disabled={createMessage.isPending}
                className="mari-chrome-control mari-chrome-control--small text-xs"
              >
                {localizeUi("onboarding.actions.skip")}
              </button>
              <button
                type="button"
                onClick={handleFirstMesConfirm}
                disabled={createMessage.isPending}
                className="mari-chrome-control mari-chrome-control--small mari-chrome-control--selected text-xs"
              >
                {createMessage.isPending
                  ? localizeUi("ui.chat.chatsettingsdrawer.adding")
                  : localizeUi("ui.chat.chatsettingsdrawer.addSelectedGreeting")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChatToolLoading() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-[var(--muted-foreground)]">
      <Spinner size="sm" />
      {localizeUi("chat.settings.toolLoading")}
    </div>
  );
}
