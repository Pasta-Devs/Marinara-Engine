import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, Download, FileText, GitBranch, Loader2, MessageSquare, Pencil, Trash2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  chatKeys,
  useChatGroup,
  useDeleteChat,
  useDeleteChatGroup,
  useExportChat,
  useUpdateChatMetadata,
} from "../../hooks/use-chats";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { CHAT_FLOATING_UI_DISMISS_EVENT, isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import { getChatDisplayName } from "../../lib/chat-display";
import { compareChatsByActivityDesc } from "../../lib/chat-recency";
import { api } from "../../lib/api-client";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import {
  CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR,
  announceChatToolbarAction,
  getChatToolbarButtonClass,
} from "./ChatToolbarControls";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

type BranchRow = {
  id: string;
  name: string;
  createdAt?: string | null;
  updatedAt: string;
  lastMessageAt?: string | null;
};

interface ChatBranchSelectorProps {
  activeChatId: string | null;
  activeChatName?: string | null;
  groupId?: string | null;
  variant?: "conversation" | "roleplay";
  compact?: boolean;
  className?: string;
  onOpen?: () => void;
}

export function ChatBranchSelector({
  activeChatId,
  activeChatName,
  groupId,
  compact = false,
  className,
  onOpen,
}: ChatBranchSelectorProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: groupChats, isLoading } = useChatGroup(groupId ?? null);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const exportChat = useExportChat();
  const deleteChat = useDeleteChat();
  const deleteChatGroup = useDeleteChatGroup();
  const updateMetadata = useUpdateChatMetadata();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  });

  const branches = useMemo(() => {
    const rows = [...(groupChats ?? [])];
    rows.sort((left, right) => {
      if (left.id === activeChatId) return -1;
      if (right.id === activeChatId) return 1;
      return compareChatsByActivityDesc(left, right);
    });
    return rows;
  }, [activeChatId, groupChats]);

  const displayBranches = useMemo<BranchRow[]>(() => {
    if (branches.length > 0) return branches;
    if (!activeChatId) return [];
    return [
      {
        id: activeChatId,
        name: activeChatName || localizeUi("chat.branches.current"),
        updatedAt: new Date().toISOString(),
      },
    ];
  }, [activeChatId, activeChatName, branches, localizeUi]);

  const branchCount = isLoading ? branches.length : displayBranches.length;

  const handleImportChat = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeChatId) return;
    event.target.value = "";

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("chatId", activeChatId);
      formData.append("file", file);
      const data = await api.upload<{
        success?: boolean;
        error?: string;
        messagesImported?: number;
        groupId?: string;
        chatId?: string;
      }>("/import/st-chat-into-group", formData);
      if (data.success === false || data.error) {
        toast.error(
          data.error
            ? localizeUi("chat.branches.importFailedWithReason", { reason: data.error })
            : localizeUi("chat.branches.importFailed"),
        );
        return;
      }
      toast.success(
        localizeUi("chat.branches.importedMessages", {
          count: data.messagesImported ?? 0,
        }),
      );
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      await qc.invalidateQueries({ queryKey: chatKeys.detail(activeChatId) });
      const newGroupId = data.groupId ?? groupId;
      if (newGroupId) {
        await qc.invalidateQueries({ queryKey: chatKeys.group(newGroupId) });
      }
      if (data.chatId) setActiveChatId(data.chatId);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("chat.branches.importFailedWithReason", { reason: err.message })
          : localizeUi("chat.branches.importFailed"),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleRenameBranch = async (branch: BranchRow) => {
    const nextName = await showPromptDialog({
      title: localizeUi("ui.chat.chatbranchselector.renameBranch"),
      message: localizeUi("ui.chat.chatbranchselector.setADisplayNameForThisChatBranch"),
      defaultValue: getChatDisplayName(branch),
      placeholder: localizeUi("chat.branches.namePlaceholder"),
      confirmLabel: localizeUi("ui.chat.chatbranchselector.rename"),
    });
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === getChatDisplayName(branch)) return;
    await updateMetadata.mutateAsync({ id: branch.id, branchName: trimmed });
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.chat.chatbranchselector.deleteBranch"),
        message: localizeUi("ui.chat.chatbranchselector.deleteThisBranchMessagesWillBeLost"),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    const deletingActiveBranch = branchId === activeChatId;
    const nextActiveChatId = deletingActiveBranch
      ? (displayBranches.find((branch) => branch.id !== branchId)?.id ?? null)
      : null;
    try {
      await deleteChat.mutateAsync({ id: branchId, groupId: groupId ?? null, force: true });
      if (deletingActiveBranch) setActiveChatId(nextActiveChatId);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("chat.branches.deleteFailedWithReason", { reason: err.message })
          : localizeUi("chat.branches.deleteFailed"),
      );
    }
  };

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!open || !button) return;
    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const isMobile = window.innerWidth < 768;
    const overflowMenu = button.closest<HTMLElement>(CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR);
    const menuRect = overflowMenu?.getBoundingClientRect();
    const rightEdge = isMobile && menuRect ? menuRect.left - viewportPadding : rect.right;
    const width = isMobile
      ? Math.min(360, window.innerWidth - viewportPadding * 2, Math.max(160, rightEdge - viewportPadding))
      : Math.max(rect.width, 360);
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    setPosition({
      top: isMobile && menuRect ? menuRect.top : rect.bottom + (isMobile ? 0 : 8),
      left: Math.max(viewportPadding, Math.min(rightEdge - width, maxLeft)),
      width,
    });
  }, [displayBranches.length, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (isDesktopShellNavigationTarget(event.target)) return;
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleResize = () => setOpen(false);

    const handleScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleDismiss = () => setOpen(false);
    window.addEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
    return () => window.removeEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
  }, [open]);

  if (!activeChatId) return null;

  const branchButtonSizeClassName = "relative h-8 w-8";
  const badgeClassName = "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-muted)]";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-chat-help="branches"
        onClick={(event) => {
          announceChatToolbarAction();
          if (compact) event.stopPropagation();
          const nextOpen = !open;
          if (nextOpen) onOpen?.();
          setOpen(nextOpen);
        }}
        aria-label={
          isLoading
            ? localizeUi("ui.chat.chatbranchselector.switchBranch")
            : localizeUi("chat.branches.switchCount", { count: branchCount })
        }
        className={getChatToolbarButtonClass({
          className,
          compact: true,
          open,
          sizeClassName: branchButtonSizeClassName,
        })}
        title={localizeUi("ui.chat.chatbranchselector.switchBranch")}
      >
        <GitBranch size="0.8125rem" className="shrink-0" />
        <span
          className={cn(
            "absolute -right-1 -top-1 flex min-w-4 justify-center rounded-[0.25rem] px-1 text-[0.5625rem] font-semibold leading-4",
            badgeClassName,
          )}
        >
          {isLoading ? <Loader2 size="0.5625rem" className="mt-0.5 animate-spin" /> : branchCount}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            data-chat-branch-popover
            className={cn(NEUTRAL_PANEL_SHELL, "fixed z-[9999] overflow-hidden")}
            style={{
              top: position.top,
              left: `max(calc(var(--mari-chat-ui-inset-left, 0px) + 0.75rem), min(${position.left}px, calc(100vw - var(--mari-chat-ui-inset-right, 0px) - ${position.width}px - 0.75rem)))`,
              width: position.width,
            }}
          >
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={NEUTRAL_PANEL_TITLE}>
                    <GitBranch size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                    {localizeUi("ui.chat.chatbranchselector.chatBranches")}
                  </div>
                  <div className={NEUTRAL_PANEL_SUBTITLE}>
                    {localizeUi("ui.chat.chatbranchselector.switchImportExportOrCleanUpThisChatS")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={localizeUi("ui.chat.chatbranchselector.closeChatBranches")}
                  className={NEUTRAL_PANEL_CLOSE_BUTTON}
                >
                  <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
                </button>
              </div>
            </div>

            <div className="border-b border-[var(--border)] p-2">
              <input ref={importInputRef} type="file" accept=".jsonl" onChange={handleImportChat} className="hidden" />
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => exportChat.mutate({ chatId: activeChatId, format: "jsonl" })}
                  disabled={exportChat.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Upload size="0.75rem" />
                  {localizeUi("ui.chat.chatbranchselector.jsonl")}
                </button>
                <button
                  type="button"
                  onClick={() => exportChat.mutate({ chatId: activeChatId, format: "text" })}
                  disabled={exportChat.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <FileText size="0.75rem" />
                  {localizeUi("ui.chat.chatbranchselector.text")}
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Download size="0.75rem" />
                  {isImporting ? "..." : localizeUi("ui.chat.chatbranchselector.import")}
                </button>
              </div>
            </div>

            <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "max-h-[min(22rem,calc(100vh-12rem))] overflow-y-auto p-2")}>
              {displayBranches.map((branch) => {
                const isActive = branch.id === activeChatId;
                const updatedAt = new Date(branch.updatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={branch.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      isActive ? "bg-[var(--accent)]/70 text-[var(--foreground)]" : "hover:bg-[var(--accent)]/45",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(branch.id);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                          isActive
                            ? "bg-[var(--foreground)]/15 text-[var(--foreground)]"
                            : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                        )}
                      >
                        {isActive ? <Check size="0.875rem" /> : <MessageSquare size="0.875rem" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{getChatDisplayName(branch)}</div>
                        <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                          {localizeUi("chat.branches.updatedAt", { date: updatedAt })}
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleRenameBranch(branch)}
                        className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title={localizeUi("ui.chat.chatbranchselector.renameBranch_09bac0c")}
                        aria-label={localizeUi("chat.branches.renameLabel", {
                          name: getChatDisplayName(branch),
                        })}
                      >
                        <Pencil size="0.75rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBranch(branch.id)}
                        disabled={deleteChat.isPending}
                        className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                        title={localizeUi("ui.chat.chatbranchselector.deleteBranch_5478e60")}
                        aria-label={localizeUi("chat.branches.deleteLabel", {
                          name: getChatDisplayName(branch),
                        })}
                      >
                        <Trash2 size="0.75rem" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {groupId && displayBranches.length > 1 && (
              <div className="border-t border-[var(--border)] p-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !(await showConfirmDialog({
                        title: localizeUi("ui.chat.chatbranchselector.deleteAllBranches"),
                        message: localizeUi("chat.branches.deleteAllConfirmation", {
                          count: displayBranches.length,
                        }),
                        confirmLabel: localizeUi("ui.characters.spritestab.deleteAll"),
                        tone: "destructive",
                      }))
                    ) {
                      return;
                    }
                    deleteChatGroup.mutate({ groupId, force: true });
                    setActiveChatId(null);
                    setOpen(false);
                  }}
                  disabled={deleteChatGroup.isPending}
                  className="mari-chrome-control mari-chrome-control--primary w-full px-3 py-2 text-[0.6875rem] disabled:opacity-50"
                >
                  <Trash2 size="0.75rem" />
                  {localizeUi("ui.chat.chatbranchselector.deleteAllBranches")}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
