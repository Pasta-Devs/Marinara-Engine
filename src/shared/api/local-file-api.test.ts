import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useUIStore } from "../stores/ui.store";
import {
  avatarFileUrlFromPath,
  backgroundFileUrlFromPath,
  gameAssetFileUrlFromPath,
  invalidateRemoteManagedAssetObjectUrls,
  resolveAvatarFileUrl,
  resolveBackgroundFileUrl,
  resolveGameAssetFileUrl,
  resolveManagedLocalAssetUrl,
} from "./local-file-api";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
}));

const convertFileSrcMock = vi.mocked(convertFileSrc);

describe("managed remote asset URLs", () => {
  beforeEach(() => {
    invalidateRemoteManagedAssetObjectUrls();
    useUIStore.setState({ remoteRuntimeUrl: "" });
    convertFileSrcMock.mockReset();
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
  });

  afterEach(() => {
    invalidateRemoteManagedAssetObjectUrls();
    useUIStore.setState({ remoteRuntimeUrl: "" });
    vi.unstubAllGlobals();
  });

  it("keeps unauthenticated assets as direct remote URLs", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.local:8787/" });

    expect(backgroundFileUrlFromPath("scene one.png")).toBe(
      "http://runtime.local:8787/api/assets/background/scene%20one.png",
    );
  });

  it("does not return raw remote URLs from sync helpers when auth is required", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });

    expect(backgroundFileUrlFromPath("scene one.png")).toBe("marinara-background:scene%20one.png");
    expect(gameAssetFileUrlFromPath("backgrounds/forest.png")).toBe("marinara-game-asset:backgrounds%2Fforest.png");
  });

  it("fetches authenticated remote assets into blob URLs", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn(() => "blob:marinara-asset");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGameAssetFileUrl("folder/asset one.png")).resolves.toBe("blob:marinara-asset");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.local:8787/api/assets/game/folder/asset%20one.png",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Basic dXNlcjpwYXNz",
          "X-Marinara-CSRF": "1",
        }),
      }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("resolves authenticated game asset protocol URLs through the async managed bridge", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn(() => "blob:game-background");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    const syncUrl = gameAssetFileUrlFromPath("backgrounds/forest.png");

    await expect(resolveManagedLocalAssetUrl(syncUrl)).resolves.toBe("blob:game-background");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://runtime.local:8787/api/assets/game/backgrounds/forest.png",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Basic dXNlcjpwYXNz" }),
      }),
    );
  });

  it("deduplicates concurrent authenticated remote asset fetches", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn(() => "blob:deduped-asset");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    const first = resolveGameAssetFileUrl("music/theme.mp3");
    const second = resolveGameAssetFileUrl("music/theme.mp3");

    await expect(first).resolves.toBe("blob:deduped-asset");
    await expect(second).resolves.toBe("blob:deduped-asset");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("clears failed authenticated remote asset fetches so later calls can retry", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn(() => "blob:retry-asset");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(new Response("", { status: 500 })))
      .mockImplementationOnce(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGameAssetFileUrl("sfx/hit.wav")).rejects.toThrow("Remote managed asset returned 500");
    await expect(resolveGameAssetFileUrl("sfx/hit.wav")).resolves.toBe("blob:retry-asset");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("revokes invalidated authenticated remote asset object URLs", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn(() => "blob:stale-asset");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes"))),
    );

    await expect(resolveGameAssetFileUrl("music/theme.mp3")).resolves.toBe("blob:stale-asset");
    invalidateRemoteManagedAssetObjectUrls("game", "music/theme.mp3");

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:stale-asset");
  });

  it("fetches authenticated background and avatar assets through async resolvers", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn().mockReturnValueOnce("blob:background").mockReturnValueOnce("blob:avatar");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveBackgroundFileUrl("scene one.png")).resolves.toBe("blob:background");
    await expect(
      resolveAvatarFileUrl("Avatar One.png", "C:\\Marinara\\avatars\\characters\\Avatar One.png"),
    ).resolves.toBe("blob:avatar");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://runtime.local:8787/api/assets/background/scene%20one.png",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Basic dXNlcjpwYXNz" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://runtime.local:8787/api/assets/avatar/Avatar%20One.png",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Basic dXNlcjpwYXNz" }),
      }),
    );
  });

  it("uses the remote avatar asset route when a filename is present", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath("Avatar One.png", "C:\\Marinara\\avatars\\characters\\Avatar One.png")).toBe(
      "http://runtime.test/api/assets/avatar/Avatar%20One.png",
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("strips dot segments before building remote avatar asset routes", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath(".\\..\\Avatar One.png", null)).toBe(
      "http://runtime.test/api/assets/avatar/Avatar%20One.png",
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("derives a remote avatar filename from an absolute path without leaking the path", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath(null, "C:\\Marinara\\avatars\\characters\\Avatar One.png")).toBe(
      "http://runtime.test/api/assets/avatar/Avatar%20One.png",
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("uses Tauri file URL conversion for local absolute paths", () => {
    expect(avatarFileUrlFromPath(null, "C:\\Marinara\\avatars\\characters\\Avatar One.png")).toBe(
      "asset://localhost/C%3A%5CMarinara%5Cavatars%5Ccharacters%5CAvatar%20One.png",
    );
    expect(convertFileSrcMock).toHaveBeenCalledWith("C:\\Marinara\\avatars\\characters\\Avatar One.png");
  });

  it("returns null when neither a filename nor an absolute path is available", () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath(null, null)).toBeNull();
  });
});
