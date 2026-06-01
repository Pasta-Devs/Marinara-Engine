// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatListItem } from "../../../catalog/chats/index";
import { RecentChats } from "./RecentChats";

const recentChats: ChatListItem[] = [];

vi.mock("../../../catalog/chats/index", () => ({
  useRecentChatSummaries: () => ({ data: recentChats }),
}));

vi.mock("../../../catalog/characters/index", () => ({
  useCharacterSummariesByIds: () => ({ data: [] }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function chatSummary(overrides: Partial<ChatListItem>): ChatListItem {
  return {
    id: "chat-1",
    name: "Recent game",
    mode: "game",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    folderId: null,
    sortOrder: 0,
    connectedChatId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("RecentChats", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    recentChats.length = 0;
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

  it("labels game chats with a Game mode badge", () => {
    recentChats.push(chatSummary({ mode: "game" }));

    act(() => {
      root.render(<RecentChats />);
    });

    expect(container.querySelector("[title='Game']")).toBeTruthy();
    expect(container.querySelector("[title='Conversation']")).toBeNull();
  });

  it("keeps the existing Roleplay badge for roleplay chats", () => {
    recentChats.push(chatSummary({ mode: "roleplay" }));

    act(() => {
      root.render(<RecentChats />);
    });

    expect(container.querySelector("[title='Roleplay']")).toBeTruthy();
  });

  it("keeps Conversation as the fallback badge for unknown modes", () => {
    recentChats.push(chatSummary({ mode: "mystery" as ChatListItem["mode"] }));

    act(() => {
      root.render(<RecentChats />);
    });

    expect(container.querySelector("[title='Conversation']")).toBeTruthy();
  });
});
