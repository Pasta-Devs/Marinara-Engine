import { describe, expect, it } from "vitest";

import type { StorageEntity, StorageGateway, StorageListOptions } from "../capabilities/storage";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway, LlmRequest } from "../capabilities/llm";
import { persistConnectedCommandTags } from "./connected-commands";

type Row = Record<string, unknown>;

function createStorage(seed: Partial<Record<StorageEntity, Row[]>>): StorageGateway {
  const rows = new Map<StorageEntity, Row[]>();
  for (const [entity, values] of Object.entries(seed) as Array<[StorageEntity, Row[]]>) {
    rows.set(
      entity,
      values.map((value) => ({ ...value })),
    );
  }

  const listRows = (entity: StorageEntity) => rows.get(entity) ?? [];
  const nextId = (entity: StorageEntity) => `${entity}-${listRows(entity).length + 1}`;

  return {
    async list<T = unknown>(entity: StorageEntity, options?: StorageListOptions): Promise<T[]> {
      const values = listRows(entity);
      if (!options?.filters) return values.map((value) => ({ ...value })) as T[];
      return values
        .filter((value) =>
          Object.entries(options.filters ?? {}).every(([key, expected]) => value[key] === expected),
        )
        .map((value) => ({ ...value })) as T[];
    },
    async get<T = unknown>(entity: StorageEntity, id: string): Promise<T | null> {
      const row = listRows(entity).find((value) => value.id === id);
      return row ? ({ ...row } as T) : null;
    },
    async create<T = unknown>(entity: StorageEntity, value: Row): Promise<T> {
      const row = { id: value.id ?? nextId(entity), ...value };
      rows.set(entity, [...listRows(entity), row]);
      return { ...row } as T;
    },
    async update<T = unknown>(entity: StorageEntity, id: string, patch: Row): Promise<T> {
      const next = listRows(entity).map((value) => (value.id === id ? { ...value, ...patch } : value));
      rows.set(entity, next);
      return { ...(next.find((value) => value.id === id) ?? { id, ...patch }) } as T;
    },
    async delete(): Promise<{ deleted: boolean }> {
      return { deleted: true };
    },
    async listChatMessages<T = unknown>(): Promise<T[]> {
      return [];
    },
    async createChatMessage<T = unknown>(_chatId: string, value: Row): Promise<T> {
      return { id: "message-1", ...value } as T;
    },
    async updateChatMessage<T = unknown>(_messageId: string, patch: Row): Promise<T> {
      return { ...patch } as T;
    },
    async deleteChatMessage(): Promise<{ deleted: boolean }> {
      return { deleted: true };
    },
    async patchChatMessageExtra<T = unknown>(_messageId: string, patch: Row): Promise<T> {
      return { ...patch } as T;
    },
    async addChatMessageSwipe<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async patchChatMetadata<T = unknown>(chatId: string, patch: Row): Promise<T> {
      return this.update("chats", chatId, {
        metadata: {
          ...(listRows("chats").find((chat) => chat.id === chatId)?.metadata as Row | undefined),
          ...patch,
        },
      });
    },
    async patchChatSummaries<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async listChatMemories<T = unknown>(): Promise<T[]> {
      return [];
    },
    async getWorldState<T = unknown>(): Promise<T | null> {
      return null;
    },
    async saveTrackerSnapshot<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async listLorebookEntries<T = unknown>(): Promise<T[]> {
      return [];
    },
    async createLorebookEntries<T = unknown>(): Promise<T[]> {
      return [];
    },
    async promptFull<T = unknown>(): Promise<T | null> {
      return null;
    },
  };
}

function createImageIntegration(calls: Row[]): IntegrationGateway {
  return {
    spotify: {} as IntegrationGateway["spotify"],
    haptic: {} as IntegrationGateway["haptic"],
    customTools: {} as IntegrationGateway["customTools"],
    image: {
      async generate<T = unknown>(input: Row): Promise<T> {
        calls.push(input);
        return {
          base64: "aW1hZ2U=",
          mimeType: "image/png",
          provider: "test-image-provider",
          model: "test-image-model",
        } as T;
      },
    },
  };
}

describe("persistConnectedCommandTags", () => {
  it("uses the Illustrator agent LLM connection for chat selfie prompt generation", async () => {
    const llmCalls: LlmRequest[] = [];
    const imageCalls: Row[] = [];
    const storage = createStorage({
      agents: [
        {
          id: "illustrator",
          type: "illustrator",
          enabled: true,
          connectionId: "illustrator-llm",
          settings: {},
        },
      ],
      characters: [
        {
          id: "char-1",
          data: {
            name: "Robin",
            appearance: "short auburn hair, green jacket",
          },
        },
      ],
      connections: [
        { id: "chat-llm", provider: "openai" },
        { id: "illustrator-llm", provider: "openai" },
        { id: "selfie-image", provider: "image_generation" },
      ],
      gallery: [],
    });
    const llm: LlmGateway = {
      async complete(request) {
        llmCalls.push(request);
        return "Robin holding up a casual phone selfie, short auburn hair, green jacket";
      },
      async *stream() {
        yield { type: "done" };
      },
      async listModels() {
        return [];
      },
    };

    const result = await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        mode: "conversation",
        characterIds: ["char-1"],
        metadata: { characterCommands: true, imageGenConnectionId: "selfie-image" },
      },
      "[selfie]",
      createImageIntegration(imageCalls),
      llm,
      "chat-llm",
    );

    expect(result.executedCommands).toEqual(["selfie"]);
    expect(llmCalls).toHaveLength(1);
    expect(llmCalls[0]?.connectionId).toBe("illustrator-llm");
    expect(imageCalls).toHaveLength(1);
    expect(imageCalls[0]?.connectionId).toBe("selfie-image");
  });

  it("falls back to the default non-image agent connection when Illustrator has no override", async () => {
    const llmCalls: LlmRequest[] = [];
    const imageCalls: Row[] = [];
    const storage = createStorage({
      agents: [{ id: "illustrator", type: "illustrator", enabled: true, connectionId: null, settings: {} }],
      characters: [{ id: "char-1", data: { name: "Robin", appearance: "green jacket" } }],
      connections: [
        { id: "chat-llm", provider: "openai" },
        { id: "agent-default-llm", provider: "openai", defaultForAgents: true },
        { id: "selfie-image", provider: "image_generation" },
      ],
      gallery: [],
    });
    const llm: LlmGateway = {
      async complete(request) {
        llmCalls.push(request);
        return "Robin selfie, green jacket";
      },
      async *stream() {
        yield { type: "done" };
      },
      async listModels() {
        return [];
      },
    };

    await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        mode: "conversation",
        characterIds: ["char-1"],
        metadata: { characterCommands: true, imageGenConnectionId: "selfie-image" },
      },
      "[selfie]",
      createImageIntegration(imageCalls),
      llm,
      "chat-llm",
    );

    expect(llmCalls[0]?.connectionId).toBe("agent-default-llm");
    expect(imageCalls[0]?.connectionId).toBe("selfie-image");
  });

  it("keeps the chat LLM fallback when no Illustrator or default agent connection is configured", async () => {
    const llmCalls: LlmRequest[] = [];
    const imageCalls: Row[] = [];
    const storage = createStorage({
      agents: [],
      characters: [{ id: "char-1", data: { name: "Robin", appearance: "green jacket" } }],
      connections: [
        { id: "chat-llm", provider: "openai" },
        { id: "selfie-image", provider: "image_generation" },
      ],
      gallery: [],
    });
    const llm: LlmGateway = {
      async complete(request) {
        llmCalls.push(request);
        return "Robin selfie, green jacket";
      },
      async *stream() {
        yield { type: "done" };
      },
      async listModels() {
        return [];
      },
    };

    await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        mode: "conversation",
        characterIds: ["char-1"],
        metadata: { characterCommands: true, imageGenConnectionId: "selfie-image" },
      },
      "[selfie]",
      createImageIntegration(imageCalls),
      llm,
      "chat-llm",
    );

    expect(llmCalls[0]?.connectionId).toBe("chat-llm");
    expect(imageCalls[0]?.connectionId).toBe("selfie-image");
  });

  it("emits a selfie error instead of falling back when agent configuration cannot be read", async () => {
    const llmCalls: LlmRequest[] = [];
    const imageCalls: Row[] = [];
    const baseStorage = createStorage({
      characters: [{ id: "char-1", data: { name: "Robin", appearance: "green jacket" } }],
      connections: [
        { id: "chat-llm", provider: "openai" },
        { id: "selfie-image", provider: "image_generation" },
      ],
      gallery: [],
    });
    const storage: StorageGateway = {
      ...baseStorage,
      async list<T = unknown>(entity: StorageEntity, options?: StorageListOptions): Promise<T[]> {
        if (entity === "agents") throw new Error("agent configuration unavailable");
        return baseStorage.list<T>(entity, options);
      },
    };
    const llm: LlmGateway = {
      async complete(request) {
        llmCalls.push(request);
        return "Robin selfie, green jacket";
      },
      async *stream() {
        yield { type: "done" };
      },
      async listModels() {
        return [];
      },
    };

    const result = await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        mode: "conversation",
        characterIds: ["char-1"],
        metadata: { characterCommands: true, imageGenConnectionId: "selfie-image" },
      },
      "[selfie]",
      createImageIntegration(imageCalls),
      llm,
      "chat-llm",
    );

    expect(result.executedCommands).toEqual([]);
    expect(result.events).toContainEqual({
      type: "selfie_error",
      data: { characterId: "char-1", error: "agent configuration unavailable" },
    });
    expect(llmCalls).toHaveLength(0);
    expect(imageCalls).toHaveLength(0);
  });
});
