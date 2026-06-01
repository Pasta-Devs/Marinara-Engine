// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

function installAudioContext(overrides: Partial<AudioContext> = {}) {
  const oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: { value: 0 },
    connect: vi.fn(),
  };
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return {
      state: "running",
      currentTime: 1,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      resume: vi.fn().mockResolvedValue(undefined),
      ...overrides,
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
});
