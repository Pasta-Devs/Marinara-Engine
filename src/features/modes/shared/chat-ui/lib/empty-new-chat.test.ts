import { describe, expect, it } from "vitest";

import { isEmptyNewChatSetup } from "./empty-new-chat";

describe("isEmptyNewChatSetup", () => {
  it("detects a persisted setup placeholder with no characters or messages", () => {
    expect(
      isEmptyNewChatSetup({
        activeChatId: "chat-1",
        setupChatId: "chat-1",
        chatCharIds: [],
        totalMessageCount: 0,
        messagesLoaded: true,
      }),
    ).toBe(true);
  });

  it("detects a known setup placeholder before message rows finish loading", () => {
    expect(
      isEmptyNewChatSetup({
        activeChatId: "chat-1",
        setupChatId: "chat-1",
        chatCharIds: [],
        totalMessageCount: 0,
        messagesLoaded: false,
      }),
    ).toBe(true);
  });

  it("keeps chats that already have selected characters", () => {
    expect(
      isEmptyNewChatSetup({
        activeChatId: "chat-1",
        setupChatId: "chat-1",
        chatCharIds: ["char-1"],
        totalMessageCount: 0,
        messagesLoaded: true,
      }),
    ).toBe(false);
  });

  it("keeps chats that already have messages", () => {
    expect(
      isEmptyNewChatSetup({
        activeChatId: "chat-1",
        setupChatId: "chat-1",
        chatCharIds: [],
        totalMessageCount: 1,
        messagesLoaded: true,
      }),
    ).toBe(false);
  });

  it("does not treat unrelated empty chats as setup placeholders", () => {
    expect(
      isEmptyNewChatSetup({
        activeChatId: "chat-1",
        setupChatId: "chat-2",
        chatCharIds: [],
        totalMessageCount: 0,
        messagesLoaded: true,
      }),
    ).toBe(false);
  });
});
