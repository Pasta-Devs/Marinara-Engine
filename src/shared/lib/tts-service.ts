// ──────────────────────────────────────────────
// TTS Service — Server-proxied audio playback
// ──────────────────────────────────────────────
import { ttsApi } from "../api/integration-utility-api";

export type TTSState = "idle" | "loading" | "playing" | "paused" | "error";

type StateListener = (state: TTSState, activeId: string | null) => void;

export interface TTSSpeakOptions {
  speaker?: string;
  tone?: string;
  voice?: string;
  signal?: AbortSignal;
  throwOnError?: boolean;
  playbackRate?: number;
}

export interface TTSSpeakRequest {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
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

  private isCurrentSequence(sequence: number): boolean {
    return this.sequence === sequence;
  }

  // ── Playback ──────────────────────────────────

  async generateAudio(text: string, options: TTSSpeakOptions = {}): Promise<Blob> {
    return ttsApi.speak(
      {
        text,
        ...(options.speaker ? { speaker: options.speaker } : {}),
        ...(options.tone ? { tone: options.tone } : {}),
        ...(options.voice ? { voice: options.voice } : {}),
      },
      options.signal,
    );
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
      blob = await this.generateAudio(text, { ...options, signal: abortController.signal });
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
    if (options.playbackRate && options.playbackRate > 0 && options.playbackRate !== 1) {
      audio.playbackRate = options.playbackRate;
    }
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

  async speakSequence(
    requests: TTSSpeakRequest[],
    id?: string,
    options: Pick<TTSSpeakOptions, "signal" | "throwOnError" | "playbackRate"> = {},
  ): Promise<void> {
    const playableRequests = requests.filter((request) => request.text.trim().length > 0);
    if (playableRequests.length === 0) return;

    this.stop();
    const sequence = ++this.sequence;
    this.lastError = null;
    this.setState("loading", id ?? null);

    const abortController = new AbortController();
    this.abortController = abortController;
    const externalAbort = () => abortController.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener("abort", externalAbort, { once: true });
      }
    }

    try {
      for (const request of playableRequests) {
        if (!this.isCurrentSequence(sequence)) return;
        if (abortController.signal.aborted) {
          this.setState("idle");
          return;
        }
        this.setState("loading", id ?? null);

        const blob = await this.generateAudio(request.text, {
          speaker: request.speaker,
          tone: request.tone,
          voice: request.voice,
          signal: abortController.signal,
        });
        if (!this.isCurrentSequence(sequence)) return;
        if (abortController.signal.aborted) {
          this.setState("idle");
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        if (!this.isCurrentSequence(sequence) || abortController.signal.aborted) {
          URL.revokeObjectURL(objectUrl);
          if (this.isCurrentSequence(sequence)) this.setState("idle");
          return;
        }

        this.cleanup();
        this.currentObjectUrl = objectUrl;
        const audio = new Audio(objectUrl);
        if (options.playbackRate && options.playbackRate > 0 && options.playbackRate !== 1) {
          audio.playbackRate = options.playbackRate;
        }
        this.audio = audio;
        this.setState("playing", id ?? null);

        const playbackResult = await new Promise<"ended" | "aborted">((resolve, reject) => {
          let onAbort: (() => void) | null = null;
          const cleanupListeners = () => {
            audio.onended = null;
            audio.onerror = null;
            if (onAbort) abortController.signal.removeEventListener("abort", onAbort);
          };
          audio.onended = () => {
            cleanupListeners();
            resolve("ended");
          };
          audio.onerror = () => {
            cleanupListeners();
            reject(new Error("TTS audio playback failed"));
          };
          onAbort = () => {
            audio.pause();
            cleanupListeners();
            resolve("aborted");
          };
          if (abortController.signal.aborted) {
            onAbort();
            return;
          }
          abortController.signal.addEventListener("abort", onAbort, { once: true });
          audio.play().catch((err: unknown) => {
            cleanupListeners();
            reject(err instanceof Error ? err : new Error("Browser blocked audio playback"));
          });
        });

        if (!this.isCurrentSequence(sequence)) return;
        if (playbackResult === "aborted") {
          this.cleanup();
          this.audio = null;
          this.setState("idle");
          return;
        }
        this.cleanup();
        this.audio = null;
      }

      if (this.isCurrentSequence(sequence)) {
        this.setState("idle");
      }
    } catch (err) {
      if (!this.isCurrentSequence(sequence)) return;
      if (err instanceof Error && err.name === "AbortError") {
        this.setState("idle");
        return;
      }
      const error = err instanceof Error ? err : new Error("TTS request failed");
      this.lastError = error.message;
      this.cleanup();
      this.audio = null;
      this.setState("error");
      if (options.throwOnError) throw error;
    } finally {
      if (options.signal) {
        options.signal.removeEventListener("abort", externalAbort);
      }
      if (this.abortController === abortController) {
        this.abortController = null;
      }
    }
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
