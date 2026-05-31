// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Chat } from "../../../../engine/contracts/types/chat";
import { imageGenerationApi } from "../../../../shared/api/image-generation-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { ChatImage } from "../../../../shared/types/gallery";
import { galleryKeys } from "../query-keys";
import { useRegenerateGalleryImage } from "./use-gallery";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/image-generation-api", () => ({
  galleryApi: {
    uploadChat: vi.fn(),
  },
  imageGenerationApi: {
    generate: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    create: vi.fn(),
  },
}));

const generateMock = vi.mocked(imageGenerationApi.generate);
const createMock = vi.mocked(storageApi.create);

function chat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-1",
    name: "Test chat",
    mode: "conversation",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    metadata: {
      summary: null,
      tags: [],
      enableAgents: false,
      agentOverrides: {},
      activeAgentIds: [],
      activeToolIds: [],
      presetChoices: {},
      imageGenConnectionId: "image-connection-1",
    },
    ...overrides,
  };
}

function image(overrides: Partial<ChatImage> = {}): ChatImage {
  return {
    id: "gallery-1",
    chatId: "chat-1",
    url: "asset://gallery-1.png",
    prompt: " rainy neon street ",
    provider: "old_provider",
    model: "old-model",
    width: 640,
    height: 832,
    createdAt: "2026-05-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("gallery hooks", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

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
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    generateMock.mockReset();
    createMock.mockReset();
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

  it("regenerates a gallery image from its saved prompt and stores the new image", async () => {
    const regenerate = await renderHook(() => useRegenerateGalleryImage(chat()));
    const activeGalleryKey = galleryKeys.images("chat-1", ["chat-1"]);
    const otherGalleryKey = galleryKeys.images("other-chat", ["other-chat"]);
    queryClient.setQueryData(activeGalleryKey, [image()]);
    queryClient.setQueryData(otherGalleryKey, []);
    generateMock.mockResolvedValue({
      image: "data:image/webp;base64,new-image",
      mimeType: "image/webp",
      provider: "new_provider",
      model: "new-model",
    });
    createMock.mockResolvedValue({ id: "gallery-2" });

    await act(async () => {
      await regenerate.mutateAsync(image());
    });

    expect(generateMock).toHaveBeenCalledWith({
      connectionId: "image-connection-1",
      prompt: "rainy neon street",
      width: 640,
      height: 832,
    });
    expect(createMock).toHaveBeenCalledWith(
      "gallery",
      expect.objectContaining({
        chatId: "chat-1",
        filename: expect.stringMatching(/^regenerated_\d+\.webp$/),
        prompt: "rainy neon street",
        provider: "new_provider",
        model: "new-model",
        width: 640,
        height: 832,
        sourceGalleryId: "gallery-1",
        url: "data:image/webp;base64,new-image",
      }),
    );
    expect(queryClient.getQueryState(activeGalleryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherGalleryKey)?.isInvalidated).toBe(false);
  });

  it("uses the game image connection when regenerating game gallery images", async () => {
    const gameChat = chat({
      mode: "game",
      groupId: "game-1",
      metadata: {
        summary: null,
        tags: [],
        enableAgents: false,
        agentOverrides: {},
        activeAgentIds: [],
        activeToolIds: [],
        presetChoices: {},
        imageGenConnectionId: "conversation-image-connection",
        gameImageConnectionId: "game-image-connection",
        gameId: "game-1",
      },
    });
    const activeGalleryKey = galleryKeys.images("chat-1", ["chat-2", "chat-1"]);
    const unrelatedGalleryKey = galleryKeys.images("other-chat", ["other-chat"]);
    queryClient.setQueryData(galleryKeys.gameSessions("game-1"), [
      chat({
        id: "chat-2",
        mode: "game",
        groupId: "game-1",
        metadata: {
          summary: null,
          tags: [],
          enableAgents: false,
          agentOverrides: {},
          activeAgentIds: [],
          activeToolIds: [],
          presetChoices: {},
          gameId: "game-1",
        },
      }),
    ]);
    queryClient.setQueryData(activeGalleryKey, []);
    queryClient.setQueryData(unrelatedGalleryKey, []);

    const regenerate = await renderHook(() =>
      useRegenerateGalleryImage(gameChat),
    );
    generateMock.mockResolvedValue({ base64: "new-image", mimeType: "image/png" });
    createMock.mockResolvedValue({ id: "gallery-2" });

    await act(async () => {
      await regenerate.mutateAsync(image({ width: null, height: null }));
    });

    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "game-image-connection",
        width: 1024,
        height: 1024,
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      "gallery",
      expect.objectContaining({
        url: "data:image/png;base64,new-image",
      }),
    );
    expect(queryClient.getQueryState(activeGalleryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unrelatedGalleryKey)?.isInvalidated).toBe(false);
  });

  it("rejects images without a saved prompt before calling the provider", async () => {
    const regenerate = await renderHook(() => useRegenerateGalleryImage(chat()));

    await act(async () => {
      await expect(regenerate.mutateAsync(image({ prompt: " " }))).rejects.toThrow(
        "This image does not have a saved prompt to regenerate.",
      );
    });

    expect(generateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
