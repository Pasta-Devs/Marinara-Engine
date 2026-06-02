// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomNotificationSound } from "./notification-sound";

const CUSTOM_NOTIFICATION_SOUND_MAX_BYTES = 512 * 1024;

function installAudioContext(overrides: Partial<AudioContext> | Array<Partial<AudioContext>> = {}) {
  const oscillator = {
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  let instanceIndex = 0;
  const AudioContextMock = vi.fn(function AudioContextMock() {
    const instanceOverrides = Array.isArray(overrides)
      ? (overrides[Math.min(instanceIndex, overrides.length - 1)] ?? {})
      : overrides;
    instanceIndex += 1;
    return {
      state: "running",
      currentTime: 1,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn().mockResolvedValue(undefined),
      ...instanceOverrides,
    };
  });

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: AudioContextMock,
  });

  return { AudioContextMock };
}

describe("playNotificationPing", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("reuses a single AudioContext for repeated pings", async () => {
    const { AudioContextMock } = installAudioContext();
    const { playNotificationPing } = await import("./notification-sound");

    playNotificationPing();
    playNotificationPing();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
  });

  it("fails quietly when Web Audio throws", async () => {
    installAudioContext({
      createOscillator: vi.fn(() => {
        throw new Error("audio blocked");
      }),
    } as Partial<AudioContext>);
    const { playNotificationPing } = await import("./notification-sound");

    expect(() => playNotificationPing()).not.toThrow();
  });

  it("replaces an interrupted WebKit AudioContext", async () => {
    const { AudioContextMock } = installAudioContext([{ state: "interrupted" } as Partial<AudioContext>, {}]);
    const { playNotificationPing } = await import("./notification-sound");

    playNotificationPing();
    playNotificationPing();

    expect(AudioContextMock).toHaveBeenCalledTimes(2);
  });
});

describe("notification sound settings", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("normalizes unknown sound ids to the current refactor sound", async () => {
    const { normalizeNotificationSoundId } = await import("./notification-sound");

    expect(normalizeNotificationSoundId("legacy-v1.6.1")).toBe("legacy-v1.6.1");
    expect(normalizeNotificationSoundId("nope")).toBe("refactor");
    expect(normalizeNotificationSoundId(null)).toBe("refactor");
  });

  it("accepts small audio files by MIME type or extension", async () => {
    const { getNotificationAudioMimeType, validateCustomNotificationSoundFile } = await import("./notification-sound");

    expect(validateCustomNotificationSoundFile({ name: "ping.wav", type: "", size: 1024 })).toBeNull();
    expect(validateCustomNotificationSoundFile({ name: "ping.bin", type: "audio/mpeg", size: 1024 })).toBeNull();
    expect(getNotificationAudioMimeType({ name: "ping.wav", type: "" })).toBe("audio/wav");
  });

  it("rejects unsupported or oversized custom audio files", async () => {
    const { validateCustomNotificationSoundFile } = await import("./notification-sound");

    expect(validateCustomNotificationSoundFile({ name: "ping.txt", type: "text/plain", size: 1024 })).toContain(
      "audio file",
    );
    expect(
      validateCustomNotificationSoundFile({
        name: "ping.wav",
        type: "audio/wav",
        size: CUSTOM_NOTIFICATION_SOUND_MAX_BYTES + 1,
      }),
    ).toContain("512 KB");
  });

  it("normalizes persisted custom sounds and rejects non-audio data urls", async () => {
    const { normalizeCustomNotificationSound } = await import("./notification-sound");
    const sound: CustomNotificationSound = {
      name: "  soft ping.wav  ",
      type: "audio/wav",
      size: 12,
      dataUrl: "data:audio/wav;base64,AAAA",
    };

    expect(normalizeCustomNotificationSound(sound)).toEqual({
      ...sound,
      name: "soft ping.wav",
    });
    expect(normalizeCustomNotificationSound({ ...sound, dataUrl: "data:text/plain;base64,AAAA" })).toBeNull();
    expect(normalizeCustomNotificationSound({ ...sound, size: CUSTOM_NOTIFICATION_SOUND_MAX_BYTES + 1 })).toBeNull();
  });

  it("coerces extension-only file reader data urls to an audio MIME type", async () => {
    const { coerceNotificationSoundDataUrlMime } = await import("./notification-sound");

    expect(coerceNotificationSoundDataUrlMime("data:application/octet-stream;base64,AAAA", "audio/wav")).toBe(
      "data:audio/wav;base64,AAAA",
    );
  });
});
