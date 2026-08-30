/**
 * The utility model slot: a second llama-server, independent of the main sidecar.
 *
 * Everything here is additive. It keeps its own config file and model directory, and
 * it spawns its own process on its own port. The only thing it borrows from the main
 * sidecar is the installed llama.cpp runtime, read-only — it will use that runtime if
 * it is already there and refuse to start if it is not, rather than installing,
 * reinstalling or resetting anything the main slot depends on.
 *
 * It never reads or writes sidecar-config.json, never touches data/models outside its
 * own subdirectory, and never stops or restarts the main process.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import {
  UTILITY_SIDECAR_DEFAULT_CONFIG,
  UTILITY_SIDECAR_LIMITS,
  type UtilitySidecarConfig,
  type UtilitySidecarHardwareSettings,
  type UtilitySidecarModelSource,
  type UtilitySidecarStatus,
  type UtilitySidecarUpdateCheck,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { buildLlamaArgs, buildLlamaStartupPlans } from "../sidecar/sidecar-launch-plan.js";
import { downloadFileWithProgress, fetchJson } from "../sidecar/sidecar-download.js";
import { sidecarRuntimeService } from "../sidecar/sidecar-runtime.service.js";
import type { SidecarDownloadProgress } from "@marinara-engine/shared";

/** Own directory. Never data/models itself, which the main slot owns. */
const UTILITY_DIR = join(getDataDir(), "models", "utility");
const CONFIG_PATH = join(UTILITY_DIR, "utility-sidecar-config.json");

const HF_API = "https://huggingface.co/api/models";

/**
 * Does a slot in this state serve `agentType`?
 *
 * The binding is the model id: a model installed as "beholder" serves the beholder
 * agent. One rule, derived from the same status the UI reads, so what the operator is
 * shown and what actually routes cannot disagree.
 *
 * Requires `ready`, so a configured-but-down slot falls back to the agent's own
 * connection instead of failing the run.
 */
export function utilitySlotServesAgent(
  status: Pick<UtilitySidecarStatus, "activeModelId" | "models" | "runtimeInstalled">,
  agentType: string,
): boolean {
  if (!status.activeModelId || status.activeModelId !== agentType) return false;
  // Selected is enough — the process starts on demand. Requiring it to be already
  // running would hand the agent back to its paid connection after every restart,
  // silently, which is the failure this slot exists to avoid.
  return !!status.models[agentType] && status.runtimeInstalled;
}

/**
 * Compare an installed blob id against the published one.
 *
 * Size is deliberately not a tiebreaker: a requantization can land on the same byte
 * count, and the operator is being asked to spend a download. When the ids cannot be
 * compared this reports `indeterminate` rather than implying the copy is current.
 */
export function compareModelVersions(
  installedOid: string | null,
  availableOid: string | null,
): { updateAvailable: boolean; indeterminate: boolean } {
  const comparable = Boolean(installedOid && availableOid);
  return {
    updateAvailable: comparable ? installedOid !== availableOid : false,
    indeterminate: !comparable,
  };
}

interface HuggingFaceTreeEntry {
  type?: string;
  path?: string;
  size?: number;
  oid?: string;
  lfs?: { size?: number; oid?: string };
}

/** A repo path is "owner/name" and nothing else — no traversal, no absolute paths. */
function isValidRepo(repo: string): boolean {
  return /^[^/\s]+\/[^/\s]+$/.test(repo.trim());
}

/** A model file is a plain .gguf name; never a path that could escape the directory. */
function isValidModelFile(file: string): boolean {
  return /^[A-Za-z0-9._-]+\.gguf$/.test(file.trim());
}

function assertInsideUtilityDir(candidate: string): string {
  const root = resolve(UTILITY_DIR);
  const target = resolve(candidate);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Utility model path escapes its directory");
  }
  return target;
}

/**
 * A model id is a plain name, and it is rejected rather than normalized.
 *
 * Normalizing was a trap: "a/b" and "a_b" collapsed onto the same directory, and an
 * empty id resolved to the utility root itself — so removing it would have taken the
 * whole directory with it.
 */
function assertValidModelId(modelId: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(modelId) || modelId === "." || modelId === "..") {
    throw new Error(`Invalid utility model id: ${JSON.stringify(modelId)}`);
  }
  return modelId;
}

function modelDirPath(modelId: string): string {
  return assertInsideUtilityDir(join(UTILITY_DIR, assertValidModelId(modelId)));
}

function modelFilePath(modelId: string, file: string): string {
  if (!isValidModelFile(file)) throw new Error(`Invalid utility model file: ${JSON.stringify(file)}`);
  return assertInsideUtilityDir(join(modelDirPath(modelId), file));
}

export class UtilitySidecarService {
  private config: UtilitySidecarConfig = { ...UTILITY_SIDECAR_DEFAULT_CONFIG };
  private child: ChildProcess | null = null;
  /** Which model the running child actually loaded, so a stale one is never reused. */
  private runningModelId: string | null = null;
  private port: number | null = null;
  private ready = false;
  private startupError: string | null = null;
  private starting: Promise<void> | null = null;
  /** In-progress shutdown, so a start cannot race a process that is still exiting. */
  private stopping: Promise<void> | null = null;

  constructor() {
    this.config = this.readConfig();
  }

  // ── configuration ─────────────────────────────────────────────────────────
  private readConfig(): UtilitySidecarConfig {
    try {
      if (!existsSync(CONFIG_PATH)) return { ...UTILITY_SIDECAR_DEFAULT_CONFIG };
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<UtilitySidecarConfig>;
      return {
        ...UTILITY_SIDECAR_DEFAULT_CONFIG,
        ...parsed,
        models: parsed.models && typeof parsed.models === "object" ? parsed.models : {},
      };
    } catch (error) {
      logger.warn(error, "[utility-sidecar] Unreadable config; starting from defaults");
      return { ...UTILITY_SIDECAR_DEFAULT_CONFIG };
    }
  }

  private writeConfig(): void {
    mkdirSync(UTILITY_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, `${JSON.stringify(this.config, null, 2)}\n`, "utf8");
  }

  getConfig(): UtilitySidecarConfig {
    return { ...this.config, models: { ...this.config.models } };
  }

  getStatus(): UtilitySidecarStatus {
    return {
      configured: Object.keys(this.config.models).length > 0,
      activeModelId: this.config.activeModelId,
      models: { ...this.config.models },
      ready: this.ready,
      baseUrl: this.ready && this.port ? `http://127.0.0.1:${this.port}` : null,
      error: this.startupError,
      // Read-only probe. Installing the runtime stays the main sidecar's job.
      runtimeInstalled: !!sidecarRuntimeService.getCurrentInstall()?.serverPath,
      settings: {
        contextSize: this.config.contextSize,
        gpuLayers: this.config.gpuLayers,
        maxParallelJobs: this.config.maxParallelJobs,
      },
    };
  }

  /**
   * Does this slot currently serve `agentType`?
   *
   * The binding is the model id: a model installed as "beholder" serves the beholder
   * agent. One rule, visible in the status payload, and no second mapping to fall out
   * of sync with the installed set.
   *
   * True as soon as a model is selected and its runtime exists; the process is started
   * on demand. If that start fails the caller falls back to the agent's own connection
   * rather than failing the run.
   */
  servesAgent(agentType: string): boolean {
    return utilitySlotServesAgent(this.getStatus(), agentType);
  }

  // ── model installation ────────────────────────────────────────────────────
  /** The file list for a repo, with the blob id that identifies each version. */
  private async listRepoFiles(repo: string): Promise<HuggingFaceTreeEntry[]> {
    const entries = await fetchJson<HuggingFaceTreeEntry[]>(`${HF_API}/${encodeURI(repo)}/tree/main?recursive=1`);
    return Array.isArray(entries) ? entries : [];
  }

  private static entryVersion(entry: HuggingFaceTreeEntry | undefined) {
    return {
      oid: entry?.lfs?.oid ?? entry?.oid ?? null,
      bytes: entry?.lfs?.size ?? entry?.size ?? null,
    };
  }

  /**
   * Download a model into this slot.
   *
   * Refuses to run while the utility process is up, so a file is never replaced under
   * a running server. The main sidecar is untouched throughout.
   */
  async installModel(args: {
    modelId: string;
    repo: string;
    file: string;
    onProgress?: (progress: SidecarDownloadProgress) => void;
    signal?: AbortSignal;
  }): Promise<UtilitySidecarModelSource> {
    const { modelId, repo, file } = args;
    if (!isValidRepo(repo)) throw new Error("Expected a HuggingFace repo of the form owner/name");
    if (!isValidModelFile(file)) throw new Error("Expected a .gguf file name");

    const wasActive = this.config.activeModelId === modelId;
    if (wasActive) await this.stop();

    const entries = await this.listRepoFiles(repo);
    const entry = entries.find((candidate) => candidate.path === file);
    if (!entry) throw new Error(`${file} is not in ${repo}`);
    const version = UtilitySidecarService.entryVersion(entry);

    const destination = modelFilePath(modelId, file);
    mkdirSync(dirname(destination), { recursive: true });
    await downloadFileWithProgress({
      url: `https://huggingface.co/${repo}/resolve/main/${encodeURI(file)}`,
      destPath: destination,
      expectedBytes: version.bytes,
      signal: args.signal,
      progress: { phase: "model", label: `${repo}/${file}` } as SidecarDownloadProgress,
      onProgress: args.onProgress,
    });

    const record: UtilitySidecarModelSource = {
      repo,
      file,
      oid: version.oid,
      bytes: existsSync(destination) ? statSync(destination).size : version.bytes,
      downloadedAt: new Date().toISOString(),
    };
    this.config.models[modelId] = record;
    if (!this.config.activeModelId) this.config.activeModelId = modelId;
    this.writeConfig();
    logger.info(`[utility-sidecar] installed ${modelId} from ${repo}/${file}`);
    return record;
  }

  /** Is there a newer build than the one installed? Honest about not knowing. */
  async checkForUpdate(modelId: string): Promise<UtilitySidecarUpdateCheck> {
    const installed = this.config.models[modelId];
    if (!installed) throw new Error(`No utility model installed as ${modelId}`);
    const entries = await this.listRepoFiles(installed.repo);
    const available = UtilitySidecarService.entryVersion(
      entries.find((candidate) => candidate.path === installed.file),
    );
    return {
      modelId,
      repo: installed.repo,
      file: installed.file,
      installedOid: installed.oid,
      availableOid: available.oid,
      installedBytes: installed.bytes,
      availableBytes: available.bytes,
      ...compareModelVersions(installed.oid, available.oid),
    };
  }

  /**
   * Remove an installed model, stopping it first if it is the one running.
   *
   * Without the stop, the deleted model kept serving: the child stayed ready, and a
   * later ensureRunning() handed that same process back for whatever was selected
   * next. The slot would answer as a model that no longer exists on disk.
   */
  async removeModel(modelId: string): Promise<void> {
    assertValidModelId(modelId);
    const installed = this.config.models[modelId];
    if (!installed) return;
    if (this.config.activeModelId === modelId) {
      this.config.activeModelId = null;
      await this.stop();
    }
    delete this.config.models[modelId];
    this.writeConfig();
    try {
      rmSync(modelDirPath(modelId), { recursive: true, force: true });
    } catch (error) {
      logger.warn(error, "[utility-sidecar] Could not remove the model directory");
    }
  }

  /**
   * Update the hardware settings.
   *
   * Clamped rather than trusted: these become llama-server arguments, and a nonsense
   * value there fails at spawn time with an error that looks nothing like its cause.
   * A running process is restarted so the change actually takes effect — the operator
   * asked for it, and a setting that silently applies "next time" is a support ticket.
   */
  async updateSettings(patch: Partial<UtilitySidecarHardwareSettings>): Promise<UtilitySidecarStatus> {
    const clamp = (value: number, bounds: { min: number; max: number }) =>
      Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
    const next = { ...this.config };
    if (typeof patch.contextSize === "number" && Number.isFinite(patch.contextSize)) {
      next.contextSize = clamp(patch.contextSize, UTILITY_SIDECAR_LIMITS.contextSize);
    }
    if (typeof patch.gpuLayers === "number" && Number.isFinite(patch.gpuLayers)) {
      next.gpuLayers = clamp(patch.gpuLayers, UTILITY_SIDECAR_LIMITS.gpuLayers);
    }
    if (typeof patch.maxParallelJobs === "number" && Number.isFinite(patch.maxParallelJobs)) {
      next.maxParallelJobs = clamp(patch.maxParallelJobs, UTILITY_SIDECAR_LIMITS.maxParallelJobs);
    }
    const changed =
      next.contextSize !== this.config.contextSize ||
      next.gpuLayers !== this.config.gpuLayers ||
      next.maxParallelJobs !== this.config.maxParallelJobs;
    this.config = next;
    this.writeConfig();
    if (changed && this.child) {
      await this.stop();
      await this.ensureRunning();
    }
    return this.getStatus();
  }

  /**
   * Choose which model this slot serves.
   *
   * Stops a process that is serving something else first. Otherwise the running child
   * stayed up and ensureRunning() returned it as ready, so status and routing reported
   * the newly selected model while the old one was still answering every request.
   */
  async setActiveModel(modelId: string | null): Promise<UtilitySidecarConfig> {
    // null is the only way to clear the selection. An empty string used to slip
    // through as "clear", which quietly turns a malformed request into a state change.
    if (modelId !== null) {
      assertValidModelId(modelId);
      if (!this.config.models[modelId]) throw new Error(`No utility model installed as ${modelId}`);
    }
    const changed = this.config.activeModelId !== modelId;
    this.config.activeModelId = modelId;
    this.writeConfig();
    if (changed && this.child) await this.stop();
    return this.getConfig();
  }

  // ── process ───────────────────────────────────────────────────────────────
  private static async allocatePort(): Promise<number> {
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

  /** Start the utility process if it is not already up. Never touches the main one. */
  /**
   * Start the utility process if what is running is not already the selected model.
   *
   * The identity check is re-made after waiting on an in-flight start: a caller that
   * joins model A's startup and then finds model B selected must not be handed A's
   * ready port. Bounded so a pathological flip-flop cannot spin here forever.
   */
  async ensureRunning(): Promise<UtilitySidecarStatus> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // A process that is still exiting must be gone before anything is started, or
      // two llama-servers end up competing for the same GPU and model slot.
      if (this.stopping) await this.stopping;
      const wanted = this.config.activeModelId;
      // Ready is not enough: the child may be holding a model that is no longer the
      // selected one, in which case it has to go before a new one can start.
      if (this.ready && this.child && this.runningModelId === wanted) return this.getStatus();
      if (this.child && this.runningModelId !== wanted) await this.stop();

      if (this.starting) {
        await this.starting;
        // Someone else's start just finished. If it produced what we want we are done;
        // otherwise go round again and start the right one.
        if (this.runningModelId === this.config.activeModelId) return this.getStatus();
        continue;
      }

      this.starting = this.start().finally(() => {
        this.starting = null;
      });
      await this.starting;
      if (this.runningModelId === this.config.activeModelId) return this.getStatus();
    }
    return this.getStatus();
  }

  private async start(): Promise<void> {
    this.startupError = null;
    const modelId = this.config.activeModelId;
    const installed = modelId ? this.config.models[modelId] : null;
    if (!modelId || !installed) {
      this.startupError = "No utility model selected";
      return;
    }
    const modelPath = modelFilePath(modelId, installed.file);
    if (!existsSync(modelPath)) {
      this.startupError = "The selected utility model is not on disk";
      return;
    }

    // Read-only: use the runtime the main sidecar already installed. getCurrentInstall
    // reads the recorded install and has no side effects — deliberately not
    // ensureInstalled(), which would download and rewrite shared runtime state this
    // slot has no business changing.
    const runtime = sidecarRuntimeService.getCurrentInstall();
    if (!runtime?.serverPath) {
      this.startupError = "The local runtime is not installed yet — install it from the main sidecar first";
      return;
    }

    // -1 means "all layers on the GPU, and fall back to CPU if that start fails" — the
    // same convention the main sidecar uses. Passing it straight to llama-server would
    // send `-ngl -1`, which is not what it means.
    const plans = buildLlamaStartupPlans({
      configuredGpuLayers: this.config.gpuLayers,
      usesGpuRuntime: sidecarRuntimeService.isGpuVariant(runtime.variant),
    });

    for (const [index, plan] of plans.entries()) {
      const port = await UtilitySidecarService.allocatePort();
      const args = buildLlamaArgs({
        modelPath,
        gpuLayers: plan.gpuLayers,
        port,
        contextSize: this.config.contextSize,
        runtimeVariant: runtime.variant,
        // Fixed by what the extractor needs, not by operator preference: no tool calls,
        // and the embedding flags are inert here but required by the shared arg builder.
        enableNativeToolCalls: false,
        embeddingPooling: "mean",
        embeddingBatchSize: 512,
        maxParallelJobs: this.config.maxParallelJobs,
      });

      const child = spawn(runtime.serverPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      this.child = child;
      this.port = port;
      this.runningModelId = modelId;
      child.on("exit", (code) => {
        logger.info(`[utility-sidecar] llama-server exited (${code})`);
        if (this.child === child) {
          this.child = null;
          this.port = null;
          this.ready = false;
          this.runningModelId = null;
        }
      });
      child.on("error", (error) => {
        this.startupError = error.message;
        logger.warn(error, "[utility-sidecar] llama-server failed to start");
      });

      this.startupError = null;
      await this.waitUntilAnswering(port);
      if (this.ready) {
        logger.info(`[utility-sidecar] Started with ${plan.label}`);
        return;
      }

      // That plan failed. Clear it away before trying the next one, so a half-started
      // process is never left holding memory or a port.
      await this.stop();
      const remaining = plans.length - index - 1;
      if (remaining > 0) {
        logger.warn(`[utility-sidecar] ${plan.label} failed (${this.startupError ?? "no reason given"}); trying CPU`);
      }
    }
  }

  private async waitUntilAnswering(port: number, timeoutMs = 120_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!this.child) {
        this.startupError = this.startupError ?? "The utility process exited during startup";
        return;
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          this.ready = true;
          logger.info(`[utility-sidecar] ready on 127.0.0.1:${port}`);
          return;
        }
      } catch {
        // still booting
      }
      await new Promise((wait) => setTimeout(wait, 1000));
    }
    this.startupError = "The utility model did not become ready in time";
  }

  /** Stop only this process. The main sidecar is never signalled from here. */
  /**
   * Stop the utility process and wait for it to actually be gone.
   *
   * `child.killed` only records that a signal was sent, not that the process exited,
   * so the old SIGKILL fallback could never fire and this could return while
   * llama-server still held the model file open — which is exactly when the caller
   * goes on to delete or replace it.
   */
  async stop(): Promise<void> {
    // Join an in-progress shutdown rather than starting a second one.
    if (this.stopping) return this.stopping;

    const child = this.child;
    this.child = null;
    this.ready = false;
    this.port = null;
    this.runningModelId = null;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    this.stopping = (async () => {
      const exited = new Promise<void>((done) => {
        child.once("exit", () => done());
        child.once("error", () => done());
      });
      // The timer is cleared when the process wins the race; an orphaned one keeps
      // the Node process alive for no reason.
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

  /** Digest of the active model file, for the operator to confirm what is loaded. */
  activeModelDigest(): string | null {
    const modelId = this.config.activeModelId;
    const installed = modelId ? this.config.models[modelId] : null;
    if (!modelId || !installed) return null;
    const path = modelFilePath(modelId, installed.file);
    if (!existsSync(path)) return null;
    // The recorded blob id is the version; this is only a local integrity hint.
    return createHash("sha256")
      .update(`${installed.oid ?? ""}:${statSync(path).size}`)
      .digest("hex")
      .slice(0, 16);
  }
}

export const utilitySidecarService = new UtilitySidecarService();
