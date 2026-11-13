// ──────────────────────────────────────────────
// Chat: Dynamic Weather Effects — ambient particles
// that change based on roleplay weather + time of day
// ──────────────────────────────────────────────
import { useEffect, useRef, useMemo, useState, type CSSProperties } from "react";
import { advanceWeatherFrameClock } from "../../lib/weather-frame-clock";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { useSurfaceCovered } from "../../hooks/use-covered-surface-flag";
import { useThemeWeatherLook } from "../../hooks/use-theme-weather";
import { useUIStore } from "../../stores/ui.store";
import type { SceneShelter } from "@marinara-engine/shared";
import {
  createWeatherParticle,
  drawWeatherCelestial,
  createWeatherBolt,
  drawWeatherBolt,
  drawWeatherLightning,
  drawWeatherParticle,
  drawWeatherTint,
  populateWeatherParticles,
  resolveWeatherRenderConfig,
  paintedWeatherRenderConfig,
  shelterWeatherRenderConfig,
  weatherCanvasScaleCap,
  type WeatherBolt,
  type WeatherLook,
  type WeatherParticle,
} from "../../lib/weather-renderer";

const MAX_CANVAS_DPR = 1;
const MAX_CANVAS_PIXELS = 1920 * 1080;
const BASE_FRAME_MS = 1000 / 60;

interface WeatherEffectsProps {
  weather?: string | null;
  timeOfDay?: string | null;
  showCelestial?: boolean;
  /** Freeze ambient rendering while local text generation needs the GPU. */
  paused?: boolean;
  /** "indoors": the weather stays outside (only its colour and lightning light come in). */
  shelter?: SceneShelter;
  /** The chat background is a weather version of this weather, so the picture already shows it. */
  paintedWeather?: boolean;
  /**
   * The window stencil of the painted background (an alpha PNG address on this server) and the
   * background's own zoom. With it, the weather is drawn in full but shows only through the glass.
   */
  windowMask?: { url: string; scale?: number } | null;
}

/** The stencil address once the picture has loaded, so a missing stencil never hides the weather. */
function useLoadedMask(url: string | null): string | null {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setLoaded(url);
    };
    img.onerror = () => {
      if (alive) setLoaded(null);
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return url && loaded === url ? loaded : null;
}

// ═══════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════

export function WeatherEffects({
  weather,
  timeOfDay,
  showCelestial = true,
  paused: pausedByCaller = false,
  shelter = "",
  paintedWeather = false,
  windowMask = null,
}: WeatherEffectsProps) {
  const reduceAmbientEffects = useReducedAmbientEffects();
  const reducedPaintEffects = useUIStore((state) => state.roleplayReducedPaintEffects);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Phone battery: no frames while a panel, an editor or Mari covers the chat (not only when the tab is hidden).
  const covered = useSurfaceCovered(canvasRef, !reduceAmbientEffects);
  const paused = pausedByCaller || covered;
  const themeLook = useThemeWeatherLook(!reduceAmbientEffects);
  // A painted weather version counts as indoors unless the scene is known to be outdoors.
  const indoors = shelter === "indoors" || (paintedWeather && shelter !== "outdoors");
  // Behind the glass: the painted room has a window stencil, so the full weather falls only there.
  const maskUrl = useLoadedMask(paintedWeather && shelter !== "outdoors" ? (windowMask?.url ?? null) : null);
  const masked = !!maskUrl;
  const look = useMemo<WeatherLook>(() => {
    const painted = reducedPaintEffects ? { ...themeLook, flat: true } : themeLook;
    // A drawn bolt would cross the room; indoors only the flash comes through the windows.
    // Behind the glass the drops are far away and few: longer streaks read as rain at that size.
    if (masked) return { ...painted, glass: "window", rainLength: Math.min(3, painted.rainLength * 1.6) };
    // Over a painted outdoor sky the faint kinds (aurora, stars) need the same lift to show at all.
    if (paintedWeather && shelter === "outdoors") return { ...painted, glass: "sky" };
    return indoors && painted.bolt > 0 ? { ...painted, bolt: 0 } : painted;
  }, [themeLook, reducedPaintEffects, indoors, masked, paintedWeather, shelter]);
  const particlesRef = useRef<WeatherParticle[]>([]);
  const frameRef = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const pausedRef = useRef(paused);
  const resumeFallbackRef = useRef<(() => void) | null>(null);
  const [workerFailed, setWorkerFailed] = useState(false);
  pausedRef.current = paused;

  useEffect(() => {
    workerRef.current?.postMessage({ type: "visibility", hidden: document.hidden || paused });
    resumeFallbackRef.current?.();
  }, [paused]);

  const config = useMemo(() => {
    const resolved = resolveWeatherRenderConfig(weather, timeOfDay);
    // Only the windows show (often a sixth of the screen), so three times the falling weather keeps
    // the glass as busy as the open screen would be.
    if (masked) return { ...resolved, count: Math.min(400, resolved.count * 3) };
    return paintedWeather
      ? paintedWeatherRenderConfig(resolved, shelter)
      : shelterWeatherRenderConfig(resolved, shelter);
  }, [weather, timeOfDay, shelter, paintedWeather, masked]);

  // Weather-aware theme art: `<html data-mari-weather="rain" data-mari-sky="night">` while this chat's weather
  // shows. Both are words from a fixed list (never the story's own text), so a theme can match its backdrop.
  useEffect(() => {
    const root = document.documentElement;
    if (config.category) root.dataset.mariWeather = config.category;
    else delete root.dataset.mariWeather;
    if (config.period) root.dataset.mariSky = config.period;
    else delete root.dataset.mariSky;
    if (shelter) root.dataset.mariShelter = shelter;
    else delete root.dataset.mariShelter;
    return () => {
      if (root.dataset.mariWeather === config.category) delete root.dataset.mariWeather;
      if (root.dataset.mariSky === config.period) delete root.dataset.mariSky;
      if (shelter && root.dataset.mariShelter === shelter) delete root.dataset.mariShelter;
    };
  }, [config.category, config.period, shelter]);

  // Render when we have particles, celestial bodies, or time-based ambient effects
  const shouldDrawCelestial =
    showCelestial && config.celestial !== "none" && (config.celestial === "sun" ? look.sun : look.moon);
  const shouldRender =
    !reduceAmbientEffects &&
    (config.count > 0 ||
      config.addFireflies ||
      config.addStars ||
      shouldDrawCelestial ||
      config.sunsetGlow ||
      // Indoors nothing falls, but the weather's colour and lightning still reach the room.
      (indoors && (!!config.overlay || !!config.tint || config.lightning)));

  useEffect(() => {
    if (!shouldRender) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!workerFailed && typeof Worker !== "undefined" && "transferControlToOffscreen" in canvas) {
      let worker: Worker | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let visibilityHandler: (() => void) | null = null;
      let readinessTimer: ReturnType<typeof window.setTimeout> | null = null;

      // Deferring the irreversible transfer also makes this safe under React's
      // development StrictMode effect probe: its first mount is cleaned up
      // before the canvas ownership changes.
      const initializeTimer = window.setTimeout(() => {
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;

        worker = new Worker(new URL("../../workers/weather-effects.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        const failWorker = () => setWorkerFailed(true);
        worker.onerror = failWorker;
        worker.onmessage = (event: MessageEvent<{ type?: string }>) => {
          if (event.data.type === "render-error") {
            failWorker();
            return;
          }
          if (event.data.type !== "ready") return;
          if (readinessTimer !== null) window.clearTimeout(readinessTimer);

          const getScale = (width: number, height: number) => {
            const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
            return Math.min(
              window.devicePixelRatio || 1,
              MAX_CANVAS_DPR,
              pixelBudgetScale,
              weatherCanvasScaleCap(config, look),
            );
          };
          try {
            const offscreen = canvas.transferControlToOffscreen();
            worker?.postMessage(
              {
                type: "init",
                canvas: offscreen,
                config,
                look,
                showCelestial,
                width: rect.width,
                height: rect.height,
                scale: getScale(rect.width, rect.height),
              },
              [offscreen],
            );
          } catch {
            failWorker();
            return;
          }

          resizeObserver = new ResizeObserver((entries) => {
            const size = entries[0]?.contentRect;
            if (!size || size.width <= 0 || size.height <= 0) return;
            worker?.postMessage({
              type: "resize",
              width: size.width,
              height: size.height,
              scale: getScale(size.width, size.height),
            });
          });
          if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

          visibilityHandler = () =>
            worker?.postMessage({ type: "visibility", hidden: document.hidden || pausedRef.current });
          document.addEventListener("visibilitychange", visibilityHandler);
          visibilityHandler();
        };
        readinessTimer = window.setTimeout(failWorker, 3_000);
      }, 0);

      return () => {
        window.clearTimeout(initializeTimer);
        if (readinessTimer !== null) window.clearTimeout(readinessTimer);
        resizeObserver?.disconnect();
        if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
        if (workerRef.current === worker) workerRef.current = null;
        worker?.terminate();
      };
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    let lightningAlpha = 0; // for lightning flash
    let bolt: WeatherBolt | null = null;
    let nextLightning = config.lightning ? 200 + Math.random() * 400 : Infinity;
    let frameCount = 0;
    let previousFrameTime = 0;
    let accumulatedFrameTime = 0;

    let canvasScale = 1;
    let resizePending = false;
    const resize = () => {
      // Resizing clears the bitmap, but a paused animation cannot repaint it.
      // Keep its frozen frame until rendering resumes (community fix #5814).
      if (document.hidden || pausedRef.current) {
        resizePending = true;
        return;
      }
      resizePending = false;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (rect.width * rect.height));
      canvasScale = Math.min(
        window.devicePixelRatio || 1,
        MAX_CANVAS_DPR,
        pixelBudgetScale,
        weatherCanvasScaleCap(config, look),
      );
      canvas.width = Math.max(1, Math.round(rect.width * canvasScale));
      canvas.height = Math.max(1, Math.round(rect.height * canvasScale));
      ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
      ctx.imageSmoothingEnabled = look.pixel <= 1;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles — use CSS pixel dimensions (not canvas resolution)
    particlesRef.current = populateWeatherParticles(
      config,
      look,
      canvas.width / canvasScale,
      canvas.height / canvasScale,
    );

    const tick = (timestamp: number) => {
      if (!running) return;
      if (document.hidden || pausedRef.current) {
        previousFrameTime = timestamp;
        accumulatedFrameTime = 0;
        frameRef.current = 0;
        return;
      }

      if (previousFrameTime === 0) previousFrameTime = timestamp;
      const elapsed = Math.min(100, timestamp - previousFrameTime);
      previousFrameTime = timestamp;
      const frameStep = advanceWeatherFrameClock(accumulatedFrameTime, elapsed);
      accumulatedFrameTime = frameStep.accumulatedMs;
      if (!frameStep.shouldDraw) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const frameScale = Math.min(3, Math.max(0.5, frameStep.frameElapsedMs / BASE_FRAME_MS));

      ctx.clearRect(0, 0, canvas.width / canvasScale, canvas.height / canvasScale);

      const cw = canvas.width / canvasScale;
      const ch = canvas.height / canvasScale;
      drawWeatherTint(ctx, config, look, cw, ch);

      // Lightning flash (epilepsy-safe: capped alpha, gentle decay, long gap between flashes)
      frameCount += frameScale;
      if (config.lightning) {
        if (frameCount >= nextLightning) {
          lightningAlpha = 0.45 + Math.random() * 0.15; // soft flash, max 0.6
          bolt = look.bolt > 0 ? createWeatherBolt(cw, ch) : null; // theme opt-in: a drawn bolt on this flash
          nextLightning = frameCount + 400 + Math.random() * 800; // next in ~7-20s at 60fps
        }
        if (lightningAlpha > 0) {
          drawWeatherLightning(ctx, look, lightningAlpha, cw, ch);
          drawWeatherBolt(ctx, bolt, look, lightningAlpha);
          lightningAlpha *= Math.pow(0.88, frameScale); // gentle decay
          if (lightningAlpha < 0.01) lightningAlpha = 0;
        }
      }

      // ── Celestial bodies (sun / moon) ──
      if (shouldDrawCelestial) drawWeatherCelestial(ctx, config, look, cw, ch, frameCount);

      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += frameScale;

        // Update position
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;

        // Wobble for organic movement
        if (p.type === "snow" || p.type === "leaf" || p.type === "petal" || p.type === "ash") {
          p.wobble += 0.02 * frameScale;
          p.x += Math.sin(p.wobble) * 0.5 * frameScale;
        }
        if (p.type === "ember") {
          p.wobble += 0.04 * frameScale;
          p.x += Math.sin(p.wobble) * 0.6 * frameScale;
        }
        if (p.type === "firefly") {
          p.wobble += 0.03 * frameScale;
          p.x += Math.sin(p.wobble) * 0.8 * frameScale;
          p.y += Math.cos(p.wobble * 0.7) * 0.4 * frameScale;
        }

        drawWeatherParticle(ctx, p, look);

        // Respawn if off-screen or expired
        const offScreen = p.y > ch + 20 || p.y < -20 || p.x > cw + 20 || p.x < -20;
        if (offScreen || p.life > p.maxLife) {
          particles[i] = createWeatherParticle(p.type, cw, ch, true, look);
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    const ensureFallbackRunning = () => {
      if (!running || document.hidden || pausedRef.current || frameRef.current !== 0) return;
      if (resizePending) {
        resize();
        particlesRef.current = particlesRef.current.map((particle) =>
          createWeatherParticle(particle.type, canvas.width / canvasScale, canvas.height / canvasScale, false, look),
        );
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    resumeFallbackRef.current = ensureFallbackRunning;
    const onVisibilityChange = ensureFallbackRunning;
    document.addEventListener("visibilitychange", onVisibilityChange);

    ensureFallbackRunning();

    return () => {
      running = false;
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
      if (resumeFallbackRef.current === ensureFallbackRunning) resumeFallbackRef.current = null;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [config, look, shouldDrawCelestial, shouldRender, showCelestial, workerFailed]);

  // A new look needs a new canvas: a canvas handed to the worker can't be handed over again.
  const lookKey = useMemo(() => {
    const ids = new WeakMap<object, number>();
    let next = 0;
    return JSON.stringify(look, (_key, value) => {
      if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
        if (!ids.has(value)) ids.set(value, next++);
        return `bitmap:${value.width}x${value.height}:${ids.get(value)}`;
      }
      return value;
    });
  }, [look]);
  const lookVersion = useLookVersion(lookKey);

  const maskScale = windowMask?.scale ?? 1;
  const canvasStyle = useMemo<CSSProperties | undefined>(() => {
    const style: CSSProperties = {};
    if (look.pixel > 1) style.imageRendering = "pixelated";
    if (maskUrl) {
      // Lined up with the background picture: cover, centred, and the same zoom its blur adds.
      const image = `url("${maskUrl}")`;
      Object.assign(style, {
        maskImage: image,
        WebkitMaskImage: image,
        maskSize: "cover",
        WebkitMaskSize: "cover",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskMode: "alpha",
      });
      if (maskScale !== 1) style.transform = `scale(${maskScale})`;
    }
    return Object.keys(style).length > 0 ? style : undefined;
  }, [look.pixel, maskUrl, maskScale]);

  if (!shouldRender) return null;

  return (
    <canvas
      key={`${weather ?? ""}:${timeOfDay ?? ""}:${masked ? "masked:" : ""}${showCelestial ? "celestial" : "particles"}:${workerFailed ? "fallback" : "worker"}:${lookVersion}`}
      ref={canvasRef}
      data-mari-part="weather"
      data-paused={paused ? "true" : undefined}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full [contain:strict]"
      style={canvasStyle}
    />
  );
}

/** A number that goes up whenever the key changes (short canvas keys instead of the whole look). */
function useLookVersion(key: string) {
  const ref = useRef({ key, version: 0 });
  if (ref.current.key !== key) ref.current = { key, version: ref.current.version + 1 };
  return ref.current.version;
}
