/**
 * Small avatar copies for lists. /api/avatars/file/:name?w=320 serves a cached downscaled copy of the
 * avatar (character cards are often multi-MB PNGs), an unknown width serves the original, and the client
 * helper adds ?w=320 only to uploaded avatar files.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-avatar-preview-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const requireFromServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharp: any = requireFromServer("sharp");
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { avatarsRoutes } = await import("../../../packages/server/src/routes/avatars.routes.js");
const { avatarPreviewSrc } = await import("../../../packages/client/src/lib/avatar-preview.js");

try {
  // ── Client helper ──
  assert.equal(avatarPreviewSrc("/api/avatars/file/a.png"), "/api/avatars/file/a.png?w=320");
  assert.equal(avatarPreviewSrc("/api/avatars/file/a.png?v=2"), "/api/avatars/file/a.png?v=2&w=320");
  assert.equal(avatarPreviewSrc("/api/avatars/file/a.png?w=320"), "/api/avatars/file/a.png?w=320", "not twice");
  assert.equal(avatarPreviewSrc("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(avatarPreviewSrc("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(avatarPreviewSrc(null), null);

  // ── Server ──
  const avatarDir = join(dataDir, "avatars");
  mkdirSync(avatarDir, { recursive: true });
  const original = await sharp({
    create: { width: 1600, height: 2400, channels: 3, background: { r: 200, g: 40, b: 90 } },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  writeFileSync(join(avatarDir, "card.png"), original);

  const app = Fastify();
  app.decorate("db", await getDB());
  await app.register(avatarsRoutes, { prefix: "/api/avatars" });

  const full = await app.inject({ method: "GET", url: "/api/avatars/file/card.png" });
  assert.equal(full.statusCode, 200);
  assert.equal(full.rawPayload.length, original.length, "no width: the original");

  const small = await app.inject({ method: "GET", url: "/api/avatars/file/card.png?w=320" });
  assert.equal(small.statusCode, 200);
  assert.ok(small.rawPayload.length < original.length / 10, `small copy: ${small.rawPayload.length} bytes`);
  const meta = await sharp(small.rawPayload).metadata();
  assert.ok(meta.width! <= 320 && meta.height! <= 320, `fits 320: ${meta.width}x${meta.height}`);

  const odd = await app.inject({ method: "GET", url: "/api/avatars/file/card.png?w=9999" });
  assert.equal(odd.rawPayload.length, original.length, "an unknown width: the original");
  await app.close();
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("avatar preview regression passed");
