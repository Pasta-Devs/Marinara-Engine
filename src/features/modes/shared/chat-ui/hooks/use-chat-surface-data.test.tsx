// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatSurfaceData } from "./use-chat-surface-data";

const catalogMocks = vi.hoisted(() => ({
  useChatMessages: vi.fn(),
}));

vi.mock("../../../../catalog/chats/index", () => ({
  useChat: () => ({ data: undefined, error: null }),
  useChatMessageCount: () => ({ data: undefined }),
  useChatMessages: catalogMocks.useChatMessages,
}));

vi.mock("../../../../catalog/characters/index", () => ({
  characterAvatarUrl: () => null,
  useCharactersByIds: () => ({ data: [] }),
}));

vi.mock("../../../../catalog/personas/index", () => ({
  useActivePersona: () => ({ data: undefined }),
  usePersona: () => ({ data: undefined }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  useChatSurfaceData({
    activeChatId: "chat-1",
    messagePageSize: 20,
    fallbackChatMode: "conversation",
    personaFallback: "active-persona",
  });
  return null;
}

describe("useChatSurfaceData", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    catalogMocks.useChatMessages.mockReturnValue({
      data: undefined,
      isLoading: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    catalogMocks.useChatMessages.mockReset();
  });

  it("starts loading messages as soon as an active chat id exists", () => {
    act(() => {
      root.render(<Harness />);
    });

    expect(catalogMocks.useChatMessages).toHaveBeenCalledWith("chat-1", 20, true);
  });
});
