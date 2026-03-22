// ──────────────────────────────────────────────
// Chat: Manage Chat Files — switch between branches
// Like SillyTavern's "Manage chat files" feature
// ──────────────────────────────────────────────
import { X, Plus, Trash2, FileText, MessageSquare } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChatGroup, useCreateChat, useDeleteChat, useDeleteChatGroup, useExportChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import type { Chat } from "@marinara-engine/shared";

interface ChatFilesDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
}

export function ChatFilesDrawer({ chat, open, onClose }: ChatFilesDrawerProps) {
  const groupId = (chat as any).groupId as string | null;
  const { data: groupChats } = useChatGroup(groupId);
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const deleteChatGroup = useDeleteChatGroup();
  const exportChat = useExportChat();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const activeChatId = useChatStore((s) => s.activeChatId);

  const chatFiles = (groupChats ?? []) as Chat[];

  const handleNewBranch = () => {
    if (!groupId) return;
    const charIds = typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : (chat.characterIds ?? []);
    createChat.mutate(
      {
        name: chat.name,
        mode: chat.mode,
        characterIds: charIds,
        groupId,
      },
      {
        onSuccess: (newChat) => {
          setActiveChatId(newChat.id);
        },
      },
    );
  };

  const handleSwitch = (chatId: string) => {
    setActiveChatId(chatId);
    onClose();
  };

  const handleDelete = (chatId: string) => {
    if (!confirm("Delete this chat file? Messages will be lost.")) return;
    deleteChat.mutate(chatId);
    if (chatId === activeChatId && chatFiles.length > 1) {
      const next = chatFiles.find((c) => c.id !== chatId);
      if (next) setActiveChatId(next.id);
    }
  };

  if (!open) return null;

  // If the chat has no groupId, show a simple message
  if (!groupId) {
    return (
      <>
        <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
        <div className="absolute right-0 top-0 z-50 flex h-full w-80 max-md:w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-bold">Manage Chat Files</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
            >
              <X size="1rem" />
            </button>
          </div>
          <div className="border-b border-[var(--border)] px-4 py-3">
            <button
              onClick={() => exportChat.mutate(chat.id)}
              disabled={exportChat.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98] disabled:opacity-50"
            >
              <svg
                width="0.8125rem"
                height="0.8125rem"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 13V3m0 0l-4 4m4-4l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
              </svg>
              Export Chat
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <FileText size="2rem" className="text-[var(--muted-foreground)]/40" />
            <p className="text-xs text-[var(--muted-foreground)]">
              This chat isn't part of a group and doesn't have any branches yet. Chats imported from SillyTavern for the
              same character are automatically grouped together into branches.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 z-50 flex h-full w-80 max-md:w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-bold">Manage Chat Files</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <X size="1rem" />
          </button>
        </div>

        {/* New branch button */}
        <div className="border-b border-[var(--border)] px-4 py-3">
          <button
            onClick={handleNewBranch}
            disabled={createChat.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-sky-400/15 transition-all hover:shadow-lg hover:shadow-sky-400/25 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size="0.8125rem" />
            Start New Chat
          </button>
          <button
            onClick={() => exportChat.mutate(activeChatId ?? chat.id)}
            disabled={exportChat.isPending}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98] disabled:opacity-50"
          >
            <svg
              width="0.8125rem"
              height="0.8125rem"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 13V3m0 0l-4 4m4-4l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
            </svg>
            Export Chat
          </button>
          <p className="mt-2 text-center text-[0.625rem] text-[var(--muted-foreground)]/60">
            {chatFiles.length} chat file{chatFiles.length !== 1 ? "s" : ""} in this group
          </p>
        </div>

        {/* Chat files list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-col gap-1">
            {chatFiles.map((cf) => {
              const isActive = cf.id === activeChatId;
              const date = new Date(cf.updatedAt);
              const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={cf.id}
                  onClick={() => handleSwitch(cf.id)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all",
                    isActive ? "bg-sky-400/10 ring-1 ring-sky-400/30" : "hover:bg-[var(--accent)]",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                      isActive
                        ? "bg-gradient-to-br from-sky-400 to-blue-500 text-white"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                    )}
                  >
                    <MessageSquare size="0.875rem" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{cf.name}</div>
                    <div className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {dateStr} at {timeStr}
                    </div>
                  </div>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-sky-400/15 px-2 py-0.5 text-[0.5625rem] font-medium text-sky-400">
                      Active
                    </span>
                  )}
                  {!isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(cf.id);
                      }}
                      className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover:opacity-100"
                    >
                      <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete all branches */}
        <div className="border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={() => {
              if (!confirm(`Delete all ${chatFiles.length} branches? This cannot be undone.`)) return;
              deleteChatGroup.mutate(groupId);
              setActiveChatId(null);
              onClose();
            }}
            disabled={deleteChatGroup.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20 transition-all hover:bg-[var(--destructive)]/20 active:scale-[0.98] disabled:opacity-50"
          >
            <Trash2 size="0.8125rem" />
            Delete All Branches
          </button>
        </div>
      </div>
    </>
  );
}
