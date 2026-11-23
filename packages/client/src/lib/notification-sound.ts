// ──────────────────────────────────────────────
// Notification Sound — Synthesized ping via Web Audio API
// ──────────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let customNotificationSoundUrl: string | null = null;

type NotificationPingOptions = {
  onlyWhenUnfocused?: boolean;
};

export function isMarinaraFocused(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible" && document.hasFocus();
}

export function shouldPlayNotificationPing(options: NotificationPingOptions = {}): boolean {
  return !options.onlyWhenUnfocused || !isMarinaraFocused();
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextCtor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioCtx = new AudioContextCtor();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function setCustomNotificationSoundUrl(url: string | null): void {
  customNotificationSoundUrl = url;
}

function playSynthesizedNotificationPing(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Main tone — a bright sine at ~880 Hz (A5)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);

  // Harmonic — softer sine at ~1320 Hz for shimmer
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1320, now);
  osc2.frequency.exponentialRampToValueAtTime(990, now + 0.12);

  // Gain envelope — quick attack, smooth decay
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.15, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc1.connect(gain1).connect(ctx.destination);
  osc2.connect(gain2).connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.25);
  osc2.start(now);
  osc2.stop(now + 0.2);
}

/** How long a custom sound may take to start before the default ping plays instead. */
export const CUSTOM_SOUND_START_TIMEOUT_MS = 4_000;

function playCustomNotificationSound(url: string): void {
  const audio = new Audio(url);
  audio.preload = "auto";
  let settled = false;
  // A server that stops answering leaves the request open with no error, which
  // would otherwise mean no sound at all; after the deadline the default ping plays.
  const timer = window.setTimeout(() => {
    if (settled) return;
    audio.removeAttribute("src");
    audio.load();
    playFallback();
  }, CUSTOM_SOUND_START_TIMEOUT_MS);
  function playFallback() {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    playSynthesizedNotificationPing();
  }
  audio.addEventListener(
    "playing",
    () => {
      settled = true;
      window.clearTimeout(timer);
    },
    { once: true },
  );
  audio.addEventListener("error", playFallback, { once: true });
  void audio.play().catch(playFallback);
}

/**
 * Play a short, pleasant notification ping.
 * Uses the server-owned custom sound when configured and falls back to the
 * synthesized ping if the browser cannot play it.
 */
export function playNotificationPing(options: NotificationPingOptions = {}): void {
  try {
    if (!shouldPlayNotificationPing(options)) return;
    if (customNotificationSoundUrl) {
      playCustomNotificationSound(customNotificationSoundUrl);
    } else {
      playSynthesizedNotificationPing();
    }
  } catch {
    // Silently ignore — audio may not be available
  }
}

export function playConfiguredNotificationPing(enabled: boolean, onlyWhenUnfocused: boolean): void {
  if (!enabled) return;
  playNotificationPing({ onlyWhenUnfocused });
}
