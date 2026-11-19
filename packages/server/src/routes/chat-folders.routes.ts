// ──────────────────────────────────────────────
// Routes: Chat Folders
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createChatFolderSchema, moveChatToFolderSchema, reorderChatsInFolderSchema } from "@marinara-engine/shared";
import { createChatFoldersStorage } from "../services/storage/chat-folders.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { registerFolderCrudRoutes } from "./folder-routes.shared.js";
import { notFound } from "../utils/not-found.js";

export async function chatFoldersRoutes(app: FastifyInstance) {
  const storage = createChatFoldersStorage(app.db);
  const chatsStorage = createChatsStorage(app.db);

  registerFolderCrudRoutes(app, createChatFolderSchema, storage);

  // ── Move a chat into (or out of) a folder ──
  app.post("/move-chat", async (req, reply) => {
    const { chatId, folderId } = moveChatToFolderSchema.parse(req.body);
    // Validate folder exists if non-null
    if (folderId) {
      const folder = await storage.getById(folderId);
      if (!folder) return notFound(reply, "Folder not found");
    }
    // Propagate the folder to every branch in the group so later branch
    // creation/deletion doesn't drop the tree back into Uncategorized.
    const chat = await chatsStorage.setFolderForChat(chatId, folderId);
    return reply.send(chat);
  });

  // ── Reorder chats within a folder (or root) ──
  app.post("/reorder-chats", async (req, reply) => {
    const { orderedChatIds, folderId } = reorderChatsInFolderSchema.parse(req.body);
    // Atomic: a partial failure mid-loop would leave chats with a mix of
    // old and new sort_order / folder_id values across siblings of the
    // same group. Chats-per-folder counts are O(dozens), well under the
    // threshold for an excessively large single storage operation.
    await app.db.transaction(async (tx) => {
      for (let i = 0; i < orderedChatIds.length; i++) {
        const id = orderedChatIds[i]!;
        // Update sortOrder on the visible representative chat, then propagate
        // the folder assignment to its sibling branches.
        await chatsStorage.update(id, { sortOrder: i + 1 }, { tx });
        await chatsStorage.setFolderForChat(id, folderId, { tx });
      }
    });
    return reply.send({ ok: true });
  });
}
