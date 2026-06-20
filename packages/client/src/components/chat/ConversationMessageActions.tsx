// ──────────────────────────────────────────────
// Hover action bar — floats above the message row
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
import { cn } from "../../lib/utils";
import { MsgAction } from "./ConversationMessageShared";
import { ReactionAddButton } from "./ReactionAddButton";

export interface ConversationMessageActionsProps {
  // Positioning
  isBubbleStyle: boolean;
  isUser: boolean;
  // Visibility
  showActions: boolean;
  forceShowActions?: boolean;
  // State
  copied: boolean;
  translatedText?: string | null;
  isHiddenFromAI: boolean;
  canRegenerate: boolean;
  isLastAssistantMessage?: boolean;
  thinking?: string | null;
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
  isBubbleStyle,
  isUser,
  showActions,
  forceShowActions,
  copied,
  translatedText,
  isHiddenFromAI,
  canRegenerate,
  isLastAssistantMessage,
  thinking,
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
  const visible = showActions || forceShowActions;
  const tabIdx = visible ? undefined : -1;
  return (
    <div
      className={cn(
        "mari-message-actions absolute -top-3 flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--card)]/90 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-all dark:border-white/20 dark:bg-black/40",
        visible
          ? "visible pointer-events-auto opacity-100"
          : "invisible pointer-events-none opacity-0 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 focus-within:visible focus-within:pointer-events-auto focus-within:opacity-100",
        isBubbleStyle && !isUser ? "left-12" : "right-4",
      )}
      aria-hidden={!visible}
    >
      <MsgAction icon={copied ? "✓" : <Copy size="0.75rem" />} onClick={onCopy} title="Copy" tabIndex={tabIdx} />
      {onPickReaction && <ReactionAddButton onPick={onPickReaction} tabIndex={tabIdx} />}
      <MsgAction
        icon={<Languages size="0.75rem" />}
        onClick={onTranslate}
        title={translatedText ? "Hide translation" : "Translate"}
        tabIndex={tabIdx}
      />
      <MsgAction icon={<Pencil size="0.75rem" />} onClick={onEdit} title="Edit" tabIndex={tabIdx} />
      {canRegenerate && onRegenerate && (
        <MsgAction
          icon={<RefreshCw size="0.75rem" />}
          onClick={onRegenerate}
          title={regenerateButtonTitle}
          className={regenerateGuidedClass}
          tabIndex={tabIdx}
        />
      )}
      {onToggleHiddenFromAI && (
        <MsgAction
          icon={isHiddenFromAI ? <Eye size="0.75rem" /> : <EyeOff size="0.75rem" />}
          onClick={onToggleHiddenFromAI}
          title={isHiddenFromAI ? "Unhide from AI" : "Hide from AI"}
          className={
            isHiddenFromAI
              ? "text-[var(--marinara-chat-chrome-button-text-active)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
              : undefined
          }
          tabIndex={tabIdx}
        />
      )}
      {isLastAssistantMessage && !isUser && onPeekPrompt && (
        <MsgAction icon={<Search size="0.75rem" />} onClick={onPeekPrompt} title="Peek prompt" tabIndex={tabIdx} />
      )}
      {onBranch && (
        <MsgAction icon={<GitBranch size="0.75rem" />} onClick={onBranch} title="Branch from here" tabIndex={tabIdx} />
      )}
      {generationReplay && (
        <MsgAction
          icon={<ScrollText size="0.75rem" />}
          onClick={onShowGenerationReplay}
          title="Stored guidance"
          tabIndex={tabIdx}
        />
      )}
      {thinking && !isUser && (
        <MsgAction icon={<Brain size="0.75rem" />} onClick={onShowThinking} title="View thoughts" tabIndex={tabIdx} />
      )}
      {onDelete && (
        <MsgAction
          icon={<Trash2 size="0.75rem" />}
          onClick={onDelete}
          title="Delete"
          tabIndex={tabIdx}
        />
      )}
    </div>
  );
}
