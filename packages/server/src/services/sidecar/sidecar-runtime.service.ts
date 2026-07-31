import AdmZip from "adm-zip";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, dirname, join, relative, resolve, sep } from "path";
import type {
  SidecarBackend,
  SidecarDownloadProgress,
  SidecarRuntimeDiagnostics,
  SidecarRuntimeInfo,
  SidecarRuntimePreference,
  SidecarRuntimeSource,
} from "@marinara-engine/shared";
import { getDataDir } from "../../utils/data-dir.js";
import { downloadFileWithProgress, isAbortError, retry } from "./sidecar-download.js";
import { assertInsideDir } from "../../utils/security.js";
import {
  LLAMA_CPP_RUNTIME_MANIFEST,
  getLlamaRuntimeManifestEntry,
  type RuntimeManifestAsset,
} from "./runtime-integrity-manifest.js";
import {
  buildPreferredRuntimeVariants,
  formatRuntimePreference,
  isVariantCompatibleWithPreference,
  type GpuVendor,
  type RuntimeCapabilities,
} from "./sidecar-runtime-selection.js";

const execFileAsync = promisify(execFile);

const RUNTIME_DIR = join(getDataDir(), "sidecar-runtime");
const CURRENT_RUNTIME_PATH = join(RUNTIME_DIR, "current.json");
const SERVER_LOG_PATH = join(RUNTIME_DIR, "server.log");
const WINDOWS_CUDA_DLL_PATTERNS = [
  { label: "cudart64_*.dll", pattern: /^cudart64_\d+\.dll$/i },
  { label: "cublas64_*.dll", pattern: /^cublas64_\d+\.dll$/i },
  { label: "cublasLt64_*.dll", pattern: /^cublasLt64_\d+\.dll$/i },
];

interface RuntimeRecord {
  build: string;
  variant: string;
  platform: NodeJS.Platform;
  arch: string;
  assetName: string;
  assetSha256: string;
  dependencyAssetSha256: string[];
  directoryName: string;
  serverRelativePath: string;
  installedAt: string;
  source?: SidecarRuntimeSource;
}

export interface SidecarRuntimeInstall extends RuntimeRecord {
  directoryPath: string;
  serverPath: string;
  source: SidecarRuntimeSource;
  systemPath?: string | null;
  gpuCapable?: boolean;
}

interface RuntimeMatch {
  variant: string;
  asset: RuntimeManifestAsset;
  dependencyAssets?: RuntimeManifestAsset[];
}

function ensureWithinRuntimeDir(targetPath: string): string {
  const root = resolve(RUNTIME_DIR);
  const resolvedTarget = resolve(targetPath);
  if (resolvedTarget !== root && !resolvedTarget.startsWith(root + sep)) {
    throw new Error("Resolved runtime path escaped the sidecar runtime directory");
  }
  return resolvedTarget;
}

function isWindowsAsset(assetName: string): boolean {
  return assetName.endsWith(".zip");
}

export function isLlamaRuntimeRecordCurrent(
  record: Pick<RuntimeRecord, "assetName" | "assetSha256" | "build" | "dependencyAssetSha256" | "variant">,
): boolean {
  const entry = getLlamaRuntimeManifestEntry(record.variant);
  if (!entry || record.build !== LLAMA_CPP_RUNTIME_MANIFEST.releaseTag) return false;
  if (record.assetName !== entry.asset.name || record.assetSha256 !== entry.asset.sha256) return false;
  const expectedDependencies = (entry.dependencyAssets ?? []).map((asset) => asset.sha256);
  return dependencyAssetDigestsMatch(record.dependencyAssetSha256, expectedDependencies);
}

export function dependencyAssetDigestsMatch(recorded: readonly string[], expected: readonly string[]): boolean {
  return recorded.length === expected.length && recorded.every((sha256, index) => sha256 === expected[index]);
}

async function commandSucceeds(command: string, args: string[] = []): Promise<boolean> {
  try {
    await execFileAsync(command, args, { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function findExecutableRecursive(dirPath: string, expectedName: string): string | null {
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const stat = statSync(current, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isFile()) {
      if (current.toLowerCase().endsWith(expectedName.toLowerCase())) {
        return current;
      }
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      stack.push(join(current, entry.name));
    }
  }
  return null;
}

function listFilesRecursive(dirPath: string): string[] {
  const files: string[] = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const stat = statSync(current, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isFile()) {
      files.push(current);
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      stack.push(join(current, entry.name));
    }
  }
  return files;
}

function findMissingWindowsCudaDlls(runtimeDir: string): string[] {
  const filenames = new Set(listFilesRecursive(runtimeDir).map((file) => basename(file).toLowerCase()));
  return WINDOWS_CUDA_DLL_PATTERNS.filter(
    ({ pattern }) => ![...filenames].some((filename) => pattern.test(filename)),
  ).map(({ label }) => label);
}

function stageWindowsCudaDlls(runtimeDir: string, executablePath: string): string[] {
  const executableDir = dirname(executablePath);
  const files = listFilesRecursive(runtimeDir);

  for (const { pattern } of WINDOWS_CUDA_DLL_PATTERNS) {
    const matchingFile = files.find((file) => pattern.test(basename(file)));
    if (!matchingFile) continue;

    const targetPath = join(executableDir, basename(matchingFile));
    if (!existsSync(targetPath)) {
      copyFileSync(matchingFile, targetPath);
    }
  }

  return findMissingWindowsCudaDlls(executableDir);
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

class SidecarRuntimeService {
  private installPromise: Promise<SidecarRuntimeInstall> | null = null;
  private installAbort: AbortController | null = null;
  private diagnosticsCache: { value: SidecarRuntimeDiagnostics; expiresAt: number } | null = null;
  private diagnosticsRefreshPromise: Promise<void> | null = null;

  constructor() {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    this.refreshDiagnosticsInBackground();
  }

  getLogPath(): string {
    return SERVER_LOG_PATH;
  }

  cancelInstall(): void {
    this.installAbort?.abort();
    this.installAbort = null;
  }

  getStatus(preference: SidecarRuntimePreference = "auto"): SidecarRuntimeInfo {
    const diagnostics = this.getDiagnostics();
    const systemInstall = this.getSystemInstallSync(diagnostics, preference);
    const current = this.getCurrentInstall();
    const activeInstall =
      systemInstall ?? (current && this.isInstallUsableForPreference(current, preference) ? current : null);
    return {
      installed: activeInstall !== null,
      build: activeInstall?.build ?? null,
      variant: activeInstall?.variant ?? null,
      backend: "llama_cpp",
      source: activeInstall?.source ?? null,
      systemPath: diagnostics.systemLlamaPath,
    };
  }

  getDiagnostics(): SidecarRuntimeDiagnostics {
    if (this.diagnosticsCache && this.diagnosticsCache.expiresAt > Date.now()) {
      return this.diagnosticsCache.value;
    }

    const fallback = this.buildFallbackDiagnostics();
    if (!this.diagnosticsCache) {
      this.diagnosticsCache = {
        value: fallback,
        expiresAt: Date.now() + 5_000,
      };
    }

    this.refreshDiagnosticsInBackground();
    return fallback;
  }

  setLaunchDiagnostics(command: string | null, backend: SidecarBackend | null): void {
    const current = this.diagnosticsCache?.value ?? this.buildFallbackDiagnostics();
    this.diagnosticsCache = {
      value: {
        ...current,
        launchCommand: command,
        launchBackend: backend,
      },
      expiresAt: Date.now() + 60_000,
    };
  }

  private buildFallbackDiagnostics(): SidecarRuntimeDiagnostics {
    const current = this.diagnosticsCache?.value;
    return {
      gpuVendors: current?.gpuVendors ?? [],
      preferCuda: current?.preferCuda ?? false,
      preferHip: current?.preferHip ?? false,
      preferRocm: current?.preferRocm ?? existsSync("/opt/rocm"),
      preferSycl: current?.preferSycl ?? false,
      preferVulkan:
        current?.preferVulkan ??
        (process.platform === "linux"
          ? ["/usr/lib/libvulkan.so", "/usr/lib64/libvulkan.so", "/usr/lib/x86_64-linux-gnu/libvulkan.so.1"].some(
              (path) => existsSync(path),
            )
          : false),
      systemLlamaPath: current?.systemLlamaPath ?? null,
      launchCommand: current?.launchCommand ?? null,
      launchBackend: current?.launchBackend ?? null,
    };
  }

  private refreshDiagnosticsInBackground(): void {
    if (this.diagnosticsRefreshPromise) {
      return;
    }

    this.diagnosticsRefreshPromise = this.detectCapabilities()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.diagnosticsRefreshPromise = null;
      });
  }

  getCurrentInstall(): SidecarRuntimeInstall | null {
    if (!existsSync(CURRENT_RUNTIME_PATH)) {
      return null;
    }

    try {
      const record = JSON.parse(readFileSync(CURRENT_RUNTIME_PATH, "utf-8")) as RuntimeRecord;
      if ((record.source ?? "bundled") === "bundled" && !isLlamaRuntimeRecordCurrent(record)) {
        return null;
      }
      const directoryPath = ensureWithinRuntimeDir(join(RUNTIME_DIR, record.directoryName));
      const serverPath = ensureWithinRuntimeDir(join(directoryPath, record.serverRelativePath));
      if (!existsSync(serverPath)) {
        return null;
      }

      return {
        ...record,
        directoryPath,
        serverPath,
        source: record.source ?? "bundled",
        systemPath: null,
      };
    } catch {
      return null;
    }
  }

  isGpuVariant(variant: string): boolean {
    return /(cuda|rocm|vulkan|metal|hip|sycl)/i.test(variant);
  }

  async ensureInstalled(
    onProgress?: (progress: SidecarDownloadProgress) => void,
    options?: { excludeVariants?: string[]; preference?: SidecarRuntimePreference },
  ): Promise<SidecarRuntimeInstall> {
    const excludedVariants = new Set(options?.excludeVariants ?? []);
    const preference = options?.preference ?? "auto";
    const systemInstall = await this.getSystemInstall(preference);
    if (preference === "system" && !systemInstall) {
      throw new Error(
        "No system llama-server was found in PATH. Install llama.cpp separately or choose a bundled runtime.",
      );
    }
    if (systemInstall && !excludedVariants.has(systemInstall.variant)) {
      return systemInstall;
    }

    const current = this.getCurrentInstall();
    if (current && this.isInstallUsableForPreference(current, preference) && !excludedVariants.has(current.variant)) {
      return current;
    }

    if (this.installPromise) {
      return this.installPromise;
    }

    const preserveCurrentInstall = excludedVariants.size > 0 && current !== null;
    this.installPromise = this.installLatest(onProgress, excludedVariants, preference, { preserveCurrentInstall }).finally(
      () => {
        this.installPromise = null;
      },
    );
    return this.installPromise;
  }

  private isInstallUsable(install: SidecarRuntimeInstall): boolean {
    if (install.source === "system") {
      return !!install.serverPath;
    }
    if (install.platform !== process.platform || install.arch !== process.arch || !existsSync(install.serverPath)) {
      return false;
    }

    if (process.platform === "win32" && /cuda/i.test(install.variant)) {
      return findMissingWindowsCudaDlls(install.directoryPath).length === 0;
    }

    return true;
  }

  private isInstallUsableForPreference(install: SidecarRuntimeInstall, preference: SidecarRuntimePreference): boolean {
    if (!this.isInstallUsable(install)) {
      return false;
    }

    if (preference === "auto") {
      return true;
    }

    if (install.source === "system") {
      return preference === "system";
    }

    return isVariantCompatibleWithPreference(install.variant, preference);
  }

  private writeCurrentInstall(install: SidecarRuntimeInstall): void {
    if (install.source === "system") {
      return;
    }

    const record: RuntimeRecord = {
      build: install.build,
      variant: install.variant,
      platform: install.platform,
      arch: install.arch,
      assetName: install.assetName,
      assetSha256: install.assetSha256,
      dependencyAssetSha256: install.dependencyAssetSha256,
      directoryName: install.directoryName,
      serverRelativePath: install.serverRelativePath,
      installedAt: install.installedAt,
      source: install.source,
    };
    writeFileSync(CURRENT_RUNTIME_PATH, JSON.stringify(record, null, 2), "utf-8");
  }

  private cleanupBundledArtifacts(
    keepDirectoryName?: string | null,
    options: { preserveRuntimeDirectories?: boolean } = {},
  ): void {
    for (const entry of readdirSync(RUNTIME_DIR, { withFileTypes: true })) {
      if (entry.name === "mlx" || entry.name === "server.log") {
        continue;
      }

      const fullPath = join(RUNTIME_DIR, entry.name);
      if (entry.name === "current.json") {
        if (!keepDirectoryName) {
          unlinkSync(fullPath);
        }
        continue;
      }

      if (keepDirectoryName && entry.name === keepDirectoryName) {
        continue;
      }

      const isTemporaryArtifact = /\.(extract|zip)$/i.test(entry.name) || entry.name.endsWith(".tar.gz");
      if (isTemporaryArtifact || (entry.isDirectory() && !options.preserveRuntimeDirectories)) {
        rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }

  resetRuntime(): void {
    this.cancelInstall();
    const current = this.getCurrentInstall();
    if (current?.source === "bundled") {
      rmSync(current.directoryPath, { recursive: true, force: true });
    }
    this.cleanupBundledArtifacts();
  }

  private async installLatest(
    onProgress?: (progress: SidecarDownloadProgress) => void,
    excludedVariants: Set<string> = new Set(),
    preference: SidecarRuntimePreference = "auto",
    options: { preserveCurrentInstall?: boolean } = {},
  ): Promise<SidecarRuntimeInstall> {
    const abortController = new AbortController();
    this.installAbort = abortController;

    let archivePath: string | null = null;
    let extractDirectory: string | null = null;
    let finalDirectory: string | null = null;

    try {
      const match = await this.selectBestAsset(excludedVariants, preference);
      if (!match) {
        if (preference !== "auto") {
          throw new Error(
            `Marinara could not find ${formatRuntimePreference(preference)} for ${process.platform}/${process.arch}.`,
          );
        }
        throw new Error(
          `Your platform (${process.platform}/${process.arch}) is not supported for local inference yet.`,
        );
      }

      const directoryName = `${LLAMA_CPP_RUNTIME_MANIFEST.releaseTag}-${match.variant}`;
      finalDirectory = ensureWithinRuntimeDir(join(RUNTIME_DIR, directoryName));
      archivePath = ensureWithinRuntimeDir(join(RUNTIME_DIR, match.asset.name));
      extractDirectory = ensureWithinRuntimeDir(join(RUNTIME_DIR, `${directoryName}.extract`));

      if (existsSync(finalDirectory)) {
        rmSync(finalDirectory, { recursive: true, force: true });
      }

      await this.downloadAndExtractAsset({
        asset: match.asset,
        archivePath,
        extractDirectory,
        signal: abortController.signal,
        onProgress,
        resetExtractDirectory: true,
      });
      for (const dependencyAsset of match.dependencyAssets ?? []) {
        const dependencyArchivePath = ensureWithinRuntimeDir(join(RUNTIME_DIR, dependencyAsset.name));
        try {
          await this.downloadAndExtractAsset({
            asset: dependencyAsset,
            archivePath: dependencyArchivePath,
            extractDirectory,
            signal: abortController.signal,
            onProgress,
            resetExtractDirectory: false,
          });
        } finally {
          rmSync(dependencyArchivePath, { force: true });
        }
      }
      onProgress?.({
        phase: "runtime",
        status: "downloading",
        downloaded: 0,
        total: 0,
        speed: 0,
        label: "Verifying runtime files",
      });

      const executableName = isWindowsAsset(match.asset.name) ? "llama-server.exe" : "llama-server";
      const executablePath = findExecutableRecursive(extractDirectory, executableName);
      if (!executablePath) {
        throw new Error(`Could not find ${executableName} inside ${match.asset.name}`);
      }

      renameSync(extractDirectory, finalDirectory);
      const finalExecutable = ensureWithinRuntimeDir(join(finalDirectory, relative(extractDirectory, executablePath)));
      if (process.platform === "win32" && /cuda/i.test(match.variant)) {
        const missingDlls = stageWindowsCudaDlls(finalDirectory, finalExecutable);
        if (missingDlls.length > 0) {
          throw new Error(
            `The downloaded CUDA sidecar runtime is missing required CUDA DLLs (${missingDlls.join(
              ", ",
            )}). Reinstall the local runtime so Marinara can download the CUDA runtime package with bundled DLLs.`,
          );
        }
      }
      if (process.platform !== "win32") {
        try {
          chmodSync(finalExecutable, 0o755);
        } catch {
          // Best-effort on Unix-like systems.
        }
      }

      const install: SidecarRuntimeInstall = {
        build: LLAMA_CPP_RUNTIME_MANIFEST.releaseTag,
        variant: match.variant,
        platform: process.platform,
        arch: process.arch,
        assetName: match.asset.name,
        assetSha256: match.asset.sha256,
        dependencyAssetSha256: (match.dependencyAssets ?? []).map((asset) => asset.sha256),
        directoryName,
        serverRelativePath: relative(finalDirectory, finalExecutable).replace(/\\/g, "/"),
        installedAt: new Date().toISOString(),
        directoryPath: finalDirectory,
        serverPath: finalExecutable,
        source: "bundled",
        systemPath: null,
        gpuCapable: this.isGpuVariant(match.variant),
      };
      if (!options.preserveCurrentInstall) {
        this.writeCurrentInstall(install);
      }
      this.cleanupBundledArtifacts(directoryName, { preserveRuntimeDirectories: options.preserveCurrentInstall });
      return install;
    } catch (error) {
      if (extractDirectory) {
        rmSync(extractDirectory, { recursive: true, force: true });
      }
      if (finalDirectory) {
        rmSync(finalDirectory, { recursive: true, force: true });
      }
      throw error;
    } finally {
      if (archivePath) {
        rmSync(archivePath, { force: true });
      }
      if (this.installAbort === abortController) {
        this.installAbort = null;
      }
    }
  }

  private async downloadAndExtractAsset(options: {
    asset: RuntimeManifestAsset;
    archivePath: string;
    extractDirectory: string;
    signal: AbortSignal;
    onProgress?: (progress: SidecarDownloadProgress) => void;
    resetExtractDirectory?: boolean;
  }): Promise<void> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (options.resetExtractDirectory ?? true) {
        rmSync(options.extractDirectory, { recursive: true, force: true });
      }
      mkdirSync(options.extractDirectory, { recursive: true });

      await retry(
        async () => {
          await downloadFileWithProgress({
            url: options.asset.browser_download_url,
            destPath: options.archivePath,
            signal: options.signal,
            expectedBytes: options.asset.size,
            expectedSha256: options.asset.sha256,
            progress: {
              phase: "runtime",
              label: options.asset.name,
            },
            onProgress: options.onProgress,
          });
        },
        {
          retries: 3,
          baseDelayMs: 750,
          shouldRetry: (error) => !isAbortError(error),
        },
      );

      try {
        options.onProgress?.({
          phase: "runtime",
          status: "downloading",
          downloaded: 0,
          total: 0,
          speed: 0,
          label: "Extracting runtime files",
        });
        await this.extractArchive(options.archivePath, options.extractDirectory);
        return;
      } catch (error) {
        lastError = error;
        rmSync(options.extractDirectory, { recursive: true, force: true });
        rmSync(options.archivePath, { force: true });
        if (attempt >= 2 || isAbortError(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to extract ${options.asset.name}`);
  }

  private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
    if (archivePath.endsWith(".zip")) {
      const zip = new AdmZip(archivePath);
      for (const entry of zip.getEntries()) {
        assertInsideDir(targetDir, join(targetDir, entry.entryName));
      }
      zip.extractAllTo(targetDir, true);
      return;
    }

    if (archivePath.endsWith(".tar.gz")) {
      await execFileAsync("tar", ["-tzf", archivePath], { timeout: 120_000 }).then(({ stdout }) => {
        for (const entry of stdout.split(/\r?\n/u).filter(Boolean)) {
          assertInsideDir(targetDir, join(targetDir, entry));
        }
      });
      await execFileAsync("tar", ["-xzf", archivePath, "-C", targetDir], { timeout: 120_000 });
      return;
    }

    throw new Error(`Unsupported runtime archive format: ${archivePath}`);
  }

  private async detectCapabilities(): Promise<RuntimeCapabilities> {
    const platform = process.platform;
    const arch = process.arch;
    const gpuVendors =
      platform === "win32"
        ? await this.detectWindowsGpuVendors()
        : platform === "linux"
          ? await this.detectLinuxGpuVendors()
          : [];
    const hasNvidia = gpuVendors.includes("nvidia") || (arch === "x64" && (await commandSucceeds("nvidia-smi")));
    const hasAmd = gpuVendors.includes("amd");
    const hasIntel = gpuVendors.includes("intel");

    const preferCuda = arch === "x64" && hasNvidia;
    const preferHip = platform === "win32" && arch === "x64" && hasAmd;
    const preferRocm =
      platform === "linux" &&
      arch === "x64" &&
      (hasAmd || (await commandSucceeds("rocm-smi")) || existsSync("/opt/rocm"));
    const preferSycl = platform === "win32" && arch === "x64" && hasIntel;
    const preferVulkan = await this.detectVulkanSupport(platform);
    const systemLlamaPath = await this.detectSystemLlamaPath();

    const diagnostics = {
      platform,
      arch,
      gpuVendors,
      preferCuda,
      preferHip,
      preferRocm,
      preferSycl,
      preferVulkan,
      systemLlamaPath,
    } satisfies RuntimeCapabilities;

    this.diagnosticsCache = {
      value: {
        gpuVendors,
        preferCuda,
        preferHip,
        preferRocm,
        preferSycl,
        preferVulkan,
        systemLlamaPath,
        launchCommand: this.diagnosticsCache?.value.launchCommand ?? null,
        launchBackend: this.diagnosticsCache?.value.launchBackend ?? null,
      },
      expiresAt: Date.now() + 60_000,
    };

    return diagnostics;
  }

  private async detectVulkanSupport(platform: NodeJS.Platform): Promise<boolean> {
    if (platform === "darwin" || platform === "android") {
      return false;
    }

    if (await commandSucceeds("vulkaninfo", ["--summary"])) {
      return true;
    }

    if (platform === "win32") {
      const windowsDir = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
      return [join(windowsDir, "System32", "vulkan-1.dll"), join(windowsDir, "SysWOW64", "vulkan-1.dll")].some(
        (path) => existsSync(path),
      );
    }

    if (platform === "linux") {
      return ["/usr/lib/libvulkan.so", "/usr/lib64/libvulkan.so", "/usr/lib/x86_64-linux-gnu/libvulkan.so.1"].some(
        (path) => existsSync(path),
      );
    }

    return false;
  }

  private parseGpuVendors(output: string): GpuVendor[] {
    const vendors = new Set<GpuVendor>();
    const normalized = output.toLowerCase();
    if (normalized.includes("nvidia")) vendors.add("nvidia");
    if (normalized.includes("amd") || normalized.includes("radeon")) vendors.add("amd");
    if (normalized.includes("intel")) vendors.add("intel");
    return [...vendors];
  }

  private async detectWindowsGpuVendors(): Promise<GpuVendor[]> {
    try {
      const { stdout } = await execFileAsync(
        "powershell",
        ["-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"],
        { timeout: 5_000 },
      );
      return this.parseGpuVendors(stdout);
    } catch {
      return [];
    }
  }

  private async detectLinuxGpuVendors(): Promise<GpuVendor[]> {
    try {
      const { stdout } = await execFileAsync("sh", ["-lc", "lspci -nn"], { timeout: 5_000 });
      return this.parseGpuVendors(stdout);
    } catch {
      return [];
    }
  }

  private async detectSystemLlamaPath(): Promise<string | null> {
    const candidates: Array<[string, string]> =
      process.platform === "win32"
        ? [
            ["where", "llama-server.exe"],
            ["where", "llama-server"],
          ]
        : [["which", "llama-server"]];

    for (const [command, target] of candidates) {
      try {
        const { stdout } = await execFileAsync(command, [target], { timeout: 5_000 });
        const first = stdout
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .find(Boolean);
        if (first) {
          return first;
        }
      } catch {
        // Try the next command.
      }
    }

    return null;
  }

  private shouldUseSystemRuntime(preference: SidecarRuntimePreference = "auto"): boolean {
    if (preference === "system") {
      return true;
    }

    if (preference !== "auto") {
      return false;
    }

    return (
      parseBooleanEnv(process.env.MARINARA_SIDECAR_USE_SYSTEM_LLAMA) ||
      parseBooleanEnv(process.env.MARINARA_SIDECAR_USE_SYSTEM_LLAMA_SERVER)
    );
  }

  private createSystemInstall(systemPath: string, capabilities: RuntimeCapabilities | null): SidecarRuntimeInstall {
    const gpuCapable = capabilities
      ? capabilities.preferCuda ||
        capabilities.preferHip ||
        capabilities.preferRocm ||
        capabilities.preferSycl ||
        capabilities.preferVulkan
      : false;

    return {
      build: `system: ${basename(systemPath)}`,
      variant: "system-llama-server",
      platform: process.platform,
      arch: process.arch,
      assetName: "system",
      assetSha256: "",
      dependencyAssetSha256: [],
      directoryName: "",
      serverRelativePath: basename(systemPath),
      installedAt: new Date(0).toISOString(),
      directoryPath: dirname(systemPath),
      serverPath: systemPath,
      source: "system",
      systemPath,
      gpuCapable,
    };
  }

  private getSystemInstallSync(
    diagnostics: SidecarRuntimeDiagnostics,
    preference: SidecarRuntimePreference = "auto",
  ): SidecarRuntimeInstall | null {
    if (!this.shouldUseSystemRuntime(preference)) {
      return null;
    }

    const systemPath = diagnostics.systemLlamaPath;
    if (!systemPath) {
      this.refreshDiagnosticsInBackground();
      return null;
    }

    const capabilities: RuntimeCapabilities | null = this.diagnosticsCache?.value
      ? {
          platform: process.platform,
          arch: process.arch,
          gpuVendors: diagnostics.gpuVendors.filter(
            (vendor): vendor is GpuVendor => vendor === "nvidia" || vendor === "amd" || vendor === "intel",
          ),
          preferCuda: diagnostics.preferCuda,
          preferHip: diagnostics.preferHip,
          preferRocm: diagnostics.preferRocm,
          preferSycl: diagnostics.preferSycl,
          preferVulkan: diagnostics.preferVulkan,
          systemLlamaPath: diagnostics.systemLlamaPath,
        }
      : null;
    return this.createSystemInstall(systemPath, capabilities);
  }

  private async getSystemInstall(preference: SidecarRuntimePreference = "auto"): Promise<SidecarRuntimeInstall | null> {
    if (!this.shouldUseSystemRuntime(preference)) {
      return null;
    }

    const capabilities = await this.detectCapabilities();
    if (!capabilities.systemLlamaPath) {
      return null;
    }

    return this.createSystemInstall(capabilities.systemLlamaPath, capabilities);
  }

  private pushCandidate(
    matches: RuntimeMatch[],
    excludedVariants: Set<string>,
    variant: string,
    asset: RuntimeManifestAsset | null,
    dependencyAssets: RuntimeManifestAsset[] = [],
  ): void {
    if (!asset || excludedVariants.has(variant) || matches.some((match) => match.variant === variant)) {
      return;
    }
    matches.push({ variant, asset, dependencyAssets });
  }

  private async selectBestAsset(
    excludedVariants: Set<string> = new Set(),
    preference: SidecarRuntimePreference = "auto",
  ): Promise<RuntimeMatch | null> {
    const capabilities = await this.detectCapabilities();
    const matches: RuntimeMatch[] = [];

    const orderedVariants = buildPreferredRuntimeVariants(capabilities, preference);

    for (const variant of orderedVariants) {
      const entry = getLlamaRuntimeManifestEntry(variant);
      this.pushCandidate(
        matches,
        excludedVariants,
        variant,
        entry?.asset ?? null,
        entry?.dependencyAssets ? [...entry.dependencyAssets] : [],
      );
    }

    return matches[0] ?? null;
  }
}

export const sidecarRuntimeService = new SidecarRuntimeService();
