import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Keep identity outside synced campaign storage, stable across registry failures. */
export function persistentWriterHostId(cachePath: string, readMachineId: () => string | null): string | null {
  const readCached = () => {
    const value = readFileSync(cachePath, "utf8").trim();
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  };
  try {
    return readCached();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
  }
  const machineId = readMachineId();
  const identity = createHash("sha256")
    .update(machineId ? `marinara-writer-lease-v2\nwin32\n${machineId.toLowerCase()}` : randomUUID())
    .digest("hex");
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    // Never replace another launch's identity or a corrupt/unreadable cache.
    writeFileSync(cachePath, identity, { flag: "wx", mode: 0o600 });
    return identity;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      try {
        return readCached();
      } catch {
        return null;
      }
    }
    return null;
  }
}
