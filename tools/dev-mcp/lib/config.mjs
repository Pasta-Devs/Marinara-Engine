// Paths and settings, resolved once from the environment and the engine's own .env.
//
// Every setting has a default that works for a normal checkout, so most people set nothing:
//   MARINARA_DEV_REPO          repository root (default: two folders above tools/dev-mcp)
//   MARINARA_DEV_STATE         state folder for backups, the lock, the activity log and large outputs
//                              (default: <repo>/.dev-mcp)
//   MARINARA_DEV_INSTANCE      "live" (default) or "sandbox"
//   MARINARA_DEV_PORT          engine port override (default: PORT from the repo .env, else 7860)
//   MARINARA_DEV_SANDBOX_DIR   sandbox folder (default: <state>/sandbox)
//   MARINARA_DEV_SANDBOX_PORT  sandbox port (default 7862)
//   MARINARA_DEV_SANDBOX_DIST  server build folder the sandbox runs (default "dist")
//   MARINARA_DEV_AGENT         name recorded in the activity log and the engine lock (default "unknown-agent")
//   MARINARA_DEV_PNPM          command used to run pnpm (default "corepack pnpm")
//
// The names use the MARINARA_DEV_ prefix on purpose: the engine reads several MARINARA_* variables itself
// (MARINARA_ENV_FILE, MARINARA_FILE_STORAGE_DIR, ...), and this tool starts engine processes that inherit its env.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "1.0.0";
export const IS_WINDOWS = process.platform === "win32";

const TOOL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = resolve(process.env.MARINARA_DEV_REPO || join(TOOL_DIR, "..", ".."));
export const SERVER_DIR = join(REPO, "packages", "server");
export const REPO_LOOKS_RIGHT = existsSync(join(SERVER_DIR, "package.json"));
if (!REPO_LOOKS_RIGHT) {
  process.stderr.write(
    `[dev-mcp] ${REPO} does not look like a Marinara Engine checkout (no packages/server). ` +
      "Set MARINARA_DEV_REPO to the repository root.\n",
  );
}

/**
 * The env file the engine reads: MARINARA_ENV_FILE (relative to the repo root, as the server resolves it) when set,
 * else the repo .env. Engines this tool starts inherit its environment, so both read the same file. Read-only here.
 */
export const ENGINE_ENV_FILE = process.env.MARINARA_ENV_FILE?.trim()
  ? resolve(REPO, process.env.MARINARA_ENV_FILE.trim())
  : join(REPO, ".env");

function readEngineEnv() {
  const file = ENGINE_ENV_FILE;
  const env = {};
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim().replace(/^export\s+/, "");
    const eq = line.indexOf("=");
    if (eq < 1 || line.startsWith("#")) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z0-9_]+$/.test(key)) continue;
    // Same rules as dotenv, which the server uses: a quoted value runs to its closing quote; an unquoted value
    // ends at the first #, which starts a comment.
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    const close = quote === '"' || quote === "'" || quote === "`" ? value.indexOf(quote, 1) : -1;
    if (close > 0) value = value.slice(1, close);
    else if (value.includes("#")) value = value.slice(0, value.indexOf("#")).trim();
    env[key] = value;
  }
  return env;
}

export const ENGINE_ENV = readEngineEnv();

/** Relative DATA_DIR / LOG_DIR values are resolved from packages/server, as the server does. */
const fromServer = (value) => (isAbsolute(value) ? value : resolve(SERVER_DIR, value));

/** Shared state for every agent using this server: backups, lock, activity log, large outputs, sandbox. */
export const STATE_DIR = resolve(process.env.MARINARA_DEV_STATE || join(REPO, ".dev-mcp"));
export const OUT_DIR = join(STATE_DIR, "out");
export const BACKUP_DIR = join(STATE_DIR, "backups");
export const ACTIVITY_FILE = join(STATE_DIR, "activity.jsonl");
export const LOCK_FILE = join(STATE_DIR, "engine.lock");
export const RUN_DIR = join(STATE_DIR, "run");
for (const dir of [STATE_DIR, OUT_DIR, BACKUP_DIR, RUN_DIR]) mkdirSync(dir, { recursive: true });

/**
 * Which engine this server talks to. "live" is the normal engine (port from the repo .env, else 7860). "sandbox" is a
 * throwaway copy on its own port that runs the same build against a copied, sanitized store with no provider
 * credentials, so it cannot spend model quota, post to webhooks, or touch the real data.
 */
export const INSTANCE = process.env.MARINARA_DEV_INSTANCE === "sandbox" ? "sandbox" : "live";
export const SANDBOX_DIR = resolve(process.env.MARINARA_DEV_SANDBOX_DIR || join(STATE_DIR, "sandbox"));
export const SANDBOX_PORT = Number(process.env.MARINARA_DEV_SANDBOX_PORT || 7862);
export const LIVE_PORT = Number(ENGINE_ENV.PORT || 7860);
export const PORT = Number(process.env.MARINARA_DEV_PORT || (INSTANCE === "sandbox" ? SANDBOX_PORT : LIVE_PORT));
if (INSTANCE === "sandbox" && (PORT === LIVE_PORT || SANDBOX_PORT === LIVE_PORT)) {
  // Every sandbox tool (restart, stop, API writes) would otherwise act on the live engine.
  throw new Error(`[dev-mcp] sandbox port ${PORT} is the live engine's port ${LIVE_PORT}; set MARINARA_DEV_SANDBOX_PORT or MARINARA_DEV_PORT to another port`);
}
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const API = `${ORIGIN}/api`;
export const LIVE_DATA_DIR = fromServer(ENGINE_ENV.DATA_DIR || "data");
export const DATA_DIR = INSTANCE === "sandbox" ? join(SANDBOX_DIR, "data") : LIVE_DATA_DIR;
export const LOG_DIR =
  INSTANCE === "live" && ENGINE_ENV.LOG_DIR ? fromServer(ENGINE_ENV.LOG_DIR) : join(DATA_DIR, "logs");

/** Who is calling, for the activity log and the lock. Set MARINARA_DEV_AGENT in each client's MCP config. */
export const AGENT = process.env.MARINARA_DEV_AGENT || "unknown-agent";
