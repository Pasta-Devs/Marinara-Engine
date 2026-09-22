/**
 * The managed decision sidecar's process.
 *
 * A second, separate local process: it does not replace or share anything with the
 * llama.cpp sidecar, so a chat or tracker model can keep running beside it.
 *
 * It is launched on port 0 and its real port is read from the line the server prints
 * on stdout once the model is loaded. That is deliberate. Picking a free port here and
 * passing it in leaves a window where something else takes it, and polling `/health`
 * to decide readiness would mean guessing the port first. The upstream server prints
 * `{"url": ..., "model": ..., "method": ...}` after `load_predictor` returns, so one
 * line answers both questions with no race.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SidecarDecisionModelInfo } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { artifactSnapshotPath, decisionRuntimeInstalled, decisionRuntimeService } from "./decision-runtime.service.js";
import { preflightDecisionModel } from "./decision-preflight.js";

const LOG_PATH = join(getDataDir(), "sidecar-runtime", "decision", "server.log");
/** Loading 4.5 GB of weights and building the LoRA takes a while on a cold cache. */
const READY_TIMEOUT_MS = 180_000;

export interface DecisionProcessStatus {
  running: boolean;
  baseUrl: string | null;
  modelId: string | null;
  error: string | null;
  pid: number | null;
}

class DecisionProcessService {
  private child: ChildProcess | null = null;
  private baseUrl: string | null = null;
  private modelId: string | null = null;
  private error: string | null = null;
  private starting: Promise<string | null> | null = null;
  /** Which model the in-flight start is for, so another request is not misrouted. */
  private startingModelId: string | null = null;

  getStatus(): DecisionProcessStatus {
    return {
      running: !!this.child && !!this.baseUrl,
      baseUrl: this.baseUrl,
      modelId: this.modelId,
      error: this.error,
      pid: this.child?.pid ?? null,
    };
  }

  getLogPath(): string {
    return LOG_PATH;
  }

  /**
   * The base URL, starting the process if it is not up.
   *
   * Returns null rather than throwing when it cannot serve, so a gate fails open and
   * the agent runs. The reason stays in the status for the panel to show.
   */
  async ensureRunning(model: SidecarDecisionModelInfo): Promise<string | null> {
    // Looped rather than checked once: awaiting somebody else's start yields, and by
    // the time it settles another caller may already have started something. Both
    // conditions are re-tested after every wait, so a request can never be handed a
    // URL serving weights it did not ask for.
    for (;;) {
      if (this.child && this.baseUrl && this.modelId === model.id) return this.baseUrl;
      if (!this.starting) break;
      if (this.startingModelId === model.id) return this.starting;
      await this.starting.catch(() => null);
    }
    this.startingModelId = model.id;
    this.starting = this.start(model).finally(() => {
      this.starting = null;
      this.startingModelId = null;
    });
    return this.starting;
  }

  private async start(model: SidecarDecisionModelInfo): Promise<string | null> {
    if (!decisionRuntimeInstalled()) {
      this.error = "The decision runtime is not installed.";
      return null;
    }
    const checkpoint = join(artifactSnapshotPath(model.artifacts[0]!), "package", "checkpoint");
    if (!existsSync(checkpoint)) {
      this.error = "The decision model is not downloaded.";
      return null;
    }

    // Stopped BEFORE the recheck, not after. A running decision process is filtered
    // out of the slot list but its memory is still in the card's `used` figure, so it
    // would be counted once as another application's usage and again as the candidate
    // about to start. Restarting the same model would then look like running two of
    // them and could be refused on a card that fits it comfortably.
    await this.stop();

    // Conditions change after an install: a bigger sidecar model, a longer context, a
    // game holding memory. The verdict at download time is not a promise about today,
    // so it is taken again here and a launch that no longer fits is refused with the
    // same plain sentence rather than dying inside CUDA.
    const preflight = await preflightDecisionModel(model);
    if (preflight.assessment.verdict === "unsupported" || preflight.assessment.verdict === "wont_fit") {
      this.error = preflight.reason ?? "The decision model no longer fits on this device.";
      logger.warn("[decision-sidecar] Refusing to start: %s", this.error);
      return null;
    }

    const runtime = decisionRuntimeService.getPaths();
    mkdirSync(join(LOG_PATH, ".."), { recursive: true });
    const log = createWriteStream(LOG_PATH, { flags: "a" });
    const child = spawn(
      runtime.pythonPath,
      [
        "-m",
        "jev.server",
        "--checkpoint",
        checkpoint,
        "--device",
        this.device(),
        "--max-length",
        String(model.maxLengthTokens),
        // Not 1. Upstream treats this as a per-forward-pass sequence limit, so 1 makes
        // a group of questions answer one at a time instead of together.
        "--batch-size",
        String(model.batchSize),
        // Upstream reports prefix caching breaks probability tolerance. It already
        // defaults off; passed explicitly so a default change cannot turn it on.
        "--no-prefix-cache",
        "--host",
        "127.0.0.1",
        "--port",
        "0",
      ],
      {
        cwd: runtime.sourcePath,
        env: {
          ...process.env,
          HF_HOME: runtime.hfHomePath,
          HF_HUB_CACHE: join(runtime.hfHomePath, "hub"),
          // The weights are already here and verified. Without this the loader would
          // reach the network on first use and a gate would block on a 4.5 GB fetch.
          HF_HUB_OFFLINE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    this.child = child;
    this.modelId = model.id;
    this.error = null;

    const baseUrl = await new Promise<string | null>((resolve) => {
      let settled = false;
      let stdout = "";
      const finish = (url: string | null, reason?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (reason) this.error = reason;
        resolve(url);
      };
      const timer = setTimeout(() => {
        logger.warn("[decision-sidecar] Model did not finish loading within %s ms", READY_TIMEOUT_MS);
        void this.stop();
        finish(null, "The decision model did not finish loading in time.");
      }, READY_TIMEOUT_MS);

      child.stdout?.on("data", (chunk) => {
        const text = String(chunk);
        log.write(text);
        // Bounded: the readiness line is the first thing printed after loading, and
        // progress bars before it can be long.
        stdout = `${stdout}${text}`.slice(-8000);
        for (const line of stdout.split(/\r?\n/u)) {
          if (!line.startsWith('{"url"')) continue;
          try {
            const announced = JSON.parse(line) as { url?: unknown };
            if (typeof announced.url === "string") finish(announced.url);
          } catch {
            // A partial line; the next chunk completes it.
          }
        }
      });
      child.stderr?.on("data", (chunk) => log.write(String(chunk)));
      child.on("error", (error) => {
        logger.warn(error, "[decision-sidecar] Could not start");
        finish(null, error.message);
      });
      child.on("close", (code) => {
        log.end();
        if (this.child === child) {
          this.child = null;
          this.baseUrl = null;
        }
        finish(null, `The decision sidecar exited with code ${code}.`);
      });
    });

    this.baseUrl = baseUrl;
    return baseUrl;
  }

  /**
   * Which GPU to use.
   *
   * Never derived from `GGML_VK_VISIBLE_DEVICES`: that is a Vulkan index and this is a
   * CUDA one. On a laptop with an integrated GPU the same card is Vulkan device 1 and
   * `cuda:0`, so reusing the llama.cpp setting would point at the wrong device or at
   * nothing.
   */
  private device(): string {
    const configured = process.env.MARINARA_DECISION_CUDA_DEVICE?.trim();
    return configured && /^\d+$/u.test(configured) ? `cuda:${configured}` : "cuda:0";
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.baseUrl = null;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const done = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Already gone.
        }
        resolve();
      }, 5000);
      child.once("close", () => {
        clearTimeout(done);
        resolve();
      });
      try {
        child.kill("SIGTERM");
      } catch {
        clearTimeout(done);
        resolve();
      }
    });
  }
}

export const decisionProcessService = new DecisionProcessService();
