import { readdir, rm, stat } from "fs/promises";
import { join } from "path";

export const AUTOMATIC_BACKUP_FILENAME = "marinara-automatic-backup.zip";
export const AUTOMATIC_BACKUP_RETENTION_MIN = 1;
export const AUTOMATIC_BACKUP_RETENTION_MAX = 9_999;
export const DEFAULT_AUTOMATIC_BACKUP_RETENTION_COUNT = 1;

export type AutomaticBackupFile = {
  filename: string;
  path: string;
  modifiedAtMs: number;
};

export function parseAutomaticBackupRetentionCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= AUTOMATIC_BACKUP_RETENTION_MIN &&
    value <= AUTOMATIC_BACKUP_RETENTION_MAX
    ? value
    : null;
}

export function normalizeAutomaticBackupRetentionCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AUTOMATIC_BACKUP_RETENTION_COUNT;
  }
  return Math.min(
    AUTOMATIC_BACKUP_RETENTION_MAX,
    Math.max(AUTOMATIC_BACKUP_RETENTION_MIN, Math.trunc(value)),
  );
}

export function automaticBackupArchiveFilename(date: Date, uniqueSuffix = ""): string {
  const timestamp = date.toISOString().replace(/[:.]/gu, "-");
  const suffix = uniqueSuffix.trim().replace(/[^a-zA-Z0-9_-]/gu, "");
  return `marinara-automatic-backup-${timestamp}${suffix ? `-${suffix}` : ""}.zip`;
}

export function isAutomaticBackupFilename(filename: string): boolean {
  return (
    filename === AUTOMATIC_BACKUP_FILENAME ||
    (filename.startsWith("marinara-automatic-backup-") && filename.endsWith(".zip"))
  );
}

export async function listAutomaticBackupFiles(backupsRoot: string): Promise<AutomaticBackupFile[]> {
  let entries;
  try {
    entries = await readdir(backupsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") return [];
    throw error;
  }

  const files: AutomaticBackupFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isAutomaticBackupFilename(entry.name)) continue;
    const path = join(backupsRoot, entry.name);
    try {
      const fileStat = await stat(path);
      files.push({
        filename: entry.name,
        path,
        modifiedAtMs: fileStat.mtimeMs,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== "ENOENT") throw error;
    }
  }

  return files.sort(
    (left, right) => right.modifiedAtMs - left.modifiedAtMs || right.filename.localeCompare(left.filename),
  );
}

export async function automaticBackupExists(backupsRoot: string): Promise<boolean> {
  return (await listAutomaticBackupFiles(backupsRoot)).length > 0;
}

export async function pruneAutomaticBackupFiles(
  backupsRoot: string,
  retentionCount: number,
): Promise<string[]> {
  const keep = normalizeAutomaticBackupRetentionCount(retentionCount);
  const files = await listAutomaticBackupFiles(backupsRoot);
  const removed: string[] = [];
  for (const file of files.slice(keep)) {
    await rm(file.path, { force: true });
    removed.push(file.filename);
  }
  return removed;
}
