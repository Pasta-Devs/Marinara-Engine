import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { scanActiveLorebooks } from "./active-lorebook-scanner";

type RowMap = Record<string, Array<Record<string, unknown>>>;

function storageWithRows(rows: RowMap, calls: { batchedEntryReads: number; singleEntryReads: number }): StorageGateway {
  return {
    list: async <T = unknown>(entity: string) => (rows[entity] ?? []) as T[],
    get: async <T = unknown>(entity: string, id: string) =>
      ((rows[entity]?.find((row) => row.id === id) ?? null) as T | null),
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
    listLorebookEntries: async <T = unknown>(lorebookId: string) => {
      calls.singleEntryReads += 1;
      return (rows["lorebook-entries"] ?? []).filter((row) => row.lorebookId === lorebookId) as T[];
    },
    listLorebookEntriesByLorebookIds: async <T = unknown>(lorebookIds: string[]) => {
      calls.batchedEntryReads += 1;
      const ids = new Set(lorebookIds);
      return (rows["lorebook-entries"] ?? []).filter((row) => ids.has(String(row.lorebookId))) as T[];
    },
    createLorebookEntries: async <T = unknown>() => [] as T[],
    promptFull: async <T = unknown>() => null as T | null,
  };
}

describe("scanActiveLorebooks", () => {
  it("reads entries for active lorebooks in one batched storage call", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [
          { id: "book-a", name: "Book A", enabled: true, isGlobal: true },
          { id: "book-b", name: "Book B", enabled: true, isGlobal: true },
          { id: "book-c", name: "Book C", enabled: true, isGlobal: true },
        ],
        "lorebook-folders": [{ id: "disabled-folder", lorebookId: "book-b", enabled: false }],
        "lorebook-entries": [
          {
            id: "entry-a",
            lorebookId: "book-a",
            name: "Entry A",
            content: "alpha lore",
            constant: true,
            enabled: true,
          },
          {
            id: "entry-b-hidden",
            lorebookId: "book-b",
            folderId: "disabled-folder",
            name: "Entry B hidden",
            content: "hidden lore",
            constant: true,
            enabled: true,
          },
          {
            id: "entry-c",
            lorebookId: "book-c",
            name: "Entry C",
            content: "gamma lore",
            constant: true,
            enabled: true,
          },
        ],
      },
      calls,
    );

    const result = await scanActiveLorebooks({
      storage,
      chat: { id: "chat-1", mode: "roleplay", metadata: {} },
      characters: [],
      persona: null,
      storedMessages: [{ id: "message-1", role: "user", content: "hello" }],
      embeddingSource: null,
    });

    expect(calls).toEqual({ batchedEntryReads: 1, singleEntryReads: 0 });
    expect(result.entriesForTiming.map((entry) => entry.id)).toEqual(["entry-a", "entry-c"]);
  });
});
