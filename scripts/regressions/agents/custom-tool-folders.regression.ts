import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tool-folders-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "file-storage");
process.env.MARINARA_FILE_STORAGE_DIR = process.env.FILE_STORAGE_DIR;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const { buildApp } = await import("../../../packages/server/src/app.js");
const { createLibraryFoldersStorage } =
  await import("../../../packages/server/src/services/storage/library-folders.storage.js");
const { createCustomToolsStorage } =
  await import("../../../packages/server/src/services/storage/custom-tools.storage.js");

const app = await buildApp();
try {
  await app.ready();
  const folders = createLibraryFoldersStorage(app.db);
  const tools = createCustomToolsStorage(app.db);
  const make = async (name: string, enabled = true) =>
    (await tools.create({ name, description: "", executionType: "static", staticResult: "ok", enabled }))!;
  const a = await make("folder_tool_a");
  const b = await make("folder_tool_b");
  const loose = await make("folder_tool_loose");
  const off = await make("folder_tool_off", false);
  const names = async () => (await tools.listEnabled()).map((tool) => tool.name).sort();
  const pausedFlags = async () =>
    Object.fromEntries((await tools.list()).map((tool) => [tool.name, tool.pausedByFolder]));

  const folder = (await folders.create("functions", { name: "Pack" }))!;
  await folders.moveItems("functions", { folderId: folder.id, itemIds: [a.id, b.id, off.id] });
  assert.deepEqual(await names(), ["folder_tool_a", "folder_tool_b", "folder_tool_loose"]);

  await folders.update("functions", folder.id, { paused: true });
  assert.equal((await folders.getById("functions", folder.id))?.paused, true);
  assert.deepEqual(await names(), ["folder_tool_loose"], "a paused folder hides its tools from listEnabled");
  assert.deepEqual(await pausedFlags(), {
    folder_tool_a: true,
    folder_tool_b: true,
    folder_tool_loose: false,
    folder_tool_off: true,
  });
  assert.equal((await tools.getById(a.id))?.enabled, "true", "pausing never touches the tool's own switch");

  await folders.update("functions", folder.id, { paused: false });
  assert.deepEqual(await names(), ["folder_tool_a", "folder_tool_b", "folder_tool_loose"], "unpausing restores");

  assert.equal(await tools.setEnabled([a.id, "missing"], false), false);
  assert.deepEqual(await names(), ["folder_tool_a", "folder_tool_b", "folder_tool_loose"], "no partial change");
  assert.equal(await tools.setEnabled([a.id, b.id], false), true);
  assert.deepEqual(await names(), ["folder_tool_loose"]);
  assert.equal(await tools.setEnabled([a.id, off.id], true), true);
  assert.deepEqual(await names(), ["folder_tool_a", "folder_tool_loose", "folder_tool_off"]);

  const put = await app.inject({
    method: "PUT",
    url: "/api/custom-tools/enabled",
    payload: { toolIds: [a.id, "missing"], enabled: false },
  });
  assert.equal(put.statusCode, 404, put.body);
  const putOk = await app.inject({
    method: "PUT",
    url: "/api/custom-tools/enabled",
    payload: { toolIds: [a.id], enabled: false },
  });
  assert.equal(putOk.statusCode, 204, putOk.body);
  assert.equal((await tools.getById(a.id))?.enabled, "false");

  await tools.remove(a.id);
  assert.ok(!(await folders.getById("functions", folder.id))?.itemIds.includes(a.id));
  assert.ok((await folders.getById("functions", folder.id))?.itemIds.includes(b.id));
} finally {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
