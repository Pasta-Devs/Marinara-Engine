import { describe, expect, it } from "vitest";

import type { StorageGateway, StorageEntity, StorageListOptions } from "../../../capabilities/storage";
import { generateConversationSchedules } from "./schedule.service";

const scheduleResponse = JSON.stringify({
  talkativeness: 50,
  inactivityThresholdMinutes: 120,
  days: {
    Monday: [{ time: "00:00-00:00", activity: "free time", status: "online" }],
  },
});

type Store = Partial<Record<StorageEntity, Record<string, Record<string, unknown>>>>;

function createStorage(store: Store): StorageGateway {
  return {
    async list<T = unknown>(entity: StorageEntity, options?: StorageListOptions): Promise<T[]> {
      const rows = Object.values(store[entity] ?? {});
      if (!options?.filters) return rows as T[];
      return rows.filter((row) =>
        Object.entries(options.filters ?? {}).every(([key, value]) => row[key] === value),
      ) as T[];
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
    async createChatMessage<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async updateChatMessage<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async deleteChatMessage(): Promise<{ deleted: boolean }> {
      return { deleted: true };
    },
    async patchChatMessageExtra<T = unknown>(): Promise<T> {
      return {} as T;
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
      return null as T | null;
    },
    async saveTrackerSnapshot<T = unknown>(): Promise<T> {
      return {} as T;
    },
    async listLorebookEntries<T = unknown>(lorebookId: string): Promise<T[]> {
      return Object.values(store["lorebook-entries"] ?? {}).filter((entry) => entry.lorebookId === lorebookId) as T[];
    },
    async createLorebookEntries<T = unknown>(): Promise<T[]> {
      return [] as T[];
    },
    async promptFull<T = unknown>(): Promise<T | null> {
      return null;
    },
  };
}

function baseStore(overrides: Store = {}): Store {
  return {
    chats: {
      "chat-1": {
        id: "chat-1",
        mode: "conversation",
        connectionId: "conn-1",
        characterIds: ["char-1"],
        metadata: { activeLorebookIds: ["active-lorebook"] },
      },
    },
    characters: {
      "char-1": {
        id: "char-1",
        data: {
          name: "Mira",
          description: "A careful astronomer.",
          personality: "Thoughtful and nocturnal.",
          tags: ["astronomer"],
        },
      },
    },
    connections: {
      "conn-1": { id: "conn-1", model: "test-model" },
    },
    lorebooks: {},
    "lorebook-entries": {},
    "lorebook-folders": {},
    ...overrides,
  };
}

async function runSchedule(store: Store): Promise<string> {
  let systemPrompt = "";
  await generateConversationSchedules(
    {
      storage: createStorage(store),
      llm: {
        async complete(request) {
          systemPrompt = String(request.messages.find((message) => message.role === "system")?.content ?? "");
          return scheduleResponse;
        },
        async *stream() {
          yield { type: "done" as const };
        },
        async listModels() {
          return [];
        },
      },
    },
    { chatId: "chat-1", forceRefresh: true },
  );
  return systemPrompt;
}

describe("generateConversationSchedules lorebook context", () => {
  it("includes scoped enabled lorebook entries in the schedule prompt", async () => {
    const prompt = await runSchedule(
      baseStore({
        lorebooks: {
          "active-lorebook": { id: "active-lorebook", name: "City Lore", enabled: true },
          "character-lorebook": {
            id: "character-lorebook",
            name: "Mira Lore",
            enabled: true,
            characterIds: ["char-1"],
          },
          "inactive-lorebook": { id: "inactive-lorebook", name: "Unused Lore", enabled: true },
        },
        "lorebook-entries": {
          "entry-city": {
            id: "entry-city",
            lorebookId: "active-lorebook",
            name: "Observatory District",
            content: "The observatory district is busiest from midnight until dawn.\n- Weekends have public tours.",
            enabled: true,
          },
          "entry-character": {
            id: "entry-character",
            lorebookId: "character-lorebook",
            name: "Night Shift",
            content: "Mira works the night shift at the observatory every weekday.",
            enabled: true,
          },
          "entry-disabled": {
            id: "entry-disabled",
            lorebookId: "active-lorebook",
            name: "Disabled",
            content: "This disabled entry should not appear.",
            enabled: false,
          },
          "entry-other": {
            id: "entry-other",
            lorebookId: "inactive-lorebook",
            name: "Other",
            content: "This inactive lorebook should not appear.",
            enabled: true,
          },
          "entry-filtered": {
            id: "entry-filtered",
            lorebookId: "active-lorebook",
            name: "Other Character",
            content: "This entry is filtered to another character.",
            enabled: true,
            characterFilterMode: "include",
            characterFilterIds: ["char-2"],
          },
        },
      }),
    );

    expect(prompt).toContain("<schedule_lorebook_context>");
    expect(prompt).toContain("The observatory district is busiest from midnight until dawn.");
    expect(prompt).toContain("- Weekends have public tours.");
    expect(prompt).toContain("Mira works the night shift at the observatory every weekday.");
    expect(prompt).not.toContain("This disabled entry should not appear.");
    expect(prompt).not.toContain("This inactive lorebook should not appear.");
    expect(prompt).not.toContain("This entry is filtered to another character.");
  });

  it("caps oversized lorebook entries before injecting schedule context", async () => {
    const prompt = await runSchedule(
      baseStore({
        lorebooks: {
          "active-lorebook": { id: "active-lorebook", name: "Huge Lore", enabled: true },
        },
        "lorebook-entries": {
          "entry-huge": {
            id: "entry-huge",
            lorebookId: "active-lorebook",
            name: "Huge Routine",
            content: `${"Routine fact. ".repeat(700)}TAIL_MARKER`,
            enabled: true,
          },
        },
      }),
    );

    expect(prompt).toContain("Huge Routine");
    expect(prompt).toContain("Routine fact.");
    expect(prompt).not.toContain("TAIL_MARKER");
  });
});
