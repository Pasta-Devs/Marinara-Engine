import type {
  CharacterStat,
  CustomTrackerField,
  InventoryItem,
  PlayerStats,
  QuestProgress,
  RPGAttributes,
} from "../../contracts/types/game-state";
import { boolish, isRecord, parseRecord, readNonNegativeInteger, readNumber, readString } from "../../generation/runtime-records";

export type QuestObjective = QuestProgress["objectives"][number];
export type QuestUpdateAction = "create" | "update" | "complete" | "fail";

export interface NormalizedQuestUpdate {
  action: QuestUpdateAction;
  questName: string;
  objectives?: QuestObjective[];
}

type RpgAttributeKey = keyof RPGAttributes;

const RPG_ATTRIBUTE_KEYS: RpgAttributeKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Keys that wrap a nested collection of quests rather than a single quest. When an
 * `activeQuests` value is a record carrying one of these, recurse into it instead of
 * trying to read the wrapper itself as a quest.
 */
const NESTED_QUEST_KEYS = ["quests", "activeQuests", "groups", "items", "children"] as const;

export function parseQuestObjective(value: unknown): { text: string; completed: boolean } | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { text, completed: false } : null;
  }
  const record = parseRecord(value);
  const text = firstString(record.text, record.description, record.objective, record.name, record.title);
  if (!text) return null;
  const status = readString(record.status ?? record.done).trim().toLowerCase();
  return { text, completed: boolish(record.completed, status === "complete" || status === "completed" || status === "done") };
}

export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = readString(value).trim();
    if (text) return text;
  }
  return undefined;
}

export function parseQuest(value: unknown, fallbackName?: string): QuestProgress | null {
  const record = parseRecord(value);
  const name = readString(record.name).trim() || readString(record.questName).trim() || readString(fallbackName).trim();
  if (!name) return null;
  const questEntryId = readString(record.questEntryId).trim() || name;
  const objectives = Array.isArray(record.objectives)
    ? record.objectives.map(parseQuestObjective).filter((objective): objective is { text: string; completed: boolean } => !!objective)
    : [];
  return {
    questEntryId,
    name,
    currentStage: Math.max(0, readNonNegativeInteger(record.currentStage, 0)),
    objectives,
    completed: boolish(record.completed, false),
  };
}

/**
 * Normalize an arbitrary `activeQuests` value into a flat `QuestProgress[]`.
 *
 * Restores legacy tolerance for non-array shapes that some imported saves and older
 * agents produce: plain arrays, keyed quest maps (`{ questId: quest }`), grouped
 * containers (`{ quests: [...] }`, `{ groups: [...] }`), and nested collections.
 */
export function normalizeActiveQuestCollection(value: unknown, depth = 0): QuestProgress[] {
  if (value == null || depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeActiveQuestCollection(entry, depth + 1));
  }
  if (!isRecord(value)) return [];

  for (const key of NESTED_QUEST_KEYS) {
    if (value[key] !== undefined) {
      return normalizeActiveQuestCollection(value[key], depth + 1);
    }
  }

  const single = parseQuest(value);
  if (single) return [single];

  return Object.entries(value).flatMap(([key, entry]) => {
    const quest = parseQuest(entry, key);
    return quest ? [quest] : normalizeActiveQuestCollection(entry, depth + 1);
  });
}

export function parseStat(value: unknown): CharacterStat | null {
  const record = parseRecord(value);
  const name = readString(record.name).trim();
  if (!name) return null;
  const max = Math.max(1, readNumber(record.max, 100));
  const valueNumber = Math.min(max, Math.max(0, readNumber(record.value, max)));
  const color = readString(record.color).trim() || "#8b5cf6";
  return { name, value: valueNumber, max, color };
}

export function parseInventoryItem(value: unknown): InventoryItem | null {
  const record = parseRecord(value);
  const name = readString(record.name).trim();
  if (!name) return null;
  return {
    name,
    description: readString(record.description).trim(),
    quantity: Math.max(0, readNumber(record.quantity, 1)),
    location: readString(record.location).trim() || "on_person",
  };
}

export function parseCustomTrackerField(value: unknown): CustomTrackerField | null {
  const record = parseRecord(value);
  const name = readString(record.name).trim();
  if (!name) return null;
  return { name, value: readString(record.value).trim() };
}

function parseRpgAttributes(value: unknown): RPGAttributes | null {
  const record = parseRecord(value);
  if (!RPG_ATTRIBUTE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(record, key))) return null;
  return {
    str: readNumber(record.str, 10),
    dex: readNumber(record.dex, 10),
    con: readNumber(record.con, 10),
    int: readNumber(record.int, 10),
    wis: readNumber(record.wis, 10),
    cha: readNumber(record.cha, 10),
  };
}

function parseSkills(value: unknown): Record<string, number> {
  const record = parseRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, skillValue]) => [key.trim(), readNumber(skillValue, Number.NaN)] as const)
      .filter(([key, skillValue]) => key.length > 0 && Number.isFinite(skillValue)),
  );
}

export function clonePlayerStats(value: unknown): PlayerStats {
  const record = parseRecord(value);
  return {
    stats: Array.isArray(record.stats) ? record.stats.map(parseStat).filter((stat): stat is CharacterStat => !!stat) : [],
    attributes: parseRpgAttributes(record.attributes),
    skills: parseSkills(record.skills),
    inventory: Array.isArray(record.inventory)
      ? record.inventory.map(parseInventoryItem).filter((item): item is InventoryItem => !!item)
      : [],
    activeQuests: normalizeActiveQuestCollection(record.activeQuests),
    customTrackerFields: Array.isArray(record.customTrackerFields)
      ? record.customTrackerFields
          .map(parseCustomTrackerField)
          .filter((field): field is CustomTrackerField => !!field)
      : undefined,
    status: readString(record.status),
  };
}

export function normalizeQuestAction(value: unknown): QuestUpdateAction | null {
  const normalized = readString(value).trim().toLowerCase();
  if (normalized === "completed") return "complete";
  if (normalized === "failed") return "fail";
  return normalized === "create" || normalized === "update" || normalized === "complete" || normalized === "fail"
    ? normalized
    : null;
}

export function collectQuestObjectives(value: unknown, depth = 0): QuestObjective[] {
  if (value == null || depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => collectQuestObjectives(entry, depth + 1));
  const direct = parseQuestObjective(value);
  if (direct) return [direct];
  const record = parseRecord(value);
  if (!Object.keys(record).length) return [];
  for (const key of ["objectives", "tasks", "steps", "items", "subtasks", "children", "goals"]) {
    if (record[key] === undefined) continue;
    const nested = collectQuestObjectives(record[key], depth + 1);
    if (nested.length) return nested;
  }
  return Object.values(record).flatMap((entry) => collectQuestObjectives(entry, depth + 1));
}

export function normalizeQuestUpdate(value: unknown): NormalizedQuestUpdate | null {
  const record = parseRecord(value);
  const action = normalizeQuestAction(record.action);
  const questName = firstString(record.questName, record.name, record.title, record.questEntryId);
  if (!action || !questName) return null;
  const objectives = record.objectives === undefined ? undefined : collectQuestObjectives(record.objectives);
  return {
    action,
    questName,
    ...(objectives !== undefined ? { objectives } : {}),
  };
}

export function cloneQuest(quest: QuestProgress): QuestProgress {
  return {
    ...quest,
    objectives: quest.objectives.map((objective) => ({ ...objective })),
  };
}

export function applyQuestUpdatesToPlayerStats(
  value: unknown,
  updatesValue: unknown,
): { playerStats: PlayerStats; changed: boolean } {
  const updates = Array.isArray(updatesValue)
    ? updatesValue.map(normalizeQuestUpdate).filter((update): update is NormalizedQuestUpdate => !!update)
    : [];
  const playerStats = clonePlayerStats(value);
  const rawActiveQuestsJson = JSON.stringify(playerStats.activeQuests);
  const quests = playerStats.activeQuests.map(cloneQuest);

  for (const update of updates) {
    let index = quests.findIndex((quest) => quest.questEntryId === update.questName);
    if (index === -1) {
      index = quests.findIndex((quest) => quest.name === update.questName);
    }
    if (update.action === "create" && index === -1) {
      quests.push({
        questEntryId: update.questName,
        name: update.questName,
        currentStage: 0,
        objectives: update.objectives ?? [],
        completed: false,
      });
    } else if (index !== -1) {
      if (update.action === "update") {
        if (update.objectives !== undefined) quests[index]!.objectives = update.objectives;
      } else if (update.action === "complete") {
        quests[index]!.completed = true;
        if (update.objectives !== undefined) quests[index]!.objectives = update.objectives;
      } else if (update.action === "fail") {
        quests.splice(index, 1);
      }
    }
  }

  for (let index = quests.length - 1; index >= 0; index -= 1) {
    const quest = quests[index]!;
    if (quest.completed && (quest.objectives.length === 0 || quest.objectives.every((objective) => objective.completed))) {
      quests.splice(index, 1);
    }
  }

  playerStats.activeQuests = quests;
  return { playerStats, changed: JSON.stringify(quests) !== rawActiveQuestsJson };
}
