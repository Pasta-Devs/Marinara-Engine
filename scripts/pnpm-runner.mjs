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
  const useCurrentPnpm =
    Boolean(pnpmCliPath) &&
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
