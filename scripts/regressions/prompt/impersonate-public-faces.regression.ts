// #9427: with Impersonate's Send Public Faces switch on, an impersonated Roleplay turn sees a character that has a
// Public Face only as its name and Public Face. Every other part of that card stays out, through a preset and
// without one, in the preview, and when the impersonated message is regenerated. A character with no Public Face
// keeps its full card, and turns that are not impersonated are unchanged.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-impersonate-faces-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema } = await import("../../../packages/shared/dist/index.js");
type Message = { role: string; content: string };
const prompts: Message[][] = [];
let outputs: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  prompts.push(JSON.parse(Buffer.concat(chunks).toString()).messages);
  const content = outputs.shift();
  assert.notEqual(content, undefined, "unexpected provider request");
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});

// Every part of Alice's card except her name and Public Face, each with its own marker.
const ALICE_PRIVATE = [
  "ALICE_DESCRIPTION",
  "ALICE_PERSONALITY",
  "ALICE_BACKSTORY",
  "ALICE_APPEARANCE",
  "ALICE_SCENARIO",
  "ALICE_SYSTEM_PROMPT",
  "ALICE_EXAMPLE",
  "ALICE_POST_HISTORY",
  "ALICE_DEPTH",
];
// Only the preset's Character marker sends RPG attributes.
const ALICE_RPG = "Lockpicking";
const ALICE_FACE = "ALICE_FACE: Alice keeps the inn.";
const BOB_CARD = ["BOB_DESCRIPTION", "BOB_EXAMPLE", "BOB_POST_HISTORY", "BOB_DEPTH"];

const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Impersonate fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 32768,
    maxTokensOverride: 256,
  });
  assert(connection);
  const alice = await characters.create(
    characterDataSchema.parse({
      name: "Alice",
      description: "ALICE_DESCRIPTION: secretly a thief.",
      personality: "ALICE_PERSONALITY",
      scenario: "ALICE_SCENARIO",
      system_prompt: "ALICE_SYSTEM_PROMPT",
      mes_example: "<START>\n{{char}}: ALICE_EXAMPLE",
      post_history_instructions: "ALICE_POST_HISTORY",
      extensions: {
        backstory: "ALICE_BACKSTORY",
        appearance: "ALICE_APPEARANCE",
        publicFace: "ALICE_FACE: {{char}} keeps the inn.",
        depth_prompt: { prompt: "ALICE_DEPTH", depth: 2, role: "system" },
        rpgStats: { enabled: true, attributes: [{ name: ALICE_RPG, value: 9 }], hp: { value: 10, max: 10 } },
      },
    }),
  );
  const bob = await characters.create(
    characterDataSchema.parse({
      name: "Bob",
      description: "BOB_DESCRIPTION",
      mes_example: "<START>\n{{char}}: BOB_EXAMPLE",
      post_history_instructions: "BOB_POST_HISTORY",
      extensions: { publicFace: "  ", depth_prompt: { prompt: "BOB_DEPTH", depth: 2, role: "system" } },
    }),
  );
  assert(alice && bob);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Impersonate fixture",
    parameters: { maxTokens: 256, maxContext: 32768 },
    wrapFormat: "xml",
  });
  assert(preset);
  for (const [identifier, type] of [
    ["cards", "character"],
    ["examples", "dialogue_examples"],
    ["history", "chat_history"],
  ] as const) {
    await presets.createSection({
      presetId: preset.id,
      identifier,
      name: identifier,
      isMarker: true,
      markerConfig: { type },
    });
  }
  const chat = await chats.create({
    name: "Impersonate faces",
    mode: "roleplay",
    // Alice second, so her face's {{char}} only becomes "Alice" when it resolves as its owner.
    characterIds: [bob.id, alice.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, enableMemoryRecall: false });
  await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: alice.id, content: "Welcome in." });

  const generate = async (extra: Record<string, unknown>) => {
    outputs = ["A reply."];
    const start = prompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(prompts.length - start, 1);
    return JSON.stringify(prompts.at(-1));
  };
  const preview = async (extra: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, returnPrompt: true, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    return JSON.stringify(response.json().prompt.messages);
  };
  let alicePrivate = ALICE_PRIVATE;
  const assertFaces = (text: string, label: string) => {
    assert(text.includes(ALICE_FACE), `${label}: Alice's Public Face, macros resolved as her`);
    for (const marker of [...alicePrivate, ALICE_RPG]) assert(!text.includes(marker), `${label}: ${marker} stays out`);
    for (const marker of BOB_CARD)
      assert(text.includes(marker), `${label}: Bob has no Public Face, so ${marker} stays`);
  };
  const assertFullCards = (text: string, label: string) => {
    assert(!text.includes("ALICE_FACE"), `${label}: no Public Face`);
    for (const marker of [...alicePrivate, ...BOB_CARD]) assert(text.includes(marker), `${label}: ${marker} is sent`);
  };
  const lastUserMessageId = async () => {
    const messages = await chats.listMessages(chat.id);
    const row = messages.filter((message) => message.role === "user").at(-1);
    assert(row);
    return row.id;
  };

  for (const withPreset of [true, false]) {
    await chats.update(chat.id, { promptPresetId: withPreset ? preset.id : null });
    const label = withPreset ? "preset" : "no preset";
    alicePrivate = withPreset ? [...ALICE_PRIVATE, ALICE_RPG] : ALICE_PRIVATE;

    assertFaces(await generate({ impersonate: true, impersonatePublicFaces: true }), `${label} impersonate`);
    const facedTurn = await lastUserMessageId();
    assertFullCards(await generate({ impersonate: true }), `${label} impersonate, switch off`);
    const fullTurn = await lastUserMessageId();
    assertFullCards(await generate({ impersonatePublicFaces: true }), `${label} character reply`);

    // Regenerate sends no impersonate settings: the saved message's own choice carries over.
    assertFaces(await generate({ regenerateMessageId: facedTurn }), `${label} regenerated Public Face turn`);
    assertFullCards(await generate({ regenerateMessageId: fullTurn }), `${label} regenerated full-card turn`);

    if (withPreset) {
      assertFaces(await preview({ impersonate: true, impersonatePublicFaces: true }), "preview");
      assertFullCards(await preview({ impersonate: true }), "preview, switch off");

      // The "none" wrap format drops labels, so each face is named.
      await presets.update(preset.id, { wrapFormat: "none" });
      assert(
        (await generate({ impersonate: true, impersonatePublicFaces: true })).includes(`Alice: ${ALICE_FACE}`),
        "a face is named under the none wrap format",
      );
      await presets.update(preset.id, { wrapFormat: "xml" });
    }
  }

  // Game chats ignore the switch: the card's own post-history instructions still reach the Game Master, and the
  // saved replay does not claim Public Faces were sent.
  await chats.update(chat.id, { mode: "game", promptPresetId: null });
  const earlierIds = new Set((await chats.listMessages(chat.id)).map((message) => message.id));
  const game = await generate({ impersonate: true, impersonatePublicFaces: true });
  assert(game.includes("ALICE_POST_HISTORY") && !game.includes("ALICE_FACE"), "Game chats keep their card text");
  const gameTurn = (await chats.listMessages(chat.id)).find(
    (message) => message.role === "user" && !earlierIds.has(message.id),
  );
  const gameExtra = typeof gameTurn?.extra === "string" ? JSON.parse(gameTurn.extra) : gameTurn?.extra;
  assert.equal(gameExtra?.generationReplay?.impersonate, true, "the Game impersonate turn is saved");
  assert.notEqual(gameExtra?.generationReplay?.impersonatePublicFaces, true, "its replay records full cards");

  console.log("Impersonate Public Faces passed: preset, no preset, preview, regenerate, empty face and other turns.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
