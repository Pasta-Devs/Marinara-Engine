import type {
  CharacterStat,
  CustomTrackerField,
  GameState,
  InventoryItem,
  PlayerStats,
  PresentCharacter,
  QuestObjective,
  QuestProgress,
} from "../../contracts/types/game-state";

type TrackerRowFamily =
  | "character-stat"
  | "player-stat"
  | "persona-stat"
  | "inventory-item"
  | "custom-field"
  | "quest-objective";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugTrackerLabel(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "row";
}

function makeDefaultTrackerRowId(family: TrackerRowFamily, label: string, index: number): string {
  return `${family}-${slugTrackerLabel(label)}-${index + 1}`;
}

export function makeManualTrackerRowId(): string {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `manual-${id}`;
}

function normalizeCharacterStats(
  stats: readonly Partial<CharacterStat>[] | null | undefined,
  family: Extract<TrackerRowFamily, "character-stat" | "player-stat" | "persona-stat">,
): CharacterStat[] {
  return (stats ?? []).map((stat, index) => {
    const name = readString(stat.name) || "Stat";
    return {
      statId: readString(stat.statId) || makeDefaultTrackerRowId(family, name, index),
      name,
      value: typeof stat.value === "number" && Number.isFinite(stat.value) ? stat.value : 0,
      max: typeof stat.max === "number" && Number.isFinite(stat.max) ? stat.max : 100,
      color: readString(stat.color) || "var(--primary)",
    };
  });
}

function normalizeInventoryItems(items: readonly Partial<InventoryItem>[] | null | undefined): InventoryItem[] {
  return (items ?? []).map((item, index) => {
    const name = readString(item.name) || "Item";
    return {
      inventoryItemId: readString(item.inventoryItemId) || makeDefaultTrackerRowId("inventory-item", name, index),
      name,
      description: readString(item.description),
      quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1,
      location: readString(item.location) || "on_person",
    };
  });
}

function normalizeCustomTrackerFields(
  fields: readonly Partial<CustomTrackerField>[] | null | undefined,
): CustomTrackerField[] {
  return (fields ?? []).map((field, index) => {
    const name = readString(field.name) || "Field";
    return {
      customFieldId: readString(field.customFieldId) || makeDefaultTrackerRowId("custom-field", name, index),
      name,
      value: readString(field.value),
    };
  });
}

function normalizeQuestObjectives(
  objectives: readonly Partial<QuestObjective>[] | null | undefined,
): QuestObjective[] {
  return (objectives ?? []).map((objective, index) => {
    const text = readString(objective.text) || "Objective";
    return {
      objectiveId: readString(objective.objectiveId) || makeDefaultTrackerRowId("quest-objective", text, index),
      text,
      completed: objective.completed === true,
    };
  });
}

function normalizeQuestProgressRows(quests: readonly Partial<QuestProgress>[] | null | undefined): QuestProgress[] {
  return (quests ?? []).map((quest) => {
    const name = readString(quest.name) || "Quest";
    return {
      questEntryId: readString(quest.questEntryId) || makeManualTrackerRowId(),
      name,
      currentStage: typeof quest.currentStage === "number" && Number.isFinite(quest.currentStage) ? quest.currentStage : 0,
      objectives: normalizeQuestObjectives(quest.objectives),
      completed: quest.completed === true,
    };
  });
}

function normalizePlayerStatsTrackerRows(playerStats: PlayerStats | null | undefined): PlayerStats | null {
  if (!playerStats) return null;
  return {
    ...playerStats,
    stats: normalizeCharacterStats(playerStats.stats, "player-stat"),
    inventory: normalizeInventoryItems(playerStats.inventory),
    activeQuests: normalizeQuestProgressRows(playerStats.activeQuests),
    customTrackerFields: playerStats.customTrackerFields
      ? normalizeCustomTrackerFields(playerStats.customTrackerFields)
      : undefined,
  };
}

function normalizePresentCharacterTrackerRows(
  characters: readonly PresentCharacter[] | null | undefined,
): PresentCharacter[] {
  return (characters ?? []).map((character) => ({
    ...character,
    stats: normalizeCharacterStats(character.stats, "character-stat"),
  }));
}

export function normalizeGameStateTrackerRows(state: GameState): GameState {
  return {
    ...state,
    presentCharacters: normalizePresentCharacterTrackerRows(state.presentCharacters),
    playerStats: normalizePlayerStatsTrackerRows(state.playerStats),
    personaStats: state.personaStats ? normalizeCharacterStats(state.personaStats, "persona-stat") : null,
  };
}
