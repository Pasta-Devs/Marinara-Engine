import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LongTermMemoryRuntimeService } from "../../packages/server/src/services/generation/long-term-memory-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-ltm-recall-"));
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
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { registerCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { registerCapabilityPromptContext } =
  await import("../../packages/server/src/services/capability-packages/capability-prompt-context.service.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

replaceBuiltInAgentDefinitions([
  {
    id: "long-term-memory",
    name: "Long-Term Memory",
    description: "Recall boundary fixture",
    phase: "pre_generation",
    execution: "host",
    enabledByDefault: false,
    category: "misc",
    defaultTools: [],
    defaultPromptTemplate: "Fixture",
  },
]);
const recalls: Array<Parameters<LongTermMemoryRuntimeService["recall"]>[0]["messages"]> = [];
const releaseRecall = registerCapabilityService("long-term-memory:runtime", {
  async recall(input) {
    recalls.push(structuredClone(input.messages));
    return null; // Keep prompt comparison independent of retrieved-memory content.
  },
  async recordPromptAccepted() {},
} satisfies LongTermMemoryRuntimeService);
const releaseContext = registerCapabilityPromptContext("recall-fixture", () => "PINEAPPLE_PACKAGE_INJECTION");
let received: Array<{ role: string; content: string }> = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  received = JSON.parse(Buffer.concat(chunks).toString()).messages;
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "The story continues." }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const presets = createPromptsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Recall fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
  });
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Recall character", first_mes: "" }),
  );
  await createAgentsStorage(db).create({
    type: "long-term-memory",
    name: "Long-Term Memory",
    phase: "pre_generation",
    connectionId: connection.id,
  });
  for (const mode of ["roleplay", "conversation"] as const) {
    for (const tailCount of [0, 4]) {
      const preset = await presets.create({ name: "Recall fixture", wrapFormat: "xml" });
      assert.ok(preset);
      await presets.createSection({
        presetId: preset.id,
        identifier: "before",
        name: "Before",
        content: "PINEAPPLE_BEFORE_HISTORY",
      });
      await presets.createSection({
        presetId: preset.id,
        identifier: "history",
        name: "History",
        isMarker: true,
        markerConfig: { type: "chat_history" },
      });
      for (let index = 0; index < tailCount; index++) {
        await presets.createSection({
          presetId: preset.id,
          identifier: `tail-${index}`,
          name: `Tail ${index}`,
          role: "user",
          content: `PINEAPPLE_TAIL_${index}`,
        });
      }
      let promptWithoutRecall: typeof received | undefined;
      for (const enabled of [false, true]) {
        const chat = await chats.create({
          name: "Recall fixture",
          mode,
          characterIds: [character.id],
          connectionId: connection.id,
          promptPresetId: preset.id,
        });
        await chats.patchMetadata(chat.id, {
          enableAgents: enabled,
          activeAgentIds: ["long-term-memory"],
          enableMemoryRecall: false,
          autonomousMessages: false,
          characterExchanges: false,
          crossChatAwareness: false,
          conversationSchedulesEnabled: false,
          conversationTimeZone: "UTC",
        });
        await chats.createMessage({ chatId: chat.id, role: "user", content: "BEFORE_CONVERSATION_START" });
        const markers = ["OBSERVATORY_ONE", "OBSERVATORY_TWO", "OBSERVATORY_NARRATOR", "OBSERVATORY_LATEST"];
        for (const [index, role] of (["user", "assistant", "narrator", "user"] as const).entries()) {
          await chats.createMessage({
            chatId: chat.id,
            role,
            content: markers[index]!,
            ...(role === "assistant" ? { characterId: character.id } : {}),
            ...(index === 0 ? { extra: { isConversationStart: true } } : {}),
          });
        }
        await chats.createMessage({
          chatId: chat.id,
          role: "user",
          content: "HIDDEN_HISTORY",
          extra: { hiddenFromAI: true },
        });
        const recallCount = recalls.length;
        const response = await app.inject({
          method: "POST",
          url: "/api/generate/",
          payload: { chatId: chat.id, skipPresenceDelay: true },
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.ok(!response.body.includes('"type":"error"'), response.body);
        assert.equal(
          recalls.length,
          recallCount + (enabled ? 1 : 0),
          `${mode}, tail=${tailCount}, LTM=${enabled}: ${response.body}`,
        );
        const promptText = received.map((message) => message.content).join("\n");
        for (const marker of [...markers, "PINEAPPLE_PACKAGE_INJECTION"]) assert.ok(promptText.includes(marker));
        assert.doesNotMatch(promptText, /BEFORE_CONVERSATION_START|HIDDEN_HISTORY/u);
        if (mode === "roleplay") {
          assert.ok(promptText.includes("PINEAPPLE_BEFORE_HISTORY"));
          for (let index = 0; index < tailCount; index++) assert.ok(promptText.includes(`PINEAPPLE_TAIL_${index}`));
          if (enabled)
            assert.deepEqual(received, promptWithoutRecall, "LTM input filtering leaves the provider prompt unchanged");
          else promptWithoutRecall = structuredClone(received);
        }
        if (enabled) {
          const recall = recalls.at(-1)!;
          assert.equal(recall.length, 4, "prompt and injection messages cannot displace conversation turns");
          for (const [index, marker] of markers.entries()) assert.ok(recall[index]?.content.includes(marker));
          assert.equal(recall[2]?.role, "system", "narrator history remains eligible");
          assert.doesNotMatch(JSON.stringify(recall), /PINEAPPLE|BEFORE_CONVERSATION_START|HIDDEN_HISTORY/u);
        }
      }
    }
  }
  console.info(
    "LTM recall: real route handoff excludes prompt/injections, preserves history, and leaves provider prompts unchanged.",
  );
} finally {
  releaseRecall();
  releaseContext();
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
