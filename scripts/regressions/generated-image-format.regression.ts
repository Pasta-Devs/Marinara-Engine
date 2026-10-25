import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const directory = mkdtempSync(join(tmpdir(), "marinara-image-format-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { generateImage, saveImageToDisk, stageImageToDisk } =
  await import("../../packages/server/src/services/image/image-generation.js");
const { applyGeneratedImageFormatUiSettingsValue, formatGeneratedImageForStorage } =
  await import("../../packages/server/src/services/image/generated-image-format.js");

const sharp = await getSharp();
const pixels = Buffer.alloc(64 * 64 * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = (i * 17) % 256;
  pixels[i + 1] = (i * 31 + Math.floor(i / 256)) % 256;
  pixels[i + 2] = (i * 7 + Math.floor(i / 64)) % 256;
  pixels[i + 3] = [0, 1, 128, 254, 255][(i / 4) % 5]!;
}
const png = await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } })
  .png()
  .toBuffer();
let providerImage = png.toString("base64");
let generations = 0;
const provider = createServer(async (request, response) => {
  for await (const _chunk of request) {
    /* consume the request before answering */
  }
  generations++;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ data: [{ b64_json: providerImage }] }));
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
assert.ok(address && typeof address !== "string");
const app = Fastify();
const db = await getDB();
app.decorate("db", db);
const settings = createAppSettingsStorage(db);
const generate = (preserveProviderOutput = false) =>
  generateImage("openai", `http://127.0.0.1:${address.port}/v1`, "fixture-key", "openai", {
    model: "gpt-image-1",
    prompt: "a forest",
    width: 64,
    height: 64,
    allowLocalUrls: true,
    preserveProviderOutput,
  });
try {
  await app.register(appSettingsRoutes, { prefix: "/app-settings" });
  const original = await generate();
  assert.equal(original.base64, png.toString("base64"), "the default keeps PNG bytes unchanged");
  assert.equal(original.ext, "png");

  const updated = await app.inject({
    method: "PUT",
    url: "/app-settings/ui",
    payload: {
      value: JSON.stringify({ saveGeneratedImagesAsWebp: true, generatedImageWebpQuality: 95 }),
    },
  });
  assert.equal(updated.statusCode, 200, updated.body);
  const converted = await generate();
  assert.equal(converted.mimeType, "image/webp");
  assert.equal(converted.ext, "webp");
  assert.equal(
    (await generate(true)).base64,
    png.toString("base64"),
    "sprite/portrait intermediates keep original pixels and format",
  );
  const buffer = Buffer.from(converted.base64, "base64");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  assert.deepEqual(
    await sharp(buffer).extractChannel("alpha").raw().toBuffer(),
    await sharp(png).extractChannel("alpha").raw().toBuffer(),
    "alpha bytes, including hidden metadata bits, survive",
  );
  assert.equal((await sharp(buffer).metadata()).width, 64);

  const saved = saveImageToDisk("chat", converted.base64, converted.ext, { shared: true });
  assert.match(saved, /^shared\/.*\.webp$/);
  assert.deepEqual(readFileSync(join(directory, "gallery", saved)), buffer);
  const staged = stageImageToDisk("chat", converted.base64, converted.ext);
  assert.match(staged.filePath, /\.webp$/);
  staged.promote();
  assert.deepEqual(readFileSync(join(directory, "gallery", staged.filePath)), buffer);
  staged.compensate();

  // A stored preference is reloaded at startup, rather than relying on the browser sending it per request.
  applyGeneratedImageFormatUiSettingsValue(null);
  const secondApp = Fastify();
  secondApp.decorate("db", db);
  await secondApp.register(appSettingsRoutes, { prefix: "/app-settings" });
  assert.equal((await generate()).ext, "webp");
  await secondApp.close();

  const withMetadata = {
    ...original,
    effectivePrompt: "fixture prompt",
    effectiveConnection: {
      connectionId: "fixture",
      connectionName: "Fixture",
      provider: "openai",
      model: "gpt-image-1",
    },
  };
  const metadataConverted = await formatGeneratedImageForStorage(withMetadata);
  assert.equal(metadataConverted.effectivePrompt, withMetadata.effectivePrompt);
  assert.deepEqual(metadataConverted.effectiveConnection, withMetadata.effectiveConnection);
  assert.equal(await formatGeneratedImageForStorage(metadataConverted), metadataConverted, "WebP is not re-encoded");

  const jpeg = await sharp(png).jpeg({ quality: 45 }).toBuffer();
  const tinyPng = await sharp(png).resize(1, 1).png().toBuffer();
  for (const [input, mimeType, ext] of [
    [jpeg, "image/jpeg", "jpg"],
    [tinyPng, "image/png", "png"],
  ] as const) {
    const encoded = await sharp(input).keepMetadata().webp({ quality: 95, alphaQuality: 100 }).toBuffer();
    assert.ok(encoded.length > input.length, `${ext} fixture must produce a larger WebP`);
    const source = { ...withMetadata, base64: input.toString("base64"), mimeType, ext };
    const selected = await formatGeneratedImageForStorage(source);
    assert.equal(selected.mimeType, "image/webp", "the explicit format selection also applies when WebP is larger");
    assert.equal(selected.ext, "webp");
    assert.deepEqual(Buffer.from(selected.base64, "base64"), encoded);
    assert.equal(selected.effectivePrompt, source.effectivePrompt);
    assert.deepEqual(selected.effectiveConnection, source.effectiveConnection);
    const filePath = saveImageToDisk("chat", selected.base64, selected.ext, { shared: true });
    assert.ok(filePath.endsWith(".webp"));
    assert.deepEqual(readFileSync(join(directory, "gallery", filePath)), encoded);
  }

  // Invalid quality never breaks generation. Boundary values are clamped and smaller quality reduces this fixture.
  await settings.set("ui", JSON.stringify({ saveGeneratedImagesAsWebp: true, generatedImageWebpQuality: -100 }));
  const smallest = await generate();
  await settings.set("ui", JSON.stringify({ saveGeneratedImagesAsWebp: true, generatedImageWebpQuality: 1000 }));
  const largest = await generate();
  assert.ok(Buffer.from(smallest.base64, "base64").length < Buffer.from(largest.base64, "base64").length);
  await settings.set("ui", JSON.stringify({ saveGeneratedImagesAsWebp: true, generatedImageWebpQuality: "invalid" }));
  assert.equal((await generate()).base64, converted.base64, "invalid quality uses 95");

  providerImage = "iVBORw0KGgo="; // A provider's undecodable image is retained rather than retried or discarded.
  const before = generations;
  const undecodable = await generate();
  assert.equal(undecodable.base64, providerImage);
  assert.equal(undecodable.ext, "png");
  assert.equal(generations, before + 1);
  providerImage = png.toString("base64");
  for (const raw of ["{not json", "[]", JSON.stringify({ saveGeneratedImagesAsWebp: "true" })]) {
    await settings.set("ui", raw);
    assert.equal((await generate()).base64, png.toString("base64"));
  }
  await settings.remove("ui");
  assert.equal((await generate()).base64, png.toString("base64"), "removing settings restores PNG default");
} finally {
  applyGeneratedImageFormatUiSettingsValue(null);
  await app.close();
  await closeDB();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
console.info("Generated image format regression passed");
