import type {
  CharacterStat,
  CustomTrackerField,
  InventoryItem,
  PresentCharacter,
  QuestProgress,
} from "../../../../engine/contracts/types/game-state";

type TrackerItemMerger<T extends object> = (previous: T | undefined, latest: T | undefined, next: T) => T;
type TrackerItemKeyGetter<T> = (item: T | undefined) => string | null | undefined;
type NamedTrackerItem = { name?: string | null };
type QuestObjective = QuestProgress["objectives"][number];

export function replaceTrackerListItem<T>(items: readonly T[], index: number, item: T): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return items.map((current, currentIndex) => (currentIndex === index ? item : current));
}

export function removeTrackerListItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, currentIndex) => currentIndex !== index);
}

export function appendTrackerListItem<T>(items: readonly T[], item: T): T[] {
  return [...items, item];
}

function mergeChangedTrackerFields<T extends object>(
  previous: T | undefined,
  latest: T | undefined,
  next: T,
): T {
  const merged = { ...(latest ?? previous ?? next) } as T;
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (!previous || !Object.is(next[key], previous[key])) {
      merged[key] = next[key];
    }
  }
  return merged;
}

export function mergeTrackerListItemUpdate<T extends object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  index: number,
  nextItem: T,
  mergeItem: TrackerItemMerger<T> = mergeChangedTrackerFields,
): T[] {
  const latestItem = latestItems[index];
  if (!latestItem && index >= latestItems.length) return [...latestItems];
  return replaceTrackerListItem(latestItems, index, mergeItem(previousItems[index], latestItem, nextItem));
}

function getLatestListIndexByKey<T>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  index: number,
  getKey: TrackerItemKeyGetter<T>,
) {
  const previousKey = getKey(previousItems[index]);
  if (!previousKey) return index < latestItems.length ? index : null;
  const latestIndex = latestItems.findIndex((item) => getKey(item) === previousKey);
  return latestIndex === -1 ? null : latestIndex;
}

function mergeTrackerListItemsByKey<T extends object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  nextItems: readonly T[],
  getKey: TrackerItemKeyGetter<T>,
  mergeItem: TrackerItemMerger<T>,
): T[] {
  const merged = [...latestItems];
  for (let index = 0; index < nextItems.length; index += 1) {
    const latestIndex = getLatestListIndexByKey(previousItems, latestItems, index, getKey);
    if (latestIndex === null) continue;
    const latestItem = latestItems[latestIndex];
    if (!latestItem && latestIndex >= latestItems.length) continue;
    merged[latestIndex] = mergeItem(previousItems[index], latestItem, nextItems[index]);
  }
  return merged;
}

function mergeKeyedTrackerListItemUpdate<T extends object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  index: number,
  nextItem: T,
  getKey: TrackerItemKeyGetter<T>,
  mergeItem: TrackerItemMerger<T>,
): T[] {
  const latestIndex = getLatestListIndexByKey(previousItems, latestItems, index, getKey);
  if (latestIndex === null) return [...latestItems];
  const latestItem = latestItems[latestIndex];
  if (!latestItem && latestIndex >= latestItems.length) return [...latestItems];
  return replaceTrackerListItem(
    latestItems,
    latestIndex,
    mergeItem(previousItems[index], latestItem, nextItem),
  );
}

function removeKeyedTrackerListItem<T>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  index: number,
  getKey: TrackerItemKeyGetter<T>,
): T[] {
  const latestIndex = getLatestListIndexByKey(previousItems, latestItems, index, getKey);
  return latestIndex === null ? [...latestItems] : removeTrackerListItem(latestItems, latestIndex);
}

function isSameListItem<T>(previousItem: T | undefined, nextItem: T | undefined, getKey?: TrackerItemKeyGetter<T>) {
  if (!getKey) return previousItem === nextItem;

  const previousKey = getKey(previousItem);
  const nextKey = getKey(nextItem);
  if (previousKey || nextKey) return previousKey === nextKey;
  return previousItem === nextItem;
}

function getRemovedListIndex<T>(
  previousItems: readonly T[],
  nextItems: readonly T[],
  getKey?: TrackerItemKeyGetter<T>,
) {
  if (nextItems.length !== previousItems.length - 1) return null;
  for (let index = 0; index < previousItems.length; index += 1) {
    if (!isSameListItem(previousItems[index], nextItems[index], getKey)) return index;
  }
  return previousItems.length - 1;
}

function getAppendedListItem<T>(
  previousItems: readonly T[],
  nextItems: readonly T[],
  getKey?: TrackerItemKeyGetter<T>,
) {
  if (nextItems.length !== previousItems.length + 1) return null;
  for (let index = 0; index < previousItems.length; index += 1) {
    if (!isSameListItem(previousItems[index], nextItems[index], getKey)) return null;
  }
  return nextItems[nextItems.length - 1];
}

export function mergeTrackerListUpdate<T extends object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  nextItems: readonly T[],
  mergeItem: TrackerItemMerger<T> = mergeChangedTrackerFields,
  getKey?: TrackerItemKeyGetter<T>,
): T[] {
  const removedIndex = getRemovedListIndex(previousItems, nextItems, getKey);
  if (removedIndex !== null) {
    return getKey
      ? removeKeyedTrackerListItem(previousItems, latestItems, removedIndex, getKey)
      : removeTrackerListItem(latestItems, removedIndex);
  }

  const appendedItem = getAppendedListItem(previousItems, nextItems, getKey);
  if (appendedItem) return appendTrackerListItem(latestItems, appendedItem);

  if (nextItems.length !== previousItems.length) return [...nextItems];

  if (getKey) return mergeTrackerListItemsByKey(previousItems, latestItems, nextItems, getKey, mergeItem);

  const merged = [...latestItems];
  for (let index = 0; index < nextItems.length; index += 1) {
    merged[index] = mergeItem(previousItems[index], latestItems[index], nextItems[index]);
  }
  return merged;
}

function namedTrackerItemKey(item: NamedTrackerItem | undefined) {
  return item?.name?.trim() || null;
}

function questObjectiveKey(item: QuestObjective | undefined) {
  return item?.text?.trim() || null;
}

function makeManualTrackerId() {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `manual-${id}`;
}

export function mergeNamedTrackerListUpdate<T extends NamedTrackerItem & object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  nextItems: readonly T[],
  mergeItem: TrackerItemMerger<T> = mergeChangedTrackerFields,
): T[] {
  return mergeTrackerListUpdate(previousItems, latestItems, nextItems, mergeItem, namedTrackerItemKey);
}

function mergeTrackerRecordUpdate<T>(
  previous: Readonly<Record<string, T>>,
  latest: Readonly<Record<string, T>>,
  next: Readonly<Record<string, T>>,
): Record<string, T> {
  const merged = { ...latest };
  for (const key of Object.keys(previous)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) delete merged[key];
  }
  for (const key of Object.keys(next)) {
    if (!Object.prototype.hasOwnProperty.call(previous, key) || !Object.is(previous[key], next[key])) {
      merged[key] = next[key];
    }
  }
  return merged;
}

function mergePresentCharacterUpdate(
  previous: PresentCharacter | undefined,
  latest: PresentCharacter | undefined,
  next: PresentCharacter,
): PresentCharacter {
  const merged = mergeChangedTrackerFields(previous, latest, next);
  if (!previous) return merged;

  if (!Object.is(previous.stats, next.stats)) {
    merged.stats = mergeNamedTrackerListUpdate(previous.stats ?? [], latest?.stats ?? [], next.stats ?? []);
  }

  if (!Object.is(previous.customFields, next.customFields)) {
    merged.customFields = mergeTrackerRecordUpdate(
      previous.customFields ?? {},
      latest?.customFields ?? {},
      next.customFields ?? {},
    );
  }

  return merged;
}

function mergeKeyedTrackerListUpdate<T extends object>(
  previousItems: readonly T[],
  latestItems: readonly T[],
  nextItems: readonly T[],
  getKey: TrackerItemKeyGetter<T>,
  mergeItem: TrackerItemMerger<T>,
): T[] {
  const removedIndex = getRemovedListIndex(previousItems, nextItems, getKey);
  if (removedIndex !== null) return removeKeyedTrackerListItem(previousItems, latestItems, removedIndex, getKey);

  const appendedItem = getAppendedListItem(previousItems, nextItems, getKey);
  if (appendedItem) return appendTrackerListItem(latestItems, appendedItem);

  if (nextItems.length !== previousItems.length) return [...nextItems];

  return mergeTrackerListItemsByKey(previousItems, latestItems, nextItems, getKey, mergeItem);
}

function mergeQuestProgressUpdate(
  previous: QuestProgress | undefined,
  latest: QuestProgress | undefined,
  next: QuestProgress,
): QuestProgress {
  const merged = mergeChangedTrackerFields(previous, latest, next);
  if (!previous) return merged;

  if (!Object.is(previous.objectives, next.objectives)) {
    merged.objectives = mergeTrackerListUpdate(
      previous.objectives ?? [],
      latest?.objectives ?? [],
      next.objectives ?? [],
      mergeChangedTrackerFields,
      questObjectiveKey,
    );
  }

  return merged;
}

export function mergePresentCharacterListItemUpdate(
  previousItems: readonly PresentCharacter[],
  latestItems: readonly PresentCharacter[],
  index: number,
  nextItem: PresentCharacter,
): PresentCharacter[] {
  return mergeKeyedTrackerListItemUpdate(
    previousItems,
    latestItems,
    index,
    nextItem,
    (character) => character?.characterId,
    mergePresentCharacterUpdate,
  );
}

export function mergePresentCharacterListUpdate(
  previousItems: readonly PresentCharacter[],
  latestItems: readonly PresentCharacter[],
  nextItems: readonly PresentCharacter[],
): PresentCharacter[] {
  return mergeKeyedTrackerListUpdate(
    previousItems,
    latestItems,
    nextItems,
    (character) => character?.characterId,
    mergePresentCharacterUpdate,
  );
}

export function mergeQuestProgressListItemUpdate(
  previousItems: readonly QuestProgress[],
  latestItems: readonly QuestProgress[],
  index: number,
  nextItem: QuestProgress,
): QuestProgress[] {
  return mergeKeyedTrackerListItemUpdate(
    previousItems,
    latestItems,
    index,
    nextItem,
    (quest) => quest?.questEntryId,
    mergeQuestProgressUpdate,
  );
}

export function mergeQuestProgressListUpdate(
  previousItems: readonly QuestProgress[],
  latestItems: readonly QuestProgress[],
  nextItems: readonly QuestProgress[],
): QuestProgress[] {
  return mergeKeyedTrackerListUpdate(
    previousItems,
    latestItems,
    nextItems,
    (quest) => quest?.questEntryId,
    mergeQuestProgressUpdate,
  );
}

export function removePresentCharacterListItem(
  previousItems: readonly PresentCharacter[],
  latestItems: readonly PresentCharacter[],
  index: number,
): PresentCharacter[] {
  return removeKeyedTrackerListItem(previousItems, latestItems, index, (character) => character?.characterId);
}

export function removeQuestProgressListItem(
  previousItems: readonly QuestProgress[],
  latestItems: readonly QuestProgress[],
  index: number,
): QuestProgress[] {
  return removeKeyedTrackerListItem(previousItems, latestItems, index, (quest) => quest?.questEntryId);
}

export function createManualPresentCharacter(options: Partial<PresentCharacter> = {}): PresentCharacter {
  return {
    characterId: options.characterId ?? makeManualTrackerId(),
    name: options.name ?? "New Character",
    emoji: options.emoji ?? "?",
    mood: options.mood ?? "",
    appearance: options.appearance ?? null,
    outfit: options.outfit ?? null,
    avatarPath: options.avatarPath,
    portraitFocusX: options.portraitFocusX,
    portraitFocusY: options.portraitFocusY,
    portraitZoom: options.portraitZoom,
    customFields: options.customFields ?? {},
    stats: options.stats ?? [],
    thoughts: options.thoughts ?? null,
  };
}

export function createManualInventoryItem(options: Partial<InventoryItem> = {}): InventoryItem {
  return {
    name: options.name ?? "New Item",
    description: options.description ?? "",
    quantity: options.quantity ?? 1,
    location: options.location ?? "on_person",
  };
}

function createManualQuestObjective(options: Partial<QuestProgress["objectives"][number]> = {}) {
  return {
    text: options.text ?? "New objective",
    completed: options.completed ?? false,
  };
}

export function createManualQuest(options: Partial<QuestProgress> = {}): QuestProgress {
  return {
    questEntryId: options.questEntryId ?? makeManualTrackerId(),
    name: options.name ?? "New Quest",
    currentStage: options.currentStage ?? 0,
    objectives: options.objectives ?? [createManualQuestObjective({ text: "Objective 1" })],
    completed: options.completed ?? false,
  };
}

export function createManualCustomTrackerField(
  options: Partial<CustomTrackerField> = {},
): CustomTrackerField {
  return {
    name: options.name ?? "New Field",
    value: options.value ?? "",
  };
}

export function createManualCharacterStat(options: Partial<CharacterStat> = {}): CharacterStat {
  return {
    name: options.name ?? "New Stat",
    value: options.value ?? 0,
    max: options.max ?? 100,
    color: options.color ?? "var(--primary)",
  };
}

export function addPresentCharacterStat(
  character: PresentCharacter,
  stat = createManualCharacterStat(),
): PresentCharacter {
  return {
    ...character,
    stats: appendTrackerListItem(character.stats ?? [], stat),
  };
}

export function updatePresentCharacterCustomField(
  character: PresentCharacter,
  oldName: string,
  nextName: string,
  nextValue: string,
): PresentCharacter | null {
  const nextFields = { ...(character.customFields ?? {}) };
  const trimmedName = nextName.trim();
  if (trimmedName && trimmedName !== oldName && Object.prototype.hasOwnProperty.call(nextFields, trimmedName)) {
    return null;
  }
  delete nextFields[oldName];
  if (trimmedName) nextFields[trimmedName] = nextValue;
  return { ...character, customFields: nextFields };
}

export function addQuestObjective(
  quest: QuestProgress,
  objective = createManualQuestObjective(),
): QuestProgress {
  return {
    ...quest,
    objectives: appendTrackerListItem(quest.objectives, objective),
  };
}

function replaceQuestObjective(
  quest: QuestProgress,
  index: number,
  objective: QuestProgress["objectives"][number],
): QuestProgress {
  return {
    ...quest,
    objectives: replaceTrackerListItem(quest.objectives, index, objective),
  };
}

export function removeQuestObjective(quest: QuestProgress, index: number): QuestProgress {
  return {
    ...quest,
    objectives: removeTrackerListItem(quest.objectives, index),
  };
}

export function updateQuestObjectiveText(quest: QuestProgress, index: number, text: string): QuestProgress {
  const objective = quest.objectives[index];
  if (!objective) return quest;
  return replaceQuestObjective(quest, index, { ...objective, text });
}

export function toggleQuestObjectiveCompletion(quest: QuestProgress, index: number): QuestProgress {
  const objective = quest.objectives[index];
  if (!objective) return quest;
  return replaceQuestObjective(quest, index, { ...objective, completed: !objective.completed });
}
