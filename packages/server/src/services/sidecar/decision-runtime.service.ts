/**
 * The Python runtime the managed decision sidecar runs in.
 *
 * Structured like `mlx-runtime.service.ts`, which already solved this problem: a
 * pinned `uv`, a managed interpreter, a hash-locked dependency set, and a source
 * archive verified before it is unpacked. It keeps its own directory and never
 * touches the MLX runtime's, because the two share nothing but the technique.
 *
 * Everything installed here is third party and pinned to an exact revision. A moving
 * pin is not a pin: an install that silently changes what it runs cannot be reasoned
 * about after the fact, and this one runs a research project's model loader.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DecisionModelArtifact, SidecarDecisionModelInfo, SidecarDownloadProgress } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { downloadFileWithProgress, isAbortError, retry } from "./sidecar-download.js";
import { isLoadableArtifactFile, listHubFiles } from "./decision-hub.js";
import { DECISION_RUNTIME_MANIFEST, serializeDecisionRuntimeManifestStamp } from "./runtime-integrity-manifest.js";

const RUNTIME_DIR = join(getDataDir(), "sidecar-runtime", "decision");
const UV_DIR = join(RUNTIME_DIR, "uv");
const UV_CACHE_DIR = join(RUNTIME_DIR, "uv-cache");
const PYTHON_INSTALL_DIR = join(RUNTIME_DIR, "python");
const PYTHON_BIN_DIR = join(RUNTIME_DIR, "python-bin");
const VENV_DIR = join(RUNTIME_DIR, ".venv");
const SOURCE_DIR = join(RUNTIME_DIR, "open-jev");
/** Weights live here, in the layout `transformers` expects when it is offline. */
const HF_HOME = join(RUNTIME_DIR, "hf-home");
const STAMP_PATH = join(RUNTIME_DIR, "runtime-stamp.txt");
const REQUIREMENTS_LOCK_PATH = fileURLToPath(
  new URL("../../assets/decision-runtime-requirements.lock", import.meta.url),
);
const UV_BIN = join(UV_DIR, "uv");
const VENV_PYTHON = join(VENV_DIR, "bin", "python");
const PYTHON_VERSION = "3.12";
/** Written after an artifact's last file lands, so a partial download is visible. */
const DOWNLOAD_RECEIPT = ".marinara-download.json";

/**
 * What every child process needs from the server's environment, and nothing more.
 *
 * `LD_LIBRARY_PATH` because on some hosts (NixOS's `/run/opengl-driver/lib`, some
 * container setups) the CUDA driver library is reachable only through it, and the
 * llama.cpp sidecar keeps it too. `CUDA_VISIBLE_DEVICES` is deliberately not passed:
 * it renumbers the cards, and `cuda:N` must mean the `nvidia-smi` index the preflight
 * measured.
 */
const BASE_ENV_NAMES = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "TZ", "LD_LIBRARY_PATH"] as const;
/**
 * What `uv` also needs to reach its package indexes: proxies, in both spellings tools
 * read, and a custom CA bundle for networks that intercept TLS.
 */
const NETWORK_ENV_NAMES = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "all_proxy",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
] as const;

/**
 * The named variables from the server's environment, and only those.
 *
 * An allowlist rather than `process.env`, because the children are a third party's
 * package builds and model loader, and everything the engine holds in its environment
 * (provider keys, tokens, storage paths) would otherwise be handed to them.
 */
export function inheritedEnv(options: { network?: boolean } = {}): NodeJS.ProcessEnv {
  const names: readonly string[] = options.network ? [...BASE_ENV_NAMES, ...NETWORK_ENV_NAMES] : BASE_ENV_NAMES;
  return Object.fromEntries(
    names.map((name) => [name, process.env[name]]).filter(([, value]) => typeof value === "string"),
  );
}

export interface DecisionRuntimeInstall {
  directoryPath: string;
  pythonPath: string;
  sourcePath: string;
  hfHomePath: string;
}

/** Only the platforms whose wheels this lock actually resolves for. */
export function isDecisionRuntimeSupported(): boolean {
  return process.platform === "linux" && process.arch === "x64";
}

export function decisionRuntimeInstalled(): boolean {
  return existsSync(VENV_PYTHON) && existsSync(join(SOURCE_DIR, "jev", "server.py")) && readStamp() === expectedStamp();
}

function readStamp(): string | null {
  try {
    return existsSync(STAMP_PATH) ? readFileSync(STAMP_PATH, "utf-8").trim() || null : null;
  } catch {
    return null;
  }
}

function expectedStamp(): string {
  return serializeDecisionRuntimeManifestStamp();
}

/**
 * The lock ships with the engine, so a tampered or half-written copy must not reach
 * `uv pip sync`. Verified before every install rather than only on first write.
 */
function verifyRequirementsLock(): void {
  const actual = createHash("sha256").update(readFileSync(REQUIREMENTS_LOCK_PATH)).digest("hex");
  if (actual !== DECISION_RUNTIME_MANIFEST.openJev.requirementsLockSha256) {
    throw new Error(
      "The bundled decision runtime dependency lock failed integrity verification. Reinstall Marinara Engine before retrying; do not bypass the runtime integrity check.",
    );
  }
}

/**
 * Is this file already here, whole?
 *
 * Checked by size, and by sha256 wherever the Hub publishes one. A 19 GB install on a
 * connection that drops or a laptop that sleeps would otherwise start again from the
 * first shard every time, because the shared downloader deletes its target before each
 * attempt. A file that fails either check is fetched again rather than trusted.
 */
async function alreadyDownloaded(path: string, file: { size: number; sha256?: string }): Promise<boolean> {
  try {
    if (!existsSync(path) || statSync(path).size !== file.size) return false;
    if (!file.sha256) return true;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest("hex") === file.sha256.toLowerCase();
  } catch {
    return false;
  }
}

/** Where a downloaded artifact's files live, in HuggingFace's offline cache layout. */
export function artifactSnapshotPath(artifact: DecisionModelArtifact): string {
  return join(HF_HOME, "hub", `models--${artifact.repoId.replace(/\//g, "--")}`, "snapshots", artifact.revision);
}

export class DecisionRuntimeService {
  private installPromise: Promise<DecisionRuntimeInstall> | null = null;
  private activeChild: ChildProcess | null = null;
  private activeFetchAbort: AbortController | null = null;
  private cancelRequested = false;
  /**
   * The download in progress, if any.
   *
   * One at a time. Two installs of the same model (a double submit, or two tabs) would
   * otherwise stream into the same temporary files, each unlinking and renaming the
   * other's partial file, and share one abort slot so a cancel stopped only one.
   */
  private activeDownload: { modelId: string; promise: Promise<void> } | null = null;

  getPaths(): DecisionRuntimeInstall {
    return { directoryPath: RUNTIME_DIR, pythonPath: VENV_PYTHON, sourcePath: SOURCE_DIR, hfHomePath: HF_HOME };
  }

  cancel(): void {
    this.cancelRequested = true;
    this.activeFetchAbort?.abort();
    this.activeFetchAbort = null;
    try {
      this.activeChild?.kill("SIGTERM");
    } catch {
      // Best-effort cancel.
    }
  }

  /**
   * Delete everything: the environment, the source and the downloaded weights.
   *
   * Asynchronous because this is ten gigabytes. Doing it synchronously stalls the
   * event loop long enough to stop serving chat while a user tidies up.
   */
  async remove(): Promise<void> {
    this.cancel();
    // Let an aborted install or download finish unwinding first, so nothing is still
    // writing into the directory being deleted.
    await Promise.all([this.installPromise?.catch(() => null), this.activeDownload?.promise.catch(() => null)]);
    await rm(RUNTIME_DIR, { recursive: true, force: true });
  }

  async ensureInstalled(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<DecisionRuntimeInstall> {
    if (decisionRuntimeInstalled()) return this.getPaths();
    this.installPromise ??= this.install(onProgress).finally(() => {
      this.installPromise = null;
      this.activeChild = null;
      this.activeFetchAbort = null;
      this.cancelRequested = false;
    });
    return this.installPromise;
  }

  private async install(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<DecisionRuntimeInstall> {
    if (!isDecisionRuntimeSupported()) {
      throw new Error("The decision sidecar runtime is only supported on Linux x64.");
    }
    verifyRequirementsLock();
    for (const dir of [RUNTIME_DIR, UV_DIR, UV_CACHE_DIR, PYTHON_INSTALL_DIR, PYTHON_BIN_DIR, HF_HOME]) {
      mkdirSync(dir, { recursive: true });
    }
    this.cancelRequested = false;

    await this.ensureUv(onProgress);

    const archivePath = join(RUNTIME_DIR, DECISION_RUNTIME_MANIFEST.openJev.archive.name);
    try {
      this.emit(onProgress, "downloading", "Open-Jev source");
      await this.downloadVerified(
        DECISION_RUNTIME_MANIFEST.openJev.archive,
        archivePath,
        "Open-Jev source",
        onProgress,
      );
      rmSync(SOURCE_DIR, { recursive: true, force: true });
      mkdirSync(SOURCE_DIR, { recursive: true });
      // The archive unpacks into a commit-named directory; strip it so the module
      // path is stable across revision bumps.
      await this.run("tar", ["xzf", archivePath, "-C", SOURCE_DIR, "--strip-components=1"], { cwd: RUNTIME_DIR });

      this.emit(onProgress, "downloading", `Python ${PYTHON_VERSION} runtime`);
      // --clear so a retry after an interrupted install replaces a half-built
      // environment instead of layering onto it.
      await this.run(UV_BIN, ["venv", "--clear", VENV_DIR, "--python", PYTHON_VERSION], {
        cwd: RUNTIME_DIR,
        env: this.uvEnv(),
      });

      this.emit(onProgress, "downloading", "Decision runtime dependencies (several GB)");
      await this.run(
        UV_BIN,
        [
          "pip",
          "sync",
          "--python",
          VENV_PYTHON,
          "--require-hashes",
          // Needed at sync time as well as compile time: without it the PyTorch index
          // shadows PyPI for shared packages and the resolve is unsatisfiable.
          "--index-strategy",
          "unsafe-best-match",
          REQUIREMENTS_LOCK_PATH,
        ],
        { cwd: RUNTIME_DIR, env: this.uvEnv() },
      );
    } catch (error) {
      this.emit(onProgress, "error", "Decision runtime", error instanceof Error ? error.message : "Install failed");
      throw error;
    } finally {
      rmSync(archivePath, { force: true });
    }

    mkdirSync(RUNTIME_DIR, { recursive: true });
    writeFileSync(STAMP_PATH, `${expectedStamp()}\n`, "utf-8");
    // The wheel cache exists so a failed or interrupted install resumes instead of
    // starting over. Once the environment is built there is nothing left to resume,
    // and on a real install it measured 5.4 GB: a third of everything this feature
    // puts on disk, kept for no reason. Deliberately not cleared on failure.
    rmSync(UV_CACHE_DIR, { recursive: true, force: true });
    this.emit(onProgress, "complete", "Decision runtime");
    return this.getPaths();
  }

  /**
   * Fetch a model's artifacts into the offline cache layout.
   *
   * Deliberately the engine's own downloader against pinned `resolve/<rev>/<file>`
   * URLs rather than `snapshot_download`. Three reasons: it reports real progress
   * through the same channel as every other download, each file's digest is checked
   * as it lands, and it avoids HuggingFace's Xet transport, which stalled here with
   * dozens of open connections and no bytes written.
   */
  async downloadModel(
    model: SidecarDecisionModelInfo,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    if (this.activeDownload) {
      // The same model joins the download already running rather than starting a
      // second one over the same files.
      if (this.activeDownload.modelId === model.id) return this.activeDownload.promise;
      throw new Error("Another decision model is already downloading.");
    }
    const promise: Promise<void> = this.download(model, onProgress).finally(() => {
      if (this.activeDownload?.promise === promise) this.activeDownload = null;
    });
    this.activeDownload = { modelId: model.id, promise };
    return promise;
  }

  private async download(
    model: SidecarDecisionModelInfo,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    this.cancelRequested = false;
    for (const artifact of model.artifacts) {
      const files = await this.listArtifactFiles(artifact);
      const snapshot = artifactSnapshotPath(artifact);
      mkdirSync(snapshot, { recursive: true });
      for (const file of files) {
        if (this.cancelRequested) throw new Error("Download aborted");
        // The file list comes from a repository the user pasted, so a name like
        // "../../../etc/x" would otherwise be written wherever it resolved to. The
        // path is checked against the snapshot before a directory is created, not
        // after a file is opened.
        let destination: string;
        try {
          destination = assertInsideDir(snapshot, resolve(snapshot, file.path));
        } catch {
          throw new Error(`${artifact.repoId} lists a file outside its own directory: ${file.path}`);
        }
        mkdirSync(dirname(destination), { recursive: true });
        if (await alreadyDownloaded(destination, file)) continue;
        const abort = new AbortController();
        this.activeFetchAbort = abort;
        try {
          await retry(
            () =>
              downloadFileWithProgress({
                // Each segment encoded, the separators kept: a `#`, `?` or `%` in a file
                // name would otherwise end or rewrite the path and fetch another file.
                url: `https://huggingface.co/${artifact.repoId}/resolve/${artifact.revision}/${file.path
                  .split("/")
                  .map(encodeURIComponent)
                  .join("/")}`,
                destPath: destination,
                signal: abort.signal,
                expectedBytes: file.size,
                // Only LFS files publish a digest. Small config and tokenizer files
                // are checked by size, which is what the hub itself exposes for them.
                ...(file.sha256 ? { expectedSha256: file.sha256 } : {}),
                progress: { phase: "model", label: `${model.label}: ${file.path}` },
                onProgress,
              }),
            { retries: 2, baseDelayMs: 1000, shouldRetry: (error) => !isAbortError(error) },
          );
        } finally {
          this.activeFetchAbort = null;
        }
      }
      // Written last, so its presence is the signal that this artifact completed.
      writeFileSync(
        join(snapshot, DOWNLOAD_RECEIPT),
        JSON.stringify(Object.fromEntries(files.map((file) => [file.path, file.size]))),
        "utf-8",
      );
    }
  }

  /**
   * The files in a pinned revision, with sizes and digests.
   *
   * `paths-info` is the only endpoint that returns the LFS sha256; the plain model
   * endpoint omits it, which would leave the largest file in the install unverified.
   */
  private async listArtifactFiles(
    artifact: DecisionModelArtifact,
  ): Promise<Array<{ path: string; size: number; sha256?: string }>> {
    // Bounded and cancellable like every other request this service makes: an
    // unbounded metadata fetch would hang an install with no way to stop it.
    const abort = new AbortController();
    this.activeFetchAbort = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]);
    try {
      return await this.fetchArtifactFiles(artifact, signal);
    } finally {
      this.activeFetchAbort = null;
    }
  }

  private async fetchArtifactFiles(
    artifact: DecisionModelArtifact,
    signal: AbortSignal,
  ): Promise<Array<{ path: string; size: number; sha256?: string }>> {
    const wanted = (await listHubFiles(artifact.repoId, artifact.revision, signal))
      .map((file) => file.path)
      .filter((path) => !artifact.paths || artifact.paths.some((prefix) => path.startsWith(prefix)));
    if (wanted.length === 0) throw new Error(`No matching files in ${artifact.repoId} at ${artifact.revision}`);
    // Checked here as well as at inspection: the inspection is what the user saw, this
    // is what is about to be written, and the two are separate requests.
    const unsupported = wanted.filter((path) => !isLoadableArtifactFile(path));
    if (unsupported.length > 0)
      throw new Error(
        `${artifact.repoId} contains files the decision runtime does not load: ${unsupported.join(", ")}`,
      );

    const info = await fetch(`https://huggingface.co/api/models/${artifact.repoId}/paths-info/${artifact.revision}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: wanted }),
      signal,
    });
    if (!info.ok) throw new Error(`Could not read file digests for ${artifact.repoId}`);
    const described = (await info.json()) as Array<{
      type?: string;
      path: string;
      size: number;
      lfs?: { oid?: string };
    }>;
    // The download list and the receipt both come from this reply, so a path it left
    // out (a request limit, say) would be neither fetched nor expected, and the model
    // would read as installed and then fail inside the loader. It must describe the
    // wanted set exactly, once each, and only files.
    const describedPaths = new Set(described.map((entry) => entry.path));
    const missing = wanted.filter((path) => !describedPaths.has(path));
    if (
      missing.length > 0 ||
      described.length !== wanted.length ||
      describedPaths.size !== described.length ||
      described.some((entry) => (entry.type !== undefined && entry.type !== "file") || typeof entry.size !== "number")
    )
      throw new Error(
        `Could not read file details for ${artifact.repoId}${missing.length > 0 ? `: ${missing.join(", ")}` : ""}`,
      );
    return described.map((entry) => ({
      path: entry.path,
      size: entry.size,
      ...(entry.lfs?.oid ? { sha256: entry.lfs.oid } : {}),
    }));
  }

  /**
   * Is every artifact fully on disk?
   *
   * Checked against the manifest this install wrote, file by file and byte for byte.
   * A non-empty directory is not a complete download: an install interrupted halfway
   * leaves plenty of files behind, and reporting that as ready means the launch fails
   * inside the model loader instead of here.
   */
  modelDownloaded(model: SidecarDecisionModelInfo): boolean {
    return model.artifacts.every((artifact) => {
      const snapshot = artifactSnapshotPath(artifact);
      const receipt = join(snapshot, DOWNLOAD_RECEIPT);
      if (!existsSync(receipt)) return false;
      try {
        const expected = JSON.parse(readFileSync(receipt, "utf-8")) as Record<string, number>;
        return Object.entries(expected).every(([relative, size]) => {
          try {
            const file = assertInsideDir(snapshot, resolve(snapshot, relative));
            return existsSync(file) && statSync(file).size === size;
          } catch {
            // A receipt naming a path outside its own snapshot is not a receipt.
            return false;
          }
        });
      } catch {
        return false;
      }
    });
  }

  private uvEnv(): NodeJS.ProcessEnv {
    return {
      UV_CACHE_DIR,
      UV_PYTHON_INSTALL_DIR: PYTHON_INSTALL_DIR,
      UV_PYTHON_BIN_DIR: PYTHON_BIN_DIR,
      UV_PYTHON_INSTALL_BIN: "0",
      UV_MANAGED_PYTHON: "1",
      UV_NO_CONFIG: "1",
      // The default timed out partway through a 527 MB CUDA wheel. The cache keeps
      // whatever landed, so a retry resumes rather than starting over.
      UV_HTTP_TIMEOUT: "300",
    };
  }

  private async ensureUv(onProgress?: (progress: SidecarDownloadProgress) => void): Promise<void> {
    if (existsSync(UV_BIN) && readStamp() === expectedStamp()) return;
    this.emit(onProgress, "downloading", "uv dependency manager");
    const archivePath = join(RUNTIME_DIR, DECISION_RUNTIME_MANIFEST.uv.archive.name);
    try {
      await this.downloadVerified(
        DECISION_RUNTIME_MANIFEST.uv.archive,
        archivePath,
        "uv dependency manager",
        onProgress,
      );
      await this.run("tar", ["xzf", archivePath, "-C", UV_DIR, "--strip-components=1"], { cwd: RUNTIME_DIR });
    } finally {
      rmSync(archivePath, { force: true });
    }
    if (!existsSync(UV_BIN)) throw new Error("The uv archive unpacked without producing an executable.");
  }

  private async downloadVerified(
    asset: { browser_download_url: string; name: string; sha256: string; size: number },
    destinationPath: string,
    label: string,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    await retry(
      async () => {
        if (this.cancelRequested) throw new Error("Install aborted");
        const abort = new AbortController();
        this.activeFetchAbort = abort;
        try {
          await downloadFileWithProgress({
            url: asset.browser_download_url,
            destPath: destinationPath,
            signal: abort.signal,
            expectedBytes: asset.size,
            expectedSha256: asset.sha256,
            progress: { phase: "runtime", label },
            onProgress,
          });
        } finally {
          this.activeFetchAbort = null;
        }
      },
      { retries: 2, baseDelayMs: 500, shouldRetry: (error) => !isAbortError(error) },
    );
  }

  private emit(
    onProgress: ((progress: SidecarDownloadProgress) => void) | undefined,
    status: SidecarDownloadProgress["status"],
    label: string,
    error?: string,
  ): void {
    onProgress?.({ phase: "runtime", status, downloaded: 0, total: 0, speed: 0, label, ...(error ? { error } : {}) });
  }

  private async run(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...inheritedEnv({ network: true }), ...options.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.activeChild = child;
      let output = "";
      const capture = (chunk: unknown) => {
        // Bounded: a failing pip sync can produce megabytes of resolver output, and
        // only the tail is useful in the error.
        output = `${output}${String(chunk)}`.slice(-8000);
      };
      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      child.on("error", (error) => {
        this.activeChild = null;
        reject(error);
      });
      child.on("close", (code) => {
        this.activeChild = null;
        if (code === 0) {
          resolve();
          return;
        }
        logger.warn("[decision-runtime] %s exited with %s", command, code);
        reject(new Error(`${command} failed with code ${code}: ${output.trim().slice(-600)}`));
      });
    });
  }
}

export const decisionRuntimeService = new DecisionRuntimeService();
