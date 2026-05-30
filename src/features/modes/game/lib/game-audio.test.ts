import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localFileApiMock = {
  resolveGameAssetFileUrl: vi.fn<(path: string) => Promise<string>>(),
};

class FakeAudio {
  static instances: FakeAudio[] = [];

  src = "";
  loop = false;
  preload = "";
  muted = false;
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src?: string) {
    if (src) this.src = src;
    FakeAudio.instances.push(this);
  }

  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn((name: string) => {
    if (name === "src") this.src = "";
  });
}

async function createGameAudioManager() {
  vi.resetModules();
  vi.doMock("../../../../shared/api/local-file-api", () => localFileApiMock);
  const module = await import("./game-audio");
  return new module.GameAudioManager();
}

describe("GameAudioManager remote asset resolution", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    localFileApiMock.resolveGameAssetFileUrl.mockImplementation(async (path) => `blob:${path}`);
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.doUnmock("../../../../shared/api/local-file-api");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves music through the async game asset resolver before playback", async () => {
    const manager = await createGameAudioManager();
    manager.unlock();

    manager.playMusic("music:boss", { "music:boss": { path: "music/boss.mp3" } });

    await vi.waitFor(() => {
      expect(localFileApiMock.resolveGameAssetFileUrl).toHaveBeenCalledWith("music/boss.mp3");
      expect(FakeAudio.instances.some((audio) => audio.src === "blob:music/boss.mp3" && audio.loop)).toBe(true);
    });
  });

  it("resolves ambient audio through the async game asset resolver before playback", async () => {
    const manager = await createGameAudioManager();
    manager.unlock();

    manager.playAmbient("ambient:rain", { "ambient:rain": { path: "ambient/rain.mp3" } });

    await vi.waitFor(() => {
      expect(localFileApiMock.resolveGameAssetFileUrl).toHaveBeenCalledWith("ambient/rain.mp3");
      expect(FakeAudio.instances.some((audio) => audio.src === "blob:ambient/rain.mp3" && audio.loop)).toBe(true);
    });
  });

  it("resolves SFX through the async game asset resolver before playback", async () => {
    const manager = await createGameAudioManager();
    manager.unlock();

    manager.playSfx("sfx:hit", { "sfx:hit": { path: "sfx/hit.wav" } });

    await vi.waitFor(() => {
      expect(localFileApiMock.resolveGameAssetFileUrl).toHaveBeenCalledWith("sfx/hit.wav");
      expect(FakeAudio.instances.some((audio) => audio.src === "blob:sfx/hit.wav")).toBe(true);
    });
  });

  it("does not play SFX if mute is enabled while async asset resolution is pending", async () => {
    let resolveAsset!: (url: string) => void;
    localFileApiMock.resolveGameAssetFileUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAsset = resolve;
        }),
    );
    const manager = await createGameAudioManager();
    manager.unlock();

    manager.playSfx("sfx:hit", { "sfx:hit": { path: "sfx/hit.wav" } });
    manager.setMuted(true);
    resolveAsset("blob:sfx/hit.wav");

    await vi.waitFor(() => {
      expect(localFileApiMock.resolveGameAssetFileUrl).toHaveBeenCalledWith("sfx/hit.wav");
    });
    expect(FakeAudio.instances.some((audio) => audio.src === "blob:sfx/hit.wav")).toBe(false);
  });
});
