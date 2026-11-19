// ──────────────────────────────────────────────
// Avatar agents: downloading and running the local emotion model (lane: director)
// ──────────────────────────────────────────────
// Horizon-Labs/multilingual-emotions-small (Apache-2.0): mmBERT-small trained on GoEmotions and its 35-language
// translation, with GoEmotions' 28 labels. The four files it needs are pinned by commit, size and SHA-256 and
// downloaded straight from Horizon into DATA_DIR/models/avatar-emotion/<commit>, through the sidecars' checked
// download (a fixed `.download` temp name, so an interrupted download is replaced, never piled up). The model then
// loads from that folder alone, so it works offline once downloaded. It runs in a worker thread
// (emotion-model.worker.ts): loading and inference never block the server while a reply streams.
import { existsSync, rmSync, statSync } from "node:fs";
import { totalmem } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { resolveOnnxRuntimeBindingPath } from "../../local-embedder.js";
import { downloadFileWithProgress, isAbortError, retry } from "../../sidecar/sidecar-download.js";

export const AVATAR_EMOTION_MODEL_ID = "Horizon-Labs/multilingual-emotions-small";
export const AVATAR_EMOTION_MODEL_REVISION = "1bc9627f189e5aa08b00cf525c3c86052067b81e";

/** What text classification with dtype q8 reads, at the pinned commit. */
const MODEL_FILES: ReadonlyArray<{ path: string; size: number; sha256: string }> = [
  { path: "config.json", size: 3_155, sha256: "eefc10c623f645fae334fb2e25d6b7d342cfaa1f6347d12bf432d2ad0edf4e58" },
  {
    path: "tokenizer_config.json",
    size: 46_440,
    sha256: "ea349495764b24570b4560fe2e4a557e5c0a47e6bce782c2409b1d6445cf8633",
  },
  {
    path: "tokenizer.json",
    size: 34_363_286,
    sha256: "4379fe7f4a7af10b1ac15ffc8ae90f446f92082393699e9dd54b8c3b5ec0abad",
  },
  {
    path: "onnx/model_quantized.onnx",
    size: 268_449_278,
    sha256: "7fed4f82f2e1c4039452876e87ef948f5eedfdcf45f351470010e0ed65f1e9ee",
  },
];
export const AVATAR_EMOTION_MODEL_BYTES = MODEL_FILES.reduce((sum, file) => sum + file.size, 0);

/** The model uses about 1.1 GB once loaded; below this much memory it would crowd out the server. */
export const AVATAR_EMOTION_MODEL_MIN_MEMORY_BYTES = 3 * 1024 ** 3;
const MODELS_DIR = join(DATA_DIR, "models");
const MODEL_SUBDIR = `avatar-emotion/${AVATAR_EMOTION_MODEL_REVISION}`;
const MODEL_DIR = join(MODELS_DIR, "avatar-emotion", AVATAR_EMOTION_MODEL_REVISION);
const CLASSIFY_TIMEOUT_MS = 10_000;

/** The loaded model: label scores (0..1 each, multi-label) for one text. */
export interface AvatarEmotionModel {
  classify(text: string): Promise<Record<string, number>>;
  dispose(): Promise<void>;
}

function isLite(): boolean {
  return process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";
}

/** Memory this process may use: the machine's, or a container's limit when that is lower. */
function availableMemoryBytes(): number {
  const constrained = typeof process.constrainedMemory === "function" ? process.constrainedMemory() : 0;
  return constrained > 0 ? Math.min(totalmem(), constrained) : totalmem();
}

/** Why this server keeps the keyword tier, or null when it can run the model. */
export function localEmotionModelUnsupportedReason(): "lite" | "no-runtime" | "low-memory" | null {
  if (isLite()) return "lite";
  const bindingPath = resolveOnnxRuntimeBindingPath();
  if (bindingPath === null || !existsSync(bindingPath)) return "no-runtime";
  if (availableMemoryBytes() < AVATAR_EMOTION_MODEL_MIN_MEMORY_BYTES) return "low-memory";
  return null;
}

function hasFile(file: { path: string; size: number }): boolean {
  try {
    return statSync(join(MODEL_DIR, file.path)).size === file.size;
  } catch {
    return false;
  }
}

/** Every pinned file is on disk at its pinned size (the hash was checked before the file got its name). */
export function isLocalEmotionModelDownloaded(): boolean {
  return MODEL_FILES.every(hasFile);
}

/** Deletes the downloaded files (the Built-in model (emotions) page's Remove files). */
export function removeLocalEmotionModel(): void {
  rmSync(join(MODELS_DIR, "avatar-emotion"), { recursive: true, force: true });
}

/** Downloads the missing files; `onProgress` gets the bytes done of AVATAR_EMOTION_MODEL_BYTES. */
export async function downloadLocalEmotionModel(onProgress: (downloadedBytes: number) => void): Promise<void> {
  let done = MODEL_FILES.filter(hasFile).reduce((sum, file) => sum + file.size, 0);
  onProgress(done);
  for (const file of MODEL_FILES) {
    if (hasFile(file)) continue;
    await retry(
      () =>
        downloadFileWithProgress({
          url: `https://huggingface.co/${AVATAR_EMOTION_MODEL_ID}/resolve/${AVATAR_EMOTION_MODEL_REVISION}/${file.path}`,
          destPath: join(MODEL_DIR, file.path),
          expectedBytes: file.size,
          expectedSha256: file.sha256,
          progress: { phase: "model", label: file.path },
          onProgress: (progress) => onProgress(done + Math.min(progress.downloaded, file.size)),
        }),
      { retries: 3, baseDelayMs: 1_000, shouldRetry: (error) => !isAbortError(error) },
    );
    done += file.size;
    onProgress(done);
  }
}

/** Starts the worker on the downloaded files and resolves once the model is ready. `onLost` runs if a ready worker
 *  stops without being disposed (a crash, or a text it did not answer in time), so the caller can forget the model
 *  and load it again later. */
export function startLocalEmotionModel(onLost?: (error: Error) => void): Promise<AvatarEmotionModel> {
  const worker = new Worker(
    new URL(
      import.meta.url.endsWith(".ts") ? "./emotion-model.worker.ts" : "./emotion-model.worker.js",
      import.meta.url,
    ),
    { workerData: { modelsDir: MODELS_DIR, modelId: MODEL_SUBDIR } },
  );
  // The model never keeps the server running on its own.
  worker.unref();
  const pending = new Map<number, { resolve: (scores: Record<string, number>) => void; reject: (e: Error) => void }>();
  let nextId = 0;
  let ready = false;
  let stopped: Error | null = null;
  const stop = (error: Error) => {
    if (!stopped && ready) onLost?.(error);
    stopped ??= error;
    for (const { reject } of pending.values()) reject(stopped);
    pending.clear();
  };
  return new Promise((resolve, reject) => {
    const model: AvatarEmotionModel = {
      classify(text) {
        if (stopped) return Promise.reject(stopped);
        const id = nextId++;
        return new Promise((resolveText, rejectText) => {
          // A worker that stops answering would hold every later text behind it: stop it (this text and the
          // waiting ones fall back to keywords), and the caller forgets the model and loads it again later.
          const timer = setTimeout(() => {
            stop(new Error("The local emotion model did not answer in time"));
            void worker.terminate();
          }, CLASSIFY_TIMEOUT_MS);
          timer.unref?.();
          pending.set(id, {
            resolve: (scores) => {
              clearTimeout(timer);
              resolveText(scores);
            },
            reject: (error) => {
              clearTimeout(timer);
              rejectText(error);
            },
          });
          worker.postMessage({ id, text });
        });
      },
      async dispose() {
        ready = false;
        stop(new Error("The local emotion model was unloaded"));
        await worker.terminate();
      },
    };
    worker.on("message", (message: { type?: string; id?: number; scores?: Record<string, number>; error?: string }) => {
      if (message.type === "ready") {
        ready = true;
        resolve(model);
      } else if (message.type === "failed") {
        stop(new Error(message.error ?? "The local emotion model failed to load"));
        void worker.terminate();
        reject(stopped);
      } else if (typeof message.id === "number") {
        const waiting = pending.get(message.id);
        pending.delete(message.id);
        if (message.scores) waiting?.resolve(message.scores);
        else waiting?.reject(new Error(message.error ?? "The local emotion model failed on a text"));
      }
    });
    worker.on("error", (error) => {
      stop(error);
      reject(error);
    });
    worker.on("exit", (code) => {
      const error = new Error(`The local emotion model stopped (exit code ${code})`);
      stop(error);
      reject(error);
    });
  });
}
