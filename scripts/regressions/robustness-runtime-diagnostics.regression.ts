// Admin runtime diagnostics: GET /api/admin/runtime-diagnostics is privileged,
// never cached, carries counts and states only (no row content, no stored
// secrets) and adds what /api/health leaves out: storage residency and whether
// each capability package runtime is actually live.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-runtime-diagnostics-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
delete process.env.ADMIN_SECRET;
delete process.env.BASIC_AUTH_USER;
delete process.env.BASIC_AUTH_PASS;

const SECRET = "sk-regression-diagnostics-secret-0000";
const ROW_TEXT = "diagnostics fixture value that must never leave the store";

try {
  const diagnostics = await import("../../packages/server/src/lib/runtime-diagnostics.js");

  // 1. Package runtime state: the registry status alone can read "active" for a
  //    server package whose runtime is not running.
  {
    const { derivePackageRuntimeState } = diagnostics;
    const base = { status: "active", readiness: "pending", hasServer: true, live: false, activationFailed: false };
    assert.equal(derivePackageRuntimeState({ ...base, activationFailed: true }), "failed", "recorded failure");
    assert.equal(derivePackageRuntimeState(base), "pending", "not live and no failure yet: still activating");
    assert.equal(derivePackageRuntimeState({ ...base, live: true, readiness: "ready" }), "active");
    assert.equal(derivePackageRuntimeState({ ...base, hasServer: false, live: null }), "active", "client-only");
    assert.equal(derivePackageRuntimeState({ ...base, status: "restart-required" }), "restart-required");
    assert.equal(derivePackageRuntimeState({ ...base, status: "error" }), "failed");
    assert.equal(derivePackageRuntimeState({ ...base, live: true, readiness: "error" }), "failed");
  }

  // 2. Before storage opens the storage section says so instead of throwing.
  assert.deepEqual(diagnostics.collectStorageDiagnostics(), { open: false });

  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB, getFileStoreStats } = await import("../../packages/server/src/db/connection.js");
  const { appSettings } = await import("../../packages/server/src/db/schema/index.js");
  const { capabilityPackageManager } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const { capabilityModuleRuntime } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  const app = await buildApp();
  try {
    await app.ready();
    const db = await getDB();
    await db.insert(appSettings).values({
      key: "diagnostics-fixture",
      value: `${ROW_TEXT} ${SECRET}`,
      updatedAt: new Date().toISOString(),
    });

    // 3. The store reports counts only.
    const stats = getFileStoreStats();
    assert.ok(stats, "stats are available while storage is open");
    assert.ok((stats.tables.app_settings?.rows ?? 0) >= 1, "row counts reflect writes");
    assert.equal(typeof stats.residentChatUnits, "number");
    assert.ok(!JSON.stringify(stats).includes(ROW_TEXT), "stats never carry row content");

    // 4. The route: privileged, no-store, and free of row content and secrets.
    const response = await app.inject({ method: "GET", url: "/api/admin/runtime-diagnostics" });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.ok(!response.body.includes(SECRET), "stored secrets never appear in diagnostics");
    assert.ok(!response.body.includes(ROW_TEXT), "row content never appears in diagnostics");
    const body = response.json();
    assert.equal(typeof body.generatedAt, "string");
    assert.equal(body.process.pid, process.pid);
    assert.equal(typeof body.process.uptimeSeconds, "number");
    assert.equal(body.storage.open, true);
    assert.ok(body.storage.residentRows >= 1);
    assert.ok(Array.isArray(body.storage.dirtyTables));
    assert.equal("tables" in body.storage, false, "per-table detail stays out of the reply");
    assert.ok(body.capabilityPackages.counts && Array.isArray(body.capabilityPackages.packages));
    for (const key of ["version", "build", "memory", "sidecars"]) {
      assert.equal(key in body, false, `${key} is served by /api/health, not repeated here`);
    }

    // 5. A request from outside the trusted network is refused by the privileged gate.
    const remote = await app.inject({
      method: "GET",
      url: "/api/admin/runtime-diagnostics",
      remoteAddress: "203.0.113.7",
    });
    assert.ok(remote.statusCode >= 400, `remote diagnostics must be refused (got ${remote.statusCode})`);

    // 6. A package whose activation failed shows as failed, with the time of
    //    the failure, even when the registry still reads "active".
    const manager = capabilityPackageManager as unknown as Record<string, unknown>;
    const runtime = capabilityModuleRuntime as unknown as {
      activateOne: (...args: unknown[]) => Promise<void>;
    };
    const saved = {
      installed: manager.installed,
      markRuntimeReadiness: manager.markRuntimeReadiness,
      markRuntimeStatus: manager.markRuntimeStatus,
      runtimeBlockReason: manager.runtimeBlockReason,
    };
    const fixture = {
      id: "pkg-broken",
      version: "1.0.0",
      manifest: { entrypoints: { server: "server.mjs" } },
      installedAt: new Date().toISOString(),
      status: "active",
      error: null,
      readiness: "pending",
      readinessError: null,
      legacy: false,
    };
    try {
      manager.markRuntimeReadiness = async () => undefined;
      manager.markRuntimeStatus = async () => undefined;
      manager.runtimeBlockReason = () => "blocked for regression";
      await runtime.activateOne(app, { installed: fixture }, false, false);
      const recorded = capabilityModuleRuntime.runtimeState().activationErrors["pkg-broken"];
      assert.equal(recorded?.message, "blocked for regression");
      manager.installed = async () => [fixture];
      const packages = await diagnostics.collectCapabilityPackageDiagnostics();
      assert.deepEqual(packages.counts, { active: 0, failed: 1, "restart-required": 0, pending: 0 });
      assert.equal(packages.packages[0]?.state, "failed");
      assert.equal(packages.packages[0]?.live, false);
      assert.equal(packages.packages[0]?.error, "blocked for regression");
      assert.equal(packages.packages[0]?.lastActivationFailureAt, recorded?.at);
    } finally {
      Object.assign(manager, saved);
    }
  } finally {
    await app.close();
  }
  assert.equal(getFileStoreStats(), null, "stats are gone once storage closes");
  console.info("Runtime diagnostics regression passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
