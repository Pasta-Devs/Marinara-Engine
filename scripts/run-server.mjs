import { spawn } from "node:child_process";
import { constants, totalmem } from "node:os";
import { getHeapStatistics } from "node:v8";
import { isIP } from "node:net";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { findChangedBuildFile } from "../packages/server/scripts/write-build-meta.mjs";
import { readLauncherEnvValue } from "./read-launcher-env.mjs";

const SERVER_ROOT = fileURLToPath(new URL("../packages/server/", import.meta.url));
const serverArgs = process.argv.slice(2);
const browserArgIndex = serverArgs.indexOf("--open-browser");
let browserUrl = null;
if (browserArgIndex !== -1) {
  const [, rawUrl] = serverArgs.splice(browserArgIndex, 2);
  if (!rawUrl || rawUrl.startsWith("--") || serverArgs.includes("--open-browser")) {
    process.stderr.write("Could not start Marinara Engine: --open-browser requires exactly one URL value.\n");
    process.exit(1);
  }
  // Browser launchers put the entry first; Node options go before this wrapper
  // and are already forwarded through process.execArgv.
  if (serverArgs.length === 0 || serverArgs[0].startsWith("-")) {
    process.stderr.write("Could not start Marinara Engine: a server entrypoint is required with --open-browser.\n");
    process.exit(1);
  }
  try {
    // Launchers append :PORT to HOST. Bracket only a verified raw IPv6 literal,
    // keeping the existing port, Android entry path and query intact.
    const ipv6 = /^(https?:\/\/)([\da-f:.]+):(\d+)([/?#].*)?$/iu.exec(rawUrl);
    const url = new URL(ipv6 && isIP(ipv6[2]) === 6 ? `${ipv6[1]}[${ipv6[2]}]:${ipv6[3]}${ipv6[4] ?? ""}` : rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    browserUrl = url.href;
  } catch {
    process.stderr.write(
      "  [WARN] Cannot open the browser automatically: expected a valid HTTP or HTTPS URL. The server will still start.\n",
    );
  }
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? "explorer.exe"
      : process.platform === "darwin"
        ? "open"
        : process.platform === "android" || process.env.PREFIX?.includes("com.termux")
          ? "termux-open-url"
          : "xdg-open";
  // Pass the URL as an argument, never as shell code (including on Windows).
  const opener = spawn(command, [url], { stdio: "ignore", windowsHide: true, detached: true });
  opener.once("error", (error) => {
    process.stderr.write(`  [WARN] Could not open the browser (${error.message}). Open ${url} manually.\n`);
  });
  opener.unref();
}
// Only the launchers' own build is checked; a private build that a developer tool starts is left alone.
const startsServerBuild = serverArgs.some((arg) => relative(join(SERVER_ROOT, "dist"), arg) === "index.js");

// #6984: a built file changed after its build (a damaged write, an edit) stops every start, and the
// launchers rebuild only when the version or commit changes. Rebuild before starting instead.
// ponytail: only the server's own build records hashes, so a damaged packages/shared or client file is
// not caught here. If that shows up, record hashes in those builds too and check them the same way.
async function rebuildChangedServer() {
  const changed = startsServerBuild ? findChangedBuildFile() : null;
  if (!changed) return true;
  process.stderr.write(
    `\n  [WARN] A server file was changed or damaged after it was built: dist/${changed}\n  [..] Rebuilding the server. This can take a minute...\n\n`,
  );
  // The build is the current child, so a stop reaches it the same way it reaches the server.
  child = spawn(process.execPath, [join(SERVER_ROOT, "scripts", "build.mjs")], {
    cwd: SERVER_ROOT,
    stdio: "inherit",
  });
  const code = await exitCode(child);
  if (stopping) return false;
  if (code === 0) return true;
  process.stderr.write(
    "\n  [ERROR] Could not rebuild the server. See the error above, then reinstall Marinara Engine or run: pnpm build\n\n",
  );
  return false;
}

function exitCode(proc) {
  return new Promise((resolve) => {
    proc.once("error", (error) => {
      process.stderr.write(`Could not start Marinara Engine: ${error.message}\n`);
      resolve(1);
    });
    proc.once("close", (status, signal) => resolve(status ?? 128 + (constants.signals[signal] ?? 0)));
  });
}

// Node sizes its heap from the machine's RAM, but not the same way everywhere: an 8 GB Windows laptop
// got about 2 GiB and crashed with "Reached heap limit ... JavaScript heap out of memory" (exit 134),
// while Node 24 on a 16 GiB Linux PC allows about 8 GiB. Where Node's own limit is below half of RAM,
// raise it to half, at most 4 GiB. MARINARA_NODE_HEAP_MB=<MiB>, in the environment or the .env file,
// sets it outright. An explicit --max-old-space-size anywhere (NODE_OPTIONS, these flags, the Termux
// launcher's own sizing) still wins, and Termux is left to its launcher.
const MIB = 1024 * 1024;
const HEAP_FLAG = /(?:^|\s)--max[-_]old[-_]space[-_]size(?:[=\s]|$)/u;
const AUTO_HEAP_CAP_MB = 4096;
// Node accepts quoted options in NODE_OPTIONS ('"--max-old-space-size=1024"'); quotes are dropped
// before matching so a quoted limit still counts as explicit.
const explicitHeapFlag = [
  (process.env.NODE_OPTIONS ?? "").replace(/["']/gu, ""),
  ...process.execArgv,
  ...serverArgs,
].some((value) => HEAP_FLAG.test(value));
function chooseServerHeapMb() {
  if (explicitHeapFlag || !startsServerBuild) return null;
  let configured = process.env.MARINARA_NODE_HEAP_MB;
  try {
    configured ??=
      readLauncherEnvValue(readFileSync(join(SERVER_ROOT, "../../.env"), "utf8"), "MARINARA_NODE_HEAP_MB") ?? undefined;
  } catch {
    // No .env yet.
  }
  const heapMb = Number(configured?.trim());
  if (Number.isSafeInteger(heapMb) && heapMb >= 256) return heapMb;
  if (process.platform === "android") return null;
  const constrained = typeof process.constrainedMemory === "function" ? process.constrainedMemory() : 0;
  const memory = constrained > 0 && constrained < totalmem() ? constrained : totalmem();
  const halfMb = Math.min(AUTO_HEAP_CAP_MB, Math.floor(memory / MIB / 2 / 256) * 256);
  return halfMb > Math.floor(getHeapStatistics().heap_size_limit / MIB) ? halfMb : null;
}
const serverHeapMb = chooseServerHeapMb();
if (serverHeapMb) {
  process.stdout.write(
    `  [OK] Memory limit for the server: ${serverHeapMb} MiB (this device has ${Math.round(totalmem() / 1024 / MIB)} GiB)\n`,
  );
}

// V8 aborts with exit code 134 (SIGABRT) when the heap is full. Explain it in plain words and start the
// server again: everything saved before the crash is on disk. A server that keeps running out right
// after starting is not restarted again and again; it stops with the same advice.
const OUT_OF_MEMORY_EXIT = 134;
const OOM_RESTART_LIMIT = 3;
const OOM_RESTART_WINDOW_MS = 60 * 60 * 1000;
const OOM_MIN_UPTIME_MS = 60 * 1000;
const oomRestarts = [];
function explainOutOfMemory(restarting, soonAfterStart) {
  const limit = serverHeapMb ?? Math.floor(getHeapStatistics().heap_size_limit / MIB);
  process.stderr.write(
    [
      "",
      `  [ERROR] Marinara Engine most likely ran out of memory (its limit is about ${limit} MiB) and stopped.`,
      "          Your chats are safe: everything saved before this is on disk.",
      restarting
        ? "  [..] Starting the server again. Reload the page in your browser when it is back."
        : soonAfterStart
          ? "          It ran out right after starting, so it was not restarted automatically."
          : "          It ran out of memory several times this hour, so it was not restarted automatically.",
      "          To give it more room, close other heavy programs, or raise the limit:",
      explicitHeapFlag
        ? "          change --max-old-space-size=<MiB> in NODE_OPTIONS (or the Termux launcher's setting)."
        : process.env.MARINARA_NODE_HEAP_MB !== undefined
          ? "          change or remove MARINARA_NODE_HEAP_MB in your environment (it overrides .env)."
          : "          set MARINARA_NODE_HEAP_MB=<MiB> (for example 6144 on a PC with 16 GB of RAM) in .env.",
      "",
    ].join("\n"),
  );
}

// Keep restart ownership in the launcher's console. Start the replacement only
// after the old process exits, releasing its port and storage writer lease.
let child;
let stopping = false;
let stopTimer;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    // Windows already broadcasts console Ctrl+C to the server. child.kill()
    // force-terminates it there, preventing its graceful shutdown from flushing saves.
    // POSIX still needs forwarding for signals addressed only to this launcher.
    if (process.platform !== "win32") child?.kill(signal);
    stopTimer = setTimeout(() => child?.kill("SIGKILL"), 10_000);
    stopTimer.unref();
  });
}

while (true) {
  if (!(await rebuildChangedServer())) {
    process.exitCode = stopping ? 130 : 1;
    break;
  }
  const startedAt = Date.now();
  child = spawn(
    process.execPath,
    [...process.execArgv, ...(serverHeapMb ? [`--max-old-space-size=${serverHeapMb}`] : []), ...serverArgs],
    {
      stdio: browserUrl ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
      env: { ...process.env, MARINARA_RESTART_SUPERVISOR: String(process.pid) },
    },
  );
  child.on("message", (message) => {
    if (stopping || !browserUrl || message?.type !== "marinara:ready") return;
    const url = browserUrl;
    browserUrl = null; // In-app restarts and repeated ready messages must not open extra tabs.
    openBrowser(url);
  });
  const code = await exitCode(child);
  if (!stopping && code === OUT_OF_MEMORY_EXIT && startsServerBuild) {
    const now = Date.now();
    while (oomRestarts.length > 0 && now - oomRestarts[0] > OOM_RESTART_WINDOW_MS) oomRestarts.shift();
    const soonAfterStart = now - startedAt < OOM_MIN_UPTIME_MS;
    const restart = !soonAfterStart && oomRestarts.length < OOM_RESTART_LIMIT;
    explainOutOfMemory(restart, soonAfterStart);
    if (restart) {
      oomRestarts.push(now);
      continue;
    }
  }
  if (stopping || code !== 75) {
    clearTimeout(stopTimer);
    process.exitCode ??= code;
    break;
  }
}
