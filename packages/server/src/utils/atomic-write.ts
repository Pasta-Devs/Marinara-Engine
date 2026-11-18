import { randomBytes } from "node:crypto";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

type AtomicWriteOptions = { mode?: number };

// A hidden, unique name beside the target ("wx" refuses a clash): same filesystem
// for the rename, and listings that skip dotfiles or `.tmp` never show a half-written file.
function tempPathFor(path: string): string {
  return join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
}

/**
 * Write a whole file so readers see the old or the new content, never half of it.
 * The parent directory must exist. No fsync: use file-backed-store for data that
 * must survive power loss.
 */
export async function writeFileAtomic(
  path: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const temp = tempPathFor(path);
  try {
    await writeFile(temp, data, { flag: "wx", mode: options.mode });
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function writeFileAtomicSync(path: string, data: string | Uint8Array, options: AtomicWriteOptions = {}): void {
  const temp = tempPathFor(path);
  try {
    writeFileSync(temp, data, { flag: "wx", mode: options.mode });
    renameSync(temp, path);
  } catch (error) {
    try {
      rmSync(temp, { force: true });
    } catch {
      /* best-effort cleanup */
    }
    throw error;
  }
}
