// ──────────────────────────────────────────────
// CustomThemeInjector: Injects the active custom theme.
//
// The theme's rules go in two stylesheets (see index.html for the cascade layers): its normal
// rules unlayered, so they beat the app's layered CSS without !important, and its !important
// rules again in the early mari-theme-important layer, so they beat the app's !important too.
// Safe mode skips both, and the chrome guard switches a theme off for this tab when it hides,
// moves, covers or blanks the top bar, a sidebar or Ctrl+K.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useThemes } from "../../hooks/use-themes";
import { extractImportantThemeCss, sanitizeAppCss, themeSetsVariable } from "../../lib/theme-css";
import { installSafeModeShortcut, useThemeSafetyStore } from "../../lib/theme-safety";
import { checkProtectedChrome } from "../../lib/theme-guard";
import { useUIStore } from "../../stores/ui.store";
import { useActiveThemeOverride } from "../../hooks/use-chat-theme";

const NORMAL_ID = "marinara-custom-theme";
const IMPORTANT_ID = "marinara-custom-theme-important";

function ensureStyle(id: string) {
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    style.dataset.mariCustomCss = "theme";
  }
  // Last in <head>, after the app's stylesheets (the overhaul's load on demand).
  document.head.appendChild(style);
  return style;
}

/** Every stylesheet a user or theme wrote: the active theme and the editor's live preview. */
export function customCssSheets(): HTMLStyleElement[] {
  return Array.from(document.querySelectorAll<HTMLStyleElement>("style[data-mari-custom-css]"));
}

export function CustomThemeInjector() {
  const { data: syncedThemes = [] } = useThemes();
  const overrideId = useActiveThemeOverride();
  const globalTheme = syncedThemes.find((theme) => theme.isActive) ?? null;
  // A chat or its character can pick its own theme (Chat settings > Theme); "" means Default there.
  const activeTheme =
    overrideId === undefined ? globalTheme : (syncedThemes.find((theme) => theme.id === overrideId) ?? null);
  const safeMode = useThemeSafetyStore((s) => s.safeMode);
  const blockedThemeId = useThemeSafetyStore((s) => s.blockedThemeId);
  const allowed = !!activeTheme && !safeMode && blockedThemeId !== activeTheme.id;

  useEffect(() => installSafeModeShortcut(), []);

  // Inject active custom theme CSS
  useEffect(() => {
    if (!activeTheme || !allowed) {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      return;
    }
    const css = sanitizeAppCss(activeTheme.css);
    const normal = ensureStyle(NORMAL_ID);
    normal.textContent = css;
    const importantCss = extractImportantThemeCss(css);
    if (importantCss) ensureStyle(IMPORTANT_ID).textContent = importantCss;
    else document.getElementById(IMPORTANT_ID)?.remove();
    document.documentElement.dataset.customTheme = activeTheme.id;
    // A backdrop is painted once behind the whole app (theme-tokens.css), not on every surface.
    if (themeSetsVariable(css, "--mari-app-backdrop")) document.documentElement.dataset.mariAppBackdrop = "";
    else delete document.documentElement.dataset.mariAppBackdrop;

    return () => {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      delete document.documentElement.dataset.customTheme;
      delete document.documentElement.dataset.mariAppBackdrop;
    };
  }, [activeTheme, allowed]);

  // The chrome guard: check after the theme lands, when a side panel or Ctrl+K opens, and on resize.
  useEffect(() => {
    if (!activeTheme || !allowed) return;
    const themeId = activeTheme.id;
    const themeName = activeTheme.name;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    const run = () => {
      timer = null;
      const sheets = [NORMAL_ID, IMPORTANT_ID]
        .map((id) => document.getElementById(id) as HTMLStyleElement | null)
        .filter((sheet): sheet is HTMLStyleElement => !!sheet);
      // A panel still sliding in is measured once it settles.
      const animating = document.querySelector(
        '[data-component="ChatSidebarPanel"], [data-component="RightPanelDesktop"], [data-component="TopBar"]',
      );
      if (animating?.getAnimations?.().some((animation) => animation.playState === "running") && retries < 5) {
        retries += 1;
        schedule(400);
        return;
      }
      retries = 0;
      const problems = checkProtectedChrome(sheets);
      if (problems.length > 0) useThemeSafetyStore.getState().blockTheme(themeId, themeName, problems);
    };
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };
    schedule(700);
    const late = setTimeout(() => schedule(0), 2500);
    const unsubscribe = useUIStore.subscribe((state, previous) => {
      if (
        state.sidebarOpen !== previous.sidebarOpen ||
        state.rightPanelOpen !== previous.rightPanelOpen ||
        state.omnibarOpen !== previous.omnibarOpen
      )
        schedule(650);
    });
    const onResize = () => schedule(500);
    window.addEventListener("resize", onResize);
    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(late);
      unsubscribe();
      window.removeEventListener("resize", onResize);
    };
  }, [activeTheme, allowed]);

  return null;
}
