import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
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
const MAX_REVIEW_FILE_BYTES = 512_000;
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

function isEnvironmentSecretName(name: string) {
  const normalized = name.toLowerCase();
  if (normalized === ".env.example" || normalized === ".env.sample" || normalized === ".env.template") {
    return false;
  }
  return normalized === ".env" || normalized.startsWith(".env.");
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
  const name = parts.at(-1) ?? "";

  if (parts.includes(".git") || isEnvironmentSecretName(name)) return "forbidden";
  if (PACKAGE_CONTROL_FILES.has(name)) return "sensitive";
  if (parts.length === 1 && ROOT_LAUNCHER_FILES.has(name)) return "sensitive";
  if (normalized === ".github/workflows" || normalized.startsWith(".github/workflows/")) return "sensitive";
  if (normalized === "win/installer" || normalized.startsWith("win/installer/")) return "sensitive";
  if (
    normalized === "android/app/build.gradle" ||
    normalized === "android/build.gradle" ||
    normalized === "android/settings.gradle" ||
    normalized.startsWith("android/gradle/wrapper/")
  ) {
    return "sensitive";
  }
  return "normal";
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

async function runPnpmProcess(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return new Promise<{ ok: boolean; output: string }>((resolveRun) => {
    const child = spawn("pnpm", args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let timer: NodeJS.Timeout;
    const append = (chunk: unknown) => {
      output = `${output}${String(chunk)}`.slice(-MAX_PROCESS_OUTPUT);
    };
    const finish = (result: { ok: boolean; output: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun(result);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => finish({ ok: false, output: error.message }));
    child.on("close", (code) =>
      finish({
        ok: code === 0,
        output: [`pnpm ${args.join(" ")}`, `Exit code: ${code}`, output.trim()].filter(Boolean).join("\n"),
      }),
    );
    timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, output: `Dependency installation timed out after ${INSTALL_TIMEOUT_MS / 1000}s.` });
    }, INSTALL_TIMEOUT_MS);
    timer.unref?.();
  });
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
    TMPDIR: sandboxHome,
    TMP: sandboxHome,
    TEMP: sandboxHome,
    XDG_CACHE_HOME: sandboxHome,
    XDG_CONFIG_HOME: sandboxHome,
    XDG_DATA_HOME: sandboxHome,
    npm_config_registry: PUBLIC_NPM_REGISTRY,
    npm_config_ignore_scripts: "true",
    npm_config_userconfig: join(sandboxHome, ".npmrc"),
  };

  try {
    const resolved = await runPnpmProcess(resolveArgs, input.workspaceRoot, safeEnv);
    if (!resolved.ok) return resolved;
    const resolvedLockfile = (await readOptionalText(resolve(input.workspaceRoot, "pnpm-lock.yaml"))) ?? "";
    if (!resolvedLockfile.includes(input.integrity)) {
      return {
        ok: false,
        output: `${resolved.output}\nResolved lockfile integrity did not match the approved npm registry integrity.`,
      };
    }
    const fetched = await runPnpmProcess(["fetch", `--registry=${PUBLIC_NPM_REGISTRY}`], input.workspaceRoot, safeEnv);
    if (!fetched.ok) return { ok: false, output: `${resolved.output}\n${fetched.output}` };
    const installed = await runPnpmProcess(
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      input.workspaceRoot,
      safeEnv,
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
    if (workspacePathAccessPolicy(this.workspaceRoot, absolutePath) !== "sensitive") {
      throw new Error("Only dependency, launcher, installer, and workflow files use the sensitive-change review.");
    }
    if (Buffer.byteLength(input.afterContent, "utf8") > MAX_REVIEW_FILE_BYTES) {
      throw new Error(`Sensitive file changes are limited to ${MAX_REVIEW_FILE_BYTES} bytes.`);
    }
    const beforeContent = await readOptionalText(absolutePath);
    const path = normalizeRelativePath(relative(this.workspaceRoot, absolutePath));
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
      beforeHash: beforeContent === null ? null : sha256(beforeContent),
      afterHash: sha256(input.afterContent),
      ...preview,
      reason: input.reason?.trim() || null,
      requestedAt,
      expiresAt,
      absolutePath,
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
    if (current !== record.beforeContent) {
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
