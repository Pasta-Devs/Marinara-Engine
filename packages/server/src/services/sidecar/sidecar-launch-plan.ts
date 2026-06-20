export type LlamaStartupPlan = {
  gpuLayers: number;
  label: string;
};

const LLAMA_SERVER_PARALLEL_SLOTS = 2;

export function buildLlamaArgs(options: {
  modelPath: string;
  gpuLayers: number;
  port: number;
  contextSize: number;
  runtimeVariant: string;
  enableNativeToolCalls: boolean;
}): string[] {
  // llama-server divides --ctx-size across --parallel slots; Marinara's setting is the per-request budget.
  const totalContextSize = options.contextSize * LLAMA_SERVER_PARALLEL_SLOTS;
  const args = [
    "-m",
    options.modelPath,
    "--host",
    "127.0.0.1",
    "--parallel",
    String(LLAMA_SERVER_PARALLEL_SLOTS),
    "--ctx-size",
    String(totalContextSize),
    "--port",
    String(options.port),
  ];

  if (options.enableNativeToolCalls) {
    // llama.cpp exposes OpenAI-compatible tool calls when llama-server runs with Jinja chat templates.
    args.push("--jinja");
  }

  // Gemma 4 needs split mode disabled on CUDA multi-GPU launches,
  // but non-CUDA builds may reject the flag entirely.
  if (/cuda/i.test(options.runtimeVariant) && options.gpuLayers > 0) {
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
