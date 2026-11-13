// The shared package's compile step, after its registries are generated (package.json `build` and `build:preserve`).
//
// #8902: since 2.5.2 the ruleset schemas and combat code make tsc's full type-check and declaration emit need about
// 1.3 GiB of heap. Termux runs every build in the 1 GiB the launcher gives Node, so "Building shared types" aborted with
// "JavaScript heap out of memory" and the app never started. On Android, and wherever MARINARA_LOW_MEMORY_BUILD=1 asks
// for it (as the server's and client's build scripts do), tsc emits the same JavaScript with no type-check and no
// declaration files: about 470 MB. Nothing on those builds reads the declarations (the server is transpiled with
// esbuild and Vite reads JavaScript), and CI and desktop builds still type-check and emit them in full.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Android, or a build that asked for low memory: the server's and client's own test for it. */
export function isLowMemoryBuild({ platform = process.platform, env = process.env } = {}) {
  return platform === "android" || env.MARINARA_LOW_MEMORY_BUILD === "1";
}

/** The tsc arguments for this build: a full build, or (low memory) JavaScript only, unchecked. */
export function sharedTscArgs(options = {}) {
  return isLowMemoryBuild(options)
    ? [
        "--noCheck",
        "--composite",
        "false",
        "--declaration",
        "false",
        "--declarationMap",
        "false",
        "--incremental",
        "false",
      ]
    : [];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = sharedTscArgs();
  if (args.length) console.log("[build] Android/low-memory shared build: emitting JavaScript without type-checking.");
  const tsc = spawn(process.execPath, [fileURLToPath(import.meta.resolve("typescript/bin/tsc")), ...args], {
    stdio: "inherit",
  });
  // A launcher stopped during its build stops this script; stop tsc with it.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => tsc.kill(signal));
  tsc.once("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  tsc.once("close", (status) => process.exit(status ?? 1));
}
