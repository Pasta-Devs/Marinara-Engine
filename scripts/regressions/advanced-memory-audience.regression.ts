import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-scene-audience-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
let summaries = 0;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }),
    );
    return;
  }
  const [system, transcript] = body.messages;
  const classification = system.content.startsWith("Identify scene transitions");
  let result;
  if (classification) {
    result = {
      starts: JSON.parse(transcript.content)
        .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
        .map((message: { messageId: string }) => ({ messageId: message.messageId })),
    };
  } else {
    summaries++;
    assert.match(system.content, /merely mentioned, remembered, discussed/);
    assert.match(system.content, /user-only participation means \[\]/);
    assert.match(system.content, /"all" ONLY/);
    const text: string = transcript.content;
    result = {
      summary: `The compass promise was recorded. ${text.includes("ONLY_MAUKIE") ? "Maukie discussed the absent Pantalone." : "The travelers remembered the compass."}`,
      ...(text.includes("ONLY_MAUKIE")
        ? { audience: ["maukie"] }
        : text.includes("EVERYONE_PRESENT")
          ? { audience: "all" }
          : text.includes("UNKNOWN_PARTICIPANT")
            ? { audience: ["not-a-chat-character"] }
            : {}),
    };
  }
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(result) }, finish_reason: "stop" }],
    }),
  );
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Audience fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const chat = await chats.create({
    name: "Scene access",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      enabled: true,
      narratorCharacterId: "narrator",
      knowledgeStarts: { maukie: null, pantalone: null },
      retrieveMinMessages: 1,
      retrieveMaxMessages: 3,
      retrieveMaxScenes: 10,
    },
  });
  await chats.createMessagesBatch(chat.id, [
    { role: "user", content: "ONLY_MAUKIE Mari and Maukie discuss the absent Pantalone and their compass promise." },
    {
      role: "assistant",
      characterId: "narrator",
      content: "Maukie explains his compass promise. Pantalone is far away.",
    },
    { role: "user", content: "SCENE_CHANGE USER_ALONE Mari considers the compass promise alone." },
    { role: "assistant", characterId: "narrator", content: "The compass promise remains a private memory." },
    {
      role: "user",
      content: "SCENE_CHANGE EVERYONE_PRESENT Mari, Maukie and Pantalone meet to discuss the compass promise.",
    },
    { role: "assistant", characterId: "maukie", content: "Maukie and Pantalone agree on the compass promise." },
    { role: "user", content: "SCENE_CHANGE UNKNOWN_PARTICIPANT A stranger holds a compass." },
    { role: "assistant", characterId: "narrator", content: "The stranger recalls a compass promise." },
    {
      role: "user",
      content: "SCENE_CHANGE What about the compass promise and the travelers?",
      extra: { isConversationStart: true },
    },
  ]);
  await memory.initialize(chat.id);
  const source = await chats.listMessages(chat.id);
  const scenes = () =>
    memory
      .status(chat.id)
      .then((status) => status.records.filter((record) => record.kind === "scene" && record.content));
  let saved = await scenes();
  assert.equal(summaries, 4, "one helper summary per finished scene, with no separate participant call");
  assert.equal(saved.length, 4, "one scene memory, regardless of the number of characters");
  const at = (index: number) => saved.find((record) => record.messageIds.includes(source[index]!.id))!;
  assert.deepEqual(at(0).audienceCharacterIds, ["maukie"], "discussing Pantalone does not grant Pantalone access");
  assert.deepEqual(at(2).audienceCharacterIds, [], "missing audience is narrator-only, including a user-only scene");
  assert.deepEqual(
    at(4).audienceCharacterIds,
    ["maukie", "pantalone"],
    "explicit all expands current characters, excluding the implicit narrator",
  );
  assert.deepEqual(at(6).audienceCharacterIds, [], "unknown model IDs cannot grant access");
  const recall = (audienceCharacterIds: string[]) =>
    memory.prepare({ chatId: chat.id, messages: source, audienceCharacterIds, budgetTokens: 12000, readOnly: true });
  for (const mode of ["individual", "shared"]) {
    await chats.patchMetadata(chat.id, { groupChatMode: mode });
    const absent = await recall(["pantalone"]);
    assert.deepEqual(
      absent.receipt.recalledSceneIds,
      [at(4).sceneId],
      `${mode}: absent characters recall only assigned scenes`,
    );
    assert(
      absent.receipt.recalledMessageIds.every((id) => at(4).messageIds.includes(id)),
      "raw excerpts obey their scene access too",
    );
    assert.equal(
      (await recall(["narrator"])).receipt.recalledSceneIds.length,
      4,
      "narrator recalls assigned and unassigned scenes without copies",
    );
    assert.deepEqual(
      (await recall(["maukie", "pantalone", "narrator"])).receipt.recalledSceneIds,
      [at(4).sceneId],
      "a mixed group cannot use narrator privilege for absent characters",
    );
    assert.equal((await recall(["maukie"])).receipt.recalledSceneIds.length, 2);
  }
  const shared = at(4);
  const row = (await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, shared.id)))[0]!;
  await db
    .update(advancedMemoryRecords)
    .set({ audienceCharacterIds: '["maukie"]', dependencies: "[]" })
    .where(eq(advancedMemoryRecords.id, shared.id));
  await db.insert(advancedMemoryRecords).values({
    ...row,
    id: "legacy-pantalone",
    dependencies: "[]",
    audienceCharacterIds: '["pantalone"]',
    content: "Another compass promise recap.",
  });
  await db
    .insert(advancedMemoryRecords)
    .values({ ...row, id: "legacy-narrator", dependencies: "[]", audienceCharacterIds: "[]" });
  saved = await scenes();
  assert.equal(saved.length, 4, "legacy character/narrator copies appear as one memory immediately");
  assert.deepEqual(
    at(4).audienceCharacterIds,
    [],
    "legacy roster-based audiences grant no character access until reviewed",
  );
  assert(!(await recall(["pantalone"])).receipt.recalledSceneIds.includes(shared.sceneId));
  assert.equal((await recall(["narrator"])).receipt.recalledSceneIds.length, 4);
  assert.equal(summaries, 4, "opening or recalling an old archive never starts background classification");
  const legacyRows = (await db.select().from(advancedMemoryRecords)).filter(
    (record) => record.sceneId === shared.sceneId && record.content,
  );
  await memory.updateRecord(chat.id, at(4).id, { enabled: false });
  await memory.updateRecord(chat.id, at(4).id, { enabled: true });
  const preservedRows = (await db.select().from(advancedMemoryRecords)).filter(
    (record) => record.sceneId === shared.sceneId && record.content,
  );
  assert.equal(preservedRows.length, legacyRows.length, "toggling never deletes unreviewed scene copies");
  for (const before of legacyRows) {
    const after = preservedRows.find((record) => record.id === before.id)!;
    assert.equal(after.content, before.content);
    assert.equal(
      after.audienceCharacterIds,
      before.audienceCharacterIds,
      "toggling preserves unreviewed assignments on disk",
    );
  }
  const exportedScenes = (await memory.exportTransferRecords(chat.id)).filter(
    (item) => item.record.sceneId === shared.sceneId && item.record.kind === "scene" && item.record.content,
  );
  assert.equal(exportedScenes[0]!.record.id, at(4).id, "export places the presented scene first for one-scene imports");
  assert.equal(exportedScenes.length, legacyRows.length, "export retains the original duplicate texts as backup data");
  const keptSummary = at(4).content;
  await memory.initialize(chat.id, { detectScenes: false });
  saved = await scenes();
  assert.equal(summaries, 5, "explicit preparation checks only the unreviewed scene's participants");
  assert.equal(at(4).content, keptSummary, "access review reuses the paid summary verbatim");
  assert.deepEqual(at(4).audienceCharacterIds, ["maukie", "pantalone"]);
  assert((await recall(["pantalone"])).receipt.recalledSceneIds.includes(shared.sceneId));
  const editId = at(4).id;
  await memory.updateRecord(chat.id, editId, { audienceCharacterIds: [] });
  saved = await scenes();
  assert.deepEqual(at(4).audienceCharacterIds, [], "clearing selection saves narrator-only access");
  assert.equal((await recall(["pantalone"])).receipt.recalledSceneIds.length, 0);
  assert.equal((await recall(["narrator"])).receipt.recalledSceneIds.length, 4);
  assert.equal(summaries, 5, "reading/editing legacy access spends no model tokens");
  await memory.initialize(chat.id, { detectScenes: false });
  assert.equal(summaries, 5, "maintenance does not recreate removed character audiences");
  assert.equal(
    (await memory.status(chat.id)).unpreparedScenes?.length,
    0,
    "narrator-only is a complete scene, not a missing character copy",
  );
  await memory.updateRecord(chat.id, editId, { audienceCharacterIds: ["maukie", "pantalone"] });
  assert.equal((await scenes()).length, 4, "assigning multiple characters never creates another narrator copy");
  await chats.updateMessageExtra(source[4]!.id, { hiddenFromAICharacterIds: ["pantalone"] });
  const hidden = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["pantalone"],
    budgetTokens: 12000,
    readOnly: true,
  });
  assert.equal(hidden.receipt.recalledSceneIds.length, 0, "named access cannot bypass source hiding");
  await memory.deleteRecord(chat.id, editId);
  await memory.initialize(chat.id, { detectScenes: false });
  assert.equal(
    (await scenes()).length,
    3,
    "deleting the single scene deletes all its legacy copies without resurrection",
  );
  console.log(
    "Advanced Memory narrator-only defaults, participant access, shared scenes and legacy duplicate corrections passed.",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
