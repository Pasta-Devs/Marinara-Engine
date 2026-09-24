import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Server hunt batch 5:
// - /api/admin/expunge and /api/admin/clear-all answer 400 (not 500) when the body is missing.
// - POST /api/agents/:id/image answers 400 (not 500) for a missing or null body, or a non-string image.
// - Agent images are removed once no agent row references them (replace, PATCH, delete),
//   while a file still shared by a duplicated agent is kept.

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b5-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
  LOG_LEVEL: process.env.LOG_LEVEL,
};

type InjectResponse = { statusCode: number; json(): any };
let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<InjectResponse>;
} | null = null;

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

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

  // ── Admin routes without a body ──
  for (const url of ["/api/admin/expunge", "/api/admin/clear-all"]) {
    const res = await app.inject({ method: "POST", url });
    assert.equal(res.statusCode, 400, `${url} without a body must answer 400`);
  }

  // ── Agent image upload body guards ──
  const created = await app.inject({
    method: "POST",
    url: "/api/agents",
    payload: { type: "b5-custom-agent", name: "B5 Agent", phase: "post_processing" },
  });
  assert.equal(created.statusCode, 200, "custom agent must be created");
  const agent = created.json();

  const noBody = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/image` });
  assert.equal(noBody.statusCode, 400, "image upload without a body must answer 400");
  const nullBody = await app.inject({
    method: "POST",
    url: `/api/agents/${agent.id}/image`,
    headers: { "content-type": "application/json" },
    payload: "null",
  });
  assert.equal(nullBody.statusCode, 400, "image upload with a null body must answer 400");
  const nonString = await app.inject({
    method: "POST",
    url: `/api/agents/${agent.id}/image`,
    payload: { image: 42 },
  });
  assert.equal(nonString.statusCode, 400, "image upload with a non-string image must answer 400");

  // ── Agent image cleanup ──
  const imagesDir = join(dataDir, "agents", "images");
  const fileFor = (imagePath: string) => join(imagesDir, imagePath.split("/").pop()!);
  const upload = async (id: string) => {
    const res = await app!.inject({ method: "POST", url: `/api/agents/${id}/image`, payload: { image: PNG_1PX } });
    assert.equal(res.statusCode, 200, "image upload must succeed");
    return res.json().imagePath as string;
  };

  const first = await upload(agent.id);
  assert.ok(existsSync(fileFor(first)));
  const second = await upload(agent.id);
  assert.notEqual(first, second);
  assert.ok(!existsSync(fileFor(first)), "replaced agent image must be removed");
  assert.ok(existsSync(fileFor(second)));

  // A duplicate sharing the same image keeps the file alive.
  const dup = await app.inject({
    method: "POST",
    url: "/api/agents",
    payload: { type: "b5-custom-agent-copy", name: "B5 Copy", phase: "post_processing", imagePath: second },
  });
  assert.equal(dup.statusCode, 200);
  const duplicate = dup.json();
  const third = await upload(agent.id);
  assert.ok(existsSync(fileFor(second)), "image still used by a duplicate must be kept");

  // Deleting a custom agent removes its now-unreferenced image.
  const del = await app.inject({ method: "DELETE", url: `/api/agents/${agent.id}` });
  assert.equal(del.statusCode, 204);
  assert.ok(!existsSync(fileFor(third)), "deleted agent's image must be removed");

  // Clearing the image through PATCH removes the last reference.
  const patched = await app.inject({
    method: "PATCH",
    url: `/api/agents/${duplicate.id}`,
    payload: { imagePath: null },
  });
  assert.equal(patched.statusCode, 200);
  assert.ok(!existsSync(fileFor(second)), "image cleared by PATCH must be removed once unreferenced");
} finally {
  await app?.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Server hunt batch 5 regression passed.");
