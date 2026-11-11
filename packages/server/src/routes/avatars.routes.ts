// ──────────────────────────────────────────────
// Routes: Avatar file serving
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { parseAgentSettingsRecord } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../utils/security.js";
import { sendValidatedMediaFile, validateImageAssetFile } from "../utils/media-file-security.js";
import { npcAvatarSlug } from "../services/game/npc-avatar-utils.js";
import {
  generateTrackerPortrait,
  TrackerPortraitConflictError,
  trackerPortraitStyleProfileId,
} from "../services/image/tracker-portrait.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";

const trackerPortraitRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  appearance: z.string().nullish(),
  outfit: z.string().nullish(),
  includeOutfit: z.boolean(),
  debugMode: z.boolean().optional(),
});

const AVATAR_DIR = join(DATA_DIR, "avatars");
const NPC_AVATAR_DIR = join(AVATAR_DIR, "npc");

function ensureDir() {
  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

function isValidFilename(name: string): boolean {
  return !name.includes("..") && !name.includes("/") && !name.includes("\\");
}

const AVATAR_DATA_URL_SUBTYPE_RE = /^[\w.+-]+$/;
const AVATAR_DATA_URL_BODY_BREAK_RE = /[\r\n]/;

/**
 * An avatar data URL's media subtype and encoded body. The header is sliced and only the subtype is matched, because
 * `/^data:image\/([\w.+-]+);base64,(.+)$/` recursed once per character of a large upload in V8's regexp interpreter
 * and exhausted the stack (#9060). Every answer is the one that pattern gave.
 */
function parseAvatarDataUrl(value: string): { subtype: string; encoded: string } | null {
  if (!value.startsWith("data:image/")) return null;
  const separator = value.indexOf(",", "data:image/".length);
  if (separator < 0) return null;
  const header = value.slice("data:image/".length, separator);
  if (!header.toLowerCase().endsWith(";base64")) return null;
  const subtype = header.slice(0, -";base64".length);
  if (!AVATAR_DATA_URL_SUBTYPE_RE.test(subtype)) return null;
  const encoded = value.slice(separator + 1);
  // `(.+)` matched no line break, and its `+` required a body.
  if (!encoded || AVATAR_DATA_URL_BODY_BREAK_RE.test(encoded)) return null;
  return { subtype, encoded };
}

export async function avatarsRoutes(app: FastifyInstance) {
  /** Serve an avatar image file. */
  app.get("/file/:filename", async (req, reply) => {
    ensureDir();
    const { filename } = req.params as { filename: string };

    if (!isValidFilename(filename)) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = assertInsideDir(AVATAR_DIR, join(AVATAR_DIR, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const image = await validateImageAssetFile(filePath, filename);
    if (!image) return reply.status(404).send({ error: "Not found" });
    return sendValidatedMediaFile(reply, image, {
      method: req.method,
      rangeHeader: req.headers.range,
      cacheControl: "public, max-age=31536000, immutable",
    });
  });

  /** Serve an NPC avatar image by chatId and filename. */
  app.get("/npc/:chatId/:filename", async (req, reply) => {
    const { chatId, filename } = req.params as { chatId: string; filename: string };

    if (!isValidFilename(chatId) || !isValidFilename(filename)) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const filePath = assertInsideDir(NPC_AVATAR_DIR, join(NPC_AVATAR_DIR, chatId, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const image = await validateImageAssetFile(filePath, filename);
    if (!image) return reply.status(404).send({ error: "Not found" });
    return sendValidatedMediaFile(reply, image, {
      method: req.method,
      rangeHeader: req.headers.range,
      cacheControl: "public, max-age=604800",
    });
  });

  /** Upload an NPC avatar (base64 data URL). */
  app.post("/npc/:chatId", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const { name, avatar } = req.body as { name: string; avatar: string };

    if (!isValidFilename(chatId)) {
      return reply.status(400).send({ error: "Invalid chatId" });
    }
    if (!name || !avatar) {
      return reply.status(400).send({ error: "Missing name or avatar" });
    }

    // Extract base64 data from data URL. The header is sliced rather than matched over the whole URL: V8's regexp
    // interpreter recurses once per character, so a large upload ended in "Maximum call stack size exceeded" (#9060).
    const dataUrl = parseAvatarDataUrl(avatar);
    if (!dataUrl) {
      return reply.status(400).send({ error: "Invalid avatar format — expected base64 data URL" });
    }

    const safeName = npcAvatarSlug(name);
    if (!safeName) {
      return reply.status(400).send({ error: "Invalid character name" });
    }

    const npcDir = join(NPC_AVATAR_DIR, chatId);
    if (!existsSync(npcDir)) mkdirSync(npcDir, { recursive: true });

    const hintedExt = `.${dataUrl.subtype.replace("+xml", "")}`;
    const imageBuffer = Buffer.from(dataUrl.encoded, "base64");
    const image = isAllowedImageBuffer(imageBuffer, hintedExt);
    if (!image) {
      return reply.status(400).send({ error: "Unsupported or invalid avatar image" });
    }
    const filename = `${safeName}.${image.ext}`;
    const filePath = assertInsideDir(npcDir, join(npcDir, filename));
    writeFileSync(filePath, imageBuffer);

    return reply.send({ avatarPath: `/api/avatars/npc/${chatId}/${filename}?v=${Date.now()}` });
  });

  /** Generate a new Character Tracker portrait from the look, and the outfit when asked. */
  app.post("/npc/:chatId/generate", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    if (!isValidFilename(chatId)) {
      return reply.status(400).send({ error: "Invalid chatId" });
    }
    const body = trackerPortraitRequestSchema.safeParse(req.body);
    if (!body.success || !npcAvatarSlug(body.data.name)) {
      return reply.status(400).send({ error: "Invalid portrait request" });
    }
    const chat = await createChatsStorage(app.db).getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    const tracker = await createAgentsStorage(app.db).getByType("character-tracker");
    const connectionId = parseAgentSettingsRecord(tracker?.settings).imageConnectionId;
    if (typeof connectionId !== "string" || !connectionId.trim()) {
      return reply.status(400).send({ error: "Choose an image connection for the Character Tracker first." });
    }
    try {
      const avatarPath = await generateTrackerPortrait({
        db: app.db,
        connectionId,
        chatId: chat.id,
        styleProfileId: trackerPortraitStyleProfileId(parseAgentSettingsRecord(chat.metadata)),
        character: body.data,
        includeOutfit: body.data.includeOutfit,
        debugMode: body.data.debugMode,
      });
      return reply.send({ avatarPath: `${avatarPath}?v=${Date.now()}` });
    } catch (err) {
      logger.warn(err, '[character-tracker] Failed to generate a portrait for "%s"', body.data.name);
      // Provider and file errors stay in the log; they can carry upstream text or local paths.
      if (err instanceof TrackerPortraitConflictError) return reply.status(409).send({ error: err.message });
      return reply.status(502).send({ error: "Portrait generation failed. The server log has the details." });
    }
  });
}
