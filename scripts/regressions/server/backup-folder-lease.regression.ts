// POST /api/backup copies the data folders. It must leave out the live writer lease: its owner.json blocks
// startup when restored on another host (#6083), and on Docker/Termux its live socket made cp fail outright.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

// A Unix socket path must stay short (about 104 bytes on macOS), so storage lives under /tmp off Windows.
const storageRoot = await mkdtemp(join(process.platform === "win32" ? tmpdir() : "/tmp", "mbl-"));
const storageDir = join(storageRoot, "storage");
process.env.FILE_STORAGE_DIR = storageDir;
const app = Fastify();
const socketServer = createServer();
let closeDb: (() => Promise<void>) | undefined;
try {
  const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  app.decorate("db", await getDB());
  const { backupRoutes } = await import("../../../packages/server/src/routes/backup.routes.js");
  await app.register(backupRoutes, { prefix: "/api/backup" });
  await app.ready();

  const lease = join(storageDir, ".writer-lease");
  assert.ok(existsSync(join(lease, "owner.json")), "the running store holds its writer lease");
  await mkdir(join(storageDir, "tables", ".writer-lease"), { recursive: true });
  await writeFile(join(storageDir, "tables", ".writer-lease", "keep.json"), "{}");
  if (process.platform !== "win32") {
    // Docker and Termux keep a liveness socket here; Node's cp refuses to copy sockets.
    await new Promise<void>((resolve, reject) => {
      socketServer.once("error", reject);
      socketServer.listen(join(lease, "live.sock"), resolve);
    });
  }

  const response = await app.inject({ method: "POST", url: "/api/backup" });
  assert.equal(response.statusCode, 200, response.body);
  const backupDir = join(process.env.DATA_DIR!, "backups", response.json().backupName);
  assert.ok(existsSync(join(backupDir, "storage")), "storage is still copied");
  assert.equal(existsSync(join(backupDir, "storage", ".writer-lease")), false, "the writer lease is left out");
  assert.ok(
    existsSync(join(backupDir, "storage", "tables", ".writer-lease", "keep.json")),
    "only the top-level lease is skipped",
  );
  console.info("Backup folder writer-lease regression passed");
} finally {
  if (socketServer.listening) await new Promise((resolve) => socketServer.close(resolve));
  await app.close();
  await closeDb?.();
  await rm(storageRoot, { recursive: true, force: true });
}
