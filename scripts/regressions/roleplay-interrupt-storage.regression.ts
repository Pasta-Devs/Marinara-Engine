import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-interrupt-storage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

const { buildApp } = await import("../../packages/server/src/app.js");
const { getDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage, RoleplayInterruptionConflictError, withMessageExtraPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { importSTChat } = await import("../../packages/server/src/services/import/st-chat.importer.js");
const { memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const app = await buildApp();
await app.ready();
const db = await getDB();
const storage = createChatsStorage(db);
const original = '"I was going to cross the bridge, then tell you everything."';
const part = "I was going to";
const interrupted = '"I was going to—"';
const extra = (row: { extra: unknown } | null) => JSON.parse(String(row?.extra ?? "{}"));
const activity = (quote = part) => [
  { command: { type: "interrupt", part: quote }, raw: `[interrupt: part="${quote}"]` },
];

const fixture = async (role: "user" | "assistant" = "user", content = original) => {
  const chat = await storage.create({ name: "Interrupt proof", mode: "roleplay", characterIds: [] });
  assert.ok(chat);
  const target = await storage.createMessage({ chatId: chat.id, role, content });
  const owner = await storage.createMessage({ chatId: chat.id, role: "assistant", content: "Wait." });
  assert.ok(target && owner);
  return { chat, target, owner };
};
const commit = async (ownerId: string, targetId: string, quote = part) => {
  const owner = await storage.getMessage(ownerId);
  const target = await storage.getMessage(targetId);
  assert.ok(owner && target);
  return storage.commitRoleplayInterruption({
    messageId: owner.id,
    swipeIndex: owner.activeSwipeIndex,
    extraUpdate: { roleplayCommandActivity: activity(quote) },
    target,
  });
};

try {
  const basic = await fixture();
  await db.insert(memoryChunks).values({
    id: "old-recall",
    chatId: basic.chat.id,
    content: original,
    messageCount: 1,
    firstMessageAt: basic.target.createdAt,
    lastMessageAt: basic.target.createdAt,
    createdAt: basic.target.createdAt,
  });
  const saved = await commit(basic.owner.id, basic.target.id);
  assert.equal(saved.interruptedMessage?.content, interrupted);
  assert.equal(extra(saved.message).roleplayCommandActivity[0].interruption.originalContent, original);
  assert.equal((await storage.getSwipes(basic.target.id))[0]?.content, interrupted);
  assert.equal(
    (await db.select().from(memoryChunks).where(eq(memoryChunks.chatId, basic.chat.id))).length,
    0,
    "Cut invalidates existing raw recall chunks",
  );
  assert.equal(
    extra((await storage.getSwipes(basic.owner.id))[0]!).roleplayCommandActivity[0].interruption.originalContent,
    original,
    "Receipt lives on the response swipe too",
  );

  const restored = await storage.restoreRoleplayInterruption(basic.owner.id);
  assert.equal(
    restored.restoredMessages[0]?.content,
    original,
    "Reroll sees complete original history before provider input is built",
  );
  assert.equal(
    extra(restored.message).roleplayCommandActivity[0].interruption.restored,
    undefined,
    "Temporary reroll restoration does not disable an old swipe",
  );
  const failedReroll = await storage.reconcileRoleplayInterruption(basic.owner.id);
  assert.equal(
    failedReroll.interruptedMessage?.content,
    interrupted,
    "Failed reroll reapplies the still-selected interruption",
  );
  await storage.restoreRoleplayInterruption(basic.owner.id);
  const plainSwipe = await storage.addSwipe(basic.owner.id, "Go on.");
  assert.equal(
    (await storage.getMessage(basic.target.id))?.content,
    original,
    "New swipe without command does not inherit interruption",
  );
  await storage.setActiveSwipe(basic.owner.id, 0);
  assert.equal((await storage.getMessage(basic.target.id))?.content, interrupted);
  await storage.setActiveSwipe(basic.owner.id, plainSwipe.index);
  assert.equal((await storage.getMessage(basic.target.id))?.content, original);
  await storage.setActiveSwipe(basic.owner.id, 0);
  const restoreRoute = `/api/chats/${basic.chat.id}/messages/${basic.owner.id}/interrupt/restore`;
  (app as any).activeGenerations.set(basic.chat.id, {});
  assert.equal(
    (await app.inject({ method: "POST", url: restoreRoute, payload: { swipeIndex: 0, activityIndex: 0 } })).statusCode,
    409,
  );
  (app as any).activeGenerations.delete(basic.chat.id);
  assert.equal(
    (await app.inject({ method: "POST", url: restoreRoute, payload: { swipeIndex: 1, activityIndex: 0 } })).statusCode,
    409,
  );
  const response = await app.inject({
    method: "POST",
    url: restoreRoute,
    payload: { swipeIndex: 0, activityIndex: 0 },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal((await storage.getMessage(basic.target.id))?.content, original);
  await storage.setActiveSwipe(basic.owner.id, plainSwipe.index);
  await storage.setActiveSwipe(basic.owner.id, 0);
  assert.equal(
    (await storage.getMessage(basic.target.id))?.content,
    original,
    "Explicit Restore permanently opts that command out",
  );

  const assistant = await fixture("assistant");
  await storage.addSwipe(assistant.target.id, "An unrelated original alternative.");
  await storage.addSwipe(assistant.target.id, original);
  await commit(assistant.owner.id, assistant.target.id);
  assert.equal((await storage.getMessage(assistant.target.id))?.activeSwipeIndex, 2);
  await storage.removeSwipe(assistant.target.id, 0);
  assert.equal((await storage.getMessage(assistant.target.id))?.activeSwipeIndex, 1);
  await storage.restoreRoleplayInterruption(assistant.owner.id);
  assert.equal(
    (await storage.getMessage(assistant.target.id))?.content,
    original,
    "Stable target swipe ID survives lower-index deletion",
  );
  await storage.reconcileRoleplayInterruption(assistant.owner.id);
  await storage.setActiveSwipe(assistant.target.id, 0);
  const inactiveRestore = await storage.restoreRoleplayInterruption(assistant.owner.id, {
    permanent: true,
    activityIndex: 0,
  });
  assert.equal(
    extra(inactiveRestore.message).roleplayCommandActivity[0].interruption.targetSwipeIndex,
    1,
    "Restore reports the target swipe's current index after renumbering",
  );
  assert.equal(
    extra((await storage.getSwipes(assistant.owner.id))[0]!).roleplayCommandActivity[0].interruption.targetSwipeIndex,
    1,
    "The corrected target index is persisted on the owner's swipe receipt",
  );
  assert.equal((await storage.getMessage(assistant.target.id))?.activeSwipeIndex, 0);
  assert.equal(
    (await storage.getMessage(assistant.target.id))?.content,
    "An unrelated original alternative.",
    "Restoring an inactive target never changes the user's active swipe",
  );
  assert.equal((await storage.getSwipes(assistant.target.id))[1]?.content, original);

  const edited = await fixture();
  await commit(edited.owner.id, edited.target.id);
  await storage.updateMessageContent(edited.target.id, "A manual correction after the cut.");
  await assert.rejects(storage.restoreRoleplayInterruption(edited.owner.id), RoleplayInterruptionConflictError);
  await storage.addSwipe(edited.owner.id, "Another response.");
  await storage.setActiveSwipe(edited.owner.id, 0);
  await storage.removeMessage(edited.owner.id);
  assert.equal(
    (await storage.getMessage(edited.target.id))?.content,
    "A manual correction after the cut.",
    "Switching or deleting an owner never overwrites target edits",
  );

  const deleted = await fixture();
  await commit(deleted.owner.id, deleted.target.id);
  await storage.addSwipe(deleted.owner.id, "Another response.");
  await storage.setActiveSwipe(deleted.owner.id, 0);
  await storage.removeSwipe(deleted.owner.id, 0);
  assert.equal(
    (await storage.getMessage(deleted.target.id))?.content,
    original,
    "Deleting selected interrupting swipe restores predecessor",
  );
  await commit(deleted.owner.id, deleted.target.id);
  await storage.removeMessages([deleted.owner.id], deleted.chat.id);
  assert.equal(
    (await storage.getMessage(deleted.target.id))?.content,
    original,
    "Bulk deleting an interrupting response restores its surviving predecessor",
  );

  const raced = await fixture();
  await storage.updateMessageContent(raced.target.id, "A correction while generation was running.");
  const stale = await storage.commitRoleplayInterruption({
    messageId: raced.owner.id,
    swipeIndex: 0,
    extraUpdate: { roleplayCommandActivity: activity() },
    target: raced.target,
  });
  assert.match(extra(stale.message).roleplayCommandActivity[0].error, /changed/);
  assert.equal(stale.interruptedMessage, null);
  const earlier = await fixture();
  const latest = await storage.createMessage({
    chatId: earlier.chat.id,
    role: "user",
    content: "An actual intervening turn.",
  });
  const laterOwner = await storage.createMessage({ chatId: earlier.chat.id, role: "assistant", content: "Wait." });
  assert.ok(latest && laterOwner);
  assert.equal(
    (await commit(laterOwner.id, earlier.target.id)).interruptedMessage,
    null,
    "A command cannot reach back past the actual preceding turn",
  );

  const queued = await fixture();
  let release!: () => void;
  const hold = withMessageExtraPatchQueue(
    queued.target.id,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  const queuedCommit = commit(queued.owner.id, queued.target.id);
  const manualEdit = storage.updateMessageContent(queued.target.id, "A queued manual correction.");
  release();
  await Promise.all([hold, queuedCommit, manualEdit]);
  assert.equal(
    (await storage.getMessage(queued.target.id))?.content,
    "A queued manual correction.",
    "Existing per-message queues serialize edits against paired interruption writes",
  );

  const cancelled = await fixture();
  const controller = new AbortController();
  let releaseCancelled!: () => void;
  const heldCancelled = withMessageExtraPatchQueue(
    cancelled.target.id,
    () =>
      new Promise<void>((resolve) => {
        releaseCancelled = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  const cancelledCommit = storage.commitRoleplayInterruption({
    messageId: cancelled.owner.id,
    swipeIndex: 0,
    extraUpdate: { roleplayCommandActivity: activity() },
    target: cancelled.target,
    signal: controller.signal,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort();
  releaseCancelled();
  const [, cancelledResult] = await Promise.all([heldCancelled, cancelledCommit]);
  assert.equal(cancelledResult.interruptedMessage, null);
  assert.equal(
    extra(cancelledResult.message).roleplayCommandActivity[0].error,
    "Interruption was not applied because generation was cancelled.",
  );
  assert.equal(extra(cancelledResult.message).roleplayCommandActivity[0].interruption, undefined);
  assert.equal(
    (await storage.getMessage(cancelled.target.id))?.content,
    original,
    "Aborting a queued commit preserves the full target message",
  );
  assert.equal((await storage.getSwipes(cancelled.target.id))[0]?.content, original);

  const ordinaryDeleteReads = async (count: number) => {
    const chat = await storage.create({ name: "Ordinary delete", mode: "roleplay", characterIds: [] });
    assert.ok(chat);
    const ids = await storage.createMessagesBatch(
      chat.id,
      Array.from({ length: count }, () => ({ role: "user" as const, content: "Ordinary message without commands." })),
    );
    const select = db.select.bind(db);
    let reads = 0;
    db.select = ((...args: Parameters<typeof db.select>) => {
      reads++;
      return select(...args);
    }) as typeof db.select;
    try {
      await storage.removeMessages(ids, chat.id);
    } finally {
      db.select = select;
    }
    return reads;
  };
  const singleDeleteReads = await ordinaryDeleteReads(1);
  assert.equal(
    await ordinaryDeleteReads(80),
    singleDeleteReads,
    "Ordinary bulk deletion keeps a fixed query count instead of reading each message and swipe separately",
  );

  const rollback = await fixture();
  const update = db.update.bind(db);
  db.update = ((table: Parameters<typeof db.update>[0]) => {
    const builder = update(table);
    const set = builder.set.bind(builder);
    builder.set = ((values: Record<string, unknown>) => {
      if (values.extra) throw new Error("injected receipt persistence failure");
      return set(values);
    }) as typeof builder.set;
    return builder;
  }) as typeof db.update;
  try {
    await assert.rejects(commit(rollback.owner.id, rollback.target.id), /injected receipt/);
  } finally {
    db.update = update;
  }
  assert.equal(
    (await storage.getMessage(rollback.target.id))?.content,
    original,
    "Failed receipt write rolls back the target mutation",
  );

  const transfer = await fixture("assistant", "I promised {{user}} a silver compass by the river before dawn.");
  await storage.addSwipe(transfer.target.id, "An unused swipe.");
  await storage.addSwipe(transfer.target.id, transfer.target.content);
  await commit(transfer.owner.id, transfer.target.id, "a silver compass");
  await storage.removeSwipe(transfer.target.id, 0);
  const beforeBranch = (await storage.getMessage(transfer.target.id))!.content;
  const branch = await app.inject({ method: "POST", url: `/api/chats/${transfer.chat.id}/branch`, payload: {} });
  assert.equal(branch.statusCode, 200, branch.body);
  const branchMessages = await storage.listMessages(branch.json().id);
  const branchReceipt = extra(branchMessages[1]!).roleplayCommandActivity[0].interruption;
  assert.equal(branchReceipt.targetMessageId, branchMessages[0]!.id);
  assert.equal(branchReceipt.targetSwipeIndex, 1);
  assert.notEqual(
    branchReceipt.targetSwipeId,
    extra(await storage.getMessage(transfer.owner.id)).roleplayCommandActivity[0].interruption.targetSwipeId,
  );
  await storage.restoreRoleplayInterruption(branchMessages[1]!.id, { permanent: true, activityIndex: 0 });
  assert.equal((await storage.getMessage(branchMessages[0]!.id))?.content, transfer.target.content);
  assert.equal(
    (await storage.getMessage(transfer.target.id))?.content,
    beforeBranch,
    "Restoring branch touches only copied target",
  );
  const prefix = await app.inject({
    method: "POST",
    url: `/api/chats/${transfer.chat.id}/branch`,
    payload: { upToMessageId: transfer.target.id },
  });
  assert.equal(prefix.statusCode, 200, prefix.body);
  assert.equal(
    (await storage.listMessages(prefix.json().id))[0]?.content,
    transfer.target.content,
    "Branch before interrupting response recovers full original in the copy",
  );
  const exported = await app.inject({ method: "GET", url: `/api/chats/${transfer.chat.id}/export?format=jsonl` });
  assert.equal(exported.statusCode, 200, exported.body);
  const imported = await importSTChat(exported.body, db);
  assert.ok(imported.chatId, JSON.stringify(imported));
  const importedMessages = await storage.listMessages(imported.chatId);
  const importedReceipt = extra(importedMessages[1]!).roleplayCommandActivity[0].interruption;
  assert.equal(importedReceipt.targetMessageId, importedMessages[0]!.id);
  assert.equal(importedReceipt.targetSwipeIndex, 1);
  await storage.restoreRoleplayInterruption(importedMessages[1]!.id, { permanent: true, activityIndex: 0 });
  assert.equal((await storage.getMessage(importedMessages[0]!.id))?.content, importedReceipt.originalContent);
  assert.ok(
    !importedReceipt.originalContent.includes("{{user}}"),
    "JSONL receipt uses the same macro-resolved target content as the transcript",
  );
} finally {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("Roleplay interruption storage, restore, swipe, edit-race and transfer regressions passed.\n");
