import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const classifiedIds = new Set<string>();
const summaryInputs: string[] = [];
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
    for (const message of JSON.parse(transcript.content)) classifiedIds.add(message.messageId);
    result = {
      starts: JSON.parse(transcript.content)
        .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
        .map((message: { messageId: string }) => ({ messageId: message.messageId })),
    };
  } else {
    summaries++;
    summaryInputs.push(transcript.content);
    assert.match(system.content, /merely mentioned, remembered, discussed/);
    assert.match(system.content, /user-only participation means \[\]/);
    assert.match(system.content, /"all" ONLY/);
    const text: string = transcript.content;
    result = {
      summary: `The compass promise was recorded. ${text.includes("ONLY_MAUKIE") ? "Maukie discussed the absent Pantalone." : "The travelers remembered the compass."}${text.includes("PRIVATE_MAUKIE") ? ' {{#if char == "Maukie"}}MAUKIE_PRIVATE{{/if}}' : ""}`,
      ...(text.includes("ONLY_MAUKIE")
        ? { audience: ["maukie"] }
        : text.includes("EVERYONE_PRESENT")
          ? { audience: "all" }
          : text.includes("BOTH_PRESENT")
            ? { audience: ["maukie", "pantalone"] }
            : text.includes("UNKNOWN_PARTICIPANT")
              ? { audience: ["not-a-chat-character"] }
              : {}),
    };
  }
  const content = JSON.stringify(result);
  const formattedContent = classification
    ? content
    : `<think>Check the actual scene participants.</think>\n\`\`\`json\n${transcript.content.includes("EVERYONE_PRESENT") ? content.replace(/"/g, '<|"|>') : content}\n\`\`\``;
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: formattedContent }, finish_reason: "stop" }],
    }),
  );
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService, advancedMemorySourceFingerprint } =
  await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { characters } = await import("../../packages/server/src/db/schema/characters.js");
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
  const original = await chats.listMessages(chat.id);
  const hiddenIds = original.slice(0, 8).map((message) => message.id);
  // Both automatic summary hides and manual hides use the same global flag.
  await chats.bulkSetHiddenFromAI(chat.id, hiddenIds, true);
  const { createChatSummaryEntry } = await import("../../packages/shared/src/index.js");
  await chats.patchMetadata(chat.id, {
    summaryEntries: [
      createChatSummaryEntry({
        content: "A past scene was summarized.",
        enabled: false,
        messageIds: hiddenIds.slice(0, 2),
        hiddenMessageIds: hiddenIds.slice(0, 2),
      }),
    ],
  });
  await memory.initialize(chat.id);
  const source = await chats.listMessages(chat.id);
  assert(
    hiddenIds.every((id) => classifiedIds.has(id)),
    "initial classification scans all globally hidden turns",
  );
  assert(
    summaryInputs.some((text) => text.includes("ONLY_MAUKIE")),
    "hidden participation reaches the summarizer",
  );
  const indexed = (await memory.status(chat.id)).records.filter((record) => record.kind === "excerpt");
  assert(
    hiddenIds.every((id) => indexed.some((record) => record.messageIds.includes(id))),
    "all hidden turns are indexed",
  );
  assert(
    indexed.every((record) => record.embeddingStatus === "vectorized"),
    "hidden excerpts receive embeddings",
  );
  assert.deepEqual(await chats.listMessages(chat.id), source, "scanning never unhides source messages");
  const scenes = () =>
    memory
      .status(chat.id)
      .then((status) => status.records.filter((record) => record.kind === "scene" && record.content));
  let saved = await scenes();
  assert.equal(summaries, 4, "one helper summary per finished scene, with no separate participant call");
  assert.equal(saved.length, 4, "one scene memory, regardless of the number of characters");
  const at = (index: number) => saved.find((record) => record.messageIds.includes(source[index]!.id))!;
  assert.deepEqual(at(0).audienceCharacterIds, ["maukie"], "discussing Pantalone does not grant Pantalone access");
  // Mari decided on 2026-10-07 (#7184) that a group scene with no listed participants goes to every
  // character, flagged so the user removes anyone who wasn't there. It was narrator-only before.
  assert.deepEqual(
    at(2).audienceCharacterIds,
    ["maukie", "pantalone"],
    "a missing audience in a group chat goes to every character, excluding the implicit narrator",
  );
  const flag = (index: number) =>
    at(index).dependencies.find((item) => item.id === "scene-audience-unmatched")?.revision;
  assert.equal(flag(2), "no audience returned", "a group scene with a missing audience is flagged for review");
  assert.equal(flag(6), "not-a-chat-character", "unknown names are flagged with the names that fit no character");
  assert.equal(flag(0), undefined, "matched names are not flagged");
  assert.equal(flag(4), undefined, "explicit all is not flagged");
  assert.deepEqual(
    at(4).audienceCharacterIds,
    ["maukie", "pantalone"],
    "explicit all expands current characters, excluding the implicit narrator",
  );
  assert.deepEqual(at(6).audienceCharacterIds, [], "unknown model IDs cannot grant access");
  assert(
    (await memory.status(chat.id)).warnings.includes("scene-audience-unmatched"),
    "unknown or missing participants are flagged for review, not dropped silently",
  );
  assert.equal(
    at(4).content,
    "The compass promise was recorded. The travelers remembered the compass.",
    "thinking, JSON fences and Gemma delimiters preserve both summary prose and scene access",
  );
  const recall = (audienceCharacterIds: string[], messages = source) =>
    memory.prepare({ chatId: chat.id, messages, audienceCharacterIds, budgetTokens: 12000, readOnly: true });
  const unlistedScene = at(2);
  const unlistedRow = (
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, unlistedScene.id))
  )[0]!;
  await db
    .update(advancedMemoryRecords)
    .set({ dependencies: "[]" })
    .where(eq(advancedMemoryRecords.id, unlistedScene.id));
  await db.insert(advancedMemoryRecords).values({
    ...unlistedRow,
    id: `${unlistedScene.id}-audience`,
    content: "",
    dependencies: "[]",
    summaryWork: null,
    updatedAt: new Date(Date.now() + 1000).toISOString(),
  });
  assert.equal((await scenes()).length, 4, "an interrupted access check cannot hide its saved recap");
  assert.equal((await recall(["narrator"])).receipt.recalledSceneIds.length, 4);
  await memory.reindex(chat.id);
  assert.equal(summaries, 4, "reindexing never generates summaries or calls participant classification");
  assert.equal((await scenes()).find((record) => record.id === unlistedScene.id)?.content, unlistedScene.content);
  await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, `${unlistedScene.id}-audience`));
  await db
    .update(advancedMemoryRecords)
    .set({ dependencies: unlistedRow.dependencies })
    .where(eq(advancedMemoryRecords.id, unlistedScene.id));
  for (const mode of ["individual", "shared"]) {
    await chats.patchMetadata(chat.id, { groupChatMode: mode });
    const absent = await recall(["pantalone"]);
    // Pantalone has the unlisted scene and the "all" scene, never the one Maukie only discussed him in.
    const assigned = [at(2), at(4)];
    assert.deepEqual(
      absent.receipt.recalledSceneIds,
      assigned.map((record) => record.sceneId),
      `${mode}: absent characters recall only assigned scenes`,
    );
    assert(
      absent.receipt.recalledMessageIds.every((id) => assigned.some((record) => record.messageIds.includes(id))),
      "raw excerpts obey their scene access too",
    );
    assert.equal(
      (await recall(["narrator"])).receipt.recalledSceneIds.length,
      4,
      "narrator recalls assigned and unassigned scenes without copies",
    );
    // Mari decided on 2026-10-07 (#7237) that a merged group recalls what any present character
    // remembers, marked with who does. It needed every present character before. Individual is unchanged.
    assert.deepEqual(
      (await recall(["maukie", "pantalone", "narrator"])).receipt.recalledSceneIds,
      (mode === "individual" ? assigned : [...assigned, at(0)]).map((record) => record.sceneId),
      "a mixed group cannot use narrator privilege for absent characters",
    );
    assert.equal((await recall(["maukie"])).receipt.recalledSceneIds.length, 3);
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
    (record) => record.sceneId === shared.sceneId && record.kind === "scene" && record.content,
  );
  await memory.updateRecord(chat.id, at(4).id, { enabled: false });
  await memory.updateRecord(chat.id, at(4).id, { enabled: true });
  const preservedRows = (await db.select().from(advancedMemoryRecords)).filter(
    (record) => record.sceneId === shared.sceneId && record.kind === "scene" && record.content,
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
  // Pantalone keeps only the unlisted scene, which every character received.
  const unlistedOnly = [unlistedScene.sceneId];
  assert.deepEqual((await recall(["pantalone"])).receipt.recalledSceneIds, unlistedOnly);
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
  assert.deepEqual(
    hidden.receipt.recalledSceneIds,
    unlistedOnly,
    "changed source visibility cannot expose an old unreviewed recap",
  );
  assert(!hidden.receipt.recalledMessageIds.includes(source[4]!.id), "hidden source messages stay out of excerpts");
  await memory.updateRecord(chat.id, editId, {
    content: (await scenes()).find((record) => record.id === editId)!.content,
  });
  assert.deepEqual(
    (await recall(["pantalone"], await chats.listMessages(chat.id))).receipt.recalledSceneIds,
    [...unlistedOnly, shared.sceneId],
    "reviewing the recap restores partial scene access",
  );
  for (const messageId of (await scenes()).find((record) => record.id === editId)!.messageIds)
    await chats.updateMessageExtra(messageId, { hiddenFromAICharacterIds: ["pantalone"] });
  assert.deepEqual(
    (
      await memory.prepare({
        chatId: chat.id,
        messages: await chats.listMessages(chat.id),
        audienceCharacterIds: ["pantalone"],
        budgetTokens: 12000,
        readOnly: true,
      })
    ).receipt.recalledSceneIds,
    unlistedOnly,
    "an entirely hidden scene remains inaccessible",
  );
  await memory.deleteRecord(chat.id, editId);
  await memory.initialize(chat.id, { detectScenes: false });
  assert.equal(
    (await scenes()).length,
    3,
    "deleting the single scene deletes all its legacy copies without resurrection",
  );
  const historicalChat = await chats.create({
    name: "Previously skipped hidden history",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(historicalChat);
  const knowledgeStarts = { maukie: null, pantalone: null };
  await chats.patchMetadata(historicalChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      enabled: true,
      narratorCharacterId: "narrator",
      knowledgeStarts,
      retrieveMinMessages: 1,
      retrieveMaxMessages: 3,
      retrieveMaxScenes: 10,
    },
  });
  await chats.createMessagesBatch(historicalChat.id, [
    { role: "user", content: "ONLY_MAUKIE Maukie makes a compass promise.", extra: { hiddenFromAI: true } },
    { role: "user", content: "SCENE_CHANGE EVERYONE_PRESENT A compass reunion.", extra: { hiddenFromAI: true } },
    { role: "assistant", characterId: "maukie", content: "Everyone remembers the compass promise." },
    { role: "user", content: "SCENE_CHANGE What about the compass promise?" },
  ]);
  let history = await chats.listMessages(historicalChat.id);
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const oldFingerprint = hash([
    advancedMemorySourceFingerprint(history),
    hash([true, ["maukie", "pantalone", "narrator"], knowledgeStarts, "narrator"]),
    [],
  ]);
  // An old successful scan omitted a hidden scene transition, but saved a later closed boundary.
  for (const [start, end] of [
    [0, 1],
    [2, 2],
  ] as const) {
    const legacyScene = `scene-${history[start]!.id}`;
    await db.insert(advancedMemoryRecords).values({
      id: legacyScene,
      sceneId: legacyScene,
      chatId: historicalChat.id,
      kind: "scene",
      status: "closed",
      startMessageId: history[start]!.id,
      endMessageId: history[end]!.id,
      messageIds: JSON.stringify(history.slice(start, end + 1).map((message) => message.id)),
      audienceCharacterIds: "[]",
      content: "",
      title: "Scene",
      timeline: null,
      enabled: 1,
      manualOverride: 0,
      sourceFingerprint: "legacy",
      dependencies: "[]",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  await chats.patchMetadata(historicalChat.id, {
    advancedMemoryState: {
      status: "ready",
      stage: "ready",
      historyClassified: true,
      processedMessageId: history.at(-1)!.id,
      classifiedMessageId: history.at(-1)!.id,
      sourceFingerprint: oldFingerprint,
      classifiedSourceFingerprint: oldFingerprint,
    },
  });
  // Maintenance can run before an explicit scan. It must not certify the old classification checkpoint.
  await memory.maintain(historicalChat.id);
  classifiedIds.clear();
  const cancellation = new AbortController();
  await assert.rejects(
    memory.initialize(historicalChat.id, {
      signal: cancellation.signal,
      onProgress: (event) => {
        if (event.stage === "classifying" && event.completed === history.length)
          cancellation.abort(new Error("Pause after the recovered classification batch"));
      },
    }),
  );
  assert(
    history.every((message) => classifiedIds.has(message.id)),
    "legacy checkpoints re-scan skipped hidden history",
  );
  classifiedIds.clear();
  await memory.initialize(historicalChat.id);
  assert.equal(classifiedIds.size, 0, "resume reuses recovered classification without reviving obsolete boundaries");
  const recovered = (await memory.status(historicalChat.id)).records.filter(
    (record) => record.kind === "scene" && record.content,
  );
  assert.deepEqual(
    recovered.map((record) => [record.startIndex, record.endIndex]),
    [
      [1, 1],
      [2, 3],
    ],
  );
  assert.deepEqual(
    recovered[0]!.audienceCharacterIds,
    ["maukie"],
    "recovered hidden scenes get their own participants",
  );
  const prepared = await memory.prepare({
    chatId: historicalChat.id,
    messages: history,
    audienceCharacterIds: ["maukie"],
    budgetTokens: 12000,
    readOnly: true,
  });
  assert.deepEqual(
    prepared.messageIds,
    history.slice(2).map((message) => message.id),
    "hidden turns remain out of live context without any start marker",
  );
  assert(
    prepared.receipt.recalledSceneIds.includes(recovered[0]!.sceneId),
    "hidden history can be recalled as scoped memory",
  );
  classifiedIds.clear();
  const paidSummaries = summaries;
  await memory.initialize(historicalChat.id);
  assert.equal(classifiedIds.size, 0, "completed scans reuse their hidden-history checkpoint");
  assert.equal(summaries, paidSummaries, "completed summaries are reused");

  await chats.createMessagesBatch(historicalChat.id, [
    { role: "user", content: "SCENE_CHANGE ONLY_MAUKIE Another compass promise.", extra: { hiddenFromAI: true } },
    {
      role: "assistant",
      characterId: "maukie",
      content: "The hidden compass promise is fulfilled.",
      extra: { hiddenFromAI: true },
    },
    { role: "user", content: "SCENE_CHANGE Remember the compass promise." },
    { role: "user", content: "COMMAND_ONLY_MUST_STAY_EXCLUDED", extra: { commandOnly: true, hiddenFromAI: true } },
  ]);
  history = await chats.listMessages(historicalChat.id);
  await memory.initialize(historicalChat.id);
  assert(
    classifiedIds.has(history[4]!.id) && classifiedIds.has(history[5]!.id),
    "later scans also classify new hidden turns",
  );
  assert(!classifiedIds.has(history[7]!.id), "command-only messages remain excluded");
  const later = (await memory.status(historicalChat.id)).records;
  assert(
    later.some(
      (record) =>
        record.kind === "scene" &&
        record.messageIds.includes(history[5]!.id) &&
        record.audienceCharacterIds.includes("maukie"),
    ),
    "later hidden scenes are summarized and attributed",
  );
  assert(
    later.some(
      (record) =>
        record.kind === "excerpt" &&
        record.messageIds.includes(history[5]!.id) &&
        record.embeddingStatus === "vectorized",
    ),
    "later hidden turns are indexed and embedded",
  );
  await chats.createMessage({
    chatId: historicalChat.id,
    role: "user",
    content: "NEW_HIDDEN_END Maukie fulfills the compass promise.",
    extra: { hiddenFromAI: true },
  });
  history = await chats.listMessages(historicalChat.id);
  const sceneCheck = await memory.getSceneCheck(historicalChat.id, { force: true });
  assert(sceneCheck);
  assert(
    sceneCheck.messages.some((message) => message.messageId === history[5]!.id),
    "post-generation checks read hidden turns",
  );
  assert(!sceneCheck.messages.some((message) => message.messageId === history[7]!.id));
  assert(
    await memory.commitSceneCheck(historicalChat.id, sceneCheck, { ends: [{ messageNumber: history.length }] }),
    "a hidden source may end a scene",
  );
  assert.deepEqual(
    await chats.listMessages(historicalChat.id),
    history,
    "all processing preserves hide flags and source text",
  );
  await memory.maintain(historicalChat.id);
  assert(
    summaryInputs.some((text) => text.includes("NEW_HIDDEN_END")),
    "post-generation preparation summarizes hidden turns",
  );
  classifiedIds.clear();
  const beforeVisibilityChange = summaries;
  await chats.updateMessageExtra(history[0]!.id, { hiddenFromAI: false });
  await memory.initialize(historicalChat.id);
  assert.equal(classifiedIds.size, 0, "unhiding already classified history does not repeat paid scene decisions");
  await chats.updateMessageExtra(history[0]!.id, { hiddenFromAI: true });
  await memory.initialize(historicalChat.id);
  assert.equal(classifiedIds.size, 0, "hiding already classified history does not repeat paid scene decisions");
  assert.equal(summaries, beforeVisibilityChange, "visibility-only edits keep completed summaries");

  // #7237: Cara joins a merged group chat after Maukie and Pantalone made memories. Her ID sorts first,
  // which used to make her the `char` that every summary condition was checked against.
  for (const [id, name] of [
    ["maukie", "Maukie"],
    ["pantalone", "Pantalone"],
    ["narrator", "Narrator"],
    ["aaa-newcomer", "Cara"],
  ])
    await db
      .insert(characters)
      .values({ id, data: JSON.stringify({ name }), createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const group = await chats.create({
    name: "Merged newcomer",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(group);
  const groupSettings = {
    enabled: true,
    narratorCharacterId: "narrator",
    knowledgeStarts: { maukie: null, pantalone: null },
    retrieveMinMessages: 1,
    retrieveMaxMessages: 3,
    retrieveMaxScenes: 10,
  };
  await chats.patchMetadata(group.id, {
    groupChatMode: "merged",
    advancedMemory: groupSettings,
    macroVariables: { ready: "yes" },
  });
  await chats.createMessagesBatch(group.id, [
    { role: "user", content: "ONLY_MAUKIE Maukie buries the compass promise." },
    { role: "assistant", characterId: "maukie", content: "Maukie hides the compass promise alone." },
    {
      role: "user",
      content: "SCENE_CHANGE BOTH_PRESENT PRIVATE_MAUKIE Maukie and Pantalone renew the compass promise.",
    },
    { role: "assistant", characterId: "pantalone", content: "Pantalone accepts the compass promise." },
    { role: "user", content: "SCENE_CHANGE UNKNOWN_PARTICIPANT A stranger holds a compass." },
    { role: "assistant", characterId: "narrator", content: "The stranger recalls a compass promise." },
    { role: "user", content: "SCENE_CHANGE What about the compass promise?", extra: { isConversationStart: true } },
  ]);
  const groupSource = await chats.listMessages(group.id);
  const { scopeCharacterSummary } = await import("../../packages/shared/src/index.js");
  await chats.patchMetadata(group.id, {
    summaryEntries: [
      // Advanced Memory scopes a promoted scene to its participants and the narrator.
      createChatSummaryEntry({
        content: scopeCharacterSummary("CONST_SHARED The compass promise holds.", ["Maukie", "Pantalone", "Narrator"]),
        enabled: true,
        messageIds: groupSource.slice(2, 4).map((message) => message.id),
      }),
      createChatSummaryEntry({
        content:
          'CONST_PLAIN The compass promise. {{#if char == "Maukie" || "Narrator"}}CONST_MAUKIE{{/if}}{{#if char == "Narrator"}}CONST_NARRATOR{{/if}} {{#if char == "Maukie" && getvar::ready == "yes"}}MIXED_SECRET{{/if}}',
        enabled: true,
        messageIds: groupSource.slice(0, 2).map((message) => message.id),
      }),
    ],
  });
  await memory.initialize(group.id);
  const groupScenes = (await memory.status(group.id)).records.filter(
    (record) => record.kind === "scene" && record.content,
  );
  const sceneAt = (index: number) =>
    groupScenes.find((record) => record.messageIds.includes(groupSource[index]!.id))!.sceneId;
  const [maukieOnly, both, narratorOnly] = [sceneAt(0), sceneAt(2), sceneAt(4)];
  const groupRecall = async (audienceCharacterIds: string[], chatId = group.id) =>
    memory.prepare({
      chatId,
      messages: await chats.listMessages(chatId),
      audienceCharacterIds,
      budgetTokens: 12000,
      readOnly: true,
    });
  const sharedSceneExcerpt =
    /remembered the compass\. \[Known only to Maukie: MAUKIE_PRIVATE\]\n\nExcerpt:\nMessages #3–#4;[^\n]*\n#3 User: [^\n]*\n#4 Pantalone: Pantalone accepts the compass promise\.$/u;
  const marked = (prepared: { chatSummary: string | null; recalledScenes: string | null }) =>
    /known only to/iu.test(`${prepared.chatSummary}\n${prepared.recalledScenes}`);
  // Before anyone joins, a scene only Maukie saw is recalled and marked as his. Shared memories carry no mark.
  const beforeJoin = await groupRecall(["maukie", "pantalone", "narrator"]);
  assert.deepEqual(
    new Set(beforeJoin.receipt.recalledSceneIds),
    new Set([maukieOnly, both]),
    "a merged group recalls what any present character remembers",
  );
  assert.match(beforeJoin.recalledScenes!, /Scene summary \(known only to Maukie\):\nMessages #1–#2;/u);
  assert.match(
    beforeJoin.recalledScenes!,
    /\n\nScene summary:\nMessages #3–#4;/u,
    "a scene everyone present saw has no mark",
  );
  // A private recap section no longer withholds the excerpt (#7269): both readers saw #3–#4.
  assert.match(beforeJoin.recalledScenes!, sharedSceneExcerpt);
  assert.match(
    beforeJoin.chatSummary!,
    /\nCONST_SHARED The compass promise holds\.\n/u,
    "a summary everyone knows has no mark",
  );
  // A condition mixing a name with a variable is checked for each present character.
  assert.match(
    beforeJoin.chatSummary!,
    /CONST_PLAIN The compass promise\. \[Known only to Maukie: CONST_MAUKIE\] \[Known only to Maukie: MIXED_SECRET\]$/u,
  );
  assert(!beforeJoin.chatSummary!.includes("CONST_NARRATOR"), "a mixed group gets no narrator-only knowledge");

  await chats.update(group.id, { characterIds: ["maukie", "pantalone", "narrator", "aaa-newcomer"] });
  await chats.createMessagesBatch(group.id, [
    { role: "assistant", characterId: "aaa-newcomer", content: "Cara arrives and asks about the compass promise." },
    { role: "user", content: "Tell Cara about the compass promise." },
  ]);
  // The merged audience is every chat character, the newcomer included.
  const afterJoin = await groupRecall(["maukie", "pantalone", "narrator", "aaa-newcomer"]);
  assert.deepEqual(
    new Set(afterJoin.receipt.recalledSceneIds),
    new Set([maukieOnly, both]),
    "a character who joins later hides no earlier memory",
  );
  assert(!afterJoin.receipt.recalledSceneIds.includes(narratorOnly), "a memory no present character has stays out");
  assert.deepEqual(
    new Set(afterJoin.receipt.recalledMessageIds),
    new Set(groupSource.slice(0, 4).map((message) => message.id)),
    "a scene with a private section recalls the messages its readers saw (#7269)",
  );
  assert.match(afterJoin.recalledScenes!, /Scene summary \(known only to Maukie\):\nMessages #1–#2;/u);
  assert.match(afterJoin.recalledScenes!, /Scene summary \(known only to Maukie, Pantalone\):\nMessages #3–#4;/u);
  assert.match(afterJoin.recalledScenes!, sharedSceneExcerpt);
  assert.match(
    afterJoin.chatSummary!,
    /\n\[Known only to Maukie, Pantalone: CONST_SHARED The compass promise holds\.\]\n/u,
    "summary conditions are never checked as the newcomer",
  );
  assert.match(
    afterJoin.chatSummary!,
    /CONST_PLAIN The compass promise\. \[Known only to Maukie: CONST_MAUKIE\] \[Known only to Maukie: MIXED_SECRET\]$/u,
    "a mixed condition is not checked as the newcomer either",
  );
  assert(!afterJoin.chatSummary!.includes("CONST_NARRATOR"), "a mixed group gets no narrator-only knowledge");
  assert(!/known only to[^\n\]]*Cara/iu.test(`${afterJoin.chatSummary}${afterJoin.recalledScenes}`));
  // A reply pinned to one character (an @mention or a regeneration) keeps its single-reader rendering.
  for (const id of ["maukie", "pantalone", "aaa-newcomer", "narrator"])
    assert(!marked(await groupRecall([id])), `${id}: one reader needs no marks`);
  // Messages hidden from Pantalone stay out of the shared live history, but Maukie still remembers them.
  const hiddenFromPantalone = [0, 2].map((index) => groupSource[index]!.id);
  for (const id of hiddenFromPantalone) await chats.updateMessageExtra(id, { hiddenFromAICharacterIds: ["pantalone"] });
  const partlyHidden = await groupRecall(["maukie", "pantalone", "narrator", "aaa-newcomer"]);
  assert.deepEqual(
    new Set(partlyHidden.receipt.recalledSceneIds),
    new Set([maukieOnly, both]),
    "a scene stays recalled while a present character who remembers it may read its sources",
  );
  assert.match(
    partlyHidden.recalledScenes!,
    /Scene summary \(known only to Maukie\):\nMessages #3–#4;/u,
    "a reader some of the scene was hidden from is not named as remembering it",
  );
  assert.match(partlyHidden.recalledScenes!, /known only to Maukie\):\nMessages #1–#2;[^]*\n#1 User: ONLY_MAUKIE/u);
  for (const id of hiddenFromPantalone) await chats.updateMessageExtra(id, { hiddenFromAICharacterIds: [] });
  // Messages excluded from Pantalone's excerpts still show in a scene only Maukie remembers,
  // while messages excluded from Maukie's own excerpts stay out of it.
  const maukieOnlyIds = groupSource.slice(0, 2).map((message) => message.id);
  const excerptRow = (await db.select().from(advancedMemoryRecords)).find(
    (record) => record.sceneId === maukieOnly && record.kind === "excerpt",
  )!;
  assert.equal(excerptRow.messageIds, JSON.stringify(maukieOnlyIds));
  // The shared scene's excerpt (#3–#4) is untouched by these exclusions of the Maukie-only scene (#7269).
  const bothIds = groupSource.slice(2, 4).map((message) => message.id);
  for (const [reader, expected, message] of [
    [
      "pantalone",
      [...maukieOnlyIds, ...bothIds],
      "an exclusion for a character who doesn't remember the scene leaves its excerpt alone",
    ],
    ["maukie", bothIds, "a message excluded for the scene's own reader never shows in its excerpt"],
  ] as const) {
    await db.insert(advancedMemoryRecords).values({
      ...excerptRow,
      id: `excluded-for-${reader}`,
      audienceCharacterIds: JSON.stringify([reader]),
      enabled: 0,
    });
    const excluded = await groupRecall(["maukie", "pantalone", "narrator", "aaa-newcomer"]);
    assert.deepEqual(new Set(excluded.receipt.recalledSceneIds), new Set([maukieOnly, both]));
    assert.deepEqual(new Set(excluded.receipt.recalledMessageIds), new Set(expected), message);
    await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, `excluded-for-${reader}`));
  }

  // A merged chat of the narrator and one character, where the narrator's ID sorts first, checks conditions
  // as that character, never with narrator privilege.
  await db.insert(characters).values({
    id: "aa-narrator",
    data: JSON.stringify({ name: "Narrator" }),
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const duo = await chats.create({
    name: "Merged narrator duo",
    mode: "roleplay",
    characterIds: ["maukie", "aa-narrator"],
    connectionId: connection.id,
  });
  assert(duo);
  await chats.patchMetadata(duo.id, {
    groupChatMode: "merged",
    advancedMemory: { ...groupSettings, narratorCharacterId: "aa-narrator", knowledgeStarts: { maukie: null } },
  });
  await chats.createMessagesBatch(duo.id, [
    { role: "user", content: "ONLY_MAUKIE PRIVATE_MAUKIE Maukie buries the compass promise." },
    { role: "assistant", characterId: "maukie", content: "Maukie hides the compass promise alone." },
    { role: "user", content: "SCENE_CHANGE What about the compass promise?", extra: { isConversationStart: true } },
  ]);
  await chats.patchMetadata(duo.id, {
    summaryEntries: [
      createChatSummaryEntry({
        content: 'DUO_PLAIN {{#if char == "Narrator"}}DUO_NARRATOR{{/if}}{{#if char == "Maukie"}}DUO_MAUKIE{{/if}}',
        enabled: true,
        messageIds: (await chats.listMessages(duo.id)).slice(0, 2).map((message) => message.id),
      }),
    ],
  });
  await memory.initialize(duo.id);
  const duoRecall = await groupRecall(["aa-narrator", "maukie"], duo.id);
  assert.match(duoRecall.chatSummary!, /\nDUO_PLAIN DUO_MAUKIE$/u, "the duo's summary is read as Maukie");
  // Maukie saw both messages, so the private section no longer withholds the excerpt (#7269).
  assert.match(duoRecall.recalledScenes!, /Maukie discussed the absent Pantalone\. MAUKIE_PRIVATE\n\nExcerpt:\n/u);
  assert(!/DUO_NARRATOR/u.test(duoRecall.chatSummary!), "a narrator-only section stays out");

  // Individual group chats recall per responder exactly as before #7237.
  const joinedAt = (await chats.listMessages(group.id)).at(-2)!.id;
  await chats.patchMetadata(group.id, {
    groupChatMode: "individual",
    advancedMemory: { ...groupSettings, knowledgeStarts: { maukie: null, pantalone: null, "aaa-newcomer": joinedAt } },
  });
  const range = (span: string, source = true) =>
    `Messages #${span}; ${source ? "source timeframe (summary corrections take precedence)" : "story timeframe"}: unknown (use message order).`;
  const intro =
    "Included below are recalled memories of scenes from the past chat history, together with small message excerpts from them. Present message range in the context is: #7–#9, with the last user message being #9.";
  const sharedRecap = `Scene summary:\n${range("3–#4")}\nThe compass promise was recorded. The travelers remembered the compass.`;
  // Both saw #3–#4, so each quotes it despite Maukie's private recap section (#7269). PRIVATE_MAUKIE is
  // only the fixture's cue to write that section; the message itself was visible to Pantalone.
  const sharedExcerpt = `\n\nExcerpt:\n${range("3–#4", false)}\n#3 User: SCENE_CHANGE BOTH_PRESENT PRIVATE_MAUKIE Maukie and Pantalone renew the compass promise.\n#4 Pantalone: Pantalone accepts the compass promise.`;
  const maukie = await groupRecall(["maukie"]);
  assert.equal(
    maukie.chatSummary,
    `${range("3–#4")}\nCONST_SHARED The compass promise holds.\n\n${range("1–#2")}\nCONST_PLAIN The compass promise. CONST_MAUKIE MIXED_SECRET`,
  );
  assert.equal(
    maukie.recalledScenes,
    `${intro}\n\nScene summary:\n${range("1–#2")}\nThe compass promise was recorded. Maukie discussed the absent Pantalone.\n\nExcerpt:\n${range("1–#2", false)}\n#1 User: ONLY_MAUKIE Maukie buries the compass promise.\n#2 Maukie: Maukie hides the compass promise alone.\n\n${sharedRecap} MAUKIE_PRIVATE${sharedExcerpt}`,
  );
  const pantalone = await groupRecall(["pantalone"]);
  assert.equal(
    pantalone.chatSummary,
    `${range("3–#4")}\nCONST_SHARED The compass promise holds.\n\n${range("1–#2")}\nCONST_PLAIN The compass promise.`,
  );
  assert.equal(pantalone.recalledScenes, `${intro}\n\n${sharedRecap}${sharedExcerpt}`);
  const cara = await groupRecall(["aaa-newcomer"]);
  assert.equal(cara.recalledScenes, null, "an individual newcomer recalls nothing from before joining");
  assert(!/CONST_SHARED|CONST_MAUKIE|MIXED_SECRET/u.test(cara.chatSummary ?? ""));

  // A summary whose sections all render empty for its reader adds nothing, not even its range header.
  assert.equal(cara.chatSummary, `${range("1–#2")}\nCONST_PLAIN The compass promise.`, "no bare header for Cara");
  const groupEntries = JSON.parse((await chats.getById(group.id))!.metadata).summaryEntries;
  const narratorNote = createChatSummaryEntry({
    content: '{{#if char == "Narrator"}}NARRATOR_ONLY_NOTE{{/if}}',
    enabled: true,
    messageIds: groupSource.slice(4, 6).map((message) => message.id),
  });
  const promptOf = ({ chatSummary, recalledScenes, receipt }: Awaited<ReturnType<typeof groupRecall>>) => ({
    chatSummary,
    recalledScenes,
    tokens: receipt.estimatedTokensAfter,
  });
  for (const [mode, audiences] of [
    ["individual", [["maukie"], ["pantalone"], ["aaa-newcomer"]]],
    ["merged", [["maukie", "pantalone", "narrator", "aaa-newcomer"], ["maukie", "pantalone", "narrator"], ["maukie"]]],
  ] as const) {
    await chats.patchMetadata(group.id, { groupChatMode: mode, summaryEntries: groupEntries });
    const without = [];
    for (const audience of audiences) without.push(promptOf(await groupRecall([...audience])));
    await chats.patchMetadata(group.id, { summaryEntries: [...groupEntries, narratorNote] });
    for (const [index, audience] of audiences.entries())
      assert.deepEqual(
        promptOf(await groupRecall([...audience])),
        without[index],
        `${mode} ${audience.join("+")}: an empty summary adds no header and no tokens`,
      );
  }
  await chats.patchMetadata(group.id, { groupChatMode: "individual" });
  assert.match(
    (await groupRecall(["narrator"])).chatSummary!,
    /\n\nMessages #5–#6; [^\n]+\nNARRATOR_ONLY_NOTE$/u,
    "the reader it is written for still gets it, header and all",
  );
  // A story date keeps the header only for characters who read part of that range, never for a newcomer.
  await chats.updateMessageContent(groupSource[2]!.id, `Date: June 12\n${groupSource[2]!.content}`);
  await chats.updateMessageContent(groupSource[4]!.id, `Date: June 13\n${groupSource[4]!.content}`);
  assert.equal(
    (await groupRecall(["aaa-newcomer"])).chatSummary,
    `${range("1–#2")}\nCONST_PLAIN The compass promise.`,
    "no dated header for scenes Cara never read",
  );
  assert.match((await groupRecall(["pantalone"])).chatSummary!, /\n\nMessages #5–#6; [^\n]+: June 13\.\n$/u);
  // A one-character chat drops an entry written only for someone else, and keeps its own unchanged.
  const solo = await chats.create({
    name: "Solo empty summary",
    mode: "roleplay",
    characterIds: ["maukie"],
    connectionId: connection.id,
  });
  assert(solo);
  await chats.patchMetadata(solo.id, {
    advancedMemory: { ...groupSettings, narratorCharacterId: null, knowledgeStarts: { maukie: null } },
  });
  await chats.createMessagesBatch(solo.id, [
    { role: "user", content: "ONLY_MAUKIE Maukie buries the compass promise." },
    { role: "assistant", characterId: "maukie", content: "Maukie hides the compass promise alone." },
    { role: "user", content: "SCENE_CHANGE What about the compass promise?", extra: { isConversationStart: true } },
  ]);
  const soloIds = (await chats.listMessages(solo.id)).slice(0, 2).map((message) => message.id);
  const soloOwn = createChatSummaryEntry({
    content: 'SOLO_PLAIN {{#if char == "Maukie"}}SOLO_MAUKIE{{/if}}',
    enabled: true,
    messageIds: soloIds,
  });
  await chats.patchMetadata(solo.id, { summaryEntries: [soloOwn] });
  await memory.initialize(solo.id);
  const soloWithout = promptOf(await groupRecall(["maukie"], solo.id));
  assert.equal(soloWithout.chatSummary, `${range("1–#2")}\nSOLO_PLAIN SOLO_MAUKIE`);
  await chats.patchMetadata(solo.id, {
    summaryEntries: [
      createChatSummaryEntry({
        content: '{{#if char == "Pantalone"}}SOLO_ABSENT{{/if}}',
        enabled: true,
        messageIds: soloIds,
      }),
      soloOwn,
    ],
  });
  assert.deepEqual(promptOf(await groupRecall(["maukie"], solo.id)), soloWithout, "no header for an absent reader");

  // A recap with a private section still gets excerpts, quoting only what each reader saw in the chat (#7269).
  // Whispers live in message extra data and never reach an excerpt.
  const lantern = await chats.create({
    name: "Private-section excerpts",
    mode: "roleplay",
    characterIds: ["maukie", "pantalone", "narrator"],
    connectionId: connection.id,
  });
  assert(lantern);
  await chats.patchMetadata(lantern.id, { groupChatMode: "individual", advancedMemory: groupSettings });
  const whisperToMaukie = (text: string) => ({
    roleplayCommandActivity: [
      {
        command: { type: "whisper", character: "Maukie", text },
        raw: `[whisper: character="Maukie" text="${text}"]`,
        whisperRecipient: { id: "maukie", kind: "character" },
      },
    ],
  });
  await chats.createMessagesBatch(lantern.id, [
    {
      role: "user",
      content:
        'BOTH_PRESENT PRIVATE_MAUKIE Maukie and Pantalone light the lantern. [whisper: character="Maukie" text="USER_WHISPER_SECRET"]',
      extra: whisperToMaukie("USER_WHISPER_SECRET"),
    },
    {
      role: "assistant",
      characterId: "maukie",
      content: "HIDDEN_FROM_PANTALONE Maukie pockets the lantern key.",
      extra: { hiddenFromAICharacterIds: ["pantalone"] },
    },
    {
      role: "assistant",
      characterId: "pantalone",
      content: "Pantalone carries the lantern home.",
      extra: whisperToMaukie("CHARACTER_WHISPER_SECRET"),
    },
    { role: "user", content: "SCENE_CHANGE What about the lantern?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(lantern.id);
  const [lit, pocketed, carried] = (await chats.listMessages(lantern.id)).map((message) => message.id);
  const whispers = /USER_WHISPER_SECRET|CHARACTER_WHISPER_SECRET|\[whisper/u;
  for (const [reader, expected, label] of [
    ["maukie", [lit, pocketed, carried], "Maukie quotes every message he saw"],
    ["pantalone", [lit, carried], "a message hidden from Pantalone never appears in his excerpt"],
    ["narrator", [lit, pocketed, carried], "the narrator still quotes the whole scene"],
  ] as const) {
    const recalled = await groupRecall([reader], lantern.id);
    assert.deepEqual(recalled.receipt.recalledMessageIds, expected, `individual: ${label}`);
    assert(!recalled.receipt.reasons.some((reason) => reason.startsWith("excerpt-")), `${reader}: nothing is missing`);
    assert.equal(recalled.recalledScenes!.includes("HIDDEN_FROM_PANTALONE"), reader !== "pantalone");
    if (reader !== "narrator") assert.equal(recalled.recalledScenes!.includes("MAUKIE_PRIVATE"), reader === "maukie");
    if (reader === "pantalone")
      assert.doesNotMatch(recalled.recalledScenes!, whispers, "no whisper for a non-recipient");
  }
  // A merged reply speaks for everyone who remembers the scene, so it quotes only what all of them saw.
  await chats.patchMetadata(lantern.id, { groupChatMode: "merged" });
  const mergedLantern = await groupRecall(["maukie", "pantalone", "narrator"], lantern.id);
  assert.deepEqual(
    mergedLantern.receipt.recalledMessageIds,
    [lit, carried],
    "merged: only messages every character who remembers the scene saw",
  );
  assert.match(mergedLantern.recalledScenes!, /\[Known only to Maukie: MAUKIE_PRIVATE\]\n\nExcerpt:\n/u);
  assert.doesNotMatch(mergedLantern.recalledScenes!, /HIDDEN_FROM_PANTALONE/u);
  assert.doesNotMatch(mergedLantern.recalledScenes!, whispers, "merged: no whisper for the non-recipients");
  // A one-character chat follows the same rule for its only character.
  const soloLantern = await chats.create({
    name: "Solo private-section excerpt",
    mode: "roleplay",
    characterIds: ["maukie"],
    connectionId: connection.id,
  });
  assert(soloLantern);
  await chats.patchMetadata(soloLantern.id, {
    advancedMemory: { ...groupSettings, narratorCharacterId: null, knowledgeStarts: { maukie: null } },
  });
  await chats.createMessagesBatch(soloLantern.id, [
    { role: "user", content: "PRIVATE_MAUKIE Maukie lights the solo lantern." },
    {
      role: "user",
      content: "SOLO_HIDDEN A note kept from Maukie.",
      extra: { hiddenFromAICharacterIds: ["maukie"] },
    },
    { role: "user", content: "Maukie keeps the solo lantern lit." },
    { role: "user", content: "SCENE_CHANGE What about the solo lantern?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(soloLantern.id);
  const soloLanternIds = (await chats.listMessages(soloLantern.id)).map((message) => message.id);
  const soloRecall = await groupRecall(["maukie"], soloLantern.id);
  assert.match(soloRecall.recalledScenes!, /MAUKIE_PRIVATE\n\nExcerpt:\n/u);
  assert.deepEqual(
    soloRecall.receipt.recalledMessageIds,
    [soloLanternIds[0], soloLanternIds[2]],
    "one-character chat: only the messages Maukie saw",
  );
  assert.doesNotMatch(soloRecall.recalledScenes!, /SOLO_HIDDEN/u);
  console.log(
    "Advanced Memory unlisted-participant defaults, participant access, shared scenes, merged newcomers and legacy duplicate corrections passed.",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
