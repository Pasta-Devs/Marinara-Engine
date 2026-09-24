// ──────────────────────────────────────────────
// Console tray icon (Windows only, feature switch "consoleTray")
// ──────────────────────────────────────────────
// Runs a small hidden PowerShell helper (assets/console-tray.ps1) that shows a tray icon and hides
// the server's console window while it is minimized. No native modules. The helper finds the
// console itself (it attaches to this process's console for a moment), so it works however the
// server was started: start.bat, start-local.bat, the Windows launcher or a plain `node`.
//
// The helper talks in lines (see the script header): it prints "ready ...", "noconsole ...",
// "quit" and so on, and stops when it reads "stop" or its stdin closes. It also exits by itself,
// restoring the console, as soon as this process is gone, so a crash never leaves an orphan icon
// or a hidden console. Any failure here is logged and ignored: the server keeps running.
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";
import { runWithRootLogContext } from "../../lib/log-context.js";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { isFeatureEnabled, onFeatureSettingsChange } from "../features/feature-settings.js";

export const CONSOLE_TRAY_SCRIPT_NAME = "console-tray.ps1";
const STOP_TIMEOUT_MS = 1_500;
const STDERR_TAIL_CHARS = 2_000;
const FAILURE_REPEAT_KEY = "console-tray-failed";

export type ConsoleTraySpawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface ConsoleTrayOptions {
  /** The address the tray's "Open Marinara" opens (see consoleTrayBrowserUrl). */
  url: string;
  port: number;
  /** Called when the user picks "Quit Marinara": run the same graceful shutdown as Ctrl+C. */
  onQuit: () => void;
  /** Tests inject these. */
  platform?: NodeJS.Platform;
  spawn?: ConsoleTraySpawner;
  isEnabled?: () => boolean;
  scriptPath?: string;
  iconPath?: string | null;
  parentPid?: number;
}

export type ConsoleTrayState = "off" | "starting" | "running" | "tray-only" | "no-console" | "failed";

/** The helper script: `assets/console-tray.ps1` next to `src` or `dist` (the server build copies assets). */
export function resolveConsoleTrayScriptPath(): string {
  return fileURLToPath(new URL(`../../assets/${CONSOLE_TRAY_SCRIPT_NAME}`, import.meta.url));
}

/** The app icon (`win/installer/app-icon.ico` at the repository root) when this is a checkout that has it. */
export function findConsoleTrayIcon(start = dirname(fileURLToPath(import.meta.url))): string | null {
  let dir = start;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, "win", "installer", "app-icon.ico");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** The address a local browser should open, as start.bat builds it: a wildcard host becomes 127.0.0.1. */
export function consoleTrayBrowserUrl(protocol: string, host: string, port: number): string {
  const trimmed = host.trim();
  let browserHost = !trimmed || trimmed === "0.0.0.0" || trimmed === "::" || trimmed === "[::]" ? "127.0.0.1" : trimmed;
  if (browserHost.includes(":") && !browserHost.startsWith("[")) browserHost = `[${browserHost}]`;
  return `${protocol}://${browserHost}:${port}`;
}

function powershellPath(): string {
  const systemRoot = process.env.SystemRoot || process.env.windir;
  if (systemRoot) {
    const full = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (existsSync(full)) return full;
  }
  return "powershell.exe";
}

export class ConsoleTrayController {
  private child: ChildProcess | null = null;
  private stopping: Promise<void> | null = null;
  private expectedExit = new WeakSet<ChildProcess>();
  private state: ConsoleTrayState = "off";
  private disposed = false;
  private readonly platform: NodeJS.Platform;
  private readonly spawnHelper: ConsoleTraySpawner;
  private readonly isEnabled: () => boolean;

  constructor(private readonly options: ConsoleTrayOptions) {
    this.platform = options.platform ?? process.platform;
    this.spawnHelper = options.spawn ?? nodeSpawn;
    this.isEnabled = options.isEnabled ?? (() => isFeatureEnabled("consoleTray"));
  }

  getState(): ConsoleTrayState {
    return this.state;
  }

  isRunning(): boolean {
    return this.child !== null;
  }

  /** Start or stop the helper to match the switch. Safe to call at any time and as often as needed. */
  sync(): void {
    // A save arrives inside its request; the helper outlives it, so its lines must not carry that requestId.
    runWithRootLogContext({ operation: "console-tray" }, () => this.syncNow());
  }

  private syncNow(): void {
    if (this.disposed) return;
    let wanted = false;
    try {
      wanted = this.platform === "win32" && this.isEnabled();
    } catch {
      wanted = false;
    }
    if (wanted) {
      // A console that was not there at start will not appear later; retry only after an off/on toggle.
      if (!this.child && !this.stopping && this.state !== "no-console" && this.state !== "failed") this.start();
      return;
    }
    if (this.state === "no-console" || this.state === "failed") this.state = "off";
    if (this.child) void this.stop("switch-off");
  }

  /** Stop the helper for good (server shutdown). The helper restores the console before it exits. */
  dispose(): Promise<void> {
    this.disposed = true;
    return runWithRootLogContext({ operation: "console-tray" }, () => this.stop("shutdown"));
  }

  private start(): void {
    const scriptPath = this.options.scriptPath ?? resolveConsoleTrayScriptPath();
    if (!existsSync(scriptPath)) {
      this.fail("script-missing", undefined, { path: scriptPath });
      return;
    }
    const iconPath = this.options.iconPath === undefined ? findConsoleTrayIcon() : this.options.iconPath;
    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Sta",
      "-WindowStyle",
      "Hidden",
      "-File",
      scriptPath,
      "-ParentPid",
      String(this.options.parentPid ?? process.pid),
      "-Url",
      this.options.url,
      "-Port",
      String(this.options.port),
      ...(iconPath ? ["-IconPath", iconPath] : []),
    ];

    let child: ChildProcess;
    try {
      // All three streams are pipes, so Windows starts the helper with no console of its own
      // (CREATE_NO_WINDOW). It can therefore never show or hide a console by accident; it attaches
      // to ours only long enough to learn its window handle. Not detached: a detached PowerShell
      // with piped stdio exits at once. Node's kill-on-exit job ends the helper with this process;
      // the helper's watchdog (outside the job) then shows the console again if it was hidden.
      child = this.spawnHelper(powershellPath(), args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: process.env,
      });
    } catch (err) {
      this.fail("spawn-failed", err);
      return;
    }
    this.child = child;
    this.state = "starting";
    let stderrTail = "";

    child.on("error", (err) => {
      if (this.child === child) this.child = null;
      this.fail("spawn-failed", err);
    });
    child.stdin?.on("error", () => {
      // EPIPE after the helper exited; the exit handler reports it.
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_CHARS);
    });
    if (child.stdout) {
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line) => this.handleLine(child, line));
    }
    child.once("exit", (code, signal) => {
      if (this.child === child) this.child = null;
      if (this.expectedExit.has(child) || this.state === "no-console") return;
      this.fail("helper-exited", undefined, {
        exitCode: code,
        signal,
        ...(stderrTail.trim() ? { stderr: stderrTail.trim() } : {}),
      });
    });
  }

  private handleLine(child: ChildProcess, raw: string): void {
    const line = raw.trim();
    if (!line) return;
    const space = line.indexOf(" ");
    const verb = space === -1 ? line : line.slice(0, space);
    const rest = space === -1 ? "" : line.slice(space + 1).trim();
    switch (verb) {
      case "ready": {
        const [mode, reason] = rest.split(/\s+/, 2);
        if (mode === "tray-only") {
          this.state = "tray-only";
          logger.info(
            {
              event: "console_tray.start",
              mode: "tray-only",
              reason: reason || "pseudo-console",
              helperPid: child.pid,
            },
            "[console-tray] Tray icon started; the console is not hidden because it runs in Windows Terminal or another pseudo console host, where hiding could take other tabs with it",
          );
        } else {
          this.state = "running";
          logger.info(
            { event: "console_tray.start", mode: "hide", helperPid: child.pid, port: this.options.port },
            "[console-tray] Tray icon started; minimizing the console hides it to the tray",
          );
        }
        return;
      }
      case "noconsole":
        this.state = "no-console";
        this.expectedExit.add(child);
        logger.info(
          { event: "console_tray.skipped", reason: rest || "no-console" },
          "[console-tray] No visible console window; tray icon not started",
        );
        return;
      case "quit":
        logger.info({ event: "console_tray.quit" }, "[console-tray] Quit requested from the tray icon");
        try {
          this.options.onQuit();
        } catch (err) {
          this.fail("quit-failed", err);
        }
        return;
      case "open":
        logger.debug({ event: "console_tray.open", url: rest }, "[console-tray] Opened Marinara in the browser");
        return;
      case "error":
        logRateLimited(
          "warn",
          FAILURE_REPEAT_KEY,
          { event: "console_tray.failed", reason: rest.split(/\s+/, 1)[0] || "helper-error", detail: rest },
          "[console-tray] Tray helper reported a problem",
        );
        return;
      default:
        logger.debug(
          { event: "console_tray.failed", reason: "unknown-line", detail: line.slice(0, 200) },
          "[console-tray] Unknown helper line",
        );
    }
  }

  private stop(reason: "switch-off" | "shutdown"): Promise<void> {
    if (this.stopping) return this.stopping;
    const child = this.child;
    if (!child) {
      if (reason === "shutdown") this.state = "off";
      return Promise.resolve();
    }
    this.expectedExit.add(child);
    const wasShown = this.state === "running" || this.state === "tray-only";
    this.stopping = new Promise<void>((resolveStop) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.child === child) this.child = null;
        this.stopping = null;
        this.state = "off";
        if (wasShown) {
          logger.info({ event: "console_tray.stop", reason }, "[console-tray] Tray icon stopped");
        }
        resolveStop();
      };
      const timer = setTimeout(() => {
        // The helper did not answer. It still exits (and restores the console) when this process
        // does; for a switch-off, end it now so no stale icon stays behind.
        if (reason === "switch-off") {
          try {
            child.kill();
          } catch (err) {
            // Already gone.
            logger.debug({ event: "console_tray.stop", stage: "kill", err }, "[console-tray] Helper already gone");
          }
        }
        finish();
      }, STOP_TIMEOUT_MS);
      timer.unref?.();
      if (child.exitCode !== null || child.signalCode !== null) {
        finish();
        return;
      }
      child.once("exit", finish);
      try {
        child.stdin?.write("stop\n");
        child.stdin?.end();
      } catch (err) {
        // The exit handler or the timer finishes the stop.
        logger.debug(
          { event: "console_tray.stop", stage: "stdin-stop", err },
          "[console-tray] Could not ask the helper to stop",
        );
      }
    });
    return this.stopping;
  }

  private fail(reason: string, err?: unknown, fields: Record<string, unknown> = {}): void {
    this.state = "failed";
    logRateLimited(
      "warn",
      FAILURE_REPEAT_KEY,
      { event: "console_tray.failed", reason, ...(err !== undefined ? { err } : {}), ...fields },
      "[console-tray] Tray icon unavailable; the server keeps running normally",
    );
  }
}

let active: ConsoleTrayController | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Start following the `consoleTray` switch for this server: the helper starts now when the switch
 * is on, and starts or stops whenever the switch (or MARINARA_CONSOLE_TRAY in .env) changes.
 * Never throws.
 */
export function startConsoleTrayService(options: ConsoleTrayOptions): ConsoleTrayController | null {
  try {
    if (active) return active;
    const controller = new ConsoleTrayController(options);
    active = controller;
    unsubscribe = onFeatureSettingsChange(() => controller.sync());
    controller.sync();
    return controller;
  } catch (err) {
    logRateLimited(
      "warn",
      FAILURE_REPEAT_KEY,
      { event: "console_tray.failed", reason: "start-failed", err },
      "[console-tray] Tray icon unavailable; the server keeps running normally",
    );
    return null;
  }
}

/** Stop the helper at shutdown; it restores the console first. Resolves within about 1.5 s. */
export function stopConsoleTrayService(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  const controller = active;
  active = null;
  return controller ? controller.dispose().catch(() => undefined) : Promise.resolve();
}
