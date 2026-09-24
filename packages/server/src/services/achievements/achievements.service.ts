import type {
  AchievementDefinition,
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
import {
  capabilityAchievementDefinitions,
  readCapabilityAchievementProgress,
} from "../capability-packages/capability-achievement-registry.service.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
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
  return mode === "roleplay";
}

/** The Engine's catalog plus whatever the active packages contribute, in that order. */
function allDefinitions(): AchievementDefinition[] {
  return [...ACHIEVEMENT_DEFINITIONS, ...capabilityAchievementDefinitions()];
}

function definitionById(id: string): AchievementDefinition | null {
  return (
    ACHIEVEMENT_DEFINITION_BY_ID.get(id) ?? capabilityAchievementDefinitions().find((item) => item.id === id) ?? null
  );
}

function buildProgress(
  definition: AchievementDefinition,
  unlockedRow: AchievementUnlockRow | null,
  counts: AchievementCounts,
  packageProgress: Map<string, number>,
): AchievementProgress {
  const target = definition.target ?? null;
  const progress = definition.metric
    ? (counts[definition.metric] ?? 0)
    : (packageProgress.get(definition.id) ?? (unlockedRow ? 1 : 0));

  return {
    id: definition.id,
    unlocked: !!unlockedRow,
    unlockedAt: unlockedRow?.unlockedAt ?? null,
    progress,
    target,
  };
}

/** Every ranked badge whose count has reached its target — Engine metrics and package counters
 *  alike, so a package's badge unlocks on the same pass the Engine's do. */
function collectMetricUnlockIds(counts: AchievementCounts, packageProgress: Map<string, number>) {
  return allDefinitions().flatMap((definition) => {
    if (!definition.target) return [];
    const value = definition.metric ? counts[definition.metric] : packageProgress.get(definition.id);
    return value !== undefined && value >= definition.target ? [definition.id] : [];
  });
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

  async function unlockIds(
    ids: Iterable<string>,
    counts: AchievementCounts,
    packageProgress: Map<string, number>,
  ): Promise<AchievementProgress[]> {
    const uniqueIds = [...new Set(ids)].filter((id) => !!definitionById(id));
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
        if (!isFileUniqueConstraintError(error, "achievement_unlocks", ["id"])) throw error;
      }
    }

    return newlyUnlockedRows.flatMap((row) => {
      const definition = definitionById(row.id);
      return definition ? [buildProgress(definition, row, counts, packageProgress)] : [];
    });
  }

  async function status(): Promise<AchievementStatusResponse> {
    const [counts, packageProgress] = await Promise.all([readCounts(), readCapabilityAchievementProgress()]);
    await unlockIds(collectMetricUnlockIds(counts, packageProgress), counts, packageProgress);
    const unlockedRows = await readUnlockRows();
    const unlockedById = new Map(unlockedRows.map((row) => [row.id, row]));
    const definitions = allDefinitions();
    const progress = definitions.map((definition) =>
      buildProgress(definition, unlockedById.get(definition.id) ?? null, counts, packageProgress),
    );

    return {
      definitions,
      progress,
      unlockedCount: progress.filter((item) => item.unlocked).length,
      totalCount: definitions.length,
    };
  }

  async function track(event: AchievementEvent): Promise<AchievementTrackResponse> {
    const [counts, packageProgress] = await Promise.all([readCounts(), readCapabilityAchievementProgress()]);
    const ids = new Set<string>(collectMetricUnlockIds(counts, packageProgress));
    const directId = ACHIEVEMENT_DIRECT_EVENT_IDS[event];
    if (directId) ids.add(directId);

    return {
      newlyUnlocked: await unlockIds(ids, counts, packageProgress),
    };
  }

  /** Unlocks one badge by id, for a package marking its own achievement fulfilled. Resolves true
   *  only for the call that unlocked it, so a package can react exactly once. */
  async function unlock(id: string): Promise<boolean> {
    // Only whether a row was inserted matters here, so no counts or progress callbacks are read.
    const unlocked = await unlockIds([id], ZERO_COUNTS, new Map());
    return unlocked.length > 0;
  }

  async function isUnlocked(id: string): Promise<boolean> {
    return (await readUnlockRows()).some((row) => row.id === id);
  }

  /** Definitions and progress for one package's own badges. */
  async function listForPackage(packageId: string): Promise<AchievementProgress[]> {
    // Package badges have no Engine metric, so Engine counts are never read for them.
    const packageProgress = await readCapabilityAchievementProgress(packageId);
    const unlockedById = new Map((await readUnlockRows()).map((row) => [row.id, row]));
    return capabilityAchievementDefinitions(packageId).map((definition) =>
      buildProgress(definition, unlockedById.get(definition.id) ?? null, ZERO_COUNTS, packageProgress),
    );
  }

  return { status, track, unlock, isUnlocked, listForPackage };
}
