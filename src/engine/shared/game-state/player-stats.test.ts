import { describe, expect, it } from "vitest";
import { applyQuestUpdatesToPlayerStats, normalizeActiveQuestCollection } from "./player-stats";

describe("normalizeActiveQuestCollection", () => {
  it("normalizes a keyed quest map into an array using the map key as the entry id", () => {
    const quests = normalizeActiveQuestCollection({
      "quest-rescue": {
        name: "Rescue the Mayor",
        objectives: [{ description: "Find the cell", status: "done" }, { text: "Open the gate" }],
      },
      "quest-loot": {
        questEntryId: "loot-1",
        name: "Loot the Vault",
      },
    });

    expect(quests).toHaveLength(2);
    const rescue = quests.find((quest) => quest.name === "Rescue the Mayor");
    expect(rescue).toBeDefined();
    // Named keyed entry derives its questEntryId from the quest name (no explicit id given).
    expect(rescue?.questEntryId).toBe("Rescue the Mayor");
    expect(rescue?.objectives).toEqual([
      { text: "Find the cell", completed: true },
      { text: "Open the gate", completed: false },
    ]);

    const loot = quests.find((quest) => quest.name === "Loot the Vault");
    // Explicit questEntryId wins.
    expect(loot?.questEntryId).toBe("loot-1");
  });

  it("uses the map key as the quest name when a keyed entry has no name", () => {
    const quests = normalizeActiveQuestCollection({
      "Find the Relic": { objectives: [{ text: "search ruins" }] },
    });
    expect(quests).toHaveLength(1);
    // fallbackName (the map key) fills in both the name and the derived questEntryId.
    expect(quests[0]?.name).toBe("Find the Relic");
    expect(quests[0]?.questEntryId).toBe("Find the Relic");
    expect(quests[0]?.objectives).toEqual([{ text: "search ruins", completed: false }]);
  });

  it("flattens grouped containers and wrapper collections", () => {
    const grouped = normalizeActiveQuestCollection({
      groups: [{ quests: [{ name: "Quest A" }, { name: "Quest B" }] }, { quests: [{ name: "Quest C" }] }],
    });
    expect(grouped.map((quest) => quest.name)).toEqual(["Quest A", "Quest B", "Quest C"]);

    const items = normalizeActiveQuestCollection({ items: [{ name: "Quest D" }] });
    expect(items.map((quest) => quest.name)).toEqual(["Quest D"]);

    const wrapped = normalizeActiveQuestCollection({ activeQuests: [{ name: "Quest E" }] });
    expect(wrapped.map((quest) => quest.name)).toEqual(["Quest E"]);
  });

  it("normalizes object-shaped and nested objectives", () => {
    const [quest] = normalizeActiveQuestCollection([
      {
        name: "Investigate",
        objectives: [{ description: "Search the desk", status: "done" }, { text: "Read the letter" }],
      },
    ]);
    expect(quest?.objectives).toEqual([
      { text: "Search the desk", completed: true },
      { text: "Read the letter", completed: false },
    ]);
  });

  it("returns an empty array for non-collection / null values", () => {
    expect(normalizeActiveQuestCollection(null)).toEqual([]);
    expect(normalizeActiveQuestCollection(undefined)).toEqual([]);
    expect(normalizeActiveQuestCollection(42)).toEqual([]);
  });

  it("recovers nested objectives carried under a wrapper key during quest updates", () => {
    // collectQuestObjectives (used by quest updates) digs through nested objective wrappers.
    const { playerStats } = applyQuestUpdatesToPlayerStats({ activeQuests: [] }, [
      {
        action: "create",
        questName: "Nested",
        objectives: { tasks: [{ text: "Step one" }, { description: "Step two", status: "completed" }] },
      },
    ]);
    const quest = playerStats.activeQuests.find((entry) => entry.name === "Nested");
    expect(quest?.objectives).toEqual([
      { text: "Step one", completed: false },
      { text: "Step two", completed: true },
    ]);
  });

  it("recovers a quest's non-array objectives wrapper during collection normalization", () => {
    const [quest] = normalizeActiveQuestCollection([
      { name: "Wrapped", objectives: { tasks: [{ text: "a" }, { text: "b" }] } },
    ]);
    expect(quest?.objectives).toEqual([
      { text: "a", completed: false },
      { text: "b", completed: false },
    ]);
  });

  it("aggregates quests across all nested wrapper keys, not just the first", () => {
    const quests = normalizeActiveQuestCollection({
      quests: [{ name: "From quests" }],
      groups: [{ quests: [{ name: "From groups" }] }],
    });
    expect(quests.map((quest) => quest.name)).toEqual(["From quests", "From groups"]);
  });

  it("does not let a present-but-empty wrapper key swallow sibling keyed quests", () => {
    const quests = normalizeActiveQuestCollection({
      quests: [],
      "real-quest-id": { name: "Real Quest" },
    });
    expect(quests.map((quest) => quest.name)).toEqual(["Real Quest"]);
  });

  it("does not promote a non-quest keyed record to a phantom quest named after its key", () => {
    const quests = normalizeActiveQuestCollection({
      "find-the-key": { name: "Find the Key", objectives: ["search"] },
      "ui-flags": { collapsed: true, sortOrder: 2 },
    });
    // The real quest is kept; the unrelated config-shaped record is dropped, not
    // turned into a quest named "ui-flags".
    expect(quests.map((quest) => quest.name)).toEqual(["Find the Key"]);
  });
});

describe("applyQuestUpdatesToPlayerStats", () => {
  it("auto-removes a completed quest whose objectives are all done (or empty)", () => {
    const { playerStats, changed } = applyQuestUpdatesToPlayerStats(
      {
        activeQuests: [{ questEntryId: "q1", name: "Finish me", objectives: [{ text: "do it", completed: true }] }],
      },
      [{ action: "complete", questName: "q1" }],
    );
    expect(changed).toBe(true);
    expect(playerStats.activeQuests).toHaveLength(0);
  });

  it("keeps a completed quest that still has an incomplete objective", () => {
    const { playerStats } = applyQuestUpdatesToPlayerStats(
      {
        activeQuests: [
          {
            questEntryId: "q1",
            name: "Half done",
            objectives: [
              { text: "a", completed: true },
              { text: "b", completed: false },
            ],
          },
        ],
      },
      [{ action: "complete", questName: "q1" }],
    );
    expect(playerStats.activeQuests).toHaveLength(1);
    expect(playerStats.activeQuests[0]?.completed).toBe(true);
  });

  it("matches by questEntryId and by name, and accepts string action aliases", () => {
    // Match by questEntryId.
    const byId = applyQuestUpdatesToPlayerStats(
      { activeQuests: [{ questEntryId: "qid", name: "Quest Display Name" }] },
      [{ action: "update", questName: "qid", objectives: [{ text: "new objective" }] }],
    );
    expect(byId.playerStats.activeQuests[0]?.objectives).toEqual([{ text: "new objective", completed: false }]);

    // Match by name.
    const byName = applyQuestUpdatesToPlayerStats(
      { activeQuests: [{ questEntryId: "qid", name: "Quest Display Name" }] },
      [{ action: "update", questName: "Quest Display Name", objectives: [{ text: "named" }] }],
    );
    expect(byName.playerStats.activeQuests[0]?.objectives).toEqual([{ text: "named", completed: false }]);

    // "completed" alias -> complete (and auto-remove because objectives empty).
    const completedAlias = applyQuestUpdatesToPlayerStats({ activeQuests: [{ questEntryId: "qid", name: "Done" }] }, [
      { action: "completed", questName: "qid" },
    ]);
    expect(completedAlias.playerStats.activeQuests).toHaveLength(0);
    expect(completedAlias.changed).toBe(true);

    // "failed" alias -> fail (removes the quest).
    const failedAlias = applyQuestUpdatesToPlayerStats({ activeQuests: [{ questEntryId: "qid", name: "Doomed" }] }, [
      { action: "failed", questName: "qid" },
    ]);
    expect(failedAlias.playerStats.activeQuests).toHaveLength(0);
    expect(failedAlias.changed).toBe(true);

    // create when no match exists.
    const created = applyQuestUpdatesToPlayerStats({ activeQuests: [] }, [
      { action: "create", questName: "Brand New", objectives: [{ text: "begin" }] },
    ]);
    expect(created.playerStats.activeQuests).toHaveLength(1);
    expect(created.playerStats.activeQuests[0]).toMatchObject({
      questEntryId: "Brand New",
      name: "Brand New",
      completed: false,
      objectives: [{ text: "begin", completed: false }],
    });
  });

  it("normalizes a keyed quest collection before merging updates (matched by name)", () => {
    const { playerStats, changed } = applyQuestUpdatesToPlayerStats(
      {
        activeQuests: {
          "quest-1": { name: "Keyed Quest", objectives: [{ text: "step" }] },
        },
      },
      [{ action: "update", questName: "Keyed Quest", objectives: [{ text: "updated step" }] }],
    );
    // The non-array keyed map was normalized to a single quest, then matched by name and updated.
    expect(changed).toBe(true);
    expect(playerStats.activeQuests).toHaveLength(1);
    expect(playerStats.activeQuests[0]?.name).toBe("Keyed Quest");
    expect(playerStats.activeQuests[0]?.objectives).toEqual([{ text: "updated step", completed: false }]);
  });

  it("matches updates against a nameless keyed quest by the map key (questEntryId fallback)", () => {
    const { playerStats } = applyQuestUpdatesToPlayerStats(
      {
        activeQuests: {
          "quest-key": { objectives: [{ text: "step" }] },
        },
      },
      [{ action: "update", questName: "quest-key", objectives: [{ text: "updated step" }] }],
    );
    // Nameless keyed entry takes the map key as both name and questEntryId, so the update matches.
    expect(playerStats.activeQuests).toHaveLength(1);
    expect(playerStats.activeQuests[0]?.questEntryId).toBe("quest-key");
    expect(playerStats.activeQuests[0]?.objectives).toEqual([{ text: "updated step", completed: false }]);
  });

  it("reports changed=false for a no-op on already-array quests", () => {
    const original = {
      activeQuests: [{ questEntryId: "q1", name: "Stable", currentStage: 0, objectives: [], completed: false }],
    };
    const { changed } = applyQuestUpdatesToPlayerStats(original, []);
    expect(changed).toBe(false);
  });
});
