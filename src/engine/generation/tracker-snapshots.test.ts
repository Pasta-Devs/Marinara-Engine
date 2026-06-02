import { describe, expect, it } from "vitest";
import type { AgentResult } from "../contracts/types/agent";
import type { GameState } from "../contracts/types/game-state";
import type { StorageGateway } from "../capabilities/storage";
import { persistTrackerSnapshotForTurn } from "./tracker-snapshots";

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

describe("persistTrackerSnapshotForTurn", () => {
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
    const savedRows: Array<Record<string, unknown>> = [];
    const storage = {
      async list(collection: string) {
        return collection === "game-state-snapshots" ? [optimisticSnapshot] : [];
      },
      async saveTrackerSnapshot(_chatId: string, snapshot: Record<string, unknown>) {
        savedRows.push(snapshot);
        return snapshot;
      },
      async update() {
        return {};
      },
    } as unknown as StorageGateway;

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

    expect(savedRows).toHaveLength(1);
    expect(saved).toMatchObject({
      date: "Monday",
      time: "7:30 PM",
      temperature: "68\u00b0F",
    });
  });
});
