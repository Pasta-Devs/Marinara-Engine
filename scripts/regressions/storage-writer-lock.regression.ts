import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDB, getDB } from "../../packages/server/src/db/connection.js";
import {
  createFileNativeDB,
  STORAGE_WRITER_LIVENESS_FILENAME,
  STORAGE_WRITER_LEASE_FILENAME,
  STORAGE_WRITER_OWNER_FILENAME,
  StorageWriterLeaseError,
} from "../../packages/server/src/db/file-backed-store.js";
import { appSettings, lorebookEntries, lorebooks } from "../../packages/server/src/db/schema/index.js";
import { getMariDbService } from "../../packages/server/src/services/mari-db/mari-db.service.js";
import { resolvePnpmRunner } from "../pnpm-runner.mjs";

type LeaseRecord = {
  version: 1 | 2 | 3;
  pid: number;
  hostId: string | null;
  scopeId?: string;
  hostname: string;
  token: string;
  acquiredAt: string;
};

const previousStorageDir = process.env.FILE_STORAGE_DIR;
const tempDirs: string[] = [];
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function useTempStorage(label: string) {
  const dir = mkdtempSync(join(tmpdir(), `marinara-${label}-`));
  tempDirs.push(dir);
  process.env.FILE_STORAGE_DIR = dir;
  return dir;
}

function leasePath(dir: string) {
  return join(dir, STORAGE_WRITER_LEASE_FILENAME);
}

function ownerPath(dir: string) {
  return join(leasePath(dir), STORAGE_WRITER_OWNER_FILENAME);
}

function livenessPath(dir: string) {
  return join(leasePath(dir), STORAGE_WRITER_LIVENESS_FILENAME);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function exitedPid() {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  assert.ok(child.pid);
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
  return child.pid!;
}

async function leaveStaleSocket(path: string) {
  const child = spawn(
    process.execPath,
    [
      "-e",
      'const net = require("node:net"); const server = net.createServer(); server.listen(process.argv[1], () => process.stdout.write("ready\\n"));',
      path,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  await new Promise<void>((resolveReady, rejectReady) => {
    child.once("error", rejectReady);
    child.once("exit", (code, signal) => {
      rejectReady(new Error(`Stale-socket helper exited before listening (code=${code}, signal=${signal})`));
    });
    child.stdout!.once("data", () => resolveReady());
  });
  child.kill("SIGKILL");
  await waitForExit(child);
}

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs = 15_000) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Development watcher ${child.pid ?? "unknown"} did not exit`)),
      timeoutMs,
    );
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

function forceStopProcessTree(child: ReturnType<typeof spawn>) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
  }
}

try {
  // The ordinary lorebook path remains durable, while a second live writer
  // for the exact same root fails before loading or mutating any data.
  {
    const dir = useTempStorage("writer-lock");
    const containerLeaseHooks = { writerLeaseScopeId: "writer-lock-container-host" };
    const db = await createFileNativeDB(containerLeaseHooks);
    const leaseTemplate = readJson<LeaseRecord>(ownerPath(dir));
    const socketPathIsSupported = process.platform !== "win32" && Buffer.byteLength(livenessPath(dir)) <= 100;
    assert.equal(
      leaseTemplate.version,
      socketPathIsSupported ? 3 : 2,
      "new leases use an owner socket only when the platform, host identity, and path support it",
    );
    assert.equal(existsSync(livenessPath(dir)), leaseTemplate.version === 3);
    if (leaseTemplate.version === 3) {
      writeFileSync(ownerPath(dir), JSON.stringify({ ...leaseTemplate, hostname: "another-container" }, null, 2));
    }
    await assert.rejects(
      createFileNativeDB(containerLeaseHooks),
      (error: unknown) =>
        error instanceof StorageWriterLeaseError &&
        error.message.includes(String(process.pid)) &&
        error.message.includes(dir),
      "a second live writer is rejected with owner and data-directory details",
    );
    if (leaseTemplate.version === 3) {
      writeFileSync(ownerPath(dir), JSON.stringify(leaseTemplate, null, 2));
    }

    const pnpmRunner = resolvePnpmRunner();
    const watcher = spawn(
      pnpmRunner.command,
      [...pnpmRunner.args, "--filter", "@marinara-engine/server", "dev"],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          FILE_STORAGE_DIR: dir,
          MARINARA_ENV_FILE: join(dir, ".watcher.env"),
          NODE_ENV: "production",
          PORT: String(20_000 + (process.pid % 10_000)),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      },
    );
    let watcherOutput = "";
    watcher.stdout?.on("data", (chunk) => {
      watcherOutput += chunk.toString();
    });
    watcher.stderr?.on("data", (chunk) => {
      watcherOutput += chunk.toString();
    });
    try {
      await waitForExit(watcher);
      assert.match(watcherOutput, /--marinara-dev-watch/u, "the competing process must use the guarded dev watcher");
      assert.match(watcherOutput, /StorageWriterLeaseError/u, "the watcher must exit because it lost the writer lease");
      assert.equal(existsSync(leasePath(dir)), true, "the healthy writer keeps its lease after rejecting the watcher");
      assert.equal(readJson<LeaseRecord>(ownerPath(dir)).pid, process.pid, "the healthy writer remains the lease owner");
    } finally {
      forceStopProcessTree(watcher);
    }

    const timestamp = "2026-08-14T00:00:00.000Z";
    await db
      .insert(lorebooks)
      .values({ id: "durable-book", name: "Durable Book", createdAt: timestamp, updatedAt: timestamp });
    await db.insert(lorebookEntries).values({
      id: "durable-entry",
      lorebookId: "durable-book",
      name: "Durable Entry",
      content: "Must survive",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await db._fileStore.flush();
    await db._fileStore.close();
    assert.equal(existsSync(leasePath(dir)), false, "a clean close removes its verified lease");

    const externallyReleased = await createFileNativeDB(containerLeaseHooks);
    rmSync(leasePath(dir), { recursive: true });
    await externallyReleased._fileStore.close();

    if (leaseTemplate.version === 3) {
      mkdirSync(leasePath(dir));
      await leaveStaleSocket(livenessPath(dir));
      writeFileSync(
        ownerPath(dir),
        JSON.stringify({
          ...leaseTemplate,
          version: 3,
          pid: process.pid,
          scopeId: "another-host-scope",
          hostname: "replaced-container",
          token: "stale-container-token",
          acquiredAt: "2026-08-13T00:00:00.000Z",
        }),
      );
      await assert.rejects(
        createFileNativeDB(containerLeaseHooks),
        StorageWriterLeaseError,
        "a stale-looking socket from another host scope remains locked",
      );
      writeFileSync(
        ownerPath(dir),
        JSON.stringify({
          ...leaseTemplate,
          version: 3,
          pid: process.pid,
          hostname: "replaced-container",
          token: "stale-container-token",
          acquiredAt: "2026-08-13T00:00:00.000Z",
        }),
      );
      const afterContainerReplacement = await createFileNativeDB(containerLeaseHooks);
      assert.notEqual(readJson<LeaseRecord>(ownerPath(dir)).token, "stale-container-token");
      await afterContainerReplacement._fileStore.close();

      mkdirSync(leasePath(dir));
      writeFileSync(
        ownerPath(dir),
        JSON.stringify({
          ...leaseTemplate,
          hostname: "missing-owner-socket",
          token: "missing-owner-socket-token",
        }),
      );
      await assert.rejects(
        createFileNativeDB(containerLeaseHooks),
        StorageWriterLeaseError,
        "a missing owner socket remains locked because it does not prove the previous writer exited",
      );
      rmSync(leasePath(dir), { recursive: true });
    }

    // A same-host stale lock is reclaimed only after its PID is definitely
    // absent. Restricted hosts without a stable host ID deliberately require
    // manual stale-lock removal instead.
    if (leaseTemplate.hostId) {
      mkdirSync(leasePath(dir));
      writeFileSync(
        ownerPath(dir),
        JSON.stringify({
          ...leaseTemplate,
          version: 2,
          pid: await exitedPid(),
          token: "stale-owner-token",
          acquiredAt: "2026-08-13T00:00:00.000Z",
        }),
      );
      const afterCrash = await createFileNativeDB();
      assert.notEqual(readJson<LeaseRecord>(ownerPath(dir)).token, "stale-owner-token");
      await afterCrash._fileStore.close();
    }

    if (process.platform !== "win32") {
      // Legacy macOS leases fingerprinted every visible network interface.
      // A changed VPN/virtual-interface set must not strand a dead same-host
      // lease, while v2 leases still require the stable machine identity.
      const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
      try {
        Object.defineProperty(process, "platform", { ...platformDescriptor, value: "darwin" });
        mkdirSync(leasePath(dir));
        writeFileSync(
          ownerPath(dir),
          JSON.stringify({
            ...leaseTemplate,
            version: 1,
            pid: process.pid,
            hostId: "legacy-fingerprint-before-network-change",
            token: "legacy-macos-live-token",
          }),
        );
        await assert.rejects(createFileNativeDB(), StorageWriterLeaseError);
        rmSync(leasePath(dir), { recursive: true });

        mkdirSync(leasePath(dir));
        writeFileSync(
          ownerPath(dir),
          JSON.stringify({
            ...leaseTemplate,
            version: 1,
            pid: await exitedPid(),
            hostId: "legacy-fingerprint-before-network-change",
            token: "legacy-macos-stale-token",
          }),
        );
        const afterNetworkChange = await createFileNativeDB();
        assert.notEqual(readJson<LeaseRecord>(ownerPath(dir)).token, "legacy-macos-stale-token");
        await afterNetworkChange._fileStore.close();

        mkdirSync(leasePath(dir));
        writeFileSync(
          ownerPath(dir),
          JSON.stringify({
            ...leaseTemplate,
            version: 2,
            pid: await exitedPid(),
            hostId: "stable-id-from-another-machine",
            token: "foreign-v2-token",
          }),
        );
        await assert.rejects(createFileNativeDB(), StorageWriterLeaseError);
        rmSync(leasePath(dir), { recursive: true });
      } finally {
        Object.defineProperty(process, "platform", platformDescriptor);
      }
    }

    // Windows cannot faithfully simulate Android's POSIX permission semantics;
    // retain this Termux-specific proof on real POSIX-capable hosts.
    if (process.platform !== "win32") {
      // Termux has no stable machine ID on some Android devices. Its HOME is
      // app-private, so an exited lease there is safe to reclaim after reboot;
      // the same fallback must not apply to storage outside that HOME.
      const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
      const previousHome = process.env.HOME;
      const termuxHome = mkdtempSync(join(tmpdir(), "marinara-termux-home-"));
      tempDirs.push(termuxHome);
      const termuxStorage = join(termuxHome, "Marinara-Engine", "packages", "server", "data", "storage");
      process.env.FILE_STORAGE_DIR = termuxStorage;
      mkdirSync(leasePath(termuxStorage), { recursive: true });
      writeFileSync(
        ownerPath(termuxStorage),
        JSON.stringify({
          ...leaseTemplate,
          version: 2,
          pid: await exitedPid(),
          hostId: null,
          token: "stale-termux-token",
        }),
      );
      let termuxDb: Awaited<ReturnType<typeof createFileNativeDB>> | undefined;
      try {
        Object.defineProperty(process, "platform", { ...platformDescriptor, value: "android" });
        process.env.HOME = termuxHome;
        termuxDb = await createFileNativeDB();
        assert.notEqual(readJson<LeaseRecord>(ownerPath(termuxStorage)).token, "stale-termux-token");
        await termuxDb._fileStore.close();
        termuxDb = undefined;

        const outsideHome = useTempStorage("termux-outside-home");
        mkdirSync(leasePath(outsideHome));
        writeFileSync(
          ownerPath(outsideHome),
          JSON.stringify({
            ...leaseTemplate,
            version: 2,
            pid: await exitedPid(),
            hostId: null,
            token: "outside-termux-home-token",
          }),
        );
        const linkedOutsideHome = join(termuxHome, "shared-storage");
        symlinkSync(outsideHome, linkedOutsideHome, "dir");
        process.env.FILE_STORAGE_DIR = linkedOutsideHome;
        await assert.rejects(createFileNativeDB(), StorageWriterLeaseError);
      } finally {
        if (termuxDb) await termuxDb._fileStore.close();
        Object.defineProperty(process, "platform", platformDescriptor);
        if (previousHome === undefined) delete process.env.HOME;
        else process.env.HOME = previousHome;
      }
    } else {
      process.stdout.write("Skipping Termux-specific writer-lock proof on Windows.\n");
    }
    process.env.FILE_STORAGE_DIR = dir;

    // Counts are diagnostics only: a stale value cannot hide a valid row and
    // startup heals it from the rows actually loaded from disk.
    const manifestPath = join(dir, "manifest.json");
    const staleManifest = readJson<{ tables: Record<string, number> }>(manifestPath);
    staleManifest.tables.lorebook_entries = 0;
    writeFileSync(manifestPath, JSON.stringify(staleManifest, null, 2));
    const reopened = await createFileNativeDB();
    try {
      const entries = await reopened.select().from(lorebookEntries);
      assert.deepEqual(
        entries.map((entry) => entry.id),
        ["durable-entry"],
      );
      assert.equal(
        readJson<{ tables: Record<string, number> }>(manifestPath).tables.lorebook_entries,
        1,
        "startup repairs the stale diagnostic count",
      );
    } finally {
      await reopened._fileStore.close();
    }
  }

  // Closing rejects new writes, waits for a transaction that already started,
  // and lets that transaction finish while the lease is still held.
  {
    useTempStorage("writer-close-transaction");
    const db = await createFileNativeDB();
    let finishTransaction!: () => void;
    let transactionStarted!: () => void;
    const finishGate = new Promise<void>((resolve) => {
      finishTransaction = resolve;
    });
    const startedGate = new Promise<void>((resolve) => {
      transactionStarted = resolve;
    });
    const transaction = db.transaction(async (tx) => {
      await tx.insert(appSettings).values({ key: "tx-before-close", value: "one", updatedAt: "2026-08-14" });
      transactionStarted();
      await finishGate;
      await tx.insert(appSettings).values({ key: "tx-after-close", value: "two", updatedAt: "2026-08-14" });
    });
    await startedGate;
    const closing = db._fileStore.close();
    await assert.rejects(
      db.insert(appSettings).values({ key: "new-after-close", value: "blocked", updatedAt: "2026-08-14" }),
      /closing or closed/,
    );
    finishTransaction();
    await transaction;
    await closing;
    const reopened = await createFileNativeDB();
    assert.deepEqual((await reopened.select().from(appSettings)).map((row) => row.key).sort(), [
      "tx-after-close",
      "tx-before-close",
    ]);
    await reopened._fileStore.close();
  }

  // A shutdown write failure still removes the process-owned lease so the
  // next clean start is not blocked by a store that has already detached.
  {
    const dir = useTempStorage("writer-close-failure");
    let failWrites = false;
    const db = await createFileNativeDB({
      beforeTableWrite: () => {
        if (failWrites) throw new Error("forced shutdown write failure");
      },
    });
    await db.insert(appSettings).values({ key: "local", value: "two", updatedAt: "2026-08-14" });
    failWrites = true;
    await assert.rejects(db._fileStore.close(), /forced shutdown write failure/);
    assert.equal(existsSync(leasePath(dir)), false, "a failed close still releases its writer lease");
    await assert.rejects(
      db.insert(appSettings).values({ key: "after-close", value: "blocked", updatedAt: "2026-08-14" }),
      /closing or closed/,
    );
    await assert.rejects(db._fileStore.flush(), /closing or closed/);
    const reopened = await createFileNativeDB();
    await reopened._fileStore.close();
  }

  // The Professor Mari service follows the current DB identity after a clean
  // close/reopen instead of retaining a service bound to the closed store.
  {
    useTempStorage("mari-db-rebind");
    const firstDb = await getDB();
    const firstService = getMariDbService(firstDb);
    assert.strictEqual(getMariDbService(firstDb), firstService, "the same DB keeps one Mari service");
    await closeDB();
    const secondDb = await getDB();
    const secondService = getMariDbService(secondDb);
    assert.notStrictEqual(secondService, firstService, "Mari rebinds to the reopened DB");
    await closeDB();
  }

  console.info("Storage writer-lock regressions passed.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
}
