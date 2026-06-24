// ──────────────────────────────────────────────
// Bubble message layout (Messenger-style)
// ──────────────────────────────────────────────
import { User } from "lucide-react";
import { normalizeTextForMatch } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import {
  HiddenFromAIConversationSummary,
  MessageContent,
  ConversationMessageEditForm,
  ConversationMessageAttachments,
  ConversationMessageTranslation,
  ConversationMessageSwipes,
  nameColorStyle,
  formatTimestamp,
  type MessageRenderContext,
} from "./ConversationMessageShared";

export function ConversationMessageBubble({ ctx }: { ctx: MessageRenderContext }) {
  const {
    message,
    extra,
    isUser,
    isGrouped,
    displayName,
    avatarUrl,
    avatarCropStyle,
    nameColor,
    mentionNames,
    quoteFormat,
    charByName,
    groupedSegments,
    visibleSegments,
    renderedContent,
    emojiMap,
    stickerMap,
    streamingBubbleDraftContent,
    isStreaming,
    editing,
    editValue,
    editRef,
    onEditValueChange,
    onSaveEdit,
    onCancelEdit,
    isHiddenCollapsed,
    hiddenFromAIHeader,
    onExpandHidden,
    hideActions,
    hideTimestamp,
    showActions,
    forceShowActions,
    showMessageNumbers,
    messageIndex,
    hasSwipes,
    swipeCount,
    onSetActiveSwipe,
    canRegenerate,
    onRegenerate,
    onImageOpen,
    onRemoveAttachment,
    translatedText,
    isTranslating,
    multiSelectMode,
    isSelected,
    onToggleSelect,
    messageTextStyle,
    bubbleCornerClass,
    shouldHideUserAvatar,
  } = ctx;

  return (
    <>
      {/* Inner row: avatar + body — swipes live outside so avatar never drifts */}
      <div className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
        {/* Multi-select checkbox */}
        {multiSelectMode && (
          <div className="flex items-center flex-shrink-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={isSelected ? "Deselect message" : "Select message"}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onToggleSelect?.();
                }
              }}
              className={cn(
                "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer",
                isSelected
                  ? "border-[var(--destructive)] bg-[var(--destructive)]"
                  : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)]",
              )}
            >
              {isSelected && <span className="text-white text-xs font-bold">✓</span>}
            </button>
          </div>
        )}

        {/* Avatar column */}
        <div className={cn("mari-message-avatar w-10 flex-shrink-0", shouldHideUserAvatar && "hidden")}>
          {!isGrouped && (
            <>
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[var(--accent)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    style={avatarCropStyle}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--muted-foreground)]">
                    {isUser ? <User size="1.125rem" /> : displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {(showActions || forceShowActions || showMessageNumbers) && messageIndex != null && (
                <span className="mt-0.5 block text-center text-[0.5rem] font-medium text-[var(--muted-foreground)] select-none">
                  #{messageIndex}
                </span>
              )}
            </>
          )}
        </div>

        {/* Body column — header + bubble + attachments (no swipes) */}
        <div
          className={cn(
            "mari-message-body min-w-0 flex max-w-[72%] flex-none flex-col",
            isUser ? "items-end" : "items-start",
          )}
        >
          {/* Header — name + timestamp for first in group */}
          {!isGrouped && (!isUser || hiddenFromAIHeader) && (
            <div
              className={cn(
                "mari-message-meta mb-0.5 flex items-baseline gap-2",
                isUser ? "justify-end pr-2 text-right" : "pl-2",
              )}
            >
              {hiddenFromAIHeader}
              {!isUser && (
                <span
                  className="mari-message-name text-[0.9375rem] font-semibold leading-tight hover:underline cursor-default"
                  style={nameColorStyle(nameColor)}
                >
                  {displayName}
                </span>
              )}
              {!hideTimestamp && !isUser && (
                <span className="mari-message-timestamp text-[0.6875rem] text-[var(--muted-foreground)]/60">
                  {formatTimestamp(message.createdAt)}
                </span>
              )}
            </div>
          )}

          {/* Bubble */}
          {isHiddenCollapsed ? (
            <HiddenFromAIConversationSummary onExpand={onExpandHidden} />
          ) : editing ? (
            <ConversationMessageEditForm
              editRef={editRef}
              editValue={editValue}
              onValueChange={onEditValueChange}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              messageTextStyle={messageTextStyle}
              quoteFormat={quoteFormat}
            />
          ) : (
            <div
              className={cn(
                "mari-message-content text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap",
                "mari-message-bubble texting-bubble relative px-3.5 py-2 shadow-sm",
                isUser ? "texting-bubble-user" : "texting-bubble-other",
                bubbleCornerClass,
                isStreaming && !renderedContent && "py-2.5",
              )}
              style={messageTextStyle}
            >
              {isStreaming && !renderedContent ? (
                /* Typing dots + optional stable preview */
                <div className={cn("space-y-2", streamingBubbleDraftContent && "animate-[fadeSlideIn_0.25s_ease-out]")}>
                  {streamingBubbleDraftContent && (
                    <MessageContent
                      content={streamingBubbleDraftContent}
                      mentionNames={mentionNames}
                      emojiMap={emojiMap}
                      stickerMap={stickerMap}
                      onImageOpen={(url) => onImageOpen(url)}
                    />
                  )}
                  <div className="flex items-center gap-1" aria-label="Still typing">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:300ms]" />
                  </div>
                </div>
              ) : groupedSegments && !isUser ? (
                /* Multi-speaker content inside a bubble */
                <div className="space-y-2">
                  {groupedSegments.slice(0, visibleSegments).map((grp, i) => {
                    const segChar =
                      grp.speaker && charByName ? charByName.get(normalizeTextForMatch(grp.speaker)) : null;
                    const segName = segChar?.name ?? grp.speaker ?? "";
                    const segColor = segChar?.nameColor;
                    const combinedText = grp.lines.join("\n");
                    if (!grp.speaker) {
                      return (
                        <div key={i} className="italic text-[var(--muted-foreground)]">
                          <MessageContent
                            content={combinedText}
                            mentionNames={mentionNames}
                            emojiMap={emojiMap}
                            stickerMap={stickerMap}
                            onImageOpen={(url) => onImageOpen(url)}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="space-y-0.5">
                        <div
                          className="text-[0.75rem] font-semibold leading-tight opacity-90"
                          style={nameColorStyle(segColor)}
                        >
                          {segName}
                        </div>
                        <MessageContent
                          content={combinedText}
                          mentionNames={mentionNames}
                          emojiMap={emojiMap}
                          stickerMap={stickerMap}
                          onImageOpen={(url) => onImageOpen(url)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <MessageContent
                  content={renderedContent}
                  mentionNames={mentionNames}
                  emojiMap={emojiMap}
                  stickerMap={stickerMap}
                  onImageOpen={(url) => onImageOpen(url)}
                />
              )}
            </div>
          )}

          {!isHiddenCollapsed && (
            <>
              <ConversationMessageTranslation translatedText={translatedText} isTranslating={isTranslating} />
              <ConversationMessageAttachments
                attachments={extra.attachments ?? []}
                renderedContent={renderedContent}
                onImageOpen={onImageOpen}
                onRemove={onRemoveAttachment}
              />
            </>
          )}
        </div>
      </div>

      {/* Swipe controls — separate row so avatar never drifts */}
      {!hideActions && (hasSwipes || (canRegenerate && onRegenerate)) && (
        <div className={cn("mt-1", isUser ? "flex justify-end" : "pl-12")}>
          <ConversationMessageSwipes
            messageId={message.id}
            activeSwipeIndex={message.activeSwipeIndex}
            swipeCount={swipeCount}
            onSetActiveSwipe={(idx) => onSetActiveSwipe?.(message.id, idx)}
            onCreateNextSwipe={canRegenerate && onRegenerate ? () => onRegenerate(message.id) : undefined}
          />
        </div>
      )}
    </>
  );
}
