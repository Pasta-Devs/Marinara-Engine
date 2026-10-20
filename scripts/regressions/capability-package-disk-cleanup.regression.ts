// Disk cleanup for downloaded agent packages (#7858): the startup sweep of old runtime copies (writer-lease holder
// only), runtime copies without the browser bundle, and keeping only the current and previous version of a package.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SECOND_ENGINE_FLAG = "--second-engine";
const SECOND_ENGINE_MARKER = "SECOND_ENGINE_RESULT ";

// Child mode: a second Engine starting on a data folder whose storage writer lease another process holds.
if (process.argv[2] === SECOND_ENGINE_FLAG) {
  const { buildApp } = await import("../../packages/server/src/app.js");
  let result: { started: boolean; error?: string };
  try {
    const app = await buildApp();
    await app.close();
    result = { started: true };
  } catch (error) {
    result = { started: false, error: error instanceof Error ? error.name : String(error) };
  }
  process.stdout.write(`${SECOND_ENGINE_MARKER}${JSON.stringify(result)}\n`);
  process.exit(0);
}

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-package-disk-cleanup-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const packagesRoot = join(dataDir, "capability-packages");
const versionsRoot = join(packagesRoot, "versions");
const snapshotsRoot = join(dataDir, "capability-runtime-snapshots");
const linkType = process.platform === "win32" ? "junction" : "dir";

function sha256(data: string) {
  return createHash("sha256").update(data).digest("hex");
}

/** Writes versions/<id>/<version> the way an install leaves it and returns its manifest. */
function writeVersion(
  id: string,
  version: string,
  files: Record<string, string>,
  entrypoints: { server?: string; client?: string },
) {
  const root = join(versionsRoot, id, version);
  mkdirSync(root, { recursive: true });
  const declared = Object.entries(files).map(([path, content]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
    return { path, sha256: sha256(content), bytes: Buffer.byteLength(content) };
  });
  const manifest = {
    schemaVersion: 1,
    id,
    name: id,
    version,
    description: "Package disk cleanup regression fixture.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints,
    files: declared,
    permissions: ["ui"],
    restartRequired: false,
  };
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return manifest;
}

function clientOnly(id: string, version: string) {
  return writeVersion(
    id,
    version,
    { "client.js": `export default ${JSON.stringify(version)};` },
    { client: "client.js" },
  );
}

function record(manifest: ReturnType<typeof writeVersion>, overrides: Record<string, unknown> = {}) {
  return {
    id: manifest.id,
    version: manifest.version,
    manifest,
    installedAt: "2026-10-20T00:00:00.000Z",
    status: "active",
    error: null,
    readiness: "ready",
    readinessError: null,
    legacy: false,
    ...overrides,
  };
}

function versionsOf(id: string) {
  return readdirSync(join(versionsRoot, id)).sort();
}

function snapshotEntries() {
  return readdirSync(snapshotsRoot).sort();
}

function writeReadOnly(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o400);
}

let closeDatabase: (() => Promise<void>) | null = null;
try {
  // ── Runtime copies left behind by an earlier process (crash or kill) ──
  const outside = join(dataDir, "outside-the-copies");
  writeReadOnly(join(outside, "keep.txt"), "a link target outside the copies");
  const staleCopy = join(snapshotsRoot, "old-package-1.0.0-0f0e2a4b");
  writeReadOnly(join(staleCopy, "server.mjs"), "export function activate() {}");
  writeReadOnly(join(staleCopy, "client.js"), "export default 1;");
  writeReadOnly(join(staleCopy, "icons", "slot.png"), "png");
  symlinkSync(outside, join(staleCopy, "node_modules"), linkType);
  const lockedCopy = join(snapshotsRoot, "old-package-0.9.0-6c5d8e11");
  writeReadOnly(join(lockedCopy, "server.mjs"), "export function activate() {}");
  chmodSync(lockedCopy, 0o500);
  writeFileSync(join(snapshotsRoot, "stray.txt"), "left over");
  writeReadOnly(join(snapshotsRoot, "node_modules", "@anthropic-ai", "native-fixture", "index.js"), "shared link");
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    await assert.rejects(
      rm(lockedCopy, { recursive: true, force: true }),
      { code: /^(EACCES|EPERM|ENOTEMPTY)$/u },
      "negative control: a plain delete cannot remove a copy whose folder is read-only",
    );
  }

  // ── Kept versions ──
  const clientCurrent = clientOnly("prune-client", "1.0.2");
  clientOnly("prune-client", "1.0.0");
  clientOnly("prune-client", "1.0.1");
  clientOnly("prune-client", "1.0.3");
  writeFileSync(join(versionsRoot, "prune-client", "notes.txt"), "not a version folder");
  const restartCurrent = clientOnly("prune-restart", "2.0.0");
  clientOnly("prune-restart", "1.0.0");
  clientOnly("prune-restart", "0.9.0");
  const pendingCurrent = clientOnly("prune-pending", "1.1.0");
  clientOnly("prune-pending", "1.0.0");
  clientOnly("prune-pending", "0.5.0");
  clientOnly("not-registered", "1.0.0");
  clientOnly("not-registered", "0.1.0");
  const futureCurrent = clientOnly("future-package", "1.0.0");
  clientOnly("future-package", "0.1.0");
  const escapedVersions = join(packagesRoot, "escape");
  mkdirSync(join(escapedVersions, "0.1.0"), { recursive: true });
  const escapeManifest = clientOnly("escape", "1.0.0");
  const rollbackPrevious = writeVersion(
    "rollback-fixture",
    "1.0.0",
    {
      "server.mjs": `export async function activate({ api }) {
        return api.registerService("disk-cleanup:rollback", { version: "1.0.0" });
      }`,
    },
    { server: "server.mjs" },
  );
  const rollbackBroken = writeVersion(
    "rollback-fixture",
    "2.0.0",
    { "server.mjs": `export async function activate() { throw new Error("broken fixture update"); }` },
    { server: "server.mjs" },
  );
  writeVersion(
    "rollback-fixture",
    "0.8.0",
    { "server.mjs": "export function activate() {}" },
    { server: "server.mjs" },
  );
  mkdirSync(join(packagesRoot, ".install-prune-client-1792480000000"), { recursive: true });
  const decisions = JSON.stringify({ schemaVersion: 1, declined: { "prune-client": { version: "1.0.4" } } });
  writeFileSync(join(packagesRoot, "update-decisions-v1.json"), decisions);
  const packageData = join(dataDir, "long-term-memory", "config.json");
  mkdirSync(dirname(packageData), { recursive: true });
  writeFileSync(packageData, "package data");
  writeFileSync(
    join(packagesRoot, "installed.json"),
    JSON.stringify({
      schemaVersion: 1,
      packages: [
        record(clientCurrent, { previousVersion: "1.0.1" }),
        record(restartCurrent, { status: "restart-required", readiness: "pending", previousVersion: "1.0.0" }),
        record(pendingCurrent, { readiness: "pending", previousVersion: "1.0.0" }),
        record(escapeManifest, { id: "../escape" }),
        record(rollbackBroken, { previousVersion: "1.0.0", previousManifest: rollbackPrevious }),
        // Written by a newer Engine: this one cannot read it and must leave its folders alone.
        { ...record(futureCurrent), fieldFromANewerEngine: true },
      ],
    }),
  );
  const everyVersionBefore = Object.fromEntries(readdirSync(versionsRoot).map((id) => [id, versionsOf(id)]));

  // ── A second Engine on the same data folder stops at the writer lease and never reaches the sweep ──
  const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
  closeDatabase = closeDB;
  const db = await getDB();
  const serverRequire = createRequire(join(repositoryRoot, "packages", "server", "package.json"));
  const emptyEnv = join(dataDir, "empty.env");
  writeFileSync(emptyEnv, "");
  const child = spawn(
    process.execPath,
    [serverRequire.resolve("tsx/cli"), fileURLToPath(import.meta.url), SECOND_ENGINE_FLAG],
    {
      cwd: join(repositoryRoot, "packages", "server"),
      env: { ...process.env, NODE_ENV: "test", MARINARA_ENV_FILE: emptyEnv },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let childOutput = "";
  child.stdout.on("data", (chunk) => (childOutput += chunk));
  child.stderr.on("data", (chunk) => (childOutput += chunk));
  const exitCode = await new Promise<number | null>((resolve) => child.on("exit", resolve));
  const resultLine = childOutput.split("\n").find((line) => line.startsWith(SECOND_ENGINE_MARKER));
  assert.ok(resultLine, `the second Engine reported how its start ended (exit ${exitCode}):\n${childOutput}`);
  assert.deepEqual(
    JSON.parse(resultLine.slice(SECOND_ENGINE_MARKER.length)),
    { started: false, error: "StorageWriterLeaseError" },
    "a second Engine on a data folder in use stops at storage.open",
  );
  assert.deepEqual(
    snapshotEntries(),
    ["node_modules", "old-package-0.9.0-6c5d8e11", "old-package-1.0.0-0f0e2a4b", "stray.txt"],
    "the second Engine left the running Engine's runtime copies alone",
  );
  assert.deepEqual(
    Object.fromEntries(readdirSync(versionsRoot).map((id) => [id, versionsOf(id)])),
    everyVersionBefore,
    "the second Engine left every kept version alone",
  );

  // ── The lease holder's start: sweep, activation with rollback, then pruning ──
  const { capabilityModuleRuntime, sweepCapabilityRuntimeSnapshots } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");
  const { capabilityPackageManager } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const { getCapabilityService } =
    await import("../../packages/server/src/services/capability-packages/capability-service-registry.service.js");
  await capabilityModuleRuntime.start({ db } as unknown as Parameters<typeof capabilityModuleRuntime.start>[0]);

  const copiesAfterStart = snapshotEntries();
  assert.equal(copiesAfterStart[0], "node_modules", "the shared dependency links stay");
  assert.ok(
    existsSync(join(snapshotsRoot, "node_modules", "@anthropic-ai", "native-fixture", "index.js")),
    "nothing inside the shared node_modules is removed",
  );
  assert.equal(copiesAfterStart.length, 2, `only the live copy is left: ${copiesAfterStart.join(", ")}`);
  assert.match(copiesAfterStart[1]!, /^rollback-fixture-1\.0\.0-/u, "the live copy is the rolled-back version's");
  assert.equal(readFileSync(join(outside, "keep.txt"), "utf8"), "a link target outside the copies");
  assert.deepEqual(getCapabilityService("disk-cleanup:rollback"), { version: "1.0.0" });

  const registry = new Map((await capabilityPackageManager.installed()).map((item) => [item.id, item]));
  assert.equal(registry.get("rollback-fixture")?.version, "1.0.0", "the broken update rolled back");
  assert.equal(registry.get("rollback-fixture")?.readiness, "ready");
  assert.deepEqual(versionsOf("rollback-fixture"), ["1.0.0"], "the failed update and the older version are removed");
  assert.deepEqual(
    versionsOf("prune-client"),
    ["1.0.1", "1.0.2", "notes.txt"],
    "current and previous stay; an older and an abandoned newer version go; files are not version folders",
  );
  assert.deepEqual(versionsOf("prune-restart"), ["0.9.0", "1.0.0", "2.0.0"], "a restart-required package keeps all");
  assert.deepEqual(versionsOf("prune-pending"), ["0.5.0", "1.0.0", "1.1.0"], "a pending package keeps all");
  assert.deepEqual(versionsOf("not-registered"), ["0.1.0", "1.0.0"], "a folder with no registry record is kept");
  assert.deepEqual(versionsOf("future-package"), ["0.1.0", "1.0.0"], "an unreadable registry record is kept");
  assert.deepEqual(versionsOf("escape"), ["1.0.0"], "a record whose id is not its manifest id is skipped");
  assert.deepEqual(readdirSync(escapedVersions), ["0.1.0"], "nothing outside versions/ is reached through an id");
  assert.ok(existsSync(join(packagesRoot, ".install-prune-client-1792480000000")), "install folders are kept");
  assert.equal(readFileSync(join(packagesRoot, "update-decisions-v1.json"), "utf8"), decisions);
  assert.equal(readFileSync(packageData, "utf8"), "package data", "package data is never touched");

  // ── A hot activation copies everything but the browser bundle, then prunes that package ──
  const iconBytes = "icon bytes";
  const activated = writeVersion(
    "hot-fixture",
    "1.1.0",
    {
      "server.mjs": `import { existsSync, readFileSync } from "node:fs";
        export async function activate({ api }) {
          return api.registerService("disk-cleanup:hot", {
            icon: readFileSync(new URL("./icons/slot.png", import.meta.url), "utf8"),
            client: existsSync(new URL("./client.js", import.meta.url)),
          });
        }`,
      "client.js": "export default 1;",
      "icons/slot.png": iconBytes,
    },
    { server: "server.mjs", client: "client.js" },
  );
  const activatedPrevious = writeVersion(
    "hot-fixture",
    "1.0.0",
    { "server.mjs": "export function activate() {}" },
    { server: "server.mjs" },
  );
  writeVersion("hot-fixture", "0.9.0", { "server.mjs": "export function activate() {}" }, { server: "server.mjs" });
  const currentRegistry = JSON.parse(readFileSync(join(packagesRoot, "installed.json"), "utf8"));
  currentRegistry.packages.push(
    record(activated, { readiness: "pending", previousVersion: "1.0.0", previousManifest: activatedPrevious }),
  );
  writeFileSync(join(packagesRoot, "installed.json"), JSON.stringify(currentRegistry));
  assert.deepEqual(versionsOf("hot-fixture"), ["0.9.0", "1.0.0", "1.1.0"]);

  await capabilityModuleRuntime.activatePackage(
    {} as Parameters<typeof capabilityModuleRuntime.activatePackage>[0],
    "hot-fixture",
  );
  assert.deepEqual(
    getCapabilityService("disk-cleanup:hot"),
    { icon: iconBytes, client: false },
    "the package server reads its own assets from the copy, and the copy has no client.js",
  );
  const hotCopy = snapshotEntries().find((name) => name.startsWith("hot-fixture-1.1.0-"));
  assert.ok(hotCopy, "the hot activation made a runtime copy");
  assert.deepEqual(readdirSync(join(snapshotsRoot, hotCopy)).sort(), [
    "icons",
    "manifest.json",
    "node_modules",
    "server.mjs",
  ]);
  assert.deepEqual(versionsOf("hot-fixture"), ["1.0.0", "1.1.0"], "after activation only current and previous stay");

  // A copy is removed when its runtime stops, read-only files included.
  await capabilityModuleRuntime.deactivatePackage("hot-fixture");
  assert.equal(existsSync(join(snapshotsRoot, hotCopy)), false);
  await capabilityModuleRuntime.stop();
  assert.deepEqual(snapshotEntries(), ["node_modules"], "stopping removes every live copy");
  assert.deepEqual(await sweepCapabilityRuntimeSnapshots(join(dataDir, "missing")), { removed: 0, bytes: 0 });

  console.info("Capability package disk cleanup regressions passed.");
} finally {
  await closeDatabase?.();
  // A failed run can leave the read-only fixture folder behind.
  if (existsSync(join(snapshotsRoot, "old-package-0.9.0-6c5d8e11"))) {
    chmodSync(join(snapshotsRoot, "old-package-0.9.0-6c5d8e11"), 0o700);
  }
  rmSync(dataDir, { recursive: true, force: true });
}
