import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import type { VisualAssetGateway } from "../capabilities/visual-assets";
import { buildPartySystemPrompt } from "../modes/game/prompts/party-prompts";
import { loadCharacterSprites } from "../modes/game/prompts/sprite.service";
import { assembleGenerationPrompt } from "./prompt-assembly";

type RowMap = Record<string, unknown[]>;

function storageWithRows(rows: RowMap): StorageGateway {
  return {
    list: async <T = unknown>(entity: string) => (rows[entity] ?? []) as T[],
    get: async <T = unknown>(entity: string, id: string) =>
      ((rows[entity]?.find((row) => (row as { id?: string }).id === id) ?? null) as T | null),
    create: async <T = unknown>() => ({} as T),
    update: async <T = unknown>() => ({} as T),
    delete: async () => ({ deleted: true }),
    listChatMessages: async <T = unknown>() => [] as T[],
    createChatMessage: async <T = unknown>() => ({} as T),
    updateChatMessage: async <T = unknown>() => ({} as T),
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T = unknown>() => ({} as T),
    addChatMessageSwipe: async <T = unknown>() => ({} as T),
    patchChatMetadata: async <T = unknown>() => ({} as T),
    patchChatSummaries: async <T = unknown>() => ({} as T),
    listChatMemories: async <T = unknown>() => [] as T[],
    getWorldState: async <T = unknown>() => null as T | null,
    saveTrackerSnapshot: async <T = unknown>() => ({} as T),
    listLorebookEntries: async <T = unknown>(lorebookId: string) =>
      (rows["lorebook-entries"] ?? []).filter((row) => (row as { lorebookId?: string }).lorebookId === lorebookId) as T[],
    createLorebookEntries: async <T = unknown>() => [] as T[],
    promptFull: async <T = unknown>() => null as T | null,
  };
}

function depthInjectionRows(): RowMap {
  return {
    prompts: [
      {
        id: "preset-1",
        isDefault: true,
        wrapFormat: "none",
        parameters: { strictRoleFormatting: false },
      },
    ],
    "prompt-sections": [
      {
        id: "system",
        presetId: "preset-1",
        role: "system",
        content: "system prompt",
        enabled: true,
      },
      {
        id: "history",
        presetId: "preset-1",
        identifier: "chat_history",
        enabled: true,
      },
      {
        id: "post-history",
        presetId: "preset-1",
        role: "system",
        content: "post-history prompt",
        enabled: true,
      },
    ],
    "prompt-groups": [],
    "prompt-choice-blocks": [],
    characters: [],
    personas: [],
    lorebooks: [{ id: "lorebook-1", name: "Depth lore", enabled: true, isGlobal: true }],
    "lorebook-folders": [],
    "lorebook-entries": [
      {
        id: "entry-1",
        lorebookId: "lorebook-1",
        name: "Depth entry",
        content: "depth lore entry",
        constant: true,
        position: 2,
        depth: 0,
        role: "system",
        enabled: true,
      },
    ],
    "regex-scripts": [],
  };
}

describe("assembleGenerationPrompt depth injection", () => {
  it("anchors lorebook depth entries to chat history bounds", async () => {
    const storage = storageWithRows(depthInjectionRows());

    const assembly = await assembleGenerationPrompt(storage, {
      chat: { id: "chat-1", mode: "roleplay", promptPresetId: "preset-1", metadata: {} },
      storedMessages: [{ id: "message-1", role: "user", content: "latest user message" }],
      connection: {},
      request: {},
      latestUserInput: "latest user message",
    });

    expect(assembly.previewMessages.map((message) => message.content)).toEqual([
      "system prompt",
      "latest user message",
      "depth lore entry",
      "post-history prompt",
    ]);
  });

  it("falls back to full prompt bounds when no chat history exists", async () => {
    const storage = storageWithRows(depthInjectionRows());

    const assembly = await assembleGenerationPrompt(storage, {
      chat: { id: "chat-1", mode: "roleplay", promptPresetId: "preset-1", metadata: {} },
      storedMessages: [],
      connection: {},
      request: {},
      latestUserInput: "",
    });

    expect(assembly.previewMessages.map((message) => message.content)).toEqual([
      "system prompt",
      "post-history prompt",
      "depth lore entry",
    ]);
  });
});

describe("assembleGenerationPrompt game sprites", () => {
  const visuals: VisualAssetGateway = {
    listSprites: async (ownerId) =>
      ownerId === "char-1"
        ? [
            { expression: "neutral" },
            { expression: "joy_01" },
            { expression: "full_idle" },
            { expression: "full_walk" },
            { expression: "full_cape_flare" },
          ]
        : [{ expression: "worried" }],
    listBackgrounds: async () => [],
  };

  it("passes party sprite availability into the GM prompt reminder", async () => {
    const storage = storageWithRows({
      prompts: [],
      characters: [
        { id: "char-1", name: "Marina", data: { name: "Marina", description: "A careful scout." } },
        { id: "char-2", name: "Sol", data: { name: "Sol", description: "A bright mage." } },
      ],
      personas: [],
      lorebooks: [],
      "lorebook-folders": [],
      "lorebook-entries": [],
      "regex-scripts": [],
    });

    const assembly = await assembleGenerationPrompt(storage, {
      chat: {
        id: "chat-1",
        mode: "game",
        characterIds: ["char-1", "char-2"],
        metadata: {
          gamePartyCharacterIds: ["char-1", "char-2"],
          gameSetupConfig: { genre: "fantasy", setting: "coast", tone: "warm", difficulty: "normal" },
        },
      },
      storedMessages: [{ id: "message-1", role: "user", content: "Look around." }],
      connection: {},
      request: {},
      latestUserInput: "Look around.",
      visuals,
    });

    const prompt = assembly.previewMessages.map((message) => message.content).join("\n\n");
    expect(prompt).toContain("Available custom sprites per character");
    expect(prompt).toContain("Marina (expressions): neutral, joy_01");
    expect(prompt).toContain("Marina (full-body): cape_flare");
    expect(prompt).toContain("Sol (expressions): worried");
    expect(prompt).not.toContain("Marina (full-body): idle");
    expect(prompt).not.toContain("Marina (full-body): walk");
  });

  it("passes party sprite availability into the party-agent prompt", async () => {
    const characterSprites = await loadCharacterSprites(visuals, [
      { id: "char-1", name: "Marina" },
      { id: "char-2", name: "Sol" },
    ]);

    const prompt = buildPartySystemPrompt({
      partyCards: [
        { name: "Marina", card: "Name: Marina\nDescription: A careful scout." },
        { name: "Sol", card: "Name: Sol\nDescription: A bright mage." },
      ],
      playerName: "Player",
      gameActiveState: "exploration",
      characterSprites,
    });

    expect(prompt).toContain("Available sprites per character");
    expect(prompt).toContain("Marina: neutral, joy_01 | custom full-body aliases: cape_flare");
    expect(prompt).toContain("Sol: worried");
    expect(prompt).not.toContain("custom full-body aliases: idle");
    expect(prompt).not.toContain("custom full-body aliases: walk");
  });
});
