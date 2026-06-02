// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { ModeSurface } from "./ModeSurface";

const catalogMocks = vi.hoisted(() => ({
  chat: undefined as { id: string; mode: "conversation" | "roleplay" | "game" } | undefined,
  summaries: [] as Array<{ id: string; mode: "conversation" | "roleplay" | "game" }>,
}));

vi.mock("../../../catalog/chats/index", () => ({
  useChat: () => ({ data: catalogMocks.chat, error: null, isLoading: true, isFetching: true }),
  useChatSummaries: () => ({ data: catalogMocks.summaries }),
}));

vi.mock("../../conversation/index", () => ({
  ConversationModeRoute: ({ activeChatId }: { activeChatId: string }) => (
    <div data-testid="conversation-route">{activeChatId}</div>
  ),
}));

vi.mock("../../roleplay/index", () => ({
  RoleplayModeRoute: ({ activeChatId }: { activeChatId: string }) => (
    <div data-testid="roleplay-route">{activeChatId}</div>
  ),
}));

vi.mock("../../game/index", () => ({
  GameModeRoute: ({ activeChatId }: { activeChatId: string }) => <div data-testid="game-route">{activeChatId}</div>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ModeSurface", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    catalogMocks.chat = undefined;
    catalogMocks.summaries = [];
    useChatStore.setState({ activeChatId: null, activeChat: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uses cached chat summaries to route a selected conversation before detail hydrates", async () => {
    catalogMocks.summaries = [{ id: "chat-1", mode: "conversation" }];
    useChatStore.setState({ activeChatId: "chat-1" });

    await act(async () => {
      root.render(<ModeSurface />);
    });

    expect(container.querySelector("[data-testid='conversation-route']")?.textContent).toBe("chat-1");
    expect(container.querySelector("[data-testid='roleplay-route']")).toBeNull();
    expect(container.querySelector("[data-testid='game-route']")).toBeNull();
  });
});
