/**
 * Cancel stops avatar generation on the server, not only in the browser. The browser's request goes through
 * a proxy that keeps the server's side of a closed request open (as reverse proxies and tunnels can), while
 * the image or vision provider holds its answer:
 *   - Cancel (closing the request and calling POST /api/avatar-generation/cancel, as the Cancel button does)
 *     aborts the provider request that is in flight, for PNGTuber pictures and for the mesh avatar;
 *   - the avatar is free for a new job at once: starting again reaches the provider instead of 409;
 *   - a cancelled picture stores nothing, and the next one is made normally;
 *   - the cancel route refuses bad bodies and says when nothing was running.
 * Before the cancel route existed, the provider request stayed open behind such a proxy and every new start
 * was refused with 409 until the cancelled picture finished.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import {
  Agent,
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-avatar-cancel-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.BACKGROUNDREMOVER_DISABLED = "true";
process.env.LOG_LEVEL = "silent";

const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");
const { getDB } = await import("../../packages/server/src/db/connection.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { avatarGenerationRoutes } = await import("../../packages/server/src/routes/avatar-generation.routes.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { avatarOwnerDir } = await import("../../packages/server/src/services/avatars/storage.js");
const sharp = await getSharp();

type Held = { url: string; res: ServerResponse; closed: Promise<void> };
const arrivals: Held[] = [];
let arrived = Promise.withResolvers<void>();
const provider = createServer(async (req, res) => {
  for await (const chunk of req) void chunk;
  const closed = Promise.withResolvers<void>();
  res.on("close", () => closed.resolve());
  arrivals.push({ url: req.url ?? "", res, closed: closed.promise });
  arrived.resolve();
});

// Forwards to the Engine over kept-alive connections and never passes a client's disconnect on, so the
// Engine's side of a cancelled request stays open: only the cancel route can reach the job.
const upstream = new Agent({ keepAlive: true });
let engineUrl = "";
const proxy = createServer((req: IncomingMessage, res: ServerResponse) => {
  const forwarded = httpRequest(
    `${engineUrl}${req.url}`,
    { method: req.method, headers: req.headers, agent: upstream },
    (answer) => {
      res.on("error", () => {});
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  forwarded.on("error", () => {});
  req.pipe(forwarded);
});

const listen = (server: Server) =>
  new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as { port: number }).port}`)),
  );
const providerUrl = await listen(provider);
const proxyUrl = await listen(proxy);

const db = await getDB();
const character = await createCharactersStorage(db).create(
  characterDataSchema.parse({ name: "Ann", description: "x" }),
);
const owner = { ownerType: "character" as const, ownerId: character!.id };
const connections = createConnectionsStorage(db);
const image = await connections.create({
  name: "Held image provider",
  provider: "image_generation",
  baseUrl: `${providerUrl}/v1`,
  model: "gpt-image-1",
  imageService: "openai",
  imageGenerationSource: "openai",
  apiKey: "fixture",
});
const vision = await connections.create({
  name: "Held vision provider",
  provider: "custom",
  baseUrl: `${providerUrl}/v1`,
  model: "vision",
  apiKey: "fixture",
});
const spriteDir = join(dataDir, "sprites", owner.ownerId);
mkdirSync(spriteDir, { recursive: true });
// A face on a flat background, so the job also makes the sprite's cut-out before it asks the provider.
const sprite = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128"><rect width="96" height="128" fill="#fff"/>
    <ellipse cx="48" cy="64" rx="30" ry="40" fill="rgb(242,201,168)"/></svg>`),
)
  .png()
  .toBuffer();
writeFileSync(join(spriteDir, "neutral.png"), sprite);

const app = Fastify();
app.decorate("db", db);
await app.register(avatarGenerationRoutes, { prefix: "/api/avatar-generation" });
await app.listen({ host: "127.0.0.1", port: 0 });
engineUrl = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;

/** A browser request through the proxy: its status and body, and a way to close it like an aborted fetch. */
function start(path: string, body: unknown) {
  const payload = JSON.stringify(body);
  const answer = Promise.withResolvers<{ status: number; body: string }>();
  const req = httpRequest(`${proxyUrl}/api/avatar-generation${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
  });
  req.on("response", async (res) => {
    let text = "";
    for await (const chunk of res) text += chunk;
    answer.resolve({ status: res.statusCode ?? 0, body: text });
  });
  req.on("error", (error) => answer.reject(error));
  req.end(payload);
  return { answer: answer.promise, close: () => req.destroy() };
}

async function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} (waited ${ms} ms)`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The next provider request, or a failure when the Engine answers the browser first (a 409, say). */
async function nextArrival(what: string, request: { answer: Promise<{ status: number; body: string }> }) {
  await within(
    Promise.race([
      arrived.promise,
      request.answer.then((answer) => assert.fail(`${what}: the Engine answered ${answer.status} ${answer.body}`)),
    ]),
    10_000,
    `${what} never reached the provider`,
  );
  arrived = Promise.withResolvers<void>();
  return arrivals.at(-1)!;
}

/** What the Cancel button does: close the request and tell the server. */
async function cancel(request: { close: () => void }, kind: string) {
  request.close();
  return start("/cancel", { owner, kind }).answer;
}

const pngtuberBody = { owner, labels: ["neutral"], variants: ["eyes-closed"], connectionId: image.id };
// The edit the provider answers with: the sprite where it was put on GPT Image 1's 1024x1536 canvas, with a
// closed eye drawn on it (a picture with no change is refused).
const opaquePicture = await sharp(await sharp(sprite).resize(1024, 1365).png().toBuffer())
  .extend({ top: 85, bottom: 86, background: "#fff" })
  .composite([{ input: { create: { width: 160, height: 56, channels: 3, background: "#222" } }, left: 432, top: 650 }])
  .png()
  .toBuffer();

try {
  // ── PNGTuber pictures ──
  const first = start("/pngtuber-variants", pngtuberBody);
  const held = await nextArrival("the first picture", first);
  assert.equal(held.url, "/v1/images/edits");
  const cancelled = await cancel(first, "pngtuber");
  // The avatar is free at once: the next start reaches the provider instead of a 409.
  const second = start("/pngtuber-variants", pngtuberBody);
  const next = await nextArrival("after Cancel, the next picture", second);
  await within(held.closed, 3_000, "Cancel aborts the image request in flight");
  assert.deepEqual([cancelled.status, JSON.parse(cancelled.body)], [200, { cancelled: true }]);
  next.res.setHeader("content-type", "application/json");
  next.res.end(JSON.stringify({ data: [{ b64_json: opaquePicture.toString("base64") }] }));
  const made = await within(second.answer, 10_000, "the next picture is made");
  assert.equal(made.status, 200, made.body);
  assert.equal(JSON.parse(made.body).drafts.length, 1, "the next picture comes back");
  const folder = join(avatarOwnerDir(owner), "pngtuber");
  const stored = existsSync(folder) ? readdirSync(folder) : [];
  assert.deepEqual(stored, [], "nothing is stored for the cancelled picture");
  assert.ok(!existsSync(join(avatarOwnerDir(owner), "avatar.json")), "the avatar's setup is untouched");

  // ── The mesh avatar: the vision request is cancelled the same way ──
  const meshBody = { owner, sourceLabel: "neutral", connectionId: vision.id };
  const mesh = start("/mesh-rig", meshBody);
  const look = await nextArrival("the mesh avatar's vision request", mesh);
  assert.equal(look.url, "/v1/chat/completions");
  const meshCancelled = await cancel(mesh, "mesh-avatar");
  const meshAgain = start("/mesh-rig", meshBody);
  const lookAgain = await nextArrival("after Cancel, the next mesh avatar", meshAgain);
  await within(look.closed, 3_000, "Cancel aborts the vision request in flight");
  assert.deepEqual(JSON.parse(meshCancelled.body), { cancelled: true });
  await cancel(meshAgain, "mesh-avatar");
  await within(lookAgain.closed, 3_000, "the second mesh request is cancelled too");

  // ── The cancel route itself ──
  const idle = await start("/cancel", { owner, kind: "pngtuber" }).answer;
  assert.deepEqual(JSON.parse(idle.body), { cancelled: false }, "nothing is running");
  // A kind no generator has is refused. "vrm" is one again: one-click Tripo models were withdrawn by the
  // maintainer on 2026-10-19.
  assert.equal((await start("/cancel", { owner, kind: "vrm" }).answer).status, 400, "no VRM models are made");
  assert.equal((await start("/cancel", { owner, kind: "live2d" }).answer).status, 400);
  assert.equal((await start("/cancel", { owner: { ...owner, ownerId: "../x" }, kind: "pngtuber" }).answer).status, 400);
} finally {
  for (const held of arrivals) held.res.destroy();
  provider.closeAllConnections();
  proxy.closeAllConnections();
  upstream.destroy();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("avatar generation cancel regression passed");
