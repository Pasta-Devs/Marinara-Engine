import { spawn } from "node:child_process";
import { constants } from "node:os";
import { isIP } from "node:net";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findChangedBuildFile } from "../packages/server/scripts/write-build-meta.mjs";

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
  child = spawn(process.execPath, [...process.execArgv, ...serverArgs], {
    stdio: browserUrl ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
    env: { ...process.env, MARINARA_RESTART_SUPERVISOR: String(process.pid) },
  });
  child.on("message", (message) => {
    if (stopping || !browserUrl || message?.type !== "marinara:ready") return;
    const url = browserUrl;
    browserUrl = null; // In-app restarts and repeated ready messages must not open extra tabs.
    openBrowser(url);
  });
  const code = await exitCode(child);
  if (stopping || code !== 75) {
    clearTimeout(stopTimer);
    process.exitCode ??= code;
    break;
  }
}
