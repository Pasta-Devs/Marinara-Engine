import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A chat with no Model of its own follows Main, so the game and summary resolvers must land on Main, not fail.
const dir = mkdtempSync(join(tmpdir(), "marinara-unset-main-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { resolveGameConnection } = await import("../../packages/server/src/services/game/connection.service.js");
const { resolveChatSummaryConnection } =
  await import("../../packages/server/src/services/chat-summary/connection-resolution.js");

try {
  const db = await getDB();
  const connections = createConnectionsStorage(db);
  const main = await connections.create({
    name: "Main model",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    apiKey: "k",
    model: "m",
  });
  assert.ok(main);
  await connections.update(main.id, { isDefault: "true" });

  const game = await resolveGameConnection(connections, undefined, { connectionId: null, metadata: {} });
  assert.equal(game.conn.id, main.id, "A game chat without a Model must use Main");

  const summary = await resolveChatSummaryConnection({
    chatConnectionId: null,
    chatMetadata: {},
    connections,
    resolveBaseUrl: (connection) => connection.baseUrl ?? "",
  });
  assert.ok(summary.ok, "A summary for a chat without a Model must use Main");

  const own = await connections.create({
    name: "Own model",
    provider: "custom",
    baseUrl: "http://127.0.0.1:2/v1",
    apiKey: "k",
    model: "own",
  });
  assert.ok(own);
  const ownSummary = await resolveChatSummaryConnection({
    chatConnectionId: own.id,
    chatMetadata: {},
    connections,
    resolveBaseUrl: (connection) => connection.baseUrl ?? "",
  });
  assert.ok(
    ownSummary.ok && ownSummary.connectionId === own.id,
    "A chat with its own Model summarises with it, not Main",
  );

  const { resolveIllustratorPromptRuntime } =
    await import("../../packages/server/src/services/generation/illustrator-prompt-runtime.js");
  const illustrator = await resolveIllustratorPromptRuntime({
    chatMetadata: {},
    defaultConnection: null,
    defaultConnectionId: null,
    connections,
    resolveBaseUrl: (connection) => connection.baseUrl ?? "",
  });
  assert.equal(illustrator.connectionId, main.id, "Selfie prompts for a chat that follows Main use Main");
  console.log("Unset chats resolve to Main.");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
