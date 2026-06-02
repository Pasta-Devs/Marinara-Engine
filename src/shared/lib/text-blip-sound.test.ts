import { afterEach, describe, expect, it, vi } from "vitest";

async function loadTextBlipModule() {
  vi.resetModules();
  return import("./text-blip-sound");
}

function stubAudioContext() {
  const start = vi.fn();
  const stop = vi.fn();

  class MockAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    createOscillator = vi.fn(() => ({
      type: "square",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((target) => target),
      start,
      stop,
    }));
    createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((target) => target),
    }));
  }

  vi.stubGlobal("AudioContext", MockAudioContext);
  Object.defineProperty(window, "AudioContext", { configurable: true, value: MockAudioContext });
  return { start, stop };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("text blip sound", () => {
  it("validates custom sound files", async () => {
    const { validateCustomTextBlipSoundFile } = await loadTextBlipModule();

    expect(validateCustomTextBlipSoundFile({ name: "tick.wav", type: "audio/wav", size: 128 })).toBeNull();
    expect(validateCustomTextBlipSoundFile({ name: "tick.txt", type: "text/plain", size: 128 })).toContain(
      "audio file",
    );
    expect(validateCustomTextBlipSoundFile({ name: "huge.wav", type: "audio/wav", size: 600 * 1024 })).toContain(
      "512 KB",
    );
  });

  it("stays silent when disabled", async () => {
    const { start } = stubAudioContext();
    const { playTextBlip } = await loadTextBlipModule();

    playTextBlip({ mode: "off" });

    expect(start).not.toHaveBeenCalled();
  });

  it("throttles rapid default blips", async () => {
    const { start } = stubAudioContext();
    const now = vi.spyOn(performance, "now");
    const { playTextBlip } = await loadTextBlipModule();

    now.mockReturnValue(100);
    playTextBlip({ mode: "default" });
    now.mockReturnValue(120);
    playTextBlip({ mode: "default" });
    now.mockReturnValue(180);
    playTextBlip({ mode: "default" });

    expect(start).toHaveBeenCalledTimes(2);
  });

  it("uses a custom sound only when one is available", async () => {
    const play = vi.fn(() => Promise.resolve());
    const audioConstructor = vi.fn(function (this: { preload: string; volume: number; play: typeof play }) {
      this.preload = "";
      this.volume = 0;
      this.play = play;
    });
    vi.stubGlobal("Audio", audioConstructor);
    const now = vi.spyOn(performance, "now").mockReturnValue(100);
    const { playTextBlip } = await loadTextBlipModule();
    const customSound = {
      name: "tick.wav",
      type: "audio/wav",
      size: 128,
      dataUrl: "data:audio/wav;base64,AAAA",
    };

    playTextBlip({ mode: "custom" });
    playTextBlip({ mode: "custom", customSound });
    now.mockReturnValue(120);
    playTextBlip({ mode: "custom", customSound });

    expect(audioConstructor).toHaveBeenCalledTimes(1);
    expect(audioConstructor).toHaveBeenCalledWith(customSound.dataUrl);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
