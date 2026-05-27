import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const viteBin = join(repoRoot, "node_modules", "vite", "bin", "vite.js");

function supportsVite(nodeVersion) {
  const [major = 0, minor = 0] = nodeVersion.split(".").map((part) => Number.parseInt(part, 10));
  return major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
}

function readNodeVersion(command) {
  const result = spawnSync(command, ["-p", "process.versions.node"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function findModernNode() {
  if (supportsVite(process.versions.node)) {
    return { command: process.execPath, args: [viteBin] };
  }

  const candidates = [
    process.env.MARINARA_NODE,
    "/opt/homebrew/opt/node@24/bin/node",
    "/usr/local/opt/node@24/bin/node",
    "/opt/homebrew/opt/node@22/bin/node",
    "/usr/local/opt/node@22/bin/node",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const version = readNodeVersion(candidate);
    if (version && supportsVite(version)) {
      return { command: candidate, args: [viteBin] };
    }
  }

  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  return { command: npxBin, args: ["-y", "node@22", viteBin], shell: process.platform === "win32" };
}

const runner = findModernNode();
const child = spawn(runner.command, [...runner.args, ...process.argv.slice(2)], {
  shell: runner.shell,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
