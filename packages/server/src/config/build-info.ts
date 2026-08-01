import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "@marinara-engine/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_ROOT = resolve(__dirname, "../..");
const MONOREPO_ROOT = resolve(SERVER_ROOT, "../..");
const BUILD_META_PATH = resolve(__dirname, "build-meta.json");
const COMMIT_LENGTH = 12;

type BuildMeta = {
  commit?: string | null;
  branch?: string | null;
};

let cachedCommit: string | null | undefined;
let cachedBranch: string | null | undefined;
let cachedBuildMeta: BuildMeta | null | undefined;

function normalizeCommit(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, COMMIT_LENGTH);
}

function isBuildMeta(value: unknown): value is BuildMeta {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { commit?: unknown; branch?: unknown };
  return (
    (candidate.commit === undefined || candidate.commit === null || typeof candidate.commit === "string") &&
    (candidate.branch === undefined || candidate.branch === null || typeof candidate.branch === "string")
  );
}

export function parseBuildMeta(value: string | null | undefined): BuildMeta | null {
  if (value == null) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isBuildMeta(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readBuildMeta() {
  if (cachedBuildMeta !== undefined) return cachedBuildMeta;
  if (!existsSync(BUILD_META_PATH)) {
    cachedBuildMeta = null;
    return cachedBuildMeta;
  }

  try {
    cachedBuildMeta = parseBuildMeta(readFileSync(BUILD_META_PATH, "utf8"));
  } catch {
    cachedBuildMeta = null;
  }
  return cachedBuildMeta;
}

function readBuiltCommit() {
  return normalizeCommit(readBuildMeta()?.commit);
}

export function getBuildCommit() {
  if (cachedCommit !== undefined) return cachedCommit;

  const builtCommit = readBuiltCommit();
  if (builtCommit) {
    cachedCommit = builtCommit;
    return cachedCommit;
  }

  const envCommit = normalizeCommit(process.env.MARINARA_GIT_COMMIT ?? process.env.GITHUB_SHA);
  if (envCommit) {
    cachedCommit = envCommit;
    return cachedCommit;
  }

  if (!existsSync(resolve(MONOREPO_ROOT, ".git"))) {
    cachedCommit = null;
    return cachedCommit;
  }

  try {
    const commit = execFileSync("git", ["rev-parse", `--short=${COMMIT_LENGTH}`, "HEAD"], {
      cwd: MONOREPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    cachedCommit = commit || null;
  } catch {
    cachedCommit = null;
  }

  return cachedCommit;
}

function normalizeBranch(value: string | undefined | null) {
  const trimmed = value?.trim().replace(/^refs\/heads\//u, "");
  return trimmed || null;
}

export function resolveBuildBranch(
  envBranch: string | null | undefined,
  builtBranch: string | null | undefined,
  gitBranch: string | null | undefined,
) {
  return normalizeBranch(envBranch) ?? normalizeBranch(builtBranch) ?? normalizeBranch(gitBranch);
}

export function getBuildBranch() {
  if (cachedBranch !== undefined) return cachedBranch;

  const configuredBranch = resolveBuildBranch(
    process.env.MARINARA_GIT_BRANCH ?? process.env.GITHUB_REF_NAME,
    readBuildMeta()?.branch,
    undefined,
  );
  if (configuredBranch) {
    cachedBranch = configuredBranch;
    return cachedBranch;
  }

  if (!existsSync(resolve(MONOREPO_ROOT, ".git"))) {
    cachedBranch = null;
    return cachedBranch;
  }

  try {
    cachedBranch = resolveBuildBranch(
      undefined,
      undefined,
      execFileSync("git", ["branch", "--show-current"], {
        cwd: MONOREPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    cachedBranch = null;
  }

  return cachedBranch;
}

export function getBuildLabel() {
  const commit = getBuildCommit();
  return commit ? `${APP_VERSION}+${commit}` : APP_VERSION;
}
