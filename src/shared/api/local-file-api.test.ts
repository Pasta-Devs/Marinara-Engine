import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertFileSrc } from "@tauri-apps/api/core";
import { remoteRuntimeTarget } from "./remote-runtime";
import { avatarFileUrlFromPath } from "./local-file-api";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
}));

vi.mock("./remote-runtime", () => ({
  remoteRuntimeTarget: vi.fn(),
}));

const convertFileSrcMock = vi.mocked(convertFileSrc);
const remoteRuntimeTargetMock = vi.mocked(remoteRuntimeTarget);

describe("avatarFileUrlFromPath", () => {
  beforeEach(() => {
    convertFileSrcMock.mockReset();
    remoteRuntimeTargetMock.mockReset();
    remoteRuntimeTargetMock.mockReturnValue(null);
    convertFileSrcMock.mockImplementation((path) => `asset://localhost/${encodeURIComponent(path)}`);
    (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: unknown } }).__TAURI_INTERNALS__ = {
      convertFileSrc: vi.fn(),
    };
  });

  it("uses the remote avatar asset route when a filename is present", () => {
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath("Avatar One.png", "C:\\Marinara\\avatars\\characters\\Avatar One.png")).toBe(
      "http://runtime.test/api/assets/avatar/Avatar%20One.png",
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("strips dot segments before building remote avatar asset routes", () => {
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath(".\\..\\Avatar One.png", null)).toBe(
      "http://runtime.test/api/assets/avatar/Avatar%20One.png",
    );
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("derives a remote avatar filename from an absolute path without leaking the path", () => {
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://runtime.test" });

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
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://runtime.test" });

    expect(avatarFileUrlFromPath(null, null)).toBeNull();
  });
});
