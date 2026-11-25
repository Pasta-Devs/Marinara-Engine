// ──────────────────────────────────────────────
// Routes: Avatar file serving
// ──────────────────────────────────────────────
import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { z } from "zod";
import { parseAgentSettingsRecord, readImageAppearanceOverride } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { parseJsonRecord } from "../utils/large-json.js";
import { isAllowedImageBuffer, resolveInside } from "../utils/security.js";
import { sendValidatedMediaFile, validateImageAssetFile } from "../utils/media-file-security.js";
import { avatarImageService } from "../services/avatars/generation/generation-context.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import { imageConnectionTakesReferencePicture } from "../services/image/image-generation.js";
import { parseThumbnailWidth, resolveThumbPath } from "../services/image/image-thumbnail.js";
import {
  readPreferredCharacterReferenceImage,
  suppressesReferencePromptLine,
} from "../services/image/illustrator-references.js";
import { npcAvatarSlug } from "../services/game/npc-avatar-utils.js";
import {
  generateTrackerPortrait,
  TrackerPortraitConflictError,
  trackerPortraitRewriteOption,
  trackerPortraitStyleProfileId,
} from "../services/image/tracker-portrait.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { notFound } from "../utils/not-found.js";

const trackerPortraitRequestSchema = z.object({
  characterId: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200),
  appearance: z.string().nullish(),
  outfit: z.string().nullish(),
  mood: z.string().nullish(),
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
// `.` matches none of JavaScript's four line terminators.
const AVATAR_DATA_URL_BODY_BREAK_RE = /[\r\n\u2028\u2029]/;

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
  // The pattern was case-sensitive, so `;BASE64` was never a marker.
  if (!header.endsWith(";base64")) return null;
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

    const filePath = resolveInside(AVATAR_DIR, filename);
    if (!existsSync(filePath)) {
      return notFound(reply, "Not found");
    }

    const image = await validateImageAssetFile(filePath, filename);
    if (!image) return notFound(reply, "Not found");

    // `?w=` asks for a downscaled copy (Library cards, list icons): a full card PNG is often several
    // MB, and dozens of them at once held up every other request on a phone or tablet.
    // Falls back to the original on any miss.
    const requestedWidth = parseThumbnailWidth((req.query as { w?: string }).w);
    const thumbPath = requestedWidth ? await resolveThumbPath(filePath, requestedWidth) : null;
    const preview = thumbPath ? await validateImageAssetFile(thumbPath, basename(thumbPath)) : null;
    if (preview) await image.handle.close().catch(() => undefined);

    return sendValidatedMediaFile(reply, preview ?? image, {
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

    const filePath = resolveInside(NPC_AVATAR_DIR, chatId, filename);
    if (!existsSync(filePath)) {
      return notFound(reply, "Not found");
    }

    const image = await validateImageAssetFile(filePath, filename);
    if (!image) return notFound(reply, "Not found");
    return sendValidatedMediaFile(reply, image, {
      method: req.method,
      rangeHeader: req.headers.range,
      cacheControl: "public, max-age=604800",
    });
  });

  /** Upload an NPC avatar or per-scene card portrait (base64 data URL). */
  app.post("/npc/:chatId", async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const { name, avatar, scenePortrait } = req.body as {
      name: string;
      avatar: string;
      scenePortrait?: boolean;
    };

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
    const isScenePortrait = scenePortrait === true;
    const filename = isScenePortrait
      ? `scene-${safeName}-${randomUUID().slice(0, 8)}.${image.ext}`
      : `${safeName}.${image.ext}`;
    const filePath = resolveInside(npcDir, filename);
    writeFileSync(filePath, imageBuffer);

    return reply.send({
      avatarPath: isScenePortrait
        ? `/api/avatars/npc/${chatId}/${filename}`
        : `/api/avatars/npc/${chatId}/${filename}?v=${Date.now()}`,
    });
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
    if (!chat) return notFound(reply, "Chat not found");
    const tracker = await createAgentsStorage(app.db).getByType("character-tracker");
    const trackerSettings = parseAgentSettingsRecord(tracker?.settings);
    const connectionId = trackerSettings.imageConnectionId;
    if (typeof connectionId !== "string" || !connectionId.trim()) {
      return reply.status(400).send({ error: "Choose an image connection for the Character Tracker first." });
    }
    const requestedCharacterId = body.data.characterId?.trim() || null;
    const card = requestedCharacterId
      ? await createCharactersStorage(app.db).getById(requestedCharacterId, chat.id)
      : null;
    if (requestedCharacterId && !card) {
      return notFound(reply, "Character card not found");
    }
    const isCardScenePortrait = !!card;
    const chatMeta = parseAgentSettingsRecord(chat.metadata);
    let characterInput: {
      name: string;
      imageAppearance?: string | null;
      appearance?: string | null;
      outfit?: string | null;
      mood?: string | null;
    } = body.data;
    let referenceImage: string | undefined;
    let referenceLine: string | null = null;
    if (card) {
      const cardData = parseJsonRecord(card.data);
      const extensions = parseJsonRecord(cardData.extensions);
      const imageAppearance = readImageAppearanceOverride(extensions, null);
      const trackerLook =
        typeof body.data.appearance === "string" && body.data.appearance.trim() ? body.data.appearance : null;
      const cardLook =
        (typeof extensions.appearance === "string" && extensions.appearance.trim() ? extensions.appearance : null) ??
        (typeof cardData.appearance === "string" && cardData.appearance.trim() ? cardData.appearance : null);
      characterInput = {
        name: body.data.name,
        imageAppearance,
        // Card prose appearance is only a fallback when the card's Image Appearance override is off.
        appearance: imageAppearance ? trackerLook : (trackerLook ?? cardLook),
        outfit: body.data.outfit,
        mood: body.data.mood,
      };
      if (trackerSettings.useCardReferenceInPortraits === true) {
        const connections = createConnectionsStorage(app.db);
        const connection = await connections.getWithKey(connectionId);
        if (connection) {
          const service = avatarImageService(connection);
          const providerInfo = {
            ...service,
            imageService: connection.imageService ?? undefined,
            imageGenerationSource:
              (connection as { imageGenerationSource?: string | null }).imageGenerationSource ?? undefined,
          };
          if (imageConnectionTakesReferencePicture(service)) {
            const fallback = await resolveImageConnectionFallback(connections, connection.id);
            const ref = await readPreferredCharacterReferenceImage({
              characterId: card.id,
              avatarPath: card.avatarPath ?? null,
              characterSheetImageId:
                typeof extensions.characterSheetImageId === "string" ? extensions.characterSheetImageId : null,
              useCharacterSheetAsReference: extensions.useCharacterSheetAsReference === true,
              characterGallery: createCharacterGalleryStorage(app.db),
            });
            if (ref) {
              referenceImage = ref.base64;
              if (!suppressesReferencePromptLine(providerInfo, fallback)) {
                referenceLine = `Use the attached reference image of ${body.data.name} only to preserve facial likeness and character identity; follow the written prompt for outfit, expression, and scene details.`;
              }
            }
          }
        }
      }
    }
    try {
      const avatarPath = await generateTrackerPortrait({
        db: app.db,
        connectionId,
        chatId: chat.id,
        styleProfileId: trackerPortraitStyleProfileId(chatMeta),
        character: characterInput,
        includeOutfit: body.data.includeOutfit,
        uniqueFilename: isCardScenePortrait,
        referenceImage,
        referenceLine,
        rewritePrompt: trackerPortraitRewriteOption(trackerSettings, chatMeta, chat.connectionId),
        debugMode: body.data.debugMode,
      });
      return reply.send({ avatarPath: isCardScenePortrait ? avatarPath : `${avatarPath}?v=${Date.now()}` });
    } catch (err) {
      logger.warn(err, '[character-tracker] Failed to generate a portrait for "%s"', body.data.name);
      // Provider and file errors stay in the log; they can carry upstream text or local paths.
      if (err instanceof TrackerPortraitConflictError) return reply.status(409).send({ error: err.message });
      return reply.status(502).send({ error: "Portrait generation failed. The server log has the details." });
    }
  });
}
