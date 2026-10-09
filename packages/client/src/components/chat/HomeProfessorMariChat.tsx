import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { MariStorySprite } from "./MariStorySprite";
import {
  type ReactNode,
  type RefObject,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { professorMariWorkspaceStatusKeys } from "../../hooks/use-professor-mari-workspace-status";
import { useMariPresence, useMarkMariRunSeen } from "../../hooks/use-mari-presence";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_AUTHORIZATION_ACCEPT_CHIP,
  MARI_AUTHORIZATION_DECLINE_CHIP,
  isMariHeldChangeApprovalChip,
  withHeldChangeDeclineChip,
  MARI_STARTER_CHIPS,
  mariReceiptReviewIds,
  sanitizeMariSuggestionChips,
  type APIConnection,
  type Chat,
  type MariDbPendingApproval,
  type MariSuggestionAction,
  type MariSuggestionChip,
  type MariWorkspaceSkillDetail,
  type MariWorkspaceActionResult,
  type MariWorkspaceSkillsResponse,
  type MariInstructionDetail,
  type MariInstructionsResponse,
  type MariWorkspaceStatus,
  type Message,
  type ProfessorMariAskContext,
  type ProfessorMariHandoff,
} from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useTrackAchievement } from "../../hooks/use-achievements";
import { chatKeys } from "../../hooks/use-chats";
import { characterKeys, useCharacters, usePersonas } from "../../hooks/use-characters";
import { getCharacterDisplayIdentity } from "../../lib/character-display";
import { buildCharacterPreviewModel, type CharacterPreviewModel } from "../../lib/character-preview";
import { buildLorebookPreviewModel } from "../../lib/lorebook-preview";
import { completeInline } from "../../lib/inline-completion";
import { resolveMariRestStory, type MariStoryState } from "../../lib/mari-work-animations";
import { lorebookKeys, useLorebooks } from "../../hooks/use-lorebooks";
import { presetKeys, usePresets } from "../../hooks/use-presets";
import { useMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { useInDialogFocusScope } from "../../hooks/use-in-dialog-focus-scope";
import { useChatKeyboardOpen } from "../../hooks/use-visual-viewport-chat-bottom";
import { MariChatHistoryPicker } from "./MariChatHistoryPicker";
import { MariContextViewer } from "./MariContextViewer";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { api, ApiError } from "../../lib/api-client";
import { describeProfessorMariError } from "../../lib/professor-mari-errors";
import {
  assignReviewsToTurns,
  countBlockingReviews,
  isMariReviewWaiting,
  isPersistentProfessorMariContext,
  professorMariContextFacets,
  resolveProfessorMariPresentationState,
  reviewRecordKeys,
  shouldAppendMariArrival,
  shouldOfferProfessorMariStarterSuggestions,
  shouldShowProfessorMariConnectionHint,
  withoutProfessorMariContextFacet,
  type ProfessorMariContextFacet,
} from "../../lib/professor-mari-presentation";
import {
  resolveProfessorMariWorkspaceBackAction,
  type ProfessorMariWorkspaceDestination,
} from "../../lib/professor-mari-workspace-navigation";
import { useMariApprovals } from "../../hooks/use-mari-approvals";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { enqueueMariPermissionsModeWrite } from "../../lib/mari-permissions-write-chain";
import {
  DEFAULT_MARI_PERMISSIONS_MODE,
  MARI_PERMISSIONS_MODE_LABELS,
  type MariPermissionsMode,
  type MariWorkspacePendingApproval,
} from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import {
  DeleteReviewCard,
  MariHeldChangeCard,
  RawDetails,
  ResolvedPromptLine,
  WorkspaceApprovalCard,
} from "./MariApprovalCards";
import { type MariReceiptControls } from "./MariChangeReceipt";
import { compareMariPanelItems, type MemoryDraftState, type SkillDraftState } from "./MariPanelControls";

// The Skills and Memories panels are a management surface most sessions never
// open. Keeping them out of the eager chunk leaves room under the hard bundle
// budget for the work surface itself.
const ProfessorMariSkillsMenu = lazy(() =>
  import("./MariSkillsMenu").then((module) => ({ default: module.ProfessorMariSkillsMenu })),
);
const ProfessorMariMemoriesMenu = lazy(() =>
  import("./MariMemoriesMenu").then((module) => ({ default: module.ProfessorMariMemoriesMenu })),
);
import type { MariPromptRenderSide } from "./MariPromptPreviewModal";
import { showLocalMessageNotification, showNativeMessageNotification } from "../../lib/local-notifications";
import {
  followTranscriptGrowth,
  isProfessorMariTranscriptNearBottom,
  scrollProfessorMariTranscriptToBottom,
  transcriptScrollAction,
} from "../../lib/professor-mari-transcript-scroll";
import { resolveProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { rafThrottle } from "../../lib/raf-throttle";
import {
  cachedMariThread,
  keepUnchangedMessages,
  rememberMariThread,
  rememberMariThreads,
} from "../../lib/mari-thread-cache";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
import { cn } from "../../lib/utils";
import { executeStateNavigation } from "../../lib/state-navigation";
import {
  chooseMariThread,
  readMariThread,
  type MariArrival,
  type MariArrivalAction,
  type MariThreadContext,
} from "../../lib/mari-arrival";
import { mariReferenceTarget, type MariReferencedResource } from "../../lib/mari-referenced-resources";
import { getOmnibarSettingsDestinations } from "../../lib/omnibar-settings";
import { MariNextStepCards } from "./MariSuggestionChips";
import { requestChatPeekPrompt } from "../../lib/chat-floating-ui-events";
import { MariList } from "./mari-primitives";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  consumeProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";
import { MariTurnReviews, MariReferencedResources, CompactMariMessage } from "./mari/CompactMariMessage";
import {
  PROFESSOR_MARI_DRAFT_KEY,
  ProfessorMariAttachment,
  resolveContextCharacter,
  resolveContextLorebook,
  ProfessorMariChatSummary,
  ProfessorMariRecovery,
  PROFESSOR_MARI_PANE_TRANSITION,
  ProfessorMariConnectionOption,
  toMessageExtra,
  getProfessorMariMessageContext,
  persistentResourceContext,
  continuedThereByContext,
  classifyProfessorMariFailure,
  PROFESSOR_MARI_ATTACHMENT_MAX_BYTES,
  isSupportedProfessorMariAttachment,
  inferProfessorMariAttachmentType,
  readProfessorMariFileAsDataUrl,
  PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
  isProfessorMariAbortError,
  createLocalUserMessage,
  PROFESSOR_MARI_DEFAULT_CHAT_NAME,
  buildProfessorMariAutoTitle,
  getMessageThinking,
  MARI_WELCOME,
  ProfessorMariMobilePortal,
  MARI_PANEL_SLOT_CLASS,
  retryOf,
} from "./mari/mari-chat-helpers";
import {
  WorkspaceTimelineItem,
  appendTextTimeline,
  getMessageRunError,
  getMessageRunTime,
  getMessageWorkspaceActionResults,
  getMessageWorkspaceTrace,
  timelineItemsFromTrace,
} from "./mari/mari-tool-presentation";
import { ProfessorMariPixelScene } from "./mari/MariChatStates";
import { isHardStepFailure } from "./mari/MariWorkTimeline";
import { MariSeesPanel } from "./mari/MariSeesPanel";
import { MariChatsPanel } from "./mari/MariChatsPanel";
import { MariComposer } from "./mari/MariComposer";
import { MariTranscript } from "./mari/MariTranscript";
import { MariWindowHeader } from "./mari/MariWindowHeader";
import { useMariSkillMemoryActions } from "./mari/use-mari-skill-memory-actions";
import { useMariChatHistoryActions } from "./mari/use-mari-chat-history-actions";
import { useMariMessageActions } from "./mari/use-mari-message-actions";
import { useMariWorkspaceRun } from "./mari/use-mari-workspace-run";
import { MariOmnibarHeaderChrome } from "./mari/MariOmnibarHeaderChrome";

type HomeProfessorMariChatProps = {
  pageActive?: boolean;
  attachedFooter?: boolean;
  chatWindowOpen?: boolean;
  embeddedTab?: boolean;
  omnibarMode?: boolean;
  launchHidden?: boolean;
  initialAskContext?: ProfessorMariAskContext | null;
  /** Increments on every omnibar handoff that should send its query at once. */
  submitDraftRequest?: number;
  /** A past Mari conversation to open, handed in from the omnibar. */
  openChatId?: string | null;
  pendingReviewRequest?: number;
  /** The specific review `pendingReviewRequest` should jump to, or null for the first one (R9). */
  pendingReviewId?: string | null;
  omnibarHeaderSlot?: HTMLElement | null;
  /** Her status line under "Professor Mari" in the omnibar header's first row. */
  omnibarStatusSlot?: HTMLElement | null;
  /** R11: the first header row's spot for the destinations menu while a phone keyboard is open. */
  omnibarMenuSlot?: HTMLElement | null;
  /** M9: what the empty pane says about the screen she was opened from; null keeps the generic welcome. */
  arrival?: MariArrival | null;
  /**
   * D1: increments on every arrival-door open (⌘J, the pull, the drag, Home's "Ask Professor
   * Mari"). When her chat already has messages, this appends the same arrival content at the
   * bottom of the transcript instead of only showing it on an empty chat.
   */
  arrivalAppendRequest?: number;
  /**
   * R7: the context of the screen an arrival door opened her from. With it, each arrival continues
   * the newest thread for that context, starts one, or asks when another thread was just in use.
   */
  arrivalThread?: MariThreadContext | null;
  /** Runs the arrival cards only the omnibar can (back to its settings search, K5's Undo). */
  onArrivalAction?: (action: MariArrivalAction) => void;
  /** N6 (R22): the handoff an arrival Fix card sends with; the only arrival path that carries the error text. */
  arrivalFixContext?: ProfessorMariAskContext | null;
  onChatWindowOpenChange?: (open: boolean) => void;
  onChatWindowExitComplete?: () => void;
};

/** A turn with nothing to review shares this value, so its memoized row skips the window's re-renders. */
const NO_TURN_REVIEWS: MariTurnReviews = { changed: [], needsOk: [], records: new Set() };

/** The newest page of her thread. The first load starts it beside the arrival routing, not after it. */
function fetchMariThreadMessages(id: string, signal?: AbortSignal) {
  return api.get<Message[]>(`/chats/${id}/messages?limit=80`, { signal });
}

export function HomeProfessorMariChat({
  pageActive = true,
  attachedFooter = false,
  chatWindowOpen: controlledChatWindowOpen,
  embeddedTab = false,
  omnibarMode = false,
  launchHidden = false,
  initialAskContext = null,
  submitDraftRequest = 0,
  openChatId = null,
  pendingReviewRequest = 0,
  pendingReviewId = null,
  omnibarHeaderSlot = null,
  omnibarStatusSlot = null,
  omnibarMenuSlot = null,
  arrival = null,
  arrivalAppendRequest = 0,
  arrivalThread = null,
  onArrivalAction,
  arrivalFixContext = null,
  onChatWindowOpenChange,
  onChatWindowExitComplete,
}: HomeProfessorMariChatProps) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: connectionsRaw, isLoading: connectionsLoading } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const sidecarNativeToolCalls = useSidecarStore((state) => state.config.enableNativeToolCalls);
  const fetchSidecarStatus = useSidecarStore((state) => state.fetchStatus);
  const trackAchievement = useTrackAchievement();
  // A reopen draws the thread she showed last in its first frame (when the arrival routing would land there
  // too); the first load below only refreshes it, or moves to the thread it picks.
  const [cachedThread] = useState(() =>
    cachedMariThread(
      omnibarMode && arrivalThread && arrivalAppendRequest > 0
        ? { context: arrivalThread, continuedThereId: continuedThereByContext.get(arrivalThread.key) }
        : null,
    ),
  );
  const [chatId, setChatId] = useState<string | null>(cachedThread?.chatId ?? null);
  const { data: attachedContext } = useMariWorkspaceContext(chatId);
  const [messages, setMessages] = useState<Message[]>(cachedThread?.messages ?? []);
  const draft = useChatStore((state) => state.inputDrafts.get(PROFESSOR_MARI_DRAFT_KEY) ?? "");
  const setInputDraft = useChatStore((state) => state.setInputDraft);
  const enterToSend = useUIStore((state) => state.enterToSendProfessorMari);
  const setDraft = useCallback(
    (next: string | ((current: string) => string)) => {
      const current = useChatStore.getState().inputDrafts.get(PROFESSOR_MARI_DRAFT_KEY) ?? "";
      setInputDraft(PROFESSOR_MARI_DRAFT_KEY, typeof next === "function" ? next(current) : next);
    },
    [setInputDraft],
  );
  // Ghost-text completion for the composer: the user's own names first, because
  // "tell me about cel|" almost always means one of their characters.
  const completionCharacters = useCharacters();
  const completionPersonas = usePersonas();
  const completionLorebooks = useLorebooks();
  const completionPresets = usePresets();
  const completionCandidates = useMemo(
    () => [
      // A character's display name lives inside its card data, not on the row —
      // reading `.name` here returned nothing, which is why characters never
      // completed.
      ...(completionCharacters.data ?? []).map((item) => {
        const record = item as Record<string, unknown>;
        return getCharacterDisplayIdentity({ data: record.data, comment: record.comment as string | null | undefined });
      }),
      ...[completionPersonas.data, completionLorebooks.data, completionPresets.data].flatMap((list) =>
        (list ?? []).map((item) => (item as { name?: string }).name ?? ""),
      ),
    ],
    [completionCharacters.data, completionLorebooks.data, completionPersonas.data, completionPresets.data],
  );
  const characterPreviewById = useMemo(() => {
    const previews = new Map<string, CharacterPreviewModel>();
    for (const item of completionCharacters.data ?? []) {
      const preview = buildCharacterPreviewModel(item);
      if (preview) previews.set(preview.id, preview);
    }
    return previews;
  }, [completionCharacters.data]);
  const lorebookPreviewById = useMemo(
    () =>
      new Map(
        (completionLorebooks.data ?? []).map((item) => {
          const preview = buildLorebookPreviewModel(item);
          return [preview.id, preview] as const;
        }),
      ),
    [completionLorebooks.data],
  );
  const draftSuffix = useMemo(() => completeInline(draft, completionCandidates), [completionCandidates, draft]);
  const acceptDraftCompletion = useCallback(() => {
    if (draftSuffix) setDraft((current) => current + draftSuffix);
  }, [draftSuffix, setDraft]);
  const [attachments, setAttachments] = useState<ProfessorMariAttachment[]>([]);
  const [composerScroll, setComposerScroll] = useState({ left: 0, top: 0 });
  const [handoffContext, setHandoffContext] = useState<ProfessorMariAskContext | null>(() => initialAskContext ?? null);
  const characterFallbackName = t("omnibar.categories.character", "Character");
  const focusedCharacter = resolveContextCharacter(handoffContext, characterPreviewById, characterFallbackName);
  const lorebookFallbackName = t("omnibar.categories.lorebook", "Lorebook");
  const focusedLorebook = resolveContextLorebook(handoffContext, lorebookPreviewById, lorebookFallbackName);
  const [isReadingAttachments, setIsReadingAttachments] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    () => useUIStore.getState().mariConnectionId,
  );
  const [workspaceStatus, setWorkspaceStatus] = useState<MariWorkspaceStatus | null>(null);
  /** R14 (item 7): when this client's newest run started and ended; the live timer and "Worked for" read it. */
  const [workspaceRunClock, setWorkspaceRunClock] = useState<{ startedAt: number; endedAt: number | null } | null>(
    null,
  );
  const [workspaceActive, setWorkspaceActive] = useState(false);
  // The newest run, from the server: its clock survives a reload, and showing it marks it seen (the top-bar pill clears).
  const mariPresence = useMariPresence();
  const serverRun = mariPresence.latestRun;
  // A run that started before a reload (or in another tab) is still live here: show its timeline and clock.
  const serverRunningHere = serverRun?.outcome === "running" && serverRun.chatId === chatId;
  useMarkMariRunSeen(chatId, serverRun, mariPresence.working);
  useEffect(() => {
    if (!serverRun || serverRun.chatId !== chatId) return;
    setWorkspaceRunClock({ startedAt: serverRun.startedAt, endedAt: serverRun.finishedAt });
  }, [chatId, serverRun?.id, serverRun?.chatId, serverRun?.startedAt, serverRun?.finishedAt]);
  const [workspaceTimeline, setWorkspaceTimeline] = useState<WorkspaceTimelineItem[]>([]);
  const [workspaceReviewActionId, setWorkspaceReviewActionId] = useState<string | null>(null);
  const [workspaceDestination, setWorkspaceDestination] = useState<ProfessorMariWorkspaceDestination>("chat");
  const [chatRowMenuId, setChatRowMenuId] = useState<string | null>(null);
  const chatRowMenuRef = useRef<HTMLDivElement>(null);
  const chatRowPopoverRef = useRef<HTMLDivElement>(null);
  // R11: while a phone keyboard is open the header is one line and the destinations sit in a menu. An open
  // menu keeps it compact (moving focus into the menu closes the keyboard); closing the menu restores it.
  const keyboardOpen = useChatKeyboardOpen();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const headerCompact = keyboardOpen || headerMenuOpen;
  const chatHistoryOpen = workspaceDestination === "chats";
  // R52: the slot is empty by default. A user who never opens a panel sees a
  // stream and a composer, and nothing else exists for them.
  const [chatHistory, setChatHistory] = useState<ProfessorMariChatSummary[]>([]);
  const [chatHistoryQuery, setChatHistoryQuery] = useState("");
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistorySelectionMode, setChatHistorySelectionMode] = useState(false);
  const [selectedChatHistoryIds, setSelectedChatHistoryIds] = useState<Set<string>>(new Set());
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const skillsMenuOpen = workspaceDestination === "skills";
  const [skills, setSkills] = useState<MariWorkspaceSkillDetail[]>([]);
  const [skillsDiagnostics, setSkillsDiagnostics] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraftState>({ name: "", description: "", content: "" });
  const memoriesMenuOpen = workspaceDestination === "memories";
  const [memories, setMemories] = useState<MariInstructionDetail[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesSaving, setMemoriesSaving] = useState(false);
  const [memoriesQuery, setMemoriesQuery] = useState("");
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraftState>({ name: "", description: "", content: "" });
  // True from the first frame behind a cached thread, so nothing routes an arrival before the first load does.
  const [loadingHistory, setLoadingHistory] = useState(cachedThread !== null);
  const [loadedMessagesChatId, setLoadedMessagesChatId] = useState<string | null>(cachedThread?.chatId ?? null);
  const [sending, setSending] = useState(false);
  const [cancelledChatId, setCancelledChatId] = useState<string | null>(null);
  const [recovery, setRecoveryState] = useState<ProfessorMariRecovery | null>(null);
  // F10: the top-bar edge reads this too, so a client-side failure (404/network before the server
  // ever saw the run) turns it red the same as a server-recorded one.
  const setRecovery = useCallback((value: ProfessorMariRecovery | null) => {
    setRecoveryState(value);
    useChatStore.getState().setMariClientRunFailed(value !== null);
  }, []);
  // Direction A / R10: an answered prompt or review folds to one row ("✓ Kept") until the next send.
  const [resolvedPrompts, setResolvedPrompts] = useState<
    Array<{
      chatId: string | null;
      approval: MariWorkspacePendingApproval;
      outcome: "applied" | "discarded";
    }>
  >([]);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [permissionsMenuOpen, setPermissionsMenuOpen] = useState(false);
  // #5740: keyed by messageId so expansion never carries over when a new
  // round's record replaces the old one under a different reply.
  const [expandedUnderstoodRequestMessageId, setExpandedUnderstoodRequestMessageId] = useState<string | null>(null);
  const permissionsModeWriteSeqRef = useRef(0);
  // Chat id of pending mode writes (null = none): polls hold mode fields only
  // for the chat the write targets, and count tracks overlapping writes.
  const permissionsModeWritePendingChatRef = useRef<string | null>(null);
  const permissionsModeWritePendingCountRef = useRef(0);

  const permissionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const permissionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [contextViewerOpen, setContextViewerOpen] = useState(false);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [internalChatWindowOpen, setInternalChatWindowOpen] = useState(false);
  const [mobileFocusMode, setMobileFocusMode] = useState(false);
  const hasLoadedRef = useRef(false);
  const notifiedApprovalIdsRef = useRef<Set<string>>(new Set());
  const lastAutoOpenedApprovalKeyRef = useRef("");
  const activeChatIdRef = useRef<string | null>(cachedThread?.chatId ?? null);
  const messagesRef = useRef<Message[]>(messages);
  const messageLoadAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptScrollFrameRef = useRef<number | null>(null);
  const suggestionFocusFrameRef = useRef<number | null>(null);
  const transcriptFollowOutputRef = useRef(true);
  // M4: right after reserving the turn's height, "top of the question" and "bottom of the page" can be
  // only a few px apart (the reservation IS the viewport height), so the native "scroll" event OUR OWN
  // placement scroll fires would otherwise read as the reader already being near the bottom and re-arm
  // following before a single token has streamed. Swallow exactly that one event.
  const suppressNextScrollEventRef = useRef(false);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const connectionMenuRef = useRef<HTMLDivElement>(null);
  const skillFileInputRef = useRef<HTMLInputElement>(null);
  const memoryFileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncedMemoryIdRef = useRef<string | null>(null);
  const lastSyncedSkillIdRef = useRef<string | null>(null);
  const hasLoadedSkillsRef = useRef(false);
  const memoriesLoadSeqRef = useRef(0);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const embeddedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const floatingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const workspaceAbortRef = useRef<AbortController | null>(null);
  const workspaceRunIdRef = useRef(0);
  const pendingWorkspaceTextRef = useRef("");
  const handledWorkspaceRefreshIdsRef = useRef<Set<string> | null>(null);
  const latestConnectionSelectionRef = useRef<string | null>(selectedConnectionId);
  const pendingConnectionPersistRef = useRef<string | null>(null);
  const connectionPersistInFlightRef = useRef(false);
  const attachmentRemovalInFlightRef = useRef<Set<string>>(new Set());
  const regenerationInFlightRef = useRef(false);
  const messageMutationBusyRef = useRef(false);

  const appendPendingWorkspaceText = useCallback(() => {
    const pendingText = pendingWorkspaceTextRef.current;
    pendingWorkspaceTextRef.current = "";
    if (pendingText) setWorkspaceTimeline((current) => appendTextTimeline(current, pendingText));
  }, []);
  const workspaceTextThrottle = useMemo(
    () => rafThrottle<void>(appendPendingWorkspaceText),
    [appendPendingWorkspaceText],
  );

  useEffect(() => () => workspaceTextThrottle.cancel(), [workspaceTextThrottle]);

  useEffect(
    () => () => {
      messageLoadAbortRef.current?.abort();
      messageLoadAbortRef.current = null;
      if (transcriptScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(transcriptScrollFrameRef.current);
        transcriptScrollFrameRef.current = null;
      }
      if (suggestionFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(suggestionFocusFrameRef.current);
        suggestionFocusFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // The thread on screen outlives her pane (it unmounts with the omnibar), so the next open draws it at once.
  useEffect(() => {
    if (chatId && loadedMessagesChatId === chatId) rememberMariThread(chatId, messages);
  }, [chatId, loadedMessagesChatId, messages]);

  const setActiveChatId = useCallback((id: string) => {
    activeChatIdRef.current = id;
    setChatId(id);
  }, []);

  // This ref callback is recreated (and so re-invoked by React on the SAME node) whenever any of its
  // deps change, not only when a chat is freshly opened - e.g. once more when the initial load of a
  // brand-new chat catches up to a chatId that handleSubmit's own send already moved past. Landing on
  // the bottom must happen once per chat, not every time those deps happen to realign. A new node does
  // land again: a cached thread is on screen from the first render, and the node it landed in can be
  // replaced right after mount.
  const landedTranscriptRef = useRef<{ node: HTMLDivElement; chatId: string } | null>(null);
  const setTranscriptScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      const cancelLanding = () => {
        if (transcriptScrollFrameRef.current === null) return;
        window.cancelAnimationFrame(transcriptScrollFrameRef.current);
        transcriptScrollFrameRef.current = null;
      };
      if (!node) {
        // A landing cut off before it finished (a detach, StrictMode's double attach) lands again.
        if (transcriptScrollFrameRef.current !== null) landedTranscriptRef.current = null;
        return cancelLanding();
      }
      if (!chatId || loadedMessagesChatId !== chatId) return;
      if (landedTranscriptRef.current?.node === node && landedTranscriptRef.current.chatId === chatId) return;
      cancelLanding();
      landedTranscriptRef.current = { node, chatId };
      // Older turns off screen have only an estimated height (content-visibility, mari.css). The ones the
      // bottom brings into view take their real height a frame later and push the newest turn down, so pin
      // again each frame until the height holds. While her window is still hidden (a cached thread is
      // there from its first render) the transcript has no height yet, so it waits for one.
      let pinnedHeight = -1;
      let frames = 0;
      const land = () => {
        transcriptScrollFrameRef.current = null;
        if (scrollRef.current !== node || frames++ > 60) return;
        if (node.clientHeight > 0) {
          if (node.scrollHeight === pinnedHeight) return;
          pinnedHeight = node.scrollHeight;
          transcriptFollowOutputRef.current = true;
          scrollProfessorMariTranscriptToBottom(node);
        }
        transcriptScrollFrameRef.current = window.requestAnimationFrame(land);
      };
      transcriptFollowOutputRef.current = true;
      transcriptScrollFrameRef.current = window.requestAnimationFrame(land);
    },
    [chatId, loadedMessagesChatId],
  );

  // The composer floats over the transcript (M1); the transcript's bottom padding and fade both
  // need the dock's live height, kept on the shared pane as a CSS var so both can read it in CSS.
  // A ref callback, not a mount effect: leaving her pane for Search unmounts the dock while this
  // component stays mounted, and the new dock on return must be measured again, or the transcript
  // loses its bottom padding and her empty state slides under the composer.
  const composerDockRef = useRef<HTMLFormElement | null>(null);
  const attachComposerDock = useCallback((dock: HTMLFormElement | null) => {
    composerDockRef.current = dock;
    const pane = dock?.parentElement;
    if (!dock || !pane) return;
    const sync = () => pane.style.setProperty("--mari-dock-h", `${dock.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      composerDockRef.current = null;
    };
  }, []);

  // M4: the newest turn (the local user message plus everything that follows it) reserves the
  // transcript's visible height so her reply grows into empty space instead of changing the
  // scrollable height, and the question is placed under the header exactly once, on send.
  const activeTurnRef = useRef<HTMLDivElement>(null);
  const [turnStartMessageId, setTurnStartMessageId] = useState<string | null>(null);

  // R11: grow without a jump. Measure at `auto`, put the old height back and set the new one, so the CSS
  // height transition runs; the cap is the field's max-height (8 lines, 6 on touch, in globals.css).
  const resizeComposer = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const from = textarea.offsetHeight;
    const scrollTop = textarea.scrollTop;
    textarea.style.height = "auto";
    const cap = Number.parseFloat(getComputedStyle(textarea).maxHeight);
    const to = Number.isFinite(cap) ? Math.min(textarea.scrollHeight, cap) : textarea.scrollHeight;
    textarea.style.height = `${from}px`;
    void textarea.offsetHeight;
    textarea.style.height = `${to}px`;
    textarea.scrollTop = scrollTop;
    textarea.toggleAttribute("data-scrolled", textarea.scrollTop > 0);
  }, []);

  const focusComposer = useCallback(() => {
    if (suggestionFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(suggestionFocusFrameRef.current);
    }
    suggestionFocusFrameRef.current = window.requestAnimationFrame(() => {
      suggestionFocusFrameRef.current = null;
      const textarea = floatingTextareaRef.current ?? embeddedTextareaRef.current;
      // UX-02: the field is disabled during a run; hold focus on its shell until the run ends (below).
      if (textarea?.disabled) textarea.closest<HTMLElement>(".mari-workspace-composer")?.focus({ preventScroll: true });
      else textarea?.focus();
    });
  }, []);

  // UX-02: an action that removes its own button (a handoff, Accept, Undo, Keep) would drop focus to the
  // page, where Escape and Tab no longer reach her window. Not on touch: focusing the field raises the keyboard.
  const keepKeyboardInWindow = useCallback(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) focusComposer();
  }, [focusComposer]);

  useEffect(() => {
    if (controlledChatWindowOpen) focusComposer();
  }, [controlledChatWindowOpen, focusComposer]);

  useLayoutEffect(() => {
    resizeComposer(embeddedTextareaRef.current);
    resizeComposer(floatingTextareaRef.current);
  }, [draft, resizeComposer]);

  const hasActiveGeneration = useChatStore((state) => (chatId ? state.abortControllers.has(chatId) : false));
  const reduceMotion = useReducedMotion();
  const reduceAmbientEffects = useReducedAmbientEffects();
  // The omnibar already has a fixed shell. Destination animation makes its
  // contents appear to reload and moves the composer while switching tabs.
  const paneTransition = omnibarMode
    ? { duration: 0 }
    : reduceMotion
      ? { duration: 0 }
      : PROFESSOR_MARI_PANE_TRANSITION;
  const mariPhase = useChatStore((state) => (chatId ? (state.mariPhaseByChatId.get(chatId) ?? null) : null));
  const mariChips = useAgentStore((state) => state.mariChips);
  const mariChipsChatId = useAgentStore((state) => state.mariChipsChatId);
  const setMariChips = useAgentStore((state) => state.setMariChips);
  const clearMariChips = useAgentStore((state) => state.clearMariChips);
  const mariPlan = useAgentStore((state) => state.mariPlan);
  const mariPlanChatId = useAgentStore((state) => state.mariPlanChatId);
  const mariPlanCursor = useAgentStore((state) => state.mariPlanCursor);
  const setMariPlan = useAgentStore((state) => state.setMariPlan);
  const recordMariPlanAnswer = useAgentStore((state) => state.recordMariPlanAnswer);
  const clearMariPlan = useAgentStore((state) => state.clearMariPlan);
  const professorMariSuggestionsEnabled = useUIStore((state) => state.professorMariSuggestionsEnabled);
  const showContextUsage = useUIStore((state) => state.showContextUsage);

  const languageConnections = useMemo<ProfessorMariConnectionOption[]>(
    () => filterLanguageGenerationConnections((connectionsRaw ?? []) as APIConnection[]),
    [connectionsRaw],
  );
  const connectionOptions = useMemo<ProfessorMariConnectionOption[]>(() => {
    if (!sidecarModelDownloaded) return languageConnections;
    return [
      ...languageConnections,
      {
        id: LOCAL_SIDECAR_CONNECTION_ID,
        name: sidecarModelDisplayName ? `Local Model (${sidecarModelDisplayName})` : "Local Model (sidecar)",
        model: sidecarModelDisplayName ?? "local-sidecar",
        provider: "local_sidecar",
        isDefault: languageConnections.length === 0,
      },
    ];
  }, [languageConnections, sidecarModelDisplayName, sidecarModelDownloaded]);
  const selectedConnection = useMemo(
    () => connectionOptions.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connectionOptions, selectedConnectionId],
  );
  const effectiveConnection =
    selectedConnection ??
    // `/connections` sends isDefault as "true"/"false"; a bare truthy check took "false" too.
    connectionOptions.find((connection) => String(connection.isDefault) === "true") ??
    connectionOptions[0] ??
    null;
  const effectiveConnectionId = effectiveConnection?.id ?? null;
  const noConnection = !connectionsLoading && !effectiveConnection;
  const oneShotContext = handoffContext && !isPersistentProfessorMariContext(handoffContext) ? handoffContext : null;
  const oneShotContextFacets = useMemo(() => professorMariContextFacets(oneShotContext), [oneShotContext]);
  // R14: the composer's context row shows everything she is using - the one-shot facets and her lasting
  // focus (a character or lorebook) - so it stays after the first send instead of vanishing.
  const composerContextFacets = useMemo(() => professorMariContextFacets(handoffContext), [handoffContext]);
  const removeOneShotFacet = useCallback(
    (facet: ProfessorMariContextFacet) =>
      setHandoffContext((current) => withoutProfessorMariContextFacet(current, facet.kind)),
    [],
  );
  const contextBudget = useMemo(
    () => resolveProfessorMariContextBudget(messages, workspaceStatus?.connection?.maxContext),
    [messages, workspaceStatus?.connection?.maxContext],
  );
  const isBusy = sending || hasActiveGeneration || workspaceActive;
  // A run ended while focus waited on the composer shell: hand it to the field (not on touch, see above).
  useEffect(() => {
    if (isBusy || !document.activeElement?.classList.contains("mari-workspace-composer")) return;
    if (!window.matchMedia("(pointer: coarse)").matches) focusComposer();
  }, [focusComposer, isBusy]);
  useEffect(() => {
    messageMutationBusyRef.current = isBusy;
  }, [isBusy]);
  const canSubmitMessage = (draft.trim().length > 0 || attachments.length > 0) && !isReadingAttachments;
  const starterSuggestionsAvailable = shouldOfferProfessorMariStarterSuggestions({
    chatId,
    loadedMessagesChatId,
    messageCount: messages.length,
    busy: isBusy,
  });
  // #5748: re-derive the Accept chip from the persisted deferral flag, because the
  // shared chips slot is ephemeral and a reload or unrelated run clears it.
  const lastLoadedMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const lastLoadedMessageExtra =
    lastLoadedMessage && typeof lastLoadedMessage.extra === "object" ? lastLoadedMessage.extra : null;
  const pendingDeferredMutations =
    chatId !== null &&
    loadedMessagesChatId === chatId &&
    !isBusy &&
    lastLoadedMessage?.role === "assistant" &&
    lastLoadedMessageExtra?.mariDeferredMutations === true;
  // Slice 70: the chips her last answer offered are saved on it, so a reload keeps them.
  const savedChips =
    chatId !== null && loadedMessagesChatId === chatId && !isBusy && lastLoadedMessage?.role === "assistant"
      ? sanitizeMariSuggestionChips(lastLoadedMessageExtra?.mariSuggestions, { maxChips: 6 })
      : [];
  const storeChipsForChat = mariChipsChatId === chatId && mariChips.length > 0 ? mariChips : savedChips;
  const visibleSuggestionChips =
    pendingDeferredMutations && !storeChipsForChat.some((chip) => chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id)
      ? withHeldChangeDeclineChip([
          MARI_AUTHORIZATION_ACCEPT_CHIP,
          ...(professorMariSuggestionsEnabled ? storeChipsForChat : []),
        ])
      : storeChipsForChat.some((chip) => chip.id === "authorization-accept")
        ? withHeldChangeDeclineChip(
            storeChipsForChat.filter((chip) => professorMariSuggestionsEnabled || chip.id === "authorization-accept"),
          )
        : professorMariSuggestionsEnabled && storeChipsForChat.length > 0
          ? storeChipsForChat
          : professorMariSuggestionsEnabled && starterSuggestionsAvailable
            ? MARI_STARTER_CHIPS
            : [];
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills],
  );
  const activeSkillCount = skills.filter((skill) => skill.enabled).length;
  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedMemoryId) ?? null,
    [selectedMemoryId, memories],
  );
  const activeMemoryCount = memories.filter((memory) => memory.enabled).length;
  const chatHistorySortMode = useUIStore((state) => state.mariPanelSortMode);
  const setChatHistorySortMode = useUIStore((state) => state.setMariPanelSortMode);
  const displayedChatHistory = useMemo(() => {
    const normalizedQuery = chatHistoryQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? chatHistory.filter((item) =>
          // R7: a thread is also found by what it is about.
          `${item.name ?? ""} ${readMariThread(item).contextLabel ?? ""}`.toLowerCase().includes(normalizedQuery),
        )
      : chatHistory;
    return [...filtered].sort((left, right) =>
      compareMariPanelItems(
        { name: left.name ?? "", createdAt: left.createdAt },
        { name: right.name ?? "", createdAt: right.createdAt },
        chatHistorySortMode,
      ),
    );
  }, [chatHistory, chatHistoryQuery, chatHistorySortMode]);
  const desktopChatWindowOpen = controlledChatWindowOpen ?? internalChatWindowOpen;
  const chatWindowOpen = desktopChatWindowOpen || mobileFocusMode;
  const setChatWindowOpen = useCallback(
    (open: boolean) => {
      setInternalChatWindowOpen(open);
      onChatWindowOpenChange?.(open);
    },
    [onChatWindowOpenChange],
  );

  const applyHandoff = useCallback(
    (handoff: ProfessorMariHandoff) => {
      if (handoff.draft !== undefined) setDraft(handoff.draft);
      setHandoffContext(handoff.context ?? null);
      if (handoff.completion?.kind === "return-to-source") {
        setRecovery(null);
      }
      setChatWindowOpen(true);
      focusComposer();
    },
    [focusComposer, setChatWindowOpen, setDraft, setRecovery],
  );

  useEffect(() => {
    const destination = omnibarMode ? "omnibar" : "home";
    const pending = consumeProfessorMariOpenRequest(destination);
    if (pending) applyHandoff(pending);
    const handleOpen = (event: Event) => {
      const handoff = (event as CustomEvent<ProfessorMariOpenDetail>).detail;
      if ((handoff.destination ?? "home") !== destination) return;
      applyHandoff(consumeProfessorMariOpenRequest(destination) ?? handoff);
    };
    window.addEventListener(PROFESSOR_MARI_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(PROFESSOR_MARI_OPEN_EVENT, handleOpen);
  }, [applyHandoff, omnibarMode]);

  // Direct prop channel (e.g. the omnibar Mari pane) — avoids the global open
  // event so a co-mounted Home instance never steals the handoff context.
  // Read when the history load lands, not when it starts: M9's arrival context can come in a commit
  // after this pane mounted, and the load must not then restore an older focus over it.
  const initialAskContextRef = useRef(initialAskContext);
  useEffect(() => {
    initialAskContextRef.current = initialAskContext;
    if (initialAskContext) setHandoffContext(initialAskContext);
  }, [initialAskContext]);

  const loadMessages = useCallback(
    async (
      id: string,
      options: {
        restoreFocus?: boolean | (() => boolean);
        shouldApply?: () => boolean;
        /** The same request, already started (the first load's, beside the arrival routing). */
        prefetched?: Promise<Message[]>;
      } = {},
    ) => {
      messageLoadAbortRef.current?.abort();
      const controller = new AbortController();
      messageLoadAbortRef.current = controller;
      try {
        const items = await (options.prefetched ?? fetchMariThreadMessages(id, controller.signal));
        if (
          controller.signal.aborted ||
          messageLoadAbortRef.current !== controller ||
          activeChatIdRef.current !== id ||
          options.shouldApply?.() === false
        ) {
          return;
        }
        // Unchanged messages keep their objects, so a reload (or the refresh behind a cached thread) only
        // renders the rows that changed.
        const normalizedMessages = keepUnchangedMessages(
          messagesRef.current,
          items.map((message) => ({ ...message, extra: toMessageExtra(message) })),
        );
        setMessages(normalizedMessages);
        let restoredContext: ProfessorMariAskContext | null = null;
        for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
          const messageContext = getProfessorMariMessageContext(normalizedMessages[index]!);
          if (messageContext === undefined) continue;
          restoredContext = messageContext;
          break;
        }
        const restoreFocus =
          typeof options.restoreFocus === "function" ? options.restoreFocus() : options.restoreFocus !== false;
        if (restoreFocus) setHandoffContext(persistentResourceContext(restoredContext));
        setLoadedMessagesChatId(id);
        return normalizedMessages;
      } catch (error) {
        if (controller.signal.aborted) return;
        throw error;
      } finally {
        if (messageLoadAbortRef.current === controller) messageLoadAbortRef.current = null;
      }
    },
    [],
  );

  const loadChatHistory = useCallback(async () => {
    setChatHistoryLoading(true);
    try {
      const items = await api.get<ProfessorMariChatSummary[]>("/chats/internal/professor-mari/chats");
      rememberMariThreads(items);
      setChatHistory(items);
      setSelectedChatHistoryIds((current) => {
        const availableIds = new Set(items.map((item) => item.id));
        return new Set([...current].filter((id) => availableIds.has(id)));
      });
    } finally {
      setChatHistoryLoading(false);
    }
  }, []);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const response = await api.get<MariWorkspaceSkillsResponse>("/professor-mari/workspace/skills");
      setSkills(response.skills);
      setSkillsDiagnostics(response.diagnostics);
      const isInitialSkillsLoad = !hasLoadedSkillsRef.current;
      hasLoadedSkillsRef.current = true;
      setSelectedSkillId((current) => {
        if (current && response.skills.some((skill) => skill.id === current)) return current;
        // Only auto-expand the first row on the very first load. On later refreshes, keep the user's
        // choice: a null (collapsed) selection stays collapsed, and a removed selection falls back to
        // null instead of reopening the first row.
        return isInitialSkillsLoad ? (response.skills[0]?.id ?? null) : null;
      });
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    const seq = ++memoriesLoadSeqRef.current;
    setMemoriesLoading(true);
    try {
      const response = await api.get<MariInstructionsResponse>("/professor-mari/workspace/instructions");
      // Ignore a stale response that resolved after a newer load (mount load vs post-write refresh),
      // so an older list can't overwrite the newer one or reset the selection.
      if (seq !== memoriesLoadSeqRef.current) return;
      setMemories(response.instructions);
      // Memories open collapsed; only a row the user opened stays open across refreshes.
      setSelectedMemoryId((current) =>
        current && response.instructions.some((memory) => memory.id === current) ? current : null,
      );
    } finally {
      if (seq === memoriesLoadSeqRef.current) setMemoriesLoading(false);
    }
  }, []);

  const ensureProfessorMariChat = useCallback(
    async (connectionId: string | null) => {
      const params = new URLSearchParams();
      if (connectionId) params.set("connectionId", connectionId);
      const query = params.toString();
      const chat = await api.get<Chat>(`/chats/internal/professor-mari${query ? `?${query}` : ""}`);
      setActiveChatId(chat.id);
      // The ensure/restart/activate writes in this file are deliberately
      // unguarded (#5641): each loads or switches to a Mari chat whose id is
      // unknown before the request, with no concurrent local metadata edits
      // to protect.
      qc.setQueryData(chatKeys.detail(chat.id), chat);
      return chat;
    },
    [qc, setActiveChatId],
  );

  /** A fresh thread about `context` ("+", or an arrival with no thread for its screen yet). The open one is kept. */
  const startMariThread = useCallback(
    async (context: MariThreadContext | null) => {
      const params = new URLSearchParams();
      // The ref, not the render's effectiveConnectionId: the first-load arrival starts a thread right
      // after restoring her connection, before a re-render, and the stale fallback (the default
      // connection, often a chat's small one) would move her thread onto it.
      const latest = latestConnectionSelectionRef.current;
      const connectionId =
        latest && connectionOptions.some((connection) => connection.id === latest) ? latest : effectiveConnectionId;
      if (connectionId) params.set("connectionId", connectionId);
      if (context) params.set("contextKey", context.key);
      if (context?.label) params.set("contextLabel", context.label);
      const chat = await api.post<Chat>(`/chats/internal/professor-mari/restart?${params.toString()}`);
      setActiveChatId(chat.id);
      qc.setQueryData(chatKeys.detail(chat.id), chat);
      return chat;
    },
    [connectionOptions, effectiveConnectionId, qc, setActiveChatId],
  );

  // R7: route an arrival to its context's thread before that thread's messages load, so the old one never flashes.
  const arrivalThreadRef = useRef(arrivalThread);
  arrivalThreadRef.current = arrivalThread;
  const arrivalAppendRequestRef = useRef(arrivalAppendRequest);
  arrivalAppendRequestRef.current = arrivalAppendRequest;
  const handledArrivalRouteRef = useRef(0);
  const [routedArrivalRequest, setRoutedArrivalRequest] = useState(0);
  /** The thread an arrival offered "Continue here / New about ..." in, while that choice is open. */
  const [arrivalChoiceChatId, setArrivalChoiceChatId] = useState<string | null>(null);
  const routeArrivalThread = useCallback(
    async (currentId: string): Promise<string> => {
      const request = arrivalAppendRequestRef.current;
      const context = arrivalThreadRef.current;
      if (!context || request <= handledArrivalRouteRef.current) return currentId;
      handledArrivalRouteRef.current = request;
      try {
        const threads = await api.get<ProfessorMariChatSummary[]>("/chats/internal/professor-mari/chats");
        rememberMariThreads(threads);
        const choice = chooseMariThread({
          threads: threads.map(readMariThread),
          contextKey: context.key,
          continuedThereId: continuedThereByContext.get(context.key),
        });
        if (choice.kind === "new") return (await startMariThread(context)).id;
        const targetId = choice.kind === "continue" ? choice.chatId : choice.recentChatId;
        setArrivalChoiceChatId(choice.kind === "ask" ? targetId : null);
        if (targetId !== currentId) {
          const chat = await api.post<Chat>(`/chats/internal/professor-mari/chats/${targetId}/activate`);
          setActiveChatId(chat.id);
          qc.setQueryData(chatKeys.detail(chat.id), chat);
        }
        return targetId;
      } catch (error) {
        // The open thread is still a fine place to land.
        console.error("[Professor Mari] Failed to pick the thread for this screen", error);
        return currentId;
      } finally {
        setRoutedArrivalRequest(request);
      }
    },
    [qc, setActiveChatId, startMariThread],
  );

  // #5073: attaching chat history needs a Mari workspace chat to attach TO; create one if the user
  // hasn't sent a message yet, then open the picker (the picker itself is gated on a live chatId).
  const handleOpenHistoryPicker = useCallback(async () => {
    if (!activeChatIdRef.current) {
      try {
        await ensureProfessorMariChat(effectiveConnectionId);
      } catch {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryNeedsChat"));
        return;
      }
    }
    setHistoryPickerOpen(true);
  }, [ensureProfessorMariChat, effectiveConnectionId, localizeUi]);

  // The Context Viewer is gated on a live chatId too (attachModals), so ensure one before opening —
  // otherwise the menu item would be a silent no-op when the user hasn't sent a message yet.
  const handleOpenContextViewer = useCallback(async () => {
    if (!activeChatIdRef.current) {
      try {
        await ensureProfessorMariChat(effectiveConnectionId);
      } catch {
        toast.error(localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryNeedsChat"));
        return;
      }
    }
    setContextViewerOpen(true);
  }, [ensureProfessorMariChat, effectiveConnectionId, localizeUi]);

  const refreshWorkspaceStatus = useCallback(
    async (shouldApply?: () => boolean) => {
      // #5725: the server resolves the EFFECTIVE mode (chat override ?? global
      // default) for the chat we name here - so a response is only valid for
      // the chat that was active when the request STARTED.
      const chatIdAtStart = activeChatIdRef.current;
      const params = new URLSearchParams();
      if (effectiveConnectionId) params.set("connectionId", effectiveConnectionId);
      if (chatIdAtStart) params.set("chatId", chatIdAtStart);
      const query = params.toString();
      const writeSeqAtStart = permissionsModeWriteSeqRef.current;
      const status = await api.get<MariWorkspaceStatus>(`/professor-mari/workspace/status${query ? `?${query}` : ""}`);
      if (shouldApply?.() === false || activeChatIdRef.current !== chatIdAtStart) return status;
      // A mode write that landed while this poll was in flight is newer than
      // the polled value - keep the current mode fields, apply the rest.
      setWorkspaceStatus((current) =>
        current &&
        (permissionsModeWriteSeqRef.current !== writeSeqAtStart ||
          (permissionsModeWritePendingCountRef.current > 0 &&
            permissionsModeWritePendingChatRef.current === chatIdAtStart))
          ? {
              ...status,
              permissionsMode: current.permissionsMode,
              permissionsModeDefault: current.permissionsModeDefault,
              permissionsModeSource: current.permissionsModeSource,
            }
          : status,
      );
      return status;
    },
    [effectiveConnectionId],
  );

  const refreshApprovalSurfaces = useCallback(async () => {
    await refreshWorkspaceStatus().catch(() => undefined);
    // Refresh the Memories panel after a keep or restore: a kept memory has to show
    // up, and reverting a memory insert deletes the row, so the panel would keep
    // rendering a stale client-side entry.
    await loadMemories().catch(() => undefined);
  }, [loadMemories, refreshWorkspaceStatus]);

  // #5725: the status payload is CHAT-SCOPED (effective mode for the active
  // chat), so a chat switch must refetch it immediately - the 15s interval
  // alone leaves the shield showing the PREVIOUS chat's mode in exactly the
  // window where the user reads it and decides to send. The guard drops the
  // response if the user switched again while it was in flight.
  useEffect(() => {
    if (!chatId) return;
    const id = chatId;
    void refreshWorkspaceStatus(() => activeChatIdRef.current === id).catch(() => undefined);
  }, [chatId, refreshWorkspaceStatus]);

  const invalidateWorkspaceData = useCallback(async () => {
    // Invalidation marks every query stale either way; the default 'active'
    // refetch pulls only what is mounted now, and everything else refreshes on
    // its next mount. refetchType:'all' here made every cached chat re-drain
    // its full message page history on each Mari workspace change (#4703).
    await qc.invalidateQueries();
  }, [qc]);

  const invalidateActionResult = useCallback(
    async (result: MariWorkspaceActionResult) => {
      if (result.resource.kind === "character") {
        await Promise.all([
          qc.invalidateQueries({ queryKey: characterKeys.all }),
          qc.invalidateQueries({ queryKey: characterKeys.detail(result.resource.id) }),
        ]);
      } else if (result.resource.kind === "persona") {
        await Promise.all([
          qc.invalidateQueries({ queryKey: characterKeys.personas }),
          qc.invalidateQueries({ queryKey: characterKeys.personaDetail(result.resource.id) }),
        ]);
      } else if (result.resource.kind === "lorebook") {
        await qc.invalidateQueries({ queryKey: lorebookKeys.all });
      } else {
        await qc.invalidateQueries({ queryKey: presetKeys.all });
      }
    },
    [qc],
  );

  useEffect(() => {
    void fetchSidecarStatus();
  }, [fetchSidecarStatus]);

  useEffect(() => {
    if (!workspaceStatus) return;
    const workspaceHistory = workspaceStatus.history ?? [];
    // Slice 70: changes approved before the panel opened were refreshed when they were approved. Treating them
    // as new on every open re-fetched every app query (~35 requests) in front of the thread's messages.
    if (!handledWorkspaceRefreshIdsRef.current) {
      handledWorkspaceRefreshIdsRef.current = new Set(
        workspaceHistory.filter((entry) => entry.status === "approved").map((entry) => entry.id),
      );
      return;
    }
    const handled = handledWorkspaceRefreshIdsRef.current;
    const visibleHistoryIds = new Set(workspaceHistory.map((entry) => entry.id));
    for (const id of handled) {
      if (!visibleHistoryIds.has(id)) handled.delete(id);
    }

    const appliedChanges = workspaceHistory.filter((entry) => {
      if (entry.status !== "approved") return false;
      return !handled.has(entry.id);
    });
    if (appliedChanges.length === 0) return;
    for (const entry of appliedChanges) {
      handled.add(entry.id);
    }
    void invalidateWorkspaceData().catch((error) => {
      console.error("[Professor Mari] Failed to refresh app data after workspace change", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariAppliedAWorkspaceChangeButAppData"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [invalidateWorkspaceData, workspaceStatus, localizeUi]);

  useEffect(() => {
    latestConnectionSelectionRef.current = selectedConnectionId;
  }, [selectedConnectionId]);

  useEffect(() => {
    if (hasLoadedRef.current || connectionsLoading) return;
    hasLoadedRef.current = true;
    setLoadingHistory(true);
    const prefetchMessages = (id: string) => {
      const items = fetchMariThreadMessages(id);
      items.catch(() => undefined);
      return { id, items };
    };
    let prefetched = cachedThread ? prefetchMessages(cachedThread.chatId) : null;
    const storedConnectionExists =
      !!selectedConnectionId && connectionOptions.some((connection) => connection.id === selectedConnectionId);
    ensureProfessorMariChat(storedConnectionExists ? selectedConnectionId : null)
      .then(async (chat) => {
        // Her messages load beside the routing; it usually keeps the thread she is already in.
        if (prefetched?.id !== chat.id) prefetched = prefetchMessages(chat.id);
        const restoredConnectionId =
          typeof chat.connectionId === "string" && chat.connectionId ? chat.connectionId : null;
        if (restoredConnectionId) {
          setSelectedConnectionId(restoredConnectionId);
          latestConnectionSelectionRef.current = restoredConnectionId;
          useUIStore.getState().setMariConnectionId(restoredConnectionId);
        }
        const targetId = await routeArrivalThread(chat.id);
        return loadMessages(targetId, {
          restoreFocus: () => !initialAskContextRef.current,
          prefetched: prefetched.id === targetId ? prefetched.items : undefined,
        });
      })
      .catch((error) => {
        console.error("[Professor Mari] Failed to load home assistant", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotLoad"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      })
      .finally(() => setLoadingHistory(false));
  }, [
    connectionOptions,
    connectionsLoading,
    ensureProfessorMariChat,
    loadMessages,
    routeArrivalThread,
    selectedConnectionId,
    cachedThread,
    localizeUi,
  ]);

  // Missing workspace tools (often just no admin secret) are a calm note in the transcript, not a toast
  // that covers her header every time she opens. Status, skills and memories all report here once.
  const [workspaceToolsIssue, setWorkspaceToolsIssue] = useState<string | null>(null);
  const reportWorkspaceToolsIssue = useCallback(
    (error: unknown, fallback?: string) =>
      setWorkspaceToolsIssue(
        (current) =>
          current ??
          (error instanceof ApiError && (error.status === 401 || error.status === 403)
            ? localizeUi("ui.chat.homeprofessormarichat.professorMariWorkspaceToolsNeedAdminAccess")
            : (fallback ?? describeProfessorMariError(error))),
      ),
    [localizeUi],
  );
  useEffect(() => {
    if (!pageActive) return;
    void refreshWorkspaceStatus().catch((error) => {
      setWorkspaceStatus((current) => current && { ...current, error: "Workspace status unavailable" });
      reportWorkspaceToolsIssue(
        error,
        localizeUi("ui.chat.homeprofessormarichat.workspaceImportsAndChangesMayNotShowLiveProgress"),
      );
    });
    const refreshVisibleWorkspaceStatus = () => {
      if (document.hidden) return;
      void refreshWorkspaceStatus().catch(() => undefined);
    };
    const timer = window.setInterval(refreshVisibleWorkspaceStatus, 15_000);
    document.addEventListener("visibilitychange", refreshVisibleWorkspaceStatus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleWorkspaceStatus);
    };
  }, [pageActive, refreshWorkspaceStatus, localizeUi, reportWorkspaceToolsIssue]);

  // Recovery for runs this client is no longer attached to (#5719): if the
  // status poll watches a server-side run finish while no local send closure
  // is driving it — the stream died, or Mini-Mari was closed and reopened —
  // reload the persisted reply so it does not sit invisible until a manual
  // chat switch. Arming requires TWO status writes observing the run active
  // with no local closure (a single observation is routinely the STALE
  // active:true a local run's finally leaves behind for one render before
  // refreshAfterWorkspaceRun's own refresh lands — firing on that duplicated
  // the reload and the app-wide invalidation for every long local run), and
  // both the fire and the reload's shouldApply are pinned to the armed run id
  // so a new local send cancels the recovery instead of racing it. Deps use
  // the status OBJECT deliberately: each poll writes a fresh object, and the
  // observation count must advance on same-value active readings.
  const detachedRunArmingRef = useRef<{ observations: number; runId: number } | null>(null);
  useEffect(() => {
    const remoteActive = workspaceStatus?.active === true;
    if (remoteActive && !workspaceActive) {
      const runId = workspaceRunIdRef.current;
      const current = detachedRunArmingRef.current;
      detachedRunArmingRef.current =
        current && current.runId === runId
          ? { observations: current.observations + 1, runId }
          : { observations: 1, runId };
      return;
    }
    const armed = detachedRunArmingRef.current;
    detachedRunArmingRef.current = null;
    if (
      !remoteActive &&
      !workspaceActive &&
      armed &&
      armed.observations >= 2 &&
      armed.runId === workspaceRunIdRef.current
    ) {
      const chatIdToReload = activeChatIdRef.current;
      const armedRunId = armed.runId;
      if (chatIdToReload) {
        void loadMessages(chatIdToReload, {
          shouldApply: () => activeChatIdRef.current === chatIdToReload && workspaceRunIdRef.current === armedRunId,
        }).catch((error) => {
          console.error("[Professor Mari] Failed to reload messages after a detached workspace run", error);
        });
        void invalidateWorkspaceData();
      }
    }
  }, [workspaceStatus, workspaceActive, loadMessages, invalidateWorkspaceData]);

  useEffect(() => {
    void loadSkills().catch((error) => {
      console.error("[Professor Mari] Failed to load skills", error);
      setSkillsDiagnostics(["Professor Mari skills unavailable"]);
      reportWorkspaceToolsIssue(error);
    });
  }, [loadSkills, reportWorkspaceToolsIssue]);

  useEffect(() => {
    if (!chatHistoryOpen) return;
    void loadChatHistory().catch((error) => {
      console.error("[Professor Mari] Failed to load chats", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotLoadHerPreviousChats"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    });
  }, [chatHistoryOpen, loadChatHistory, localizeUi]);

  useEffect(() => {
    if (chatHistoryOpen) return;
    setChatHistorySelectionMode(false);
    setSelectedChatHistoryIds(new Set());
  }, [chatHistoryOpen]);

  useEffect(() => {
    const id = selectedSkill?.id ?? null;
    // Only reload the draft when the SELECTED skill changes, not when the same skill's row ref
    // changes because the enabled toggle refetched it, which would silently clobber unsaved
    // name/description/content edits (the toggle sits on the row, above the open editor).
    if (id === lastSyncedSkillIdRef.current) return;
    lastSyncedSkillIdRef.current = id;
    if (!selectedSkill) {
      setSkillDraft({ name: "", description: "", content: "" });
      return;
    }
    setSkillDraft({
      name: selectedSkill.name,
      description: selectedSkill.description,
      content: selectedSkill.content,
    });
  }, [selectedSkill]);

  useEffect(() => {
    void loadMemories().catch((error) => {
      console.error("[Professor Mari] Failed to load memories", error);
      reportWorkspaceToolsIssue(error);
    });
  }, [loadMemories, reportWorkspaceToolsIssue]);

  useEffect(() => {
    const id = selectedMemory?.id ?? null;
    // Only reload the draft when the SELECTED memory changes, not when the same memory's row
    // ref changes because a flag toggle (enable/Persistent) refetched it, which would silently
    // clobber unsaved name/description/content edits, since the Persistent toggle sits in the pane.
    if (id === lastSyncedMemoryIdRef.current) return;
    lastSyncedMemoryIdRef.current = id;
    if (!selectedMemory) {
      setMemoryDraft({ name: "", description: "", content: "" });
      return;
    }
    setMemoryDraft({
      name: selectedMemory.name,
      description: selectedMemory.description,
      content: selectedMemory.content,
    });
  }, [selectedMemory]);

  const pendingChangeReviews = useMemo(
    () => workspaceStatus?.pendingApprovals ?? [],
    [workspaceStatus?.pendingApprovals],
  );

  // Alert the user when Professor Mari finished her work and is now blocked
  // waiting on an approval. The notification helpers no-op while the app is
  // focused, so a present user just sees the in-app review card. Reviews are
  // re-fetched from the workspace service on re-entry, so the card is already waiting too.
  useEffect(() => {
    const fresh = pendingChangeReviews.filter((approval) => !notifiedApprovalIdsRef.current.has(approval.id));
    const liveIds = new Set(pendingChangeReviews.map((approval) => approval.id));
    for (const id of notifiedApprovalIdsRef.current) if (!liveIds.has(id)) notifiedApprovalIdsRef.current.delete(id);
    if (fresh.length === 0) return;
    for (const approval of fresh) notifiedApprovalIdsRef.current.add(approval.id);
    const uiState = useUIStore.getState();
    const notification = {
      characterName: "Professor Mari",
      title: "Professor Mari needs your approval",
      tag: "marinara-mari-approval",
    };
    void showLocalMessageNotification({ ...notification, enabled: uiState.generationBrowserNotifications });
    showNativeMessageNotification({ ...notification, enabled: uiState.generationMobileNotifications });
  }, [pendingChangeReviews]);

  const workspaceTimelineActive = workspaceActive || hasActiveGeneration || serverRunningHere;
  // When a run ends, the composer halo flashes once and lets go instead of vanishing mid-turn. Set while
  // rendering (not in an effect), so the arrival routing below never sees the end of a run without it.
  const [composerHaloEnding, setComposerHaloEnding] = useState(false);
  const [haloSeenActive, setHaloSeenActive] = useState(workspaceTimelineActive);
  if (haloSeenActive !== workspaceTimelineActive) {
    setHaloSeenActive(workspaceTimelineActive);
    setComposerHaloEnding(!workspaceTimelineActive);
  }
  useEffect(() => {
    if (!composerHaloEnding) return;
    // Long enough for the faint green glow to sink out of view (mari-glow-settle) and her success story
    // to finish on the "Worked for" line before she rests.
    const timer = window.setTimeout(() => setComposerHaloEnding(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [composerHaloEnding]);
  // UX-03: a run that was still going when the window (re)opened (a reload, another device) ends with its
  // answer saved on the server only. Reload the thread once it ends, or the answer waits for a reopen.
  const timelineRunActiveRef = useRef(workspaceTimelineActive);
  useEffect(() => {
    const ended = timelineRunActiveRef.current && !workspaceTimelineActive;
    timelineRunActiveRef.current = workspaceTimelineActive;
    if (!ended || !chatId) return;
    void loadMessages(chatId, { restoreFocus: false, shouldApply: () => activeChatIdRef.current === chatId }).catch(
      () => undefined,
    );
  }, [workspaceTimelineActive, chatId, loadMessages]);
  const emptyStateReady =
    omnibarMode && messages.length === 0 && !isBusy && chatId !== null && loadedMessagesChatId === chatId;
  // D1: an arrival door (⌘J, the pull, the drag, Home's "Ask Professor Mari") opened into a chat that
  // already has history. Append the same arrival content (`buildMariArrival`'s output, unchanged) at
  // the bottom of the transcript instead of only showing it on an empty chat, so the door's "ask Mari
  // about this" promise still holds on a return visit. Local UI only: never persisted, no model call.
  const appendedArrivalReady = shouldAppendMariArrival({
    omnibarMode,
    messageCount: messages.length,
    chatId,
    loadedMessagesChatId,
  });
  const [appendedArrival, setAppendedArrival] = useState<MariArrival | null>(null);
  const handledArrivalAppendRequestRef = useRef(0);
  // R7: an arrival after the first load (the pane was already open) routes here.
  useEffect(() => {
    if (!arrivalThread || arrivalAppendRequest <= handledArrivalRouteRef.current) return;
    // R13: an arrival during a run waits until the finished run (its done marks, "Worked for") has been on
    // screen for the halo's settle time; rerouting the moment isBusy cleared wiped it unseen.
    if (loadingHistory || isBusy || composerHaloEnding || !chatId || loadedMessagesChatId !== chatId) return;
    void routeArrivalThread(chatId).then((targetId) => {
      if (targetId === chatId) return;
      setWorkspaceTimeline([]);
      setWorkspaceRunClock(null);
      return loadMessages(targetId);
    });
  }, [
    arrivalAppendRequest,
    arrivalThread,
    chatId,
    composerHaloEnding,
    isBusy,
    loadMessages,
    loadedMessagesChatId,
    loadingHistory,
    routeArrivalThread,
  ]);
  useEffect(() => {
    if (arrivalAppendRequest <= handledArrivalAppendRequestRef.current) return;
    // R7: wait for the arrival's thread, so it is not appended to the one being left.
    if (arrivalThread && routedArrivalRequest < arrivalAppendRequest) return;
    if (!appendedArrivalReady || !arrival || workspaceTimelineActive) return;
    handledArrivalAppendRequestRef.current = arrivalAppendRequest;
    setAppendedArrival(arrival);
  }, [
    arrivalAppendRequest,
    appendedArrivalReady,
    arrival,
    arrivalThread,
    routedArrivalRequest,
    workspaceTimelineActive,
  ]);
  // R7: "New about <context>" from the arrival's choice: a fresh thread for this screen, the open one kept.
  const handleNewAboutContext = useCallback(async () => {
    const context = arrivalThreadRef.current;
    if (!context || isBusy) return;
    try {
      const chat = await startMariThread(context);
      setArrivalChoiceChatId(null);
      setAppendedArrival(null);
      setMessages([]);
      setLoadedMessagesChatId(chat.id);
      setWorkspaceTimeline([]);
      setWorkspaceRunClock(null);
      if (chatHistoryOpen) await loadChatHistory();
    } catch (error) {
      console.error("[Professor Mari] Failed to start a thread for this screen", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotOpenThatChat"), {
        description: describeProfessorMariError(error),
      });
    }
  }, [chatHistoryOpen, isBusy, loadChatHistory, localizeUi, startMariThread]);
  const appendedArrivalNodeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (appendedArrival) appendedArrivalNodeRef.current?.scrollIntoView({ block: "nearest" });
  }, [appendedArrival]);
  // M4/M3: the timeline stays mounted (and keeps the transcript's height) through the reload that
  // applies the reply, and keeps showing workspaceTimeline (now with active=false) as the turn's
  // permanent record afterward - it is only cleared when the next send or chat switch starts a new run.
  const workspaceTimelineVisible = workspaceTimelineActive || workspaceTimeline.length > 0;
  const visiblePendingChangeReviews = useMemo(
    () => (!sending && !workspaceTimelineActive ? pendingChangeReviews : []),
    [pendingChangeReviews, sending, workspaceTimelineActive],
  );
  const visiblePendingChangeReviewKey = visiblePendingChangeReviews.map((approval) => approval.id).join("|");
  const latestMessage = messages[messages.length - 1];
  const lastUserMessage = messages.findLast((message) => message.role === "user");
  // R14: the one unresolved failure - this session's, or the one saved on the newest turn (after a reload,
  // or when the stream died before it could say so). She stays red until Retry, another model, a new
  // message or Dismiss; there is no timer.
  const savedRunError = latestMessage ? getMessageRunError(latestMessage) : null;
  const activeRunError = isBusy
    ? null
    : recovery
      ? { kind: recovery.kind, detail: recovery.detail }
      : savedRunError
        ? { kind: classifyProfessorMariFailure(new Error(savedRunError.message)), detail: savedRunError.message }
        : null;
  const latestActionResults = useMemo(
    () => (latestMessage ? getMessageWorkspaceActionResults(latestMessage) : []),
    [latestMessage],
  );
  const mariPresentationState = resolveProfessorMariPresentationState({
    hasRecovery: Boolean(activeRunError),
    hasWorkspaceError: Boolean(workspaceStatus?.error),
    pendingReviewCount: countBlockingReviews(visiblePendingChangeReviews),
    working: workspaceTimelineActive,
    hasDraft: Boolean(draft.trim()),
    attachmentCount: attachments.length,
    hasActionResult: latestActionResults.length > 0,
    messageCount: messages.length,
  });
  // Outcomes come from runtime state, never from words in the assistant's reply.
  // Slice 72: a read she worked around is not a failure (no retry pose for a missing record she skipped).
  const latestTrace = latestMessage ? getMessageWorkspaceTrace(latestMessage) : null;
  const latestTraceFailed =
    latestMessage && latestTrace
      ? timelineItemsFromTrace(latestTrace, latestMessage).some(
          (item) => item.type === "tool" && isHardStepFailure(item.tool),
        )
      : false;
  // A reply with a stored run shows Mari on its own timeline line; one without needs her line below it.
  const latestTurnHasTrace = Boolean(latestMessage && getMessageWorkspaceTrace(latestMessage));
  const restingStory = resolveMariRestStory({
    working: workspaceTimelineActive,
    failed: Boolean(activeRunError || workspaceStatus?.error) || latestTraceFailed,
    cancelled: Boolean(chatId && cancelledChatId === chatId),
    needsApproval: visiblePendingChangeReviews.length > 0 || Boolean(pendingDeferredMutations),
    hasAppliedChanges: latestActionResults.length > 0,
  });
  // I4: on the newest finished turn Mari stands on the "Worked for" line: her story (success just after
  // the run, then idle), or the retry / stopped / approval story while that is her state.
  const latestTurnRestStory: MariStoryState | null = workspaceTimelineActive
    ? null
    : restingStory && restingStory !== "success"
      ? restingStory
      : composerHaloEnding
        ? "success"
        : "idle";
  // The glow behind the composer takes her state's color: cyan while she thinks, pink while she writes,
  // her full logo while a tool runs, gold when she waits for you, red when something broke.
  const lastWorkItemType = workspaceTimeline.at(-1)?.type;
  const composerGlowTone =
    mariPresentationState !== "working"
      ? mariPresentationState
      : lastWorkItemType === "text"
        ? "writing"
        : lastWorkItemType === "tool"
          ? "working"
          : "thinking";
  const composerWorkingState = workspaceTimelineActive
    ? "true"
    : composerHaloEnding && composerGlowTone !== "broken"
      ? "ending"
      : undefined;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const decision = transcriptScrollAction({
      event: "grow",
      nearBottom: isProfessorMariTranscriptNearBottom(node),
      following: transcriptFollowOutputRef.current,
    });
    if (decision.scrollTo === "bottom") scrollProfessorMariTranscriptToBottom(node);
  }, [messages, workspaceTimeline, visiblePendingChangeReviewKey, workspaceStatus?.error, activeRunError?.detail]);

  // Scrolled up to read: a small round arrow above the composer brings you back to the newest line.
  // Same-value state updates bail out, so this re-renders only when the pill appears or leaves.
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const transcriptGlideCleanupRef = useRef<(() => void) | null>(null);
  const setTranscriptStackNode = useCallback((node: HTMLDivElement | null) => {
    transcriptGlideCleanupRef.current?.();
    transcriptGlideCleanupRef.current = node?.parentElement
      ? followTranscriptGrowth(
          node.parentElement,
          node,
          () => transcriptFollowOutputRef.current,
          (newerBelow) => {
            if (newerBelow) setShowJumpToLatest(true);
          },
        )
      : null;
  }, []);

  const handleTranscriptScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (suppressNextScrollEventRef.current) {
      suppressNextScrollEventRef.current = false;
      return;
    }
    const decision = transcriptScrollAction({
      event: "user-scroll",
      nearBottom: isProfessorMariTranscriptNearBottom(node),
      following: transcriptFollowOutputRef.current,
    });
    transcriptFollowOutputRef.current = decision.following;
    setShowJumpToLatest(!transcriptFollowOutputRef.current);
  }, []);
  const jumpToLatest = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    transcriptFollowOutputRef.current = true;
    node.scrollTo({ top: node.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    setShowJumpToLatest(false);
  }, [reduceMotion]);

  // M4: the instant the local user message commits, put its top under the header once and reserve the
  // turn's height so her reply grows into empty space - following starts false, the opposite of "stay
  // pinned to the bottom", until the reader scrolls there themselves.
  useLayoutEffect(() => {
    if (!turnStartMessageId) return;
    const node = scrollRef.current;
    const turn = activeTurnRef.current;
    if (!node || !turn) return;
    const dockHeight = composerDockRef.current?.offsetHeight ?? 0;
    turn.style.minHeight = `${Math.max(0, node.clientHeight - dockHeight)}px`;
    const decision = transcriptScrollAction({
      event: "send",
      nearBottom: isProfessorMariTranscriptNearBottom(node),
      following: transcriptFollowOutputRef.current,
    });
    transcriptFollowOutputRef.current = decision.following;
    setShowJumpToLatest(false);
    if (decision.scrollTo === "top") {
      // Instant, not smooth: a multi-frame animation would fire more than the one "scroll" event the
      // suppress guard below swallows. The guard self-clears next frame too, in case the target position
      // equals the current one and the browser never fires a "scroll" event to consume it.
      suppressNextScrollEventRef.current = true;
      node.scrollTo({ top: turn.offsetTop - 16, behavior: "auto" });
      window.requestAnimationFrame(() => {
        suppressNextScrollEventRef.current = false;
      });
    }
  }, [turnStartMessageId]);

  // Opening a different chat is not a send: drop the reservation and land on its history as before.
  useLayoutEffect(() => {
    setTurnStartMessageId(null);
    activeTurnRef.current?.style.removeProperty("min-height");
  }, [chatId]);

  const displayMessages = messages;
  const lastUserMessageId = messages.findLast((message) => message.role === "user")?.id;
  // M4: everything from the newest user message onward is "the active turn" - it reserves height and
  // never re-mounts mid-run (unlike the rest of the history, which renders plainly above it).
  const activeTurnStartIndex = lastUserMessageId
    ? displayMessages.findIndex((message) => message.id === lastUserMessageId)
    : displayMessages.length;
  const transcriptHeadMessages = displayMessages.slice(0, activeTurnStartIndex);
  const activeTurnMessages = displayMessages.slice(activeTurnStartIndex);
  const showConnectionFirstHint = shouldShowProfessorMariConnectionHint({
    chatId,
    loadedMessagesChatId,
    sending,
    effectiveConnectionId,
  });

  useEffect(() => {
    if (!mobileFocusMode) return;
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;
    const syncScrollLock = () => {
      if (!mediaQuery.matches) {
        setMobileFocusMode(false);
        document.body.style.overflow = previousOverflow;
        return;
      }
      document.body.style.overflow = "hidden";
    };
    syncScrollLock();
    mediaQuery.addEventListener("change", syncScrollLock);
    return () => {
      mediaQuery.removeEventListener("change", syncScrollLock);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFocusMode]);

  useEffect(() => {
    if (!connectionMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (connectionButtonRef.current?.contains(target) || connectionMenuRef.current?.contains(target)) return;
      setConnectionMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [connectionMenuOpen]);

  useEffect(() => {
    if (!permissionsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (permissionsButtonRef.current?.contains(target) || permissionsMenuRef.current?.contains(target)) return;
      setPermissionsMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [permissionsMenuOpen]);

  // The composer's mode and connection menus sit inside the omnibar dialog:
  // Escape closes the menu first, and only a second Escape reaches the dialog.
  const onPermissionsMenuKeyDown = useInDialogFocusScope(
    permissionsMenuRef,
    () => setPermissionsMenuOpen(false),
    permissionsMenuOpen,
  );
  const onConnectionMenuKeyDown = useInDialogFocusScope(
    connectionMenuRef,
    () => setConnectionMenuOpen(false),
    connectionMenuOpen,
  );
  // M6: a Chats row's Rename/Delete live in its own ⋮ menu.
  const onChatRowMenuKeyDown = useInDialogFocusScope(
    chatRowPopoverRef,
    () => setChatRowMenuId(null),
    chatRowMenuId !== null,
  );
  const onHeaderMenuKeyDown = useInDialogFocusScope(headerMenuRef, () => setHeaderMenuOpen(false), headerMenuOpen);
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !headerMenuRef.current?.parentElement?.contains(event.target)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [headerMenuOpen]);
  useEffect(() => {
    if (!chatRowMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !chatRowMenuRef.current?.contains(event.target)) setChatRowMenuId(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [chatRowMenuId]);

  // #5725: the server-authoritative Permissions Mode. Display rides the status
  // payload; writes go through the dedicated validated PUT. The change applies
  // to Mari's NEXT run - an in-flight turn is never aborted by a mode switch.
  const permissionsMode: MariPermissionsMode = workspaceStatus?.permissionsMode ?? DEFAULT_MARI_PERMISSIONS_MODE;
  const permissionsModeDefault: MariPermissionsMode =
    workspaceStatus?.permissionsModeDefault ?? DEFAULT_MARI_PERMISSIONS_MODE;
  const permissionsModeOverridden = workspaceStatus?.permissionsModeSource === "chat";
  // #5725 per-chat: the header picker writes THIS chat's override; null clears
  // it back to the global default (which Settings -> Application sets).
  const changePermissionsMode = useCallback(
    async (mode: MariPermissionsMode | null) => {
      setPermissionsMenuOpen(false);
      const chatIdForMode = activeChatIdRef.current;
      if (!chatIdForMode) return;
      const writeSeq = ++permissionsModeWriteSeqRef.current;
      // No same-value short-circuits: the check state can be stale for up to
      // one poll after a chat switch, and silently dropping the user's click
      // (especially a "Use default" de-escalation) is worse than sending an
      // idempotent write that converges via the refetch below.
      setWorkspaceStatus((current) =>
        current
          ? {
              ...current,
              permissionsMode: mode ?? current.permissionsModeDefault,
              permissionsModeSource: mode === null ? "default" : "chat",
            }
          : current,
      );
      permissionsModeWritePendingChatRef.current = chatIdForMode;
      permissionsModeWritePendingCountRef.current += 1;
      // Chained on the SHARED coordinator, not concurrent: rapid A-then-B
      // selections must persist in click order, and the chain also covers the
      // Settings panel's global-default writes.
      const write = enqueueMariPermissionsModeWrite(async () => {
        try {
          await api.put("/professor-mari/workspace/permissions-mode", { mode, chatId: chatIdForMode });
          // A status poll that was in flight during the PUT resolves with the
          // OLD mode and would clobber the optimistic patch - refetch so the
          // panel converges on the server value. Guarded: a chat switch or a
          // newer mode write while the refetch is in flight drops it.
          void refreshWorkspaceStatus(
            () => activeChatIdRef.current === chatIdForMode && permissionsModeWriteSeqRef.current === writeSeq,
          ).catch(() => undefined);
        } catch (error) {
          // Only the LATEST write may surface - a stale failure must not
          // clobber a newer selection that already succeeded. Refetch the
          // authoritative state rather than restoring a rendered snapshot
          // (which can itself be an optimistic value or another chat's).
          if (permissionsModeWriteSeqRef.current !== writeSeq) return;
          console.error("[Professor Mari] Failed to change permissions mode", error);
          toast.error(localizeUi("ui.chat.homeprofessormarichat.couldNotChangeThePermissionsMode"));
          void refreshWorkspaceStatus(
            () => activeChatIdRef.current === chatIdForMode && permissionsModeWriteSeqRef.current === writeSeq,
          ).catch(() => undefined);
        } finally {
          permissionsModeWritePendingCountRef.current -= 1;
          if (permissionsModeWritePendingCountRef.current <= 0) {
            permissionsModeWritePendingCountRef.current = 0;
            permissionsModeWritePendingChatRef.current = null;
          }
        }
      });
      await write;
    },
    [localizeUi, refreshWorkspaceStatus],
  );

  const persistLatestConnectionSelection = useCallback(() => {
    if (connectionPersistInFlightRef.current) return;
    connectionPersistInFlightRef.current = true;

    void (async () => {
      try {
        while (pendingConnectionPersistRef.current) {
          const id = pendingConnectionPersistRef.current;
          pendingConnectionPersistRef.current = null;
          try {
            await ensureProfessorMariChat(id);
          } catch (error) {
            if (!pendingConnectionPersistRef.current && latestConnectionSelectionRef.current === id) {
              console.error("[Professor Mari] Failed to save selected connection", error);
              toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRememberThatConnection"), {
                description: describeProfessorMariError(error),
                duration: 12_000,
              });
            }
          }
        }
      } finally {
        connectionPersistInFlightRef.current = false;
      }
    })();
  }, [ensureProfessorMariChat, localizeUi]);

  const handleConnectionChange = (id: string) => {
    setSelectedConnectionId(id);
    latestConnectionSelectionRef.current = id;
    pendingConnectionPersistRef.current = id;
    useUIStore.getState().setMariConnectionId(id);
    setConnectionMenuOpen(false);
    persistLatestConnectionSelection();
  };

  const closeChatWindow = useCallback(() => {
    setConnectionMenuOpen(false);
    setWorkspaceDestination("chat");
    setMobileFocusMode(false);
    setChatWindowOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [setChatWindowOpen]);

  useDialogFocusScope(chatWindowOpen && mobileFocusMode && !embeddedTab, mobileDialogRef, floatingTextareaRef);

  const openChatWindow = useCallback(() => {
    setWorkspaceDestination("chat");
    setConnectionMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (window.matchMedia("(max-width: 639px)").matches) {
      setMobileFocusMode(true);
      return;
    }
    setChatWindowOpen(true);
  }, [setChatWindowOpen]);

  const toggleSkillsMenu = useCallback(() => {
    const next = !skillsMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "skills" : "chat");
  }, [skillsMenuOpen]);

  const toggleMemoriesMenu = useCallback(() => {
    const next = !memoriesMenuOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "memories" : "chat");
  }, [memoriesMenuOpen]);

  const toggleChatHistory = useCallback(() => {
    if (!chatHistoryOpen && isBusy) {
      toast.info(localizeUi("ui.chat.homeprofessormarichat.waitForProfessorMariToFinishBeforeSwitchingChats"));
      return;
    }
    const next = !chatHistoryOpen;
    if (next) {
      setConnectionMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    setWorkspaceDestination(next ? "chats" : "chat");
  }, [chatHistoryOpen, isBusy, localizeUi]);

  useEffect(() => {
    window.addEventListener("marinara:home-professor-mari-close", closeChatWindow);
    return () => window.removeEventListener("marinara:home-professor-mari-close", closeChatWindow);
  }, [closeChatWindow]);

  // The omnibar can hand us a past conversation to open. The effect lives after
  // handleSelectProfessorChat so it can call it directly.
  const requestedChatIdRef = useRef<string | null>(null);

  // R7: "+" always starts fresh, about the screen she was opened from.
  const handleRestart = useCallback(async () => {
    const chat = await startMariThread(arrivalThreadRef.current ?? null);
    await api.post("/professor-mari/workspace/reset", { clearHistory: true });
    setMessages([]);
    setLoadedMessagesChatId(chat.id);
    setDraft("");
    clearMariChips();
    setWorkspaceActive(false);
    useChatStore.getState().clearStreamBuffer(chat.id);
    useChatStore.getState().clearThinkingBuffer(chat.id);
    useChatStore.getState().setAbortController(chat.id, null);
    useChatStore.getState().setMariPhase(chat.id, "idle");
    setWorkspaceTimeline([]);
    setWorkspaceRunClock(null);
    if (chatHistoryOpen) await loadChatHistory();
    await qc.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
    toast.success(localizeUi("ui.chat.homeprofessormarichat.professorMariSPreviousChatWasSaved"));
  }, [chatHistoryOpen, clearMariChips, loadChatHistory, qc, setDraft, startMariThread, localizeUi]);

  const guidedPlan = professorMariSuggestionsEnabled && mariPlanChatId === chatId ? mariPlan : null;
  const guidedPlanStep = guidedPlan ? (guidedPlan[mariPlanCursor] ?? null) : null;
  const chipRowChips = guidedPlanStep ? guidedPlanStep.chips : visibleSuggestionChips;
  // #5820: the Accept action for held edits is NOT a suggestion. Captioning
  // the row "Suggestions only" told users the one control that applies Mari's
  // pending changes was optional flavour text, so they concluded she had
  // silently done nothing - the visible half of the defer-and-approve
  // mechanism read as a failure of it.
  const chipRowAwaitsApproval = chipRowChips.some(isMariHeldChangeApprovalChip);
  // Slice 71 (N7): a held change is a "Needs you" card under her answer that says what Accept does and
  // carries Accept / Don't apply itself, so its chip row, hint line and status words go.
  const heldChangeCard = chipRowAwaitsApproval && !guidedPlanStep;
  const suggestionQuestion = guidedPlanStep
    ? guidedPlanStep.question
    : chipRowChips.length > 0
      ? messages.length === 0
        ? localizeUi("ui.chat.homeprofessormarichat.suggestions.start")
        : latestActionResults.length > 0
          ? localizeUi("ui.chat.homeprofessormarichat.suggestions.afterChange")
          : localizeUi("ui.chat.homeprofessormarichat.suggestions.next")
      : null;
  const suggestionsSuppressed = !["empty", "history", "completed"].includes(mariPresentationState);
  const showSuggestionPrompt =
    !heldChangeCard && !suggestionsSuppressed && Boolean(suggestionQuestion) && chipRowChips.length > 0;
  // M5b: plain next steps are cards under the turn; a plan step or a held change keeps its answer chips by the composer.
  const showNextStepCards = showSuggestionPrompt && messages.length > 0 && !guidedPlanStep && !chipRowAwaitsApproval;

  const runRestart = useCallback(async () => {
    if (isBusy) return;
    setSending(true);
    try {
      await handleRestart();
      clearMariPlan();
    } catch (error) {
      console.error("[Professor Mari] Failed to restart", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRestartHerNotes"));
    } finally {
      setSending(false);
    }
  }, [clearMariPlan, handleRestart, isBusy, localizeUi]);

  // Keep and restore live in a shared hook so the omnibar's approval rows do the
  // same thing, with the same toasts, as this pane.
  const {
    keepApproval: keepWorkspaceChange,
    restoreApproval: restoreWorkspaceChange,
    pendingId: sharedApprovalPendingId,
  } = useMariApprovals({ onRefresh: refreshApprovalSurfaces });
  // Single-row reject still runs from this component, so the busy state is the
  // union of both in-flight ids.
  const approvalBusyId = sharedApprovalPendingId ?? workspaceReviewActionId;

  // #4931: reject a single reviewed row (revert just that lorebook entry). Mirrors
  // restoreWorkspaceChange but posts the row's diffPreview index + identity tuple; the server reverts
  // only that row and either shrinks the pending card or resolves it.
  const rejectWorkspaceRows = useCallback(
    async (id: string, rows: Array<{ index: number; table: string; id: string; action: string }>): Promise<boolean> => {
      if (approvalBusyId) return false;
      setWorkspaceReviewActionId(id);
      try {
        const result = await api.post<{
          ok?: boolean;
          outcome?: string;
          error?: string | null;
          rejected?: number;
          remaining?: number;
          completed?: boolean;
        }>(`/professor-mari/workspace/approvals/${id}/reject-rows`, { rows });
        await refreshWorkspaceStatus().catch(() => undefined);
        // A rejected entry is deleted, so refresh any panel that mirrors app data.
        await loadMemories().catch(() => undefined);
        if (result.ok) {
          await invalidateWorkspaceData();
          toast.success(localizeUi("ui.chat.homeprofessormarichat.revertedTheSelectedEntry"));
          return true;
        }
        if (result.outcome === "state_changed") {
          toast.error(
            localizeUi("ui.chat.homeprofessormarichat.theWorkspaceChangedAfterProfessorMariStagedThisProposal"),
            { description: result.error ?? undefined, duration: 12_000 },
          );
        } else {
          toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRejectThatEntry"), {
            description: result.error ?? undefined,
            duration: 12_000,
          });
        }
        return false;
      } catch (error) {
        console.error("[Professor Mari] Failed to reject workspace rows", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotRejectThatEntry"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
        return false;
      } finally {
        setWorkspaceReviewActionId((current) => (current === id ? null : current));
      }
    },
    [approvalBusyId, invalidateWorkspaceData, loadMemories, refreshWorkspaceStatus, localizeUi],
  );

  // #4931: fetch the synthetic Peek-Prompt render of one reviewed character/preset row. Read-only,
  // so it needs no review-action lock and can run while other reviews are in flight.
  const renderWorkspacePrompt = useCallback(
    async (id: string, row: { index: number; table: string; id: string; action: string }) => {
      try {
        const result = await api.post<{
          ok?: boolean;
          before?: MariPromptRenderSide;
          after?: MariPromptRenderSide;
        }>(`/professor-mari/workspace/approvals/${id}/render-prompt`, row);
        if (!result.ok) return null;
        return { before: result.before ?? null, after: result.after ?? null };
      } catch (error) {
        console.error("[Professor Mari] Failed to render workspace prompt", error);
        return null;
      }
    },
    [],
  );

  const stopWorkspace = useCallback(async () => {
    setCancelledChatId(chatId);
    workspaceAbortRef.current?.abort();
    clearMariChips();
    clearMariPlan();
    try {
      await api.post("/professor-mari/workspace/abort");
    } catch (error) {
      setCancelledChatId(null);
      console.error("[Professor Mari] Failed to stop workspace task", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotStopTheWorkspaceTask"), {
        description: describeProfessorMariError(error),
        duration: 12_000,
      });
    }
  }, [chatId, clearMariChips, clearMariPlan, localizeUi]);

  const {
    handleNewSkill,
    handleSkillUploadClick,
    handleSkillFileChange,
    handleSaveSkill,
    handleToggleSkill,
    handleDeleteSkill,
    handleNewMemory,
    handleMemoryUploadClick,
    handleMemoryFileChange,
    handleSaveMemory,
    handleToggleMemoryEnabled,
    handleToggleMemoryPersistent,
    handleDeleteMemory,
  } = useMariSkillMemoryActions({
    loadMemories,
    loadSkills,
    memories,
    memoryDraft,
    memoryFileInputRef,
    refreshWorkspaceStatus,
    selectedMemory,
    selectedSkill,
    setMemoriesSaving,
    setSelectedMemoryId,
    setSelectedSkillId,
    setSkillsSaving,
    setWorkspaceDestination,
    skillDraft,
    skillFileInputRef,
    skills,
  });

  const {
    handleSelectProfessorChat,
    handleRenameProfessorChat,
    handleTitleCommand,
    handleDeleteProfessorChat,
    toggleProfessorChatSelection,
    handleBulkDeleteProfessorChats,
  } = useMariChatHistoryActions({
    chatHistory,
    chatId,
    effectiveConnectionId,
    ensureProfessorMariChat,
    isBusy,
    loadChatHistory,
    loadMessages,
    openChatId,
    renameDraft,
    requestedChatIdRef,
    selectedChatHistoryIds,
    setActiveChatId,
    setChatHistorySelectionMode,
    setDraft,
    setRenameDraft,
    setRenamingChatId,
    setSelectedChatHistoryIds,
    setWorkspaceDestination,
    setWorkspaceRunClock,
    setWorkspaceTimeline,
  });
  const handleAttachmentUpload = useCallback(
    async (files: FileList | null) => {
      const acceptedFiles = Array.from(files ?? []).filter((file) => {
        if (file.size > PROFESSOR_MARI_ATTACHMENT_MAX_BYTES) {
          toast.error(localizeUi("ui.chat.homeprofessormarichat.value1IsTooLargeMax20Mb", { value1: file.name }));
          return false;
        }
        if (!isSupportedProfessorMariAttachment(file)) {
          toast.error(
            localizeUi("ui.chat.homeprofessormarichat.value1IsNotSupportedHereAttachImagesPdfsOr", {
              value1: file.name || localizeUi("ui.chat.chatinput.thatFile"),
            }),
          );
          return false;
        }
        return true;
      });
      if (acceptedFiles.length === 0) return;

      setIsReadingAttachments(true);
      const prepared: ProfessorMariAttachment[] = [];
      try {
        for (const file of acceptedFiles) {
          const displayName = file.name || "attached-file";
          if (file.type.startsWith("image/")) {
            prepared.push(await prepareImageAttachment(file, displayName));
            continue;
          }
          prepared.push({
            type: inferProfessorMariAttachmentType(file),
            data: await readProfessorMariFileAsDataUrl(file),
            name: displayName,
          });
        }
      } catch (error) {
        console.error("[Professor Mari] Failed to prepare attachment", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotAttachThatFile"), {
          description:
            error instanceof Error ? error.message : localizeUi("ui.chat.homeprofessormarichat.theFileCouldNotBeRead"),
          duration: PROFESSOR_MARI_ERROR_TOAST_DURATION_MS,
        });
      } finally {
        if (prepared.length > 0) {
          setAttachments((current) => [...current, ...prepared]);
        }
        const resizedCount = prepared.filter((attachment) => attachment.resized).length;
        if (resizedCount > 0) {
          toast.info(
            localizeUi("ui.chat.homeprofessormarichat.value1ImageValue2ResizedForProfessorMariSVision", {
              value1: resizedCount,
              value2: resizedCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            }),
          );
        }
        setIsReadingAttachments(false);
      }
    },
    [localizeUi],
  );

  // R14: every way a run can fail (an HTTP error from the provider, a timeout, no answer, a dropped
  // stream, a failed regenerate or edited resend) ends here, so each one turns her red with the same
  // card, Retry and "Retry with another model". Your own Stop is not a failure.
  const { failRun, sendWorkspaceMessage, refreshAfterWorkspaceRun } = useMariWorkspaceRun({
    activeChatIdRef,
    chatId,
    clearMariPlan,
    effectiveConnectionId,
    handoffContext,
    invalidateActionResult,
    invalidateWorkspaceData,
    loadMessages,
    pendingWorkspaceTextRef,
    refreshWorkspaceStatus,
    setCancelledChatId,
    setMariChips,
    setMariPlan,
    setRecovery,
    setWorkspaceActive,
    setWorkspaceRunClock,
    setWorkspaceTimeline,
    workspaceAbortRef,
    workspaceRunIdRef,
    workspaceTextThrottle,
  });
  const {
    handleDeleteMessage,
    handleEditMessage,
    handleRegenerateMessage,
    handleEditAndResend,
    handleRemoveAttachment,
  } = useMariMessageActions({
    activeChatIdRef,
    attachmentRemovalInFlightRef,
    chatId,
    effectiveConnectionId,
    failRun,
    isBusy,
    loadMessages,
    messageLoadAbortRef,
    messageMutationBusyRef,
    messagesRef,
    refreshAfterWorkspaceRun,
    regenerationInFlightRef,
    sendWorkspaceMessage,
    setConnectionMenuOpen,
    setMessages,
    setSending,
  });
  const handleSubmit = async (
    overrideText?: string,
    overrideRecovery?: Pick<ProfessorMariRecovery, "attachments" | "context" | "localMessageId"> & {
      /** A retry: reuse your message when the server already saved it, instead of sending it twice. */
      reuseSavedMessage?: boolean;
    },
    overrideContext?: ProfessorMariAskContext | null,
  ) => {
    const text = (overrideText ?? draft).trim();
    const submittedAttachments = overrideRecovery?.attachments ?? attachments;
    const submittedContext = overrideRecovery
      ? overrideRecovery.context
      : overrideContext !== undefined
        ? overrideContext
        : handoffContext;
    const messageText = text || (submittedAttachments.length > 0 ? "Please inspect the attached file." : "");
    if (!messageText || isBusy || regenerationInFlightRef.current || isReadingAttachments) return;

    if (messageText === "/restart") {
      await runRestart();
      return;
    }

    if (await handleTitleCommand(messageText)) return;

    if (!effectiveConnectionId) {
      setConnectionMenuOpen(true);
      return;
    }

    setSending(true);
    // R14: a new message or a retry answers the failure at once: no red while she starts again.
    setRecovery(null);
    // D1: the appended arrival is local UI only — it never lingers once the user is really sending.
    setAppendedArrival(null);
    // F1: in a brand-new thread the arrival shows as the empty-state block, so the append effect never
    // ran yet and the request stayed unhandled. Mark it handled here too, or the effect appends it again
    // under her answer once the thread has a message.
    handledArrivalAppendRequestRef.current = arrivalAppendRequestRef.current;
    let localMessageId: string | undefined;
    try {
      const chat = await ensureProfessorMariChat(effectiveConnectionId);
      // A retry or a chip sends its own text: leave whatever you have typed since in the composer.
      if (overrideText === undefined) setDraft("");
      setMariChips(chat.id, []);
      setResolvedPrompts([]);
      clearMariPlan();
      if (!overrideRecovery) setAttachments([]);
      setHandoffContext(persistentResourceContext(submittedContext));
      let existingUserMessageId: string | undefined;
      if (overrideRecovery?.reuseSavedMessage) {
        const loaded = await loadMessages(chat.id, { restoreFocus: false }).catch(() => undefined);
        // F3: when a later round failed, the newest message is her partial reply (mariRunError set), not
        // your question — look past it for the user message it answers, or Retry sends a duplicate.
        const newest = loaded?.at(-1);
        const saved =
          newest && getMessageRunError(newest, { includeDismissed: true })
            ? loaded?.findLast((message) => message.role === "user")
            : newest;
        if (saved?.role === "user" && saved.content === messageText) existingUserMessageId = saved.id;
      }
      if (existingUserMessageId) {
        setTurnStartMessageId(existingUserMessageId);
      } else {
        const localMessage = createLocalUserMessage(chat.id, messageText, submittedAttachments, submittedContext);
        localMessageId = localMessage.id;
        setMessages((current) => [
          ...current.filter((message) => message.id !== overrideRecovery?.localMessageId),
          localMessage,
        ]);
        // M4: place the question at the top once, in the same commit the message lands in.
        setTurnStartMessageId(localMessage.id);
      }
      if (messagesRef.current.length === 0 && (chat.name ?? "") === PROFESSOR_MARI_DEFAULT_CHAT_NAME) {
        const autoTitle = buildProfessorMariAutoTitle(messageText);
        if (autoTitle) {
          // Best effort: a failed rename must never block the message.
          void api
            .patch(`/chats/internal/professor-mari/chats/${chat.id}`, { name: autoTitle })
            .then(() => loadChatHistory())
            .catch((error) => console.error("[Professor Mari] Failed to auto-title chat", error));
        }
      }
      trackAchievement.mutate("prof_mari_message_sent");
      const { received, runId, hiddenDuringStream } = await sendWorkspaceMessage(
        chat,
        messageText,
        submittedAttachments,
        existingUserMessageId,
        submittedContext,
      );
      // No answer at all is a failure like any other: the same red state and card, not a toast that leaves.
      if (!received && !hiddenDuringStream)
        throw new Error(localizeUi("ui.chat.homeprofessormarichat.professorMariDidNotReceiveAReplyFromThe"));
      void refreshAfterWorkspaceRun(chat.id, runId);
    } catch (error) {
      // Like Claude: your message stays where you sent it and one error card with Retry sits under the turn.
      // No toast over her header, and the text is not pushed back into the composer as a duplicate.
      if (!isProfessorMariAbortError(error)) setHandoffContext(submittedContext);
      failRun(error, {
        text: messageText,
        attachments: submittedAttachments,
        context: submittedContext,
        localMessageId,
      });
    } finally {
      setSending(false);
    }
  };

  // Each handoff is one request id, sent once. The effect also depends on `draft`,
  // so a flag that stayed true would re-fire on every keystroke and send whatever
  // the user had typed so far; a flag that was already true would deliver no change
  // at all on the next handoff, and that query would silently never send.
  const handledSubmitRequestRef = useRef(0);
  // An effect event, so the effect runs when the request or draft changes, not on
  // every render because handleSubmit is a new function each time. The context comes
  // in as a parameter rather than read from `handoffContext` state: the effect that
  // seeds `handoffContext` from `initialAskContext` can run in the same commit as
  // this one, and a state update scheduled by that effect is not visible here yet.
  const submitHandoffDraft = useEffectEvent(
    (context: ProfessorMariAskContext | null) => void handleSubmit(undefined, undefined, context),
  );
  useEffect(() => {
    if (!omnibarMode || !submitDraftRequest || handledSubmitRequestRef.current === submitDraftRequest) return;
    // Not marked handled yet: an empty, still-busy, or still-loading-connections
    // moment must retry, not drop it — connections load asynchronously, so
    // `effectiveConnectionId` can still be null here even once `draft` is set.
    if (!draft.trim() || isBusy || connectionsLoading) return;
    handledSubmitRequestRef.current = submitDraftRequest;
    submitHandoffDraft(initialAskContext);
    keepKeyboardInWindow();
  }, [connectionsLoading, draft, initialAskContext, isBusy, keepKeyboardInWindow, omnibarMode, submitDraftRequest]);

  // M5b: an action card runs the same deterministic navigation as the omnibar rows, with no Mari round-trip.
  const runSuggestionAction = (action: MariSuggestionAction) => {
    if (action.kind === "start-chat") {
      useUIStore.getState().openModal("start-character-chat", {
        characterId: action.characterId,
        characterName: characterPreviewById.get(action.characterId)?.name ?? "",
      });
      useUIStore.getState().setOmnibarOpen(false);
    } else if (action.kind === "peek-prompt") {
      executeStateNavigation({ kind: "chat", chatId: action.chatId });
      // ponytail: two frames for the chat view to take the new active chat before it hears the request;
      // a chat that mounts slower misses the peek and only opens. Add a pending-request store if that shows up.
      requestAnimationFrame(() => requestAnimationFrame(() => requestChatPeekPrompt(action.chatId)));
    } else {
      executeStateNavigation(action);
    }
    if (omnibarMode) closeChatWindow();
  };

  /**
   * N4: a Mari card sends at once; `draft` (Shift, or a long press on touch) puts it in the composer
   * instead. `context` replaces the handoff for that one card (N6: an arrival Fix card's error).
   */
  const handleSuggestionSelect = (chip: MariSuggestionChip, draft = false, context?: ProfessorMariAskContext) => {
    if (chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id || chip.id === MARI_AUTHORIZATION_DECLINE_CHIP.id) {
      void handleSubmit(chip.prompt);
      keepKeyboardInWindow();
      return;
    }
    if (guidedPlanStep) {
      const result = recordMariPlanAnswer(guidedPlanStep.fieldKey, chip.prompt);
      if (result === "complete") {
        const answers = useAgentStore.getState().mariPlanAnswers;
        const summary = Object.entries(answers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("; ");
        clearMariPlan();
        setDraft((current) =>
          current.trim() ? `${current.trimEnd()} Create it - ${summary}` : `Create it - ${summary}`,
        );
        focusComposer();
      }
      return;
    }
    if (chip.action) {
      runSuggestionAction(chip.action);
      return;
    }
    if (!draft) {
      void handleSubmit(chip.prompt, undefined, context);
      return;
    }
    if (context) setHandoffContext(context);
    setDraft((current) => (current.trim() ? `${current.trimEnd()} ${chip.prompt}` : chip.prompt));
    focusComposer();
  };

  // R14: Retry sends the failed turn's message again - from this session, or from the saved turn after a
  // reload - reusing your message when the server already saved it.
  const retryRun = () => {
    const target = recovery ?? (savedRunError ? retryOf(lastUserMessage) : null);
    if (!target?.text) return;
    setHandoffContext(target.context);
    void handleSubmit(target.text, { ...target, reuseSavedMessage: true });
  };
  const retryRunEvent = useEffectEvent(retryRun);
  // "Retry with another model" opens the composer's own connection menu; picking a different one retries.
  const [retryAfterPickFrom, setRetryAfterPickFrom] = useState<string | null>(null);
  const retryWithAnotherModel = () => {
    setRetryAfterPickFrom(effectiveConnectionId ?? "");
    setPermissionsMenuOpen(false);
    setConnectionMenuOpen(true);
  };
  useEffect(() => {
    if (retryAfterPickFrom === null) return;
    if (effectiveConnectionId && effectiveConnectionId !== retryAfterPickFrom) {
      setRetryAfterPickFrom(null);
      retryRunEvent();
    } else if (!connectionMenuOpen) setRetryAfterPickFrom(null);
  }, [connectionMenuOpen, effectiveConnectionId, retryAfterPickFrom]);
  // Dismiss answers the failure without a retry: the card folds to its quiet line and the red goes.
  const dismissRunError = async () => {
    setRecovery(null);
    const id = chatId;
    if (!id) return;
    try {
      const saved = (await loadMessages(id, { restoreFocus: false }))?.at(-1);
      const error = saved ? getMessageRunError(saved) : null;
      if (saved && error) {
        await api.patch(`/chats/${id}/messages/${saved.id}/extra`, { mariRunError: { ...error, dismissed: true } });
        await loadMessages(id, { restoreFocus: false });
      }
      // The server keeps the failure for the top-bar line until a run or a reset clears it.
      // F12: keepRun so Dismiss never aborts a run that may genuinely be in flight.
      if (workspaceStatus?.error) {
        await api.post("/professor-mari/workspace/reset", { keepRun: true });
        setWorkspaceStatus((current) => current && { ...current, error: null });
      }
    } catch (error) {
      console.error("[Professor Mari] Failed to dismiss the error", error);
    } finally {
      void qc.invalidateQueries({ queryKey: professorMariWorkspaceStatusKeys.all });
    }
  };

  const [requestedReviewId, setRequestedReviewId] = useState<string | null>(null);
  // R9: a specific target (the per-approval omnibar row) wins; otherwise fall back to the
  // first visible review, as every other door into this pane already did.
  const openPendingApprovals = useCallback(
    (reviewId?: string | null) => {
      setRequestedReviewId(reviewId ?? visiblePendingChangeReviews[0]?.id ?? null);
      setWorkspaceDestination("chat");
      void refreshWorkspaceStatus();
    },
    [refreshWorkspaceStatus, visiblePendingChangeReviews],
  );

  const handledPendingReviewRequestRef = useRef(0);
  useEffect(() => {
    if (!chatWindowOpen || pendingReviewRequest <= handledPendingReviewRequestRef.current) return;
    handledPendingReviewRequestRef.current = pendingReviewRequest;
    openPendingApprovals(pendingReviewId);
  }, [chatWindowOpen, openPendingApprovals, pendingReviewId, pendingReviewRequest]);

  // "Turn on" for a memory switches only the memory. The applied review stays open, so Undo still works.
  const turnOnMemory = async (memoryId: string) => {
    try {
      await api.put(`/professor-mari/workspace/instructions/${memoryId}`, { enabled: true });
      return true;
    } catch (error) {
      console.error("[Professor Mari] Failed to turn on memory", error);
      toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariCouldNotUpdateThatMemory"));
      return false;
    }
  };

  const answerApproval = async (approval: MariWorkspacePendingApproval, keep: boolean) => {
    // R10: the answered row stays where it was. It is listed before the call and shows as soon as the
    // review leaves the pending list (the same render), so the row never blinks out; a failure drops it.
    const entry = { chatId, approval, outcome: keep ? ("applied" as const) : ("discarded" as const) };
    setResolvedPrompts((current) => [...current, entry]);
    keepKeyboardInWindow();
    const result = await (keep ? keepWorkspaceChange(approval.id) : restoreWorkspaceChange(approval.id));
    const done = keep
      ? result?.outcome === "applied" || result?.history?.status === "kept"
      : result?.outcome === "discarded" || result?.history?.status === "restored";
    if (!done) setResolvedPrompts((current) => current.filter((item) => item !== entry));
  };
  // Slice 13: a review renders inside the turn that asked for it, not after the whole transcript, and
  // an answered install / file prompt folds to its line in the same place.
  const reviewsByTurn = assignReviewsToTurns(
    displayMessages,
    [
      ...visiblePendingChangeReviews.map((approval) => ({
        requestedAt: approval.requestedAt,
        approval,
        outcome: null,
      })),
      ...(sending || workspaceTimelineActive ? [] : resolvedPrompts)
        .filter(
          (prompt) =>
            prompt.chatId === chatId && !visiblePendingChangeReviews.some(({ id }) => id === prompt.approval.id),
        )
        .map(({ approval, outcome }) => ({ requestedAt: approval.requestedAt, approval, outcome })),
    ].sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt)),
  );
  const renderTurnPrompt = ({ approval, outcome }: (typeof reviewsByTurn.unassigned)[number]) =>
    outcome ? (
      <ResolvedPromptLine key={`resolved:${approval.id}`} approval={approval} outcome={outcome} />
    ) : (
      <WorkspaceApprovalCard
        key={approval.id}
        approval={approval}
        busy={approvalBusyId === approval.id}
        disabled={approvalBusyId !== null}
        highlighted={highlightedReviewId === approval.id}
        onKeep={() => void answerApproval(approval, true)}
        onTurnOn={turnOnMemory}
        onRestore={() => void answerApproval(approval, false)}
        onRejectRows={(id, rows) => rejectWorkspaceRows(id, rows)}
        onRenderPrompt={renderWorkspacePrompt}
      />
    );
  const lastAssistantId = displayMessages.findLast((message) => message.role === "assistant")?.id ?? null;
  const heldCardNode = heldChangeCard ? (
    <MariHeldChangeCard
      key="held-change"
      held={lastLoadedMessage?.role === "assistant" ? lastLoadedMessageExtra?.mariHeldChanges : null}
      nameOf={(id) => characterPreviewById.get(id)?.name ?? lorebookPreviewById.get(id)?.name}
      disabled={isBusy}
      onAccept={() => handleSuggestionSelect(MARI_AUTHORIZATION_ACCEPT_CHIP)}
      onDecline={() => handleSuggestionSelect(MARI_AUTHORIZATION_DECLINE_CHIP)}
    />
  ) : null;
  const answerAll = async (entries: ReadonlyArray<{ approval: MariWorkspacePendingApproval }>, keep: boolean) => {
    for (const { approval } of entries) await answerApproval(approval, keep);
  };
  // M5a / slice 71 (F1): applied changes and answered prompts are "what changed"; everything still waiting
  // - a delete too, whose rows stay hidden until you choose - needs you. The deletes of one turn are one card.
  // Slice 74: a change her message has a receipt for shows as that receipt, which answers its reviews.
  const receiptControls: MariReceiptControls = {
    // All of them, also while a run is busy: a receipt must not read "Undo closed" mid-run.
    pending: new Map(pendingChangeReviews.map((approval) => [approval.id, approval])),
    answered: new Map(
      resolvedPrompts
        .filter((prompt) => prompt.chatId === chatId)
        .map(({ approval, outcome }) => [approval.id, outcome === "applied" ? "kept" : "undone"]),
    ),
    busy: approvalBusyId !== null,
    // Read when the receipt renders: the highlight state is declared further down this component.
    isHighlighted: (id) => highlightedReviewId === id,
    onAnswer: (approvals, keep) =>
      void answerAll(
        approvals.map((approval) => ({ approval })),
        keep,
      ),
    // Only a database review has a raw view; an install approval has none.
    onRetry: () => void handleSubmit("try again"),
    renderRaw: (approval) =>
      "diffPreview" in approval ? <RawDetails approval={approval} open onToggle={() => undefined} /> : null,
  };
  const renderTurnReviews = (messageId: string): MariTurnReviews => {
    const message = displayMessages.find((item) => item.id === messageId);
    const actionResults = message ? getMessageWorkspaceActionResults(message) : [];
    const covered = new Set(actionResults.flatMap(mariReceiptReviewIds));
    const entries = (reviewsByTurn.byMessageId.get(messageId) ?? []).filter(
      ({ approval }) =>
        !(approval.kind === "applied_review" && covered.has(approval.id) && !isMariReviewWaiting(approval)),
    );
    if (entries.length === 0 && actionResults.length === 0 && !(messageId === lastAssistantId && heldCardNode)) {
      return NO_TURN_REVIEWS;
    }
    const waiting = entries.filter(({ approval, outcome }) => !outcome && isMariReviewWaiting(approval));
    const deletes = waiting.filter(
      (entry): entry is typeof entry & { approval: MariDbPendingApproval } => entry.approval.kind === "applied_review",
    );
    const first = deletes[0]?.approval;
    const deleteGroup =
      first && deletes.length > 1 ? (
        <div
          key={`delete-group:${first.id}`}
          id={`mari-workspace-review-${first.id}`}
          data-review-id={first.id}
          className={cn("mari-inline-review", highlightedReviewId === first.id && "mari-inline-review--jump")}
        >
          <DeleteReviewCard
            approvals={deletes.map(({ approval }) => approval)}
            busy={deletes.some(({ approval }) => approvalBusyId === approval.id)}
            disabled={approvalBusyId !== null}
            onDelete={() => void answerAll(deletes, true)}
            onPutBack={() => void answerAll(deletes, false)}
          />
        </div>
      ) : null;
    return {
      changed: entries.filter((entry) => !waiting.includes(entry)).map(renderTurnPrompt),
      needsOk: [
        ...(messageId === lastAssistantId && heldCardNode ? [heldCardNode] : []),
        ...(deleteGroup ? [deleteGroup] : []),
        ...waiting.filter((entry) => !deleteGroup || !deletes.includes(entry as never)).map(renderTurnPrompt),
      ],
      records: reviewRecordKeys(entries.map(({ approval }) => approval)),
      receipt: receiptControls,
    };
  };
  // M9 / R10: she arrives knowing the screen she was opened from: her sprite and one line with its facts,
  // then ONE group - the things on that screen, then what to do. Nothing is sent until a row is picked
  // or you type (R22); the composer's chips say what would go.
  const renderArrival = (
    data: MariArrival,
    component: string,
    ref?: RefObject<HTMLDivElement | null>,
    choice?: ReactNode,
  ) => {
    const strongAt = data.strong ? data.line.indexOf(data.strong) : -1;
    return (
      <div ref={ref} className="mari-arrival" data-component={component}>
        <MariStorySprite state="idle" />
        <div className="mari-arrival__copy mari-arrival-content">
          <p className="mari-arrival__line">
            {data.strong && strongAt >= 0 ? (
              <>
                {data.line.slice(0, strongAt)}
                <b>{data.strong}</b>
                {data.line.slice(strongAt + data.strong.length)}
              </>
            ) : (
              data.line
            )}
          </p>
          {data.meta.length > 0 ? <p className="mari-arrival__meta">{data.meta.join(" · ")}</p> : null}
          {choice}
        </div>
        <MariList className="mari-arrival__group mari-arrival-content" data-cards="arrival">
          <MariReferencedResources
            bare
            resources={data.refs}
            characterPreviews={characterPreviewById}
            lorebookPreviews={lorebookPreviewById}
            onOpen={openReferencedResource}
            skipName={data.strong}
          />
          <MariNextStepCards
            bare
            chips={data.cards}
            onSelect={(card, draft) =>
              card.action?.kind === "find-setting" || card.action?.kind === "undo-setting"
                ? onArrivalAction?.(card.action)
                : handleSuggestionSelect(
                    card as MariSuggestionChip,
                    draft,
                    (card.fix && arrivalFixContext) || undefined,
                  )
            }
            disabled={isBusy}
          />
        </MariList>
      </div>
    );
  };

  useEffect(() => {
    if (visiblePendingChangeReviewKey && visiblePendingChangeReviewKey !== lastAutoOpenedApprovalKeyRef.current) {
      lastAutoOpenedApprovalKeyRef.current = visiblePendingChangeReviewKey;
      setRequestedReviewId(visiblePendingChangeReviews[0]?.id ?? null);
      setWorkspaceDestination("chat");
    }
  }, [visiblePendingChangeReviewKey, visiblePendingChangeReviews]);

  // R14: the newest unresolved failure is one card at the end of the turn: what broke, Retry, Retry with
  // another model, and Dismiss. Older failures are one quiet "Failed · reason" line (runFailedLine).
  const renderRunErrorCard = (error: { kind?: ProfessorMariRecovery["kind"]; detail?: string }, retry: boolean) => (
    <div className="mari-run-error" role="alert" data-component="HomeProfessorMariChat.RunError">
      <p className="mari-run-error__text">
        <AlertTriangle size="0.8rem" aria-hidden="true" />
        <span>
          {error.kind ? (
            <span className="mari-run-error__label">
              {localizeUi(`ui.chat.homeprofessormarichat.recovery.${error.kind}`)}
            </span>
          ) : null}
          {error.detail ? <span className="mari-note__detail"> {error.detail}</span> : null}
        </span>
      </p>
      <div className="mari-run-error__actions">
        {retry ? (
          <>
            <button type="button" onClick={retryRun} className="mari-btn">
              {localizeUi("ui.chat.homeprofessormarichat.retry")}
            </button>
            <button type="button" onClick={retryWithAnotherModel} className="mari-btn">
              {localizeUi("ui.chat.homeprofessormarichat.retryWithAnotherModel")}
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => void dismissRunError()} className="mari-btn mari-run-error__dismiss">
          {localizeUi("ui.chat.homeprofessormarichat.dismissError")}
        </button>
      </div>
    </div>
  );
  const runFailedLine = (message: Message) => {
    const error = getMessageRunError(message, { includeDismissed: true });
    // The newest turn's failure is the card while it is unresolved, and nothing while she retries it.
    if (!error || (message.id === latestMessage?.id && (activeRunError || isBusy))) return null;
    return (
      <p className="mari-run-failed-line" title={error.message}>
        <AlertTriangle size="0.75rem" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {localizeUi("ui.chat.homeprofessormarichat.runFailedLine", { reason: error.message })}
        </span>
      </p>
    );
  };

  const openActionResult = useCallback(
    async (result: MariWorkspaceActionResult) => {
      await invalidateActionResult(result).catch((error) => {
        console.error("[Professor Mari] Failed to refresh action result before opening", error);
        toast.error(localizeUi("ui.chat.homeprofessormarichat.professorMariAppliedAWorkspaceChangeButAppData"), {
          description: describeProfessorMariError(error),
          duration: 12_000,
        });
      });
      executeStateNavigation({
        kind: "resource",
        resource: result.resource.kind,
        id: result.resource.id,
      });
      if (omnibarMode) closeChatWindow();
    },
    [closeChatWindow, invalidateActionResult, localizeUi, omnibarMode],
  );

  const openReferencedResource = useCallback(
    (resource: MariReferencedResource) => {
      const target = mariReferenceTarget(resource, getOmnibarSettingsDestinations());
      if (!target) return;
      executeStateNavigation(target);
      if (omnibarMode) closeChatWindow();
    },
    [closeChatWindow, omnibarMode],
  );

  // R9: a brief highlight so a review that was already on screen (not just-mounted, which
  // already gets the mari-review-rise entrance) still visibly answers the click. Driven by
  // state rather than a direct DOM class mutation, so a React re-render (the refresh below
  // triggers one) cannot silently wipe it before the user sees it.
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  useEffect(() => {
    if (workspaceDestination !== "chat" || !requestedReviewId) return;
    const targetId = requestedReviewId;
    // A cold open (the omnibar jumping here before this pane's own transcript has ever
    // rendered) can still be mounting the review's card a few frames after `chatWindowOpen`
    // and `workspaceDestination` already settled; retry on a wall-clock budget instead of a
    // single frame, same pattern as the chat's own /goto message jump (ChatArea.tsx).
    let cancelled = false;
    let rafId = 0;
    const deadline = Date.now() + 3000;
    const tryFocus = () => {
      if (cancelled) return;
      const review = document.getElementById(`mari-workspace-review-${targetId}`);
      if (!review) {
        if (Date.now() < deadline) rafId = window.requestAnimationFrame(tryFocus);
        return;
      }
      setRequestedReviewId(null);
      // UX-10: scroll the transcript only. scrollIntoView also scrolls clipped (overflow: hidden) wrappers
      // around it, which lifted the composer dock off the window's bottom.
      const transcript = scrollRef.current;
      if (transcript?.contains(review))
        transcript.scrollTop += review.getBoundingClientRect().top - transcript.getBoundingClientRect().top;
      else review.scrollIntoView({ block: "start" });
      review.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      if (!reduceMotion) {
        setHighlightedReviewId(targetId);
        window.setTimeout(() => setHighlightedReviewId((current) => (current === targetId ? null : current)), 1200);
      }
    };
    rafId = window.requestAnimationFrame(tryFocus);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [reduceMotion, requestedReviewId, visiblePendingChangeReviewKey, workspaceDestination]);

  // #5740 / M5a: on the turn the latest mutating round produced, its first line is the goal Mari
  // reported acting on - user-visible by default so people can self-correct ("that wasn't a request!")
  // before filing reports. One record only (latest round), read from status, never a model call. The
  // server also reads the record back to Mari as context, so asking her "why did you treat that as
  // permission?" gets an answer grounded in this same record - never a gate either way.
  const renderGoal = (message: Message) => {
    const understoodRequest =
      message.role === "assistant" && workspaceStatus?.latestUnderstoodRequest?.messageId === message.id
        ? workspaceStatus.latestUnderstoodRequest
        : null;
    // Slice 72: a goal line without her words ("No request phrase reported") told you nothing; no line then.
    if (!understoodRequest?.text?.trim()) return null;
    // UX-15: a goal that only repeats the Accept / Don't apply card action says nothing new.
    const goalText = understoodRequest.text.trim();
    if (goalText === MARI_AUTHORIZATION_ACCEPT_CHIP.prompt || goalText === MARI_AUTHORIZATION_DECLINE_CHIP.prompt)
      return null;
    const expanded = expandedUnderstoodRequestMessageId === message.id;
    const outcomeLabel = localizeUi(
      understoodRequest.outcome === "held"
        ? "ui.chat.homeprofessormarichat.heldForYourApproval"
        : understoodRequest.outcome === "applied"
          ? "ui.chat.homeprofessormarichat.actingOnOutcomeApplied"
          : understoodRequest.outcome === "failed"
            ? "ui.chat.homeprofessormarichat.actingOnOutcomeFailed"
            : "ui.chat.homeprofessormarichat.actingOnOutcomeInterrupted",
    );
    return (
      <button
        type="button"
        onClick={() => setExpandedUnderstoodRequestMessageId((current) => (current === message.id ? null : message.id))}
        aria-expanded={expanded}
        title={localizeUi(
          expanded ? "ui.chat.homeprofessormarichat.actingOnCollapse" : "ui.chat.homeprofessormarichat.actingOnExpand",
        )}
        className="mari-goal"
      >
        <span className="mari-goal__kicker">{localizeUi("ui.chat.homeprofessormarichat.goal")}</span>
        {/* break-words: the phrase is model-authored and routinely carries unbreakable tokens (paths, URLs)
            that would otherwise force a horizontal scrollbar onto the whole transcript. */}
        <span className={expanded ? "min-w-0 whitespace-pre-wrap break-words" : "min-w-0 truncate"}>
          {localizeUi("ui.chat.homeprofessormarichat.goalQuote", { text: understoodRequest.text })}
          {expanded && (
            <span className="mt-0.5 block text-[0.625rem] opacity-80">
              {understoodRequest.commands.join(", ")}
              <span className="block">
                {localizeUi("ui.chat.homeprofessormarichat.actingOnModeOutcomeValue1Value2", {
                  value1: localize(MARI_PERMISSIONS_MODE_LABELS[understoodRequest.permissionsMode].label),
                  value2: outcomeLabel,
                })}
              </span>
            </span>
          )}
        </span>
      </button>
    );
  };

  // R14 (item 7): a reply's run counts from your message before it.
  const sentAtBefore = (message: Message) => {
    const index = messages.findIndex((item) => item.id === message.id);
    const sent = messages.slice(0, Math.max(0, index)).findLast((item) => item.role === "user");
    return sent ? getMessageRunTime(sent, "mariRunStartedAt") || Date.parse(sent.createdAt) || null : null;
  };

  const renderDisplayMessage = (message: Message) => {
    const canManageMessage = true;
    const messageContext = getProfessorMariMessageContext(message);
    const messageCharacter = resolveContextCharacter(messageContext, characterPreviewById, characterFallbackName);
    const messageLorebook = resolveContextLorebook(messageContext, lorebookPreviewById, lorebookFallbackName);
    return (
      <div key={message.id}>
        <CompactMariMessage
          message={message}
          thinking={message.role === "assistant" ? getMessageThinking(message) : null}
          onDelete={canManageMessage && !isBusy ? handleDeleteMessage : undefined}
          onEdit={canManageMessage && !isBusy ? handleEditMessage : undefined}
          onEditAndResend={
            canManageMessage && !isBusy && message.id === lastUserMessageId ? handleEditAndResend : undefined
          }
          onRegenerate={canManageMessage ? handleRegenerateMessage : undefined}
          canRegenerate={canManageMessage && !isBusy && message.id === messages[messages.length - 1]?.id}
          onRemoveAttachment={canManageMessage && !isBusy ? handleRemoveAttachment : undefined}
          onOpenActionResult={openActionResult}
          onOpenResource={openReferencedResource}
          characterSubject={messageCharacter}
          lorebookSubject={messageLorebook}
          characterPreviews={characterPreviewById}
          lorebookPreviews={lorebookPreviewById}
          messageContext={messageContext}
          restStory={message.id === latestMessage?.id ? latestTurnRestStory : null}
          pullTarget={!appendedArrival}
          reviews={renderTurnReviews(message.id)}
          goal={renderGoal(message)}
          runStartedAtMs={sentAtBefore(message)}
        />
        {runFailedLine(message)}
      </div>
    );
  };

  // #5073: the chat-history picker + Context Viewer. createPortal to document.body, so they render
  // correctly from whichever composer (floating or docked) is active. Gated on a live chatId.
  const attachModals = chatId ? (
    <>
      <MariChatHistoryPicker
        open={historyPickerOpen}
        workspaceChatId={chatId}
        onClose={() => setHistoryPickerOpen(false)}
      />
      <MariContextViewer
        open={contextViewerOpen}
        workspaceChatId={chatId}
        onClose={() => setContextViewerOpen(false)}
      />
    </>
  ) : null;

  return (
    <>
      {attachModals}
      <MariOmnibarHeaderChrome
        activeMemoryCount={activeMemoryCount}
        activeSkillCount={activeSkillCount}
        attachedContext={attachedContext}
        composerContextFacets={composerContextFacets}
        headerCompact={headerCompact}
        headerMenuOpen={headerMenuOpen}
        headerMenuRef={headerMenuRef}
        heldChangeCard={heldChangeCard}
        isBusy={isBusy}
        noConnection={noConnection}
        mariPresentationState={mariPresentationState}
        omnibarHeaderSlot={omnibarHeaderSlot}
        omnibarMenuSlot={omnibarMenuSlot}
        omnibarMode={omnibarMode}
        omnibarStatusSlot={omnibarStatusSlot}
        onHeaderMenuKeyDown={onHeaderMenuKeyDown}
        oneShotContext={oneShotContext}
        reviewsByTurn={reviewsByTurn}
        runRestart={runRestart}
        setHeaderMenuOpen={setHeaderMenuOpen}
        setWorkspaceDestination={setWorkspaceDestination}
        workspaceDestination={workspaceDestination}
      />
      {!launchHidden && (
        <div
          className={cn(
            "home-professor-mari-chat mt-4 w-full",
            attachedFooter && "rounded-t-xl",
            desktopChatWindowOpen && "hidden",
            mobileFocusMode && "hidden",
          )}
          data-paused={pageActive ? "false" : "true"}
        >
          <section
            className="mari-chrome-accent-frame mari-chrome-accent-panel mari-accent-animated relative flex min-w-0 flex-col items-center gap-2 overflow-visible rounded-2xl border p-3 text-center sm:p-4"
            data-component="HomeProfessorMariChat.MariPanel"
          >
            <span
              className="mari-accent-soft-fill mari-accent-animated pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl"
              aria-hidden="true"
            />
            <div className="flex w-full flex-col items-center gap-2">
              <div
                className="relative z-[1] mt-3 w-full max-w-[10.5rem] [--mari-professor-sprite-bottom:5%] sm:max-w-[11.5rem] lg:mt-0 lg:max-w-[10.5rem] xl:max-w-[11.5rem]"
                data-component="HomeProfessorMariChat.Scene"
              >
                <ProfessorMariPixelScene active={isBusy || mariPhase !== null} />
              </div>
              <div className="w-full min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.chat.homefaq.professorMari")}
                </div>
                <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                  {isBusy
                    ? localizeUi("ui.chat.homeprofessormarichat.workingOnIt")
                    : localizeUi(
                        noConnection
                          ? "ui.chat.homeprofessormarichat.needsConnection"
                          : "ui.chat.homeprofessormarichat.readyToHelp",
                      )}
                </div>
              </div>
            </div>
            <div
              className="flex min-h-0 w-full max-w-2xl flex-col justify-center gap-1 px-1 text-center text-[0.6875rem] leading-[1.35] text-[var(--muted-foreground)]"
              data-component="HomeProfessorMariChat.Welcome"
            >
              {MARI_WELCOME.split("\n\n")
                .slice(0, 2)
                .map((paragraph, index) => (
                  <p key={paragraph} className={cn(index === 0 && "font-semibold text-[var(--foreground)]")}>
                    {paragraph}
                  </p>
                ))}
            </div>
            <button
              type="button"
              onClick={openChatWindow}
              className="mari-chrome-control mari-chrome-control--primary w-full justify-center gap-2 text-xs"
            >
              <MessageCircle size="0.9rem" />
              {t("home.professorMari.ask")}
            </button>
          </section>
        </div>
      )}

      <AnimatePresence onExitComplete={onChatWindowExitComplete}>
        {chatWindowOpen && (
          <ProfessorMariMobilePortal disabled={embeddedTab}>
            <motion.div
              ref={mobileDialogRef}
              key="professor-mari-window"
              data-component="HomeProfessorMariChat.Window"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={paneTransition}
              role={mobileFocusMode && !embeddedTab ? "dialog" : undefined}
              aria-modal={mobileFocusMode && !embeddedTab ? true : undefined}
              aria-label={mobileFocusMode && !embeddedTab ? localizeUi("ui.chat.homefaq.professorMari") : undefined}
              tabIndex={mobileFocusMode && !embeddedTab ? -1 : undefined}
              className={cn(
                "flex min-h-0 items-stretch justify-center",
                embeddedTab
                  ? "relative z-auto h-full w-full bg-transparent p-0"
                  : "fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)_+_3rem)] z-[80] bg-[var(--background)] pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:h-full sm:max-h-none sm:w-full sm:flex-1 sm:bg-transparent sm:p-0",
              )}
            >
              <div
                className={cn(
                  "flex h-full min-h-0 w-full flex-col",
                  embeddedTab ? "max-w-none" : "max-w-none sm:max-w-5xl",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  const hasDetail =
                    (workspaceDestination === "context" && Boolean(selectedContextId)) ||
                    (workspaceDestination === "skills" && Boolean(selectedSkillId)) ||
                    (workspaceDestination === "memories" && Boolean(selectedMemoryId));
                  const action = resolveProfessorMariWorkspaceBackAction(workspaceDestination, hasDetail);
                  if (action === "workspace") {
                    if (mobileFocusMode && !embeddedTab) {
                      event.stopPropagation();
                      closeChatWindow();
                    }
                    return;
                  }
                  event.stopPropagation();
                  if (action === "detail" && workspaceDestination === "context") {
                    setSelectedContextId(null);
                    return;
                  }
                  if (action === "detail" && workspaceDestination === "skills") {
                    setSelectedSkillId(null);
                    return;
                  }
                  if (action === "detail" && workspaceDestination === "memories") {
                    setSelectedMemoryId(null);
                    return;
                  }
                  setWorkspaceDestination("chat");
                }}
              >
                <div
                  data-mari-panel="open"
                  data-mari-state={mariPresentationState}
                  className="relative flex min-h-0 flex-1 flex-col sm:flex-row"
                >
                  <motion.div
                    key="professor-mari-chat"
                    transition={paneTransition}
                    className="h-full min-h-0 min-w-0 flex-1"
                  >
                    <div
                      className={cn(
                        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border bg-[var(--background)]",
                        omnibarMode
                          ? "rounded-none border-0 bg-transparent shadow-none"
                          : embeddedTab
                            ? "rounded-2xl border-[color-mix(in_srgb,oklch(0.73_0.21_345)_28%,var(--border))] shadow-[0_24px_70px_-42px_oklch(0.73_0.21_345/0.8)]"
                            : "rounded-none border-0 sm:rounded-xl sm:border sm:border-[var(--border)]/70 sm:shadow-2xl",
                      )}
                    >
                      <MariWindowHeader
                        activeMemoryCount={activeMemoryCount}
                        activeSkillCount={activeSkillCount}
                        attachedContext={attachedContext}
                        chatHistoryOpen={chatHistoryOpen}
                        closeChatWindow={closeChatWindow}
                        embeddedTab={embeddedTab}
                        focusedCharacter={focusedCharacter}
                        focusedLorebook={focusedLorebook}
                        handleOpenContextViewer={handleOpenContextViewer}
                        handoffContext={handoffContext}
                        isBusy={isBusy}
                        noConnection={noConnection}
                        memories={memories}
                        memoriesMenuOpen={memoriesMenuOpen}
                        omnibarMode={omnibarMode}
                        openPendingApprovals={openPendingApprovals}
                        runRestart={runRestart}
                        setConnectionMenuOpen={setConnectionMenuOpen}
                        setHandoffContext={setHandoffContext}
                        skills={skills}
                        skillsMenuOpen={skillsMenuOpen}
                        toggleChatHistory={toggleChatHistory}
                        toggleMemoriesMenu={toggleMemoriesMenu}
                        toggleSkillsMenu={toggleSkillsMenu}
                        visiblePendingChangeReviews={visiblePendingChangeReviews}
                        workspaceTimelineActive={workspaceTimelineActive}
                      />

                      <div className="relative flex min-h-0 flex-1 flex-col">
                        {omnibarMode && !reduceAmbientEffects ? (
                          <div
                            aria-hidden="true"
                            className="mari-workspace-glow-band"
                            data-working={composerWorkingState}
                            data-glow={composerGlowTone}
                          />
                        ) : null}
                        <MariTranscript
                          activeRunError={activeRunError}
                          activeTurnMessages={activeTurnMessages}
                          activeTurnRef={activeTurnRef}
                          appendedArrival={appendedArrival}
                          appendedArrivalNodeRef={appendedArrivalNodeRef}
                          arrival={arrival}
                          arrivalChoiceChatId={arrivalChoiceChatId}
                          arrivalThread={arrivalThread}
                          characterPreviewById={characterPreviewById}
                          chatId={chatId}
                          chipRowChips={chipRowChips}
                          emptyStateReady={emptyStateReady}
                          focusedCharacter={focusedCharacter}
                          focusedLorebook={focusedLorebook}
                          guidedPlanStep={guidedPlanStep}
                          handleDeleteMessage={handleDeleteMessage}
                          handleNewAboutContext={handleNewAboutContext}
                          handleRegenerateMessage={handleRegenerateMessage}
                          handleSuggestionSelect={handleSuggestionSelect}
                          handleTranscriptScroll={handleTranscriptScroll}
                          heldCardNode={heldCardNode}
                          isBusy={isBusy}
                          lastAssistantId={lastAssistantId}
                          lastUserMessage={lastUserMessage}
                          latestActionResults={latestActionResults}
                          latestMessage={latestMessage}
                          latestTurnHasTrace={latestTurnHasTrace}
                          latestTurnRestStory={latestTurnRestStory}
                          // Also while her chat is not known yet (connections still loading), so the skeleton, not a blank.
                          // A cached thread (mari-thread-cache) stays on screen while the first load refreshes it.
                          loadingHistory={
                            loadedMessagesChatId !== chatId || (loadingHistory && loadedMessagesChatId === null)
                          }
                          lorebookPreviewById={lorebookPreviewById}
                          mariPresentationState={mariPresentationState}
                          messages={messages}
                          omnibarMode={omnibarMode}
                          openActionResult={openActionResult}
                          openReferencedResource={openReferencedResource}
                          renderArrival={renderArrival}
                          renderDisplayMessage={renderDisplayMessage}
                          renderGoal={renderGoal}
                          renderRunErrorCard={renderRunErrorCard}
                          renderTurnPrompt={renderTurnPrompt}
                          renderTurnReviews={renderTurnReviews}
                          restingStory={restingStory}
                          reviewsByTurn={reviewsByTurn}
                          setArrivalChoiceChatId={setArrivalChoiceChatId}
                          setTranscriptScrollNode={setTranscriptScrollNode}
                          setTranscriptStackNode={setTranscriptStackNode}
                          showConnectionFirstHint={showConnectionFirstHint}
                          showJumpToLatest={showJumpToLatest}
                          showNextStepCards={showNextStepCards}
                          showSuggestionPrompt={showSuggestionPrompt}
                          suggestionQuestion={suggestionQuestion}
                          transcriptHeadMessages={transcriptHeadMessages}
                          workspaceRunClock={workspaceRunClock}
                          workspaceStatus={workspaceStatus}
                          workspaceTimeline={workspaceTimeline}
                          workspaceTimelineActive={workspaceTimelineActive}
                          workspaceTimelineVisible={workspaceTimelineVisible}
                          workspaceToolsIssue={workspaceToolsIssue}
                        />

                        <MariComposer
                          acceptDraftCompletion={acceptDraftCompletion}
                          attachComposerDock={attachComposerDock}
                          attachedContext={attachedContext}
                          attachmentInputRef={attachmentInputRef}
                          attachments={attachments}
                          canSubmitMessage={canSubmitMessage}
                          chipRowChips={chipRowChips}
                          composerContextFacets={composerContextFacets}
                          composerScroll={composerScroll}
                          connectionButtonRef={connectionButtonRef}
                          connectionMenuOpen={connectionMenuOpen}
                          connectionMenuRef={connectionMenuRef}
                          connectionOptions={connectionOptions}
                          draft={draft}
                          draftSuffix={draftSuffix}
                          effectiveConnection={effectiveConnection}
                          effectiveConnectionId={effectiveConnectionId}
                          enterToSend={enterToSend}
                          floatingTextareaRef={floatingTextareaRef}
                          handleAttachmentUpload={handleAttachmentUpload}
                          handleConnectionChange={handleConnectionChange}
                          handleOpenContextViewer={handleOpenContextViewer}
                          handleOpenHistoryPicker={handleOpenHistoryPicker}
                          handleSubmit={handleSubmit}
                          handleSuggestionSelect={handleSuggestionSelect}
                          isBusy={isBusy}
                          isReadingAttachments={isReadingAttachments}
                          jumpToLatest={jumpToLatest}
                          messages={messages}
                          mobileFocusMode={mobileFocusMode}
                          omnibarMode={omnibarMode}
                          onConnectionMenuKeyDown={onConnectionMenuKeyDown}
                          onPermissionsMenuKeyDown={onPermissionsMenuKeyDown}
                          oneShotContext={oneShotContext}
                          permissionsButtonRef={permissionsButtonRef}
                          permissionsMenuOpen={permissionsMenuOpen}
                          permissionsMenuRef={permissionsMenuRef}
                          permissionsMode={permissionsMode}
                          permissionsModeDefault={permissionsModeDefault}
                          permissionsModeOverridden={permissionsModeOverridden}
                          changePermissionsMode={changePermissionsMode}
                          reduceMotion={reduceMotion}
                          removeOneShotFacet={removeOneShotFacet}
                          setAttachments={setAttachments}
                          setComposerScroll={setComposerScroll}
                          setConnectionMenuOpen={setConnectionMenuOpen}
                          setDraft={setDraft}
                          setHandoffContext={setHandoffContext}
                          setPermissionsMenuOpen={setPermissionsMenuOpen}
                          showJumpToLatest={showJumpToLatest}
                          showNextStepCards={showNextStepCards}
                          showSuggestionPrompt={showSuggestionPrompt}
                          sidecarNativeToolCalls={sidecarNativeToolCalls}
                          stopWorkspace={stopWorkspace}
                          suggestionQuestion={suggestionQuestion}
                          workspaceTimelineActive={workspaceTimelineActive}
                        />
                      </div>
                    </div>
                  </motion.div>
                  {/* The destination's panel: the one tab-panel for the selected tab (omnibar header). */}
                  <div
                    className="contents"
                    role={omnibarMode && workspaceDestination !== "chat" ? "tabpanel" : undefined}
                    aria-labelledby={
                      omnibarMode && workspaceDestination !== "chat" ? `mari-tab-${workspaceDestination}` : undefined
                    }
                  >
                    <AnimatePresence initial={false}>
                      {chatHistoryOpen ? (
                        <motion.div
                          key="professor-mari-chats"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={paneTransition}
                          className={MARI_PANEL_SLOT_CLASS}
                        >
                          <MariChatsPanel
                            chatHistory={chatHistory}
                            chatHistoryLoading={chatHistoryLoading}
                            chatHistoryQuery={chatHistoryQuery}
                            chatHistorySelectionMode={chatHistorySelectionMode}
                            chatHistorySortMode={chatHistorySortMode}
                            chatId={chatId}
                            chatRowMenuId={chatRowMenuId}
                            chatRowMenuRef={chatRowMenuRef}
                            chatRowPopoverRef={chatRowPopoverRef}
                            displayedChatHistory={displayedChatHistory}
                            handleBulkDeleteProfessorChats={handleBulkDeleteProfessorChats}
                            handleDeleteProfessorChat={handleDeleteProfessorChat}
                            handleRenameProfessorChat={handleRenameProfessorChat}
                            handleSelectProfessorChat={handleSelectProfessorChat}
                            isBusy={isBusy}
                            onChatRowMenuKeyDown={onChatRowMenuKeyDown}
                            renameDraft={renameDraft}
                            renamingChatId={renamingChatId}
                            runRestart={runRestart}
                            selectedChatHistoryIds={selectedChatHistoryIds}
                            setChatHistoryQuery={setChatHistoryQuery}
                            setChatHistorySelectionMode={setChatHistorySelectionMode}
                            setChatHistorySortMode={setChatHistorySortMode}
                            setChatRowMenuId={setChatRowMenuId}
                            setRenameDraft={setRenameDraft}
                            setRenamingChatId={setRenamingChatId}
                            setSelectedChatHistoryIds={setSelectedChatHistoryIds}
                            setWorkspaceDestination={setWorkspaceDestination}
                            toggleProfessorChatSelection={toggleProfessorChatSelection}
                          />
                        </motion.div>
                      ) : memoriesMenuOpen ? (
                        <motion.div
                          key="professor-mari-memories"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={paneTransition}
                          className={MARI_PANEL_SLOT_CLASS}
                        >
                          <Suspense fallback={null}>
                            <ProfessorMariMemoriesMenu
                              memories={memories}
                              query={memoriesQuery}
                              selectedMemory={selectedMemory}
                              draft={memoryDraft}
                              loading={memoriesLoading}
                              saving={memoriesSaving}
                              fileInputRef={memoryFileInputRef}
                              onClose={() => setWorkspaceDestination("chat")}
                              onNew={handleNewMemory}
                              onUploadClick={handleMemoryUploadClick}
                              onFileChange={handleMemoryFileChange}
                              onSelect={setSelectedMemoryId}
                              onDraftChange={setMemoryDraft}
                              onSave={() => void handleSaveMemory()}
                              onDelete={(id) => void handleDeleteMemory(id)}
                              onToggleEnabled={handleToggleMemoryEnabled}
                              onTogglePersistent={handleToggleMemoryPersistent}
                              onQueryChange={setMemoriesQuery}
                            />
                          </Suspense>
                        </motion.div>
                      ) : skillsMenuOpen ? (
                        <motion.div
                          key="professor-mari-skills"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={paneTransition}
                          className={MARI_PANEL_SLOT_CLASS}
                        >
                          <Suspense fallback={null}>
                            <ProfessorMariSkillsMenu
                              skills={skills}
                              query={skillsQuery}
                              selectedSkill={selectedSkill}
                              draft={skillDraft}
                              loading={skillsLoading}
                              saving={skillsSaving}
                              diagnostics={skillsDiagnostics}
                              fileInputRef={skillFileInputRef}
                              onClose={() => setWorkspaceDestination("chat")}
                              onNew={handleNewSkill}
                              onUploadClick={handleSkillUploadClick}
                              onFileChange={handleSkillFileChange}
                              onSelect={setSelectedSkillId}
                              onDraftChange={setSkillDraft}
                              onSave={() => void handleSaveSkill()}
                              onDelete={(id) => void handleDeleteSkill(id)}
                              onToggle={(skill) => void handleToggleSkill(skill)}
                              onQueryChange={setSkillsQuery}
                            />
                          </Suspense>
                        </motion.div>
                      ) : workspaceDestination === "context" ? (
                        <motion.section
                          key="professor-mari-context"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={paneTransition}
                          className={MARI_PANEL_SLOT_CLASS}
                        >
                          <MariSeesPanel
                            attachedContext={attachedContext}
                            contextBudget={contextBudget}
                            effectiveConnection={effectiveConnection}
                            handleOpenHistoryPicker={handleOpenHistoryPicker}
                            handoffContext={handoffContext}
                            oneShotContext={oneShotContext}
                            oneShotContextFacets={oneShotContextFacets}
                            removeOneShotFacet={removeOneShotFacet}
                            selectedContextId={selectedContextId}
                            setConnectionMenuOpen={setConnectionMenuOpen}
                            setHandoffContext={setHandoffContext}
                            setSelectedContextId={setSelectedContextId}
                            setWorkspaceDestination={setWorkspaceDestination}
                            showContextUsage={showContextUsage}
                            workspaceStatus={workspaceStatus}
                          />
                        </motion.section>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </ProfessorMariMobilePortal>
        )}
      </AnimatePresence>
    </>
  );
}
