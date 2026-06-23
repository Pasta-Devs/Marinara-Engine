// ──────────────────────────────────────────────
// Chat: Gallery Drawer — per-chat image gallery
// ──────────────────────────────────────────────
import { Image, X } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { ChatGallery } from "./ChatGallery";
import {
  ROLEPLAY_POPOVER_CLOSE_BUTTON,
  ROLEPLAY_POPOVER_CLOSE_ICON_SIZE,
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
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-chat-floating-panel]")) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onClose, open]);

  if (!open) return null;
  const panelStyle: CSSProperties | undefined = anchor
    ? { right: `${anchor.right}px`, top: `${anchor.top}px` }
    : undefined;

  return (
    <>
      {/* Floating panel */}
      <div
        ref={panelRef}
        data-chat-floating-panel
        className={cn(
          ROLEPLAY_POPOVER_SHELL,
          "mari-chat-gallery-drawer fixed bottom-3 z-[70] flex w-[min(44rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
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
            className={ROLEPLAY_POPOVER_CLOSE_BUTTON}
          >
            <X size={ROLEPLAY_POPOVER_CLOSE_ICON_SIZE} />
          </button>
        </div>

        <div className={cn(ROLEPLAY_POPOVER_SCROLL_AREA, "flex-1 overflow-y-auto")}>
          <ChatGallery chatId={chat.id} mode={chat.mode} onIllustrate={onIllustrate} />
        </div>
      </div>
    </>
  );
}
