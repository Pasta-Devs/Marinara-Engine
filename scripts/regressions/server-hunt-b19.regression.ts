import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b19-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { registerRawRoute } = await import("../../packages/server/src/routes/generate/raw-route.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { formatLorebookWriteApprovalText } =
  await import("../../packages/server/src/routes/generate/agent-write-approval.js");
const {
  CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY,
  readCustomLorebookBackfillCursorPayload,
  shouldAdvanceCustomLorebookBackfillCursor,
} = await import("../../packages/server/src/routes/generate/lorebook-keeper-utils.js");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(20);
  }
  return check();
}

// Fake OpenAI-compatible upstream: streams one token, then hangs until the
// caller hangs up. Records when the upstream request is closed.
let upstreamRequests = 0;
let upstreamClosed = 0;
const upstream = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  upstreamRequests++;
  res.on("close", () => {
    upstreamClosed++;
  });
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.write(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Partial" }, finish_reason: null }] })}\n\n`,
  );
  // Never finish: only an abort from the server under test ends this request.
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(async (instance) => registerRawRoute(instance), { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

function parseSse(text: string): Array<{ type: string; data: unknown }> {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; data: unknown });
}

try {
  await new Promise<void>((done) => upstream.listen(0, "127.0.0.1", done));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Raw fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
  });
  assert.ok(connection);
  const baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });

  // Finding 1: a client disconnect must abort the upstream /raw generation.
  {
    const clientAbort = new AbortController();
    const response = await fetch(`${baseUrl}/api/generate/raw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: connection.id,
        messages: [{ role: "user", content: "hello" }],
        streaming: true,
      }),
      signal: clientAbort.signal,
    });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    let seen = "";
    while (!seen.includes('"token"')) {
      const { value, done } = await reader.read();
      if (done) break;
      seen += new TextDecoder().decode(value);
    }
    assert.ok(seen.includes('"token"'), "raw stream should deliver the first upstream token");
    const closedBefore = upstreamClosed;
    clientAbort.abort();
    await reader.cancel().catch(() => undefined);
    assert.ok(
      await waitFor(() => upstreamClosed > closedBefore, 3000),
      "a client disconnect from POST /raw must abort the upstream model request",
    );
  }

  // Finding 2: /raw/abort after partial output must report "aborted", not a normal result.
  {
    const runId = "b19-partial-abort";
    const responsePromise = fetch(`${baseUrl}/api/generate/raw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: connection.id,
        messages: [{ role: "user", content: "hello" }],
        streaming: true,
        runId,
      }),
    });
    const response = await responsePromise;
    const reader = response.body!.getReader();
    let text = "";
    while (!text.includes('"token"')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    const abortResponse = await fetch(`${baseUrl}/api/generate/raw/abort`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    assert.deepEqual(await abortResponse.json(), { aborted: true });
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    const events = parseSse(text);
    const types = events.map((event) => event.type);
    assert.ok(types.includes("aborted"), `an aborted partial run must emit "aborted" (got ${types.join(",")})`);
    assert.ok(!types.includes("result"), "an aborted partial run must not emit a normal result");
    const abortedEvent = events.find((event) => event.type === "aborted");
    assert.deepEqual(abortedEvent?.data, { content: "Partial" }, "the aborted event carries the partial text");
  }

  // Finding 3: game-map sync on agent retry must patch fresh metadata, not replace the stale blob.
  {
    const source = readFileSync(
      new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
      "utf8",
    );
    const syncIndex = source.indexOf("syncGameMapMetaPartyPosition(freshMeta, nextLocation)");
    assert.ok(syncIndex > 0, "retry map sync must run against fresh metadata inside patchMetadata");
    const block = source.slice(
      source.lastIndexOf("if (retryCompatibilityLocation === null) {", syncIndex),
      syncIndex + 1500,
    );
    assert.ok(block.includes("chats.patchMetadata(chatId, (freshMeta)"), "retry map sync must use patchMetadata");
    assert.ok(!block.includes("chats.updateMetadata("), "retry map sync must not whole-blob replace metadata");
    assert.ok(
      !source.includes("syncGameMapMetaPartyPosition(chatMeta, nextLocation)"),
      "retry map sync must not compute from the request-start metadata snapshot",
    );
  }

  // Finding 4: approving a custom-agent backfill proposal advances its cursor.
  {
    assert.equal(readCustomLorebookBackfillCursorPayload(null), null);
    assert.equal(readCustomLorebookBackfillCursorPayload({ agentConfigId: "a" }), null);
    assert.deepEqual(readCustomLorebookBackfillCursorPayload({ agentConfigId: " a ", messageId: "m" }), {
      agentConfigId: "a",
      messageId: "m",
    });
    assert.equal(shouldAdvanceCustomLorebookBackfillCursor(["m1", "m2"], null, "m2"), true);
    assert.equal(shouldAdvanceCustomLorebookBackfillCursor(["m1", "m2"], "m1", "m2"), true);
    assert.equal(shouldAdvanceCustomLorebookBackfillCursor(["m1", "m2"], "m2", "m1"), false, "never rewinds");
    assert.equal(shouldAdvanceCustomLorebookBackfillCursor(["m1", "m2"], null, "gone"), false);

    const retrySource = readFileSync(
      new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
      "utf8",
    );
    assert.ok(
      retrySource.includes(
        "backfillCursor: { agentConfigId: backfillTarget.agentConfigId, messageId: backfillTarget.messageId }",
      ),
      "pending backfill proposals must carry their cursor in the approval payload",
    );
    // Logging pass: a failed cursor advance is a suppressed best-effort failure, not a bare logger.warn.
    const chatsSource = readFileSync(new URL("../../packages/server/src/routes/chats.routes.ts", import.meta.url), "utf8");
    const cursorBlock = chatsSource.slice(chatsSource.indexOf("readCustomLorebookBackfillCursorPayload(payload.backfillCursor)"));
    assert.ok(
      cursorBlock.slice(0, 1500).includes('stage: "backfill-cursor.approval-commit"'),
      "cursor advance failures must go through logSuppressed",
    );

    const chats = createChatsStorage(db);
    const agents = createAgentsStorage(db);
    const chat = await chats.create({ name: "Backfill approval", mode: "roleplay", characterIds: [] });
    assert.ok(chat);
    const messageIds: string[] = [];
    for (let index = 0; index < 4; index++) {
      const message = await chats.createMessage({
        chatId: chat.id,
        role: index % 2 ? "assistant" : "user",
        characterId: null,
        content: `Message ${index}`,
      });
      assert.ok(message);
      messageIds.push(message.id);
      await sleep(5);
    }
    const agentConfigId = "b19-custom-agent";
    const commit = (messageId: string) =>
      app.inject({
        method: "POST",
        url: `/api/chats/${chat.id}/agent-write-approval/commit`,
        payload: {
          kind: "lorebook_update",
          text: formatLorebookWriteApprovalText([
            { name: `Entry ${messageId}`, keys: ["entry"], tag: "", content: "Backfilled fact." },
          ]),
          payload: { backfillCursor: { agentConfigId, messageId } },
        },
      });
    const first = await commit(messageIds[1]!);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(
      (await agents.getMemory(agentConfigId, chat.id))[CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY],
      messageIds[1],
      "committing an approval-gated backfill proposal must advance the backfill cursor",
    );
    const second = await commit(messageIds[3]!);
    assert.equal(second.statusCode, 200, second.body);
    const stale = await commit(messageIds[1]!);
    assert.equal(stale.statusCode, 200, stale.body);
    assert.equal(
      (await agents.getMemory(agentConfigId, chat.id))[CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY],
      messageIds[3],
      "approving a stale duplicate proposal must not rewind the cursor",
    );
    const plain = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/agent-write-approval/commit`,
      payload: {
        kind: "lorebook_update",
        text: formatLorebookWriteApprovalText([{ name: "Plain", keys: ["plain"], tag: "", content: "No cursor." }]),
        payload: {},
      },
    });
    assert.equal(plain.statusCode, 200, plain.body);
  }
} finally {
  upstream.closeAllConnections();
  await new Promise<void>((done) => upstream.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
assert.ok(upstreamRequests >= 2);
process.stdout.write("server-hunt-b19 regressions passed.\n");
