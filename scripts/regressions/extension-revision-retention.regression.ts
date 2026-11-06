import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personalExtensionRevisionRetentionSchema } from "../../packages/shared/src/schemas/personal-extension.schema.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { installedExtensions } from "../../packages/server/src/db/schema/index.js";
import { personalExtensionsRoutes } from "../../packages/server/src/routes/personal-extensions.routes.js";
import { createPersonalExtensionSettingsStorage } from "../../packages/server/src/services/extensions/personal-extension-settings.service.js";
import { createPersonalExtensionsStorage } from "../../packages/server/src/services/extensions/personal-extension-storage.service.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";
import {
  EXTENSION_REVISION_HISTORY_RATE_LIMIT,
  rateLimitHook,
  resetRateLimitBucketsForTests,
} from "../../packages/server/src/middleware/rate-limit.js";

const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireFromServer("fastify") as typeof import("fastify").default;
const directory = mkdtempSync(join(tmpdir(), "marinara-extension-retention-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = directory;
const db = await createFileNativeDB();
const app = Fastify({ logger: false });
app.decorate("db", db);
resetRateLimitBucketsForTests();
app.addHook("onRequest", rateLimitHook);
let handlerVisits = 0;
app.addHook("preHandler", async () => {
  handlerVisits += 1;
});

try {
  await app.register(personalExtensionsRoutes, { prefix: "/api/personal-extensions" });
  const storage = createPersonalExtensionsStorage(db);
  const appSettings = createAppSettingsStorage(db);
  const userStorage = createPersonalExtensionSettingsStorage(appSettings);
  for (const raw of ["", "bad", "-1", "11"]) {
    await appSettings.set("extension-revision-retention", raw);
    assert.equal(await storage.getRevisionRetention(), 10, "Invalid stored limits preserve the default history");
  }
  await appSettings.remove("extension-revision-retention");
  const extensions = [];
  for (const source of ["professor_mari", "external"] as const) {
    const extension = await storage.create(
      { name: source, runtime: "client", js: "void 0;", version: "0" },
      { source },
    );
    assert.ok(extension);
    extensions.push(extension);
  }
  const server = await storage.create({ name: "Server", runtime: "server", serverJs: "export function start() {}" });
  assert.ok(server);
  extensions.push(server);
  for (const extension of extensions) {
    await userStorage.patch(extension.id, { saved: "keep me" });
    for (let version = 1; version <= 12; version++) {
      await storage.update(
        extension.id,
        extension.runtime === "server"
          ? { version: String(version), serverJs: `export function start() { return ${version}; }` }
          : { version: String(version), js: `void ${version};` },
      );
    }
    const current = await storage.getById(extension.id);
    assert.ok(current);
    assert.equal(current.revisions.length, 10);
    assert.equal(current.revisions[0].version, "11");
    await storage.approve(current.id, current.contentHash);
  }
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/personal-extensions/revision-history" })).json().limit,
    10,
  );
  for (const limit of [-1, 11, 1.5, "2", null]) {
    assert.equal(personalExtensionRevisionRetentionSchema.safeParse({ limit }).success, false);
  }
  const before = await storage.list();
  const denied = await app.inject({
    method: "PATCH",
    url: "/api/personal-extensions/revision-history",
    payload: { limit: 2 },
  });
  assert.equal(denied.statusCode, 409);
  assert.equal(denied.json().code, "confirmation_required");
  assert.equal(await storage.getRevisionRetention(), 10);
  assert.deepEqual(await storage.list(), before, "An unconfirmed reduction must not delete any history");

  const accepted = await app.inject({
    method: "PATCH",
    url: "/api/personal-extensions/revision-history",
    payload: { limit: 2, confirmPrune: true },
  });
  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(accepted.json(), { limit: 2 });
  assert.equal(
    await createPersonalExtensionsStorage(db).getRevisionRetention(),
    2,
    "Retention is held in shared storage",
  );
  for (const current of before) {
    const pruned = await storage.getById(current.id);
    assert.deepEqual(
      pruned,
      { ...current, revisions: current.revisions.slice(0, 2) },
      "Pruning changes only historical revisions",
    );
    assert.deepEqual(await userStorage.get(current.id), { saved: "keep me" });
    const restored = await storage.rollback(current.id, current.revisions[0].contentHash);
    assert.ok(restored);
    assert.equal(restored.revisions.length, 2);
    assert.equal(
      restored.revisions[0].contentHash,
      current.contentHash,
      "Rollback retains the previous current code first",
    );
  }

  await storage.setRevisionRetention({ limit: 0, confirmPrune: true });
  for (const extension of extensions) {
    const updated = await storage.update(
      extension.id,
      extension.runtime === "server" ? { serverJs: "export function start() { return 100; }" } : { js: "void 100;" },
    );
    assert.deepEqual(updated?.revisions, [], "Zero disables history for every source and runtime");
  }
  assert.deepEqual(
    await storage.setRevisionRetention({ limit: 5 }),
    { limit: 5 },
    "Increasing retention requires no deletion confirmation",
  );
  const personal = extensions[0];
  await Promise.all([
    storage.update(personal.id, { js: "void 101;" }),
    createPersonalExtensionsStorage(db).setRevisionRetention({ limit: 1, confirmPrune: true }),
    storage.update(personal.id, { js: "void 102;" }),
  ]);
  assert.equal(
    (await storage.getById(personal.id))?.revisions.length,
    1,
    "A concurrent edit cannot restore pruned history",
  );
  assert.deepEqual(await userStorage.get(personal.id), { saved: "keep me" });

  // Profile restore may retain more history than the currently configured limit.
  const active = await storage.getById(personal.id);
  assert.ok(active);
  await storage.approve(personal.id, active.contentHash);
  await appSettings.set("extension-revision-retention", "3");
  await db
    .update(installedExtensions)
    .set({ revisions: JSON.stringify(before[0].revisions.slice(0, 8)) })
    .where(eq(installedExtensions.id, personal.id));
  const restored = await storage.getById(personal.id);
  assert.ok(restored);
  assert.equal(restored.enabled, true);
  assert.equal(restored.approvedHash, restored.contentHash);
  for (const limit of [5, 3]) {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/personal-extensions/revision-history",
      payload: { limit },
    });
    assert.equal(
      response.statusCode,
      409,
      "Any actual pruning requires confirmation, including equal or raised limits",
    );
    assert.equal(response.json().code, "confirmation_required");
    assert.equal(await storage.getRevisionRetention(), 3);
    assert.deepEqual(
      await storage.getById(personal.id),
      restored,
      "Unconfirmed settings preserve all restored history",
    );
  }
  const confirmed = await app.inject({
    method: "PATCH",
    url: "/api/personal-extensions/revision-history",
    payload: { limit: 5, confirmPrune: true },
  });
  assert.equal(confirmed.statusCode, 200);
  assert.deepEqual(await storage.getById(personal.id), { ...restored, revisions: restored.revisions.slice(0, 5) });
  assert.deepEqual(await userStorage.get(personal.id), { saved: "keep me" });
  const expanded = await app.inject({
    method: "PATCH",
    url: "/api/personal-extensions/revision-history",
    payload: { limit: 7 },
  });
  assert.equal(expanded.statusCode, 200, "Raising the limit without pruning needs no confirmation");
  assert.equal((await storage.getById(personal.id))?.revisions.length, 5);

  const beforeFlood = await storage.list();
  const remoteAddress = "198.51.100.42";
  for (let count = 0; count < EXTENSION_REVISION_HISTORY_RATE_LIMIT.max; count += 1) {
    const response = await app.inject({
      method: "GET",
      url: "/api/personal-extensions/revision-history?proof=rate-limit",
      remoteAddress,
    });
    assert.equal(response.statusCode, 403, "Unprivileged requests still reach the access gate below the burst limit");
    assert.equal(response.headers["ratelimit-limit"], String(EXTENSION_REVISION_HISTORY_RATE_LIMIT.max));
  }
  const visitsBeforeBlocked = handlerVisits;
  for (const method of ["GET", "PATCH"] as const) {
    const response = await app.inject({
      method,
      url: "/api/personal-extensions/revision-history",
      remoteAddress,
      ...(method === "PATCH" ? { payload: { limit: 0, confirmPrune: true } } : {}),
    });
    assert.equal(response.statusCode, 429, "GET and PATCH share the actual route-rule burst limit");
    assert.ok(Number(response.headers["retry-after"]) > 0);
    assert.equal(handlerVisits, visitsBeforeBlocked, "Rate limiting precedes privileged handlers and pruning");
  }
  assert.deepEqual(await storage.list(), beforeFlood);
  assert.equal(await storage.getRevisionRetention(), 7);
  console.info("Extension revision retention regression passed");
} finally {
  resetRateLimitBucketsForTests();
  await app.close();
  await db._fileStore.close();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(directory, { recursive: true, force: true });
}
