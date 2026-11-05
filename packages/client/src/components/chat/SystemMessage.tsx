import type { CSSProperties, MouseEventHandler, ReactNode, RefObject } from "react";
import type { Message } from "@marinara-engine/shared";
import { Check, Copy, Eye, EyeOff, GitBranch, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { MessageActionButton, MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";
import { MessageMarkIndicators, MessageMarksAction } from "./MessageMarks";
import { MESSAGE_SELECTION_SURFACE_CLASS } from "./message-selection-styles";

export function SystemMessage({
  message,
  messageRef,
  children,
  editing,
  copied,
  showActions,
  multiSelectMode,
  isSelected,
  hiddenFromAI,
  fontSize,
  onClick,
  onCopy,
  onEdit,
  onBranch,
  onToggleHiddenFromAI,
  onDelete,
}: {
  message: Pick<Message, "id" | "chatId" | "content"> & { extra?: unknown };
  messageRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  editing: boolean;
  copied: boolean;
  showActions: boolean;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  hiddenFromAI: boolean;
  fontSize: CSSProperties["fontSize"];
  onClick: MouseEventHandler<HTMLDivElement>;
  onCopy: () => void;
  onEdit?: () => void;
  onBranch?: () => void;
  onToggleHiddenFromAI?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      ref={messageRef}
      tabIndex={0}
      data-message-id={message.id}
      data-message-role="system"
      className={cn(
        "mari-system-message group min-w-0 max-w-full px-4 py-2",
        multiSelectMode && isSelected && cn("rounded-lg", MESSAGE_SELECTION_SURFACE_CLASS),
      )}
      onClick={onClick}
    >
      <div
        className="mari-system-message-content min-w-0 max-w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-[var(--foreground)]"
        style={{ fontSize }}
      >
        <div className="mb-1 text-xs font-semibold text-[var(--muted-foreground)]">
          {t("ui.chat.messagemarks.system")}
        </div>
        {children}
        <MessageMarkIndicators message={message} className="mt-1" />
        {!multiSelectMode && !editing && (
          <div
            className={cn(
              "mt-1 flex min-w-0 flex-wrap items-center gap-1 transition-opacity",
              !showActions && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
            )}
          >
            <MessageActionButton
              icon={copied ? <Check size={MESSAGE_ACTION_ICON_SIZE} /> : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={onCopy}
              title={t("lorebook.editor.batch.copy")}
              stopPropagation
            />
            {onEdit && (
              <MessageActionButton
                icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onEdit}
                title={t("ui.noodle.noodlepostcard.edit")}
                stopPropagation
              />
            )}
            <MessageMarksAction message={message} stopPropagation />
            {onBranch && (
              <MessageActionButton
                icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onBranch}
                title={t("ui.chat.chatmessage.branchFromHere")}
                stopPropagation
              />
            )}
            {onToggleHiddenFromAI && (
              <MessageActionButton
                icon={
                  hiddenFromAI ? <Eye size={MESSAGE_ACTION_ICON_SIZE} /> : <EyeOff size={MESSAGE_ACTION_ICON_SIZE} />
                }
                onClick={onToggleHiddenFromAI}
                title={t(
                  hiddenFromAI
                    ? "ui.chat.conversationmessageactions.unhideFromAi"
                    : "ui.chat.conversationmessageactions.hideFromAi",
                )}
                stopPropagation
              />
            )}
            {onDelete && (
              <MessageActionButton
                icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={onDelete}
                title={t("lorebook.editor.batch.delete")}
                stopPropagation
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
