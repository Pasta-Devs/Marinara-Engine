// ──────────────────────────────────────────────
// Runtime diagnostics snapshot (admin, read-only)
// ──────────────────────────────────────────────
// The privileged companion to the public /api/health reply. /api/health already
// serves the version and build, the memory snapshot, each package's registry
// status and the sidecars, so none of that is repeated here. This adds only
// what health does not carry: process uptime, storage residency detail and
// whether each capability package runtime is actually live (and its last
// activation failure in this process), memory peaks, the startup build check
// and the worker gauges.
// Counts and states only: no row content, no settings values, no connection
// details. Every section is collected on its own, so one failing source
// degrades to { error } instead of failing the whole snapshot.
import { getFileStoreStats } from "../db/connection.js";
import { capabilityModuleRuntime } from "../services/capability-packages/capability-module-runtime.service.js";
import { capabilityPackageManager } from "../services/capability-packages/package-manager.service.js";
import { getRuntimeMemoryPeaks } from "../utils/runtime-memory.js";
import { getLastBuildIntegrity } from "./build-integrity.js";
import { sampleWorkerGauges } from "./worker-gauges.js";

const MAX_ERROR_TEXT = 500;

/** Single line, bounded length: error text is shown to an admin, not a log parser. */
function boundedText(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > MAX_ERROR_TEXT ? `${line.slice(0, MAX_ERROR_TEXT - 3)}...` : line;
}

async function section<T>(collect: () => T | Promise<T>): Promise<T | { error: string }> {
  try {
    return await collect();
  } catch (error) {
    return { error: boundedText(error instanceof Error ? error.message : String(error)) };
  }
}

/** Process facts /api/health leaves out. */
export function collectProcessDiagnostics() {
  return {
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    uptimeSeconds: Math.round(process.uptime()),
    // The current memory snapshot is in /api/health; only the peaks are here.
    memoryPeaks: getRuntimeMemoryPeaks(),
    // The startup check of dist against its sources (null before it ran).
    buildIntegrity: getLastBuildIntegrity(),
  };
}

/** Which tables are dirty or fully resident, the last flush failure and the quarantine count. */
export function collectStorageDiagnostics() {
  const stats = getFileStoreStats();
  if (!stats) return { open: false as const };
  let residentRows = 0;
  let lazyTables = 0;
  for (const table of Object.values(stats.tables)) {
    residentRows += table.rows;
    if (table.lazy) lazyTables += 1;
  }
  return {
    open: true as const,
    // Lazy tables only count the rows loaded into memory, not every row on disk.
    residentRows,
    tableCount: Object.keys(stats.tables).length,
    lazyTables,
    residentChatUnits: stats.residentChatUnits,
    fullyResidentLazyTables: Object.entries(stats.tables)
      .filter(([, table]) => table.lazy && table.fullyResident)
      .map(([name]) => name)
      .sort(),
    dirtyTables: stats.dirtyTables,
    lastFlushError: stats.lastFlushError ? boundedText(stats.lastFlushError) : null,
    quarantinedTables: stats.quarantinedTables,
  };
}

export type CapabilityPackageRuntimeState = "active" | "failed" | "restart-required" | "pending";

type PackageStateInput = {
  status: string;
  readiness?: string;
  hasServer: boolean;
  live: boolean | null;
  activationFailed: boolean;
};

/**
 * Registry status alone is not enough: a package whose server runtime is not
 * running can still read "active" in the registry. A server package that is
 * not live is "failed" when this process recorded an activation failure for
 * it, and "pending" otherwise (for example part-way through its activation).
 */
export function derivePackageRuntimeState(input: PackageStateInput): CapabilityPackageRuntimeState {
  if (input.status === "restart-required") return "restart-required";
  if (input.status === "error" || input.readiness === "error") return "failed";
  if (!input.hasServer || input.live) return "active";
  return input.activationFailed ? "failed" : "pending";
}

export async function collectCapabilityPackageDiagnostics() {
  const installed = await capabilityPackageManager.installed();
  const runtime = capabilityModuleRuntime.runtimeState();
  const live = new Set(runtime.live);
  const packages = installed.map((item) => {
    const hasServer = Boolean(item.manifest.entrypoints?.server);
    const activationError = runtime.activationErrors[item.id];
    const isLive = hasServer ? live.has(item.id) : null;
    const state = derivePackageRuntimeState({
      status: item.status,
      readiness: item.readiness,
      hasServer,
      live: isLive,
      activationFailed: Boolean(activationError),
    });
    const rawError =
      item.error || item.readinessError || (state === "failed" ? activationError?.message : null) || null;
    return {
      id: item.id,
      version: item.version,
      status: item.status,
      readiness: item.readiness,
      hasServer,
      live: isLive,
      state,
      error: rawError ? boundedText(rawError) : null,
      lastActivationFailureAt: activationError?.at ?? null,
    };
  });
  const counts: Record<CapabilityPackageRuntimeState, number> = {
    active: 0,
    failed: 0,
    "restart-required": 0,
    pending: 0,
  };
  for (const item of packages) counts[item.state] += 1;
  return { counts, packages };
}

export async function collectRuntimeDiagnostics() {
  const [processInfo, storage, capabilityPackages, workers] = await Promise.all([
    section(collectProcessDiagnostics),
    section(collectStorageDiagnostics),
    section(collectCapabilityPackageDiagnostics),
    // The same samples runtime.memory and runtime.freeze lines carry.
    section(sampleWorkerGauges),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    process: processInfo,
    storage,
    capabilityPackages,
    workers,
  };
}
