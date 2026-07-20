import {
  createWeatherParticle,
  drawWeatherMoon,
  drawWeatherParticle,
  drawWeatherSun,
  weatherCelestialX,
  weatherCelestialY,
  type WeatherParticle,
  type WeatherRenderConfig,
} from "../lib/weather-renderer";

type InitMessage = {
  type: "init";
  canvas: OffscreenCanvas;
  config: WeatherRenderConfig;
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
const FIREFLY_COUNT = 10;
const STAR_COUNT = 18;

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let config: WeatherRenderConfig | null = null;
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
let nextLightning = Infinity;

function populateParticles() {
  if (!config) return;
  particles = [];
  for (let index = 0; index < config.count; index += 1) {
    particles.push(createWeatherParticle(config.type, width, height));
  }
  if (config.addFireflies) {
    for (let index = 0; index < FIREFLY_COUNT; index += 1) {
      particles.push(createWeatherParticle("firefly", width, height));
    }
  }
  if (config.addStars) {
    for (let index = 0; index < STAR_COUNT; index += 1) {
      particles.push(createWeatherParticle("star", width, height));
    }
  }
}

function resizeSurface(nextWidth: number, nextHeight: number, nextScale: number) {
  if (!canvas || !context) return;
  width = Math.max(1, nextWidth);
  height = Math.max(1, nextHeight);
  scale = Math.max(0.1, nextScale);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawFrame(now: number, advanceSimulation = true) {
  if (!context || !config || hidden) {
    previousTime = now;
    return;
  }

  const elapsed = previousTime === 0 ? FRAME_MS : Math.min(100, now - previousTime);
  previousTime = now;
  const frameScale = advanceSimulation ? Math.min(3, Math.max(0.5, elapsed / BASE_FRAME_MS)) : 0;
  frameCount += frameScale;
  context.clearRect(0, 0, width, height);

  if (config.tint) {
    context.fillStyle = config.tint;
    context.fillRect(0, 0, width, height);
  }
  if (config.overlay) {
    context.fillStyle = config.overlay;
    context.fillRect(0, 0, width, height);
  }

  if (config.lightning) {
    if (frameCount >= nextLightning) {
      lightningAlpha = 0.45 + Math.random() * 0.15;
      nextLightning = frameCount + 400 + Math.random() * 800;
    }
    if (lightningAlpha > 0) {
      context.fillStyle = `rgba(220,230,255,${lightningAlpha})`;
      context.fillRect(0, 0, width, height);
      lightningAlpha *= Math.pow(0.88, frameScale);
      if (lightningAlpha < 0.01) lightningAlpha = 0;
    }
  }

  if (showCelestial && config.isClearSky && config.celestial !== "none") {
    const radius = Math.min(width, height) * 0.035;
    const hour = config.hour >= 0 ? config.hour : 12;
    if (config.celestial === "sun") {
      drawWeatherSun(
        context,
        weatherCelestialX(hour, width),
        weatherCelestialY(hour, height, false),
        radius,
        width,
        height,
        config.sunRays,
        config.sunsetGlow,
        frameCount,
      );
    } else {
      const moonPosition = hour >= 12 ? ((hour - 21 + 24) % 24) / 10 : (hour + 3) / 10;
      const moonX = width * 0.1 + Math.min(1, Math.max(0, moonPosition)) * width * 0.8;
      drawWeatherMoon(context, moonX, weatherCelestialY(hour, height, true), radius * 1.1, frameCount);
    }
  }

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
    drawWeatherParticle(context, particle);
    const outside = particle.y > height + 20 || particle.y < -20 || particle.x > width + 20 || particle.x < -20;
    if (outside || particle.life > particle.maxLife) {
      particles[index] = createWeatherParticle(particle.type, width, height, true);
    }
  }
}

function scheduleFrame() {
  timer = setTimeout(() => {
    try {
      drawFrame(performance.now());
      scheduleFrame();
    } catch {
      timer = null;
      self.postMessage({ type: "render-error" });
    }
  }, FRAME_MS);
}

self.onmessage = (event: MessageEvent<WeatherWorkerMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    canvas = message.canvas;
    context = canvas.getContext("2d");
    config = message.config;
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
    hidden = message.hidden;
    previousTime = performance.now();
  }
};

self.postMessage({ type: "ready" });
