import { beforeEach, describe, expect, it, vi } from "vitest";

import { storageApi } from "../../../../shared/api/storage-api";
import { trackerSnapshotApi } from "../../../../shared/api/tracker-snapshot-api";
import { worldStateApi, type WorldState } from "./world-state-api";

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    get: vi.fn(),
    listChatMessages: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/tracker-snapshot-api", () => ({
  trackerSnapshotApi: {
    get: vi.fn(),
    latest: vi.fn(),
    save: vi.fn(),
  },
}));

const storageGetMock = vi.mocked(storageApi.get);
const listChatMessagesMock = vi.mocked(storageApi.listChatMessages);
const snapshotGetMock = vi.mocked(trackerSnapshotApi.get);
const snapshotLatestMock = vi.mocked(trackerSnapshotApi.latest);

function state(overrides: Partial<WorldState> = {}): WorldState {
  return {
    id: "state-1",
    chatId: "chat-1",
    messageId: "message-1",
    swipeIndex: 0,
    date: null,
    time: null,
    location: "Harbor",
    weather: null,
    temperature: null,
    presentCharacters: [
      {
        characterId: "character-1",
        name: "Mari",
        emoji: "",
        mood: "",
        appearance: null,
        outfit: null,
        customFields: {},
        stats: [],
        thoughts: null,
      },
    ],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    createdAt: "2026-05-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("worldStateApi.get", () => {
  beforeEach(() => {
    storageGetMock.mockReset();
    listChatMessagesMock.mockReset();
    snapshotGetMock.mockReset();
    snapshotLatestMock.mockReset();
  });

  it("falls back to synced chat state from an older visible assistant target", async () => {
    storageGetMock.mockResolvedValue({ gameState: state({ id: "chat-state", messageId: "message-1" }) });
    listChatMessagesMock.mockResolvedValue([
      { id: "message-1", role: "assistant", activeSwipeIndex: 0 },
      { id: "message-2", role: "assistant", activeSwipeIndex: 0 },
    ]);
    snapshotGetMock.mockResolvedValue(null);
    snapshotLatestMock.mockResolvedValue(null);

    const result = await worldStateApi.get("chat-1");

    expect(snapshotGetMock).toHaveBeenCalledWith("chat-1", { messageId: "message-2", swipeIndex: 0 });
    expect(result).toEqual(expect.objectContaining({ location: "Harbor", messageId: "message-2", swipeIndex: 0 }));
  });

  it("falls back to the latest tracker snapshot when the visible target has no snapshot", async () => {
    storageGetMock.mockResolvedValue({ gameState: null });
    listChatMessagesMock.mockResolvedValue([
      { id: "message-1", role: "assistant", activeSwipeIndex: 0 },
      { id: "message-2", role: "assistant", activeSwipeIndex: 1 },
    ]);
    snapshotGetMock.mockResolvedValue(null);
    snapshotLatestMock.mockResolvedValue({
      ...state({ id: "snapshot-1", messageId: "message-1", location: "Library" }),
      kind: "tracker",
    });

    const result = await worldStateApi.get("chat-1");

    expect(snapshotLatestMock).toHaveBeenCalledWith("chat-1");
    expect(result).toEqual(expect.objectContaining({ location: "Library", messageId: "message-2", swipeIndex: 1 }));
  });

  it("does not use a visible fallback for explicit target reads", async () => {
    storageGetMock.mockResolvedValue({ gameState: state({ messageId: "message-1" }) });
    snapshotGetMock.mockResolvedValue(null);

    const result = await worldStateApi.get("chat-1", { messageId: "message-2", swipeIndex: 0 });

    expect(listChatMessagesMock).not.toHaveBeenCalled();
    expect(snapshotLatestMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("does not use chat state from a message outside the visible chat history", async () => {
    storageGetMock.mockResolvedValue({ gameState: state({ messageId: "other-chat-message" }) });
    listChatMessagesMock.mockResolvedValue([{ id: "message-2", role: "assistant", activeSwipeIndex: 0 }]);
    snapshotGetMock.mockResolvedValue(null);
    snapshotLatestMock.mockResolvedValue(null);

    await expect(worldStateApi.get("chat-1")).resolves.toBeNull();
  });
});
