import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { REQUEST_TIMEOUTS, requestTimeoutSettingsSchema, type RequestTimeoutSettings } from "@marinara-engine/shared";
import { logger as sharedLogger } from "../lib/logger.js";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_ROOT = resolve(__dirname, "../..");
const MONOREPO_ROOT = resolve(__dirname, "../../../..");
const STARTUP_DATA_DIR = process.env.DATA_DIR;
const DEFAULT_DOCKER_DATA_DIR = "/app/data";
const DEFAULT_PORT = 7860;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_DATA_DIR = resolve(SERVER_ROOT, "data");
const DEFAULT_MAX_TOOL_ROUNDS = 100;
const MAX_CONFIGURED_TOOL_ROUNDS = 10_000;
const DEFAULT_CUSTOM_TOOL_TIMEOUT_MS = 60_000;
export const DEFAULT_CHAT_GENERATION_TIMEOUT_MS = 300_000;
const MIN_CHAT_GENERATION_TIMEOUT_MS = 10_000;
const MAX_CHAT_GENERATION_TIMEOUT_MS = 3_600_000;
export const DEFAULT_AGENT_CALL_TIMEOUT_MS = 300_000;
export const DEFAULT_GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

function createValidatedTimeoutGetter(envVar: string, defaultMs: number, minMs: number, maxMs: number) {
  let lastInvalid: string | null = null;
  return () => {
    const raw = normalizeEnvValue(process.env[envVar]);
    if (raw === null) return defaultMs;

    const parsed = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (Number.isSafeInteger(parsed) && parsed >= minMs && parsed <= maxMs) {
      lastInvalid = null;
      return parsed;
    }

    if (lastInvalid !== raw) {
      lastInvalid = raw;
      sharedLogger.warn(
        "[runtime-config] Ignoring invalid %s=%s; expected %d-%d milliseconds, using %d",
        envVar,
        raw,
        minMs,
        maxMs,
        defaultMs,
      );
    }
    return defaultMs;
  };
}

const readChatGenerationTimeoutMs = createValidatedTimeoutGetter(
  "CHAT_GENERATION_TIMEOUT_MS",
  DEFAULT_CHAT_GENERATION_TIMEOUT_MS,
  MIN_CHAT_GENERATION_TIMEOUT_MS,
  MAX_CHAT_GENERATION_TIMEOUT_MS,
);
const readAgentCallTimeoutMs = createValidatedTimeoutGetter(
  "AGENT_CALL_TIMEOUT_MS",
  DEFAULT_AGENT_CALL_TIMEOUT_MS,
  MIN_CHAT_GENERATION_TIMEOUT_MS,
  MAX_CHAT_GENERATION_TIMEOUT_MS,
);
const readGameDynamicImagePromptTimeoutMs = createValidatedTimeoutGetter(
  "GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS",
  DEFAULT_GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS,
  MIN_CHAT_GENERATION_TIMEOUT_MS,
  MAX_CHAT_GENERATION_TIMEOUT_MS,
);

let envLoaded = false;
// Keys that the .env file currently contributes to process.env. Tracked so a
// reload can remove keys that were deleted from the file.
let envFileKeys = new Set<string>();

export function getEnvFilePath() {
  const explicit = normalizeEnvValue(process.env.MARINARA_ENV_FILE);
  if (explicit) return resolveFromRepoRoot(explicit);

  const repoEnvPath = resolve(MONOREPO_ROOT, ".env");
  if (!isDockerRuntime()) return repoEnvPath;

  const dataEnvPath = resolve(
    resolveFromServerRoot(normalizeEnvValue(STARTUP_DATA_DIR) ?? DEFAULT_DOCKER_DATA_DIR),
    ".env",
  );
  if (existsSync(repoEnvPath) && !existsSync(dataEnvPath)) {
    return repoEnvPath;
  }

  return dataEnvPath;
}

const EMPTY_ENV_HEADER = `# Marinara Engine - runtime configuration.
# This file is empty by design. Copy any setting you want to change from
# .env.example (same folder) and edit the value here. Most changes take
# effect within ~2 seconds without a restart.
`;

/**
 * Create an empty .env at the runtime config path if one doesn't exist so users
 * can find the file without having to copy .env.example first. The write
 * is best-effort: read-only filesystems (some Docker images, locked-down
 * installs) silently fall back to "no .env" mode, which dotenv handles
 * the same as today.
 */
function ensureEnvFileExists(envPath: string) {
  if (existsSync(envPath)) {
    if (process.platform !== "win32") {
      try {
        if ((statSync(envPath).mode & 0o077) !== 0) chmodSync(envPath, 0o600);
      } catch (error) {
        // Read-only mounts may reject chmod even when the mounted file is
        // already private. Only fail when the resulting mode is unsafe.
        try {
          if ((statSync(envPath).mode & 0o077) === 0) return;
        } catch {
          // The original chmod failure remains the useful startup error.
        }
        throw new Error(`Cannot enforce private permissions on ${envPath}`, { cause: error });
      }
      if ((statSync(envPath).mode & 0o077) !== 0) {
        throw new Error(`Cannot enforce private permissions on ${envPath}`);
      }
    }
    return;
  }
  try {
    mkdirSync(dirname(envPath), { recursive: true });
    // 'wx' = exclusive create. Race-safe across concurrent startups: a second
    // process that loses the race gets EEXIST, which we ignore.
    writeFileSync(envPath, EMPTY_ENV_HEADER, { flag: "wx", mode: 0o600 });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code === "EEXIST") return;
    // Defer the warn one tick. ensureEnvFileExists runs from top-level
    // loadRuntimeEnv(), which fires while the runtime-config ↔ logger import
    // cycle is still resolving — when index.ts imports logger.ts first, the
    // logger module hasn't finished evaluating yet and sharedLogger is in
    // TDZ. Synchronous access throws ReferenceError and crashes startup,
    // masking the real "couldn't write .env" error. setImmediate runs after
    // both modules finish evaluating so the diagnostic survives intact.
    setImmediate(() => {
      sharedLogger.warn({ err, envPath }, "[runtime-config] Could not auto-create .env file; continuing without it");
    });
  }
}

export function loadRuntimeEnv() {
  if (envLoaded) return;

  const envPath = getEnvFilePath();
  ensureEnvFileExists(envPath);
  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath, quiet: true });
    if (result.parsed) {
      envFileKeys = new Set(Object.keys(result.parsed));
    }
  } else {
    dotenv.config({ quiet: true });
  }

  applySavedRequestTimeouts();
  normalizeRuntimeTimezoneEnv();

  envLoaded = true;
}

loadRuntimeEnv();

export interface EnvReloadResult {
  added: string[];
  updated: string[];
  removed: string[];
  unchanged: string[];
}

/**
 * Re-read the .env file and propagate changes to process.env with override
 * semantics. Keys removed from the file are deleted from process.env so that
 * unsetting a value (e.g. clearing BASIC_AUTH_PASS) takes effect immediately.
 *
 * Returns a diff so callers can log or react to specific changes. Throws when
 * the .env file is missing or unreadable so the caller can decide how to
 * surface the failure.
 */
export function reloadRuntimeEnv(): EnvReloadResult {
  const envPath = getEnvFilePath();
  if (!existsSync(envPath)) {
    // No .env to read — clear any keys we previously set from a now-missing file.
    const removed = [...envFileKeys];
    for (const key of removed) {
      delete process.env[key];
    }
    envFileKeys = new Set();
    applySavedRequestTimeouts();
    return { added: [], updated: [], removed, unchanged: [] };
  }

  const fileContent = readFileSync(envPath);
  const parsed = dotenv.parse(fileContent);
  const newKeys = new Set(Object.keys(parsed));

  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const previous = process.env[key];
    if (!envFileKeys.has(key)) {
      added.push(key);
      process.env[key] = value;
    } else if (previous !== value) {
      updated.push(key);
      process.env[key] = value;
    } else {
      unchanged.push(key);
    }
  }

  for (const key of envFileKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
      delete process.env[key];
    }
  }

  applySavedRequestTimeouts();
  normalizeRuntimeTimezoneEnv();
  envFileKeys = newKeys;
  return { added, updated, removed, unchanged };
}

/**
 * Node interprets an explicitly empty TZ as Etc/Unknown (UTC), which is not
 * equivalent to leaving TZ unset. Treat whitespace-only values as absent so
 * schedules continue to inherit the host timezone.
 */
export function normalizeRuntimeTimezoneEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!("TZ" in env) || env.TZ?.trim()) return false;
  delete env.TZ;
  return true;
}

function normalizeEnvValue(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveFromRepoRoot(targetPath: string) {
  if (isAbsolute(targetPath)) return targetPath;
  return resolve(MONOREPO_ROOT, targetPath);
}

function resolveFromServerRoot(targetPath: string) {
  if (isAbsolute(targetPath)) return targetPath;
  return resolve(SERVER_ROOT, targetPath);
}

function isDisabledFlag(value: string | undefined | null) {
  return ["0", "false", "no", "off"].includes((value ?? "").trim().toLowerCase());
}

function isEnabledFlag(value: string | undefined | null) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

/**
 * An on/off environment variable that pins a feature switch: null when unset or blank (the saved
 * setting applies), otherwise true for 1/true/yes/on and false for anything else. Read per call.
 */
export function readEnvFlagOverride(envVar: string): boolean | null {
  const raw = normalizeEnvValue(process.env[envVar]);
  return raw === null ? null : isEnabledFlag(raw);
}

function parsePositiveIntEnv(value: string | undefined | null, fallback: number, max: number) {
  const raw = normalizeEnvValue(value);
  if (!raw || !/^\d+$/.test(raw)) return fallback;

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export function isDockerRuntime() {
  return (
    isEnabledFlag(process.env.MARINARA_DOCKER) ||
    normalizeEnvValue(process.env.MARINARA_DOCKER_USER) !== null ||
    normalizeEnvValue(process.env.MARINARA_DOCKER_GROUP) !== null
  );
}

function parseCsv(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getMonorepoRoot() {
  return MONOREPO_ROOT;
}

export function getServerRoot() {
  return SERVER_ROOT;
}

export function getHost() {
  return normalizeEnvValue(process.env.HOST) ?? DEFAULT_HOST;
}

export function getTrustedHosts() {
  return parseCsv(process.env.TRUSTED_HOSTS);
}

export function getPort() {
  const parsed = Number.parseInt(process.env.PORT ?? "", 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

export function getNodeEnv() {
  return normalizeEnvValue(process.env.NODE_ENV) ?? "development";
}

export function getLogLevel() {
  if (isPromptConnectionLogPreset()) return "debug";
  return normalizeEnvValue(process.env.LOG_LEVEL) ?? "warn";
}

export function getLogPreset() {
  return normalizeEnvValue(process.env.LOG_PRESET)?.toLowerCase() ?? "default";
}

/**
 * Kill switch for the `claude_subscription` provider's resume code path.
 * Default `true`; set `CLAUDE_SUBSCRIPTION_USE_RESUME=false` (or `0`/`off`/`no`)
 * to revert to the legacy transcript-fold path. When enabled, prior turns are
 * fed to the Claude Agent SDK through its `sessionStore` resume mechanism so
 * prompt caching holds across turns; if that setup fails (e.g. a read-only
 * data directory) the provider degrades to transcript-fold for that request.
 */
export function isClaudeSubscriptionResumeEnabled() {
  const raw = normalizeEnvValue(process.env.CLAUDE_SUBSCRIPTION_USE_RESUME);
  if (raw === null) return true;
  return !isDisabledFlag(raw);
}

export function isPromptConnectionLogPreset() {
  const preset = getLogPreset().replace(/_/g, "-");
  return preset === "prompt-connections";
}

export function isRequestLoggingDisabled() {
  if (isPromptConnectionLogPreset()) return true;
  const raw = normalizeEnvValue(process.env.LOG_DISABLE_REQUEST_LOGGING);
  if (raw !== null) return isEnabledFlag(raw);
  return false;
}

/**
 * Opt-in (LOG_PROMPT_DEBUG_FILES): prompt debug output (debug mode in the UI, or LOG_LEVEL=debug) goes to rotating
 * files under DATA_DIR/logs/prompt-debug/ instead of the console. Off: the console, as before.
 */
export function isPromptDebugFileLoggingEnabled() {
  return isEnabledFlag(process.env.LOG_PROMPT_DEBUG_FILES);
}

export function getServerProtocol() {
  return getTlsFilePaths() ? "https" : "http";
}

export function getDataDir() {
  const raw = normalizeEnvValue(process.env.DATA_DIR);
  if (raw) return resolveFromServerRoot(raw);
  return DEFAULT_DATA_DIR;
}

export function getFileStorageDir() {
  const raw = normalizeEnvValue(process.env.FILE_STORAGE_DIR ?? process.env.MARINARA_FILE_STORAGE_DIR);
  if (raw) return resolveFromServerRoot(raw);
  return resolve(getDataDir(), "storage");
}

export function getIpAllowlist() {
  // Explicit off-switch lets users keep their list configured but
  // temporarily disable enforcement without deleting the entries.
  if (isDisabledFlag(process.env.IP_ALLOWLIST_ENABLED)) return null;
  return normalizeEnvValue(process.env.IP_ALLOWLIST);
}

export function getBasicAuthConfig() {
  return {
    user: normalizeEnvValue(process.env.BASIC_AUTH_USER),
    pass: normalizeEnvValue(process.env.BASIC_AUTH_PASS),
    realm: normalizeEnvValue(process.env.BASIC_AUTH_REALM) ?? "Marinara Engine",
  };
}

/**
 * Opt-in switch that lets the server accept unauthenticated remote
 * connections (i.e. neither loopback nor IP_ALLOWLIST nor Basic Auth).
 * Default false — protects users who accidentally expose the port.
 */
export function isUnauthenticatedRemoteAllowed() {
  return isEnabledFlag(process.env.ALLOW_UNAUTHENTICATED_REMOTE);
}

/**
 * Explicit compatibility switch for old LAN/Tailscale/Docker convenience.
 * Default false: loopback stays passwordless; every other client needs auth.
 */
export function isUnauthenticatedPrivateNetworkAllowed() {
  return isEnabledFlag(process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK);
}

/**
 * Optional override for the no-auth-lockdown private-network exemption list.
 * Comma-separated IPs / CIDRs. When set, REPLACES the built-in defaults
 * (RFC 1918, CGNAT, link-local, IPv6 ULA). When unset, defaults are used.
 */
export function getTrustedPrivateNetworksOverride() {
  return normalizeEnvValue(process.env.TRUSTED_PRIVATE_NETWORKS);
}

/**
 * Choose how direct Tailscale traffic may skip the IP allowlist and Basic Auth.
 *
 * Default: automatic. A Tailscale-shaped client is trusted only when its
 * connection also arrived on a local 100.64.0.0/10 address. Set the flag to
 * true for the legacy broad range bypass, or false to disable it.
 */
export function getTailscaleBypassMode(): "auto" | "enabled" | "disabled" {
  const raw = normalizeEnvValue(process.env.BYPASS_AUTH_TAILSCALE);
  if (raw === null) return "auto";
  return isEnabledFlag(raw) ? "enabled" : "disabled";
}

/**
 * Choose how direct Docker traffic may skip the IP allowlist and Basic Auth.
 *
 * Default: automatic. Docker clients are trusted only when they match this
 * container's actual interface networks or exact default gateway. Set the
 * flag to true for the legacy broad range bypass, or false to disable it.
 */
export function getDockerBypassMode(): "auto" | "enabled" | "disabled" {
  const raw = normalizeEnvValue(process.env.BYPASS_AUTH_DOCKER);
  if (raw === null) return "auto";
  return isEnabledFlag(raw) ? "enabled" : "disabled";
}

/**
 * Require normal auth/allowlist handling for Docker bridge requests that look
 * like they were forwarded by a reverse proxy or tunnel container.
 *
 * Default: ON. Set REQUIRE_AUTH_FOR_DOCKER_PROXY=false only when every client
 * behind the Docker proxy is intentionally inside the trusted boundary.
 */
export function isDockerProxyAuthRequired() {
  return !isDisabledFlag(process.env.REQUIRE_AUTH_FOR_DOCKER_PROXY);
}

export function isDebugAgentsEnabled() {
  const value = normalizeEnvValue(process.env.DEBUG_AGENTS);
  return value === "1" || value?.toLowerCase() === "true";
}

export function getGifApiKey() {
  return normalizeEnvValue(process.env.GIPHY_API_KEY);
}

export function getAdminSecret() {
  return normalizeEnvValue(process.env.ADMIN_SECRET);
}

export function isAdminSecretRequiredOnLoopback() {
  return isEnabledFlag(process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK);
}

export function getCsrfTrustedOrigins() {
  return parseCsv(process.env.CSRF_TRUSTED_ORIGINS).filter((origin) => origin.toLowerCase() !== "null");
}

export function isUpdatesApplyEnabled() {
  return isEnabledFlag(process.env.UPDATES_APPLY_ENABLED);
}

/**
 * Hard refusal for server-side update application (#5646). The dev and e2e
 * launchers set UPDATES_APPLY_DISABLED so a loopback browser tab pointed at a
 * server booted from a working repo can never stash/checkout/rebuild that
 * checkout via the channel selector. Wins over UPDATES_APPLY_ENABLED and the
 * loopback channel-switch bypass.
 */
const BOOT_UPDATES_APPLY_HARD_DISABLED = isEnabledFlag(process.env.UPDATES_APPLY_DISABLED);

export function isUpdatesApplyHardDisabled() {
  // Latched at boot: the launchers set this in the environment, and a later
  // .env hot-reload writing UPDATES_APPLY_DISABLED=false must not lift a
  // guard whose whole point is protecting the checkout this process runs from.
  return BOOT_UPDATES_APPLY_HARD_DISABLED || isEnabledFlag(process.env.UPDATES_APPLY_DISABLED);
}

export function isUpdatesRemoteApplyAllowed() {
  return isEnabledFlag(process.env.UPDATES_ALLOW_REMOTE_APPLY);
}

export function isProviderLocalUrlsEnabled() {
  if (process.platform === "android" && normalizeEnvValue(process.env.PROVIDER_LOCAL_URLS_ENABLED) === null) {
    return true;
  }
  return isEnabledFlag(process.env.PROVIDER_LOCAL_URLS_ENABLED);
}

/**
 * Opt-in: keep the full text of activated lorebook entries only on the newest generated message of a chat (its row
 * and its swipes) and store older messages' scans without it. Off by default, which keeps today's storage shape.
 * Read per call, so a `.env` change applies on the next generation.
 */
export function isLorebookScanCompactionEnabled() {
  return isEnabledFlag(process.env.LOREBOOK_COMPACT_STORED_SCANS);
}

// Robustness settings. Every one is off by default, which keeps today's behaviour exactly, and each can be turned on
// by itself. Read per call unless noted, so a `.env` change applies without a restart where the code path allows it.

// LOREBOOK_STABLE_GROUP_WINNERS and PROVIDER_RETRY_TRANSIENT_ERRORS are feature switches now
// (stableLorebookGroupPicks, providerRetry): services/features/feature-settings.ts reads them with
// readEnvFlagOverride, where a set variable wins over Settings > Advanced > Features.

/** Opt-in: a storage flush skips a shard or manifest write whose content matches this process's last durable write. */
export function isStorageSkipUnchangedWritesEnabled() {
  return isEnabledFlag(process.env.STORAGE_SKIP_UNCHANGED_WRITES);
}

/** Opt-in: large shards serialize in short slices that yield the event loop instead of one blocking call. */
export function isStorageYieldingSerializeEnabled() {
  return isEnabledFlag(process.env.STORAGE_YIELDING_SERIALIZE);
}

/**
 * Opt-in, Windows only: cache the writer-lease boot id probe (about 1.5 to 2 s of PowerShell on every start) for the
 * rest of the OS boot. Read once, when the storage module loads.
 */
export function isWindowsBootIdCacheEnabled() {
  return isEnabledFlag(process.env.STORAGE_CACHE_WINDOWS_BOOT_ID);
}

/** The Windows boot id cache file: inside DATA_DIR, never in a per-user application or install folder. */
export function getWindowsBootIdCachePath() {
  return resolve(getDataDir(), ".writer-boot-id.json");
}

/** Opt-in, Windows only: Ctrl+Break and closing the console window also start the graceful shutdown. */
export function isShutdownWindowsConsoleSignalsEnabled() {
  return isEnabledFlag(process.env.SHUTDOWN_WINDOWS_CONSOLE_SIGNALS);
}

/** Opt-in: a second Ctrl+C (or Ctrl+Break) more than 1.5 s after the first forces the exit. */
export function isShutdownForceExitOnRepeatEnabled() {
  return isEnabledFlag(process.env.SHUTDOWN_FORCE_EXIT_ON_REPEAT);
}

/** Opt-in: start writing pending saves as soon as a stop signal arrives, while connections are still closing. */
export function isShutdownEarlyFlushEnabled() {
  return isEnabledFlag(process.env.SHUTDOWN_EARLY_FLUSH);
}

/**
 * Opt-in budget (ms) for the runtime stops that run before the store close. 0 or unset waits for every stop, as
 * before; a positive value moves on to the store close once it has passed. Capped at 2.5 s so the 4 s connection
 * cut, the budget and the store close still fit inside the 8 s shutdown force exit.
 */
export function getShutdownRuntimeStopBudgetMs() {
  return parsePositiveIntEnv(process.env.SHUTDOWN_RUNTIME_STOP_BUDGET_MS, 0, 2_500);
}

export function getEmbeddingRequestTimeoutMs() {
  return parsePositiveIntEnv(process.env.EMBEDDING_TIMEOUT_MS, 300_000, MAX_TIMEOUT_MS);
}

/** Main-chat provider timeout. Read per request so .env hot reloads apply without a restart. */
export function getChatGenerationTimeoutMs() {
  return readChatGenerationTimeoutMs();
}

/**
 * Per-call timeout for agent LLM requests (trackers, HTML reformatter, …).
 * Unlike the main chat path, these are total-duration caps, so slow local
 * models need a higher value here even when streaming (#3958). Read per
 * request so .env hot reloads apply without a restart.
 */
export function getAgentCallTimeoutMs() {
  return readAgentCallTimeoutMs();
}

/** Dynamic Game image-prompt LLM timeout. Read per request so .env hot reloads apply without a restart. */
export function getGameDynamicImagePromptTimeoutMs() {
  return readGameDynamicImagePromptTimeoutMs();
}

/**
 * SteamOS ships games that claim most of the Deck's 16 GiB of shared RAM, so
 * unbounded load-and-keep gets the server OOM-killed mid session (#5838). The
 * cap matches the one the Termux launcher exports, but lives engine-side so it
 * covers every launch method (start.sh, systemd units, direct node) and so an
 * explicit MARINARA_MAX_RESIDENT_CHATS - including 0 to disable - always wins
 * at boot AND on .env hot reload. A launcher export could not offer that: the
 * initial .env load never overrides inherited shell variables, while hot
 * reloads do, so the same .env line would flap between boots and reloads.
 */
const CONSTRAINED_PLATFORM_DEFAULT_MAX_RESIDENT_CHATS = 8;

let cachedSteamOsDetection: boolean | null = null;

/** Exported for the regression lane; production goes through the cached path. */
export function detectSteamOs(
  osReleasePath = "/etc/os-release",
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== "linux") return false;
  try {
    return /^ID=["']?steamos["']?\s*$/mu.test(readFileSync(osReleasePath, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Android means Termux - the only way this server runs there. Its launcher
 * already exports 8 when the variable is unset, so this engine-side default
 * matters for launcher-less launches and for invalid values, which bash's
 * ${VAR:-8} substitution passes through verbatim.
 */
function constrainedPlatformDetected(): boolean {
  if (process.platform === "android") return true;
  if (cachedSteamOsDetection === null) cachedSteamOsDetection = detectSteamOs();
  return cachedSteamOsDetection;
}

/** The parameter is a test seam; production callers use the detected value. */
export function platformDefaultMaxResidentChatUnits(constrained = constrainedPlatformDetected()): number {
  return constrained ? CONSTRAINED_PLATFORM_DEFAULT_MAX_RESIDENT_CHATS : 0;
}

/**
 * Resident chat-unit cap for the lazy file store (#5592 Phase 2 PR-B).
 * When unset or invalid, the platform default applies: 8 on SteamOS (#5838),
 * otherwise 0, which disables eviction entirely and preserves load-and-keep
 * behavior. Read per sweep so .env hot reloads apply without a restart. The
 * floor of 2 keeps multi-chat operations (branching, cross-chat notes) from
 * thrashing their own working set.
 */
let lastInvalidMaxResidentChats: string | null = null;

export function getMaxResidentChatUnits() {
  const raw = normalizeEnvValue(process.env.MARINARA_MAX_RESIDENT_CHATS);
  if (!raw) {
    lastInvalidMaxResidentChats = null;
    return platformDefaultMaxResidentChatUnits();
  }
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    // Warn once per distinct value. An invalid value falls back to the
    // platform default rather than to 0, because a typo silently disabling
    // eviction would remove the memory bound on exactly the constrained
    // targets - Android/Termux and SteamOS, both covered by the platform
    // default above (the Termux launcher's ${VAR:-8} only covers unset, not
    // invalid text, which it exports verbatim).
    if (lastInvalidMaxResidentChats !== raw) {
      lastInvalidMaxResidentChats = raw;
      sharedLogger.warn(
        "[runtime-config] Ignoring invalid MARINARA_MAX_RESIDENT_CHATS=%s; expected 0 (disabled) or a positive integer — using the platform default (%d)",
        raw,
        platformDefaultMaxResidentChatUnits(),
      );
    }
    return platformDefaultMaxResidentChatUnits();
  }
  lastInvalidMaxResidentChats = null;
  if (parsed === 0) return 0;
  return Math.max(2, Math.min(parsed, 10_000));
}

export function getMaxToolRounds() {
  return parsePositiveIntEnv(process.env.MAX_TOOL_ROUNDS, DEFAULT_MAX_TOOL_ROUNDS, MAX_CONFIGURED_TOOL_ROUNDS);
}

export function getCustomToolTimeoutMs() {
  return parsePositiveIntEnv(process.env.CUSTOM_TOOL_TIMEOUT_MS, DEFAULT_CUSTOM_TOOL_TIMEOUT_MS, MAX_TIMEOUT_MS);
}

export function isImageLocalUrlsEnabled() {
  return isEnabledFlag(process.env.IMAGE_LOCAL_URLS_ENABLED);
}

export function isTtsLocalUrlsEnabled() {
  return isEnabledFlag(process.env.TTS_LOCAL_URLS_ENABLED);
}

export function isDeeplxLocalUrlsEnabled() {
  return isEnabledFlag(process.env.DEEPLX_LOCAL_URLS_ENABLED);
}

export function isWebhookLocalUrlsEnabled() {
  return isEnabledFlag(process.env.WEBHOOK_LOCAL_URLS_ENABLED);
}

export function isCustomToolScriptEnabled() {
  return isEnabledFlag(process.env.CUSTOM_TOOL_SCRIPT_ENABLED);
}

export function isCustomAgentRepositoriesEnabled() {
  return isEnabledFlag(process.env.ENABLE_CUSTOM_AGENT_REPOS);
}

export function isExternalExtensionsEnvEnabled() {
  return isEnabledFlag(process.env.ENABLE_EXTERNAL_EXTENSIONS);
}

export function isSidecarRuntimeInstallEnabled() {
  return isEnabledFlag(process.env.SIDECAR_RUNTIME_INSTALL_ENABLED);
}

export function isHapticsRemoteAllowed() {
  return isEnabledFlag(process.env.HAPTICS_ALLOW_REMOTE);
}

export function getIntifaceUrl() {
  return normalizeEnvValue(process.env.INTIFACE_URL) ?? "ws://127.0.0.1:12345";
}

export function getImportAllowedRoots() {
  return parseCsv(process.env.IMPORT_ALLOWED_ROOTS).map(resolveFromRepoRoot);
}

export function getEncryptionKeyOverride() {
  return normalizeEnvValue(process.env.ENCRYPTION_KEY);
}

export function getSpotifyRedirectUriOverride() {
  return normalizeEnvValue(process.env.SPOTIFY_REDIRECT_URI);
}

function getLoopbackFallbackRedirectUri() {
  return `http://127.0.0.1:${getPort()}/api/spotify/callback`;
}

function stripPort(host: string) {
  return host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
}

function isLoopbackHost(host: string) {
  const hostname = stripPort(host);
  return hostname === "127.0.0.1" || hostname === "::1";
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first ? first : null;
}

type RedirectUriRequest = {
  protocol?: string;
  hostname?: string;
  headers: Record<string, string | string[] | undefined>;
};

export function buildSpotifyRedirectUri(req: RedirectUriRequest): string {
  const override = getSpotifyRedirectUriOverride();
  if (override) return override;

  const protocol = (req.protocol ?? "http").toLowerCase();
  const hostHeader = firstHeaderValue(req.headers["host"]);
  const hostname = req.hostname ?? (hostHeader ? stripPort(hostHeader) : null);

  if (!hostname) return getLoopbackFallbackRedirectUri();
  const host = hostHeader ?? hostname;

  if (protocol === "https") return `https://${host}/api/spotify/callback`;
  if (protocol === "http" && isLoopbackHost(host)) return `http://${host}/api/spotify/callback`;
  return getLoopbackFallbackRedirectUri();
}

export function getSpotifyRedirectUri() {
  return getSpotifyRedirectUriOverride() ?? getLoopbackFallbackRedirectUri();
}

export function getCorsConfig() {
  const raw = normalizeEnvValue(process.env.CORS_ORIGINS);
  if (!raw) {
    return {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    };
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    };
  }

  if (origins.includes("*")) {
    return {
      origin: "*",
      credentials: false,
    };
  }

  return {
    origin: origins.length === 1 ? origins[0]! : origins,
    credentials: true,
  };
}

export function getTlsFilePaths() {
  const cert = normalizeEnvValue(process.env.SSL_CERT);
  const key = normalizeEnvValue(process.env.SSL_KEY);
  if (!cert || !key) return null;

  return {
    certPath: resolveFromRepoRoot(cert),
    keyPath: resolveFromRepoRoot(key),
  };
}

export function loadTlsOptions() {
  const tlsPaths = getTlsFilePaths();
  if (!tlsPaths) return null;

  try {
    return {
      cert: readFileSync(tlsPaths.certPath),
      key: readFileSync(tlsPaths.keyPath),
    };
  } catch (err) {
    throw new Error(
      `Failed to load TLS certificate/key files.\n` +
        `  SSL_CERT=${process.env.SSL_CERT}\n` +
        `  SSL_KEY=${process.env.SSL_KEY}\n` +
        `  ${err instanceof Error ? err.message : String(err)}\n` +
        `Please ensure the paths are correct and the files are readable.`,
    );
  }
}

export function isAutoOpenBrowserDisabled(value = process.env.AUTO_OPEN_BROWSER) {
  return isDisabledFlag(value);
}

export function isAutoCreateDefaultConnectionDisabled(value = process.env.AUTO_CREATE_DEFAULT_CONNECTION) {
  return isDisabledFlag(value);
}

export function logStorageDiagnostics(logger: { info(...args: any[]): void } = sharedLogger) {
  logger.info("[storage] DATA_DIR=%s", getDataDir());
  logger.info("[storage] FILE_STORAGE_DIR=%s", getFileStorageDir());
}

/** Kept beside the active .env, so server-wide preferences survive profile changes. */
function requestTimeoutSettingsPath() {
  return `${getEnvFilePath()}.timeouts.json`;
}

function applySavedRequestTimeouts() {
  const path = requestTimeoutSettingsPath();
  if (!existsSync(path)) return;
  try {
    const settings = requestTimeoutSettingsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    for (const [key, spec] of Object.entries(REQUEST_TIMEOUTS)) {
      process.env[spec.env] = String(settings[key as keyof RequestTimeoutSettings] * spec.unit);
    }
  } catch (error) {
    setImmediate(() => sharedLogger.warn(error, "Ignoring invalid saved request timeout settings"));
  }
}

export function getRequestTimeoutSettings(): RequestTimeoutSettings {
  return Object.fromEntries(
    Object.entries(REQUEST_TIMEOUTS).map(([key, spec]) => {
      const seconds = Number(process.env[spec.env]) / spec.unit;
      return [
        key,
        Number.isInteger(seconds) && seconds >= 10 && seconds <= spec.maxSeconds ? seconds : spec.defaultSeconds,
      ];
    }),
  ) as RequestTimeoutSettings;
}

export function saveRequestTimeoutSettings(input: unknown): RequestTimeoutSettings {
  const settings = requestTimeoutSettingsSchema.parse(input);
  const path = requestTimeoutSettingsPath();
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(temporaryPath, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  applySavedRequestTimeouts();
  return settings;
}
