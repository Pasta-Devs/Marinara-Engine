// ──────────────────────────────────────────────
// Chat: Conversation View — Discord-style composite
// ──────────────────────────────────────────────
import {
  Suspense,
  lazy,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,

} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ChevronUp,
  Settings2,
  FolderOpen,
  GitBranch,
  Globe,
  Image as ImageIcon,
  MoreVertical,
  LayoutGrid,
  ScrollText,
} from "lucide-react";
import { ConversationMessage } from "./ConversationMessage";
import { ConversationInput } from "./ConversationInput";
import { SceneBanner, EndSceneBar } from "../../shared/scene-ui";
import {
  ChatBranchSelector,
  type ChatBranchSelectorHandle,
  getTranscriptRenderWindow,
  isNearTranscriptBottom,
  preserveTranscriptScrollAfterPrepend,
  readTranscriptScrollMetrics,
  scheduleTranscriptScrollWrite,
  scrollTranscriptToBottom,
  TRANSCRIPT_RENDER_WINDOW_STEP,
} from "../../shared/chat-ui/index";

import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { showConversationLocalNotification } from "../../../../shared/lib/local-notifications";
import { playNotificationPing } from "../../../../shared/lib/notification-sound";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../../../shared/lib/utils";
import { TOOLS_PANELS, useTopBarActions } from "../../../../shared/components/mobile-shell-actions";
import { usePageActivity } from "../../../../shared/hooks/use-page-activity";
import { ActiveWorldInfoButton, ActiveWorldInfoModal } from "../../../runtime/visuals/index";
import { invalidateCharacterCollectionQueries } from "../../../catalog/characters/index";

import { getConversationStatus } from "../../../../engine/modes/chat/autonomous/autonomous.service";
import { storageApi } from "../../../../shared/api/storage-api";
import type { CharacterMap, MessageSelectionToggle, PeekPromptOptions, PersonaInfo } from "../../shared/chat-ui/types";
import type { Message } from "../../../../engine/contracts/types/chat";
import { useUpdateChatMetadata } from "../../../catalog/chats/index";

const ConversationAutonomousEffects = lazy(async () => {
  const module = await import("./ConversationAutonomousEffects");
  return { default: module.ConversationAutonomousEffects };
});

const SummaryPopover = lazy(async () => {
  const module = await import("../../shared/chat-ui/index");
  return { default: module.SummaryPopover };
});

const SHEET_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getSheetFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest("[inert]")) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function setElementInert(element: HTMLElement | null, inert: boolean) {
  if (!element) return;
  element.toggleAttribute("inert", inert);
  (element as HTMLElement & { inert?: boolean }).inert = inert;
  if (inert) element.setAttribute("aria-hidden", "true");
  else element.removeAttribute("aria-hidden");
}

interface ConversationViewProps {
  chatId: string;
  messages: Message[] | undefined;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  pageCount: number;
  totalMessageCount: number;
  characterMap: CharacterMap;
  characterNames: string[];
  personaInfo?: PersonaInfo;
  chatMeta: Record<string, unknown>;
  chatName?: string;
  chatGroupId?: string | null;
  chatCharIds: string[];
  /** Active characters whose card CSS targets the typing indicator (exclusive mode only). */
  typingStyledCharacterIds?: Set<string>;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onPeekPrompt: (options?: PeekPromptOptions) => void;
  onToggleHiddenFromAI?: (messageId: string, current: boolean) => void;
  onBranch: (messageId: string) => void;
  lastAssistantMessageId: string | null;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
  onOpenGallery: () => void;
  multiSelectMode?: boolean;
  selectedMessageIds?: Set<string>;
  onToggleSelectMessage?: (toggle: MessageSelectionToggle) => void;
  connectedChatName?: string;
  onSwitchChat?: () => void;
  sceneInfo?: {
    variant: "origin" | "scene";
    sceneChatId?: string;
    sceneChatName?: string;
    originChatId?: string;
    description?: string;
  };
  onConcludeScene?: (sceneChatId: string) => void;
  onAbandonScene?: (sceneChatId: string) => void;
}

/** Return a display label for a day separator */
function formatDaySeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Group messages by day for day separators */
function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function chatMetaString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * A single "… is/are typing…" row. CSS hooks: `.mari-typing-indicator` (row),
 * `.mari-typing-dots` (the dots), `.mari-typing-text` (the label). `data-card-css`
 * scopes the row to a character in exclusive mode; `data-typing-name` exposes the
 * name(s) for `content: attr(data-typing-name)`.
 */
function TypingIndicatorRow({ names, cardCssId }: { names: string[]; cardCssId?: string }) {
  const label = names.join(", ");
  const verb = label.includes(",") || label.includes(" & ") ? "are" : "is";
  return (
    <div
      className="mari-typing-indicator flex items-center gap-2 px-4 py-1.5 text-[0.8125rem] text-[var(--text-secondary)]"
      data-card-css={cardCssId}
      data-typing-name={label}
    >
      <span className="mari-typing-dots flex gap-0.5">
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-secondary)]"
          style={{ animationDelay: "300ms" }}
        />
      </span>
      <span className="mari-typing-text italic">
        {label} {verb} typing...
      </span>
    </div>
  );
}

/** Check if a message's content uses "Name: text" format with known chat-member character names */
function hasNamePrefixFormat(msg: Message, characterMap: CharacterMap, chatCharacterIds: string[]): boolean {
  if (!msg.content) return false;
  const chatNames = new Set(
    chatCharacterIds
      .map((id) => characterMap.get(id)?.name?.toLowerCase())
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );
  if (!chatNames.size) return false;
  const lines = msg.content.split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const name = line.slice(0, colonIdx).trim();
      if (chatNames.has(name.toLowerCase())) return true;
    }
  }
  return false;
}

function isHiddenFromUser(message: Message) {
  try {
    const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
    return extra.hiddenFromUser === true;
  } catch {
    return false;
  }
}

function getAssistantNotificationName(message: Message, characterMap: CharacterMap, characterNames: string[]) {
  if (message.characterId) {
    const name = characterMap.get(message.characterId)?.name?.trim();
    if (name) return name;
  }
  return characterNames.length === 1 ? characterNames[0] : "Character";
}

const LIST_LINE_RE = /^\s*(?:[-*+]|\d+\.)\s/;
const TASK_LIST_LINE_RE = /^\s*[-*+] \[[ xX]\]\s/;
const LIST_CONTINUATION_LINE_RE = /^\s{2,}\S/;
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/;
const BLOCKQUOTE_LINE_RE = /^\s*>/;
const CODE_FENCE_LINE_RE = /^\s*`{3,}/;

function isListLine(line: string) {
  return LIST_LINE_RE.test(line) || TASK_LIST_LINE_RE.test(line);
}

function isListBlockLine(line: string) {
  return isListLine(line) || LIST_CONTINUATION_LINE_RE.test(line);
}

function chunkAssistantMarkdownBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (CODE_FENCE_LINE_RE.test(line)) {
      const block = [line];
      index++;
      while (index < lines.length) {
        const nextLine = lines[index]!;
        block.push(nextLine);
        index++;
        if (CODE_FENCE_LINE_RE.test(nextLine)) break;
      }
      blocks.push(block);
      continue;
    }

    if (TABLE_ROW_RE.test(line.trim())) {
      const block = [line];
      index++;
      while (index < lines.length && TABLE_ROW_RE.test(lines[index]!.trim())) {
        block.push(lines[index]!);
        index++;
      }
      blocks.push(block);
      continue;
    }

    if (isListLine(line)) {
      const block = [line];
      index++;
      while (index < lines.length && isListBlockLine(lines[index]!)) {
        block.push(lines[index]!);
        index++;
      }
      blocks.push(block);
      continue;
    }

    if (BLOCKQUOTE_LINE_RE.test(line)) {
      const block = [line];
      index++;
      while (index < lines.length && BLOCKQUOTE_LINE_RE.test(lines[index]!)) {
        block.push(lines[index]!);
        index++;
      }
      blocks.push(block);
      continue;
    }

    blocks.push([line]);
    index++;
  }

  return blocks;
}

function splitAssistantContentLines(content: string, charName?: string | null): string[] {
  const lines: string[] = [];
  let inCodeBlock = false;

  for (const line of content.split("\n")) {
    const t = line.trim();
    const isCodeFence = CODE_FENCE_LINE_RE.test(line);

    if (!inCodeBlock && !t) continue;
    if (!inCodeBlock && charName && (t === charName || t === `${charName}:`)) continue;

    lines.push(line);

    if (isCodeFence) {
      inCodeBlock = !inCodeBlock;
    }
  }

  return lines;
}

// Module-level set that remembers which message keys have been "seen" across
// component remounts. This prevents stagger animations and notification sounds
// from replaying when the user navigates away from a chat and comes back.
const globalSeenKeys = new Set<string>();

export function ConversationView({
  chatId,
  messages,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  pageCount,
  totalMessageCount,
  characterMap,
  personaInfo,
  chatMeta,
  chatName,
  chatGroupId,
  chatCharIds,
  typingStyledCharacterIds,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onPeekPrompt,
  onToggleHiddenFromAI,
  onBranch,
  lastAssistantMessageId,
  onOpenSettings,
  onOpenFiles,
  onOpenGallery,
  multiSelectMode,
  selectedMessageIds,
  onToggleSelectMessage,
  connectedChatName,
  onSwitchChat,
  sceneInfo,
  onConcludeScene,
  onAbandonScene,
}: ConversationViewProps) {
  const qc = useQueryClient();
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = useChatStore((s) => s.isStreaming) && streamingChatId === chatId;
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  const regenerateMessageId = useChatStore((s) => s.regenerateMessageId);
  const streamingCharacterId = useChatStore((s) => s.streamingCharacterId);
  const typingCharacterName = useChatStore((s) => s.typingCharacterName);
  const delayedCharacterInfo = useChatStore((s) => s.delayedCharacterInfo);
  const inactiveCharacterIdSet = useMemo(
    () => new Set(Array.isArray(chatMeta.inactiveCharacterIds) ? chatMeta.inactiveCharacterIds : []),
    [chatMeta.inactiveCharacterIds],
  );
  const activeChatCharIds = useMemo(
    () => chatCharIds.filter((id) => !inactiveCharacterIdSet.has(id)),
    [chatCharIds, inactiveCharacterIdSet],
  );
  const activeCharacterNames = useMemo(
    () => activeChatCharIds.map((id) => characterMap.get(id)?.name).filter((name): name is string => !!name),
    [activeChatCharIds, characterMap],
  );
  const liveTypingName = useMemo(() => {
    if (typingCharacterName) return typingCharacterName;
    if (streamingCharacterId) return characterMap.get(streamingCharacterId)?.name ?? "Character";
    if (activeChatCharIds.length === 1) return characterMap.get(activeChatCharIds[0]!)?.name ?? "Character";
    if (activeCharacterNames.length > 0) return activeCharacterNames.join(", ");
    return "Character";
  }, [activeCharacterNames, activeChatCharIds, characterMap, streamingCharacterId, typingCharacterName]);
  const liveTypingVerb = liveTypingName.includes(",") || liveTypingName.includes(" & ") ? "are" : "is";
  const showTypingIndicator =
    isStreaming && !delayedCharacterInfo && (!regenerateMessageId || (!streamBuffer && !thinkingBuffer));
  const liveTypingLabel = `${liveTypingName} ${liveTypingVerb} typing...`;

  // ── Group typing rows ──
  // Characters whose card CSS targets the typing indicator (exclusive mode) get their own
  // row so their custom text/styling applies in isolation; everyone else shares one combined
  // "A, B are typing…" row. The styled set is derived in ConversationModeRoute (empty unless
  // exclusive card-CSS mode is active, so chat/disabled modes keep the single combined row).
  //
  // We only split when the indicator can be tied to concrete character ids: the single
  // streaming character, or the explicit `typingCharacterName` mapped back to ids. Returning
  // `null` means "render one combined row from `liveTypingName`" — we never invent typists
  // from the full active roster when the runtime told us a specific (sub)set is typing.
  const typingParticipants = useMemo<Array<{ id: string; name: string }> | null>(() => {
    if (streamingCharacterId) {
      const name = characterMap.get(streamingCharacterId)?.name;
      return name ? [{ id: streamingCharacterId, name }] : null;
    }
    const nameToIds = new Map<string, string[]>();
    for (const id of activeChatCharIds) {
      const name = characterMap.get(id)?.name;
      if (name) nameToIds.set(name, [...(nameToIds.get(name) ?? []), id]);
    }
    if (typingCharacterName) {
      // The typing event lists the actual responders by name; only split if every name maps
      // to one concrete id (dedup by id). Duplicate display names are ambiguous, so keep the
      // explicit label as one row instead of attributing CSS to the wrong card.
      const names = typingCharacterName
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      if (names.length === 0 || names.some((name) => (nameToIds.get(name)?.length ?? 0) !== 1)) return null;
      const seen = new Set<string>();
      const participants: Array<{ id: string; name: string }> = [];
      for (const name of names) {
        const id = nameToIds.get(name)![0]!;
        if (!seen.has(id)) {
          seen.add(id);
          participants.push({ id, name });
        }
      }
      return participants;
    }
    // No streaming id and no explicit label → fall back to the active roster (matches the
    // pre-split `liveTypingName` fallback, which also listed every active character).
    const fromActive = activeChatCharIds
      .map((id) => ({ id, name: characterMap.get(id)?.name }))
      .filter((p): p is { id: string; name: string } => !!p.name);
    return fromActive.length > 0 ? fromActive : null;
  }, [streamingCharacterId, typingCharacterName, activeChatCharIds, characterMap]);
  const { typingStyledRows, typingPlainNames, typingPlainCardCssId } = useMemo(() => {
    // Couldn't resolve concrete participants → one combined row with the explicit live label.
    if (!typingParticipants) {
      return {
        typingStyledRows: [] as Array<{ id: string; name: string }>,
        typingPlainNames: [liveTypingName],
        typingPlainCardCssId: streamingCharacterId ?? activeChatCharIds[0] ?? undefined,
      };
    }
    const styled: Array<{ id: string; name: string }> = [];
    const plain: Array<{ id: string; name: string }> = [];
    for (const p of typingParticipants) {
      if (typingStyledCharacterIds?.has(p.id)) styled.push(p);
      else plain.push(p);
    }
    styled.sort((a, b) => a.name.localeCompare(b.name));
    plain.sort((a, b) => a.name.localeCompare(b.name));
    return {
      typingStyledRows: styled,
      typingPlainNames: plain.map((p) => p.name),
      typingPlainCardCssId: streamingCharacterId ?? plain[0]?.id ?? activeChatCharIds[0] ?? undefined,
    };
  }, [typingParticipants, typingStyledCharacterIds, streamingCharacterId, activeChatCharIds, liveTypingName]);

  const isPageActive = usePageActivity();

  // ── Periodic status refresh (every 60s) ──
  // Keeps status dots and activity text in sync with the character's schedule
  useEffect(() => {
    if (!chatId || !isPageActive) return;
    const refreshStatus = async () => {
      let changed = false;
      try {
        const statusResult = await getConversationStatus(storageApi, chatId);
        for (const [characterId, info] of Object.entries(statusResult.statuses)) {
          const row = await storageApi.get<{ data?: { extensions?: Record<string, unknown> } }>("characters", characterId);
          if (row?.data) {
            const extensions = row.data.extensions ?? {};
            const currentStatus = typeof extensions.conversationStatus === "string" ? extensions.conversationStatus : "";
            const currentActivity = typeof extensions.conversationActivity === "string" ? extensions.conversationActivity : "";
            if (currentStatus !== info.status || currentActivity !== info.activity) {
              await storageApi.update("characters", characterId, {
                data: {
                  ...row.data,
                  extensions: {
                    ...extensions,
                    conversationStatus: info.status,
                    conversationActivity: info.activity,
                  },
                },
              });
              changed = true;
            }
          }
        }
      } catch {
        /* non-critical */
      } finally {
        if (changed) {
          invalidateCharacterCollectionQueries(qc);
        }
      }
    };
    void refreshStatus();
    const timer = setInterval(refreshStatus, 60_000);
    return () => clearInterval(timer);
  }, [chatId, isPageActive, qc]);

  // Per-scheme conversation gradient from settings.
  // When a scheme's values are still the defaults (user hasn't customized), use
  // a CSS variable so custom themes can override the conversation background.
  const convoGradient = useUIStore((s) => s.convoGradient);
  const theme = useUIStore((s) => s.theme);

  const gradientStyle = useMemo(() => {
    const g = convoGradient[theme];
    const isDefaultDark = convoGradient.dark.from === "#0a0a0e" && convoGradient.dark.to === "#1c2133";
    const isDefaultLight = convoGradient.light.from === "#f2eff7" && convoGradient.light.to === "#eae6f0";
    if ((theme === "dark" && isDefaultDark) || (theme === "light" && isDefaultLight)) {
      return { background: "var(--secondary)" };
    }
    return { background: `linear-gradient(135deg, ${g.from}, ${g.to})` };
  }, [convoGradient, theme]);
  const hasAutonomousMessaging = !!chatMeta.autonomousMessages || !!chatMeta.characterExchanges;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mobileWorldInfoOpen, setMobileWorldInfoOpen] = useState(false);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const toolsSheetRef = useRef<HTMLDivElement>(null);
  const moreSheetRef = useRef<HTMLDivElement>(null);
  const lastSheetFocusRef = useRef<HTMLElement | null>(null);
  const skipSheetFocusRestoreRef = useRef(false);
  const { setRightSlot } = useTopBarActions();
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const [charActivityPopupId, setCharActivityPopupId] = useState<string | null>(null);
  const mobileBranchSelectorRef = useRef<ChatBranchSelectorHandle>(null);
  const updateMeta = useUpdateChatMetadata();
  const summaryContextSize =
    typeof chatMeta.summaryContextSize === "number" && Number.isFinite(chatMeta.summaryContextSize)
      ? chatMeta.summaryContextSize
      : 50;
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const [transcriptWindowStart, setTranscriptWindowStart] = useState<number | null>(null);
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userScrolledAtRef = useRef(0);
  const openedAtBottomChatIdRef = useRef<string | null>(null);
  const previousTailRef = useRef<{ messageId: string | undefined; isStreaming: boolean }>({
    messageId: undefined,
    isStreaming: false,
  });

  useEffect(() => {
    if (!charActivityPopupId) return;
    let removeClickListener = () => {};
    const timer = window.setTimeout(() => {
      const handleDocumentClick = () => setCharActivityPopupId(null);
      document.addEventListener("click", handleDocumentClick);
      removeClickListener = () => document.removeEventListener("click", handleDocumentClick);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      removeClickListener();
    };
  }, [charActivityPopupId]);

  useEffect(() => {
    const activeSheet = toolsSheetOpen ? toolsSheetRef.current : moreMenuOpen ? moreSheetRef.current : null;
    const content = sheetContentRef.current;
    setElementInert(content, !!activeSheet);
    if (!activeSheet) return;

    lastSheetFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusSheet = () => {
      if (!activeSheet.isConnected || activeSheet.contains(document.activeElement)) return;
      const [firstFocusable] = getSheetFocusableElements(activeSheet);
      (firstFocusable ?? activeSheet).focus();
    };
    const frame = window.requestAnimationFrame(focusSheet);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skipSheetFocusRestoreRef.current = false;
        setToolsSheetOpen(false);
        setMoreMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getSheetFocusableElements(activeSheet);
      if (focusable.length === 0) {
        event.preventDefault();
        activeSheet.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeElement = document.activeElement;
      if (!activeSheet.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      setElementInert(content, false);
      const previous = lastSheetFocusRef.current;
      if (!skipSheetFocusRestoreRef.current && previous?.isConnected) previous.focus();
      skipSheetFocusRestoreRef.current = false;
    };
  }, [toolsSheetOpen, moreMenuOpen]);

  // ── Scroll tracking ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const metrics = readTranscriptScrollMetrics(el);
      const nearBottom = isNearTranscriptBottom(metrics);
      if (isStreaming && metrics.scrollTop < lastScrollTopRef.current - 10) {
        userScrolledAwayRef.current = true;
      }
      // Re-engage auto-scroll when the user returns to the bottom,
      // but only if enough time has passed since their last wheel/touch
      // input. Without this cooldown, in-flight smooth-scroll animations
      // fire scroll events that immediately re-engage auto-scroll.
      if (nearBottom && Date.now() - userScrolledAtRef.current > 300) {
        userScrolledAwayRef.current = false;
      }
      lastScrollTopRef.current = metrics.scrollTop;
      isNearBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onUserScroll = () => {
      if (isStreaming) {
        userScrolledAwayRef.current = true;
        userScrolledAtRef.current = Date.now();
      }
    };
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) userScrolledAwayRef.current = false;
  }, [isStreaming]);

  // Auto-scroll on new messages / streaming / staggered reveals
  const newestMsgId = messages?.[messages.length - 1]?.id;
  const isOptimistic = newestMsgId?.startsWith("__optimistic_");
  useEffect(() => {
    const previousTail = previousTailRef.current;
    const tailMessageChanged = !!newestMsgId && !!previousTail.messageId && previousTail.messageId !== newestMsgId;
    const streamingStarted = isStreaming && !previousTail.isStreaming;
    if (transcriptWindowStart !== null && !isLoadingMoreRef.current && (tailMessageChanged || streamingStarted)) {
      setTranscriptWindowStart(null);
    }
    previousTailRef.current = { messageId: newestMsgId, isStreaming };
  }, [isStreaming, newestMsgId, transcriptWindowStart]);

  useLayoutEffect(() => {
    if (openedAtBottomChatIdRef.current === chatId || !messages?.length || isLoadingMoreRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    return scheduleTranscriptScrollWrite(() => {
      const currentElement = scrollRef.current;
      if (!currentElement || currentElement !== el || isLoadingMoreRef.current) return;
      lastScrollTopRef.current = scrollTranscriptToBottom(currentElement);
      isNearBottomRef.current = true;
      userScrolledAwayRef.current = false;
      openedAtBottomChatIdRef.current = chatId;
    });
  }, [chatId, messages?.length, newestMsgId]);

  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    // Always scroll when the user just sent a message (optimistic msg)
    if (isOptimistic || (isNearBottomRef.current && !userScrolledAwayRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [newestMsgId, streamBuffer, thinkingBuffer, isStreaming, delayedCharacterInfo, typingCharacterName, isOptimistic]);

  // Preserve scroll on load-more
  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && scrollRef.current && !isFetchingNextPage) {
      return scheduleTranscriptScrollWrite(() => {
        const element = scrollRef.current;
        if (!element || !isLoadingMoreRef.current) return;
        preserveTranscriptScrollAfterPrepend(element, prevScrollHeightRef.current);
        isLoadingMoreRef.current = false;
      });
    }
  }, [pageCount, isFetchingNextPage]);

  const handleLoadMore = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = readTranscriptScrollMetrics(scrollRef.current).scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    setTranscriptWindowStart(null);
  }, [chatId]);

  useEffect(() => {
    setRightSlot(
      <>
        <button
          type="button"
          onClick={() => {
            setToolsSheetOpen(false);
            setMoreMenuOpen((v) => !v);
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-all active:scale-90 hover:bg-[var(--accent)]/30 hover:text-[var(--foreground)]",
            moreMenuOpen && "bg-[var(--accent)]/30 text-[var(--foreground)]",
          )}
          title="More options"
          aria-label="More options"
          aria-expanded={moreMenuOpen}
        >
          <MoreVertical size="1.15rem" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMoreMenuOpen(false);
            setToolsSheetOpen((v) => !v);
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-all active:scale-90 hover:bg-[var(--accent)]/30 hover:text-[var(--foreground)]",
            toolsSheetOpen && "bg-[var(--accent)]/30 text-[var(--foreground)]",
          )}
          title="Tools"
          aria-label="Tools"
          aria-expanded={toolsSheetOpen}
        >
          <LayoutGrid size="1.15rem" />
        </button>
      </>,
    );
    return () => { setRightSlot(null); };
  }, [moreMenuOpen, toolsSheetOpen, setRightSlot]);

  // ── Build message list with day separators ──
  // Assistant messages with multiple lines are split into separate visual
  // messages so each line appears as its own bubble (Discord-style).
  // They stay as one record in the DB — only the display is split.
  // Strip leaked timestamps like [16:08] or [18.03.2026] from assistant content.
  const stripTimestamps = (text: string) =>
    text
      .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/gm, "")
      .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/gm, "")
      .trim();
  const transcriptWindow = useMemo(
    () => getTranscriptRenderWindow(messages, { startIndex: transcriptWindowStart }),
    [messages, transcriptWindowStart],
  );

  const handleShowOlderMessages = useCallback(() => {
    if (transcriptWindow.hiddenBeforeCount > 0) {
      setTranscriptWindowStart(Math.max(0, transcriptWindow.startIndex - TRANSCRIPT_RENDER_WINDOW_STEP));
      return;
    }
    if (!hasNextPage || isFetchingNextPage) return;
    setTranscriptWindowStart(0);
    handleLoadMore();
  }, [
    handleLoadMore,
    hasNextPage,
    isFetchingNextPage,
    transcriptWindow.hiddenBeforeCount,
    transcriptWindow.startIndex,
  ]);

  const handleShowNewerMessages = useCallback(() => {
    setTranscriptWindowStart((currentStart) => {
      const current = currentStart ?? transcriptWindow.startIndex;
      const next = Math.min(transcriptWindow.latestStartIndex, current + TRANSCRIPT_RENDER_WINDOW_STEP);
      return next >= transcriptWindow.latestStartIndex ? null : next;
    });
  }, [transcriptWindow.latestStartIndex, transcriptWindow.startIndex]);

  const renderedItems = useMemo(() => {
    const visibleMessages = transcriptWindow.messages;
    if (!visibleMessages) return [];
    // Offset so message numbers reflect absolute position in the full chat history,
    // not just the position within the paginated window.
    const messageOffset = totalMessageCount - transcriptWindow.totalLoadedCount;
    const items: Array<
      | { type: "separator"; key: string; label: string }
      | { type: "message"; key: string; msg: Message; isGrouped: boolean; index: number }
    > = [];
    let lastDay = "";
    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i]!;
      const originalIndex = transcriptWindow.startIndex + i;
      if (isHiddenFromUser(msg)) continue;
      const day = getDayKey(msg.createdAt);
      if (day !== lastDay) {
        items.push({ type: "separator", key: `sep-${day}`, label: formatDaySeparator(msg.createdAt) });
        lastDay = day;
      }
      const prev = i > 0 ? visibleMessages[i - 1]! : null;
      // Break grouping if >5 minutes apart (like Discord)
      const TIME_GAP_MS = 5 * 60 * 1000;
      const timeTooFar = prev
        ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > TIME_GAP_MS
        : false;
      // Break grouping when persona changes between consecutive user messages
      const personaChanged = (() => {
        if (!prev || prev.role !== "user" || msg.role !== "user") return false;
        const prevExtra = typeof prev.extra === "string" ? JSON.parse(prev.extra) : (prev.extra ?? {});
        const currExtra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
        const prevId = prevExtra.personaSnapshot?.personaId;
        const currId = currExtra.personaSnapshot?.personaId;
        // If either message lacks a snapshot, don't break grouping.
        if (!prevId || !currId) return false;
        return prevId !== currId;
      })();
      const grouped =
        !!prev &&
        !timeTooFar &&
        !personaChanged &&
        prev.role === msg.role &&
        prev.characterId === msg.characterId &&
        getDayKey(prev.createdAt) === day;

      // Split multi-line assistant messages into separate visual rows
      // Skip splitting for messages with <speaker> tags or Name: text format
      // (group chat merged mode) — those are handled by ConversationMessage's group renderer.
      const hasGroupFormat = msg.content.includes("<speaker=") || hasNamePrefixFormat(msg, characterMap, chatCharIds);
      if (msg.role === "assistant" && msg.content && !hasGroupFormat) {
        const cleaned = stripTimestamps(msg.content);
        // Strip lines that are just the character's name (LLM prefixing in group individual mode)
        const charName = msg.characterId ? characterMap.get(msg.characterId)?.name : null;
        const lines = splitAssistantContentLines(cleaned, charName);
        if (lines.length > 1) {
          const blocks = chunkAssistantMarkdownBlocks(lines);

          blocks.forEach((block, bi) => {
            const isLast = bi === blocks.length - 1;
            const content = block.join("\n");
            items.push({
              type: "message",
              key: `${msg.id}__block${bi}`,
              msg: isLast
                ? { ...msg, content }
                : {
                    ...msg,
                    content,
                    extra: { displayText: null, isGenerated: false, tokenCount: null, generationInfo: null },
                  },
              isGrouped: bi === 0 ? grouped : true,
              index: messageOffset + originalIndex,
            });
          });
          continue;
        }
      }

      // For single-line assistant messages, also strip timestamps and character name prefix
      let displayContent = msg.role === "assistant" && msg.content ? stripTimestamps(msg.content) : msg.content;
      if (msg.role === "assistant" && msg.characterId) {
        const cName = characterMap.get(msg.characterId)?.name;
        if (cName) {
          // Strip leading "CharacterName\n" or "CharacterName:\n" prefix
          const nameRe = new RegExp(`^\\s*${cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*\\n`, "i");
          displayContent = displayContent.replace(nameRe, "");
        }
      }
      const displayMsg = displayContent !== msg.content ? { ...msg, content: displayContent } : msg;
      items.push({
        type: "message",
        key: msg.id,
        msg: displayMsg,
        isGrouped: grouped,
        index: messageOffset + originalIndex,
      });
    }
    return items;
  }, [transcriptWindow, characterMap, chatCharIds, totalMessageCount]);

  // ── Staggered reveal for split assistant lines ──
  // When a new multi-line assistant message arrives, show lines one by one
  // with a small delay between each to feel like real messaging.
  const [hiddenLineKeys, setHiddenLineKeys] = useState<Set<string>>(new Set());
  const prevRenderedKeysRef = useRef<Set<string>>(new Set());
  // Track whether the initial data load has settled. Until it has, we treat
  // all arriving keys as "already seen" so re-mounting the component (or the
  // first async page of messages landing) never replays stagger/sounds.
  const initialLoadSettledRef = useRef(false);
  // Keep a persistent set of message keys we've already processed across
  // component remounts. This prevents sounds/stagger replaying when the user
  // navigates away and comes back to the same chat.
  const globalSeenKeysRef = useRef(globalSeenKeys);
  // Persist stagger timers in a ref so they survive effect re-runs caused by
  // query refetches arriving shortly after the initial message_saved upsert.
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reset stagger state when the active chat changes so no cross-chat leakage
  const prevChatIdRef = useRef(chatId);
  if (prevChatIdRef.current !== chatId) {
    prevChatIdRef.current = chatId;
    initialLoadSettledRef.current = false;
    prevRenderedKeysRef.current = new Set();
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];
    setHiddenLineKeys(new Set());
  }

  useLayoutEffect(() => {
    const currentKeys = new Set(renderedItems.filter((i) => i.type === "message").map((i) => i.key));

    // On the very first render that has messages, just snapshot the keys and
    // mark the initial load as settled — don't stagger or play sounds.
    if (!initialLoadSettledRef.current) {
      if (currentKeys.size > 0) {
        prevRenderedKeysRef.current = currentKeys;
        // Mark all current keys as globally seen so remount won't replay them
        for (const k of currentKeys) globalSeenKeysRef.current.add(k);
        initialLoadSettledRef.current = true;
      }
      return;
    }

    const prevKeys = prevRenderedKeysRef.current;
    const seenGlobal = globalSeenKeysRef.current;
    const now = Date.now();

    // Build a key → createdAt map for freshness checks.
    // Only messages created within the last 15 seconds are considered "live" —
    // older ones arrived via a cache refetch and should not trigger animation/sound.
    const FRESHNESS_MS = 15_000;
    const keyTimestampMap = new Map<string, number>();
    for (const item of renderedItems) {
      if (item.type === "message") {
        keyTimestampMap.set(item.key, new Date(item.msg.createdAt).getTime());
      }
    }

    // Find newly arrived split child lines (key has __line1, __line2, etc.)
    const newSplitChildren: string[] = [];
    // Find newly arrived non-split assistant messages (for notification sound)
    let newAssistantMessage: Message | null = null;

    for (const key of currentKeys) {
      if (!prevKeys.has(key) && !seenGlobal.has(key)) {
        // Check if this message is fresh (created recently, meaning it was
        // generated while the user is actively in this chat)
        const ts = keyTimestampMap.get(key) ?? 0;
        const isFresh = now - ts < FRESHNESS_MS;

        if (!isFresh) {
          // Stale message from cache refetch — silently mark as seen, skip animation
          continue;
        }

        if (/__block[1-9]\d*$/.test(key)) {
          newSplitChildren.push(key);
        } else if (/__block0$/.test(key)) {
          // First block of a split message — counts as new assistant message
          const item = renderedItems.find((i) => i.type === "message" && i.key === key);
          if (!newAssistantMessage && item?.type === "message" && item.msg.role === "assistant") {
            newAssistantMessage = item.msg;
          }
        } else {
          // Check if it's a new assistant message (not a split)
          const item = renderedItems.find((i) => i.type === "message" && i.key === key);
          if (item && item.type === "message" && item.msg.role === "assistant") {
            newAssistantMessage ??= item.msg;
          }
        }
      }
    }

    // Mark all current keys as globally seen
    for (const k of currentKeys) seenGlobal.add(k);
    prevRenderedKeysRef.current = currentKeys;

    // Play notification for the first new message appearance
    if (newAssistantMessage) {
      const uiState = useUIStore.getState();
      if (uiState.convoNotificationSound) {
        playNotificationPing(uiState.notificationSound, uiState.customNotificationSound);
      }
      void showConversationLocalNotification({
        enabled: uiState.conversationBrowserNotifications,
        characterName: getAssistantNotificationName(newAssistantMessage, characterMap, activeCharacterNames),
        tag: `marinara-conversation-${chatId}`,
      });
    }

    if (newSplitChildren.length === 0) {
      // Clear any orphaned hidden keys left by a previous stagger whose
      // reveal timers were cancelled (e.g. by a query refetch mid-stagger).
      // But only if no stagger is actively running — otherwise the refetch
      // would wipe the hidden keys and show everything instantly.
      if (staggerTimersRef.current.length === 0) {
        setHiddenLineKeys((prev) => (prev.size > 0 ? new Set() : prev));
      }
      return;
    }

    // Cancel any previous stagger before starting a new one
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];

    // Hide all new split children initially
    setHiddenLineKeys((prev) => {
      const next = new Set(prev);
      for (const k of newSplitChildren) next.add(k);
      return next;
    });

    // Reveal each one with a staggered delay (1.5s between each)
    newSplitChildren.forEach((key, idx) => {
      const delay = (idx + 1) * 1500;
      staggerTimersRef.current.push(
        setTimeout(() => {
          setHiddenLineKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          // Play ping for each revealed line
          const uiState = useUIStore.getState();
          if (uiState.convoNotificationSound) {
            playNotificationPing(uiState.notificationSound, uiState.customNotificationSound);
          }
          // Remove completed timer from the ref
          if (idx === newSplitChildren.length - 1) {
            staggerTimersRef.current = [];
          }
        }, delay),
      );
    });
    // No cleanup return here — timers are managed via staggerTimersRef and
    // must survive effect re-runs caused by query refetches. Cleanup on
    // unmount is handled by a separate effect below.
  }, [activeCharacterNames, characterMap, chatId, renderedItems]);

  // Clean up stagger timers on unmount only (empty deps = unmount cleanup)
  useEffect(() => {
    return () => {
      staggerTimersRef.current.forEach(clearTimeout);
      staggerTimersRef.current = [];
    };
  }, []);

  // Auto-scroll when staggered lines are revealed
  const hiddenCount = hiddenLineKeys.size;
  useEffect(() => {
    if (!isLoadingMoreRef.current && isNearBottomRef.current && !userScrolledAwayRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hiddenCount]);

  // When the message currently generating has a bubble in the list, render the typing
  // indicator inside that bubble; otherwise it falls back to the standalone row below.
  // ConversationMessage only renders typingLabel when its body is empty, so we may only
  // route into a bubble that will actually be empty at render time:
  //   • regeneration — the target bubble's content is cleared while we wait, or
  //   • a deliberately-empty placeholder message.
  // A brand-new generation otherwise targets lastAssistantMessageId (the previous, NON-empty
  // assistant message); routing into it would swallow the indicator and show no feedback, so
  // we leave the standalone row alive in that case.
  const typingTargetId = showTypingIndicator ? (regenerateMessageId ?? lastAssistantMessageId) : null;
  const typingLabelInMessage =
    !!typingTargetId &&
    renderedItems.some((item) => {
      if (item.type !== "message") return false;
      if (!(item.msg.id === typingTargetId || item.key.startsWith(typingTargetId + "__"))) return false;
      return regenerateMessageId != null || (item.msg.content ?? "").trim() === "";
    });

  return (
    <div
      className="mari-chat-area mari-card-css relative flex flex-1 flex-col overflow-hidden"
      data-chat-mode="conversation"
      style={{ ...gradientStyle, isolation: "isolate" }}
    >
      <div ref={sheetContentRef} className="flex min-h-0 flex-1 flex-col">
      {/* ── Messages scroll area ── */}
      <div ref={scrollRef} className="mari-messages-scroll flex-1 overflow-y-auto overflow-x-hidden">
        {/* Desktop floating header */}
        <div className="sticky top-0 z-10 hidden min-w-0 items-center justify-between px-4 py-2 md:flex">
          {/* Character identity pill */}
          {(() => {
            const chars = chatCharIds
              .map((id) => {
                const character = characterMap.get(id);
                return character ? { id, ...character } : null;
              })
              .filter(Boolean) as Array<{
              id: string;
              name: string;
              avatarUrl: string | null;
              avatarCrop?: AvatarCropValue | null;
              conversationStatus?: "online" | "idle" | "dnd" | "offline";
              conversationActivity?: string;
            }>;
            if (chars.length === 0) return <div />;

            const statusColor = (s?: string) => {
              const st = s ?? "online";
              return st === "online"
                ? "bg-green-500"
                : st === "idle"
                  ? "bg-yellow-500"
                  : st === "dnd"
                    ? "bg-red-500"
                    : "bg-gray-400";
            };

            if (chars.length === 1) {
              const c = chars[0]!;
              return (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg bg-[var(--card)]/80 px-2.5 py-1.5 backdrop-blur-sm dark:bg-black/30 cursor-pointer hover:bg-[var(--card)] transition-colors"
                  onClick={() => setTrackerPanelOpen(true)}
                  title="View schedule"
                  aria-label={c.name}
                >
                  <div className="relative flex-shrink-0">
                    {c.avatarUrl ? (
                      <span className="relative block h-5 w-5 overflow-hidden rounded-full">
                        <img
                          src={c.avatarUrl}
                          alt={c.name}
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(c.avatarCrop)}
                        />
                      </span>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/20 text-[0.5rem] font-bold text-foreground">
                        {c.name[0]}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-[1.5px] ring-[var(--border)] ${statusColor(c.conversationStatus)}`}
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[0.75rem] font-medium text-foreground/90">{c.name}</span>
                    {c.conversationActivity && (
                      <span className="text-[0.5625rem] text-foreground/50">{c.conversationActivity}</span>
                    )}
                  </div>
                </button>
              );
            }

            // Multiple characters — individual clickable avatars showing activity on click
            return (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--card)]/80 px-2.5 py-1.5 backdrop-blur-sm dark:bg-black/30">
                <div
                  className="relative flex-shrink-0"
                  style={{ width: `${Math.min(chars.length, 3) * 12 + 8}px`, height: 20 }}
                >
                  {chars.slice(0, 3).map((c, i) => {
                    const isOpen = charActivityPopupId === c.id;
                    return (
                      <div key={c.id} className="absolute top-0" style={{ left: i * 12, zIndex: isOpen ? 10 : 3 - i }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCharActivityPopupId(isOpen ? null : c.id);
                          }}
                          className="relative block transition-transform active:scale-90"
                          aria-label={c.name}
                        >
                          {c.avatarUrl ? (
                            <span className="relative block h-5 w-5 overflow-hidden rounded-full ring-1 ring-[var(--border)]">
                              <img
                                src={c.avatarUrl}
                                alt={c.name}
                                className="h-full w-full object-cover"
                                style={getAvatarCropStyle(c.avatarCrop)}
                              />
                            </span>
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/20 text-[0.5rem] font-bold text-foreground ring-1 ring-[var(--border)]">
                              {c.name[0]}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-[1px] ring-[var(--border)] ${statusColor(c.conversationStatus)}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="absolute left-1/2 top-full mt-1.5 z-50 min-w-[7rem] -translate-x-1/2 rounded-xl border border-[var(--border)]/60 bg-[var(--card)] px-3 py-2 shadow-lg backdrop-blur-xl">
                            <p className="text-[0.7rem] font-semibold text-[var(--foreground)] leading-tight">{c.name}</p>
                            {c.conversationActivity && (
                              <p className="mt-0.5 text-[0.6rem] text-[var(--muted-foreground)]/70 leading-tight">{c.conversationActivity}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[0.75rem] font-medium text-[var(--foreground)]/90">
                  {chars.length <= 2 ? chars.map((c) => c.name).join(" & ") : `${chars[0]!.name} + ${chars.length - 1}`}
                </span>
              </div>
            );
          })()}

          {/* Desktop toolbar */}
          <div className="flex items-center gap-1.5">
          <ChatBranchSelector
            activeChatId={chatId}
            activeChatName={chatName}
            groupId={chatGroupId}
          />
          <button
            onClick={() => setSummaryOpen(true)}
            className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30 dark:hover:bg-black/50"
            title="Chat Summary"
            aria-label="Chat Summary"
          >
            <ScrollText size="0.875rem" />
          </button>
          <ActiveWorldInfoButton chatId={chatId} />
          <button
            onClick={onOpenGallery}
            className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30 dark:hover:bg-black/50"
            title="Gallery"
            aria-label="Gallery"
          >
            <ImageIcon size="0.875rem" />
          </button>
          <button
            onClick={onOpenFiles}
            className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30 dark:hover:bg-black/50"
            title="Chat Files"
            aria-label="Chat Files"
          >
            <FolderOpen size="0.875rem" />
          </button>
          {onSwitchChat && (
            <button
              onClick={onSwitchChat}
              className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30 dark:hover:bg-black/50"
              title={connectedChatName ? `Switch to ${connectedChatName}` : "Switch to connected chat"}
            >
              <span className="text-[0.7rem] font-medium">{connectedChatName || "Switch"}</span>
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30 dark:hover:bg-black/50"
            title="Chat Settings"
            aria-label="Chat Settings"
          >
            <Settings2 size="0.875rem" />
          </button>
        </div>
      </div>
      {/* Load More */}
        {(hasNextPage || transcriptWindow.hiddenBeforeCount > 0) && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleShowOlderMessages}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {isFetchingNextPage ? <Loader2 size="0.75rem" className="animate-spin" /> : <ChevronUp size="0.75rem" />}
              {transcriptWindow.hiddenBeforeCount > 0 ? "Older Messages" : "Load More"}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)]/20 border-t-[var(--muted-foreground)]/60" />
          </div>
        )}

        {/* Welcome message at the start of a conversation */}
        {!isLoading && !hasNextPage && messages && messages.length === 0 && (
          <div className="px-4 pt-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              This is the start of your conversation with{" "}
              <span className="font-medium text-[var(--foreground)]">
                {(() => {
                  const names = chatCharIds.map((id) => characterMap.get(id)?.name).filter(Boolean) as string[];
                  if (names.length === 0) return "this group";
                  if (names.length === 1) return names[0];
                  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
                })()}
              </span>
              . Say hi!
            </p>
          </div>
        )}

        {/* Messages with day separators */}
        {(() => {
          const filtered = renderedItems.filter((item) => item.type !== "message" || !hiddenLineKeys.has(item.key));
          const elements: React.ReactNode[] = [];
          let i = 0;
          while (i < filtered.length) {
            const item = filtered[i]!;
            if (item.type === "separator") {
              elements.push(
                <div key={item.key} className="relative my-4 flex items-center px-4">
                  <div className="flex-1 border-t border-[var(--border)]/40" />
                  <span className="mx-4 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                    {item.label}
                  </span>
                  <div className="flex-1 border-t border-[var(--border)]/40" />
                </div>,
              );
              i++;
              continue;
            }

            // Check if this starts a split assistant-message group.
            // Older code/comments called these "line" groups, but the actual
            // rendered keys use __blockN.
            const isSplitStart = item.key.endsWith("__block0") || item.key.endsWith("__line0");
            if (isSplitStart) {
              const baseId = item.key.replace(/__(?:block|line)0$/, "");
              const groupItems = [item];
              let j = i + 1;
              while (
                j < filtered.length &&
                filtered[j]!.type === "message" &&
                (filtered[j]!.key.startsWith(baseId + "__block") || filtered[j]!.key.startsWith(baseId + "__line"))
              ) {
                groupItems.push(filtered[j]! as typeof item);
                j++;
              }
              elements.push(
                <SplitMessageGroup
                  key={`split-${baseId}`}
                  items={groupItems}
                  isStreaming={isStreaming}
                  regenerateMessageId={regenerateMessageId}
                  streamBuffer={streamBuffer}
                  thinkingBuffer={thinkingBuffer}
                  lastAssistantMessageId={lastAssistantMessageId}
                  characterMap={characterMap}
                  personaInfo={personaInfo}
                  chatCharacterIds={chatCharIds}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onSetActiveSwipe={onSetActiveSwipe}
                  onPeekPrompt={onPeekPrompt}
                  onToggleHiddenFromAI={onToggleHiddenFromAI}
                  onBranch={onBranch}
                  typingLabel={typingLabelInMessage && item.msg.id === typingTargetId ? liveTypingLabel : undefined}
                />,
              );
              i = j;
              continue;
            }

            // Regular single message
            const { msg, isGrouped } = item;
            const isRegenerating = isStreaming && regenerateMessageId === msg.id;
            // During regeneration, don't pass isStreaming until content arrives — the
            // "X is typing..." indicator inside the message body provides feedback, and the
            // old content is cleared while waiting so the indicator shows in an empty bubble.
            const hasStreamContent = isRegenerating && (!!streamBuffer || !!thinkingBuffer);
            // Strip old-swipe attachments during regeneration so a previous
            // illustration doesn't linger while new text is streaming in.
            const displayMsg = isRegenerating
              ? (() => {
                  const parsed = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
                  return {
                    ...msg,
                    content: streamBuffer || (thinkingBuffer ? "Thinking..." : ""),
                    extra: { ...parsed, attachments: null, thinking: thinkingBuffer || parsed.thinking },
                  };
                })()
              : msg;
            elements.push(
              <ConversationMessage
                key={item.key}
                message={displayMsg}
                isStreaming={hasStreamContent}
                isGrouped={isGrouped}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onSetActiveSwipe={onSetActiveSwipe}
                onPeekPrompt={onPeekPrompt}
                onToggleHiddenFromAI={onToggleHiddenFromAI}
                onBranch={onBranch}
                isLastAssistantMessage={msg.id === lastAssistantMessageId}
                characterMap={characterMap}
                personaInfo={personaInfo}
                chatCharacterIds={chatCharIds}
                messageIndex={item.index + 1}
                messageOrderIndex={item.index}
                multiSelectMode={multiSelectMode}
                isSelected={selectedMessageIds?.has(msg.id)}
                onToggleSelect={onToggleSelectMessage}
                typingLabel={typingLabelInMessage && msg.id === typingTargetId ? liveTypingLabel : undefined}
              />,
            );
            i++;
          }
          return elements;
        })()}

        {transcriptWindow.hiddenAfterCount > 0 && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleShowNewerMessages}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
            >
              Newer Messages
            </button>
          </div>
        )}

        {/* Delayed indicator (DND/idle — waiting for character to become available) */}
        {delayedCharacterInfo && isStreaming && !streamBuffer && !thinkingBuffer && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[0.8125rem] text-[var(--text-secondary)]">
            <span className="italic">
              {delayedCharacterInfo.status === "dnd"
                ? `${delayedCharacterInfo.name} ${delayedCharacterInfo.name.includes(",") ? "are" : "is"} busy — they'll respond when they're back`
                : `${delayedCharacterInfo.name} ${delayedCharacterInfo.name.includes(",") ? "are" : "is"} away — they'll respond in a moment`}
            </span>
          </div>
        )}

        {/* Typing indicator — shown when generation is actively running.
            CSS-targetable per character via data-card-css. Hooks:
              .mari-typing-indicator  — the row
              .mari-typing-dots        — the bouncing dots (style `.mari-typing-dots span`)
              .mari-typing-text        — the "X is typing..." label
            data-typing-name carries the character name (usable as content: attr(data-typing-name)).
            In group chats, characters whose card CSS targets these hooks (exclusive mode) get
            their own row so their custom text applies in isolation; the rest share one row. */}
        {showTypingIndicator && !typingLabelInMessage && (
          <>
            {/* Combined row for characters without typing-targeted CSS (shown first). When no
                concrete participants resolve, this carries the single live typing label. */}
            {typingPlainNames.length > 0 && (
              <TypingIndicatorRow names={typingPlainNames} cardCssId={typingPlainCardCssId} />
            )}
            {/* One row per character whose card CSS targets the typing indicator (alphabetical). */}
            {typingStyledRows.map((p) => (
              <TypingIndicatorRow key={p.id} names={[p.name]} cardCssId={p.id} />
            ))}
          </>
        )}

        {/* Scene banner — inline at bottom of messages (origin variant only) */}
        {sceneInfo?.variant === "origin" && (
          <SceneBanner variant="origin" sceneChatId={sceneInfo.sceneChatId} sceneChatName={sceneInfo.sceneChatName} />
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── Autonomous message toast notification ── */}
      {hasAutonomousMessaging && (
        <Suspense fallback={null}>
          <ConversationAutonomousEffects
            key={chatId}
            chatId={chatId}
            messages={messages}
            characterMap={characterMap}
            chatMeta={chatMeta}
          />
        </Suspense>
      )}

      {/* ── End Scene bar (above input) ── */}
      {sceneInfo?.variant === "scene" && sceneInfo.sceneChatId && onConcludeScene && (
        <EndSceneBar
          sceneChatId={sceneInfo.sceneChatId}
          originChatId={sceneInfo.originChatId}
          onConclude={onConcludeScene}
          onAbandon={onAbandonScene}
        />
      )}

      {/* ── Input area ── */}
      <ConversationInput
        key={chatId}
        characterNames={activeCharacterNames}
        groupResponseOrder={
          activeChatCharIds.length > 1
            ? chatMeta.groupResponseOrder === "manual"
              ? "manual"
              : chatMetaString(chatMeta.groupResponseOrder, "sequential")
            : undefined
        }
        chatCharacters={
          activeChatCharIds.length > 1
            ? activeChatCharIds
                .filter((id) => characterMap.has(id))
                .map((id) => {
                  const info = characterMap.get(id)!;
                  return {
                    id,
                    name: info.name,
                    avatarUrl: info.avatarUrl ?? null,
                    avatarCrop: info.avatarCrop ?? null,
                    conversationStatus: info.conversationStatus,
                    conversationActivity: info.conversationActivity,
                  };
                })
            : undefined
        }
        onPeekPrompt={onPeekPrompt}
      />
      </div>

      {/* Tools top sheet */}
      {toolsSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setToolsSheetOpen(false)}
          />
          <div
            ref={toolsSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Tools"
            tabIndex={-1}
            className="fixed left-0 right-0 z-[9999] max-h-[70dvh] overflow-y-auto rounded-b-3xl border-b border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl animate-fade-in-down md:hidden"
            style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
          >
            <p className="px-5 pt-4 pb-3 text-[0.7rem] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
              Panels
            </p>
            <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 overflow-hidden">
              {TOOLS_PANELS.map(({ panel, icon: Icon, label, gradient }) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => {
                    skipSheetFocusRestoreRef.current = true;
                    setToolsSheetOpen(false);
                    setSidebarOpen(false);
                    closeAllDetails();
                    openRightPanel(panel);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)]/50 bg-[var(--secondary)]/50 p-4 text-left transition-all active:scale-95 hover:border-[var(--border)]"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                      gradient,
                    )}
                  >
                    <Icon size="1rem" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* More options top sheet */}
      {moreMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            tabIndex={-1}
            className="fixed left-0 right-0 z-[9999] max-h-[70dvh] overflow-y-auto rounded-b-3xl border-b border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl animate-fade-in-down md:hidden"
            style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
          >
            <div className="flex flex-col py-3">
              {chatGroupId && (
                <div className="relative">
                  <button
                    type="button"
                    className="relative flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      mobileBranchSelectorRef.current?.toggle();
                    }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                      <GitBranch size="0.9rem" />
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">Branches</span>
                  </button>
                  <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden="true">
                    <ChatBranchSelector
                      ref={mobileBranchSelectorRef}
                      activeChatId={chatId}
                      activeChatName={chatName}
                      groupId={chatGroupId}
                      compact
                      triggerAriaHidden
                      triggerTabIndex={-1}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => { skipSheetFocusRestoreRef.current = true; setMoreMenuOpen(false); setSummaryOpen(true); }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                  <ScrollText size="0.9rem" />
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">Summary</span>
              </button>
              <button
                type="button"
                onClick={() => { skipSheetFocusRestoreRef.current = true; setMoreMenuOpen(false); setMobileWorldInfoOpen(true); }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-sm">
                  <Globe size="0.9rem" />
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">World Info</span>
              </button>
              <button
                type="button"
                onClick={() => { skipSheetFocusRestoreRef.current = true; setMoreMenuOpen(false); onOpenGallery(); }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-sm">
                  <ImageIcon size="0.9rem" />
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => { skipSheetFocusRestoreRef.current = true; setMoreMenuOpen(false); onOpenFiles(); }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-sm">
                  <FolderOpen size="0.9rem" />
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">Chat Files</span>
              </button>
              <div className="mx-5 my-1 h-px bg-[var(--border)]/30" />
              <button
                type="button"
                onClick={() => { skipSheetFocusRestoreRef.current = true; setMoreMenuOpen(false); onOpenSettings(); }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                  <Settings2 size="0.9rem" />
                </div>
                <span className="text-sm font-medium text-[var(--foreground)]">Chat Settings</span>
              </button>
            </div>
          </div>
        </>
      )}
      {summaryOpen && (
        <Suspense fallback={null}>
          <SummaryPopover
            chatId={chatId}
            summary={chatMetaString(chatMeta.summary, "") || null}
            contextSize={summaryContextSize}
            totalMessageCount={totalMessageCount}
            onContextSizeChange={(size) => updateMeta.mutate({ id: chatId, summaryContextSize: size })}
            onClose={() => setSummaryOpen(false)}
          />
        </Suspense>
      )}
      <ActiveWorldInfoModal chatId={chatId} open={mobileWorldInfoOpen} onClose={() => setMobileWorldInfoOpen(false)} />
    </div>
  );
}

// ── Split-line group wrapper — manages shared tap-to-show-actions state ──
function SplitMessageGroup({
  items,
  isStreaming,
  regenerateMessageId,
  streamBuffer,
  thinkingBuffer,
  lastAssistantMessageId,
  characterMap,
  chatCharacterIds,
  personaInfo,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onPeekPrompt,
  onToggleHiddenFromAI,
  onBranch,
  typingLabel,
}: {
  items: Array<{ key: string; msg: Message; isGrouped: boolean; index: number }>;
  isStreaming: boolean;
  regenerateMessageId: string | null;
  streamBuffer: string;
  thinkingBuffer: string;
  lastAssistantMessageId: string | undefined | null;
  characterMap: CharacterMap;
  chatCharacterIds: string[];
  personaInfo: PersonaInfo | undefined;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onSetActiveSwipe: (id: string, index: number) => void;
  onPeekPrompt: (options?: PeekPromptOptions) => void;
  onToggleHiddenFromAI?: (messageId: string, current: boolean) => void;
  onBranch: (messageId: string) => void;
  typingLabel?: string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  const fullContent = items.map((gi) => gi.msg.content).join("\n");
  const messageId = items[0]!.msg.id;

  const handleStartEdit = useCallback(() => {
    setEditing(true);
    setEditValue(fullContent);
    requestAnimationFrame(() => editRef.current?.focus());
  }, [fullContent]);

  const handleSaveEdit = useCallback(() => {
    if (editValue.trim() !== fullContent) {
      onEdit(messageId, editValue.trim());
    }
    setEditing(false);
  }, [editValue, fullContent, messageId, onEdit]);

  const groupCharacterId = items[0]!.msg.characterId ?? undefined;

  // Memoize the combined single-message view. ConversationView re-renders ~22x/sec
  // during streaming; rebuilding this object on every render handed ConversationMessage
  // a fresh `message` reference and defeated its memo, forcing a full re-render of every
  // split group (#2304). Keyed on a content signature (string-equal across renders) so it
  // only recomputes when an item's id or content actually changes.
  const firstMessage = items[0]!.msg;
  const lastMessageExtra = items[items.length - 1]!.msg.extra;
  const combinedMessageSignature = items.map((gi) => `${gi.key}:${gi.msg.content}`).join("\n");
  const combinedMessage = useMemo(
    () => ({
      ...firstMessage,
      content: items.map((gi) => gi.msg.content).join("\n\n"),
      // The last block carries the real extras (attachments, generationInfo, etc.)
      extra: lastMessageExtra,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinedMessageSignature, firstMessage, lastMessageExtra],
  );

  if (editing) {
    // Show the first message header + a single textarea for the full content
    const firstItem = items[0]!;
    const { msg } = firstItem;
    return (
      <div className="mari-message-group group relative">
        <ConversationMessage
          key={firstItem.key}
          message={{ ...msg, content: "" }}
          suppressCardCss
          isStreaming={false}
          isGrouped={firstItem.isGrouped}
          noHoverGroup
          hideActions
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onSetActiveSwipe={onSetActiveSwipe}
          onPeekPrompt={onPeekPrompt}
          onToggleHiddenFromAI={onToggleHiddenFromAI}
          onBranch={onBranch}
          isLastAssistantMessage={false}
          characterMap={characterMap}
          chatCharacterIds={chatCharacterIds}
          personaInfo={personaInfo}
        />
        <div className="space-y-2 pl-14 pr-4 -mt-1">
          <textarea
            ref={editRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.9375rem] leading-relaxed outline-none"
            rows={Math.min(editValue.split("\n").length + 1, 16)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && editValue === "") {
                e.preventDefault();
                setEditing(false);
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              }
            }}
          />
          <div className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            backspace (empty) to{" "}
            <button
              onClick={() => setEditing(false)}
              className="text-foreground/70 hover:underline hover:text-foreground"
            >
              cancel
            </button>{" "}
            · enter to{" "}
            <button onClick={handleSaveEdit} className="text-foreground/70 hover:underline hover:text-foreground">
              save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mari-message-group group relative"
      data-card-css-group={groupCharacterId}
      onClick={() => setShowActions((v) => !v)}
    >
      {(() => {
        // During regeneration, the split lines all belong to the same message ID.
        // Collapse them into a single ConversationMessage showing the streamed content
        // (or the in-bubble "X is typing…" label) rather than repeating dots/content per line.
        const firstItem = items[0]!;
        const isRegen = isStreaming && regenerateMessageId === firstItem.msg.id;
        // Strip old-swipe attachments during regeneration so a previous
        // illustration doesn't linger while new text is streaming in.
        const regenExtra = isRegen
          ? (() => {
              const p =
                typeof firstItem.msg.extra === "string" ? JSON.parse(firstItem.msg.extra) : (firstItem.msg.extra ?? {});
              return { ...p, attachments: null };
            })()
          : undefined;
        if (isRegen) {
          // While waiting for content, show the "X is typing..." label inside the (empty) bubble.
          if (!streamBuffer && !thinkingBuffer) {
            return (
              <ConversationMessage
                key={firstItem.key}
                message={{ ...firstItem.msg, content: "", extra: regenExtra }}
                isStreaming={false}
                isGrouped={firstItem.isGrouped}
                hideActions
                noHoverGroup
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onSetActiveSwipe={onSetActiveSwipe}
                onPeekPrompt={onPeekPrompt}
                onToggleHiddenFromAI={onToggleHiddenFromAI}
                onBranch={onBranch}
                isLastAssistantMessage={false}
                characterMap={characterMap}
                chatCharacterIds={chatCharacterIds}
                personaInfo={personaInfo}
                typingLabel={typingLabel}
              />
            );
          }
          const dMsg = {
            ...firstItem.msg,
            content: streamBuffer || "Thinking...",
            extra: { ...regenExtra, thinking: thinkingBuffer || regenExtra?.thinking },
          };
          return (
            <ConversationMessage
              key={firstItem.key}
              message={dMsg}
              isStreaming
              isGrouped={firstItem.isGrouped}
              hideActions={false}
              noHoverGroup
              forceShowActions={showActions}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onSetActiveSwipe={onSetActiveSwipe}
              onPeekPrompt={onPeekPrompt}
              onToggleHiddenFromAI={onToggleHiddenFromAI}
              onBranch={onBranch}
              onEditClick={handleStartEdit}
              isLastAssistantMessage={firstItem.msg.id === lastAssistantMessageId}
              characterMap={characterMap}
              chatCharacterIds={chatCharacterIds}
              personaInfo={personaInfo}
              messageIndex={firstItem.index + 1}
            />
          );
        }

        // Combine all split paragraphs into a single ConversationMessage so that
        // card CSS can style one seamless container (continuous borders, corners, stickers).
        // The stagger animation still works: as hidden blocks become visible the items
        // array grows and the combined content expands inside the same message body.
        // combinedMessage is memoized at the top of the component (#2304).
        return (
          <ConversationMessage
            key={firstItem.key}
            message={combinedMessage}
            isStreaming={false}
            isGrouped={firstItem.isGrouped}
            hideActions={false}
            noHoverGroup
            forceShowActions={showActions}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onSetActiveSwipe={onSetActiveSwipe}
            onPeekPrompt={onPeekPrompt}
            onToggleHiddenFromAI={onToggleHiddenFromAI}
            onBranch={onBranch}
            onEditClick={handleStartEdit}
            isLastAssistantMessage={firstItem.msg.id === lastAssistantMessageId}
            characterMap={characterMap}
            chatCharacterIds={chatCharacterIds}
            personaInfo={personaInfo}
            messageIndex={firstItem.index + 1}
          />
        );
      })()}
    </div>
  );
}
