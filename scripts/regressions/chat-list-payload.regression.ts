import assert from "node:assert/strict";
import { request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

const dataDir = await mkdtemp(join(tmpdir(), "marinara-chat-list-payload-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chats } = await import("../../packages/server/src/db/schema/chats.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { compressJsonHook } = await import("../../packages/server/src/middleware/compress-json.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");

const db = await getDB();
const metadata = { summary: "A retained story detail. ".repeat(200_000), tags: ["payload-proof"] };
const embedding = JSON.stringify(Array.from({ length: 160_000 }, (_, i) => (i % 1000) / 1000));
await db.insert(chats).values({
  id: "payload-proof",
  name: "Retained chat",
  mode: "roleplay",
  characterIds: "[]",
  metadata: JSON.stringify(metadata),
  embedding,
  writeOrdinalCounter: 42,
  lastMessageAt: "2026-10-30T00:00:00.000Z",
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
});
const app = Fastify();
app.decorate("db", db);
app.addHook("onSend", compressJsonHook);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.listen({ host: "127.0.0.1", port: 0 });
const { port } = app.server.address() as AddressInfo;
const storage = createChatsStorage(db);

after(async () => {
  await app.close();
  await closeDB();
  await rm(dataDir, { recursive: true, force: true });
});

function get(encoding?: string) {
  return new Promise<{ headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path: "/api/chats", headers: encoding ? { "accept-encoding": encoding } : {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("chat lists retain public metadata without returning stored vectors or write counters", async () => {
  const result = await get();
  const [chat] = JSON.parse(result.body.toString());
  assert.ok(!Object.hasOwn(chat, "embedding"), "the list does not transfer the internal embedding");
  assert.ok(!Object.hasOwn(chat, "writeOrdinalCounter"), "the list does not transfer the internal counter");
  assert.equal(chat.id, "payload-proof");
  assert.deepEqual(chat.characterIds, []);
  assert.deepEqual(chat.metadata, metadata, "complete public metadata is retained, including large summaries");
  const stored = await storage.getById("payload-proof");
  assert.equal(stored?.embedding, embedding, "response projection never removes the stored vector");
  assert.equal(stored?.writeOrdinalCounter, 42);
});

test("large returned chat lists compress over real HTTP and stay plain for internal injection", async () => {
  for (const encoding of ["br", "gzip"] as const) {
    const response = await get(encoding);
    assert.equal(response.headers["content-encoding"], encoding, "lists over 4 MiB still compress");
    const body = encoding === "br" ? brotliDecompressSync(response.body) : gunzipSync(response.body);
    assert.ok(body.length > 4 * 1024 * 1024, "the proof exercises an above-cap body after projection too");
    assert.ok(response.body.length < body.length / 10);
    assert.deepEqual(JSON.parse(body.toString())[0].metadata, metadata);
    assert.match(String(response.headers.vary), /Accept-Encoding/i);
    assert.equal(Number(response.headers["content-length"]), response.body.length);
  }
  const plain = await get("identity");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.deepEqual(JSON.parse(plain.body.toString())[0].metadata, metadata);
  assert.match(String(plain.headers.vary), /Accept-Encoding/i);
  const internal = await app.inject({ url: "/api/chats", headers: { "accept-encoding": "br, gzip" } });
  assert.equal(internal.headers["content-encoding"], undefined);
  assert.deepEqual(internal.json()[0].metadata, metadata);
});
