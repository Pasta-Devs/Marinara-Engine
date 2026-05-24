// ──────────────────────────────────────────────
// Streaming TTS Hook
// ──────────────────────────────────────────────
//
// Watches the chat store's per-chat stream buffer and dispatches
// sentence-by-sentence TTS while the LLM is still generating. Audio chunks
// are fetched in parallel as sentences complete, but played sequentially
// to preserve order. Drastically reduces time-to-first-audio compared to
// the existing "wait until streaming ends" autoplay path.

import { useEffect, useRef } from "react";
import type { TTSConfig } from "@marinara-engine/shared";
import { useChatStore } from "../stores/chat.store";
import { ttsService } from "../lib/tts-service";
import { buildTTSVoiceRequests } from "../lib/tts-dialogue";
import {
  createChunkerState,
  extractNewSentences,
  extractRemainder,
} from "../lib/sentence-chunker";

interface UseStreamingTTSOptions {
  enabled: boolean;
  chatId: string | null;
  ttsConfig: TTSConfig | undefined;
  fallbackSpeaker?: string | null;
  fallbackCharacterId?: string | null;
  resolveCharacterIdForSpeaker?: (speaker?: string | null) => string | null | undefined;
}

// Module-level handle so any UI can stop the currently active streaming-TTS
// session (e.g. a per-message speaker icon, a global "stop audio" button,
// or an Escape keybinding). The hook registers/clears its stop function
// here as sessions start/end.
let activeStopHandler: (() => void) | null = null;
const activeListeners = new Set<(active: boolean) => void>();

function notifyActiveChange(): void {
  const active = activeStopHandler !== null;
  for (const fn of activeListeners) {
    try {
      fn(active);
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Stop any in-progress streaming-TTS session. Safe to call even when no
 *  session is active (no-op). */
export function stopStreamingTTS(): void {
  activeStopHandler?.();
}

/** Whether a streaming-TTS session is currently active (audio queued or playing). */
export function isStreamingTTSActive(): boolean {
  return activeStopHandler !== null;
}

/** Subscribe to streaming-TTS active-state changes. Returns an unsubscribe
 *  function. The listener is fired with the new active state each time a
 *  session starts or stops. */
export function subscribeStreamingTTSActive(fn: (active: boolean) => void): () => void {
  activeListeners.add(fn);
  return () => {
    activeListeners.delete(fn);
  };
}

interface StreamSession {
  chatId: string;
  chunker: ReturnType<typeof createChunkerState>;
  /** Sequential playback chain — each pushed sentence chains onto this. */
  chain: Promise<void>;
  /** Our local AbortController — fired on stopSession() to cancel in-flight fetches. */
  abort: AbortController;
  /** Snapshot of the chat's AbortSignal so we can distinguish user-cancel
   *  from natural stream completion when isStreaming flips to false. */
  externalSignal: AbortSignal | null;
  /** Listener registered on externalSignal so we tear down audio the moment
   *  the user clicks Stop, without waiting for isStreaming to flip. */
  externalAbortListener: (() => void) | null;
  /** Object URLs we created so we can revoke them on stop. */
  objectUrls: Set<string>;
  /** Audio elements we created so we can pause them on stop. */
  audios: Set<HTMLAudioElement>;
}

export function useStreamingTTS({
  enabled,
  chatId,
  ttsConfig,
  fallbackSpeaker,
  fallbackCharacterId,
  resolveCharacterIdForSpeaker,
}: UseStreamingTTSOptions): void {
  const sessionRef = useRef<StreamSession | null>(null);
  const isStreamingRef = useRef(false);

  const cfgRef = useRef(ttsConfig);
  cfgRef.current = ttsConfig;
  const fallbackSpeakerRef = useRef(fallbackSpeaker);
  fallbackSpeakerRef.current = fallbackSpeaker;
  const fallbackCharacterIdRef = useRef(fallbackCharacterId);
  fallbackCharacterIdRef.current = fallbackCharacterId;
  const resolveRef = useRef(resolveCharacterIdForSpeaker);
  resolveRef.current = resolveCharacterIdForSpeaker;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Stop the current session: abort in-flight fetches, pause and detach our
  // audio elements, revoke our object URLs. Deliberately does NOT touch the
  // global ttsService — per-message play buttons elsewhere may be using it.
  const stopSession = (): void => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    if (activeStopHandler === stopSession) {
      activeStopHandler = null;
      notifyActiveChange();
    }
    if (session.externalSignal && session.externalAbortListener) {
      session.externalSignal.removeEventListener("abort", session.externalAbortListener);
    }
    session.abort.abort();
    for (const audio of session.audios) {
      try {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.src = "";
      } catch {
        /* ignore */
      }
    }
    session.audios.clear();
    for (const url of session.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    session.objectUrls.clear();
  };

  // Push one or more sentences into the active session's playback chain.
  const pushText = (text: string): void => {
    const session = sessionRef.current;
    const cfg = cfgRef.current;
    if (!session || !cfg || !text.trim()) return;

    const requests = buildTTSVoiceRequests(
      text,
      cfg,
      fallbackSpeakerRef.current ?? undefined,
      fallbackCharacterIdRef.current ?? undefined,
      resolveRef.current,
    ).filter((r) => r.text.trim().length > 0);

    for (const req of requests) {
      // Kick the fetch immediately so multiple sentences fetch in parallel.
      const fetchPromise = ttsService
        .generateAudio(req.text, {
          speaker: req.speaker,
          tone: req.tone,
          voice: req.voice,
          signal: session.abort.signal,
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return null;
          console.warn("[streaming-tts] fetch failed:", err);
          return null;
        });

      session.chain = session.chain.then(async () => {
        if (sessionRef.current !== session) return;
        const blob = await fetchPromise;
        if (!blob || sessionRef.current !== session) return;

        const objectUrl = URL.createObjectURL(blob);
        session.objectUrls.add(objectUrl);

        const audio = new Audio(objectUrl);
        // Apply playback rate client-side — most local TTS servers ignore the
        // `speed` request param (it's an OpenAI extension), so doing this on
        // the HTMLAudioElement makes the slider work uniformly across
        // providers without re-synthesis. Pitch is preserved by default.
        const playbackRate = cfgRef.current?.speed ?? 1;
        if (playbackRate > 0 && playbackRate !== 1) audio.playbackRate = playbackRate;
        session.audios.add(audio);

        // Set up a single, removable abort listener — bounded by the
        // playback lifetime of THIS audio element. Without this guard, every
        // sentence would attach a listener to the session AbortSignal that
        // never gets cleaned up, accumulating as memory pressure for long
        // replies (50+ listeners on a single signal for a long roleplay
        // reply).
        let onAbort: (() => void) | null = null;
        try {
          await audio.play();
        } catch (err) {
          if (sessionRef.current === session) {
            console.warn("[streaming-tts] play() rejected:", err);
          }
          // Clean up the orphaned URL/audio even on rejection.
          session.audios.delete(audio);
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            /* ignore */
          }
          session.objectUrls.delete(objectUrl);
          return;
        }

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            if (onAbort) session.abort.signal.removeEventListener("abort", onAbort);
            audio.onended = null;
            audio.onerror = null;
            resolve();
          };
          audio.onended = cleanup;
          audio.onerror = cleanup;
          onAbort = () => {
            try {
              audio.pause();
            } catch {
              /* ignore */
            }
            cleanup();
          };
          if (session.abort.signal.aborted) {
            onAbort();
          } else {
            session.abort.signal.addEventListener("abort", onAbort, { once: true });
          }
        });

        session.audios.delete(audio);
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
        session.objectUrls.delete(objectUrl);
      });
    }
  };

  useEffect(() => {
    // Subscribe to every chat-store change. Cheap filtering inside ensures we
    // only act on the relevant transitions for this chat. Using the un-typed
    // subscribe form because the per-chat stream buffer lives in a Map whose
    // reference is replaced on each token append in chat.store.ts.
    const unsubscribe = useChatStore.subscribe((state) => {
      // Track "is THIS chat currently streaming". When a stream ends,
      // chat.store sets isStreaming=false AND streamingChatId=null in the
      // same update — if we early-returned on the streamingChatId mismatch
      // before updating isStreamingRef, the ref would stay stuck at `true`
      // and the NEXT stream's rising-edge check would fail (wasStreaming=
      // true, isStreaming=true → no session start). Update the ref FIRST,
      // unconditionally, so it always reflects reality.
      const isStreaming = state.isStreaming && state.streamingChatId === chatId;
      const wasStreaming = isStreamingRef.current;
      isStreamingRef.current = isStreaming;

      if (!enabledRef.current) return;
      if (!chatId) return;

      const buffer = state.streamBuffers.get(chatId) ?? state.streamBuffer ?? "";

      // Start session on rising edge of isStreaming for this chat. Prime the
      // chunker cursor to the current buffer length so that if we joined an
      // already-running stream (chat switch into a streaming chat), we only
      // TTS new content from this point on — not the backlog.
      if (isStreaming && !wasStreaming) {
        stopSession();
        const externalCtrl = state.abortControllers.get(chatId) ?? null;
        const chunker = createChunkerState();
        // Skip any pre-existing buffer content as backlog. We intentionally
        // do NOT set highWaterMark here — it must start at 0 so the natural
        // emission flow can grow it. Setting it to buffer.length at session
        // start breaks regenerate: setStreaming(true) fires before
        // clearStreamBuffer(), so the buffer still holds the previous reply
        // — anchoring the hwm there would block emission until the new
        // reply exceeds the old reply's length.
        chunker.cursor = buffer.length;
        const session: StreamSession = {
          chatId,
          chunker,
          chain: Promise.resolve(),
          abort: new AbortController(),
          externalSignal: externalCtrl?.signal ?? null,
          externalAbortListener: null,
          objectUrls: new Set(),
          audios: new Set(),
        };
        sessionRef.current = session;
        // Expose this session's stop function so any UI element can call
        // `stopStreamingTTS()` to halt playback (the chat's generation-
        // abort path only fires WHILE the LLM is streaming; after natural
        // completion, queued audio keeps playing with no way to interrupt
        // unless a UI surface targets this handler).
        activeStopHandler = stopSession;
        notifyActiveChange();
        // Tear down audio the instant the user clicks Stop, rather than
        // waiting for isStreaming to flip (which can lag several hundred ms
        // behind the abort while the server roundtrip + use-generate's
        // finally block run). Without this, audio keeps playing after Stop.
        if (session.externalSignal && !session.externalSignal.aborted) {
          const listener = () => {
            if (sessionRef.current === session) stopSession();
          };
          session.externalAbortListener = listener;
          session.externalSignal.addEventListener("abort", listener, { once: true });
        }
      }

      // End of stream — distinguish user-cancel from natural completion.
      // If the chat's AbortController fired, the user clicked Stop; drop the
      // partial last sentence on the floor and tear the session down.
      if (!isStreaming && wasStreaming) {
        const session = sessionRef.current;
        if (!session) return;
        const wasCancelled = session.externalSignal?.aborted === true;
        if (wasCancelled) {
          stopSession();
        } else {
          const tail = extractRemainder(buffer, session.chunker);
          if (tail) pushText(tail);
          // Once the queued audio finishes draining, clear the active-stop
          // handle so UI elements (speaker icons) flip back from "stop" to
          // "play". Without this, the icons stay stuck in stop-state after
          // natural completion until a new stream begins.
          session.chain = session.chain.then(() => {
            if (sessionRef.current !== session) return;
            sessionRef.current = null;
            if (activeStopHandler === stopSession) {
              activeStopHandler = null;
              notifyActiveChange();
            }
          });
        }
        return;
      }

      // Mid-stream: emit any newly-completed sentences.
      if (isStreaming) {
        const session = sessionRef.current;
        if (!session) return;
        const newSentences = extractNewSentences(buffer, session.chunker);
        if (newSentences) pushText(newSentences);
      }
    });

    return () => {
      unsubscribe();
      stopSession();
    };
    // `stopSession` / `pushText` are intentionally not in the deps — they are
    // closures over per-render refs and stable singletons. Adding them would
    // re-subscribe to the chat store on every render, defeating the point of
    // keying the subscription to chatId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);
}
