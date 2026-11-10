import {
  createWeatherParticle,
  drawWeatherCelestial,
  createWeatherBolt,
  drawWeatherBolt,
  drawWeatherLightning,
  drawWeatherParticle,
  drawWeatherTint,
  populateWeatherParticles,
  STOCK_WEATHER_LOOK,
  type WeatherBolt,
  type WeatherLook,
  type WeatherParticle,
  type WeatherRenderConfig,
} from "../lib/weather-renderer";

type InitMessage = {
  type: "init";
  canvas: OffscreenCanvas;
  config: WeatherRenderConfig;
  /** The theme's weather look (lib/theme-weather.ts); stock when left out. */
  look?: WeatherLook;
  showCelestial: boolean;
  width: number;
  height: number;
  scale: number;
};

type ResizeMessage = Pick<InitMessage, "width" | "height" | "scale"> & { type: "resize" };
type VisibilityMessage = { type: "visibility"; hidden: boolean };
type WeatherWorkerMessage = InitMessage | ResizeMessage | VisibilityMessage;

const FRAME_MS = 1000 / 30;
const BASE_FRAME_MS = 1000 / 60;

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let config: WeatherRenderConfig | null = null;
let look: WeatherLook = STOCK_WEATHER_LOOK;
let showCelestial = true;
let width = 1;
let height = 1;
let scale = 1;
let particles: WeatherParticle[] = [];
let hidden = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let previousTime = 0;
let frameCount = 0;
let lightningAlpha = 0;
let bolt: WeatherBolt | null = null;
let nextLightning = Infinity;

function populateParticles() {
  if (!config) return;
  particles = populateWeatherParticles(config, look, width, height);
}

function resizeSurface(nextWidth: number, nextHeight: number, nextScale: number) {
  if (!canvas || !context) return;
  width = Math.max(1, nextWidth);
  height = Math.max(1, nextHeight);
  scale = Math.max(0.1, nextScale);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
  // Pixel style: the canvas is smaller than the screen and scaled up crisp by CSS.
  context.imageSmoothingEnabled = look.pixel <= 1;
}

function drawFrame(now: number, advanceSimulation = true) {
  // The scheduler guards suspension. Explicit init/resize draws must still
  // restore the bitmap after a canvas-size change clears it (#5814).
  if (!context || !config) {
    previousTime = now;
    return;
  }

  const elapsed = previousTime === 0 ? FRAME_MS : Math.min(100, now - previousTime);
  previousTime = now;
  const frameScale = advanceSimulation ? Math.min(3, Math.max(0.5, elapsed / BASE_FRAME_MS)) : 0;
  frameCount += frameScale;
  context.clearRect(0, 0, width, height);

  drawWeatherTint(context, config, look, width, height);

  if (config.lightning) {
    if (frameCount >= nextLightning) {
      lightningAlpha = 0.45 + Math.random() * 0.15;
      bolt = look.bolt > 0 ? createWeatherBolt(width, height) : null;
      nextLightning = frameCount + 400 + Math.random() * 800;
    }
    if (lightningAlpha > 0) {
      drawWeatherLightning(context, look, lightningAlpha, width, height);
      drawWeatherBolt(context, bolt, look, lightningAlpha);
      lightningAlpha *= Math.pow(0.88, frameScale);
      if (lightningAlpha < 0.01) lightningAlpha = 0;
    }
  }

  if (showCelestial) drawWeatherCelestial(context, config, look, width, height, frameCount);

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index]!;
    particle.life += frameScale;
    particle.x += particle.vx * frameScale;
    particle.y += particle.vy * frameScale;
    if (["snow", "leaf", "petal", "ash"].includes(particle.type)) {
      particle.wobble += 0.02 * frameScale;
      particle.x += Math.sin(particle.wobble) * 0.5 * frameScale;
    } else if (particle.type === "ember") {
      particle.wobble += 0.04 * frameScale;
      particle.x += Math.sin(particle.wobble) * 0.6 * frameScale;
    } else if (particle.type === "firefly") {
      particle.wobble += 0.03 * frameScale;
      particle.x += Math.sin(particle.wobble) * 0.8 * frameScale;
      particle.y += Math.cos(particle.wobble * 0.7) * 0.4 * frameScale;
    }
    drawWeatherParticle(context, particle, look);
    const outside = particle.y > height + 20 || particle.y < -20 || particle.x > width + 20 || particle.x < -20;
    if (outside || particle.life > particle.maxLife) {
      particles[index] = createWeatherParticle(particle.type, width, height, true, look);
    }
  }
}

function scheduleFrame() {
  if (hidden || timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    if (hidden) return;
    try {
      drawFrame(performance.now());
      scheduleFrame();
    } catch {
      timer = null;
      self.postMessage({ type: "render-error" });
    }
  }, FRAME_MS);
}

function setSuspended(suspended: boolean) {
  hidden = suspended;
  previousTime = performance.now();
  if (hidden) {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    return;
  }
  scheduleFrame();
}

self.onmessage = (event: MessageEvent<WeatherWorkerMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    canvas = message.canvas;
    context = canvas.getContext("2d");
    config = message.config;
    look = message.look ?? STOCK_WEATHER_LOOK;
    showCelestial = message.showCelestial;
    nextLightning = config.lightning ? 200 + Math.random() * 400 : Infinity;
    resizeSurface(message.width, message.height, message.scale);
    populateParticles();
    drawFrame(performance.now());
    if (timer === null) scheduleFrame();
  } else if (message.type === "resize") {
    resizeSurface(message.width, message.height, message.scale);
    // Resizing a canvas clears it. Repaint in the same worker task so the
    // browser never presents a blank weather layer between sidebar layouts.
    drawFrame(performance.now(), false);
  } else {
    setSuspended(message.hidden);
  }
};

self.postMessage({ type: "ready" });
