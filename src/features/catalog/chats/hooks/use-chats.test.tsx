// @vitest-environment jsdom

import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearChatActivity } from "../../../../engine/modes/chat/autonomous/autonomous.service";
import { chatCommandApi } from "../../../../shared/api/chat-command-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { chatKeys, useCreateChat, useDeleteChat, useDeleteChatGroup, useSetActiveSwipe } from "./use-chats";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/chat-command-api", () => ({
  chatCommandApi: {
    groupDelete: vi.fn(),
    setActiveSwipe: vi.fn(),
  },
}));

vi.mock("../../../../engine/modes/chat/autonomous/autonomous.service", () => ({
  clearChatActivity: vi.fn(),
}));

const storageDeleteMock = vi.mocked(storageApi.delete);
const storageCreateMock = vi.mocked(storageApi.create);
const groupDeleteMock = vi.mocked(chatCommandApi.groupDelete);
const setActiveSwipeMock = vi.mocked(chatCommandApi.setActiveSwipe);
const clearChatActivityMock = vi.mocked(clearChatActivity);

type CachedMessage = {
  id: string;
  chatId: string;
  role: string;
  content: string;
  activeSwipeIndex: number;
  swipeCount: number;
  swipePreviews?: Array<{ content: string }>;
  extra?: Record<string, unknown>;
};

describe("chat deletion mutations", () => {
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
    storageDeleteMock.mockReset();
    storageCreateMock.mockReset();
    groupDeleteMock.mockReset();
    setActiveSwipeMock.mockReset();
    clearChatActivityMock.mockReset();
  });

  async function renderMutation<TMutation>(useHook: () => TMutation): Promise<TMutation> {
    let mutation: TMutation | undefined;

    function Probe() {
      mutation = useHook();
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

    if (!mutation) {
      throw new Error("Mutation hook did not render");
    }

    return mutation;
  }

  it("clears autonomous activity for every chat deleted by a chat delete", async () => {
    const deleteChat = await renderMutation(useDeleteChat);
    storageDeleteMock.mockResolvedValue({ deleted: true, deletedChatIds: ["chat-1", "scene-chat"] } as {
      deleted: boolean;
    });

    await act(async () => {
      await deleteChat.mutateAsync({ id: "chat-1", groupId: "group-1" });
    });

    expect(storageDeleteMock).toHaveBeenCalledWith("chats", "chat-1");
    expect(clearChatActivityMock).toHaveBeenCalledTimes(2);
    expect(clearChatActivityMock).toHaveBeenCalledWith("chat-1");
    expect(clearChatActivityMock).toHaveBeenCalledWith("scene-chat");
  });

  it("invalidates the group cache after creating a grouped chat", async () => {
    const createChat = await renderMutation(useCreateChat);
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    storageCreateMock.mockResolvedValue({
      id: "chat-1",
      name: "Grouped chat",
      mode: "conversation",
      groupId: "group-1",
    });

    await act(async () => {
      await createChat.mutateAsync({ name: "Grouped chat", mode: "conversation", groupId: "group-1" });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: chatKeys.group("group-1") });
  });

  it("keeps autonomous activity when chat deletion fails", async () => {
    const deleteChat = await renderMutation(useDeleteChat);
    storageDeleteMock.mockRejectedValue(new Error("delete failed"));
    let caught: unknown;

    await act(async () => {
      try {
        await deleteChat.mutateAsync("chat-1");
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(clearChatActivityMock).not.toHaveBeenCalled();
  });

  it("clears backend-reported chat activity after deleting a chat group without relying on cache", async () => {
    const deleteChatGroup = await renderMutation(useDeleteChatGroup);
    groupDeleteMock.mockResolvedValue({ deleted: 2, deletedChatIds: ["chat-1", "chat-2", "scene-chat"] });
    queryClient.setQueryData(chatKeys.list(), [{ id: "chat-other", groupId: "group-other" }]);

    await act(async () => {
      await deleteChatGroup.mutateAsync("group-1");
    });

    expect(groupDeleteMock).toHaveBeenCalledWith("group-1");
    expect(clearChatActivityMock).toHaveBeenCalledTimes(3);
    expect(clearChatActivityMock).toHaveBeenCalledWith("chat-1");
    expect(clearChatActivityMock).toHaveBeenCalledWith("chat-2");
    expect(clearChatActivityMock).toHaveBeenCalledWith("scene-chat");
    expect(clearChatActivityMock).not.toHaveBeenCalledWith("chat-other");
  });

  it("removes deleted group chats from cached summaries", async () => {
    const deleteChatGroup = await renderMutation(useDeleteChatGroup);
    groupDeleteMock.mockResolvedValue({ deleted: 1, deletedChatIds: ["chat-1"] });
    queryClient.setQueryData(chatKeys.summaries(), [
      { id: "chat-1", name: "Grouped chat", mode: "conversation", groupId: "group-1" },
      { id: "chat-other", name: "Other chat", mode: "conversation", groupId: "group-other" },
    ]);

    await act(async () => {
      await deleteChatGroup.mutateAsync("group-1");
    });

    expect(queryClient.getQueryData(chatKeys.summaries())).toEqual([
      { id: "chat-other", name: "Other chat", mode: "conversation", groupId: "group-other" },
    ]);
  });

  it("does not crash when a chat group delete response omits deleted chat ids", async () => {
    const deleteChatGroup = await renderMutation(useDeleteChatGroup);
    groupDeleteMock.mockResolvedValue({ deleted: 1 } as Awaited<ReturnType<typeof chatCommandApi.groupDelete>>);

    await act(async () => {
      await deleteChatGroup.mutateAsync("group-1");
    });

    expect(groupDeleteMock).toHaveBeenCalledWith("group-1");
    expect(clearChatActivityMock).not.toHaveBeenCalled();
  });

  it("uses lightweight swipe previews for immediate optimistic swipe changes", async () => {
    const setActiveSwipe = await renderMutation(() => useSetActiveSwipe("chat-1"));
    let resolveSwipe!: (value: unknown) => void;
    const swipePromise = new Promise((resolve) => {
      resolveSwipe = resolve;
    });
    setActiveSwipeMock.mockReturnValue(swipePromise);
    queryClient.setQueryData<InfiniteData<CachedMessage[]>>(chatKeys.messages("chat-1"), {
      pages: [
        [
          {
            id: "message-1",
            chatId: "chat-1",
            role: "assistant",
            content: "latest swipe",
            activeSwipeIndex: 1,
            swipeCount: 2,
            swipePreviews: [{ content: "earlier swipe" }, { content: "latest swipe" }],
            extra: { attachments: [{ type: "image" }] },
          },
        ],
      ],
      pageParams: [undefined],
    });

    await act(async () => {
      void setActiveSwipe.mutateAsync({ messageId: "message-1", index: 0 });
      await Promise.resolve();
    });

    const optimistic = queryClient.getQueryData<InfiniteData<CachedMessage[]>>(chatKeys.messages("chat-1"));
    expect(optimistic?.pages[0]?.[0]).toMatchObject({
      activeSwipeIndex: 0,
      content: "earlier swipe",
      extra: {},
    });

    await act(async () => {
      resolveSwipe({
        id: "message-1",
        content: "earlier swipe",
        activeSwipeIndex: 0,
        swipeCount: 2,
        extra: {},
      });
      await swipePromise;
    });
  });
});
