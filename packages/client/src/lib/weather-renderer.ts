import { sceneWeatherCategory, type SceneShelter } from "@marinara-engine/shared";

// ── Particle types ──
export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  type:
    | "rain"
    | "snow"
    | "leaf"
    | "firefly"
    | "star"
    | "fog"
    | "dust"
    | "petal"
    | "ember"
    | "ash"
    | "sand"
    | "hail"
    | "aurora";
  wobble: number;
  life: number;
  maxLife: number;
  /** Pre-computed fill colour (ash, sand) to avoid Math.random() in draw */
  color: string;
  /** Which of a theme's pictures this particle uses (0-3). */
  variant?: number;
}

type WeatherCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface WeatherRenderConfig {
  type: WeatherParticle["type"];
  count: number;
  overlay: string;
  lightning: boolean;
  tint: string;
  addFireflies: boolean;
  addStars: boolean;
  celestial: CelestialBody;
  hour: number;
  sunRays: boolean;
  sunsetGlow: boolean;
  isClearSky: boolean;
  /** Coarse weather word for themes (`data-mari-weather`), from a fixed list; "" when there is no weather. */
  category: WeatherCategory | "";
  /** Coarse time of day for themes (`data-mari-sky`); "" when unknown. */
  period: WeatherPeriod | "";
}

export const WEATHER_CATEGORIES = [
  "clear",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "hail",
  "fog",
  "sand",
  "ash",
  "embers",
  "wind",
  "blossom",
  "aurora",
] as const;
export type WeatherCategory = (typeof WEATHER_CATEGORIES)[number];
export type WeatherPeriod = "dawn" | "day" | "dusk" | "night";

// ── Theme look (theme weather tokens) ──
// A theme restyles the weather with `--mari-weather-*` tokens (lib/theme-weather.ts reads and checks them).
// The renderer only ever sees this plain object: numbers, "r,g,b" colours and decoded pictures.

export type WeatherLookKind = WeatherParticle["type"] | "sun" | "moon";

export interface WeatherKindLook {
  /** "r,g,b" */
  color?: string;
  /** Size multiplier, 0.5-3. */
  size?: number;
  shape?: "round" | "square";
  /** Up to 4 of the theme's own pictures, already decoded. */
  images?: ImageBitmap[];
}

export interface WeatherLook {
  /** 1 = smooth (stock); 2-6 = pixel style, the layer drawn at 1/pixel resolution. */
  pixel: number;
  speed: number;
  amount: number;
  strength: number;
  tint: number;
  rainLength: number;
  sun: boolean;
  moon: boolean;
  /** "r,g,b"; the flash strength stays the app's. */
  lightning: string | null;
  /** Drawn lightning bolts during a storm's flash: 0 = flash only (stock), else the bolt's width, 0.5-3. */
  bolt: number;
  /** Reduced paint effects: no tint, glow or sunset wash, and 60% of the particles. */
  flat: boolean;
  /**
   * Drawn behind a window stencil: only a small part of the screen shows, far away, so faint
   * particles (rain, hail) are drawn stronger to read through the glass.
   */
  glass?: boolean;
  kinds: Partial<Record<WeatherLookKind, WeatherKindLook>>;
}

export const STOCK_WEATHER_LOOK: WeatherLook = {
  pixel: 1,
  speed: 1,
  amount: 1,
  strength: 1,
  tint: 1,
  rainLength: 1,
  sun: true,
  moon: true,
  lightning: null,
  bolt: 0,
  flat: false,
  kinds: {},
};

export const WEATHER_FIREFLY_COUNT = 10;
export const WEATHER_STAR_COUNT = 18;

/** How many particles of each type a weather gets, after the theme's amount and Reduced paint effects. */
export function weatherPopulation(config: WeatherRenderConfig, look: WeatherLook = STOCK_WEATHER_LOOK) {
  const factor = Math.max(0, Math.min(1, look.amount)) * (look.flat ? 0.6 : 1);
  const scaled = (count: number) => (count > 0 ? Math.max(1, Math.round(count * factor)) : 0);
  const out: Array<[WeatherParticle["type"], number]> = [];
  if (config.count > 0) out.push([config.type, scaled(config.count)]);
  if (config.addFireflies) out.push(["firefly", scaled(WEATHER_FIREFLY_COUNT)]);
  if (config.addStars) out.push(["star", scaled(WEATHER_STAR_COUNT)]);
  return out;
}

export function populateWeatherParticles(
  config: WeatherRenderConfig,
  look: WeatherLook,
  width: number,
  height: number,
): WeatherParticle[] {
  const particles: WeatherParticle[] = [];
  for (const [type, count] of weatherPopulation(config, look)) {
    for (let index = 0; index < count; index += 1)
      particles.push(createWeatherParticle(type, width, height, false, look));
  }
  return particles;
}

/** The sky tint and weather overlay, scaled by the theme's tint strength (none with Reduced paint effects). */
export function drawWeatherTint(
  ctx: WeatherCanvasContext,
  config: WeatherRenderConfig,
  look: WeatherLook,
  width: number,
  height: number,
) {
  if (look.flat || look.tint <= 0) return;
  ctx.globalAlpha = Math.min(1, look.tint);
  if (config.type === "fog") {
    // Fog: mist that thickens toward the ground instead of one flat grey layer.
    const tone = look.kinds.fog?.color ?? FOG_TONE;
    const mist = ctx.createLinearGradient(0, 0, 0, height);
    mist.addColorStop(0, `rgba(${tone},0)`);
    mist.addColorStop(0.45, `rgba(${tone},0.02)`);
    mist.addColorStop(0.75, `rgba(${tone},0.1)`);
    mist.addColorStop(1, `rgba(${tone},0.32)`);
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    return;
  }
  if (config.tint) {
    ctx.fillStyle = config.tint;
    ctx.fillRect(0, 0, width, height);
  }
  if (config.overlay) {
    ctx.fillStyle = config.overlay;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalAlpha = 1;
}

/** The lightning flash. Its strength and timing stay the app's epilepsy-safe values; a theme picks only the colour. */
export function drawWeatherLightning(
  ctx: WeatherCanvasContext,
  look: WeatherLook,
  alpha: number,
  width: number,
  height: number,
) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(${look.lightning ?? "220,230,255"},${Math.min(0.6, alpha)})`;
  ctx.fillRect(0, 0, width, height);
}

export interface WeatherBolt {
  /** The main channel, top to bottom, in CSS px. */
  trunk: Array<[number, number]>;
  /** One or two forks off the trunk. */
  forks: Array<Array<[number, number]>>;
}

function jagged(x: number, y: number, dx: number, length: number, steps: number, random: () => number) {
  const points: Array<[number, number]> = [[x, y]];
  const step = length / steps;
  for (let i = 0; i < steps; i += 1) {
    x += dx * step + (random() - 0.5) * step * 1.1;
    y += step * (0.75 + random() * 0.5);
    points.push([x, y]);
  }
  return points;
}

/**
 * A new forked bolt for one flash. It strikes down the outer edge of the screen (3-12% or 88-97% across), never the
 * middle, so it doesn't cross the chat text, and it reaches 55-90% of the height. Two to four forks branch off
 * the trunk, and a long fork can split once more, so it reads as a real branching strike, not a crack.
 */
export function createWeatherBolt(width: number, height: number, random: () => number = Math.random): WeatherBolt {
  const left = random() < 0.5;
  const x = width * (left ? 0.03 + random() * 0.09 : 0.88 + random() * 0.09);
  const length = height * (0.55 + random() * 0.35);
  const lean = (left ? -1 : 1) * random() * 0.15;
  const trunk = jagged(x, -4, lean, length, 11 + Math.floor(random() * 4), random);
  const forks: WeatherBolt["forks"] = [];
  const forkCount = 2 + Math.floor(random() * 3);
  for (let f = 0; f < forkCount; f += 1) {
    const from = trunk[2 + Math.floor(random() * (trunk.length - 5))]!;
    const side = random() < 0.5 ? -1 : 1;
    const forkLength = length * (0.18 + random() * 0.22);
    const fork = jagged(from[0], from[1], side * (0.5 + random() * 0.4), forkLength, 5, random);
    forks.push(fork);
    if (forkLength > length * 0.28 && random() < 0.6) {
      const twig = fork[2]!;
      forks.push(jagged(twig[0], twig[1], -side * (0.3 + random() * 0.4), forkLength * 0.45, 3, random));
    }
  }
  return { trunk, forks };
}

function strokeBolt(
  ctx: WeatherCanvasContext,
  points: Array<[number, number]>,
  look: WeatherLook,
  width: number,
  color: string,
) {
  if (look.pixel > 1) {
    // Pixel style: step along each segment on the weather grid, blocks the size of the width.
    const g = look.pixel;
    const block = Math.max(g, Math.round(width / g) * g);
    ctx.fillStyle = `rgb(${color})`;
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1]!;
      const [x1, y1] = points[i]!;
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / g));
      for (let k = 0; k <= n; k += 1) {
        ctx.fillRect(snap(x0 + ((x1 - x0) * k) / n, look), snap(y0 + ((y1 - y0) * k) / n, look), block, block);
      }
    }
    return;
  }
  ctx.strokeStyle = `rgb(${color})`;
  ctx.lineWidth = width;
  ctx.lineJoin = "miter";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]![0], points[i]![1]);
  ctx.stroke();
}

/**
 * The bolt for the current flash, opted in by the theme (`--mari-weather-lightning-bolt`). It shows only while
 * the app's own epilepsy-safe flash is up and fades with it, so a theme never adds flashes or speeds them up.
 */
export function drawWeatherBolt(ctx: WeatherCanvasContext, bolt: WeatherBolt | null, look: WeatherLook, alpha: number) {
  if (!bolt || look.bolt <= 0 || alpha <= 0) return;
  const color = look.lightning ?? "220,230,255";
  const strength = Math.min(1, alpha * 1.7);
  ctx.save();
  if (!look.flat && look.pixel <= 1) {
    // A wide faint halo, a tighter glow, then the bright core, so the bolt reads as light, not a line.
    ctx.globalAlpha = strength * 0.16;
    strokeBolt(ctx, bolt.trunk, look, 18 * look.bolt, color);
    for (const fork of bolt.forks) strokeBolt(ctx, fork, look, 10 * look.bolt, color);
    ctx.globalAlpha = strength * 0.45;
    strokeBolt(ctx, bolt.trunk, look, 7 * look.bolt, color);
    for (const fork of bolt.forks) strokeBolt(ctx, fork, look, 4 * look.bolt, color);
  }
  ctx.globalAlpha = strength;
  strokeBolt(ctx, bolt.trunk, look, 2.6 * look.bolt, look.pixel > 1 ? color : "255,255,255");
  ctx.globalAlpha = strength * 0.85;
  for (const fork of bolt.forks) strokeBolt(ctx, fork, look, 1.3 * look.bolt, look.pixel > 1 ? color : "255,255,255");
  ctx.restore();
}

/** Sun or moon, unless the theme's art already has one (`--mari-weather-sun: none`). */
export function drawWeatherCelestial(
  ctx: WeatherCanvasContext,
  config: WeatherRenderConfig,
  look: WeatherLook,
  width: number,
  height: number,
  frameCount: number,
) {
  if (!config.isClearSky || config.celestial === "none") return;
  const isSun = config.celestial === "sun";
  if (isSun ? !look.sun : !look.moon) return;
  const kindLook = look.kinds[isSun ? "sun" : "moon"];
  const radius = Math.min(width, height) * 0.035 * (kindLook?.size ?? 1) * (isSun ? 1 : 1.1);
  const hour = config.hour >= 0 ? config.hour : 12;
  let x: number;
  let y: number;
  if (isSun) {
    x = weatherCelestialX(hour, width);
    y = weatherCelestialY(hour, height, false);
  } else {
    // Moon position: map 21h→left, 0h→center, 5h→right
    const moonNorm = hour >= 12 ? ((hour - 21 + 24) % 24) / 10 : (hour + 3) / 10;
    x = width * 0.1 + Math.min(1, Math.max(0, moonNorm)) * width * 0.8;
    y = weatherCelestialY(hour, height, true);
  }
  const image = kindLook?.images?.[0];
  if (image) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.9 * look.strength);
    const side = radius * 2.4;
    const ratio = image.width / Math.max(1, image.height);
    const w = ratio >= 1 ? side : side * ratio;
    const h = ratio >= 1 ? side / ratio : side;
    ctx.drawImage(image, snap(x - w / 2, look), snap(y - h / 2, look), w, h);
    ctx.restore();
    return;
  }
  if (look.pixel > 1) {
    drawPixelDisc(
      ctx,
      x,
      y,
      radius,
      look,
      isSun ? (kindLook?.color ?? "255,236,170") : (kindLook?.color ?? "230,235,255"),
      !isSun,
    );
    return;
  }
  if (isSun)
    drawWeatherSun(
      ctx,
      x,
      y,
      radius,
      width,
      height,
      config.sunRays && !look.flat,
      config.sunsetGlow && !look.flat,
      frameCount,
      kindLook?.color,
    );
  else drawWeatherMoon(ctx, x, y, radius, frameCount, kindLook?.color, look.flat);
}

const FOG_TONE = "205,208,222";

/**
 * The most canvas pixels per CSS pixel the weather needs. Pixel style draws at its grid size. Fog is all soft
 * shapes, so it draws at about a third of the resolution and the browser smooths it up: much less to paint.
 */
export function weatherCanvasScaleCap(config: Pick<WeatherRenderConfig, "type">, look: WeatherLook) {
  if (look.pixel > 1) return 1 / look.pixel;
  return config.type === "fog" ? 0.35 : Infinity;
}

function snap(value: number, look: WeatherLook) {
  return look.pixel > 1 ? Math.round(value / look.pixel) * look.pixel : value;
}

function drawPixelDisc(
  ctx: WeatherCanvasContext,
  x: number,
  y: number,
  radius: number,
  look: WeatherLook,
  color: string,
  crescent: boolean,
) {
  const g = look.pixel;
  const r = Math.max(g * 2, radius);
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.85 * look.strength);
  ctx.fillStyle = `rgb(${color})`;
  for (let dy = -r; dy <= r; dy += g) {
    for (let dx = -r; dx <= r; dx += g) {
      if (dx * dx + dy * dy > r * r) continue;
      if (crescent && (dx - r * 0.6) ** 2 + (dy + r * 0.15) ** 2 <= (r * 0.75) ** 2) continue;
      ctx.fillRect(snap(x + dx, look), snap(y + dy, look), g, g);
    }
  }
  ctx.restore();
}

// ── Map weather string → effect config ──
function parseWeather(weather?: string | null): {
  type: WeatherParticle["type"];
  count: number;
  overlay: string;
  lightning: boolean;
} {
  if (!weather) return { type: "dust", count: 0, overlay: "", lightning: false };

  const w = weather.toLowerCase();

  // Thunderstorm / lightning
  if (w.includes("thunder") || w.includes("lightning")) {
    return { type: "rain", count: 120, overlay: "rgba(50,80,120,0.10)", lightning: true };
  }
  if (w.includes("hail")) {
    return { type: "hail", count: 40, overlay: "rgba(180,200,230,0.06)", lightning: false };
  }
  if (w.includes("blizzard")) {
    return { type: "snow", count: 90, overlay: "rgba(200,220,255,0.10)", lightning: false };
  }
  if (w.includes("snow") || w.includes("sleet")) {
    const isHeavy = w.includes("heavy");
    return { type: "snow", count: isHeavy ? 75 : 35, overlay: "rgba(200,220,255,0.06)", lightning: false };
  }
  if (w.includes("frost") || w.includes("cold") || w.includes("freez")) {
    return { type: "snow", count: 12, overlay: "rgba(180,210,240,0.06)", lightning: false };
  }
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) {
    return { type: "fog", count: 14, overlay: "rgba(180,180,200,0.12)", lightning: false };
  }
  if (w.includes("sand") || w.includes("dust storm") || w.includes("sirocco")) {
    return { type: "sand", count: 65, overlay: "rgba(180,150,100,0.12)", lightning: false };
  }
  if (w.includes("ash") || w.includes("volcanic") || w.includes("smoke")) {
    return { type: "ash", count: 30, overlay: "rgba(80,60,60,0.10)", lightning: false };
  }
  if (w.includes("ember") || w.includes("fire") || w.includes("inferno")) {
    return { type: "ember", count: 24, overlay: "rgba(120,40,10,0.08)", lightning: false };
  }
  if (w.includes("wind") || w.includes("breez") || w.includes("gust")) {
    return { type: "leaf", count: 18, overlay: "", lightning: false };
  }
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) {
    return { type: "petal", count: 22, overlay: "rgba(255,180,200,0.04)", lightning: false };
  }
  if (w.includes("aurora") || w.includes("northern light") || w.includes("polar light")) {
    return { type: "aurora", count: 6, overlay: "rgba(20,60,40,0.08)", lightning: false };
  }
  if (w.includes("rain") || w.includes("storm") || w.includes("downpour")) {
    const isHeavy = w.includes("heavy") || w.includes("storm") || w.includes("downpour");
    return {
      type: "rain",
      count: isHeavy ? 120 : 55,
      overlay: "rgba(50,80,120,0.08)",
      lightning: isHeavy && w.includes("storm"),
    };
  }
  if (w.includes("clear") || w.includes("sunny") || w.includes("bright")) {
    return { type: "dust", count: 8, overlay: "", lightning: false };
  }
  if (w.includes("cloud") || w.includes("overcast") || w.includes("grey") || w.includes("gray")) {
    return { type: "dust", count: 6, overlay: "rgba(100,100,120,0.05)", lightning: false };
  }

  return { type: "dust", count: 8, overlay: "", lightning: false };
}

// ── Map time of day → tint + fireflies ──
type CelestialBody = "sun" | "moon" | "none";

function parseTime(
  timeOfDay?: string | null,
  baseType?: WeatherParticle["type"],
): {
  tint: string;
  addFireflies: boolean;
  addStars: boolean;
  celestial: CelestialBody;
  hour: number; // 0-24, -1 if unknown
  sunRays: boolean;
  sunsetGlow: boolean;
  isClearSky: boolean; // derived later; default false here
} {
  const base = {
    tint: "",
    addFireflies: false,
    addStars: false,
    celestial: "none" as CelestialBody,
    hour: -1,
    sunRays: false,
    sunsetGlow: false,
    isClearSky: false,
  };

  if (!timeOfDay) return base;

  const t = timeOfDay.toLowerCase();

  // Try to extract a numeric hour from the time string ("14:30", "2 PM", "1400", etc.)
  const hour = extractHour(t);
  base.hour = hour;

  if (t.includes("night") || t.includes("midnight")) {
    return {
      ...base,
      tint: "rgba(10,10,40,0.15)",
      addFireflies: baseType !== "rain" && baseType !== "snow",
      addStars: baseType !== "fog" && baseType !== "snow",
      celestial: "moon",
      hour: hour >= 0 ? hour : 0,
    };
  }
  if (t.includes("dusk") || t.includes("sunset") || t.includes("twilight") || t.includes("evening")) {
    return {
      ...base,
      tint: "rgba(80,30,20,0.10)",
      addFireflies: baseType !== "rain",
      addStars: false,
      celestial: "sun",
      hour: hour >= 0 ? hour : 18,
      sunsetGlow: true,
    };
  }
  if (t.includes("dawn") || t.includes("sunrise") || t.includes("morning")) {
    return {
      ...base,
      tint: "rgba(120,80,40,0.06)",
      celestial: "sun",
      hour: hour >= 0 ? hour : 7,
      sunRays: true,
    };
  }

  // Numeric hour fallback — determine time period from hour
  if (hour >= 0) {
    if (hour >= 21 || hour < 5) {
      return {
        ...base,
        tint: "rgba(10,10,40,0.15)",
        addFireflies: baseType !== "rain" && baseType !== "snow",
        addStars: baseType !== "fog" && baseType !== "snow",
        celestial: "moon",
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        ...base,
        tint: "rgba(80,30,20,0.10)",
        addFireflies: baseType !== "rain",
        celestial: "sun",
        sunsetGlow: hour >= 17,
      };
    }
    if (hour >= 5 && hour < 9) {
      return {
        ...base,
        tint: "rgba(120,80,40,0.06)",
        celestial: "sun",
        sunRays: true,
      };
    }
    // Daytime (9-17)
    return {
      ...base,
      celestial: "sun",
      sunRays: true,
    };
  }

  // If it just says "afternoon", "day", "noon", etc.
  if (t.includes("noon") || t.includes("midday") || t.includes("afternoon") || t.includes("day")) {
    return {
      ...base,
      celestial: "sun",
      hour: t.includes("afternoon") ? 15 : 12,
      sunRays: true,
    };
  }

  return base;
}

/** Try to extract an hour (0-23) from a time string. Returns -1 if not found. */
function extractHour(t: string): number {
  // "14:30", "2:00 PM", "14h30", "1400"
  const match24 = t.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (match24) {
    let h = parseInt(match24[1]!, 10);
    if (t.includes("pm") && h < 12) h += 12;
    if (t.includes("am") && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  // "2 PM", "11 AM"
  const matchAmPm = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1]!, 10);
    if (matchAmPm[2] === "pm" && h < 12) h += 12;
    if (matchAmPm[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  // Military "1400", "0800"
  const matchMil = t.match(/\b(\d{4})\s*(?:hours?|hrs?)?\b/);
  if (matchMil) {
    const h = parseInt(matchMil[1]!.slice(0, 2), 10);
    if (h >= 0 && h < 24) return h;
  }
  return -1;
}

export function resolveWeatherRenderConfig(weather?: string | null, timeOfDay?: string | null): WeatherRenderConfig {
  const weatherConfig = parseWeather(weather);
  const timeConfig = parseTime(timeOfDay, weatherConfig.type);
  const isClearSky =
    !weather ||
    /clear|sunny|bright/i.test(weather) ||
    !/(rain|storm|snow|blizzard|fog|mist|haze|hail|sand|ash|smoke|overcast|cloud|grey|gray)/i.test(weather);
  return {
    ...weatherConfig,
    ...timeConfig,
    isClearSky,
    category: weatherCategory(weather),
    period: weatherPeriod(timeConfig),
  };
}

/** The story weather as one word from WEATHER_CATEGORIES (never the story's own text). Shared with weather versions of backgrounds. */
function weatherCategory(weather: string | null | undefined): WeatherCategory | "" {
  return sceneWeatherCategory(weather);
}

/**
 * Indoors the weather is outside: no particles, fog banks, stars, fireflies, sun or moon across the
 * room, only the colour cast and lightning light through the windows. A weather version of the chat
 * background shows the weather itself in the windows.
 */
export function shelterWeatherRenderConfig(config: WeatherRenderConfig, shelter: SceneShelter): WeatherRenderConfig {
  if (shelter !== "indoors") return config;
  return {
    ...config,
    type: "dust",
    count: 0,
    addFireflies: false,
    addStars: false,
    celestial: "none",
    sunRays: false,
  };
}

/**
 * The chat background already shows this weather (a weather version of the picture): the picture
 * carries it. Unless the scene is known to be outdoors, nothing falls (the weather is in the window);
 * outdoors, no fog banks and a third of the particles, so the painted rain or snow isn't doubled.
 */
const STILL_SKY = { count: 0, addStars: false, addFireflies: false } as const;

/**
 * Weather with nothing falling (an aurora, a clear or unusual sky such as a meteor shower): the
 * painted picture says it all, so nothing is drawn over it.
 */
export function paintedSkyStill(config: WeatherRenderConfig): boolean {
  return config.type === "aurora" || config.category === "clear" || config.category === "cloudy";
}

/** A painted weather version's sky with nothing drawn over it (only the tint stays). */
export function stillPaintedSky(config: WeatherRenderConfig): WeatherRenderConfig {
  return { ...config, ...STILL_SKY, celestial: "none", sunRays: false };
}

export function paintedWeatherRenderConfig(config: WeatherRenderConfig, shelter: SceneShelter): WeatherRenderConfig {
  if (shelter !== "outdoors") return shelterWeatherRenderConfig(config, "indoors");
  // The painted sky already has its own sun or moon (or clouds hiding them).
  const sky = { celestial: "none" as const, sunRays: false };
  if (config.type === "fog") return { ...config, ...sky, type: "dust", count: 0 };
  if (paintedSkyStill(config)) return { ...config, ...sky, ...STILL_SKY };
  return { ...config, ...sky, count: Math.round(config.count / 3) };
}

function weatherPeriod(time: ReturnType<typeof parseTime>): WeatherPeriod | "" {
  if (time.celestial === "moon") return "night";
  if (time.sunsetGlow) return "dusk";
  if (time.celestial === "sun") return time.tint && time.sunRays ? "dawn" : "day";
  return "";
}

// ── Create particle ──
export function createWeatherParticle(
  type: WeatherParticle["type"],
  w: number,
  h: number,
  fromTop = false,
  look: WeatherLook = STOCK_WEATHER_LOOK,
): WeatherParticle {
  const base: WeatherParticle = {
    x: Math.random() * w,
    y: fromTop ? -10 : Math.random() * h,
    vx: 0,
    vy: 0,
    size: 2,
    opacity: 0.5,
    type,
    wobble: Math.random() * Math.PI * 2,
    life: 0,
    maxLife: 600 + Math.random() * 400,
    color: "",
    variant: Math.floor(Math.random() * 4),
  };

  switch (type) {
    case "rain":
      base.vy = 8 + Math.random() * 6;
      base.vx = -1 + Math.random() * -2;
      base.size = 1.5;
      base.opacity = 0.25 + Math.random() * 0.2;
      base.maxLife = 200;
      break;
    case "snow":
      base.vy = 0.5 + Math.random() * 1.2;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 800;
      break;
    case "leaf":
      base.vy = 0.8 + Math.random() * 1;
      base.vx = 1.5 + Math.random() * 2;
      base.size = 4 + Math.random() * 3;
      base.opacity = 0.5 + Math.random() * 0.3;
      base.maxLife = 500;
      break;
    case "petal":
      base.vy = 0.4 + Math.random() * 0.8;
      base.vx = 0.5 + Math.random() * 1;
      base.size = 3 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 600;
      break;
    case "firefly":
      base.vy = -0.2 + Math.random() * 0.4;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 2;
      base.opacity = 0;
      base.maxLife = 300 + Math.random() * 300;
      break;
    case "star":
      base.vy = 0;
      base.vx = 0;
      base.size = 1 + Math.random() * 1.5;
      base.opacity = 0;
      base.maxLife = 400 + Math.random() * 400;
      base.y = Math.random() * h * 0.4; // upper portion
      break;
    case "fog": {
      // Slow banks low on the screen, drifting either way. Each starts where it won't drift off an edge
      // before it fades, so none pops out.
      base.vy = 0;
      base.vx = (0.15 + Math.random() * 0.3) * (Math.random() < 0.3 ? -1 : 1);
      base.size = Math.min(110 + Math.random() * 150, h * 0.4);
      base.opacity = 0.45 + Math.random() * 0.35;
      base.maxLife = 900 + Math.random() * 700;
      const travel = Math.min(w, Math.abs(base.vx) * base.maxLife);
      base.x = (base.vx > 0 ? 0 : travel) + Math.random() * Math.max(0, w - travel);
      base.y = h * (0.62 + Math.random() * 0.38); // low, hugging the ground
      break;
    }
    case "dust":
      base.vy = -0.1 + Math.random() * 0.2;
      base.vx = -0.1 + Math.random() * 0.2;
      base.size = 1 + Math.random() * 2;
      base.opacity = 0.15 + Math.random() * 0.15;
      base.maxLife = 600 + Math.random() * 400;
      break;
    case "ember":
      base.vy = -1.5 + Math.random() * -1.5;
      base.vx = -0.5 + Math.random() * 1;
      base.size = 2 + Math.random() * 2;
      base.opacity = 0.6 + Math.random() * 0.3;
      base.maxLife = 300 + Math.random() * 200;
      base.y = h + 10; // rise from bottom
      break;
    case "ash":
      base.vy = 0.3 + Math.random() * 0.6;
      base.vx = -0.4 + Math.random() * 0.8;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.2 + Math.random() * 0.2;
      base.maxLife = 700 + Math.random() * 300;
      base.color = `rgba(${(100 + Math.random() * 40) | 0},${(90 + Math.random() * 30) | 0},${(90 + Math.random() * 30) | 0},0.6)`;
      break;
    case "sand":
      base.vy = 0.5 + Math.random() * 1;
      base.vx = 4 + Math.random() * 4;
      base.size = 1 + Math.random() * 2;
      base.opacity = 0.3 + Math.random() * 0.3;
      base.maxLife = 250 + Math.random() * 150;
      base.x = -10; // enter from left
      base.color = `rgba(${(200 + Math.random() * 30) | 0},${(170 + Math.random() * 30) | 0},${(110 + Math.random() * 20) | 0},0.7)`;
      break;
    case "hail":
      base.vy = 10 + Math.random() * 6;
      base.vx = -1 + Math.random() * -1;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 150;
      break;
    case "aurora":
      base.vy = 0;
      base.vx = 0.1 + Math.random() * 0.2;
      base.size = 80 + Math.random() * 120;
      base.opacity = 0.04 + Math.random() * 0.03;
      base.maxLife = 1200 + Math.random() * 600;
      base.y = Math.random() * h * 0.35; // upper sky
      break;
  }

  if (look !== STOCK_WEATHER_LOOK) {
    const speed = Math.max(0.5, Math.min(1.5, look.speed));
    base.vx *= speed;
    base.vy *= speed;
    base.size *= Math.max(0.5, Math.min(3, look.kinds[type]?.size ?? 1));
  }

  return base;
}

// ── Draw helpers ──
/** How much stronger each kind is drawn behind a window stencil. */
const GLASS_BOOST: Record<WeatherParticle["type"], number> = {
  rain: 2.2,
  snow: 1.3,
  leaf: 1.2,
  petal: 1.3,
  firefly: 1.3,
  star: 1.6,
  fog: 1.5,
  dust: 1,
  ember: 1.3,
  ash: 1.3,
  sand: 1.3,
  hail: 1.6,
  aurora: 1,
};

export function drawWeatherParticle(
  ctx: WeatherCanvasContext,
  p: WeatherParticle,
  look: WeatherLook = STOCK_WEATHER_LOOK,
) {
  // Fog banks fade in and out slowly and stay full in between; everything else fades over its life.
  const fadeIn = Math.min(p.life / (p.type === "fog" ? 240 : 60), 1);
  const fadeOut =
    p.type === "fog" ? Math.max(0, Math.min(1, (p.maxLife - p.life) / 240)) : Math.max(1 - p.life / p.maxLife, 0);
  const alpha = Math.min(
    1,
    p.opacity * fadeIn * fadeOut * Math.max(0.5, Math.min(1.5, look.strength)) * (look.glass ? GLASS_BOOST[p.type] : 1),
  );
  if (alpha <= 0) return;

  const kindLook = look.kinds[p.type];
  const images = kindLook?.images;
  if (images && images.length > 0) {
    drawWeatherSprite(ctx, p, images[(p.variant ?? 0) % images.length]!, look, alpha);
    return;
  }
  if (look.pixel > 1) {
    drawPixelParticle(ctx, p, look, alpha);
    return;
  }

  ctx.globalAlpha = alpha;
  const tone = kindLook?.color;
  if (kindLook?.shape === "square" && p.type !== "rain" && p.type !== "fog" && p.type !== "aurora") {
    ctx.fillStyle = `rgba(${tone ?? stockTone(p)},0.9)`;
    const side = Math.max(1, p.size * (p.type === "leaf" || p.type === "petal" ? 0.6 : 1.4));
    ctx.fillRect(p.x - side / 2, p.y - side / 2, side, side);
    ctx.globalAlpha = 1;
    return;
  }

  switch (p.type) {
    case "rain": {
      ctx.strokeStyle = `rgba(${tone ?? "180,210,255"},0.8)`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const streak = 2 * Math.max(0.5, Math.min(3, look.rainLength));
      ctx.lineTo(p.x + p.vx * streak, p.y + p.vy * streak);
      ctx.stroke();
      break;
    }
    case "snow": {
      ctx.fillStyle = `rgba(${tone ?? "255,255,255"},0.82)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "leaf": {
      ctx.fillStyle = tone ? `rgb(${tone})` : `hsl(${100 + Math.sin(p.wobble) * 30}, 60%, 45%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "petal": {
      ctx.fillStyle = tone ? `rgb(${tone})` : `hsl(${340 + Math.sin(p.wobble) * 15}, 80%, 80%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "firefly": {
      const pulse = Math.sin(p.life * 0.05) * 0.5 + 0.5;
      if (!look.flat) {
        ctx.globalAlpha = alpha * 0.28 * pulse;
        ctx.fillStyle = `rgba(${tone ?? "180,255,80"},0.7)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha * (0.65 + pulse * 0.35);
      ctx.fillStyle = `rgba(${tone ?? "220,255,130"},0.95)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "star": {
      const twinkle = Math.sin(p.life * 0.04 + p.wobble) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(${tone ?? "255,255,240"},${twinkle * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // cross sparkle
      ctx.strokeStyle = `rgba(${tone ?? "255,255,240"},${twinkle * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size * 2, p.y);
      ctx.lineTo(p.x + p.size * 2, p.y);
      ctx.moveTo(p.x, p.y - p.size * 2);
      ctx.lineTo(p.x, p.y + p.size * 2);
      ctx.stroke();
      break;
    }
    case "fog": {
      const fog = tone ?? FOG_TONE;
      if (look.flat) {
        // Reduced paint: one plain soft-edged shape, no gradient.
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = `rgba(${fog},0.12)`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 2.2, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // A wide, soft bank: a radial fade stretched sideways.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(2.4, 0.45);
      const bank = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      bank.addColorStop(0, `rgba(${fog},0.32)`);
      bank.addColorStop(0.55, `rgba(${fog},0.16)`);
      bank.addColorStop(1, `rgba(${fog},0)`);
      ctx.fillStyle = bank;
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
      break;
    }
    case "dust": {
      ctx.fillStyle = `rgba(${tone ?? "255,240,220"},0.6)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ember": {
      const emberPulse = Math.sin(p.life * 0.08) * 0.3 + 0.7;
      if (!look.flat) {
        ctx.globalAlpha = alpha * 0.32 * emberPulse;
        ctx.fillStyle = `rgba(${tone ?? "255,80,20"},0.7)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha * emberPulse;
      ctx.fillStyle = `rgba(${tone ?? "255,205,70"},0.92)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ash": {
      ctx.fillStyle = tone ? `rgba(${tone},0.6)` : p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "sand": {
      ctx.fillStyle = tone ? `rgba(${tone},0.7)` : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "hail": {
      ctx.fillStyle = `rgba(${tone ?? "230,240,255"},0.85)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "aurora": {
      // Tall vertical ribbon of colour that sways gently
      const hue = (p.wobble * 60 + p.life * 0.3) % 360;
      const auroraGrad = ctx.createLinearGradient(p.x, p.y - p.size, p.x, p.y + p.size);
      if (tone) {
        auroraGrad.addColorStop(0, `rgba(${tone},0)`);
        auroraGrad.addColorStop(0.5, `rgba(${tone},0.12)`);
        auroraGrad.addColorStop(1, `rgba(${tone},0)`);
      } else {
        auroraGrad.addColorStop(0, `hsla(${hue},80%,60%,0)`);
        auroraGrad.addColorStop(0.3, `hsla(${hue},80%,60%,0.08)`);
        auroraGrad.addColorStop(0.5, `hsla(${(hue + 40) % 360},70%,55%,0.12)`);
        auroraGrad.addColorStop(0.7, `hsla(${(hue + 80) % 360},80%,60%,0.08)`);
        auroraGrad.addColorStop(1, `hsla(${(hue + 80) % 360},80%,60%,0)`);
      }
      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      const ribbonW = p.size * 0.6;
      const sway = Math.sin(p.life * 0.008 + p.wobble) * 30;
      ctx.moveTo(p.x + sway - ribbonW, p.y - p.size);
      ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y + p.size);
      ctx.lineTo(p.x + sway - ribbonW, p.y + p.size);
      ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y - p.size);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.globalAlpha = 1;
}

const STOCK_TONES: Partial<Record<WeatherParticle["type"], string>> = {
  rain: "180,210,255",
  snow: "255,255,255",
  leaf: "110,170,70",
  petal: "250,180,200",
  firefly: "220,255,130",
  star: "255,255,240",
  fog: "200,200,220",
  dust: "255,240,220",
  ember: "255,205,70",
  ash: "120,105,105",
  sand: "215,185,120",
  hail: "230,240,255",
  aurora: "120,220,170",
};

function stockTone(p: WeatherParticle) {
  return STOCK_TONES[p.type] ?? "255,255,255";
}

/** A theme picture for one particle. Leaves, petals and ash spin as they fall; the rest stay upright. */
function drawWeatherSprite(
  ctx: WeatherCanvasContext,
  p: WeatherParticle,
  image: ImageBitmap,
  look: WeatherLook,
  alpha: number,
) {
  // Pictures are drawn at their own size (times the theme's size), so pixel art keeps its pixels.
  // Smooth style also varies them a little with the particle's random size.
  const base = look.pixel > 1 ? 1 : 0.75 + (p.size / SPRITE_BASE_SIZE[p.type]) * 0.25;
  const scale = (look.kinds[p.type]?.size ?? 1) * base;
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.save();
  // Pixel art reads crisp only when it's solid, so pixel style fades pictures in three hard steps.
  ctx.globalAlpha = look.pixel > 1 ? Math.min(1, Math.ceil(alpha * 1.4 * 3) / 3) : Math.min(1, alpha * 1.4);
  ctx.translate(snap(p.x, look), snap(p.y, look));
  if (look.pixel === 1 && (p.type === "leaf" || p.type === "petal" || p.type === "ash"))
    ctx.rotate(Math.sin(p.wobble) * 1.2);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

const SPRITE_BASE_SIZE: Record<WeatherParticle["type"], number> = {
  rain: 1.5,
  snow: 3.5,
  leaf: 5.5,
  petal: 4.5,
  firefly: 3,
  star: 1.75,
  fog: 100,
  dust: 2,
  ember: 3,
  ash: 3.5,
  sand: 1.5,
  hail: 3.5,
  aurora: 140,
};

/** Pixel style: every particle lands on the theme's pixel grid as one or a few square cells. */
function drawPixelParticle(ctx: WeatherCanvasContext, p: WeatherParticle, look: WeatherLook, alpha: number) {
  const g = look.pixel;
  const tone = look.kinds[p.type]?.color ?? stockTone(p);
  const x = snap(p.x, look);
  const y = snap(p.y, look);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${tone})`;
  switch (p.type) {
    case "rain":
    case "hail": {
      const cells = p.type === "hail" ? 1 : Math.max(2, Math.round(3 * Math.max(0.5, Math.min(3, look.rainLength))));
      const side = p.type === "hail" ? g * 2 : g;
      const speed = Math.hypot(p.vx, p.vy) || 1;
      for (let index = 0; index < cells; index += 1) {
        ctx.fillRect(
          snap(p.x - (p.vx / speed) * g * index, look),
          snap(p.y - (p.vy / speed) * g * index, look),
          side,
          side,
        );
      }
      break;
    }
    case "snow": {
      if (p.size > 3.5) {
        ctx.fillRect(x - g * 2, y, g * 5, g);
        ctx.fillRect(x, y - g * 2, g, g * 5);
        ctx.fillRect(x - g, y - g, g, g);
        ctx.fillRect(x + g, y - g, g, g);
        ctx.fillRect(x - g, y + g, g, g);
        ctx.fillRect(x + g, y + g, g, g);
      } else ctx.fillRect(x, y, g * 2, g * 2);
      break;
    }
    case "leaf":
    case "petal": {
      const wide = Math.sin(p.wobble) > 0;
      const long = Math.max(2, Math.round(p.size / g)) * g;
      ctx.fillRect(x, y, wide ? long : g * 2, wide ? g * 2 : long);
      break;
    }
    case "fog": {
      // Pixel fog: three nested stepped ellipses, so the bank thickens toward its middle in hard bands.
      const big = g * 2;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = `rgba(${tone},0.18)`;
      for (const ring of [1, 0.68, 0.4]) {
        const rx = p.size * 2.2 * ring;
        const ry = p.size * 0.3 * ring;
        for (let dy = -ry; dy <= ry; dy += big) {
          const half = Math.round((rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))) / big) * big;
          if (half <= 0) continue;
          ctx.fillRect(snap(p.x - half, look), snap(p.y + dy, look), half * 2, big);
        }
      }
      break;
    }
    case "aurora": {
      const big = g * 4;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = `rgba(${tone},0.1)`;
      const w = Math.round((p.size * 1.2) / big) * big;
      const h = Math.round((p.size * 2) / big) * big;
      ctx.fillRect(Math.round((p.x - w / 2) / big) * big, Math.round((p.y - h / 2) / big) * big, w, h);
      break;
    }
    case "star": {
      const twinkle = Math.sin(p.life * 0.04 + p.wobble) * 0.5 + 0.5;
      ctx.globalAlpha = Math.min(1, twinkle * 0.8 * look.strength);
      ctx.fillRect(x, y, g, g);
      if (twinkle > 0.6) {
        ctx.fillRect(x - g, y, g, g);
        ctx.fillRect(x + g, y, g, g);
        ctx.fillRect(x, y - g, g, g);
        ctx.fillRect(x, y + g, g, g);
      }
      break;
    }
    case "firefly":
    case "ember": {
      const pulse = Math.sin(p.life * (p.type === "ember" ? 0.08 : 0.05)) * 0.5 + 0.5;
      ctx.globalAlpha = alpha * (0.55 + pulse * 0.45);
      ctx.fillRect(x, y, g * (p.size > 3 ? 2 : 1), g * (p.size > 3 ? 2 : 1));
      break;
    }
    default: {
      const side = p.size > 2.5 ? g * 2 : g;
      ctx.fillRect(x, y, side, side);
    }
  }
  ctx.globalAlpha = 1;
}

// ── Celestial drawing helpers ──

/** Get sun/moon X position based on hour. Maps 6:00→left edge, 12:00→center, 18:00→right edge. */
export function weatherCelestialX(hour: number, w: number): number {
  // Sun arc: 6h = 0%, 12h = 50%, 18h = 100% of width
  const t = Math.max(0, Math.min(1, (hour - 6) / 12));
  return w * 0.08 + t * w * 0.84; // 8%-92% of width
}

/** Get sun Y position — arc from bottom-ish up to top and back down. */
export function weatherCelestialY(hour: number, h: number, isMoon: boolean): number {
  if (isMoon) {
    // Moon arc: highest at midnight (hour 0/24), lower at 21h and 5h
    const t = hour >= 12 ? (hour - 21) / 7 : (hour + 3) / 7; // normalized 0-1
    const arc = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
    return h * 0.05 + (1 - arc) * h * 0.2;
  }
  // Sun: lowest at 6h/18h, highest at noon
  const t = Math.max(0, Math.min(1, (hour - 6) / 12));
  const arc = Math.sin(t * Math.PI); // 0 at edges, 1 at noon
  return h * 0.05 + (1 - arc) * h * 0.25; // 5%-30% from top
}

export function drawWeatherSun(
  ctx: WeatherCanvasContext,
  x: number,
  y: number,
  radius: number,
  w: number,
  h: number,
  sunRays: boolean,
  sunsetGlow: boolean,
  frameCount: number,
  color?: string,
) {
  ctx.save();

  if (sunsetGlow) {
    // Warm gradient sky wash at bottom
    const glowGrad = ctx.createRadialGradient(x, y, radius, x, y + radius * 6, radius * 12);
    glowGrad.addColorStop(0, "rgba(255,140,50,0.12)");
    glowGrad.addColorStop(0.4, "rgba(255,80,30,0.06)");
    glowGrad.addColorStop(1, "rgba(255,40,20,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Outer glow
  const outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 4);
  outerGlow.addColorStop(0, sunsetGlow ? "rgba(255,120,40,0.15)" : "rgba(255,240,180,0.12)");
  outerGlow.addColorStop(0.5, sunsetGlow ? "rgba(255,80,20,0.05)" : "rgba(255,240,180,0.04)");
  outerGlow.addColorStop(1, "rgba(255,240,180,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
  ctx.fill();

  // Sun disc
  const discGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  if (sunsetGlow) {
    discGrad.addColorStop(0, "rgba(255,200,100,0.9)");
    discGrad.addColorStop(0.7, "rgba(255,120,40,0.7)");
    discGrad.addColorStop(1, "rgba(255,80,20,0.3)");
  } else if (color) {
    discGrad.addColorStop(0, `rgba(${color},0.85)`);
    discGrad.addColorStop(0.7, `rgba(${color},0.55)`);
    discGrad.addColorStop(1, `rgba(${color},0.2)`);
  } else {
    discGrad.addColorStop(0, "rgba(255,250,220,0.8)");
    discGrad.addColorStop(0.7, "rgba(255,240,180,0.5)");
    discGrad.addColorStop(1, "rgba(255,230,150,0.2)");
  }
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Animated light rays
  if (sunRays) {
    const rayCount = 12;
    const rotOffset = frameCount * 0.002;
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + rotOffset;
      const pulse = 0.8 + Math.sin(frameCount * 0.01 + i * 1.5) * 0.2;
      const rayLen = radius * (3.5 + pulse * 2);
      const spread = 0.08;
      ctx.fillStyle = sunsetGlow ? "rgba(255,160,60,0.5)" : "rgba(255,250,200,0.4)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle - spread) * rayLen, y + Math.sin(angle - spread) * rayLen);
      ctx.lineTo(x + Math.cos(angle + spread) * rayLen, y + Math.sin(angle + spread) * rayLen);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawWeatherMoon(
  ctx: WeatherCanvasContext,
  x: number,
  y: number,
  radius: number,
  _frameCount: number,
  color?: string,
  flat = false,
) {
  ctx.save();

  // Soft moonlight glow
  if (!flat) {
    const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 5);
    glow.addColorStop(0, `rgba(${color ?? "180,200,255"},0.10)`);
    glow.addColorStop(0.4, `rgba(${color ?? "150,180,255"},0.04)`);
    glow.addColorStop(1, `rgba(${color ?? "150,180,255"},0)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon disc (bright side)
  const discGrad = ctx.createRadialGradient(x - radius * 0.15, y - radius * 0.15, 0, x, y, radius);
  discGrad.addColorStop(0, `rgba(${color ?? "230,235,255"},0.85)`);
  discGrad.addColorStop(0.8, `rgba(${color ?? "200,210,240"},0.6)`);
  discGrad.addColorStop(1, `rgba(${color ?? "180,190,220"},0.3)`);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Crescent shadow (dark side) — offset circle to create crescent shape
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(x + radius * 0.45, y - radius * 0.1, radius * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Subtle crater hints
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "rgba(150,160,190,1)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.25, y - radius * 0.15, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - radius * 0.4, y + radius * 0.25, radius * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - radius * 0.05, y + radius * 0.35, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
