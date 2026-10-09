// Pure helpers for "baking" web images in a character's greetings into the
// character gallery (#7221). The client finds and rewrites references; the
// server downloads the files and restores web links in compatible exports,
// whose cards carry no gallery.

/** Most web images one bake request may download. */
export const GREETING_IMAGE_BAKE_MAX_PER_REQUEST = 10;

/** A greeting image saved to the gallery, with the web address it replaced. */
export interface BakedGreetingImage {
  file: string;
  url: string;
}

interface GreetingFields {
  first_mes?: unknown;
  alternate_greetings?: unknown;
  extensions?: unknown;
}

// Same image forms the chat renderer shows: markdown images and <img src>. The
// alt text and tag stop at the next bracket so hostile text can't backtrack for long.
const MARKDOWN_IMAGE_RE = /(!\[[^[\]]*\]\()(https?:\/\/[^()[\]\s]+)(\))/g;
const HTML_IMAGE_RE =
  /(<img\b[^<>]*?\ssrc\s*=\s*)(?:"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)'|(https?:\/\/[^\s>"'`]+))/gi;

/** Portable gallery reference that resolves to whichever character speaks the greeting. */
export function bakedGreetingImageRef(file: string): string {
  return `card://self/gallery/${encodeURIComponent(file)}`;
}

/** Rewrite every web image URL in a greeting; returning undefined keeps a URL as is. */
export function rewriteGreetingImageUrls(text: string, replace: (url: string) => string | undefined): string {
  return text
    .replace(MARKDOWN_IMAGE_RE, (match, open: string, url: string, close: string) => {
      const next = replace(url);
      return next === undefined ? match : `${open}${next}${close}`;
    })
    .replace(HTML_IMAGE_RE, (match, prefix: string, double?: string, single?: string, bare?: string) => {
      const raw = double ?? single ?? bare ?? "";
      const next = replace(raw.replace(/&amp;/gi, "&"));
      if (next === undefined) return match;
      const quote = single !== undefined ? "'" : '"';
      return `${prefix}${quote}${next}${quote}`;
    });
}

function greetingTexts(data: GreetingFields): string[] {
  const alternates = Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [];
  return [data.first_mes, ...alternates].filter((text): text is string => typeof text === "string");
}

/** Unique web image URLs used by the first message and alternate greetings, in order. */
export function findGreetingImageUrls(data: GreetingFields): string[] {
  const urls = new Set<string>();
  for (const text of greetingTexts(data)) {
    rewriteGreetingImageUrls(text, (url) => {
      urls.add(url);
      return undefined;
    });
  }
  return [...urls];
}

/** Baked images recorded on a character, ignoring malformed entries. */
export function readBakedGreetingImages(extensions: unknown): BakedGreetingImage[] {
  const list =
    extensions && typeof extensions === "object"
      ? (extensions as { bakedGreetingImages?: unknown }).bakedGreetingImages
      : null;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (entry): entry is BakedGreetingImage =>
      !!entry && typeof entry === "object" && typeof entry.file === "string" && typeof entry.url === "string",
  );
}

// The list is read after the greetings are mapped, so it can depend on what the mapping found.
function withGreetings<T extends GreetingFields>(
  data: T,
  map: (text: string) => string,
  bakedGreetingImages: () => BakedGreetingImage[],
) {
  const extensions = data.extensions && typeof data.extensions === "object" ? data.extensions : {};
  return {
    ...data,
    first_mes: typeof data.first_mes === "string" ? map(data.first_mes) : data.first_mes,
    alternate_greetings: Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.map((text: unknown) => (typeof text === "string" ? map(text) : text))
      : data.alternate_greetings,
    extensions: { ...extensions, bakedGreetingImages: bakedGreetingImages() },
  } as T;
}

/** Point greeting images at their saved gallery copies and record the web URLs they replaced. */
export function applyBakedGreetingImages<T extends GreetingFields>(data: T, baked: BakedGreetingImage[]): T {
  if (baked.length === 0) return data;
  const refs = new Map(baked.map((entry) => [entry.url, bakedGreetingImageRef(entry.file)]));
  const used = new Set<string>();
  const rewrite = (text: string) =>
    rewriteGreetingImageUrls(text, (url) => {
      const ref = refs.get(url);
      if (ref) used.add(url);
      return ref;
    });
  // A link edited away while the download ran gets no record.
  return withGreetings(data, rewrite, () => [
    ...readBakedGreetingImages(data.extensions),
    ...baked.filter((entry) => used.has(entry.url)),
  ]);
}

/** Put the original web URLs back in place of baked gallery references. */
export function restoreBakedGreetingImages<T extends GreetingFields>(data: T): T {
  const baked = readBakedGreetingImages(data.extensions);
  if (baked.length === 0) return data;
  const restore = (text: string) =>
    baked.reduce((next, entry) => next.split(bakedGreetingImageRef(entry.file)).join(entry.url), text);
  // An empty list, not a missing key: character saves merge extensions, so a
  // removed key would leave the stored list behind.
  return withGreetings(data, restore, () => []);
}
