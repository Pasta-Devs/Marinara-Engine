import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const MONOREPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");
const BUILD_META_PATH = resolve(PACKAGE_ROOT, "dist", "config", "build-meta.json");
const SRC_DIR = resolve(PACKAGE_ROOT, "src");
const COMMIT_LENGTH = 12;

function normalizeCommit(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, COMMIT_LENGTH);
}

function resolveCommit() {
  const envCommit = normalizeCommit(process.env.MARINARA_GIT_COMMIT ?? process.env.GITHUB_SHA);
  if (envCommit) return envCommit;

  try {
    return normalizeCommit(
      execFileSync("git", ["rev-parse", `--short=${COMMIT_LENGTH}`, "HEAD"], {
        windowsHide: true,
        cwd: MONOREPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

/** Source inventory, so a running dist can tell whether src changed or gained modules after this build. */
function describeSources() {
  const files = [];
  let newestMtimeMs = 0;
  let newestFile = null;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        const rel = relative(SRC_DIR, fullPath).split(sep).join("/");
        files.push(rel);
        if (stat.mtimeMs > newestMtimeMs) {
          newestMtimeMs = stat.mtimeMs;
          newestFile = rel;
        }
      }
    }
  };
  walk(SRC_DIR);
  files.sort();
  return {
    srcFileCount: files.length,
    srcNewestMtimeMs: Math.round(newestMtimeMs),
    srcNewestFile: newestFile,
    srcFiles: files,
  };
}

mkdirSync(resolve(PACKAGE_ROOT, "dist", "config"), { recursive: true });
writeFileSync(
  BUILD_META_PATH,
  `${JSON.stringify({ commit: resolveCommit(), builtAt: new Date().toISOString(), ...describeSources() }, null, 2)}\n`,
  "utf8",
);
