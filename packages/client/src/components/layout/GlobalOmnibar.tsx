import { useMariAppearancePack } from "../../hooks/use-mari-appearance-pack";
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type {
  ChatMode,
  Message,
  ProfessorMariAskContext,
  ProfessorMariEntryPoint,
  ProfessorMariQuickSource,
} from "@marinara-engine/shared";
import { LOCAL_SIDECAR_CONNECTION_ID, matchOmnibarCapabilityAgentPackageIds } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { MARI_QUICK_CONNECTION, marisConnectionFor } from "../../lib/omnibar-aside-text";
import { ChevronLeft, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { checkReply } from "../../lib/reply-checkup";
import { countBlockingReviews } from "../../lib/professor-mari-presentation";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { chatKeys, useChats, useProfessorMariChats, useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { requestChatRetryWithConnection } from "../../lib/chat-floating-ui-events";
import { useConnections } from "../../hooks/use-connections";
import { useStartNewChatMode } from "../../hooks/use-start-new-chat-mode";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { HOME_FAQ_ITEMS, getFaqSearchText } from "../chat/HomeFaq";
import { useDocsCommandSearchProvider } from "../../hooks/use-docs-command-search";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useQueryClient } from "@tanstack/react-query";
import { mariFallbackFocus, mariFixRowId, type MariArrivalAction } from "../../lib/mari-arrival";
import { isOmnibarSettingsTarget } from "../../lib/settings-registry";
import { usePresets, useSetDefaultPreset } from "../../hooks/use-presets";
import { useProfessorMariWorkspaceStatus } from "../../hooks/use-professor-mari-workspace-status";
import { useOmnibarAside } from "../../hooks/use-omnibar-aside";
import { expandChoiceRows, readChoiceOptionId } from "../../lib/omnibar-choice-rows";
import {
  clearOmnibarFrecencyHistory,
  readOmnibarFrecencyEntries,
  recordOmnibarFrecencyUse,
  type OmnibarFrecencyEntry,
} from "../../lib/omnibar-frecency";
import { isOmnibarCommandPick } from "../../lib/omnibar-empty-state";
import { completeInline } from "../../lib/inline-completion";
import { isLanguageGenerationConnection } from "../../lib/connection-filters";
import {
  COMMAND_CENTER_CATEGORY_FILTERS,
  presentCommandCenterResults,
  rankCommandResults,
  readCommandCenterSessionState,
  readCommandRankingState,
  advanceMariHandoff,
  isApplePlatform,
  isAskMariShortcut,
  recordCommandUse,
  writeCommandRankingState,
  writeCommandCenterSessionState,
  type CommandCenterCategoryFilter,
  type CommandCenterSessionState,
  type CommandRankingState,
} from "../../lib/command-center";
import { createSystemCommandDefinitions } from "../../lib/command-center-system-commands";
import { type OmnibarRowVisualContext, resolveOmnibarRowVisual } from "../../lib/omnibar-row-visual";
import { OmnibarUnderstoodLine } from "./omnibar/OmnibarUnderstoodLine";
import {
  filterOmnibarFuzzyFallback,
  isDirectActiveChatAction,
  resultOpensDirectlyOnTap,
  omnibarMatchQueries,
  type OmnibarResult,
} from "../../lib/omnibar-search";
import {
  buildOmnibarContextResults,
  idleOmnibarContextResults,
  resolveOmnibarUnderstoodLine,
  buildOmnibarContinueResult,
  findMentionedResults,
  buildOmnibarMariChatResults,
  buildOmnibarAddSuggestions,
  buildOmnibarVerbSuggestions,
  buildOmnibarIntentShortcuts,
  buildOmnibarNewChatCommands,
  buildOmnibarRemovalSuggestions,
  buildOmnibarSearchResults,
  buildOmnibarSlashResults,
} from "../../lib/omnibar-results";
import {
  isMariInstruction,
  isQuestionShaped,
  matchesOmnibarScope,
  omnibarScopePrefix,
  parseOmnibarScope,
} from "../../lib/omnibar-scope";
import { reconcileActiveResultId } from "../../lib/omnibar-row-state";
import { omnibarCompletionActions, type OmnibarCompletionAction } from "../../lib/omnibar-completion-actions";
import { buildProfessorMariCommandCenterContext } from "../../lib/professor-mari-command-center-context";
import {
  consumeProfessorMariOpenRequest,
  peekProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";
import type { ProfessorMariNavigationTarget } from "../../lib/professor-mari-navigation";
import { executeStateNavigation } from "../../lib/state-navigation";
import { isPullHandoffPending, takePullHandoff } from "../../lib/pull-to-open";
import { measureOmnibarFirstResultPaint } from "../../lib/omnibar-open-timing";
import { hasEditorLeaveHandler } from "../../lib/editor-leave";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { useUIStore } from "../../stores/ui.store";
import { InlineGhostText } from "../ui/InlineGhostText";
import {
  getCommandCenterCategoryVisual,
  getCommandCenterChatModeVisual,
} from "../command-center/command-center-visuals";
import { OmnibarSettingsButton, OmnibarSettingsSheet } from "./omnibar/OmnibarSettingsMenu";
import {
  getOmnibarResourceId,
  isRichResult,
  readNamedRow,
  type OmnibarPane,
  type RankedOmnibarResult,
} from "./omnibar/omnibar-result-view";
import {
  CHAT_RESOURCE_KIND,
  createModalPrefillName,
  CHAT_SCOPED_CHOICE_CONTROL_IDS,
  EDITOR_CATEGORIES,
} from "./omnibar/omnibar-dialog-rules";
import { usePreviewDetail } from "./omnibar/use-preview-detail";
import { useOmnibarLabels } from "./omnibar/use-omnibar-labels";
import { useOmnibarEmptyState } from "./omnibar/use-omnibar-empty-state";
import { useOmnibarMariArrival } from "./omnibar/use-omnibar-mari-arrival";
import { OmnibarResultList } from "./omnibar/OmnibarResultList";
import {
  OmnibarMariDoor,
  OmnibarScopeChips,
  OmnibarFilterStrip,
  OmnibarEmpty,
  OmnibarFooter,
} from "./omnibar/OmnibarChrome";
import { buildOmnibarPreviewActions } from "./omnibar/omnibar-preview-actions";
import { createOmnibarKeyHandlers } from "./omnibar/omnibar-keyboard";
import { useOmnibarEntityRows } from "./omnibar/use-omnibar-entity-rows";
import { useOmnibarMessageSearch } from "./omnibar/use-omnibar-message-search";
import { useOmnibarScreenContext } from "./omnibar/use-omnibar-screen-context";
import { createOmnibarResultActions } from "./omnibar/omnibar-result-actions";
import { useOmnibarLocalResults } from "./omnibar/use-omnibar-local-results";
import { formatShortcutKey } from "../../lib/keyboard-shortcuts";
import { preloadedLazy } from "../../lib/preloaded-lazy";
// Each pane only renders once the user opens it, so they stay out of the
// initial AppShell chunk.
const OmnibarDetailPane = lazy(() =>
  import("./omnibar/OmnibarDetailPane").then((m) => ({ default: m.OmnibarDetailPane })),
);
// Preloaded at idle by GlobalOmnibarHost (preloadedLazy: no Suspense throttle on the first ⌘J).
export const OmnibarMariPane = preloadedLazy(() => import("./omnibar/OmnibarMariPane").then((m) => m.OmnibarMariPane));
const OmnibarAside = lazy(() => import("./omnibar/OmnibarAside").then((m) => ({ default: m.OmnibarAside })));

const PROFESSOR_MARI_DRAFT_KEY = "__home_professor_mari__";

/**
 * K5's last flip, kept past the dialog's unmount so Mari's arrival in Settings can offer the same Undo
 * as the toast. ponytail: one slot, cleared by either Undo; a flip made in the Settings panel itself
 * is not tracked here.
 */
let lastSettingFlip: { label: string; undo: () => void } | null = null;

export function GlobalOmnibarDialog({ onClose }: { onClose: () => void }) {
  const appearance = useMariAppearancePack();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const ui = useUIStore.getState;
  const inputRef = useRef<HTMLInputElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstResultPaintMarked = useRef(false);
  // Opened by the pull-to-open gesture, whose circle pops the panel open: skip the
  // pop-in and hand the panel over before the first paint, so it can be clipped.
  const [fromPull] = useState(isPullHandoffPending);
  // L8: opened over the game setup wizard, the surface is the game setup. The
  // omnibar covers the wizard, so its step cannot change while this is open.
  const [gameSetupStep] = useState(
    () => document.querySelector("[data-game-setup-step]")?.getAttribute("data-game-setup-step") ?? null,
  );
  // Read before this dialog commits, so only another dialog (the wizard, a lightbox, a Modal) counts.
  const [overDialog] = useState(() => document.querySelector('[aria-modal="true"]') !== null);
  useLayoutEffect(() => takePullHandoff()?.(dialogRef.current), []);
  // R33: how far the search field has to fall to land where Mari's composer sits.
  // Measured while the list is still up, because by the time it leaves the field
  // is gone. 0 means "do not travel" - reduced motion, or a phone, where the
  // composer is already pinned above the keyboard and there is nowhere to fall.
  const [inputTravel, setInputTravel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // The omnibar always reopens on search: closing persists `results` (see the
  // unmount flush below), so the Mari conversation resumes only on explicit
  // re-entry. The normalizer deliberately preserves a persisted `mari` pane,
  // because `GlobalOmnibarHost` hands off an "open Professor Mari" request by
  // writing that pane and then opening; resetting it on read would kill that.
  const [session, setSession] = useState<CommandCenterSessionState>(() => readCommandCenterSessionState());
  const initialQueryRef = useRef(session.query);
  const mariEnabled = useUIStore((state) => state.commandCenterMariEnabled);
  const { query, filter, activeResultId, mariReturnResultId, mariHandoff } = session;
  // Mari can be switched off from the omnibar's settings menu, the Settings panel
  // or a result row, and the first of those is reachable from inside her own pane.
  // Reading the pane through the flag strands nobody: the persisted `mari` pane
  // resolves to the list until Mari is switched back on. Derived rather than an
  // effect, so there is no frame where the disabled pane is still on screen.
  const pane = !mariEnabled && session.pane === "mari" ? "results" : session.pane;
  const mariFinished = mariHandoff?.status === "finished";
  const setSessionValue = <K extends keyof CommandCenterSessionState>(key: K, value: CommandCenterSessionState[K]) =>
    setSession((current) => ({ ...current, [key]: value }));
  const setQuery = (value: string) => setSessionValue("query", value);
  // Keep typing responsive: the heavy search/rank/present pipeline reruns against
  // the deferred query so keystrokes paint immediately on large libraries.
  const rawDeferredQuery = useDeferredValue(query);
  // "faq: import", "msg: dragon" — a typed prefix narrows the result list to one
  // kind. Everything downstream sees only the part after the prefix, so ranking
  // and matching never see the scope word as a search term.
  const { scope: queryScope, query: deferredQuery } = useMemo(
    () => parseOmnibarScope(rawDeferredQuery),
    [rawDeferredQuery],
  );
  const setFilter = (value: CommandCenterCategoryFilter) => setSessionValue("filter", value);
  const setPane = (value: OmnibarPane) => setSessionValue("pane", value);
  const setActiveResultId = (value: string | null) => setSessionValue("activeResultId", value);
  const settingsTarget = useUIStore((state) => state.omnibarSettings);
  const settingsOpen = settingsTarget !== null;
  const openSettings = useUIStore((state) => state.openOmnibarSettings);
  const closeSettings = useUIStore((state) => state.closeOmnibarSettings);
  const [mariChatOpen, setMariChatOpen] = useState(() => session.pane === "mari");
  const [mariMounted, setMariMounted] = useState(() => session.pane === "mari");
  const [mariContext, setMariContext] = useState<ProfessorMariAskContext | null>(
    () => session.mariHandoff?.context ?? null,
  );
  // A counter, not a flag: the same handoff can happen twice with a new query, and
  // a boolean that is already true delivers no change for the child to react to.
  // Matches mariPendingReviewRequest, which solved the same problem.
  const [mariSubmitDraftRequest, setMariSubmitDraftRequest] = useState(0);
  const [mariPendingReviewRequest, setMariPendingReviewRequest] = useState(0);
  // R9: which review the last request targeted, or null for "any" (the generic continue
  // row and the completion action's "Review changes" button, which have no one review in mind).
  const [mariPendingReviewId, setMariPendingReviewId] = useState<string | null>(null);
  // D1: every arrival-door open (⌘J, the pull, the drag, Home's "Ask Professor Mari") bumps this,
  // so the chat can show the arrival at the bottom of her existing transcript when she already has
  // history — the door's whole promise ("ask Mari about this") otherwise goes unmet on return visits.
  const [mariArrivalAppendRequest, setMariArrivalAppendRequest] = useState(0);
  useEffect(() => {
    const pendingDraft = session.mariHandoff?.draft;
    if (!pendingDraft) return;
    useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, pendingDraft);
    // Clear it once applied: `mariHandoff` is persisted session state, so leaving
    // the draft in place would write it back into the composer on every future
    // mount, overwriting whatever the user typed since.
    setSession((current) =>
      current.mariHandoff?.draft ? { ...current, mariHandoff: { ...current.mariHandoff, draft: undefined } } : current,
    );
  }, [session.mariHandoff?.draft]);
  // A cold "open Mari and send" request (fired while the omnibar itself was
  // closed) has nobody around to bump `mariSubmitDraftRequest` directly:
  // `GlobalOmnibarHost` wrote the flag straight into the persisted session
  // before this dialog ever mounted. Pick it up once, then clear it.
  useEffect(() => {
    if (!session.mariHandoff?.submitDraft) return;
    setMariSubmitDraftRequest((current) => current + 1);
    setSession((current) =>
      current.mariHandoff?.submitDraft
        ? { ...current, mariHandoff: { ...current.mariHandoff, submitDraft: undefined } }
        : current,
    );
  }, [session.mariHandoff?.submitDraft]);
  // Transient on purpose: reopening the omnibar always starts from a bare list.
  const [expandedChoiceId, setExpandedChoiceId] = useState<string | null>(null);
  // Which row has its preview open. Replaces the detail pane on narrow screens:
  // the row grows, so nothing above it moves and the list never goes away.
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  /**
   * R33: the search field flies down to become Mari's composer, so the surface
   * visibly turns into a conversation instead of being replaced by a different
   * screen.
   *
   * A one-shot ghost rather than a shared `layoutId`: pairing the real elements
   * would leave a layout animation attached to the composer for the rest of the
   * session, and it would then re-animate every time the textarea grew.
   */
  const [fieldFlight, setFieldFlight] = useState<{
    from: { top: number; left: number; width: number; height: number };
    to: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const [mariHeaderSlot, setMariHeaderSlot] = useState<HTMLDivElement | null>(null);
  const [mariStatusSlot, setMariStatusSlot] = useState<HTMLSpanElement | null>(null);
  const [mariMenuSlot, setMariMenuSlot] = useState<HTMLSpanElement | null>(null);
  const mariReturnResultIdRef = useRef<string | null>(mariReturnResultId);
  const [ranking, setRanking] = useState<CommandRankingState>(() => readCommandRankingState());
  // O2: local frecency, read once and kept in sync with every recorded use (see recordUse below).
  const [frecencyEntries, setFrecencyEntries] = useState<readonly OmnibarFrecencyEntry[]>(() =>
    readOmnibarFrecencyEntries(),
  );
  const chats = useChats();
  const characters = useCharacters();
  const personas = usePersonas();
  const lorebooks = useLorebooks(undefined, { includeHidden: true });
  const presets = usePresets();
  const connections = useConnections();
  const startNewChatMode = useStartNewChatMode();
  const languageConnections = useMemo(
    () =>
      (connections.data ?? []).flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const record = value as Record<string, unknown>;
        const row = readNamedRow(record);
        if (
          !row ||
          !isLanguageGenerationConnection({ provider: typeof record.provider === "string" ? record.provider : null })
        ) {
          return [];
        }
        return [
          {
            id: row.id,
            name: row.name,
            model: typeof record.model === "string" ? record.model : "",
            // `/connections` sends these as "true"/"false" strings.
            isDefault: String(record.isDefault) === "true",
            defaultForAgents: String(record.defaultForAgents) === "true",
          },
        ];
      }),
    [connections.data],
  );
  const agents = useAgentConfigs();
  const setDefaultPreset = useSetDefaultPreset();
  // `useMutation` hands back a new result object on every render, so using
  // `setDefaultPreset` itself as a memo dep below would
  // rebuild the row list (and everything ranked from it) on every keystroke
  // and hover instead of only when the underlying data changes. Its
  // `.mutate` function is stable across renders, same as `patchChat` below.
  const setDefaultPresetMutate = setDefaultPreset.mutate;
  const updateChat = useUpdateChat();
  const updateChatMetadata = useUpdateChatMetadata();
  const docs = useDocsCommandSearchProvider(query, { enabled: true });
  const theme = useUIStore((state) => state.theme);
  const reduceMotion = useReducedMotion();
  const omnibarSuggestionsEnabled = useUIStore((state) => state.omnibarSuggestionsEnabled);
  const mariWorkspaceStatus = useProfessorMariWorkspaceStatus();
  // Her run keeps going on the server when her pane is closed; the status poll is how the omnibar knows.
  const mariWorkingInBackground = mariWorkspaceStatus.data?.active === true;
  const asideDisclosed = useUIStore((state) => state.omnibarAsideDisclosed);
  const asideConnectionId = useUIStore((state) => state.omnibarAsideConnectionId);
  const mariConnectionId = useUIStore((state) => state.mariConnectionId);
  const asideDelayMs = useUIStore((state) => state.omnibarAsideDelayMs);
  const setAsideDisclosed = useUIStore((state) => state.setOmnibarAsideDisclosed);
  const setAsideEnabled = useUIStore((state) => state.setOmnibarAsideEnabled);
  const setAsideConnectionId = useUIStore((state) => state.setOmnibarAsideConnectionId);
  const openRightPanel = useUIStore((state) => state.openRightPanel);
  const openAgentCatalog = useUIStore((state) => state.openAgentCatalog);
  const activeChat = useChatStore((state) => state.activeChat);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const openCharacterId = useUIStore((state) => state.characterDetailId);
  const activeEditorField = useUIStore((state) => state.activeEditorField);
  const lastAppError = useUIStore((state) => state.lastAppError);
  const openPersonaId = useUIStore((state) => state.personaDetailId);
  const openLorebookId = useUIStore((state) => state.lorebookDetailId);
  const openPresetId = useUIStore((state) => state.presetDetailId);
  const openConnectionId = useUIStore((state) => state.connectionDetailId);
  const openAgentId = useUIStore((state) => state.agentDetailId);
  const settingsTab = useUIStore((state) => state.settingsTab);
  const settingsTargetControlId = useUIStore((state) => state.settingsTargetControlId);
  const settingsPanelVisible = useUIStore((state) => state.rightPanelOpen && state.rightPanel === "settings");
  const agentCatalogOpen = useUIStore((state) => state.agentCatalogOpen);

  const { idleGreeting, categoryLabels, chatModeLabels, filterLabels, groupLabels, contextLabels } = useOmnibarLabels(
    activeChat,
    activeChatId,
  );
  const { characterNameById, personaById, connectionById, data } = useOmnibarEntityRows({
    chats: chats.data,
    characters: characters.data,
    personas: personas.data,
    lorebooks: lorebooks.data,
    presets: presets.data,
    connections: connections.data,
    agents: agents.data,
    categoryLabels,
    chatModeLabels,
    setDefaultPresetMutate,
  });

  const { controls, chatControls, searchableEntityResults, allLocalResults, patchChat, patchChatMetadata } =
    useOmnibarLocalResults({ activeChat, activeChatId, data, theme, updateChat, updateChatMetadata });
  const omnibarContext = useOmnibarScreenContext({
    activeChat,
    activeChatId,
    agentCatalogOpen,
    openAgentId,
    openCharacterId,
    openConnectionId,
    openLorebookId,
    openPersonaId,
    openPresetId,
    settingsPanelVisible,
    settingsTab,
    settingsTargetControlId,
    ranking,
    commands: data.commands,
    sources: { chats, characters, personas, lorebooks, presets, connections, agents, docs },
  });
  const { messageResults, globalMessageScoped, globalMessageSearch, globalMessageResults, lorebookEntryResults } =
    useOmnibarMessageSearch({ activeChatId, deferredQuery, queryScope, lorebooks: lorebooks.data });
  // F1: an exact message/entry hit should win over the Mari fallback promotion
  // even when nothing else scored well (slice 41). Docs hits are the same
  // kind of late-arriving direct answer (search results that land after their
  // own debounce), so they count too — "Ask Prof. Mari" must not outrank a direct
  // hit from any of these late sources (O4 item 2b / tasks 6 and 13).
  // R6: a fresh install (no language connection, no local model) gets docs first, not "Ask Prof. Mari".
  // While connections load, keep the old behavior rather than reorder the list when they land.
  const localModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const mariHasModel = !connections.data || languageConnections.length > 0 || localModelDownloaded;
  const directHitCount =
    messageResults.length + globalMessageResults.length + lorebookEntryResults.length + docs.results.length;
  const searchResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarSearchResults({
        chatControls,
        contextLabels,
        controls,
        data,
        deferredQuery,
        directHitCount,
        docsResults: docs.results,
        faqItems: HOME_FAQ_ITEMS,
        frecencyEntries,
        getFaqSearchText,
        localize,
        mariEnabled,
        mariHasModel,
        omnibarContext,
        t,
      }),
    [
      chatControls,
      contextLabels,
      controls,
      data,
      deferredQuery,
      directHitCount,
      docs.results,
      frecencyEntries,
      localize,
      mariEnabled,
      mariHasModel,
      omnibarContext,
      t,
    ],
  );
  // Professor Mari's conversations live behind an internal marker, so they are
  // missing from the normal chat list. Searchable here by their auto-title.
  const [mariOpenChatId, setMariOpenChatId] = useState<string | null>(null);
  // Fetched on open rather than on the first keystroke, so the rows are ready
  // before typing instead of arriving late and pushing the list down.
  const mariChats = useProfessorMariChats(mariEnabled);
  const mariChatResults = useMemo<OmnibarResult[]>(
    () => buildOmnibarMariChatResults({ deferredQuery, mariChats: mariChats.data ?? [], t }),
    [deferredQuery, mariChats.data, t],
  );

  // The chat input already owns a slash-command registry; the omnibar reuses it
  // so "what can I do in this chat" is answerable from one place. Choosing a row
  // types the command into the chat input instead of running it, so args and
  // confirmation stay where the user can see them.
  const installedCapabilities = useInstalledCapabilityPackages();
  const slashAvailability = useMemo(
    () => ({
      mode: activeChat?.mode === "roleplay" || activeChat?.mode === "conversation" ? activeChat.mode : undefined,
      availableCapabilityIds: new Set(
        (installedCapabilities.data ?? []).filter((item) => item.status === "active").map((item) => item.id),
      ),
    }),
    [activeChat?.mode, installedCapabilities.data],
  );
  const slashResults = useMemo<OmnibarResult[]>(
    () => buildOmnibarSlashResults({ activeChatId, deferredQuery, slashAvailability, surface: omnibarContext.surface }),
    [activeChatId, deferredQuery, omnibarContext.surface, slashAvailability],
  );
  const queryClient = useQueryClient();
  // R2: the checkup of the open chat's newest message when it is a reply, from the cached page only.
  const lastReplyFindings = useMemo(() => {
    if (!activeChat || activeChat.id !== activeChatId) return [];
    const newest = queryClient.getQueryData<{ pages: Message[][] }>(chatKeys.messages(activeChat.id))?.pages[0]?.at(-1);
    return newest && (newest.role === "assistant" || newest.role === "narrator") ? checkReply(newest) : [];
  }, [activeChat, activeChatId, queryClient]);
  // Context-aware results: read the app's current location (active chat, open
  // editor) and surface direct jumps to whatever is on screen and under it.
  const contextResults = useMemo<OmnibarResult[]>(() => {
    const built = buildOmnibarContextResults({
      activeChat,
      activeChatId,
      activeEditorField,
      agents: agents.data,
      allLocalResults,
      characterNameById,
      connectionById,
      lastAppError,
      lorebooks: lorebooks.data,
      mariEnabled,
      omnibarSuggestionsEnabled,
      openAgentId,
      openCharacterId,
      openConnectionId,
      openLorebookId,
      openPersonaId,
      openPresetId,
      personaById,
      personas: personas.data,
      presets: presets.data,
      surface: omnibarContext.surface,
      t,
      lastReplyFindings,
    });
    // The Fix row for a failed reply only opened the broken connection's
    // editor; picking one of the chat's other connections here now retries
    // the failed message with it at once (O4 item 3).
    const retry = lastAppError?.retry;
    if (!activeChatId || retry?.kind !== "open-connection") return built;
    const fixRowId = `connection:${retry.id}`;
    const otherConnections = languageConnections.filter((connection) => connection.id !== retry.id);
    if (otherConnections.length === 0) return built;
    return built.map((result) =>
      result.id === fixRowId
        ? {
            ...result,
            control: {
              type: "choice" as const,
              label: t("commandCenter.actions.retryWithConnection", "Retry with"),
              value: "",
              options: otherConnections.map((connection) => ({ value: connection.id, label: connection.name })),
              onChange: (value: string | boolean) => {
                const connectionId = String(value);
                if (connectionId) requestChatRetryWithConnection(activeChatId, connectionId);
              },
            },
          }
        : result,
    );
  }, [
    activeChat,
    activeChatId,
    activeEditorField,
    allLocalResults,
    agents.data,
    characterNameById,
    connectionById,
    languageConnections,
    lastAppError,
    lastReplyFindings,
    lorebooks.data,
    mariEnabled,
    openAgentId,
    openCharacterId,
    openConnectionId,
    openLorebookId,
    openPersonaId,
    openPresetId,
    personaById,
    personas.data,
    presets.data,
    omnibarSuggestionsEnabled,
    omnibarContext.surface,
    t,
  ]);
  const [settingUndoVersion, setSettingUndoVersion] = useState(0);
  const { mariArrival, mariThreadContext } = useOmnibarMariArrival({
    activeChat,
    activeChatId,
    activeEditorField,
    agents: agents.data,
    characterNameById,
    connectionById,
    gameSetupStep,
    lastAppError,
    lorebooks: lorebooks.data,
    mariEnabled,
    omnibarContext,
    openAgentId,
    personas: personas.data,
    presets: presets.data,
    settingsPanelVisible,
    settingsTab,
    settingsTargetControlId,
    settingUndoVersion,
    undoLabel: lastSettingFlip?.label ?? null,
  });
  const attachedResultIds = useMemo(
    () => new Set(omnibarContext.activeChat?.resultIds ?? []),
    [omnibarContext.activeChat?.resultIds],
  );
  const removalSuggestions = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarRemovalSuggestions({
        activeChat,
        attachedResultIds,
        contextResults,
        deferredQuery,
        omnibarSuggestionsEnabled,
        t,
      }),
    [activeChat, attachedResultIds, contextResults, deferredQuery, omnibarSuggestionsEnabled, t],
  );
  // A bare "add" has no search results to draw on, so the recently used rows
  // stand in: a few concrete "Add Eliza to this chat" rows are worth more than
  // six abstract kind rows alone. Kept short so the kind rows stay visible.
  const recentAttachable = useMemo(() => {
    const byId = new Map(allLocalResults.map((item) => [item.id, item]));
    return ranking.recent.flatMap((entry) => {
      const item = byId.get(entry.id);
      return item && CHAT_RESOURCE_KIND[item.category] ? [item] : [];
    });
  }, [allLocalResults, ranking.recent]);
  /**
   * What a bare "add" is answered with. The text search returns nothing for a
   * verb on its own except the Ask-Mari row, so testing `searchResults.length`
   * was never false and the recents fallback never fired: recents lead, then any
   * other attachable, and the builder's own cap decides how many are shown.
   */
  const attachableFallback = useMemo(() => {
    const recent = recentAttachable.slice(0, 3);
    const seen = new Set(recent.map((result) => result.id));
    return [
      ...recent,
      ...allLocalResults.filter((result) => CHAT_RESOURCE_KIND[result.category] && !seen.has(result.id)),
      // The builder caps what it shows; capping here too keeps a large library
      // from copying every attachable row on each query change (section 10).
    ].slice(0, 40);
  }, [allLocalResults, recentAttachable]);
  // Most-recent-first, so "add Eliza to Tavern Night" and a dangling "add Eliza
  // to " (no chat open) both resolve/list real candidates in the order a user
  // would expect — the chat they were just in, not an arbitrary one.
  const recentChatNamedRows = useMemo(
    () =>
      [...(chats.data ?? [])]
        .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt))
        .map((chat) => ({ id: chat.id, name: chat.name })),
    [chats.data],
  );
  const addSuggestions = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarAddSuggestions({
        activeChat,
        attachedResultIds,
        chats: recentChatNamedRows,
        deferredQuery,
        omnibarSuggestionsEnabled,
        searchResults: searchResults.some((result) => CHAT_RESOURCE_KIND[result.category])
          ? searchResults
          : attachableFallback,
        t,
      }),
    [
      activeChat,
      attachableFallback,
      attachedResultIds,
      deferredQuery,
      omnibarSuggestionsEnabled,
      recentChatNamedRows,
      searchResults,
      t,
    ],
  );
  const verbSuggestions = useMemo<OmnibarResult[]>(
    () => buildOmnibarVerbSuggestions({ allLocalResults, deferredQuery }),
    [allLocalResults, deferredQuery],
  );
  const addedResultIds = useMemo(
    () => new Set(addSuggestions.map((item) => item.id.replace("action:add-to-chat:", ""))),
    [addSuggestions],
  );
  // Same reason as the add rows below: while a removal row is offered for an
  // entity, the plain entity row is a duplicate that opens its editor instead,
  // which is never what "remove Eliza" asked for.
  const removedResultIds = useMemo(
    () => new Set(removalSuggestions.map((item) => item.id.replace("action:detach-from-chat:", ""))),
    [removalSuggestions],
  );
  const continueResult = useMemo<OmnibarResult | null>(
    () => buildOmnibarContinueResult({ mariEnabled, t, workspaceStatus: mariWorkspaceStatus.data, mariFinished }),
    [mariEnabled, mariWorkspaceStatus.data, t, mariFinished],
  );
  const { recentChatResults, frecentIdleResults, tryResults, nowResult, setupTryRow, continueResults, markTry } =
    useOmnibarEmptyState({
      activeChat,
      activeChatId,
      allLocalResults,
      characterNameById,
      characters: characters.data,
      chats: chats.data,
      contextResults,
      continueResult,
      deferredQuery,
      frecencyEntries,
      lastAppError,
      lorebooks: lorebooks.data,
      mariChats: mariChats.data,
      mariEnabled,
      mariFinished,
      mariHasModel,
      mariWorkspaceStatus: mariWorkspaceStatus.data,
      omnibarContext,
      omnibarSuggestionsEnabled,
      personas: personas.data,
      queryScope,
      searchableEntityResults,
      theme,
    });
  // "new character Bob", "chat with Shrek": sentences the name search cannot answer.
  const intentShortcuts = useMemo<OmnibarResult[]>(
    () =>
      deferredQuery.trim()
        ? buildOmnibarIntentShortcuts({
            query: deferredQuery,
            characters: [...characterNameById].map(([id, name]) => ({ id, name })),
            t,
          })
        : [],
    [characterNameById, deferredQuery, t],
  );
  // N2: doors into the same new-chat flow as Home's Conversation/Roleplay/Game
  // buttons, findable by typing (not shown idle, matching the create-* commands).
  const newChatCommands = useMemo<OmnibarResult[]>(
    () => (deferredQuery.trim() ? buildOmnibarNewChatCommands({ query: deferredQuery, t }) : []),
    [deferredQuery, t],
  );
  const rawResults = useMemo(
    () =>
      // A scope with nothing typed after it ("char:") is a request to browse that
      // kind, so the whole local list answers it instead of the idle suggestions.
      queryScope && !deferredQuery.trim()
        ? allLocalResults.filter((result) => matchesOmnibarScope(result, queryScope))
        : deferredQuery.trim()
          ? [
              ...(setupTryRow ? [setupTryRow] : []),
              ...intentShortcuts,
              ...newChatCommands,
              ...slashResults,
              ...verbSuggestions,
              ...addSuggestions,
              ...removalSuggestions,
              ...messageResults,
              ...globalMessageResults,
              ...lorebookEntryResults,
              ...mariChatResults,
              // UX-13: the Chat Settings rows for Max output tokens and Memory Recall, when the typed text names them.
              ...contextResults.filter(
                (result) =>
                  result.action?.kind === "open-chat-tool" &&
                  (result.action.tool === "advanced-parameters" || result.action.tool === "memory-recall") &&
                  result.title.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
              ),
              // An explicit "Add X to this chat" row replaces the plain entity row
              // for the same thing: showing both lists every character twice, and
              // the plain one reads like "open" while doing the same attach.
              ...(addedResultIds.size || removedResultIds.size
                ? searchResults.filter((result) => !addedResultIds.has(result.id) && !removedResultIds.has(result.id))
                : searchResults),
            ]
          : // Slice 78: first occurrence wins, so the Now row and Continue drop their duplicates below.
            [
              ...(nowResult ? [nowResult] : []),
              ...tryResults,
              ...continueResults,
              ...idleOmnibarContextResults(
                contextResults,
                activeChat?.id === activeChatId ? (activeChat ?? null) : null,
                lastAppError?.retry?.kind === "open-connection" ? `connection:${lastAppError.retry.id}` : null,
              ),
              ...frecentIdleResults,
              ...recentChatResults,
            ],
    [
      allLocalResults,
      queryScope,
      addSuggestions,
      addedResultIds,
      removedResultIds,
      activeChat,
      activeChatId,
      contextResults,
      frecentIdleResults,
      intentShortcuts,
      lastAppError,
      newChatCommands,
      recentChatResults,
      continueResults,
      nowResult,
      setupTryRow,
      tryResults,
      deferredQuery,
      globalMessageResults,
      lorebookEntryResults,
      mariChatResults,
      messageResults,
      searchResults,
      removalSuggestions,
      slashResults,
      verbSuggestions,
    ],
  );
  const scopedRawResults = useMemo(
    () => (queryScope ? rawResults.filter((result) => matchesOmnibarScope(result, queryScope)) : rawResults),
    [queryScope, rawResults],
  );
  const relevanceFilteredResults = useMemo(() => filterOmnibarFuzzyFallback(scopedRawResults), [scopedRawResults]);
  const rankedResults = useMemo<RankedOmnibarResult[]>(() => {
    const sourceById = new Map<string, OmnibarResult>();
    for (const result of relevanceFilteredResults) {
      if (!sourceById.has(result.id)) sourceById.set(result.id, result);
    }
    const uniqueRawResults = [...sourceById.values()];
    return rankCommandResults(
      uniqueRawResults.map((result) => ({
        command: {
          id: result.id,
          title: result.title,
          kind:
            result.kind ??
            (result.category === "settings"
              ? "settings"
              : result.category === "navigation"
                ? "navigation"
                : "resource"),
          icon:
            result.icon ??
            (result.category === "professor" ? "professor" : result.category === "docs" ? "documentation" : "command"),
          target: result.target,
          availability:
            result.availability === "unavailable"
              ? { status: "requires-capability" }
              : typeof result.availability === "object"
                ? result.availability
                : { status: "available" },
        },
        score: result.score,
      })),
      ranking,
    ).map(({ result }) => ({ ...sourceById.get(result.command.id)!, command: result.command }));
  }, [ranking, relevanceFilteredResults]);
  const presentation = useMemo(
    () =>
      presentCommandCenterResults(rankedResults, {
        query: deferredQuery,
        filter,
        rankingState: ranking,
      }),
    [filter, deferredQuery, rankedResults, ranking],
  );
  const idle = !query.trim() && presentation.groups.length === 0;
  const listVisible = pane !== "mari" && !idle;
  // The filter bar only renders once there is a query, so availability always comes from the results.
  const tabAvailability = presentation.categoryAvailability;
  const availableFilters = COMMAND_CENTER_CATEGORY_FILTERS.filter(
    (item) => item === "all" || item === filter || tabAvailability[item] > 0,
  );
  // R40: a choice row's options are rows, inserted below it. The detail pane was
  // doing two unrelated jobs - previewing a resource and editing a control - and
  // only the first is a preview.
  const results = useMemo(
    () => expandChoiceRows(presentation.results, expandedChoiceId),
    [expandedChoiceId, presentation.results],
  );
  // R10: the aside fires on exactly the queries the Ask-Mari row is promoted
  // for. That predicate is already tuned, and its outcome is visible here - the
  // row lands in "professor-suggested" only when it fires - so there is no
  // second heuristic to keep in step.
  useEffect(() => {
    setExpandedChoiceId(null);
    setExpandedPreviewId(null);
  }, [deferredQuery, filter]);
  // Message and lorebook-entry hits arrive after the Ask row was promoted, so they
  // are checked here too: when the library already answers, no model is called.
  const asideDeadEnd =
    results.some((result) => result.id === "ask-professor-mari" && result.group === "professor-suggested") &&
    messageResults.length === 0 &&
    globalMessageResults.length === 0 &&
    lorebookEntryResults.length === 0;
  // "Same as Mari" is the connection her window uses, so a change there is followed here.
  const asideConnectionOffer = marisConnectionFor(languageConnections, mariConnectionId);
  // "Same as Mari" follows her connection at the time of the question; no local model is needed for it.
  const asideAnswerConnectionId =
    asideConnectionId === MARI_QUICK_CONNECTION
      ? (asideConnectionOffer?.id ?? LOCAL_SIDECAR_CONNECTION_ID)
      : asideConnectionId;
  const asideConnectionName =
    languageConnections.find((connection) => connection.id === asideAnswerConnectionId)?.name ?? null;
  // No local model: the aside offers Mari's own connection in one tap instead of failing on every question.
  // The real surface the user is on, not always "command-center": an open
  // editor or the active chat is a more honest (and more useful) context for
  // the aside's unasked call than the omnibar shell it happens to appear in.
  const asideSource: ProfessorMariEntryPoint = gameSetupStep
    ? "game-setup"
    : omnibarContext.openResource
      ? (`${omnibarContext.openResource.kind}-editor` as ProfessorMariEntryPoint)
      : omnibarContext.surface === "settings"
        ? "settings"
        : omnibarContext.surface === "chat" && activeChat?.id === activeChatId
          ? "character-chat"
          : "command-center";
  // R22: the wizard step is a label only; nothing typed into the wizard is sent.
  const asideResourceLabel = gameSetupStep
    ? gameSetupStep
    : omnibarContext.openResource
      ? (allLocalResults.find((result) => result.id === omnibarContext.openResource?.resultId)?.title ?? null)
      : omnibarContext.surface === "chat" && activeChat?.id === activeChatId
        ? activeChat.name
        : agentCatalogOpen
          ? t("omnibar.aside.downloadAgents", "Download Agents")
          : null;
  const asideState = useOmnibarAside({
    connectionId: asideAnswerConnectionId,
    query: deferredQuery,
    deadEnd: asideDeadEnd && pane === "results",
    source: asideSource,
    resourceLabel: asideResourceLabel,
  });
  // Settled means the answer will not grow: a finished answer, or a failed one whose question still hands over.
  const asideSettled = asideState.status === "complete" || asideState.status === "error";
  // The idle countdown is silent; every later state grows inside the promoted Ask row (R9).
  const asideShown = asideState.status !== "idle";
  // The things a finished answer names, offered as one-click destinations under it.
  const asideLinks = useMemo(
    () => (asideState.status === "complete" ? findMentionedResults(asideState.answer, allLocalResults) : []),
    [allLocalResults, asideState.answer, asideState.status],
  );
  // K4: a capability word in the typed query ("images", "music", "maps"...)
  // points at the real official Agent package, computed from the query the
  // user already typed - no extra data leaves the device for this (R22).
  const asideAgentPackageIds = useMemo(
    () => (asideState.status === "complete" ? matchOmnibarCapabilityAgentPackageIds(asideState.query) : []),
    [asideState.query, asideState.status],
  );
  // Quick and Mari both own the whole dialog. Leaving the search input mounted
  // under them let one keystroke re-enter `results` and abort a running answer.
  const mariSurface = pane === "mari";
  // K6: fire once per open, the first time the results pane actually paints
  // (opening straight into Mari's pane has no results list to time).
  useLayoutEffect(() => {
    if (mariSurface || firstResultPaintMarked.current) return;
    firstResultPaintMarked.current = true;
    measureOmnibarFirstResultPaint(useUIStore.getState().debugMode);
  }, [mariSurface]);
  useLayoutEffect(() => {
    if (mariSurface) return;
    const dialog = dialogRef.current;
    const input = inputRef.current;
    if (!dialog || !input || reduceMotion || !window.matchMedia("(min-width: 640px)").matches) {
      setInputTravel(0);
      return;
    }
    // The panel grows into the takeover, so aim at the taller shell, not this one.
    const grown = Math.min(44 * 16, window.innerHeight * 0.8);
    setInputTravel(
      Math.max(0, grown - (input.getBoundingClientRect().bottom - dialog.getBoundingClientRect().top) - 44),
    );
  }, [mariSurface, reduceMotion]);
  // Ghost text: continue the query with the best-ranked result title. Uses the
  // ranked list already on screen, so the guess never disagrees with row 1.
  // It completes the name only. Completing the whole sentence ("add Eliza to
  // this chat") duplicated the add and removal suggestion rows, which say the
  // same thing as a row you can press Enter on.
  const inlineSuffix = useMemo(() => {
    if (mariSurface) return "";
    const candidates = results.flatMap((result) => (result.id === "ask-professor-mari" ? [] : [result.title]));
    return completeInline(query, candidates);
  }, [mariSurface, query, results]);
  const resultIdsKey = results.map((result) => result.id).join("\u0000");
  const reconciledResultIdsKeyRef = useRef<string | null>(null);
  const reconciledQueryRef = useRef(deferredQuery);
  // F1 (O5): true while the selection is still wherever the effect put it, not
  // somewhere the user picked. Late message/entry/docs hits land after their own
  // debounce and can change which row is first; the selection should keep
  // following that row only while it's still auto-selected. Reset on every
  // query change, cleared the moment the user moves the selection themselves.
  const autoSelectionRef = useRef(true);
  const activeIndex = results.findIndex((result) => result.id === activeResultId);
  const activeResult = activeIndex >= 0 ? results[activeIndex] : undefined;
  const sourceQueries: Array<{ isLoading: boolean; isError: boolean }> = [
    chats,
    characters,
    personas,
    lorebooks,
    presets,
    connections,
    agents,
    ...(globalMessageScoped ? [globalMessageSearch] : []),
  ];
  const loading = sourceQueries.some((item) => item.isLoading) || docs.isSearching;
  const failed = sourceQueries.some((item) => item.isError) || docs.isError;

  // Persist the session, but debounced: writing JSON to localStorage on every
  // keystroke is pure jank. A ref holds the latest session so the unmount-only
  // effect can flush it on close without losing the final edit.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // Set when the typed text went to Mari; the next typed character clears it.
  const handedOffQueryRef = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => writeCommandCenterSessionState(session), 250);
    return () => window.clearTimeout(timer);
  }, [session]);
  // Closing always persists the list. Mari is a place you go, not a place you
  // are returned to, and the pane is the one field that must not survive.
  // A question handed to Mari is hers now, so closing after a hand-off clears it.
  useEffect(
    () => () => {
      const { pane: closedPane, query: closedQuery } = sessionRef.current;
      const handedOff = closedPane === "mari" || handedOffQueryRef.current;
      writeCommandCenterSessionState({
        ...sessionRef.current,
        pane: "results",
        query: handedOff ? "" : closedQuery,
      });
    },
    [],
  );

  useEffect(() => {
    const resultOrderChanged = reconciledResultIdsKeyRef.current !== resultIdsKey;
    reconciledResultIdsKeyRef.current = resultIdsKey;
    const leadingCurrentWorkId =
      !deferredQuery.trim() && presentation.groups[0]?.id === "current-work"
        ? presentation.groups[0].results[0]?.id
        : undefined;
    // When that row is only the chat already open, Enter on it does nothing, so the
    // empty omnibar starts on the last other chat instead: Cmd+K, Enter switches back.
    // F3: stays on "recent" only - "frecent" can hold a settings toggle or other
    // write, and an idle Ctrl+K/Enter must never apply one just because it's used often.
    const firstCurrentWorkId =
      leadingCurrentWorkId && activeChatId && leadingCurrentWorkId === `chat:${activeChatId}`
        ? (presentation.groups.find((group) => group.id === "recent")?.results[0]?.id ?? leadingCurrentWorkId)
        : leadingCurrentWorkId;
    // A new query re-ranks everything, so the selection must follow the new top
    // row instead of sticking to whatever was highlighted before. Otherwise
    // "remove eliza" keeps the plain "Eliza" row selected from earlier
    // keystrokes and Enter opens her editor instead of detaching her.
    const queryChanged = reconciledQueryRef.current !== deferredQuery;
    reconciledQueryRef.current = deferredQuery;
    if (queryChanged) autoSelectionRef.current = true;
    // F1: late-arriving message/entry/docs hits reorder the list after their own
    // debounce, demoting the promoted "Ask Prof. Mari" row below the real hit. If the
    // user has not moved the selection since this query started, the selection
    // must follow that new top row too, not just on the keystroke that changed
    // the query - otherwise Enter still lands on the no-longer-first Mari row.
    const topCandidateId = firstCurrentWorkId ?? results[0]?.id ?? null;
    const next = reconcileActiveResultId(
      queryChanged
        ? null
        : // Also while nothing is selected yet: the effect can run again before the
          // first pass's selection lands, and would fall back to the first row.
          (resultOrderChanged || !activeResultId) && autoSelectionRef.current && topCandidateId
          ? topCandidateId
          : activeResultId,
      results.map((result) => result.id),
    );
    setSession((current) => (current.activeResultId === next ? current : { ...current, activeResultId: next }));
  }, [activeChatId, activeResultId, deferredQuery, presentation.groups, resultIdsKey, results]);

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => {
      // The settings sheet owns focus when it opens the omnibar directly
      // (Settings > Open, a Settings-search jump); focusing the hidden
      // search input underneath it would steal focus from the sheet.
      if (useUIStore.getState().omnibarSettings) return;
      inputRef.current?.focus();
      if (initialQueryRef.current) inputRef.current?.select();
    });
    return () => restoreRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!activeResultId || pane !== "results") return;
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(activeResultId)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeResultId, expandedPreviewId, pane]);

  // Returning from Mari puts focus back on the row that opened her, so the
  // keyboard position survives the round trip; the input is the fallback.
  // The search header comes back after the Mari header's exit animation, so wait (a few frames at
  // most) until the row or the search field is there again.
  const [mariReturnFocus, setMariReturnFocus] = useState(0);
  useEffect(() => {
    if (!mariReturnFocus) return;
    let frame = 0;
    let tries = 40;
    const focusReturn = () => {
      const resultId = mariReturnResultIdRef.current;
      const row = resultId
        ? listRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(resultId)}"]`)
        : null;
      const target = row?.querySelector<HTMLElement>("button") ?? inputRef.current;
      if (target) target.focus();
      else if (tries-- > 0) frame = requestAnimationFrame(focusReturn);
    };
    frame = requestAnimationFrame(focusReturn);
    return () => cancelAnimationFrame(frame);
  }, [mariReturnFocus]);
  const focusMariReturnRow = () => setMariReturnFocus((current) => current + 1);
  /** Measures the search field's flight to the composer dock. See fieldFlight. */
  const startFieldFlight = () => {
    if (reduceMotion || pane === "mari") return;
    const field = inputRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!field || !panel) return;
    const inset = 10;
    setFieldFlight({
      from: { top: field.top, left: field.left, width: field.width, height: field.height },
      to: {
        top: panel.bottom - field.height - inset * 2,
        left: panel.left + inset,
        width: Math.max(panel.width - inset * 2, 0),
        height: field.height,
      },
    });
  };
  // Slice 73: the open chat by its id. Right after a switch (or on a cold phone start) the store's chat
  // record can still be loading, or still be the previous chat; the list may not be there yet either.
  const openChat = activeChat?.id === activeChatId ? activeChat : chats.data?.find((chat) => chat.id === activeChatId);
  // A handoff built before that record arrived gets the chat once it does, so her Context chip (and what
  // she is sent) includes the chat on every door: ⌘J, the pull, the top-bar button.
  const chatPendingForMariRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openChat || chatPendingForMariRef.current !== openChat.id) return;
    chatPendingForMariRef.current = null;
    setMariContext((current) =>
      current && !current.activeChat
        ? { ...current, activeChat: { id: openChat.id, label: openChat.name, mode: openChat.mode } }
        : current,
    );
  }, [openChat]);
  /** Every route into the Work pane goes through here, so none forgets a flag. */
  const enterMariPane = (context?: ProfessorMariAskContext, submitDraft = false, draftOverride?: string) => {
    startFieldFlight();
    handedOffQueryRef.current = true;
    // Set here, not in buildAskContext: that also runs while rendering, and would clear the mark first.
    chatPendingForMariRef.current = context && !context.activeChat && activeChatId ? activeChatId : null;
    if (context) {
      setMariContext(context);
      // The handoff lives in session state, not component state, so a task that
      // Mari finishes while the omnibar is shut is still waiting on reopen.
      setSessionValue("mariHandoff", {
        status: "pending",
        context,
        draft: draftOverride ?? context.query,
      });
    }
    if (submitDraft) setMariSubmitDraftRequest((current) => current + 1);
    setMariChatOpen(true);
    setMariMounted(true);
    setPane("mari");
  };
  const enterRequestedMariPane = useEffectEvent((request: ProfessorMariOpenDetail) => {
    // M9: a door that brings nothing (the pull, Home's "Ask Professor Mari", ⌘J) arrives with this
    // screen's context, exactly like ⌘K's own Ask Mari with an empty query. A left-over query is not sent along.
    // The top-bar pill resumes her current thread like the omnibar's continue row: no routing, reviews in view.
    if (request.resume) {
      openProfessorMari(null, {
        reviewPending: countBlockingReviews(mariWorkspaceStatus.data?.pendingApprovals ?? []) > 0,
      });
      return;
    }
    if (!request.context && !request.draft) {
      openProfessorMari(null, { arrival: true });
      return;
    }
    // A scope prefix like "faq:" is omnibar search syntax, not part of the
    // message text — strip it before it lands in Mari's composer.
    const rawDraft = request.draft ?? request.context?.query ?? "";
    enterMariPane(request.context, request.submitDraft ?? false, parseOmnibarScope(rawDraft).query);
  });
  // A cold door (the omnibar was shut): the host left its request for this dialog to pick up. Read
  // before anything renders, because the Mari chat below consumes open requests in its own (earlier,
  // child-first) mount effect.
  const [coldMariRequest] = useState(() => {
    const pending = peekProfessorMariOpenRequest();
    return (pending?.destination ?? "omnibar") === "omnibar" ? pending : null;
  });
  useEffect(() => {
    if (!coldMariRequest) return;
    consumeProfessorMariOpenRequest("omnibar");
    enterRequestedMariPane(coldMariRequest);
  }, [coldMariRequest]);
  useEffect(() => {
    const openRequestedProfessorMari = (event: Event) => {
      const request = (event as CustomEvent<ProfessorMariOpenDetail>).detail;
      if ((request.destination ?? "omnibar") !== "omnibar") return;
      consumeProfessorMariOpenRequest("omnibar");
      enterRequestedMariPane(request);
    };
    window.addEventListener(PROFESSOR_MARI_OPEN_EVENT, openRequestedProfessorMari);
    return () => window.removeEventListener(PROFESSOR_MARI_OPEN_EVENT, openRequestedProfessorMari);
  }, []);
  /**
   * Guards every path that leaves an open editor, so no route skips the prompt.
   * An editor with a leave handler saves itself on the way out (the store routes
   * the leave through it), so only editors without one need the prompt; the
   * chat sidebar applies the same rule.
   */
  const confirmLeaveEditor = () =>
    !ui().editorDirty ||
    hasEditorLeaveHandler(ui()) ||
    window.confirm(t("commandCenter.dirtyEditor", "You have unsaved changes. Leave this editor?"));
  const navigate = (target: ProfessorMariNavigationTarget) => {
    // Q2: a setting that lives in this omnibar opens its settings view here, so the omnibar stays
    // open and nothing is left behind (no editor-leave prompt, no close).
    if (target.kind === "settings" && isOmnibarSettingsTarget(target)) {
      openSettings(target.controlId ?? null);
      return false;
    }
    if (!confirmLeaveEditor()) return false;
    executeStateNavigation(target);
    return true;
  };
  const recordUse = (id: string) => {
    const next = recordCommandUse(ranking, id);
    setRanking(next);
    writeCommandRankingState(next);
    // O2: a no-op for Mari's row, enforced inside recordOmnibarFrecencyUse.
    setFrecencyEntries(recordOmnibarFrecencyUse(id, omnibarContext.surface));
  };
  const runSystemAction = (result: OmnibarResult) => {
    const definition = createSystemCommandDefinitions((key, fallback) =>
      t(`commandCenter.system.${key}`, fallback),
    ).find((item) => item.id === result.id);
    if (!definition) return false;
    if (!confirmLeaveEditor()) return false;
    if (
      definition.availability.status !== "available" &&
      !(
        definition.availability.status === "requires-capability" &&
        definition.availability.setupTarget &&
        definition.action.kind === "navigate"
      )
    )
      return false;
    if (definition.action.kind === "modal") {
      const props = definition.action.props ? { ...definition.action.props } : undefined;
      const prefillName = createModalPrefillName(definition.action.modal, query);
      ui().openModal(definition.action.modal, prefillName ? { ...props, defaultName: prefillName } : props);
    } else executeStateNavigation(definition.action.target);
    return true;
  };
  const choose = (result: OmnibarResult) => {
    // Slice 78: a pick after typing teaches "search" or "command"; a Try example teaches nothing.
    // Controls are counted where they flip; a row reaching here with one (a lorebook's Enabled
    // switch) is being opened, which is a search.
    if (query.trim() && result.id !== "ask-professor-mari" && result.action?.kind !== "refine-query")
      markTry(isOmnibarCommandPick({ action: result.action, chooseValue: result.chooseValue }) ? "command" : "search");
    if (result.action) {
      runResultAction(result, result.action);
      return;
    }
    if (result.category === "lorebook" && !result.action) {
      // Enter/tap attaches it to the open chat when it is not already active
      // there, the same unambiguous rule "add <character>" uses. Lorebook rows
      // never flip the global enabled flag; only the Lorebooks panel does.
      if (attachLorebookIfNotActive(result)) return;
      if (result.target && navigate(result.target)) {
        recordUse(result.id);
        onClose();
      }
      return;
    }
    if (result.control) return;
    if (runDirectChatAction(result)) return;
    if (runSystemAction(result)) {
      recordUse(result.id);
      onClose();
      return;
    }
    if (result.id === "suggestion:edit-focused-field") {
      openProfessorMari(result, { submitDraft: mariSends(result) });
      return;
    }
    if (result.id === "open-professor-mari") {
      openProfessorMari(null, { arrival: true });
      return;
    }
    if (result.id === "ask-professor-mari") {
      if (result.group === "continue") {
        // The continue row resumes existing work, so there is nothing to submit.
        openProfessorMari(null, {
          reviewPending: countBlockingReviews(mariWorkspaceStatus.data?.pendingApprovals ?? []) > 0,
        });
      } else if (asideSettled) {
        // The answer grew inside this row, so continuing carries it along (G3). A streaming answer is not carried.
        escalateAside();
      } else {
        // The row reads "Ask Mari: <your query>", so it sends. Enter always did;
        // click used to open with the text unsent, which no title promised.
        openProfessorMari(null, { submitDraft: true });
      }
      return;
    }
    if (result.category === "connection") {
      if (!confirmLeaveEditor()) return;
      ui().openConnectionDetail(result.id.slice("connection:".length));
      recordUse(result.id);
      onClose();
      return;
    }
    if (result.target && navigate(result.target)) {
      recordUse(result.id);
      onClose();
    }
  };
  const showResultDetail = (result: RankedOmnibarResult) => {
    setActiveResultId(result.id);
    setExpandedPreviewId(result.id);
  };
  // F5 (O5): the Fix row's connection choice has the control id
  // `connection:<id>` (that connection's own editor row, repurposed by
  // `contextResults` while a retry is offered), so it cannot join the static
  // CHAT_SCOPED_CHOICE_CONTROL_IDS set - it needs the same close+toast
  // treatment, derived from the same `lastAppError.retry` the row came from.
  const fixRowChoiceParentId =
    lastAppError?.retry?.kind === "open-connection" ? `connection:${lastAppError.retry.id}` : null;
  const isChatScopedChoiceControlId = (id: string) =>
    CHAT_SCOPED_CHOICE_CONTROL_IDS.has(id) || id === fixRowChoiceParentId;
  // F5 (O5): the inline segmented control on the row itself (the pill buttons a
  // mouse/touch user picks directly, with no expand step) called only
  // `control.onChange` - never the close+toast+recordUse below, so a direct
  // pick left search open with the next Enter pointed at an unrelated chat.
  // Shared with `chooseChoiceOption` below so a keyboard pick (via the
  // expanded option rows) gets the exact same treatment.
  const runScopedChoiceChange = (result: RankedOmnibarResult, value: string | boolean) => {
    if (!result.control) return;
    markTry("command");
    result.control.onChange(value);
    if (!isChatScopedChoiceControlId(result.id)) return;
    const optionLabel = result.control.options?.find((option) => option.value === value)?.label ?? String(value);
    toast.success(
      t("commandCenter.actions.chatControlChosen", "{{label}}: {{value}}", {
        label: result.description ?? result.command.title,
        value: optionLabel,
      }),
    );
    recordUse(result.id);
    onClose();
  };
  const chooseChoiceOption = (result: RankedOmnibarResult) => {
    if (!result.chooseValue) return false;
    markTry("command");
    result.chooseValue();
    // Keep the parent selected when the row came from an expansion, so the list
    // does not jump; a row found by typing has no parent on screen.
    const parentId = readChoiceOptionId(result.id)?.parentId;
    setExpandedChoiceId(null);
    if (parentId && isChatScopedChoiceControlId(parentId)) {
      toast.success(
        t("commandCenter.actions.chatControlChosen", "{{label}}: {{value}}", {
          label: result.description ?? result.command.title,
          value: result.title,
        }),
      );
      recordUse(result.id);
      onClose();
      return true;
    }
    if (parentId && presentation.results.some((row) => row.id === parentId)) setActiveResultId(parentId);
    return true;
  };
  // A settings-registry toggle (K5) gets an Undo toast, same pattern as the
  // chat-resource attach/remove toasts below; the hand-built control rows
  // (theme, presence, the original 9 toggles) keep their plain immediate flip.
  const flipToggleControl = (result: RankedOmnibarResult, nextValue: boolean) => {
    const control = result.control;
    if (!control || control.type !== "toggle") return;
    markTry("command");
    if (!result.id.startsWith("settings-control:")) {
      control.onChange(nextValue);
      return;
    }
    const previousValue = control.value === true;
    // Pulse and RGB are mutually exclusive (same pair as the Appearance
    // settings row), so flipping one can silently turn the other off as a
    // side effect; Undo must restore both, not just the row that was flipped.
    const isAccentPair = result.id === "settings-control:accent-pulse" || result.id === "settings-control:rgb-mode";
    const previousPulse = isAccentPair ? useUIStore.getState().appAccentPulseMode : undefined;
    const previousRgb = isAccentPair ? useUIStore.getState().appAccentRgbMode : undefined;
    control.onChange(nextValue);
    const label = t("commandCenter.actions.settingToggled", "{{label}}: {{state}}", {
      label: result.title,
      state: nextValue ? t("commandCenter.values.enabled", "Enabled") : t("commandCenter.values.disabled", "Disabled"),
    });
    const flip = {
      label,
      undo: () => {
        if (lastSettingFlip === flip) lastSettingFlip = null;
        if (isAccentPair) {
          useUIStore.getState().setAppAccentPulseMode(previousPulse!);
          useUIStore.getState().setAppAccentRgbMode(previousRgb!);
        } else {
          control.onChange(previousValue);
        }
      },
    };
    lastSettingFlip = flip;
    toast.success(label, { action: { label: t("ui.chat.chatresourcedropoverlay.undo", "Undo"), onClick: flip.undo } });
  };
  const selectResult = (result: RankedOmnibarResult) => {
    if (chooseChoiceOption(result)) return;
    // A first tap opens the preview; a tap on the open row runs Enter, which the
    // preview no longer repeats as a chip.
    if (
      !result.control &&
      !resultOpensDirectlyOnTap(result) &&
      expandedPreviewId !== result.id &&
      isRichResult(result) &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      showResultDetail(result);
      return;
    }
    autoSelectionRef.current = false;
    setActiveResultId(result.id);
    if (result.control?.type === "toggle") flipToggleControl(result, result.control.value !== true);
    else if (result.control?.type === "choice")
      setExpandedChoiceId((current) => (current === result.id ? null : result.id));
    else choose(result);
  };
  // Keyboard navigation scrolls the list under a resting cursor, and the browser
  // then fires a mousemove for the row that slid beneath it — which would drag the
  // selection back. Only a move to genuinely new screen coordinates counts as hover.
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const handleResultMouseMove = (result: RankedOmnibarResult, event: MouseEvent<HTMLLIElement>) => {
    const previous = pointerRef.current;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (previous && previous.x === event.clientX && previous.y === event.clientY) return;
    autoSelectionRef.current = false;
    setActiveResultId(result.id);
    // The preview renders for whatever is highlighted, and hover moves the
    // highlight. Without this the box under the expanded row would show the
    // hovered row's preview. Same rule the arrow keys already follow.
    if (expandedPreviewId) setExpandedPreviewId(isRichResult(result) ? result.id : null);
  };
  const setCategoryFilter = (nextFilter: CommandCenterCategoryFilter) => {
    setFilter(nextFilter);
    setActiveResultId(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  // Only reachable from the back button, which renders when the pane is not the
  // list — and `mari` is the only other pane.
  const leaveDetail = () => {
    setMariChatOpen(false);
    setPane("results");
    focusMariReturnRow();
  };
  /** M9: the arrival cards only the omnibar can run. */
  const runArrivalAction = (action: MariArrivalAction) => {
    if (action.kind === "undo-setting") {
      lastSettingFlip?.undo();
      setSettingUndoVersion((current) => current + 1);
    } else if (action.kind === "find-setting") {
      setMariChatOpen(false);
      setPane("results");
      setQuery(omnibarScopePrefix("settings"));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };
  // M18: ⌘J asks Mari about this screen; with her already open it goes back to the search. The host
  // opens the omnibar for it while it is shut; from here on this listener owns the shortcut.
  const toggleMariPane = useEffectEvent(() => {
    if (pane === "mari") leaveDetail();
    else openProfessorMari(null, { arrival: !isQuestionShaped(query) });
  });
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !isAskMariShortcut(event)) return;
      if (!useUIStore.getState().commandCenterMariEnabled) return;
      // A dialog opened above the omnibar (a confirm from Mari, say) keeps the keyboard, as with ⌘K.
      const dialog = event.target instanceof Element ? event.target.closest('[aria-modal="true"]') : null;
      if (dialog && !dialog.closest('[data-component="GlobalOmnibar"]')) return;
      event.preventDefault();
      toggleMariPane();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  // UX-02: a card action (Accept, Undo) removes the button that had focus, so focus falls to the page and
  // the dialog never hears Escape. From the page, Escape still goes back from her window.
  const escapeFromPage = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
    if (document.activeElement !== document.body || pane !== "mari") return;
    event.preventDefault();
    leaveDetail();
  });
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => escapeFromPage(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const fixRowId = mariFixRowId(lastAppError);
  /** Ranked rows and plain context rows both feed the Mari handoff. */
  type OmnibarAskFocus = Pick<OmnibarResult, "id" | "title" | "category"> | null;
  /** Quick and full Mari hand over the same context, so they read the same surroundings. */
  const buildAskContext = (
    message: string,
    focusResult: OmnibarAskFocus,
    asideAnswer?: { query: string; answer: string; tier: "local" | "remote"; sources?: ProfessorMariQuickSource[] },
    options: { fix?: boolean } = {},
  ) => {
    // The "fix this" door only opens on a deliberate pick of the Fix row (⌘↵/Enter on it, or the
    // arrival Fix card) — never implicitly, because a built-in agent's editor row and Fix row share
    // an id, so "focus id equals Fix row id" can also be true for a plain fallback focus (A5/N6).
    const fix = Boolean(options.fix);
    const source = fix ? ("chat-error" as const) : gameSetupStep ? ("game-setup" as const) : undefined;
    return buildProfessorMariCommandCenterContext(message, focusResult, [], focusResult?.id, {
      activeChat: openChat ? { id: openChat.id, label: openChat.name, mode: openChat.mode } : undefined,
      settingsLocation:
        settingsPanelVisible && (settingsTab || settingsTargetControlId)
          ? { tab: settingsTab ?? undefined, controlId: settingsTargetControlId ?? undefined }
          : undefined,
      field: gameSetupStep ?? activeEditorField?.label,
      fieldId: gameSetupStep ? undefined : activeEditorField?.id,
      // Only the deliberate "fix this" handoff actually needs lastAppError's text; every other
      // Mari call (R22) must not carry it along just because an unrelated error happens to be live.
      error: fix && lastAppError ? { message: lastAppError.message, code: lastAppError.code } : undefined,
      source,
      asideAnswer,
    });
  };
  /** Both Mari routes remember the row they left, so returning restores focus. */
  const rememberMariReturn = (focusResult: OmnibarAskFocus) => {
    const returnResultId = focusResult?.id ?? activeResultId;
    mariReturnResultIdRef.current = returnResultId;
    setSessionValue("mariReturnResultId", returnResultId);
  };
  const openProfessorMari = (
    selectedResult: OmnibarAskFocus = null,
    // R9: `reviewPending: true` opens on any pending review (the generic continue row, the
    // completion action); a string targets that one review specifically (the per-approval row).
    options: { reviewPending?: boolean | string; submitDraft?: boolean; arrival?: boolean } = {},
  ) => {
    // A scope prefix like "faq:" is omnibar search syntax, not part of the
    // message text — strip it before it lands in Mari's composer. M9: an arrival
    // brings no text, and the open chat travels as its own facet, not also as a
    // "Current chat" resource.
    const draft = options.arrival ? "" : parseOmnibarScope(query.trim()).query;
    if (draft) useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, draft);
    if (draft && options.submitDraft) markTry("mari");
    // A deliberate pick of the Fix row — not the fallback landing on the same id — is what opens
    // the chat-error door (A5/N6): `selectedResult` is only set on an actual pick.
    const fix = Boolean(selectedResult && fixRowId && selectedResult.id === fixRowId);
    const focusResult =
      selectedResult ?? mariFallbackFocus(contextResults, options.arrival ? `chat:${activeChat?.id}` : null);
    rememberMariReturn(focusResult);
    // The focused-field row is about the open editor, so Mari gets that resource beside the field.
    const askFocus =
      focusResult?.id === "suggestion:edit-focused-field"
        ? (contextResults.find((row) => row.id === omnibarContext.openResource?.resultId) ?? focusResult)
        : focusResult;
    enterMariPane(buildAskContext(draft, askFocus, undefined, { fix }), options.submitDraft);
    if (options.reviewPending) {
      setMariPendingReviewId(typeof options.reviewPending === "string" ? options.reviewPending : null);
      setMariPendingReviewRequest((current) => current + 1);
    }
    // R7: a Fix pick that sends nothing is a door too, so it lands in this screen's thread like ⌘J.
    if (options.arrival || (fix && !options.submitDraft)) setMariArrivalAppendRequest((current) => current + 1);
  };
  /**
   * One rule for every "take this to Mari" door: typed text that asks for something is sent.
   * The Ask-Mari row's title is the query itself, so it always sends; the continue row resumes
   * work that is already running, so it never does.
   */
  const mariSends = (result: OmnibarResult | null) =>
    result?.id === "ask-professor-mari" ? result.group !== "continue" : isMariInstruction(query, result?.title);
  const askMariAbout = (result: RankedOmnibarResult | null) =>
    openProfessorMari(result, { submitDraft: mariSends(result) });
  /**
   * R25: `⌘↵` with the aside answering takes its query and answer into the full agent.
   * From the follow-up line, the question typed there is what Mari is asked.
   */
  const escalateAside = async (question?: string) => {
    // A failed answer still hands its question over: "Continue with Prof. Mari" is the way forward from an error.
    // A streaming answer is not handed over: it would send only the words so far.
    if (!asideState.query || asideState.status === "streaming" || asideState.status === "thinking") return;
    // Starting a new chat resets her workspace, which would stop a run in progress; her own "+" waits too.
    if (mariWorkspaceStatus.data?.active) {
      toast.info(t("omnibar.aside.escalateBusy", "Professor Mari is still working. Continue when she finishes."));
      return;
    }
    const draft = question ?? asideState.query;
    if (draft) useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, draft);
    markTry("mari");
    const focusResult = mariFallbackFocus(contextResults);
    rememberMariReturn(focusResult);
    // The hand-off starts a new Mari chat named after the quick question, so the open chat is not mixed in.
    try {
      const chat = await api.post<{ id: string }>(
        `/chats/internal/professor-mari/restart?${new URLSearchParams({ name: asideState.query })}`,
      );
      // UX-20: her pane opens it. The app's active chat is the page behind her; a Mari id there 404'd on
      // /touch and moved the page off the chat the question came from.
      setMariOpenChatId(chat.id);
      queryClient.setQueryData(chatKeys.detail(chat.id), chat);
      await api.post("/professor-mari/workspace/reset", { clearHistory: true });
    } catch {
      toast.error(t("omnibar.aside.escalateFailed", "Professor Mari could not start a new chat. Try again."));
      return;
    }
    enterMariPane(
      buildAskContext(draft, focusResult, {
        // The aside escalation is never the deliberate Fix-row pick, so `fix` stays unset below.
        // Match the server's zod limits so an over-length aside can't 400 the whole send.
        query: asideState.query.slice(0, 500),
        answer: asideState.answer.slice(0, 4_000),
        tier: asideState.tier,
        sources: asideState.sources?.length ? [...asideState.sources] : undefined,
      }),
      true,
    );
  };
  // A handed-off task is "finished" once Mari has been seen working and then
  // stops. Advancing the persisted status rather than detecting the edge in a ref
  // means the transition still lands when it happens between two opens.
  const mariActive = mariWorkspaceStatus.data?.active ?? false;
  useEffect(() => {
    setSession((current) => {
      const mariHandoff = advanceMariHandoff(current.mariHandoff, mariActive);
      return mariHandoff === current.mariHandoff ? current : { ...current, mariHandoff };
    });
  }, [mariActive]);
  const completionActions = mariFinished ? omnibarCompletionActions(mariHandoff.context) : [];
  const runCompletionAction = (action: OmnibarCompletionAction) => {
    setSessionValue("mariHandoff", null);
    if (action.kind === "return") {
      leaveDetail();
      return;
    }
    if (action.kind === "review") {
      setMariPendingReviewRequest((current) => current + 1);
      return;
    }
    // Open the resource through the existing result path so dirty-editor and
    // navigation rules still apply. Characters can deep-link to the edited field.
    const resource = action.resource;
    if (!resource) return;
    if (resource.kind === "character") {
      if (!confirmLeaveEditor()) return;
      ui().openCharacterDetail(resource.id, {
        ...(action.kind === "open-field" ? { initialTab: action.field === "Greeting" ? "convo" : "card" } : {}),
      });
      onClose();
      return;
    }
    const result = currentResultById.get(`${resource.kind}:${resource.id}`);
    if (result) choose(result);
  };

  // Keyed by row id so the two per-row lookups below stay O(1); a linear scan
  // over every chat, twice per rendered row, showed up on large libraries.
  const chatModeByResultId = useMemo(
    () => new Map(data.chats.map((chat) => [`chat:${chat.id}` as string, chat.mode] as const)),
    [data.chats],
  );
  // Slice 79: one resolver gives every row its record's picture (or its type icon) and its highlight.
  const searchMatchQueries = useMemo(
    () => (deferredQuery.trim() ? omnibarMatchQueries(deferredQuery, data.chats) : undefined),
    [data.chats, deferredQuery],
  );
  const rowVisualContext = useMemo<OmnibarRowVisualContext>(
    () => ({
      recordById: new Map(searchableEntityResults.map((result) => [result.id, result] as const)),
      chatModeById: chatModeByResultId,
      matchQueries: searchMatchQueries,
      mariPortrait: appearance.portraits.idle,
    }),
    [appearance.portraits.idle, chatModeByResultId, searchMatchQueries, searchableEntityResults],
  );
  // Slice 79b: the quiet "Add [Eliza] to [Tavern Night]" line under the input.
  const understoodLine = useMemo(
    () =>
      resolveOmnibarUnderstoodLine(
        [...addSuggestions, ...removalSuggestions, ...intentShortcuts],
        activeChat,
        new Map(recentChatNamedRows.map((chat) => [chat.id, chat.name] as const)),
      ),
    [activeChat, addSuggestions, intentShortcuts, recentChatNamedRows, removalSuggestions],
  );
  const resultVisual = (result: RankedOmnibarResult) => {
    if (result.category === "chat") {
      const mode = chatModeByResultId.get(result.id);
      if (mode) return getCommandCenterChatModeVisual(mode as ChatMode, chatModeLabels);
    }
    return getCommandCenterCategoryVisual(result.category, categoryLabels, result.icon);
  };
  /**
   * What Enter does, in one word. Resource rows open an editor even when the row
   * shows only a name, so "Open" alone was misleading in the context group.
   */
  // What Enter does on this row (R8), from the same dispatch `choose` runs: an
  // "Add Eliza to this chat" row must not say Edit.
  const resultEnterHint = (result: RankedOmnibarResult) => {
    if (result.id === "ask-professor-mari") {
      return result.group === "continue" ? t("commandCenter.open", "Open") : t("commandCenter.enter.ask", "Ask");
    }
    if (result.chooseValue) return t("commandCenter.enter.choose", "Choose");
    switch (result.action?.kind) {
      case "add-to-chat":
        return t("commandCenter.enter.add", "Add");
      case "detach-from-chat":
        return t("commandCenter.enter.remove", "Remove");
      case "slash":
        return t("commandCenter.enter.insert", "Insert");
      case "goto-message":
        return t("commandCenter.enter.jump", "Jump to");
      case "open-docs":
      case "open-faq":
        return t("commandCenter.read", "Read");
      case "open-global-search":
        return t("commandCenter.enter.search", "Search");
      case "personal-extension":
        return t("commandCenter.enter.run", "Run");
      case "open-lorebook-entry":
        return t("commandCenter.edit", "Edit");
      case "create-named":
        return t("commandCenter.enter.create", "Create");
      case "start-character-chat":
      case "start-chat":
        return t("commandCenter.enter.start", "Start");
      case "refine-query":
        return t("commandCenter.enter.try", "Try");
    }
    if (activeChat && CHAT_RESOURCE_KIND[result.category] && isDirectActiveChatAction(query, result, searchResults)) {
      return t("commandCenter.enter.add", "Add");
    }
    return EDITOR_CATEGORIES.has(result.category)
      ? t("commandCenter.edit", "Edit")
      : result.category === "docs"
        ? t("commandCenter.read", "Read")
        : t("commandCenter.open", "Open");
  };
  // Matched against the in-flight mutation's own id: keying on `isPending` alone
  // put a spinner on every persona row while one persona was activating.
  const resultControlPending = (result: RankedOmnibarResult) => {
    const resourceId = getOmnibarResourceId(result);
    if (result.category === "preset") return setDefaultPreset.isPending && setDefaultPreset.variables === resourceId;
    return result.id.startsWith("control:chat-") && (updateChat.isPending || updateChatMetadata.isPending);
  };
  const liveMessage = loading
    ? t("commandCenter.live.loading", "Loading results")
    : failed
      ? t("commandCenter.live.partialFailure", "{{count}} results. Some sources could not be loaded.", {
          count: results.length,
        })
      : t("commandCenter.live.resultCount", "{{count}} results", { count: results.length });
  const currentResultById = useMemo(() => {
    const current = new Map(results.map((result) => [result.id, result] as const));
    for (const result of searchableEntityResults) {
      if (current.has(result.id)) continue;
      current.set(result.id, {
        ...result,
        command: {
          id: result.id,
          title: result.title,
          kind: result.kind ?? "resource",
          icon: result.icon ?? "command",
          target: result.target,
          availability: { status: "available" as const },
        },
      } as RankedOmnibarResult);
    }
    return current;
  }, [results, searchableEntityResults]);
  const resolveCurrentResult = (result: RankedOmnibarResult | null) =>
    result ? (currentResultById.get(result.id) ?? null) : null;
  // Always show the detail panel for whatever result is currently selected.
  const previewResult = resolveCurrentResult(activeResult ?? null);
  const previewDetail = usePreviewDetail(previewResult);

  // The row already runs its Enter action, so the expansion offers only the others
  // (D3): an "Edit character" chip under a row whose Enter edits is the same door twice.
  const previewEnterHint = previewResult && !previewResult.control ? resultEnterHint(previewResult) : null;
  const { detachFromChat, attachLorebookIfNotActive, runDirectChatAction, runResultAction } =
    createOmnibarResultActions({
      t,
      ui,
      activeChat,
      activeChatId,
      agents: agents.data,
      query,
      searchResults,
      inputRef,
      patchChat,
      patchChatMetadata,
      startNewChatMode,
      setQuery,
      setActiveResultId,
      setMariOpenChatId,
      confirmLeaveEditor,
      navigate,
      recordUse,
      openProfessorMari,
      onClose,
    });
  const previewActions = previewResult
    ? buildOmnibarPreviewActions(previewResult, {
        t,
        ui,
        activeChat,
        attachedResultIds,
        connections: connections.data,
        mariEnabled,
        previewEnterHint,
        updateChat,
        askMariAbout,
        detachFromChat,
        navigate,
        recordUse,
        onClose,
      })
    : [];

  // The quick answer, as the expansion of the promoted Ask row: only ever below the selection (R9).
  const renderAsideAnswer = () => (
    <Suspense fallback={null}>
      <OmnibarAside
        state={asideState}
        connectionName={asideConnectionName}
        disclosed={asideDisclosed}
        onDisclose={() => setAsideDisclosed(true)}
        onDisable={() => {
          setAsideEnabled(false);
          setAsideDisclosed(true);
        }}
        onEscalate={() => escalateAside()}
        onChooseModel={() => openSettings("quick-answer-model")}
        connectionOffer={asideConnectionOffer}
        onUseConnectionOffer={setAsideConnectionId}
        onRetry={asideState.retry}
        onAnswerAgain={asideState.answerAgain}
        // One quick follow-up; the question after it goes to full Mari (G4).
        onFollowUp={(question) => escalateAside(question)}
        links={asideLinks.map((row) => {
          const visual = resolveOmnibarRowVisual(row, rowVisualContext);
          return { id: row.id, title: row.title, src: visual.src, icon: visual.icon };
        })}
        delayMs={asideDelayMs}
        onOpenLink={(id) => {
          const row = asideLinks.find((item) => item.id === id);
          if (row) choose(row);
        }}
        showDownloadAgents={asideAgentPackageIds.length > 0}
        onOpenDownloadAgents={() => {
          openRightPanel("agents");
          openAgentCatalog(asideAgentPackageIds[0]);
          onClose();
        }}
      />
    </Suspense>
  );
  // The body of the expanded row, rendered inline under the selected row.
  const renderResultPreview = () =>
    previewResult ? (
      <Suspense fallback={null}>
        <OmnibarDetailPane
          result={previewResult}
          actions={previewActions}
          extraFacts={previewDetail.extraFacts}
          note={previewDetail.note}
          detailLoading={previewDetail.detailLoading}
          contextStatusLabel={
            previewResult.category === "character"
              ? activeChat?.characterIds?.includes(getOmnibarResourceId(previewResult))
                ? t("commandCenter.preview.inThisChat", "In this chat")
                : undefined
              : previewResult.category === "lorebook" && activeChat
                ? attachedResultIds.has(previewResult.id)
                  ? t("commandCenter.preview.activeInThisChat", "Active in this chat")
                  : t("commandCenter.preview.notInThisChat", "Not in this chat")
                : undefined
          }
        />
      </Suspense>
    ) : null;

  const { onInputKeyDown, trapFocus } = createOmnibarKeyHandlers({
    panelRef,
    listRef,
    inputRef,
    autoSelectionRef,
    pane,
    query,
    inlineSuffix,
    results,
    activeIndex,
    activeResult,
    expandedPreviewId,
    expandedChoiceId,
    mariEnabled,
    asideSettled,
    setQuery,
    setPane,
    setActiveResultId,
    setExpandedPreviewId,
    setExpandedChoiceId,
    setMariChatOpen,
    focusMariReturnRow,
    onClose,
    choose,
    chooseChoiceOption,
    flipToggleControl,
    navigate,
    recordUse,
    askMariAbout,
    escalateAside,
    openProfessorMari,
    resolveCurrentResult,
  });

  return createPortal(
    <motion.div
      ref={panelRef}
      data-component="GlobalOmnibar"
      data-over-dialog={overDialog ? "true" : undefined}
      data-pane={pane}
      data-mode={pane === "mari" ? "work" : "find"}
      className="fixed inset-0 z-(--mari-layer-omnibar) flex items-start justify-center bg-black/55 backdrop-blur-sm motion-safe:transition-[padding] motion-safe:duration-300 sm:px-6 sm:pt-[var(--omnibar-top)]"
      // An empty bar sits lower, near the middle, so the hint field below it has
      // room; it rides back up as soon as results need the space.
      style={{ "--omnibar-top": idle && !mariSurface ? "26vh" : "10vh" } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: "easeOut" }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={trapFocus}
    >
      {/* Slice 73: the height transition is the desktop dialog's. On a phone the panel is the full screen, and
          animating it let every keyboard close leave her composer up to ~200 px above the bottom for 300 ms. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-omnibar-title"
        ref={dialogRef}
        data-component="GlobalOmnibar.Panel"
        className={`relative isolate flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--card)] shadow-2xl ${fromPull ? "" : "motion-safe:animate-omnibar-in"} sm:max-w-[44rem] sm:rounded-2xl sm:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] sm:ring-1 sm:ring-[var(--border)]/60 sm:motion-safe:transition-[height,max-height,max-width] sm:motion-safe:duration-300 sm:motion-safe:ease-out motion-reduce:transition-none ${
          pane === "mari"
            ? "mari-workspace-shell sm:h-[min(44rem,80dvh)] sm:max-h-[min(44rem,80dvh)]"
            : idle && !settingsOpen
              ? "sm:h-auto sm:max-h-none"
              : "sm:h-[min(36rem,68dvh)] sm:max-h-[min(36rem,68dvh)]"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[radial-gradient(120%_100%_at_12%_0%,oklch(0.72_0.16_255/0.12),transparent_60%),radial-gradient(120%_100%_at_88%_0%,oklch(0.73_0.21_345/0.11),transparent_60%)]"
        />
        <h2 id="global-omnibar-title" className="sr-only">
          {mariSurface ? t("commandCenter.workTitle", "Professor Mari") : t("omnibar.title", "Search Marinara")}
        </h2>
        <header className="relative z-50 shrink-0 overflow-visible pt-[env(safe-area-inset-top)]">
          <div
            className={cn(
              "flex items-center",
              mariSurface
                ? "mari-workspace-header h-12 px-2"
                : "h-16 gap-3 border-b border-[var(--border)] px-3 sm:h-14 sm:px-4",
            )}
          >
            {pane !== "results" ? (
              <button
                ref={backButtonRef}
                type="button"
                onClick={leaveDetail}
                aria-label={
                  mariSurface
                    ? t("commandCenter.backToFind", "Back to search")
                    : t("commandCenter.backToResults", "Back to results")
                }
                // M18: ⌘J goes back to the search from Mari, so the button says so.
                title={
                  mariSurface
                    ? t("commandCenter.keyboard.backToSearch", "Back to search ({{mod}}+J)", {
                        mod: formatShortcutKey("Mod"),
                      })
                    : undefined
                }
                aria-keyshortcuts={mariSurface ? (isApplePlatform() ? "Meta+J" : "Control+J") : undefined}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] sm:size-9"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <Search
                size={19}
                aria-hidden="true"
                data-mari-pull-target="search"
                className="shrink-0 text-[var(--primary)]"
              />
            )}
            <AnimatePresence initial={false} mode="wait">
              {mariSurface ? (
                <motion.div
                  key="omnibar-mari-header"
                  initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                  className="flex min-w-0 flex-1 flex-col justify-center px-1"
                >
                  {/* Row 1: her name and live status, no portrait (she is in the transcript). The status text
                      comes from her chat through `mariStatusSlot`; row 2 below holds the destinations. */}
                  <span className="truncate text-sm font-semibold leading-tight text-[var(--foreground)]">
                    {t("omnibar.categories.professor", "Professor Mari")}
                  </span>
                  <span
                    ref={setMariStatusSlot}
                    className="mari-omnibar-header-status truncate text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)]"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="omnibar-search-header"
                  initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : inputTravel ? { opacity: 0, y: inputTravel } : { opacity: 0, x: 10 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: inputTravel ? 0.28 : 0.16, ease: "easeOut" }}
                  className="relative z-20 flex min-w-0 flex-1"
                >
                  <InlineGhostText
                    value={query}
                    suffix={inlineSuffix}
                    className="text-base font-medium leading-normal"
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      handedOffQueryRef.current = false;
                      setQuery(event.target.value);
                      setFilter("all");
                      setPane("results");
                    }}
                    type="search"
                    // The browser's own suggestion popup steals ArrowUp/ArrowDown
                    // from the result list, so every native assist is off here.
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label={t("omnibar.inputLabel", "Search Marinara")}
                    // Focus stays in the field while the arrows move the selection,
                    // so point screen readers at the selected row.
                    aria-controls={listVisible ? "global-omnibar-results" : undefined}
                    aria-activedescendant={listVisible && activeResult ? `omnibar-${activeResult.id}` : undefined}
                    onKeyDown={onInputKeyDown}
                    placeholder={
                      idle
                        ? // Slice 78: the greeting is cut off at 390 px ("Type to search,"), so a phone gets the short form.
                          window.matchMedia("(min-width: 640px)").matches
                          ? idleGreeting
                          : t("commandCenter.placeholderIdleShort", "Search or ask Prof. Mari")
                        : // ponytail: read once per open (the dialog remounts each time); a resize
                          // while open keeps the old text. Use a shared media hook if one lands.
                          window.matchMedia("(min-width: 640px)").matches
                          ? t("commandCenter.placeholder", "Search everything, or narrow with faq:, docs:, msg:, char:")
                          : t("commandCenter.placeholderShort", "Search everything")
                    }
                    className="min-w-0 flex-1 bg-transparent text-base font-medium text-[var(--foreground)] outline-none placeholder:font-normal placeholder:text-[var(--muted-foreground)] [&::-webkit-search-cancel-button]:hidden"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {query && !mariSurface ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setActiveResultId(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                aria-label={t("commandCenter.clearSearch", "Clear search")}
                title={t("commandCenter.clearSearch", "Clear search")}
                className="inline-flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-[color-mix(in_srgb,var(--foreground)_12%,var(--card))] text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_20%,var(--card))] hover:text-[var(--foreground)]"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            ) : null}
            {!mariSurface && mariEnabled ? (
              <OmnibarMariDoor
                onClick={() => askMariAbout(null)}
                working={mariWorkingInBackground}
                portrait={appearance.portraits.idle}
                hover={appearance.portraits.hover}
                held={appearance.portraits.drag}
              />
            ) : null}
            {/* R11: while a phone keyboard is open her destinations fold into a menu here (one-line header). */}
            {mariSurface ? <span ref={setMariMenuSlot} className="mari-omnibar-header-compact-menu" /> : null}
            {mariSurface ? <OmnibarSettingsButton open={settingsOpen} onOpen={() => openSettings()} /> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close", "Close")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] sm:size-9"
            >
              <X size={18} />
            </button>
          </div>
          {mariSurface ? (
            <div ref={setMariHeaderSlot} className="mari-omnibar-header-slot mari-omnibar-header-row" />
          ) : null}
          {!mariSurface ? (
            <OmnibarUnderstoodLine line={query.trim() ? understoodLine : null} context={rowVisualContext} />
          ) : null}
          {!query.trim() && !mariSurface ? (
            <OmnibarScopeChips
              filterLabels={filterLabels}
              setQuery={setQuery}
              setFilter={setFilter}
              inputRef={inputRef}
            />
          ) : null}
          {query.trim() && !mariSurface ? (
            <OmnibarFilterStrip
              reduceMotion={reduceMotion}
              availableFilters={availableFilters}
              filter={filter}
              filterLabels={filterLabels}
              setCategoryFilter={setCategoryFilter}
            />
          ) : null}
        </header>

        {pane === "results" ? (
          <div data-component="GlobalOmnibar.LiveResults" className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </div>
        ) : null}

        {mariMounted ? (
          <Suspense fallback={null}>
            <OmnibarMariPane
              active={pane === "mari"}
              reduceMotion={reduceMotion}
              mariContext={mariContext}
              submitDraftRequest={mariSubmitDraftRequest}
              mariOpenChatId={mariOpenChatId}
              mariPendingReviewRequest={mariPendingReviewRequest}
              mariPendingReviewId={mariPendingReviewId}
              mariChatOpen={mariChatOpen}
              onChatWindowOpenChange={(open) => {
                setMariChatOpen(open);
                if (!open) {
                  setPane("results");
                  const returnResultId = mariReturnResultIdRef.current;
                  if (returnResultId) setActiveResultId(returnResultId);
                  focusMariReturnRow();
                }
              }}
              completionActions={completionActions}
              onCompletionAction={runCompletionAction}
              omnibarHeaderSlot={mariHeaderSlot}
              omnibarStatusSlot={mariStatusSlot}
              omnibarMenuSlot={mariMenuSlot}
              arrival={mariArrival}
              arrivalAppendRequest={mariArrivalAppendRequest}
              arrivalThread={mariThreadContext}
              onArrivalAction={runArrivalAction}
              // N6: what an arrival Fix card sends with: the same handoff as a deliberate pick of the Fix row.
              arrivalFixContext={buildAskContext(
                "",
                contextResults.find((row) => row.id === fixRowId) ?? null,
                undefined,
                { fix: true },
              )}
            />
          </Suspense>
        ) : null}
        {pane !== "mari" && idle ? <OmnibarEmpty /> : null}
        {!listVisible ? null : (
          <OmnibarResultList
            listRef={listRef}
            query={query}
            loading={loading}
            failed={failed}
            results={results}
            presentation={presentation}
            groupLabels={groupLabels}
            rowVisualContext={rowVisualContext}
            activeResult={activeResult}
            activeResultId={activeResultId}
            expandedPreviewId={expandedPreviewId}
            asideShown={asideShown}
            mariEnabled={mariEnabled}
            resultVisual={resultVisual}
            selectResult={selectResult}
            handleResultMouseMove={handleResultMouseMove}
            renderResultPreview={renderResultPreview}
            renderAsideAnswer={renderAsideAnswer}
            resultEnterHint={resultEnterHint}
            runScopedChoiceChange={runScopedChoiceChange}
            resultControlPending={resultControlPending}
            flipToggleControl={flipToggleControl}
          />
        )}

        {!mariSurface ? (
          <OmnibarFooter
            inlineSuffix={inlineSuffix}
            mariEnabled={mariEnabled}
            pane={pane}
            activeResult={activeResult}
            mariSends={mariSends}
            asideSettled={asideSettled}
            expandedPreviewId={expandedPreviewId}
            idle={idle}
            settingsOpen={settingsOpen}
            openSettings={openSettings}
          />
        ) : null}
        {settingsTarget ? (
          <OmnibarSettingsSheet
            focusControlId={settingsTarget.controlId}
            onClose={closeSettings}
            connections={languageConnections}
            marisConnectionName={asideConnectionOffer?.name ?? null}
            onClearSearchHistory={() => {
              clearOmnibarFrecencyHistory();
              setFrecencyEntries([]);
              // F7 (O5): the older ranking store (recency/frequency boost + the
              // "Recent" group) is separate from the frecency store above - both
              // record the same uses, so "forgets it all" must clear both.
              const clearedRanking = { ...ranking, recent: [] };
              setRanking(clearedRanking);
              writeCommandRankingState(clearedRanking);
            }}
            onSetUpLocalModel={
              import.meta.env.VITE_MARINARA_LITE === "true"
                ? undefined
                : () => {
                    onClose();
                    useSidecarStore.getState().setShowDownloadModal(true);
                  }
            }
          />
        ) : null}
      </div>

      <AnimatePresence>
        {fieldFlight ? (
          <motion.div
            key="omnibar-field-flight"
            aria-hidden="true"
            className="pointer-events-none fixed z-[110] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg"
            initial={{ ...fieldFlight.from, opacity: 0.9 }}
            animate={{ ...fieldFlight.to, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.75 }}
            onAnimationComplete={() => setFieldFlight(null)}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
