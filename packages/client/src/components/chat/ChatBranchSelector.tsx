import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FileText,
  GitBranch,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
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
import { getChatDisplayName } from "../../lib/chat-display";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";
import {
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_SUBTITLE,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";

type BranchRow = {
  id: string;
  name: string;
  updatedAt: string;
};

interface ChatBranchSelectorProps {
  activeChatId: string | null;
  activeChatName?: string | null;
  groupId?: string | null;
  variant?: "conversation" | "roleplay";
  compact?: boolean;
  className?: string;
}

export function ChatBranchSelector({
  activeChatId,
  activeChatName,
  groupId,
  variant = "conversation",
  compact = false,
  className,
}: ChatBranchSelectorProps) {
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
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
    return rows;
  }, [activeChatId, groupChats]);

  const displayBranches = useMemo<BranchRow[]>(() => {
    if (branches.length > 0) return branches;
    if (!activeChatId) return [];
    return [
      {
        id: activeChatId,
        name: activeChatName || "Current branch",
        updatedAt: new Date().toISOString(),
      },
    ];
  }, [activeChatId, activeChatName, branches]);

  const currentBranch = branches.find((chat) => chat.id === activeChatId);
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
      const res = await fetch("/api/import/st-chat-into-group", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false || data?.error) {
        toast.error(`Import failed: ${data?.error ?? res.statusText ?? "Unknown error"}`);
        return;
      }
      toast.success(`Imported ${data.messagesImported ?? 0} messages as a new branch`);
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      await qc.invalidateQueries({ queryKey: chatKeys.detail(activeChatId) });
      const newGroupId = data.groupId ?? groupId;
      if (newGroupId) {
        await qc.invalidateQueries({ queryKey: chatKeys.group(newGroupId) });
      }
      if (data.chatId) setActiveChatId(data.chatId);
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleRenameBranch = async (branch: BranchRow) => {
    const nextName = await showPromptDialog({
      title: "Rename Branch",
      message: "Set a display name for this chat branch.",
      defaultValue: getChatDisplayName(branch),
      placeholder: "Branch name",
      confirmLabel: "Rename",
    });
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === getChatDisplayName(branch)) return;
    await updateMetadata.mutateAsync({ id: branch.id, branchName: trimmed });
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (
      !(await showConfirmDialog({
        title: "Delete Branch",
        message: "Delete this branch? Messages will be lost.",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    const nextActiveChatId =
      branchId === activeChatId ? displayBranches.find((branch) => branch.id !== branchId)?.id : null;
    try {
      await deleteChat.mutateAsync({ id: branchId, groupId: groupId ?? null });
      if (nextActiveChatId) setActiveChatId(nextActiveChatId);
    } catch (err) {
      toast.error(err instanceof Error ? `Delete failed: ${err.message}` : "Delete failed.");
    }
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const isMobile = window.innerWidth < 768;
    const width = isMobile
      ? Math.min(360, window.innerWidth - viewportPadding * 2)
      : Math.max(rect.width, 360);
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    setPosition({
      top: rect.bottom + (isMobile ? 0 : 8),
      left: Math.max(viewportPadding, Math.min(rect.right - width, maxLeft)),
      width,
    });
  }, [displayBranches.length, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
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

  if (!activeChatId) return null;
  if (variant !== "roleplay" && (!groupId || (!isLoading && branches.length <= 1))) return null;

  const branchLabel = currentBranch?.name ?? activeChatName ?? "Current branch";
  const roleplayMinimal = variant === "roleplay" && !compact;
  const branchButtonSizeClassName = compact
    ? "relative h-8 w-8"
    : roleplayMinimal
      ? "h-8 min-w-14"
      : "max-w-[min(15rem,calc(100vw-9rem))]";
  const branchButtonContentClassName = compact
    ? undefined
    : roleplayMinimal
      ? "justify-start gap-1.5 px-2 py-1 text-left"
      : "justify-start gap-2 px-2.5 py-1.5 text-left";
  const badgeClassName = "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-muted)]";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          if (compact) event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label={isLoading ? "Switch branch" : `Switch branch (${branchCount} branches)`}
        className={getChatToolbarButtonClass({
          className: cn(branchButtonContentClassName, className),
          compact,
          open,
          sizeClassName: branchButtonSizeClassName,
        })}
        title="Switch branch"
      >
        <GitBranch size="0.8125rem" className="shrink-0" />
        {compact ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex min-w-4 justify-center rounded-full px-1 text-[0.5625rem] font-semibold leading-4",
              badgeClassName,
            )}
          >
            {isLoading ? <Loader2 size="0.5625rem" className="mt-0.5 animate-spin" /> : branchCount}
          </span>
        ) : roleplayMinimal ? (
          <>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums",
                badgeClassName,
              )}
            >
              {isLoading ? <Loader2 size="0.6875rem" className="animate-spin" /> : branchCount}
            </span>
            <ChevronDown size="0.75rem" className={cn("shrink-0 transition-transform", open && "rotate-180")} />
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium">{branchLabel}</span>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium", badgeClassName)}>
              {isLoading ? <Loader2 size="0.6875rem" className="animate-spin" /> : branchCount}
            </span>
            <ChevronDown size="0.75rem" className={cn("shrink-0 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            data-chat-branch-popover
            className={cn(ROLEPLAY_POPOVER_SHELL, "fixed z-[9999] overflow-hidden")}
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className={ROLEPLAY_POPOVER_TITLE}>
                <GitBranch size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                Chat Branches
              </div>
              <div className={ROLEPLAY_POPOVER_SUBTITLE}>Switch, import, export, or clean up this chat's branches.</div>
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
                  JSONL
                </button>
                <button
                  type="button"
                  onClick={() => exportChat.mutate({ chatId: activeChatId, format: "text" })}
                  disabled={exportChat.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <FileText size="0.75rem" />
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Download size="0.75rem" />
                  {isImporting ? "..." : "Import"}
                </button>
              </div>
            </div>

            <div
              className={cn(ROLEPLAY_POPOVER_SCROLL_AREA, "max-h-[min(22rem,calc(100vh-12rem))] overflow-y-auto p-2")}
            >
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
                        <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Updated {updatedAt}</div>
                      </div>
                    </button>

                    {isActive && (
                      <span className="shrink-0 rounded-full bg-[var(--foreground)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--foreground)]/75">
                        Active
                      </span>
                    )}
                    {!isActive && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleRenameBranch(branch)}
                          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          title="Rename branch"
                        >
                          <Pencil size="0.75rem" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBranch(branch.id)}
                          disabled={deleteChat.isPending}
                          className="rounded-lg p-1.5 text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15 disabled:opacity-50"
                          title="Delete branch"
                        >
                          <Trash2 size="0.75rem" />
                        </button>
                      </div>
                    )}
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
                        title: "Delete All Branches",
                        message: `Delete all ${displayBranches.length} branches? This cannot be undone.`,
                        confirmLabel: "Delete All",
                        tone: "destructive",
                      }))
                    ) {
                      return;
                    }
                    deleteChatGroup.mutate(groupId);
                    setActiveChatId(null);
                    setOpen(false);
                  }}
                  disabled={deleteChatGroup.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] font-medium text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20 transition-colors hover:bg-[var(--destructive)]/20 disabled:opacity-50"
                >
                  <Trash2 size="0.75rem" />
                  Delete All Branches
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
