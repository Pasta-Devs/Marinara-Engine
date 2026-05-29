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

import { applyGameJsonRepair, gameApi } from "./game-api";
import { llmApi } from "../../../../shared/api/llm-api";
import { getJsonRepairRequest } from "../../../../shared/api/api-errors";

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

describe("gameApi.setupGame response contract", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
  });

  it("returns the updated ready session chat after setup succeeds", async () => {
    let chat = {
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      connectionId: "conn-gm",
      metadata: {
        gameId: "game-1",
        gameSessionStatus: "setup",
        gameSetupConfig: minimalSetupConfig(),
      },
    } as unknown as Chat;

    storageApiMock.get.mockImplementation(async (entity: string, id: string) => {
      if (entity === "chats" && id === chat.id) return chat;
      return null;
    });
    storageApiMock.update.mockImplementation(async (entity: string, id: string, patch: Record<string, unknown>) => {
      if (entity !== "chats" || id !== chat.id) return null;
      chat = { ...chat, ...patch } as Chat;
      return chat;
    });

    const result = await gameApi.setupGame({
      chatId: chat.id,
      preferences: "short local test",
    });

    expect(result.sessionChat.id).toBe("chat-game");
    expect(result.sessionChat.metadata).toMatchObject({
      gameSessionStatus: "ready",
      gameWorldOverview: expect.any(String),
      gameMap: expect.any(Object),
    });
  });
});

describe("gameApi metadata mutation response contracts", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
    vi.mocked(llmApi.complete).mockReset();
  });

  function mockChat(initial: Chat) {
    let chat = initial;
    storageApiMock.get.mockImplementation(async (entity: string, id: string) => {
      if (entity === "chats" && id === chat.id) return chat;
      return null;
    });
    storageApiMock.update.mockImplementation(async (entity: string, id: string, patch: Record<string, unknown>) => {
      if (entity !== "chats" || id !== chat.id) return null;
      const patchMetadata =
        patch.metadata && typeof patch.metadata === "object" && !Array.isArray(patch.metadata)
          ? (patch.metadata as Record<string, unknown>)
          : {};
      chat = {
        ...chat,
        ...patch,
        metadata: {
          ...((chat.metadata ?? {}) as Record<string, unknown>),
          ...patchMetadata,
        },
      } as Chat;
      return chat;
    });
    return () => chat;
  }

  it("returns the active session chat when starting a game", async () => {
    const readChat = mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "ready",
      },
    } as unknown as Chat);
    storageApiMock.list.mockImplementation(async (entity: string) => {
      if (entity === "messages") return [];
      return [];
    });

    const result = await gameApi.startGame({ chatId: "chat-game" });

    expect(result.sessionChat).toMatchObject(readChat());
    expect(result.sessionChat.metadata).toMatchObject({
      gameSessionStatus: "active",
      gameActiveState: "exploration",
    });
  });

  it("returns the updated session chat when map generation persists map metadata", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);

    const result = await gameApi.generateMap({
      chatId: "chat-game",
      locationType: "Forest",
      context: "misty trail",
    });

    expect(vi.mocked(llmApi.complete)).not.toHaveBeenCalled();
    expect(result.sessionChat.id).toBe("chat-game");
    expect(result.sessionChat.metadata).toMatchObject({
      gameMap: result.map,
      gameMaps: [result.map],
      activeGameMapId: result.activeGameMapId,
    });
  });

  it("uses the map generation prompt helper when a map connection is selected", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);
    vi.mocked(llmApi.complete).mockResolvedValueOnce(
      JSON.stringify({
        type: "node",
        name: "Old Library",
        description: "Stacks, dust, and a sealed reading room.",
        nodes: [
          { id: "entrance", label: "Entrance", x: 50, y: 90, discovered: true },
          { id: "reading-room", label: "Reading Room", x: 50, y: 45, discovered: false },
        ],
        edges: [{ from: "entrance", to: "reading-room" }],
        partyPosition: "entrance",
      }),
    );

    const result = await gameApi.generateMap({
      chatId: "chat-game",
      locationType: "Library",
      context: "Dusty stacks beneath a storm.",
      connectionId: "connection-map",
    });

    expect(vi.mocked(llmApi.complete)).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: "connection-map",
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("RPG map JSON"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Location type: Library"),
          }),
        ],
      }),
    );
    expect(vi.mocked(llmApi.complete).mock.calls[0]?.[0]?.messages[1]?.content).toContain(
      "Context: Dusty stacks beneath a storm.",
    );
    expect(result.map).toMatchObject({
      id: "old-library",
      type: "node",
      name: "Old Library",
      partyPosition: "entrance",
      nodes: [
        expect.objectContaining({ id: "entrance", label: "Entrance", discovered: true }),
        expect.objectContaining({ id: "reading-room", label: "Reading Room", discovered: false }),
      ],
      edges: [{ from: "entrance", to: "reading-room" }],
    });
    expect(result.sessionChat.metadata).toMatchObject({
      gameMap: result.map,
      activeGameMapId: "old-library",
    });
  });

  it("surfaces invalid generated map JSON through the repair flow", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);
    vi.mocked(llmApi.complete).mockResolvedValueOnce("this is not json");

    let thrown: unknown = null;
    try {
      await gameApi.generateMap({
        chatId: "chat-game",
        locationType: "Cave",
        context: "Wet stone and bad echoes.",
        connectionId: "connection-map",
      });
    } catch (error) {
      thrown = error;
    }

    const repair = getJsonRepairRequest(thrown);
    expect(repair).toMatchObject({
      kind: "game_map",
      title: "Repair Game Map JSON",
      rawJson: "this is not json",
      applyEndpoint: "local://game/game_map",
      applyBody: {
        chatId: "chat-game",
        locationType: "Cave",
        context: "Wet stone and bad echoes.",
        connectionId: "connection-map",
      },
    });
  });

  it("applies repaired map JSON back through map generation persistence", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);

    const result = await applyGameJsonRepair(
      {
        kind: "game_map",
        title: "Repair Game Map JSON",
        applyEndpoint: "local://game/game_map",
        applyBody: {
          chatId: "chat-game",
          locationType: "Cave",
          context: "Wet stone and bad echoes.",
          connectionId: "connection-map",
        },
      },
      JSON.stringify({
        type: "node",
        name: "Echo Cave",
        description: "A repaired cave map.",
        nodes: [{ id: "mouth", label: "Mouth", x: 50, y: 90, discovered: true }],
        edges: [],
        partyPosition: "mouth",
      }),
    );

    expect(result).toMatchObject({
      map: {
        id: "echo-cave",
        type: "node",
        name: "Echo Cave",
        partyPosition: "mouth",
      },
      activeGameMapId: "echo-cave",
    });
  });

  it("normalizes generated grid maps to renderable bounds", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);
    vi.mocked(llmApi.complete).mockResolvedValueOnce(
      JSON.stringify({
        type: "grid",
        name: "Storm Road",
        description: "A broken road in heavy rain.",
        width: 2,
        height: 2,
        cells: [
          { x: -10, y: 99, emoji: "🌧️", label: "Gate", discovered: false, terrain: "road" },
          { x: "", y: false, emoji: "⛺", label: "Camp", discovered: true, terrain: "town" },
        ],
        partyPosition: { x: 99, y: 99 },
      }),
    );

    const result = await gameApi.generateMap({
      chatId: "chat-game",
      locationType: "Road",
      context: "Rain and broken carts.",
      connectionId: "connection-map",
    });

    expect(result.map).toMatchObject({
      type: "grid",
      width: 2,
      height: 2,
      partyPosition: { x: 1, y: 0 },
      cells: [
        expect.objectContaining({ x: 0, y: 1, label: "Gate" }),
        expect.objectContaining({ x: 1, y: 0, label: "Camp", discovered: true }),
      ],
    });
  });

  it("deduplicates generated node ids before saving node maps", async () => {
    mockChat({
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionStatus: "active",
      },
    } as unknown as Chat);
    vi.mocked(llmApi.complete).mockResolvedValueOnce(
      JSON.stringify({
        type: "node",
        name: "Mirror Vault",
        description: "Two mirrored rooms share the same model id.",
        nodes: [
          { id: "room", label: "Left Room", x: 25, y: 50, discovered: true },
          { id: "room", label: "Right Room", x: 75, y: 50, discovered: false },
        ],
        edges: [{ from: "room", to: "room" }],
        partyPosition: "missing",
      }),
    );

    const result = await gameApi.generateMap({
      chatId: "chat-game",
      locationType: "Vault",
      context: "Mirrors everywhere.",
      connectionId: "connection-map",
    });

    expect(result.map).toMatchObject({
      type: "node",
      partyPosition: "room",
      nodes: [
        expect.objectContaining({ id: "room", label: "Left Room" }),
        expect.objectContaining({ id: "room-2", label: "Right Room" }),
      ],
      edges: [{ from: "room", to: "room-2" }],
    });
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

describe("gameApi.concludeSession summary normalization", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
  });

  it("dedupes repeated session summary facts across buckets before saving metadata", async () => {
    let chat = {
      id: "chat-game",
      name: "Game Session 1",
      mode: "game",
      characterIds: [],
      metadata: {
        gameSessionNumber: 1,
        gameSessionStatus: "active",
        gameJournal: [],
        gameNpcs: [],
        gameMap: null,
      },
    } as unknown as Chat;

    storageApiMock.get.mockImplementation(async (entity: string, id: string) => {
      if (entity === "chats" && id === chat.id) return chat;
      return null;
    });
    storageApiMock.update.mockImplementation(async (entity: string, id: string, patch: Record<string, unknown>) => {
      if (entity !== "chats" || id !== chat.id) return null;
      chat = {
        ...chat,
        ...patch,
        metadata: {
          ...((chat.metadata ?? {}) as Record<string, unknown>),
          ...((patch.metadata as Record<string, unknown> | undefined) ?? {}),
        },
      } as Chat;
      return chat;
    });

    const result = await gameApi.concludeSession({
      chatId: "chat-game",
      summary: {
        sessionNumber: 1,
        summary: "The party found the moon key.",
        resumePoint: "At the gate.",
        partyDynamics: "Steady.",
        partyState: "Ready.",
        keyDiscoveries: ["Mira apologized.", "Found the moon key.", "Found the moon key!"],
        characterMoments: ["Mira apologized."],
        littleDetails: [],
        npcUpdates: [],
        statsSnapshot: {},
        nextSessionRequest: null,
        timestamp: "2026-05-29T00:00:00.000Z",
      },
    });

    expect(result.summary.characterMoments).toEqual(["Mira apologized."]);
    expect(result.summary.keyDiscoveries).toEqual(["Found the moon key."]);
    expect((result.sessionChat.metadata as Record<string, unknown>).gamePreviousSessionSummaries).toEqual([
      result.summary,
    ]);
  });
});

describe("gameApi.partyTurn prompt wiring", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
    vi.mocked(llmApi.complete).mockReset();
  });

  function mockPartyChat(metadata: Record<string, unknown> = {}) {
    storageApiMock.get.mockImplementation(async (entity: string, id: string) => {
      if (entity === "chats" && id === "chat-game") {
        return {
          id,
          mode: "game",
          metadata: {
            gameActiveState: "dialogue",
            gamePlayerName: "Captain",
            gameCharacterCards: [
              {
                name: "Mira",
                shortDescription: "Scout with dry humor.",
                class: "Ranger",
                abilities: ["Track"],
                strengths: ["Keeps watch"],
                weaknesses: ["Distrusts nobles"],
                rpgStats: {
                  attributes: [{ name: "DEX", value: 14, vendorAttributeSecret: "drop me" }],
                  hp: { value: 18, max: 20, vendorHpSecret: "drop me too" },
                  vendorStatsSecret: "do not prompt",
                },
                extra: { vendorExtraSecret: "do not prompt" },
                vendorCardSecret: "do not prompt",
              },
            ],
            ...metadata,
          },
        };
      }
      return null;
    });
  }

  it("uses the structured party prompt helper when generating party banter", async () => {
    mockPartyChat();
    vi.mocked(llmApi.complete).mockResolvedValueOnce(`[Mira] [main] [smirk]: "On it."`);
    storageApiMock.create.mockResolvedValueOnce({ id: "message-party" });

    const result = await gameApi.partyTurn({
      chatId: "chat-game",
      connectionId: "connection-party",
      narration: "A locked gate blocks the path.",
      playerAction: "Ask Mira what she sees.",
    });

    expect(result.raw).toBe(`[Mira] [main] [smirk]: "On it."`);
    expect(result.messageId).toBe("message-party");
    expect(vi.mocked(llmApi.complete).mock.calls[0]?.[0]).toMatchObject({
      connectionId: "connection-party",
      messages: [
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("<party_agent_role>"),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("A locked gate blocks the path."),
        }),
      ],
    });
    const systemPrompt = vi.mocked(llmApi.complete).mock.calls[0]?.[0]?.messages[0]?.content ?? "";
    expect(systemPrompt).toContain(`<party_member name="Mira">`);
    expect(systemPrompt).toContain(`"shortDescription": "Scout with dry humor."`);
    expect(systemPrompt).toContain(`"abilities": [`);
    expect(systemPrompt).toContain(`"name": "DEX"`);
    expect(systemPrompt).toContain("Current game state: dialogue");
    expect(systemPrompt).toContain("NEVER generate dialogue lines for the player (Captain)");
    expect(systemPrompt).not.toContain("vendorCardSecret");
    expect(systemPrompt).not.toContain("vendorExtraSecret");
    expect(systemPrompt).not.toContain("vendorStatsSecret");
    expect(systemPrompt).not.toContain("vendorAttributeSecret");
    expect(systemPrompt).not.toContain("vendorHpSecret");
    expect(storageApiMock.create).toHaveBeenCalledWith(
      "messages",
      expect.objectContaining({
        chatId: "chat-game",
        role: "assistant",
        content: `[party-turn]\n[Mira] [main] [smirk]: "On it."`,
      }),
    );
  });

  it("does not persist a canned party turn when no chat connection is selected", async () => {
    mockPartyChat();

    await expect(
      gameApi.partyTurn({
        chatId: "chat-game",
        connectionId: null,
        narration: "A locked gate blocks the path.",
        playerAction: "Ask Mira what she sees.",
      }),
    ).rejects.toThrow("Choose a chat connection");

    expect(vi.mocked(llmApi.complete)).not.toHaveBeenCalled();
    expect(storageApiMock.create).not.toHaveBeenCalled();
  });

  it("does not persist a party turn when the provider call fails", async () => {
    mockPartyChat();
    vi.mocked(llmApi.complete).mockRejectedValueOnce(new Error("provider offline"));

    await expect(
      gameApi.partyTurn({
        chatId: "chat-game",
        connectionId: "connection-party",
        narration: "A locked gate blocks the path.",
        playerAction: "Ask Mira what she sees.",
      }),
    ).rejects.toThrow("provider offline");

    expect(storageApiMock.create).not.toHaveBeenCalled();
  });

  it("does not persist a hidden party turn when the model output has no dialogue lines", async () => {
    mockPartyChat();
    vi.mocked(llmApi.complete).mockResolvedValueOnce("The party considers the situation.");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(
        gameApi.partyTurn({
          chatId: "chat-game",
          connectionId: "connection-party",
          narration: "A locked gate blocks the path.",
          playerAction: "Ask Mira what she sees.",
        }),
      ).rejects.toThrow("empty or malformed");
    } finally {
      warnSpy.mockRestore();
    }

    expect(storageApiMock.create).not.toHaveBeenCalled();
  });
});
