import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { finishCrc32, updateCrc32State } from "../../packages/server/src/utils/crc32.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import fastifyStatic from "../../packages/server/node_modules/@fastify/static/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-profile-assets-"));
const storageDir = mkdtempSync(join(tmpdir(), "marinara-profile-assets-storage-"));
const outsideFile = `${dataDir}-outside.png`;
const previousDataDir = process.env.DATA_DIR;
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = storageDir;

const [
  { createFileNativeDB },
  { customEmojis, customStickers },
  { customEmojisRoutes },
  { customStickersRoutes },
  { gameAssetsRoutes },
  { knowledgeSourcesRoutes },
  { cleanupStagedProfileAssets, promoteStagedProfileAssets, stageProfileImportAssets },
  {
    isCanonicalMediaPathInsideRoot,
    sendValidatedMediaFile,
    validateImageAssetBuffer,
    validateImageAssetFile,
    validateVideoAssetFile,
  },
] = await Promise.all([
  import("../../packages/server/src/db/file-backed-store.js"),
  import("../../packages/server/src/db/schema/index.js"),
  import("../../packages/server/src/routes/custom-emojis.routes.js"),
  import("../../packages/server/src/routes/custom-stickers.routes.js"),
  import("../../packages/server/src/routes/game-assets.routes.js"),
  import("../../packages/server/src/routes/knowledge-sources.routes.js"),
  import("../../packages/server/src/services/import/profile-import-assets.js"),
  import("../../packages/server/src/utils/media-file-security.js"),
]);

// A real 1x1 transparent PNG. Legitimate media must keep round-tripping.
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XxY4WQAAAABJRU5ErkJggg==",
  "base64",
);
const html = Buffer.from("<!doctype html><script>globalThis.pwned=true</script>", "utf8");
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>globalThis.pwned=true</script></svg>', "utf8");
const javascript = Buffer.from("globalThis.pwned=true", "utf8");
const passiveSvgWithDoctype = Buffer.from(
  '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
  "utf8",
);
const entitySvg = Buffer.from(
  '<!DOCTYPE svg [<!ENTITY payload SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&payload;</text></svg>',
  "utf8",
);
const whitespaceHeavyActiveSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg"><a href=${" ".repeat(100_000)}"javascript:alert(1)"/></svg>`,
  "utf8",
);
const encodedActiveSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#x6a;avascript:alert(1)"/></svg>',
  "utf8",
);
const arbitraryXlinkPrefixSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://www.w3.org/1999/xlink"><a foo:href="javascript:alert(1)"/></svg>',
  "utf8",
);
const animatedActiveHrefSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><a><rect width="1" height="1"/><set attributeName="href" to="javascript:alert(1)" begin="0s" fill="freeze"/></a></svg>',
  "utf8",
);
const namespacedScriptSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://www.w3.org/2000/svg"><foo:script>alert(1)</foo:script></svg>',
  "utf8",
);
const passiveEncodedSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.invalid/image?a=1&amp;b=2"><rect width="1" height="1"/></a></svg>',
  "utf8",
);
const validMp4 = Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
const videoManifest = Buffer.from('{"version":1,"videos":[]}', "utf8");

try {
  assert.equal(
    isCanonicalMediaPathInsideRoot(
      "F:\\MarinaraEngine2\\packages\\server\\data\\gallery\\chat-1\\selfie.png",
      "f:\\marinaraengine2\\packages\\server\\data",
      "win32",
    ),
    true,
    "Windows media containment must ignore canonical drive and directory casing",
  );
  assert.equal(
    isCanonicalMediaPathInsideRoot(
      "F:\\MarinaraEngine2\\packages\\server\\data-escape\\selfie.png",
      "f:\\marinaraengine2\\packages\\server\\data",
      "win32",
    ),
    false,
    "Windows media containment must still reject sibling-prefix escapes",
  );
  assert.equal(
    isCanonicalMediaPathInsideRoot(
      "G:\\MarinaraEngine2\\packages\\server\\data\\gallery\\selfie.png",
      "F:\\MarinaraEngine2\\packages\\server\\data",
      "win32",
    ),
    false,
    "Windows media containment must reject a different drive",
  );
  assert.equal(
    isCanonicalMediaPathInsideRoot("/srv/Marinara/data/gallery/selfie.png", "/srv/marinara/data", "linux"),
    false,
    "case-sensitive hosts must retain case-sensitive media containment",
  );

  assert.ok(validateImageAssetBuffer(validPng, "valid.png"));
  assert.equal(validateImageAssetBuffer(html, "payload.png"), null);
  assert.equal(validateImageAssetBuffer(javascript, "payload.js"), null);
  assert.ok(validateImageAssetBuffer(passiveSvgWithDoctype, "sprite.svg", { allowSvg: true }));
  assert.equal(validateImageAssetBuffer(entitySvg, "sprite.svg", { allowSvg: true }), null);
  assert.equal(validateImageAssetBuffer(whitespaceHeavyActiveSvg, "sprite.svg", { allowSvg: true }), null);
  assert.equal(validateImageAssetBuffer(encodedActiveSvg, "sprite.svg", { allowSvg: true }), null);
  assert.equal(validateImageAssetBuffer(arbitraryXlinkPrefixSvg, "sprite.svg", { allowSvg: true }), null);
  assert.equal(validateImageAssetBuffer(animatedActiveHrefSvg, "sprite.svg", { allowSvg: true }), null);
  assert.equal(validateImageAssetBuffer(namespacedScriptSvg, "sprite.svg", { allowSvg: true }), null);
  assert.ok(validateImageAssetBuffer(passiveEncodedSvg, "sprite.svg", { allowSvg: true }));
  const passiveSvgPath = join(dataDir, "passive.svg");
  writeFileSync(passiveSvgPath, passiveSvgWithDoctype);
  assert.equal(await validateImageAssetFile(passiveSvgPath, "passive.svg"), null);
  const validatedSvg = await validateImageAssetFile(passiveSvgPath, "passive.svg", { allowSvg: true });
  assert.ok(validatedSvg);
  await validatedSvg.handle.close();
  writeFileSync(outsideFile, validPng);
  assert.equal(
    await validateImageAssetFile(outsideFile, "outside.png"),
    null,
    "media validation must not read a file outside Marinara's configured media roots",
  );
  const oversizedSvgPath = join(dataDir, "oversized.svg");
  writeFileSync(oversizedSvgPath, "<svg>");
  truncateSync(oversizedSvgPath, 50 * 1024 * 1024 + 1);
  assert.equal(
    await validateImageAssetFile(oversizedSvgPath, "oversized.svg", { allowSvg: true }),
    null,
    "SVG validation must reject oversized documents before reading them",
  );

  const raceSafePath = join(dataDir, "race-safe.png");
  writeFileSync(raceSafePath, validPng);
  const validatedRaceSafeImage = await validateImageAssetFile(raceSafePath, "race-safe.png");
  assert.ok(validatedRaceSafeImage);
  const replacementPath = join(dataDir, "replacement.html");
  writeFileSync(replacementPath, html);
  if (process.platform === "win32") {
    try {
      assert.throws(
        () => renameSync(replacementPath, raceSafePath),
        (error: unknown) => (error as NodeJS.ErrnoException).code === "EPERM",
        "Windows must block replacing the validated file while its descriptor is open",
      );
    } finally {
      await validatedRaceSafeImage.handle.close();
    }
  } else {
    const descriptorApp = Fastify();
    try {
      renameSync(replacementPath, raceSafePath);
      descriptorApp.get("/validated-image", (req, reply) =>
        sendValidatedMediaFile(reply, validatedRaceSafeImage, { method: req.method, rangeHeader: req.headers.range }),
      );
      await descriptorApp.ready();
      const descriptorResponse = await descriptorApp.inject({ method: "GET", url: "/validated-image" });
      assert.equal(descriptorResponse.statusCode, 200);
      assert.deepEqual(
        descriptorResponse.rawPayload,
        validPng,
        "serving must use the validated descriptor even when its path is replaced",
      );
    } finally {
      await descriptorApp.close();
    }
  }

  const videoPath = join(dataDir, "range.mp4");
  const rangeVideo = Buffer.concat([validMp4, Buffer.from(Array.from({ length: 128 }, (_, index) => index))]);
  writeFileSync(videoPath, rangeVideo);
  const validatedVideo = await validateVideoAssetFile(videoPath, "range.mp4");
  assert.ok(validatedVideo);
  const rangeApp = Fastify();
  rangeApp.get("/video", (req, reply) =>
    sendValidatedMediaFile(reply, validatedVideo, { method: req.method, rangeHeader: req.headers.range }),
  );
  await rangeApp.ready();
  const rangeResponse = await rangeApp.inject({
    method: "GET",
    url: "/video",
    headers: { range: "bytes=4-11" },
  });
  assert.equal(rangeResponse.statusCode, 206);
  assert.equal(rangeResponse.headers["content-range"], `bytes 4-11/${rangeVideo.length}`);
  assert.deepEqual(rangeResponse.rawPayload, rangeVideo.subarray(4, 12));
  await rangeApp.close();

  const mixedStage = await stageProfileImportAssets(
    dataDir,
    [
      { path: "gallery/global/payload.html", expectedSize: html.length, read: () => html },
      { path: "game-assets/other/payload.svg", expectedSize: svg.length, read: () => svg },
      { path: "game-assets/sprites/.native", expectedSize: html.length, read: () => html },
      { path: "gallery/character-videos/char/payload.mp4", expectedSize: html.length, read: () => html },
      { path: "custom-emojis/payload.png", expectedSize: javascript.length, read: () => javascript },
      { path: "gallery/global/still-valid.png", expectedSize: validPng.length, read: () => validPng },
    ],
    1024 * 1024,
  );
  assert.deepEqual(
    mixedStage.assets.map((asset) => asset.path),
    ["gallery/global/still-valid.png"],
    "invalid media must be omitted without blocking a valid profile asset",
  );
  assert.deepEqual(
    mixedStage.skipped.map((asset) => asset.path),
    [
      "gallery/global/payload.html",
      "game-assets/other/payload.svg",
      "game-assets/sprites/.native",
      "gallery/character-videos/char/payload.mp4",
      "custom-emojis/payload.png",
    ],
    "every rejected asset must be reported instead of aborting the profile",
  );
  assert.ok(mixedStage.skipped.every((asset) => /not a supported/u.test(asset.message)));
  await promoteStagedProfileAssets(mixedStage);
  assert.deepEqual(readFileSync(join(dataDir, "gallery", "global", "still-valid.png")), validPng);
  for (const skipped of mixedStage.skipped) {
    assert.equal(existsSync(join(dataDir, ...skipped.path.split("/"))), false, `${skipped.path} must stay omitted`);
  }
  await cleanupStagedProfileAssets(mixedStage);

  const emptyNativeMarker = Buffer.alloc(0);
  const nativeMarkerStage = await stageProfileImportAssets(
    dataDir,
    [
      { path: "game-assets/sprites/.native", expectedSize: 0, read: () => emptyNativeMarker },
      { path: "game-assets/backgrounds/pack/.native", expectedSize: 0, read: () => emptyNativeMarker },
    ],
    1024 * 1024,
  );
  assert.equal(
    nativeMarkerStage.assets.length,
    2,
    "the seeder's empty .native directory markers must stage instead of failing a stock profile restore",
  );
  await cleanupStagedProfileAssets(nativeMarkerStage);
  assert.equal(existsSync(nativeMarkerStage.rootDir), false, "cleanup must remove the .native marker staging root");
  const validStage = await stageProfileImportAssets(
    dataDir,
    [
      { path: "gallery/global/valid.png", expectedSize: validPng.length, read: () => validPng },
      { path: "custom-emojis/valid.png", expectedSize: validPng.length, read: () => validPng },
      {
        path: "gallery/character-videos/char/idle.mp4",
        expectedSize: validMp4.length,
        read: () => validMp4,
      },
      {
        path: "gallery/character-videos/char/manifest.json",
        expectedSize: videoManifest.length,
        read: () => videoManifest,
      },
    ],
    1024 * 1024,
  );
  await promoteStagedProfileAssets(validStage);
  assert.deepEqual(readFileSync(join(dataDir, "gallery", "global", "valid.png")), validPng);
  assert.deepEqual(readFileSync(join(dataDir, "custom-emojis", "valid.png")), validPng);
  assert.deepEqual(readFileSync(join(dataDir, "gallery", "character-videos", "char", "idle.mp4")), validMp4);
  assert.deepEqual(readFileSync(join(dataDir, "gallery", "character-videos", "char", "manifest.json")), videoManifest);
  await cleanupStagedProfileAssets(validStage);

  const streamedGif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(128, 0x5a)]);
  let streamedGifCrcState = 0xffffffff;
  streamedGifCrcState = updateCrc32State(streamedGifCrcState, streamedGif);
  const streamedStage = await stageProfileImportAssets(
    dataDir,
    [
      {
        path: "backgrounds/streamed.gif",
        expectedSize: streamedGif.length,
        read: () => ({
          stream: Readable.from([streamedGif.subarray(0, 32), streamedGif.subarray(32)]),
          expectedCrc32: finishCrc32(streamedGifCrcState),
        }),
      },
    ],
    1024 * 1024,
  );
  await promoteStagedProfileAssets(streamedStage);
  assert.deepEqual(readFileSync(join(dataDir, "backgrounds", "streamed.gif")), streamedGif);
  await cleanupStagedProfileAssets(streamedStage);

  const db = await createFileNativeDB();
  const app = Fastify() as ReturnType<typeof Fastify> & { db: typeof db };
  app.decorate("db", db);
  await app.register(fastifyStatic, { root: dataDir, decorateReply: true });
  await app.register(customEmojisRoutes, { prefix: "/api/custom-emojis" });
  await app.register(customStickersRoutes, { prefix: "/api/custom-stickers" });
  await app.register(knowledgeSourcesRoutes, { prefix: "/api/knowledge-sources" });
  await app.register(gameAssetsRoutes, { prefix: "/api/game-assets" });

  try {
    writeFileSync(outsideFile, validPng);
    const timestamp = "2026-08-13T00:00:00.000Z";
    await db.insert(customEmojis).values({
      id: "unsafe-emoji",
      name: "unsafe_emoji",
      filePath: "../outside.png",
      width: 1,
      height: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await db.insert(customStickers).values({
      id: "unsafe-sticker",
      name: "unsafe_sticker",
      filePath: "../outside.png",
      width: 1,
      height: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const emojiExport = await app.inject({
      method: "POST",
      url: "/api/custom-emojis/export",
      payload: { ids: ["unsafe-emoji"] },
    });
    assert.equal(emojiExport.statusCode, 200);
    assert.deepEqual(emojiExport.json().emojis, [], "unsafe emoji rows must not read files outside their store");
    const stickerExport = await app.inject({
      method: "POST",
      url: "/api/custom-stickers/export",
      payload: { ids: ["unsafe-sticker"] },
    });
    assert.equal(stickerExport.statusCode, 200);
    assert.deepEqual(stickerExport.json().stickers, [], "unsafe sticker rows must not read files outside their store");

    assert.equal((await app.inject({ method: "DELETE", url: "/api/custom-emojis/unsafe-emoji" })).statusCode, 200);
    assert.equal((await app.inject({ method: "DELETE", url: "/api/custom-stickers/unsafe-sticker" })).statusCode, 200);
    assert.equal(existsSync(outsideFile), true, "unsafe imported media paths must never delete an outside file");

    const sourcesDir = join(dataDir, "knowledge-sources");
    mkdirSync(sourcesDir, { recursive: true });
    writeFileSync(
      join(sourcesDir, "meta.json"),
      JSON.stringify({
        unsafe: {
          id: "unsafe",
          originalName: "outside.png",
          filename: "../outside.png",
          size: validPng.length,
          uploadedAt: timestamp,
        },
      }),
    );
    const unsafeSourceDelete = await app.inject({ method: "DELETE", url: "/api/knowledge-sources/unsafe" });
    assert.equal(
      unsafeSourceDelete.statusCode,
      200,
      `unsafe source deletion should remove metadata only: ${unsafeSourceDelete.statusCode} ${unsafeSourceDelete.body}`,
    );
    assert.equal(existsSync(outsideFile), true, "unsafe knowledge-source metadata must never delete an outside file");
    writeFileSync(
      join(sourcesDir, "meta.json"),
      JSON.stringify({
        unsafe: {
          id: "unsafe",
          originalName: "outside.png",
          filename: "../outside.png",
          size: validPng.length,
          uploadedAt: timestamp,
        },
      }),
    );
    const unsafeSourceRead = await app.inject({ method: "GET", url: "/api/knowledge-sources/unsafe/text" });
    assert.equal(
      unsafeSourceRead.statusCode,
      404,
      "unsafe knowledge-source metadata must not read outside the source directory",
    );
    assert.equal(existsSync(outsideFile), true);

    const validGallery = await app.inject({ method: "GET", url: "/api/custom-emojis/file/valid.png" });
    assert.equal(validGallery.statusCode, 200);
    assert.equal(validGallery.headers["content-type"], "image/png");
    assert.deepEqual(validGallery.rawPayload, validPng);

    const textAssetPath = join(dataDir, "game-assets", "notes.html");
    mkdirSync(join(dataDir, "game-assets"), { recursive: true });
    writeFileSync(textAssetPath, html);
    const textAsset = await app.inject({ method: "GET", url: "/api/game-assets/file/notes.html" });
    assert.equal(textAsset.statusCode, 200);
    assert.equal(textAsset.headers["content-type"], "application/octet-stream");
    assert.match(textAsset.headers["content-disposition"] ?? "", /^attachment;/u);

    const nestedAssetDir = join(dataDir, "game-assets", "backgrounds", "fantasy");
    mkdirSync(nestedAssetDir, { recursive: true });
    writeFileSync(join(nestedAssetDir, "valid.png"), validPng);
    const nestedAsset = await app.inject({
      method: "GET",
      url: "/api/game-assets/file/backgrounds/fantasy/valid.png",
    });
    assert.equal(nestedAsset.statusCode, 200);
    assert.equal(nestedAsset.headers["content-type"], "image/png");
    assert.deepEqual(nestedAsset.rawPayload, validPng);
  } finally {
    await app.close();
    await db._fileStore.close();
  }

  console.info("Profile import asset security regression passed.");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(outsideFile, { force: true });
}
