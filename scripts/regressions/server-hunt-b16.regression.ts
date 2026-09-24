// server-hunt batch 16:
// 1. OOC influences from a connected conversation must not be consumed while the
//    prompt is being built. The helper returns their ids and the route marks them
//    consumed only after the turn's message is saved, so a failed or stopped
//    generation keeps them pending for the retry.
// 2. The connected chat context for a conversation turn reads only the latest 20
//    messages of the connected roleplay/game chat instead of the whole chat.
// 3. Conversation auto-summary LLM calls honour the request abort signal, and an
//    abort is rethrown instead of being recorded as a summary failure.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b16-"));
const savedEnv = { DATA_DIR: process.env.DATA_DIR, LOG_LEVEL: process.env.LOG_LEVEL };
process.env.DATA_DIR = join(tempDir, "data");
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";

try {
  // ── 1. Influences are returned, not consumed, by the prompt helper ──
  const { injectConnectedConversationPromptBlocks } = await import(
    "../../packages/server/src/routes/generate/connected-conversation-injections.js"
  );
  const marked: string[] = [];
  const finalMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: "sys" },
    { role: "user", content: "hello" },
  ];
  const result = await injectConnectedConversationPromptBlocks({
    chatMode: "roleplay",
    connectedChatId: "conv-1",
    isSceneChat: false,
    chatId: "rp-1",
    chats: {
      async listPendingInfluences() {
        return [
          { id: "inf-a", content: "Be kinder to the innkeeper." },
          { id: "inf-b", content: "Rain starts soon." },
        ];
      },
      async markInfluenceConsumed(id: string) {
        marked.push(id);
      },
      async listNotes() {
        return [];
      },
      async getById() {
        return null;
      },
    },
    finalMessages,
  });
  assert.deepEqual(marked, [], "prompt assembly must not mark influences consumed");
  assert.deepEqual(result.consumedInfluenceIds, ["inf-a", "inf-b"], "helper returns the injected influence ids");
  assert.ok(
    finalMessages.some((m) => m.content.includes("<ooc_influences>") && m.content.includes("innkeeper")),
    "influences are still injected into the prompt",
  );

  const noConnection = await injectConnectedConversationPromptBlocks({
    chatMode: "roleplay",
    connectedChatId: null,
    isSceneChat: false,
    chatId: "rp-1",
    chats: {
      async listPendingInfluences() {
        throw new Error("should not be read without a connected chat");
      },
      async markInfluenceConsumed() {},
      async listNotes() {
        return [];
      },
      async getById() {
        return null;
      },
    },
    finalMessages: [],
  });
  assert.deepEqual(noConnection.consumedInfluenceIds, [], "nothing injected means nothing to consume");

  // The route marks them after the message is saved (source check: the full route is not runnable here).
  const routeSource = readFileSync(
    new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    routeSource,
    /consumedInfluenceIds: injectedConnectedInfluenceIds \} = await injectConnectedConversationPromptBlocks/,
    "route keeps the injected influence ids",
  );
  assert.match(
    routeSource,
    /if \(savedMsg\?\.id\) await markInjectedConnectedInfluencesConsumed\(\);\s*\/\/ Empty messageId/,
    "route marks influences consumed right after the assistant message is saved",
  );
  assert.match(
    routeSource,
    /if \(anchoredMsg\?\.id\) await markInjectedConnectedInfluencesConsumed\(\);/,
    "route marks influences consumed after a hidden command anchor is saved",
  );

  // A failed mark is a suppressed failure: structured, id in a field, no Error-first warn.
  const markStart = routeSource.indexOf("const markInjectedConnectedInfluencesConsumed = async");
  assert.ok(markStart >= 0, "mark helper exists");
  const markBody = routeSource.slice(markStart, routeSource.indexOf("};", markStart));
  assert.doesNotMatch(markBody, /logger\.warn\(/, "mark helper does not use a plain logger.warn");
  assert.doesNotMatch(markBody, /%s/, "mark helper does not format ids into the message");
  assert.match(
    markBody,
    /logSuppressed\(err, \{\s*event: "generation\.influence_consume",\s*stage: "influence\.consume",\s*chatId: input\.chatId,\s*influenceId: id,/,
    "mark failure goes through logSuppressed with the influence id as a field",
  );

  // ── 2. Bounded read of the connected chat ──
  const { resolveConversationConnectedChatContext } = await import(
    "../../packages/server/src/routes/generate/conversation-connected-context.js"
  );
  const paginatedCalls: Array<[string, number]> = [];
  const connected = await resolveConversationConnectedChatContext({
    connectedChatId: "rp-chat",
    conversationCommandsEnabled: true,
    chatMeta: {},
    personaName: "Mari",
    chats: {
      async getById() {
        return { id: "rp-chat", name: "Lab", mode: "roleplay", characterIds: JSON.stringify(["char-rana"]) };
      },
      async listMessages() {
        throw new Error("full-chat read must not be used when a bounded read exists");
      },
      async listMessagesPaginated(chatId: string, limit: number) {
        paginatedCalls.push([chatId, limit]);
        return [{ role: "assistant", characterId: "char-rana", content: "Latest line." }];
      },
    },
    chars: {
      async getById() {
        return { data: JSON.stringify({ name: "Rana" }) };
      },
    },
    gameStateStore: {
      async getLatestCommitted() {
        return null;
      },
      async getLatest() {
        return null;
      },
    },
    wrapFormat: "xml",
  } as any);
  assert.deepEqual(paginatedCalls, [["rp-chat", 20]], "connected roleplay context reads only the latest 20");
  assert.ok(JSON.stringify(connected).includes("Latest line."), "bounded messages reach the context");

  // ── 3. Auto-summary honours abort ──
  const { generateMissingConversationSummaries } = await import(
    "../../packages/server/src/services/conversation/auto-summary.service.js"
  );
  const now = new Date("2026-09-20T15:00:00Z");
  const messages = [
    { id: "m1", role: "user", content: "Day one hello", characterId: null, createdAt: "2026-09-17T15:00:00Z" },
    { id: "m2", role: "assistant", content: "Day one reply", characterId: "c1", createdAt: "2026-09-17T15:01:00Z" },
    { id: "m3", role: "user", content: "Day two hello", characterId: null, createdAt: "2026-09-18T15:00:00Z" },
  ];
  const seenSignals: Array<AbortSignal | undefined> = [];
  const abortedAtCall: boolean[] = [];
  let calls = 0;
  const hangingProvider = {
    async chatComplete(_msgs: unknown, options: { signal?: AbortSignal }) {
      calls++;
      seenSignals.push(options.signal);
      abortedAtCall.push(Boolean(options.signal?.aborted));
      // Simulates a provider that ignores the signal and never answers.
      return new Promise<never>(() => {});
    },
  };
  const controller = new AbortController();
  const startedAt = Date.now();
  const run = generateMissingConversationSummaries({
    messages,
    metadata: {},
    provider: hangingProvider as any,
    model: "test-model",
    personaName: "User",
    charIdToName: new Map([["c1", "Rana"]]),
    now,
    timeZone: "UTC",
    maxMissingDays: 2,
    timeoutMs: 60_000,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(run, (err: unknown) => {
    assert.ok(controller.signal.aborted);
    return err !== undefined;
  }, "an aborted summary run rejects instead of recording a failure");
  assert.ok(Date.now() - startedAt < 5_000, "abort unwinds promptly, not after the summary timeout");
  assert.equal(calls, 1, "no further day or week summaries start after abort");
  // The service hands the provider its own request signal (so a timeout can cancel the call too);
  // what matters is that the caller's abort reaches it, not object identity.
  assert.ok(seenSignals[0], "provider.chatComplete receives a signal");
  assert.equal(abortedAtCall[0], false, "the request signal is live when the call starts");
  assert.equal(seenSignals[0]?.aborted, true, "the caller abort reaches provider.chatComplete");

  // The summary timeout also cancels the in-flight provider request and is recorded as a failure.
  const timeoutSignals: Array<AbortSignal | undefined> = [];
  const timedOut = await generateMissingConversationSummaries({
    messages,
    metadata: {},
    provider: {
      async chatComplete(_msgs: unknown, options: { signal?: AbortSignal }) {
        timeoutSignals.push(options.signal);
        return new Promise<never>(() => {});
      },
    } as any,
    model: "test-model",
    personaName: "User",
    charIdToName: new Map(),
    now,
    timeZone: "UTC",
    maxMissingDays: 1,
    timeoutMs: 30,
  });
  assert.equal(timedOut.failedDays.length, 1, "a timed-out day is recorded as a failure");
  assert.equal(timeoutSignals[0]?.aborted, true, "the timeout aborts the provider request");
  assert.equal((timeoutSignals[0]?.reason as Error | undefined)?.name, "TimeoutError", "abort reason is the timeout");

  let preAbortedCalls = 0;
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    generateMissingConversationSummaries({
      messages,
      metadata: {},
      provider: {
        async chatComplete() {
          preAbortedCalls++;
          return { content: '{"summary":"x","keyDetails":[]}' };
        },
      } as any,
      model: "test-model",
      personaName: "User",
      charIdToName: new Map(),
      now,
      timeZone: "UTC",
      signal: preAborted.signal,
    }),
  );
  assert.equal(preAborted.signal.aborted && preAbortedCalls, 0, "a pre-aborted run makes no LLM calls");

  // Without a signal, a failing provider is still recorded as a summary failure (unchanged behaviour).
  const failing = await generateMissingConversationSummaries({
    messages,
    metadata: {},
    provider: {
      async chatComplete() {
        throw new Error("503 upstream");
      },
    } as any,
    model: "test-model",
    personaName: "User",
    charIdToName: new Map(),
    now,
    timeZone: "UTC",
    maxMissingDays: 1,
  });
  assert.equal(failing.failedDays.length, 1, "ordinary provider errors are still recorded");

  console.log("server-hunt-b16 regression passed");
} finally {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
