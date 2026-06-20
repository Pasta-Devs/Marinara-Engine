// ──────────────────────────────────────────────
// Chat: Gallery Drawer — per-chat image gallery
// ──────────────────────────────────────────────
import { Image, X } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { ChatGallery } from "./ChatGallery";
import {
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import type { Chat } from "@marinara-engine/shared";

interface ChatGalleryDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  anchor?: { right: number; top: number } | null;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
}

export function ChatGalleryDrawer({ chat, open, onClose, anchor, onIllustrate }: ChatGalleryDrawerProps) {
  if (!open) return null;
  const panelStyle: CSSProperties | undefined = anchor
    ? { right: `${anchor.right}px`, top: `${anchor.top}px` }
    : undefined;

  return (
    <>
      <div className="fixed inset-0 z-[65] bg-transparent" onClick={onClose} />

      {/* Floating panel */}
      <div
        className={cn(
          ROLEPLAY_POPOVER_SHELL,
          "fixed bottom-3 z-[70] flex w-[min(44rem,calc(100vw-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-3 top-14",
        )}
        style={panelStyle}
      >
        {/* Header */}
        <div className={cn(ROLEPLAY_POPOVER_HEADER, "flex items-center justify-between")}>
          <h3 className={ROLEPLAY_POPOVER_TITLE}>
            <Image size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            Gallery
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            <X size="1rem" />
          </button>
        </div>

        <div className={cn(ROLEPLAY_POPOVER_SCROLL_AREA, "flex-1 overflow-y-auto")}>
          <ChatGallery chatId={chat.id} mode={chat.mode} onIllustrate={onIllustrate} />
        </div>
      </div>
    </>
  );
}
