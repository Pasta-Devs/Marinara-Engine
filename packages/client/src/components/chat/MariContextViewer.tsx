// #5073: Context Viewer for Professor Mari. Shows everything attached to the current Mari workspace
// chat (chat-history slices) with a per-item and total token estimate, and lets the user remove items
// to free up context. Self-contained modal (createPortal).
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, X } from "lucide-react";
import { useMariWorkspaceContext, useRemoveMariWorkspaceContext } from "../../hooks/use-mari-workspace-context";
import { useModalFocusTrap } from "../../hooks/use-modal-focus-trap";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceChatId: string;
}

export function MariContextViewer({ open, onClose, workspaceChatId }: Props) {
  const { t: localizeUi } = useTranslation();
  const { data: items, isLoading } = useMariWorkspaceContext(open ? workspaceChatId : null);
  const removeContext = useRemoveMariWorkspaceContext(workspaceChatId);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(open, onClose);

  const totalTokens = useMemo(() => (items ?? []).reduce((sum, item) => sum + (item.tokenEstimate || 0), 0), [items]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-label={localizeUi("ui.chat.homeprofessormarichat.contextViewerTitle")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)]">
            {localizeUi("ui.chat.homeprofessormarichat.contextViewerTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label={localizeUi("navigation.common.close")}
          >
            <X size="1rem" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
              <Loader2 size="1rem" className="animate-spin" />
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
