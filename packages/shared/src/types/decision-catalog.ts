/**
 * The decision models Marinara can install and run itself.
 *
 * Open-Jev is the first downloadable decision model, not the only one there will ever
 * be, so this is a catalog rather than an Open-Jev feature: adding a model later is an
 * entry here plus, at most, one new runtime kind. Nothing outside the runtime adapter
 * for a kind should name a specific model.
 *
 * Every size and limit below was measured on real hardware rather than derived from a
 * parameter count. The comments say where each number came from, because a preflight
 * that turns a guess into a verdict is worse than no preflight.
 */
import type { DecisionCalibration } from "./decision.js";

/**
 * Which installer and launcher run an entry. A new kind is a real new runtime.
 *
 * - `open_jev_torch`: Open-Jev's own Python server. Linux with an NVIDIA card only.
 * - `llama_letters`: a plain GGUF on the llama.cpp server Marinara already uses for its
 *   built-in chat model. The model answers with an option letter and Marinara reads the
 *   letters' probabilities itself (JevK5's published readout). Runs wherever that
 *   server does: Windows, macOS, Linux, Android, on a graphics card or the CPU.
 * - `llama_systemone`: a GGUF that declares itself a decision model, served by a newer
 *   llama.cpp that answers `/v1/systemone` natively. Its own pinned server build, so
 *   the chat model's server is not changed under it.
 * - `valen_gguf`: Valen's own llama.cpp build. Its published build is Linux x64 CPU only.
 * - `winnow_cuda`: Winnow's own llama.cpp build. Its published build is Linux with an
 *   NVIDIA RTX 50-series card and the CUDA 13 libraries.
 * - `valen_onnx`: Valen-Decision's full release, its ONNX package run through Valen's
 *   own SDK on the Node that runs Marinara, on the processor. The only runtime here that
 *   reads video; frames are decoded by a pinned FFmpeg build installed beside it.
 */
export const DECISION_RUNTIME_KINDS = [
  "open_jev_torch",
  "llama_letters",
  "llama_systemone",
  "valen_gguf",
  "winnow_cuda",
  "valen_onnx",
] as const;
export type DecisionRuntimeKind = (typeof DECISION_RUNTIME_KINDS)[number];

/** Runtimes that load one GGUF file and need `modelFile`. */
export function isGgufDecisionRuntime(runtime: DecisionRuntimeKind): boolean {
  return runtime !== "open_jev_torch" && runtime !== "valen_onnx";
}

/**
 * Which memory a model is weighed against before it installs and loads.
 *
 * `nvidia`: graphics memory on an NVIDIA card (Open-Jev, Winnow). `cpu`: system memory
 * (Valen's CPU build). `llama`: the graphics card when Marinara's llama.cpp runtime uses
 * one, otherwise system memory.
 */
export type DecisionMemoryKind = "nvidia" | "cpu" | "llama";

/** Question types a decision model can answer, by their System One names. */
export type DecisionQuestionKind = "noul" | "choice" | "score" | "bbox";
/** What a decision model can read. */
export type DecisionInputKind = "text" | "image" | "video";

/** One OS and processor a runtime has a build for. */
export interface DecisionPlatform {
  os: NodeJS.Platform;
  arch: string;
  /** `nvidia` means the runtime cannot start without an NVIDIA card. */
  gpuVendor: "nvidia" | "any";
  minDriver?: string;
}

/**
 * Artifact types a published checkpoint can declare, mapped to the runtime that can
 * load it.
 *
 * This is what makes a pasted repository safe to consider: Open-Jev's checkpoints ship
 * a `release-manifest.json` naming their `artifact_type`, their base model and its
 * pinned revision, so compatibility is read rather than assumed. A type that is not in
 * this table has no runtime here and is refused by name.
 */
export const DECISION_ARTIFACT_RUNTIMES: Record<string, DecisionRuntimeKind> = {
  qwen_lora_adapter_plus_scalar_decision_head: "open_jev_torch",
};

/**
 * The runtime that can load this artifact type, or null.
 *
 * Deliberately not a bare index. `DECISION_ARTIFACT_RUNTIMES["constructor"]` returns
 * a function from `Object.prototype`, and every member of it is truthy, so a manifest
 * declaring `"constructor"` or `"toString"` would otherwise pass the one check that
 * decides whether a pasted repository is installable at all.
 */
export function runtimeForArtifactType(artifactType: string): DecisionRuntimeKind | null {
  return Object.hasOwn(DECISION_ARTIFACT_RUNTIMES, artifactType) ? DECISION_ARTIFACT_RUNTIMES[artifactType]! : null;
}

/** The same guard for the runtime table, for exactly the same reason. */
export function decisionRuntimeDefaults(
  runtime: string,
): (typeof DECISION_RUNTIME_DEFAULTS)[DecisionRuntimeKind] | null {
  return Object.hasOwn(DECISION_RUNTIME_DEFAULTS, runtime)
    ? DECISION_RUNTIME_DEFAULTS[runtime as DecisionRuntimeKind]
    : null;
}

/**
 * Is this a HuggingFace repository id and nothing else?
 *
 * Load bearing rather than cosmetic. A pasted id is interpolated into hub URLs, and a
 * segment of dots survives a naive character-class check while collapsing the path:
 * `../name` resolves `…/api/models/../name/tree/x` to `…/api/name/tree/x`, which is a
 * different endpoint than the one this code believes it is calling.
 */
export function isSafeRepoId(value: string): boolean {
  const segments = value.split("/");
  if (segments.length !== 2) return false;
  return segments.every(
    (segment) => /^[A-Za-z0-9._-]+$/u.test(segment) && /[A-Za-z0-9]/u.test(segment) && !/^\.+$/u.test(segment),
  );
}

/**
 * Is this a git ref this code is willing to put in a URL?
 *
 * Either an exact commit or a plain branch or tag name. No dot-only segments, no
 * leading dash, nothing that needs escaping.
 */
export function isSafeGitRef(value: string): boolean {
  if (/^[0-9a-f]{40}$/u.test(value)) return true;
  if (value.length > 100 || value.startsWith("-")) return false;
  return value.split("/").every((segment) => /^[A-Za-z0-9._-]+$/u.test(segment) && !/^\.+$/u.test(segment));
}

/** A relative `.gguf` path with no empty, `.` or `..` segment. */
export function isSafeModelFilePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  if (!value.toLowerCase().endsWith(".gguf") || value.startsWith("/") || value.includes("\\")) return false;
  return value.split("/").every((segment) => /^[A-Za-z0-9._-]+$/u.test(segment) && !/^\.+$/u.test(segment));
}

/** One downloadable artifact, pinned so an install is reproducible. */
export interface DecisionModelArtifact {
  repoId: string;
  /** An exact commit. Never a branch: a moving pin is not a pin. */
  revision: string;
  /** Subset of the repository to fetch, when the whole thing is not needed. */
  paths?: string[];
}

export interface SidecarDecisionModelInfo {
  id: string;
  label: string;
  description: string;
  runtime: DecisionRuntimeKind;
  /** The checkpoint, then the base weights it names. Both pinned. */
  artifacts: DecisionModelArtifact[];
  downloadSizeBytes: number;
  diskBytes: number;
  /** Peak device memory observed while serving, at `maxLengthTokens`. */
  vramBytes: number;
  maxLengthTokens: number;
  /** Sequences per forward pass. Higher answers a group faster and costs memory. */
  batchSize: number;
  platforms: DecisionPlatform[];
  /**
   * Lowest CUDA compute capability the runtime's wheels contain kernels for, for a
   * runtime that needs an NVIDIA card.
   *
   * Not decoration: the pinned PyTorch build ships `sm_75` and up, so Pascal and older
   * cannot run this however much memory they have. Without this the preflight would
   * pass a GTX 1080 Ti, spend ten gigabytes, and fail at load.
   */
  minComputeCapability?: string;
  /**
   * The only compute capabilities a runtime has kernels for, when it was built for
   * exactly those (Winnow's build is `sm_120` only). Checked before the download.
   */
  onlyComputeCapabilities?: string[];
  /** Which memory `vramBytes` is weighed against. Open-Jev entries leave it out (NVIDIA). */
  memory?: DecisionMemoryKind;
  /**
   * The GGUF to load, as a path inside the first artifact. For every runtime but Open-Jev.
   * For `valen_onnx`, the package's own `valen_onnx.json`, which marks the folder it loads.
   */
  modelFile?: string;
  /**
   * The vision projector that lets a GGUF model read images, as a path inside the first
   * artifact. Downloaded with the model and passed to its server with `--mmproj`.
   */
  projectorFile?: string;
  /**
   * For `llama_letters`: the temperatures the model's authors fitted for this file. The
   * first scales the letter log-probabilities; the second sharpens the combined answer
   * when a question has more than 16 options and is read in several passes.
   */
  letterReadout?: { temperature: number; knockoutTemperature: number };
  /** Plain words for the languages it was trained and checked on, for the picker. */
  languages?: string;
  /** The question types the model answers, from its authors' documentation. */
  questionTypes?: DecisionQuestionKind[];
  /** What the model reads as installed here. Marinara sends it chat media of these kinds. */
  inputs?: DecisionInputKind[];
  /**
   * What the same model can read in another release Marinara lists separately (Valen's
   * GGUF reads images; its full release also reads video), shown so it is not understated.
   */
  extraInputs?: DecisionInputKind[];
  /** Shared libraries the runtime needs installed on the machine (Winnow's CUDA 13). */
  requiredLibraries?: string[];
  /** Processor features the runtime's build was compiled for (Valen's AVX2 build). */
  requiredCpuFlags?: string[];
  /** Where this model answers, which is not where a general chat model answers. */
  calibration: DecisionCalibration;
  /**
   * Measured extra time per question beyond the first. The prefix cache stays off, so
   * every question, and every Choice option, re-reads the whole scene: the cost grows
   * with the number of questions and with the scene's length. Each entry says what
   * scene length it was measured on. The request budget grows by this much per
   * question, so a group of questions is not cut off by a budget sized for one. Only
   * curated entries carry one; a pasted model keeps the flat sidecar budget.
   */
  perQuestionMs?: number;
  licenses: string[];
  /** Drives the "not developed by Marinara" wording before anything downloads. */
  thirdParty: true;
}

/** Every OS and processor Marinara's llama.cpp runtimes have a build for. */
const LLAMA_PLATFORMS: DecisionPlatform[] = [
  { os: "win32", arch: "x64", gpuVendor: "any" },
  { os: "win32", arch: "arm64", gpuVendor: "any" },
  { os: "darwin", arch: "arm64", gpuVendor: "any" },
  { os: "darwin", arch: "x64", gpuVendor: "any" },
  { os: "linux", arch: "x64", gpuVendor: "any" },
  { os: "linux", arch: "arm64", gpuVendor: "any" },
  { os: "android", arch: "arm64", gpuVendor: "any" },
];

/**
 * Peak memory of the running server, measured on 2026-11-18 (Linux, CPU, the context
 * in each entry, after a 20-question run). On a graphics card the weights move there
 * and the figure is close.
 */
const LLAMA_LETTERS_MEMORY = {
  jevk5_4b: 3_600_000_000,
  jevk5_2b: 2_900_000_000,
  // With the vision projector loaded.
  d1_3b: 3_000_000_000,
  valen_4b: 6_400_000_000,
};

/** Bytes of each Valen ONNX package's processor files at its pinned revision (2026-11-18). */
const VALEN_ONNX_BYTES = { b2: 6_364_010_541, b4: 11_766_313_941 };

/**
 * Where Valen's full release runs: every system Node's ONNX Runtime 1.30 has a build for
 * that a pinned FFmpeg build also exists for (Windows on ARM has no FFmpeg build there).
 */
const VALEN_ONNX_PLATFORMS: DecisionPlatform[] = [
  { os: "win32", arch: "x64", gpuVendor: "any" },
  { os: "darwin", arch: "arm64", gpuVendor: "any" },
  { os: "linux", arch: "x64", gpuVendor: "any" },
  { os: "linux", arch: "arm64", gpuVendor: "any" },
];

/**
 * Curated entries, shipped with releases. Each one is a reviewed, pinned change.
 *
 * A model reached by pasting its repository is handled separately and is not listed
 * here: it is checked against `DECISION_ARTIFACT_RUNTIMES` at the moment it is pasted.
 */
export const SIDECAR_DECISION_MODELS: SidecarDecisionModelInfo[] = [
  {
    id: "jevk5-4b",
    label: "JevK5 4B",
    description:
      "An open Jev alternative that runs on almost any computer: NVIDIA, AMD, Intel or Apple graphics, or the processor alone. Uses the same llama.cpp server as Marinara's built-in chat model. English only.",
    runtime: "llama_letters",
    artifacts: [
      {
        repoId: "alibiserikbay/JevK5-GGUF",
        revision: "ec67b0bfce5119a8b11a2cdb430bb43e3fa3e82a",
        paths: ["jevk5-4b-v0.3-Q4_K_M.gguf"],
      },
    ],
    modelFile: "jevk5-4b-v0.3-Q4_K_M.gguf",
    // From the Hub's file listing at the pinned revision; the digest is checked on download.
    downloadSizeBytes: 2_708_804_000,
    // The weights only: the llama.cpp runtime is the one the built-in chat model uses.
    diskBytes: 2_710_000_000,
    vramBytes: LLAMA_LETTERS_MEMORY.jevk5_4b,
    memory: "llama",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: LLAMA_PLATFORMS,
    // Measured on 20 roleplay turns through this readout (2026-11-18, CPU, Q4_K_M): yes
    // answered 0.50 to 0.89, no 0.015 to 0.26. 0.3 separates every one of them; 0.5 would
    // have missed one yes. The authors' own temperatures for this file are below.
    calibration: { defaultThreshold: 0.3, questionShape: "text" },
    letterReadout: { temperature: 1.22, knockoutTemperature: 0.93 },
    languages: "English",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
    licenses: ["Apache-2.0 (weights)"],
    thirdParty: true,
  },
  {
    id: "liquid-d1-3b",
    label: "Liquid d1 3B",
    description:
      "Liquid AI's decision model, trained for 16 languages including Japanese, Chinese, Korean, German, Spanish and Russian. Runs on almost any computer. Free for people and for companies under $10 million a year in revenue.",
    runtime: "llama_systemone",
    artifacts: [
      {
        repoId: "LiquidAI/d1-3B-GGUF",
        revision: "bb1e436ea78eb96a3f1acb6da865f70c2fbeb563",
        paths: ["d1-3B-Q4_K_M.gguf", "mmproj-d1-3B-Q8_0.gguf", "LICENSE"],
      },
    ],
    modelFile: "d1-3B-Q4_K_M.gguf",
    projectorFile: "mmproj-d1-3B-Q8_0.gguf",
    // The weights (1,674,467,246 bytes) and the vision projector (583,109,728).
    downloadSizeBytes: 2_257_576_974,
    // The weights plus its own llama.cpp server build (about 100 MB unpacked).
    diskBytes: 2_400_000_000,
    vramBytes: LLAMA_LETTERS_MEMORY.d1_3b,
    memory: "llama",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: LLAMA_PLATFORMS,
    // Measured on the same 20 turns in English, Spanish, Japanese, German, Chinese,
    // French, Korean and Russian (2026-11-18, CPU, Q4_K_M): yes 0.66 to 0.99, no 0.011 to
    // 0.063. All 20 correct at any threshold from 0.07 to 0.65.
    calibration: { defaultThreshold: 0.3, questionShape: "text" },
    languages: "16 languages",
    questionTypes: ["noul", "choice", "score"],
    // Measured with the projector (2026-11-18, CPU): a picture scaled to 512 px costs about
    // 550 tokens; sea 0.94, snowy forest 0.017, time of day "sunset" on a beach at sunset.
    inputs: ["text", "image"],
    licenses: ["LFM Open License 1.0 (free under $10M yearly revenue)"],
    thirdParty: true,
  },
  {
    id: "jevk5-2b",
    label: "JevK5 2B",
    description:
      "The smaller JevK5: faster on a processor or a small graphics card, a little less accurate. Same server as the built-in chat model. English only.",
    runtime: "llama_letters",
    artifacts: [
      {
        repoId: "alibiserikbay/JevK5-GGUF",
        revision: "ec67b0bfce5119a8b11a2cdb430bb43e3fa3e82a",
        paths: ["jevk5-2b-v0.2-Q8_0.gguf"],
      },
    ],
    modelFile: "jevk5-2b-v0.2-Q8_0.gguf",
    downloadSizeBytes: 2_012_012_000,
    diskBytes: 2_015_000_000,
    vramBytes: LLAMA_LETTERS_MEMORY.jevk5_2b,
    memory: "llama",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: LLAMA_PLATFORMS,
    calibration: { defaultThreshold: 0.3, questionShape: "text" },
    // The authors' values for the 2B file (v0.2 recipe).
    letterReadout: { temperature: 1.42, knockoutTemperature: 0.77 },
    languages: "English",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
    licenses: ["Apache-2.0 (weights)"],
    thirdParty: true,
  },
  {
    id: "valen-decision-1.5-4b",
    label: "Valen-Decision 1.5 4B",
    description:
      "Valen's decision model in its compact GGUF form: reads the chat and its pictures. Its published runtime is for Linux on a 64-bit Intel or AMD processor, and it runs on the processor, not the graphics card. For video, pick its full release.",
    runtime: "valen_gguf",
    artifacts: [
      {
        repoId: "Valen-Team/Valen-Decision-1.5-4B-GGUF",
        revision: "9fea2c28ee96682c9e516f847003e3e5e3590dad",
        paths: ["Valen-Decision-1.5-4B-Q8_0.gguf", "vision-native-limits-F32.gguf"],
      },
    ],
    modelFile: "Valen-Decision-1.5-4B-Q8_0.gguf",
    projectorFile: "vision-native-limits-F32.gguf",
    // The weights (4,514,520,928 bytes) and the vision file (1,334,075,104).
    downloadSizeBytes: 5_848_596_032,
    // The weights plus Valen's runtime (32 MB download).
    diskBytes: 6_000_000_000,
    vramBytes: LLAMA_LETTERS_MEMORY.valen_4b,
    memory: "cpu",
    // The context its authors launch it with; the whole request is read in one batch.
    maxLengthTokens: 4096,
    batchSize: 1,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "any" }],
    requiredCpuFlags: ["avx2", "fma", "f16c", "bmi2"],
    // Measured on the same 20 turns as the others, state sent as text (2026-11-18, CPU,
    // Q8_0): yes 0.66 to 0.99, no 0 to 0.036, about 6.5 seconds a question on 4 cores.
    calibration: { defaultThreshold: 0.3, questionShape: "text" },
    languages: "8 languages checked (English, Spanish, Japanese, German, Chinese, French, Korean, Russian)",
    // Runtime 0.2.0 serves text and images (with its vision file) and boxes on images.
    // Video is in the full Valen-Decision release, listed separately. Measured with the
    // vision file (2026-11-18, CPU): a 512 px beach at sunset read sea 0.996, snowy
    // forest 0.00002, "sunset"; the same question without the picture, 0.51.
    questionTypes: ["noul", "choice", "score", "bbox"],
    inputs: ["text", "image"],
    extraInputs: ["video"],
    licenses: ["Apache-2.0 (weights and runtime)"],
    thirdParty: true,
  },
  {
    id: "valen-decision-1.5-2b-full",
    label: "Valen-Decision 1.5 2B (full release)",
    description:
      "Valen's full release: reads the chat, pictures and video clips. Runs on the processor on Windows, macOS (Apple silicon) and Linux, through Valen's own software rather than PyTorch.",
    runtime: "valen_onnx",
    artifacts: [
      {
        repoId: "Valen-Team/Valen-Decision-1.5-2B-ONNX",
        revision: "a954856c5851694dcb94bf7877e259e620af11c2",
        // The processor variant with 8-bit feed-forward weights, which its authors
        // validated against the full-precision model. Not the CUDA or fp32 files.
        paths: [
          "config.json",
          "chat_template.jinja",
          "processor_config.json",
          "tokenizer.json",
          "tokenizer_config.json",
          "valen_onnx.json",
          "reused-tensors.json",
          "validation.json",
          "onnx/embedding.onnx",
          "onnx/embedding.data",
          "onnx/vision.onnx",
          "onnx/vision-weights-000.data",
          "onnx/decision-q8-mlp.onnx",
          "onnx/decision-q8-mlp.onnx.data",
          "onnx/grounding.onnx",
          "onnx/grounding-weights-000.data",
        ],
      },
    ],
    modelFile: "valen_onnx.json",
    // The files above at the pinned revision, from the Hub's listing.
    downloadSizeBytes: VALEN_ONNX_BYTES.b2,
    // The weights plus FFmpeg for video (about 55 MB).
    diskBytes: VALEN_ONNX_BYTES.b2 + 60_000_000,
    // Peak 5.7 GB while answering a picture and a clip together (2026-11-18, 4 threads).
    vramBytes: 6_000_000_000,
    memory: "cpu",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: VALEN_ONNX_PLATFORMS,
    // Measured on the same 20 roleplay turns is still to do; the protocol's own 0.5 until then.
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    languages: "Not stated by its authors (the 4B GGUF was checked on 8)",
    // Measured (2026-11-18, 4-core CPU): a beach-then-forest clip read beach 0.90, forest
    // 0.66, snowy mountain 0.03, "sunset"; about 20 s with a 512 px picture beside it.
    questionTypes: ["noul", "choice", "score", "bbox"],
    inputs: ["text", "image", "video"],
    licenses: ["Apache-2.0 (weights and SDK)", "FFmpeg: GPL-3.0 (video decoding)"],
    thirdParty: true,
  },
  {
    id: "valen-decision-1.5-4b-full",
    label: "Valen-Decision 1.5 4B (full release)",
    description:
      "The larger full release: reads the chat, pictures and video clips, more accurate than 2B, and slower. Runs on the processor on Windows, macOS (Apple silicon) and Linux, and needs about 12 GB of memory.",
    runtime: "valen_onnx",
    artifacts: [
      {
        repoId: "Valen-Team/Valen-Decision-1.5-4B-ONNX",
        revision: "6086715761200e6c0e8e08dba2d58dc25c7702d8",
        paths: [
          "config.json",
          "chat_template.jinja",
          "processor_config.json",
          "tokenizer.json",
          "tokenizer_config.json",
          "valen_onnx.json",
          "reused-tensors.json",
          "validation.json",
          "onnx/embedding.onnx",
          "onnx/embedding.data",
          "onnx/vision.onnx",
          "onnx/vision-weights-000.data",
          "onnx/decision-q8-mlp.onnx",
          "onnx/decision-q8-mlp.onnx.data",
          "onnx/grounding.onnx",
          "onnx/grounding-weights-000.data",
        ],
      },
    ],
    modelFile: "valen_onnx.json",
    downloadSizeBytes: VALEN_ONNX_BYTES.b4,
    diskBytes: VALEN_ONNX_BYTES.b4 + 60_000_000,
    // Not measured (too large for the test machine's disk beside the others). Scaled
    // from 2B, whose peak was within a few percent of its files' size.
    vramBytes: 12_500_000_000,
    memory: "cpu",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: VALEN_ONNX_PLATFORMS,
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    languages:
      "8 languages checked on its GGUF form (English, Spanish, Japanese, German, Chinese, French, Korean, Russian)",
    questionTypes: ["noul", "choice", "score", "bbox"],
    inputs: ["text", "image", "video"],
    licenses: ["Apache-2.0 (weights and SDK)", "FFmpeg: GPL-3.0 (video decoding)"],
    thirdParty: true,
  },
  {
    id: "winnow-e4b",
    label: "Winnow E4B",
    description:
      "A Gemma 4 decision model that scored 80.5% on JevBench's public set, and reads pictures. Its published runtime only runs on Linux, on a processor with AVX-512 (such as AMD Ryzen 7000 or 9000; current Intel laptop and desktop chips lack it), with an NVIDIA RTX 50-series card and the CUDA 13 libraries installed, and needs about 11 GB of graphics memory.",
    runtime: "winnow_cuda",
    artifacts: [
      {
        repoId: "EldanRing/Winnow-E4B",
        revision: "17871fd27a880b3f8dad94841774db70e59fca47",
        paths: ["gguf/Winnow-E4B-Q8_0.gguf", "gguf/mmproj-Winnow-E4B.gguf", "LICENSE", "NOTICE"],
      },
    ],
    modelFile: "gguf/Winnow-E4B-Q8_0.gguf",
    projectorFile: "gguf/mmproj-Winnow-E4B.gguf",
    // The weights (8,005,437,472 bytes, measured after download) and the vision projector (990,372,672).
    downloadSizeBytes: 8_995_810_144,
    // The weights plus Winnow's runtime (57 MB download).
    diskBytes: 9_200_000_000,
    // The authors measured 8.56 GiB on an RTX 5070 Ti for 8K text decisions; the vision
    // projector adds about 1 GB.
    vramBytes: 10_200_000_000,
    memory: "nvidia",
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "nvidia", minDriver: "580" }],
    // The published build has kernels for sm_120 (RTX 50 series) only.
    onlyComputeCapabilities: ["12.0"],
    requiredLibraries: ["libcudart.so.13", "libcublas.so.13", "libnccl.so.2"],
    // The published build's CPU code uses AVX-512 throughout: on a processor without it
    // the server dies with "Illegal instruction" before it reaches the card (seen on a
    // Core Ultra 9 275HX with an RTX 5090, 2026-11-18).
    requiredCpuFlags: ["avx512f"],
    // Not measured here: no machine that can run it was available. The protocol's own default.
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    languages: "Not stated by its authors",
    questionTypes: ["noul", "choice", "score"],
    // Its runtime takes still images as data URLs, at most 16 per request. Not measured
    // here: no RTX 50-series card was available.
    inputs: ["text", "image"],
    licenses: ["Apache-2.0 (weights, Gemma 4 terms)"],
    thirdParty: true,
  },
  {
    id: "open-jev-2b",
    label: "Open-Jev 2B",
    description:
      "An independent research model that answers yes/no questions without writing a reply. Faster and a little smaller than a general local model, but less accurate on roleplay.",
    runtime: "open_jev_torch",
    artifacts: [
      { repoId: "ZefanCai/Open-Jev-2B", revision: "0c7aa498b1627be8da4acf34c863ff0ee0a92785", paths: ["package/"] },
      { repoId: "Qwen/Qwen3.5-2B", revision: "15852e8c16360a2fea060d615a32b45270f8a8fc" },
    ],
    // 12 MB checkpoint plus 4,548,221,488 bytes of base weights, both measured from
    // the pinned revisions and verified by sha256 after download.
    downloadSizeBytes: 4_560_000_000,
    // Weights on disk plus the runtime's own Python environment, which measured 5.4 GB.
    diskBytes: 10_000_000_000,
    // Measured at 4576 MiB peak while serving at max-length 4096.
    vramBytes: 4_798_283_776,
    maxLengthTokens: 4096,
    // Not 1: `candidate_batches` treats this as a per-forward-pass sequence limit, so
    // 1 serialises every question in a group instead of answering them together.
    batchSize: 8,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "nvidia", minDriver: "580" }],
    minComputeCapability: "7.5",
    // Measured, not assumed. On eight roleplay turns this model answered yes between
    // 0.15 and 0.59 and no between 0.009 and 0.026, so the documented 0.5 would skip
    // every relevant turn. Any threshold from roughly 0.03 to 0.15 classified all
    // eight correctly; 0.1 sits in the middle of that band.
    calibration: { defaultThreshold: 0.1, questionShape: "task_object" },
    // Measured through the engine on the longest chat it sends: 24 statements took
    // 5.9 s and 32 took 7.9 s, and a Choice option costs the same as a statement. With
    // the flat 4 s budget both got no answers at all, so every statement read as no.
    // A scene at the model's own full length (3,479 tokens) costs 0.33 s a statement,
    // hence 350 rather than the 250 an English chat needs.
    perQuestionMs: 350,
    // Read from the LICENSE file at each pinned revision. Qwen3.5-2B is Apache-2.0 there.
    licenses: ["MIT (source)", "Apache-2.0 (adapter)", "Apache-2.0 (base weights)"],
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
    thirdParty: true,
  },
  {
    id: "open-jev-9b",
    label: "Open-Jev 9B",
    description:
      "The larger Open-Jev: more accurate than 2B in our tests, but it needs about 22 GB of GPU memory, so on a 24 GB card nothing else fits beside it, and it takes about a second per question.",
    runtime: "open_jev_torch",
    artifacts: [
      { repoId: "ZefanCai/Open-Jev-9B", revision: "47e966881e489511c0c7f5633a9e1960a676a551", paths: ["package/"] },
      { repoId: "Qwen/Qwen3.5-9B", revision: "c202236235762e1c871ad0ccb60c8ee5ba337b9a" },
    ],
    // 25,588,410 bytes of checkpoint plus 19,329,393,661 bytes of base weights, from
    // the pinned revisions.
    downloadSizeBytes: 19_354_982_071,
    // Measured after a real install on 2026-09-23: weights plus the runtime
    // environment, with uv's cache already pruned (25,274,581,531 bytes).
    diskBytes: 25_300_000_000,
    // Measured at 22,492 MiB peak serving a full batch of eight near max-length 4096.
    vramBytes: 23_584_571_392,
    maxLengthTokens: 4096,
    batchSize: 8,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "nvidia", minDriver: "580" }],
    minComputeCapability: "7.5",
    // Measured, like 2B. On the eight roleplay turns (object-shaped question) it
    // answered yes between 0.135 and 0.79 and no at 0.019 or below, and it scored 31
    // of 32 recommended-statement turns at 0.1. Any threshold from about 0.02 to 0.13
    // separates the roleplay set; 0.1 matches 2B's operating point.
    calibration: { defaultThreshold: 0.1, questionShape: "task_object" },
    // About 1.0 s for one question on a short scene, 3.35 s for four and 6.6 s for
    // eight: the prefix cache stays off, so each question re-reads the scene.
    perQuestionMs: 800,
    licenses: ["MIT (source)", "Apache-2.0 (adapter)", "Apache-2.0 (base weights)"],
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
    thirdParty: true,
  },
];

/**
 * What a runtime kind imposes on anything it loads.
 *
 * A pasted checkpoint declares which runtime can load it but not what that runtime
 * costs, so these come from the runtime rather than from the repository. A model's
 * own manifest is not allowed to claim a lower driver floor or a wider GPU range than
 * the wheels actually support.
 */
export const DECISION_RUNTIME_DEFAULTS: Record<
  DecisionRuntimeKind,
  Pick<
    SidecarDecisionModelInfo,
    | "maxLengthTokens"
    | "batchSize"
    | "platforms"
    | "minComputeCapability"
    | "onlyComputeCapabilities"
    | "calibration"
    | "memory"
    | "requiredCpuFlags"
    | "requiredLibraries"
    | "questionTypes"
    | "inputs"
    | "extraInputs"
  >
> = {
  open_jev_torch: {
    maxLengthTokens: 4096,
    batchSize: 8,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "nvidia", minDriver: "580" }],
    minComputeCapability: "7.5",
    calibration: { defaultThreshold: 0.1, questionShape: "task_object" },
    memory: "nvidia",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
  },
  llama_letters: {
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: LLAMA_PLATFORMS,
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    memory: "llama",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
  },
  // A pasted native decision GGUF has not been measured here, so it keeps the
  // protocol's own 0.5 until the user tunes it on their agents.
  llama_systemone: {
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: LLAMA_PLATFORMS,
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    memory: "llama",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text"],
  },
  valen_gguf: {
    maxLengthTokens: 4096,
    batchSize: 1,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "any" }],
    requiredCpuFlags: ["avx2", "fma", "f16c", "bmi2"],
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    memory: "cpu",
    questionTypes: ["noul", "choice", "score", "bbox"],
    // Pictures need the vision file; a pasted repository gets `image` added when it has one.
    inputs: ["text"],
  },
  winnow_cuda: {
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: [{ os: "linux", arch: "x64", gpuVendor: "nvidia", minDriver: "580" }],
    onlyComputeCapabilities: ["12.0"],
    requiredLibraries: ["libcudart.so.13", "libcublas.so.13", "libnccl.so.2"],
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    memory: "nvidia",
    questionTypes: ["noul", "choice", "score"],
    inputs: ["text", "image"],
  },
  valen_onnx: {
    maxLengthTokens: 8192,
    batchSize: 1,
    platforms: VALEN_ONNX_PLATFORMS,
    calibration: { defaultThreshold: 0.5, questionShape: "text" },
    memory: "cpu",
    questionTypes: ["noul", "choice", "score", "bbox"],
    inputs: ["text", "image", "video"],
  },
};

/** Runtimes a pasted repository can be installed with. The others are curated-only. */
export const PASTEABLE_DECISION_RUNTIMES: readonly DecisionRuntimeKind[] = [
  "open_jev_torch",
  "llama_systemone",
  "valen_gguf",
];

/** The shape of a checkpoint's own release manifest, as far as this engine reads it. */
export interface DecisionReleaseManifest {
  artifact_type?: unknown;
  base_model?: unknown;
  base_revision?: unknown;
  base_weights_included?: unknown;
}

export type DecisionManifestRefusal =
  | "unreadable_manifest"
  | "unknown_artifact_type"
  | "missing_base_model"
  | "unpinned_base_revision"
  | "base_weights_included";

/**
 * Judge a pasted checkpoint by what it declares about itself.
 *
 * This is the whole safety gate for a bring-your-own model: compatibility is read from
 * the repository's own manifest and matched against a runtime this engine ships,
 * rather than assumed from a name. Anything it cannot vouch for is refused by reason,
 * never installed hopefully.
 */
export function readDecisionManifest(
  manifest: DecisionReleaseManifest | null,
): { runtime: DecisionRuntimeKind; baseModel: string; baseRevision: string } | { refusal: DecisionManifestRefusal } {
  if (!manifest || typeof manifest !== "object") return { refusal: "unreadable_manifest" };
  const declared = typeof manifest.artifact_type === "string" ? manifest.artifact_type : "";
  const runtime = runtimeForArtifactType(declared);
  if (!runtime) return { refusal: "unknown_artifact_type" };
  const baseModel = typeof manifest.base_model === "string" ? manifest.base_model.trim() : "";
  // The manifest is third-party text and this id goes into a URL, so it gets the same
  // check a pasted one does rather than a looser shape test.
  if (!isSafeRepoId(baseModel)) return { refusal: "missing_base_model" };
  const baseRevision = typeof manifest.base_revision === "string" ? manifest.base_revision.trim() : "";
  // A branch name would let the weights change under a pinned adapter.
  if (!/^[0-9a-f]{40}$/u.test(baseRevision)) return { refusal: "unpinned_base_revision" };
  // A package that ships its own base weights is a different install shape: this
  // downloader fetches the checkpoint and then the base model the manifest names, so
  // it would pull weights the package already contains.
  if (manifest.base_weights_included === true) return { refusal: "base_weights_included" };
  return { runtime, baseModel, baseRevision };
}

export function findDecisionModel(id: string | null | undefined): SidecarDecisionModelInfo | null {
  return SIDECAR_DECISION_MODELS.find((model) => model.id === id) ?? null;
}

/**
 * What the user has decided about the managed decision sidecar.
 *
 * `enabled` is deliberately separate from "installed": the panel is collapsed behind
 * an explicit toggle with a warning, and turning it off stops the process while
 * keeping the download. The consent fields record what was shown at the moment the
 * user agreed, so a support report can tell an informed choice from a surprise.
 */
export interface DecisionSidecarSettings {
  enabled: boolean;
  /** The catalog entry that is installed, or null. */
  modelId: string | null;
  /**
   * A model installed by pasting its repository, which by definition is not in the
   * curated list. Stored whole so an install survives a restart without re-reading a
   * third party's manifest to find out what is on disk.
   */
  customModel: SidecarDecisionModelInfo | null;
  /** Start with Marinara, or on the first gate that needs it. */
  startPolicy: "on_demand" | "with_marinara";
  confirmedAt: string | null;
  /** The preflight verdict displayed when the user confirmed. */
  confirmedVerdict: string | null;
  /**
   * The CUDA device the decision sidecar runs on, by `nvidia-smi` index, or null for
   * the default. Separate from the llama.cpp slots' device, which is a Vulkan index
   * and names a different card on a machine with an integrated GPU.
   */
  cudaDevice: number | null;
}

export const DECISION_SIDECAR_SETTINGS_KEY = "decision-sidecar";

export const DECISION_SIDECAR_DEFAULT_SETTINGS: DecisionSidecarSettings = {
  enabled: false,
  modelId: null,
  customModel: null,
  startPolicy: "on_demand",
  confirmedAt: null,
  confirmedVerdict: null,
  cudaDevice: null,
};

/** A plausible CUDA device index. Whether that card exists is the preflight's call. */
export function isCudaDeviceIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 64;
}

/** Accept a stored custom entry only if its runtime and floors still make sense. */
export function sanitizeCustomDecisionModel(value: unknown): SidecarDecisionModelInfo | null {
  if (!value || typeof value !== "object") return null;
  const model = value as SidecarDecisionModelInfo;
  const defaults = decisionRuntimeDefaults(model.runtime);
  if (!defaults) return null;
  // Only a runtime a pasted repository can actually reach. A hand-edited record naming
  // a curated-only runtime would otherwise borrow that runtime's launcher for files
  // nobody reviewed.
  if (!PASTEABLE_DECISION_RUNTIMES.includes(model.runtime)) return null;
  if (!Array.isArray(model.artifacts) || model.artifacts.length === 0) return null;
  // The GGUF path is joined onto the download folder, so it is held to the same shape
  // as a file the downloader would write: relative, no dot segments, a .gguf name.
  if (isGgufDecisionRuntime(model.runtime) && !isSafeModelFilePath(model.modelFile)) return null;
  // The projector is joined onto the same folder and handed to the server the same way.
  if (model.projectorFile !== undefined && !isSafeModelFilePath(model.projectorFile)) return null;
  // Each element is checked for shape before any field is read. A null element used
  // to throw, and the settings parser's catch then reset the whole record, losing
  // `enabled`, the start policy and the consent record over one bad entry.
  const artifactOk = (artifact: unknown): boolean => {
    if (!artifact || typeof artifact !== "object") return false;
    const entry = artifact as Partial<DecisionModelArtifact>;
    if (typeof entry.revision !== "string" || !/^[0-9a-f]{40}$/u.test(entry.revision)) return false;
    if (typeof entry.repoId !== "string" || !isSafeRepoId(entry.repoId)) return false;
    // The downloader calls `startsWith` on every prefix.
    return (
      entry.paths === undefined ||
      (Array.isArray(entry.paths) && entry.paths.every((prefix) => typeof prefix === "string"))
    );
  };
  if (!model.artifacts.every(artifactOk)) return null;
  // Both reach the installer dialog as text.
  if (!Array.isArray(model.licenses) || !model.licenses.every((license) => typeof license === "string")) return null;
  if (typeof model.description !== "string") return null;
  // An entry with no name or a nonsense size would reach the panel and the preflight,
  // where it would render blank and be judged against zero bytes.
  if (typeof model.id !== "string" || !model.id.trim()) return null;
  if (typeof model.label !== "string" || !model.label.trim()) return null;
  const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
  if (!positive(model.vramBytes) || !positive(model.diskBytes) || !positive(model.downloadSizeBytes)) return null;
  // The runtime's own constraints always win over whatever was stored, and a measured
  // per-question cost belongs to curated entries only: a stored value could otherwise
  // stretch every request's budget.
  const { perQuestionMs: _unmeasured, letterReadout: _curatedOnly, ...rest } = model;
  const merged = { ...rest, ...defaults };
  // What it reads follows from its files, not from what was stored: pictures only with a
  // vision projector beside the weights.
  if (model.projectorFile) merged.inputs = [...new Set([...(defaults.inputs ?? ["text"]), "image" as const])];
  return merged;
}

export function parseDecisionSidecarSettings(raw: string | null | undefined): DecisionSidecarSettings {
  if (!raw) return { ...DECISION_SIDECAR_DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<DecisionSidecarSettings>;
    return {
      enabled: parsed.enabled === true,
      modelId: typeof parsed.modelId === "string" && findDecisionModel(parsed.modelId) ? parsed.modelId : null,
      // Re-validated on read: a hand-edited entry must not be able to describe a
      // runtime this engine does not ship or claim a weaker hardware floor.
      customModel: sanitizeCustomDecisionModel(parsed.customModel),
      startPolicy: parsed.startPolicy === "with_marinara" ? "with_marinara" : "on_demand",
      confirmedAt: typeof parsed.confirmedAt === "string" ? parsed.confirmedAt : null,
      confirmedVerdict: typeof parsed.confirmedVerdict === "string" ? parsed.confirmedVerdict : null,
      cudaDevice: isCudaDeviceIndex(parsed.cudaDevice) ? parsed.cudaDevice : null,
    };
  } catch {
    // A hand-edited or truncated value must not enable a download.
    return { ...DECISION_SIDECAR_DEFAULT_SETTINGS };
  }
}
