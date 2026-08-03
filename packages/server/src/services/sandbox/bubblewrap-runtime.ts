import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { isDockerRuntime } from "../../config/runtime-config.js";

export type BubblewrapRuntimeStatus =
  | { available: true; executable: string }
  | { available: false; executable: null; reason: string };

const BWRAP_CANDIDATES = ["/usr/bin/bwrap", "/bin/bwrap", "/usr/local/bin/bwrap"];
let cachedStatus: BubblewrapRuntimeStatus | null = null;

function findBubblewrap(): string | null {
  return BWRAP_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function probeBubblewrap(executable: string): boolean {
  const args = ["--die-with-parent", "--new-session", "--unshare-all", "--proc", "/proc", "--dev", "/dev"];
  for (const path of ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/etc"]) {
    if (existsSync(path)) args.push("--ro-bind", path, path);
  }
  args.push("/bin/true");
  const result = spawnSync(executable, args, {
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
    stdio: "ignore",
    timeout: 2_000,
  });
  return result.status === 0;
}

export function getBubblewrapRuntimeStatus(): BubblewrapRuntimeStatus {
  if (cachedStatus) return cachedStatus;
  const executable = findBubblewrap();
  if (!executable) {
    cachedStatus = {
      available: false,
      executable: null,
      reason: "Bubblewrap (bwrap) is required but is not installed.",
    };
    return cachedStatus;
  }
  if (probeBubblewrap(executable)) {
    cachedStatus = { available: true, executable };
    return cachedStatus;
  }
  cachedStatus = {
    available: false,
    executable: null,
    reason: isDockerRuntime()
      ? "Bubblewrap is installed, but this Docker container does not permit the nested namespaces and mounts required by the OS sandbox."
      : "Bubblewrap is installed, but the operating system denied the namespaces or mounts required by the sandbox.",
  };
  return cachedStatus;
}
