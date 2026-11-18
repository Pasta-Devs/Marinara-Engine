/**
 * Can this machine run a given decision model, and can it run it beside what is
 * already loaded?
 *
 * Answered before anything downloads, and again before every launch, because the
 * conditions change: a bigger sidecar model, a longer context, a game holding memory.
 * Everything it needs is readable without installing Python or PyTorch.
 *
 * The verdict logic itself lives in `sidecar-footprint.ts` and takes its inputs as
 * arguments, so the regression drives every row from recorded `nvidia-smi` output on
 * a machine with no GPU. This module only gathers the inputs.
 */
import { execFile } from "node:child_process";
import { access, readFile, statfs } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { freemem, totalmem } from "node:os";
import { promisify } from "node:util";
import type {
  GpuDevice,
  SidecarDecisionModelInfo,
  SidecarLoadAssessment,
  SidecarSlotFootprint,
} from "@marinara-engine/shared";
import { getDataDir } from "../../utils/data-dir.js";
import {
  assessSidecarLoad,
  awaitGpuProbe,
  compareDriverVersions,
  meetsComputeCapability,
  resolveSharedDevice,
} from "./sidecar-footprint.js";
import {
  decisionRuntimeInstalled,
  decisionRuntimeService,
  isDecisionRuntimeSupported,
} from "./decision-runtime.service.js";
import { readSidecarSlots } from "./sidecar-slot-report.js";
import { decisionProcessService } from "./decision-process.service.js";
import {
  decisionServerDownloadBytes,
  decisionServerInstall,
  hasDecisionServerBuild,
} from "./decision-server-runtimes.js";

const execFileAsync = promisify(execFile);
import { decisionSidecarSettings } from "../decision/decision-slots.js";

export interface DecisionPreflight {
  modelId: string;
  assessment: SidecarLoadAssessment;
  /** A sentence naming the one thing that is wrong, when something is. */
  reason: string | null;
  /** Whether the Install button may be pressed at all. */
  installable: boolean;
}

/**
 * Why this machine cannot run this entry, in the order a user can act on.
 *
 * Each reason names the specific obstacle rather than collapsing to "unsupported":
 * a driver is updatable, a GPU generation is not, and telling the two apart is the
 * difference between a fixable message and a dead end.
 */
function platformReason(
  model: SidecarDecisionModelInfo,
  device: GpuDevice | null,
  options: { beforeDownload: boolean },
): string | null {
  if (!isDecisionRuntimeSupported()) return "Requires Linux with an NVIDIA GPU";
  const platform = model.platforms.find((entry) => entry.os === process.platform && entry.arch === process.arch);
  if (!platform) return `Requires ${describePlatforms(model)}`;
  if (!device) return "Requires an NVIDIA GPU";
  if (platform.minDriver && compareDriverVersions(device.driverVersion, platform.minDriver) < 0)
    return `Your NVIDIA driver is older than ${platform.minDriver}`;
  const minimum = model.minComputeCapability ?? "7.5";
  const capable = meetsComputeCapability(device, minimum);
  if (capable === false) return `Requires an NVIDIA GPU of compute capability ${minimum} or newer (Turing and later)`;
  // Unknown. Before a download that is a refusal, because approving it is exactly the
  // ten gigabytes the capability check exists to save. Once the model is on disk it
  // is not: a card that launched it before has not changed, and refusing to start
  // over one failed query would stop a working install.
  if (capable === null && options.beforeDownload)
    return "Could not read this GPU's compute capability, so Marinara cannot tell whether it can run this model. Try again, or update the NVIDIA driver";
  return null;
}

const OS_NAMES: Partial<Record<NodeJS.Platform, string>> = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
  android: "Android",
};
const ARCH_NAMES: Record<string, string> = { x64: "a 64-bit Intel or AMD processor", arm64: "an ARM processor" };

/** "Linux on a 64-bit Intel or AMD processor", from an entry's platform list. */
function describePlatforms(model: SidecarDecisionModelInfo): string {
  return model.platforms
    .map((entry) => `${OS_NAMES[entry.os] ?? entry.os} on ${ARCH_NAMES[entry.arch] ?? entry.arch}`)
    .join(" or ");
}

/** Lower-case processor feature flags from /proc/cpuinfo. Null where there is none to read. */
async function cpuFlags(): Promise<Set<string> | null> {
  if (process.platform !== "linux" && process.platform !== "android") return null;
  try {
    const info = await readFile("/proc/cpuinfo", "utf-8");
    const line = info.split("\n").find((entry) => /^flags\s*:/u.test(entry));
    return line ? new Set(line.split(":")[1]!.trim().split(/\s+/u)) : null;
  } catch {
    return null;
  }
}

/** The C library version a Linux build links against, or null when it is not glibc. */
function glibcVersion(): string | null {
  try {
    const report = process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined;
    return report?.header?.glibcVersionRuntime ?? null;
  } catch {
    return null;
  }
}

/** Whether a library is in one of the `LD_LIBRARY_PATH` folders, which the server is launched with. */
async function onLibraryPath(name: string): Promise<boolean> {
  for (const folder of (process.env.LD_LIBRARY_PATH ?? "").split(delimiter).filter(Boolean)) {
    try {
      await access(join(folder, name));
      return true;
    } catch {
      // Not in this folder.
    }
  }
  return false;
}

/**
 * Which of these shared libraries neither the system linker nor `LD_LIBRARY_PATH` can
 * find. The server is launched with Marinara's `LD_LIBRARY_PATH`, so libraries from
 * NVIDIA's pip packages or a toolkit outside the system folders count. Null when the
 * linker cannot be asked and none are on the path.
 */
async function missingLibraries(names: string[]): Promise<string[] | null> {
  const onPath = new Set<string>();
  for (const name of names) if (await onLibraryPath(name)) onPath.add(name);
  const rest = names.filter((name) => !onPath.has(name));
  if (rest.length === 0) return [];
  for (const ldconfig of ["ldconfig", "/sbin/ldconfig", "/usr/sbin/ldconfig"]) {
    try {
      const { stdout } = await execFileAsync(ldconfig, ["-p"], { timeout: 5_000, maxBuffer: 8 * 1024 * 1024 });
      return rest.filter((name) => !stdout.includes(`${name} `) && !stdout.includes(`${name}\t`));
    } catch {
      // Not on PATH under that name; try the next.
    }
  }
  return onPath.size > 0 ? rest : null;
}

/**
 * Why this machine cannot run a GGUF entry, checked before anything downloads.
 *
 * Every runtime but Open-Jev lands here. The llama.cpp ones have a build for nearly every
 * computer; Valen's and Winnow's authors published one build each, and a machine outside
 * it is refused with the specific reason, never left to fail after a multi-gigabyte download.
 */
async function ggufPlatformReason(
  model: SidecarDecisionModelInfo,
  device: GpuDevice | null,
  options: { beforeDownload: boolean },
): Promise<string | null> {
  const platform = model.platforms.find((entry) => entry.os === process.platform && entry.arch === process.arch);
  if (!platform || !hasDecisionServerBuild(model.runtime)) return `Requires ${describePlatforms(model)}`;

  if (model.requiredCpuFlags?.length) {
    const flags = await cpuFlags();
    const missing = flags ? model.requiredCpuFlags.filter((flag) => !flags.has(flag)) : [];
    if (missing.length > 0)
      return `Requires a processor with ${missing.map((flag) => (flag === "avx512f" ? "AVX-512" : flag.toUpperCase())).join(", ")}, which this one does not have`;
  }
  if (model.runtime === "valen_gguf") {
    const glibc = glibcVersion();
    if (!glibc) return "Requires a Linux system with glibc 2.35 or newer (Ubuntu 22.04 and later)";
    if (compareDriverVersions(glibc, "2.35") < 0)
      return `Requires glibc 2.35 or newer (Ubuntu 22.04 and later); this system has ${glibc}`;
  }

  if (platform.gpuVendor === "nvidia") {
    if (!device) return "Requires an NVIDIA GPU";
    if (platform.minDriver && compareDriverVersions(device.driverVersion, platform.minDriver) < 0)
      return `Your NVIDIA driver is older than ${platform.minDriver}`;
    const only = model.onlyComputeCapabilities;
    if (only?.length) {
      if (!device.computeCapability) {
        if (options.beforeDownload)
          return "Could not read this GPU's compute capability, so Marinara cannot tell whether it can run this model. Try again, or update the NVIDIA driver";
      } else if (!only.some((entry) => compareDriverVersions(device.computeCapability!, entry) === 0)) {
        return only.includes("12.0")
          ? `Requires an NVIDIA RTX 50-series GPU. Its runtime has no code for ${device.name}`
          : `Requires an NVIDIA GPU of compute capability ${only.join(" or ")}`;
      }
    }
    if (model.minComputeCapability && meetsComputeCapability(device, model.minComputeCapability) === false)
      return `Requires an NVIDIA GPU of compute capability ${model.minComputeCapability} or newer`;
  }

  if (model.requiredLibraries?.length) {
    const missing = await missingLibraries(model.requiredLibraries);
    if (missing === null) return `Could not check for ${model.requiredLibraries.join(", ")} on this system`;
    if (missing.length > 0) return `Requires ${missing.join(", ")} (the CUDA 13 libraries), which is not installed`;
  }
  return null;
}

/**
 * Which CUDA device the sidecar will use: the panel's choice, then the environment
 * variable that was the only way to choose before the panel had one, then device 0.
 *
 * The launcher and the preflight both read this, so the verdict is always about the
 * card the process will land on. Never read from the Vulkan variable the llama.cpp
 * sidecar uses: those index different things.
 */
export function configuredCudaIndex(): number {
  const chosen = decisionSidecarSettings().cudaDevice;
  if (chosen !== null) return chosen;
  const configured = process.env.MARINARA_DECISION_CUDA_DEVICE?.trim();
  return configured && /^\d+$/u.test(configured) ? Number(configured) : 0;
}

async function freeDiskBytes(): Promise<number | null> {
  try {
    const stats = await statfs(getDataDir());
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

/** The verdict for one catalog entry on this machine, right now. */
export async function preflightDecisionModel(
  model: SidecarDecisionModelInfo,
  options: { fresh?: boolean } = {},
): Promise<DecisionPreflight> {
  // Waited for, unlike the health section's read. A pending probe here would render
  // as "Requires an NVIDIA GPU" on the first panel open of every restart.
  const probe = await awaitGpuProbe(options);
  // The decision sidecar runs on a known CUDA index, so on a machine with several
  // cards the verdict is about that one rather than abandoned for lack of a name.
  const cudaIndex = configuredCudaIndex();
  const chosen = decisionSidecarSettings().cudaDevice !== null;
  // A card picked in the panel that has since gone (removed, or renumbered by a
  // driver change) is named as such. Falling back to another card would give a
  // verdict about a device the launcher will not use.
  const device = chosen
    ? (probe.devices.find((entry) => entry.index === cudaIndex) ?? null)
    : (probe.devices.find((entry) => entry.index === cudaIndex) ?? resolveSharedDevice(probe.devices, null));
  // Free disk only matters for something still to be downloaded. An installed model
  // has already spent its ten gigabytes, so the disk is often below that figure
  // afterwards, and asking for it again would both show "Needs about 10 GB free" for
  // a model that is sitting there and, because disk is judged before memory, hide the
  // launch-time memory recheck behind a verdict that says nothing about the GPU.
  // The weights and the runtime are judged apart: an update that pins a new runtime leaves the weights in place,
  // and reinstalling then rebuilds only the runtime, so it needs only the runtime's share of the disk.
  const gguf = model.runtime !== "open_jev_torch";
  const weightsOnDisk = decisionRuntimeService.modelDownloaded(model);
  const runtimeOnDisk = gguf ? decisionServerInstall(model.runtime) !== null : decisionRuntimeInstalled();
  const onDisk = runtimeOnDisk && weightsOnDisk;
  const requiredDiskBytes = onDisk
    ? null
    : weightsOnDisk
      ? gguf
        ? // An archive and its unpacked copy are both on disk for a moment.
          decisionServerDownloadBytes(model.runtime) * 4
        : Math.max(0, model.diskBytes - model.downloadSizeBytes)
      : model.diskBytes;
  // Only an NVIDIA-memory runtime cares which CUDA card was picked in the panel.
  const nvidia = (model.memory ?? "nvidia") === "nvidia";
  const unsupportedReason =
    nvidia && chosen && !device && probe.devices.length > 0
      ? `The GPU chosen for the decision model (device ${cudaIndex}) is not present`
      : gguf
        ? await ggufPlatformReason(model, device, { beforeDownload: !weightsOnDisk })
        : platformReason(model, device, { beforeDownload: !weightsOnDisk });
  const free = onDisk ? null : await freeDiskBytes();

  // The candidate is weighed as a configured slot alongside whatever else is running,
  // so "fits alone" and "fits beside your sidecar" stay distinguishable.
  const slots = readSidecarSlots();
  // When this very model is already serving, its memory is inside the card's `used`
  // figure. Marked running, the load assessment subtracts it from that figure instead
  // of counting it once as another application and again as the candidate, which made
  // a model that runs fine read as not fitting.
  const status = decisionProcessService.getStatus();
  const alreadyServing = status.running && status.modelId === model.id;
  const current = slots.find((slot) => slot.slot === "decision");
  const candidate: SidecarSlotFootprint = {
    slot: "decision",
    configured: true,
    running: alreadyServing,
    model: model.label,
    fileBytes: null,
    contextSize: model.maxLengthTokens,
    backend: model.runtime,
    estimatedBytes: alreadyServing ? (current?.estimatedBytes ?? model.vramBytes) : model.vramBytes,
    measured: alreadyServing && current?.measured === true,
    onCpu: !nvidia,
  };
  const gpuAssessment = assessSidecarLoad({
    slots: [...slots.filter((slot) => slot.slot !== "decision"), candidate],
    // A model weighed against system memory is not weighed against the NVIDIA card too.
    device: nvidia ? device : null,
    candidate: "decision",
    freeDiskBytes: free,
    requiredDiskBytes,
    unsupportedReason,
  });
  // A llama.cpp or Valen model may land on any card or on the processor, and only an
  // NVIDIA card can be measured, so it is held to what is certain: it must fit in the
  // computer's memory, which is where it runs when the card cannot take it.
  const assessment =
    !nvidia && gpuAssessment.verdict === "recommended" ? assessSystemMemory(model, alreadyServing) : gpuAssessment;
  const memoryWord = nvidia ? "GPU memory" : "memory";

  const reason =
    assessment.verdict === "unsupported"
      ? unsupportedReason
      : assessment.verdict === "not_enough_disk"
        ? `Needs about ${Math.ceil((requiredDiskBytes ?? model.diskBytes) / 1_000_000_000)} GB free`
        : assessment.verdict === "wont_fit"
          ? `Needs about ${Math.ceil(model.vramBytes / 1_000_000_000)} GB of ${memoryWord}`
          : assessment.verdict === "wont_fit_beside_sidecar"
            ? "Will not fit beside your current local model"
            : assessment.verdict === "tight"
              ? nvidia
                ? "Fits, but other GPU apps may cause load failures"
                : "Fits, but close other apps first: memory is nearly full"
              : null;

  return {
    modelId: model.id,
    assessment,
    reason,
    // "Won't fit beside your sidecar" and "tight" are warnings, not refusals: the
    // user may stop the other slot or change its model, and that is their call.
    installable: !["unsupported", "not_enough_disk", "wont_fit"].includes(assessment.verdict),
  };
}

/**
 * The verdict for a model that runs from system memory, or may.
 *
 * Total memory decides "won't fit", because nothing the user closes changes it. Free
 * memory only warns: the system gives back its file cache as soon as something asks.
 */
function assessSystemMemory(model: SidecarDecisionModelInfo, alreadyServing: boolean): SidecarLoadAssessment {
  const capacityBytes = totalmem();
  const free = freemem() + (alreadyServing ? model.vramBytes : 0);
  const totalBytes = capacityBytes - free + model.vramBytes;
  const headroomBytes = capacityBytes - totalBytes;
  const base = { totalBytes, capacityBytes, headroomBytes };
  if (model.vramBytes > capacityBytes) return { verdict: "wont_fit", ...base, blockingSlot: "decision" };
  if (headroomBytes < 0) return { verdict: "tight", ...base };
  return { verdict: "recommended", ...base };
}
