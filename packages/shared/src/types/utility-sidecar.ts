/**
 * A second, independent local model slot.
 *
 * The existing sidecar holds exactly one model and is wired to generation, scene
 * analysis and tracker agents. Some agents want a small purpose-trained model of
 * their own — an extractor, say — and installing that into the main slot would
 * displace whatever the operator is already running there.
 *
 * So this is a parallel slot: its own config file, its own model directory, its own
 * llama-server process on its own port. It reuses the installed llama.cpp runtime
 * read-only and shares nothing else. Nothing here reads or writes the main sidecar's
 * configuration, model files, process or connections.
 */

/** Where a utility model came from, so an update check knows what to compare against. */
export interface UtilitySidecarModelSource {
  /** HuggingFace repo, e.g. "GetBeholder/Beholder-GGUF". */
  repo: string;
  /** File within the repo, e.g. "Beholder-Q8_0.gguf". */
  file: string;
  /**
   * The blob id HuggingFace reported for that file when it was downloaded.
   *
   * This is the version. Size alone cannot answer "has the model changed" — a
   * requantization can land on the same byte count — and the operator is being asked
   * to spend a download, so the question deserves a real answer.
   */
  oid: string | null;
  /** Bytes on disk, for display and as a weak fallback when no oid is available. */
  bytes: number | null;
  downloadedAt: string;
}

/**
 * The settings an operator may change.
 *
 * Only hardware and resource choices live here. Sampling is deliberately absent: an
 * extractor's output is graded against a schema, and a temperature knob on it is a
 * footgun that turns a working setup into a subtly broken one. Those parameters are
 * fixed to what the model was trained and evaluated with.
 */
export interface UtilitySidecarHardwareSettings {
  /** Context budget per request. */
  contextSize: number;
  /** GPU layers to offload: -1 max offload, 0 CPU-only, or an explicit count. */
  gpuLayers: number;
  /** Parallel llama-server slots. More slots divide the same VRAM. */
  maxParallelJobs: number;
}

export interface UtilitySidecarConfig extends UtilitySidecarHardwareSettings {
  /** Installed models, keyed by the id the requesting agent asks for. */
  models: Record<string, UtilitySidecarModelSource>;
  /** Which model id the process should serve, or null to run nothing. */
  activeModelId: string | null;
}

/** Bounds the UI and the route both enforce, so a bad number cannot reach llama-server. */
export const UTILITY_SIDECAR_LIMITS = {
  contextSize: { min: 512, max: 131072 },
  gpuLayers: { min: -1, max: 999 },
  maxParallelJobs: { min: 1, max: 8 },
} as const;

export interface UtilitySidecarStatus {
  /** False when no model has been installed into this slot yet. */
  configured: boolean;
  activeModelId: string | null;
  models: Record<string, UtilitySidecarModelSource>;
  /** True once the process is up and answering. */
  ready: boolean;
  /** Base URL of the utility process, or null when it is not running. */
  baseUrl: string | null;
  /** Last startup failure, surfaced rather than swallowed. */
  error: string | null;
  /** Whether the shared llama.cpp runtime is installed. Never installs it from here. */
  runtimeInstalled: boolean;
  /** The operator-controllable hardware settings currently in effect. */
  settings: UtilitySidecarHardwareSettings;
}

/** The answer to "is there a newer build of this model?" */
export interface UtilitySidecarUpdateCheck {
  modelId: string;
  repo: string;
  file: string;
  installedOid: string | null;
  availableOid: string | null;
  installedBytes: number | null;
  availableBytes: number | null;
  /** True only when the remote copy is demonstrably different from the installed one. */
  updateAvailable: boolean;
  /**
   * True when the comparison could not be made — no oid on either side. The caller
   * must say so rather than implying the model is current.
   */
  indeterminate: boolean;
}

export const UTILITY_SIDECAR_DEFAULT_CONFIG: UtilitySidecarConfig = {
  models: {},
  activeModelId: null,
  // The extractor's prompts and prose fit comfortably in 8k; larger just costs memory.
  contextSize: 8192,
  // Max GPU offload, falling back to CPU if that start fails. These are small
  // purpose-trained models — an 0.8B extractor is under a gigabyte of VRAM — so the
  // GPU is both the right place for them and the cheaper one: on CPU they are slow
  // *and* they spend system RAM the machine is more likely to be short of.
  gpuLayers: -1,
  maxParallelJobs: 1,
};
