import { describe, expect, it } from "vitest";

import { isEmptyNewChatSetup } from "./empty-new-chat";

describe("isEmptyNewChatSetup", () => {
  it("detects a persisted setup placeholder with no characters or messages", () => {
    expect(
      isEmptyNewChatSetup({
        chat: { id: "chat-1" },
        chatCharIds: [],
        totalMessageCount: 0,
      }),
    ).toBe(true);
  });

  it("keeps chats that already have selected characters", () => {
    expect(
      isEmptyNewChatSetup({
        chat: { id: "chat-1" },
        chatCharIds: ["char-1"],
        totalMessageCount: 0,
      }),
    ).toBe(false);
  });

  it("keeps chats that already have messages", () => {
    expect(
      isEmptyNewChatSetup({
        chat: { id: "chat-1" },
        chatCharIds: [],
        totalMessageCount: 1,
      }),
    ).toBe(false);
  });

  it("does not treat unloaded chat state as a placeholder", () => {
    expect(
      isEmptyNewChatSetup({
        chat: null,
        chatCharIds: [],
        totalMessageCount: 0,
      }),
    ).toBe(false);
  });
});
