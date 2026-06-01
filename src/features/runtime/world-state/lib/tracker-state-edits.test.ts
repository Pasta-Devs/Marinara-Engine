import { describe, expect, it } from "vitest";
import type { CharacterStat, CustomTrackerField, InventoryItem, QuestProgress } from "../../../../engine/contracts/types/game-state";
import {
  mergeCharacterStatListUpdate,
  mergeCustomTrackerFieldListUpdate,
  mergeInventoryItemListItemUpdate,
  mergeQuestProgressListItemUpdate,
} from "./tracker-state-edits";

function stat(overrides: Partial<CharacterStat>): CharacterStat {
  return {
    statId: "stat-id",
    name: "HP",
    value: 10,
    max: 10,
    color: "#fff",
    ...overrides,
  };
}

function legacyStat(overrides: Omit<Partial<CharacterStat>, "statId">): CharacterStat {
  return { name: "HP", value: 10, max: 10, color: "#fff", ...overrides } as CharacterStat;
}

describe("tracker list durable row ids", () => {
  it("uses statId to update the intended duplicate character stat", () => {
    const previous = [stat({ statId: "hp-a", value: 10 }), stat({ statId: "hp-b", value: 5 })];
    const latest = [stat({ statId: "hp-a", value: 8 }), stat({ statId: "hp-b", value: 5 })];
    const next = [previous[0]!, stat({ statId: "hp-b", value: 7 })];

    expect(mergeCharacterStatListUpdate(previous, latest, next)).toEqual([
      stat({ statId: "hp-a", value: 8 }),
      stat({ statId: "hp-b", value: 7 }),
    ]);
  });

  it("uses statId to update the intended duplicate persona stat after latest rows reorder", () => {
    const previous = [
      stat({ statId: "energy-a", name: "Energy", value: 2 }),
      stat({ statId: "energy-b", name: "Energy", value: 3 }),
    ];
    const latest = [previous[1]!, previous[0]!];
    const next = [stat({ statId: "energy-a", name: "Energy", value: 4 }), previous[1]!];

    expect(mergeCharacterStatListUpdate(previous, latest, next)).toEqual([
      previous[1]!,
      stat({ statId: "energy-a", name: "Energy", value: 4 }),
    ]);
  });

  it("uses inventoryItemId to update the intended duplicate inventory item after latest rows reorder", () => {
    const itemA: InventoryItem = {
      inventoryItemId: "potion-a",
      name: "Potion",
      description: "",
      quantity: 1,
      location: "on_person",
    };
    const itemB: InventoryItem = {
      inventoryItemId: "potion-b",
      name: "Potion",
      description: "",
      quantity: 1,
      location: "on_person",
    };

    expect(mergeInventoryItemListItemUpdate([itemA, itemB], [itemB, itemA], 0, { ...itemA, quantity: 3 })).toEqual([
      itemB,
      { ...itemA, quantity: 3 },
    ]);
  });

  it("uses customFieldId to update the intended duplicate custom field", () => {
    const fieldA: CustomTrackerField = { customFieldId: "field-a", name: "Status", value: "agent-updated" };
    const fieldB: CustomTrackerField = { customFieldId: "field-b", name: "Status", value: "old" };

    expect(
      mergeCustomTrackerFieldListUpdate(
        [{ ...fieldA, value: "old" }, fieldB],
        [fieldA, fieldB],
        [{ ...fieldA, value: "old" }, { ...fieldB, value: "manual" }],
      ),
    ).toEqual([fieldA, { ...fieldB, value: "manual" }]);
  });

  it("uses objectiveId to update the intended duplicate quest objective", () => {
    const previousQuest: QuestProgress = {
      questEntryId: "quest-1",
      name: "Find the door",
      currentStage: 0,
      objectives: [
        { objectiveId: "objective-a", text: "Search the room", completed: false },
        { objectiveId: "objective-b", text: "Search the room", completed: false },
      ],
      completed: false,
    };
    const latestQuest: QuestProgress = {
      ...previousQuest,
      objectives: [previousQuest.objectives[1]!, previousQuest.objectives[0]!],
    };
    const nextQuest: QuestProgress = {
      ...previousQuest,
      objectives: [previousQuest.objectives[0]!, { ...previousQuest.objectives[1]!, completed: true }],
    };

    expect(mergeQuestProgressListItemUpdate([previousQuest], [latestQuest], 0, nextQuest)[0]?.objectives).toEqual([
      { ...previousQuest.objectives[1]!, completed: true },
      previousQuest.objectives[0]!,
    ]);
  });

  it("falls back to legacy visible keys for no-id rows", () => {
    const previous = [legacyStat({ name: "HP", value: 10 })];
    const latest = [legacyStat({ name: "HP", value: 8 })];
    const next = [legacyStat({ name: "HP", value: 6 })];

    expect(mergeCharacterStatListUpdate(previous, latest, next)).toEqual([legacyStat({ name: "HP", value: 6 })]);
  });
});
