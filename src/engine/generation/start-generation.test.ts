import { describe, expect, it, vi } from "vitest";

import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageEntity, StorageGateway } from "../capabilities/storage";
import type { WeekSchedule } from "../modes/chat/schedules/schedule.service";
import { startGeneration, type StartGenerationInput } from "./start-generation";

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
  options: { secondStatus?: "idle" | "dnd" | "offline"; messages?: Record<string, Record<string, unknown>> } = {},
): Store {
  const characterIds = options.secondStatus ? ["char-1", "char-2"] : ["char-1"];
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode: "conversation",
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
      return [] as T[];
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
    capture?: { extraPatches?: Array<{ messageId: string; patch: Record<string, unknown> }> };
  } = {},
) {
  const llm: LlmGateway = {
    async complete() {
      return "";
    },
    async *stream() {
      yield { type: "token" as const, text: "Hello." };
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

describe("startGeneration context injection compatibility", () => {
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
});
