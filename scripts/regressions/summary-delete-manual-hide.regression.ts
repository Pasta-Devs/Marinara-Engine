import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A summary saved with "Hide summarised messages" off hid nothing, so deleting it, or branching inside its range,
// must not show a covered message the user hid by hand afterwards.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-summary-delete-manual-hide-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<any>;
} | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  app = await buildApp();
  await app.ready();
  const chats = createChatsStorage(await getDB());

  const request = async (method: string, url: string, payload: unknown) => {
    const response = await app!.inject({ method, url, payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const hiddenFromAI = async (chatId: string, index: number) => {
    const message = (await chats.listMessages(chatId))[index];
    assert(message);
    const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
    return extra.hiddenFromAI === true;
  };

  const chat = await request("POST", "/api/chats", { name: "Manual hide", mode: "roleplay", characterIds: [] });
  const messages = [];
  for (const content of ["First", "Second", "Third", "Fourth"]) {
    messages.push(await request("POST", `/api/chats/${chat.id}/messages`, { role: "user", content }));
  }
  const summarized = await request("PATCH", `/api/chats/${chat.id}/summary-entries`, {
    operation: "replace",
    entry: { id: "covering", content: "They met.", sourceMode: "range", rangeStartIndex: 1, rangeEndIndex: 3 },
  });
  const [covering] = summarized.metadata.summaryEntries;
  assert.equal(covering.messageIds.length, 3);
  assert.equal(covering.hiddenMessageIds, undefined, "hiding is off, so the summary hid nothing");
  await request("PATCH", `/api/chats/${chat.id}/messages/bulk-hidden`, { messageIds: [messages[1].id], hidden: true });
  assert.equal(await hiddenFromAI(chat.id, 1), true);

  const branch = await request("POST", `/api/chats/${chat.id}/branch`, { upToMessageId: messages[1].id });
  assert.equal(await hiddenFromAI(branch.id, 1), true, "branching inside the summary keeps the manual hide");

  await request("PATCH", `/api/chats/${chat.id}/summary-entries`, { operation: "delete", entryId: "covering" });
  assert.equal(await hiddenFromAI(chat.id, 1), true, "deleting a summary that hid nothing keeps the manual hide");

  console.log("summary delete manual hide regression passed");
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
