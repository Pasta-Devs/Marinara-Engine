import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// #7115: native character/persona exports embedded every gallery image at once and a large gallery killed
// the server. The export now streams one image at a time, so a server with a small heap exports ~64 MB galleries.
const HEAP_LIMIT_MB = 112;
const IMAGE_COUNT = 16;
const IMAGE_BYTES = 4 * 1024 * 1024;
const role = process.env.NATIVE_EXPORT_ROLE;
const dataDir = process.env.DATA_DIR;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

if (role === "legacy") {
  // Control: with the same server code loaded, the old exporter's approach (every image as a data URL, then
  // one JSON string) cannot fit this heap, so the limit is small enough to catch a buffered export.
  await import("../../packages/server/node_modules/fastify/fastify.js");
  await import("../../packages/server/src/routes/characters.routes.js");
  const dir = process.env.GALLERY_DIR!;
  const files = await readdir(dir);
  const gallery = await Promise.all(
    files.map(async (filename) => ({
      filename,
      data: `data:image/png;base64,${(await readFile(join(dir, filename))).toString("base64")}`,
    })),
  );
  process.stdout.write(String(JSON.stringify({ type: "marinara_character", data: { gallery } }).length));
  process.exit(0);
}

if (role === "server") {
  const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await app.listen({ host: "127.0.0.1", port: 0 });
  (globalThis as { gc?: () => void }).gc?.();
  const baselineHeap = process.memoryUsage().heapUsed;
  let peakHeap = baselineHeap;
  let peakRss = process.memoryUsage().rss;
  const sample = () => {
    const usage = process.memoryUsage();
    peakHeap = Math.max(peakHeap, usage.heapUsed);
    peakRss = Math.max(peakRss, usage.rss);
  };
  setInterval(sample, 2).unref();
  process.on("message", async () => {
    sample();
    process.send!({ baselineHeap, peakHeap, peakRss });
    await app.close();
    await closeDB();
    process.exit(0);
  });
  process.send!({ port: (app.server.address() as AddressInfo).port });
  await new Promise(() => undefined);
}

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const tsxLoader = pathToFileURL(serverRequire.resolve("tsx")).href;
const thisFile = fileURLToPath(import.meta.url);
const { default: AdmZip } = await import("../../packages/server/node_modules/adm-zip/adm-zip.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const { importRoutes } = await import("../../packages/server/src/routes/import.routes.js");
const { importMarinara } = await import("../../packages/server/src/services/import/marinara.importer.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createCharacterGalleryStorage } =
  await import("../../packages/server/src/services/storage/character-gallery.storage.js");
const { createPersonaGalleryStorage } =
  await import("../../packages/server/src/services/storage/persona-gallery.storage.js");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const imageHashes = new Map<string, string>();

async function writeGallery(folder: string, ownerId: string) {
  const dir = join(dataDir!, "gallery", folder, ownerId);
  await mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (let index = 0; index < IMAGE_COUNT; index++) {
    const bytes = Buffer.concat([PNG_SIGNATURE, randomBytes(IMAGE_BYTES - PNG_SIGNATURE.length)]);
    const filename = `${folder}-${index}.png`;
    await writeFile(join(dir, filename), bytes);
    imageHashes.set(filename, sha(bytes));
    paths.push(`${folder}/${ownerId}/${filename}`);
  }
  return { dir, paths };
}

function decodeDataUrl(value: unknown) {
  assert.equal(typeof value, "string");
  return Buffer.from((value as string).slice((value as string).indexOf(",") + 1), "base64");
}

function assertGallery(gallery: unknown) {
  assert.ok(Array.isArray(gallery));
  assert.equal(gallery.length, IMAGE_COUNT, "every gallery image is exported");
  for (const item of gallery as Array<{ filename: string; data: string }>) {
    assert.equal(sha(decodeDataUrl(item.data)), imageHashes.get(item.filename), `${item.filename} keeps its bytes`);
  }
}

async function fetchBytes(port: number, path: string, body?: unknown) {
  return new Promise<{ status: number; headers: Record<string, unknown>; bytes: Buffer }>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: payload ? "POST" : "GET",
        headers: payload ? { "content-type": "application/json" } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, bytes: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

let db = await getDB();
const characters = createCharactersStorage(db);
const characterGallery = createCharacterGalleryStorage(db);
const personaGallery = createPersonaGalleryStorage(db);
const scratch: string[] = [];
try {
  // ── Seed one character and one persona with ~64 MB galleries, a sprite and an avatar. ──
  await mkdir(join(dataDir, "avatars"), { recursive: true });
  const avatarBytes = Buffer.concat([PNG_SIGNATURE, randomBytes(1024)]);
  await writeFile(join(dataDir, "avatars", "big-export-avatar.png"), avatarBytes);
  const character = (await characters.create(
    characterDataSchema.parse({ name: "Big Export", description: "Large gallery" }),
    "/api/avatars/file/big-export-avatar.png",
  ))!;
  const twin = (await characters.create(characterDataSchema.parse({ name: "Big Export" })))!;
  const characterImages = await writeGallery("characters", character.id);
  scratch.push(characterImages.dir);
  const firstImage = await characterGallery.create({ characterId: character.id, filePath: characterImages.paths[0]! });
  for (const filePath of characterImages.paths.slice(1)) {
    await characterGallery.create({ characterId: character.id, filePath, prompt: "gallery prompt" });
  }
  const storedData = JSON.parse(character.data);
  await characters.update(character.id, {
    ...storedData,
    extensions: { ...storedData.extensions, characterSheetImageId: firstImage!.id },
  });
  const spriteDir = join(dataDir, "sprites", character.id);
  await mkdir(spriteDir, { recursive: true });
  await writeFile(join(spriteDir, "happy.png"), avatarBytes);

  const persona = (await characters.createPersona("Big Persona", "Large persona gallery"))!;
  const personaImages = await writeGallery("personas", persona.id);
  scratch.push(personaImages.dir);
  for (const filePath of personaImages.paths) await personaGallery.create({ personaId: persona.id, filePath });
  await closeDB();

  // ── Control: holding every image at once, as the old exporter did, does not fit the heap. ──
  const legacy = spawn(process.execPath, [`--max-old-space-size=${HEAP_LIMIT_MB}`, "--import", tsxLoader, thisFile], {
    env: { ...process.env, NATIVE_EXPORT_ROLE: "legacy", GALLERY_DIR: characterImages.dir },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let legacyErrors = "";
  legacy.stderr.on("data", (chunk) => (legacyErrors += chunk));
  const legacyExit = await new Promise<number | null>((resolve) => legacy.on("exit", (code) => resolve(code)));
  assert.notEqual(legacyExit, 0, "the control must run out of memory, or the heap limit proves nothing");
  assert.match(legacyErrors, /heap out of memory|Allocation failed/u);

  // ── The real exporter, in a server process with the same small heap. ──
  const server = spawn(
    process.execPath,
    [`--max-old-space-size=${HEAP_LIMIT_MB}`, "--expose-gc", "--import", tsxLoader, thisFile],
    { env: { ...process.env, NATIVE_EXPORT_ROLE: "server" }, stdio: ["ignore", "inherit", "pipe", "ipc"] },
  );
  let serverErrors = "";
  server.stderr!.on("data", (chunk) => (serverErrors += chunk));
  const serverExit = new Promise<number | null>((resolve) => server.on("exit", (code) => resolve(code)));
  const messages: Array<Record<string, number>> = [];
  server.on("message", (message) => messages.push(message as Record<string, number>));
  const port = await new Promise<number>((resolve, reject) => {
    server.once("message", (message) => resolve((message as { port: number }).port));
    void serverExit.then((code) => reject(new Error(`export server exited (${code}): ${serverErrors.slice(-2000)}`)));
  });

  const exports: Record<string, Buffer> = {};
  for (const [name, path, body] of [
    ["character", `/api/characters/${character.id}/export?format=native`, undefined],
    ["persona", `/api/characters/personas/${persona.id}/export?format=native`, undefined],
    ["characterZip", "/api/characters/export-bulk", { ids: [character.id, twin.id], format: "native" }],
    ["personaZip", "/api/characters/personas/export-bulk", { ids: [persona.id], format: "native" }],
  ] as const) {
    const response = await fetchBytes(port, path, body).catch((error) => {
      const fatal = serverErrors.match(/FATAL ERROR[^\n]*/u)?.[0];
      throw new Error(`${name} export failed: ${error}\n${fatal ?? serverErrors.slice(-2000)}`);
    });
    assert.equal(response.status, 200, `${name} export: ${response.bytes.subarray(0, 300)}`);
    exports[name] = response.bytes;
    if (name === "character") {
      assert.equal(response.headers["content-disposition"], 'attachment; filename="Big%20Export.marinara.json"');
      assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
    }
    if (name === "characterZip") {
      assert.equal(response.headers["content-disposition"], 'attachment; filename="marinara-characters.zip"');
    }
  }
  server.send("stop");
  assert.equal(await serverExit, 0, serverErrors.slice(-2000));
  const memory = messages.find((message) => "peakHeap" in message)!;
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  console.log(
    "Native export server memory with a %d MB heap limit: baseline heap %d MB, peak heap %d MB, peak RSS %d MB.",
    HEAP_LIMIT_MB,
    mb(memory.baselineHeap!),
    mb(memory.peakHeap!),
    mb(memory.peakRss!),
  );

  // ── The streamed files keep today's exact format and import back with every image. ──
  db = await getDB();
  const characterText = exports.character!.toString("utf8");
  const characterExport = JSON.parse(characterText);
  assert.equal(JSON.stringify(characterExport), characterText, "single exports stay compact JSON.stringify output");
  assert.deepEqual(Object.keys(characterExport), ["type", "version", "exportedAt", "data"]);
  assert.deepEqual(Object.keys(characterExport.data), [
    "spec",
    "spec_version",
    "data",
    "avatar",
    "sprites",
    "gallery",
    "metadata",
  ]);
  assert.equal(characterExport.data.data.name, "Big Export");
  assert.equal(characterExport.data.data.extensions.characterSheetImageId, undefined);
  assert.deepEqual(decodeDataUrl(characterExport.data.avatar), avatarBytes);
  assert.deepEqual(
    characterExport.data.sprites.map((sprite: { filename: string }) => sprite.filename),
    ["happy.png"],
  );
  assertGallery(characterExport.data.gallery);
  assert.deepEqual(
    characterExport.data.gallery
      .filter((item: { isCharacterSheet?: boolean }) => item.isCharacterSheet)
      .map((item: { filename: string }) => item.filename),
    ["characters-0.png"],
  );

  const personaText = exports.persona!.toString("utf8");
  const personaExport = JSON.parse(personaText);
  assert.equal(JSON.stringify(personaExport), personaText);
  assert.equal(personaExport.type, "marinara_persona");
  assert.deepEqual(Object.keys(personaExport.data).slice(-2), ["gallery", "metadata"]);
  assertGallery(personaExport.data.gallery);

  const characterZip = new AdmZip(exports.characterZip!);
  assert.deepEqual(
    characterZip.getEntries().map((entry) => entry.entryName),
    ["Big Export.marinara.json", "Big Export (2).marinara.json"],
    "bulk ZIPs keep every file, numbering repeated names",
  );
  assert.ok(
    characterZip.getEntries().every((entry) => entry.header.method === 8),
    "bulk files stay compressed",
  );
  const zippedText = characterZip.readAsText("Big Export.marinara.json");
  const zipped = JSON.parse(zippedText);
  assert.equal(JSON.stringify(zipped, null, 2), zippedText, "bulk files stay indented JSON.stringify output");
  assert.deepEqual({ ...zipped, exportedAt: null }, { ...characterExport, exportedAt: null });
  const personaZip = new AdmZip(exports.personaZip!);
  assert.deepEqual(
    personaZip.getEntries().map((entry) => entry.entryName),
    ["Big Persona.marinara.json"],
  );
  assertGallery(JSON.parse(personaZip.readAsText("Big Persona.marinara.json")).data.gallery);

  for (const exported of [characterExport, personaExport]) {
    const imported = await importMarinara(exported, db);
    assert.equal(imported.success, true, imported.error);
    const galleryRows =
      exported.type === "marinara_character"
        ? await createCharacterGalleryStorage(db).listByCharacterId(imported.id!)
        : await createPersonaGalleryStorage(db).listByPersonaId(imported.id!);
    assert.equal(galleryRows.length, IMAGE_COUNT, "import restores every gallery image");
    const folder = exported.type === "marinara_character" ? "characters" : "personas";
    for (const row of galleryRows) {
      const bytes = await readFile(join(dataDir, "gallery", row.filePath));
      const filename = row.filePath.split("/").pop()!;
      assert.equal(sha(bytes), imageHashes.get(filename), `${filename} imports with its bytes`);
    }
    scratch.push(join(dataDir, "gallery", folder, imported.id!));
  }

  // ── An import over the server's body limit is refused with a plain 413, not a crash. ──
  const importApp = Fastify();
  importApp.decorate("db", db);
  importApp.setErrorHandler(errorHandler);
  await importApp.register(importRoutes, { prefix: "/api/import" });
  await importApp.listen({ host: "127.0.0.1", port: 0 });
  try {
    const tooLarge = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port: (importApp.server.address() as AddressInfo).port,
          path: "/api/import/marinara",
          method: "POST",
          headers: { "content-type": "application/json", "content-length": String(300 * 1024 * 1024) },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode!, body }));
        },
      );
      req.on("error", reject);
      req.write('{"type":"marinara_character","version":1,"data":{');
    });
    assert.equal(tooLarge.status, 413);
    assert.deepEqual(JSON.parse(tooLarge.body), { error: "The request body is larger than this endpoint accepts." });
  } finally {
    await importApp.close();
  }
} finally {
  await closeDB();
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
}

console.log("Native export memory regression passed.");
