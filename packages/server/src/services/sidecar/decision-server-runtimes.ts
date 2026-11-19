/**
 * The server programs that run GGUF decision models, and where each one comes from.
 *
 * Four of the five decision runtimes are a llama.cpp server with a GGUF:
 *
 * - `llama_letters` reuses the llama.cpp runtime Marinara already installs for its
 *   built-in chat model. Nothing extra is downloaded for it.
 * - `llama_systemone` needs a llama.cpp new enough to answer `/v1/systemone` itself.
 *   The chat model's pinned build predates that, and moving the chat model's server
 *   for a decision model would change something people did not ask to change, so this
 *   is its own pinned build beside it.
 * - `valen_gguf` and `winnow_cuda` are their authors' own patched llama.cpp builds,
 *   published for one platform each.
 *
 * The fifth, `valen_onnx`, is not a llama.cpp server: it is Valen's own SDK on the Node
 * that runs Marinara (`assets/decision/valen-onnx-server.mjs`), and what it installs is
 * FFmpeg for reading video, from the same pinned static builds the `ffmpeg-static`
 * package uses. An FFmpeg and ffprobe already on the PATH are used instead.
 *
 * Every archive is pinned by size and sha256 and checked before it is unpacked, the
 * same rule as the chat runtime's manifest. A build that is not listed for this
 * machine is not offered: the preflight turns that into a refusal before anything
 * downloads.
 */
import AdmZip from "adm-zip";
import { execFile } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { delimiter, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createGunzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { DecisionRuntimeKind, SidecarDownloadProgress } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { getDataDir } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { downloadFileWithProgress, isAbortError, retry } from "./sidecar-download.js";
import { sidecarRuntimeService } from "./sidecar-runtime.service.js";

const execFileAsync = promisify(execFile);
const SERVERS_DIR = join(getDataDir(), "sidecar-runtime", "decision-servers");
const STAMP_NAME = ".marinara-runtime.json";

export interface DecisionServerAsset {
  /** Which build this is, by the same names the chat runtime uses. */
  variant: string;
  name: string;
  url: string;
  size: number;
  sha256: string;
  /** The server program's file name; it is looked for anywhere in the archive. */
  executable: string;
  /** Uses a graphics card (Vulkan, Metal or CUDA) rather than the processor alone. */
  gpu: boolean;
}

interface DecisionServerRuntime {
  /** Folder-name prefix and stamp; a new pin is a new folder. */
  id: string;
  assets: DecisionServerAsset[];
}

const LLAMA_TAG = "b12503";
const llamaAsset = (variant: string, file: string, size: number, sha256: string, gpu = false): DecisionServerAsset => ({
  variant,
  name: `llama-${LLAMA_TAG}-bin-${file}`,
  url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_TAG}/llama-${LLAMA_TAG}-bin-${file}`,
  size,
  sha256,
  executable: file.startsWith("win-") ? "llama-server.exe" : "llama-server",
  gpu,
});

/**
 * The pinned server builds, by runtime. Sizes and digests were read from the release
 * files themselves on 2026-11-18.
 */
export const DECISION_SERVER_RUNTIMES: Record<"llama_systemone" | "valen_gguf" | "winnow_cuda", DecisionServerRuntime> =
  {
    // The first llama.cpp builds that answer `/v1/systemone` natively (ggml-org PR #29818).
    llama_systemone: {
      id: `llama-${LLAMA_TAG}`,
      assets: [
        llamaAsset(
          "linux-x64-cpu",
          "ubuntu-x64.tar.gz",
          23_784_463,
          "0d585f8a78ffdfdc4f6303a089aaa1379c15323b33483b6548c85c774a376a9d",
        ),
        llamaAsset(
          "linux-x64-vulkan",
          "ubuntu-vulkan-x64.tar.gz",
          36_726_636,
          "f39d2bc07eee32e438f08ee3fe2ef3d282e61674196e0dc2871160e2fadc5434",
          true,
        ),
        llamaAsset(
          "linux-arm64-cpu",
          "ubuntu-arm64.tar.gz",
          19_377_874,
          "e2b566c5368e2e781b73e5c6222f9512c9e6bc563cf4863a42b675356fb6df6a",
        ),
        llamaAsset(
          "macos-arm64-metal",
          "macos-arm64.tar.gz",
          17_282_183,
          "e88d7e91198d0de6ceb3d33711ac01ee0d5b519cd9ba4e81854e3bba84f22214",
          true,
        ),
        llamaAsset(
          "macos-x64-cpu",
          "macos-x64.tar.gz",
          13_055_174,
          "4c42388726490b1ed7864dc621dd29526f0ced3d617a96c5ac111287a7a68ba5",
        ),
        llamaAsset(
          "android-arm64-cpu",
          "android-arm64.tar.gz",
          80_724_801,
          "e28de50b97489af1d4cd061337961baa63b8418ec8c57a31a40145fbfc36fb79",
        ),
        llamaAsset(
          "win-x64-cpu",
          "win-cpu-x64.zip",
          25_521_102,
          "64bee9b6fece8e66c665c40290cbb84706af23c670041d024b56a71a39859d77",
        ),
        llamaAsset(
          "win-x64-vulkan",
          "win-vulkan-x64.zip",
          38_603_975,
          "6c83027548f989a4d5c9502b31b580dc5e1254998bd49c1d78e85f316900d118",
          true,
        ),
        llamaAsset(
          "win-arm64-cpu",
          "win-cpu-arm64.zip",
          13_838_966,
          "56df5e64f4763ff9a8ca5e1a5b54a5839b4becb99e0e2f1ba8ad80dbf50faf05",
        ),
      ],
    },
    // Valen's own build: Linux x64, CPU, AVX2/FMA/F16C/BMI2, glibc 2.35 or newer.
    valen_gguf: {
      id: "valen-gguf-0.2.0",
      assets: [
        {
          variant: "linux-x64-cpu",
          name: "valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz",
          url: "https://github.com/Valen-Team/Valen/releases/download/gguf-runtime-v0.2.0/valen-gguf-runtime-0.2.0-linux-x86_64.tar.gz",
          size: 32_070_054,
          sha256: "4b3b6035adbb99f3bb47c75e55804e1f650f96b35b825d95a6cd4ae85ce39537",
          executable: "llama-server",
          gpu: false,
        },
      ],
    },
    // Winnow's own build: Linux x64, CUDA 13, kernels for sm_120 only. It links the
    // system's CUDA 13 runtime, cuBLAS and NCCL, which the preflight looks for.
    winnow_cuda: {
      id: "winnow-v2026.10.06",
      assets: [
        {
          variant: "linux-x64-cuda",
          name: "winnow-linux-x86_64-cuda-v2026.10.06.tar.gz",
          url: "https://github.com/EldanRing/winnow-inference/releases/download/v2026.10.06/winnow-linux-x86_64-cuda-v2026.10.06.tar.gz",
          size: 56_974_684,
          sha256: "8829a53e29136ad4ca93366d3853cb41c7396bd2972b9d18b6d798cecbe1d37b",
          executable: "winnow-server",
          gpu: true,
        },
      ],
    },
  };

type PinnedRuntime = keyof typeof DECISION_SERVER_RUNTIMES;

function isPinned(runtime: DecisionRuntimeKind): runtime is PinnedRuntime {
  return Object.hasOwn(DECISION_SERVER_RUNTIMES, runtime);
}

/**
 * Which build of a runtime this machine gets, or null when there is none.
 *
 * For the native llama.cpp build: Metal on Apple silicon, Vulkan on Windows and Linux
 * x64 when the chat runtime's own detection found a Vulkan driver, the processor build
 * everywhere else. Vulkan reaches NVIDIA, AMD and Intel cards alike; a launch that
 * fails on the card falls back to the processor with the same build.
 */
export function decisionServerAsset(runtime: DecisionRuntimeKind): DecisionServerAsset | null {
  if (!isPinned(runtime)) return null;
  const assets = DECISION_SERVER_RUNTIMES[runtime].assets;
  const find = (variant: string) => assets.find((asset) => asset.variant === variant) ?? null;
  const { platform, arch } = process;
  if (runtime !== "llama_systemone") {
    return platform === "linux" && arch === "x64" ? (assets[0] ?? null) : null;
  }
  if (platform === "darwin") return find(arch === "arm64" ? "macos-arm64-metal" : "macos-x64-cpu");
  if (platform === "android") return arch === "arm64" ? find("android-arm64-cpu") : null;
  if (arch === "arm64") return find(platform === "win32" ? "win-arm64-cpu" : "linux-arm64-cpu");
  if (arch !== "x64") return null;
  const prefix = platform === "win32" ? "win-x64" : platform === "linux" ? "linux-x64" : null;
  if (!prefix) return null;
  const vulkan = sidecarRuntimeService.getDiagnostics().preferVulkan;
  return find(`${prefix}-${vulkan ? "vulkan" : "cpu"}`) ?? find(`${prefix}-cpu`);
}

function installDir(runtime: PinnedRuntime, asset: DecisionServerAsset): string {
  return join(SERVERS_DIR, `${DECISION_SERVER_RUNTIMES[runtime].id}-${asset.variant}`);
}

export interface DecisionServerInstall {
  /** The server program. */
  executable: string;
  /** The folder holding it, which also holds its shared libraries. */
  directory: string;
  variant: string;
  gpu: boolean;
  /** For `valen_onnx`: the script Node runs, and the FFmpeg pair that reads video. */
  script?: string;
  ffmpeg?: string;
  ffprobe?: string;
}

/**
 * FFmpeg for Valen's full release, by platform. The `ffmpeg-static` project's release
 * `b6.1.1` (FFmpeg 6.1.1); each file is gzip-compressed, and its size and sha256 were
 * read from the release files themselves on 2026-11-18.
 */
const FFMPEG_TAG = "b6.1.1";
const FFMPEG_BUILDS: Record<string, Record<"ffmpeg" | "ffprobe", { size: number; sha256: string }>> = {
  "linux-x64": {
    ffmpeg: { size: 29_354_986, sha256: "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa" },
    ffprobe: { size: 29_276_839, sha256: "25d9b6ccb05e3d9de9e04e31e2506d8dd7f9f0418981965ac6df12e8d3afd067" },
  },
  "linux-arm64": {
    ffmpeg: { size: 25_568_691, sha256: "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0" },
    ffprobe: { size: 25_493_573, sha256: "2ab6aba60ee84412dff9188720703376cb4e7aaf7e0b5e43aa8249f2acae5bf8" },
  },
  "darwin-arm64": {
    ffmpeg: { size: 19_246_198, sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa" },
    ffprobe: { size: 19_207_077, sha256: "d986a8ec7b030899fe66a8a288ed809a3543338705a3ce178cfb85869c5d80be" },
  },
  "win32-x64": {
    ffmpeg: { size: 29_581_307, sha256: "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77" },
    ffprobe: { size: 29_521_644, sha256: "f309e6223ad89d2fe54bccd420a7709b66fd27540674e92309578ed491a43c8d" },
  },
};

/** The script that serves Valen's full release; next to the compiled code in both src and dist. */
export const VALEN_ONNX_SCRIPT = fileURLToPath(new URL("../../assets/decision/valen-onnx-server.mjs", import.meta.url));

const exeName = (name: string) => (process.platform === "win32" ? `${name}.exe` : name);

function ffmpegBuild() {
  return FFMPEG_BUILDS[`${process.platform}-${process.arch}`] ?? null;
}

function ffmpegDir(): string {
  return join(SERVERS_DIR, `ffmpeg-${FFMPEG_TAG}-${process.platform}-${process.arch}`);
}

/** An FFmpeg and ffprobe pair on the PATH, when both are there. */
function ffmpegOnPath(): { ffmpeg: string; ffprobe: string } | null {
  const find = (name: string) => {
    for (const entry of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
      const candidate = join(entry, exeName(name));
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Not in this folder.
      }
    }
    return null;
  };
  const ffmpeg = find("ffmpeg");
  const ffprobe = find("ffprobe");
  return ffmpeg && ffprobe ? { ffmpeg, ffprobe } : null;
}

/** The pinned FFmpeg pair, when it is installed and its stamp matches the pin. */
function pinnedFfmpeg(): { ffmpeg: string; ffprobe: string } | null {
  const build = ffmpegBuild();
  if (!build) return null;
  const dir = ffmpegDir();
  try {
    const stamp = JSON.parse(readFileSync(join(dir, STAMP_NAME), "utf-8")) as { sha256?: string };
    if (stamp.sha256 !== build.ffmpeg.sha256) return null;
  } catch {
    return null;
  }
  const ffmpeg = join(dir, exeName("ffmpeg"));
  const ffprobe = join(dir, exeName("ffprobe"));
  return existsSync(ffmpeg) && existsSync(ffprobe) ? { ffmpeg, ffprobe } : null;
}

/** Valen's full release, ready to run, or null while FFmpeg is missing. */
function valenOnnxInstall(): DecisionServerInstall | null {
  const ffmpeg = pinnedFfmpeg() ?? ffmpegOnPath();
  if (!ffmpeg) return null;
  return {
    executable: process.execPath,
    directory: join(VALEN_ONNX_SCRIPT, ".."),
    variant: `onnx-cpu-${process.platform}-${process.arch}`,
    gpu: false,
    script: VALEN_ONNX_SCRIPT,
    ...ffmpeg,
  };
}

/** The installed build for a pinned runtime, or null when it is not here and whole. */
function pinnedInstall(runtime: PinnedRuntime): DecisionServerInstall | null {
  const asset = decisionServerAsset(runtime);
  if (!asset) return null;
  const dir = installDir(runtime, asset);
  try {
    const stamp = JSON.parse(readFileSync(join(dir, STAMP_NAME), "utf-8")) as { sha256?: string; executable?: string };
    if (stamp.sha256 !== asset.sha256 || typeof stamp.executable !== "string") return null;
    const executable = assertInsideDir(dir, join(dir, stamp.executable));
    if (!existsSync(executable)) return null;
    return { executable, directory: join(executable, ".."), variant: asset.variant, gpu: asset.gpu };
  } catch {
    return null;
  }
}

/**
 * The server a GGUF decision model runs on, if it is installed.
 *
 * `llama_letters` answers with the chat model's runtime as it is recorded, read-only,
 * exactly as the utility and embedding slots do.
 */
export function decisionServerInstall(runtime: DecisionRuntimeKind): DecisionServerInstall | null {
  if (runtime === "valen_onnx") return valenOnnxInstall();
  if (runtime === "llama_letters") {
    const current = sidecarRuntimeService.getCurrentInstall();
    if (!current?.serverPath) return null;
    return {
      executable: current.serverPath,
      directory: join(current.serverPath, ".."),
      variant: current.variant,
      gpu: sidecarRuntimeService.isGpuVariant(current.variant),
    };
  }
  return isPinned(runtime) ? pinnedInstall(runtime) : null;
}

/** Is there a build of this runtime for this machine at all? */
export function hasDecisionServerBuild(runtime: DecisionRuntimeKind): boolean {
  if (runtime === "llama_letters") return true;
  if (runtime === "valen_onnx") return ffmpegBuild() !== null || ffmpegOnPath() !== null;
  return decisionServerAsset(runtime) !== null;
}

/** Download size of what installing this runtime still needs, for the confirm dialog. */
export function decisionServerDownloadBytes(runtime: DecisionRuntimeKind): number {
  if (decisionServerInstall(runtime)) return 0;
  if (runtime === "valen_onnx") {
    const build = ffmpegBuild();
    return build ? build.ffmpeg.size + build.ffprobe.size : 0;
  }
  return decisionServerAsset(runtime)?.size ?? 0;
}

function findFileRecursive(dir: string, name: string, depth = 0): string | null {
  if (depth > 6) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, name, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function extract(archive: string, target: string): Promise<void> {
  if (archive.endsWith(".zip")) {
    const zip = new AdmZip(archive);
    for (const entry of zip.getEntries()) assertInsideDir(target, join(target, entry.entryName));
    zip.extractAllTo(target, true);
    return;
  }
  const { stdout } = await execFileAsync("tar", ["-tzf", archive], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  for (const entry of stdout.split(/\r?\n/u).filter(Boolean)) assertInsideDir(target, join(target, entry));
  await execFileAsync("tar", ["-xzf", archive, "-C", target], { timeout: 300_000 });
}

class DecisionServerRuntimeService {
  private installing = new Map<string, Promise<DecisionServerInstall>>();
  private abort: AbortController | null = null;

  cancel(): void {
    this.abort?.abort();
  }

  /**
   * Install the server a runtime needs, if it is not here yet.
   *
   * For `llama_letters` that is the chat model's llama.cpp runtime, installed the same
   * way the built-in chat model installs it.
   */
  async ensureInstalled(
    runtime: DecisionRuntimeKind,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<DecisionServerInstall> {
    const existing = decisionServerInstall(runtime);
    if (existing) return existing;
    if (runtime === "valen_onnx") {
      let promise = this.installing.get("valen_onnx");
      if (!promise) {
        promise = this.installFfmpeg(onProgress).finally(() => this.installing.delete("valen_onnx"));
        this.installing.set("valen_onnx", promise);
      }
      return promise;
    }
    if (runtime === "llama_letters") {
      await sidecarRuntimeService.ensureInstalled(onProgress);
      const installed = decisionServerInstall(runtime);
      if (!installed) throw new Error("The llama.cpp runtime did not install.");
      return installed;
    }
    if (!isPinned(runtime)) throw new Error(`No server to install for ${runtime}.`);
    const asset = decisionServerAsset(runtime);
    if (!asset) throw new Error("This decision model's runtime has no build for this computer.");
    const key = `${runtime}:${asset.variant}`;
    let promise = this.installing.get(key);
    if (!promise) {
      promise = this.install(runtime, asset, onProgress).finally(() => this.installing.delete(key));
      this.installing.set(key, promise);
    }
    return promise;
  }

  private async install(
    runtime: PinnedRuntime,
    asset: DecisionServerAsset,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<DecisionServerInstall> {
    mkdirSync(SERVERS_DIR, { recursive: true });
    const finalDir = installDir(runtime, asset);
    const archive = assertInsideDir(SERVERS_DIR, join(SERVERS_DIR, asset.name));
    const scratch = mkdtempSync(join(SERVERS_DIR, `${DECISION_SERVER_RUNTIMES[runtime].id}.extract-`));
    try {
      await retry(
        async () => {
          const abort = new AbortController();
          this.abort = abort;
          try {
            await downloadFileWithProgress({
              url: asset.url,
              destPath: archive,
              signal: abort.signal,
              expectedBytes: asset.size,
              expectedSha256: asset.sha256,
              progress: { phase: "runtime", label: asset.name },
              onProgress,
            });
          } finally {
            if (this.abort === abort) this.abort = null;
          }
        },
        { retries: 2, baseDelayMs: 500, shouldRetry: (error) => !isAbortError(error) },
      );
      await extract(archive, scratch);
      const executable = findFileRecursive(scratch, asset.executable);
      if (!executable) throw new Error(`${asset.name} did not contain ${asset.executable}.`);
      if (process.platform !== "win32") chmodSync(executable, 0o755);
      const relativeExecutable = relative(scratch, executable);
      writeFileSync(
        join(scratch, STAMP_NAME),
        JSON.stringify({ sha256: asset.sha256, executable: relativeExecutable, installedAt: new Date().toISOString() }),
      );
      rmSync(finalDir, { recursive: true, force: true });
      renameSync(scratch, finalDir);
      logger.info("[decision-runtime] Installed %s (%s)", DECISION_SERVER_RUNTIMES[runtime].id, asset.variant);
    } finally {
      rmSync(archive, { force: true });
      if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
    }
    const installed = pinnedInstall(runtime);
    if (!installed) throw new Error("The decision model's server did not install.");
    return installed;
  }

  /**
   * The pinned FFmpeg pair Valen's full release reads video with. Each file is checked
   * against its digest before it is unpacked, and the folder is swapped in whole.
   */
  private async installFfmpeg(
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<DecisionServerInstall> {
    const build = ffmpegBuild();
    if (!build) throw new Error("There is no FFmpeg build for this computer. Install FFmpeg and ffprobe on the PATH.");
    mkdirSync(SERVERS_DIR, { recursive: true });
    const scratch = mkdtempSync(join(SERVERS_DIR, `ffmpeg-${FFMPEG_TAG}.extract-`));
    try {
      for (const name of ["ffmpeg", "ffprobe"] as const) {
        const file = `${name}-${process.platform}-${process.arch}.gz`;
        const archive = join(scratch, file);
        await retry(
          async () => {
            const abort = new AbortController();
            this.abort = abort;
            try {
              await downloadFileWithProgress({
                url: `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_TAG}/${file}`,
                destPath: archive,
                signal: abort.signal,
                expectedBytes: build[name].size,
                expectedSha256: build[name].sha256,
                progress: { phase: "runtime", label: file },
                onProgress,
              });
            } finally {
              if (this.abort === abort) this.abort = null;
            }
          },
          { retries: 2, baseDelayMs: 500, shouldRetry: (error) => !isAbortError(error) },
        );
        const target = join(scratch, exeName(name));
        await pipeline(createReadStream(archive), createGunzip(), createWriteStream(target));
        rmSync(archive, { force: true });
        if (process.platform !== "win32") chmodSync(target, 0o755);
      }
      writeFileSync(
        join(scratch, STAMP_NAME),
        JSON.stringify({ sha256: build.ffmpeg.sha256, installedAt: new Date().toISOString() }),
      );
      const finalDir = ffmpegDir();
      rmSync(finalDir, { recursive: true, force: true });
      renameSync(scratch, finalDir);
      logger.info("[decision-runtime] Installed FFmpeg %s for Valen's full release", FFMPEG_TAG);
    } finally {
      if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
    }
    const installed = valenOnnxInstall();
    if (!installed) throw new Error("FFmpeg did not install.");
    return installed;
  }

  /** Delete every pinned decision server. The chat runtime is never touched. */
  async remove(): Promise<void> {
    this.cancel();
    await Promise.all([...this.installing.values()].map((promise) => promise.catch(() => null)));
    await rm(SERVERS_DIR, { recursive: true, force: true });
  }

  /** Bytes on disk, for diagnostics. */
  diskBytes(): number {
    const walk = (dir: string): number => {
      if (!existsSync(dir)) return 0;
      let total = 0;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        total += entry.isDirectory() ? walk(full) : statSync(full).size;
      }
      return total;
    };
    return walk(SERVERS_DIR);
  }
}

export const decisionServerRuntimeService = new DecisionServerRuntimeService();
