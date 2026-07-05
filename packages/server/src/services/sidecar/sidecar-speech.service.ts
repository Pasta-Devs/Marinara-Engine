import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve, sep } from "path";
import {
  SIDECAR_SPEECH_DEFAULT_MODEL_ID,
  SIDECAR_SPEECH_MODELS,
  type SidecarDownloadProgress,
  type SidecarSpeechConfig,
  type SidecarSpeechModelId,
  type SidecarSpeechRuntimeDiagnostics,
  type SidecarSpeechStatus,
  type SidecarSpeechStatusResponse,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";

const MODELS_DIR = join(DATA_DIR, "models");
const SPEECH_CONFIG_PATH = join(MODELS_DIR, "sidecar-speech-config.json");
const TARGET_SAMPLE_RATE = 16_000;
const LONG_FORM_ASR_CHUNK_SECONDS = 30;
const LONG_FORM_ASR_STRIDE_SECONDS = 5;
const SILENCE_HALLUCINATION_MAX_RMS = 0.008;
const SILENCE_HALLUCINATION_MAX_PEAK = 0.035;
const SILENCE_HALLUCINATION_PHRASES = new Set([
  "thank you",
  "thanks",
  "thanks for watching",
  "thank you for watching",
  "you",
]);
const require = createRequire(import.meta.url);
const isLite = process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";

type AsrPipeline = (
  audio: Float32Array,
  options?: { chunk_length_s?: number; stride_length_s?: number; task?: "transcribe" | "translate" },
) => Promise<{ text?: string } | Array<{ text?: string }>>;

type TransformersProgress = {
  status?: string;
  name?: string;
  file?: string;
  loaded?: number;
  total?: number;
};

function isSpeechModelId(value: unknown): value is SidecarSpeechModelId {
  return typeof value === "string" && SIDECAR_SPEECH_MODELS.some((model) => model.id === value);
}

function getSpeechModel(modelId: SidecarSpeechModelId) {
  return SIDECAR_SPEECH_MODELS.find((model) => model.id === modelId) ?? SIDECAR_SPEECH_MODELS[0]!;
}

function safeModelCachePath(repoId: string): string {
  const destination = join(MODELS_DIR, ...repoId.split("/").filter(Boolean));
  const resolvedRoot = resolve(MODELS_DIR);
  const resolvedDestination = resolve(destination);
  if (resolvedDestination !== resolvedRoot && !resolvedDestination.startsWith(resolvedRoot + sep)) {
    throw new Error("Resolved speech model cache path escaped the models directory");
  }
  return resolvedDestination;
}

function dirSize(path: string): number | null {
  if (!existsSync(path)) return null;
  try {
    const stat = statSync(path);
    if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return null;
    return readdirSync(path).reduce((total, entry) => total + (dirSize(join(path, entry)) ?? 0), 0);
  } catch {
    return null;
  }
}

function resolveOnnxRuntimeBindingPath(): string | null {
  try {
    const packageJsonPath = require.resolve("onnxruntime-node/package.json");
    return join(dirname(packageJsonPath), "bin", "napi-v6", process.platform, process.arch, "onnxruntime_binding.node");
  } catch {
    return null;
  }
}

function resolveOnnxRuntimePackageDir(): string | null {
  try {
    return dirname(require.resolve("onnxruntime-node/package.json"));
  } catch {
    return null;
  }
}

function listInstalledOnnxRuntimeArchs(packageDir: string | null): string[] {
  if (!packageDir) return [];
  const platformDir = join(packageDir, "bin", "napi-v6", process.platform);
  if (!existsSync(platformDir)) return [];
  try {
    return readdirSync(platformDir)
      .filter((arch) => existsSync(join(platformDir, arch, "onnxruntime_binding.node")))
      .sort();
  } catch {
    return [];
  }
}

function getOnnxRuntimeDiagnostics(): SidecarSpeechRuntimeDiagnostics {
  const packageDir = resolveOnnxRuntimePackageDir();
  const expectedBindingPath = resolveOnnxRuntimeBindingPath();
  return {
    packageFound: Boolean(packageDir),
    bindingFound: Boolean(expectedBindingPath && existsSync(expectedBindingPath)),
    expectedBindingPath,
    installedBindingArchs: listInstalledOnnxRuntimeArchs(packageDir),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    nodeExecPath: process.execPath,
    liteMode: isLite,
  };
}

function hasNativeOnnxRuntimeBinding(): boolean {
  return getOnnxRuntimeDiagnostics().bindingFound;
}

function normalizeSample(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function readWavChunk(buffer: Buffer, offset: number) {
  const id = buffer.toString("ascii", offset, offset + 4);
  const size = buffer.readUInt32LE(offset + 4);
  return { id, size, dataOffset: offset + 8, nextOffset: offset + 8 + size + (size % 2) };
}

function decodePcmWav(buffer: Buffer): { samples: Float32Array; sampleRate: number } {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Local Whisper expects a WAV audio upload.");
  }

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunk = readWavChunk(buffer, offset);
    if (chunk.id === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunk.dataOffset);
      channels = buffer.readUInt16LE(chunk.dataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunk.dataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunk.dataOffset + 14);
    } else if (chunk.id === "data") {
      dataOffset = chunk.dataOffset;
      dataSize = chunk.size;
    }
    offset = chunk.nextOffset;
  }

  if (dataOffset < 0 || dataSize <= 0) throw new Error("WAV audio did not include a data chunk.");
  if (channels <= 0 || sampleRate <= 0) throw new Error("WAV audio metadata is invalid.");
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error("Local Whisper only accepts PCM or float WAV audio.");
  }

  const bytesPerSample = bitsPerSample / 8;
  if (![1, 2, 3, 4].includes(bytesPerSample)) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
  }

  const frameCount = Math.floor(dataSize / bytesPerSample / channels);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataOffset + (frame * channels + channel) * bytesPerSample;
      if (audioFormat === 3 && bitsPerSample === 32) {
        sum += normalizeSample(buffer.readFloatLE(sampleOffset));
      } else if (bitsPerSample === 8) {
        sum += (buffer.readUInt8(sampleOffset) - 128) / 128;
      } else if (bitsPerSample === 16) {
        sum += buffer.readInt16LE(sampleOffset) / 32768;
      } else if (bitsPerSample === 24) {
        sum += buffer.readIntLE(sampleOffset, 3) / 8388608;
      } else {
        sum += buffer.readInt32LE(sampleOffset) / 2147483648;
      }
    }
    samples[frame] = normalizeSample(sum / channels);
  }

  return { samples, sampleRate };
}

function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const nextLength = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const next = new Float32Array(nextLength);
  const ratio = (samples.length - 1) / Math.max(1, nextLength - 1);
  for (let index = 0; index < nextLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourceIndex - left;
    next[index] = samples[left]! * (1 - fraction) + samples[right]! * fraction;
  }
  return next;
}

function audioStats(samples: Float32Array, sampleRate: number): { durationSeconds: number; rms: number; peak: number } {
  if (samples.length === 0) return { durationSeconds: 0, rms: 0, peak: 0 };
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    const value = Math.abs(normalizeSample(sample));
    sumSquares += value * value;
    if (value > peak) peak = value;
  }
  return {
    durationSeconds: samples.length / sampleRate,
    rms: Math.sqrt(sumSquares / samples.length),
    peak,
  };
}

function normalizeTranscriptForSilenceFilter(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/[.!?,;:"“”‘’'`*_~()[\]{}<>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySilenceHallucination(text: string, stats: { rms: number; peak: number }): boolean {
  const normalized = normalizeTranscriptForSilenceFilter(text);
  if (!SILENCE_HALLUCINATION_PHRASES.has(normalized)) return false;
  return stats.rms <= SILENCE_HALLUCINATION_MAX_RMS || stats.peak <= SILENCE_HALLUCINATION_MAX_PEAK;
}

class SidecarSpeechService {
  private config: SidecarSpeechConfig;
  private status: SidecarSpeechStatus = "not_downloaded";
  private activeModelId: SidecarSpeechModelId | null = null;
  private pipeline: AsrPipeline | null = null;
  private loadingPromise: Promise<AsrPipeline> | null = null;
  private downloadProgress: SidecarDownloadProgress | null = null;
  private lastError: string | null = null;

  constructor() {
    mkdirSync(MODELS_DIR, { recursive: true });
    this.config = this.loadConfig();
    this.status = this.detectStatus();
  }

  private loadConfig(): SidecarSpeechConfig {
    try {
      if (!existsSync(SPEECH_CONFIG_PATH)) return { modelId: null };
      const raw = JSON.parse(readFileSync(SPEECH_CONFIG_PATH, "utf-8")) as Partial<SidecarSpeechConfig>;
      return { modelId: isSpeechModelId(raw.modelId) ? raw.modelId : null };
    } catch {
      return { modelId: null };
    }
  }

  private saveConfig(): void {
    writeFileSync(SPEECH_CONFIG_PATH, JSON.stringify(this.config, null, 2), "utf-8");
  }

  private isAvailable(): boolean {
    return !isLite && hasNativeOnnxRuntimeBinding();
  }

  private getDownloadedModelId(): SidecarSpeechModelId | null {
    const configured = this.config.modelId;
    if (configured && this.isModelDownloaded(configured)) return configured;
    return SIDECAR_SPEECH_MODELS.find((model) => this.isModelDownloaded(model.id))?.id ?? null;
  }

  private detectStatus(): SidecarSpeechStatus {
    if (this.pipeline) return "ready";
    return this.getDownloadedModelId() ? "downloaded" : "not_downloaded";
  }

  private isModelDownloaded(modelId: SidecarSpeechModelId): boolean {
    const model = getSpeechModel(modelId);
    const path = safeModelCachePath(model.repoId);
    return Boolean(existsSync(path) && (dirSize(path) ?? 0) > 0);
  }

  private getModelSize(modelId: SidecarSpeechModelId | null): number | null {
    if (!modelId) return null;
    return dirSize(safeModelCachePath(getSpeechModel(modelId).repoId));
  }

  private createProgressCallback(modelId: SidecarSpeechModelId, onProgress?: (progress: SidecarDownloadProgress) => void) {
    const model = getSpeechModel(modelId);
    let lastReportAt = Date.now();
    let lastLoaded = 0;
    return (data: TransformersProgress) => {
      const label = data.file ? `${model.label}: ${data.file}` : model.label;
      if (data.status === "progress") {
        const now = Date.now();
        const elapsedSeconds = Math.max(0.001, (now - lastReportAt) / 1000);
        const loaded = Number(data.loaded ?? 0);
        const speed = Math.max(0, (loaded - lastLoaded) / elapsedSeconds);
        lastReportAt = now;
        lastLoaded = loaded;
        this.downloadProgress = {
          phase: "model",
          status: "downloading",
          downloaded: loaded,
          total: Number(data.total ?? model.sizeBytes),
          speed,
          label,
        };
        onProgress?.(this.downloadProgress);
        return;
      }
      if (data.status === "initiate" || data.status === "download") {
        this.downloadProgress = {
          phase: "model",
          status: "downloading",
          downloaded: 0,
          total: model.sizeBytes,
          speed: 0,
          label,
        };
        onProgress?.(this.downloadProgress);
      }
    };
  }

  private async disposeCurrentPipeline(): Promise<void> {
    const current = this.pipeline as (AsrPipeline & { dispose?: () => Promise<void> }) | null;
    this.pipeline = null;
    this.activeModelId = null;
    if (current?.dispose) {
      await current.dispose().catch((error) => logger.warn(error, "[sidecar-speech] Failed to dispose ASR pipeline"));
    }
  }

  private async loadPipeline(
    modelId: SidecarSpeechModelId,
    options: { localFilesOnly: boolean; progress?: (data: TransformersProgress) => void },
  ): Promise<AsrPipeline> {
    if (this.pipeline && this.activeModelId === modelId) return this.pipeline;
    if (this.loadingPromise && this.activeModelId === modelId) return this.loadingPromise;

    await this.disposeCurrentPipeline();
    this.activeModelId = modelId;
    this.status = options.localFilesOnly ? "loading" : "downloading_model";
    this.lastError = null;

    this.loadingPromise = (async () => {
      if (!this.isAvailable()) {
        const runtime = getOnnxRuntimeDiagnostics();
        const installed = runtime.installedBindingArchs.length > 0 ? runtime.installedBindingArchs.join(", ") : "none";
        throw new Error(
          `Local Whisper is unavailable because onnxruntime-node is not installed for ${process.platform}/${process.arch}. Installed native runtime architectures for this platform: ${installed}.`,
        );
      }
      const model = getSpeechModel(modelId);
      const { pipeline: createPipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = MODELS_DIR;
      env.allowLocalModels = true;
      env.useBrowserCache = false;

      logger.info("[sidecar-speech] Loading %s...", model.repoId);
      const startedAt = Date.now();
      const loaded = (await createPipeline("automatic-speech-recognition", model.repoId, {
        dtype: "q8",
        local_files_only: options.localFilesOnly,
        progress_callback: options.progress as never,
      })) as AsrPipeline;
      logger.info("[sidecar-speech] Loaded %s in %dms", model.repoId, Date.now() - startedAt);
      this.pipeline = loaded;
      this.status = "ready";
      this.downloadProgress = null;
      this.config = { modelId };
      this.saveConfig();
      return loaded;
    })();

    try {
      return await this.loadingPromise;
    } catch (error) {
      this.pipeline = null;
      this.activeModelId = null;
      this.lastError = error instanceof Error ? error.message : "Local Whisper failed to load";
      this.status = "error";
      throw error;
    } finally {
      this.loadingPromise = null;
      if ((this.status as SidecarSpeechStatus) !== "ready") this.downloadProgress = null;
    }
  }

  getStatus(): SidecarSpeechStatusResponse {
    const downloadedModelId = this.getDownloadedModelId();
    const activeModelId = this.config.modelId ?? downloadedModelId;
    const activeModel = activeModelId ? getSpeechModel(activeModelId) : null;
    const runtime = getOnnxRuntimeDiagnostics();
    const effectiveStatus =
      this.status === "downloading_model" || this.status === "loading" || this.status === "error"
        ? this.status
        : this.detectStatus();
    return {
      status: effectiveStatus,
      config: { ...this.config },
      available: !runtime.liteMode && runtime.bindingFound,
      modelDownloaded: Boolean(downloadedModelId),
      modelDisplayName: activeModel && this.isModelDownloaded(activeModel.id) ? activeModel.label : null,
      modelSize: this.getModelSize(activeModelId),
      models: SIDECAR_SPEECH_MODELS,
      downloadProgress: this.downloadProgress,
      error: this.lastError,
      platform: process.platform,
      arch: process.arch,
      runtime,
    };
  }

  async download(
    modelId: SidecarSpeechModelId = SIDECAR_SPEECH_DEFAULT_MODEL_ID,
    onProgress?: (progress: SidecarDownloadProgress) => void,
  ): Promise<void> {
    const progress = this.createProgressCallback(modelId, onProgress);
    await this.loadPipeline(modelId, { localFilesOnly: false, progress });
  }

  async deleteModel(modelId?: SidecarSpeechModelId | null): Promise<void> {
    const targetModelId = modelId ?? this.config.modelId ?? this.getDownloadedModelId();
    if (!targetModelId) return;
    await this.disposeCurrentPipeline();
    rmSync(safeModelCachePath(getSpeechModel(targetModelId).repoId), { recursive: true, force: true });
    if (this.config.modelId === targetModelId) {
      this.config = { modelId: null };
      this.saveConfig();
    }
    this.status = this.detectStatus();
    this.lastError = null;
    this.downloadProgress = null;
  }

  async transcribeWav(buffer: Buffer): Promise<string> {
    const configuredModelId = this.config.modelId;
    const modelId =
      configuredModelId && this.isModelDownloaded(configuredModelId)
        ? configuredModelId
        : (this.getDownloadedModelId() ?? SIDECAR_SPEECH_DEFAULT_MODEL_ID);
    if (!this.isModelDownloaded(modelId)) {
      throw new Error("Download Local Whisper from Connections before using it for call transcription.");
    }
    const decoded = decodePcmWav(buffer);
    const samples = resampleLinear(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE);
    const stats = audioStats(samples, TARGET_SAMPLE_RATE);
    const transcriber = await this.loadPipeline(modelId, { localFilesOnly: true });
    const asrOptions =
      stats.durationSeconds > LONG_FORM_ASR_CHUNK_SECONDS
        ? {
            chunk_length_s: LONG_FORM_ASR_CHUNK_SECONDS,
            stride_length_s: LONG_FORM_ASR_STRIDE_SECONDS,
            task: "transcribe" as const,
          }
        : { task: "transcribe" as const };
    const output = await transcriber(samples, asrOptions);
    const text = Array.isArray(output)
      ? output
          .map((item) => item.text ?? "")
          .join(" ")
          .trim()
      : (output.text ?? "").trim();
    if (isLikelySilenceHallucination(text, stats)) {
      logger.debug(
        "[sidecar-speech] Dropped likely silence hallucination transcript=%s duration=%d rms=%d peak=%d",
        text,
        stats.durationSeconds,
        stats.rms,
        stats.peak,
      );
      return "";
    }
    return text;
  }
}

export const sidecarSpeechService = new SidecarSpeechService();
