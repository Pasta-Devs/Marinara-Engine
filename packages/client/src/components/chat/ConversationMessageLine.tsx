// ──────────────────────────────────────────────
// Linear message layout (chat-style rows)
// ──────────────────────────────────────────────
import { User } from "lucide-react";
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

export function ConversationMessageLine({ ctx }: { ctx: MessageRenderContext }) {
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
    renderedContent,
    renderedContentParts,
    emojiMap,
    stickerMap,
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
    shouldHideUserAvatar,
  } = ctx;

  return (
    <>
      {/* Multi-select checkbox */}
      {multiSelectMode && (
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={isSelected ? "Deselect message" : "Select message"}
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
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
                <img src={avatarUrl} alt={displayName} loading="lazy" className="h-full w-full object-cover" style={avatarCropStyle} />
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

      {/* Body column */}
      <div className="mari-message-body min-w-0 flex-1">
        {/* Header */}
        {!isGrouped && (
          <div className="mari-message-meta mb-0.5 flex items-baseline gap-2">
            {hiddenFromAIHeader}
            <span className="mari-message-name text-[0.9375rem] font-semibold leading-tight hover:underline cursor-default" style={nameColorStyle(nameColor)}>
              {displayName}
            </span>
            {!hideTimestamp && (
              <span className="mari-message-timestamp text-[0.6875rem] text-[var(--muted-foreground)]/60">
                {formatTimestamp(message.createdAt)}
              </span>
            )}
          </div>
        )}

        {/* Body */}
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
              isStreaming && !renderedContent && "py-1",
            )}
            style={messageTextStyle}
          >
            {isStreaming && !renderedContent ? (
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:300ms]" />
              </div>
            ) : (
              <>
                {renderedContentParts ? (
                  <div className="space-y-1.5">
                    {renderedContentParts.map((part, i) => (
                      <div key={i} className="animate-[fadeSlideIn_0.4s_ease-out]">
                        <MessageContent content={part} mentionNames={mentionNames} emojiMap={emojiMap} stickerMap={stickerMap} onImageOpen={(url) => onImageOpen(url)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <MessageContent content={renderedContent} mentionNames={mentionNames} emojiMap={emojiMap} stickerMap={stickerMap} onImageOpen={(url) => onImageOpen(url)} />
                )}
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-[var(--foreground)]/50" />
                )}
              </>
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

            {!hideActions && (hasSwipes || (canRegenerate && onRegenerate)) && (
              <div className="mt-1.5">
                <ConversationMessageSwipes
                  messageId={message.id}
                  activeSwipeIndex={message.activeSwipeIndex}
                  swipeCount={swipeCount}
                  onSetActiveSwipe={(idx) => onSetActiveSwipe?.(message.id, idx)}
                  onCreateNextSwipe={
                    canRegenerate && onRegenerate ? () => onRegenerate(message.id) : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
