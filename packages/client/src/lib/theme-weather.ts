// ──────────────────────────────────────────────
// Theme weather (Nov 2026): a theme restyles the in-chat weather with `--mari-weather-*` tokens.
//
// The weather is drawn on a canvas (often in a worker), so CSS can't reach it. This module reads a
// fixed list of tokens from the page, checks every value against an allowlist, and turns them into a
// plain WeatherLook: numbers clamped to their ranges, colours as "r,g,b", styles from fixed words and
// pictures decoded to ImageBitmaps. Nothing a theme writes runs, and pictures are only the theme's own
// (the same-origin blob: URLs the theme loader made after the SVG rebuild and the decode-size cap).
// Unknown or invalid values are dropped, never guessed at.
// ──────────────────────────────────────────────
import { STOCK_WEATHER_LOOK, type WeatherKindLook, type WeatherLook, type WeatherLookKind } from "./weather-renderer";
import { cssImageUrls, isThemeImageUrl } from "./theme-images";

export const WEATHER_LOOK_KINDS: WeatherLookKind[] = [
  "rain",
  "snow",
  "hail",
  "fog",
  "dust",
  "leaf",
  "petal",
  "ember",
  "ash",
  "sand",
  "firefly",
  "star",
  "aurora",
  "sun",
  "moon",
];

/** Longest side of a weather picture once decoded (a flake or a leaf, not a backdrop). */
export const WEATHER_SPRITE_MAX_SIDE = 160;
export const WEATHER_SPRITES_PER_KIND = 4;

/** The tokens as written, before decoding pictures: what the hook compares to see a change. */
export interface ThemeWeatherTokens {
  pixel: number;
  speed: number;
  amount: number;
  strength: number;
  tint: number;
  rainLength: number;
  sun: boolean;
  moon: boolean;
  lightning: string | null;
  /** 0 = flash only; else the drawn bolt's width, 0.5-3 (`--mari-weather-lightning-bolt: on | none | 0.5-3`). */
  bolt: number;
  kinds: Partial<
    Record<WeatherLookKind, { color?: string; size?: number; shape?: "round" | "square"; images?: string[] }>
  >;
}

function clampNumber(raw: string, min: number, max: number, fallback: number) {
  const value = raw.trim();
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)(px)?$/i.test(value)) return fallback;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

let colorContext: CanvasRenderingContext2D | null | undefined;

/** A plain CSS colour as "r,g,b", or null. No url(), gradients, functions other than rgb/hsl/hwb/lab/oklch. */
export function parseWeatherColor(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 64) return null;
  if (!/^(#[0-9a-f]{3,8}|[a-z]{3,24}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([0-9a-z.,%\s/+-]*\))$/i.test(value))
    return null;
  if (/^(inherit|initial|unset|revert|currentcolor|transparent|none)$/i.test(value)) return null;
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !CSS.supports("color", value)) return null;
  if (colorContext === undefined) {
    try {
      colorContext = document.createElement("canvas").getContext("2d");
    } catch {
      colorContext = null;
    }
  }
  if (!colorContext) return null;
  // Canvas normalises any valid colour to #rrggbb or rgba(r, g, b, a).
  colorContext.fillStyle = "#000";
  colorContext.fillStyle = value;
  const normal = String(colorContext.fillStyle);
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normal);
  if (hex) return [hex[1], hex[2], hex[3]].map((part) => Number.parseInt(part!, 16)).join(",");
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(normal);
  if (rgb) return `${rgb[1]},${rgb[2]},${rgb[3]}`;
  return null;
}

/** Reads the weather tokens from computed style (custom properties come back with var() already resolved). */
export function readThemeWeatherTokens(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
): ThemeWeatherTokens | null {
  const get = (name: string) => style.getPropertyValue(`--mari-weather-${name}`).trim();
  const tokens: ThemeWeatherTokens = {
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
    kinds: {},
  };
  let any = false;
  const styleWord = get("style").toLowerCase();
  if (styleWord === "pixel") {
    tokens.pixel = Math.round(clampNumber(get("pixel-size") || "3", 2, 6, 3));
    any = true;
  }
  const number = (
    name: string,
    key: "speed" | "amount" | "strength" | "tint" | "rainLength",
    min: number,
    max: number,
  ) => {
    const raw = get(name);
    if (!raw) return;
    tokens[key] = clampNumber(raw, min, max, 1);
    any = true;
  };
  number("speed", "speed", 0.5, 1.5);
  number("amount", "amount", 0.25, 1);
  number("strength", "strength", 0.5, 1.5);
  number("tint-strength", "tint", 0, 1);
  number("rain-length", "rainLength", 0.5, 3);
  if (get("sun").toLowerCase() === "none") {
    tokens.sun = false;
    any = true;
  }
  if (get("moon").toLowerCase() === "none") {
    tokens.moon = false;
    any = true;
  }
  const lightning = get("lightning-color");
  if (lightning) {
    tokens.lightning = parseWeatherColor(lightning);
    any ||= tokens.lightning !== null;
  }
  const bolt = get("lightning-bolt").toLowerCase();
  if (bolt) {
    if (bolt === "on") tokens.bolt = 1;
    else if (bolt !== "none" && bolt !== "off") tokens.bolt = clampNumber(bolt, 0.5, 3, 0);
    any ||= tokens.bolt > 0;
  }
  for (const kind of WEATHER_LOOK_KINDS) {
    const entry: NonNullable<ThemeWeatherTokens["kinds"][WeatherLookKind]> = {};
    const color = get(`${kind}-color`);
    if (color) {
      const parsed = parseWeatherColor(color);
      if (parsed) entry.color = parsed;
    }
    const size = get(`${kind}-size`);
    if (size) entry.size = clampNumber(size, 0.5, 3, 1);
    const shape = get(`${kind}-shape`).toLowerCase();
    if (shape === "square" || shape === "round") entry.shape = shape;
    const image = get(`${kind}-image`);
    if (image && image !== "none") {
      const urls = cssImageUrls(image)
        .filter((url) => isThemeImageUrl(url))
        .slice(0, WEATHER_SPRITES_PER_KIND);
      if (urls.length) entry.images = urls;
    }
    if (Object.keys(entry).length) {
      tokens.kinds[kind] = entry;
      any = true;
    }
  }
  return any ? tokens : null;
}

const bitmaps = new Map<string, Promise<ImageBitmap | null>>();

/** A theme picture decoded once, at most WEATHER_SPRITE_MAX_SIDE on its long side. */
function loadSprite(url: string, pixel: boolean): Promise<ImageBitmap | null> {
  const key = `${url}|${pixel ? "p" : "s"}`;
  const known = bitmaps.get(key);
  if (known) return known;
  const pending = (async () => {
    if (!isThemeImageUrl(url) || typeof createImageBitmap !== "function") return null;
    try {
      // An <img> decodes every format the theme loader accepts, SVG included (already rebuilt from the allowlist).
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      const width = image.naturalWidth || 1;
      const height = image.naturalHeight || 1;
      const ratio = Math.min(1, WEATHER_SPRITE_MAX_SIDE / Math.max(width, height));
      return await createImageBitmap(image, {
        resizeWidth: Math.max(1, Math.round(width * ratio)),
        resizeHeight: Math.max(1, Math.round(height * ratio)),
        resizeQuality: pixel ? "pixelated" : "high",
      });
    } catch {
      return null;
    }
  })();
  bitmaps.set(key, pending);
  return pending;
}

/** The finished look: tokens with their pictures decoded. Pictures that fail to load are left out. */
export async function resolveThemeWeatherLook(tokens: ThemeWeatherTokens | null): Promise<WeatherLook> {
  if (!tokens) return STOCK_WEATHER_LOOK;
  const kinds: WeatherLook["kinds"] = {};
  await Promise.all(
    (Object.keys(tokens.kinds) as WeatherLookKind[]).map(async (kind) => {
      const entry = tokens.kinds[kind]!;
      const out: WeatherKindLook = {};
      if (entry.color) out.color = entry.color;
      if (entry.size !== undefined) out.size = entry.size;
      if (entry.shape) out.shape = entry.shape;
      if (entry.images?.length) {
        const decoded = await Promise.all(entry.images.map((url) => loadSprite(url, tokens.pixel > 1)));
        const images = decoded.filter((bitmap): bitmap is ImageBitmap => bitmap !== null);
        if (images.length) out.images = images;
      }
      kinds[kind] = out;
    }),
  );
  return { ...tokens, flat: false, kinds };
}
