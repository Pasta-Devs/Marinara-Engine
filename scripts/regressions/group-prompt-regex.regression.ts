import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-group-regex-"));
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
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createRegexScriptsStorage } =
  await import("../../packages/server/src/services/storage/regex-scripts.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
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
const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const scripts = createRegexScriptsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Regex fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 32768,
    maxTokensOverride: 256,
  });
  assert(connection);
  const [pantalone, maukie, narrator] = await Promise.all(
    ["Pantalone", "Maukie", "Narrator"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  assert(pantalone && maukie && narrator);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Regex fixture",
    parameters: { maxTokens: 256, maxContext: 32768 },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}. *PROMPT_RULE*",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Group regex proof",
    mode: "roleplay",
    characterIds: [pantalone.id, maukie.id, narrator.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    enableMemoryRecall: false,
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  const original = await Promise.all([
    chats.createMessage({ chatId: chat.id, role: "user", content: "PERSONA_PUBLIC *PERSONA_THOUGHT*" }),
    chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: pantalone.id,
      content: "PANTALONE_PUBLIC *PANTALONE_THOUGHT*",
    }),
    chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: maukie.id,
      content: "MAUKIE_PUBLIC *MAUKIE_THOUGHT*",
    }),
  ]);
  const hideThoughts = await scripts.create({
    name: "Hide thoughts",
    findRegex: "\\*[^*]*\\*",
    flags: "g",
    replaceString: "",
    enabled: true,
    placement: ["user_input"],
    applyMode: "prompt",
    targetCharacterIds: [pantalone.id, maukie.id],
  });
  assert(hideThoughts);
  const generate = async (forCharacterId: string | undefined, replies = ["A public reply."], extra = {}) => {
    outputs = [...replies];
    const start = prompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0);
    return prompts.slice(start);
  };
  const preview = async (forCharacterId: string, extra = {}): Promise<Message[]> => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, forCharacterId, returnPrompt: true, ...extra },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json().prompt.messages;
  };
  const assertThoughts = (messages: Message[], target: string, scoped = true) => {
    const text = JSON.stringify(messages);
    const excluded = scoped && target === narrator.id;
    assert.equal(text.includes("PERSONA_THOUGHT"), excluded, "persona thoughts follow User Input");
    const ownMarker = target === pantalone.id ? "PANTALONE_PUBLIC" : target === maukie.id ? "MAUKIE_PUBLIC" : null;
    if (ownMarker) assert.equal(messages.find((message) => message.content.includes(ownMarker))?.role, "assistant");
    assert.equal(
      text.includes("PANTALONE_THOUGHT"),
      excluded || target === pantalone.id,
      "other character thoughts follow User Input; own thoughts stay AI Output",
    );
    assert.equal(
      text.includes("MAUKIE_THOUGHT"),
      excluded || target === maukie.id,
      "recipient gets their own perspective",
    );
    for (const marker of ["PERSONA_PUBLIC", "PANTALONE_PUBLIC", "MAUKIE_PUBLIC", "PROMPT_RULE"])
      assert(text.includes(marker));
  };
  for (const target of [maukie.id, pantalone.id, narrator.id]) {
    assertThoughts((await generate(target))[0]!, target);
    assertThoughts(await preview(target), target);
  }
  const handoff = await generate(maukie.id, ["@Narrator, continue.", "The narrator continues."]);
  assert.equal(handoff.length, 2);
  assertThoughts(handoff[0]!, maukie.id);
  assertThoughts(handoff[1]!, narrator.id);
  const rawPreview = JSON.stringify(await preview(maukie.id, { skipPreset: true }));
  assert(!rawPreview.includes("PANTALONE_THOUGHT") && rawPreview.includes("MAUKIE_THOUGHT"));

  await chats.patchMetadata(chat.id, { groupResponseOrder: "sequential" });
  const group = await generate(undefined, [
    "Pantalone speaks. *SAME_TURN_THOUGHT*",
    "Maukie replies.",
    "Narrator replies.",
  ]);
  assert.equal(group.length, 3);
  for (const [index, target] of [pantalone.id, maukie.id, narrator.id].entries()) assertThoughts(group[index]!, target);
  assert(!JSON.stringify(group[1]).includes("SAME_TURN_THOUGHT"));
  assert(
    JSON.stringify(group[2]).includes("SAME_TURN_THOUGHT"),
    "one recipient's regex never rewrites another's history",
  );

  // Global scripts need the same recipient-relative placement, applied once even with both placements.
  await scripts.update(hideThoughts.id, { targetCharacterIds: [] });
  await scripts.create({
    name: "Once",
    findRegex: "PUBLIC",
    replaceString: "PUBLIC_ONCE",
    placement: ["user_input", "ai_output"],
    applyMode: "prompt",
  });
  for (const target of [maukie.id, narrator.id]) {
    for (const messages of [(await generate(target))[0]!, await preview(target)]) {
      assertThoughts(messages, target, false);
      assert(JSON.stringify(messages).includes("PUBLIC_ONCE"));
      assert(!JSON.stringify(messages).includes("PUBLIC_ONCE_ONCE"));
    }
  }
  // Anchors still address message bodies, with wrappers preserved around rewritten history.
  const anchored = await scripts.create({
    name: "Anchored",
    findRegex: "^PERSONA_PUBLIC_ONCE",
    replaceString: "PERSONA_ANCHORED",
    placement: ["user_input"],
    applyMode: "prompt",
  });
  assert(anchored);
  for (const messages of [(await generate(maukie.id))[0]!, await preview(maukie.id)]) {
    const text = JSON.stringify(messages);
    assert(text.includes("PERSONA_ANCHORED"));
    assert(!text.includes("PERSONA_PUBLIC_ONCE"));
    assert(text.includes("<chat_history>"), "prompt wrappers survive history regexes");
  }
  await scripts.remove(anchored.id);

  // AI Output uses the inverse perspective; display-only and wrong-preset rules stay out.
  await scripts.update(hideThoughts.id, { placement: ["ai_output"], targetCharacterIds: [maukie.id] });
  for (const messages of [(await generate(maukie.id))[0]!, await preview(maukie.id)]) {
    const text = JSON.stringify(messages);
    assert(text.includes("PERSONA_THOUGHT") && text.includes("PANTALONE_THOUGHT"));
    assert(!text.includes("MAUKIE_THOUGHT"));
  }
  for (const change of [
    { applyMode: "display" as const },
    { applyMode: "prompt" as const, targetPromptPresetIds: ["other-preset"] },
  ]) {
    await scripts.update(hideThoughts.id, { placement: ["user_input"], ...change });
    for (const messages of [(await generate(maukie.id))[0]!, await preview(maukie.id)]) {
      assert(JSON.stringify(messages).includes("PANTALONE_THOUGHT"));
    }
  }
  await scripts.update(hideThoughts.id, { targetPromptPresetIds: [preset.id], minDepth: 0, maxDepth: 0 });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: pantalone.id,
    content: "Latest. *DEPTH_ZERO_THOUGHT*",
  });
  const depthPreview = JSON.stringify(await preview(maukie.id));
  const depthLive = JSON.stringify((await generate(maukie.id))[0]);
  for (const text of [depthPreview, depthLive]) {
    assert(!text.includes("DEPTH_ZERO_THOUGHT"), "depth zero is the latest history turn, not an injected instruction");
    assert(text.includes("PANTALONE_THOUGHT"), "older turns keep their thoughts outside the depth range");
  }
  await scripts.update(hideThoughts.id, {
    targetCharacterIds: [],
    targetPromptPresetIds: [],
    minDepth: null,
    maxDepth: null,
  });

  // Prompt-only rules do not rewrite stored history or outgoing character responses.
  const saved = await chats.listMessages(chat.id);
  for (const message of original) {
    assert(message);
    assert.equal(saved.find((row) => row.id === message.id)?.content, message.content);
  }
  assert(saved.some((message) => message.content.includes("SAME_TURN_THOUGHT")));

  // Merged group and impersonation keep their existing stored-role placement.
  for (const [metadata, extra] of [
    [{ groupChatMode: "merged" }, {}],
    [{ groupChatMode: "individual" }, { impersonate: true }],
  ] as const) {
    await chats.patchMetadata(chat.id, metadata);
    for (const messages of [(await generate(maukie.id, ["Public."], extra))[0]!, await preview(maukie.id, extra)]) {
      const text = JSON.stringify(messages);
      assert(!text.includes("PERSONA_THOUGHT"));
      assert(text.includes("PANTALONE_THOUGHT") && text.includes("MAUKIE_THOUGHT"));
    }
  }
  await chats.update(chat.id, { characterIds: [maukie.id] });
  for (const messages of [(await generate(maukie.id))[0]!, await preview(maukie.id)]) {
    const text = JSON.stringify(messages);
    assert(!text.includes("PERSONA_THOUGHT"));
    assert(text.includes("PANTALONE_THOUGHT") && text.includes("MAUKIE_THOUGHT"));
  }
  console.log(
    "Group prompt regex passed: recipient placement, narrator exclusion, same-turn replies, preview parity, one pass and transcript preservation.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
