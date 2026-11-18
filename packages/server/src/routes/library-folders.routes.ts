// ──────────────────────────────────────────────
// Routes: Resource Library Folders
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createLibraryFolderSchema,
  libraryFolderParamsSchema,
  libraryFolderScopeParamsSchema,
  migrateLibraryFoldersSchema,
  moveLibraryItemsSchema,
  updateLibraryFolderSchema,
} from "@marinara-engine/shared";
import { createLibraryFoldersStorage } from "../services/storage/library-folders.storage.js";
import { notFound } from "../utils/not-found.js";

export async function libraryFoldersRoutes(app: FastifyInstance) {
  const storage = createLibraryFoldersStorage(app.db);

  app.get("/:scope", async (req) => {
    const { scope } = libraryFolderScopeParamsSchema.parse(req.params);
    return storage.list(scope);
  });

  app.post("/:scope/migrate", async (req) => {
    const { scope } = libraryFolderScopeParamsSchema.parse(req.params);
    const input = migrateLibraryFoldersSchema.parse(req.body);
    return storage.migrate(scope, input);
  });

  app.post("/:scope/move", async (req, reply) => {
    const { scope } = libraryFolderScopeParamsSchema.parse(req.params);
    const input = moveLibraryItemsSchema.parse(req.body);
    const moved = await storage.moveItems(scope, input);
    if (!moved) return notFound(reply, "Folder not found");
    return reply.send({ ok: true });
  });

  app.post("/:scope", async (req) => {
    const { scope } = libraryFolderScopeParamsSchema.parse(req.params);
    const input = createLibraryFolderSchema.parse(req.body);
    return storage.create(scope, input);
  });

  app.patch("/:scope/:id", async (req, reply) => {
    const { scope, id } = libraryFolderParamsSchema.parse(req.params);
    const input = updateLibraryFolderSchema.parse(req.body);
    const folder = await storage.update(scope, id, input);
    if (!folder) return notFound(reply, "Folder not found");
    return reply.send(folder);
  });

  app.delete("/:scope/:id", async (req, reply) => {
    const { scope, id } = libraryFolderParamsSchema.parse(req.params);
    const removed = await storage.remove(scope, id);
    if (!removed) return notFound(reply, "Folder not found");
    return reply.status(204).send();
  });
}
