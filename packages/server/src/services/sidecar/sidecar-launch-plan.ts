export type LlamaStartupPlan = {
  gpuLayers: number;
  label: string;
};

function needsCudaSingleGpuSplitMode(modelPath: string): boolean {
  return /gemma/i.test(modelPath);
}

export function buildLlamaArgs(options: {
  modelPath: string;
  gpuLayers: number;
  port: number;
  contextSize: number;
  runtimeVariant: string;
  enableNativeToolCalls: boolean;
  embeddingPooling: string;
  embeddingBatchSize: number;
  maxParallelJobs: number;
}): string[] {
  // llama-server divides --ctx-size across --parallel slots; Marinara's setting is the per-request budget.
  const totalContextSize = options.contextSize * options.maxParallelJobs;
  const args = [
    "-m",
    options.modelPath,
    "--host",
    "127.0.0.1",
    "--parallel",
    String(options.maxParallelJobs),
    "--ctx-size",
    String(totalContextSize),
    "--port",
    String(options.port),
  ];

  if (options.enableNativeToolCalls) {
    // llama.cpp exposes OpenAI-compatible tool calls when llama-server runs with Jinja chat templates.
    args.push("--jinja");
  }

  // llama.cpp caps the physical batch at the logical batch (2048 by default).
  args.push(
    "--embeddings",
    "--pooling",
    options.embeddingPooling,
    "--batch-size",
    String(Math.max(2048, options.embeddingBatchSize)),
    "--ubatch-size",
    String(options.embeddingBatchSize),
  );

  // Gemma 4 needs split mode disabled on CUDA multi-GPU launches,
  // but non-CUDA builds may reject the flag entirely.
  if (/cuda/i.test(options.runtimeVariant) && options.gpuLayers > 0 && needsCudaSingleGpuSplitMode(options.modelPath)) {
    args.push("-sm", "none");
  }

  args.push("-ngl", String(options.gpuLayers));
  return args;
}

export function buildLlamaStartupPlans(options: {
  configuredGpuLayers: number;
  usesGpuRuntime: boolean;
}): LlamaStartupPlan[] {
  if (options.configuredGpuLayers !== -1) {
    return [{ gpuLayers: options.configuredGpuLayers, label: `gpuLayers=${options.configuredGpuLayers}` }];
  }

  if (!options.usesGpuRuntime) {
    return [{ gpuLayers: 0, label: "CPU runtime" }];
  }

  return [
    { gpuLayers: 999, label: "max GPU offload" },
    { gpuLayers: 0, label: "CPU fallback" },
  ];
}
