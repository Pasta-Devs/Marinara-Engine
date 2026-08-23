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
import type { MessageExtra } from "@marinara-engine/shared";
import type { RefObject } from "react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { MsgAction } from "./ConversationMessageShared";
import { MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";
import { ReactionAddButton } from "./ReactionAddButton";

export interface ConversationMessageActionsProps {
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
  const tabIdx = visible ? undefined : -1;
  return (
    <div
      className={cn(
        "mari-message-actions flex w-fit items-center gap-0.5 px-1 transition-all",
        visible
          ? "visible pointer-events-auto opacity-100"
          : "invisible pointer-events-none opacity-0 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 focus-within:visible focus-within:pointer-events-auto focus-within:opacity-100",
        thinkingOnly && "max-sm:[&>*:not(.mari-message-thinking-action)]:hidden",
      )}
      data-component="ConversationMessage.Actions"
      aria-hidden={!visible}
    >
      <MsgAction
        icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onCopy}
        title={localizeUi("lorebook.editor.batch.copy")}
        tabIndex={tabIdx}
      />
      {onPickReaction && <ReactionAddButton onPick={onPickReaction} tabIndex={tabIdx} />}
      <MsgAction
        icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onTranslate}
        title={
          translatedText
            ? localizeUi("ui.chat.chatmessage.hideTranslation")
            : localizeUi("ui.chat.chatmessage.translate")
        }
        tabIndex={tabIdx}
      />
      <MsgAction
        icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={onEdit}
        title={localizeUi("ui.noodle.noodlepostcard.edit")}
        tabIndex={tabIdx}
      />
      {canRegenerate && onRegenerate && (
        <MsgAction
          icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onRegenerate}
          title={regenerateButtonTitle}
          className={regenerateGuidedClass}
          tabIndex={tabIdx}
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
          tabIndex={tabIdx}
        />
      )}
      {isLastAssistantMessage && !isUser && onPeekPrompt && (
        <MsgAction
          icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onPeekPrompt}
          title={localizeUi("ui.chat.chatmessage.peekPrompt")}
          tabIndex={tabIdx}
        />
      )}
      {onBranch && (
        <MsgAction
          icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onBranch}
          title={localizeUi("ui.chat.chatmessage.branchFromHere")}
          tabIndex={tabIdx}
        />
      )}
      {generationReplay && (
        <MsgAction
          icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onShowGenerationReplay}
          title={localizeUi("ui.chat.chatmessage.storedGuidance")}
          tabIndex={tabIdx}
        />
      )}
      {hasReasoning && !isUser && (
        <MsgAction
          icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onShowThinking}
          title={t(
            reasoningSummaryUnavailable ? "chat.message.thoughts.unavailable.view" : "chat.message.thoughts.view",
          )}
          tabIndex={tabIdx}
          className="mari-message-thinking-action"
          buttonRef={thinkingButtonRef}
        />
      )}
      {onDelete && (
        <MsgAction
          icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
          onClick={onDelete}
          title={localizeUi("lorebook.editor.batch.delete")}
          tabIndex={tabIdx}
        />
      )}
    </div>
  );
}
