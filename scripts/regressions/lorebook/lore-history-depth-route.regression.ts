/**
 * The chat's lorebook placement in a real turn: by default the preset's lorebook marker sits before the chat
 * history; with "Send inside the chat history" the entries go inside it at the chosen depth, wherever the preset puts
 * the marker. A preset's Memory Recall marker never reaches the provider when recall adds nothing.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-lore-history-depth-"));
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
    name: "Lore depth fixture",
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
  const runChat = async (loreHistoryDepth: number | null) => {
    const chat = await chats.create({
      name: `Depth ${loreHistoryDepth}`,
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
      ...(loreHistoryDepth === null ? {} : { loreHistoryDepth }),
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

  // Default: the preset's order, lore before the history.
  const [, , defaultPrompt] = await runChat(null);
  assert.ok(indexOf(defaultPrompt!, "LORE_ENTRY") < indexOf(defaultPrompt!, "TURN_ONE"), "lore before the history");
  assert.doesNotMatch(JSON.stringify(defaultPrompt), /MARINARA_MEMORY_RECALL/u, "unfilled recall marker is dropped");

  // Depth 2: inside the history, before the newest reply and message.
  const depthPrompts = await runChat(2);
  const third = depthPrompts[2]!;
  const lore = indexOf(third, "LORE_ENTRY");
  assert.ok(lore > indexOf(third, "TURN_TWO"), "after the older history");
  assert.ok(lore < indexOf(third, `REPLY_${replyNumber - 1}`), "before the newest reply");
  assert.ok(lore < indexOf(third, "TURN_THREE"), "before the newest message");
  assert.ok(indexOf(third, "STABLE_RULE") < indexOf(third, "TURN_ONE"));
  assert.doesNotMatch(JSON.stringify(depthPrompts), /MARINARA_MEMORY_RECALL/u);

  // Depth 0: after the newest message.
  const [, , lastPrompt] = await runChat(0);
  assert.ok(indexOf(lastPrompt!, "LORE_ENTRY") > indexOf(lastPrompt!, "TURN_THREE"), "after the newest message");
  console.log("ok - lorebook placement follows the chat's history depth in a real turn");
} finally {
  await app.close();
  provider.close();
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
