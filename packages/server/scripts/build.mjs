import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const SRC_DIR = resolve(PACKAGE_ROOT, "src");
const DIST_DIR = resolve(PACKAGE_ROOT, "dist");
const TSC_CLI = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));
const LOW_MEMORY_BUILD = process.platform === "android" || process.env.MARINARA_LOW_MEMORY_BUILD === "1";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ...options.env },
    shell: options.shell ?? false,
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

// Source modules (every .ts under src, not .d.ts) that have no dist/<same path>.js.
function missingDistModules() {
  return collectTsFiles(SRC_DIR)
    .filter((file) => !file.endsWith(".d.ts"))
    .map((file) => relative(SRC_DIR, file))
    .filter((rel) => !existsSync(resolve(DIST_DIR, rel.replace(/\.ts$/, ".js"))))
    .map((rel) => rel.split(sep).join("/"));
}

// A stale tsconfig.tsbuildinfo can make tsc skip emitting modules that dist lacks,
// which then fail at runtime as "Cannot find module". Rebuild once, then fail loudly.
function verifyDist(rebuild) {
  let missing = missingDistModules();
  if (missing.length === 0) return;
  if (rebuild) {
    console.log(
      `[build] ${missing.length} source modules have no compiled output (tsbuildinfo was stale); rebuilding once`,
    );
    rmSync(resolve(PACKAGE_ROOT, "tsconfig.tsbuildinfo"), { force: true });
    rebuild();
    missing = missingDistModules();
    if (missing.length === 0) return;
  }
  console.error(`[build] ${missing.length} source modules still have no compiled output:`);
  for (const path of missing.slice(0, 20)) console.error(`  ${path}`);
  process.exit(1);
}

if (LOW_MEMORY_BUILD) {
  await buildLowMemoryServer();
  verifyDist();
} else {
  run(process.execPath, [TSC_CLI]);
  verifyDist(() => run(process.execPath, [TSC_CLI]));
}

run(process.execPath, [resolve(__dirname, "write-build-meta.mjs")], { shell: false });
copyRuntimeAssets();
