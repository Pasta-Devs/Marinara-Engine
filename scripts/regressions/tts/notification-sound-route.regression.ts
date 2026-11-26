// Custom notification sound: Safari needs byte-range answers to play it, an over-limit upload
// must say "10 MB" (not "could not be read"), and a failed removal must answer with a reason
// instead of a bare 500. The client toast then carries that reason, or says the server is down.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = await mkdtemp(join(tmpdir(), "marinara-notification-sound-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../../packages/server/node_modules/@fastify/multipart/index.js");
const { notificationSoundRoutes } = await import("../../../packages/server/src/routes/notification-sound.routes.js");
const { ApiError } = await import("../../../packages/client/src/lib/api-client.js");
const { describeCustomSoundError } =
  await import("../../../packages/client/src/hooks/use-custom-notification-sound.js");

function wav(bytes: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + bytes, 4);
  header.write("WAVE", 8, "ascii");
  return Buffer.concat([header, Buffer.alloc(bytes, 1)]);
}

function multipartBody(filename: string, data: Buffer) {
  const boundary = "----marinara-sound-test";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

const app = Fastify({ bodyLimit: 64 * 1024 * 1024 });
await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024 } });
await app.register(notificationSoundRoutes, { prefix: "/api/notification-sound" });

try {
  const ok = multipartBody("ping.wav", wav(4_000));
  const upload = await app.inject({
    method: "POST",
    url: "/api/notification-sound/upload",
    payload: ok.payload,
    headers: { "content-type": ok.contentType },
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const size = 44 + 4_000;

  const whole = await app.inject({ method: "GET", url: "/api/notification-sound/file" });
  assert.equal(whole.statusCode, 200);
  assert.equal(whole.headers["accept-ranges"], "bytes", "Safari only plays audio from a server that offers ranges");
  assert.equal(whole.headers["content-type"], "audio/wav");
  assert.equal(whole.rawPayload.length, size);

  // Safari's first media request.
  const probe = await app.inject({
    method: "GET",
    url: "/api/notification-sound/file",
    headers: { range: "bytes=0-1" },
  });
  assert.equal(probe.statusCode, 206, "a range request must get 206, or Safari refuses to play");
  assert.equal(probe.headers["content-range"], `bytes 0-1/${size}`);
  assert.equal(probe.rawPayload.length, 2);

  const tooBig = multipartBody("loud.wav", wav(10 * 1024 * 1024 + 10));
  const overLimit = await app.inject({
    method: "POST",
    url: "/api/notification-sound/upload",
    payload: tooBig.payload,
    headers: { "content-type": tooBig.contentType },
  });
  assert.equal(overLimit.statusCode, 413, overLimit.body);
  assert.match(overLimit.json().error, /10 MB/u);

  // A sound file that cannot be removed (here a non-empty directory in its place) answers with a reason.
  const blocker = join(dataDir, "notification-sounds", "notification.mp3");
  await mkdir(blocker, { recursive: true });
  await writeFile(join(blocker, "keep"), "x");
  const removal = await app.inject({ method: "DELETE", url: "/api/notification-sound/" });
  assert.equal(removal.statusCode, 500);
  assert.equal(typeof removal.json().error, "string");
  await rm(blocker, { recursive: true, force: true });
  const removed = await app.inject({ method: "DELETE", url: "/api/notification-sound/" });
  assert.equal(removed.statusCode, 204);
  const gone = await app.inject({ method: "GET", url: "/api/notification-sound/file" });
  assert.equal(gone.statusCode, 404);

  const t = (key: string) => `<${key}>`;
  assert.equal(
    describeCustomSoundError(
      "Could not save.",
      new ApiError(400, "Use an MP3, WAV, OGG, M4A, MP4, or WebM audio file."),
      t,
    ),
    "Could not save. Use an MP3, WAV, OGG, M4A, MP4, or WebM audio file.",
  );
  assert.equal(
    describeCustomSoundError("Could not remove.", new TypeError("Failed to fetch"), t),
    "Could not remove. <settings.notifications.customSound.toasts.serverUnreachable>",
  );
  console.log("notification sound route: ok");
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
