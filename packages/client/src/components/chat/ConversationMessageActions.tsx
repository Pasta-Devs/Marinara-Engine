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
  Volume2,
  VolumeX,
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
import { MESSAGE_ACTION_BUTTON_CLASS, MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";
import { ReactionAddButton } from "./ReactionAddButton";
import { MessageMarksAction, OvMessageMarksPanel } from "./MessageMarks";
import { OvMarksMenuContext } from "../overhaul/marks-menu-context";
import { Spinner } from "../ui/Spinner";
import { useFollowBubble } from "../../lib/follow-bubble";
import { useMessageButtons, type MessageButtonId } from "../overhaul/message-buttons";

// Where the Convo bottom bar sits, one fixed spot per theme (never moving from message to message):
// - themes that draw a bubble around the text (narrower than the row): just beneath the bubble;
// - everything else (cards, rows): inside the box, on its bottom line, with room kept at the end of the
//   last line of text (--ov-cvb-room) so text never runs under the icons.
function drawsBox(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const bg = cs.backgroundColor;
  return (
    parseFloat(cs.borderBottomWidth) > 0 ||
    (bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) ||
    cs.backgroundImage !== "none"
  );
}

function placeBottomBar(bar: HTMLElement, bubble: HTMLElement): number | null {
  const row = bar.closest<HTMLElement>("[data-message-id]");
  if (!row) return null;
  let box: HTMLElement = row;
  for (let el: HTMLElement | null = bubble; el && el !== row; el = el.parentElement) {
    if (drawsBox(el)) {
      box = el;
      break;
    }
  }
  const b = box.getBoundingClientRect();
  if (box === bubble && b.width < row.getBoundingClientRect().width - 24) {
    row.dataset.ovCvb = "below";
    row.style.removeProperty("--ov-cvb-room");
    return b.bottom + 1;
  }
  const content = bubble.querySelector<HTMLElement>(".mari-message-content");
  const room = content
    ? Math.max(0, Math.round(content.getBoundingClientRect().right - bar.getBoundingClientRect().left + 6))
    : 0;
  row.dataset.ovCvb = "inside";
  row.style.setProperty("--ov-cvb-room", `${room}px`);
  const inner = b.bottom - (parseFloat(getComputedStyle(box).borderBottomWidth) || 0);
  return inner - bar.offsetHeight - 2;
}

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
  /** Speak or stop this message aloud; omit to hide the button (text to speech is off). */
  speech?: { speaking: boolean; loading: boolean; disabled: boolean; hasContent: boolean; onToggle: () => void };
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
  speech,
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
  // Both pills line up with the message's own box (a bubble in bubble themes), not the full row.
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const findMessageBox = (bar: HTMLElement) =>
    bar.closest("[data-message-id]")?.querySelector<HTMLElement>(".mari-message-body") ?? null;
  const followTrigger = `${visible}-${mobileSheetOpen}-${thinkingOnly}`;
  useFollowBubble(barRef, findMessageBox, overhaulActive || overhaulMobile, followTrigger);
  // Like Roleplay's: the bottom bar's last button sits under the top bar's ⋯.
  useFollowBubble(
    bottomBarRef,
    findMessageBox,
    overhaulActive || overhaulMobile,
    followTrigger,
    (bar) => bar.closest("[data-message-id]")?.querySelector<HTMLElement>(".ov-cvh > button:last-of-type") ?? null,
    placeBottomBar,
  );
  // Speak sits left of Regenerate on desktop and above Translate in the phone and tablet sheet.
  const speakAction = speech ? (
    <MsgAction
      icon={
        speech.loading ? (
          <Spinner size="md" />
        ) : speech.speaking ? (
          <VolumeX size={MESSAGE_ACTION_ICON_SIZE} />
        ) : (
          <Volume2 size={MESSAGE_ACTION_ICON_SIZE} />
        )
      }
      onClick={speech.onToggle}
      disabled={speech.disabled}
      title={
        !speech.hasContent
          ? localizeUi("ui.chat.chatmessage.noDialogueToSpeak")
          : speech.loading
            ? localizeUi("ui.panels.ttsconfigcard.loading")
            : speech.speaking
              ? localizeUi("ui.chat.chatmessage.stopSpeaking")
              : localizeUi("ui.chat.chatmessage.speak")
      }
    />
  ) : null;
  // Settings > Chatting > Message buttons: the picked buttons sit on the message, the rest wait in More.
  const shownButtons = useMessageButtons("conversation");
  const show = (id: MessageButtonId) => shownButtons.includes(id);
  const translateAction = (
    <MsgAction
      icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
      onClick={onTranslate}
      title={
        translatedText ? localizeUi("ui.chat.chatmessage.hideTranslation") : localizeUi("ui.chat.chatmessage.translate")
      }
    />
  );
  const regenerateAction =
    canRegenerate && onRegenerate ? (
      <MsgAction
        icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onRegenerate}
        title={regenerateButtonTitle}
        className={regenerateGuidedClass}
      />
    ) : null;
  // UI overhaul (Convo A): a small Discord-style bar over the message's top-right corner (reactions, Reply and the
  // other picked tools, then More), and one under its bottom-right for what asks the AI (Speak, Translate,
  // Regenerate). Every action is also in More.
  const ovBars = () => {
    const bottomSpeak = show("speak") ? speakAction : null;
    const bottomRegenerate = show("regenerate") ? regenerateAction : null;
    const hasBottom = !!bottomSpeak || show("translate") || !!bottomRegenerate;
    // ⋯ lists only what is not already a button on the bars; with nothing left, it goes too.
    const menuEmpty =
      show("reply") &&
      (show("react") || !onPickReaction) &&
      (show("regenerate") || !regenerateAction) &&
      (show("speak") || !speakAction) &&
      ["copy", "marks", "translate", "edit"].every((id) => show(id as MessageButtonId)) &&
      (show("hide") || !onToggleHiddenFromAI) &&
      !(isLastAssistantMessage && !isUser && onPeekPrompt) &&
      (show("branch") || !onBranch) &&
      !generationReplay &&
      (show("thinking") || !hasReasoning || isUser) &&
      (show("delete") || !onDelete);
    return (
      <>
        <div
          ref={barRef}
          className={cn("ov-cvh", (visible || moreAnchor) && "is-on")}
          data-component="ConversationMessage.Actions"
          data-mari-part="actions"
        >
          {onPickReaction && show("react") ? (
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
          {onPickReaction && show("react") && <ReactionAddButton onPick={onPickReaction} />}
          {show("reply") ? <ReplyToMessageButton message={message} name={name} /> : null}
          {show("edit") ? (
            <MsgAction
              icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onEdit}
              title={localizeUi("ui.noodle.noodlepostcard.edit")}
            />
          ) : null}
          {show("copy") ? (
            <MsgAction
              icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onCopy}
              title={localizeUi("lorebook.editor.batch.copy")}
            />
          ) : null}
          {show("branch") && onBranch ? (
            <MsgAction
              icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onBranch}
              title={localizeUi("ui.chat.chatmessage.branchFromHere")}
            />
          ) : null}
          {show("marks") ? (
            <OvMarksMenuContext.Provider
              value={() => {
                const rect = barRef.current?.getBoundingClientRect();
                if (!rect) return;
                setMarksOpen(true);
                setMoreAnchor({ left: rect.right - 240, top: rect.top, bottom: rect.bottom, right: rect.right });
              }}
            >
              <MessageMarksAction
                message={message}
                align="right"
                stopPropagation
                className={MESSAGE_ACTION_BUTTON_CLASS}
              />
            </OvMarksMenuContext.Provider>
          ) : null}
          {show("hide") && onToggleHiddenFromAI ? (
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
          ) : null}
          {show("delete") && onDelete ? (
            <MsgAction
              icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onDelete}
              title={localizeUi("lorebook.editor.batch.delete")}
            />
          ) : null}
          {menuEmpty ? null : (
            <MsgAction
              icon={<MoreHorizontal size={MESSAGE_ACTION_ICON_SIZE} />}
              title={localizeUi("connections.accounts.header.more")}
              onClick={() => {
                setMarksOpen(false);
                if (moreAnchor) return setMoreAnchor(null);
                const rect = barRef.current?.getBoundingClientRect();
                if (rect)
                  setMoreAnchor({ left: rect.right - 240, top: rect.top, bottom: rect.bottom, right: rect.right });
              }}
            />
          )}
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
                {/* Left off the bars in Settings: still one click away here. */}
                {!show("reply") ? <ReplyToMessageButton message={message} name={name} /> : null}
                {!show("react") && onPickReaction ? (
                  <span data-ovm-keep-open="true">
                    <ReactionAddButton onPick={onPickReaction} />
                  </span>
                ) : null}
                {!show("regenerate") ? regenerateAction : null}
                {!show("speak") ? speakAction : null}
                {!show("copy") ? (
                  <MsgAction
                    icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
                    onClick={onCopy}
                    title={localizeUi("lorebook.editor.batch.copy")}
                  />
                ) : null}
                {!show("marks") ? (
                  <OvMarksMenuContext.Provider value={() => setMarksOpen(true)}>
                    <MessageMarksAction message={message} align="right" stopPropagation />
                  </OvMarksMenuContext.Provider>
                ) : null}
                {!show("translate") ? translateAction : null}
                {!show("edit") ? (
                  <MsgAction
                    icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
                    onClick={onEdit}
                    title={localizeUi("ui.noodle.noodlepostcard.edit")}
                  />
                ) : null}
                {onToggleHiddenFromAI && !show("hide") && (
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
                {onBranch && !show("branch") && (
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
                {hasReasoning && !isUser && !show("thinking") && (
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
                {onDelete && !show("delete") && (
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
        {hasBottom ? (
          <div ref={bottomBarRef} className={cn("ov-cvb", (visible || moreAnchor) && "is-on")} data-mari-part="actions">
            {bottomSpeak}
            {show("translate") ? translateAction : null}
            {bottomRegenerate}
          </div>
        ) : null}
      </>
    );
  };
  // Mobile overhaul: holding the message opens a sheet with every action.
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
            {speakAction}
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
  if (overhaulActive && !thinkingOnly) return ovBars();
  // A reply still arriving in the new layout: its reasoning toggle sits by the name and time instead.
  if ((overhaulActive || overhaulMobile) && thinkingOnly) return null;
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
      data-mari-part="actions"
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
      {speakAction}
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
