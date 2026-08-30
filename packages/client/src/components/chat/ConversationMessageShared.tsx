// ──────────────────────────────────────────────
// Shared utilities, helpers, and types used across
// the ConversationMessage* family of components.
// ──────────────────────────────────────────────
import { Fragment, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronRight, EyeOff, FileText, X } from "lucide-react";
import {
  type GroupedSegment,
  type MessageExtra,
  type MessageReaction,
  type QuoteFormat,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import type { ReactionSegmentTarget } from "../../lib/reactions";
import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { resolveSelfCardAssets, type ChatGalleryIndex } from "../../lib/card-asset-links";
import { renderInlineWithCustomEmojis } from "../../lib/custom-emoji-render";
import { renderWithStickerBlocks } from "../../lib/sticker-render";
import { applyTextareaQuoteFormat } from "../../lib/textarea-quotes";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { MessageActionButton } from "./MessageActionButton";
import { SwipeJumpControl } from "./SwipeJumpControl";
import { AnimatedDiceRoll, isDiceRollResult, shouldAnimateDiceRollMessage } from "../dice/AnimatedDiceRoll";
import type { CharacterMap } from "./chat-area.types";
import { useTranslation as useUiTranslation } from "react-i18next";

const EMPTY_INLINE_EMOJI_MAP = new Map<string, string>();

// ── Types ────────────────────────────────────────

export type CharInfo = NonNullable<ReturnType<CharacterMap["get"]>>;

export interface MessageData {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "narrator";
  characterId: string | null;
  content: string;
  activeSwipeIndex: number;
  swipeCount?: number;
  extra: {
    displayText: string | null;
    isGenerated: boolean;
    tokenCount: number | null;
    generationInfo: { model?: string; tokensIn?: number; tokensOut?: number; duration?: number } | null;
    isConversationStart?: boolean;
    hiddenFromAI?: boolean;
    thinking?: string | null;
    generationReplay?: MessageExtra["generationReplay"];
    diceRollResult?: MessageExtra["diceRollResult"];
    attachments?: Array<{
      type: string;
      url?: string;
      data?: string;
      filename?: string;
      name?: string;
      prompt?: string;
      galleryId?: string;
    }>;
  };
  createdAt: string;
}

export function DiceMessageContent({
  diceRollResult,
  createdAt,
}: {
  diceRollResult: unknown;
  createdAt?: string | null;
}) {
  if (!isDiceRollResult(diceRollResult)) return null;
  return <AnimatedDiceRoll {...diceRollResult} mode="chat" animate={shouldAnimateDiceRollMessage(createdAt)} />;
}

/** Everything the layout sub-components (Bubble, Line, Grouped) need, pre-resolved by the shell. */
export interface MessageRenderContext {
  // raw
  message: MessageData;
  extra: MessageData["extra"];
  isUser: boolean;
  isGrouped: boolean;
  // identity
  displayName: string;
  avatarUrl: string | null;
  avatarCropStyle: CSSProperties;
  avatarCornerClass: string;
  nameColor?: string;
  mentionNames: string[];
  charByName: Map<string, CharInfo> | null;
  /** Same keys as charByName, mapping normalized speaker name -> character id
   *  (CharInfo carries no id; grouped segments need it for card://self refs). */
  charIdByName: Map<string, string> | null;
  /** Speaking character of the whole message (null for user/system) — resolves
   *  portable card://self/gallery refs; grouped segments prefer their own speaker. */
  selfCharacterId: string | null;
  /** Chat-wide gallery filename index — card://self falls back to whichever
   *  chat character owns the file when the speaker doesn't (group chats). */
  galleryIndex: ChatGalleryIndex | null;
  // content
  quoteFormat: QuoteFormat;
  renderedContent: string;
  renderedContentParts: string[] | null;
  emojiMap: Map<string, string>;
  stickerMap: Map<string, string>;
  groupedSegments: GroupedSegment[] | null;
  visibleSegments: number;
  streamingBubbleDraftContent: string | null;
  // streaming
  isStreaming?: boolean;
  // edit state (owned by shell)
  editing: boolean;
  editValue: string;
  editRef: RefObject<HTMLTextAreaElement | null>;
  onEditValueChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  // hidden-from-AI
  isHiddenFromAI: boolean;
  isHiddenCollapsed: boolean;
  hiddenFromAIHeader: ReactNode;
  onExpandHidden: () => void;
  // actions visibility
  showActions: boolean;
  forceShowActions?: boolean;
  hideActions?: boolean;
  noHoverGroup?: boolean;
  hideTimestamp?: boolean;
  hideUserAvatar?: boolean;
  showMessageNumbers: boolean;
  messageIndex?: number;
  // actions state
  copied: boolean;
  isGuided: boolean;
  regenerateButtonTitle: string;
  regenerateGuidedClass?: string;
  hasReasoning: boolean;
  reasoningSummaryUnavailable: boolean;
  thinkingButtonRef: RefObject<HTMLButtonElement | null>;
  generationReplay: MessageExtra["generationReplay"] | null;
  canRegenerate: boolean;
  isLastAssistantMessage?: boolean;
  translatedText?: string | null;
  isTranslating: boolean;
  showTranslationOnly: boolean;
  // swipes
  hasSwipes: boolean;
  swipeCount: number;
  // multi-select
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  // handlers
  handleMobileTap: (e: React.MouseEvent) => void;
  onCopy: () => void;
  onTranslate: () => void;
  onStartEdit: () => void;
  onImageOpen: (url: string, prompt?: string | null) => void;
  /** Open the Convo about-me profile popout, anchored to the clicked avatar (undefined when unresolvable). */
  onOpenAboutMe?: (anchor: DOMRect) => void;
  onRemoveAttachment: (index: number) => void;
  onSetActiveSwipe?: (id: string, index: number) => void;
  onRegenerate?: (id: string) => void;
  onToggleHiddenFromAI?: (id: string, current: boolean) => void;
  onPeekPrompt?: () => void;
  onDelete?: (id: string) => void;
  onShowGenerationReplay: () => void;
  onShowThinking: () => void;
  // reactions — toggle the user's reaction on this message (chip row rendered by the shell)
  onPickReaction?: (emoji: string, imageUrl: string | null) => void;
  // reactions — segment-targeted (grouped multi-speaker messages, issue #3210)
  /** Per-segment reaction lists, index-aligned with groupedSegments; null when not grouped. */
  segmentReactions: MessageReaction[][] | null;
  /** Resolve a reactor id ("user" or a character id) to a display name for chip tooltips. */
  resolveReactorName: (reactorId: string) => string;
  /** Toggle the user's reaction aimed at one grouped speaker segment. */
  onPickSegmentReaction?: (target: ReactionSegmentTarget, emoji: string, imageUrl: string | null) => void;
  /** Toggle the user's membership in an existing reaction entry (segment-aware chip click). */
  onToggleReactionEntry: (reaction: MessageReaction) => void;
  /** Remove character membership from an existing reaction entry. */
  onRemoveCharacterReaction: (reaction: MessageReaction) => void;
  // style
  messageTextStyle: CSSProperties;
  // bubble-specific (ignored by Line/Grouped)
  isBubbleStyle: boolean;
  bubbleGroupPosition: "single" | "first" | "middle" | "last";
  bubbleCornerClass: string;
  shouldHideUserAvatar: boolean;
}

// ── Pure helpers ─────────────────────────────────

export function nameColorStyle(color?: string): CSSProperties | undefined {
  if (!color) return undefined;
  if (color.includes("gradient(")) {
    return {
      backgroundImage: color,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
      display: "inline-block",
    };
  }
  return { color };
}

export function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (diffDays === 0 && date.getDate() === now.getDate()) return `Today at ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (diffDays <= 1 && date.getDate() === yesterday.getDate()) return `Yesterday at ${time}`;
    return `${date.toLocaleDateString()} ${time}`;
  } catch {
    return "";
  }
}

export const IMAGE_URL_RE = /^https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?[^\s]*)?$/i;

export function highlightMentions(nodes: ReactNode[], names: string[], keyPrefix: string): ReactNode[] {
  if (names.length === 0) return nodes;
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(@(?:${sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))(\\b|(?=[^\\w])|$)`,
    "gi",
  );
  let key = 0;
  return nodes.flatMap((node) => {
    if (typeof node !== "string") return [node];
    const parts: ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(node)) !== null) {
      if (m.index > lastIdx) parts.push(node.slice(lastIdx, m.index));
      parts.push(
        <span
          key={`${keyPrefix}at${key++}`}
          className="mention-highlight rounded-[3px] bg-[var(--primary)]/15 px-px text-[var(--primary)] font-medium hover:bg-[var(--primary)]/25 cursor-default"
        >
          {m[1]}
        </span>,
      );
      lastIdx = m.index + m[1]!.length;
      pattern.lastIndex = lastIdx;
    }
    if (lastIdx < node.length) parts.push(node.slice(lastIdx));
    return parts.length > 0 ? parts : [node];
  });
}

// Speaker-segment parsing (parseSpeakerTags / parseNamePrefixFormat /
// groupConsecutiveSegments / parseGroupedSpeakerSegments) lives in
// @marinara-engine/shared (utils/speaker-segments.ts): the server derives
// reaction-attribution segment indexes with the same code.

// ── Small shared components ───────────────────────

/**
 * Message sender name. When `onOpenAboutMe` is provided (Convo, with a resolvable
 * character/persona target) the name becomes clickable and opens the about-me
 * popout anchored to itself — matching the clickable avatar. Kept as a `span`
 * with `role="button"` (not a `<button>`) so it stays inline and baseline-aligned
 * with the timestamp beside it. Falls back to a plain, non-interactive label.
 */
export function ConversationMessageName({
  displayName,
  nameColor,
  onOpenAboutMe,
  className,
}: {
  displayName: string;
  nameColor?: string;
  onOpenAboutMe?: (anchor: DOMRect) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const baseClass = "mari-message-name text-[0.9375rem] font-semibold leading-tight";
  if (!onOpenAboutMe) {
    return (
      <span className={cn(baseClass, "cursor-default", className)} style={nameColorStyle(nameColor)}>
        {displayName}
      </span>
    );
  }
  const open = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onOpenAboutMe(e.currentTarget.getBoundingClientRect());
  };
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(e);
        }
      }}
      aria-label={localizeUi("ui.chat.conversationmessagebubble.viewValue1SAboutMe", { value1: displayName })}
      title={localizeUi("ui.chat.conversationmessagebubble.viewValue1SAboutMe", { value1: displayName })}
      className={cn(
        baseClass,
        "cursor-pointer rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
        className,
      )}
      style={nameColorStyle(nameColor)}
    >
      {displayName}
    </span>
  );
}

export function HiddenFromAIConversationButton({
  canCollapse,
  onExpand,
  isHiddenExpanded,
}: {
  canCollapse: boolean;
  onExpand: () => void;
  isHiddenExpanded: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!canCollapse) {
    return (
      <span
        className="inline-flex items-center gap-1 align-middle text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-highlight-text)]"
        title={localizeUi("ui.chat.conversationmessagegrouped.hiddenFromAi")}
      >
        <EyeOff size="0.7rem" className="shrink-0" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-highlight-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
        )}
        aria-label={
          isHiddenExpanded
            ? localizeUi("ui.chat.hiddenfromaiconversationbutton.collapseHiddenFromAiMessage")
            : localizeUi("ui.chat.hiddenfromaimessagesummary.expandHiddenFromAiMessage")
        }
        title={
          isHiddenExpanded
            ? localizeUi("ui.chat.hiddenfromaiconversationbutton.collapseHiddenFromAiMessage")
            : localizeUi("ui.chat.hiddenfromaimessagesummary.expandHiddenFromAiMessage")
        }
      >
        <ChevronRight size="0.7rem" className={cn("shrink-0 transition-transform", isHiddenExpanded && "rotate-90")} />
        <EyeOff size="0.7rem" className="shrink-0" />
      </button>
    </span>
  );
}

export function HiddenFromAIConversationSummary({ onExpand }: { onExpand: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onExpand();
      }}
      className="flex w-full items-center gap-2 rounded-md border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2.5 py-1.5 text-left text-[0.75rem] text-[var(--marinara-chat-chrome-highlight-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]"
      title={localizeUi("ui.chat.hiddenfromaimessagesummary.expandHiddenFromAiMessage")}
      aria-label={localizeUi("ui.chat.hiddenfromaimessagesummary.expandHiddenFromAiMessage")}
    >
      <EyeOff size="0.8rem" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{localizeUi("ui.chat.conversationmessagegrouped.hiddenFromAi")}</span>
      <span className="shrink-0 text-[0.625rem] opacity-70">
        {localizeUi("ui.chat.hiddenfromaimessagesummary.show")}
      </span>
    </button>
  );
}

export function MessageContent({
  content,
  mentionNames,
  emojiMap,
  stickerMap,
  onImageOpen,
  selfCharacterId,
  galleryIndex,
}: {
  content: string;
  mentionNames?: string[];
  emojiMap?: Map<string, string>;
  stickerMap?: Map<string, string>;
  onImageOpen: (url: string) => void;
  /** Speaking character of this content — resolves portable card://self/gallery refs. */
  selfCharacterId?: string | null;
  /** Optional chat-wide filename index for any-owner fallback resolution. */
  galleryIndex?: ChatGalleryIndex | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  // Portable gallery refs resolve to the speaker BEFORE markdown rendering, so
  // the shared renderer stays untouched and grouped segments can resolve to
  // their own per-segment speaker.
  const resolved = resolveSelfCardAssets(content, selfCharacterId, galleryIndex);
  if (IMAGE_URL_RE.test(resolved.trim())) {
    const url = resolved.trim();
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onImageOpen(url);
        }}
        className="block cursor-zoom-in rounded-lg text-left"
        title={localizeUi("ui.noodle.noodlepostcard.openImage")}
      >
        <img
          src={url}
          alt={localizeUi("ui.chat.messagecontent.gif")}
          className="max-h-48 max-w-full sm:max-w-xs rounded-lg"
          loading="lazy"
        />
      </button>
    );
  }
  const compacted = resolved.replace(/\n{3,}/g, "\n\n");
  const baseInline = mentionNames?.length
    ? (text: string, kp: string) => highlightMentions(applyInlineMarkdown(text, kp), mentionNames, kp)
    : applyInlineMarkdown;
  const renderInline = (text: string, kp: string) =>
    renderInlineWithCustomEmojis(text, kp, emojiMap ?? EMPTY_INLINE_EMOJI_MAP, baseInline);
  const renderTextBlock = (text: string, kp: string) => (
    <Fragment key={kp}>{renderMarkdownBlocks(text, renderInline)}</Fragment>
  );
  return (
    <>
      {stickerMap ? renderWithStickerBlocks(compacted, stickerMap, renderTextBlock) : renderTextBlock(compacted, "sc")}
    </>
  );
}

/** Tiny action-bar button. */
export function MsgAction({
  icon,
  onClick,
  title,
  className,
  tabIndex,
  buttonRef,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  tabIndex?: number;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <MessageActionButton
      buttonRef={buttonRef}
      icon={icon}
      onClick={onClick}
      title={title}
      className={className}
      tabIndex={tabIndex}
      stopPropagation
    />
  );
}

/** Edit textarea + save/cancel controls. */
export function ConversationMessageEditForm({
  editRef,
  editValue,
  onValueChange,
  onSave,
  onCancel,
  messageTextStyle,
  quoteFormat,
}: {
  editRef: RefObject<HTMLTextAreaElement | null>;
  editValue: string;
  onValueChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  messageTextStyle: CSSProperties;
  quoteFormat: QuoteFormat;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-2">
      <textarea
        ref={editRef}
        data-chat-message-editor="true"
        value={editValue}
        onChange={(e) => {
          const nextValue = applyTextareaQuoteFormat(e.currentTarget, quoteFormat, e.nativeEvent as InputEvent);
          onValueChange(nextValue);
          const el = e.target;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
        }}
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.9375rem] leading-relaxed outline-none"
        rows={1}
        style={{ overflow: "auto", ...messageTextStyle }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
        <button onClick={onCancel} className="text-foreground/70 hover:underline hover:text-foreground">
          {localizeUi("ui.chat.conversationmessageeditform.cancel")}
        </button>
        <span>·</span>
        <button onClick={onSave} className="text-foreground/70 hover:underline hover:text-foreground">
          {localizeUi("ui.chat.conversationmessageeditform.save")}
        </button>
      </div>
    </div>
  );
}

/** Attachment grid with remove button. */
export function ConversationMessageAttachments({
  attachments,
  renderedContent,
  onImageOpen,
  onRemove,
}: {
  attachments: Array<{ type: string; url?: string; data?: string; filename?: string; name?: string; prompt?: string }>;
  renderedContent: string;
  onImageOpen: (url: string, prompt?: string | null) => void;
  onRemove: (i: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!attachments.length || IMAGE_URL_RE.test(renderedContent.trim())) return null;
  return (
    <div className="mt-1.5 flex flex-col items-start gap-2">
      {attachments.map((att, i) =>
        att.type === "image" || att.type?.startsWith("image/") ? (
          <div key={i} className="group/att relative inline-block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onImageOpen(att.url || att.data || "", att.prompt);
              }}
              className="block cursor-zoom-in rounded-lg text-left"
              title={localizeUi("ui.noodle.noodlepostcard.openImage")}
            >
              <img
                src={att.url || att.data}
                alt={att.filename || att.name || "image"}
                className="max-h-[70vh] max-w-full rounded-lg object-contain sm:max-h-[32rem]"
                loading="lazy"
              />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(i);
              }}
              title={localizeUi("ui.chat.chatmessage.removeFromMessage")}
              className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white/80 transition-opacity hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover/att:opacity-100"
            >
              <X size="0.875rem" />
            </button>
          </div>
        ) : (
          <div
            key={i}
            className="group/att flex max-w-full items-center gap-2 rounded-lg bg-foreground/10 px-2.5 py-1.5 text-xs text-foreground/70 ring-1 ring-foreground/10"
          >
            <FileText size="0.875rem" className="shrink-0 text-[var(--primary)]" />
            <span className="min-w-0 max-w-[16rem] truncate">{att.filename || att.name || "attachment"}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(i);
              }}
              title={localizeUi("ui.chat.chatmessage.removeFromMessage")}
              className="rounded-full p-0.5 text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-[var(--destructive)] sm:opacity-0 sm:group-hover/att:opacity-100"
            >
              <X size="0.75rem" />
            </button>
          </div>
        ),
      )}
    </div>
  );
}

/** Translation display block. */
export function ConversationMessageTranslation({
  translatedText,
  isTranslating,
}: {
  translatedText?: string | null;
  isTranslating: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!translatedText && !isTranslating) return null;
  return (
    <div className="mt-1.5 border-t border-[var(--border)] pt-1.5">
      {isTranslating ? (
        <span className="text-[0.75rem] italic text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatmessage.translating")}
        </span>
      ) : (
        <div className="translation-text whitespace-pre-wrap">{translatedText}</div>
      )}
    </div>
  );
}

/** Compact swipe control — consistent style for all Conversation layouts. */
export function ConversationMessageSwipes({
  messageId,
  activeSwipeIndex,
  swipeCount,
  onSetActiveSwipe,
  onCreateNextSwipe,
  className,
}: {
  messageId: string;
  activeSwipeIndex: number;
  swipeCount: number;
  onSetActiveSwipe: (index: number) => void;
  onCreateNextSwipe?: () => void;
  className?: string;
}) {
  return (
    <SwipeJumpControl
      messageId={messageId}
      activeSwipeIndex={activeSwipeIndex}
      swipeCount={swipeCount}
      onSetActiveSwipe={onSetActiveSwipe}
      onCreateNextSwipe={onCreateNextSwipe}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]",
        className,
      )}
      buttonClassName="rounded-sm p-0.5 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
      inputClassName="h-[1.25rem] w-[2rem] border-none bg-transparent text-center text-[0.625rem] outline-none"
    />
  );
}

/** Image lightbox portal content. */
export function ConversationMessageLightbox({
  url,
  prompt,
  onClose,
}: {
  url: string;
  prompt?: string | null;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={localizeUi("ui.chat.conversationmessagelightbox.expandedImage")}
          className={
            prompt?.trim()
              ? "max-h-[calc(90vh-9rem)] max-w-full rounded-lg object-contain shadow-2xl"
              : "max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          }
        />
        <ImagePromptPanel prompt={prompt} className="w-full max-w-3xl" />
      </div>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
        aria-label={localizeUi("ui.chat.chatimagelightbox.closeImage")}
      >
        <X size="1.125rem" />
      </button>
    </div>
  );
}
