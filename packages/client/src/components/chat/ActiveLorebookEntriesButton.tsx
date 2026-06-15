import { createPortal } from "react-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useActiveLorebookEntries } from "../../hooks/use-lorebooks";
import { useUIStore } from "../../stores/ui.store";
import { ROLEPLAY_POPOVER_SCROLL_AREA, ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";

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
};

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
}: {
  chatId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !chatId) return null;

  return createPortal(
    <div className={PANEL_BACKDROP} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={PANEL_CONTAINER} onClick={(e) => e.stopPropagation()}>
        <Suspense fallback={<ActiveLorebookEntriesLoadingFallback />}>
          <ActiveLorebookEntriesPanel chatId={chatId} isMobile onClose={onClose} />
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
}: ActiveLorebookEntriesButtonProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const compact = useUIStore((s) => s.centerCompact);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
      <button onClick={() => setOpen(!open)} className={resolvedButtonClassName} title={title} aria-label={title}>
        <BookOpen size={iconSize} />
      </button>
      {open &&
        (isMobile ? (
          <ActiveLorebookEntriesModal chatId={chatId} open={open} onClose={() => setOpen(false)} />
        ) : (
          <div
            className={cn(
              ROLEPLAY_POPOVER_SHELL,
              ROLEPLAY_POPOVER_SCROLL_AREA,
              "absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-3",
            )}
          >
            <Suspense fallback={<ActiveLorebookEntriesLoadingFallback />}>
              <ActiveLorebookEntriesPanel chatId={chatId} isMobile={isMobile} onClose={() => setOpen(false)} />
            </Suspense>
          </div>
        ))}
    </div>
  );
}
