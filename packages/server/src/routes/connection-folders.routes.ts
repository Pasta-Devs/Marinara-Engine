// ──────────────────────────────────────────────
// Routes: API Connection Folders
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createConnectionFolderSchema,
  moveConnectionToFolderSchema,
  reorderConnectionsInFolderSchema,
} from "@marinara-engine/shared";
import { createConnectionFoldersStorage } from "../services/storage/connection-folders.storage.js";
import { registerFolderCrudRoutes } from "./folder-routes.shared.js";
import { notFound } from "../utils/not-found.js";

export async function connectionFoldersRoutes(app: FastifyInstance) {
  const storage = createConnectionFoldersStorage(app.db);

  registerFolderCrudRoutes(app, createConnectionFolderSchema, storage);

  // ── Move a connection into (or out of) a folder ──
  app.post("/move-connection", async (req, reply) => {
    const { connectionId, folderId } = moveConnectionToFolderSchema.parse(req.body);
    if (folderId) {
      const folder = await storage.getById(folderId);
      if (!folder) return notFound(reply, "Folder not found");
    }
    await storage.moveConnection(connectionId, folderId);
    return reply.send({ ok: true });
  });

  // ── Reorder connections within a folder (or root) ──
  app.post("/reorder-connections", async (req, reply) => {
    const { orderedConnectionIds, folderId } = reorderConnectionsInFolderSchema.parse(req.body);
    await storage.reorderConnections(orderedConnectionIds, folderId);
    return reply.send({ ok: true });
  });
}
