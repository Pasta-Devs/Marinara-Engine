import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useUIStore } from "../stores/ui.store";
import {
  avatarFileUrlFromPath,
  backgroundFileUrlFromPath,
  resolveAvatarFileUrl,
  resolveBackgroundFileUrl,
  resolveGameAssetFileUrl,
} from "./local-file-api";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
}));

const convertFileSrcMock = vi.mocked(convertFileSrc);

describe("managed remote asset URLs", () => {
  beforeEach(() => {
    useUIStore.setState({ remoteRuntimeUrl: "" });
    convertFileSrcMock.mockReset();
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
  });

  afterEach(() => {
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

  it("fetches authenticated background and avatar assets through async resolvers", async () => {
    useUIStore.setState({ remoteRuntimeUrl: "http://user:pass@runtime.local:8787/" });
    const createObjectURL = vi.fn().mockReturnValueOnce("blob:background").mockReturnValueOnce("blob:avatar");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("asset bytes")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveBackgroundFileUrl("scene one.png")).resolves.toBe("blob:background");
    await expect(resolveAvatarFileUrl("Avatar One.png", "C:\\Marinara\\avatars\\characters\\Avatar One.png")).resolves.toBe(
      "blob:avatar",
    );
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
