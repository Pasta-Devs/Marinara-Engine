import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  PersonalExtension,
  PersonalExtensionListItem,
} from "../../packages/shared/src/types/personal-extension.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { installedExtensions } from "../../packages/server/src/db/schema/index.js";
import { personalExtensionsRoutes } from "../../packages/server/src/routes/personal-extensions.routes.js";
import { createPersonalExtensionSettingsStorage } from "../../packages/server/src/services/extensions/personal-extension-settings.service.js";
import { createPersonalExtensionsStorage } from "../../packages/server/src/services/extensions/personal-extension-storage.service.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";

const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireFromServer("fastify") as typeof import("fastify").default;
const directory = mkdtempSync(join(tmpdir(), "marinara-extension-list-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
const previousExternalGate = process.env.ENABLE_EXTERNAL_EXTENSIONS;
process.env.FILE_STORAGE_DIR = directory;
process.env.ENABLE_EXTERNAL_EXTENSIONS = "true";
const db = await createFileNativeDB();
const app = Fastify({ logger: false });
app.decorate("db", db);

try {
  await app.register(personalExtensionsRoutes, { prefix: "/api/personal-extensions" });
  const storage = createPersonalExtensionsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  await appSettings.set("external-extensions-enabled", "true");
  const settings = createPersonalExtensionSettingsStorage(appSettings);
  const original = await storage.create({
    name: "Client list fixture",
    version: "1.0.0",
    runtime: "client",
    capabilities: ["read_active_characters"],
    css: "body { color: red; }",
    js: "globalThis.original = true;",
  });
  assert.ok(original);
  await settings.patch(original.id, { kept: "user data" });
  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/personal-extensions/${original.id}`,
    payload: { version: "2.0.0", css: "body { color: blue; }", js: "globalThis.updated = true;" },
  });
  assert.equal(updateResponse.statusCode, 200);
  const updated = updateResponse.json<PersonalExtension>();
  assert.equal(updated.js, "globalThis.updated = true;");
  assert.equal(updated.revisions[0]?.js, original.js, "Update responses retain full revisions");
  assert.equal(updated.revisions[0]?.css, original.css);

  const server = await storage.create({
    name: "Server list fixture",
    runtime: "server",
    serverJs: "export function start() { /* original */ }",
  });
  assert.ok(server);
  const updatedServer = await storage.update(server.id, {
    serverJs: "export function start() { /* updated */ }",
  });
  assert.ok(updatedServer);
  const empty = await storage.create({ name: "No history", runtime: "client", js: "void 0;" });
  assert.ok(empty);

  const before = await db.select().from(installedExtensions);
  const response = await app.inject({ method: "GET", url: "/api/personal-extensions" });
  assert.equal(response.statusCode, 200);
  const listed = response.json<PersonalExtensionListItem[]>();
  assert.equal(listed.length, 3);
  for (const expected of [updated, updatedServer, empty]) {
    const actual = listed.find((extension) => extension.id === expected.id);
    assert.ok(actual);
    const { revisions, ...current } = actual;
    const { revisions: fullRevisions, ...expectedCurrent } = expected;
    if (expected.runtime === "server") {
      assert.deepEqual(current, { ...expectedCurrent, serverStatus: "stopped", serverError: null });
    } else {
      assert.deepEqual(current, expectedCurrent, "Current code and all other fields stay unchanged");
    }
    assert.deepEqual(
      revisions,
      fullRevisions.map(({ contentHash, version, runtime, capabilities, savedAt }) => ({
        contentHash,
        version,
        runtime,
        capabilities,
        savedAt,
      })),
    );
    for (const revision of revisions) {
      for (const field of ["css", "js", "serverJs"]) assert.equal(Object.hasOwn(revision, field), false);
    }
  }
  assert.deepEqual(await db.select().from(installedExtensions), before, "Listing must not mutate stored revisions");
  assert.equal((await storage.getById(original.id))?.revisions[0]?.js, original.js);
  assert.equal((await storage.getById(server.id))?.revisions[0]?.serverJs, server.serverJs);

  const restoredResponse = await app.inject({
    method: "POST",
    url: `/api/personal-extensions/${original.id}/rollback`,
    payload: { contentHash: original.contentHash },
  });
  assert.equal(restoredResponse.statusCode, 200);
  const restored = restoredResponse.json<PersonalExtension>();
  assert.equal(restored.contentHash, original.contentHash);
  assert.equal(restored.js, original.js);
  assert.equal(restored.css, original.css);
  assert.equal(restored.version, original.version);
  assert.equal(restored.enabled, false);
  assert.equal(restored.approvedHash, null);
  assert.equal(restored.revisions[0]?.js, updated.js, "Rollback responses retain full revisions");
  assert.deepEqual(await settings.get(original.id), { kept: "user data" });
  const approved = await storage.approve(restored.id, restored.contentHash);
  assert.equal(approved?.enabled, true);
  assert.equal((await storage.disable(restored.id))?.enabled, false);
  console.info("Extension list response regression passed");
} finally {
  await app.close();
  await db._fileStore.close();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  if (previousExternalGate === undefined) delete process.env.ENABLE_EXTERNAL_EXTENSIONS;
  else process.env.ENABLE_EXTERNAL_EXTENSIONS = previousExternalGate;
  rmSync(directory, { recursive: true, force: true });
}
