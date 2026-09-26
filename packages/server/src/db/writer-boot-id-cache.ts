// ──────────────────────────────────────────────
// Writer lease: per-boot cache of the OS boot id
// ──────────────────────────────────────────────
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { logger } from "../lib/logger.js";

/**
 * How far two "now minus uptime" estimates of the same boot may drift apart
 * (clock adjustments, sleep, rounding) and still count as the same boot.
 */
export const BOOT_ID_CACHE_TOLERANCE_MS = 10_000;

type BootIdCacheRecord = { version: 1; approxBootMs: number; bootId: string };

function readBootIdCache(cachePath: string): BootIdCacheRecord | null {
  try {
    const value = JSON.parse(readFileSync(cachePath, "utf8")) as Partial<BootIdCacheRecord> | null;
    if (
      value &&
      value.version === 1 &&
      typeof value.approxBootMs === "number" &&
      Number.isFinite(value.approxBootMs) &&
      typeof value.bootId === "string" &&
      value.bootId.length > 0 &&
      value.bootId.length <= 256
    ) {
      return value as BootIdCacheRecord;
    }
  } catch (err) {
    // Missing is the normal first start of a boot. Anything else is a
    // non-fatal failure: probe again, and say so.
    if ((err as NodeJS.ErrnoException | null)?.code !== "ENOENT") {
      logger.warn(err, "[file-storage] Boot id cache unreadable at %s; probing instead", cachePath);
    }
  }
  return null;
}

/**
 * Boot identity for the writer lease without paying the slow probe on every
 * start. On Windows the exact value comes from a PowerShell CIM query that
 * takes about 1.5 to 2 seconds (and returns null when it hits its 2 second
 * timeout), run synchronously while the server module loads. The probe's
 * exact string is cached together with a cheap boot-time estimate
 * (now minus OS uptime); a later start whose estimate lands within
 * `toleranceMs` reuses the cached string, which is byte-identical to what the
 * probe would print for this boot, so leases stay comparable with builds that
 * still probe. Any mismatch, corrupt cache or write failure falls back to the
 * probe, and a null probe result is never cached. Opt-in through
 * STORAGE_CACHE_WINDOWS_BOOT_ID; the cache file lives in DATA_DIR
 * (getWindowsBootIdCachePath), never in a per-user application folder.
 */
export function cachedBootId(
  cachePath: string,
  approxBootMs: number,
  probe: () => string | null,
  toleranceMs = BOOT_ID_CACHE_TOLERANCE_MS,
): string | null {
  if (Number.isFinite(approxBootMs)) {
    const cached = readBootIdCache(cachePath);
    if (cached && Math.abs(cached.approxBootMs - approxBootMs) <= toleranceMs) return cached.bootId;
  }
  const bootId = probe();
  if (!bootId || !Number.isFinite(approxBootMs)) return bootId;
  const tmpPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    const record: BootIdCacheRecord = { version: 1, approxBootMs, bootId };
    writeFileSync(tmpPath, JSON.stringify(record), { mode: 0o600 });
    renameSync(tmpPath, cachePath);
  } catch (err) {
    // Caching is an optimisation only; the probe result is still correct.
    logger.warn(err, "[file-storage] Could not cache the boot id at %s", cachePath);
    try {
      rmSync(tmpPath, { force: true });
    } catch (cleanupErr) {
      logger.warn(cleanupErr, "[file-storage] Could not remove boot id cache temp file %s", tmpPath);
    }
  }
  return bootId;
}
