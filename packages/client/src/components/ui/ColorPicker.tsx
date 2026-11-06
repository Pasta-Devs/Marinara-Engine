// ──────────────────────────────────────────────
// Color Picker — supports single colors & gradients
// ──────────────────────────────────────────────
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Crosshair, Palette, Pipette, Sparkles, X, Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { SETTINGS_BUTTON_CLASS, SETTINGS_ICON_BUTTON_CLASS } from "../panels/settings/SettingControls";
import {
  hexToHsv,
  hsvToHex,
  hexAlpha,
  normalizeHexColor,
  withAlpha,
  isCssGradient,
  gradientStopsFromColor,
  MARINARA_GRADIENT_PRESET,
  RAINBOW_GRADIENT_PRESET,
} from "../../lib/css-colors";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Allow gradient mode (for name colors) */
  gradient?: boolean;
  /** Use tighter spacing for narrow settings drawers. */
  compact?: boolean;
  /** Label displayed above the picker */
  label: string;
  /** Help text beneath the label */
  helpText?: string;
  /** Text shown when no color is set. */
  emptyText?: string;
  /** Optional color/gradient shown in the preview when no explicit value is set. */
  emptyPreviewValue?: string;
  /** Text shown for the clear/reset action. */
  clearLabel?: string;
  /** Value restored by the clear/reset action. Defaults to empty string. */
  clearValue?: string;
  /** Optional compact control shown beside the label. */
  headerAction?: ReactNode;
  /** Prevent editing while still showing the current preview. */
  disabled?: boolean;
  /** Show only the label row and the always-open picker panel; the caller supplies its own trigger. */
  panelOnly?: boolean;
  /** Offer the opacity strip (default). Turn off where the value gets its own alpha appended later. */
  opacity?: boolean;
}

/** Preset palette colors */
const PRESETS = [
  "#ff6b6b",
  "#ee5a24",
  "#f0932b",
  "#ffd93d",
  "#6ab04c",
  "#22a6b3",
  "#4834d4",
  "#6c5ce7",
  "#e056fd",
  "#fd79a8",
  "#fdcb6e",
  "#00cec9",
  "#2ed573",
  "#1e90ff",
  "#a29bfe",
  "#ff7979",
  "#badc58",
  "#7ed6df",
  "#e17055",
  "#d63031",
];

/** Preset gradients */
const GRADIENT_PRESETS = [
  MARINARA_GRADIENT_PRESET,
  RAINBOW_GRADIENT_PRESET,
  "linear-gradient(90deg, #ff6b6b, #ffd93d)",
  "linear-gradient(90deg, #a29bfe, #fd79a8)",
  "linear-gradient(90deg, #6c5ce7, #00cec9)",
  "linear-gradient(90deg, #e056fd, #4834d4)",
  "linear-gradient(90deg, #f0932b, #ee5a24)",
  "linear-gradient(90deg, #22a6b3, #6ab04c)",
  "linear-gradient(90deg, #1e90ff, #a29bfe)",
  "linear-gradient(90deg, #ff7979, #e056fd)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
];

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function isEditableLinearGradient(value: string): boolean {
  return /^linear-gradient\(/i.test(value.trim());
}

/** Parse gradient into stops: "linear-gradient(90deg, #ff6b6b, #ffd93d)" → ["#ff6b6b","#ffd93d"] */
function parseGradientStops(value: string): string[] {
  const match = value.match(/^linear-gradient\((.*)\)$/i);
  if (!match) return ["#ff6b6b", "#ffd93d"];
  const parts = splitTopLevelCommas(match[1]);
  const hasDirection = /^(?:-?[\d.]+(?:deg|grad|rad|turn)|to\s+)/i.test(parts[0] ?? "");
  const stops = hasDirection ? parts.slice(1) : parts;
  return stops.length >= 2 ? stops : ["#ff6b6b", "#ffd93d"];
}

function buildGradient(angle: number, stops: string[]): string {
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

const resolvedCssColorCache = new Map<string, string | null>();
const CSS_COLOR_CACHE_LIMIT = 128;

function cacheResolvedCssColor(key: string, value: string | null) {
  if (!resolvedCssColorCache.has(key) && resolvedCssColorCache.size >= CSS_COLOR_CACHE_LIMIT) {
    const oldestKey = resolvedCssColorCache.keys().next().value;
    if (oldestKey !== undefined) resolvedCssColorCache.delete(oldestKey);
  }
  resolvedCssColorCache.set(key, value);
}

function resolveCssColorToHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const directHex = normalizeHexColor(trimmed);
  if (directHex) return directHex;
  const cacheKey = trimmed.toLowerCase();
  if (resolvedCssColorCache.has(cacheKey)) return resolvedCssColorCache.get(cacheKey) ?? null;
  if (typeof document === "undefined" || (typeof CSS !== "undefined" && !CSS.supports("color", trimmed))) {
    cacheResolvedCssColor(cacheKey, null);
    return null;
  }
  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    cacheResolvedCssColor(cacheKey, null);
    return null;
  }
  const readBack = (sentinel: string) => {
    context.fillStyle = sentinel;
    context.fillStyle = trimmed;
    return String(context.fillStyle).trim().toLowerCase();
  };
  const first = readBack("#010203");
  const second = readBack("#040506");
  if (first !== second) {
    cacheResolvedCssColor(cacheKey, null);
    return null;
  }
  const normalized = first;
  let resolved = normalizeHexColor(normalized);
  if (!resolved) {
    const rgb = normalized.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (rgb) {
      const hex = `#${rgb
        .slice(1, 4)
        .map((channel) =>
          Math.max(0, Math.min(255, Math.round(Number(channel))))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
      resolved = withAlpha(hex, rgb[4] === undefined ? 1 : Number(rgb[4]));
    }
  }
  cacheResolvedCssColor(cacheKey, resolved);
  return resolved;
}

function parseGradientColorStop(stop: string): { color: string; suffix: string; hex: string | null } {
  const trimmed = stop.trim();
  const wholeHex = resolveCssColorToHex(trimmed);
  if (wholeHex) return { color: trimmed, suffix: "", hex: wholeHex };
  let depth = 0;
  const boundaries: number[] = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && /\s/.test(character) && index > 0 && !/\s/.test(trimmed[index - 1] ?? "")) {
      boundaries.push(index);
    }
  }
  for (const boundary of boundaries.reverse()) {
    const color = trimmed.slice(0, boundary).trim();
    const suffix = trimmed.slice(boundary).trim();
    const hex = resolveCssColorToHex(color);
    if (hex && suffix) return { color, suffix, hex };
  }
  return { color: trimmed, suffix: "", hex: null };
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const HUE_GRADIENT = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";
const CHECKER_BACKGROUND = "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 0 0 / 0.5rem 0.5rem";
const HANDLE_CLASS =
  "pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_1px_3px_rgba(0,0,0,0.4)]";
const SLIDER_FOCUS_CLASS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]";

type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> };
/** The browser's screen colour dropper (Chromium desktop, secure pages only), or undefined. */
function getEyeDropper() {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

function arrowStep(event: ReactKeyboardEvent) {
  const step = event.shiftKey ? 10 : 1;
  const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
  const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
  if (dx || dy) event.preventDefault();
  return [dx, dy] as const;
}

/** Pointer capture for a 2D or 1D drag surface: reports the pointer as 0-1 fractions of the box. */
function dragProps(read: (x: number, y: number) => void, commit: () => void) {
  const readEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    read(clampUnit((event.clientX - rect.left) / rect.width), clampUnit((event.clientY - rect.top) / rect.height));
  };
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus();
      readEvent(event);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) readEvent(event);
    },
    onPointerUp: commit,
    onPointerCancel: commit,
    onKeyUp: commit,
  };
}

/** One horizontal strip slider (hue, opacity): drag, click or arrow keys. */
function ColorStrip({
  label,
  valueNow,
  valueMax,
  valueText,
  position,
  background,
  thumb,
  onPick,
  onStep,
  onCommit,
}: {
  label: string;
  valueNow: number;
  valueMax: number;
  valueText: string;
  position: number;
  background: string;
  thumb: string;
  onPick: (x: number) => void;
  onStep: (delta: number) => void;
  onCommit: () => void;
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={Math.round(valueNow)}
      aria-valuetext={valueText}
      {...dragProps((x) => onPick(x), onCommit)}
      onKeyDown={(event) => {
        const [dx, dy] = arrowStep(event);
        if (dx || dy) onStep(dx + dy);
      }}
      className={cn("relative h-3.5 cursor-pointer touch-none rounded-full", SLIDER_FOCUS_CLASS)}
      style={{ background }}
    >
      <span aria-hidden="true" className={HANDLE_CLASS} style={{ left: `${position * 100}%`, background: thumb }} />
    </div>
  );
}

/**
 * Drag-to-pick colour selector: saturation/brightness square, hue strip and the screen dropper.
 * `value` is `#rrggbb` or `#rrggbbaa`; its alpha is kept on every change (the opacity strip sets it).
 */
function MarinaraColorSelector({
  value,
  onChange,
  onCommit,
  label,
}: {
  value: string;
  onChange: (value: string, defer?: boolean) => void;
  onCommit: () => void;
  label: string;
}) {
  const { t } = useUiTranslation();
  const baseHex = value.slice(0, 7);
  const alpha = hexAlpha(value);
  // The draft keeps hue and saturation while they cannot be read back from the hex (greys, black).
  const [draft, setDraft] = useState<[number, number, number] | null>(null);
  const previousValueRef = useRef(value);
  const [hue, saturation, brightness] = draft ?? hexToHsv(baseHex);
  const EyeDropper = getEyeDropper();
  useEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;
    if (draft && value !== previousValue && withAlpha(hsvToHex(...draft), alpha) !== value.toLowerCase()) {
      setDraft(null);
    }
  }, [alpha, draft, value]);

  const update = (next: [number, number, number]) => {
    setDraft(next);
    onChange(withAlpha(hsvToHex(...next), alpha), true);
  };
  const commit = () => {
    onCommit();
    setDraft(null);
  };
  const pickFromScreen = async () => {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const picked = normalizeHexColor(sRGBHex);
      if (!picked) return;
      setDraft(null);
      onChange(withAlpha(picked.slice(0, 7), alpha));
    } catch {
      // Escape closes the dropper without a colour.
    }
  };
  return (
    <div
      role="group"
      className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/55 p-2"
      aria-label={label}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("ui.ui.colorpicker.saturationAndBrightness")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(saturation)}
        aria-valuetext={t("ui.ui.colorpicker.saturationAndBrightnessValue", {
          saturation: Math.round(saturation),
          brightness: Math.round(brightness),
        })}
        {...dragProps((x, y) => update([hue, Math.round(x * 100), Math.round((1 - y) * 100)]), commit)}
        onKeyDown={(event) => {
          const [dx, dy] = arrowStep(event);
          if (dx || dy) update([hue, clampPercent(saturation + dx), clampPercent(brightness + dy)]);
        }}
        className={cn("relative h-28 cursor-crosshair touch-none rounded-md", SLIDER_FOCUS_CLASS)}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
      >
        <span
          aria-hidden="true"
          className={HANDLE_CLASS}
          style={{ left: `${saturation}%`, top: `${100 - brightness}%`, background: baseHex }}
        />
      </div>
      <div className="flex items-center gap-2">
        {EyeDropper && (
          <button
            type="button"
            onClick={pickFromScreen}
            aria-label={t("ui.ui.colorpicker.pickFromScreen")}
            title={t("ui.ui.colorpicker.pickFromScreen")}
            className={SETTINGS_ICON_BUTTON_CLASS}
          >
            <Pipette size="0.75rem" />
          </button>
        )}
        <span
          aria-hidden="true"
          className="h-6 w-6 shrink-0 rounded-md ring-1 ring-[var(--border)]"
          style={{ background: `linear-gradient(${value}, ${value}), ${CHECKER_BACKGROUND}` }}
        />
        <div className="min-w-0 flex-1">
          <ColorStrip
            label={t("ui.ui.colorpicker.hue")}
            valueNow={hue}
            valueMax={359}
            valueText={`${Math.round(hue)}°`}
            position={hue / 359}
            background={HUE_GRADIENT}
            thumb={`hsl(${hue} 100% 50%)`}
            onPick={(x) => update([Math.min(359, Math.round(x * 360)), saturation, brightness])}
            onStep={(delta) => update([(hue + delta + 360) % 360, saturation, brightness])}
            onCommit={commit}
          />
        </div>
      </div>
    </div>
  );
}

/** Opacity of a `#rrggbb(aa)` colour, shared by the Custom and Palette views. */
function OpacityStrip({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (value: string, defer?: boolean) => void;
  onCommit: () => void;
}) {
  const { t } = useUiTranslation();
  const baseHex = value.slice(0, 7);
  const alpha = hexAlpha(value);
  const percent = Math.round(alpha * 100);
  const label = t("ui.ui.colorpicker.opacity");
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[0.625rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      <div className="min-w-0 flex-1">
        <ColorStrip
          label={label}
          valueNow={percent}
          valueMax={100}
          valueText={`${percent}%`}
          position={alpha}
          background={`linear-gradient(to right, transparent, ${baseHex}), ${CHECKER_BACKGROUND}`}
          thumb={value}
          onPick={(x) => onChange(withAlpha(baseHex, x), true)}
          onStep={(delta) => onChange(withAlpha(baseHex, clampPercent(percent + delta) / 100), true)}
          onCommit={onCommit}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
        {percent}%
      </span>
    </div>
  );
}

const SEGMENT_GROUP_CLASS = "flex min-w-[9rem] flex-1 rounded-lg bg-[var(--secondary)] p-0.5";
const segmentClass = (active: boolean) =>
  cn(
    "flex-1 rounded-md px-3 py-1.5 text-[0.6875rem] font-medium transition-all",
    active
      ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
  );
const PALETTE_SWATCH_CLASS =
  "h-7 w-7 rounded-md ring-1 ring-[var(--border)] transition-all hover:scale-110 hover:ring-2 hover:ring-[var(--primary)]/50";

export function ColorPicker({
  value,
  onChange,
  gradient = false,
  compact = false,
  label,
  helpText,
  emptyText = "No color set — uses default",
  emptyPreviewValue = "",
  clearLabel = "Clear",
  clearValue = "",
  headerAction,
  disabled = false,
  panelOnly = false,
  opacity = true,
}: ColorPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const previewValue = value || emptyPreviewValue;
  const isGradient = isEditableLinearGradient(previewValue);
  const [mode, setMode] = useState<"solid" | "gradient">(isGradient ? "gradient" : "solid");
  // Empty until a gradient is shown, so the first switch to Gradient can seed from the current colour.
  const [gradientStops, setGradientStops] = useState<string[]>(isGradient ? parseGradientStops(previewValue) : []);
  const [gradientAngle, setGradientAngle] = useState(90);
  const [expandedState, setExpanded] = useState(false);
  const expanded = panelOnly || expandedState;
  const [activeStop, setActiveStop] = useState(0);
  const [view, setView] = useState<"custom" | "palette">("custom");
  const onChangeRef = useRef(onChange);
  const pendingChangeRef = useRef<string | null>(null);
  const pendingFrameRef = useRef<number | null>(null);

  // Sync value → local state when value changes externally
  useEffect(() => {
    if (isEditableLinearGradient(previewValue)) {
      setMode("gradient");
      setGradientStops(parseGradientStops(previewValue));
      const angleMatch = previewValue.match(/linear-gradient\((\d+)deg/);
      if (angleMatch) setGradientAngle(parseInt(angleMatch[1]));
    } else if (previewValue) {
      setMode("solid");
    }
  }, [previewValue]);

  useEffect(() => {
    setActiveStop((current) => Math.min(current, Math.max(0, gradientStops.length - 1)));
  }, [gradientStops.length]);

  useEffect(() => {
    if (disabled) {
      setExpanded(false);
    }
  }, [disabled]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const flushPendingChange = useCallback(() => {
    if (pendingFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
    const pending = pendingChangeRef.current;
    pendingChangeRef.current = null;
    if (pending !== null) {
      onChangeRef.current(pending);
    }
  }, []);

  const cancelPendingChange = useCallback(() => {
    if (pendingFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
    pendingChangeRef.current = null;
  }, []);

  useEffect(
    () => () => {
      flushPendingChange();
    },
    [flushPendingChange],
  );

  const commitChange = useCallback(
    (nextValue: string, defer = false) => {
      if (!defer) {
        cancelPendingChange();
        onChangeRef.current(nextValue);
        return;
      }

      pendingChangeRef.current = nextValue;
      if (pendingFrameRef.current !== null) return;
      pendingFrameRef.current = window.requestAnimationFrame(() => {
        pendingFrameRef.current = null;
        const pending = pendingChangeRef.current;
        pendingChangeRef.current = null;
        if (pending !== null) {
          onChangeRef.current(pending);
        }
      });
    },
    [cancelPendingChange],
  );

  const handleSolidChange = useCallback(
    (color: string, defer = false) => {
      commitChange(color, defer);
    },
    [commitChange],
  );

  const handleGradientStopChange = useCallback(
    (index: number, color: string, defer = false) => {
      const updated = gradientStops.map((stop, i) => {
        if (i !== index) return stop;
        const { suffix } = parseGradientColorStop(stop);
        return suffix ? `${color} ${suffix}` : color;
      });
      setGradientStops(updated);
      commitChange(buildGradient(gradientAngle, updated), defer);
    },
    [commitChange, gradientAngle, gradientStops],
  );

  const handleGradientStopTextChange = useCallback(
    (index: number, stop: string) => {
      const updated = gradientStops.map((existing, currentIndex) => (currentIndex === index ? stop : existing));
      setGradientStops(updated);
      commitChange(buildGradient(gradientAngle, updated));
    },
    [commitChange, gradientAngle, gradientStops],
  );

  const addStop = useCallback(() => {
    const updated = [...gradientStops, "#ffffff"];
    setGradientStops(updated);
    commitChange(buildGradient(gradientAngle, updated));
  }, [commitChange, gradientAngle, gradientStops]);

  const removeStop = useCallback(
    (index: number) => {
      if (gradientStops.length <= 2) return;
      const updated = gradientStops.filter((_, i) => i !== index);
      setGradientStops(updated);
      commitChange(buildGradient(gradientAngle, updated));
    },
    [commitChange, gradientAngle, gradientStops],
  );

  const handleAngleChange = useCallback(
    (angle: number, defer = false) => {
      setGradientAngle(angle);
      commitChange(buildGradient(angle, gradientStops), defer);
    },
    [commitChange, gradientStops],
  );

  const clearColor = useCallback(() => {
    commitChange(clearValue);
    setExpanded(false);
  }, [clearValue, commitChange]);

  const solidSliderColor = !isCssGradient(previewValue)
    ? previewValue
      ? resolveCssColorToHex(previewValue)
      : "#6c5ce7"
    : null;
  // Palette picks keep the current opacity; fields without the opacity strip always pick opaque colours.
  const solidAlpha = opacity && solidSliderColor ? hexAlpha(solidSliderColor) : 1;
  const activeGradientStop = parseGradientColorStop(gradientStops[activeStop] ?? "");
  const showClear = clearValue ? value !== clearValue : !!value;
  const displayStyle = previewValue
    ? isCssGradient(previewValue)
      ? { background: previewValue }
      : { backgroundColor: previewValue }
    : { backgroundColor: "transparent" };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {/* Label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
          {headerAction}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showClear && (
            <button type="button" onClick={clearColor} disabled={disabled} className={SETTINGS_BUTTON_CLASS}>
              <X size="0.75rem" />
              {clearLabel}
            </button>
          )}
        </div>
      </div>
      {helpText && <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">{helpText}</p>}

      {/* Preview + trigger */}
      {!panelOnly && (
        <button
          type="button"
          onClick={() => {
            if (!disabled) setExpanded(!expanded);
          }}
          disabled={disabled}
          className={cn(
            "flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--secondary)] transition-all hover:border-[var(--primary)]/30",
            compact ? "gap-2 rounded-lg p-1.5" : "gap-3 p-2.5",
            expanded && "border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20",
            disabled && "cursor-not-allowed opacity-60 hover:border-[var(--border)]",
          )}
        >
          <div
            className={cn("shrink-0 rounded-lg ring-1 ring-[var(--border)]", compact ? "h-6 w-6" : "h-8 w-8")}
            style={{
              ...displayStyle,
              ...(!previewValue && {
                backgroundImage: "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%)",
                backgroundSize: "0.5rem 0.5rem",
              }),
            }}
          />
          <span className="flex-1 text-left text-xs text-[var(--muted-foreground)] truncate">{value || emptyText}</span>
          <Pipette size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
        </button>
      )}

      {/* Expanded picker */}
      {expanded && (
        <div
          className={cn(
            "rounded-xl border border-[var(--border)] bg-[var(--card)] animate-in slide-in-from-top-2 duration-200",
            compact ? "space-y-2 p-2" : "space-y-3 p-3",
          )}
        >
          {/* Mode (solid or gradient) and view (custom or palette) on one row */}
          <div className="flex flex-wrap gap-1.5">
            {gradient && (
              <div className={SEGMENT_GROUP_CLASS}>
                <button
                  type="button"
                  aria-pressed={mode === "solid"}
                  onClick={() => {
                    setMode("solid");
                    if (gradientStops[0]) handleSolidChange(parseGradientColorStop(gradientStops[0]).color);
                  }}
                  className={segmentClass(mode === "solid")}
                >
                  <Pipette size="0.6875rem" className="mr-1 inline" />
                  {localizeUi("ui.ui.colorpicker.solid")}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "gradient"}
                  onClick={() => {
                    // Keep the stops from earlier; otherwise start from the current colour, then the first preset.
                    const stops = gradientStops.length
                      ? gradientStops
                      : (gradientStopsFromColor(previewValue && solidSliderColor) ??
                        parseGradientStops(GRADIENT_PRESETS[0]));
                    setMode("gradient");
                    setGradientStops(stops);
                    commitChange(buildGradient(gradientAngle, stops));
                  }}
                  className={segmentClass(mode === "gradient")}
                >
                  <Sparkles size="0.6875rem" className="mr-1 inline" />
                  {localizeUi("ui.ui.colorpicker.gradient")}
                </button>
              </div>
            )}
            <div className={SEGMENT_GROUP_CLASS}>
              <button
                type="button"
                aria-pressed={view === "custom"}
                onClick={() => setView("custom")}
                className={segmentClass(view === "custom")}
              >
                <Crosshair size="0.6875rem" className="mr-1 inline" />
                {localizeUi("ui.ui.colorpicker.custom")}
              </button>
              <button
                type="button"
                aria-pressed={view === "palette"}
                onClick={() => setView("palette")}
                className={segmentClass(view === "palette")}
              >
                <Palette size="0.6875rem" className="mr-1 inline" />
                {localizeUi("ui.ui.colorpicker.palette")}
              </button>
            </div>
          </div>

          {/* Solid color mode */}
          {mode === "solid" && (
            <div className="grid gap-2">
              {view === "custom" && solidSliderColor ? (
                <MarinaraColorSelector
                  value={solidSliderColor}
                  onChange={handleSolidChange}
                  onCommit={flushPendingChange}
                  label={localizeUi("ui.ui.colorpicker.pickValue1Color", { value1: label })}
                />
              ) : null}
              {view === "palette" && (
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((color) => {
                    const selected = solidSliderColor?.slice(0, 7) === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSolidChange(withAlpha(color, solidAlpha))}
                        className={cn(PALETTE_SWATCH_CLASS, selected && "ring-2 ring-[var(--primary)] scale-110")}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={color}
                        aria-pressed={selected}
                      />
                    );
                  })}
                </div>
              )}
              {opacity && solidSliderColor ? (
                <OpacityStrip value={solidSliderColor} onChange={handleSolidChange} onCommit={flushPendingChange} />
              ) : null}

              <label className="min-w-0 space-y-1">
                <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.ui.colorpicker.hexCss")}
                </span>
                <input
                  aria-label={localizeUi("ui.ui.colorpicker.value1HexOrCssColor", { value1: label })}
                  value={value && !isEditableLinearGradient(value) ? value : ""}
                  onChange={(e) => handleSolidChange(e.target.value)}
                  placeholder={localizeUi("ui.ui.colorpicker.hexOrColorName")}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 font-mono text-xs outline-none transition-colors focus:border-[var(--primary)]/50"
                />
              </label>
            </div>
          )}

          {/* Gradient mode */}
          {mode === "gradient" && (
            <>
              {/* Gradient preview bar */}
              <div
                className="h-8 w-full rounded-lg ring-1 ring-[var(--border)]"
                style={{ background: buildGradient(gradientAngle, gradientStops) }}
              />

              {view === "custom" && (
                <>
                  {/* Stops */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        {localizeUi("ui.ui.colorpicker.colorStops")}
                      </p>
                      <button type="button" onClick={addStop} className={SETTINGS_BUTTON_CLASS}>
                        <Plus size="0.75rem" />
                        {localizeUi("ui.characters.metadatatab.add")}
                      </button>
                    </div>
                    {gradientStops.map((stop, i) => {
                      const parsedStop = parseGradientColorStop(stop);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveStop(i)}
                            className={cn(
                              "h-7 w-7 shrink-0 rounded-md border border-[var(--border)] transition-[transform,box-shadow] hover:scale-105",
                              activeStop === i &&
                                "ring-2 ring-[var(--marinara-app-accent-solid)] ring-offset-1 ring-offset-[var(--card)]",
                            )}
                            style={{ backgroundColor: parsedStop.hex ?? "transparent" }}
                            aria-label={localizeUi("ui.ui.colorpicker.editColorStop", { index: i + 1 })}
                          />
                          <input
                            value={stop}
                            aria-label={localizeUi("ui.ui.colorpicker.editColorStop", { index: i + 1 })}
                            onChange={(e) => handleGradientStopTextChange(i, e.target.value)}
                            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 font-mono text-[0.6875rem] outline-none focus:border-[var(--primary)]/40"
                          />
                          {gradientStops.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeStop(i)}
                              aria-label={localizeUi("ui.ui.colorpicker.removeColorStop", { index: i + 1 })}
                              className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger")}
                            >
                              <Trash2 size="0.75rem" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {activeGradientStop.hex ? (
                      <>
                        <MarinaraColorSelector
                          value={activeGradientStop.hex}
                          onChange={(next, defer) => handleGradientStopChange(activeStop, next, defer)}
                          onCommit={flushPendingChange}
                          label={localizeUi("ui.ui.colorpicker.editColorStop", { index: activeStop + 1 })}
                        />
                        {opacity && (
                          <OpacityStrip
                            value={activeGradientStop.hex}
                            onChange={(next, defer) => handleGradientStopChange(activeStop, next, defer)}
                            onCommit={flushPendingChange}
                          />
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Angle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.ui.colorpicker.angle")}
                      </span>
                      <span className="min-w-[2.75rem] text-right font-mono text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
                        {gradientAngle}°
                      </span>
                    </div>
                    <input
                      aria-label={localizeUi("ui.ui.colorpicker.gradientAngle")}
                      type="range"
                      min={0}
                      max={360}
                      value={gradientAngle}
                      onChange={(e) => handleAngleChange(parseInt(e.target.value), true)}
                      onPointerUp={flushPendingChange}
                      onKeyUp={flushPendingChange}
                      onBlur={flushPendingChange}
                      className="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
                    />
                  </div>
                </>
              )}

              {view === "palette" && (
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENT_PRESETS.map((g) => {
                    const name =
                      g === MARINARA_GRADIENT_PRESET
                        ? localizeUi("ui.ui.colorpicker.marinaraGradient")
                        : g === RAINBOW_GRADIENT_PRESET
                          ? localizeUi("ui.ui.colorpicker.gayRgbRainbow")
                          : g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGradientStops(parseGradientStops(g));
                          const angleMatch = g.match(/linear-gradient\((\d+)deg/);
                          if (angleMatch) setGradientAngle(parseInt(angleMatch[1]));
                          commitChange(g);
                        }}
                        className={cn(
                          PALETTE_SWATCH_CLASS,
                          previewValue === g && "ring-2 ring-[var(--primary)] scale-110",
                        )}
                        style={{ background: g }}
                        title={name}
                        aria-label={name}
                        aria-pressed={previewValue === g}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
