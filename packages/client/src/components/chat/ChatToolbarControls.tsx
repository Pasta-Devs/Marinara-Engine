import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";

type ChatToolbarButtonClassInput = {
  active?: boolean;
  className?: string;
  compact?: boolean;
  open?: boolean;
  sizeClassName?: string;
};

export function getChatToolbarButtonClass({
  active = false,
  className,
  compact = false,
  open = false,
  sizeClassName,
}: ChatToolbarButtonClassInput = {}) {
  return cn(
    "marinara-chat-toolbar-button flex items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] backdrop-blur-md transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
    sizeClassName ?? "h-8 w-8",
    compact ? "p-1" : "p-1.5",
    (active || open) &&
      "marinara-chat-toolbar-button--active border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]",
    className,
  );
}

export function ChatToolbarButton({
  className,
  icon,
  title,
  onClick,
  size,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  size?: "sm";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={getChatToolbarButtonClass({ className, compact: size === "sm" })}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}

export function ChatToolbarMenu({
  children,
  desktopChildren,
  mobileChildren,
}: {
  children?: ReactNode;
  desktopChildren?: ReactNode;
  mobileChildren?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const compact = useUIStore((s) => s.centerCompact);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const resolvedDesktopChildren = desktopChildren ?? children;
  const resolvedMobileChildren = mobileChildren ?? children;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      const target = event.target as Node;
      if (target instanceof Element && target.closest("[data-chat-branch-popover]")) return;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <>
      <div className={cn("items-center gap-1.5 max-md:hidden", compact ? "hidden" : "flex")}>
        {resolvedDesktopChildren}
      </div>
      <div className={cn("relative shrink-0", compact ? "block" : "block md:hidden")} ref={btnRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={getChatToolbarButtonClass({ className: "h-9 w-9", open })}
          title="More options"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreHorizontal size="0.9375rem" />
        </button>
        {open &&
          createPortal(
            <div
              ref={popRef}
              className={cn(ROLEPLAY_POPOVER_SHELL, "fixed z-[9999] flex w-9 flex-col items-center gap-0.5 p-1")}
              style={{ top: pos.top, right: pos.right }}
              onClick={() => setOpen(false)}
            >
              {resolvedMobileChildren}
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}
