import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import type { AgentResult } from "../contracts/types/agent";
import { persistTrackerSnapshotForTurn } from "./tracker-snapshots";

function storageWithRows(rows: Record<string, Record<string, unknown>[]>): StorageGateway {
  const snapshots: Record<string, unknown>[] = [];
  return {
    list: async <T = unknown>(entity: string) => (entity === "game-state-snapshots" ? snapshots : (rows[entity] ?? [])) as T[],
    get: async <T = unknown>(entity: string, id: string) =>
      ((rows[entity]?.find((row) => row.id === id) ?? null) as T | null),
    create: async <T = unknown>() => ({} as T),
    update: async <T = unknown>(entity: string, id: string, patch: Record<string, unknown>) => {
      const row = rows[entity]?.find((candidate) => candidate.id === id);
      if (row) Object.assign(row, patch);
      return (row ?? patch) as T;
    },
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
    saveTrackerSnapshot: async <T = unknown>(_chatId: string, snapshot: Record<string, unknown>) => {
      const saved = { ...snapshot, id: "snapshot-1" };
      snapshots.push(saved);
      return saved as T;
    },
    listLorebookEntries: async <T = unknown>() => [] as T[],
    createLorebookEntries: async <T = unknown>() => [] as T[],
    promptFull: async <T = unknown>() => null as T | null,
  };
}

function characterTrackerResult(presentCharacters: unknown[]): AgentResult {
  return {
    agentId: "agent-characters",
    agentType: "character-tracker",
    type: "character_tracker_update",
    data: { presentCharacters },
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
  };
}

describe("tracker snapshots", () => {
  it("does not persist player persona rows from character tracker output", async () => {
    const chat = {
      id: "chat-1",
      personaId: "persona-1",
      gameState: {
        presentCharacters: [{ characterId: "{{user}}", name: "{{user}}" }],
      },
    };
    const storage = storageWithRows({
      chats: [chat],
      personas: [{ id: "persona-1", name: "Celia" }],
    });

    const saved = await persistTrackerSnapshotForTurn(
      storage,
      "chat-1",
      { messageId: "message-1", swipeIndex: 0 },
      [
        characterTrackerResult([
          { characterId: "{{user}}", name: "{{user}}" },
          { characterId: "persona-1", name: "Celia" },
          { characterId: "npc-1", name: "Ari", mood: "curious" },
        ]),
      ],
    );

    expect(saved?.presentCharacters).toHaveLength(1);
    expect(saved?.presentCharacters[0]).toMatchObject({
      characterId: "npc-1",
      name: "Ari",
      mood: "curious",
    });
    expect((chat.gameState as { presentCharacters?: unknown[] }).presentCharacters).toEqual(saved?.presentCharacters);
  });
});
