export const NEUTRAL_SURFACE_VARIABLES =
  "[--accent:rgb(39_39_42)] [--accent-foreground:rgb(244_244_245)] [--background:rgb(18_18_21)] [--border:rgb(63_63_70)] [--card:rgb(24_24_27)] [--foreground:rgb(244_244_245)] [--input:rgb(63_63_70)] [--muted:rgb(39_39_42)] [--muted-foreground:rgb(161_161_170)] [--popover:rgb(24_24_27)] [--popover-foreground:rgb(244_244_245)] [--primary:rgb(212_212_216)] [--primary-foreground:rgb(18_18_21)] [--ring:rgb(161_161_170)] [--secondary:rgb(39_39_42)]";

export const NEUTRAL_PANEL_SHELL = `rounded-xl border border-zinc-700/80 bg-zinc-950/95 text-zinc-100 shadow-2xl shadow-black/40 backdrop-blur-md animate-message-in ${NEUTRAL_SURFACE_VARIABLES}`;

export const NEUTRAL_PANEL_HEADER = "border-b border-[var(--border)] px-3 py-2.5";

export const NEUTRAL_PANEL_TITLE =
  "flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight text-[var(--foreground)]";

export const NEUTRAL_PANEL_SUBTITLE = "mt-0.5 text-[0.625rem] leading-snug text-[var(--muted-foreground)]";

export const NEUTRAL_PANEL_SCROLL_AREA = "scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent";
