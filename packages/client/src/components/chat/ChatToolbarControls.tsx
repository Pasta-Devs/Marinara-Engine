import { cn } from "../../lib/utils";

type ChatToolbarButtonClassInput = {
  active?: boolean;
  className?: string;
  compact?: boolean;
  open?: boolean;
  sizeClassName?: string;
};

export type ChatToolbarPanelAction = "settings";

export const CHAT_TOOLBAR_ICON_GAP_CLASS = "gap-0.5";
export const CHAT_TOOLBAR_DEFAULT_BUTTON_SIZE_CLASS = "h-8 w-8";
export const CHAT_TOOLBAR_IDENTITY_PILL_SIZE_CLASS = "h-8 w-auto max-md:h-9";
export const CHAT_TOOLBAR_MOBILE_OVERFLOW_HEIGHT_CLASS = "max-md:h-9";
export const CHAT_TOOLBAR_OVERFLOW_BUTTON_SIZE_CLASS = "h-8 w-8 max-md:h-9 max-md:w-9";
export const CHAT_TOOLBAR_ACTION_EVENT = "mari-chat-toolbar-action";
export const CHAT_FLOATING_PANEL_SELECTOR = "[data-chat-floating-panel]";
const CHAT_TOOLBAR_PANEL_ACTION_ATTRIBUTE = "data-chat-toolbar-panel-action";

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
  return value === "settings" ? value : null;
}

export function readAnnouncedChatToolbarPanelAction(event: Event): ChatToolbarPanelAction | null {
  if (!(event instanceof CustomEvent)) return null;
  const value = (event.detail as { panelAction?: unknown } | null)?.panelAction;
  return value === "settings" ? value : null;
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

  // Phones open chat panels as sheets in a fixed place.
  if (window.innerWidth < 768) return null;

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
    "mari-chat-style-control marinara-chat-toolbar-button flex items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] backdrop-blur-md transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
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
