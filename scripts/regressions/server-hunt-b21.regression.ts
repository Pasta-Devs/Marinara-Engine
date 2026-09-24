import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

// Server hunt batch 21:
//  - knowledge-sources: a failed upload removes its partial file; a corrupt
//    meta.json is moved aside instead of being overwritten with one entry.
//  - lorebooks: bulk export keeps lorebooks that share a sanitized name; a move
//    that fails after source removal started keeps the created copies.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b21-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  LOG_LEVEL: process.env.LOG_LEVEL,
};
type Response = { statusCode: number; body: string; rawPayload: Buffer; json(): any };
type App = { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<Response> };
const apps: App[] = [];

function multipartBody(filename: string, content: string) {
  const boundary = "----b21boundary";
  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.LOG_LEVEL = "silent";

  const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = serverRequire("fastify");
  const multipart = serverRequire("@fastify/multipart");

  // ── Knowledge sources ──
  {
    const { knowledgeSourcesRoutes } = await import("../../packages/server/src/routes/knowledge-sources.routes.js");
    const server = Fastify();
    await server.register(multipart, { limits: { fileSize: 64 } });
    await server.register(knowledgeSourcesRoutes, { prefix: "/api/knowledge-sources" });
    apps.push(server);
    const sourcesDir = join(dataDir, "knowledge-sources");
    const upload = (name: string, content: string) =>
      server.inject({ method: "POST", url: "/api/knowledge-sources/upload", ...multipartBody(name, content) });

    const ok = await upload("small.txt", "hello");
    assert.equal(ok.statusCode, 200, ok.body);
    const first = ok.json();

    const tooBig = await upload("big.txt", "x".repeat(4096));
    assert.equal(tooBig.statusCode, 413, `oversized upload must be rejected, got ${tooBig.statusCode}`);
    const files = readdirSync(sourcesDir).filter((name) => name.endsWith(".txt"));
    assert.deepEqual(files, [first.filename], "failed upload must not leave a partial file behind");

    // Corrupt meta.json: the next upload must not replace it with a single entry.
    const metaFile = join(sourcesDir, "meta.json");
    writeFileSync(metaFile, '{"broken": ', "utf-8");
    const afterCorrupt = await upload("second.txt", "world");
    assert.ok(afterCorrupt.statusCode >= 500, `upload over corrupt meta must fail, got ${afterCorrupt.statusCode}`);
    const corruptCopies = readdirSync(sourcesDir).filter((name) => name.startsWith("meta.json.corrupt-"));
    assert.equal(corruptCopies.length, 1, "corrupt meta.json is kept aside for recovery");
    assert.equal(readFileSync(join(sourcesDir, corruptCopies[0]!), "utf-8"), '{"broken": ');
    assert.equal(
      readdirSync(sourcesDir).filter((name) => name.endsWith(".txt")).length,
      1,
      "the upload that could not be recorded removes its file",
    );
  }

  // ── Lorebooks ──
  {
    const [{ createFileNativeDB }, { lorebooksRoutes }] = await Promise.all([
      import("../../packages/server/src/db/file-backed-store.js"),
      import("../../packages/server/src/routes/lorebooks.routes.js"),
    ]);
    const realDb = await createFileNativeDB();
    let deleteCalls = 0;
    let failDeletesAfter = Infinity;
    const db = new Proxy(realDb as object, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop === "delete" && typeof value === "function") {
          return (...args: unknown[]) => {
            deleteCalls++;
            if (deleteCalls > failDeletesAfter) {
              // Fail once only, so a rollback that deletes the copies can succeed.
              failDeletesAfter = Infinity;
              throw new Error("simulated delete failure");
            }
            return value.apply(target, args);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const server = Fastify();
    server.decorate("db", db);
    await server.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
    apps.push(server);
    const request = async (method: string, url: string, payload?: unknown) => {
      const response = await server.inject({ method, url, payload });
      assert.ok(response.statusCode < 400, `${method} ${url} -> ${response.statusCode} ${response.body}`);
      return response.body ? response.json() : null;
    };

    const a = await request("POST", "/api/lorebooks", { name: "World" });
    const b = await request("POST", "/api/lorebooks", { name: "world" });
    const c = await request("POST", "/api/lorebooks", { name: "A/B" });
    const d = await request("POST", "/api/lorebooks", { name: "A B" });

    const AdmZip = serverRequire("adm-zip");
    for (const format of ["native", "compatible"] as const) {
      const res = await server.inject({
        method: "POST",
        url: "/api/lorebooks/export-bulk",
        payload: { ids: [a.id, b.id, c.id, d.id], format },
      });
      assert.equal(res.statusCode, 200, res.body);
      const names = new AdmZip(res.rawPayload).getEntries().map((entry: { entryName: string }) => entry.entryName);
      assert.equal(names.length, 4, `${format}: every lorebook gets its own zip entry (${names.join(", ")})`);
      assert.equal(new Set(names.map((name: string) => name.toLowerCase())).size, 4, `${format}: names are unique`);
    }

    // Move with a removal failure part way through.
    const source = await request("POST", "/api/lorebooks", { name: "Source" });
    const target = await request("POST", "/api/lorebooks", { name: "Target" });
    const entryIds: string[] = [];
    for (const name of ["One", "Two", "Three"]) {
      const entry = await request("POST", `/api/lorebooks/${source.id}/entries`, {
        lorebookId: source.id,
        name,
        keys: [name],
        content: `${name} content`,
      });
      entryIds.push(entry.id);
    }
    deleteCalls = 0;
    failDeletesAfter = 1; // first source removal succeeds, the second throws
    const moved = await server.inject({
      method: "POST",
      url: `/api/lorebooks/${source.id}/entries/transfer`,
      payload: { entryIds, targetLorebookId: target.id, operation: "move" },
    });
    failDeletesAfter = Infinity;
    assert.ok(moved.statusCode >= 500, `move should fail, got ${moved.statusCode}`);
    const sourceNames = ((await request("GET", `/api/lorebooks/${source.id}/entries`)) as Array<{ name: string }>).map(
      (entry) => entry.name,
    );
    const targetNames = ((await request("GET", `/api/lorebooks/${target.id}/entries`)) as Array<{ name: string }>).map(
      (entry) => entry.name,
    );
    for (const name of ["One", "Two", "Three"]) {
      assert.ok(
        sourceNames.includes(name) || targetNames.includes(name),
        `entry ${name} must survive a failed move (source: ${sourceNames}, target: ${targetNames})`,
      );
    }
  }

  console.log("server-hunt-b21 regression passed");
} finally {
  for (const app of apps) await app.close().catch(() => {});
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
}
