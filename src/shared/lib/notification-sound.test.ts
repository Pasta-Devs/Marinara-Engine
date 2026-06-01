// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

function installAudioContext(overrides: Partial<AudioContext> | Array<Partial<AudioContext>> = {}) {
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
