import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityPromptContextRequest } from "../../packages/server/src/services/capability-packages/capability-prompt-context.service.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-capability-preview-"));
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
const { registerCapabilityPromptContext } =
  await import("../../packages/server/src/services/capability-packages/capability-prompt-context.service.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const { capabilityDocuments } = await import("../../packages/server/src/db/schema/index.js");
const { engineEventOwner } =
  await import("../../packages/server/src/services/capability-packages/capability-roleplay-events.service.js");

replaceBuiltInAgentDefinitions([
  {
    id: "preview-package",
    name: "Preview package",
    description: "Fixture",
    phase: "post_processing",
    enabledByDefault: false,
    category: "tracker",
    defaultTools: [],
    defaultPromptTemplate: "Return JSON.",
  },
]);
let received = "";
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  received = body.messages.map((message: { content: string }) => message.content).join("\n");
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
let release = () => {};
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
  });
  const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Preview character", first_mes: "" }),
  );
  await createAgentsStorage(db).create({
    type: "preview-package",
    name: "Preview package",
    phase: "post_processing",
    connectionId: connection.id,
    settings: { resultType: "memory_nag", injectAsSection: true },
  });
  for (const mode of ["roleplay", "conversation", "game"] as const) {
    for (const positioned of [false, true]) {
      if (positioned && mode !== "roleplay") continue;
      const preset = await presets.create({ name: "Package preview", wrapFormat: "xml" });
      assert.ok(preset);
      await presets.createSection({
        presetId: preset.id,
        identifier: "before",
        name: "Before",
        content: "BEFORE_PACKAGE",
      });
      if (positioned)
        await presets.createSection({
          presetId: preset.id,
          identifier: "package",
          name: "Package",
          isMarker: true,
          markerConfig: { type: "agent_data", agentType: "preview-package" },
        });
      await presets.createSection({
        presetId: preset.id,
        identifier: "after",
        name: "After",
        content: "AFTER_PACKAGE",
      });
      await presets.createSection({
        presetId: preset.id,
        identifier: "history",
        name: "History",
        isMarker: true,
        markerConfig: { type: "chat_history" },
      });
      const chat = await chats.create({
        name: "Package context",
        mode,
        characterIds: [character.id],
        connectionId: connection.id,
        promptPresetId: preset.id,
      });
      await chats.patchMetadata(chat.id, {
        enableAgents: positioned,
        activeAgentIds: positioned ? ["preview-package"] : [],
        manualTrackers: true,
        enableMemoryRecall: false,
        packageFixture: "stored-context",
      });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue our scene." });
      for (const [text, audience, eventChatId] of [
        ["PUBLIC_EVENT", "public", chat.id],
        ["CHARACTER_EVENT", { characterIds: [character.id] }, chat.id],
        ["USER_ONLY_SECRET", "user-only", chat.id],
        ["OTHER_CHARACTER_SECRET", { characterIds: ["someone-else"] }, chat.id],
        ["OTHER_CHAT_SECRET", "public", "another-chat"],
      ] as const) {
        const timestamp = new Date().toISOString();
        await db.insert(capabilityDocuments).values({
          id: crypto.randomUUID(),
          idempotencyKey: `${chat.id}:${text}`,
          packageId: engineEventOwner(eventChatId),
          kind: "roleplay-event",
          name: text,
          data: JSON.stringify({ chatId: eventChatId, eventType: "message", text, audience, createdAt: timestamp }),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      const calls: CapabilityPromptContextRequest[] = [];
      release = registerCapabilityPromptContext("preview-package", (request) => {
        calls.push({ ...request });
        return `PACKAGE_CONTEXT:${request.chatId}:${request.mode}:${request.chatMeta.packageFixture}`;
      });
      const messagesBefore = await chats.listMessages(chat.id);
      const preview = await app.inject({
        method: "POST",
        url: "/api/generate/dryRun",
        payload: { chatId: chat.id, returnPrompt: true, injectTrackers: true },
      });
      assert.equal(preview.statusCode, 200, preview.body);
      assert.deepEqual(await chats.listMessages(chat.id), messagesBefore, "Preview does not create or edit messages");
      const previewText = preview
        .json()
        .prompt.messages.map((message: { content: string }) => message.content)
        .join("\n");
      const marker = `PACKAGE_CONTEXT:${chat.id}:${mode}:stored-context`;
      assert.equal(previewText.split(marker).length - 1, 1, `${mode} preview includes package context exactly once`);
      assert.equal(calls.length, 1, "Preview collects only once");
      assert.equal(calls[0]?.wrapFormat, "xml", "The preset wrap format reaches the contributor");
      const generation = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
      assert.equal(generation.statusCode, 200, generation.body);
      assert.ok(!generation.body.includes('"type":"error"'), generation.body);
      assert.equal(received.split(marker).length - 1, 1, "Real generation includes the same package context");
      for (const text of [previewText, received]) {
        assert.ok(text.includes("PUBLIC_EVENT") && text.includes("CHARACTER_EVENT"), "Visible events reach both paths");
        assert.ok(
          !/USER_ONLY_SECRET|OTHER_CHARACTER_SECRET|OTHER_CHAT_SECRET/.test(text),
          "Preview and generation honor chat and audience boundaries",
        );
      }
      assert.deepEqual(
        calls[0],
        calls[1],
        "Preview and generation supply the same chat, mode, character, persona and placement context",
      );
      if (positioned)
        for (const text of [previewText, received]) {
          assert.ok(
            text.indexOf("BEFORE_PACKAGE") < text.indexOf(marker) &&
              text.indexOf(marker) < text.indexOf("AFTER_PACKAGE"),
            "Package context occupies its preset marker",
          );
          assert.ok(!text.includes("__MARINARA_RUNTIME_AGENT_SECTION__"), "No internal placement tokens escape");
        }
      release();
      const withoutPackage = await app.inject({
        method: "POST",
        url: "/api/generate/dryRun",
        payload: { chatId: chat.id, returnPrompt: true },
      });
      assert.equal(withoutPackage.statusCode, 200, withoutPackage.body);
      assert.ok(
        !JSON.stringify(withoutPackage.json().prompt).includes(marker),
        "Removing a package removes its preview context",
      );
    }
  }
  console.info(
    "Capability prompt preview: real generation parity in all modes, preset placement, inputs and deactivation passed.",
  );
} finally {
  release();
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
