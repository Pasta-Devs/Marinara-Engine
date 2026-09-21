import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-inspector-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAdvancedMemoryService, advancedMemorySourceFingerprint } =
  await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/types/advanced-memory.js");
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = require("fastify")();
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
app.decorate("db", db);
await app.register(advancedMemoryRoutes, { prefix: "/chats" });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const parse = JSON.parse;
let metadataParses = 0;
try {
  const chat = await chats.create({ name: "Large prepared archive", mode: "roleplay", characterIds: [] });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
    advancedMemoryState: { status: "ready", stage: "ready" },
  });
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 1000 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: "A historical event. ".repeat(250),
      extra: { syntheticMemoryPerf: true, unusedSnapshot: "scene snapshot ".repeat(1200) },
    })),
  );
  const source = await chats.listMessages(chat.id);
  const policy = hash([false, [], {}, null]);
  const rows = [];
  for (const kind of ["scene", "excerpt"] as const) {
    const count = kind === "scene" ? 50 : 3;
    for (let index = 0; index < source.length; index += count) {
      const chunk = source.slice(index, index + count);
      rows.push({
        id: `${kind}-${index}-saved`,
        chatId: chat.id,
        sceneId: `scene-${Math.floor(index / 50)}`,
        kind,
        status: "closed",
        startMessageId: chunk[0]!.id,
        endMessageId: chunk.at(-1)!.id,
        messageIds: JSON.stringify(chunk.map((message) => message.id)),
        audienceCharacterIds: "[]",
        content:
          kind === "scene" ? "Historical recap. ".repeat(60) : chunk.map((message) => message.content).join("\n"),
        title: "Scene",
        timeline: null,
        enabled: 1,
        manualOverride: 0,
        sourceFingerprint: hash([advancedMemorySourceFingerprint(chunk), policy, []]),
        dependencies: "[]",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await db.insert(advancedMemoryRecords).values(rows);
  JSON.parse = (text, reviver) => {
    if (text.includes('"syntheticMemoryPerf"')) metadataParses++;
    return parse(text, reviver);
  };
  const full = await memory.status(chat.id);
  assert(
    full.records.some((record) => record.kind === "excerpt"),
    "internal archive status retains excerpts",
  );
  assert(
    full.records.every((record) => record.embeddingStatus === "pending"),
    "source validation remains active",
  );
  assert(metadataParses <= source.length * 2, "status parses metadata once per source, not once per archive record");
  const url = `/chats/${chat.id}/advanced-memory`;
  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    metadataParses = 0;
    const started = performance.now();
    const response = await app.inject({
      method,
      url: method === "GET" ? url : `${url}/records/scene-0-saved`,
      ...(method === "PATCH" ? { payload: { enabled: false } } : {}),
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(metadataParses <= source.length * 3, "record mutations do not repeatedly parse the entire transcript");
    assert(response.body.length < 150_000, "inspector responses do not resend megabytes of hidden excerpts");
    const state = response.json();
    assert(state.records.every((record: { kind: string }) => record.kind !== "excerpt"));
    assert.equal(state.job.status, "ready", "small archive edits do not start preparation");
    const selected = state.records.find((record: { id: string }) => record.id === "scene-0-saved");
    if (method === "PATCH") assert.equal(selected.enabled, false);
    if (method === "DELETE") assert.equal(selected, undefined);
    console.info(
      `${method} on 1000-message archive: ${Math.round(performance.now() - started)} ms, ${response.body.length} bytes`,
    );
  }
  const exported = await memory.exportMemory(chat.id);
  assert(
    exported.records.some((entry) => entry.record.kind === "excerpt"),
    "export still includes recalled excerpts",
  );
  assert.deepEqual(await chats.listMessages(chat.id), source, "editing memories never changes source messages");
  const sourceResponse = await app.inject({ method: "GET", url: `${url}/records/scene-50-saved/sources` });
  assert.equal(sourceResponse.statusCode, 200);
  assert.equal(sourceResponse.json().length, 50, "source inspection still fetches complete source messages on demand");
  await chats.updateMessageContent(source[50]!.id, "Changed source");
  const changed = (await app.inject({ method: "GET", url })).json();
  assert.equal(
    changed.records.find((record: { id: string }) => record.id === "scene-50-saved").embeddingStatus,
    "stale",
  );
  console.info(
    "Advanced Memory inspector regression passed (large archive, compact status, toggle/delete and source revisions).",
  );
} finally {
  JSON.parse = parse;
  await app.close();
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
