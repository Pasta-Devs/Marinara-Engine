import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const directory = mkdtempSync(join(tmpdir(), "marinara-image-format-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.LOG_LEVEL = "silent";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true"; // Game background generators reach the local provider fixture.
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
const { backgroundsRoutes } = await import("../../packages/server/src/routes/backgrounds.routes.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { generateImage, saveImageToDisk, stageImageToDisk } =
  await import("../../packages/server/src/services/image/image-generation.js");
const { applyGeneratedImageFormatUiSettingsValue, formatGeneratedImageForStorage } =
  await import("../../packages/server/src/services/image/generated-image-format.js");
const { generateBackground, generateChatBackground, generateSceneIllustration } =
  await import("../../packages/server/src/services/game/game-asset-generation.js");
const { buildAssetManifest } = await import("../../packages/server/src/services/game/asset-manifest.service.js");

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
  await app.register(backgroundsRoutes, { prefix: "/backgrounds" });
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

  // Backgrounds are resized from the provider's own pixels, then encoded once as the WebP the setting asks for.
  const backgroundRequest = {
    chatId: "webp-backgrounds",
    imgSource: "openai",
    imgModel: "gpt-image-1",
    imgBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    imgApiKey: "fixture-key",
    size: { width: 32, height: 32 },
  };
  const resized = await sharp(png).resize(32, 32, { fit: "cover", position: "centre" }).png().toBuffer();
  const encodedOnce = await sharp(resized).keepMetadata().webp({ quality: 95, alphaQuality: 100 }).toBuffer();
  const location = { ...backgroundRequest, locationSlug: "webp-forest", sceneDescription: "a forest" };
  const chatBackground = await generateChatBackground(location);
  const gameBackground = await generateBackground(location);
  const illustration = await generateSceneIllustration({ ...backgroundRequest, prompt: "a forest", slug: "webp" });
  for (const [label, path] of [
    ["Roleplay background", join(directory, "backgrounds", String(chatBackground))],
    ["Game background", `${join(directory, "game-assets", ...String(gameBackground).split(":"))}.webp`],
    ["scene illustration", `${join(directory, "game-assets", ...String(illustration).split(":"))}.webp`],
  ] as const) {
    assert.match(path, /\.webp$/, `${label} is saved as WebP`);
    assert.deepEqual(readFileSync(path), encodedOnce, `${label} gets one lossy encode, after resizing`);
  }

  // Forced regeneration after the setting changes leaves one file per slug, and every slug or tag lookup finds it.
  const chatBackgroundDir = join(directory, "backgrounds");
  const gameBackgroundDir = join(directory, "game-assets", "backgrounds", "fantasy");
  const filesFor = (dir: string, slug: string) => readdirSync(dir).filter((file) => file.startsWith(`${slug}.`));
  const chatMetaKeys = () =>
    Object.keys(JSON.parse(readFileSync(join(chatBackgroundDir, "meta.json"), "utf-8"))).filter((file) =>
      file.startsWith("generated-webp-forest."),
    );
  const organizationPath = join(chatBackgroundDir, "organization.json");
  const organization = () => {
    const { assignments, favorites } = JSON.parse(readFileSync(organizationPath, "utf-8"));
    return { assignments, favorites };
  };
  const createdAt = "2026-11-01T00:00:00.000Z";
  writeFileSync(
    organizationPath,
    JSON.stringify({
      folders: [{ id: "folder-forest", name: "Forest", createdAt, updatedAt: createdAt }],
      assignments: { "user:generated-webp-forest.webp": "folder-forest" },
      favorites: ["user:generated-webp-forest.webp"],
    }),
  );
  for (const [saveGeneratedImagesAsWebp, ext, replacedExt] of [
    [false, "png", "webp"],
    [true, "webp", "png"],
  ] as const) {
    await settings.set("ui", JSON.stringify({ saveGeneratedImagesAsWebp, generatedImageWebpQuality: 95 }));
    const filename = `generated-webp-forest.${ext}`;
    assert.equal(await generateChatBackground({ ...location, force: true }), filename);
    assert.equal(await generateChatBackground(location), filename, `a later Background agent lookup finds the .${ext}`);
    assert.deepEqual(filesFor(chatBackgroundDir, "generated-webp-forest"), [filename]);
    assert.deepEqual(chatMetaKeys(), [filename], "the removed format leaves no background meta entry");
    assert.deepEqual(
      organization(),
      { assignments: { [`user:${filename}`]: "folder-forest" }, favorites: [`user:${filename}`] },
      "the new file takes over the folder and star, and the removed file keeps neither",
    );
    const oldReference = await app.inject({ url: `/backgrounds/file/generated-webp-forest.${replacedExt}` });
    assert.equal(oldReference.statusCode, 200, "a chat that still names the removed file shows the new image");
    assert.equal(oldReference.headers["content-type"], `image/${ext}`);
    assert.deepEqual(oldReference.rawPayload, readFileSync(join(chatBackgroundDir, filename)));
    assert.equal(await generateBackground({ ...location, force: true }), gameBackground);
    assert.deepEqual(filesFor(gameBackgroundDir, "webp-forest"), [`webp-forest.${ext}`]);
    const { assets } = buildAssetManifest();
    assert.equal(assets[String(gameBackground)]?.ext, `.${ext}`, `the Game tag resolves to the .${ext}`);
    assert.equal(
      assets["backgrounds:user:generated-webp-forest"]?.ext,
      `.${ext}`,
      `the user tag resolves to the .${ext}`,
    );
  }
  // A failed regeneration keeps the previous image and its meta.
  assert.equal(await generateChatBackground({ ...location, force: true, signal: AbortSignal.abort() }), null);
  assert.equal(await generateBackground({ ...location, force: true, signal: AbortSignal.abort() }), null);
  assert.deepEqual(filesFor(chatBackgroundDir, "generated-webp-forest"), ["generated-webp-forest.webp"]);
  assert.deepEqual(chatMetaKeys(), ["generated-webp-forest.webp"]);
  assert.deepEqual(filesFor(gameBackgroundDir, "webp-forest"), ["webp-forest.webp"]);
  assert.equal((await app.inject({ url: "/backgrounds/file/missing.png" })).statusCode, 404);

  // An unstarred leftover in another format does not take the regenerated file's own star away.
  writeFileSync(join(chatBackgroundDir, "generated-webp-forest.png"), png);
  assert.equal(await generateChatBackground({ ...location, force: true }), "generated-webp-forest.webp");
  assert.deepEqual(filesFor(chatBackgroundDir, "generated-webp-forest"), ["generated-webp-forest.webp"]);
  assert.deepEqual(organization(), {
    assignments: { "user:generated-webp-forest.webp": "folder-forest" },
    favorites: ["user:generated-webp-forest.webp"],
  });

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
