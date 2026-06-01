import { describe, expect, it, vi } from "vitest";
import type { StorageGateway } from "../capabilities/storage";
import type { AgentResult, AgentResultType } from "../contracts/types/agent";
import { getTrackerSnapshotForTarget, persistTrackerSnapshotForTurn } from "./tracker-snapshots";

function agentResult(agentType: string, data: Record<string, unknown>): AgentResult {
  const resultTypes: Record<string, AgentResultType> = {
    "character-tracker": "character_tracker_update",
    "persona-stats": "persona_stats_update",
    "custom-tracker": "custom_tracker_update",
    quest: "quest_update",
  };
  return {
    agentId: agentType,
    agentType,
    type: resultTypes[agentType] ?? "game_state_update",
    data,
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
  };
}

describe("tracker snapshot row id normalization", () => {
  it("defaults missing nested tracker row ids before saving agent snapshots", async () => {
    const savedSnapshots: Record<string, unknown>[] = [];
    const storage = {
      list: vi.fn(async () => []),
      get: vi.fn(async () => ({ id: "chat-1", gameState: null })),
      saveTrackerSnapshot: vi.fn(async (_chatId: string, snapshot: Record<string, unknown>) => {
        savedSnapshots.push(snapshot);
        return snapshot;
      }),
      update: vi.fn(async () => null),
    } as unknown as StorageGateway;

    const saved = await persistTrackerSnapshotForTurn(
      storage,
      "chat-1",
      { messageId: "assistant-1", swipeIndex: 0 },
      [
        agentResult("character-tracker", {
          presentCharacters: [
            {
              characterId: "char-1",
              name: "Mira",
              stats: [
                { name: "HP", value: 6, max: 10, color: "#f00" },
                { name: "HP", value: 4, max: 10, color: "#0f0" },
              ],
            },
          ],
        }),
        agentResult("persona-stats", {
          stats: [{ name: "Energy", value: 3, max: 5, color: "#00f" }],
          inventory: [{ name: "Potion", description: "", quantity: 2, location: "on_person" }],
        }),
        agentResult("custom-tracker", {
          fields: [{ name: "Status", value: "Alert" }],
        }),
        agentResult("quest", {
          updates: [{ action: "create", questName: "Find the door", objectives: ["Search the room"] }],
        }),
      ],
    );

    const snapshot = savedSnapshots[0]!;
    expect(snapshot.presentCharacters).toEqual([
      expect.objectContaining({
        stats: [
          expect.objectContaining({ statId: "character-stat-hp-1" }),
          expect.objectContaining({ statId: "character-stat-hp-2" }),
        ],
      }),
    ]);
    expect(snapshot.personaStats).toEqual([expect.objectContaining({ statId: "persona-stat-energy-1" })]);
    expect((snapshot.playerStats as Record<string, unknown>).inventory).toEqual([
      expect.objectContaining({ inventoryItemId: "inventory-item-potion-1" }),
    ]);
    expect((snapshot.playerStats as Record<string, unknown>).customTrackerFields).toEqual([
      expect.objectContaining({ customFieldId: "custom-field-status-1" }),
    ]);
    expect(((snapshot.playerStats as Record<string, unknown>).activeQuests as Array<Record<string, unknown>>)[0]?.objectives).toEqual([
      expect.objectContaining({ objectiveId: "quest-objective-search-the-room-1" }),
    ]);
    expect(saved?.presentCharacters[0]?.stats[1]?.statId).toBe("character-stat-hp-2");
  });

  it("normalizes legacy no-id rows when reading tracker snapshots", async () => {
    const storage = {
      list: vi.fn(async () => [
        {
          id: "snapshot-1",
          chatId: "chat-1",
          kind: "tracker",
          messageId: "assistant-1",
          swipeIndex: 0,
          presentCharacters: [
            { characterId: "char-1", name: "Mira", stats: [{ name: "HP", value: 6, max: 10, color: "#f00" }] },
          ],
          recentEvents: [],
          playerStats: {
            stats: [],
            attributes: null,
            skills: {},
            inventory: [{ name: "Potion", description: "", quantity: 1, location: "on_person" }],
            activeQuests: [
              {
                questEntryId: "quest-1",
                name: "Quest",
                currentStage: 0,
                objectives: [{ text: "Search", completed: false }],
                completed: false,
              },
            ],
            customTrackerFields: [{ name: "Status", value: "Alert" }],
            status: "",
          },
          personaStats: [{ name: "Energy", value: 3, max: 5, color: "#00f" }],
          createdAt: "2026-05-31T00:00:00.000Z",
        },
      ]),
    } as unknown as StorageGateway;

    const snapshot = await getTrackerSnapshotForTarget(storage, "chat-1", { messageId: "assistant-1", swipeIndex: 0 });

    expect(snapshot?.presentCharacters[0]?.stats[0]?.statId).toBe("character-stat-hp-1");
    expect(snapshot?.personaStats?.[0]?.statId).toBe("persona-stat-energy-1");
    expect(snapshot?.playerStats?.inventory[0]?.inventoryItemId).toBe("inventory-item-potion-1");
    expect(snapshot?.playerStats?.customTrackerFields?.[0]?.customFieldId).toBe("custom-field-status-1");
    expect(snapshot?.playerStats?.activeQuests[0]?.objectives[0]?.objectiveId).toBe("quest-objective-search-1");
  });
});
