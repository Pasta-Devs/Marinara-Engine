/**
 * The built-in embedding model: its own llama-server for semantic search, beside the built-in model.
 *
 * A stand-in llama-server checks what Marinara starts and sends: the model's own pooling and batch, query and
 * document prefixes, texts longer than the model's context cut through /tokenize, Unload stopping the process.
 * The Embeddings default takes it only once a model is downloaded, and removing the last model hands Embeddings
 * back to Marinara's own search. Switching models changes the embedding space, so old vectors are made again.
 */
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-builtin-embedding-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

// A stand-in llama-server: records its arguments and every request, embeds a text as [length, 1, 0, 0].
const fakeServer = join(dir, "fake-llama-server.mjs");
const requestLog = join(dir, "requests.jsonl");
writeFileSync(
  fakeServer,
  `#!/usr/bin/env node
import { appendFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]);
appendFileSync(${JSON.stringify(requestLog)}, JSON.stringify({ args }) + "\\n");
// A graphics-card plan fails the way llama-server does without a usable GPU; a marker file fails every start.
if (args[args.indexOf("-ngl") + 1] !== "0" || existsSync(${JSON.stringify(join(dir, "fail-start"))})) {
  console.error("ggml: no usable device for this backend");
  process.exit(1);
}
createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const json = body ? JSON.parse(body) : {};
    appendFileSync(${JSON.stringify(requestLog)}, JSON.stringify({ path: req.url, json }) + "\\n");
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") return res.end(JSON.stringify({ status: "ok" }));
    if (req.url === "/tokenize") return res.end(JSON.stringify({ tokens: json.content.split(" ").map((_, i) => i) }));
    if (req.url === "/detokenize") return res.end(JSON.stringify({ content: "cut:" + json.tokens.length }));
    if (req.url === "/v1/embeddings") {
      return res.end(JSON.stringify({ data: json.input.map((text, index) => ({ index, embedding: [text.length, 1, 0, 0] })) }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
}).listen(port, "127.0.0.1");
`,
);
chmodSync(fakeServer, 0o755);

const serverRequire = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = serverRequire("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { sidecarRuntimeService } =
  await import("../../../packages/server/src/services/sidecar/sidecar-runtime.service.js");
const { builtinEmbeddingService } =
  await import("../../../packages/server/src/services/sidecar/builtin-embedding.service.js");
const { resolvePseudoEmbeddingSource, resolveMemoryRecallEmbeddingSource, resolveMemoryRecallEmbeddingInputProfile } =
  await import("../../../packages/server/src/services/memory-recall-embedding.js");
const { builtinEmbeddingRoutes } = await import("../../../packages/server/src/routes/builtin-embedding.routes.js");
const { appSettingsRoutes } = await import("../../../packages/server/src/routes/app-settings.routes.js");
const { BUILTIN_EMBEDDING_CONNECTION_ID, BUILTIN_EMBEDDING_MODELS } =
  await import("../../../packages/shared/src/types/builtin-embedding.js");
const { DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY } = await import("../../../packages/shared/src/types/connection.js");

// The installed llama.cpp runtime is the built-in model's; here it is the stand-in.
Object.assign(sidecarRuntimeService, {
  getCurrentInstall: () => ({ serverPath: fakeServer, variant: "cpu", build: "test", backend: "llama_cpp" }),
  isGpuVariant: () => false,
});

const requests = () =>
  existsSync(requestLog)
    ? readFileSync(requestLog, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { args?: string[]; path?: string; json?: Record<string, unknown> })
    : [];

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(builtinEmbeddingRoutes, { prefix: "/api/builtin-embedding" });
await app.register(appSettingsRoutes, { prefix: "/api/settings" });
await app.ready();

try {
  // Query prefixes: Qwen3-Embedding instructs queries only; EmbeddingGemma marks both sides.
  const qwen = resolveMemoryRecallEmbeddingInputProfile("Qwen3-Embedding-0.6B");
  assert.match(qwen.queryPrefix, /^Instruct: .+\nQuery:$/u);
  assert.equal(qwen.documentPrefix, "");
  assert.equal(resolveMemoryRecallEmbeddingInputProfile("qwen/qwen3-embedding-8b").id, "qwen3-embedding");
  const gemma = resolveMemoryRecallEmbeddingInputProfile("EmbeddingGemma-300M");
  assert.equal(gemma.queryPrefix, "task: search result | query: ");
  assert.equal(gemma.documentPrefix, "title: none | text: ");

  // Nothing downloaded: no source, and the Embeddings default refuses it.
  assert.equal(resolvePseudoEmbeddingSource(BUILTIN_EMBEDDING_CONNECTION_ID), null);
  const refused = await app.inject({
    method: "PUT",
    url: `/api/settings/${DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY}`,
    payload: { connectionId: BUILTIN_EMBEDDING_CONNECTION_ID },
  });
  assert.equal(refused.statusCode, 400);

  // Both models "downloaded" (files in place, as a finished download leaves them).
  const models = Object.fromEntries(BUILTIN_EMBEDDING_MODELS.map((model) => [model.id, model]));
  const installed: Record<string, unknown> = {};
  for (const model of BUILTIN_EMBEDDING_MODELS) {
    mkdirSync(join(dir, "models", "builtin-embedding", model.id), { recursive: true });
    writeFileSync(join(dir, "models", "builtin-embedding", model.id, model.file), "gguf");
    installed[model.id] = { file: model.file, bytes: 4, downloadedAt: new Date().toISOString() };
  }
  writeFileSync(
    join(dir, "models", "builtin-embedding", "builtin-embedding-config.json"),
    JSON.stringify({ activeModelId: "qwen3-embedding-0.6b", device: "auto", installed }),
  );
  const { BuiltinEmbeddingService } =
    await import("../../../packages/server/src/services/sidecar/builtin-embedding.service.js");
  // The singleton read its config at import; a fresh one reads the files written above, then stands in for it.
  Object.assign(builtinEmbeddingService, { config: Reflect.get(new BuiltinEmbeddingService(), "config") });

  const accepted = await app.inject({
    method: "PUT",
    url: `/api/settings/${DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY}`,
    payload: { connectionId: BUILTIN_EMBEDDING_CONNECTION_ID },
  });
  assert.equal(accepted.statusCode, 200, accepted.body);

  // The Embeddings default resolves to it, and it starts with Qwen3's last-token pooling and a small batch.
  const source = await resolveMemoryRecallEmbeddingSource(db, {});
  assert.ok(source);
  assert.equal(source.model, "Qwen3-Embedding-0.6B");
  const qwenSpace = source.spaceId;
  const vectors = await source.embed(["The locket is under the floorboard."], undefined, "document");
  assert.deepEqual(vectors, [["The locket is under the floorboard.".length, 1, 0, 0]]);
  const started = requests().find((entry) => entry.args)!.args!;
  const arg = (name: string) => started[started.indexOf(name) + 1];
  assert.equal(arg("--pooling"), "last");
  assert.equal(arg("--ctx-size"), String(models["qwen3-embedding-0.6b"]!.contextSize));
  assert.equal(arg("--ubatch-size"), "512");
  assert.equal(arg("-ngl"), "0");
  assert.ok(started.includes("--embeddings"));

  // A query carries the instruction; a text longer than the context is cut to its first tokens.
  await source.embed(["Where is the locket?"], undefined, "query");
  const long = Array.from({ length: 5000 }, () => "word").join(" ");
  await source.embed([long], undefined, "document");
  const embedInputs = requests()
    .filter((entry) => entry.path === "/v1/embeddings")
    .map((entry) => (entry.json!.input as string[])[0]);
  assert.match(embedInputs[1]!, /^Instruct: .+\nQuery:Where is the locket\?$/u);
  assert.equal(embedInputs[2], `cut:${models["qwen3-embedding-0.6b"]!.contextSize - 8}`);
  // Short texts never go through /tokenize.
  assert.equal(requests().filter((entry) => entry.path === "/tokenize").length, 1);

  const running = await app.inject({ method: "GET", url: "/api/builtin-embedding/status" });
  assert.equal(running.json().running, true);
  assert.equal(running.json().activeModelId, "qwen3-embedding-0.6b");

  // Unload stops the process; the next search starts it again.
  const unloaded = await app.inject({ method: "POST", url: "/api/builtin-embedding/unload", payload: {} });
  assert.equal(unloaded.json().running, false);

  // Switching to EmbeddingGemma: mean pooling, a whole-text batch, and a different embedding space.
  const switched = await app.inject({
    method: "POST",
    url: "/api/builtin-embedding/use",
    payload: { modelId: "embeddinggemma-300m" },
  });
  assert.equal(switched.json().activeModelId, "embeddinggemma-300m");
  const gemmaSource = await resolveMemoryRecallEmbeddingSource(db, {});
  assert.ok(gemmaSource);
  assert.notEqual(gemmaSource.spaceId, qwenSpace);
  const [[documentLength]] = (await gemmaSource.embed(["Saltmere floods."], undefined, "document"))!;
  assert.equal(documentLength, "title: none | text: Saltmere floods.".length);
  const gemmaArgs = requests()
    .filter((entry) => entry.args)
    .at(-1)!.args!;
  assert.equal(gemmaArgs[gemmaArgs.indexOf("--pooling") + 1], "mean");
  assert.equal(gemmaArgs[gemmaArgs.indexOf("--ubatch-size") + 1], String(models["embeddinggemma-300m"]!.physicalBatch));

  // A graphics-card plan that fails before the processor plan succeeds leaves no error behind.
  await builtinEmbeddingService.stop();
  Object.assign(sidecarRuntimeService, { isGpuVariant: () => true });
  await gemmaSource.embed(["Fallback works."], undefined, "document");
  const fellBack = builtinEmbeddingService.getStatus();
  assert.equal(fellBack.running, true);
  assert.equal(fellBack.error, null);

  // When every plan fails, the error carries llama-server's own words, not only "did not start".
  await builtinEmbeddingService.stop();
  writeFileSync(join(dir, "fail-start"), "");
  assert.equal(await gemmaSource.embed(["No start."], undefined, "document"), null);
  assert.match(builtinEmbeddingService.getStatus().error ?? "", /no usable device/u);
  rmSync(join(dir, "fail-start"));
  Object.assign(sidecarRuntimeService, { isGpuVariant: () => false });

  // A runtime that cannot be spawned at all reports the system's reason, at once, not a readiness timeout.
  await builtinEmbeddingService.stop();
  Object.assign(sidecarRuntimeService, {
    getCurrentInstall: () => ({
      serverPath: join(dir, "missing-llama-server"),
      variant: "cpu",
      build: "test",
      backend: "llama_cpp",
    }),
  });
  const spawnStarted = Date.now();
  assert.equal(await gemmaSource.embed(["No runtime."], undefined, "document"), null);
  assert.ok(Date.now() - spawnStarted < 5_000);
  assert.match(builtinEmbeddingService.getStatus().error ?? "", /ENOENT/u);
  Object.assign(sidecarRuntimeService, {
    getCurrentInstall: () => ({ serverPath: fakeServer, variant: "cpu", build: "test", backend: "llama_cpp" }),
  });

  // A source made for one model refuses vectors from another one switched in meanwhile.
  await app.inject({ method: "POST", url: "/api/builtin-embedding/use", payload: { modelId: "qwen3-embedding-0.6b" } });
  assert.equal(await gemmaSource.embed(["Old space."], undefined, "document"), null);
  await assert.rejects(builtinEmbeddingService.embed(["Old space."], undefined, "embeddinggemma-300m"), /switched/u);
  await builtinEmbeddingService.stop();

  // Removing a model hands over to the other one; removing the last clears the Embeddings default.
  const removedOne = await app.inject({
    method: "POST",
    url: "/api/builtin-embedding/remove",
    payload: { modelId: "embeddinggemma-300m" },
  });
  assert.equal(removedOne.json().activeModelId, "qwen3-embedding-0.6b");
  assert.equal(removedOne.json().running, false);
  const removedLast = await app.inject({
    method: "POST",
    url: "/api/builtin-embedding/remove",
    payload: { modelId: "qwen3-embedding-0.6b" },
  });
  assert.equal(removedLast.json().activeModelId, null);
  assert.equal(existsSync(join(dir, "models", "builtin-embedding", "qwen3-embedding-0.6b")), false);
  const cleared = await app.inject({
    method: "GET",
    url: `/api/settings/${DEFAULT_EMBEDDING_CONNECTION_SETTINGS_KEY}`,
  });
  assert.equal(cleared.json().connectionId, null);
  assert.equal(resolvePseudoEmbeddingSource(BUILTIN_EMBEDDING_CONNECTION_ID), null);
} finally {
  await builtinEmbeddingService.stop();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.log("builtin-embedding-model regression passed");
