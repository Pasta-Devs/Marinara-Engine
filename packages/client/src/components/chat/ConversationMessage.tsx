// ──────────────────────────────────────────────
// Chat: Conversation message shell
// Resolves character/persona identity, builds render context,
// and delegates to the appropriate layout component.
// ──────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect, memo, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Brain, Trash2, X } from "lucide-react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { formatTextQuotes, type Message, type MessageReaction } from "@marinara-engine/shared";
import { toast } from "sonner";
import { useUIStore, type ConversationMessageStyle } from "../../stores/ui.store";
import { cn, copyToClipboard, getAvatarCropStyle, parseAvatarCropJson } from "../../lib/utils";
import { resolveMessageMacros } from "../../lib/chat-macros";
import { useTranslate } from "../../hooks/use-translate";
import { api } from "../../lib/api-client";
import { chatKeys } from "../../hooks/use-chats";
import type { CharacterMap, MessageSelectionToggle, PersonaInfo } from "./chat-area.types";
import { GenerationReplayDetailsModal, hasGenerationReplayDetails } from "./GenerationReplayDetailsModal";
import {
  HiddenFromAIConversationButton,
  ConversationMessageLightbox,
  parseSpeakerTags,
  parseNamePrefixFormat,
  groupConsecutiveSegments,
  type MessageData,
  type MessageRenderContext,
} from "./ConversationMessageShared";
import { ConversationMessageActions } from "./ConversationMessageActions";
import { ConversationMessageGrouped } from "./ConversationMessageGrouped";
import { ConversationMessageBubble } from "./ConversationMessageBubble";
import { ConversationMessageLine } from "./ConversationMessageLine";
import { MessageReactions } from "./MessageReactions";
import { toggleReaction, USER_REACTOR } from "../../lib/reactions";

const EMPTY_CUSTOM_EMOJI_MAP = new Map<string, string>();
const EMPTY_CUSTOM_STICKER_MAP = new Map<string, string>();

// ── Public props interface (unchanged external API) ──────────────

interface ConversationMessageProps {
  message: MessageData;
  isStreaming?: boolean;
  isGrouped?: boolean;
  hideActions?: boolean;
  noHoverGroup?: boolean;
  hideTimestamp?: boolean;
  hideUserAvatar?: boolean;
  plainUserMessages?: boolean;
  forceShowActions?: boolean;
  messageStyle?: ConversationMessageStyle;
  contentParts?: string[];
  visiblePartCount?: number;
  bubbleGroupPosition?: "single" | "first" | "middle" | "last";
  originalContent?: string;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onSetActiveSwipe?: (messageId: string, index: number) => void;
  onToggleHiddenFromAI?: (messageId: string, current: boolean) => void;
  onPeekPrompt?: () => void;
  onBranch?: (messageId: string) => void;
  isLastAssistantMessage?: boolean;
  characterMap?: CharacterMap;
  personaInfo?: PersonaInfo;
  emojiMap?: Map<string, string>;
  stickerMap?: Map<string, string>;
  onEditClick?: () => void;
  chatCharacterIds?: string[];
  messageIndex?: number;
  messageOrderIndex?: number;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (toggle: MessageSelectionToggle) => void;
  hasDraftInput?: boolean;
}

// ── Shell component ──────────────────────────────────────────────

export const ConversationMessage = memo(function ConversationMessage({
  message,
  isStreaming,
  isGrouped,
  hideActions,
  noHoverGroup,
  hideTimestamp,
  hideUserAvatar,
  plainUserMessages,
  forceShowActions,
  messageStyle = "classic",
  contentParts,
  visiblePartCount,
  bubbleGroupPosition = "single",
  originalContent,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onBranch,
  isLastAssistantMessage,
  characterMap,
  personaInfo,
  emojiMap,
  stickerMap,
  onEditClick,
  chatCharacterIds,
  messageIndex,
  messageOrderIndex,
  multiSelectMode,
  isSelected,
  onToggleSelect,
  hasDraftInput = false,
}: ConversationMessageProps) {
  // ── Local state ──
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showGenerationReplay, setShowGenerationReplay] = useState(false);
  const [manuallyExpandedHidden, setManuallyExpandedHidden] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ url: string; prompt?: string | null } | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const editSwipeIndexRef = useRef<number | null>(null);

  // ── Store selectors ──
  const collapseHiddenMessages = useUIStore((s) => s.summaryPopoverSettings.collapseHiddenMessages);
  const guideGenerations = useUIStore((s) => s.guideGenerations);
  const chatFontSize = useUIStore((s) => s.chatFontSize);
  const chatFontColor = useUIStore((s) => s.chatFontColor);
  const showMessageNumbers = useUIStore((s) => s.showMessageNumbers);
  const quoteFormat = useUIStore((s) => s.quoteFormat);

  // ── Translation ──
  const { translate, translations, translating } = useTranslate();
  const translatedText = translations[message.id];
  const isTranslating = !!translating[message.id];

  // ── Derived flags ──
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isBubbleStyle = messageStyle === "bubble";
  const isGuided = guideGenerations && hasDraftInput;
  const regenerateButtonTitle = isGuided ? "Regenerate (guided)" : "Regenerate";
  const regenerateGuidedClass = isGuided
    ? "text-[var(--primary)] bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]/30 hover:text-[var(--primary)] hover:bg-[var(--primary)]/20"
    : undefined;
  const messageTextStyle = useMemo<CSSProperties>(
    () => ({ fontSize: `${chatFontSize}px`, ...(chatFontColor ? { color: chatFontColor } : {}) }),
    [chatFontSize, chatFontColor],
  );

  // ── Parse extra ──
  const extra = useMemo(() => {
    if (!message.extra) return {} as Record<string, any>;
    return typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
  }, [message.extra]);
  const isHiddenFromAI = extra.hiddenFromAI === true;
  const generationReplay = hasGenerationReplayDetails(extra.generationReplay) ? extra.generationReplay : null;
  const canRegenerate = !isUser || generationReplay !== null;
  const thinking = extra?.thinking as string | null | undefined;
  const reactions = useMemo<MessageReaction[]>(
    () => (Array.isArray(extra.reactions) ? extra.reactions : []),
    [extra.reactions],
  );

  // ── Character / persona resolution ──
  const scopedCharacterMap = useMemo(() => {
    if (!characterMap) return null;
    if (!chatCharacterIds) return characterMap;
    const allowedIds = new Set(chatCharacterIds);
    return new Map(Array.from(characterMap).filter(([id]) => allowedIds.has(id)));
  }, [characterMap, chatCharacterIds]);

  const charInfo = message.characterId && scopedCharacterMap ? scopedCharacterMap.get(message.characterId) : null;
  const fallbackChatCharacterEntry = useMemo(() => {
    if (!scopedCharacterMap) return null;
    const orderedIds = chatCharacterIds?.length ? chatCharacterIds : Array.from(scopedCharacterMap.keys());
    for (const id of orderedIds) {
      const info = scopedCharacterMap.get(id);
      if (info) return { id, info };
    }
    return null;
  }, [chatCharacterIds, scopedCharacterMap]);
  const resolvedCharacterInfo =
    message.characterId !== null ? (charInfo ?? fallbackChatCharacterEntry?.info ?? null) : null;
  const primaryCharInfo =
    resolvedCharacterInfo ??
    (scopedCharacterMap
      ? (Array.from(scopedCharacterMap.values()).find((c): c is NonNullable<typeof c> => !!c) ?? null)
      : null);

  const msgPersona = isUser && !plainUserMessages && extra.personaSnapshot ? extra.personaSnapshot : null;
  const avatarUrl = isUser
    ? plainUserMessages
      ? null
      : (msgPersona?.avatarUrl ?? personaInfo?.avatarUrl ?? null)
    : (resolvedCharacterInfo?.avatarUrl ?? null);
  const personaAvatarCrop = isUser
    ? plainUserMessages
      ? null
      : (parseAvatarCropJson(msgPersona?.avatarCrop) ?? personaInfo?.avatarCrop ?? null)
    : null;
  const avatarCropStyle = isUser
    ? getAvatarCropStyle(personaAvatarCrop)
    : getAvatarCropStyle(resolvedCharacterInfo?.avatarCrop);
  const displayName = isUser
    ? plainUserMessages
      ? "You"
      : (msgPersona?.name ?? personaInfo?.name ?? "You")
    : (primaryCharInfo?.name ?? "Assistant");
  const nameColor = isUser
    ? plainUserMessages
      ? undefined
      : (msgPersona?.nameColor ?? personaInfo?.nameColor)
    : resolvedCharacterInfo?.nameColor;

  const macroContext = useMemo(
    () => ({
      userName: displayName,
      persona: {
        name: displayName,
        description: plainUserMessages ? undefined : (msgPersona?.description ?? personaInfo?.description),
        personality: plainUserMessages ? undefined : (msgPersona?.personality ?? personaInfo?.personality),
        backstory: plainUserMessages ? undefined : (msgPersona?.backstory ?? personaInfo?.backstory),
        appearance: plainUserMessages ? undefined : (msgPersona?.appearance ?? personaInfo?.appearance),
        scenario: plainUserMessages ? undefined : (msgPersona?.scenario ?? personaInfo?.scenario),
      },
      primaryCharacter: primaryCharInfo ?? { name: displayName },
      characters: scopedCharacterMap
        ? Array.from(scopedCharacterMap.values())
        : displayName
          ? [{ name: displayName }]
          : [],
    }),
    [
      displayName,
      msgPersona?.appearance,
      msgPersona?.backstory,
      msgPersona?.description,
      msgPersona?.personality,
      msgPersona?.scenario,
      personaInfo?.appearance,
      personaInfo?.backstory,
      personaInfo?.description,
      personaInfo?.personality,
      personaInfo?.scenario,
      plainUserMessages,
      primaryCharInfo,
      scopedCharacterMap,
    ],
  );

  const renderedContent = useMemo(
    () => formatTextQuotes(resolveMessageMacros(message.content, macroContext), quoteFormat),
    [macroContext, message.content, quoteFormat],
  );
  const renderedContentParts = useMemo(() => {
    if (!contentParts?.length) return null;
    const count = Math.max(1, Math.min(visiblePartCount ?? contentParts.length, contentParts.length));
    return contentParts
      .slice(0, count)
      .map((part) => formatTextQuotes(resolveMessageMacros(part, macroContext), quoteFormat));
  }, [contentParts, macroContext, quoteFormat, visiblePartCount]);

  // ── Attachment removal ──
  const qc = useQueryClient();
  const handleRemoveAttachment = useCallback(
    async (index: number) => {
      const current = (extra.attachments as any[]) ?? [];
      const updated = current.filter((_: any, i: number) => i !== index);
      const msgKey = chatKeys.messages(message.chatId);
      const previous = qc.getQueryData<InfiniteData<Message[]>>(msgKey);
      qc.setQueryData<InfiniteData<Message[]>>(msgKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => {
              if (m.id !== message.id) return m;
              const ex = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
              return { ...m, extra: { ...ex, attachments: updated } } as Message;
            }),
          ),
        };
      });
      try {
        await api.patch(`/chats/${message.chatId}/messages/${message.id}/extra`, { attachments: updated });
      } catch (err) {
        qc.setQueryData(msgKey, previous);
        toast.error(err instanceof Error ? err.message : "Failed to remove attachment.");
      } finally {
        await qc.invalidateQueries({ queryKey: msgKey });
      }
    },
    [extra.attachments, message.chatId, message.id, qc],
  );

  // ── Reactions ──
  // Toggle the human's reaction on this message; optimistic, then PATCH extra
  // (mirrors handleRemoveAttachment). Character reactions are applied server-side.
  const handleToggleReaction = useCallback(
    async (emoji: string, imageUrl: string | null) => {
      const next = toggleReaction(reactions, emoji, USER_REACTOR, imageUrl);
      const msgKey = chatKeys.messages(message.chatId);
      const previous = qc.getQueryData<InfiniteData<Message[]>>(msgKey);
      qc.setQueryData<InfiniteData<Message[]>>(msgKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => {
              if (m.id !== message.id) return m;
              const ex = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
              return { ...m, extra: { ...ex, reactions: next } } as Message;
            }),
          ),
        };
      });
      try {
        await api.patch(`/chats/${message.chatId}/messages/${message.id}/extra`, { reactions: next });
      } catch (err) {
        qc.setQueryData(msgKey, previous);
        toast.error(err instanceof Error ? err.message : "Failed to update reaction.");
      } finally {
        await qc.invalidateQueries({ queryKey: msgKey });
      }
    },
    [reactions, message.chatId, message.id, qc],
  );

  // Resolve a reactor id to a display name for the chip tooltips.
  const resolveReactorName = useCallback(
    (reactorId: string) =>
      reactorId === USER_REACTOR ? "You" : (scopedCharacterMap?.get(reactorId)?.name ?? "Someone"),
    [scopedCharacterMap],
  );

  // ── Speaker-segment parsing (for grouped / group-in-bubble) ──
  const charByName = useMemo(() => {
    if (!scopedCharacterMap) return null;
    const map = new Map<string, NonNullable<ReturnType<CharacterMap["get"]>>>();
    for (const [id, v] of scopedCharacterMap) {
      if (v) {
        const key = v.name.toLowerCase();
        if (id === message.characterId) map.set(key, v);
        else if (!map.has(key)) map.set(key, v);
      }
    }
    return map;
  }, [scopedCharacterMap, message.characterId]);

  const mentionNames = useMemo(() => {
    if (!scopedCharacterMap) return [] as string[];
    const names: string[] = [];
    for (const [, v] of scopedCharacterMap) {
      if (v?.name) names.push(v.name);
    }
    return names;
  }, [scopedCharacterMap]);

  const groupedSegments = useMemo(() => {
    if (isUser || !renderedContent) return null;
    const knownNames = charByName ? new Set(charByName.keys()) : new Set<string>();
    const speakerSegs = parseSpeakerTags(renderedContent, knownNames);
    if (speakerSegs) return groupConsecutiveSegments(speakerSegs);
    const nameSegs = parseNamePrefixFormat(renderedContent, knownNames);
    if (nameSegs) return groupConsecutiveSegments(nameSegs);
    return null;
  }, [isUser, renderedContent, charByName]);

  // ── Staggered reveal for multi-speaker segments ──
  const segmentCount = groupedSegments?.length ?? 0;
  const prevContentRef = useRef(renderedContent);
  const initialRenderRef = useRef(true);
  const [visibleSegments, setVisibleSegments] = useState(segmentCount);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      setVisibleSegments(segmentCount);
      prevContentRef.current = renderedContent;
      return;
    }
    if (renderedContent !== prevContentRef.current && segmentCount > 1) {
      prevContentRef.current = renderedContent;
      setVisibleSegments(1);
      let count = 1;
      const reveal = () => {
        count++;
        setVisibleSegments(count);
      };
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (let i = 1; i < segmentCount; i++) timers.push(setTimeout(reveal, i * 1500));
      return () => timers.forEach(clearTimeout);
    }
    setVisibleSegments(segmentCount);
    prevContentRef.current = renderedContent;
  }, [renderedContent, segmentCount]);

  // ── Hidden from AI ──
  const isHiddenExpanded =
    isHiddenFromAI && (!collapseHiddenMessages || manuallyExpandedHidden || editing || !!isStreaming);
  const isHiddenCollapsed = isHiddenFromAI && collapseHiddenMessages && !isHiddenExpanded;
  const hiddenFromAIHeader = isHiddenFromAI ? (
    <HiddenFromAIConversationButton
      canCollapse={collapseHiddenMessages}
      isHiddenExpanded={isHiddenExpanded}
      onExpand={() => setManuallyExpandedHidden((v) => !v)}
    />
  ) : null;

  // ── Edit ──
  const editSourceContent = originalContent ?? message.content;
  const formattedEditSourceContent = useMemo(
    () => formatTextQuotes(editSourceContent, quoteFormat),
    [editSourceContent, quoteFormat],
  );
  const editValueRef = useRef(editValue);
  editValueRef.current = editValue;

  const startEditing = useCallback(() => {
    editSwipeIndexRef.current = message.activeSwipeIndex ?? null;
    setEditing(true);
    setEditValue(formattedEditSourceContent);
    requestAnimationFrame(() => {
      const el = editRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
        el.focus();
      }
    });
  }, [formattedEditSourceContent, message.activeSwipeIndex]);

  const handleSaveEdit = useCallback(() => {
    if (editSwipeIndexRef.current !== null && editSwipeIndexRef.current !== (message.activeSwipeIndex ?? null)) {
      editSwipeIndexRef.current = null;
      setEditing(false);
      return;
    }
    const val = formatTextQuotes(editValueRef.current.trim(), quoteFormat);
    if (val !== editSourceContent) onEdit?.(message.id, val);
    editSwipeIndexRef.current = null;
    setEditing(false);
  }, [editSourceContent, message.activeSwipeIndex, message.id, onEdit, quoteFormat]);

  const handleCancelEdit = useCallback(() => {
    editSwipeIndexRef.current = null;
    setEditing(false);
  }, []);

  const handleSetActiveSwipe = useCallback(
    (messageId: string, index: number) => {
      if (index === message.activeSwipeIndex) return;
      editSwipeIndexRef.current = null;
      setEditing(false);
      onSetActiveSwipe?.(messageId, index);
    },
    [message.activeSwipeIndex, onSetActiveSwipe],
  );

  useEffect(() => {
    if (!editing) return;
    if (editSwipeIndexRef.current === null) return;
    if (editSwipeIndexRef.current !== (message.activeSwipeIndex ?? null)) {
      editSwipeIndexRef.current = null;
      setEditing(false);
    }
  }, [editing, message.activeSwipeIndex]);

  const handleStartEdit = useCallback(() => {
    if (onEditClick) onEditClick();
    else startEditing();
  }, [onEditClick, startEditing]);

  useEffect(() => {
    if (!onEdit) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ messageId?: string }>).detail;
      if (detail?.messageId !== message.id) return;
      handleStartEdit();
    };
    window.addEventListener("marinara:start-edit-message", handler);
    return () => window.removeEventListener("marinara:start-edit-message", handler);
  }, [message.id, onEdit, handleStartEdit]);

  // ── Copy / translate ──
  const handleCopy = useCallback(() => {
    copyToClipboard(renderedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [renderedContent]);

  const handleTranslate = useCallback(
    () => translate(message.id, renderedContent, message.chatId),
    [message.id, message.chatId, renderedContent, translate],
  );

  // ── Mobile tap (show actions / multi-select) ──
  const handleMobileTap = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, textarea")) return;
      if (multiSelectMode) {
        onToggleSelect?.({
          messageId: message.id,
          orderIndex: messageOrderIndex ?? 0,
          checked: !isSelected,
          shiftKey: e.shiftKey,
        });
        return;
      }
      if (!matchMedia("(pointer: coarse)").matches) return;
      setShowActions((v) => !v);
    },
    [isSelected, message.id, messageOrderIndex, multiSelectMode, onToggleSelect],
  );

  // ── Effects ──
  useEffect(() => {
    setManuallyExpandedHidden(false);
  }, [message.id]);
  useEffect(() => {
    if (!isHiddenFromAI || !collapseHiddenMessages) setManuallyExpandedHidden(false);
  }, [collapseHiddenMessages, isHiddenFromAI]);
  useEffect(() => {
    if (!generationReplay) setShowGenerationReplay(false);
  }, [generationReplay]);
  useEffect(() => {
    if (!showActions) return;
    const handleTouch = (e: TouchEvent) => {
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("touchstart", handleTouch);
    return () => document.removeEventListener("touchstart", handleTouch);
  }, [showActions]);

  // ── Bubble-specific derived values ──
  const streamingBubbleDraftContent =
    isBubbleStyle && !!isStreaming && renderedContentParts?.length ? renderedContentParts.join("\n\n") : null;
  const shouldHideUserAvatar = (isUser && !!hideUserAvatar) || (isBubbleStyle && isUser);
  const bubbleCornerClass = isUser
    ? bubbleGroupPosition === "single"
      ? "rounded-2xl"
      : bubbleGroupPosition === "first"
        ? "rounded-2xl rounded-br-md"
        : bubbleGroupPosition === "middle"
          ? "rounded-2xl rounded-r-md"
          : "rounded-2xl rounded-tr-md"
    : bubbleGroupPosition === "single"
      ? "rounded-2xl"
      : bubbleGroupPosition === "first"
        ? "rounded-2xl rounded-bl-md"
        : bubbleGroupPosition === "middle"
          ? "rounded-2xl rounded-l-md"
          : "rounded-2xl rounded-tl-md";

  // ── Build shared render context ──
  const ctx: MessageRenderContext = {
    message,
    extra,
    isUser,
    isGrouped: !!isGrouped,
    displayName,
    avatarUrl,
    avatarCropStyle,
    nameColor,
    mentionNames,
    charByName,
    quoteFormat,
    renderedContent,
    renderedContentParts,
    emojiMap: emojiMap ?? EMPTY_CUSTOM_EMOJI_MAP,
    stickerMap: stickerMap ?? EMPTY_CUSTOM_STICKER_MAP,
    groupedSegments,
    visibleSegments,
    streamingBubbleDraftContent,
    isStreaming,
    editing,
    editValue,
    editRef,
    onEditValueChange: setEditValue,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: handleCancelEdit,
    isHiddenFromAI,
    isHiddenCollapsed,
    hiddenFromAIHeader,
    onExpandHidden: () => setManuallyExpandedHidden(true),
    showActions,
    forceShowActions,
    hideActions,
    noHoverGroup,
    hideTimestamp,
    hideUserAvatar,
    showMessageNumbers,
    messageIndex,
    copied,
    isGuided,
    regenerateButtonTitle,
    regenerateGuidedClass,
    thinking,
    generationReplay,
    canRegenerate,
    isLastAssistantMessage,
    translatedText,
    isTranslating,
    hasSwipes: (message.swipeCount ?? 0) > 1,
    swipeCount: message.swipeCount ?? 0,
    multiSelectMode,
    isSelected,
    onToggleSelect:
      multiSelectMode && onToggleSelect
        ? () =>
            onToggleSelect({
              messageId: message.id,
              orderIndex: messageOrderIndex ?? 0,
              checked: !isSelected,
              shiftKey: false,
            })
        : undefined,
    handleMobileTap,
    onCopy: handleCopy,
    onTranslate: handleTranslate,
    onStartEdit: handleStartEdit,
    onImageOpen: (url, prompt) => setImageLightbox({ url, prompt }),
    onRemoveAttachment: handleRemoveAttachment,
    onSetActiveSwipe: handleSetActiveSwipe,
    onRegenerate,
    onToggleHiddenFromAI,
    onPeekPrompt,
    onDelete,
    onShowGenerationReplay: () => setShowGenerationReplay(true),
    onShowThinking: () => setShowThinking(true),
    onPickReaction: handleToggleReaction,
    messageTextStyle,
    isBubbleStyle,
    bubbleGroupPosition,
    bubbleCornerClass,
    shouldHideUserAvatar,
  };

  // ── Reaction chip row ──
  // Rendered by the shell as a sibling of the message row, OUTSIDE the
  // [data-card-css] container, so a character's bubble theme can't restyle it.
  // Indented to sit under the message body; right-aligned for user bubbles.
  const reactionRow =
    reactions.length > 0 && !isHiddenCollapsed ? (
      <div
        className={cn(
          "mari-message-reactions-row pb-1",
          isBubbleStyle && isUser ? "flex justify-end px-4" : "pl-[4.5rem] pr-4",
        )}
      >
        <MessageReactions reactions={reactions} resolveReactorName={resolveReactorName} onToggle={handleToggleReaction} />
      </div>
    ) : null;

  // ── Shared modals (portals, rendered outside the layout) ──
  const modals = (
    <>
      {showThinking &&
        thinking &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]"
            onClick={() => setShowThinking(false)}
          >
            <div
              className="relative mx-4 flex max-h-[70vh] w-full max-w-xl flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Brain size="0.875rem" className="text-[var(--muted-foreground)]" />
                  Model Thoughts
                </div>
                <button
                  onClick={() => setShowThinking(false)}
                  className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  <X size="0.875rem" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-3">
                <pre className="whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
                  {thinking}
                </pre>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {generationReplay && (
        <GenerationReplayDetailsModal
          open={showGenerationReplay}
          replay={generationReplay}
          onClose={() => setShowGenerationReplay(false)}
        />
      )}
      {imageLightbox &&
        createPortal(
          <ConversationMessageLightbox
            url={imageLightbox.url}
            prompt={imageLightbox.prompt}
            onClose={() => setImageLightbox(null)}
          />,
          document.body,
        )}
    </>
  );

  // ── System message ──
  if (isSystem) {
    return (
      <div
        ref={msgRef}
        className={cn(
          "group flex justify-center py-1",
          multiSelectMode && isSelected && "rounded-lg bg-[var(--destructive)]/10",
        )}
        onClick={handleMobileTap}
      >
        <div className="relative">
          {!multiSelectMode && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(message.id);
              }}
              className={cn(
                "absolute -right-1 -top-1 rounded-md p-1 text-[var(--muted-foreground)]/30 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100",
                showActions && "opacity-100",
              )}
              title="Delete"
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  // ── Grouped multi-speaker layout ──
  if (groupedSegments && !editing && !isUser && !isBubbleStyle) {
    return (
      <>
        <ConversationMessageGrouped ctx={ctx} msgRef={msgRef} />
        {reactionRow}
        {modals}
      </>
    );
  }

  // ── Main layout (bubble or line) ──
  return (
    <>
      <div
        ref={msgRef}
        className={cn(
          "mari-message relative px-4 transition-colors",
          !noHoverGroup && "group",
          isBubbleStyle
            ? cn("py-1", isUser ? "mari-message-user" : "mari-message-assistant", !isGrouped && "mt-2.5")
            : cn(
                "flex gap-4 py-0.5 hover:bg-[var(--secondary)]/30",
                isUser ? "mari-message-user" : "mari-message-assistant",
                isGrouped ? "mt-0" : "mt-4",
                isStreaming && "bg-[var(--secondary)]/20",
              ),
          multiSelectMode && isSelected && "bg-[var(--destructive)]/10",
        )}
        data-message-id={message.id}
        data-message-role={message.role}
        data-card-css={message.characterId ?? undefined}
        data-grouped={isGrouped || undefined}
        onClick={handleMobileTap}
      >
        {isBubbleStyle ? <ConversationMessageBubble ctx={ctx} /> : <ConversationMessageLine ctx={ctx} />}

        {!hideActions && (
          <ConversationMessageActions
            isBubbleStyle={isBubbleStyle}
            isUser={isUser}
            showActions={showActions}
            forceShowActions={forceShowActions}
            copied={copied}
            translatedText={translatedText}
            isHiddenFromAI={isHiddenFromAI}
            canRegenerate={canRegenerate}
            isLastAssistantMessage={isLastAssistantMessage}
            thinking={thinking}
            generationReplay={generationReplay}
            isGuided={isGuided}
            regenerateButtonTitle={regenerateButtonTitle}
            regenerateGuidedClass={regenerateGuidedClass}
            onCopy={handleCopy}
            onTranslate={handleTranslate}
            onEdit={handleStartEdit}
            onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
            onBranch={onBranch ? () => onBranch(message.id) : undefined}
            onToggleHiddenFromAI={
              onToggleHiddenFromAI ? () => onToggleHiddenFromAI(message.id, isHiddenFromAI) : undefined
            }
            onPeekPrompt={onPeekPrompt}
            onDelete={onDelete ? () => onDelete(message.id) : undefined}
            onShowGenerationReplay={() => setShowGenerationReplay(true)}
            onShowThinking={() => setShowThinking(true)}
            onPickReaction={handleToggleReaction}
          />
        )}
      </div>
      {reactionRow}
      {modals}
    </>
  );
});
