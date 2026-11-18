/**
 * The built-in embedding model: a small search model Marinara downloads and runs itself, so semantic search
 * (lorebooks, Long-term memory, memory recall) needs no embedding server of the person's own.
 *
 * It runs as its own llama-server beside the built-in model and the decision model, on the llama.cpp runtime the
 * built-in model installs, and never shares or replaces either of them.
 */
import type { SidecarDownloadProgress } from "./sidecar.js";

/**
 * Pseudo-connection id for the built-in embedding model, wherever an embedding source is picked
 * (Connections > Embeddings, a Model's Embedding connection, a lorebook's Vectorize).
 * Distinct from LOCAL_SIDECAR_CONNECTION_ID, which embeds with the built-in chat model.
 */
export const BUILTIN_EMBEDDING_CONNECTION_ID = "__builtin_embedding__";

export type BuiltinEmbeddingModelId = "qwen3-embedding-0.6b" | "embeddinggemma-300m";

export interface BuiltinEmbeddingModelInfo {
  id: BuiltinEmbeddingModelId;
  /** Display name, also the model name the embedding source reports (and that picks its query prefix). */
  label: string;
  /** HuggingFace repo and file. */
  repo: string;
  file: string;
  /** SHA-256 of the file (its LFS oid), checked after download. */
  sha256: string;
  downloadSizeBytes: number;
  /** Memory while working on long texts (weights, context and compute), measured on llama.cpp. */
  ramBytes: number;
  dimensions: number;
  /** llama.cpp pooling the model was trained with. */
  pooling: "last" | "mean";
  /** Tokens one text may have; longer texts are cut to fit. */
  contextSize: number;
  /**
   * llama.cpp physical batch. A model that reads a text both ways (mean pooling) needs the whole text in one batch;
   * a left-to-right model (last-token pooling) gives the same vector in smaller steps, with far less memory.
   */
  physicalBatch: number;
  license: string;
  recommended: boolean;
}

export const BUILTIN_EMBEDDING_MODELS: readonly BuiltinEmbeddingModelInfo[] = [
  {
    id: "qwen3-embedding-0.6b",
    label: "Qwen3-Embedding-0.6B",
    repo: "Qwen/Qwen3-Embedding-0.6B-GGUF",
    file: "Qwen3-Embedding-0.6B-Q8_0.gguf",
    sha256: "06507c7b42688469c4e7298b0a1e16deff06caf291cf0a5b278c308249c3e439",
    downloadSizeBytes: 639_150_592,
    ramBytes: 2_000_000_000,
    dimensions: 1024,
    pooling: "last",
    contextSize: 4096,
    physicalBatch: 512,
    license: "Apache 2.0",
    recommended: true,
  },
  {
    id: "embeddinggemma-300m",
    label: "EmbeddingGemma-300M",
    repo: "ggml-org/embeddinggemma-300M-GGUF",
    file: "embeddinggemma-300M-Q8_0.gguf",
    sha256: "b5ce9d77a3fc4b3b39ccb5643c36777911cc4eb46a66962eadfa3f5f60490d63",
    downloadSizeBytes: 333_590_944,
    ramBytes: 1_600_000_000,
    dimensions: 768,
    pooling: "mean",
    // It reads a whole text at once, so memory grows fast with length; 1024 tokens keeps it the lighter one.
    contextSize: 1024,
    physicalBatch: 1024,
    license: "Gemma",
    recommended: false,
  },
];

/** Where the model runs: the GPU when the runtime has one (falling back to the CPU), or always the CPU. */
export type BuiltinEmbeddingDevice = "auto" | "cpu";

export interface BuiltinEmbeddingInstalledModel {
  file: string;
  bytes: number;
  downloadedAt: string;
}

export interface BuiltinEmbeddingStatus {
  /** False in Lite builds and on MLX-only setups, where there is no llama.cpp runtime. */
  supported: boolean;
  models: BuiltinEmbeddingModelInfo[];
  installed: Partial<Record<BuiltinEmbeddingModelId, BuiltinEmbeddingInstalledModel>>;
  /** The model embeddings use; always an installed one, or null. */
  activeModelId: BuiltinEmbeddingModelId | null;
  device: BuiltinEmbeddingDevice;
  /** The llama.cpp runtime the built-in model installs; the embedding model borrows it. */
  runtimeInstalled: boolean;
  running: boolean;
  starting: boolean;
  /** Process id while running, for measured memory. */
  pid: number | null;
  /** Resident memory of the running process, when the platform reports it. */
  memoryBytes: number | null;
  error: string | null;
  download: (SidecarDownloadProgress & { modelId: BuiltinEmbeddingModelId }) | null;
}
