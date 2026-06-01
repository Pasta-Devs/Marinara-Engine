import { expect, test } from "vitest";
import type { StorageGateway, StorageListOptions } from "../capabilities/storage";
import { scanActiveLorebookEntries } from "./active-lorebooks";
import { scanActiveLorebooks } from "./active-lorebook-scanner";

type Row = Record<string, unknown>;

const chat = {
  id: "chat-1",
  mode: "roleplay",
  metadata: {},
  characterIds: ["char-1"],
  connectionId: "conn-1",
};

const lorebook = {
  id: "book-1",
  name: "Gordon Facts",
  enabled: true,
  isGlobal: true,
  recursiveScanning: false,
};

const semanticEntry = {
  id: "entry-semantic-gordon",
  lorebookId: "book-1",
  name: "Gordon",
  content: "Gordon the rabbit is a jerk.",
  description: "Gordon the rabbit is a jerk.",
  keys: [],
  secondaryKeys: [],
  enabled: true,
  constant: false,
  selective: false,
  selectiveLogic: "and",
  probability: 100,
  position: 0,
  role: "system",
  depth: 0,
  order: 0,
  useRegex: false,
  matchWholeWords: false,
  caseSensitive: false,
  ephemeral: null,
  group: "",
  groupWeight: null,
  folderId: null,
  locked: false,
  preventRecursion: false,
  tag: "",
  relationships: {},
  dynamicState: {},
  scanDepth: null,
  sticky: null,
  cooldown: null,
  delay: null,
  activationConditions: [],
  schedule: null,
  excludeFromVectorization: false,
  embedding: [1, 0, 0],
  additionalMatchingSources: [],
  characterFilterMode: "any",
  characterFilterIds: [],
  characterTagFilterMode: "any",
  characterTagFilters: [],
  generationTriggerFilterMode: "any",
  generationTriggerFilters: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const keywordEntry = {
  ...semanticEntry,
  id: "entry-keyword-gordon",
  name: "Gordon keyword",
  keys: ["Gordon"],
  embedding: null,
};

const rows: Record<string, Row[]> = {
  chats: [chat],
  characters: [{ id: "char-1", name: "Narrator", data: { name: "Narrator" }, tags: [] }],
  personas: [],
  lorebooks: [lorebook],
  "lorebook-entries": [semanticEntry, keywordEntry],
  "lorebook-folders": [],
};

function matchesFilters(row: Row, filters?: Record<string, unknown>): boolean {
  if (!filters) return true;
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

const storage: StorageGateway = {
  async list<T = unknown>(entity: string, options?: StorageListOptions): Promise<T[]> {
    return ((rows[entity] ?? []).filter((row) => matchesFilters(row, options?.filters)) as T[]) ?? [];
  },
  async get<T = unknown>(entity: string, id: string): Promise<T | null> {
    return ((rows[entity] ?? []).find((row) => row.id === id) as T | undefined) ?? null;
  },
  async listChatMessages<T = unknown>(): Promise<T[]> {
    return [{ id: "message-1", chatId: "chat-1", role: "user", content: "Tell me about Gordon" } as T];
  },
  async listLorebookEntries<T = unknown>(lorebookId: string): Promise<T[]> {
    return rows["lorebook-entries"].filter((row) => row.lorebookId === lorebookId) as T[];
  },
  async create<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async update<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async delete(): Promise<{ deleted: boolean }> {
    throw new Error("not needed");
  },
  async createChatMessage<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async updateChatMessage<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async deleteChatMessage(): Promise<{ deleted: boolean }> {
    throw new Error("not needed");
  },
  async patchChatMessageExtra<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async addChatMessageSwipe<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async patchChatMetadata<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async patchChatSummaries<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async listChatMemories<T = unknown>(): Promise<T[]> {
    return [];
  },
  async getWorldState<T = unknown>(): Promise<T | null> {
    return null;
  },
  async saveTrackerSnapshot<T = unknown>(): Promise<T> {
    throw new Error("not needed");
  },
  async createLorebookEntries<T = unknown>(): Promise<T[]> {
    throw new Error("not needed");
  },
  async promptFull<T = unknown>(): Promise<T | null> {
    return null;
  },
};

const embeddingSource = {
  async embed(texts: string[]) {
    return texts.map((text) => (text.toLowerCase().includes("gordon") ? [1, 0, 0] : [0, 1, 0]));
  },
};

test("active world info can include semantic-only vectorized lorebook entries", async () => {
  const activePanelScan = await scanActiveLorebookEntries(storage, "chat-1", { embeddingSource });
  const directSemanticScan = await scanActiveLorebooks({
    storage,
    chat,
    characters: [{ id: "char-1", name: "Narrator", description: "", tags: [] }],
    persona: null,
    storedMessages: await storage.listChatMessages("chat-1"),
    latestUserInput: "Tell me about Gordon",
    embeddingSource,
  });

  expect(directSemanticScan.processedLore.includedEntries.map((entry) => entry.entry.name)).toContain("Gordon");
  expect(activePanelScan.entries.map((entry) => entry.name)).toContain("Gordon");
});

test("active world info keeps keyword matches when semantic search is unavailable", async () => {
  const activePanelScan = await scanActiveLorebookEntries(storage, "chat-1");

  expect(activePanelScan.semanticStatus).toEqual({
    state: "missing_embedding_source",
    vectorizedEntryCount: 1,
  });
  expect(activePanelScan.entries.map((entry) => entry.name)).toEqual(["Gordon keyword"]);
});

test("active world info does not activate unrelated semantic matches", async () => {
  const unrelatedStorage: StorageGateway = {
    ...storage,
    async listChatMessages<T = unknown>(): Promise<T[]> {
      return [{ id: "message-1", chatId: "chat-1", role: "user", content: "Tell me about Alice" } as T];
    },
  };

  const activePanelScan = await scanActiveLorebookEntries(unrelatedStorage, "chat-1", { embeddingSource });

  expect(activePanelScan.semanticStatus).toEqual({
    state: "ready",
    vectorizedEntryCount: 1,
  });
  expect(activePanelScan.entries).toEqual([]);
});
