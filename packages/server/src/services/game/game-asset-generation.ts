// ──────────────────────────────────────────────
// Game: On-the-fly Asset Generation
//
// Generates NPC portraits and location backgrounds
// mid-game using the user's image generation connection.
// Called from the scene-wrap pipeline when
// `enableSpriteGeneration` is active.
// ──────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { logger } from "../../lib/logger.js";
import { basename, join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { generateImage, type ImageGenResult } from "../image/image-generation.js";
import { buildAssetManifest, GAME_ASSETS_DIR } from "./asset-manifest.service.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, GAME_NPC_PORTRAIT, GAME_BACKGROUND, GAME_SCENE_ILLUSTRATION } from "../prompt-overrides/index.js";
import { type ImageGenerationDefaultsProfile, type ImageStyleProfileSettings } from "@marinara-engine/shared";
import type { ImageGenerationSize } from "../image/image-generation-settings.js";
import { compileImagePrompt } from "../image/image-prompt-compiler.js";

const NPC_AVATAR_DIR = join(DATA_DIR, "avatars", "npc");
const CHAT_BACKGROUND_DIR = join(DATA_DIR, "backgrounds");
const CHAT_BACKGROUND_META_PATH = join(CHAT_BACKGROUND_DIR, "meta.json");
export const DEFAULT_GAME_BACKGROUND_SIZE: ImageGenerationSize = { width: 1280, height: 720 };
export const DEFAULT_GAME_PORTRAIT_SIZE: ImageGenerationSize = { width: 1024, height: 1024 };
export const GENERATED_GAME_BACKGROUND_EXTS = ["png", "jpg", "jpeg", "webp", "avif", "gif"] as const;
const GAME_BACKGROUND_EXT_SET = new Set<string>(GENERATED_GAME_BACKGROUND_EXTS);
const GAME_PORTRAIT_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, speech bubble, split screen, panel, collage, contact sheet, grid, four portraits, multiple portraits, duplicated face, extra head, extra person, bad anatomy, low quality";
const GAME_BACKGROUND_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, people, character, portrait, split screen, panel, collage, contact sheet, grid, multiple frames, low quality";
const GAME_ILLUSTRATION_NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, UI, watermark, logo, signature, speech bubble, split screen, panel, collage, contact sheet, character sheet, grid, four images, duplicated face, extra head, unrelated character, bad anatomy, low quality";
const MAX_GENERATED_ASSET_SLUG_BYTES = 180;

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

type GameBackgroundImage = {
  buffer: Buffer;
  ext: string;
};

type ChatBackgroundMeta = Record<string, { originalName?: string; tags: string[] }>;

/** Return the extension implied by known image file signatures. */
function detectImageExt(buffer: Buffer): string | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
  }
  return null;
}

/** Prefer the actual encoded bytes, then fall back to provider metadata. */
function normalizeGeneratedImageExt(result: Pick<ImageGenResult, "mimeType" | "ext">, buffer: Buffer): string {
  const detectedExt = detectImageExt(buffer);
  if (detectedExt) return detectedExt;

  const ext = result.ext.trim().toLowerCase().replace(/^\./, "");
  if (GAME_BACKGROUND_EXT_SET.has(ext)) return ext === "jpeg" ? "jpg" : ext;

  const mime = result.mimeType.toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("avif")) return "avif";
  if (mime.includes("gif")) return "gif";
  return "png";
}

/** Resize generated backgrounds through sharp when available, preserving original format otherwise. */
async function gameBackgroundImage(result: ImageGenResult, size: ImageGenerationSize): Promise<GameBackgroundImage> {
  const input = Buffer.from(result.base64, "base64");
  const sharp = await getSharp();
  if (!sharp) return { buffer: input, ext: normalizeGeneratedImageExt(result, input) };
  try {
    const buffer = await sharp(input)
      .resize(size.width, size.height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    return { buffer, ext: "png" };
  } catch (err) {
    logger.warn(err, "[game-asset-gen] Failed to resize generated game background; saving original image");
    return { buffer: input, ext: normalizeGeneratedImageExt(result, input) };
  }
}

/** Build the generated game background file path for a slug and extension. */
function generatedBackgroundPath(targetDir: string, slug: string, ext: string): string {
  return join(targetDir, `${slug}.${ext}`);
}

/** Find an existing generated background regardless of the saved image format. */
function existingGeneratedBackgroundPath(targetDir: string, slug: string): string | null {
  for (const ext of GENERATED_GAME_BACKGROUND_EXTS) {
    const candidate = generatedBackgroundPath(targetDir, slug, ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readChatBackgroundMeta(): ChatBackgroundMeta {
  if (!existsSync(CHAT_BACKGROUND_META_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(CHAT_BACKGROUND_META_PATH, "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed as ChatBackgroundMeta) : {};
  } catch {
    return {};
  }
}

function writeChatBackgroundMeta(meta: ChatBackgroundMeta): void {
  if (!existsSync(CHAT_BACKGROUND_DIR)) mkdirSync(CHAT_BACKGROUND_DIR, { recursive: true });
  writeFileSync(CHAT_BACKGROUND_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

function chatBackgroundTags(req: ChatBackgroundGenRequest, slug: string): string[] {
  const tags = new Set<string>(["generated", "roleplay", slug.replace(/-/g, " ")]);
  for (const value of [req.locationSlug, req.reason]) {
    if (!value) continue;
    const clean = value.trim().replace(/\s+/g, " ");
    if (clean) tags.add(clean.slice(0, 80));
  }
  return Array.from(tags).filter(Boolean);
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
  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (slug || !trimmed) return slug;
  return `asset-${createHash("sha256").update(trimmed).digest("hex").slice(0, 8)}`;
}

function truncateSlugByBytes(slug: string, maxBytes: number): string {
  let truncated = slug;
  while (Buffer.byteLength(truncated, "utf8") > maxBytes) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.replace(/-+$/g, "");
}

export function safeGeneratedAssetSlug(name: string, opts: { maxBytes?: number; suffix?: string } = {}): string {
  const maxBytes = opts.maxBytes ?? MAX_GENERATED_ASSET_SLUG_BYTES;
  const slug = safeName(name) || "asset";
  const suffix = opts.suffix ? safeName(opts.suffix) : "";
  const candidate = suffix ? `${slug}-${suffix}` : slug;
  if (Buffer.byteLength(candidate, "utf8") <= maxBytes) return candidate;

  const hash = createHash("sha256").update(slug).digest("hex").slice(0, 8);
  const tail = [hash, suffix].filter(Boolean).join("-");
  const prefixBudget = Math.max(1, maxBytes - Buffer.byteLength(tail, "utf8") - 1);
  const prefix = truncateSlugByBytes(slug, prefixBudget) || "asset";
  return `${prefix}-${tail}`;
}

function hasExplicitNonHumanCue(value: string): boolean {
  return /\b(?:animal|cat|kitten|dog|puppy|wolf|fox|bird|raven|crow|owl|horse|deer|rabbit|rat|mouse|snake|lizard|dragon|beast|creature|monster|spirit|ghost|construct|golem|doll|object|statue|mascot|non[-\s]?human|anthropomorphic|feral|quadruped)\b/i.test(
    value,
  );
}

function normalizeNpcGenderCue(gender: string | null | undefined, pronouns: string | null | undefined, text: string) {
  const explicit = `${gender ?? ""} ${pronouns ?? ""}`.toLowerCase();
  if (/\b(?:non[-\s]?binary|enby|androgynous|genderless|agender|they\/them)\b/.test(explicit)) {
    return "androgynous";
  }
  if (/\b(?:female|woman|girl|lady|feminine|she\/her|she|her)\b/.test(explicit)) return "female";
  if (/\b(?:male|man|boy|gentleman|masculine|he\/him|he|him|his)\b/.test(explicit)) return "male";

  const lower = text.toLowerCase();
  if (/\b(?:non[-\s]?binary|enby|androgynous|genderless|agender)\b/.test(lower)) return "androgynous";
  if (/\b(?:she|her|hers|woman|female|girl|lady)\b/.test(lower)) return "female";
  if (/\b(?:he|him|his|man|male|boy|gentleman)\b/.test(lower)) return "male";
  return null;
}

function deriveNpcAgeCue(text: string): string | null {
  const lower = text.toLowerCase();
  const decade = lower.match(/\b(?:early|mid|late)\s+(?:twenties|thirties|forties|fifties|sixties)\b/);
  if (decade?.[0]) return decade[0];
  const ageLabel = lower.match(/\b(?:young adult|middle[-\s]aged|elderly|senior|adult|teen(?:ager)?|child|kid)\b/);
  if (ageLabel?.[0]) return ageLabel[0].replace(/\s+/, " ");

  const adultMilestones = [
    /\b(?:owner|employee|business|agency|rent|debt|pay off|mercenary work|adventuring guilds?)\b/,
    /\b(?:joined the army|basic training|deployed|shipped off|fight in the war|crew)\b/,
    /\b(?:high\s*school dropout|expelled|academy|final exam)\b/,
    /\b(?:refugee|moved to|save enough money|opened)\b/,
  ];
  const score = adultMilestones.reduce((count, pattern) => count + (pattern.test(lower) ? 1 : 0), 0);
  return score >= 2 ? "young adult" : null;
}

function normalizeVisualTag(value: string): string | null {
  const tag = value
    .toLowerCase()
    .replace(/\b(?:her|his|their|the|a|an|with|has|have|having|is|are|was|were)\b/g, " ")
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!tag || tag.length > 48) return null;
  if (/\b(?:someone|something|nothing|thing|person|people|room|scene)\b/.test(tag)) return null;
  return tag;
}

function addUniqueVisualTag(tags: string[], value: string | null | undefined): void {
  const tag = value ? normalizeVisualTag(value) : null;
  if (!tag || tags.some((existing) => existing.toLowerCase() === tag)) return;
  tags.push(tag);
}

function collectNpcVisualAttributeTags(text: string): string[] {
  const tags: string[] = [];
  const clean = text.replace(/\s+/g, " ");
  const nounPattern = /\b((?:short|long|curly|wavy|straight|messy|neat|dark|light|pale|bright|piercing|deep|warm|cool|grey|gray|blue|green|hazel|brown|black|blonde|blond|auburn|red|white|silver|golden|olive|tan|tanned|fair|freckled|weathered)(?:[-\s]+[a-z]+){0,4}\s+(?:hair|eyes|skin))\b/gi;
  for (const match of clean.matchAll(nounPattern)) {
    addUniqueVisualTag(tags, match[1]);
  }

  const eyesArePattern = /\beyes?\s+(?:are|is|were|was)\s+(?:a\s+|an\s+)?((?:piercing|bright|deep|pale|dark|light|grey|gray|blue|green|hazel|brown|black|amber)(?:[-\s]+[a-z]+){0,3})\b/gi;
  for (const match of clean.matchAll(eyesArePattern)) {
    addUniqueVisualTag(tags, `${match[1]} eyes`);
  }

  const skinPattern = /\b(?:skin|complexion)\s+(?:is|are|was|were)?\s*(?:a\s+|an\s+)?((?:pale|fair|tan|tanned|olive|brown|dark|light|warm|cool|freckled|weathered)(?:[-\s]+[a-z]+){0,3})\b/gi;
  for (const match of clean.matchAll(skinPattern)) {
    addUniqueVisualTag(tags, `${match[1]} skin`);
  }

  return tags.slice(0, 4);
}

function buildNpcAppearanceLine(req: NpcPortraitRequest, explicitNonHuman: boolean): string {
  const context = req.appearance.trim();
  if (explicitNonHuman && !context) return "Appearance: non-human creature.";

  const identityTags: string[] = [];
  if (!explicitNonHuman) {
    identityTags.push(deriveNpcAgeCue(context) ?? "adult");
    identityTags.push(normalizeNpcGenderCue(req.gender, req.pronouns, context) ?? "androgynous");
    identityTags.push("human or humanoid person");
  }
  identityTags.push(...collectNpcVisualAttributeTags(context));

  const identityLine = identityTags.length > 0 ? `Appearance: ${identityTags.join(", ")}.` : "";
  if (!context) return identityLine || "Appearance: human or humanoid adult.";
  return `${identityLine} Canonical visual description from the current game: ${context}.`.trim();
}

function npcPortraitVariables(req: NpcPortraitRequest) {
  const context = req.appearance.trim();
  const explicitNonHuman = hasExplicitNonHumanCue(`${req.npcName} ${context}`);
  return {
    npcName: req.npcName,
    appearanceLine: buildNpcAppearanceLine(req, explicitNonHuman),
    nonHumanRule: explicitNonHuman
      ? "The description explicitly indicates a non-human subject. Preserve that exact species, body plan, age category, and silhouette; do not turn it into a human or kemonomimi character unless the description says humanoid."
      : "Unless the description explicitly says otherwise, depict this NPC as a human or humanoid person. Do not infer an animal species from the name, mood, speech verbs, or setting.",
    artStyleLine: req.artStyle ? `Art style: ${req.artStyle}.` : "",
    compositionRule: explicitNonHuman
      ? "Use a centered avatar composition appropriate to the subject, including a creature portrait or full head-and-body crop only when that best preserves the described non-human form."
      : "Use a centered human/humanoid avatar composition: face and shoulders, readable expression, clear outfit cues.",
  };
}

function resolvedSize(size: ImageGenerationSize | undefined, fallback: ImageGenerationSize): ImageGenerationSize {
  return {
    width: size?.width ?? fallback.width,
    height: size?.height ?? fallback.height,
  };
}

// ── NPC Portrait Generation ──

export interface NpcPortraitRequest {
  chatId: string;
  npcName: string;
  appearance: string;
  gender?: string | null;
  pronouns?: string | null;
  /** Unified art style prompt for visual consistency. */
  artStyle?: string;
  /** Connection credentials — already resolved & decrypted. */
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgEndpointId?: string | null;
  imgComfyWorkflow?: string | undefined;
  imgDefaults?: ImageGenerationDefaultsProfile | null;
  styleProfiles?: ImageStyleProfileSettings;
  styleProfileId?: string | null;
  debugLog?: (message: string, ...args: any[]) => void;
  /** Storage for user-supplied prompt overrides. Optional — falls back to default builder when omitted. */
  promptOverridesStorage?: PromptOverridesStorage;
  size?: ImageGenerationSize;
  promptOverride?: string;
  negativePromptOverride?: string;
  /** When true, overwrite an existing generated NPC portrait instead of reusing it. */
  force?: boolean;
}

export type CompiledGameImagePrompt = {
  prompt: string;
  negativePrompt: string;
};

async function buildNpcPortraitRawPrompt(req: NpcPortraitRequest): Promise<string> {
  const vars = npcPortraitVariables(req);
  return req.promptOverridesStorage
    ? await loadPrompt(req.promptOverridesStorage, GAME_NPC_PORTRAIT, vars)
    : GAME_NPC_PORTRAIT.defaultBuilder(vars);
}

export async function buildNpcPortraitProviderPrompt(req: NpcPortraitRequest): Promise<CompiledGameImagePrompt> {
  if (req.promptOverride?.trim()) {
    return {
      prompt: req.promptOverride.trim(),
      negativePrompt: req.negativePromptOverride?.trim() || "",
    };
  }
  return compileGameImagePrompt(
    req,
    "portrait",
    await buildNpcPortraitRawPrompt(req),
    1400,
    GAME_PORTRAIT_NEGATIVE_PROMPT,
  );
}

export async function buildNpcPortraitImagePrompt(req: NpcPortraitRequest): Promise<string> {
  return (await buildNpcPortraitProviderPrompt(req)).prompt;
}

function compileGameImagePrompt(
  req: Pick<
    NpcPortraitRequest | BackgroundGenRequest | SceneIllustrationGenRequest,
    "styleProfiles" | "styleProfileId" | "imgDefaults" | "artStyle"
  >,
  kind: "portrait" | "background" | "illustration",
  prompt: string,
  maxLength: number,
  hardNegative?: string,
  negativePrompt?: string | null,
) {
  if (!req.styleProfiles) {
    return {
      prompt: prompt.slice(0, maxLength),
      negativePrompt: [negativePrompt, hardNegative].filter(Boolean).join(", "),
    };
  }
  const compiled = compileImagePrompt({
    kind,
    prompt,
    negativePrompt,
    hardNegative,
    styleProfiles: req.styleProfiles,
    styleProfileId: req.styleProfileId,
    imageDefaults: req.imgDefaults,
    generatedStyle: req.artStyle,
  });
  return {
    prompt: compiled.prompt.slice(0, maxLength),
    negativePrompt: compiled.negativePrompt,
  };
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

  // Skip if already exists unless the caller explicitly asked for a fresh portrait.
  if (!req.force && existsSync(avatarPath)) {
    return `/api/avatars/npc/${req.chatId}/${slug}.png`;
  }

  const compiled = await buildNpcPortraitProviderPrompt(req);
  const prompt = compiled.prompt;
  const size = resolvedSize(req.size, DEFAULT_GAME_PORTRAIT_SIZE);
  req.debugLog?.(
    "[debug/game/image-generation] NPC portrait request name=%s model=%s source=%s size=%dx%d prompt:\n%s",
    req.npcName,
    req.imgModel,
    req.imgSource || req.imgService || "",
    size.width,
    size.height,
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
        negativePrompt: compiled.negativePrompt || undefined,
        model: req.imgModel,
        width: size.width,
        height: size.height,
        imageEndpointId: req.imgEndpointId || undefined,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
        imageDefaults: req.imgDefaults ?? undefined,
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
    logger.info('[game-asset-gen] Generated NPC portrait for "%s" -> %s', req.npcName, url);
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
  /** Current tracked world-state location, used to keep generic scene prompts grounded. */
  currentLocation?: string | null;
  currentWeather?: string | null;
  currentTimeOfDay?: string | null;
  worldOverview?: string | null;
  /** Unified art style prompt for visual consistency. */
  artStyle?: string;
  /** Connection credentials. */
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgEndpointId?: string | null;
  imgComfyWorkflow?: string | undefined;
  imgDefaults?: ImageGenerationDefaultsProfile | null;
  styleProfiles?: ImageStyleProfileSettings;
  styleProfileId?: string | null;
  debugLog?: (message: string, ...args: any[]) => void;
  /** Storage for user-supplied prompt overrides. Optional — falls back to default builder when omitted. */
  promptOverridesStorage?: PromptOverridesStorage;
  size?: ImageGenerationSize;
  promptOverride?: string;
  negativePromptOverride?: string;
}

export interface ChatBackgroundGenRequest extends BackgroundGenRequest {
  /** Why the background agent asked for generation. Stored as background metadata. */
  reason?: string;
}

export interface SceneIllustrationGenRequest {
  chatId: string;
  title?: string;
  prompt: string;
  reason?: string;
  characters?: string[];
  characterDescriptions?: string[];
  slug?: string;
  genre?: string;
  setting?: string;
  artStyle?: string;
  /** Extra user instructions appended to scene illustration prompts. */
  imagePromptInstructions?: string;
  referenceImages?: string[];
  imgSource?: string | null;
  imgModel: string;
  imgBaseUrl: string;
  imgApiKey: string;
  imgService?: string | null;
  imgEndpointId?: string | null;
  imgComfyWorkflow?: string | undefined;
  imgDefaults?: ImageGenerationDefaultsProfile | null;
  styleProfiles?: ImageStyleProfileSettings;
  styleProfileId?: string | null;
  debugLog?: (message: string, ...args: any[]) => void;
  /** Storage for user-supplied prompt overrides. Optional — falls back to default builder when omitted. */
  promptOverridesStorage?: PromptOverridesStorage;
  size?: ImageGenerationSize;
  promptOverride?: string;
  negativePromptOverride?: string;
}

async function buildBackgroundRawPrompt(req: BackgroundGenRequest): Promise<string> {
  const styleHint = [req.artStyle, req.genre, req.setting].filter(Boolean).join(", ");
  const worldContext = buildBackgroundWorldContext(req);
  const groundedSceneDescription = [worldContext, req.sceneDescription].filter(Boolean).join(". ");
  const backgroundVars = {
    sceneDescription: groundedSceneDescription,
    styleLine: styleHint ? `Style: ${styleHint}.` : "",
  };
  return req.promptOverridesStorage
    ? await loadPrompt(req.promptOverridesStorage, GAME_BACKGROUND, backgroundVars)
    : GAME_BACKGROUND.defaultBuilder(backgroundVars);
}

function buildBackgroundWorldContext(req: BackgroundGenRequest): string {
  const fragments = [
    req.genre,
    req.setting,
    req.currentLocation ? `location ${req.currentLocation}` : "",
    req.currentWeather ? `${req.currentWeather} weather` : "",
    req.currentTimeOfDay ? req.currentTimeOfDay : "",
    compactWorldOverview(req.worldOverview),
  ]
    .map((fragment) => cleanBackgroundContextFragment(fragment))
    .filter(Boolean);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const fragment of fragments) {
    const key = fragment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fragment);
  }
  return deduped.slice(0, 6).join(", ");
}

function compactWorldOverview(value: string | null | undefined): string {
  const clean = cleanBackgroundContextFragment(value);
  if (!clean) return "";
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim() ?? clean;
  return firstSentence.split(/\s+/).slice(0, 18).join(" ");
}

function cleanBackgroundContextFragment(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[<>\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 180);
}

export async function buildBackgroundProviderPrompt(req: BackgroundGenRequest): Promise<CompiledGameImagePrompt> {
  if (req.promptOverride?.trim()) {
    return {
      prompt: req.promptOverride.trim(),
      negativePrompt: req.negativePromptOverride?.trim() || "",
    };
  }
  return compileGameImagePrompt(
    req,
    "background",
    await buildBackgroundRawPrompt(req),
    1000,
    GAME_BACKGROUND_NEGATIVE_PROMPT,
  );
}

export async function buildBackgroundImagePrompt(req: BackgroundGenRequest): Promise<string> {
  return (await buildBackgroundProviderPrompt(req)).prompt;
}

async function buildSceneIllustrationRawPrompt(req: SceneIllustrationGenRequest): Promise<string> {
  const styleHint = [req.artStyle, req.genre, req.setting].filter(Boolean).join(", ");
  const sceneTitle = sceneIllustrationContextTitle(req);
  const narrativePurpose = cleanSceneIllustrationContext(req.reason);
  const meaningfulNarrativePurpose = isGenericSceneMomentLabel(narrativePurpose) ? "" : narrativePurpose;
  const imagePromptInstructionsLine = req.imagePromptInstructions?.trim()
    ? `User image instructions: ${req.imagePromptInstructions.trim().replace(/\s+/g, " ").slice(0, 1200)}`
    : "";
  const sceneIllustrationVars = {
    sceneTitleLine: sceneTitle ? `${sceneTitle}.` : "",
    scenePrompt: req.prompt,
    narrativePurposeLine: meaningfulNarrativePurpose ? `Narrative purpose: ${meaningfulNarrativePurpose}.` : "",
    charactersLine: req.characters?.length ? `Characters: ${req.characters.join(", ")}.` : "",
    referenceHandlingLine: req.referenceImages?.length
      ? "Reference handling: attached character reference images are available. Use them to match faces, hair, build, colors, and distinctive features for the referenced characters."
      : "",
    appearanceNotesBlock: req.characterDescriptions?.length
      ? `Appearance notes for visible characters without an attached reference image:\n- ${req.characterDescriptions.join("\n- ")}`
      : "",
    artDirectionLine: styleHint ? `Art direction: ${styleHint}.` : "",
    imagePromptInstructionsLine,
  };
  const rawIllustrationPrompt = req.promptOverridesStorage
    ? await loadPrompt(req.promptOverridesStorage, GAME_SCENE_ILLUSTRATION, sceneIllustrationVars)
    : GAME_SCENE_ILLUSTRATION.defaultBuilder(sceneIllustrationVars);
  const finalPrompt =
    imagePromptInstructionsLine && !rawIllustrationPrompt.includes(imagePromptInstructionsLine)
      ? `${rawIllustrationPrompt}\n${imagePromptInstructionsLine}`
      : rawIllustrationPrompt;
  return finalPrompt;
}

function sceneIllustrationContextTitle(req: SceneIllustrationGenRequest): string {
  const explicitTitle = cleanSceneIllustrationContext(req.title);
  if (explicitTitle) return explicitTitle;

  const visualReason = cleanSceneIllustrationContext(req.reason);
  if (visualReason && hasSceneSubjectCue(visualReason)) return visualReason;

  const slugTitle = cleanSceneIllustrationContext(req.slug?.replace(/[-_]+/g, " "));
  return slugTitle && hasSceneSubjectCue(slugTitle) ? slugTitle : "";
}

function cleanSceneIllustrationContext(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\b(?:major character moment|key emotional moment|major reveal|dramatic action scene|important scene|scene moment|narrative purpose)\s*[-:]\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 180);
}

function hasSceneSubjectCue(value: string): boolean {
  return /\b(?:seeing|watching|looking|facing|meeting|holding|reaching|standing|kneeling|falling|fighting|duel|kiss|confession|reveal|transformation|mirror|uniform|door|character|protagonist|player|npc|self|room|hall|chamber|courtyard|battle|boss|monster|creature|arrival|entrance)\b/i.test(value);
}

function isGenericSceneMomentLabel(value: string): boolean {
  return /^(?:major character moment|key emotional moment|major reveal|dramatic action scene|important scene|scene moment)$/i.test(
    value,
  );
}

export async function buildSceneIllustrationProviderPrompt(
  req: SceneIllustrationGenRequest,
): Promise<CompiledGameImagePrompt> {
  if (req.promptOverride?.trim()) {
    return {
      prompt: req.promptOverride.trim(),
      negativePrompt: req.negativePromptOverride?.trim() || "",
    };
  }
  return compileGameImagePrompt(
    req,
    "illustration",
    await buildSceneIllustrationRawPrompt(req),
    2200,
    GAME_ILLUSTRATION_NEGATIVE_PROMPT,
  );
}

export async function buildSceneIllustrationImagePrompt(req: SceneIllustrationGenRequest): Promise<string> {
  return (await buildSceneIllustrationProviderPrompt(req)).prompt;
}

/**
 * Generate a background image for a game location and add it to the
 * asset manifest. Returns the asset tag on success, or null on failure.
 */
export async function generateBackground(req: BackgroundGenRequest): Promise<string | null> {
  const slug = safeGeneratedAssetSlug(req.locationSlug);
  if (!slug) return null;

  const subcategory = genreToFolder(req.genre);
  const targetDir = join(GAME_ASSETS_DIR, "backgrounds", subcategory);

  // Build asset tag: backgrounds:<category>:<slug>
  const tag = `backgrounds:${subcategory}:${slug}`;

  // Skip if already generated
  if (existingGeneratedBackgroundPath(targetDir, slug)) {
    return tag;
  }

  const compiled = await buildBackgroundProviderPrompt(req);
  const prompt = compiled.prompt;
  const size = resolvedSize(req.size, DEFAULT_GAME_BACKGROUND_SIZE);
  req.debugLog?.(
    "[debug/game/image-generation] background request slug=%s model=%s source=%s targetSize=%dx%d prompt:\n%s",
    slug,
    req.imgModel,
    req.imgSource || req.imgService || "",
    size.width,
    size.height,
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
        negativePrompt: compiled.negativePrompt || undefined,
        model: req.imgModel,
        width: size.width,
        height: size.height,
        imageEndpointId: req.imgEndpointId || undefined,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
        imageDefaults: req.imgDefaults ?? undefined,
      },
    );

    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const image = await gameBackgroundImage(result, size);
    const targetPath = generatedBackgroundPath(targetDir, slug, image.ext);
    writeFileSync(targetPath, image.buffer);

    // Rebuild manifest so the new tag is available immediately
    buildAssetManifest();

    logger.info('[game-asset-gen] Generated background "%s" -> tag: %s', slug, tag);
    req.debugLog?.(
      "[debug/game/image-generation] background result slug=%s bytes=%d tag=%s",
      slug,
      image.buffer.byteLength,
      tag,
    );
    return tag;
  } catch (err) {
    logger.warn(err, '[game-asset-gen] Failed to generate background "%s"', slug);
    return null;
  }
}

/**
 * Generate a reusable Roleplay chat background and save it into the normal
 * user backgrounds folder so the Background agent can select it on later turns.
 * Returns the saved filename on success, or null on failure.
 */
export async function generateChatBackground(req: ChatBackgroundGenRequest): Promise<string | null> {
  const baseSlug = safeGeneratedAssetSlug(req.locationSlug || req.sceneDescription.slice(0, 80), { maxBytes: 160 });
  if (!baseSlug) return null;

  const slug = `generated-${baseSlug}`;
  if (!existsSync(CHAT_BACKGROUND_DIR)) mkdirSync(CHAT_BACKGROUND_DIR, { recursive: true });

  const existingPath = existingGeneratedBackgroundPath(CHAT_BACKGROUND_DIR, slug);
  if (existingPath) return basename(existingPath);

  const compiled = await buildBackgroundProviderPrompt(req);
  const prompt = compiled.prompt;
  const size = resolvedSize(req.size, DEFAULT_GAME_BACKGROUND_SIZE);
  req.debugLog?.(
    "[debug/background-agent/image-generation] request slug=%s model=%s source=%s targetSize=%dx%d prompt:\n%s",
    slug,
    req.imgModel,
    req.imgSource || req.imgService || "",
    size.width,
    size.height,
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
        negativePrompt: compiled.negativePrompt || undefined,
        model: req.imgModel,
        width: size.width,
        height: size.height,
        imageEndpointId: req.imgEndpointId || undefined,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
        imageDefaults: req.imgDefaults ?? undefined,
      },
    );

    const image = await gameBackgroundImage(result, size);
    const filename = `${slug}.${image.ext}`;
    writeFileSync(join(CHAT_BACKGROUND_DIR, filename), image.buffer);

    const meta = readChatBackgroundMeta();
    meta[filename] = {
      originalName: `Generated: ${req.locationSlug || baseSlug}`,
      tags: chatBackgroundTags(req, baseSlug),
    };
    writeChatBackgroundMeta(meta);

    buildAssetManifest();
    logger.info('[background-agent] Generated roleplay background "%s"', filename);
    req.debugLog?.(
      "[debug/background-agent/image-generation] result slug=%s bytes=%d filename=%s",
      slug,
      image.buffer.byteLength,
      filename,
    );
    return filename;
  } catch (err) {
    logger.warn(err, '[background-agent] Failed to generate roleplay background "%s"', slug);
    return null;
  }
}

export async function generateSceneIllustration(req: SceneIllustrationGenRequest): Promise<string | null> {
  const slug = safeGeneratedAssetSlug(req.slug || req.reason || req.prompt.slice(0, 80) || "scene-illustration", {
    suffix: Date.now().toString(36),
  });
  const targetDir = join(GAME_ASSETS_DIR, "backgrounds", "illustrations");
  const tag = `backgrounds:illustrations:${slug}`;

  const compiled = await buildSceneIllustrationProviderPrompt(req);
  const prompt = compiled.prompt;
  const size = resolvedSize(req.size, DEFAULT_GAME_BACKGROUND_SIZE);
  req.debugLog?.(
    "[debug/game/image-generation] scene illustration request slug=%s model=%s source=%s targetSize=%dx%d refs=%d prompt:\n%s",
    slug,
    req.imgModel,
    req.imgSource || req.imgService || "",
    size.width,
    size.height,
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
        negativePrompt: compiled.negativePrompt || undefined,
        model: req.imgModel,
        width: size.width,
        height: size.height,
        imageEndpointId: req.imgEndpointId || undefined,
        comfyWorkflow: req.imgComfyWorkflow || undefined,
        imageDefaults: req.imgDefaults ?? undefined,
        referenceImages: req.referenceImages?.length ? req.referenceImages.slice(0, 4) : undefined,
      },
    );

    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const image = await gameBackgroundImage(result, size);
    const targetPath = generatedBackgroundPath(targetDir, slug, image.ext);
    writeFileSync(targetPath, image.buffer);
    buildAssetManifest();

    logger.info('[game-asset-gen] Generated scene illustration "%s" -> tag: %s', slug, tag);
    req.debugLog?.(
      "[debug/game/image-generation] scene illustration result slug=%s bytes=%d tag=%s",
      slug,
      image.buffer.byteLength,
      tag,
    );
    return tag;
  } catch (err) {
    logger.warn(err, '[game-asset-gen] Failed to generate scene illustration "%s"', slug);
    return null;
  }
}
