// ──────────────────────────────────────────────
// Grouped multi-speaker message layout (merged group chat / Name: text format)
// ──────────────────────────────────────────────
import { Fragment, type RefObject } from "react";
import { normalizeTextForMatch } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import {
  HiddenFromAIConversationSummary,
  MessageContent,
  ConversationMessageAttachments,
  ConversationMessageTranslation,
  ConversationMessageSwipes,
  IMAGE_URL_RE,
  nameColorStyle,
  formatTimestamp,
  type MessageRenderContext,
} from "./ConversationMessageShared";
import { ConversationMessageActions } from "./ConversationMessageActions";
import { MessageReactions } from "./MessageReactions";
import { ReactionAddButton } from "./ReactionAddButton";

export function ConversationMessageGrouped({
  ctx,
  msgRef,
}: {
  ctx: MessageRenderContext;
  msgRef: RefObject<HTMLDivElement | null>;
}) {
  const {
    message,
    extra,
    isGrouped,
    noHoverGroup,
    isStreaming,
    multiSelectMode,
    isSelected,
    isHiddenCollapsed,
    hiddenFromAIHeader,
    onExpandHidden,
    groupedSegments,
    visibleSegments,
    charByName,
    mentionNames,
    emojiMap,
    stickerMap,
    messageTextStyle,
    showActions,
    forceShowActions,
    hideActions,
    hideTimestamp,
    showMessageNumbers,
    messageIndex,
    hasSwipes,
    swipeCount,
    onSetActiveSwipe,
    renderedContent,
    onImageOpen,
    onRemoveAttachment,
    handleMobileTap,
    copied,
    translatedText,
    isTranslating,
    isHiddenFromAI,
    canRegenerate,
    isLastAssistantMessage,
    thinking,
    generationReplay,
    isGuided,
    regenerateButtonTitle,
    regenerateGuidedClass,
    onCopy,
    onTranslate,
    onStartEdit,
    onRegenerate,
    onToggleHiddenFromAI,
    onPeekPrompt,
    onDelete,
    onShowGenerationReplay,
    onShowThinking,
    onPickReaction,
    segmentReactions,
    resolveReactorName,
    onPickSegmentReaction,
    onToggleReactionEntry,
    onToggleSelect,
    isBubbleStyle,
  } = ctx;

  // Per-segment add-reaction affordance: follows the hover-toolbar visibility
  // discipline (hidden until the block is hovered / tapped on mobile).
  const segActionsVisible = showActions || forceShowActions;
  const segAddTabIdx = segActionsVisible ? undefined : -1;
  const segAddButtonClass = cn(
    "shrink-0 self-center -my-0.5 transition-opacity",
    segActionsVisible
      ? "opacity-100"
      : "pointer-events-none opacity-0 focus:pointer-events-auto focus:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
  );

  // Card CSS (character bubble themes) is scoped to [data-card-css] subtrees. The
  // root deliberately does NOT carry the attribute: each segment's themable
  // content gets its own [data-card-css] wrapper below, so the per-segment
  // reaction chip rows can render as siblings OUTSIDE card-CSS reach — the same
  // invariant the shell keeps for the whole-message reaction row.
  const cardCssProps = {
    "data-card-css": message.characterId ?? undefined,
    "data-grouped": isGrouped || undefined,
  };
  const hasTranslationContent = Boolean(translatedText || isTranslating);
  const hasAttachmentContent = (extra.attachments?.length ?? 0) > 0 && !IMAGE_URL_RE.test(renderedContent.trim());
  const hasSwipeContent = !hideActions && (hasSwipes || Boolean(canRegenerate && onRegenerate));
  const hasTrailingContent =
    isStreaming || (!isHiddenCollapsed && (hasTranslationContent || hasAttachmentContent || hasSwipeContent));

  return (
    <div
      ref={msgRef}
      className={cn(
        "relative px-4 py-0.5 transition-colors hover:bg-[var(--secondary)]/30",
        isBubbleStyle && "hover:bg-transparent",
        !noHoverGroup && "group",
        isGrouped ? "mt-0" : "mt-3",
        isStreaming && "bg-[var(--secondary)]/20",
        multiSelectMode && isSelected && "bg-[var(--destructive)]/10",
      )}
      onClick={handleMobileTap}
    >
      {/* Multi-select checkbox */}
      {multiSelectMode && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={isSelected ? "Deselect message" : "Select message"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
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

      {hiddenFromAIHeader && !isHiddenCollapsed && (
        <div className="mb-1 flex items-center gap-1 pl-14 text-[0.6875rem] text-amber-500/80">
          {hiddenFromAIHeader}
          <span>Hidden from AI</span>
        </div>
      )}

      {isHiddenCollapsed ? (
        <div className="pl-14 py-1">
          <HiddenFromAIConversationSummary onExpand={onExpandHidden} />
        </div>
      ) : (
        (groupedSegments ?? []).slice(0, visibleSegments).map((grp, i) => {
          const segChar = grp.speaker && charByName ? charByName.get(normalizeTextForMatch(grp.speaker)) : null;
          const segAvatar = segChar?.avatarUrl ?? null;
          const segAvatarCropStyle = getAvatarCropStyle(segChar?.avatarCrop);
          const segName = segChar?.name ?? grp.speaker ?? "";
          const segColor = segChar?.nameColor;
          const isFirst = i === 0;
          const combinedText = grp.lines.join("\n");
          // Reactions aimed at this segment (issue #3210). The add affordance sits
          // in the speaker's name row; the chip row renders under the segment text,
          // outside the segment's [data-card-css] wrapper. The target key is the
          // parsed speaker (not the resolved character name) so it stays derivable
          // from content alone. Empty-text segments are not targetable — the
          // classic layout doesn't render them, so a reaction there would vanish
          // (splitReactionsBySegment applies the same rule).
          const segHasText = combinedText.trim().length > 0;
          const segReactions = segmentReactions?.[i] ?? [];
          const segAddButton =
            !hideActions && onPickSegmentReaction && grp.speaker && segHasText ? (
              <ReactionAddButton
                onPick={(emoji, imageUrl) => onPickSegmentReaction({ segment: i, speaker: grp.speaker }, emoji, imageUrl)}
                tabIndex={segAddTabIdx}
                className={segAddButtonClass}
              />
            ) : null;
          const segReactionRow =
            segReactions.length > 0 ? (
              <MessageReactions
                reactions={segReactions}
                resolveReactorName={resolveReactorName}
                onToggle={onToggleReactionEntry}
              />
            ) : null;

          if (!grp.speaker) {
            // Whitespace-only narration: render nothing — an empty
            // [data-card-css] wrapper would paint a phantom themed box, the
            // same invariant the speaker branches guard with segHasText.
            if (!segHasText) return null;
            return (
              <div
                key={i}
                {...cardCssProps}
                className="pl-14 py-0.5 text-[0.875rem] leading-relaxed break-words whitespace-pre-wrap text-[var(--muted-foreground)] italic animate-[fadeSlideIn_0.4s_ease-out]"
                style={messageTextStyle}
              >
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

          if (isBubbleStyle) {
            if (!segHasText) return null;
            return (
              <Fragment key={i}>
                <div
                  {...cardCssProps}
                  className={["animate-[fadeSlideIn_0.4s_ease-out]", i > 0 && "mt-2"].filter(Boolean).join(" ")}
                >
                <div className="flex items-end gap-2">
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--accent)]">
                    {segAvatar ? (
                      <img
                        src={segAvatar}
                        alt={segName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        style={segAvatarCropStyle}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted-foreground)]">
                        {segName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 max-w-[min(32rem,calc(100%-2.5rem))]">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="truncate text-[0.75rem] font-semibold" style={nameColorStyle(segColor)}>
                        {segName}
                      </span>
                      {isFirst && !hideTimestamp && (
                        <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]/60">
                          {formatTimestamp(message.createdAt)}
                        </span>
                      )}
                      {segAddButton}
                    </div>
                    <div
                      className="mari-message-bubble texting-bubble texting-bubble-other rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap shadow-sm"
                      style={messageTextStyle}
                    >
                      <MessageContent
                        content={combinedText}
                        mentionNames={mentionNames}
                        emojiMap={emojiMap}
                        stickerMap={stickerMap}
                        onImageOpen={(url) => onImageOpen(url)}
                      />
                    </div>
                  </div>
                  </div>
                </div>
                {segReactionRow && (
                  <div className="mari-message-reactions-row ml-10 mt-1 max-w-[min(32rem,calc(100%-2.5rem))]">
                    {segReactionRow}
                  </div>
                )}
              </Fragment>
            );
          }

          const paragraphs = combinedText
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean);
          // Whitespace-only segment: render nothing — an empty [data-card-css]
          // wrapper would let container-styling themes paint a phantom box.
          if (paragraphs.length === 0) return null;

          return (
            <Fragment key={i}>
              <div
                {...cardCssProps}
                className={["animate-[fadeSlideIn_0.4s_ease-out]", i > 0 && "mt-3"].filter(Boolean).join(" ")}
              >
                    <div className="flex gap-4">
                      <div className="w-10 flex-shrink-0">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[var(--accent)]">
                          {segAvatar ? (
                            <img
                              src={segAvatar}
                              alt={segName}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              style={segAvatarCropStyle}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--muted-foreground)]">
                              {segName[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        {isFirst && (showActions || forceShowActions || showMessageNumbers) && messageIndex != null && (
                          <span className="mt-0.5 block text-center text-[0.5rem] font-medium text-[var(--muted-foreground)] select-none">
                            #{messageIndex}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className="text-[0.9375rem] font-semibold leading-tight hover:underline cursor-default"
                            style={nameColorStyle(segColor)}
                          >
                            {segName}
                          </span>
                          {isFirst && !hideTimestamp && (
                            <span className="text-[0.6875rem] text-[var(--muted-foreground)]/60">
                              {formatTimestamp(message.createdAt)}
                            </span>
                          )}
                          {segAddButton}
                        </div>
                        <div
                          className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap"
                          style={messageTextStyle}
                        >
                          <MessageContent
                            content={paragraphs[0]!}
                            mentionNames={mentionNames}
                            emojiMap={emojiMap}
                            stickerMap={stickerMap}
                            onImageOpen={(url) => onImageOpen(url)}
                          />
                        </div>
                      </div>
                    </div>
                    {paragraphs.slice(1).map((para, pi) => (
                      <div
                        key={pi}
                        className="pl-14 mt-0.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap"
                        style={messageTextStyle}
                      >
                        <MessageContent
                          content={para}
                          mentionNames={mentionNames}
                          emojiMap={emojiMap}
                          stickerMap={stickerMap}
                          onImageOpen={(url) => onImageOpen(url)}
                        />
                      </div>
                    ))}
              </div>
              {segReactionRow && <div className="mari-message-reactions-row pl-14 mt-1">{segReactionRow}</div>}
            </Fragment>
          );
        })
      )}

      {/* Trailing content (cursor, translation, attachments, swipes): kept in a
          [data-card-css] wrapper so themes retain the reach they had when the
          attribute lived on the block root — but only rendered when it has
          content, so container-styling themes can't paint an empty box. The
          hover action bar stays OUTSIDE the wrapper: it's chrome (like the chip
          rows), and its absolute positioning must keep resolving against the
          relative block root even if a theme makes the wrapper positioned. */}
      {hasTrailingContent && (
        <div {...cardCssProps}>
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="ml-14 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-[var(--foreground)]/50" />
          )}

          {!isHiddenCollapsed && (
            <div className="ml-14">
              <ConversationMessageTranslation translatedText={translatedText} isTranslating={isTranslating} />
            </div>
          )}

          {!isHiddenCollapsed && (
            <>
              {/* Image attachments */}
              <div className="ml-14">
                <ConversationMessageAttachments
                  attachments={extra.attachments ?? []}
                  renderedContent={renderedContent}
                  onImageOpen={onImageOpen}
                  onRemove={onRemoveAttachment}
                />
              </div>

              {!hideActions && (hasSwipes || (canRegenerate && onRegenerate)) && (
                <div className="ml-14 mt-1.5">
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
          )}
        </div>
      )}

      {/* Action bar */}
      {!hideActions && (
        <ConversationMessageActions
          isBubbleStyle={isBubbleStyle}
          isUser={false}
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
          onCopy={onCopy}
          onTranslate={onTranslate}
          onEdit={onStartEdit}
          onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
          onToggleHiddenFromAI={
            onToggleHiddenFromAI ? () => onToggleHiddenFromAI(message.id, isHiddenFromAI) : undefined
          }
          onPeekPrompt={onPeekPrompt}
          onDelete={onDelete ? () => onDelete(message.id) : undefined}
          onShowGenerationReplay={onShowGenerationReplay}
          onShowThinking={onShowThinking}
          onPickReaction={onPickReaction}
        />
      )}
    </div>
  );
}
