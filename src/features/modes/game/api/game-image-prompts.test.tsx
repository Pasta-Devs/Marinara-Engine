import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "../../../../engine/contracts/types/chat";

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
  gameAssetsApi: { upload: vi.fn() },
}));
vi.mock("../../../../shared/api/integration-utility-api", () => ({
  spotifyApi: {},
}));

import { gameApi } from "./game-api";
import { gameAssetsApi } from "../../../../shared/api/assets-api";
import { imageGenerationApi } from "../../../../shared/api/image-generation-api";

describe("game image prompt overrides", () => {
  beforeEach(() => {
    Object.values(storageApiMock).forEach((fn) => fn.mockReset());
    vi.mocked(imageGenerationApi.generate).mockReset();
    vi.mocked(gameAssetsApi.upload).mockReset();
  });

  function mockGameAssetChat(promptOverrides: Record<string, string> = {}) {
    let chat = {
      id: "chat-game",
      name: "Game",
      mode: "game",
      characterIds: [],
      metadata: {
        enableSpriteGeneration: true,
        gameImageConnectionId: "image-conn",
        gameSetupConfig: {
          artStylePrompt: "inked fantasy art",
        },
        gameNpcs: [],
      },
    } as unknown as Chat;

    storageApiMock.get.mockImplementation(async (entity: string, id: string) => {
      if (entity === "chats" && id === chat.id) return chat;
      if (entity === "prompt-overrides" && promptOverrides[id]) {
        return {
          id,
          key: id,
          template: promptOverrides[id],
          enabled: true,
          updatedAt: "2026-05-31T00:00:00.000Z",
        };
      }
      return null;
    });
    storageApiMock.update.mockImplementation(async (entity: string, id: string, patch: Record<string, unknown>) => {
      if (entity !== "chats" || id !== chat.id) return null;
      chat = {
        ...chat,
        ...patch,
        metadata: {
          ...((chat.metadata ?? {}) as Record<string, unknown>),
          ...((patch.metadata ?? {}) as Record<string, unknown>),
        },
      } as unknown as Chat;
      return chat;
    });
    vi.mocked(imageGenerationApi.generate).mockResolvedValue({
      base64: "aGVsbG8=",
      mimeType: "image/png",
      image: "data:image/png;base64,aGVsbG8=",
    });
    vi.mocked(gameAssetsApi.upload).mockResolvedValue({
      item: { path: "backgrounds/generated/asset.png" },
    });
  }

  it("sends registered game image overrides to the provider for each asset builder", async () => {
    mockGameAssetChat({
      "game.background": "REGISTERED BACKGROUND ${label} :: ${defaultPrompt}",
      "game.illustration": "REGISTERED ILLUSTRATION ${label} :: ${defaultPrompt}",
      "game.portrait": "REGISTERED PORTRAIT ${label} :: ${defaultPrompt}",
    });

    await gameApi.generateAssets({
      chatId: "chat-game",
      backgroundTag: "misty forest",
      illustration: { reason: "ambush reveal", prompt: "bandits step from fog", slug: "ambush" },
      npcsNeedingAvatars: [{ name: "Mira", description: "silver hair, green cloak" }],
    });

    const prompts = vi
      .mocked(imageGenerationApi.generate)
      .mock.calls.map((call) => (call[0] as { prompt?: string }).prompt ?? "");

    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain("REGISTERED BACKGROUND misty forest :: Wide establishing background");
    expect(prompts[1]).toContain("REGISTERED ILLUSTRATION ambush reveal :: Cinematic scene illustration");
    expect(prompts[2]).toContain("REGISTERED PORTRAIT Mira :: Portrait of Mira");
  });

  it("keeps transient review overrides ahead of registered game image overrides", async () => {
    mockGameAssetChat({
      "game.background": "REGISTERED BACKGROUND ${label} :: ${defaultPrompt}",
    });

    await gameApi.generateAssets({
      chatId: "chat-game",
      backgroundTag: "misty forest",
      promptOverrides: [{ id: "background:misty-forest", prompt: "TRANSIENT BACKGROUND PROMPT" }],
    });

    expect(vi.mocked(imageGenerationApi.generate)).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "TRANSIENT BACKGROUND PROMPT" }),
    );
  });
});
