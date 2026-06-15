// ──────────────────────────────────────────────
// Professor Mari image command service
// ──────────────────────────────────────────────
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { inferImageSource, type ImagePromptKind } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { flushDB } from "../../db/connection.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId, now } from "../../utils/id-generator.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../../utils/security.js";
import { generateImage, type ImageGenResult } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { compileImagePrompt } from "../image/image-prompt-compiler.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { createGalleryStorage } from "../storage/gallery.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { buildAssetManifest } from "../game/asset-manifest.service.js";
import type { MariDbCommandResult } from "@marinara-engine/shared";

type Json = Record<string, unknown>;

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string | boolean>;
};

type ImageCommandContext = {
  command: string;
  sessionId: string;
  cwd?: string;
};

type ImageConnection = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  defaultForAgents?: string | boolean | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  imageEndpointId?: string | null;
  comfyuiWorkflow?: string | null;
} & Record<string, unknown>;

type ImageCapability = {
  source: string;
  serviceHint: string;
  canGenerate: boolean;
  canEdit: boolean;
  editMode: "none" | "image-to-image" | "reference" | "workflow" | "model-dependent";
  maskEditing: boolean;
  notes: string[];
};

type MariImageAsset = {
  id: string;
  filename: string;
  filePath: string;
  url: string;
  mimeType: string;
  ext: string;
  operation: "generate" | "edit";
  kind: ImagePromptKind;
  prompt: string;
  negativePrompt: string;
  width: number | null;
  height: number | null;
  connectionId: string;
  connectionName: string;
  provider: string;
  source: string;
  serviceHint: string;
  model: string;
  sourceImage?: string | null;
  createdAt: string;
};

type ResolvedImage = {
  label: string;
  buffer: Buffer;
  base64: string;
  mimeType: string;
  ext: string;
  url?: string;
  asset?: MariImageAsset;
};

type ImageTarget =
  | { type: "asset"; assetId?: string | null }
  | { type: "character-avatar"; characterId: string }
  | { type: "persona-avatar"; personaId: string }
  | { type: "lorebook-image"; lorebookId: string }
  | { type: "sprite"; ownerId: string; expression: string }
  | { type: "background"; filename?: string | null; name?: string | null; tags: string[] }
  | { type: "chat-gallery"; chatId: string; imageId?: string | null }
  | { type: "character-gallery"; characterId: string; imageId?: string | null };

const BOOLEAN_FLAGS = new Set(["apply", "help", "edit", "generate", "json", "delete-file", "force"]);
const PREVIEW_CHAT_ID = "mari-images";
const GALLERY_DIR = join(DATA_DIR, "gallery");
const PREVIEW_DIR = join(GALLERY_DIR, PREVIEW_CHAT_ID);
const PREVIEW_MANIFEST_PATH = join(PREVIEW_DIR, "manifest.json");
const AVATAR_DIR = join(DATA_DIR, "avatars");
const LOREBOOK_IMAGE_DIR = join(DATA_DIR, "lorebooks", "images");
const SPRITES_DIR = join(DATA_DIR, "sprites");
const BACKGROUND_DIR = join(DATA_DIR, "backgrounds");
const BACKGROUND_META_PATH = join(BACKGROUND_DIR, "meta.json");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 2) {
      flags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name)) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }
  return { positionals, flags };
}

function flagString(flags: Map<string, string | boolean>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = flags.get(name);
    if (typeof value === "string") return value;
  }
  return undefined;
}

function hasFlag(flags: Map<string, string | boolean>, name: string): boolean {
  return flags.has(name) && flags.get(name) !== false;
}

function flagNumber(flags: Map<string, string | boolean>, name: string, fallback?: number): number | undefined {
  const raw = flagString(flags, name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function normalizeId(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function sanitizeFilenamePart(value: string, fallback: string) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s_-]+|[.\s_-]+$/g, "");
  return sanitized || fallback;
}

function uniqueFilename(dir: string, desired: string) {
  const ext = extname(desired);
  const base = basename(desired, ext);
  let candidate = desired;
  let counter = 2;
  while (existsSync(join(dir, candidate))) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }
  return candidate;
}

function normalizeSpriteExpression(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, ""))
        .filter(Boolean),
    ),
  ];
}

function detectImageKind(target: ImageTarget | null, explicit?: string): ImagePromptKind {
  const raw = explicit?.trim() as ImagePromptKind | undefined;
  if (raw && ["portrait", "selfie", "background", "illustration", "sprite", "avatar"].includes(raw)) return raw;
  switch (target?.type) {
    case "character-avatar":
    case "persona-avatar":
      return "avatar";
    case "sprite":
      return "sprite";
    case "background":
      return "background";
    default:
      return "illustration";
  }
}

function isOpenAIGptImageModel(model?: string) {
  return !!model && /^gpt-image-(?:1|1\.5|2)(?:$|-)/i.test(model.trim());
}

function isStabilityV1Base(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.includes("v1") && !parts.includes("v2beta");
  } catch {
    return /\/v1(?:\/|$)/i.test(baseUrl) && !/\/v2beta(?:\/|$)/i.test(baseUrl);
  }
}

function comfyWorkflowHasReferenceInput(workflow: string | null | undefined) {
  return !!workflow && /%reference_image(?:_name)?(?:_\d{2})?%/.test(workflow);
}

function resolveImageSource(conn: ImageConnection) {
  const baseUrl = conn.baseUrl || "";
  const model = conn.model || "";
  const inferred = inferImageSource(conn.imageGenerationSource || model, baseUrl);
  const explicit = (conn.imageService || "").trim().toLowerCase();
  if (explicit === "drawthings") return "automatic1111";
  return explicit || inferred;
}

function capabilityForConnection(conn: ImageConnection): ImageCapability {
  const source = resolveImageSource(conn);
  const serviceHint = (conn.imageService || conn.imageGenerationSource || conn.model || source || "").trim();
  const model = (conn.model || "").toLowerCase();
  const notes: string[] = [];
  let canEdit = false;
  let editMode: ImageCapability["editMode"] = "none";
  let maskEditing = false;

  switch (source) {
    case "openai":
      canEdit = isOpenAIGptImageModel(conn.model);
      editMode = canEdit ? "image-to-image" : "none";
      if (canEdit) notes.push("OpenAI GPT Image mask/inpaint exists at the provider level, but mari images currently exposes whole-image/reference editing only.");
      if (!canEdit) notes.push("Current Marinara OpenAI edit path requires a GPT Image model such as gpt-image-1 or gpt-image-2.");
      break;
    case "gemini_image":
      canEdit = true;
      editMode = "image-to-image";
      notes.push("Uses text+image image output through chat-completions style payloads.");
      break;
    case "openrouter":
      canEdit = /(?:gemini.*image|image.*gemini|nano.?banana|kontext)/i.test(model);
      editMode = canEdit ? "model-dependent" : "none";
      if (!canEdit) notes.push("OpenRouter image editing is model-dependent; use a Gemini image/Nano Banana/Flux Kontext style model.");
      break;
    case "nanogpt":
      canEdit = /(?:kontext|gpt-image|gemini|nano.?banana)/i.test(model);
      editMode = canEdit ? "model-dependent" : "none";
      if (!canEdit) notes.push("NanoGPT references are model-dependent; choose an edit/reference-capable model such as Flux Kontext or GPT Image.");
      break;
    case "stability":
      canEdit = !isStabilityV1Base(conn.baseUrl || "");
      editMode = canEdit ? "image-to-image" : "none";
      if (!canEdit) notes.push("Stability legacy v1 path in Marinara is generation-only; use the v2beta Stable Image API for image-to-image.");
      break;
    case "automatic1111":
      canEdit = true;
      editMode = "image-to-image";
      notes.push("Uses /sdapi/v1/img2img with the connection's denoising strength defaults.");
      break;
    case "comfyui":
    case "runpod_comfyui":
      canEdit = comfyWorkflowHasReferenceInput(conn.comfyuiWorkflow);
      editMode = canEdit ? "workflow" : "none";
      if (!canEdit) notes.push("ComfyUI editing requires a workflow containing %reference_image% or %reference_image_name% placeholders.");
      break;
    case "novelai":
      canEdit = /nai-diffusion-4/i.test(model);
      editMode = canEdit ? "reference" : "none";
      if (!canEdit) notes.push("NovelAI reference images are wired for V4/V4.5 models in Marinara.");
      break;
    case "xai":
      notes.push("The current xAI adapter rejects reference images, so edits are not available through this path yet.");
      break;
    case "pollinations":
    case "togetherai":
    case "horde":
    default:
      notes.push("This connection path is treated as generation-only by the current Marinara adapter.");
      break;
  }

  return {
    source,
    serviceHint,
    canGenerate: conn.provider === "image_generation",
    canEdit,
    editMode,
    maskEditing,
    notes,
  };
}

function publicConnection(conn: ImageConnection) {
  const capability = capabilityForConnection(conn);
  return {
    id: conn.id,
    name: conn.name,
    provider: conn.provider,
    model: conn.model || null,
    baseUrl: conn.baseUrl || null,
    defaultForAgents: asBoolean(conn.defaultForAgents),
    imageGenerationSource: conn.imageGenerationSource || null,
    imageService: conn.imageService || null,
    imageEndpointId: conn.imageEndpointId || null,
    capabilities: capability,
  };
}

function parseManifest(value: string): MariImageAsset[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is MariImageAsset => !!item && typeof item === "object" && typeof (item as Json).id === "string");
  } catch {
    return [];
  }
}

async function ensurePreviewDir() {
  await mkdir(PREVIEW_DIR, { recursive: true });
}

async function readManifest() {
  if (!existsSync(PREVIEW_MANIFEST_PATH)) return [] as MariImageAsset[];
  return parseManifest(await readFile(PREVIEW_MANIFEST_PATH, "utf8"));
}

async function writeManifest(assets: MariImageAsset[]) {
  await ensurePreviewDir();
  await writeFile(PREVIEW_MANIFEST_PATH, JSON.stringify(assets, null, 2), "utf8");
}

async function savePreviewAsset(args: {
  result: ImageGenResult;
  operation: "generate" | "edit";
  kind: ImagePromptKind;
  prompt: string;
  negativePrompt: string;
  width?: number;
  height?: number;
  connection: ImageConnection;
  capability: ImageCapability;
  sourceImage?: string | null;
}) {
  await ensurePreviewDir();
  const id = newId();
  const imageBuffer = Buffer.from(args.result.base64, "base64");
  const imageInfo = isAllowedImageBuffer(imageBuffer, `.${args.result.ext}`);
  if (!imageInfo) throw new Error("Generated image was not a supported image file");
  const ext = extensionFromImageMime(imageInfo.mimeType);
  const filename = `mari-${id}.${ext}`;
  const outputPath = assertInsideDir(PREVIEW_DIR, join(PREVIEW_DIR, filename));
  await writeFile(outputPath, imageBuffer);

  const asset: MariImageAsset = {
    id,
    filename,
    filePath: `${PREVIEW_CHAT_ID}/${filename}`,
    url: `/api/gallery/file/${encodeURIComponent(PREVIEW_CHAT_ID)}/${encodeURIComponent(filename)}`,
    mimeType: imageInfo.mimeType,
    ext,
    operation: args.operation,
    kind: args.kind,
    prompt: args.prompt,
    negativePrompt: args.negativePrompt,
    width: args.width ?? null,
    height: args.height ?? null,
    connectionId: args.connection.id,
    connectionName: args.connection.name,
    provider: args.connection.provider,
    source: args.capability.source,
    serviceHint: args.capability.serviceHint,
    model: args.connection.model || "",
    sourceImage: args.sourceImage ?? null,
    createdAt: now(),
  };
  const assets = await readManifest();
  await writeManifest([asset, ...assets].slice(0, 200));
  return asset;
}

async function readBackgroundMeta(): Promise<Record<string, { originalName?: string; tags: string[] }>> {
  if (!existsSync(BACKGROUND_META_PATH)) return {};
  try {
    return JSON.parse(await readFile(BACKGROUND_META_PATH, "utf8")) as Record<string, { originalName?: string; tags: string[] }>;
  } catch {
    return {};
  }
}

async function writeBackgroundMeta(meta: Record<string, { originalName?: string; tags: string[] }>) {
  await mkdir(BACKGROUND_DIR, { recursive: true });
  await writeFile(BACKGROUND_META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

function decodeDataImage(value: string): ResolvedImage | null {
  const match = value.match(/^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,([\s\S]+)$/i);
  if (!match) return null;
  const mimeType = match[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  const base64 = match[2]!.replace(/\s+/g, "");
  const buffer = Buffer.from(base64, "base64");
  const imageInfo = isAllowedImageBuffer(buffer, `.${extensionFromImageMime(mimeType)}`);
  if (!imageInfo) throw new Error("Unsupported or invalid data URL image");
  return { label: "data-url", buffer, base64, mimeType: imageInfo.mimeType, ext: imageInfo.ext };
}

async function imageFromFile(path: string, label: string): Promise<ResolvedImage> {
  const buffer = await readFile(path);
  const imageInfo = isAllowedImageBuffer(buffer, extname(path));
  if (!imageInfo) throw new Error(`Unsupported or invalid image file: ${label}`);
  return {
    label,
    buffer,
    base64: buffer.toString("base64"),
    mimeType: imageInfo.mimeType,
    ext: imageInfo.ext,
  };
}

function safeUrlPath(value: string) {
  try {
    return new URL(value, "http://mari.local").pathname;
  } catch {
    return value;
  }
}

function decodePathSegment(value: string | undefined) {
  return decodeURIComponent(value ?? "");
}

function appImagePathFromUrl(value: string): { path: string; label: string; url: string } | null {
  const pathname = safeUrlPath(value);
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return null;

  if (parts[1] === "gallery" && parts[2] === "file" && parts[3] && parts[4]) {
    const chatId = decodePathSegment(parts[3]);
    const filename = decodePathSegment(parts[4]);
    return { path: assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, chatId, filename)), label: `gallery:${chatId}/${filename}`, url: pathname };
  }
  if (parts[1] === "characters" && parts[3] === "gallery" && parts[4] === "file" && parts[2] && parts[5]) {
    const characterId = decodePathSegment(parts[2]);
    const filename = decodePathSegment(parts[5]);
    const root = join(GALLERY_DIR, "characters", characterId);
    return { path: assertInsideDir(root, join(root, filename)), label: `character-gallery:${characterId}/${filename}`, url: pathname };
  }
  if (parts[1] === "avatars" && parts[2] === "file" && parts[3]) {
    const filename = decodePathSegment(parts[3]);
    return { path: assertInsideDir(AVATAR_DIR, join(AVATAR_DIR, filename)), label: `avatar:${filename}`, url: pathname };
  }
  if (parts[1] === "lorebooks" && parts[2] === "images" && parts[3] === "file" && parts[4]) {
    const filename = decodePathSegment(parts[4]);
    return { path: assertInsideDir(LOREBOOK_IMAGE_DIR, join(LOREBOOK_IMAGE_DIR, filename)), label: `lorebook-image:${filename}`, url: pathname };
  }
  if (parts[1] === "backgrounds" && parts[2] === "file" && parts[3]) {
    const filename = decodePathSegment(parts[3]);
    return { path: assertInsideDir(BACKGROUND_DIR, join(BACKGROUND_DIR, filename)), label: `background:${filename}`, url: pathname };
  }
  if (parts[1] === "sprites" && parts[2] && parts[3] === "file" && parts[4]) {
    const ownerId = decodePathSegment(parts[2]);
    const filename = decodePathSegment(parts[4]);
    const root = join(SPRITES_DIR, ownerId);
    return { path: assertInsideDir(root, join(root, filename)), label: `sprite:${ownerId}/${filename}`, url: pathname };
  }

  return null;
}

export class MariImagesService {
  constructor(private readonly db: DB) {}

  async execute(args: string[], context: ImageCommandContext): Promise<MariDbCommandResult> {
    const sub = args[0];
    const parsed = parseArgs(args.slice(1));
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(parsed.flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.helpText() };
    }

    switch (sub) {
      case "connections":
      case "capabilities":
        return this.connections(context, parsed.flags);
      case "preview":
        return this.preview(context, parsed.flags);
      case "generate":
        return this.generateOrEdit("generate", context, parsed.flags);
      case "edit":
        return this.generateOrEdit("edit", context, parsed.flags);
      case "assign":
      case "add":
      case "replace":
        return this.assign(context, parsed.flags);
      case "delete":
      case "remove":
      case "clear":
        return this.delete(context, parsed.flags, parsed.positionals);
      case "list":
        return this.list(context, parsed.flags, parsed.positionals);
      case "get":
        return this.get(context, parsed.flags, parsed.positionals);
      default:
        return { ok: false, mode: "read", command: context.command, error: `Unknown mari images command: ${sub}\n${this.helpText()}` };
    }
  }

  private async imageConnections(): Promise<ImageConnection[]> {
    const rows = (await createConnectionsStorage(this.db).list()) as ImageConnection[];
    return rows.filter((row) => row.provider === "image_generation");
  }

  private async getConnection(selector: string | undefined, requireEdit: boolean): Promise<ImageConnection> {
    const connections = await this.imageConnections();
    if (connections.length === 0) throw new Error("No image_generation connections are configured. Add an image model in Settings → Connections first.");

    const normalized = selector?.trim();
    const candidates = requireEdit ? connections.filter((conn) => capabilityForConnection(conn).canEdit) : connections;
    if (normalized && normalized !== "default") {
      const selected = connections.find((conn) => conn.id === normalized || conn.name.toLowerCase() === normalized.toLowerCase());
      if (!selected) throw new Error(`Image generation connection not found: ${normalized}`);
      const capability = capabilityForConnection(selected);
      if (requireEdit && !capability.canEdit) {
        throw new Error(
          `Connection "${selected.name}" is not edit-capable through Marinara right now. ${capability.notes.join(" ") || "Choose a different image model."}`,
        );
      }
      const withKey = (await createConnectionsStorage(this.db).getWithKey(selected.id)) as ImageConnection | null;
      if (!withKey) throw new Error(`Could not decrypt image generation connection: ${selected.name}`);
      return withKey;
    }

    const defaultCandidate = candidates.find((conn) => asBoolean(conn.defaultForAgents)) ?? candidates[0];
    if (!defaultCandidate) {
      const available = connections.map((conn) => publicConnection(conn));
      throw new Error(`No edit-capable image_generation connection is configured. Available connections: ${JSON.stringify(available)}`);
    }
    const withKey = (await createConnectionsStorage(this.db).getWithKey(defaultCandidate.id)) as ImageConnection | null;
    if (!withKey) throw new Error(`Could not decrypt image generation connection: ${defaultCandidate.name}`);
    return withKey;
  }

  private async connections(context: ImageCommandContext, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    const onlyEdit = hasFlag(flags, "edit");
    const selector = flagString(flags, "connection", "connection-id");
    const rows = await this.imageConnections();
    if (selector?.trim()) {
      const selected = rows.find((conn) => conn.id === selector || conn.name.toLowerCase() === selector.toLowerCase());
      if (!selected) throw new Error(`Image generation connection not found: ${selector}`);
      return { ok: true, mode: "read", command: context.command, output: publicConnection(selected) };
    }
    const connections = rows.map(publicConnection);
    return {
      ok: true,
      mode: "read",
      command: context.command,
      output: {
        count: connections.length,
        editCapableCount: connections.filter((conn) => (conn.capabilities as ImageCapability).canEdit).length,
        connections: onlyEdit ? connections.filter((conn) => (conn.capabilities as ImageCapability).canEdit) : connections,
      },
    };
  }

  private async preview(context: ImageCommandContext, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    const operation = this.resolveOperation(flags);
    const target = this.parseTarget(flags, false);
    const connection = await this.getConnection(flagString(flags, "connection", "connection-id"), operation === "edit");
    const capability = capabilityForConnection(connection);
    const prompt = flagString(flags, "prompt")?.trim() ?? "";
    if (!prompt) throw new Error("Missing --prompt <text>");
    const negativePrompt = flagString(flags, "negative", "negative-prompt") ?? "";
    const kind = detectImageKind(target, flagString(flags, "kind"));
    const imageSettings = await loadImageGenerationUserSettings(this.db);
    const imageDefaults = resolveConnectionImageDefaults(connection);
    const compiled = compileImagePrompt({
      kind,
      prompt,
      negativePrompt,
      styleProfiles: imageSettings.styleProfiles,
      styleProfileId: flagString(flags, "style-profile", "style-profile-id"),
      imageDefaults,
    });
    const size = this.resolveSize(flags, kind, imageSettings);
    const source = operation === "edit" ? await this.resolveSourceImage(flags, target, context.cwd, true) : null;

    return {
      ok: true,
      mode: "read",
      command: context.command,
      output: {
        previewOnly: true,
        saved: false,
        message: "Preview only: no image was generated, edited, assigned, or deleted. If this looks right, run mari images generate/edit next.",
        operation,
        target,
        sourceImage: source ? { label: source.label, mimeType: source.mimeType, bytes: source.buffer.length, url: source.url ?? null } : null,
        connection: publicConnection(connection),
        capability,
        kind,
        width: size.width,
        height: size.height,
        prompt: compiled.prompt,
        negativePrompt: compiled.negativePrompt,
      },
    };
  }

  private async generateOrEdit(
    operation: "generate" | "edit",
    context: ImageCommandContext,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
    const target = this.parseTarget(flags, false);
    const prompt = flagString(flags, "prompt")?.trim() ?? "";
    if (!prompt) throw new Error("Missing --prompt <text>");
    const negativePrompt = flagString(flags, "negative", "negative-prompt") ?? "";
    const connection = await this.getConnection(flagString(flags, "connection", "connection-id"), operation === "edit");
    const capability = capabilityForConnection(connection);
    if (operation === "edit" && !capability.canEdit) {
      throw new Error(`No edit-capable image connection selected. ${capability.notes.join(" ")}`);
    }

    const sourceImage = operation === "edit" ? await this.resolveSourceImage(flags, target, context.cwd, true) : null;
    const imageSettings = await loadImageGenerationUserSettings(this.db);
    const imageDefaults = resolveConnectionImageDefaults(connection);
    const kind = detectImageKind(target, flagString(flags, "kind"));
    const size = this.resolveSize(flags, kind, imageSettings);
    const compiled = compileImagePrompt({
      kind,
      prompt,
      negativePrompt,
      styleProfiles: imageSettings.styleProfiles,
      styleProfileId: flagString(flags, "style-profile", "style-profile-id"),
      imageDefaults,
    });

    const imgModel = connection.model || "";
    const imgBaseUrl = connection.baseUrl || "https://image.pollinations.ai";
    const imgSource = connection.imageGenerationSource || imgModel;
    const imgServiceHint = connection.imageService || imgSource;
    const result = await generateImage(imgSource, imgBaseUrl, connection.apiKey || "", imgServiceHint, {
      prompt: compiled.prompt,
      negativePrompt: compiled.negativePrompt || undefined,
      model: imgModel || undefined,
      width: size.width,
      height: size.height,
      referenceImage: sourceImage?.base64,
      imageEndpointId: connection.imageEndpointId || undefined,
      comfyWorkflow: connection.comfyuiWorkflow || undefined,
      imageDefaults,
    });

    const asset = await savePreviewAsset({
      result,
      operation,
      kind,
      prompt: compiled.prompt,
      negativePrompt: compiled.negativePrompt,
      width: size.width,
      height: size.height,
      connection,
      capability,
      sourceImage: sourceImage?.label ?? null,
    });

    return {
      ok: true,
      mode: "read",
      command: context.command,
      output: {
        saved: true,
        assigned: false,
        message: "Image created as a preview asset. It is not assigned anywhere yet. Use mari images assign after the user approves it.",
        asset,
        targetSuggestion: target,
      },
    };
  }

  private resolveOperation(flags: Map<string, string | boolean>): "generate" | "edit" {
    const raw = flagString(flags, "operation", "mode")?.trim().toLowerCase();
    if (raw === "generate" || raw === "edit") return raw;
    if (hasFlag(flags, "edit") || flagString(flags, "source", "asset")) return "edit";
    return "generate";
  }

  private resolveSize(flags: Map<string, string | boolean>, kind: ImagePromptKind, settings: Awaited<ReturnType<typeof loadImageGenerationUserSettings>>) {
    const fallback =
      kind === "background"
        ? settings.background
        : kind === "avatar" || kind === "portrait"
          ? settings.portrait
          : kind === "selfie"
            ? settings.selfie
            : settings.illustration;
    return {
      width: flagNumber(flags, "width", fallback.width) ?? fallback.width,
      height: flagNumber(flags, "height", fallback.height) ?? fallback.height,
    };
  }

  private parseTarget(flags: Map<string, string | boolean>, required: true): ImageTarget;
  private parseTarget(flags: Map<string, string | boolean>, required?: false): ImageTarget | null;
  private parseTarget(flags: Map<string, string | boolean>, required = false): ImageTarget | null {
    const target = flagString(flags, "target", "to")?.trim().toLowerCase() ?? "";
    if (!target) {
      if (required) throw new Error("Missing --target <character-avatar|persona-avatar|lorebook-image|sprite|background|chat-gallery|character-gallery|asset>");
      return null;
    }
    switch (target) {
      case "asset":
      case "preview":
        return { type: "asset", assetId: normalizeId(flagString(flags, "asset", "id")) };
      case "character-avatar":
      case "character": {
        const characterId = normalizeId(flagString(flags, "character", "character-id", "id"));
        if (!characterId) throw new Error("character-avatar target requires --character <id>");
        return { type: "character-avatar", characterId };
      }
      case "persona-avatar":
      case "persona": {
        const personaId = normalizeId(flagString(flags, "persona", "persona-id", "id"));
        if (!personaId) throw new Error("persona-avatar target requires --persona <id>");
        return { type: "persona-avatar", personaId };
      }
      case "lorebook-image":
      case "lorebook": {
        const lorebookId = normalizeId(flagString(flags, "lorebook", "lorebook-id", "id"));
        if (!lorebookId) throw new Error("lorebook-image target requires --lorebook <id>");
        return { type: "lorebook-image", lorebookId };
      }
      case "sprite":
      case "sprites": {
        const ownerId = normalizeId(flagString(flags, "character", "character-id", "persona", "persona-id", "owner", "owner-id", "id"));
        const expression = normalizeSpriteExpression(flagString(flags, "expression", "expr") ?? "");
        if (!ownerId) throw new Error("sprite target requires --character <id>, --persona <id>, or --owner <id>");
        if (!expression) throw new Error("sprite target requires --expression <label>");
        return { type: "sprite", ownerId, expression };
      }
      case "background":
      case "backgrounds":
        return {
          type: "background",
          filename: normalizeId(flagString(flags, "filename")),
          name: normalizeId(flagString(flags, "name")),
          tags: parseTags(flagString(flags, "tags")),
        };
      case "chat-gallery":
      case "gallery": {
        const chatId = normalizeId(flagString(flags, "chat", "chat-id", "id"));
        if (!chatId) throw new Error("chat-gallery target requires --chat <id>");
        return { type: "chat-gallery", chatId, imageId: normalizeId(flagString(flags, "image", "image-id")) };
      }
      case "character-gallery": {
        const characterId = normalizeId(flagString(flags, "character", "character-id", "id"));
        if (!characterId) throw new Error("character-gallery target requires --character <id>");
        return { type: "character-gallery", characterId, imageId: normalizeId(flagString(flags, "image", "image-id")) };
      }
      default:
        throw new Error(`Unknown image target: ${target}`);
    }
  }

  private async resolveSourceImage(
    flags: Map<string, string | boolean>,
    target: ImageTarget | null,
    cwd: string | undefined,
    required: true,
  ): Promise<ResolvedImage>;
  private async resolveSourceImage(
    flags: Map<string, string | boolean>,
    target: ImageTarget | null,
    cwd: string | undefined,
    required?: false,
  ): Promise<ResolvedImage | null>;
  private async resolveSourceImage(
    flags: Map<string, string | boolean>,
    target: ImageTarget | null,
    cwd: string | undefined,
    required = false,
  ): Promise<ResolvedImage | null> {
    const explicit = flagString(flags, "source", "source-image", "asset", "from");
    if (explicit) return this.resolveImageReference(explicit, cwd);
    const targetImage = target ? await this.currentImageReferenceForTarget(target) : null;
    if (targetImage) return this.resolveImageReference(targetImage, cwd);
    if (required) throw new Error("Image editing requires --source <asset-id|app-url|file|data-url>, or a target that already has an image.");
    return null;
  }

  private async currentImageReferenceForTarget(target: ImageTarget): Promise<string | null> {
    const characters = createCharactersStorage(this.db);
    switch (target.type) {
      case "character-avatar": {
        const row = await characters.getById(target.characterId);
        if (!row) throw new Error(`Character not found: ${target.characterId}`);
        return row.avatarPath ?? null;
      }
      case "persona-avatar": {
        const row = await characters.getPersona(target.personaId);
        if (!row) throw new Error(`Persona not found: ${target.personaId}`);
        return row.avatarPath ?? null;
      }
      case "lorebook-image": {
        const row = await createLorebooksStorage(this.db).getById(target.lorebookId);
        if (!row) throw new Error(`Lorebook not found: ${target.lorebookId}`);
        return typeof row.imagePath === "string" ? row.imagePath : null;
      }
      case "sprite": {
        const dir = join(SPRITES_DIR, target.ownerId);
        if (!existsSync(dir)) return null;
        const entries = await readdir(dir);
        const match = entries.find((entry) => entry.slice(0, -extname(entry).length) === target.expression && IMAGE_EXTS.has(extname(entry).toLowerCase()));
        return match ? `/api/sprites/${encodeURIComponent(target.ownerId)}/file/${encodeURIComponent(match)}` : null;
      }
      case "background":
        return target.filename ? `/api/backgrounds/file/${encodeURIComponent(target.filename)}` : null;
      case "chat-gallery":
        if (!target.imageId) return null;
        return this.chatGalleryImageUrl(target.chatId, target.imageId);
      case "character-gallery":
        if (!target.imageId) return null;
        return this.characterGalleryImageUrl(target.characterId, target.imageId);
      case "asset":
        return target.assetId ?? null;
    }
  }

  private async chatGalleryImageUrl(chatId: string, imageId: string) {
    const image = await createGalleryStorage(this.db).getById(imageId);
    if (!image || image.chatId !== chatId) throw new Error(`Chat gallery image not found: ${imageId}`);
    const filename = image.filePath.split("/").pop() ?? "";
    const ownerChatId = image.filePath.split("/").filter(Boolean).length > 1 ? image.filePath.split("/")[0]! : chatId;
    return `/api/gallery/file/${encodeURIComponent(ownerChatId)}/${encodeURIComponent(filename)}`;
  }

  private async characterGalleryImageUrl(characterId: string, imageId: string) {
    const image = await createCharacterGalleryStorage(this.db).getById(imageId);
    if (!image || image.characterId !== characterId) throw new Error(`Character gallery image not found: ${imageId}`);
    const filename = image.filePath.split("/").pop() ?? "";
    return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
  }

  private async resolveImageReference(value: string, cwd?: string): Promise<ResolvedImage> {
    const data = decodeDataImage(value);
    if (data) return data;

    const assets = await readManifest();
    const asset = assets.find((candidate) => candidate.id === value || candidate.filename === value || candidate.url === value || candidate.filePath === value);
    if (asset) {
      const image = await imageFromFile(assertInsideDir(PREVIEW_DIR, join(PREVIEW_DIR, asset.filename)), `asset:${asset.id}`);
      return { ...image, url: asset.url, asset };
    }

    const appPath = appImagePathFromUrl(value);
    if (appPath) {
      const image = await imageFromFile(appPath.path, appPath.label);
      return { ...image, url: appPath.url };
    }

    const base64ish = value.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(base64ish) && base64ish.length > 128) {
      const buffer = Buffer.from(base64ish, "base64");
      const imageInfo = isAllowedImageBuffer(buffer);
      if (imageInfo) return { label: "base64", buffer, base64: base64ish, mimeType: imageInfo.mimeType, ext: imageInfo.ext };
    }

    const filePath = resolve(cwd?.trim() ? cwd : process.cwd(), value);
    return imageFromFile(filePath, value);
  }

  private async assign(context: ImageCommandContext, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    const target = this.parseTarget(flags, true);
    if (target.type === "asset") throw new Error("Assign target cannot be asset; use mari images delete --target asset --asset <id> to manage preview assets.");
    const source = await this.resolveSourceImage(flags, null, context.cwd, true);

    if (!hasFlag(flags, "apply")) {
      return {
        ok: true,
        mode: "dry-run",
        command: context.command,
        output: {
          previewOnly: true,
          saved: false,
          message:
            "Preview only: no changes were saved. Re-run the same command with --apply after user approval to persist it.",
          source: source.label,
          target,
        },
      };
    }

    const result = await this.assignImage(source, target);
    await flushDB();
    return { ok: true, mode: "apply", command: context.command, output: { saved: true, source: source.label, target, result } };
  }

  private async assignImage(source: ResolvedImage, target: Exclude<ImageTarget, { type: "asset" }>) {
    switch (target.type) {
      case "character-avatar":
        return this.assignCharacterAvatar(source, target.characterId);
      case "persona-avatar":
        return this.assignPersonaAvatar(source, target.personaId);
      case "lorebook-image":
        return this.assignLorebookImage(source, target.lorebookId);
      case "sprite":
        return this.assignSprite(source, target.ownerId, target.expression);
      case "background":
        return this.assignBackground(source, target);
      case "chat-gallery":
        return this.assignChatGallery(source, target.chatId);
      case "character-gallery":
        return this.assignCharacterGallery(source, target.characterId);
    }
  }

  private async assignCharacterAvatar(source: ResolvedImage, characterId: string) {
    const store = createCharactersStorage(this.db);
    const existing = await store.getById(characterId);
    if (!existing) throw new Error(`Character not found: ${characterId}`);
    await mkdir(AVATAR_DIR, { recursive: true });
    const filename = `character-${characterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${source.ext}`;
    const path = assertInsideDir(AVATAR_DIR, join(AVATAR_DIR, filename));
    await writeFile(path, source.buffer);
    const avatarPath = `/api/avatars/file/${filename}`;
    const updated = await store.updateAvatar(characterId, avatarPath);
    return { avatarPath, row: updated };
  }

  private async assignPersonaAvatar(source: ResolvedImage, personaId: string) {
    const store = createCharactersStorage(this.db);
    const existing = await store.getPersona(personaId);
    if (!existing) throw new Error(`Persona not found: ${personaId}`);
    await mkdir(AVATAR_DIR, { recursive: true });
    const filename = `persona-${personaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${source.ext}`;
    const path = assertInsideDir(AVATAR_DIR, join(AVATAR_DIR, filename));
    await writeFile(path, source.buffer);
    const avatarPath = `/api/avatars/file/${filename}`;
    const updated = await store.updatePersona(personaId, { avatarPath });
    return { avatarPath, row: updated };
  }

  private async assignLorebookImage(source: ResolvedImage, lorebookId: string) {
    const store = createLorebooksStorage(this.db);
    const existing = await store.getById(lorebookId);
    if (!existing) throw new Error(`Lorebook not found: ${lorebookId}`);
    await mkdir(LOREBOOK_IMAGE_DIR, { recursive: true });
    const filename = `lorebook-${lorebookId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${source.ext}`;
    const path = assertInsideDir(LOREBOOK_IMAGE_DIR, join(LOREBOOK_IMAGE_DIR, filename));
    await writeFile(path, source.buffer);
    const imagePath = `/api/lorebooks/images/file/${filename}`;
    const updated = await store.update(lorebookId, { imagePath });
    return { imagePath, row: updated };
  }

  private async assignSprite(source: ResolvedImage, ownerId: string, expression: string) {
    const characters = createCharactersStorage(this.db);
    const owner = (await characters.getById(ownerId)) ?? (await characters.getPersona(ownerId));
    if (!owner) throw new Error(`Character/persona not found for sprite owner: ${ownerId}`);
    const dir = join(SPRITES_DIR, ownerId);
    await mkdir(dir, { recursive: true });
    const filename = `${expression}.${source.ext}`;
    const path = assertInsideDir(dir, join(dir, filename));
    await writeFile(path, source.buffer);
    return { expression, filename, url: `/api/sprites/${encodeURIComponent(ownerId)}/file/${encodeURIComponent(filename)}?v=${Date.now()}` };
  }

  private async assignBackground(source: ResolvedImage, target: Extract<ImageTarget, { type: "background" }>) {
    await mkdir(BACKGROUND_DIR, { recursive: true });
    const desired = target.filename
      ? sanitizeFilenamePart(target.filename, `background.${source.ext}`)
      : `${sanitizeFilenamePart(target.name ?? "generated-background", "generated-background")}.${source.ext}`;
    const filename = uniqueFilename(BACKGROUND_DIR, desired.endsWith(`.${source.ext}`) ? desired : `${desired}.${source.ext}`);
    const path = assertInsideDir(BACKGROUND_DIR, join(BACKGROUND_DIR, filename));
    await writeFile(path, source.buffer);
    const meta = await readBackgroundMeta();
    meta[filename] = { originalName: target.name ?? source.label, tags: target.tags };
    await writeBackgroundMeta(meta);
    buildAssetManifest();
    return { filename, url: `/api/backgrounds/file/${encodeURIComponent(filename)}`, tags: target.tags };
  }

  private async assignChatGallery(source: ResolvedImage, chatId: string) {
    const chats = createChatsStorage(this.db);
    const chat = await chats.getById(chatId);
    if (!chat) throw new Error(`Chat not found: ${chatId}`);
    const dir = join(GALLERY_DIR, chatId);
    await mkdir(dir, { recursive: true });
    const filename = `${newId()}.${source.ext}`;
    const path = assertInsideDir(dir, join(dir, filename));
    await writeFile(path, source.buffer);
    const image = await createGalleryStorage(this.db).create({
      chatId,
      filePath: `${chatId}/${filename}`,
      prompt: source.asset?.prompt ?? "",
      provider: source.asset?.provider ?? "mari-images",
      model: source.asset?.model ?? "",
      width: source.asset?.width ?? undefined,
      height: source.asset?.height ?? undefined,
    });
    return { image, url: `/api/gallery/file/${encodeURIComponent(chatId)}/${encodeURIComponent(filename)}` };
  }

  private async assignCharacterGallery(source: ResolvedImage, characterId: string) {
    const characters = createCharactersStorage(this.db);
    const existing = await characters.getById(characterId);
    if (!existing) throw new Error(`Character not found: ${characterId}`);
    const dir = join(GALLERY_DIR, "characters", characterId);
    await mkdir(dir, { recursive: true });
    const filename = `${newId()}.${source.ext}`;
    const path = assertInsideDir(dir, join(dir, filename));
    await writeFile(path, source.buffer);
    const image = await createCharacterGalleryStorage(this.db).create({
      characterId,
      filePath: `characters/${characterId}/${filename}`,
      prompt: source.asset?.prompt ?? "",
      provider: source.asset?.provider ?? "mari-images",
      model: source.asset?.model ?? "",
      width: source.asset?.width ?? undefined,
      height: source.asset?.height ?? undefined,
    });
    return { image, url: `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}` };
  }

  private async delete(context: ImageCommandContext, flags: Map<string, string | boolean>, positionals: string[]): Promise<MariDbCommandResult> {
    const patchedFlags = new Map(flags);
    if (!patchedFlags.has("target") && positionals[0]) patchedFlags.set("target", positionals[0]);
    if (!patchedFlags.has("asset") && positionals[0] === "asset" && positionals[1]) patchedFlags.set("asset", positionals[1]);
    if (!patchedFlags.has("filename") && positionals[0] === "background" && positionals[1]) patchedFlags.set("filename", positionals[1]);
    const target = this.parseTarget(patchedFlags, true);
    if (!hasFlag(patchedFlags, "apply")) {
      return {
        ok: true,
        mode: "dry-run",
        command: context.command,
        output: {
          previewOnly: true,
          saved: false,
          message:
            "Preview only: no changes were saved. Re-run the same command with --apply after user approval to persist it.",
          target,
          deleteFile: hasFlag(patchedFlags, "delete-file"),
        },
      };
    }

    const result = await this.deleteTarget(target, hasFlag(patchedFlags, "delete-file"));
    await flushDB();
    return { ok: true, mode: "apply", command: context.command, output: { saved: true, target, result } };
  }

  private async deleteTarget(target: ImageTarget, deleteFile: boolean) {
    switch (target.type) {
      case "asset":
        return this.deleteAsset(target.assetId);
      case "character-avatar": {
        const store = createCharactersStorage(this.db);
        const existing = await store.getById(target.characterId);
        if (!existing) throw new Error(`Character not found: ${target.characterId}`);
        if (deleteFile && existing.avatarPath) await this.deleteKnownAppImage(existing.avatarPath);
        return store.updateAvatar(target.characterId, null);
      }
      case "persona-avatar": {
        const store = createCharactersStorage(this.db);
        const existing = await store.getPersona(target.personaId);
        if (!existing) throw new Error(`Persona not found: ${target.personaId}`);
        if (deleteFile && existing.avatarPath) await this.deleteKnownAppImage(existing.avatarPath);
        return store.updatePersona(target.personaId, { avatarPath: null });
      }
      case "lorebook-image": {
        const store = createLorebooksStorage(this.db);
        const existing = await store.getById(target.lorebookId);
        if (!existing) throw new Error(`Lorebook not found: ${target.lorebookId}`);
        const existingImagePath = typeof existing.imagePath === "string" ? existing.imagePath : "";
        if (deleteFile && existingImagePath) await this.deleteKnownAppImage(existingImagePath);
        return store.update(target.lorebookId, { imagePath: null });
      }
      case "sprite":
        return this.deleteSprite(target.ownerId, target.expression);
      case "background":
        return this.deleteBackground(target.filename ?? target.name ?? null);
      case "chat-gallery":
        if (!target.imageId) throw new Error("chat-gallery delete requires --image <id>");
        return this.deleteChatGallery(target.chatId, target.imageId);
      case "character-gallery":
        if (!target.imageId) throw new Error("character-gallery delete requires --image <id>");
        return this.deleteCharacterGallery(target.characterId, target.imageId);
    }
  }

  private async deleteKnownAppImage(value: string) {
    const appPath = appImagePathFromUrl(value);
    if (!appPath || !existsSync(appPath.path)) return false;
    await unlink(appPath.path);
    return true;
  }

  private async deleteAsset(assetId: string | null | undefined) {
    if (!assetId) throw new Error("asset delete requires --asset <id>");
    const assets = await readManifest();
    const asset = assets.find((candidate) => candidate.id === assetId || candidate.filename === assetId);
    if (!asset) throw new Error(`Preview asset not found: ${assetId}`);
    const path = assertInsideDir(PREVIEW_DIR, join(PREVIEW_DIR, asset.filename));
    if (existsSync(path)) await unlink(path);
    await writeManifest(assets.filter((candidate) => candidate.id !== asset.id));
    return { deleted: asset };
  }

  private async deleteSprite(ownerId: string, expression: string) {
    const dir = join(SPRITES_DIR, ownerId);
    if (!existsSync(dir)) return { deleted: 0, files: [] };
    const files = (await readdir(dir)).filter((entry) => entry.slice(0, -extname(entry).length) === expression && IMAGE_EXTS.has(extname(entry).toLowerCase()));
    for (const file of files) await unlink(assertInsideDir(dir, join(dir, file)));
    return { deleted: files.length, files };
  }

  private async deleteBackground(identifier: string | null) {
    if (!identifier) throw new Error("background delete requires --filename <filename> or --name <name>");
    const filename = basename(identifier);
    const path = assertInsideDir(BACKGROUND_DIR, join(BACKGROUND_DIR, filename));
    if (!existsSync(path)) throw new Error(`Background not found: ${filename}`);
    await unlink(path);
    const meta = await readBackgroundMeta();
    delete meta[filename];
    await writeBackgroundMeta(meta);
    buildAssetManifest();
    return { deleted: filename };
  }

  private async deleteChatGallery(chatId: string, imageId: string) {
    const store = createGalleryStorage(this.db);
    const image = await store.getById(imageId);
    if (!image || image.chatId !== chatId) throw new Error(`Chat gallery image not found: ${imageId}`);
    const path = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, image.filePath));
    if (existsSync(path)) await unlink(path);
    await store.remove(imageId);
    return { deleted: image };
  }

  private async deleteCharacterGallery(characterId: string, imageId: string) {
    const store = createCharacterGalleryStorage(this.db);
    const image = await store.getById(imageId);
    if (!image || image.characterId !== characterId) throw new Error(`Character gallery image not found: ${imageId}`);
    const path = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, image.filePath));
    if (existsSync(path)) await unlink(path);
    await store.remove(imageId);
    return { deleted: image };
  }

  private async list(context: ImageCommandContext, flags: Map<string, string | boolean>, positionals: string[]): Promise<MariDbCommandResult> {
    const subject = positionals[0] ?? flagString(flags, "target") ?? "assets";
    const limit = flagNumber(flags, "limit", 50) ?? 50;
    switch (subject) {
      case "assets":
      case "asset":
      case "previews": {
        const assets = await readManifest();
        return { ok: true, mode: "read", command: context.command, output: assets.slice(0, limit) };
      }
      case "backgrounds": {
        await mkdir(BACKGROUND_DIR, { recursive: true });
        const meta = await readBackgroundMeta();
        const files = (await readdir(BACKGROUND_DIR)).filter((entry) => IMAGE_EXTS.has(extname(entry).toLowerCase()));
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: files.slice(0, limit).map((filename) => ({ filename, url: `/api/backgrounds/file/${encodeURIComponent(filename)}`, tags: meta[filename]?.tags ?? [] })),
        };
      }
      case "sprites":
      case "sprite": {
        const ownerId = normalizeId(flagString(flags, "character", "character-id", "persona", "persona-id", "owner", "owner-id", "id"));
        if (!ownerId) throw new Error("sprite list requires --character <id>, --persona <id>, or --owner <id>");
        const dir = join(SPRITES_DIR, ownerId);
        const files = existsSync(dir) ? (await readdir(dir)).filter((entry) => IMAGE_EXTS.has(extname(entry).toLowerCase())) : [];
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: files.slice(0, limit).map((filename) => ({
            expression: filename.slice(0, -extname(filename).length),
            filename,
            url: `/api/sprites/${encodeURIComponent(ownerId)}/file/${encodeURIComponent(filename)}`,
          })),
        };
      }
      case "chat-gallery":
      case "gallery": {
        const chatId = normalizeId(flagString(flags, "chat", "chat-id", "id"));
        if (!chatId) throw new Error("chat-gallery list requires --chat <id>");
        const images = await createGalleryStorage(this.db).listByChatId(chatId);
        return { ok: true, mode: "read", command: context.command, output: images.slice(0, limit) };
      }
      case "character-gallery": {
        const characterId = normalizeId(flagString(flags, "character", "character-id", "id"));
        if (!characterId) throw new Error("character-gallery list requires --character <id>");
        const images = await createCharacterGalleryStorage(this.db).listByCharacterId(characterId);
        return { ok: true, mode: "read", command: context.command, output: images.slice(0, limit) };
      }
      default:
        throw new Error(`Unknown image list subject: ${subject}`);
    }
  }

  private async get(context: ImageCommandContext, flags: Map<string, string | boolean>, positionals: string[]): Promise<MariDbCommandResult> {
    const id = normalizeId(flagString(flags, "asset", "id") ?? positionals[0]);
    if (!id) throw new Error("Usage: mari images get <asset-id>");
    const asset = (await readManifest()).find((candidate) => candidate.id === id || candidate.filename === id);
    if (!asset) throw new Error(`Preview asset not found: ${id}`);
    return { ok: true, mode: "read", command: context.command, output: asset };
  }

  private helpText() {
    return [
      "Usage: mari images <command>",
      "Discovery: connections [--edit], capabilities [--edit], list assets|backgrounds|sprites|chat-gallery|character-gallery, get <asset-id>",
      "HITL preview: preview --operation generate|edit --prompt <text> [--target <target>] [--source <asset|url|file>] [--connection <id|name|default>]",
      "Create preview asset: generate --prompt <text> [--target <target>] [--width <n>] [--height <n>]",
      "Create edited preview asset: edit --prompt <text> (--source <asset|url|file> | --target <existing-image-target>) [--connection <edit-capable>]",
      "Apply: assign --asset <asset-id> --target character-avatar --character <id>",
      "Apply: assign --asset <asset-id> --target persona-avatar --persona <id>",
      "Apply: assign --asset <asset-id> --target lorebook-image --lorebook <id>",
      "Apply: assign --asset <asset-id> --target sprite --character <id> --expression happy",
      "Apply: assign --asset <asset-id> --target background --name <name> [--tags a,b]",
      "Apply: assign --asset <asset-id> --target chat-gallery --chat <id>",
      "Apply: assign --asset <asset-id> --target character-gallery --character <id>",
      "Delete/clear: delete --target asset|character-avatar|persona-avatar|lorebook-image|sprite|background|chat-gallery|character-gallery ...",
      "Notes: preview never generates or saves. generate/edit save a review asset only. assign/delete mutate app image state.",
    ].join("\n");
  }
}

export function getMariImagesService(db: DB) {
  return new MariImagesService(db);
}
