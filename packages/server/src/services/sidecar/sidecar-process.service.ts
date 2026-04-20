import { spawn, type ChildProcess } from "child_process";
import { createWriteStream, existsSync, readFileSync, writeFileSync, type WriteStream } from "fs";
import { createServer } from "net";
import { dirname } from "path";
import { sidecarModelService } from "./sidecar-model.service.js";
import { isAbortError } from "./sidecar-download.js";
import { sidecarRuntimeService, type SidecarRuntimeInstall } from "./sidecar-runtime.service.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a localhost port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

class LlamaServerExitError extends Error {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;

  constructor(code: number | null, signal: NodeJS.Signals | null) {
    const reason = signal ? `signal ${signal}` : `exit ${code ?? "null"}`;
    super(`llama-server exited before becoming ready (${reason})`);
    this.name = "LlamaServerExitError";
    this.exitCode = code;
    this.signal = signal;
  }
}

class SidecarProcessService {
  private child: ChildProcess | null = null;
  private logStream: WriteStream | null = null;
  private baseUrl: string | null = null;
  private ready = false;
  private currentSignature: string | null = null;
  private intentionalStop = false;
  private unexpectedCrashCount = 0;
  private lastReadyAt = 0;
  private starting = false;
  private syncLock: Promise<void> = Promise.resolve();

  isReady(): boolean {
    return this.ready && this.baseUrl !== null;
  }

  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  async ensureReady(forceStart = false): Promise<string> {
    await this.syncForCurrentConfig(forceStart);
    if (!this.ready || !this.baseUrl) {
      throw new Error("The local llama-server is not ready");
    }
    return this.baseUrl;
  }

  async syncForCurrentConfig(forceStart = false): Promise<void> {
    return this.withLock(async () => {
      await this.syncUnlocked(forceStart);
    });
  }

  async restart(): Promise<void> {
    return this.withLock(async () => {
      this.currentSignature = null;
      await this.stopUnlocked();
      await this.syncUnlocked();
    });
  }

  async stop(): Promise<void> {
    return this.withLock(async () => {
      await this.stopUnlocked();
      if (sidecarModelService.getModelFilePath()) {
        sidecarModelService.setStatus("downloaded");
      } else {
        sidecarModelService.setStatus("not_downloaded");
      }
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.syncLock;
    this.syncLock = next;
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async syncUnlocked(forceStart = false): Promise<void> {
    const modelPath = sidecarModelService.getModelFilePath();
    const config = sidecarModelService.getConfig();

    if (!modelPath) {
      await this.stopUnlocked();
      sidecarModelService.setStatus("not_downloaded");
      return;
    }

    const runtime = await this.ensureRuntimeInstalled();
    const nextSignature = JSON.stringify({
      serverPath: runtime.serverPath,
      modelPath,
      contextSize: config.contextSize,
      gpuLayers: config.gpuLayers,
    });

    if (this.child && this.ready && this.currentSignature === nextSignature) {
      sidecarModelService.setStatus("ready");
      return;
    }

    if (!forceStart && !sidecarModelService.isEnabled()) {
      await this.stopUnlocked();
      sidecarModelService.setStatus("downloaded");
      return;
    }

    sidecarModelService.setStatus("starting_server");
    await this.stopUnlocked();
    await this.startUnlocked(runtime, modelPath, nextSignature);
  }

  private async ensureRuntimeInstalled(): Promise<SidecarRuntimeInstall> {
    sidecarModelService.setStatus("downloading_runtime");
    try {
      return await sidecarRuntimeService.ensureInstalled((progress) => {
        sidecarModelService.emitExternalProgress(progress);
      });
    } catch (error) {
      if (isAbortError(error)) {
        sidecarModelService.setStatus(sidecarModelService.getModelFilePath() ? "downloaded" : "not_downloaded");
      } else {
        sidecarModelService.setStatus("server_error");
      }
      throw error;
    }
  }

  private buildArgs(modelPath: string, gpuLayers: number, runtime: SidecarRuntimeInstall): string[] {
    const config = sidecarModelService.getConfig();
    const args = [
      "-m",
      modelPath,
      "--host",
      "127.0.0.1",
      "--parallel",
      "2",
      "--log-disable",
      "--ctx-size",
      String(config.contextSize),
    ];

    // Workaround for https://github.com/ggml-org/llama.cpp/issues/21730:
    // Gemma 4 crashes with split mode on multi-GPU CUDA setups.
    if (/cuda/i.test(runtime.variant) && gpuLayers > 0) {
      args.push("-sm", "none");
    }
    args.push("-ngl", String(gpuLayers));
    return args;
  }

  private usesGpuRuntime(runtime: SidecarRuntimeInstall): boolean {
    return /(cuda|rocm|vulkan|metal)/i.test(runtime.variant);
  }

  private buildStartupPlans(runtime: SidecarRuntimeInstall): Array<{ gpuLayers: number; label: string }> {
    const config = sidecarModelService.getConfig();
    if (config.gpuLayers !== -1) {
      return [{ gpuLayers: config.gpuLayers, label: `gpuLayers=${config.gpuLayers}` }];
    }

    if (this.usesGpuRuntime(runtime)) {
      return [
        { gpuLayers: 999, label: "max GPU offload" },
        { gpuLayers: 0, label: "CPU fallback" },
      ];
    }
    return [{ gpuLayers: 0, label: "CPU only" }];
  }

  private shouldRetryStartup(error: unknown): error is LlamaServerExitError {
    return error instanceof LlamaServerExitError;
  }

  private formatCommandArgs(args: string[]): string {
    return args.map((arg) => (/[\s"]/u.test(arg) ? JSON.stringify(arg) : arg)).join(" ");
  }

  private readRecentLogLines(maxLines = 12): string | null {
    try {
      const log = readFileSync(sidecarRuntimeService.getLogPath(), "utf-8").trim();
      if (!log) {
        return null;
      }
      return log.split(/\r?\n/u).slice(-maxLines).join("\n");
    } catch {
      return null;
    }
  }

  private decorateStartupError(error: unknown, args: string[]): Error {
    const baseMessage = error instanceof Error ? error.message : "llama-server failed to start";
    const commandLine = `${this.child?.spawnfile ?? "llama-server"} ${this.formatCommandArgs(args)}`.trim();
    const recentLogs = this.readRecentLogLines();
    if (!recentLogs) {
      return new Error(`${baseMessage}\nCommand: ${commandLine}`);
    }
    return new Error(`${baseMessage}\nCommand: ${commandLine}\nRecent llama-server log:\n${recentLogs}`);
  }

  private getChildExitError(child: ChildProcess): LlamaServerExitError | null {
    if (child.exitCode === null && child.signalCode === null) {
      return null;
    }
    return new LlamaServerExitError(child.exitCode, child.signalCode);
  }

  private async startUnlocked(runtime: SidecarRuntimeInstall, modelPath: string, signature: string): Promise<void> {
    if (!existsSync(modelPath)) {
      throw new Error("The selected sidecar model file is missing. Please download it again.");
    }

    writeFileSync(sidecarRuntimeService.getLogPath(), "", "utf-8");
    const startupPlans = this.buildStartupPlans(runtime);
    let lastError: Error | null = null;

    this.starting = true;
    try {
      for (let attempt = 0; attempt < startupPlans.length; attempt += 1) {
        const plan = startupPlans[attempt]!;
        const port = await getFreePort();
        const args = this.buildArgs(modelPath, plan.gpuLayers, runtime);
        args.push("--port", String(port));

        const logStream = createWriteStream(sidecarRuntimeService.getLogPath(), { flags: "a" });
        logStream.write(`[sidecar] startup attempt ${attempt + 1}/${startupPlans.length} (${plan.label})\n`);
        logStream.write(`[sidecar] command: ${runtime.serverPath} ${this.formatCommandArgs(args)}\n`);

        const child = spawn(runtime.serverPath, args, {
          cwd: dirname(runtime.serverPath),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        this.child = child;
        this.logStream = logStream;
        this.baseUrl = `http://127.0.0.1:${port}`;
        this.ready = false;
        this.currentSignature = signature;
        this.intentionalStop = false;

        child.stdout!.on("data", (chunk) => {
          logStream.write(chunk);
        });
        child.stderr!.on("data", (chunk) => {
          logStream.write(chunk);
        });
        child.on("exit", (code, signal) => {
          void this.handleChildExit(code, signal);
        });

        try {
          await this.waitForHealth(this.baseUrl, child);
          this.ready = true;
          this.unexpectedCrashCount = 0;
          this.lastReadyAt = Date.now();
          sidecarModelService.setStatus("ready");
          sidecarModelService.clearLegacyRuntimeStamp();
          return;
        } catch (error) {
          lastError = this.decorateStartupError(error, args);
          await this.stopUnlocked();

          const nextPlan = startupPlans[attempt + 1];
          if (nextPlan && this.shouldRetryStartup(error)) {
            console.warn(
              `[sidecar] Startup with ${plan.label} failed (${error.message}). Retrying with ${nextPlan.label}.`,
            );
            continue;
          }

          throw lastError;
        }
      }
    } catch (error) {
      sidecarModelService.setStatus("server_error");
      throw error;
    } finally {
      this.starting = false;
    }
  }

  private async waitForHealth(baseUrl: string, child: ChildProcess): Promise<void> {
    const timeoutAt = Date.now() + 60_000;
    let lastError: unknown = null;

    while (Date.now() < timeoutAt) {
      const exitError = this.getChildExitError(child);
      if (exitError) {
        throw exitError;
      }

      try {
        const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
        if (response.ok) {
          return;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        const latestExitError = this.getChildExitError(child);
        if (latestExitError) {
          throw latestExitError;
        }
      }

      await delay(500);
    }

    const exitError = this.getChildExitError(child);
    if (exitError) {
      throw exitError;
    }

    throw lastError instanceof Error ? lastError : new Error("Timed out waiting for llama-server health");
  }

  private async stopUnlocked(): Promise<void> {
    const child = this.child;
    if (!child) {
      this.ready = false;
      this.baseUrl = null;
      return;
    }

    this.intentionalStop = true;
    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });

    try {
      child.kill("SIGTERM");
    } catch {
      // Best-effort shutdown.
    }

    const timeout = delay(5_000);
    await Promise.race([exited, timeout]);

    if (child.exitCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Best-effort forced shutdown.
      }
    }

    this.cleanupChildState();
  }

  private cleanupChildState(): void {
    this.child = null;
    this.ready = false;
    this.baseUrl = null;
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  private async handleChildExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    const wasIntentional = this.intentionalStop;
    this.intentionalStop = false;
    this.cleanupChildState();

    if (wasIntentional) {
      return;
    }

    console.error(`[sidecar] llama-server exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`);

    if (this.starting) {
      return;
    }

    const crashedSoonAfterReady = this.lastReadyAt > 0 && Date.now() - this.lastReadyAt < 30_000;
    this.unexpectedCrashCount = crashedSoonAfterReady ? this.unexpectedCrashCount + 1 : 1;

    if (this.unexpectedCrashCount > 1) {
      sidecarModelService.setStatus("server_error");
      return;
    }

    try {
      await this.syncForCurrentConfig();
    } catch (error) {
      console.error("[sidecar] Auto-restart failed:", error);
      sidecarModelService.setStatus("server_error");
    }
  }
}

export const sidecarProcessService = new SidecarProcessService();
