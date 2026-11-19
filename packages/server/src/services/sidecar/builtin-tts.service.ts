/**
 * The built-in voice models (Kokoro-82M, Supertonic 3): downloads their pinned files, runs the one in use in a
 * worker thread on the processor, and turns text into WAV audio for the Voice job (TTS source "builtin").
 *
 * They need no server of the person's own and share nothing with the other built-in models. The model loads on the
 * first line it speaks and unloads after 15 minutes unused. The model in use, saved voice blends and Supertonic's
 * reading language live in its own small settings file.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import {
  BUILTIN_TTS_DEFAULT_VOICE,
  BUILTIN_TTS_LATIN_LANGUAGES,
  BUILTIN_TTS_MODELS,
  BUILTIN_TTS_SUPERTONIC_LANGUAGES,
  BUILTIN_TTS_VOICES,
  type BuiltinTtsBlend,
  type BuiltinTtsFile,
  type BuiltinTtsModelId,
  type BuiltinTtsModelInfo,
  type BuiltinTtsSettings,
  type BuiltinTtsStatus,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveOnnxRuntimeBindingPath } from "../local-embedder.js";
import { downloadFileWithProgress, isAbortError, retry } from "./sidecar-download.js";

export const BUILTIN_TTS_IDLE_MS = 15 * 60_000;
/** A long reply can take a while on a slow processor; a worker that says nothing for this long is stuck. */
const SPEAK_TIMEOUT_MS = 5 * 60_000;
const MODELS_DIR = join(DATA_DIR, "models");
const ROOT_DIR = join(MODELS_DIR, "builtin-tts");
const SETTINGS_PATH = join(ROOT_DIR, "settings.json");
const MAX_BLENDS = 50;

function modelInfo(id: BuiltinTtsModelId): BuiltinTtsModelInfo {
  return BUILTIN_TTS_MODELS.find((model) => model.id === id)!;
}

/** Where a model's files live: its own folder per pinned revision. */
function modelDir(id: BuiltinTtsModelId): string {
  return join(ROOT_DIR, id, modelInfo(id).revision);
}

/** Every file a model needs: its own and its voices'. */
function modelFiles(id: BuiltinTtsModelId): BuiltinTtsFile[] {
  const voices = BUILTIN_TTS_VOICES.filter((voice) => voice.model === id).map((voice) => ({
    path: id === "kokoro-82m" ? `voices/${voice.id}.bin` : `voice_styles/${voice.id.replace(/^st_/, "")}.json`,
    bytes: voice.bytes,
    sha256: voice.sha256,
  }));
  return [...modelInfo(id).files, ...voices];
}

function isLite(): boolean {
  return process.env.MARINARA_LITE === "true" || process.env.MARINARA_LITE === "1";
}

function hasFile(id: BuiltinTtsModelId, file: { path: string; bytes: number }): boolean {
  try {
    return statSync(join(modelDir(id), file.path)).size === file.bytes;
  } catch {
    return false;
  }
}

function isInstalled(id: BuiltinTtsModelId): boolean {
  return modelFiles(id).every((file) => hasFile(id, file));
}

function isModelId(value: unknown): value is BuiltinTtsModelId {
  return BUILTIN_TTS_MODELS.some((model) => model.id === value);
}

/**
 * A voice of one model is one id ("af_heart", "st_F1") or a blend of up to four ("af_bella:60+am_puck:40"),
 * weights 1-100. Returns the canonical form, or null when it is not a voice of that model.
 */
export function normalizeBuiltinTtsVoice(spec: string, model: BuiltinTtsModelId): string | null {
  const ids = new Set(BUILTIN_TTS_VOICES.filter((voice) => voice.model === model).map((voice) => voice.id));
  const parts = spec
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return null;
  const parsed: Array<{ id: string; weight: number }> = [];
  for (const part of parts) {
    const [id = "", weight] = part.split(":");
    if (!ids.has(id)) return null;
    const value = weight === undefined ? 100 : Math.round(Number(weight));
    if (!Number.isFinite(value) || value < 1 || value > 100) return null;
    parsed.push({ id, weight: value });
  }
  if (parsed.length === 1) return parsed[0]!.id;
  return parsed.map((part) => `${part.id}:${part.weight}`).join("+");
}

/** The model a voice belongs to (the first voice of a blend), or null. */
export function builtinTtsVoiceModel(spec: string): BuiltinTtsModelId | null {
  const first = spec.split("+")[0]?.split(":")[0]?.trim() ?? "";
  return BUILTIN_TTS_VOICES.find((voice) => voice.id === first)?.model ?? null;
}

/** A WAV file (16-bit PCM, mono) for the samples. */
function toWav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

interface SpeakRequest {
  text: string;
  voice: string;
  speed: number;
  language: string;
  latinLanguage: string;
}

interface LoadedModel {
  id: BuiltinTtsModelId;
  speak(request: SpeakRequest): Promise<Float32Array>;
  dispose(): Promise<void>;
}

function startWorker(id: BuiltinTtsModelId, onLost: (error: Error) => void): Promise<LoadedModel> {
  const file = id === "kokoro-82m" ? "builtin-tts.worker" : "builtin-tts-supertonic.worker";
  const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";
  const worker = new Worker(new URL(`./${file}.${ext}`, import.meta.url), {
    workerData:
      id === "kokoro-82m"
        ? {
            modelsDir: MODELS_DIR,
            modelId: `builtin-tts/${id}/${modelInfo(id).revision}`,
            voicesDir: join(modelDir(id), "voices"),
          }
        : { modelDir: modelDir(id) },
  });
  // The model never keeps the server running on its own.
  worker.unref();
  const pending = new Map<number, { resolve: (samples: Float32Array) => void; reject: (error: Error) => void }>();
  let nextId = 0;
  let ready = false;
  let stopped: Error | null = null;
  const stop = (error: Error) => {
    if (!stopped && ready) onLost(error);
    stopped ??= error;
    for (const { reject } of pending.values()) reject(stopped);
    pending.clear();
  };
  return new Promise((resolve, reject) => {
    const model: LoadedModel = {
      id,
      speak(request) {
        if (stopped) return Promise.reject(stopped);
        const requestId = nextId++;
        return new Promise((resolveText, rejectText) => {
          const timer = setTimeout(() => {
            stop(new Error("The built-in voice model did not answer in time"));
            void worker.terminate();
          }, SPEAK_TIMEOUT_MS);
          timer.unref?.();
          pending.set(requestId, {
            resolve: (samples) => {
              clearTimeout(timer);
              resolveText(samples);
            },
            reject: (error) => {
              clearTimeout(timer);
              rejectText(error);
            },
          });
          worker.postMessage({ id: requestId, ...request });
        });
      },
      async dispose() {
        ready = false;
        stop(new Error("The built-in voice model was unloaded"));
        await worker.terminate();
      },
    };
    worker.on("message", (message: { type?: string; id?: number; samples?: Float32Array; error?: string }) => {
      if (message.type === "ready") {
        ready = true;
        resolve(model);
      } else if (message.type === "failed") {
        stop(new Error(message.error ?? "The built-in voice model failed to load"));
        void worker.terminate();
        reject(stopped);
      } else if (typeof message.id === "number") {
        const waiting = pending.get(message.id);
        pending.delete(message.id);
        if (message.samples) waiting?.resolve(message.samples);
        else waiting?.reject(new Error(message.error ?? "The built-in voice model could not say that"));
      }
    });
    worker.on("error", (error) => {
      stop(error);
      reject(error);
    });
    worker.on("exit", (code) => {
      const error = new Error(`The built-in voice model stopped (exit code ${code})`);
      stop(error);
      reject(error);
    });
  });
}

const DEFAULT_SETTINGS: BuiltinTtsSettings = { language: "auto", latinLanguage: "en" };

interface StoredSettings {
  activeModelId: BuiltinTtsModelId | null;
  blends: BuiltinTtsBlend[];
  settings: BuiltinTtsSettings;
}

class BuiltinTtsService {
  private model: LoadedModel | null = null;
  private loading: Promise<LoadedModel> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private inFlight = 0;
  private error: string | null = null;
  private download: BuiltinTtsStatus["download"] = null;
  private downloadAbort: AbortController | null = null;
  private stored: StoredSettings;

  constructor() {
    this.stored = this.readSettings();
  }

  isSupported(): boolean {
    if (isLite()) return false;
    const binding = resolveOnnxRuntimeBindingPath();
    return binding !== null && existsSync(binding);
  }

  /** The model in use: the chosen one while installed, else any installed one. */
  getActiveModel(): BuiltinTtsModelId | null {
    const chosen = this.stored.activeModelId;
    if (chosen && isInstalled(chosen)) return chosen;
    return BUILTIN_TTS_MODELS.find((model) => isInstalled(model.id))?.id ?? null;
  }

  isDownloaded(): boolean {
    return this.getActiveModel() !== null;
  }

  getStatus(): BuiltinTtsStatus {
    return {
      supported: this.isSupported(),
      models: BUILTIN_TTS_MODELS,
      installed: BUILTIN_TTS_MODELS.filter((model) => isInstalled(model.id)).map((model) => model.id),
      activeModelId: this.getActiveModel(),
      loaded: this.model !== null,
      loading: this.loading !== null,
      error: this.error,
      download: this.download,
      voices: BUILTIN_TTS_VOICES,
      blends: this.stored.blends,
      settings: this.stored.settings,
    };
  }

  /**
   * Starts the download in the background; /status shows progress. It becomes the model
   * in use when none is, or when `use` says the person picked it.
   */
  startDownload(id: BuiltinTtsModelId, options: { use?: boolean } = {}): void {
    if (!this.isSupported()) throw new Error("The built-in voice model cannot run on this machine.");
    if (this.downloadAbort) throw new Error("A built-in voice model is already downloading.");
    const info = modelInfo(id);
    const files = modelFiles(id);
    const abort = new AbortController();
    this.downloadAbort = abort;
    this.error = null;
    let done = files.filter((file) => hasFile(id, file)).reduce((sum, file) => sum + file.bytes, 0);
    const report = (downloaded: number, speed = 0) => {
      this.download = {
        modelId: id,
        phase: "model",
        status: "downloading",
        downloaded,
        total: info.downloadBytes,
        speed,
        label: info.label,
      };
    };
    report(done);
    void (async () => {
      for (const file of files) {
        if (hasFile(id, file)) continue;
        await retry(
          () =>
            downloadFileWithProgress({
              url: `https://huggingface.co/${info.repo}/resolve/${info.revision}/${file.path}`,
              destPath: join(modelDir(id), file.path),
              signal: abort.signal,
              expectedBytes: file.bytes,
              expectedSha256: file.sha256,
              progress: { phase: "model", label: file.path },
              onProgress: (progress) => report(done + Math.min(progress.downloaded, file.bytes), progress.speed),
            }),
          { retries: 3, baseDelayMs: 1_000, shouldRetry: (error) => !isAbortError(error) },
        );
        done += file.bytes;
        report(done);
      }
      if (options.use || !this.stored.activeModelId || !isInstalled(this.stored.activeModelId)) {
        await this.useModel(id);
      }
    })()
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          this.error = error instanceof Error ? error.message : String(error);
          logger.warn(error, "[builtin-tts] Download failed");
        }
      })
      .finally(() => {
        this.download = null;
        this.downloadAbort = null;
      });
  }

  cancelDownload(): void {
    this.downloadAbort?.abort();
  }

  /** Makes an installed model the one the Voice job speaks with. */
  async useModel(id: BuiltinTtsModelId): Promise<void> {
    if (!isInstalled(id)) throw new Error(`${modelInfo(id).label} is not downloaded.`);
    if (this.model && this.model.id !== id) await this.unload();
    this.stored = { ...this.stored, activeModelId: id };
    this.writeSettings();
  }

  setSettings(settings: Partial<BuiltinTtsSettings>): void {
    const next = { ...this.stored.settings, ...settings };
    if (next.language !== "auto" && !(BUILTIN_TTS_SUPERTONIC_LANGUAGES as readonly string[]).includes(next.language)) {
      throw new Error(`Supertonic does not read "${next.language}".`);
    }
    if (!(BUILTIN_TTS_LATIN_LANGUAGES as readonly string[]).includes(next.latinLanguage)) {
      throw new Error(`"${next.latinLanguage}" is not a Latin-script language Supertonic reads.`);
    }
    this.stored = { ...this.stored, settings: next };
    this.writeSettings();
  }

  /** Loads the model in use now (it also loads by itself on the first line it speaks). */
  async ensureLoaded(): Promise<LoadedModel> {
    const id = this.getActiveModel();
    if (!id) throw new Error("Download a built-in voice model in Connections first.");
    if (this.model?.id === id) return this.model;
    if (this.loading) {
      const loaded = await this.loading;
      if (loaded.id === id) return loaded;
    }
    if (this.model) await this.unload();
    this.error = null;
    this.loading = startWorker(id, (error) => {
      this.model = null;
      this.error = error.message;
    })
      .then((model) => {
        this.model = model;
        this.armIdle();
        return model;
      })
      .catch((error: unknown) => {
        this.error = error instanceof Error ? error.message : String(error);
        throw error;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /**
   * Speaks the text and returns WAV audio. A voice of the other model (saved before the model changed) speaks with
   * the model in use's default voice instead of failing.
   */
  async speak(text: string, voice: string, speed = 1): Promise<Buffer> {
    const id = this.getActiveModel();
    if (!id) throw new Error("Download a built-in voice model in Connections first.");
    const spec =
      normalizeBuiltinTtsVoice(voice, id) ?? (builtinTtsVoiceModel(voice) ? BUILTIN_TTS_DEFAULT_VOICE[id] : null);
    if (!spec) throw new Error(`The built-in voice model has no voice "${voice}".`);
    const pace = Number.isFinite(speed) ? Math.max(0.5, Math.min(2, speed)) : 1;
    this.inFlight += 1;
    try {
      const model = await this.ensureLoaded();
      const samples = await model.speak({
        text,
        voice: spec,
        speed: pace,
        language: this.stored.settings.language,
        latinLanguage: this.stored.settings.latinLanguage,
      });
      return toWav(samples, modelInfo(model.id).sampleRate);
    } finally {
      this.inFlight -= 1;
      this.armIdle();
    }
  }

  async unload(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    await this.loading?.catch(() => undefined);
    const model = this.model;
    this.model = null;
    await model?.dispose();
  }

  async remove(id: BuiltinTtsModelId): Promise<void> {
    if (this.download?.modelId === id) this.cancelDownload();
    if (this.model?.id === id) await this.unload();
    rmSync(join(ROOT_DIR, id), { recursive: true, force: true });
    if (this.stored.activeModelId === id) {
      this.stored = { ...this.stored, activeModelId: this.getActiveModel() };
      this.writeSettings();
    }
    this.error = null;
  }

  saveBlend(name: string, voice: string): BuiltinTtsBlend {
    const model = builtinTtsVoiceModel(voice);
    const spec = model ? normalizeBuiltinTtsVoice(voice, model) : null;
    if (!model || !spec || !spec.includes("+")) throw new Error("A blend mixes two or more voices of one model.");
    const label = name.trim().slice(0, 60);
    if (!label) throw new Error("Give the blend a name.");
    const blend = { id: spec, name: label, model };
    this.stored = {
      ...this.stored,
      blends: [blend, ...this.stored.blends.filter((entry) => entry.id !== spec)].slice(0, MAX_BLENDS),
    };
    this.writeSettings();
    return blend;
  }

  deleteBlend(voice: string): void {
    this.stored = { ...this.stored, blends: this.stored.blends.filter((entry) => entry.id !== voice) };
    this.writeSettings();
  }

  private armIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (!this.model || this.inFlight > 0) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.inFlight === 0) void this.unload();
    }, BUILTIN_TTS_IDLE_MS);
    this.idleTimer.unref?.();
  }

  private readSettings(): StoredSettings {
    try {
      const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Partial<Record<keyof StoredSettings, unknown>>;
      const blends = Array.isArray(raw.blends)
        ? (raw.blends as BuiltinTtsBlend[])
            .filter(
              (entry) =>
                !!entry &&
                typeof entry.name === "string" &&
                isModelId(entry.model) &&
                typeof entry.id === "string" &&
                normalizeBuiltinTtsVoice(entry.id, entry.model) === entry.id,
            )
            .slice(0, MAX_BLENDS)
        : [];
      const settings = { ...DEFAULT_SETTINGS, ...(raw.settings as Partial<BuiltinTtsSettings> | undefined) };
      return { activeModelId: isModelId(raw.activeModelId) ? raw.activeModelId : null, blends, settings };
    } catch {
      return { activeModelId: null, blends: [], settings: DEFAULT_SETTINGS };
    }
  }

  private writeSettings(): void {
    mkdirSync(ROOT_DIR, { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(this.stored, null, 2), "utf-8");
  }
}

export const builtinTtsService = new BuiltinTtsService();
