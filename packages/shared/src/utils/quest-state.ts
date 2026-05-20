import type { PlayerStats, QuestProgress } from "../types/game-state.js";

type QuestObjective = QuestProgress["objectives"][number];

export type QuestUpdateAction = "create" | "update" | "complete" | "fail";

export interface NormalizedQuestUpdate {
  action: QuestUpdateAction;
  questName: string;
  description?: string;
  objectives?: QuestObjective[];
  rewards?: string[];
  notes?: string;
}

export interface QuestMergeResult {
  updates: NormalizedQuestUpdate[];
  originalQuests: QuestProgress[];
  quests: QuestProgress[];
  playerStats: PlayerStats & Record<string, unknown>;
  changed: boolean;
}

const DEFAULT_PLAYER_STATS: PlayerStats = {
  stats: [],
  attributes: null,
  skills: {},
  inventory: [],
  activeQuests: [],
  status: "",
};

const NESTED_OBJECTIVE_KEYS = ["objectives", "tasks", "steps", "items", "subtasks", "children", "goals"] as const;
const NESTED_QUEST_KEYS = ["quests", "activeQuests", "groups", "items", "children"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function normalizeQuestAction(value: unknown): QuestUpdateAction | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "completed") return "complete";
  if (normalized === "failed") return "fail";
  return normalized === "create" || normalized === "update" || normalized === "complete" || normalized === "fail"
    ? normalized
    : null;
}

function normalizeCompleted(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "complete" || normalized === "completed" || normalized === "done" || normalized === "true";
}

function normalizeObjective(value: unknown): QuestObjective | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { text, completed: false } : null;
  }
  if (!isRecord(value)) return null;

  const text = firstString(value.text, value.description, value.objective, value.name, value.title);
  if (!text) return null;
  return { text, completed: normalizeCompleted(value.completed ?? value.status ?? value.done) };
}

function collectNestedObjectives(value: Record<string, unknown>, depth: number): QuestObjective[] {
  const nested: QuestObjective[] = [];
  for (const key of NESTED_OBJECTIVE_KEYS) {
    if (value[key] === undefined) continue;
    nested.push(...collectObjectives(value[key], depth + 1));
  }
  return nested;
}

function collectObjectives(value: unknown, depth = 0): QuestObjective[] {
  if (value == null || depth > 5) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectObjectives(entry, depth + 1));
  }

  if (isRecord(value)) {
    const nested = collectNestedObjectives(value, depth);
    if (nested.length > 0) return nested;
  }

  const direct = normalizeObjective(value);
  if (direct) return [direct];

  if (!isRecord(value)) return [];
  return Object.values(value).flatMap((entry) => collectObjectives(entry, depth + 1));
}

function normalizeObjectives(value: unknown): QuestObjective[] | undefined {
  if (value === undefined || value === null) return undefined;
  return collectObjectives(value);
}

function cloneQuest(quest: QuestProgress): QuestProgress {
  return {
    ...quest,
    objectives: quest.objectives.map((objective) => ({ ...objective })),
  };
}

function hasQuestProgressFields(value: Record<string, unknown>): boolean {
  return (
    value.questEntryId !== undefined ||
    value.objectives !== undefined ||
    value.currentStage !== undefined ||
    value.completed !== undefined
  );
}

function normalizeQuestProgress(value: unknown, fallbackName?: string): QuestProgress | null {
  if (!isRecord(value)) return null;

  const explicitName = firstString(value.name, value.questName, value.title, value.questEntryId);
  const name = explicitName ?? (hasQuestProgressFields(value) ? firstString(fallbackName) : undefined);
  if (!name) return null;

  const rawStage = value.currentStage;
  const currentStage = typeof rawStage === "number" && Number.isFinite(rawStage) ? rawStage : 0;
  const questEntryId = firstString(value.questEntryId, value.id, name) ?? name;

  return {
    ...value,
    questEntryId,
    name,
    currentStage,
    objectives: normalizeObjectives(value.objectives) ?? [],
    completed: value.completed === true,
  } as QuestProgress;
}

function collectNestedQuests(value: Record<string, unknown>, depth: number): QuestProgress[] {
  const nested: QuestProgress[] = [];
  for (const key of NESTED_QUEST_KEYS) {
    if (value[key] === undefined) continue;
    nested.push(...normalizeQuestCollectionForQuestMerge(value[key], depth + 1));
  }
  return nested;
}

export function normalizeQuestCollectionForQuestMerge(value: unknown, depth = 0): QuestProgress[] {
  if (value == null || depth > 5) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeQuestCollectionForQuestMerge(entry, depth + 1));
  }

  if (!isRecord(value)) return [];

  const nested = collectNestedQuests(value, depth);
  if (nested.length > 0) return nested;

  const singleQuest = normalizeQuestProgress(value);
  if (singleQuest) return [singleQuest];

  return Object.entries(value).flatMap(([key, entry]) => {
    const keyedQuest = normalizeQuestProgress(entry, key);
    return keyedQuest ? [keyedQuest] : normalizeQuestCollectionForQuestMerge(entry, depth + 1);
  });
}

function normalizeQuestUpdate(value: unknown): NormalizedQuestUpdate | null {
  if (!isRecord(value)) return null;

  const action = normalizeQuestAction(value.action);
  const questName = firstString(value.questName, value.name, value.title, value.questEntryId);
  if (!action || !questName) return null;

  const objectives = normalizeObjectives(value.objectives);
  const rewards = Array.isArray(value.rewards)
    ? value.rewards.flatMap((reward) => {
        const text = firstString(reward);
        return text ? [text] : [];
      })
    : undefined;

  return {
    action,
    questName,
    description: firstString(value.description),
    ...(objectives !== undefined ? { objectives } : {}),
    ...(rewards !== undefined ? { rewards } : {}),
    notes: firstString(value.notes),
  };
}

export function normalizeQuestUpdates(value: unknown): NormalizedQuestUpdate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const update = normalizeQuestUpdate(entry);
    return update ? [update] : [];
  });
}

export function normalizePlayerStatsForQuestMerge(value: unknown): PlayerStats & Record<string, unknown> {
  const existing = isRecord(value) ? value : {};
  return {
    ...DEFAULT_PLAYER_STATS,
    ...existing,
    activeQuests: normalizeQuestCollectionForQuestMerge(existing.activeQuests),
  };
}

export function applyQuestUpdatesToPlayerStats(
  value: unknown,
  updatesValue: unknown,
  options: { autoRemoveFullyCompleted?: boolean } = {},
): QuestMergeResult {
  const updates = normalizeQuestUpdates(updatesValue);
  const rawActiveQuests = isRecord(value) ? value.activeQuests : undefined;
  const rawActiveQuestsJson = JSON.stringify(rawActiveQuests ?? []);
  const playerStats = normalizePlayerStatsForQuestMerge(value);
  const originalQuests = playerStats.activeQuests.map(cloneQuest);
  const quests = originalQuests.map(cloneQuest);

  for (const update of updates) {
    const idx = quests.findIndex((quest) => quest.name === update.questName || quest.questEntryId === update.questName);
    if (update.action === "create" && idx === -1) {
      quests.push({
        questEntryId: update.questName,
        name: update.questName,
        currentStage: 0,
        objectives: update.objectives ?? [],
        completed: false,
      });
    } else if (idx !== -1) {
      if (update.action === "update") {
        if (update.objectives !== undefined) quests[idx]!.objectives = update.objectives;
      } else if (update.action === "complete") {
        quests[idx]!.completed = true;
        if (update.objectives !== undefined) quests[idx]!.objectives = update.objectives;
      } else if (update.action === "fail") {
        quests.splice(idx, 1);
      }
    }
  }

  if (options.autoRemoveFullyCompleted === true) {
    for (let index = quests.length - 1; index >= 0; index--) {
      const quest = quests[index]!;
      if (
        quest.completed &&
        (quest.objectives.length === 0 || quest.objectives.every((objective) => objective.completed))
      ) {
        quests.splice(index, 1);
      }
    }
  }

  return {
    updates,
    originalQuests,
    quests,
    playerStats: { ...playerStats, activeQuests: quests },
    changed: JSON.stringify(quests) !== rawActiveQuestsJson,
  };
}

export function buildQuestJournalData(update: NormalizedQuestUpdate): {
  id: string;
  name: string;
  status: "active" | "completed" | "failed";
  description: string;
  objectives: string[];
} {
  return {
    id: update.questName,
    name: update.questName,
    status: update.action === "complete" ? "completed" : update.action === "fail" ? "failed" : "active",
    description: update.description || update.questName,
    objectives: (update.objectives ?? []).map((objective) => objective.text),
  };
}
