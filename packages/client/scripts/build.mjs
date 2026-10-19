/* global console, process */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveClientBuildHeapMb, resolveDesktopClientBuildHeapMb } from "./build-heap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const packageRequire = createRequire(resolve(PACKAGE_ROOT, "package.json"));
const TSC_CLI = packageRequire.resolve("typescript/bin/tsc");
const VITE_CLI = resolve(dirname(packageRequire.resolve("vite/package.json")), "bin/vite.js");
const LOW_MEMORY_BUILD = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1";
const BUILD_HEAP_MB = LOW_MEMORY_BUILD
  ? resolveClientBuildHeapMb({ lowMemory: true })
  : resolveDesktopClientBuildHeapMb();
// Marks the children as started by this script, so vite.config.ts does not hand them back here.
const BUILD_ENV = { MARINARA_CLIENT_BUILD_SCRIPT: "1" };
if (BUILD_HEAP_MB) {
  // The last --max-old-space-size wins; only this build's children get it, not the running server.
  BUILD_ENV.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${BUILD_HEAP_MB}`.trim();
  console.log(`[build] Client build heap limit: ${BUILD_HEAP_MB} MiB.`);
}

function run(script, args, options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...BUILD_ENV, ...options.env },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (LOW_MEMORY_BUILD) {
  console.log("[build] Android/low-memory client build: skipping tsc and PWA generation.");
  run(VITE_CLI, ["build"], { env: { SKIP_PWA: "1" } });
} else {
  run(TSC_CLI, ["-b"]);
  run(VITE_CLI, ["build"]);
}

run(resolve(__dirname, "build-multiplayer-guest.mjs"), []);
