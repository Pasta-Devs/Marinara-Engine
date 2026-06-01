// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { npcAvatarApi } from "../../../../shared/api/avatar-api";
import type { PresentCharacter } from "../../../../engine/contracts/types/game-state";
import { useGameStateStore } from "../stores/world-state.store";
import { useTrackerCharacterAvatarActions } from "./use-tracker-character-avatar-actions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/avatar-api", () => ({
  npcAvatarApi: {
    upload: vi.fn(),
  },
}));

vi.mock("../../../catalog/agents/index", () => ({
  useAgentConfigs: vi.fn(() => ({ data: [] })),
  useUpdateAgent: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const uploadMock = vi.mocked(npcAvatarApi.upload);

function character(overrides: Partial<PresentCharacter> = {}): PresentCharacter {
  return {
    characterId: "character-1",
    name: "Mari",
    emoji: "",
    mood: "",
    appearance: null,
    outfit: null,
    customFields: {},
    stats: [],
    thoughts: null,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("useTrackerCharacterAvatarActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    useGameStateStore.getState().reset();
    uploadMock.mockReset();
    originalFileReader = globalThis.FileReader;
    class TestFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL(file: File) {
        setTimeout(() => {
          this.result = `data:${file.type};name=${file.name};base64,test`;
          this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
        }, 0);
      }
    }
    globalThis.FileReader = TestFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    useGameStateStore.getState().reset();
    globalThis.FileReader = originalFileReader;
  });

  async function renderHook<TValue>(useHook: () => TValue): Promise<TValue> {
    let value: TValue | undefined;

    function Probe() {
      value = useHook();
      return null;
    }

    await act(async () => {
      root.render(
        createElement(QueryClientProvider, {
          client: queryClient,
          children: createElement(Probe),
        }),
      );
    });

    if (!value) throw new Error("Hook did not render");
    return value;
  }

  it("keeps an older upload completion from overwriting a newer avatar for the same character", async () => {
    const firstUpload = createDeferred<{ avatarPath: string }>();
    uploadMock
      .mockReturnValueOnce(firstUpload.promise as never)
      .mockResolvedValueOnce({ avatarPath: "asset://newer.png" } as never);
    useGameStateStore.getState().setGameState({
      id: "state-1",
      chatId: "chat-1",
      messageId: "message-1",
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [character()],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
      createdAt: "2026-05-26T10:00:00.000Z",
    });
    const updates: unknown[] = [];
    const actions = await renderHook(() =>
      useTrackerCharacterAvatarActions({
        chatId: "chat-1",
        characters: [character()],
        onUpdateCharacters: (characters) => {
          updates.push(characters);
          useGameStateStore.getState().setGameState({
            ...useGameStateStore.getState().current!,
            presentCharacters: characters,
          });
        },
      }),
    );
    const older = new File(["older"], "older.png", { type: "image/png" });
    const newer = new File(["newer"], "newer.png", { type: "image/png" });

    const firstPromise = actions.uploadCharacterAvatar(0, older);
    await vi.waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    const secondPromise = actions.uploadCharacterAvatar(0, newer);
    await act(async () => {
      await secondPromise;
    });
    firstUpload.resolve({ avatarPath: "asset://older.png" });
    await act(async () => {
      await firstPromise;
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual([
      expect.objectContaining({ characterId: "character-1", avatarPath: "asset://newer.png" }),
    ]);
  });
});
