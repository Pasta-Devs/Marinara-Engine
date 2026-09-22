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
import { statfs } from "node:fs/promises";
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
import { isDecisionRuntimeSupported } from "./decision-runtime.service.js";
import { readSidecarSlots } from "./sidecar-slot-report.js";

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
function platformReason(model: SidecarDecisionModelInfo, device: GpuDevice | null): string | null {
  if (!isDecisionRuntimeSupported()) return "Requires Linux with an NVIDIA GPU";
  const platform = model.platforms.find((entry) => entry.os === process.platform && entry.arch === process.arch);
  if (!platform) return `Requires ${model.platforms.map((entry) => `${entry.os} ${entry.arch}`).join(" or ")}`;
  if (!device) return "Requires an NVIDIA GPU";
  if (compareDriverVersions(device.driverVersion, platform.minDriver) < 0)
    return `Your NVIDIA driver is older than ${platform.minDriver}`;
  if (!meetsComputeCapability(device, model.minComputeCapability))
    return `Requires an NVIDIA GPU of compute capability ${model.minComputeCapability} or newer (Turing and later)`;
  return null;
}

/**
 * Which CUDA device the sidecar will use.
 *
 * Kept in step with the launcher's own choice. Never read from the Vulkan variable
 * the llama.cpp sidecar uses: those index different things.
 */
function configuredCudaIndex(): number {
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
  const device =
    probe.devices.find((entry) => entry.index === configuredCudaIndex()) ?? resolveSharedDevice(probe.devices, null);
  const unsupportedReason = platformReason(model, device);
  const free = await freeDiskBytes();

  // The candidate is weighed as a configured slot alongside whatever else is running,
  // so "fits alone" and "fits beside your sidecar" stay distinguishable.
  const candidate: SidecarSlotFootprint = {
    slot: "decision",
    configured: true,
    running: false,
    model: model.label,
    fileBytes: null,
    contextSize: model.maxLengthTokens,
    backend: model.runtime,
    estimatedBytes: model.vramBytes,
    measured: false,
    onCpu: false,
  };
  const assessment = assessSidecarLoad({
    slots: [...readSidecarSlots().filter((slot) => slot.slot !== "decision"), candidate],
    device,
    candidate: "decision",
    freeDiskBytes: free,
    requiredDiskBytes: model.diskBytes,
    unsupportedReason,
  });

  const reason =
    assessment.verdict === "unsupported"
      ? unsupportedReason
      : assessment.verdict === "not_enough_disk"
        ? `Needs about ${Math.ceil(model.diskBytes / 1_000_000_000)} GB free`
        : assessment.verdict === "wont_fit"
          ? `Needs about ${Math.ceil(model.vramBytes / 1_000_000_000)} GB of GPU memory`
          : assessment.verdict === "wont_fit_beside_sidecar"
            ? "Will not fit beside your current local model"
            : assessment.verdict === "tight"
              ? "Fits, but other GPU apps may cause load failures"
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
