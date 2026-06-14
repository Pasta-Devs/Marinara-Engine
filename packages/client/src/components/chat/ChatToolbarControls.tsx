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
};

export function getChatToolbarButtonClass({
  active = false,
  className,
  compact = false,
  open = false,
}: ChatToolbarButtonClassInput = {}) {
  return cn(
    "flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 text-foreground/60 backdrop-blur-md transition-all hover:bg-foreground/10 hover:text-foreground",
    compact ? "p-1" : "p-1.5",
    (active || open) && "border-foreground/20 bg-foreground/15 text-foreground/90",
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
          className={cn(
            "flex w-9 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/5 p-1.5 text-foreground/60 backdrop-blur-md transition-all hover:bg-foreground/10 hover:text-foreground",
            open && "border-foreground/20 bg-foreground/15 text-foreground/90",
          )}
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
