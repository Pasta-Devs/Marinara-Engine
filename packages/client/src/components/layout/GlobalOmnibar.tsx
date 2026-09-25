import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { Character, ChatMode, ProfessorMariAskContext } from "@marinara-engine/shared";
import {
  ArrowRight,
  ChevronLeft,
  Clock3,
  Compass,
  Edit3,
  FolderOpen,
  Gamepad2,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Theater,
  UserMinus,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useCharacter, useCharacters, usePersonas } from "../../hooks/use-characters";
import {
  useChats,
  useChatMessageCount,
  useChatMessagePeek,
  useChatMessageSearchSource,
  useGlobalMessageSearch,
  useProfessorMariChats,
  useUpdateChat,
  useUpdateChatMetadata,
} from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { dispatchCardAssetInsert } from "../../lib/card-asset-links";
import { HOME_FAQ_ITEMS, getFaqSearchText } from "../chat/HomeFaq";
import { useDocsCommandSearchProvider } from "../../hooks/use-docs-command-search";
import { useCreateLorebook, useLorebooks, useLorebookEntries, useUpdateLorebook } from "../../hooks/use-lorebooks";
import { usePresets, useSetDefaultPreset } from "../../hooks/use-presets";
import { useProfessorMariWorkspaceStatus } from "../../hooks/use-professor-mari-workspace-status";
import { useOmnibarAside } from "../../hooks/use-omnibar-aside";
import { expandChoiceRows, readChoiceOptionId } from "../../lib/omnibar-choice-rows";
import { useMariApprovals } from "../../hooks/use-mari-approvals";
import { getCharacterDisplayIdentity } from "../../lib/character-display";
import { completeInline } from "../../lib/inline-completion";
import { parseChatMetadata } from "../../lib/chat-display";
import { isLanguageGenerationConnection } from "../../lib/connection-filters";
import { resolveChatResourceDropAction } from "../../lib/chat-resource-drop-capabilities";
import { chatResourceBlockedKey } from "../chat/ChatResourceDropOverlay";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../lib/chat-lorebooks";
import { getChatCharacterIds } from "../../lib/chat-macros";
import {
  requestChatResourceAssignment,
  type ChatResourceDragKind,
  type ChatResourceDragPayload,
} from "../../lib/chat-resource-drag";
import {
  COMMAND_CENTER_CATEGORY_FILTERS,
  presentCommandCenterResults,
  rankCommandResults,
  readCommandCenterSessionState,
  readCommandRankingState,
  advanceMariHandoff,
  recordCommandUse,
  setCommandPinned,
  writeCommandRankingState,
  writeCommandCenterSessionState,
  type CommandCenterCategoryFilter,
  type CommandCenterSessionState,
  type CommandCenterResultGroupId,
  type CommandRankingState,
} from "../../lib/command-center";
import { createSystemCommandDefinitions } from "../../lib/command-center-system-commands";
import { getCommandIcon } from "../../lib/command-icons";
import {
  createOmnibarContext,
  filterOmnibarFuzzyFallback,
  getOmnibarActiveChatContextResultIds,
  isDirectActiveChatAction,
  parseOmnibarIntent,
  type OmnibarAction,
  type OmnibarCategory,
  type OmnibarResult,
} from "../../lib/omnibar-search";
import {
  MIN_MESSAGE_SEARCH_LENGTH,
  buildOmnibarChatControlResults,
  buildOmnibarContextResults,
  buildOmnibarApprovalResults,
  buildOmnibarContinueResult,
  buildOmnibarControlResults,
  buildOmnibarExtractionResult,
  buildOmnibarGlobalMessageResults,
  buildOmnibarMariChatResults,
  buildOmnibarMessageResults,
  buildOmnibarAddSuggestions,
  buildOmnibarVerbSuggestions,
  CHAT_CONTEXT_MAX_RESULTS,
  buildOmnibarRemovalSuggestions,
  buildOmnibarSearchResults,
  buildOmnibarSlashResults,
} from "../../lib/omnibar-results";
import { matchesOmnibarScope, omnibarScopePrefix, parseOmnibarScope } from "../../lib/omnibar-scope";
import {
  buildOmnibarAgentRows,
  buildOmnibarCharacterRows,
  buildOmnibarChatRows,
  buildOmnibarConnectionRows,
  buildOmnibarLorebookRows,
  buildOmnibarPersonaRows,
  buildOmnibarPresetRows,
} from "../../lib/omnibar-entity-rows";
import { reconcileActiveResultId, resolveOmnibarRowState } from "../../lib/omnibar-row-state";
import {
  activatePersonalExtensionCommand,
  usePersonalExtensionCommands,
} from "../../lib/personal-extension-contributions";
import { omnibarCompletionActions, type OmnibarCompletionAction } from "../../lib/omnibar-completion-actions";
import { parseChatExtraction } from "../../lib/omnibar-chat-extraction";
import { buildProfessorMariCommandCenterContext } from "../../lib/professor-mari-command-center-context";
import {
  consumeProfessorMariOpenRequest,
  PROFESSOR_MARI_OPEN_EVENT,
  type ProfessorMariOpenDetail,
} from "../../lib/professor-mari-open";
import type { ProfessorMariNavigationTarget } from "../../lib/professor-mari-navigation";
import { executeStateNavigation } from "../../lib/state-navigation";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useChatStore } from "../../stores/chat.store";
import { isMessageHiddenFromUser } from "../../lib/chat-message-visibility";
import { normalizeTextForMatch } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { CommandCenterActionValue } from "../command-center/CommandCenterActionValue";
import { InlineGhostText } from "../ui/InlineGhostText";
import { CommandCenterResultRow } from "../command-center/CommandCenterResultRow";
import { CommandCenterSegmentedChoice } from "../command-center/CommandCenterSegmentedChoice";
import { CommandCenterToggle } from "../command-center/CommandCenterToggle";
import type { ProfessorMariVisualState } from "../../lib/professor-mari-visual-state";
import {
  getCommandCenterCategoryVisual,
  getCommandCenterChatModeVisual,
  type CommandCenterCategoryLabels,
  type CommandCenterChatModeLabels,
} from "../command-center/command-center-visuals";
import type { CommandCenterPreviewFact } from "../command-center/command-result-preview.types";
import { OmnibarSettingsMenu } from "./omnibar/OmnibarSettingsMenu";
import {
  getOmnibarResourceId,
  isRichResult,
  FILTER_CATEGORY,
  OMNIBAR_SCOPE_CHIP_FILTERS,
  readNamedRow,
  resultMetadata,
  type OmnibarPane,
  type RankedOmnibarResult,
} from "./omnibar/omnibar-result-view";
// Each pane only renders once the user opens it, so they stay out of the
// initial AppShell chunk.
const OmnibarDetailPane = lazy(() =>
  import("./omnibar/OmnibarDetailPane").then((m) => ({ default: m.OmnibarDetailPane })),
);
const OmnibarMariPane = lazy(() => import("./omnibar/OmnibarMariPane").then((m) => ({ default: m.OmnibarMariPane })));
const OmnibarAside = lazy(() => import("./omnibar/OmnibarAside").then((m) => ({ default: m.OmnibarAside })));

const PROFESSOR_MARI_DRAFT_KEY = "__home_professor_mari__";
const PROFESSOR_MARI_PEEK_URL = "/sprites/mari/generated/professor-mari-assistant-idle.png";

/** Categories whose result rows open an editor rather than the thing itself. */
const EDITOR_CATEGORIES = new Set<OmnibarCategory>([
  "character",
  "persona",
  "lorebook",
  "preset",
  "connection",
  "agent",
]);

/**
 * Categories that can be attached to (or detached from) the open chat, mapped to
 * the drag payload kind that carries them. One table: every attach path — a row,
 * a preview action, a drop — has to agree on what is attachable.
 */
const CHAT_RESOURCE_KIND: Partial<Record<OmnibarCategory, ChatResourceDragKind>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
};

// Leading resource-kind words to strip from a "create <kind> <name>" query so the
// create modal opens with just the typed name pre-filled.
const CREATE_MODAL_KIND_WORDS: Record<string, readonly string[]> = {
  "create-character": ["character", "card"],
  "create-persona": ["persona", "profile"],
  "create-lorebook": ["lorebook", "world book", "world info", "worldbook"],
  "create-preset": ["preset", "prompt preset"],
};

function createModalPrefillName(modal: string, query: string): string | undefined {
  const words = CREATE_MODAL_KIND_WORDS[modal];
  if (!words) return undefined;
  const intent = parseOmnibarIntent(query);
  if (intent?.kind !== "create") return undefined;
  let name = intent.targetQuery.trim();
  for (const word of words) {
    const stripped = name.replace(new RegExp(`^${word}\\b\\s*`, "i"), "").trim();
    if (stripped !== name) {
      name = stripped;
      break;
    }
  }
  return name || undefined;
}

/**
 * Tier-2 preview data: fetched lazily only for the one focused result, gated by
 * a short focus dwell so arrow-key scrubbing does not fire a request per row.
 * React Query caches by id, so re-focusing a result is instant.
 */
function usePreviewDetail(previewResult: RankedOmnibarResult | null): {
  extraFacts: CommandCenterPreviewFact[];
  detail: ReactNode;
  detailLoading: boolean;
} {
  const { t } = useTranslation();
  const category = previewResult?.category;
  const resourceId = previewResult ? previewResult.id.slice(previewResult.id.indexOf(":") + 1) : "";

  const [settledId, setSettledId] = useState<string | null>(null);
  useEffect(() => {
    if (!previewResult) {
      setSettledId(null);
      return;
    }
    const id = previewResult.id;
    const timer = window.setTimeout(() => setSettledId(id), 160);
    return () => window.clearTimeout(timer);
  }, [previewResult]);
  const settled = !!previewResult && settledId === previewResult.id;

  const chatId = category === "chat" && settled ? resourceId : null;
  const lorebookId = category === "lorebook" && settled ? resourceId : null;
  // Characters are the most-used kind and had no lazy detail at all.
  const characterId = category === "character" && settled ? resourceId : null;

  const peek = useChatMessagePeek(chatId, 3, !!chatId);
  const messageCount = useChatMessageCount(chatId);
  const entries = useLorebookEntries(lorebookId);
  const character = useCharacter(characterId);

  if (chatId) {
    const messages = peek.data ?? [];
    const extraFacts: CommandCenterPreviewFact[] =
      typeof messageCount.data?.count === "number"
        ? [{ label: t("commandCenter.preview.messages", "Messages"), value: messageCount.data.count }]
        : [];
    const detail = messages.length ? (
      <div className="space-y-1.5">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-lg bg-[color-mix(in_srgb,var(--foreground)_4%,var(--card))] px-2.5 py-1.5 ring-1 ring-inset ring-[var(--border)]/50"
          >
            <div className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {message.role === "user"
                ? t("commandCenter.preview.you", "You")
                : t("commandCenter.preview.reply", "Reply")}
            </div>
            <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-[var(--foreground)]">
              {message.content}
            </p>
          </div>
        ))}
      </div>
    ) : null;
    return { extraFacts, detail, detailLoading: peek.isLoading };
  }

  if (characterId) {
    const data = (character.data as Character | undefined)?.data;
    const greeting = data?.first_mes?.trim();
    const extraFacts: CommandCenterPreviewFact[] = [
      ...(data?.alternate_greetings?.length
        ? [
            {
              label: t("commandCenter.preview.greetings", "Greetings"),
              value: data.alternate_greetings.length + 1,
            },
          ]
        : []),
    ];
    // The greeting is what the character actually opens with, so it says more
    // about them than the description does.
    const detail = greeting ? (
      <div className="rounded-lg bg-[color-mix(in_srgb,var(--foreground)_4%,var(--card))] px-2.5 py-1.5 ring-1 ring-inset ring-[var(--border)]/50">
        <div className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
          {t("commandCenter.preview.openingMessage", "Opening message")}
        </div>
        <p className="mt-0.5 line-clamp-4 break-words text-xs leading-5 text-[var(--foreground)]">{greeting}</p>
      </div>
    ) : null;
    return { extraFacts, detail, detailLoading: character.isLoading };
  }

  if (lorebookId) {
    const list = entries.data ?? [];
    // A short table of contents says more about a lorebook than its generation
    // limits. Keep it visually part of the preview instead of nesting cards.
    const detail = entries.isLoading ? null : list.length ? (
      <div>
        <p className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
          {t("commandCenter.preview.insideLorebook", "Inside this lorebook")}
        </p>
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {list.slice(0, 3).map((entry, index) => {
            const keys = (entry.keys ?? []).filter(Boolean).slice(0, 3);
            return (
              <div key={entry.id ?? `${entry.name ?? "entry"}-${index}`} className="py-2 first:pt-1.5 last:pb-1.5">
                <div className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {entry.name?.trim() || t("commandCenter.preview.untitledEntry", "Untitled entry")}
                </div>
                {keys.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {keys.map((key, keyIndex) => (
                      <span
                        key={`${key}-${keyIndex}`}
                        className="rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] px-1.5 py-0.5 text-[0.625rem] font-medium leading-4 text-[color-mix(in_srgb,var(--primary)_70%,var(--foreground))] ring-1 ring-inset ring-[color-mix(in_srgb,var(--primary)_28%,transparent)]"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                ) : null}
                {entry.content ? (
                  <p className="mt-1 line-clamp-1 break-words text-xs leading-5 text-[var(--muted-foreground)]">
                    {entry.content}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {list.length > 3 ? (
          <p className="px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("commandCenter.preview.moreEntries", "+{{count}} more", { count: list.length - 3 })}
          </p>
        ) : null}
      </div>
    ) : (
      <p className="text-xs text-[var(--muted-foreground)]">
        {t("commandCenter.preview.noLorebookEntries", "No entries yet")}
      </p>
    );
    return { extraFacts: [], detail, detailLoading: entries.isLoading };
  }

  return { extraFacts: [], detail: null, detailLoading: false };
}

export function GlobalOmnibarDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const ui = useUIStore.getState;
  const inputRef = useRef<HTMLInputElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (session.mariHandoff?.draft) {
      useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, session.mariHandoff.draft);
    }
  }, [session.mariHandoff?.draft]);
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
  const [mariVisualState, setMariVisualState] = useState<ProfessorMariVisualState>("idle");
  const [mariHasConversation, setMariHasConversation] = useState(false);
  const [mariStatusLabel, setMariStatusLabel] = useState("");
  const [mariHeaderSlot, setMariHeaderSlot] = useState<HTMLDivElement | null>(null);
  const handleMariVisualStateChange = useCallback(
    (state: ProfessorMariVisualState, hasConversation: boolean, statusLabel: string) => {
      setMariVisualState(state);
      setMariHasConversation(hasConversation);
      setMariStatusLabel(statusLabel);
    },
    [],
  );
  const mariReturnResultIdRef = useRef<string | null>(mariReturnResultId);
  const [ranking, setRanking] = useState<CommandRankingState>(() => readCommandRankingState());
  const chats = useChats();
  const characters = useCharacters();
  const personas = usePersonas();
  const lorebooks = useLorebooks(undefined, { includeHidden: true });
  const presets = usePresets();
  const connections = useConnections();
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
        return [{ id: row.id, name: row.name, model: typeof record.model === "string" ? record.model : "" }];
      }),
    [connections.data],
  );
  const agents = useAgentConfigs();
  const updateLorebook = useUpdateLorebook();
  const setDefaultPreset = useSetDefaultPreset();
  const updateChat = useUpdateChat();
  const updateChatMetadata = useUpdateChatMetadata();
  const createLorebook = useCreateLorebook();
  const extensionCommands = usePersonalExtensionCommands();
  const docs = useDocsCommandSearchProvider(query, { enabled: true });
  const theme = useUIStore((state) => state.theme);
  const reduceMotion = useReducedMotion();
  const reduceAmbientEffects = useUIStore((state) => state.reduceAmbientEffects);
  const musicPlayerEnabled = useUIStore((state) => state.musicPlayerEnabled);
  const omnibarSuggestionsEnabled = useUIStore((state) => state.omnibarSuggestionsEnabled);
  const mariWorkspaceStatus = useProfessorMariWorkspaceStatus();
  const asideDisclosed = useUIStore((state) => state.omnibarAsideDisclosed);
  const asideConnectionId = useUIStore((state) => state.omnibarAsideConnectionId);
  const setAsideDisclosed = useUIStore((state) => state.setOmnibarAsideDisclosed);
  const setAsideEnabled = useUIStore((state) => state.setOmnibarAsideEnabled);
  const speechToTextEnabled = useUIStore((state) => state.speechToTextEnabled);
  const notificationSoundsOnlyWhenUnfocused = useUIStore((state) => state.notificationSoundsOnlyWhenUnfocused);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const showModelName = useUIStore((state) => state.showModelName);
  const showTokenUsage = useUIStore((state) => state.showTokenUsage);
  const userStatus = useUIStore((state) => state.userStatus);
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
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen);
  const rightPanel = useUIStore((state) => state.rightPanel);
  const botBrowserOpen = useUIStore((state) => state.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((state) => state.gameAssetsBrowserOpen);
  const characterLibraryOpen = useUIStore((state) => state.characterLibraryOpen);
  const cardLibraryKind = useUIStore((state) => state.cardLibraryKind);
  const agentCatalogOpen = useUIStore((state) => state.agentCatalogOpen);
  const editorDirty = useUIStore((state) => state.editorDirty);

  const idleGreeting = useMemo(() => {
    if (!activeChat) return t("omnibar.hello", "Hi, I'm Mari. Type to search, or ask me for anything...");

    const greetings =
      activeChat.mode === "roleplay"
        ? [
            t("omnibar.greetings.roleplay.one", "A roleplay chat. What should we look into?"),
            t("omnibar.greetings.roleplay.two", "Oh, a scene in progress. Need a hand?"),
            t("omnibar.greetings.roleplay.three", "This story is open. What would you like to find?"),
          ]
        : activeChat.mode === "conversation"
          ? [
              t("omnibar.greetings.conversation.one", "A conversation. What should we look into?"),
              t("omnibar.greetings.conversation.two", "I found your chat. What do you need?"),
              t("omnibar.greetings.conversation.three", "This chat is open. What would you like to find?"),
            ]
          : [
              t("omnibar.greetings.chat.one", "Oh, a chat. What should we look into?"),
              t("omnibar.greetings.chat.two", "Your chat is open. What do you need?"),
              t("omnibar.greetings.chat.three", "A chat is open. What would you like to find?"),
            ];

    const seed = activeChatId ? [...activeChatId].reduce((sum, character) => sum + character.charCodeAt(0), 0) : 0;
    return greetings[seed % greetings.length];
  }, [activeChat, activeChatId, t]);

  const categoryLabels = useMemo<CommandCenterCategoryLabels>(
    () => ({
      navigation: t("omnibar.categories.navigation", "Navigation"),
      chat: t("omnibar.categories.chat", "Chats"),
      character: t("omnibar.categories.character", "Characters"),
      persona: t("omnibar.categories.persona", "Personas"),
      lorebook: t("omnibar.categories.lorebook", "Lorebooks"),
      preset: t("omnibar.categories.preset", "Presets"),
      connection: t("omnibar.categories.connection", "Connections"),
      agent: t("omnibar.categories.agent", "Agents"),
      settings: t("omnibar.categories.settings", "Settings"),
      professor: t("omnibar.categories.professor", "Professor Mari"),
      docs: t("omnibar.categories.docs", "Docs"),
    }),
    [t],
  );
  const chatModeLabels = useMemo<CommandCenterChatModeLabels>(
    () => ({
      conversation: t("home.recentChats.mode.conversation", "Conversation"),
      roleplay: t("home.recentChats.mode.roleplay", "Roleplay"),
      game: t("home.recentChats.mode.game", "Game"),
    }),
    [t],
  );
  const filterLabels = useMemo<Record<CommandCenterCategoryFilter, string>>(
    () => ({
      all: t("commandCenter.filters.all", "All"),
      chats: t("commandCenter.filters.chats", "Chats"),
      characters: t("commandCenter.filters.characters", "Characters"),
      personas: t("commandCenter.filters.personas", "Personas"),
      lorebooks: t("commandCenter.filters.lorebooks", "Lorebooks"),
      presets: t("commandCenter.filters.presets", "Presets"),
      connections: t("commandCenter.filters.connections", "Connections"),
      agents: t("commandCenter.filters.agents", "Agents"),
      settings: t("commandCenter.filters.settings", "Settings"),
      docs: t("commandCenter.filters.docs", "Docs"),
    }),
    [t],
  );
  const groupLabels = useMemo<Record<CommandCenterResultGroupId, string>>(
    () => ({
      context: t("commandCenter.groups.context", "On this screen"),
      "current-work": t("commandCenter.groups.currentWork", "Current work"),
      continue: t("commandCenter.groups.continue", "Continue"),
      pinned: t("commandCenter.groups.pinned", "Pinned"),
      recent: t("commandCenter.groups.recent", "Recent"),
      "quick-controls": t("commandCenter.groups.quickControls", "Quick controls"),
      "create-navigation": t("commandCenter.groups.suggested", "Suggested"),
      navigation: t("commandCenter.groups.navigation", "Navigation"),
      messages: t("commandCenter.groups.messages", "Messages"),
      chats: filterLabels.chats,
      characters: filterLabels.characters,
      personas: filterLabels.personas,
      lorebooks: filterLabels.lorebooks,
      presets: filterLabels.presets,
      connections: filterLabels.connections,
      agents: filterLabels.agents,
      settings: filterLabels.settings,
      docs: filterLabels.docs,
      "professor-suggested": t("commandCenter.groups.mariSuggested", "Professor Mari"),
      "professor-fallback": t("commandCenter.groups.askMari", "Ask Professor Mari"),
    }),
    [filterLabels, t],
  );

  const characterById = useMemo(
    () =>
      new Map(
        (characters.data ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          return row ? [[row.id, item] as const] : [];
        }),
      ),
    [characters.data],
  );
  const characterNameById = useMemo(
    () =>
      new Map(
        (characters.data ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          if (!row) return [];
          const record = item as Record<string, unknown>;
          return [
            [
              row.id,
              getCharacterDisplayIdentity({ data: record.data, comment: record.comment as string | null | undefined }),
            ] as const,
          ];
        }),
      ),
    [characters.data],
  );
  const personaById = useMemo(() => new Map((personas.data ?? []).map((item) => [item.id, item])), [personas.data]);
  const connectionById = useMemo(
    () =>
      new Map(
        (connections.data ?? []).flatMap((item) => {
          const row = readNamedRow(item);
          return row ? [[row.id, row] as const] : [];
        }),
      ),
    [connections.data],
  );

  // Reverse index: which lorebooks are attached to a given character / persona.
  // Lets resource previews surface their real relationships, not just their own row.
  const lorebookLinks = useMemo(() => {
    const byCharacter = new Map<string, string[]>();
    const byPersona = new Map<string, string[]>();
    for (const book of lorebooks.data ?? []) {
      for (const cid of book.characterIds ?? []) {
        byCharacter.set(cid, [...(byCharacter.get(cid) ?? []), book.name]);
      }
      for (const pid of book.personaIds ?? []) {
        byPersona.set(pid, [...(byPersona.get(pid) ?? []), book.name]);
      }
    }
    return { byCharacter, byPersona };
  }, [lorebooks.data]);

  const data = useMemo(() => {
    const commands = [
      {
        id: "home",
        title: t("home.title", "Home"),
        kind: "navigation" as const,
        icon: "home" as const,
        target: { kind: "home" } as const,
        aliases: ["start"],
      },
      {
        id: "chats",
        title: t("ui.layout.chats", "Chats"),
        kind: "navigation" as const,
        icon: "chats" as const,
        target: { kind: "chats" } as const,
      },
      ...createSystemCommandDefinitions((key, fallback) => t(`commandCenter.system.${key}`, fallback)).map(
        (command) => ({
          id: command.id,
          title: command.title,
          kind: command.kind,
          icon: command.icon,
          aliases: command.aliases,
          target: command.target,
          availability: command.availability,
        }),
      ),
      ...extensionCommands.map((command) => ({
        ...command,
        action: { kind: "personal-extension", commandId: command.id } as const,
        target: { kind: "home" } as const,
      })),
    ];
    const chatRows = buildOmnibarChatRows({
      chats: chats.data ?? [],
      characterById,
      connectionById,
      personaById,
      chatModeLabels,
      t,
    });
    const resources = [
      ...buildOmnibarCharacterRows({
        characters: characters.data ?? [],
        lorebookNamesByCharacter: lorebookLinks.byCharacter,
        categoryLabels,
        t,
      }),
      ...buildOmnibarPersonaRows({
        personas: personas.data ?? [],
        lorebookNamesByPersona: lorebookLinks.byPersona,
        categoryLabels,
        t,
      }),
      ...buildOmnibarLorebookRows({
        lorebooks: lorebooks.data ?? [],
        characterNameById,
        personaById,
        categoryLabels,
        t,
        onSetLorebookEnabled: (id, enabled) => updateLorebook.mutate({ id, enabled }),
      }),
      ...buildOmnibarPresetRows({
        presets: presets.data ?? [],
        categoryLabels,
        t,
        onSetDefaultPreset: (id) => setDefaultPreset.mutate(id),
      }),
      ...buildOmnibarAgentRows({ agents: agents.data ?? [], connectionById, categoryLabels, t }),
    ];
    const connectionRows = buildOmnibarConnectionRows({ connections: connections.data ?? [], categoryLabels, t });
    return {
      commands,
      chats: chatRows,
      resources,
      connections: connectionRows,
      askProfessorTitle: t("omnibar.askProfessorMari"),
    };
  }, [
    agents.data,
    categoryLabels,
    characterById,
    characterNameById,
    characters.data,
    chatModeLabels,
    chats.data,
    connections.data,
    connectionById,
    extensionCommands,
    lorebooks.data,
    lorebookLinks,
    personaById,
    personas.data,
    presets.data,
    setDefaultPreset,
    t,
    updateLorebook,
  ]);

  const controls = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarControlResults({
        localize,
        mariEnabled,
        musicPlayerEnabled,
        notificationSoundsOnlyWhenUnfocused,
        omnibarSuggestionsEnabled,
        reduceAmbientEffects,
        setters: useUIStore.getState(),
        showModelName,
        showTimestamps,
        showTokenUsage,
        speechToTextEnabled,
        t,
        theme,
        userStatus,
      }),
    [
      localize,
      mariEnabled,
      omnibarSuggestionsEnabled,
      musicPlayerEnabled,
      notificationSoundsOnlyWhenUnfocused,
      reduceAmbientEffects,
      showModelName,
      showTimestamps,
      showTokenUsage,
      speechToTextEnabled,
      t,
      theme,
      userStatus,
    ],
  );

  // Chat state as inline controls: the changes a user makes most often are to
  // the chat they are already in — model, preset, persona, agents. These edit
  // the chat in the row, so nothing navigates away from the scene.
  // useMutation returns a fresh object every render, so the memo depends on the
  // stable mutateAsync functions. Depending on the mutation objects would give
  // this list a new identity each render and churn every list derived from it.
  const patchChat = updateChat.mutateAsync;
  const patchChatMetadata = updateChatMetadata.mutateAsync;
  const chatControls = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarChatControlResults({
        activeChat,
        activeChatId,
        connections: data.connections,
        patchChat,
        patchChatMetadata,
        resources: data.resources,
        t,
      }),
    [activeChat, activeChatId, data.connections, data.resources, patchChat, patchChatMetadata, t],
  );

  const searchableEntityResults = useMemo<OmnibarResult[]>(
    () => [
      ...data.chats.map((item) => ({
        id: `chat:${item.id}`,
        title: item.name,
        category: "chat" as const,
        target: { kind: "chat", chatId: item.id } as const,
        score: 1,
        preview: item.preview,
        kind: "chat" as const,
        icon: "chats" as const,
      })),
      ...data.resources.map((item) => ({
        ...item,
        id: `${item.kind}:${item.id}`,
        title: item.name,
        category: item.kind,
        target: { kind: "resource", resource: item.kind, id: item.id } as const,
        score: 1,
        description: item.description,
        preview: item.preview,
        kind: "resource" as const,
        icon: item.kind,
        control: "control" in item ? item.control : undefined,
      })),
      ...data.connections.map((item) => ({
        id: `connection:${item.id}`,
        title: item.name,
        category: "connection" as const,
        target: { kind: "panel", panel: "connections" } as const,
        score: 1,
        preview: item.preview,
        kind: "settings" as const,
        icon: "connection" as const,
      })),
    ],
    [data.chats, data.connections, data.resources],
  );
  const searchableCommandResults = useMemo<OmnibarResult[]>(
    () =>
      data.commands.map((command) => ({
        ...command,
        category: command.kind === "settings" ? ("settings" as const) : ("navigation" as const),
        score: 160,
      })),
    [data.commands],
  );
  const allLocalResults = useMemo(
    () => [...controls, ...chatControls, ...searchableCommandResults, ...searchableEntityResults],
    [chatControls, controls, searchableCommandResults, searchableEntityResults],
  );
  const omnibarContext = useMemo(() => {
    const chatMetadata = activeChat ? parseChatMetadata(activeChat.metadata) : null;
    const activeLorebookIds = activeChat
      ? deriveActiveLorebookViews({
          activeLorebookIds: getChatActiveLorebookIds(activeChat),
          excludedLorebookIds: getChatExcludedLorebookIds(activeChat),
          dropExcluded: true,
          chat: activeChat,
          lorebooks: lorebooks.data ?? [],
        }).map((lorebook) => lorebook.id)
      : [];
    const activeAgentIds = Array.isArray(chatMetadata?.activeAgentIds)
      ? chatMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
      : [];
    const activeAgentResultIds = activeAgentIds.map(
      (id) => agents.data?.find((agent) => agent.id === id || agent.type === id)?.type ?? id,
    );
    const activeChatResultIds = [
      ...getOmnibarActiveChatContextResultIds(
        activeChatId,
        activeChat
          ? {
              ...activeChat,
              characterIds: getChatCharacterIds(activeChat),
              lorebookIds: activeLorebookIds,
              enableAgents: chatMetadata?.enableAgents === true,
              activeAgentIds: activeAgentResultIds,
            }
          : null,
      ),
    ];
    const openResource = (
      [
        ["character", openCharacterId],
        ["persona", openPersonaId],
        ["lorebook", openLorebookId],
        ["preset", openPresetId],
        ["connection", openConnectionId],
        ["agent", openAgentId],
      ] as const
    ).find(([, id]) => id);
    const settingsResultId = settingsPanelVisible
      ? settingsTargetControlId
        ? `settings-control:${settingsTargetControlId}`
        : settingsTab
          ? `settings-section:${settingsTab}`
          : "settings"
      : null;
    const surfaceResultIds = rightPanelOpen
      ? [rightPanel === "connections" ? "integrations" : rightPanel === "settings" ? "settings" : rightPanel]
      : botBrowserOpen
        ? ["card-browser"]
        : gameAssetsBrowserOpen
          ? ["game-assets"]
          : characterLibraryOpen
            ? [cardLibraryKind === "personas" ? "persona-library" : "character-library"]
            : agentCatalogOpen
              ? ["agent-library", "packages"]
              : activeChatId
                ? ["chats", `chat:${activeChatId}`]
                : ["home"];
    const setupResultIds = data.commands
      .filter(
        (command) =>
          "availability" in command &&
          command.availability?.status === "requires-capability" &&
          command.availability.setupTarget,
      )
      .map((command) => command.id);
    const failedSources = [chats, characters, personas, lorebooks, presets, connections, agents, docs].some(
      (source) => source.isError,
    );
    const surface = openResource
      ? "editor"
      : settingsPanelVisible
        ? "settings"
        : gameAssetsBrowserOpen
          ? "game"
          : botBrowserOpen || characterLibraryOpen || agentCatalogOpen
            ? "library"
            : activeChatId
              ? "chat"
              : "home";
    return createOmnibarContext({
      surface,
      surfaceResultIds,
      activeChat:
        activeChat && activeChat.id === activeChatId
          ? { id: activeChat.id, mode: activeChat.mode, resultIds: activeChatResultIds }
          : undefined,
      openResource:
        openResource && openResource[1]
          ? { kind: openResource[0], id: openResource[1], resultId: `${openResource[0]}:${openResource[1]}` }
          : undefined,
      settingsTarget: settingsResultId
        ? { tab: settingsTab, controlId: settingsTargetControlId ?? undefined, resultId: settingsResultId }
        : undefined,
      editorDirty,
      pinnedResultIds: ranking.pinnedIds,
      recentResultIds: ranking.recent.map((entry) => entry.id),
      setupResultIds,
      error: failedSources ? { resultIds: ["diagnostics"], message: t("omnibar.error") } : undefined,
    });
  }, [
    activeChat,
    activeChatId,
    agentCatalogOpen,
    agents,
    botBrowserOpen,
    cardLibraryKind,
    characterLibraryOpen,
    characters,
    chats,
    connections,
    data.commands,
    docs,
    editorDirty,
    gameAssetsBrowserOpen,
    lorebooks,
    openAgentId,
    openCharacterId,
    openConnectionId,
    openLorebookId,
    openPersonaId,
    openPresetId,
    personas,
    presets,
    ranking.pinnedIds,
    ranking.recent,
    rightPanel,
    rightPanelOpen,
    settingsTab,
    settingsTargetControlId,
    settingsPanelVisible,
    t,
  ]);
  const contextLabels = useMemo(
    () => ({
      surface: t("commandCenter.context.currentSurface", "On this screen"),
      "open-resource": t("commandCenter.context.openResource", "Open now"),
      "active-chat": t("commandCenter.context.activeChat", "Used by this chat"),
      "settings-target": t("commandCenter.context.settingsTarget", "Current setting"),
      dirty: t("commandCenter.context.unsaved", "Open with unsaved changes"),
      setup: t("commandCenter.context.setup", "Setup available"),
      error: t("commandCenter.context.error", "Related to a current error"),
      pinned: t("commandCenter.context.pinned", "Pinned"),
      recent: t("commandCenter.context.recent", "Recently used"),
    }),
    [t],
  );
  const searchResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarSearchResults({
        chatControls,
        contextLabels,
        controls,
        data,
        deferredQuery,
        docsResults: docs.results,
        faqItems: HOME_FAQ_ITEMS,
        getFaqSearchText,
        localize,
        mariEnabled,
        omnibarContext,
        t,
      }),
    [
      chatControls,
      contextLabels,
      controls,
      data,
      deferredQuery,
      docs.results,
      localize,
      mariEnabled,
      omnibarContext,
      t,
    ],
  );
  // Professor Mari's conversations live behind an internal marker, so they are
  // missing from the normal chat list. Searchable here by their auto-title.
  const [mariOpenChatId, setMariOpenChatId] = useState<string | null>(null);
  const mariChats = useProfessorMariChats(mariEnabled && deferredQuery.trim().length > 0);
  const mariChatResults = useMemo<OmnibarResult[]>(
    () => buildOmnibarMariChatResults({ deferredQuery, mariChats: mariChats.data ?? [], t }),
    [deferredQuery, mariChats.data, t],
  );

  // Chat search: the engine only stores messages per chat, so this searches the
  // chat you are in rather than pretending to search all of them. The message
  // list is shared with the in-chat search panel's cache.
  const messageSearchQuery = deferredQuery.trim();
  const messageSearch = useChatMessageSearchSource(
    activeChatId ?? null,
    !!activeChatId && messageSearchQuery.length >= MIN_MESSAGE_SEARCH_LENGTH,
  );
  // Normalizing every message body is NFKC + regex work over the whole chat, so
  // it is cached against the message list instead of redone on each keystroke.
  const messageSearchIndex = useMemo(
    () =>
      (messageSearch.data ?? []).map((message) => ({
        message,
        haystack: isMessageHiddenFromUser(message) ? null : normalizeTextForMatch(message.content),
      })),
    [messageSearch.data],
  );
  const messageResults = useMemo<OmnibarResult[]>(
    () => buildOmnibarMessageResults({ activeChatId, messageSearchIndex, messageSearchQuery, t }),
    [activeChatId, messageSearchIndex, messageSearchQuery, t],
  );
  // The other chats' transcripts are not on the client, so searching them is a
  // server read. Only asked for once the query is long enough to be selective.
  const globalMessageScoped = !queryScope || queryScope === "messages";
  const globalMessageSearch = useGlobalMessageSearch(
    messageSearchQuery,
    messageSearchQuery.length >= MIN_MESSAGE_SEARCH_LENGTH && globalMessageScoped,
  );
  const globalMessageResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarGlobalMessageResults({
        activeChatId,
        hits: globalMessageSearch.data ?? [],
        messageSearchQuery,
        t,
      }),
    [activeChatId, globalMessageSearch.data, messageSearchQuery, t],
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
  // Context-aware results: read the app's current location (active chat, open
  // editor) and surface direct jumps to whatever is on screen and under it.
  const contextResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarContextResults({
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
      }),
    [
      activeChat,
      activeChatId,
      activeEditorField,
      allLocalResults,
      agents.data,
      characterNameById,
      connectionById,
      lastAppError,
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
    ],
  );
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
  const addSuggestions = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarAddSuggestions({
        activeChat,
        attachedResultIds,
        deferredQuery,
        omnibarSuggestionsEnabled,
        searchResults: searchResults.some((result) => CHAT_RESOURCE_KIND[result.category])
          ? searchResults
          : attachableFallback,
        t,
      }),
    [activeChat, attachableFallback, attachedResultIds, deferredQuery, omnibarSuggestionsEnabled, searchResults, t],
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
  const chatExtraction = useMemo(
    () => (activeChat ? parseChatExtraction(deferredQuery) : null),
    [activeChat, deferredQuery],
  );
  const extractionResult = useMemo<OmnibarResult | null>(
    () => buildOmnibarExtractionResult({ activeChat, chatExtraction, t }),
    [activeChat, chatExtraction, t],
  );
  // The same hook the Work pane uses, so an approval decided from a row behaves
  // and reads exactly as it does there.
  const { keepApproval, restoreApproval, pendingId: approvalPendingId } = useMariApprovals();
  const approvalResults = useMemo<OmnibarResult[]>(
    () =>
      buildOmnibarApprovalResults({
        approvals: mariEnabled ? mariWorkspaceStatus.data?.pendingApprovals : undefined,
        t,
        pendingId: approvalPendingId,
        onDecide: (id, decision) => void (decision === "keep" ? keepApproval(id) : restoreApproval(id)),
        query: deferredQuery,
      }),
    [
      approvalPendingId,
      deferredQuery,
      keepApproval,
      mariEnabled,
      mariWorkspaceStatus.data?.pendingApprovals,
      restoreApproval,
      t,
    ],
  );
  const continueResult = useMemo<OmnibarResult | null>(
    () => buildOmnibarContinueResult({ mariEnabled, t, workspaceStatus: mariWorkspaceStatus.data, mariFinished }),
    [mariEnabled, mariWorkspaceStatus.data, t, mariFinished],
  );
  const rawResults = useMemo(
    () =>
      // A scope with nothing typed after it ("char:") is a request to browse that
      // kind, so the whole local list answers it instead of the idle suggestions.
      queryScope && !deferredQuery.trim()
        ? allLocalResults.filter((result) => matchesOmnibarScope(result, queryScope))
        : deferredQuery.trim()
          ? [
              ...slashResults,
              ...verbSuggestions,
              ...addSuggestions,
              ...removalSuggestions,
              ...approvalResults,
              ...(extractionResult ? [extractionResult] : []),
              ...messageResults,
              ...globalMessageResults,
              ...mariChatResults,
              // An explicit "Add X to this chat" row replaces the plain entity row
              // for the same thing: showing both lists every character twice, and
              // the plain one reads like "open" while doing the same attach.
              ...(addedResultIds.size || removedResultIds.size
                ? searchResults.filter((result) => !addedResultIds.has(result.id) && !removedResultIds.has(result.id))
                : searchResults),
            ]
          : [
              ...contextResults.slice(0, CHAT_CONTEXT_MAX_RESULTS),
              ...slashResults,
              ...approvalResults,
              ...(continueResult ? [continueResult] : []),
            ],
    [
      allLocalResults,
      queryScope,
      addSuggestions,
      addedResultIds,
      removedResultIds,
      contextResults,
      approvalResults,
      continueResult,
      deferredQuery,
      extractionResult,
      globalMessageResults,
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
    const searchRanking = deferredQuery.trim() ? { ...ranking, pinnedIds: [] } : ranking;
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
      searchRanking,
    ).map(({ result }) => ({ ...sourceById.get(result.command.id)!, command: result.command }));
  }, [deferredQuery, ranking, relevanceFilteredResults]);
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
  const asideDeadEnd = results.some(
    (result) => result.id === "ask-professor-mari" && result.group === "professor-suggested",
  );
  const asideConnectionName =
    languageConnections.find((connection) => connection.id === asideConnectionId)?.name ?? null;
  const asideState = useOmnibarAside({
    query: deferredQuery,
    deadEnd: asideDeadEnd && pane === "results",
    source: "command-center",
    resourceLabel: contextResults[0]?.title ?? null,
  });
  // Quick and Mari both own the whole dialog. Leaving the search input mounted
  // under them let one keystroke re-enter `results` and abort a running answer.
  const mariSurface = pane === "mari";
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
  useEffect(() => {
    const timer = window.setTimeout(() => writeCommandCenterSessionState(session), 250);
    return () => window.clearTimeout(timer);
  }, [session]);
  // Closing always persists the list. Mari is a place you go, not a place you
  // are returned to, and the pane is the one field that must not survive.
  useEffect(
    () => () => {
      writeCommandCenterSessionState({ ...sessionRef.current, pane: "results" });
    },
    [],
  );

  useEffect(() => {
    const resultOrderChanged = reconciledResultIdsKeyRef.current !== resultIdsKey;
    reconciledResultIdsKeyRef.current = resultIdsKey;
    const firstCurrentWorkId =
      !deferredQuery.trim() && presentation.groups[0]?.id === "current-work"
        ? presentation.groups[0].results[0]?.id
        : undefined;
    // A new query re-ranks everything, so the selection must follow the new top
    // row instead of sticking to whatever was highlighted before. Otherwise
    // "remove eliza" keeps the plain "Eliza" row selected from earlier
    // keystrokes and Enter opens her editor instead of detaching her.
    const queryChanged = reconciledQueryRef.current !== deferredQuery;
    reconciledQueryRef.current = deferredQuery;
    const next = reconcileActiveResultId(
      queryChanged ? null : resultOrderChanged && firstCurrentWorkId ? firstCurrentWorkId : activeResultId,
      results.map((result) => result.id),
    );
    setSession((current) => (current.activeResultId === next ? current : { ...current, activeResultId: next }));
  }, [activeResultId, deferredQuery, presentation.groups, resultIdsKey, results]);

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => {
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
  const focusMariReturnRow = () => {
    requestAnimationFrame(() => {
      const resultId = mariReturnResultIdRef.current;
      const row = resultId
        ? listRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(resultId)}"]`)
        : null;
      (row?.querySelector<HTMLElement>("button") ?? inputRef.current)?.focus();
    });
  };
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
  /** Every route into the Work pane goes through here, so none forgets a flag. */
  const enterMariPane = (context?: ProfessorMariAskContext, submitDraft = false) => {
    startFieldFlight();
    if (context) {
      setMariContext(context);
      // The handoff lives in session state, not component state, so a task that
      // Mari finishes while the omnibar is shut is still waiting on reopen.
      setSessionValue("mariHandoff", {
        status: "pending",
        context,
        draft: context.query,
      });
    }
    if (submitDraft) setMariSubmitDraftRequest((current) => current + 1);
    setMariChatOpen(true);
    setMariMounted(true);
    setPane("mari");
  };
  const enterRequestedMariPane = useEffectEvent((request: ProfessorMariOpenDetail) => {
    enterMariPane(request.context);
  });
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
  /** Guards every path that leaves an open editor, so no route skips the prompt. */
  const confirmLeaveEditor = () =>
    !ui().editorDirty || window.confirm(t("commandCenter.dirtyEditor", "You have unsaved changes. Leave this editor?"));
  const navigate = (target: ProfessorMariNavigationTarget) => {
    if (!confirmLeaveEditor()) return false;
    executeStateNavigation(target);
    return true;
  };
  const recordUse = (id: string) => {
    const next = recordCommandUse(ranking, id);
    setRanking(next);
    writeCommandRankingState(next);
  };
  const togglePinned = (id: string) => {
    const next = setCommandPinned(ranking, id, !ranking.pinnedIds.includes(id));
    setRanking(next);
    writeCommandRankingState(next);
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
  /**
   * Detaches one resource from the open chat. Each kind lives in a different
   * field, so the mapping is explicit; a lorebook is also added to the excluded
   * list, because dropping it from the active list alone lets a character
   * re-activate it immediately.
   */
  const detachFromChat = (resource: ChatResourceDragKind, resourceId: string, label: string) => {
    if (!activeChat || !resourceId) return false;
    const chatId = activeChat.id;
    // Each patch is paired with the patch that puts the old value back, so the
    // toast can offer Undo instead of a modal confirm blocking the keyboard flow.
    const metadata = parseChatMetadata(activeChat.metadata);
    const activeAgentIds = Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : [];
    const characterIds = getChatCharacterIds(activeChat);
    const activeLorebookIds = getChatActiveLorebookIds(activeChat);
    const excludedLorebookIds = getChatExcludedLorebookIds(activeChat);
    const chatPatch = (next: Parameters<typeof patchChat>[0], undo: Parameters<typeof patchChat>[0]) => ({
      apply: () => void patchChat(next),
      undo: () => void patchChat(undo),
    });
    const metadataPatch = (
      next: Parameters<typeof patchChatMetadata>[0],
      undo: Parameters<typeof patchChatMetadata>[0],
    ) => ({ apply: () => void patchChatMetadata(next), undo: () => void patchChatMetadata(undo) });
    const change =
      resource === "character"
        ? chatPatch(
            { id: chatId, characterIds: characterIds.filter((id) => id !== resourceId) },
            { id: chatId, characterIds },
          )
        : resource === "persona"
          ? chatPatch({ id: chatId, personaId: null }, { id: chatId, personaId: activeChat.personaId ?? null })
          : resource === "preset"
            ? chatPatch(
                { id: chatId, promptPresetId: null },
                { id: chatId, promptPresetId: activeChat.promptPresetId ?? null },
              )
            : resource === "connection"
              ? chatPatch(
                  { id: chatId, connectionId: null },
                  { id: chatId, connectionId: activeChat.connectionId ?? null },
                )
              : resource === "lorebook"
                ? metadataPatch(
                    {
                      id: chatId,
                      activeLorebookIds: activeLorebookIds.filter((id) => id !== resourceId),
                      excludedLorebookIds: [...new Set([...excludedLorebookIds, resourceId])],
                    },
                    { id: chatId, activeLorebookIds, excludedLorebookIds },
                  )
                : resource === "agent"
                  ? metadataPatch(
                      {
                        id: chatId,
                        // A chat stores either the agent's id or its type, while the row id
                        // is always the type. Comparing raw values would detach nothing.
                        activeAgentIds: activeAgentIds.filter(
                          (id) =>
                            (agents.data?.find((agent) => agent.id === id || agent.type === id)?.type ?? id) !==
                            resourceId,
                        ),
                      },
                      { id: chatId, activeAgentIds },
                    )
                  : null;
    if (!change) return false;
    change.apply();
    toast.success(t("commandCenter.actions.removedFromChat", "Removed {{name}} from this chat.", { name: label }), {
      action: { label: t("ui.chat.chatresourcedropoverlay.undo", "Undo"), onClick: change.undo },
    });
    onClose();
    return true;
  };
  /** Attaches one resource to the open chat and closes, unless the drop rules block it. */
  const attachToChat = (kind: ChatResourceDragKind, id: string, label: string, resultId: string) => {
    if (!activeChat || !id) return false;
    const payload: ChatResourceDragPayload = { version: 1, kind, ids: [id], label };
    const blocked = resolveChatResourceDropAction(payload, activeChat);
    if (blocked?.type === "blocked") {
      // Silently returning false left the row looking live but doing nothing.
      toast.info(t(chatResourceBlockedKey(blocked), { name: label }));
      return false;
    }
    requestChatResourceAssignment(payload);
    recordUse(resultId);
    onClose();
    return true;
  };
  const runDirectChatAction = (result: OmnibarResult) => {
    if (!activeChat || !isDirectActiveChatAction(query, result, searchResults)) return false;
    const kind = CHAT_RESOURCE_KIND[result.category];
    if (!kind) return false;
    return attachToChat(kind, getOmnibarResourceId(result), result.title, result.id);
  };
  // Typed dispatch for the results that do something other than open an entity.
  // Results without an `action` fall through to the generic entity-open path in
  // `choose` below.
  const runResultAction = (result: OmnibarResult, action: OmnibarAction) => {
    switch (action.kind) {
      case "open-mari-chat":
        setMariOpenChatId(action.chatId);
        openProfessorMari();
        return;
      case "slash": {
        const chatId = activeChatId;
        const command = `/${action.command} `;
        recordUse(result.id);
        onClose();
        // After the dialog unmounts, so the chat input keeps the focus it takes.
        if (chatId) requestAnimationFrame(() => dispatchCardAssetInsert(command, chatId));
        return;
      }
      case "goto-message":
        // The request is keyed by chat id and survives the switch, so a hit in
        // another chat opens that chat and the jump is picked up on arrival.
        if (action.chatId !== activeChatId && !navigate({ kind: "chat", chatId: action.chatId })) return;
        useChatStore.getState().requestGotoMessage(action.chatId, action.messageNumber);
        onClose();
        return;
      case "refine-query":
        setQuery(action.query);
        setActiveResultId(null);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      case "add-to-chat":
        attachToChat(action.resource, action.resourceId, action.label, result.id);
        return;
      case "detach-from-chat":
        if (detachFromChat(action.resource, action.resourceId, action.label)) recordUse(result.id);
        return;
      case "personal-extension":
        if (activatePersonalExtensionCommand(action.commandId)) {
          recordUse(result.id);
          onClose();
        }
        return;
      case "open-docs":
        ui().openModal("docs-viewer", {
          initialDoc: action.path,
          initialSearchTerm: query.trim().slice(0, 200),
        });
        recordUse(result.id);
        onClose();
        return;
      case "open-faq":
        ui().openModal("faq-viewer", { initialItemId: action.itemId });
        recordUse(result.id);
        onClose();
        return;
    }
  };
  const choose = (result: OmnibarResult) => {
    if (result.control) return;
    if (result.action) {
      runResultAction(result, result.action);
      return;
    }
    if (runDirectChatAction(result)) return;
    if (runSystemAction(result)) {
      recordUse(result.id);
      onClose();
      return;
    }
    if (result.id === "chat-extraction") {
      void runChatExtraction();
      return;
    }
    // A dependency install or a sensitive file write executes on approval, so the
    // row opens the card that shows what will run instead of deciding in place.
    if (result.id.startsWith("mari-approval:")) {
      openProfessorMari(null, { reviewPending: true });
      return;
    }
    if (result.id === "ask-professor-mari") {
      if (result.group === "continue") {
        // The continue row resumes existing work, so there is nothing to submit.
        openProfessorMari(null, {
          reviewPending: (mariWorkspaceStatus.data?.pendingApprovals.length ?? 0) > 0,
        });
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
  const chooseChoiceOption = (result: RankedOmnibarResult) => {
    if (!result.chooseValue) return false;
    result.chooseValue();
    // Keep the parent selected when the row came from an expansion, so the list
    // does not jump; a row found by typing has no parent on screen.
    const parentId = readChoiceOptionId(result.id)?.parentId;
    setExpandedChoiceId(null);
    if (parentId && presentation.results.some((row) => row.id === parentId)) setActiveResultId(parentId);
    return true;
  };
  const selectResult = (result: RankedOmnibarResult) => {
    if (chooseChoiceOption(result)) return;
    if (!result.control && isRichResult(result) && window.matchMedia("(pointer: coarse)").matches) {
      showResultDetail(result);
      return;
    }
    setActiveResultId(result.id);
    if (result.control?.type === "toggle") result.control.onChange(result.control.value !== true);
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
    setActiveResultId(result.id);
    // The preview renders for whatever is highlighted, and hover moves the
    // highlight. Without this the box under the expanded row would show the
    // hovered row's preview. Same rule the arrow keys already follow.
    if (expandedPreviewId) setExpandedPreviewId(isRichResult(result) ? result.id : null);
  };
  const handleEscape = () => {
    if (expandedPreviewId || expandedChoiceId) {
      // One expansion, one press. Collapsing does not close the omnibar.
      setExpandedPreviewId(null);
      setExpandedChoiceId(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (pane === "mari") {
      setMariChatOpen(false);
      setPane("results");
      focusMariReturnRow();
    } else onClose();
  };
  const moveSelection = (index: number) => {
    const next = results[index];
    setActiveResultId(next?.id ?? null);
    if (expandedPreviewId) setExpandedPreviewId(next && isRichResult(next) ? next.id : null);
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab" && !event.shiftKey && inlineSuffix) {
      // Accept the ghost completion instead of leaving the field.
      event.preventDefault();
      setQuery(query + inlineSuffix);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p" && activeResult) {
      // A pin only reorders the empty-query deck (search strips pinnedIds), so it
      // curates what the bar opens on rather than overriding relevance.
      event.preventDefault();
      togglePinned(activeResult.id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleEscape();
    } else if (pane === "results" && event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(Math.min(Math.max(activeIndex, -1) + 1, results.length - 1));
    } else if (pane === "results" && event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(Math.max(activeIndex < 0 ? 0 : activeIndex - 1, 0));
    } else if (pane === "results" && event.key === "Home") {
      event.preventDefault();
      moveSelection(0);
    } else if (pane === "results" && event.key === "End") {
      event.preventDefault();
      moveSelection(results.length - 1);
    } else if (
      mariEnabled &&
      pane === "results" &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      activeResult &&
      activeResult.command.availability?.status !== "requires-admin"
    ) {
      // Continue the selected result with Mari without opening the detail pane first.
      event.preventDefault();
      openProfessorMari(resolveCurrentResult(activeResult));
    } else if (pane === "results" && event.key === "Enter" && !activeResult && mariEnabled && query.trim()) {
      // Nothing ranked at all, so Enter still reaches Mari by the one door.
      event.preventDefault();
      openProfessorMari(null);
    } else if (pane === "results" && event.key === "Enter" && activeResult) {
      event.preventDefault();
      if (chooseChoiceOption(activeResult)) return;
      if (activeResult.control?.type === "toggle") activeResult.control.onChange(activeResult.control.value !== true);
      else if (activeResult.control?.type === "choice")
        setExpandedChoiceId((current) => (current === activeResult.id ? null : activeResult.id));
      else if (mariEnabled && activeResult.id === "ask-professor-mari") openProfessorMari(null, { submitDraft: true });
      else choose(activeResult);
    } else if (pane === "results" && event.key === "ArrowLeft" && activeResult && expandedPreviewId) {
      event.preventDefault();
      setExpandedPreviewId(null);
    } else if (
      pane === "results" &&
      event.key === "ArrowLeft" &&
      activeResult &&
      expandedChoiceId &&
      (activeResult.id === expandedChoiceId || readChoiceOptionId(activeResult.id)?.parentId === expandedChoiceId)
    ) {
      // Collapse before the generic ArrowLeft below returns focus to the input,
      // so one press does one thing.
      event.preventDefault();
      setExpandedChoiceId(null);
      setActiveResultId(expandedChoiceId);
    } else if (
      pane === "results" &&
      event.key === "ArrowRight" &&
      activeResult &&
      activeResult.control?.type === "choice"
    ) {
      event.preventDefault();
      setExpandedChoiceId(activeResult.id);
    } else if (pane === "results" && event.key === "ArrowRight" && activeResult && isRichResult(activeResult)) {
      event.preventDefault();
      setExpandedPreviewId((current) => (current === activeResult.id ? null : activeResult.id));
    }
  };
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      handleEscape();
      return;
    }
    const focusedRow = (event.target as HTMLElement).closest<HTMLElement>("[data-command-center-result-row]");
    const focusedRowButton = focusedRow?.querySelector<HTMLElement>(":scope > button");
    if (focusedRow && event.target === focusedRowButton && pane === "results") {
      const rowId = focusedRow.dataset.resultId;
      // Hover moves the highlight without moving DOM focus, so arrows continue
      // from what is highlighted — otherwise they jump back to the focused row.
      const rowIndex = activeIndex >= 0 ? activeIndex : results.findIndex((result) => result.id === rowId);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? results.length - 1
              : event.key === "ArrowDown"
                ? Math.min(rowIndex + 1, results.length - 1)
                : Math.max(rowIndex - 1, 0);
        const next = results[nextIndex];
        if (next) {
          // Through `moveSelection`, so this path keeps the expansion in step
          // with the selection exactly as the input-focused arrows and hover do.
          moveSelection(nextIndex);
          listRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(next.id)}"] button`)?.focus();
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "ArrowRight") {
        const focusedResult = results[rowIndex];
        if (focusedResult?.control?.type === "choice") {
          event.preventDefault();
          setExpandedChoiceId(focusedResult.id);
          return;
        }
        if (focusedResult && isRichResult(focusedResult)) {
          event.preventDefault();
          setExpandedPreviewId((current) => (current === focusedResult.id ? null : focusedResult.id));
          return;
        }
      }
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        !element.closest('[aria-hidden="true"]') &&
        element.getClientRects().length > 0,
    );
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? current <= 0
        ? focusable.length - 1
        : current - 1
      : current === focusable.length - 1
        ? 0
        : current + 1;
    event.preventDefault();
    focusable[next]?.focus();
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
  /** Ranked rows and plain context rows both feed the Mari handoff. */
  type OmnibarAskFocus = Pick<OmnibarResult, "id" | "title" | "category"> | null;
  /** Quick and full Mari hand over the same context, so they read the same surroundings. */
  const buildAskContext = (message: string, focusResult: OmnibarAskFocus) =>
    buildProfessorMariCommandCenterContext(message, focusResult, [], focusResult?.id, {
      activeChat: activeChat ? { id: activeChat.id, label: activeChat.name, mode: activeChat.mode } : undefined,
      settingsLocation:
        settingsPanelVisible && (settingsTab || settingsTargetControlId)
          ? { tab: settingsTab ?? undefined, controlId: settingsTargetControlId ?? undefined }
          : undefined,
      field: activeEditorField?.label,
      fieldId: activeEditorField?.id,
      error: lastAppError ? { message: lastAppError.message, code: lastAppError.code } : undefined,
    });
  /** Both Mari routes remember the row they left, so returning restores focus. */
  const rememberMariReturn = (focusResult: OmnibarAskFocus) => {
    const returnResultId = focusResult?.id ?? activeResultId;
    mariReturnResultIdRef.current = returnResultId;
    setSessionValue("mariReturnResultId", returnResultId);
  };
  const openProfessorMari = (
    selectedResult: RankedOmnibarResult | null = null,
    options: { reviewPending?: boolean; submitDraft?: boolean } = {},
  ) => {
    const draft = query.trim();
    if (draft) useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, draft);
    const focusResult = selectedResult ?? contextResults[0] ?? null;
    rememberMariReturn(focusResult);
    enterMariPane(buildAskContext(draft, focusResult), options.submitDraft);
    if (options.reviewPending) setMariPendingReviewRequest((current) => current + 1);
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
      setMariChatOpen(false);
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

  /**
   * Turns the active chat into reusable world material. A lorebook gets an empty
   * shell up front so Mari has somewhere to write; the other kinds need Mari to
   * decide what already exists first. Mari receives a typed chat reference, not
   * the transcript — she reads what she needs after the request.
   */
  const runChatExtraction = async () => {
    if (!chatExtraction || !activeChat) return;
    let lorebookId: string | undefined;
    try {
      const lorebook = await createLorebook.mutateAsync({ name: activeChat.name });
      lorebookId = lorebook.id;
    } catch (error) {
      ui().setLastAppError({
        message: error instanceof Error ? error.message : String(error),
        action: t("commandCenter.extract.createLorebookAction", "Create lorebook"),
      });
    }
    useChatStore.getState().setInputDraft(PROFESSOR_MARI_DRAFT_KEY, chatExtraction.seed);
    mariReturnResultIdRef.current = "chat-extraction";
    enterMariPane(
      buildProfessorMariCommandCenterContext(
        chatExtraction.seed,
        lorebookId ? { id: `lorebook:${lorebookId}`, title: activeChat.name, category: "lorebook" } : null,
        [],
        undefined,
        { activeChat: { id: activeChat.id, label: activeChat.name, mode: activeChat.mode } },
      ),
    );
  };

  // Keyed by row id so the two per-row lookups below stay O(1); a linear scan
  // over every chat, twice per rendered row, showed up on large libraries.
  const chatModeByResultId = useMemo(
    () => new Map(data.chats.map((chat) => [`chat:${chat.id}` as string, chat.mode] as const)),
    [data.chats],
  );
  const resultIcon = (result: RankedOmnibarResult) => {
    if (result.category === "chat") {
      const mode = chatModeByResultId.get(result.id);
      if (mode === "roleplay") return Theater;
      if (mode === "game") return Gamepad2;
      return MessageCircle;
    }
    return getCommandIcon(result.command.icon, result.command.kind);
  };
  const resultVisual = (result: RankedOmnibarResult) => {
    if (result.category === "chat") {
      const mode = chatModeByResultId.get(result.id);
      if (mode) return getCommandCenterChatModeVisual(mode as ChatMode, chatModeLabels);
    }
    return getCommandCenterCategoryVisual(result.category, categoryLabels);
  };
  /**
   * What Enter does, in one word. Resource rows open an editor even when the row
   * shows only a name, so "Open" alone was misleading in the context group.
   */
  const resultEnterHint = (result: RankedOmnibarResult) =>
    EDITOR_CATEGORIES.has(result.category)
      ? t("commandCenter.edit", "Edit")
      : result.category === "docs"
        ? t("commandCenter.read", "Read")
        : t("commandCenter.open", "Open");
  // Matched against the in-flight mutation's own id: keying on `isPending` alone
  // put a spinner on every persona row while one persona was activating.
  const resultControlPending = (result: RankedOmnibarResult) => {
    const resourceId = getOmnibarResourceId(result);
    if (result.category === "lorebook") return updateLorebook.isPending && updateLorebook.variables?.id === resourceId;
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

  const previewActions = previewResult
    ? (() => {
        if (previewResult.command.availability?.status === "requires-admin") return [];
        const mariActions = mariEnabled
          ? [
              {
                label: t("commandCenter.actions.continueWithMari", "Continue with Mari"),
                icon: Sparkles,
                onSelect: () => openProfessorMari(previewResult),
              },
            ]
          : [];
        if (previewResult.control?.type === "choice") return mariActions;
        const resourceKind = CHAT_RESOURCE_KIND[previewResult.category];
        const resourceId = resourceKind ? getOmnibarResourceId(previewResult) : "";
        const connection =
          resourceKind === "connection"
            ? (connections.data ?? []).find((item) => readNamedRow(item)?.id === resourceId)
            : undefined;
        const payload: ChatResourceDragPayload | null = resourceKind
          ? {
              version: 1,
              kind: resourceKind,
              ids: [resourceId],
              label: previewResult.title,
              ...(connection && !isLanguageGenerationConnection(connection)
                ? { unsupported: "connection-kind" as const }
                : {}),
            }
          : null;
        const rowResource =
          resourceKind === "character" ||
          resourceKind === "persona" ||
          resourceKind === "preset" ||
          resourceKind === "connection"
            ? resourceKind
            : null;
        const rowState = rowResource
          ? resolveOmnibarRowState({
              resource: rowResource,
              id: resourceId,
              activeChat,
              globallyActive:
                previewResult.category === "persona"
                  ? previewResult.control?.value === true
                  : previewResult.category === "preset"
                    ? previewResult.control?.value === true
                    : undefined,
            })
          : null;
        const canAddToChat =
          payload &&
          activeChat &&
          (!rowState || rowState.canAddToChat) &&
          resolveChatResourceDropAction(payload, activeChat)?.type !== "blocked";
        const addToChatAction =
          payload && canAddToChat
            ? {
                label: t("commandCenter.actions.addToThisChat", "Add to this chat"),
                icon: MessageCircle,
                onSelect: () => {
                  requestChatResourceAssignment(payload);
                  recordUse(previewResult.id);
                  onClose();
                },
              }
            : null;
        if ((previewResult.category === "persona" || previewResult.category === "preset") && !rowState?.globalAction) {
          return [...mariActions, ...(addToChatAction ? [addToChatAction] : [])];
        }
        if (previewResult.category === "persona" || previewResult.category === "preset") {
          const globalAction =
            previewResult.control?.type === "toggle"
              ? {
                  label: t("commandCenter.actions.setDefaultPreset", "Set default preset"),
                  icon: ArrowRight,
                  onSelect: () => previewResult.control?.onChange(true),
                  disabled: resultControlPending(previewResult),
                }
              : null;
          return [
            ...mariActions,
            ...(globalAction ? [globalAction] : []),
            ...(addToChatAction ? [addToChatAction] : []),
          ];
        }
        if (previewResult.category === "lorebook") {
          const inActiveChat = Boolean(activeChat && attachedResultIds.has(previewResult.id));
          const editAction = {
            label: t("commandCenter.actions.editLorebook", "Edit lorebook"),
            icon: Edit3,
            onSelect: () => choose(previewResult),
          };
          const askMariAction = mariEnabled
            ? {
                label: t("commandCenter.mode.work", "Ask Mari"),
                icon: Sparkles,
                onSelect: () => openProfessorMari(previewResult),
              }
            : null;
          const contextAction = inActiveChat
            ? {
                label: t("commandCenter.actions.removeFromThisChat", "Remove from this chat"),
                icon: X,
                onSelect: () => detachFromChat("lorebook", resourceId, previewResult.title),
              }
            : addToChatAction;
          return [editAction, ...(askMariAction ? [askMariAction] : []), ...(contextAction ? [contextAction] : [])];
        }
        if (previewResult.category === "character") {
          const characterId = getOmnibarResourceId(previewResult);
          const startChatAction = {
            label: t("commandCenter.actions.startChat", "Start chat"),
            icon: Play,
            onSelect: () => {
              ui().openModal("start-character-chat", { characterId, characterName: previewResult.title });
              recordUse(previewResult.id);
              onClose();
            },
          };
          const editAction = {
            label: t("commandCenter.actions.editCharacter", "Edit character"),
            icon: Edit3,
            onSelect: () => choose(previewResult),
          };
          // Symmetric to add-to-chat: when the character is already a participant,
          // the most useful scene action is removing it from the active chat.
          const removeFromChatAction =
            activeChat && characterId && rowState?.inActiveChat
              ? {
                  label: t("commandCenter.actions.removeFromThisChat", "Remove from this chat"),
                  icon: UserMinus,
                  onSelect: () => {
                    void updateChat.mutateAsync({
                      id: activeChat.id,
                      characterIds: (activeChat.characterIds ?? []).filter((id) => id !== characterId),
                    });
                    recordUse(previewResult.id);
                    onClose();
                  },
                }
              : null;
          return [
            editAction,
            ...(removeFromChatAction ? [removeFromChatAction] : addToChatAction ? [addToChatAction] : []),
            startChatAction,
          ];
        }
        const requiresSetup = previewResult.command.availability?.status === "requires-capability";
        const openAction =
          previewResult.target && (!requiresSetup || previewResult.command.availability?.setupTarget)
            ? {
                label:
                  previewResult.category === "chat"
                    ? t("commandCenter.actions.resumeChat", "Resume chat")
                    : previewResult.category === "docs"
                      ? t("commandCenter.actions.openDocs", "Open documentation")
                      : t("commandCenter.open", "Open"),
                icon: previewResult.category === "chat" ? Play : FolderOpen,
                onSelect: () => choose(previewResult),
                disabled: resultControlPending(previewResult),
              }
            : null;
        return [...mariActions, ...(openAction ? [openAction] : []), ...(addToChatAction ? [addToChatAction] : [])];
      })()
    : [];

  // One preview body shared by both detail surfaces (inline under the row,
  // and the external xl panel) so they never drift apart.
  const renderResultPreview = () =>
    previewResult ? (
      <Suspense fallback={null}>
        <OmnibarDetailPane
          result={previewResult}
          actions={previewActions}
          extraFacts={previewDetail.extraFacts}
          detail={previewDetail.detail}
          detailLoading={previewDetail.detailLoading}
          controlPending={resultControlPending(previewResult)}
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

  return createPortal(
    <motion.div
      ref={panelRef}
      data-component="GlobalOmnibar"
      data-pane={pane}
      data-mode={pane === "mari" ? "work" : "find"}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 backdrop-blur-sm motion-safe:transition-[padding] motion-safe:duration-300 sm:px-6 sm:pt-[var(--omnibar-top)]"
      // An empty bar sits lower, near the middle, so the hint field below it has
      // room; it rides back up as soon as results need the space.
      style={{ "--omnibar-top": idle && !mariSurface ? "26vh" : "10vh" } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: "easeOut" }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={trapFocus}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-omnibar-title"
        ref={dialogRef}
        data-component="GlobalOmnibar.Panel"
        className={`relative isolate flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--card)] shadow-2xl motion-safe:animate-omnibar-in sm:max-w-[44rem] sm:rounded-2xl sm:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] sm:ring-1 sm:ring-[var(--border)]/60 motion-safe:transition-[height,max-height,max-width] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none ${
          pane === "mari"
            ? "mari-workspace-shell sm:h-[min(44rem,80dvh)] sm:max-h-[min(44rem,80dvh)]"
            : idle
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
              "flex h-16 items-center gap-3 border-b border-[var(--border)] px-3 sm:h-14 sm:px-4",
              mariSurface && "mari-workspace-header",
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
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] sm:size-9"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <Search size={19} aria-hidden="true" className="shrink-0 text-[var(--primary)]" />
            )}
            <AnimatePresence initial={false} mode="wait">
              {mariSurface ? (
                <motion.div
                  key="omnibar-mari-header"
                  initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -10 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className="mari-workspace-portrait"
                    data-state={mariVisualState}
                    data-conversation={mariHasConversation ? "true" : "false"}
                    aria-hidden="true"
                  >
                    <img src={PROFESSOR_MARI_PEEK_URL} alt="" draggable={false} data-part="idle" />
                    <img
                      src="/sprites/mari/generated/professor-mari-assistant-blink-v3.png"
                      alt=""
                      draggable={false}
                      data-part="blink"
                    />
                  </span>
                  <span className="mari-omnibar-header-copy min-w-0 shrink-0">
                    <span className="block text-sm font-semibold leading-tight text-[var(--foreground)]">
                      {t("omnibar.categories.professor", "Professor Mari")}
                    </span>
                    <span className="block text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)]">
                      {mariStatusLabel ||
                        (mariVisualState === "thinking"
                          ? t("ui.chat.homeprofessormarichat.workingOnIt", "Working on it...")
                          : mariVisualState === "warning"
                            ? t("mari.presence.needsYou", "Professor Mari needs your answer")
                            : t("commandCenter.mode.work", "Ask Mari"))}
                    </span>
                  </span>
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
                    onKeyDown={onInputKeyDown}
                    placeholder={
                      idle
                        ? idleGreeting
                        : t("commandCenter.placeholder", "Search everything — or narrow with faq:, docs:, msg:, char:")
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
              <button
                type="button"
                onClick={() => openProfessorMari()}
                aria-label={t("commandCenter.openWork", "Ask Professor Mari")}
                title={t("commandCenter.openWork", "Ask Professor Mari")}
                data-component="GlobalOmnibar.ProfessorMariButton"
                className="group relative -mb-px flex h-14 w-[4.25rem] shrink-0 self-end items-end justify-end overflow-hidden pb-2 pl-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] max-[30rem]:w-11 max-[30rem]:pl-0"
              >
                <img
                  src={PROFESSOR_MARI_PEEK_URL}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute left-1/2 top-0 h-[6.5rem] w-auto max-w-none -translate-x-1/2 object-contain object-top transition-transform duration-200 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none max-[30rem]:h-20"
                />
              </button>
            ) : null}
            {mariSurface ? <OmnibarSettingsMenu /> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close", "Close")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] sm:size-9"
            >
              <X size={18} />
            </button>
          </div>
          {mariSurface ? <div ref={setMariHeaderSlot} className="mari-omnibar-header-row" /> : null}
          {!query.trim() && !mariSurface ? (
            <div
              role="toolbar"
              aria-label={t("commandCenter.scopeChips.label", "Search a category")}
              data-component="GlobalOmnibar.ScopeChips"
              className="omnibar-horizontal-strip scrollbar-hide flex min-h-11 items-center gap-1 overflow-x-auto border-b border-[var(--border)] py-1.5 pl-3 pr-6 overscroll-x-contain sm:min-h-10"
            >
              {OMNIBAR_SCOPE_CHIP_FILTERS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  data-omnibar-scope-chip={chip}
                  onClick={() => {
                    const scope = FILTER_CATEGORY[chip];
                    if (!scope) return;
                    // Write the prefix rather than setting hidden state, so the
                    // syntax is visible in the field the moment it is used.
                    setQuery(omnibarScopePrefix(scope));
                    setFilter("all");
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {filterLabels[chip]}
                </button>
              ))}
            </div>
          ) : null}
          {query.trim() && !mariSurface ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
              role="toolbar"
              aria-label={t("commandCenter.filters.label", "Result categories")}
              data-component="GlobalOmnibar.Filters"
              className="omnibar-horizontal-strip scrollbar-hide flex min-h-11 items-center gap-1 overflow-x-auto border-b border-[var(--border)] py-1.5 pl-3 pr-6 overscroll-x-contain sm:min-h-10"
            >
              {availableFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setCategoryFilter(item)}
                  className={`min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${filter === item ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
                >
                  {filterLabels[item]}
                </button>
              ))}
            </motion.div>
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
              onVisualStateChange={handleMariVisualStateChange}
            />
          </Suspense>
        ) : null}
        {pane !== "mari" && idle ? (
          <div
            data-component="GlobalOmnibar.Empty"
            className="flex min-h-40 flex-1 flex-col items-center justify-center px-6 py-8 text-center sm:min-h-32"
          >
            <Search size={20} aria-hidden="true" className="mb-2 text-[var(--primary)]" />
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("commandCenter.empty.title", "Search across Marinara")}
            </p>
            <p className="mt-1 max-w-[32rem] text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t(
                "commandCenter.empty.description",
                "Try a chat, character, setting, or message. Use the category shortcuts above to browse.",
              )}
            </p>
          </div>
        ) : null}
        {pane === "mari" || idle ? null : (
          <div className="flex min-h-0 flex-1">
            <div
              ref={listRef}
              id="global-omnibar-results"
              aria-label={t("omnibar.results", "Search results")}
              data-component="GlobalOmnibar.Results"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
            >
              {query.trim() && loading && results.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  {t("omnibar.loading", "Loading results")}
                </div>
              ) : null}
              {failed ? (
                <div role="status" className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                  {t("omnibar.error", "Some results could not be loaded")}
                </div>
              ) : null}
              {presentation.groups.map((group) => {
                const GroupIcon =
                  group.id === "professor-suggested"
                    ? Sparkles
                    : group.id === "current-work" || group.id === "context"
                      ? Compass
                      : group.id === "continue"
                        ? Sparkles
                        : group.id === "recent"
                          ? Clock3
                          : group.id === "quick-controls"
                            ? SlidersHorizontal
                            : group.id === "pinned"
                              ? Sparkles
                              : LayoutGrid;
                return (
                  <section key={group.id} aria-labelledby={`omnibar-group-${group.id}`}>
                    <div className="flex items-center gap-1.5 px-3 pb-1 pt-3">
                      <GroupIcon size={12} className="text-[var(--primary)]" aria-hidden="true" />
                      <h3
                        id={`omnibar-group-${group.id}`}
                        className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]"
                      >
                        {groupLabels[group.id]}
                      </h3>
                      <span className="text-[0.625rem] text-[var(--muted-foreground)]/70">{group.results.length}</span>
                    </div>
                    <ul className="space-y-0.5 px-1">
                      {group.results.map((result, rowIndex) => {
                        const visual = resultVisual(result);
                        const preview = result.preview?.();
                        const selected = result.id === activeResult?.id;
                        const setupStatus =
                          result.command.availability?.status === "requires-capability"
                            ? t("commandCenter.setup", "Set up")
                            : result.command.availability?.status === "requires-admin"
                              ? t("commandCenter.adminRequired", "Administrator access required")
                              : undefined;
                        return (
                          <CommandCenterResultRow
                            key={result.id}
                            className="motion-safe:animate-omnibar-row-in"
                            style={{ animationDelay: `${Math.min(rowIndex, 8) * 22}ms` }}
                            dataResultId={result.id}
                            id={`omnibar-${result.id}`}
                            title={result.title}
                            metadata={resultMetadata(result, preview)}
                            tertiaryMetadata={
                              // A toggle/action control already shows the on/active state, so
                              // the status label ("Enabled"/"Active") next to it is redundant —
                              // keep only the informative metadata line in that case.
                              result.control?.type === "toggle"
                                ? preview?.metadataLine
                                : (preview?.status?.label ?? preview?.badges?.[0] ?? preview?.metadataLine)
                            }
                            icon={resultIcon(result)}
                            selected={selected}
                            onSelect={() => selectResult(result)}
                            onMouseMove={(event) => handleResultMouseMove(result, event)}
                            expanded={
                              result.id === expandedPreviewId ? (
                                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60">
                                  {renderResultPreview()}
                                </div>
                              ) : undefined
                            }
                            mariAffordance={
                              mariEnabled && result.command.availability?.status !== "requires-admin" ? (
                                <button
                                  type="button"
                                  aria-label={t("commandCenter.actions.continueWithMari", "Continue with Mari")}
                                  title={t("commandCenter.actions.continueWithMari", "Continue with Mari")}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openProfessorMari(resolveCurrentResult(result));
                                  }}
                                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-opacity hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] max-md:opacity-100 ${
                                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                  }`}
                                >
                                  <Sparkles className="size-3.5" aria-hidden="true" />
                                </button>
                              ) : undefined
                            }
                            mediaSrc={preview?.media?.src}
                            mediaKind={preview?.media?.kind}
                            avatarCropStyle={preview?.media?.avatarCropStyle}
                            groupClassName={visual.groupClassName}
                            accent={preview?.accent}
                            setupStatus={setupStatus}
                            enterHint={result.control ? undefined : resultEnterHint(result)}
                            control={
                              result.control?.type === "choice" ? (
                                <CommandCenterSegmentedChoice
                                  label={result.control.label}
                                  value={String(result.control.value)}
                                  options={(result.control.options ?? []).map((option) => ({ ...option }))}
                                  onValueChange={(value) => result.control?.onChange(value)}
                                  variant="compact"
                                />
                              ) : result.category === "preset" ? (
                                <CommandCenterActionValue
                                  label={t("commandCenter.actions.setDefaultPreset", "Set default preset")}
                                  icon={ArrowRight}
                                  value={
                                    result.control?.value === true
                                      ? t("commandCenter.values.active", "Active")
                                      : undefined
                                  }
                                  onClick={() => {
                                    if (result.control?.type === "toggle") result.control.onChange(true);
                                  }}
                                  disabled={result.control?.value === true || resultControlPending(result)}
                                  loading={resultControlPending(result)}
                                  variant="compact"
                                  tone="primary"
                                  className="justify-end"
                                />
                              ) : result.control?.type === "toggle" ? (
                                <CommandCenterToggle
                                  label={result.control.label}
                                  checked={Boolean(result.control.value)}
                                  stateLabel={
                                    result.control.value
                                      ? t("commandCenter.values.enabled", "Enabled")
                                      : t("commandCenter.values.disabled", "Disabled")
                                  }
                                  onCheckedChange={(value) => result.control?.onChange(value)}
                                  disabled={resultControlPending(result)}
                                  loading={resultControlPending(result)}
                                  variant="compact"
                                  className="justify-end"
                                />
                              ) : undefined
                            }
                          />
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              {!loading && query.trim() && results.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
                  <Search size={20} className="mb-2 text-[var(--muted-foreground)]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {t("commandCenter.noResults", "No matching commands")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!mariSurface && !idle ? (
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
              onEscalate={() => openProfessorMari()}
            />
          </Suspense>
        ) : null}

        {!mariSurface ? (
          <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-3 text-[0.6875rem] text-[var(--muted-foreground)]">
            {/* The conditional hints group to the left so the two permanent
                hints keep their positions as rows gain and lose shortcuts. */}
            <span className="hidden items-center gap-4 sm:flex">
              <span>{t("commandCenter.keyboard.move", "Arrow keys move")}</span>
              {inlineSuffix ? (
                <span>{t("commandCenter.keyboard.complete", "⇥ Complete")}</span>
              ) : mariEnabled && pane === "results" && activeResult ? (
                <span>{t("commandCenter.keyboard.continueMari", "Ctrl/⌘+Enter Continue with Mari")}</span>
              ) : null}
              {pane === "results" && activeResult && isRichResult(activeResult) ? (
                <span>
                  {expandedPreviewId === activeResult.id
                    ? t("commandCenter.keyboard.closePreview", "← Close preview")
                    : t("commandCenter.keyboard.preview", "→ Preview")}
                </span>
              ) : null}
              {pane === "results" && activeResult ? (
                <span>{t("commandCenter.keyboard.pin", "Cmd/Ctrl+P pin")}</span>
              ) : null}
            </span>
            <span className="flex min-w-0 items-center gap-3">
              {!idle ? (
                <span className="hidden sm:inline">{t("commandCenter.keyboard.escape", "Esc close")}</span>
              ) : null}
              <OmnibarSettingsMenu />
            </span>
          </footer>
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
