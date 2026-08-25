import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { PROFESSOR_MARI_APP_DATA_ACTIONS } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import { createChatsStorage } from "../../../packages/server/src/services/storage/chats.storage.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-chat-app-data-"));
process.env.FILE_STORAGE_DIR = dir;

try {
  const db = await createFileNativeDB();
  try {
    const chats = createChatsStorage(db);
    const chat = await chats.create({
      name: "App data chat regression",
      mode: "roleplay",
      characterIds: ["character-a"],
    });
    assert.ok(chat);
    await chats.createMessage({ chatId: chat.id, role: "user", content: "First" });
    await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Second" });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Third" });

    const mari = new MariDbService(db);
    assert.ok(PROFESSOR_MARI_APP_DATA_ACTIONS.includes("chat.messages"));

    const fetched = await mari.executeAction({ action: "chat.get", chatId: chat.id });
    assert.equal(fetched.ok, true);
    assert.equal((fetched.output as { messageCount?: number }).messageCount, 3);

    const messages = await mari.executeAction({ action: "chat.messages", chatId: chat.id, last: 2 });
    assert.deepEqual(
      (messages.output as { messages: Array<{ postNumber: number; content: string }> }).messages.map(
        ({ postNumber, content }) => ({ postNumber, content }),
      ),
      [
        { postNumber: 2, content: "Second" },
        { postNumber: 3, content: "Third" },
      ],
    );

    const oversizedContent = "x".repeat(40_000);
    await chats.createMessage({ chatId: chat.id, role: "assistant", content: oversizedContent });
    const bounded = await mari.executeAction({ action: "chat.messages", chatId: chat.id, last: 1 });
    assert.equal(bounded.truncation?.truncated, true);
    assert.ok(JSON.stringify(bounded.output).length < 28_000, "chat message pages must stay under the hard cap");

    const contentWindow = await mari.executeAction({
      action: "chat.messages",
      chatId: chat.id,
      last: 1,
      field: "messages[0].content",
      offset: 20_000,
      limit: 20_000,
    });
    assert.equal(contentWindow.output, oversizedContent.slice(20_000));
    assert.equal(contentWindow.truncation?.field?.offset, 20_000);

    const tailWindow = await mari.executeAction({
      action: "chat.messages",
      chatId: chat.id,
      last: 2,
      tail: true,
      field: "messages[0].content",
      offset: 30_000,
      limit: 10_000,
    });
    assert.equal(tailWindow.output, oversizedContent.slice(30_000));

    const search = await mari.executeAction({ action: "chats.search", query: "App data chat" });
    assert.equal(search.ok, true, "plural chat action aliases should resolve");
    assert.equal((search.output as Array<{ id: string }>)[0]?.id, chat.id);
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Mari chat app_data regressions passed.");
