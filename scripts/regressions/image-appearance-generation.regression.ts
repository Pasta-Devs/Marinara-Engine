// Exercise the real normal-generation and retry routes. Only provider transports are synthetic.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "marinara-image-appearance-turn-"));
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
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const agentPrompts: string[] = [];
const narratorPrompts: string[] = [];
const imageRequests: Array<{
  input: string;
  parameters: { v4_prompt: { caption: { char_captions: Array<{ char_caption: string }> } } };
}> = [];
const nativeOrigin = "https://image.novelai.net";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = body.messages.map((message: { content: unknown }) => JSON.stringify(message.content)).join("\n");
  const isAgent = prompt.includes("IMAGE_APPEARANCE_AGENT_FIXTURE");
  (isAgent ? agentPrompts : narratorPrompts).push(prompt);
  const content = isAgent
    ? JSON.stringify({
        shouldGenerate: true,
        prompt: "Three travelers beside a lake",
        characters: ["Aster", "Briar", "Player"],
        characterPrompts: [{ name: "Aster", prompt: "CAPTION_ASTER, blue hair" }],
      })
    : "The travelers admire the lake.";
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const characters = createCharactersStorage(db);
const connections = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const textOrigin = `http://127.0.0.1:${address.port}`;
  const realFetch = globalThis.fetch;
  mock.method(dns, "lookup", async (hostname: string) => {
    assert.equal(hostname, "image.novelai.net", "only the synthetic image host needs DNS");
    return [{ address: "8.8.8.8", family: 4 }];
  });
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === nativeOrigin) {
      assert.equal(url.pathname, "/ai/generate-image");
      imageRequests.push(JSON.parse(String(init?.body)));
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }
    assert.equal(url.origin, textOrigin, `unexpected network request: ${url}`);
    return realFetch(input, init);
  });
  const textConnection = await connections.create({
    name: "Local text fixture",
    provider: "custom",
    baseUrl: `${textOrigin}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const imageConnection = await connections.create({
    name: "Synthetic native NovelAI",
    provider: "image_generation",
    baseUrl: nativeOrigin,
    model: "nai-diffusion-4-5-full",
    imageGenerationSource: "novelai",
    imageService: "novelai",
    apiKey: "fixture",
  });
  const settings = {
    resultType: "image_prompt",
    customCapabilities: { trigger_image_generation: true },
    imageConnectionId: imageConnection.id,
    includeCharacterAppearance: true,
    contextSources: { characters: true, persona: true },
  };
  const agent = await agents.create({
    type: "custom-image-appearance-fixture",
    name: "Image fixture",
    phase: "post_processing",
    connectionId: textConnection.id,
    promptTemplate: "IMAGE_APPEARANCE_AGENT_FIXTURE Return JSON.",
    settings,
  });
  assert.ok(agent);
  for (const identitySource of ["character", "persona"] as const) {
    for (const overrideState of ["enabled", "disabled", "blank", "attachment-off"] as const) {
      const enabled = overrideState !== "disabled";
      const attached = overrideState !== "attachment-off";
      const appearanceOverride = (name: string) => (overrideState === "blank" ? "   " : `IMAGE_${name}, silver coat`);
      const createCharacter = async (name: string) => {
        const character = await characters.create(
          characterDataSchema.parse({
            name,
            description: `A traveler named ${name}.`,
            extensions: {
              appearance: `LORE_${name}, wool cloak`,
              imageAppearanceEnabled: enabled,
              imageAppearance: appearanceOverride(name),
            },
          }),
        );
        assert.ok(character);
        return character;
      };
      const aster = await createCharacter("Aster");
      const briar = await createCharacter("Briar");
      const player =
        identitySource === "character"
          ? await createCharacter("Player")
          : await characters.createPersona("Player", "A traveler.", undefined, {
              appearance: "LORE_Player, wool cloak",
              imageAppearanceEnabled: enabled ? "true" : "false",
              imageAppearance: appearanceOverride("Player"),
            });
      assert.ok(player);
      await agents.update(agent.id, { settings: { ...settings, includeCharacterAppearance: attached } });
      const chat = await chats.create({
        name: `${identitySource} ${overrideState}`,
        mode: "roleplay",
        characterIds: [aster.id, briar.id],
        connectionId: textConnection.id,
        promptPresetId: null,
        personaId: identitySource === "persona" ? player.id : null,
        personaCharacterId: identitySource === "character" ? player.id : null,
      });
      assert.ok(chat);
      await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: [agent.type] });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "We walk beside the lake." });
      const label = `${identitySource}/${overrideState}`;
      for (const retry of [false, true]) {
        const imageCount = imageRequests.length;
        const agentCount = agentPrompts.length;
        const assistant = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant");
        if (retry) assert.ok(assistant);
        const result = await app.inject({
          method: "POST",
          url: retry ? "/api/generate/retry-agents" : "/api/generate/",
          payload: retry
            ? { chatId: chat.id, agentTypes: [agent.type], forMessageId: assistant!.id }
            : { chatId: chat.id },
        });
        assert.equal(result.statusCode, 200, result.body);
        assert.ok(!result.body.includes('"type":"error"'), result.body);
        assert.equal(imageRequests.length, imageCount + 1, `${label} retry=${retry}: ${result.body}`);
        assert.equal(agentPrompts.length, agentCount + 1, label);
        const image = imageRequests.at(-1)!;
        assert.deepEqual(
          image.parameters.v4_prompt.caption.char_captions.map((caption) => caption.char_caption),
          ["CAPTION_ASTER, blue hair"],
        );
        assert.ok(!image.input.includes("LORE_Aster") && !image.input.includes("IMAGE_Aster"), label);
        const usesOverride = enabled && overrideState !== "blank";
        for (const name of ["Briar", "Player"]) {
          const expected = `${usesOverride ? "IMAGE" : "LORE"}_${name}`;
          assert.equal(image.input.includes(expected), attached, `${label} retry=${retry}: ${image.input}`);
          if (attached) assert.ok(!image.input.includes(`${usesOverride ? "LORE" : "IMAGE"}_${name}`), label);
          else assert.ok(!image.input.includes(`LORE_${name}`) && !image.input.includes(`IMAGE_${name}`), label);
        }
        const appearanceReference = agentPrompts
          .at(-1)!
          .match(/<character_appearance_reference>([\s\S]*?)<\/character_appearance_reference>/)?.[1];
        assert.equal(Boolean(appearanceReference), attached, `${label}: appearance attachment respects toggle`);
        if (attached) {
          for (const name of ["Aster", "Briar", "Player"]) {
            assert.ok(appearanceReference!.includes(`${usesOverride ? "IMAGE" : "LORE"}_${name}`), label);
            assert.ok(!appearanceReference!.includes(`${usesOverride ? "LORE" : "IMAGE"}_${name}`), label);
          }
        }
        if (!retry) {
          const narrator = narratorPrompts.at(-1)!;
          for (const name of ["Aster", "Briar", "Player"]) assert.ok(narrator.includes(`LORE_${name}`), label);
          assert.ok(!narrator.includes("IMAGE_"), "image overrides must not replace narrator lore");
        }
      }
    }
  }
} finally {
  mock.restoreAll();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.info(
  "Image appearance overrides preserve partial native captions, custom-agent attachments, and narrator lore in generation and retry.",
);
