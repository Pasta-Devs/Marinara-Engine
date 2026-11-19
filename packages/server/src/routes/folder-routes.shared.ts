import {
  folderIdParamsSchema,
  reorderFoldersSchema,
  updateFolderSchema,
  type UpdateFolderInput,
} from "@marinara-engine/shared";
import type { FastifyInstance } from "fastify";
import type { ZodType } from "zod";
import { logger } from "../lib/logger.js";
import { notFound } from "../utils/not-found.js";

type StoredFolder = {
  collapsed: string;
};

type FolderCrudStorage<TCreate, TFolder extends StoredFolder> = {
  list(): Promise<TFolder[]>;
  getById(id: string): Promise<TFolder | null>;
  create(input: TCreate): Promise<TFolder | null>;
  update(id: string, input: UpdateFolderInput): Promise<TFolder | null>;
  remove(id: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
};

function serializeFolder<TFolder extends StoredFolder>(folder: TFolder) {
  return {
    ...folder,
    collapsed: folder.collapsed === "true",
  };
}

export function registerFolderCrudRoutes<TCreate, TFolder extends StoredFolder>(
  app: FastifyInstance,
  createSchema: ZodType<TCreate>,
  storage: FolderCrudStorage<TCreate, TFolder>,
) {
  app.get("/", async (_req, reply) => {
    const folders = await storage.list();
    return reply.send(folders.map(serializeFolder));
  });

  app.post("/", async (req, reply) => {
    const input = createSchema.parse(req.body);
    const folder = await storage.create(input);
    if (!folder) {
      logger.error("Folder storage.create returned no folder");
      return reply.status(500).send({ error: "Failed to create folder" });
    }
    return reply.send(serializeFolder(folder));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = folderIdParamsSchema.parse(req.params);
    const input = updateFolderSchema.parse(req.body);
    const existing = await storage.getById(id);
    if (!existing) return notFound(reply, "Folder not found");
    const folder = await storage.update(id, input);
    if (!folder) {
      logger.error("Folder storage.update returned no folder for %s", id);
      return reply.status(500).send({ error: "Failed to update folder" });
    }
    return reply.send(serializeFolder(folder));
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = folderIdParamsSchema.parse(req.params);
    const existing = await storage.getById(id);
    if (!existing) return notFound(reply, "Folder not found");
    await storage.remove(id);
    return reply.send({ ok: true });
  });

  app.post("/reorder", async (req, reply) => {
    const { orderedIds } = reorderFoldersSchema.parse(req.body);
    await storage.reorder(orderedIds);
    return reply.send({ ok: true });
  });
}
