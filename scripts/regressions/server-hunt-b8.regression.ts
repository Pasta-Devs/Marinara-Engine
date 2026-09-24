// Regression checks for server-hunt batch 8 (characters.routes.ts):
// minimal PNG fallback, bounded PNG chunk walk, gallery video manifest lock,
// gallery video cleanup on delete, embedded-lorebook import write, group PATCH 404,
// gallery image upload truncation handling.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b8-"));
const fileStorageDir = join(dataDir, "file-storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

type InjectResponse = { statusCode: number; body: string; json(): any };
let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<InjectResponse>;
} | null = null;

function readChunks(png: Buffer) {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + len) });
    offset += 12 + len;
  }
  return { chunks, end: offset };
}

try {
  const routes = await import("../../packages/server/src/routes/characters.routes.js");
  const { createMinimalPng, injectTextChunk, prependGalleryVideoEntry, removeGalleryVideoClip } = routes;

  // 1. createMinimalPng produces a decodable 1x1 transparent PNG.
  {
    const png = createMinimalPng();
    const idat = readChunks(png).chunks.find((chunk) => chunk.type === "IDAT");
    assert.ok(idat, "minimal PNG has an IDAT chunk");
    assert.deepEqual([...inflateSync(idat.data)], [0, 0, 0, 0, 0], "IDAT is a valid zlib stream of one scanline");
    const sharp = createRequire(new URL("../../packages/server/package.json", import.meta.url))("sharp");
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1);
    assert.equal(info.height, 1);
    assert.deepEqual([...data], [0, 0, 0, 0], "decodes to one transparent pixel");
    const carded = injectTextChunk(png, "chara", "e30=");
    await sharp(carded).raw().toBuffer();
  }

  // 2. injectTextChunk tolerates trailing bytes after IEND and rejects truncated chunks.
  {
    const base = createMinimalPng();
    for (const extra of [1, 2, 3, 7]) {
      const withTrailing = Buffer.concat([base, Buffer.alloc(extra, 0xab)]);
      const out = injectTextChunk(withTrailing, "chara", "e30=");
      const { chunks, end } = readChunks(out);
      assert.equal(end, out.length, `no trailing garbage kept (${extra} extra bytes)`);
      assert.deepEqual(
        chunks.map((chunk) => chunk.type),
        ["IHDR", "tEXt", "IDAT", "IEND"],
        `chunk order is intact (${extra} extra bytes)`,
      );
    }
    const truncated = base.subarray(0, base.length - 14); // cut into the IDAT chunk
    assert.throws(() => injectTextChunk(truncated, "chara", "e30="), /Truncated PNG chunk/);
  }

  // 3. Gallery video manifest writes are serialized per entity.
  {
    const root = join(dataDir, "manifest-lock-root");
    const entityId = "entity-a";
    const makeEntry = (id: string) => ({
      id,
      filename: `${id}.mp4`,
      label: id,
      prompt: "",
      provider: "upload",
      model: "",
      aspectRatio: "video",
      durationSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await prependGalleryVideoEntry(root, entityId, makeEntry("keep-0"));
    await prependGalleryVideoEntry(root, entityId, makeEntry("gone-0"));
    writeFileSync(join(root, entityId, "gone-0.mp4"), "x");
    const ids = Array.from({ length: 12 }, (_, index) => `v${index}`);
    await Promise.all([
      ...ids.map((id) => prependGalleryVideoEntry(root, entityId, makeEntry(id))),
      removeGalleryVideoClip(root, entityId, "uploaded:gone-0"),
    ]);
    const manifest = JSON.parse(readFileSync(join(root, entityId, "manifest.json"), "utf8"));
    const stored = new Set(manifest.videos.map((video: { id: string }) => video.id));
    for (const id of [...ids, "keep-0"]) assert.ok(stored.has(id), `concurrent upload ${id} kept in manifest`);
    assert.ok(!stored.has("gone-0"), "concurrently deleted clip does not come back");
    assert.equal(stored.size, ids.length + 1);
  }

  const [{ buildApp }, { getDB }, { createCharactersStorage }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/storage/characters.storage.js"),
  ]);
  app = (await buildApp()) as unknown as NonNullable<typeof app>;
  await app!.ready();
  const db = await getDB();
  const storage = createCharactersStorage(db);

  // 4. PATCH on unknown group ids returns 404 instead of 200 null.
  {
    const group = await app!.inject({
      method: "PATCH",
      url: "/api/characters/groups/does-not-exist",
      payload: { name: "Renamed" },
    });
    assert.equal(group.statusCode, 404, "character group PATCH 404s for an unknown id");
    const personaGroup = await app!.inject({
      method: "PATCH",
      url: "/api/characters/persona-groups/does-not-exist",
      payload: { name: "Renamed" },
    });
    assert.equal(personaGroup.statusCode, 404, "persona group PATCH 404s for an unknown id");
  }

  // 5. Deleting a character or persona removes its uploaded gallery videos.
  {
    const character = await storage.create({ name: "Video owner" } as any);
    assert.ok(character);
    const characterVideoDir = join(dataDir, "gallery", "character-videos", character.id);
    mkdirSync(characterVideoDir, { recursive: true });
    writeFileSync(join(characterVideoDir, "clip.mp4"), "video");
    writeFileSync(join(characterVideoDir, "manifest.json"), JSON.stringify({ version: 1, videos: [] }));
    const deleted = await app!.inject({ method: "DELETE", url: `/api/characters/${character.id}` });
    assert.equal(deleted.statusCode, 204);
    assert.ok(!existsSync(characterVideoDir), "character gallery video directory removed on delete");

    const persona = await storage.createPersona("Video persona", "");
    assert.ok(persona);
    const personaVideoDir = join(dataDir, "gallery", "persona-videos", persona.id);
    mkdirSync(personaVideoDir, { recursive: true });
    writeFileSync(join(personaVideoDir, "clip.mp4"), "video");
    const deletedPersona = await app!.inject({ method: "DELETE", url: `/api/characters/personas/${persona.id}` });
    assert.equal(deletedPersona.statusCode, 204);
    assert.ok(!existsSync(personaVideoDir), "persona gallery video directory removed on delete");
  }

  // 6. Embedded-lorebook import only patches its pointer, keeping edits saved during the import.
  {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      id: index,
      keys: [`key${index}`],
      content: `Entry ${index} content`,
      enabled: true,
      insertion_order: index,
    }));
    const character = await storage.create({
      name: "Lorebook owner",
      character_book: { name: "Book", entries },
      extensions: { talkativeness: 0.5, importMetadata: { source: "test" } },
    } as any);
    assert.ok(character);
    // The file store serializes writes, so a save cannot be forced into the import window
    // from here; check the write is queued and narrow, and that it keeps other keys.
    await storage.update(character.id, { extensions: { talkativeness: 0.9 } } as any);
    const response = await app!.inject({
      method: "POST",
      url: `/api/characters/${character.id}/embedded-lorebook/import`,
    });
    assert.equal(response.statusCode, 200, response.body);
    const lorebookId = response.json().lorebookId;
    const finalData = JSON.parse((await storage.getById(character.id))!.data);
    assert.equal(finalData.extensions.talkativeness, 0.9, "earlier extension edit is not reverted");
    assert.equal(finalData.extensions.importMetadata.source, "test", "other importMetadata keys are kept");
    assert.equal(finalData.extensions.importMetadata.embeddedLorebook.lorebookId, lorebookId);
    assert.equal(finalData.extensions.importMetadata.embeddedLorebook.hasEmbeddedLorebook, true);
    const routeSource = readFileSync(
      new URL("../../packages/server/src/routes/characters.routes.ts", import.meta.url),
      "utf8",
    );
    const start = routeSource.indexOf('"/:id/embedded-lorebook/import"');
    const handler = routeSource.slice(start, routeSource.indexOf("\n  });", start));
    assert.match(
      handler,
      /enqueueUpdate\(characterUpdateQueues, req\.params\.id, async \(\) => \{\s*const fresh = await storage\.getById/,
      "import pointer write runs in the character queue against a fresh row",
    );
    assert.match(handler, /importMetadata: \{\s*embeddedLorebook: \{ hasEmbeddedLorebook: true, lorebookId: result\.lorebookId \}/);
    assert.doesNotMatch(handler, /extensions: extensions as any/, "no stale full-extensions write");
  }

  // 7. Gallery image uploads check multipart truncation and clean up on failure (source check;
  //    exercising it needs a 250 MB upload).
  {
    const source = readFileSync(
      new URL("../../packages/server/src/routes/characters.routes.ts", import.meta.url),
      "utf8",
    );
    for (const route of ['"/:id/gallery/upload"', '"/personas/:id/gallery/upload"']) {
      const start = source.indexOf(route);
      assert.ok(start >= 0, `${route} exists`);
      const body = source.slice(start, source.indexOf("\n  });", start));
      assert.match(body, /isMultipartFileTruncated\(data\)/, `${route} checks truncation`);
      assert.match(body, /catch \(err\) \{\s*await unlink\(filePath\)/, `${route} unlinks on pipeline failure`);
      assert.match(body, /status\(500\)\.send\(\{ error: "Failed to save image metadata" \}\)/, `${route} rolls back`);
    }
  }

  console.log("server-hunt-b8 regression passed");
} finally {
  await app?.close().catch(() => undefined);
  try {
    const { closeDB } = await import("../../packages/server/src/db/connection.js");
    await closeDB();
  } catch {
    // ignore
  }
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
