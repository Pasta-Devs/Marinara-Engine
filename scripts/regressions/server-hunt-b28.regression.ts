import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b28-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");
const snapshotsRoot = join(dataDir, "capability-runtime-snapshots");

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function manifestFor(id: string, version: string, serverSource: string, engineMin = "2.3.0") {
  return {
    schemaVersion: 1,
    id,
    name: id,
    version,
    description: "Server hunt batch 28 fixture.",
    engine: { min: engineMin, maxExclusive: "99.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    files: [{ path: "server.mjs", sha256: sha(serverSource), bytes: Buffer.byteLength(serverSource) }],
    permissions: ["ui"],
    restartRequired: false,
  };
}

function writeVersion(id: string, version: string, serverSource: string) {
  const root = join(packagesRoot, "versions", id, version);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "server.mjs"), serverSource);
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifestFor(id, version, serverSource)));
}

function installedRecord(id: string, version: string, serverSource: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    version,
    manifest: manifestFor(id, version, serverSource),
    installedAt: "2026-09-01T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
    ...extra,
  };
}

function writeRegistry(packages: unknown[]) {
  mkdirSync(packagesRoot, { recursive: true });
  writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, packages }, null, 2));
}

const okSource = "export async function activate() {}\n";
const failSource = 'export async function activate() { throw new Error("fixture activation failure"); }\n';

try {
  const { capabilityPackageManager } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

  // 1. Concurrent registry writers must not erase each other's changes.
  const ids = Array.from({ length: 8 }, (_, index) => `race-${index}`);
  writeRegistry(ids.map((id) => installedRecord(id, "1.0.0", okSource)));
  await Promise.all(ids.map((id) => capabilityPackageManager.markRuntimeStatus(id, "error", `broken ${id}`)));
  const afterRace = JSON.parse(readFileSync(registryPath, "utf8")) as {
    packages: Array<{ id: string; status: string; error: string | null }>;
  };
  for (const id of ids) {
    const record = afterRace.packages.find((item) => item.id === id);
    assert.equal(record?.status, "error", `Concurrent status writes must all persist (lost update for ${id})`);
    assert.equal(record?.error, `broken ${id}`);
  }

  // 2. Legacy availability migration must skip entries this Engine can never install.
  writeRegistry([installedRecord("newer-installed", "5.0.0", okSource)]);
  const originalCatalog = capabilityPackageManager.catalog;
  const catalogEntry = (manifest: ReturnType<typeof manifestFor>) => ({
    manifest,
    artifact: { url: "https://example.invalid/never-fetched.zip", sha256: "0".repeat(64), bytes: 1 },
  });
  capabilityPackageManager.catalog = (async () => ({
    schemaVersion: 2,
    packages: [
      catalogEntry(manifestFor("future-engine", "1.0.0", okSource, "98.0.0")),
      catalogEntry(manifestFor("newer-installed", "4.0.0", okSource)),
    ],
  })) as unknown as typeof capabilityPackageManager.catalog;
  try {
    const migration = await capabilityPackageManager.migrateLegacyAvailability(true);
    assert.equal(migration.migrated, true);
    assert.equal(migration.complete, false);
  } finally {
    capabilityPackageManager.catalog = originalCatalog;
  }

  // 3. Boot sweeps runtime snapshots left behind by an unclean exit.
  writeRegistry([]);
  const staleSnapshot = join(snapshotsRoot, "stale-1.0.0-deadbeef");
  mkdirSync(staleSnapshot, { recursive: true });
  writeFileSync(join(staleSnapshot, "server.mjs"), okSource);
  const { capabilityModuleRuntime } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  const app = {} as Parameters<typeof capabilityModuleRuntime.start>[0];
  await capabilityModuleRuntime.start(app);
  assert.equal(existsSync(staleSnapshot), false, "start() must remove snapshots from an earlier process");

  // 4. Rollback message must not claim a restore when the previous version also fails.
  writeVersion("rb-fail", "1.0.0", failSource);
  writeVersion("rb-fail", "2.0.0", failSource);
  writeVersion("rb-ok", "1.0.0", okSource);
  writeVersion("rb-ok", "2.0.0", failSource);
  writeRegistry([
    installedRecord("rb-fail", "2.0.0", failSource, {
      previousVersion: "1.0.0",
      previousManifest: manifestFor("rb-fail", "1.0.0", failSource),
    }),
    installedRecord("rb-ok", "2.0.0", failSource, {
      previousVersion: "1.0.0",
      previousManifest: manifestFor("rb-ok", "1.0.0", okSource),
    }),
  ]);
  await assert.rejects(
    capabilityModuleRuntime.activatePackage(app, "rb-fail"),
    (error: Error) => {
      assert.match(error.message, /rolling back to 1\.0\.0 also failed/);
      assert.doesNotMatch(error.message, /restored/);
      return true;
    },
    "A failed rollback must not be reported as restored",
  );
  await assert.rejects(
    capabilityModuleRuntime.activatePackage(app, "rb-ok"),
    /Could not activate rb-ok@2\.0\.0; restored 1\.0\.0/,
    "A working rollback is still reported as restored",
  );
  await capabilityModuleRuntime.stop();

  console.info("Server hunt batch 28 regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
