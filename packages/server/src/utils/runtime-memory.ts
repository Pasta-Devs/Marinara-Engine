import { monitorEventLoopDelay } from "node:perf_hooks";
import { getHeapStatistics } from "node:v8";
import { logger } from "../lib/logger.js";
import { sampleWorkerGauges } from "../lib/worker-gauges.js";

const BYTES_PER_MIB = 1024 * 1024;
const MEMORY_WARNING_RATIO = 0.85;
const MEMORY_WARNING_RESET_RATIO = 0.75;
const RSS_RESET_FACTOR = 0.9;
const LOOP_WARNING_MS = 1_000;
const LOOP_RESET_MS = 500;
const MEMORY_CHECK_INTERVAL_MS = 60_000;
/** Every 5th sample is written at debug, every 30th at info. */
const DEBUG_SAMPLE_EVERY = 5;
const INFO_SAMPLE_EVERY = 30;
/** Consecutive calm samples needed before a pressure episode counts as recovered. */
const RECOVERY_SAMPLES = 2;

export type RuntimeMemorySnapshot = {
  heapUsedMiB: number;
  heapLimitMiB: number;
  rssMiB: number;
  heapTotalMiB: number;
  externalMiB: number;
  arrayBuffersMiB: number;
};

let peakRssMiB = 0;
let peakHeapUsedMiB = 0;

function toMiB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MIB) * 10) / 10;
}

export function getRuntimeMemorySnapshot(): RuntimeMemorySnapshot {
  const memory = process.memoryUsage();
  return {
    heapUsedMiB: toMiB(memory.heapUsed),
    heapLimitMiB: toMiB(getHeapStatistics().heap_size_limit),
    rssMiB: toMiB(memory.rss),
    heapTotalMiB: toMiB(memory.heapTotal),
    externalMiB: toMiB(memory.external),
    arrayBuffersMiB: toMiB(memory.arrayBuffers),
  };
}

/** Highest RSS and heap use seen by the monitor since it started (startup peaks included). */
export function getRuntimeMemoryPeaks(): { peakRssMiB: number; peakHeapUsedMiB: number } {
  const now = getRuntimeMemorySnapshot();
  return {
    peakRssMiB: Math.max(peakRssMiB, now.rssMiB),
    peakHeapUsedMiB: Math.max(peakHeapUsedMiB, now.heapUsedMiB),
  };
}

function rssWarnMiB(heapLimitMiB: number): number {
  const configured = Number(process.env.MARINARA_RSS_WARN_MIB);
  return Number.isFinite(configured) && configured > 0 ? configured : heapLimitMiB;
}

/**
 * Samples memory and event-loop delay every 60 s. Writes `runtime.memory` at
 * debug every 5th sample and at info every 30th, and one warn
 * `runtime.memory_pressure` (state "running") per episode of heap, rss or loop
 * pressure, closed by one info line with state "recovered".
 */
export function startRuntimeMemoryMonitor(): () => void {
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  let samples = 0;
  let episodeStartedAt: number | undefined;
  let calmSamples = 0;

  const check = () => {
    samples++;
    const memory = getRuntimeMemorySnapshot();
    peakRssMiB = Math.max(peakRssMiB, memory.rssMiB);
    peakHeapUsedMiB = Math.max(peakHeapUsedMiB, memory.heapUsedMiB);
    const eventLoopDelayP99Ms = Math.round(loop.percentile(99) / 1e6);
    loop.reset();

    const ratio = memory.heapLimitMiB > 0 ? memory.heapUsedMiB / memory.heapLimitMiB : 0;
    const rssThreshold = rssWarnMiB(memory.heapLimitMiB);
    const sample = { ...memory, heapRatio: Math.round(ratio * 100) / 100, eventLoopDelayP99Ms };

    if (samples % INFO_SAMPLE_EVERY === 0) {
      logger.info({ event: "runtime.memory", ...sample, workers: sampleWorkerGauges() }, "[runtime] Memory sample");
    } else if (samples % DEBUG_SAMPLE_EVERY === 0) {
      logger.debug({ event: "runtime.memory", ...sample, workers: sampleWorkerGauges() }, "[runtime] Memory sample");
    }

    const reasons: string[] = [];
    if (ratio >= MEMORY_WARNING_RATIO) reasons.push("heap");
    if (rssThreshold > 0 && memory.rssMiB >= rssThreshold) reasons.push("rss");
    if (eventLoopDelayP99Ms > LOOP_WARNING_MS) reasons.push("loop");

    if (episodeStartedAt === undefined) {
      if (reasons.length > 0) {
        episodeStartedAt = Date.now();
        calmSamples = 0;
        logger.warn(
          {
            event: "runtime.memory_pressure",
            state: "running",
            errorCode: "ME_MEMORY_PRESSURE",
            reasons,
            ...sample,
            workers: sampleWorkerGauges(),
          },
          "[memory] Runtime pressure (%s); sustained pressure can make the server unresponsive",
          reasons.join(", "),
        );
      }
      return;
    }

    const calm =
      ratio < MEMORY_WARNING_RESET_RATIO &&
      !(rssThreshold > 0 && memory.rssMiB >= rssThreshold * RSS_RESET_FACTOR) &&
      eventLoopDelayP99Ms <= LOOP_RESET_MS;
    calmSamples = calm ? calmSamples + 1 : 0;
    if (calmSamples >= RECOVERY_SAMPLES) {
      const episodeMs = Date.now() - episodeStartedAt;
      episodeStartedAt = undefined;
      calmSamples = 0;
      logger.info(
        { event: "runtime.memory_pressure", state: "recovered", episodeMs, ...sample },
        "[memory] Runtime pressure recovered",
      );
    }
  };

  check();
  const timer = setInterval(check, MEMORY_CHECK_INTERVAL_MS);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    loop.disable();
  };
}
