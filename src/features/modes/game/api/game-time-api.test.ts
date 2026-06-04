import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "../../../../engine/contracts/types/chat";

const storage = {
  get: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: storage,
}));

const { gameApi } = await import("./game-api");

function makeChat(metadata: Partial<Chat["metadata"]>): Chat {
  return {
    id: "chat-1",
    name: "Game",
    mode: "game",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    metadata: {
      summary: null,
      tags: [],
      agentOverrides: {},
      activeAgentIds: [],
      activeToolIds: [],
      presetChoices: {},
      ...metadata,
    },
  };
}

describe("gameApi.advanceTime", () => {
  beforeEach(() => {
    storage.get.mockReset();
    storage.update.mockReset();
  });

  it("routes scene time-of-day labels to canonical clock jumps", async () => {
    const chat = makeChat({
      gameTime: { day: 1, hour: 8, minute: 45 },
    });

    storage.get.mockResolvedValue(chat);
    storage.update.mockImplementation(async (_entity, _id, patch) => ({ ...chat, ...patch }));

    const result = await gameApi.advanceTime({ chatId: "chat-1", action: "night" });

    expect(result.time).toEqual({ day: 1, hour: 21, minute: 0 });
    expect(result.formatted).toBe("Day 1, 21:00 (night)");
    expect(storage.update).toHaveBeenCalledWith("chats", "chat-1", {
      metadata: expect.objectContaining({
        gameTime: { day: 1, hour: 21, minute: 0 },
        gameTimeFormatted: "Day 1, 21:00 (night)",
      }),
    });
  });

  it("keeps ordinary action durations on advanceTime", async () => {
    const chat = makeChat({
      gameTime: { day: 1, hour: 8, minute: 45 },
    });

    storage.get.mockResolvedValue(chat);
    storage.update.mockImplementation(async (_entity, _id, patch) => ({ ...chat, ...patch }));

    const result = await gameApi.advanceTime({ chatId: "chat-1", action: "explore" });

    expect(result.time).toEqual({ day: 1, hour: 9, minute: 15 });
  });

  it("formats noon scene labels as noon after jumping the clock", async () => {
    const chat = makeChat({
      gameTime: { day: 1, hour: 11, minute: 50 },
    });

    storage.get.mockResolvedValue(chat);
    storage.update.mockImplementation(async (_entity, _id, patch) => ({ ...chat, ...patch }));

    const result = await gameApi.advanceTime({ chatId: "chat-1", action: "noon" });

    expect(result.time).toEqual({ day: 1, hour: 12, minute: 0 });
    expect(result.formatted).toBe("Day 1, 12:00 (noon)");
  });
});
