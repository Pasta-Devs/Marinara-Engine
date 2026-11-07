// ──────────────────────────────────────────────
// Theme safety: safe mode, keep/revert and the chrome guard
//
// A custom theme is CSS from anyone, and the active one syncs to every device. These are the
// ways back when a theme goes wrong:
//   • Safe mode skips custom theme CSS for this browser tab. Open the app with `?safe` in the
//     address, press Escape three times quickly, or pick "Custom theme" in Ctrl+K.
//   • Activating a theme asks "Keep this theme?" and goes back to the previous one after 15 s.
//   • The chrome guard (lib/theme-guard.ts) checks that the top bar, the chats sidebar and the
//     Library sidebar are still where they belong, visible, readable and clickable, and switches a
//     theme off for this tab when it breaks them.
// ──────────────────────────────────────────────
import { create } from "zustand";

const SAFE_MODE_SESSION_KEY = "marinara-safe-mode";
/** "Keep this theme?" survives a reload or a closed tab: unanswered means go back. */
const PENDING_KEEP_KEY = "marinara-theme-pending-keep";
export const KEEP_THEME_SECONDS = 15;

export type ThemeSafetyReason = "url" | "keyboard" | "command" | "guard";

export interface ThemeGuardProblem {
  /** Which protected area broke: top bar, chats sidebar, Library sidebar, Ctrl+K, the message box,
   *  the whole app (an overlay) or the chat (added text). */
  area: "topbar" | "chats" | "library" | "omnibar" | "composer" | "app" | "chat";
  /** What the theme did to it. */
  kind: "hidden" | "moved" | "covered" | "unreadable" | "too-small" | "overlay" | "fake-text";
  /** The text a theme added, for "fake-text". */
  text?: string;
}

interface PendingKeep {
  /** The theme just switched on. */
  themeId: string;
  themeName: string;
  /** The theme to go back to (null = Default). */
  previousId: string | null;
  deadline: number;
  /** Set while the person hovers or focuses the bar: the countdown waits with this much left. */
  pausedRemaining?: number | null;
}

interface ThemeSafetyState {
  /** Custom theme CSS is skipped in this tab. */
  safeMode: boolean;
  safeReason: ThemeSafetyReason | null;
  /** The theme the guard switched off in this tab, and why. */
  blockedThemeId: string | null;
  blockedThemeName: string | null;
  blockedProblems: ThemeGuardProblem[];
  /** "Keep this theme?" while it counts down. */
  pendingKeep: PendingKeep | null;
  enterSafeMode: (reason: ThemeSafetyReason) => void;
  leaveSafeMode: () => void;
  blockTheme: (themeId: string, themeName: string, problems: ThemeGuardProblem[]) => void;
  clearBlockedTheme: () => void;
  askToKeep: (pending: Omit<PendingKeep, "deadline">) => void;
  settleKeep: () => void;
  pauseKeep: (paused: boolean) => void;
}

function readPendingKeep(): PendingKeep | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEEP_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingKeep>;
    if (typeof value.themeId !== "string" || typeof value.deadline !== "number") return null;
    return {
      themeId: value.themeId,
      themeName: typeof value.themeName === "string" ? value.themeName : "",
      previousId: typeof value.previousId === "string" ? value.previousId : null,
      deadline: value.deadline,
      pausedRemaining: null,
    };
  } catch {
    return null;
  }
}

function writePendingKeep(pending: PendingKeep | null) {
  try {
    if (pending) window.localStorage.setItem(PENDING_KEEP_KEY, JSON.stringify(pending));
    else window.localStorage.removeItem(PENDING_KEEP_KEY);
  } catch {
    /* storage can be blocked; the countdown then only lives in this tab */
  }
}

function readInitialSafeMode(): { safeMode: boolean; safeReason: ThemeSafetyReason | null } {
  if (typeof window === "undefined") return { safeMode: false, safeReason: null };
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("safe") && params.get("safe") !== "0" && params.get("safe") !== "false") {
      window.sessionStorage.setItem(SAFE_MODE_SESSION_KEY, "url");
      return { safeMode: true, safeReason: "url" };
    }
    const stored = window.sessionStorage.getItem(SAFE_MODE_SESSION_KEY);
    if (stored) return { safeMode: true, safeReason: stored as ThemeSafetyReason };
  } catch {
    /* storage can be blocked; safe mode then lasts until reload */
  }
  return { safeMode: false, safeReason: null };
}

function dropSafeParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("safe")) return;
    url.searchParams.delete("safe");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

export const useThemeSafetyStore = create<ThemeSafetyState>()((set) => ({
  ...readInitialSafeMode(),
  blockedThemeId: null,
  blockedThemeName: null,
  blockedProblems: [],
  pendingKeep: typeof window === "undefined" ? null : readPendingKeep(),
  enterSafeMode: (reason) => {
    try {
      window.sessionStorage.setItem(SAFE_MODE_SESSION_KEY, reason);
    } catch {
      /* ignore */
    }
    set({ safeMode: true, safeReason: reason, pendingKeep: null });
  },
  leaveSafeMode: () => {
    try {
      window.sessionStorage.removeItem(SAFE_MODE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    dropSafeParam();
    set({ safeMode: false, safeReason: null });
  },
  // A theme still waiting on "Keep this theme?" stays pending; the bar goes back to the previous one.
  blockTheme: (blockedThemeId, blockedThemeName, blockedProblems) =>
    set({ blockedThemeId, blockedThemeName, blockedProblems }),
  clearBlockedTheme: () => set({ blockedThemeId: null, blockedThemeName: null, blockedProblems: [] }),
  askToKeep: (pending) => {
    const next = { ...pending, deadline: Date.now() + KEEP_THEME_SECONDS * 1000, pausedRemaining: null };
    writePendingKeep(next);
    set({ pendingKeep: next });
  },
  settleKeep: () => {
    writePendingKeep(null);
    set({ pendingKeep: null });
  },
  pauseKeep: (paused) =>
    set((state) => {
      const pending = state.pendingKeep;
      if (!pending) return {};
      const isPaused = pending.pausedRemaining != null;
      if (paused === isPaused) return {};
      const next = paused
        ? { ...pending, pausedRemaining: Math.max(1000, pending.deadline - Date.now()) }
        : { ...pending, deadline: Date.now() + (pending.pausedRemaining ?? 0), pausedRemaining: null };
      writePendingKeep({
        ...next,
        pausedRemaining: null,
        deadline: paused ? Date.now() + KEEP_THEME_SECONDS * 1000 : next.deadline,
      });
      return { pendingKeep: next };
    }),
}));

/** Whether custom theme CSS may be applied right now for this theme id. */
export function themeCssAllowed(themeId: string | null | undefined) {
  const state = useThemeSafetyStore.getState();
  return !state.safeMode && (!themeId || state.blockedThemeId !== themeId);
}

/** Something an Escape would close: a dialog, a menu, a popover, Ctrl+K. */
const ESCAPE_CLOSES =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-component="GlobalOmnibar.Panel"]';

/**
 * Escape three times within 1.2 s turns custom themes off for this tab. A theme can hide every
 * button, but it cannot take the keyboard away. An Escape that closes something (Ctrl+K, a menu,
 * a dialog) doesn't count, so closing things quickly never switches a good theme off.
 */
export function installSafeModeShortcut(): () => void {
  let presses: number[] = [];
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.repeat) return;
    if (document.querySelector(ESCAPE_CLOSES)) {
      presses = [];
      return;
    }
    const now = performance.now();
    presses = [...presses.filter((time) => now - time < 1200), now];
    if (presses.length < 3) return;
    presses = [];
    const state = useThemeSafetyStore.getState();
    if (!state.safeMode) state.enterSafeMode("keyboard");
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
