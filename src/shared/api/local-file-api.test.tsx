import { beforeEach, describe, expect, it, vi } from "vitest";
import { avatarFileUrlFromPath } from "./local-file-api";
import { remoteRuntimeTarget } from "./remote-runtime";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("./remote-runtime", () => ({
  remoteHeaders: vi.fn(() => ({ "X-Marinara-CSRF": "1" })),
  remoteRuntimeTarget: vi.fn(),
}));

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

const remoteRuntimeTargetMock = vi.mocked(remoteRuntimeTarget);

describe("local file API managed avatar URLs", () => {
  beforeEach(() => {
    remoteRuntimeTargetMock.mockReset();
    remoteRuntimeTargetMock.mockReturnValue({ baseUrl: "http://localhost:8787" });
  });

  it("preserves avatar collection prefixes from managed absolute paths for remote URLs", () => {
    expect(avatarFileUrlFromPath("Current.png", "C:\\Marinara\\avatars\\personas\\Current.png")).toBe(
      "http://localhost:8787/api/assets/avatar/personas/Current.png",
    );
    expect(avatarFileUrlFromPath("Created.png", "C:\\Marinara\\avatars\\characters\\Created.png")).toBe(
      "http://localhost:8787/api/assets/avatar/characters/Created.png",
    );
    expect(avatarFileUrlFromPath("innkeeper.png", "/srv/marinara/avatars/npc/chat-1/innkeeper.png")).toBe(
      "http://localhost:8787/api/assets/avatar/npc/chat-1/innkeeper.png",
    );
  });

  it("keeps legacy filename-only remote avatar URLs when no managed path is available", () => {
    expect(avatarFileUrlFromPath("legacy.png", null)).toBe("http://localhost:8787/api/assets/avatar/legacy.png");
  });

  it("does not derive collection-prefixed remote URLs from suspicious managed paths", () => {
    expect(avatarFileUrlFromPath("safe.png", "C:\\Marinara\\avatars\\personas\\..\\safe.png")).toBe(
      "http://localhost:8787/api/assets/avatar/safe.png",
    );
  });
});
