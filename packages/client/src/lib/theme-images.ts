// ──────────────────────────────────────────────
// Theme images (theming panel round 3, batches 2 and 4)
//
// A theme file can carry pictures in `images: [{ name, src }]` (counted in the 6 MiB package
// budget, not the 256 KiB CSS budget). Its CSS points at them as `url("theme:night.webp")`.
// When the theme is applied, every `theme:` reference and every picture still written inline as a
// `data:image/…` URL becomes a short same-origin `blob:` URL: the CSS stays small (a long data:
// URL in a custom property is copied into every element that inherits it, which slowed style
// recalculation down), nothing is fetched from the network, and the guard can read the pixels.
//
// The same registry knows which pictures move (GIF, APNG, animated WebP, SVG with <animate>), makes
// a still first frame of each for Reduce motion, and samples each picture's colours so the chrome
// guard and the contrast checks can see art behind text.
// ──────────────────────────────────────────────
import type { ThemeMeta } from "@marinara-engine/shared";

export type ThemeImage = NonNullable<ThemeMeta["images"]>[number];

/** `url(theme:name)`, `url("theme:name")` or `url('theme:name')`. */
const THEME_URL = /url\(\s*(["']?)\s*theme:([a-z0-9][a-z0-9._-]*)\s*\1\s*\)/gi;
/** Inline pictures: `url("data:image/…")`, `url('data:image/…')` or `url(data:image/…)`. */
const INLINE_IMAGE = /url\(\s*(?:"(data:image\/[^"]*)"|'(data:image\/[^']*)'|(data:image\/[^)\s"']*))\s*\)/gi;
/** A transparent 1x1 GIF, shown while a still frame is being made. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

interface Entry {
  url: string;
  bytes: number;
  animated: boolean;
  mime: string;
}

const entries = new Map<string, Entry>();
const stills = new Map<string, string | Promise<string>>();

// ── Bytes ──

/** The bytes and type of a data: URL, or null when it isn't one. */
export function dataUrlParts(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const head = dataUrl.slice(5, comma);
  const mime = (head.split(";")[0] || "application/octet-stream").toLowerCase();
  const payload = dataUrl.slice(comma + 1);
  try {
    if (/;base64$/i.test(head)) {
      const binary = atob(payload.replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

/** How many bytes a data: URL decodes to (without decoding it). */
export function dataUrlByteSize(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const payload = dataUrl.length - comma - 1;
  return /;base64$/i.test(dataUrl.slice(0, comma)) ? Math.floor((payload * 3) / 4) : payload;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Whether a picture moves: a GIF with more than one frame, an APNG, an animated WebP, an animated SVG. */
export function isAnimatedImage(bytes: Uint8Array, mime = ""): boolean {
  if (bytes.length < 16) return false;
  const head = ascii(bytes, 0, 6);
  if (head === "GIF87a" || head === "GIF89a") return gifFrameCount(bytes) > 1;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") {
    // acTL comes before the first IDAT in an animated PNG.
    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const length =
        ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
      const type = ascii(bytes, offset + 4, 4);
      if (type === "acTL") return true;
      if (type === "IDAT" || type === "IEND") return false;
      offset += 12 + length;
    }
    return false;
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    if (ascii(bytes, 12, 4) === "VP8X" && bytes.length > 20) return (bytes[20]! & 0x02) !== 0;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(bytes, offset, 4);
      if (type === "ANIM" || type === "ANMF") return true;
      const size =
        bytes[offset + 4]! | (bytes[offset + 5]! << 8) | (bytes[offset + 6]! << 16) | (bytes[offset + 7]! << 24);
      offset += 8 + size + (size % 2);
      if (size < 0) break;
    }
    return false;
  }
  if (mime.includes("svg") || ascii(bytes, 0, 5) === "<?xml" || ascii(bytes, 0, 4) === "<svg") {
    const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 400_000)));
    return /<(animate|animateTransform|animateMotion|set)\b|@keyframes|animation\s*:/i.test(text);
  }
  return false;
}

/** Image descriptors in a GIF (stops counting at 2). */
function gifFrameCount(bytes: Uint8Array) {
  let offset = 13;
  const flags = bytes[10]!;
  if (flags & 0x80) offset += 3 * (1 << ((flags & 0x07) + 1));
  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset]!;
    if (block === 0x3b) break;
    if (block === 0x21) {
      offset += 2;
      while (offset < bytes.length && bytes[offset]! > 0) offset += bytes[offset]! + 1;
      offset += 1;
    } else if (block === 0x2c) {
      frames += 1;
      if (frames > 1) return frames;
      const local = bytes[offset + 9]!;
      offset += 10;
      if (local & 0x80) offset += 3 * (1 << ((local & 0x07) + 1));
      offset += 1;
      while (offset < bytes.length && bytes[offset]! > 0) offset += bytes[offset]! + 1;
      offset += 1;
    } else break;
  }
  return frames;
}

// ── Registry ──

/** A blob: URL for a picture (made once per picture and kept for the session). */
export function imageEntry(src: string): Entry | null {
  const known = entries.get(src);
  if (known) return known;
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const parts = dataUrlParts(src);
  if (!parts || !parts.mime.startsWith("image/")) return null;
  const blob = new Blob([parts.bytes as BlobPart], { type: parts.mime });
  const entry: Entry = {
    url: URL.createObjectURL(blob),
    bytes: parts.bytes.length,
    animated: isAnimatedImage(parts.bytes, parts.mime),
    mime: parts.mime,
  };
  entries.set(src, entry);
  return entry;
}

/** The first frame of a moving picture, as a still blob: URL (null until it's ready). */
function stillFor(entry: Entry): string | null {
  const known = stills.get(entry.url);
  if (typeof known === "string") return known;
  if (!known) {
    const pending = new Promise<string>((resolve) => {
      const image = new Image();
      image.decoding = "sync";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, image.naturalWidth || 300);
          canvas.height = Math.max(1, image.naturalHeight || 150);
          canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            const url = blob ? URL.createObjectURL(blob) : BLANK;
            stills.set(entry.url, url);
            resolve(url);
          }, "image/png");
        } catch {
          stills.set(entry.url, BLANK);
          resolve(BLANK);
        }
      };
      image.onerror = () => {
        stills.set(entry.url, BLANK);
        resolve(BLANK);
      };
      image.src = entry.url;
    });
    stills.set(entry.url, pending);
  }
  return null;
}

export interface PreparedThemeCss {
  css: string;
  /** Whether any picture the CSS uses moves. */
  animated: boolean;
  /** Resolves when still frames that weren't ready yet have been made (Reduce motion only). */
  stillsPending: Promise<void> | null;
}

function quoteUrl(url: string) {
  return `url("${url}")`;
}

/**
 * Theme CSS ready to inject: `theme:` references and inline pictures become blob: URLs, and with
 * `still` on, moving pictures become their first frame. Run it after the CSS is sanitised (the
 * blob: URLs are the app's own, so the sanitiser would drop them).
 */
export function prepareThemeCss(
  css: string,
  images: ThemeImage[] | null | undefined,
  options: { still?: boolean } = {},
): PreparedThemeCss {
  let animated = false;
  const waiting: Promise<unknown>[] = [];
  const use = (entry: Entry | null, fallback: string) => {
    if (!entry) return fallback;
    if (!entry.animated) return quoteUrl(entry.url);
    animated = true;
    if (!options.still) return quoteUrl(entry.url);
    const still = stillFor(entry);
    if (still) return quoteUrl(still);
    const pending = stills.get(entry.url);
    if (pending && typeof pending !== "string") waiting.push(pending);
    return quoteUrl(BLANK);
  };
  const byName = new Map<string, ThemeImage>();
  for (const image of images ?? []) byName.set(image.name.toLowerCase(), image);
  let out = css.replace(THEME_URL, (_whole, _quote: string, name: string) => {
    const image = byName.get(name.toLowerCase());
    return use(image ? imageEntry(image.src) : null, "none");
  });
  if (out.includes("data:image/")) {
    out = out.replace(INLINE_IMAGE, (whole, double?: string, single?: string, bare?: string) =>
      use(imageEntry(double ?? single ?? bare ?? ""), whole),
    );
  }
  return {
    css: out,
    animated,
    stillsPending: waiting.length ? Promise.all(waiting).then(() => undefined) : null,
  };
}

/** `theme:` names the CSS uses that the theme doesn't carry. */
export function missingThemeImages(css: string, images: ThemeImage[] | null | undefined) {
  const names = new Set((images ?? []).map((image) => image.name.toLowerCase()));
  const missing = new Set<string>();
  for (const match of css.matchAll(THEME_URL)) {
    if (!names.has(match[2]!.toLowerCase())) missing.add(match[2]!);
  }
  return [...missing];
}

export interface ThemeImageSummary {
  name: string;
  bytes: number;
  animated: boolean;
  /** Written inline in the CSS rather than carried in `images`. */
  inline?: boolean;
}

/** Every picture a theme carries or writes inline, with its size and whether it moves. */
export function summarizeThemeImages(css: string, images: ThemeImage[] | null | undefined): ThemeImageSummary[] {
  const out: ThemeImageSummary[] = [];
  for (const image of images ?? []) {
    const parts = dataUrlParts(image.src);
    out.push({
      name: image.name,
      bytes: parts?.bytes.length ?? dataUrlByteSize(image.src),
      animated: parts ? isAnimatedImage(parts.bytes, parts.mime) : false,
    });
  }
  let index = 0;
  for (const match of css.matchAll(INLINE_IMAGE)) {
    const src = match[1] ?? match[2] ?? match[3] ?? "";
    const parts = dataUrlParts(src);
    index += 1;
    out.push({
      name: `inline-${index}.${(parts?.mime.split("/")[1] ?? "img").replace("svg+xml", "svg").replace("jpeg", "jpg")}`,
      bytes: parts?.bytes.length ?? dataUrlByteSize(src),
      animated: parts ? isAnimatedImage(parts.bytes, parts.mime) : false,
      inline: true,
    });
  }
  return out;
}

// ── Import: shrink and move inline pictures out of the CSS ──

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function canvasDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      },
      "image/webp",
      quality,
    );
  });
}

/** The longest side a theme picture keeps; bigger ones are scaled down when shrunk. */
export const THEME_IMAGE_MAX_SIDE = 2560;

/**
 * A still PNG or JPEG as WebP, scaled down to at most 2560 px: small pictures (pixel art, 9-slice
 * frames) stay lossless so they keep crisp edges. Moving pictures, SVG and pictures that wouldn't
 * get smaller are left as they are.
 */
export async function shrinkThemeImage(src: string): Promise<string> {
  const parts = dataUrlParts(src);
  if (!parts || !/^image\/(png|jpeg|bmp)$/.test(parts.mime) || isAnimatedImage(parts.bytes, parts.mime)) return src;
  const image = await loadImage(src);
  if (!image || !image.naturalWidth) return src;
  const scale = Math.min(1, THEME_IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return src;
  const small = canvas.width * canvas.height <= 512 * 512;
  context.imageSmoothingEnabled = !small || scale < 1;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = await canvasDataUrl(canvas, small ? 1 : 0.86);
  return webp && webp.length < src.length ? webp : src;
}

function safeName(base: string, taken: Set<string>) {
  const clean =
    base
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[^a-z0-9]+|-+$/g, "")
      .slice(0, 48) || "image";
  let name = clean;
  for (let n = 2; taken.has(name); n += 1) name = `${clean}-${n}`;
  taken.add(name);
  return name;
}

/** A unique `theme:` name for a picked file. */
export function themeImageName(fileName: string, images: ThemeImage[] | null | undefined) {
  const taken = new Set((images ?? []).map((image) => image.name.toLowerCase().replace(/\.[a-z0-9]+$/, "")));
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "png";
  return `${safeName(fileName, taken)}.${extension.replace("jpeg", "jpg")}`;
}

/**
 * Moves pictures written inline in a theme's CSS into its `images` list (each one once, even when
 * the CSS repeats it), shrinking still PNG and JPEG to WebP on the way. The CSS then points at
 * `theme:` names, so the 256 KiB CSS limit counts the CSS itself. Pictures smaller than 2 KiB
 * (tiny SVG patterns) stay inline.
 */
export async function extractInlineThemeImages(
  css: string,
  images: ThemeImage[] | null | undefined,
): Promise<{ css: string; images: ThemeImage[]; moved: number }> {
  const list = [...(images ?? [])];
  const taken = new Set(list.map((image) => image.name.toLowerCase().replace(/\.[a-z0-9]+$/, "")));
  const bySrc = new Map<string, string>();
  const found = Array.from(css.matchAll(INLINE_IMAGE), (match) => match[1] ?? match[2] ?? match[3] ?? "");
  for (const src of found) {
    if (bySrc.has(src) || dataUrlByteSize(src) < 2048) continue;
    const mime = /^data:([^;,]+)/.exec(src)?.[1]?.toLowerCase() ?? "image/png";
    const shrunk = await shrinkThemeImage(src);
    const extension = (/^data:image\/([a-z0-9.+-]+)/.exec(shrunk)?.[1] ?? mime.split("/")[1] ?? "png")
      .replace("svg+xml", "svg")
      .replace("jpeg", "jpg");
    const name = `${safeName(`image-${list.length + 1}`, taken)}.${extension}`;
    taken.add(name);
    list.push({ name, src: shrunk });
    bySrc.set(src, name);
  }
  if (bySrc.size === 0) return { css, images: list, moved: 0 };
  const out = css.replace(INLINE_IMAGE, (whole, double?: string, single?: string, bare?: string) => {
    const name = bySrc.get(double ?? single ?? bare ?? "");
    return name ? `url("theme:${name}")` : whole;
  });
  return { css: out, images: list, moved: bySrc.size };
}

// ── Sampling (for the guard and the contrast checks) ──

export interface ImageSample {
  /** Average alpha, 0-1: how much of the picture is see-through. */
  alpha: number;
  /** Average colour of the opaque parts (0-255). */
  average: [number, number, number];
  /** A dark and a light colour among the opaque parts (10th and 90th luminance percentile). */
  dark: [number, number, number];
  light: [number, number, number];
}

const samples = new Map<string, ImageSample | null | "pending">();

function relLum([r, g, b]: [number, number, number]) {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function sampleNow(image: HTMLImageElement): ImageSample | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, 24, 24);
    const data = context.getImageData(0, 0, 24, 24).data;
    let alpha = 0;
    let weight = 0;
    const sum = [0, 0, 0];
    const pixels: Array<[number, number, number]> = [];
    for (let index = 0; index < data.length; index += 4) {
      const a = data[index + 3]! / 255;
      alpha += a;
      if (a < 0.3) continue;
      const rgb: [number, number, number] = [data[index]!, data[index + 1]!, data[index + 2]!];
      sum[0] += rgb[0] * a;
      sum[1] += rgb[1] * a;
      sum[2] += rgb[2] * a;
      weight += a;
      pixels.push(rgb);
    }
    const count = data.length / 4;
    if (!pixels.length) return { alpha: alpha / count, average: [0, 0, 0], dark: [0, 0, 0], light: [0, 0, 0] };
    pixels.sort((a, b) => relLum(a) - relLum(b));
    return {
      alpha: alpha / count,
      average: [sum[0]! / weight, sum[1]! / weight, sum[2]! / weight],
      dark: pixels[Math.floor(pixels.length * 0.1)]!,
      light: pixels[Math.min(pixels.length - 1, Math.floor(pixels.length * 0.9))]!,
    };
  } catch {
    return null;
  }
}

/**
 * What a picture looks like, if it has been sampled: undefined while it loads (the first call
 * starts it), null when it can't be read (another origin). Only blob: and data: pictures are read.
 */
export function peekImageSample(url: string): ImageSample | null | undefined {
  const known = samples.get(url);
  if (known === "pending") return undefined;
  if (known !== undefined) return known;
  if (!/^(blob:|data:image\/)/.test(url)) {
    samples.set(url, null);
    return null;
  }
  samples.set(url, "pending");
  void loadImage(url).then((image) => samples.set(url, image ? sampleNow(image) : null));
  return undefined;
}

/** The URLs inside a computed background-image value. */
export function cssImageUrls(value: string): string[] {
  return Array.from(value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g), (match) => match[2]!).filter(Boolean);
}

/** Starts sampling every picture in some CSS, and resolves when they're all read (or after 1.5 s). */
export function preloadImageSamples(css: string): Promise<void> {
  const urls = cssImageUrls(css).filter((url) => /^(blob:|data:image\/)/.test(url));
  for (const url of urls) peekImageSample(url);
  const ready = () => urls.every((url) => samples.get(url) !== "pending");
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => (ready() || Date.now() - started > 1500 ? resolve() : window.setTimeout(tick, 40));
    tick();
  });
}
