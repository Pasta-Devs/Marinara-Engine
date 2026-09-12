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
  ScrollText,
  Search,
  Trash2,
} from "lucide-react";
import { ReplyToMessageButton } from "./MessageReplyPreview";
import type { Message, MessageExtra } from "@marinara-engine/shared";
import type { RefObject } from "react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { MsgAction } from "./ConversationMessageShared";
import { MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";
import { ReactionAddButton } from "./ReactionAddButton";

export interface ConversationMessageActionsProps {
  message: Pick<Message, "id" | "chatId" | "content">;
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
}: ConversationMessageActionsProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const visible = showActions || forceShowActions;
  return (
    <div
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
