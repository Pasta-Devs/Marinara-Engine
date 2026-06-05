import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import { LIMITS } from "../contracts/constants/defaults";
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

  it("keeps keyword-matched activation-condition entries active when plain chats have no game state", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [{ id: "book-a", name: "Book A", enabled: true, isGlobal: true }],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-conditional",
            lorebookId: "book-a",
            name: "Conditional entry",
            content: "plain chat lore",
            keys: ["moon-gate"],
            enabled: true,
            activationConditions: [{ field: "location", operator: "equals", value: "Moon Base" }],
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
      storedMessages: [{ id: "message-1", role: "user", content: "moon-gate" }],
      embeddingSource: null,
    });

    expect(result.processedLore.includedEntries.map((entry) => entry.entry.id)).toEqual(["entry-conditional"]);
  });

  it("still enforces activation-condition field values when game state is present", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [{ id: "book-a", name: "Book A", enabled: true, isGlobal: true }],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-conditional",
            lorebookId: "book-a",
            name: "Conditional entry",
            content: "game lore",
            keys: ["moon-gate"],
            enabled: true,
            activationConditions: [{ field: "location", operator: "equals", value: "Moon Base" }],
          },
        ],
      },
      calls,
    );

    const result = await scanActiveLorebooks({
      storage,
      chat: { id: "chat-1", mode: "game", metadata: {}, gameState: { location: "Forest" } },
      characters: [],
      persona: null,
      storedMessages: [{ id: "message-1", role: "user", content: "moon-gate" }],
      embeddingSource: null,
    });

    expect(result.processedLore.includedEntries.map((entry) => entry.entry.id)).toEqual([]);
  });

  it("caps injected entries using lorebook budget priority", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const makeEntry = (
      id: string,
      order: number,
      options: { constant?: boolean; key?: string },
    ): Record<string, unknown> => ({
      id,
      lorebookId: "book-cap",
      name: id,
      content: `${id} lore`,
      constant: options.constant ?? false,
      keys: options.key ? [options.key] : [],
      enabled: true,
      order,
    });
    const storage = storageWithRows(
      {
        lorebooks: [{ id: "book-cap", name: "Cap book", enabled: true, isGlobal: true, tokenBudget: 0 }],
        "lorebook-folders": [],
        "lorebook-entries": [
          ...Array.from({ length: 3 }, (_, index) =>
            makeEntry(`constant-${index + 1}`, 1000 + index, { constant: true }),
          ),
          ...Array.from({ length: 97 }, (_, index) =>
            makeEntry(`fresh-${index + 1}`, 2000 + index, { key: "fresh-key" }),
          ),
          ...Array.from({ length: 5 }, (_, index) => makeEntry(`older-${index + 1}`, index, { key: "older-key" })),
        ],
      },
      calls,
    );

    const result = await scanActiveLorebooks({
      storage,
      chat: { id: "chat-1", mode: "roleplay", metadata: {} },
      characters: [],
      persona: null,
      storedMessages: [
        { id: "message-1", role: "user", content: "older-key appeared earlier" },
        { id: "message-2", role: "assistant", content: "noted" },
        { id: "message-3", role: "user", content: "fresh-key is the latest user turn" },
      ],
      request: { lorebookTokenBudget: 0 },
      embeddingSource: null,
    });

    const includedIds = result.processedLore.includedEntries.map((entry) => entry.entry.id);
    expect(includedIds).toHaveLength(LIMITS.MAX_LOREBOOK_ENTRIES);
    expect(includedIds.slice(0, 3)).toEqual(["constant-1", "constant-2", "constant-3"]);
    expect(includedIds.filter((id) => id.startsWith("older-"))).toEqual([]);
  });

  it("recursively activates entries across active lorebooks after selected frontier content", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [
          {
            id: "book-a",
            name: "Book A",
            enabled: true,
            isGlobal: true,
            recursiveScanning: true,
            maxRecursionDepth: 1,
          },
          {
            id: "book-b",
            name: "Book B",
            enabled: true,
            isGlobal: true,
            recursiveScanning: true,
            maxRecursionDepth: 1,
          },
        ],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-a",
            lorebookId: "book-a",
            name: "Entry A",
            content: "beta-key",
            keys: ["alpha-key"],
            enabled: true,
            order: 10,
          },
          {
            id: "entry-prevent",
            lorebookId: "book-a",
            name: "Entry Prevent",
            content: "delta-key",
            keys: ["stop-key"],
            enabled: true,
            order: 20,
            preventRecursion: true,
          },
          {
            id: "entry-b",
            lorebookId: "book-b",
            name: "Entry B",
            content: "gamma-key",
            keys: ["beta-key"],
            enabled: true,
            order: 30,
          },
          {
            id: "entry-too-deep",
            lorebookId: "book-b",
            name: "Entry Too Deep",
            content: "too deep",
            keys: ["gamma-key"],
            enabled: true,
            order: 40,
          },
          {
            id: "entry-blocked",
            lorebookId: "book-b",
            name: "Entry Blocked",
            content: "blocked",
            keys: ["delta-key"],
            enabled: true,
            order: 50,
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
      storedMessages: [{ id: "message-1", role: "user", content: "alpha-key stop-key" }],
      embeddingSource: null,
    });

    const includedIds = result.processedLore.includedEntries.map((entry) => entry.entry.id);
    expect(includedIds).toEqual(["entry-a", "entry-prevent", "entry-b"]);
  });

  it("does not use non-recursive lorebook entries as recursive frontier content", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [
          {
            id: "book-a",
            name: "Book A",
            enabled: true,
            isGlobal: true,
            recursiveScanning: true,
            maxRecursionDepth: 3,
          },
          { id: "book-b", name: "Book B", enabled: true, isGlobal: true, recursiveScanning: false },
        ],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-a",
            lorebookId: "book-a",
            name: "Entry A",
            content: "beta-key",
            keys: ["alpha-key"],
            enabled: true,
            order: 10,
          },
          {
            id: "entry-b",
            lorebookId: "book-b",
            name: "Entry B",
            content: "gamma-key",
            keys: ["beta-key"],
            enabled: true,
            order: 20,
          },
          {
            id: "entry-c",
            lorebookId: "book-a",
            name: "Entry C",
            content: "should not activate",
            keys: ["gamma-key"],
            enabled: true,
            order: 30,
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
      storedMessages: [{ id: "message-1", role: "user", content: "alpha-key" }],
      embeddingSource: null,
    });

    const includedIds = result.processedLore.includedEntries.map((entry) => entry.entry.id);
    expect(includedIds).toEqual(["entry-a", "entry-b"]);
  });

  it("does not recursively activate from entries excluded by the chat lorebook budget", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [
          {
            id: "book-a",
            name: "Book A",
            enabled: true,
            isGlobal: true,
            recursiveScanning: true,
            maxRecursionDepth: 2,
          },
        ],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-budget-skipped-frontier",
            lorebookId: "book-a",
            name: "Budget skipped frontier",
            content: "This entry is too long for the tiny budget and mentions beta-key.",
            keys: ["alpha-key"],
            enabled: true,
            order: 100,
          },
          {
            id: "entry-recursive-only",
            lorebookId: "book-a",
            name: "Recursive only",
            content: "x",
            keys: ["beta-key"],
            enabled: true,
            order: 0,
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
      storedMessages: [
        { id: "message-1", role: "user", content: "alpha-key appeared earlier" },
        { id: "message-2", role: "assistant", content: "noted" },
        { id: "message-3", role: "user", content: "latest turn omits the trigger" },
      ],
      request: { lorebookTokenBudget: 1 },
      embeddingSource: null,
    });

    expect(result.processedLore.includedEntries).toEqual([]);
    expect(result.budgetSkippedLorebookEntries.map((entry) => entry.id)).toEqual(["entry-budget-skipped-frontier"]);
  });

  it("keeps lower-priority entries skipped after the chat lorebook budget is exhausted", async () => {
    const calls = { batchedEntryReads: 0, singleEntryReads: 0 };
    const storage = storageWithRows(
      {
        lorebooks: [{ id: "book-a", name: "Book A", enabled: true, isGlobal: true }],
        "lorebook-folders": [],
        "lorebook-entries": [
          {
            id: "entry-large",
            lorebookId: "book-a",
            name: "Large entry",
            content: "This entry is too large for the tiny budget.",
            keys: ["alpha-key"],
            enabled: true,
            order: 0,
          },
          {
            id: "entry-small",
            lorebookId: "book-a",
            name: "Small entry",
            content: "x",
            keys: ["alpha-key"],
            enabled: true,
            order: 10,
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
      storedMessages: [{ id: "message-1", role: "user", content: "alpha-key" }],
      request: { lorebookTokenBudget: 1 },
      embeddingSource: null,
    });

    expect(result.processedLore.includedEntries).toEqual([]);
    expect(result.budgetSkippedLorebookEntries.map((entry) => entry.id)).toEqual(["entry-large", "entry-small"]);
  });
});
