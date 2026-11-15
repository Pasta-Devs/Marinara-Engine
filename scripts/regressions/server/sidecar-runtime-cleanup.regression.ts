/**
 * The llama.cpp runtime's cleanup removes only its own folders (#6982). A reinstall or an
 * update must not delete the decision model (`decision`) or the MLX runtime (`mlx`) that
 * live beside it in `<data>/sidecar-runtime`.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workDir = mkdtempSync(join(tmpdir(), "marinara-runtime-cleanup-"));
process.env.DATA_DIR = join(workDir, "data");
process.env.FILE_STORAGE_DIR = join(workDir, "storage");
process.env.LOG_LEVEL = "silent";

try {
  const { sidecarRuntimeService } =
    await import("../../../packages/server/src/services/sidecar/sidecar-runtime.service.js");
  const runtimeDir = join(process.env.DATA_DIR, "sidecar-runtime");
  const model = join(runtimeDir, "decision", "hf-home", "model.safetensors");
  const seed = () => {
    for (const dir of [
      "decision/hf-home",
      "mlx",
      "b10188-linux-x64-vulkan",
      "b9000-linux-x64-cpu",
      "b10188-linux-x64-vulkan.extract-ab12",
    ])
      mkdirSync(join(runtimeDir, dir), { recursive: true });
    writeFileSync(model, "weights");
    writeFileSync(join(runtimeDir, "llama-b10188-bin-ubuntu-vulkan-x64.zip"), "archive");
    writeFileSync(join(runtimeDir, "cudart-llama-bin-win-cuda-13.3-x64.zip"), "archive");
    // Another runtime's download beside them is not this service's to remove either.
    writeFileSync(join(runtimeDir, "other-runtime.zip"), "archive");
    writeFileSync(join(runtimeDir, "server.log"), "log");
  };

  // An install or an update keeps only the runtime it just installed.
  seed();
  (sidecarRuntimeService as unknown as { cleanupBundledArtifacts(keep?: string): void }).cleanupBundledArtifacts(
    "b10188-linux-x64-vulkan",
  );
  assert.deepEqual(
    readdirSync(runtimeDir).sort(),
    ["b10188-linux-x64-vulkan", "decision", "mlx", "other-runtime.zip", "server.log"],
    "an update removes the old runtime and its own download leftovers, and nothing else",
  );
  assert.ok(existsSync(model), "the decision model survives an update");

  // Reinstall runtime removes every llama.cpp runtime, and still nothing else.
  seed();
  sidecarRuntimeService.resetRuntime();
  assert.deepEqual(readdirSync(runtimeDir).sort(), ["decision", "mlx", "other-runtime.zip", "server.log"]);
  assert.ok(existsSync(model), "the decision model survives Reinstall runtime");
  console.log("Sidecar runtime cleanup regression passed.");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
