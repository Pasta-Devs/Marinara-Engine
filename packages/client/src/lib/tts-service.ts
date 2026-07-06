// ──────────────────────────────────────────────
// TTS Service — Server-proxied audio playback
// ──────────────────────────────────────────────
import { getOrCreateCachedTTSAudioBlob } from "./tts-audio-cache";

export type TTSState = "idle" | "loading" | "playing" | "paused" | "error";

type StateListener = (state: TTSState, activeId: string | null) => void;

export interface TTSSpeakOptions {
  speaker?: string;
  tone?: string;
  voice?: string;
  signal?: AbortSignal;
  throwOnError?: boolean;
  cacheKey?: string;
  cacheAliases?: string[];
  volume?: number;
  muted?: boolean;
}

export interface TTSSpeakRequest {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
  cacheKey?: string;
  cacheAliases?: string[];
  activeId?: string | null;
}

export interface TTSSpeakSequenceOptions extends Pick<TTSSpeakOptions, "signal" | "throwOnError" | "volume" | "muted"> {
  progressive?: boolean;
  onChunkStart?: (request: TTSSpeakRequest, index: number) => void;
  onChunkEnd?: (request: TTSSpeakRequest, index: number) => void;
}

function clampPlaybackVolume(volume: number | undefined): number {
  if (typeof volume !== "number" || !Number.isFinite(volume)) return 1;
  return Math.max(0, Math.min(1, volume));
}

function waitForBlobWithAbort(promise: Promise<Blob>, signal?: AbortSignal): Promise<Blob> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("TTS request aborted", "AbortError"));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("TTS request aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (blob) => {
        signal.removeEventListener("abort", onAbort);
        resolve(blob);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

class TTSService {
  private audio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private state: TTSState = "idle";
  private lastError: string | null = null;
  private sequence = 0;
  /** ID of the entity (e.g. message id) currently being spoken */
  private activeId: string | null = null;
  private listeners = new Set<StateListener>();

  // ── Listeners ─────────────────────────────────

  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): TTSState {
    return this.state;
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private setState(s: TTSState, id: string | null = this.activeId) {
    this.state = s;
    this.activeId = s === "idle" || s === "error" ? null : id;
    this.listeners.forEach((fn) => fn(this.state, this.activeId));
  }

  private async readError(res: Response): Promise<string> {
    const fallback = `TTS request failed (${res.status})`;
    const raw = await res.text().catch(() => "");
    if (!raw.trim()) return fallback;

    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const error = typeof data.error === "string" ? data.error : "";
      const detail = typeof data.detail === "string" ? data.detail : "";
      const message = typeof data.message === "string" ? data.message : "";
      return [error || message || fallback, detail].filter(Boolean).join(": ");
    } catch {
      return `${fallback}: ${raw.slice(0, 500)}`;
    }
  }

  private isCurrentSequence(sequence: number): boolean {
    return this.sequence === sequence;
  }

  // ── Playback ──────────────────────────────────

  private applyPlaybackOptions(audio: HTMLAudioElement, options: Pick<TTSSpeakOptions, "volume" | "muted">): void {
    const volume = clampPlaybackVolume(options.volume);
    audio.volume = volume;
    audio.muted = options.muted === true || volume <= 0;
  }

  setCurrentPlaybackVolume(volume: number, muted = false): void {
    if (!this.audio) return;
    this.applyPlaybackOptions(this.audio, { volume, muted });
  }

  async generateAudio(text: string, options: TTSSpeakOptions = {}): Promise<Blob> {
    const res = await fetch("/api/tts/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...(options.speaker ? { speaker: options.speaker } : {}),
        ...(options.tone ? { tone: options.tone } : {}),
        ...(options.voice ? { voice: options.voice } : {}),
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      throw new Error(await this.readError(res));
    }

    return res.blob();
  }

  private async getAudioBlob(text: string, options: TTSSpeakOptions = {}): Promise<Blob> {
    if (!options.cacheKey) return this.generateAudio(text, options);
    const sharedPromise = getOrCreateCachedTTSAudioBlob(
      options.cacheKey,
      () => this.generateAudio(text, { ...options, signal: undefined }),
      options.cacheAliases,
    );
    return waitForBlobWithAbort(sharedPromise, options.signal);
  }

  /** Speak the given text. `id` is an optional caller-supplied key (e.g. message id) so callers can track which item is active. */
  async speak(text: string, id?: string, options: TTSSpeakOptions = {}): Promise<void> {
    this.stop();
    const sequence = ++this.sequence;
    this.lastError = null;

    this.setState("loading", id ?? null);
    const abortController = new AbortController();
    this.abortController = abortController;

    let blob: Blob;
    try {
      blob = await this.getAudioBlob(text, { ...options, signal: abortController.signal });
    } catch (err) {
      if (!this.isCurrentSequence(sequence)) return;
      if (err instanceof Error && err.name === "AbortError") {
        this.setState("idle");
        return;
      }
      const error = err instanceof Error ? err : new Error("TTS request failed");
      this.lastError = error.message;
      this.setState("error");
      if (options.throwOnError) throw error;
      return;
    }

    if (!this.isCurrentSequence(sequence)) return;
    if (this.abortController === abortController) {
      this.abortController = null;
    }

    const objectUrl = URL.createObjectURL(blob);
    if (!this.isCurrentSequence(sequence)) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    this.currentObjectUrl = objectUrl;

    const audio = new Audio(objectUrl);
    this.applyPlaybackOptions(audio, options);
    this.audio = audio;

    audio.onended = () => {
      if (!this.isCurrentSequence(sequence) || this.audio !== audio) return;
      this.cleanup();
      this.setState("idle");
    };
    audio.onerror = () => {
      if (!this.isCurrentSequence(sequence) || this.audio !== audio) return;
      this.cleanup();
      this.setState("error");
    };

    this.setState("playing", id ?? null);
    try {
      await audio.play();
    } catch (err) {
      if (!this.isCurrentSequence(sequence) || this.audio !== audio) return;
      this.cleanup();
      const error = err instanceof Error ? err : new Error("Browser blocked audio playback");
      this.lastError = error.message;
      this.setState("error");
      if (options.throwOnError) throw error;
    }
  }

  /**
   * Generate every request first, then play the resulting clips in order.
   * This keeps multi-speaker dialogue from starting until the whole spoken queue is ready.
   */
  async speakSequence(
    requests: TTSSpeakRequest[],
    id?: string,
    options: TTSSpeakSequenceOptions = {},
  ): Promise<void> {
    const playableRequests = requests.filter((request) => request.text.trim().length > 0);
    if (playableRequests.length === 0) return;

    this.stop();
    const sequence = ++this.sequence;
    this.lastError = null;

    this.setState("loading", id ?? null);
    const abortController = new AbortController();
    this.abortController = abortController;

    const abortFromCaller = () => abortController.abort();
    const detachAbortSignal = () => options.signal?.removeEventListener("abort", abortFromCaller);
    if (options.signal?.aborted) {
      abortController.abort();
    } else {
      options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    type ChunkResult =
      | { ok: true; blob: Blob; request: TTSSpeakRequest; index: number }
      | { ok: false; error: Error; request: TTSSpeakRequest; index: number };
    const toError = (err: unknown, fallback: string) => (err instanceof Error ? err : new Error(fallback));
    const isAbortError = (error: Error) => error.name === "AbortError";
    const fetchChunk = async (request: TTSSpeakRequest, index: number): Promise<ChunkResult> => {
      try {
        const blob = await this.getAudioBlob(request.text, {
          speaker: request.speaker,
          tone: request.tone,
          voice: request.voice,
          signal: abortController.signal,
          cacheKey: request.cacheKey,
          cacheAliases: request.cacheAliases,
        });
        return { ok: true, blob, request, index };
      } catch (err) {
        return { ok: false, error: toError(err, "TTS request failed"), request, index };
      }
    };

    const playBlob = async (blob: Blob, request: TTSSpeakRequest, index: number): Promise<void> => {
      if (!this.isCurrentSequence(sequence)) return;
      this.cleanup();

      const objectUrl = URL.createObjectURL(blob);
      if (!this.isCurrentSequence(sequence)) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      this.currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      this.applyPlaybackOptions(audio, options);
      this.audio = audio;
      const runChunkStart = () => {
        try {
          options.onChunkStart?.(request, index);
        } catch (err) {
          console.warn("[TTS] Chunk start callback failed:", err);
        }
      };
      const runChunkEnd = () => {
        try {
          options.onChunkEnd?.(request, index);
        } catch (err) {
          console.warn("[TTS] Chunk end callback failed:", err);
        }
      };

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          abortController.signal.removeEventListener("abort", onAbort);
          callback();
        };
        const onAbort = () => {
          try {
            audio.pause();
          } catch {
            /* ignore interrupted playback cleanup */
          }
          finish(resolve);
        };
        const fail = (error: Error) => {
          if (!this.isCurrentSequence(sequence) || this.audio !== audio) return;
          finish(() => {
            this.cleanup();
            this.lastError = error.message;
            this.setState("error");
            reject(error);
          });
        };

        abortController.signal.addEventListener("abort", onAbort, { once: true });
        audio.onended = () => {
          if (!this.isCurrentSequence(sequence) || this.audio !== audio) return;
          finish(() => {
            try {
              runChunkEnd();
            } finally {
              this.cleanup();
              resolve();
            }
          });
        };
        audio.onerror = () => {
          try {
            runChunkEnd();
          } finally {
            fail(new Error("Audio playback failed"));
          }
        };

        runChunkStart();
        this.setState("playing", request.activeId ?? id ?? null);
        void audio.play().catch((err) => fail(toError(err, "Browser blocked audio playback")));
      });
    };

    const handleFetchFailures = (errors: Error[]) => {
      if (errors.length === 0) return;
      const first = errors[0]!;
      this.lastError =
        errors.length === 1 ? first.message : `${errors.length} TTS chunks failed; first error: ${first.message}`;
      console.warn("[TTS] Skipped failed audio chunks:", errors);
    };

    if (options.progressive) {
      let nextFetch: Promise<ChunkResult> | null = fetchChunk(playableRequests[0]!, 0);
      let played = 0;
      const fetchErrors: Error[] = [];

      for (let index = 0; index < playableRequests.length; index += 1) {
        const result = await nextFetch!;
        nextFetch = index + 1 < playableRequests.length ? fetchChunk(playableRequests[index + 1]!, index + 1) : null;
        if (!this.isCurrentSequence(sequence)) return;

        if (!result.ok) {
          if (isAbortError(result.error)) {
            detachAbortSignal();
            this.setState("idle");
            return;
          }
          fetchErrors.push(result.error);
          continue;
        }

        try {
          await playBlob(result.blob, result.request, result.index);
          played += 1;
          if (nextFetch && this.isCurrentSequence(sequence)) {
            this.setState("loading", id ?? null);
          }
        } catch (err) {
          detachAbortSignal();
          if (options.throwOnError) throw err;
          return;
        }
      }

      detachAbortSignal();
      if (!this.isCurrentSequence(sequence)) return;
      if (this.abortController === abortController) {
        this.abortController = null;
      }
      handleFetchFailures(fetchErrors);
      if (played === 0 && fetchErrors.length > 0) {
        this.setState("error");
        if (options.throwOnError) throw fetchErrors[0];
        return;
      }
      this.setState("idle");
      return;
    }

    const results = await Promise.all(playableRequests.map((request, index) => fetchChunk(request, index)));
    detachAbortSignal();
    if (!this.isCurrentSequence(sequence)) return;
    if (this.abortController === abortController) {
      this.abortController = null;
    }

    if (results.some((result) => !result.ok && isAbortError(result.error))) {
      this.setState("idle");
      return;
    }

    const playableChunks = results.flatMap((result) => (result.ok ? [result] : []));
    const fetchErrors = results.flatMap((result) => (result.ok ? [] : [result.error]));
    handleFetchFailures(fetchErrors);
    if (playableChunks.length === 0) {
      const error = fetchErrors[0] ?? new Error("TTS request failed");
      this.lastError = error.message;
      this.setState("error");
      if (options.throwOnError) throw error;
      return;
    }

    for (const chunk of playableChunks) {
      try {
        await playBlob(chunk.blob, chunk.request, chunk.index);
      } catch (err) {
        if (options.throwOnError) throw err;
        return;
      }
      if (!this.isCurrentSequence(sequence)) return;
    }
    this.setState("idle");
  }

  /** Stop any in-progress fetch or playback. */
  stop(): void {
    this.sequence += 1;
    this.abortController?.abort();
    this.abortController = null;

    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio = null;
    }

    this.cleanup();
    this.lastError = null;
    this.setState("idle");
  }

  /** Pause the current generated audio without clearing it. */
  pause(): void {
    if (this.state !== "playing" || !this.audio) return;
    this.audio.pause();
    this.setState("paused");
  }

  /** Resume paused generated audio. */
  resume(): void {
    if (this.state !== "paused" || !this.audio) return;
    const audio = this.audio;
    this.setState("playing");
    void audio.play().catch((err) => {
      if (this.audio !== audio) return;
      this.cleanup();
      const error = err instanceof Error ? err : new Error("Browser blocked audio playback");
      this.lastError = error.message;
      this.setState("error");
    });
  }

  /** Restart the current generated audio from the beginning. */
  restart(): void {
    if (!this.audio || (this.state !== "playing" && this.state !== "paused")) return;
    const audio = this.audio;
    audio.currentTime = 0;
    this.setState("playing");
    void audio.play().catch((err) => {
      if (this.audio !== audio) return;
      this.cleanup();
      const error = err instanceof Error ? err : new Error("Browser blocked audio playback");
      this.lastError = error.message;
      this.setState("error");
    });
  }

  private cleanup(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }
}

export const ttsService = new TTSService();
