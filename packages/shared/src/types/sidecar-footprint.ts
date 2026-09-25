/**
 * What the local model slots are expected to cost on a GPU, and whether that fits.
 *
 * "Supported" is a property of a model and a machine together, not of the machine
 * alone, so the verdict function takes the slots the user has configured and the
 * device they land on. The same code answers "can I add this model" for a preflight
 * and "is what I already run too heavy" for support diagnostics, which is why it
 * lives in shared types rather than inside either caller.
 *
 * Every number here is an estimate and the UI says so. The launch-time recheck and
 * the load-failure attribution are the backstop.
 */

/** One GPU as `nvidia-smi` reports it. */
export interface GpuDevice {
  index: number;
  uuid: string;
  name: string;
  /** Total memory in bytes. */
  totalBytes: number;
  /** Memory in use at probe time, in bytes. */
  usedBytes: number;
  driverVersion: string;
  /** CUDA compute capability as "major.minor", when the driver reports it. */
  computeCapability?: string;
}

/** The result of probing the machine's GPUs, or why there was nothing to report. */
export interface GpuProbe {
  /** "nvidia" when nvidia-smi answered; otherwise the vendor detectCapabilities saw. */
  vendor: string | null;
  devices: GpuDevice[];
  /**
   * True when a probe has not finished yet. `/api/health` must never wait on
   * nvidia-smi, so it reports a pending probe rather than blocking.
   */
  pending: boolean;
  /** Why no device list is available, when one was expected. */
  error?: string;
}

export type SidecarSlotKind = "main" | "utility" | "decision";

/** One local model slot's expected footprint. */
export interface SidecarSlotFootprint {
  slot: SidecarSlotKind;
  configured: boolean;
  running: boolean;
  /** Display name of the loaded or selected model. Null when nothing is selected. */
  model: string | null;
  /** Model file size in bytes, when the slot is file-backed. */
  fileBytes: number | null;
  contextSize: number | null;
  /** Backend or runtime label, e.g. "vulkan" or "open_jev_torch". */
  backend: string | null;
  /**
   * Bytes of device memory this slot wants: the model's weights plus a KV-cache
   * allowance from the configured context.
   *
   * A running slot is measured instead, and the measurement replaces the estimate
   * whether it is larger or smaller — a reading of the process beats arithmetic over
   * the model file in both directions. `measured` says which one this is.
   */
  estimatedBytes: number | null;
  /** True when this came from a live reading of the process rather than the file size. */
  measured: boolean;
  /** True when the slot runs on the CPU, so the comparison is against system memory. */
  onCpu: boolean;
}

export type SidecarLoadVerdict =
  "unsupported" | "not_enough_disk" | "wont_fit" | "wont_fit_beside_sidecar" | "tight" | "recommended";

/** Headroom below which a fit is reported as tight rather than recommended. */
export const SIDECAR_FOOTPRINT_HEADROOM_BYTES = 1_500_000_000;

export interface SidecarLoadAssessment {
  verdict: SidecarLoadVerdict;
  /**
   * Bytes expected to be in use on the device: every counted slot, plus whatever
   * else already holds memory there. A running slot's own usage is counted once.
   */
  totalBytes: number;
  /** Device memory the estimate is compared against, in bytes. Null when unknown. */
  capacityBytes: number | null;
  /** Free bytes left over. Null when capacity is unknown. */
  headroomBytes: number | null;
  /** Machine-readable reason for an `unsupported` or `not_enough_disk` verdict. */
  reason?: string;
  /** The slot whose model makes the difference, for "won't fit beside your sidecar". */
  blockingSlot?: SidecarSlotKind;
}

/** The sidecar section of `/api/health`, served from a cached probe. */
export interface SidecarHealthSection {
  gpu: GpuProbe;
  slots: SidecarSlotFootprint[];
  load: SidecarLoadAssessment | null;
  /**
   * When the decision sidecar was enabled, and the verdict shown at that moment.
   *
   * In the report so support can see at a glance that a warning was acknowledged
   * rather than guess whether the user understood what they turned on.
   */
  decisionConsent?: { confirmedAt: string; verdict: SidecarLoadVerdict | null } | null;
}
