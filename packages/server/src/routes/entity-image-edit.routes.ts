import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { basename, join, extname } from "node:path";
import { getSharp } from "../services/image/sharp-runtime.js";
import { readGalleryTagPayload } from "../services/image/gallery-tag-payload.js";
import {
  buildChatImageGenerationRecord,
  parseChatImageGenerationRecord,
  isNativeNovelAiUrl,
  resolveImageBackend,
} from "@marinara-engine/shared";
import type { DB } from "../db/connection.js";
import { inArray } from "../db/file-query.js";
import { chatImages } from "../db/schema/index.js";
import { resolveInside } from "../utils/security.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { newId } from "../utils/id-generator.js";
import { validateImageAssetFile } from "../utils/media-file-security.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../services/storage/persona-gallery.storage.js";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { resolveStoredGalleryFile, withGalleryFileLifecycleLock } from "../services/image/gallery-file-lifecycle.js";
import { generateImage, NovelAiEditInputError, readNovelAiPngSeed } from "../services/image/image-generation.js";
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
} from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import { readRecordedReferenceImages } from "../services/image/illustrator-references.js";
import { imageConnectionTakesEntryPictures } from "../services/image/writer-reference-pictures.js";
import {
  readSpatialLocationReferenceImageById,
  mergeSpatialLocationReferenceImages,
} from "../services/image/spatial-location-reference.js";
import { GALLERY_IMAGE_REGENERATE_RATE_LIMIT } from "../middleware/rate-limit.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { logger, logDebugOverride, debugJson } from "../lib/logger.js";

/** A gallery owns its request even after its originating chat is removed. Older rows can still read that source. */
export async function resolveEntityImageGeneration(
  db: DB,
  image: { generation?: string | null; sourceChatImageId?: string | null },
  sources?: ReadonlyMap<string, string | null>,
): Promise<string | null> {
  const own = parseChatImageGenerationRecord(image.generation);
  if (own) return JSON.stringify(own);
  if (sources) return image.sourceChatImageId ? (sources.get(image.sourceChatImageId) ?? null) : null;
  const source = image.sourceChatImageId ? await createGalleryStorage(db).getById(image.sourceChatImageId) : null;
  const record = parseChatImageGenerationRecord(source?.generation);
  return record ? JSON.stringify(record) : null;
}

/** Resolve legacy source records in one scan for a whole owner gallery. */
export async function loadEntityImageGenerationSources(
  db: DB,
  images: readonly { generation?: string | null; sourceChatImageId?: string | null }[],
): Promise<ReadonlyMap<string, string | null>> {
  const ids = [
    ...new Set(
      images
        .filter((image) => !parseChatImageGenerationRecord(image.generation))
        .flatMap((image) => (image.sourceChatImageId ? [image.sourceChatImageId] : [])),
    ),
  ];
  const rows = ids.length ? await db.select().from(chatImages).where(inArray(chatImages.id, ids)) : [];
  return new Map(
    rows.map((row) => {
      const generation = parseChatImageGenerationRecord(row.generation);
      return [row.id, generation ? JSON.stringify(generation) : null];
    }),
  );
}

function entityGalleryDirectory(folder: string, id: string): string {
  if (!id || id.includes("..") || id === "." || /[\\/\0]/.test(id)) throw new Error("Invalid gallery owner id");
  return resolveInside(join(DATA_DIR, "gallery", folder), id);
}

export async function entityImageEditRoutes(app: FastifyInstance) {
  const characters = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const personaGallery = createPersonaGalleryStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const rateLimit = { config: { rateLimit: GALLERY_IMAGE_REGENERATE_RATE_LIMIT } };

  for (const kind of ["character", "persona"] as const) {
    const prefix = kind === "character" ? "/:id" : "/personas/:id";
    const folder = kind === "character" ? "characters" : "personas";
    const gallery = kind === "character" ? characterGallery : personaGallery;
    const owner = (id: string) => (kind === "character" ? characters.getById(id) : characters.getPersona(id));
    const owns = (image: Awaited<ReturnType<typeof gallery.getById>>, id: string) =>
      !!image && ("characterId" in image ? image.characterId === id : image.personaId === id);
    const present = async (image: NonNullable<Awaited<ReturnType<typeof gallery.getById>>>, id: string) => ({
      ...image,
      generation: await resolveEntityImageGeneration(app.db, image),
      url: `/api/characters/${kind === "persona" ? "personas/" : ""}${encodeURIComponent(id)}/gallery/file/${encodeURIComponent(basename(image.filePath))}`,
    });

    app.post<{ Params: { id: string } }>(`${prefix}/avatar/edit-source`, rateLimit, async (req, reply) => {
      const entity = await owner(req.params.id);
      if (!entity) return reply.status(404).send({ error: "Image owner not found" });
      const dir = entityGalleryDirectory(folder, entity.id);
      const filename = /^\/api\/avatars\/file\/([A-Za-z0-9_.-]+)(?:\?.*)?$/.exec(entity.avatarPath ?? "")?.[1];
      if (!filename || filename === "." || filename === "..") {
        return reply.status(400).send({ error: "No saved avatar is available to edit." });
      }
      const asset = await validateImageAssetFile(join(DATA_DIR, "avatars", filename), filename);
      if (!asset) return reply.status(400).send({ error: "The original avatar is unavailable." });
      let bytes: Buffer;
      try {
        bytes = await asset.handle.readFile();
      } finally {
        await asset.handle.close();
      }
      const encodedSourceId = /\.gallery64\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.exec(filename)?.[1];
      const sourceId = encodedSourceId
        ? Buffer.from(encodedSourceId, "base64url").toString("utf8")
        : /\.gallery\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.exec(filename)?.[1];
      const sourceImage = sourceId ? await gallery.getById(sourceId) : null;
      if (owns(sourceImage, entity.id)) {
        const file = resolveStoredGalleryFile(sourceImage!.filePath);
        const sourceAsset = file ? await validateImageAssetFile(file.absolutePath, basename(file.absolutePath)) : null;
        if (sourceAsset) {
          try {
            if ((await sourceAsset.handle.readFile()).equals(bytes)) return present(sourceImage!, entity.id);
          } finally {
            await sourceAsset.handle.close();
          }
        }
      }
      const outputName = `avatar-source-${createHash("sha256").update(bytes).digest("hex")}${extname(filename).toLowerCase()}`;
      const filePath = `${folder}/${entity.id}/${outputName}`;
      return withGalleryFileLifecycleLock(filePath, async () => {
        const images =
          kind === "character"
            ? await characterGallery.listByCharacterId(entity.id)
            : await personaGallery.listByPersonaId(entity.id);
        const existing = images.find((image) => image.filePath === filePath);
        const path = join(dir, outputName);
        if (existing) {
          const saved = await validateImageAssetFile(path, outputName);
          if (saved) {
            try {
              if ((await saved.handle.readFile()).equals(bytes)) return present(existing, entity.id);
            } finally {
              await saved.handle.close();
            }
          }
        }
        const sharp = await getSharp();
        const dimensions = await sharp(bytes).metadata();
        await mkdir(dir, { recursive: true });
        let committed = false;
        try {
          await writeFile(path, bytes);
          const fields = { filePath, width: dimensions.width, height: dimensions.height };
          const image =
            existing ??
            (kind === "character"
              ? await characterGallery.create({ characterId: entity.id, ...fields })
              : await personaGallery.create({ personaId: entity.id, ...fields }));
          if (!image) throw new Error("Avatar edit source could not be saved");
          committed = true;
          return present(image, entity.id);
        } catch (error) {
          if (!committed) await unlink(path).catch(() => undefined);
          throw error;
        }
      });
    });

    app.post<{ Params: { id: string; imageId: string } }>(
      `${prefix}/gallery/:imageId/regenerate/prompt`,
      rateLimit,
      async (req, reply) => {
        const { reviseImagePromptDraft, rewriteGalleryImagePromptSchema } = await import("./gallery.routes.js");
        const entity = await owner(req.params.id);
        const image = await gallery.getById(req.params.imageId);
        if (!entity || !owns(image, entity.id)) return reply.status(404).send({ error: "Gallery image not found" });
        const record = parseChatImageGenerationRecord(await resolveEntityImageGeneration(app.db, image!));
        return reviseImagePromptDraft(
          app,
          reply,
          { id: entity.id, mode: "roleplay", metadata: {}, connectionId: null },
          rewriteGalleryImagePromptSchema.parse(req.body),
          record?.connectionId,
        );
      },
    );

    app.post<{ Params: { id: string; imageId: string } }>(
      `${prefix}/gallery/:imageId/regenerate`,
      rateLimit,
      async (req, reply) => {
        const {
          createResponseAbortSignal,
          galleryCaptionLimitError,
          regenerateGalleryImageSchema,
          resolveGalleryCaptionLimit,
          resolveGalleryImageTarget,
          resolveRegenerationImageConnection,
        } = await import("./gallery.routes.js");
        const signal = createResponseAbortSignal(reply, 10 * 60_000, "Entity image regeneration");
        const entity = await owner(req.params.id);
        const original = await gallery.getById(req.params.imageId);
        if (!entity || !owns(original, entity.id)) return reply.status(404).send({ error: "Gallery image not found" });
        const dir = entityGalleryDirectory(folder, entity.id);
        const input = regenerateGalleryImageSchema.parse(req.body);
        const record = parseChatImageGenerationRecord(await resolveEntityImageGeneration(app.db, original!));
        const connection = await resolveRegenerationImageConnection(
          app,
          connections,
          "roleplay",
          {},
          input.connectionId,
          record?.connectionId,
        );
        if (!connection) return reply.status(400).send({ error: "Choose an available image connection first." });
        const target = resolveGalleryImageTarget(connection);
        const { imageSource, imageModel, imageBaseUrl, imageServiceHint } = target;
        const native =
          resolveImageBackend(imageSource, imageBaseUrl, imageServiceHint, imageModel) === "novelai" &&
          isNativeNovelAiUrl(imageBaseUrl);
        if (input.maskImage && input.editMode !== "infill")
          return reply.status(400).send({ error: "A mask image is only valid for inpainting edits." });
        if ((input.editMode || input.reuseSeed) && !native)
          return reply.status(400).send({ error: "Image edits and seed reuse require a native NovelAI connection." });
        if (input.editMode === "infill" && !input.maskImage)
          return reply.status(400).send({ error: "Inpainting requires a painted mask." });
        let source: Buffer | undefined;
        if (input.editMode || (input.reuseSeed && record?.seed === undefined)) {
          const file = resolveStoredGalleryFile(original!.filePath);
          const asset = file ? await validateImageAssetFile(file.absolutePath, basename(file.absolutePath)) : null;
          if (asset) {
            try {
              source = await asset.handle.readFile();
            } finally {
              await asset.handle.close();
            }
          }
          if (input.editMode && !source)
            return reply.status(400).send({ error: "The original image is no longer available on disk." });
        }
        const seed = input.reuseSeed ? (record?.seed ?? (source ? readNovelAiPngSeed(source) : undefined)) : undefined;
        if (input.reuseSeed && seed == null)
          return reply.status(400).send({ error: "No original seed was found for this image." });
        const characterPrompts = input.characterPrompts ?? record?.characterPrompts ?? [];
        const captionError = galleryCaptionLimitError(resolveGalleryCaptionLimit(target), characterPrompts.length);
        if (captionError) return reply.status(400).send({ error: captionError });
        const settings = await loadImageGenerationUserSettings(app.db);
        const width = original!.width ?? settings.illustration.width;
        const height = original!.height ?? settings.illustration.height;
        const negativePrompt = input.negativePrompt ?? record?.negativePrompt ?? "";
        const recordedLocation = record?.references.locationImageId;
        const locationRow =
          !input.editMode && recordedLocation ? await createGalleryStorage(app.db).getById(recordedLocation) : null;
        const locationImage =
          !input.editMode && recordedLocation
            ? await readSpatialLocationReferenceImageById({
                db: app.db,
                chatId: locationRow?.chatId ?? "",
                referenceImageId: recordedLocation,
              })
            : null;
        const references =
          !input.editMode && record
            ? await readRecordedReferenceImages({
                characterIds: record.references.characterIds,
                personaId: record.references.personaId,
                personaSource: record.references.personaSource,
                lorebookImagePaths: imageConnectionTakesEntryPictures(connection)
                  ? record.references.lorebookImagePaths
                  : undefined,
                charactersStore: characters,
                characterGallery,
                personaGallery,
              })
            : [];
        const debug = input.debugMode || isDebugAgentsEnabled();
        logDebugOverride(
          debug,
          "[debug/entity-images/regenerate] final prompt:\n%s\nnegative:\n%s\ncharacters:\n%s",
          input.prompt,
          negativePrompt,
          debugJson(characterPrompts),
        );
        let savedPath: string | undefined;
        try {
          const fallback = await resolveImageConnectionFallback(connections, connection.id);
          signal.throwIfAborted();
          const generated = await generateImage(imageSource, imageBaseUrl, connection.apiKey || "", imageServiceHint, {
            prompt: input.prompt,
            negativePrompt,
            model: imageModel,
            width,
            height,
            characterPrompts,
            imageEndpointId: connection.imageEndpointId || undefined,
            comfyWorkflow: connection.comfyuiWorkflow || undefined,
            imageDefaults: resolveConnectionImageDefaults(connection),
            quality: resolveConnectionImageQuality(connection),
            ...(input.editMode
              ? {
                  editMode: input.editMode,
                  sourceImage: source!.toString("base64"),
                  maskImage: input.maskImage,
                  strength: input.strength,
                  noise: input.noise,
                  addOriginalImage: input.editMode === "infill",
                }
              : { referenceImages: mergeSpatialLocationReferenceImages(locationImage, references, 6) }),
            ...(seed != null ? { seedOverride: seed } : {}),
            signal,
            debugMode: debug,
            fallback,
          });
          signal.throwIfAborted();
          await mkdir(dir, { recursive: true });
          const filename = `${newId()}.${generated.ext}`;
          savedPath = join(dir, filename);
          await writeFile(savedPath, Buffer.from(generated.base64, "base64"));
          signal.throwIfAborted();
          const tag = readGalleryTagPayload(
            { customKind: original!.customKind, customName: original!.customName },
            { allowBackground: true },
          );
          const fields = {
            filePath: `${folder}/${entity.id}/${filename}`,
            prompt: generated.effectivePrompt ?? input.prompt,
            provider: generated.effectiveConnection?.provider ?? connection.provider,
            model: generated.effectiveConnection?.model || imageModel || "unknown",
            width: generated.width ?? width,
            height: generated.height ?? height,
            // Named stickers and emoji must keep the original mapping until explicitly relabeled.
            ...("error" in tag || tag.patch.customKind === "sticker" || tag.patch.customKind === "emoji"
              ? {}
              : tag.patch),
            generation: buildChatImageGenerationRecord({
              prompt: input.prompt,
              negativePrompt,
              characterPrompts,
              connectionId: generated.effectiveConnection?.connectionId ?? connection.id,
              seed: generated.seed,
              ...(input.editMode
                ? {}
                : {
                    referenceCharacterIds: record?.references.characterIds,
                    referencePersonaId: record?.references.personaId,
                    referencePersonaSource: record?.references.personaSource,
                    locationImageId: record?.references.locationImageId,
                    lorebookImagePaths: record?.references.lorebookImagePaths,
                  }),
            }),
          };
          const image =
            kind === "character"
              ? await characterGallery.create({ characterId: entity.id, ...fields })
              : await personaGallery.create({ personaId: entity.id, ...fields });
          if (!image) throw new Error("Edited image metadata could not be saved");
          savedPath = undefined;
          return present(image, entity.id);
        } catch (error) {
          if (savedPath) await unlink(savedPath).catch(() => undefined);
          if (error instanceof NovelAiEditInputError) return reply.status(400).send({ error: error.message });
          logger.warn(error, "Entity image regeneration failed for %s %s", kind, entity.id);
          return reply
            .status(502)
            .send({ error: "Image regeneration failed. Check the image connection and try again." });
        }
      },
    );
  }
}
