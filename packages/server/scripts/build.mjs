import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const SRC_DIR = resolve(PACKAGE_ROOT, "src");
const DIST_DIR = resolve(PACKAGE_ROOT, "dist");
const LOW_MEMORY_BUILD = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...options.env },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

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
  cpSync(resolve(SRC_DIR, "db", "default-preset.json"), resolve(DIST_DIR, "db", "default-preset.json"));
  if (existsSync(resolve(SRC_DIR, "assets"))) {
    cpSync(resolve(SRC_DIR, "assets"), resolve(DIST_DIR, "assets"), { recursive: true });
  }
}

if (LOW_MEMORY_BUILD) {
  await buildLowMemoryServer();
} else {
  run("tsc", []);
}

run(process.execPath, [resolve(__dirname, "write-build-meta.mjs")]);
copyRuntimeAssets();
