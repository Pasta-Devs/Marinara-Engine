import { posix, win32 } from "node:path";

/** Resolve the pnpm process descriptor used by repository-owned launchers. */
export function resolvePnpmRunner({
  platform = process.platform,
  environment = process.env,
  execPath = process.execPath,
} = {}) {
  const pnpmCliPath = environment.npm_execpath;
  const npmUserAgent = environment.npm_config_user_agent ?? "";
  const pathApi = platform === "win32" ? win32 : posix;
  // Standalone pnpm installs expose a native binary (pnpm.exe on Windows) as npm_execpath;
  // Node cannot execute that file, so only reuse the current Node process for the JS CLI.
  const isJavaScriptPnpmCli = Boolean(pnpmCliPath) && /\.(?:c?js|mjs)$/iu.test(pathApi.basename(pnpmCliPath ?? ""));
  const useCurrentPnpm =
    isJavaScriptPnpmCli &&
    (npmUserAgent.startsWith("pnpm/") || pathApi.basename(pnpmCliPath ?? "").startsWith("pnpm"));

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
