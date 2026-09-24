// ──────────────────────────────────────────────
// Worker gauges: cheap state samples for runtime.memory lines
// ──────────────────────────────────────────────
// A background worker (queue, scheduler, sidecar) registers a sampler that
// returns a few numbers (queued, running, oldestMs...). runtime.memory,
// runtime.memory_pressure and runtime.freeze lines include every sample, so a
// stall or a memory spike shows which worker was busy. Samplers must be cheap,
// synchronous and must never return prompt text or message content.

const gauges = new Map<string, () => Record<string, unknown>>();

/** Registers a named sampler. Returns a function that unregisters it. A later registration with the same name replaces it. */
export function registerWorkerGauge(name: string, sample: () => Record<string, unknown>): () => void {
  gauges.set(name, sample);
  return () => {
    if (gauges.get(name) === sample) gauges.delete(name);
  };
}

/** Samples every registered gauge. A sampler that throws yields `{ error: true }` instead of failing the caller. */
export function sampleWorkerGauges(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, sample] of gauges) {
    try {
      result[name] = sample();
    } catch {
      result[name] = { error: true };
    }
  }
  return result;
}
