type NotificationAudioContext = AudioContext & { state: AudioContextState | "interrupted" };

const NOTIFICATION_SOUND_IDS = ["refactor", "legacy-v1.6.1", "custom"] as const;
export type NotificationSoundId = (typeof NOTIFICATION_SOUND_IDS)[number];

export type CustomNotificationSound = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const DEFAULT_NOTIFICATION_SOUND_ID: NotificationSoundId = "refactor";
const CUSTOM_NOTIFICATION_SOUND_MAX_BYTES = 512 * 1024;
export const CUSTOM_NOTIFICATION_SOUND_ACCEPT = "audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac,.flac";

export const NOTIFICATION_SOUND_OPTIONS: Array<{
  id: NotificationSoundId;
  label: string;
  description: string;
}> = [
  {
    id: "refactor",
    label: "Refactor",
    description: "The current short Marinara ping.",
  },
  {
    id: "legacy-v1.6.1",
    label: "Legacy 1.6.1",
    description: "The softer two-tone ding from v1.6.1.",
  },
  {
    id: "custom",
    label: "Custom file",
    description: "Use a small local audio file.",
  },
];

const AUDIO_EXTENSION_MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
};

let notificationAudioContext: NotificationAudioContext | null = null;

function getNotificationAudioContext(): NotificationAudioContext | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = (window.AudioContext ?? audioWindow.webkitAudioContext) as
    | (new () => NotificationAudioContext)
    | undefined;
  if (!AudioContextClass) return null;
  if (
    !notificationAudioContext ||
    notificationAudioContext.state === "closed" ||
    notificationAudioContext.state === "interrupted"
  ) {
    notificationAudioContext = new AudioContextClass();
  }
  return notificationAudioContext;
}

function playRefactorPing() {
  const context = getNotificationAudioContext();
  if (!context) return;

  if (context.state === "suspended" || context.state === "interrupted") {
    void context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

function playLegacy161Ping() {
  const context = getNotificationAudioContext();
  if (!context) return;

  if (context.state === "suspended" || context.state === "interrupted") {
    void context.resume().catch(() => {});
  }

  const now = context.currentTime;
  const main = context.createOscillator();
  main.type = "sine";
  main.frequency.setValueAtTime(880, now);
  main.frequency.exponentialRampToValueAtTime(660, now + 0.15);

  const shimmer = context.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(1320, now);
  shimmer.frequency.exponentialRampToValueAtTime(990, now + 0.12);

  const mainGain = context.createGain();
  mainGain.gain.setValueAtTime(0.3, now);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  const shimmerGain = context.createGain();
  shimmerGain.gain.setValueAtTime(0.15, now);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  main.connect(mainGain).connect(context.destination);
  shimmer.connect(shimmerGain).connect(context.destination);

  main.start(now);
  main.stop(now + 0.25);
  shimmer.start(now);
  shimmer.stop(now + 0.2);
}

function playCustomNotificationSound(sound: CustomNotificationSound | null) {
  if (!sound?.dataUrl || typeof Audio === "undefined") {
    playRefactorPing();
    return;
  }

  const audio = new Audio(sound.dataUrl);
  audio.preload = "auto";
  audio.volume = 0.7;
  void audio.play().catch(() => {});
}

export function normalizeNotificationSoundId(value: unknown): NotificationSoundId {
  return NOTIFICATION_SOUND_IDS.includes(value as NotificationSoundId)
    ? (value as NotificationSoundId)
    : DEFAULT_NOTIFICATION_SOUND_ID;
}

export function normalizeCustomNotificationSound(value: unknown): CustomNotificationSound | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.dataUrl !== "string" || !raw.dataUrl.startsWith("data:audio/")) return null;
  const size = typeof raw.size === "number" && Number.isFinite(raw.size) ? Math.round(raw.size) : 0;
  if (size < 0 || size > CUSTOM_NOTIFICATION_SOUND_MAX_BYTES) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 160) : "Custom sound";
  const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim().slice(0, 80) : "audio/*";
  return {
    name,
    type,
    size,
    dataUrl: raw.dataUrl,
  };
}

export function getNotificationAudioMimeType(file: Pick<File, "name" | "type">): string | null {
  if (file.type.startsWith("audio/")) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSION_MIME_TYPES[extension] ?? null;
}

function isSupportedNotificationAudioFile(file: Pick<File, "name" | "type">): boolean {
  return getNotificationAudioMimeType(file) !== null;
}

export function coerceNotificationSoundDataUrlMime(dataUrl: string, type: string): string {
  if (dataUrl.startsWith("data:audio/")) return dataUrl;
  if (!type.startsWith("audio/")) return dataUrl;
  return dataUrl.replace(/^data:[^;,]*(?=[;,])/, `data:${type}`);
}

export function validateCustomNotificationSoundFile(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!isSupportedNotificationAudioFile(file)) {
    return "Choose an audio file: MP3, WAV, OGG, WebM, M4A, AAC, or FLAC.";
  }
  if (file.size > CUSTOM_NOTIFICATION_SOUND_MAX_BYTES) {
    return "Choose an audio file smaller than 512 KB.";
  }
  return null;
}

function getPlayableNotificationSoundId(
  soundId: NotificationSoundId,
  customSound: CustomNotificationSound | null,
): Exclude<NotificationSoundId, "custom"> | "custom" {
  return soundId === "custom" && customSound?.dataUrl
    ? "custom"
    : soundId === "legacy-v1.6.1"
      ? "legacy-v1.6.1"
      : "refactor";
}

export function playNotificationPing(
  soundId: NotificationSoundId = DEFAULT_NOTIFICATION_SOUND_ID,
  customSound: CustomNotificationSound | null = null,
) {
  try {
    const playableSoundId = getPlayableNotificationSoundId(soundId, customSound);
    if (playableSoundId === "custom") {
      playCustomNotificationSound(customSound);
      return;
    }
    if (playableSoundId === "legacy-v1.6.1") {
      playLegacy161Ping();
      return;
    }
    playRefactorPing();
  } catch {
    /* notification audio is best-effort */
  }
}
