// ──────────────────────────────────────────────
// Routes: Gallery picture descriptions (every gallery)
//   PATCH /:scope/:imageId          write or clear one description
//   POST  /:scope/describe          have the Image reading model describe the selected pictures
// Scopes: chat, character, persona (need ownerId), global, emoji, sticker.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  GALLERY_DESCRIBE_BATCH_MAX,
  GALLERY_DESCRIPTION_MAX_LENGTH,
  isGalleryDescriptionScope,
  normalizeGalleryDescription,
  type GalleryDescriptionScope,
} from "@marinara-engine/shared";

import { logger } from "../lib/logger.js";
import { visionCaptionSettings } from "../services/generation/job-fallback.js";
import { resolveImageCaptioningRuntime } from "../services/generation/image-captioning-runtime.js";
import {
  describePicture,
  loadDescribablePictures,
  saveGalleryDescription,
} from "../services/image/gallery-descriptions.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { readFeatureModelConnections } from "../services/storage/feature-model-connections.js";

const OWNED_SCOPES: ReadonlySet<GalleryDescriptionScope> = new Set(["chat", "character", "persona"]);

function readOwner(scope: GalleryDescriptionScope, ownerId: unknown): string | null | { error: string } {
  if (!OWNED_SCOPES.has(scope)) return null;
  return typeof ownerId === "string" && ownerId.trim() ? ownerId.trim() : { error: "ownerId is required" };
}

export async function galleryDescriptionsRoutes(app: FastifyInstance) {
  const connections = createConnectionsStorage(app.db);

  app.patch<{
    Params: { scope: string; imageId: string };
    Body: { ownerId?: unknown; description?: unknown };
  }>("/:scope/:imageId", async (req, reply) => {
    const { scope, imageId } = req.params;
    if (!isGalleryDescriptionScope(scope)) return reply.status(400).send({ error: "Unknown gallery" });
    const owner = readOwner(scope, req.body?.ownerId);
    if (owner && typeof owner === "object") return reply.status(400).send(owner);
    const raw = req.body?.description;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      return reply.status(400).send({ error: "description must be text" });
    }
    if (typeof raw === "string" && raw.length > GALLERY_DESCRIPTION_MAX_LENGTH * 4) {
      return reply.status(400).send({ error: "description is too long" });
    }
    const pictures = await loadDescribablePictures(app.db, scope, owner, [imageId]);
    if (!pictures.has(imageId)) return reply.status(404).send({ error: "Not found" });
    const description = normalizeGalleryDescription(raw);
    await saveGalleryDescription(app.db, scope, imageId, description);
    return { id: imageId, description };
  });

  app.post<{
    Params: { scope: string };
    Body: { ownerId?: unknown; imageIds?: unknown; overwrite?: unknown; connectionId?: unknown };
  }>("/:scope/describe", async (req, reply) => {
    const { scope } = req.params;
    if (!isGalleryDescriptionScope(scope)) return reply.status(400).send({ error: "Unknown gallery" });
    const owner = readOwner(scope, req.body?.ownerId);
    if (owner && typeof owner === "object") return reply.status(400).send(owner);
    const imageIds = Array.isArray(req.body?.imageIds)
      ? [...new Set(req.body.imageIds.filter((id): id is string => typeof id === "string" && !!id))]
      : [];
    if (imageIds.length === 0) return reply.status(400).send({ error: "imageIds is required" });
    if (imageIds.length > GALLERY_DESCRIBE_BATCH_MAX) {
      return reply.status(400).send({ error: `At most ${GALLERY_DESCRIBE_BATCH_MAX} pictures per request` });
    }
    const overwrite = req.body?.overwrite === true;
    const requestedConnectionId =
      typeof req.body?.connectionId === "string" && req.body.connectionId.trim() ? req.body.connectionId.trim() : null;

    // The Image reading model describes; without one, the chat's own Model (when sent), then the agents' Model.
    const visionSettings = visionCaptionSettings(await readFeatureModelConnections(app.db).catch(() => null));
    const fallbackConnectionId =
      requestedConnectionId ??
      (visionSettings.visionConnectionId ? null : ((await connections.getFallbackForAgents())?.id ?? null));
    const runtime = await resolveImageCaptioningRuntime({
      chatMeta: { imageCaptioningEnabled: true },
      fallbackConnectionId,
      connections,
      ...visionSettings,
    });
    if (!runtime.provider || !runtime.connection) {
      return reply.status(409).send({
        error: `No model can describe pictures: ${runtime.unavailableReason ?? "choose an Image reading model in Settings"}`,
        code: "no-vision-model",
      });
    }

    const pictures = await loadDescribablePictures(app.db, scope, owner, imageIds);
    // The request stream has already ended here (the body was read), so watch the response for a dropped client.
    const controller = new AbortController();
    reply.raw.on("close", () => {
      if (!reply.raw.writableFinished) controller.abort(new DOMException("The request was cancelled.", "AbortError"));
    });

    type Result = { id: string; description?: string | null; skipped?: boolean; error?: string };
    const results: Result[] = new Array(imageIds.length);
    let next = 0;
    const worker = async () => {
      while (next < imageIds.length) {
        const index = next++;
        const id = imageIds[index]!;
        const picture = pictures.get(id);
        if (!picture) {
          results[index] = { id, error: "Not found" };
          continue;
        }
        if (picture.description && !overwrite) {
          results[index] = { id, description: picture.description, skipped: true };
          continue;
        }
        try {
          const description = await describePicture(picture, runtime, controller.signal);
          await saveGalleryDescription(app.db, scope, id, description);
          results[index] = { id, description };
        } catch (error) {
          if (controller.signal.aborted) throw error;
          logger.warn(error, "[gallery-descriptions] Could not describe %s picture %s", scope, id);
          const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
          results[index] = {
            id,
            error: `${error instanceof Error ? error.message : String(error)}${cause}`.slice(0, 300),
          };
        }
      }
    };
    try {
      await Promise.all([worker(), worker()]);
    } catch (error) {
      if (controller.signal.aborted) return reply.status(499).send({ error: "Cancelled" });
      throw error;
    }
    return { model: runtime.connection.name ?? runtime.connection.model, results };
  });
}
