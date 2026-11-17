// #5073: Context Viewer for Professor Mari. Shows everything attached to her workspace
// chat (chat-history slices) with a per-item and total token estimate, and lets the user remove items
// to free up context.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { useMariWorkspaceContext, useRemoveMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { Spinner } from "../ui/Spinner";
import { Modal } from "../ui/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceChatId: string;
}

export function MariContextViewer({ open, onClose, workspaceChatId }: Props) {
  const { t: localizeUi } = useTranslation();
  const { data: items, isLoading } = useMariWorkspaceContext(open ? workspaceChatId : null);
  const removeContext = useRemoveMariWorkspaceContext(workspaceChatId);

  const totalTokens = useMemo(() => (items ?? []).reduce((sum, item) => sum + (item.tokenEstimate || 0), 0), [items]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.chat.homeprofessormarichat.contextViewerTitle")}
      width="max-w-lg"
      layer="omnibar"
      backdrop="dark"
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
          <Spinner size="md" />
          {localizeUi("navigation.common.loading")}
        </div>
      ) : (items ?? []).length === 0 ? (
        <p className="px-2 py-8 text-center text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.homeprofessormarichat.contextViewerEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(items ?? []).map((item) => (
            <div
              key={item.id}
              className="group relative flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            >
              <FileText size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--foreground)]">{item.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.homeprofessormarichat.attachChatHistoryTokenEstimate", {
                    count: item.tokenEstimate,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await removeContext.mutateAsync({ id: item.id, chatId: item.chatId });
                  } catch {
                    toast.error(localizeUi("ui.chat.homeprofessormarichat.contextViewerRemoveFailed"));
                  }
                }}
                disabled={removeContext.isPending}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 active:scale-90"
                aria-label={localizeUi("ui.chat.homeprofessormarichat.contextViewerRemove")}
                title={localizeUi("ui.chat.homeprofessormarichat.contextViewerRemove")}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
          ))}
          <p className="px-1 pt-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.homeprofessormarichat.contextViewerTotal", { count: totalTokens })}
          </p>
        </div>
      )}
    </Modal>
  );
}
