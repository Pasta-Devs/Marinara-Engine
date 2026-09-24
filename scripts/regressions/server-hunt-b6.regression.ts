import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../packages/server/node_modules/@fastify/multipart/index.js";

// Server hunt batch 6: backgrounds.routes.ts upload naming, parallel upload races,
// stem collisions and atomic meta.json writes.

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = await mkdtemp(join(tmpdir(), "marinara-server-hunt-b6-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

const { backgroundsRoutes } = await import("../../packages/server/src/routes/backgrounds.routes.js");

const bgDir = join(dataDir, "backgrounds");

function multipartUpload(filename: string, mimeType: string, bytes: Buffer) {
  const boundary = `marinara-${Math.random().toString(36).slice(2)}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([prefix, bytes, suffix]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

function png(marker: string) {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(marker)]);
}
function jpg(marker: string) {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(marker)]);
}

const app = Fastify();
await app.register(multipart);
await app.register(backgroundsRoutes, { prefix: "/api/backgrounds" });

async function upload(filename: string, mime: string, bytes: Buffer) {
  const request = multipartUpload(filename, mime, bytes);
  const response = await app.inject({
    method: "POST",
    url: "/api/backgrounds/upload",
    payload: request.payload,
    headers: request.headers,
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json() as { filename: string };
}

try {
  await app.ready();

  // 1. A fully non-ASCII stem must not become a hidden ".png" file.
  const hebrew = await upload("רקע.png", "image/png", png("hebrew"));
  assert.equal(hebrew.filename, "background.png");
  assert.ok(!hebrew.filename.startsWith("."));
  const list = await app.inject({ method: "GET", url: "/api/backgrounds" });
  const listed = (list.json() as Array<{ filename: string }>).map((entry) => entry.filename);
  assert.ok(listed.includes("background.png"), "non-ASCII upload must be listed");

  // 2. Parallel uploads that sanitise to the same name must not overwrite each other.
  const markers = ["race-a", "race-b", "race-c", "race-d"];
  const results = await Promise.all(markers.map((marker) => upload("森.png", "image/png", png(marker))));
  const names = results.map((result) => result.filename);
  assert.equal(new Set(names).size, names.length, `parallel uploads got duplicate names: ${names.join(", ")}`);
  const contents = names.map((name) => readFileSync(join(bgDir, name)).subarray(8).toString());
  assert.deepEqual([...contents].sort(), [...markers].sort(), "every parallel upload must keep its own bytes");

  // 3. Same stem with a different extension gets a suffix (manifest tags by stem).
  const forestPng = await upload("forest.png", "image/png", png("forest"));
  assert.equal(forestPng.filename, "forest.png");
  const forestJpg = await upload("forest.jpg", "image/jpeg", jpg("forest"));
  assert.equal(forestJpg.filename, "forest_2.jpg");

  // 4. Renaming onto the file's own stem with a case change keeps the name; onto a sibling's stem gets a suffix.
  const caseRename = await app.inject({
    method: "PATCH",
    url: "/api/backgrounds/forest.png/rename",
    payload: { name: "Forest" },
  });
  assert.equal(caseRename.statusCode, 200, caseRename.body);
  assert.equal(caseRename.json().filename, "Forest.png");
  {
    const metaPath = join(bgDir, "meta.json");
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
    meta["forest_2.jpg"] = { tags: ["night"] };
    writeFileSync(metaPath, JSON.stringify(meta));
  }
  const clash = await app.inject({
    method: "PATCH",
    url: "/api/backgrounds/forest_2.jpg/rename",
    payload: { name: "forest" },
  });
  assert.equal(clash.statusCode, 200, clash.body);
  assert.notEqual(
    clash
      .json()
      .filename.toLowerCase()
      .replace(/\.[^.]+$/, ""),
    "forest",
  );

  // A rename that resolves back to the file's own name must not delete its metadata.
  {
    const kept = JSON.parse(readFileSync(join(bgDir, "meta.json"), "utf8"));
    const clashName = clash.json().filename as string;
    assert.deepEqual(kept[clashName]?.tags, ["night"], "tags survive a rename onto a sibling's stem");
  }

  // Rename to only dots must not produce a hidden file.
  const dots = await app.inject({
    method: "PATCH",
    url: "/api/backgrounds/background.png/rename",
    payload: { name: "..." },
  });
  assert.equal(dots.statusCode, 400, dots.body);

  // 5. meta.json is written atomically (temp file + rename) and no temp files remain.
  const meta = JSON.parse(readFileSync(join(bgDir, "meta.json"), "utf8")) as Record<string, unknown>;
  assert.ok(meta["background.png"], "meta.json must hold the uploaded entry");
  assert.deepEqual(
    readdirSync(bgDir).filter((file) => file.endsWith(".tmp")),
    [],
    "no temp files may be left behind",
  );
  const source = readFileSync(join(repositoryRoot, "packages/server/src/routes/backgrounds.routes.ts"), "utf8");
  const writeMetaBody = source.match(/function writeMeta\(meta: MetaMap\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(writeMetaBody, /renameSync\(temporaryPath, META_PATH\)/, "writeMeta must write via temp file + rename");
  assert.ok(!existsSync(join(bgDir, ".png")), "no hidden .png file may exist");
  // app.inject does not interleave upload bodies, so also pin the exclusive write that closes the race.
  const uploadBody = source.slice(
    source.indexOf('app.post("/upload"'),
    source.indexOf("async function resolveSceneBackgroundRequest"),
  );
  assert.match(uploadBody, /writeFileSync\(filePath, buffer, \{ flag: "wx" \}\)/, "upload must write with the wx flag");
  assert.ok(
    uploadBody.indexOf("await data.toBuffer()") < uploadBody.indexOf("uniqueFilename("),
    "upload must choose its name after reading the body",
  );
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
}

process.stdout.write("Server hunt batch 6 regressions passed.\n");
