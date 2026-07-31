/* global console, process */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const packageRequire = createRequire(resolve(PACKAGE_ROOT, "package.json"));
const TSC_CLI = packageRequire.resolve("typescript/bin/tsc");
const VITE_CLI = resolve(dirname(packageRequire.resolve("vite/package.json")), "bin/vite.js");
const LOW_MEMORY_BUILD = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1";

function run(script, args, options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...options.env },
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
