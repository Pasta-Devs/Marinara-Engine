import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { register } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hunt-b49-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";

// Route @huggingface/transformers to a fake so the Whisper load race can be driven without network or ONNX.
const fakeTransformers =
  "export const env = {}; export const pipeline = (...args) => globalThis.__b49FakePipeline(...args);";
const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === "@huggingface/transformers") {
    return { url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(fakeTransformers)}), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register("data:text/javascript," + encodeURIComponent(hooks));

const root = join(import.meta.dirname, "..", "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf-8");

try {
  // 1. downloadFileWithProgress keeps the existing destination when the new download fails.
  {
    const { downloadFileWithProgress } = await import("../../packages/server/src/services/sidecar/sidecar-download.js");
    let mode: "fail" | "ok" = "fail";
    const server = createServer((_req, res) => {
      if (mode === "fail") {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("boom");
        return;
      }
      res.writeHead(200, { "content-type": "application/octet-stream", "content-length": "9" });
      res.end("new-model");
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/model.gguf`;
    const destPath = join(dataDir, "dl", "model.gguf");
    mkdirSync(join(dataDir, "dl"), { recursive: true });
    writeFileSync(destPath, "old-model");
    try {
      await assert.rejects(downloadFileWithProgress({ url, destPath, progress: { phase: "model", label: "m" } }));
      assert.equal(readFileSync(destPath, "utf-8"), "old-model", "failed download must not delete the installed file");
      assert.equal(existsSync(`${destPath}.download`), false);

      await assert.rejects(
        downloadFileWithProgress({ url, destPath, expectedBytes: 5, progress: { phase: "model", label: "m" } }),
      );
      assert.equal(readFileSync(destPath, "utf-8"), "old-model");

      mode = "ok";
      await downloadFileWithProgress({ url, destPath, progress: { phase: "model", label: "m" } });
      assert.equal(readFileSync(destPath, "utf-8"), "new-model", "verified download replaces the destination");
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  }

  // 2. sidecar model switch: old-file removal is best-effort and runs after the new config is saved.
  {
    const { sidecarModelService, MODELS_DIR } = await import(
      "../../packages/server/src/services/sidecar/sidecar-model.service.js"
    );
    const lockedPrevious = join(MODELS_DIR, "custom", "locked.gguf");
    // A non-empty directory makes unlinkSync throw, standing in for a file held open on Windows.
    mkdirSync(join(lockedPrevious, "inner"), { recursive: true });
    const service = sidecarModelService as unknown as {
      cleanupPreviousModel(previous: Record<string, unknown>, next: Record<string, unknown>): void;
      getConfig(): Record<string, unknown>;
    };
    const base = service.getConfig();
    assert.doesNotThrow(() =>
      service.cleanupPreviousModel(
        { ...base, backend: "llama_cpp", modelPath: "custom/locked.gguf" },
        { ...base, backend: "llama_cpp", modelPath: "custom/next.gguf" },
      ),
    );
    assert.equal(typeof (sidecarModelService as { isDownloadingModel?: unknown }).isDownloadingModel, "function");

    const modelSource = read("packages/server/src/services/sidecar/sidecar-model.service.ts");
    assert.doesNotMatch(
      modelSource,
      /this\.cleanupPreviousModel\(previousConfig, nextConfig\);\s*this\.config = nextConfig;/,
      "cleanupPreviousModel must run after the new config is committed",
    );
    assert.equal(
      (modelSource.match(/this\.saveConfig\(\);\s*this\.cleanupPreviousModel\(previousConfig, nextConfig\);/g) ?? [])
        .length,
      5,
    );

    // 3. process service: no auto-start mid-download, and fallback runtimes use the requested signature.
    const processSource = read("packages/server/src/services/sidecar/sidecar-process.service.ts");
    assert.match(processSource, /if \(!options\.forceStart && sidecarModelService\.isDownloadingModel\(\)\) \{\s*return;/);
    const startLlama = processSource.slice(processSource.indexOf("const requestedSignature"));
    assert.ok(processSource.includes('const requestedSignature = this.buildRuntimeSignature("llama_cpp", runtime, modelPath);'));
    assert.doesNotMatch(startLlama.slice(0, 2500), /buildRuntimeSignature\("llama_cpp", activeRuntime/);
    assert.match(startLlama, /startLlamaForInstalledRuntimeUnlocked\(activeRuntime, modelPath, requestedSignature\)/);
    assert.match(
      startLlama,
      /rememberStartupFailure\(requestedSignature, activeRuntime\.variant, lastError\)/,
    );
  }

  // 4. Whisper loads are serialized, a superseded load is disposed, and delete waits for the load.
  {
    // Relative path: the regression runner uses cwd=packages/server, where the root tsconfig paths do not apply.
    const { SIDECAR_SPEECH_MODELS } = await import("../../packages/shared/src/types/sidecar.js");
    const [modelA, modelB] = SIDECAR_SPEECH_MODELS.map((model) => model.id);
    assert.ok(modelA && modelB);
    const { sidecarSpeechService } = await import(
      "../../packages/server/src/services/sidecar/sidecar-speech.service.js"
    );
    const speech = sidecarSpeechService as unknown as {
      isAvailable(): boolean;
      pipeline: unknown;
      loadPipeline(modelId: string, options: { localFilesOnly: boolean }): Promise<unknown>;
      status: string;
    };
    speech.isAvailable = () => true;

    type Pending = { repo: string; resolve: (value: unknown) => void; disposed: boolean };
    const pending: Pending[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    (globalThis as Record<string, unknown>).__b49FakePipeline = (_task: string, repo: string) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return new Promise((resolveLoad) => {
        const entry: Pending = { repo, disposed: false, resolve: () => undefined };
        const pipe = Object.assign(async () => ({ text: "" }), {
          repo,
          dispose: async () => {
            entry.disposed = true;
          },
        });
        entry.resolve = () => {
          concurrent -= 1;
          resolveLoad(pipe);
        };
        pending.push(entry);
      });
    };
    const flush = async () => {
      for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
    };

    const loadA = speech.loadPipeline(modelA, { localFilesOnly: false });
    await flush();
    const loadB = speech.loadPipeline(modelB, { localFilesOnly: false });
    await flush();
    assert.equal(pending.length, 1, "load of a second model must wait for the first");
    pending[0]!.resolve(undefined);
    await loadA;
    await flush();
    assert.equal(pending.length, 2);
    assert.equal(pending[0]!.disposed, true, "first pipeline is disposed before the second model loads");
    pending[1]!.resolve(undefined);
    const pipeB = (await loadB) as { repo: string };
    assert.equal(pipeB, speech.pipeline);
    assert.equal(maxConcurrent, 1, "two Whisper loads must never run at once");

    // deleteModel during a load discards the in-flight result instead of restoring the model.
    const loadA2 = speech.loadPipeline(modelA, { localFilesOnly: false });
    await flush();
    const deleting = sidecarSpeechService.deleteModel(modelA as never);
    await flush();
    pending[2]!.resolve(undefined);
    await assert.rejects(loadA2, /superseded/);
    await deleting;
    assert.equal(pending[2]!.disposed, true, "superseded pipeline is disposed");
    assert.equal(speech.pipeline, null);
    assert.notEqual(sidecarSpeechService.getStatus().config.modelId, modelA);

    // Review problem 2: a transcription during a download of another model must not stall behind it
    // or revert the user's new choice to the stale configured model.
    const repoOf = (id: string) => SIDECAR_SPEECH_MODELS.find((model) => model.id === id)!.repoId;
    const cacheDir = (id: string) => join(dataDir, "models", ...repoOf(id).split("/"));
    for (const id of [modelA, modelB]) {
      mkdirSync(cacheDir(id), { recursive: true });
      writeFileSync(join(cacheDir(id), "weights.bin"), "x");
    }
    const wav = Buffer.alloc(44 + 3200);
    wav.write("RIFF", 0, "ascii");
    wav.writeUInt32LE(36 + 3200, 4);
    wav.write("WAVE", 8, "ascii");
    wav.write("fmt ", 12, "ascii");
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24);
    wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36, "ascii");
    wav.writeUInt32LE(3200, 40);

    const loadA3 = speech.loadPipeline(modelA, { localFilesOnly: false });
    await flush();
    pending.at(-1)!.resolve(undefined);
    await loadA3;
    assert.equal(sidecarSpeechService.getStatus().config.modelId, modelA);

    const downloadB = speech.loadPipeline(modelB, { localFilesOnly: false });
    await flush();
    const pendingBeforeTranscribe = pending.length;
    await assert.rejects(sidecarSpeechService.transcribeWav(wav), /downloading a model/);
    await flush();
    assert.equal(pending.length, pendingBeforeTranscribe, "transcription must not queue a load of the stale model");
    pending.at(-1)!.resolve(undefined);
    await downloadB;
    await flush();
    assert.equal(sidecarSpeechService.getStatus().config.modelId, modelB, "the downloaded model stays chosen");
    assert.equal(await sidecarSpeechService.transcribeWav(wav), "");
    assert.equal(pending.length, pendingBeforeTranscribe, "transcription reuses the new model's pipeline");
    assert.equal(sidecarSpeechService.getStatus().config.modelId, modelB);

    // Review problem 3: deleting another model does not cancel an unrelated in-flight download.
    const downloadA = speech.loadPipeline(modelA, { localFilesOnly: false });
    await flush();
    await sidecarSpeechService.deleteModel(modelB as never);
    assert.equal(existsSync(cacheDir(modelB)), false, "the deleted model's cache is removed");
    assert.equal(speech.status, "downloading_model", "the other download's status is left alone");
    pending.at(-1)!.resolve(undefined);
    await downloadA;
    assert.equal(pending.at(-1)!.disposed, false);
    assert.equal(sidecarSpeechService.getStatus().config.modelId, modelA);
  }

  console.log("server-hunt-b49 regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
