/**
 * A preset's Memory Recall marker in a real turn: when recall adds nothing, the marker's slot never reaches the
 * provider, and the rest of the prompt (lore before the history) is unchanged.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-memory-recall-marker-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { createLorebookSchema, createLorebookEntrySchema } = await import("../../../packages/shared/src/index.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

type Sent = Array<{ role: string; content: string }>;
const db = await getDB();
const sent: Sent[] = [];
let replyNumber = 0;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  sent.push(JSON.parse(Buffer.concat(chunks).toString() || "{}").messages ?? []);
  replyNumber += 1;
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: `REPLY_${replyNumber}` }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Memory marker fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 256,
  });
  const lorebooks = createLorebooksStorage(db);
  const world = await lorebooks.create(createLorebookSchema.parse({ name: "World" }));
  await lorebooks.createEntry(
    createLorebookEntrySchema.parse({ lorebookId: world.id, name: "Always", content: "LORE_ENTRY", constant: true }),
  );
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Lore first", parameters: { maxTokens: 256, maxContext: 32768 } });
  assert(connection && preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "main",
    name: "Main",
    content: "STABLE_RULE",
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "lore",
    name: "Lorebook",
    isMarker: true,
    markerConfig: { type: "lorebook" },
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "recall",
    name: "Memory Recall",
    isMarker: true,
    markerConfig: { type: "memory_recall" },
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  } as never);

  const chats = createChatsStorage(db);
  const runChat = async () => {
    const chat = await chats.create({
      name: "Memory Recall marker",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: preset.id,
    } as never);
    assert(chat);
    await chats.patchMetadata(chat.id, {
      activeLorebookIds: [world.id],
      enableAgents: false,
      enableMemoryRecall: false,
    });
    const prompts: Sent[] = [];
    for (const words of ["TURN_ONE", "TURN_TWO", "TURN_THREE"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, userMessage: words },
      });
      assert.equal(response.statusCode, 200, response.body);
      prompts.push(sent.at(-1)!);
    }
    return prompts;
  };
  // Strict providers merge neighbouring messages, so compare positions in the prompt text.
  const indexOf = (prompt: Sent, needle: string) => {
    const index = prompt
      .map((message) => message.content)
      .join("\n\n")
      .indexOf(needle);
    assert.ok(index >= 0, `${needle} is in the prompt`);
    return index;
  };

  const prompts = await runChat();
  const last = prompts[2]!;
  assert.ok(indexOf(last, "LORE_ENTRY") < indexOf(last, "TURN_ONE"), "lore stays before the history");
  assert.ok(indexOf(last, "STABLE_RULE") < indexOf(last, "TURN_ONE"));
  assert.doesNotMatch(JSON.stringify(prompts), /MARINARA_MEMORY_RECALL/u, "an unfilled recall marker is dropped");
  console.log("ok - an unfilled Memory Recall marker never reaches the provider");
} finally {
  await app.close();
  provider.close();
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
