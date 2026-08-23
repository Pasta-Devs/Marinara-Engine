import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(repoRoot, "node_modules", ".bin");

/**
 * Resolves a command name to an executable path. On Windows, npm/pnpm expose
 * binaries through `node_modules/.bin/<name>.CMD` shims, which are only on
 * PATH when invoked through `pnpm run`/`pnpm exec`. When we spawn a child
 * directly we must resolve the shim ourselves.
 */
function resolveCommand(command) {
  if (process.platform === "win32") {
    const cmdShim = join(binDir, `${command}.CMD`);
    if (existsSync(cmdShim)) return cmdShim;
    const psShim = join(binDir, `${command}.ps1`);
    if (existsSync(psShim)) return psShim;
  }
  const direct = join(binDir, command);
  if (existsSync(direct)) return direct;
  return command;
}

/**
 * Runs a command with extra environment variables set, cross-platform.
 *
 * Usage: node scripts/with-env.mjs KEY=VALUE [KEY=VALUE ...] -- <command> [args...]
 *
 * This exists so npm scripts can set environment variables without depending
 * on `cross-env` (which is not a dependency of this repo). On Windows, npm
 * scripts run under cmd.exe, which does not support the `KEY=VALUE command`
 * inline syntax that POSIX shells do.
 */

const args = process.argv.slice(2);
const separatorIndex = args.indexOf("--");

if (separatorIndex === -1) {
  console.error("Usage: node scripts/with-env.mjs KEY=VALUE [...] -- <command> [args...]");
  process.exit(2);
}

const envAssignments = args.slice(0, separatorIndex);
const commandArgs = args.slice(separatorIndex + 1);

if (commandArgs.length === 0) {
  console.error("No command provided after `--`.");
  process.exit(2);
}

const env = { ...process.env };
for (const assignment of envAssignments) {
  const equalsIndex = assignment.indexOf("=");
  if (equalsIndex <= 0) {
    console.error(`Invalid environment assignment: ${assignment}`);
    process.exit(2);
  }
  const key = assignment.slice(0, equalsIndex);
  const value = assignment.slice(equalsIndex + 1);
  env[key] = value;
}

const [command, ...rest] = commandArgs;
const resolvedCommand = resolveCommand(command);

// On Windows, `.CMD` shims must be run through cmd.exe. Spawning them with
// `shell: true` triggers Node's DEP0190 deprecation warning, so invoke
// cmd.exe explicitly instead.
const isCmdShim = process.platform === "win32" && resolvedCommand.endsWith(".CMD");
const child = isCmdShim
  ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", resolvedCommand, ...rest], {
      stdio: "inherit",
      env,
    })
  : spawn(resolvedCommand, rest, {
      stdio: "inherit",
      env,
    });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});