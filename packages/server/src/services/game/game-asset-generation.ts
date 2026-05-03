// ──────────────────────────────────────────────
// Game: On-the-fly Asset Generation
//
// Generates NPC portraits and location backgrounds
// mid-game using the user's image generation connection.
// Called from the scene-wrap pipeline when
// `enableSpriteGeneration` is active.
// ──────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { logger } from "../../lib/logger.js";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { generateImage, type ImageGenRequest } from "../image/image-generation.js";
import { buildAssetManifest, GAME_ASSETS_DIR } from "./asset-manifest.service.js";

const NPC_AVATAR_DIR = join(DATA_DIR, "avatars", "npc");
const GAME_BACKGROUND_WIDTH = 1024;
const GAME_BACKGROUND_HEIGHT = 576;

// sharp is optional in the server package. Generated game backgrounds should be
// stored at the VN canvas ratio when possible, but generation must still work on
// platforms where sharp is unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpFn = any;
let _sharp: SharpFn | null = null;
let _sharpLoadFailed = false;

async function getSharp(): Promise<SharpFn | null> {
  if (_sharp) return _sharp;
  if (_sharpLoadFailed) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - optional native dependency
    const mod = await import("sharp");
    _sharp = (mod.default ?? mod) as SharpFn;
    return _sharp;
  } catch {
    _sharpLoadFailed = true;
    return null;
  }
}

async function gameBackgroundBuffer(base64: string): Promise<Buffer> {
  const input = Buffer.from(base64, "base64");
  const sharp = await getSharp();
  if (!sharp) return input;
  try {
    return await sharp(input)
      .resize(GAME_BACKGROUND_WIDTH, GAME_BACKGROUND_HEIGHT, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  } catch (err) {
    logger.warn(err, "[game-asset-gen] Failed to resize generated game background; saving original image");
    return input;
  }
}

export function readAvatarBase64(avatarPath: string | null | undefined): string | undefined {
  if (!avatarPath) return undefined;
  const cleanAvatarPath = avatarPath.split("?")[0] ?? avatarPath;
  const parts = cleanAvatarPath.split("/").filter(Boolean);
  if (parts.some((part) => part === ".." || part.includes("\\"))) return undefined;

  let diskPath: string | null = null;
  if (cleanAvatarPath.startsWith("/api/avatars/file/")) {
    const filename = parts.at(-1);
    if (filename) diskPath = join(DATA_DIR, "avatars", filename);
  } else if (cleanAvatarPath.startsWith("/api/avatars/npc/")) {
    const chatId = parts.at(-2);
    const filename = parts.at(-1);
    if (chatId && filename) diskPath = join(DATA_DIR, "avatars", "npc", chatId, filename);
  } else if (cleanAvatarPath.startsWith("avatars/")) {
    diskPath = join(DATA_DIR, ...parts);
  }

  if (!diskPath) return undefined;
  try {
    if (!existsSync(diskPath)) return undefined;
    return readFileSync(diskPath).toString("base64");
  } catch {
    return undefined;
  }
}

/** Sanitise a name into a safe filesystem slug. */
function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hasExplicitNonHumanCue(value: string): boolean {
  return /\b(?:animal|cat|kitten|dog|puppy|wolf|fox|bird|raven|crow|owl|horse|deer|rabbit|rat|mouse|snake|lizard|dragon|beast|creature|monster|spirit|ghost|construct|golem|doll|object|statue|mascot|non[-\s]?human|anthropomorphic|feral|quadruped)\b/i.test(
    value,
  );
}

function buildNpcPortraitPrompt(req: NpcPortraitRequest): string {
  const context = req.appearance.trim();
  const explicitNonHuman = hasExplicitNonHumanCue(`${req.npcName} ${context}`);
  return [
    `NPC portrait for ${req.npcName}.`,
    context ? `Canonical visual description from the current game: ${context}.` : "",
    explicitNonHuman
      ? "The description explicitly indicates a non-human subject. Preserve that exact species, body plan, age category, and silhouette; do not turn it into a human or kemonomimi character unless the description says humanoid."
      : "Unless the description explicitly says otherwise, depict this NPC as a human or humanoid person. Do not infer an animal species from the name, mood, speech verbs, or setting.",
    req.artStyle ? `Art style: ${req.artStyle}.` : "",
    explicitNonHuman
      ? "Use a centered avatar composition appropriate to the subject, including a creature portrait or full head-and-body crop only when that best preserves the described non-human form."
      : "Use a centered human/humanoid avatar composition: face and shoulders, readable expression, clear outfit cues.",
    "High quality game avatar, clear readable design, no text, no UI, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1400);
}

// ── NPC Portrait Generation ──

export interface NpcPortraitRequest {
  chatId: string;
  npcName: string;
  appearance: string;
  /** Unified art style prompt for visual consistency. */
  artStyle?: string;
  /** Connection credentials — already resolved & decrypted. */
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgComfyWorkflow?: string | undefined;
  debugLog?: (message: string, ...args: any[]) => void;
}

/**
 * Generate a single portrait for an NPC and save it to disk.
 * Returns the avatar URL path on success, or null on failure.
 */
export async function generateNpcPortrait(req: NpcPortraitRequest): Promise<string | null> {
  const slug = safeName(req.npcName);
  if (!slug) return null;

  const avatarDir = join(NPC_AVATAR_DIR, req.chatId);
  const avatarPath = join(avatarDir, `${slug}.png`);

  // Skip if already exists
  if (existsSync(avatarPath)) {
    return `/api/avatars/npc/${req.chatId}/${slug}.png`;
  }

  const prompt = buildNpcPortraitPrompt(req);
  req.debugLog?.(
    "[debug/game/image-generation] NPC portrait request name=%s model=%s source=%s size=512x512 prompt:\n%s",
    req.npcName,
    req.imgModel,
    req.imgSource || req.imgService || "",
    prompt,
  );

  try {
    const result = await generateImage(
      req.imgModel,
      req.imgBaseUrl,
      req.imgApiKey,
      req.imgSource || req.imgService || "",
      {
        prompt,
        model: req.imgModel,
        width: 512,
        height: 512,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
      },
    );

    if (!existsSync(avatarDir)) mkdirSync(avatarDir, { recursive: true });
    writeFileSync(avatarPath, Buffer.from(result.base64, "base64"));

    const url = `/api/avatars/npc/${req.chatId}/${slug}.png`;
    req.debugLog?.(
      "[debug/game/image-generation] NPC portrait result name=%s bytes=%d url=%s",
      req.npcName,
      Buffer.byteLength(result.base64, "base64"),
      url,
    );
    logger.info(`[game-asset-gen] Generated NPC portrait for "${req.npcName}" → ${url}`);
    return url;
  } catch (err) {
    logger.warn(err, '[game-asset-gen] Failed to generate portrait for "%s"', req.npcName);
    return null;
  }
}

// ── Background Generation ──

/** Map a game genre string to one of the canonical background folders. */
function genreToFolder(genre?: string): string {
  if (!genre) return "fantasy";
  const g = genre.toLowerCase();
  if (g.includes("sci") || g.includes("cyber") || g.includes("space") || g.includes("futur")) return "scifi";
  if (g.includes("modern") || g.includes("contemporary") || g.includes("urban") || g.includes("real")) return "modern";
  return "fantasy";
}

export interface BackgroundGenRequest {
  chatId: string;
  /** Short slug for the location, e.g. "dark-forest-clearing" */
  locationSlug: string;
  /** Scene description used as the image prompt. */
  sceneDescription: string;
  /** The game's genre/setting/tone for style guidance. */
  genre?: string;
  setting?: string;
  /** Unified art style prompt for visual consistency. */
  artStyle?: string;
  /** Connection credentials. */
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgComfyWorkflow?: string | undefined;
  debugLog?: (message: string, ...args: any[]) => void;
}

export interface SceneIllustrationGenRequest {
  chatId: string;
  prompt: string;
  reason?: string;
  characters?: string[];
  characterDescriptions?: string[];
  slug?: string;
  genre?: string;
  setting?: string;
  artStyle?: string;
  referenceImages?: string[];
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgComfyWorkflow?: string | undefined;
  debugLog?: (message: string, ...args: any[]) => void;
}

/**
 * Generate a background image for a game location and add it to the
 * asset manifest. Returns the asset tag on success, or null on failure.
 */
export async function generateBackground(req: BackgroundGenRequest): Promise<string | null> {
  const slug = safeName(req.locationSlug);
  if (!slug) return null;

  const subcategory = genreToFolder(req.genre);
  const filename = `${slug}.png`;
  const targetDir = join(GAME_ASSETS_DIR, "backgrounds", subcategory);
  const targetPath = join(targetDir, filename);

  // Build asset tag: backgrounds:<category>:<slug>
  const tag = `backgrounds:${subcategory}:${slug}`;

  // Skip if already generated
  if (existsSync(targetPath)) {
    return tag;
  }

  const styleHint = [req.artStyle, req.genre, req.setting].filter(Boolean).join(", ");
  const prompt =
    `${req.sceneDescription}. ${styleHint ? `Style: ${styleHint}.` : ""} Wide-angle landscape, detailed environment, no characters, no text, no UI, game background art, high quality`.slice(
      0,
      1000,
    );
  req.debugLog?.(
    "[debug/game/image-generation] background request slug=%s model=%s source=%s targetSize=%dx%d prompt:\n%s",
    slug,
    req.imgModel,
    req.imgSource || req.imgService || "",
    GAME_BACKGROUND_WIDTH,
    GAME_BACKGROUND_HEIGHT,
    prompt,
  );

  try {
    const result = await generateImage(
      req.imgModel,
      req.imgBaseUrl,
      req.imgApiKey,
      req.imgSource || req.imgService || "",
      {
        prompt,
        model: req.imgModel,
        width: GAME_BACKGROUND_WIDTH,
        height: GAME_BACKGROUND_HEIGHT,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
      },
    );

    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const imageBuffer = await gameBackgroundBuffer(result.base64);
    writeFileSync(targetPath, imageBuffer);

    // Rebuild manifest so the new tag is available immediately
    buildAssetManifest();

    logger.info(`[game-asset-gen] Generated background "${slug}" → tag: ${tag}`);
    req.debugLog?.(
      "[debug/game/image-generation] background result slug=%s bytes=%d tag=%s",
      slug,
      imageBuffer.byteLength,
      tag,
    );
    return tag;
  } catch (err) {
    logger.warn(err, '[game-asset-gen] Failed to generate background "%s"', slug);
    return null;
  }
}

export async function generateSceneIllustration(req: SceneIllustrationGenRequest): Promise<string | null> {
  const baseSlug = safeName(req.slug || req.reason || req.prompt.slice(0, 80)) || "scene-illustration";
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const filename = `${slug}.png`;
  const targetDir = join(GAME_ASSETS_DIR, "backgrounds", "illustrations");
  const targetPath = join(targetDir, filename);
  const tag = `backgrounds:illustrations:${slug}`;

  const styleHint = [req.artStyle, req.genre, req.setting].filter(Boolean).join(", ");
  const characterHint = req.characters?.length ? `Characters: ${req.characters.join(", ")}.` : "";
  const referenceHint = req.referenceImages?.length
    ? "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters."
    : "";
  const descriptionHint = req.characterDescriptions?.length
    ? `Appearance notes for visible characters without an attached reference image:\n- ${req.characterDescriptions.join("\n- ")}`
    : "";
  const prompt = [
    "Image type: polished visual novel CG illustration replacing the game background for one important scene.",
    "Camera / POV: first-person view from the player protagonist's eyes. Do not show the protagonist except hands or arms when the moment explicitly requires them.",
    `Scene moment: ${req.prompt}`,
    req.reason ? `Narrative purpose: ${req.reason}.` : "",
    characterHint,
    referenceHint,
    descriptionHint,
    styleHint ? `Art direction: ${styleHint}.` : "",
    "Composition: cinematic 16:9 visual novel CG, emotionally specific staging, clear focal point, high-quality finished illustration.",
    "Avoid: text, UI, captions, speech bubbles, watermarks, and unrelated characters.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2200);
  req.debugLog?.(
    "[debug/game/image-generation] scene illustration request slug=%s model=%s source=%s targetSize=%dx%d refs=%d prompt:\n%s",
    slug,
    req.imgModel,
    req.imgSource || req.imgService || "",
    GAME_BACKGROUND_WIDTH,
    GAME_BACKGROUND_HEIGHT,
    req.referenceImages?.length ?? 0,
    prompt,
  );

  try {
    const result = await generateImage(
      req.imgModel,
      req.imgBaseUrl,
      req.imgApiKey,
      req.imgSource || req.imgService || "",
      {
        prompt,
        model: req.imgModel,
        width: GAME_BACKGROUND_WIDTH,
        height: GAME_BACKGROUND_HEIGHT,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
        referenceImages: req.referenceImages?.length ? req.referenceImages.slice(0, 4) : undefined,
      },
    );

    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const imageBuffer = await gameBackgroundBuffer(result.base64);
    writeFileSync(targetPath, imageBuffer);
    buildAssetManifest();

    console.log(`[game-asset-gen] Generated scene illustration "${slug}" -> tag: ${tag}`);
    req.debugLog?.(
      "[debug/game/image-generation] scene illustration result slug=%s bytes=%d tag=%s",
      slug,
      imageBuffer.byteLength,
      tag,
    );
    return tag;
  } catch (err) {
    console.warn(`[game-asset-gen] Failed to generate scene illustration "${slug}":`, err);
    return null;
  }
}
