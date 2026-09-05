import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { crc32 } from "node:zlib";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-gallery-previews-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const sharp = requireServer("sharp");
const Fastify = requireServer("fastify");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { parseThumbnailWidth, resolveThumbPath } =
  await import("../../packages/server/src/services/image/image-thumbnail.js");
const db = await getDB();
const storage = createGalleryStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });

async function seed(chatId: string, filePath: string, bytes: Buffer) {
  const absolute = join(fixtureDir, "gallery", filePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, bytes);
  await storage.create({ chatId, filePath, prompt: "Synthetic image", provider: "fixture", model: "fixture" });
  return absolute;
}

function pngChunk(type: string, data: Buffer) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}

try {
  const original = await sharp({ create: { width: 2048, height: 3072, channels: 3, background: "#164e63" } })
    .png()
    .toBuffer();
  for (const source of ["shared", "legacy"]) {
    const file = await seed(source, `${source}/image.png`, original);
    const url = `/api/gallery/file/${source}/image.png`;
    const thumbDir = join(fixtureDir, "backgrounds-thumbs");
    mkdirSync(thumbDir, { recursive: true });
    const key = createHash("sha1").update(file).digest("hex").slice(0, 16);
    writeFileSync(
      join(thumbDir, `320-${statSync(file).mtimeMs}-${key}.webp`),
      await sharp(original).resize(10).webp().toBuffer(),
    );
    for (const width of [320, 1024]) {
      const response = await app.inject(`${url}?w=${width}`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "image/webp");
      const meta = await sharp(response.rawPayload).metadata();
      assert.equal(meta.width, width);
      assert.equal(meta.height, width * 1.5);
      assert.equal(response.headers["cache-control"], "public, max-age=0");
      const cached = await resolveThumbPath(file, width);
      assert.ok(cached);
      assert.deepEqual(response.rawPayload, readFileSync(cached));
      const metadata = sharp.prototype.metadata;
      sharp.prototype.metadata = () => {
        throw new Error("Cache hits must not reopen image metadata");
      };
      try {
        assert.equal(await resolveThumbPath(file, width), cached);
      } finally {
        sharp.prototype.metadata = metadata;
      }
      const head = await app.inject({ method: "HEAD", url: `${url}?w=${width}` });
      assert.equal(head.headers["content-length"], String(response.rawPayload.length));
      assert.equal(head.rawPayload.length, 0);
      const range = await app.inject({ url: `${url}?w=${width}`, headers: { range: "bytes=0-15" } });
      assert.equal(range.statusCode, 206);
      assert.deepEqual(range.rawPayload, response.rawPayload.subarray(0, 16));
    }
    for (const suffix of ["", "?w=0", "?w=-1", "?w=4096", "?w=nope", "?w=Infinity"]) {
      const response = await app.inject(url + suffix);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.rawPayload, original, "Original download and unsupported widths remain unchanged");
    }
    assert.deepEqual(readFileSync(file), original, "Preview creation must not overwrite the original");
    assert.equal((await app.inject(`/api/gallery/file/unrelated/image.png?w=320`)).statusCode, 404);
  }

  // The URL is scoped to the owning chat even when the actual generated file lives in shared/.
  await seed("owner", "shared/generated.png", original);
  assert.equal((await app.inject("/api/gallery/file/owner/generated.png?w=1024")).statusCode, 200);
  assert.equal((await app.inject("/api/gallery/file/shared/generated.png?w=1024")).statusCode, 404);
  await seed("bad", "bad/fake.png", Buffer.from("not an image"));
  assert.equal((await app.inject("/api/gallery/file/bad/fake.png?w=320")).statusCode, 404);
  assert.equal((await app.inject("/api/gallery/file/owner/%2e%2e%2fgenerated.png?w=320")).statusCode, 400);

  const small = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#164e63" } })
    .png()
    .toBuffer();
  await seed("small", "small/image.png", small);
  const smallPreview = await app.inject("/api/gallery/file/small/image.png?w=1024");
  assert.equal((await sharp(smallPreview.rawPayload).metadata()).width, 40, "Small images are not enlarged");

  const rotated = await sharp(small).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  await seed("rotated", "rotated/image.jpg", rotated);
  const rotatedPreview = await sharp(
    (await app.inject("/api/gallery/file/rotated/image.jpg?w=320")).rawPayload,
  ).metadata();
  assert.equal(rotatedPreview.width, 60);
  assert.equal(rotatedPreview.height, 40, "Previews retain the original's displayed EXIF orientation");

  // One-frame APNG with valid animation chunks: even this must remain an original,
  // not be silently flattened by Sharp's static PNG decoder.
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(1);
  const frame = Buffer.alloc(26);
  frame.writeUInt32BE(40, 4);
  frame.writeUInt32BE(60, 8);
  frame.writeUInt16BE(1, 20);
  frame.writeUInt16BE(10, 22);
  const apng = Buffer.concat([
    small.subarray(0, 33),
    pngChunk("acTL", animation),
    pngChunk("fcTL", frame),
    small.subarray(33),
  ]);
  const frames = Buffer.alloc(16 * 32 * 3, 120);
  frames.fill(200, 16 * 16 * 3);
  const animatedWebp = await sharp(frames, { raw: { width: 16, height: 32, channels: 3, pageHeight: 16 } })
    .webp({ loop: 0, delay: [100, 200] })
    .toBuffer();
  assert.equal((await sharp(animatedWebp).metadata()).pages, 2);
  const gif = await sharp(animatedWebp, { animated: true }).gif().toBuffer();
  for (const [filename, bytes] of [
    ["animated.png", apng],
    ["animated.webp", animatedWebp],
    ["animated.gif", gif],
  ] as const) {
    await seed("animated", `animated/${filename}`, bytes);
    const response = await app.inject(`/api/gallery/file/animated/${filename}?w=320`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.rawPayload, bytes, "Animations retain their original bytes");
  }
  // Large PNG metadata uses the documented conservative fallback, not a partial decode.
  const largeMetadata = Buffer.concat([
    small.subarray(0, 33),
    pngChunk("tEXt", Buffer.from(`Comment\0${"x".repeat(70_000)}`)),
    small.subarray(33),
  ]);
  await seed("large-metadata", "large-metadata/image.png", largeMetadata);
  assert.deepEqual((await app.inject("/api/gallery/file/large-metadata/image.png?w=320")).rawPayload, largeMetadata);
  for (const width of ["123", "NaN", undefined]) assert.equal(parseThumbnailWidth(width), null);
  console.info(
    "Gallery preview sizes, original downloads, animation fallbacks, ownership and media validation passed.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
