import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// #7221: a user-triggered action saves the web images in a character's greetings into the
// character gallery and points the greetings at the saved copies. The download must refuse
// private addresses, non-images and oversized files, and compatible exports get the web links back.

const dataDir = process.env.DATA_DIR;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { default: AdmZip } = await import("../../node_modules/adm-zip/adm-zip.js");
const {
  applyBakedGreetingImages,
  bakedGreetingImageRef,
  characterDataSchema,
  findGreetingImageUrls,
  readBakedGreetingImages,
  restoreBakedGreetingImages,
} = await import("../../packages/shared/dist/index.js");
const { resolveCardAssetImageSources, resolveSelfCardAssets } =
  await import("../../packages/client/src/lib/card-asset-links.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { buildCompatibleCharacterExport, charactersRoutes } =
  await import("../../packages/server/src/routes/characters.routes.js");
const { backupRoutes } = await import("../../packages/server/src/routes/backup.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createCharacterGalleryStorage } =
  await import("../../packages/server/src/services/storage/character-gallery.storage.js");
const { downloadGreetingImage, validateGreetingImage } =
  await import("../../packages/server/src/services/image/greeting-image-bake.js");

function png(width: number, height: number) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

// ── Finding and rewriting greeting images ──
const greetings = {
  first_mes: "Hi ![wave](https://img.example/a.png) and a [link](https://img.example/page.png).",
  alternate_greetings: [
    '<img width="200" src="https://img.example/b.gif?x=1&amp;y=2"> and ![wave again](https://img.example/a.png)',
    "<img src='https://img.example/c.webp'> <img src=https://img.example/d.jpg> <img data-src=\"https://img.example/no.png\">",
    "Already local: ![](card://self/gallery/old.png)",
  ],
  extensions: { talkativeness: 0.5 },
};
assert.deepEqual(findGreetingImageUrls(greetings), [
  "https://img.example/a.png",
  "https://img.example/b.gif?x=1&y=2",
  "https://img.example/c.webp",
  "https://img.example/d.jpg",
]);

// Greetings come from downloaded cards; hostile text must not make the scan backtrack for
// long (a quadratic scan of these takes minutes and trips the runner's time limit).
for (const hostile of ["![a](http://x", "![", "<img ", "<img src='http://x", "<img src=http://x"]) {
  assert.ok(Array.isArray(findGreetingImageUrls({ first_mes: hostile.repeat(100_000) })), hostile);
}

const baked = applyBakedGreetingImages(greetings, [
  { file: "aaa.png", url: "https://img.example/a.png" },
  { file: "bbb.gif", url: "https://img.example/b.gif?x=1&y=2" },
  { file: "ddd.jpg", url: "https://img.example/d.jpg" },
]);
assert.equal(
  baked.first_mes,
  `Hi ![wave](${bakedGreetingImageRef("aaa.png")}) and a [link](https://img.example/page.png).`,
  "links that are not images stay untouched",
);
assert.equal(
  baked.alternate_greetings[0],
  `<img width="200" src="card://self/gallery/bbb.gif"> and ![wave again](card://self/gallery/aaa.png)`,
);
assert.equal(
  baked.alternate_greetings[1],
  '<img src=\'https://img.example/c.webp\'> <img src="card://self/gallery/ddd.jpg"> <img data-src="https://img.example/no.png">',
  "an image that failed to download keeps its web link",
);
assert.equal(readBakedGreetingImages(baked.extensions).length, 3);
assert.deepEqual(
  readBakedGreetingImages(
    applyBakedGreetingImages({ first_mes: "edited away", extensions: {} }, [
      { file: "x.png", url: "https://img.example/x.png" },
    ]).extensions,
  ),
  [],
  "a link edited away while the download ran gets no record",
);
assert.equal((baked.extensions as { talkativeness: number }).talkativeness, 0.5);

// A baked HTML image renders: card:// in <img src> resolves before the sanitizer drops the scheme.
assert.equal(
  resolveCardAssetImageSources(resolveSelfCardAssets(baked.alternate_greetings[0]!, "char1")),
  '<img width="200" src="/api/characters/char1/gallery/file/bbb.gif"> and ![wave again](card://characters/char1/gallery/aaa.png)',
);
assert.equal(
  resolveCardAssetImageSources("<img src='card://".repeat(100_000)).length,
  "<img src='card://".length * 100_000,
);

const restored = restoreBakedGreetingImages(baked);
assert.equal(restored.first_mes, greetings.first_mes);
assert.equal(
  restored.alternate_greetings[0],
  '<img width="200" src="https://img.example/b.gif?x=1&y=2"> and ![wave again](https://img.example/a.png)',
);
assert.deepEqual(
  (restored.extensions as { bakedGreetingImages: unknown }).bakedGreetingImages,
  [],
  "an empty list, so a character save replaces the stored one",
);

const compatible = buildCompatibleCharacterExport(baked);
assert.equal(compatible.data.first_mes, greetings.first_mes, "compatible cards carry no gallery");
assert.equal("bakedGreetingImages" in compatible.data.extensions, false);

// ── Image validation ──
assert.deepEqual(validateGreetingImage(png(640, 480)), { ext: "png", width: 640, height: 480 });
assert.equal(validateGreetingImage(png(10_000, 10_000)), null, "pixel cap");
assert.equal(validateGreetingImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
assert.equal(validateGreetingImage(Buffer.from("<!doctype html><title>x</title>")), null);
assert.equal(validateGreetingImage(Buffer.concat([png(4, 4), Buffer.alloc(11 * 1024 * 1024)])), null, "size cap");
const avif = Buffer.alloc(32);
avif.writeUInt32BE(32, 0);
avif.write("ftypavif", 4, "ascii");
assert.equal(validateGreetingImage(avif), null, "only PNG, JPEG, GIF and WebP");

// ── Network guard ──
// The editor shows these reasons, so they stay plain instead of naming address ranges.
const homeNetwork = { message: "Links to your own computer or home network can't be saved" };
const webLinksOnly = { message: "Only http and https image links can be saved" };
for (const url of [
  "http://127.0.0.1:9/a.png",
  "http://localhost/a.png",
  "http://169.254.169.254/latest/meta-data",
  "http://10.0.0.5/a.png",
  "http://100.64.0.1/a.png",
  "http://[fd00::1]/a.png",
  "http://[::ffff:127.0.0.1]/a.png",
  "http://[::7f00:1]/a.png",
  "http://[ff02::1]/a.png",
]) {
  await assert.rejects(downloadGreetingImage(url), homeNetwork, url);
}
await assert.rejects(downloadGreetingImage("file:///etc/passwd"), webLinksOnly);
await assert.rejects(downloadGreetingImage("ftp://img.example/a.png"), webLinksOnly);
await assert.rejects(downloadGreetingImage("https://user:pass@img.example/a.png"), /username or password/i);
await assert.rejects(downloadGreetingImage(`https://img.example/${"a".repeat(2100)}.png`), /too long/i);

const previousTrusted = process.env.TRUSTED_PRIVATE_NETWORKS;
process.env.TRUSTED_PRIVATE_NETWORKS = "192.168.1.0/24";
try {
  await assert.rejects(
    downloadGreetingImage("http://10.0.0.5/a.png"),
    homeNetwork,
    "narrowing the sign-in trust list must not open private ranges to downloads",
  );
  await assert.rejects(downloadGreetingImage("http://169.254.169.254/latest"), homeNetwork);
} finally {
  if (previousTrusted === undefined) delete process.env.TRUSTED_PRIVATE_NETWORKS;
  else process.env.TRUSTED_PRIVATE_NETWORKS = previousTrusted;
}

// A public IP literal skips DNS, so a stubbed fetch can stand in for the image host.
const PUBLIC_HOST = "http://93.184.216.34";
const realFetch = globalThis.fetch;
const requests: Array<{ url: string; headers: Headers; redirect?: string }> = [];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  requests.push({ url, headers: new Headers(init?.headers), redirect: init?.redirect });
  if (url.endsWith("/redirect.png"))
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/a.png" } });
  if (url.endsWith("/page.png")) return new Response("<!doctype html>", { headers: { "content-type": "image/png" } });
  if (url.endsWith("/missing.png")) return new Response("gone", { status: 404 });
  if (url.endsWith("/huge.png"))
    return new Response(new Uint8Array(11 * 1024 * 1024), { headers: { "content-type": "image/png" } });
  return new Response(png(320, 200), { headers: { "content-type": "image/png" } });
}) as typeof fetch;

try {
  await assert.rejects(downloadGreetingImage(`${PUBLIC_HOST}/redirect.png`), homeNetwork);
  await assert.rejects(
    downloadGreetingImage(`${PUBLIC_HOST}/huge.png`),
    /Only PNG, JPEG, GIF or WebP images up to 10 MB/,
  );
  await assert.rejects(downloadGreetingImage(`${PUBLIC_HOST}/page.png`), /Only PNG, JPEG, GIF or WebP/);
  await assert.rejects(downloadGreetingImage(`${PUBLIC_HOST}/missing.png`), /404/);

  // ── Route: stores app-named files in the character gallery ──
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  app.setErrorHandler(errorHandler);
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await app.register(backupRoutes, { prefix: "/api/backup" });
  try {
    const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Baker" }));
    assert.ok(character);
    requests.length = 0;
    const response = await app.inject({
      method: "POST",
      url: `/api/characters/${character.id}/gallery/bake`,
      payload: {
        urls: [`${PUBLIC_HOST}/a.png`, `${PUBLIC_HOST}/a.png`, "http://127.0.0.1/a.png", `${PUBLIC_HOST}/page.png`],
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    const { results } = response.json() as { results: Array<{ url: string; file?: string; error?: string }> };
    assert.equal(results.length, 3, "a repeated URL downloads once");
    const saved = results.filter((result) => result.file);
    assert.equal(saved.length, 1);
    assert.match(saved[0]!.file!, /^[A-Za-z0-9_-]{21}\.png$/, "the file name comes from the app, not the URL");
    assert.ok(results.some((result) => result.error === homeNetwork.message));
    assert.ok(results.some((result) => /Only PNG/.test(result.error ?? "")));
    for (const request of requests) {
      assert.equal(request.redirect, "manual", "every redirect hop is re-validated");
      assert.equal(request.headers.has("cookie"), false);
      assert.equal(request.headers.has("authorization"), false);
    }

    const filePath = join(dataDir, "gallery", "characters", character.id, saved[0]!.file!);
    assert.ok(existsSync(filePath));
    assert.deepEqual(readFileSync(filePath), png(320, 200));
    const gallery = await createCharacterGalleryStorage(db).listByCharacterId(character.id);
    assert.equal(gallery.length, 1);
    assert.equal(gallery[0]!.filePath, `characters/${character.id}/${saved[0]!.file}`);
    assert.equal(gallery[0]!.width, 320);

    const tooMany = await app.inject({
      method: "POST",
      url: `/api/characters/${character.id}/gallery/bake`,
      payload: { urls: Array.from({ length: 11 }, (_, index) => `${PUBLIC_HOST}/${index}.png`) },
    });
    assert.equal(tooMany.statusCode, 400, "a request downloads at most ten images");

    const missing = await app.inject({
      method: "POST",
      url: "/api/characters/missing-character/gallery/bake",
      payload: { urls: [`${PUBLIC_HOST}/a.png`] },
    });
    assert.equal(missing.statusCode, 404);

    // The compatible profile export carries no gallery either.
    await createCharactersStorage(db).create(characterDataSchema.parse({ ...baked, name: "Baked" }));
    const profile = await app.inject("/api/backup/export-profile?format=compatible");
    assert.equal(profile.statusCode, 200, profile.body);
    const exportedCards = new AdmZip(profile.rawPayload)
      .getEntries()
      .filter((entry) => entry.entryName.startsWith("characters/"))
      .map((entry) => JSON.parse(entry.getData().toString()).data);
    const exportedBaked = exportedCards.find((card) => card.name === "Baked");
    assert.equal(exportedBaked.first_mes, greetings.first_mes, "compatible profile cards get the web links back");
    assert.equal(exportedBaked.alternate_greetings[1], restored.alternate_greetings[1]);
  } finally {
    await app.close();
    await closeDB();
  }
} finally {
  globalThis.fetch = realFetch;
}
