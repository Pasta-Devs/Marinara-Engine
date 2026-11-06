// POST /api/generate/raw takes `debugMode` (Capability API 1.386), so a package can show the user the
// prompt it really sent. With it, the final provider messages and the reply are logged, streaming or not,
// and never the connection's key; without it (and without DEBUG_AGENTS) nothing is.
// A client that leaves mid-run (a reload) stops the provider call instead of letting it generate for nobody.
//
// Project imports are dynamic, after the env assignments, so nothing opens a real data folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-raw-generation-debug-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
delete process.env.DEBUG_AGENTS;

let hungRequestClosed = false;
let hungRequestArrived: () => void = () => {};
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (JSON.stringify(body.messages).includes("Hang.")) {
    // Never answers: only the Engine dropping the upstream request ends it.
    response.on("close", () => {
      hungRequestClosed = true;
    });
    hungRequestArrived();
    return;
  }
  const content = "The quill scratched on.";
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
  );
});

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { registerRawRoute } = await import("../../packages/server/src/routes/generate/raw-route.js");

// Debug mode logs at warn when the level hides debug (logDebugOverride); keep only the raw route's lines.
const logged: string[] = [];
const capture = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("[debug/raw]")) logged.push(args.map(String).join(" "));
};
logger.warn = capture as typeof logger.warn;
logger.debug = capture as typeof logger.debug;

const db = await createFileNativeDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(registerRawRoute, { prefix: "/api/generate" });

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Raw fixture",
    provider: "custom",
    model: "fixture-model",
    apiKey: "fixture-secret-key",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
  });
  assert(connection);
  const raw = (body: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/generate/raw",
      payload: {
        connectionId: connection.id,
        messages: [
          { role: "system", content: "You write the next chapter." },
          { role: "user", content: "Continue." },
        ],
        ...body,
      },
    });

  assert.equal((await raw({ debugMode: "yes" })).statusCode, 400, "debugMode is a boolean");
  assert.equal(
    (await raw({ connectionId: "missing", debugMode: true })).statusCode,
    404,
    "the strict body schema accepts debugMode",
  );

  const plain = await raw({ runId: "plain-run" });
  assert.equal(plain.statusCode, 200);
  assert.equal(plain.json().content, "The quill scratched on.");
  assert.equal(logged.length, 0, "nothing is logged without debug mode");

  const debugged = await raw({ runId: "debug-run", debugMode: true });
  assert.equal(debugged.statusCode, 200);
  assert.equal(debugged.json().content, "The quill scratched on.");
  assert.equal(logged.length, 2);
  assert.match(logged[0]!, /^\[debug\/raw\] prompt for %s \(%s \/ %s\):\n%s debug-run custom fixture-model /u);
  assert.match(logged[0]!, /"role": "system",\n\s+"content": "You write the next chapter\."/u);
  assert.match(logged[0]!, /"role": "user",\n\s+"content": "Continue\."/u);
  assert.match(logged[1]!, /^\[debug\/raw\] response for %s:\n%s debug-run The quill scratched on\.$/u);

  const streamed = await raw({ runId: "stream-run", debugMode: true, streaming: true });
  assert.equal(streamed.statusCode, 200);
  assert.match(streamed.body, /"type":"result","data":\{"content":"The quill scratched on\."\}/u);
  assert.equal(logged.length, 4);
  assert.match(logged[2]!, /prompt for %s .* stream-run custom fixture-model /su);
  assert.match(logged[3]!, /response for %s:\n%s stream-run The quill scratched on\.$/u);

  assert.ok(
    logged.every((line) => !line.includes("fixture-secret-key")),
    "the debug lines never carry the connection's key",
  );

  await app.listen({ port: 0, host: "127.0.0.1" });
  const engineAddress = app.server.address();
  assert(engineAddress && typeof engineAddress === "object");
  for (const streaming of [true, false]) {
    hungRequestClosed = false;
    const arrived = new Promise<void>((resolve) => {
      hungRequestArrived = resolve;
    });
    const client = new AbortController();
    const pending = fetch(`http://127.0.0.1:${engineAddress.port}/api/generate/raw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: connection.id,
        messages: [{ role: "user", content: "Hang." }],
        streaming,
        runId: `left-${streaming}`,
      }),
      signal: client.signal,
    }).then(
      (response) => response.text(),
      () => null,
    );
    // Leave only once the provider holds the request, so its close listener is in place.
    await arrived;
    client.abort();
    await pending.catch(() => null);
    for (let waited = 0; !hungRequestClosed && waited < 3000; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(hungRequestClosed, `a client leaving a ${streaming ? "streaming" : "plain"} run stops the provider call`);
  }
  console.log("raw generation debug regression passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}
