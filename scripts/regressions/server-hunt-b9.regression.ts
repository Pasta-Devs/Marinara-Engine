import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// POST /api/chat-presets/:id/duplicate must validate the optional name like
// create/update do (non-empty string, at most 120 characters) instead of
// storing whatever the body carried.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b9-"));
const previousEnv = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
  LOG_LEVEL: process.env.LOG_LEVEL,
};

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): any }>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";
  process.env.LOG_LEVEL = "silent";

  const { buildApp } = await import("../../packages/server/src/app.js");
  app = await buildApp();
  await app.ready();

  const listResponse = await app.inject({ method: "GET", url: "/api/chat-presets" });
  assert.equal(listResponse.statusCode, 200);
  const profiles = listResponse.json() as Array<{ id: string; name: string }>;
  assert.ok(profiles.length > 0, "startup must seed default settings profiles");
  const source = profiles[0]!;
  const countBefore = profiles.length;

  const badNames: unknown[] = ["", "   ", 123, { nested: true }, "x".repeat(121)];
  for (const name of badNames) {
    const response = await app.inject({
      method: "POST",
      url: `/api/chat-presets/${source.id}/duplicate`,
      payload: { name },
    });
    assert.equal(response.statusCode, 400, `duplicate with name ${JSON.stringify(name).slice(0, 40)} must be rejected`);
  }

  const afterBad = (await app.inject({ method: "GET", url: "/api/chat-presets" })).json() as unknown[];
  assert.equal(afterBad.length, countBefore, "rejected duplicates must not create profiles");

  const named = await app.inject({
    method: "POST",
    url: `/api/chat-presets/${source.id}/duplicate`,
    payload: { name: "  Trimmed Copy  " },
  });
  assert.equal(named.statusCode, 200);
  assert.equal(named.json().name, "Trimmed Copy", "valid names are trimmed and kept");

  const unnamed = await app.inject({
    method: "POST",
    url: `/api/chat-presets/${source.id}/duplicate`,
    payload: {},
  });
  assert.equal(unnamed.statusCode, 200, "omitted name must still work");
  assert.equal(unnamed.json().name, `${source.name} Copy`, "omitted name falls back to '<source> Copy'");

  const noBody = await app.inject({ method: "POST", url: `/api/chat-presets/${source.id}/duplicate` });
  assert.equal(noBody.statusCode, 200, "a request with no body must still duplicate");

  const missing = await app.inject({
    method: "POST",
    url: "/api/chat-presets/does-not-exist/duplicate",
    payload: { name: "Anything" },
  });
  assert.equal(missing.statusCode, 404);

  console.log("server-hunt-b9 regression passed");
} finally {
  await app?.close();
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
