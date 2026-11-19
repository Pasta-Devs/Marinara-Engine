// Stopping an agent retry: Stop Agents reaches a running retry, and once it lands while a retried agent is still
// working, the retry sends no result and no "done", and saves no agent run and no lorebook entry. A retry left to
// finish saves its run, its lorebook entries and the chat variables its prompt text sets. The checks at the end (each
// later stop check, and what a lorebook retry's results carry) read route source.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-retry-stop-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { OpenAIProvider } = await import("../../../packages/server/src/services/llm/providers/openai.provider.js");
const { replaceBuiltInAgentDefinitions } = await import("../../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  { id: "retry-stop-fixture", name: "Fixture", description: "Fixture", category: "writer", phase: "post_processing" },
]);

// The provider answers once the test lets it, so a Stop can land while the agent is still working.
let release: PromiseWithResolvers<void> | null = null;
let called = Promise.withResolvers<void>();
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const prompt = messages.map((message) => String(message.content)).join("\n");
  called.resolve();
  if (release) await release.promise;
  return {
    content: prompt.includes("LOREBOOK_TASK")
      ? JSON.stringify({ updates: [{ name: "Retry memory", content: "The ledger was read." }] })
      : "Notes from the retry.",
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};

const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const books = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Retry stop fixture",
    provider: "openai",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  const book = (await books.create({ name: "Retry stop book" })) as unknown as { id: string };
  assert.ok(connection && book);
  const notes = await agents.create({
    type: "retry-notes",
    name: "Retry notes",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "NOTES_TASK",
    settings: { resultType: "context_injection", batchWithOtherAgents: false },
  });
  const keeper = await agents.create({
    type: "retry-lorebook",
    name: "Retry lorebook",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "LOREBOOK_TASK",
    settings: { resultType: "lorebook_update", writableLorebookId: book.id, batchWithOtherAgents: false },
  });
  assert.ok(notes && keeper);

  const retry = async (agentType: string, stop: boolean) => {
    const chat = await chats.create({
      name: agentType,
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      enableTools: false,
      activeAgentIds: [agentType],
      // The retry resolves the author's note for its agents, so a {{setvar}} there changes a chat variable.
      authorNotes: "{{setvar::mood::tense}}Keep the ledger in view.",
      agentLorebookAttachments: { [agentType]: { enabled: true, lorebookId: book.id } },
    });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "Read the ledger." });
    await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The ledger lies open." });
    called = Promise.withResolvers<void>();
    release = stop ? Promise.withResolvers<void>() : null;
    const responsePromise = app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: chat.id, agentTypes: [agentType] },
    });
    if (stop) {
      await called.promise;
      const stopped = await app.inject({
        method: "POST",
        url: "/api/generate/abort",
        payload: { chatId: chat.id, agentsOnly: true },
      });
      assert.equal(stopped.json().aborted, true, stopped.body);
      release!.resolve();
    }
    const response = await responsePromise;
    assert.equal(response.statusCode, 200, response.body);
    const status = await app.inject({ method: "GET", url: `/api/generate/status/${chat.id}` });
    assert.equal(status.json().active, false, "the retry is no longer running");
    return { chatId: chat.id, body: response.body };
  };
  const entryCount = async () => (await books.listEntries(book.id)).length;
  const variables = async (chatId: string) => {
    const metadata = (await chats.getById(chatId))?.metadata;
    return (typeof metadata === "string" ? JSON.parse(metadata) : (metadata ?? {})).macroVariables ?? {};
  };

  // A retry left to finish sends its result, saves its run and keeps the variable its prompt set.
  const finished = await retry("retry-notes", false);
  assert.match(finished.body, /"type":"agent_result"/u, finished.body);
  assert.match(finished.body, /"type":"done"/u, finished.body);
  assert.equal((await agents.listCustomRunsForChat(finished.chatId)).length, 1, "the finished retry saves its run");
  assert.equal(
    (await variables(finished.chatId)).mood,
    "tense",
    "retry-agent prompt macro writes are persisted back to chat metadata",
  );

  // Stopped while the agent works: nothing is sent or saved afterwards.
  const stopped = await retry("retry-notes", true);
  assert.doesNotMatch(stopped.body, /"type":"agent_result"/u, stopped.body);
  assert.doesNotMatch(stopped.body, /"type":"done"/u, "a stopped retry does not report that it finished");
  assert.equal((await agents.listCustomRunsForChat(stopped.chatId)).length, 0, "a stopped retry saves no run");

  // A lorebook agent writes its entry when left to finish, and writes nothing once stopped.
  const before = await entryCount();
  await retry("retry-lorebook", false);
  assert.equal(await entryCount(), before + 1, "the finished lorebook retry writes its entry");
  const stoppedLorebook = await retry("retry-lorebook", true);
  assert.equal(await entryCount(), before + 1, "a stopped lorebook retry writes no entry");
  assert.doesNotMatch(stoppedLorebook.body, /"type":"done"/u);

  console.info("Agent retry stop regression passed.");
} finally {
  release?.resolve();
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}

// A Stop that lands after the agents answered meets a check before each later step: sending results, saving runs,
// applying effects, writing lorebooks and saying "done". Each one only matters if the Stop lands between two particular
// awaits, and the next one backs it up, so a test removing any single check still passes. These read route source.
const read = (path: string) => readFileSync(new URL(`../../../packages/server/src/${path}`, import.meta.url), "utf8");
const retryAgentsRouteSource = read("routes/generate/retry-agents-route.ts");
const lorebookKeeperUtilsSource = read("routes/generate/lorebook-keeper-utils.ts");
assert.match(
  retryAgentsRouteSource,
  /for \(const result of results\) \{\s*if \(abortController\.signal\.aborted\) return;[\s\S]{0,500}sendSseEvent\(reply, \{\s*type: "agent_result"/u,
  "Forced retries must stop emitting results as soon as their shared abort signal fires",
);
assert.match(
  retryAgentsRouteSource,
  /if \(abortController\.signal\.aborted\) return;\s*await persistRetryResults\(/u,
  "Forced retries must check cancellation immediately before persistRetryResults",
);
assert.match(
  retryAgentsRouteSource,
  /if \(abortController\.signal\.aborted\) return;[\s\S]{0,140}await applyRetryResultEffects\(\{/u,
  "Forced retries must check cancellation before applyRetryResultEffects",
);
assert.match(
  retryAgentsRouteSource,
  /if \(abortController\.signal\.aborted\) return;\s*sendSseEvent\(reply, \{ type: "done"/u,
  "A cancelled retry must not emit its completion event",
);
assert.match(
  retryAgentsRouteSource,
  /assertRetrySetupActive\(\);\s*sendSseEvent\(reply, \{ type: "agent_start"/u,
  "A cancelled retry must not emit agent_start after asynchronous setup",
);
assert.match(
  retryAgentsRouteSource,
  /signal\.throwIfAborted\(\);\s*return \{[\s\S]{0,220}macroVariables/u,
  "Retry macro persistence must re-check cancellation when its queued write begins",
);
assert.match(
  retryAgentsRouteSource,
  /const assertRetryActive = \(\) => signal\.throwIfAborted\(\);[\s\S]{0,300}const sortedResults/u,
  "Retry side effects must use the native abort guard across awaited writes and events",
);
assert.match(
  retryAgentsRouteSource,
  /const rawResult = await executeAgent\([\s\S]{0,350}if \(baseContext\.signal\?\.aborted\) return results;/u,
  "Lorebook retries must stop after provider completion",
);
assert.match(
  retryAgentsRouteSource,
  /preferredTargetLorebookId = await persistLorebookKeeperUpdates\([\s\S]{0,700}signal: baseContext\.signal/u,
  "Lorebook retry persistence must receive the shared cancellation signal",
);
assert.match(
  lorebookKeeperUtilsSource,
  /signal\?\.throwIfAborted\(\);\s*const (?:created|updated) = await lorebooksStore\.(?:create|updateEntry|createEntry)/u,
  "Lorebook persistence must honor retry cancellation before database writes",
);

// What a retried lorebook agent's results carry with them. No running test checks these yet.
assert.match(
  retryAgentsRouteSource,
  /const customWritableLorebookIds =\s*!isBuiltInLorebookAgent && resultAgent[\s\S]{0,220}resolveCustomWritableLorebookIds\(resultAgent\.settings\)[\s\S]{0,900}writableLorebooks/u,
  "Custom-agent retry approvals must carry that agent's writable lorebook routing metadata",
);
assert.match(
  retryAgentsRouteSource,
  /for \(const entry of lorebookKeeperRunEntries\)[\s\S]{0,900}messageId: entry\.messageId,[\s\S]{0,80}swipeIndex: entry\.swipeIndex/u,
  "Lorebook Keeper backfill results retain each target message and swipe anchor",
);
