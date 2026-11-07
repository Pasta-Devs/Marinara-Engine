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
import { themeFontFaceCss } from "../../lib/theme-package";
import { installSafeModeShortcut, useThemeSafetyStore } from "../../lib/theme-safety";
import { checkProtectedChrome } from "../../lib/theme-guard";
import { themeHasHtml, useThemeTemplates } from "../../lib/theme-template";
import { useUIStore } from "../../stores/ui.store";
import {
  detectThemeChatHooks,
  useActiveThemeOverride,
  useChatArtBehindPanels,
  useChatRootHooks,
} from "../../hooks/use-chat-theme";

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

  // The theme's message templates, only when the user allows themes with HTML (lib/theme-template.ts).
  const allowThemeHtml = useUIStore((s) => s.allowThemeHtml);
  const templates = allowed && allowThemeHtml && themeHasHtml(activeTheme?.meta) ? activeTheme!.meta!.templates! : null;
  useEffect(() => {
    useThemeTemplates.setState({ templates });
  }, [templates]);
  useChatRootHooks();
  useChatArtBehindPanels();

  // Inject active custom theme CSS
  useEffect(() => {
    if (!activeTheme || !allowed) {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      return;
    }
    // A v2 theme's own fonts load with it, as @font-face rules ahead of its CSS.
    const css = sanitizeAppCss(`${themeFontFaceCss(activeTheme.meta)}\n${activeTheme.css}`);
    const normal = ensureStyle(NORMAL_ID);
    normal.textContent = css;
    const importantCss = extractImportantThemeCss(css);
    if (importantCss) ensureStyle(IMPORTANT_ID).textContent = importantCss;
    else document.getElementById(IMPORTANT_ID)?.remove();
    document.documentElement.dataset.customTheme = activeTheme.id;
    // A backdrop is painted once behind the whole app (theme-tokens.css), not on every surface.
    const backdropLayers = themeSetsVariable(css, "--mari-app-backdrop-layers");
    if (backdropLayers || themeSetsVariable(css, "--mari-app-backdrop"))
      document.documentElement.dataset.mariAppBackdrop = "";
    else delete document.documentElement.dataset.mariAppBackdrop;
    if (backdropLayers) document.documentElement.dataset.mariAppBackdropLayers = "";
    else delete document.documentElement.dataset.mariAppBackdropLayers;
    if (themeSetsVariable(css, "--mari-top-bar-bg")) document.documentElement.dataset.mariTopBarArt = "";
    else delete document.documentElement.dataset.mariTopBarArt;
    detectThemeChatHooks(css, themeSetsVariable);

    return () => {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      delete document.documentElement.dataset.customTheme;
      delete document.documentElement.dataset.mariAppBackdrop;
      delete document.documentElement.dataset.mariAppBackdropLayers;
      delete document.documentElement.dataset.mariTopBarArt;
      detectThemeChatHooks(null, themeSetsVariable);
    };
  }, [activeTheme, allowed]);

  // The chrome guard: check after the theme lands, again at 2.5 s and 10 s (rules that wait), when a
  // side panel or Ctrl+K opens, when a chat opens or the colour scheme changes, and on resize.
  // "Covered" or "unreadable" is only acted on when a second look 700 ms later sees it too, so a
  // transition that is mid-way never switches a theme off.
  useEffect(() => {
    if (!activeTheme || !allowed) return;
    const themeId = activeTheme.id;
    const themeName = activeTheme.name;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let confirming = false;
    const sheets = () =>
      [NORMAL_ID, IMPORTANT_ID]
        .map((id) => document.getElementById(id) as HTMLStyleElement | null)
        .filter((sheet): sheet is HTMLStyleElement => !!sheet);
    const run = () => {
      timer = null;
      // A panel still sliding in is measured once it settles.
      const sliding = document.querySelectorAll(
        '[data-component="ChatSidebarPanel"], [data-component="RightPanelDesktop"]',
      );
      const moving = Array.from(sliding).some((element) =>
        element
          .getAnimations?.()
          .some(
            (animation) =>
              animation.playState === "running" &&
              Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity),
          ),
      );
      if (moving && retries < 5) {
        retries += 1;
        schedule(400);
        return;
      }
      retries = 0;
      const problems = checkProtectedChrome(sheets());
      if (problems.length === 0) {
        confirming = false;
        return;
      }
      // "Covered" and "unreadable" can be a transition caught half-way: look again before acting.
      const certain = problems.some((problem) => problem.kind !== "covered" && problem.kind !== "unreadable");
      if (!certain && !confirming) {
        confirming = true;
        schedule(700);
        return;
      }
      confirming = false;
      useThemeSafetyStore.getState().blockTheme(themeId, themeName, problems);
    };
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };
    schedule(700);
    const late = setTimeout(() => schedule(0), 2500);
    const later = setTimeout(() => schedule(0), 10_000);
    const unsubscribe = useUIStore.subscribe((state, previous) => {
      if (
        state.sidebarOpen !== previous.sidebarOpen ||
        state.rightPanelOpen !== previous.rightPanelOpen ||
        state.omnibarOpen !== previous.omnibarOpen
      )
        schedule(650);
    });
    const observer = new MutationObserver(() => schedule(800));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-chat-id",
        "data-chat-open-mode",
        "data-theme",
        "data-ov-topbar-autohide",
        "data-visual-theme",
      ],
    });
    const onResize = () => schedule(500);
    window.addEventListener("resize", onResize);
    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(late);
      clearTimeout(later);
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [activeTheme, allowed]);

  return null;
}
