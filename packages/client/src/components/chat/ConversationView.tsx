// ──────────────────────────────────────────────
// Chat: Conversation View — Discord-style composite
// ──────────────────────────────────────────────
import {
  Fragment,
  Suspense,
  lazy,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Loader2, ChevronUp, Settings2, Image as ImageIcon, ArrowRightLeft } from "lucide-react";
import { ConversationMessage } from "./ConversationMessage";
import { ConversationInput } from "./ConversationInput";
import { UnoBoard } from "./UnoBoard";
import { UnoSetup } from "./UnoSetup";
import { SceneBanner, EndSceneBar } from "./SceneBanner";
import { ChatBranchSelector } from "./ChatBranchSelector";
import { ActiveLorebookEntriesButton } from "./ActiveLorebookEntriesButton";
import { ChatToolbarButton, ChatToolbarMenu } from "./ChatToolbarControls";
import { ConversationPresenceCard } from "./ConversationPresenceCard";
import { TranscriptWindowControls } from "./TranscriptWindowControls";
import { PinnedImageOverlay } from "./PinnedImageOverlay";
import { useChatStore } from "../../stores/chat.store";
import { useUnoGameStore } from "../../stores/uno-game.store";
import { useUIStore } from "../../stores/ui.store";
import { playConfiguredNotificationPing } from "../../lib/notification-sound";
import { messageHasPendingPostProcessing } from "../../lib/chat-message-extra";
import { getTranscriptRenderWindow, TRANSCRIPT_RENDER_WINDOW_STEP } from "../../lib/transcript-render-window";
import { useConversationCustomEmojis } from "../../hooks/use-conversation-custom-emojis";
import { useConversationCustomStickers } from "../../hooks/use-conversation-custom-stickers";
import type { CharacterMap, MessageSelectionToggle, PersonaInfo } from "./chat-area.types";
import { normalizeTextForMatch, type Message } from "@marinara-engine/shared";

const ConversationAutonomousEffects = lazy(async () => {
  const module = await import("./ConversationAutonomousEffects");
  return { default: module.ConversationAutonomousEffects };
});

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
  chatMeta: Record<string, any>;
  chatName?: string;
  chatGroupId?: string | null;
  chatCharIds: string[];
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleHiddenFromAI: (messageId: string, current: boolean) => void;
  onPeekPrompt: () => void;
  lastAssistantMessageId: string | null;
  onOpenSettings: (event?: ReactMouseEvent<HTMLElement>, options?: { initialSection?: "autonomous" | null }) => void;
  onOpenGallery: (event?: ReactMouseEvent<HTMLElement>) => void;
  onBranch?: (messageId: string) => void;
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

/** Check if a message's content uses "Name: text" format with known chat-member character names */
function hasNamePrefixFormat(msg: Message, characterMap: CharacterMap, chatCharacterIds: string[]): boolean {
  if (!msg.content) return false;
  const chatNames = new Set(
    chatCharacterIds
      .map((id) => normalizeTextForMatch(characterMap.get(id)?.name))
      .filter((name): name is string => typeof name === "string" && name.length > 0),
  );
  if (!chatNames.size) return false;
  const lines = msg.content.split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const name = line.slice(0, colonIdx).trim();
      if (chatNames.has(normalizeTextForMatch(name))) return true;
    }
  }
  return false;
}

function isHiddenFromUser(message: Message) {
  const extra = getMessageExtraRecord(message);
  return extra.hiddenFromUser === true;
}

function getMessageExtraRecord(message: Message): Record<string, unknown> {
  try {
    const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
    return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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
  characterNames,
  personaInfo,
  chatMeta,
  chatName,
  chatGroupId,
  chatCharIds,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onToggleHiddenFromAI,
  onPeekPrompt,
  lastAssistantMessageId,
  onOpenSettings,
  onOpenGallery,
  onBranch,
  multiSelectMode,
  selectedMessageIds,
  onToggleSelectMessage,
  connectedChatName,
  onSwitchChat,
  sceneInfo,
  onConcludeScene,
  onAbandonScene,
}: ConversationViewProps) {
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreaming = useChatStore((s) => s.isStreaming) && streamingChatId === chatId;
  const unoGameActive = useUnoGameStore((s) => s.current?.chatId === chatId && s.current?.status !== "finished");
  const unoSetupOpen = useUnoGameStore((s) => s.setupChatId === chatId);
  const closeUnoSetup = useUnoGameStore((s) => s.closeSetup);
  const isStreamCommitted = useChatStore((s) => s.committedStreamChatIds.has(chatId));
  const hasLiveStream = isStreaming && !isStreamCommitted;
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  const regenerateMessageId = useChatStore((s) => s.regenerateMessageId);
  const streamingCharacterId = useChatStore((s) => s.streamingCharacterId);
  const typingCharacterName = useChatStore((s) => s.typingCharacterName);
  const delayedCharacterInfo = useChatStore((s) => s.delayedCharacterInfo);
  const conversationMessageStyle = useUIStore((s) => s.conversationMessageStyle);
  const hasDraftInput = useChatStore((s) => s.currentInput.trim().length > 0);
  const liveTypingName = useMemo(() => {
    if (typingCharacterName) return typingCharacterName;
    if (streamingCharacterId) return characterMap.get(streamingCharacterId)?.name ?? "Character";
    if (chatCharIds.length === 1) return characterMap.get(chatCharIds[0]!)?.name ?? "Character";
    if (characterNames.length > 0) return characterNames.join(", ");
    return "Character";
  }, [characterMap, characterNames, chatCharIds, streamingCharacterId, typingCharacterName]);
  const liveTypingVerb = liveTypingName.includes(",") || liveTypingName.includes(" & ") ? "are" : "is";
  const delayedDisplayName = useMemo(() => {
    if (!delayedCharacterInfo) return "";
    const ids = delayedCharacterInfo.characterIds ?? [];
    const namesFromIds = ids
      .map((id) => characterMap.get(id)?.name)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
    if (namesFromIds.length > 0 && namesFromIds.length === ids.length) return namesFromIds.join(", ");

    const namesFromEvent = (delayedCharacterInfo.characterNames ?? []).filter(
      (name): name is string => typeof name === "string" && name.trim().length > 0,
    );
    const usefulEventNames = namesFromEvent.filter((name) => {
      const normalized = normalizeTextForMatch(name);
      return normalized !== "character" && normalized !== "characters";
    });
    if (usefulEventNames.length > 0) return usefulEventNames.join(", ");
    if (namesFromIds.length > 0) return namesFromIds.join(", ");
    const fallbackName = delayedCharacterInfo.name?.trim() ?? "";
    const normalizedFallbackName = normalizeTextForMatch(fallbackName);
    if (fallbackName && normalizedFallbackName !== "character" && normalizedFallbackName !== "characters") {
      return fallbackName;
    }
    return "Character";
  }, [characterMap, delayedCharacterInfo]);
  const delayedDisplayVerb = delayedDisplayName.includes(",") || delayedDisplayName.includes(" & ") ? "are" : "is";
  // Single typer → tag the typing row so exclusive-mode card CSS can target it via
  // `[data-card-css="<id>"] .mari-typing-*`. Multiple/unknown typers stay untagged.
  const typingCardCssId = streamingCharacterId ?? (chatCharIds.length === 1 ? chatCharIds[0] : undefined);

  // Track whether the current generation has produced any content. When the stream
  // buffer clears (stream finished) but isStreaming hasn't cleared yet, this ref lets
  // us hide draft rows immediately so the real updated message shows without a flash.
  const streamHadContentRef = useRef(false);
  useEffect(() => {
    if (!hasLiveStream) {
      streamHadContentRef.current = false;
      return;
    }
    if (streamBuffer || thinkingBuffer) streamHadContentRef.current = true;
  }, [hasLiveStream, streamBuffer, thinkingBuffer]);
  const isStreamWindingDown =
    hasLiveStream &&
    conversationMessageStyle === "bubble" &&
    !streamBuffer &&
    !thinkingBuffer &&
    streamHadContentRef.current;

  const shouldRenderLiveStreamMessage =
    hasLiveStream &&
    !delayedCharacterInfo &&
    !regenerateMessageId &&
    !isStreamWindingDown &&
    (conversationMessageStyle === "bubble" || !!streamBuffer || !!thinkingBuffer);
  const showTypingIndicator =
    hasLiveStream && !delayedCharacterInfo && !streamBuffer && !thinkingBuffer && conversationMessageStyle !== "bubble";

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
  const renderToolbarActions = (compact = false) => (
    <>
      <ChatBranchSelector
        activeChatId={chatId}
        activeChatName={chatName}
        groupId={chatGroupId}
        variant="roleplay"
        compact={compact}
      />
      <ActiveLorebookEntriesButton chatId={chatId} />
      <ChatToolbarButton icon={<ImageIcon size="0.875rem" />} title="Gallery" onClick={onOpenGallery} />
      {onSwitchChat && (
        <ChatToolbarButton
          icon={<ArrowRightLeft size="0.875rem" />}
          title={connectedChatName ? `Switch to ${connectedChatName}` : "Switch to connected chat"}
          onClick={onSwitchChat}
        />
      )}
      <ChatToolbarButton icon={<Settings2 size="0.875rem" />} title="Chat Settings" onClick={onOpenSettings} />
    </>
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { map: conversationEmojiMap } = useConversationCustomEmojis();
  const { map: conversationStickerMap } = useConversationCustomStickers();
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userScrolledAtRef = useRef(0);

  // ── Scroll tracking ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distFromBottom < 150;
      if (hasLiveStream && el.scrollTop < lastScrollTopRef.current - 10) {
        userScrolledAwayRef.current = true;
      }
      // Re-engage auto-scroll when the user returns to the bottom,
      // but only if enough time has passed since their last wheel/touch
      // input. Without this cooldown, in-flight smooth-scroll animations
      // fire scroll events that immediately re-engage auto-scroll.
      if (nearBottom && Date.now() - userScrolledAtRef.current > 300) {
        userScrolledAwayRef.current = false;
      }
      lastScrollTopRef.current = el.scrollTop;
      isNearBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onUserScroll = () => {
      if (hasLiveStream) {
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
  }, [hasLiveStream]);

  useEffect(() => {
    if (!hasLiveStream) userScrolledAwayRef.current = false;
  }, [hasLiveStream]);

  // Auto-scroll on new messages / streaming / staggered reveals
  const newestMsgId = messages?.[messages.length - 1]?.id;
  const isOptimistic = newestMsgId?.startsWith("__optimistic_");
  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    // Always scroll when the user just sent a message (optimistic msg)
    if (isOptimistic || (isNearBottomRef.current && !userScrolledAwayRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    newestMsgId,
    streamBuffer,
    thinkingBuffer,
    hasLiveStream,
    delayedCharacterInfo,
    typingCharacterName,
    isOptimistic,
  ]);

  // Preserve scroll on load-more
  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && scrollRef.current && !isFetchingNextPage) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newScrollHeight - prevScrollHeightRef.current;
      isLoadingMoreRef.current = false;
    }
  }, [pageCount, isFetchingNextPage]);

  const handleLoadMore = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const [transcriptWindowStart, setTranscriptWindowStart] = useState<number | null>(null);

  useEffect(() => {
    setTranscriptWindowStart(null);
  }, [chatId]);

  const transcriptWindow = useMemo(
    () => getTranscriptRenderWindow(messages, { startIndex: transcriptWindowStart }),
    [messages, transcriptWindowStart],
  );

  const showOlderTranscriptMessages = useCallback(() => {
    setTranscriptWindowStart((current) => {
      const start = current ?? transcriptWindow.startIndex;
      return Math.max(0, start - TRANSCRIPT_RENDER_WINDOW_STEP);
    });
  }, [transcriptWindow.startIndex]);

  const showNewerTranscriptMessages = useCallback(() => {
    setTranscriptWindowStart((current) => {
      const start = current ?? transcriptWindow.startIndex;
      return Math.min(transcriptWindow.latestStartIndex, start + TRANSCRIPT_RENDER_WINDOW_STEP);
    });
  }, [transcriptWindow.latestStartIndex, transcriptWindow.startIndex]);

  const jumpToLatestTranscriptMessages = useCallback(() => {
    setTranscriptWindowStart(null);
  }, []);

  // ── Build message list with day separators ──
  // Assistant multi-line reveal is presentation-only: a real message can carry
  // display parts, but actions/edit/delete/regenerate still target one message.
  // Strip leaked timestamps like [16:08] or [18.03.2026] from assistant content.
  const stripTimestamps = (text: string) =>
    text
      .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/gm, "")
      .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/gm, "")
      .trim();

  const renderedItems = useMemo(() => {
    const visibleMessages = transcriptWindow.messages;
    if (!messages || !visibleMessages) return [];
    // Offset so message numbers reflect absolute position in the full chat history,
    // not just the position within the paginated and mounted render windows.
    const messageOffset = totalMessageCount - messages.length + transcriptWindow.startIndex;
    const items: Array<
      | { type: "separator"; key: string; label: string }
      | {
          type: "message";
          key: string;
          msg: Message;
          isGrouped: boolean;
          index: number;
          contentParts?: string[];
          bubbleGroupPosition: "single" | "first" | "middle" | "last";
        }
    > = [];
    let lastDay = "";
    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i]!;
      if (isHiddenFromUser(msg)) continue;
      const day = getDayKey(msg.createdAt);
      if (day !== lastDay) {
        items.push({ type: "separator", key: `sep-${day}`, label: formatDaySeparator(msg.createdAt) });
        lastDay = day;
      }
      const prev = i > 0 ? visibleMessages[i - 1]! : null;
      const next = i < visibleMessages.length - 1 ? visibleMessages[i + 1]! : null;
      // Break grouping if >5 minutes apart (like Discord)
      const TIME_GAP_MS = 5 * 60 * 1000;
      const isGroupedWith = (current: Message, other: Message | null, currentIsAfterOther: boolean) => {
        if (!other || isHiddenFromUser(other)) return false;
        const currentTime = new Date(current.createdAt).getTime();
        const otherTime = new Date(other.createdAt).getTime();
        const timeGap = currentIsAfterOther ? currentTime - otherTime : otherTime - currentTime;
        if (timeGap > TIME_GAP_MS) return false;
        if (
          current.role !== other.role ||
          current.characterId !== other.characterId ||
          getDayKey(other.createdAt) !== day
        ) {
          return false;
        }
        const currentHiddenFromAI = getMessageExtraRecord(current).hiddenFromAI === true;
        const otherHiddenFromAI = getMessageExtraRecord(other).hiddenFromAI === true;
        if (currentHiddenFromAI !== otherHiddenFromAI) return false;
        if (current.role === "user" && other.role === "user") {
          const currentExtra = getMessageExtraRecord(current);
          const otherExtra = getMessageExtraRecord(other);
          const currentId = (currentExtra.personaSnapshot as { personaId?: unknown } | undefined)?.personaId;
          const otherId = (otherExtra.personaSnapshot as { personaId?: unknown } | undefined)?.personaId;
          if (currentId && otherId && currentId !== otherId) return false;
        }
        return true;
      };
      const grouped = isGroupedWith(msg, prev, true);
      const nextGrouped = isGroupedWith(msg, next, false);
      const bubbleGroupPosition = grouped ? (nextGrouped ? "middle" : "last") : nextGrouped ? "first" : "single";

      const hasGroupFormat = msg.content.includes("<speaker=") || hasNamePrefixFormat(msg, characterMap, chatCharIds);
      let contentParts: string[] | undefined;
      if (conversationMessageStyle === "classic" && msg.role === "assistant" && msg.content && !hasGroupFormat) {
        const cleaned = stripTimestamps(msg.content);
        // Strip lines that are just the character's name (LLM prefixing in group individual mode)
        const charName = msg.characterId ? characterMap.get(msg.characterId)?.name : null;
        const lines = splitAssistantContentLines(cleaned, charName);
        if (lines.length > 1) {
          contentParts = chunkAssistantMarkdownBlocks(lines).map((block) => block.join("\n"));
        }
      }

      // For assistant messages, also strip timestamps and character name prefix
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
        index: messageOffset + i,
        contentParts,
        bubbleGroupPosition,
      });
    }
    return items;
  }, [
    messages,
    transcriptWindow.messages,
    transcriptWindow.startIndex,
    characterMap,
    chatCharIds,
    totalMessageCount,
    conversationMessageStyle,
  ]);

  const liveStreamCharacterId = streamingCharacterId ?? (chatCharIds.length === 1 ? chatCharIds[0]! : null);
  const liveStreamMessage = useMemo<Message | null>(() => {
    if (!shouldRenderLiveStreamMessage) return null;
    return {
      id: "__conversation_live_stream__",
      chatId,
      role: "assistant",
      characterId: liveStreamCharacterId,
      content: conversationMessageStyle === "bubble" ? "" : streamBuffer,
      activeSwipeIndex: 0,
      swipeCount: 0,
      createdAt: new Date().toISOString(),
      extra: {
        displayText: null,
        isGenerated: true,
        tokenCount: null,
        generationInfo: null,
        thinking: thinkingBuffer || null,
      },
    };
  }, [
    chatId,
    conversationMessageStyle,
    liveStreamCharacterId,
    shouldRenderLiveStreamMessage,
    streamBuffer,
    thinkingBuffer,
  ]);

  const buildStreamingBubblePreview = useCallback(
    (content: string, characterId: string | null) => {
      if (conversationMessageStyle !== "bubble" || !content.trim()) return "";
      const cleaned = content
        .replace(/^(\s*\[\d{1,2}[:.]\d{2}\]\s*)+/gm, "")
        .replace(/^(\s*\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*)+/gm, "")
        .trimStart();
      const cutoffs: number[] = [];

      const blankLineMatches = cleaned.matchAll(/\n\s*\n/g);
      for (const match of blankLineMatches) {
        if (typeof match.index === "number") cutoffs.push(match.index + match[0].length);
      }

      const lastNewlineIndex = cleaned.lastIndexOf("\n");
      if (lastNewlineIndex >= 0) cutoffs.push(lastNewlineIndex + 1);

      const sentenceMatches = cleaned.matchAll(/[.!?…]["')\]]?(?=\s|$)/g);
      for (const match of sentenceMatches) {
        if (typeof match.index === "number") cutoffs.push(match.index + match[0].length);
      }

      const cutoff = Math.max(0, ...cutoffs);
      if (cutoff <= 0) return "";
      const charName = characterId ? characterMap.get(characterId)?.name : null;
      const lines = splitAssistantContentLines(cleaned.slice(0, cutoff).trim(), charName);
      return lines.join("\n").trim();
    },
    [characterMap, conversationMessageStyle],
  );

  const streamingDraftKey =
    hasLiveStream && conversationMessageStyle === "bubble" && !delayedCharacterInfo
      ? `${chatId}:${regenerateMessageId ?? "new"}:${liveStreamCharacterId ?? "assistant"}`
      : null;
  const [streamingBubbleDraft, setStreamingBubbleDraft] = useState<{ key: string; text: string }>({
    key: "",
    text: "",
  });

  useEffect(() => {
    if (!streamingDraftKey) {
      setStreamingBubbleDraft((current) => (current.key || current.text ? { key: "", text: "" } : current));
      return;
    }

    const nextPreview = buildStreamingBubblePreview(streamBuffer, liveStreamCharacterId);
    setStreamingBubbleDraft((current) => {
      if (current.key !== streamingDraftKey) return { key: streamingDraftKey, text: nextPreview };
      if (nextPreview.length > current.text.length) return { key: streamingDraftKey, text: nextPreview };
      return current;
    });
  }, [buildStreamingBubblePreview, liveStreamCharacterId, streamBuffer, streamingDraftKey]);

  const streamingBubblePreview =
    streamingDraftKey && streamingBubbleDraft.key === streamingDraftKey ? streamingBubbleDraft.text : "";
  const liveStreamContentParts = streamingBubblePreview ? [streamingBubblePreview] : undefined;

  // ── Staggered reveal for assistant display parts ──
  // Reveal chunks inside one real message so Classic gets cadence without fake rows.
  const [visiblePartCounts, setVisiblePartCounts] = useState<Record<string, number>>({});
  const renderedMessageKeysRef = useRef<Set<string>>(new Set());
  const prevRenderedKeysRef = useRef<Set<string>>(new Set());
  // Track whether the initial data load has settled. Until it has, we treat
  // all arriving keys as "already seen" so re-mounting the component (or the
  // first async page of messages landing) never replays stagger/sounds.
  const initialLoadSettledRef = useRef(false);
  // Keep a persistent set of message keys we've already processed across
  // component remounts. This prevents sounds/stagger replaying when the user
  // navigates away and comes back to the same chat.
  const globalSeenKeysRef = useRef(globalSeenKeys);
  const pendingPostProcessingKeysRef = useRef<Set<string>>(new Set());
  // Persist stagger timers in a ref so they survive effect re-runs caused by
  // query refetches arriving shortly after the initial message_saved upsert.
  const staggerTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  // Reset stagger state when the active chat changes so no cross-chat leakage
  const prevChatIdRef = useRef(chatId);
  if (prevChatIdRef.current !== chatId) {
    prevChatIdRef.current = chatId;
    initialLoadSettledRef.current = false;
    prevRenderedKeysRef.current = new Set();
    renderedMessageKeysRef.current = new Set();
    pendingPostProcessingKeysRef.current = new Set();
    Object.values(staggerTimersRef.current).forEach((timers) => timers.forEach(clearTimeout));
    staggerTimersRef.current = {};
    setVisiblePartCounts({});
  }

  useLayoutEffect(() => {
    const messageItems = renderedItems.filter((item) => item.type === "message");
    const currentKeys = new Set(messageItems.map((item) => item.key));
    const pendingPostProcessingKeys = new Set(
      messageItems.filter((item) => messageHasPendingPostProcessing(item.msg)).map((item) => item.key),
    );
    renderedMessageKeysRef.current = currentKeys;
    for (const key of Object.keys(staggerTimersRef.current)) {
      if (!currentKeys.has(key)) {
        staggerTimersRef.current[key]?.forEach(clearTimeout);
        delete staggerTimersRef.current[key];
      }
    }
    setVisiblePartCounts((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [key, count] of Object.entries(prev)) {
        if (currentKeys.has(key)) next[key] = count;
        else changed = true;
      }
      return changed ? next : prev;
    });

    // On the very first render that has messages, just snapshot the keys and
    // mark the initial load as settled — don't stagger or play sounds.
    if (!initialLoadSettledRef.current) {
      if (currentKeys.size > 0) {
        prevRenderedKeysRef.current = currentKeys;
        // Mark all current keys as globally seen so remount won't replay them
        for (const item of messageItems) {
          if (!pendingPostProcessingKeys.has(item.key)) globalSeenKeysRef.current.add(item.key);
        }
        pendingPostProcessingKeysRef.current = pendingPostProcessingKeys;
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

    const newPartMessages: Array<{ key: string; count: number }> = [];
    let hasNewAssistantMessage = false;

    for (const item of messageItems) {
      const key = item.key;
      const isPendingPostProcessing = pendingPostProcessingKeys.has(key);
      if (isPendingPostProcessing) continue;
      const wasPendingPostProcessing = pendingPostProcessingKeysRef.current.has(key);
      if ((prevKeys.has(key) || seenGlobal.has(key)) && !wasPendingPostProcessing) continue;

      // Check if this message is fresh (created recently, meaning it was
      // generated while the user is actively in this chat)
      const ts = keyTimestampMap.get(key) ?? 0;
      const isFresh = wasPendingPostProcessing || now - ts < FRESHNESS_MS;

      if (!isFresh) {
        // Stale message from cache refetch — silently mark as seen, skip animation
        continue;
      }

      if (item.msg.role === "assistant") {
        hasNewAssistantMessage = true;
        const partCount = item.contentParts?.length ?? 0;
        if (partCount > 1) newPartMessages.push({ key, count: partCount });
      }
    }

    // Mark all current keys as globally seen
    for (const item of messageItems) {
      if (!pendingPostProcessingKeys.has(item.key)) seenGlobal.add(item.key);
    }
    prevRenderedKeysRef.current = currentKeys;
    pendingPostProcessingKeysRef.current = pendingPostProcessingKeys;

    // Play notification for the first new message appearance
    if (hasNewAssistantMessage) {
      const uiState = useUIStore.getState();
      playConfiguredNotificationPing(uiState.convoNotificationSound, uiState.notificationSoundsOnlyWhenUnfocused);
    }

    if (newPartMessages.length === 0) return;

    for (const { key } of newPartMessages) {
      staggerTimersRef.current[key]?.forEach(clearTimeout);
      delete staggerTimersRef.current[key];
    }

    setVisiblePartCounts((prev) => {
      const next = { ...prev };
      for (const item of newPartMessages) next[item.key] = 1;
      return next;
    });

    newPartMessages.forEach(({ key, count }) => {
      for (let partIndex = 2; partIndex <= count; partIndex++) {
        const delay = (partIndex - 1) * 1500;
        const timer = setTimeout(() => {
          if (!renderedMessageKeysRef.current.has(key)) {
            staggerTimersRef.current[key]?.forEach(clearTimeout);
            delete staggerTimersRef.current[key];
            return;
          }
          setVisiblePartCounts((prev) => ({ ...prev, [key]: partIndex }));
          const uiState = useUIStore.getState();
          playConfiguredNotificationPing(uiState.convoNotificationSound, uiState.notificationSoundsOnlyWhenUnfocused);
          staggerTimersRef.current[key] = (staggerTimersRef.current[key] ?? []).filter(
            (activeTimer) => activeTimer !== timer,
          );
          if (partIndex === count) {
            staggerTimersRef.current[key]?.forEach(clearTimeout);
            delete staggerTimersRef.current[key];
          }
        }, delay);
        (staggerTimersRef.current[key] ??= []).push(timer);
      }
    });
    // No cleanup return here — timers are managed via staggerTimersRef and
    // must survive effect re-runs caused by query refetches. Cleanup on
    // unmount is handled by a separate effect below.
  }, [renderedItems]);

  // Clean up stagger timers on unmount only (empty deps = unmount cleanup)
  useEffect(() => {
    return () => {
      Object.values(staggerTimersRef.current).forEach((timers) => timers.forEach(clearTimeout));
      staggerTimersRef.current = {};
    };
  }, []);

  // Auto-scroll when staggered parts are revealed
  useEffect(() => {
    if (!isLoadingMoreRef.current && isNearBottomRef.current && !userScrolledAwayRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [visiblePartCounts]);

  return (
    <div
      className="mari-chat-area mari-card-css relative flex flex-1 flex-col overflow-hidden"
      data-chat-mode="conversation"
      style={{ ...gradientStyle, isolation: "isolate" }}
    >
      {/* ── Messages scroll area ── */}
      <div ref={scrollRef} className="mari-messages-scroll flex-1 overflow-y-auto overflow-x-hidden">
        {/* Floating header — character info + action buttons */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2">
          <ConversationPresenceCard
            chatId={chatId}
            chatMeta={chatMeta}
            chatCharIds={chatCharIds}
            characterMap={characterMap}
            messages={messages}
            onOpenSettings={onOpenSettings}
          />

          <ChatToolbarMenu
            className="flex-1"
            desktopChildren={renderToolbarActions()}
            mobileChildren={renderToolbarActions(true)}
          />
        </div>

        {/* Load More */}
        {hasNextPage && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {isFetchingNextPage ? <Loader2 size="0.75rem" className="animate-spin" /> : <ChevronUp size="0.75rem" />}
              Load More
            </button>
          </div>
        )}

        <TranscriptWindowControls
          hiddenBeforeCount={transcriptWindow.hiddenBeforeCount}
          hiddenAfterCount={transcriptWindow.hiddenAfterCount}
          onShowOlder={transcriptWindow.hiddenBeforeCount > 0 ? showOlderTranscriptMessages : undefined}
        />

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
        {renderedItems.map((item) => {
          if (item.type === "separator") {
            return (
              <div key={item.key} className="relative my-4 flex items-center px-4">
                <div className="flex-1 border-t border-[var(--border)]/40" />
                <span className="mx-4 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">{item.label}</span>
                <div className="flex-1 border-t border-[var(--border)]/40" />
              </div>
            );
          }

          const { msg, isGrouped } = item;
          const isRegenerating = hasLiveStream && regenerateMessageId === msg.id;
          const isBubbleRegenerating = isRegenerating && conversationMessageStyle === "bubble";
          const hasStreamContent = isRegenerating && !isBubbleRegenerating && (!!streamBuffer || !!thinkingBuffer);
          // Strip old-swipe attachments during classic regeneration so a previous
          // illustration doesn't linger while new text is streaming in. Bubble
          // regeneration keeps the real message stable and renders a separate
          // presentation-only draft row below it.
          const displayMsg =
            isRegenerating && !isBubbleRegenerating
              ? (() => {
                  const parsed = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
                  return {
                    ...msg,
                    content: streamBuffer || (thinkingBuffer ? "Thinking..." : msg.content),
                    extra: { ...parsed, attachments: null, thinking: thinkingBuffer || parsed.thinking },
                  };
                })()
              : msg;
          const contentParts = isRegenerating ? undefined : item.contentParts;
          const visiblePartCount = contentParts ? (visiblePartCounts[item.key] ?? contentParts.length) : undefined;
          const originalContent = displayMsg.content !== msg.content ? msg.content : undefined;
          const regenerationDraftMessage =
            isBubbleRegenerating && !isStreamWindingDown
              ? ({
                  ...msg,
                  id: `__conversation_regeneration_stream__${msg.id}`,
                  content: "",
                  activeSwipeIndex: 0,
                  swipeCount: 0,
                  extra: {
                    ...(typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {})),
                    attachments: null,
                    displayText: null,
                    thinking: thinkingBuffer || null,
                  },
                } as Message)
              : null;

          return (
            <Fragment key={item.key}>
              <ConversationMessage
                key={msg.id}
                message={displayMsg as any}
                isStreaming={hasStreamContent}
                isGrouped={isGrouped}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onSetActiveSwipe={onSetActiveSwipe}
                onToggleHiddenFromAI={onToggleHiddenFromAI}
                onPeekPrompt={onPeekPrompt}
                isLastAssistantMessage={msg.id === lastAssistantMessageId}
                characterMap={characterMap}
                personaInfo={personaInfo as any}
                emojiMap={conversationEmojiMap}
                stickerMap={conversationStickerMap}
                chatCharacterIds={chatCharIds}
                messageIndex={item.index + 1}
                messageOrderIndex={item.index}
                multiSelectMode={multiSelectMode}
                isSelected={selectedMessageIds?.has(msg.id)}
                onToggleSelect={onToggleSelectMessage}
                hasDraftInput={hasDraftInput}
                onBranch={onBranch}
                messageStyle={conversationMessageStyle}
                contentParts={contentParts}
                visiblePartCount={visiblePartCount}
                bubbleGroupPosition={item.bubbleGroupPosition}
                originalContent={originalContent}
              />
              {regenerationDraftMessage && (
                <ConversationMessage
                  key={regenerationDraftMessage.id}
                  message={regenerationDraftMessage as any}
                  isStreaming
                  isGrouped={false}
                  hideActions
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onSetActiveSwipe={onSetActiveSwipe}
                  onToggleHiddenFromAI={onToggleHiddenFromAI}
                  onPeekPrompt={onPeekPrompt}
                  isLastAssistantMessage={false}
                  characterMap={characterMap}
                  personaInfo={personaInfo as any}
                  emojiMap={conversationEmojiMap}
                  stickerMap={conversationStickerMap}
                  chatCharacterIds={chatCharIds}
                  hasDraftInput={hasDraftInput}
                  messageStyle={conversationMessageStyle}
                  contentParts={liveStreamContentParts}
                  visiblePartCount={liveStreamContentParts?.length}
                  bubbleGroupPosition="single"
                />
              )}
            </Fragment>
          );
        })}

        {liveStreamMessage && (
          <ConversationMessage
            key={liveStreamMessage.id}
            message={liveStreamMessage as any}
            isStreaming
            isGrouped={false}
            hideActions
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onSetActiveSwipe={onSetActiveSwipe}
            onToggleHiddenFromAI={onToggleHiddenFromAI}
            onPeekPrompt={onPeekPrompt}
            isLastAssistantMessage={false}
            characterMap={characterMap}
            personaInfo={personaInfo as any}
            emojiMap={conversationEmojiMap}
            stickerMap={conversationStickerMap}
            chatCharacterIds={chatCharIds}
            hasDraftInput={hasDraftInput}
            messageStyle={conversationMessageStyle}
            contentParts={liveStreamContentParts}
            visiblePartCount={liveStreamContentParts?.length}
            bubbleGroupPosition="single"
          />
        )}

        <TranscriptWindowControls
          hiddenBeforeCount={transcriptWindow.hiddenBeforeCount}
          hiddenAfterCount={transcriptWindow.hiddenAfterCount}
          onShowNewer={transcriptWindow.hiddenAfterCount > 0 ? showNewerTranscriptMessages : undefined}
          onJumpToLatest={transcriptWindow.hiddenAfterCount > 0 ? jumpToLatestTranscriptMessages : undefined}
        />

        {/* Delayed indicator (DND/idle — waiting for character to become available) */}
        {delayedCharacterInfo && hasLiveStream && !streamBuffer && !thinkingBuffer && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[0.8125rem] text-[var(--text-secondary)]">
            <span className="italic">
              {delayedCharacterInfo.status === "dnd"
                ? `${delayedDisplayName} ${delayedDisplayVerb} busy — they'll respond when they're back`
                : `${delayedDisplayName} ${delayedDisplayVerb} away — they'll respond in a moment`}
            </span>
          </div>
        )}

        {/* Typing indicator — classic mode only; bubble regen uses the draft row instead */}
        {showTypingIndicator && (
          <div
            className="mari-typing-indicator flex items-center gap-2 px-4 py-1.5 text-[0.8125rem] text-[var(--text-secondary)]"
            data-typing-name={liveTypingName}
            data-card-css={typingCardCssId}
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
              {liveTypingName} {liveTypingVerb} typing...
            </span>
          </div>
        )}

        {/* Scene banner — inline at bottom of messages (origin variant only); hidden during a turn-game */}
        {sceneInfo?.variant === "origin" && !unoGameActive && (
          <SceneBanner variant="origin" sceneChatId={sceneInfo.sceneChatId} sceneChatName={sceneInfo.sceneChatName} />
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>
      <PinnedImageOverlay activeChatId={chatId} />

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

      {/* ── Turn-game board (UNO, etc.) — self-hides when no game is active ── */}
      <UnoBoard chatId={chatId} />
      {/* Setup modal mounted once here (stable position) so it never double-renders.
          Keyed by chatId so its internal selection/house-rule state resets on a
          chat switch (matches ConversationInput below) — otherwise stale selected
          ids would inflate botCount and could deal an empty botCharacterIds list. */}
      <UnoSetup key={chatId} chatId={chatId} open={unoSetupOpen} onClose={closeUnoSetup} />

      {/* ── Input area ── */}
      <ConversationInput
        key={chatId}
        characterNames={characterNames}
        groupResponseOrder={
          chatMeta.groupResponseOrder === "manual"
            ? "manual"
            : chatCharIds.length > 1
              ? (chatMeta.groupResponseOrder ?? "sequential")
              : undefined
        }
        chatCharacters={chatCharIds
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
          })}
        onPeekPrompt={onPeekPrompt}
      />
    </div>
  );
}
