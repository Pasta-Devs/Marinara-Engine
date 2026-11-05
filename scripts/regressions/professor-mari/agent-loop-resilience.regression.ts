// Guards two Professor Mari workspace-loop failure modes.
//
// 1. Withheld replies. The completion-claim audit and the "no commands, no stop"
//    path both discard a reply's words before they reach the user, but the reply
//    stays in Mari's history. Without being told, she assumed the user saw it and
//    ended runs with "I checked ... the original plan I made is still there",
//    referencing a plan the user never saw. Repair prompts on both runtimes now carry
//    MARI_WITHHELD_REPLY_NOTICE, and both runtime prompts say hidden reasoning is never
//    shown. Separately, only the final round's words are saved as her answer, so a plan
//    written in an earlier round ends up in the step timeline; the prompts say to repeat it.
//
// 2. OpenRouter limits. A connection's Max Tokens is often copied from the model's whole
//    window (943,718 for a 1M Kimi K3.1 Pro), and Mari used it as her per-reply budget.
//    OpenRouter reserves credits for every requested output token, so the call failed with
//    402 "can only afford N" before she could act (Gemini 4 Argon managed one step before
//    the growing prompt pushed it over). Mari now holds a budget copied from the model's window
//    to the model's known max output, caps it at MARI_MAX_OUTPUT_TOKENS on OpenRouter only, and
//    retries a 402 or context-overflow rejection with limits learned from the error for the rest
//    of the run, sent even when the connection's send map switches Max Tokens off.
//
// The loop checks run the real classic and pi loops and the real chatCompleteWorkspace over a
// scripted fake provider: no network, no real model.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-loop-storage-"));
const workspaceDir = mkdtempSync(join(tmpdir(), "marinara-mari-loop-workspace-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

try {
  const {
    MARI_MAX_OUTPUT_TOKENS,
    MARI_WITHHELD_REPLY_NOTICE,
    mariMaxOutputTokens,
    withWithheldNotice,
    nextOptionsAfterLimitError,
    parseAffordableMaxTokens,
    parseContextOverflowError,
    piRuntimePrompt,
    ProfessorMariWorkspaceService,
    workspaceCommandProtocolPrompt,
  } = await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");

  // ── Context overflow parsing ──
  {
    const openRouter = new Error(
      "OpenRouter error 400: This endpoint's maximum context length is 262144 tokens. However, you requested about 270512 tokens (262320 of text input, 8192 in the output). Please reduce the length of either one.",
    );
    assert.deepEqual(parseContextOverflowError(openRouter), { limit: 262_144 });

    const commaFormatted = new Error("error 400: maximum context length is 131,072 tokens");
    assert.deepEqual(parseContextOverflowError(commaFormatted), { limit: 131_072 });

    const unstated = new Error("error 400: The requested context is too long for this model.");
    assert.deepEqual(parseContextOverflowError(unstated), { limit: null });

    const openAiCode = new Error('error 400: {"code":"context_length_exceeded"}');
    assert.deepEqual(parseContextOverflowError(openAiCode), { limit: null });

    // Unrelated failures must not trigger the retry.
    assert.equal(parseContextOverflowError(new Error("error 429: rate limited")), null);
    assert.equal(parseContextOverflowError(new Error("error 400: invalid response_format")), null);
    assert.equal(parseContextOverflowError(undefined), null);
  }

  // ── OpenRouter credit limit (402) ──
  {
    const credit = new Error(
      "OpenRouter API error 402: This request requires more credits, or fewer max_tokens. You requested up to 929637 tokens, but can only afford 176108. To increase, visit https://openrouter.ai/settings/keys",
    );
    assert.equal(parseAffordableMaxTokens(credit), 176_108);
    assert.equal(parseAffordableMaxTokens(new Error("error 400: bad request")), null);
    // A credit rejection is not mistaken for a context overflow.
    assert.equal(parseContextOverflowError(credit), null);

    // Retry under the affordable budget, with headroom (the reported uncapped request).
    assert.deepEqual(nextOptionsAfterLimitError(credit, { maxTokens: 929_637, maxContext: 1_048_576 }), {
      reason: "Credit limit",
      maxTokens: 158_497,
    });
    // ...which is pointless when the request already asks for less: surface the error.
    assert.equal(nextOptionsAfterLimitError(new Error("402: can only afford 20000"), { maxTokens: 16_000 }), null);
    assert.deepEqual(nextOptionsAfterLimitError(new Error("402: can only afford 20000"), { maxTokens: 32_768 }), {
      reason: "Credit limit",
      maxTokens: 18_000,
    });
    // Too few credits for a usable reply: surface the 402 instead of looping.
    assert.equal(nextOptionsAfterLimitError(new Error("402: can only afford 900"), { maxTokens: 32_768 }), null);
    // With Max Tokens switched off nothing was sent and the provider reserved its own maximum, so the issue's balance
    // is retried under the unsent fallback rather than compared with it (Dottore #8865).
    assert.deepEqual(
      nextOptionsAfterLimitError(new Error("402: You requested up to 929637 tokens, but can only afford 176108."), {
        maxTokens: 32_768,
        enabledParameters: { maxTokens: false },
      }),
      { reason: "Credit limit", maxTokens: 32_768 },
    );
    // Context overflow: use the stated window, or tighten the configured one.
    const stated = new Error("maximum context length is 262144 tokens");
    assert.deepEqual(nextOptionsAfterLimitError(stated, { maxContext: 1_048_576 }), {
      reason: "Context overflow",
      maxContext: 262_144,
    });
    assert.deepEqual(nextOptionsAfterLimitError(new Error("context is too long"), { maxContext: 100_000 }), {
      reason: "Context overflow",
      maxContext: 75_000,
    });
    // A model missing from the catalog with no Max Context adopts the stated window...
    for (const options of [{}, { maxContext: 0 }]) {
      assert.deepEqual(
        nextOptionsAfterLimitError(stated, options),
        { reason: "Context overflow", maxContext: 262_144 },
        `no Max Context (${JSON.stringify(options)}) takes the stated window`,
      );
    }
    // ...and with no window stated there is nothing to shrink: surface the error.
    assert.equal(nextOptionsAfterLimitError(new Error("context is too long"), {}), null);
    assert.equal(nextOptionsAfterLimitError(new Error("error 500: upstream"), { maxTokens: 32_768 }), null);
  }

  // ── Output budget ──
  {
    const connection = (fields: Record<string, unknown>) =>
      ({
        id: "c",
        name: "c",
        provider: "openrouter",
        model: "moonshotai/kimi-k3.1-pro",
        defaultParameters: null,
        ...fields,
      }) as unknown as Parameters<typeof mariMaxOutputTokens>[0];
    // OpenRouter: the reported connection, Max Tokens copied from the 1M window, is capped.
    assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 943_718 })), MARI_MAX_OUTPUT_TOKENS);
    assert.equal(
      mariMaxOutputTokens(connection({ defaultParameters: JSON.stringify({ maxTokens: 500_000 }) })),
      MARI_MAX_OUTPUT_TOKENS,
    );
    assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 65_536 })), MARI_MAX_OUTPUT_TOKENS);
    // Smaller limits are untouched.
    assert.equal(mariMaxOutputTokens(connection({ maxTokensOverride: 4_096 })), 4_096);
    assert.equal(mariMaxOutputTokens(connection({})), 8_192);

    // Direct providers keep the limit the model allows: hidden reasoning shares it there.
    const argon = (fields: Record<string, unknown>) =>
      connection({ provider: "google", model: "gemini-4-argon", ...fields });
    assert.equal(mariMaxOutputTokens(argon({ maxTokensOverride: 65_536 })), 65_536, "a real 64k limit is kept");
    assert.equal(mariMaxOutputTokens(argon({})), 65_536, "the catalog default is the model's max output");
    // A value copied from the whole window is held to the model's known max output.
    assert.equal(mariMaxOutputTokens(argon({ defaultParameters: JSON.stringify({ maxTokens: 1_000_000 }) })), 65_536);
    // A model the catalog does not know keeps the user's explicit value.
    assert.equal(
      mariMaxOutputTokens(connection({ provider: "custom", model: "local-model", maxTokensOverride: 65_536 })),
      65_536,
    );
    // A value well under the window is kept even above the catalog's max output, which lags some models.
    assert.equal(
      mariMaxOutputTokens(connection({ provider: "anthropic", model: "claude-opus-4-6", maxTokensOverride: 128_000 })),
      128_000,
      "the provider-reported 128k limit is kept",
    );
    assert.equal(
      mariMaxOutputTokens(
        connection({
          provider: "custom",
          model: "zai-org/GLM-4.5-Air",
          defaultParameters: JSON.stringify({ maxTokens: 16_384 }),
        }),
      ),
      16_384,
      "a custom GLM 4.5 Air keeps its Max Tokens",
    );
  }

  // ── Withheld-reply guidance in both runtime prompts ──
  {
    assert.match(MARI_WITHHELD_REPLY_NOTICE, /did NOT see/u);
    assert.match(MARI_WITHHELD_REPLY_NOTICE, /original plan is still there/u);
    assert.doesNotMatch(MARI_WITHHELD_REPLY_NOTICE, /\bsay\b/u, "the notice reaches pi, which has no say field");
    // Only a turn with words withheld anything.
    assert.equal(withWithheldNotice("p", "  "), "p");
    assert.equal(withWithheldNotice("p", "x"), `p\n\n${MARI_WITHHELD_REPLY_NOTICE}`);

    const protocol = workspaceCommandProtocolPrompt();
    assert.match(protocol, /hidden reasoning\/thinking is NEVER shown/u);
    // Only the final round's say is saved as the answer (earlier rounds collapse
    // into the timeline), so the protocol must tell Mari to repeat the plan there.
    assert.match(protocol, /Only your final `say`/u);

    // pi, the default runtime, has plain assistant text and no `say`: the same rule in its words.
    const pi = piRuntimePrompt();
    assert.match(pi, /hidden reasoning\/thinking is NEVER shown/u);
    assert.match(pi, /Only your final turn's text is kept as your answer/u);
    assert.match(pi, /restate that whole answer or plan in your final text/u);
  }

  // ── The real loops over a scripted provider ──
  const db = await getDB();
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

  let script: Array<ChatCompletionResult | Error> = [];
  let requests: Array<{ messages: ChatMessage[]; options: ChatOptions }> = [];
  // Sits under the real chatCompleteWorkspace, so its limit retry and learned limits run too.
  const fakeProvider = {
    chatComplete: async (messages: ChatMessage[], options: ChatOptions) => {
      requests.push({ messages: structuredClone(messages), options: { ...options } });
      const next = script.shift();
      if (!next) throw new Error("The scripted provider ran out of replies.");
      if (next instanceof Error) throw next;
      return next;
    },
  };
  const service = new ProfessorMariWorkspaceService({ db } as never);
  service.setEnabled(true, workspaceDir);
  type ChatCompleteWorkspace = (provider: unknown, ...rest: unknown[]) => Promise<ChatCompletionResult>;
  const realChatComplete = (
    service as unknown as { chatCompleteWorkspace: ChatCompleteWorkspace }
  ).chatCompleteWorkspace.bind(service);
  Object.assign(service, {
    ensureMariCliShim: async () => {},
    resolveConnection: async () => ({
      id: "mari-loop",
      name: "Regression",
      provider: "custom",
      model: "fake-model",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "",
      maxContext: 32768,
    }),
    resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
    buildPromptMessages: async () => ({
      messages: [
        { role: "system", content: "You are Professor Mari (regression).", contextKind: "prompt" },
        { role: "user", content: "Do the thing.", contextKind: "history" },
      ],
      manualApprovalArmed: false,
      heldCalls: [],
    }),
    chatCompleteWorkspace: (_provider: unknown, ...rest: unknown[]) => realChatComplete(fakeProvider, ...rest),
  });
  const run = async (runtime: "classic" | "pi", steps: Array<ChatCompletionResult | Error>) => {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, runtime);
    script = [...steps];
    requests = [];
    const chat = await chats.create({ name: `${runtime} loop`, mode: "conversation", characterIds: [] });
    await service.prompt({ chatId: chat.id, text: "Do the thing.", onEvent: () => {} });
    assert.equal(script.length, 0, `${runtime}: every scripted reply was requested`);
    return requests;
  };
  const lastUser = (request: { messages: ChatMessage[] } | undefined) =>
    request?.messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
  const read = { name: "read", arguments: { path: "hello.txt" } };
  const frame = (say: string, commands: Array<typeof read> = [], stop = commands.length === 0) =>
    ({ content: JSON.stringify({ say, commands, stop }), toolCalls: [], finishReason: "stop" }) as ChatCompletionResult;
  const reply = (content: string, calls: Array<{ id: string; name: string; args: Record<string, unknown> }> = []) =>
    ({
      content,
      toolCalls: calls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.args) },
      })),
      finishReason: calls.length > 0 ? "tool_calls" : "stop",
    }) as ChatCompletionResult;
  const classicRequests: Array<{ messages: ChatMessage[] }> = [];

  // Classic: a frame with words but neither commands nor stop is never shown, so the coaching says so.
  {
    const plan = "Here is my plan: read hello.txt, then summarize it for you.";
    const seen = await run("classic", [frame(plan, [], false), frame(plan)]);
    classicRequests.push(...seen);
    assert.equal(seen.length, 2);
    assert.match(lastUser(seen[1]), /^Continue the same workspace task\./u);
    assert.ok(lastUser(seen[1]).endsWith(MARI_WITHHELD_REPLY_NOTICE), "classic: a withheld say carries the notice");
  }
  // ...and a silent frame had nothing to withhold.
  {
    const seen = await run("classic", [frame("", [], false), frame("All set.")]);
    classicRequests.push(...seen);
    assert.match(lastUser(seen[1]), /^Continue the same workspace task\./u);
    assert.ok(!lastUser(seen[1]).includes(MARI_WITHHELD_REPLY_NOTICE), "classic: a silent frame gets no notice");
  }
  // Classic: the claim audit discards the frame's words too.
  {
    const seen = await run("classic", [
      frame("I've created entry A. Now let me check entry B.", [read], false),
      frame("Entry A is not there yet."),
    ]);
    classicRequests.push(...seen);
    assert.match(lastUser(seen[1]), /You claimed a step was completed/u);
    assert.ok(lastUser(seen[1]).endsWith(MARI_WITHHELD_REPLY_NOTICE), "classic: a repaired claim carries the notice");
  }
  // Classic: an empty final frame is repaired, then a command round runs.
  {
    const seen = await run("classic", [frame("", [], true), frame("", [read], false), frame("Read it.")]);
    classicRequests.push(...seen);
    assert.equal(seen.length, 3);
  }
  // Every in-run assistant frame is history the context fitter may trim (the stubbed prompt has none of its own).
  const frames = classicRequests.flatMap((request) => request.messages.filter((m) => m.role === "assistant"));
  assert.ok(frames.length >= 5, `classic: the runs replayed their frames (${frames.length})`);
  for (const message of frames) assert.equal(message.contextKind, "history", `classic frame: ${message.content}`);

  // pi (the default runtime): a claim repair and a held-claim repair both drop the turn's words.
  {
    const seen = await run("pi", [
      reply("I've created entry A. Now let me check entry B.", [
        { id: "pi-read", name: "read", args: { path: "hello.txt" } },
      ]),
      reply("Entry A is not there yet."),
    ]);
    assert.equal(seen.length, 2);
    assert.match(lastUser(seen[1]), /You claimed a step was completed/u);
    assert.ok(lastUser(seen[1]).endsWith(MARI_WITHHELD_REPLY_NOTICE), "pi: the claim steer carries the notice");
  }
  {
    const failedEdit = {
      id: "pi-edit",
      name: "edit",
      args: { path: "hello.txt", edits: [{ oldText: "not in the file", newText: "x" }], reason: "t" },
    };
    const seen = await run("pi", [
      reply("", [failedEdit]),
      reply("Held for your review — the change card is ready."),
      reply("The edit failed; no change was made."),
    ]);
    assert.equal(seen.length, 3);
    assert.match(lastUser(seen[2]), /^Nothing is held/u);
    assert.ok(lastUser(seen[2]).endsWith(MARI_WITHHELD_REPLY_NOTICE), "pi: the held-claim steer carries the notice");
  }
  // pi: words written before a call the output limit cut (often the plan) are withheld too.
  {
    const seen = await run("pi", [
      {
        content: "Here is my plan: entry A, entry B, entry C. Creating the lorebook now.",
        toolCalls: [
          {
            id: "pi-cut",
            type: "function",
            function: { name: "write", arguments: '{"path":"big.txt","content":"aaaa' },
          },
        ],
        finishReason: "length",
      },
      reply("Done in smaller steps."),
    ]);
    assert.equal(seen.length, 2);
    assert.match(lastUser(seen[1]), /You were writing `write`/u);
    assert.ok(lastUser(seen[1]).endsWith(MARI_WITHHELD_REPLY_NOTICE), "pi: a cut call's words carry the notice");
  }

  // pi: after a 402 the run keeps the learned limit, and the output-limit repair quotes it.
  {
    const seen = await run("pi", [
      new Error(
        "OpenRouter API error 402: This request requires more credits, or fewer max_tokens. You requested up to 8192 tokens, but can only afford 3000.",
      ),
      { content: "A very long answer that the limit cut", toolCalls: [], finishReason: "length" },
      reply("A short answer."),
    ]);
    assert.deepEqual(
      seen.map((request) => request.options.maxTokens),
      [8_192, 2_700, 2_700],
      "pi: the learned limit sticks across pi's copied options",
    );
    assert.match(lastUser(seen[2]), /output limit \(about 2700 tokens\)/u, "pi: the repair quotes the learned limit");
    assert.match(lastUser(seen[2]), /at most 4050 characters/u);
    // A cut answer is written again shorter: the notice's "write out again everything" would fight that.
    assert.ok(!lastUser(seen[2]).includes(MARI_WITHHELD_REPLY_NOTICE), "pi: a prose cut gets no notice");
  }

  // ── chatCompleteWorkspace's limit retry, called directly ──
  {
    const callDirect = (options: ChatOptions) =>
      realChatComplete(fakeProvider, [{ role: "user", content: "hi" }], options);
    const credit = (affordable: number) =>
      new Error(
        `OpenRouter API error 402: This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford ${affordable}.`,
      );
    const sent = () => requests.map((request) => request.options.maxTokens);

    // A credit rejection is retried under the affordable budget, and later calls of the run start there,
    // even from a fresh copy of the options (pi spreads one per call); the signal carries the limit.
    const signal = new AbortController().signal;
    const base: ChatOptions = { model: "m", maxTokens: 32_768, signal };
    script = [credit(20_000), reply("ok")];
    requests = [];
    assert.equal((await callDirect(base)).content, "ok");
    assert.deepEqual(sent(), [32_768, 18_000]);
    script = [reply("ok")];
    requests = [];
    await callDirect({ ...base });
    assert.deepEqual(sent(), [18_000], "the learned limit applies to the next call");
    script = [reply("ok")];
    requests = [];
    await callDirect({ ...base, signal: new AbortController().signal });
    assert.deepEqual(sent(), [32_768], "another run starts fresh");

    // With Max Tokens switched off in the send map, the lowered limit is sent anyway, on the retry and after it.
    const unsent = { ...base, signal: new AbortController().signal, enabledParameters: { maxTokens: false } };
    const sends = () => requests.map((request) => request.options.enabledParameters?.maxTokens);
    script = [credit(20_000), reply("ok")];
    requests = [];
    await callDirect(unsent);
    assert.deepEqual(sent(), [32_768, 18_000]);
    assert.deepEqual(sends(), [false, true], "the retry sends the lowered limit");
    script = [reply("ok")];
    requests = [];
    await callDirect({ ...unsent });
    assert.deepEqual([sent(), sends()], [[18_000], [true]], "so does the next call of the run");
    // A balance above the unsent fallback is still retried, with the fallback sent.
    script = [credit(176_108), reply("ok")];
    requests = [];
    await callDirect({ ...base, signal: new AbortController().signal, enabledParameters: { maxTokens: false } });
    assert.deepEqual(
      [sent(), sends()],
      [
        [32_768, 32_768],
        [false, true],
      ],
      "a large balance is retried, not rethrown",
    );

    // A context overflow with a stated window, on a connection with no Max Context, is retried under it.
    const ctxSignal = new AbortController().signal;
    const maxContexts = () => requests.map((request) => request.options.maxContext);
    script = [new Error("OpenRouter error 400: This endpoint's maximum context length is 16384 tokens."), reply("ok")];
    requests = [];
    await callDirect({ model: "m", maxTokens: 4_096, signal: ctxSignal });
    assert.deepEqual(maxContexts(), [undefined, 16_384]);
    // Later calls of the run start under the learned window, never above a smaller configured one.
    for (const [maxContext, expected] of [
      [undefined, 16_384],
      [100_000, 16_384],
      [8_192, 8_192],
    ] as const) {
      script = [reply("ok")];
      requests = [];
      await callDirect({ model: "m", maxTokens: 4_096, maxContext, signal: ctxSignal });
      assert.deepEqual(maxContexts(), [expected], `the learned window applies to the next call (${maxContext})`);
    }

    // Bounded: two retries (MAX_LIMIT_RETRIES), then the last rejection surfaces.
    const last = credit(10_000);
    script = [credit(20_000), credit(15_000), last];
    requests = [];
    await assert.rejects(callDirect({ ...base, signal: new AbortController().signal }), (error) => error === last);
    assert.deepEqual(sent(), [32_768, 18_000, 13_500]);

    // An aborted run is never retried.
    const aborted = new AbortController();
    aborted.abort();
    const rejection = credit(20_000);
    script = [rejection];
    requests = [];
    await assert.rejects(callDirect({ ...base, signal: aborted.signal }), (error) => error === rejection);
    assert.equal(requests.length, 1);
  }

  console.log("professor-mari agent-loop resilience regressions passed");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
}
