// ──────────────────────────────────────────────
// Avatar generation: what both generators share (lane: generation)
// ──────────────────────────────────────────────
// The owner's name, appearance and sprites; the 2D Avatars agent's prompt templates and connection;
// the image request that edits a sprite; and the one-job-per-avatar guard. Card text is untrusted:
// it reaches a prompt only as one capped line inside a template variable, never as instructions.
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  AVATAR_2D_AGENT_ID,
  AVATAR_PROMPT_TEMPLATE_IDS,
  AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY,
  AVATAR_PROMPT_TEMPLATE_VARIABLES,
  LOCAL_SIDECAR_CONNECTION_ID,
  isChatProvider,
  isOpenAIGptImageModel,
  mergeBuiltInAgentSettings,
  normalizeAgentPromptTemplateOptions,
  readImageAppearanceOverride,
  supportsOpenAIImageCustomSize,
  type AvatarOwnerRef,
  type AvatarPromptTemplateId,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import type { DB } from "../../../db/connection.js";
import { logDebugOverride } from "../../../lib/logger.js";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../../../utils/security.js";
import { resolveImageConnectionFallback } from "../../generation/media-connection-fallback.js";
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
} from "../../image/image-generation-defaults.js";
import {
  IMAGE_EDIT_UNSUPPORTED_MESSAGE,
  generateImage,
  imageConnectionTakesReferencePicture,
} from "../../image/image-generation.js";
import { renderTemplate } from "../../prompt-overrides/template.js";
import { getSharp } from "../../image/sharp-runtime.js";
import { createAgentsStorage } from "../../storage/agents.storage.js";
import { createCharactersStorage } from "../../storage/characters.storage.js";
import { createConnectionsStorage } from "../../storage/connections.storage.js";

/** A refusal with the HTTP status the route answers and a message plain enough to show the user. */
export class AvatarGenerationError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AvatarGenerationError";
    this.statusCode = statusCode;
  }
}

/** A provider or library error as short plain text for the person who asked (an HTML error page
 *  becomes its words, never markup). */
export function plainErrorText(error: unknown, fallback: string): string {
  const text = String(error instanceof Error ? error.message : error)
    .replace(/<[^>]*>/gu, " ")
    .replace(/[<>]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 300);
  return text || fallback;
}

export function avatarGenerationDebug(debugMode: boolean | undefined): boolean {
  return debugMode === true || isDebugAgentsEnabled();
}

// ── Card text ──

const MAX_NAME_CHARS = 120;
const MAX_APPEARANCE_CHARS = 1500;

/** One line of card text, without control characters, capped. A card cannot open a new paragraph of
 *  instructions inside a prompt this way, and a long card cannot crowd out the template. */
export function cardTextForPrompt(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, maxChars)
      .trim()
  );
}

export interface AvatarOwnerInfo {
  name: string;
  appearance: string;
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return parseRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The owner's name and the appearance text image prompts use (its image override when that is on). */
export async function readAvatarOwnerInfo(db: DB, owner: AvatarOwnerRef): Promise<AvatarOwnerInfo> {
  const storage = createCharactersStorage(db);
  if (owner.ownerType === "persona") {
    const persona = await storage.getPersona(owner.ownerId);
    if (!persona) throw new AvatarGenerationError(404, "That persona no longer exists.");
    const appearance = readImageAppearanceOverride(
      { imageAppearanceEnabled: persona.imageAppearanceEnabled === "true", imageAppearance: persona.imageAppearance },
      persona.appearance || persona.description,
    );
    return {
      name: cardTextForPrompt(persona.name, MAX_NAME_CHARS),
      appearance: cardTextForPrompt(appearance, MAX_APPEARANCE_CHARS),
    };
  }
  const character = await storage.getById(owner.ownerId);
  if (!character) throw new AvatarGenerationError(404, "That character no longer exists.");
  const data = parseRecord(character.data);
  const extensions = parseRecord(data.extensions);
  const appearance = readImageAppearanceOverride(
    extensions,
    text(extensions.appearance) || text(data.appearance) || text(data.description),
  );
  return {
    name: cardTextForPrompt(data.name, MAX_NAME_CHARS),
    appearance: cardTextForPrompt(appearance, MAX_APPEARANCE_CHARS),
  };
}

// ── Sprites ──

const SPRITES_ROOT = join(DATA_DIR, "sprites");
/** Raster sprites only: an SVG sprite can't be sent to an image model as a picture. */
const SPRITE_SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);
/** Every sprite the sprite editor lists (SPRITE_FILE_RE in routes/sprites.routes.ts). */
const SPRITE_EXTENSIONS = new Set([...SPRITE_SOURCE_EXTENSIONS, ".svg"]);

export interface AvatarSourceSprite {
  /** The sprite's file name without its extension, as the sprite editor shows it. */
  label: string;
  /** The sprite as PNG, first frame for animated sprites. */
  png: Buffer;
  width: number;
  height: number;
  /** Whether the sprite has see-through pixels (a cut-out). */
  transparent: boolean;
  /** SHA-256 of the sprite file, so a save can tell the sprite was replaced after its pictures were made. */
  hash: string;
}

/** Sprite labels of an owner, sorted: the ones that can be edited (raster files), or with `all` every
 *  sprite, SVG ones too. */
export function listAvatarSourceSprites(ownerId: string, { all = false } = {}): string[] {
  const dir = assertInsideDir(SPRITES_ROOT, join(SPRITES_ROOT, ownerId));
  if (!existsSync(dir)) return [];
  const extensions = all ? SPRITE_EXTENSIONS : SPRITE_SOURCE_EXTENSIONS;
  return readdirSync(dir)
    .filter((name) => extensions.has(extname(name).toLowerCase()))
    .map((name) => name.slice(0, -extname(name).length))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/** Path of the owner's raster sprite with this exact label, or null. */
export function findAvatarSpriteFile(ownerId: string, label: string): string | null {
  const dir = assertInsideDir(SPRITES_ROOT, join(SPRITES_ROOT, ownerId));
  const filename = existsSync(dir)
    ? readdirSync(dir).find(
        (name) =>
          SPRITE_SOURCE_EXTENSIONS.has(extname(name).toLowerCase()) && name.slice(0, -extname(name).length) === label,
      )
    : undefined;
  return filename ? assertInsideDir(dir, join(dir, filename)) : null;
}

/** Decodes a sprite file to PNG, first frame for animated sprites. */
export async function decodeAvatarSourceSprite(label: string, bytes: Buffer): Promise<AvatarSourceSprite> {
  if (!isAllowedImageBuffer(bytes)) {
    throw new AvatarGenerationError(422, `The sprite "${label}" is not a picture the image model can read.`);
  }
  const sharp = await getSharp();
  const { data, info } = await sharp(bytes, { animated: false }).png().toBuffer({ resolveWithObject: true });
  const stats = await sharp(data).stats();
  return {
    label,
    png: data,
    width: info.width,
    height: info.height,
    transparent: !stats.isOpaque,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Reads one of the owner's sprites by its exact label and decodes it to PNG. */
export async function readAvatarSourceSprite(ownerId: string, label: string): Promise<AvatarSourceSprite> {
  const file = findAvatarSpriteFile(ownerId, label);
  if (!file) throw new AvatarGenerationError(404, `The sprite "${label}" was not found.`);
  return decodeAvatarSourceSprite(label, await readFile(file));
}

// ── The 2D Avatars agent: templates and connection ──

/** Used only when the 2D Avatars package ships no template for an id (for example, the package is
 *  older than the Engine). The package's own templates are the real prompts; these stay minimal. */
const ENGINE_FALLBACK_TEMPLATES: Readonly<Record<AvatarPromptTemplateId, string>> = Object.freeze({
  [AVATAR_PROMPT_TEMPLATE_IDS.pngtuberEyesClosed]:
    "Edit this picture of ${characterName}: close both eyes naturally and change nothing else. Keep the pose, framing, size, colours, art style and background exactly the same.",
  [AVATAR_PROMPT_TEMPLATE_IDS.pngtuberMouthOpen]:
    'Edit this picture of ${characterName}: open the mouth as if saying "ah" and change nothing else. Keep the pose, framing, size, colours, art style and background exactly the same.',
  [AVATAR_PROMPT_TEMPLATE_IDS.meshRigLayout]:
    "Find the face parts of ${characterName} in this ${imageWidth}x${imageHeight} pixel picture. Answer with JSON only, in this shape:\n${layoutSchema}",
});

export interface AvatarAgentSettings {
  /** The 2D Avatars agent's own connection, when one is chosen in the Agent editor. */
  connectionId: string | null;
  template(id: AvatarPromptTemplateId): string;
}

export async function readAvatarAgentSettings(db: DB): Promise<AvatarAgentSettings> {
  const agent = await createAgentsStorage(db).getByType(AVATAR_2D_AGENT_ID);
  const settings = mergeBuiltInAgentSettings(AVATAR_2D_AGENT_ID, agent?.settings);
  const templates = normalizeAgentPromptTemplateOptions(settings[AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY]);
  return {
    connectionId: typeof agent?.connectionId === "string" && agent.connectionId ? agent.connectionId : null,
    template: (id) =>
      templates.find((entry) => entry.id === id)?.promptTemplate.trim() || ENGINE_FALLBACK_TEMPLATES[id],
  };
}

export function renderAvatarPromptTemplate(
  template: string,
  id: AvatarPromptTemplateId,
  vars: Record<string, string | number>,
): string {
  return renderTemplate(template, vars, AVATAR_PROMPT_TEMPLATE_VARIABLES[id]).trim();
}

function isLanguageConnection(conn: { provider: string } | null): boolean {
  return !!conn && isChatProvider(conn.provider);
}

/** The chat connection that reads the sprite: the one chosen for this run, else the 2D Avatars agent's
 *  own, else the default agent connection, else the default connection. */
export async function resolveAvatarVisionConnection(
  db: DB,
  requestedId: string | null | undefined,
  agentConnectionId: string | null,
) {
  const connections = createConnectionsStorage(db);
  const refuse = () => new AvatarGenerationError(400, "Choose a chat connection whose model can look at pictures.");
  if (requestedId) {
    const conn = requestedId === LOCAL_SIDECAR_CONNECTION_ID ? null : await connections.getWithKey(requestedId);
    if (!conn || !isLanguageConnection(conn)) throw refuse();
    return conn;
  }
  if (agentConnectionId && agentConnectionId !== LOCAL_SIDECAR_CONNECTION_ID) {
    const conn = await connections.getWithKey(agentConnectionId);
    if (conn && isLanguageConnection(conn)) return conn;
  }
  const agentDefault = await connections.getDefaultForAgents();
  if (agentDefault && isLanguageConnection(agentDefault)) return agentDefault;
  const fallback = await connections.getDefault();
  const conn = fallback && isLanguageConnection(fallback) ? await connections.getWithKey(fallback.id) : null;
  if (!conn) throw refuse();
  return conn;
}

// ── Image requests ──

export interface AvatarImageConnection {
  conn: NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;
  fallback: Awaited<ReturnType<typeof resolveImageConnectionFallback>>;
}

export async function resolveAvatarImageConnection(
  db: DB,
  requestedId: string | null | undefined,
): Promise<AvatarImageConnection> {
  const connections = createConnectionsStorage(db);
  const conn = requestedId
    ? await connections.getWithKey(requestedId)
    : await connections.getDefaultForImageGeneration();
  if (!conn) {
    throw new AvatarGenerationError(
      400,
      "Choose an image generation connection, or mark one as the default image connection.",
    );
  }
  if (conn.provider !== "image_generation") {
    throw new AvatarGenerationError(
      400,
      "That connection doesn't make pictures. Choose an image generation connection.",
    );
  }
  // Every avatar picture is an edit of a sprite; a connection that drops the sprite would draw a new one.
  if (!imageConnectionTakesReferencePicture(avatarImageService(conn))) {
    throw new AvatarGenerationError(400, IMAGE_EDIT_UNSUPPORTED_MESSAGE);
  }
  return { conn, fallback: await resolveImageConnectionFallback(connections, conn.id) };
}

/** The service an avatar picture is asked of, as generateImage receives it. */
function avatarImageService(conn: AvatarImageConnection["conn"]) {
  const model = conn.model || "";
  const source = (conn as { imageGenerationSource?: string | null }).imageGenerationSource || model;
  return {
    source,
    baseUrl: conn.baseUrl || "https://image.pollinations.ai",
    serviceHint: conn.imageService || source,
    model,
    comfyWorkflow: conn.comfyuiWorkflow || undefined,
  };
}

/** The size to ask the provider for: the sprite's own shape, within what the model accepts. */
export function avatarImageRequestSize(
  width: number,
  height: number,
  model: string,
): { width: number; height: number } {
  if (isOpenAIGptImageModel(model)) {
    const ratio = width / Math.max(1, height);
    if (!supportsOpenAIImageCustomSize(model)) {
      return ratio > 1.12
        ? { width: 1536, height: 1024 }
        : ratio < 0.88
          ? { width: 1024, height: 1536 }
          : { width: 1024, height: 1024 };
    }
    // GPT Image 2 and 2.5 keep a size of at least 1024x1024 pixels in steps of 32 with sides at most 3:1
    // (openAIGptImage2Size / openAIGptImage25Size in services/image/image-generation.ts). A size they
    // would change gives a canvas of another shape than the one the sprite was placed on.
    const clamped = Math.min(3, Math.max(1 / 3, ratio));
    const side = (value: number) => Math.ceil(Math.sqrt(1024 * 1024 * value) / 32) * 32;
    return { width: side(clamped), height: side(1 / clamped) };
  }
  const scale = Math.min(1, 1536 / Math.max(width, height));
  const round = (value: number) => Math.max(512, Math.round((value * scale) / 64) * 64);
  return { width: round(width), height: round(height) };
}

export interface AvatarImageEditRequest {
  image: AvatarImageConnection;
  prompt: string;
  negativePrompt?: string;
  /** The sprite the picture is drawn from; a see-through sprite gives the picture its outline. */
  source: AvatarSourceSprite;
  signal?: AbortSignal;
  debug: boolean;
  /** Short name for the debug log, e.g. "pngtuber happy eyes-closed". */
  logLabel: string;
}

/** Where the sprite sits on a canvas of another shape: scaled to fit and centred, never stretched. */
export function avatarCanvasPlacement(
  source: { width: number; height: number },
  canvas: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = Math.max(1, Math.min(canvas.width, Math.round(source.width * scale)));
  const height = Math.max(1, Math.min(canvas.height, Math.round(source.height * scale)));
  return { left: Math.floor((canvas.width - width) / 2), top: Math.floor((canvas.height - height) / 2), width, height };
}

/** Edits a sprite through the image connection (with its fallback) and returns a PNG of exactly the
 *  sprite's size. The provider gets only the sprite, already on a canvas of the size it is asked for (a
 *  cut-out on white, an opaque sprite with repeated edges), so an edit that keeps the picture where it is
 *  comes back lined up with the sprite whatever canvas shapes the model accepts. No see-through background
 *  is asked for: some models can't make one (GPT Image 2), and a cut-out gets the sprite's own outline back. */
export async function drawAvatarImageEdit(request: AvatarImageEditRequest): Promise<Buffer> {
  const { conn, fallback } = request.image;
  const service = avatarImageService(conn);
  const { model } = service;
  const size = avatarImageRequestSize(request.source.width, request.source.height, model);
  const place = avatarCanvasPlacement(request.source, size);
  const sharp = await getSharp();
  const placed = await sharp(request.source.png)
    .resize(place.width, place.height, { fit: "fill" })
    .extend({
      top: place.top,
      bottom: size.height - place.height - place.top,
      left: place.left,
      right: size.width - place.width - place.left,
      ...(request.source.transparent
        ? { background: { r: 0, g: 0, b: 0, alpha: 0 } }
        : { extendWith: "copy" as const }),
    })
    .png()
    .toBuffer();
  // A cut-out goes on plain white: providers read its see-through pixels as black, which hides dark
  // clothes and hair and gets the whole picture redrawn. Only the mostly see-through pixels turn white;
  // the others keep their own colour, since blending a soft inside pixel with white would come back
  // lighter than the face it swaps with. Its own outline is put back afterwards.
  // ponytail: white hides a very pale outline the same way; pick the backdrop from the sprite's colours if
  // that shows up.
  let reference = placed;
  if (request.source.transparent) {
    const { data, info } = await sharp(placed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let index = 0; index < data.length; index += 4) if (data[index + 3]! < 128) data.fill(255, index, index + 3);
    reference = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .removeAlpha()
      .png()
      .toBuffer();
  }
  logDebugOverride(
    request.debug,
    "[debug/avatar-generation] %s image prompt (%dx%d):\n%s\nnegative: %s",
    request.logLabel,
    size.width,
    size.height,
    request.prompt,
    request.negativePrompt ?? "",
  );
  const result = await generateImage(service.source, service.baseUrl, conn.apiKey || "", service.serviceHint, {
    prompt: request.prompt,
    negativePrompt: request.negativePrompt || undefined,
    model,
    width: size.width,
    height: size.height,
    referenceImage: reference.toString("base64"),
    referenceIsCanvas: true,
    imageEndpointId: conn.imageEndpointId || undefined,
    comfyWorkflow: service.comfyWorkflow,
    imageDefaults: resolveConnectionImageDefaults(conn),
    quality: resolveConnectionImageQuality(conn),
    fallback,
    signal: request.signal,
    debugMode: request.debug,
  });
  return fitAvatarImageToSource(Buffer.from(result.base64, "base64"), request.source, size);
}

/** Cuts the sprite's place back out of a drawn picture (`canvas` is the size it was asked for; a picture
 *  of another size is read in proportion), scales it to the sprite's exact size, and gives it the
 *  sprite's outline when the sprite is a cut-out (applyAvatarSourceOutline). */
export async function fitAvatarImageToSource(
  drawn: Buffer,
  source: AvatarSourceSprite,
  canvas: { width: number; height: number } = source,
): Promise<Buffer> {
  if (!isAllowedImageBuffer(drawn))
    throw new AvatarGenerationError(502, "The image model sent back something that isn't a picture.");
  const sharp = await getSharp();
  const { data: picture, info } = await sharp(drawn, { animated: false }).png().toBuffer({ resolveWithObject: true });
  const place = avatarCanvasPlacement(source, canvas);
  const fx = info.width / canvas.width;
  const fy = info.height / canvas.height;
  const left = Math.min(info.width - 1, Math.round(place.left * fx));
  const top = Math.min(info.height - 1, Math.round(place.top * fy));
  const fitted = await sharp(picture)
    .extract({
      left,
      top,
      width: Math.max(1, Math.min(info.width - left, Math.round(place.width * fx))),
      height: Math.max(1, Math.min(info.height - top, Math.round(place.height * fy))),
    })
    .resize(source.width, source.height, { fit: "fill" })
    .ensureAlpha()
    .png()
    .toBuffer();
  return source.transparent ? applyAvatarSourceOutline(fitted, source) : fitted;
}

/** A picture drawn from a cut-out sprite, with exactly the sprite's outline: the picture is laid over the
 *  sprite (so a see-through spot the model left shows the sprite) and takes the sprite's alpha. Along the
 *  outline (avatarOutlineBand) the sprite's own pixels stay, colour and all: the model drew them mixed with
 *  whatever background it painted, which would show as a lighter or darker rim. So a blink or talk picture
 *  never shows a background, a halo or another edge than the face it swaps with. */
export async function applyAvatarSourceOutline(picture: Buffer, source: AvatarSourceSprite): Promise<Buffer> {
  const sharp = await getSharp();
  const { width, height } = source;
  const sprite = await sharp(source.png).ensureAlpha().raw().toBuffer();
  const layered = await sharp(source.png)
    .ensureAlpha()
    .composite([{ input: picture }])
    .png()
    .toBuffer();
  const drawn = await sharp(layered).ensureAlpha().raw().toBuffer();
  const band = avatarOutlineBand(sprite, width, height);
  for (let pixel = 0; pixel < band.length; pixel += 1) {
    if (!band[pixel]) drawn.copy(sprite, pixel * 4, pixel * 4, pixel * 4 + 3);
  }
  return sharp(sprite, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/** The pixels along a cut-out's outline (1) and inside it (0), from RGBA pixels: those within a few pixels
 *  of a pixel that is less than half covered. Not every pixel short of solid: the AI remover's mask leaves
 *  many inside the face (over the eyes too), and those must take the drawn picture. The band widens with
 *  the picture because that mask is made at 320 pixels and scaled up, so its soft edge widens too. */
function avatarOutlineBand(rgba: Buffer, width: number, height: number): Uint8Array {
  const reach = Math.max(4, Math.ceil(Math.max(width, height) / 160));
  const far = reach + 1;
  // Chessboard distance to the nearest mostly see-through pixel, counted up to `far`, in two passes.
  const distance = new Uint16Array(width * height);
  for (let pixel = 0; pixel < distance.length; pixel += 1) distance[pixel] = rgba[pixel * 4 + 3]! < 128 ? 0 : far;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? far : distance[y * width + x]!);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const before = Math.min(at(x - 1, y), at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1));
      distance[pixel] = Math.min(distance[pixel]!, before + 1);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const pixel = y * width + x;
      const after = Math.min(at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1));
      distance[pixel] = Math.min(distance[pixel]!, after + 1);
    }
  }
  return Uint8Array.from(distance, (value) => (value <= reach ? 1 : 0));
}

// ── One job per avatar ──

/** The running job of each avatar and kind, by `ownerType:ownerId:kind`. */
const runningJobs = new Map<string, AbortController>();

function avatarJobKey(owner: AvatarOwnerRef, kind: string): string {
  return `${owner.ownerType}:${owner.ownerId}:${kind}`;
}

/** Stops a running job: its provider requests are aborted through its signal, and the avatar is free for a
 *  new job at once, even while the old one is still unwinding (it stores nothing, so it can't clash). */
function stopAvatarJob(key: string, controller: AbortController, reason: unknown) {
  if (runningJobs.get(key) === controller) runningJobs.delete(key);
  controller.abort(reason);
}

/** Runs `job` unless the same avatar job is already running, so a double click starts nothing twice. The
 *  job's signal is aborted by `signal` (the request's connection closing) and by cancelAvatarGenerationJob
 *  (the Cancel button), whichever comes first. */
export async function withAvatarGenerationJob<T>(
  owner: AvatarOwnerRef,
  kind: string,
  job: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const key = avatarJobKey(owner, kind);
  if (runningJobs.has(key)) {
    throw new AvatarGenerationError(409, "This avatar is already being made. Wait for it to finish, or cancel it.");
  }
  const controller = new AbortController();
  const onAbort = () => stopAvatarJob(key, controller, signal?.reason);
  runningJobs.set(key, controller);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await job(controller.signal);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (runningJobs.get(key) === controller) runningJobs.delete(key);
  }
}

/** Cancels the avatar's running job of this kind. False when none is running. The Cancel button calls this
 *  as well as closing its request, since a proxy between the browser and the server can keep the server's
 *  side of a closed request open. */
export function cancelAvatarGenerationJob(owner: AvatarOwnerRef, kind: string): boolean {
  const key = avatarJobKey(owner, kind);
  const controller = runningJobs.get(key);
  if (!controller) return false;
  stopAvatarJob(key, controller, new DOMException("The request was cancelled.", "AbortError"));
  return true;
}
