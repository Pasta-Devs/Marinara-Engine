import { describe, expect, it } from "vitest";
import type { GameState } from "../../contracts/types/game-state";
import { normalizeGameStateTrackerRows } from "./tracker-row-ids";

function gameStateWithPlayerStats(playerStats: NonNullable<GameState["playerStats"]>): GameState {
  return {
    id: "state-1",
    chatId: "chat-1",
    messageId: "message-1",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats,
    personaStats: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("normalizeGameStateTrackerRows", () => {
  it("generates distinct quest ids for duplicate legacy quest names", () => {
    const normalized = normalizeGameStateTrackerRows(
      gameStateWithPlayerStats({
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [
          {
            questEntryId: "",
            name: "Find the key",
            currentStage: 0,
            objectives: [],
            completed: false,
          },
          {
            questEntryId: "",
            name: "Find the key",
            currentStage: 1,
            objectives: [],
            completed: false,
          },
        ],
        status: "",
      }),
    );

    const questIds = normalized.playerStats?.activeQuests.map((quest) => quest.questEntryId) ?? [];

    expect(questIds).toHaveLength(2);
    expect(questIds[0]).toMatch(/^manual-/);
    expect(questIds[1]).toMatch(/^manual-/);
    expect(new Set(questIds).size).toBe(2);
  });
});
