import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { fingerprintChatSummary } from "../shared/text/chat-summary-fingerprint";
import { previewGenerationPrompt } from "./prompt-preview";

type Row = Record<string, unknown>;

function previewStorage(options: {
  chat?: Row;
  connection?: Row;
  messages?: Row[];
  prompts?: Row[];
  promptSections?: Row[];
}) {
  const chat = {
    id: "chat-1",
    mode: "roleplay",
    connectionId: "connection-1",
    metadata: {},
    ...(options.chat ?? {}),
  };
  const connection = {
    id: "connection-1",
    model: "test-model",
    provider: "openai",
    defaultParameters: {},
    ...(options.connection ?? {}),
  };
  const messages = options.messages ?? [];
  const prompts = options.prompts ?? [];
  const promptSections = options.promptSections ?? [];

  const storage = {
    get: vi.fn(async (entity: string, id: string) => {
      if (entity === "chats" && id === "chat-1") return chat;
      if (entity === "connections" && id === "connection-1") return connection;
      if (entity === "messages") return messages.find((message) => message.id === id) ?? null;
      if (entity === "prompts") return prompts.find((prompt) => prompt.id === id) ?? null;
      return null;
    }),
    list: vi.fn(async (entity: string, listOptions?: { filters?: Record<string, unknown> }) => {
      if (entity === "connections") return [connection];
      if (entity === "prompts") return prompts;
      if (entity === "prompt-sections") {
        return promptSections.filter((section) => section.presetId === listOptions?.filters?.presetId);
      }
      if (entity === "prompt-variables") return [];
      return [];
    }),
    listChatMessages: vi.fn(async () => messages),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createChatMessage: vi.fn(),
    updateChatMessage: vi.fn(),
    deleteChatMessage: vi.fn(),
    patchChatMessageExtra: vi.fn(),
    addChatMessageSwipe: vi.fn(),
    patchChatMetadata: vi.fn(),
    patchChatSummaries: vi.fn(),
    listChatMemories: vi.fn(async () => []),
    getWorldState: vi.fn(async () => null),
    saveTrackerSnapshot: vi.fn(),
    listLorebookEntries: vi.fn(async () => []),
    createLorebookEntries: vi.fn(),
  } as Partial<StorageGateway> as StorageGateway;

  return { storage };
}

function prompt(id: string, content: string): { prompts: Row[]; promptSections: Row[] } {
  return {
    prompts: [{ id, isDefault: false, wrapFormat: "xml", parameters: { temperature: 0.6 } }],
    promptSections: [
      {
        id: `${id}-main`,
        presetId: id,
        name: "Main",
        role: "system",
        content,
        enabled: true,
        sortOrder: 0,
      },
    ],
  };
}

describe("previewGenerationPrompt cached prompts", () => {
  it("returns the saved prompt cache from the latest assistant message", async () => {
    const summary = "The scene is already underway.";
    const { storage } = previewStorage({
      chat: { metadata: { summary } },
      messages: [
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "Visible reply.",
          extra: {
            cachedPrompt: [{ role: "system", content: "Cached rules actually sent." }],
            chatSummaryFingerprint: fingerprintChatSummary(summary),
            generationInfo: { model: "cached-model", temperature: 0.4 },
          },
        },
      ],
    });

    const result = await previewGenerationPrompt(storage, { chatId: "chat-1" });

    expect(result.messages).toEqual([{ role: "system", content: "Cached rules actually sent." }]);
    expect(result.parameters).toBeNull();
    expect(result.generationInfo).toMatchObject({ model: "cached-model", temperature: 0.4 });
  });

  it("can target an older assistant message cache when the UI supplies a message id", async () => {
    const { storage } = previewStorage({
      messages: [
        {
          id: "assistant-old",
          chatId: "chat-1",
          role: "assistant",
          content: "Earlier reply.",
          extra: { cachedPrompt: [{ role: "system", content: "Older cached prompt." }] },
        },
        {
          id: "assistant-new",
          chatId: "chat-1",
          role: "assistant",
          content: "Latest reply.",
          extra: { cachedPrompt: [{ role: "system", content: "Latest cached prompt." }] },
        },
      ],
    });

    const result = await previewGenerationPrompt(storage, { chatId: "chat-1", messageId: "assistant-old" });

    expect(result.messages).toEqual([{ role: "system", content: "Older cached prompt." }]);
  });

  it("falls back to live assembly when the saved cache belongs to an older summary", async () => {
    const livePrompt = prompt("preset-1", "Live fallback rules.");
    const { storage } = previewStorage({
      chat: { promptPresetId: "preset-1", metadata: { summary: "Current summary." } },
      messages: [
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "Visible reply.",
          extra: {
            cachedPrompt: [{ role: "system", content: "Stale cached prompt." }],
            chatSummaryFingerprint: fingerprintChatSummary("Old summary."),
          },
        },
      ],
      ...livePrompt,
    });

    const result = await previewGenerationPrompt(storage, { chatId: "chat-1" });

    expect(result.messages.map((message) => message.content).join("\n")).toContain("Live fallback rules.");
    expect(result.messages.map((message) => message.content).join("\n")).not.toContain("Stale cached prompt.");
    expect(result.parameters).toMatchObject({ temperature: 0.6 });
  });

  it("does not reuse a chat message cache for preset editor previews", async () => {
    const livePrompt = prompt("preset-2", "Preset editor preview rules.");
    const { storage } = previewStorage({
      chat: { promptPresetId: "preset-1" },
      messages: [
        {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          content: "Visible reply.",
          extra: { cachedPrompt: [{ role: "system", content: "Chat cached prompt." }] },
        },
      ],
      ...livePrompt,
    });

    const result = await previewGenerationPrompt(storage, { chatId: "chat-1", presetId: "preset-2" });

    expect(result.messages.map((message) => message.content).join("\n")).toContain("Preset editor preview rules.");
    expect(result.messages.map((message) => message.content).join("\n")).not.toContain("Chat cached prompt.");
  });
});
