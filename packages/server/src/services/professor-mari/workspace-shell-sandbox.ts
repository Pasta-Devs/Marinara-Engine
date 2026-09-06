import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { lstat, mkdtemp, readdir, readlink, rm } from "node:fs/promises";
import type { Stats } from "node:fs";
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { MAX_REVIEW_FILE_BYTES, workspacePathAccessPolicy } from "./workspace-change-review.service.js";
import { getBubblewrapRuntimeStatus } from "../sandbox/bubblewrap-runtime.js";

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
async function workspacePolicyPaths(workspaceRoot: string) {
  const forbidden: string[] = [];
  const sensitive: string[] = [];
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
      if (entry.isDirectory() && POLICY_SCAN_SKIPPED_DIRS.has(entry.name)) continue;
      await visit(join(path, entry.name));
    }
  };
  await visit(workspaceRoot);
  return {
    forbidden: uniqueExistingPaths(forbidden),
    sensitive: uniqueExistingPaths(sensitive),
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
// stay skipped for cost. Their contents are a documented residual: writing
// inside node_modules was always sandbox-permitted, and the review floor
// defends the manifests that would INSTALL such content, not the store
// itself.
const SCAN_SKIPPED_DIRS = new Set(["node_modules", ".pnpm", ".pnpm-store", ".git"]);

type SensitiveFingerprint = { kind: "file"; hash: string; content: Buffer | null } | { kind: "dir" };

export type SensitiveWorkspaceSnapshot = {
  files: Map<string, SensitiveFingerprint>;
  /**
   * Subtrees the PRE-run walk could not inspect. Anything detected under
   * them later cannot be attributed to the command - a pre-existing file
   * would look "created" - so the revert must never delete there.
   */
  unscannable: string[];
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

async function walkSensitiveEntries(
  workspaceRoot: string,
  onEntry: (path: string, fingerprint: SensitiveFingerprint) => void,
  descendIntoCoveredDir: (path: string) => boolean,
  unscannable: string[],
) {
  const visit = async (path: string) => {
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
    const name = path === workspaceRoot ? "" : path.slice(path.lastIndexOf(sep) + 1);
    if (SCAN_SKIPPED_DIRS.has(name)) return;
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
}

export async function snapshotSensitiveWorkspaceFiles(workspaceRoot: string): Promise<SensitiveWorkspaceSnapshot> {
  const files = new Map<string, SensitiveFingerprint>();
  const unscannable: string[] = [];
  await walkSensitiveEntries(
    workspaceRoot,
    (path, fingerprint) => files.set(resolve(path), fingerprint),
    () => false,
    unscannable,
  );
  return { files, unscannable };
}

function stageableText(content: Buffer | null): string | null {
  if (content === null) return null;
  const text = content.toString("utf8");
  // Binary content does not survive a utf8 round-trip; such files can be
  // reverted (bytes retained) but never staged as a text diff.
  return Buffer.compare(Buffer.from(text, "utf8"), content) === 0 ? text : null;
}

export async function detectUnreviewedSensitiveChanges(
  workspaceRoot: string,
  before: SensitiveWorkspaceSnapshot,
): Promise<SensitiveScanResult> {
  const hits: UnreviewedSensitiveChange[] = [];
  const unscannable: string[] = [];
  let retainedBudget = SCAN_RETAINED_CONTENT_BUDGET_BYTES;
  const underUnscannable = (absolute: string) =>
    before.unscannable.some((prefix) => absolute === prefix || absolute.startsWith(prefix + sep));
  await walkSensitiveEntries(
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
  );
  return { hits, unscannable };
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
  const readable = macosReadRoots(workspaceRoot, env, sandboxTemp)
    .map((path) => `    (subpath ${sandboxLiteral(path)})`)
    .join("\n");
  const forbiddenReads = policyPaths.forbidden.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  const sensitiveWrites = policyPaths.sensitive.map((path) => `    (subpath ${sandboxLiteral(path)})`).join("\n");
  const forbiddenReadRule = forbiddenReads ? `(deny file-read*\n${forbiddenReads})` : "";
  const sensitiveWriteRule = writableWorkspace && sensitiveWrites ? `(deny file-write*\n${sensitiveWrites})` : "";
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

async function linuxBubblewrapArgs(
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

  const workspaceRoot = resolve(input.workspaceRoot);
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
        { cwd: workspaceRoot, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
    } else {
      child = spawn(
        findBubblewrap()!,
        await linuxBubblewrapArgs(workspaceRoot, env, sandboxTemp, input.executable, input.args, writableWorkspace),
        { cwd: workspaceRoot, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
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
