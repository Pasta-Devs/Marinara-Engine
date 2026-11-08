/**
 * Capability API 1.818: `api.runtime.embeddingsFor(connectionId)` on a live package runtime host. `null` is the
 * built-in local MiniLM host even with an app-wide default set; a connection id is that connection's own embedding
 * source, never the default; an unknown id or a connection without embeddings resolves null; the host keeps the
 * text caps, passes the input type through, and a failing endpoint resolves null instead of throwing.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapabilityRuntimeHost } from "../../packages/shared/src/types/capability-runtime.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-embeddings-for-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { capabilityModuleRuntime } =
  await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
const { getCapabilityService } =
  await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
const { createCapabilityEmbeddingHost } =
  await import("../../packages/server/src/services/capability-packages/capability-embedding.service.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY } = await import("../../packages/shared/src/types/connection.js");
const { supportedCapabilityApi } = await import("../../packages/shared/src/schemas/capability-package.schema.js");

assert.ok(supportedCapabilityApi.major === 1 && supportedCapabilityApi.minor >= 818, "embeddingsFor ships as 1.818");

const hits: Array<{ path: string; model?: string; input?: string[] }> = [];
const MAX_FIXTURE_BODY = 64_000;
const provider = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > MAX_FIXTURE_BODY) {
      response.writeHead(413).end();
      request.destroy();
    }
  });
  request.on("end", () => {
    if (response.writableEnded) return;
    const parsed = body ? (JSON.parse(body) as { model?: string; input?: string[] }) : {};
    hits.push({ path: request.url ?? "", model: parsed.model, input: parsed.input });
    if (request.url?.startsWith("/fail/")) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "embedding backend is down" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: (parsed.input ?? []).map((_, index) => ({ index, embedding: [1, 0] })) }));
  });
});

const source = `export function activate(context) {
  context.api.registerService("embeddings-for-probe:runtime", context.api.runtime);
}
`;
const manifest = {
  schemaVersion: 1,
  id: "embeddings-for-probe",
  name: "embeddings-for-probe",
  version: "1.0.0",
  description: "embeddingsFor proof",
  engine: { min: "2.3.0", maxExclusive: "3.0.0" },
  kind: ["agent"],
  entrypoints: { server: "server.mjs" },
  permissions: ["chat-read"],
  restartRequired: false,
  files: [
    {
      path: "server.mjs",
      bytes: Buffer.byteLength(source),
      sha256: createHash("sha256").update(source).digest("hex"),
    },
  ],
};
const root = join(dir, "capability-packages", "versions", manifest.id, manifest.version);
mkdirSync(root, { recursive: true });
writeFileSync(join(root, "server.mjs"), source);
writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
writeFileSync(
  join(dir, "capability-packages", "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: manifest.id,
        version: manifest.version,
        manifest,
        installedAt: new Date().toISOString(),
        status: "active",
        readiness: "ready",
        error: null,
        legacy: false,
      },
    ],
  }),
);

const db = await getDB();
const app = Fastify();
app.decorate("db", db);

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  const connections = createConnectionsStorage(db);
  const create = async (fields: Record<string, unknown>) => {
    const row = await connections.create({
      provider: "custom",
      model: "fixture-chat",
      apiKey: "k",
      ...fields,
    } as never);
    assert.ok(row, `fixture ${String(fields.name)} is created`);
    return row;
  };
  const fallback = await create({ name: "Default", baseUrl: `${origin}/default/v1`, embeddingModel: "default-embed" });
  const own = await create({
    name: "Own",
    baseUrl: `${origin}/own/v1`,
    embeddingModel: "intfloat/multilingual-e5-small",
  });
  const plain = await create({ name: "Plain", baseUrl: `${origin}/plain/v1` });
  const failing = await create({ name: "Failing", baseUrl: `${origin}/fail/v1`, embeddingModel: "fail-embed" });
  // The app-wide default must never answer for embeddingsFor.
  await createAppSettingsStorage(db).set(DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY, fallback.id);

  assert.equal((await capabilityModuleRuntime.activatePackage(app, manifest.id)).readiness, "ready");
  const runtime = getCapabilityService<CapabilityRuntimeHost>("embeddings-for-probe:runtime");
  assert.ok(runtime && typeof runtime.embeddingsFor === "function", "the runtime host offers embeddingsFor");

  // null: the built-in local MiniLM host, not the default.
  const builtIn = await runtime.embeddingsFor(null);
  const local = createCapabilityEmbeddingHost();
  assert.ok(builtIn);
  assert.equal(builtIn.spaceId, local.spaceId);
  assert.equal(builtIn.label, local.label);

  // Unknown ids and a connection with no embedding settings resolve null, without throwing or calling anything.
  hits.length = 0;
  assert.equal(await runtime.embeddingsFor("no-such-connection"), null);
  assert.equal(await runtime.embeddingsFor(""), null);
  assert.equal(await runtime.embeddingsFor(plain.id), null, "the app-wide default does not stand in");
  assert.deepEqual(hits, []);

  // A connection with its own embedding model: that source, its label and space, with the input type passed through.
  const chosen = await runtime.embeddingsFor(own.id);
  assert.ok(chosen);
  assert.equal(chosen.label, "Own (intfloat/multilingual-e5-small)");
  assert.match(chosen.spaceId, /^remote:/u);
  assert.notEqual(chosen.spaceId, local.spaceId);
  hits.length = 0;
  assert.deepEqual(await chosen.embed(["Where is the lighthouse?"], undefined, "query"), [[1, 0]]);
  assert.deepEqual(await chosen.embed(["The lighthouse stands on the cliff."]), [[1, 0]]);
  assert.deepEqual(hits, [
    { path: "/own/v1/embeddings", model: "intfloat/multilingual-e5-small", input: ["query: Where is the lighthouse?"] },
    {
      path: "/own/v1/embeddings",
      model: "intfloat/multilingual-e5-small",
      input: ["passage: The lighthouse stands on the cliff."],
    },
  ]);
  const defaultSpace = (await runtime.resolveEmbeddings()).spaceId;
  assert.notEqual(chosen.spaceId, defaultSpace, "the chosen source is not the default's space");

  // The same caps as the configured host: nothing is sent past them.
  hits.length = 0;
  assert.equal(await chosen.embed([]), null);
  assert.equal(await chosen.embed(Array.from({ length: 129 }, () => "x")), null);
  assert.equal(await chosen.embed(["x".repeat(200_001)]), null);
  assert.deepEqual(hits, []);

  // A failing endpoint resolves null, as other package embeddings do, instead of throwing the provider error.
  const broken = await runtime.embeddingsFor(failing.id);
  assert.ok(broken);
  assert.equal(await broken.embed(["anything"]), null);
} finally {
  await capabilityModuleRuntime.stop();
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("embeddingsFor resolves the built-in model, a chosen connection's own source, or null.");
