import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Chat } from "../../../../engine/contracts/types/chat";
import type { GameSetupConfig } from "../../../../engine/contracts/types/game";

const storageApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listChatMessages: vi.fn(),
  createChatMessage: vi.fn(),
  updateChatMessage: vi.fn(),
  deleteChatMessage: vi.fn(),
  patchChatMessageExtra: vi.fn(),
  addChatMessageSwipe: vi.fn(),
  patchChatMetadata: vi.fn(),
  patchChatSummaries: vi.fn(),
  listChatMemories: vi.fn(),
  getWorldState: vi.fn(),
  saveTrackerSnapshot: vi.fn(),
  listLorebookEntries: vi.fn(),
  createLorebookEntries: vi.fn(),
  promptFull: vi.fn(),
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: storageApiMock,
}));

// Neutralize side-effecting modules game-api imports so the tests stay surgical.
vi.mock("../../../../shared/api/llm-api", () => ({
  llmApi: { complete: vi.fn(), stream: vi.fn(), listModels: vi.fn() },
}));
vi.mock("../../../../shared/api/integration-gateway", () => ({
  integrationGateway: {
    spotify: {},
    haptic: {},
    customTools: {},
    image: { generate: vi.fn() },
    discord: { mirrorMessage: vi.fn() },
  },
}));
vi.mock("../../../../shared/api/image-generation-api", () => ({
  imageGenerationApi: { generate: vi.fn() },
}));
vi.mock("../../../../shared/api/assets-api", () => ({
  gameAssetsApi: {},
}));
vi.mock("../../../../shared/api/integration-utility-api", () => ({
  spotifyApi: {},
}));

import { gameApi } from "./game-api";

function minimalSetupConfig(overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return {
    genre: "fantasy",
    setting: "test setting",
    tone: "neutral",
    difficulty: "normal",
    playerGoals: "",
    gmMode: "standalone",
    rating: "sfw",
    partyCharacterIds: [],
    ...overrides,
  };
}

function chatCreateCalls(): Array<Record<string, unknown>> {
  return storageApiMock.create.mock.calls
    .filter((call) => call[0] === "chats")
    .map((call) => call[1] as Record<string, unknown>);
}

describe("gameApi.createGame folderId inheritance", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
    storageApiMock.create.mockImplementation(async (entity: string, value: Record<string, unknown>) => ({
      id: `${entity}-new`,
      ...value,
    }));
  });

  it("passes folderId through to the new chat when the new-chat branch fires", async () => {
    await gameApi.createGame({
      name: "Test",
      setupConfig: minimalSetupConfig(),
      folderId: "folder-game-1",
    });

    const payloads = chatCreateCalls();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBe("folder-game-1");
  });

  it("defaults folderId to null when no folderId input is provided", async () => {
    await gameApi.createGame({
      name: "Test",
      setupConfig: minimalSetupConfig(),
    });

    const payloads = chatCreateCalls();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBeNull();
  });
});

describe("gameApi.startSession folderId inheritance", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
    storageApiMock.create.mockImplementation(async (entity: string, value: Record<string, unknown>) => ({
      id: typeof value.id === "string" && value.id ? value.id : `${entity}-new`,
      ...value,
    }));
  });

  it("carries previousChat.folderId onto the new session chat", async () => {
    const previousChat = {
      id: "chat-prev",
      name: "Game Session 1",
      mode: "game",
      characterIds: ["char-a"],
      personaId: null,
      connectionId: null,
      folderId: "folder-session-1",
      metadata: {
        gameId: "game-1",
        gameSessionNumber: 1,
        gameSessionStatus: "concluded",
      },
    } as unknown as Chat;

    storageApiMock.list.mockImplementation(async (entity: string) => {
      if (entity === "chats") return [previousChat];
      return [];
    });

    await gameApi.startSession({ gameId: "game-1" });

    const payloads = chatCreateCalls();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.folderId).toBe("folder-session-1");
  });
});
