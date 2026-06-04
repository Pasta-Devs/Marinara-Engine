// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatSurfaceData } from "./use-chat-surface-data";

const mocks = vi.hoisted(() => ({
  useChat: vi.fn(),
  useChatMessages: vi.fn(),
  useCharacterSummariesByIds: vi.fn(),
}));

vi.mock("../../../../catalog/chats/index", () => ({
  useChat: mocks.useChat,
  useChatMessageCount: () => ({ data: undefined }),
  useChatMessages: mocks.useChatMessages,
}));

vi.mock("../../../../catalog/characters/index", () => ({
  characterAvatarUrl: () => null,
  useCharacterSummariesByIds: mocks.useCharacterSummariesByIds,
}));

vi.mock("../../../../catalog/personas/index", () => ({
  useActivePersonaSummary: () => ({ data: undefined }),
  usePersonaSummary: () => ({ data: undefined }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Mode = "conversation" | "roleplay" | "game";

function Harness({ fallbackChatMode = "conversation" }: { fallbackChatMode?: Mode }) {
  useChatSurfaceData({
    activeChatId: "chat-1",
    messagePageSize: 20,
    fallbackChatMode,
    personaFallback: "active-persona",
  });
  return null;
}

describe("useChatSurfaceData", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    mocks.useChat.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.useChatMessages.mockReturnValue({
      data: undefined,
      isLoading: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });
    mocks.useCharacterSummariesByIds.mockReturnValue({ data: [] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    client.clear();
    vi.clearAllMocks();
  });

  async function render(props: { fallbackChatMode?: Mode } = {}) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness {...props} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("starts loading messages as soon as an active chat id exists", async () => {
    await render();
    expect(mocks.useChatMessages).toHaveBeenCalledWith("chat-1", 20, true);
  });
});
