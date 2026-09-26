import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { validateLocalGgufPath } from "../../packages/server/src/services/sidecar/sidecar-model-files.js";
import { buildLlamaArgs } from "../../packages/server/src/services/sidecar/sidecar-launch-plan.js";
import { SidecarGpuMemoryReporter } from "../../packages/server/src/services/sidecar/sidecar-gpu-memory.js";

if (process.argv.includes("--reload")) {
  const { sidecarModelService } = await import("../../packages/server/src/services/sidecar/sidecar-model.service.js");
  assert.equal(sidecarModelService.getConfig().kvCacheType, "q4_0");
  assert.equal(sidecarModelService.getModelFilePath(), process.env.GGUF_FIXTURE_PATH);
  assert.equal(sidecarModelService.getResolvedBackend(), "llama_cpp");
  await sidecarModelService.deleteModel();
  assert.equal(existsSync(process.env.GGUF_FIXTURE_PATH!), true, "removal after restart preserves the borrowed file");
} else {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-local-gguf-")));
  process.env.DATA_DIR = join(root, "data");
  try {
    const file = join(root, "existing.gguf");
    const header = Buffer.alloc(24);
    header.write("GGUF");
    header.writeUInt32LE(3, 4);
    writeFileSync(file, header);
    assert.equal(validateLocalGgufPath(file), file);
    assert.throws(() => validateLocalGgufPath("relative.gguf"), /absolute path/);
    const invalid = join(root, "invalid.gguf");
    writeFileSync(invalid, "not a model");
    assert.throws(() => validateLocalGgufPath(invalid), /GGUF header/);
    const directory = join(root, "directory.gguf");
    mkdirSync(directory);
    assert.throws(() => validateLocalGgufPath(directory), /regular file/);
    assert.throws(() => validateLocalGgufPath(join(root, "mmproj.gguf")), /main model GGUF/);
    if (process.platform !== "win32") {
      const projector = join(root, "mmproj.gguf");
      const alias = join(root, "alias.gguf");
      writeFileSync(projector, header);
      symlinkSync(projector, alias);
      assert.throws(() => validateLocalGgufPath(alias), /main model GGUF/);
    }

    const { sidecarModelService, CONFIG_PATH } =
      await import("../../packages/server/src/services/sidecar/sidecar-model.service.js");
    sidecarModelService.selectLocalModel(file);
    assert.equal(sidecarModelService.getModelFilePath(), file);
    sidecarModelService.updateConfig({ kvCacheType: "q4_0" });
    assert.equal(JSON.parse(readFileSync(CONFIG_PATH, "utf8")).externalModelPath, file);
    assert.throws(() => sidecarModelService.selectLocalModel(invalid), /GGUF header/);
    assert.equal(sidecarModelService.getModelFilePath(), file, "an invalid selection preserves the active config");
    const other = join(root, "other.gguf");
    writeFileSync(other, header);
    const savedConfig = `${CONFIG_PATH}.saved`;
    renameSync(CONFIG_PATH, savedConfig);
    mkdirSync(CONFIG_PATH);
    try {
      assert.throws(() => sidecarModelService.selectLocalModel(other));
      assert.equal(sidecarModelService.getModelFilePath(), file, "failed persistence keeps the current selection");
    } finally {
      rmSync(CONFIG_PATH, { recursive: true });
      renameSync(savedConfig, CONFIG_PATH);
    }
    sidecarModelService.selectLocalModel(other);
    assert.equal(existsSync(file), true, "switching preserves the old file");
    const borrowedCacheFile = join(process.env.DATA_DIR, "models", "custom", "fixture__repo__model.gguf");
    mkdirSync(join(process.env.DATA_DIR, "models", "custom"), { recursive: true });
    writeFileSync(borrowedCacheFile, header);
    sidecarModelService.selectLocalModel(borrowedCacheFile);
    const listModels = sidecarModelService.listHuggingFaceModels;
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { ...platform, value: "linux" });
    sidecarModelService.listHuggingFaceModels = async () => [
      {
        path: "model.gguf",
        filename: "model.gguf",
        sizeBytes: 999,
        quantizationLabel: null,
        downloadUrl: "https://example.invalid/model.gguf",
      },
    ];
    try {
      await assert.rejects(
        sidecarModelService.downloadCustomModel("fixture/repo", "model.gguf"),
        /already selected from disk/,
      );
      assert.deepEqual(readFileSync(borrowedCacheFile), header, "downloads cannot overwrite a borrowed cache file");
    } finally {
      sidecarModelService.listHuggingFaceModels = listModels;
      Object.defineProperty(process, "platform", platform);
    }
    sidecarModelService.selectLocalModel(file);
    const restarted = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, "--reload"], {
      env: { ...process.env, GGUF_FIXTURE_PATH: file },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(restarted.status, 0, restarted.stderr || restarted.stdout);
    assert.deepEqual(readFileSync(file), header);

    const options = {
      modelPath: file,
      gpuLayers: 999,
      port: 9999,
      contextSize: 8192,
      runtimeVariant: "cuda",
      enableNativeToolCalls: false,
      embeddingPooling: "none",
      embeddingBatchSize: 512,
      maxParallelJobs: 2,
    };
    assert.deepEqual(
      buildLlamaArgs(options),
      buildLlamaArgs({ ...options, kvCacheType: "f16" }),
      "f16 preserves the existing launch defaults",
    );
    for (const kvCacheType of ["q8_0", "q4_0"] as const) {
      const args = buildLlamaArgs({ ...options, kvCacheType });
      assert.equal(args[args.indexOf("--cache-type-k") + 1], kvCacheType);
      assert.equal(args[args.indexOf("--cache-type-v") + 1], kvCacheType);
      assert.equal(args[args.indexOf("--flash-attn") + 1], "on");
    }

    const reporter = new SidecarGpuMemoryReporter();
    assert.equal(reporter.report(), null);
    reporter.consume("load_tensors: CPU_Mapped model buffer size = 999.00 MiB\n");
    assert.equal(reporter.report(), null, "CPU memory must not become VRAM");
    reporter.consume("load_tensors: CUDA0 model buffer size = 10.00 MiB\nllama_kv_cache: CUDA0 KV buffer size = ");
    reporter.consume("unrelated stdout\n", "stdout");
    reporter.consume("2.00 MiB\nllama_context: CUDA0 compute buffer size = 3.00 MiB\n");
    reporter.consume("llama_context: CUDA_Host output buffer size = 55.00 MiB\n");
    reporter.consume("load_tensors: CUDA1 model buffer size = 5.00 MiB\n");
    reporter.consume("llama_context: CUDA0 compute buffer size = 4.00 MiB\n");
    assert.deepEqual(reporter.report(), {
      weightsBytes: 15 * 1024 ** 2,
      kvCacheBytes: 2 * 1024 ** 2,
      buffersBytes: 4 * 1024 ** 2,
    });
    const metal = new SidecarGpuMemoryReporter();
    metal.consume("load_tensors: Metal_Mapped model buffer size = 8.00 MiB\n");
    assert.deepEqual(metal.report(), { weightsBytes: 8 * 1024 ** 2, kvCacheBytes: null, buffersBytes: null });
    const currentMetal = new SidecarGpuMemoryReporter();
    currentMetal.consume(
      "load_tensors: MTL0_Mapped model buffer size = 8.00 MiB\nllama_kv_cache: MTL0_Private KV buffer size = 2.00 MiB\n",
    );
    assert.deepEqual(currentMetal.report(), {
      weightsBytes: 8 * 1024 ** 2,
      kvCacheBytes: 2 * 1024 ** 2,
      buffersBytes: null,
    });

    process.env.NODE_ENV = "test";
    process.env.MARINARA_LITE = "true";
    process.env.LOG_LEVEL = "silent";
    const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
    const Fastify = requireServer("fastify") as typeof import("fastify").default;
    const { sidecarRoutes } = await import("../../packages/server/src/routes/sidecar.routes.js");
    const { sidecarProcessService } =
      await import("../../packages/server/src/services/sidecar/sidecar-process.service.js");
    const stop = sidecarProcessService.stop;
    const sync = sidecarProcessService.syncForCurrentConfig;
    const downloadCustom = sidecarModelService.downloadCustomModel;
    sidecarProcessService.stop = async () => {};
    let syncs = 0;
    sidecarProcessService.syncForCurrentConfig = async () => {
      syncs++;
    };
    let release = () => {};
    let entered = () => {};
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    sidecarModelService.downloadCustomModel = async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { path: "model.gguf", filename: "model.gguf", sizeBytes: 24, quantizationLabel: null, downloadUrl: "" };
    };
    const app = Fastify();
    const { rateLimitHook, resetRateLimitBucketsForTests } =
      await import("../../packages/server/src/middleware/rate-limit.js");
    app.addHook("onRequest", rateLimitHook);
    const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
    app.decorate("db", await getDB());
    await app.register(sidecarRoutes, { prefix: "/api/sidecar" });
    try {
      const pending = app
        .inject({ method: "POST", url: "/api/sidecar/download/custom", payload: { repo: "fixture/repo" } })
        .then((result) => result);
      await waiting;
      const blocked = await app.inject({ method: "POST", url: "/api/sidecar/model/local", payload: { path: other } });
      assert.equal(blocked.statusCode, 409, "a pending repository lookup reserves the model switch");
      release();
      assert.equal((await pending).statusCode, 200);
      const selected = await app.inject({ method: "POST", url: "/api/sidecar/model/local", payload: { path: other } });
      assert.equal(selected.statusCode, 200, selected.body);
      assert.equal(sidecarModelService.getModelFilePath(), other);
      const removed = join(root, "removed.gguf");
      writeFileSync(removed, header);
      sidecarProcessService.stop = async () => {
        rmSync(removed);
      };
      const previousSyncs = syncs;
      const failed = await app.inject({ method: "POST", url: "/api/sidecar/model/local", payload: { path: removed } });
      assert.equal(failed.statusCode, 400);
      assert.equal(sidecarModelService.getModelFilePath(), other);
      assert.equal(syncs, previousSyncs + 1, "selection failure restores the current runtime configuration");
      resetRateLimitBucketsForTests();
      for (let attempt = 0; attempt < 21; attempt++) {
        const limited = await app.inject({
          method: "POST",
          url: "/api/sidecar/model/local",
          payload: { path: "relative.gguf" },
        });
        assert.equal(limited.headers["ratelimit-limit"], "20");
        assert.equal(
          limited.statusCode,
          attempt < 20 ? 400 : 429,
          "local selection uses the existing privileged sidecar rate limit",
        );
      }
    } finally {
      release();
      await app.close();
      await closeDB();
      sidecarProcessService.stop = stop;
      sidecarProcessService.syncForCurrentConfig = sync;
      sidecarModelService.downloadCustomModel = downloadCustom;
    }
    console.info("Local GGUF persistence, non-destructive removal, KV launch flags and GPU allocation parsing passed.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
