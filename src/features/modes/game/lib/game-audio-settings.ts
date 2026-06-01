const DEFAULT_GAME_AUDIO_SETTINGS = {
  masterVolume: 50,
  musicVolume: 60,
  sfxVolume: 80,
  ttsVolume: 100,
  ambientVolume: 50,
  audioMuted: false,
};

export const GAME_AUDIO_SETTINGS_STORAGE_KEY = "marinara-engine-game-audio";

export type GameAudioSettings = typeof DEFAULT_GAME_AUDIO_SETTINGS;

export function normalizeVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

export function getEffectiveVolume(masterVolume: number, channelVolume: number): number {
  return (Math.max(0, Math.min(100, masterVolume)) / 100) * (Math.max(0, Math.min(100, channelVolume)) / 100);
}

export function readPersistedGameAudioSettings(): GameAudioSettings {
  const defaults = {
    ...DEFAULT_GAME_AUDIO_SETTINGS,
    audioMuted:
      typeof window !== "undefined"
        ? localStorage.getItem("game-audio-muted") === "true"
        : DEFAULT_GAME_AUDIO_SETTINGS.audioMuted,
  };
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(GAME_AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<GameAudioSettings>;
    const masterVolume = normalizeVolume(parsed.masterVolume, defaults.masterVolume);
    const audioMuted = typeof parsed.audioMuted === "boolean" ? parsed.audioMuted : masterVolume === 0;

    return {
      masterVolume,
      musicVolume: normalizeVolume(parsed.musicVolume, defaults.musicVolume),
      sfxVolume: normalizeVolume(parsed.sfxVolume, defaults.sfxVolume),
      ttsVolume: normalizeVolume(parsed.ttsVolume, defaults.ttsVolume),
      ambientVolume: normalizeVolume(parsed.ambientVolume, defaults.ambientVolume),
      audioMuted: audioMuted || masterVolume === 0,
    };
  } catch {
    return defaults;
  }
}
