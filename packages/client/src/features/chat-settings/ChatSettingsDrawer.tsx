import { ChatButtonLayoutSettings } from "./ChatButtonLayoutSettings";
// ──────────────────────────────────────────────
// Chat: Settings Drawer — per-chat configuration
// ──────────────────────────────────────────────
import { createPortal } from "react-dom";
import { useChatSettingsReflow } from "../../hooks/use-chat-settings-reflow";
import {
  lazy,
  Suspense,
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { toast } from "sonner";
import { RoleplayCommandsSettings } from "./agents/RoleplayCommandsSettings";
import { ChatBranchesPanel } from "./ChatBranchesPanel";
import { ChatMessageSearch } from "./ChatMessageSearch";
import { ChatWindowFavoriteButton } from "./ChatWindowFavoriteButton";
import { listCombatStyles, resolveCombatStyle } from "../../components/game/combat-styles";
import { AgentActivitySection } from "../../components/agents/AgentActivitySection";
import { withAgentActivityStatus } from "../../components/agents/AgentActivityIcon";
import {
  X,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Image,
  AlertTriangle,
  Camera,
  RefreshCw,
  RotateCcw,
  Settings2,
  Info,
  Archive,
  Feather,
  Paintbrush,
  Activity,
  Puzzle,
  Radar,
  FolderOpen,
  Music2,
  Loader2,
  Wrench,
  Map as MapIcon,
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
import {
  NEUTRAL_PANEL_SCROLL_AREA,
  SHEET_BUTTON_PRIMARY,
  SHEET_BUTTON_QUIET,
} from "../../components/ui/neutral-surface-styles";
import { FloatingWindow } from "../../components/ui/FloatingWindow";
import { TrackerPanelIcon } from "../../components/ui/TrackerPanelIcon";
import { type ChatToolbarFloatingPanelAnchor } from "../../components/chat/ChatToolbarControls";
import { changedId } from "../../components/characters/CharacterSelect";
import { PictureCheckFields } from "./PictureCheckFields";
import { ChatSettingsDeferBodiesContext, ChatSettingsSection as Section } from "./ChatSettingsSection";
import { registerChatSettingsCloser } from "../../lib/chat-settings-close";
import { useMobileChatSettingsNav } from "./mobile-nav";
import {
  requestCloseChatSettingsSubpage,
  takeChatSettingsSubpageOpener,
  useChatSettingsSubpage,
  type ChatSettingsSubpageId,
} from "./subpage";
import {
  MobileChatSettingsGroup,
  MobileChatSettingsHeaderBack,
  MobileChatSettingsPageHelp,
  MobileChatSettingsQuick,
  useMobileChatSettingsHeaderTitle,
} from "./MobileChatSettingsNav";
import { ActiveChatBackgroundPicker } from "../../components/panels/settings/BackgroundPicker";
import { LocationBackgroundPins } from "./LocationBackgroundPins";
import { AdvancedParametersSection } from "./sections/AdvancedParametersSection";
import { CardFieldAlternativesSection } from "./sections/CardFieldAlternativesSection";
import { ChatNameSection } from "./sections/ChatNameSection";
import { ChatThemeSection } from "./sections/ChatThemeSection";
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
import { CardEvolutionAuditorSettings } from "./agents/CardEvolutionAuditorSettings";
import { HoldForRewriteToggle } from "./agents/HoldForRewriteToggle";
import { EchoChamberSettings } from "./agents/EchoChamberSettings";
import { DirectorSettings } from "./agents/DirectorSettings";
import { LorebookKeeperSettings } from "./agents/LorebookKeeperSettings";
import { GAME_SPOTIFY_KEYS, ROLEPLAY_SPOTIFY_KEYS, SpotifySourceSettings } from "./agents/SpotifySourceSettings";
import { HapticSettings } from "./agents/HapticSettings";
import {
  IllustratorImageConnectionSelect,
  IllustratorImageStyleSelect,
  IllustratorImagesPerGeneration,
  IllustratorPromptConnectionSelect,
  IllustratorRunIntervalField,
} from "./agents/IllustratorControls";
import { ConversationAgentsSection } from "./agents/ConversationAgentsSection";
import { LongTermMemoryCapabilitySettings } from "./agents/LongTermMemorySettings";
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
import { CapabilityElement } from "../../components/capabilities/CapabilityElement";
import type { AutoActiveCharactersMode, MultiplayerHostAction } from "@marinara-engine/shared";
import {
  audioConnectionSupportsGeneration,
  VIDEO_FIRST_FRAMES,
  normalizeVideoFirstFrame,
  type CardOnboarding,
  canBuildPersona,
  getRelevantCardVariables,
  hasOnboardingContent,
  readCardOnboarding,
  ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME,
  ILLUSTRATOR_VIDEO_MODES,
  normalizeIllustratorVideoMode,
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
import { MacroTextarea } from "../../components/ui/MacroTextarea";
import { Modal } from "../../components/ui/Modal";
import { DraftNumberInput } from "../../components/ui/DraftNumberInput";
import {
  AgentCategorySection,
  AgentDefaultStatus,
  AgentSettingsActionButton,
  AgentSettingsCard,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsTextarea,
  AgentSettingsToggle,
  MediaScopeSelect,
  AgentChoiceSelect,
  GamePromptTemplateSelect,
  GenerationSettingsLink,
} from "../../components/chat/AgentSettingsControls";
import { ExpressionSpriteSettings } from "./agents/ExpressionSpriteSettings";
import { AvatarLayoutSettings, type AvatarLayoutControls } from "../../components/chat/AvatarLayoutSettings";
import { AgentPromptTemplateSelect } from "./agents/AgentPromptTemplateSelect";
import { AgentLorebookAttachment } from "./agents/AgentLorebookAttachment";
import { SettingsSwitch } from "../../components/panels/settings/SettingControls";
import { ChoiceSelectionModal } from "../../components/presets/ChoiceSelectionModal";
import { CharacterOnboardingModal } from "../../components/characters/CharacterOnboardingModal";
import { SummariesEditorModal } from "./SummariesEditorModal";
import { useAdvancedMemoryStatus } from "../../hooks/use-advanced-memory";
import { RoleplayMessagePreview } from "../../components/chat/ChatMessage";
import { resolveChatContextBudget } from "../../lib/professor-mari-context-budget";
import { CHAT_SETTINGS_SURFACES } from "./chat-settings-surfaces";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useDefaultPreset, usePresetFull, usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { NeedsModelChip, agentModelNeed } from "../../components/connections/NeedsModelChip";
import { ConnectionSelect } from "../../components/connections/ConnectionSelect";
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
  filterAudioGenerationConnections,
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
import { getCadenceInputValue, parseCadenceInputValue, stepCadenceValue } from "../../lib/agent-cadence";
import { getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { extractCreatorNotesCss } from "../../lib/creator-notes-css";
import { isLorebookScopeActiveForChat } from "../../lib/lorebook-scope";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { isMobileShellViewport, ROLEPLAY_AVATAR_STYLES, useUIStore } from "../../stores/ui.store";
import { blurActiveChatFloatingUiControl } from "../../lib/chat-floating-ui-events";
import { requestChatHelp } from "../../lib/chat-help-events";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { useOverhaulActive, useOverhaulMobile, useOverhaulStore } from "../../stores/overhaul.store";
import {
  OvChatSettingsEditor,
  OvChatSettingsHeader,
  OvChatSettingsResizeHandle,
  OvChatSettingsStyle,
  OvChatSettingsHelpTitles,
} from "../../components/overhaul/ChatSettingsEdit";
import { getChatSettingsWindowProps, useTrackerPanelClearance } from "../../components/chat/chat-settings-window";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useChatControlDockStore, useHostHasDetachedDrawers } from "../../components/ui/drawer-host";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import type { ChatMode, ChatPreset, PromptPreset } from "@marinara-engine/shared";
import { customAgentHasCapability, parseAgentSettingsRecord, REFERENCE_PICTURE_TARGETS } from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  DEFAULT_AGENT_CONTEXT_SIZE,
  GAME_GM_BUILT_IN_PROMPT_TEMPLATES,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
  MIN_AGENT_MAX_TOKENS,
  STORYBOARD_AGENT_ID,
  AGENT_COST_HIGH_CALLS,
  AGENT_COST_HIGH_TOKENS,
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
import {
  AgentAddSetupFields,
  MusicFolderScope,
  normalizeCustomMusicExternalFolder,
  type CustomMusicSource,
  type MusicProvider,
} from "../../components/chat/AgentAddSetupFields";
import { takePendingChatResourcePanelRestore } from "../../lib/chat-resource-drag";
import { MultiplayerPlayersSection, type MultiplayerGameStart } from "../multiplayer/MultiplayerHostControls";
import { multiplayerGuestErrorLabelKey } from "../multiplayer/multiplayer-guest-labels";
import { multiplayerActionError, useMultiplayerMutation } from "../../hooks/use-multiplayer";
import { isKnowledgeAgentType } from "./agents/knowledge-agent-settings";
import { renderRoleplayAgentMenuIcon } from "./agents/roleplay-agent-menu-icon";
import { MemoryRecallMemoriesModal } from "./MemoryRecallMemoriesModal";
import { KnowledgeAgentSettingsCard } from "./agents/KnowledgeAgentSettingsCard";
import {
  DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
  DEFAULT_PROSE_GUARDIAN_AVOID,
  getAgentSettingsMenuId,
  getActiveAgentMenuDescription,
  type AvailableAgent,
  normalizePositiveInteger,
  normalizeAgentMaxTokens,
  useChatAgents,
  WEATHER_ART_LABELS,
} from "./agents/use-chat-agents";

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
const StoryboardChatSettingsPanel = lazy(() => import("./agents/StoryboardChatSettingsPanel"));
const ChatGalleryPanel = lazy(() =>
  import("./ChatGalleryPanel").then((module) => ({ default: module.ChatGalleryPanel })),
);
const ActiveLorebookEntriesContent = lazy(() =>
  import("../../components/chat/ChatRoleplayPanels").then((module) => ({
    default: module.ActiveLorebookEntriesContent,
  })),
);
const BeholderChatSettingsPanel = lazy(() => import("./agents/BeholderChatSettingsPanel"));
// Agent Suite is large and rarely opened; it loads the first time it opens and then stays mounted.
const AgentSuiteModal = lazy(() =>
  import("./agents/AgentSuiteModal").then((module) => ({ default: module.AgentSuiteModal })),
);
// Chat Variables' State editor is large; it loads when its page first opens.
const ChatVariablesEditorModal = lazy(() =>
  import("../../components/modals/ChatVariablesEditorModal").then((module) => ({
    default: module.ChatVariablesEditorModal,
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

function getMusicProviderLabel(provider: MusicProvider): string {
  return provider === "spotify" ? "Spotify" : provider === "youtube" ? "YouTube" : "Custom";
}

const MARINARA_UNIVERSAL_PRESET_NAME = "Marinara's Universal Preset";
const MARINARA_UNIVERSAL_PRESET_AUTHOR = "Marinara";

const CLASSIC_CHAT_SETTINGS_ORDER = {
  settingsPresets: -1600,
  search: -1500,
  chatName: -1400,
  chatBranches: -1350,
  connection: -1300,
  promptPreset: -1200,
  advancedParameters: -1100,
  combatStyle: -475,
  persona: -1000,
  characters: -900,
  cardFieldAlternatives: -890,
  groupChat: -800,
  scopedRegex: -750,
  chatVariables: -740,
  connectedChat: -700,
  connectedNotes: -690,
  lorebooks: -600,
  chatSummary: -590,
  activeContext: -580,
  agents: -500,
  agentActivity: -497,
  authorNotes: -495,
  background: -490,
  theme: -485,
  gallery: -480,
  widgets: -450,
  impersonate: -400,
  memoryRecall: -300,
  functionCalling: -200,
  translation: -100,
  gamePrompt: 0,
} as const;

/**
 * The new layout opens on what people change most (QC panel 2, D8): Connection, Prompt preset, Persona,
 * Characters, Lorebooks, then the rest as before; Chat name, Branches and Search messages move to the end (Ctrl+K
 * searches messages too). The phone's quick page already leads this way. A saved Edit order still wins.
 */
const OVERHAUL_CHAT_SETTINGS_ORDER = {
  ...CLASSIC_CHAT_SETTINGS_ORDER,
  persona: -1190,
  characters: -1180,
  cardFieldAlternatives: -1175,
  lorebooks: -1170,
  search: 900,
  chatName: 910,
  chatBranches: 920,
} as const;

const DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 25;
const MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 100;

function normalizeAgentMaxTokensInputValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

function customAgentCanBackfillLorebooks(agent: AvailableAgent, settings: Record<string, unknown>): boolean {
  if (agent.phase !== "post_processing") return false;
  const canEdit = customAgentHasCapability(settings, "edit_lorebooks");
  const canCreate = customAgentHasCapability(settings, "create_lorebooks");
  const enabledTools = Array.isArray(settings.enabledTools) ? settings.enabledTools : [];
  return (
    (canEdit && (settings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"))) ||
    (settings.resultType === "lorebook_update" && (canEdit || canCreate))
  );
}

function customLorebookBackfillChunkSize(settings: Record<string, unknown>): number {
  const value = settings.lorebookBackfillChunkSize;
  return normalizePositiveInteger(
    typeof value === "string" ? Number(value) : value,
    DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
    MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
  );
}

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
  const localizeText = useLocalizedUiText();
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
  const globalAvatarStyle = useUIStore((s) => s.roleplayAvatarStyle);
  const updateTranslationMeta = useUpdateChatMetadata({ serialize: true });
  const createMessage = useCreateMessage(chat.id);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const showContextUsage = useUIStore((s) => s.showContextUsage);
  const chatHelpButtonHidden = useUIStore((s) => s.chatHelpButtonHidden ?? false);
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  // Phones show Chat Settings as a full-width sheet.
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  // Overhaul look: the desktop drawer, and on phones/tablets the same look as a bottom sheet (never docked).
  const overhaulDesktop = useOverhaulActive() && !phoneLayout;
  const overhaulMobile = useOverhaulMobile();
  const CHAT_SETTINGS_ORDER =
    overhaulDesktop || overhaulMobile ? OVERHAUL_CHAT_SETTINGS_ORDER : CLASSIC_CHAT_SETTINGS_ORDER;
  const overhaulActive = overhaulDesktop || overhaulMobile;
  const ovFloating = useOverhaulStore((state) => state.chatSettingsFloating);
  const ovEditing = useOverhaulStore((state) => state.chatSettingsEditing) && overhaulActive;
  // New layout on phones and tablets: the sheet opens on its quick page; Edit mode keeps the classic sections.
  const mobileNavView = useMobileChatSettingsNav((state) => state.view);
  const mobileNavTitle = useMobileChatSettingsHeaderTitle();
  const mobileDrillTitle =
    overhaulMobile && (mobileNavView === "all" || mobileNavView === "page") ? mobileNavTitle : null;
  const confirmMobileResourceRemoval = (event: ReactMouseEvent<HTMLDivElement>) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>("[data-chat-settings-remove-resource]");
    if (!button) return;
    if (button.dataset.ovmConfirmed === "true") {
      delete button.dataset.ovmConfirmed;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void showConfirmDialog({
      title: localizeUi("chat.settings.removeConfirm.title", { defaultValue: "Remove from this chat?" }),
      message: localizeUi("chat.settings.removeConfirm.message", {
        defaultValue: "It stays in your Library. You can add it back any time.",
      }),
      confirmLabel: localizeUi("chat.settings.removeConfirm.confirm", { defaultValue: "Remove" }),
      tone: "destructive",
    }).then((confirmed) => {
      if (!confirmed) return;
      button.dataset.ovmConfirmed = "true";
      button.click();
    });
  };
  useEffect(() => {
    const nav = useMobileChatSettingsNav.getState();
    if (!overhaulMobile || ovEditing) nav.turnOff();
    else if (windowOpen) nav.showOnOpen();
  }, [overhaulMobile, ovEditing, windowOpen]);
  const ovDocked = overhaulDesktop && !ovFloating;
  // Docked Chat settings narrows the chat beside it instead of covering it. In Game Mode it slides over
  // the game instead: squeezing the scene and the game pane left the narration unreadable (user panel 2, N2).
  useChatSettingsReflow(panelRef, ovDocked && windowOpen && (chat as unknown as { mode?: unknown }).mode !== "game");
  const [ovScrollEl, setOvScrollEl] = useState<HTMLDivElement | null>(null);
  // Where the list was scrolled, so coming back from an editor page lands there again.
  const listScrollRef = useRef(0);
  const setOvGameSettingsSlot = useOverhaulStore((state) => state.setGameSettingsSlot);
  const [ovProfileSlot, setOvProfileSlot] = useState<HTMLDivElement | null>(null);
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
    () => {
      // Phones and tablets upright: back comes to the same page of the sheet (Agents), not its Quick page.
      const nav = useMobileChatSettingsNav.getState();
      useUIStore.getState().setChatSettingsReturn({
        chatId: chat.id,
        section: initialSection ?? null,
        ...(overhaulMobile && (nav.view === "all" || nav.view === "page")
          ? { mobileNav: { view: nav.view, page: nav.page, back: nav.back } }
          : {}),
      });
    },
    [chat.id, initialSection, overhaulMobile],
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
  const [agentSuiteLoaded, setAgentSuiteLoaded] = useState(false);
  const [memoryView, setMemoryViewState] = useState<"advanced" | "standard" | null>(null);
  // Game chats keep their memory with the GM as its only reader.
  const advancedMemoryAvailable = isRoleplayMode || isGame;
  const advancedMemoryStatus = useAdvancedMemoryStatus(chat.id, open && advancedMemoryAvailable);
  const advancedMemoryEnabled =
    advancedMemoryAvailable &&
    (advancedMemoryStatus.data?.settings ?? normalizeAdvancedMemorySettings(metadata.advancedMemory)).enabled;
  // New layout: the per-chat editors open as pages inside Chat settings instead of windows (see subpage.ts).
  const subpageState = useChatSettingsSubpage((state) => state.subpage);
  const openSubpage = useChatSettingsSubpage((state) => state.openSubpage);
  const activeSubpage: ChatSettingsSubpageId | null =
    overhaulActive && windowOpen && subpageState?.chatId === chat.id ? subpageState.id : null;
  const closeSubpage = useChatSettingsSubpage((state) => state.closeSubpage);
  // Phones and tablets upright: an editor page takes over the sheet's header (back, its name, close), so the page
  // shows one header, not the sheet's and its own (QC panel 3, Nov 22).
  const subpageInSheetHeader = overhaulMobile && mobileNavView !== "off" && !!activeSubpage;
  const mobileHeaderTitle =
    subpageInSheetHeader && activeSubpage ? localizeUi(SUBPAGE_TITLE_KEYS[activeSubpage]) : mobileDrillTitle;
  const agentSuiteOpen = overhaulActive ? activeSubpage === "agent-suite" : showAgentSuiteModal;
  if (agentSuiteOpen && !agentSuiteLoaded) setAgentSuiteLoaded(true);
  const hadSubpageRef = useRef(false);
  useLayoutEffect(() => {
    const hadSubpage = hadSubpageRef.current;
    hadSubpageRef.current = !!activeSubpage;
    if (activeSubpage || !ovScrollEl) return;
    ovScrollEl.scrollTop = listScrollRef.current;
    // Leaving an editor page puts focus back on the button that opened it (QC panel 3 AX10), or on its
    // section's header when that button is gone; never when focus already went elsewhere on purpose.
    if (!hadSubpage) return;
    const opener = takeChatSettingsSubpageOpener();
    const active = document.activeElement;
    const pane = ovScrollEl.closest<HTMLElement>(".mari-window");
    if (active && active !== document.body && !pane?.contains(active)) return;
    const visible = (element: HTMLElement | null | undefined) =>
      !!element && element.isConnected && element.getClientRects().length > 0;
    const sectionToggle = opener?.section
      ? ovScrollEl.querySelector<HTMLElement>(
          `[data-chat-settings-section="${CSS.escape(opener.section)}"] [data-drawer-toggle]`,
        )
      : null;
    const target = visible(opener?.element) ? opener!.element : visible(sectionToggle) ? sectionToggle : null;
    target?.focus({ preventScroll: true });
  }, [activeSubpage, ovScrollEl]);
  const showSubpage = useCallback((id: ChatSettingsSubpageId) => openSubpage(chat.id, id), [chat.id, openSubpage]);
  const setMemoryView = useCallback<Dispatch<SetStateAction<"advanced" | "standard" | null>>>(
    (next) =>
      setMemoryViewState((current) => {
        const value = typeof next === "function" ? next(current) : next;
        if (value !== "standard" || !overhaulActive) return value;
        // Plain memories open as the Memories page; the list's own state stays where it was.
        queueMicrotask(() => showSubpage("memories"));
        return current;
      }),
    [overhaulActive, showSubpage],
  );
  const openSummariesEditor = useCallback(
    (show: boolean) => {
      if (overhaulActive) {
        if (show) showSubpage("summaries");
        else closeSubpage();
      } else setShowSummariesModal(show);
    },
    [closeSubpage, overhaulActive, showSubpage],
  );
  const openAgentSuite = useCallback(
    (show: boolean) => {
      if (overhaulActive) {
        if (show) showSubpage("agent-suite");
        else closeSubpage();
      } else setShowAgentSuiteModal(show);
    },
    [closeSubpage, overhaulActive, showSubpage],
  );
  useEffect(() => setMemoryViewState(null), [advancedMemoryEnabled, chat.id]);
  // A scene number in the Fix box (or a notice) opens Access memories at that scene.
  const advancedMemorySceneRequest = useUIStore((state) =>
    state.advancedMemoryRequest?.chatId === chat.id ? state.advancedMemoryRequest.sceneId : undefined,
  );
  useEffect(() => {
    if (advancedMemorySceneRequest && advancedMemoryEnabled) setMemoryViewState("advanced");
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
  const {
    updateAgentConfig,
    agentProcessing,
    stoppingGeneration,
    imageStyleProfiles,
    musicPlayerSource,
    debugMode,
    setEditorDirty,
    customAgentSettingsOrder,
    getRoleplayAgentSettingsOrder,
    activeGeneration,
    handleStopActiveGeneration,
    worldMapsSettingsDescription,
    supportsNarrativeDirectorSecretPlot,
    videoConnectionsList,
    openGenerationSettings,
    openDownloadAgents,
    refreshLorebooks,
    openLorebookFromSettings,
    mapsPackage,
    mapsPackageEnabledForChat,
    ltmPackage,
    chatSettingsPackageByAgentId,
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
    illustratorReferencePictureTarget,
    illustratorPromptConnectionId,
    illustratorImageConnectionId,
    illustratorImagesPerGeneration,
    illustratorChatRunInterval,
    illustratorRunInterval,
    illustratorChatVideoRunInterval,
    illustratorVideoRunInterval,
    illustratorAutoBackgroundsEnabled,
    illustratorWeatherBackgroundsEnabled,
    hasDecisionModel,
    illustratorDecisionLocationCheck,
    illustratorDecisionWeatherCheck,
    shownWeatherVersion,
    remakingWeatherArt,
    remakeWeatherArt,
    toggleIllustratorWeatherBackgrounds,
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
  } = chatAgents;
  const renderDownloadedAgentChatSettings = (
    agent: { id: string; name: string; description: string },
    className = "mt-2 block overflow-hidden rounded-lg",
  ) => {
    if (agent.id === "hierarchical-maps" || agent.id === "long-term-memory") return null;
    const capabilityPackage = chatSettingsPackageByAgentId.get(agent.id);
    if (!capabilityPackage) return null;
    return (
      <CapabilityElement
        packageId={capabilityPackage.id}
        view="settings"
        capabilityProps={{
          chatId: chat.id,
          chatMode,
          debugMode,
          agent,
          connections: chatGenerationConnectionsList,
          onDirtyChange: setEditorDirty,
          confirmAction: showConfirmDialog,
        }}
        className={className}
      />
    );
  };
  const renderReviewAgentOutputsToggle = (surface: "card" | "secondary") => (
    <AgentSettingsToggle
      label={localizeUi("ui.chat.chatsettingsdrawer.reviewAgentOutputs")}
      description={
        agentWriteApprovalRequired
          ? localizeUi("ui.chat.chatsettingsdrawer.lorebookSummaryCharacterCardUpdatesAndReviewableWriterAgent")
          : localizeUi("ui.chat.chatsettingsdrawer.lorebookAndSummaryUpdatesCanBeCommittedAutomaticallyCharacter")
      }
      enabled={agentWriteApprovalRequired}
      surface={surface}
      onToggle={() =>
        updateMeta.mutate({
          id: chat.id,
          agentWriteApprovalRequired: !agentWriteApprovalRequired,
        })
      }
    />
  );
  const renderIllustratorPromptConnectionSelect = () => (
    <IllustratorPromptConnectionSelect
      chat={chat}
      connectionId={illustratorPromptConnectionId}
      includeLocalSidecar={!isGame && sidecarModelDownloaded}
    />
  );
  const renderIllustratorImageConnectionSelect = () => (
    <IllustratorImageConnectionSelect
      chat={chat}
      connectionId={illustratorImageConnectionId}
      agentSettings={illustratorConfig?.settings}
    />
  );
  const renderIllustratorImageStyleSelect = (options: { emptyOptionLabel?: string; description?: string } = {}) => (
    <IllustratorImageStyleSelect
      chat={chat}
      styleProfileId={(metadata.imageStyleProfileId as string) ?? ""}
      emptyOptionLabel={options.emptyOptionLabel}
      description={options.description}
    />
  );
  const renderIllustratorImagesPerGeneration = () => (
    <IllustratorImagesPerGeneration chat={chat} value={illustratorImagesPerGeneration} />
  );
  const renderIllustratorRunInterval = () => (
    <IllustratorRunIntervalField
      chat={chat}
      kind="image"
      value={illustratorRunInterval}
      overridden={illustratorChatRunInterval !== null}
    />
  );
  const renderIllustratorVideoRunInterval = () => (
    <IllustratorRunIntervalField
      chat={chat}
      kind="video"
      value={illustratorVideoRunInterval}
      overridden={illustratorChatVideoRunInterval !== null}
    />
  );
  const renderIllustratorDecisionChecks = () => {
    if (!illustratorAutoBackgroundsEnabled && !illustratorWeatherBackgroundsEnabled) return null;
    const value =
      illustratorDecisionLocationCheck && illustratorDecisionWeatherCheck
        ? "both"
        : illustratorDecisionLocationCheck
          ? "location"
          : illustratorDecisionWeatherCheck
            ? "weather"
            : "off";
    const options = [
      "off",
      ...(illustratorAutoBackgroundsEnabled ? ["location"] : []),
      ...(illustratorWeatherBackgroundsEnabled ? ["weather"] : []),
      ...(illustratorAutoBackgroundsEnabled && illustratorWeatherBackgroundsEnabled ? ["both"] : []),
    ];
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.illustratorDecisionChecks")}
        </span>
        <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi(
            hasDecisionModel
              ? "ui.chat.chatsettingsdrawer.illustratorDecisionChecksHelp"
              : "ui.chat.chatsettingsdrawer.illustratorDecisionChecksNoModel",
          )}
        </span>
        <select
          value={value}
          disabled={!hasDecisionModel && value === "off"}
          onChange={(e) =>
            updateMeta.mutate({
              id: chat.id,
              illustratorDecisionLocationCheck: e.target.value === "location" || e.target.value === "both",
              illustratorDecisionWeatherCheck: e.target.value === "weather" || e.target.value === "both",
            })
          }
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {localizeUi(`ui.chat.chatsettingsdrawer.illustratorDecisionChecks.${option}`)}
            </option>
          ))}
        </select>
      </label>
    );
  };

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

  const renderAgentLorebookAttachment = (agentType: string) => {
    const agent = availableAgents.find((entry) => entry.id === agentType);
    if (!agent || (agent.builtIn && agent.category !== "writer" && agent.category !== "tracker")) return null;
    if (agentType === "hierarchical-maps") {
      const api = mapsPackage?.manifest.schemaVersion === 2 ? mapsPackage.manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 380)) {
        return (
          <p data-agent-lorebook-package-update={agentType} className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("chat.agentLorebook.packageUpdateRequired")}
          </p>
        );
      }
    }
    return <AgentLorebookAttachment chatId={chat.id} agentType={agentType} />;
  };

  const avatarLayoutCard =
    avatarLayoutActive && avatarLayout ? (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "avatars")}
        icon={renderRoleplayAgentMenuIcon("avatars")}
        title={localizeUi("avatars.setup.title")}
        description={localizeUi("avatars.layout.description")}
        order={isGame ? undefined : avatarSettingsOrder}
      >
        <AvatarLayoutSettings chatId={chat.id} layout={avatarLayout} />
      </AgentSettingsCard>
    ) : null;

  const renderStandaloneRoleplayAgentSettingsCard = (agent: (typeof availableAgents)[number]) => {
    let settings: React.ReactNode;

    if (agent.id === "hierarchical-maps" && mapsPackage) {
      settings = (
        <CapabilityElement
          packageId={mapsPackage.id}
          view="settings"
          capabilityProps={{
            chatId: chat.id,
            chatName: chat.name,
            chatMode,
            debugMode,
            enabledForChat: mapsPackageEnabledForChat,
            onEnabledForChatChange: setMapsEnabledForChat,
            confirmAction: showConfirmDialog,
            onDirtyChange: setEditorDirty,
            onOpenLorebook: openLorebookFromSettings,
            onLorebooksChanged: refreshLorebooks,
          }}
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === "long-term-memory" && ltmPackage) {
      settings = (
        <LongTermMemoryCapabilitySettings
          chat={chat}
          metadata={metadata}
          packageId={ltmPackage.id}
          enabledForChat={metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)}
          setLtmEnabledForChat={setLtmEnabledForChat}
          requestClose={requestClose}
          rememberSettingsReturn={rememberSettingsReturn}
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === STORYBOARD_AGENT_ID) {
      settings = (
        <Suspense fallback={null}>
          <StoryboardChatSettingsPanel
            chatId={chat.id}
            metadata={metadata as Record<string, unknown>}
            onClose={closeForSurface}
            ownerMode="roleplay"
          />
        </Suspense>
      );
    } else if (agent.id === "beholder") {
      settings = (
        <Suspense fallback={null}>
          <BeholderChatSettingsPanel
            chatId={chat.id}
            onOpenAgentSettings={() => {
              void requestClose().then((closed) => {
                if (closed) {
                  rememberSettingsReturn();
                  useUIStore.getState().openAgentDetail("beholder");
                }
              });
            }}
          />
        </Suspense>
      );
    } else {
      settings = renderDownloadedAgentChatSettings(agent, "block overflow-hidden");
    }

    if (!settings) return null;
    return (
      <AgentSettingsCard
        key={agent.id}
        id={getAgentSettingsMenuId(chat.id, agent.id)}
        icon={renderRoleplayAgentMenuIcon(agent.id)}
        title={agent.name}
        description={
          agent.id === "hierarchical-maps"
            ? worldMapsSettingsDescription
            : getActiveAgentMenuDescription(agent.description)
        }
        order={getRoleplayAgentSettingsOrder(agent.id)}
        onRemove={getRoleplayAgentMenuRemoveHandler(agent.id, agent.name)}
      >
        {renderAgentLorebookAttachment(agent.id)}
        {settings}
      </AgentSettingsCard>
    );
  };
  const renderAgentPromptTemplateSelect = (agentId: string) => (
    <AgentPromptTemplateSelect
      options={getPromptOptionsForAgent(agentId)}
      selectedId={agentPromptTemplateSelections[agentId] ?? getDefaultPromptTemplateIdForAgent(agentId)}
      overridden={typeof agentPromptTemplateSelections[agentId] === "string"}
      onChange={(promptTemplateId) => updateAgentPromptTemplateSelection(agentId, promptTemplateId)}
    />
  );

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
        // An editor page with unsaved edits asks first; closing Chat settings leaves the page too.
        if (!(await requestCloseChatSettingsSubpage())) return false;
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
  // Every other Chat settings closer (top-bar and toolbar buttons, back) runs this same guarded close.
  useEffect(() => registerChatSettingsCloser(() => requestClose(true)), [requestClose]);
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
  const renderCustomMusicLibrarySettings = (surface: "game" | "roleplay") => (
    <div className="space-y-2">
      <MusicFolderScope
        target={musicFolderTarget}
        character={musicFolderCharacter}
        inUse={musicFolderInUse}
        showInUse={effectiveCustomMusicSource === "folder"}
        canUseDefault={!!chatMusicFolder}
        canUnlink={!!characterMusicFolder}
        onTargetChange={(target) => setMusicFolderTargetChoice({ chatId: chat.id, target })}
        onUseDefault={() => void saveCustomMusicExternalFolder("chat", "")}
        onUnlink={() => void saveCustomMusicExternalFolder("character", "")}
      />
      {musicFolderTarget === "default" && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.customMusicSource")}
          </span>
          <select
            value={customMusicSource}
            onChange={(event) =>
              void updateCustomMusicLibrary({ customMusicSource: event.target.value as CustomMusicSource })
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
          >
            <option value="game-assets">{localizeUi("game.toolbar.assets")}</option>
            <option value="folder">{localizeUi("ui.chat.musicdjsetupfields.folderOnThisDevice")}</option>
          </select>
        </label>
      )}

      {musicFolderTarget !== "default" || customMusicSource === "folder" ? (
        <div className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.musicFolderOnThisDevice")}
          </span>
          <div className="flex flex-col gap-2 @lg:flex-row">
            <input
              key={`${chat.id}-${surface}-custom-music-folder-${musicFolderTarget}-${targetMusicFolder}`}
              defaultValue={targetMusicFolder}
              onBlur={(event) => {
                const folder = normalizeCustomMusicExternalFolder(event.target.value);
                if (folder !== targetMusicFolder) void saveCustomMusicExternalFolder(musicFolderTarget, folder);
              }}
              placeholder={localizeUi("ui.agents.agenteditor.noFolderSelected")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
            />
            <button
              type="button"
              onClick={() => void selectCustomMusicExternalFolder(musicFolderTarget)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <FolderOpen size="0.75rem" />
              {localizeUi("ui.chat.musicdjsetupfields.chooseFolder")}
            </button>
          </div>
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.musicDjWillChooseFromAudioFilesInThis")}
          </span>
        </div>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.gameAssetsMusicFolder")}
          </span>
          <input
            key={`${chat.id}-${surface}-custom-music-${customMusicFolder}`}
            defaultValue={customMusicFolder}
            onBlur={(event) => saveCustomMusicFolder("default", event.target.value)}
            placeholder={localizeUi("ui.agents.agenteditor.music")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.readsLocalAudioFromGameAssetsForExample")} <code>music</code>{" "}
            {localizeUi("ui.noodle.noodlehome.or")} <code>music/combat</code>.
          </span>
        </label>
      )}
      {/* This chat's own Game Assets subfolder (#8916), while the chat plays Game Assets. */}
      {musicFolderTarget === "chat" && effectiveCustomMusicSource === "game-assets" && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.gameAssetsMusicFolder")}
          </span>
          <input
            key={`${chat.id}-${surface}-chat-custom-music-${chatCustomMusicFolder}`}
            defaultValue={chatCustomMusicFolder}
            onBlur={(event) => saveCustomMusicFolder("chat", event.target.value)}
            placeholder={customMusicFolder}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.gameAssetsMusicFolderForThisChatOnly")}
          </span>
        </label>
      )}
    </div>
  );

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

  const renderCustomAgentPicker = ({ showWhenEmpty = false }: { showWhenEmpty?: boolean } = {}) => {
    if (customAgents.length === 0 && !showWhenEmpty) return null;
    return (
      <AgentCategorySection
        label={localizeUi("ui.panels.agentspanel.customAgents")}
        icon={<Settings2 size="0.75rem" />}
        description={localizeUi("ui.chat.chatsettingsdrawer.addYourCustomCreatedAgentsToThisChat")}
        count={activeCustomAgents.length}
      >
        {inactiveCustomAgents.length > 0 ? (
          <div className="flex flex-col gap-1">
            {inactiveCustomAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => openAgentAddModal(agent)}
                className="flex items-center gap-2.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{agent.name}</span>
                  <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                    {agent.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : customAgents.length === 0 ? (
          <div className="space-y-2 px-1">
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.noCustomAgentsAreAvailableYetCreateOneIn")}
            </p>
            <button
              type="button"
              onClick={() => {
                closeForSurface();
                const ui = useUIStore.getState();
                // The phone's Agents panel would be where back lands instead of Chat settings.
                if (!isMobileShellViewport()) ui.openRightPanel("agents");
                ui.openAgentDetail("__new__");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <Plus size="0.75rem" />
              {localizeUi("ui.chat.chatsettingsdrawer.createCustomAgent")}
            </button>
          </div>
        ) : (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {isGame && !metadata.enableAgents
              ? localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreAlreadyAttachedEnableAgentsTo")
              : localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreActiveConfigureThemBelowThe")}
          </p>
        )}
      </AgentCategorySection>
    );
  };

  const renderActiveCustomAgentSettingsCard = () => {
    if (!metadata.enableAgents || activeCustomAgents.length === 0) return null;
    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "custom-agents")}
        icon={renderRoleplayAgentMenuIcon("custom-agents")}
        title={localizeUi("ui.panels.agentspanel.customAgents")}
        description={localizeUi("ui.chat.chatsettingsdrawer.configureCustomAgentsCurrentlyAttachedToThisChat")}
        order={customAgentSettingsOrder}
      >
        <div className="space-y-3">
          {activeCustomAgents.map((agent) => {
            const agentConfig = agentConfigsByType.get(agent.id);
            const agentSettings = parseAgentSettingsRecord(agentConfig?.settings);
            const backfillAvailable = customAgentCanBackfillLorebooks(agent, agentSettings);
            const backfillEnabled = backfillAvailable && agentSettings.lorebookBackfillEnabled === true;
            const backfillChunkSize = customLorebookBackfillChunkSize(agentSettings);
            const tokenEst = agentLoadCost.tokensByType.get(agent.id);
            const imageCapable = isImageCapableCustomAgent(agent.id);
            const agentImageConnectionId = customAgentImageSelections[agent.id]?.imageConnectionId ?? "";
            const agentImageStyleProfileId = customAgentImageSelections[agent.id]?.styleProfileId ?? "";
            const agentImageStyleProfileMissing =
              agentImageStyleProfileId.length > 0 &&
              !imageStyleProfiles.profiles.some((profile) => profile.id === agentImageStyleProfileId);
            return (
              // No box per agent: its toggles sit on the card like every other agent menu's; a rule separates agents.
              <div
                key={agent.id}
                className="space-y-2 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-start gap-2.5">
                  <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="block min-w-0 truncate text-xs font-medium">{agent.name}</span>
                      {tokenEst != null ? (
                        <span
                          className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                          title={localizeUi("ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated", {
                            value1: tokenEst.toLocaleString(),
                          })}
                        >
                          ~{tokenEst.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                      {agent.description}
                    </span>
                    <NeedsModelChip
                      kind={imageCapable ? "image" : null}
                      own={agentImageConnectionId || agentModelNeed(agent.id, agentConfig?.settings)?.own}
                      className="mt-1"
                    />
                  </div>
                  <button
                    onClick={() => {
                      void handleRerunCustomAgent(agent.id);
                    }}
                    disabled={agentProcessing}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                      agentProcessing
                        ? "cursor-not-allowed opacity-40"
                        : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                    )}
                    title={localizeUi("ui.chat.chatsettingsdrawer.reRunValue1OnTheLastMessage", {
                      value1: agent.name,
                    })}
                  >
                    <RefreshCw size="0.6875rem" className={cn(agentProcessing && "animate-spin")} />
                  </button>
                  {imageCapable && (
                    <button
                      onClick={() => {
                        void handleSnapshotCustomAgent(agent.id);
                      }}
                      disabled={agentProcessing}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                        agentProcessing
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                      )}
                      title={localizeUi("ui.chat.chatsettingsdrawer.generateAnImageWithValue1Now", {
                        value1: agent.name,
                      })}
                    >
                      <Camera size="0.6875rem" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      void toggleAgent(agent.id);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
                {renderAgentPromptTemplateSelect(agent.id)}
                {renderAgentLorebookAttachment(agent.id)}
                {backfillAvailable && agentConfig && (
                  <div className="space-y-2">
                    <AgentSettingsToggle
                      label={localizeUi("ui.agents.agenteditor.enableChunkedBackfill")}
                      description={localizeUi("ui.agents.agenteditor.enableChunkedBackfillDescription")}
                      enabled={backfillEnabled}
                      onToggle={() =>
                        void updateCustomAgentBackfillSettings(agent.id, {
                          lorebookBackfillEnabled: !backfillEnabled,
                          lorebookBackfillChunkSize: backfillChunkSize,
                        })
                      }
                    />
                    {backfillEnabled && (
                      <div className="flex flex-col gap-2 rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)] @lg:flex-row @lg:items-end">
                        <label className="min-w-0 flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          <span className="mb-1 block font-medium text-[var(--foreground)]">
                            {localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                          </span>
                          <DraftNumberInput
                            value={backfillChunkSize}
                            min={1}
                            max={MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE}
                            disabled={updateAgentConfig.isPending}
                            onCommit={(lorebookBackfillChunkSize) =>
                              void updateCustomAgentBackfillSettings(agent.id, { lorebookBackfillChunkSize })
                            }
                            ariaLabel={localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleBackfillCustomAgent(agent.id)}
                          disabled={agentProcessing}
                          className={cn(
                            "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                            agentProcessing
                              ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)]"
                              : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15",
                          )}
                        >
                          <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
                          {localizeUi("ui.chat.customAgentBackfill.nextChunk")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {imageCapable && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                    </span>
                    <ConnectionSelect
                      job={t("connections.picker.job.images")}
                      aria-label={localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                      value={agentImageConnectionId || null}
                      onChange={(connectionId) => updateCustomAgentImageConnection(agent.id, connectionId ?? "")}
                      kind="image"
                      defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}
                      inherits="agents"
                    />
                    <AgentDefaultStatus
                      overridden={agentImageConnectionId.length > 0}
                      onReset={() => updateCustomAgentImageConnection(agent.id, "")}
                    />
                    <span className="mt-1 text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                    </span>
                    <select
                      aria-label={localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                      value={agentImageStyleProfileId}
                      onChange={(event) => updateCustomAgentImageStyle(agent.id, event.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    >
                      <option value="">{localizeUi("ui.chat.chatsettingsdrawer.chatDefault")}</option>
                      {agentImageStyleProfileMissing && (
                        <option value={agentImageStyleProfileId}>
                          {localizeUi("ui.chat.chatsettingsdrawer.missingStyleProfile")}
                        </option>
                      )}
                      {imageStyleProfiles.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <AgentDefaultStatus
                      overridden={agentImageStyleProfileId.length > 0 && !agentImageStyleProfileMissing}
                      onReset={() => updateCustomAgentImageStyle(agent.id, "")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AgentSettingsCard>
    );
  };

  const renderHapticSettingsCard = () => {
    if (!metadata.enableAgents || !hapticActive) return null;

    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "haptic")}
        icon={renderRoleplayAgentMenuIcon("haptic")}
        title={hapticAgentMeta.name}
        description={hapticAgentMeta.description}
        order={getRoleplayAgentSettingsOrder("haptic")}
        onRemove={getRoleplayAgentMenuRemoveHandler("haptic", hapticAgentMeta.name)}
      >
        {renderAgentLorebookAttachment("haptic")}
        <HapticSettings chat={chat} metadata={metadata} />
      </AgentSettingsCard>
    );
  };
  if (!open) return null;
  // Only the loaded settings add the Chat Settings classes below; themes and select styling target them.
  const windowProps = getChatSettingsWindowProps(anchor);
  const personaSectionProps = {
    order: CHAT_SETTINGS_ORDER.persona,
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
  // Memory recall renders in two places, so keyboard order stays as before in every mode.
  const memoryRecallSectionProps = {
    order: CHAT_SETTINGS_ORDER.memoryRecall,
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
    if (confirmed) {
      resetView();
      // Sections hidden or reordered in Edit come back too (the new layout keeps that arrangement per chat mode).
      useOverhaulStore.getState().setChatSettingsLayout(chatMode, null);
    }
    if (button.isConnected) button.focus({ preventScroll: true });
  };
  const resetViewButton = (
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
  );
  // Reset View and the favorite arrangement, then the Tracker Panel dice and window controls.
  const headerControls = (
    <>
      {resetViewButton}
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
    order: CHAT_SETTINGS_ORDER.characters,
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
    avatarDisplayControl:
      chatMode === "roleplay" ? (
        <label className="mt-2 flex items-center justify-between gap-3 text-xs" data-chat-avatar-display>
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.avatarDisplay")}
          </span>
          <select
            value={typeof metadata.roleplayAvatarStyle === "string" ? metadata.roleplayAvatarStyle : ""}
            onChange={(event) => updateMeta.mutate({ id: chat.id, roleplayAvatarStyle: event.target.value || null })}
          >
            <option value="">
              {localizeUi("ui.chat.chatsettingsdrawer.avatarDisplayDefault", {
                style: localizeUi(`ui.chat.chatsettingsdrawer.avatarStyle.${globalAvatarStyle}`),
              })}
            </option>
            {ROLEPLAY_AVATAR_STYLES.map((style) => (
              <option key={style} value={style}>
                {localizeUi(`ui.chat.chatsettingsdrawer.avatarStyle.${style}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null,
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
    order: CHAT_SETTINGS_ORDER.persona,
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
    overhaulActive,
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
        drawerHost={{
          title: localizeUi("chat.toolbar.settings"),
          scrollClassName: DRAWER_WINDOW_SCROLL_AREA,
          // Popped-out sections float freely: they keep the look but not the docked pane or Edit mode.
          windowClassName: overhaulActive
            ? cn(windowProps.className, "mari-chat-settings-popover mari-chat-settings-drawer ov-cs ov-cs--section")
            : undefined,
        }}
        presentation={phoneLayout || overhaulMobile ? "sheet" : "window"}
        modalSheet
        // Phones and tablets: on the list and on a section's page the header is that page's own (back, name, help).
        title={mobileHeaderTitle ?? localizeUi("chat.toolbar.settings")}
        titleIcon={
          mobileHeaderTitle ? (
            <MobileChatSettingsHeaderBack />
          ) : (
            <Settings2 size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
          )
        }
        titleAccessory={
          mobileHeaderTitle ? (
            <MobileChatSettingsPageHelp />
          ) : overhaulActive ? (
            <OvChatSettingsHeader mode={chatMode} />
          ) : (
            helpLayoutButton
          )
        }
        // Docked keeps a quiet header; Edit still offers Reset View there. A page on phones and tablets keeps only back,
        // its name, its help and close, so a long page name stays whole (themes may refuse to shorten it).
        headerControls={ovDocked ? (ovEditing ? resetViewButton : null) : mobileHeaderTitle ? null : headerControls}
        closeLabel={localizeUi("ui.chat.chatsettingsdrawer.closeChatSettings")}
        {...windowProps}
        // Sidebar presses belong to the modeless profile editor while it is open.
        ignoreOutsidePointer={(target) => profileBuilder !== null || windowProps.ignoreOutsidePointer(target)}
        // A window the user has not moved opens beside a right-side Tracker Panel, not over it.
        defaultLayoutKey={`${trackerPanelSide}:${trackerPanelClearance}`}
        className={cn(
          windowProps.className,
          "mari-chat-settings-popover mari-chat-settings-drawer",
          overhaulActive && "ov-cs",
          ovDocked && "ov-cs--docked",
          ovEditing && "is-editing",
        )}
        bodyRef={panelRef}
        onRequestClose={(reason) =>
          // Escape on an editor page goes back one page (asking about unsaved edits); a second Escape closes
          // Chat settings (QC panel 3 AX10). Returning false keeps the window open.
          reason === "escape" && useChatSettingsSubpage.getState().subpage
            ? requestCloseChatSettingsSubpage().then(() => false)
            : requestClose()
        }
      >
        {/* Desktop-only: drag-and-drop hint (sidebar drag is disabled on mobile overlays) */}
        {overhaulActive && <OvChatSettingsStyle mode={chatMode} />}
        {overhaulActive && <OvChatSettingsHelpTitles container={ovScrollEl} />}
        {ovEditing && (
          <OvChatSettingsEditor
            mode={chatMode}
            container={ovScrollEl}
            onProfileSlot={modeSettingsSurfaces.showSettingsProfiles ? setOvProfileSlot : undefined}
          />
        )}
        {ovDocked && ovEditing && <OvChatSettingsResizeHandle />}
        {!overhaulActive && metadata.chatSettingsHintDismissed !== true && (
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

        {/* Arranges the classic chat's floating buttons, which the new layout never shows. */}
        {!overhaulActive && <ChatButtonLayoutSettings />}

        {activeSubpage && <ChatSettingsSubpageFrame id={activeSubpage} inSheetHeader={subpageInSheetHeader} />}

        {/* Desktop and iPad landscape: section bodies load as they near the visible list (not on a jump to one). */}
        <ChatSettingsDeferBodiesContext.Provider value={overhaulDesktop && !overhaulMobile && !initialSection}>
          <div
            ref={setOvScrollEl}
            // An editor page covers the list; the list stays mounted so its sections and place survive.
            hidden={!!activeSubpage}
            onScroll={(event) => {
              if (!activeSubpage) listScrollRef.current = event.currentTarget.scrollTop;
            }}
            className={cn(
              NEUTRAL_PANEL_SCROLL_AREA,
              "@container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(1rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))]",
              overhaulActive && "ov-cs__scroll",
            )}
            data-ovm-cs-view={overhaulMobile && mobileNavView !== "off" ? mobileNavView : undefined}
            // Phones and tablets: removing a character, persona or lorebook from the chat asks first,
            // since its small button is easy to hit by accident.
            onClickCapture={overhaulMobile ? confirmMobileResourceRemoval : undefined}
          >
            {/* Settings profile bar — hidden in Game Mode. Scene chats keep it, but scene instructions stay chat-owned. */}
            <div ref={setControlDockHost} data-chat-control-dock style={{ order: CHAT_SETTINGS_ORDER.search + 1 }} />
            {metadata.multiplayer && (
              <MultiplayerPlayersSection
                chatId={chat.id}
                forceOpen={initialSection === "multiplayer"}
                gameStart={multiplayerGameStart}
              />
            )}
            {modeSettingsSurfaces.showSettingsProfiles &&
              (() => {
                const profileBar = (
                  <SettingsProfilesSection
                    order={CHAT_SETTINGS_ORDER.settingsPresets}
                    chat={chat}
                    chatMode={chatMode}
                    isRoleplayMode={isRoleplayMode}
                    metadata={metadata}
                    activeLorebookIds={activeLorebookIds}
                    profileBuilder={profileBuilder}
                    setProfileBuilder={setProfileBuilder}
                  />
                );
                // Overhaul: the profile bar lives behind Edit, so it is not in the way every time.
                return !overhaulActive
                  ? profileBar
                  : ovEditing && ovProfileSlot
                    ? createPortal(profileBar, ovProfileSlot)
                    : null;
              })()}
            {/* Overhaul Game Mode: the game's own tools (session, volume, game tools) are portaled in here. */}
            {overhaulActive && isGame && <div ref={setOvGameSettingsSlot} data-ov-contents className="contents" />}
            {overhaulMobile && mobileNavView !== "off" && (
              <>
                <MobileChatSettingsQuick
                  // After Lorebooks, the last row on the quick page (its switches and All settings follow).
                  order={CHAT_SETTINGS_ORDER.lorebooks + 5}
                  sectionCount={0}
                  switches={[
                    {
                      id: "agents",
                      label: localizeUi("chat.settings.quick.agents", { defaultValue: "Agents" }),
                      on: metadata.enableAgents === true,
                      disabled: updateMeta.isPending,
                      onToggle: () => updateMeta.mutate({ id: chat.id, enableAgents: metadata.enableAgents !== true }),
                    },
                    ...(trackerPanelToggleAvailable
                      ? [
                          {
                            id: "trackers",
                            label: localizeUi("chat.settings.quick.trackers", { defaultValue: "Trackers" }),
                            on: trackerPanelShown,
                            onToggle: toggleTrackerPanel,
                          },
                        ]
                      : []),
                    {
                      id: "translate",
                      label: localizeUi("chat.settings.quick.translate", { defaultValue: "Translate" }),
                      on: metadata.autoTranslate === true,
                      disabled: updateTranslationMeta.isPending,
                      onToggle: () =>
                        updateTranslationMeta.mutate({ id: chat.id, autoTranslate: metadata.autoTranslate !== true }),
                    },
                  ]}
                />
                <MobileChatSettingsGroup
                  order={CHAT_SETTINGS_ORDER.connection - 1}
                  label={localizeUi("chat.settings.groups.model", { defaultValue: "Model" })}
                />
                <MobileChatSettingsGroup
                  order={CHAT_SETTINGS_ORDER.persona - 1}
                  label={localizeUi("chat.settings.groups.people", { defaultValue: "People" })}
                />
                <MobileChatSettingsGroup
                  order={CHAT_SETTINGS_ORDER.scopedRegex - 1}
                  label={localizeUi("chat.settings.groups.memory", { defaultValue: "Memory" })}
                />
                <MobileChatSettingsGroup
                  order={CHAT_SETTINGS_ORDER.agents - 1}
                  label={localizeUi("chat.settings.groups.more", { defaultValue: "Agents and tools" })}
                />
              </>
            )}

            {chatTools && !isGame && (
              <Section
                id={`${chatMode}-message-search`}
                label={localizeUi("chat.toolbar.searchMessages")}
                icon={<Search size="0.875rem" />}
                help={localizeUi("chat.settings.searchMessagesHelp")}
                style={{ order: CHAT_SETTINGS_ORDER.search }}
                forceOpen={initialSection === "message-search"}
                contentClassName="pt-0"
              >
                <div data-chat-settings-search>
                  <ChatMessageSearch chatId={chat.id} />
                </div>
              </Section>
            )}

            <div style={{ order: CHAT_SETTINGS_ORDER.chatName }}>
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
                chat={chat}
              />
            </div>

            {chatTools && (
              <Section
                id={`${chatMode}-chat-branches`}
                style={{ order: CHAT_SETTINGS_ORDER.chatBranches }}
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

            <div data-ovm-quick="true" style={{ order: CHAT_SETTINGS_ORDER.connection }}>
              <ConnectionSection
                chatId={chat.id}
                connectionId={chat.connectionId ?? null}
                connections={chatGenerationConnectionsList}
                contextBudget={gameContextBudget}
                isGame={isGame}
                onConnectionChange={setConnection}
              />
            </div>

            {/* Roleplay prompt preset */}
            {modeSettingsSurfaces.promptSettingsSurface === "roleplay" && (
              <div data-ovm-quick="true" style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
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
              </div>
            )}

            {/* Conversation/Game prompt preset */}
            {modeSettingsSurfaces.promptSettingsSurface === "conversation" && (
              <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
                <ConversationPromptSection
                  chatId={chat.id}
                  customPrompt={(metadata.customSystemPrompt as string) ?? ""}
                  promptPresetId={effectiveModePromptPresetId}
                  promptPresets={promptPresetOptions}
                  selectedPresetPrompt={selectedModePromptPreset?.conversationPrompt ?? ""}
                  onCustomPromptChange={(id, customSystemPrompt) => updateMeta.mutate({ id, customSystemPrompt })}
                  onPromptPresetChange={handleModePromptPresetChange}
                />
              </div>
            )}

            {modeSettingsSurfaces.promptSettingsSurface === "game" && (
              <div style={{ order: CHAT_SETTINGS_ORDER.promptPreset }}>
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
              </div>
            )}

            {/* Combat Style — game mode only */}
            {isGame && (
              <CombatStyleSection
                style={{ order: CHAT_SETTINGS_ORDER.combatStyle }}
                combatStyle={effectiveCombatStyle}
                rulesetResolvesFights={rulesetResolvesFights}
                rulesetHasPositions={rulesetHasPositions}
                allowedStyles={allowedCombatStyles}
                onCombatStyleChange={(gameCombatStyle) => updateMeta.mutate({ id: chat.id, gameCombatStyle })}
                turnOrder={effectiveTurnOrder}
                onTurnOrderChange={(gameTacticalTurnOrder) => updateMeta.mutate({ id: chat.id, gameTacticalTurnOrder })}
              />
            )}

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
                style={{ order: CHAT_SETTINGS_ORDER.characters + 1 }}
                label={localizeUi("chat.settings.ruleset.label")}
                icon={<Dices size="0.875rem" />}
                help={localizeUi("chat.settings.ruleset.help")}
              >
                <RoleplayRulesetSettings chatId={chat.id} metadata={metadata} />
              </Section>
            )}

            {/* Card field alternatives — hidden when no card in this chat has any */}
            <CardFieldAlternativesSection
              chat={chat}
              characters={characters}
              personas={personas}
              style={{ order: CHAT_SETTINGS_ORDER.cardFieldAlternatives }}
            />

            {/* Scoped Regex Scripts — only shown when a chat character has scoped scripts */}
            <ScopedRegexSection
              sectionId={`${chatMode}-scoped-regex`}
              order={CHAT_SETTINGS_ORDER.scopedRegex}
              chat={chat}
              chatCharIds={chatCharIds}
              scopedRegexMode={scopedRegexMode}
              inheritsScopedRegexMode={inheritsScopedRegexMode}
              presetScopedRegexMode={presetScopedRegexMode}
            />

            <ChatVariablesSection
              key={chat.id}
              sectionId={`${chatMode}-chat-variables`}
              order={CHAT_SETTINGS_ORDER.chatVariables}
              chatId={chat.id}
              variables={chatMacroVariables}
            />

            {/* Every existing and new multi-character chat gets this section. Missing mode metadata means Grouped. */}
            <GroupChatSection
              sectionId={`${chatMode}-group-chat`}
              order={CHAT_SETTINGS_ORDER.groupChat}
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

            {/* Conversation feature packages expose commands and settings as soon as they are installed. */}
            {modeSettingsSurfaces.agentSettingsSurface === "conversation" && (
              <ConversationAgentsSection
                order={CHAT_SETTINGS_ORDER.agents}
                agents={chatAgents}
                chat={chat}
                metadata={metadata}
                activeAgentIds={activeAgentIds}
                textConnectionsList={textConnectionsList}
                requestClose={requestClose}
                rememberSettingsReturn={rememberSettingsReturn}
                renderAgentLorebookAttachment={renderAgentLorebookAttachment}
                renderIllustratorPromptConnectionSelect={renderIllustratorPromptConnectionSelect}
                renderIllustratorImageStyleSelect={renderIllustratorImageStyleSelect}
                renderIllustratorImagesPerGeneration={renderIllustratorImagesPerGeneration}
                renderIllustratorVideoRunInterval={renderIllustratorVideoRunInterval}
                renderCustomAgentPicker={renderCustomAgentPicker}
                renderActiveCustomAgentSettingsCard={renderActiveCustomAgentSettingsCard}
                renderHapticSettingsCard={renderHapticSettingsCard}
              />
            )}

            <ConnectedChatsSection
              order={CHAT_SETTINGS_ORDER.connectedChat}
              chat={chat}
              metadata={metadata}
              chatMode={chatMode}
              allChats={allChats as Chat[] | undefined}
              noodleInstalled={isCapabilityPackageAvailable(installedCapabilities, "noodle")}
              slurp2Installed={isCapabilityPackageAvailable(installedCapabilities, "slurp2")}
            />

            {/* Notes from Conversation — durable notes saved by the connected conversation's character */}
            {!isConversation && chat.connectedChatId && (
              <div style={{ order: CHAT_SETTINGS_ORDER.connectedNotes }}>
                <ConversationNotesSection chatId={chat.id} />
              </div>
            )}

            {/* On the phone's quick page too: a lorebook is something a chat turns on and off often. */}
            <div data-ovm-quick="true" style={{ order: CHAT_SETTINGS_ORDER.lorebooks }}>
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
                          activeLorebooks.find((lorebook) => lorebook.id === inlineResourceEditor.id)?.name ??
                          "Lorebook"
                        }
                        characterRows={characters}
                        onClose={() => setInlineResourceEditor(null)}
                      />
                    </Suspense>
                  ) : null
                }
              />
            </div>

            {chatTools?.summary && (
              <Section
                id={`${chatMode}-chat-summary`}
                style={{ order: CHAT_SETTINGS_ORDER.chatSummary }}
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
                style={{ order: CHAT_SETTINGS_ORDER.activeContext }}
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

            {chatTools?.authorNotes && (
              <Section
                id={`${chatMode}-author-notes`}
                style={{ order: CHAT_SETTINGS_ORDER.authorNotes }}
                label={localizeUi("chat.settings.authorNotes")}
                icon={<PenLine size="0.875rem" />}
                help={localizeUi("chat.settings.authorNotesHelp")}
                fill
              >
                {chatTools.authorNotes}
              </Section>
            )}

            {chatTools && (
              <Section
                id={`${chatMode}-gallery`}
                style={{ order: CHAT_SETTINGS_ORDER.gallery }}
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

            {/* Agent activity: its own section right below Agents, while agents or Advanced Memory run. */}
            {chatTools &&
              isRoleplayMode &&
              (metadata.enableAgents === true || metadata.advancedMemory?.enabled === true) && (
                <Section
                  id={`${chatMode}-agent-activity`}
                  style={{ order: CHAT_SETTINGS_ORDER.agentActivity }}
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

            {/* Agents */}
            {modeSettingsSurfaces.agentSettingsSurface === "generation" && (
              <Section
                id={`${chatMode}-agents`}
                forceOpen={initialAgentId !== null}
                style={{ order: CHAT_SETTINGS_ORDER.agents }}
                label={localizeUi("navigation.topbar.agents")}
                icon={<Sparkles size="0.875rem" />}
                count={isGame ? gameAgentFeatureCount : visibleActiveAgentIds.length}
                help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledAiAgentsRunAutomaticallyDuringGenerationTo")}
              >
                {isRoleplayMode && (
                  <RoleplayCommandsSettings
                    chat={chat}
                    installedAgentIds={
                      new Set(availableAgents.filter((agent) => !agent.runtimeDisabled).map((agent) => agent.id))
                    }
                    characters={chatCharacters.map((character) => ({
                      id: character.id,
                      name: JSON.parse(character.data).name || character.id,
                    }))}
                    audioConnections={filterAudioGenerationConnections(
                      (connections ?? []) as Array<{
                        id: string;
                        name: string;
                        provider: string;
                        audioGenerationSource?: string | null;
                        audioGenerationLegacyConnectionId?: string | null;
                        audioSoundEffects?: string | boolean;
                        audioSoundEffectsEndpoint?: string | null;
                        profileImportReviewRequired?: unknown;
                      }>,
                    ).filter((connection) => audioConnectionSupportsGeneration(connection, "sfx"))}
                  />
                )}
                {isGame && (
                  <SettingsSwitch
                    label={localizeUi("chat.settings.game.sequentialTasks")}
                    description={localizeUi("chat.settings.game.sequentialTasksHelp")}
                    checked={metadata.gameSequentialAgents === true}
                    onChange={(gameSequentialAgents) => updateMeta.mutate({ id: chat.id, gameSequentialAgents })}
                    labelPosition="start"
                    className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
                    labelClassName="text-xs font-medium"
                  />
                )}
                {availableAgents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-5 text-center">
                    <p className="text-xs font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.noAgentsDownloadedYet")}
                    </p>
                    <p className="mx-auto mt-1 max-w-[32rem] text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.downloadOptionalAgentsToAddTrackersWritersMapsAnd")}{" "}
                      {isGame
                        ? localizeUi("ui.chat.chatsettingsdrawer.game")
                        : localizeUi("ui.chat.chatsettingsdrawer.roleplay")}
                      .
                    </p>
                    <button
                      type="button"
                      onClick={openDownloadAgents}
                      className="mari-chrome-control mari-chrome-control--primary mx-auto mt-3 px-4 py-2 text-xs"
                    >
                      <Sparkles size="0.8125rem" />
                      {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isGame && metadata.enableAgents && (
                      <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.toggleSceneAnalysisAndCustomAgentsForThisGame")}
                      </p>
                    )}
                    <SettingsSwitch
                      label={localizeUi("ui.chat.chatsettingsdrawer.enableAgents")}
                      description={
                        <>
                          <span className="block">
                            {isGame
                              ? localizeUi(
                                  "ui.chat.chatsettingsdrawer.runSceneAnalysisAndAnyAttachedCustomAgentsDuring",
                                )
                              : localizeUi(
                                  "ui.chat.chatsettingsdrawer.runAiAgentsDuringGenerationWorldStateExpressionsEtc",
                                )}
                          </span>
                          {isGame &&
                            metadata.enableAgents &&
                            (() => {
                              const setupCfg = metadata.gameSetupConfig as Record<string, unknown> | undefined;
                              const sceneConnId =
                                (metadata.gameSceneConnectionId as string) ||
                                (setupCfg?.sceneConnectionId as string) ||
                                null;
                              const sceneConn = sceneConnId
                                ? ((connections ?? []) as Array<{ id: string; name: string; model?: string }>).find(
                                    (connection) => connection.id === sceneConnId,
                                  )
                                : null;
                              const connectionLabel = sceneConn
                                ? `${sceneConn.name}${sceneConn.model ? ` — ${sceneConn.model}` : ""}`
                                : "Local sidecar (Gemma)";
                              return <span className="mt-0.5 block text-[var(--primary)]/70">{connectionLabel}</span>;
                            })()}
                        </>
                      }
                      checked={metadata.enableAgents === true}
                      onChange={(enabled) => updateMeta.mutate({ id: chat.id, enableAgents: enabled })}
                      labelPosition="start"
                      className={cn(
                        "justify-between rounded-lg px-3 py-2.5 text-left",
                        metadata.enableAgents
                          ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                          : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                      )}
                      labelClassName="text-xs font-medium"
                    />
                    {roleplayAgentMenuLinks.length > 0 && (
                      <div
                        data-agent-menus
                        className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]"
                      >
                        <div className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                          <ChevronRight size="0.6875rem" className="shrink-0" />
                          <span>{localizeUi("ui.chat.chatsettingsdrawer.agentMenus")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {roleplayAgentMenuLinks.map((link) => (
                            <button
                              key={link.id}
                              type="button"
                              onClick={() => scrollToAgentMenu(link.targetId)}
                              className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/60"
                              title={localizeUi("ui.chat.chatsettingsdrawer.jumpToValue1", { value1: link.label })}
                            >
                              {renderRoleplayAgentMenuIcon(link.id, "chip")}
                              <span className="min-w-0 truncate">{link.label}</span>
                              {link.count != null && (
                                <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)]">
                                  {link.count}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {isRoleplayMode ? (
                      <div data-trackers-control>
                        <AgentSettingsCard
                          id={`${chat.id}:trackers-control`}
                          icon={<Radar size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                          title={localizeUi("chat.settings.agents.trackersControl")}
                          description={localizeUi("chat.settings.agents.trackersControlHelp")}
                          initialOpen={false}
                        >
                          <AgentSettingsToggle
                            label={localizeUi("chat.settings.agents.attachSummaries")}
                            description={localizeUi("chat.settings.agents.attachSummariesHelp")}
                            enabled={metadata.attachSummariesToAgents === true}
                            onToggle={() =>
                              updateMeta.mutate({
                                id: chat.id,
                                attachSummariesToAgents: metadata.attachSummariesToAgents !== true,
                              })
                            }
                          />
                          {/* Manual trackers run only in roleplay-style chats. */}
                          {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.attachLorebooksToTrackers")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.attachLorebooksToTrackersDescription",
                              )}
                              enabled={metadata.attachLorebooksToTrackers === true}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  attachLorebooksToTrackers: !metadata.attachLorebooksToTrackers,
                                })
                              }
                            />
                          )}
                          {renderReviewAgentOutputsToggle("card")}
                          {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                            <div className="space-y-1.5 rounded-lg bg-[var(--background)]/45 p-2 ring-1 ring-[var(--border)]">
                              <span className="block px-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.individualTrackerSchedule")}
                              </span>
                              <div className="space-y-1">
                                {activeTrackerAgents.map((agent) => {
                                  const manuallyTriggered = activeManualTrackerTypes.has(agent.id);
                                  return (
                                    <SettingsSwitch
                                      key={agent.id}
                                      label={
                                        <span className="flex min-w-0 items-center gap-2">
                                          <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" />
                                          <span className="min-w-0">
                                            <span className="block truncate text-[0.625rem] font-medium">
                                              {agent.name}
                                            </span>
                                            <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                                              {manuallyTriggered
                                                ? localizeUi("ui.chat.chatsettingsdrawer.runsOnlyFromHudControls")
                                                : localizeUi("ui.chat.chatsettingsdrawer.runsAutomatically")}
                                            </span>
                                          </span>
                                        </span>
                                      }
                                      checked={manuallyTriggered}
                                      onChange={() => toggleManualTrackerAgent(agent.id)}
                                      labelPosition="start"
                                      className={cn(
                                        "justify-between rounded-md px-2 py-1.5 text-left",
                                        manuallyTriggered
                                          ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/25"
                                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                                      )}
                                      labelClassName="min-w-0"
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </AgentSettingsCard>
                      </div>
                    ) : (
                      renderReviewAgentOutputsToggle("secondary")
                    )}
                    {isRoleplayMode && (activeGeneration || stoppingGeneration) && (
                      <button
                        type="button"
                        onClick={() => void handleStopActiveGeneration()}
                        disabled={stoppingGeneration}
                        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[0.6875rem] font-medium">
                            {stoppingGeneration
                              ? localizeUi("ui.chat.chatsettingsdrawer.stoppingGeneration")
                              : localizeUi("ui.chat.chatsettingsdrawer.stopActiveGeneration")}
                          </span>
                          <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.stopActiveGenerationDescription")}
                          </p>
                        </div>
                        {stoppingGeneration ? (
                          <Loader2 size="0.8125rem" className="shrink-0 animate-spin text-[var(--muted-foreground)]" />
                        ) : (
                          <X size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => openAgentSuite(true)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[0.6875rem] font-medium">
                          {localizeUi("ui.chat.agentsuitemodal.agentSuite")}
                        </span>
                        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.viewAndEditEverythingAgentsHaveStoredInThis")}
                        </p>
                      </div>
                      <div className="flex h-5 w-9 shrink-0 items-center justify-center text-[var(--muted-foreground)]">
                        <Wrench size="0.75rem" />
                      </div>
                    </button>
                    {isGame && metadata.enableAgents && (
                      <div className="mt-1.5 px-3">
                        <ConnectionSelect
                          job={t("connections.picker.job.sceneEffects")}
                          value={(metadata.gameSceneConnectionId as string) || null}
                          onChange={(connectionId) =>
                            updateMeta.mutate({ id: chat.id, gameSceneConnectionId: connectionId })
                          }
                          inherits={
                            import.meta.env.VITE_MARINARA_LITE === "true"
                              ? { connectionId: chat.connectionId ?? null }
                              : undefined
                          }
                          // Lite has no sidecar; an empty scene connection falls back to the chat's own.
                          defaultLabel={
                            import.meta.env.VITE_MARINARA_LITE === "true"
                              ? t("connections.select.default")
                              : localizeUi("ui.chat.chatsettingsdrawer.localSidecarGemma")
                          }
                          includeLocalSidecar={import.meta.env.VITE_MARINARA_LITE !== "true"}
                        />
                      </div>
                    )}

                    {isGame && (
                      <AgentSettingsCard
                        icon={<BookOpen size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                        title={lorebookKeeperAgentMeta.name}
                        description={lorebookKeeperAgentMeta.description}
                      >
                        <AgentSettingsToggle
                          label={localizeUi("ui.chat.chatsettingsdrawer.gameSessionKeeper")}
                          description={localizeUi("ui.chat.chatsettingsdrawer.gameModeRunsThisAfterASessionEndsWith")}
                          enabled={gameLorebookKeeperEnabled}
                          onToggle={toggleGameLorebookKeeper}
                        />
                        {gameLorebookKeeperLorebook && (
                          <p className="truncate rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                            {localizeUi("ui.chat.chatsettingsdrawer.target")}{" "}
                            <span className="font-medium text-[var(--foreground)]">
                              {gameLorebookKeeperLorebook.name}
                            </span>
                          </p>
                        )}
                      </AgentSettingsCard>
                    )}

                    {isGame && (
                      <AgentSettingsCard
                        icon={<Music2 size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                        title={musicDjAgentMeta.name}
                        description={musicDjAgentMeta.description}
                      >
                        <AgentSettingsToggle
                          label={localizeUi("ui.chat.chatsettingsdrawer.musicDj")}
                          description={localizeUi("ui.chat.chatsettingsdrawer.activePlayerValue1", {
                            value1: getMusicProviderLabel(musicPlayerSource),
                          })}
                          enabled={gameMusicDjEnabled}
                          onToggle={() => void toggleGameMusicDj()}
                        />

                        <AgentSettingsSegmentedControl<MusicProvider>
                          value={musicPlayerSource}
                          columns={3}
                          options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                            id: provider,
                            label: getMusicProviderLabel(provider),
                          }))}
                          onChange={(provider) => void changeMusicDjProvider(provider)}
                        />

                        {gameMusicDjEnabled && musicPlayerSource === "spotify" && (
                          <div className="space-y-2">
                            <SpotifySourceSettings
                              chat={chat}
                              metadata={metadata}
                              keys={GAME_SPOTIFY_KEYS}
                              sourceType={gameSpotifySourceType}
                              playlistId={gameSpotifyPlaylistId}
                              artistDraft={gameSpotifyArtistDraft}
                              setArtistDraft={setGameSpotifyArtistDraft}
                              playlistsQuery={spotifyPlaylistsQuery}
                            />
                          </div>
                        )}

                        {gameMusicDjEnabled &&
                          musicPlayerSource === "custom" &&
                          renderCustomMusicLibrarySettings("game")}
                      </AgentSettingsCard>
                    )}

                    {isGame && avatarLayoutCard}

                    {!isGame && (
                      <div className="flex flex-col gap-2">
                        {metadata.enableAgents && !isGame && lorebookKeeperActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "lorebook-keeper")}
                            icon={renderRoleplayAgentMenuIcon("lorebook-keeper")}
                            title={lorebookKeeperAgentMeta.name}
                            description={lorebookKeeperAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("lorebook-keeper")}
                            onRemove={getRoleplayAgentMenuRemoveHandler(
                              "lorebook-keeper",
                              lorebookKeeperAgentMeta.name,
                            )}
                          >
                            {renderAgentLorebookAttachment("lorebook-keeper")}
                            <LorebookKeeperSettings
                              chat={chat}
                              lorebookKeeperTargetLorebookId={lorebookKeeperTargetLorebookId}
                              lorebookKeeperReadBehindMessages={lorebookKeeperReadBehindMessages}
                              lorebooks={lorebooks}
                              agentProcessing={agentProcessing}
                              closeForSurface={closeForSurface}
                              handleLorebookKeeperBackfill={handleLorebookKeeperBackfill}
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && !isGame && cardEvolutionAuditorActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "card-evolution-auditor")}
                            icon={renderRoleplayAgentMenuIcon("card-evolution-auditor")}
                            title={cardEvolutionAuditorAgentMeta.name}
                            description={cardEvolutionAuditorAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("card-evolution-auditor")}
                            onRemove={getRoleplayAgentMenuRemoveHandler(
                              "card-evolution-auditor",
                              cardEvolutionAuditorAgentMeta.name,
                            )}
                          >
                            {renderAgentLorebookAttachment("card-evolution-auditor")}
                            <CardEvolutionAuditorSettings closeForSurface={closeForSurface} />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && !isGame && proseGuardianActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "prose-guardian")}
                            icon={renderRoleplayAgentMenuIcon("prose-guardian")}
                            title={proseGuardianAgentMeta.name}
                            description={proseGuardianAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("prose-guardian")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("prose-guardian", proseGuardianAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("prose-guardian")}
                            <AgentSettingsTextarea
                              label={localizeUi("ui.agents.agenteditor.bannedWords")}
                              value={proseGuardianBannedDraft}
                              placeholder={DEFAULT_PROSE_GUARDIAN_BANNED_WORDS}
                              rows={2}
                              onChange={setProseGuardianBannedDraft}
                              onBlur={() => {
                                if (proseGuardianBannedDraft !== proseGuardianBannedWords) {
                                  commitProseGuardianSettings({
                                    proseGuardianBannedWords: proseGuardianBannedDraft.trim(),
                                  });
                                }
                              }}
                            />
                            <AgentSettingsTextarea
                              label={localizeUi("ui.agents.agenteditor.removeFromWriting")}
                              value={proseGuardianAvoidDraft}
                              placeholder={DEFAULT_PROSE_GUARDIAN_AVOID}
                              rows={3}
                              onChange={setProseGuardianAvoidDraft}
                              onBlur={() => {
                                if (proseGuardianAvoidDraft !== proseGuardianAvoidInstructions) {
                                  commitProseGuardianSettings({
                                    proseGuardianAvoidInstructions: proseGuardianAvoidDraft.trim(),
                                  });
                                }
                              }}
                            />
                            <AgentSettingsTextarea
                              label={localizeUi("ui.agents.agenteditor.preferInWriting")}
                              value={proseGuardianStyleDraft}
                              placeholder={localizeUi(
                                "ui.agents.agenteditor.optionalStyleNotesPhrasesOrAuthorialPreferences",
                              )}
                              rows={3}
                              onChange={setProseGuardianStyleDraft}
                              onBlur={() => {
                                if (proseGuardianStyleDraft !== proseGuardianStyleInstructions) {
                                  commitProseGuardianSettings({
                                    proseGuardianStyleInstructions: proseGuardianStyleDraft.trim(),
                                  });
                                }
                              }}
                            />
                            <HoldForRewriteToggle
                              enabled={proseGuardianHoldForRewrite}
                              onToggle={() =>
                                commitProseGuardianSettings({
                                  proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite,
                                })
                              }
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && !isGame && directorActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "director")}
                            icon={renderRoleplayAgentMenuIcon("director")}
                            title={directorAgentMeta.name}
                            description={directorAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("director")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("director", directorAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("director")}
                            <DirectorSettings
                              chat={chat}
                              agentProcessing={agentProcessing}
                              supportsNarrativeDirectorSecretPlot={supportsNarrativeDirectorSecretPlot}
                              narrativeDirectorSecretPlotEnabled={narrativeDirectorSecretPlotEnabled}
                              narrativeDirectorSecretPlotRunInterval={narrativeDirectorSecretPlotRunInterval}
                              secretPlotMessages={secretPlotMessages}
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && !isGame && continuityActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "continuity")}
                            icon={renderRoleplayAgentMenuIcon("continuity")}
                            title={continuityAgentMeta.name}
                            description={continuityAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("continuity")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("continuity", continuityAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("continuity")}
                            <HoldForRewriteToggle
                              enabled={proseGuardianHoldForRewrite}
                              onToggle={() =>
                                commitProseGuardianSettings({
                                  proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite,
                                })
                              }
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && !isGame && htmlActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "html")}
                            icon={renderRoleplayAgentMenuIcon("html")}
                            title={htmlAgentMeta.name}
                            description={htmlAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("html")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("html", htmlAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("html")}
                            <HoldForRewriteToggle
                              enabled={proseGuardianHoldForRewrite}
                              onToggle={() =>
                                commitProseGuardianSettings({
                                  proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite,
                                })
                              }
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && isRoleplayMode && knowledgeRetrievalActive && (
                          <KnowledgeAgentSettingsCard
                            attachment={renderAgentLorebookAttachment("knowledge-retrieval")}
                            id={getAgentSettingsMenuId(chat.id, "knowledge-retrieval")}
                            agentType="knowledge-retrieval"
                            title={knowledgeRetrievalAgentMeta.name}
                            description={knowledgeRetrievalAgentMeta.description}
                            lorebooks={(lorebooks ?? []) as Lorebook[]}
                            settings={getKnowledgeAgentSourceSettings("knowledge-retrieval")}
                            order={getRoleplayAgentSettingsOrder("knowledge-retrieval")}
                            onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-retrieval", patch)}
                            onRemove={getRoleplayAgentMenuRemoveHandler(
                              "knowledge-retrieval",
                              knowledgeRetrievalAgentMeta.name,
                            )}
                          />
                        )}

                        {metadata.enableAgents && isRoleplayMode && knowledgeRouterActive && (
                          <KnowledgeAgentSettingsCard
                            attachment={renderAgentLorebookAttachment("knowledge-router")}
                            id={getAgentSettingsMenuId(chat.id, "knowledge-router")}
                            agentType="knowledge-router"
                            title={knowledgeRouterAgentMeta.name}
                            description={knowledgeRouterAgentMeta.description}
                            lorebooks={(lorebooks ?? []) as Lorebook[]}
                            settings={getKnowledgeAgentSourceSettings("knowledge-router")}
                            order={getRoleplayAgentSettingsOrder("knowledge-router")}
                            onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-router", patch)}
                            onRemove={getRoleplayAgentMenuRemoveHandler(
                              "knowledge-router",
                              knowledgeRouterAgentMeta.name,
                            )}
                          />
                        )}

                        {standaloneRoleplayAgents.map(renderStandaloneRoleplayAgentSettingsCard)}

                        {metadata.enableAgents && !isGame && expressionActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "expression")}
                            icon={renderRoleplayAgentMenuIcon("expression")}
                            title={expressionAgentMeta.name}
                            description={expressionAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("expression")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("expression", expressionAgentMeta.name)}
                            badge={
                              spriteCharacterIds.length > 0 ? (
                                <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
                                  {spriteCharacterIds.length} {localizeUi("ui.chat.chatsettingsdrawer.enabled")}
                                </span>
                              ) : null
                            }
                          >
                            {renderAgentLorebookAttachment("expression")}
                            <ExpressionSpriteSettings
                              chatId={chat.id}
                              displayModes={spriteDisplayModes}
                              onToggleDisplayMode={toggleSpriteDisplayMode}
                              onlyActiveSprites={metadata.expressionOnlyActiveSprites === true}
                              onToggleOnlyActiveSprites={
                                isRoleplayMode
                                  ? () =>
                                      updateMeta.mutate({
                                        id: chat.id,
                                        expressionOnlyActiveSprites: metadata.expressionOnlyActiveSprites !== true,
                                      })
                                  : undefined
                              }
                              expressionAvatarsEnabled={expressionAvatarsEnabled}
                              onToggleExpressionAvatars={() => {
                                const nextEnabled = !expressionAvatarsEnabled;
                                if (onSpriteVisualSettingsChange) {
                                  onSpriteVisualSettingsChange({ expressionAvatarsEnabled: nextEnabled });
                                  return;
                                }
                                updateMeta.mutate({ id: chat.id, expressionAvatarsEnabled: nextEnabled });
                              }}
                              ownerCount={chatSpriteSubjects.length}
                              ownersLoading={chatSpriteSubjectsLoading}
                              choicesLoading={chatSpriteChoicesLoading}
                              owners={chatSpriteSubjectsWithSprites.map((subject) => {
                                const isPersona = subject.kind === "persona";
                                return {
                                  id: subject.id,
                                  kind: subject.kind,
                                  name: isPersona ? subject.persona.name : charName(subject.character),
                                  title: isPersona
                                    ? subject.persona.comment || "Persona"
                                    : charTitle(subject.character),
                                  avatarPath: isPersona ? subject.persona.avatarPath : subject.character.avatarPath,
                                  avatarCrop: isPersona
                                    ? (subject.persona.avatarCrop ?? null)
                                    : (getCharacterInfo(subject.character).avatarCrop ?? null),
                                  active: spriteCharacterIds.includes(subject.id),
                                };
                              })}
                              onOpenOwner={(kind, id) => {
                                closeForSurface();
                                if (kind === "persona") {
                                  useUIStore.getState().openPersonaDetail(id);
                                } else {
                                  useUIStore.getState().openCharacterDetail(id);
                                }
                              }}
                              onToggleOwner={toggleSprite}
                              enabledOwnerCount={spriteCharacterIds.length}
                              layoutSubjects={spriteLayoutSubjects}
                              selectedLayoutSubjectId={selectedSpriteLayoutCharacterId}
                              onSelectLayoutSubject={setSelectedSpriteLayoutCharacterId}
                              selectedLayoutSubjectHasOverride={Boolean(selectedSpriteCharacterVisualSettings)}
                              onResetSelectedLayoutSubject={resetSelectedSpriteCharacterVisualSettings}
                              spriteArrangeMode={spriteArrangeMode}
                              onToggleSpriteArrange={onToggleSpriteArrange}
                              hasCustomSpritePlacements={hasCustomSpritePlacements}
                              onResetSpritePlacements={resetSpritePlacements}
                              spritePosition={editedSpritePosition}
                              onSpritePositionChange={setSpriteSide}
                              expressionSpriteScalePercent={expressionSpriteScalePercent}
                              fullBodySpriteScalePercent={fullBodySpriteScalePercent}
                              expressionSpriteOpacityPercent={expressionSpriteOpacityPercent}
                              fullBodySpriteOpacityPercent={fullBodySpriteOpacityPercent}
                              onExpressionSpriteScaleChange={setExpressionSpriteScale}
                              onFullBodySpriteScaleChange={setFullBodySpriteScale}
                              onExpressionSpriteOpacityChange={setExpressionSpriteOpacity}
                              onFullBodySpriteOpacityChange={setFullBodySpriteOpacity}
                            />
                          </AgentSettingsCard>
                        )}

                        {avatarLayoutCard}

                        {metadata.enableAgents && isRoleplayMode && echoChamberActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "echo-chamber")}
                            icon={renderRoleplayAgentMenuIcon("echo-chamber")}
                            title={echoChamberAgentMeta.name}
                            description={echoChamberAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("echo-chamber")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("echo-chamber", echoChamberAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("echo-chamber")}
                            <EchoChamberSettings
                              promptTemplateSelect={renderAgentPromptTemplateSelect("echo-chamber")}
                              closeForSurface={closeForSurface}
                            />
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && isRoleplayMode && illustratorActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "illustrator")}
                            icon={renderRoleplayAgentMenuIcon("illustrator")}
                            title={illustratorAgentMeta.name}
                            description={illustratorAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("illustrator")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("illustrator", illustratorAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("illustrator")}
                            {renderAgentPromptTemplateSelect("illustrator")}
                            {renderIllustratorPromptConnectionSelect()}
                            {renderIllustratorImageConnectionSelect()}
                            {/* Clips only runs on the Video Run Interval, shown with the clip settings. */}
                            {normalizeIllustratorVideoMode(metadata.illustratorVideoMode) !== "clips_only" &&
                              renderIllustratorRunInterval()}
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.generateSceneBackgrounds")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.whenTheStoryEntersANewLocationLetIllustrator",
                              )}
                              enabled={illustratorAutoBackgroundsEnabled}
                              onToggle={toggleIllustratorAutoBackgrounds}
                            />
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.weatherVersionsOfBackgrounds")}
                              description={localizeUi("ui.chat.chatsettingsdrawer.weatherVersionsOfBackgroundsHelp")}
                              enabled={illustratorWeatherBackgroundsEnabled}
                              onToggle={toggleIllustratorWeatherBackgrounds}
                            />
                            {illustratorWeatherBackgroundsEnabled && shownWeatherVersion && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.weatherArtTitle", {
                                    weather: shownWeatherVersion.replace(/-/gu, " "),
                                  })}
                                </span>
                                <div className="flex gap-1.5">
                                  {(["picture", "stencil", "no-stencil"] as const).map((part) => (
                                    <button
                                      key={part}
                                      type="button"
                                      disabled={remakingWeatherArt !== null}
                                      onClick={() => remakeWeatherArt(part)}
                                      className="mari-chrome-control mari-chrome-control--small min-w-0 flex-1 truncate text-[0.6875rem]"
                                    >
                                      {remakingWeatherArt === part
                                        ? localizeUi("ui.chat.chatsettingsdrawer.weatherArtRemaking")
                                        : localizeUi(WEATHER_ART_LABELS[part])}
                                    </button>
                                  ))}
                                </div>
                                <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.weatherArtHelp")}
                                </span>
                              </div>
                            )}
                            {renderIllustratorDecisionChecks()}
                            <PictureCheckFields chatId={chat.id} metadata={metadata} illustrator />
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.illustratorMakes")}
                              </span>
                              <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.illustratorMakesHelp")}
                              </span>
                              <select
                                value={normalizeIllustratorVideoMode(metadata.illustratorVideoMode)}
                                onChange={(e) =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    illustratorVideoMode: normalizeIllustratorVideoMode(e.target.value),
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                              >
                                {ILLUSTRATOR_VIDEO_MODES.map((mode) => (
                                  <option key={mode} value={mode}>
                                    {localizeUi(`ui.chat.chatsettingsdrawer.illustratorVideoMode.${mode}`)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {normalizeIllustratorVideoMode(metadata.illustratorVideoMode) !== "pictures" &&
                              renderIllustratorVideoRunInterval()}
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.videoFirstFrame")}
                              </span>
                              <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.roleplayVideoFirstFrameHelp")}
                              </span>
                              <select
                                value={normalizeVideoFirstFrame(
                                  metadata.sceneVideoFirstFrame,
                                  ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME,
                                )}
                                onChange={(e) =>
                                  updateMeta.mutate({
                                    id: chat.id,
                                    sceneVideoFirstFrame: normalizeVideoFirstFrame(e.target.value),
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                              >
                                {VIDEO_FIRST_FRAMES.map((mode) => (
                                  <option key={mode} value={mode}>
                                    {/* Send Avatar References for videos gives Prompt only the avatar to start from. */}
                                    {localizeUi(
                                      mode === "prompt_only" && metadata.illustratorVideoUseAvatarReferences === true
                                        ? "ui.chat.chatsettingsdrawer.videoFirstFrame.prompt_only_avatar"
                                        : `ui.chat.chatsettingsdrawer.roleplayVideoFirstFrame.${mode}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {renderIllustratorImageStyleSelect({
                              description:
                                "Shared by Illustrator scenes and generated backgrounds so both keep the same visual language.",
                            })}
                            {renderIllustratorImagesPerGeneration()}
                            <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.usesTheBackgroundResolutionFromSettingsGenerationsTrackerLocations",
                              )}
                            </p>
                            <MediaScopeSelect
                              label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                              description={localizeUi("ui.chat.chatsettingsdrawer.characterAppearanceScopeHelp")}
                              images={illustratorIncludeCharacterAppearance}
                              videos={metadata.illustratorVideoIncludeCharacterAppearance === true}
                              onChange={({ images, videos }) =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  illustratorIncludeCharacterAppearance: images,
                                  illustratorVideoIncludeCharacterAppearance: videos,
                                })
                              }
                              overridden={
                                typeof metadata.illustratorIncludeCharacterAppearance === "boolean" ||
                                metadata.illustratorVideoIncludeCharacterAppearance === true
                              }
                              onReset={resetIllustratorCharacterAppearance}
                            />
                            <MediaScopeSelect
                              label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                              description={localizeUi("ui.chat.chatsettingsdrawer.roleplayAvatarReferencesScopeHelp")}
                              images={illustratorUseAvatarReferences}
                              videos={metadata.illustratorVideoUseAvatarReferences === true}
                              onChange={({ images, videos }) =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  illustratorUseAvatarReferences: images,
                                  illustratorVideoUseAvatarReferences: videos,
                                })
                              }
                              overridden={
                                typeof metadata.illustratorUseAvatarReferences === "boolean" ||
                                metadata.illustratorVideoUseAvatarReferences === true
                              }
                              onReset={resetIllustratorAvatarReferences}
                            />
                            {illustratorUseAvatarReferences && (
                              <AgentChoiceSelect
                                label={localizeUi("ui.agents.agenteditor.referencePictureTarget")}
                                description={localizeUi(
                                  `ui.agents.agenteditor.referencePictureTargetHelp.${illustratorReferencePictureTarget}`,
                                )}
                                value={illustratorReferencePictureTarget}
                                options={REFERENCE_PICTURE_TARGETS.map((target) => ({
                                  value: target,
                                  label: localizeUi(`ui.agents.agenteditor.referencePictureTargetOption.${target}`),
                                }))}
                                active
                                onChange={(target) =>
                                  updateMeta.mutate({ id: chat.id, illustratorReferencePictureTarget: target })
                                }
                                overridden={typeof metadata.illustratorReferencePictureTarget === "string"}
                                onReset={() =>
                                  updateMeta.mutate({ id: chat.id, illustratorReferencePictureTarget: null })
                                }
                              />
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                              <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                                {localizeUi(
                                  "ui.chat.chatsettingsdrawer.promptModeControlsHowIllustratorWritesImagePromptsFor",
                                )}
                              </p>
                              <AgentSettingsActionButton
                                onClick={() => {
                                  closeForSurface();
                                  useUIStore.getState().openAgentDetail("illustrator");
                                }}
                                className="shrink-0"
                              >
                                <Settings2 size="0.75rem" />
                                <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
                              </AgentSettingsActionButton>
                            </div>
                            {illustratorInstalled && (
                              <AgentSettingsSubsection
                                id="scene-videos"
                                title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                                description={localizeUi(
                                  "ui.chat.chatsettingsdrawer.generateManualMp4SceneVideosFromGalleryImages",
                                )}
                              >
                                <label className="flex flex-col gap-1">
                                  <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                    {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                                  </span>
                                  <ConnectionSelect
                                    job={t("connections.picker.job.video")}
                                    value={(metadata.sceneVideoConnectionId as string) || null}
                                    onChange={(connectionId) =>
                                      updateMeta.mutate({ id: chat.id, sceneVideoConnectionId: connectionId })
                                    }
                                    kind="video"
                                    defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}
                                    inherits="main"
                                  />
                                </label>
                                {videoConnectionsList.length === 0 && <NeedsModelChip kind="video" />}
                                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                                  {localizeUi(
                                    "ui.chat.chatsettingsdrawer.galleryVideoAndImageAnimateUseThisConnectionWith",
                                  )}
                                </p>
                              </AgentSettingsSubsection>
                            )}
                          </AgentSettingsCard>
                        )}

                        {metadata.enableAgents && isRoleplayMode && spotifyActive && (
                          <AgentSettingsCard
                            id={getAgentSettingsMenuId(chat.id, "spotify")}
                            icon={renderRoleplayAgentMenuIcon("spotify")}
                            title={musicDjAgentMeta.name}
                            description={musicDjAgentMeta.description}
                            order={getRoleplayAgentSettingsOrder("spotify")}
                            onRemove={getRoleplayAgentMenuRemoveHandler("spotify", musicDjAgentMeta.name)}
                          >
                            {renderAgentLorebookAttachment("spotify")}
                            <p className="text-[0.55rem] text-[var(--muted-foreground)]/80">
                              {localizeUi("ui.chat.musicdjsetupfields.activePlayer")}{" "}
                              {getMusicProviderLabel(musicPlayerSource)}.
                            </p>

                            <AgentSettingsSegmentedControl<MusicProvider>
                              value={musicPlayerSource}
                              columns={3}
                              options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                                id: provider,
                                label: getMusicProviderLabel(provider),
                              }))}
                              onChange={(provider) => void changeMusicDjProvider(provider)}
                            />

                            {musicPlayerSource === "spotify" && (
                              <SpotifySourceSettings
                                chat={chat}
                                metadata={metadata}
                                keys={ROLEPLAY_SPOTIFY_KEYS}
                                sourceType={spotifySourceType}
                                playlistId={spotifyPlaylistId}
                                artistDraft={spotifyArtistDraft}
                                setArtistDraft={setSpotifyArtistDraft}
                                playlistsQuery={spotifyPlaylistsQuery}
                              />
                            )}

                            {musicPlayerSource === "custom" && renderCustomMusicLibrarySettings("roleplay")}

                            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {musicPlayerSource === "spotify"
                                ? localizeUi(
                                    "ui.chat.chatsettingsdrawer.roleplayDjQueuesSeveralFittingTracksWhenItChanges",
                                  )
                                : musicPlayerSource === "youtube"
                                  ? localizeUi("ui.chat.chatsettingsdrawer.youtubeModeUsesTheMusicDjAgentSYoutube")
                                  : effectiveCustomMusicSource === "folder"
                                    ? localizeUi(
                                        "ui.chat.chatsettingsdrawer.customModePicksFromTheSelectedDeviceFolderAnd",
                                      )
                                    : localizeUi(
                                        "ui.chat.chatsettingsdrawer.customModePicksFromLocalGameAssetsMusicAnd",
                                      )}
                            </p>
                          </AgentSettingsCard>
                        )}

                        {renderActiveCustomAgentSettingsCard()}
                      </div>
                    )}

                    {/* Haptic Feedback */}
                    {renderHapticSettingsCard()}

                    {/* Illustrator — game mode only */}
                    {isGame && (
                      <AgentSettingsCard
                        id={getAgentSettingsMenuId(chat.id, "illustrator")}
                        icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                        title={localizeUi("ui.chat.chatsettingsdrawer.illustrator")}
                        description={localizeUi(
                          "ui.chat.chatsettingsdrawer.autoGenerateSceneIllustrationsNpcPortraitsAndLocationBackgrounds",
                        )}
                      >
                        {renderAgentLorebookAttachment("illustrator")}
                        <GenerationSettingsLink
                          onClick={openGenerationSettings}
                          title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                          label={localizeUi("ui.chat.chatsettingsdrawer.imageGenerationSettings")}
                          description={localizeUi(
                            "ui.chat.chatsettingsdrawer.adjustGenerationBehaviorImageSizesAndStylesInSettings",
                          )}
                        />
                        <AgentSettingsToggle
                          label={localizeUi("ui.chat.chatsettingsdrawer.gameIllustrator")}
                          description={
                            metadata.enableSpriteGeneration
                              ? localizeUi("ui.chat.chatsettingsdrawer.illustratorIsEnabledForThisGame")
                              : localizeUi("ui.chat.chatsettingsdrawer.allowTheGameToRequestSceneImagesPortraitsAnd")
                          }
                          enabled={!!metadata.enableSpriteGeneration}
                          onToggle={() =>
                            updateMeta.mutate({ id: chat.id, enableSpriteGeneration: !metadata.enableSpriteGeneration })
                          }
                        />
                        {metadata.enableSpriteGeneration && (
                          <div className="space-y-2">
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.automaticVisuals")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.letGameModeAutomaticallyRequestBackgroundsNpcPortraitsAnd",
                              )}
                              enabled={gameImageAutoGenerationEnabled}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameImageAutoGenerationEnabled: !gameImageAutoGenerationEnabled,
                                })
                              }
                            />
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.dynamicLlmPromptGenerationForGmModeAssets")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.askThePromptModelToRewriteGameNpcPortrait",
                              )}
                              enabled={gameImageDynamicPromptEnabled}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameImageDynamicPromptEnabled: !gameImageDynamicPromptEnabled,
                                })
                              }
                            />
                            {renderIllustratorPromptConnectionSelect()}
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                              </span>
                              <ConnectionSelect
                                job={t("connections.picker.job.images")}
                                value={(metadata.gameImageConnectionId as string) || null}
                                onChange={(connectionId) =>
                                  updateMeta.mutate({ id: chat.id, gameImageConnectionId: connectionId })
                                }
                                kind="image"
                                defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectImageConnection")}
                                inherits="main"
                              />
                            </label>
                            {renderIllustratorImageStyleSelect({
                              emptyOptionLabel: "Use global or connection default",
                            })}
                            {renderIllustratorImagesPerGeneration()}
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.useCampaignArtStyle")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.addThisGameSSetupGeneratedArtDirectionAs",
                              )}
                              enabled={useCampaignArtStyle}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameSetupConfig: {
                                    ...gameSetupConfig,
                                    useCampaignArtStyle: !useCampaignArtStyle,
                                  },
                                })
                              }
                            />
                            {useCampaignArtStyle && (
                              <label className="flex flex-col gap-1">
                                <span className="flex items-center justify-between gap-2 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                  <span>{localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}</span>
                                  {generatedCampaignArtStyle &&
                                    generatedCampaignArtStyle !== campaignArtStyleDraft.trim() && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCampaignArtStyleDraft(generatedCampaignArtStyle);
                                          updateMeta.mutate({
                                            id: chat.id,
                                            gameSetupConfig: {
                                              ...gameSetupConfig,
                                              artStylePrompt: generatedCampaignArtStyle,
                                            },
                                          });
                                        }}
                                        className="rounded px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                                      >
                                        {localizeUi("ui.chat.chatsettingsdrawer.restoreSetupStyle")}
                                      </button>
                                    )}
                                </span>
                                <MacroTextarea
                                  value={campaignArtStyleDraft}
                                  onChange={setCampaignArtStyleDraft}
                                  onBlur={commitCampaignArtStyle}
                                  onExpandedClose={commitCampaignArtStyle}
                                  title={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                                  ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                                  placeholder={localizeUi(
                                    "ui.chat.chatsettingsdrawer.leaveBlankToUseOnlyTheSelectedImageStyle",
                                  )}
                                  rows={3}
                                  maxLength={500}
                                  className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                                />
                                <span className="text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
                                  {localizeUi("ui.chat.chatsettingsdrawer.generatedDuringGameSetupEditOrClearItHere")}
                                </span>
                              </label>
                            )}
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                              </span>
                              <MacroTextarea
                                value={gameImagePromptInstructionsDraft}
                                onChange={setGameImagePromptInstructionsDraft}
                                onBlur={commitGameImagePromptInstructions}
                                onExpandedClose={commitGameImagePromptInstructions}
                                title={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                                ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                                placeholder={localizeUi(
                                  "ui.chat.chatsettingsdrawer.eGDottoreSMaskCompletelyCoversHisEyes",
                                )}
                                rows={3}
                                maxLength={1200}
                                className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                              />
                            </label>
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.appendMatchedCharacterAppearanceDetailsToTheFinalScene",
                              )}
                              enabled={gameImageIncludeCharacterAppearance}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameImageIncludeCharacterAppearance: !gameImageIncludeCharacterAppearance,
                                })
                              }
                            />
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                              )}
                              enabled={gameImageUseAvatarReferences}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameImageUseAvatarReferences: !gameImageUseAvatarReferences,
                                })
                              }
                            />
                          </div>
                        )}
                        {illustratorInstalled && (
                          <div
                            data-agent-settings-feature-toggles="illustrator"
                            className="space-y-2 border-t border-[var(--border)] pt-3"
                          >
                            <AgentSettingsToggle
                              label={localizeUi("ui.chat.chatsettingsdrawer.enableSceneVideos")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.showSceneVideoControlsAndAllowManualVideoGeneration",
                              )}
                              enabled={gameSceneVideosEnabled}
                              onToggle={() =>
                                updateMeta.mutate({
                                  id: chat.id,
                                  gameSceneVideosEnabled: !gameSceneVideosEnabled,
                                })
                              }
                            />
                          </div>
                        )}
                        {illustratorInstalled && gameSceneVideosEnabled && (
                          <AgentSettingsSubsection
                            id="scene-videos"
                            title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                            description={localizeUi(
                              "ui.chat.chatsettingsdrawer.generateMp4SceneVideosFromGameIllustrations",
                            )}
                          >
                            <GenerationSettingsLink
                              onClick={openGenerationSettings}
                              title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                              label={localizeUi("ui.chat.chatsettingsdrawer.videoGenerationSettings")}
                              description={localizeUi(
                                "ui.chat.chatsettingsdrawer.adjustVideoModelsSizesAndPromptOverridesInSettings",
                              )}
                            />
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                                {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                              </span>
                              <ConnectionSelect
                                job={t("connections.picker.job.video")}
                                value={(metadata.gameVideoConnectionId as string) || null}
                                onChange={(connectionId) =>
                                  updateMeta.mutate({ id: chat.id, gameVideoConnectionId: connectionId })
                                }
                                kind="video"
                                defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}
                                inherits="main"
                              />
                            </label>
                            {videoConnectionsList.length === 0 && <NeedsModelChip kind="video" />}
                            <GamePromptTemplateSelect
                              label={localizeUi("ui.chat.chatsettingsdrawer.gameVideoPrompt")}
                              description={localizeUi("ui.chat.chatsettingsdrawer.usedForGameSceneVideos")}
                              options={gameVideoPromptOptions}
                              selectedId={selectedGameVideoPromptTemplateId}
                              fallbackId={GAME_VIDEO_PROMPT_TEMPLATE_ID}
                              onChange={updateGameVideoPromptSelection}
                            />
                            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {localizeUi(
                                "ui.chat.chatsettingsdrawer.sceneVideosUseTheLatestGeneratedSceneIllustrationAs",
                              )}
                            </p>
                          </AgentSettingsSubsection>
                        )}
                      </AgentSettingsCard>
                    )}

                    {/* Categorized agent sub-sections */}
                    {metadata.enableAgents && (
                      <>
                        {isGame ? (
                          <div className="space-y-1.5">
                            {gameAgentPool.length > 0 && (
                              <div className="space-y-1">
                                {gameAgentPool.map((agent) => {
                                  const active = activeAgentIds.includes(agent.id);
                                  const knowledgeAgentType = isKnowledgeAgentType(agent.id) ? agent.id : null;
                                  if (active && agent.id === "hierarchical-maps" && mapsPackage) {
                                    return (
                                      <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                        <AgentSettingsCard
                                          icon={<MapIcon size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                          title={agent.name}
                                          description={worldMapsSettingsDescription}
                                        >
                                          {renderAgentLorebookAttachment(agent.id)}
                                          <CapabilityElement
                                            packageId={mapsPackage.id}
                                            view="settings"
                                            capabilityProps={{
                                              chatId: chat.id,
                                              chatName: chat.name,
                                              chatMode,
                                              debugMode,
                                              enabledForChat: mapsPackageEnabledForChat,
                                              onEnabledForChatChange: setMapsEnabledForChat,
                                              confirmAction: showConfirmDialog,
                                              onDirtyChange: setEditorDirty,
                                              onOpenLorebook: openLorebookFromSettings,
                                              onLorebooksChanged: refreshLorebooks,
                                            }}
                                            className="block overflow-hidden rounded-lg"
                                          />
                                        </AgentSettingsCard>
                                      </div>
                                    );
                                  }
                                  if (active && agent.id === "long-term-memory" && ltmPackage) {
                                    return (
                                      <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                        <AgentSettingsCard
                                          icon={<Archive size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                          title={agent.name}
                                          description={getActiveAgentMenuDescription(agent.description)}
                                        >
                                          <LongTermMemoryCapabilitySettings
                                            chat={chat}
                                            metadata={metadata}
                                            packageId={ltmPackage.id}
                                            enabledForChat={
                                              metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)
                                            }
                                            setLtmEnabledForChat={setLtmEnabledForChat}
                                            requestClose={requestClose}
                                            rememberSettingsReturn={rememberSettingsReturn}
                                          />
                                        </AgentSettingsCard>
                                      </div>
                                    );
                                  }
                                  if (active && agent.id === STORYBOARD_AGENT_ID) {
                                    return (
                                      <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                        <AgentSettingsCard
                                          icon={renderRoleplayAgentMenuIcon(agent.id)}
                                          title={agent.name}
                                          description={getActiveAgentMenuDescription(agent.description)}
                                        >
                                          <Suspense fallback={null}>
                                            <StoryboardChatSettingsPanel
                                              chatId={chat.id}
                                              metadata={metadata as Record<string, unknown>}
                                              onClose={closeForSurface}
                                              ownerMode="game"
                                            />
                                          </Suspense>
                                        </AgentSettingsCard>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                                      <SettingsSwitch
                                        label={agent.name}
                                        description={getActiveAgentMenuDescription(agent.description) || undefined}
                                        checked={active}
                                        onChange={(nextActive) => {
                                          const latestActiveAgentIds = readLatestActiveAgentIds();
                                          if (!nextActive) {
                                            updateMeta.mutate({
                                              id: chat.id,
                                              activeAgentIds: latestActiveAgentIds.filter((id) => id !== agent.id),
                                            });
                                          } else {
                                            updateMeta.mutate({
                                              id: chat.id,
                                              enableAgents: true,
                                              activeAgentIds: Array.from(new Set([...latestActiveAgentIds, agent.id])),
                                            });
                                          }
                                        }}
                                        labelPosition="start"
                                        className={cn(
                                          "justify-between rounded-md px-3 py-2.5 text-left",
                                          active
                                            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                            : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                                        )}
                                        labelClassName="min-w-0 text-xs font-medium [&>span>label]:block [&>span>label]:truncate"
                                      />
                                      {active && !knowledgeAgentType && renderAgentLorebookAttachment(agent.id)}
                                      {active && knowledgeAgentType && (
                                        <KnowledgeAgentSettingsCard
                                          attachment={renderAgentLorebookAttachment(knowledgeAgentType)}
                                          agentType={knowledgeAgentType}
                                          title={agent.name}
                                          description={getActiveAgentMenuDescription(agent.description)}
                                          lorebooks={(lorebooks ?? []) as Lorebook[]}
                                          settings={getKnowledgeAgentSourceSettings(knowledgeAgentType)}
                                          onChange={(patch) =>
                                            updateKnowledgeAgentSourceSettings(knowledgeAgentType, patch)
                                          }
                                        />
                                      )}
                                      {active &&
                                        agent.id !== "illustrator" &&
                                        renderAgentPromptTemplateSelect(agent.id)}
                                      {active && agent.id === "illustrator" && (
                                        <AgentSettingsCard
                                          icon={<Paintbrush size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                          title={agent.name}
                                          description={getActiveAgentMenuDescription(agent.description)}
                                        >
                                          {renderAgentPromptTemplateSelect(agent.id)}
                                          {renderIllustratorPromptConnectionSelect()}
                                          {renderIllustratorImagesPerGeneration()}
                                          <AgentSettingsToggle
                                            label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                                            description={localizeUi(
                                              "ui.chat.agentaddsetupfields.appendMatchedCharacterAppearanceLinesToImagePromptsUsing",
                                            )}
                                            enabled={illustratorIncludeCharacterAppearance}
                                            onToggle={toggleIllustratorCharacterAppearance}
                                            overridden={
                                              typeof metadata.illustratorIncludeCharacterAppearance === "boolean"
                                            }
                                            onReset={resetIllustratorCharacterAppearance}
                                          />
                                          <AgentSettingsToggle
                                            label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                                            description={localizeUi(
                                              "ui.chat.agentaddsetupfields.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                                            )}
                                            enabled={illustratorUseAvatarReferences}
                                            onToggle={toggleIllustratorAvatarReferences}
                                            overridden={typeof metadata.illustratorUseAvatarReferences === "boolean"}
                                            onReset={resetIllustratorAvatarReferences}
                                          />
                                        </AgentSettingsCard>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {renderActiveCustomAgentSettingsCard()}
                          </div>
                        ) : (
                          <>
                            {/* Approximate per-turn cost of the active agent loadout. */}
                            <div
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.6875rem] ring-1",
                                agentLoadCost.cost.level === "high"
                                  ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30"
                                  : "bg-[var(--secondary)]/60 text-[var(--primary)] ring-[var(--border)]",
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                {agentLoadCost.cost.level === "high" && (
                                  <AlertTriangle size="0.75rem" className="shrink-0" />
                                )}
                                <span className="truncate">
                                  ~{agentLoadCost.cost.instructionTokens.toLocaleString()}{" "}
                                  {localizeUi("ui.chat.chatsettingsdrawer.tokensOfAgentInstructions")}
                                  {" · "}~{agentLoadCost.cost.extraCalls}{" "}
                                  {localizeUi("ui.chat.chatsettingsdrawer.extraCall")}
                                  {agentLoadCost.cost.extraCalls === 1
                                    ? ""
                                    : localizeUi("ui.noodle.stageprofileview.s")}
                                  {localizeUi("ui.chat.chatsettingsdrawer.turn")}
                                </span>
                              </span>
                              <HelpTooltip
                                text={localizeUi(
                                  "ui.chat.chatsettingsdrawer.approximateEachCallAlsoCarriesChatContextRecentMessages",
                                  { value1: AGENT_COST_HIGH_CALLS, value2: AGENT_COST_HIGH_TOKENS.toLocaleString() },
                                )}
                                className="-my-2 -mr-2 shrink-0"
                                buttonClassName="h-11 w-11 justify-center"
                                wide
                              />
                            </div>

                            {visibleActiveAgentIds.length === 0 && (
                              <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                                {localizeUi("ui.chat.chatsettingsdrawer.noAgentsAreActiveForThisChatYetAdd")}
                              </p>
                            )}

                            {/* Agent category sub-sections */}
                            {(
                              [
                                {
                                  key: "writer",
                                  label: "Writer Agents",
                                  icon: <Feather size="0.75rem" />,
                                  description:
                                    "Improve prose quality, maintain continuity, and shape the narrative direction of your roleplay.",
                                },
                                {
                                  key: "tracker",
                                  label: "Tracker Agents",
                                  icon: <Activity size="0.75rem" />,
                                  description:
                                    "Automatically track world state, character stats, quests, expressions, and other data that changes over time.",
                                },
                                {
                                  key: "misc",
                                  label: "Misc Agents",
                                  icon: <Puzzle size="0.75rem" />,
                                  description:
                                    "Specialized utilities — image generation, combat systems, music, summaries, and other extras.",
                                },
                              ] as const
                            ).map((cat) => {
                              const catAgents = availableAgents.filter((a) => a.category === cat.key);
                              const activeInCat = catAgents
                                .filter(
                                  (agent) =>
                                    activeAgentIds.includes(agent.id) && !standaloneRoleplayAgentIds.has(agent.id),
                                )
                                .sort(
                                  (a, b) => getRoleplayAgentSettingsOrder(a.id) - getRoleplayAgentSettingsOrder(b.id),
                                );
                              const inactiveInCat = catAgents.filter((a) => !activeAgentIds.includes(a.id));
                              if (catAgents.length === 0) return null;
                              return (
                                <AgentCategorySection
                                  key={cat.key}
                                  label={cat.label}
                                  icon={cat.icon}
                                  description={cat.description}
                                  count={activeInCat.length}
                                  openRequest={catAgents.some(
                                    (agent) =>
                                      !standaloneRoleplayAgentIds.has(agent.id) &&
                                      getAgentSettingsMenuId(chat.id, agent.id) === pendingAgentMenuTargetId,
                                  )}
                                >
                                  {/* Active agents in this category */}
                                  {activeInCat.length > 0 && (
                                    <div className="flex flex-col gap-1 mb-1.5">
                                      {activeInCat.map((agent) => {
                                        const tokenEst = agentLoadCost.tokensByType.get(agent.id);
                                        const hasSettingsTarget = chatSettingsPackageByAgentId.has(agent.id);
                                        return (
                                          <div
                                            key={agent.id}
                                            id={
                                              hasSettingsTarget ? getAgentSettingsMenuId(chat.id, agent.id) : undefined
                                            }
                                            tabIndex={hasSettingsTarget ? -1 : undefined}
                                            data-chat-agent-entry={agent.id}
                                            // The lorebook switch sits under the description with the prompt select's gap.
                                            className="scroll-mt-3 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/60 [&>[data-agent-lorebook-attachment]]:mt-2 [&>[data-agent-lorebook-package-update]]:mt-2"
                                          >
                                            <div className="flex items-start gap-2.5">
                                              <Sparkles
                                                size="0.875rem"
                                                className="mt-0.5 shrink-0 text-[var(--primary)]"
                                              />
                                              <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                  <span className="block min-w-0 truncate text-xs">{agent.name}</span>
                                                  {tokenEst != null ? (
                                                    <span
                                                      className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                                                      title={localizeUi(
                                                        "ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated",
                                                        { value1: tokenEst.toLocaleString() },
                                                      )}
                                                    >
                                                      ~{tokenEst.toLocaleString()}
                                                    </span>
                                                  ) : null}
                                                </div>
                                                <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                                  {agent.id === "hierarchical-maps"
                                                    ? worldMapsSettingsDescription
                                                    : agent.description}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  void toggleAgent(agent.id);
                                                }}
                                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                                title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                                              >
                                                <Trash2 size="0.6875rem" />
                                              </button>
                                            </div>
                                            {cat.key === "tracker" && renderAgentPromptTemplateSelect(agent.id)}
                                            {renderAgentLorebookAttachment(agent.id)}
                                            {renderDownloadedAgentChatSettings(agent)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {/* Available agents to add */}
                                  {inactiveInCat.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {inactiveInCat.map((agent) => (
                                        <button
                                          key={agent.id}
                                          onClick={() => openAgentAddModal(agent)}
                                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)] bg-[var(--secondary)]"
                                        >
                                          <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                                          <div className="flex-1 min-w-0">
                                            <span className="block truncate text-xs">{agent.name}</span>
                                            <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                              {agent.description}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
                                      {localizeUi("ui.chat.chatsettingsdrawer.allAgentsInThisCategoryAreActive")}
                                    </p>
                                  )}
                                </AgentCategorySection>
                              );
                            })}

                            {/* Custom agents */}
                            {renderCustomAgentPicker()}
                          </>
                        )}
                      </>
                    )}
                    {isGame && renderCustomAgentPicker({ showWhenEmpty: true })}
                  </div>
                )}
              </Section>
            )}

            {(isRoleplayMode || isGame) && (
              <Section
                id={`${chatMode}-background`}
                style={{ order: CHAT_SETTINGS_ORDER.background }}
                label={localizeUi("chat.settings.background")}
                icon={<Wallpaper size="0.875rem" />}
                help={localizeUi("chat.settings.backgroundHelp")}
              >
                <ActiveChatBackgroundPicker game={isGame} />
                {isRoleplayMode && <LocationBackgroundPins chatId={chat.id} metadata={chat.metadata} />}
              </Section>
            )}

            <ChatThemeSection chat={chat} style={{ order: CHAT_SETTINGS_ORDER.theme }} />

            {isGame && <GameWidgetsSection order={CHAT_SETTINGS_ORDER.widgets} chat={chat} metadata={metadata} />}

            {/* Memory Recall — conversation mode: placed before Function Calling by section order */}
            {isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
              <MemoryRecallSection {...memoryRecallSectionProps} />
            )}

            {/* Automatic Summarization — conversation mode only. Opens a modal to edit per-day and per-week summaries. */}
            {isConversation && (
              <AutomaticSummarizationSection
                chat={chat}
                metadata={metadata}
                setShowSummariesModal={openSummariesEditor}
                isGame={isGame}
              />
            )}

            <div style={{ order: CHAT_SETTINGS_ORDER.functionCalling }}>
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
                    chat.connectionId
                      ? connection.id === chat.connectionId
                      : isConnectionFlagTrue(connection.isDefault),
                  )?.provider
                }
                connections={textConnectionsList}
                toolConnectionId={(metadata.gameGmToolConnectionId as string) ?? ""}
                onToolConnectionChange={(gameGmToolConnectionId) =>
                  updateMeta.mutate({ id: chat.id, gameGmToolConnectionId })
                }
                gameLorebookSearch={metadata.gameLorebookSearch === true}
                onGameLorebookSearchChange={(gameLorebookSearch) =>
                  updateMeta.mutate({ id: chat.id, gameLorebookSearch })
                }
                gameDiceOutcomeNarration={metadata.gameDiceOutcomeNarration !== false}
                onGameDiceOutcomeNarrationChange={(gameDiceOutcomeNarration) =>
                  updateMeta.mutate({ id: chat.id, gameDiceOutcomeNarration })
                }
                gameOneRequestDice={metadata.gameOneRequestDice !== false}
                onGameOneRequestDiceChange={(gameOneRequestDice) =>
                  updateMeta.mutate({ id: chat.id, gameOneRequestDice })
                }
                gameDicePoolMode={metadata.gameDicePoolMode === true}
                onGameDicePoolModeChange={(gameDicePoolMode) => updateMeta.mutate({ id: chat.id, gameDicePoolMode })}
                gameDicePoolWindow={
                  typeof metadata.gameDicePoolWindow === "number"
                    ? metadata.gameDicePoolWindow
                    : DEFAULT_DICE_POOL_WINDOW
                }
                onGameDicePoolWindowChange={(gameDicePoolWindow) =>
                  updateMeta.mutate({ id: chat.id, gameDicePoolWindow })
                }
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
            </div>

            {/* Memory Recall — roleplay/game modes: placed before Function Calling by section order */}
            {!isConversation && import.meta.env.VITE_MARINARA_LITE !== "true" && (
              <MemoryRecallSection {...memoryRecallSectionProps} />
            )}

            <div style={{ order: CHAT_SETTINGS_ORDER.translation }}>
              <TranslationSection
                chatId={chat.id}
                metadata={metadata}
                onMetadataChange={(patch) => updateTranslationMeta.mutate({ id: chat.id, ...patch })}
              />
            </div>

            {/* Advanced Parameters */}
            <div style={{ order: CHAT_SETTINGS_ORDER.advancedParameters }}>
              <AdvancedParametersSection
                forceOpen={initialSection === "advanced-parameters"}
                metadata={metadata}
                isConversation={isConversation}
                chatId={chat.id}
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
                onPastReasoningLimitChange={(pastReasoningLimit) =>
                  updateMeta.mutate({ id: chat.id, pastReasoningLimit })
                }
                onImageCaptioningChange={(patch) => updateMeta.mutate({ id: chat.id, ...patch })}
              />
            </div>

            {!isConversation && !isGame && (
              <div style={{ order: CHAT_SETTINGS_ORDER.impersonate }}>
                <ImpersonateSection presets={(presets ?? []) as Array<{ id: string; name: string }>} />
              </div>
            )}
          </div>
        </ChatSettingsDeferBodiesContext.Provider>
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

      {/* Automatic summarization editor (new layout: a page inside Chat settings) */}
      <SummariesEditorModal
        chat={chat}
        asPage={overhaulActive}
        open={overhaulActive ? activeSubpage === "summaries" : showSummariesModal}
        onClose={() => openSummariesEditor(false)}
      />

      {/* Agent Suite — stored agent data viewer/editor */}
      {agentSuiteLoaded && (
        <Suspense fallback={null}>
          <AgentSuiteModal
            chat={chat}
            asPage={overhaulActive}
            open={agentSuiteOpen}
            onClose={() => openAgentSuite(false)}
            onCloseGuardChange={overhaulActive ? undefined : handleAgentSuiteCloseGuardChange}
            agents={agentSuiteAgents}
          />
        </Suspense>
      )}

      {/* Memory recall chunk viewer */}
      <MemoryRecallMemoriesModal
        chatId={chat.id}
        asPage={overhaulActive}
        open={overhaulActive ? activeSubpage === "memories" : memoryView === "standard"}
        onClose={() => (overhaulActive ? closeSubpage() : setMemoryViewState(null))}
        chatFloatingPanel
      />

      {/* New layout: Chat Variables' State editor as a page (the classic layout opens it as a window). */}
      {overhaulActive && activeSubpage === "variables" && (
        <Suspense fallback={null}>
          <ChatVariablesEditorModal chatId={chat.id} asPage open onClose={closeSubpage} />
        </Suspense>
      )}

      <Modal
        open={!!agentAddPreview}
        onClose={() => {
          if (!addingAgentToChat) {
            setAgentAddPreview(null);
            setAgentSetupQueue([]);
          }
        }}
        title={
          agentAddPreview
            ? localizeUi("ui.chat.chatsettingsdrawer.addValue1", { value1: agentAddPreview.agent.name })
            : localizeUi("ui.chat.chatsettingsdrawer.addAgent")
        }
        footer={
          <>
            <button onClick={confirmAddAgent} disabled={addingAgentToChat} className={SHEET_BUTTON_PRIMARY}>
              {addingAgentToChat
                ? localizeUi("ui.chat.chatsettingsdrawer.adding")
                : localizeUi("ui.chat.chatsettingsdrawer.addAgent")}
            </button>
            <button
              onClick={() => {
                setAgentAddPreview(null);
                setAgentSetupQueue([]);
              }}
              disabled={addingAgentToChat}
              className={SHEET_BUTTON_QUIET}
            >
              {localizeUi("chat.delete.dialog.cancel")}
            </button>
          </>
        }
        closeButtonClassName="max-sm:hidden"
        width="max-w-lg"
        chatFloatingPanel
      >
        {agentAddPreview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--secondary)]/80 px-4 py-3 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-3">
                <Sparkles size="1rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{agentAddPreview.agent.name}</p>
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.5625rem] max-sm:text-[13px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      {agentAddPreview.agent.builtIn
                        ? agentAddPreview.agent.category
                        : localizeUi("ui.agents.toolcard.custom")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs max-sm:text-[13px] leading-5 text-[var(--muted-foreground)]">
                    {agentAddPreview.agent.description || "No description available."}
                  </p>
                  {(() => {
                    const need = agentModelNeed(agentAddPreview.agent.id, agentAddPreview.config?.settings);
                    return need && <NeedsModelChip kind={need.kind} own={need.own} className="mt-2" />;
                  })()}
                </div>
              </div>
            </div>

            {agentAddIsFeature ? (
              <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] max-sm:text-[13px] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {localizeUi("ui.chat.chatsettingsdrawer.thisLetsCharactersInitiateTheDownloadedFeatureInThis")}
              </div>
            ) : agentAddIsRuntimeDisabled ? (
              <div className="rounded-xl bg-[var(--secondary)]/70 px-3 py-2.5 text-[0.6875rem] max-sm:text-[13px] leading-5 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {localizeUi("ui.chat.chatsettingsdrawer.thisAddsItsInstructionsToTheNextRoleplayPrompt")}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] max-sm:text-[13px] font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.agents.agenteditor.agentBudget")}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.contextSize")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={agentAddPreview.contextSize}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  contextSize: Number.isFinite(value)
                                    ? Math.max(1, Math.min(200, value))
                                    : DEFAULT_AGENT_CONTEXT_SIZE,
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agenteditor.messages")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agenteditor.maxOutputTokens")}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={MIN_AGENT_MAX_TOKENS}
                        value={agentAddPreview.maxTokens}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  maxTokens: normalizeAgentMaxTokensInputValue(
                                    Number.isFinite(value) ? value : undefined,
                                  ),
                                }
                              : current,
                          );
                        }}
                        onBlur={() => {
                          setAgentAddPreview((current) =>
                            current ? { ...current, maxTokens: normalizeAgentMaxTokens(current.maxTokens) } : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-32 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.agenteditor.tokens")}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.contextSizeControlsRecentChatMessagesMaxOutputReserves")}
                </p>
              </div>
            )}

            {agentAddIntervalMeta && agentAddPreview.runInterval != null && (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] max-sm:text-[13px] font-semibold text-[var(--foreground)]">
                  {localizeText(agentAddIntervalMeta.label)}
                </label>
                <div className="flex items-center gap-3">
                  {agentAddPreview.agent.builtIn ? (
                    <input
                      type="number"
                      min={agentAddIntervalMeta.min ?? 1}
                      max={agentAddIntervalMeta.max}
                      value={agentAddPreview.runInterval}
                      onChange={(e) => {
                        setAgentAddPreview((current) =>
                          current
                            ? {
                                ...current,
                                runInterval: parseCadenceInputValue(
                                  e.target.value,
                                  agentAddIntervalMeta.defaultValue,
                                  agentAddIntervalMeta.max,
                                  agentAddIntervalMeta.min,
                                ),
                              }
                            : current,
                        );
                      }}
                      disabled={addingAgentToChat}
                      className="w-28 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  ) : (
                    <div className="relative w-28">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          agentAddCadenceInputFocused
                            ? String(agentAddPreview.runInterval)
                            : getCadenceInputValue(agentAddPreview.runInterval)
                        }
                        onFocus={(e) => {
                          setAgentAddCadenceInputFocused(true);
                          e.target.select();
                        }}
                        onBlur={() => setAgentAddCadenceInputFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          const delta = e.key === "ArrowUp" ? 1 : -1;
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: stepCadenceValue(
                                    current.runInterval ?? 1,
                                    delta,
                                    agentAddIntervalMeta.max,
                                    agentAddIntervalMeta.min,
                                  ),
                                }
                              : current,
                          );
                        }}
                        onChange={(e) => {
                          setAgentAddPreview((current) =>
                            current
                              ? {
                                  ...current,
                                  runInterval: parseCadenceInputValue(
                                    e.target.value,
                                    current.runInterval ?? 1,
                                    agentAddIntervalMeta.max,
                                    agentAddIntervalMeta.min,
                                  ),
                                }
                              : current,
                          );
                        }}
                        disabled={addingAgentToChat}
                        className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 pr-8 text-sm max-sm:text-base tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md">
                        <button
                          type="button"
                          aria-label={localizeUi("ui.agents.agenteditor.increaseTriggerCadence")}
                          disabled={addingAgentToChat}
                          onClick={() => {
                            setAgentAddPreview((current) =>
                              current
                                ? {
                                    ...current,
                                    runInterval: stepCadenceValue(
                                      current.runInterval ?? 1,
                                      1,
                                      agentAddIntervalMeta.max,
                                      agentAddIntervalMeta.min,
                                    ),
                                  }
                                : current,
                            );
                          }}
                          className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronUp size="0.6875rem" />
                        </button>
                        <button
                          type="button"
                          aria-label={localizeUi("ui.agents.agenteditor.decreaseTriggerCadence")}
                          disabled={addingAgentToChat}
                          onClick={() => {
                            setAgentAddPreview((current) =>
                              current
                                ? {
                                    ...current,
                                    runInterval: stepCadenceValue(
                                      current.runInterval ?? 1,
                                      -1,
                                      agentAddIntervalMeta.max,
                                      agentAddIntervalMeta.min,
                                    ),
                                  }
                                : current,
                            );
                          }}
                          className="flex h-4 w-5 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronDown size="0.6875rem" />
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                    {agentAddIntervalMeta.unit}
                  </span>
                </div>
                <p className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                  {agentAddPreview.agent.id === "illustrator"
                    ? localizeUi("agents.illustrator.chatRunIntervalHelp")
                    : agentAddIntervalMeta.help}
                </p>
              </div>
            )}

            <AgentAddSetupFields
              agentId={agentAddPreview.agent.id}
              value={agentAddPreview.setup}
              disabled={addingAgentToChat}
              lorebooks={(lorebooks ?? []) as Lorebook[]}
              promptOptions={getPromptOptionsForAgent(agentAddPreview.agent.id)}
              spriteSubjects={agentAddSpriteSubjects}
              allowSecretPlotControls={supportsNarrativeDirectorSecretPlot}
              onChange={(patch) =>
                setAgentAddPreview((current) =>
                  current ? { ...current, setup: { ...current.setup, ...patch } } : current,
                )
              }
            />
          </div>
        )}
      </Modal>

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

const SUBPAGE_TITLE_KEYS: Record<ChatSettingsSubpageId, string> = {
  variables: "ui.stateEditor.chatVariables.title",
  "agent-suite": "ui.chat.agentsuitemodal.agentSuite",
  memories: "ui.chat.memoryrecallmemoriesmodal.memoriesForThisChat",
  summaries: "ui.chat.chatsettingsdrawer.automaticSummarization",
};

/**
 * The editor page's header (back to Chat settings, title, actions) and the slot its body renders into. On phones and
 * tablets upright the sheet's header is the page's header already (`inSheetHeader`): only a row for the page's
 * actions stays, and only while it has some.
 */
function ChatSettingsSubpageFrame({ id, inSheetHeader }: { id: ChatSettingsSubpageId; inSheetHeader: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const setSlot = useChatSettingsSubpage((state) => state.setSlot);
  const setActionsSlot = useChatSettingsSubpage((state) => state.setActionsSlot);
  const title = localizeUi(SUBPAGE_TITLE_KEYS[id]);
  const backRef = useRef<HTMLButtonElement | null>(null);
  // Focus starts on the way back, so keyboard users land on the new page and not behind it.
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, [id]);
  if (inSheetHeader)
    return (
      <section className="ov-cs-sub" data-chat-settings-subpage={id} aria-label={title}>
        <div className="ov-cs-sub__head ov-cs-sub__head--actions">
          <div ref={setActionsSlot} className="ov-cs-sub__actions" />
        </div>
        <div ref={setSlot} className="ov-cs-sub__slot" />
      </section>
    );
  return (
    <section className="ov-cs-sub" data-chat-settings-subpage={id} aria-label={title}>
      <div className="ov-cs-sub__head">
        <button
          ref={backRef}
          type="button"
          className="ov-cs-sub__back"
          onClick={() => void requestCloseChatSettingsSubpage()}
        >
          <ChevronLeft size="1rem" aria-hidden="true" />
          <span>{localizeUi("chat.settings.subpage.back")}</span>
        </button>
        <h2 className="ov-cs-sub__title">{title}</h2>
        <div ref={setActionsSlot} className="ov-cs-sub__actions" />
      </div>
      <div ref={setSlot} className="ov-cs-sub__slot" />
    </section>
  );
}

function ChatToolLoading() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-[var(--muted-foreground)]">
      <Loader2 size="0.75rem" className="animate-spin" />
      {localizeUi("chat.settings.toolLoading")}
    </div>
  );
}
