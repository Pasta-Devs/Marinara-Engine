export const NEUTRAL_SURFACE_VARIABLES =
  "[--accent:var(--marinara-chat-chrome-highlight-bg)] [--accent-foreground:var(--marinara-chat-chrome-highlight-text)] [--background:var(--marinara-chat-chrome-panel-bg)] [--border:var(--marinara-chat-chrome-panel-border)] [--card:var(--marinara-chat-chrome-panel-bg)] [--foreground:var(--marinara-chat-chrome-panel-text)] [--input:var(--marinara-chat-chrome-input-border)] [--muted:var(--marinara-chat-chrome-highlight-bg)] [--muted-foreground:var(--marinara-chat-chrome-panel-muted)] [--popover:var(--marinara-chat-chrome-panel-bg)] [--popover-foreground:var(--marinara-chat-chrome-panel-text)] [--primary:var(--marinara-chat-chrome-highlight-text)] [--primary-foreground:var(--marinara-chat-chrome-panel-bg)] [--ring:var(--marinara-chat-chrome-focus-ring)] [--secondary:var(--marinara-chat-chrome-highlight-bg)]";

export const NEUTRAL_PANEL_SHELL = `marinara-chat-popover rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 backdrop-blur-md animate-message-in ${NEUTRAL_SURFACE_VARIABLES}`;

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
