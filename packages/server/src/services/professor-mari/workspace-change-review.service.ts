import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { nanoid } from "nanoid";
import type {
  MariDependencyInstallApproval,
  MariDependencyTarget,
  MariSensitiveFileApproval,
  MariWorkspacePendingApproval,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

const APPROVAL_TIMEOUT_MS = 10 * 60_000;
const INSTALL_TIMEOUT_MS = 10 * 60_000;
const MAX_REGISTRY_RESPONSE_BYTES = 1_000_000;
export const MAX_REVIEW_FILE_BYTES = 512_000;
const MAX_REVIEW_DIFF_BYTES = 64_000;
const MAX_PROCESS_OUTPUT = 32_000;
const PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/";

const PACKAGE_CONTROL_FILES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  ".pnpmfile.cjs",
  ".yarnrc",
  ".yarnrc.yml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "deno.json",
  "deno.jsonc",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "pipfile",
  "pipfile.lock",
  "gemfile",
  "gemfile.lock",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "composer.json",
  "composer.lock",
]);

const ROOT_LAUNCHER_FILES = new Set([
  "start.sh",
  "start.bat",
  "start-termux.sh",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
]);

const TARGET_MANIFESTS: Record<MariDependencyTarget, string> = {
  root: "package.json",
  client: "packages/client/package.json",
  server: "packages/server/package.json",
  shared: "packages/shared/package.json",
};

const TARGET_FILTERS: Partial<Record<MariDependencyTarget, string>> = {
  client: "@marinara-engine/client",
  server: "@marinara-engine/server",
  shared: "@marinara-engine/shared",
};

type FileReviewRecord = MariSensitiveFileApproval & {
  absolutePath: string;
  realTarget: string;
  beforeContent: string | null;
  afterContent: string;
  processing: boolean;
  timer: NodeJS.Timeout;
};

type DependencyReviewRecord = MariDependencyInstallApproval & {
  manifestHash: string;
  lockfileHash: string | null;
  processing: boolean;
  timer: NodeJS.Timeout;
};

type SecurityReviewRecord = FileReviewRecord | DependencyReviewRecord;

export type WorkspaceSecurityApprovalResult = {
  ok: boolean;
  approval: MariSensitiveFileApproval | MariDependencyInstallApproval;
  completed: boolean;
  outcome: "applied" | "discarded" | "state_changed" | "failed";
  output?: string;
  error?: string;
};

type RegistryPackageMetadata = {
  name?: unknown;
  version?: unknown;
  dist?: {
    integrity?: unknown;
    tarball?: unknown;
  };
  dependencies?: unknown;
};

type DependencyInstallRunner = (input: {
  workspaceRoot: string;
  target: MariDependencyTarget;
  packageName: string;
  version: string;
  integrity: string;
  dev: boolean;
}) => Promise<{ ok: boolean; output: string }>;

type WorkspaceChangeReviewOptions = {
  fetchImpl?: typeof fetch;
  installDependency?: DependencyInstallRunner;
};

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function readOptionalText(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function normalizeRelativePath(path: string) {
  return path.split(sep).join("/").replace(/^\.\//, "");
}

// Takes a name already folded by fileSystemName. The auto-generated encryption key (utils/crypto.ts) sits in
// DATA_DIR, inside the workspace by default, and unlocks every saved API key, so it is a secret like .env.
function isServerSecretName(normalized: string) {
  if (normalized === ".env.example" || normalized === ".env.sample" || normalized === ".env.template") {
    return false;
  }
  return normalized === ".env" || normalized.startsWith(".env.") || normalized === ".encryption-key";
}

export function workspacePathAccessPolicy(
  workspaceRoot: string,
  absolutePath: string,
): "normal" | "sensitive" | "forbidden" {
  const root = resolve(workspaceRoot);
  const absolute = resolve(absolutePath);
  const rel = relative(root, absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || resolve(root, rel) !== absolute) return "forbidden";
  const normalized = normalizeRelativePath(rel).toLowerCase();
  const parts = normalized.split("/").filter(Boolean);
  // Folded the way the file system reads names, so ".ENV", ".git." or ".encryption-key::$DATA" still match.
  const fileSystemParts = parts.map(fileSystemName);

  if (fileSystemParts.includes(".git") || isServerSecretName(fileSystemParts.at(-1) ?? "")) return "forbidden";
  // The sensitive checks use the same folded names, so "package.json." or "start.sh::$DATA" still count.
  const folded = fileSystemParts.join("/");
  const foldedName = fileSystemParts.at(-1) ?? "";
  if (PACKAGE_CONTROL_FILES.has(foldedName)) return "sensitive";
  if (fileSystemParts.length === 1 && ROOT_LAUNCHER_FILES.has(foldedName)) return "sensitive";
  if (folded === ".github/workflows" || folded.startsWith(".github/workflows/")) return "sensitive";
  if (folded === "win/installer" || folded.startsWith("win/installer/")) return "sensitive";
  if (
    folded === "android/app/build.gradle" ||
    folded === "android/build.gradle" ||
    folded === "android/settings.gradle" ||
    folded.startsWith("android/gradle/wrapper/")
  ) {
    return "sensitive";
  }
  return "normal";
}

/** #6984: what Professor Mari is told, to pass on, when a change would land in build output. */
export const BUILD_OUTPUT_WRITE_REFUSAL =
  "Build files are generated and must not be edited; change the source and rebuild instead.";

// Windows ignores trailing dots and spaces in a name and reads "name:stream" as the name itself, so
// "dist." and "dist::$INDEX_ALLOCATION" open dist there. Volumes that ignore case match more than toLowerCase
// does: APFS opens dist for "diſt" (long s) and "diﬆ" (ligature), which upper- then lower-casing folds, and HFS+
// skips zero-width and direction marks, all default-ignorable. Folding them everywhere costs nothing.
const fileSystemName = (segment = "") =>
  segment
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .toUpperCase()
    .toLowerCase()
    .replace(/:.*$/su, "")
    .replace(/[. ]+$/u, "");

/**
 * #6984: build output is every package's dist folder and the private server builds beside it, such as
 * dist-sandbox. A build writes those files, so Professor Mari may read them but never change them. Every write
 * path asks this about each path it would really touch: the requested one and, through links, the real one.
 */
export function isBuildOutputPath(workspaceRoot: string, absolutePath: string): boolean {
  const rel = relative(resolve(workspaceRoot), resolve(absolutePath));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  const [top, , output] = normalizeRelativePath(rel).split("/").map(fileSystemName);
  return top === "packages" && output !== undefined && /^dist(?:-|$)/u.test(output);
}

// #6984: where a write to `path` lands: its folder's real path, through any links, then the rest. The file name
// itself is replaced by the write's rename, not followed.
function realWriteTarget(path: string) {
  let folder = dirname(path);
  while (!existsSync(folder) && folder !== dirname(folder)) folder = dirname(folder);
  return join(realpathSync(folder), relative(folder, path));
}

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const PACKAGE_CONTROL_NAME_PATTERN = [...PACKAGE_CONTROL_FILES].map(escapeRegExp).join("|");
const ROOT_LAUNCHER_NAME_PATTERN = [...ROOT_LAUNCHER_FILES].map(escapeRegExp).join("|");
// Mirrors workspacePathAccessPolicy's scoping: package-control names are
// sensitive at ANY depth (they may take a path prefix), while launcher names
// and the workflow/installer/gradle paths are sensitive only at the workspace
// root (no path prefix beyond an optional "./"). The left lookbehinds start a
// match only where a path starts, so ordinary names that merely END with a
// sensitive name (mypackage.json, new-start.sh) and a nested docs/start.sh
// never match, and a long path is read once rather than again after every "/".
const SENSITIVE_ROOT_SCOPED_PATTERN =
  `(?:${ROOT_LAUNCHER_NAME_PATTERN})(?![\\w.-])` +
  `|\\.github/workflows/|win/installer/|android/gradle/wrapper/` +
  `|android/(?:app/)?build\\.gradle(?![\\w.-])|android/settings\\.gradle(?![\\w.-])`;
const SENSITIVE_PATH_TARGET_PATTERN =
  `(?<![\\w./~-])(?:[\\w./~-]*/)?(?:${PACKAGE_CONTROL_NAME_PATTERN})(?![\\w.-])` +
  `|(?<![\\w./-])(?:\\./)?(?:${SENSITIVE_ROOT_SCOPED_PATTERN})`;

/**
 * #6984: whether a shell command writes a target. Each writer is a list of steps checked inside one simple command
 * (the text between ; & | and line breaks): every step must match after the previous one, and only its first match
 * is taken. A later match could only find what the first one does, so each step is one linear pass. A single regex
 * retried from every command word costs quadratic time or worse, minutes for a long one-line command, and these
 * checks run on the server's event loop.
 */
function commandWritesTarget(command: string, writers: RegExp[][]): boolean {
  return command
    .replace(/\\/gu, "/")
    .toLowerCase()
    .split(/[;&|\n]/u)
    .some((simpleCommand) =>
      writers.some((steps) => {
        let from = 0;
        for (const step of steps) {
          step.lastIndex = from;
          const match = step.exec(simpleCommand);
          if (!match) return false;
          from = match.index + match[0].length;
        }
        return true;
      }),
    );
}
const writer = (...steps: string[]) => steps.map((step) => new RegExp(step, "gu"));
const commandWord = (names: string) => String.raw`(?:^|\s)(?:${names})\b`;

const SENSITIVE_PATH_TARGET = `(?:${SENSITIVE_PATH_TARGET_PATTERN})`;
const SENSITIVE_PATH_WRITERS = [
  // cp/mv/rm/touch/truncate/tee with a sensitive path in the same segment
  writer(commandWord("cp|mv|rm|touch|truncate|tee"), SENSITIVE_PATH_TARGET),
  // in-place sed/perl on a sensitive path
  writer(commandWord("sed|perl"), String.raw`\s-i\b`, SENSITIVE_PATH_TARGET),
  // shell redirection into a sensitive path - quoted targets included, since
  // LLM-written redirects quote paths more often than not
  writer(String.raw`>>?\s*["']?${SENSITIVE_PATH_TARGET}`),
  // interpreter one-liners writing a sensitive path (node -e writeFileSync,
  // python open(...,'w')) and dd's of= target
  writer(commandWord("node|python(?:3)?"), String.raw`writefile|appendfile|\bopen\(`, SENSITIVE_PATH_TARGET),
  writer(commandWord("dd"), `of=["']?${SENSITIVE_PATH_TARGET}`),
  // git checkout/restore of a sensitive file rewrites it in place
  writer(String.raw`\bgit\s+(?:checkout|restore)\b`, SENSITIVE_PATH_TARGET),
];

/**
 * #5777: the shell sandbox denies writes to EXISTING supply-chain-sensitive
 * paths, but the denial is silent - an error-tolerant compound command
 * (`x; echo done`) exits 0 and the verification guard would count a write
 * that never happened. For sensitive files that do not exist yet (a new
 * package.json in a fresh directory) the sandbox has no deny rule at all, so
 * this check is the primary guard there, not just a nicety. It is still a
 * best-effort heuristic (like bashLooksMutating): it catches the common
 * shapes so the failure is loud and redirects to the write/edit staging flow.
 */
export function bashCommandTargetsSensitivePath(command: string): boolean {
  return commandWritesTarget(command, SENSITIVE_PATH_WRITERS);
}

// #6984: a path into build output (see isBuildOutputPath) inside a shell command, after any prefix. Like the
// sensitive paths above, it starts only where a word starts, so a long path is read once.
const BUILD_OUTPUT_TARGET = String.raw`(?<![^\s"'\x60=(<>;&|])(?:[^\s"'<>;&|]*/)?packages/[^/\s"'<>;&|]+/dist(?:-[^/\s"'<>;&|]*)?(?![^/\s"'<>;&|])`;
const BUILD_OUTPUT_WRITERS = [
  // Commands that change every path they name; a move empties its source too.
  writer(commandWord("mv|rm|rmdir|mkdir|touch|truncate|tee"), BUILD_OUTPUT_TARGET),
  // Copies and links write only their last path, so copying a build file out stays a read.
  writer(
    commandWord("cp|ln|install|rsync"),
    String.raw`\s["']?${BUILD_OUTPUT_TARGET}[^\s"';&|]*["']?\s*(?:\d*>[^;&|\n]*)?$`,
  ),
  writer(commandWord("sed|perl"), String.raw`\s-(?:[a-z]*i|-in-place)`, BUILD_OUTPUT_TARGET),
  writer(String.raw`>>?\s*["']?${BUILD_OUTPUT_TARGET}`),
  writer(
    commandWord("node|python(?:3)?"),
    String.raw`writefile|appendfile|rmsync|unlink|rename|mkdir|copyfile|cpsync|\bopen\(`,
    BUILD_OUTPUT_TARGET,
  ),
  writer(commandWord("dd"), String.raw`of=["']?${BUILD_OUTPUT_TARGET}`),
];

/**
 * #6984: the shell sandbox keeps build output read-only, but a refused write inside an error-tolerant compound
 * (`x; echo done`) still exits 0 and would read as done. Refusing the common write shapes before running makes
 * the refusal loud. Best effort, like bashCommandTargetsSensitivePath: the sandbox rule is what enforces it.
 */
export function bashCommandWritesBuildOutput(command: string): boolean {
  return commandWritesTarget(command, BUILD_OUTPUT_WRITERS);
}

export function isPackageManagerMutationCommand(command: string) {
  const normalized = command.toLowerCase();
  const patterns = [
    /\b(?:npm|pnpm|yarn|bun)\b[^\n;&|]{0,160}\b(?:add|install|i|update|up|upgrade|remove|rm|uninstall|link|import|rebuild|dedupe|dlx|create)\b/u,
    /\b(?:npx|pnpx)\b/u,
    /\b(?:python(?:3)?\s+-m\s+)?pip(?:3)?\b[^\n;&|]{0,120}\binstall\b/u,
    /\buv\s+(?:add|remove|sync|pip\s+install)\b/u,
    /\bpoetry\s+(?:add|remove|install|update)\b/u,
    /\b(?:bundle|bundler)\s+(?:add|install|update)\b/u,
    /\bgem\s+install\b/u,
    /\bcargo\s+(?:add|install|update)\b/u,
    /\bgo\s+(?:get|install|mod\s+(?:download|tidy))\b/u,
    /\bcomposer\s+(?:require|install|update)\b/u,
    /\bdotnet\s+(?:add\s+\S+\s+package|restore|tool\s+install)\b/u,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function packageNameIsValid(name: string) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name);
}

function exactVersionIsValid(version: string) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version);
}

function filePreview(before: string | null, after: string) {
  if (before === after) throw new Error("The sensitive file proposal does not change the file.");
  if (before === null) {
    const preview = after
      .split(/\r?\n/u)
      .map((line) => `+ ${line}`)
      .join("\n");
    if (Buffer.byteLength(preview, "utf8") > MAX_REVIEW_DIFF_BYTES) {
      throw new Error("The proposed new sensitive file is too large for a complete in-chat review.");
    }
    return { preview, previewTruncated: false };
  }

  const beforeLines = before.split(/\r?\n/u);
  const afterLines = after.split(/\r?\n/u);
  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1;
  }
  let beforeSuffix = beforeLines.length - 1;
  let afterSuffix = afterLines.length - 1;
  while (beforeSuffix >= prefix && afterSuffix >= prefix && beforeLines[beforeSuffix] === afterLines[afterSuffix]) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  const contextStart = Math.max(0, prefix - 3);
  const contextEnd = Math.min(beforeLines.length, beforeSuffix + 4);
  const leadingContext = beforeLines.slice(contextStart, prefix).map((line) => `  ${line}`);
  const removed = beforeLines.slice(prefix, beforeSuffix + 1).map((line) => `- ${line}`);
  const added = afterLines.slice(prefix, afterSuffix + 1).map((line) => `+ ${line}`);
  const trailingContext = beforeLines.slice(beforeSuffix + 1, contextEnd).map((line) => `  ${line}`);
  const preview = [
    `@@ lines ${prefix + 1}-${Math.max(prefix + 1, beforeSuffix + 1)} @@`,
    ...leadingContext,
    ...removed,
    ...added,
    ...trailingContext,
  ].join("\n");
  if (Buffer.byteLength(preview, "utf8") > MAX_REVIEW_DIFF_BYTES) {
    throw new Error(
      "The sensitive file diff is too large for a complete in-chat review. Split it into smaller edits or use the dependency tool.",
    );
  }
  return { preview, previewTruncated: false };
}

function publicApproval(record: SecurityReviewRecord): MariSensitiveFileApproval | MariDependencyInstallApproval {
  if (record.kind === "sensitive_file") {
    const {
      absolutePath: _absolutePath,
      realTarget: _realTarget,
      beforeContent: _beforeContent,
      afterContent: _afterContent,
      processing: _processing,
      timer: _timer,
      ...approval
    } = record;
    return approval;
  }
  const {
    manifestHash: _manifestHash,
    lockfileHash: _lockfileHash,
    processing: _processing,
    timer: _timer,
    ...approval
  } = record;
  return approval;
}

type PnpmRunner = { command: string; prefixArgs: string[] };

async function runPnpmProcess(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  runner: PnpmRunner = { command: "pnpm", prefixArgs: [] },
  timeoutMs = INSTALL_TIMEOUT_MS,
) {
  const parts = [runner.command, ...runner.prefixArgs, ...args];
  const windowsCommand = process.platform === "win32";
  if (windowsCommand && parts.some((part) => !/^[A-Za-z0-9@._/:=+-]+$/u.test(part))) {
    throw new Error("Unsupported character in the dependency package-manager command.");
  }
  return new Promise<{ ok: boolean; output: string; stdout: string }>((resolveRun) => {
    const child = spawn(
      windowsCommand ? (process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe") : runner.command,
      windowsCommand ? ["/d", "/s", "/c", parts.join(" ")] : [...runner.prefixArgs, ...args],
      {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let stdout = "";
    let settled = false;
    let timer: NodeJS.Timeout;
    const append = (chunk: unknown) => {
      output = `${output}${String(chunk)}`.slice(-MAX_PROCESS_OUTPUT);
    };
    const finish = (result: { ok: boolean; output: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ ...result, stdout });
    };
    child.stdout?.on("data", (chunk) => {
      stdout = `${stdout}${String(chunk)}`.slice(-MAX_PROCESS_OUTPUT);
      append(chunk);
    });
    child.stderr?.on("data", append);
    child.on("error", (error) => finish({ ok: false, output: error.message }));
    child.on("close", (code) =>
      finish({
        ok: code === 0,
        output: [parts.join(" "), `Exit code: ${code}`, output.trim()].filter(Boolean).join("\n"),
      }),
    );
    timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, output: `Dependency installation timed out after ${timeoutMs / 1000}s.` });
    }, timeoutMs);
    timer.unref?.();
  });
}

async function resolveDependencyPnpmRunner(cwd: string, env: NodeJS.ProcessEnv): Promise<PnpmRunner> {
  const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as { packageManager?: unknown };
  if (typeof manifest.packageManager !== "string" || !manifest.packageManager.startsWith("pnpm@")) {
    return { command: "pnpm", prefixArgs: [] };
  }
  const pin = /^pnpm@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+sha(?:224|256|384|512)\.[0-9a-fA-F]+)?$/u.exec(
    manifest.packageManager,
  );
  if (!pin) throw new Error("The workspace must pin an exact pnpm version before installing dependencies.");
  // Match the updater's pinned-manager fallbacks without reading user configs or
  // reusing an older global pnpm's incompatible native-version handoff.
  const candidates = [
    { command: "corepack", prefixArgs: [manifest.packageManager], timeout: 20_000 },
    { command: "pnpm", prefixArgs: [], timeout: 10_000 },
    { command: "npx", prefixArgs: ["--yes", `pnpm@${pin[1]}`], timeout: 60_000 },
  ];
  for (const runner of candidates) {
    const result = await runPnpmProcess(["--version"], cwd, env, runner, runner.timeout);
    if (result.ok && result.stdout.trim() === pin[1]) return runner;
  }
  throw new Error(`Could not start the workspace's pinned pnpm ${pin[1]}. Enable Corepack or install that version.`);
}

async function runPnpmDependencyInstall(input: {
  workspaceRoot: string;
  target: MariDependencyTarget;
  packageName: string;
  version: string;
  integrity: string;
  dev: boolean;
}) {
  const sandboxHome = await mkdtemp(join(tmpdir(), "marinara-mari-dependency-"));
  const resolveArgs =
    input.target === "root" ? ["add", "--workspace-root"] : ["--filter", TARGET_FILTERS[input.target]!, "add"];
  resolveArgs.push("--save-exact", "--ignore-scripts", "--lockfile-only", `--registry=${PUBLIC_NPM_REGISTRY}`);
  if (input.dev) resolveArgs.push("--save-dev");
  resolveArgs.push(`${input.packageName}@${input.version}`);

  const safeEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
    HOME: sandboxHome,
    USERPROFILE: sandboxHome,
    APPDATA: sandboxHome,
    LOCALAPPDATA: sandboxHome,
    TMPDIR: sandboxHome,
    TMP: sandboxHome,
    TEMP: sandboxHome,
    XDG_CACHE_HOME: sandboxHome,
    XDG_CONFIG_HOME: sandboxHome,
    XDG_DATA_HOME: sandboxHome,
    COREPACK_HOME: join(sandboxHome, "corepack"),
    PNPM_HOME: join(sandboxHome, "pnpm"),
    npm_config_registry: PUBLIC_NPM_REGISTRY,
    npm_config_ignore_scripts: "true",
    npm_config_userconfig: join(sandboxHome, ".npmrc"),
  };

  try {
    const runner = await resolveDependencyPnpmRunner(input.workspaceRoot, safeEnv);
    const resolved = await runPnpmProcess(resolveArgs, input.workspaceRoot, safeEnv, runner);
    if (!resolved.ok) return resolved;
    const resolvedLockfile = (await readOptionalText(resolve(input.workspaceRoot, "pnpm-lock.yaml"))) ?? "";
    if (!resolvedLockfile.includes(input.integrity)) {
      return {
        ok: false,
        output: `${resolved.output}\nResolved lockfile integrity did not match the approved npm registry integrity.`,
      };
    }
    const fetched = await runPnpmProcess(
      ["fetch", `--registry=${PUBLIC_NPM_REGISTRY}`],
      input.workspaceRoot,
      safeEnv,
      runner,
    );
    if (!fetched.ok) return { ok: false, output: `${resolved.output}\n${fetched.output}` };
    const installed = await runPnpmProcess(
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      input.workspaceRoot,
      safeEnv,
      runner,
    );
    return {
      ok: installed.ok,
      output: [resolved.output, fetched.output, installed.output].join("\n\n").slice(-MAX_PROCESS_OUTPUT),
    };
  } finally {
    await rm(sandboxHome, { recursive: true, force: true });
  }
}

export class WorkspaceChangeReviewService {
  private readonly pending = new Map<string, SecurityReviewRecord>();
  private applying = false;
  private readonly fetchImpl: typeof fetch;
  private readonly installDependency: DependencyInstallRunner;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, options: WorkspaceChangeReviewOptions = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.installDependency = options.installDependency ?? runPnpmDependencyInstall;
  }

  setWorkspaceRoot(workspaceRoot: string) {
    const next = resolve(workspaceRoot);
    if (next === this.workspaceRoot) return;
    this.clear();
    this.workspaceRoot = next;
  }

  clear() {
    for (const record of this.pending.values()) clearTimeout(record.timer);
    this.pending.clear();
  }

  getPendingApprovals(): MariWorkspacePendingApproval[] {
    return Array.from(this.pending.values()).map(publicApproval);
  }

  async stageSensitiveFileChange(input: {
    absolutePath: string;
    afterContent: string;
    reason?: string | null;
    sessionId: string;
  }): Promise<MariSensitiveFileApproval> {
    const absolutePath = resolve(input.absolutePath);
    const realTarget = realWriteTarget(absolutePath);
    // #6984: an approved review writes the file, so build output cannot be staged either, by name or through a link.
    if (
      isBuildOutputPath(this.workspaceRoot, absolutePath) ||
      isBuildOutputPath(realpathSync(this.workspaceRoot), realTarget)
    ) {
      throw new Error(BUILD_OUTPUT_WRITE_REFUSAL);
    }
    if (workspacePathAccessPolicy(this.workspaceRoot, absolutePath) !== "sensitive") {
      throw new Error("Only dependency, launcher, installer, and workflow files use the sensitive-change review.");
    }
    if (Buffer.byteLength(input.afterContent, "utf8") > MAX_REVIEW_FILE_BYTES) {
      throw new Error(`Sensitive file changes are limited to ${MAX_REVIEW_FILE_BYTES} bytes.`);
    }
    const beforeContent = await readOptionalText(absolutePath);
    const path = normalizeRelativePath(relative(this.workspaceRoot, absolutePath));
    const beforeHash = beforeContent === null ? null : sha256(beforeContent);
    const afterHash = sha256(input.afterContent);
    // #5756: re-staging the identical change is idempotent - hand back the
    // live approval instead of stacking duplicate cards for one decision.
    // A record mid-approval still matches: minting a sibling would capture
    // stale beforeContent and die as state_changed once the first applies.
    // Windows resolves paths case-insensitively, so the comparison folds
    // case there (elsewhere a fold could match a genuinely different file).
    const samePath =
      process.platform === "win32"
        ? (candidate: string) => candidate.toLowerCase() === absolutePath.toLowerCase()
        : (candidate: string) => candidate === absolutePath;
    for (const existing of this.pending.values()) {
      if (
        existing.kind === "sensitive_file" &&
        samePath(existing.absolutePath) &&
        existing.beforeHash === beforeHash &&
        existing.afterHash === afterHash
      ) {
        return publicApproval(existing) as MariSensitiveFileApproval;
      }
    }
    const id = `mari-file-${nanoid()}`;
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + APPROVAL_TIMEOUT_MS).toISOString();
    const preview = filePreview(beforeContent, input.afterContent);
    const timer = setTimeout(() => this.pending.delete(id), APPROVAL_TIMEOUT_MS);
    timer.unref?.();
    const record: FileReviewRecord = {
      kind: "sensitive_file",
      id,
      sessionId: input.sessionId,
      path,
      changeType: beforeContent === null ? "create" : "update",
      beforeHash,
      afterHash,
      ...preview,
      reason: input.reason?.trim() || null,
      requestedAt,
      expiresAt,
      absolutePath,
      realTarget,
      beforeContent,
      afterContent: input.afterContent,
      processing: false,
      timer,
    };
    this.pending.set(id, record);
    return publicApproval(record) as MariSensitiveFileApproval;
  }

  async requestDependencyInstall(input: {
    packageName: string;
    version?: string | null;
    target: MariDependencyTarget;
    dev?: boolean;
    reason?: string | null;
    sessionId: string;
  }): Promise<MariDependencyInstallApproval> {
    const packageName = input.packageName.trim().toLowerCase();
    const requestedVersion = input.version?.trim() || "latest";
    if (!packageNameIsValid(packageName)) throw new Error("Use a valid public npm package name.");
    if (requestedVersion !== "latest" && !exactVersionIsValid(requestedVersion)) {
      throw new Error(
        "Dependency versions must be exact semver values or latest so Marinara can resolve an exact version.",
      );
    }
    if (!(input.target in TARGET_MANIFESTS))
      throw new Error("Dependency target must be root, client, server, or shared.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    timeout.unref?.();
    let response: Response;
    try {
      // npm's registry addresses scoped packages as "@scope%2fname": the "@"
      // stays literal and only the scope separator is encoded.
      const registryUrl = new URL(
        `${packageName.replace("/", "%2f")}/${encodeURIComponent(requestedVersion)}`,
        PUBLIC_NPM_REGISTRY,
      );
      response = await this.fetchImpl(registryUrl, {
        headers: { accept: "application/vnd.npm.install-v1+json, application/json" },
        redirect: "error",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`The public npm registry returned ${response.status} for ${packageName}.`);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REGISTRY_RESPONSE_BYTES) {
      throw new Error("The npm registry response was unexpectedly large.");
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REGISTRY_RESPONSE_BYTES) {
      throw new Error("The npm registry response was unexpectedly large.");
    }
    const metadata = JSON.parse(raw) as RegistryPackageMetadata;
    const version = typeof metadata.version === "string" ? metadata.version : "";
    const integrity = typeof metadata.dist?.integrity === "string" ? metadata.dist.integrity : "";
    const tarballUrl = typeof metadata.dist?.tarball === "string" ? metadata.dist.tarball : "";
    if (metadata.name !== packageName || !exactVersionIsValid(version) || !integrity) {
      throw new Error("The npm registry did not return valid exact-version integrity metadata.");
    }
    const parsedTarball = new URL(tarballUrl);
    if (parsedTarball.protocol !== "https:" || parsedTarball.hostname !== "registry.npmjs.org") {
      throw new Error("The npm package tarball is not hosted on the approved public registry.");
    }
    const directDependencies =
      metadata.dependencies && typeof metadata.dependencies === "object" && !Array.isArray(metadata.dependencies)
        ? Object.entries(metadata.dependencies)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([name, range]) => ({ name, range }))
            .sort((left, right) => left.name.localeCompare(right.name))
        : [];
    if (directDependencies.length > 200) {
      throw new Error("The npm package declares an unexpectedly large direct dependency set.");
    }

    const manifestPath = resolve(this.workspaceRoot, TARGET_MANIFESTS[input.target]);
    const manifest = await readFile(manifestPath, "utf8");
    const lockfile = await readOptionalText(resolve(this.workspaceRoot, "pnpm-lock.yaml"));
    const id = `mari-dependency-${nanoid()}`;
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + APPROVAL_TIMEOUT_MS).toISOString();
    const timer = setTimeout(() => this.pending.delete(id), APPROVAL_TIMEOUT_MS);
    timer.unref?.();
    const record: DependencyReviewRecord = {
      kind: "dependency_install",
      id,
      sessionId: input.sessionId,
      packageName,
      version,
      target: input.target,
      dependencyType: input.dev ? "devDependency" : "dependency",
      integrity,
      tarballUrl,
      directDependencies,
      reason: input.reason?.trim() || null,
      requestedAt,
      expiresAt,
      manifestHash: sha256(manifest),
      lockfileHash: lockfile === null ? null : sha256(lockfile),
      processing: false,
      timer,
    };
    this.pending.set(id, record);
    return publicApproval(record) as MariDependencyInstallApproval;
  }

  async approve(id: string): Promise<WorkspaceSecurityApprovalResult | null> {
    const record = this.pending.get(id);
    if (!record) return null;
    if (record.processing || this.applying) {
      return {
        ok: false,
        approval: publicApproval(record),
        completed: false,
        outcome: "failed",
        error: "Another sensitive workspace review is already being applied.",
      };
    }
    record.processing = true;
    this.applying = true;
    try {
      if (record.kind === "sensitive_file") return await this.approveFile(record);
      return await this.approveDependency(record);
    } finally {
      this.applying = false;
    }
  }

  reject(id: string): WorkspaceSecurityApprovalResult | null {
    const record = this.pending.get(id);
    if (!record) return null;
    if (record.processing) {
      return {
        ok: false,
        approval: publicApproval(record),
        completed: false,
        outcome: "failed",
        error: "This review is already being applied and can no longer be discarded.",
      };
    }
    clearTimeout(record.timer);
    this.pending.delete(id);
    return {
      ok: true,
      approval: publicApproval(record),
      completed: true,
      outcome: "discarded",
    };
  }

  private async approveFile(record: FileReviewRecord): Promise<WorkspaceSecurityApprovalResult> {
    const approval = publicApproval(record) as MariSensitiveFileApproval;
    const current = await readOptionalText(record.absolutePath);
    // #6984: a link added since staging (src/gen -> ../dist) would carry the write somewhere the user never saw.
    if (current !== record.beforeContent || realWriteTarget(record.absolutePath) !== record.realTarget) {
      clearTimeout(record.timer);
      this.pending.delete(record.id);
      return {
        ok: false,
        approval,
        completed: true,
        outcome: "state_changed",
        error: "The file changed after Professor Mari staged it. Review a fresh proposal instead.",
      };
    }
    try {
      await mkdir(dirname(record.absolutePath), { recursive: true });
      const temporaryPath = join(dirname(record.absolutePath), `.${basename(record.absolutePath)}.${record.id}.tmp`);
      const existingMode = existsSync(record.absolutePath) ? (await stat(record.absolutePath)).mode : 0o644;
      await writeFile(temporaryPath, record.afterContent, { encoding: "utf8", mode: existingMode });
      await chmod(temporaryPath, existingMode);
      await rename(temporaryPath, record.absolutePath);
      clearTimeout(record.timer);
      this.pending.delete(record.id);
      return { ok: true, approval, completed: true, outcome: "applied" };
    } catch (error) {
      record.processing = false;
      logger.error(error, "[professor-mari] Failed to apply sensitive workspace file review");
      return {
        ok: false,
        approval,
        completed: true,
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async approveDependency(record: DependencyReviewRecord): Promise<WorkspaceSecurityApprovalResult> {
    const approval = publicApproval(record) as MariDependencyInstallApproval;
    const manifestPath = resolve(this.workspaceRoot, TARGET_MANIFESTS[record.target]);
    const lockfilePath = resolve(this.workspaceRoot, "pnpm-lock.yaml");
    const manifestBefore = await readFile(manifestPath, "utf8");
    const lockfileBefore = await readOptionalText(lockfilePath);
    if (
      sha256(manifestBefore) !== record.manifestHash ||
      (lockfileBefore === null ? null : sha256(lockfileBefore)) !== record.lockfileHash
    ) {
      clearTimeout(record.timer);
      this.pending.delete(record.id);
      return {
        ok: false,
        approval,
        completed: true,
        outcome: "state_changed",
        error:
          "The dependency manifest or lockfile changed after this request. Ask Professor Mari to resolve it again.",
      };
    }

    const restoreManifests = async () => {
      await writeFile(manifestPath, manifestBefore, "utf8");
      if (lockfileBefore === null) await rm(lockfilePath, { force: true });
      else await writeFile(lockfilePath, lockfileBefore, "utf8");
    };

    try {
      const result = await this.installDependency({
        workspaceRoot: this.workspaceRoot,
        target: record.target,
        packageName: record.packageName,
        version: record.version,
        integrity: record.integrity,
        dev: record.dependencyType === "devDependency",
      });
      if (!result.ok) {
        await restoreManifests();
        record.processing = false;
        return {
          ok: false,
          approval,
          completed: true,
          outcome: "failed",
          output: result.output,
          error: "The dependency install failed; manifest and lockfile changes were restored.",
        };
      }
      const manifestAfter = JSON.parse(await readFile(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const field =
        record.dependencyType === "devDependency" ? manifestAfter.devDependencies : manifestAfter.dependencies;
      const lockfileAfter = (await readOptionalText(lockfilePath)) ?? "";
      if (field?.[record.packageName] !== record.version || !lockfileAfter.includes(record.integrity)) {
        await restoreManifests();
        record.processing = false;
        return {
          ok: false,
          approval,
          completed: true,
          outcome: "failed",
          output: result.output,
          error: "Installed dependency verification failed; manifest and lockfile changes were restored.",
        };
      }
      clearTimeout(record.timer);
      this.pending.delete(record.id);
      return { ok: true, approval, completed: true, outcome: "applied", output: result.output };
    } catch (error) {
      await restoreManifests().catch((restoreError) => {
        logger.error(restoreError, "[professor-mari] Failed to restore dependency files after install error");
      });
      logger.error(error, "[professor-mari] Dependency installation failed");
      record.processing = false;
      return {
        ok: false,
        approval,
        completed: true,
        outcome: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
