// A lorebook agent's naming scheme can say "[WorldName] Scenes". The world is the first character card's world, so a
// new lorebook it creates, or the approval it asks for, names that world. This runs after a reply and on a retry.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-world-name-"));
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
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { OpenAIProvider } = await import("../../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  { id: "world-name-fixture", name: "Fixture", description: "Fixture", category: "writer", phase: "post_processing" },
  {
    id: "lorebook-keeper",
    name: "Lorebook Keeper",
    description: "Fixture",
    category: "tracker",
    phase: "post_processing",
  },
]);

OpenAIProvider.prototype.chat = async function* () {
  yield "The caravan reaches the gate.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async () => ({
  content: JSON.stringify({
    updates: [{ name: "Gate scene", content: "The caravan waits.", targetLorebook: "scene" }],
  }),
  toolCalls: [],
  finishReason: "stop",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
});

const db = await getDB();
const chats = createChatsStorage(db);
const books = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "World name fixture",
    provider: "openai",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Mira", extensions: { world: "Eldoria" } }),
  );
  const home = (await books.create({ name: "Agent home" })) as unknown as { id: string };
  assert.ok(connection && character && home);
  const agents = createAgentsStorage(db);
  await agents.create({
    type: "world-scribe",
    name: "World scribe",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "WORLD_TASK",
    settings: {
      resultType: "lorebook_update",
      writableLorebookId: home.id,
      lorebookNamingScheme: { scene: "[WorldName] Scenes" },
      batchWithOtherAgents: false,
    },
  });
  await agents.create({
    type: "lorebook-keeper",
    name: "Lorebook Keeper",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "WORLD_TASK",
    settings: { lorebookNamingScheme: { scene: "[WorldName] Scenes" } },
  });

  const cases = [
    ...(["generate", "retry"] as const).flatMap((route) =>
      [false, true].map((approval) => ({ route, approval, agentType: "world-scribe" })),
    ),
    { route: "retry" as const, approval: false, agentType: "lorebook-keeper" },
  ];
  for (const { route, approval, agentType } of cases) {
    const chat = await chats.create({
      name: `Caravan ${route}`,
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: connection.id,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      enableTools: false,
      activeAgentIds: [agentType],
      agentWriteApprovalRequired: approval,
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "We arrive." });
    if (route === "retry") {
      await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The gate opens." });
    }
    const response = await app.inject({
      method: "POST",
      url: route === "generate" ? "/api/generate/" : "/api/generate/retry-agents",
      payload:
        route === "generate"
          ? { chatId: chat.id, userMessage: "We arrive.", forCharacterId: character.id }
          : { chatId: chat.id, agentTypes: [agentType] },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.doesNotMatch(response.body, /"type":"error"/u, response.body);
    const label = `${agentType} ${route}${approval ? " with approval" : ""}`;
    if (approval) {
      assert.match(response.body, /"worldName":"Eldoria"/u, `${label} asks to create the world's lorebook`);
    } else {
      const created = (await books.list()).find((book) => book.chatId === chat.id);
      assert.equal(created?.name, "Eldoria Scenes", `${label} names the new lorebook after the card's world`);
    }
  }
  console.info("Lorebook [WorldName] regression passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
