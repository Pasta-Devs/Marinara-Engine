import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TFunction } from "i18next";
import {
  createConnectionSchema,
  DECISION_TIMEOUT_MS,
  decisionTestTimeoutMs,
  resolveDecisionConnectionTimeoutMs,
} from "../../packages/shared/src/index.js";
import { resolveDecisionConnection } from "../../packages/server/src/services/decision/decision-connection.js";
import { resolveDecisionBackend } from "../../packages/server/src/services/decision/decision-default.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import {
  createConnectionExportEnvelope,
  normalizeImportedConnectionEntry,
} from "../../packages/client/src/lib/connection-transfer.js";
import { decisionConnectionTestMessage } from "../../packages/client/src/lib/decision-test-message.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

// ── the limit itself ─────────────────────────────────────────────────────────

assert.equal(resolveDecisionConnectionTimeoutMs(undefined), DECISION_TIMEOUT_MS.systemOne);
assert.equal(resolveDecisionConnectionTimeoutMs(null), DECISION_TIMEOUT_MS.systemOne);
assert.equal(resolveDecisionConnectionTimeoutMs(Number.NaN), DECISION_TIMEOUT_MS.systemOne);
assert.equal(resolveDecisionConnectionTimeoutMs(3000), 3000);
assert.equal(resolveDecisionConnectionTimeoutMs(10), 500, "raised to the minimum");
assert.equal(resolveDecisionConnectionTimeoutMs(99_999), 30_000, "lowered to the maximum");
const decisionInput = { name: "Decision", provider: "decision", decisionSource: "custom" };
assert.equal(createConnectionSchema.parse(decisionInput).decisionTimeoutMs, null, "unset means the default");
assert.throws(() => createConnectionSchema.parse({ ...decisionInput, decisionTimeoutMs: 100 }));
assert.throws(() => createConnectionSchema.parse({ ...decisionInput, decisionTimeoutMs: 60_000 }));
assert.equal(decisionTestTimeoutMs(1500), 10_000, "Test waits at least 10 s");
assert.equal(decisionTestTimeoutMs(30_000), 35_000, "and past a long limit, so a late answer still shows its time");

// ── the Test message ─────────────────────────────────────────────────────────

// The same formatting the message uses, so the check holds in any locale.
const seconds = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
const t = ((key: string, options?: Record<string, unknown>) =>
  options && Object.keys(options).length > 0 ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;
const within = decisionConnectionTestMessage(t, {
  success: true,
  message: "",
  modelName: null,
  decisionProbability: 0.8,
  latencyMs: 900,
  timeLimitMs: 1500,
});
assert.equal(within.ok, true);
assert.match(within.message, /^connections\.decision\.testSuccess /);
assert.ok(within.message.includes(`"limit":"${seconds(1.5)}"`), within.message);
const slow = decisionConnectionTestMessage(t, {
  success: true,
  message: "",
  modelName: null,
  decisionProbability: 0.8,
  latencyMs: 1840,
  timeLimitMs: 1500,
});
assert.equal(slow.ok, false, "an answer after the limit is no answer during chats");
assert.match(slow.message, /^connections\.decision\.testTooSlow /);
assert.ok(slow.message.includes(`"seconds":"${seconds(1.84)}"`), slow.message);
const gaveUp = decisionConnectionTestMessage(t, {
  success: false,
  message: "",
  modelName: null,
  errorCode: "timeout",
  latencyMs: 10_000,
  timeLimitMs: 1500,
  testTimeoutMs: 10_000,
});
assert.equal(gaveUp.ok, false);
assert.match(gaveUp.message, /connections\.decision\.errors\.testTimeout/);
assert.ok(gaveUp.message.includes(`seconds\\":\\"${seconds(10)}`), gaveUp.message);

// ── storage, chats and the Test route ────────────────────────────────────────

const directory = mkdtempSync(join(tmpdir(), "marinara-decision-time-limit-"));
const previousDirectory = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = directory;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/connections" });

let delayMs = 0;
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (res.destroyed) return;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 0.8 }])),
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");

try {
  const connection = await storage.create(
    createConnectionSchema.parse({
      ...decisionInput,
      baseUrl: `http://127.0.0.1:${address.port}`,
      model: "open-jev",
    }),
  );
  assert.ok(connection);
  const resolve = async () =>
    (await resolveDecisionConnection((await storage.getWithKey(connection.id))!, (id) => storage.getWithKey(id)))
      .connection!;
  assert.equal((await resolve()).timeoutMs, DECISION_TIMEOUT_MS.systemOne, "no limit set reads as the default");
  const created = await storage.create(
    createConnectionSchema.parse({ ...decisionInput, baseUrl: "http://127.0.0.1:1", decisionTimeoutMs: 2500 }),
  );
  assert.equal(
    (await resolveDecisionConnection((await storage.getWithKey(created!.id))!, (id) => storage.getWithKey(id)))
      .connection!.timeoutMs,
    2500,
    "a limit chosen when the connection is created is kept",
  );

  // Chats use the connection's own limit: the same slow answer is lost at 0.5 s and kept at 2 s.
  const backend = () =>
    resolveDecisionBackend({
      getLocalDefault: async () => null,
      getThinkingPreGeneration: async () => false,
      getDefaultConnection: () => storage.getWithKey(connection.id),
      getConnectionWithKey: (id) => storage.getWithKey(id),
    });
  const ask = async () =>
    (await backend())!.ask({ recent_messages: [{ role: "user", content: "The door is open." }] }, [
      { id: "q", instructions: "The door is open." },
    ]);
  delayMs = 1000;
  await storage.update(connection.id, { decisionTimeoutMs: 500 });
  assert.equal((await resolve()).timeoutMs, 500);
  assert.equal((await ask())?.get("q"), undefined, "an answer after the limit counts as no answer");
  await storage.update(connection.id, { decisionTimeoutMs: 2000 });
  assert.equal((await ask())?.get("q"), 0.8, "a longer limit keeps the same answer");

  // Test waits past the limit and reports the real time next to it.
  await storage.update(connection.id, { decisionTimeoutMs: 500 });
  const slowTest = (await app.inject({ method: "POST", url: `/connections/${connection.id}/test` })).json();
  assert.equal(slowTest.success, true, "the answer still arrives within the Test's own wait");
  assert.ok(slowTest.latencyMs >= 1000, `latency ${slowTest.latencyMs}`);
  assert.equal(slowTest.timeLimitMs, 500);
  assert.equal(slowTest.testTimeoutMs, 10_000);
  assert.equal(decisionConnectionTestMessage(t, slowTest).ok, false);
  delayMs = 0;
  await storage.update(connection.id, { decisionTimeoutMs: 12_000 });
  const longTest = (await app.inject({ method: "POST", url: `/connections/${connection.id}/test` })).json();
  assert.equal(longTest.testTimeoutMs, 17_000, "a long limit extends the wait past it");
  assert.equal(decisionConnectionTestMessage(t, longTest).ok, true);

  // Duplicates keep it, and clearing it returns to the default.
  assert.equal((await storage.duplicate(connection.id))!.decisionTimeoutMs, 12_000);
  await storage.update(connection.id, { decisionTimeoutMs: null });
  assert.equal((await resolve()).timeoutMs, DECISION_TIMEOUT_MS.systemOne);

  // Export and import keep a chosen limit and leave an unset one unset.
  await storage.update(connection.id, { decisionTimeoutMs: 3000 });
  const exported = createConnectionExportEnvelope([(await storage.getById(connection.id))!]).connections[0]!;
  assert.equal(exported.decisionTimeoutMs, 3000);
  assert.equal(normalizeImportedConnectionEntry(exported)!.connection.decisionTimeoutMs, 3000);
  assert.equal(
    normalizeImportedConnectionEntry({ ...exported, decisionTimeoutMs: "2500" })!.connection.decisionTimeoutMs,
    2500,
  );
  assert.equal(
    normalizeImportedConnectionEntry({ ...exported, decisionTimeoutMs: 100 })!.connection.decisionTimeoutMs,
    500,
  );
  assert.equal(
    normalizeImportedConnectionEntry({ ...exported, decisionTimeoutMs: undefined })!.connection.decisionTimeoutMs,
    null,
  );
  assert.equal(
    normalizeImportedConnectionEntry({ ...exported, provider: "openai", decisionTimeoutMs: 3000 })!.connection
      .decisionTimeoutMs,
    null,
    "only a Decision connection carries it",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Decision connection time limit regression passed.");
