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
import { runWithRootLogContext } from "../../lib/log-context.js";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import {
  artifactSnapshotPath,
  decisionRuntimeInstalled,
  decisionRuntimeService,
  inheritedEnv,
} from "./decision-runtime.service.js";
import { configuredCudaIndex, preflightDecisionModel } from "./decision-preflight.js";

const LOG_PATH = join(getDataDir(), "sidecar-runtime", "decision", "server.log");
/** Loading 4.5 GB of weights and building the LoRA takes a while on a cold cache. */
const READY_TIMEOUT_MS = 180_000;
/** How long a failed start is remembered before another one is attempted. */
const START_BACKOFF_MS = 60_000;

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
  /** The last model whose start failed, and when, so a gate does not retry it at once. */
  private failedModelId: string | null = null;
  private failedAt = 0;
  /**
   * Bumped by every explicit stop.
   *
   * A start spends seconds awaiting its preflight before it has a child to kill, and
   * a stop in that window used to find nothing to stop, after which the start carried
   * on and launched the process anyway: running while disabled, or launching Python
   * out of a directory that a remove was deleting. A start remembers the value it
   * began with and gives up at every checkpoint where it has changed.
   */
  private generation = 0;

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
    // A start that just failed is not retried immediately. Loading takes up to three
    // minutes before it gives up, and without this every gated turn would pay that
    // again while the reason stays the same. The panel still shows the error.
    if (this.failedModelId === model.id && Date.now() - this.failedAt < START_BACKOFF_MS) return null;

    for (;;) {
      if (this.child && this.baseUrl && this.modelId === model.id) return this.baseUrl;
      if (!this.starting) break;
      if (this.startingModelId === model.id) return this.starting;
      await this.starting.catch(() => null);
    }
    this.startingModelId = model.id;
    const generation = this.generation;
    // Root log context: the process outlives the request that started it and is shared
    // by later gates, so its ready-timeout, child-error and start-failure lines must not
    // carry the first requester's requestId.
    this.starting = runWithRootLogContext({}, () =>
      this.start(model)
        // Every failure path ends as a null, never a rejection. Callers gate on this,
        // and a gate that throws stops an agent rather than running it.
        .catch((error: unknown) => {
          this.error = error instanceof Error ? error.message : "The decision sidecar could not start.";
          logger.warn(error, "[decision-sidecar] Start threw");
          return null;
        })
        .then((baseUrl) => {
          if (baseUrl) {
            this.failedModelId = null;
          } else if (generation === this.generation) {
            // Only a start that failed on its own backs off. One the user stopped did
            // not fail, and turning the sidecar straight back on must not wait a minute.
            this.failedModelId = model.id;
            this.failedAt = Date.now();
          }
          return baseUrl;
        })
        .finally(() => {
          this.starting = null;
          this.startingModelId = null;
        }),
    );
    return this.starting;
  }

  private async start(model: SidecarDecisionModelInfo): Promise<string | null> {
    const generation = this.generation;
    const stopped = () => generation !== this.generation;
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
    await this.terminate();
    if (stopped()) return null;

    // Conditions change after an install: a bigger sidecar model, a longer context, a
    // game holding memory. The verdict at download time is not a promise about today,
    // so it is taken again here and a launch that no longer fits is refused with the
    // same plain sentence rather than dying inside CUDA.
    const preflight = await preflightDecisionModel(model, { fresh: true });
    if (preflight.assessment.verdict === "unsupported" || preflight.assessment.verdict === "wont_fit") {
      this.error = preflight.reason ?? "The decision model no longer fits on this device.";
      logger.warn("[decision-sidecar] Refusing to start: %s", this.error);
      return null;
    }
    // The last check before spawning, with nothing awaited between it and the spawn.
    if (stopped()) return null;

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
        // An allowlist, not the server's whole environment. This launches a third
        // party's Python model loader, and everything the engine holds in env -
        // provider keys, storage paths, tokens - would otherwise be handed to it for
        // no reason. Nothing below is a secret, and the process needs all of it.
        env: {
          // No network variables: the weights are already here and it runs offline.
          ...inheritedEnv(),
          // CUDA orders devices by compute capability by default while nvidia-smi
          // orders by PCI bus, so without this `cuda:0` can be a different card than
          // the index the preflight measured and the verdict would describe the
          // wrong GPU.
          CUDA_DEVICE_ORDER: "PCI_BUS_ID",
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
        void this.terminate();
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

    // A stop can also land after the child printed its address but before this line
    // runs. Publishing that address would hand gates a process nobody wants running.
    if (stopped() || this.child !== child) {
      if (this.child === child) await this.terminate();
      else if (child.exitCode === null) child.kill("SIGTERM");
      return null;
    }
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
    return `cuda:${configuredCudaIndex()}`;
  }

  /**
   * Stop the process, and cancel any start that has not finished yet.
   *
   * Waits for that start to give up before returning, so a caller about to delete the
   * runtime never races a launch from inside it.
   */
  async stop(): Promise<void> {
    this.generation += 1;
    // An explicit stop is a fresh start's prelude, so it clears the backoff.
    this.failedModelId = null;
    await this.terminate();
    await this.starting?.catch(() => null);
    // The start may have spawned between the first terminate and giving up.
    await this.terminate();
  }

  /** Kill the current child, if there is one. Does not touch a start in progress. */
  private async terminate(): Promise<void> {
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
