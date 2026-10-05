import {
  getChatWindowDefaultSettingsKey,
  getLegacyChatWindowLayout,
  type ChatMode,
  type ChatWindowDefault,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { desc } from "../../db/file-query.js";
import { chats } from "../../db/schema/index.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";

export const CHAT_WINDOW_DEFAULT_UPGRADE_KEY = "chat-window-default-upgrade-v1";
const MODES: ChatMode[] = ["conversation", "roleplay", "game"];

/** Preserve the old toolbar as the starting layout once, before this install serves requests. */
export async function initializeChatWindowDefaults(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    const settings = createAppSettingsStorage(tx);
    if ((await settings.get(CHAT_WINDOW_DEFAULT_UPGRADE_KEY)) !== null) return;
    const rows = await tx
      .select({ mode: chats.mode, metadata: chats.metadata })
      .from(chats)
      .orderBy(desc(chats.updatedAt));
    const latest = new Map<ChatMode, ChatWindowDefault>();
    let upgrading = false;
    for (const row of rows) {
      let metadata: unknown;
      try {
        metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      } catch {
        continue;
      }
      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata) ||
        Object.hasOwn(metadata, "windowLayout")
      )
        continue;
      const record = metadata as Record<string, unknown>;
      const layout = getLegacyChatWindowLayout(row.mode, record);
      if (!layout) continue;
      upgrading = true;
      if (!latest.has(row.mode))
        latest.set(row.mode, {
          windowLayout: layout,
          chatSettingsHintDismissed: record.chatSettingsHintDismissed === true,
        });
    }
    if (upgrading) {
      for (const mode of MODES) {
        const key = getChatWindowDefaultSettingsKey(mode);
        // Even a saved null or corrupt value is an explicit choice; only missing keys are seeded.
        if ((await settings.get(key)) !== null) continue;
        const favorite = latest.get(mode) ?? {
          windowLayout: getLegacyChatWindowLayout(mode, { enableAgents: true }),
          chatSettingsHintDismissed: false,
        };
        await settings.set(key, JSON.stringify(favorite));
      }
    }
    // Mark fresh installs too: importing an old chat later must not change their defaults.
    await settings.set(CHAT_WINDOW_DEFAULT_UPGRADE_KEY, "1");
  });
}
