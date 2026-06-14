// ──────────────────────────────────────────────
// Chat: Gallery Drawer — per-chat image gallery
// ──────────────────────────────────────────────
import { X } from "lucide-react";
import { ChatGallery } from "./ChatGallery";
import type { Chat } from "@marinara-engine/shared";

interface ChatGalleryDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
}

export function ChatGalleryDrawer({ chat, open, onClose, onIllustrate }: ChatGalleryDrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Floating panel */}
      <div className="absolute bottom-3 right-3 top-14 z-50 flex w-[min(44rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl animate-fade-in-up max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-bold">Gallery</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <X size="1rem" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ChatGallery chatId={chat.id} onIllustrate={onIllustrate} />
        </div>
      </div>
    </>
  );
}
