import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FAL_IMAGE_MODELS,
  IMAGE_GENERATION_SOURCES,
  inferImageSource,
} from "../../packages/shared/src/constants/model-lists.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";
import { buildFalImageUrl } from "../../packages/server/src/services/image/fal-image.js";
import { resolveConnectionImageDefaults } from "../../packages/server/src/services/image/image-generation-defaults.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: { url: string; authorization?: string; body: Record<string, unknown> }[] = [];
let baseUrl = "";
let result = "url";
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString();
  requests.push({ url: request.url!, authorization: request.headers.authorization, body: raw ? JSON.parse(raw) : {} });
  if (request.url === "/image.png") {
    response.writeHead(200, { "content-type": "image/png" });
    response.end(Buffer.from(png, "base64"));
    return;
  }
  if (result === "stall") return;
  response.setHeader("content-type", "application/json");
  if (result === "error") {
    response.statusCode = 422;
    response.end(JSON.stringify({ detail: "Unsupported image_size" }));
  } else if (result === "invalid") response.end("not JSON");
  else if (result === "empty") response.end(JSON.stringify({ images: [] }));
  else
    response.end(
      JSON.stringify({
        images: [{ url: result === "private" ? "http://127.0.0.2/image.png" : `${baseUrl}/image.png` }],
      }),
    );
});
const app = Fastify();
const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-fal-"));
let db:
  | Awaited<ReturnType<typeof import("../../packages/server/src/db/file-backed-store.js").createFileNativeDB>>
  | undefined;
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
  assert.equal(buildFalImageUrl("https://fal.run"), "https://fal.run/fal-ai/flux/schnell");
  assert.equal(buildFalImageUrl("http://localhost:1234/proxy"), "http://127.0.0.1:1234/proxy/fal-ai/flux/schnell");
  assert.equal(buildFalImageUrl("http://[::1]:1234"), "http://[::1]:1234/fal-ai/flux/schnell");
  for (const insecure of ["http://fal.run", "http://example.com", "http://localhost.example.com", "ftp://fal.run"]) {
    assert.throws(() => buildFalImageUrl(insecure), /requires HTTPS/);
  }
  const generate = (model = "fal-ai/flux/schnell", signal?: AbortSignal) =>
    generateImage("fal", `${baseUrl}/proxy/`, "fixture-key", "fal", {
      prompt: "moonlit laboratory",
      negativePrompt: "text",
      width: 768,
      height: 1024,
      model,
      allowLocalUrls: true,
      signal,
    });
  assert.equal(IMAGE_GENERATION_SOURCES.find((source) => source.id === "fal")?.defaultBaseUrl, "https://fal.run");
  assert.equal(inferImageSource("flux", "https://fal.run"), "fal");
  assert.equal(inferImageSource("fal-ai/flux/dev", baseUrl), "fal");
  assert.equal(inferImageSource("fal-ai/flux/dev", "https://openrouter.ai/api/v1"), "openrouter");
  assert.equal((await generate()).base64, png);
  assert.equal(requests[0]!.url, "/proxy/fal-ai/flux/schnell");
  assert.equal(requests[0]!.authorization, "Key fixture-key");
  assert.deepEqual(requests[0]!.body, {
    prompt: "moonlit laboratory\n\nDo not include: text.",
    image_size: { width: 768, height: 1024 },
    num_images: 1,
  });
  assert.equal(requests[1]!.authorization, undefined, "Image downloads must not receive the API key");
  assert.equal((await generate("")).base64, png, "Blank models use the starter endpoint");
  const beforeInvalid = requests.length;
  for (const model of ["flux", "../admin", "fal-ai/../admin", "fal-ai/flux?token=x", "fal-ai/%2e%2e/admin"]) {
    await assert.rejects(generate(model), /model endpoint ID/);
  }
  assert.equal(requests.length, beforeInvalid, "Invalid endpoint IDs fail before any request");
  for (const num_images of [2, 0, null, "1"]) {
    await assert.rejects(
      generateImage("fal", baseUrl, "fixture-key", "fal", {
        prompt: "one image",
        allowLocalUrls: true,
        imageDefaults: resolveConnectionImageDefaults({
          imageService: "fal",
          defaultParameters: JSON.stringify({ customParameters: { num_images } }),
        }),
      }),
      /exactly one output/,
    );
  }
  assert.equal(requests.length, beforeInvalid, "Extra images must be rejected before spending credits");
  for (const [mode, error] of [
    ["error", /422.*Unsupported image_size/],
    ["invalid", /invalid JSON/],
    ["empty", /image URL/],
    ["private", /private|local|origin/i],
  ] as const) {
    result = mode;
    await assert.rejects(generate(), error);
  }
  result = "stall";
  await assert.rejects(generate(undefined, AbortSignal.timeout(50)), /timeout|abort/i);

  process.env.FILE_STORAGE_DIR = directory;
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  db = await createFileNativeDB();
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  const storage = createConnectionsStorage(db);
  const connection = await storage.create({
    name: "fal fixture",
    provider: "image_generation",
    imageGenerationSource: "fal",
    baseUrl,
    apiKey: "fixture-key",
    model: "fal-ai/flux/dev",
  });
  const beforeTest = requests.length;
  const tested = await app.inject({ method: "POST", url: `/api/connections/${connection.id}/test` });
  assert.equal(tested.json().success, true, tested.body);
  assert.match(tested.json().message, /configured.*Test Image.*credits/);
  const models = await app.inject({ method: "GET", url: `/api/connections/${connection.id}/models` });
  assert.deepEqual(
    models.json().models,
    FAL_IMAGE_MODELS.map(({ id, name }) => ({ id, name })),
  );
  assert.equal(requests.length, beforeTest, "Configuration and starter model discovery must not spend credits");
  await storage.update(connection.id, { apiKey: "" });
  const missingKey = await app.inject({ method: "POST", url: `/api/connections/${connection.id}/test` });
  assert.equal(missingKey.json().success, false, missingKey.body);
  assert.match(missingKey.json().message, /requires an API key/);
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db?._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.info("fal.ai image generation and connection regressions passed.");
