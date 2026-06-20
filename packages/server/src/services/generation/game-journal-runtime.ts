import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createJournal, type Journal } from "../game/journal.service.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { parseExtra } from "../../routes/generate/generate-route-utils.js";

export async function updateJournal(
  db: DB,
  chatId: string,
  transform: (journal: Journal) => Journal | null,
): Promise<void> {
  try {
    const chatsStore = createChatsStorage(db);
    const chat = await chatsStore.getById(chatId);
    if (!chat) return;
    const meta = parseExtra(chat.metadata) as Record<string, unknown>;
    const journal = (meta.gameJournal as Journal) ?? createJournal();
    const updated = transform(journal);
    if (updated) {
      await chatsStore.updateMetadata(chatId, { ...meta, gameJournal: updated });
    }
  } catch (error) {
    logger.warn(error, "[game] Journal auto-fill failed for chat %s", chatId);
    // Non-critical; generation should not fail because journal auto-fill failed.
  }
}
