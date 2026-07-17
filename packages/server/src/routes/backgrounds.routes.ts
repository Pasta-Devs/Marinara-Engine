// ──────────────────────────────────────────────
// Routes: Chat Backgrounds (upload, list, delete, serve, tags, rename)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync, writeFileSync, renameSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { join, extname, basename, parse as parsePath } from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { DATA_DIR } from "../utils/data-dir.js";
import { logDebugOverride } from "../lib/logger.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { buildAssetManifest, GAME_ASSETS_DIR, getAssetManifest } from "../services/game/asset-manifest.service.js";
import {
  moveBackgroundAssignment,
  normalizeBackgroundLibraryOrganization,
  removeBackgroundFolder,
  type BackgroundLibraryOrganization,
} from "../services/background-library-organization.js";
import { assertInsideDir, isAllowedImageBuffer } from "../utils/security.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createGameStateStorage } from "../services/storage/game-state.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { buildBackgroundProviderPrompt, generateChatBackground } from "../services/game/game-asset-generation.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { resolveImagePromptReviewSize } from "../services/image/image-prompt-review.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import { resolveGameSetupArtStylePrompt } from "@marinara-engine/shared";

const BG_DIR = join(DATA_DIR, "backgrounds");
const META_PATH = join(BG_DIR, "meta.json");
const ORGANIZATION_PATH = join(BG_DIR, "organization.json");

// Ensure directory exists
function ensureDir() {
  if (!existsSync(BG_DIR)) {
    mkdirSync(BG_DIR, { recursive: true });
  }
}

interface BgMeta {
  originalName?: string;
  tags: string[];
}
type MetaMap = Record<string, BgMeta>;

function readMeta(): MetaMap {
  ensureDir();
  if (!existsSync(META_PATH)) return {};
  try {
    return JSON.parse(readFileSync(META_PATH, "utf-8")) as MetaMap;
  } catch {
    return {};
  }
}

function writeMeta(meta: MetaMap) {
  ensureDir();
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

function readOrganization(): BackgroundLibraryOrganization {
  ensureDir();
  if (!existsSync(ORGANIZATION_PATH)) return { folders: [], assignments: {} };
  try {
    return normalizeBackgroundLibraryOrganization(JSON.parse(readFileSync(ORGANIZATION_PATH, "utf-8")));
  } catch {
    return { folders: [], assignments: {} };
  }
}

function writeOrganization(organization: BackgroundLibraryOrganization) {
  ensureDir();
  const temporaryPath = `${ORGANIZATION_PATH}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(organization, null, 2), "utf-8");
    renameSync(temporaryPath, ORGANIZATION_PATH);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

function fileCreatedAt(filePath: string): string {
  try {
    const stats = statSync(filePath);
    const timestamp = stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime;
    return timestamp.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const BACKGROUND_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SCENE_BACKGROUND_MODES = new Set(["roleplay", "visual_novel", "game"]);

const generateSceneBackgroundSchema = z.object({
  chatId: z.string().min(1),
  sceneDescription: z.string().min(1).max(1200),
  locationSlug: z.string().max(180).optional(),
  reason: z.string().max(300).optional(),
  force: z.boolean().optional().default(false),
  promptOverrides: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        prompt: z.string().min(1).max(7000),
        negativePrompt: z.string().max(7000).optional(),
      }),
    )
    .max(1)
    .optional(),
  debugMode: z.boolean().optional().default(false),
});

const backgroundFolderNameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const backgroundAssignmentSchema = z.object({
  backgroundId: z.string().trim().min(1).max(500),
  folderId: z.string().trim().min(1).max(100).nullable(),
});

/** Sanitise a filename: keep alphanumeric, spaces, hyphens, underscores, dots. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _.\-]/g, "").trim();
}

/** Given a desired filename, return a unique filename that doesn't collide with existing files. */
function uniqueFilename(desired: string): string {
  if (!existsSync(join(BG_DIR, desired))) return desired;
  const { name, ext } = parsePath(desired);
  let i = 2;
  while (existsSync(join(BG_DIR, `${name}_${i}${ext}`))) i++;
  return `${name}_${i}${ext}`;
}

function encodeAssetPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function readAgentImageConnectionId(
  agents: ReturnType<typeof createAgentsStorage>,
  type: "background" | "illustrator",
): Promise<string | null> {
  const agent = await agents.getByType(type);
  return readTrimmedString(parseRecord(agent?.settings).imageConnectionId);
}

async function resolveSceneBackgroundImageConnection(
  connections: ReturnType<typeof createConnectionsStorage>,
  agents: ReturnType<typeof createAgentsStorage>,
  mode: string,
  metadata: Record<string, unknown>,
) {
  const candidates: string[] = [];
  const pushCandidate = (id: string | null) => {
    if (id && !candidates.includes(id)) candidates.push(id);
  };

  if (mode === "game") {
    pushCandidate(readTrimmedString(metadata.gameImageConnectionId));
    pushCandidate(await readAgentImageConnectionId(agents, "illustrator"));
  } else {
    pushCandidate(await readAgentImageConnectionId(agents, "background"));
    pushCandidate(await readAgentImageConnectionId(agents, "illustrator"));
  }

  for (const id of candidates) {
    const conn = await connections.getWithKey(id);
    if (conn?.provider === "image_generation") return conn;
  }

  return connections.getDefaultForImageGeneration();
}

function backgroundTagForFilename(filename: string): string {
  return `backgrounds:user:${parsePath(filename).name}`;
}

function sceneBackgroundPromptReviewId(input: { chatId: string; locationSlug?: string; reason?: string }): string {
  const suffix = input.locationSlug?.trim() || input.reason?.trim() || "current-scene";
  return `background:${input.chatId}:${suffix}`.slice(0, 200);
}

export async function backgroundsRoutes(app: FastifyInstance) {
  // List all backgrounds (includes tags)
  app.get("/", async () => {
    ensureDir();
    const meta = readMeta();
    const organization = readOrganization();
    const files = readdirSync(BG_DIR).filter((f) => {
      const ext = extname(f).toLowerCase();
      return ALLOWED_EXTS.has(ext);
    });
    const userBackgrounds = files.map((filename) => {
      const id = `user:${filename}`;
      return {
        id,
        filename,
        url: `/api/backgrounds/file/${encodeURIComponent(filename)}`,
        originalName: meta[filename]?.originalName ?? null,
        tags: meta[filename]?.tags ?? [],
        source: "user" as const,
        editable: true,
        deletable: true,
        renameable: true,
        createdAt: fileCreatedAt(join(BG_DIR, filename)),
        folderId: organization.assignments[id] ?? null,
      };
    });

    const gameAssetBackgrounds = (getAssetManifest().byCategory.backgrounds ?? [])
      .filter((entry) => !entry.path.startsWith("__user_bg__/"))
      .map((entry) => {
        const id = `game:${entry.tag}`;
        return {
          id,
          filename: `${entry.name}${entry.ext}`,
          url: `/api/game-assets/file/${encodeAssetPath(entry.path)}`,
          originalName: entry.tag,
          tags: entry.subcategory ? [entry.subcategory] : [],
          source: "game_asset" as const,
          tag: entry.tag,
          editable: false,
          deletable: false,
          renameable: false,
          createdAt: fileCreatedAt(join(GAME_ASSETS_DIR, entry.path)),
          folderId: organization.assignments[id] ?? null,
        };
      });

    return [...userBackgrounds, ...gameAssetBackgrounds];
  });

  // List all unique tags (for autocomplete)
  app.get("/tags", async () => {
    const meta = readMeta();
    const tagSet = new Set<string>();
    for (const entry of Object.values(meta)) {
      for (const t of entry.tags) tagSet.add(t);
    }
    for (const entry of getAssetManifest().byCategory.backgrounds ?? []) {
      if (!entry.path.startsWith("__user_bg__/") && entry.subcategory) tagSet.add(entry.subcategory);
    }
    return [...tagSet].sort();
  });

  app.get("/folders", async () => readOrganization().folders);

  app.post("/folders", async (req, reply) => {
    const parsed = backgroundFolderNameSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Folder name is required and must be 80 characters or fewer" });
    const organization = readOrganization();
    const now = new Date().toISOString();
    const folder = { id: randomUUID(), name: parsed.data.name, createdAt: now, updatedAt: now };
    organization.folders.push(folder);
    writeOrganization(organization);
    return folder;
  });

  app.patch("/folders/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = backgroundFolderNameSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Folder name is required and must be 80 characters or fewer" });
    const organization = readOrganization();
    const folder = organization.folders.find((candidate) => candidate.id === id);
    if (!folder) return reply.status(404).send({ error: "Folder not found" });
    folder.name = parsed.data.name;
    folder.updatedAt = new Date().toISOString();
    writeOrganization(organization);
    return folder;
  });

  app.delete("/folders/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const organization = readOrganization();
    if (!organization.folders.some((folder) => folder.id === id)) {
      return reply.status(404).send({ error: "Folder not found" });
    }
    writeOrganization(removeBackgroundFolder(organization, id));
    return { success: true };
  });

  app.patch("/organization", async (req, reply) => {
    const parsed = backgroundAssignmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "A valid backgroundId and folderId are required" });
    const organization = readOrganization();
    if (parsed.data.folderId && !organization.folders.some((folder) => folder.id === parsed.data.folderId)) {
      return reply.status(404).send({ error: "Folder not found" });
    }

    const userBackgroundIds = readdirSync(BG_DIR)
      .filter((filename) => ALLOWED_EXTS.has(extname(filename).toLowerCase()))
      .map((filename) => `user:${filename}`);
    const gameBackgroundIds = (getAssetManifest().byCategory.backgrounds ?? [])
      .filter((entry) => !entry.path.startsWith("__user_bg__/"))
      .map((entry) => `game:${entry.tag}`);
    if (!new Set([...userBackgroundIds, ...gameBackgroundIds]).has(parsed.data.backgroundId)) {
      return reply.status(404).send({ error: "Background not found" });
    }

    if (parsed.data.folderId) organization.assignments[parsed.data.backgroundId] = parsed.data.folderId;
    else delete organization.assignments[parsed.data.backgroundId];
    writeOrganization(organization);
    return { success: true, folderId: parsed.data.folderId };
  });

  // Upload a new background (preserves original filename)
  app.post("/upload", async (req, reply) => {
    ensureDir();
    const data = await req.file({ limits: { fileSize: BACKGROUND_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    // Use the original filename (sanitised) instead of a UUID
    const sanitized = sanitizeFilename(basename(data.filename));
    const safeName = sanitized ? uniqueFilename(sanitized) : uniqueFilename(`background${ext}`);
    const filePath = assertInsideDir(BG_DIR, join(BG_DIR, safeName));
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: "Background image is too large" });
      }
      throw err;
    }
    if (!isAllowedImageBuffer(buffer, ext)) {
      return reply.status(400).send({ error: "Unsupported or invalid image file" });
    }
    await writeFile(filePath, buffer);

    // Store metadata
    const meta = readMeta();
    meta[safeName] = { originalName: data.filename, tags: [] };
    writeMeta(meta);

    // Rebuild game asset manifest so scene analysis picks up new backgrounds
    buildAssetManifest();

    return {
      success: true,
      filename: safeName,
      originalName: data.filename,
      url: `/api/backgrounds/file/${encodeURIComponent(safeName)}`,
      tags: [],
    };
  });

  async function resolveSceneBackgroundRequest(input: z.infer<typeof generateSceneBackgroundSchema>, reply: FastifyReply) {
    const debugOverrideEnabled = input.debugMode === true || isDebugAgentsEnabled();
    const debugLog = (message: string, ...args: any[]) => {
      logDebugOverride(debugOverrideEnabled, message, ...args);
    };
    const chats = createChatsStorage(app.db);
    const chat = await chats.getById(input.chatId);
    if (!chat) return { response: reply.status(404).send({ error: "Chat not found" }) };

    const mode = String(chat.mode ?? "");
    if (!SCENE_BACKGROUND_MODES.has(mode)) {
      return {
        response: reply.status(400).send({ error: "Scene background generation is available in Roleplay and Game modes." }),
      };
    }

    const metadata = parseRecord(chat.metadata);
    const connections = createConnectionsStorage(app.db);
    const agents = createAgentsStorage(app.db);
    const imgConn = await resolveSceneBackgroundImageConnection(connections, agents, mode, metadata);
    if (!imgConn) {
      return {
        response: reply.status(400).send({
          error:
            "Choose an image generation connection for the Background/Illustrator agent, or mark an image generation connection as the default for agents.",
        }),
      };
    }

    const setupConfig = parseRecord(metadata.gameSetupConfig);
    const gameState =
      mode === "game"
        ? await createGameStateStorage(app.db)
            .getLatest(input.chatId)
            .catch(() => null)
        : null;
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const imageFallback = await resolveImageConnectionFallback(connections, imgConn.id);
    const styleProfileId =
      readTrimmedString(setupConfig.imageStyleProfileId) ?? readTrimmedString(metadata.imageStyleProfileId);
    const locationSlug = input.locationSlug?.trim() || input.reason?.trim() || chat.name || "current-scene";
    const promptOverride = (input.promptOverrides ?? []).find((item) => item.id === sceneBackgroundPromptReviewId(input));

    return {
      context: {
        chat,
        metadata,
        mode,
        imageSettings,
        imageFallback,
        imgConn,
        gameState,
        setupConfig,
        styleProfileId,
        locationSlug,
        promptOverride,
        debugLog,
      },
    };
  }

  app.post("/generate-scene/preview", async (req, reply) => {
    const input = generateSceneBackgroundSchema.parse(req.body);
    const resolved = await resolveSceneBackgroundRequest(input, reply);
    if ("response" in resolved) return resolved.response;
    const { context } = resolved;

    const compiled = await buildBackgroundProviderPrompt({
      chatId: input.chatId,
      locationSlug: context.locationSlug,
      sceneDescription: input.sceneDescription.trim(),
      genre: readTrimmedString(context.setupConfig.genre) ?? undefined,
      setting: readTrimmedString(context.setupConfig.setting) ?? undefined,
      currentLocation: context.gameState?.location ?? null,
      currentWeather: context.gameState?.weather ?? null,
      currentTimeOfDay: context.gameState?.time ?? null,
      worldOverview: readTrimmedString(context.metadata.gameWorldOverview),
      artStyle: resolveGameSetupArtStylePrompt(context.setupConfig) || undefined,
      imgModel: context.imgConn.model || "",
      imgBaseUrl: context.imgConn.baseUrl || "https://image.pollinations.ai",
      imgApiKey: context.imgConn.apiKey || "",
      imgSource: (context.imgConn as any).imageGenerationSource || context.imgConn.model || "",
      imgService: context.imgConn.imageService || (context.imgConn as any).imageGenerationSource || "",
      imgEndpointId: context.imgConn.imageEndpointId || undefined,
      imgComfyWorkflow: context.imgConn.comfyuiWorkflow || undefined,
      imgDefaults: resolveConnectionImageDefaults(context.imgConn),
      imgFallback: context.imageFallback,
      styleProfiles: context.imageSettings.styleProfiles,
      styleProfileId: context.styleProfileId,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
      size: context.imageSettings.background,
      promptOverride: context.promptOverride?.prompt,
      negativePromptOverride: context.promptOverride?.negativePrompt,
    });
    const previewSize = resolveImagePromptReviewSize({
      connection: context.imgConn,
      prompt: compiled.prompt,
      width: context.imageSettings.background.width,
      height: context.imageSettings.background.height,
      imageDefaults: resolveConnectionImageDefaults(context.imgConn),
    });

    return {
      items: [
        {
          id: sceneBackgroundPromptReviewId(input),
          kind: "background",
          title: "Scene background",
          prompt: compiled.prompt,
          negativePrompt: compiled.negativePrompt,
          width: previewSize.width,
          height: previewSize.height,
        },
      ],
    };
  });

  app.post("/generate-scene", async (req, reply) => {
    const input = generateSceneBackgroundSchema.parse(req.body);
    const resolved = await resolveSceneBackgroundRequest(input, reply);
    if ("response" in resolved) return resolved.response;
    const { context } = resolved;

    const filename = await generateChatBackground({
      chatId: input.chatId,
      locationSlug: context.locationSlug,
      sceneDescription: input.sceneDescription.trim(),
      genre: readTrimmedString(context.setupConfig.genre) ?? undefined,
      setting: readTrimmedString(context.setupConfig.setting) ?? undefined,
      currentLocation: context.gameState?.location ?? null,
      currentWeather: context.gameState?.weather ?? null,
      currentTimeOfDay: context.gameState?.time ?? null,
      worldOverview: readTrimmedString(context.metadata.gameWorldOverview),
      artStyle: resolveGameSetupArtStylePrompt(context.setupConfig) || undefined,
      reason: input.reason?.trim() || "Manual Gallery background request",
      sourceMode: context.mode === "game" ? "game" : context.mode === "visual_novel" ? "visual_novel" : "roleplay",
      imgModel: context.imgConn.model || "",
      imgBaseUrl: context.imgConn.baseUrl || "https://image.pollinations.ai",
      imgApiKey: context.imgConn.apiKey || "",
      imgSource: (context.imgConn as any).imageGenerationSource || context.imgConn.model || "",
      imgService: context.imgConn.imageService || (context.imgConn as any).imageGenerationSource || "",
      imgEndpointId: context.imgConn.imageEndpointId || undefined,
      imgComfyWorkflow: context.imgConn.comfyuiWorkflow || undefined,
      imgDefaults: resolveConnectionImageDefaults(context.imgConn),
      imgFallback: context.imageFallback,
      styleProfiles: context.imageSettings.styleProfiles,
      styleProfileId: context.styleProfileId,
      debugLog: context.debugLog,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
      size: context.imageSettings.background,
      force: input.force,
      promptOverride: context.promptOverride?.prompt,
      negativePromptOverride: context.promptOverride?.negativePrompt,
    });

    if (!filename) {
      return reply.status(500).send({ error: "Background image generation failed. Check the image connection." });
    }

    const url = `/api/backgrounds/file/${encodeURIComponent(filename)}`;
    return {
      success: true,
      filename,
      url,
      tag: backgroundTagForFilename(filename),
    };
  });

  // Set tags for a background
  app.patch("/:filename/tags", async (req, reply) => {
    const { filename } = req.params as { filename: string };
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = assertInsideDir(BG_DIR, join(BG_DIR, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const body = req.body as { tags?: string[] };
    if (!Array.isArray(body?.tags)) {
      return reply.status(400).send({ error: "tags must be an array of strings" });
    }

    // Sanitise: lowercase, trim, unique, limit length
    const tags = [
      ...new Set(
        body.tags
          .map((t: unknown) =>
            String(t)
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9 _-]/g, ""),
          )
          .filter((t) => t.length > 0 && t.length <= 40),
      ),
    ];

    const meta = readMeta();
    if (!meta[filename]) meta[filename] = { tags: [] };
    meta[filename].tags = tags;
    writeMeta(meta);

    return { success: true, tags };
  });

  // Rename a background file
  app.patch("/:filename/rename", async (req, reply) => {
    const { filename } = req.params as { filename: string };
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = assertInsideDir(BG_DIR, join(BG_DIR, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const body = req.body as { name?: string };
    if (!body?.name || typeof body.name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }

    // Keep the existing extension
    const ext = extname(filename).toLowerCase();
    const rawName = sanitizeFilename(body.name.replace(/\.[^.]+$/, "")); // strip any extension they included
    if (!rawName) {
      return reply.status(400).send({ error: "Name is empty after sanitisation" });
    }

    const desired = `${rawName}${ext}`;
    if (desired === filename) {
      return { success: true, filename, url: `/api/backgrounds/file/${encodeURIComponent(filename)}` };
    }

    const newFilename = uniqueFilename(desired);
    const newPath = assertInsideDir(BG_DIR, join(BG_DIR, newFilename));

    renameSync(filePath, newPath);

    // Move metadata entry
    const meta = readMeta();
    if (meta[filename]) {
      meta[newFilename] = meta[filename];
      delete meta[filename];
    }
    writeMeta(meta);

    const organization = moveBackgroundAssignment(
      readOrganization(),
      `user:${filename}`,
      `user:${newFilename}`,
    );
    writeOrganization(organization);

    // Rebuild game asset manifest
    buildAssetManifest();

    return {
      success: true,
      oldFilename: filename,
      filename: newFilename,
      url: `/api/backgrounds/file/${encodeURIComponent(newFilename)}`,
    };
  });

  // Serve a background file
  app.get("/file/:filename", async (req, reply) => {
    ensureDir();
    const { filename } = req.params as { filename: string };

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = assertInsideDir(BG_DIR, join(BG_DIR, filename));
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
    };

    const { createReadStream } = await import("fs");
    const stream = createReadStream(filePath);
    return reply
      .header("Content-Type", mimeMap[ext] ?? "application/octet-stream")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(stream);
  });

  // Delete a background
  app.delete("/:filename", async (req, reply) => {
    ensureDir();
    const { filename } = req.params as { filename: string };

    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = assertInsideDir(BG_DIR, join(BG_DIR, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    unlinkSync(filePath);

    // Remove from metadata
    const meta = readMeta();
    delete meta[filename];
    writeMeta(meta);

    writeOrganization(moveBackgroundAssignment(readOrganization(), `user:${filename}`, null));

    // Rebuild game asset manifest
    buildAssetManifest();

    return { success: true };
  });
}
