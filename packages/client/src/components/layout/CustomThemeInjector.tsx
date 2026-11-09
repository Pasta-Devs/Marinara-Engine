// ──────────────────────────────────────────────
// CustomThemeInjector: Injects the active custom theme.
//
// The theme's rules go in two stylesheets (see index.html for the cascade layers): its normal
// rules unlayered, so they beat the app's layered CSS without !important, and its !important
// rules again in the early mari-theme-important layer, so they beat the app's !important too.
// Safe mode skips both, and the chrome guard switches a theme off for this tab when it hides,
// moves, covers or blanks the top bar, a sidebar or Ctrl+K.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useThemes } from "../../hooks/use-themes";
import { extractImportantThemeCss, sanitizeAppCss, themeSetsVariable } from "../../lib/theme-css";
import { themeFontFaceCss } from "../../lib/theme-package";
import { installSafeModeShortcut, useThemeSafetyStore } from "../../lib/theme-safety";
import { checkProtectedChrome, topBarPseudoArt } from "../../lib/theme-guard";
import { preloadImageSamples, prepareThemeCss } from "../../lib/theme-images";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { themeHasHtml, useThemeTemplates } from "../../lib/theme-template";
import { useUIStore } from "../../stores/ui.store";
import { useThemeSlots } from "../../lib/theme-slots";
import {
  detectThemeChatHooks,
  useActiveThemeOverride,
  useChatArtBehindPanels,
  useChatRootHooks,
} from "../../hooks/use-chat-theme";

/** Tokens whose presence switches a rule on (unset custom properties can't be tested in CSS). */
const THEME_FLAG_TOKENS: Array<[string, string]> = [
  ["--mari-icon-send", "data-mari-icon-send"],
  ["--mari-icon-stop", "data-mari-icon-stop"],
  ["--mari-icon-attach", "data-mari-icon-attach"],
  ["--mari-icon-emoji", "data-mari-icon-emoji"],
  ["--mari-cursor", "data-mari-theme-cursor"],
  ["--mari-home-art", "data-mari-home-art"],
  // Theming round 4: tokens for bits that were hard-coded (theme-tokens.css).
  ["--mari-message-time", "data-mari-message-time"],
  ["--mari-chat-wash", "data-mari-chat-wash"],
  ["--mari-lore-constant", "data-mari-lore-constant"],
  ["--mari-lore-selective", "data-mari-lore-selective"],
  ["--mari-lore-normal", "data-mari-lore-normal"],
  ["--mari-toast-font-size", "data-mari-toast-size"],
  ["--mari-min-ui-text", "data-mari-min-ui-text"],
  ["--mari-user-avatar-image", "data-mari-user-avatar-image"],
  ["--mari-focus-frame", "data-mari-focus-frame"],
  ["--mari-window-title", "data-mari-window-titles"],
  // Theming round 5: long replies (theme-tokens.css, hooks v1.5).
  ["--mari-message-measure", "data-mari-message-measure"],
  ["--mari-dialogue-weight", "data-mari-dialogue-weight"],
  ["--mari-dialogue-color", "data-mari-dialogue-color"],
  ["--mari-paragraph-gap", "data-mari-paragraph-gap"],
  ["--mari-pinned-speaker", "data-mari-pinned-speaker"],
  ["--mari-chat-line-height", "data-mari-chat-line-height"],
];

/** Tokens whose keyword value is copied onto <html> (e.g. --mari-phone-avatar: hidden). */
const THEME_VALUE_TOKENS: Array<[string, string, readonly string[]]> = [
  ["--mari-phone-avatar", "data-mari-phone-avatar", ["hidden"]],
];

/** The last keyword the theme gives a token, if it is one of `allowed`. */
function themeTokenKeyword(css: string, token: string, allowed: readonly string[]): string | null {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let found: string | null = null;
  for (const match of clean.matchAll(new RegExp(`(?:^|[\\s;{])${escaped}\\s*:\\s*([\\w-]+)`, "g"))) {
    if (allowed.includes(match[1]!)) found = match[1]!;
  }
  return found;
}

/** Flags switched on by any of several tokens. */
const THEME_FLAG_ANY: Array<[string[], string]> = [
  [
    ["--mari-home-shortcut-size", "--mari-home-shortcut-desc-size", "--mari-home-widget-text-size"],
    "data-mari-home-shortcut-size",
  ],
];

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
  // Reduce motion (the setting or the system's): moving pictures are swapped for their first frame.
  const reduceMotion = useReducedAmbientEffects();
  const [stillsReady, setStillsReady] = useState(0);

  // Inject active custom theme CSS
  useEffect(() => {
    if (!activeTheme || !allowed) {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      return;
    }
    // A v2 theme's own fonts load with it, as @font-face rules ahead of its CSS. Its pictures
    // (`theme:` names and inline data: pictures) become short blob: URLs (lib/theme-images.ts).
    const sanitized = sanitizeAppCss(`${themeFontFaceCss(activeTheme.meta)}\n${activeTheme.css}`);
    const prepared = prepareThemeCss(
      sanitized,
      [...(activeTheme.meta?.images ?? []), ...(activeTheme.meta?.backgrounds ?? [])],
      { still: reduceMotion },
    );
    let cancelled = false;
    if (prepared.stillsPending) void prepared.stillsPending.then(() => !cancelled && setStillsReady((n) => n + 1));
    const css = prepared.css;
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
    // Bar art through the token, or a picture hung on the bar's own ::before/::after: either way the
    // tabs and icons sit on plates (checked once the CSS has applied).
    const barArtToken = themeSetsVariable(css, "--mari-top-bar-bg");
    if (barArtToken) document.documentElement.dataset.mariTopBarArt = "";
    else delete document.documentElement.dataset.mariTopBarArt;
    const barArtFrame = barArtToken
      ? 0
      : requestAnimationFrame(() => {
          if (topBarPseudoArt()) document.documentElement.dataset.mariTopBarArt = "";
        });
    // The ambient overlay (rain, leaves, scanlines): over the chat, under the protected bars.
    if (themeSetsVariable(css, "--mari-ambient")) document.documentElement.dataset.mariAmbient = "";
    else delete document.documentElement.dataset.mariAmbient;
    if (prepared.animated) document.documentElement.dataset.mariThemeMoves = "";
    else delete document.documentElement.dataset.mariThemeMoves;
    // Picture icons in the message box and a picture cursor (theme-tokens.css).
    for (const [token, attribute] of THEME_FLAG_TOKENS) {
      if (themeSetsVariable(css, token)) document.documentElement.setAttribute(attribute, "");
      else document.documentElement.removeAttribute(attribute);
    }
    for (const [tokens, attribute] of THEME_FLAG_ANY) {
      if (tokens.some((token) => themeSetsVariable(css, token))) document.documentElement.setAttribute(attribute, "");
      else document.documentElement.removeAttribute(attribute);
    }
    // A focus frame that fills its middle gets no outset (theme-tokens.css), so it can't cover the chat.
    if (/(?:^|[\s;{])--mari-focus-frame\s*:[^;}]*\bfill\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")))
      document.documentElement.dataset.mariFocusFrameFill = "";
    else delete document.documentElement.dataset.mariFocusFrameFill;
    for (const [token, attribute, allowed] of THEME_VALUE_TOKENS) {
      const value = themeTokenKeyword(css, token, allowed);
      if (value) document.documentElement.setAttribute(attribute, value);
      else document.documentElement.removeAttribute(attribute);
    }
    detectThemeChatHooks(css, themeSetsVariable);
    // Slots the app renders only on request (lib/theme-slots.ts), and where the ambient layer sits.
    useThemeSlots.setState({ windowTitles: themeSetsVariable(css, "--mari-window-title") });
    if (/(^|[\s;{])--mari-ambient-placement\s*:\s*behind-cards\b/.test(css))
      document.documentElement.dataset.mariAmbientBehind = "";
    else delete document.documentElement.dataset.mariAmbientBehind;

    return () => {
      cancelAnimationFrame(barArtFrame);
      useThemeSlots.setState({ windowTitles: false });
      delete document.documentElement.dataset.mariAmbientBehind;
      cancelled = true;
      delete document.documentElement.dataset.mariAmbient;
      delete document.documentElement.dataset.mariThemeMoves;
      for (const [, attribute] of THEME_FLAG_TOKENS) document.documentElement.removeAttribute(attribute);
      for (const [, attribute] of THEME_FLAG_ANY) document.documentElement.removeAttribute(attribute);
      for (const [, attribute] of THEME_VALUE_TOKENS) document.documentElement.removeAttribute(attribute);
      delete document.documentElement.dataset.mariFocusFrameFill;
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      delete document.documentElement.dataset.customTheme;
      delete document.documentElement.dataset.mariAppBackdrop;
      delete document.documentElement.dataset.mariAppBackdropLayers;
      delete document.documentElement.dataset.mariTopBarArt;
      detectThemeChatHooks(null, themeSetsVariable);
    };
  }, [activeTheme, allowed, reduceMotion, stillsReady]);

  // --mari-center-x: the middle of the centre pane, measured from the ambient layer's left edge, so
  // --mari-gutter-mask keeps the chat column clear whichever sidebars are open (theme-tokens.css).
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  useEffect(() => {
    const root = document.documentElement;
    if (!activeTheme || !allowed || root.dataset.mariAmbient === undefined) return;
    let frame = 0;
    const publish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = document.querySelector('[data-component="CenterContent"]');
        const ambient = document.querySelector('[data-mari-part="ambient"]');
        if (!center || !ambient) return;
        const box = center.getBoundingClientRect();
        const x = Math.round(box.left + box.width / 2 - ambient.getBoundingClientRect().left);
        if (root.style.getPropertyValue("--mari-center-x") !== `${x}px`)
          root.style.setProperty("--mari-center-x", `${x}px`);
      });
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    const center = document.querySelector('[data-component="CenterContent"]');
    if (center) observer?.observe(center);
    window.addEventListener("resize", publish);
    const settle = window.setTimeout(publish, 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      observer?.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--mari-center-x");
    };
  }, [activeTheme, allowed, sidebarOpen, rightPanelOpen]);

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
    let cancelled = false;
    // Pictures are read (how see-through they are) before the first check, so a faint one isn't
    // taken for a solid cover.
    let samplesRead = false;
    const samples = preloadImageSamples(document.getElementById(NORMAL_ID)?.textContent ?? "").then(() => {
      samplesRead = true;
    });
    const sheets = () =>
      [NORMAL_ID, IMPORTANT_ID]
        .map((id) => document.getElementById(id) as HTMLStyleElement | null)
        .filter((sheet): sheet is HTMLStyleElement => !!sheet);
    const run = () => {
      timer = null;
      if (!samplesRead) {
        void samples.then(() => !cancelled && schedule(0));
        return;
      }
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
      if (document.documentElement.dataset.mariTopBarArt === undefined && topBarPseudoArt())
        document.documentElement.dataset.mariTopBarArt = "";
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
    // Round 6: windows and the help overlay are portalled into <body>; a theme rule on them (a
    // window title drawn on [role="dialog"]) only shows while one is open, so look then too.
    const overlays = new MutationObserver((records) => {
      const opened = records.some((record) =>
        Array.from(record.addedNodes).some(
          (node) =>
            node instanceof Element &&
            (node.matches('[role="dialog"], [data-mari-app-overlay]') ||
              !!node.querySelector('[role="dialog"], [data-mari-app-overlay]')),
        ),
      );
      if (opened) schedule(800);
    });
    overlays.observe(document.body, { childList: true });
    const onResize = () => schedule(500);
    window.addEventListener("resize", onResize);
    // A rule that waits (an animation delay of 13 s, say) is looked at when it starts or ends,
    // not only at the fixed checks. At most one extra check every 2 s.
    let lastAnimationCheck = 0;
    const themeKeyframes = new Set(
      Array.from(activeTheme.css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g), (match) => match[1]!),
    );
    const onAnimation = (event: AnimationEvent) => {
      if (!themeKeyframes.has(event.animationName)) return;
      const now = Date.now();
      if (now - lastAnimationCheck < 2000) return;
      lastAnimationCheck = now;
      schedule(400);
    };
    document.addEventListener("animationstart", onAnimation, true);
    document.addEventListener("animationend", onAnimation, true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(late);
      clearTimeout(later);
      unsubscribe();
      observer.disconnect();
      overlays.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("animationstart", onAnimation, true);
      document.removeEventListener("animationend", onAnimation, true);
    };
  }, [activeTheme, allowed]);

  return null;
}
