import { describe, expect, it } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageEntity, StorageGateway, StorageListOptions } from "../capabilities/storage";
import {
  buildUserMessageRegenerationPromptFromSource,
  buildUserMessageRegenerationSourceMessage,
} from "./generate-route-utils";
import { assembleGenerationPrompt } from "./prompt-assembly";
import { startGeneration } from "./start-generation";
import type { JsonRecord } from "./runtime-records";

async function drain(generator: AsyncGenerator<unknown>): Promise<void> {
  for await (const _event of generator) {
    // Exhaust the generation stream so assertions see provider/save side effects.
  }
}

async function collect(generator: AsyncGenerator<unknown>): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

function asStorageValue<T>(value: unknown): T {
  return value as T;
}

function recordList<T = JsonRecord>(records: JsonRecord[], options?: StorageListOptions): T[] {
  let rows = [...records];
  if (options?.filters) {
    rows = rows.filter((row) => Object.entries(options.filters ?? {}).every(([key, value]) => row[key] === value));
  }
  if (options?.whereIn) {
    const values = new Set(options.whereIn.values);
    rows = rows.filter((row) => values.has(String(row[options.whereIn!.field] ?? "")));
  }
  if (typeof options?.limit === "number") rows = rows.slice(-options.limit);
  return rows as T[];
}

function llmThatStreams(onStream: () => void, text = "rewrite"): LlmGateway {
  return {
    async complete() {
      return "";
    },
    async listModels() {
      return [];
    },
    async *stream() {
      onStream();
      yield { type: "token", text };
    },
  };
}

const noopIntegrations: IntegrationGateway = {
  spotify: {
    async player() {
      return asStorageValue({});
    },
    async playlists() {
      return asStorageValue({});
    },
    async playlistTracks() {
      return asStorageValue({});
    },
    async searchTracks() {
      return asStorageValue({});
    },
    async playTrack() {
      return asStorageValue({});
    },
    async play() {
      return asStorageValue({});
    },
    async volume() {
      return asStorageValue({});
    },
  },
  haptic: {
    async status() {
      return asStorageValue({});
    },
    async connect() {
      return asStorageValue({});
    },
    async command() {
      return asStorageValue({});
    },
    async stopAll() {
      return asStorageValue({});
    },
  },
  customTools: {
    async execute() {
      return asStorageValue({});
    },
  },
  image: {
    async generate() {
      return asStorageValue({});
    },
  },
};

function baseGenerationRecords() {
  const chat: JsonRecord = {
    id: "chat-1",
    title: "QA chat",
    mode: "rp",
    characterIds: ["char-1"],
    metadata: {},
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
  };
  const character: JsonRecord = {
    id: "char-1",
    name: "QA Character",
    description: "A concise QA responder.",
    tags: [],
  };
  const connection: JsonRecord = {
    id: "conn-1",
    name: "QA Non-Google",
    provider: "openai",
    model: "qa-model",
    enabled: true,
  };
  const previous: JsonRecord = {
    id: "message-prev",
    chatId: chat.id,
    role: "user",
    content: "Earlier user context.",
    extra: {},
    createdAt: "2026-06-06T00:00:01.000Z",
    updatedAt: "2026-06-06T00:00:01.000Z",
  };
  const target: JsonRecord = {
    id: "message-target",
    chatId: chat.id,
    role: "user",
    content: "Original user message.",
    extra: {},
    createdAt: "2026-06-06T00:00:02.000Z",
    updatedAt: "2026-06-06T00:00:02.000Z",
  };
  return { chat, character, connection, previous, target };
}

function generationStorage(args: {
  getTarget: (call: number, target: JsonRecord) => JsonRecord | null | Promise<JsonRecord | null>;
  chatMetadata?: JsonRecord;
  agentRows?: JsonRecord[];
  onSwipe?: (content: string, options: unknown) => void;
  onPatchExtra?: (messageId: string, patch: Record<string, unknown>) => void;
}): StorageGateway {
  const records = baseGenerationRecords();
  const chatMetadata =
    records.chat.metadata && typeof records.chat.metadata === "object" && !Array.isArray(records.chat.metadata)
      ? (records.chat.metadata as JsonRecord)
      : {};
  records.chat.metadata = { ...chatMetadata, ...args.chatMetadata };
  let targetGetCalls = 0;
  return {
    async list<T = unknown>(entity: StorageEntity): Promise<T[]> {
      if (entity === "connections") return asStorageValue<T[]>([records.connection]);
      if (entity === "agents") return asStorageValue<T[]>(args.agentRows ?? []);
      if (entity === "lorebooks") return [];
      if (entity === "prompts") return [];
      if (entity === "regex-scripts") return [];
      return [];
    },
    async get<T = unknown>(entity: StorageEntity, id: string): Promise<T | null> {
      if (entity === "chats" && id === records.chat.id) return asStorageValue<T>(records.chat);
      if (entity === "connections" && id === records.connection.id) return asStorageValue<T>(records.connection);
      if (entity === "characters" && id === records.character.id) return asStorageValue<T>(records.character);
      if (entity === "messages" && id === records.target.id) {
        targetGetCalls += 1;
        return asStorageValue<T | null>(await args.getTarget(targetGetCalls, records.target));
      }
      return null;
    },
    async create() {
      throw new Error("create should not be called");
    },
    async update() {
      throw new Error("update should not be called");
    },
    async delete() {
      return { deleted: false };
    },
    async listChatMessages<T = unknown>(
      _chatId: string,
      options?: Parameters<StorageGateway["listChatMessages"]>[1],
    ): Promise<T[]> {
      if (options?.before) return asStorageValue<T[]>([records.previous]);
      return asStorageValue<T[]>([records.previous, records.target]);
    },
    async createChatMessage() {
      throw new Error("createChatMessage should not be called");
    },
    async updateChatMessage() {
      throw new Error("updateChatMessage should not be called");
    },
    async deleteChatMessage() {
      return { deleted: false };
    },
    async patchChatMessageExtra<T = unknown>(messageId: string, patch: Record<string, unknown>) {
      args.onPatchExtra?.(messageId, patch);
      return asStorageValue<T>(records.target);
    },
    async addChatMessageSwipe<T = unknown>(
      _chatId: string,
      _messageId: string,
      content: string,
      options?: unknown,
    ) {
      args.onSwipe?.(content, options);
      return asStorageValue<T>(records.target);
    },
    async patchChatMetadata<T = unknown>() {
      return asStorageValue<T>(records.chat);
    },
    async patchChatSummaries<T = unknown>() {
      return asStorageValue<T>(records.chat);
    },
    async listChatMemories() {
      return [];
    },
    async getWorldState() {
      return null;
    },
    async saveTrackerSnapshot<T = unknown>() {
      return asStorageValue<T>({});
    },
    async listLorebookEntries() {
      return [];
    },
    async listLorebookEntriesByLorebookIds() {
      return [];
    },
    async createLorebookEntries() {
      return [];
    },
    async promptFull() {
      return null;
    },
  };
}

describe("user-message regeneration review guards", () => {
  it("keeps stored text attachments when literal user text mentions attached_file tags", () => {
    const source = buildUserMessageRegenerationSourceMessage({
      content: "The quoted docs mention <attached_file but that is not a stored attachment.",
      extra: {
        attachments: [
          {
            filename: "notes.txt",
            type: "text/plain",
            data: "data:text/plain,Stored%20attachment%20body",
          },
        ],
      },
    });

    expect(source.content).toContain("The quoted docs mention <attached_file");
    expect(source.content).toContain('<attached_file name="notes.txt" type="text/plain">');
    expect(source.content).toContain("Stored attachment body");
  });

  it("keeps stored text attachments when literal user text copies a helper-shaped block", () => {
    const attachment = {
      filename: "notes.txt",
      type: "text/plain",
      data: "data:text/plain,Stored%20attachment%20body",
    };
    const copiedBlock = [
      '<attached_file name="notes.txt" type="text/plain">',
      "Stored attachment body",
      "</attached_file>",
    ].join("\n");
    const source = buildUserMessageRegenerationSourceMessage({
      content: `The user quoted this block:\n${copiedBlock}`,
      extra: { attachments: [attachment] },
    });

    expect(source.content.split('<attached_file name="notes.txt" type="text/plain">')).toHaveLength(3);
    expect(source.content).toContain("The user quoted this block:");
  });

  it("does not duplicate a helper-generated readable attachment block when building the rewrite prompt", () => {
    const attachment = {
      filename: "notes.txt",
      type: "text/plain",
      data: "data:text/plain,Stored%20attachment%20body",
    };
    const normalized = buildUserMessageRegenerationSourceMessage({
      content: "Original source.",
      extra: { attachments: [attachment] },
    });
    const prompt = buildUserMessageRegenerationPromptFromSource(normalized);

    expect(prompt.content.split('<attached_file name="notes.txt" type="text/plain">')).toHaveLength(2);
    expect(prompt.content).toContain("Stored attachment body");
  });

  it("aborts before model call or saved swipe when the full source row load fails", async () => {
    let modelCalls = 0;
    let swipeCalls = 0;
    const storage = generationStorage({
      getTarget: (call, target) => {
        if (call >= 3) throw new Error("storage unavailable");
        return target;
      },
      onSwipe: () => {
        swipeCalls += 1;
      },
    });

    await expect(
      drain(
        startGeneration(
          {
            storage,
            llm: llmThatStreams(() => {
              modelCalls += 1;
            }),
            integrations: noopIntegrations,
          },
          { chatId: "chat-1", regenerateMessageId: "message-target", connectionId: "conn-1" },
        ),
      ),
    ).rejects.toThrow("storage unavailable");

    expect(modelCalls).toBe(0);
    expect(swipeCalls).toBe(0);
  });

  it("rejects a hidden authoritative full source row even when the timeline row is visible", async () => {
    let modelCalls = 0;
    let swipeCalls = 0;
    const storage = generationStorage({
      getTarget: (call, target) => (call >= 3 ? { ...target, extra: { hiddenFromAI: true } } : target),
      onSwipe: () => {
        swipeCalls += 1;
      },
    });

    await expect(
      drain(
        startGeneration(
          {
            storage,
            llm: llmThatStreams(() => {
              modelCalls += 1;
            }),
            integrations: noopIntegrations,
          },
          { chatId: "chat-1", regenerateMessageId: "message-target", connectionId: "conn-1" },
        ),
      ),
    ).rejects.toThrow("Cannot regenerate a message hidden from AI");

    expect(modelCalls).toBe(0);
    expect(swipeCalls).toBe(0);
  });

  it("saves assembled user-message regeneration text without running connected command tags", async () => {
    let modelCalls = 0;
    const savedSwipes: string[] = [];
    const storage = generationStorage({
      getTarget: (_call, target) => target,
      onSwipe: (content) => {
        savedSwipes.push(content);
      },
    });
    const connectedCommandText = "<note>do not persist this</note>\nrewritten user text";

    const events = await collect(
      startGeneration(
        {
          storage,
          llm: llmThatStreams(() => {
            modelCalls += 1;
          }, connectedCommandText),
          integrations: noopIntegrations,
        },
        { chatId: "chat-1", regenerateMessageId: "message-target", connectionId: "conn-1" },
      ),
    );

    expect(modelCalls).toBe(1);
    expect(savedSwipes).toEqual([connectedCommandText]);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "user_message" })]));
    expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "command_error" })]));
    expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "assistant_action" })]));
  });

  it("saves direct user-message regeneration text without running connected command tags", async () => {
    let modelCalls = 0;
    const savedSwipes: string[] = [];
    const storage = generationStorage({
      getTarget: (_call, target) => target,
      onSwipe: (content) => {
        savedSwipes.push(content);
      },
    });
    const connectedCommandText = "<note>do not persist this direct rewrite</note>\nrewritten direct user text";

    const events = await collect(
      startGeneration(
        {
          storage,
          llm: llmThatStreams(() => {
            modelCalls += 1;
          }, connectedCommandText),
          integrations: noopIntegrations,
        },
        {
          chatId: "chat-1",
          regenerateMessageId: "message-target",
          connectionId: "conn-1",
          messages: [{ role: "user", content: "Direct rewrite request" }],
        },
      ),
    );

    expect(modelCalls).toBe(1);
    expect(savedSwipes).toEqual([connectedCommandText]);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "user_message" })]));
    expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "command_error" })]));
    expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "assistant_action" })]));
  });

  it("saves assembled user-message regeneration without assistant agent metadata", async () => {
    let modelCalls = 0;
    const savedSwipes: string[] = [];
    const swipeOptions: unknown[] = [];
    const extraPatches: Array<Record<string, unknown>> = [];
    const storage = generationStorage({
      chatMetadata: { activeAgentIds: ["html"] },
      agentRows: [
        {
          id: "html",
          type: "html",
          name: "Immersive HTML",
          enabled: true,
          phase: "pre_generation",
          promptTemplate: "Assistant-only HTML context should not decorate user rewrites.",
        },
      ],
      getTarget: (_call, target) => target,
      onSwipe: (content, options) => {
        savedSwipes.push(content);
        swipeOptions.push(options);
      },
      onPatchExtra: (_messageId, patch) => {
        extraPatches.push(patch);
      },
    });

    const events = await collect(
      startGeneration(
        {
          storage,
          llm: llmThatStreams(() => {
            modelCalls += 1;
          }),
          integrations: noopIntegrations,
        },
        { chatId: "chat-1", regenerateMessageId: "message-target", connectionId: "conn-1" },
      ),
    );

    const savedSwipeExtra = ((swipeOptions[0] as { extra?: Record<string, unknown> } | undefined)?.extra ?? {}) as Record<
      string,
      unknown
    >;

    expect(modelCalls).toBe(1);
    expect(savedSwipes).toEqual(["rewrite"]);
    expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "agent_result" })]));
    expect(savedSwipeExtra).not.toHaveProperty("contextInjections");
    expect(savedSwipeExtra).not.toHaveProperty("spriteExpressions");
    expect(savedSwipeExtra).not.toHaveProperty("cyoaChoices");
    expect(extraPatches).toHaveLength(1);
    expect(extraPatches[0]).not.toHaveProperty("contextInjections");
    expect(extraPatches[0]).not.toHaveProperty("spriteExpressions");
    expect(extraPatches[0]).not.toHaveProperty("cyoaChoices");
  });

  it("recomputes source-sensitive lore when reusable context receives a regeneration source", async () => {
    const chat: JsonRecord = {
      id: "chat-1",
      mode: "rp",
      characterIds: [],
      metadata: {},
    };
    const lorebook: JsonRecord = {
      id: "lore-1",
      name: "Blue Lantern Lore",
      enabled: true,
      isGlobal: true,
    };
    const loreEntry: JsonRecord = {
      id: "entry-1",
      lorebookId: lorebook.id,
      name: "Blue Lantern",
      content: "Blue lantern constructs are powered by hope.",
      keys: ["blue lantern"],
      enabled: true,
      position: 0,
      role: "system",
      order: 0,
    };
    const storage: StorageGateway = {
      async list<T = unknown>(entity: StorageEntity, options?: StorageListOptions): Promise<T[]> {
        if (entity === "lorebooks") return recordList<T>([lorebook], options);
        if (entity === "lorebook-folders") return [];
        if (entity === "regex-scripts") return [];
        if (entity === "prompts") return [];
        if (entity === "personas") return [];
        return [];
      },
      async get() {
        return null;
      },
      async create() {
        throw new Error("create should not be called");
      },
      async update() {
        throw new Error("update should not be called");
      },
      async delete() {
        return { deleted: false };
      },
      async listChatMessages() {
        return [];
      },
      async createChatMessage() {
        throw new Error("createChatMessage should not be called");
      },
      async updateChatMessage() {
        throw new Error("updateChatMessage should not be called");
      },
      async deleteChatMessage() {
        return { deleted: false };
      },
      async patchChatMessageExtra<T = unknown>() {
        return asStorageValue<T>({});
      },
      async addChatMessageSwipe<T = unknown>() {
        return asStorageValue<T>({});
      },
      async patchChatMetadata<T = unknown>() {
        return asStorageValue<T>(chat);
      },
      async patchChatSummaries<T = unknown>() {
        return asStorageValue<T>(chat);
      },
      async listChatMemories() {
        return [];
      },
      async getWorldState() {
        return null;
      },
      async saveTrackerSnapshot<T = unknown>() {
        return asStorageValue<T>({});
      },
      async listLorebookEntries<T = unknown>() {
        return asStorageValue<T[]>([loreEntry]);
      },
      async listLorebookEntriesByLorebookIds<T = unknown>() {
        return asStorageValue<T[]>([loreEntry]);
      },
      async createLorebookEntries() {
        return [];
      },
      async promptFull() {
        return null;
      },
    };

    const first = await assembleGenerationPrompt(storage, {
      chat,
      storedMessages: [{ role: "user", content: "plain source" }],
      connection: { provider: "openai", model: "qa-model" },
      request: {},
      latestUserInput: "plain source",
    });
    expect(first.activatedLorebookEntries).toEqual([]);

    const second = await assembleGenerationPrompt(storage, {
      chat,
      storedMessages: [{ role: "user", content: "plain source" }],
      connection: { provider: "openai", model: "qa-model" },
      request: {},
      latestUserInput: "plain source",
      userRegenerationSourceMessage: {
        role: "user",
        content: "Please rewrite a message about a blue lantern.",
      },
      reusableContext: first.reusableContext,
    });

    expect(second.activatedLorebookEntries.map((entry) => entry.id)).toContain(loreEntry.id);
  });
});
