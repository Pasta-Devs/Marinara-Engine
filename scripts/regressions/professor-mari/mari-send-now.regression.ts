// Pins Professor Mari's Send now: a message that goes in at her next step. Runs both runtimes with a scripted fake
// provider: no network, no real model. Covers the checkpoint rows, the reset per reply, waiting wins, the round limit,
// what may join a run (words alone, the run's subject and mode, no armed "yes") and the keys.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composerKeyAction } from "../../../packages/client/src/lib/composer-triggers.js";
import type { ChatCompletionResult, ChatMessage } from "../../../packages/server/src/services/llm/base-provider.js";
import type { ProfessorMariAskContext } from "../../../packages/shared/src/types/professor-mari-workspace.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-send-now-storage-"));
const workspaceDir = mkdtempSync(join(tmpdir(), "marinara-mari-send-now-workspace-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

// ── The keys ───────────────────────────────────────────────────────────────────────────────────────
const key = (enterToSend: boolean, mods: { ctrl?: boolean; shift?: boolean; meta?: boolean }) =>
  composerKeyAction({
    key: "Enter",
    shiftKey: mods.shift ?? false,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    isComposing: false,
    pickerOpen: false,
    hasGhost: false,
    enterToSend,
  });
assert.equal(key(true, {}), "send");
assert.equal(key(true, { ctrl: true }), "queue");
assert.equal(key(true, { meta: true }), "queue");
assert.equal(key(true, { shift: true }), "none", "Shift+Enter is a new line");
assert.equal(key(false, {}), "none", "Enter is a new line with the toggle off");
assert.equal(key(false, { ctrl: true }), "send");
assert.equal(key(false, { ctrl: true, shift: true }), "queue");
assert.equal(key(false, { shift: true }), "none");

type Call = { name: string; args: Record<string, unknown> };
type Step = { say: string; calls?: Call[]; ask?: boolean; onCall?: () => Promise<void> };

try {
  const store = await import("../../../packages/server/src/services/professor-mari/workspace-pending-store.js");

  // ── The store ───────────────────────────────────────────────────────────────────────────────────
  const withFile = await store.addPending("store", {
    text: "with a file",
    steer: true,
    attachments: [{ type: "image/png", data: "data:image/png;base64,AAAA", name: "a.png" }],
  });
  assert.equal(withFile.steer, undefined, "Files never go as Send now");
  const withLink = await store.addPending("store", {
    text: "with a link",
    steer: true,
    references: [{ kind: "character", id: "c1", label: "Ann" }],
  });
  assert.equal(withLink.steer, undefined, "Links never go as Send now");
  assert.equal(await store.promotePendingToSteer("store", withFile.id), false, "A row with a file stays queued");
  const withField = await store.addPending("store", {
    text: "shorten this",
    steer: true,
    context: {
      source: "character-editor",
      capability: "explain",
      resource: { kind: "character", id: "c1" },
      fieldId: "description",
    },
  });
  assert.equal(withField.steer, undefined, "A field needs a full send: the model would never read it");
  assert.equal(await store.promotePendingToSteer("store", withField.id), false);
  await store.removePending("store", withField.id);
  const subjectOnly = await store.addPending("store", {
    text: "about her",
    steer: true,
    context: { source: "character-editor", capability: "explain", resource: { kind: "character", id: "c1" } },
  });
  assert.equal(subjectOnly.steer, true, "The subject the composer keeps between sends is not more than words");
  await store.removePending("store", subjectOnly.id);
  const plain = await store.addPending("store", { text: "plain" });
  assert.equal(await store.promotePendingToSteer("store", plain.id), true);
  assert.equal(await store.promotePendingToSteer("store", "gone"), false);
  await store.addPending("store", { text: "second", steer: true });
  assert.equal(await store.hasPendingSteers("store"), true);
  assert.deepEqual(
    (await store.takePendingSteers("store")).map((message) => message.text),
    ["plain", "second"],
    "Steers come out together, oldest first",
  );
  assert.deepEqual(
    (await store.listPending("store")).map((message) => message.text),
    ["with a file", "with a link"],
    "Queued rows stay",
  );
  await store.addPending("store", { text: "was held", steer: true });
  await store.holdPending("store");
  assert.equal(await store.hasPendingSteers("store"), false, "A held message waits for its own Send");
  assert.deepEqual(await store.takePendingSteers("store"), []);
  const heldRow = (await store.listPending("store")).find((message) => message.text === "was held");
  assert.equal(await store.promotePendingToSteer("store", heldRow!.id), false);

  // Asked at every step, with attachments of up to 20 MB in the file: an unchanged file is not parsed again.
  await store.addPending("cached", { text: "x".repeat(40) });
  const cachedPath = join(store.getMariPendingDir(), "cached.json");
  const sameTime = new Date(1_700_000_000_000);
  utimesSync(cachedPath, sameTime, sameTime);
  assert.equal(await store.hasPendingSteers("cached"), false);
  const unsteered = readFileSync(cachedPath, "utf8");
  const steered = unsteered.replace(`"${"x".repeat(40)}"`, `"${"x".repeat(27)}","steer":true`);
  assert.equal(steered.length, unsteered.length, "The test needs the same size, so only a parse could see the change");
  writeFileSync(cachedPath, steered);
  utimesSync(cachedPath, sameTime, sameTime);
  assert.equal(await store.hasPendingSteers("cached"), false, "Same size and time: the file was not read again");
  const later = new Date(1_700_000_001_000);
  utimesSync(cachedPath, later, later);
  assert.equal(await store.hasPendingSteers("cached"), true, "A changed file is read, so Send now is still seen");

  // ── Both runtimes ───────────────────────────────────────────────────────────────────────────────
  const db = await getDB();
  const { ProfessorMariWorkspaceService } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { setSkillGateEnabled } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  setSkillGateEnabled(false);
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const { MARI_RUNTIME_SETTINGS_KEY } = await import("../../../packages/shared/src/constants/mari-runtime.js");
  const chats = createChatsStorage(db);
  const settings = createAppSettingsStorage(db);
  writeFileSync(join(workspaceDir, "hello.txt"), "hi\n");
  const read: Call = { name: "read", args: { path: "hello.txt" } };

  for (const runtime of ["classic", "pi"] as const) {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, runtime);
    let script: Step[] = [];
    let requests: ChatMessage[][] = [];
    let maxToolRounds: number | undefined;
    let mode: "auto" | "manual" | "plan" = "auto";
    let armed = false;
    let callNumber = 0;
    const toResult = (step: Step): ChatCompletionResult => {
      callNumber += 1;
      const usage = { promptTokens: 10, completionTokens: 1, totalTokens: 11 };
      const calls = step.calls ?? [];
      if (runtime === "classic") {
        const ask = step.ask ? { ask: [{ question: step.say, options: [{ label: "A" }, { label: "B" }] }] } : {};
        const commands = calls.map((call) => ({ name: call.name, arguments: call.args }));
        return {
          content: JSON.stringify({ say: step.say, commands, stop: calls.length === 0, ...ask }),
          toolCalls: [],
          finishReason: "stop",
          usage,
        };
      }
      const toolCalls = [
        ...calls,
        ...(step.ask
          ? [{ name: "ask", args: { questions: [{ question: step.say, options: [{ label: "A" }, { label: "B" }] }] } }]
          : []),
      ].map((call, index) => ({
        id: `call-${callNumber}-${index}`,
        type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.args) },
      }));
      return { content: step.say, toolCalls, finishReason: toolCalls.length > 0 ? "tool_calls" : "stop", usage };
    };
    const service = new ProfessorMariWorkspaceService({ db } as never);
    service.setEnabled(true, workspaceDir);
    const originalRunPi = (service as unknown as { runPiRuntime: (args: unknown) => Promise<void> }).runPiRuntime.bind(
      service,
    );
    const originalBuildPrompt = (
      service as unknown as { buildPromptMessages: (...args: unknown[]) => Promise<unknown> }
    ).buildPromptMessages.bind(service);
    let realPrompt = false;
    Object.assign(service, {
      ensureMariCliShim: async () => {},
      resolveConnection: async () => ({
        id: "mari-send-now",
        name: "Regression",
        provider: "custom",
        model: "fake-model",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "",
        maxContext: 32768,
      }),
      resolvePermissionsMode: async () => ({ mode, defaultMode: "auto", source: "chat" }),
      buildPromptMessages: async (...args: unknown[]) =>
        realPrompt
          ? originalBuildPrompt(...args)
          : {
              messages: [
                { role: "system", content: "You are Professor Mari (regression).", contextKind: "prompt" },
                { role: "user", content: "Do the thing.", contextKind: "history" },
              ],
              manualApprovalArmed: armed,
              heldCalls: [],
            },
      runPiRuntime: (args: Record<string, unknown>) => originalRunPi({ ...args, maxToolRounds }),
      chatCompleteWorkspace: async (_provider: unknown, messages: ChatMessage[]) => {
        requests.push(structuredClone(messages));
        const next = script.shift();
        if (!next) throw new Error(`${runtime}: the scripted provider ran out of replies.`);
        await next.onCall?.();
        return toResult(next);
      },
    });
    let latestChatId = "";
    const scenario = async (label: string, steps: Step[]) => {
      const chat = await chats.create({ name: `${runtime} ${label}`, mode: "conversation", characterIds: [] });
      latestChatId = chat.id;
      script = steps;
      requests = [];
      const events: Array<{ type: string; data?: unknown }> = [];
      const outcome = await service.prompt({
        chatId: chat.id,
        text: "Do the thing.",
        onEvent: (event) => events.push(event),
      });
      const rows = (await chats.listMessages(chat.id)).map((row) => ({
        role: row.role,
        content: row.content,
        extra: JSON.parse(String(row.extra ?? "{}")) as Record<string, unknown>,
      }));
      return { chatId: chat.id, outcome, events, rows, unusedSteps: script.length };
    };
    // The chat exists only once the scenario starts, so a steer reads its id when the call happens.
    const steer = (text: string) => async () => {
      await store.addPending(latestChatId, { text, steer: true });
    };
    const asked = (messages: ChatMessage[] | undefined, text: string) => JSON.stringify(messages ?? []).includes(text);
    const shape = (rows: Array<{ role: string; content: string }>) => rows.map((row) => `${row.role}: ${row.content}`);

    // Mid-work: her words and steps are saved, your message follows, and the same run carries on with a new reply.
    const midWork = await scenario("mid work", [
      { say: "Reading it.", calls: [read], onCall: steer("Use the other file") },
      { say: "Okay, the other file." },
    ]);
    assert.equal(midWork.outcome, "finished", `${runtime}: a steered run still finishes`);
    assert.deepEqual(
      shape(midWork.rows),
      ["user: Do the thing.", "assistant: Reading it.", "user: Use the other file", "assistant: Okay, the other file."],
      `${runtime}: the rows read in the order things happened`,
    );
    assert.ok(asked(requests[1], "Use the other file"), `${runtime}: the model reads it in the next round`);
    assert.equal(midWork.events.filter((event) => event.type === "checkpoint").length, 1);
    assert.ok(
      JSON.stringify(midWork.rows[1]!.extra.mariWorkspaceTimeline).includes("read"),
      `${runtime}: the first reply keeps its steps`,
    );
    assert.ok(
      !JSON.stringify(midWork.rows[3]!.extra.mariWorkspaceTimeline ?? []).includes("hello.txt"),
      `${runtime}: the second reply does not repeat them`,
    );
    const usage = (row: { extra: Record<string, unknown> }) =>
      (row.extra.generationInfo as { usage?: { promptTokens: number } }).usage?.promptTokens;
    assert.equal(usage(midWork.rows[3]!), 10, `${runtime}: usage is counted per reply, not doubled`);
    assert.equal(
      typeof midWork.rows[2]!.extra.mariRunStartedAt,
      "number",
      `${runtime}: your row starts a reply's clock`,
    );
    assert.deepEqual(await store.listPending(midWork.chatId), [], `${runtime}: delivered means gone from the list`);

    const continuity = (row: { extra: Record<string, unknown> }) => String(row.extra.mariWorkspaceContinuity);
    assert.ok(continuity(midWork.rows[1]!).includes("hello.txt"), `${runtime}: the first reply keeps its evidence`);
    assert.ok(!continuity(midWork.rows[3]!).includes("hello.txt"), `${runtime}: a later reply does not repeat it`);
    const lastUserRow = (await chats.listMessages(midWork.chatId)).filter((row) => row.role === "user").pop();
    assert.equal(
      (service as unknown as { activeDecisionContext: { userMessageId: string } }).activeDecisionContext.userMessageId,
      lastUserRow?.id,
      `${runtime}: a Decision answer can quote the message you just sent`,
    );

    // Retry after a partial reply: your message is reused, her words stay, and your message is what the model reads last.
    const failedChat = await chats.create({ name: `${runtime} retry`, mode: "conversation", characterIds: [] });
    latestChatId = failedChat.id;
    const failedRows = async () =>
      (await chats.listMessages(failedChat.id)).map((row) => ({ role: row.role, content: row.content, id: row.id }));
    script = [{ say: "Reading it.", calls: [read] }];
    await assert.rejects(service.prompt({ chatId: failedChat.id, text: "Do the thing.", onEvent: () => {} }));
    assert.deepEqual(shape(await failedRows()), ["user: Do the thing.", "assistant: Reading it."]);
    const failedQuestionId = (await failedRows())[0]!.id;
    realPrompt = true;
    script = [{ say: "Done now." }];
    requests = [];
    await service.prompt({
      chatId: failedChat.id,
      text: "Do the thing.",
      existingUserMessageId: failedQuestionId,
      onEvent: () => {},
    });
    realPrompt = false;
    assert.deepEqual(
      shape(await failedRows()),
      ["user: Do the thing.", "assistant: Reading it.", "assistant: Done now."],
      `${runtime}: Retry adds no second question and keeps her partial reply`,
    );
    const retried = requests[0]!.filter((message) => message.role !== "system");
    assert.equal(retried.at(-1)?.role, "user", `${runtime}: a turn ends on your message`);
    assert.ok(String(retried.at(-1)?.content).includes("Do the thing."));
    assert.ok(asked(retried, "Reading it."), `${runtime}: she can see what she already said`);
    await assert.rejects(
      service.prompt({
        chatId: failedChat.id,
        text: "Do the thing.",
        existingUserMessageId: failedQuestionId,
        onEvent: () => {},
      }),
      /Only the latest/,
      `${runtime}: a reply that finished closes the question`,
    );

    // A typed "yes" armed the run for the change she held, not for what you send next: the write still waits.
    mode = "manual";
    armed = true;
    await scenario("disarmed", [
      { say: "Reading it.", calls: [read], onCall: steer("Also create that file") },
      { say: "", calls: [{ name: "write", args: { path: "disarmed.txt", content: "x", reason: "test" } }] },
      { say: "Stopping here." },
      { say: "Stopping here." },
    ]);
    armed = false;
    mode = "auto";
    assert.equal(existsSync(join(workspaceDir, "disarmed.txt")), false, `${runtime}: Send now never skips the Accept`);

    // A mode changed during the run is only read by the next run, so your message waits for that one.
    const modeChanged = await scenario("mode changed", [
      {
        say: "Reading it.",
        calls: [read],
        onCall: async () => {
          await steer("Don't change anything yet")();
          mode = "plan";
        },
      },
      { say: "Done." },
    ]);
    mode = "auto";
    assert.equal(modeChanged.events.filter((event) => event.type === "checkpoint").length, 0);
    assert.deepEqual(
      (await store.listPending(modeChanged.chatId)).map((message) => message.text),
      ["Don't change anything yet"],
      `${runtime}: it waits for a run in the new mode`,
    );

    // The prompt is built once, so a message about another subject waits for a run that reads it.
    const characterA = { source: "character-editor", capability: "explain", resource: { kind: "character", id: "a" } };
    const onSubject = { chatId: "subject-chat" };
    Object.assign(service, { activeSteerRun: { chatId: onSubject.chatId, mode: "auto", context: characterA } });
    const askAbout = (id: string) =>
      service.canSteerNow(onSubject.chatId, {
        ...characterA,
        resource: { kind: "character", id },
      } as ProfessorMariAskContext);
    assert.equal(await askAbout("a"), true, `${runtime}: the run's own subject can go now`);
    assert.equal(await askAbout("b"), false, `${runtime}: another subject waits`);
    assert.equal(await service.canSteerNow(onSubject.chatId, undefined), true, `${runtime}: words alone can go now`);
    assert.equal(await service.canSteerNow("other-chat", undefined), true, `${runtime}: no run there, just the queue`);
    mode = "plan";
    assert.equal(await askAbout("a"), false, `${runtime}: a changed mode waits`);
    mode = "auto";

    // Two at one step reach her together, and both get a row.
    const twoSteers = await scenario("two", [
      {
        say: "Reading it.",
        calls: [read],
        onCall: async () => {
          await steer("First thing")();
          await steer("Second thing")();
        },
      },
      { say: "Both noted." },
    ]);
    assert.deepEqual(
      shape(twoSteers.rows).slice(2),
      ["user: First thing", "user: Second thing", "assistant: Both noted."],
      `${runtime}: one row each`,
    );
    assert.ok(asked(requests[1], "First thing") && asked(requests[1], "Second thing"));

    // A final answer ending on a question: no chips-only round is spent, because you have already moved on.
    const finalAnswer = await scenario("final", [
      { say: "All done. Want anything else?", onCall: steer("Yes, one more") },
      { say: "One more, done." },
    ]);
    assert.equal(finalAnswer.unusedSteps, 0);
    assert.equal(requests.length, 2, `${runtime}: no chips-only round in between`);
    assert.deepEqual(shape(finalAnswer.rows).slice(1), [
      "assistant: All done. Want anything else?",
      "user: Yes, one more",
      "assistant: One more, done.",
    ]);

    // Steps but no words: the row stays, marked as a placeholder.
    const wordless = await scenario("wordless", [
      { say: "", calls: [read], onCall: steer("Hurry up") },
      { say: "Done." },
    ]);
    assert.deepEqual(shape(wordless.rows).slice(1), ["assistant: Still working", "user: Hurry up", "assistant: Done."]);
    assert.equal(wordless.rows[1]!.extra.mariCheckpointFiller, true);
    assert.equal(wordless.rows[3]!.extra.mariCheckpointFiller, undefined, `${runtime}: the mark does not stick`);

    // Waiting wins: a question ends the run with the message still in the list, for its own Send.
    const question = await scenario("question", [{ say: "Which way?", ask: true, onCall: steer("Never mind") }]);
    assert.equal(question.outcome, "stopped", `${runtime}: a question is not finished`);
    assert.deepEqual(
      (await store.listPending(question.chatId)).map((message) => message.text),
      ["Never mind"],
      `${runtime}: it stays queued`,
    );
    assert.equal(question.events.filter((event) => event.type === "checkpoint").length, 0);

    // Queued for later is not Send now: it waits for the end.
    const queued = await scenario("queued", [
      {
        say: "Reading it.",
        calls: [read],
        onCall: async () => {
          await store.addPending(latestChatId, { text: "After you finish" });
        },
      },
      { say: "Done." },
    ]);
    assert.equal(queued.events.filter((event) => event.type === "checkpoint").length, 0);
    assert.ok(!asked(requests[1], "After you finish"), `${runtime}: she does not read it yet`);
    assert.equal((await store.listPending(queued.chatId)).length, 1);

    // The round limit holds: a steer does not buy more rounds, and the queue sends it next.
    if (runtime === "pi") {
      maxToolRounds = 1;
      const limit = await scenario("limit", [
        { say: "Reading it.", calls: [read], onCall: steer("Too late") },
        { say: "Here is what I have." },
      ]);
      maxToolRounds = undefined;
      assert.equal(limit.events.filter((event) => event.type === "checkpoint").length, 0);
      assert.deepEqual(
        (await store.listPending(limit.chatId)).map((message) => message.text),
        ["Too late"],
        "At the limit it stays for the queue",
      );
    }
  }
  console.log("mari-send-now regression passed");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
}
