/**
 * The built-in embedding model: a small search model in its own llama-server.
 *
 * Built like the utility slot: its own config file and model directory under data/models/builtin-embedding, its
 * own process on its own port, and the llama.cpp runtime the built-in model installed, borrowed read-only. It
 * never reads or writes the built-in model's config, files or process, and never installs the runtime itself.
 *
 * The process starts on the first embedding request and stops itself after a while unused, so it only holds
 * memory while semantic search is actually working. Unload stops it at once.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  BUILTIN_EMBEDDING_MODELS,
  type BuiltinEmbeddingDevice,
  type BuiltinEmbeddingInstalledModel,
  type BuiltinEmbeddingModelId,
  type BuiltinEmbeddingModelInfo,
  type BuiltinEmbeddingStatus,
  type SidecarDownloadProgress,
} from "@marinara-engine/shared";
import { runWithRootLogContext } from "../../lib/log-context.js";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { estimateSlotBytes, getMeasuredProcessBytes } from "./sidecar-footprint.js";
import { localModelManager } from "./local-model-manager.js";
import { buildLlamaArgs, buildLlamaStartupPlans } from "./sidecar-launch-plan.js";
import { downloadFileWithProgress, isAbortError } from "./sidecar-download.js";
import { sidecarRuntimeService } from "./sidecar-runtime.service.js";

const EMBEDDING_DIR = join(getDataDir(), "models", "builtin-embedding");
const CONFIG_PATH = join(EMBEDDING_DIR, "builtin-embedding-config.json");
const isLite = process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";
const READY_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 120_000;
/** Room left for the special tokens llama.cpp adds around a text. */
const TOKEN_MARGIN = 8;

interface BuiltinEmbeddingConfig {
  activeModelId: BuiltinEmbeddingModelId | null;
  device: BuiltinEmbeddingDevice;
  installed: Partial<Record<BuiltinEmbeddingModelId, BuiltinEmbeddingInstalledModel>>;
}

const DEFAULT_CONFIG: BuiltinEmbeddingConfig = { activeModelId: null, device: "auto", installed: {} };

export function findBuiltinEmbeddingModel(id: unknown): BuiltinEmbeddingModelInfo | null {
  return BUILTIN_EMBEDDING_MODELS.find((model) => model.id === id) ?? null;
}

function modelPath(model: BuiltinEmbeddingModelInfo): string {
  const root = resolve(EMBEDDING_DIR);
  const target = resolve(join(root, model.id, model.file));
  if (!target.startsWith(`${root}${sep}`)) throw new Error("Embedding model path escapes its directory");
  return target;
}

/** Resident memory of a process on Linux; null elsewhere. */
function residentBytes(pid: number | null): number | null {
  if (!pid || process.platform !== "linux") return null;
  try {
    const match = /VmRSS:\s+(\d+)\s+kB/u.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class BuiltinEmbeddingService {
  private config: BuiltinEmbeddingConfig = { ...DEFAULT_CONFIG };
  private child: ChildProcess | null = null;
  private runningModelId: BuiltinEmbeddingModelId | null = null;
  private port: number | null = null;
  private ready = false;
  private error: string | null = null;
  private starting: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  /** GPU layers the running process was started with, so its memory is weighed against the right pool. */
  private runningGpuLayers: number | null = null;
  private download: (SidecarDownloadProgress & { modelId: BuiltinEmbeddingModelId }) | null = null;
  private downloadAbort: AbortController | null = null;
  /** Last lines llama-server printed, for a start that fails. */
  private recentOutput: string[] = [];

  constructor() {
    this.config = this.readConfig();
  }

  // ── configuration ───────────────────────────────────────────────────────────
  private readConfig(): BuiltinEmbeddingConfig {
    try {
      if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG, installed: {} };
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<BuiltinEmbeddingConfig>;
      const installed: BuiltinEmbeddingConfig["installed"] = {};
      for (const model of BUILTIN_EMBEDDING_MODELS) {
        const entry = parsed.installed?.[model.id];
        if (entry && typeof entry.file === "string") installed[model.id] = entry;
      }
      const active = findBuiltinEmbeddingModel(parsed.activeModelId)?.id ?? null;
      return {
        installed,
        activeModelId: active && installed[active] ? active : null,
        device: parsed.device === "cpu" ? "cpu" : "auto",
      };
    } catch (error) {
      logger.warn(error, "[builtin-embedding] Unreadable config; starting from defaults");
      return { ...DEFAULT_CONFIG, installed: {} };
    }
  }

  private writeConfig(): void {
    mkdirSync(EMBEDDING_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, `${JSON.stringify(this.config, null, 2)}\n`, "utf8");
  }

  isSupported(): boolean {
    return !isLite;
  }

  /** The model embeddings use, when its file is on disk. */
  getActiveModel(): BuiltinEmbeddingModelInfo | null {
    const model = findBuiltinEmbeddingModel(this.config.activeModelId);
    if (!model || !this.config.installed[model.id]) return null;
    return existsSync(modelPath(model)) ? model : null;
  }

  getStatus(): BuiltinEmbeddingStatus {
    const pid = this.child?.pid ?? null;
    const running = this.ready && !!this.child;
    // Memory on the GPU when it is there, else what the process holds in RAM.
    const memoryBytes = running ? (getMeasuredProcessBytes(pid) ?? residentBytes(pid)) : null;
    return {
      supported: this.isSupported(),
      models: [...BUILTIN_EMBEDDING_MODELS],
      installed: { ...this.config.installed },
      activeModelId: this.getActiveModel()?.id ?? null,
      device: this.config.device,
      runtimeInstalled: !!sidecarRuntimeService.getCurrentInstall()?.serverPath,
      running,
      starting: !!this.starting,
      pid: running ? pid : null,
      memoryBytes,
      error: this.error,
      download: this.download ? { ...this.download } : null,
    };
  }

  // ── files ─────────────────────────────────────────────────────────────────
  /**
   * Reserve the one download slot for a model and return the download itself, so a caller can report "downloading"
   * at once and run the download later. Throws when a download is already running.
   */
  startDownload(modelId: BuiltinEmbeddingModelId): () => Promise<void> {
    const model = findBuiltinEmbeddingModel(modelId);
    if (!model) throw new Error("Unknown embedding model");
    if (!this.isSupported()) throw new Error("The built-in embedding model is not available in Marinara Lite.");
    if (this.downloadAbort) throw new Error("Another embedding model is downloading.");
    const abort = new AbortController();
    this.downloadAbort = abort;
    const progress = { phase: "model" as const, label: model.label, modelId: model.id };
    this.download = { ...progress, status: "downloading", downloaded: 0, total: model.downloadSizeBytes, speed: 0 };
    return async () => {
      try {
        // Never replace a file under a running server.
        if (this.runningModelId === model.id) await this.stop();
        await downloadFileWithProgress({
          url: `https://huggingface.co/${model.repo}/resolve/main/${encodeURIComponent(model.file)}`,
          destPath: modelPath(model),
          expectedBytes: model.downloadSizeBytes,
          expectedSha256: model.sha256,
          signal: abort.signal,
          progress,
          onProgress: (next) => {
            // The final "complete" report waits for the model to be put in use below.
            if (next.status === "downloading") this.download = { ...next, modelId: model.id };
          },
        });
        this.config.installed[model.id] = {
          file: model.file,
          bytes: statSync(modelPath(model)).size,
          downloadedAt: new Date().toISOString(),
        };
        await this.useModel(model.id);
        this.download = null;
        logger.info("[builtin-embedding] Downloaded %s", model.label);
      } catch (error) {
        const cancelled = abort.signal.aborted || isAbortError(error);
        this.download = cancelled
          ? null
          : {
              ...progress,
              status: "error",
              downloaded: 0,
              total: model.downloadSizeBytes,
              speed: 0,
              error: errorMessage(error),
            };
        throw cancelled ? new Error("Download cancelled") : error;
      } finally {
        this.downloadAbort = null;
      }
    };
  }

  /** Download a model and make it the one embeddings use. */
  async downloadModel(modelId: BuiltinEmbeddingModelId): Promise<void> {
    await this.startDownload(modelId)();
  }

  cancelDownload(): void {
    this.downloadAbort?.abort();
  }

  /** Choose which installed model embeddings use. A running process holding another model stops. */
  async useModel(modelId: BuiltinEmbeddingModelId): Promise<void> {
    const model = findBuiltinEmbeddingModel(modelId);
    if (!model || !this.config.installed[model.id]) throw new Error("That embedding model is not downloaded");
    if (this.config.activeModelId !== model.id) {
      this.config.activeModelId = model.id;
      this.writeConfig();
    }
    if (this.child && this.runningModelId !== model.id) await this.stop();
  }

  /** Remove a model's files, stopping it first. The other model, if downloaded, takes over. */
  async removeModel(modelId: BuiltinEmbeddingModelId): Promise<void> {
    const model = findBuiltinEmbeddingModel(modelId);
    if (!model) throw new Error("Unknown embedding model");
    if (this.runningModelId === model.id) await this.stop();
    delete this.config.installed[model.id];
    if (this.config.activeModelId === model.id) {
      this.config.activeModelId = BUILTIN_EMBEDDING_MODELS.find((entry) => this.config.installed[entry.id])?.id ?? null;
    }
    this.writeConfig();
    if (this.download?.modelId === model.id && this.download.status === "error") this.download = null;
    try {
      rmSync(resolve(join(EMBEDDING_DIR, model.id)), { recursive: true, force: true });
    } catch (error) {
      logger.warn(error, "[builtin-embedding] Could not remove the model directory");
    }
  }

  async setDevice(device: BuiltinEmbeddingDevice): Promise<void> {
    if (this.config.device === device) return;
    this.config.device = device;
    this.writeConfig();
    // The next request starts it again on the new device.
    if (this.child) await this.stop();
  }

  // ── process ───────────────────────────────────────────────────────────────
  private static allocatePort(): Promise<number> {
    return new Promise((resolvePort, reject) => {
      const server = createServer();
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close(() => reject(new Error("Failed to allocate a localhost port")));
          return;
        }
        const port = address.port;
        server.close((error) => (error ? reject(error) : resolvePort(port)));
      });
    });
  }

  /** Start the process for the active model unless it already runs; returns its base URL and that model. */
  async ensureRunning(): Promise<{ baseUrl: string; model: BuiltinEmbeddingModelInfo }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (this.stopping) await this.stopping;
      const wanted = this.getActiveModel();
      if (!wanted) throw new Error("No built-in embedding model is downloaded");
      if (this.ready && this.child && this.port && this.runningModelId === wanted.id) {
        return { baseUrl: `http://127.0.0.1:${this.port}`, model: wanted };
      }
      if (this.child && this.runningModelId !== wanted.id) await this.stop();
      if (!this.starting) {
        this.starting = runWithRootLogContext({}, () => this.start(wanted)).finally(() => {
          this.starting = null;
        });
      }
      await this.starting;
      // Someone switched model while that start ran: go round and start the right one.
      if (this.ready && this.runningModelId !== this.getActiveModel()?.id) continue;
      if (!this.ready) throw new Error(this.error ?? "The built-in embedding model did not start");
    }
    const running = findBuiltinEmbeddingModel(this.runningModelId);
    if (this.ready && this.port && running) return { baseUrl: `http://127.0.0.1:${this.port}`, model: running };
    throw new Error(this.error ?? "The built-in embedding model did not start");
  }

  private async start(model: BuiltinEmbeddingModelInfo): Promise<void> {
    this.error = null;
    const runtime = sidecarRuntimeService.getCurrentInstall();
    if (!runtime?.serverPath) {
      this.error = "The llama.cpp runtime is not installed yet. Download the built-in model once to install it.";
      return;
    }
    // Make room first: other built-in models that are not working on anything step aside.
    await localModelManager.prepareToLoad("embedding", this.footprintBytes(), this.placement());
    const plans =
      this.config.device === "cpu"
        ? [{ gpuLayers: 0, label: "CPU" }]
        : buildLlamaStartupPlans({
            configuredGpuLayers: -1,
            usesGpuRuntime: sidecarRuntimeService.isGpuVariant(runtime.variant),
          });

    for (const [index, plan] of plans.entries()) {
      const port = await BuiltinEmbeddingService.allocatePort();
      const args = buildLlamaArgs({
        modelPath: modelPath(model),
        gpuLayers: plan.gpuLayers,
        port,
        contextSize: model.contextSize,
        runtimeVariant: runtime.variant,
        enableNativeToolCalls: false,
        embeddingPooling: model.pooling,
        embeddingBatchSize: model.physicalBatch,
        maxParallelJobs: 1,
      });
      this.recentOutput = [];
      this.runningGpuLayers = plan.gpuLayers;
      const child = spawn(runtime.serverPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      const remember = (chunk: Buffer) => {
        for (const line of chunk.toString("utf8").split(/\r?\n/u)) {
          if (line.trim()) this.recentOutput.push(line.trim());
        }
        if (this.recentOutput.length > 20) this.recentOutput.splice(0, this.recentOutput.length - 20);
      };
      child.stdout?.on("data", remember);
      child.stderr?.on("data", remember);
      this.child = child;
      this.port = port;
      this.runningModelId = model.id;
      child.on("exit", (code) => {
        logger.info(`[builtin-embedding] llama-server exited (${code})`);
        if (this.child === child) {
          this.child = null;
          this.port = null;
          this.ready = false;
          this.runningModelId = null;
          localModelManager.noteStopped("embedding");
        }
      });
      let spawnError: string | null = null;
      child.on("error", (error) => {
        spawnError = error.message;
        logger.warn(error, "[builtin-embedding] llama-server failed to start");
      });

      const waitReason = await this.waitUntilReady(child, port, () => spawnError);
      if (this.ready) {
        // A plan that failed before this one (the graphics card) left its reason; this one is serving.
        this.error = null;
        logger.info(`[builtin-embedding] ${model.label} ready on 127.0.0.1:${port} (${plan.label})`);
        // Unloaded after the Engine-wide "Unload when unused" time, like the other built-in models.
        localModelManager.noteLoaded("embedding");
        return;
      }
      // llama-server's own last lines say why (a missing library, a flag the build rejects), and a failed spawn
      // carries the system's reason (no such file, no permission); the wait only says when.
      const reason: string = this.recentOutput.slice(-3).join(" ") || spawnError || waitReason || "";
      await this.stop();
      this.error = reason || "The built-in embedding model did not start";
      if (index < plans.length - 1) logger.warn(`[builtin-embedding] ${plan.label} failed (${this.error}); trying CPU`);
    }
  }

  /** Resolves null once ready, or with why it is not. */
  private async waitUntilReady(
    child: ChildProcess,
    port: number,
    spawnError: () => string | null,
  ): Promise<string | null> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (spawnError()) return "The embedding model could not be started";
      if (this.child !== child || child.exitCode !== null) return "The embedding model exited while starting";
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          this.ready = true;
          return null;
        }
      } catch {
        // still loading
      }
      await new Promise((wait) => setTimeout(wait, 500));
    }
    return "The embedding model did not become ready in time";
  }

  /** Up and serving; a process still starting is not counted, so it is never unloaded mid-start. */
  isLoaded(): boolean {
    return this.ready && !!this.child;
  }

  /** Where the model runs (or would): the graphics card when the runtime has one, unless set to CPU. */
  placement(): "gpu" | "cpu" {
    if (this.child && this.runningGpuLayers !== null) return this.runningGpuLayers === 0 ? "cpu" : "gpu";
    if (this.config.device === "cpu") return "cpu";
    const runtime = sidecarRuntimeService.getCurrentInstall();
    return runtime && sidecarRuntimeService.isGpuVariant(runtime.variant) ? "gpu" : "cpu";
  }

  /** Memory it holds while running, or what the active model is expected to want. */
  footprintBytes(): number | null {
    const pid = this.child?.pid ?? null;
    if (this.ready && pid) {
      const measured = this.runningGpuLayers === 0 ? residentBytes(pid) : getMeasuredProcessBytes(pid);
      if (measured) return measured;
    }
    const model = this.getActiveModel();
    if (!model) return null;
    return estimateSlotBytes({
      fileBytes: this.config.installed[model.id]?.bytes ?? model.downloadSizeBytes,
      contextSize: model.contextSize,
    });
  }

  /** Stop the process and wait until it is gone. Unload, and every switch of model or device, go through here. */
  async stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    // An old start failure no longer describes a stopped model; a failed start sets its reason again after this.
    this.error = null;
    localModelManager.noteStopped("embedding");
    const child = this.child;
    this.child = null;
    this.ready = false;
    this.port = null;
    this.runningModelId = null;
    // A process that never spawned has no pid and will never report an exit.
    if (!child || child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    this.stopping = (async () => {
      const exited = new Promise<void>((done) => {
        child.once("exit", () => done());
        child.once("error", () => done());
      });
      const waitFor = (ms: number) => {
        let timer: NodeJS.Timeout;
        const timeout = new Promise<"timeout">((done) => {
          timer = setTimeout(() => done("timeout"), ms);
        });
        return Promise.race([exited.then(() => "exited" as const), timeout]).finally(() => clearTimeout(timer));
      };
      child.kill();
      if ((await waitFor(5_000)) === "timeout") {
        child.kill("SIGKILL");
        await waitFor(5_000);
      }
    })().finally(() => {
      this.stopping = null;
    });
    return this.stopping;
  }

  // ── embeddings ────────────────────────────────────────────────────────────
  private async post(baseUrl: string, path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Built-in embedding model error (${response.status}): ${text.slice(0, 300)}`);
    }
    return response.json();
  }

  /** Cut a text that would not fit the model's context to its first tokens. Short texts are left alone. */
  private async fit(baseUrl: string, text: string, limit: number, signal?: AbortSignal): Promise<string> {
    // Every token covers at least one byte, so a text this short always fits.
    if (Buffer.byteLength(text, "utf8") <= limit) return text;
    const tokenized = (await this.post(baseUrl, "/tokenize", { content: text }, signal)) as { tokens?: number[] };
    const tokens = Array.isArray(tokenized.tokens) ? tokenized.tokens : [];
    if (tokens.length <= limit) return text;
    const cut = (await this.post(baseUrl, "/detokenize", { tokens: tokens.slice(0, limit) }, signal)) as {
      content?: string;
    };
    return typeof cut.content === "string" && cut.content ? cut.content : text.slice(0, limit);
  }

  /** Embed texts (already carrying any query/document prefix) with the active model. */
  /**
   * `expectedModelId`: the model the caller prepared the texts for (prefixes) and files the vectors under. A switch
   * in between fails the request instead of returning vectors from another embedding space.
   */
  async embed(texts: string[], signal?: AbortSignal, expectedModelId?: BuiltinEmbeddingModelId): Promise<number[][]> {
    if (texts.length === 0) return [];
    // Counts as use, so the model is not unloaded for being idle mid-request.
    const end = localModelManager.begin("embedding");
    try {
      const { baseUrl, model } = await this.ensureRunning();
      if (expectedModelId && model.id !== expectedModelId) {
        throw new Error("The built-in embedding model was switched during this request; try again");
      }
      const limit = model.contextSize - TOKEN_MARGIN;
      const inputs: string[] = [];
      for (const text of texts) inputs.push(await this.fit(baseUrl, text, limit, signal));
      const json = (await this.post(baseUrl, "/v1/embeddings", { input: inputs, model: model.label }, signal)) as {
        data?: Array<{ index?: number; embedding?: unknown }>;
      };
      const rows = Array.isArray(json.data) ? [...json.data] : [];
      rows.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
      const vectors = rows.map((row) => row.embedding);
      if (
        vectors.length !== texts.length ||
        vectors.some((vector) => !Array.isArray(vector) || vector.some((value) => typeof value !== "number"))
      ) {
        throw new Error("The built-in embedding model returned an unexpected response");
      }
      return vectors as number[][];
    } finally {
      end();
    }
  }
}

export const builtinEmbeddingService = new BuiltinEmbeddingService();

localModelManager.register({
  id: "embedding",
  label: () => builtinEmbeddingService.getActiveModel()?.label ?? "The built-in embedding model",
  isLoaded: () => builtinEmbeddingService.isLoaded(),
  footprintBytes: () => builtinEmbeddingService.footprintBytes(),
  placement: () => builtinEmbeddingService.placement(),
  unload: () => builtinEmbeddingService.stop(),
});
