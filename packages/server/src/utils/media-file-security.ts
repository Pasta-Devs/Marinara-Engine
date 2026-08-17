import { open, realpath, type FileHandle } from "node:fs/promises";
import { basename, extname, join, posix, resolve, win32 } from "node:path";
import type { FastifyReply } from "fastify";
import { getDataDir, getFileStorageDir } from "../config/runtime-config.js";
import { assertInsideDir, isAllowedImageBuffer } from "./security.js";

const RASTER_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const SVG_EXTENSION = ".svg";
const IMAGE_HEADER_BYTES = 4096;
const SVG_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

export type ValidatedImageAsset = {
  mimeType: string;
  isSvg: boolean;
};

export type ValidatedImageFile = ValidatedImageAsset & {
  handle: FileHandle;
  size: number;
};

export type ValidatedVideoAsset = {
  mimeType: string;
};

export type ValidatedVideoFile = ValidatedVideoAsset & {
  handle: FileHandle;
  size: number;
};

type ByteRange = { start: number; end: number } | "unsatisfiable" | null;

function parseSingleByteRange(header: string | undefined, size: number): ByteRange {
  if (!header?.startsWith("bytes=")) return null;
  const value = header.slice("bytes=".length).trim();
  if (!value || value.includes(",")) return null;
  const separatorIndex = value.indexOf("-");
  if (separatorIndex < 0 || value.indexOf("-", separatorIndex + 1) >= 0) return null;

  const startText = value.slice(0, separatorIndex).trim();
  const endText = value.slice(separatorIndex + 1).trim();
  if (!/^\d*$/u.test(startText) || !/^\d*$/u.test(endText) || (!startText && !endText)) {
    return "unsatisfiable";
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0 || size <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return "unsatisfiable";
  if (!endText) return { start, end: size - 1 };

  const requestedEnd = Number(endText);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return "unsatisfiable";
  return { start, end: Math.min(requestedEnd, size - 1) };
}

/** Send the already-validated descriptor, retaining ordinary single-range video playback. */
export async function sendValidatedMediaFile(
  reply: FastifyReply,
  media: ValidatedImageFile | ValidatedVideoFile,
  options: { method?: string; rangeHeader?: string; cacheControl?: string } = {},
) {
  const range = parseSingleByteRange(options.rangeHeader, media.size);
  reply
    .header("Content-Type", media.mimeType)
    .header("Cache-Control", options.cacheControl ?? "public, max-age=0")
    .header("Accept-Ranges", "bytes");

  if (range === "unsatisfiable") {
    await media.handle.close().catch(() => undefined);
    return reply.status(416).header("Content-Range", `bytes */${media.size}`).send();
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, media.size - 1);
  const contentLength = media.size === 0 ? 0 : end - start + 1;
  reply.header("Content-Length", String(contentLength));
  if (range) reply.status(206).header("Content-Range", `bytes ${start}-${end}/${media.size}`);

  if (media.size === 0) {
    await media.handle.close().catch(() => undefined);
    return reply.send();
  }
  // Fastify suppresses this stream body for HEAD while retaining Content-Length.
  return reply.send(media.handle.createReadStream({ start, end }));
}

function isXmlNameCharacter(character: string | undefined): boolean {
  if (!character) return false;
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    character === "." ||
    character === "-" ||
    character === "_" ||
    character === ":"
  );
}

function skipXmlWhitespace(source: string, start: number): number {
  let cursor = start;
  while (
    source[cursor] === " " ||
    source[cursor] === "\t" ||
    source[cursor] === "\n" ||
    source[cursor] === "\r" ||
    source[cursor] === "\f"
  ) {
    cursor += 1;
  }
  return cursor;
}

const XML_NAMED_CHARACTER_REFERENCES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};
const XML_DECIMAL_REFERENCE_PATTERN = /^[0-9]+$/u;
const XML_HEXADECIMAL_REFERENCE_PATTERN = /^[0-9a-f]+$/u;

function decodeXmlAttributeValue(value: string): string | null {
  let decoded = "";
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    const character = value[cursor];
    if (character !== "&") {
      decoded += character;
      continue;
    }

    const semicolon = value.indexOf(";", cursor + 1);
    if (semicolon < 0 || semicolon - cursor > 12) return null;
    const reference = value.slice(cursor + 1, semicolon).toLowerCase();
    let replacement = XML_NAMED_CHARACTER_REFERENCES[reference];
    if (replacement === undefined && reference.startsWith("#")) {
      const hexadecimal = reference.startsWith("#x");
      const digits = reference.slice(hexadecimal ? 2 : 1);
      const validDigits = hexadecimal
        ? XML_HEXADECIMAL_REFERENCE_PATTERN.test(digits)
        : XML_DECIMAL_REFERENCE_PATTERN.test(digits);
      if (!validDigits) return null;
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;
      replacement = String.fromCodePoint(codePoint);
    }
    if (replacement === undefined) return null;
    decoded += replacement;
    cursor = semicolon;
  }
  return decoded;
}

function normalizeSvgUrlScheme(value: string): string | null {
  const decoded = decodeXmlAttributeValue(value);
  if (decoded === null) return null;
  let normalized = "";
  for (const character of decoded.toLowerCase()) {
    const code = character.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) continue;
    normalized += character;
  }
  return normalized;
}

/** SMIL may synthesize an active link/event attribute even when no unsafe literal attribute exists. */
function hasUnsafeSvgAnimatedAttribute(source: string): boolean {
  const normalized = source.toLowerCase();
  const attribute = "attributename";
  let searchFrom = 0;
  while (searchFrom < normalized.length) {
    const start = normalized.indexOf(attribute, searchFrom);
    if (start < 0) return false;
    searchFrom = start + attribute.length;
    if (isXmlNameCharacter(normalized[start - 1]) || isXmlNameCharacter(normalized[searchFrom])) continue;

    let cursor = skipXmlWhitespace(normalized, searchFrom);
    if (normalized[cursor] !== "=") continue;
    cursor = skipXmlWhitespace(normalized, cursor + 1);
    const quote = normalized[cursor] === '"' || normalized[cursor] === "'" ? normalized[cursor] : null;
    if (!quote) return true;
    const valueStart = cursor + 1;
    const valueEnd = normalized.indexOf(quote, valueStart);
    if (valueEnd < 0) return true;
    const animatedName = normalizeSvgUrlScheme(normalized.slice(valueStart, valueEnd));
    if (animatedName === null) return true;
    const localName = animatedName.slice(animatedName.lastIndexOf(":") + 1);
    if (localName === "href" || localName.startsWith("on")) return true;
  }
  return false;
}

/** Scan URL-valued SVG attributes without backtracking over attacker-controlled whitespace. */
function hasUnsafeSvgHref(source: string): boolean {
  const normalized = source.toLowerCase();
  for (const attribute of ["href"] as const) {
    let searchFrom = 0;
    while (searchFrom < normalized.length) {
      const start = normalized.indexOf(attribute, searchFrom);
      if (start < 0) break;
      searchFrom = start + attribute.length;
      // XML namespace prefixes are arbitrary: `foo:href` can bind the XLink namespace just like
      // `xlink:href`. Let a preceding colon reach the URL check while still ignoring names such as
      // `data-href` and `somehref`.
      const precedingCharacter = normalized[start - 1];
      if (
        (isXmlNameCharacter(precedingCharacter) && precedingCharacter !== ":") ||
        isXmlNameCharacter(normalized[searchFrom])
      ) {
        continue;
      }

      let cursor = skipXmlWhitespace(normalized, searchFrom);
      if (normalized[cursor] !== "=") continue;
      cursor = skipXmlWhitespace(normalized, cursor + 1);
      const quote = normalized[cursor] === '"' || normalized[cursor] === "'" ? normalized[cursor] : null;
      if (!quote) return true;
      const valueStart = cursor + 1;
      let valueEnd = valueStart;
      while (valueEnd < normalized.length && normalized[valueEnd] !== quote) {
        valueEnd += 1;
      }
      if (normalized[valueEnd] !== quote) return true;
      const url = normalizeSvgUrlScheme(normalized.slice(valueStart, valueEnd));
      if (url === null) return true;
      if (url.startsWith("javascript") || url.startsWith("vbscript") || url.startsWith("data:text/html")) {
        return true;
      }
    }
  }
  return false;
}

/** Compare canonical paths using the host filesystem's case and separator rules. */
export function isCanonicalMediaPathInsideRoot(
  canonicalPath: string,
  canonicalRoot: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathApi = platform === "win32" ? win32 : posix;
  const normalizeCase = (value: string) => (platform === "win32" ? value.toLowerCase() : value);
  const relativePath = pathApi.relative(normalizeCase(canonicalRoot), normalizeCase(canonicalPath));
  return (
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relativePath))
  );
}

/** Resolve symlinks and permit reads only from Marinara's configured media roots. */
async function resolveAllowedMediaPath(filePath: string, additionalRoot?: string): Promise<string | null> {
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(resolve(filePath));
  } catch {
    return null;
  }

  for (const configuredRoot of new Set(
    [getDataDir(), getFileStorageDir(), additionalRoot].filter(Boolean) as string[],
  )) {
    try {
      const canonicalRoot = await realpath(resolve(configuredRoot));
      if (isCanonicalMediaPathInsideRoot(canonicalPath, canonicalRoot)) return canonicalPath;
    } catch {
      // A configured root may not exist yet; it cannot contain this file.
    }
  }
  return null;
}

/**
 * SVG remains a supported sprite/game-asset format, but active document
 * features are not needed for artwork and are unsafe on a same-origin route.
 */
export function isSafeSvgImageBuffer(buffer: Buffer): boolean {
  const source = buffer.toString("utf8");
  if (source.includes("\ufffd") || !/<svg(?:\s|>)/iu.test(source)) return false;
  // Preserve ordinary SVG 1.1 exports while rejecting internal subsets and
  // non-SVG declarations. Entity declarations remain forbidden below.
  const doctypeStart = source.search(/<!doctype/iu);
  let withoutPassiveDoctype = source;
  if (doctypeStart >= 0) {
    const doctypeEnd = source.indexOf(">", doctypeStart);
    if (doctypeEnd < 0) return false;
    const declaration = source.slice(doctypeStart, doctypeEnd + 1);
    const normalized = declaration.replace(/\s+/gu, " ").trim().toLowerCase();
    const passiveSvgDoctype =
      normalized === "<!doctype svg>" ||
      (/^<!doctype svg (?:public|system) /u.test(normalized) &&
        !normalized.includes("[") &&
        normalized.includes("www.w3.org/graphics/svg/") &&
        normalized.endsWith(">"));
    if (!passiveSvgDoctype) return false;
    withoutPassiveDoctype = `${source.slice(0, doctypeStart)} ${source.slice(doctypeEnd + 1)}`;
  }
  return !(
    /<!doctype|<!entity/iu.test(withoutPassiveDoctype) ||
    /<(?:[^\s<>/:]+:)?(?:script|foreignObject|iframe|object|embed)(?=[\s/>])/iu.test(source) ||
    /\bon[a-z][a-z0-9_-]*\s*=/iu.test(source) ||
    hasUnsafeSvgAnimatedAttribute(source) ||
    hasUnsafeSvgHref(source) ||
    /(?:@import|expression\s*\(|-moz-binding\s*:)/iu.test(source)
  );
}

/** Validate bytes and ensure their detected type agrees with the filename. */
export function validateImageAssetBuffer(
  buffer: Buffer,
  filename: string,
  options: { allowSvg?: boolean } = {},
): ValidatedImageAsset | null {
  const extension = extname(filename).toLowerCase();
  if (extension === SVG_EXTENSION) {
    return options.allowSvg && isSafeSvgImageBuffer(buffer) ? { mimeType: "image/svg+xml", isSvg: true } : null;
  }
  if (!RASTER_IMAGE_EXTENSIONS.has(extension)) return null;
  // Serve any recognized raster by its detected format so a mislabeled but valid
  // image (e.g. WebP/JPEG bytes stored under a .png name) still renders with an
  // honest Content-Type. Raster formats are inert; SVG stays strict above.
  const image = isAllowedImageBuffer(buffer, extension);
  if (!image) return null;
  return { mimeType: image.mimeType, isSvg: false };
}

export function validateVideoAssetBuffer(buffer: Buffer, filename: string): ValidatedVideoAsset | null {
  const extension = extname(filename).toLowerCase();
  if (
    (extension === ".mp4" || extension === ".mov") &&
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    return { mimeType: extension === ".mov" ? "video/quicktime" : "video/mp4" };
  }
  if (
    extension === ".webm" &&
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) {
    return { mimeType: "video/webm" };
  }
  return null;
}

/** Read only enough bytes to identify a raster image; SVG needs a full safety scan. */
export async function validateImageAssetFile(
  filePath: string,
  filename = basename(filePath),
  options: { allowSvg?: boolean; additionalRoot?: string } = {},
): Promise<ValidatedImageFile | null> {
  const safeFilePath = await resolveAllowedMediaPath(filePath, options.additionalRoot);
  if (!safeFilePath) return null;
  let handle: FileHandle | null = null;
  if (extname(filename).toLowerCase() === SVG_EXTENSION) {
    if (!options.allowSvg) return null;
    try {
      handle = await open(safeFilePath, "r");
      const file = await handle.stat();
      if (!file.isFile() || file.size > SVG_IMAGE_MAX_BYTES) throw new Error("Invalid SVG file");
      const bytes = Buffer.alloc(file.size + 1);
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      if (bytesRead !== file.size) throw new Error("Incomplete SVG read");
      const image = validateImageAssetBuffer(bytes.subarray(0, bytesRead), filename, options);
      if (!image) throw new Error("Unsafe SVG file");
      return { ...image, handle, size: file.size };
    } catch {
      await handle?.close().catch(() => undefined);
      return null;
    }
  }

  try {
    handle = await open(safeFilePath, "r");
    const header = Buffer.alloc(IMAGE_HEADER_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const image = validateImageAssetBuffer(header.subarray(0, bytesRead), filename, options);
    if (!image) throw new Error("Invalid image file");
    const file = await handle.stat();
    if (!file.isFile()) throw new Error("Invalid image file");
    return { ...image, handle, size: file.size };
  } catch {
    await handle?.close().catch(() => undefined);
    return null;
  }
}

export async function validateVideoAssetFile(
  filePath: string,
  filename = basename(filePath),
  options: { additionalRoot?: string } = {},
): Promise<ValidatedVideoFile | null> {
  const safeFilePath = await resolveAllowedMediaPath(filePath, options.additionalRoot);
  if (!safeFilePath) return null;
  let handle: FileHandle | null = null;
  try {
    handle = await open(safeFilePath, "r");
    const header = Buffer.alloc(IMAGE_HEADER_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const video = validateVideoAssetBuffer(header.subarray(0, bytesRead), filename);
    if (!video) throw new Error("Invalid video file");
    const file = await handle.stat();
    if (!file.isFile()) throw new Error("Invalid video file");
    return { ...video, handle, size: file.size };
  } catch {
    await handle?.close().catch(() => undefined);
    return null;
  }
}

/** Flat-file stores must never interpret an imported row value as a path. */
export function resolveFlatMediaFile(rootDir: string, storedFilePath: unknown): string | null {
  if (typeof storedFilePath !== "string" || !storedFilePath || storedFilePath.includes("\0")) return null;
  if (basename(storedFilePath) !== storedFilePath || storedFilePath.includes("/") || storedFilePath.includes("\\")) {
    return null;
  }
  try {
    return assertInsideDir(rootDir, join(rootDir, storedFilePath));
  } catch {
    return null;
  }
}
