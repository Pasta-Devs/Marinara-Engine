import { getHeapStatistics } from "node:v8";
import { logger } from "../lib/logger.js";

const BYTES_PER_MIB = 1024 * 1024;
const MEMORY_WARNING_RATIO = 0.85;
const MEMORY_WARNING_RESET_RATIO = 0.75;
const MEMORY_CHECK_INTERVAL_MS = 60_000;

export type RuntimeMemorySnapshot = {
  heapUsedMiB: number;
  heapLimitMiB: number;
  rssMiB: number;
};

function toMiB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MIB) * 10) / 10;
}

export function getRuntimeMemorySnapshot(): RuntimeMemorySnapshot {
  const memory = process.memoryUsage();
  return {
    heapUsedMiB: toMiB(memory.heapUsed),
    heapLimitMiB: toMiB(getHeapStatistics().heap_size_limit),
    rssMiB: toMiB(memory.rss),
  };
}

export function startRuntimeMemoryMonitor(): () => void {
  let warningActive = false;
  const check = () => {
    const memory = getRuntimeMemorySnapshot();
    const ratio = memory.heapLimitMiB > 0 ? memory.heapUsedMiB / memory.heapLimitMiB : 0;
    if (ratio >= MEMORY_WARNING_RATIO && !warningActive) {
      warningActive = true;
      logger.warn(
        { memory },
        "[memory] Node heap is near its limit; sustained pressure can make the server unresponsive",
      );
    } else if (ratio < MEMORY_WARNING_RESET_RATIO) {
      warningActive = false;
    }
  };

  check();
  const timer = setInterval(check, MEMORY_CHECK_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
