// The parallel half of `pnpm check`. Its serial prelude (stale-client cleanup, the Impeccable and localization
// guards, the shared build) runs first, so these lanes, ESLint's type-aware rules among them, read built shared types.
// Every lane runs to its end, so one failure does not hide another; each output line names its lane; the exit is
// non-zero when any lane fails. MARINARA_CHECK_JOBS caps how many lanes run at once (1 on an 8 GB laptop).
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isLowMemoryBuild } from "../packages/shared/scripts/tsc-build.mjs";
import { resolvePnpmRunner } from "./pnpm-runner.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmLane = (pnpm, name, ...args) => ({ name, command: pnpm.command, args: [...pnpm.args, ...args] });

/** A low-memory build skips type-checking (tsc-build.mjs), so there `check` first runs lint's shared and server passes,
 * one at a time like the serial chain did: server lint rebuilds shared's declarations, which no lane may race. */
export function checkPrelude(pnpm = resolvePnpmRunner(), lowMemory = isLowMemoryBuild()) {
  if (!lowMemory) return [];
  return [
    pnpmLane(pnpm, "shared-types", "--filter", "@marinara-engine/shared", "lint"),
    pnpmLane(pnpm, "server-types", "--filter", "@marinara-engine/server", "lint"),
  ];
}

/** The lanes, longest first so a capped run starts the critical path at once. */
export function checkLanes(pnpm = resolvePnpmRunner(), lowMemory = isLowMemoryBuild()) {
  const run = (...args) => pnpmLane(pnpm, ...args);
  const lanes = [
    // Both builds type-check their package (the server build fails on tsc errors), so `check` skips `lint`'s
    // separate shared and server `tsc --noEmit` passes. `pnpm lint` still runs them.
    run("client-build", "--filter", "@marinara-engine/client", "build"),
    run("server-build", "--filter", "@marinara-engine/server", "build"),
    run("client-lint", "--filter", "@marinara-engine/client", "lint"),
    run("format", "format:check"),
    run("e2e-types", "check:e2e-types"),
    run("token-estimation-types", "check:token-estimation-types"),
    // Server lint's third step: no build covers these regression files.
    {
      name: "character-activity-types",
      command: process.execPath,
      args: [
        fileURLToPath(import.meta.resolve("typescript/bin/tsc")),
        "-p",
        "scripts/regressions/tsconfig.character-activity.json",
      ],
    },
  ];
  // Low memory, server lint in the prelude already ran this one.
  return lowMemory ? lanes.filter((lane) => lane.name !== "character-activity-types") : lanes;
}

/** MARINARA_CHECK_JOBS as a lane count; unset runs every lane at once. */
export function checkJobs(value, laneCount) {
  if (value === undefined || value === "") return laneCount;
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error("MARINARA_CHECK_JOBS must be a positive whole number.");
  return Math.min(Number(value), laneCount);
}

/** Run the lanes, at most `jobs` at a time, and return the names of those that failed. */
export async function runLanes(lanes, { jobs = lanes.length, cwd = repositoryRoot, out = process.stdout } = {}) {
  const queue = [...lanes];
  const failed = [];
  const children = new Set();
  const stop = (signal) => {
    queue.length = 0;
    for (const child of children) child.kill(signal);
  };
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) process.on(signal, stop);

  const runOne = ({ name, command, args }) =>
    new Promise((settle) => {
      const startedAt = Date.now();
      const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      children.add(child);
      for (const stream of [child.stdout, child.stderr]) {
        readline
          .createInterface({ input: stream, crlfDelay: Infinity })
          .on("line", (line) => out.write(`[${name}] ${line}\n`));
      }
      let finished = false;
      const finish = (detail) => {
        // A command that cannot start emits "error" and then "close"; report it once.
        if (finished) return;
        finished = true;
        children.delete(child);
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        if (detail) failed.push(name);
        out.write(`[check] ${name} ${detail ? `FAILED (${detail})` : "passed"} in ${seconds}s\n`);
        settle();
      };
      child.once("error", (error) => finish(error.message));
      child.once("close", (code, signal) => finish(code === 0 ? "" : signal ? `signal ${signal}` : `exit ${code}`));
    });

  const worker = async () => {
    while (queue.length > 0) await runOne(queue.shift());
  };
  try {
    await Promise.all(Array.from({ length: Math.min(jobs, lanes.length) }, worker));
  } finally {
    for (const signal of signals) process.off(signal, stop);
  }
  return failed;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const prelude = checkPrelude();
    const lanes = checkLanes();
    const jobs = checkJobs(process.env.MARINARA_CHECK_JOBS, lanes.length);
    if (prelude.length > 0)
      process.stdout.write("[check] Low-memory build: type-checking shared and the server first.\n");
    const failed = await runLanes(prelude, { jobs: 1 });
    process.stdout.write(`[check] Running ${lanes.length} lanes, ${jobs} at a time.\n`);
    failed.push(...(await runLanes(lanes, { jobs })));
    if (failed.length > 0) {
      process.stdout.write(`[check] Failed lanes: ${failed.join(", ")}. Search the log for their [name] prefix.\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`[check] ${error.message}\n`);
    process.exitCode = 1;
  }
}
