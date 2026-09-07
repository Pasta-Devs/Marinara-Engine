import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, readlink, rename, rm, symlink } from "node:fs/promises";
import type { Stats } from "node:fs";
import { basename, delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { MAX_REVIEW_FILE_BYTES, workspacePathAccessPolicy } from "./workspace-change-review.service.js";
import { getBubblewrapRuntimeStatus } from "../sandbox/bubblewrap-runtime.js";
import { logger } from "../../lib/logger.js";

export type WorkspaceShellSandboxBackend = "macos-seatbelt" | "linux-bubblewrap";
export type WorkspaceProcessIsolationBackend = WorkspaceShellSandboxBackend | "node-permission-opt-in";

export type WorkspaceShellSandboxStatus =
  | { available: true; backend: WorkspaceShellSandboxBackend }
  | { available: false; backend: null; reason: string };

export type WorkspaceSandboxedShell = {
  backend: WorkspaceProcessIsolationBackend;
  child: ChildProcess;
  cleanup: () => Promise<void>;
};

type SpawnWorkspaceShellInput = {
  command: string;
  workspaceRoot: string;
  env: NodeJS.ProcessEnv;
};

export type SpawnWorkspaceProcessInput = {
  executable: string;
  args: string[];
  workspaceRoot: string;
  env: NodeJS.ProcessEnv;
  writableWorkspace?: boolean;
  allowChildProcesses?: boolean;
};

const MACOS_SANDBOX_EXEC = "/usr/bin/sandbox-exec";
const SAFE_ENVIRONMENT_KEYS = new Set([
  "PATH",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "CI",
]);
const POLICY_SCAN_SKIPPED_DIRS = new Set([
  "node_modules",
  ".pnpm",
  ".pnpm-store",
  ".cache",
  "dist",
  "build",
  "coverage",
]);

export function sanitizeWorkspaceShellEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && (SAFE_ENVIRONMENT_KEYS.has(key) || key.startsWith("LC_"))) env[key] = value;
  }
  return env;
}

function findBubblewrap() {
  const status = getBubblewrapRuntimeStatus();
  return status.available ? status.executable : undefined;
}

export function getWorkspaceShellSandboxStatus(): WorkspaceShellSandboxStatus {
  if (process.platform === "darwin" && existsSync(MACOS_SANDBOX_EXEC)) {
    return { available: true, backend: "macos-seatbelt" };
  }
  if (process.platform === "linux") {
    const status = getBubblewrapRuntimeStatus();
    if (status.available) return { available: true, backend: "linux-bubblewrap" };
    return { available: false, backend: null, reason: `Professor Mari shell commands are disabled. ${status.reason}` };
  }
  return {
    available: false,
    backend: null,
    reason: `Professor Mari shell commands are disabled because no supported OS sandbox is available on ${process.platform}.`,
  };
}

function sandboxLiteral(path: string) {
  const resolved = resolve(path);
  return JSON.stringify(existsSync(resolved) ? realpathSync(resolved) : resolved);
}

function uniqueExistingPaths(paths: Array<string | undefined>) {
  return [
    ...new Set(
      paths
        .filter((path): path is string => Boolean(path))
        .map((path) => resolve(path))
        .filter((path) => existsSync(path))
        .map((path) => realpathSync(path)),
    ),
  ];
}

function uniqueExistingMountPaths(paths: Array<string | undefined>) {
  return [
    ...new Set(
      paths
        .filter((path): path is string => Boolean(path))
        .map((path) => resolve(path))
        .filter((path) => existsSync(path)),
    ),
  ];
}

// The walk runs fresh on every spawn on purpose: caching would let a newly
// created secret file slip past the deny list. It is async so a large
// workspace scan yields to the event loop instead of blocking other requests.
// #5892: package-store trees become READ-ONLY in the sandbox. Sandboxed bash
// has no legitimate install path (isPackageManagerMutationCommand refuses
// package-manager mutations before execution, and approved dependency
// installs run OUTSIDE the sandbox), so the #5786 residual - planting
// ready-made node_modules/<pkg> code that executes on the server's next
// require - closes structurally. Build-tool caches that legitimately live
// inside the store get writable carve-outs, pre-created when absent so a
// first build is not broken by its own missing cache directory.
const PACKAGE_STORE_DIR_NAMES = new Set(["node_modules", ".pnpm", ".pnpm-store"]);
// .vite-temp: modern Vite bundles a TS/ESM config into node_modules/.vite-temp
// before anything else runs (probed against this repo's vite@7.x), so without
// the carve-out every default-scaffold build fails on a read-only store.
const PACKAGE_STORE_WRITABLE_CACHES = [".cache", ".vite", ".vite-temp"];

/**
 * Takes the LOGICAL node_modules stores (see workspacePolicyPaths) - a store
 * exposed through a symlink has a canonical target with some other basename,
 * so a physical-name check here would leave linked stores without their
 * cache carve-outs and every build writing node_modules/.cache would fail.
 * Exported for the regression lane.
 */
export async function packageStoreCacheCarveouts(nodeModulesStores: string[]): Promise<string[]> {
  const carveouts: string[] = [];
  for (const store of nodeModulesStores) {
    for (const cache of PACKAGE_STORE_WRITABLE_CACHES) {
      const cachePath = join(store, cache);
      try {
        await mkdir(cachePath, { recursive: true });
        // CWE-59: mkdir succeeds through an existing directory SYMLINK, and
        // the write grant would then aim at the link's target. Only a real
        // directory sitting canonically at store/<cache> qualifies.
        const stats = await lstat(cachePath);
        if (stats.isSymbolicLink() || !stats.isDirectory()) continue;
        if (realpathSync(cachePath) !== join(realpathSync(store), cache)) continue;
        carveouts.push(cachePath);
      } catch {
        /* an unreadable store keeps its cache unwritable - fail closed */
      }
    }
  }
  return carveouts;
}

/** Exported for the regression lane; production goes through the profile builders. */
export async function workspacePolicyPaths(workspaceRoot: string) {
  // CWE-59 (#5894 review): the containment checks below compare CANONICAL
  // store targets against this root - a symlinked root (macOS tmpdirs live
  // under /var -> /private/var) would reject every in-workspace linked store
  // as "outside" and silently drop its bind rule AND its storeLinks entry,
  // leaving nothing to restore post-run. Resolve the root to its physical
  // path before anything is measured against it.
  try {
    workspaceRoot = realpathSync(workspaceRoot);
  } catch {
    /* an unreadable root fails loudly in the walk below */
  }
  const forbidden: string[] = [];
  const sensitive: string[] = [];
  const packageStores: string[] = [];
  const storeLinks: Array<{ link: string; target: string }> = [];
  // Canonical paths whose LOGICAL name is node_modules - the only store kind
  // whose caches must stay writable - tracked separately because a symlinked
  // store's canonical target carries a different basename.
  const nodeModulesStores: string[] = [];
  const visit = async (path: string) => {
    const policy = workspacePathAccessPolicy(workspaceRoot, path);
    if (policy === "forbidden") {
      forbidden.push(path);
      return;
    }
    const stats = await lstat(path);
    if (policy === "sensitive") {
      sensitive.push(path);
      if (stats.isDirectory()) return;
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) return;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (PACKAGE_STORE_DIR_NAMES.has(entry.name)) {
        const storePath = join(path, entry.name);
        if (entry.isDirectory()) {
          // Seen while being skipped: recorded for the read-only bind at
          // zero extra walk cost, nested stores included.
          packageStores.push(storePath);
          if (entry.name === "node_modules") nodeModulesStores.push(storePath);
        } else if (entry.isSymbolicLink()) {
          // CWE-59: a store exposed AS a symlink must protect its TARGET -
          // writes travel through the link. Only in-workspace targets need a
          // rule (outside targets are never sandbox-writable to begin with);
          // a dangling link protects nothing.
          try {
            const target = realpathSync(storePath);
            if (
              (target === workspaceRoot || target.startsWith(workspaceRoot + sep)) &&
              statSync(target).isDirectory()
            ) {
              packageStores.push(target);
              storeLinks.push({ link: storePath, target });
              if (entry.name === "node_modules") nodeModulesStores.push(target);
            }
          } catch {
            /* dangling or unreadable link */
          }
        }
        continue;
      }
      if (entry.isDirectory() && POLICY_SCAN_SKIPPED_DIRS.has(entry.name)) continue;
      await visit(join(path, entry.name));
    }
  };
  await visit(workspaceRoot);
  return {
    forbidden: uniqueExistingPaths(forbidden),
    sensitive: uniqueExistingPaths(sensitive),
    packageStores: uniqueExistingPaths(packageStores),
    nodeModulesStores: uniqueExistingPaths(nodeModulesStores),
    storeLinks,
  };
}

// ── #5786: post-execution safety net ────────────────────────────────────────────
// The deny list above is spawn-time-only: a command can create a NEW
// sensitive-by-name file (a package.json in a fresh directory, a root
// Dockerfile that was absent) with no rule attached and no review. The
// pre-command heuristics catch common write shapes, but they are string
// checks by design. These functions are the net under all of it: a
// fingerprint of every sensitive file before the command, and a re-walk
// after it, so an unreviewed write is detected no matter what command shape
// produced it.
//
// Hardening rules (adversarial review, #5786):
// - Only REGULAR files are ever opened. A symlink is fingerprinted by its
//   own identity and never followed - this scan runs in the unsandboxed
//   server process, and following a link named package.json would read
//   arbitrary host files into an approval card (or hang on a FIFO, or read
//   /dev/zero unboundedly). Special files get the same treatment.
// - Failures are contained PER ENTRY: a file the command chmod'd unreadable
//   still produces a (diffable) fingerprint instead of aborting the walk,
//   so its co-created siblings are still caught and reverted.
// - Content is retained as raw BYTES (a utf8 round-trip corrupts binary
//   lockfiles like bun.lockb on restore), up to the review cap; grossly
//   oversized files are fingerprinted by size alone and never read.
const SNAPSHOT_HARD_READ_CAP_BYTES = 8 * 1024 * 1024;
// Aggregate retention budget for a single scan: per-file caps bound each
// entry, this bounds the SUM - thousands of planted ~512KB manifests must
// not OOM the server during the very scan meant to contain them. Past the
// budget, hits still revert (hash + unlink need no content) but cannot stage.
const SCAN_RETAINED_CONTENT_BUDGET_BYTES = 8 * 1024 * 1024;
// The scan's own skip set is NARROWER than the spawn walk's: dist/, build/,
// coverage/, .cache/ are walked (a manifest planted there is exactly the
// #5786 class - verified bypass otherwise), while the package-store trees
// stay skipped for cost. That skip is safe since #5892: the stores are
// READ-ONLY in the sandbox (see PACKAGE_STORE_DIR_NAMES), and a store
// directory the run itself creates is walked in full by the scan.
const SCAN_SKIPPED_DIRS = new Set(["node_modules", ".pnpm", ".pnpm-store", ".git"]);
// A hostile command can mkdir-storm the workspace; the scan must stay
// bounded. Past the cap the walk stops and says so - the caller treats the
// remainder as uninspectable, which the attribution machinery already
// handles safely (report, never delete).
const MAX_SCAN_ENTRIES = 50_000;

type SensitiveFingerprint = { kind: "file"; hash: string; content: Buffer | null } | { kind: "dir" };

export type SensitiveWorkspaceSnapshot = {
  files: Map<string, SensitiveFingerprint>;
  /**
   * Canonical package-store paths at snapshot time. Store contents are the
   * scan's documented residual; tracking them canonically keeps a store
   * exposed through a symlink exempt even if the link is created or deleted
   * during the run.
   */
  storePaths: string[];
  /**
   * Store symlinks (link -> canonical target) at snapshot time. The mount
   * layer can only protect the TARGET - the link entry itself lives in the
   * writable workspace - so post-run integrity is checked here: a link
   * unlinked and recreated as a real directory is an escape from the
   * read-only store, quarantined and restored by restoreReplacedStoreLinks.
   */
  storeLinks: StoreLink[];
  /**
   * Subtrees the PRE-run walk could not inspect. Anything detected under
   * them later cannot be attributed to the command - a pre-existing file
   * would look "created" - so the revert must never delete there.
   */
  unscannable: string[];
  /**
   * The walk stopped at the entry cap: the files map is INCOMPLETE, so no
   * "created" attribution from a later scan can be trusted.
   */
  entryCapExceeded: boolean;
};

export type UnreviewedSensitiveChange = {
  absolutePath: string;
  relativePath: string;
  change: "created" | "modified";
  beforeContent: Buffer | null;
  /**
   * UTF-8 text for the approval card; null when the file cannot be staged
   * (binary, oversize, unreadable, not a regular file, or past the scan's
   * aggregate retention budget).
   */
  afterContent: string | null;
  /**
   * True when the PRE-run walk could not inspect this file's subtree: the
   * "created" attribution is then untrustworthy (it may simply have been
   * invisible before), and the revert must report instead of delete.
   */
  attributionUncertain: boolean;
};

export type SensitiveScanResult = {
  hits: UnreviewedSensitiveChange[];
  /** Paths the walk could not inspect - reported loudly, never silently. */
  unscannable: string[];
  /** The walk stopped at the entry cap; the remainder went uninspected. */
  entryCapExceeded: boolean;
};

async function fingerprintSensitiveFile(path: string, stats: Stats): Promise<SensitiveFingerprint> {
  if (stats.isSymbolicLink()) {
    let target = "unresolved";
    try {
      target = await readlink(path);
    } catch {
      /* fingerprint below still identifies it as a link */
    }
    return { kind: "file", hash: `symlink:${target}`, content: null };
  }
  if (!stats.isFile()) {
    return { kind: "file", hash: `special:${stats.mode}:${stats.size}`, content: null };
  }
  if (stats.size > SNAPSHOT_HARD_READ_CAP_BYTES) {
    return { kind: "file", hash: `oversize:${stats.size}:${Math.trunc(stats.mtimeMs)}`, content: null };
  }
  try {
    const raw = await readFile(path);
    return {
      kind: "file",
      hash: createHash("sha256").update(raw).digest("hex"),
      content: raw.byteLength <= MAX_REVIEW_FILE_BYTES ? raw : null,
    };
  } catch (err) {
    return { kind: "file", hash: `unreadable:${(err as NodeJS.ErrnoException).code ?? "error"}`, content: null };
  }
}

type StoreLink = { link: string; target: string };

async function canonicalStorePaths(workspaceRoot: string): Promise<{ paths: string[]; links: StoreLink[] }> {
  // The policy walk deliberately THROWS on unreadable entries - for the
  // spawn path that is fail-closed (a rule it cannot mint is a command that
  // does not run). The scan must not inherit that hard failure: no store
  // exemptions is the fail-safe direction here (the scan then walks and
  // REPORTS more, never less), so contain the walk error to an empty set.
  let policy;
  try {
    policy = await workspacePolicyPaths(workspaceRoot);
  } catch (err) {
    logger.warn(err, "[mari] Store discovery for the post-run scan failed; scanning without store exemptions");
    return { paths: [], links: [] };
  }
  const canonical: string[] = [];
  for (const store of policy.packageStores) {
    try {
      canonical.push(realpathSync(store));
    } catch {
      /* vanished between walks */
    }
  }
  return { paths: canonical, links: policy.storeLinks };
}

async function walkSensitiveEntries(
  workspaceRoot: string,
  onEntry: (path: string, fingerprint: SensitiveFingerprint) => void,
  descendIntoCoveredDir: (path: string) => boolean,
  unscannable: string[],
  storePaths: readonly string[] = [],
): Promise<{ entryCapExceeded: boolean }> {
  let remainingEntries = MAX_SCAN_ENTRIES;
  let entryCapExceeded = false;
  const visit = async (path: string) => {
    if (remainingEntries <= 0) {
      entryCapExceeded = true;
      return;
    }
    remainingEntries -= 1;
    let policy: "normal" | "sensitive" | "forbidden";
    let stats: Stats;
    try {
      policy = workspacePathAccessPolicy(workspaceRoot, path);
      if (policy === "forbidden") return;
      stats = await lstat(path);
    } catch {
      unscannable.push(path);
      return;
    }
    if (policy === "sensitive" && (!stats.isDirectory() || stats.isSymbolicLink())) {
      onEntry(path, await fingerprintSensitiveFile(path, stats));
      return;
    }
    if (policy === "sensitive") {
      onEntry(path, { kind: "dir" });
      // An EXISTING sensitive directory is covered by the spawn-time rules,
      // so its subtree needs no fingerprints; a directory that appeared
      // during the run has no rule at all and must be walked in full.
      if (!descendIntoCoveredDir(path)) return;
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) return;
    // Canonical store identity beats physical naming: a store exposed (or
    // once exposed) through a symlink is exempt by its TARGET path, so the
    // scan neither reverts legitimate carve-out writes inside it nor - if
    // the link vanished mid-run - misreads the target as "created" files.
    if (storePaths.length > 0) {
      try {
        if (storePaths.includes(realpathSync(path))) return;
      } catch {
        /* keep walking; per-entry containment reports deeper failures */
      }
    }
    const name = path === workspaceRoot ? "" : path.slice(path.lastIndexOf(sep) + 1);
    if (SCAN_SKIPPED_DIRS.has(name)) {
      // A PRE-EXISTING store is skipped for cost (and is read-only in the
      // sandbox anyway); one the run itself CREATED has no bind covering it
      // and must be walked in full - the marker below is what lets detect's
      // descend predicate tell the two apart.
      onEntry(path, { kind: "dir" });
      if (!descendIntoCoveredDir(path)) return;
    }
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      unscannable.push(path);
      return;
    }
    for (const entry of entries) {
      await visit(join(path, entry.name));
    }
  };
  await visit(workspaceRoot);
  return { entryCapExceeded };
}

export async function snapshotSensitiveWorkspaceFiles(workspaceRoot: string): Promise<SensitiveWorkspaceSnapshot> {
  const files = new Map<string, SensitiveFingerprint>();
  const unscannable: string[] = [];
  const { paths: storePaths, links: storeLinks } = await canonicalStorePaths(workspaceRoot);
  const { entryCapExceeded } = await walkSensitiveEntries(
    workspaceRoot,
    (path, fingerprint) => files.set(resolve(path), fingerprint),
    () => false,
    unscannable,
    storePaths,
  );
  return { files, unscannable, entryCapExceeded, storePaths, storeLinks };
}

function stageableText(content: Buffer | null): string | null {
  if (content === null) return null;
  const text = content.toString("utf8");
  // Binary content does not survive a utf8 round-trip; such files can be
  // reverted (bytes retained) but never staged as a text diff.
  return Buffer.compare(Buffer.from(text, "utf8"), content) === 0 ? text : null;
}

/**
 * #5894 review (CWE-59, third edition): the mount layer protects a linked
 * store's TARGET, but the link entry itself sits in the writable workspace -
 * a command can unlink it and recreate it as a real directory, writing into
 * an unprotected impostor that shadows the read-only store (require() would
 * resolve planted code from it with no sensitive-named file involved).
 * Post-run, every snapshot-time store link is verified: an impostor is
 * QUARANTINED BY RENAME (never deleted - a concurrent legitimate writer is
 * conceivable, and the quarantine name is not skip-named, so the normal scan
 * still stages any sensitive-by-name files inside it) and the link restored.
 * Returns engine lines describing what happened.
 */
export async function restoreReplacedStoreLinks(snapshot: SensitiveWorkspaceSnapshot): Promise<string[]> {
  const lines: string[] = [];
  for (const { link, target } of snapshot.storeLinks) {
    try {
      let current: Stats | null = null;
      try {
        current = await lstat(link);
      } catch {
        current = null;
      }
      if (current?.isSymbolicLink()) {
        try {
          if (realpathSync(link) === target) continue;
        } catch {
          /* dangling now - fall through to restore */
        }
        await rm(link, { force: true });
      } else if (current) {
        // #5894 review: the destination must be unguessable and collisions
        // retried - rename onto a NON-EMPTY directory fails, so a command
        // that pre-planted content at a predictable timestamp name would
        // keep its impostor live at the store path.
        let quarantine: string | null = null;
        let renameFailure: unknown = null;
        for (let attempt = 0; attempt < 3 && quarantine === null; attempt += 1) {
          const candidate = `${link}.unreviewed-${randomBytes(6).toString("hex")}`;
          try {
            await rename(link, candidate);
            quarantine = candidate;
          } catch (renameErr) {
            renameFailure = renameErr;
          }
        }
        if (quarantine === null) throw renameFailure;
        lines.push(
          `A package-store symlink was replaced during the run; the replacement was quarantined to ${quarantine
            .slice(link.length - basename(link).length)
            .replace(/[\r\n]+/gu, " ")} and the link restored - ask the user to inspect the quarantined directory.`,
        );
      }
      await symlink(target, link, "junction");
    } catch (err) {
      logger.error(err, "[mari] Could not restore a replaced package-store symlink");
      lines.push(
        `A package-store symlink changed during the run and could not be restored; ask the user to inspect it.`,
      );
    }
  }
  return lines;
}

export async function detectUnreviewedSensitiveChanges(
  workspaceRoot: string,
  before: SensitiveWorkspaceSnapshot,
): Promise<SensitiveScanResult> {
  const hits: UnreviewedSensitiveChange[] = [];
  const unscannable: string[] = [];
  let retainedBudget = SCAN_RETAINED_CONTENT_BUDGET_BYTES;
  // An incomplete snapshot (cap hit) means NO created-attribution is
  // trustworthy: the file may simply never have been fingerprinted.
  const underUnscannable = (absolute: string) =>
    before.entryCapExceeded ||
    before.unscannable.some((prefix) => absolute === prefix || absolute.startsWith(prefix + sep));
  const capState = await walkSensitiveEntries(
    workspaceRoot,
    (path, fingerprint) => {
      if (fingerprint.kind === "dir") return;
      const absolute = resolve(path);
      const prior = before.files.get(absolute);
      if (prior && prior.kind === "file" && prior.hash === fingerprint.hash) return;
      const isNew = !prior || prior.kind === "dir";
      let afterContent = stageableText(fingerprint.content);
      if (afterContent !== null) {
        const cost = Buffer.byteLength(afterContent, "utf8");
        if (cost > retainedBudget) afterContent = null;
        else retainedBudget -= cost;
      }
      hits.push({
        absolutePath: absolute,
        relativePath: relative(workspaceRoot, absolute).split(sep).join("/"),
        change: isNew ? "created" : "modified",
        beforeContent: prior && prior.kind === "file" ? prior.content : null,
        afterContent,
        attributionUncertain: isNew && underUnscannable(absolute),
      });
    },
    // Directories the snapshot never saw were created by the run and have no
    // rule covering them: walk them in full.
    (path) => !before.files.has(resolve(path)),
    unscannable,
    // SNAPSHOT-time stores only: those were read-only-bound for the whole
    // run (so nothing unreviewed can sit in them, and a link deleted
    // mid-run cannot expose its already-exempt target), while a store the
    // run itself CREATED was never bound and must be walked in full.
    before.storePaths,
  );
  return { hits, unscannable, entryCapExceeded: capState.entryCapExceeded };
}

function macosReadRoots(workspaceRoot: string, env: NodeJS.ProcessEnv, sandboxTemp: string) {
  const pathRoots = (env.PATH ?? "").split(delimiter).filter(Boolean);
  return uniqueExistingPaths([
    workspaceRoot,
    sandboxTemp,
    "/System",
    "/usr",
    "/bin",
    "/sbin",
    "/Library",
    "/private/etc",
    "/private/var/db",
    "/private/var/select",
    "/private/var/run",
    "/dev",
    "/opt/homebrew",
    "/usr/local",
    dirname(process.execPath),
    ...pathRoots,
  ]);
}

export async function buildMacosWorkspaceShellProfile(
  workspaceRoot: string,
  env: NodeJS.ProcessEnv,
  sandboxTemp: string,
  writableWorkspace = true,
  executable = "/bin/bash",
  allowChildProcesses = true,
) {
  const policyPaths = await workspacePolicyPaths(workspaceRoot);
  const storeCaches = writableWorkspace ? await packageStoreCacheCarveouts(policyPaths.nodeModulesStores) : [];
  const readable = macosReadRoots(workspaceRoot, env, sandboxTemp)
    .map((path) => `    (subpath ${sandboxLiteral(path)})`)
    .join("\n");
  const forbiddenReads = policyPaths.forbidden.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  const sensitiveWrites = policyPaths.sensitive.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  const forbiddenReadRule = forbiddenReads ? `(deny file-read*\n${forbiddenReads})` : "";
  const sensitiveWriteRule = writableWorkspace && sensitiveWrites ? `(deny file-write*\n${sensitiveWrites})` : "";
  const storeWrites = policyPaths.packageStores.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  const storeWriteRule = writableWorkspace && storeWrites ? `(deny file-write*\n${storeWrites})` : "";
  const storeCacheAllows = storeCaches.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  // Placed AFTER the store deny: seatbelt's last matching rule wins, so the
  // cache subpaths stay writable inside the otherwise read-only store.
  const storeCacheRule = writableWorkspace && storeCacheAllows ? `(allow file-write*\n${storeCacheAllows})` : "";
  const workspaceWriteRule = writableWorkspace ? `    (subpath ${sandboxLiteral(workspaceRoot)})\n` : "";
  const processRules = allowChildProcesses
    ? `(allow process*)\n(allow signal)`
    : `(allow process-exec (literal ${sandboxLiteral(executable)}))\n(allow process-info* (target self))\n(allow signal (target self))`;
  return `(version 1)
(deny default)
${processRules}
(allow sysctl-read)
(allow mach-lookup)
(allow ipc-posix*)
(allow file-read-metadata)
(allow file-read*
    (literal "/")
${readable})
(allow file-write*
${workspaceWriteRule}
    (subpath ${sandboxLiteral(sandboxTemp)})
    (literal "/dev/null")
    (literal "/dev/tty"))
${forbiddenReadRule}
${sensitiveWriteRule}
${storeWriteRule}
${storeCacheRule}
(deny network*)
`;
}

function linuxReadRoots(workspaceRoot: string, env: NodeJS.ProcessEnv) {
  const pathRoots = (env.PATH ?? "").split(delimiter).filter(Boolean);
  // Preserve paths such as /bin and /lib even when the host exposes them as
  // symlinks into /usr. Bubblewrap starts with an empty root, so canonicalizing
  // those mount destinations would remove the aliases expected by shells and
  // ELF interpreters inside the sandbox.
  return uniqueExistingMountPaths([
    "/usr",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
    "/etc",
    "/nix/store",
    dirname(process.execPath),
    workspaceRoot,
    ...pathRoots,
  ]);
}

export async function linuxBubblewrapArgs(
  workspaceRoot: string,
  env: NodeJS.ProcessEnv,
  sandboxTemp: string,
  executable: string,
  commandArgs: string[],
  writableWorkspace: boolean,
) {
  const policyPaths = await workspacePolicyPaths(workspaceRoot);
  const args = [
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
  ];
  for (const root of linuxReadRoots(workspaceRoot, env)) {
    if (root === workspaceRoot) continue;
    args.push("--ro-bind", root, root);
  }
  args.push(writableWorkspace ? "--bind" : "--ro-bind", workspaceRoot, workspaceRoot);
  args.push("--bind", sandboxTemp, sandboxTemp);
  for (const path of policyPaths.sensitive) {
    args.push("--ro-bind", path, path);
  }
  if (writableWorkspace) {
    for (const store of policyPaths.packageStores) {
      args.push("--ro-bind", store, store);
    }
    // Later mounts stack over earlier ones: the cache dirs come back
    // writable inside the read-only store.
    for (const cache of await packageStoreCacheCarveouts(policyPaths.nodeModulesStores)) {
      args.push("--bind", cache, cache);
    }
  }
  for (const path of policyPaths.forbidden) {
    if ((await lstat(path)).isDirectory()) args.push("--tmpfs", path);
    else args.push("--ro-bind", "/dev/null", path);
  }
  args.push("--chdir", workspaceRoot);
  args.push(executable, ...commandArgs);
  return args;
}

export async function spawnWorkspaceSandboxedProcess(
  input: SpawnWorkspaceProcessInput,
): Promise<WorkspaceSandboxedShell> {
  const status = getWorkspaceShellSandboxStatus();
  if (!status.available) {
    throw new Error(`${status.reason}`);
  }

  // #5892: canonicalize BEFORE any rules are derived. The store/sensitive
  // ro-binds go through realpath (uniqueExistingPaths), so a symlink
  // component in the workspace path would otherwise put the writable
  // workspace bind and the read-only binds on two different mount points -
  // and every deny would silently fail open on Linux.
  const resolvedRoot = resolve(input.workspaceRoot);
  const workspaceRoot = existsSync(resolvedRoot) ? realpathSync(resolvedRoot) : resolvedRoot;
  const writableWorkspace = input.writableWorkspace !== false;
  const allowChildProcesses = input.allowChildProcesses !== false;
  const sandboxTemp = await mkdtemp(join(tmpdir(), "marinara-mari-shell-"));
  const safeEnv = sanitizeWorkspaceShellEnv(input.env);
  const env: NodeJS.ProcessEnv = {
    ...safeEnv,
    HOME: workspaceRoot,
    TMPDIR: sandboxTemp,
    TMP: sandboxTemp,
    TEMP: sandboxTemp,
    XDG_CACHE_HOME: sandboxTemp,
    XDG_CONFIG_HOME: sandboxTemp,
    XDG_DATA_HOME: sandboxTemp,
  };
  let child: ChildProcess;
  try {
    if (status.backend === "macos-seatbelt") {
      child = spawn(
        MACOS_SANDBOX_EXEC,
        [
          "-p",
          await buildMacosWorkspaceShellProfile(
            workspaceRoot,
            env,
            sandboxTemp,
            writableWorkspace,
            input.executable,
            allowChildProcesses,
          ),
          input.executable,
          ...input.args,
        ],
        { cwd: workspaceRoot, env, windowsHide: true, detached: true, stdio: ["pipe", "pipe", "pipe"] },
      );
    } else {
      child = spawn(
        findBubblewrap()!,
        await linuxBubblewrapArgs(workspaceRoot, env, sandboxTemp, input.executable, input.args, writableWorkspace),
        { cwd: workspaceRoot, env, windowsHide: true, detached: true, stdio: ["pipe", "pipe", "pipe"] },
      );
    }
  } catch (error) {
    await rm(sandboxTemp, { recursive: true, force: true });
    throw error;
  }

  let cleaned = false;
  return {
    backend: status.backend,
    child,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await rm(sandboxTemp, { recursive: true, force: true });
    },
  };
}

/**
 * #5892: signal the sandboxed process GROUP (the spawn is detached, so the
 * child leads its own group), taking backgrounded grandchildren with it - the
 * macOS teardown-survivor residual, since seatbelt has no PID-namespace
 * equivalent of bubblewrap's --die-with-parent. Residuals: a process that
 * setsid()s itself out of the group, and - macOS only - a tree orphaned by a
 * hard SERVER crash (teardown never runs; Linux is covered by
 * --die-with-parent regardless of grouping).
 */
export function killSandboxedProcessTree(child: Pick<ChildProcess, "pid" | "kill">, signal: NodeJS.Signals): void {
  if (typeof child.pid === "number" && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      /* group gone or not a leader - fall through to the direct child */
    }
  }
  child.kill(signal);
}

export async function spawnWorkspaceSandboxedShell(input: SpawnWorkspaceShellInput): Promise<WorkspaceSandboxedShell> {
  try {
    const sandboxed = await spawnWorkspaceSandboxedProcess({
      executable: "/bin/bash",
      args: ["--noprofile", "--norc", "-c", input.command],
      workspaceRoot: input.workspaceRoot,
      env: input.env,
    });
    sandboxed.child.stdin?.end();
    return sandboxed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message} Use Professor Mari's structured read, grep, find, ls, edit, write, copy, move, remove, and app_data tools instead.`,
    );
  }
}
