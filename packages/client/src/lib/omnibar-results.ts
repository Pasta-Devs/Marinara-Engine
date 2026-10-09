/**
 * The omnibar's result producers. Each function is pure given an explicit input
 * object: no hooks, no store access, no data fetching. The component keeps its
 * `useMemo` wrappers so the memoisation boundaries — and therefore when each
 * list recomputes — are unchanged.
 *
 * `preview` stays a thunk everywhere: it is only invoked for the focused row.
 */
import {
  normalizeTextForMatch,
  type Chat,
  type ChatMode,
  type GlobalChatSearchChat,
  type GlobalChatSearchResult,
  type Lorebook,
  type LorebookEntry,
  type Persona,
} from "@marinara-engine/shared";
import type { AgentConfigRow } from "../hooks/use-agents";
import type { HomeFaqItem } from "../components/chat/HomeFaq";
import { CHOICE_SCORE_PENALTY, buildChoiceOptionResults, readChoiceOptionId } from "./omnibar-choice-rows";
import { frecencyBoost, type OmnibarFrecencyEntry } from "./omnibar-frecency";
import { readNamedRow } from "./omnibar-row-readers";
import { parseChatMetadata } from "./chat-display";
import { countBlockingReviews, isMariReviewWaiting } from "./professor-mari-presentation";
import { deriveActiveLorebookViews, getChatActiveLorebookIds, getChatExcludedLorebookIds } from "./chat-lorebooks";
import { getChatCharacterIds } from "./chat-macros";
import { formatRelativeContact } from "./relative-time";
import { isLanguageGenerationConnection, type ConnectionProviderLike } from "./connection-filters";
import type { DocsCommandSearchPassage } from "./docs-command-search";
import type { OmnibarNamedRow, OmnibarTranslate } from "./omnibar-entity-rows";
import { replyCheckupLabel, replyLineFindings } from "./reply-checkup";
import type { ReplyCheckupFinding } from "@marinara-engine/shared";
import {
  findOmnibarMatchRange,
  getUnambiguousOmnibarResult,
  isOmnibarAddIntent,
  isOmnibarRefinableVerb,
  isOmnibarRemovalIntent,
  parseOmnibarIntent,
  searchOmnibar,
  splitOmnibarAddTarget,
  type OmnibarCategory,
  type OmnibarContext,
  type OmnibarContextReason,
  type OmnibarResult,
  type OmnibarSearchData,
  type OmnibarSurface,
} from "./omnibar-search";
import { getOmnibarSettingsDestinations } from "./omnibar-settings";
import { SETTINGS_SEARCHABLE_CONTROLS, settingsLocationPath } from "./settings-registry";
import { OMNIBAR_SETTINGS_TOGGLE_BINDINGS } from "./omnibar-settings-toggle-bindings";
import type { ChatResourceDragKind } from "./chat-resource-drag";
import { getSlashCompletions } from "./slash-commands";
import { inferProfessorMariCommandCenterCapability } from "./professor-mari-command-center-context";

/** Below this a message search matches most of the transcript. */
export const MIN_MESSAGE_SEARCH_LENGTH = 3;
const MAX_MESSAGE_SEARCH_RESULTS = 6;
const MAX_GLOBAL_MESSAGE_CHATS = 8;
const MAX_GLOBAL_MESSAGE_HITS_PER_CHAT = 2;
/**
 * The context group answers "what am I on?", not "what is in this chat?" — past
 * this many rows it buries recents and create actions. Applied by the idle list
 * rather than the builder, because "remove" reads the same rows and must see
 * every attached thing, not the first eight.
 */
const CHAT_CONTEXT_MAX_RESULTS = 8;
const MAX_SLASH_RESULTS = 8;
/** UX-01: the words that mean "open Professor Mari" on their own. */
const OPEN_MARI_QUERIES: ReadonlySet<string> = new Set([
  "mari",
  "professor",
  "professor mari",
  "ask mari",
  "open mari",
  "assistant",
]);
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the query starts the text or one of its words: "eli" matches "Eliza", not "reliable". */
export function matchesAtWordStart(text: string, query: string): boolean {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(query.trim())}`, "iu").test(text);
}

/** Shorter names ("Theme", "Tea") turn up in ordinary prose, so only distinctive ones count. */
const MIN_MENTIONED_NAME_LENGTH = 6;

/**
 * The rows a quick answer names, in the order it names them, so the answer can
 * lead somewhere: "turn on Streaming speed" offers the Streaming speed setting.
 * Deterministic and local; the model is never asked for ids. Rows with an inline
 * control are skipped, since choosing them does nothing on its own.
 */
export function findMentionedResults<T extends Pick<OmnibarResult, "id" | "title" | "control">>(
  answer: string,
  rows: readonly T[],
  max = 3,
): T[] {
  const text = answer.normalize("NFKC");
  const seenNames = new Set<string>();
  const found: { row: T; at: number }[] = [];
  for (const row of rows) {
    const name = row.title.trim();
    const key = name.toLocaleLowerCase();
    if (row.control || name.length < MIN_MENTIONED_NAME_LENGTH || seenNames.has(key)) continue;
    const match = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "iu").exec(text);
    if (!match) continue;
    // Part of a longer Title Case name ("Advanced" in "Advanced Parameters", "Settings" in "Chat Settings") is a
    // different thing, so it does not count. A capital that only starts a sentence ("Ask Eliza") joins nothing.
    const nameStart = match.index + match[0].length - name.length;
    const joinsNext = /^\**\s\**\p{Lu}/u.test(text.slice(nameStart + name.length));
    const head = text.slice(0, nameStart);
    const previousWord = /\p{Lu}[\p{L}\p{N}]*\**\s\**$/u.exec(head);
    const joinsPrevious = previousWord !== null && !/(^|[.!?:\n])[\s*]*$/u.test(head.slice(0, previousWord.index));
    if (joinsNext || joinsPrevious) continue;
    seenNames.add(key);
    found.push({ row, at: match.index });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map((item) => item.row);
}

/** A one-line excerpt centred on the match, so the row shows why it matched. */
function getMessageSearchSnippet(content: string, query: string): string {
  const text = content.replace(/\s+/gu, " ").trim();
  if (text.length <= 120) return text;
  const matchIndex = normalizeTextForMatch(text).indexOf(normalizeTextForMatch(query));
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, start + 120);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Re-cuts a server snippet so the first match sits about `before` characters in, cut at a word boundary
 * with a leading "…" (slice 86). A snippet whose match is already that close stays as it is.
 */
export function omnibarExcerptAroundMatch(snippet: string, query: string, before = 24): string {
  const text = snippet.replace(/\s+/gu, " ").trim();
  const needle = query.trim().toLowerCase();
  const index = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (index <= before) return text;
  let start = index - before;
  const space = text.indexOf(" ", start);
  if (space !== -1 && space < index) start = space + 1;
  return `…${text.slice(start)}`;
}

export type OmnibarUserStatus = "active" | "idle" | "dnd" | "invisible";

/** The UI-store setters the settings rows drive, passed in rather than imported. */
export type OmnibarControlSetters = {
  setTheme: (value: "dark" | "light") => void;
  setUserStatusManual: (value: OmnibarUserStatus) => void;
  setReduceAmbientEffects: (value: boolean) => void;
  setMusicPlayerEnabled: (value: boolean) => void;
  setSpeechToTextEnabled: (value: boolean) => void;
  setNotificationSoundsOnlyWhenUnfocused: (value: boolean) => void;
  setShowTimestamps: (value: boolean) => void;
  setShowModelName: (value: boolean) => void;
  setShowTokenUsage: (value: boolean) => void;
};

export type OmnibarControlResultsInput = {
  /** Localizes the settings registry's English copy, as the Settings panel search does. */
  localize: (englishText: string) => string;
  /**
   * Current value of every `OMNIBAR_SETTINGS_TOGGLE_BINDINGS` id, read via a
   * reactive store subscription by the caller so a flip re-renders the row.
   * `buildOmnibarControlResults` itself stays a pure function with no store
   * access of its own.
   */
  settingsToggleValues: Readonly<Record<string, boolean>>;
  musicPlayerEnabled: boolean;
  notificationSoundsOnlyWhenUnfocused: boolean;
  reduceAmbientEffects: boolean;
  setters: OmnibarControlSetters;
  showModelName: boolean;
  showTimestamps: boolean;
  showTokenUsage: boolean;
  speechToTextEnabled: boolean;
  t: OmnibarTranslate;
  theme: string;
  userStatus: OmnibarUserStatus;
};

export type OmnibarChatControlResultsInput = {
  activeChat: Chat | null | undefined;
  activeChatId: string | null | undefined;
  connections: readonly (ConnectionProviderLike & { id: string; name: string })[];
  patchChat: (input: {
    id: string;
    connectionId?: string | null;
    promptPresetId?: string | null;
    personaId?: string | null;
  }) => unknown;
  patchChatMetadata: (input: { id: string; enableAgents: boolean }) => unknown;
  resources: readonly { kind: string; id: string; name: string }[];
  t: OmnibarTranslate;
};

export type OmnibarSearchResultsInput = {
  chatControls: readonly OmnibarResult[];
  contextLabels: Partial<Record<OmnibarContextReason, string>>;
  controls: readonly OmnibarResult[];
  data: OmnibarSearchData;
  deferredQuery: string;
  /** Exact message/lorebook-entry hits found elsewhere, so a direct hit outranks the Mari fallback (F1). */
  directHitCount?: number;
  docsResults: readonly DocsCommandSearchPassage[];
  faqItems: readonly HomeFaqItem[];
  /** O2: local frecency entries for this surface's boost; omitted or empty means no boost applies. */
  frecencyEntries?: readonly OmnibarFrecencyEntry[];
  /** Passed in so this module never pulls the FAQ component into its graph. */
  getFaqSearchText: (item: HomeFaqItem, localize: (englishText: string) => string) => string;
  localize: (englishText: string) => string;
  mariEnabled: boolean;
  /**
   * R6 (slice 65): false when no language connection and no local model exist (a fresh install).
   * Mari cannot answer then, so her row is only promoted on a dead end, never above docs or FAQ rows.
   */
  mariHasModel?: boolean;
  /** Clock for the frecency boost's recency decay; defaults to Date.now(). */
  now?: number;
  omnibarContext: OmnibarContext;
  t: OmnibarTranslate;
};

export type OmnibarMariChatResultsInput = {
  deferredQuery: string;
  mariChats: readonly { id: string; name?: string | null }[];
  t: OmnibarTranslate;
};

export type OmnibarMessageResultsInput = {
  activeChatId: string | null | undefined;
  messageSearchIndex: readonly { message: { content: string }; haystack: string | null }[];
  messageSearchQuery: string;
  t: OmnibarTranslate;
};

export type OmnibarGlobalMessageResultsInput = {
  activeChatId: string | null;
  /** Chats with matches (`perChat` search), newest activity first. */
  chats: readonly GlobalChatSearchChat[];
  hits: readonly GlobalChatSearchResult[];
  messageSearchQuery: string;
  t: OmnibarTranslate;
};

export type OmnibarSlashResultsInput = {
  activeChatId: string | null | undefined;
  deferredQuery: string;
  slashAvailability: Parameters<typeof getSlashCompletions>[1];
  surface: OmnibarSurface;
};

export type OmnibarContextResultsInput = {
  activeChat: Chat | null | undefined;
  activeChatId: string | null | undefined;
  activeEditorField: { label: string } | null | undefined;
  agents: readonly AgentConfigRow[] | undefined;
  allLocalResults: readonly OmnibarResult[];
  characterNameById: ReadonlyMap<string, string>;
  connectionById: ReadonlyMap<string, OmnibarNamedRow>;
  lastAppError:
    | {
        message: string;
        action?: string;
        retry?: { kind: "open-connection"; id: string } | { kind: "open-agent"; id: string } | null;
      }
    | null
    | undefined;
  lorebooks: Lorebook[] | undefined;
  mariEnabled: boolean;
  omnibarSuggestionsEnabled: boolean;
  openAgentId: string | null | undefined;
  openCharacterId: string | null | undefined;
  openConnectionId: string | null | undefined;
  openLorebookId: string | null | undefined;
  openPersonaId: string | null | undefined;
  openPresetId: string | null | undefined;
  personaById: ReadonlyMap<string, Persona>;
  personas: readonly unknown[] | undefined;
  presets: readonly unknown[] | undefined;
  surface: OmnibarSurface;
  t: OmnibarTranslate;
  /** R2: the reply checkup of the active chat's newest reply, when that reply is loaded. */
  lastReplyFindings?: readonly ReplyCheckupFinding[];
};

export type OmnibarVerbSuggestionsInput = {
  /** Every locally known row, used to answer "enable" and "create" directly. */
  allLocalResults: readonly OmnibarResult[];
  deferredQuery: string;
};

export type OmnibarAddSuggestionsInput = {
  activeChat: Chat | null | undefined;
  /** Result ids already attached to the open chat, so nothing is offered twice. */
  attachedResultIds: ReadonlySet<string>;
  /** Every chat, most-recent-first: resolves "add X to Y" and lists recents when Y is unnamed or ambiguous. */
  chats?: readonly OmnibarNamedRow[];
  deferredQuery: string;
  omnibarSuggestionsEnabled: boolean;
  searchResults: readonly OmnibarResult[];
  t: OmnibarTranslate;
};

export type OmnibarRemovalSuggestionsInput = {
  activeChat: Chat | null | undefined;
  /** Result ids currently attached to the open chat. */
  attachedResultIds: ReadonlySet<string>;
  /** The already-derived rows for the open chat, which is where the names come from. */
  contextResults: readonly OmnibarResult[];
  deferredQuery: string;
  omnibarSuggestionsEnabled: boolean;
  t: OmnibarTranslate;
};

export type OmnibarContinueResultInput = {
  mariEnabled: boolean;
  t: OmnibarTranslate;
  workspaceStatus:
    { active?: boolean; pendingApprovals: readonly Parameters<typeof isMariReviewWaiting>[0][] } | undefined;
  /** A task the user handed to Mari that she has since finished. */
  mariFinished?: boolean;
};

export function buildOmnibarControlResults({
  localize,
  musicPlayerEnabled,
  notificationSoundsOnlyWhenUnfocused,
  reduceAmbientEffects,
  settingsToggleValues,
  setters,
  showModelName,
  showTimestamps,
  showTokenUsage,
  speechToTextEnabled,
  t,
  theme,
  userStatus,
}: OmnibarControlResultsInput): OmnibarResult[] {
  // Each row's settings-registry control id, so it can show "Tab › Section" the
  // same way a settingsDestinations row does (G5) — null where the toggle (ambient
  // effects) has no registry entry to point at yet.
  const toggleRows = [
    [
      "reduceAmbientEffects",
      "commandCenter.controls.reducedEffects",
      "Reduced effects",
      reduceAmbientEffects,
      setters.setReduceAmbientEffects,
      null,
    ],
    [
      "musicPlayerEnabled",
      "commandCenter.controls.musicPlayer",
      "Music player",
      musicPlayerEnabled,
      setters.setMusicPlayerEnabled,
      "music-player",
    ],
    [
      "speechToTextEnabled",
      "commandCenter.controls.speechToText",
      "Speech to text",
      speechToTextEnabled,
      setters.setSpeechToTextEnabled,
      "speech-to-text",
    ],
    [
      "notificationSoundsOnlyWhenUnfocused",
      "commandCenter.controls.unfocusedSounds",
      "Sounds only when unfocused",
      notificationSoundsOnlyWhenUnfocused,
      setters.setNotificationSoundsOnlyWhenUnfocused,
      "notification-unfocused-only",
    ],
    [
      "showTimestamps",
      "commandCenter.controls.timestamps",
      "Timestamps",
      showTimestamps,
      setters.setShowTimestamps,
      "show-message-timestamps",
    ],
    [
      "showModelName",
      "commandCenter.controls.modelName",
      "Model name",
      showModelName,
      setters.setShowModelName,
      "show-model-name",
    ],
    [
      "showTokenUsage",
      "commandCenter.controls.tokenUsage",
      "Token usage",
      showTokenUsage,
      setters.setShowTokenUsage,
      "show-token-usage",
    ],
  ] as const satisfies readonly (readonly [string, string, string, boolean, (value: boolean) => void, string | null])[];
  const settingsDestinations = getOmnibarSettingsDestinations().map((setting) => {
    const binding = setting.controlId ? OMNIBAR_SETTINGS_TOGGLE_BINDINGS[setting.controlId] : undefined;
    const title = localize(setting.title);
    return {
      id: setting.id,
      title,
      category: "settings" as const,
      // A named control outranks the section and tab rows that contain it.
      score: setting.controlId ? 165 : setting.sectionId ? 160 : 155,
      aliases: setting.aliases.map(localize),
      keywords: setting.keywords?.map(localize),
      target: {
        kind: "settings" as const,
        tab: setting.tab,
        controlId: setting.controlId,
        sectionId: setting.sectionId,
      },
      // A control's row shows the full Tab › Section path, since neither is its own
      // title. A section row's title already names the section, so it keeps the
      // one-level "sectionLabel" the registry gives it (the parent tab) instead of
      // repeating itself; same for a bare tab row.
      // A description that only repeats the title ("Theme" under Theme) is left out.
      description: (() => {
        const path =
          (setting.controlId && setting.sectionId ? settingsLocationPath(setting.sectionId, localize) : null) ??
          localize(setting.sectionLabel);
        const explanation = localize(setting.description);
        return explanation === title ? path : `${path} · ${explanation}`;
      })(),
      kind: "settings" as const,
      icon: "settings" as const,
      // Bound toggles flip in place instead of only navigating to the tab (K5).
      control: binding
        ? {
            type: "toggle" as const,
            label: title,
            value: settingsToggleValues[setting.controlId as string] ?? false,
            onChange: (next: string | boolean) => binding.set(next === true),
          }
        : undefined,
    };
  });
  return [
    ...settingsDestinations,
    {
      id: "control:theme",
      title: t("commandCenter.controls.theme", "Theme"),
      category: "settings",
      score: 180,
      control: {
        type: "choice",
        label: t("commandCenter.controls.theme", "Theme"),
        value: theme,
        options: [
          {
            value: "dark",
            label: t("commandCenter.values.dark", "Dark"),
            aliases: ["dark mode", "dark theme", "night mode"],
          },
          {
            value: "light",
            label: t("commandCenter.values.light", "Light"),
            aliases: ["light mode", "light theme", "day mode"],
          },
        ],
        onChange: (value) => setters.setTheme(String(value) as "dark" | "light"),
      },
    },
    {
      id: "control:presence",
      title: t("commandCenter.controls.presence", "Presence"),
      category: "settings",
      score: 175,
      control: {
        type: "choice",
        label: t("commandCenter.controls.presence", "Presence"),
        value: userStatus,
        options: (["active", "idle", "dnd", "invisible"] as const).map((value) => ({
          value,
          label: t(`commandCenter.presence.${value}`, value),
        })),
        onChange: (value) => setters.setUserStatusManual(String(value) as typeof userStatus),
      },
    },
    ...toggleRows.map(([id, key, fallback, value, onChange, controlId]) => {
      const sectionId = controlId
        ? SETTINGS_SEARCHABLE_CONTROLS.find((control) => control.id === controlId)?.sectionId
        : undefined;
      return {
        id: `control:${id}`,
        title: t(key, fallback),
        category: "settings" as const,
        score: 170,
        description: (sectionId ? settingsLocationPath(sectionId, localize) : null) ?? undefined,
        control: {
          type: "toggle" as const,
          label: t(key, fallback),
          value,
          onChange: (nextValue: string | boolean) => onChange(nextValue === true),
        },
      };
    }),
  ];
}

export function buildOmnibarChatControlResults({
  activeChat,
  activeChatId,
  connections,
  patchChat,
  patchChatMetadata,
  resources,
  t,
}: OmnibarChatControlResultsInput): OmnibarResult[] {
  if (!activeChat || activeChat.id !== activeChatId) return [];
  const chatId = activeChat.id;
  // ponytail: the segmented control renders every option as a pill, so a long
  // list would overflow the row. Cap it, and keep the current value visible.
  // Swap in a searchable picker if users hit the cap often.
  const capped = <T extends { id: string }>(items: readonly T[], activeId: string | null | undefined) => {
    const head = items.slice(0, 6);
    const active = activeId ? items.find((item) => item.id === activeId) : undefined;
    return active && !head.includes(active) ? [...head, active] : head;
  };
  const noneOption = { value: "", label: t("commandCenter.values.none", "None") };
  const chatMetadata = parseChatMetadata(activeChat.metadata);
  const languageConnections = connections.filter(isLanguageGenerationConnection);
  const resourcesOfKind = (kind: OmnibarCategory) =>
    resources.filter((resource) => resource.kind === kind).map(({ id, name }) => ({ id, name }));
  const chatPresets = resourcesOfKind("preset");
  const chatPersonas = resourcesOfKind("persona");
  const rows: OmnibarResult[] = [];
  if (languageConnections.length > 1) {
    rows.push({
      id: "control:chat-connection",
      title: t("commandCenter.controls.chatModel", "Model for this chat"),
      category: "connection",
      score: 190,
      aliases: ["model", "connection", "switch model", "provider"],
      group: "current-work",
      icon: "connection",
      control: {
        type: "choice",
        label: t("commandCenter.controls.chatModel", "Model for this chat"),
        value: activeChat.connectionId ?? "",
        options: capped(languageConnections, activeChat.connectionId).map((connection) => ({
          value: connection.id,
          label: connection.name,
        })),
        onChange: (value) => void patchChat({ id: chatId, connectionId: String(value) || null }),
      },
    });
  }
  if (chatPresets.length > 0) {
    rows.push({
      id: "control:chat-preset",
      title: t("commandCenter.controls.chatPreset", "Preset for this chat"),
      category: "preset",
      score: 189,
      aliases: ["preset", "prompt preset", "switch preset"],
      group: "current-work",
      icon: "preset",
      control: {
        type: "choice",
        label: t("commandCenter.controls.chatPreset", "Preset for this chat"),
        value: activeChat.promptPresetId ?? "",
        options: [
          noneOption,
          ...capped(chatPresets, activeChat.promptPresetId).map((preset) => ({
            value: preset.id,
            label: preset.name,
          })),
        ],
        onChange: (value) => void patchChat({ id: chatId, promptPresetId: String(value) || null }),
      },
    });
  }
  if (chatPersonas.length > 0) {
    rows.push({
      id: "control:chat-persona",
      title: t("commandCenter.controls.chatPersona", "Persona for this chat"),
      category: "persona",
      score: 188,
      aliases: ["persona", "swap persona", "who am i"],
      group: "current-work",
      icon: "persona",
      control: {
        type: "choice",
        label: t("commandCenter.controls.chatPersona", "Persona for this chat"),
        value: activeChat.personaId ?? "",
        options: [
          noneOption,
          ...capped(chatPersonas, activeChat.personaId).map((persona) => ({
            value: persona.id,
            label: persona.name,
          })),
        ],
        onChange: (value) => void patchChat({ id: chatId, personaId: String(value) || null }),
      },
    });
  }
  rows.push({
    id: "control:chat-agents",
    title: t("commandCenter.controls.chatAgents", "Agents in this chat"),
    category: "agent",
    score: 187,
    aliases: ["agents", "tools", "enable agents"],
    group: "current-work",
    icon: "agent",
    control: {
      type: "toggle",
      label: t("commandCenter.controls.chatAgents", "Agents in this chat"),
      value: chatMetadata.enableAgents === true,
      onChange: (value) => void patchChatMetadata({ id: chatId, enableAgents: value === true }),
    },
  });
  return rows;
}

/**
 * R6 (slice 65): the empty list without the chat's own model, preset and persona rows. They only
 * repeated the composer's switchers, which win (value table tasks 3 and 11). Typing still finds them,
 * and "remove …" still reads them from the full context rows. A Fix row on that connection stays.
 */
export function idleOmnibarContextResults(
  contextResults: readonly OmnibarResult[],
  activeChat: Pick<Chat, "connectionId" | "promptPresetId" | "personaId"> | null,
  fixRowId: string | null,
): OmnibarResult[] {
  const composerRowIds = new Set(
    activeChat
      ? [
          `connection:${activeChat.connectionId}`,
          `preset:${activeChat.promptPresetId}`,
          `persona:${activeChat.personaId}`,
        ]
      : [],
  );
  return contextResults
    .filter((result) => result.id === fixRowId || (!composerRowIds.has(result.id) && !result.idleHidden))
    .slice(0, CHAT_CONTEXT_MAX_RESULTS);
}

export function buildOmnibarSearchResults({
  chatControls,
  contextLabels,
  controls,
  data,
  deferredQuery,
  directHitCount,
  docsResults,
  faqItems,
  frecencyEntries = [],
  getFaqSearchText,
  localize,
  mariEnabled,
  mariHasModel = true,
  now = Date.now(),
  omnibarContext,
  t,
}: OmnibarSearchResultsInput): OmnibarResult[] {
  const query = deferredQuery;
  const normalizedQuery = query.trim().toLowerCase();
  // Matched at the start of a word: a bare substring let "eli" find every FAQ
  // whose answer says "reliable", which buried the character the user typed.
  const faqResults =
    normalizedQuery.length < 2
      ? []
      : faqItems.flatMap((item) => {
          const searchText = getFaqSearchText(item, localize);
          if (!matchesAtWordStart(searchText, normalizedQuery)) return [];
          const question = `${item.question} ${localize(item.question)}`.toLowerCase();
          // F8: a FAQ that only matches in its answer text is a weaker signal than any docs row that
          // matched by its own title (score 200) — it should not preselect over a real docs title hit.
          const score = matchesAtWordStart(question, normalizedQuery) ? 230 : 90;
          return [
            {
              id: `faq:${item.id}`,
              title: localize(item.question),
              category: "docs" as const,
              action: { kind: "open-faq", itemId: item.id } as const,
              score,
              description: localize(item.answer),
              preview: () => ({
                kind: "docs" as const,
                title: localize(item.question),
                categoryLabel: t("omnibar.faq", "FAQ"),
                description: localize(item.answer),
                steps: (item.bullets ?? []).slice(0, 3).map((bullet) => localize(bullet)),
              }),
              kind: "resource" as const,
              icon: "documentation" as const,
            } satisfies OmnibarResult,
          ];
        });
  // Professor Mari blur: the fallback row speaks the query's intent, and is
  // promoted above search hits when the query reads like a question or nothing
  // matched well. Its preview "peeks" what Mari will do before you commit.
  const trimmedQuery = query.trim();
  const capability = inferProfessorMariCommandCenterCapability(trimmedQuery);
  const intent = parseOmnibarIntent(trimmedQuery);
  const askPeeks: Partial<Record<typeof capability, string>> = {
    repair: t("omnibar.askMari.peek.repair", "Professor Mari finds the problem and helps you fix it."),
    recommend: t("omnibar.askMari.peek.recommend", "Professor Mari compares the options and recommends one."),
    create: t("omnibar.askMari.peek.create", "Professor Mari helps you create this."),
    edit: t("omnibar.askMari.peek.change", "Open Professor Mari to check or change this."),
  };
  // The row names what it will send (R8); the line under it says what she will do.
  const askTitle = trimmedQuery
    ? t("omnibar.askMari.withQuery", "Ask Prof. Mari: “{{query}}”", { query: trimmedQuery })
    : t("omnibar.askProfessorMari", "Ask Professor Mari");
  const askPeek =
    askPeeks[capability] ?? t("omnibar.askMari.peek.explain", "Professor Mari explains this and suggests a next step.");
  // R40: with a query typed, a choice control's options join the searchable set,
  // so "gpt" reaches "Use GPT-4 for this chat" without finding the Model row and
  // drilling into it. They stay out of the idle deck, which would otherwise gain
  // six rows per control before the user has asked for anything.
  const controlChoices = trimmedQuery
    ? [...controls, ...chatControls].flatMap((control) => buildChoiceOptionResults(control))
    : [];
  // F8 (O5): Mari's promotion and "unambiguous direct hit" must never turn on a
  // frecency boost - "never moves Mari's row" means never decides it either.
  // bestMatchScore/directResult/clearDirect are computed from the pre-boost
  // scores below; the boost is applied only afterwards, to final ordering.
  // UX-01: typing her name opens her, as Ctrl+J does. Without this row "mari" only found settings rows.
  const openMariRows: OmnibarResult[] =
    mariEnabled && OPEN_MARI_QUERIES.has(normalizeTextForMatch(trimmedQuery))
      ? [
          {
            id: "open-professor-mari",
            title: t("commandCenter.openMari", "Open Prof. Mari"),
            category: "professor",
            // The presenter otherwise picks a Top hit by title prefix ("Mari changed…", "Ask Professor Mari from Search").
            group: "top-hit",
            score: 1000,
            kind: "action",
            icon: "professor",
          },
        ]
      : [];
  const preBoostResults = [
    ...openMariRows,
    ...searchOmnibar(query, {
      ...data,
      controls: [...controls, ...chatControls, ...controlChoices],
      context: omnibarContext,
      contextLabels,
    }),
  ]
    .filter((result) => mariEnabled || result.id !== "ask-professor-mari")
    // A control's values were never part of the set this ranking was tuned on.
    // Damp them so they surface on a deliberate "gpt" and never crowd a real hit.
    .map((result) =>
      readChoiceOptionId(result.id) ? { ...result, score: result.score - CHOICE_SCORE_PENALTY } : result,
    )
    .sort((a, b) => b.score - a.score);
  const bestMatchScore = preBoostResults.reduce(
    (best, result) => (result.id === "ask-professor-mari" ? best : Math.max(best, result.score)),
    -1,
  );
  const directResult = getUnambiguousOmnibarResult(preBoostResults);
  // O2: a small, capped nudge from past uses on this surface, applied only to
  // the final display order. Never applied to Mari's row (frecencyBoost returns
  // 0 for it) and never enough on its own to outrank an exact name match — see
  // FRECENCY_BOOST_CAP.
  const baseResults = preBoostResults
    .map((result) => {
      const boost = frecencyBoost(frecencyEntries, result.id, omnibarContext.surface, now);
      return boost > 0 ? { ...result, score: result.score + boost } : result;
    })
    .sort((a, b) => b.score - a.score);
  const directIntent = intent?.kind === "navigate" || intent?.kind === "action" || intent?.kind === "create";
  const directSetup =
    intent?.kind === "repair" &&
    directResult?.availability &&
    typeof directResult.availability === "object" &&
    directResult.availability.setupTarget;
  const clearDirect = Boolean(directResult && directResult.score >= 250 && (directIntent || directSetup));
  const deadEnd = bestMatchScore < 150 && !directHitCount;
  const promoteMari =
    !clearDirect &&
    // Without a model the docs and FAQ rows are the answer (R6): a question alone no longer promotes her.
    (mariHasModel || (deadEnd && faqResults.length === 0)) &&
    (intent?.kind === "explain" ||
      intent?.kind === "recommend" ||
      intent?.kind === "repair" ||
      /\?\s*$|^\s*(?:who|what|where|which|when|can|could|should|would|is|are|do|does|did|help|tell)\b/i.test(
        trimmedQuery,
      ) ||
      deadEnd);
  const askResults = baseResults.map((result) =>
    result.id === "ask-professor-mari"
      ? {
          ...result,
          title: askTitle,
          description: askPeek,
          group: promoteMari ? ("professor-suggested" as const) : result.group,
          score: promoteMari ? 500 : result.score,
          preview: () => ({
            kind: "docs" as const,
            title: askTitle,
            categoryLabel: t("omnibar.askProfessorMari", "Ask Professor Mari"),
            description: askPeek,
            facts: trimmedQuery
              ? [{ label: t("omnibar.askMari.peek.searchLabel", "Your search"), value: trimmedQuery }]
              : [],
          }),
        }
      : result,
  );
  return [
    ...askResults,
    ...faqResults,
    ...docsResults
      // A short single word matches inside other words ("eli" in "reliable"), so
      // it needs a word start in the passage; longer queries keep the search's own ranking.
      .filter(
        (result) =>
          normalizedQuery.length >= 5 ||
          /\s/.test(normalizedQuery) ||
          matchesAtWordStart(`${result.title} ${result.snippet}`, normalizedQuery),
      )
      .map((result) => ({
        ...result,
        // The matched passage is the reason this page is listed, so it is the row's line 2.
        description: result.snippet,
        category: "docs" as const,
        action: { kind: "open-docs", path: result.path } as const,
        preview: () => ({
          kind: "docs" as const,
          title: result.title,
          categoryLabel: result.source,
          description: result.snippet,
          // `source` is the path again for a passage, and the snippet is the description.
          facts: [
            ...(result.path ? [{ label: t("commandCenter.preview.source", "Source"), value: result.path }] : []),
            ...(result.line ? [{ label: t("commandCenter.preview.line", "Line"), value: result.line }] : []),
          ],
        }),
        target: { kind: "window", window: "documentation" } as const,
        kind: "resource" as const,
        icon: "documentation" as const,
      })),
  ];
}

export function buildOmnibarMariChatResults({
  deferredQuery,
  mariChats,
  t,
}: OmnibarMariChatResultsInput): OmnibarResult[] {
  const normalized = normalizeTextForMatch(deferredQuery.trim());
  if (!normalized) return [];
  return mariChats
    .filter((chat) => normalizeTextForMatch(chat.name ?? "").includes(normalized))
    .slice(0, 5)
    .map((chat) => ({
      id: `mari-chat:${chat.id}`,
      action: { kind: "open-mari-chat", chatId: chat.id } as const,
      title: chat.name || t("omnibar.categories.professor", "Professor Mari"),
      description: t("commandCenter.mariChat", "Professor Mari conversation"),
      category: "chat" as const,
      group: "chats" as const,
      score: 120,
      kind: "action" as const,
      icon: "professor" as const,
    }));
}

export function buildOmnibarMessageResults({
  activeChatId,
  messageSearchIndex,
  messageSearchQuery,
  t,
}: OmnibarMessageResultsInput): OmnibarResult[] {
  const normalized = normalizeTextForMatch(messageSearchQuery);
  if (!activeChatId || normalized.length < MIN_MESSAGE_SEARCH_LENGTH) return [];
  const out: OmnibarResult[] = [];
  for (let index = 0; index < messageSearchIndex.length; index += 1) {
    if (out.length >= MAX_MESSAGE_SEARCH_RESULTS) break;
    const { message, haystack } = messageSearchIndex[index]!;
    if (haystack === null || !haystack.includes(normalized)) continue;
    out.push({
      id: `message:${activeChatId}:${index + 1}`,
      action: { kind: "goto-message", chatId: activeChatId, messageNumber: index + 1 },
      title: getMessageSearchSnippet(message.content, messageSearchQuery),
      description: t("commandCenter.messages.position", "Message {{number}}", { number: index + 1 }),
      category: "chat",
      group: "messages",
      score: 300 - out.length,
      kind: "action",
      icon: "chats",
    });
  }
  return out;
}

/**
 * Other chats' hits, grouped under their chat: a chat row with its match count and cast, then
 * up to two hit lines (speaker and excerpt), then "N more" when the chat has more. Ids of the
 * hit lines match the active-chat shape, so the omnibar's id de-duplication keeps one row.
 */
export function buildOmnibarGlobalMessageResults({
  activeChatId,
  chats,
  hits,
  messageSearchQuery,
  t,
}: OmnibarGlobalMessageResultsInput): OmnibarResult[] {
  const query = messageSearchQuery.trim();
  if (query.length < MIN_MESSAGE_SEARCH_LENGTH) return [];
  // A bare command word ("new", "remove") matches most chats in passing, so it keeps one chat's two lines.
  const chatLimit = isOmnibarRefinableVerb(query) ? 1 : MAX_GLOBAL_MESSAGE_CHATS;
  const groups = chats.filter((chat) => chat.chatId !== activeChatId).slice(0, chatLimit);
  const rows: OmnibarResult[] = [];
  let shownHits = 0;
  let totalMatches = 0;
  for (const chat of chats) if (chat.chatId !== activeChatId) totalMatches += chat.matches;
  for (const chat of groups) {
    const chatRowId = `message-chat:${chat.chatId}`;
    const chatHits = hits.filter((hit) => hit.chatId === chat.chatId).slice(0, MAX_GLOBAL_MESSAGE_HITS_PER_CHAT);
    rows.push({
      id: chatRowId,
      title: chat.chatName,
      description: chat.cast.length
        ? t("commandCenter.messages.withCast", "with {{cast}}", { cast: chat.cast.join(", ") })
        : undefined,
      category: "chat",
      group: "messages",
      score: 300 - rows.length,
      kind: "chat",
      icon: "chats",
      target: { kind: "chat", chatId: chat.chatId },
      meta: t("commandCenter.messages.chatMatches", "{{count}} matches", { count: chat.matches }),
    });
    for (const hit of chatHits) {
      shownHits += 1;
      rows.push({
        id: `message:${hit.chatId}:${hit.messageNumber}`,
        parentId: chatRowId,
        action: { kind: "goto-message", chatId: hit.chatId, messageNumber: hit.messageNumber },
        title: hit.speaker ?? t("home.recentChats.you", "You"),
        description: omnibarExcerptAroundMatch(hit.snippet, query),
        meta: formatRelativeContact(hit.createdAt) ?? undefined,
        category: "chat",
        group: "messages",
        score: 300 - rows.length,
        kind: "action",
        icon: "chats",
      });
    }
    const moreInChat = chat.matches - chatHits.length;
    if (moreInChat > 0) {
      rows.push({
        id: `message-more:${chat.chatId}`,
        parentId: chatRowId,
        action: { kind: "open-global-search", query },
        title: t("commandCenter.messages.moreInChat", "{{count}} more in {{chat}}", {
          count: moreInChat,
          chat: chat.chatName,
        }),
        category: "chat",
        group: "messages",
        score: 300 - rows.length,
        kind: "action",
        icon: "chats",
      });
    }
  }
  // The rows above are a sample; the full list, with filters, is Search All Chats.
  if (totalMatches > shownHits) {
    rows.push({
      id: "global-search:see-all",
      action: { kind: "open-global-search", query },
      title: t("commandCenter.messages.seeAllCount", "See all {{count}} matches", { count: totalMatches }),
      description: t("commandCenter.messages.seeAllDescription", "Opens the Search all chats window, with filters."),
      category: "chat",
      group: "messages",
      score: 300 - rows.length,
      kind: "action",
      icon: "chats",
    });
  }
  return rows;
}

/**
 * Lorebook entries whose name, keys or content contain the query: the lore
 * itself, not only the books. A server read, so these rows come last.
 */
export function buildOmnibarLorebookEntryResults({
  entries,
  lorebookNameById,
  query,
  t,
}: {
  entries: readonly LorebookEntry[];
  lorebookNameById: ReadonlyMap<string, string>;
  query: string;
  t: OmnibarTranslate;
}): OmnibarResult[] {
  if (query.trim().length < MIN_MESSAGE_SEARCH_LENGTH) return [];
  return entries.map((entry, index) => {
    const book = lorebookNameById.get(entry.lorebookId) ?? t("commandCenter.entries.unknownBook", "Lorebook");
    // Line 3 only when the entry's text is what matched, not its name or keys.
    const excerpt = normalizeTextForMatch(entry.content).includes(normalizeTextForMatch(query))
      ? getMessageSearchSnippet(entry.content, query)
      : undefined;
    return {
      id: `lorebook-entry:${entry.lorebookId}:${entry.id}`,
      action: { kind: "open-lorebook-entry" as const, lorebookId: entry.lorebookId, entryId: entry.id },
      title: entry.name.trim() || entry.keys.join(", ") || t("commandCenter.entries.untitled", "Untitled entry"),
      description: entry.keys.length
        ? t("commandCenter.entries.keys", "Keys: {{keys}}", { keys: entry.keys.join(", ") })
        : undefined,
      meta: book,
      excerpt,
      excerptMatch: excerpt ? findOmnibarMatchRange(query, excerpt) : null,
      category: "lorebook" as const,
      group: "lorebook-entries" as const,
      score: 270 - index,
      kind: "resource" as const,
      icon: "lorebook" as const,
    };
  });
}

const CREATE_NAMED_PATTERN =
  /^\s*(?:create|new|make)\s+(?:an?\s+)?(character|card|persona|lorebook|world\s*book|preset)\s+(?:named\s+|called\s+)?(.+?)\s*$/i;
const CREATE_NAMED_MODAL: Record<string, "create-character" | "create-persona" | "create-lorebook" | "create-preset"> =
  {
    character: "create-character",
    card: "create-character",
    persona: "create-persona",
    lorebook: "create-lorebook",
    worldbook: "create-lorebook",
    preset: "create-preset",
  };
const START_CHAT_PATTERN =
  /^\s*(?:(?:start|new|open)\s+(?:an?\s+)?chat\s+(?:with\s+)?|chat\s+with\s+|talk\s+(?:to|with)\s+|roleplay\s+with\s+)(.+?)\s*$/i;
const MAX_START_CHAT_ROWS = 3;

/**
 * Rows for two everyday sentences the name search cannot answer: "new character
 * Bob" opens the create window with Bob filled in (casing kept), and "chat with
 * Shrek" / "new chat Dottore" starts a chat with a matching character. Both use
 * the app's existing windows; nothing is created from here.
 */
export function buildOmnibarIntentShortcuts({
  query,
  characters,
  t,
}: {
  query: string;
  characters: readonly { id: string; name: string }[];
  t: OmnibarTranslate;
}): OmnibarResult[] {
  const created = CREATE_NAMED_PATTERN.exec(query);
  if (created) {
    const kind = created[1]!.toLowerCase().replace(/\s+/g, "");
    const modal = CREATE_NAMED_MODAL[kind];
    const name = created[2]!.trim();
    if (!modal || !name) return [];
    const kindWord = modal.replace("create-", "");
    const kindLabel = t(`commandCenter.shortcuts.kind.${kindWord}`, kindWord);
    return [
      {
        id: `shortcut:${modal}`,
        action: { kind: "create-named", modal, name },
        title: t("commandCenter.shortcuts.createNamed", "Create {{kind}} “{{name}}”", { kind: kindLabel, name }),
        description: t(
          "commandCenter.shortcuts.createNamedDescription",
          "Opens the create window with the name filled in.",
        ),
        category: "navigation",
        group: "current-work",
        score: 600,
        kind: "action",
        icon:
          modal === "create-lorebook"
            ? "lorebook"
            : modal === "create-persona"
              ? "persona"
              : modal === "create-preset"
                ? "preset"
                : "character",
      },
    ];
  }
  const chat = START_CHAT_PATTERN.exec(query);
  const target = chat?.[1]?.trim();
  if (!target || target.length < 2) return [];
  return characters
    .filter((character) => matchesAtWordStart(character.name, target))
    .slice(0, MAX_START_CHAT_ROWS)
    .map((character, index) => ({
      id: `shortcut:start-chat:${character.id}`,
      action: { kind: "start-character-chat" as const, characterId: character.id, characterName: character.name },
      title: t("commandCenter.shortcuts.startChat", "Start a chat with {{name}}", { name: character.name }),
      description: t("commandCenter.shortcuts.startChatDescription", "Pick a mode to open the chat."),
      category: "chat" as const,
      group: "current-work" as const,
      score: 600 - index,
      kind: "action" as const,
      icon: "chats" as const,
    }));
}

/**
 * Omnibar doors into the exact same new-chat flow Home's Conversation/
 * Roleplay/Game buttons use (N2): `action.kind: "start-chat"` is handled by
 * the same `useStartNewChatMode` mutation those buttons call, so nothing new
 * runs behind the row. Only returned when the query actually matches: a
 * deliberate phrase ("new chat", "start roleplay", …) scores like the other
 * intent shortcuts (600) so it outranks unrelated `create-*` commands; a bare
 * word ("game", "rp", …) scores low (280) so it never outranks an exact
 * entity name. No row is returned for a query that matches nothing — these
 * rows never show on an empty query (the caller only builds them when the
 * query is non-empty) and must not show on every non-empty query either.
 */
const NEW_CHAT_COMMANDS: readonly {
  mode: ChatMode;
  phraseAliases: readonly string[];
  bareAliases: readonly string[];
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  icon: "chats" | "game-assets";
}[] = [
  {
    mode: "conversation",
    phraseAliases: ["new chat", "new conversation", "start conversation"],
    bareAliases: ["conversation"],
    titleKey: "commandCenter.newChat.conversation",
    titleFallback: "New conversation",
    descriptionKey: "commandCenter.newChat.conversationDescription",
    descriptionFallback: "Starts a conversation, like Home's Conversation button.",
    icon: "chats",
  },
  {
    mode: "roleplay",
    phraseAliases: ["new rp", "new roleplay", "start roleplay"],
    bareAliases: ["rp", "roleplay"],
    titleKey: "commandCenter.newChat.roleplay",
    titleFallback: "New roleplay",
    descriptionKey: "commandCenter.newChat.roleplayDescription",
    descriptionFallback: "Starts a roleplay, like Home's Roleplay button.",
    icon: "chats",
  },
  {
    mode: "game",
    phraseAliases: ["new game", "start game"],
    bareAliases: ["game"],
    titleKey: "commandCenter.newChat.game",
    titleFallback: "New game",
    descriptionKey: "commandCenter.newChat.gameDescription",
    descriptionFallback: "Starts a game, like Home's Game button.",
    icon: "game-assets",
  },
];

export function buildOmnibarNewChatCommands({ query, t }: { query: string; t: OmnibarTranslate }): OmnibarResult[] {
  const normalizedQuery = normalizeTextForMatch(query.trim());
  if (!normalizedQuery) return [];
  const results: OmnibarResult[] = [];
  for (const {
    mode,
    phraseAliases,
    bareAliases,
    titleKey,
    titleFallback,
    descriptionKey,
    descriptionFallback,
    icon,
  } of NEW_CHAT_COMMANDS) {
    const normalizedPhraseAliases = phraseAliases.map((alias) => normalizeTextForMatch(alias));
    const normalizedBareAliases = bareAliases.map((alias) => normalizeTextForMatch(alias));
    const exactPhraseMatch = normalizedPhraseAliases.includes(normalizedQuery);
    const exactBareMatch = !exactPhraseMatch && normalizedBareAliases.includes(normalizedQuery);
    const partialMatch =
      !exactPhraseMatch &&
      !exactBareMatch &&
      normalizedQuery.length >= 2 &&
      [...normalizedPhraseAliases, ...normalizedBareAliases].some((alias) => alias.startsWith(normalizedQuery));
    const score = exactPhraseMatch ? 600 : exactBareMatch ? 280 : partialMatch ? 250 : 0;
    if (score <= 0) continue;
    results.push({
      id: `create-${mode === "conversation" ? "conversation" : mode}`,
      action: { kind: "start-chat" as const, mode },
      title: t(titleKey, titleFallback),
      description: t(descriptionKey, descriptionFallback),
      category: "chat" as const,
      aliases: [...phraseAliases, ...bareAliases],
      score,
      kind: "action" as const,
      icon,
    });
  }
  return results;
}

export function buildOmnibarSlashResults({
  activeChatId,
  deferredQuery,
  slashAvailability,
  surface,
}: OmnibarSlashResultsInput): OmnibarResult[] {
  if (!activeChatId || surface !== "chat") return [];
  const typed = deferredQuery.trim();
  // Slice 78: only on "/"; the empty list no longer suggests slash commands.
  const commands = typed.startsWith("/") ? getSlashCompletions(typed, slashAvailability) : [];
  return commands.slice(0, MAX_SLASH_RESULTS).map((command, index) => ({
    id: `slash:${command.name}`,
    action: { kind: "slash", command: command.name } as const,
    title: command.usage,
    description: command.description,
    category: "chat" as const,
    group: "messages" as const,
    score: 320 - index,
    kind: "action" as const,
    icon: "command" as const,
  }));
}

export function buildOmnibarContextResults({
  activeChat,
  activeChatId,
  activeEditorField,
  agents,
  allLocalResults,
  characterNameById,
  connectionById,
  lastAppError,
  lorebooks,
  mariEnabled,
  omnibarSuggestionsEnabled,
  openAgentId,
  openCharacterId,
  openConnectionId,
  openLorebookId,
  openPersonaId,
  openPresetId,
  personaById,
  personas,
  presets,
  surface,
  t,
  lastReplyFindings = [],
}: OmnibarContextResultsInput): OmnibarResult[] {
  const out: OmnibarResult[] = [];
  const push = (result: OmnibarResult) => {
    if (!out.some((item) => item.id === result.id)) out.push(result);
  };
  const nameOf = (map: ReadonlyMap<string, unknown>, id: string) => readNamedRow(map.get(id))?.name;
  const listName = (list: readonly unknown[] | undefined, id: string) =>
    readNamedRow((list ?? []).find((item) => readNamedRow(item)?.id === id))?.name;
  const canonicalById = new Map(allLocalResults.map((result) => [result.id, result]));
  const pushCanonical = (id: string, fallback: OmnibarResult) => {
    const result = canonicalById.get(id);
    push({
      ...fallback,
      ...(result ?? {}),
      title: fallback.title,
      description: fallback.description ?? result?.description,
      // The canonical row's own preview (e.g. a connection's provider as its
      // subtitle) would otherwise win in `resultMetadata`'s fallback chain and
      // silently hide a fallback description like the Fix row's error text.
      preview: fallback.preview ?? result?.preview,
      group: "current-work",
      score: 0,
    });
  };

  const isActiveChat = activeChat?.id === activeChatId;
  const isActiveChatSurface = surface === "chat" && isActiveChat;
  // A visible failure is the most useful next step, so it leads the group. The
  // id must stay the real connection id so the existing connection branch in
  // choose() opens the right editor (and still honours the dirty-editor guard).
  if (lastAppError?.retry) {
    const retry = lastAppError.retry;
    const isAgentRetry = retry.kind === "open-agent";
    const rowId = `${isAgentRetry ? "agent" : "connection"}:${retry.id}`;
    pushCanonical(rowId, {
      id: rowId,
      title: lastAppError.action
        ? t("commandCenter.context.fixFailed", "Fix: {{action}} failed", { action: lastAppError.action })
        : t("commandCenter.context.fixError", "Fix the last error"),
      description: lastAppError.message,
      category: isAgentRetry ? "agent" : "connection",
      score: 0,
      icon: isAgentRetry ? "agent" : "connection",
      preview: () => ({
        kind: "docs" as const,
        title: lastAppError.action
          ? t("commandCenter.context.fixFailed", "Fix: {{action}} failed", { action: lastAppError.action })
          : t("commandCenter.context.fixError", "Fix the last error"),
        categoryLabel: isAgentRetry
          ? t("commandCenter.filters.agents", "Agents")
          : t("commandCenter.filters.connections", "Connections"),
        description: lastAppError.message,
      }),
    });
  }

  // R2: a reply that was cut off or trimmed is the next most useful fix. Enter opens the checkup
  // under that reply, which links to the exact settings and to Peek.
  const replyFindings = replyLineFindings(lastReplyFindings);
  if (isActiveChatSurface && activeChat && activeChat.mode !== "game" && replyFindings.length > 0) {
    push({
      id: `chat-tool:reply-checkup:${activeChat.id}`,
      title: t("commandCenter.context.checkReply", "Fix: Check the last reply"),
      description: replyFindings.map((finding) => replyCheckupLabel(finding, t)).join(" · "),
      category: "chat",
      group: "current-work",
      score: 0,
      kind: "action",
      icon: "command",
      action: { kind: "open-chat-tool", chatId: activeChat.id, tool: "reply-checkup" },
    });
  }

  if (!isActiveChatSurface) {
    if (openCharacterId) {
      const name = characterNameById.get(openCharacterId);
      if (name)
        pushCanonical(`character:${openCharacterId}`, {
          id: `character:${openCharacterId}`,
          title: t("commandCenter.context.editing", "Editing {{name}}", { name }),
          category: "character",
          target: { kind: "resource", resource: "character", id: openCharacterId },
          score: 0,
          icon: "character",
        });
    }
    for (const [id, kind, list, icon] of [
      [openPersonaId, "persona", personas, "persona"],
      [openLorebookId, "lorebook", lorebooks, "lorebook"],
      [openPresetId, "preset", presets, "preset"],
      [openAgentId, "agent", agents, "agent"],
    ] as const) {
      if (!id) continue;
      // A custom agent's editor is opened by config id, a built-in's by type.
      const name =
        kind === "agent" ? agents?.find((agent) => agent.id === id || agent.type === id)?.name : listName(list, id);
      if (!name) continue;
      pushCanonical(`${kind}:${id}`, {
        id: `${kind}:${id}`,
        title: t("commandCenter.context.editing", "Editing {{name}}", { name }),
        category: kind,
        target: { kind: "resource", resource: kind, id },
        score: 0,
        icon,
      });
    }
    if (openConnectionId) {
      const name = connectionById.get(openConnectionId)?.name;
      if (name)
        pushCanonical(`connection:${openConnectionId}`, {
          id: `connection:${openConnectionId}`,
          title: t("commandCenter.context.editing", "Editing {{name}}", { name }),
          category: "connection",
          score: 0,
          icon: "connection",
        });
    }
    // After the "Editing" rows: the first context row is what an unpinned Mari handoff focuses,
    // and the editor resource must travel with the field.
    if (omnibarSuggestionsEnabled && mariEnabled && activeEditorField) {
      push({
        id: "suggestion:edit-focused-field",
        title: t("commandCenter.suggestions.editFocusedField", "Improve {{field}} with Prof. Mari", {
          field: activeEditorField.label,
        }),
        description: t(
          "commandCenter.suggestions.editFocusedFieldDescription",
          "Professor Mari suggests a change to the selected field.",
        ),
        category: "professor",
        score: 460,
        group: "professor-suggested",
        kind: "action",
        icon: "professor",
      });
    }
  }
  // Slice 78: the chat's own members are one tap away in the chat; the empty list skips them.
  if (isActiveChat && activeChat) {
    pushCanonical(`chat:${activeChat.id}`, {
      id: `chat:${activeChat.id}`,
      title: t("commandCenter.context.currentChat", "Current chat: {{name}}", { name: activeChat.name }),
      category: "chat",
      target: { kind: "chat", chatId: activeChat.id },
      score: 0,
      idleHidden: true,
      icon: "chats",
    });
    for (const characterId of getChatCharacterIds(activeChat)) {
      const name = characterNameById.get(characterId);
      if (!name) continue;
      pushCanonical(`character:${characterId}`, {
        id: `character:${characterId}`,
        title: name,
        category: "character",
        target: { kind: "resource", resource: "character", id: characterId },
        score: 0,
        idleHidden: true,
        icon: "character",
      });
    }
    if (activeChat.personaId) {
      const name = nameOf(personaById, activeChat.personaId);
      if (name)
        pushCanonical(`persona:${activeChat.personaId}`, {
          id: `persona:${activeChat.personaId}`,
          title: name,
          category: "persona",
          target: { kind: "resource", resource: "persona", id: activeChat.personaId },
          score: 0,
          idleHidden: true,
          icon: "persona",
        });
    }
    if (activeChat.promptPresetId) {
      const name = listName(presets, activeChat.promptPresetId);
      if (name)
        pushCanonical(`preset:${activeChat.promptPresetId}`, {
          id: `preset:${activeChat.promptPresetId}`,
          title: name,
          category: "preset",
          target: { kind: "resource", resource: "preset", id: activeChat.promptPresetId },
          score: 0,
          idleHidden: true,
          icon: "preset",
        });
    }
    if (activeChat.connectionId) {
      const name = connectionById.get(activeChat.connectionId)?.name;
      if (name)
        pushCanonical(`connection:${activeChat.connectionId}`, {
          id: `connection:${activeChat.connectionId}`,
          title: name,
          category: "connection",
          score: 0,
          idleHidden: true,
          icon: "connection",
        });
    }
    const activeLorebooks = deriveActiveLorebookViews({
      activeLorebookIds: getChatActiveLorebookIds(activeChat),
      excludedLorebookIds: getChatExcludedLorebookIds(activeChat),
      dropExcluded: true,
      chat: activeChat,
      lorebooks: lorebooks ?? [],
    });
    for (const lorebook of activeLorebooks) {
      pushCanonical(`lorebook:${lorebook.id}`, {
        id: `lorebook:${lorebook.id}`,
        title: lorebook.name,
        category: "lorebook",
        target: { kind: "resource", resource: "lorebook", id: lorebook.id },
        score: 0,
        idleHidden: true,
        icon: "lorebook",
      });
    }
    const chatMetadata = parseChatMetadata(activeChat.metadata);
    if (chatMetadata.enableAgents === true) {
      const activeAgentIds = Array.isArray(chatMetadata.activeAgentIds)
        ? chatMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
        : [];
      for (const agentId of activeAgentIds) {
        const agent = agents?.find((item) => item.id === agentId || item.type === agentId);
        if (!agent) continue;
        pushCanonical(`agent:${agent.type}`, {
          id: `agent:${agent.type}`,
          title: agent.name,
          category: "agent",
          target: { kind: "resource", resource: "agent", id: agent.type },
          score: 0,
          idleHidden: true,
          icon: "agent",
        });
      }
    }
  }
  if (isActiveChatSurface && activeChat) {
    const chatTool = (
      tool: "summary" | "lorebook" | "search" | "regenerate" | "advanced-parameters" | "memory-recall",
      title: string,
      icon: OmnibarResult["icon"],
    ): OmnibarResult => ({
      id: `chat-tool:${tool}:${activeChat.id}`,
      title,
      category: "chat",
      group: "current-work",
      score: 0,
      kind: "action",
      icon,
      action: { kind: "open-chat-tool", chatId: activeChat.id, tool },
    });
    // Game mode has its own turn-retry reset (GameSurface's handleRetryTurn) and no
    // CHAT_SEARCH_OPEN_REQUEST_EVENT listener, so the plain regenerate/search rows
    // would either skip game state resets or open nothing.
    if (activeChat.mode !== "game") {
      push(chatTool("search", t("commandCenter.chatTools.search", "Search this chat"), "command"));
    }
    push(chatTool("lorebook", t("commandCenter.chatTools.lorebook", "Active lorebook entries"), "lorebook"));
    if (activeChat.mode === "roleplay") {
      push(chatTool("summary", t("commandCenter.chatTools.summary", "Summary"), "chats"));
    }
    // UX-13: settings that live inside Chat Settings are findable by their own names.
    if (activeChat.mode !== "game") {
      push(
        chatTool("advanced-parameters", t("commandCenter.chatTools.maxOutputTokens", "Max output tokens"), "command"),
      );
      push(chatTool("memory-recall", t("commandCenter.chatTools.memoryRecall", "Memory Recall"), "command"));
    }
    if (activeChat.mode !== "game") {
      // The button under the reply already does this; the empty list does not repeat it (slice 78).
      push({
        ...chatTool("regenerate", t("commandCenter.chatTools.regenerate", "Regenerate reply"), "command"),
        idleHidden: true,
      });
    }
  }
  return out;
}

/** Which omnibar categories map onto a chat-attachable resource kind. */
const ADD_RESOURCE_KINDS: Partial<Record<OmnibarCategory, ChatResourceDragKind>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
};
const MAX_ADD_SUGGESTIONS = 5;
/**
 * Browsing a kind ("add character ") is a picker, not a guess, so every row
 * should be attachable — a list where the first five attach and the rest open
 * the editor reads as broken.
 */
const MAX_ADD_SUGGESTIONS_BROWSING = 40;
/**
 * Above the plain entity rows for the same names, so the explicit
 * "Add X to this chat" row is what Enter lands on.
 */
const ADD_SUGGESTION_SCORE = 470;

/**
 * Turns "add Eliza" into a real, labelled row instead of relying on the ranked
 * character row secretly doing an attach. Reads the already-ranked search
 * results rather than re-deriving entities, so it inherits their icons and
 * matching; the picture comes from the record its action names
 * (`resolveOmnibarRowVisual`).
 */
/** Below `ADD_SUGGESTION_SCORE`, so concrete "Add Eliza" rows lead and the kind rows follow as the fallback. */
const VERB_SUGGESTION_SCORE = 460;
const MAX_REMOVAL_SUGGESTIONS = 8;
/** Matches the add rows, so both verbs put their concrete options in the same place. */
const REMOVAL_SUGGESTION_SCORE = 470;

/**
 * Answers a bare verb — "add", "open", "enable" — with what can follow it.
 *
 * Two shapes, chosen by how many objects the verb can take. An unbounded verb
 * ("add" can attach any of hundreds of characters) offers the object *kinds*,
 * and choosing one refines the query rather than acting, so the next keystroke
 * narrows instead of restarting. A bounded verb ("enable" has ten toggles,
 * "create" has six kinds) lists the objects themselves and acts on Enter.
 *
 * "remove" is bounded too, but `buildOmnibarRemovalSuggestions` already lists
 * the attached characters for a bare verb, so it is deliberately not repeated
 * here.
 */
export function buildOmnibarVerbSuggestions({
  allLocalResults,
  deferredQuery,
}: OmnibarVerbSuggestionsInput): OmnibarResult[] {
  const intent = isOmnibarRefinableVerb(deferredQuery);
  if (!intent) return [];
  const bounded = (rows: readonly OmnibarResult[]) =>
    rows.slice(0, 10).map((result, index) => ({
      ...result,
      score: VERB_SUGGESTION_SCORE - index,
      group: "current-work" as const,
    }));
  const createRows = (verb: string) =>
    allLocalResults.filter((result) => (verb === "import" ? /^import-/ : /^create-/).test(result.id));
  // "open"/"show" is answered by the ranked entity rows themselves.
  if (["open", "show", "go to"].includes(intent.verb)) return [];
  // Bounded verbs: list the objects themselves, because they all fit. "remove"
  // is bounded too, but `buildOmnibarRemovalSuggestions` already owns it.
  if (["create", "new", "import"].includes(intent.verb)) return bounded(createRows(intent.verb));
  if (["enable", "disable", "turn on", "turn off"].includes(intent.verb))
    return bounded(allLocalResults.filter((result) => result.control?.type === "toggle"));
  return [];
}

export function buildOmnibarAddSuggestions({
  activeChat,
  attachedResultIds,
  chats = [],
  deferredQuery,
  omnibarSuggestionsEnabled,
  searchResults,
  t,
}: OmnibarAddSuggestionsInput): OmnibarResult[] {
  if (!omnibarSuggestionsEnabled || !isOmnibarAddIntent(deferredQuery)) return [];
  const intent = parseOmnibarIntent(deferredQuery);
  const target = splitOmnibarAddTarget(intent?.targetQuery ?? "", chats);
  // A named/ambiguous chat always wins; otherwise fall back to the open chat.
  const chatTargets: OmnibarNamedRow[] = target.chatId
    ? [{ id: target.chatId, name: target.chatName! }]
    : target.ambiguousChats?.length
      ? [...target.ambiguousChats]
      : activeChat
        ? [{ id: activeChat.id, name: activeChat.name }]
        : [];
  // No open chat and no named chat either: nothing to attach to yet.
  if (!chatTargets.length) return [];
  const browsingKind = Boolean(intent?.objectCategory);
  const limit = browsingKind ? MAX_ADD_SUGGESTIONS_BROWSING : MAX_ADD_SUGGESTIONS;
  const out: OmnibarResult[] = [];
  for (const result of searchResults) {
    if (out.length >= limit) break;
    const resource = ADD_RESOURCE_KINDS[result.category];
    if (!resource) continue;
    // Entity rows are `<category>:<id>`. Control and command rows are not, and
    // must never be offered as something to attach.
    if (!result.id.startsWith(`${result.category}:`)) continue;
    const resourceId = result.id.slice(result.category.length + 1);
    if (!resourceId) continue;
    for (const chat of chatTargets) {
      if (out.length >= limit) break;
      // Already attached only means something for the open chat: a named different
      // chat's membership is not part of this row set, so it is not checked here.
      if (chat.id === activeChat?.id && attachedResultIds.has(result.id)) continue;
      const namedChat = chatTargets.length > 1 || Boolean(target.chatId);
      out.push({
        id: `action:add-to-chat:${result.id}:${chat.id}`,
        action: { kind: "add-to-chat", resource, resourceId, label: result.title, chatId: chat.id } as const,
        title: namedChat
          ? t("commandCenter.actions.addToNamedChat", "Add {{name}} to {{chat}}", {
              name: result.title,
              chat: chat.name,
            })
          : t("commandCenter.actions.addToChat", "Add {{name}} to this chat", { name: result.title }),
        description: t("commandCenter.actions.addToChatDescription", "Attach it to {{chat}} now.", {
          chat: chat.name,
        }),
        category: result.category,
        score: ADD_SUGGESTION_SCORE - out.length,
        kind: "action" as const,
        icon: result.icon,
        group: "current-work" as const,
      });
    }
  }
  return out;
}

/**
 * Answers "remove" with everything currently attached to the open chat —
 * characters, persona, preset, connection, lorebooks, agents — not just
 * characters. The list is read from the chat context rows, which are already
 * derived from live chat state, so it never drifts from what is actually on.
 *
 * A bare "remove" lists all of it; "remove eliza" narrows by name.
 */
export function buildOmnibarRemovalSuggestions({
  activeChat,
  attachedResultIds,
  contextResults,
  deferredQuery,
  omnibarSuggestionsEnabled,
  t,
}: OmnibarRemovalSuggestionsInput): OmnibarResult[] {
  if (!omnibarSuggestionsEnabled || !activeChat || !isOmnibarRemovalIntent(deferredQuery)) return [];
  const target = normalizeTextForMatch(parseOmnibarIntent(deferredQuery)?.targetQuery ?? "");
  const out: OmnibarResult[] = [];
  for (const result of contextResults) {
    if (out.length >= MAX_REMOVAL_SUGGESTIONS) break;
    const resource = ADD_RESOURCE_KINDS[result.category];
    if (!resource || !attachedResultIds.has(result.id)) continue;
    if (!result.id.startsWith(`${result.category}:`)) continue;
    if (target && !normalizeTextForMatch(result.title).includes(target)) continue;
    out.push({
      id: `action:detach-from-chat:${result.id}`,
      action: {
        kind: "detach-from-chat",
        resource,
        resourceId: result.id.slice(result.category.length + 1),
        label: result.title,
      } as const,
      title: t("commandCenter.actions.removeFromChat", "Remove {{name}} from this chat", { name: result.title }),
      description: t("commandCenter.actions.removeFromChatDescription", "Detach it from {{chat}}.", {
        chat: activeChat.name,
      }),
      category: result.category,
      score: REMOVAL_SUGGESTION_SCORE - out.length,
      kind: "action" as const,
      icon: result.icon,
      group: "current-work" as const,
    });
  }
  return out;
}

/** What a verb sentence resolved to, for the line under the input (slice 79b). */
export type OmnibarUnderstoodLine = {
  kind: "add" | "remove" | "start-chat";
  /** The plain entity row of the record, e.g. `character:<id>`. */
  recordRowId: string;
  name: string;
  chatRowId?: string;
  chatName?: string;
};

/**
 * Reads the add/remove/start-chat rows a sentence produced and says what it
 * resolved to — but only when every row agrees on one record (and one chat).
 * "add eli" with Eliza and Elias, a bare "add" or "remove", or "add Eliza to "
 * with several candidate chats is still a choice, so the rows answer it and
 * there is no line.
 */
export function resolveOmnibarUnderstoodLine(
  rows: readonly Pick<OmnibarResult, "action">[],
  activeChat: { id: string; name: string } | null | undefined,
  chatNameById: ReadonlyMap<string, string>,
): OmnibarUnderstoodLine | null {
  const lines = rows.flatMap((row): OmnibarUnderstoodLine[] => {
    const action = row.action;
    if (action?.kind === "start-character-chat") {
      return [{ kind: "start-chat", recordRowId: `character:${action.characterId}`, name: action.characterName }];
    }
    if (action?.kind !== "add-to-chat" && action?.kind !== "detach-from-chat") return [];
    const chatId = (action.kind === "add-to-chat" ? action.chatId : undefined) ?? activeChat?.id;
    const chatName = chatId
      ? (chatNameById.get(chatId) ?? (chatId === activeChat?.id ? activeChat.name : undefined))
      : undefined;
    if (!chatId || !chatName) return [];
    return [
      {
        kind: action.kind === "add-to-chat" ? "add" : "remove",
        recordRowId: `${action.resource}:${action.resourceId}`,
        name: action.label,
        chatRowId: `chat:${chatId}`,
        chatName,
      },
    ];
  });
  const first = lines[0];
  if (!first) return null;
  const agree = lines.every(
    (line) => line.kind === first.kind && line.recordRowId === first.recordRowId && line.chatRowId === first.chatRowId,
  );
  return agree ? first : null;
}

export function buildOmnibarContinueResult({
  mariEnabled,
  t,
  workspaceStatus,
  mariFinished,
}: OmnibarContinueResultInput): OmnibarResult | null {
  if (!mariEnabled) return null;
  const status = workspaceStatus;
  const hasPendingApprovals = countBlockingReviews(status?.pendingApprovals ?? []) > 0;
  if (!hasPendingApprovals && !status?.active && !mariFinished) return null;
  const title = status?.active
    ? t("commandCenter.continueMariActive", "Professor Mari is working")
    : mariFinished
      ? t("commandCenter.continueMariFinished", "Professor Mari finished your task")
      : hasPendingApprovals
        ? t("commandCenter.continueMariReview", "Review Professor Mari's pending work")
        : t("commandCenter.continueMari", "Continue with Professor Mari");
  const description = status?.active
    ? t("commandCenter.continueMariActiveDescription", "Go back to what Professor Mari is doing.")
    : mariFinished
      ? t("commandCenter.continueMariFinishedDescription", "Open Professor Mari to see what she did.")
      : hasPendingApprovals
        ? t("commandCenter.continueMariReviewDescription", "Professor Mari is waiting for your review.")
        : t("commandCenter.continueMariDescription", "Open Professor Mari with the current work attached.");
  return {
    id: "ask-professor-mari",
    title,
    category: "professor",
    description,
    score: 140,
    group: "continue",
    kind: "action",
    icon: "professor",
  };
}
