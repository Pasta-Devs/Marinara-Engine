// Pins Professor Mari's to-do list: the shared sanitizer and "which list counts" rules, and the `todo` tool/field on
// both runtimes with a scripted fake provider (no network, no real model). Covers what ends a turn and what doesn't,
// the saved list, Send now, the round count, the continuity prompt and the live run status.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatCompletionResult, ChatMessage } from "../../../packages/server/src/services/llm/base-provider.js";
import { chooseMariTodos } from "../../../packages/client/src/components/chat/mari/mari-tool-presentation.js";
import {
  latestMariTodos,
  MARI_TODO_MAX_CONTENT_CHARS,
  MARI_TODO_MAX_ITEMS,
  sanitizeMariTodos,
  type MariTodoItem,
} from "../../../packages/shared/src/types/professor-mari-workspace.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-todo-storage-"));
const workspaceDir = mkdtempSync(join(tmpdir(), "marinara-mari-todo-workspace-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

// ── The sanitizer ──────────────────────────────────────────────────────────────────────────────────
assert.equal(MARI_TODO_MAX_ITEMS, 12);
assert.deepEqual(sanitizeMariTodos("nope"), [], "an array only");
assert.deepEqual(sanitizeMariTodos({ items: [] }), []);
assert.deepEqual(
  sanitizeMariTodos([
    { content: "  Read it  ", status: "completed" },
    { content: "   ", status: "pending" },
    "a string",
    null,
    [],
    { status: "pending" },
    { content: "No status" },
    { content: "Odd status", status: "bogus" },
  ]),
  [
    { content: "Read it", status: "completed" },
    { content: "No status", status: "pending" },
    { content: "Odd status", status: "pending" },
  ],
  "trims, drops empties and non-records, unknown status is pending",
);
assert.deepEqual(
  sanitizeMariTodos([
    { content: "a", status: "pending" },
    { content: "b", status: "in_progress" },
    { content: "c", status: "in_progress" },
    { content: "d", status: "completed" },
  ]).map((item) => item.status),
  ["pending", "in_progress", "pending", "completed"],
  "the first in_progress stays, later ones become pending",
);
assert.equal(
  sanitizeMariTodos(Array.from({ length: 20 }, (_, index) => ({ content: `step ${index}`, status: "pending" }))).length,
  12,
  "capped at 12",
);
assert.equal(
  sanitizeMariTodos([{ content: "x".repeat(MARI_TODO_MAX_CONTENT_CHARS + 50), status: "pending" }])[0]?.content.length,
  MARI_TODO_MAX_CONTENT_CHARS,
  "one step can't grow without limit",
);

// ── Which list counts ──────────────────────────────────────────────────────────────────────────────
const open: MariTodoItem[] = [
  { content: "Read", status: "completed" },
  { content: "Write", status: "in_progress" },
];
const done: MariTodoItem[] = [{ content: "Read", status: "completed" }];
const reply = (mariTodos?: unknown) => ({ role: "assistant", extra: mariTodos === undefined ? {} : { mariTodos } });
const you = { role: "user", extra: null };
assert.equal(latestMariTodos([]), null);
assert.deepEqual(
  latestMariTodos([reply(open), you]),
  { todos: open, stale: false },
  "newest first: her reply is newest",
);
assert.deepEqual(latestMariTodos([you, reply(open)]), { todos: open, stale: true }, "you wrote after it");
assert.deepEqual(latestMariTodos([you, reply(done)]), null, "a stale list with everything done says nothing");
assert.deepEqual(
  latestMariTodos([reply(done), you]),
  { todos: done, stale: false },
  "a fresh finished list still shows",
);
assert.deepEqual(
  latestMariTodos([you, reply(), you, reply(open)]),
  { todos: open, stale: true },
  "her second-last reply",
);
assert.equal(latestMariTodos([you, reply(), you, reply(), you, reply(open)]), null, "her third-last reply is too old");
assert.deepEqual(
  latestMariTodos([you, you, { role: "system", extra: null }, reply(open)]),
  { todos: open, stale: true },
  "only her replies count towards the 2",
);
assert.equal(latestMariTodos([you, reply([]), you, reply(open)]), null, "a saved [] ends the search");
assert.deepEqual(
  latestMariTodos([reply(open), you, reply([])]),
  { todos: open, stale: false },
  "the newest row decides",
);
assert.equal(latestMariTodos([reply("junk"), reply(undefined)]), null, "a non-array is not a list");
assert.deepEqual(latestMariTodos([reply("junk"), reply(open)]), { todos: open, stale: false }, "and is skipped");
assert.deepEqual(latestMariTodos([{ role: "assistant", extra: null }, reply(open)]), { todos: open, stale: false });

// ── Which list the transcript pins (the client's choice) ───────────────────────────────────────────
const savedRow = (role: string, mariTodos?: unknown) =>
  ({ role, extra: mariTodos === undefined ? {} : { mariTodos } }) as never;
const savedOpen = [savedRow("user"), savedRow("assistant", open)];
assert.deepEqual(chooseMariTodos(done, open, savedOpen), { todos: done, stale: false }, "the live list beats the rest");
assert.equal(chooseMariTodos([], open, savedOpen), null, "a live [] means she cleared it: nothing, not the saved list");
assert.deepEqual(
  chooseMariTodos(null, open, [savedRow("assistant", done)]),
  { todos: open, stale: false },
  "a reloaded page mid-run uses the run status's list",
);
assert.equal(chooseMariTodos(null, [], savedOpen), null, "and so does its [] (cleared)");
assert.deepEqual(chooseMariTodos(null, undefined, savedOpen), { todos: open, stale: false }, "else the saved row");
assert.deepEqual(
  chooseMariTodos(null, null, [...savedOpen, savedRow("user")]),
  { todos: open, stale: true },
  "your message after it makes it stale",
);
assert.equal(chooseMariTodos(null, null, []), null, "nothing loaded, nothing shown");
assert.deepEqual(
  chooseMariTodos(null, null, [{ role: "assistant", extra: JSON.stringify({ mariTodos: open }) } as never]),
  { todos: open, stale: false },
  "an extra still held as JSON text is parsed",
);

type Call = { name: string; args: Record<string, unknown> };
type Step = {
  say: string;
  calls?: Call[];
  /** What she sends as the list: the `todo` tool's items (pi) or the `todo` field (classic). */
  todo?: unknown;
  chips?: boolean;
  ask?: boolean;
  /** Classic only: the frame's own stop value; defaults to "no commands". */
  stop?: boolean;
  onCall?: () => Promise<void>;
};

const list: MariTodoItem[] = [
  { content: "Read the file", status: "in_progress" },
  { content: "Write the summary", status: "pending" },
];

try {
  const store = await import("../../../packages/server/src/services/professor-mari/workspace-pending-store.js");
  const db = await getDB();
  const { ProfessorMariWorkspaceService, parseAssistantWorkspaceAction } =
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

  // ── The classic frame ───────────────────────────────────────────────────────────────────────────
  const frame = (extra: Record<string, unknown>) =>
    parseAssistantWorkspaceAction(JSON.stringify({ say: "Working.", commands: [], stop: false, ...extra }));
  assert.equal(frame({}).todos, null, "not called is null");
  assert.deepEqual(frame({ todo: [] }).todos, [], "[] is a cleared list, not 'not called'");
  assert.deepEqual(frame({ todo: list }).todos, list);
  assert.equal(
    frame({ todo: [{ content: " ", status: "pending" }] }).todos,
    null,
    "a list with no usable item is a mistake",
  );
  assert.equal(frame({ todo: "later" }).todos, null, "a non-array is ignored");
  assert.ok(
    JSON.parse(frame({ todo: list }).assistantHistoryContent).todo.length === 2,
    "classic rounds see their own list in history",
  );
  assert.equal(JSON.parse(frame({}).assistantHistoryContent).todo, undefined);

  for (const runtime of ["classic", "pi"] as const) {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, runtime);
    let script: Step[] = [];
    let requests: ChatMessage[][] = [];
    let maxToolRounds: number | undefined;
    let callNumber = 0;
    const toResult = (step: Step): ChatCompletionResult => {
      callNumber += 1;
      const usage = { promptTokens: 10, completionTokens: 1, totalTokens: 11 };
      const calls = step.calls ?? [];
      const chips = [{ label: "Go on", prompt: "Go on" }];
      const askCard = [{ question: step.say, options: [{ label: "A" }, { label: "B" }] }];
      if (runtime === "classic") {
        const commands = calls.map((call) => ({ name: call.name, arguments: call.args }));
        return {
          content: JSON.stringify({
            say: step.say,
            commands,
            stop: step.stop ?? calls.length === 0,
            ...(step.todo !== undefined ? { todo: step.todo } : {}),
            ...(step.chips ? { suggestions: chips } : {}),
            ...(step.ask ? { ask: askCard } : {}),
          }),
          toolCalls: [],
          finishReason: "stop",
          usage,
        };
      }
      const toolCalls = [
        ...calls,
        ...(step.todo !== undefined ? [{ name: "todo", args: { items: step.todo } }] : []),
        ...(step.chips ? [{ name: "suggestions", args: { chips } }] : []),
        ...(step.ask ? [{ name: "ask", args: { questions: askCard } }] : []),
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
    // The workspace commands see only what reaches the executor.
    const executed: string[] = [];
    const commands = (
      service as unknown as {
        commands: { executeWorkspaceCommand: (call: { name: string }, ...rest: unknown[]) => Promise<unknown> };
      }
    ).commands;
    const originalExecute = commands.executeWorkspaceCommand.bind(commands);
    commands.executeWorkspaceCommand = async (call, ...rest) => {
      executed.push(call.name);
      return originalExecute(call, ...rest);
    };
    let realPrompt = false;
    Object.assign(service, {
      ensureMariCliShim: async () => {},
      resolveConnection: async () => ({
        id: "mari-todo",
        name: "Regression",
        provider: "custom",
        model: "fake-model",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "",
        maxContext: 32768,
      }),
      resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
      buildPromptMessages: async (...args: unknown[]) =>
        realPrompt
          ? originalBuildPrompt(...args)
          : {
              messages: [
                { role: "system", content: "You are Professor Mari (regression).", contextKind: "prompt" },
                { role: "user", content: "Do the thing.", contextKind: "history" },
              ],
              manualApprovalArmed: false,
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
    const readRows = async (chatId: string) =>
      (await chats.listMessages(chatId)).map((row) => ({
        role: row.role,
        content: row.content,
        extra: JSON.parse(String(row.extra ?? "{}")) as Record<string, unknown>,
      }));
    const scenario = async (label: string, steps: Step[]) => {
      const chat = await chats.create({ name: `${runtime} ${label}`, mode: "conversation", characterIds: [] });
      latestChatId = chat.id;
      script = steps;
      requests = [];
      executed.length = 0;
      const events: Array<{ type: string; data?: unknown }> = [];
      const outcome = await service.prompt({
        chatId: chat.id,
        text: "Do the thing.",
        onEvent: (event) => events.push(event),
      });
      return { chatId: chat.id, outcome, events, rows: await readRows(chat.id), unusedSteps: script.length };
    };
    const lastReply = (rows: Array<{ role: string; extra: Record<string, unknown> }>) =>
      rows.filter((row) => row.role === "assistant").at(-1)!;
    const todoEvents = (events: Array<{ type: string; data?: unknown }>) =>
      events.filter((event) => event.type === "todos").map((event) => event.data);
    const asked = (messages: ChatMessage[] | undefined, text: string) => JSON.stringify(messages ?? []).includes(text);
    const liveTodos = () => (service as unknown as { latestRun: { todos?: MariTodoItem[] } | null }).latestRun?.todos;

    // A list beside a command, then a final answer: the run's list is saved on her row, and the status carries it.
    const beside = await scenario("beside", [{ say: "Reading it.", calls: [read], todo: list }, { say: "Done." }]);
    assert.equal(beside.outcome, "finished");
    assert.deepEqual(lastReply(beside.rows).extra.mariTodos, list, `${runtime}: saved on her row`);
    assert.deepEqual(todoEvents(beside.events), [list], `${runtime}: one todos event`);
    assert.deepEqual(liveTodos(), list, `${runtime}: the run status carries the list`);
    assert.ok(!executed.includes("todo"), `${runtime}: the executor never sees todo`);
    assert.deepEqual(executed, ["read"]);

    // On a final answer. (pi: words plus todo alone are not final, so a chips round makes it one.)
    const onFinal =
      runtime === "classic"
        ? await scenario("final", [{ say: "All done.", todo: [{ content: "Read", status: "completed" }] }])
        : await scenario("final", [
            { say: "All done.", todo: [{ content: "Read", status: "completed" }], chips: true },
          ]);
    assert.equal(onFinal.unusedSteps, 0);
    assert.deepEqual(lastReply(onFinal.rows).extra.mariTodos, [{ content: "Read", status: "completed" }]);

    // Not called: nothing saved, nothing live.
    const plain = await scenario("plain", [{ say: "Hello." }]);
    assert.equal("mariTodos" in lastReply(plain.rows).extra, false, `${runtime}: no list, no key`);
    assert.equal(liveTodos(), undefined, `${runtime}: a new run starts with no live list`);
    assert.equal(todoEvents(plain.events).length, 0);

    // An explicit [] clears it and is saved as [].
    const cleared = await scenario(
      "cleared",
      runtime === "classic"
        ? [
            { say: "Reading it.", calls: [read], todo: list },
            { say: "Done.", todo: [] },
          ]
        : [{ say: "Reading it.", calls: [read], todo: list }, { say: "Tidying up.", todo: [] }, { say: "Done." }],
    );
    assert.deepEqual(lastReply(cleared.rows).extra.mariTodos, [], `${runtime}: [] is saved, so the list is gone`);
    assert.deepEqual(todoEvents(cleared.events), [list, []]);
    assert.deepEqual(liveTodos(), []);

    // The list is capped at 12 on the way in.
    const long = Array.from({ length: 12 }, (_, index) => ({ content: `step ${index + 1}`, status: "pending" }));
    const capped = await scenario("capped", [
      { say: "Reading it.", calls: [read], todo: runtime === "classic" ? [...long, ...long] : long },
      { say: "Done." },
    ]);
    assert.equal((lastReply(capped.rows).extra.mariTodos as unknown[]).length, 12);

    // Send now: the list belongs to the run, so both replies carry it.
    const steered = await scenario("send now", [
      {
        say: "Reading it.",
        calls: [read],
        todo: list,
        onCall: async () => {
          await store.addPending(latestChatId, { text: "Use the other file", steer: true });
        },
      },
      { say: "Okay, the other file." },
    ]);
    const assistantRows = steered.rows.filter((row) => row.role === "assistant");
    assert.equal(steered.events.filter((event) => event.type === "checkpoint").length, 1);
    assert.equal(assistantRows.length, 2);
    assert.deepEqual(assistantRows[0]!.extra.mariTodos, list, `${runtime}: the first reply carries the list`);
    assert.deepEqual(assistantRows[1]!.extra.mariTodos, list, `${runtime}: so does the second`);

    // The continuity prompt: an unfinished list of hers goes in, even with no other continuity entries.
    const seeded = async (todos: unknown) => {
      const chat = await chats.create({ name: `${runtime} seeded`, mode: "conversation", characterIds: [] });
      await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: "Earlier question" });
      const row = await chats.createMessage({
        chatId: chat.id,
        role: "assistant",
        characterId: null,
        content: "Working on it.",
      });
      await chats.updateMessageExtra(row!.id, { mariTodos: todos });
      return chat.id;
    };
    const promptWith = async (chatId: string) => {
      realPrompt = true;
      script = [{ say: "Okay." }];
      requests = [];
      try {
        await service.prompt({ chatId, text: "Carry on", onEvent: () => {} });
      } finally {
        realPrompt = false;
      }
      return requests[0];
    };
    const withList = await promptWith(await seeded(open));
    assert.ok(asked(withList, "<your_todo_list>"), `${runtime}: an unfinished list is in the prompt`);
    assert.ok(asked(withList, "- [in_progress] Write"), `${runtime}: with its statuses`);
    assert.ok(asked(withList, "<workspace_continuity>"), `${runtime}: the block exists with no other entries`);
    const withDone = await promptWith(await seeded(done));
    assert.ok(!asked(withDone, "<your_todo_list>"), `${runtime}: a finished list is not`);
    const withNone = await promptWith(await seeded([]));
    assert.ok(!asked(withNone, "<your_todo_list>"), `${runtime}: a cleared list is not`);

    if (runtime === "classic") {
      // A keep-going frame with no commands still updates the list, and the next round sees it.
      const keepGoing = await scenario("keep going", [
        { say: "Noting the plan.", todo: list, stop: false },
        { say: "Nothing more to add." },
      ]);
      assert.deepEqual(lastReply(keepGoing.rows).extra.mariTodos, list);
      assert.ok(asked(requests[1], "Write the summary"), "classic: the next round sees its own list in history");
      // A chips-only repair round never changes the list.
      continue;
    }

    // ── pi only: what ends a turn ───────────────────────────────────────────────────────────────────
    // Words plus todo alone carry on to another model round, and the words are narration, not the answer.
    const carryOn = await scenario("carry on", [{ say: "Starting with the file.", todo: list }, { say: "All done." }]);
    assert.equal(carryOn.outcome, "finished");
    assert.equal(carryOn.unusedSteps, 0);
    assert.equal(requests.length, 2, "pi: words plus todo alone is not a final answer");
    assert.ok(
      carryOn.events.some((event) => event.type === "metadata" && (event.data as { narration?: boolean }).narration),
      "pi: its words are marked as narration",
    );
    assert.equal(lastReply(carryOn.rows).content, "All done.");
    assert.deepEqual(lastReply(carryOn.rows).extra.mariTodos, list);
    assert.ok(asked(requests[1], "List updated."), "pi: she is told the list changed");
    assert.deepEqual(executed, []);

    // A todo-only round is not work and not a final answer: a false claim in its words is audited as a mid-run one
    // (the step budget), not as the closing answer, and no held-claim repair runs.
    const claim = await scenario("claim", [
      { say: "I have created the character and it is saved.", todo: list },
      { say: "Let me look first." },
    ]);
    assert.equal(requests.length, 2);
    assert.ok(
      asked(requests[1], "You claimed a step was completed"),
      "pi: audited as a mid-run claim, not a closing one",
    );
    assert.ok(!asked(requests[1], "claimed the requested workspace change was complete"));
    assert.equal(claim.unusedSteps, 0);
    const held = await scenario("held claim", [
      { say: "The change is held for your approval.", todo: list },
      { say: "Here is where things stand." },
    ]);
    assert.equal(requests.length, 2, "pi: a lone todo round gets no held-claim repair");
    assert.equal(held.unusedSteps, 0);
    assert.equal(lastReply(held.rows).content, "Here is where things stand.");

    // Words plus chips plus todo is a final answer: no further request.
    const withChips = await scenario("chips", [
      { say: "Here is the plan.", todo: list, chips: true },
      { say: "Never asked for." },
    ]);
    assert.equal(withChips.outcome, "finished");
    assert.equal(requests.length, 1, "pi: chips plus todo ends the turn");
    assert.equal(withChips.unusedSteps, 1);
    assert.deepEqual(lastReply(withChips.rows).extra.mariTodos, list);
    assert.equal(lastReply(withChips.rows).content, "Here is the plan.");
    assert.equal(
      withChips.events.some((event) => event.type === "metadata" && (event.data as { narration?: boolean }).narration),
      false,
      "pi: a final answer is not narration",
    );

    // Beside a question it just saves, and the turn still ends.
    const withAsk = await scenario("ask", [{ say: "Which way?", ask: true, todo: list }, { say: "Never asked for." }]);
    assert.equal(withAsk.outcome, "stopped");
    assert.equal(requests.length, 1, "pi: a question ends the turn");
    assert.deepEqual(lastReply(withAsk.rows).extra.mariTodos, list);

    // Invalid items are an error result and the old list stays.
    const invalid = await scenario("invalid", [
      { say: "Reading it.", calls: [read], todo: list },
      { say: "Updating.", todo: [{ content: "   ", status: "pending" }] },
      { say: "Done." },
    ]);
    assert.ok(asked(requests[2], "No valid items; the list was not changed."), "pi: she is told it failed");
    assert.deepEqual(lastReply(invalid.rows).extra.mariTodos, list, "pi: the old list is kept");
    assert.deepEqual(todoEvents(invalid.events), [list], "pi: no event for the failed call");

    // Content that names internals is scrubbed like her words.
    const scrubbed = await scenario("scrubbed", [
      { say: "Planning.", todo: [{ content: "Call app_data to fix it", status: "pending" }] },
      { say: "That is the plan." },
    ]);
    const savedList = lastReply(scrubbed.rows).extra.mariTodos as MariTodoItem[];
    assert.ok(!savedList[0]!.content.includes("app_data"), "pi: internal names are scrubbed from the list");

    // A lone todo round uses up a round: it costs a real request, so it cannot loop past the limit.
    maxToolRounds = 2;
    const limited = await scenario("limit", [
      { say: "One.", todo: list },
      { say: "Two.", todo: list.slice(0, 1) },
      { say: "Here is what I have." },
    ]);
    maxToolRounds = undefined;
    assert.equal(requests.length, 3, "pi: two todo rounds hit a limit of 2, then the summary");
    assert.equal(limited.unusedSteps, 0);
    assert.ok(
      limited.rows.some((row) => row.content.includes("Tool round limit reached")),
      "pi: the limit note is shown",
    );
  }
  console.log("mari-todo regression passed");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
}
