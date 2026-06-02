import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
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
