export type TextBlipMode = "off" | "default" | "custom";
export type CustomTextBlipSound = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type TextBlipSettings = {
  mode: TextBlipMode;
  customSound?: CustomTextBlipSound | null;
};

type TextBlipDriver = {
  now: () => number;
  playDefault: () => void;
  playCustom: (sound: CustomTextBlipSound) => void;
};

type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const TEXT_BLIP_MIN_INTERVAL_MS = 55;
const CUSTOM_TEXT_BLIP_SOUND_MAX_BYTES = 512 * 1024;
export const CUSTOM_TEXT_BLIP_SOUND_ACCEPT = "audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac,.flac";

const SUPPORTED_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "webm", "m4a", "aac", "flac"]);

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const windowWithAudio = window as WindowWithWebkitAudioContext;
  const AudioContextClass = window.AudioContext ?? windowWithAudio.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playDefaultTextBlip() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1180, now);
  oscillator.frequency.exponentialRampToValueAtTime(940, now + 0.035);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.018, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.05);
}

function playCustomTextBlip(sound: CustomTextBlipSound) {
  if (!sound.dataUrl || typeof Audio === "undefined") return;
  const audio = new Audio(sound.dataUrl);
  audio.preload = "auto";
  audio.volume = 0.45;
  void audio.play().catch(() => {});
}

const defaultDriver: TextBlipDriver = {
  now: () => performance.now(),
  playDefault: playDefaultTextBlip,
  playCustom: playCustomTextBlip,
};

export function normalizeCustomTextBlipSound(value: unknown): CustomTextBlipSound | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.dataUrl !== "string" || !raw.dataUrl.startsWith("data:audio/")) return null;
  const size = typeof raw.size === "number" && Number.isFinite(raw.size) ? Math.round(raw.size) : 0;
  if (size < 0 || size > CUSTOM_TEXT_BLIP_SOUND_MAX_BYTES) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 160) : "Custom blip";
  const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim().slice(0, 80) : "audio/*";
  return { name, type, size, dataUrl: raw.dataUrl };
}

export function validateCustomTextBlipSoundFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!file.type.startsWith("audio/") && !SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return "Choose an audio file: MP3, WAV, OGG, WebM, M4A, AAC, or FLAC.";
  }
  if (file.size > CUSTOM_TEXT_BLIP_SOUND_MAX_BYTES) {
    return "Choose an audio file smaller than 512 KB.";
  }
  return null;
}

function createTextBlipPlayer(driver: TextBlipDriver = defaultDriver) {
  let lastPlayedAt = -Infinity;

  return {
    play(settings: TextBlipSettings) {
      if (settings.mode === "off") return;
      if (settings.mode === "custom") {
        const customSound = settings.customSound?.dataUrl ? settings.customSound : null;
        if (!customSound) return;
        const now = driver.now();
        if (now - lastPlayedAt < TEXT_BLIP_MIN_INTERVAL_MS) return;
        lastPlayedAt = now;

        try {
          driver.playCustom(customSound);
        } catch {
          // Browser audio can fail when blocked, interrupted, or unsupported.
        }
        return;
      }

      const now = driver.now();
      if (now - lastPlayedAt < TEXT_BLIP_MIN_INTERVAL_MS) return;
      lastPlayedAt = now;

      try {
        driver.playDefault();
      } catch {
        // Browser audio can fail when blocked, interrupted, or unsupported.
      }
    },
  };
}

const sharedTextBlipPlayer = createTextBlipPlayer();

export function playTextBlip(settings: TextBlipSettings) {
  sharedTextBlipPlayer.play(settings);
}
