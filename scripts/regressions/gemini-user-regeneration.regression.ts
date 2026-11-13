import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Regenerating a user message on Gemini (native Google, OpenRouter, NanoGPT) ends the request on the rewrite
// instruction, through the real route, in merged Roleplay and Conversation groups with Post-Processing on and off.
// A guided regeneration's guide goes before it: its "do not include a reply from {{user}}" must not be the last thing
// the model reads, and a Conversation group's reply format is left out, as for impersonation (#7558). Other models
// keep their requests without the instruction.
const dir = mkdtempSync(join(tmpdir(), "marinara-gemini-user-regeneration-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
// The stub runs on 127.0.0.1; nothing leaves the machine.
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { buildUserMessageRegenerationInstruction } =
  await import("../../packages/server/src/routes/generate/generate-route-utils.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, buildGuidedGenerationInstructionMessage } =
  await import("../../packages/shared/dist/index.js");

const bodies: Array<Record<string, any>> = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  bodies.push(body);
  const text = "Rewritten line.";
  if (request.url?.includes(":streamGenerateContent")) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text }] } }] })}\n\n`);
  } else if (request.url?.includes(":generateContent")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text }] } }] }));
  } else {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`);
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const characters = createCharactersStorage(db);
  const alice = await characters.create(characterDataSchema.parse({ name: "Alice" }));
  const bob = await characters.create(characterDataSchema.parse({ name: "Bob" }));
  assert(alice && bob);
  const presets = createPromptsStorage(db);
  const presetIds = new Map<boolean, string>();
  for (const strictRoleFormatting of [true, false]) {
    const preset = await presets.create({
      name: `Post-Processing ${strictRoleFormatting}`,
      parameters: { maxTokens: 512, maxContext: 32768, strictRoleFormatting },
      wrapFormat: "xml",
    });
    assert(preset);
    await presets.createSection({ presetId: preset.id, identifier: "rules", name: "Rules", content: "Rules." });
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "Chat History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
    presetIds.set(strictRoleFormatting, preset.id);
  }
  const guide = buildGuidedGenerationInstructionMessage("make it braver");
  const rewrite = buildUserMessageRegenerationInstruction({ content: "I step inside." });
  for (const [providerName, path, model, gemini] of [
    ["openrouter", "openrouter.ai/api/v1", "google/gemini-3.8-flash", true],
    ["nanogpt", "nano-gpt.com/api/v1", "google/gemini-4-argon", true],
    ["google", "google", "gemini-4-argon", true],
    ["google", "google", "gemini-4-carbon", true],
    ["google", "google", "gemini-3.5-flash", true],
    ["openrouter", "openrouter.ai/api/v1", "meta-llama/llama-3.3-70b-instruct", false],
  ] as const) {
    const connection = await createConnectionsStorage(db).create({
      name: model,
      provider: providerName,
      baseUrl: `${base}/${path}`,
      model,
      apiKey: "fixture",
      maxContext: 32768,
      maxTokensOverride: 512,
    });
    assert(connection);
    for (const [mode, strict, guided] of [
      ["roleplay", true, false],
      ["roleplay", true, true],
      ["roleplay", false, false],
      ["roleplay", false, true],
      ["conversation", true, true],
      ["conversation", false, false],
    ] as const) {
      const label = `${providerName} ${model} ${mode} Post-Processing ${strict ? "on" : "off"}${guided ? " guided" : ""}`;
      const chat = await chats.create({
        name: label,
        mode,
        characterIds: [alice.id, bob.id],
        connectionId: connection.id,
        promptPresetId: presetIds.get(strict)!,
      });
      assert(chat);
      await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, groupChatMode: "merged" });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "I knock." });
      await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: alice.id, content: "Alice opens." });
      const target = await chats.createMessage({ chatId: chat.id, role: "user", content: "I step inside." });
      assert(target);
      bodies.length = 0;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: {
          chatId: chat.id,
          regenerateMessageId: target.id,
          streaming: true,
          ...(guided ? { generationGuide: guide, generationGuideSource: "guide" } : {}),
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), `${label}: ${response.body}`);
      assert.equal(bodies.length, 1, `${label} sends one request`);
      const body = bodies[0]!;
      const turns: Array<{ role: string; text: string }> = body.contents
        ? body.contents.map((turn: any) => ({
            role: turn.role,
            text: turn.parts.map((part: any) => part.text).join(""),
          }))
        : body.messages.map((message: any) => ({ role: message.role, text: message.content }));
      const sent = JSON.stringify(body);
      if (gemini) {
        const last = turns.at(-1)!;
        assert.equal(last.role, "user", `${label} ends on a user turn`);
        assert(last.text.endsWith(rewrite), `${label} ends on the rewrite instruction: ${last.text.slice(-120)}`);
      } else {
        assert(!sent.includes("Regenerate the user's previous message"), `${label} keeps its request`);
      }
      assert.equal(sent.includes("make it braver"), guided, `${label} sends the guide only when guided`);
      const saved = await chats.getMessage(target.id);
      assert.equal(saved?.role, "user");
      assert.equal(saved?.content, "Rewritten line.", `${label} saves the rewrite as the user's swipe`);
    }
  }
  console.log("Gemini user-message regeneration regression passed.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
