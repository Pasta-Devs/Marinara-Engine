import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChangedBuildFile, writeBuildMeta } from "./write-build-meta.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const SRC_DIR = resolve(PACKAGE_ROOT, "src");
const DIST_DIR = resolve(PACKAGE_ROOT, "dist");
const TSC_CLI = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));
const LOW_MEMORY_BUILD = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1";

function collectTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function buildLowMemoryServer() {
  console.log("[build] Android/low-memory server build: transpiling with esbuild.");
  const { build } = await import("esbuild");
  rmSync(DIST_DIR, { recursive: true, force: true });
  await build({
    entryPoints: collectTsFiles(SRC_DIR),
    outbase: SRC_DIR,
    outdir: DIST_DIR,
    platform: "node",
    format: "esm",
    target: "es2022",
    bundle: false,
    sourcemap: true,
    logLevel: "info",
  });
}

function copyRuntimeAssets() {
  mkdirSync(resolve(DIST_DIR, "db"), { recursive: true });
  for (const preset of ["default-preset.json", "novel-preset.json"]) {
    cpSync(resolve(SRC_DIR, "db", preset), resolve(DIST_DIR, "db", preset));
  }
  if (existsSync(resolve(SRC_DIR, "assets"))) {
    cpSync(resolve(SRC_DIR, "assets"), resolve(DIST_DIR, "assets"), { recursive: true });
  }
}

if (LOW_MEMORY_BUILD) {
  await buildLowMemoryServer();
} else {
  // #6984: tsc rewrites only files whose source changed, so a built file that was damaged, edited or
  // deleted after its build survived every rebuild. Without its saved state, tsc writes every file again.
  if (findChangedBuildFile() !== null) rmSync(resolve(PACKAGE_ROOT, "tsconfig.tsbuildinfo"), { force: true });
  const tsc = spawn(process.execPath, [TSC_CLI], { cwd: PACKAGE_ROOT, stdio: "inherit" });
  // A launcher that is stopped during its repair build stops this script; stop tsc with it.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => tsc.kill(signal));
  const status = await new Promise((resolve) => {
    tsc.once("error", () => resolve(null));
    tsc.once("close", resolve);
  });
  // Exit 2 means type errors, but tsc still wrote every file. Record those files below so the next start does
  // not call them damaged, and still fail the build.
  if (status !== 0 && status !== 2) process.exit(status ?? 1);
  process.exitCode = status;
}

copyRuntimeAssets();
writeBuildMeta({ failed: Boolean(process.exitCode) });
