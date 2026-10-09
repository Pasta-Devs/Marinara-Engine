// ──────────────────────────────────────────────
// Claude (Subscription) — host Claude Code install and model catalog
// ──────────────────────────────────────────────
//
// The Agent SDK ships its own Claude Code build, which only changes when the
// SDK dependency is bumped, so newly released models fail until then. The
// native `claude` install updates itself, so prefer it when it is at least as
// new as the bundled build, and read the model list Claude Code caches for the
// signed-in account instead of relying only on the curated list.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { promisify } from "node:util";
import { isClaudeSubscriptionInstalledCliEnabled } from "../../../../config/runtime-config.js";
import { logger } from "../../../../lib/logger.js";

export interface ClaudeCodeInstall {
  path: string;
  version: string;
}

export interface ClaudeCatalogModel {
  id: string;
  name: string;
}

const MODEL_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}(?:\[1m\])?$/iu;
const RESOLVE_TTL_MS = 5 * 60_000;

function parseVersion(text: string): number[] | null {
  const match = /(\d+)\.(\d+)\.(\d+)/u.exec(text);
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Numeric comparison of the first `x.y.z` in each string; NaN when either has none. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return Number.NaN;
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
  return 0;
}

/** Claude Code version bundled with the installed Agent SDK, from its manifest. */
function readBundledClaudeCodeVersion(): string | null {
  try {
    const req = createRequire(import.meta.url);
    const manifest = join(dirname(req.resolve("@anthropic-ai/claude-agent-sdk")), "manifest.json");
    const version = (JSON.parse(readFileSync(manifest, "utf8")) as { version?: unknown }).version;
    return typeof version === "string" && parseVersion(version) ? version : null;
  } catch {
    return null;
  }
}

export const BUNDLED_CLAUDE_CODE_VERSION = readBundledClaudeCodeVersion();

/** The native installer's location first, then `claude` on PATH. */
function candidatePaths(env: NodeJS.ProcessEnv, home: string): string[] {
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const dirs = [join(home, ".local", "bin"), ...(env.PATH ?? "").split(delimiter).filter(Boolean)];
  return [...new Set(dirs.map((dir) => join(dir, exe)))];
}

async function probeVersion(path: string): Promise<string | null> {
  try {
    await access(path);
    const { stdout } = await promisify(execFile)(path, ["--version"], {
      timeout: 5_000,
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024,
    });
    return parseVersion(stdout)?.join(".") ?? null;
  } catch {
    return null;
  }
}

export async function findClaudeCodeInstall(
  bundledVersion: string | null = BUNDLED_CLAUDE_CODE_VERSION,
  { env = process.env, home = homedir(), probe = probeVersion } = {},
): Promise<ClaudeCodeInstall | null> {
  if (!isClaudeSubscriptionInstalledCliEnabled(env.CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI)) return null;
  // Without the bundled version there is no safe floor, so keep the bundled build.
  if (!bundledVersion) return null;
  for (const path of candidatePaths(env, home)) {
    const version = await probe(path);
    if (!version) continue;
    // An older host install could lack options this SDK sends; keep looking, then use the bundled build.
    if (!(compareVersions(version, bundledVersion) >= 0)) continue;
    return { path, version };
  }
  return null;
}

let cachedInstall: { at: number; value: Promise<ClaudeCodeInstall | null> } | null = null;

/** Cached for a few minutes so auto-updates are noticed without probing on every message. */
export function resolveClaudeCodeInstall(): Promise<ClaudeCodeInstall | null> {
  if (!cachedInstall || Date.now() - cachedInstall.at > RESOLVE_TTL_MS) {
    cachedInstall = { at: Date.now(), value: findClaudeCodeInstall() };
  }
  return cachedInstall.value;
}

/** SDK option pointing at the host install, or nothing to keep the bundled build. */
export async function claudeCodeExecutableOption(): Promise<{ pathToClaudeCodeExecutable?: string }> {
  const install = await resolveClaudeCodeInstall();
  // Shorten the home directory so debug logs don't carry the username.
  logger.debug(
    "[claude-subscription] Claude Code executable: %s",
    install
      ? `${install.path.replace(homedir(), "~")} (${install.version})`
      : `bundled (${BUNDLED_CLAUDE_CODE_VERSION ?? "unknown"})`,
  );
  return install ? { pathToClaudeCodeExecutable: install.path } : {};
}

/**
 * Models from Claude Code's cached catalog for the signed-in organization,
 * limited to those the Claude Code build in use can run. Empty when Claude Code
 * has not cached a catalog yet.
 */
export async function readClaudeCodeModelCatalog(
  cliVersion: string | null,
  { env = process.env, home = homedir() } = {},
): Promise<ClaudeCatalogModel[]> {
  const configDir = env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const accountFile = env.CLAUDE_CONFIG_DIR ? join(configDir, ".claude.json") : join(home, ".claude.json");
  try {
    const account = JSON.parse(await readFile(accountFile, "utf8")) as {
      oauthAccount?: { organizationUuid?: unknown };
    };
    const org = account.oauthAccount?.organizationUuid;
    // Never mix in a catalog cached for another account on the same host.
    if (typeof org !== "string" || !org) return [];
    const catalogDir = join(configDir, "cache", "model-catalog");
    const names = (await readdir(catalogDir)).filter((name) => name.startsWith(`${org}-`) && name.endsWith("-cc.json"));
    let newest: { fetchedAt: number; models: unknown[] } | null = null;
    for (const name of names) {
      try {
        const cache = JSON.parse(await readFile(join(catalogDir, name), "utf8"));
        const models = cache?.catalog?.surface === "cc" ? cache.catalog.config?.models : null;
        const fetchedAt = Number(cache?.fetchedAt) || 0;
        if (Array.isArray(models) && (!newest || fetchedAt > newest.fetchedAt)) newest = { fetchedAt, models };
      } catch {
        // A partially written cache file; try the others.
      }
    }
    const result: ClaudeCatalogModel[] = [];
    for (const raw of newest?.models ?? []) {
      const model = raw as { id?: unknown; name?: unknown; min_claude_code_version?: unknown };
      if (typeof model.id !== "string" || !MODEL_ID_RE.test(model.id)) continue;
      const minVersion = typeof model.min_claude_code_version === "string" ? model.min_claude_code_version : null;
      if (minVersion && cliVersion && compareVersions(cliVersion, minVersion) < 0) continue;
      const name = typeof model.name === "string" && model.name.trim() ? `Claude ${model.name.trim()}` : model.id;
      result.push({ id: model.id, name });
    }
    return result;
  } catch {
    return [];
  }
}
