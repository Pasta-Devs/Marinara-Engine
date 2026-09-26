import type { SidecarGpuMemory } from "@marinara-engine/shared";

/** Collect only allocation lines from the current process; never read old log files. */
export class SidecarGpuMemoryReporter {
  private pending = { stdout: "", stderr: "" };
  private allocations = new Map<string, { field: keyof SidecarGpuMemory; bytes: number }>();

  consume(chunk: string, stream: "stdout" | "stderr" = "stderr"): void {
    const lines = (this.pending[stream] + chunk).split(/\r?\n/);
    // ponytail: retain only a bounded unfinished log line; extend if a runtime emits longer allocation lines.
    this.pending[stream] = (lines.pop() ?? "").slice(-2048);
    for (const line of lines) {
      const match = /\b([\w:.-]+)\s+(model|KV|compute|output)\s+buffer size\s*=\s*([\d.]+)\s+MiB/i.exec(line);
      if (!match || /cpu|host/i.test(match[1]!)) continue;
      // Unknown backend labels remain unavailable rather than being mistaken for GPU memory.
      if (!/^(?:CUDA|ROCm|HIP|Vulkan|Metal|MTL|SYCL|MUSA|CANN)/i.test(match[1]!)) continue;
      const bytes = Number(match[3]) * 1024 * 1024;
      if (!Number.isFinite(bytes) || bytes < 0) continue;
      const kind = match[2]!.toLowerCase();
      const field = kind === "model" ? "weightsBytes" : kind === "kv" ? "kvCacheBytes" : "buffersBytes";
      this.allocations.set(`${match[1]}:${kind}`, { field, bytes });
    }
  }

  report(): SidecarGpuMemory | null {
    if (this.allocations.size === 0) return null;
    const result: SidecarGpuMemory = { weightsBytes: null, kvCacheBytes: null, buffersBytes: null };
    for (const { field, bytes } of this.allocations.values()) result[field] = (result[field] ?? 0) + bytes;
    return result;
  }
}
