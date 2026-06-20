// ──────────────────────────────────────────────
// Game: Cinematic Direction Engine
//
// Renders visual overlays driven by [direction: ...] commands.
// Each direction maps to a CSS-driven effect applied as a layer
// over the game viewport.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import type { DirectionCommand } from "@marinara-engine/shared";

/** Cross-fading background layer — renders two stacked layers and transitions between them. */
function getBackgroundBlurStyle(blurPx: number): Pick<CSSProperties, "filter" | "transform"> {
  if (blurPx <= 0) return {};
  return {
    filter: `blur(${blurPx}px)`,
    transform: `scale(${Math.min(1.08, 1 + blurPx * 0.0025)})`,
  };
}

function CrossfadeBackground({ url, blurPx = 0 }: { url?: string; blurPx?: number }) {
  const [layers, setLayers] = useState<{ front: string | null; back: string | null; fading: boolean }>({
    front: url ?? null,
    back: null,
    fading: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backgroundBlurStyle = getBackgroundBlurStyle(blurPx);

  useEffect(() => {
    const incoming = url ?? null;
    if (incoming === layers.front) return;
    clearTimeout(timerRef.current);
    // Push current front to back, set new url as front, start fading
    setLayers({ front: incoming, back: layers.front, fading: true });
    timerRef.current = setTimeout(() => {
      setLayers((prev) => ({ ...prev, back: null, fading: false }));
    }, 750);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const isBlack = !layers.front || layers.front === "black";

  return (
    <>
      {/* Back layer (old image, fading out) */}
      {layers.back && layers.back !== "black" && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${layers.back})`,
            opacity: layers.fading ? 0 : 1,
            transition: "opacity 700ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out",
            ...backgroundBlurStyle,
          }}
        />
      )}
      {/* Front layer (new image, fading in) */}
      {!isBlack && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${layers.front})`,
            opacity: layers.fading ? 1 : 1,
            transition: "opacity 700ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out",
            ...backgroundBlurStyle,
          }}
        />
      )}
      {isBlack && <div className="absolute inset-0 bg-black" />}
    </>
  );
}

interface DirectionEngineProps {
  /** Currently queued directions from the latest GM message. */
  directions: DirectionCommand[];
  /** Background image URL — rendered inside the effect scope so shake/blur affects it. */
  backgroundUrl?: string;
  /** Persistent user-configured background blur, in px. */
  backgroundBlurPx?: number;
  /** Called when active effects start or all finish playing. */
  onPlayingChange?: (playing: boolean) => void;
  children: React.ReactNode;
}

interface ActiveEffect {
  id: number;
  command: DirectionCommand;
  startedAt: number;
  /** When true, the effect is fading out before removal */
  expiring?: boolean;
}

/** How long (ms) overlay effects take to fade out after their duration ends */
const FADE_OUT_MS = 600;

let effectCounter = 0;

export function DirectionEngine({
  directions,
  backgroundUrl,
  backgroundBlurPx = 0,
  onPlayingChange,
  children,
}: DirectionEngineProps) {
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const processedRef = useRef<string>("");

  // Queue incoming directions (dedupe by stringifying to avoid re-firing)
  useLayoutEffect(() => {
    if (directions.length === 0) {
      processedRef.current = "";
      return;
    }
    const key = JSON.stringify(directions);
    if (processedRef.current === key) return;
    processedRef.current = key;

    const newEffects: ActiveEffect[] = directions.map((cmd) => ({
      id: ++effectCounter,
      command: cmd,
      startedAt: Date.now(),
    }));
    setActiveEffects((prev) => [...prev, ...newEffects]);
  }, [directions]);

  // Auto-expire effects: mark as expiring first, then remove after fade-out.
  // Phase 2 (removal) is scheduled inside Phase 1's callback so it isn't
  // cancelled by React's effect cleanup when Phase 1 triggers a state update.
  useEffect(() => {
    if (activeEffects.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const eff of activeEffects) {
      if (eff.expiring) {
        // Re-schedule removal for effects already fading out — their previous
        // removal timer may have been cancelled by an effect cleanup cycle.
        timers.push(
          setTimeout(() => {
            setActiveEffects((prev) => prev.filter((e) => e.id !== eff.id));
          }, FADE_OUT_MS),
        );
        continue;
      }
      const dur = Math.min(eff.command.duration ?? 1, 30) * 1000;
      const elapsed = Date.now() - eff.startedAt;
      const remaining = Math.max(0, dur - elapsed);

      // Phase 1: mark as expiring (triggers CSS fade-out)
      // Phase 2 is nested so it survives React effect cleanup
      timers.push(
        setTimeout(() => {
          setActiveEffects((prev) => prev.map((e) => (e.id === eff.id ? { ...e, expiring: true } : e)));
          setTimeout(() => {
            setActiveEffects((prev) => prev.filter((e) => e.id !== eff.id));
          }, FADE_OUT_MS);
        }, remaining),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [activeEffects]);

  // Notify parent when effects start/stop playing
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    const playing = activeEffects.length > 0;
    if (playing !== wasPlayingRef.current) {
      wasPlayingRef.current = playing;
      onPlayingChange?.(playing);
    }
  }, [activeEffects, onPlayingChange]);

  const clearAll = useCallback(() => setActiveEffects([]), []);

  // Build overlay layers
  const bgEffects = activeEffects.filter(
    (e) => e.command.target === "background" || e.command.target === "all" || !e.command.target,
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Scene visual layer. Transform/filter effects live here so HUD widgets remain stable. */}
      <div className="absolute inset-0 z-0 h-full w-full" style={buildVisualStyle(bgEffects)}>
        <CrossfadeBackground url={backgroundUrl} blurPx={backgroundBlurPx} />
      </div>

      {/* Background/all overlay effects */}
      {bgEffects.map((eff) => (
        <EffectOverlay key={eff.id} effect={eff} />
      ))}

      {/* Interactive/game UI content remains outside transformed effect layers to avoid widget jitter. */}
      <div className="relative z-[2] h-full w-full">{children}</div>

      {/* Click to dismiss persistent effects — only visible while effects are actively playing */}
      {activeEffects.some((e) => !e.expiring) && (
        <button
          type="button"
          onClick={clearAll}
          className="marinara-chat-toolbar-button absolute bottom-4 right-4 z-50 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 py-1.5 text-xs font-medium text-[var(--marinara-chat-chrome-button-text)] backdrop-blur-md transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
        >
          Skip effects
        </button>
      )}
    </div>
  );
}

// ── Individual Effect Overlay ──

function EffectOverlay({ effect }: { effect: ActiveEffect }) {
  const { command } = effect;
  const dur = Math.min(command.duration ?? 1, 30);
  const intensity = command.intensity ?? 0.5;
  const fadeOutSec = FADE_OUT_MS / 1000;

  // Common transition for smooth fade-out when expiring
  const expiringTransition = `opacity ${fadeOutSec}s ease-out, transform ${fadeOutSec}s ease-out, height ${fadeOutSec}s ease-out`;

  switch (command.effect) {
    case "fade_from_black":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-40 bg-black"
          style={{
            animation: `dirFadeOut ${dur}s ease-out forwards`,
          }}
        />
      );

    case "fade_to_black":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-40 bg-black opacity-0"
          style={{
            animation: `dirFadeIn ${dur}s ease-in forwards`,
          }}
        />
      );

    case "flash": {
      // Epilepsy safety: enforce minimum 0.5s duration, cap peak opacity
      const flashDur = Math.max(dur, 0.5);
      return (
        <div
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            backgroundColor: command.params?.color ?? "white",
            animation: `dirFlash ${flashDur}s ease-out forwards`,
            opacity: 0,
          }}
        />
      );
    }

    case "vignette":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background: `radial-gradient(ellipse at center, transparent ${(1 - intensity) * 60}%, rgba(0,0,0,${intensity}) 100%)`,
            animation: effect.expiring ? undefined : `dirFadeFromZero ${Math.min(dur, 0.5)}s ease-out forwards`,
            opacity: effect.expiring ? 0 : undefined,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "letterbox": {
      const barHeight = `${intensity * 15}%`;
      return (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-black"
            style={{
              height: effect.expiring ? "0%" : barHeight,
              transition: effect.expiring
                ? `height ${fadeOutSec}s ease-in-out`
                : `height ${Math.min(dur, 0.5)}s ease-out`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black"
            style={{
              height: effect.expiring ? "0%" : barHeight,
              transition: effect.expiring
                ? `height ${fadeOutSec}s ease-in-out`
                : `height ${Math.min(dur, 0.5)}s ease-out`,
            }}
          />
        </>
      );
    }

    case "screen_shake":
      // Handled via content style (buildContentStyle), not overlay
      return null;

    case "color_grade": {
      const preset = command.params?.preset ?? "warm";
      const filter = COLOR_GRADE_PRESETS[preset] ?? "none";
      return (
        <div
          className="pointer-events-none absolute inset-0 z-20 mix-blend-color"
          style={{
            backdropFilter: filter,
            opacity: effect.expiring ? 0 : intensity,
            animation: effect.expiring ? undefined : `dirFadeFromZero ${dur}s ease-out forwards`,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );
    }

    case "blur":
      // Handled via content style, not overlay
      return null;

    case "focus":
      // Handled via vignette + slight blur combo
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background: `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${intensity * 0.4}) 100%)`,
            backdropFilter: effect.expiring ? "none" : `blur(${intensity * 4}px)`,
            mask: "radial-gradient(circle at center, transparent 25%, black 60%)",
            WebkitMask: "radial-gradient(circle at center, transparent 25%, black 60%)",
            opacity: effect.expiring ? 0 : undefined,
            animation: effect.expiring ? undefined : `dirFadeFromZero ${dur}s ease-out forwards`,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "pulse":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-[35]"
          style={{
            background: `radial-gradient(circle at center, rgba(255,255,255,${0.18 + intensity * 0.32}) 0%, transparent 55%)`,
            animation: effect.expiring ? undefined : `dirPulse ${Math.max(0.45, dur)}s ease-out forwards`,
            opacity: effect.expiring ? 0 : undefined,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "chromatic_aberration":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30 mix-blend-screen"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,0,80,0.22), transparent 35%, rgba(0,220,255,0.18) 65%, transparent)",
            animation: effect.expiring ? undefined : `dirChromatic ${Math.min(dur, 2)}s steps(5, end) forwards`,
            opacity: effect.expiring ? 0 : intensity,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "film_grain":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.22) 0 1px, transparent 1px), radial-gradient(circle at 45% 80%, rgba(255,255,255,0.12) 0 1px, transparent 1px)",
            backgroundSize: "17px 19px, 23px 29px, 31px 37px",
            animation: effect.expiring ? undefined : `dirGrain ${Math.max(0.5, dur)}s steps(8, end) infinite`,
            opacity: effect.expiring ? 0 : Math.min(0.45, 0.12 + intensity * 0.35),
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "rain_streaks":
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            backgroundImage:
              "linear-gradient(105deg, transparent 0 46%, rgba(190,220,255,0.22) 48%, transparent 51% 100%)",
            backgroundSize: "42px 120px",
            animation: effect.expiring ? undefined : `dirRainStreaks ${Math.max(0.8, dur)}s linear infinite`,
            opacity: effect.expiring ? 0 : Math.min(0.55, 0.18 + intensity * 0.42),
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );

    case "spotlight": {
      const x = command.params?.x ?? "50%";
      const y = command.params?.y ?? "42%";
      return (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background: `radial-gradient(circle at ${x} ${y}, transparent 0%, transparent ${22 + intensity * 18}%, rgba(0,0,0,${0.4 + intensity * 0.38}) 100%)`,
            opacity: effect.expiring ? 0 : undefined,
            animation: effect.expiring ? undefined : `dirFadeFromZero ${Math.min(dur, 0.6)}s ease-out forwards`,
            transition: effect.expiring ? expiringTransition : undefined,
          }}
        />
      );
    }

    case "desaturate":
    case "slow_zoom":
    case "impact_zoom":
    case "tilt":
      return null;

    default:
      return null;
  }
}

// ── Helpers ──

const COLOR_GRADE_PRESETS: Record<string, string> = {
  warm: "sepia(0.3) saturate(1.2)",
  cold_blue: "saturate(0.8) hue-rotate(200deg) brightness(0.95)",
  horror: "saturate(0.3) contrast(1.2) brightness(0.8)",
  noir: "grayscale(0.8) contrast(1.3)",
  vintage: "sepia(0.4) contrast(0.9) brightness(1.1)",
  neon: "saturate(1.8) contrast(1.1) brightness(1.05)",
  dreamy: "saturate(0.6) brightness(1.2) blur(0.5px)",
};

function buildVisualStyle(effects: ActiveEffect[]): CSSProperties {
  const style: CSSProperties = {};
  const filters: string[] = [];
  const animations: string[] = [];
  // Always include filter transition so blur fades out smoothly when effects expire
  let maxDur = 0.5;
  const fadeOutSec = FADE_OUT_MS / 1000;

  for (const eff of effects) {
    const { command } = eff;
    const intensity = command.intensity ?? 0.5;
    const dur = command.duration ?? 1;

    if (command.effect === "blur") {
      if (!eff.expiring) {
        const amount = command.params?.amount ?? `${intensity * 12}px`;
        filters.push(`blur(${amount})`);
      }
      maxDur = Math.max(maxDur, dur);
    }

    if (command.effect === "screen_shake") {
      if (eff.expiring) {
        // Decaying micro-shake during fade-out
        animations.push(`dirShakeDecay ${fadeOutSec}s ease-out forwards`);
      } else {
        // Full shake with built-in decay over its duration
        const shakeDur = Math.min(dur, 4);
        animations.push(`dirShakeDecay ${shakeDur}s ease-out forwards`);
      }
    }

    if (command.effect === "desaturate") {
      if (!eff.expiring) filters.push(`grayscale(${0.35 + intensity * 0.65}) contrast(${1 + intensity * 0.2})`);
      maxDur = Math.max(maxDur, dur);
    }

    if (command.effect === "slow_zoom" && !eff.expiring) {
      animations.push(`dirSlowZoom ${Math.max(dur, 1.5)}s ease-out forwards`);
    }

    if (command.effect === "impact_zoom" && !eff.expiring) {
      animations.push(`dirImpactZoom ${Math.max(0.35, Math.min(dur, 1.2))}s cubic-bezier(.2,.8,.2,1) forwards`);
    }

    if (command.effect === "tilt" && !eff.expiring) {
      const tiltDur = Math.max(0.5, Math.min(dur, 2));
      animations.push(`dirTilt ${tiltDur}s ease-in-out forwards`);
    }
  }

  if (animations.length > 0) {
    style.animation = animations.join(", ");
  }

  // Always set transition so blur/filter can fade out smoothly
  style.transition = `filter ${maxDur}s ease-out`;

  if (filters.length > 0) {
    style.filter = filters.join(" ");
  }

  return style;
}
