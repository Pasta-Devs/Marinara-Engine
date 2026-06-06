import { describe, expect, it, vi } from "vitest";

import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmChunk, LlmGateway } from "../capabilities/llm";
import type { StorageEntity, StorageGateway } from "../capabilities/storage";
import type { WeekSchedule } from "../modes/chat/schedules/schedule.service";
import { retryGenerationAgents, startGeneration, type StartGenerationInput } from "./start-generation";

type Store = Partial<Record<StorageEntity, Record<string, Record<string, unknown>>>>;

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function scheduleFor(status: "idle" | "dnd" | "offline"): WeekSchedule {
  return {
    weekStart: "2026-06-01T00:00:00.000Z",
    days: Object.fromEntries(
      WEEK_DAYS.map((day) => [day, [{ time: "00:00-23:59", activity: "busy", status }]]),
    ) as WeekSchedule["days"],
    inactivityThresholdMinutes: 120,
    idleResponseDelayMinutes: 2,
    dndResponseDelayMinutes: 3,
    talkativeness: 50,
  };
}

function createStore(
  status: "idle" | "dnd" | "offline",
  options: {
    secondStatus?: "idle" | "dnd" | "offline";
    messages?: Record<string, Record<string, unknown>>;
    mode?: string;
  } = {},
): Store {
  const characterIds = options.secondStatus ? ["char-1", "char-2"] : ["char-1"];
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode: options.mode ?? "conversation",
        connectionId: "conn-1",
        characterIds,
        metadata: {
          characterSchedules: {
            "char-1": scheduleFor(status),
            ...(options.secondStatus ? { "char-2": scheduleFor(options.secondStatus) } : {}),
          },
        },
      },
    },
    characters: {
      "char-1": { id: "char-1", data: { name: "Mira" } },
      ...(options.secondStatus ? { "char-2": { id: "char-2", data: { name: "Sol" } } } : {}),
    },
    connections: {
      "conn-1": { id: "conn-1", provider: "test", model: "test-model" },
    },
    messages: options.messages,
  };
}

function createReviewStore(
  mode: "roleplay" | "visual_novel" | "conversation",
  options: { regenerate?: boolean } = {},
): Store {
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode,
        connectionId: "conn-1",
        characterIds: ["char-1"],
        metadata: {
          reviewWriterAgentOutputs: true,
          activeAgentIds: ["prose-guardian", "knowledge-retrieval", "html"],
        },
      },
    },
    characters: {
      "char-1": { id: "char-1", data: { name: "Mira" } },
    },
    connections: {
      "conn-1": { id: "conn-1", provider: "test", model: "test-model", defaultForAgents: true },
    },
    agents: {
      "agent-prose": {
        id: "agent-prose",
        type: "prose-guardian",
        name: "Prose Guardian",
        enabled: true,
        phase: "pre_generation",
        promptTemplate: "",
        settings: {},
      },
      "agent-knowledge": {
        id: "agent-knowledge",
        type: "knowledge-retrieval",
        name: "Knowledge Retrieval",
        enabled: true,
        phase: "pre_generation",
        promptTemplate: "",
        settings: {},
      },
    },
    lorebooks: {
      "lorebook-1": {
        id: "lorebook-1",
        name: "Global Lore",
        enabled: true,
        isGlobal: true,
      },
    },
    "lorebook-entries": {
      "entry-1": {
        id: "entry-1",
        lorebookId: "lorebook-1",
        name: "Mira",
        content: "Mira likes stormy weather.",
        enabled: true,
      },
    },
    messages: options.regenerate
      ? {
          "assistant-1": {
            id: "assistant-1",
            chatId: "chat-1",
            role: "assistant",
            content: "Previous reply.",
            createdAt: "2026-06-04T00:00:00.000Z",
          },
        }
      : {},
  };
}

function createDefaultAgentConnectionWarningStore(options: { defaultForAgents?: boolean } = {}): Store {
  const defaultForAgents = options.defaultForAgents ?? true;
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode: "roleplay",
        connectionId: "chat-conn",
        characterIds: ["char-1"],
        metadata: { activeAgentIds: ["director"] },
      },
    },
    characters: {
      "char-1": { id: "char-1", data: { name: "Mira" } },
    },
    connections: {
      "chat-conn": { id: "chat-conn", provider: "test", model: "chat-model" },
      "agent-default": {
        id: "agent-default",
        name: "Paid Agents",
        provider: "test",
        model: "paid-agent-model",
        defaultForAgents,
      },
    },
    agents: {
      director: {
        id: "director",
        type: "director",
        name: "Narrative Director",
        enabled: true,
        phase: "pre_generation",
        promptTemplate: "",
        settings: {},
      },
    },
    messages: {},
  };
}

function createLorebookKeeperDefaultConnectionWarningStore(): Store {
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode: "roleplay",
        connectionId: "chat-conn",
        characterIds: ["char-1"],
        metadata: { activeAgentIds: ["lorebook-keeper"], lorebookKeeperTargetLorebookId: "lorebook-1" },
      },
    },
    characters: {
      "char-1": { id: "char-1", data: { name: "Mira" } },
    },
    connections: {
      "chat-conn": { id: "chat-conn", provider: "test", model: "chat-model" },
      "agent-default": {
        id: "agent-default",
        name: "Paid Agents",
        provider: "test",
        model: "paid-agent-model",
        defaultForAgents: true,
      },
    },
    agents: {
      "lorebook-keeper": {
        id: "lorebook-keeper",
        type: "lorebook-keeper",
        name: "Lorebook Keeper",
        enabled: true,
        phase: "post_processing",
        promptTemplate: "",
        settings: { runInterval: 1 },
      },
    },
    lorebooks: {
      "lorebook-1": {
        id: "lorebook-1",
        name: "Global Lore",
        enabled: true,
        isGlobal: true,
      },
    },
    messages: {
      "assistant-1": {
        id: "assistant-1",
        chatId: "chat-1",
        role: "assistant",
        content: "Mira found a clue.",
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    },
  };
}

function createStorage(
  store: Store,
  capture: { extraPatches?: Array<{ messageId: string; patch: Record<string, unknown> }> } = {},
): StorageGateway {
  return {
    async list<T = unknown>(entity: StorageEntity): Promise<T[]> {
      return Object.values(store[entity] ?? {}) as T[];
    },
    async get<T = unknown>(entity: StorageEntity, id: string): Promise<T | null> {
      return ((store[entity] ?? {})[id] as T | undefined) ?? null;
    },
    async create<T = unknown>(entity: StorageEntity, value: Record<string, unknown>): Promise<T> {
      const id = String(value.id ?? `${entity}-${Object.keys(store[entity] ?? {}).length + 1}`);
      store[entity] = { ...(store[entity] ?? {}), [id]: { ...value, id } };
      return store[entity]![id] as T;
    },
    async update<T = unknown>(entity: StorageEntity, id: string, patch: Record<string, unknown>): Promise<T> {
      store[entity] = {
        ...(store[entity] ?? {}),
        [id]: { ...((store[entity] ?? {})[id] ?? {}), ...patch },
      };
      return store[entity]![id] as T;
    },
    async delete(): Promise<{ deleted: boolean }> {
      return { deleted: true };
    },
    async listChatMessages<T = unknown>(): Promise<T[]> {
      return Object.values(store.messages ?? {}) as T[];
    },
    async createChatMessage<T = unknown>(chatId: string, value: Record<string, unknown>): Promise<T> {
      return {
        id: `message-${Object.keys(store.messages ?? {}).length + 1}`,
        chatId,
        createdAt: new Date().toISOString(),
        ...value,
      } as T;
    },
    async updateChatMessage<T = unknown>(messageId: string, patch: Record<string, unknown>): Promise<T> {
      return { id: messageId, ...patch } as T;
    },
    async deleteChatMessage(): Promise<{ deleted: boolean }> {
      return { deleted: true };
    },
    async patchChatMessageExtra<T = unknown>(messageId: string, patch: Record<string, unknown>): Promise<T> {
      capture.extraPatches?.push({ messageId, patch });
      return { id: messageId, extra: patch } as T;
    },
    async addChatMessageSwipe<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async patchChatMetadata<T = unknown>(chatId: string, patch: Record<string, unknown>): Promise<T> {
      const chat = (store.chats ?? {})[chatId] ?? {};
      store.chats = { ...(store.chats ?? {}), [chatId]: { ...chat, metadata: patch } };
      return store.chats[chatId] as T;
    },
    async patchChatSummaries<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async listChatMemories<T = unknown>(): Promise<T[]> {
      return [] as T[];
    },
    async getWorldState<T = unknown>(): Promise<T | null> {
      return null;
    },
    async saveTrackerSnapshot<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async listLorebookEntries<T = unknown>(): Promise<T[]> {
      return [] as T[];
    },
    async createLorebookEntries<T = unknown>(): Promise<T[]> {
      return [] as T[];
    },
    async promptFull<T = unknown>(): Promise<T | null> {
      return null;
    },
  };
}

function createDeps(
  status: "idle" | "dnd" | "offline",
  options: {
    secondStatus?: "idle" | "dnd" | "offline";
    messages?: Record<string, Record<string, unknown>>;
    mode?: string;
    capture?: {
      extraPatches?: Array<{ messageId: string; patch: Record<string, unknown> }>;
      streamParameters?: Record<string, unknown>[];
    };
    streamChunks?: LlmChunk[];
  } = {},
) {
  const llm: LlmGateway = {
    async complete() {
      return "";
    },
    async *stream(request) {
      options.capture?.streamParameters?.push(request.parameters ?? {});
      for (const chunk of options.streamChunks ?? [{ type: "token" as const, text: "Hello." }]) {
        yield chunk;
      }
    },
    async listModels() {
      return [];
    },
  };
  return {
    storage: createStorage(createStore(status, options), options.capture),
    integrations: {} as IntegrationGateway,
    llm,
  };
}

function createReviewDeps(mode: "roleplay" | "visual_novel" | "conversation", options: { regenerate?: boolean } = {}) {
  const llm: LlmGateway = {
    async complete() {
      return "";
    },
    async *stream() {
      yield { type: "token" as const, text: "Keep the reply varied." };
    },
    async listModels() {
      return [];
    },
  };
  return {
    storage: createStorage(createReviewStore(mode, options)),
    integrations: {} as IntegrationGateway,
    llm,
  };
}

function createDefaultAgentConnectionWarningDeps(options: { defaultForAgents?: boolean } = {}) {
  const llm: LlmGateway = {
    async complete() {
      return "";
    },
    async *stream() {
      yield { type: "token" as const, text: "Keep the reply varied." };
    },
    async listModels() {
      return [];
    },
  };
  return {
    storage: createStorage(createDefaultAgentConnectionWarningStore(options)),
    integrations: {} as IntegrationGateway,
    llm,
  };
}

function createLorebookKeeperDefaultConnectionWarningDeps() {
  const llm: LlmGateway = {
    async complete() {
      return "";
    },
    async *stream() {
      yield { type: "token" as const, text: "{}" };
    },
    async listModels() {
      return [];
    },
  };
  return {
    storage: createStorage(createLorebookKeeperDefaultConnectionWarningStore()),
    integrations: {} as IntegrationGateway,
    llm,
  };
}

async function collectEvents(
  status: "idle" | "dnd" | "offline",
  input: Partial<StartGenerationInput>,
  options: { secondStatus?: "idle" | "dnd" | "offline" } = {},
) {
  const events = [];
  for await (const event of startGeneration(createDeps(status, options), {
    chatId: "chat-1",
    message: "Hi @Mira",
    ...input,
  })) {
    events.push(event);
    if (event.type === "delayed" || event.type === "offline" || event.type === "done") break;
  }
  return events;
}

function delayedMs(events: Awaited<ReturnType<typeof collectEvents>>): number | null {
  const delayed = events.find((event) => event.type === "delayed");
  return delayed?.type === "delayed" ? Number(delayed.data.delayMs) : null;
}

async function collectReviewEvents(
  mode: "roleplay" | "visual_novel" | "conversation",
  input: Partial<StartGenerationInput> = {},
  options: { regenerate?: boolean } = {},
) {
  const events = [];
  for await (const event of startGeneration(createReviewDeps(mode, options), {
    chatId: "chat-1",
    message: "Hi Mira",
    ...input,
  })) {
    events.push(event);
    if (event.type === "agent_injection_review" || event.type === "done") break;
  }
  return events;
}

function reviewEvent(events: Awaited<ReturnType<typeof collectReviewEvents>>) {
  return events.find((event) => event.type === "agent_injection_review") as
    | {
        type: "agent_injection_review";
        data: {
          chatId: string;
          injections: Array<{ agentType: string; agentName: string; text: string }>;
        };
      }
    | undefined;
}

async function collectDefaultAgentConnectionWarningEvents(options: { defaultForAgents?: boolean } = {}) {
  const events = [];
  for await (const event of startGeneration(createDefaultAgentConnectionWarningDeps(options), {
    chatId: "chat-1",
    message: "Hi Mira",
  })) {
    events.push(event);
    if ((event as { type: string }).type === "agent_warning" || event.type === "done") break;
  }
  return events;
}

async function collectDefaultAgentConnectionRetryEvents() {
  return retryGenerationAgents(createDefaultAgentConnectionWarningDeps(), {
    chatId: "chat-1",
    agentTypes: ["director"],
    options: { bypassActivation: true },
  });
}

async function collectLorebookKeeperBackfillEvents() {
  return retryGenerationAgents(createLorebookKeeperDefaultConnectionWarningDeps(), {
    chatId: "chat-1",
    agentTypes: ["lorebook-keeper"],
    options: { lorebookKeeperBackfill: true },
  });
}

async function drainGeneration(stream: AsyncGenerator<unknown>): Promise<void> {
  for await (const _event of stream) {
    void _event;
  }
}

describe("startGeneration conversation availability delays", () => {
  it("uses short legacy mention delays for explicit conversation mentions and manual targets", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      expect(delayedMs(await collectEvents("idle", { mentionedCharacterNames: ["Mira"] }))).toBe(5_000);
      expect(delayedMs(await collectEvents("dnd", { mentionedCharacterNames: ["Mira"] }))).toBe(30_000);
      expect(delayedMs(await collectEvents("idle", { forCharacterId: "char-1" }))).toBe(5_000);
      expect(
        delayedMs(await collectEvents("idle", { mentionedCharacterNames: ["Mira"] }, { secondStatus: "dnd" })),
      ).toBe(5_000);
    } finally {
      random.mockRestore();
    }
  });

  it("keeps generic busy delays for normal conversation replies", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      expect(delayedMs(await collectEvents("idle", {}))).toBe(120_000);
      expect(delayedMs(await collectEvents("dnd", {}))).toBe(180_000);
      expect(delayedMs(await collectEvents("idle", {}, { secondStatus: "dnd" }))).toBe(120_000);
    } finally {
      random.mockRestore();
    }
  });

  it("does not turn offline or regenerate conversation turns into mention delays", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const offlineEvents = await collectEvents("offline", { mentionedCharacterNames: ["Mira"] });
      expect(offlineEvents.some((event) => event.type === "offline")).toBe(true);
      expect(delayedMs(offlineEvents)).toBeNull();

      const offlineMentionEvents = await collectEvents(
        "offline",
        { mentionedCharacterNames: ["Mira"] },
        { secondStatus: "idle" },
      );
      expect(offlineMentionEvents.some((event) => event.type === "offline")).toBe(true);
      expect(delayedMs(offlineMentionEvents)).toBeNull();

      const regenerateEvents = await collectEvents("idle", {
        regenerateMessageId: "assistant-1",
        mentionedCharacterNames: ["Mira"],
      });
      expect(delayedMs(regenerateEvents)).toBeNull();
    } finally {
      random.mockRestore();
    }
  });
});

describe("startGeneration LLM stream errors", () => {
  it("throws the provider message from terminal stream error chunks", async () => {
    const deps = createDeps("idle", {
      mode: "roleplay",
      streamChunks: [{ type: "error", data: { message: "Provider failed" } }],
    });

    await expect(drainGeneration(startGeneration(deps, { chatId: "chat-1", message: "Hi Mira" }))).rejects.toThrow(
      "Provider failed",
    );
  });
});

describe("startGeneration context injection compatibility", () => {
  it("randomizes fixed integer seeds from every supported request location when regenerating conversation swipes", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const capture: { streamParameters: Record<string, unknown>[] } = { streamParameters: [] };
    const deps = createDeps("idle", {
      capture,
      messages: {
        "assistant-1": {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          characterId: "char-1",
          content: "Previous response.",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      },
    });

    try {
      for await (const event of startGeneration(deps, {
        chatId: "chat-1",
        message: "Regenerate that.",
        regenerateMessageId: "assistant-1",
        parameters: {
          seed: 1,
          customParameters: {
            seed: 4_294_967_295,
            repeat_penalty: 1.05,
          },
          custom_params: {
            seed: 42,
            dry_multiplier: 0.8,
          },
        },
      })) {
        if (event.type === "done") break;
      }
    } finally {
      random.mockRestore();
    }

    expect(capture.streamParameters[0]).toMatchObject({
      seed: 1_073_741_823,
      customParameters: {
        seed: 1_073_741_823,
        repeat_penalty: 1.05,
      },
      custom_params: {
        seed: 1_073_741_823,
        dry_multiplier: 0.8,
      },
    });
  });

  it("preserves nested non-integer custom seeds when regenerating conversation swipes", async () => {
    const capture: { streamParameters: Record<string, unknown>[] } = { streamParameters: [] };
    const deps = createDeps("idle", {
      capture,
      messages: {
        "assistant-1": {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          characterId: "char-1",
          content: "Previous response.",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      },
    });

    for await (const event of startGeneration(deps, {
      chatId: "chat-1",
      message: "Regenerate that.",
      regenerateMessageId: "assistant-1",
      parameters: {
        seed: "4294967295",
        customParameters: {
          seed: 123.45,
        },
        custom_params: {
          seed: null,
        },
      },
    })) {
      if (event.type === "done") break;
    }

    expect(capture.streamParameters[0]).not.toHaveProperty("seed");
    expect(capture.streamParameters[0]).toMatchObject({
      customParameters: {
        seed: 123.45,
      },
      custom_params: {
        seed: null,
      },
    });
  });

  it("preserves fixed integer seeds on non-regenerate turns", async () => {
    const capture: { streamParameters: Record<string, unknown>[] } = { streamParameters: [] };
    const deps = createDeps("idle", { capture, mode: "roleplay" });

    for await (const event of startGeneration(deps, {
      chatId: "chat-1",
      message: "Hi Mira.",
      parameters: {
        seed: 1,
        customParameters: {
          seed: 4_294_967_295,
        },
        custom_params: {
          seed: 42,
        },
      },
    })) {
      if (event.type === "done") break;
    }

    expect(capture.streamParameters[0]).toMatchObject({
      seed: 1,
      customParameters: {
        seed: 4_294_967_295,
      },
      custom_params: {
        seed: 42,
      },
    });
  });

  it("keeps legacy bare-string context injections when merging regenerated agent injections", async () => {
    const capture: { extraPatches: Array<{ messageId: string; patch: Record<string, unknown> }> } = {
      extraPatches: [],
    };
    const deps = createDeps("idle", {
      capture,
      messages: {
        "assistant-1": {
          id: "assistant-1",
          chatId: "chat-1",
          role: "assistant",
          characterId: "char-1",
          content: "Previous response.",
          createdAt: "2026-06-01T00:00:00.000Z",
          extra: {
            contextInjections: [
              "Legacy prose guidance.",
              { agentType: "memory-recall", agentName: "Memory Recall", text: "Remembered facts." },
              "   ",
            ],
          },
        },
      },
    });

    for await (const event of startGeneration(deps, {
      chatId: "chat-1",
      message: "Regenerate that.",
      regenerateMessageId: "assistant-1",
      agentInjectionOverrides: [{ agentType: "secret-plot", text: "New secret plot guidance." }],
    })) {
      if (event.type === "done") break;
    }

    expect(capture.extraPatches.at(-1)).toMatchObject({
      messageId: "assistant-1",
      patch: {
        contextInjections: [
          { agentType: "prose-guardian", text: "Legacy prose guidance." },
          { agentType: "memory-recall", agentName: "Memory Recall", text: "Remembered facts." },
          { agentType: "secret-plot", text: "New secret plot guidance." },
        ],
      },
    });
  });

  it("falls back to direct target lookup when regenerated message extra is not in loaded history", async () => {
    const capture: { extraPatches: Array<{ messageId: string; patch: Record<string, unknown> }> } = {
      extraPatches: [],
    };
    const deps = createDeps("idle", { capture });
    const target = {
      id: "assistant-1",
      chatId: "chat-1",
      role: "assistant",
      characterId: "char-1",
      content: "Previous response.",
      createdAt: "2026-06-01T00:00:00.000Z",
      extra: {
        contextInjections: ["Legacy prose guidance."],
      },
    };
    const originalGet = deps.storage.get;
    let targetReads = 0;
    deps.storage.get = async <T = unknown>(
      entity: StorageEntity,
      id: string,
      options?: Parameters<StorageGateway["get"]>[2],
    ): Promise<T | null> => {
      if (entity === "messages" && id === "assistant-1") {
        targetReads += 1;
        return (targetReads >= 3 ? target : null) as T | null;
      }
      return originalGet<T>(entity, id, options);
    };

    for await (const event of startGeneration(deps, {
      chatId: "chat-1",
      message: "Regenerate that.",
      regenerateMessageId: "assistant-1",
      agentInjectionOverrides: [{ agentType: "secret-plot", text: "New secret plot guidance." }],
    })) {
      if (event.type === "done") break;
    }

    expect(capture.extraPatches.at(-1)).toMatchObject({
      messageId: "assistant-1",
      patch: {
        contextInjections: [
          { agentType: "prose-guardian", text: "Legacy prose guidance." },
          { agentType: "secret-plot", text: "New secret plot guidance." },
        ],
      },
    });
  });

  it("does not erase regenerated message metadata when direct target lookup fails", async () => {
    const capture: { extraPatches: Array<{ messageId: string; patch: Record<string, unknown> }> } = {
      extraPatches: [],
    };
    const deps = createDeps("idle", { capture });
    const originalGet = deps.storage.get;
    deps.storage.get = async <T = unknown>(
      entity: StorageEntity,
      id: string,
      options?: Parameters<StorageGateway["get"]>[2],
    ): Promise<T | null> => {
      if (entity === "messages" && id === "assistant-1") {
        throw new Error("target read failed");
      }
      return originalGet<T>(entity, id, options);
    };

    await expect(async () => {
      for await (const event of startGeneration(deps, {
        chatId: "chat-1",
        message: "Regenerate that.",
        regenerateMessageId: "assistant-1",
        agentInjectionOverrides: [{ agentType: "secret-plot", text: "New secret plot guidance." }],
      })) {
        if (event.type === "done") break;
      }
    }).rejects.toThrow("target read failed");

    expect(capture.extraPatches).toHaveLength(0);
  });
});

describe("startGeneration agent injection review", () => {
  it("reviews only writer pre-generation injections in roleplay chats", async () => {
    const event = reviewEvent(await collectReviewEvents("roleplay"));

    expect(event?.type).toBe("agent_injection_review");
    expect(event?.data.injections).toEqual([
      {
        agentType: "prose-guardian",
        agentName: "Prose Guardian",
        text: "Keep the reply varied.",
      },
    ]);
  });

  it("skips agent injection review during regenerate turns", async () => {
    const events = await collectReviewEvents(
      "roleplay",
      { regenerateMessageId: "assistant-1" },
      { regenerate: true },
    );

    expect(reviewEvent(events)).toBeUndefined();
  });

  it("confines agent injection review pauses to roleplay and visual novel modes", async () => {
    const conversationEvents = await collectReviewEvents("conversation");
    const visualNovelEvents = await collectReviewEvents("visual_novel");

    expect(reviewEvent(conversationEvents)).toBeUndefined();
    expect(reviewEvent(visualNovelEvents)?.type).toBe("agent_injection_review");
  });
});

describe("startGeneration agent connection warnings", () => {
  it("warns when an agent uses the default-for-agents connection", async () => {
    const events = await collectDefaultAgentConnectionWarningEvents();
    const warning = events.find((event) => (event as { type: string }).type === "agent_warning") as
      | {
          type: "agent_warning";
          data: {
            code: string;
            severity: string;
            agentNames: string[];
            connectionName: string;
            model: string;
            message: string;
          };
        }
      | undefined;

    expect(warning?.data).toMatchObject({
      code: "default_agent_connection_active",
      severity: "warning",
      agentNames: ["Narrative Director"],
      connectionName: "Paid Agents",
      model: "paid-agent-model",
    });
    expect(warning?.data.message).toContain("may bill that provider");
  });

  it("does not warn when agents fall back to the chat connection without a default-for-agents connection", async () => {
    const events = await collectDefaultAgentConnectionWarningEvents({ defaultForAgents: false });

    expect(events.some((event) => (event as { type: string }).type === "agent_warning")).toBe(false);
  });

  it("warns through the manual agent retry path", async () => {
    const { events } = await collectDefaultAgentConnectionRetryEvents();
    const warning = events.find((event) => (event as { type: string }).type === "agent_warning");

    expect(warning).toMatchObject({
      type: "agent_warning",
      data: {
        code: "default_agent_connection_active",
        severity: "warning",
        agentNames: ["Narrative Director"],
        connectionName: "Paid Agents",
        model: "paid-agent-model",
      },
    });
  });

  it("propagates warnings through Lorebook Keeper backfill retries", async () => {
    const { events } = await collectLorebookKeeperBackfillEvents();
    const warning = events.find((event) => (event as { type: string }).type === "agent_warning");

    expect(warning).toMatchObject({
      type: "agent_warning",
      data: {
        code: "default_agent_connection_active",
        severity: "warning",
        agentNames: ["Lorebook Keeper"],
        connectionName: "Paid Agents",
        model: "paid-agent-model",
      },
    });
  });
});
