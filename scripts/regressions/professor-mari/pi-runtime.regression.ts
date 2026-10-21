// Pins Professor Mari's optional pi runtime with a scripted fake provider: no network, no real model.
// Covers the tool-call round trip through WorkspaceCommands, the Permissions Mode floors, abort, the classic
// default and fallback, the closed tool set, replay metadata, the per-turn review and the real prompt builder.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseTextualToolCalls,
  stripTextualToolCalls,
} from "../../../packages/server/src/services/llm/textual-tool-call-parser.js";
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-pi-storage-"));
const workspaceDir = mkdtempSync(join(tmpdir(), "marinara-mari-pi-workspace-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

type Scripted =
  ChatCompletionResult | ((options: ChatOptions, onToken?: (chunk: string) => void) => Promise<ChatCompletionResult>);
type Call = { id: string; name: string; args: Record<string, unknown> };
const reply = (content: string, toolCalls: Call[] = [], providerMetadata?: Record<string, unknown>) =>
  ({
    content,
    toolCalls: toolCalls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })),
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
    ...(providerMetadata ? { providerMetadata } : {}),
  }) satisfies ChatCompletionResult;
const toolMessages = (messages: ChatMessage[]) => messages.filter((message) => message.role === "tool");

try {
  const db = await getDB();
  const {
    ProfessorMariWorkspaceService,
    WORKSPACE_TOOL_DEFINITIONS,
    MAX_REPEATED_COMMAND_FAILURES,
    workspaceTextClaimsHeldChange,
    draftVisibleText,
  } = await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { assertClosedToolSet } = await import("../../../packages/server/src/services/professor-mari/pi-runtime.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const { MARI_RUNTIME_SETTINGS_KEY } = await import("../../../packages/shared/src/constants/mari-runtime.js");
  const chats = createChatsStorage(db);
  const settings = createAppSettingsStorage(db);

  writeFileSync(join(workspaceDir, "hello.txt"), "hi from the workspace file\n");

  let mode: "auto" | "manual" | "plan" | "bypass" = "auto";
  let provider = "custom";
  let armed = false;
  let userText = "Do the thing.";
  let defaultParameters: string | null = null;
  let script: Scripted[] = [];
  let requests: Array<{ messages: ChatMessage[]; options: ChatOptions }> = [];
  let runtimeSeen: unknown[] = [];
  let piEntered = 0;
  let maxToolRounds: number | undefined;
  let sessionSeen: { active: string[]; closed: boolean } | null = null;

  const makeService = (stubPromptBuilder: boolean) => {
    const made = new ProfessorMariWorkspaceService({ db } as never);
    made.setEnabled(true, workspaceDir);
    const originalRunPi = (made as unknown as { runPiRuntime: (args: unknown) => Promise<void> }).runPiRuntime.bind(
      made,
    );
    const originalBuild = (
      made as unknown as { buildPromptMessages: (...args: unknown[]) => unknown }
    ).buildPromptMessages.bind(made);
    Object.assign(made, {
      ensureMariCliShim: async () => {},
      resolveConnection: async () => ({
        id: "mari-pi-runtime",
        name: "Regression",
        provider,
        model: "fake-model",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "",
        maxContext: 32768,
        defaultParameters,
      }),
      resolvePermissionsMode: async () => ({ mode, defaultMode: mode, source: "chat" }),
      buildPromptMessages: async (...args: unknown[]) => {
        runtimeSeen.push(args[4]);
        if (!stubPromptBuilder) return originalBuild(...args);
        return {
          messages: [
            { role: "system", content: "You are Professor Mari (regression).", contextKind: "prompt" },
            { role: "user", content: userText, contextKind: "history" },
          ],
          manualApprovalArmed: armed,
          heldCalls: [],
        };
      },
      runPiRuntime: async (args: Record<string, unknown>) => {
        piEntered += 1;
        return originalRunPi({
          ...args,
          maxToolRounds,
          onSession: (session: { getActiveToolNames(): string[] }, tools: Array<{ name: string }>) => {
            let closed = true;
            try {
              assertClosedToolSet(session as never, tools as never);
            } catch {
              closed = false;
            }
            sessionSeen = { active: session.getActiveToolNames(), closed };
          },
        });
      },
      chatCompleteWorkspace: async (
        _provider: unknown,
        messages: ChatMessage[],
        options: ChatOptions,
        onToken?: (chunk: string) => void,
      ) => {
        requests.push({ messages: structuredClone(messages), options });
        const next = script.shift();
        if (!next) throw new Error("The scripted provider ran out of replies.");
        return typeof next === "function" ? next(options, onToken) : next;
      },
    });
    return made;
  };
  const service = makeService(true);

  const start = async (
    name: string,
    nextScript: Scripted[],
    runtime: "pi" | "classic" = "pi",
    target: InstanceType<typeof ProfessorMariWorkspaceService> = service,
    chatId?: string,
    text = "Do the thing.",
  ) => {
    userText = text;
    script = [...nextScript];
    requests = [];
    runtimeSeen = [];
    piEntered = 0;
    sessionSeen = null;
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, runtime);
    const chat = chatId ? { id: chatId } : await chats.create({ name, mode: "conversation", characterIds: [] });
    const events: Array<{ type: string; data?: unknown }> = [];
    const done = target.prompt({ chatId: chat.id, text, onEvent: (event) => events.push(event) });
    return { chat, events, done };
  };
  const lastAssistant = async (chatId: string) => {
    const rows = (await chats.listMessages(chatId)).filter((message) => message.role === "assistant");
    const row = rows[rows.length - 1];
    return row
      ? { content: String(row.content), extra: JSON.parse(String(row.extra ?? "{}")) as Record<string, unknown> }
      : null;
  };
  const statusTexts = (events: Array<{ type: string; data?: unknown }>) =>
    events
      .filter((event) => event.type === "status")
      .map((event) =>
        typeof event.data === "string" ? event.data : String((event.data as { content?: string }).content),
      );

  // (a) + (f): a read tool call runs through WorkspaceCommands and its result reaches the next model request,
  // and the model is offered only Marinara's tools (their descriptions, never pi's built-ins).
  {
    mode = "auto";
    const { chat, done } = await start("pi read", [
      reply("Let me read it.", [{ id: "call-read", name: "read", args: { path: "hello.txt" } }]),
      reply("The file says hi."),
    ]);
    await done;
    assert.equal(piEntered, 1);
    assert.equal(requests.length, 2);
    const offered = requests[0]!.options.tools ?? [];
    const allowed = new Map<string, string>(
      WORKSPACE_TOOL_DEFINITIONS.map((tool) => [tool.name as string, tool.description]),
    );
    allowed.set(
      "suggestions",
      offered.find((tool) => tool.function.name === "suggestions")?.function.description ?? "",
    );
    allowed.set("plan", offered.find((tool) => tool.function.name === "plan")?.function.description ?? "");
    assert.deepEqual(offered.map((tool) => tool.function.name).sort(), [...allowed.keys()].sort());
    for (const tool of offered) assert.equal(tool.function.description, allowed.get(tool.function.name));
    assert.equal(requests[0]!.options.responseFormat, undefined);
    assert.equal(requests[0]!.options.reasoningEffort, undefined, "an unset connection sends no reasoning setting");
    assert.equal(requests[0]!.options.enableThinking, undefined);
    assert.ok(!requests[0]!.messages.some((m) => m.content.includes("workspace_command_protocol")));
    const toolMessage = toolMessages(requests[1]!.messages)[0];
    assert.equal(toolMessage?.tool_call_id, "call-read");
    assert.match(toolMessage?.content ?? "", /workspace_command_result name="read" success="true"/u);
    assert.match(toolMessage?.content ?? "", /hi from the workspace file/u);
    assert.equal((await lastAssistant(chat.id))?.content, "The file says hi.");
    // The real boundary: every ACTIVE tool of the session is one of Marinara's own definitions (pi keeps its
    // built-ins registered under the allowlist, but each Marinara tool replaces its namesake).
    assert.ok(sessionSeen, "the session inspection hook must run");
    const seen = sessionSeen as { active: string[]; closed: boolean };
    assert.deepEqual([...seen.active].sort(), [...allowed.keys()].sort());
    assert.equal(seen.closed, true);
  }

  // A verified claim survives the watermark as an exact terminal recap, including at the tool round limit.
  for (const atLimit of [false, true]) {
    mode = "auto";
    maxToolRounds = atLimit ? 2 : undefined;
    const path = `recap-${atLimit}.txt`;
    const claim = `I wrote ${path}.`;
    const { chat, events, done } = await start(`pi verified recap ${atLimit}`, [
      reply("", [{ id: "recap-write", name: "write", args: { path, content: "verified recap", reason: "t" } }]),
      reply(claim, [{ id: "recap-read", name: "read", args: { path } }]),
      reply(claim),
    ]);
    await done;
    maxToolRounds = undefined;
    assert.equal(requests.length, 3, "a verified recap must not trigger another repair round");
    assert.equal((await lastAssistant(chat.id))?.content.split("\n\n")[0], claim);
    assert.equal(
      statusTexts(events).some((text) => /Tool round limit reached/u.test(text)),
      atLimit,
    );
    assert.ok(!statusTexts(events).some((text) => /unsupported completion claim/u.test(text)));
  }

  // #7879 investigation proof: real Pi tool execution against the real store,
  // including a key added outside Mari between two runs. The provider is scripted;
  // this proves persistence when the calls are made, not the reporter's model behavior.
  {
    const { createLorebooksStorage } =
      await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
    const lorebooks = createLorebooksStorage(db);
    const lorebookId = "pi-lorebook-7879";
    const entries = Array.from({ length: 12 }, (_, index) => ({
      name: index === 0 ? "Duke Gunterlie" : `Entry ${index}`,
      content: `Lore for entry ${index}`,
      keys: [`entry-${index}`, "gunterlie"],
      secondaryKeys: ["gunterlie", `secondary-${index}`],
    }));
    const created = await start(
      "create lorebook 7879",
      [
        reply("", [
          {
            id: "create-7879",
            name: "app_data",
            args: {
              action: "lorebook.create",
              lorebookId,
              data: { name: "Pi lorebook proof", entries },
              apply: true,
            },
          },
        ]),
        reply("I created the lorebook with 12 entries.", [
          { id: "audit-created-7879", name: "app_data", args: { action: "lorebook.entries", lorebookId } },
        ]),
        // A fresh read after the creation audit cannot back a new deletion claim in this same run.
        reply("", [{ id: "recap-created-7879", name: "app_data", args: { action: "lorebook.entries", lorebookId } }]),
        reply("I deleted Duke Gunterlie."),
        reply("Duke Gunterlie is still present. No deletion was made."),
      ],
      "pi",
      service,
      undefined,
      "Create a lorebook with 12 entries.",
    );
    await created.done;
    assert.equal(requests.length, 5, "the later deletion claim must trigger a repair after the passed creation audit");
    assert.equal(
      (await lastAssistant(created.chat.id))?.content,
      "Duke Gunterlie is still present. No deletion was made.",
    );
    const before = await lorebooks.listEntries(lorebookId);
    assert.equal(before.length, 12, "Pi creates exactly the requested entry count");
    assert.equal((await lorebooks.countAllEntriesByLorebook())[lorebookId], 12);
    const duke = before.find((entry) => entry.name === "Duke Gunterlie")!;
    const keys = [...duke.keys, "wardrobe"];
    await lorebooks.updateEntry(duke.id, { keys }); // Same store path used by manual editing.
    const duplicate = await start(
      "existing wardrobe",
      [
        reply("", [
          {
            id: "wardrobe-7879",
            name: "app_data",
            args: {
              action: "lorebook.updateEntry",
              entryId: duke.id,
              patch: { keys },
              apply: true,
            },
          },
        ]),
        reply("The wardrobe key is already present; nothing needed changing."),
      ],
      "pi",
      service,
      created.chat.id,
      "Add the wardrobe primary key to Duke Gunterlie.",
    );
    await duplicate.done;
    assert.match(
      toolMessages(requests[1]!.messages)[0]?.content ?? "",
      /No changes: every row already has these values/,
    );
    assert.deepEqual((await lorebooks.getEntry(duke.id))?.keys, keys);
    // A read that still shows Duke cannot prove the model's claim that it deleted him.
    const falseDeletion = await start(
      "unsupported deletion claim",
      [
        reply("", [
          {
            id: "read-duke-7879",
            name: "app_data",
            args: {
              action: "lorebook.getEntry",
              entryId: duke.id,
            },
          },
        ]),
        reply("I deleted Duke Gunterlie."),
        reply("Duke Gunterlie is still present. No deletion was made."),
      ],
      "pi",
      service,
      created.chat.id,
      "Delete Duke Gunterlie.",
    );
    await falseDeletion.done;
    assert.equal(
      (await lastAssistant(created.chat.id))?.content,
      "Duke Gunterlie is still present. No deletion was made.",
    );
    assert.ok(await lorebooks.getEntry(duke.id), "a read-only run never deleted the entry");
    const deleted = await start(
      "delete Duke and keys",
      [
        reply("", [
          {
            id: "delete-duke-7879",
            name: "app_data",
            args: {
              action: "lorebook.deleteEntry",
              entryId: duke.id,
              apply: true,
            },
          },
          ...before
            .filter((entry) => entry.id !== duke.id)
            .map((entry) => ({
              id: `strip-${entry.id}`,
              name: "app_data",
              args: {
                action: "lorebook.updateEntry",
                entryId: entry.id,
                apply: true,
                patch: {
                  keys: entry.keys.filter((key) => key !== "gunterlie"),
                  secondaryKeys: entry.secondaryKeys.filter((key) => key !== "gunterlie"),
                },
              },
            })),
        ]),
        reply("Deleted Duke Gunterlie and removed the gunterlie keys from the remaining entries."),
      ],
      "pi",
      service,
      created.chat.id,
      "Delete Duke Gunterlie and remove all gunterlie primary and secondary keys.",
    );
    await deleted.done;
    assert.equal(await lorebooks.getEntry(duke.id), null);
    const remaining = await lorebooks.listEntries(lorebookId);
    assert.equal(remaining.length, 11);
    assert.equal((await lorebooks.countAllEntriesByLorebook())[lorebookId], 11);
    for (const entry of remaining) {
      assert.equal(entry.keys.includes("gunterlie"), false);
      assert.equal(entry.secondaryKeys.includes("gunterlie"), false);
    }
  }

  // The boundary check fails closed when an active tool is not Marinara's.
  {
    const mine = { name: "read", execute: async () => ({}) };
    const piBuiltIn = { name: "read", execute: async () => ({}) };
    assert.throws(
      () =>
        assertClosedToolSet(
          { getActiveToolNames: () => ["read"], getToolDefinition: () => piBuiltIn } as never,
          [mine] as never,
        ),
      /not one of Professor Mari's own tools/u,
    );
    assert.throws(
      () =>
        assertClosedToolSet(
          { getActiveToolNames: () => ["grep"], getToolDefinition: () => undefined } as never,
          [mine] as never,
        ),
      /not one of Professor Mari's own tools/u,
    );
  }

  // Provider replay metadata (Anthropic thinking, Gemini parts, ...) rides back on the assistant message.
  {
    mode = "auto";
    const metadata = { anthropicThinking: [{ type: "thinking", thinking: "plan", signature: "sig" }] };
    const { done } = await start("pi metadata", [
      reply("", [{ id: "call-meta", name: "read", args: { path: "hello.txt" } }], metadata),
      reply("Done."),
    ]);
    await done;
    const replayed = requests[1]!.messages.find(
      (message) => message.role === "assistant" && message.tool_calls?.length,
    );
    assert.deepEqual(replayed?.providerMetadata, metadata);
  }

  // (b) Manual: a described mutation is held, not executed; the stored message carries the flag and the held change.
  {
    mode = "manual";
    const { chat, events, done } = await start("pi manual", [
      reply("I will create made.txt. Shall I go ahead?", [
        { id: "call-write", name: "write", args: { path: "made.txt", content: "x", reason: "test" } },
      ]),
      reply("This second reply must never be requested."),
    ]);
    await done;
    assert.equal(existsSync(join(workspaceDir, "made.txt")), false, "a held change must not run");
    assert.equal(requests.length, 1, "the run ends as a deferral after the round");
    const saved = await lastAssistant(chat.id);
    assert.equal(saved?.extra.mariDeferredMutations, true);
    const held = saved?.extra.mariHeldChanges as Array<Record<string, unknown>> | undefined;
    assert.equal(held?.length, 1, "the held change is stored for the Accept card");
    assert.match(JSON.stringify(held), /made\.txt/u);
    assert.match(saved?.content ?? "", /Shall I go ahead/u);
    assert.ok(
      events.some((event) => event.type === "suggestions"),
      "the Accept chip is sent",
    );
  }

  // (c) Plan: a mutation is refused by the executor floor and the model sees the refusal.
  {
    mode = "plan";
    const { chat, done } = await start("pi plan", [
      reply("", [{ id: "call-plan-write", name: "write", args: { path: "planned.txt", content: "x", reason: "t" } }]),
      reply("I would create planned.txt."),
    ]);
    await done;
    assert.equal(existsSync(join(workspaceDir, "planned.txt")), false);
    assert.match(toolMessages(requests[1]!.messages)[0]?.content ?? "", /Plan mode is active/u);
    assert.equal((await lastAssistant(chat.id))?.extra.mariDeferredMutations, undefined);
  }

  // Bypass: the same described mutation runs without a hold.
  {
    mode = "bypass";
    const { chat, done } = await start("pi bypass", [
      reply("I will create bypass.txt. Shall I?", [
        { id: "call-bypass", name: "write", args: { path: "bypass.txt", content: "x", reason: "test" } },
      ]),
      reply("Created bypass.txt."),
    ]);
    await done;
    assert.equal(existsSync(join(workspaceDir, "bypass.txt")), true, "Bypass never holds");
    assert.equal((await lastAssistant(chat.id))?.extra.mariDeferredMutations, undefined);
  }

  // Manual + a mutating call with NO words (a thinking model): held, never refused; the Accept run then applies it.
  {
    mode = "manual";
    const silentWrite = (id: string) =>
      reply("", [{ id, name: "write", args: { path: "silent.txt", content: "x", reason: "test" } }]);
    const held = await start("pi manual silent", [silentWrite("silent-1"), reply("This must never be requested.")]);
    await held.done;
    assert.equal(existsSync(join(workspaceDir, "silent.txt")), false, "an un-approved silent mutation must not run");
    assert.equal(requests.length, 1, "one model request is spent on the held round");
    const saved = await lastAssistant(held.chat.id);
    assert.equal(saved?.extra.mariDeferredMutations, true);
    assert.match(JSON.stringify(saved?.extra.mariHeldChanges), /silent\.txt/u);
    assert.ok(held.events.some((event) => event.type === "suggestions"));
    assert.ok(!statusTexts(held.events).some((text) => /same app_data error|write error/u.test(text)));
    // The run right after the user's Accept (armed) applies the same silent call.
    armed = true;
    const accepted = await start(
      "pi manual accept",
      [silentWrite("silent-2"), reply("Applied silent.txt.")],
      "pi",
      service,
      held.chat.id,
    );
    await accepted.done;
    armed = false;
    assert.equal(existsSync(join(workspaceDir, "silent.txt")), true, "the armed run applies the change");
    assert.equal((await lastAssistant(held.chat.id))?.extra.mariDeferredMutations, undefined);
  }

  // The Accept run (armed) applies a call that comes with ordinary words, once, and is not held again.
  {
    mode = "manual";
    const writeCall = (id: string) => ({
      id,
      name: "write",
      args: { path: "armed.txt", content: "x", reason: "test" },
    });
    const held = await start("pi armed", [reply("I will create armed.txt. Shall I go ahead?", [writeCall("armed-1")])]);
    await held.done;
    assert.equal(existsSync(join(workspaceDir, "armed.txt")), false);
    const savedHeld = await lastAssistant(held.chat.id);
    assert.match(String(savedHeld?.extra.mariWorkspaceContinuity), /armed\.txt/u, "the held call is in the continuity");
    assert.match(String(savedHeld?.extra.mariWorkspaceContinuity), /HELD for the user's approval/u);
    armed = true;
    const secondCall = { id: "armed-3", name: "write", args: { path: "armed-b.txt", content: "y", reason: "test" } };
    const accepted = await start(
      "pi armed accept",
      [
        reply("Approved, creating armed.txt.", [writeCall("armed-2")]),
        reply("Now also armed-b.txt.", [secondCall]),
        reply("This must never be requested."),
      ],
      "pi",
      service,
      held.chat.id,
      "I accept the proposed change.",
    );
    await accepted.done;
    assert.equal(existsSync(join(workspaceDir, "armed.txt")), true, "round 1 applies the accepted call");
    assert.equal(toolMessages(requests[1]!.messages).length, 1);
    assert.equal(existsSync(join(workspaceDir, "armed-b.txt")), false, "a second, new mutation is held");
    assert.equal(requests.length, 2, "the run ends as a new deferral");
    const savedAgain = await lastAssistant(held.chat.id);
    assert.equal(savedAgain?.extra.mariDeferredMutations, true);
    assert.match(JSON.stringify(savedAgain?.extra.mariHeldChanges), /armed-b\.txt/u);
    // An armed run that only CLAIMS it is done, with no call, is sent back instead of being accepted.
    const claim = await start(
      "pi armed claim",
      [reply("I have updated armed2.txt for you."), reply("I have not changed anything yet.")],
      "pi",
      service,
      held.chat.id,
    );
    await claim.done;
    armed = false;
    assert.equal(requests.length, 2);
    assert.match(
      requests[1]!.messages.filter((m) => m.role === "user").pop()?.content ?? "",
      /no mutating command succeeded/u,
    );
  }

  // A held-change claim on a run that held nothing is sent back once, then replaced by an honest line.
  {
    mode = "auto";
    for (const text of [
      "I have changes ready. Review them below and accept to apply them; nothing was applied yet.",
      "Held for your review — the change card is ready.",
      "The change is staged and waiting for your approval.",
      "The rename is held for review.",
    ])
      assert.equal(workspaceTextClaimsHeldChange(text), true, text);
    for (const text of [
      "The character card has a tag field you can edit.",
      "I read the card and the lorebook; here is what they say.",
      "Want me to make that change?",
      "I'm waiting for your approval to continue.",
    ])
      assert.equal(workspaceTextClaimsHeldChange(text), false, text);
    const readCall = (id: string) => ({ id, name: "read", args: { path: "hello.txt" } });
    const { chat, done } = await start("pi held claim", [
      reply("", [readCall("held-r1")]),
      reply("Held for your review — the change card is ready."),
      reply("I read the file; no change was made."),
    ]);
    await done;
    assert.equal(requests.length, 3, "exactly one repair request");
    assert.match(requests[2]!.messages.filter((m) => m.role === "user").pop()?.content ?? "", /Nothing is held/u);
    const stored = await lastAssistant(chat.id);
    assert.equal(stored?.content, "I read the file; no change was made.");
    assert.doesNotMatch(stored?.content ?? "", /Held for your review/u);

    // The model repeats the claim after the repair: the honest line replaces it, with no further request.
    const repeated = await start("pi held claim repeated", [
      reply("", [readCall("held-r2")]),
      reply("Held for your review — the change card is ready."),
      reply("Held for your review — the change card is ready."),
    ]);
    await repeated.done;
    assert.equal(requests.length, 3);
    assert.match((await lastAssistant(repeated.chat.id))?.content ?? "", /did not make or hold any change/u);
  }

  // (d) Abort stops the run immediately: no tool starts, no further request.
  {
    mode = "auto";
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => (started = resolve));
    const { events, done } = await start("pi abort", [
      (options) => {
        started();
        return new Promise<ChatCompletionResult>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new Error("Request aborted")), { once: true });
        });
      },
      reply("This reply must never be requested."),
    ]);
    await requestStarted;
    await service.abort();
    await done;
    assert.equal(requests.length, 1);
    assert.ok(!events.some((event) => event.type === "tool_start"));
    assert.equal((await service.status(null, null)).active, false);
  }

  // (g) A completion claim with no mutation is sent back to the model as a repair message.
  {
    mode = "auto";
    const { chat, done } = await start("pi claim", [
      reply("I have updated the character card and saved it."),
      reply("I did not change anything yet.."),
    ]);
    await done;
    assert.equal(requests.length, 2);
    const repair = requests[1]!.messages.filter((message) => message.role === "user").pop();
    assert.match(repair?.content ?? "", /no mutating command succeeded/u);
    assert.match((await lastAssistant(chat.id))?.content ?? "", /did not change anything/u);
  }

  // A model that repeats one invalid tool call is stopped by the repeated-failure rule (pi answers such calls itself).
  {
    mode = "auto";
    const bad = (n: number) => reply("", [{ id: `bad-${n}`, name: "no_such_tool", args: {} }]);
    const { events, done } = await start("pi repeated invalid", [bad(1), bad(2), bad(3), bad(4), bad(5), bad(6)]);
    await done;
    assert.equal(requests.length, MAX_REPEATED_COMMAND_FAILURES, "the third identical failure stops the run");
    assert.ok(statusTexts(events).some((text) => /same no_such_tool error/u.test(text)));
  }

  // Ask-latch: a question in a turn whose only call pi rejects still binds the run, so a silent write next round is refused.
  {
    mode = "auto";
    const { done } = await start("pi ask latch", [
      reply("Shall I save it now?", [{ id: "call-bad", name: "no_such_tool", args: {} }]),
      reply("", [{ id: "call-silent", name: "write", args: { path: "latched.txt", content: "x", reason: "t" } }]),
      reply("I will wait for your answer."),
    ]);
    await done;
    assert.equal(existsSync(join(workspaceDir, "latched.txt")), false, "a silent write after asking must not run");
    assert.match(toolMessages(requests[2]!.messages).pop()?.content ?? "", /already asked the user for approval/u);
  }

  // The same question next to a rejected call AND a write holds the write and ends the run.
  {
    mode = "auto";
    const { chat, done } = await start("pi ask hold", [
      reply("Shall I save it now?", [
        { id: "call-bad2", name: "no_such_tool", args: {} },
        { id: "call-write2", name: "write", args: { path: "held.txt", content: "x", reason: "t" } },
      ]),
      reply("This reply must never be requested."),
    ]);
    await done;
    assert.equal(existsSync(join(workspaceDir, "held.txt")), false);
    assert.equal(requests.length, 1);
    assert.equal((await lastAssistant(chat.id))?.extra.mariDeferredMutations, true);
  }

  // The tool round cap also counts rounds that only show chips next to a rejected call.
  {
    mode = "auto";
    maxToolRounds = 2;
    const chips = [{ label: "Yes", prompt: "Yes, go on." }];
    const { chat, events, done } = await start("pi cap", [
      reply("", [
        { id: "cap-1a", name: "suggestions", args: { chips } },
        { id: "cap-1b", name: "bad_one", args: {} },
      ]),
      reply("", [
        { id: "cap-2a", name: "suggestions", args: { chips } },
        { id: "cap-2b", name: "bad_two", args: {} },
      ]),
      // The final summary turn: no tools offered, and a call in it never runs.
      reply("Here is what I found.", [
        { id: "cap-3", name: "write", args: { path: "cap.txt", content: "x", reason: "t" } },
      ]),
    ]);
    await done;
    maxToolRounds = undefined;
    assert.equal(requests.length, 3);
    assert.equal(requests[2]!.options.tools, undefined);
    assert.equal(existsSync(join(workspaceDir, "cap.txt")), false);
    assert.match((await lastAssistant(chat.id))?.content ?? "", /^Here is what I found\./u);
    assert.ok(statusTexts(events).some((text) => /Tool round limit reached/u.test(text)));
  }

  // A final answer with chips is one model request, and the stored answer is the first text.
  {
    mode = "auto";
    const { chat, events, done } = await start("pi chips", [
      reply("Here is your answer.", [
        { id: "chips-1", name: "suggestions", args: { chips: [{ label: "More", prompt: "Tell me more." }] } },
      ]),
      reply("A second answer that must never be requested."),
    ]);
    await done;
    assert.equal(requests.length, 1);
    assert.equal((await lastAssistant(chat.id))?.content, "Here is your answer.");
    assert.ok(events.some((event) => event.type === "suggestions"));
  }

  // Chips with no words are not the answer yet: the run goes on, keeps the chips and stores the next text.
  {
    mode = "auto";
    const { chat, events, done } = await start("pi chips first", [
      reply("", [
        { id: "chips-2", name: "suggestions", args: { chips: [{ label: "More", prompt: "Tell me more." }] } },
      ]),
      reply("Now the answer."),
    ]);
    await done;
    assert.equal(requests.length, 2);
    assert.equal((await lastAssistant(chat.id))?.content, "Now the answer.");
    assert.ok(events.some((event) => event.type === "suggestions"));
  }

  // The connection's own reasoning setting reaches a pi run; classic keeps forcing it off.
  {
    mode = "auto";
    defaultParameters = JSON.stringify({ reasoningEffort: "medium" });
    const pi = await start("pi reasoning", [reply("Thought about it.")]);
    await pi.done;
    assert.equal(requests[0]!.options.reasoningEffort, "medium");
    assert.equal(requests[0]!.options.enableThinking, true);
    const classic = await start(
      "classic reasoning",
      [reply(JSON.stringify({ say: "Classic.", commands: [], stop: true }))],
      "classic",
    );
    await classic.done;
    defaultParameters = null;
    assert.equal(requests[0]!.options.reasoningEffort, "none");
    assert.equal(requests[0]!.options.enableThinking, undefined);
  }

  // (e) With mariRuntime = classic the pi path is never entered and the JSON protocol is used.
  {
    mode = "auto";
    const { done } = await start(
      "classic",
      [reply(JSON.stringify({ say: "Plain classic answer.", commands: [], stop: true }))],
      "classic",
    );
    await done;
    assert.equal(piEntered, 0, "classic must not enter the pi runtime");
    assert.deepEqual(runtimeSeen, ["classic"]);
    assert.equal(requests[0]!.options.tools, undefined);
  }

  // Textual mode: a connection without native tool calls runs pi with the calls written as text.
  {
    const call = (name: string, args: Record<string, unknown>) =>
      `<tool_call>${JSON.stringify({ name, arguments: args })}</tool_call>`;
    mode = "auto";
    provider = "claude_subscription";
    const read = await start("textual read", [
      reply(`Reading it.\n${call("read", { path: "hello.txt" })}`),
      reply("The file says hi."),
    ]);
    await read.done;
    assert.equal(piEntered, 1, "pi runs on a connection without native tool calls");
    assert.deepEqual(runtimeSeen, ["pi"]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.options.tools, undefined);
    assert.equal(requests[0]!.options.toolChoice, undefined);
    const system = requests[0]!.messages.find((message) => message.role === "system")?.content ?? "";
    assert.match(system, /<text_tool_calls>/u);
    assert.match(system, /"name":"ls"/u);
    assert.match(system, /- suggestions:/u);
    for (const request of requests) {
      assert.ok(!request.messages.some((message) => message.role === "tool" || message.tool_calls));
    }
    const replayed = requests[1]!.messages.filter((message) => message.role !== "system");
    assert.deepEqual(
      replayed.map((message) => message.role),
      ["user", "assistant", "user"],
    );
    assert.match(replayed[1]!.content, /<tool_call>\{"name":"read"/u);
    assert.match(replayed[2]!.content, /workspace_command_result name="read" success="true"/u);
    assert.match(replayed[2]!.content, /hi from the workspace file/u);
    assert.equal((await lastAssistant(read.chat.id))?.content, "The file says hi.");
    assert.ok(!JSON.stringify(read.events).includes("tool_call"), "the call text never reaches the user");

    // DeepSeek V4 writes its own call markup as text, with spaced identifiers ("app data", "lorebook get entry").
    const dsml = await start("textual dsml", [
      reply(
        'Reading it.\n<｜DSML｜tool_calls>\n<｜DSML｜invoke name="read">\n<｜DSML｜parameter name="path" string="true">hello.txt</｜DSML｜parameter>\n</｜DSML｜invoke>\n</｜DSML｜tool_calls>',
      ),
      reply("The file says hi."),
    ]);
    await dsml.done;
    assert.equal(requests.length, 2, "the DSML call ran and the run continued");
    assert.match(requests[1]!.messages.at(-1)!.content, /hi from the workspace file/u);
    assert.ok(!JSON.stringify(dsml.events).includes("DSML"), "the markup never reaches the user");
    const [spaced] = parseTextualToolCalls(
      '<｜DSML｜tool_calls><｜DSML｜invoke name="app data"><｜DSML｜parameter name="action" string="true">lorebook get entry</｜DSML｜parameter><｜DSML｜parameter name="apply" string="false">true</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>',
      [{ type: "function", function: { name: "app_data", description: "", parameters: {} } }],
    );
    assert.equal(spaced?.function.name, "app_data");
    assert.deepEqual(JSON.parse(spaced!.function.arguments), { action: "lorebook.getEntry", apply: true });

    // Other models' call markup: each format reads as one known call and strips to the prose.
    const readTool = [{ type: "function" as const, function: { name: "read", description: "", parameters: {} } }];
    const markupCases: Array<[string, string]> = [
      [
        "deepseek",
        '<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function<｜tool▁sep｜>read\n```json\n{"path":"a.txt"}\n```<｜tool▁call▁end｜><｜tool▁calls▁end｜>',
      ],
      [
        "kimi",
        '<|tool_calls_section_begin|><|tool_call_begin|>functions.read:0<|tool_call_argument_begin|>{"path":"a.txt"}<|tool_call_end|><|tool_calls_section_end|>',
      ],
      ["glm", "<tool_call>read\n<arg_key>path</arg_key>\n<arg_value>a.txt</arg_value>\n</tool_call>"],
      ["qwen", "<tool_call>\n<function=read>\n<parameter=path>\na.txt\n</parameter>\n</function>\n</tool_call>"],
      ["qwen bare", "<function=read>\n<parameter=path>\na.txt\n</parameter>\n</function>"],
      [
        "minimax",
        '<minimax:tool_call>\n<invoke name="read">\n<parameter name="path">a.txt</parameter>\n</invoke>\n</minimax:tool_call>',
      ],
      ["mistral", '[TOOL_CALLS]read[ARGS]{"path":"a.txt"}'],
      ["mistral list", '[TOOL_CALLS][{"name":"read","arguments":{"path":"a.txt"}}]'],
    ];
    for (const [label, markup] of markupCases) {
      const [parsed, ...more] = parseTextualToolCalls(`Looking.\n${markup}`, readTool);
      assert.equal(parsed?.function.name, "read", `${label}: name`);
      assert.equal(more.length, 0, `${label}: one call`);
      assert.deepEqual(JSON.parse(parsed!.function.arguments), { path: "a.txt" }, `${label}: arguments`);
      assert.equal(stripTextualToolCalls(`Looking.\n${markup}`, readTool), "Looking.", `${label}: strip`);
    }
    assert.equal(parseTextualToolCalls("Use the read tool.", readTool).length, 0);
    assert.equal(
      parseTextualToolCalls("<tool_call>nope\n<arg_key>a</arg_key><arg_value>b</arg_value></tool_call>", readTool)
        .length,
      0,
    );
    assert.equal(
      parseTextualToolCalls('<tool_call>{"name":"read","arguments":{"path":"a.txt"}}</tool_call>', readTool).length,
      1,
    );

    // Two unclosed GLM calls must not merge into one; a literal [TOOL_CALLS] in prose is not a call.
    const twoGlm =
      "<tool_call>read\n<arg_key>path</arg_key><arg_value>A</arg_value>\n<tool_call>read\n<arg_key>path</arg_key><arg_value>B</arg_value>";
    assert.equal(parseTextualToolCalls(twoGlm, readTool).length, 0);
    assert.equal(parseTextualToolCalls(`${twoGlm}</tool_call>`, readTool).length, 1);
    assert.equal(parseTextualToolCalls('Say [TOOL_CALLS] then x [{"name":"read","arguments":{}}]', readTool).length, 0);
    assert.equal(
      stripTextualToolCalls('Say [TOOL_CALLS]nope[ARGS]{"a":1} now\n[TOOL_CALLS]read[ARGS]{"path":"a"} tail', readTool),
      'Say [TOOL_CALLS]nope[ARGS]{"a":1} now\n tail',
    );

    // Parsing and stripping stay linear on adversarial input (ReDoS).
    const pairs = "<arg_key>k</arg_key><arg_value>v</arg_value>".repeat(30);
    const adversarial: Array<[string, string]> = [
      ["glm bad tail", `<tool_call>read ${pairs} tail`],
      ["fence spaces", `\`\`\`${" ".repeat(20000)}`],
      ["deepseek spaces", `<｜tool▁sep｜>read\`\`\`json${" ".repeat(20000)}`],
      ["deepseek sep spaces", `<｜tool▁sep｜>${" ".repeat(20000)}`],
      ["prose", "The quick brown fox jumps over the lazy dog. ".repeat(4500)],
      ...[
        "<｜tool▁sep｜>read```",
        "<|tool_call_begin|>read<|tool_call_argument_begin|>",
        "<tool_call>read ",
        "<function=read>",
        "<parameter=a>",
        '<minimax:tool_call><invoke name="read"><parameter name="a">',
        "[TOOL_CALLS]",
        "<tool_code>",
        "<|python_tag|>",
        '<｜DSML｜tool_calls><｜DSML｜invoke name="read"><｜DSML｜parameter name="a">',
        "<arg_key>",
        "```",
      ].map((open): [string, string] => [`open ${open.slice(0, 20)}`, open.repeat(2000)]),
    ];
    let slowest = 0;
    for (const [label, input] of adversarial) {
      for (const [op, run] of [
        ["parse", () => parseTextualToolCalls(input, readTool)],
        ["strip", () => stripTextualToolCalls(input, readTool)],
      ] as const) {
        const startedAt = performance.now();
        run();
        const ms = performance.now() - startedAt;
        assert.ok(ms < 250, `${label} ${op} took ${Math.round(ms)} ms`);
        slowest = Math.max(slowest, ms);
      }
    }
    console.log(`Adversarial parser inputs: slowest call ${Math.round(slowest)} ms.`);

    // Understood request (#5740) on pi: the round's words, the mutating command, then the observed outcome.
    const write = await start("textual write", [
      reply(`Creating it.\n${call("write", { path: "textual.txt", content: "x", reason: "t" })}`),
      reply("Created textual.txt."),
    ]);
    await write.done;
    assert.equal(existsSync(join(workspaceDir, "textual.txt")), true);
    const record = (service as unknown as { latestUnderstoodRequest: Record<string, unknown> }).latestUnderstoodRequest;
    assert.equal(record.text, "Creating it.");
    assert.deepEqual(record.commands, ["write"]);
    assert.equal(record.outcome, "applied");
    assert.ok(record.messageId, "the record is bound to the saved message");

    mode = "manual";
    const held = await start("textual manual", [
      reply(
        `I will create it. Shall I go ahead?\n${call("write", { path: "textual-held.txt", content: "x", reason: "t" })}`,
      ),
      reply("This reply must never be requested."),
    ]);
    await held.done;
    assert.equal(existsSync(join(workspaceDir, "textual-held.txt")), false, "a held textual call must not run");
    assert.equal(requests.length, 1);
    assert.equal((await lastAssistant(held.chat.id))?.extra.mariDeferredMutations, true);
    assert.equal(
      (service as unknown as { latestUnderstoodRequest: Record<string, unknown> }).latestUnderstoodRequest.outcome,
      "held",
    );
    provider = "custom";
    mode = "auto";

    // The pi adapter itself never parses text on a native connection. (The OpenAI provider layer does read
    // <tool_call> tags and json fences when tools were sent; this mock bypasses it, so that is not covered here.)
    const quoted = await start("native quoted", [
      reply(`Here is the format: ${call("write", { path: "quoted.txt", content: "x", reason: "t" })}`),
    ]);
    await quoted.done;
    assert.equal(existsSync(join(workspaceDir, "quoted.txt")), false);
    assert.equal(requests.length, 1);
    assert.match((await lastAssistant(quoted.chat.id))?.content ?? "", /Here is the format/u);
  }

  // The status reports the selected and the active runtime.
  {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, "pi");
    const status = await service.status(null, null);
    assert.equal(status.runtimeSelected, "pi");
    assert.equal(status.runtimeActive, "pi");
  }

  // An answer that ends on a question with no chips gets one chips-only round; its words and other calls are dropped.
  {
    mode = "auto";
    const { events, chat, done } = await start("chip round", [
      reply("Do you want a short version or a long one?"),
      reply("Extra words.", [
        { id: "chipfix-1", name: "suggestions", args: { chips: [{ label: "Short", prompt: "Short version." }] } },
        { id: "chipfix-2", name: "write", args: { path: "chip-round.txt", content: "x", reason: "test" } },
      ]),
    ]);
    await done;
    assert.equal(requests.length, 2, "one chips-only round");
    assert.ok(events.some((event) => event.type === "suggestions"));
    assert.equal(existsSync(join(workspaceDir, "chip-round.txt")), false, "no work runs in the chips-only round");
    assert.equal((await lastAssistant(chat.id))?.content, "Do you want a short version or a long one?");
  }

  // Accept (the exact chip prompt) applies the stored held calls server-side with no model request, on both runtimes.
  {
    const realService = makeService(false);
    const acceptPrompt = "I accept the proposed change.";
    const heldFrame = (file: string) =>
      JSON.stringify({
        say: `I will create ${file}. Shall I go ahead?`,
        commands: [{ name: "write", arguments: { path: file, content: "x", reason: "test" } }],
        stop: false,
      });
    for (const runtime of ["pi", "classic"] as const) {
      mode = "manual";
      const file = `accepted-${runtime}.txt`;
      const holdReply =
        runtime === "pi"
          ? reply(`I will create ${file}. Shall I go ahead?`, [
              { id: "acc-1", name: "write", args: { path: file, content: "x", reason: "test" } },
            ])
          : reply(heldFrame(file));
      const held = await start(`accept ${runtime}`, [holdReply], runtime, realService);
      await held.done;
      assert.equal(existsSync(join(workspaceDir, file)), false, `${runtime}: held`);
      assert.equal(
        (((await lastAssistant(held.chat.id))?.extra.mariHeldCalls as unknown[]) ?? []).length,
        1,
        `${runtime}: the raw held call is stored`,
      );
      const accepted = await start("unused", [], runtime, realService, held.chat.id, acceptPrompt);
      await accepted.done;
      assert.equal(requests.length, 0, `${runtime}: Accept makes no model request`);
      assert.equal(existsSync(join(workspaceDir, file)), true, `${runtime}: the stored call is applied`);
      const saved = await lastAssistant(held.chat.id);
      assert.equal(saved?.content, "Done. I applied the change you accepted.");
      assert.equal(saved?.extra.mariDeferredMutations, undefined, `${runtime}: not a deferral`);
      assert.equal(saved?.extra.mariHeldCalls, undefined);
      assert.equal(
        (saved?.extra.generationInfo as { usage?: unknown } | undefined)?.usage,
        undefined,
        `${runtime}: no usage for a run with no model request`,
      );

      // Accept after switching to Plan: the executor floor refuses and the answer says so.
      const planFile = `accepted-plan-${runtime}.txt`;
      const heldAgain = await start(
        `accept plan ${runtime}`,
        [
          runtime === "pi"
            ? reply(`I will create ${planFile}. Shall I go ahead?`, [
                { id: "acc-2", name: "write", args: { path: planFile, content: "x", reason: "test" } },
              ])
            : reply(heldFrame(planFile)),
        ],
        runtime,
        realService,
      );
      await heldAgain.done;
      mode = "plan";
      const refused = await start("unused", [], runtime, realService, heldAgain.chat.id, acceptPrompt);
      await refused.done;
      assert.equal(requests.length, 0);
      assert.equal(existsSync(join(workspaceDir, planFile)), false, `${runtime}: Plan still refuses`);
      assert.match(
        (await lastAssistant(heldAgain.chat.id))?.content ?? "",
        /^I could not apply everything you accepted\./u,
      );

      // A typed "yes" still goes to the model with the armed pass.
      mode = "manual";
      const typedFile = `accepted-typed-${runtime}.txt`;
      const heldTyped = await start(
        `accept typed ${runtime}`,
        [
          runtime === "pi"
            ? reply(`I will create ${typedFile}. Shall I go ahead?`, [
                { id: "acc-3", name: "write", args: { path: typedFile, content: "x", reason: "test" } },
              ])
            : reply(heldFrame(typedFile)),
        ],
        runtime,
        realService,
      );
      await heldTyped.done;
      const typed = await start(
        "unused",
        [runtime === "pi" ? reply("Okay, noted.") : reply(JSON.stringify({ say: "Okay, noted.", stop: true }))],
        runtime,
        realService,
        heldTyped.chat.id,
        "yes",
      );
      await typed.done;
      assert.equal(requests.length, 1, `${runtime}: a typed reply goes to the model`);

      // More held calls than the card lists: Accept goes to the model, nothing is applied unseen.
      const many = Array.from({ length: 9 }, (_, index) => ({
        path: `accepted-many-${runtime}-${index}.txt`,
        content: "x",
        reason: "test",
      }));
      const heldMany = await start(
        `accept many ${runtime}`,
        [
          runtime === "pi"
            ? reply(
                "I will create nine files. Shall I go ahead?",
                many.map((args, index) => ({ id: `many-${index}`, name: "write", args })),
              )
            : reply(
                JSON.stringify({
                  say: "I will create nine files. Shall I go ahead?",
                  commands: many.map((args) => ({ name: "write", arguments: args })),
                  stop: false,
                }),
              ),
        ],
        runtime,
        realService,
      );
      await heldMany.done;
      const manyAccepted = await start(
        "unused",
        [runtime === "pi" ? reply("Okay, noted.") : reply(JSON.stringify({ say: "Okay, noted.", stop: true }))],
        runtime,
        realService,
        heldMany.chat.id,
        acceptPrompt,
      );
      await manyAccepted.done;
      assert.equal(requests.length, 1, `${runtime}: nine held calls are not applied by the server`);
      assert.equal(existsSync(join(workspaceDir, many[8]!.path)), false);
    }
  }

  // Classic parity: empty-answer retries, Gemini malformed calls, internal names, truncated changes, duplicates.
  {
    mode = "auto";
    const empty = await start("pi empty", [reply(""), reply("Now the answer.")]);
    await empty.done;
    assert.equal(requests.length, 2);
    assert.match(requests[1]!.messages.at(-1)?.content ?? "", /previous response was empty/u);
    assert.equal((await lastAssistant(empty.chat.id))?.content, "Now the answer.");
    const emptyAlways = await start("pi empty always", [reply(""), reply(""), reply(""), reply("never")]);
    await emptyAlways.done;
    assert.equal(requests.length, 3, "two retries, then the note");
    assert.ok(statusTexts(emptyAlways.events).some((text) => /kept returning an empty response/u.test(text)));

    const { GeminiNoContentError } =
      await import("../../../packages/server/src/services/llm/providers/google.provider.js");
    const gemini = await start("pi gemini", [
      async () => {
        throw new GeminiNoContentError("MALFORMED_FUNCTION_CALL");
      },
      reply("Recovered."),
    ]);
    await gemini.done;
    assert.equal(requests.length, 2);
    assert.equal((await lastAssistant(gemini.chat.id))?.content, "Recovered.");

    const names = await start("pi names", [
      reply("I ran chat.diagnose for you.", [
        { id: "scrub-1", name: "suggestions", args: { chips: [{ label: "Run chat.diagnose", prompt: "Go." }] } },
      ]),
    ]);
    await names.done;
    assert.equal((await lastAssistant(names.chat.id))?.content, "I ran the chat checkup for you.");
    assert.ok(
      JSON.stringify(names.events.filter((event) => event.type === "suggestions")).includes("Run the chat checkup"),
    );

    const cut = await start("pi cut", [
      {
        ...reply("Partial", [{ id: "cut-1", name: "write", args: { path: "cut.txt", content: "x", reason: "t" } }]),
        finishReason: "length",
      },
    ]);
    await cut.done;
    assert.equal(existsSync(join(workspaceDir, "cut.txt")), false);
    assert.ok(JSON.stringify(cut.events).includes("Continue the task."), "a cut-off change offers a continue chip");

    const twice = await start("pi duplicate", [
      reply("", [
        { id: "dup-1", name: "read", args: { path: "hello.txt" } },
        { id: "dup-2", name: "read", args: { path: "hello.txt" } },
      ]),
      reply("Done."),
    ]);
    await twice.done;
    const results = toolMessages(requests[1]!.messages).map((message) => message.content);
    assert.equal(results.length, 2);
    assert.equal(results.filter((content) => /workspace_command_result/u.test(content)).length, 1);
    assert.equal(results.filter((content) => /Duplicate call, skipped/u.test(content)).length, 1);

    // Textual mode: a call the parser reads from a fence or from bare JSON leaves the visible text too.
    provider = "claude_subscription";
    const fenced = await start("textual fence", [
      reply('Looking.\n```json\n{"name":"read","arguments":{"path":"hello.txt"}}\n```'),
      reply('{"name":"read","arguments":{"path":"hello.txt"}}'),
      reply("Done."),
    ]);
    await fenced.done;
    provider = "custom";
    assert.equal(requests.length, 3);
    assert.match(requests[1]!.messages.at(-1)?.content ?? "", /hi from the workspace file/u);
    assert.ok(!JSON.stringify(fenced.events).includes("```"), "fenced call text is removed");
    assert.ok(!JSON.stringify(fenced.events).includes('\\"name\\":\\"read'), "bare call text is removed");
    provider = "claude_subscription";
    const call = (name: string, args: Record<string, unknown>) =>
      `<tool_call>${JSON.stringify({ name, arguments: args })}</tool_call>`;
    // A tagged call keeps a ```ts example in the saved answer.
    const chipsCall = call("suggestions", { chips: [{ label: "Go", prompt: "Go on." }] });
    const keep = await start("textual keep fence", [reply(`Example:\n\`\`\`ts\nconst a = 1;\n\`\`\`\n${chipsCall}`)]);
    await keep.done;
    assert.match((await lastAssistant(keep.chat.id))?.content ?? "", /const a = 1;/u);
    // Two complete tags and one left open: nothing runs, the user gets the continue chip.
    const open = await start("textual cut", [
      reply(
        `${call("write", { path: "cut-a.txt", content: "x", reason: "t" })}${call("write", { path: "cut-b.txt", content: "x", reason: "t" })}<tool_call>{"name":"write","arguments":{"path":"cut-c`,
      ),
    ]);
    await open.done;
    for (const file of ["cut-a.txt", "cut-b.txt", "cut-c.txt"])
      assert.equal(existsSync(join(workspaceDir, file)), false);
    assert.ok(JSON.stringify(open.events).includes("Continue the task."));
    provider = "custom";
  }

  // Live draft: streamed words reach the client as provisional "draft" events, stop at a textual call marker
  // (even one split across deltas), end with a null per round, and are never saved or sent as the answer.
  {
    mode = "auto";
    provider = "claude_subscription";
    const call = `<tool_call>${JSON.stringify({ name: "read", arguments: { path: "hello.txt" } })}</tool_call>`;
    const streamed =
      (deltas: string[], content: string): Scripted =>
      async (options) => {
        for (const delta of deltas) options.onToken?.(delta);
        return reply(content);
      };
    const { chat, events, done } = await start("pi draft", [
      streamed(["Reading ", "it now. <to", "ol_call>", call.slice(11)], `Reading it now. ${call}`),
      streamed(["Provisional ", "words."], "The file says hi."),
    ]);
    await done;
    provider = "custom";
    const drafts = events.filter((event) => event.type === "draft").map((event) => event.data);
    assert.deepEqual(drafts, ["Reading ", "Reading it now. ", null, "Provisional ", null]);
    const tokens = events
      .filter((event) => event.type === "token")
      .map((event) => event.data)
      .join("");
    assert.doesNotMatch(tokens, /Provisional/u, "a draft is never the answer");
    const saved = await lastAssistant(chat.id);
    assert.equal(saved?.content, "The file says hi.");
    assert.doesNotMatch(JSON.stringify(saved), /Provisional|tool_call/u, "no draft text is persisted");
    assert.equal(draftVisibleText("Hi <｜DSML｜tool_calls>"), "Hi ");
    assert.equal(draftVisibleText("a < b and then some more "), "a < b and then some more ");
    // Every supported opener hides the rest, a half-written opener never flashes, fences stay visible.
    for (const opener of [
      "[TOOL_CALLS]",
      "<minimax:tool_call>",
      "<function=x>",
      "<tool_code>",
      "<invoke ",
      "<|python_tag|>",
      "<｜tool▁sep｜>",
      "<|tool_call_begin|>",
    ])
      assert.equal(draftVisibleText(`Hi ${opener}rest`), "Hi ", opener);
    for (const half of ["<", "[", "<tool", "[TOOL_", "<minimax:"])
      assert.equal(draftVisibleText(`Hi ${half}`), "Hi ", half);
    assert.equal(draftVisibleText("Code:\n```ts\nx\n```\nok "), "Code:\n```ts\nx\n```\nok ");
    // Internal names are scrubbed and a name split across deltas never leaks.
    assert.equal(draftVisibleText("Use character.update with apply:true now "), "Use character update with apply now ");
    assert.doesNotMatch(draftVisibleText("Use app_da"), /app_/u);

    // Classic drafts its frame's `say` through the same event and ends each round with a null.
    const classic = await start(
      "classic draft",
      [
        async (_options, onToken) => {
          onToken?.("Classic ");
          onToken?.("draft.");
          return reply(JSON.stringify({ say: "Classic answer.", commands: [], stop: true }));
        },
      ],
      "classic",
    );
    await classic.done;
    assert.deepEqual(
      classic.events.filter((event) => event.type === "draft").map((event) => event.data),
      ["Classic ", null],
    );
    assert.equal((await lastAssistant(classic.chat.id))?.content, "Classic answer.");
  }

  // The real prompt builder: pi prompt instead of the JSON protocol, and the stored chat as plain text.
  {
    mode = "auto";
    const realService = makeService(false);
    const chat = await chats.create({ name: "pi real prompt", mode: "conversation", characterIds: [] });
    await chats.createMessage({ chatId: chat.id, role: "user", characterId: null, content: "Earlier question" });
    await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: null, content: "Earlier answer" });
    const { done } = await start("unused", [reply("Real prompt answer.")], "pi", realService, chat.id);
    await done;
    const system = requests[0]!.messages.find((message) => message.role === "system")?.content ?? "";
    assert.match(system, /<workspace_tools>/u);
    assert.match(system, /There is no JSON frame/u);
    assert.match(system, /a turn with no tool call ends the run/u);
    assert.match(system, /peek-prompt/u);
    assert.match(system, /named subject/u);
    assert.doesNotMatch(system, /workspace_command_protocol/u);
    const history = requests[0]!.messages.filter((message) => message.role !== "system");
    assert.deepEqual(
      history.map((message) => [message.role, message.content]),
      [
        ["user", "Earlier question"],
        ["assistant", "Earlier answer"],
        ["user", "Do the thing."],
      ],
    );
    assert.deepEqual(runtimeSeen, ["pi"]);
  }

  console.log("Professor Mari pi runtime regression passed.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
}
