import type {
  AchievementEvent,
  AchievementMetric,
  AchievementProgress,
  AchievementStatusResponse,
  AchievementTrackResponse,
} from "@marinara-engine/shared";
import {
  ACHIEVEMENT_DEFINITION_BY_ID,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_DIRECT_EVENT_IDS,
  PROFESSOR_MARI_ID,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { achievementUnlocks, characters, chats, lorebooks, personas } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

type AchievementUnlockRow = typeof achievementUnlocks.$inferSelect;

type AchievementCounts = Record<AchievementMetric, number>;

const ZERO_COUNTS: AchievementCounts = {
  conversationChats: 0,
  roleplayChats: 0,
  gameChats: 0,
  characters: 0,
  lorebooks: 0,
  personas: 0,
};

function isRoleplayMode(mode: string) {
  return mode === "roleplay" || mode === "visual_novel";
}

function buildProgress(
  id: string,
  unlockedRow: AchievementUnlockRow | null,
  counts: AchievementCounts,
): AchievementProgress | null {
  const definition = ACHIEVEMENT_DEFINITION_BY_ID.get(id);
  if (!definition) return null;

  const target = definition.target ?? null;
  const progress = definition.metric ? counts[definition.metric] ?? 0 : unlockedRow ? 1 : 0;

  return {
    id,
    unlocked: !!unlockedRow,
    unlockedAt: unlockedRow?.unlockedAt ?? null,
    progress,
    target,
  };
}

function collectMetricUnlockIds(counts: AchievementCounts) {
  return ACHIEVEMENT_DEFINITIONS.flatMap((definition) => {
    if (!definition.metric || !definition.target) return [];
    return counts[definition.metric] >= definition.target ? [definition.id] : [];
  });
}

function isDuplicateUnlockError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeCode = (error as { code?: unknown }).code;
  const code = typeof maybeCode === "string" ? maybeCode.toUpperCase() : "";
  const message = error.message.toLowerCase();
  return (
    code === "23505" ||
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    message.includes("duplicate key value violates unique constraint") ||
    message.includes("duplicate primary key") ||
    (message.includes("unique") && message.includes("achievement_unlocks"))
  );
}

export function createAchievementsService(db: DB) {
  async function readUnlockRows() {
    return (await db.select().from(achievementUnlocks)) as AchievementUnlockRow[];
  }

  async function readCounts(): Promise<AchievementCounts> {
    const [chatRows, characterRows, lorebookRows, personaRows] = await Promise.all([
      db.select().from(chats),
      db.select().from(characters),
      db.select().from(lorebooks),
      db.select().from(personas),
    ]);

    return {
      ...ZERO_COUNTS,
      conversationChats: chatRows.filter((chat) => chat.mode === "conversation").length,
      roleplayChats: chatRows.filter((chat) => isRoleplayMode(chat.mode)).length,
      gameChats: chatRows.filter((chat) => chat.mode === "game").length,
      characters: characterRows.filter((character) => character.id !== PROFESSOR_MARI_ID).length,
      lorebooks: lorebookRows.length,
      personas: personaRows.length,
    };
  }

  async function unlockIds(ids: Iterable<string>, counts: AchievementCounts): Promise<AchievementProgress[]> {
    const uniqueIds = [...new Set(ids)].filter((id) => ACHIEVEMENT_DEFINITION_BY_ID.has(id));
    if (uniqueIds.length === 0) return [];

    const existing = await readUnlockRows();
    const existingById = new Map(existing.map((row) => [row.id, row]));
    const timestamp = now();
    const newlyUnlockedRows: AchievementUnlockRow[] = [];

    for (const id of uniqueIds) {
      if (existingById.has(id)) continue;
      const row = { id, unlockedAt: timestamp, updatedAt: timestamp };
      try {
        await db.insert(achievementUnlocks).values(row);
        newlyUnlockedRows.push(row);
      } catch (error) {
        if (!isDuplicateUnlockError(error)) throw error;
      }
    }

    return newlyUnlockedRows
      .map((row) => buildProgress(row.id, row, counts))
      .filter((progress): progress is AchievementProgress => !!progress);
  }

  async function status(): Promise<AchievementStatusResponse> {
    const counts = await readCounts();
    await unlockIds(collectMetricUnlockIds(counts), counts);
    const unlockedRows = await readUnlockRows();
    const unlockedById = new Map(unlockedRows.map((row) => [row.id, row]));
    const progress = ACHIEVEMENT_DEFINITIONS.map((definition) =>
      buildProgress(definition.id, unlockedById.get(definition.id) ?? null, counts),
    ).filter((item): item is AchievementProgress => !!item);

    return {
      definitions: ACHIEVEMENT_DEFINITIONS,
      progress,
      unlockedCount: progress.filter((item) => item.unlocked).length,
      totalCount: ACHIEVEMENT_DEFINITIONS.length,
    };
  }

  async function track(event: AchievementEvent): Promise<AchievementTrackResponse> {
    const counts = await readCounts();
    const ids = new Set<string>(collectMetricUnlockIds(counts));
    const directId = ACHIEVEMENT_DIRECT_EVENT_IDS[event];
    if (directId) ids.add(directId);

    return {
      newlyUnlocked: await unlockIds(ids, counts),
    };
  }

  return { status, track };
}
