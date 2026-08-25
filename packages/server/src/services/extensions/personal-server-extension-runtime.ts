import type { ChildProcess } from "node:child_process";
import { appendFile, open, readFile, stat } from "node:fs/promises";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createPersonalExtensionSettingsStorage } from "./personal-extension-settings.service.js";
import { createPersonalExtensionsStorage } from "./personal-extension-storage.service.js";
import {
  canExecutePersonalExtension,
  getPersonalExtensionPolicy,
  isExternalPersonalExtensionSource,
} from "./personal-extension-policy.service.js";
import {
  spawnSandboxedPersonalExtension,
  type SandboxedPersonalExtensionProcess,
} from "./personal-extension-sandbox.js";
import {
  extractProtocolLines,
  resolveSandboxPollDelay,
  SANDBOX_HEARTBEAT_STALE_MS,
  shouldGrantSandboxResumeGrace,
  SANDBOX_HOST_IDLE_POLL_MS,
  SANDBOX_HOT_POLL_MS,
  SANDBOX_WATCHDOG_INTERVAL_MS,
} from "./sandbox-protocol.js";
import type { PersonalExtension } from "@marinara-engine/shared";

type ActiveExtension = {
  id: string;
  contentHash: string;
  name: string;
  child: ChildProcess;
  sandbox: SandboxedPersonalExtensionProcess;
  expectedStop: boolean;
  watchdog: NodeJS.Timeout | null;
  outputPoller: NodeJS.Timeout | null;
  inputQueue: Promise<void>;
  /** Lets send() flip the adaptive output poll back to the hot cadence. */
  onTraffic: (() => void) | null;
  /** Settles when the close handler's finalization (drain, handle close, cleanup) is done. */
  closeFinalized: Promise<void>;
  resolveCloseFinalized: () => void;
  /** The idempotent teardown shared by the close handler and the zombie fallback. */
  finalize: ((options: { drain: boolean; code?: number | null; signal?: string | null }) => Promise<void>) | null;
};
type RuntimeStatus = { status: "running" | "stopped" | "error"; error: string | null };
type RunnerMessage = {
  type?: string;
  requestId?: string;
  action?: "get" | "patch" | "delete";
  payload?: unknown;
  level?: "debug" | "info" | "warn" | "error";
  args?: unknown[];
  message?: string;
};

const LOG_LEVELS = new Set<NonNullable<RunnerMessage["level"]>>(["debug", "info", "warn", "error"]);
const STARTUP_TIMEOUT_MS = 10_000;
// Includes headroom for the runner's idle input-poll cadence (#4706): a stop
// written after a silence is seen within SANDBOX_RUNNER_IDLE_POLL_MS.
const CLEANUP_TIMEOUT_MS = 3_500;
const MAX_PROTOCOL_BYTES = 2 * 1024 * 1024;
const MAX_ERROR_LOG_BYTES = 2 * 1024 * 1024;
const MAX_HEARTBEAT_BYTES = 128;

function describeError(error: unknown) {
  return error instanceof Error ? error.message || error.name : String(error);
}

export class PersonalServerExtensionRuntime {
  private db: DB | null = null;
  private active = new Map<string, ActiveExtension>();
  private statuses = new Map<string, RuntimeStatus>();
  private queue: Promise<void> = Promise.resolve();

  // Kept as an optional argument for compatibility with callers that used to
  // supply a module directory. Sandboxed extensions no longer write modules.
  constructor(_legacyRuntimeDir?: string) {}

  async start(db: DB) {
    this.db = db;
    await this.reloadAll();
  }

  async stop() {
    await this.stopAll();
    this.db = null;
  }

  withRuntimeStatus(extension: PersonalExtension): PersonalExtension {
    if (extension.runtime !== "server") return extension;
    const status = this.statuses.get(extension.id);
    return {
      ...extension,
      serverStatus: extension.enabled ? (status?.status ?? "stopped") : "stopped",
      serverError: status?.error ?? null,
    };
  }

  reloadAll() {
    this.queue = this.queue
      .then(() => this.reloadAllNow())
      .catch((error) => {
        logger.error(error, "[personal-extensions] Server sandbox reload failed");
      });
    return this.queue;
  }

  enforceExternalPolicy() {
    this.queue = this.queue
      .then(() => this.enforceExternalPolicyNow())
      .catch((error) => {
        logger.error(error, "[personal-extensions] Failed to enforce the External Extensions gate");
      });
    return this.queue;
  }

  reloadExtension(id: string) {
    this.queue = this.queue
      .then(() => this.reloadExtensionNow(id))
      .catch((error) => {
        logger.error(error, "[personal-extensions] Server extension reload failed for %s", id);
      });
    return this.queue;
  }

  unloadExtension(id: string) {
    this.queue = this.queue
      .then(() => this.unloadExtensionNow(id))
      .catch((error) => {
        logger.error(error, "[personal-extensions] Server extension unload failed for %s", id);
      });
    return this.queue;
  }

  private async enforceExternalPolicyNow() {
    if (!this.db) return;
    const policy = await getPersonalExtensionPolicy(this.db);
    if (!policy.externalExtensionsEnabled) {
      await createPersonalExtensionsStorage(this.db).disableExternal();
    }
    await this.reloadAllNow();
  }

  private async reloadAllNow() {
    if (!this.db) return;
    await this.stopAll();
    this.statuses.clear();
    const storage = createPersonalExtensionsStorage(this.db);
    const policy = await getPersonalExtensionPolicy(this.db);
    if (!policy.externalExtensionsEnabled) await storage.disableExternal();
    const extensions = await storage.list();
    for (const extension of extensions.filter((candidate) => candidate.runtime === "server")) {
      if (!extension.enabled || !canExecutePersonalExtension(extension, policy)) {
        if (extension.enabled && isExternalPersonalExtensionSource(extension.source)) {
          await storage.disable(extension.id);
        }
        this.statuses.set(extension.id, { status: "stopped", error: null });
        continue;
      }
      if (!policy.serverSandboxAvailable) {
        this.statuses.set(extension.id, { status: "error", error: policy.serverSandboxReason });
        await storage.disable(extension.id);
        continue;
      }
      await this.tryLoad(extension);
    }
  }

  private async reloadExtensionNow(id: string) {
    if (!this.db) return;
    await this.unloadExtensionNow(id);
    const extension = await createPersonalExtensionsStorage(this.db).getById(id);
    if (!extension || extension.runtime !== "server") return;
    const policy = await getPersonalExtensionPolicy(this.db);
    if (!extension.enabled || !canExecutePersonalExtension(extension, policy)) {
      this.statuses.set(id, { status: "stopped", error: null });
      return;
    }
    if (!policy.serverSandboxAvailable) {
      await createPersonalExtensionsStorage(this.db).disable(id);
      this.statuses.set(id, { status: "error", error: policy.serverSandboxReason });
      return;
    }
    await this.tryLoad(extension);
  }

  private async tryLoad(extension: PersonalExtension) {
    try {
      await this.load(extension);
      this.statuses.set(extension.id, { status: "running", error: null });
    } catch (error) {
      const message = describeError(error);
      this.statuses.set(extension.id, { status: "error", error: message });
      logger.error(error, "[personal-extensions] Failed to sandbox %s (%s)", extension.name, extension.id);
    }
  }

  private async unloadExtensionNow(id: string) {
    const active = this.active.get(id);
    this.active.delete(id);
    this.statuses.delete(id);
    if (active) await this.stopExtension(active);
  }

  private async stopAll() {
    const active = [...this.active.values()];
    this.active.clear();
    for (const extension of active) await this.stopExtension(extension);
  }

  private async stopExtension(extension: ActiveExtension) {
    extension.expectedStop = true;
    if (extension.watchdog) clearInterval(extension.watchdog);
    // A failed stop-write (e.g. the sandbox dir is already gone) must not
    // abort the kill/cleanup below — or a stop-all loop over the remaining
    // extensions.
    await this.send(extension, { type: "stop" }).catch((error) => {
      logger.warn(error, "[personal-extensions] Stop request failed for %s; continuing cleanup", extension.name);
    });
    // Wait for the child to exit, killing it if the polite stop doesn't land.
    // The waits are skipped when exit state is already known — a close event
    // that already fired would leave a new listener unresolved forever.
    const waitForExit = () =>
      new Promise<boolean>((resolve) => {
        if (extension.child.exitCode !== null || extension.child.signalCode !== null) {
          resolve(true);
          return;
        }
        const timer = setTimeout(() => resolve(false), CLEANUP_TIMEOUT_MS);
        timer.unref?.();
        extension.child.once("close", () => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    let exited = await waitForExit();
    if (!exited) {
      extension.child.kill("SIGKILL");
      exited = await waitForExit();
    }
    if (exited) {
      // The close handler owns finalization (drain -> handle close -> cleanup)
      // and always resolves the promise from a finally. Never run cleanup on
      // this path — a timeout-raced cleanup here would remove the sandbox dir
      // under the drain's feet, which is the exact race this serialization
      // exists to prevent. The generous bound only guards a wedged filesystem.
      const settled = await Promise.race([
        extension.closeFinalized.then(() => true),
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), CLEANUP_TIMEOUT_MS * 3);
          timer.unref?.();
        }),
      ]);
      if (!settled) {
        logger.warn(
          "[personal-extensions] Close finalization for %s did not settle in time; leaving cleanup to it",
          extension.name,
        );
      }
      return;
    }
    // Close never fired within the bounds. Run the SAME idempotent finalizer
    // the close handler uses — it stops the poll chain, closes the handle,
    // and cleans up exactly once; if close does fire later, the handler's own
    // call becomes a no-op. Re-check exit state at this instant: the child
    // may have exited after the waits registered (close delayed by stdio), in
    // which case its final output is drainable and must not be dropped. Only
    // a true zombie (still running) skips the drain — an in-flight poll may
    // be wedged with it. The finalizer never rejects, so a failure here
    // cannot abort a stop-all loop over the remaining extensions.
    const exitedLate = extension.child.exitCode !== null || extension.child.signalCode !== null;
    await extension.finalize?.({ drain: exitedLate });
  }

  private async handleStorageMessage(extension: PersonalExtension, active: ActiveExtension, message: RunnerMessage) {
    if (!this.db || !message.requestId) return;
    const settings = createPersonalExtensionSettingsStorage(createAppSettingsStorage(this.db));
    try {
      let value: unknown;
      if (message.action === "get") value = await settings.get(extension.id);
      else if (message.action === "patch")
        value = await settings.patch(extension.id, message.payload as Record<string, unknown>);
      else if (message.action === "delete") {
        await settings.remove(extension.id);
        value = {};
      } else {
        throw new Error("Unknown storage action");
      }
      await this.send(active, { type: "storage-result", requestId: message.requestId, ok: true, value });
    } catch (error) {
      await this.send(active, {
        type: "storage-result",
        requestId: message.requestId,
        ok: false,
        error: describeError(error),
      });
    }
  }

  private send(active: ActiveExtension, message: unknown) {
    const serialized = `${JSON.stringify(message)}\n`;
    active.inputQueue = active.inputQueue.then(() => appendFile(active.sandbox.protocol.inputPath, serialized, "utf8"));
    // Host->runner traffic predicts a reply on the output file; flip the
    // adaptive output poll back to the hot cadence so it lands fast (#4706).
    active.onTraffic?.();
    return active.inputQueue;
  }

  private async load(extension: PersonalExtension) {
    if (!this.db) throw new Error("Personal extension runtime is not connected to storage");
    if (!extension.enabled || extension.approvedHash !== extension.contentHash) {
      throw new Error("Personal extension is not approved for its current content");
    }
    if (!extension.serverJs?.trim()) throw new Error("Server JavaScript is empty");

    const sandbox = await spawnSandboxedPersonalExtension();
    const { child } = sandbox;
    // Attach lifecycle listeners before the first setup await. A ChildProcess
    // that fails during `open` below would otherwise emit "error" with no
    // listener, which throws and crashes the main server process; a "close"
    // in the same window would be missed and leak the sandbox.
    let earlyExit: { code: number | null; signal: string | null; error?: Error } | null = null;
    const earlyErrorHandler = (error: Error) => {
      earlyExit = { code: null, signal: null, error };
    };
    const earlyCloseHandler = (code: number | null, signal: string | null) => {
      earlyExit = { code, signal };
    };
    child.once("error", earlyErrorHandler);
    child.once("close", earlyCloseHandler);

    let resolveCloseFinalized!: () => void;
    const closeFinalized = new Promise<void>((resolve) => {
      resolveCloseFinalized = resolve;
    });
    const active: ActiveExtension = {
      id: extension.id,
      contentHash: extension.contentHash,
      name: extension.name,
      child,
      sandbox,
      expectedStop: false,
      watchdog: null,
      outputPoller: null,
      inputQueue: Promise.resolve(),
      onTraffic: null,
      closeFinalized,
      resolveCloseFinalized,
      finalize: null,
    };
    let outputBuffer: Buffer = Buffer.alloc(0);
    let outputOffset = 0;
    let pollingOutput = false;
    let settled = false;
    let lastActivityAt = Date.now();
    let pollChainStopped = false;
    let closing = false;
    let lastHeartbeat = Date.now();
    let lastWatchdogTickAt = Date.now();
    let watchdogTickGeneration = 0;
    let messageWindowStartedAt = Date.now();
    let messageCount = 0;
    let outputHandle: Awaited<ReturnType<typeof open>>;
    try {
      outputHandle = await open(sandbox.protocol.outputPath, "r");
    } catch (error) {
      child.off("error", earlyErrorHandler);
      child.off("close", earlyCloseHandler);
      active.expectedStop = true;
      child.kill("SIGKILL");
      await sandbox.cleanup();
      throw error;
    }
    active.watchdog = setInterval(() => {
      if (active.expectedStop) return;
      const watchdogTickAt = Date.now();
      const tickGeneration = ++watchdogTickGeneration;
      const resumedAfterPause = shouldGrantSandboxResumeGrace(watchdogTickAt, lastWatchdogTickAt);
      lastWatchdogTickAt = watchdogTickAt;
      void Promise.all([stat(sandbox.protocol.heartbeatPath), stat(sandbox.protocol.errorPath)])
        .then(([heartbeatStats, errorStats]) => {
          if (tickGeneration !== watchdogTickGeneration || active.expectedStop) return;
          if (heartbeatStats.size > MAX_HEARTBEAT_BYTES || errorStats.size > MAX_ERROR_LOG_BYTES) {
            active.expectedStop = true;
            this.statuses.set(extension.id, {
              status: "error",
              error: "Server extension was stopped for exceeding a sandbox file limit",
            });
            child.kill("SIGKILL");
            return;
          }
          if (heartbeatStats.mtimeMs > lastHeartbeat) lastHeartbeat = heartbeatStats.mtimeMs;
          if (resumedAfterPause) lastHeartbeat = Math.max(lastHeartbeat, watchdogTickAt);
          // Five missed heartbeats at the 5s cadence — the same missed-beat
          // multiple the old 1s/5s pair allowed (#4706).
          if (Date.now() - lastHeartbeat <= SANDBOX_HEARTBEAT_STALE_MS) return;
          active.expectedStop = true;
          this.statuses.set(extension.id, {
            status: "error",
            error: "Server extension was stopped because its sandbox became unresponsive",
          });
          child.kill("SIGKILL");
        })
        .catch(() => undefined);
    }, SANDBOX_WATCHDOG_INTERVAL_MS);
    active.watchdog.unref?.();

    const startup = new Promise<void>((resolve, reject) => {
      const fail = (message: string) => {
        if (!settled) {
          settled = true;
          reject(new Error(message));
          return;
        }
        this.statuses.set(extension.id, { status: "error", error: message });
      };
      const pollOutput = async () => {
        if (pollingOutput) return;
        pollingOutput = true;
        try {
          const outputStats = await outputHandle.stat();
          if (outputStats.size > 64 * 1024 * 1024) {
            // expectedStop before every host-initiated kill: the close handler
            // must not overwrite the specific error with generic exit
            // diagnostics.
            active.expectedStop = true;
            fail("Extension protocol output exceeded its lifetime quota");
            child.kill("SIGKILL");
            return;
          }
          const available = outputStats.size - outputOffset;
          if (available <= 0) return;
          const chunk = Buffer.alloc(available);
          const { bytesRead } = await outputHandle.read(chunk, 0, available, outputOffset);
          outputOffset += bytesRead;
          if (bytesRead > 0) lastActivityAt = Date.now();
          // The size cap applies per MESSAGE, not per buffered chunk: with
          // adaptive polling, an idle-cadence read batches everything that
          // arrived across the silence, and several individually-legal
          // messages must not be mistaken for one oversized one (#4706).
          const extracted = extractProtocolLines(
            Buffer.concat([outputBuffer, chunk.subarray(0, bytesRead)]),
            MAX_PROTOCOL_BYTES,
          );
          outputBuffer = extracted.rest;
          if (extracted.oversized) {
            active.expectedStop = true;
            fail("Extension protocol message exceeded the size limit");
            child.kill("SIGKILL");
            return;
          }
          for (const line of extracted.lines) {
            let message: RunnerMessage;
            try {
              message = JSON.parse(line) as RunnerMessage;
            } catch {
              active.expectedStop = true;
              fail("Extension emitted an invalid sandbox protocol message");
              child.kill("SIGKILL");
              return;
            }
            if (Date.now() - messageWindowStartedAt > 10_000) {
              messageWindowStartedAt = Date.now();
              messageCount = 0;
            }
            messageCount += 1;
            if (messageCount > 300) {
              active.expectedStop = true;
              fail("Extension exceeded the sandbox message limit");
              child.kill("SIGKILL");
              return;
            }
            if (message.type === "ready") {
              if (!settled) {
                settled = true;
                resolve();
              }
            } else if (message.type === "fatal" || message.type === "runtime-error") {
              fail(message.message || "Extension sandbox failed");
              active.expectedStop = true;
              child.kill("SIGKILL");
            } else if (message.type === "storage" && !closing) {
              // Never dispatch storage during the final drain — the child is
              // gone and the reply write would race cleanup. The catch keeps a
              // failed reply from reaching the process-fatal unhandledRejection
              // handler.
              void this.handleStorageMessage(extension, active, message).catch((error) => {
                logger.warn(error, "[personal-extensions] Storage response failed for %s", extension.name);
              });
            } else if (message.type === "log" && message.level && LOG_LEVELS.has(message.level)) {
              logger[message.level](
                {
                  extensionId: extension.id,
                  extensionName: extension.name,
                  args: Array.isArray(message.args) ? message.args : [],
                },
                "[personal-extension] %s",
                extension.name,
              );
            }
          }
        } catch (error) {
          // During close finalization, filesystem errors are expected noise —
          // another stop path may already have removed the sandbox files —
          // and must not overwrite the real status of an expected stop.
          if (!closing) {
            active.expectedStop = true;
            fail(describeError(error));
            child.kill("SIGKILL");
          }
        } finally {
          pollingOutput = false;
        }
      };
      // #4706: self-scheduling timeout chain instead of a fixed 25ms interval —
      // hot while the handshake is pending or traffic moved recently, 1s at
      // idle. The stored handle is REASSIGNED on every tick; clearing a stale
      // handle from a previous tick would leave the live timer running.
      const scheduleOutputPoll = (delayMs?: number) => {
        if (pollChainStopped) return;
        if (active.outputPoller) clearTimeout(active.outputPoller);
        const delay =
          delayMs ??
          resolveSandboxPollDelay({
            now: Date.now(),
            lastActivityAt,
            settled,
            idlePollMs: SANDBOX_HOST_IDLE_POLL_MS,
          });
        active.outputPoller = setTimeout(() => {
          void pollOutput().finally(() => scheduleOutputPoll());
        }, delay);
        active.outputPoller.unref?.();
      };
      active.onTraffic = () => {
        lastActivityAt = Date.now();
        scheduleOutputPoll(SANDBOX_HOT_POLL_MS);
      };
      void pollOutput().finally(() => scheduleOutputPoll());
      // The ONE finalizer: stops the poll chain, drains (when safe), closes
      // the handle, and cleans up — exactly once, whether it is triggered by
      // the child's close event or by stopExtension's zombie fallback. The
      // flag makes the two callers mutually exclusive; a late close event
      // after the fallback already finalized becomes a no-op here.
      let finalized = false;
      const finalizeClose = async (options: { drain: boolean; code?: number | null; signal?: string | null }) => {
        if (finalized) return;
        finalized = true;
        closing = true;
        pollChainStopped = true;
        if (active.outputPoller) clearTimeout(active.outputPoller);
        active.onTraffic = null;
        try {
          if (options.drain) {
            // Final drain BEFORE closing the handle, before the expectedStop
            // check, and before cleanup rm-rf's the sandbox dir: with adaptive
            // polling the last messages (including a `fatal` explaining the
            // exit) may still be sitting unread in the output file (#4706).
            while (pollingOutput) await new Promise((resolve) => setTimeout(resolve, 10));
            await pollOutput();
          }
          // Fully close the handle before cleanup removes the directory it
          // points at (Windows refuses to delete open files).
          try {
            await outputHandle.close();
          } catch (error) {
            logger.warn(error, "[personal-extensions] Failed to close sandbox output handle");
          }
          if (options.drain && !active.expectedStop) {
            const diagnostics = await readFile(sandbox.protocol.errorPath, "utf8").catch(() => "");
            const detail =
              diagnostics.trim() || `Sandbox exited with ${options.signal ?? options.code ?? "unknown status"}`;
            fail(detail);
          }
          try {
            await sandbox.cleanup();
          } catch (error) {
            // This task is detached — a rejection here would be unhandled.
            // The leftover dir is inert; log it rather than fail the close.
            logger.warn(error, "[personal-extensions] Sandbox cleanup failed for %s", extension.name);
          }
        } finally {
          active.resolveCloseFinalized();
        }
      };
      active.finalize = finalizeClose;
      const handleClose = (code: number | null, signal: string | null) => {
        if (active.watchdog) clearInterval(active.watchdog);
        // A delayed close (stopExtension timed out, then a reload registered
        // a replacement under the same id) must only remove ITS OWN entry.
        if (this.active.get(extension.id) === active) {
          this.active.delete(extension.id);
        }
        void (async () => {
          await finalizeClose({ drain: true, code, signal });
        })();
      };
      // Hand off from the early setup-phase listeners, replaying an exit that
      // already happened while `open` was pending.
      child.off("error", earlyErrorHandler);
      child.off("close", earlyCloseHandler);
      child.once("error", (error) => fail(describeError(error)));
      child.once("close", handleClose);
      if (earlyExit) {
        if (earlyExit.error) fail(describeError(earlyExit.error));
        else handleClose(earlyExit.code, earlyExit.signal);
      }
    });

    await this.send(active, {
      type: "start",
      id: extension.id,
      name: extension.name,
      contentHash: extension.contentHash,
      source: extension.serverJs,
    });
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Personal extension sandbox startup timed out")),
        STARTUP_TIMEOUT_MS,
      );
      timer.unref?.();
    });
    try {
      await Promise.race([startup, timeout]);
      // The close-time drain can resolve the startup race from a child that
      // already exited (its `ready` was still sitting in the output file, and
      // a `fatal` may have resolved right behind it). Never insert a dead
      // sandbox into the active set: its input file is gone, and a later
      // stop would fail and disrupt shutdown of the healthy extensions.
      if (active.expectedStop || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(this.statuses.get(extension.id)?.error ?? "Extension sandbox exited during startup");
      }
      this.active.set(extension.id, active);
      logger.info(
        "[personal-extensions] Sandboxed %s (%s) at %s with %s",
        extension.name,
        extension.id,
        extension.contentHash,
        sandbox.backend,
      );
    } catch (error) {
      // Same serialized teardown as a normal stop: kill, then wait (bounded)
      // for the close handler's finalization before the last-resort cleanup —
      // a direct cleanup here would race the drain and can fail on Windows
      // against the still-open output handle.
      await this.stopExtension(active);
      throw error;
    }
  }
}

export const personalServerExtensionRuntime = new PersonalServerExtensionRuntime();
