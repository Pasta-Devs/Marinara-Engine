// After a Roleplay reply is saved, its post-processing agents keep running on their own: the chat's generation slot
// is free again while the status still shows agents at work, Stop Agents cancels them without touching the reply, and
// their result lands on the swipe they were made for even if the user swipes meanwhile. Variables the reply sets are
// merged with an edit the user made while it was being written.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-agent-tail-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { OpenAIProvider } = await import("../../../packages/server/src/services/llm/providers/openai.provider.js");
const { replaceBuiltInAgentDefinitions } = await import("../../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  { id: "cyoa", name: "CYOA Choices", description: "Fixture", category: "misc", phase: "post_processing" },
]);

// The reply and the agent each answer once the test lets them.
let replyGate = Promise.withResolvers<void>();
let replyStarted = Promise.withResolvers<void>();
let agentGate = Promise.withResolvers<void>();
let agentStarted = Promise.withResolvers<void>();
OpenAIProvider.prototype.chat = async function* () {
  replyStarted.resolve();
  await replyGate.promise;
  yield "The lantern flickers.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async () => {
  agentStarted.resolve();
  await agentGate.promise;
  return {
    content: JSON.stringify({ choices: [{ label: "A", text: "Trim the wick." }] }),
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};

const db = await getDB();
const chats = createChatsStorage(db);
const activeGenerations = new Map<string, unknown>();
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", activeGenerations);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Agent tail fixture",
    provider: "openai",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  assert.ok(connection);
  await createAgentsStorage(db).create({
    type: "cyoa",
    name: "CYOA Choices",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "CHOICES_TASK",
    settings: {},
  });
  const extra = (row: { extra: unknown }) =>
    typeof row.extra === "string" ? JSON.parse(row.extra) : ((row.extra ?? {}) as Record<string, unknown>);
  const variables = async (chatId: string) => {
    const metadata = (await chats.getById(chatId))?.metadata;
    return (typeof metadata === "string" ? JSON.parse(metadata) : (metadata ?? {})).macroVariables ?? {};
  };
  const status = async (chatId: string) =>
    (await app.inject({ method: "GET", url: `/api/generate/status/${chatId}` })).json().active as boolean;

  for (const stopAgents of [false, true]) {
    const chat = await chats.create({
      name: stopAgents ? "Stopped tail" : "Finished tail",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      enableTools: false,
      activeAgentIds: ["cyoa"],
      authorNotes: "{{setvar::mood::tense}}Keep the lantern lit.",
      macroVariables: { hero: "Ann" },
    });
    replyGate = Promise.withResolvers<void>();
    replyStarted = Promise.withResolvers<void>();
    agentGate = Promise.withResolvers<void>();
    agentStarted = Promise.withResolvers<void>();
    const generation = app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "Light the lantern." },
    });

    // The user renames the hero while the reply is still being written.
    await replyStarted.promise;
    await chats.patchMetadata(chat.id, (current) => ({
      ...current,
      macroVariables: { ...(current.macroVariables as Record<string, string>), hero: "Mary" },
    }));
    replyGate.resolve();

    await agentStarted.promise;
    const reply = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant");
    assert.ok(reply, "the reply is saved before its agents finish");
    assert.equal(activeGenerations.has(chat.id), false, "the saved reply frees the chat's generation slot");
    assert.equal(await status(chat.id), true, "the status still shows the agents at work");

    if (stopAgents) {
      const stopped = await app.inject({
        method: "POST",
        url: "/api/generate/abort",
        payload: { chatId: chat.id, agentsOnly: true },
      });
      assert.equal(stopped.json().aborted, true, stopped.body);
    } else {
      // The user swipes to a new take while the agent still works on the first one.
      await chats.addSwipe(reply.id, "The lantern goes out.");
      await chats.setActiveSwipe(reply.id, 1);
    }
    agentGate.resolve();
    const response = await generation;
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(await status(chat.id), false);

    const swipes = await chats.getSwipes(reply.id);
    const first = swipes.find((swipe) => swipe.index === 0)!;
    if (stopAgents) {
      assert.equal(extra(first).cyoaChoices, undefined, "a stopped agent saves no choices");
      assert.equal((await chats.getMessage(reply.id))?.content, "The lantern flickers.", "Stop Agents keeps the reply");
    } else {
      assert.deepEqual(
        extra(first).cyoaChoices,
        [{ label: "A", text: "Trim the wick." }],
        "the choices land on the swipe the agent was made for",
      );
      const second = swipes.find((swipe) => swipe.index === 1)!;
      assert.equal(extra(second).cyoaChoices, undefined, "the newer swipe gets no choices it was not made for");
      assert.deepEqual(
        await variables(chat.id),
        { hero: "Mary", mood: "tense" },
        "the reply's variables merge with the user's edit",
      );
    }
  }
  console.info("Agent tail after reply regression passed.");
} finally {
  replyGate.resolve();
  agentGate.resolve();
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
