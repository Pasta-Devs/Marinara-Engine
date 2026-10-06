/**
 * A TypeSafe Decision connection sent to another address that serves TypeSafe's API (#7084).
 *
 * A blank address keeps TypeSafe's own. A set one is used by chats and by Test, under the
 * same URL checks and connection policy as a Custom System One server, and the connection
 * keeps TypeSafe's key rules. TypeSafe itself is never contacted: a stand-in server on
 * 127.0.0.1 answers instead.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConnectionSchema,
  DECISION_TIMEOUT_MS,
  DEFAULT_DECISION_CALIBRATION,
} from "../../packages/shared/src/index.js";
import {
  resolveDecisionConnection,
  type DecisionConnectionRow,
} from "../../packages/server/src/services/decision/decision-connection.js";
import { resolveDecisionBackend } from "../../packages/server/src/services/decision/decision-default.js";
import {
  askNoulQuestions,
  postDecisionRequest,
} from "../../packages/server/src/services/decision/system-one.client.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const requests: Array<{ path: string; authorization?: string; body: Record<string, unknown> }> = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
  requests.push({ path: req.url ?? "", authorization: req.headers.authorization, body });
  if (req.method !== "POST" || req.url !== "/v1/systemone") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 page not found");
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      answers: Object.fromEntries(Object.keys(body.questions as object).map((id) => [id, { type: "noul", noul: 0.8 }])),
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const directory = mkdtempSync(join(tmpdir(), "marinara-decision-typesafe-address-"));
const previousDirectory = process.env.FILE_STORAGE_DIR;
const previousLocalUrls = process.env.PROVIDER_LOCAL_URLS_ENABLED;
process.env.FILE_STORAGE_DIR = directory;
delete process.env.PROVIDER_LOCAL_URLS_ENABLED;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/connections" });

const row = (fields: Partial<DecisionConnectionRow>): DecisionConnectionRow => ({
  id: "typesafe",
  provider: "decision",
  decisionSource: "typesafe",
  baseUrl: "",
  model: "",
  apiKey: "ts-key",
  ...fields,
});
const noLink = async () => null;
const state = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] };
const question = [{ id: "door", instructions: "The door is open." }];

try {
  // ── without an address: TypeSafe's own, as before ──────────────────────────
  for (const baseUrl of ["", "  ", "https://api.typesafe.ai", "https://api.typesafe.ai/"]) {
    const resolved = await resolveDecisionConnection(row({ baseUrl }), noLink);
    assert.equal(
      resolved.connection?.endpoint,
      "https://api.typesafe.ai/v1/systemone",
      `base URL ${JSON.stringify(baseUrl)}`,
    );
    assert.equal(resolved.connection?.apiKey, "ts-key");
  }
  assert.equal(
    (await resolveDecisionConnection(row({ decisionSource: null }), noLink)).connection?.endpoint,
    "https://api.typesafe.ai/v1/systemone",
    "a row saved before sources existed is TypeSafe",
  );
  assert.equal(
    (await resolveDecisionConnection(row({ decisionSource: "openrouter", baseUrl: origin }), noLink)).connection
      ?.endpoint,
    "https://openrouter.ai/api/v1/systemone",
    "OpenRouter stays pinned",
  );

  // ── with an address: requests go there, with TypeSafe's key and defaults ────
  const custom = await storage.create(
    createConnectionSchema.parse({
      name: "TypeSafe elsewhere",
      provider: "decision",
      decisionSource: "typesafe",
      baseUrl: `${origin}/`,
      apiKey: "ts-key",
      model: "jev-latest",
    }),
  );
  const resolved = await resolveDecisionConnection((await storage.getWithKey(custom!.id))!, (id) =>
    storage.getWithKey(id),
  );
  assert.ok(resolved.connection, resolved.error);
  assert.equal(resolved.connection.endpoint, `${origin}/v1/systemone`);
  assert.equal(resolved.connection.protocol, "system_one");
  assert.equal(resolved.connection.apiKey, "ts-key");
  assert.equal(resolved.connection.model, "jev-latest");
  assert.equal(resolved.connection.maxStateTokens, 30000, "TypeSafe's hosted budget, not a custom server's");
  assert.equal(resolved.connection.timeoutMs, DECISION_TIMEOUT_MS.systemOne);

  const asked = await askNoulQuestions({
    connection: resolved.connection,
    state,
    questions: question,
    timeoutMs: 2000,
  });
  assert.equal(asked.error, undefined);
  assert.equal(asked.answers.get("door"), 0.8);
  assert.deepEqual(
    requests.map(({ path, authorization }) => ({ path, authorization })),
    [{ path: "/v1/systemone", authorization: "Bearer ts-key" }],
  );
  assert.equal(requests[0]!.body.model, "jev-latest");

  // Chats use it, on the documented operating point.
  requests.length = 0;
  const backend = (await resolveDecisionBackend({
    getLocalDefault: async () => null,
    getThinkingPreGeneration: async () => false,
    getDefaultConnection: () => storage.getWithKey(custom!.id),
    getConnectionWithKey: (id) => storage.getWithKey(id),
  }))!;
  assert.deepEqual(backend.calibration, DEFAULT_DECISION_CALIBRATION);
  assert.equal(backend.maxStateTokens, 30000);
  assert.equal((await backend.ask(state, question))!.get("door"), 0.8);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.authorization, "Bearer ts-key");

  // So does Test.
  requests.length = 0;
  const tested = (await app.inject({ method: "POST", url: `/connections/${custom!.id}/test` })).json();
  assert.equal(tested.success, true, JSON.stringify(tested));
  assert.equal(tested.decisionProbability, 0.8);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.path, "/v1/systemone");
  assert.equal(requests[0]!.authorization, "Bearer ts-key");

  // ── TypeSafe's key rules are kept ──────────────────────────────────────────
  assert.equal(
    (await resolveDecisionConnection(row({ baseUrl: origin, apiKey: " " }), noLink)).error,
    "missing_key",
    "unlike a Custom System One server, TypeSafe always needs a key",
  );
  const chat = await storage.create(
    createConnectionSchema.parse({ name: "Same host", provider: "custom", baseUrl: `${origin}/v1`, apiKey: "lent" }),
  );
  assert.equal(
    (
      await resolveDecisionConnection(
        row({ baseUrl: origin, apiKey: "", credentialsFromConnectionId: chat!.id }),
        (id) => storage.getWithKey(id),
      )
    ).error,
    "needs_relinking",
    "an address never lets TypeSafe borrow another connection's key",
  );

  // ── the same URL checks and connection policy as a Custom server ───────────
  for (const baseUrl of [
    "ftp://decisions.example.com",
    "https://user:secret@decisions.example.com",
    "https://decisions.example.com/?key=1",
    "https://decisions.example.com/#top",
    "not a url",
  ]) {
    assert.equal(
      (await resolveDecisionConnection(row({ baseUrl }), noLink)).error,
      (await resolveDecisionConnection(row({ decisionSource: "custom", baseUrl }), noLink)).error,
      `same verdict as Custom for ${baseUrl}`,
    );
    assert.equal((await resolveDecisionConnection(row({ baseUrl }), noLink)).error, "invalid_url", baseUrl);
  }
  // A TypeSafe address follows the same rules as any other connection's Base URL (#7134):
  // remote http, local names and https all resolve, exactly as they do for a Custom source.
  for (const baseUrl of [
    "http://decisions.example.com",
    "http://203.0.113.7:8791",
    "http://jev.local:8791",
    "http://host.docker.internal:8791",
    "https://decisions.example.com",
    "http://localhost:8791",
    "http://[::1]:8791",
    "http://192.168.1.20:8791",
  ]) {
    const typesafe = await resolveDecisionConnection(row({ baseUrl }), noLink);
    assert.ok(typesafe.connection, `${baseUrl}: ${typesafe.error}`);
    assert.equal(typesafe.connection.endpoint, `${baseUrl}/v1/systemone`);
    assert.equal(
      Boolean((await resolveDecisionConnection(row({ decisionSource: "custom", baseUrl }), noLink)).connection),
      true,
      `same verdict as Custom for ${baseUrl}`,
    );
  }
  // The provider URL policy refuses these before any connection is attempted. Matching the
  // flag name in the refusal tells it apart from an address that merely can't be reached.
  for (const baseUrl of ["http://10.0.0.2:8791", "http://169.254.169.254"]) {
    const blocked = (await resolveDecisionConnection(row({ baseUrl }), noLink)).connection!;
    assert.equal(blocked.endpoint, `${baseUrl}/v1/systemone`);
    await assert.rejects(
      postDecisionRequest(blocked.endpoint, blocked.apiKey, {}, AbortSignal.timeout(2000)),
      /PROVIDER_LOCAL_URLS_ENABLED/,
      `${baseUrl} needs PROVIDER_LOCAL_URLS_ENABLED`,
    );
  }
  const lan = await storage.create(
    createConnectionSchema.parse({
      name: "TypeSafe on the LAN",
      provider: "decision",
      decisionSource: "typesafe",
      baseUrl: "http://10.0.0.2:8791",
      apiKey: "ts-key",
    }),
  );
  const lanTest = (await app.inject({ method: "POST", url: `/connections/${lan!.id}/test` })).json();
  assert.equal(lanTest.success, false);
  assert.equal(lanTest.errorCode, "network", "Test reports the refusal as a network error");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  if (previousLocalUrls !== undefined) process.env.PROVIDER_LOCAL_URLS_ENABLED = previousLocalUrls;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Decision TypeSafe address regression passed.");
