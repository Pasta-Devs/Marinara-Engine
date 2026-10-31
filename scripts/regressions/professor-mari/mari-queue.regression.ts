// Pins Professor Mari's message queue (server side): the per-chat store, how a run ends, and the drain that sends
// the next message on the same reply. Temp data folders only; a fake service stands in for her where it can.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MariPendingMessage } from "../../../packages/shared/src/types/professor-mari-workspace.js";
import type { ChatCompletionResult } from "../../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-queue-storage-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

try {
  const store = await import("../../../packages/server/src/services/professor-mari/workspace-pending-store.js");
  const pendingDir = join(storageDir, "mari-pending");
  const chatId = "chat_A-1";
  const text = (message: MariPendingMessage | null) => message?.text ?? null;

  // ── The store: add, list, remove, take order, cap ──────────────────────────────────────────────
  assert.deepEqual(await store.listPending(chatId), [], "A missing file is an empty list");
  const first = await store.addPending(chatId, {
    text: "one",
    attachments: [{ type: "image/png", data: "data:image/png;base64,AAAA", name: "a.png" }],
    references: [{ kind: "character", id: "c1", label: "Ann" }],
  });
  const second = await store.addPending(chatId, { text: "two" });
  const third = await store.addPending(chatId, { text: "three" });
  assert.deepEqual(
    (await store.listPending(chatId)).map((m) => m.text),
    ["one", "two", "three"],
  );
  assert.equal(first.attachments[0]?.data, "data:image/png;base64,AAAA");
  assert.ok(existsSync(join(pendingDir, `${chatId}.json`)), "One file per chat");
  assert.deepEqual(
    readdirSync(pendingDir).filter((name) => name.endsWith(".tmp")),
    [],
    "The temp file is renamed away",
  );

  // Writes are serialized: a burst of adds loses none.
  await Promise.all(["b1", "b2", "b3", "b4"].map((label) => store.addPending("burst", { text: label })));
  assert.equal((await store.listPending("burst")).length, 4);
  await store.deletePendingForChat("burst");
  assert.ok(!existsSync(join(pendingDir, "burst.json")), "deletePendingForChat removes the file");

  // Persistence: a fresh read sees the data. This is also "survive a restart": nothing here runs a loop, so
  // nothing sends; the messages are held by definition.
  assert.deepEqual(
    (await store.listPending(chatId)).map((m) => m.id),
    [first.id, second.id, third.id],
  );

  assert.equal(text(await store.takeNextPending(chatId)), "one", "Take order is oldest first");
  assert.equal(text(await store.takePending(chatId, third.id)), "three", "takePending takes by id");
  assert.equal(await store.takePending(chatId, "missing"), null);
  assert.equal(await store.removePending(chatId, "missing"), null);
  assert.equal(text(await store.removePending(chatId, second.id)), "two");
  assert.ok(!existsSync(join(pendingDir, `${chatId}.json`)), "Removing the last item deletes the file");
  assert.equal(await store.takeNextPending(chatId), null);

  for (let index = 0; index < store.MAX_PENDING_MESSAGES_PER_CHAT; index += 1) {
    await store.addPending("capped", { text: `m${index}` });
  }
  await assert.rejects(store.addPending("capped", { text: "one too many" }), (error: unknown) => {
    assert.ok(error instanceof store.MariPendingStoreError);
    assert.equal(error.code, "limit");
    assert.match(error.message, /up to 20 messages/u);
    return true;
  });
  assert.equal((await store.listPending("capped")).length, 20);

  // A bad chat id is refused, never cleaned: no function builds a path from it.
  for (const bad of ["", "..", "../x", "a/b", "a\\b", "a.b", "a b", "x".repeat(129), "a\0b"]) {
    for (const call of [
      () => store.listPending(bad),
      () => store.addPending(bad, { text: "x" }),
      () => store.takeNextPending(bad),
      () => store.clearPending(bad),
      () => store.deletePendingForChat(bad),
    ]) {
      await assert.rejects(call(), (error: unknown) => error instanceof store.MariPendingStoreError);
    }
  }
  assert.deepEqual(readdirSync(storageDir).sort(), ["mari-pending"], "A refused id writes nothing");

  // An unreadable file counts as empty (and logs), and the next add starts a clean list.
  writeFileSync(join(pendingDir, "broken.json"), "{not json");
  assert.deepEqual(await store.listPending("broken"), []);
  await store.addPending("broken", { text: "fresh" });
  assert.deepEqual(
    (await store.listPending("broken")).map((m) => m.text),
    ["fresh"],
  );

  // Summaries: names and types only, so the polled /status never carries attachment data.
  await store.addPending("withfile", {
    text: "see file",
    attachments: [{ type: "application/pdf", data: "data:application/pdf;base64,SECRET", name: "doc.pdf" }],
  });
  const summaries = await store.listPendingSummaries("withfile");
  assert.deepEqual(summaries[0]?.attachments, [{ name: "doc.pdf", type: "application/pdf" }]);
  assert.ok(!JSON.stringify(summaries).includes("SECRET"), "No attachment data in a summary");
  assert.deepEqual(await store.listPendingSummaries("nothing-here"), []);

  // Decision 13: Stop returns everything, attachments included, and empties the queue.
  const returned = await store.clearPending("withfile");
  assert.equal(returned.length, 1);
  assert.equal(returned[0]?.attachments[0]?.data, "data:application/pdf;base64,SECRET");
  assert.deepEqual(await store.listPending("withfile"), []);
  assert.deepEqual(await store.listPendingSummaries("withfile"), []);

  // ── The drain ──────────────────────────────────────────────────────────────────────────────────────
  const fakeQueue = (...texts: string[]) => {
    const queue: MariPendingMessage[] = texts.map((label, index) => ({
      id: `p${index}`,
      text: label,
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [],
      references: [],
    }));
    return queue;
  };
  const drain = async (
    queue: MariPendingMessage[],
    outcome: "finished" | "stopped",
    options: { busy?: () => boolean; outcomes?: Array<"finished" | "stopped" | Error> } = {},
  ) => {
    const ran: string[] = [];
    const announced: string[] = [];
    const outcomes = [...(options.outcomes ?? [])];
    await store.drainPendingMessages({
      chatId: "fake",
      outcome,
      isBusy: options.busy ?? (() => false),
      takeNext: async () => queue.shift() ?? null,
      onNext: (message) => announced.push(message.text),
      runPrompt: async (message) => {
        ran.push(message.text);
        const next = outcomes.shift() ?? "finished";
        if (next instanceof Error) throw next;
        return next;
      },
      putBack: async (message) => {
        queue.unshift(message);
      },
    });
    return { ran, announced, left: queue.map((message) => message.text) };
  };

  // Sends in order, announcing each before it runs, and stops when the queue is empty.
  let result = await drain(fakeQueue("a", "b", "c"), "finished");
  assert.deepEqual(result.ran, ["a", "b", "c"]);
  assert.deepEqual(result.announced, ["a", "b", "c"]);
  assert.deepEqual(result.left, []);

  // Decision 14: a held change, a question card, a failure and an abort all arrive as "stopped"; nothing is sent.
  result = await drain(fakeQueue("a", "b"), "stopped");
  assert.deepEqual(result.ran, [], "A first run that did not finish sends nothing");
  assert.deepEqual(result.left, ["a", "b"], "The messages stay held");

  // The same stop after a drained run: the later ones stay held.
  result = await drain(fakeQueue("a", "b", "c"), "finished", { outcomes: ["finished", "stopped"] });
  assert.deepEqual(result.ran, ["a", "b"]);
  assert.deepEqual(result.left, ["c"]);

  // A failed drained run propagates (the route's catch reports it) and later ones stay held.
  const queue = fakeQueue("a", "b", "c");
  await assert.rejects(drain(queue, "finished", { outcomes: ["finished", new Error("provider down")] }), {
    message: "provider down",
  });
  assert.deepEqual(
    queue.map((message) => message.text),
    ["c"],
  );

  // Decision 18: a run that holds the slot (this chat or another) is never aborted by the drain.
  result = await drain(fakeQueue("a", "b"), "finished", { busy: () => true });
  assert.deepEqual(result.ran, []);
  assert.deepEqual(result.left, ["a", "b"]);
  result = await drain(fakeQueue("a", "b"), "finished", { busy: () => false });
  assert.deepEqual(result.ran, ["a", "b"]);
  // The slot is taken while the next message is being read: it goes back to the front, not lost.
  let reads = 0;
  result = await drain(fakeQueue("a", "b"), "finished", {
    busy: () => {
      reads += 1;
      return reads === 2;
    },
  });
  assert.deepEqual(result.ran, []);
  assert.deepEqual(result.left, ["a", "b"], "A message taken in the race is put back in order");

  // A new send holds what is already waiting: only messages queued after it drain, and Send takes one by id.
  const holdChat = "holdchat";
  await store.addPending(holdChat, { text: "old one" });
  await store.addPending(holdChat, { text: "old two" });
  await store.holdPending(holdChat);
  await store.addPending(holdChat, { text: "typed during the run" });
  assert.equal(text(await store.takeNextPending(holdChat)), "typed during the run", "The drain skips held messages");
  assert.equal(await store.takeNextPending(holdChat), null, "Held messages never drain");
  const heldList = await store.listPendingSummaries(holdChat);
  assert.deepEqual(
    heldList.map((message) => message.held),
    [true, true],
    "The client can tell a held row during a later run",
  );
  assert.equal(text(await store.takePending(holdChat, heldList[1]!.id)), "old two", "Send takes only that one");
  assert.equal((await store.listPending(holdChat)).length, 1, "Send leaves the others held");

  // Only a message queued while the send starts up still drains. Everything else is held, even a row the client never saw.
  const startupChat = "startupchat";
  await store.addPending(startupChat, { text: "seen" });
  const duringStartup = await store.addPending(startupChat, { text: "queued during startup" });
  await store.addPending(startupChat, { text: "from another device" });
  await store.holdPending(startupChat, [duringStartup.id]);
  assert.equal(text(await store.takeNextPending(startupChat)), "queued during startup");
  assert.equal(await store.takeNextPending(startupChat), null, "Everything else stays held, seen or not");

  // A message put back returns to its typed place, not ahead of older held ones.
  const orderChat = "orderchat";
  // Order comes from createdAt, in milliseconds, so these need to land in different ones.
  const nextMillisecond = () => new Promise((resolve) => setTimeout(resolve, 2));
  await store.addPending(orderChat, { text: "older" });
  await nextMillisecond();
  const putBack = await store.addPending(orderChat, { text: "put back" });
  await nextMillisecond();
  await store.addPending(orderChat, { text: "newer" });
  assert.equal(text(await store.takePending(orderChat, putBack.id)), "put back");
  await store.restorePending(orderChat, { ...putBack, createdAt: putBack.createdAt });
  assert.deepEqual(
    (await store.listPending(orderChat)).map((message) => message.text),
    ["older", "put back", "newer"],
  );

  // A file that cannot be read is not an empty queue: writing "empty" over it would lose the messages.
  const unreadableChat = "unreadable";
  await store.addPending(unreadableChat, { text: "still here" });
  const unreadablePath = join(pendingDir, `${unreadableChat}.json`);
  const unreadableBytes = readFileSync(unreadablePath);
  rmSync(unreadablePath);
  mkdirSync(unreadablePath);
  await assert.rejects(store.takeNextPending(unreadableChat));
  rmSync(unreadablePath, { recursive: true });
  writeFileSync(unreadablePath, unreadableBytes);
  assert.equal(text(await store.takeNextPending(unreadableChat)), "still here");

  // ── How a real run ends ────────────────────────────────────────────────────────────────────────────
  const db = await getDB();
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  await createAppSettingsStorage(db).set("mari-runtime", "classic");
  const { ProfessorMariWorkspaceService } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Mari queue", mode: "conversation", characterIds: [] });
  const service = new ProfessorMariWorkspaceService({ db } as never);
  let complete: () => Promise<ChatCompletionResult> = async () => reply({ say: "Done.", commands: [], stop: true });
  function reply(frame: Record<string, unknown>): ChatCompletionResult {
    return { content: JSON.stringify(frame), toolCalls: [], finishReason: "stop" };
  }
  Object.assign(service, {
    ensureMariCliShim: async () => {},
    resolveConnection: async () => ({
      id: "mari-queue",
      name: "Regression",
      provider: "custom",
      model: "test-model",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "",
      maxContext: 8192,
    }),
    resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
    buildPromptMessages: async () => ({
      messages: [{ role: "user", content: "Hello." }],
      manualApprovalArmed: false,
    }),
    chatCompleteWorkspace: async () => complete(),
  });
  const run = (label: string) => service.prompt({ chatId: chat.id, text: label, onEvent: () => {} });

  assert.equal(await run("clean"), "finished", "A clean run is finished");
  assert.equal(service.isRunActive(), false);

  complete = async () =>
    reply({
      say: "Which way?",
      commands: [],
      ask: [{ question: "Which way?", options: [{ label: "Left" }, { label: "Right" }] }],
      stop: true,
    });
  assert.equal(await run("asks"), "stopped", "A saved question card is not finished");

  // Cut off mid-change: the Accept chip waits for you, so the queue must not send over it (Decision 14).
  const events: Array<{ type: string; data?: unknown }> = [];
  complete = async () => ({
    ...reply({ say: "Writing it.", commands: [{ name: "write", arguments: { path: "a.txt", content: "x" } }] }),
    finishReason: "length",
  });
  assert.equal(
    await service.prompt({ chatId: chat.id, text: "cut off", onEvent: (event) => events.push(event) }),
    "stopped",
    "A truncated turn offering Accept is not finished",
  );
  assert.ok(
    events.some((event) => event.type === "suggestions" && JSON.stringify(event.data).includes("authorization-accept")),
    "The truncated turn really did offer Accept",
  );
  complete = async () => reply({ say: "Done.", commands: [], stop: true });
  assert.equal(await run("clean again"), "finished", "The next clean run is finished again");

  complete = async () => {
    throw new Error("provider down");
  };
  await assert.rejects(run("fails"), { message: "provider down" });

  complete = async () => {
    await service.abort();
    throw new Error("Request aborted");
  };
  assert.equal(await run("stopped by user"), "stopped", "An aborted run is not finished");

  // Replaced by a newer run: the old one swallows its abort and is not finished; the newer one is.
  let releaseOld!: (error: Error) => void;
  let markOldStarted!: () => void;
  const oldStarted = new Promise<void>((resolve) => {
    markOldStarted = resolve;
  });
  complete = async () => {
    markOldStarted();
    return new Promise<ChatCompletionResult>((_resolve, rejectRun) => {
      releaseOld = rejectRun;
    });
  };
  const oldRun = run("old");
  await oldStarted;
  assert.equal(service.isRunActive(), true, "A run holds the slot while it works");
  complete = async () => reply({ say: "Newer.", commands: [], stop: true });
  assert.equal(await run("newer"), "finished");
  releaseOld(new Error("late"));
  assert.equal(await oldRun, "stopped", "A replaced run is not finished");

  // /status carries summaries for the chat that asked, and the other chats' queues stay out of it.
  await store.addPending(chat.id, {
    text: "queued",
    attachments: [{ type: "image/png", data: "data:image/png;base64,PRIVATE", name: "p.png" }],
  });
  const status = await service.status(null, chat.id);
  assert.equal(status.pendingMessages?.length, 1);
  assert.deepEqual(status.pendingMessages?.[0]?.attachments, [{ name: "p.png", type: "image/png" }]);
  assert.ok(!JSON.stringify(status.pendingMessages).includes("PRIVATE"));
  assert.equal((await service.status(null, null)).pendingMessages, undefined);

  // ── Her file tools cannot reach the folder ─────────────────────────────────────────────────────────
  const { workspaceMutationTargetForPath } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { workspacePathAccessPolicy } =
    await import("../../../packages/server/src/services/professor-mari/workspace-change-review.service.js");
  // The data folder sits inside the workspace, as it does by default.
  const savedFile = join(pendingDir, `${chat.id}.json`);
  assert.ok(existsSync(savedFile));
  const workspaceAroundStorage = storageDir;
  const inside = (path: string) => path.slice(workspaceAroundStorage.length + 1);
  for (const target of [savedFile, pendingDir, join(pendingDir, "new-file.json")]) {
    assert.equal(workspacePathAccessPolicy(workspaceAroundStorage, target), "forbidden");
    for (const readOnly of [true, false]) {
      assert.throws(
        () => workspaceMutationTargetForPath(workspaceAroundStorage, inside(target), { readOnly, allowMissing: true }),
        /cannot access/u,
        `${readOnly ? "reading" : "writing"} ${inside(target)} is refused`,
      );
    }
  }
  assert.equal(
    workspacePathAccessPolicy(workspaceAroundStorage, join(workspaceAroundStorage, "tables", "x.json")),
    "normal",
  );
  mkdirSync(join(storageDir, "tables"), { recursive: true });
  writeFileSync(join(storageDir, "tables", "x.json"), "{}");
  assert.doesNotThrow(() =>
    workspaceMutationTargetForPath(workspaceAroundStorage, join("tables", "x.json"), { readOnly: true }),
  );

  console.log("Professor Mari queue regression passed.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}
