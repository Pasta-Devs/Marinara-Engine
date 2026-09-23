/**
 * How much device memory the local model slots are expected to want, and whether that
 * is more than the machine has.
 *
 * One module for three callers: the preflight that runs before a download, the recheck
 * that runs before a launch, and the sidecar section of support diagnostics. The probe
 * output and the slot configuration are injected into the pure half, so a regression
 * can drive every verdict from recorded `nvidia-smi` output on a machine with no GPU.
 *
 * Every number is an estimate. The UI says so, and the launch-time recheck is the
 * backstop for a machine whose conditions changed after an install.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  SIDECAR_FOOTPRINT_HEADROOM_BYTES,
  type GpuDevice,
  type GpuProbe,
  type SidecarLoadAssessment,
  type SidecarSlotFootprint,
  type SidecarSlotKind,
} from "@marinara-engine/shared";

const execFileAsync = promisify(execFile);

/**
 * Two queries, because `compute_cap` is not available on every driver and
 * `nvidia-smi` rejects the WHOLE query when one field is unknown rather than
 * omitting it. Asking for it unconditionally would report "no NVIDIA GPU" on an
 * older driver, taking the preflight and the existing diagnostics down with it.
 */
const NVIDIA_SMI_BASE_QUERY = "index,uuid,name,memory.total,memory.used,driver_version";
const NVIDIA_SMI_QUERY = `${NVIDIA_SMI_BASE_QUERY},compute_cap`;
const NVIDIA_SMI_APPS_QUERY = "pid,used_memory";
const PROBE_TIMEOUT_MS = 4000;
/** Matches detectCapabilities' own cache, so a slow probe is never on a request path. */
const PROBE_CACHE_MS = 60_000;

// ── the pure half ─────────────────────────────────────────────────────────────

/**
 * Parse `nvidia-smi --query-compute-apps=pid,used_memory` into bytes by pid.
 *
 * This is what turns a running slot's footprint from arithmetic into a measurement.
 * A row that does not parse is dropped rather than recorded as a process using none.
 */
export function parseNvidiaSmiApps(output: string): Map<number, number> {
  const usage = new Map<number, number>();
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 2) continue;
    const pid = Number(parts[0]);
    const usedMiB = Number(parts[1]);
    if (!Number.isFinite(pid) || !Number.isFinite(usedMiB) || usedMiB <= 0) continue;
    usage.set(pid, usedMiB * 1024 * 1024);
  }
  return usage;
}

/**
 * Parse `nvidia-smi --format=csv,noheader,nounits` output.
 *
 * Defensive on purpose: the tool's column set varies with driver version, and a row
 * that does not parse is dropped rather than turned into a zero that would read as a
 * GPU with no memory.
 */
export function parseNvidiaSmi(output: string): GpuDevice[] {
  const devices: GpuDevice[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 6) continue;
    const index = Number(parts[0]);
    const totalMiB = Number(parts[3]);
    const usedMiB = Number(parts[4]);
    if (!Number.isFinite(index) || !Number.isFinite(totalMiB) || totalMiB <= 0) continue;
    devices.push({
      index,
      uuid: parts[1] ?? "",
      name: parts[2] ?? "",
      totalBytes: totalMiB * 1024 * 1024,
      usedBytes: Number.isFinite(usedMiB) && usedMiB >= 0 ? usedMiB * 1024 * 1024 : 0,
      driverVersion: parts[5] ?? "",
      // Older drivers do not expose this column at all, so it stays optional and an
      // absent value is treated as unknown rather than as unsupported.
      computeCapability: parts[6] || undefined,
    });
  }
  return devices;
}

/**
 * Compare two dotted driver versions.
 *
 * Returns a negative number when `version` is older than `minimum`. A string with a
 * segment that is not a number is indeterminate and compares equal, because a driver
 * string Marinara cannot parse is not a reason to tell the user their driver is too
 * old and block an install. A missing trailing segment is a real zero: 580.95 is
 * 580.95.0.
 */
function versionSegments(value: string): number[] | null {
  const parts = value.split(".").map((part) => Number(part.trim()));
  return parts.every((part) => Number.isFinite(part)) ? parts : null;
}

export function compareDriverVersions(version: string, minimum: string): number {
  const left = versionSegments(version);
  const right = versionSegments(minimum);
  if (!left || !right) return 0;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Bytes of device memory a llama.cpp-style slot is expected to want.
 *
 * Weights plus a KV cache sized from the configured context.
 *
 * The per-token figure is measured, not assumed: the same GGUF loaded on one card at
 * 4,096 and at 32,768 tokens of context differed by 1,811 MiB, which is 64.7 KiB per
 * token. It varies with a model's layer and head counts, which a GGUF path alone does
 * not reveal, so this is a single broad figure — enough to separate "comfortable" from
 * "will not load", which is the only question the verdict answers.
 */
const KV_CACHE_BYTES_PER_TOKEN = 64.7 * 1024;

export function estimateSlotBytes(args: {
  fileBytes: number | null;
  contextSize: number | null;
  measuredBytes?: number | null;
}): number | null {
  // A running slot has been measured, and a measurement beats arithmetic. llama.cpp
  // allocates the whole KV cache at load, so the reading is already complete rather
  // than a figure that will grow. It also corrects for architectures whose file size
  // is not their device footprint: a Gemma 4 E4B measured 5.2 GB on the card from an
  // 8.2 GB file, which the size-based estimate overstates by half.
  if (typeof args.measuredBytes === "number" && args.measuredBytes > 0) return args.measuredBytes;
  if (args.fileBytes === null || args.fileBytes <= 0) return null;
  return args.fileBytes + Math.max(0, args.contextSize ?? 0) * KV_CACHE_BYTES_PER_TOKEN;
}

/**
 * The verdict for a set of slots on one device.
 *
 * `candidate` is the slot being added, when this is answering "can I install this".
 * Without one, the question is "is what I already run too heavy", which is the same
 * arithmetic and the same thresholds.
 */
export function assessSidecarLoad(args: {
  slots: SidecarSlotFootprint[];
  device: GpuDevice | null;
  candidate?: SidecarSlotKind;
  /** Free bytes on the data directory's filesystem, when a download is being weighed. */
  freeDiskBytes?: number | null;
  /** Bytes the candidate needs on disk, download plus install. */
  requiredDiskBytes?: number | null;
  /** Set when the platform itself rules the candidate out. */
  unsupportedReason?: string | null;
}): SidecarLoadAssessment {
  const counted = args.slots.filter((slot) => slot.configured && !slot.onCpu);
  const slotBytes = counted.reduce((sum, slot) => sum + (slot.estimatedBytes ?? 0), 0);
  const capacityBytes = args.device?.totalBytes ?? null;

  // A card is rarely empty. A desktop compositor, a browser or a game holds memory
  // this engine will never see, and ignoring it reports "recommended" for a model
  // that cannot load. Whatever a running slot of ours holds is already inside the
  // card's `used` figure, so subtract it first rather than counting it twice.
  const ourRunningBytes = counted.reduce((sum, slot) => sum + (slot.running ? (slot.estimatedBytes ?? 0) : 0), 0);
  const otherUsageBytes = Math.max(0, (args.device?.usedBytes ?? 0) - ourRunningBytes);
  const totalBytes = slotBytes + otherUsageBytes;
  const headroomBytes = capacityBytes === null ? null : capacityBytes - totalBytes;

  if (args.unsupportedReason)
    return { verdict: "unsupported", totalBytes, capacityBytes, headroomBytes, reason: args.unsupportedReason };

  if (
    typeof args.requiredDiskBytes === "number" &&
    typeof args.freeDiskBytes === "number" &&
    args.freeDiskBytes < args.requiredDiskBytes
  )
    return { verdict: "not_enough_disk", totalBytes, capacityBytes, headroomBytes, reason: "free_disk" };

  if (capacityBytes === null) return { verdict: "recommended", totalBytes, capacityBytes, headroomBytes };

  const candidate = args.candidate ? (counted.find((slot) => slot.slot === args.candidate) ?? null) : null;
  // "Won't fit" is a property of the model and the card: it stays true however much
  // is freed up, which is what separates it from the verdicts below.
  const candidateBytes = candidate?.estimatedBytes ?? 0;

  // The candidate alone exceeding the card is a different answer from the candidate
  // not fitting beside what is already loaded: the first cannot be fixed by stopping
  // anything, the second can.
  if (candidate && candidateBytes > capacityBytes)
    return { verdict: "wont_fit", totalBytes, capacityBytes, headroomBytes, blockingSlot: candidate.slot };
  if (totalBytes > capacityBytes) {
    if (!candidate) return { verdict: "wont_fit", totalBytes, capacityBytes, headroomBytes };
    const other = counted.find((slot) => slot.slot !== candidate.slot && (slot.estimatedBytes ?? 0) > 0);
    return {
      verdict: "wont_fit_beside_sidecar",
      totalBytes,
      capacityBytes,
      headroomBytes,
      ...(other ? { blockingSlot: other.slot } : {}),
    };
  }
  return {
    verdict: headroomBytes! < SIDECAR_FOOTPRINT_HEADROOM_BYTES ? "tight" : "recommended",
    totalBytes,
    capacityBytes,
    headroomBytes,
  };
}

/**
 * Which device a slot lands on.
 *
 * The main sidecar is steered by Vulkan device index and a PyTorch-based slot by CUDA
 * index, and on a laptop with an integrated GPU the same card is Vulkan 1 and `cuda:0`.
 * Indices are therefore never compared: with one NVIDIA GPU everything shares it, and
 * with several the match is by name from the slot's launch diagnostics.
 */
/**
 * Does this card have kernels in the runtime's wheels?
 *
 * The pinned PyTorch build ships `sm_75` and up. A Pascal card has plenty of memory
 * and a current driver and still cannot run it, so without this check the preflight
 * would approve a ten gigabyte download that fails at load.
 *
 * Null when the probe could not read the capability. Every driver new enough for the
 * runtime reports it, so an unknown value usually means the detailed query failed
 * and the fallback answered. What to do about that depends on whether anything is
 * still to be downloaded, so the caller decides.
 */
export function meetsComputeCapability(device: GpuDevice, minimum: string): boolean | null {
  if (!device.computeCapability) return null;
  return compareDriverVersions(device.computeCapability, minimum) >= 0;
}

export function resolveSharedDevice(devices: GpuDevice[], deviceName: string | null): GpuDevice | null {
  if (devices.length === 0) return null;
  if (devices.length === 1) return devices[0]!;
  if (!deviceName) return null;
  const needle = deviceName.toLowerCase();
  return devices.find((device) => device.name.toLowerCase().includes(needle)) ?? null;
}

// ── the probe ─────────────────────────────────────────────────────────────────

let cached: { probe: GpuProbe; usageByPid: Map<number, number>; at: number } | null = null;
let inFlight: Promise<{ probe: GpuProbe; usageByPid: Map<number, number> }> | null = null;

async function runProbe(): Promise<{ probe: GpuProbe; usageByPid: Map<number, number> }> {
  try {
    const [gpus, apps] = await Promise.all([
      execFileAsync("nvidia-smi", [`--query-gpu=${NVIDIA_SMI_QUERY}`, "--format=csv,noheader,nounits"], {
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
      }).catch(() =>
        // Without compute capability the preflight cannot rule a GPU generation out.
        // Keeping the device is still better than losing the probe entirely: the
        // preflight refuses a download it cannot vouch for, and a model already on
        // disk can still be weighed for memory and launched.
        execFileAsync("nvidia-smi", [`--query-gpu=${NVIDIA_SMI_BASE_QUERY}`, "--format=csv,noheader,nounits"], {
          timeout: PROBE_TIMEOUT_MS,
          windowsHide: true,
        }),
      ),
      // Best effort: some drivers and container setups report no per-process usage,
      // and the slot lines fall back to the size-based estimate rather than failing.
      execFileAsync("nvidia-smi", [`--query-compute-apps=${NVIDIA_SMI_APPS_QUERY}`, "--format=csv,noheader,nounits"], {
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
      }).catch(() => ({ stdout: "" })),
    ]);
    const devices = parseNvidiaSmi(gpus.stdout);
    return {
      probe:
        devices.length > 0
          ? { vendor: "nvidia", devices, pending: false }
          : { vendor: null, devices: [], pending: false, error: "no_nvidia_gpu" },
      usageByPid: parseNvidiaSmiApps(apps.stdout),
    };
  } catch {
    // A missing or failing nvidia-smi means no usable NVIDIA GPU, which is a fact
    // about this machine rather than an error to surface as a broken probe.
    return { probe: { vendor: null, devices: [], pending: false, error: "no_nvidia_gpu" }, usageByPid: new Map() };
  }
}

/**
 * The cached GPU probe, refreshed in the background at most once a minute.
 *
 * `/api/health` has a ten-second client timeout and is also the freeze detector's
 * signal, so it must never wait on `nvidia-smi`. This returns a pending probe rather
 * than blocking when no result exists yet, and the report says "probe pending".
 */
function refresh(): void {
  const now = Date.now();
  if (cached && now - cached.at <= PROBE_CACHE_MS) return;
  inFlight ??= runProbe()
    .then((result) => {
      cached = { ...result, at: Date.now() };
      return result;
    })
    .finally(() => {
      // Safe only because nothing clears `inFlight` from outside: this promise is
      // always the one in the slot when it settles. Anything that invalidates the
      // cache mid-flight needs a generation token so a stale probe cannot repopulate
      // `cached` or clear a newer request's promise.
      inFlight = null;
    });
}

export function getGpuProbe(): GpuProbe {
  refresh();
  return cached?.probe ?? { vendor: null, devices: [], pending: true };
}

/** Device memory the given process holds, from the same cached probe. */
export function getMeasuredProcessBytes(pid: number | null | undefined): number | null {
  if (typeof pid !== "number") return null;
  refresh();
  return cached?.usageByPid.get(pid) ?? null;
}

/**
 * The probe, waiting for it when it has not run yet.
 *
 * `/api/health` must never block, which is why `getGpuProbe` returns a pending
 * result. A preflight is the opposite case: it is answering "can this machine run
 * this", and a pending probe there reads as "no NVIDIA GPU", which is a verdict
 * rather than a delay.
 */
export async function awaitGpuProbe(options: { fresh?: boolean } = {}): Promise<GpuProbe> {
  if (options.fresh) {
    // A reading taken before a process was stopped still counts its memory, which is
    // the whole thing a launch-time recheck is trying not to do. Any probe already in
    // flight started earlier, so it is waited out and then a new one is taken.
    await inFlight?.catch(() => null);
    cached = null;
  }
  refresh();
  if (cached) return cached.probe;
  return (await inFlight)?.probe ?? { vendor: null, devices: [], pending: true };
}
