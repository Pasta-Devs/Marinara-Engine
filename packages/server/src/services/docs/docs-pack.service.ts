// ──────────────────────────────────────────────
// Documentation language packs: download, verify, install, remove.
//
// Translated doc trees live on the repo's `docs-i18n` branch as
// `<lang>/manifest.json` + `<lang>/<mirrored doc paths>.md`. This service
// downloads a language into DATA_DIR/doc-packs/<lang> (gitignored, volume-
// persisted — survives every update path), verifying a sha256 + byte size for
// every file against the manifest. English is built into the repo and is never
// downloaded or deleted. Only one downloaded language is kept on disk.
// ──────────────────────────────────────────────
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  APP_VERSION,
  DOCS_LANGUAGE_LABELS,
  DOCS_LANGUAGE_SETTINGS_KEY,
  DEFAULT_DOCS_LANGUAGE,
  normalizeDocsLanguage,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir, getMonorepoRoot } from "../../config/runtime-config.js";
import { assertInsideDir, safeFetch } from "../../utils/security.js";

const execFileAsync = promisify(execFile);

/**
 * Base URL of the docs-i18n content branch. Overridable for forks and mirrors.
 * Must be a public https host — safeFetch blocks loopback/private/reserved
 * addresses, so a LAN mirror is intentionally refused.
 */
const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/docs-i18n";

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 1000;
const MAX_PATH_DEPTH = 6;
const FILE_FETCH_CONCURRENCY = 6;
const FILE_FETCH_ATTEMPTS = 3;

export class DocsPackBusyError extends Error {
  constructor(public busyLanguage: string) {
    super(`A documentation pack install is already running for "${busyLanguage}"`);
    this.name = "DocsPackBusyError";
  }
}

export interface DocsPackManifestFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface DocsPackManifest {
  language: string;
  /** Informational: the Engine commit the translations were written against */
  sourceCommit?: string;
  files: DocsPackManifestFile[];
}

export interface DocsPackInstallProgress {
  language: string;
  phase: "manifest" | "downloading" | "finalizing";
  filesDone: number;
  filesTotal: number;
}

/** Root folder holding downloaded packs, one subfolder per language code. */
export function docsPacksRoot(): string {
  return join(getDataDir(), "doc-packs");
}

export function docsPackRoot(code: string): string {
  return join(docsPacksRoot(), code);
}

/** A language counts as installed only when its verified manifest landed (written last into the temp dir before the atomic swap). */
export function isDocsPackInstalled(code: string): boolean {
  return existsSync(join(docsPackRoot(code), "manifest.json"));
}

export function docsPackBaseUrl(): string {
  const configured = process.env.DOCS_I18N_BASE_URL?.trim();
  const base = configured || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

/**
 * Pin GitHub raw URLs to the branch head's immutable commit before downloading.
 * raw.githubusercontent.com serves each object through a CDN with independent
 * TTLs, so fetching manifest + files at the mutable branch ref can mix versions
 * after a push and fail every sha256 check until caches expire. Commit-pinned
 * URLs are immutable and cannot skew. Non-GitHub mirrors are used as-is.
 */
const RAW_GITHUB_RE = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)$/;

export async function resolvePinnedBase(base: string): Promise<string> {
  const match = base.match(RAW_GITHUB_RE);
  if (!match) return base;
  const owner = match[1]!;
  const repo = match[2]!;
  const ref = match[3]!;
  if (/^[0-9a-f]{40}$/.test(ref)) return base;
  try {
    const response = await safeFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
      {
        policy: { allowedProtocols: ["https:"], allowedHostnames: ["api.github.com"] },
        maxResponseBytes: 64 * 1024,
        allowedContentTypes: ["application/vnd.github.sha", "text/plain", "application/json"],
        allowMissingContentType: true,
        headers: {
          Accept: "application/vnd.github.sha",
          "User-Agent": `MarinaraEngine/${APP_VERSION}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error(`GitHub ref lookup failed with HTTP ${response.status}`);
    const sha = (await response.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("GitHub ref lookup returned an unexpected body");
    return `https://raw.githubusercontent.com/${owner}/${repo}/${sha}`;
  } catch (err) {
    // Rate-limited or offline API: fall back to the branch ref. Hash checks
    // still guarantee integrity; worst case is a retryable skew failure.
    logger.warn(err, "Could not pin the docs-i18n ref to a commit; downloading from the branch URL");
    return base;
  }
}

/** Archive-grade path validation (zip-slip-equivalent guard) for manifest entries. */
export function validateDocsPackPath(value: string): string {
  if (!value || value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error(`Documentation pack manifest contains an unsafe path: ${JSON.stringify(value)}`);
  }
  const parts = value.split("/");
  if (
    parts.length > MAX_PATH_DEPTH ||
    parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))
  ) {
    throw new Error(`Documentation pack manifest contains an unsafe path: ${JSON.stringify(value)}`);
  }
  if (!value.toLowerCase().endsWith(".md")) {
    throw new Error(`Documentation pack manifest lists a non-markdown file: ${JSON.stringify(value)}`);
  }
  return value;
}

export function validateDocsPackManifest(raw: unknown, expectedLanguage: string): DocsPackManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Documentation pack manifest is not an object");
  }
  const manifest = raw as { language?: unknown; sourceCommit?: unknown; files?: unknown };
  if (normalizeDocsLanguage(manifest.language) !== expectedLanguage) {
    throw new Error("Documentation pack manifest is for a different language");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0 || manifest.files.length > MAX_FILES) {
    throw new Error("Documentation pack manifest has an invalid file list");
  }
  // Case-insensitive duplicate detection: on Windows/macOS two paths that fold
  // to the same file would overwrite each other and corrupt hash verification.
  const seen = new Set<string>();
  let totalBytes = 0;
  const files = manifest.files.map((entry) => {
    const item = entry as { path?: unknown; sha256?: unknown; bytes?: unknown };
    if (typeof item.path !== "string" || typeof item.sha256 !== "string" || typeof item.bytes !== "number") {
      throw new Error("Documentation pack manifest entry is malformed");
    }
    const path = validateDocsPackPath(item.path);
    const folded = path.toLowerCase();
    if (seen.has(folded)) throw new Error(`Documentation pack manifest lists ${path} twice`);
    seen.add(folded);
    if (!/^[0-9a-f]{64}$/.test(item.sha256))
      throw new Error(`Documentation pack manifest has an invalid hash for ${path}`);
    if (!Number.isInteger(item.bytes) || item.bytes <= 0 || item.bytes > MAX_FILE_BYTES) {
      throw new Error(`Documentation pack manifest has an invalid size for ${path}`);
    }
    totalBytes += item.bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Documentation pack is too large");
    return { path, sha256: item.sha256, bytes: item.bytes };
  });
  return {
    language: expectedLanguage,
    ...(typeof manifest.sourceCommit === "string" ? { sourceCommit: manifest.sourceCommit } : {}),
    files,
  };
}

export async function fetchPackBytes(url: string, maximum: number): Promise<Buffer> {
  const response = await safeFetch(url, {
    // Forks/mirrors are allowed, so no hostname pin — integrity rests on the
    // per-file sha256 checks. https-only and the default reserved-IP blocking
    // keep an .env override from becoming an SSRF vector.
    policy: { allowedProtocols: ["https:"] },
    maxResponseBytes: maximum,
    allowMissingContentType: true,
    headers: { "User-Agent": `MarinaraEngine/${APP_VERSION}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchPackFile(url: string, file: DocsPackManifestFile): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FILE_FETCH_ATTEMPTS; attempt++) {
    try {
      const buffer = await fetchPackBytes(url, Math.min(file.bytes + 1, MAX_FILE_BYTES));
      if (buffer.byteLength !== file.bytes) {
        throw new Error(`Size mismatch for ${file.path}: expected ${file.bytes}, got ${buffer.byteLength}`);
      }
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      if (sha256 !== file.sha256) throw new Error(`Hash mismatch for ${file.path}`);
      return buffer;
    } catch (err) {
      lastError = err;
      if (attempt < FILE_FETCH_ATTEMPTS) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to download ${file.path}`);
}

/** Remove crashed installs' leftovers. Runs at startup, install start, and fix. */
export async function sweepStaleDocsPackDirs(): Promise<void> {
  const root = docsPacksRoot();
  if (!existsSync(root)) return;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name.startsWith(".tmp-") || entry.name.startsWith(".old-"))) {
      await rm(join(root, entry.name), { recursive: true, force: true }).catch((err) => {
        logger.warn(err, "Could not remove stale docs pack folder %s", entry.name);
      });
    }
  }
}

/** Delete every downloaded pack except `keep` ("en" keeps nothing — English is built-in). */
export async function removeOtherDocsPacks(keep: string): Promise<string[]> {
  const root = docsPacksRoot();
  if (!existsSync(root)) return [];
  const removed: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (normalizeDocsLanguage(entry.name) !== entry.name) continue;
    if (entry.name === keep) continue;
    await rm(join(root, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}

export async function readInstalledDocsPackManifest(code: string): Promise<DocsPackManifest | null> {
  try {
    const raw = await readFile(join(docsPackRoot(code), "manifest.json"), "utf8");
    return validateDocsPackManifest(JSON.parse(raw), code);
  } catch {
    return null;
  }
}

/**
 * Cheap consistency check (existence + byte sizes only — no hashing), safe to
 * run from the status endpoint. Full hash verification is reserved for fix.
 */
export async function checkDocsPackConsistency(code: string): Promise<{ installed: boolean; complete: boolean }> {
  if (!isDocsPackInstalled(code)) return { installed: false, complete: false };
  const manifest = await readInstalledDocsPackManifest(code);
  if (!manifest) return { installed: true, complete: false };
  for (const file of manifest.files) {
    try {
      const info = await stat(join(docsPackRoot(code), ...file.path.split("/")));
      if (!info.isFile() || info.size !== file.bytes) return { installed: true, complete: false };
    } catch {
      return { installed: true, complete: false };
    }
  }
  return { installed: true, complete: true };
}

/** Full sha256 re-verification of an installed pack (fix path only — reads every file). */
export async function verifyDocsPackHashes(code: string): Promise<boolean> {
  const manifest = await readInstalledDocsPackManifest(code);
  if (!manifest) return false;
  for (const file of manifest.files) {
    try {
      const content = await readFile(join(docsPackRoot(code), ...file.path.split("/")));
      if (createHash("sha256").update(content).digest("hex") !== file.sha256) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Downloaded pack folders present on disk (valid language-code names only). */
export async function listInstalledDocsPacks(): Promise<string[]> {
  const root = docsPacksRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".") && normalizeDocsLanguage(entry.name) === entry.name,
    )
    .map((entry) => entry.name)
    .sort();
}

/**
 * Serializes every switch/fix critical section (install + setting write +
 * other-pack deletion). The download's own single-flight only guards the
 * network phase; without this lock, a concurrent switch could delete a pack
 * another request had just finished installing.
 */
let mutationChain: Promise<unknown> = Promise.resolve();

export function withDocsPackMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationChain.then(fn, fn);
  mutationChain = run.catch(() => undefined);
  return run;
}

let activeInstall: { language: string; promise: Promise<void>; progress: DocsPackInstallProgress } | null = null;

export function getActiveDocsPackInstall(): DocsPackInstallProgress | null {
  return activeInstall ? { ...activeInstall.progress } : null;
}

/**
 * Download and atomically install a language pack. Global single-flight: a
 * concurrent request for the SAME language attaches to the in-flight install;
 * a request for a different language throws DocsPackBusyError.
 */
export function installDocsPack(language: string): Promise<void> {
  if (language === DEFAULT_DOCS_LANGUAGE || !(language in DOCS_LANGUAGE_LABELS)) {
    return Promise.reject(new Error(`"${language}" is not a downloadable documentation language`));
  }
  if (activeInstall) {
    if (activeInstall.language === language) return activeInstall.promise;
    return Promise.reject(new DocsPackBusyError(activeInstall.language));
  }
  const progress: DocsPackInstallProgress = { language, phase: "manifest", filesDone: 0, filesTotal: 0 };
  const promise = performInstall(language, progress).finally(() => {
    activeInstall = null;
  });
  activeInstall = { language, promise, progress };
  return promise;
}

async function performInstall(language: string, progress: DocsPackInstallProgress): Promise<void> {
  await sweepStaleDocsPackDirs();
  const pinnedBase = await resolvePinnedBase(docsPackBaseUrl());
  const manifestBuffer = await fetchPackBytes(`${pinnedBase}/${language}/manifest.json`, MAX_MANIFEST_BYTES);
  const manifest = validateDocsPackManifest(JSON.parse(manifestBuffer.toString("utf8")), language);
  progress.filesTotal = manifest.files.length;
  progress.phase = "downloading";

  const temporary = join(docsPacksRoot(), `.tmp-${language}-${process.pid}-${Date.now().toString(36)}`);
  await mkdir(temporary, { recursive: true });
  try {
    const queue = [...manifest.files];
    await Promise.all(
      Array.from({ length: Math.min(FILE_FETCH_CONCURRENCY, queue.length) }, async () => {
        for (let file = queue.shift(); file; file = queue.shift()) {
          const buffer = await fetchPackFile(`${pinnedBase}/${language}/${file.path}`, file);
          const target = assertInsideDir(temporary, join(temporary, ...file.path.split("/")));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, buffer);
          progress.filesDone++;
        }
      }),
    );
    // Manifest lands last: its presence marks the pack as fully installed.
    await writeFile(join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2));

    progress.phase = "finalizing";
    const destination = docsPackRoot(language);
    await rm(destination, { recursive: true, force: true });
    await renameWithRetry(temporary, destination);
    logger.info("Installed documentation pack %s (%d files)", language, manifest.files.length);
  } catch (err) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

// ──────────────────────────────────────────────
// Boot-time reconcile: after an Engine update, refresh the selected pack
// ──────────────────────────────────────────────

/** Marker recording which Engine build last checked the pack for upstream changes. */
const BOOT_CHECK_SETTINGS_KEY = "docs-language-pack-boot-check";

interface DocsPackSettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/**
 * Identity of the running Engine build. APP_VERSION alone misses staging git
 * updates between releases, so the git HEAD is folded in when available
 * (Docker images have no git and change APP_VERSION per pull instead).
 */
async function currentBuildKey(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: getMonorepoRoot(),
      timeout: 5_000,
    });
    return `${APP_VERSION}:${stdout.trim().slice(0, 12)}`;
  } catch {
    return `${APP_VERSION}:nogit`;
  }
}

/** True when both manifests describe the same file set with identical hashes. */
export function docsPackManifestsMatch(a: DocsPackManifest, b: DocsPackManifest): boolean {
  if (a.files.length !== b.files.length) return false;
  const other = new Map(b.files.map((file) => [file.path, file.sha256]));
  return a.files.every((file) => other.get(file.path) === file.sha256);
}

/**
 * Once per Engine build (i.e. after every update), compare the selected
 * language's installed pack against the docs-i18n branch and re-download it
 * when the translations changed. A stored choice whose pack is missing
 * (downgrade, data restore) is restored the same way. Failures keep the
 * installed pack serving (or the per-file English fallback) and retry on the
 * next start — mirroring how optional capability packages migrate on boot.
 */
export async function reconcileActiveDocsPackOnBoot(storage: DocsPackSettingsStore): Promise<void> {
  const raw = await storage.get(DOCS_LANGUAGE_SETTINGS_KEY);
  if (!raw) return;
  let language: string | null = null;
  try {
    language = normalizeDocsLanguage((JSON.parse(raw) as { language?: unknown } | null)?.language);
  } catch {
    return; // corrupt setting is the Fix button's job, not the boot path's
  }
  if (!language || language === DEFAULT_DOCS_LANGUAGE || !(language in DOCS_LANGUAGE_LABELS)) return;

  const buildKey = await currentBuildKey();
  try {
    const recorded = await storage.get(BOOT_CHECK_SETTINGS_KEY);
    if (recorded && (JSON.parse(recorded) as { buildKey?: unknown } | null)?.buildKey === buildKey) {
      return; // this build already checked — no network on routine restarts
    }
  } catch {
    // Unreadable marker: fall through and re-check.
  }

  try {
    await withDocsPackMutationLock(async () => {
      const installed = await readInstalledDocsPackManifest(language);
      if (installed) {
        const pinnedBase = await resolvePinnedBase(docsPackBaseUrl());
        const remoteBuffer = await fetchPackBytes(`${pinnedBase}/${language}/manifest.json`, MAX_MANIFEST_BYTES);
        const remote = validateDocsPackManifest(JSON.parse(remoteBuffer.toString("utf8")), language);
        if (!docsPackManifestsMatch(installed, remote)) {
          logger.info("Documentation pack %s changed upstream; refreshing it after the update", language);
          await installDocsPack(language);
        }
      } else {
        logger.info("Documentation pack %s is missing for the stored choice; downloading it", language);
        await installDocsPack(language);
      }
      await removeOtherDocsPacks(language);
      await storage.set(BOOT_CHECK_SETTINGS_KEY, JSON.stringify({ buildKey, checkedAt: new Date().toISOString() }));
    });
  } catch (err) {
    logger.warn(err, "Could not refresh documentation pack %s after the update; retrying next start", language);
  }
}

/** Windows can transiently refuse dir renames while a read handle is open (EPERM/EBUSY). */
async function renameWithRetry(from: string, to: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not finalize the documentation pack install");
}
