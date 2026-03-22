// ──────────────────────────────────────────────
// Notification Sound — Synthesized ping via Web Audio API
// ──────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Play a short, pleasant notification ping.
 * Uses two layered sine oscillators with a quick exponential decay
 * to produce a soft "ding" reminiscent of Discord/iMessage notifications.
 */
export function playNotificationPing(): void {
  try {
    const ctx = getAudioContext();
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
  } catch {
    // Silently ignore — audio may not be available
  }
}
