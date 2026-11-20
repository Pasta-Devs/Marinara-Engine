// ──────────────────────────────────────────────
// CustomThemeInjector: Injects the active custom theme.
//
// The theme's rules go in two stylesheets (see index.html for the cascade layers): its normal
// rules unlayered, so they beat the app's layered CSS without !important, and its !important
// rules again in the early mari-theme-important layer, so they beat the app's !important too.
// Safe mode skips both, and the chrome guard switches a theme off for this tab when it hides,
// moves, covers or blanks the top bar, a sidebar or Ctrl+K.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import type { ThemeMeta } from "@marinara-engine/shared";
import { useThemes } from "../../hooks/use-themes";
import { extractImportantThemeCss, sanitizeAppCss, themeSetsVariable } from "../../lib/theme-css";
import { createThemeFontFaces, themeFontFaceCss } from "../../lib/theme-package";
import { installSafeModeShortcut, useThemeSafetyStore } from "../../lib/theme-safety";
import { checkProtectedChrome, topBarPseudoArt } from "../../lib/theme-guard";
import { contentProblemsAsGuard } from "../../lib/theme-content-check";
import { imageSamplesPending, preloadImageSamples, prepareThemeCss } from "../../lib/theme-images";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { themeHasHtml, useThemeTemplates } from "../../lib/theme-template";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulStore } from "../../stores/overhaul.store";
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
  // `full`: keep the full picture column in Conversation chats on phones when Mini pictures are on.
  ["--mari-phone-convo-avatar", "data-mari-phone-convo-avatar", ["full"]],
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
const GUARD_PASSED_STORAGE = "marinara-theme-guard-passed";
/** At most this many remembered layouts (a few kilobytes). */
const GUARD_PASSED_MAX = 120;

function textHash(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** This theme's exact text and pictures plus this app build (its script and style files). */
function guardStoreKey(theme: { id: string; css: string; meta?: ThemeMeta | null }) {
  // The theme's own CSS, pictures, fonts and templates: what the check measures. App updates don't
  // reset it (her call, Nov 14): re-checking every screen after each update made the first taps slow.
  const pictures = [...(theme.meta?.images ?? []), ...(theme.meta?.backgrounds ?? [])]
    .map((picture) => `${picture.name}:${picture.src.length}:${textHash(picture.src.slice(0, 4096))}`)
    .join(",");
  return `${theme.id}|${textHash(theme.css)}|${textHash(pictures)}|${textHash(JSON.stringify([theme.meta?.fonts ?? null, theme.meta?.templates ?? null]))}`;
}

function readPassedLayouts(storeKey: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(GUARD_PASSED_STORAGE) ?? "null") as {
      key?: unknown;
      layouts?: unknown;
    } | null;
    if (!saved || saved.key !== storeKey || !Array.isArray(saved.layouts)) return [];
    return saved.layouts.filter((layout): layout is string => typeof layout === "string");
  } catch {
    return [];
  }
}

function savePassedLayouts(storeKey: string, layouts: Set<string>) {
  try {
    localStorage.setItem(
      GUARD_PASSED_STORAGE,
      JSON.stringify({ key: storeKey, layouts: Array.from(layouts).slice(-GUARD_PASSED_MAX) }),
    );
  } catch {
    /* private mode or full storage: the list just lasts until the page reloads */
  }
}

export function customCssSheets(): HTMLStyleElement[] {
  return Array.from(document.querySelectorAll<HTMLStyleElement>("style[data-mari-custom-css]"));
}

export function CustomThemeInjector() {
  const { data: syncedThemes = [] } = useThemes();
  const overrideId = useActiveThemeOverride();
  const globalTheme = syncedThemes.find((theme) => theme.isActive) ?? null;
  // A chat or its character can pick its own theme (Chat settings > Theme); "" means Default there.
  // A theme being tried ("Keep this theme?") shows in this tab only, over everything else.
  const trialId = useThemeSafetyStore((s) => s.pendingKeep?.themeId ?? null);
  const trialTheme = trialId ? (syncedThemes.find((theme) => theme.id === trialId) ?? null) : null;
  const activeTheme =
    trialTheme ??
    (overrideId === undefined ? globalTheme : (syncedThemes.find((theme) => theme.id === overrideId) ?? null));
  const safeMode = useThemeSafetyStore((s) => s.safeMode);
  const blockedThemeId = useThemeSafetyStore((s) => s.blockedThemeId);
  const allowThemeHtml = useUIStore((s) => s.allowThemeHtml);
  // Settings > Appearance > Profile pictures on phones (overhaul-mobile.css reads it).
  const phoneChatAvatars = useUIStore((s) => s.phoneChatAvatars);
  useEffect(() => {
    document.documentElement.dataset.phoneChatAvatars = phoneChatAvatars;
  }, [phoneChatAvatars]);
  // Settings > Chatting > Message buttons > Always show (overhaul.css reads it; mouse only).
  const messageButtonsAlways = useOverhaulStore((s) => s.messageButtonsAlways);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-ov-msg-buttons-always", messageButtonsAlways);
  }, [messageButtonsAlways]);
  // Security audit: text that pretends to be the app, an address outside the theme, an SVG with
  // code or a picture too big to open: the theme isn't applied at all (lib/theme-content-check.ts).
  const contentProblems = useMemo(() => {
    if (!activeTheme || safeMode) return [];
    const prepared = prepareThemeCss(sanitizeAppCss(`${themeFontFaceCss(activeTheme.meta)}\n${activeTheme.css}`), [
      ...(activeTheme.meta?.images ?? []),
      ...(activeTheme.meta?.backgrounds ?? []),
    ]);
    return contentProblemsAsGuard({
      css: prepared.css,
      rawCss: activeTheme.css,
      meta: activeTheme.meta,
      templates: allowThemeHtml && themeHasHtml(activeTheme.meta),
      name: activeTheme.name,
    });
  }, [activeTheme, safeMode, allowThemeHtml]);
  const allowed = !!activeTheme && !safeMode && blockedThemeId !== activeTheme.id && contentProblems.length === 0;
  useEffect(() => {
    if (activeTheme && contentProblems.length)
      useThemeSafetyStore.getState().blockTheme(activeTheme.id, activeTheme.name, contentProblems);
  }, [activeTheme, contentProblems]);

  useEffect(() => installSafeModeShortcut(), []);

  // The theme's message templates, only when the user allows themes with HTML (lib/theme-template.ts).
  const templates = allowed && allowThemeHtml && themeHasHtml(activeTheme?.meta) ? activeTheme!.meta!.templates! : null;
  useEffect(() => {
    useThemeTemplates.setState({ templates });
  }, [templates]);
  useChatRootHooks();
  useChatArtBehindPanels();
  // Reduce motion (the setting or the system's): moving pictures are swapped for their first frame.
  const reduceMotion = useReducedAmbientEffects();
  const [stillsReady, setStillsReady] = useState(0);

  // The theme's fonts go into document.fonts and finish loading before its CSS goes in, so text is
  // laid out once in the theme's font instead of swapping (iOS Safari left ellipsised text blank after
  // a swap). While they load, the theme on screen stays as it is, and its fonts stay registered.
  const themeMeta = allowed ? (activeTheme?.meta ?? null) : null;
  const [fontsReady, setFontsReady] = useState<{ meta: unknown; viaApi: boolean } | null>(null);
  const liveFaces = useRef<FontFace[]>([]);
  const staleFaces = useRef<FontFace[]>([]);
  useEffect(() => {
    const faces = createThemeFontFaces(themeMeta);
    const swapIn = (viaApi: boolean) => {
      // The previous theme's fonts go once the new CSS is in (the inject effect below), not before.
      staleFaces.current.push(...liveFaces.current.filter((face) => !faces?.includes(face)));
      liveFaces.current = faces ?? [];
      setFontsReady({ meta: themeMeta, viaApi });
    };
    if (!faces || faces.length === 0) {
      swapIn(faces !== null);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      swapIn(true);
    };
    for (const face of faces) document.fonts.add(face);
    void Promise.allSettled(faces.map((face) => face.load())).then(finish);
    // A font that never decodes doesn't hold the theme back.
    const timer = window.setTimeout(finish, 1500);
    return () => {
      window.clearTimeout(timer);
      if (!settled) for (const face of faces) document.fonts.delete(face);
      settled = true;
    };
  }, [themeMeta]);
  useEffect(
    () => () => {
      for (const face of [...liveFaces.current, ...staleFaces.current]) document.fonts.delete(face);
      liveFaces.current = [];
      staleFaces.current = [];
    },
    [],
  );
  const fontsReadyForTheme = fontsReady !== null && fontsReady.meta === themeMeta;
  // What's on screen: the requested theme once its fonts are in, until then the one before it.
  const shownRef = useRef({ theme: activeTheme, allowed, viaApi: false });
  if (fontsReadyForTheme || !activeTheme || !allowed)
    shownRef.current = { theme: activeTheme, allowed, viaApi: fontsReadyForTheme && fontsReady.viaApi };
  const { theme: shownTheme, allowed: shownAllowed, viaApi: fontsViaApi } = shownRef.current;

  // Inject active custom theme CSS
  useEffect(() => {
    for (const face of staleFaces.current) document.fonts.delete(face);
    staleFaces.current = [];
    if (!shownTheme || !shownAllowed) {
      document.getElementById(NORMAL_ID)?.remove();
      document.getElementById(IMPORTANT_ID)?.remove();
      return;
    }
    // A v2 theme's own fonts are already in document.fonts (above); without the FontFace API they go in
    // as @font-face rules ahead of its CSS. Its pictures
    // (`theme:` names and inline data: pictures) become short blob: URLs (lib/theme-images.ts).
    const sanitized = sanitizeAppCss(
      fontsViaApi ? shownTheme.css : `${themeFontFaceCss(shownTheme.meta)}\n${shownTheme.css}`,
    );
    const prepared = prepareThemeCss(
      sanitized,
      [...(shownTheme.meta?.images ?? []), ...(shownTheme.meta?.backgrounds ?? [])],
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
    document.documentElement.dataset.customTheme = shownTheme.id;
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
    for (const [token, attribute, shownAllowed] of THEME_VALUE_TOKENS) {
      const value = themeTokenKeyword(css, token, shownAllowed);
      if (value) document.documentElement.setAttribute(attribute, value);
      else document.documentElement.removeAttribute(attribute);
    }
    detectThemeChatHooks(css, themeSetsVariable);
    // Slots the app renders only on request (lib/theme-slots.ts), and where the ambient layer sits.
    useThemeSlots.setState({
      windowTitles: themeSetsVariable(css, "--mari-window-title"),
      chatRowPreviews: themeSetsVariable(css, "--mari-chat-row-preview"),
    });
    if (/(^|[\s;{])--mari-ambient-placement\s*:\s*behind-cards\b/.test(css))
      document.documentElement.dataset.mariAmbientBehind = "";
    else delete document.documentElement.dataset.mariAmbientBehind;

    return () => {
      cancelAnimationFrame(barArtFrame);
      useThemeSlots.setState({ windowTitles: false, chatRowPreviews: false });
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
  }, [shownTheme, shownAllowed, reduceMotion, stillsReady, fontsViaApi]);

  // --mari-center-x: the middle of the centre pane, measured from the ambient layer's left edge, so
  // --mari-gutter-mask keeps the chat column clear whichever sidebars are open (theme-tokens.css).
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  useEffect(() => {
    const root = document.documentElement;
    if (!activeTheme || !allowed || root.dataset.mariAmbient === undefined) return;
    let frame = 0;
    let wait = 0;
    // Each write to <html> re-styles the whole page, so while panels open or the chat reflows (Chat
    // settings docking) the value is written once things have settled, not on every frame (GV13).
    const publish = () => {
      window.clearTimeout(wait);
      wait = window.setTimeout(publishNow, 160);
    };
    const publishNow = () => {
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
    if (root.style.getPropertyValue("--mari-center-x")) publish();
    else publishNow();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    const center = document.querySelector('[data-component="CenterContent"]');
    if (center) observer?.observe(center);
    window.addEventListener("resize", publish);
    const settle = window.setTimeout(publish, 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.clearTimeout(wait);
      observer?.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [activeTheme, allowed, sidebarOpen, rightPanelOpen]);
  // Cleared only when the theme changes or goes, not each time a panel opens (the mask would jump to the
  // middle and the page be re-styled twice).
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--mari-center-x");
    },
    [activeTheme, allowed],
  );

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
    let pictureWaits = 0;
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
    // The check re-styles and re-measures the whole page twice, a long freeze on a tablet with a big
    // library (1-5 s per tap on an iPad, Nov 14). A layout it has already passed for this theme (same
    // panels, windows, chat mode, colour scheme, window size) isn't checked again when you come back
    // to it; the timed checks and a theme animation starting still always check. A transition that waits
    // can't slip past this: themes with one are refused before they apply (lib/theme-content-check.ts).
    // The passed layouts are remembered on this device for this exact theme and app build, so a reload
    // doesn't pay for every screen again; editing the theme or updating the app starts the list over.
    const passedStoreKey = guardStoreKey(activeTheme);
    const passedLayouts = new Set<string>(readPassedLayouts(passedStoreKey));
    const layoutKey = () => {
      const root = document.documentElement;
      const ui = useUIStore.getState();
      const windows = Array.from(document.querySelectorAll('[role="dialog"], [data-mari-app-overlay]'))
        .map((element) => element.getAttribute("data-component") ?? element.getAttribute("aria-label") ?? "w")
        .sort()
        .join(",");
      return [
        ui.sidebarOpen,
        ui.rightPanelOpen,
        ui.omnibarOpen,
        root.hasAttribute("data-chat-id"),
        root.getAttribute("data-chat-open-mode"),
        root.getAttribute("data-theme"),
        root.getAttribute("data-ov-topbar-autohide"),
        root.getAttribute("data-visual-theme"),
        root.hasAttribute("data-mari-page-covers"),
        Math.round(window.innerWidth / 50),
        Math.round(window.innerHeight / 50),
        windows,
      ].join("|");
    };
    let forceNext = false;
    const run = () => {
      timer = null;
      if (!samplesRead) {
        void samples.then(() => !cancelled && schedule(0, forceNext));
        return;
      }
      const key = layoutKey();
      if (!forceNext && !confirming && passedLayouts.has(key)) return;
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
      // Docked Chat settings still making room for itself (its window is there, the chat hasn't
      // reflowed yet): the check re-styles the whole page and would hold the reflow up (GV13).
      const docking =
        !!document.querySelector(".mari-window.ov-cs--docked") && !document.querySelector("[data-cs-docked]");
      if ((moving || docking) && retries < 5) {
        retries += 1;
        schedule(400);
        return;
      }
      retries = 0;
      // The sheet can be rewritten after it lands (Reduce motion swaps moving pictures for still
      // frames, with new blob: URLs). A picture not read yet counts as solid, so wait for this
      // sheet's pictures (up to 10 s more) rather than take rain for a wall.
      const current = sheets()
        .map((sheet) => sheet.textContent ?? "")
        .join("\n");
      if (imageSamplesPending(current) && pictureWaits < 20) {
        pictureWaits += 1;
        schedule(500);
        return;
      }
      if (document.documentElement.dataset.mariTopBarArt === undefined && topBarPseudoArt())
        document.documentElement.dataset.mariTopBarArt = "";
      const problems = checkProtectedChrome(sheets());
      forceNext = false;
      if (problems.length === 0) {
        confirming = false;
        passedLayouts.add(key);
        savePassedLayouts(passedStoreKey, passedLayouts);
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
    // The check is one long task (it re-styles the page with the theme off and on), so it waits for the
    // page to be idle as well as for the delay: never in the middle of a panel or window opening (GV13).
    let idle = 0;
    const cancelIdle = () => {
      if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      idle = 0;
    };
    // Safari has no requestIdleCallback: there the check waits until no tap, click or key for 1.2 s,
    // so it never lands on the frames right after a tap.
    let lastInput = 0;
    const onInput = () => {
      lastInput = performance.now();
    };
    window.addEventListener("pointerdown", onInput, { capture: true, passive: true });
    window.addEventListener("keydown", onInput, { capture: true, passive: true });
    const schedule = (delay: number, force = false) => {
      if (force) forceNext = true;
      if (timer) clearTimeout(timer);
      cancelIdle();
      timer = setTimeout(() => {
        if (typeof requestIdleCallback !== "function") {
          const quietFor = performance.now() - lastInput;
          if (quietFor < 1200) return schedule(1200 - quietFor);
          return run();
        }
        idle = requestIdleCallback(
          () => {
            idle = 0;
            run();
          },
          { timeout: 1500 },
        );
      }, delay);
    };
    schedule(700, true);
    const late = setTimeout(() => schedule(0, true), 2500);
    const later = setTimeout(() => schedule(0, true), 10_000);
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
      schedule(400, true);
    };
    document.addEventListener("animationstart", onAnimation, true);
    document.addEventListener("animationend", onAnimation, true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      cancelIdle();
      clearTimeout(late);
      clearTimeout(later);
      unsubscribe();
      observer.disconnect();
      overlays.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onInput, { capture: true });
      window.removeEventListener("keydown", onInput, { capture: true });
      document.removeEventListener("animationstart", onAnimation, true);
      document.removeEventListener("animationend", onAnimation, true);
    };
  }, [activeTheme, allowed]);

  // A theme's endless animations (rain, rising bubbles, falling leaves) stop while the app is in the
  // background or another window has focus, like the app's own ambient effects do; they carry on
  // from where they were on return. Battery QC round 2 (Nov 14).
  useEffect(() => {
    if (!activeTheme || !allowed) return;
    const names = new Set(
      Array.from(activeTheme.css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g), (match) => match[1]!),
    );
    if (names.size === 0 || typeof document.getAnimations !== "function") return;
    const paused = new Set<Animation>();
    const themeAnimations = () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation instanceof CSSAnimation &&
            names.has(animation.animationName) &&
            animation.effect?.getComputedTiming().iterations === Infinity,
        );
    const sync = () => {
      if (document.documentElement.dataset.marinaraEffectsPaused === "true") {
        for (const animation of themeAnimations()) {
          if (animation.playState !== "running") continue;
          animation.pause();
          paused.add(animation);
        }
      } else {
        for (const animation of paused) if (animation.playState === "paused") animation.play();
        paused.clear();
      }
    };
    sync();
    window.addEventListener("marinara:effects-paused", sync);
    return () => {
      window.removeEventListener("marinara:effects-paused", sync);
      for (const animation of paused) if (animation.playState === "paused") animation.play();
    };
  }, [activeTheme, allowed]);

  return null;
}
