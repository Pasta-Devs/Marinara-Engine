import { describe, expect, it, vi } from "vitest";
import type { IntegrationGateway } from "../../../capabilities/integrations";
import type { LlmGateway } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import type { PromptAttachment } from "../../../generation/generate-route-utils";
import { startGameTurnGeneration } from "./game-turn.service";

function depsForGameChat() {
  const get = vi.fn(async (entity: string, id: string) => {
    if (entity === "chats" && id === "chat-1") {
      return {
        id: "chat-1",
        mode: "game",
        connectionId: "connection-1",
        characterIds: ["char-1"],
        metadata: { gameSessionStatus: "active" },
      };
    }
    if (entity === "connections" && id === "connection-1") {
      return { id: "connection-1", model: "test-model", defaultParameters: {} };
    }
    return null;
  });
  const listChatMessages = vi.fn(async () => {
    throw new Error("listChatMessages should not be called");
  });
  const createChatMessage = vi.fn(async () => {
    throw new Error("createChatMessage should not be called");
  });
  const stream = vi.fn(async function* () {
    throw new Error("llm.stream should not be called");
  });

  return {
    deps: {
      storage: { get, listChatMessages, createChatMessage } as Partial<StorageGateway> as StorageGateway,
      llm: { stream } as Partial<LlmGateway> as LlmGateway,
      integrations: {} as Partial<IntegrationGateway> as IntegrationGateway,
    },
    get,
    listChatMessages,
    createChatMessage,
    stream,
  };
}

async function drain(stream: AsyncGenerator<unknown>) {
  for await (const _event of stream) {
    // Exhaust the generator so attempted side effects become visible.
  }
}

describe("startGameTurnGeneration", () => {
  it("does not start generation for a whitespace-only player turn", async () => {
    const { deps, get, listChatMessages, createChatMessage, stream } = depsForGameChat();

    await drain(
      startGameTurnGeneration(deps, {
        chatId: "chat-1",
        connectionId: "connection-1",
        kind: "turn",
        userMessage: "   \n  ",
      }),
    );

    expect(get).toHaveBeenCalledWith("chats", "chat-1");
    expect(listChatMessages).not.toHaveBeenCalled();
    expect(createChatMessage).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });

  it("keeps attachment-only player turns eligible for generation", async () => {
    const { deps, listChatMessages } = depsForGameChat();
    const textAttachment: PromptAttachment = { type: "text/plain", data: "note" };

    await expect(() =>
      drain(
        startGameTurnGeneration(deps, {
          chatId: "chat-1",
          connectionId: "connection-1",
          kind: "turn",
          userMessage: " ",
          attachments: [textAttachment],
        }),
      ),
    ).rejects.toThrow("listChatMessages should not be called");
    expect(listChatMessages).toHaveBeenCalled();
  });
});
