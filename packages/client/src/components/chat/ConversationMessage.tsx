// ──────────────────────────────────────────────
// Chat: Conversation message shell
// Resolves character/persona identity, builds render context,
// and delegates to the appropriate layout component.
// ──────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect, memo, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Brain, Phone, PhoneIncoming, PhoneOff, Trash2, X } from "lucide-react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  formatTextQuotes,
  normalizeTextForMatch,
  parseGroupedSpeakerSegments,
  type Message,
  type MessageReaction,
} from "@marinara-engine/shared";
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
  type MessageData,
  type MessageRenderContext,
} from "./ConversationMessageShared";
import { ConversationMessageActions } from "./ConversationMessageActions";
import { ConversationMessageGrouped } from "./ConversationMessageGrouped";
import { ConversationMessageBubble } from "./ConversationMessageBubble";
import { ConversationMessageLine } from "./ConversationMessageLine";
import { MessageReactions } from "./MessageReactions";
import {
  findRetargetableUserReaction,
  reactionTargetOf,
  splitReactionsBySegment,
  toggleReaction,
  USER_REACTOR,
  type ReactionSegmentTarget,
} from "../../lib/reactions";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";

const EMPTY_CUSTOM_EMOJI_MAP = new Map<string, string>();
const EMPTY_CUSTOM_STICKER_MAP = new Map<string, string>();
const CONVERSATION_MESSAGE_CHROME_RING_CLASS = "ring-[var(--marinara-chat-chrome-focus-ring)]";

function formatCallDuration(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const seconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes <= 0) return `${remaining} seconds`;
  if (minutes === 1) return remaining > 0 ? `1 minute ${remaining} seconds` : "1 minute";
  return remaining > 0 ? `${minutes} minutes ${remaining} seconds` : `${minutes} minutes`;
}

function formatCallTimestamp(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  visibleSegmentCount?: number;
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
  visibleSegmentCount,
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
  const isConversationStart = extra.isConversationStart === true;
  const isHiddenFromAI = extra.hiddenFromAI === true;
  const conversationCallEvent =
    extra.conversationCallEvent && typeof extra.conversationCallEvent === "object" && !Array.isArray(extra.conversationCallEvent)
      ? (extra.conversationCallEvent as Record<string, unknown>)
      : null;
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
    if (message.characterId) allowedIds.add(message.characterId);
    return new Map(Array.from(characterMap).filter(([id]) => allowedIds.has(id)));
  }, [characterMap, chatCharacterIds, message.characterId]);

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

  // #3164: seed display randomness by message identity — this site previously
  // passed no seed, so every {{random}}/{{roll}} re-rolled (Math.random) on
  // every recompute, even for finished messages.
  const renderedContent = useMemo(
    () =>
      formatTextQuotes(
        resolveMessageMacros(message.content, macroContext, {
          randomSeed: `${message.id}:${message.activeSwipeIndex ?? 0}`,
        }),
        quoteFormat,
      ),
    [macroContext, message.activeSwipeIndex, message.content, message.id, quoteFormat],
  );
  const renderedContentParts = useMemo(() => {
    if (!contentParts?.length) return null;
    const count = Math.max(1, Math.min(visiblePartCount ?? contentParts.length, contentParts.length));
    return contentParts
      .slice(0, count)
      .map((part, partIndex) =>
        formatTextQuotes(
          resolveMessageMacros(part, macroContext, {
            randomSeed: `${message.id}:${message.activeSwipeIndex ?? 0}:${partIndex}`,
          }),
          quoteFormat,
        ),
      );
  }, [contentParts, macroContext, message.activeSwipeIndex, message.id, quoteFormat, visiblePartCount]);

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
  // Persist a new reactions array for this message; optimistic, then PATCH extra
  // (mirrors handleRemoveAttachment). Character reactions are applied server-side.
  const applyReactions = useCallback(
    async (next: MessageReaction[]) => {
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
    [message.chatId, message.id, qc],
  );

  // Toggle the human's reaction. `target` aims it at one grouped speaker segment
  // (issue #3210); omitted, it applies to the whole message as before.
  const handleToggleReaction = useCallback(
    (emoji: string, imageUrl: string | null, target?: ReactionSegmentTarget) =>
      applyReactions(toggleReaction(reactions, emoji, USER_REACTOR, imageUrl, target)),
    [applyReactions, reactions],
  );

  // Resolve a reactor id to a display name for the chip tooltips.
  const resolveReactorName = useCallback(
    (reactorId: string) =>
      reactorId === USER_REACTOR ? "You" : (scopedCharacterMap?.get(reactorId)?.name ?? "Someone"),
    [scopedCharacterMap],
  );

  // Toggle the user's membership in an existing reaction entry (chip click) —
  // re-targets the entry's own segment so orphaned entries toggle themselves.
  const handleToggleReactionEntry = useCallback(
    (reaction: MessageReaction) =>
      handleToggleReaction(reaction.emoji, reaction.imageUrl ?? null, reactionTargetOf(reaction)),
    [handleToggleReaction],
  );

  // ── Speaker-segment parsing (for grouped / group-in-bubble) ──
  const charByName = useMemo(() => {
    if (!scopedCharacterMap) return null;
    const map = new Map<string, NonNullable<ReturnType<CharacterMap["get"]>>>();
    for (const [id, v] of scopedCharacterMap) {
      if (v) {
        const key = normalizeTextForMatch(v.name);
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
    return parseGroupedSpeakerSegments(renderedContent, knownNames);
  }, [isUser, renderedContent, charByName]);

  // Segment-targeted reactions render inline under their speaker's segment; the
  // remainder (whole-message entries + orphans from a re-segmentation) keeps the
  // block-bottom row. The grouped layout is the only surface with per-segment
  // rows, so while it isn't rendered (editing, no parseable segments) every
  // reaction belongs to the bottom row — otherwise segment chips would vanish.
  const groupedLayoutActive = !!groupedSegments && !editing && !isUser;
  const { segmentReactions, messageReactions } = useMemo(
    () => splitReactionsBySegment(reactions, groupedLayoutActive ? groupedSegments : null),
    [reactions, groupedLayoutActive, groupedSegments],
  );

  // Add/toggle the user's reaction on one grouped speaker segment (per-segment
  // picker). If the user's same-emoji reaction to this speaker is stranded as an
  // orphan (stale segment target from another swipe's layout or an edit), move it
  // to the picked segment instead of stacking a second entry — unless this pick
  // is a plain toggle-off of a reaction already on the target segment.
  const handlePickSegmentReaction = useCallback(
    (target: ReactionSegmentTarget, emoji: string, imageUrl: string | null) => {
      const targetHasUser = (segmentReactions?.[target.segment] ?? []).some(
        (reaction) => reaction.emoji === emoji && reaction.by.includes(USER_REACTOR),
      );
      const orphan = targetHasUser ? undefined : findRetargetableUserReaction(messageReactions, emoji, target);
      const base = orphan ? toggleReaction(reactions, emoji, USER_REACTOR, null, reactionTargetOf(orphan)) : reactions;
      return applyReactions(toggleReaction(base, emoji, USER_REACTOR, imageUrl, target));
    },
    [applyReactions, messageReactions, reactions, segmentReactions],
  );

  // ── Staggered reveal for multi-speaker segments ──
  const segmentCount = groupedSegments?.length ?? 0;
  const prevContentRef = useRef(renderedContent);
  const initialRenderRef = useRef(true);
  const [internalVisibleSegments, setInternalVisibleSegments] = useState(segmentCount);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      setInternalVisibleSegments(segmentCount);
      prevContentRef.current = renderedContent;
      return;
    }
    if (renderedContent !== prevContentRef.current && segmentCount > 1) {
      prevContentRef.current = renderedContent;
      setInternalVisibleSegments(1);
      let count = 1;
      const reveal = () => {
        count++;
        setInternalVisibleSegments(count);
      };
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (let i = 1; i < segmentCount; i++) timers.push(setTimeout(reveal, i * 1500));
      return () => timers.forEach(clearTimeout);
    }
    setInternalVisibleSegments(segmentCount);
    prevContentRef.current = renderedContent;
  }, [renderedContent, segmentCount]);
  const visibleSegments =
    segmentCount > 0 ? Math.max(1, Math.min(visibleSegmentCount ?? internalVisibleSegments, segmentCount)) : 0;

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
    const val = formatTextQuotes(editValueRef.current, quoteFormat);
    if (val.trim().length > 0 && val !== formattedEditSourceContent) onEdit?.(message.id, val);
    editSwipeIndexRef.current = null;
    setEditing(false);
  }, [formattedEditSourceContent, message.activeSwipeIndex, message.id, onEdit, quoteFormat]);

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
  // Convo-only: clicking an avatar opens the about-me viewer for that identity.
  // The component only mounts in conversation mode, so this never applies elsewhere.
  const aboutMeTarget: { kind: "character" | "persona"; id: string } | null = isUser
    ? (msgPersona?.personaId ?? personaInfo?.id)
      ? { kind: "persona", id: (msgPersona?.personaId ?? personaInfo?.id)! }
      : null
    : message.characterId
      ? { kind: "character", id: message.characterId }
      : null;
  const onOpenAboutMe = aboutMeTarget
    ? (anchor: DOMRect) =>
        useUIStore.getState().openModal("about-me-viewer", {
          ...aboutMeTarget,
          anchorRect: {
            top: anchor.top,
            left: anchor.left,
            right: anchor.right,
            bottom: anchor.bottom,
            width: anchor.width,
            height: anchor.height,
          },
          avatarUrl,
          displayName,
          nameColor: nameColor ?? null,
          status: aboutMeTarget.kind === "character" ? (resolvedCharacterInfo?.conversationStatus ?? null) : null,
          activity: aboutMeTarget.kind === "character" ? (resolvedCharacterInfo?.conversationActivity ?? null) : null,
        })
    : undefined;

  const ctx: MessageRenderContext = {
    message,
    extra,
    isUser,
    isGrouped: !!isGrouped,
    displayName,
    avatarUrl,
    avatarCropStyle,
    nameColor,
    onOpenAboutMe,
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
    segmentReactions,
    resolveReactorName,
    onPickSegmentReaction: handlePickSegmentReaction,
    onToggleReactionEntry: handleToggleReactionEntry,
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
  // Holds the whole-message reactions; segment-targeted ones render inline under
  // their segment inside the grouped layout instead.
  const reactionRow =
    messageReactions.length > 0 && !isHiddenCollapsed ? (
      <div
        className={cn(
          "mari-message-reactions-row pb-1",
          isBubbleStyle && isUser ? "flex justify-end px-4" : "pl-[4.5rem] pr-4",
        )}
      >
        <MessageReactions
          reactions={messageReactions}
          resolveReactorName={resolveReactorName}
          onToggle={handleToggleReactionEntry}
        />
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
              className={cn(
                NEUTRAL_PANEL_SHELL,
                "relative mx-4 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between gap-3 px-4 py-3")}>
                <div className={cn(NEUTRAL_PANEL_TITLE, "text-sm")}>
                  <Brain size="0.875rem" className="text-[var(--marinara-chat-chrome-button-text-active)]" />
                  Model Thoughts
                </div>
                <button
                  onClick={() => setShowThinking(false)}
                  className="mari-chrome-control mari-chrome-control--small p-1.5"
                  aria-label="Close thoughts"
                >
                  <X size="0.875rem" />
                </button>
              </div>
              <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "overflow-y-auto px-4 py-3")}>
                <pre className="whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
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
    if (conversationCallEvent) {
      const status = typeof conversationCallEvent.status === "string" ? conversationCallEvent.status : "";
      const duration = formatCallDuration(conversationCallEvent.durationMs);
      const timestamp = formatCallTimestamp(message.createdAt);
      const title =
        status === "ended"
          ? "Call Ended"
          : status === "declined"
            ? "Call Declined"
            : status === "missed"
              ? "Missed Call"
              : status === "ringing"
                ? "Incoming Call"
                : "Call Started";
      const subtitle =
        status === "ended" && duration
          ? `${duration}${timestamp ? ` - ${timestamp}` : ""}`
          : timestamp || message.content;
      const Icon = status === "ended" || status === "declined" || status === "missed" ? PhoneOff : status === "ringing" ? PhoneIncoming : Phone;
      const iconClass =
        status === "ended" || status === "declined" || status === "missed"
          ? "text-[var(--muted-foreground)]"
          : "text-emerald-400";

      return (
        <div
          ref={msgRef}
          className={cn(
            "group flex justify-center px-4 py-2",
            multiSelectMode && isSelected && "rounded-lg bg-[var(--destructive)]/10",
          )}
          onClick={handleMobileTap}
        >
          <div className="relative w-full max-w-xl">
            {!multiSelectMode && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(message.id);
                }}
                className={cn(
                  "absolute -right-1 -top-1 rounded-md p-1 text-[var(--muted-foreground)]/30 opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100",
                  showActions && "opacity-100",
                )}
                title="Delete"
              >
                <Trash2 size="0.75rem" />
              </button>
            )}
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/90 px-4 py-3 text-left shadow-sm">
              <Icon size="1.25rem" className={cn("shrink-0", iconClass)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--foreground)]">{title}</div>
                <div className="truncate text-xs text-[var(--marinara-chat-chrome-panel-muted)]">{subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

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
                "absolute -right-1 -top-1 rounded-md p-1 text-[var(--muted-foreground)]/30 opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100",
                showActions && "opacity-100",
              )}
              title="Delete"
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
          <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  // ── Grouped multi-speaker layout ──
  if (groupedLayoutActive) {
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
          isConversationStart && cn("rounded-lg ring-1", CONVERSATION_MESSAGE_CHROME_RING_CLASS),
          isHiddenFromAI && cn("rounded-lg ring-1 saturate-75", CONVERSATION_MESSAGE_CHROME_RING_CLASS),
          multiSelectMode && isSelected && "bg-[var(--destructive)]/10 ring-[var(--destructive)]/50",
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
