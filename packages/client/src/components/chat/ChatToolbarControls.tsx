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
import { CHAT_SUMMARY_OPEN_REQUEST_EVENT, requestChatSummaryOpen } from "../../lib/chat-floating-ui-events";
import { CHAT_HELP_CLOSE_EVENT, CHAT_HELP_OPEN_REQUEST_EVENT, readChatHelpEventMode } from "../../lib/chat-help-events";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { NEUTRAL_PANEL_SHELL } from "../ui/neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

type ChatToolbarButtonClassInput = {
  active?: boolean;
  className?: string;
  compact?: boolean;
  open?: boolean;
  sizeClassName?: string;
};

export type ChatToolbarPanelAction = "gallery" | "search" | "settings" | "summary";

export const CHAT_TOOLBAR_ICON_GAP_CLASS = "gap-0.5";
export const CHAT_TOOLBAR_DEFAULT_BUTTON_SIZE_CLASS = "h-8 w-8";
export const CHAT_TOOLBAR_IDENTITY_PILL_SIZE_CLASS = "h-8 w-auto max-md:h-9";
export const CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS = "max-md:h-9";
export const CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS = "h-8 w-8 max-md:h-9 max-md:w-9";
export const CHAT_TOOLBAR_OVERFLOW_MENU_CLASS = cn(
  NEUTRAL_PANEL_SHELL,
  "marinara-chat-toolbar-overflow-menu flex w-9 flex-col items-center p-1",
  CHAT_TOOLBAR_ICON_GAP_CLASS,
);
export const CHAT_TOOLBAR_ACTION_EVENT = "mari-chat-toolbar-action";
export const CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR = "[data-chat-toolbar-overflow-menu]";
export const CHAT_FLOATING_PANEL_SELECTOR = "[data-chat-floating-panel]";
const CHAT_TOOLBAR_PANEL_ACTION_ATTRIBUTE = "data-chat-toolbar-panel-action";
const CHAT_FLOATING_PANEL_PADDING = 8;

export type ChatToolbarFloatingPanelAnchor = {
  right: number;
  rightInset: number;
  top: number;
} | null;

function readCssPixelValue(element: HTMLElement, property: string) {
  const parsed = Number.parseFloat(window.getComputedStyle(element).getPropertyValue(property));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function getChatFloatingPanelDesktopRight(anchor: ChatToolbarFloatingPanelAnchor) {
  const triggerOffset = anchor ? Math.max(0, anchor.right - anchor.rightInset) : 12;
  return `calc(var(--mari-chat-ui-inset-right, 0px) + var(--tracker-panel-hud-clear-right, 0px) + ${triggerOffset}px)`;
}

function readChatToolbarPanelAction(target: EventTarget | null): ChatToolbarPanelAction | null {
  if (!(target instanceof Element)) return null;
  const value = target
    .closest(`[${CHAT_TOOLBAR_PANEL_ACTION_ATTRIBUTE}]`)
    ?.getAttribute(CHAT_TOOLBAR_PANEL_ACTION_ATTRIBUTE);
  return value === "gallery" || value === "search" || value === "settings" || value === "summary" ? value : null;
}

export function readAnnouncedChatToolbarPanelAction(event: Event): ChatToolbarPanelAction | null {
  if (!(event instanceof CustomEvent)) return null;
  const value = (event.detail as { panelAction?: unknown } | null)?.panelAction;
  return value === "gallery" || value === "search" || value === "settings" || value === "summary" ? value : null;
}

export function isChatToolbarPanelTrigger(target: EventTarget | null, panelAction: ChatToolbarPanelAction) {
  return readChatToolbarPanelAction(target) === panelAction;
}

export function announceChatToolbarAction(panelAction: ChatToolbarPanelAction | null = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_TOOLBAR_ACTION_EVENT, { detail: { panelAction } }));
}

export function readChatToolbarFloatingPanelAnchor(trigger: HTMLElement | null): ChatToolbarFloatingPanelAnchor {
  if (!trigger || typeof window === "undefined") return null;

  const overflowMenu = trigger.closest<HTMLElement>(CHAT_TOOLBAR_OVERFLOW_MENU_SELECTOR);

  if (window.innerWidth < 768) {
    if (!overflowMenu) return null;
    const menuRect = overflowMenu.getBoundingClientRect();
    const minimumPanelWidth = Math.min(160, Math.max(96, window.innerWidth - CHAT_FLOATING_PANEL_PADDING * 2));
    const rightEdge = Math.max(
      CHAT_FLOATING_PANEL_PADDING + minimumPanelWidth,
      menuRect.left - CHAT_FLOATING_PANEL_PADDING,
    );
    return {
      right: Math.max(CHAT_FLOATING_PANEL_PADDING, window.innerWidth - rightEdge),
      rightInset: 0,
      top: Math.max(CHAT_FLOATING_PANEL_PADDING, Math.round(menuRect.top)),
    };
  }

  const rect = trigger.getBoundingClientRect();
  const rightInset =
    readCssPixelValue(trigger, "--mari-chat-ui-inset-right") +
    readCssPixelValue(trigger, "--tracker-panel-hud-clear-right");
  return {
    right: Math.max(0, window.innerWidth - rect.right),
    rightInset,
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
  helpTarget,
  panelAction,
  size,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  helpTarget?: string;
  panelAction?: ChatToolbarPanelAction;
  size?: "sm";
}) {
  const localize = useLocalizedUiText();
  const localizedTitle = localize(title);

  return (
    <button
      type="button"
      onClick={(event) => {
        announceChatToolbarAction(panelAction ?? null);
        onClick(event);
      }}
      data-chat-help={helpTarget ?? panelAction}
      data-chat-toolbar-panel-action={panelAction}
      className={getChatToolbarButtonClass({ className, compact: size === "sm" })}
      title={localizedTitle}
      aria-label={localizedTitle}
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
  openSummaryOnRequest = false,
}: {
  children?: ReactNode;
  className?: string;
  desktopChildren?: ReactNode;
  mobileChildren?: ReactNode;
  openSummaryOnRequest?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [overflowCollapsed, setOverflowCollapsed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pendingSummaryChatIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    const handleHelpOpen = (event: Event) => {
      const root = rootRef.current;
      if (!root || root.getBoundingClientRect().width <= 1) return;
      const mode = root.closest<HTMLElement>("[data-chat-mode]")?.dataset.chatMode;
      if (readChatHelpEventMode(event) !== mode) return;
      if (window.innerWidth < 768 || overflowCollapsed) setOpen(true);
    };
    const handleHelpClose = (event: Event) => {
      const mode = rootRef.current?.closest<HTMLElement>("[data-chat-mode]")?.dataset.chatMode;
      if (readChatHelpEventMode(event) === mode) setOpen(false);
    };
    window.addEventListener(CHAT_HELP_OPEN_REQUEST_EVENT, handleHelpOpen);
    window.addEventListener(CHAT_HELP_CLOSE_EVENT, handleHelpClose);
    return () => {
      window.removeEventListener(CHAT_HELP_OPEN_REQUEST_EVENT, handleHelpOpen);
      window.removeEventListener(CHAT_HELP_CLOSE_EVENT, handleHelpClose);
    };
  }, [overflowCollapsed]);

  useEffect(() => {
    const handleSummaryOpenRequest = (event: Event) => {
      if (!openSummaryOnRequest || !(event instanceof CustomEvent)) return;
      const chatId = (event.detail as { chatId?: unknown } | null)?.chatId;
      const root = rootRef.current;
      if (typeof chatId !== "string" || !root || root.getBoundingClientRect().width <= 0) return;
      const hasVisibleSummaryAction = Array.from(
        document.querySelectorAll<HTMLElement>('[data-chat-toolbar-panel-action="summary"]'),
      ).some((action) => action.getBoundingClientRect().width > 0);
      if (hasVisibleSummaryAction) return;
      pendingSummaryChatIdRef.current = chatId;
      setOpen(true);
    };
    window.addEventListener(CHAT_SUMMARY_OPEN_REQUEST_EVENT, handleSummaryOpenRequest);
    return () => window.removeEventListener(CHAT_SUMMARY_OPEN_REQUEST_EVENT, handleSummaryOpenRequest);
  }, [openSummaryOnRequest]);

  useEffect(() => {
    const chatId = pendingSummaryChatIdRef.current;
    if (!open || !chatId) return;
    pendingSummaryChatIdRef.current = null;
    requestAnimationFrame(() => requestChatSummaryOpen(chatId));
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative flex min-w-0 items-center justify-end", className)}
      onPointerDownCapture={(event) => announceChatToolbarAction(readChatToolbarPanelAction(event.target))}
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
          title={localizeUi("ui.chat.chattoolbarmenu.moreOptions")}
          aria-label={localizeUi("ui.chat.chattoolbarmenu.moreOptions")}
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
              onPointerDownCapture={(event) => announceChatToolbarAction(readChatToolbarPanelAction(event.target))}
            >
              {resolvedMobileChildren}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
