// ──────────────────────────────────────────────
// Routes: Character Sprite Upload, List & Serving
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import AdmZip from "adm-zip";
import { execFile } from "child_process";
import { existsSync, mkdirSync, createReadStream, readdirSync, unlinkSync, statSync, readFileSync } from "fs";
import { randomUUID } from "crypto";
import { writeFile, mkdir, readdir, unlink, copyFile, rm, readFile, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { DATA_DIR } from "../utils/data-dir.js";
import {
  getBackgroundRemoverStatus,
  tryRemoveBackgroundWithBackgroundRemover,
} from "../services/image/background-remover.service.js";
import { logger } from "../lib/logger.js";

// sharp is an optional dependency — native prebuilds don't exist for all platforms
// (e.g. Android/Termux). Lazy-load so the server boots even when sharp is missing;
// sprite-generation routes will return a clear error instead of crashing the process.
// We intentionally avoid `import type` from "sharp" so tsc succeeds on platforms
// where the package isn't installed at all.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpFn = any;
let _sharp: SharpFn | null = null;
let _sharpLoadError: Error | null = null;
async function getSharp(): Promise<SharpFn> {
  if (_sharp) return _sharp;
  if (_sharpLoadError) throw _sharpLoadError;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - optional native dep, may not be installed on some platforms
    const mod = await import("sharp");
    _sharp = (mod.default ?? mod) as SharpFn;
    return _sharp;
  } catch (error) {
    logger.warn(
      error instanceof Error ? error : new Error(String(error)),
      "[sprites] Image processing unavailable because sharp could not be loaded",
    );
    _sharpLoadError = new Error(
      "Image processing is unavailable on this platform (native 'sharp' module could not be loaded). " +
        "Sprite generation and background removal are disabled.",
    );
    throw _sharpLoadError;
  }
}

async function getSpriteCapabilities() {
  try {
    await getSharp();
    return {
      imageProcessingAvailable: true,
      spriteGenerationAvailable: true,
      backgroundRemovalAvailable: true,
      reason: null as string | null,
    };
  } catch (error) {
    return {
      imageProcessingAvailable: false,
      spriteGenerationAvailable: false,
      backgroundRemovalAvailable: false,
      reason: error instanceof Error ? error.message : "Image processing is unavailable on this platform.",
    };
  }
}
import { generateImage } from "../services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { generateVideo, type VideoReferenceImage } from "../services/video/video-generation.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import {
  loadPrompt,
  SPRITES_ANIMATED_PORTRAIT,
  SPRITES_EXPRESSION_SHEET,
  SPRITES_SINGLE_PORTRAIT,
  SPRITES_SINGLE_FULL_BODY,
  SPRITES_FULL_BODY_SHEET,
} from "../services/prompt-overrides/index.js";
import {
  clampVideoDuration,
  createDefaultVideoGenerationProfile,
  inferVideoSource,
  normalizeVideoGenerationProfile,
  normalizeVideoGenerationUserSettings,
  normalizeSpriteExpressionLabel,
  VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX,
  VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN,
  VIDEO_DEFAULTS_STORAGE_KEY,
  VIDEO_GENERATION_SETTINGS_KEY,
  type ImageGenerationDefaultsProfile,
  type ImageStyleProfileSettings,
} from "@marinara-engine/shared";
import { isAllowedImageBuffer } from "../utils/security.js";

const execFileAsync = promisify(execFile);

const SPRITES_ROOT = join(DATA_DIR, "sprites");
const ROUTE_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_PUBLIC_DIR = resolve(ROUTE_DIR, "../../../client/public");
const CLIENT_DIST_DIR = resolve(ROUTE_DIR, "../../../client/dist");
const MAX_SPRITE_GRID_DIMENSION = 8;
const MAX_INDIVIDUAL_SPRITE_EXPRESSIONS = 8;
const MAX_ANIMATED_SPRITE_EXPRESSIONS = 16;
const SPRITE_FILE_RE = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i;
const CLEANUP_INPUT_FILE_RE = /\.(png|jpg|jpeg|webp|avif)$/i;
const SPRITE_EXPORT_NAME_RE = /[^a-z0-9._ -]+/gi;
const ANIMATED_EXPRESSION_ASPECT_RATIO = "9:16" as const;
const ANIMATED_EXPRESSION_GIF_WIDTH = 512;
const ANIMATED_EXPRESSION_GIF_FPS = 12;
const ANIMATED_EXPRESSION_FFMPEG_TIMEOUT_MS = Number(process.env.SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS ?? 180_000);

type SpriteCleanupEngine = "auto" | "backgroundremover" | "builtin";
type UsedSpriteCleanupEngine = "backgroundremover" | "builtin";

interface SpriteCleanupBackupEntry {
  expression: string;
  originalFilename: string;
  cleanedFilename: string;
  backupFilename: string;
}

interface SpriteCleanupBackupManifest {
  id: string;
  createdAt: string;
  entries: SpriteCleanupBackupEntry[];
}

type SpriteType = "expressions" | "full-body";

type SpritePromptOverride = {
  id: string;
  prompt: string;
  negativePrompt?: string;
};

type SpriteCompiledPrompt = {
  prompt: string;
  negativePrompt: string;
};

type SpriteGenerateSheetBody = {
  connectionId?: string;
  appearance?: string;
  referenceImage?: string;
  referenceImages?: string[];
  expressions?: string[];
  cols?: number;
  rows?: number;
  spriteType?: SpriteType;
  fullBodyExpressionMode?: boolean;
  noBackground?: boolean;
  cleanupStrength?: number;
  nativeTransparentPng?: boolean;
  promptOverrides?: SpritePromptOverride[];
};

type SpriteGenerateAnimatedBody = Omit<SpriteGenerateSheetBody, "cols" | "rows" | "spriteType" | "fullBodyExpressionMode"> & {
  durationSeconds?: number;
};

type VideoGenerationConnection = {
  id: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  defaultParameters?: string | null;
};

function coerceSpriteGridDimension(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback;
  return Math.min(MAX_SPRITE_GRID_DIMENSION, n);
}

function isInvalidSpriteGridDimension(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  const numeric = Number(raw);
  return !Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 1 || numeric > MAX_SPRITE_GRID_DIMENSION;
}

type SpritePromptPlan = {
  expressions: string[];
  cols: number;
  rows: number;
  spriteType?: SpriteType;
  fullBodyExpressionMode: boolean;
  generateExpressionsIndividually: boolean;
  appearance: string;
  prompt: string;
  sheetWidth: number;
  sheetHeight: number;
  cellWidth: number;
  cellHeight: number;
  promptOverrides: Map<string, SpriteCompiledPrompt>;
  promptOverridesStorage: ReturnType<typeof createPromptOverridesStorage>;
};

const SPRITE_GENERATION_TIMEOUT_MS = Number(
  process.env.SPRITE_GENERATION_TIMEOUT_MS ?? process.env.IMAGE_GEN_TIMEOUT_MS ?? 1_800_000,
);

class SpriteGenerationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Sprite generation timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    this.name = "SpriteGenerationTimeoutError";
  }
}

function withSpriteGenerationDeadline<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new SpriteGenerationTimeoutError(SPRITE_GENERATION_TIMEOUT_MS)),
      SPRITE_GENERATION_TIMEOUT_MS,
    );
    timeout.unref?.();
  });

  return Promise.race([promise, deadline]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function spritePromptReviewId(kind: "sheet" | "expression", spriteType: string | undefined, label: string): string {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9,_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
  return `sprite:${spriteType ?? "expressions"}:${kind}:${normalizedLabel || "request"}`;
}

function animatedSpritePromptReviewId(expression: string): string {
  return spritePromptReviewId("expression", "animated-portrait", expression);
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function isOpenAIGptImageModel(model?: string): boolean {
  return !!model && /^gpt-image-(?:1|1\.5|2)(?:$|-)/i.test(model.trim());
}

function isOpenAIGptImage2Model(model?: string): boolean {
  return !!model && /^gpt-image-2(?:$|-)/i.test(model.trim());
}

function resolveSpriteSheetCanvas({
  cols,
  rows,
  spriteType,
  model,
}: {
  cols: number;
  rows: number;
  spriteType?: string;
  model?: string;
}) {
  const preferredCellWidth = 512;
  const preferredCellHeight = spriteType === "full-body" ? 768 : 512;
  const requestedSheetWidth = cols * preferredCellWidth;
  const requestedSheetHeight = rows * preferredCellHeight;

  if (!isOpenAIGptImageModel(model) || (spriteType !== "full-body" && isOpenAIGptImage2Model(model))) {
    return {
      sheetWidth: requestedSheetWidth,
      sheetHeight: requestedSheetHeight,
      cellWidth: preferredCellWidth,
      cellHeight: preferredCellHeight,
    };
  }

  const ratio = requestedSheetWidth / Math.max(1, requestedSheetHeight);
  const sheetWidth = ratio > 1.12 ? 1536 : 1024;
  const sheetHeight = ratio > 1.12 ? 1024 : ratio < 0.88 ? 1536 : 1024;

  return {
    sheetWidth,
    sheetHeight,
    cellWidth: Math.floor(sheetWidth / cols),
    cellHeight: Math.floor(sheetHeight / rows),
  };
}

const NATIVE_TRANSPARENT_PNG_PROMPT = "no background, png format";
const CLEANUP_FRIENDLY_MATTE_FALLBACK =
  "If transparent output is unsupported, use a perfectly flat pure white #ffffff " +
  "background with no shadows, gradients, scenery, floor line, or texture behind the character";
const CLEANUP_FRIENDLY_TRANSPARENT_PNG_PROMPT = `${NATIVE_TRANSPARENT_PNG_PROMPT}. ${CLEANUP_FRIENDLY_MATTE_FALLBACK}`;

function shouldUseCleanupFriendlyTransparentPrompt(model?: string): boolean {
  return isOpenAIGptImage2Model(model);
}

function applyNativeTransparentPngPrompt(prompt: string, cleanupFriendly = false): string {
  const replacement = cleanupFriendly ? CLEANUP_FRIENDLY_TRANSPARENT_PNG_PROMPT : NATIVE_TRANSPARENT_PNG_PROMPT;
  const updated = prompt
    .replace(/\bsolid white studio background\b/gi, replacement)
    .replace(/\bsolid white background\b/gi, replacement)
    .replace(/\bplain white background\b/gi, replacement)
    .replace(/\bwhite studio background\b/gi, replacement)
    .replace(/\bwhite background\b/gi, replacement);

  if (updated !== prompt) {
    return updated;
  }
  if (/\b(?:no background|transparent background|transparent png|png format)\b/i.test(updated)) {
    return cleanupFriendly && !/flat pure white/i.test(updated)
      ? `${updated}. ${CLEANUP_FRIENDLY_MATTE_FALLBACK}`
      : updated;
  }
  return `${updated}, ${replacement}`;
}

function compileSpritePrompt(
  prompt: string,
  options: {
    negativePrompt?: string;
    appearance?: string;
    styleProfiles: ImageStyleProfileSettings;
    imageDefaults?: ImageGenerationDefaultsProfile | null;
  },
): SpriteCompiledPrompt {
  const compiled = compileImagePrompt({
    kind: "sprite",
    prompt,
    negativePrompt: options.negativePrompt,
    userPositive: options.appearance,
    styleProfiles: options.styleProfiles,
    imageDefaults: options.imageDefaults,
  });
  return {
    prompt: compiled.prompt,
    negativePrompt: compiled.negativePrompt,
  };
}

function parseDefaultParametersRoot(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
}

function getStoredVideoDefaults(raw: unknown) {
  const root = parseDefaultParametersRoot(raw);
  return normalizeVideoGenerationProfile(root[VIDEO_DEFAULTS_STORAGE_KEY]).profile;
}

function resolveVideoConnection(connection: VideoGenerationConnection) {
  const videoDefaults = connection.defaultParameters
    ? getStoredVideoDefaults(connection.defaultParameters)
    : createDefaultVideoGenerationProfile();
  const explicitVideoSource = connection.videoGenerationSource || connection.videoService || "";
  const source =
    explicitVideoSource ||
    (videoDefaults.service !== "gemini_omni"
      ? videoDefaults.service
      : inferVideoSource(connection.model || "", connection.baseUrl || ""));
  const serviceHint = connection.videoService || source;
  const isXaiVideo = source === "xai" || serviceHint === "xai";
  const isGoogleVeoVideo = source === "google_veo" || serviceHint === "google_veo";
  const isOpenRouterVideo = source === "openrouter" || serviceHint === "openrouter";
  return {
    source,
    serviceHint,
    baseUrl:
      connection.baseUrl ||
      (isXaiVideo
        ? "https://api.x.ai/v1"
        : isGoogleVeoVideo
          ? "https://generativelanguage.googleapis.com/v1beta"
        : isOpenRouterVideo
          ? "https://openrouter.ai/api/v1"
          : "https://generativelanguage.googleapis.com/v1beta"),
    model:
      connection.model ||
      (isXaiVideo
        ? "grok-imagine-video-1.5"
        : isGoogleVeoVideo
          ? "veo-3.1-generate-preview"
          : isOpenRouterVideo
            ? "google/veo-3.1"
            : "gemini-omni-flash-preview"),
    resolution: isXaiVideo
      ? videoDefaults.xai.resolution
      : isGoogleVeoVideo
        ? videoDefaults.googleVeo.resolution
      : isOpenRouterVideo
        ? videoDefaults.openrouter.resolution
        : undefined,
  };
}

function executableExists(path: string): boolean {
  try {
    const stat = statSync(path, { throwIfNoEntry: false });
    return !!stat?.isFile();
  } catch {
    return false;
  }
}

function pathExecutableNames(name: string): string[] {
  if (process.platform !== "win32") return [name];
  const extensions = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((ext) => ext.trim())
    .filter(Boolean);
  return extensions.map((ext) => `${name}${ext.toLowerCase()}`);
}

function findExecutableOnPath(name: string): string | null {
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    for (const executableName of pathExecutableNames(name)) {
      const candidate = join(entry, executableName);
      if (executableExists(candidate)) return candidate;
    }
  }
  return null;
}

function resolveFfmpegCommand(): string {
  const configured = process.env.FFMPEG_PATH?.trim() || process.env.FFMPEG_COMMAND?.trim();
  if (configured) return configured;
  const found = findExecutableOnPath("ffmpeg");
  if (found) return found;
  throw new Error(
    "Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.",
  );
}

async function convertMp4ToGif(input: Buffer): Promise<Buffer> {
  const ffmpeg = resolveFfmpegCommand();
  const tempDir = await mkdtemp(join(tmpdir(), "marinara-animated-expression-"));
  const inputPath = join(tempDir, "input.mp4");
  const palettePath = join(tempDir, "palette.png");
  const outputPath = join(tempDir, "output.gif");
  try {
    await writeFile(inputPath, input);
    await execFileAsync(
      ffmpeg,
      [
        "-y",
        "-i",
        inputPath,
        "-vf",
        `fps=${ANIMATED_EXPRESSION_GIF_FPS},scale=${ANIMATED_EXPRESSION_GIF_WIDTH}:-1:flags=lanczos,palettegen=max_colors=96`,
        palettePath,
      ],
      { timeout: ANIMATED_EXPRESSION_FFMPEG_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
    );
    await execFileAsync(
      ffmpeg,
      [
        "-y",
        "-i",
        inputPath,
        "-i",
        palettePath,
        "-filter_complex",
        `fps=${ANIMATED_EXPRESSION_GIF_FPS},scale=${ANIMATED_EXPRESSION_GIF_WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
        "-loop",
        "0",
        outputPath,
      ],
      { timeout: ANIMATED_EXPRESSION_FFMPEG_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
    );
    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function resolveSpritePromptOverride(override: SpriteCompiledPrompt | undefined, fallback: SpriteCompiledPrompt) {
  return { value: override ?? fallback, overridden: !!override };
}

function withSpriteSheetLayoutContract(
  prompt: SpriteCompiledPrompt,
  plan: SpritePromptPlan,
  options: { reviewedOverride?: boolean } = {},
): SpriteCompiledPrompt {
  if (plan.generateExpressionsIndividually || options.reviewedOverride) return prompt;

  const totalCells = plan.cols * plan.rows;
  const expressionList = plan.expressions.map(formatSpriteLabelForPrompt).join(", ");
  const wrongNineCellGuard =
    totalCells === 9 ? "" : " Do not return a 3x3 grid, 9 cells, or fewer cells than requested.";
  const layoutContract = [
    `MANDATORY SPRITE SHEET LAYOUT: return one ${plan.sheetWidth}x${plan.sheetHeight}px image containing exactly ${totalCells} separate cells in a strict ${plan.cols} columns by ${plan.rows} rows grid.`,
    `Each cell is exactly ${plan.cellWidth}x${plan.cellHeight}px; vertical grid cuts are every ${plan.cellWidth}px and horizontal grid cuts are every ${plan.cellHeight}px.`,
    `Fill every cell. The first ${plan.expressions.length} cells, read left-to-right then top-to-bottom, must be: ${expressionList}.`,
    `No missing cells, no extra cells, no merged cells, no blank cells, no uneven grid, and no one-large-image composition.${wrongNineCellGuard}`,
  ].join(" ");
  const negativeLayout = [
    prompt.negativePrompt,
    `missing cells, fewer than ${totalCells} cells, extra cells, merged cells, blank cells, uneven grid, one large image spanning cells`,
    totalCells === 9 ? "" : `3x3 grid, 9 cells`,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    prompt: `${prompt.prompt}\n\n${layoutContract}`,
    negativePrompt: negativeLayout,
  };
}

function formatSpriteLabelForPrompt(label: string): string {
  return label.trim().replace(/[_-]+/g, " ");
}

function normalizeSpriteExpression(raw: string): string {
  return normalizeSpriteExpressionLabel(raw, { fullBody: /^\s*full[_\s-]+/iu.test(raw) });
}

function sanitizeSpriteExportName(raw: unknown, fallback: string): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  const sanitized = value
    .replace(/[\\/]/g, "_")
    .replace(SPRITE_EXPORT_NAME_RE, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s_-]+|[.\s_-]+$/g, "");
  return sanitized || fallback;
}

function normalizeSpriteCleanupEngine(raw: unknown): SpriteCleanupEngine {
  if (typeof raw !== "string") return "auto";
  const value = raw.trim().toLowerCase();
  if (value === "backgroundremover" || value === "background-remover" || value === "ai") return "backgroundremover";
  if (value === "builtin" || value === "built-in" || value === "matte" || value === "white") return "builtin";
  return "auto";
}

function isSafeBackupId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]+$/i.test(value) && !value.includes("..");
}

function listSpriteInfos(characterId: string) {
  const dir = join(SPRITES_ROOT, characterId);
  ensureDir(dir);

  try {
    return readdirSync(dir)
      .filter((f) => SPRITE_FILE_RE.test(f))
      .map((f) => {
        const ext = extname(f);
        const expression = f.slice(0, -ext.length);
        const mtime = statSync(join(dir, f)).mtimeMs;
        return {
          expression,
          filename: f,
          url: `/api/sprites/${characterId}/file/${encodeURIComponent(f)}?v=${Math.floor(mtime)}`,
        };
      });
  } catch {
    return [];
  }
}

function buildFullBodyExpressionSheetPrompt({
  cols,
  rows,
  expressions,
  appearance,
  sheetWidth,
  sheetHeight,
  cellWidth,
  cellHeight,
}: {
  cols: number;
  rows: number;
  expressions: string[];
  appearance: string;
  sheetWidth: number;
  sheetHeight: number;
  cellWidth: number;
  cellHeight: number;
}): string {
  const cellCount = cols * rows;
  const readableExpressions = expressions.map(formatSpriteLabelForPrompt);
  const fillerCount = Math.max(0, cellCount - readableExpressions.length);

  return [
    `full-body character expression sprite sheet source image, designed to be sliced into cells,`,
    `target output canvas is ${sheetWidth}x${sheetHeight} pixels, with each cell exactly ${cellWidth}x${cellHeight} pixels,`,
    `strict ${cols} columns by ${rows} rows grid, exactly ${cellCount} equally sized tall rectangular cells,`,
    `all vertical grid cuts are evenly spaced every ${cellWidth} pixels and all horizontal grid cuts every ${cellHeight} pixels,`,
    `solid white background, thin straight borders or clean gutters separating every cell,`,
    `same character in every cell, same outfit, same proportions, same scale, consistent art style,`,
    `first ${readableExpressions.length} cells left-to-right top-to-bottom must match these facial expressions while keeping the same relaxed standing idle pose: ${readableExpressions.join(", ")},`,
    fillerCount > 0
      ? `fill the remaining ${fillerCount} cells with neutral relaxed standing idle filler sprites; filler cells are ignored after slicing,`
      : undefined,
    `${appearance},`,
    `each cell shows one complete full-body character from head to toe, centered upright, feet visible, no cropping,`,
    `the character must use no more than 78% of the cell height; leave at least 10% empty padding above the head and 12% empty padding below the feet inside every cell,`,
    `feet and shoes must be clearly above the bottom border or gutter, especially in the final row, never touching or cut by the cell edge,`,
    `keep every sprite fully inside its own cell; no hair, feet, clothing, weapons, shadows, or effects may cross into another cell,`,
    `only the face and mood change between the expression cells; body pose stays idle and relaxed,`,
    `do not create action, walking, running, attack, casting, combat, jumping, sitting, or victory poses,`,
    `leave enough whitespace around each full-body sprite so feet, hair, weapons, and hands are fully visible inside that cell,`,
    `do not make one single large full-body image, do not make a poster, comic page, collage, diagonal layout, or merged composition,`,
    `all cells same size, perfectly aligned, no overlapping, no merged cells, no blank cells,`,
    `the final image must stop after row ${rows}; do not draw bonus rows, bonus poses, or extra characters,`,
    `no text, no labels, no numbers, no captions, no watermark`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type RgbColor = { red: number; green: number; blue: number };

function rgbLuma(color: RgbColor): number {
  return color.red * 0.2126 + color.green * 0.7152 + color.blue * 0.0722;
}

function rgbSpread(color: RgbColor): number {
  return Math.max(color.red, color.green, color.blue) - Math.min(color.red, color.green, color.blue);
}

function rgbDistance(a: RgbColor, b: RgbColor): number {
  return Math.hypot(a.red - b.red, a.green - b.green, a.blue - b.blue);
}

function medianNumber(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? fallback;
}

/**
 * Remove the border-connected white matte and decontaminate edge pixels.
 * This keeps internal whites intact while cleaning the generated backdrop halo.
 */
async function removeNearWhiteBackgroundPng(input: Buffer, cleanupStrength = 35): Promise<Buffer> {
  const sharp = await getSharp();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height) {
    return sharp(input).png().toBuffer();
  }

  const rgba = Buffer.from(data);
  const channels = info.channels;
  const strength = Math.max(0, Math.min(100, cleanupStrength));

  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;
  const matteMask = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const transparentAlpha = 4;

  const pixelOffset = (pixelIndex: number) => pixelIndex * channels;

  const readPixel = (pixelIndex: number): RgbColor => {
    const offset = pixelOffset(pixelIndex);
    return {
      red: rgba[offset] ?? 255,
      green: rgba[offset + 1] ?? 255,
      blue: rgba[offset + 2] ?? 255,
    };
  };

  const estimateMatteColor = (): RgbColor => {
    const samples: RgbColor[] = [];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 96));
    const acceptSample = (pixelIndex: number) => {
      const offset = pixelOffset(pixelIndex);
      const alpha = rgba[offset + 3] ?? 255;
      if (alpha <= transparentAlpha) return;

      const color = readPixel(pixelIndex);
      if (rgbLuma(color) < 172 - strength * 0.18 || rgbSpread(color) > 38 + strength * 0.3) return;
      samples.push(color);
    };

    for (let xPos = 0; xPos < width; xPos += step) {
      acceptSample(xPos);
      acceptSample((height - 1) * width + xPos);
    }
    for (let yPos = 0; yPos < height; yPos += step) {
      acceptSample(yPos * width);
      acceptSample(yPos * width + width - 1);
    }

    return {
      red: medianNumber(
        samples.map((sample) => sample.red),
        255,
      ),
      green: medianNumber(
        samples.map((sample) => sample.green),
        255,
      ),
      blue: medianNumber(
        samples.map((sample) => sample.blue),
        255,
      ),
    };
  };

  const matteColor = estimateMatteColor();
  const matteLuma = rgbLuma(matteColor);
  const hardCutoff = 14 + (strength / 100) * 32;
  const softCutoff = hardCutoff + 30 + (strength / 100) * 42;
  const haloCutoff = softCutoff + 12 + (strength / 100) * 18;
  const lumaFloor = Math.max(178, matteLuma - (30 + strength * 0.46));
  const spreadLimit = 18 + (strength / 100) * 38;

  const matteDistance = (pixelIndex: number): number => rgbDistance(readPixel(pixelIndex), matteColor);

  const isMatteCandidate = (pixelIndex: number, distanceCutoff: number, floorOffset = 0, spreadOffset = 0) => {
    const offset = pixelOffset(pixelIndex);
    const alpha = rgba[offset + 3] ?? 255;

    if (alpha <= transparentAlpha) return true;

    const color = readPixel(pixelIndex);
    if (rgbLuma(color) < lumaFloor + floorOffset || rgbSpread(color) > spreadLimit + spreadOffset) {
      return false;
    }

    return matteDistance(pixelIndex) <= distanceCutoff;
  };

  const markMatte = (pixelIndex: number) => {
    if (matteMask[pixelIndex]) return;
    matteMask[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  const enqueueMatte = (pixelIndex: number) => {
    if (matteMask[pixelIndex]) return;
    if (!isMatteCandidate(pixelIndex, softCutoff)) return;
    markMatte(pixelIndex);
  };

  const drainMatteQueue = () => {
    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart++]!;
      const xPos = pixelIndex % width;
      const yPos = Math.floor(pixelIndex / width);

      if (xPos > 0) enqueueMatte(pixelIndex - 1);
      if (xPos < width - 1) enqueueMatte(pixelIndex + 1);
      if (yPos > 0) enqueueMatte(pixelIndex - width);
      if (yPos < height - 1) enqueueMatte(pixelIndex + width);
    }
  };

  for (let xPos = 0; xPos < width; xPos++) {
    enqueueMatte(xPos);
    enqueueMatte((height - 1) * width + xPos);
  }
  for (let yPos = 0; yPos < height; yPos++) {
    enqueueMatte(yPos * width);
    enqueueMatte(yPos * width + width - 1);
  }

  drainMatteQueue();

  const innerCutoff = Math.max(hardCutoff + 12, softCutoff * 0.88);
  const strictLineCutoff = Math.min(innerCutoff, hardCutoff + 22);
  const rowMatteCounts = new Uint32Array(height);
  const colMatteCounts = new Uint32Array(width);
  const isStrictMatteCandidate = (pixelIndex: number) => isMatteCandidate(pixelIndex, strictLineCutoff, 10, -8);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (matteMask[pixelIndex] || !isStrictMatteCandidate(pixelIndex)) continue;
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    rowMatteCounts[yPos] = (rowMatteCounts[yPos] ?? 0) + 1;
    colMatteCounts[xPos] = (colMatteCounts[xPos] ?? 0) + 1;
  }

  const broadRowThreshold = width * 0.34;
  const broadColThreshold = height * 0.34;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (matteMask[pixelIndex] || !isStrictMatteCandidate(pixelIndex)) continue;
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    if ((rowMatteCounts[yPos] ?? 0) >= broadRowThreshold || (colMatteCounts[xPos] ?? 0) >= broadColThreshold) {
      markMatte(pixelIndex);
    }
  }

  drainMatteQueue();

  const innerVisited = new Uint8Array(pixelCount);
  const componentQueue = new Int32Array(pixelCount);
  const componentPixels = new Int32Array(pixelCount);
  const minComponentPixels = Math.max(180, pixelCount * (0.003 + ((100 - strength) / 100) * 0.004));
  const isInnerMatteCandidate = (pixelIndex: number) => isMatteCandidate(pixelIndex, innerCutoff, 8, -8);

  for (let startIndex = 0; startIndex < pixelCount; startIndex++) {
    if (innerVisited[startIndex] || matteMask[startIndex] || !isInnerMatteCandidate(startIndex)) continue;

    let componentStart = 0;
    let componentEnd = 0;
    let componentCount = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    innerVisited[startIndex] = 1;
    componentQueue[componentEnd++] = startIndex;

    while (componentStart < componentEnd) {
      const pixelIndex = componentQueue[componentStart++]!;
      componentPixels[componentCount++] = pixelIndex;

      const xPos = pixelIndex % width;
      const yPos = Math.floor(pixelIndex / width);
      minX = Math.min(minX, xPos);
      maxX = Math.max(maxX, xPos);
      minY = Math.min(minY, yPos);
      maxY = Math.max(maxY, yPos);

      const visitNeighbor = (neighborIndex: number) => {
        if (innerVisited[neighborIndex] || matteMask[neighborIndex] || !isInnerMatteCandidate(neighborIndex)) return;
        innerVisited[neighborIndex] = 1;
        componentQueue[componentEnd++] = neighborIndex;
      };

      if (xPos > 0) visitNeighbor(pixelIndex - 1);
      if (xPos < width - 1) visitNeighbor(pixelIndex + 1);
      if (yPos > 0) visitNeighbor(pixelIndex - width);
      if (yPos < height - 1) visitNeighbor(pixelIndex + width);
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const componentBoxArea = componentWidth * componentHeight;
    const fillRatio = componentCount / Math.max(1, componentBoxArea);
    const sizeRatio = componentCount / pixelCount;
    const boxRatio = componentBoxArea / pixelCount;
    const spansCell = componentWidth >= width * 0.14 || componentHeight >= height * 0.14;
    const touchesInnerFrame =
      minX <= width * 0.12 || maxX >= width * 0.88 || minY <= height * 0.12 || maxY >= height * 0.88;
    const panelLike = fillRatio >= 0.3 && boxRatio >= 0.02 && spansCell && (touchesInnerFrame || sizeRatio >= 0.02);
    const hugeOpenArea = sizeRatio >= 0.035 && fillRatio >= 0.14 && spansCell;
    const largeMattePanel = componentCount >= minComponentPixels && (panelLike || hugeOpenArea);

    if (!largeMattePanel) continue;

    for (let i = 0; i < componentCount; i++) {
      markMatte(componentPixels[i]!);
    }
  }

  drainMatteQueue();

  const findForegroundNeighborColor = (pixelIndex: number) => {
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let weightTotal = 0;

    for (let yOffset = -2; yOffset <= 2; yOffset++) {
      const sampleY = yPos + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;

      for (let xOffset = -2; xOffset <= 2; xOffset++) {
        if (xOffset === 0 && yOffset === 0) continue;
        const sampleX = xPos + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;

        const sampleIndex = sampleY * width + sampleX;
        if (matteMask[sampleIndex] || isMatteCandidate(sampleIndex, haloCutoff, -18, 14)) continue;

        const sampleOffset = pixelOffset(sampleIndex);
        const alpha = rgba[sampleOffset + 3] ?? 255;
        if (alpha <= transparentAlpha) continue;

        const distance = Math.hypot(xOffset, yOffset);
        const weight = alpha / 255 / Math.max(1, distance);
        redTotal += (rgba[sampleOffset] ?? 0) * weight;
        greenTotal += (rgba[sampleOffset + 1] ?? 0) * weight;
        blueTotal += (rgba[sampleOffset + 2] ?? 0) * weight;
        weightTotal += weight;
      }
    }

    if (weightTotal <= 0) return null;
    return {
      red: redTotal / weightTotal,
      green: greenTotal / weightTotal,
      blue: blueTotal / weightTotal,
    };
  };

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (!matteMask[pixelIndex]) continue;
    const offset = pixelOffset(pixelIndex);
    rgba[offset + 3] = 0;
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (matteMask[pixelIndex]) continue;

    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    let matteNeighborWeight = 0;

    for (let yOffset = -2; yOffset <= 2; yOffset++) {
      const sampleY = yPos + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;

      for (let xOffset = -2; xOffset <= 2; xOffset++) {
        if (xOffset === 0 && yOffset === 0) continue;
        const sampleX = xPos + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;
        if (!matteMask[sampleY * width + sampleX]) continue;
        matteNeighborWeight += 1 / Math.max(1, Math.hypot(xOffset, yOffset));
      }
    }

    if (matteNeighborWeight === 0 || !isMatteCandidate(pixelIndex, haloCutoff, -20, 16)) continue;

    const offset = pixelOffset(pixelIndex);
    const alpha = rgba[offset + 3] ?? 255;
    if (alpha <= transparentAlpha) continue;

    const fade = 1 - clampUnit((matteDistance(pixelIndex) - hardCutoff) / Math.max(1, haloCutoff - hardCutoff));
    const edgeWeight = clampUnit(matteNeighborWeight / 3.2);
    const cleanupWeight = fade * edgeWeight;
    const neighborColor = findForegroundNeighborColor(pixelIndex);

    if (neighborColor) {
      const blend = clampUnit(cleanupWeight * (0.55 + strength / 400));
      rgba[offset] = clampByte((rgba[offset] ?? 0) * (1 - blend) + neighborColor.red * blend);
      rgba[offset + 1] = clampByte((rgba[offset + 1] ?? 0) * (1 - blend) + neighborColor.green * blend);
      rgba[offset + 2] = clampByte((rgba[offset + 2] ?? 0) * (1 - blend) + neighborColor.blue * blend);
    } else {
      const matteAmount = clampUnit(cleanupWeight * 0.65);
      const foregroundAmount = Math.max(0.08, 1 - matteAmount);
      rgba[offset] = clampByte(((rgba[offset] ?? 0) - matteColor.red * matteAmount) / foregroundAmount);
      rgba[offset + 1] = clampByte(((rgba[offset + 1] ?? 0) - matteColor.green * matteAmount) / foregroundAmount);
      rgba[offset + 2] = clampByte(((rgba[offset + 2] ?? 0) - matteColor.blue * matteAmount) / foregroundAmount);
    }

    const alphaRemoval = cleanupWeight * (0.18 + strength / 280);
    rgba[offset + 3] = clampByte(alpha * (1 - alphaRemoval));
  }

  return sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function softenBackgroundRemoverMask(
  originalInput: Buffer,
  aiOutput: Buffer,
  cleanupStrength = 35,
): Promise<Buffer> {
  const strength = Math.max(0, Math.min(100, cleanupStrength));
  if (strength >= 99) return aiOutput;

  const sharp = await getSharp();
  const original = await sharp(originalInput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!original.info.width || !original.info.height) return aiOutput;

  const width = original.info.width;
  const height = original.info.height;
  const pixelCount = width * height;
  const originalRgba = Buffer.from(original.data);
  const originalChannels = original.info.channels;
  const ai = await sharp(aiOutput)
    .ensureAlpha()
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const outputRgba = Buffer.from(ai.data);
  const outputChannels = ai.info.channels;
  const transparentAlpha = 16 + ((100 - strength) / 100) * 18;
  const backgroundMask = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const originalOffset = (pixelIndex: number) => pixelIndex * originalChannels;
  const outputOffset = (pixelIndex: number) => pixelIndex * outputChannels;
  const outputAlpha = (pixelIndex: number) => outputRgba[outputOffset(pixelIndex) + 3] ?? 255;
  const isOutputTransparent = (pixelIndex: number) => outputAlpha(pixelIndex) <= transparentAlpha;

  const markBackground = (pixelIndex: number) => {
    if (backgroundMask[pixelIndex] || !isOutputTransparent(pixelIndex)) return;
    backgroundMask[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  for (let xPos = 0; xPos < width; xPos++) {
    markBackground(xPos);
    markBackground((height - 1) * width + xPos);
  }
  for (let yPos = 0; yPos < height; yPos++) {
    markBackground(yPos * width);
    markBackground(yPos * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++]!;
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    if (xPos > 0) markBackground(pixelIndex - 1);
    if (xPos < width - 1) markBackground(pixelIndex + 1);
    if (yPos > 0) markBackground(pixelIndex - width);
    if (yPos < height - 1) markBackground(pixelIndex + width);
  }

  const hasForegroundNeighbor = (pixelIndex: number): boolean => {
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    for (let yOffset = -2; yOffset <= 2; yOffset++) {
      const sampleY = yPos + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;
      for (let xOffset = -2; xOffset <= 2; xOffset++) {
        if (xOffset === 0 && yOffset === 0) continue;
        const sampleX = xPos + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;
        if (outputAlpha(sampleY * width + sampleX) >= 168) return true;
      }
    }
    return false;
  };

  const hasOriginalDetailNeighbor = (pixelIndex: number): boolean => {
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    for (let yOffset = -2; yOffset <= 2; yOffset++) {
      const sampleY = yPos + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;
      for (let xOffset = -2; xOffset <= 2; xOffset++) {
        const sampleX = xPos + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;
        const offset = originalOffset(sampleY * width + sampleX);
        const alpha = originalRgba[offset + 3] ?? 255;
        if (alpha <= 8) continue;
        const color = {
          red: originalRgba[offset] ?? 255,
          green: originalRgba[offset + 1] ?? 255,
          blue: originalRgba[offset + 2] ?? 255,
        };
        if (rgbLuma(color) < 166 || rgbSpread(color) > 42) return true;
      }
    }
    return false;
  };

  const restorePixel = (pixelIndex: number, restoreWeight: number) => {
    const originalPixelOffset = originalOffset(pixelIndex);
    const outputPixelOffset = outputOffset(pixelIndex);
    const originalAlpha = originalRgba[originalPixelOffset + 3] ?? 255;
    const currentAlpha = outputRgba[outputPixelOffset + 3] ?? 255;
    const weight = clampUnit(restoreWeight);
    if (weight <= 0 || currentAlpha >= originalAlpha) return;

    outputRgba[outputPixelOffset] = clampByte(
      (outputRgba[outputPixelOffset] ?? 0) * (1 - weight) + (originalRgba[originalPixelOffset] ?? 0) * weight,
    );
    outputRgba[outputPixelOffset + 1] = clampByte(
      (outputRgba[outputPixelOffset + 1] ?? 0) * (1 - weight) + (originalRgba[originalPixelOffset + 1] ?? 0) * weight,
    );
    outputRgba[outputPixelOffset + 2] = clampByte(
      (outputRgba[outputPixelOffset + 2] ?? 0) * (1 - weight) + (originalRgba[originalPixelOffset + 2] ?? 0) * weight,
    );
    outputRgba[outputPixelOffset + 3] = clampByte(
      Math.max(currentAlpha, currentAlpha * (1 - weight) + originalAlpha * weight),
    );
  };

  const enclosedRestoreWeight = clampUnit((105 - strength) / 70);
  const edgeRestoreWeight = clampUnit((62 - strength) / 85) * 0.55;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (!isOutputTransparent(pixelIndex)) continue;

    if (!backgroundMask[pixelIndex]) {
      restorePixel(pixelIndex, enclosedRestoreWeight);
      continue;
    }

    if (edgeRestoreWeight > 0 && hasForegroundNeighbor(pixelIndex) && hasOriginalDetailNeighbor(pixelIndex)) {
      restorePixel(pixelIndex, edgeRestoreWeight);
    }
  }

  return sharp(outputRgba, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function removeSpriteBackgroundPng(
  input: Buffer,
  cleanupStrength = 35,
  engine: SpriteCleanupEngine = "auto",
): Promise<{ buffer: Buffer; engine: UsedSpriteCleanupEngine }> {
  if (engine !== "builtin") {
    const aiOutput = await tryRemoveBackgroundWithBackgroundRemover(input, {
      required: engine === "backgroundremover",
    });
    if (aiOutput) {
      return {
        buffer: await softenBackgroundRemoverMask(input, aiOutput, cleanupStrength),
        engine: "backgroundremover",
      };
    }
  }

  return { buffer: await removeNearWhiteBackgroundPng(input, cleanupStrength), engine: "builtin" };
}

function looksLikeBase64(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 32) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
}

function extractBase64ImageData(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) return "";
    return trimmed.slice(comma + 1);
  }

  return trimmed;
}

function normalizeLocalImagePath(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (value.startsWith("/")) return value.split("?")[0] ?? value;
  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value.split("?")[0] ?? value;
  }
}

function readSafeNestedFile(root: string, pathSegments: string[]): string | undefined {
  if (pathSegments.length === 0) return undefined;
  const decoded = pathSegments.map((segment) => decodeURIComponent(segment));
  if (
    decoded.some((segment) => !segment || segment.includes("..") || segment.includes("/") || segment.includes("\\"))
  ) {
    return undefined;
  }
  const diskPath = resolve(root, ...decoded);
  const normalizedRoot = resolve(root);
  const relativePath = relative(normalizedRoot, diskPath);
  if (relativePath.startsWith("..") || relativePath === "" || isAbsolute(relativePath)) return undefined;
  try {
    if (!existsSync(diskPath)) return undefined;
    return readFileSync(diskPath).toString("base64");
  } catch {
    return undefined;
  }
}

/** Accepts data URL, raw base64, or local avatar/sprite URL and returns base64 if resolvable. */
function resolveReferenceImageBase64(input?: string): string | undefined {
  if (!input?.trim()) return undefined;
  const value = input.trim();

  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma < 0) return undefined;
    const b64 = value.slice(comma + 1);
    return looksLikeBase64(b64) ? b64 : undefined;
  }

  const path = normalizeLocalImagePath(value);
  if (path.startsWith("/api/avatars/file/")) {
    const filenameRaw = path.split("/").pop();
    if (!filenameRaw) return undefined;
    const filename = decodeURIComponent(filenameRaw);
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return undefined;
    try {
      const diskPath = join(DATA_DIR, "avatars", filename);
      if (!existsSync(diskPath)) return undefined;
      return readFileSync(diskPath).toString("base64");
    } catch {
      return undefined;
    }
  }

  if (path.startsWith("/api/avatars/npc/")) {
    const parts = path.split("/").filter(Boolean);
    const chatId = parts[3] ? decodeURIComponent(parts[3]) : "";
    const filename = parts[4] ? decodeURIComponent(parts[4]) : "";
    if (!chatId || !filename) return undefined;
    if (
      chatId.includes("..") ||
      chatId.includes("/") ||
      chatId.includes("\\") ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return undefined;
    }
    try {
      const diskPath = join(DATA_DIR, "avatars", "npc", chatId, filename);
      if (!existsSync(diskPath)) return undefined;
      return readFileSync(diskPath).toString("base64");
    } catch {
      return undefined;
    }
  }

  if (path.startsWith("/sprites/")) {
    const segments = path.split("/").filter(Boolean).slice(1);
    return (
      readSafeNestedFile(join(CLIENT_PUBLIC_DIR, "sprites"), segments) ??
      readSafeNestedFile(join(CLIENT_DIST_DIR, "sprites"), segments)
    );
  }

  if (path.startsWith("/api/sprites/")) {
    const parts = path.split("/").filter(Boolean);
    const characterId = parts[2] ? decodeURIComponent(parts[2]) : "";
    const filename = parts[4] ? decodeURIComponent(parts[4]) : "";
    if (!characterId || !filename) return undefined;
    return readSafeNestedFile(SPRITES_ROOT, [characterId, filename]);
  }

  if (looksLikeBase64(value)) return value;
  return undefined;
}

async function resolveVideoReferenceImage(input?: string): Promise<VideoReferenceImage | null> {
  const base64 = resolveReferenceImageBase64(input);
  if (!base64) return null;
  const buffer = Buffer.from(extractBase64ImageData(base64), "base64");
  const info = isAllowedImageBuffer(buffer);
  if (info?.mimeType === "image/png" || info?.mimeType === "image/jpeg") {
    return { base64: buffer.toString("base64"), mimeType: info.mimeType };
  }
  if (info) {
    const sharp = await getSharp();
    const png = await sharp(buffer, { limitInputPixels: false }).png().toBuffer();
    return { base64: png.toString("base64"), mimeType: "image/png" };
  }
  return null;
}

function readSpritePromptOverrides(raw: unknown): Map<string, SpriteCompiledPrompt> {
  return new Map(
    (Array.isArray(raw) ? raw : []).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const override = item as Record<string, unknown>;
      if (typeof override.id !== "string" || typeof override.prompt !== "string") return [];
      return [
        [
          override.id,
          {
            prompt: override.prompt.trim(),
            negativePrompt: typeof override.negativePrompt === "string" ? override.negativePrompt.trim() : "",
          },
        ] as const,
      ];
    }),
  );
}

function buildAnimatedExpressionList(body: SpriteGenerateAnimatedBody): string[] {
  const seen = new Set<string>();
  return (body.expressions ?? [])
    .slice(0, MAX_ANIMATED_SPRITE_EXPRESSIONS)
    .map((expression) => normalizeSpriteExpression(String(expression)))
    .filter((expression) => {
      if (!expression || seen.has(expression)) return false;
      seen.add(expression);
      return true;
    });
}

function withVideoNegativePrompt(prompt: SpriteCompiledPrompt): string {
  return prompt.negativePrompt ? `${prompt.prompt}\n\nAvoid: ${prompt.negativePrompt}` : prompt.prompt;
}

async function buildAnimatedExpressionPrompt(input: {
  promptOverridesStorage: ReturnType<typeof createPromptOverridesStorage>;
  promptOverrides: Map<string, SpriteCompiledPrompt>;
  appearance: string;
  expression: string;
  durationSeconds: number;
  noBackground: boolean;
}) {
  const prompt = await loadPrompt(input.promptOverridesStorage, SPRITES_ANIMATED_PORTRAIT, {
    appearance: input.appearance,
    expression: input.expression,
    durationSeconds: input.durationSeconds,
    aspectRatio: ANIMATED_EXPRESSION_ASPECT_RATIO,
    backgroundInstruction: input.noBackground
      ? "Use a flat clean white or transparent-looking background with no scenery, shadows, gradients, floor line, or texture behind the character."
      : "Use a simple clean portrait background that does not distract from the character.",
  });
  const override = input.promptOverrides.get(animatedSpritePromptReviewId(input.expression));
  return resolveSpritePromptOverride(
    override,
    {
      prompt,
      negativePrompt:
        "text, captions, subtitles, speech bubbles, UI, watermark, logo, extra people, multiple faces, split panel, collage, scene cut, camera shake, identity drift, changed outfit",
    },
  ).value;
}

async function buildSpritePromptPlan(
  app: FastifyInstance,
  body: SpriteGenerateSheetBody,
  imgModel: string,
): Promise<SpritePromptPlan> {
  const cols = coerceSpriteGridDimension(body.cols, 2);
  const rows = coerceSpriteGridDimension(body.rows, 3);
  const fullBodyExpressionMode = body.spriteType === "full-body" && body.fullBodyExpressionMode === true;
  let expressions = (body.expressions ?? []).slice(0, cols * rows);

  const singlePortrait = body.spriteType !== "full-body" && expressions.length === 1 && cols === 1 && rows === 1;
  const singleFullBody = body.spriteType === "full-body" && expressions.length === 1 && cols === 1 && rows === 1;
  const generateExpressionsIndividually =
    body.spriteType !== "full-body" &&
    !singlePortrait &&
    isOpenAIGptImageModel(imgModel) &&
    !isOpenAIGptImage2Model(imgModel);
  if (generateExpressionsIndividually && expressions.length > MAX_INDIVIDUAL_SPRITE_EXPRESSIONS) {
    expressions = expressions.slice(0, MAX_INDIVIDUAL_SPRITE_EXPRESSIONS);
  }
  const expressionList = expressions.join(", ");
  const promptOverridesStorage = createPromptOverridesStorage(app.db);
  const trimmedAppearance = body.appearance?.trim() || "";
  const nativeTransparentPng = body.nativeTransparentPng === true;
  const cleanupFriendlyTransparentPrompt = nativeTransparentPng && shouldUseCleanupFriendlyTransparentPrompt(imgModel);
  const { sheetWidth, sheetHeight, cellWidth, cellHeight } = resolveSpriteSheetCanvas({
    cols,
    rows,
    spriteType: body.spriteType,
    model: imgModel,
  });

  let prompt = "";
  if (fullBodyExpressionMode) {
    prompt = buildFullBodyExpressionSheetPrompt({
      cols,
      rows,
      expressions,
      appearance: trimmedAppearance,
      sheetWidth,
      sheetHeight,
      cellWidth,
      cellHeight,
    });
  } else if (singleFullBody) {
    prompt = await loadPrompt(promptOverridesStorage, SPRITES_SINGLE_FULL_BODY, {
      appearance: trimmedAppearance,
      pose: expressions[0] ?? "idle",
    });
  } else if (body.spriteType === "full-body") {
    prompt = await loadPrompt(promptOverridesStorage, SPRITES_FULL_BODY_SHEET, {
      cols,
      rows,
      cellCount: cols * rows,
      poseCount: expressions.length,
      poseList: expressionList,
      appearance: trimmedAppearance,
      sheetWidth,
      sheetHeight,
      cellWidth,
      cellHeight,
    });
  } else if (singlePortrait) {
    prompt = await loadPrompt(promptOverridesStorage, SPRITES_SINGLE_PORTRAIT, {
      appearance: trimmedAppearance,
      expression: expressions[0] ?? "neutral",
    });
  } else {
    prompt = await loadPrompt(promptOverridesStorage, SPRITES_EXPRESSION_SHEET, {
      cols,
      rows,
      expressionCount: expressions.length,
      expressionList,
      appearance: trimmedAppearance,
      sheetWidth,
      sheetHeight,
      cellWidth,
      cellHeight,
    });
  }
  if (nativeTransparentPng) {
    prompt = applyNativeTransparentPngPrompt(prompt, cleanupFriendlyTransparentPrompt);
  }

  return {
    expressions,
    cols,
    rows,
    spriteType: body.spriteType,
    fullBodyExpressionMode,
    generateExpressionsIndividually,
    appearance: trimmedAppearance,
    prompt,
    sheetWidth,
    sheetHeight,
    cellWidth,
    cellHeight,
    promptOverrides: readSpritePromptOverrides(body.promptOverrides),
    promptOverridesStorage,
  };
}

export async function spritesRoutes(app: FastifyInstance) {
  app.get("/capabilities", async () => ({
    ...(await getSpriteCapabilities()),
    backgroundRemover: getBackgroundRemoverStatus(),
  }));

  app.get("/cleanup/status", async () => ({
    backgroundRemover: getBackgroundRemoverStatus(),
  }));

  /**
   * GET /api/sprites/:characterId
   * List all sprite expressions for a character.
   */
  app.get<{ Params: { characterId: string } }>("/:characterId", async (req, reply) => {
    const { characterId } = req.params;
    return listSpriteInfos(characterId);
  });

  /**
   * POST /api/sprites/:characterId/export
   * Export selected sprite expressions as one zip with a folder inside.
   * Body: { expressions?: string[], folderName?: string }
   */
  app.post<{ Params: { characterId: string } }>("/:characterId/export", async (req, reply) => {
    const { characterId } = req.params;

    if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }

    const dir = join(SPRITES_ROOT, characterId);
    if (!existsSync(dir)) {
      return reply.status(404).send({ error: "No sprites found" });
    }

    const body = req.body as { expressions?: unknown; folderName?: unknown };
    const requestedExpressions =
      Array.isArray(body.expressions) && body.expressions.length > 0
        ? new Set(body.expressions.map((expr) => normalizeSpriteExpression(String(expr))).filter(Boolean))
        : null;
    const files = readdirSync(dir).filter((filename) => SPRITE_FILE_RE.test(filename));
    const targets = files.filter((filename) => {
      const expression = filename.slice(0, -extname(filename).length);
      return !requestedExpressions || requestedExpressions.has(normalizeSpriteExpression(expression));
    });

    if (targets.length === 0) {
      return reply.status(404).send({ error: "No matching sprites found" });
    }

    const folderName = sanitizeSpriteExportName(body.folderName, `sprites-${characterId}`);
    const zip = new AdmZip();
    for (const filename of targets) {
      zip.addFile(`${folderName}/${filename}`, readFileSync(join(dir, filename)));
    }

    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${folderName}.zip"`)
      .send(zip.toBuffer());
  });

  /**
   * POST /api/sprites/:characterId
   * Upload a sprite image for a given expression.
   * Body: { expression: string, image: string (base64 data URL) }
   */
  app.post<{ Params: { characterId: string } }>("/:characterId", async (req, reply) => {
    const { characterId } = req.params;

    // Prevent path traversal
    if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }

    const body = req.body as { expression?: string; image?: string };

    if (!body.expression?.trim()) {
      return reply.status(400).send({ error: "Expression label is required" });
    }
    if (!body.image) {
      return reply.status(400).send({ error: "No image data provided" });
    }

    const expression = normalizeSpriteExpression(body.expression);
    if (!expression) {
      return reply.status(400).send({ error: "Expression label must include at least one letter or number" });
    }

    // Parse base64
    let base64 = body.image;
    let ext = "png";
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:image\/([\w+]+);base64,/);
      if (match?.[1]) {
        ext = match[1].replace("+xml", "");
        base64 = base64.slice(base64.indexOf(",") + 1);
      }
    }

    const dir = join(SPRITES_ROOT, characterId);
    await mkdir(dir, { recursive: true });

    const filename = `${expression}.${ext}`;
    const filepath = join(dir, filename);
    await writeFile(filepath, Buffer.from(base64, "base64"));

    const mtime = statSync(filepath).mtimeMs;
    return {
      expression,
      filename,
      url: `/api/sprites/${characterId}/file/${encodeURIComponent(filename)}?v=${Math.floor(mtime)}`,
    };
  });

  /**
   * POST /api/sprites/:characterId/cleanup-saved
   * Run background cleanup on already-saved sprite files and overwrite them as PNGs.
   * Body: { expressions?: string[], cleanupStrength?: number, engine?: "auto" | "backgroundremover" | "builtin" }
   */
  app.post<{ Params: { characterId: string } }>("/:characterId/cleanup-saved", async (req, reply) => {
    const { characterId } = req.params;

    if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }

    const dir = join(SPRITES_ROOT, characterId);
    if (!existsSync(dir)) {
      return reply.status(404).send({ error: "No sprites found" });
    }

    const body = req.body as { expressions?: string[]; cleanupStrength?: number; engine?: SpriteCleanupEngine };
    const requestedExpressions =
      Array.isArray(body.expressions) && body.expressions.length > 0
        ? new Set(body.expressions.map((expr) => normalizeSpriteExpression(String(expr))).filter(Boolean))
        : null;
    const cleanupStrength = Number.isFinite(body.cleanupStrength) ? Number(body.cleanupStrength) : 35;
    const cleanupEngine = normalizeSpriteCleanupEngine(body.engine);

    const files = readdirSync(dir).filter((filename) => SPRITE_FILE_RE.test(filename));
    const targets = files.filter((filename) => {
      const expression = filename.slice(0, -extname(filename).length);
      return !requestedExpressions || requestedExpressions.has(normalizeSpriteExpression(expression));
    });

    if (targets.length === 0) {
      return reply.status(404).send({ error: "No matching sprites found" });
    }

    const backupId = `${Date.now()}-${randomUUID()}`;
    const backupDir = join(dir, ".cleanup-backups", backupId);
    const manifest: SpriteCleanupBackupManifest = {
      id: backupId,
      createdAt: new Date().toISOString(),
      entries: [],
    };
    const failed: Array<{ expression: string; error: string }> = [];
    const engineCounts: Record<UsedSpriteCleanupEngine, number> = {
      backgroundremover: 0,
      builtin: 0,
    };
    let processed = 0;

    for (const filename of targets) {
      const expression = filename.slice(0, -extname(filename).length);
      const inputPath = join(dir, filename);

      try {
        if (!CLEANUP_INPUT_FILE_RE.test(filename)) {
          throw new Error("Only PNG, JPEG, WEBP, and AVIF sprites can be background-cleaned");
        }

        const output = await removeSpriteBackgroundPng(readFileSync(inputPath), cleanupStrength, cleanupEngine);
        const outputFilename = `${expression}.png`;
        const outputPath = join(dir, outputFilename);
        await mkdir(backupDir, { recursive: true });
        await copyFile(inputPath, join(backupDir, filename));
        manifest.entries.push({
          expression,
          originalFilename: filename,
          cleanedFilename: outputFilename,
          backupFilename: filename,
        });
        await writeFile(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
        await writeFile(outputPath, output.buffer);

        if (filename !== outputFilename) {
          try {
            unlinkSync(inputPath);
          } catch (unlinkErr) {
            logger.warn(unlinkErr, "Failed to remove original sprite after cleanup");
          }
        }

        engineCounts[output.engine] += 1;
        processed += 1;
      } catch (err) {
        logger.warn(err, 'Saved sprite "%s" background cleanup failed', expression);
        failed.push({
          expression,
          error: err instanceof Error ? err.message : "Cleanup failed",
        });
      }
    }

    if (manifest.entries.length === 0) {
      await rm(backupDir, { recursive: true, force: true });
    }

    const payload = {
      processed,
      failed,
      backupId: manifest.entries.length > 0 ? backupId : null,
      engine: cleanupEngine,
      backgroundRemoverProcessed: engineCounts.backgroundremover,
      builtinProcessed: engineCounts.builtin,
      sprites: listSpriteInfos(characterId),
    };

    if (processed === 0 && failed.length > 0) {
      return reply.status(500).send({ ...payload, error: "No saved sprites were cleaned" });
    }

    return payload;
  });

  /**
   * POST /api/sprites/:characterId/cleanup-restore
   * Restore the previous saved sprite files from a cleanup backup.
   * Body: { backupId: string }
   */
  app.post<{ Params: { characterId: string } }>("/:characterId/cleanup-restore", async (req, reply) => {
    const { characterId } = req.params;

    if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }

    const body = req.body as { backupId?: string };
    if (!isSafeBackupId(body.backupId)) {
      return reply.status(400).send({ error: "Invalid backup ID" });
    }

    const dir = join(SPRITES_ROOT, characterId);
    const backupDir = join(dir, ".cleanup-backups", body.backupId);
    const manifestPath = join(backupDir, "manifest.json");

    if (!existsSync(manifestPath)) {
      return reply.status(404).send({ error: "Cleanup backup was not found" });
    }

    let manifest: SpriteCleanupBackupManifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SpriteCleanupBackupManifest;
    } catch {
      return reply.status(500).send({ error: "Cleanup backup manifest is unreadable" });
    }

    let restored = 0;
    const failed: Array<{ expression: string; error: string }> = [];

    for (const entry of manifest.entries) {
      try {
        if (
          !entry.backupFilename ||
          !entry.originalFilename ||
          entry.backupFilename.includes("..") ||
          entry.originalFilename.includes("..") ||
          entry.cleanedFilename.includes("..") ||
          entry.backupFilename.includes("/") ||
          entry.originalFilename.includes("/") ||
          entry.cleanedFilename.includes("/") ||
          entry.backupFilename.includes("\\") ||
          entry.originalFilename.includes("\\") ||
          entry.cleanedFilename.includes("\\")
        ) {
          throw new Error("Backup entry has an invalid filename");
        }

        await copyFile(join(backupDir, entry.backupFilename), join(dir, entry.originalFilename));
        if (entry.cleanedFilename !== entry.originalFilename) {
          await unlink(join(dir, entry.cleanedFilename)).catch(() => undefined);
        }
        restored += 1;
      } catch (err) {
        logger.warn(err, 'Saved sprite "%s" cleanup restore failed', entry.expression);
        failed.push({
          expression: entry.expression,
          error: err instanceof Error ? err.message : "Restore failed",
        });
      }
    }

    if (restored > 0 && failed.length === 0) {
      await rm(backupDir, { recursive: true, force: true });
    }

    const payload = {
      restored,
      failed,
      sprites: listSpriteInfos(characterId),
    };

    if (restored === 0 && failed.length > 0) {
      return reply.status(500).send({ ...payload, error: "No saved sprites were restored" });
    }

    return payload;
  });

  /**
   * DELETE /api/sprites/:characterId/:expression
   * Remove a sprite expression image.
   */
  app.delete<{ Params: { characterId: string; expression: string } }>(
    "/:characterId/:expression",
    async (req, reply) => {
      const { characterId, expression } = req.params;

      // Prevent path traversal
      if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
        return reply.status(400).send({ error: "Invalid character ID" });
      }

      const dir = join(SPRITES_ROOT, characterId);

      if (!existsSync(dir)) {
        return reply.status(404).send({ error: "No sprites found" });
      }

      const files = readdirSync(dir);
      const match = files.find((f) => {
        const ext = extname(f);
        return f.slice(0, -ext.length) === expression;
      });

      if (!match) {
        return reply.status(404).send({ error: "Expression not found" });
      }

      unlinkSync(join(dir, match));
      return reply.status(204).send();
    },
  );

  /**
   * GET /api/sprites/:characterId/file/:filename
   * Serve a sprite image file.
   */
  app.get<{ Params: { characterId: string; filename: string } }>("/:characterId/file/:filename", async (req, reply) => {
    const { characterId, filename } = req.params;

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/") || characterId.includes("..")) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const filePath = join(SPRITES_ROOT, characterId, filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const ext = extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
      ".svg": "image/svg+xml",
    };

    const stream = createReadStream(filePath);
    return reply
      .header("Content-Type", mimeMap[ext] ?? "application/octet-stream")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(stream);
  });

  /**
   * POST /api/sprites/generate-sheet/preview
   * Build the exact sprite image prompt(s) before provider requests are sent.
   */
  app.post("/generate-sheet/preview", async (req, reply) => {
    const body = req.body as SpriteGenerateSheetBody;

    if (!body.connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    if (!body.appearance?.trim()) {
      return reply.status(400).send({ error: "appearance description is required" });
    }
    if (!body.expressions || body.expressions.length === 0) {
      return reply.status(400).send({ error: "At least one expression is required" });
    }
    if (isInvalidSpriteGridDimension(body.cols) || isInvalidSpriteGridDimension(body.rows)) {
      return reply.status(400).send({ error: "cols and rows must be positive integers (max 8)" });
    }

    const connections = createConnectionsStorage(app.db);
    const conn = await connections.getWithKey(body.connectionId);
    if (!conn) {
      return reply.status(404).send({ error: "Image generation connection not found or could not be decrypted" });
    }

    const imgModel = conn.model || "";
    const imageDefaults = resolveConnectionImageDefaults(conn);
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const plan = await buildSpritePromptPlan(app, body, imgModel);
    if (plan.expressions.length === 0) {
      return reply.status(400).send({ error: "No expressions remain after applying the requested grid size" });
    }

    if (plan.generateExpressionsIndividually) {
      const nativeTransparentPng = body.nativeTransparentPng === true;
      const cleanupFriendlyTransparentPrompt =
        nativeTransparentPng && shouldUseCleanupFriendlyTransparentPrompt(imgModel);
      const items = await Promise.all(
        plan.expressions.map(async (expression) => {
          let expressionPrompt = await loadPrompt(plan.promptOverridesStorage, SPRITES_SINGLE_PORTRAIT, {
            appearance: body.appearance?.trim() || "",
            expression,
          });
          if (nativeTransparentPng) {
            expressionPrompt = applyNativeTransparentPngPrompt(expressionPrompt, cleanupFriendlyTransparentPrompt);
          }
          const compiledPrompt = compileSpritePrompt(expressionPrompt, {
            appearance: plan.appearance,
            styleProfiles: imageSettings.styleProfiles,
            imageDefaults,
          });
          const reviewedPrompt = resolveSpritePromptOverride(
            plan.promptOverrides.get(spritePromptReviewId("expression", plan.spriteType, expression)),
            compiledPrompt,
          );
          return {
            id: spritePromptReviewId("expression", plan.spriteType, expression),
            kind: "sprite",
            title: `Expression: ${expression.replace(/_/g, " ")}`,
            prompt: reviewedPrompt.value.prompt,
            negativePrompt: reviewedPrompt.value.negativePrompt,
            width: 1024,
            height: 1024,
          };
        }),
      );
      return { items };
    }

    const compiledPrompt = compileSpritePrompt(plan.prompt, {
      appearance: plan.appearance,
      styleProfiles: imageSettings.styleProfiles,
      imageDefaults,
    });
    const sheetPromptId = spritePromptReviewId(
      "sheet",
      plan.spriteType,
      `${plan.cols}x${plan.rows}-${plan.expressions.join(",")}`,
    );
    const reviewedPrompt = resolveSpritePromptOverride(plan.promptOverrides.get(sheetPromptId), compiledPrompt);
    const finalPrompt = withSpriteSheetLayoutContract(reviewedPrompt.value, plan, {
      reviewedOverride: reviewedPrompt.overridden,
    });
    return {
      items: [
        {
          id: sheetPromptId,
          kind: "sprite",
          title:
            plan.spriteType === "full-body"
              ? `Full-body sprites: ${plan.cols}x${plan.rows}`
              : `Expression sprites: ${plan.cols}x${plan.rows}`,
          prompt: finalPrompt.prompt,
          negativePrompt: finalPrompt.negativePrompt,
          width: plan.sheetWidth,
          height: plan.sheetHeight,
        },
      ],
    };
  });

  /**
   * POST /api/sprites/generate-animated-expressions/preview
   * Build the exact animated portrait video prompt(s) before provider requests are sent.
   */
  app.post("/generate-animated-expressions/preview", async (req, reply) => {
    const body = req.body as SpriteGenerateAnimatedBody;

    if (!body.connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    if (!body.appearance?.trim()) {
      return reply.status(400).send({ error: "appearance description is required" });
    }
    const expressions = buildAnimatedExpressionList(body);
    if (expressions.length === 0) {
      return reply.status(400).send({ error: "At least one expression is required" });
    }

    const connections = createConnectionsStorage(app.db);
    const conn = await connections.getWithKey(body.connectionId);
    if (!conn) {
      return reply.status(404).send({ error: "Video generation connection not found or could not be decrypted" });
    }
    if ((conn as Record<string, unknown>).provider !== "video_generation") {
      return reply.status(400).send({ error: "Selected connection is not a Video Generation connection" });
    }

    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    const durationSeconds = clampVideoDuration(
      body.durationSeconds,
      videoSettings.animatedExpressionClipDurationSeconds,
      VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN,
      VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX,
    );
    const promptOverridesStorage = createPromptOverridesStorage(app.db);
    const promptOverrides = readSpritePromptOverrides(body.promptOverrides);
    const appearance = body.appearance.trim();
    const items = await Promise.all(
      expressions.map(async (expression) => {
        const prompt = await buildAnimatedExpressionPrompt({
          promptOverridesStorage,
          promptOverrides,
          appearance,
          expression,
          durationSeconds,
          noBackground: body.noBackground === true || body.nativeTransparentPng === true,
        });
        return {
          id: animatedSpritePromptReviewId(expression),
          kind: "sprite",
          title: `Animated expression: ${expression.replace(/_/g, " ")}`,
          prompt: prompt.prompt,
          negativePrompt: prompt.negativePrompt,
          width: ANIMATED_EXPRESSION_GIF_WIDTH,
          height: Math.round((ANIMATED_EXPRESSION_GIF_WIDTH * 16) / 9),
        };
      }),
    );
    return { items };
  });

  /**
   * POST /api/sprites/generate-animated-expressions
   * Generate short expression videos, convert them to GIF sprites, and return them as sprite cells.
   */
  app.post("/generate-animated-expressions", async (req, reply) => {
    const body = req.body as SpriteGenerateAnimatedBody;

    if (!body.connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    if (!body.appearance?.trim()) {
      return reply.status(400).send({ error: "appearance description is required" });
    }
    const expressions = buildAnimatedExpressionList(body);
    if (expressions.length === 0) {
      return reply.status(400).send({ error: "At least one expression is required" });
    }

    const connections = createConnectionsStorage(app.db);
    const conn = await connections.getWithKey(body.connectionId);
    if (!conn) {
      return reply.status(404).send({ error: "Video generation connection not found or could not be decrypted" });
    }
    if ((conn as Record<string, unknown>).provider !== "video_generation") {
      return reply.status(400).send({ error: "Selected connection is not a Video Generation connection" });
    }
    try {
      resolveFfmpegCommand();
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || "Animated expression GIF conversion is unavailable" });
    }

    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    const durationSeconds = clampVideoDuration(
      body.durationSeconds,
      videoSettings.animatedExpressionClipDurationSeconds,
      VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MIN,
      VIDEO_ANIMATED_EXPRESSION_CLIP_DURATION_MAX,
    );
    const promptOverridesStorage = createPromptOverridesStorage(app.db);
    const promptOverrides = readSpritePromptOverrides(body.promptOverrides);
    const appearance = body.appearance.trim();
    const rawRefs = body.referenceImages?.length
      ? body.referenceImages
      : body.referenceImage
        ? [body.referenceImage]
        : [];
    let referenceImage: VideoReferenceImage | null = null;
    for (const ref of rawRefs) {
      referenceImage = await resolveVideoReferenceImage(ref);
      if (referenceImage) break;
    }
    const resolved = resolveVideoConnection(conn as unknown as VideoGenerationConnection);

    try {
      return await withSpriteGenerationDeadline(
        (async () => {
          const cells: Array<{ expression: string; base64: string; mimeType: "image/gif" }> = [];
          const failedExpressions: Array<{ expression: string; error: string }> = [];

          for (const expression of expressions) {
            try {
              const prompt = await buildAnimatedExpressionPrompt({
                promptOverridesStorage,
                promptOverrides,
                appearance,
                expression,
                durationSeconds,
                noBackground: body.noBackground === true || body.nativeTransparentPng === true,
              });
              const video = await generateVideo(
                resolved.source,
                resolved.baseUrl,
                (conn as VideoGenerationConnection).apiKey || "",
                resolved.serviceHint,
                {
                  prompt: withVideoNegativePrompt(prompt),
                  model: resolved.model,
                  durationSeconds,
                  aspectRatio: ANIMATED_EXPRESSION_ASPECT_RATIO,
                  resolution: resolved.resolution,
                  referenceImage,
                },
              );
              const gif = await convertMp4ToGif(Buffer.from(video.base64, "base64"));
              cells.push({
                expression,
                base64: gif.toString("base64"),
                mimeType: "image/gif",
              });
            } catch (expressionErr: any) {
              const msg = String(expressionErr?.message || "Generation failed")
                .replace(/<[^>]*>/g, "")
                .slice(0, 300);
              logger.warn(expressionErr, 'Animated expression "%s" generation failed; skipping', expression);
              failedExpressions.push({ expression, error: msg });
            }
          }

          if (cells.length === 0) {
            const allFailedError = new Error("All animated expression generations failed");
            (allFailedError as Error & { failedExpressions?: typeof failedExpressions }).failedExpressions =
              failedExpressions;
            throw allFailedError;
          }

          return {
            sheetBase64: "",
            cells,
            ...(failedExpressions.length > 0 ? { failedExpressions } : {}),
          };
        })(),
      );
    } catch (err: any) {
      logger.error(err, "Animated expression generation failed");
      const failedExpressions = Array.isArray(err?.failedExpressions)
        ? { failedExpressions: err.failedExpressions }
        : {};
      return reply.status(err instanceof SpriteGenerationTimeoutError ? 504 : 500).send({
        error: err?.message || "Animated expression generation failed",
        ...failedExpressions,
      });
    }
  });

  /**
   * POST /api/sprites/generate-sheet
   * Generate a sprite sheet via image generation, then slice it into individual cells.
   * Body: { connectionId, appearance, referenceImages?, expressions: string[], cols, rows }
   * Returns: { sheetBase64, cells: [{ expression, base64 }] }
   */
  app.post("/generate-sheet", async (req, reply) => {
    const body = req.body as SpriteGenerateSheetBody;

    if (!body.connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    if (!body.appearance?.trim()) {
      return reply.status(400).send({ error: "appearance description is required" });
    }
    if (!body.expressions || body.expressions.length === 0) {
      return reply.status(400).send({ error: "At least one expression is required" });
    }
    if (isInvalidSpriteGridDimension(body.cols) || isInvalidSpriteGridDimension(body.rows)) {
      return reply.status(400).send({ error: "cols and rows must be positive integers (max 8)" });
    }

    const cleanupStrength = Number.isFinite(body.cleanupStrength) ? Number(body.cleanupStrength) : 35;

    // Resolve image generation connection
    const connections = createConnectionsStorage(app.db);
    const conn = await connections.getWithKey(body.connectionId);
    if (!conn) {
      return reply.status(404).send({ error: "Image generation connection not found or could not be decrypted" });
    }

    const imgModel = conn.model || "";
    const imgBaseUrl = conn.baseUrl || "https://image.pollinations.ai";
    const imgApiKey = conn.apiKey || "";
    const imgSource = (conn as any).imageGenerationSource || imgModel;
    const imgServiceHint = conn.imageService || imgSource;
    const imageDefaults = resolveConnectionImageDefaults(conn);
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const nativeTransparentPng = body.nativeTransparentPng === true;
    const cleanupFriendlyTransparentPrompt =
      nativeTransparentPng && shouldUseCleanupFriendlyTransparentPrompt(imgModel);
    const plan = await buildSpritePromptPlan(app, body, imgModel);
    if (plan.expressions.length === 0) {
      return reply.status(400).send({ error: "No expressions remain after applying the requested grid size" });
    }
    const sheetPromptId = spritePromptReviewId(
      "sheet",
      plan.spriteType,
      `${plan.cols}x${plan.rows}-${plan.expressions.join(",")}`,
    );
    const compiledSheetPrompt = compileSpritePrompt(plan.prompt, {
      appearance: plan.appearance,
      styleProfiles: imageSettings.styleProfiles,
      imageDefaults,
    });
    const reviewedSheetPrompt = resolveSpritePromptOverride(
      plan.promptOverrides.get(sheetPromptId),
      compiledSheetPrompt,
    );
    const sheetPrompt = withSpriteSheetLayoutContract(reviewedSheetPrompt.value, plan, {
      reviewedOverride: reviewedSheetPrompt.overridden,
    });

    // Parse reference images to raw base64 (supports data URL, raw base64, or local avatar URL)
    const rawRefs = body.referenceImages?.length
      ? body.referenceImages
      : body.referenceImage
        ? [body.referenceImage]
        : [];
    const resolvedRefs = rawRefs.map(resolveReferenceImageBase64).filter((r): r is string => !!r);

    try {
      return await withSpriteGenerationDeadline(
        (async () => {
          if (plan.generateExpressionsIndividually) {
            const cells: Array<{ expression: string; base64: string }> = [];
            const failedExpressions: Array<{ expression: string; error: string }> = [];

            for (const expression of plan.expressions) {
              try {
                let expressionPrompt = await loadPrompt(plan.promptOverridesStorage, SPRITES_SINGLE_PORTRAIT, {
                  appearance: body.appearance?.trim() || "",
                  expression,
                });
                if (nativeTransparentPng) {
                  expressionPrompt = applyNativeTransparentPngPrompt(
                    expressionPrompt,
                    cleanupFriendlyTransparentPrompt,
                  );
                }
                const compiledExpressionPrompt = compileSpritePrompt(expressionPrompt, {
                  appearance: plan.appearance,
                  styleProfiles: imageSettings.styleProfiles,
                  imageDefaults,
                });
                const finalExpressionPrompt = resolveSpritePromptOverride(
                  plan.promptOverrides.get(spritePromptReviewId("expression", plan.spriteType, expression)),
                  compiledExpressionPrompt,
                );

                const targetSize = 1024;
                const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                  prompt: finalExpressionPrompt.value.prompt,
                  negativePrompt: finalExpressionPrompt.value.negativePrompt || undefined,
                  model: imgModel,
                  width: targetSize,
                  height: targetSize,
                  referenceImage: resolvedRefs[0],
                  referenceImages: resolvedRefs.length > 1 ? resolvedRefs : undefined,
                  transparentBackground: nativeTransparentPng,
                  imageEndpointId: conn.imageEndpointId || undefined,
                  comfyWorkflow: conn.comfyuiWorkflow || undefined,
                  imageDefaults,
                });

                let spriteBuffer: Buffer = Buffer.from(imageResult.base64, "base64");
                const sharp = await getSharp();
                const meta = await sharp(spriteBuffer).metadata();
                if (meta.width && meta.height && (meta.width !== targetSize || meta.height !== targetSize)) {
                  spriteBuffer = await sharp(spriteBuffer)
                    .resize(targetSize, targetSize, {
                      fit: "contain",
                      background: nativeTransparentPng ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255 },
                    })
                    .png()
                    .toBuffer();
                }

                if (body.noBackground) {
                  try {
                    spriteBuffer = (await removeSpriteBackgroundPng(spriteBuffer, cleanupStrength)).buffer;
                  } catch (bgErr) {
                    logger.warn(bgErr, "Expression sprite background cleanup failed; continuing with original image");
                  }
                }

                cells.push({
                  expression,
                  base64: spriteBuffer.toString("base64"),
                });
              } catch (expressionErr: any) {
                const msg = String(expressionErr?.message || "Generation failed")
                  .replace(/<[^>]*>/g, "")
                  .slice(0, 300);
                logger.warn(expressionErr, 'Expression sprite "%s" generation failed; skipping', expression);
                failedExpressions.push({ expression, error: msg });
              }
            }

            if (cells.length === 0) {
              const allFailedError = new Error("All expression generations failed");
              (allFailedError as Error & { failedExpressions?: typeof failedExpressions }).failedExpressions =
                failedExpressions;
              throw allFailedError;
            }

            return {
              sheetBase64: "",
              cells,
              ...(failedExpressions.length > 0 ? { failedExpressions } : {}),
            };
          }

          const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
            prompt: sheetPrompt.prompt,
            negativePrompt: sheetPrompt.negativePrompt || undefined,
            model: imgModel,
            width: plan.sheetWidth,
            height: plan.sheetHeight,
            referenceImage: resolvedRefs[0],
            referenceImages: resolvedRefs.length > 1 ? resolvedRefs : undefined,
            transparentBackground: nativeTransparentPng,
            imageEndpointId: conn.imageEndpointId || undefined,
            comfyWorkflow: conn.comfyuiWorkflow || undefined,
            imageDefaults,
          });

          // Decode the generated image
          let sheetBuffer: Buffer = Buffer.from(imageResult.base64, "base64");
          const sharp = await getSharp();
          let metadata = await sharp(sheetBuffer).metadata();

          // If noBackground is requested, remove near-white background after generation.
          // Keep this resilient: if cleanup fails, continue with the original image rather than throwing.
          if (body.noBackground) {
            const originalSheetBuffer = sheetBuffer;
            try {
              sheetBuffer = (await removeSpriteBackgroundPng(sheetBuffer, cleanupStrength)).buffer;
              metadata = await sharp(sheetBuffer).metadata();
            } catch (bgErr) {
              logger.warn(bgErr, "Sprite background cleanup failed; continuing with original image");
              sheetBuffer = originalSheetBuffer;
              metadata = await sharp(sheetBuffer).metadata();
            }
          }

          const imgWidth = metadata.width ?? (plan.cols <= 2 ? 1024 : 1536);
          const imgHeight = metadata.height ?? (plan.rows <= 2 ? 1024 : 1536);

          const cellWidth = Math.floor(imgWidth / plan.cols);
          const cellHeight = Math.floor(imgHeight / plan.rows);

          const cellPromises: Promise<{ expression: string; base64: string }>[] = [];

          for (let row = 0; row < plan.rows; row++) {
            for (let col = 0; col < plan.cols; col++) {
              const idx = row * plan.cols + col;
              if (idx >= plan.expressions.length) break;

              const expression = plan.expressions[idx]!;
              const left = col * cellWidth;
              const top = row * cellHeight;

              cellPromises.push(
                sharp(sheetBuffer)
                  .extract({ left, top, width: cellWidth, height: cellHeight })
                  .png()
                  .toBuffer()
                  .then((buf: Buffer) => ({
                    expression,
                    base64: buf.toString("base64"),
                  })),
              );
            }
          }

          const cells = await Promise.all(cellPromises);

          return {
            sheetBase64: sheetBuffer.toString("base64"),
            cells,
          };
        })(),
      );
    } catch (err: any) {
      logger.error(err, "Sprite sheet generation failed");
      const failedExpressions = Array.isArray(err?.failedExpressions)
        ? { failedExpressions: err.failedExpressions }
        : {};
      return reply.status(err instanceof SpriteGenerationTimeoutError ? 504 : 500).send({
        error: err?.message || "Sprite sheet generation failed",
        ...failedExpressions,
      });
    }
  });

  /**
   * POST /api/sprites/cleanup
   * Apply background cleanup to already generated sprites.
   * Body: { cells: [{ expression, base64 }], cleanupStrength, engine?: "auto" | "backgroundremover" | "builtin" }
   * Returns: { cells: [{ expression, base64 }] }
   */
  app.post("/cleanup", async (req, reply) => {
    const body = req.body as {
      cells?: Array<{ expression?: string; base64?: string }>;
      cleanupStrength?: number;
      engine?: SpriteCleanupEngine;
    };

    if (!body.cells || body.cells.length === 0) {
      return reply.status(400).send({ error: "At least one cell is required" });
    }

    const cleanupStrength = Number.isFinite(body.cleanupStrength) ? Number(body.cleanupStrength) : 35;
    const cleanupEngine = normalizeSpriteCleanupEngine(body.engine);

    try {
      const engineCounts: Record<UsedSpriteCleanupEngine, number> = {
        backgroundremover: 0,
        builtin: 0,
      };
      const processed = await Promise.all(
        body.cells.map(async (cell) => {
          const base64 = extractBase64ImageData(cell.base64 ?? "");
          if (!base64 || !looksLikeBase64(base64)) {
            throw new Error(`Invalid base64 image for expression: ${cell.expression ?? "unknown"}`);
          }

          const inputBuffer = Buffer.from(base64, "base64");
          const output = await removeSpriteBackgroundPng(inputBuffer, cleanupStrength, cleanupEngine);
          engineCounts[output.engine] += 1;

          return {
            expression: cell.expression ?? "",
            base64: output.buffer.toString("base64"),
          };
        }),
      );

      return {
        cells: processed,
        engine: cleanupEngine,
        backgroundRemoverProcessed: engineCounts.backgroundremover,
        builtinProcessed: engineCounts.builtin,
      };
    } catch (err: any) {
      logger.error(err, "Sprite cleanup failed");
      return reply.status(500).send({
        error: err?.message || "Sprite cleanup failed",
      });
    }
  });
}
