import { beforeEach, describe, expect, it, vi } from "vitest";
import { storageApi } from "./storage-api";
import { invokeTauri } from "./tauri-client";

vi.mock("./tauri-client", () => ({
  invokeTauri: vi.fn(),
}));

describe("storageApi typed JSON read normalization", () => {
  const invokeMock = vi.mocked(invokeTauri);

  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("parses message.extra JSON strings at the storage boundary", async () => {
    invokeMock.mockResolvedValueOnce({
      id: "message-1",
      chatId: "chat-1",
      content: "hello",
      extra: '{"thinking":"hidden notes","spriteExpressions":{"char-1":"happy"}}',
    });

    const message = await storageApi.get<Record<string, unknown>>("messages", "message-1");

    expect(message?.extra).toEqual({
      thinking: "hidden notes",
      spriteExpressions: { "char-1": "happy" },
    });
  });

  it("parses chat.metadata JSON strings at the storage boundary", async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: "chat-1",
        name: "Scene",
        metadata: '{"activeAgentIds":["spotify"],"excludePastReasoning":true}',
      },
    ]);

    const chats = await storageApi.list<Record<string, unknown>>("chats");

    expect(chats[0]?.metadata).toEqual({
      activeAgentIds: ["spotify"],
      excludePastReasoning: true,
    });
  });

  it("routes add-swipe content, extra, and activation options through the storage command", async () => {
    invokeMock.mockResolvedValueOnce({ id: "message-1" });

    await storageApi.addChatMessageSwipe("chat-1", "message-1", "first\n\n\nsecond", {
      activate: false,
      extra: { generationInfo: { model: "test-model" } },
    });

    expect(invokeMock).toHaveBeenCalledWith("chat_message_add_swipe", {
      chatId: "chat-1",
      messageId: "message-1",
      body: {
        content: "first\n\nsecond",
        activate: false,
        extra: { generationInfo: { model: "test-model" } },
      },
    });
  });
});
