/**
 * One place that looks after every model Marinara runs on this machine.
 *
 * Each built-in model keeps its own process and its own start and stop code: the chat
 * model (main sidecar), the utility model, the embedding model and the decision model.
 * What they did not have was anything looking across them. This adds two things:
 *
 * 1. Unload when unused. One setting for all of them, like Ollama's keep-alive: a model
 *    nobody has asked anything for that long stops and frees its memory, and starts
 *    again on its next request. Every slot already starts on demand, so nothing else
 *    changes for the caller.
 *
 * 2. A memory check before a model loads. The model's expected size is weighed against
 *    what the machine has free (graphics memory on NVIDIA, unified memory on Apple
 *    silicon, system memory for anything on the CPU). When it does not fit, other
 *    built-in models that are not working on anything are unloaded, least recently used
 *    first. When it still does not fit, the model starts anyway (estimates can be wrong,
 *    and llama.cpp falls back to the CPU) and the slot carries a warning the page shows.
 *
 * Slots register a small handle; nothing here imports a slot's service, so a slot's
 * file can depend on this one without a cycle.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  LOCAL_MODEL_IDLE_UNLOAD_CHOICES,
  LOCAL_MODEL_DEFAULT_SETTINGS,
  type LocalModelMemoryReading,
  type LocalModelSettings,
  type LocalModelSlotId,
  type LocalModelSlotStatus,
  type LocalModelsStatus,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { awaitGpuProbe, getGpuProbe, resolveSharedDevice } from "./sidecar-footprint.js";

const execFileAsync = promisify(execFile);
const SETTINGS_DIR = join(getDataDir(), "models");
const SETTINGS_PATH = join(SETTINGS_DIR, "local-models.json");

/** Left free beside a model: the OS, the browser and Marinara itself need room too. */
const RAM_HEADROOM_BYTES = 1_500_000_000;
const GPU_HEADROOM_BYTES = 500_000_000;
/** Metal may use about this share of unified memory for a model by default. */
const APPLE_GPU_SHARE = 0.75;

/** Where a model's weights live, which decides which memory it is weighed against. */
export type LocalModelPlacement = "gpu" | "cpu" | "unknown";

export interface LocalModelSlotHandle {
  id: LocalModelSlotId;
  label: () => string;
  /** The process is up (or starting) and holding memory. */
  isLoaded: () => boolean;
  /** Bytes the loaded model holds (measured when possible), or what it is expected to want. */
  footprintBytes: () => number | null;
  placement: () => LocalModelPlacement;
  /** Stop the process. The next request starts it again. */
  unload: (reason: "idle" | "memory") => Promise<void>;
}

type SlotState = {
  handle: LocalModelSlotHandle;
  active: number;
  lastUsedAt: number | null;
  idleTimer: NodeJS.Timeout | null;
  unloadedForIdleAt: number | null;
  unloadedForMemoryAt: number | null;
  memoryWarning: string | null;
};

function formatGb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

function readSettings(): LocalModelSettings {
  try {
    if (!existsSync(SETTINGS_PATH)) return { ...LOCAL_MODEL_DEFAULT_SETTINGS };
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as Partial<LocalModelSettings>;
    return normalizeSettings(raw);
  } catch (error) {
    logger.warn(error, "[local-models] Unreadable settings; using defaults");
    return { ...LOCAL_MODEL_DEFAULT_SETTINGS };
  }
}

export function normalizeSettings(raw: Partial<LocalModelSettings>): LocalModelSettings {
  const minutes = raw.idleUnloadMinutes;
  return {
    idleUnloadMinutes:
      typeof minutes === "number" && (LOCAL_MODEL_IDLE_UNLOAD_CHOICES as readonly number[]).includes(minutes)
        ? minutes
        : LOCAL_MODEL_DEFAULT_SETTINGS.idleUnloadMinutes,
  };
}

// ── memory readings ───────────────────────────────────────────────────────────

/** Linux: MemAvailable counts reclaimable cache, which `os.freemem()` may not on older libuv. */
function linuxAvailableBytes(): number | null {
  try {
    const match = /MemAvailable:\s+(\d+)\s+kB/u.exec(readFileSync("/proc/meminfo", "utf8"));
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

/**
 * macOS: `os.freemem()` is only the truly free pages, a small figure on a healthy Mac.
 * Inactive, purgeable and speculative pages are handed out on demand, so they count.
 */
export function parseVmStat(output: string): number | null {
  const pageSize = Number(/page size of (\d+) bytes/u.exec(output)?.[1] ?? 0);
  if (!pageSize) return null;
  const pages = (name: string) => Number(new RegExp(`${name}:\\s+(\\d+)`, "u").exec(output)?.[1] ?? 0);
  return (
    (pages("Pages free") + pages("Pages inactive") + pages("Pages purgeable") + pages("Pages speculative")) * pageSize
  );
}

async function macAvailableBytes(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("vm_stat", [], { timeout: 3000 });
    return parseVmStat(stdout);
  } catch {
    return null;
  }
}

async function systemAvailableBytes(): Promise<number> {
  if (process.platform === "linux" || process.platform === "android") return linuxAvailableBytes() ?? freemem();
  if (process.platform === "darwin") return (await macAvailableBytes()) ?? freemem();
  return freemem();
}

export function isAppleSilicon(): boolean {
  return process.platform === "darwin" && process.arch === "arm64";
}

/**
 * The memory a model with this placement is weighed against, or null when Marinara
 * cannot read it (an AMD or Intel card through Vulkan has no portable reading).
 */
export async function readMemoryFor(placement: LocalModelPlacement): Promise<LocalModelMemoryReading | null> {
  if (placement === "cpu" || (placement === "gpu" && isAppleSilicon())) {
    const total = totalmem();
    const available = await systemAvailableBytes();
    if (placement === "gpu") {
      // Metal caps what one process may wire for the GPU below the whole of memory.
      const cap = Math.floor(total * APPLE_GPU_SHARE);
      return { kind: "unified", totalBytes: cap, availableBytes: Math.min(available, cap) };
    }
    return { kind: "system", totalBytes: total, availableBytes: available };
  }
  if (placement === "gpu") {
    const probe = await awaitGpuProbe({ fresh: true });
    const device = resolveSharedDevice(probe.devices, null);
    if (!device) return null;
    return {
      kind: "gpu",
      name: device.name,
      totalBytes: device.totalBytes,
      availableBytes: Math.max(0, device.totalBytes - device.usedBytes),
    };
  }
  return null;
}

/** The same reading without waiting on any probe, for the status page. */
function readMemoryNow(placement: LocalModelPlacement): LocalModelMemoryReading | null {
  if (placement === "cpu" || (placement === "gpu" && isAppleSilicon())) {
    const total = totalmem();
    const available =
      process.platform === "linux" || process.platform === "android" ? (linuxAvailableBytes() ?? freemem()) : freemem();
    if (placement === "gpu") {
      const cap = Math.floor(total * APPLE_GPU_SHARE);
      return { kind: "unified", totalBytes: cap, availableBytes: Math.min(available, cap) };
    }
    return { kind: "system", totalBytes: total, availableBytes: available };
  }
  if (placement === "gpu") {
    const device = resolveSharedDevice(getGpuProbe().devices, null);
    if (!device) return null;
    return {
      kind: "gpu",
      name: device.name,
      totalBytes: device.totalBytes,
      availableBytes: Math.max(0, device.totalBytes - device.usedBytes),
    };
  }
  return null;
}

/** Two placements compete for the same memory. */
function sharesMemory(left: LocalModelPlacement, right: LocalModelPlacement): boolean {
  if (left === "unknown" || right === "unknown") return false;
  // On Apple silicon the graphics card and the CPU use one pool of memory.
  if (isAppleSilicon()) return true;
  return left === right;
}

// ── the manager ───────────────────────────────────────────────────────────────

class LocalModelManager {
  private slots = new Map<LocalModelSlotId, SlotState>();
  private settings: LocalModelSettings = readSettings();
  /** Replaced by regressions so the memory check can be driven without a real machine's numbers. */
  private readMemory: (placement: LocalModelPlacement) => Promise<LocalModelMemoryReading | null> = readMemoryFor;
  /** Replaced by regressions so the idle timer can run in milliseconds. */
  private minuteMs = 60_000;

  setTestHooks(hooks: {
    readMemory?: (placement: LocalModelPlacement) => Promise<LocalModelMemoryReading | null>;
    minuteMs?: number;
  }): void {
    if (hooks.readMemory) this.readMemory = hooks.readMemory;
    if (hooks.minuteMs) this.minuteMs = hooks.minuteMs;
  }

  register(handle: LocalModelSlotHandle): void {
    const existing = this.slots.get(handle.id);
    if (existing) {
      existing.handle = handle;
      return;
    }
    this.slots.set(handle.id, {
      handle,
      active: 0,
      lastUsedAt: null,
      idleTimer: null,
      unloadedForIdleAt: null,
      unloadedForMemoryAt: null,
      memoryWarning: null,
    });
  }

  private state(id: LocalModelSlotId): SlotState | null {
    return this.slots.get(id) ?? null;
  }

  getSettings(): LocalModelSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<LocalModelSettings>): LocalModelSettings {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    mkdirSync(SETTINGS_DIR, { recursive: true });
    writeFileSync(SETTINGS_PATH, `${JSON.stringify(this.settings, null, 2)}\n`, "utf8");
    // A new limit counts from now for every model that is up.
    for (const slot of this.slots.values()) {
      if (slot.handle.isLoaded() && slot.active === 0) this.armIdleTimer(slot);
      else this.clearIdleTimer(slot);
    }
    return this.getSettings();
  }

  /**
   * Mark a request as started on `id`. Returns the call that marks it finished; that
   * call is safe to make more than once.
   */
  begin(id: LocalModelSlotId): () => void {
    const slot = this.state(id);
    if (!slot) return () => {};
    slot.active += 1;
    slot.lastUsedAt = Date.now();
    slot.unloadedForIdleAt = null;
    slot.unloadedForMemoryAt = null;
    this.clearIdleTimer(slot);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      slot.active = Math.max(0, slot.active - 1);
      slot.lastUsedAt = Date.now();
      if (slot.active === 0 && slot.handle.isLoaded()) this.armIdleTimer(slot);
    };
  }

  async track<T>(id: LocalModelSlotId, work: () => Promise<T>): Promise<T> {
    const end = this.begin(id);
    try {
      return await work();
    } finally {
      end();
    }
  }

  isBusy(id: LocalModelSlotId): boolean {
    return (this.state(id)?.active ?? 0) > 0;
  }

  /** A slot's process became ready: count its idle time from now. */
  noteLoaded(id: LocalModelSlotId): void {
    const slot = this.state(id);
    if (!slot) return;
    slot.lastUsedAt ??= Date.now();
    slot.unloadedForIdleAt = null;
    slot.unloadedForMemoryAt = null;
    if (slot.active === 0) this.armIdleTimer(slot);
  }

  /** A slot's process stopped, for whatever reason. */
  noteStopped(id: LocalModelSlotId): void {
    const slot = this.state(id);
    if (slot) this.clearIdleTimer(slot);
  }

  private clearIdleTimer(slot: SlotState): void {
    if (slot.idleTimer) clearTimeout(slot.idleTimer);
    slot.idleTimer = null;
  }

  private armIdleTimer(slot: SlotState): void {
    this.clearIdleTimer(slot);
    const minutes = this.settings.idleUnloadMinutes;
    if (!minutes) return;
    slot.idleTimer = setTimeout(() => {
      slot.idleTimer = null;
      if (slot.active > 0 || !slot.handle.isLoaded()) return;
      logger.info(`[local-models] ${slot.handle.label()} unused for ${minutes} min; unloading to free memory`);
      slot.unloadedForIdleAt = Date.now();
      void slot.handle.unload("idle").catch((error) => {
        logger.warn(error, `[local-models] Could not unload ${slot.handle.label()}`);
      });
    }, minutes * this.minuteMs);
    slot.idleTimer.unref?.();
  }

  /**
   * Make room before `id` loads a model that wants `neededBytes` of `placement` memory.
   *
   * Never refuses: it unloads idle models that share the memory when that helps, and
   * otherwise records a warning for the slot's page. Returns that warning.
   */
  async prepareToLoad(
    id: LocalModelSlotId,
    neededBytes: number | null,
    placement: LocalModelPlacement,
  ): Promise<string | null> {
    const slot = this.state(id);
    if (slot) slot.memoryWarning = null;
    if (!neededBytes || neededBytes <= 0) return null;
    let reading: LocalModelMemoryReading | null;
    try {
      reading = await this.readMemory(placement);
    } catch (error) {
      logger.debug(error, "[local-models] Memory reading failed");
      return null;
    }
    if (!reading) return null;
    const headroom = reading.kind === "gpu" ? GPU_HEADROOM_BYTES : RAM_HEADROOM_BYTES;
    if (neededBytes > reading.totalBytes - headroom) {
      // Bigger than the whole device: unloading others cannot help.
      return this.warn(
        slot,
        `${slot?.handle.label() ?? id} needs about ${formatGb(neededBytes)}, more than this machine's ${formatGb(reading.totalBytes)}. It may fail to load or run very slowly.`,
      );
    }
    let available = reading.availableBytes - headroom;
    if (neededBytes <= available) return null;

    const others = [...this.slots.values()]
      .filter(
        (other) =>
          other.handle.id !== id &&
          other.active === 0 &&
          other.handle.isLoaded() &&
          sharesMemory(other.handle.placement(), placement),
      )
      .sort((left, right) => (left.lastUsedAt ?? 0) - (right.lastUsedAt ?? 0));
    for (const other of others) {
      if (neededBytes <= available) break;
      const freed = other.handle.footprintBytes() ?? 0;
      logger.info(
        `[local-models] Unloading ${other.handle.label()} (idle) to make room for ${slot?.handle.label() ?? id}`,
      );
      try {
        other.unloadedForMemoryAt = Date.now();
        await other.handle.unload("memory");
        available += freed;
      } catch (error) {
        logger.warn(error, `[local-models] Could not unload ${other.handle.label()}`);
      }
    }
    if (neededBytes <= available) return null;
    return this.warn(
      slot,
      `${slot?.handle.label() ?? id} needs about ${formatGb(neededBytes)} and about ${formatGb(Math.max(0, reading.availableBytes))} is free. Close other apps or unload another model if it fails to load or runs slowly.`,
    );
  }

  private warn(slot: SlotState | null, message: string): string {
    logger.warn(`[local-models] ${message}`);
    if (slot) slot.memoryWarning = message;
    return message;
  }

  getMemoryWarning(id: LocalModelSlotId): string | null {
    return this.state(id)?.memoryWarning ?? null;
  }

  clearMemoryWarning(id: LocalModelSlotId): void {
    const slot = this.state(id);
    if (slot) slot.memoryWarning = null;
  }

  slotStatus(id: LocalModelSlotId): LocalModelSlotStatus | null {
    const slot = this.state(id);
    if (!slot) return null;
    return {
      id,
      label: slot.handle.label(),
      loaded: slot.handle.isLoaded(),
      busy: slot.active > 0,
      lastUsedAt: slot.lastUsedAt,
      unloadedForIdleAt: slot.handle.isLoaded() ? null : slot.unloadedForIdleAt,
      unloadedForMemoryAt: slot.handle.isLoaded() ? null : slot.unloadedForMemoryAt,
      memoryWarning: slot.memoryWarning,
      footprintBytes: slot.handle.isLoaded() ? slot.handle.footprintBytes() : null,
      placement: slot.handle.placement(),
    };
  }

  getStatus(): LocalModelsStatus {
    const slots = [...this.slots.keys()]
      .map((id) => this.slotStatus(id))
      .filter((slot): slot is LocalModelSlotStatus => slot !== null);
    return {
      settings: this.getSettings(),
      slots,
      memory: {
        system: readMemoryNow("cpu"),
        gpu: readMemoryNow("gpu"),
      },
    };
  }
}

export const localModelManager = new LocalModelManager();
