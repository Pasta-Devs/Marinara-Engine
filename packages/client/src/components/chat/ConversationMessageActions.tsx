// ──────────────────────────────────────────────
// Message action row — follows the message content
// ──────────────────────────────────────────────
import {
  Brain,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  Languages,
  Pencil,
  RefreshCw,
  MoreHorizontal,
  ScrollText,
  Search,
  Trash2,
} from "lucide-react";
import { useOverhaulActive, useOverhaulTouchMessages } from "../../stores/overhaul.store";
import { OvMobileMessageSheet } from "../overhaul/MobileMessageSheet";
import { FooterPopover, closeAfterAction } from "../overhaul/RpMessageFooter";
import { ReplyToMessageButton } from "./MessageReplyPreview";
import type { Message, MessageExtra } from "@marinara-engine/shared";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { MsgAction } from "./ConversationMessageShared";
import { MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";
import { ReactionAddButton } from "./ReactionAddButton";
import { MessageMarksAction, OvMessageMarksPanel } from "./MessageMarks";
import { OvMarksMenuContext } from "../overhaul/marks-menu-context";

export interface ConversationMessageActionsProps {
  message: Pick<Message, "id" | "chatId" | "content"> & { extra?: unknown };
  name: string;
  isUser: boolean;
  // Visibility
  showActions: boolean;
  forceShowActions?: boolean;
  thinkingOnly?: boolean;
  // State
  copied: boolean;
  translatedText?: string | null;
  isHiddenFromAI: boolean;
  canRegenerate: boolean;
  isLastAssistantMessage?: boolean;
  hasReasoning: boolean;
  reasoningSummaryUnavailable: boolean;
  thinkingButtonRef: RefObject<HTMLButtonElement | null>;
  generationReplay: MessageExtra["generationReplay"] | null;
  isGuided: boolean;
  regenerateButtonTitle: string;
  regenerateGuidedClass?: string;
  // Handlers
  onCopy: () => void;
  onTranslate: () => void;
  onEdit: () => void;
  onRegenerate?: () => void;
  onBranch?: () => void;
  onToggleHiddenFromAI?: () => void;
  onPeekPrompt?: () => void;
  onDelete?: () => void;
  onShowGenerationReplay: () => void;
  onShowThinking: () => void;
  /** Toggle the user's reaction with the picked emoji; omit to hide the add-reaction button. */
  onPickReaction?: (emoji: string, imageUrl: string | null) => void;
  /** Phones and tablets with the overhaul: the long-press sheet is open (the row is never shown inline). */
  mobileSheetOpen?: boolean;
  /** Mobile overhaul sheet: switch to a swipe by index. */
  onSetSwipe?: (index: number) => void;
  swipeIndex?: number;
  swipeCount?: number;
  onCloseMobileSheet?: () => void;
}

export function ConversationMessageActions({
  message,
  name,
  isUser,
  showActions,
  forceShowActions,
  thinkingOnly,
  copied,
  translatedText,
  isHiddenFromAI,
  canRegenerate,
  isLastAssistantMessage,
  hasReasoning,
  reasoningSummaryUnavailable,
  thinkingButtonRef,
  generationReplay,
  regenerateButtonTitle,
  regenerateGuidedClass,
  onCopy,
  onTranslate,
  onEdit,
  onRegenerate,
  onBranch,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onDelete,
  onShowGenerationReplay,
  onShowThinking,
  onPickReaction,
  mobileSheetOpen,
  onSetSwipe,
  swipeIndex = 0,
  swipeCount = 1,
  onCloseMobileSheet,
}: ConversationMessageActionsProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);
  // Keep the bar shown while focus moves from its message into it. WebKit blurs the message first and
  // then rechecks the target, which :focus-within alone has already hidden, so the click or Tab is lost.
  const [messageFocused, setMessageFocused] = useState(false);
  useEffect(() => {
    const row = barRef.current?.closest<HTMLElement>(".group");
    if (!row) return;
    const sync = (event: FocusEvent) =>
      setMessageFocused(
        event.type === "focusin" || (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)),
      );
    // WebKit and Firefox send no focusout when the focused element is removed (closing an edit), so focus
    // arriving anywhere outside the message also clears it.
    const leave = (event: FocusEvent) => {
      if (!(event.target instanceof Node) || !row.contains(event.target)) setMessageFocused(false);
    };
    row.addEventListener("focusin", sync);
    row.addEventListener("focusout", sync);
    document.addEventListener("focusin", leave);
    return () => {
      row.removeEventListener("focusin", sync);
      row.removeEventListener("focusout", sync);
      document.removeEventListener("focusin", leave);
    };
  }, []);
  // Re-check after each render, which follows an edit closing, in case focus vanished without an event.
  // It runs every render on purpose and can only turn the state off, so it cannot loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (messageFocused && !barRef.current?.closest(".group")?.matches(":focus-within")) setMessageFocused(false);
  });
  const visible = showActions || forceShowActions || messageFocused;
  const overhaulActive = useOverhaulActive();
  const overhaulMobile = useOverhaulTouchMessages();
  const [marksOpen, setMarksOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<null | { left: number; top: number; bottom: number; right: number }>(
    null,
  );
  // Mobile overhaul: nothing inline; holding the message opens a sheet with every action.
  if (overhaulMobile && !thinkingOnly) {
    if (!mobileSheetOpen || !onCloseMobileSheet) return null;
    return (
      <OvMobileMessageSheet
        chatId={message.chatId}
        messageId={message.id}
        swipeIndex={swipeIndex}
        swipeCount={swipeCount}
        onSetSwipe={isUser ? undefined : onSetSwipe}
        onCreateSwipe={!isUser && canRegenerate ? onRegenerate : undefined}
        copied={copied}
        onCopy={onCopy}
        onEdit={onEdit}
        onRegenerate={canRegenerate ? onRegenerate : undefined}
        onBranch={onBranch}
        onClose={onCloseMobileSheet}
        top={
          onPickReaction ? (
            <div className="ovm-sheet__reactions">
              {["🔥", "😂", "❤️", "👀", "😭"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={localizeUi("ui.chat.conversationmessageactions.reactWithValue1", { value1: emoji })}
                  onClick={() => onPickReaction(emoji, null)}
                >
                  {emoji}
                </button>
              ))}
              <span data-ovm-keep-open="true">
                <ReactionAddButton onPick={onPickReaction} />
              </span>
            </div>
          ) : undefined
        }
        more={
          <div className="mari-message-actions">
            <ReplyToMessageButton message={message} name={name} />
            <MessageMarksAction message={message} align="right" stopPropagation />
            <MsgAction
              icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onTranslate}
              title={
                translatedText
                  ? localizeUi("ui.chat.chatmessage.hideTranslation")
                  : localizeUi("ui.chat.chatmessage.translate")
              }
            />
            {onToggleHiddenFromAI && (
              <MsgAction
                icon={
                  isHiddenFromAI ? <Eye size={MESSAGE_ACTION_ICON_SIZE} /> : <EyeOff size={MESSAGE_ACTION_ICON_SIZE} />
                }
                onClick={onToggleHiddenFromAI}
                title={
                  isHiddenFromAI
                    ? localizeUi("ui.chat.conversationmessageactions.unhideFromAi")
                    : localizeUi("ui.chat.conversationmessageactions.hideFromAi")
                }
              />
            )}
            {isLastAssistantMessage && !isUser && onPeekPrompt && (
              <MsgAction
                icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onPeekPrompt}
                title={localizeUi("ui.chat.chatmessage.peekPrompt")}
              />
            )}
            {generationReplay && (
              <MsgAction
                icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onShowGenerationReplay}
                title={localizeUi("ui.chat.chatmessage.storedGuidance")}
              />
            )}
            {hasReasoning && !isUser && (
              <MsgAction
                icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onShowThinking}
                title={t(
                  reasoningSummaryUnavailable ? "chat.message.thoughts.unavailable.view" : "chat.message.thoughts.view",
                )}
                buttonRef={thinkingButtonRef}
              />
            )}
            {onDelete && (
              <MsgAction
                icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onDelete}
                title={localizeUi("lorebook.editor.batch.delete")}
              />
            )}
          </div>
        }
      />
    );
  }
  // UI overhaul (Convo A): a small Discord-style bar over the message's top-right corner with quick reactions,
  // React, Reply, Regenerate and More. Every other action lives in the More menu.
  if (overhaulActive && !thinkingOnly) {
    const regenerate = canRegenerate && onRegenerate;
    return (
      <div
        ref={barRef}
        className={cn("ov-cvh", (visible || moreAnchor) && "is-on")}
        data-component="ConversationMessage.Actions"
      >
        {onPickReaction ? (
          <span className="ov-cvh__quick">
            {["🔥", "😂", "❤️"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={localizeUi("ui.chat.conversationmessageactions.reactWithValue1", { value1: emoji })}
                onClick={(event) => {
                  event.stopPropagation();
                  onPickReaction(emoji, null);
                }}
              >
                {emoji}
              </button>
            ))}
          </span>
        ) : null}
        {onPickReaction && <ReactionAddButton onPick={onPickReaction} />}
        <ReplyToMessageButton message={message} name={name} />
        {regenerate ? (
          <MsgAction
            icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
            onClick={onRegenerate}
            title={regenerateButtonTitle}
            className={regenerateGuidedClass}
          />
        ) : null}
        <MsgAction
          icon={<MoreHorizontal size={MESSAGE_ACTION_ICON_SIZE} />}
          title={localizeUi("connections.accounts.header.more")}
          onClick={() => {
            setMarksOpen(false);
            if (moreAnchor) return setMoreAnchor(null);
            const rect = barRef.current?.getBoundingClientRect();
            if (rect) setMoreAnchor({ left: rect.right - 240, top: rect.top, bottom: rect.bottom, right: rect.right });
          }}
        />
        {moreAnchor && marksOpen ? (
          <FooterPopover
            anchor={moreAnchor}
            onClose={() => {
              setMarksOpen(false);
              setMoreAnchor(null);
            }}
            className="ov-rpf-menu ov-marks-pop"
          >
            <OvMessageMarksPanel
              message={message}
              onBack={() => setMarksOpen(false)}
              onDone={() => {
                setMarksOpen(false);
                setMoreAnchor(null);
              }}
            />
          </FooterPopover>
        ) : moreAnchor ? (
          <FooterPopover anchor={moreAnchor} onClose={() => setMoreAnchor(null)} className="ov-rpf-menu">
            <p className="ov-rpf-pop__label">{localizeUi("ui.chat.conversationmessageactions.messageActions")}</p>
            <div className="mari-message-actions" onClickCapture={closeAfterAction(() => setMoreAnchor(null))}>
              <MsgAction
                icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onCopy}
                title={localizeUi("lorebook.editor.batch.copy")}
              />
              <OvMarksMenuContext.Provider value={() => setMarksOpen(true)}>
                <MessageMarksAction message={message} align="right" stopPropagation />
              </OvMarksMenuContext.Provider>
              <MsgAction
                icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onTranslate}
                title={
                  translatedText
                    ? localizeUi("ui.chat.chatmessage.hideTranslation")
                    : localizeUi("ui.chat.chatmessage.translate")
                }
              />
              <MsgAction
                icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onEdit}
                title={localizeUi("ui.noodle.noodlepostcard.edit")}
              />
              {onToggleHiddenFromAI && (
                <MsgAction
                  icon={
                    isHiddenFromAI ? (
                      <Eye size={MESSAGE_ACTION_ICON_SIZE} />
                    ) : (
                      <EyeOff size={MESSAGE_ACTION_ICON_SIZE} />
                    )
                  }
                  onClick={onToggleHiddenFromAI}
                  title={
                    isHiddenFromAI
                      ? localizeUi("ui.chat.conversationmessageactions.unhideFromAi")
                      : localizeUi("ui.chat.conversationmessageactions.hideFromAi")
                  }
                />
              )}
              {isLastAssistantMessage && !isUser && onPeekPrompt && (
                <MsgAction
                  icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={onPeekPrompt}
                  title={localizeUi("ui.chat.chatmessage.peekPrompt")}
                />
              )}
              {onBranch && (
                <MsgAction
                  icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={onBranch}
                  title={localizeUi("ui.chat.chatmessage.branchFromHere")}
                />
              )}
              {generationReplay && (
                <MsgAction
                  icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={onShowGenerationReplay}
                  title={localizeUi("ui.chat.chatmessage.storedGuidance")}
                />
              )}
              {hasReasoning && !isUser && (
                <MsgAction
                  icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={onShowThinking}
                  title={t(
                    reasoningSummaryUnavailable
                      ? "chat.message.thoughts.unavailable.view"
                      : "chat.message.thoughts.view",
                  )}
                  buttonRef={thinkingButtonRef}
                />
              )}
              {onDelete && (
                <MsgAction
                  icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={onDelete}
                  title={localizeUi("lorebook.editor.batch.delete")}
                />
              )}
            </div>
          </FooterPopover>
        ) : null}
      </div>
    );
  }
  return (
    <div
      ref={barRef}
      className={cn(
        "mari-message-actions flex w-full min-w-0 flex-wrap items-center justify-between gap-1 px-1 transition-all md:justify-start md:gap-x-2",
        visible
          ? "visible pointer-events-auto opacity-100"
          : "invisible pointer-events-none opacity-0 max-md:hidden max-md:group-hover:flex max-md:group-focus-within:flex group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        thinkingOnly && "max-sm:[&>*:not(.mari-message-thinking-action)]:hidden",
      )}
      data-component="ConversationMessage.Actions"
    >
      <MsgAction
        icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onCopy}
        title={localizeUi("lorebook.editor.batch.copy")}
      />
      {!thinkingOnly && <ReplyToMessageButton message={message} name={name} />}
      {onPickReaction && <ReactionAddButton onPick={onPickReaction} />}
      {!thinkingOnly && <MessageMarksAction message={message} align={isUser ? "right" : "left"} stopPropagation />}
      <MsgAction
        icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onTranslate}
        title={
          translatedText
            ? localizeUi("ui.chat.chatmessage.hideTranslation")
            : localizeUi("ui.chat.chatmessage.translate")
        }
      />
      <MsgAction
        icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onEdit}
        title={localizeUi("ui.noodle.noodlepostcard.edit")}
      />
      {canRegenerate && onRegenerate && (
        <MsgAction
          icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onRegenerate}
          title={regenerateButtonTitle}
          className={regenerateGuidedClass}
        />
      )}
      {onToggleHiddenFromAI && (
        <MsgAction
          icon={isHiddenFromAI ? <Eye size={MESSAGE_ACTION_ICON_SIZE} /> : <EyeOff size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onToggleHiddenFromAI}
          title={
            isHiddenFromAI
              ? localizeUi("ui.chat.conversationmessageactions.unhideFromAi")
              : localizeUi("ui.chat.conversationmessageactions.hideFromAi")
          }
          className={
            isHiddenFromAI
              ? "text-[var(--marinara-chat-chrome-button-text-active)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
              : undefined
          }
        />
      )}
      {isLastAssistantMessage && !isUser && onPeekPrompt && (
        <MsgAction
          icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onPeekPrompt}
          title={localizeUi("ui.chat.chatmessage.peekPrompt")}
        />
      )}
      {onBranch && (
        <MsgAction
          icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onBranch}
          title={localizeUi("ui.chat.chatmessage.branchFromHere")}
        />
      )}
      {generationReplay && (
        <MsgAction
          icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onShowGenerationReplay}
          title={localizeUi("ui.chat.chatmessage.storedGuidance")}
        />
      )}
      {hasReasoning && !isUser && (
        <MsgAction
          icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onShowThinking}
          title={t(
            reasoningSummaryUnavailable ? "chat.message.thoughts.unavailable.view" : "chat.message.thoughts.view",
          )}
          className="mari-message-thinking-action"
          buttonRef={thinkingButtonRef}
        />
      )}
      {onDelete && (
        <MsgAction
          icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onDelete}
          title={localizeUi("lorebook.editor.batch.delete")}
        />
      )}
    </div>
  );
}
