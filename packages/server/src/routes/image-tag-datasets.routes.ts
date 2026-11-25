import type { FastifyInstance } from "fastify";
import { IMAGE_TAG_LIMITS, type ImageTagCategory, type ImageTagSearchRequest } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createImageTagDatasetStore, ImageTagDatasetError } from "../services/image-tags/datasets.js";
import { getDataDir } from "../utils/data-dir.js";

export async function imageTagDatasetRoutes(app: FastifyInstance) {
  const store = createImageTagDatasetStore(getDataDir());
  app.addHook("onRequest", async (request, reply) => {
    requirePrivilegedAccess(request, reply, { signedIn: true, feature: "Image tag datasets" });
  });

  app.get("/", async () => store.list());
  app.post<{ Body: ImageTagSearchRequest }>("/search", { bodyLimit: 16 * 1024 }, async (request) =>
    store.search(request.body),
  );

  app.post("/import", { bodyLimit: IMAGE_TAG_LIMITS.uploadBytes + 16 * 1024 }, async (request, reply) => {
    let bytes: Buffer | undefined;
    let originalName: string | undefined;
    const fields: Record<string, string> = {};
    for await (const part of request.parts({
      limits: { files: 1, fields: 4, parts: 5, fileSize: IMAGE_TAG_LIMITS.uploadBytes, fieldSize: 2048 },
    })) {
      if (part.type === "file") {
        if (part.fieldname !== "file" || !part.filename.toLowerCase().endsWith(".csv"))
          throw new ImageTagDatasetError("Choose a CSV file");
        bytes = await part.toBuffer();
        originalName = part.filename.split(/[\\/]/).pop();
      } else {
        if (
          !["name", "category", "replaceId", "sourceUrl"].includes(part.fieldname) ||
          typeof part.value !== "string" ||
          part.fieldname in fields ||
          part.valueTruncated
        ) {
          throw new ImageTagDatasetError("Invalid image tag import fields");
        }
        fields[part.fieldname] = part.value;
      }
    }
    if (!bytes || !originalName) throw new ImageTagDatasetError("Choose a CSV file");
    if (fields.category !== undefined && !/^[01345]$/.test(fields.category))
      throw new ImageTagDatasetError("Choose a supported Danbooru category");
    const summary = await store.importCsv(bytes, {
      originalName,
      name: fields.name,
      category: fields.category === undefined ? undefined : (Number(fields.category) as ImageTagCategory),
      replaceId: fields.replaceId,
      sourceUrl: fields.sourceUrl,
    });
    return reply.status(201).send(summary);
  });

  app.patch<{ Params: { id: string }; Body: Parameters<typeof store.update>[1] }>(
    "/:id",
    { bodyLimit: 4096 },
    async (request) => store.update(request.params.id, request.body),
  );
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await store.remove(request.params.id);
    return reply.status(204).send();
  });
}
