// ──────────────────────────────────────────────
// App: Root component with layout
// ──────────────────────────────────────────────
import { Component, lazy, Suspense, useEffect, useMemo, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { APP_VERSION } from "@marinara-engine/shared";
import { CustomThemeInjector } from "./components/layout/CustomThemeInjector";
import { ModelDownloadModal } from "./components/modals/ModelDownloadModal";
import { AppDialogRenderer } from "./components/ui/AppDialogRenderer";
import { ChibiProfessorMariEasterEgg } from "./components/ui/ChibiProfessorMariEasterEgg";
import { CsrfOriginWarningBanner } from "./components/diagnostics/CsrfOriginWarningBanner";
import { Toaster, toast } from "sonner";
import {
  getDefaultAppAccentColor,
  getDefaultAppBackgroundColor,
  getDefaultChatChromeTextColor,
  useUIStore,
} from "./stores/ui.store";
import { useSidecarStore } from "./stores/sidecar.store";
import { api } from "./lib/api-client";
import { forceRefreshSpa } from "./lib/browser-runtime";
import {
  getCssColorFallback,
  getCssGradientColorStops,
  isCssGradient,
  RAINBOW_GRADIENT_PRESET,
} from "./lib/css-colors";
import { normalizeThemeCss } from "./lib/theme-css";
import { useLegacyThemeMigration, useThemes } from "./hooks/use-themes";
import { useLegacyExtensionMigration } from "./hooks/use-extensions";
import { useSettingsSync } from "./hooks/use-settings-sync";
import { installLongTaskWarner } from "./lib/perf-diagnostics";

const VERSION_RECOVERY_KEY = "marinara:pwa-version-recovery";
const VERSION_CHECK_INTERVAL_MS = 5 * 60_000;
const LazyModalRenderer = lazy(() =>
  import("./components/layout/ModalRenderer").then((module) => ({ default: module.ModalRenderer })),
);
const LazyAppShell = lazy(() =>
  import("./components/layout/AppShell").then((module) => ({ default: module.AppShell })),
);

type HealthResponse = {
  status: string;
  timestamp: string;
  version: string;
};

type CustomFontFace = {
  filename: string;
  family: string;
  url: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
};

const registeredCustomFontFaceKeys = new Set<string>();
const APP_ACCENT_CUSTOM_VARIABLES = [
  "--primary",
  "--ring",
  "--accent",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--glow-primary",
  "--marinara-app-accent-solid",
  "--marinara-app-accent-gradient",
  "--marinara-chat-chrome-accent",
  "--marinara-chat-chrome-accent-gradient",
] as const;
const ACCENT_RGB_TICK_MS = 500;
const ACCENT_RGB_SOLID_CYCLE_MS = 7_200;
const ACCENT_RGB_GRADIENT_STOP_MS = 6_000;
const CUSTOM_CURSOR_ANIMATED_RECOLOR_MS = 6_000;
const CUSTOM_CURSOR_RECOLOR_SCROLL_FREEZE_MS = 360;
const TOAST_DURATION_MS = 6_000;
const TOAST_VISIBLE_LIMIT = 3;
const THEME_ACCENT_PULSE_VARIABLE = "--marinara-theme-accent-pulse";
const THEME_ACCENT_PULSE_SOURCE_VARIABLE = "--marinara-theme-accent-pulse-source";
const THEME_ACCENT_PULSE_ENABLED_VALUES = new Set(["1", "true", "yes", "on", "enabled", "enable", "pulse"]);
const ACCENT_SOURCE_SELF_REFERENCE_RE =
  /var\(\s*--(?:primary|ring|accent|sidebar-accent|sidebar-accent-foreground|marinara-app-accent-solid|marinara-app-accent-gradient|marinara-chat-chrome-accent|marinara-chat-chrome-accent-gradient)\b/i;

function formatRecoveryError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? "Unknown render error";
  } catch {
    return String(error);
  }
}

function getRecoveryChromeTextStyle(): CSSProperties | undefined {
  const { chatChromeTextColor, theme } = useUIStore.getState();
  const textColor = chatChromeTextColor.trim();
  if (!textColor) return undefined;

  return {
    "--marinara-chat-chrome-text": getCssColorFallback(textColor, getDefaultChatChromeTextColor(theme)),
  } as CSSProperties;
}

export class AppRecoveryBoundary extends Component<{ children: ReactNode }, { error: unknown; hasError: boolean }> {
  state: { error: unknown; hasError: boolean } = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[AppRecoveryBoundary] Unhandled render error", error, info.componentStack);
  }

  private resetLocalUiState = () => {
    try {
      window.localStorage.removeItem("marinara-engine-ui");
      window.localStorage.removeItem("marinara-active-chat-id");
      window.localStorage.removeItem("marinara-input-drafts");
      window.sessionStorage.removeItem("marinara-input-drafts");
    } catch {
      /* ignore storage reset errors */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const errorMessage = formatRecoveryError(this.state.error);
    const recoveryChromeTextStyle = getRecoveryChromeTextStyle();

    return (
      <div
        className="mari-chrome-token-scope flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--marinara-chat-chrome-panel-text)]"
        style={recoveryChromeTextStyle}
      >
        <div className="w-full max-w-lg rounded-xl border border-[var(--marinara-chat-chrome-accent)] bg-[var(--marinara-chat-chrome-panel-bg)] p-5 shadow-2xl ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]">
          <h1 className="text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            Marinara hit a recoverable UI error.
          </h1>
          <p className="mt-2 text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
            The app shell crashed while rendering. Reload first; reset local UI state only if the same screen keeps
            returning after restart.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-2 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            {errorMessage}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mari-chrome-control mari-chrome-control--selected px-3 py-2 text-sm"
            >
              Reload
            </button>
            <button type="button" onClick={this.resetLocalUiState} className="mari-chrome-control px-3 py-2 text-sm">
              Reset local UI state
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function stripFontFamilyQuotes(family: string): string {
  const trimmed = family.trim();
  if (trimmed.length < 2) return trimmed;

  const quote = trimmed[0];
  if ((quote !== `"` && quote !== `'`) || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
}

function toCssFontFamilyValue(family: string): string {
  const cleanFamily = stripFontFamilyQuotes(family);
  return `"${cleanFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function customFontFaceKey(family: string, font: CustomFontFace): string {
  return [family, font.url, font.weight ?? "400", font.style ?? "normal", font.unicodeRange ?? ""].join("|");
}

function syncRangeSliderProgress(input: HTMLInputElement) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const span = max - min;
  const percent = Number.isFinite(span) && span > 0 ? ((value - min) / span) * 100 : 0;
  input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
}

function escapeSvgAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let cursorColorProbe: HTMLSpanElement | null = null;
let cursorCanvasContext: CanvasRenderingContext2D | null | undefined;

function clampCursorColorByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseCursorColorChannel(value: string, scaleUnit: boolean) {
  const clean = value.trim();
  if (!clean) return null;

  if (clean.endsWith("%")) {
    const percent = Number(clean.slice(0, -1));
    return Number.isFinite(percent) ? clampCursorColorByte((percent / 100) * 255) : null;
  }

  const channel = Number(clean);
  if (!Number.isFinite(channel)) return null;
  return clampCursorColorByte(scaleUnit ? channel * 255 : channel);
}

function parseCursorColorChannels(value: string, scaleUnit: boolean) {
  const clean = value.replace(/\s*\/\s*[^,\s)]+/g, " ").trim();
  const channels = clean.split(/\s*,\s*|\s+/).filter(Boolean);
  if (channels.length < 3) return null;

  const red = parseCursorColorChannel(channels[0], scaleUnit);
  const green = parseCursorColorChannel(channels[1], scaleUnit);
  const blue = parseCursorColorChannel(channels[2], scaleUnit);
  if (red === null || green === null || blue === null) return null;

  return `rgb(${red} ${green} ${blue})`;
}

function normalizeCursorColorWithCanvas(color: string) {
  if (typeof document === "undefined") return "";
  if (cursorCanvasContext === undefined) {
    cursorCanvasContext = document.createElement("canvas").getContext("2d");
  }
  if (!cursorCanvasContext) return "";

  cursorCanvasContext.fillStyle = "#010203";
  cursorCanvasContext.fillStyle = color;
  return cursorCanvasContext.fillStyle === "#010203" ? "" : cursorCanvasContext.fillStyle;
}

function normalizeCursorColorForSvg(color: string, fallback: string) {
  const clean = color.trim();
  if (!clean) return fallback;

  const rgbMatch = clean.match(/^rgba?\(\s*(.*?)\s*\)$/i);
  if (rgbMatch) return parseCursorColorChannels(rgbMatch[1], false) ?? fallback;

  const srgbMatch = clean.match(/^color\(\s*srgb\s+(.*?)\s*\)$/i);
  if (srgbMatch) return parseCursorColorChannels(srgbMatch[1], true) ?? fallback;

  return normalizeCursorColorWithCanvas(clean) || clean;
}

function resolveCursorColor(color: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  if (!cursorColorProbe) {
    cursorColorProbe = document.createElement("span");
    cursorColorProbe.setAttribute("aria-hidden", "true");
    cursorColorProbe.style.position = "fixed";
    cursorColorProbe.style.pointerEvents = "none";
    cursorColorProbe.style.visibility = "hidden";
    cursorColorProbe.style.width = "0";
    cursorColorProbe.style.height = "0";
    document.body.appendChild(cursorColorProbe);
  } else if (!cursorColorProbe.isConnected) {
    document.body.appendChild(cursorColorProbe);
  }

  cursorColorProbe.style.color = "";
  cursorColorProbe.style.color = color;
  if (!cursorColorProbe.style.color) return fallback;

  return normalizeCursorColorForSvg(getComputedStyle(cursorColorProbe).color, fallback);
}

function getAccentCursorColors(accent: string, theme: "dark" | "light") {
  const fill = resolveCursorColor(accent, theme === "light" ? "#e0709a" : "#d4acfb");
  const stroke = theme === "light" ? "#1a1025" : "#050312";

  return { fill, stroke };
}

function getAccentCursorValue(fill: string, stroke: string) {
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L10 20L12 12L20 10L3 3Z" fill="${escapeSvgAttribute(fill)}" stroke="${stroke}" stroke-width="1"/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 3`;
}

function setAccentCursorVariable(root: HTMLElement, accent: string, theme: "dark" | "light") {
  const { fill, stroke } = getAccentCursorColors(accent, theme);
  const nextCursor = getAccentCursorValue(fill, stroke);

  root.style.setProperty("--marinara-custom-cursor-fill", fill);
  root.style.setProperty("--marinara-custom-cursor-stroke", stroke);
  root.style.setProperty("--cursor-pink", nextCursor);
}

function getSolidAccentGradient(accent: string) {
  return `linear-gradient(90deg, color-mix(in srgb, ${accent} 72%, var(--background) 28%), ${accent}, color-mix(in srgb, ${accent} 76%, var(--foreground) 24%), ${accent})`;
}

function getAccentSurface(accent: string, theme: "dark" | "light") {
  return `color-mix(in srgb, var(--secondary) ${theme === "light" ? "84%" : "78%"}, ${accent} ${
    theme === "light" ? "16%" : "22%"
  })`;
}

function getAccentGlow(accent: string, theme: "dark" | "light") {
  return `color-mix(in srgb, ${accent} ${theme === "light" ? "12%" : "18%"}, transparent)`;
}

function stripCssComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCssCustomProperty(css: string, name: string) {
  const match = css.match(new RegExp(`${escapeRegExp(name)}\\s*:\\s*([^;{}\\n\\r]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function isEnabledCssValue(value: string) {
  return THEME_ACCENT_PULSE_ENABLED_VALUES.has(value.trim().toLowerCase());
}

function getFirstThemeAccentSource(css: string) {
  const sourceCandidates = [
    readCssCustomProperty(css, THEME_ACCENT_PULSE_SOURCE_VARIABLE),
    readCssCustomProperty(css, "--marinara-app-accent-gradient"),
    readCssCustomProperty(css, "--marinara-app-accent-solid"),
    readCssCustomProperty(css, "--primary"),
  ];

  return sourceCandidates.find((value) => value && !ACCENT_SOURCE_SELF_REFERENCE_RE.test(value)) ?? "";
}

function getThemeAccentPulseConfig(css: string | null | undefined) {
  const normalizedCss = stripCssComments(normalizeThemeCss(css ?? ""));
  const enabled = isEnabledCssValue(readCssCustomProperty(normalizedCss, THEME_ACCENT_PULSE_VARIABLE));

  return {
    enabled,
    source: enabled ? getFirstThemeAccentSource(normalizedCss) : "",
  };
}

function applyAppAccentVariables({
  root,
  accent,
  gradient,
  surfaceAccent,
  theme,
  updateCursor = true,
}: {
  root: HTMLElement;
  accent: string;
  gradient: string;
  surfaceAccent: string;
  theme: "dark" | "light";
  updateCursor?: boolean;
}) {
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--accent", getAccentSurface(surfaceAccent, theme));
  root.style.setProperty("--sidebar-accent", `color-mix(in srgb, ${surfaceAccent} 12%, transparent)`);
  root.style.setProperty("--sidebar-accent-foreground", accent);
  root.style.setProperty("--glow-primary", getAccentGlow(surfaceAccent, theme));
  root.style.setProperty("--marinara-app-accent-solid", accent);
  root.style.setProperty("--marinara-app-accent-gradient", gradient);
  root.style.setProperty("--marinara-chat-chrome-accent", accent);
  root.style.setProperty("--marinara-chat-chrome-accent-gradient", gradient);
  if (updateCursor) setAccentCursorVariable(root, accent, theme);
}

function getSolidRgbAccent(accent: string) {
  const wave = Math.sin((performance.now() / ACCENT_RGB_SOLID_CYCLE_MS) * Math.PI * 2);
  const mixAmount = Math.abs(wave) * 36;
  const target = wave >= 0 ? "var(--foreground)" : "var(--background)";
  return `color-mix(in srgb, ${accent} ${(100 - mixAmount).toFixed(2)}%, ${target} ${mixAmount.toFixed(2)}%)`;
}

function getGradientRgbAccent(stops: string[]) {
  if (stops.length <= 1) return stops[0] ?? "var(--primary)";

  const cycleMs = Math.max(ACCENT_RGB_GRADIENT_STOP_MS * stops.length, 9_000);
  const position = ((performance.now() % cycleMs) / cycleMs) * stops.length;
  const fromIndex = Math.floor(position) % stops.length;
  const toIndex = (fromIndex + 1) % stops.length;
  const rawProgress = position - Math.floor(position);
  const easedProgress = (1 - Math.cos(rawProgress * Math.PI)) / 2;
  const fromPercent = (100 - easedProgress * 100).toFixed(2);
  const toPercent = (easedProgress * 100).toFixed(2);

  return `color-mix(in srgb, ${stops[fromIndex]} ${fromPercent}%, ${stops[toIndex]} ${toPercent}%)`;
}

function clearCustomAppAccentVariables(root: HTMLElement) {
  APP_ACCENT_CUSTOM_VARIABLES.forEach((variable) => root.style.removeProperty(variable));
}

function canRunAccentAnimation(reducedMotionQuery: MediaQueryList, forcePaused = false) {
  return document.visibilityState === "visible" && document.hasFocus() && !reducedMotionQuery.matches && !forcePaused;
}

async function recoverFromVersionSkew(serverVersion: string) {
  if (sessionStorage.getItem(VERSION_RECOVERY_KEY) === serverVersion) {
    return;
  }

  sessionStorage.setItem(VERSION_RECOVERY_KEY, serverVersion);
  await forceRefreshSpa({
    queryParamKey: "v",
    queryParamValue: serverVersion,
  });
}

export function App() {
  const theme = useUIStore((s) => s.theme);
  const isLite = import.meta.env.VITE_MARINARA_LITE === "true";
  const fontSize = useUIStore((s) => s.fontSize);
  const language = useUIStore((s) => s.language);
  const visualTheme = useUIStore((s) => s.visualTheme);
  const fontFamily = useUIStore((s) => s.fontFamily);
  const appBackgroundColor = useUIStore((s) => s.appBackgroundColor);
  const appAccentColor = useUIStore((s) => s.appAccentColor);
  const appAccentPulseMode = useUIStore((s) => s.appAccentPulseMode);
  const appAccentRgbMode = useUIStore((s) => s.appAccentRgbMode);
  const customCursorEnabled = useUIStore((s) => s.customCursorEnabled);
  const chatChromeTextColor = useUIStore((s) => s.chatChromeTextColor);
  const hasModalOpen = useUIStore((s) => s.modal !== null);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const settingsTab = useUIStore((s) => s.settingsTab);
  const appearanceSettingsActive = rightPanelOpen && rightPanel === "settings" && settingsTab === "appearance";
  const pauseChromeEffectsForAppearance = appearanceSettingsActive && !appAccentRgbMode;
  const { data: syncedThemes = [] } = useThemes();
  const activeCustomTheme = useMemo(() => syncedThemes.find((themeItem) => themeItem.isActive) ?? null, [syncedThemes]);
  const themeAccentPulseConfig = useMemo(
    () => getThemeAccentPulseConfig(activeCustomTheme?.css),
    [activeCustomTheme?.css],
  );
  useLegacyThemeMigration();
  useLegacyExtensionMigration();
  useSettingsSync();
  const showDownloadModal = useSidecarStore((s) => s.showDownloadModal);
  const setShowDownloadModal = useSidecarStore((s) => s.setShowDownloadModal);
  const fetchSidecarStatus = useSidecarStore((s) => s.fetchStatus);

  // [#3104 diagnostic] warn on long main-thread tasks (see lib/perf-diagnostics.ts)
  useEffect(() => {
    installLongTaskWarner();
  }, []);

  useEffect(() => {
    const syncAll = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
    };
    const syncNode = (node: Node) => {
      if (node instanceof HTMLInputElement && node.type === "range") {
        syncRangeSliderProgress(node);
        return;
      }
      if (node instanceof Element) {
        node.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
      }
    };
    const syncEventTarget = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === "range") {
        syncRangeSliderProgress(event.target);
      }
    };

    syncAll();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(syncNode);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", syncEventTarget, true);
    document.addEventListener("change", syncEventTarget, true);
    document.addEventListener("focusin", syncEventTarget, true);
    document.addEventListener("pointerover", syncEventTarget, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("input", syncEventTarget, true);
      document.removeEventListener("change", syncEventTarget, true);
      document.removeEventListener("focusin", syncEventTarget, true);
      document.removeEventListener("pointerover", syncEventTarget, true);
    };
  }, []);

  // Fetch sidecar status on mount so the Local AI card is populated when opened later.
  useEffect(() => {
    if (!isLite) void fetchSidecarStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme + font size to the document root whenever they change
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (customCursorEnabled) {
      root.dataset.marinaraCustomCursor = "enabled";
    } else {
      delete root.dataset.marinaraCustomCursor;
    }
  }, [customCursorEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    const background = appBackgroundColor.trim();
    const defaultBackground = getDefaultAppBackgroundColor(theme);

    if (background) {
      root.style.setProperty("--background", getCssColorFallback(background, defaultBackground));
      root.style.setProperty("--marinara-app-background-paint", background);
    } else {
      root.style.removeProperty("--background");
      root.style.removeProperty("--marinara-app-background-paint");
    }
  }, [appBackgroundColor, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const syncEffectsPausedState = () => {
      if (document.visibilityState === "visible" && document.hasFocus() && !pauseChromeEffectsForAppearance) {
        delete root.dataset.marinaraEffectsPaused;
      } else {
        root.dataset.marinaraEffectsPaused = "true";
      }
    };

    syncEffectsPausedState();
    document.addEventListener("visibilitychange", syncEffectsPausedState);
    window.addEventListener("focus", syncEffectsPausedState);
    window.addEventListener("blur", syncEffectsPausedState);
    window.addEventListener("pageshow", syncEffectsPausedState);
    window.addEventListener("pagehide", syncEffectsPausedState);

    return () => {
      document.removeEventListener("visibilitychange", syncEffectsPausedState);
      window.removeEventListener("focus", syncEffectsPausedState);
      window.removeEventListener("blur", syncEffectsPausedState);
      window.removeEventListener("pageshow", syncEffectsPausedState);
      window.removeEventListener("pagehide", syncEffectsPausedState);
      delete root.dataset.marinaraEffectsPaused;
    };
  }, [pauseChromeEffectsForAppearance]);

  useEffect(() => {
    const root = document.documentElement;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const accent = appAccentColor.trim();
    const defaultAccent = getDefaultAppAccentColor(theme);
    const accentSource = themeAccentPulseConfig.source || accent || defaultAccent;
    const solidAccent = getCssColorFallback(accentSource, defaultAccent);
    const accentIsGradient = isCssGradient(accentSource);
    const animatedAccentSource = appAccentRgbMode ? RAINBOW_GRADIENT_PRESET : accentSource;
    const animatedSolidAccent = getCssColorFallback(animatedAccentSource, solidAccent);
    const animatedAccentIsGradient = isCssGradient(animatedAccentSource);
    const animatedGradientStops = animatedAccentIsGradient
      ? getCssGradientColorStops(animatedAccentSource, animatedSolidAccent)
      : [animatedSolidAccent];
    const accentAnimationEnabled = appAccentRgbMode || appAccentPulseMode || themeAccentPulseConfig.enabled;

    let accentAnimationTimer: ReturnType<typeof window.setTimeout> | null = null;
    let cursorRecolorFreezeTimer: ReturnType<typeof window.setTimeout> | null = null;
    let cursorRecolorFrozen = false;
    let pendingCursorAccent: string | null = null;
    let lastCursorRecolorAt = 0;

    const applyCursorAccent = (cursorAccent: string, options: { slow?: boolean } = {}) => {
      if (!customCursorEnabled) {
        pendingCursorAccent = null;
        return;
      }
      if (customCursorEnabled && cursorRecolorFrozen) {
        pendingCursorAccent = cursorAccent;
        return;
      }
      if (customCursorEnabled && options.slow && lastCursorRecolorAt > 0) {
        const now = performance.now();
        if (now - lastCursorRecolorAt < CUSTOM_CURSOR_ANIMATED_RECOLOR_MS) {
          pendingCursorAccent = cursorAccent;
          return;
        }
      }
      pendingCursorAccent = null;
      lastCursorRecolorAt = performance.now();
      setAccentCursorVariable(root, cursorAccent, theme);
    };

    const unfreezeCursorRecolor = () => {
      if (cursorRecolorFreezeTimer !== null) {
        window.clearTimeout(cursorRecolorFreezeTimer);
        cursorRecolorFreezeTimer = null;
      }
      cursorRecolorFrozen = false;
      delete root.dataset.marinaraCursorRecolorFrozen;
      if (pendingCursorAccent !== null) {
        const nextCursorAccent = pendingCursorAccent;
        pendingCursorAccent = null;
        applyCursorAccent(nextCursorAccent, { slow: accentAnimationEnabled });
      }
    };

    const freezeCursorRecolorDuringScroll = () => {
      if (!customCursorEnabled) return;
      cursorRecolorFrozen = true;
      root.dataset.marinaraCursorRecolorFrozen = "true";
      if (cursorRecolorFreezeTimer !== null) {
        window.clearTimeout(cursorRecolorFreezeTimer);
      }
      cursorRecolorFreezeTimer = window.setTimeout(unfreezeCursorRecolor, CUSTOM_CURSOR_RECOLOR_SCROLL_FREEZE_MS);
    };

    const setAccentModeDataset = () => {
      if (accentIsGradient) {
        root.dataset.marinaraChatChromeAccentMode = "gradient";
      } else {
        delete root.dataset.marinaraChatChromeAccentMode;
      }
    };

    const applyStaticAccent = () => {
      if (!accent) {
        clearCustomAppAccentVariables(root);
        applyCursorAccent("var(--primary)");
        setAccentModeDataset();
        return;
      }

      applyAppAccentVariables({
        root,
        accent: solidAccent,
        gradient: accentIsGradient ? accentSource : getSolidAccentGradient(solidAccent),
        surfaceAccent: solidAccent,
        theme,
        updateCursor: false,
      });
      applyCursorAccent(solidAccent);
      setAccentModeDataset();
    };

    const applyLiveAccent = () => {
      const liveAccent =
        animatedAccentIsGradient && animatedGradientStops.length > 1
          ? getGradientRgbAccent(animatedGradientStops)
          : getSolidRgbAccent(animatedSolidAccent);

      applyAppAccentVariables({
        root,
        accent: liveAccent,
        gradient: getSolidAccentGradient(liveAccent),
        surfaceAccent: accentIsGradient ? solidAccent : liveAccent,
        theme,
        updateCursor: false,
      });
      applyCursorAccent(liveAccent, { slow: true });
      setAccentModeDataset();
    };

    const stopAccentAnimation = () => {
      if (accentAnimationTimer !== null) {
        window.clearTimeout(accentAnimationTimer);
        accentAnimationTimer = null;
      }
      delete root.dataset.marinaraAccentAnimation;
      applyStaticAccent();
    };

    const queueAccentAnimationTick = () => {
      if (accentAnimationTimer !== null) return;

      accentAnimationTimer = window.setTimeout(() => {
        accentAnimationTimer = null;
        if (!accentAnimationEnabled || !canRunAccentAnimation(reducedMotionQuery, pauseChromeEffectsForAppearance)) {
          stopAccentAnimation();
          return;
        }

        applyLiveAccent();
        queueAccentAnimationTick();
      }, ACCENT_RGB_TICK_MS);
    };

    const startAccentAnimation = () => {
      root.dataset.marinaraAccentAnimation =
        animatedAccentIsGradient && animatedGradientStops.length > 1 ? "gradient" : "solid";
      applyLiveAccent();
      queueAccentAnimationTick();
    };

    const syncAccentAnimationState = () => {
      if (accentAnimationEnabled && canRunAccentAnimation(reducedMotionQuery, pauseChromeEffectsForAppearance)) {
        startAccentAnimation();
      } else {
        stopAccentAnimation();
      }
    };

    const handleVisibilityChange = () => {
      syncAccentAnimationState();
    };

    if (!accentAnimationEnabled) {
      applyStaticAccent();
    }
    syncAccentAnimationState();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", syncAccentAnimationState);
    window.addEventListener("blur", syncAccentAnimationState);
    window.addEventListener("pageshow", syncAccentAnimationState);
    window.addEventListener("pagehide", syncAccentAnimationState);
    if (customCursorEnabled) {
      window.addEventListener("wheel", freezeCursorRecolorDuringScroll, { capture: true, passive: true });
    }
    reducedMotionQuery.addEventListener("change", syncAccentAnimationState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", syncAccentAnimationState);
      window.removeEventListener("blur", syncAccentAnimationState);
      window.removeEventListener("pageshow", syncAccentAnimationState);
      window.removeEventListener("pagehide", syncAccentAnimationState);
      if (customCursorEnabled) {
        window.removeEventListener("wheel", freezeCursorRecolorDuringScroll, true);
      }
      reducedMotionQuery.removeEventListener("change", syncAccentAnimationState);
      if (accentAnimationTimer !== null) {
        window.clearTimeout(accentAnimationTimer);
      }
      if (cursorRecolorFreezeTimer !== null) {
        window.clearTimeout(cursorRecolorFreezeTimer);
      }
      delete root.dataset.marinaraAccentAnimation;
      delete root.dataset.marinaraCursorRecolorFrozen;
    };
  }, [
    appAccentColor,
    appAccentPulseMode,
    appAccentRgbMode,
    customCursorEnabled,
    pauseChromeEffectsForAppearance,
    theme,
    themeAccentPulseConfig.enabled,
    themeAccentPulseConfig.source,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    const textColor = chatChromeTextColor.trim();
    const variables = ["--marinara-chat-chrome-text"];

    if (textColor) {
      const resolvedColor = getCssColorFallback(textColor, getDefaultChatChromeTextColor(theme));
      variables.forEach((variable) => root.style.setProperty(variable, resolvedColor));
    } else {
      variables.forEach((variable) => root.style.removeProperty(variable));
    }
  }, [chatChromeTextColor, theme]);

  // Apply visual theme (default / sillytavern) to the document root
  useEffect(() => {
    if (visualTheme && visualTheme !== "default") {
      document.documentElement.dataset.visualTheme = visualTheme;
    } else {
      delete document.documentElement.dataset.visualTheme;
    }
  }, [visualTheme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          return;
        }

        const health = (await res.json()) as HealthResponse;
        if (cancelled) {
          return;
        }

        if (health.version === APP_VERSION) {
          sessionStorage.removeItem(VERSION_RECOVERY_KEY);
          return;
        }

        await recoverFromVersionSkew(health.version);
      } catch {
        // Ignore version checks when the network is unavailable.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    void checkVersion();
    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    window.addEventListener("pageshow", checkVersion);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("pageshow", checkVersion);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Apply custom font family via CSS variable
  useEffect(() => {
    const family = fontFamily ? stripFontFamilyQuotes(fontFamily) : "";
    if (family) {
      document.documentElement.style.setProperty("--font-user", toCssFontFamilyValue(family));
    } else {
      document.documentElement.style.removeProperty("--font-user");
    }
  }, [fontFamily]);

  // Register custom font faces without forcing every shard to load at startup.
  const { data: customFonts } = useQuery<CustomFontFace[]>({
    queryKey: ["custom-fonts"],
    queryFn: () => api.get("/fonts"),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!customFonts?.length) return;

    // Prefer FontFace API over injecting CSS into a <style> tag to avoid CSS injection
    if (typeof FontFace === "undefined" || !document.fonts) {
      return;
    }

    customFonts.forEach((f) => {
      if (!f.family || !f.url) {
        return;
      }

      try {
        const family = stripFontFamilyQuotes(f.family);
        if (!family) {
          return;
        }

        const key = customFontFaceKey(family, f);
        if (registeredCustomFontFaceKeys.has(key)) {
          return;
        }

        const fontFace = new FontFace(family, `url("${f.url}")`, {
          display: "swap",
          weight: f.weight ?? "400",
          style: f.style ?? "normal",
          ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
        });

        document.fonts.add(fontFace);
        registeredCustomFontFaceKeys.add(key);
      } catch {
        // Ignore construction errors for invalid font definitions
      }
    });
  }, [customFonts]);

  return (
    <>
      <CustomThemeInjector />
      <ChibiProfessorMariEasterEgg />
      <Suspense fallback={null}>
        <LazyAppShell />
      </Suspense>
      {!isLite && <ModelDownloadModal open={showDownloadModal} onClose={() => setShowDownloadModal(false)} />}
      {hasModalOpen && (
        <Suspense fallback={null}>
          <LazyModalRenderer />
        </Suspense>
      )}
      <AppDialogRenderer />
      <CsrfOriginWarningBanner />
      <div
        // Interacting with a toast (including its close button) must not count
        // as an outside click for chat floating panels — otherwise dismissing
        // a toast closes the settings/gallery drawer (and any modal inside it).
        data-chat-floating-panel
        onClickCapture={(event) => {
          if (!(event.target instanceof Element)) return;
          if (event.target.closest("[data-close-button],button[aria-label^='Close'],button[aria-label^='Dismiss']")) {
            toast.dismiss();
          }
        }}
      >
        <Toaster
          position="top-center"
          offset="4rem"
          theme={theme}
          closeButton
          duration={TOAST_DURATION_MS}
          visibleToasts={TOAST_VISIBLE_LIMIT}
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              userSelect: "text",
              WebkitUserSelect: "text",
            },
          }}
        />
      </div>
    </>
  );
}
