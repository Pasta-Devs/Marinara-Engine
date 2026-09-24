import assert from "node:assert/strict";

// Runtime memory telemetry: the memory snapshot carries heap, external and array buffer memory, the monitor keeps
// startup peaks, and background workers report cheap gauges that runtime.memory, runtime.memory_pressure and
// runtime.freeze lines include. A sampler that throws must never break the line that samples it.
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
const { registerWorkerGauge, sampleWorkerGauges } = await import("../../packages/server/src/lib/worker-gauges.js");
const { getRuntimeMemoryPeaks, getRuntimeMemorySnapshot, startRuntimeMemoryMonitor } =
  await import("../../packages/server/src/utils/runtime-memory.js");

// Gauges: register, replace, unregister; a throwing sampler yields { error: true }.
{
  const unregisterQueue = registerWorkerGauge("regressionQueue", () => ({ queued: 2, running: 1 }));
  const unregisterBroken = registerWorkerGauge("regressionBroken", () => {
    throw new Error("sampler failed");
  });
  const sample = sampleWorkerGauges();
  assert.deepEqual(sample.regressionQueue, { queued: 2, running: 1 });
  assert.deepEqual(sample.regressionBroken, { error: true });

  // A later registration under the same name replaces the first; the stale unregister must not remove it.
  const unregisterReplacement = registerWorkerGauge("regressionQueue", () => ({ queued: 0, running: 0 }));
  unregisterQueue();
  assert.deepEqual(sampleWorkerGauges().regressionQueue, { queued: 0, running: 0 });
  unregisterReplacement();
  unregisterBroken();
  const after = sampleWorkerGauges();
  assert.equal("regressionQueue" in after, false);
  assert.equal("regressionBroken" in after, false);
}

// Snapshot and peaks.
{
  const snapshot = getRuntimeMemorySnapshot();
  for (const key of ["heapUsedMiB", "heapLimitMiB", "rssMiB", "heapTotalMiB", "externalMiB", "arrayBuffersMiB"]) {
    assert.equal(typeof snapshot[key as keyof typeof snapshot], "number", key);
  }
  assert.ok(snapshot.heapLimitMiB > snapshot.heapUsedMiB);
  const peaks = getRuntimeMemoryPeaks();
  assert.ok(peaks.peakRssMiB >= snapshot.rssMiB - 1, "the peak is never below the current figure");
  assert.ok(peaks.peakHeapUsedMiB > 0);
}

// The monitor samples at once (so a startup spike is seen), with a very low RSS threshold to force a pressure
// episode, and stops cleanly without keeping the process alive.
{
  process.env.MARINARA_RSS_WARN_MIB = "1";
  const ballast = new Array(200_000).fill("x".repeat(16));
  const stop = startRuntimeMemoryMonitor();
  assert.ok(getRuntimeMemoryPeaks().peakRssMiB > 1);
  stop();
  stop();
  assert.ok(ballast.length > 0);
  delete process.env.MARINARA_RSS_WARN_MIB;
}

console.log("runtime-memory-telemetry regression passed");
