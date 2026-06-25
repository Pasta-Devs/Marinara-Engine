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
import { ROLEPLAY_POPOVER_SHELL } from "./roleplay-popover-styles";

type ChatToolbarButtonClassInput = {
  active?: boolean;
  className?: string;
  compact?: boolean;
  open?: boolean;
  sizeClassName?: string;
};

export const CHAT_TOOLBAR_ICON_GAP_CLASS = "gap-0.5";
export const CHAT_TOOLBAR_DEFAULT_BUTTON_SIZE_CLASS = "h-8 w-8";
export const CHAT_TOOLBAR_IDENTITY_PILL_SIZE_CLASS = "h-8 w-auto max-md:h-9";
export const CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS = "max-md:h-9";
export const CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS = "h-8 w-8 max-md:h-9 max-md:w-9";
export const CHAT_TOOLBAR_OVERFLOW_MENU_CLASS = cn(
  ROLEPLAY_POPOVER_SHELL,
  "marinara-chat-toolbar-overflow-menu flex w-9 flex-col items-center p-1",
  CHAT_TOOLBAR_ICON_GAP_CLASS,
);
export const CHAT_TOOLBAR_ACTION_EVENT = "mari-chat-toolbar-action";
export const CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR = "[data-chat-toolbar-overflow-menu]";
export const CHAT_FLOATING_PANEL_SELECTOR = "[data-chat-floating-panel]";
const CHAT_FLOATING_PANEL_PADDING = 8;

export type ChatToolbarFloatingPanelAnchor = { right: number; top: number } | null;

export function announceChatToolbarAction() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_TOOLBAR_ACTION_EVENT));
}

export function readChatToolbarFloatingPanelAnchor(trigger: HTMLElement | null): ChatToolbarFloatingPanelAnchor {
  if (!trigger || typeof window === "undefined") return null;

  const overflowMenu = trigger.closest<HTMLElement>(CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR);

  if (window.innerWidth < 768) {
    if (!overflowMenu) return null;
    const menuRect = overflowMenu.getBoundingClientRect();
    const minimumPanelWidth = Math.min(160, Math.max(96, window.innerWidth - CHAT_FLOATING_PANEL_PADDING * 2));
    const rightEdge = Math.max(CHAT_FLOATING_PANEL_PADDING + minimumPanelWidth, menuRect.left - CHAT_FLOATING_PANEL_PADDING);
    return {
      right: Math.max(CHAT_FLOATING_PANEL_PADDING, window.innerWidth - rightEdge),
      top: Math.max(CHAT_FLOATING_PANEL_PADDING, Math.round(menuRect.top)),
    };
  }

  const rect = trigger.getBoundingClientRect();
  return {
    right: Math.max(0, window.innerWidth - rect.right),
    top: Math.max(56, Math.round(rect.bottom + 8)),
  };
}

export function getChatToolbarButtonClass({
  active = false,
  className,
  compact = false,
  open = false,
  sizeClassName,
}: ChatToolbarButtonClassInput = {}) {
  return cn(
    "marinara-chat-toolbar-button flex items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] backdrop-blur-md transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
    sizeClassName ?? CHAT_TOOLBAR_DEFAULT_BUTTON_SIZE_CLASS,
    compact ? "p-1" : "p-1.5",
    active &&
      "marinara-chat-toolbar-button--active border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]",
    !active &&
      open &&
      "marinara-chat-toolbar-button--open border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-hover)] text-[var(--marinara-chat-chrome-button-text-hover)]",
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
      onClick={(event) => {
        announceChatToolbarAction();
        onClick(event);
      }}
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
  className,
  desktopChildren,
  mobileChildren,
}: {
  children?: ReactNode;
  className?: string;
  desktopChildren?: ReactNode;
  mobileChildren?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [overflowCollapsed, setOverflowCollapsed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const neededDesktopWidthRef = useRef(0);
  const lastViewportWidthRef = useRef(typeof window === "undefined" ? 0 : window.innerWidth);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const resolvedDesktopChildren = desktopChildren ?? children;
  const resolvedMobileChildren = mobileChildren ?? children;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const measure = () => {
      const widthChanged = window.innerWidth !== lastViewportWidthRef.current;
      lastViewportWidthRef.current = window.innerWidth;
      if (mobileQuery.matches) {
        setOverflowCollapsed(false);
        // Close the overflow menu only when the viewport WIDTH changes (orientation
        // or window resize). The on-screen keyboard shrinks only the height and also
        // fires resize; closing here would unmount an open child panel — the Author's
        // Notes or Summary editor — mid-edit (#2868).
        if (widthChanged) setOpen(false);
        return;
      }

      const desktop = desktopRef.current;
      const availableWidth = root.clientWidth;
      const measuredWidth = desktop?.scrollWidth ?? neededDesktopWidthRef.current;
      if (desktop && measuredWidth > 0) {
        neededDesktopWidthRef.current = measuredWidth;
      }

      if (desktop && measuredWidth > availableWidth + 2) {
        setOverflowCollapsed(true);
        return;
      }

      if (!desktop && neededDesktopWidthRef.current > 0 && availableWidth > neededDesktopWidthRef.current + 24) {
        setOverflowCollapsed(false);
        setOpen(false);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (desktopRef.current) observer.observe(desktopRef.current);
    mobileQuery.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [overflowCollapsed]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      const target = event.target as Node;
      if (target instanceof Element && target.closest(`[data-chat-branch-popover],${CHAT_FLOATING_PANEL_SELECTOR}`)) {
        return;
      }
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative flex min-w-0 items-center justify-end", className)}
      onPointerDownCapture={announceChatToolbarAction}
    >
      {!overflowCollapsed && (
        <div ref={desktopRef} className={cn("flex items-center max-md:hidden", CHAT_TOOLBAR_ICON_GAP_CLASS)}>
          {resolvedDesktopChildren}
        </div>
      )}
      <div className={cn("relative shrink-0", overflowCollapsed ? "block" : "block md:hidden")} ref={btnRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={getChatToolbarButtonClass({ className: CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS, open })}
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
              data-chat-toolbar-overflow-menu
              className={cn(CHAT_TOOLBAR_OVERFLOW_MENU_CLASS, "fixed z-[9999]")}
              style={{ top: pos.top, right: pos.right }}
              onPointerDownCapture={announceChatToolbarAction}
            >
              {resolvedMobileChildren}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
