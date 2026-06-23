import { createPortal } from "react-dom";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useActiveLorebookEntries } from "../../hooks/use-lorebooks";
import { useUIStore } from "../../stores/ui.store";
import { CHAT_FLOATING_UI_DISMISS_EVENT } from "../../lib/chat-floating-ui-events";
import { ROLEPLAY_POPOVER_SCROLL_AREA, ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";
import {
  CHAT_FLOATING_PANEL_SELECTOR,
  getChatToolbarButtonClass,
  readChatToolbarFloatingPanelAnchor,
  type ChatToolbarFloatingPanelAnchor,
} from "./ChatToolbarControls";

const ActiveLorebookEntriesPanel = lazy(async () => {
  const module = await import("./ChatRoleplayPanels");
  return { default: module.ActiveLorebookEntriesPanel };
});

const PANEL_BACKDROP =
  "fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]";
const PANEL_CONTAINER = cn(
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  "relative max-h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto p-3",
);

type ButtonClassNameInput = {
  open: boolean;
  hasEntries: boolean;
  hasSkippedEntries: boolean;
  isLoading: boolean;
  compact: boolean;
};

type ActiveLorebookEntriesButtonProps = {
  chatId: string | null;
  buttonClassName?: string | ((state: ButtonClassNameInput) => string);
  iconSize?: number | string;
  title?: string;
  onOpen?: () => void;
};

function getMobileActiveContextPanelStyle(anchor: NonNullable<ChatToolbarFloatingPanelAnchor>) {
  return {
    top: anchor.top,
    right: `${anchor.right}px`,
    width: "min(20rem, calc(100vw - 4.75rem))",
    maxHeight: `min(32rem, calc(100dvh - ${anchor.top + 8}px))`,
  };
}

function ActiveLorebookEntriesLoadingFallback() {
  return (
    <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
      <Loader2 size="0.75rem" className="animate-spin" />
      Loading active context...
    </div>
  );
}

export function ActiveLorebookEntriesModal({
  chatId,
  open,
  onClose,
  anchor = null,
}: {
  chatId: string | null;
  open: boolean;
  onClose: () => void;
  anchor?: ChatToolbarFloatingPanelAnchor;
}) {
  if (!open || !chatId) return null;

  if (anchor) {
    return createPortal(
      <div
        data-chat-floating-panel
        className={cn(ROLEPLAY_POPOVER_SHELL, ROLEPLAY_POPOVER_SCROLL_AREA, "fixed z-[9999] overflow-y-auto p-3")}
        style={getMobileActiveContextPanelStyle(anchor)}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <Suspense fallback={<ActiveLorebookEntriesLoadingFallback />}>
          <ActiveLorebookEntriesPanel chatId={chatId} onClose={onClose} />
        </Suspense>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      data-chat-floating-panel
      className={PANEL_BACKDROP}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={PANEL_CONTAINER} onClick={(e) => e.stopPropagation()}>
        <Suspense fallback={<ActiveLorebookEntriesLoadingFallback />}>
          <ActiveLorebookEntriesPanel chatId={chatId} onClose={onClose} />
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}

export function ActiveLorebookEntriesButton({
  chatId,
  buttonClassName,
  iconSize = "0.875rem",
  title = "Active Context",
  onOpen,
}: ActiveLorebookEntriesButtonProps) {
  const [open, setOpen] = useState(false);
  const [mobileAnchor, setMobileAnchor] = useState<ChatToolbarFloatingPanelAnchor>(null);
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const compact = useUIStore((s) => s.centerCompact);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      const targetElement = target instanceof Element ? target : target.parentElement;
      if (targetElement?.closest(CHAT_FLOATING_PANEL_SELECTOR)) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !isMobile) {
      setMobileAnchor(null);
      return;
    }
    const update = () => setMobileAnchor(readChatToolbarFloatingPanelAnchor(buttonRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isMobile, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleDismiss = () => setOpen(false);
    window.addEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
    return () => window.removeEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, handleDismiss);
  }, [open]);

  if (!chatId) return null;

  const entries = data?.entries ?? [];
  const skippedEntries = data?.budgetSkippedEntries ?? [];
  const hasEntries = entries.length > 0;
  const hasSkippedEntries = skippedEntries.length > 0;
  const resolvedButtonClassName =
    typeof buttonClassName === "function"
      ? buttonClassName({ open, hasEntries, hasSkippedEntries, isLoading, compact })
      : (buttonClassName ??
        getChatToolbarButtonClass({
          active: (hasEntries || hasSkippedEntries) && !isLoading,
          compact,
          open,
        }));

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={() => {
          const nextOpen = !open;
          if (nextOpen) onOpen?.();
          setMobileAnchor(nextOpen && isMobile ? readChatToolbarFloatingPanelAnchor(buttonRef.current) : null);
          setOpen(nextOpen);
        }}
        className={resolvedButtonClassName}
        title={title}
        aria-label={title}
      >
        <BookOpen size={iconSize} />
      </button>
      {open &&
        (isMobile ? (
          <ActiveLorebookEntriesModal
            chatId={chatId}
            open={open}
            onClose={() => setOpen(false)}
            anchor={mobileAnchor}
          />
        ) : (
          <div
            data-chat-floating-panel
            className={cn(
              ROLEPLAY_POPOVER_SHELL,
              ROLEPLAY_POPOVER_SCROLL_AREA,
              "absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-3",
            )}
          >
            <Suspense fallback={<ActiveLorebookEntriesLoadingFallback />}>
              <ActiveLorebookEntriesPanel chatId={chatId} onClose={() => setOpen(false)} />
            </Suspense>
          </div>
        ))}
    </div>
  );
}
