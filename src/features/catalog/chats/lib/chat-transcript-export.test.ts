import { describe, expect, it } from "vitest";
import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import {
  buildChatTranscriptZipFiles,
  chatExportFilename,
  formatChatJsonl,
  formatChatText,
} from "./chat-transcript-export";

function chat(partial: Partial<Chat>): Chat {
  return {
    id: "chat-1",
    name: "Example Chat",
    mode: "conversation",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    metadata: {
      summary: null,
      tags: [],
      enableAgents: false,
      agentOverrides: {},
      activeAgentIds: [],
      activeToolIds: [],
      presetChoices: {},
    },
    ...partial,
  };
}

function message(partial: Partial<Message>): Message {
  return {
    id: "message-1",
    chatId: "chat-1",
    role: "user",
    characterId: null,
    content: "Hello",
    activeSwipeIndex: 0,
    createdAt: "2026-05-27T00:00:00.000Z",
    extra: {
      displayText: null,
      isGenerated: false,
      tokenCount: null,
      generationInfo: null,
    },
    ...partial,
  };
}

describe("chat transcript export", () => {
  it("formats single-chat JSONL exports with one message per line", () => {
    const messages = [
      message({ id: "message-1", role: "user", content: "Hello" }),
      message({ id: "message-2", role: "assistant", content: "Hi back" }),
    ];

    const exported = formatChatJsonl(messages);
    const lines = exported.trimEnd().split("\n").map((line) => JSON.parse(line));

    expect(lines).toEqual([
      expect.objectContaining({ id: "message-1", role: "user", content: "Hello" }),
      expect.objectContaining({ id: "message-2", role: "assistant", content: "Hi back" }),
    ]);
    expect(exported.endsWith("\n")).toBe(true);
  });

  it("formats single-chat text exports as a readable transcript", () => {
    expect(
      formatChatText([
        message({ role: "user", content: "First" }),
        message({ id: "message-2", role: "assistant", content: "Second" }),
      ]),
    ).toBe("user: First\n\nassistant: Second");
  });

  it("builds JSONL and text ZIP payload files for selected chats", () => {
    const chats = [
      {
        chat: chat({ id: "chat-1", name: "My Chat" }),
        messages: [message({ chatId: "chat-1", content: "One" })],
      },
      {
        chat: chat({
          id: "chat-2",
          name: "Ignored Name",
          metadata: {
            summary: null,
            tags: [],
            enableAgents: false,
            agentOverrides: {},
            activeAgentIds: [],
            activeToolIds: [],
            presetChoices: {},
            branchName: "Branched: Scene",
          },
        }),
        messages: [message({ id: "message-2", chatId: "chat-2", content: "Two" })],
      },
    ];

    expect(buildChatTranscriptZipFiles(chats, "jsonl")).toEqual([
      {
        name: "My_Chat.jsonl",
        data: expect.stringContaining("\"content\":\"One\""),
      },
      {
        name: "Branched_Scene.jsonl",
        data: expect.stringContaining("\"content\":\"Two\""),
      },
    ]);
    expect(buildChatTranscriptZipFiles(chats, "text")).toEqual([
      { name: "My_Chat.txt", data: "user: One" },
      { name: "Branched_Scene.txt", data: "user: Two" },
    ]);
  });

  it("sanitizes transcript filenames", () => {
    expect(chatExportFilename(chat({ name: "A/B:C*D?" }), "jsonl")).toBe("A_B_C_D.jsonl");
  });
});
