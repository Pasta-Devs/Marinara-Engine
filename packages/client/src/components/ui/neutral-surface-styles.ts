export const NEUTRAL_SURFACE_VARIABLES =
  "[--accent:var(--marinara-chat-chrome-highlight-bg)] [--accent-foreground:var(--marinara-chat-chrome-highlight-text)] [--background:var(--marinara-chat-chrome-panel-bg)] [--border:var(--marinara-chat-chrome-panel-border)] [--card:var(--marinara-chat-chrome-panel-bg)] [--foreground:var(--marinara-chat-chrome-panel-text)] [--input:var(--marinara-chat-chrome-input-border)] [--muted:var(--marinara-chat-chrome-highlight-bg)] [--muted-foreground:var(--marinara-chat-chrome-panel-muted)] [--popover:var(--marinara-chat-chrome-panel-bg)] [--popover-foreground:var(--marinara-chat-chrome-panel-text)] [--primary:var(--marinara-chat-chrome-highlight-text)] [--primary-foreground:var(--marinara-chat-chrome-panel-bg)] [--ring:var(--marinara-chat-chrome-focus-ring)] [--secondary:var(--marinara-chat-chrome-highlight-bg)]";

export const NEUTRAL_PANEL_SHELL = `marinara-chat-popover rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 backdrop-blur-md animate-message-in ${NEUTRAL_SURFACE_VARIABLES}`;

/** Phone bottom sheet: the shape every sheet shares (Modal below `sm`, ContextMenu on touch phones). */
export const BOTTOM_SHEET_CLASS =
  "rounded-t-2xl rounded-b-none border-x-0 border-b-0 pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]";
/** BOTTOM_SHEET_CLASS behind `max-sm:`, spelled out so Tailwind sees the classes. */
export const PHONE_BOTTOM_SHEET_CLASS =
  "max-sm:max-w-none max-sm:max-h-full max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]";
/** Sheet buttons: compact on desktop; on phones a 48px full-width target. Main action first in the footer. */
const SHEET_BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-12 max-sm:w-full max-sm:rounded-xl max-sm:text-[15px]";
export const SHEET_BUTTON_PRIMARY = `${SHEET_BUTTON_BASE} bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] hover:opacity-90`;
export const SHEET_BUTTON_SECONDARY = `${SHEET_BUTTON_BASE} bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]`;
export const SHEET_BUTTON_DESTRUCTIVE = `${SHEET_BUTTON_BASE} bg-[var(--destructive)] font-semibold text-white hover:opacity-90`;
export const SHEET_BUTTON_QUIET = `${SHEET_BUTTON_BASE} text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]`;
/** Choice list in a confirm or menu sheet: one grouped block of full-width rows. */
export const SHEET_CHOICE_GROUP_CLASS =
  "flex flex-col overflow-hidden rounded-xl bg-[var(--secondary)] divide-y divide-[var(--border)]";
export const SHEET_CHOICE_ROW_CLASS =
  "flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)] disabled:opacity-50 max-sm:min-h-13 max-sm:justify-center max-sm:text-center max-sm:text-[15px]";

/** Phone sheet close X: 30px circle with a 44px hit area. */
export const SHEET_CLOSE_BUTTON_CLASS =
  "max-sm:h-[30px]! max-sm:w-[30px]! max-sm:rounded-full max-sm:bg-[var(--marinara-chat-chrome-highlight-bg)] max-sm:after:absolute max-sm:after:-inset-[7px] max-sm:after:content-['']";
export const SHEET_GRABBER_CLASS =
  "mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-[var(--marinara-chat-chrome-panel-muted)] opacity-40";

export const NEUTRAL_PANEL_HEADER =
  "marinara-chat-popover__header border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5";

export const NEUTRAL_PANEL_TITLE =
  "marinara-chat-popover__title flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight text-[var(--marinara-chat-chrome-panel-title)]";

export const NEUTRAL_PANEL_SUBTITLE =
  "marinara-chat-popover__subtitle mt-0.5 text-[0.625rem] leading-snug text-[var(--marinara-chat-chrome-panel-muted)]";

export const NEUTRAL_PANEL_SCROLL_AREA =
  "marinara-chat-popover__scroll scrollbar-thin scrollbar-thumb-[var(--marinara-chat-chrome-panel-scrollbar)] scrollbar-track-transparent";

export const NEUTRAL_PANEL_CLOSE_BUTTON =
  "rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

export const NEUTRAL_PANEL_CLOSE_ICON_SIZE = "1rem";
