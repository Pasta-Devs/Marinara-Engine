import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-inspector-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAdvancedMemoryService, advancedMemorySourceFingerprint } =
  await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { promptsRoutes } = await import("../../packages/server/src/routes/prompts.routes.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, characterDataSchema, estimateChatSummaryTokens } =
  await import("../../packages/shared/dist/index.js");
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = require("fastify")();
const db = await getDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
app.decorate("db", db);
await app.register(advancedMemoryRoutes, { prefix: "/chats" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(charactersRoutes, { prefix: "/api/characters" });
await app.register(promptsRoutes, { prefix: "/api/prompts" });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const parse = JSON.parse;
let metadataParses = 0;
try {
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert(character);
  const connection = await createConnectionsStorage(db).create({
    name: "Read-only preview fixture",
    provider: "openai",
    model: "gpt-6-astra",
    apiKey: "fixture",
    baseUrl: "http://127.0.0.1:1/v1", // Preview must succeed without a reachable model.
    maxContext: 65_000,
    maxTokensOverride: 1024,
  });
  const chat = await chats.create({
    name: "Large prepared archive",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true, maxContextTokens: 65_000 },
    advancedMemoryState: { status: "ready", stage: "ready" },
  });
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 1000 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: "A historical event. ".repeat(250),
      extra: { syntheticMemoryPerf: true, unusedSnapshot: "scene snapshot ".repeat(1200) },
    })),
  );
  const source = await chats.listMessages(chat.id);
  const policy = hash([false, [character.id], {}, null]);
  const rows = [];
  for (const kind of ["scene", "excerpt"] as const) {
    const count = kind === "scene" ? 50 : 3;
    for (let index = 0; index < source.length; index += count) {
      const chunk = source.slice(index, index + count);
      rows.push({
        id: `${kind}-${index}-saved`,
        chatId: chat.id,
        sceneId: `scene-${Math.floor(index / 50)}`,
        kind,
        status: "closed",
        startMessageId: chunk[0]!.id,
        endMessageId: chunk.at(-1)!.id,
        messageIds: JSON.stringify(chunk.map((message) => message.id)),
        audienceCharacterIds: "[]",
        content:
          kind === "scene" ? "Historical recap. ".repeat(60) : chunk.map((message) => message.content).join("\n"),
        title: "Scene",
        timeline: null,
        enabled: 1,
        manualOverride: 0,
        sourceFingerprint: hash([advancedMemorySourceFingerprint(chunk), policy, []]),
        dependencies: "[]",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await db.insert(advancedMemoryRecords).values(rows);
  JSON.parse = (text, reviver) => {
    if (text.includes('"syntheticMemoryPerf"')) metadataParses++;
    return parse(text, reviver);
  };
  const full = await memory.status(chat.id);
  assert(
    full.records.some((record) => record.kind === "excerpt"),
    "internal archive status retains excerpts",
  );
  assert(
    full.records.every((record) => record.embeddingStatus === "pending"),
    "source validation remains active",
  );
  assert(metadataParses <= source.length * 2, "status parses metadata once per source, not once per archive record");
  for (const budgetTokens of [2_000_000, 65_000]) {
    metadataParses = 0;
    const started = performance.now();
    const prepared = await memory.prepare({
      chatId: chat.id,
      messages: source,
      audienceCharacterIds: [],
      budgetTokens,
      readOnly: true,
    });
    console.info(
      `Prepare 1000 messages (${budgetTokens} tokens): ${Math.round(performance.now() - started)} ms, ${metadataParses} metadata parses`,
    );
    assert(
      metadataParses <= source.length * 3,
      "prompt preparation parses source metadata once, not per archive record",
    );
    assert(performance.now() - started < 5000, "fitting a long open scene must not repeatedly scan every suffix");
    assert(prepared.receipt.estimatedTokensAfter <= budgetTokens);
    assert.equal(prepared.messageIds.at(-1), source.at(-1)!.id);
    if (budgetTokens === 65_000) {
      assert(prepared.receipt.reasons.includes("open-scene-prefix-excerpts"));
      assert(prepared.messageIds.length < source.length);
      const suffixSize = (start: number) => {
        const suffix = source.slice(start);
        return (
          estimateChatSummaryTokens(
            suffix
              .map(
                (message, index) =>
                  `#${start + index + 1} ${message.role === "user" ? "User" : "Character"}: ${message.content}`,
              )
              .join("\n\n"),
          ) +
          suffix.length * 12
        );
      };
      const start = source.length - prepared.messageIds.length;
      const liveBudget = budgetTokens - 192 - 1024;
      assert(suffixSize(start) <= liveBudget);
      assert(suffixSize(start - 1) > liveBudget, "the optimized fit keeps the largest possible live suffix");
    }
  }
  const previewStarted = performance.now();
  const preview = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(preview.json().source, "assembled");
  assert(preview.json().messages.length > 0);
  assert(performance.now() - previewStarted < 5000, "Peek Prompt must not block on long-scene fitting");
  console.info(`Peek Prompt on 1000-message archive: ${Math.round(performance.now() - previewStarted)} ms`);
  const url = `/chats/${chat.id}/advanced-memory`;
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Idle editing proof" });
  assert(preset);
  const group = await presets.createGroup({ presetId: preset.id, name: "New group" });
  const section = await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Keep this editable.",
  });
  assert(group && section);
  const idleStarted = performance.now();
  const [statusRead, presetEdit, characterList] = await Promise.all([
    app.inject({ method: "GET", url }),
    app.inject({
      method: "PATCH",
      url: `/api/prompts/${preset.id}/sections/${section.id}`,
      payload: { groupId: group.id },
    }),
    app.inject({ method: "GET", url: "/api/characters" }),
  ]);
  for (const response of [statusRead, presetEdit, characterList]) assert.equal(response.statusCode, 200, response.body);
  assert.equal(presetEdit.json().groupId, group.id);
  assert(characterList.json().some((item: { id: string }) => item.id === character.id));
  assert.equal(statusRead.json().job.status, "ready");
  assert(performance.now() - idleStarted < 2000, "reading memory status must not stall unrelated app requests");
  console.info(
    `Concurrent idle status, preset edit and character list: ${Math.round(performance.now() - idleStarted)} ms`,
  );
  const emptyPatch = await app.inject({ method: "PATCH", url: `${url}/records/scene-0-saved`, payload: {} });
  assert.equal(emptyPatch.statusCode, 400, emptyPatch.body);
  assert.deepEqual(
    (await memory.status(chat.id)).records,
    full.records,
    "an empty patch cannot change saved revisions",
  );
  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    metadataParses = 0;
    const started = performance.now();
    const response = await app.inject({
      method,
      url: method === "GET" ? url : `${url}/records/scene-0-saved`,
      ...(method === "PATCH" ? { payload: { enabled: false } } : {}),
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(metadataParses <= source.length * 3, "record mutations do not repeatedly parse the entire transcript");
    assert(response.body.length < 150_000, "inspector responses do not resend megabytes of hidden excerpts");
    const state = response.json();
    assert(state.records.every((record: { kind: string }) => record.kind !== "excerpt"));
    assert.equal(state.job.status, "ready", "small archive edits do not start preparation");
    const selected = state.records.find((record: { id: string }) => record.id === "scene-0-saved");
    if (method === "PATCH") assert.equal(selected.enabled, false);
    if (method === "DELETE") assert.equal(selected, undefined);
    console.info(
      `${method} on 1000-message archive: ${Math.round(performance.now() - started)} ms, ${response.body.length} bytes`,
    );
  }
  const exported = await memory.exportMemory(chat.id);
  assert(
    exported.records.some((entry) => entry.record.kind === "excerpt"),
    "export still includes recalled excerpts",
  );
  assert.deepEqual(await chats.listMessages(chat.id), source, "editing memories never changes source messages");
  const sourceResponse = await app.inject({ method: "GET", url: `${url}/records/scene-50-saved/sources` });
  assert.equal(sourceResponse.statusCode, 200);
  assert.equal(sourceResponse.json().length, 50, "source inspection still fetches complete source messages on demand");
  await chats.updateMessageContent(source[50]!.id, "Changed source");
  const changed = (await app.inject({ method: "GET", url })).json();
  assert.equal(
    changed.records.find((record: { id: string }) => record.id === "scene-50-saved").embeddingStatus,
    "pending",
    "editing source text retains the saved index state",
  );
  await chats.updateMessageExtra(source[50]!.id, { hiddenFromAI: true });
  const hidden = (await app.inject({ method: "GET", url })).json();
  assert.equal(
    hidden.records.find((record: { id: string }) => record.id === "scene-50-saved").embeddingStatus,
    "pending",
    "global hiding preserves the saved memory's index state",
  );
  const manyScenesChat = await chats.create({
    name: "Many saved scene boundaries",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  assert(manyScenesChat);
  await chats.createMessagesBatch(
    manyScenesChat.id,
    Array.from({ length: 10_000 }, () => ({ role: "user" as const, content: "A recorded scene event." })),
  );
  const manySources = await chats.listMessages(manyScenesChat.id);
  await db.insert(advancedMemoryRecords).values(
    Array.from({ length: 2000 }, (_, index) => {
      const chunk = manySources.slice(index * 5, index * 5 + 5);
      const sceneId = `scene-${chunk[0]!.id}`;
      return {
        ...rows[0]!,
        id: sceneId,
        sceneId,
        chatId: manyScenesChat.id,
        startMessageId: chunk[0]!.id,
        endMessageId: chunk.at(-1)!.id,
        messageIds: JSON.stringify(chunk.map((message) => message.id)),
        content: "",
      };
    }),
  );
  const manyScenesStarted = performance.now();
  const manyScenesStatus = await memory.status(manyScenesChat.id);
  const manyScenesDuration = performance.now() - manyScenesStarted;
  console.info(`Inspect 2000 scenes across 10000 messages: ${Math.round(manyScenesDuration)} ms`);
  assert.equal(manyScenesStatus.unpreparedScenes?.length, 2000);
  assert(manyScenesDuration < 2000, "scene validation must not rescan the full history for each saved boundary");
  console.info(
    "Advanced Memory inspector regression passed (large archive, compact status, toggle/delete and source revisions).",
  );
} finally {
  JSON.parse = parse;
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
