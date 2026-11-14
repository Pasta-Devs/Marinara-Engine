import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../../packages/server/node_modules/@fastify/multipart/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = await mkdtemp(join(tmpdir(), "marinara-notification-sound-"));
process.env.DATA_DIR = dataDir;

const { detectNotificationSoundFormat, notificationSoundRoutes } =
  await import("../../../packages/server/src/routes/notification-sound.routes.js");

function multipartUpload(filename: string, mimeType: string, bytes: Buffer) {
  const boundary = `marinara-${Date.now().toString(36)}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([prefix, bytes, suffix]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const tinyWav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(24)]);
const tinyMp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypM4A "), Buffer.alloc(24)]);

assert.equal(detectNotificationSoundFormat(Buffer.from("<html>not audio</html>")), null);
assert.equal(detectNotificationSoundFormat(tinyWav)?.mimeType, "audio/wav");
assert.equal(detectNotificationSoundFormat(tinyMp4)?.mimeType, "audio/mp4");

const app = Fastify();
await app.register(multipart);
await app.register(notificationSoundRoutes, { prefix: "/api/notification-sound" });

try {
  await app.ready();

  const initial = await app.inject({ method: "GET", url: "/api/notification-sound" });
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().configured, false);

  const invalid = multipartUpload("notification.mp3", "audio/mpeg", Buffer.from("<script>alert(1)</script>"));
  const invalidResponse = await app.inject({
    method: "POST",
    url: "/api/notification-sound/upload",
    ...invalid,
  });
  assert.equal(invalidResponse.statusCode, 400);

  const wavUpload = multipartUpload("notification.wav", "audio/wav", tinyWav);
  const uploaded = await app.inject({
    method: "POST",
    url: "/api/notification-sound/upload",
    ...wavUpload,
  });
  assert.equal(uploaded.statusCode, 200);
  assert.equal(uploaded.json().configured, true);
  assert.match(uploaded.json().url, /^\/api\/notification-sound\/file\?v=/u);
  assert.equal(existsSync(join(dataDir, "notification-sounds", "notification.wav")), true);

  const served = await app.inject({ method: "GET", url: "/api/notification-sound/file" });
  assert.equal(served.statusCode, 200);
  assert.equal(served.headers["content-type"], "audio/wav");
  assert.equal(served.headers["x-content-type-options"], "nosniff");
  assert.deepEqual(served.rawPayload, tinyWav);

  const mp4Upload = multipartUpload("notification.mp4", "video/mp4", tinyMp4);
  const replaced = await app.inject({
    method: "POST",
    url: "/api/notification-sound/upload",
    ...mp4Upload,
  });
  assert.equal(replaced.statusCode, 200);
  assert.equal(existsSync(join(dataDir, "notification-sounds", "notification.wav")), false);
  assert.equal(existsSync(join(dataDir, "notification-sounds", "notification.mp4")), true);

  const removed = await app.inject({ method: "DELETE", url: "/api/notification-sound" });
  assert.equal(removed.statusCode, 204);
  assert.equal(existsSync(join(dataDir, "notification-sounds", "notification.mp4")), false);

  const backupSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/backup.routes.ts"), "utf8");
  assert.match(
    backupSource,
    /const BACKUP_DIRS = \[[\s\S]*"notification-sounds"/u,
    "Custom notification sounds must remain in profile and full-backup assets",
  );
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
}

process.stdout.write("Notification sound regressions passed.\n");
