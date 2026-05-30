import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "../../../../engine/contracts/types/chat";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  flushPendingGameMetadataPatches,
  getPendingGameMetadataPatch,
  persistGameMetadataPatch,
  resetGameMetadataPersistenceForTest,
} from "./game-metadata-persistence";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    patchChatMetadata: vi.fn(),
  },
}));

const patchChatMetadataMock = vi.mocked(storageApi.patchChatMetadata);

function chat(metadata: Record<string, unknown> = {}): Chat {
  return {
    id: "chat-1",
    name: "Game",
    mode: "game",
    characterIds: [],
    metadata,
  } as unknown as Chat;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await resetGameMetadataPersistenceForTest();
  patchChatMetadataMock.mockReset();
});

afterEach(async () => {
  await resetGameMetadataPersistenceForTest();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("game metadata persistence", () => {
  it("retains a failed patch and retries the same payload on the next flush", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline")).mockResolvedValueOnce(chat());

    await expect(persistGameMetadataPatch("chat-1", { gameSceneBackground: "forest" })).rejects.toThrow(
      "Failed to persist 1 game metadata patch.",
    );

    expect(getPendingGameMetadataPatch("chat-1")).toEqual({ gameSceneBackground: "forest" });

    await flushPendingGameMetadataPatches("chat-1");

    expect(patchChatMetadataMock).toHaveBeenCalledTimes(2);
    expect(patchChatMetadataMock).toHaveBeenNthCalledWith(2, "chat-1", { gameSceneBackground: "forest" });
    expect(getPendingGameMetadataPatch("chat-1")).toBeNull();
  });

  it("coalesces multiple pending patches for the same chat without dropping keys", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline")).mockResolvedValueOnce(chat());

    await expect(persistGameMetadataPatch("chat-1", { gameSceneBackground: "forest" })).rejects.toThrow();
    await persistGameMetadataPatch("chat-1", { gameSceneMusic: "theme" });

    expect(patchChatMetadataMock).toHaveBeenLastCalledWith("chat-1", {
      gameSceneBackground: "forest",
      gameSceneMusic: "theme",
    });
    expect(getPendingGameMetadataPatch("chat-1")).toBeNull();
  });

  it("clears durable pending state after a successful retry", async () => {
    patchChatMetadataMock.mockRejectedValueOnce(new Error("storage offline")).mockResolvedValueOnce(chat());

    await expect(persistGameMetadataPatch("chat-1", { gameNarrationIndex: 2 })).rejects.toThrow();
    expect(window.localStorage.getItem("marinara:pending-game-metadata-patches:v1")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(patchChatMetadataMock).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("marinara:pending-game-metadata-patches:v1")).toBeNull();
  });

  it("ignores invalid stored retry payloads safely", async () => {
    window.localStorage.setItem(
      "marinara:pending-game-metadata-patches:v1",
      JSON.stringify([["chat-1", { chatId: "chat-1", patch: "not-an-object", revision: 1 }]]),
    );

    await flushPendingGameMetadataPatches("chat-1");

    expect(patchChatMetadataMock).not.toHaveBeenCalled();
    expect(getPendingGameMetadataPatch("chat-1")).toBeNull();
  });
});
