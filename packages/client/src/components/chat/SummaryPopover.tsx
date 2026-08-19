// ──────────────────────────────────────────────
// Summary Popover — View / edit / generate chat summary
// Shown via the scroll icon in the chat header bar.
// ──────────────────────────────────────────────
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
  type TouchEvent as ReactTouchEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { TFunction } from "i18next";
import {
  useDeleteSummaryEntry,
  useGenerateSummary,
  useRollingSummaryBackfill,
  useReorderSummaryEntries,
  useToggleSummaryEntry,
  useUpdateChatMetadata,
  useUpdateSummaryEntry,
} from "../../hooks/use-chats";
import {
  chatSummaryPromptKeys,
  useChatSummaryPromptSettings,
  useUpdateChatSummaryPromptSettings,
} from "../../hooks/use-chat-summary-prompts";
import { useQueryClient } from "@tanstack/react-query";
import { useRollingBackfillStore } from "../../stores/backfill.store";
import {
  Check,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  GripVertical,
  Save,
  ScrollText,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, generateClientId } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useConnections } from "../../hooks/use-connections";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  type APIConnection,
  CHAT_SUMMARY_PROMPT_MAX_LENGTH,
  CHAT_SUMMARY_OUTPUT_TOKENS,
  DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT,
  DEFAULT_CHAT_SUMMARY_PROMPT,
  DEFAULT_LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT,
  LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID,
  SUMMARY_TAIL_MESSAGES,
  estimateChatSummaryTokens,
  normalizeChatSummaryEntries,
  type ChatSummaryEntry,
  type ChatSummaryPromptSettings,
  type ChatSummaryPromptTemplate,
} from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { MacroTextarea } from "../ui/MacroTextarea";
import { isChatToolbarPanelTrigger } from "./ChatToolbarControls";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";

interface SummaryPopoverProps {
  chatId: string;
  summary: string | null;
  summaryEntries?: ChatSummaryEntry[];
  contextSize: number;
  promptTemplates?: ChatSummaryPromptTemplate[];
  activePromptTemplateId?: string | null;
  longTermMemorySummaryPromptAvailable?: boolean;
  summaryConnectionId?: string | null;
  summaryMaxTokens?: number;
  automaticSummaryEnabled?: boolean;
  semanticSummaryRetrievalEnabled?: boolean;
  activeAgentIds?: string[];
  summaryRunInterval?: number;
  /** Per-chat persisted "Hide summarised messages" preference (metadata-backed). Undefined/false means off (opt-in default). */
  hideSummarisedMessages?: boolean;
  /** How many recent messages stay visible when summarised messages are auto-hidden (roleplay tail). Default 10. */
  summaryTailMessages?: number;
  automaticSummariesAvailable?: boolean;
  totalMessageCount: number;
  summaryInjectionHint?: string | null;
  anchor?: SummaryPopoverAnchor | null;
  onClose: () => void;
}

interface SummaryPopoverAnchor {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  overflowMenu?: boolean;
}

type SummarySourceMode = "last" | "range";
type SummaryPromptView = "summary" | "combine";
type SummaryConnectionOption = Pick<APIConnection, "id" | "name" | "provider" | "model"> & {
  defaultForAgents?: boolean | string | null;
};

const MIN_SUMMARY_MESSAGES = 5;
const MAX_SUMMARY_MESSAGES = 500;
const SUMMARY_AGENT_ID = "chat-summary";
const DEFAULT_AUTOMATIC_SUMMARY_INTERVAL = 5;
const MIN_AUTOMATIC_SUMMARY_INTERVAL = 1;
const MAX_AUTOMATIC_SUMMARY_INTERVAL = 200;
const SUMMARY_TOKEN_WARNING_THRESHOLD = 1800;
const SUMMARY_HEADING_PATTERN = /^(?:#{1,6}\s*)?(?:\*\*)?([^:\n]{3,80})(?:\*\*)?:\s*$/;
const SUMMARY_BULLET_PATTERN = /^[-*•]\s+/;
const MOBILE_SUMMARY_PADDING = 8;
const DESKTOP_SUMMARY_WIDTH = 576;

function reorderSummaryEntryIdsToGap(
  entries: Array<{ id: string }>,
  sourceIndex: number,
  targetGapIndex: number,
): string[] | null {
  if (sourceIndex < 0 || sourceIndex >= entries.length) return null;
  if (targetGapIndex < 0 || targetGapIndex > entries.length) return null;
  if (targetGapIndex === sourceIndex || targetGapIndex === sourceIndex + 1) return null;
  const next = [...entries];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) return null;
  next.splice(targetGapIndex > sourceIndex ? targetGapIndex - 1 : targetGapIndex, 0, moved);
  return next.map((entry) => entry.id);
}

function clampSummaryMaxTokens(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT;
  return Math.max(CHAT_SUMMARY_OUTPUT_TOKENS.MIN, Math.min(CHAT_SUMMARY_OUTPUT_TOKENS.MAX, Math.trunc(parsed)));
}

function getMobileSummaryFrame(anchor: SummaryPopoverAnchor | null | undefined) {
  if (typeof window === "undefined") return null;
  const rightEdge = anchor?.overflowMenu ? anchor.right : (anchor?.right ?? window.innerWidth - MOBILE_SUMMARY_PADDING);
  const width = Math.min(
    560,
    window.innerWidth - MOBILE_SUMMARY_PADDING * 2,
    Math.max(160, rightEdge - MOBILE_SUMMARY_PADDING),
  );
  const left = Math.max(
    MOBILE_SUMMARY_PADDING,
    Math.min(rightEdge - width, window.innerWidth - width - MOBILE_SUMMARY_PADDING),
  );
  const top = Math.max(MOBILE_SUMMARY_PADDING, anchor?.overflowMenu ? anchor.top : (anchor?.bottom ?? 56));
  const maxHeight = Math.max(240, window.innerHeight - top - MOBILE_SUMMARY_PADDING);
  return { top, left, width, maxHeight };
}

function getDesktopSummaryFrame(anchor: SummaryPopoverAnchor | null | undefined) {
  if (typeof window === "undefined") return null;
  const width = Math.min(DESKTOP_SUMMARY_WIDTH, window.innerWidth - MOBILE_SUMMARY_PADDING * 2);
  const rightEdge = anchor?.right ?? window.innerWidth - MOBILE_SUMMARY_PADDING;
  const left = Math.max(
    MOBILE_SUMMARY_PADDING,
    Math.min(rightEdge - width, window.innerWidth - width - MOBILE_SUMMARY_PADDING),
  );
  const top = Math.max(MOBILE_SUMMARY_PADDING, (anchor?.bottom ?? 52) + 4);
  const maxHeight = Math.max(240, Math.min(736, window.innerHeight - top - MOBILE_SUMMARY_PADDING));
  return { top, left, width, maxHeight };
}

interface SummarySection {
  title: string | null;
  lines: string[];
}

function clampSummaryCount(value: number): number {
  return Math.max(MIN_SUMMARY_MESSAGES, Math.min(MAX_SUMMARY_MESSAGES, value));
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function summaryErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return t("chat.summary.errors.generate");
}

function clampAutomaticSummaryInterval(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_AUTOMATIC_SUMMARY_INTERVAL;
  return Math.max(MIN_AUTOMATIC_SUMMARY_INTERVAL, Math.min(MAX_AUTOMATIC_SUMMARY_INTERVAL, Math.trunc(parsed)));
}

function isSummaryConnectionOption(value: unknown): value is SummaryConnectionOption {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.model === "string" &&
    typeof record.provider === "string" &&
    record.provider !== "image_generation" &&
    record.provider !== "video_generation" &&
    record.provider !== "audio"
  );
}

function isDefaultAgentConnection(connection: SummaryConnectionOption): boolean {
  return connection.defaultForAgents === true || connection.defaultForAgents === "true";
}

function formatSummaryConnectionLabel(connection: SummaryConnectionOption): string {
  const model = typeof connection.model === "string" && connection.model.trim() ? ` · ${connection.model.trim()}` : "";
  return `${connection.name}${model}`;
}

function formatSummaryHeading(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .trim();
}

function parseSummarySections(value: string): SummarySection[] {
  const sections: SummarySection[] = [];
  let current: SummarySection = { title: null, lines: [] };

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (current.lines.length > 0 && current.lines[current.lines.length - 1] !== "") {
        current.lines.push("");
      }
      continue;
    }

    const headingMatch = line.match(SUMMARY_HEADING_PATTERN);
    if (headingMatch && !SUMMARY_BULLET_PATTERN.test(line)) {
      if (current.title || current.lines.some(Boolean)) sections.push(current);
      current = { title: formatSummaryHeading(headingMatch[1] ?? line), lines: [] };
      continue;
    }

    current.lines.push(line);
  }

  if (current.title || current.lines.some(Boolean)) sections.push(current);

  if (sections.length === 0 && value.trim()) {
    return [{ title: null, lines: [value.trim()] }];
  }

  return sections;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    const rounded = Math.round(tokens / 100) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
  }
  return String(tokens);
}

function getSummaryEntrySourceLabel(entry: ChatSummaryEntry, t: TFunction): string | null {
  if (entry.rangeStartIndex && entry.rangeEndIndex) {
    return t("chat.summary.source.range", {
      start: entry.rangeStartIndex,
      end: entry.rangeEndIndex,
    });
  }
  if (entry.sourceMode === "last" && entry.messageCount) {
    return t("chat.summary.source.messageCount", { count: entry.messageCount });
  }
  if (entry.sourceMode === "agent") return t("chat.summary.source.agent");
  return null;
}

function getSummaryEntryMetaLine(entry: ChatSummaryEntry, t: TFunction): string {
  return [
    getSummaryEntrySourceLabel(entry, t),
    t("chat.summary.tokenEstimate", { tokens: formatTokenCount(entry.tokenEstimate) }),
  ]
    .filter(Boolean)
    .join(" · ");
}

function createBlankManualSummaryEntry(t: TFunction): ChatSummaryEntry {
  const now = new Date().toISOString();
  return {
    id: generateClientId(),
    kind: "rolling",
    origin: "manual",
    title: t("chat.summary.manual"),
    content: "",
    enabled: true,
    sourceMode: "last",
    tokenEstimate: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function SummaryPopover({
  chatId,
  summary,
  summaryEntries,
  contextSize,
  promptTemplates = [],
  activePromptTemplateId = null,
  longTermMemorySummaryPromptAvailable = false,
  summaryConnectionId = null,
  summaryMaxTokens,
  automaticSummaryEnabled = false,
  semanticSummaryRetrievalEnabled = false,
  activeAgentIds = [],
  summaryRunInterval,
  hideSummarisedMessages,
  summaryTailMessages,
  automaticSummariesAvailable = true,
  totalMessageCount,
  summaryInjectionHint = null,
  anchor = null,
  onClose,
}: SummaryPopoverProps) {
  const { t: localizeUi } = useUiTranslation();
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [combiningEntries, setCombiningEntries] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draftEntry, setDraftEntry] = useState<ChatSummaryEntry | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
  const [summaryPromptView, setSummaryPromptView] = useState<SummaryPromptView>("summary");
  const [combinePromptEditorOpen, setCombinePromptEditorOpen] = useState(false);
  const [showInactiveSummaries, setShowInactiveSummaries] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [templatePromptDraft, setTemplatePromptDraft] = useState("");
  const [combinePromptDraft, setCombinePromptDraft] = useState(DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT);
  const [promptSettingsSaveLocked, setPromptSettingsSaveLocked] = useState(false);
  const summaryPopoverSettings = useUIStore((s) => s.summaryPopoverSettings);
  const setSummaryPopoverSettings = useUIStore((s) => s.setSummaryPopoverSettings);
  const persistedContextSize = summaryPopoverSettings.contextSize ?? contextSize;
  const [localSize, setLocalSize] = useState(String(persistedContextSize || ""));
  const normalizedAutomaticSummaryInterval = clampAutomaticSummaryInterval(summaryRunInterval);
  const normalizedSummaryMaxTokens = clampSummaryMaxTokens(summaryMaxTokens);
  const [automaticIntervalDraft, setAutomaticIntervalDraft] = useState(String(normalizedAutomaticSummaryInterval));
  const [summaryMaxTokensDraft, setSummaryMaxTokensDraft] = useState(String(normalizedSummaryMaxTokens));
  const sourceMode = summaryPopoverSettings.sourceMode;
  const [rangeStart, setRangeStart] = useState(() =>
    String(summaryPopoverSettings.rangeStart ?? Math.max(1, totalMessageCount - persistedContextSize + 1)),
  );
  const [rangeEnd, setRangeEnd] = useState(() =>
    String(summaryPopoverSettings.rangeEnd ?? Math.max(1, totalMessageCount)),
  );
  const sizeInputFocused = useRef(false);
  const rangeInputFocused = useRef(false);
  const automaticIntervalFocused = useRef(false);
  const summaryMaxTokensFocused = useRef(false);
  const combinePromptFocused = useRef(false);
  const combinePromptDraftRef = useRef(DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT);
  const combinePromptSaveRef = useRef<{ prompt: string; promise: Promise<boolean> } | null>(null);
  const promptSettingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const promptSettingsSaveLockedRef = useRef(false);
  const summaryMaxTokensSaveRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const generateSummary = useGenerateSummary();
  const updateMeta = useUpdateChatMetadata();
  const globalPromptSettings = useChatSummaryPromptSettings();
  const updateGlobalPromptSettings = useUpdateChatSummaryPromptSettings();
  const queryClient = useQueryClient();
  const { data: connectionsData } = useConnections();
  const updateSummaryEntry = useUpdateSummaryEntry();
  const deleteSummaryEntry = useDeleteSummaryEntry();
  const toggleSummaryEntry = useToggleSummaryEntry();
  const reorderSummaryEntries = useReorderSummaryEntries();
  const entryTextareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const summaryEntryListRef = useRef<HTMLDivElement>(null);
  const [draggingEntryIndex, setDraggingEntryIndex] = useState<number | null>(null);
  const [dragReadyEntryIndex, setDragReadyEntryIndex] = useState<number | null>(null);
  const [summaryDropIndex, setSummaryDropIndex] = useState<number | null>(null);

  const { startBackfill, stopBackfill } = useRollingSummaryBackfill();
  const backfillState = useRollingBackfillStore();

  // Per-chat preference, default off — no global fallback, so one chat never
  // inherits another's setting.
  const hideSummarisedResolved = hideSummarisedMessages === true;

  const persistSummaryContextSize = useCallback(
    (size: number) => {
      const clamped = clampSummaryCount(size);
      setSummaryPopoverSettings({ contextSize: clamped });
      if (contextSize !== clamped) {
        updateMeta.mutate({ id: chatId, summaryContextSize: clamped });
      }
    },
    [chatId, contextSize, setSummaryPopoverSettings, updateMeta],
  );

  const eventTargetsPanel = useCallback((event: Event) => {
    const panel = panelRef.current;
    if (!panel) return false;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(panel)) return true;
    return event.target instanceof Node && panel.contains(event.target);
  }, []);

  // Sync local size when the persisted/default context size changes externally.
  useEffect(() => {
    if (!sizeInputFocused.current) {
      setLocalSize(persistedContextSize ? String(persistedContextSize) : "");
    }
  }, [persistedContextSize]);

  // Keep the default custom range aligned to the currently selected "last" window.
  useEffect(() => {
    if (rangeInputFocused.current || sourceMode === "range") return;
    setRangeStart(String(Math.max(1, totalMessageCount - persistedContextSize + 1)));
    setRangeEnd(String(Math.max(1, totalMessageCount)));
  }, [persistedContextSize, sourceMode, totalMessageCount]);

  // Focus textarea when entering entry edit mode.
  useEffect(() => {
    if (editingEntryId) {
      setTimeout(() => entryTextareaRef.current?.focus(), 50);
    }
  }, [editingEntryId]);

  const normalizedLastSize = clampSummaryCount(parsePositiveInteger(localSize) ?? persistedContextSize ?? 50);
  const normalizedRangeStart = Math.max(1, Math.min(totalMessageCount || 1, parsePositiveInteger(rangeStart) ?? 1));
  const normalizedRangeEnd = Math.max(
    1,
    Math.min(totalMessageCount || 1, parsePositiveInteger(rangeEnd) ?? (totalMessageCount || 1)),
  );
  const rangeLow = Math.min(normalizedRangeStart, normalizedRangeEnd);
  const rangeHigh = Math.max(normalizedRangeStart, normalizedRangeEnd);
  const selectedRangeCount = rangeHigh - rangeLow + 1;
  const hasMessages = totalMessageCount > 0;
  const rangeTooLarge = sourceMode === "range" && selectedRangeCount > MAX_SUMMARY_MESSAGES;
  const globalPromptSettingsReady = globalPromptSettings.isSuccess;
  const canGenerate = hasMessages && !rangeTooLarge && globalPromptSettingsReady;
  const sourceSummary =
    sourceMode === "range"
      ? localizeUi("chat.summary.source.range", { start: rangeLow, end: rangeHigh })
      : localizeUi("chat.summary.source.lastMessages", { count: normalizedLastSize });
  const sourceDetail =
    sourceMode === "range"
      ? localizeUi("chat.summary.source.selectedMessages", { count: selectedRangeCount })
      : totalMessageCount > 0
        ? localizeUi("chat.summary.source.usingMessages", {
            count: Math.min(normalizedLastSize, totalMessageCount),
            total: totalMessageCount,
          })
        : localizeUi("chat.summary.source.noMessages");
  const rangeErrorText = localizeUi("chat.summary.source.rangeLimit", {
    count: MAX_SUMMARY_MESSAGES,
  });
  const globalTemplates = globalPromptSettings.data?.templates ?? [];
  const globalActivePromptTemplateId = globalPromptSettings.data?.activeTemplateId ?? null;
  const globalCombinePrompt = globalPromptSettings.data?.combinePrompt ?? DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT;
  const hasGlobalPromptSettings = globalPromptSettings.data?.hasPersistedSettings === true;
  const sourcePromptTemplates = !globalPromptSettingsReady
    ? []
    : hasGlobalPromptSettings
      ? globalTemplates
      : promptTemplates;
  const resolvedActivePromptTemplateId = !globalPromptSettingsReady
    ? null
    : hasGlobalPromptSettings
      ? globalActivePromptTemplateId
      : activePromptTemplateId;
  const normalizedActivePromptTemplateId = resolvedActivePromptTemplateId?.trim() || null;
  const cleanedPromptTemplates = sourcePromptTemplates.filter(
    (template) =>
      typeof template.id === "string" &&
      template.id.trim().length > 0 &&
      typeof template.name === "string" &&
      typeof template.prompt === "string" &&
      template.prompt.trim().length > 0 &&
      template.id.trim() !== LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID,
  );
  const activePromptTemplate = normalizedActivePromptTemplateId
    ? cleanedPromptTemplates.find((template) => template.id === normalizedActivePromptTemplateId)
    : null;
  const isLongTermMemoryPromptSelected =
    longTermMemorySummaryPromptAvailable &&
    normalizedActivePromptTemplateId === LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID;
  const promptTemplateSummary = isLongTermMemoryPromptSelected
    ? localizeUi("chat.summary.template.longTermMemory")
    : (activePromptTemplate?.name ?? localizeUi("ui.chat.summarypopover.builtInDefault"));
  const activeSummaryPrompt = isLongTermMemoryPromptSelected
    ? DEFAULT_LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT
    : (activePromptTemplate?.prompt ?? DEFAULT_CHAT_SUMMARY_PROMPT);
  const readCurrentPromptSettings = useCallback(() => {
    const cached = queryClient.getQueryData<ChatSummaryPromptSettings & { hasPersistedSettings?: boolean }>(
      chatSummaryPromptKeys.settings,
    );
    if (cached?.hasPersistedSettings) {
      return {
        templates: cached.templates,
        activeTemplateId: cached.activeTemplateId?.trim() || null,
      };
    }
    return {
      templates: cleanedPromptTemplates,
      activeTemplateId: normalizedActivePromptTemplateId,
    };
  }, [cleanedPromptTemplates, normalizedActivePromptTemplateId, queryClient]);

  useEffect(() => {
    if (!combinePromptFocused.current) {
      combinePromptDraftRef.current = globalCombinePrompt;
      setCombinePromptDraft(globalCombinePrompt);
    }
  }, [globalCombinePrompt]);
  const isEditingExistingTemplate = !!editingTemplateId;
  const hasTemplateDraft = templateNameDraft.trim().length > 0 && templatePromptDraft.trim().length > 0;
  const displayEntries = useMemo(
    () =>
      normalizeChatSummaryEntries(summaryEntries, {
        legacySummary: summary,
      }),
    [summary, summaryEntries],
  );
  const selectedEntries = useMemo(
    () => displayEntries.filter((entry) => selectedEntryIds.has(entry.id)),
    [displayEntries, selectedEntryIds],
  );
  useEffect(() => {
    setSelectedEntryIds((current) => {
      const existingIds = new Set(displayEntries.map((entry) => entry.id));
      const next = new Set([...current].filter((id) => existingIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [displayEntries]);
  const enabledEntryCount = displayEntries.filter((entry) => entry.enabled).length;
  const inactiveEntryCount = displayEntries.length - enabledEntryCount;
  const visibleEntries = useMemo(() => {
    const filteredEntries = showInactiveSummaries ? displayEntries : displayEntries.filter((entry) => entry.enabled);
    if (!draftEntry || filteredEntries.some((entry) => entry.id === draftEntry.id)) return filteredEntries;
    return [...filteredEntries, draftEntry];
  }, [displayEntries, draftEntry, showInactiveSummaries]);
  const enabledTokenEstimate = displayEntries.reduce(
    (total, entry) => (entry.enabled ? total + entry.tokenEstimate : total),
    0,
  );
  const hasPersistedEntries = displayEntries.length > 0;
  const hasEntries = visibleEntries.length > 0;
  const allVisibleEntriesHidden = hasPersistedEntries && !hasEntries;
  const allEntriesDisabled = hasPersistedEntries && enabledEntryCount === 0;
  const showSummaryInjectionHint = enabledEntryCount > 0 && !!summaryInjectionHint;
  const tokenWarning = enabledTokenEstimate > SUMMARY_TOKEN_WARNING_THRESHOLD;
  const entryMutationPending =
    updateSummaryEntry.isPending ||
    deleteSummaryEntry.isPending ||
    toggleSummaryEntry.isPending ||
    reorderSummaryEntries.isPending;
  const automaticSummariesOn = automaticSummaryEnabled;
  const summaryConnections = useMemo(
    () => (connectionsData ?? []).filter(isSummaryConnectionOption),
    [connectionsData],
  );
  const defaultAgentConnection = summaryConnections.find(isDefaultAgentConnection) ?? null;
  const selectedSummaryConnectionId =
    typeof summaryConnectionId === "string" && summaryConnectionId.trim() ? summaryConnectionId.trim() : "";
  const selectedSummaryConnectionMissing =
    !!selectedSummaryConnectionId &&
    !summaryConnections.some((connection) => connection.id === selectedSummaryConnectionId);
  const defaultConnectionLabel = defaultAgentConnection
    ? localizeUi("chat.summary.connection.agentDefaultNamed", {
        name: defaultAgentConnection.name,
      })
    : localizeUi("chat.summary.connection.agentDefaultFallback");

  useEffect(() => {
    if (!automaticIntervalFocused.current) {
      setAutomaticIntervalDraft(String(normalizedAutomaticSummaryInterval));
    }
  }, [normalizedAutomaticSummaryInterval]);

  useEffect(() => {
    if (!summaryMaxTokensFocused.current) {
      setSummaryMaxTokensDraft(String(normalizedSummaryMaxTokens));
    }
  }, [normalizedSummaryMaxTokens]);

  const persistAutomaticSummaryInterval = useCallback(
    (value: number) => {
      const clamped = clampAutomaticSummaryInterval(value);
      setAutomaticIntervalDraft(String(clamped));
      updateMeta.mutate({ id: chatId, summaryRunInterval: clamped });
    },
    [chatId, updateMeta],
  );

  const handleAutomaticSummaryToggle = useCallback(
    (checked: boolean) => {
      updateMeta.mutate({
        id: chatId,
        automaticSummaryEnabled: checked,
        activeAgentIds: activeAgentIds.filter((agentId) => agentId !== SUMMARY_AGENT_ID),
        summaryRunInterval: normalizedAutomaticSummaryInterval,
      });
    },
    [activeAgentIds, chatId, normalizedAutomaticSummaryInterval, updateMeta],
  );

  const handleSummaryConnectionChange = useCallback(
    (connectionId: string) => {
      updateMeta.mutate({
        id: chatId,
        summaryConnectionId: connectionId || null,
      });
    },
    [chatId, updateMeta],
  );

  const persistSummaryMaxTokens = useCallback(
    async (value: string) => {
      const clamped = clampSummaryMaxTokens(value || CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT);
      setSummaryMaxTokensDraft(String(clamped));
      if (normalizedSummaryMaxTokens !== clamped) {
        const key = String(clamped);
        if (summaryMaxTokensSaveRef.current?.key === key) {
          await summaryMaxTokensSaveRef.current.promise;
          return;
        }
        const promise = updateMeta
          .mutateAsync({
            id: chatId,
            summaryMaxTokens: clamped,
          })
          .then(() => undefined)
          .catch((error) => {
            toast.error(localizeUi("ui.chat.summarypopover.couldNotSaveSummaryOutputSize"));
            throw error;
          })
          .finally(() => {
            if (summaryMaxTokensSaveRef.current?.promise === promise) {
              summaryMaxTokensSaveRef.current = null;
            }
          });
        summaryMaxTokensSaveRef.current = { key, promise };
        await promise;
      }
    },
    [chatId, normalizedSummaryMaxTokens, updateMeta, localizeUi],
  );

  const handleSourceModeChange = useCallback(
    (mode: SummarySourceMode) => {
      if (mode === "range") {
        setRangeStart(String(rangeLow));
        setRangeEnd(String(rangeHigh));
        setSummaryPopoverSettings({ sourceMode: mode, rangeStart: rangeLow, rangeEnd: rangeHigh });
        return;
      }
      setSummaryPopoverSettings({ sourceMode: mode });
    },
    [rangeHigh, rangeLow, setSummaryPopoverSettings],
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    try {
      await persistSummaryMaxTokens(summaryMaxTokensDraft);
    } catch {
      return;
    }
    // The server hides the tail-excluded subset itself (when the chat opts in)
    // and the generate-summary mutation refreshes the message list, so there is
    // no separate client-side hide to keep in sync.
    if (sourceMode === "range") {
      setRangeStart(String(rangeLow));
      setRangeEnd(String(rangeHigh));
      generateSummary.mutate(
        {
          chatId,
          rangeStartIndex: rangeLow,
          rangeEndIndex: rangeHigh,
          promptTemplateId: normalizedActivePromptTemplateId,
        },
        {
          onSuccess: (data) => {
            if (data.entry?.id) {
              setExpandedEntryIds((current) => new Set(current).add(data.entry!.id));
            }
            setEditingEntryId(null);
            setDraftEntry(null);
          },
          onError: (error) => toast.error(summaryErrorMessage(error, localizeUi)),
        },
      );
      return;
    }
    setLocalSize(String(normalizedLastSize));
    persistSummaryContextSize(normalizedLastSize);
    generateSummary.mutate(
      { chatId, contextSize: normalizedLastSize, promptTemplateId: normalizedActivePromptTemplateId },
      {
        onSuccess: (data) => {
          if (data.entry?.id) {
            setExpandedEntryIds((current) => new Set(current).add(data.entry!.id));
          }
          setEditingEntryId(null);
          setDraftEntry(null);
        },
        onError: (error) => toast.error(summaryErrorMessage(error, localizeUi)),
      },
    );
  }, [
    canGenerate,
    chatId,
    generateSummary,
    normalizedLastSize,
    rangeHigh,
    rangeLow,
    persistSummaryContextSize,
    sourceMode,
    normalizedActivePromptTemplateId,
    persistSummaryMaxTokens,
    summaryMaxTokensDraft,
    localizeUi,
  ]);

  const handleBackfill = useCallback(async () => {
    if (!globalPromptSettingsReady) return;
    try {
      await persistSummaryMaxTokens(summaryMaxTokensDraft);
    } catch {
      return;
    }
    startBackfill({
      chatId,
      summaryEntries: displayEntries,
      batchSize: normalizedAutomaticSummaryInterval,
      maxMessagesPerBatch: persistedContextSize,
      promptTemplateId: normalizedActivePromptTemplateId,
    });
  }, [
    normalizedActivePromptTemplateId,
    chatId,
    displayEntries,
    globalPromptSettingsReady,
    normalizedAutomaticSummaryInterval,
    persistedContextSize,
    persistSummaryMaxTokens,
    startBackfill,
    summaryMaxTokensDraft,
  ]);

  const handleToggleExpanded = useCallback((entryId: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const handleToggleSelected = useCallback((entryId: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const commitSummaryEntryReorder = useCallback(
    async (sourceIndex: number, targetGapIndex: number) => {
      const entryIds = reorderSummaryEntryIdsToGap(displayEntries, sourceIndex, targetGapIndex);
      if (!entryIds) return;
      try {
        await reorderSummaryEntries.mutateAsync({ chatId, entryIds });
      } catch {
        toast.error(localizeUi("ui.chat.summarypopover.couldNotReorderSummaryEntries"));
      }
    },
    [chatId, displayEntries, localizeUi, reorderSummaryEntries],
  );

  const handleSummaryDragStart = useCallback((entryIndex: number, event: ReactDragEvent) => {
    setDraggingEntryIndex(entryIndex);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(entryIndex));
  }, []);

  const handleSummaryDragOver = useCallback((entryIndex: number, event: ReactDragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    setSummaryDropIndex(event.clientY < rect.top + rect.height / 2 ? entryIndex : entryIndex + 1);
  }, []);

  const finishSummaryDrag = useCallback(() => {
    setDraggingEntryIndex(null);
    setDragReadyEntryIndex(null);
    setSummaryDropIndex(null);
  }, []);

  const handleSummaryDrop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      const sourceIndex = draggingEntryIndex;
      const targetGapIndex = summaryDropIndex;
      finishSummaryDrag();
      if (sourceIndex === null || targetGapIndex === null) return;
      void commitSummaryEntryReorder(sourceIndex, targetGapIndex);
    },
    [commitSummaryEntryReorder, draggingEntryIndex, finishSummaryDrag, summaryDropIndex],
  );

  const handleSummaryContainerDragOver = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const root = summaryEntryListRef.current;
      if (!root || displayEntries.length === 0) {
        setSummaryDropIndex(displayEntries.length);
        return;
      }
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-touch-reorder-item="summary-entry"]'));
      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      if (firstRow && event.clientY < firstRow.getBoundingClientRect().top) {
        setSummaryDropIndex(0);
      } else if (lastRow && event.clientY > lastRow.getBoundingClientRect().bottom) {
        setSummaryDropIndex(displayEntries.length);
      }
    },
    [displayEntries.length],
  );

  const moveSummaryEntryByOffset = useCallback(
    (entryIndex: number, offset: number) => {
      const targetIndex = entryIndex + offset;
      if (targetIndex < 0 || targetIndex >= displayEntries.length) return;
      void commitSummaryEntryReorder(entryIndex, offset < 0 ? targetIndex : targetIndex + 1);
    },
    [commitSummaryEntryReorder, displayEntries.length],
  );

  const { startTouchDrag: startSummaryEntryTouchDrag } = useTouchFolderDrag({
    onActivate: (entryId) => {
      const entryIndex = displayEntries.findIndex((entry) => entry.id === entryId);
      if (entryIndex < 0) return;
      setDraggingEntryIndex(entryIndex);
      setDragReadyEntryIndex(entryIndex);
    },
    onDrop: (entryId, x, y) => {
      const sourceIndex = displayEntries.findIndex((entry) => entry.id === entryId);
      const targetGapIndex = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="summary-entry"]',
        rootSelector: "[data-summary-entry-root]",
        itemCount: displayEntries.length,
      });
      finishSummaryDrag();
      if (sourceIndex < 0 || targetGapIndex === null) return;
      void commitSummaryEntryReorder(sourceIndex, targetGapIndex);
    },
    onCancel: finishSummaryDrag,
  });

  const handleCombineSelected = useCallback(async () => {
    if (selectedEntries.length < 2 || generateSummary.isPending) return;
    try {
      await persistSummaryMaxTokens(summaryMaxTokensDraft);
    } catch {
      return;
    }
    setCombiningEntries(true);
    generateSummary.mutate(
      {
        chatId,
        summaryEntryIds: selectedEntries.map((entry) => entry.id),
        promptTemplateId: normalizedActivePromptTemplateId,
      },
      {
        onSuccess: (data) => {
          setSelectedEntryIds(new Set());
          setShowInactiveSummaries(true);
          const entryId = data.entry?.id;
          if (entryId) setExpandedEntryIds((current) => new Set(current).add(entryId));
        },
        onError: (error) => toast.error(summaryErrorMessage(error, localizeUi)),
        onSettled: () => setCombiningEntries(false),
      },
    );
  }, [
    chatId,
    generateSummary,
    localizeUi,
    normalizedActivePromptTemplateId,
    persistSummaryMaxTokens,
    selectedEntries,
    summaryMaxTokensDraft,
  ]);

  const handleStartEditEntry = useCallback((entry: ChatSummaryEntry) => {
    setEditingEntryId(entry.id);
    setDraftEntry({ ...entry });
    setExpandedEntryIds((current) => new Set(current).add(entry.id));
  }, []);

  const handleCreateManualEntry = useCallback(() => {
    const entry = createBlankManualSummaryEntry(localizeUi);
    setEditingEntryId(entry.id);
    setDraftEntry(entry);
    setExpandedEntryIds((current) => new Set(current).add(entry.id));
  }, [localizeUi]);

  const handleCancelEditEntry = useCallback(() => {
    setEditingEntryId(null);
    setDraftEntry(null);
  }, []);

  const handleSaveEntry = useCallback(
    async (entry: ChatSummaryEntry) => {
      const content = entry.content.trim();
      const title = entry.title.trim() || localizeUi("chat.summary.manual");
      if (!content) {
        toast.error(localizeUi("ui.chat.summarypopover.summaryContentIsRequired"));
        return;
      }
      const existingEntry = displayEntries.find((candidate) => candidate.id === entry.id);
      const entryPayload = existingEntry
        ? {
            id: entry.id,
            title,
            content,
            tokenEstimate: estimateChatSummaryTokens(content),
          }
        : {
            ...entry,
            title,
            content,
            tokenEstimate: estimateChatSummaryTokens(content),
          };
      try {
        await updateSummaryEntry.mutateAsync({
          chatId,
          entry: entryPayload,
        });
        setEditingEntryId(null);
        setDraftEntry(null);
      } catch {
        toast.error(localizeUi("ui.chat.summarypopover.couldNotSaveSummaryEntry"));
      }
    },
    [chatId, displayEntries, updateSummaryEntry, localizeUi],
  );

  const handleToggleEntry = useCallback(
    async (entry: ChatSummaryEntry, enabled: boolean) => {
      try {
        await toggleSummaryEntry.mutateAsync({ chatId, entryId: entry.id, enabled });
      } catch {
        toast.error(localizeUi("ui.chat.summarypopover.couldNotUpdateSummaryEntry"));
      }
    },
    [chatId, toggleSummaryEntry, localizeUi],
  );

  const handleToggleAllEntries = useCallback(async () => {
    const nextEnabled = enabledEntryCount === 0;
    const entriesToUpdate = displayEntries.filter((entry) => entry.enabled !== nextEnabled);
    if (entriesToUpdate.length === 0) return;

    try {
      for (const entry of entriesToUpdate) {
        await toggleSummaryEntry.mutateAsync({ chatId, entryId: entry.id, enabled: nextEnabled });
      }
      if (nextEnabled) setShowInactiveSummaries(false);
    } catch {
      toast.error(localizeUi("ui.chat.summarypopover.couldNotUpdateSummaryEntries"));
    }
  }, [chatId, displayEntries, enabledEntryCount, toggleSummaryEntry, localizeUi]);

  const handleDeleteEntry = useCallback(
    async (entry: ChatSummaryEntry) => {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.summarypopover.deleteSummaryEntry"),
        message: localizeUi("chat.summary.deleteEntryConfirmation", {
          title: entry.title,
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        cancelLabel: localizeUi("chat.delete.dialog.cancel"),
        tone: "destructive",
      });
      if (!confirmed) return;
      // The server unhides the messages this entry covered (minus any still
      // covered by another enabled entry) as part of the delete, so deletion and
      // visibility restoration succeed or fail together — no orphaned hidden
      // messages on the client side.
      try {
        await deleteSummaryEntry.mutateAsync({ chatId, entryId: entry.id });
      } catch {
        toast.error(localizeUi("ui.chat.summarypopover.couldNotDeleteSummaryEntry"));
        return;
      }
      if (editingEntryId === entry.id) handleCancelEditEntry();
      setExpandedEntryIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    },
    [chatId, deleteSummaryEntry, editingEntryId, handleCancelEditEntry, localizeUi],
  );

  const persistPromptTemplates = useCallback(
    async (
      templates: ChatSummaryPromptTemplate[],
      activeId: string | null,
      combinePrompt = combinePromptDraft,
    ): Promise<boolean> => {
      if (!globalPromptSettingsReady || promptSettingsSaveLockedRef.current) return false;
      promptSettingsSaveLockedRef.current = true;
      setPromptSettingsSaveLocked(true);
      const normalizedCombinePrompt =
        combinePrompt.trim().slice(0, CHAT_SUMMARY_PROMPT_MAX_LENGTH) || DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT;
      const queuedSave = promptSettingsSaveQueueRef.current.then(async () => {
        try {
          await updateGlobalPromptSettings.mutateAsync({
            templates,
            activeTemplateId: activeId,
            combinePrompt: normalizedCombinePrompt,
          });
          return true;
        } catch {
          toast.error(localizeUi("ui.chat.summarypopover.couldNotSaveGlobalSummaryPromptSettings"));
          return false;
        } finally {
          promptSettingsSaveLockedRef.current = false;
          setPromptSettingsSaveLocked(false);
        }
      });
      promptSettingsSaveQueueRef.current = queuedSave.then(() => undefined);
      return queuedSave;
    },
    [combinePromptDraft, globalPromptSettingsReady, updateGlobalPromptSettings, localizeUi],
  );

  const commitCombinePromptDraft = useCallback(async (): Promise<boolean> => {
    combinePromptFocused.current = false;
    let nextPrompt =
      combinePromptDraftRef.current.trim().slice(0, CHAT_SUMMARY_PROMPT_MAX_LENGTH) ||
      DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT;
    const activeSave = combinePromptSaveRef.current;
    if (activeSave?.prompt === nextPrompt) return activeSave.promise;
    if (promptSettingsSaveLockedRef.current) {
      await promptSettingsSaveQueueRef.current;
      nextPrompt =
        combinePromptDraftRef.current.trim().slice(0, CHAT_SUMMARY_PROMPT_MAX_LENGTH) ||
        DEFAULT_CHAT_SUMMARY_COMBINE_PROMPT;
    }
    combinePromptDraftRef.current = nextPrompt;
    setCombinePromptDraft(nextPrompt);

    const pendingSave = combinePromptSaveRef.current;
    if (pendingSave?.prompt === nextPrompt) return pendingSave.promise;
    if (!pendingSave && nextPrompt === globalCombinePrompt) return true;

    const currentSettings = readCurrentPromptSettings();
    const promise = persistPromptTemplates(currentSettings.templates, currentSettings.activeTemplateId, nextPrompt);
    combinePromptSaveRef.current = { prompt: nextPrompt, promise };
    try {
      return await promise;
    } finally {
      if (combinePromptSaveRef.current?.promise === promise) {
        combinePromptSaveRef.current = null;
      }
    }
  }, [globalCombinePrompt, persistPromptTemplates, readCurrentPromptSettings]);

  const handleCombinePromptBlur = useCallback(async () => {
    await commitCombinePromptDraft();
  }, [commitCombinePromptDraft]);

  const handleClose = useCallback(async () => {
    if (await commitCombinePromptDraft()) onClose();
  }, [commitCombinePromptDraft, onClose]);

  // Close on outside interaction — defer by one frame so the synthesised
  // pointer event from the tap that *opened* the popover doesn't immediately
  // close it on touch devices (Android / iPadOS).
  useEffect(() => {
    const handler = (e: globalThis.PointerEvent) => {
      if (eventTargetsPanel(e)) return;
      if (isChatToolbarPanelTrigger(e.target, "summary")) return;
      const activeElement = document.activeElement;
      if (activeElement instanceof Node && panelRef.current?.contains(activeElement)) return;
      if (rangeInputFocused.current || sizeInputFocused.current || automaticIntervalFocused.current) return;
      if (panelRef.current) {
        void handleClose();
      }
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handler);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", handler);
    };
  }, [eventTargetsPanel, handleClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  const handleSelectPromptTemplate = useCallback(
    async (templateId: string | null) => {
      const currentSettings = readCurrentPromptSettings();
      const saved = await persistPromptTemplates(currentSettings.templates, templateId);
      if (!saved) return;
      setTemplateSelectOpen(false);
    },
    [persistPromptTemplates, readCurrentPromptSettings],
  );

  const resetTemplateDraft = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateNameDraft("");
    setTemplatePromptDraft("");
  }, []);

  const handleEditPromptTemplate = useCallback((template: ChatSummaryPromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateNameDraft(template.name);
    setTemplatePromptDraft(template.prompt);
    setTemplateEditorOpen(true);
  }, []);

  const handleNewPromptTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateNameDraft(
      localizeUi("chat.summary.template.defaultName", {
        number: cleanedPromptTemplates.length + 1,
      }),
    );
    setTemplatePromptDraft(DEFAULT_CHAT_SUMMARY_PROMPT);
    setTemplateEditorOpen(true);
  }, [cleanedPromptTemplates.length, localizeUi]);

  const handleDuplicatePromptTemplate = useCallback(
    (
      template: ChatSummaryPromptTemplate | null,
      builtInPrompt = isLongTermMemoryPromptSelected
        ? DEFAULT_LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT
        : DEFAULT_CHAT_SUMMARY_PROMPT,
    ) => {
      setEditingTemplateId(null);
      setTemplateNameDraft(
        localizeUi("chat.summary.template.copyName", {
          name: template?.name ?? localizeUi("ui.chat.summarypopover.builtInDefault"),
        }),
      );
      setTemplatePromptDraft(template?.prompt ?? builtInPrompt);
      setTemplateEditorOpen(true);
    },
    [isLongTermMemoryPromptSelected, localizeUi],
  );

  const handleEditActivePrompt = useCallback(() => {
    if (activePromptTemplate) {
      handleEditPromptTemplate(activePromptTemplate);
      return;
    }
    handleDuplicatePromptTemplate(null);
  }, [activePromptTemplate, handleDuplicatePromptTemplate, handleEditPromptTemplate]);

  const handleEditVisiblePrompt = useCallback(() => {
    if (summaryPromptView === "combine") {
      if (!combinePromptEditorOpen) setCombinePromptEditorOpen(true);
      return;
    }
    if (!templateEditorOpen) handleEditActivePrompt();
  }, [combinePromptEditorOpen, handleEditActivePrompt, summaryPromptView, templateEditorOpen]);

  const visiblePromptEditorOpen = summaryPromptView === "combine" ? combinePromptEditorOpen : templateEditorOpen;
  const handleToggleVisiblePromptEditor = useCallback(async () => {
    if (!visiblePromptEditorOpen) {
      setTemplateSelectOpen(false);
      handleEditVisiblePrompt();
      return;
    }
    if (summaryPromptView === "combine") {
      const saved = await commitCombinePromptDraft();
      if (saved) setCombinePromptEditorOpen(false);
      return;
    }
    setTemplateSelectOpen(false);
    setTemplateEditorOpen(false);
  }, [commitCombinePromptDraft, handleEditVisiblePrompt, summaryPromptView, visiblePromptEditorOpen]);

  const handleSavePromptTemplate = useCallback(async () => {
    if (!hasTemplateDraft) return;
    const trimmedName = templateNameDraft.trim().slice(0, 80);
    const trimmedPrompt = templatePromptDraft.trim();
    const currentSettings = readCurrentPromptSettings();
    const nextTemplates = isEditingExistingTemplate
      ? currentSettings.templates.map((template) =>
          template.id === editingTemplateId ? { ...template, name: trimmedName, prompt: trimmedPrompt } : template,
        )
      : [
          ...currentSettings.templates,
          {
            id: generateClientId(),
            name: trimmedName,
            prompt: trimmedPrompt,
          },
        ];
    const nextActiveId = isEditingExistingTemplate
      ? currentSettings.activeTemplateId
      : nextTemplates[nextTemplates.length - 1]!.id;
    const saved = await persistPromptTemplates(nextTemplates, nextActiveId ?? null);
    if (!saved) return;
    resetTemplateDraft();
  }, [
    editingTemplateId,
    hasTemplateDraft,
    isEditingExistingTemplate,
    persistPromptTemplates,
    readCurrentPromptSettings,
    resetTemplateDraft,
    templateNameDraft,
    templatePromptDraft,
  ]);

  const handleDeletePromptTemplate = useCallback(
    async (templateId: string) => {
      const target = cleanedPromptTemplates.find((template) => template.id === templateId);
      if (!target) return;
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.summarypopover.deleteSummaryTemplate"),
        message: localizeUi("chat.summary.deleteTemplateConfirmation", {
          name: target.name,
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        cancelLabel: localizeUi("chat.delete.dialog.cancel"),
        tone: "destructive",
      });
      if (!confirmed) return;
      const currentSettings = readCurrentPromptSettings();
      const nextTemplates = currentSettings.templates.filter((template) => template.id !== templateId);
      const saved = await persistPromptTemplates(
        nextTemplates,
        currentSettings.activeTemplateId === templateId ? null : currentSettings.activeTemplateId,
      );
      if (!saved) return;
      if (editingTemplateId === templateId) resetTemplateDraft();
    },
    [
      cleanedPromptTemplates,
      editingTemplateId,
      persistPromptTemplates,
      readCurrentPromptSettings,
      resetTemplateDraft,
      localizeUi,
    ],
  );

  const isGenerating = generateSummary.isPending;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const panelFrame = isMobile ? getMobileSummaryFrame(anchor) : getDesktopSummaryFrame(anchor);

  const handlePanelMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);
  const handlePanelPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const content = (
    <div
      ref={panelRef}
      data-chat-floating-panel
      onMouseDown={handlePanelMouseDown}
      onPointerDown={handlePanelPointerDown}
      className="fixed z-[9999]"
      style={panelFrame ? { top: panelFrame.top, left: panelFrame.left, width: panelFrame.width } : undefined}
    >
      <div
        className={cn(
          NEUTRAL_PANEL_SHELL,
          NEUTRAL_PANEL_SCROLL_AREA,
          "relative flex w-full flex-col overflow-hidden p-3",
        )}
        style={panelFrame ? { maxHeight: panelFrame.maxHeight } : undefined}
      >
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={NEUTRAL_PANEL_TITLE}>
              <ScrollText size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
              <span className="truncate">{localizeUi("chat.summary.toolbarLabel")}</span>
            </div>
            <p className={cn(NEUTRAL_PANEL_SUBTITLE, "truncate")}>
              {hasEntries
                ? localizeUi("chat.summary.headerActive", {
                    count: enabledEntryCount,
                    tokens: formatTokenCount(enabledTokenEstimate),
                  })
                : localizeUi("ui.chat.summarypopover.noSummariesYet")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void handleClose()}
              className={NEUTRAL_PANEL_CLOSE_BUTTON}
              aria-label={localizeUi("ui.chat.summarypopover.closeSummary")}
            >
              <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
            </button>
          </div>
        </div>

        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto pr-1")}>
          <div className="mb-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-2">
                <p className="px-1 text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">
                  {localizeUi("ui.chat.summarypopover.summaryScope")}
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--background)]/30 p-1">
                  {(["last", "range"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSourceModeChange(mode)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                        sourceMode === mode
                          ? "bg-[var(--accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {mode === "last"
                        ? localizeUi("ui.chat.summarypopover.last")
                        : localizeUi("ui.chat.summarypopover.range")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-2">
                <p className="px-1 text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">
                  {localizeUi("ui.chat.summarypopover.display")}
                </p>
                <SummarySettingsToggle
                  label={localizeUi("ui.chat.summarypopover.hideSummarisedMessages")}
                  checked={hideSummarisedResolved}
                  // Writes per-chat metadata only — never the global ui.store.
                  onChange={(checked) => updateMeta.mutate({ id: chatId, hideSummarisedMessages: checked })}
                />
                {hideSummarisedResolved && (
                  <div className="space-y-1 px-1 pb-0.5">
                    <label className="flex items-center justify-between gap-2 text-[0.6875rem] font-medium text-[var(--popover-foreground)]">
                      <span>{localizeUi("ui.chat.summarypopover.recentMessageTail")}</span>
                      <DraftNumberInput
                        ariaLabel={localizeUi("ui.chat.summarypopover.recentMessageTail")}
                        min={SUMMARY_TAIL_MESSAGES.MIN}
                        value={summaryTailMessages ?? SUMMARY_TAIL_MESSAGES.DEFAULT}
                        onCommit={(value) =>
                          updateMeta.mutate({
                            id: chatId,
                            summaryTailMessages: value,
                          })
                        }
                        className="w-16 rounded-md bg-[var(--secondary)] px-2 py-1 text-right text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
                      />
                    </label>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.summarypopover.mostRecentMessagesKeptWordForWordWhenAuto")}{" "}
                      <span className="font-medium">0</span>{" "}
                      {localizeUi("ui.chat.summarypopover.toHideTheWholeBatchHigherValuesIncreasePrompt")}
                    </p>
                  </div>
                )}
                <SummarySettingsToggle
                  label={localizeUi("ui.chat.summarypopover.collapseHiddenMessages")}
                  checked={summaryPopoverSettings.collapseHiddenMessages}
                  onChange={(checked) => setSummaryPopoverSettings({ collapseHiddenMessages: checked })}
                />
              </div>
            </div>

            {showSummaryInjectionHint && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 px-2.5 py-2 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                <Info size="0.75rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                <span>{summaryInjectionHint}</span>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {automaticSummariesAvailable && (
                <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">
                        {localizeUi("ui.chat.summarypopover.automaticSummaries")}
                      </p>
                      <p className="mt-0.5 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                        {automaticSummariesOn
                          ? localizeUi("chat.summary.automatic.updateInterval", {
                              count: normalizedAutomaticSummaryInterval,
                            })
                          : localizeUi("ui.chat.summarypopover.offForThisRoleplayChat")}
                      </p>
                    </div>
                    <SummarySettingsToggle
                      label={localizeUi("ui.noodle.noodlehome.enabled")}
                      checked={automaticSummariesOn}
                      onChange={handleAutomaticSummaryToggle}
                    />
                  </div>
                  <label className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--background)]/25 px-2 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                    <span>{localizeUi("ui.chat.summarypopover.every")}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        min={MIN_AUTOMATIC_SUMMARY_INTERVAL}
                        max={MAX_AUTOMATIC_SUMMARY_INTERVAL}
                        value={automaticIntervalDraft}
                        disabled={!automaticSummariesOn}
                        onFocus={() => {
                          automaticIntervalFocused.current = true;
                        }}
                        onChange={(event) => {
                          setAutomaticIntervalDraft(event.target.value);
                        }}
                        onBlur={() => {
                          automaticIntervalFocused.current = false;
                          persistAutomaticSummaryInterval(
                            clampAutomaticSummaryInterval(automaticIntervalDraft || DEFAULT_AUTOMATIC_SUMMARY_INTERVAL),
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        className="w-16 rounded-md bg-[var(--card)] px-2 py-1 text-center text-xs tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span>{localizeUi("ui.chat.summarypopover.userMessages")}</span>
                    </span>
                  </label>

                  {import.meta.env.VITE_MARINARA_LITE !== "true" && (
                    <div className="border-t border-[var(--border)]/70 pt-1">
                      <SummarySettingsToggle
                        label={localizeUi("ui.chat.summarypopover.semanticRetrieval")}
                        checked={semanticSummaryRetrievalEnabled}
                        onChange={(checked) =>
                          updateMeta.mutate({ id: chatId, semanticSummaryRetrievalEnabled: checked })
                        }
                      />
                      <p className="px-1.5 pb-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.summarypopover.semanticRetrievalDescription")}
                      </p>
                    </div>
                  )}

                  {backfillState.status === "running" && backfillState.chatId === chatId && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          role="progressbar"
                          aria-valuenow={backfillState.completedBatches}
                          aria-valuemin={0}
                          aria-valuemax={backfillState.totalBatches}
                          aria-labelledby="backfill-progress-label"
                          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                          style={{
                            width: `${backfillState.totalBatches > 0 ? (backfillState.completedBatches / backfillState.totalBatches) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p
                        id="backfill-progress-label"
                        className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]"
                      >
                        {backfillState.currentRangeStart && backfillState.currentRangeEnd
                          ? localizeUi("chat.summary.backfill.rangeProgress", {
                              start: backfillState.currentRangeStart,
                              end: backfillState.currentRangeEnd,
                              completed: backfillState.completedBatches,
                              total: backfillState.totalBatches,
                            })
                          : localizeUi("chat.summary.backfill.batchProgress", {
                              completed: backfillState.completedBatches,
                              total: backfillState.totalBatches,
                            })}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-1.5">
                    {backfillState.status === "running" && backfillState.chatId === chatId ? (
                      <button
                        type="button"
                        onClick={stopBackfill}
                        className="flex items-center gap-1.5 rounded-md bg-[var(--destructive)]/10 px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--destructive)] ring-1 ring-[var(--destructive)]/30 transition-colors hover:bg-[var(--destructive)]/20"
                      >
                        <Loader2 size="0.75rem" className="animate-spin" />
                        {localizeUi("ui.chat.summarypopover.stop")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleBackfill()}
                        disabled={totalMessageCount === 0 || !globalPromptSettingsReady}
                        className="flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw size="0.75rem" />
                        {localizeUi("ui.chat.summarypopover.backfillSummary")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2",
                  !automaticSummariesAvailable && "sm:col-span-2",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">
                      {localizeUi("ui.chat.summarypopover.summaryPrompt")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleVisiblePromptEditor()}
                    disabled={!globalPromptSettingsReady || (promptSettingsSaveLocked && !visiblePromptEditorOpen)}
                    aria-expanded={visiblePromptEditorOpen}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50",
                      visiblePromptEditorOpen
                        ? "bg-[var(--accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {visiblePromptEditorOpen
                      ? localizeUi("ui.chat.summarypopover.done")
                      : localizeUi("ui.noodle.noodlepostcard.edit")}
                  </button>
                </div>

                <div
                  role="tablist"
                  aria-label={localizeUi("ui.chat.summarypopover.summaryPromptView")}
                  className="grid grid-cols-2 rounded-md bg-[var(--background)]/30 p-0.5 ring-1 ring-[var(--border)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={summaryPromptView === "summary"}
                    onClick={() => setSummaryPromptView("summary")}
                    className={cn(
                      "rounded px-2 py-1 text-[0.625rem] font-semibold transition-colors",
                      summaryPromptView === "summary"
                        ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {localizeUi("ui.chat.summarypopover.chatSummaryPrompt")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={summaryPromptView === "combine"}
                    onClick={() => setSummaryPromptView("combine")}
                    className={cn(
                      "rounded px-2 py-1 text-[0.625rem] font-semibold transition-colors",
                      summaryPromptView === "combine"
                        ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {localizeUi("ui.chat.summarypopover.combinePrompt")}
                  </button>
                </div>

                {summaryPromptView === "summary" ? (
                  <div className="h-48 space-y-2 overflow-y-auto pr-0.5">
                    <div className="grid grid-cols-1 gap-1">
                      <div className="relative min-w-0">
                        <button
                          type="button"
                          onClick={() => setTemplateSelectOpen((open) => !open)}
                          disabled={!globalPromptSettingsReady || promptSettingsSaveLocked}
                          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--card)] py-1 pl-2 pr-2 text-left truncate text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-haspopup="listbox"
                          aria-expanded={templateSelectOpen}
                          aria-label={localizeUi("ui.chat.summarypopover.summaryPromptTemplate")}
                        >
                          <span className="min-w-0 truncate">{promptTemplateSummary}</span>
                          <ChevronRight
                            size="0.75rem"
                            className={cn(
                              "shrink-0 text-[var(--muted-foreground)] transition-transform",
                              templateSelectOpen && "rotate-90",
                            )}
                          />
                        </button>
                        {templateSelectOpen && (
                          <div
                            role="listbox"
                            className="mt-1 max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-xl shadow-black/25"
                          >
                            <SummaryPromptSelectOption
                              active={!normalizedActivePromptTemplateId}
                              label={localizeUi("ui.chat.summarypopover.builtInDefault")}
                              disabled={promptSettingsSaveLocked}
                              onSelect={() => void handleSelectPromptTemplate(null)}
                            />
                            {longTermMemorySummaryPromptAvailable && (
                              <SummaryPromptSelectOption
                                active={isLongTermMemoryPromptSelected}
                                label={localizeUi("chat.summary.template.longTermMemory")}
                                disabled={promptSettingsSaveLocked}
                                onSelect={() =>
                                  void handleSelectPromptTemplate(LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID)
                                }
                              />
                            )}
                            {cleanedPromptTemplates.map((template) => (
                              <SummaryPromptSelectOption
                                key={template.id}
                                active={normalizedActivePromptTemplateId === template.id}
                                label={template.name}
                                disabled={promptSettingsSaveLocked}
                                onSelect={() => void handleSelectPromptTemplate(template.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {!templateEditorOpen && (
                      <div className="h-36 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--background)]/25 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                        {activeSummaryPrompt}
                      </div>
                    )}

                    {templateEditorOpen && (
                      <div className="space-y-2 border-t border-[var(--border)] pt-2">
                        <div className="max-h-28 space-y-1 overflow-y-auto pr-0.5">
                          <SummaryPromptTemplateRow
                            active={!normalizedActivePromptTemplateId}
                            name={localizeUi("ui.chat.summarypopover.builtInDefault")}
                            detail={localizeUi("chat.summary.template.appDefault")}
                            disabled={promptSettingsSaveLocked}
                            onSelect={() => void handleSelectPromptTemplate(null)}
                            onCopy={() => handleDuplicatePromptTemplate(null, DEFAULT_CHAT_SUMMARY_PROMPT)}
                          />
                          {longTermMemorySummaryPromptAvailable && (
                            <SummaryPromptTemplateRow
                              active={isLongTermMemoryPromptSelected}
                              name={localizeUi("chat.summary.template.longTermMemory")}
                              detail={localizeUi("chat.summary.template.appDefault")}
                              disabled={promptSettingsSaveLocked}
                              onSelect={() => void handleSelectPromptTemplate(LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT_ID)}
                              onCopy={() =>
                                handleDuplicatePromptTemplate(null, DEFAULT_LONG_TERM_MEMORY_CHAT_SUMMARY_PROMPT)
                              }
                            />
                          )}
                          {cleanedPromptTemplates.map((template) => (
                            <SummaryPromptTemplateRow
                              key={template.id}
                              active={normalizedActivePromptTemplateId === template.id}
                              name={template.name}
                              detail={localizeUi("chat.summary.template.tokenEstimate", {
                                count: Math.ceil(template.prompt.length / 4),
                              })}
                              disabled={promptSettingsSaveLocked}
                              onSelect={() => void handleSelectPromptTemplate(template.id)}
                              onCopy={() => handleDuplicatePromptTemplate(template)}
                              onEdit={() => handleEditPromptTemplate(template)}
                              onDelete={() => void handleDeletePromptTemplate(template.id)}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleNewPromptTemplate}
                          disabled={!globalPromptSettingsReady || promptSettingsSaveLocked}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--border)] bg-[var(--accent)]/35 px-2 py-1.5 text-[0.625rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size="0.6875rem" />
                          {localizeUi("ui.chat.summarypopover.newTemplate")}
                        </button>

                        {(templateNameDraft || templatePromptDraft) && (
                          <div className="space-y-1.5 rounded-lg bg-[var(--background)]/30 p-2 ring-1 ring-[var(--border)]">
                            <input
                              value={templateNameDraft}
                              onChange={(event) => setTemplateNameDraft(event.target.value)}
                              disabled={promptSettingsSaveLocked}
                              maxLength={80}
                              placeholder={localizeUi("ui.chat.summarypopover.templateName")}
                              className="w-full rounded-md bg-[var(--card)] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <textarea
                              value={templatePromptDraft}
                              onChange={(event) => setTemplatePromptDraft(event.target.value)}
                              disabled={promptSettingsSaveLocked}
                              rows={8}
                              placeholder={localizeUi("ui.chat.summarypopover.promptInstructionsForSummaryGeneration")}
                              className="max-h-48 w-full resize-y rounded-md bg-[var(--card)] px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={resetTemplateDraft}
                                disabled={promptSettingsSaveLocked}
                                className="rounded-md px-2 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {localizeUi("chat.delete.dialog.cancel")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSavePromptTemplate()}
                                disabled={!hasTemplateDraft || promptSettingsSaveLocked || !globalPromptSettingsReady}
                                className="flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Save size="0.625rem" />
                                {isEditingExistingTemplate
                                  ? localizeUi("ui.noodle.noodlehome.save")
                                  : localizeUi("ui.characters.metadatatab.add")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 space-y-1 overflow-y-auto pr-0.5">
                    <span className="text-[0.625rem] font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.summarypopover.combinePrompt")}
                    </span>
                    {combinePromptEditorOpen ? (
                      <textarea
                        value={combinePromptDraft}
                        onFocus={() => {
                          combinePromptFocused.current = true;
                        }}
                        onChange={(event) => {
                          combinePromptDraftRef.current = event.target.value;
                          setCombinePromptDraft(event.target.value);
                        }}
                        onBlur={() => void handleCombinePromptBlur()}
                        maxLength={CHAT_SUMMARY_PROMPT_MAX_LENGTH}
                        rows={5}
                        disabled={!globalPromptSettingsReady || promptSettingsSaveLocked}
                        aria-label={localizeUi("ui.chat.summarypopover.combinePrompt")}
                        className="h-28 w-full resize-none rounded-md bg-[var(--card)] px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    ) : (
                      <div className="h-28 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--background)]/25 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                        {combinePromptDraft}
                      </div>
                    )}
                    <span className="block text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.summarypopover.combinePromptHelp")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">
                  {localizeUi("ui.chat.summarypopover.summaryConnection")}
                </p>
                <p className="mt-0.5 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.summarypopover.chooseTheModelConnectionUsedForManualAndAutomatic")}
                </p>
              </div>
              <select
                value={selectedSummaryConnectionId}
                onChange={(event) => handleSummaryConnectionChange(event.target.value)}
                disabled={updateMeta.isPending}
                className="w-full rounded-md bg-[var(--card)] px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={localizeUi("ui.chat.summarypopover.summaryConnection_febe5c4")}
              >
                <option value="">{defaultConnectionLabel}</option>
                {selectedSummaryConnectionMissing && (
                  <option value={selectedSummaryConnectionId}>
                    {localizeUi("chat.summary.connection.missing", {
                      id: selectedSummaryConnectionId,
                    })}
                  </option>
                )}
                {summaryConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {formatSummaryConnectionLabel(connection)}
                  </option>
                ))}
              </select>
              <label className="space-y-1">
                <span className="text-[0.625rem] font-semibold text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.summarypopover.maximumOutputSize")}
                </span>
                <input
                  type="number"
                  min={CHAT_SUMMARY_OUTPUT_TOKENS.MIN}
                  max={CHAT_SUMMARY_OUTPUT_TOKENS.MAX}
                  step={1}
                  value={summaryMaxTokensDraft}
                  onFocus={() => {
                    summaryMaxTokensFocused.current = true;
                  }}
                  onChange={(event) => {
                    setSummaryMaxTokensDraft(event.target.value);
                  }}
                  onBlur={() => {
                    summaryMaxTokensFocused.current = false;
                    void persistSummaryMaxTokens(summaryMaxTokensDraft).catch(() => undefined);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  disabled={updateMeta.isPending}
                  className="w-full rounded-md bg-[var(--card)] px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={localizeUi("ui.chat.summarypopover.summaryMaximumOutputSize")}
                />
              </label>
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="space-y-2">
              {hasPersistedEntries && (
                <div className="flex items-center justify-between gap-1.5 px-0.5">
                  <div>
                    {selectedEntries.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => void handleCombineSelected()}
                        disabled={combiningEntries || generateSummary.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)]/12 px-2 py-1 text-[0.625rem] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {combiningEntries ? (
                          <Loader2 size="0.6875rem" className="animate-spin" />
                        ) : (
                          <Sparkles size="0.6875rem" />
                        )}
                        {combiningEntries
                          ? localizeUi("ui.chat.summarypopover.combiningSummaries")
                          : localizeUi("ui.chat.summarypopover.combineSelectedSummaries", {
                              count: selectedEntries.length,
                            })}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {inactiveEntryCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowInactiveSummaries((show) => !show)}
                        className={cn(
                          "rounded-md px-1 py-0.5 text-[0.625rem] font-semibold transition-colors hover:text-[var(--foreground)]",
                          showInactiveSummaries ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                        )}
                      >
                        {showInactiveSummaries
                          ? localizeUi("ui.chat.summarypopover.hideInactive")
                          : localizeUi("ui.chat.summarypopover.showInactive")}
                      </button>
                    )}
                    {inactiveEntryCount === 0 && <span aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => void handleToggleAllEntries()}
                      disabled={entryMutationPending}
                      className="rounded-md px-1 py-0.5 text-[0.625rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {enabledEntryCount === 0
                        ? localizeUi("ui.chat.summarypopover.activateAll")
                        : localizeUi("ui.chat.summarypopover.deactivateAll")}
                    </button>
                  </div>
                </div>
              )}

              {tokenWarning && (
                <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--primary)]">
                  {localizeUi("chat.summary.enabledTokenWarning", {
                    tokens: formatTokenCount(enabledTokenEstimate),
                  })}
                </div>
              )}

              {allEntriesDisabled && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.summarypopover.allSummariesAreDisabledTheModelWillNotReceive")}
                </div>
              )}

              {draftEntry && !displayEntries.some((entry) => entry.id === draftEntry.id) && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.summarypopover.newManualSummarySaveItToIncludeItIn")}
                </div>
              )}

              {hasEntries ? (
                <div
                  ref={summaryEntryListRef}
                  data-summary-entry-root
                  className="space-y-2"
                  onDragOver={handleSummaryContainerDragOver}
                  onDrop={handleSummaryDrop}
                >
                  {visibleEntries.map((entry) => {
                    const entryIndex = displayEntries.findIndex((candidate) => candidate.id === entry.id);
                    const reorderable = entryIndex >= 0;
                    const showDropBefore =
                      reorderable &&
                      summaryDropIndex === entryIndex &&
                      draggingEntryIndex !== null &&
                      draggingEntryIndex !== entryIndex &&
                      draggingEntryIndex !== entryIndex - 1;
                    const showDropAfter =
                      reorderable &&
                      entryIndex === displayEntries.length - 1 &&
                      summaryDropIndex === displayEntries.length &&
                      draggingEntryIndex !== null &&
                      draggingEntryIndex !== entryIndex;

                    return (
                      <div key={entry.id}>
                        {showDropBefore && (
                          <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-2 h-0.5 rounded-full" />
                        )}
                        <SummaryEntryRow
                          entry={entry}
                          entryIndex={entryIndex}
                          entryCount={displayEntries.length}
                          reorderable={reorderable}
                          dragReady={dragReadyEntryIndex === entryIndex}
                          dragging={draggingEntryIndex === entryIndex}
                          expanded={expandedEntryIds.has(entry.id)}
                          editing={editingEntryId === entry.id}
                          draftEntry={editingEntryId === entry.id ? draftEntry : null}
                          textareaRef={entryTextareaRef}
                          mutationPending={entryMutationPending}
                          selected={selectedEntryIds.has(entry.id)}
                          onDragReadyChange={(ready) => setDragReadyEntryIndex(ready ? entryIndex : null)}
                          onDragStart={(event) => handleSummaryDragStart(entryIndex, event)}
                          onDragOver={(event) => handleSummaryDragOver(entryIndex, event)}
                          onDrop={(event) => {
                            event.stopPropagation();
                            handleSummaryDrop(event);
                          }}
                          onDragEnd={finishSummaryDrag}
                          onTouchStartDrag={(event) => {
                            event.stopPropagation();
                            startSummaryEntryTouchDrag(event, entry.id, {
                              allowInteractiveTarget: true,
                              sourceElement: event.currentTarget.closest<HTMLElement>(
                                '[data-touch-reorder-item="summary-entry"]',
                              ),
                            });
                          }}
                          onMoveUp={() => moveSummaryEntryByOffset(entryIndex, -1)}
                          onMoveDown={() => moveSummaryEntryByOffset(entryIndex, 1)}
                          onToggleSelected={() => handleToggleSelected(entry.id)}
                          onToggleExpanded={() => handleToggleExpanded(entry.id)}
                          onToggleEnabled={(enabled) => handleToggleEntry(entry, enabled)}
                          onStartEdit={() => handleStartEditEntry(entry)}
                          onCancelEdit={handleCancelEditEntry}
                          onSaveEdit={handleSaveEntry}
                          onDelete={() => void handleDeleteEntry(entry)}
                          dockedToFooter={entry.id === visibleEntries[visibleEntries.length - 1]?.id}
                        />
                        {showDropAfter && (
                          <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-2 h-0.5 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : allVisibleEntriesHidden ? (
                <button
                  type="button"
                  onClick={() => setShowInactiveSummaries(true)}
                  className="w-full rounded-t-lg rounded-b-none border border-b-0 border-dashed border-[var(--border)] bg-[var(--secondary)]/20 p-5 text-center text-xs italic text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/35"
                >
                  {localizeUi("ui.chat.summarypopover.inactiveSummariesAreHiddenShowInactiveSummariesToView")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateManualEntry}
                  className="w-full rounded-t-lg rounded-b-none border border-b-0 border-dashed border-[var(--border)] bg-[var(--secondary)]/20 p-5 text-center text-xs italic text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/35"
                >
                  {localizeUi("ui.chat.summarypopover.noSummariesYetGenerateOneOrWriteYourOwn")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Source controls */}
        <div className="border-t border-[var(--border)] bg-[var(--card)]/45 px-3 py-2.5">
          <div className="mb-2.5 space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">{sourceSummary}</p>
                <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{sourceDetail}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.chat.summarypopover.activePrompt")}
                </p>
                <p className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{promptTemplateSummary}</p>
              </div>
            </div>

            {sourceMode === "last" ? (
              <label className="flex items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                <span>{localizeUi("ui.chat.summarypopover.messages")}</span>
                <input
                  type="number"
                  min={MIN_SUMMARY_MESSAGES}
                  max={MAX_SUMMARY_MESSAGES}
                  value={localSize}
                  onFocus={() => {
                    sizeInputFocused.current = true;
                  }}
                  onChange={(e) => {
                    setLocalSize(e.target.value);
                    const next = parsePositiveInteger(e.target.value);
                    if (next !== null) {
                      setSummaryPopoverSettings({ contextSize: clampSummaryCount(next) });
                    }
                  }}
                  onBlur={() => {
                    sizeInputFocused.current = false;
                    const clamped = clampSummaryCount(parsePositiveInteger(localSize) ?? 50);
                    setLocalSize(String(clamped));
                    persistSummaryContextSize(clamped);
                  }}
                  className="w-16 rounded-md bg-[var(--card)] px-2 py-1 text-center text-xs tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.summarypopover.from")}
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, totalMessageCount)}
                      value={rangeStart}
                      onFocus={() => {
                        rangeInputFocused.current = true;
                      }}
                      onChange={(e) => {
                        setRangeStart(e.target.value);
                        const next = parsePositiveInteger(e.target.value);
                        if (next !== null) {
                          setSummaryPopoverSettings({
                            rangeStart: Math.max(1, Math.min(totalMessageCount || 1, next)),
                          });
                        }
                      }}
                      onBlur={() => {
                        rangeInputFocused.current = false;
                        setRangeStart(String(normalizedRangeStart));
                        setSummaryPopoverSettings({ rangeStart: normalizedRangeStart });
                      }}
                      className="w-full rounded-md bg-[var(--card)] px-2 py-1 text-center text-xs tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <label className="space-y-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.summarypopover.to")}
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, totalMessageCount)}
                      value={rangeEnd}
                      onFocus={() => {
                        rangeInputFocused.current = true;
                      }}
                      onChange={(e) => {
                        setRangeEnd(e.target.value);
                        const next = parsePositiveInteger(e.target.value);
                        if (next !== null) {
                          setSummaryPopoverSettings({
                            rangeEnd: Math.max(1, Math.min(totalMessageCount || 1, next)),
                          });
                        }
                      }}
                      onBlur={() => {
                        rangeInputFocused.current = false;
                        setRangeEnd(String(normalizedRangeEnd));
                        setSummaryPopoverSettings({ rangeEnd: normalizedRangeEnd });
                      }}
                      className="w-full rounded-md bg-[var(--card)] px-2 py-1 text-center text-xs tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                </div>
                {rangeTooLarge && (
                  <p className="px-0.5 text-[0.625rem] leading-snug text-[var(--destructive)]">{rangeErrorText}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-1.5">
            <button
              type="button"
              onClick={handleCreateManualEntry}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.98]"
              title={localizeUi("ui.chat.summarypopover.writeSummaryEntry")}
            >
              <PenLine size="0.8125rem" />
              {localizeUi("ui.chat.summarypopover.write")}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                isGenerating || !canGenerate
                  ? "cursor-not-allowed bg-[var(--secondary)] text-[var(--muted-foreground)]"
                  : "bg-[var(--secondary)] text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] active:scale-[0.98]",
              )}
              title={localizeUi("ui.chat.summarypopover.generateSummaryWithAi")}
            >
              {isGenerating ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Sparkles size="0.8125rem" />}
              {isGenerating
                ? localizeUi("ui.chat.summarypopover.generating")
                : localizeUi("ui.characters.characterclipcard.generate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

interface SummarySettingsToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SummarySettingsToggle({ label, checked, onChange }: SummarySettingsToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-[0.6875rem] text-[var(--popover-foreground)] transition-colors hover:bg-[var(--accent)]/50">
      <span className="min-w-0 truncate">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-[var(--muted-foreground)]"
      />
    </label>
  );
}

interface SummaryEntryRowProps {
  entry: ChatSummaryEntry;
  entryIndex: number;
  entryCount: number;
  reorderable: boolean;
  dragReady: boolean;
  dragging: boolean;
  expanded: boolean;
  editing: boolean;
  draftEntry: ChatSummaryEntry | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  mutationPending: boolean;
  selected: boolean;
  onDragReadyChange: (ready: boolean) => void;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onTouchStartDrag: (event: ReactTouchEvent<HTMLButtonElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (entry: ChatSummaryEntry) => void;
  onDelete: () => void;
  dockedToFooter?: boolean;
}

function SummaryEntryRow({
  entry,
  entryIndex,
  entryCount,
  reorderable,
  dragReady,
  dragging,
  expanded,
  editing,
  draftEntry,
  textareaRef,
  mutationPending,
  selected,
  onDragReadyChange,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTouchStartDrag,
  onMoveUp,
  onMoveDown,
  onToggleSelected,
  onToggleExpanded,
  onToggleEnabled,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  dockedToFooter = false,
}: SummaryEntryRowProps) {
  const { t: localizeUi } = useUiTranslation();
  const metaLine = getSummaryEntryMetaLine(entry, localizeUi);
  return (
    <div
      data-touch-reorder-item={reorderable ? "summary-entry" : undefined}
      data-touch-reorder-index={reorderable ? entryIndex : undefined}
      draggable={reorderable && dragReady}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group overflow-hidden rounded-lg border shadow-sm shadow-black/10 ring-1 ring-[var(--border)]/25 transition-all",
        dockedToFooter && "rounded-b-none border-b-0",
        expanded
          ? "border-[var(--primary)]/45 bg-[var(--accent)]/22 ring-[var(--primary)]/20"
          : "border-[var(--border)]/80 bg-[var(--secondary)]/28 hover:border-[var(--primary)]/30 hover:bg-[var(--accent)]/30",
        entry.enabled
          ? "text-[var(--foreground)]"
          : "border-dashed bg-[var(--secondary)]/14 text-[var(--muted-foreground)] opacity-75 ring-[var(--border)]/35",
        editing && "border-[var(--primary)]/60 bg-[var(--primary)]/10 ring-[var(--primary)]/30",
        dragging && "opacity-40",
      )}
    >
      <div className="grid grid-cols-[auto_auto_auto_1fr_auto] items-center gap-1.5 px-2 py-1.5">
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className={cn(
              "cursor-grab rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:cursor-grabbing",
              (!reorderable || mutationPending) && "pointer-events-none opacity-30",
            )}
            title={localizeUi("ui.chat.summaryentryrow.dragToReorder")}
            aria-label={localizeUi("ui.chat.summaryentryrow.dragToReorder")}
            tabIndex={reorderable ? undefined : -1}
            onMouseDown={() => onDragReadyChange(true)}
            onMouseUp={() => onDragReadyChange(false)}
            onTouchStart={onTouchStartDrag}
          >
            <GripVertical size="0.875rem" />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!reorderable || entryIndex === 0 || mutationPending}
              className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
              title={localizeUi("ui.chat.summaryentryrow.moveSummaryUp", { title: entry.title })}
              aria-label={localizeUi("ui.chat.summaryentryrow.moveSummaryUp", { title: entry.title })}
            >
              <ArrowUp size="0.75rem" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!reorderable || entryIndex === entryCount - 1 || mutationPending}
              className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
              title={localizeUi("ui.chat.summaryentryrow.moveSummaryDown", { title: entry.title })}
              aria-label={localizeUi("ui.chat.summaryentryrow.moveSummaryDown", { title: entry.title })}
            >
              <ArrowDown size="0.75rem" />
            </button>
          </div>
        </div>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          disabled={editing}
          className="h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
          aria-label={localizeUi("ui.chat.summaryentryrow.selectSummaryEntry", { title: entry.title })}
        />
        <button
          type="button"
          onClick={() => onToggleEnabled(!entry.enabled)}
          disabled={mutationPending}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            entry.enabled
              ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
              : "text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
          title={
            entry.enabled
              ? localizeUi("ui.chat.summaryentryrow.disableSummary")
              : localizeUi("ui.chat.summaryentryrow.enableSummary")
          }
          aria-label={
            entry.enabled
              ? localizeUi("ui.chat.summaryentryrow.disableSummary")
              : localizeUi("ui.chat.summaryentryrow.enableSummary")
          }
          aria-pressed={entry.enabled}
        >
          <Check size="0.6875rem" className={cn(!entry.enabled && "opacity-0")} />
        </button>

        <button type="button" onClick={onToggleExpanded} className="min-w-0 text-left">
          <div className="flex min-w-0 items-center gap-1.5">
            <SummaryEntryOriginIcon entry={entry} />
            <span className="min-w-0 truncate text-xs font-semibold">{entry.title}</span>
            {editing && (
              <span className="shrink-0 rounded bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--primary)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.editing")}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">{metaLine}</p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 rounded-md px-0.5 py-0.5 max-md:opacity-100 md:opacity-55 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onToggleExpanded}
            className={cn(
              "rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-90",
              expanded && "bg-[var(--accent)] text-[var(--foreground)]",
            )}
            title={
              expanded ? localizeUi("ui.panels.ttsconfigcard.collapse") : localizeUi("ui.panels.ttsconfigcard.expand")
            }
            aria-label={
              expanded
                ? localizeUi("ui.chat.summaryentryrow.collapseSummaryEntry")
                : localizeUi("ui.chat.summaryentryrow.expandSummaryEntry")
            }
          >
            <ChevronRight size="0.75rem" className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-90"
            title={localizeUi("ui.noodle.noodlepostcard.edit")}
            aria-label={localizeUi("ui.chat.summaryentryrow.editSummaryEntry")}
          >
            <PenLine size="0.75rem" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={mutationPending}
            className="rounded p-1 text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            title={localizeUi("lorebook.editor.batch.delete")}
            aria-label={localizeUi("ui.chat.summaryentryrow.deleteSummaryEntry")}
          >
            <Trash2 size="0.75rem" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)]/60 px-2.5 pb-2.5 pt-2">
          {editing && draftEntry ? (
            <SummaryEntryEditor
              entry={draftEntry}
              textareaRef={textareaRef}
              mutationPending={mutationPending}
              onCancel={onCancelEdit}
              onSave={onSaveEdit}
            />
          ) : (
            <div className="space-y-3 px-0.5 py-0.5">
              {parseSummarySections(entry.content).map((section, sectionIndex) => (
                <SummaryReadableSection
                  key={`${entry.id}-${section.title ?? "summary"}-${sectionIndex}`}
                  section={section}
                  sectionIndex={sectionIndex}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SummaryEntryEditorProps {
  entry: ChatSummaryEntry;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  mutationPending: boolean;
  onCancel: () => void;
  onSave: (entry: ChatSummaryEntry) => void;
}

function SummaryEntryEditor({ entry, textareaRef, mutationPending, onCancel, onSave }: SummaryEntryEditorProps) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState(() => ({ ...entry }));
  const metaLine = getSummaryEntryMetaLine(draft, localizeUi);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
        <span className="min-w-0 truncate">{metaLine || localizeUi("chat.summary.manual")}</span>
        <span>
          {draft.enabled
            ? localizeUi("ui.characters.lorebooktab.active")
            : localizeUi("ui.chat.summaryentryeditor.inactive")}
        </span>
      </div>
      <input
        value={draft.title}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        maxLength={120}
        placeholder={localizeUi("ui.chat.summaryentryeditor.summaryTitle")}
        className="w-full rounded-md bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <MacroTextarea
        textareaRef={textareaRef}
        value={draft.content}
        onChange={(content) => setDraft((current) => ({ ...current, content }))}
        rows={7}
        title={localizeUi("ui.chat.summaryentryeditor.summaryTitle")}
        ariaLabel={localizeUi("ui.chat.summaryentryeditor.writeOrPasteASummaryOfThisChat")}
        placeholder={localizeUi("ui.chat.summaryentryeditor.writeOrPasteASummaryOfThisChat")}
        className="max-h-64 min-h-36 rounded-md bg-[var(--card)] text-xs leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
          ~{formatTokenCount(estimateChatSummaryTokens(draft.content))} {localizeUi("ui.agents.agenteditor.tokens")}
        </span>
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={mutationPending || !draft.content.trim()}
            className="flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 py-1 text-[0.625rem] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size="0.625rem" />
            {localizeUi("ui.noodle.noodlehome.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryEntryOriginIcon({ entry }: { entry: ChatSummaryEntry }) {
  const { t: localizeUi } = useUiTranslation();
  if (entry.origin === "automated") {
    return (
      <Sparkles
        size="0.75rem"
        className="shrink-0 text-[var(--primary)]"
        aria-label={localizeUi("ui.chat.summaryentryoriginicon.automatedSummary")}
      />
    );
  }
  if (entry.origin === "legacy") {
    return (
      <ScrollText
        size="0.75rem"
        className="shrink-0 text-[var(--muted-foreground)]"
        aria-label={localizeUi("ui.chat.summaryentryoriginicon.legacySummary")}
      />
    );
  }
  return (
    <PenLine
      size="0.75rem"
      className="shrink-0 text-[var(--muted-foreground)]"
      aria-label={localizeUi("ui.chat.summaryentryoriginicon.manualSummary")}
    />
  );
}

interface SummaryReadableSectionProps {
  section: SummarySection;
  sectionIndex: number;
}

function SummaryReadableSection({ section, sectionIndex }: SummaryReadableSectionProps) {
  const paragraphs = section.lines
    .join("\n")
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0);

  return (
    <section className="space-y-1.5">
      {section.title && (
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.625rem] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)]">
            {sectionIndex + 1}
          </span>
          <h3 className="min-w-0 truncate text-[0.6875rem] font-semibold uppercase text-[var(--muted-foreground)]">
            {section.title}
          </h3>
        </div>
      )}
      <div className={cn("space-y-2", section.title && "pl-7")}>
        {paragraphs.map((paragraph, paragraphIndex) => {
          const lines = paragraph.split("\n").filter((line) => line.trim().length > 0);
          const isBulletList = lines.length > 0 && lines.every((line) => SUMMARY_BULLET_PATTERN.test(line.trim()));

          if (isBulletList) {
            return (
              <ul key={paragraphIndex} className="space-y-1 text-xs leading-relaxed text-[var(--foreground)]/85">
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="grid grid-cols-[0.75rem_1fr] gap-1.5">
                    <span className="pt-[0.1875rem] text-[var(--muted-foreground)]">•</span>
                    <span>{line.replace(SUMMARY_BULLET_PATTERN, "")}</span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={paragraphIndex} className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--foreground)]/85">
              {paragraph}
            </p>
          );
        })}
      </div>
    </section>
  );
}

interface SummaryPromptSelectOptionProps {
  active: boolean;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

function SummaryPromptSelectOption({ active, label, disabled, onSelect }: SummaryPromptSelectOptionProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded px-2 py-1.5 text-left text-[0.6875rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-[var(--accent)] text-[var(--popover-foreground)] ring-1 ring-[var(--border)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
      )}
    >
      <Check size="0.625rem" className={cn("shrink-0", active ? "opacity-100" : "opacity-0")} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

interface SummaryPromptTemplateRowProps {
  active: boolean;
  name: string;
  detail: string;
  disabled?: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function SummaryPromptTemplateRow({
  active,
  name,
  detail,
  disabled,
  onSelect,
  onCopy,
  onEdit,
  onDelete,
}: SummaryPromptTemplateRowProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
        active
          ? "bg-[var(--accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
          : "hover:bg-[var(--accent)]/45",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
        title={localizeUi("chat.summary.template.use", { name })}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1",
            active
              ? "bg-[var(--accent)] text-[var(--foreground)] ring-[var(--border)]"
              : "text-transparent ring-[var(--border)]",
          )}
        >
          <Check size="0.625rem" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.6875rem] font-semibold text-[var(--popover-foreground)]">{name}</span>
          <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">{detail}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className="shrink-0 rounded p-1 text-[var(--muted-foreground)] opacity-80 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        title={localizeUi("ui.chat.summaryprompttemplaterow.duplicateTemplate")}
        aria-label={localizeUi("ui.chat.summaryprompttemplaterow.duplicateTemplate")}
      >
        <Copy size="0.625rem" />
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] opacity-80 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          title={localizeUi("ui.chat.summaryprompttemplaterow.editTemplate")}
          aria-label={localizeUi("ui.chat.summaryprompttemplaterow.editTemplate")}
        >
          <PenLine size="0.625rem" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] opacity-80 transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-50"
          title={localizeUi("ui.chat.summaryprompttemplaterow.deleteTemplate")}
          aria-label={localizeUi("ui.chat.summaryprompttemplaterow.deleteTemplate")}
        >
          <Trash2 size="0.625rem" />
        </button>
      )}
    </div>
  );
}
