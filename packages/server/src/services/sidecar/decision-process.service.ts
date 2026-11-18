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
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SidecarDecisionModelInfo } from "@marinara-engine/shared";
import { runWithRootLogContext } from "../../lib/log-context.js";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { askNoulQuestions } from "../decision/system-one.client.js";
import {
  artifactSnapshotPath,
  decisionRuntimeInstalled,
  decisionRuntimeService,
  inheritedEnv,
} from "./decision-runtime.service.js";
import { configuredCudaIndex, preflightDecisionModel } from "./decision-preflight.js";
import { getMeasuredProcessBytes } from "./sidecar-footprint.js";
import { localModelManager, type LocalModelPlacement } from "./local-model-manager.js";
import { decisionServerInstall, type DecisionServerInstall } from "./decision-server-runtimes.js";
import { DecisionSystemOneShim, type DecisionShimMode } from "./decision-systemone-shim.js";
import { createServer } from "node:net";
import { availableParallelism } from "node:os";

const LOG_PATH = join(getDataDir(), "sidecar-runtime", "decision", "server.log");
/** Loading 4.5 GB of weights and building the LoRA takes a while on a cold cache. */
const READY_TIMEOUT_MS = 180_000;
/** How long a failed start is remembered before another one is attempted. */
const START_BACKOFF_MS = 60_000;
/** The first request on a cold kernel cache took 14.4 s once; a warm-up never waits longer than this. */
const WARM_UP_TIMEOUT_MS = 60_000;

/**
 * A short scene the model has not seen at start, for timing how fast it reads. About
 * 400 tokens in every tokenizer these models use; the exact count only scales the
 * estimate, and the limits built on it have wide margins.
 */
const MEASURE_STATE_TOKENS = 400;
const MEASURE_STATE = {
  recent_messages: Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    name: index % 2 === 0 ? "User" : "Narrator",
    content:
      `Turn ${index + 1}. The lantern swings above the harbour gate while the rain keeps falling on the stones. ` +
      "A guard in a grey coat checks the papers of each traveller, and the line moves slowly toward the ferry.",
  })),
};

export interface DecisionProcessStatus {
  running: boolean;
  baseUrl: string | null;
  modelId: string | null;
  error: string | null;
  pid: number | null;
}

/**
 * Each model's reading speed as last timed on this computer, kept on disk so the panel
 * can say how long a picture or a clip takes here, rather than quote a speed measured
 * somewhere else. A model never started here has none, and the panel then says nothing.
 */
const SPEED_FILE = () => join(getDataDir(), "sidecar-runtime", "decision", "measured-speed.json");
let speeds: Record<string, number> | null = null;

function loadSpeeds(): Record<string, number> {
  if (speeds) return speeds;
  try {
    const raw = JSON.parse(readFileSync(SPEED_FILE(), "utf8")) as unknown;
    speeds = {};
    if (raw && typeof raw === "object")
      for (const [id, value] of Object.entries(raw))
        if (typeof value === "number" && Number.isFinite(value) && value > 0) speeds[id] = value;
  } catch {
    speeds = {};
  }
  return speeds;
}

function rememberDecisionSpeed(modelId: string, msPerToken: number): void {
  const all = loadSpeeds();
  all[modelId] = Math.round(msPerToken * 1000) / 1000;
  try {
    mkdirSync(join(getDataDir(), "sidecar-runtime", "decision"), { recursive: true });
    writeFileSync(SPEED_FILE(), JSON.stringify(all));
  } catch (error) {
    logger.debug(error, "[decision-sidecar] Could not save the measured speed");
  }
}

/** Milliseconds per token of scene this model last read here, or null if it never ran here. */
export function measuredDecisionSpeed(modelId: string): number | null {
  return loadSpeeds()[modelId] ?? null;
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
  /** Cancels the warm-up of the start in progress, so a stop never waits it out. */
  private warmUpAbort: AbortController | null = null;
  /** The catalog's measured footprint of the model that is running. */
  private runningVramBytes: number | null = null;
  /** Which memory the running model is in. */
  private runningPlacement: LocalModelPlacement = "gpu";
  /** The `/v1/systemone` front of a model that needs one (JevK5, Valen). */
  private shim: DecisionSystemOneShim | null = null;
  /** One short question's time on this machine, from the warm-up. */
  private msPerToken: number | null = null;

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
    const gguf = model.runtime !== "open_jev_torch";
    if (gguf ? !decisionServerInstall(model.runtime) : !decisionRuntimeInstalled()) {
      this.error = "The decision runtime is not installed.";
      return null;
    }
    const checkpoint = gguf
      ? decisionModelFilePath(model)
      : join(artifactSnapshotPath(model.artifacts[0]!), "package", "checkpoint");
    if (!checkpoint || !existsSync(checkpoint)) {
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

    // Other built-in models that are not working on anything step aside if the card is
    // short, before the recheck below weighs what is free.
    this.runningPlacement = decisionPlacement(model);
    await localModelManager.prepareToLoad("decision", model.vramBytes, this.runningPlacement);
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
    if (gguf) return this.startGguf(model, checkpoint, generation);

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
          // Set here too, not only through finish(): once the address line has settled
          // the start, finish() ignores this. A crash during the warm-up, the model's
          // first forward pass, would then fail the start and back off for a minute
          // with no reason for the panel to show. A stop or a restart clears
          // `this.child` before killing, so only an exit on its own lands here.
          this.error = `The decision sidecar exited with code ${code}.`;
          // A warm-up in flight is asking this process, so it will never answer. Cancelled
          // here, after the reason is kept, so the start reports the exit at once instead
          // of waiting out the warm-up's limit.
          this.warmUpAbort?.abort();
        }
        finish(null, `The decision sidecar exited with code ${code}.`);
      });
    });

    // The first request a freshly loaded model answers is slow, on every start: about
    // 1.5 s on Open-Jev 2B against 0.09 s for the same request after it. Paid here,
    // while callers already wait on the load, so the first gate and the Test button
    // after a start see the model's normal speed instead of the warm-up.
    if (baseUrl && !stopped() && this.child === child) {
      const abort = new AbortController();
      this.warmUpAbort = abort;
      const failed = await this.timedWarmUp(baseUrl, model, abort.signal).finally(() => {
        if (this.warmUpAbort === abort) this.warmUpAbort = null;
      });
      // Only while the process is still ours and running. A stop or an exit during the
      // warm-up is reported by its own path, and the model is not "slow", it is gone.
      if (failed && !stopped() && this.child === child)
        logger.warn("[decision-sidecar] Warm-up request failed (%s); the first question may be slow", failed);
    }

    // A stop can also land after the child printed its address but before this line
    // runs. Publishing that address would hand gates a process nobody wants running.
    if (stopped() || this.child !== child) {
      if (this.child === child) await this.terminate();
      else if (child.exitCode === null) child.kill("SIGTERM");
      return null;
    }
    this.baseUrl = baseUrl;
    this.runningVramBytes = model.vramBytes;
    localModelManager.noteLoaded("decision");
    return baseUrl;
  }

  /**
   * Launch a GGUF decision model on its llama.cpp server.
   *
   * The port is picked here (llama-server does not report a port chosen by the
   * system), and readiness is its `/health` answering, the same way the utility and
   * embedding slots start. On a graphics-card build a start that fails is tried once
   * more on the processor, as the chat model does.
   */
  private async startGguf(
    model: SidecarDecisionModelInfo,
    modelPath: string,
    generation: number,
  ): Promise<string | null> {
    const stopped = () => generation !== this.generation;
    const install = decisionServerInstall(model.runtime);
    if (!install) {
      this.error = "The decision runtime is not installed.";
      return null;
    }
    const plans = install.gpu && model.runtime !== "winnow_cuda" ? [true, false] : [install.gpu];
    for (const [index, onGpu] of plans.entries()) {
      if (stopped()) return null;
      const port = await allocateLoopbackPort();
      const launch = ggufLaunch(model, modelPath, install, port, onGpu, decisionProjectorFilePath(model));
      mkdirSync(join(LOG_PATH, ".."), { recursive: true });
      const log = createWriteStream(LOG_PATH, { flags: "a" });
      log.write(
        `\n[marinara] ${new Date().toISOString()} starting ${model.label} (${install.variant}${onGpu ? "" : ", processor"})\n`,
      );
      const child = spawn(install.executable, launch.args, {
        cwd: install.directory,
        // The same allowlist as Open-Jev: nothing the engine holds is handed over.
        env: { ...inheritedEnv(), ...launch.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.child = child;
      this.modelId = model.id;
      this.error = null;
      let tail = "";
      let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null;
      const capture = (chunk: unknown) => {
        const text = String(chunk);
        log.write(text);
        tail = `${tail}${text}`.slice(-4000);
      };
      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      child.on("error", (error) => {
        logger.warn(error, "[decision-sidecar] Could not start");
        if (this.child === child) this.error = error.message;
      });
      child.on("close", (code, signal) => {
        exit = { code, signal };
        log.end();
        if (this.child === child) {
          this.child = null;
          this.baseUrl = null;
          this.error = signal
            ? `The decision model's server was stopped by ${signal}.`
            : `The decision model's server exited with code ${code}.`;
          this.warmUpAbort?.abort();
          void this.shim?.stop();
          this.shim = null;
          localModelManager.noteStopped("decision");
        }
      });
      const serverUrl = `http://127.0.0.1:${port}`;
      const ready = await waitForHealth(serverUrl, () => this.child === child && !stopped(), READY_TIMEOUT_MS);
      if (!ready) {
        const reason =
          this.child === child
            ? "did not finish loading in time"
            : (describeEarlyExit(model, exit) ?? "stopped while loading");
        if (this.child === child) await this.terminate();
        if (stopped()) return null;
        const lastLine = tail.trim().split(/\r?\n/u).filter(Boolean).slice(-1)[0] ?? "";
        this.error = `The decision model ${reason}.${lastLine ? ` ${lastLine.slice(0, 300)}` : ""}`;
        if (index < plans.length - 1) {
          logger.warn("[decision-sidecar] %s failed on the graphics card; trying the processor", model.label);
          continue;
        }
        return null;
      }

      let baseUrl = serverUrl;
      if (launch.shim) {
        const shim = new DecisionSystemOneShim(serverUrl, launch.shim);
        baseUrl = await shim.start();
        this.shim = shim;
      }
      if (!stopped() && this.child === child) {
        const abort = new AbortController();
        this.warmUpAbort = abort;
        const failed = await this.timedWarmUp(baseUrl, model, abort.signal).finally(() => {
          if (this.warmUpAbort === abort) this.warmUpAbort = null;
        });
        if (failed && !stopped() && this.child === child)
          logger.warn("[decision-sidecar] Warm-up request failed (%s); the first question may be slow", failed);
      }
      if (stopped() || this.child !== child) {
        if (this.child === child) await this.terminate();
        return null;
      }
      this.baseUrl = baseUrl;
      this.runningVramBytes = model.vramBytes;
      this.runningPlacement = onGpu ? decisionPlacement(model) : "cpu";
      localModelManager.noteLoaded("decision");
      logger.info("[decision-sidecar] %s ready (%s%s)", model.label, install.variant, onGpu ? "" : ", processor");
      return baseUrl;
    }
    return null;
  }

  /**
   * The warm-up, timed, so request limits can follow this machine's real speed.
   *
   * The first answer pays one-off costs, so the speed is read from a second question
   * over a scene it has not seen. A repeat of the first would come from the prompt
   * cache and report a speed no real scene gets.
   */
  private async timedWarmUp(
    baseUrl: string,
    model: SidecarDecisionModelInfo,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    const failed = await this.warmUp(baseUrl, model, signal);
    this.msPerToken = null;
    // Open-Jev runs on an NVIDIA card with fixed, curated limits, so it is not timed.
    if (!failed && !signal.aborted && model.runtime !== "open_jev_torch") {
      const started = Date.now();
      const second = await this.warmUp(baseUrl, model, signal, MEASURE_STATE);
      if (!second) {
        this.msPerToken = (Date.now() - started) / MEASURE_STATE_TOKENS;
        rememberDecisionSpeed(model.id, this.msPerToken);
      }
    }
    return failed;
  }

  /**
   * How long reading one token of a scene took on this machine once loaded, or null
   * before a start. A model on the processor reads tens of tokens a second where a
   * graphics card reads thousands, so the request limits are scaled from this rather
   * than fixed.
   */
  measuredMsPerToken(): number | null {
    return this.isLoaded() ? this.msPerToken : null;
  }

  placement(): LocalModelPlacement {
    return this.runningPlacement;
  }

  isLoaded(): boolean {
    return !!this.child && !!this.baseUrl;
  }

  footprintBytes(): number | null {
    if (!this.isLoaded()) return null;
    return getMeasuredProcessBytes(this.child?.pid) ?? this.runningVramBytes;
  }

  /**
   * One small question, shaped like the Test button's, sent before the address is
   * published. Returns the error code of a failed request. A failure is not fatal: the
   * model is loaded and serving, and only the first real question pays the warm-up.
   */
  private async warmUp(
    baseUrl: string,
    model: SidecarDecisionModelInfo,
    signal: AbortSignal,
    state: unknown = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] },
  ): Promise<string | undefined> {
    const result = await askNoulQuestions({
      connection: {
        protocol: "system_one",
        endpoint: `${baseUrl}/v1/systemone`,
        apiKey: "",
        model: "jev-latest",
        maxStateTokens: 1024,
      },
      state,
      questions: [{ id: "warm-up", instructions: "The door is open." }],
      timeoutMs: WARM_UP_TIMEOUT_MS,
      signal,
      questionShape: model.calibration.questionShape,
    });
    return result.error;
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
    // Before waiting on the start below: a warm-up request left open would otherwise
    // hold the stop for up to its whole time limit.
    this.warmUpAbort?.abort();
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
    const shim = this.shim;
    this.shim = null;
    await shim?.stop();
    localModelManager.noteStopped("decision");
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

/** Where a model's weights live, for the memory check and the unload order. */
export function decisionPlacement(model: SidecarDecisionModelInfo): LocalModelPlacement {
  const memory = model.memory ?? "nvidia";
  if (memory === "cpu") return "cpu";
  if (memory === "nvidia") return "gpu";
  return decisionServerInstall(model.runtime)?.gpu ? "gpu" : "cpu";
}

/** The GGUF a downloaded model loads, or null for Open-Jev. */
export function decisionModelFilePath(model: SidecarDecisionModelInfo): string | null {
  if (model.runtime === "open_jev_torch" || !model.modelFile || !model.artifacts[0]) return null;
  const snapshot = artifactSnapshotPath(model.artifacts[0]);
  try {
    return assertInsideDir(snapshot, join(snapshot, model.modelFile));
  } catch {
    return null;
  }
}

/** The vision projector a downloaded model loads beside its weights, when it has one here. */
export function decisionProjectorFilePath(model: SidecarDecisionModelInfo): string | null {
  if (!model.projectorFile || !model.artifacts[0]) return null;
  const snapshot = artifactSnapshotPath(model.artifacts[0]);
  try {
    const path = assertInsideDir(snapshot, join(snapshot, model.projectorFile));
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Threads for Valen's full release: all but one of the processor's, so Marinara itself
 * stays responsive while a clip is read, and at most 8, past which ONNX Runtime gained
 * nothing in its authors' measurements on these graphs.
 */
function valenOnnxThreads(): number {
  return Math.max(1, Math.min(8, availableParallelism() - 1));
}

async function allocateLoopbackPort(): Promise<number> {
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

async function waitForHealth(baseUrl: string, alive: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!alive()) return false;
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      // Still loading.
    }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  return false;
}

/**
 * The command line for a GGUF decision model, by runtime.
 *
 * - llama.cpp (both kinds): one slot, the model's context, all layers on the card
 *   when there is one. Prompt caching is left at llama.cpp's default for the letters
 *   readout (the state is the shared start of every question) and off for native
 *   decision models, which llama.cpp itself recommends.
 * - Valen: its authors' command, processor only, the whole request in one batch.
 * - Winnow: its authors' direct-decision command for the E4B profile.
 * - Valen's full release: Valen's SDK on Marinara's own Node, with the FFmpeg pair.
 *
 * A model with a vision projector downloaded gets it with `--mmproj`, so it reads the
 * pictures Marinara sends; without one it reads text, as before.
 */
export function ggufLaunch(
  model: SidecarDecisionModelInfo,
  modelPath: string,
  install: Pick<DecisionServerInstall, "variant" | "directory" | "script" | "ffmpeg" | "ffprobe">,
  port: number,
  onGpu: boolean,
  projectorPath: string | null = null,
): { args: string[]; env: NodeJS.ProcessEnv; shim: DecisionShimMode | null } {
  const ctx = String(model.maxLengthTokens);
  const common = ["--host", "127.0.0.1", "--port", String(port)];
  const vision = projectorPath ? ["--mmproj", projectorPath] : [];
  if (model.runtime === "valen_onnx") {
    if (!install.script) throw new Error("Valen's full release has no server script.");
    return {
      args: [
        install.script,
        "--model",
        join(modelPath, ".."),
        "--port",
        String(port),
        "--variant",
        "q8-mlp",
        "--threads",
        String(valenOnnxThreads()),
        ...(install.ffmpeg ? ["--ffmpeg", install.ffmpeg] : []),
        ...(install.ffprobe ? ["--ffprobe", install.ffprobe] : []),
      ],
      env: {},
      shim: null,
    };
  }
  if (model.runtime === "valen_gguf") {
    return {
      args: [
        "-m",
        modelPath,
        ...vision,
        "--load-mode",
        "none",
        "--device",
        "none",
        "-ngl",
        "0",
        ...common,
        "-c",
        ctx,
        "-b",
        ctx,
        "-ub",
        ctx,
        "--parallel",
        "1",
        "--no-warmup",
      ],
      env: { LD_LIBRARY_PATH: [install.directory, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") },
      shim: { kind: "text-state" },
    };
  }
  if (model.runtime === "winnow_cuda") {
    return {
      args: [
        "--model",
        modelPath,
        "--alias",
        "Winnow-E4B",
        "--ctx-size",
        ctx,
        "--parallel",
        "1",
        "--n-gpu-layers",
        "999",
        "--fit",
        "off",
        "--flash-attn",
        "on",
        "--cache-type-k",
        "f16",
        "--cache-type-v",
        "f16",
        "--no-context-shift",
        "--offline",
        "--lazy-mode",
        "off",
        "--split-mode",
        "none",
        "--override-tensor",
        "^(token_embd|per_layer_token_embd)\\.weight$=CUDA0",
        "--batch-size",
        "2048",
        "--ubatch-size",
        "1024",
        ...common,
        "--jinja",
        "--reasoning",
        "off",
        "--no-warmup",
        "--cache-ram",
        "0",
        // Its authors' vision preset when the projector is here, their text preset when not.
        ...(projectorPath ? vision : ["--no-mmproj"]),
        "--spec-type",
        "none",
      ],
      env: {
        CUDA_DEVICE_ORDER: "PCI_BUS_ID",
        CUDA_VISIBLE_DEVICES: String(configuredCudaIndex()),
        WINNOW_MANAGED_LAUNCH: "1",
        WINNOW_RESIDENT_MTP: "0",
        WINNOW_RESIDENT_VISION_MTP: "0",
        WINNOW_CONTEXT: ctx,
        WINNOW_CHAT_CONTEXT: ctx,
        WINNOW_CHAT_PARALLEL: "1",
        WINNOW_HEAD: "selected",
        WINNOW_CACHE: "f16",
        WINNOW_PIPELINE: "optimized",
        WINNOW_MEMORY: "exclusive",
        WINNOW_PARALLEL: "4",
        WINNOW_BATCH: "2048",
        WINNOW_UBATCH: "1024",
      },
      shim: null,
    };
  }
  const args = [
    "-m",
    modelPath,
    ...vision,
    ...common,
    "--ctx-size",
    ctx,
    "--parallel",
    "1",
    "-ngl",
    onGpu ? "999" : "0",
  ];
  if (!onGpu) args.push("--device", "none");
  if (model.runtime === "llama_systemone") {
    // Native decision models read the whole prompt in one batch for some types (laya, clef, d3).
    args.push("--batch-size", ctx, "--ubatch-size", ctx);
  }
  return {
    args,
    env: {},
    shim: model.runtime === "llama_letters" && model.letterReadout ? { kind: "letters", ...model.letterReadout } : null,
  };
}

export const decisionProcessService = new DecisionProcessService();

localModelManager.register({
  id: "decision",
  label: () => "The decision model",
  isLoaded: () => decisionProcessService.isLoaded(),
  footprintBytes: () => decisionProcessService.footprintBytes(),
  // Open-Jev and Winnow run on an NVIDIA card; the llama.cpp models wherever they loaded.
  placement: () => decisionProcessService.placement(),
  unload: () => decisionProcessService.stop(),
});

/**
 * Why a decision model's server died before it was ready, when the way it died says so.
 * A crash on an illegal instruction means its build uses processor features this one
 * lacks, which no amount of retrying fixes.
 */
export function describeEarlyExit(
  model: Pick<SidecarDecisionModelInfo, "label" | "requiredCpuFlags">,
  exit: { code: number | null; signal: NodeJS.Signals | null } | null,
): string | null {
  if (!exit) return null;
  const flag = (name: string) => (name === "avx512f" ? "AVX-512" : name.toUpperCase());
  const needs = model.requiredCpuFlags?.length
    ? `its build needs a processor with ${model.requiredCpuFlags.map(flag).join(", ")}`
    : "its build needs processor features this one does not have";
  // 132 is how a shell reports SIGILL.
  if (exit.signal === "SIGILL" || exit.code === 132) return `crashed at start (illegal instruction): ${needs}`;
  if (exit.signal) return `crashed at start (${exit.signal})`;
  return null;
}
