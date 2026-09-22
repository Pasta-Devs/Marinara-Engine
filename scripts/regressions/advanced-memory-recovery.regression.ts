import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-recovery-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";
const summaryRequests: string[] = [];
let helperAudience: string[] | "all" = [" Maukie "];
let helperFinishReason = "stop";
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0] })) }),
    );
    return;
  }
  assert.match(body.messages[0].content, /Characters \(IDs and names\):/);
  assert.match(body.messages[0].content, /maukie/);
  assert.match(body.messages[0].content, /pantalone/);
  summaryRequests.push(body.messages[1].content);
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "The compass scene began with a promise and ended with its fulfillment.",
              audience: helperAudience,
            }),
          },
          finish_reason: helperFinishReason,
        },
      ],
    }),
  );
});
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
const { characters } = await import("../../packages/server/src/db/schema/characters.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  for (const [id, name] of [
    ["maukie", "Maukie"],
    ["pantalone", "Pantalone"],
    ["narrator", "Powers That Be"],
  ])
    await db
      .insert(characters)
      .values({ id, data: JSON.stringify({ name }), createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Recovery fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const fixture = async () => {
    const chat = await chats.create({
      name: "Recovery",
      mode: "roleplay",
      connectionId: connection.id,
      characterIds: ["maukie", "pantalone", "narrator"],
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      groupChatMode: "individual",
      advancedMemory: {
        enabled: true,
        narratorCharacterId: "narrator",
        knowledgeStarts: { maukie: null, pantalone: null },
      },
    });
    await chats.createMessagesBatch(chat.id, [
      { role: "user", content: "COMPASS_SCENE_BEGIN Maukie makes a compass promise. Pantalone is elsewhere." },
      { role: "assistant", characterId: "maukie", content: "The compass promise is fulfilled." },
      { role: "user", content: "COMPASS_NEXT_SCENE Recall the compass promise.", extra: { isConversationStart: true } },
    ]);
    const messages = await chats.listMessages(chat.id);
    const sceneId = `scene-${messages[0]!.id}`;
    const timestamp = "2026-01-01T00:00:00.000Z";
    const row = {
      id: sceneId,
      sceneId,
      chatId: chat.id,
      kind: "scene",
      status: "closed",
      startMessageId: messages[0]!.id,
      endMessageId: messages[1]!.id,
      messageIds: JSON.stringify(messages.slice(0, 2).map((message) => message.id)),
      audienceCharacterIds: "[]",
      content: "",
      title: "Scene",
      timeline: null,
      enabled: 1,
      manualOverride: 0,
      sourceFingerprint: "legacy",
      dependencies: "[]",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(advancedMemoryRecords).values(row);
    return { chat, messages, row, sceneId };
  };
  await test("targeted preparation completes a suffix-only recap instead of returning false ready", async () => {
    const { chat, messages, row, sceneId } = await fixture();
    await db.insert(advancedMemoryRecords).values({
      ...row,
      id: `${sceneId}-deleted-copy`,
      audienceCharacterIds: '["maukie"]',
      enabled: 0,
      manualOverride: 1,
    });
    await db.insert(advancedMemoryRecords).values({
      ...row,
      id: `${sceneId}-partial`,
      messageIds: JSON.stringify([messages[1]!.id]),
      content: "Only the end of the compass scene.",
      audienceCharacterIds: '["maukie"]',
      dependencies: '[{"id":"scene-audience","revision":"participants-v1"}]',
    });
    assert.deepEqual(
      (await memory.status(chat.id)).unpreparedScenes?.map((scene) => [scene.startIndex, scene.endIndex]),
      [[1, 2]],
    );
    const before = summaryRequests.length;
    await memory.initialize(chat.id, { sceneId });
    const status = await memory.status(chat.id);
    assert.deepEqual(status.unpreparedScenes, [], "successful preparation clears the original missing-scene warning");
    const saved = status.records.filter((record) => record.kind === "scene" && record.content);
    assert.equal(saved.length, 1);
    assert.deepEqual(
      saved[0]!.messageIds,
      messages.slice(0, 2).map((message) => message.id),
    );
    assert.deepEqual(saved[0]!.audienceCharacterIds, ["maukie"], "full-scene processing saves its actual participants");
    assert.equal(summaryRequests.length, before + 1, "only the incomplete scene is summarized");
    assert.match(summaryRequests.at(-1)!, /COMPASS_SCENE_BEGIN/);
    assert.doesNotMatch(summaryRequests.at(-1)!, /COMPASS_NEXT_SCENE/);
    await memory.initialize(chat.id, { sceneId });
    await memory.reindex(chat.id);
    assert.equal(summaryRequests.length, before + 1, "repair retries and reindex do not repeat model work");
  });
  await test("legacy corrections stay authoritative through inspection, export, preparation and reindex", async () => {
    const { chat, messages, row, sceneId } = await fixture();
    const corrected = {
      ...row,
      id: `${sceneId}-corrected`,
      content: "A manually corrected compass promise.",
      audienceCharacterIds: '["maukie"]',
      manualOverride: 1,
    };
    await db.insert(advancedMemoryRecords).values(corrected);
    await db.insert(advancedMemoryRecords).values({
      ...row,
      id: `${sceneId}-automatic`,
      content: "An older automatic copy.",
      audienceCharacterIds: '["pantalone"]',
      dependencies: '[{"id":"scene-audience","revision":"participants-v1"}]',
    });
    // Deleting an obsolete copy must not revoke the remaining explicit correction.
    await db
      .insert(advancedMemoryRecords)
      .values({ ...row, id: `${sceneId}-deleted`, audienceCharacterIds: '["maukie"]', enabled: 0, manualOverride: 1 });
    const before = summaryRequests.length;
    for (const action of [
      () => memory.status(chat.id),
      () => memory.reindex(chat.id),
      () => memory.initialize(chat.id, { detectScenes: false }),
    ]) {
      await action();
      const saved = (await memory.status(chat.id)).records.filter(
        (record) => record.kind === "scene" && record.content,
      );
      assert.equal(saved.length, 1);
      assert.equal(saved[0]!.content, corrected.content, "manual text wins over generated copies");
      assert.deepEqual(
        saved[0]!.audienceCharacterIds,
        ["maukie"],
        "manual access wins over generated and deleted copies",
      );
    }
    assert.equal(
      summaryRequests.length,
      before,
      "saved corrections need neither generation nor participant reclassification",
    );
    const recall = (audienceCharacterIds: string[]) =>
      memory.prepare({ chatId: chat.id, messages, audienceCharacterIds, budgetTokens: 12000, readOnly: true });
    assert((await recall(["maukie"])).receipt.recalledSceneIds.includes(sceneId));
    assert(!(await recall(["pantalone"])).receipt.recalledSceneIds.includes(sceneId));
    const exported = (await memory.exportTransferRecords(chat.id)).find((item) => item.record.id === corrected.id)!;
    assert.deepEqual(exported.record.audienceCharacterIds, ["maukie"]);
    await memory.updateRecord(chat.id, corrected.id, { audienceCharacterIds: ["pantalone"] });
    await memory.reindex(chat.id);
    assert.deepEqual(
      (await memory.status(chat.id)).records.find((record) => record.id === corrected.id)!.audienceCharacterIds,
      ["pantalone"],
    );
    assert.equal(summaryRequests.length, before);
  });
  await test("backups preserve raw legacy access without granting unreviewed automatic access", async () => {
    const { chat, row } = await fixture();
    const id = `${row.sceneId}-unreviewed`;
    await db
      .insert(advancedMemoryRecords)
      .values({ ...row, id, content: "An unreviewed compass recap.", audienceCharacterIds: '["maukie"]' });
    assert.deepEqual(
      (await memory.status(chat.id)).records.find((record) => record.id === id)!.audienceCharacterIds,
      [],
    );
    const exported = (await memory.exportTransferRecords(chat.id)).find((item) => item.record.id === id)!;
    assert.deepEqual(
      exported.record.audienceCharacterIds,
      ["maukie"],
      "export must not erase stored assignments with a display projection",
    );
  });
  await test("a failed range repair preserves paid text and manual access, then resumes only that scene", async () => {
    const { chat, messages, row, sceneId } = await fixture();
    const id = `${sceneId}-partial-correction`;
    const content = "CORRECTED_COMPASS: a saved correction to the end of the scene.";
    await db.insert(advancedMemoryRecords).values({
      ...row,
      id,
      manualOverride: 1,
      messageIds: JSON.stringify([messages[1]!.id]),
      content,
      audienceCharacterIds: '["pantalone"]',
    });
    helperFinishReason = "length";
    await assert.rejects(memory.initialize(chat.id, { sceneId }), /output limit/);
    const failed = await memory.status(chat.id);
    assert.equal(failed.job.status, "error");
    assert.equal(failed.records.find((record) => record.id === id)!.content, content);
    assert.deepEqual(failed.records.find((record) => record.id === id)!.audienceCharacterIds, ["pantalone"]);
    assert.equal(failed.unpreparedScenes!.length, 1);
    helperFinishReason = "stop";
    await memory.initialize(chat.id, { sceneId });
    const repaired = await memory.status(chat.id);
    assert.deepEqual(repaired.unpreparedScenes, []);
    assert.deepEqual(
      repaired.records.find((record) => record.id === id)!.audienceCharacterIds,
      ["pantalone"],
      "manual access overrides a differing helper decision",
    );
    assert.match(summaryRequests.at(-1)!, /CORRECTED_COMPASS/);
  });
  await test("backup round trips keep confirmed shared access without overwriting local corrections", async () => {
    const { chat, row, sceneId } = await fixture();
    for (const participant of ["maukie", "pantalone"])
      await db
        .insert(advancedMemoryRecords)
        .values({
          ...row,
          id: `${sceneId}-${participant}`,
          content: "A confirmed shared compass scene.",
          audienceCharacterIds: JSON.stringify([participant]),
          dependencies: '[{"id":"scene-audience","revision":"participants-v1"}]',
        });
    const backup = await memory.exportMemory(chat.id);
    const target = await fixture();
    const imported = await memory.importMemory(target.chat.id, backup);
    const saved = imported.records.filter((record) => record.kind === "scene" && record.content);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0]!.audienceCharacterIds, ["maukie", "pantalone"]);
    await memory.updateRecord(target.chat.id, saved[0]!.id, { audienceCharacterIds: ["maukie"] });
    await memory.importMemory(target.chat.id, backup);
    assert.deepEqual(
      (await memory.status(target.chat.id)).records.find((record) => record.id === saved[0]!.id)!.audienceCharacterIds,
      ["maukie"],
    );
    await db
      .update(advancedMemoryRecords)
      .set({ enabled: 0 })
      .where(eq(advancedMemoryRecords.id, `${sceneId}-pantalone`));
    const disabledTarget = await fixture();
    const disabled = await memory.importMemory(disabledTarget.chat.id, await memory.exportMemory(chat.id));
    assert.equal(disabled.records.find((record) => record.kind === "scene" && record.content)!.enabled, false);
  });
  await test("named participants resolve to separate chat characters and unknown names never grant access", async () => {
    for (const [result, expected] of [
      [["Pantalone"], ["pantalone"]],
      [
        ["Maukie", "Pantalone"],
        ["maukie", "pantalone"],
      ],
      [["maukie"], ["maukie"]],
      [["Absent stranger", "Powers That Be"], []],
      [[], []],
      ["all", ["maukie", "pantalone"]],
    ] as Array<[string[] | "all", string[]]>) {
      const { chat, sceneId } = await fixture();
      helperAudience = result;
      await memory.initialize(chat.id, { sceneId });
      const saved = (await memory.status(chat.id)).records.find((record) => record.kind === "scene" && record.content)!;
      assert.deepEqual(saved.audienceCharacterIds, expected);
      const requestsBeforeReindex = summaryRequests.length;
      await memory.reindex(chat.id);
      assert.deepEqual(
        (await memory.status(chat.id)).records.find((record) => record.id === saved.id)!.audienceCharacterIds,
        expected,
      );
      assert.equal(summaryRequests.length, requestsBeforeReindex);
    }
  });
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
