import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-b14-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

const { fontsRoutes } = await import("../../packages/server/src/routes/fonts.routes.js");

const WOFF2 = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]);
const cssFor = (slug: string) =>
  `@font-face { font-family: 'X'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/${slug}/a.woff2) format('woff2'); unicode-range: U+0000-00FF; }`;

let releaseSlow: () => void = () => {};
const slowGate = new Promise<void>((resolve) => {
  releaseSlow = resolve;
});
let slowFetchStarted: () => void = () => {};
const slowStarted = new Promise<void>((resolve) => {
  slowFetchStarted = resolve;
});

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith("https://fonts.googleapis.com/")) {
    const slug = url.includes("family=Slow") ? "slow" : "fast";
    return new Response(cssFor(slug), { status: 200 });
  }
  if (url.includes("/s/slow/")) {
    slowFetchStarted();
    await slowGate;
  }
  return new Response(WOFF2, { status: 200 });
}) as typeof fetch;

const app = Fastify();
try {
  await app.register(fontsRoutes, { prefix: "/api/fonts" });
  await app.ready();

  // Finding: undefined or null bodies must yield 400, not a TypeError 500.
  const noBody = await app.inject({ method: "POST", url: "/api/fonts/google/download" });
  assert.equal(noBody.statusCode, 400, "missing body returns 400");
  const nullBody = await app.inject({
    method: "POST",
    url: "/api/fonts/google/download",
    headers: { "content-type": "application/json" },
    payload: "null",
  });
  assert.equal(nullBody.statusCode, 400, "JSON null body returns 400");

  // Finding: concurrent downloads of different families must not drop each other's metadata.
  const slowReq = app.inject({ method: "POST", url: "/api/fonts/google/download", payload: { family: "Slow" } });
  await slowStarted; // Slow has taken its metadata snapshot and is mid-download.
  const fastRes = await app.inject({ method: "POST", url: "/api/fonts/google/download", payload: { family: "Fast" } });
  assert.equal(fastRes.statusCode, 200, fastRes.body);
  releaseSlow();
  const slowRes = await slowReq;
  assert.equal(slowRes.statusCode, 200, slowRes.body);

  const metadata = JSON.parse(readFileSync(join(dataDir, "fonts", "font-metadata.json"), "utf-8"));
  assert.equal(metadata["Fast-Regular.woff2"]?.family, "Fast", "Fast family metadata survives the concurrent write");
  assert.equal(metadata["Slow-Regular.woff2"]?.family, "Slow", "Slow family metadata is written");
  assert.equal(metadata["Fast-Regular.woff2"]?.unicodeRange, "U+0000-00FF");
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
}

// Finding: selfie variant save cleans up orphaned shared files and keeps committed variants.
// The selfie route needs a full provider/connection stack, so assert the guard structurally.
const gallerySource = readFileSync(
  new URL("../../packages/server/src/routes/gallery.routes.ts", import.meta.url),
  "utf-8",
);
const selfieStart = gallerySource.indexOf('"Generated selfie metadata could not be saved"');
assert.ok(selfieStart > 0, "selfie save block present");
const selfieBlock = gallerySource.slice(gallerySource.lastIndexOf("const savedImages = [];", selfieStart), selfieStart + 3000);
assert.match(selfieBlock, /try \{\s*const filePath = saveImageToDisk\(/, "variant save is wrapped in try");
assert.match(selfieBlock, /removeSavedImageFromDisk\(savedFilePath\)/, "orphaned shared file is removed on failure");
assert.match(selfieBlock, /if \(savedImage\) \{[\s\S]*?savedImages\.push\(savedImage\)/, "committed variant stays reported");
assert.match(selfieBlock, /throw lastSaveError instanceof Error/, "error surfaces only when no variant saved");

rmSync(dataDir, { recursive: true, force: true });
console.log("server-hunt-b14 regression passed");
