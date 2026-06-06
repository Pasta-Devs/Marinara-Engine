import { describe, expect, it } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import type { AgentResult } from "../contracts/types/agent";
import type { GameState } from "../contracts/types/game-state";
import { persistTrackerSnapshotForTurn } from "./tracker-snapshots";

function storageWithRows(
  rows: Record<string, Record<string, unknown>[]>,
  initialSnapshots: Record<string, unknown>[] = [],
) {
  const snapshots: Record<string, unknown>[] = [...initialSnapshots];
  const storage = {
    list: async <T = unknown>(entity: string) =>
      (entity === "game-state-snapshots" ? snapshots : (rows[entity] ?? [])) as T[],
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
      const saved = { ...snapshot, id: snapshot.id || "snapshot-1" };
      snapshots.push(saved);
      return saved as T;
    },
    listLorebookEntries: async <T = unknown>() => [] as T[],
    createLorebookEntries: async <T = unknown>() => [] as T[],
    promptFull: async <T = unknown>() => null as T | null,
  } as StorageGateway;
  return { storage, snapshots };
}

function gameState(overrides: Partial<GameState>): GameState {
  return {
    id: "snapshot-1",
    chatId: "chat-1",
    messageId: "assistant-1",
    swipeIndex: 0,
    date: null,
    time: null,
    location: "Apartment",
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    committed: false,
    createdAt: "2026-06-02T00:00:00.000Z",
    ...overrides,
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

function worldStateResult(data: unknown): AgentResult {
  return {
    agentId: "world-state",
    agentType: "world-state",
    type: "game_state_update",
    data,
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
  };
}

function personaStatsResult(data: unknown): AgentResult {
  return {
    agentId: "persona-stats",
    agentType: "persona-stats",
    type: "persona_stats_update",
    data,
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
    const { storage } = storageWithRows({
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

  it("uses the pre-generation baseline to undo optimistic silent drift", async () => {
    const optimisticSnapshot = gameState({
      date: "Tuesday",
      time: "Morning",
      temperature: "Mild",
    });
    const baseline = gameState({
      id: "baseline-1",
      messageId: "assistant-0",
      date: "Monday",
      time: "7:30 PM",
      temperature: "68\u00b0F",
      committed: true,
    });
    const { storage, snapshots } = storageWithRows({}, [optimisticSnapshot as unknown as Record<string, unknown>]);

    const saved = await persistTrackerSnapshotForTurn(
      storage,
      "chat-1",
      { messageId: "assistant-1", swipeIndex: 0 },
      [
        worldStateResult({
          date: "Tuesday",
          time: "Morning",
          temperature: "Mild",
        }),
      ],
      {
        baseSnapshot: baseline,
        sourceText: "They keep talking in the apartment, neither checking the clock nor mentioning the weather.",
      },
    );

    expect(snapshots).toHaveLength(2);
    expect(saved).toMatchObject({
      date: "Monday",
      time: "7:30 PM",
      temperature: "68\u00b0F",
    });
  });

  it("does not clobber player inventory, status, or persona stats on empty persona-stats output", async () => {
    const baseline = gameState({
      playerStats: {
        stats: [],
        inventory: [{ name: "Iron Sword", quantity: 1 }],
        status: "Wounded",
      },
      personaStats: [{ name: "Health", value: 40, max: 100 }],
    } as unknown as Partial<GameState>);
    const { storage } = storageWithRows({}, []);

    const saved = await persistTrackerSnapshotForTurn(
      storage,
      "chat-1",
      { messageId: "assistant-1", swipeIndex: 0 },
      [personaStatsResult({ status: "", inventory: [], stats: [] })],
      { baseSnapshot: baseline },
    );

    expect(saved?.playerStats?.inventory).toHaveLength(1);
    expect(saved?.playerStats?.inventory?.[0]).toMatchObject({ name: "Iron Sword" });
    expect(saved?.playerStats?.status).toBe("Wounded");
    expect(saved?.personaStats).toHaveLength(1);
    expect(saved?.personaStats?.[0]).toMatchObject({ name: "Health", value: 40 });
  });

  it("applies persona-stats updates when the agent returns non-empty values", async () => {
    const baseline = gameState({
      playerStats: {
        stats: [],
        inventory: [{ name: "Iron Sword", quantity: 1 }],
        status: "Wounded",
      },
      personaStats: [{ name: "Health", value: 40, max: 100 }],
    } as unknown as Partial<GameState>);
    const { storage } = storageWithRows({}, []);

    const saved = await persistTrackerSnapshotForTurn(
      storage,
      "chat-1",
      { messageId: "assistant-1", swipeIndex: 0 },
      [
        personaStatsResult({
          status: "Healthy",
          inventory: [{ name: "Health Potion", quantity: 3 }],
          stats: [{ name: "Health", value: 90, max: 100 }],
        }),
      ],
      { baseSnapshot: baseline },
    );

    expect(saved?.playerStats?.status).toBe("Healthy");
    expect(saved?.playerStats?.inventory).toHaveLength(1);
    expect(saved?.playerStats?.inventory?.[0]).toMatchObject({ name: "Health Potion", quantity: 3 });
    expect(saved?.personaStats?.[0]).toMatchObject({ name: "Health", value: 90 });
  });
});
