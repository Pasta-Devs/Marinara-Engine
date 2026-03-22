// ──────────────────────────────────────────────
// Routes: Backup
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { DATA_DIR } from "../utils/data-dir.js";
import { join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import { cp, mkdir, copyFile } from "fs/promises";

/** Directories inside DATA_DIR that should be included in every backup. */
const BACKUP_DIRS = ["avatars", "sprites", "backgrounds", "gallery", "fonts", "knowledge-sources"];

/** The primary database filename. */
const DB_FILENAME = "marinara-engine.db";

export async function backupRoutes(app: FastifyInstance) {
  // Create a full backup folder
  app.post("/", async (_req, reply) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const backupName = `marinara-backup-${timestamp}`;
    const backupsRoot = join(DATA_DIR, "backups");
    const backupDir = join(backupsRoot, backupName);

    await mkdir(backupDir, { recursive: true });

    // 1. Copy the database file
    const dbSrc = join(DATA_DIR, DB_FILENAME);
    if (existsSync(dbSrc)) {
      await copyFile(dbSrc, join(backupDir, DB_FILENAME));
      // Also copy WAL/SHM if they exist (for a complete backup)
      for (const ext of ["-wal", "-shm"]) {
        const walSrc = dbSrc + ext;
        if (existsSync(walSrc)) {
          await copyFile(walSrc, join(backupDir, DB_FILENAME + ext));
        }
      }
    }

    // 2. Copy data directories
    for (const dirName of BACKUP_DIRS) {
      const src = join(DATA_DIR, dirName);
      if (existsSync(src)) {
        await cp(src, join(backupDir, dirName), { recursive: true });
      }
    }

    return reply.send({
      success: true,
      backupName,
    });
  });

  // List existing backups
  app.get("/", async () => {
    const backupsRoot = join(DATA_DIR, "backups");
    if (!existsSync(backupsRoot)) return [];

    return readdirSync(backupsRoot)
      .filter((name) => {
        const p = join(backupsRoot, name);
        return statSync(p).isDirectory() && name.startsWith("marinara-backup-");
      })
      .map((name) => {
        const p = join(backupsRoot, name);
        const st = statSync(p);
        return { name, createdAt: st.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  // Delete a backup
  app.delete<{ Params: { name: string } }>("/:name", async (req, reply) => {
    const { name } = req.params;
    // Sanitize: only allow backup folder names
    if (!/^marinara-backup-[\w-]+$/.test(name)) {
      return reply.status(400).send({ error: "Invalid backup name" });
    }
    const backupsRoot = join(DATA_DIR, "backups");
    const backupDir = join(backupsRoot, name);

    if (!existsSync(backupDir)) {
      return reply.status(404).send({ error: "Backup not found" });
    }

    // Remove recursively
    const { rm } = await import("fs/promises");
    await rm(backupDir, { recursive: true, force: true });

    return { success: true };
  });
}
