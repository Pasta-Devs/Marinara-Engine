import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-context-turn-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const prompts: string[] = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.map((message: { content: unknown }) => JSON.stringify(message.content)).join("\n");
  const isAgent = prompt.includes("CONTEXT_FIXTURE");
  if (isAgent) prompts.push(prompt);
  const content = isAgent
    ? JSON.stringify({ text: "Public hint", "agent-context": `SECRET_${prompts.length}` })
    : "The story continues.";
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const agent = await agents.create({
    type: "custom-context-fixture",
    name: "Context fixture",
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "CONTEXT_FIXTURE prior: {{agent::custom-context-fixture}}",
    settings: { resultType: "context_injection", contextSources: { previousOutput: true }, jsonContextOutput: true },
  });
  assert.ok(agent);
  const chat = await chats.create({
    name: "Context turn",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: null,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [agent.type] });
  const generate = async (regenerateMessageId?: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, regenerateMessageId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });
  await generate();
  assert.equal(prompts.length, 1);
  const first = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant");
  assert.ok(first);
  const runs = await agents.listCustomRunsForChat(chat.id);
  assert.equal(
    runs[0]?.messageId,
    first.id,
    "Successful pre-generation context belongs to the assistant turn, not its user prompt",
  );
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue." });
  await generate();
  const second = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1);
  assert.ok(second);
  assert.ok(prompts[1]?.includes("SECRET_1"));
  await generate(second.id);
  assert.equal(prompts.length, 2, "Preserve the existing cached pre-generation behavior on regeneration");
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_1",
    "An inactive assistant swipe must not supply private context",
  );
  await chats.setActiveSwipe(second.id, 0);
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_2",
  );
  await chats.removeMessage(second.id);
  assert.equal(
    ((await agents.getPreviousOutput(agent.id, chat.id)) as Record<string, unknown>)["agent-context"],
    "SECRET_1",
  );
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue after rewind." });
  await generate();
  assert.ok(prompts[2]?.includes("SECRET_1"));
  assert.ok(
    !prompts[2]?.includes("SECRET_2"),
    "The next iteration must not read the discarded turn's pre-generation context",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Real generation and regeneration keep custom-agent context anchored to the active assistant swipe.");
