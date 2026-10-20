// ──────────────────────────────────────────────
// Avatar audio: voice loudness from text-to-speech playback (lane: TTS)
// ──────────────────────────────────────────────
// While text-to-speech reads a character's line, publish an AvatarAudioLevelSource for that character, and null
// when the voice pauses, stops, moves to another speaker or the chat changes. The character is the one the TTS
// voice lookup resolved for the line (TTSSpeakRequest.characterId). Lines read by the narrator or by a speaker
// who is not a chat character move no mouth. A reading moves avatars only in the chat it was requested in
// (TTSSpeakOptions.chatId), whichever chat is open when the clip starts playing; a reading with no chat moves none.
// The level is the clip's loudness track (voice-envelope.ts) read at the playback element's current time, and the
// line is the clip's text with how far through it the voice is, so moods can follow the voice. The
// element is never connected to Web Audio, so playback and the Safari/iOS autoplay handling in lib/tts-service.ts
// stay as they are. The director subscribes; nothing else does.
import type { AvatarAudioLevelSource, AvatarAudioListener } from "../contract";
import { ttsService, type TTSPlayback } from "../../../lib/tts-service";
import { useChatStore } from "../../../stores/chat.store";
import { decodeVoiceEnvelope, voiceLevelAt, voiceVisemeAt, type VoiceEnvelope } from "./voice-envelope";
import { createSpeechClock, SPEECH_CLOCK } from "../director/speech-clock";
import { cleanTTSInputText } from "../../../lib/tts-dialogue";

const listeners = new Set<AvatarAudioListener>();
/** Loudness tracks by clip: "pending" while decoding, null when the clip cannot be decoded. */
const envelopes = new WeakMap<Blob, VoiceEnvelope | null | "pending">();
let published: AvatarAudioLevelSource | null = null;
let stopWatching: (() => void) | null = null;
let gamePlayback: TTSPlayback | null = null;
let stopGameEvents: (() => void) | null = null;

function envelopeFor(blob: Blob): VoiceEnvelope | null | "pending" {
  const known = envelopes.get(blob);
  if (known !== undefined) return known;
  envelopes.set(blob, "pending");
  void decodeVoiceEnvelope(blob).then((envelope) => envelopes.set(blob, envelope));
  return "pending";
}

/** Game's cache can return a clip without synthesizing it again. Do no decoding without an avatar. */
export function prepareAvatarAudioBlob(blob: Blob): void {
  if (listeners.size > 0) envelopeFor(blob);
}

/** Game owns its audio elements. Observe them without replacing Game's playback handlers. */
export function setGameVoicePlayback(playback: TTSPlayback | null, expectedElement?: HTMLAudioElement): void {
  if (expectedElement && gamePlayback?.element !== expectedElement) return;
  stopGameEvents?.();
  stopGameEvents = null;
  gamePlayback = playback;
  if (playback) {
    const events = ["playing", "pause", "ended", "error"] as const;
    for (const event of events) playback.element.addEventListener(event, sync);
    stopGameEvents = () => {
      for (const event of events) playback.element.removeEventListener(event, sync);
    };
    prepareAvatarAudioBlob(playback.blob);
  }
  if (listeners.size > 0) sync();
}

function currentPlayback(): TTSPlayback | null {
  if (
    gamePlayback?.chatId === useChatStore.getState().activeChatId &&
    !gamePlayback.element.paused &&
    !gamePlayback.element.ended
  )
    return gamePlayback;
  return ttsService.getState() === "playing" ? ttsService.getPlayback() : null;
}

/** The character whose voice is playing for the open chat, or null. */
function speakingCharacter(playback: TTSPlayback | null): string | null {
  if (!playback?.chatId) return null;
  return playback.chatId === useChatStore.getState().activeChatId ? playback.characterId : null;
}

function createSource(ownerId: string): AvatarAudioLevelSource {
  let fallbackBlob: Blob | null = null;
  let fallbackAt = -1;
  let fallbackClock = createSpeechClock();
  const fallback = (playback: TTSPlayback) => {
    const at = playback.element.currentTime * 1000;
    if (fallbackBlob !== playback.blob || at < fallbackAt) {
      fallbackBlob = playback.blob;
      fallbackClock = createSpeechClock();
      fallbackClock.speakAll(cleanTTSInputText(playback.text), Infinity);
      fallbackClock.sample(0);
    }
    fallbackAt = at;
    return fallbackClock.sample(at);
  };
  /** Pending clips already play: their text bridges the short wait for a decoded envelope. */
  const current = () => {
    const playback = currentPlayback();
    if (published !== source || !playback || speakingCharacter(playback) !== ownerId) return null;
    const envelope = envelopeFor(playback.blob);
    return envelope ? { ...playback, envelope } : null;
  };
  const source: AvatarAudioLevelSource = {
    ownerId,
    level: () => {
      const clip = current();
      return clip
        ? clip.envelope === "pending"
          ? fallback(clip).open
          : voiceLevelAt(clip.envelope, clip.element.currentTime)
        : 0;
    },
    viseme: () => {
      const clip = current();
      return clip
        ? clip.envelope === "pending"
          ? fallback(clip).viseme
          : voiceVisemeAt(clip.envelope, clip.element.currentTime)
        : null;
    },
    // How far through the clip the voice is, by the decoded length (the element's duration can be Infinity).
    line: () => {
      const clip = current();
      const seconds = clip
        ? clip.envelope === "pending"
          ? Number.isFinite(clip.element.duration) && clip.element.duration > 0
            ? clip.element.duration
            : clip.text.length / SPEECH_CLOCK.charsPerSecond
          : clip.envelope.levels.length * clip.envelope.stepSeconds
        : 0;
      if (!clip || seconds <= 0) return null;
      return { text: clip.text, progress: Math.min(1, Math.max(0, clip.element.currentTime / seconds)) };
    },
    // A pending envelope uses text timing; a failed decode never leaves a mouth stuck open.
    isPlaying: () => {
      const clip = current();
      return clip !== null && !clip.element.paused && !clip.element.ended;
    },
  };
  return source;
}

function notify(listener: AvatarAudioListener, ownerId: string, source: AvatarAudioLevelSource | null): void {
  try {
    listener(ownerId, source);
  } catch (error) {
    console.warn("[Avatars] Audio listener failed:", error);
  }
}

function sync(): void {
  if (listeners.size === 0) return;
  const playback = currentPlayback();
  const ownerId = speakingCharacter(playback);
  if (ownerId && playback) envelopeFor(playback.blob);
  if (ownerId === (published?.ownerId ?? null)) return;
  const previous = published;
  published = ownerId ? createSource(ownerId) : null;
  for (const listener of [...listeners]) {
    if (previous) notify(listener, previous.ownerId, null);
    if (published) notify(listener, published.ownerId, published);
  }
}

/** Calls `listener` with a source when a character's voice starts and with null when it ends. */
export function subscribeAvatarAudio(listener: AvatarAudioListener): () => void {
  listeners.add(listener);
  if (stopWatching) {
    if (published) notify(listener, published.ownerId, published);
  } else {
    const stopTTS = ttsService.subscribe(sync);
    const stopBlobs = ttsService.subscribeBlobReady(prepareAvatarAudioBlob);
    const stopChat = useChatStore.subscribe((state) => state.activeChatId, sync);
    stopWatching = () => {
      stopTTS();
      stopBlobs();
      stopChat();
    };
    sync();
  }
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return;
    stopWatching?.();
    stopWatching = null;
    published = null;
  };
}
