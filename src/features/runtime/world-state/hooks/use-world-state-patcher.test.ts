import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../../../../engine/contracts/types/game-state";
import { worldStateApi } from "../api/world-state-api";
import { useGameStateStore } from "../stores/world-state.store";
import {
  discardPendingGameStatePatch,
  flushGameStatePatch,
  patchGameStateField,
  useGameStatePatcher,
} from "./use-world-state-patcher";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api/world-state-api", () => ({
  worldStateApi: {
    patch: vi.fn(),
  },
}));

const PATCH_QUEUE_STORAGE_KEY = "marinara:pending-game-state-patches:v1";
const patchMock = vi.mocked(worldStateApi.patch);

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: "state-1",
    chatId: "chat-1",
    messageId: "assistant-1",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    createdAt: "2026-05-29T00:00:00.000Z",
    ...overrides,
  };
}

async function resetPatcherState() {
  await discardPendingGameStatePatch();
  useGameStateStore.getState().reset();
  window.localStorage.clear();
  patchMock.mockReset();
}

beforeEach(async () => {
  await resetPatcherState();
});

afterEach(async () => {
  await resetPatcherState();
});

describe("world-state patcher", () => {
  it("optimistically updates the visible state and flushes a coalesced manual patch for the original target", async () => {
    useGameStateStore.getState().setGameState(
      gameState({
        messageId: "assistant-2",
        swipeIndex: 3,
        location: "Old road",
        weather: "Clear",
      }),
    );
    patchMock.mockResolvedValueOnce(gameState({ location: "Library", weather: "Rain" }));

    patchGameStateField("chat-1", "location", "Library");
    patchGameStateField("chat-1", "weather", "Rain");

    expect(useGameStateStore.getState().current).toMatchObject({
      chatId: "chat-1",
      messageId: "assistant-2",
      swipeIndex: 3,
      location: "Library",
      weather: "Rain",
    });

    await flushGameStatePatch("chat-1");

    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(patchMock).toHaveBeenCalledWith(
      "chat-1",
      {
        location: "Library",
        manual: true,
        messageId: "assistant-2",
        swipeIndex: 3,
        weather: "Rain",
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it("does not overwrite the visible state when a queued patch flushes for an older same-chat target", async () => {
    useGameStateStore.getState().setGameState(
      gameState({
        messageId: "assistant-2",
        swipeIndex: 3,
        location: "Old road",
      }),
    );
    patchMock.mockResolvedValueOnce(gameState({ messageId: "assistant-2", swipeIndex: 3, location: "Library" }));

    patchGameStateField("chat-1", "location", "Library");
    useGameStateStore.getState().setGameState(
      gameState({
        messageId: "assistant-4",
        swipeIndex: 0,
        location: "New target",
      }),
    );

    await flushGameStatePatch("chat-1");

    expect(patchMock).toHaveBeenCalledWith(
      "chat-1",
      {
        location: "Library",
        manual: true,
        messageId: "assistant-2",
        swipeIndex: 3,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(useGameStateStore.getState().current).toMatchObject({
      chatId: "chat-1",
      messageId: "assistant-4",
      swipeIndex: 0,
      location: "New target",
    });
  });

  it("keeps a failed patch queued and retries the same payload on the next flush", async () => {
    useGameStateStore.getState().setGameState(gameState({ messageId: "assistant-3", swipeIndex: 1 }));
    patchMock
      .mockRejectedValueOnce(new Error("storage offline"))
      .mockResolvedValueOnce(gameState({ messageId: "assistant-3", swipeIndex: 1, temperature: "Cold" }));

    patchGameStateField("chat-1", "temperature", "Cold");

    await expect(flushGameStatePatch("chat-1")).rejects.toThrow("Failed to flush 1 game-state patch.");
    expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).not.toBeNull();

    await flushGameStatePatch("chat-1");

    expect(patchMock).toHaveBeenCalledTimes(2);
    expect(patchMock).toHaveBeenNthCalledWith(
      2,
      "chat-1",
      {
        manual: true,
        messageId: "assistant-3",
        swipeIndex: 1,
        temperature: "Cold",
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it("does not update or queue manual patches while the current chat state is refreshing", async () => {
    useGameStateStore.getState().setGameState(gameState({ location: "Town" }));
    useGameStateStore.getState().setRefreshingChat("chat-1");

    patchGameStateField("chat-1", "location", "Forest");
    await flushGameStatePatch("chat-1");

    expect(useGameStateStore.getState().current).toMatchObject({ location: "Town" });
    expect(patchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it("does not queue manual patches for a refreshing non-visible chat", async () => {
    useGameStateStore.getState().setGameState(gameState({ chatId: "chat-1", location: "Town" }));
    useGameStateStore.getState().setRefreshingChat("chat-2");

    patchGameStateField("chat-2", "location", "Forest");
    await flushGameStatePatch("chat-2");

    expect(useGameStateStore.getState().current).toMatchObject({
      chatId: "chat-1",
      location: "Town",
    });
    expect(patchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it("restores and flushes a durable pending patch when the patcher hook mounts", async () => {
    let root: Root | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    patchMock.mockResolvedValueOnce(gameState({ messageId: "assistant-5", swipeIndex: 2, weather: "Fog" }));
    window.localStorage.setItem(
      PATCH_QUEUE_STORAGE_KEY,
      JSON.stringify([
        [
          "chat-1\u0000assistant-5\u00002",
          {
            chatId: "chat-1",
            target: { messageId: "assistant-5", swipeIndex: 2 },
            fields: { weather: "Fog" },
            revision: 1,
          },
        ],
      ]),
    );

    function Harness() {
      useGameStatePatcher("chat-1", "restore-test");
      return null;
    }

    try {
      root = createRoot(container);
      await act(async () => {
        root!.render(createElement(Harness));
      });

      await vi.waitFor(() => {
        expect(patchMock).toHaveBeenCalledWith(
          "chat-1",
          {
            manual: true,
            messageId: "assistant-5",
            swipeIndex: 2,
            weather: "Fog",
          },
          { signal: expect.any(AbortSignal) },
        );
      });
      expect(window.localStorage.getItem(PATCH_QUEUE_STORAGE_KEY)).toBeNull();
    } finally {
      if (root) {
        act(() => {
          root!.unmount();
        });
      }
      container.remove();
    }
  });
});
