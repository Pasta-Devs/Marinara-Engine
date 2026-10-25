import { posix, resolve, win32 } from "node:path";
import { closeSync, openSync, readSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** pnpm 12 may expose its native executable, rather than a JavaScript CLI. */
export function isNativePnpmExecutable(path) {
  let descriptor;
  try {
    descriptor = openSync(path, "r");
    const header = Buffer.alloc(4);
    if (readSync(descriptor, header, 0, 4, 0) !== 4) return false;
    return (
      header.subarray(0, 2).toString() === "MZ" ||
      ["7f454c46", "feedface", "cefaedfe", "feedfacf", "cffaedfe", "cafebabe", "bebafeca"].includes(
        header.toString("hex"),
      )
    );
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

/** Resolve the pnpm process descriptor used by repository-owned launchers. */
export function resolvePnpmRunner({
  platform = process.platform,
  environment = process.env,
  execPath = process.execPath,
} = {}) {
  const pnpmCliPath = environment.npm_execpath;
  const npmUserAgent = environment.npm_config_user_agent ?? "";
  const pathApi = platform === "win32" ? win32 : posix;
  const isCurrentPnpm = npmUserAgent.startsWith("pnpm/") || pathApi.basename(pnpmCliPath ?? "").startsWith("pnpm");
  if (pnpmCliPath && isCurrentPnpm && isNativePnpmExecutable(pnpmCliPath)) {
    return { command: pnpmCliPath, args: [] };
  }
  // Standalone pnpm installs expose a native pnpm.exe on Windows as npm_execpath;
  // Node cannot execute that file. POSIX launchers may legitimately be extensionless.
  const isNativeWindowsPnpmBinary =
    platform === "win32" && Boolean(pnpmCliPath) && !/\.(?:c?js|mjs)$/iu.test(pathApi.basename(pnpmCliPath ?? ""));
  const useCurrentPnpm = !isNativeWindowsPnpmBinary && isCurrentPnpm;

  if (useCurrentPnpm && pnpmCliPath) {
    return { command: execPath, args: [pnpmCliPath] };
  }

  if (platform === "win32") {
    return {
      command: environment.ComSpec ?? environment.COMSPEC ?? "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm"],
    };
  }

  return { command: "pnpm", args: [] };
}

/** Detach Playwright project children from piped Windows stdin while preserving their output. */
export function resolvePlaywrightProjectStdio(platform = process.platform) {
  return platform === "win32" ? ["ignore", "inherit", "inherit"] : "inherit";
}

// Keep nested workspace scripts on the runner that launched them. A Corepack or
// npx invocation need not put that exact pnpm on PATH, where an older global
// release may otherwise try to perform an unsupported native-version handoff.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const runner = resolvePnpmRunner();
  const result = spawnSync(runner.command, [...runner.args, ...process.argv.slice(2)], { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
