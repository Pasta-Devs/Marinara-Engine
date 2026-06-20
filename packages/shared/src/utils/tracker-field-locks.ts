import type {
  CharacterStat,
  CustomTrackerField,
  GameState,
  InventoryItem,
  PlayerStats,
  PresentCharacter,
  QuestProgress,
  TrackerFieldLocks,
} from "../types/game-state.js";

type WorldTrackerField = "date" | "time" | "location" | "weather" | "temperature";
type TextCharacterField = "emoji" | "name" | "mood" | "appearance" | "outfit" | "thoughts";
type StatField = "name" | "value" | "max";
type InventoryField = "name" | "quantity" | "description" | "location";
type QuestField = "name" | "completed" | "currentStage";
type QuestObjectiveField = "text" | "completed";
type CustomTrackerFieldKey = "name" | "value";

const PLAYER_STATS_FALLBACK: PlayerStats = {
  stats: [],
  attributes: null,
  skills: {},
  inventory: [],
  activeQuests: [],
  status: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function encodeSegment(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return encodeURIComponent(text || "_").replace(/\./g, "%2E");
}

function normalizeComparableText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ") : "";
}

export function normalizeTrackerFieldLocks(value: unknown): TrackerFieldLocks {
  if (!isRecord(value)) return {};
  const locks: TrackerFieldLocks = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (!key || enabled !== true) continue;
    locks[key] = true;
  }
  return locks;
}

export function parseTrackerFieldLocks(value: unknown): TrackerFieldLocks {
  if (typeof value === "string") {
    try {
      return normalizeTrackerFieldLocks(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return normalizeTrackerFieldLocks(value);
}

export function trackerFieldLocksAreEmpty(locks: TrackerFieldLocks | null | undefined) {
  return !locks || !Object.values(locks).some(Boolean);
}

export function trackerFieldLocksAreEqual(
  left: TrackerFieldLocks | null | undefined,
  right: TrackerFieldLocks | null | undefined,
) {
  const leftLocks = normalizeTrackerFieldLocks(left);
  const rightLocks = normalizeTrackerFieldLocks(right);
  const leftKeys = Object.keys(leftLocks);
  const rightKeys = Object.keys(rightLocks);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => rightLocks[key] === true);
}

export function isTrackerFieldLocked(locks: TrackerFieldLocks | null | undefined, key: string) {
  return locks?.[key] === true;
}

export function toggleTrackerFieldLock(locks: TrackerFieldLocks | null | undefined, key: string) {
  const next = normalizeTrackerFieldLocks(locks);
  if (next[key]) {
    delete next[key];
  } else {
    next[key] = true;
  }
  return next;
}

export function removeTrackerArrayItemLocks(
  locks: TrackerFieldLocks | null | undefined,
  prefix: string,
  removedIndex: number,
) {
  return removeIndexedTrackerLocks(locks, prefix.trim() ? `${prefix.trim()}.` : "", removedIndex);
}

function removeIndexedTrackerLocks(
  locks: TrackerFieldLocks | null | undefined,
  indexedPrefix: string,
  removedIndex: number,
) {
  const normalized = normalizeTrackerFieldLocks(locks);
  if (!Number.isSafeInteger(removedIndex) || removedIndex < 0 || !indexedPrefix.trim()) return normalized;

  const next: TrackerFieldLocks = {};

  for (const [key, enabled] of Object.entries(normalized)) {
    if (enabled !== true) continue;
    if (!key.startsWith(indexedPrefix)) {
      next[key] = true;
      continue;
    }

    const suffix = key.slice(indexedPrefix.length);
    const match = /^(\d+)(\.|$)/.exec(suffix);
    if (!match) {
      next[key] = true;
      continue;
    }

    const indexText = match[1] ?? "";
    const index = Number(indexText);
    if (!Number.isSafeInteger(index)) {
      next[key] = true;
      continue;
    }
    if (index === removedIndex) continue;
    if (index < removedIndex) {
      next[key] = true;
      continue;
    }

    next[`${indexedPrefix}${index - 1}${suffix.slice(indexText.length)}`] = true;
  }

  return next;
}

export function removeTrackerFieldLockPrefix(locks: TrackerFieldLocks | null | undefined, prefix: string) {
  const normalized = normalizeTrackerFieldLocks(locks);
  const lockPrefix = prefix.trim();
  if (!lockPrefix) return normalized;

  const childPrefix = `${lockPrefix}.`;
  const next: TrackerFieldLocks = {};
  for (const [key, enabled] of Object.entries(normalized)) {
    if (enabled !== true) continue;
    if (key === lockPrefix || key.startsWith(childPrefix)) continue;
    next[key] = true;
  }
  return next;
}

function shiftIndexedReferenceLocks(
  locks: TrackerFieldLocks | null | undefined,
  collectionPrefix: string,
  removedIndex: number,
) {
  return removeIndexedTrackerLocks(
    locks,
    collectionPrefix.trim() ? `${collectionPrefix.trim()}.index:` : "",
    removedIndex,
  );
}

export function worldTrackerLockKey(field: WorldTrackerField) {
  return `world.${field}`;
}

export function personaStatusTrackerLockKey() {
  return "persona.status";
}

export function personaStatTrackerLockKey(index: number, field: StatField) {
  return `persona.stats.${index}.${field}`;
}

export function personaStatsTrackerLockPrefix() {
  return "persona.stats";
}

export function inventoryTrackerLockKey(index: number, field: InventoryField) {
  return `player.inventory.${index}.${field}`;
}

export function inventoryTrackerLockPrefix() {
  return "player.inventory";
}

function characterLockRef(character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined, index: number) {
  const id = typeof character?.characterId === "string" ? character.characterId.trim() : "";
  if (id) return `id:${encodeSegment(id)}`;
  const name = typeof character?.name === "string" ? character.name.trim() : "";
  if (name) return `name:${encodeSegment(name)}`;
  // Last-resort index locks follow position for unnamed generated rows.
  return `index:${index}`;
}

export function characterTrackerLockPrefix(
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  index: number,
) {
  return `characters.${characterLockRef(character, index)}`;
}

export function characterTrackerLockKey(
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  index: number,
  field: TextCharacterField,
) {
  return `${characterTrackerLockPrefix(character, index)}.${field}`;
}

export function characterStatTrackerLockKey(
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  characterIndex: number,
  statIndex: number,
  field: StatField,
) {
  return `${characterStatsTrackerLockPrefix(character, characterIndex)}.${statIndex}.${field}`;
}

export function characterStatsTrackerLockPrefix(
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  index: number,
) {
  return `${characterTrackerLockPrefix(character, index)}.stats`;
}

export function removeTrackerCharacterLocks(
  locks: TrackerFieldLocks | null | undefined,
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  removedIndex: number,
) {
  return shiftIndexedReferenceLocks(
    removeTrackerFieldLockPrefix(locks, characterTrackerLockPrefix(character, removedIndex)),
    "characters",
    removedIndex,
  );
}

export function characterCustomFieldTrackerLockKey(
  character: Pick<PresentCharacter, "characterId" | "name"> | null | undefined,
  characterIndex: number,
  fieldName: string,
  field: CustomTrackerFieldKey,
) {
  return `${characterTrackerLockPrefix(character, characterIndex)}.custom.${encodeSegment(fieldName)}.${field}`;
}

function questLockRef(quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined, index: number) {
  const id = typeof quest?.questEntryId === "string" ? quest.questEntryId.trim() : "";
  if (id) return `id:${encodeSegment(id)}`;
  const name = typeof quest?.name === "string" ? quest.name.trim() : "";
  if (name) return `name:${encodeSegment(name)}`;
  // Last-resort index locks follow position for unnamed generated rows.
  return `index:${index}`;
}

export function questTrackerLockPrefix(
  quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined,
  index: number,
) {
  return `quests.${questLockRef(quest, index)}`;
}

export function questTrackerLockKey(
  quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined,
  index: number,
  field: QuestField,
) {
  return `${questTrackerLockPrefix(quest, index)}.${field}`;
}

export function questObjectiveTrackerLockKey(
  quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined,
  questIndex: number,
  objectiveIndex: number,
  field: QuestObjectiveField,
) {
  return `${questObjectivesTrackerLockPrefix(quest, questIndex)}.${objectiveIndex}.${field}`;
}

export function questObjectivesTrackerLockPrefix(
  quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined,
  index: number,
) {
  return `${questTrackerLockPrefix(quest, index)}.objectives`;
}

export function removeTrackerQuestLocks(
  locks: TrackerFieldLocks | null | undefined,
  quest: Pick<QuestProgress, "questEntryId" | "name"> | null | undefined,
  removedIndex: number,
) {
  return shiftIndexedReferenceLocks(
    removeTrackerFieldLockPrefix(locks, questTrackerLockPrefix(quest, removedIndex)),
    "quests",
    removedIndex,
  );
}

export function customTrackerLockKey(index: number, field: CustomTrackerFieldKey) {
  return `player.custom.${index}.${field}`;
}

export function customTrackerLockPrefix() {
  return "player.custom";
}

function normalizeEffectiveTrackerFieldLocks(
  value: TrackerFieldLocks | null | undefined,
  currentState: GameState | null | undefined,
) {
  const locks = normalizeTrackerFieldLocks(value);
  const legacyFields = currentState?.playerStats?.customTrackerFields;
  if (!Array.isArray(legacyFields)) return locks;
  legacyFields.forEach((field, index) => {
    if (field?.locked === true) locks[customTrackerLockKey(index, "value")] = true;
  });
  return locks;
}

function hasLockWithPrefix(locks: TrackerFieldLocks, prefix: string) {
  return Object.keys(locks).some((key) => locks[key] === true && key.startsWith(prefix));
}

function getPlayerStats(state: GameState | null | undefined): PlayerStats {
  return state?.playerStats ?? PLAYER_STATS_FALLBACK;
}

function findCurrentCharacterIndex(
  next: Partial<PresentCharacter>,
  currentCharacters: PresentCharacter[],
  fallbackIndex: number,
) {
  const id = typeof next.characterId === "string" ? next.characterId.trim() : "";
  if (id) {
    const byId = currentCharacters.findIndex((character) => character.characterId === id);
    if (byId >= 0) return byId;
  }
  const name = normalizeComparableText(next.name);
  if (name) {
    const byName = currentCharacters.findIndex((character) => normalizeComparableText(character.name) === name);
    if (byName >= 0) return byName;
  }
  return fallbackIndex < currentCharacters.length ? fallbackIndex : -1;
}

function findCurrentQuestIndex(next: Partial<QuestProgress>, currentQuests: QuestProgress[], fallbackIndex: number) {
  const id = typeof next.questEntryId === "string" ? next.questEntryId.trim() : "";
  if (id) {
    const byId = currentQuests.findIndex((quest) => quest.questEntryId === id);
    if (byId >= 0) return byId;
  }
  const name = normalizeComparableText(next.name);
  if (name) {
    const byName = currentQuests.findIndex((quest) => normalizeComparableText(quest.name) === name);
    if (byName >= 0) return byName;
  }
  return fallbackIndex < currentQuests.length ? fallbackIndex : -1;
}

function findCurrentNamedIndex<T extends { name?: string }>(
  next: Partial<T>,
  current: T[],
  fallbackIndex: number,
  usedCurrent: Set<number>,
) {
  const name = normalizeComparableText(next.name);
  if (name) {
    const byName = current.findIndex((item, index) => !usedCurrent.has(index) && normalizeComparableText(item.name) === name);
    if (byName >= 0) return byName;
  }
  return fallbackIndex < current.length && !usedCurrent.has(fallbackIndex) ? fallbackIndex : -1;
}

function mergeNamedRowsWithLocks<T extends { name?: string }>(
  nextRows: T[],
  currentRows: T[] | null | undefined,
  locks: TrackerFieldLocks,
  {
    mergeRow,
    prefixFor,
  }: {
    mergeRow: (nextRow: T, currentRow: T, currentIndex: number) => T;
    prefixFor: (currentIndex: number) => string;
  },
) {
  const current = currentRows ?? [];
  const usedCurrent = new Set<number>();
  const merged = nextRows.map((row, index) => {
    const currentIndex = findCurrentNamedIndex(row, current, index, usedCurrent);
    const currentRow = currentIndex >= 0 ? current[currentIndex] : null;
    if (!currentRow) return row;
    usedCurrent.add(currentIndex);
    return mergeRow(row, currentRow, currentIndex);
  });
  for (let index = 0; index < current.length; index += 1) {
    if (usedCurrent.has(index)) continue;
    if (hasLockWithPrefix(locks, prefixFor(index))) merged.push(current[index]!);
  }
  return merged;
}

function mergeStatsWithLocks(
  nextStats: CharacterStat[],
  currentStats: CharacterStat[] | null | undefined,
  locks: TrackerFieldLocks,
  keyFor: (index: number, field: StatField) => string,
) {
  return mergeNamedRowsWithLocks(nextStats, currentStats, locks, {
    mergeRow: (stat, currentStat, currentIndex) => {
      const next = { ...stat };
      if (isTrackerFieldLocked(locks, keyFor(currentIndex, "name"))) next.name = currentStat.name;
      if (isTrackerFieldLocked(locks, keyFor(currentIndex, "value"))) next.value = currentStat.value;
      if (isTrackerFieldLocked(locks, keyFor(currentIndex, "max"))) next.max = currentStat.max;
      return next;
    },
    prefixFor: (index) => keyFor(index, "name").replace(/\.name$/, "."),
  });
}

function mergeInventoryWithLocks(
  nextItems: InventoryItem[],
  currentItems: InventoryItem[] | null | undefined,
  locks: TrackerFieldLocks,
) {
  return mergeNamedRowsWithLocks(nextItems, currentItems, locks, {
    mergeRow: (item, currentItem, currentIndex) => {
      const next = { ...item };
      for (const field of ["name", "quantity", "description", "location"] as const) {
        if (isTrackerFieldLocked(locks, inventoryTrackerLockKey(currentIndex, field))) {
          next[field] = currentItem[field] as never;
        }
      }
      return next;
    },
    prefixFor: (index) => `player.inventory.${index}.`,
  });
}

function mergeCustomTrackerFieldsWithGenericLocks(
  nextFields: CustomTrackerField[],
  currentFields: CustomTrackerField[] | null | undefined,
  locks: TrackerFieldLocks,
) {
  return mergeNamedRowsWithLocks(nextFields, currentFields, locks, {
    mergeRow: (field, currentField, currentIndex) => {
      const next = { ...field };
      if (isTrackerFieldLocked(locks, customTrackerLockKey(currentIndex, "name"))) next.name = currentField.name;
      if (isTrackerFieldLocked(locks, customTrackerLockKey(currentIndex, "value"))) next.value = currentField.value;
      return next;
    },
    prefixFor: (index) => `player.custom.${index}.`,
  });
}

function mergeQuestObjectivesWithLocks(
  nextObjectives: QuestProgress["objectives"],
  currentObjectives: QuestProgress["objectives"] | null | undefined,
  locks: TrackerFieldLocks,
  quest: QuestProgress,
  questIndex: number,
) {
  const current = currentObjectives ?? [];
  const merged = nextObjectives.map((objective, index) => {
    const currentObjective = current[index];
    if (!currentObjective) return objective;
    const next = { ...objective };
    if (isTrackerFieldLocked(locks, questObjectiveTrackerLockKey(quest, questIndex, index, "text"))) {
      next.text = currentObjective.text;
    }
    if (isTrackerFieldLocked(locks, questObjectiveTrackerLockKey(quest, questIndex, index, "completed"))) {
      next.completed = currentObjective.completed;
    }
    return next;
  });
  for (let index = nextObjectives.length; index < current.length; index += 1) {
    const prefix = questObjectiveTrackerLockKey(quest, questIndex, index, "text").replace(/\.text$/, ".");
    if (hasLockWithPrefix(locks, prefix)) merged.push(current[index]!);
  }
  return merged;
}

function mergeQuestsWithLocks(
  nextQuests: QuestProgress[],
  currentQuests: QuestProgress[] | null | undefined,
  locks: TrackerFieldLocks,
) {
  const current = currentQuests ?? [];
  const usedCurrent = new Set<number>();
  const merged = nextQuests.map((quest, index) => {
    const currentIndex = findCurrentQuestIndex(quest, current, index);
    const currentQuest = currentIndex >= 0 ? current[currentIndex] : null;
    if (!currentQuest) return quest;
    usedCurrent.add(currentIndex);
    const next = { ...quest };
    if (isTrackerFieldLocked(locks, questTrackerLockKey(currentQuest, currentIndex, "name"))) {
      next.name = currentQuest.name;
    }
    if (isTrackerFieldLocked(locks, questTrackerLockKey(currentQuest, currentIndex, "completed"))) {
      next.completed = currentQuest.completed;
    }
    if (isTrackerFieldLocked(locks, questTrackerLockKey(currentQuest, currentIndex, "currentStage"))) {
      next.currentStage = currentQuest.currentStage;
    }
    if (Array.isArray(next.objectives)) {
      next.objectives = mergeQuestObjectivesWithLocks(next.objectives, currentQuest.objectives, locks, currentQuest, currentIndex);
    }
    return next;
  });
  current.forEach((quest, index) => {
    if (usedCurrent.has(index)) return;
    if (hasLockWithPrefix(locks, `quests.${questLockRef(quest, index)}.`)) merged.push(quest);
  });
  return merged;
}

function mergeCharacterCustomFieldsWithLocks(
  nextFields: Record<string, string> | null | undefined,
  currentFields: Record<string, string> | null | undefined,
  locks: TrackerFieldLocks,
  character: PresentCharacter,
  characterIndex: number,
): Record<string, string> | undefined {
  let next = nextFields ? { ...nextFields } : null;
  const current = currentFields ?? {};
  let hasLockedField = false;
  for (const [name, value] of Object.entries(current)) {
    const nameLocked = isTrackerFieldLocked(
      locks,
      characterCustomFieldTrackerLockKey(character, characterIndex, name, "name"),
    );
    const valueLocked = isTrackerFieldLocked(
      locks,
      characterCustomFieldTrackerLockKey(character, characterIndex, name, "value"),
    );
    if (nameLocked || valueLocked) {
      hasLockedField = true;
      const nextValue = (next ?? {})[name];
      (next ??= {})[name] = valueLocked ? value : typeof nextValue === "string" ? nextValue : value;
    }
  }
  return nextFields || hasLockedField ? (next ?? undefined) : undefined;
}

function mergeCharactersWithLocks(
  nextCharacters: PresentCharacter[],
  currentCharacters: PresentCharacter[] | null | undefined,
  locks: TrackerFieldLocks,
) {
  const current = currentCharacters ?? [];
  const usedCurrent = new Set<number>();
  const merged = nextCharacters.map((character, index) => {
    const currentIndex = findCurrentCharacterIndex(character, current, index);
    const currentCharacter = currentIndex >= 0 ? current[currentIndex] : null;
    if (!currentCharacter) return character;
    usedCurrent.add(currentIndex);
    const next = { ...character };
    for (const field of ["emoji", "name", "mood", "appearance", "outfit", "thoughts"] as const) {
      if (isTrackerFieldLocked(locks, characterTrackerLockKey(currentCharacter, currentIndex, field))) {
        next[field] = currentCharacter[field] as never;
      }
    }
    if (Array.isArray(next.stats)) {
      next.stats = mergeStatsWithLocks(next.stats, currentCharacter.stats, locks, (statIndex, field) =>
        characterStatTrackerLockKey(currentCharacter, currentIndex, statIndex, field),
      );
    }
    const customFields = mergeCharacterCustomFieldsWithLocks(
      next.customFields,
      currentCharacter.customFields,
      locks,
      currentCharacter,
      currentIndex,
    );
    if (customFields !== undefined) next.customFields = customFields;
    return next;
  });
  current.forEach((character, index) => {
    if (usedCurrent.has(index)) return;
    if (hasLockWithPrefix(locks, `characters.${characterLockRef(character, index)}.`)) merged.push(character);
  });
  return merged;
}

export function applyTrackerFieldLocksToGameStatePatch<T extends Record<string, unknown>>(
  patch: T,
  currentState: GameState | null | undefined,
  fieldLocks: TrackerFieldLocks | null | undefined = currentState?.fieldLocks,
): T {
  const locks = normalizeEffectiveTrackerFieldLocks(fieldLocks, currentState);
  if (trackerFieldLocksAreEmpty(locks) || !currentState) return patch;

  const next = { ...patch } as Record<string, unknown>;
  for (const field of ["date", "time", "location", "weather", "temperature"] as const) {
    if (field in next && isTrackerFieldLocked(locks, worldTrackerLockKey(field))) {
      next[field] = currentState[field];
    }
  }

  if (Array.isArray(next.presentCharacters)) {
    next.presentCharacters = mergeCharactersWithLocks(next.presentCharacters as PresentCharacter[], currentState.presentCharacters, locks);
  }

  if (Array.isArray(next.personaStats)) {
    next.personaStats = mergeStatsWithLocks(next.personaStats as CharacterStat[], currentState.personaStats, locks, (index, field) =>
      personaStatTrackerLockKey(index, field),
    );
  }

  if (isRecord(next.playerStats)) {
    const currentPlayerStats = getPlayerStats(currentState);
    const playerStatsPatch = { ...next.playerStats } as Partial<PlayerStats>;
    if ("status" in playerStatsPatch && isTrackerFieldLocked(locks, personaStatusTrackerLockKey())) {
      playerStatsPatch.status = currentPlayerStats.status;
    }
    if (Array.isArray(playerStatsPatch.inventory)) {
      playerStatsPatch.inventory = mergeInventoryWithLocks(playerStatsPatch.inventory, currentPlayerStats.inventory, locks);
    }
    if (Array.isArray(playerStatsPatch.activeQuests)) {
      playerStatsPatch.activeQuests = mergeQuestsWithLocks(playerStatsPatch.activeQuests, currentPlayerStats.activeQuests, locks);
    }
    if (Array.isArray(playerStatsPatch.customTrackerFields)) {
      playerStatsPatch.customTrackerFields = mergeCustomTrackerFieldsWithGenericLocks(
        playerStatsPatch.customTrackerFields,
        currentPlayerStats.customTrackerFields,
        locks,
      );
    }
    next.playerStats = playerStatsPatch;
  }

  return next as T;
}
