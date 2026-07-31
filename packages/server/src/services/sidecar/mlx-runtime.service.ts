import { execFileSync, spawn, type ChildProcess } from "child_process";
import { createHash } from "crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { SidecarDownloadProgress, SidecarRuntimeInfo } from "@marinara-engine/shared";
import { getDataDir } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { downloadFileWithProgress, isAbortError, retry } from "./sidecar-download.js";
import {
  MLX_RUNTIME_MANIFEST,
  serializeMlxRuntimeManifestStamp,
} from "./runtime-integrity-manifest.js";

const MLX_RUNTIME_DIR = join(getDataDir(), "sidecar-runtime", "mlx");
const MLX_UV_DIR = join(MLX_RUNTIME_DIR, "uv");
const MLX_UV_CACHE_DIR = join(MLX_RUNTIME_DIR, "uv-cache");
const MLX_PYTHON_INSTALL_DIR = join(MLX_RUNTIME_DIR, "python");
const MLX_PYTHON_BIN_DIR = join(MLX_RUNTIME_DIR, "python-bin");
const MLX_VENV_DIR = join(MLX_RUNTIME_DIR, ".venv");
const MLX_HF_HOME = join(MLX_RUNTIME_DIR, "hf-home");
const MLX_LM_PACKAGE_STAMP_PATH = join(MLX_RUNTIME_DIR, "mlx-lm-package.txt");
const MLX_UV_STAMP_PATH = join(MLX_RUNTIME_DIR, "uv-package.txt");
const MLX_REQUIREMENTS_LOCK_PATH = fileURLToPath(
  new URL("../../assets/mlx-runtime-requirements.lock", import.meta.url),
);
const UV_BIN = process.platform === "win32" ? join(MLX_UV_DIR, "uv.exe") : join(MLX_UV_DIR, "uv");
const VENV_PYTHON =
  process.platform === "win32" ? join(MLX_VENV_DIR, "Scripts", "python.exe") : join(MLX_VENV_DIR, "bin", "python");
const PYTHON_VERSION = "3.12";

export interface MlxRuntimeInstall {
  backend: "mlx";
  build: string;
  variant: string;
  platform: NodeJS.Platform;
  arch: string;
  directoryPath: string;
  pythonPath: string;
  hfHomePath: string;
}

function isSupportedPlatform(): boolean {
  return process.platform === "darwin" && process.arch === "arm64";
}

function isInstalled(): boolean {
  return existsSync(VENV_PYTHON);
}

function readBundledUvVersion(): string | null {
  if (!existsSync(UV_BIN)) {
    return null;
  }

  try {
    return execFileSync(UV_BIN, ["--version"], {
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();
  } catch {
    return null;
  }
}

function readStamp(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const value = readFileSync(path, "utf-8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function uvManifestStamp(): string {
  return JSON.stringify({
    version: MLX_RUNTIME_MANIFEST.uv.version,
    sha256: MLX_RUNTIME_MANIFEST.uv.archive.sha256,
  });
}

function isBundledUvCurrent(): boolean {
  const version = readBundledUvVersion();
  return (
    version !== null &&
    version.includes(MLX_RUNTIME_MANIFEST.uv.version) &&
    readStamp(MLX_UV_STAMP_PATH) === uvManifestStamp()
  );
}

function readInstalledVersion(): string | null {
  if (!isInstalled()) {
    return null;
  }

  try {
    return execFileSync(VENV_PYTHON, ["-c", "import importlib.metadata; print(importlib.metadata.version('mlx-lm'))"], {
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();
  } catch {
    return null;
  }
}

function readInstalledPackageSpec(): string | null {
  return readStamp(MLX_LM_PACKAGE_STAMP_PATH);
}

function isInstalledPackageCurrent(): boolean {
  return readInstalledPackageSpec() === serializeMlxRuntimeManifestStamp() && isBundledUvCurrent();
}

function writeInstalledPackageSpec(): void {
  mkdirSync(MLX_RUNTIME_DIR, { recursive: true });
  writeFileSync(MLX_LM_PACKAGE_STAMP_PATH, `${serializeMlxRuntimeManifestStamp()}\n`, "utf-8");
}

function verifyRequirementsLock(): void {
  const actualSha256 = createHash("sha256")
    .update(readFileSync(MLX_REQUIREMENTS_LOCK_PATH))
    .digest("hex");
  if (actualSha256 !== MLX_RUNTIME_MANIFEST.mlxLm.requirementsLockSha256) {
    throw new Error(
      "The bundled MLX dependency lock failed integrity verification. Update or reinstall Marinara Engine before retrying; do not bypass the runtime integrity check.",
    );
  }
}

function findFileRecursive(directoryPath: string, filename: string): string | null {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nested = findFileRecursive(entryPath, filename);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === filename) {
      return entryPath;
    }
  }
  return null;
}

function getMlxRepoCachePath(repo: string): string {
  return join(MLX_HF_HOME, "hub", `models--${repo.replace(/\//g, "--")}`);
}

function hasMlxRepoSnapshot(repo: string): boolean {
  try {
    return readdirSync(join(getMlxRepoCachePath(repo), "snapshots")).length > 0;
  } catch {
    return false;
  }
}

function buildInstallRecord(version: string): MlxRuntimeInstall {
  return {
    backend: "mlx",
    build: `mlx-lm ${version}`,
    variant: "macos-arm64-mlx",
    platform: process.platform,
    arch: process.arch,
    directoryPath: MLX_RUNTIME_DIR,
    pythonPath: VENV_PYTHON,
    hfHomePath: MLX_HF_HOME,
  };
}

class MlxRuntimeService {
  private installPromise: Promise<MlxRuntimeInstall> | null = null;
  private activeChild: ChildProcess | null = null;
  private activeFetchAbort: AbortController | null = null;
  private cancelRequested = false;

  getStatus(): SidecarRuntimeInfo {
    const version = readInstalledVersion();
    const current = version !== null && isInstalledPackageCurrent();
    return {
      installed: current,
      build: version ? `mlx-lm ${version}${current ? "" : " (runtime upgrade required)"}` : null,
      variant: isSupportedPlatform() ? "macos-arm64-mlx" : null,
      backend: "mlx",
      source: "bundled",
      systemPath: null,
    };
  }

  getHfHomePath(): string {
    return MLX_HF_HOME;
  }

  hasModelCache(repo: string | null | undefined): boolean {
    return !!repo && hasMlxRepoSnapshot(repo);
  }

  cancelInstall(): void {
    this.cancelRequested = true;
    this.activeFetchAbort?.abort();
    this.activeFetchAbort = null;
    const child = this.activeChild;
    if (!child) {
      return;
    }

    try {
      child.kill("SIGTERM");
    } catch {
      // Best-effort cancel.
    }
  }

  resetRuntime(): void {
    this.cancelInstall();
    rmSync(MLX_RUNTIME_DIR, { recursive: true, force: true });
  }

  clearModelCache(repo?: string | null): void {
    if (repo) {
      rmSync(getMlxRepoCachePath(repo), { recursive: true, force: true });
      return;
    }

    rmSync(MLX_HF_HOME, { recursive: true, force: true });
  }

  async ensureInstalled(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<MlxRuntimeInstall> {
    const installedVersion = readInstalledVersion();
    if (installedVersion && isInstalledPackageCurrent()) {
      return buildInstallRecord(installedVersion);
    }

    if (this.installPromise) {
      return this.installPromise;
    }

    this.installPromise = this.installLatest(onProgress).finally(() => {
      this.installPromise = null;
      this.activeChild = null;
      this.activeFetchAbort = null;
      this.cancelRequested = false;
    });
    return this.installPromise;
  }

  async downloadModel(
    repo: string,
    label: string,
    totalBytes: number | null | undefined,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    const runtime = await this.ensureInstalled(onProgress);
    mkdirSync(runtime.hfHomePath, { recursive: true });

    this.emitModelProgress(onProgress, "downloading", label, totalBytes ?? 0);
    this.cancelRequested = false;
    try {
      await this.runCommand(
        runtime.pythonPath,
        [
          "-c",
          [
            "from huggingface_hub import snapshot_download",
            `snapshot_download(repo_id=${JSON.stringify(repo)}, local_files_only=False)`,
          ].join("\n"),
        ],
        {
          cwd: runtime.directoryPath,
          env: {
            HF_HOME: runtime.hfHomePath,
            HF_HUB_CACHE: join(runtime.hfHomePath, "hub"),
          },
        },
      );
    } finally {
      this.activeChild = null;
      this.cancelRequested = false;
    }
    if (!hasMlxRepoSnapshot(repo)) {
      throw new Error(`MLX model download completed but no cache entry was found for ${repo}.`);
    }
    this.emitModelProgress(onProgress, "complete", label, totalBytes ?? 0);
  }

  private emitProgress(
    onProgress: ((progress: SidecarDownloadProgress) => void) | undefined,
    status: SidecarDownloadProgress["status"],
    label: string,
    error?: string,
  ): void {
    onProgress?.({
      phase: "runtime",
      status,
      downloaded: 0,
      total: 0,
      speed: 0,
      label,
      error,
    });
  }

  private emitModelProgress(
    onProgress: ((progress: SidecarDownloadProgress) => void) | undefined,
    status: SidecarDownloadProgress["status"],
    label: string,
    total: number,
  ): void {
    onProgress?.({
      phase: "model",
      status,
      downloaded: status === "complete" ? total : 0,
      total,
      speed: 0,
      label,
    });
  }

  private async installLatest(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<MlxRuntimeInstall> {
    if (!isSupportedPlatform()) {
      throw new Error("The MLX sidecar is only supported on macOS Apple Silicon.");
    }

    mkdirSync(MLX_RUNTIME_DIR, { recursive: true });
    mkdirSync(MLX_UV_DIR, { recursive: true });
    mkdirSync(MLX_UV_CACHE_DIR, { recursive: true });
    mkdirSync(MLX_PYTHON_INSTALL_DIR, { recursive: true });
    mkdirSync(MLX_PYTHON_BIN_DIR, { recursive: true });
    mkdirSync(MLX_HF_HOME, { recursive: true });
    this.cancelRequested = false;

    await this.ensureUvInstalled(onProgress);
    const mlxArchivePath = join(MLX_RUNTIME_DIR, MLX_RUNTIME_MANIFEST.mlxLm.archive.name);

    try {
      verifyRequirementsLock();
      await this.downloadVerifiedAsset(
        MLX_RUNTIME_MANIFEST.mlxLm.archive,
        mlxArchivePath,
        "mlx-lm source",
        onProgress,
      );
      this.emitProgress(onProgress, "downloading", `Python ${PYTHON_VERSION} runtime`);
      await this.runCommand(UV_BIN, ["venv", MLX_VENV_DIR, "--python", PYTHON_VERSION], {
        cwd: MLX_RUNTIME_DIR,
        env: this.getUvEnv(),
      });
      this.emitProgress(onProgress, "downloading", "MLX runtime dependencies");
      await this.runCommand(
        UV_BIN,
        ["pip", "sync", "--python", VENV_PYTHON, "--require-hashes", MLX_REQUIREMENTS_LOCK_PATH],
        {
          cwd: MLX_RUNTIME_DIR,
          env: this.getUvEnv(),
        },
      );
      await this.runCommand(
        UV_BIN,
        ["pip", "install", "--python", VENV_PYTHON, "--no-deps", "--no-build-isolation", mlxArchivePath],
        {
          cwd: MLX_RUNTIME_DIR,
          env: this.getUvEnv(),
        },
      );
      writeInstalledPackageSpec();
      this.emitProgress(onProgress, "downloading", "Verifying MLX runtime");
    } catch (error) {
      this.emitProgress(
        onProgress,
        "error",
        "mlx-lm runtime",
        error instanceof Error ? error.message : "Failed to prepare the MLX runtime",
      );
      throw error;
    } finally {
      rmSync(mlxArchivePath, { force: true });
    }

    const version = readInstalledVersion();
    if (!version) {
      throw new Error("The MLX runtime environment was created, but mlx-lm could not be verified.");
    }

    this.emitProgress(onProgress, "complete", "mlx-lm runtime");
    return buildInstallRecord(version);
  }

  private getUvEnv(): NodeJS.ProcessEnv {
    return {
      UV_CACHE_DIR: MLX_UV_CACHE_DIR,
      UV_PYTHON_INSTALL_DIR: MLX_PYTHON_INSTALL_DIR,
      UV_PYTHON_BIN_DIR: MLX_PYTHON_BIN_DIR,
      UV_PYTHON_INSTALL_BIN: "0",
      UV_MANAGED_PYTHON: "1",
      UV_NO_CONFIG: "1",
    };
  }

  private async ensureUvInstalled(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<void> {
    if (isBundledUvCurrent()) {
      return;
    }

    this.emitProgress(onProgress, "downloading", "uv dependency manager");
    const archivePath = join(MLX_RUNTIME_DIR, MLX_RUNTIME_MANIFEST.uv.archive.name);
    const extractDirectory = join(MLX_RUNTIME_DIR, "uv.extract");
    try {
      await this.downloadVerifiedAsset(
        MLX_RUNTIME_MANIFEST.uv.archive,
        archivePath,
        "uv dependency manager",
        onProgress,
      );
      this.emitProgress(onProgress, "downloading", "Extracting uv dependency manager");
      rmSync(extractDirectory, { recursive: true, force: true });
      mkdirSync(extractDirectory, { recursive: true });
      const entries = execFileSync("tar", ["-tzf", archivePath], {
        encoding: "utf-8",
        timeout: 120_000,
      })
        .split(/\r?\n/u)
        .filter(Boolean);
      for (const entry of entries) {
        assertInsideDir(extractDirectory, join(extractDirectory, entry));
      }
      execFileSync("tar", ["-xzf", archivePath, "-C", extractDirectory], {
        timeout: 120_000,
      });
      const extractedUv = findFileRecursive(extractDirectory, "uv");
      if (!extractedUv) {
        throw new Error(`The approved uv archive did not contain the uv executable.`);
      }
      rmSync(MLX_UV_DIR, { recursive: true, force: true });
      mkdirSync(MLX_UV_DIR, { recursive: true });
      copyFileSync(extractedUv, UV_BIN);
      chmodSync(UV_BIN, 0o755);
      writeFileSync(MLX_UV_STAMP_PATH, `${uvManifestStamp()}\n`, "utf-8");
    } catch (error) {
      if (isAbortError(error) || this.cancelRequested) {
        throw new Error("Install aborted");
      }

      throw new Error(
        error instanceof Error
          ? `Failed to install the verified uv runtime.\n${error.message}`
          : "Failed to install the verified uv runtime.",
      );
    } finally {
      rmSync(archivePath, { force: true });
      rmSync(extractDirectory, { recursive: true, force: true });
    }

    if (!isBundledUvCurrent()) {
      throw new Error("The approved uv runtime was installed, but its version or manifest stamp could not be verified.");
    }
  }

  private async downloadVerifiedAsset(
    asset: {
      browser_download_url: string;
      name: string;
      sha256: string;
      size: number;
    },
    destinationPath: string,
    label: string,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    try {
      await retry(
        async () => {
          if (this.cancelRequested) {
            throw new Error("Install aborted");
          }
          const abortController = new AbortController();
          this.activeFetchAbort = abortController;
          try {
            await downloadFileWithProgress({
              url: asset.browser_download_url,
              destPath: destinationPath,
              signal: abortController.signal,
              expectedBytes: asset.size,
              expectedSha256: asset.sha256,
              progress: {
                phase: "runtime",
                label,
              },
              onProgress,
            });
          } finally {
            this.activeFetchAbort = null;
          }
        },
        {
          retries: 2,
          baseDelayMs: 500,
          shouldRetry: (error) => !isAbortError(error),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/(?:file size|SHA-256) mismatch/iu.test(message)) {
        throw new Error(
          `The ${label} download no longer matches the Engine-approved runtime manifest. Update or reinstall Marinara Engine before retrying; do not bypass the integrity check. Original verification error: ${message}`,
        );
      }
      throw error;
    }
  }

  private async runCommand(
    command: string,
    args: string[],
    options: {
      cwd: string;
      env?: NodeJS.ProcessEnv;
      stdin?: string;
    },
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
        },
        stdio: [options.stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.activeChild = child;

      let combinedOutput = "";
      if (options.stdin !== undefined) {
        child.stdin?.on("error", () => {
          // Ignore broken pipes if the child exits early.
        });
        child.stdin?.end(options.stdin);
      }
      child.stdout?.on("data", (chunk) => {
        combinedOutput += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        combinedOutput += String(chunk);
      });

      child.on("error", (error) => {
        this.activeChild = null;
        reject(error);
      });
      child.on("close", (code, signal) => {
        this.activeChild = null;
        if (code === 0) {
          resolve();
          return;
        }

        if (this.cancelRequested) {
          reject(new Error("Install aborted"));
          return;
        }

        const reason = signal ? `signal ${signal}` : `exit ${code ?? "null"}`;
        const details = combinedOutput.trim();
        reject(new Error(details ? `${command} ${reason}\n${details}` : `${command} ${reason}`));
      });
    });
  }
}

export const mlxRuntimeService = new MlxRuntimeService();
