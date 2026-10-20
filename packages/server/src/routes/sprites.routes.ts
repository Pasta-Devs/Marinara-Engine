// ──────────────────────────────────────────────
// Routes: Character Sprite Upload, List & Serving
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  isOpenAIGptImageModel,
  isOpenAIGptImage2Model,
  normalizeSpriteExpressionKey,
  supportsOpenAIImageCustomSize,
  type AvatarEmotion,
  type AvatarExtraFeeling,
} from "@marinara-engine/shared";
import AdmZip from "adm-zip";
import { execFile } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, readFileSync } from "fs";
import { randomUUID } from "crypto";
import { writeFile, mkdir, unlink, copyFile, rm, readFile, mkdtemp, rename } from "fs/promises";
import { tmpdir } from "os";
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { DATA_DIR } from "../utils/data-dir.js";
import { getBackgroundRemoverStatus } from "../services/image/background-remover.service.js";
import {
  applySpriteBackgroundInstruction,
  removeSpriteBackgroundPng,
  selectSpriteChromaMatte,
  spriteBackgroundContract,
  type SpriteCleanupEngine,
  type UsedSpriteCleanupEngine,
  type SpriteChromaMatte,
} from "../services/image/sprite-background.service.js";
import { pixelizeImage, PixelizeInputError } from "../services/image/pixelize.service.js";
import { getSharp } from "../services/image/sharp-runtime.js";
import type { DB } from "../db/connection.js";
import { logDebugOverride, logger } from "../lib/logger.js";
import { SPRITE_RENAME_RATE_LIMIT } from "../middleware/rate-limit.js";

const spriteRenameQueues = new Map<string, Promise<void>>();

async function withSpriteRenameLock<T>(characterId: string, operation: () => Promise<T>): Promise<T> {
  const previous = spriteRenameQueues.get(characterId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queuedTail = previous.then(() => current);
  spriteRenameQueues.set(characterId, queuedTail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (spriteRenameQueues.get(characterId) === queuedTail) spriteRenameQueues.delete(characterId);
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
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
  type ImageDefaultsConnection,
} from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../services/image/image-prompt-review.js";
import {
  resolveImageConnectionFallback,
  resolveVideoConnectionFallback,
} from "../services/generation/media-connection-fallback.js";
import {
  generateVideo,
  resolveVideoReferencePublicUploadOptions,
  type VideoReferenceImage,
} from "../services/video/video-generation.js";
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
import { assertInsideDir, isAllowedImageBuffer } from "../utils/security.js";
import { sendValidatedMediaFile, validateImageAssetFile } from "../utils/media-file-security.js";

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

type SpriteExpressionReference = {
  expression?: string;
  image?: string;
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
  neutralFullBodyReference?: string;
  expressionReferences?: SpriteExpressionReference[];
  promptOverrides?: SpritePromptOverride[];
  /** Optional style-profile override for the bake (#5095); absent keeps the
   *  active-profile resolution unchanged. */
  styleProfileId?: string | null;
  /** Faces for a 2D avatar's talking head: open eyes and a closed mouth in every face. */
  talkingHeadFaces?: boolean;
};

type SpriteGenerateAnimatedBody = Omit<
  SpriteGenerateSheetBody,
  "cols" | "rows" | "spriteType" | "fullBodyExpressionMode"
> & {
  durationSeconds?: number;
};

type VideoGenerationConnection = {
  id: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  comfyuiWorkflow?: string | null;
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
  matte: SpriteChromaMatte;
  nativeTransparentPng: boolean;
  backgroundContract: string;
  talkingHeadFaces: boolean;
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

export function resolveSpriteNativeTransparency(model: string | undefined, requested: boolean): boolean {
  return requested && !isOpenAIGptImage2Model(model);
}

export function resolveSpriteSheetCanvas({
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
  const singleFullBody = spriteType === "full-body" && cols === 1 && rows === 1;
  const preferredCellWidth = singleFullBody ? 1024 : 512;
  const preferredCellHeight = singleFullBody ? 1536 : spriteType === "full-body" ? 768 : 512;
  const requestedSheetWidth = cols * preferredCellWidth;
  const requestedSheetHeight = rows * preferredCellHeight;

  if (!isOpenAIGptImageModel(model) || (spriteType !== "full-body" && supportsOpenAIImageCustomSize(model))) {
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

export function compileSpritePrompt(
  prompt: string,
  options: {
    negativePrompt?: string;
    appearance?: string;
    styleProfiles: ImageStyleProfileSettings;
    imageDefaults?: ImageGenerationDefaultsProfile | null;
    /** Per-request style override (#5095). Absent → the compiler's existing
     *  chain (connection image defaults ?? the user's default profile), i.e.
     *  exactly today's behavior. Unknown ids degrade the same way the gallery
     *  path degrades — findImageStyleProfile simply finds nothing. */
    styleProfileId?: string | null;
  },
): SpriteCompiledPrompt {
  const requestedStyleProfileId =
    typeof options.styleProfileId === "string" && options.styleProfileId.trim()
      ? options.styleProfileId.trim().slice(0, 120)
      : undefined;
  const compiled = compileImagePrompt({
    kind: "sprite",
    prompt,
    negativePrompt: options.negativePrompt,
    userPositive: options.appearance,
    styleProfiles: options.styleProfiles,
    imageDefaults: options.imageDefaults,
    styleProfileId: requestedStyleProfileId,
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
  const rawServiceHint = connection.videoService || source;
  const serviceHint =
    source === "swarmui"
      ? "swarmui"
      : rawServiceHint === "google_ai_studio"
        ? inferVideoSource(connection.model || "", connection.baseUrl || "")
        : rawServiceHint;
  const isXaiVideo = source === "xai" || serviceHint === "xai";
  const isGoogleVeoVideo = source === "google_veo" || serviceHint === "google_veo";
  const isNanoGptVideo = source === "nanogpt";
  const isOpenRouterVideo = !isNanoGptVideo && (source === "openrouter" || serviceHint === "openrouter");
  const isAtlasVideo = source === "atlas" || serviceHint === "atlas";
  const isSeedanceVideo = source === "seedance" || serviceHint === "seedance";
  const isSwarmUiVideo = source === "swarmui" || serviceHint === "swarmui";
  const isComfyUiVideo = source === "comfyui" || serviceHint === "comfyui" || isSwarmUiVideo;
  return {
    source,
    serviceHint,
    baseUrl:
      connection.baseUrl ||
      (isXaiVideo
        ? "https://api.x.ai/v1"
        : isGoogleVeoVideo
          ? "https://generativelanguage.googleapis.com/v1beta"
          : isNanoGptVideo
            ? "https://nano-gpt.com/api"
            : isOpenRouterVideo
              ? "https://openrouter.ai/api/v1"
              : isAtlasVideo
                ? "https://api.atlascloud.ai/api/v1"
                : isSeedanceVideo
                  ? "https://api.seedance2.ai"
                  : isSwarmUiVideo
                    ? "http://127.0.0.1:7801"
                    : isComfyUiVideo
                      ? "http://127.0.0.1:8188"
                      : "https://generativelanguage.googleapis.com/v1beta"),
    model:
      connection.model ||
      (isXaiVideo
        ? "grok-imagine-video-1.5"
        : isGoogleVeoVideo
          ? "veo-3.1-generate-preview"
          : isNanoGptVideo
            ? ""
            : isOpenRouterVideo
              ? "google/veo-3.1"
              : isAtlasVideo
                ? "google/veo3.1/text-to-video"
                : isSeedanceVideo
                  ? "seedance-2-0"
                  : isComfyUiVideo
                    ? ""
                    : "gemini-omni-flash-preview"),
    resolution: isXaiVideo
      ? videoDefaults.xai.resolution
      : isGoogleVeoVideo
        ? videoDefaults.googleVeo.resolution
        : isNanoGptVideo
          ? videoDefaults.openrouter.resolution
          : isOpenRouterVideo
            ? videoDefaults.openrouter.resolution
            : isAtlasVideo
              ? videoDefaults.atlas.resolution
              : isSeedanceVideo
                ? videoDefaults.seedance.resolution
                : isComfyUiVideo
                  ? videoDefaults.comfyui.resolution
                  : undefined,
    comfyWorkflow: connection.comfyuiWorkflow || undefined,
    comfyLoras: isComfyUiVideo ? videoDefaults.comfyui.loras : [],
    comfyFps: isComfyUiVideo ? videoDefaults.comfyui.fps : undefined,
    atlasModelOptions: isAtlasVideo
      ? videoDefaults.atlas.modelOptions[connection.model?.trim() || "google/veo3.1/text-to-video"]
      : undefined,
    publicReferenceUpload: resolveVideoReferencePublicUploadOptions(isSeedanceVideo, videoDefaults.seedance),
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

function withSpriteBackgroundContract(prompt: SpriteCompiledPrompt, plan: SpritePromptPlan): SpriteCompiledPrompt {
  if (!plan.backgroundContract) return prompt;

  return {
    prompt: `${prompt.prompt}\n\n${plan.backgroundContract}`,
    negativePrompt: [
      prompt.negativePrompt,
      "white background, off-white background, gray background, checkerboard background, fake transparency, transparency grid, textured background, gradient background, scenery, floor line, cast shadow, contact shadow, color spill, visible grid lines, panel borders, separator lines",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** How each talking-head face looks with open eyes and closed lips. Unasked, models draw amusement, excitement,
 *  fear, grief and disgust with an open mouth, shut eyes or teeth, and can't draw vague labels such as approval
 *  or realization at all. */
export const TALKING_HEAD_FACE_LOOKS: Readonly<Record<AvatarEmotion | AvatarExtraFeeling, string>> = Object.freeze({
  neutral: "calm resting face, relaxed brows, eyes open and looking ahead, lips closed in a relaxed line",
  happy: "warm closed-lip smile with lifted cheeks, bright open eyes, relaxed brows",
  angry: "glare under lowered, drawn-together brows, lips pressed shut, tense jaw",
  sad: "brows tilted up at the inner ends, open eyes with a lowered gaze, closed mouth turned down at the corners",
  relaxed: "peaceful, content look, soft brows, calm open eyes, faint closed-lip smile",
  surprised: "eyes wide open, brows raised high, lips closed",
  curiosity: "interested look, one brow raised, head tilted slightly, attentive open eyes, lips closed",
  admiration: "eyes bright and wide with interest, brows lifted, soft closed-lip smile, looking up a little",
  amusement: "playful closed-lip grin with lifted cheeks, bright, merry open eyes, relaxed brows",
  desire:
    "wistful, longing look, soft open eyes gazing slightly aside, brows gently raised, small hopeful closed-lip smile",
  embarrassment:
    "flushed pink cheeks, open eyes glancing aside, brows raised in the middle, small awkward closed-lip smile",
  excitement: "eyes wide and sparkling, brows high, big closed-lip smile with lifted cheeks",
  gratitude: "warm thankful look, brows softly raised, open eyes slightly glistening, gentle closed-lip smile",
  optimism: "hopeful look, bright open eyes looking slightly upward, brows lifted, confident closed-lip smile",
  pride: "chin raised, self-assured open-eyed gaze, relaxed brows, satisfied closed-lip smile",
  annoyance: "flat, unimpressed stare under slightly lowered brows, eyes still fully open, lips pressed to one side",
  disapproval:
    "stern look, brows drawn together and slightly lowered, open eyes, lips pressed into a thin line, chin slightly raised",
  disgust: "nose wrinkled, brows lowered, head pulled back slightly, closed lips pulled down at one corner",
  disappointment:
    "brows tilted up at the inner ends, open eyes with a dropped gaze, closed mouth turned down, slight slump",
  grief:
    "deep sorrow, brows pulled up at the inner ends, open eyes glistening with tears, closed trembling lips turned down",
  nervousness:
    "uneasy look, brows raised and drawn together, open eyes glancing sideways, lips pressed in a tight wavy line, a bead of sweat",
  remorse:
    "guilty look, head slightly bowed, brows tilted up at the inner ends, open eyes looking down, lips pressed together",
  approval: "calm, confident look, steady open-eyed gaze, relaxed brows, small closed-lip smile",
  caring: "gentle, tender look, brows softly raised, warm open eyes, soft closed-lip smile, head tilted slightly",
  love: "affectionate soft gaze with open eyes, light blush on the cheeks, gentle closed-lip smile",
  relief: "brows relaxed and slightly raised, shoulders lowered, open eyes, soft closed-lip smile",
  confusion:
    "puzzled look, one brow raised and the other lowered, head tilted, open eyes, lips closed and pushed to one side",
  fear: "eyes very wide with the whites showing, brows raised and pulled together, lips pressed tightly shut, tense shoulders",
  realization: 'eyes widening slightly, brows lifting, lips closed, a sudden "I see" look',
});

/** A talking head's blink and talk pictures close the eyes and open the mouth of each face, so every face
 *  has to start with open eyes and a closed mouth. Unasked, models draw "happy" as a closed-eye smile and
 *  "angry" and "surprised" with an open mouth, and the swap then changes nothing. Added after the prompt is compiled,
 *  like the background contract, so the tag compiler can't drop it. The faces asked for get their look; a custom
 *  label gets none. */
export function withTalkingHeadFaceContract(
  prompt: SpriteCompiledPrompt,
  plan: Pick<SpritePromptPlan, "talkingHeadFaces"> & { expressions?: readonly string[] },
  expressions: readonly string[] = plan.expressions ?? [],
): SpriteCompiledPrompt {
  if (!plan.talkingHeadFaces) return prompt;

  const rule = `MANDATORY TALKING-HEAD FACES: in every face both eyes are fully open with the irises visible, and the lips are closed. Show each feeling with the eyebrows, the shape of the open eyes and the cheeks: a happy face smiles with open eyes and closed lips, an angry face glares under lowered brows with its lips pressed shut, and a surprised face has wide-open eyes and raised brows with a closed mouth. Never draw a closed-eye smile (^_^), a wink, eyes squeezed shut, an open-mouth laugh, gasp or shout, gritted or bared teeth, or any visible teeth. Separate blinking and talking pictures are made from these faces later.`;
  const looks = expressions.flatMap((label) => {
    const key = normalizeSpriteExpressionKey(label) as keyof typeof TALKING_HEAD_FACE_LOOKS;
    return Object.hasOwn(TALKING_HEAD_FACE_LOOKS, key)
      ? [`${formatSpriteLabelForPrompt(label)}: ${TALKING_HEAD_FACE_LOOKS[key]}`]
      : [];
  });

  return {
    prompt: [prompt.prompt, looks.length > 0 ? `${rule}\nDraw each face like this: ${looks.join("; ")}.` : rule].join(
      "\n\n",
    ),
    negativePrompt: [
      prompt.negativePrompt,
      "closed eyes, eyes shut, closed-eye smile, ^_^, winking, squinting, open mouth, parted lips, laughing, gasping, shouting, gritted teeth, bared teeth, visible teeth, tongue out",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** The cells of a talking head's set, left to right: the face, then its blink and talk pictures. */
const TALKING_HEAD_SET_CELLS = ["face", "eyes-closed", "mouth-open"] as const;

/** A talking head's set: the same face three times in one picture, so the blink and talk pictures match it.
 *  Added after the prompt is compiled, like the other contracts, so the tag compiler can't drop it. */
export function withTalkingHeadSetContract(prompt: SpriteCompiledPrompt, face: string): SpriteCompiledPrompt {
  const key = normalizeSpriteExpressionKey(face) as keyof typeof TALKING_HEAD_FACE_LOOKS;
  const look = Object.hasOwn(TALKING_HEAD_FACE_LOOKS, key) ? `, ${TALKING_HEAD_FACE_LOOKS[key]}` : "";
  return {
    prompt: [
      prompt.prompt,
      `MANDATORY TALKING-HEAD SET: the three cells show the same character as the same picture: identical pose, head angle, framing, size, position in the cell, hair, outfit, lighting and colours. Only the eyes and the mouth differ.`,
      `Cell 1: the ${formatSpriteLabelForPrompt(face)} face${look}, both eyes fully open, lips closed.`,
      `Cell 2: exactly cell 1 with both eyes closed, relaxed eyelids as in a blink; the mouth and everything else unchanged.`,
      `Cell 3: exactly cell 1 with the mouth open as if saying a clear "ah"; the eyes and everything else unchanged.`,
    ].join("\n\n"),
    negativePrompt: [
      prompt.negativePrompt,
      "different pose in each cell, different framing in each cell, different hair in each cell, different outfit in each cell, head turned, zoomed cell",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** Removes a sheet's background when asked (native transparency is preferred; a flat matte is removed when a
 *  provider cannot return alpha) and cuts it into its cells, each cleaned again on its own. Cleanup that fails
 *  keeps the picture as it is rather than failing the sheet. */
async function cutSpriteSheet(
  sheet: Buffer,
  plan: Pick<SpritePromptPlan, "cols" | "rows" | "expressions">,
  options: { clean: boolean; cleanupStrength: number },
): Promise<{ sheetBase64: string; cells: Array<{ expression: string; base64: string }> }> {
  let sheetBuffer = sheet;
  const sharp = await getSharp();
  let metadata = await sharp(sheetBuffer).metadata();
  if (options.clean) {
    try {
      sheetBuffer = (await removeSpriteBackgroundPng(sheetBuffer, options.cleanupStrength)).buffer;
      metadata = await sharp(sheetBuffer).metadata();
    } catch (bgErr) {
      logger.warn(bgErr, "Sprite background cleanup failed; continuing with original image");
      sheetBuffer = sheet;
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
        (async () => {
          let cellBuffer = await sharp(sheetBuffer)
            .extract({ left, top, width: cellWidth, height: cellHeight })
            .png()
            .toBuffer();
          if (options.clean) {
            try {
              cellBuffer = (await removeSpriteBackgroundPng(cellBuffer, options.cleanupStrength)).buffer;
            } catch (bgErr) {
              logger.warn(bgErr, 'Sprite background cleanup failed for "%s"; using the sheet crop', expression);
            }
          }
          return { expression, base64: cellBuffer.toString("base64") };
        })(),
      );
    }
  }
  return { sheetBase64: sheetBuffer.toString("base64"), cells: await Promise.all(cellPromises) };
}

/** The image connection a talking head's set is drawn with, as the avatar generator resolves it. */
export interface TalkingHeadSetConnection {
  conn: ImageDefaultsConnection & {
    apiKey?: string | null;
    imageEndpointId?: string | null;
    comfyuiWorkflow?: string | null;
  };
  fallback?: Awaited<ReturnType<typeof resolveImageConnectionFallback>>;
}

/** The prompt and sheet size of a talking head's set for one face, drawn from the appearance for an image
 *  connection that can't edit pictures. Built like the face maker's sheet (the expression sheet template, the
 *  style profile and the chroma matte it removes), with the set contract after it. */
export async function talkingHeadSetPrompt(
  db: DB,
  image: TalkingHeadSetConnection,
  request: { face: string; appearance: string },
): Promise<SpriteCompiledPrompt & { width: number; height: number }> {
  const model = image.conn.model || "";
  const face = formatSpriteLabelForPrompt(request.face);
  const body: SpriteGenerateSheetBody = {
    appearance: request.appearance,
    expressions: [face, `${face}, eyes closed`, `${face}, mouth open`],
    cols: TALKING_HEAD_SET_CELLS.length,
    rows: 1,
    spriteType: "expressions",
    noBackground: true,
    nativeTransparentPng: false,
  };
  const plan = await buildSpritePromptPlan(db, body, model);
  const imageSettings = await loadImageGenerationUserSettings(db);
  const compiled = compileSpritePrompt(plan.prompt, {
    appearance: plan.appearance,
    styleProfiles: imageSettings.styleProfiles,
    imageDefaults: resolveConnectionImageDefaults(image.conn),
  });
  const prompt = withTalkingHeadSetContract(
    withSpriteBackgroundContract(withSpriteSheetLayoutContract(compiled, plan), plan),
    request.face,
  );
  return { ...prompt, width: plan.sheetWidth, height: plan.sheetHeight };
}

/** Draws a talking head's set in one picture with `prompt` (talkingHeadSetPrompt, or the reviewed one) and
 *  cuts it into the face and its eyes-closed and mouth-open cells, each without its background (PNG). The
 *  cells are drawn separately, so they still have to be lined up with the face. */
export async function drawTalkingHeadSet(
  image: TalkingHeadSetConnection,
  request: {
    prompt: SpriteCompiledPrompt & { width: number; height: number };
    signal?: AbortSignal;
    debug: boolean;
    logLabel: string;
  },
): Promise<Record<(typeof TALKING_HEAD_SET_CELLS)[number], Buffer>> {
  const { conn } = image;
  const model = conn.model || "";
  const source = conn.imageGenerationSource || model;
  logDebugOverride(
    request.debug,
    "[debug/avatar-generation] %s set prompt (%dx%d):\n%s\nnegative: %s",
    request.logLabel,
    request.prompt.width,
    request.prompt.height,
    request.prompt.prompt,
    request.prompt.negativePrompt,
  );
  const result = await generateImage(
    source,
    conn.baseUrl || "https://image.pollinations.ai",
    conn.apiKey || "",
    conn.imageService || source,
    {
      prompt: request.prompt.prompt,
      negativePrompt: request.prompt.negativePrompt || undefined,
      model,
      width: request.prompt.width,
      height: request.prompt.height,
      transparentBackground: false,
      imageEndpointId: conn.imageEndpointId || undefined,
      comfyWorkflow: conn.comfyuiWorkflow || undefined,
      imageDefaults: resolveConnectionImageDefaults(conn),
      quality: resolveConnectionImageQuality(conn),
      fallback: image.fallback ?? undefined,
      signal: request.signal,
      debugMode: request.debug,
    },
  );
  const { cells } = await cutSpriteSheet(
    Buffer.from(result.base64, "base64"),
    { cols: TALKING_HEAD_SET_CELLS.length, rows: 1, expressions: [...TALKING_HEAD_SET_CELLS] },
    { clean: true, cleanupStrength: 35 },
  );
  const cell = (name: (typeof TALKING_HEAD_SET_CELLS)[number]) =>
    Buffer.from(cells.find((entry) => entry.expression === name)!.base64, "base64");
  return { face: cell("face"), "eyes-closed": cell("eyes-closed"), "mouth-open": cell("mouth-open") };
}

function withFullBodyCompositionContract(
  prompt: SpriteCompiledPrompt,
  spriteType: SpriteType | undefined,
): SpriteCompiledPrompt {
  if (spriteType !== "full-body") return prompt;

  return {
    prompt: [
      prompt.prompt,
      `MANDATORY FULL-BODY COMPOSITION: use tall, pulled-back long shots. In every requested image or sheet cell, show the complete character continuously from the top of the hair through both shoes and the soles of both feet. Keep every silhouette inside its frame with generous empty matte above the head, beside the body, and below the feet. Each character may occupy at most 76% of its image or cell height. A waist-up, knees-up, bust, portrait, close-up, cropped-leg, or missing-feet result is invalid.`,
      `Portrait reference images define identity and facial expression only. Never copy their camera distance, crop, canvas proportions, or missing lower body.`,
    ].join("\n\n"),
    negativePrompt: [
      prompt.negativePrompt,
      "waist-up, bust portrait, close-up, medium shot, cowboy shot, knees-up crop, cropped legs, cropped feet, missing feet, cut-off shoes, body outside frame, oversized character",
    ]
      .filter(Boolean)
      .join(", "),
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
  const normalized = value.replace(/[\\/]/g, "_").replace(SPRITE_EXPORT_NAME_RE, "_").replace(/\s+/g, " ").trim();
  let start = 0;
  let end = normalized.length;
  const isUnsafeEdge = (character: string | undefined) =>
    character === "." || character === "_" || character === "-" || character?.trim() === "";
  while (start < end && isUnsafeEdge(normalized[start])) start++;
  while (end > start && isUnsafeEdge(normalized[end - 1])) end--;
  const sanitized = normalized.slice(start, end);
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

export type FullBodyReferenceRole =
  { kind: "neutral-full-body" } | { kind: "expression"; expression: string } | { kind: "identity" };

export function buildFullBodyReferenceContract(roles: FullBodyReferenceRole[]): string {
  if (roles.length === 0) return "";

  const instructions = roles.map((role, index) => {
    const imageNumber = index + 1;
    if (role.kind === "neutral-full-body") {
      return `Reference image ${imageNumber} is the user-approved neutral full-body design. Preserve its exact clothing, footwear, accessories, body proportions, colors, and art style.`;
    }
    if (role.kind === "expression") {
      return `Reference image ${imageNumber} is the saved portrait for the "${formatSpriteLabelForPrompt(role.expression)}" expression. Match its face, gaze, mouth, eyebrows, and emotional intensity while expanding the result into the required complete full body.`;
    }
    return `Reference image ${imageNumber} is an additional identity reference. Preserve recognizable facial and design traits without copying its crop or pose.`;
  });

  return [
    "MANDATORY REFERENCE CONTRACT:",
    ...instructions,
    "The references are source material, not a requested collage or panel layout. Output one character only, in one uninterrupted head-to-toe sprite.",
  ].join(" ");
}

function resolveFullBodyExpressionReferences(
  body: SpriteGenerateSheetBody,
  expression: string,
): { images: string[]; roles: FullBodyReferenceRole[] } {
  const images: string[] = [];
  const roles: FullBodyReferenceRole[] = [];
  const seen = new Set<string>();
  const addReference = (input: string | undefined, role: FullBodyReferenceRole) => {
    const resolved = resolveReferenceImageBase64(input);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    images.push(resolved);
    roles.push(role);
  };

  addReference(body.neutralFullBodyReference, { kind: "neutral-full-body" });

  const normalizedExpression = normalizeSpriteExpression(expression);
  const matchingExpressionReference = (body.expressionReferences ?? []).find(
    (entry) => normalizeSpriteExpression(entry.expression ?? "") === normalizedExpression,
  );
  addReference(matchingExpressionReference?.image, {
    kind: "expression",
    expression: normalizedExpression || expression,
  });

  const identityReferences = body.referenceImages?.length
    ? body.referenceImages
    : body.referenceImage
      ? [body.referenceImage]
      : [];
  for (const reference of identityReferences) {
    addReference(reference, { kind: "identity" });
  }

  return { images: images.slice(0, 16), roles: roles.slice(0, 16) };
}

async function resolveVideoReferenceImage(input?: string): Promise<VideoReferenceImage | null> {
  const base64 = resolveReferenceImageBase64(input);
  if (!base64) return null;
  const trimmedInput = input?.trim() ?? "";
  const normalizedInputPath = normalizeLocalImagePath(trimmedInput);
  const referenceUrl = /^https?:\/\//i.test(trimmedInput)
    ? trimmedInput
    : normalizedInputPath.startsWith("/api/") || normalizedInputPath.startsWith("/sprites/")
      ? normalizedInputPath
      : null;
  const buffer = Buffer.from(extractBase64ImageData(base64), "base64");
  const info = isAllowedImageBuffer(buffer);
  if (info?.mimeType === "image/png" || info?.mimeType === "image/jpeg") {
    return { base64: buffer.toString("base64"), mimeType: info.mimeType, url: referenceUrl };
  }
  if (info) {
    const sharp = await getSharp();
    const png = await sharp(buffer, { limitInputPixels: false }).png().toBuffer();
    return { base64: png.toString("base64"), mimeType: "image/png", url: referenceUrl };
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
  return resolveSpritePromptOverride(override, {
    prompt,
    negativePrompt:
      "text, captions, subtitles, speech bubbles, UI, watermark, logo, extra people, multiple faces, split panel, collage, scene cut, camera shake, identity drift, changed outfit",
  }).value;
}

async function buildSpritePromptPlan(
  db: DB,
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
    !supportsOpenAIImageCustomSize(imgModel);
  if (generateExpressionsIndividually && expressions.length > MAX_INDIVIDUAL_SPRITE_EXPRESSIONS) {
    expressions = expressions.slice(0, MAX_INDIVIDUAL_SPRITE_EXPRESSIONS);
  }
  const expressionList = expressions.join(", ");
  const promptOverridesStorage = createPromptOverridesStorage(db);
  const trimmedAppearance = body.appearance?.trim() || "";
  const nativeTransparentPng = resolveSpriteNativeTransparency(imgModel, body.nativeTransparentPng === true);
  const matte = selectSpriteChromaMatte(trimmedAppearance);
  const backgroundOptions = {
    matte,
    nativeTransparentPng,
    removeBackground: body.noBackground === true,
  };
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
      expressionCount: cols * rows,
      expressionList,
      appearance: trimmedAppearance,
      sheetWidth,
      sheetHeight,
      cellWidth,
      cellHeight,
    });
  }
  prompt = applySpriteBackgroundInstruction(prompt, backgroundOptions);

  return {
    expressions,
    cols,
    rows,
    spriteType: body.spriteType,
    fullBodyExpressionMode,
    generateExpressionsIndividually,
    appearance: trimmedAppearance,
    prompt,
    matte,
    nativeTransparentPng,
    backgroundContract: spriteBackgroundContract(backgroundOptions),
    talkingHeadFaces: body.talkingHeadFaces === true && body.spriteType !== "full-body",
    sheetWidth,
    sheetHeight,
    cellWidth,
    cellHeight,
    promptOverrides: readSpritePromptOverrides(body.promptOverrides),
    promptOverridesStorage,
  };
}

async function buildIndividualFullBodyExpressionRequest({
  body,
  plan,
  expression,
  styleProfiles,
  imageDefaults,
}: {
  body: SpriteGenerateSheetBody;
  plan: SpritePromptPlan;
  expression: string;
  styleProfiles: ImageStyleProfileSettings;
  imageDefaults?: ImageGenerationDefaultsProfile | null;
}): Promise<{ prompt: SpriteCompiledPrompt; references: string[] }> {
  const readableExpression = formatSpriteLabelForPrompt(expression);
  let sourcePrompt = await loadPrompt(plan.promptOverridesStorage, SPRITES_SINGLE_FULL_BODY, {
    appearance: plan.appearance,
    pose: `relaxed neutral standing pose with a clearly visible ${readableExpression} facial expression`,
  });
  sourcePrompt = `${sourcePrompt} The face must match the requested ${readableExpression} expression while the body remains in the same relaxed neutral standing pose.`;
  sourcePrompt = applySpriteBackgroundInstruction(sourcePrompt, {
    matte: plan.matte,
    nativeTransparentPng: plan.nativeTransparentPng,
    removeBackground: body.noBackground === true,
  });

  const compiledPrompt = compileSpritePrompt(sourcePrompt, {
    appearance: plan.appearance,
    styleProfiles,
    imageDefaults,
    styleProfileId: body.styleProfileId,
  });
  const reviewedPrompt = resolveSpritePromptOverride(
    plan.promptOverrides.get(spritePromptReviewId("expression", plan.spriteType, expression)),
    compiledPrompt,
  );
  const references = resolveFullBodyExpressionReferences(body, expression);
  const referenceContract = buildFullBodyReferenceContract(references.roles);
  const fullBodyPrompt = withFullBodyCompositionContract(
    withSpriteBackgroundContract(reviewedPrompt.value, plan),
    "full-body",
  );

  return {
    prompt: {
      ...fullBodyPrompt,
      prompt: referenceContract ? `${fullBodyPrompt.prompt}\n\n${referenceContract}` : fullBodyPrompt.prompt,
    },
    references: references.images,
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
    if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }
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
   * POST /api/sprites/pixelize
   * Deterministic pixel-art post-processing (#5096): nearest-kernel downscale to
   * a target cell size, palette quantization against a caller-supplied ramp,
   * binary alpha, and a wrap-around seam score for tileability. Standalone like
   * the cleanup routes, so client-only capability packages can call it over REST.
   * Body: { imageBase64, targetWidth, targetHeight?, palette?, alphaThreshold? }
   * Returns: { imageBase64, report: { width, height, paletteSize, seamScoreX, seamScoreY, tileable } }
   */
  app.post("/pixelize", async (req, reply) => {
    const body = req.body as {
      imageBase64?: string;
      targetWidth?: number;
      targetHeight?: number;
      palette?: string[];
      alphaThreshold?: number;
    };
    const resolved = resolveReferenceImageBase64(body.imageBase64);
    if (!resolved) {
      return reply.status(400).send({ error: "imageBase64 is required (data URL or raw base64)" });
    }
    // ~24MB decoded cap before Buffer.from allocates; the service enforces the
    // stricter pixel-dimension bounds from the image header.
    if (resolved.length > 32 * 1024 * 1024) {
      return reply.status(400).send({ error: "Image is too large to pixelize" });
    }
    if (!Number.isInteger(body.targetWidth)) {
      return reply.status(400).send({ error: "targetWidth is required" });
    }
    if (body.palette !== undefined && !Array.isArray(body.palette)) {
      return reply.status(400).send({ error: "palette must be an array of #rrggbb colors" });
    }
    try {
      const result = await pixelizeImage(Buffer.from(resolved, "base64"), {
        targetWidth: body.targetWidth as number,
        targetHeight: body.targetHeight,
        palette: body.palette?.map((entry) => String(entry)),
        alphaThreshold: body.alphaThreshold,
      });
      return { imageBase64: result.png.toString("base64"), report: result.report };
    } catch (error) {
      if (error instanceof PixelizeInputError) {
        return reply.status(400).send({ error: error.message });
      }
      if (error instanceof Error && error.message.includes("Image processing is unavailable")) {
        // The documented sharp-unavailable answer (Android/Termux without a
        // native prebuild) — an actionable 503, never a bare 500.
        return reply.status(503).send({ error: error.message });
      }
      throw error;
    }
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
   * PATCH /api/sprites/:characterId/:expression
   * Rename a saved sprite without replacing its image.
   * Body: { expression: string }
   */
  app.patch<{ Params: { characterId: string; expression: string } }>(
    "/:characterId/:expression",
    { config: { rateLimit: SPRITE_RENAME_RATE_LIMIT } },
    async (req, reply) =>
      withSpriteRenameLock(req.params.characterId, async () => {
        const { characterId, expression } = req.params;
        if (characterId.includes("..") || characterId.includes("/") || characterId.includes("\\")) {
          return reply.status(400).send({ error: "Invalid character ID" });
        }

        const body = req.body;
        const nextExpression =
          body &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          typeof (body as { expression?: unknown }).expression === "string"
            ? normalizeSpriteExpression((body as { expression: string }).expression)
            : "";
        if (!nextExpression) {
          return reply.status(400).send({ error: "Expression label must include at least one letter or number" });
        }

        const dir = join(SPRITES_ROOT, characterId);
        if (!existsSync(dir)) return reply.status(404).send({ error: "No sprites found" });

        const files = readdirSync(dir);
        const source = files.find((filename) => {
          const ext = extname(filename);
          return SPRITE_FILE_RE.test(filename) && filename.slice(0, -ext.length) === expression;
        });
        if (!source) return reply.status(404).send({ error: "Expression not found" });

        const extension = extname(source);
        const target = `${nextExpression}${extension}`;
        const hasNameCollision = files.some((filename) => {
          if (!SPRITE_FILE_RE.test(filename)) return false;
          const filenameExpression = filename.slice(0, -extname(filename).length);
          return filename !== source && filenameExpression.toLowerCase() === nextExpression.toLowerCase();
        });
        if (hasNameCollision) {
          return reply.status(409).send({ error: "An expression with that name already exists" });
        }

        if (target !== source) await rename(join(dir, source), join(dir, target));
        const mtime = statSync(join(dir, target)).mtimeMs;
        return {
          expression: nextExpression,
          filename: target,
          url: `/api/sprites/${characterId}/file/${encodeURIComponent(target)}?v=${Math.floor(mtime)}`,
        };
      }),
  );

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
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      characterId.includes("..") ||
      characterId.includes("/") ||
      characterId.includes("\\")
    ) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const filePath = assertInsideDir(SPRITES_ROOT, join(SPRITES_ROOT, characterId, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const image = await validateImageAssetFile(filePath, filename, { allowSvg: true });
    if (!image) return reply.status(404).send({ error: "Not found" });

    if (image.isSvg) reply.header("Content-Security-Policy", "sandbox; default-src 'none'");
    return sendValidatedMediaFile(reply, image, {
      method: req.method,
      rangeHeader: req.headers.range,
      cacheControl: "public, max-age=31536000, immutable",
    });
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
    const plan = await buildSpritePromptPlan(app.db, body, imgModel);
    if (plan.expressions.length === 0) {
      return reply.status(400).send({ error: "No expressions remain after applying the requested grid size" });
    }

    if (plan.fullBodyExpressionMode) {
      const { sheetWidth, sheetHeight } = resolveSpriteSheetCanvas({
        cols: 1,
        rows: 1,
        spriteType: "full-body",
        model: imgModel,
      });
      const items = await Promise.all(
        plan.expressions.map(async (expression) => {
          const request = await buildIndividualFullBodyExpressionRequest({
            body,
            plan,
            expression,
            styleProfiles: imageSettings.styleProfiles,
            imageDefaults,
          });
          const previewSize = resolveImagePromptReviewSize({
            connection: conn,
            prompt: request.prompt.prompt,
            width: sheetWidth,
            height: sheetHeight,
            imageDefaults,
          });
          return {
            id: spritePromptReviewId("expression", plan.spriteType, expression),
            kind: "sprite",
            title: `Full-body expression: ${expression.replace(/_/g, " ")}`,
            prompt: request.prompt.prompt,
            negativePrompt: request.prompt.negativePrompt,
            width: previewSize.width,
            height: previewSize.height,
          };
        }),
      );
      return { items };
    }

    if (plan.generateExpressionsIndividually) {
      const items = await Promise.all(
        plan.expressions.map(async (expression) => {
          let expressionPrompt = await loadPrompt(plan.promptOverridesStorage, SPRITES_SINGLE_PORTRAIT, {
            appearance: body.appearance?.trim() || "",
            expression,
          });
          expressionPrompt = applySpriteBackgroundInstruction(expressionPrompt, {
            matte: plan.matte,
            nativeTransparentPng: plan.nativeTransparentPng,
            removeBackground: body.noBackground === true,
          });
          const compiledPrompt = compileSpritePrompt(expressionPrompt, {
            appearance: plan.appearance,
            styleProfiles: imageSettings.styleProfiles,
            imageDefaults,
            styleProfileId: body.styleProfileId,
          });
          const reviewedPrompt = resolveSpritePromptOverride(
            plan.promptOverrides.get(spritePromptReviewId("expression", plan.spriteType, expression)),
            compiledPrompt,
          );
          const finalPrompt = withTalkingHeadFaceContract(
            withSpriteBackgroundContract(reviewedPrompt.value, plan),
            plan,
            [expression],
          );
          const previewSize = resolveImagePromptReviewSize({
            connection: conn,
            prompt: finalPrompt.prompt,
            width: 1024,
            height: 1024,
            imageDefaults,
          });
          return {
            id: spritePromptReviewId("expression", plan.spriteType, expression),
            kind: "sprite",
            title: `Expression: ${expression.replace(/_/g, " ")}`,
            prompt: finalPrompt.prompt,
            negativePrompt: finalPrompt.negativePrompt,
            width: previewSize.width,
            height: previewSize.height,
          };
        }),
      );
      return { items };
    }

    const compiledPrompt = compileSpritePrompt(plan.prompt, {
      appearance: plan.appearance,
      styleProfiles: imageSettings.styleProfiles,
      imageDefaults,
      styleProfileId: body.styleProfileId,
    });
    const sheetPromptId = spritePromptReviewId(
      "sheet",
      plan.spriteType,
      `${plan.cols}x${plan.rows}-${plan.expressions.join(",")}`,
    );
    const reviewedPrompt = resolveSpritePromptOverride(plan.promptOverrides.get(sheetPromptId), compiledPrompt);
    const finalPrompt = withFullBodyCompositionContract(
      withTalkingHeadFaceContract(
        withSpriteBackgroundContract(
          withSpriteSheetLayoutContract(reviewedPrompt.value, plan, {
            reviewedOverride: reviewedPrompt.overridden,
          }),
          plan,
        ),
        plan,
      ),
      plan.spriteType,
    );
    const previewSize = resolveImagePromptReviewSize({
      connection: conn,
      prompt: finalPrompt.prompt,
      width: plan.sheetWidth,
      height: plan.sheetHeight,
      imageDefaults,
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
          width: previewSize.width,
          height: previewSize.height,
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
    const videoFallback = await resolveVideoConnectionFallback(connections, conn.id);

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
                  comfyWorkflow: resolved.comfyWorkflow,
                  comfyLoras: resolved.comfyLoras,
                  fps: resolved.comfyFps,
                  atlasModelOptions: resolved.atlasModelOptions,
                  referenceImage,
                  publicReferenceUpload: resolved.publicReferenceUpload,
                  fallback: videoFallback,
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
    const nativeTransparentPng = resolveSpriteNativeTransparency(imgModel, body.nativeTransparentPng === true);
    const shouldCleanBackground = body.noBackground === true || body.nativeTransparentPng === true;
    const plan = await buildSpritePromptPlan(app.db, body, imgModel);
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
      styleProfileId: body.styleProfileId,
    });
    const reviewedSheetPrompt = resolveSpritePromptOverride(
      plan.promptOverrides.get(sheetPromptId),
      compiledSheetPrompt,
    );
    const sheetPrompt = withFullBodyCompositionContract(
      withTalkingHeadFaceContract(
        withSpriteBackgroundContract(
          withSpriteSheetLayoutContract(reviewedSheetPrompt.value, plan, {
            reviewedOverride: reviewedSheetPrompt.overridden,
          }),
          plan,
        ),
        plan,
      ),
      plan.spriteType,
    );

    // Parse reference images to raw base64 (supports data URL, raw base64, or local avatar URL)
    const rawRefs = body.referenceImages?.length
      ? body.referenceImages
      : body.referenceImage
        ? [body.referenceImage]
        : [];
    const resolvedRefs = rawRefs.map(resolveReferenceImageBase64).filter((r): r is string => !!r);
    const imageFallback = await resolveImageConnectionFallback(connections, conn.id);

    try {
      return await withSpriteGenerationDeadline(
        (async () => {
          if (plan.fullBodyExpressionMode) {
            const cells: Array<{ expression: string; base64: string }> = [];
            const failedExpressions: Array<{ expression: string; error: string }> = [];
            const { sheetWidth: targetWidth, sheetHeight: targetHeight } = resolveSpriteSheetCanvas({
              cols: 1,
              rows: 1,
              spriteType: "full-body",
              model: imgModel,
            });

            for (const expression of plan.expressions) {
              try {
                const request = await buildIndividualFullBodyExpressionRequest({
                  body,
                  plan,
                  expression,
                  styleProfiles: imageSettings.styleProfiles,
                  imageDefaults,
                });
                const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                  prompt: request.prompt.prompt,
                  negativePrompt: request.prompt.negativePrompt || undefined,
                  model: imgModel,
                  width: targetWidth,
                  height: targetHeight,
                  referenceImage: request.references[0],
                  referenceImages: request.references.length > 1 ? request.references : undefined,
                  transparentBackground: nativeTransparentPng,
                  imageEndpointId: conn.imageEndpointId || undefined,
                  comfyWorkflow: conn.comfyuiWorkflow || undefined,
                  imageDefaults,
                  quality: resolveConnectionImageQuality(conn),
                  fallback: imageFallback,
                });

                let spriteBuffer: Buffer = Buffer.from(imageResult.base64, "base64");
                const sharp = await getSharp();
                const metadata = await sharp(spriteBuffer).metadata();
                if (metadata.width !== targetWidth || metadata.height !== targetHeight) {
                  spriteBuffer = await sharp(spriteBuffer)
                    .resize(targetWidth, targetHeight, {
                      fit: "contain",
                      background: nativeTransparentPng
                        ? { r: 0, g: 0, b: 0, alpha: 0 }
                        : shouldCleanBackground
                          ? { r: plan.matte.rgb.red, g: plan.matte.rgb.green, b: plan.matte.rgb.blue, alpha: 1 }
                          : { r: 255, g: 255, b: 255 },
                    })
                    .png()
                    .toBuffer();
                }

                if (shouldCleanBackground) {
                  try {
                    spriteBuffer = (await removeSpriteBackgroundPng(spriteBuffer, cleanupStrength)).buffer;
                  } catch (bgErr) {
                    logger.warn(
                      bgErr,
                      'Full-body expression background cleanup failed for "%s"; continuing with the generated image',
                      expression,
                    );
                  }
                }

                cells.push({ expression, base64: spriteBuffer.toString("base64") });
              } catch (expressionErr: any) {
                const message = String(expressionErr?.message || "Generation failed")
                  .replace(/<[^>]*>/g, "")
                  .slice(0, 300);
                logger.warn(expressionErr, 'Full-body expression sprite "%s" generation failed; skipping', expression);
                failedExpressions.push({ expression, error: message });
              }
            }

            if (cells.length === 0) {
              const allFailedError = new Error("All full-body expression generations failed");
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

          if (plan.generateExpressionsIndividually) {
            const cells: Array<{ expression: string; base64: string }> = [];
            const failedExpressions: Array<{ expression: string; error: string }> = [];

            for (const expression of plan.expressions) {
              try {
                let expressionPrompt = await loadPrompt(plan.promptOverridesStorage, SPRITES_SINGLE_PORTRAIT, {
                  appearance: body.appearance?.trim() || "",
                  expression,
                });
                expressionPrompt = applySpriteBackgroundInstruction(expressionPrompt, {
                  matte: plan.matte,
                  nativeTransparentPng,
                  removeBackground: body.noBackground === true,
                });
                const compiledExpressionPrompt = compileSpritePrompt(expressionPrompt, {
                  appearance: plan.appearance,
                  styleProfiles: imageSettings.styleProfiles,
                  imageDefaults,
                  styleProfileId: body.styleProfileId,
                });
                const reviewedExpressionPrompt = resolveSpritePromptOverride(
                  plan.promptOverrides.get(spritePromptReviewId("expression", plan.spriteType, expression)),
                  compiledExpressionPrompt,
                );
                const finalExpressionPrompt = withTalkingHeadFaceContract(
                  withSpriteBackgroundContract(reviewedExpressionPrompt.value, plan),
                  plan,
                  [expression],
                );

                const targetSize = 1024;
                const imageResult = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
                  prompt: finalExpressionPrompt.prompt,
                  negativePrompt: finalExpressionPrompt.negativePrompt || undefined,
                  model: imgModel,
                  width: targetSize,
                  height: targetSize,
                  referenceImage: resolvedRefs[0],
                  referenceImages: resolvedRefs.length > 1 ? resolvedRefs : undefined,
                  transparentBackground: nativeTransparentPng,
                  imageEndpointId: conn.imageEndpointId || undefined,
                  comfyWorkflow: conn.comfyuiWorkflow || undefined,
                  imageDefaults,
                  quality: resolveConnectionImageQuality(conn),
                  fallback: imageFallback,
                });

                let spriteBuffer: Buffer = Buffer.from(imageResult.base64, "base64");
                const sharp = await getSharp();
                const meta = await sharp(spriteBuffer).metadata();
                if (meta.width && meta.height && (meta.width !== targetSize || meta.height !== targetSize)) {
                  spriteBuffer = await sharp(spriteBuffer)
                    .resize(targetSize, targetSize, {
                      fit: "contain",
                      background: nativeTransparentPng
                        ? { r: 0, g: 0, b: 0, alpha: 0 }
                        : shouldCleanBackground
                          ? { r: plan.matte.rgb.red, g: plan.matte.rgb.green, b: plan.matte.rgb.blue, alpha: 1 }
                          : { r: 255, g: 255, b: 255 },
                    })
                    .png()
                    .toBuffer();
                }

                if (shouldCleanBackground) {
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
            quality: resolveConnectionImageQuality(conn),
            fallback: imageFallback,
          });

          return cutSpriteSheet(Buffer.from(imageResult.base64, "base64"), plan, {
            clean: shouldCleanBackground,
            cleanupStrength,
          });
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
