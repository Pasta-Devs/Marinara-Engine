// Tracker results that patch the player stats on the message's game-state snapshot: persona stats, inventory, custom
// tracker fields and quests. The Character Tracker has its own file (character-tracker.ts).
import {
  applyQuestUpdatesToPlayerStats,
  buildQuestJournalData,
  isTrackerRowsUpdate,
  normalizeTrackerFieldLocksForState,
  trackerFieldLocksAreEmpty,
  type AgentResult,
} from "@marinara-engine/shared";
import { and, eq } from "../../../db/file-query.js";
import { gameStateSnapshots as gameStateSnapshotsTable } from "../../../db/schema/index.js";
import { logger } from "../../../lib/logger.js";
import {
  buildLockedInventoryTrackerPatch,
  buildLockedPersonaTrackerPatch,
  buildLockedPlayerStatsArrayPatch,
  findInventoryTrackerAcquisitions,
  parseGameStateRow,
  parseSnapshotPlayerStats,
  resolveTrackerGroupUpdate,
} from "../../../routes/generate/generate-route-utils.js";
import { addInventoryEntry, upsertQuest } from "../../game/journal.service.js";
import { updateJournal } from "../game-journal-runtime.js";
import type { AgentResultEffectDeps, TrackerSnapshotRow } from "./types.js";

/** The lock state stored next to a tracker write, migrated to the current shape (null when nothing is locked). */
function serializeMigratedTrackerLocks(state: ReturnType<typeof parseGameStateRow> | null): string | null {
  const locks = normalizeTrackerFieldLocksForState(state?.fieldLocks, state);
  return trackerFieldLocksAreEmpty(locks) ? null : JSON.stringify(locks);
}

function lockStateOf(snapshot: TrackerSnapshotRow | null) {
  return snapshot ? parseGameStateRow(snapshot) : null;
}

async function loadSnapshot(deps: AgentResultEffectDeps): Promise<TrackerSnapshotRow | null> {
  deps.signal?.throwIfAborted();
  const snapshot = await deps.trackers.loadSnapshot();
  deps.signal?.throwIfAborted();
  return snapshot;
}

async function writeSnapshot(
  deps: AgentResultEffectDeps,
  snapshot: TrackerSnapshotRow,
  fields: Record<string, unknown>,
): Promise<void> {
  deps.signal?.throwIfAborted();
  await deps.trackers.db
    .update(gameStateSnapshotsTable)
    .set(fields)
    .where(and(eq(gameStateSnapshotsTable.chatId, deps.chatId), eq(gameStateSnapshotsTable.id, snapshot.id)));
  deps.signal?.throwIfAborted();
}

function emitPatch(deps: AgentResultEffectDeps, patch: Record<string, unknown>): void {
  deps.signal?.throwIfAborted();
  deps.trackers.emitGameStatePatch(patch);
}

async function writeJournal(deps: AgentResultEffectDeps, transform: Parameters<typeof updateJournal>[2]) {
  deps.signal?.throwIfAborted();
  await updateJournal(deps.trackers.db, deps.chatId, transform);
  deps.signal?.throwIfAborted();
}

function logFailure(err: unknown, deps: AgentResultEffectDeps, what: string, level: "error" | "warn" = "error") {
  deps.signal?.throwIfAborted();
  logger[level](
    err,
    "[agent-effects] Failed to apply %s origin=%s chatId=%s messageId=%s swipeIndex=%d",
    what,
    deps.origin,
    deps.chatId,
    deps.messageId,
    deps.swipeIndex,
  );
}

/** Persona Stats agent: the persona's stat bars and status line. */
export async function applyPersonaStatsResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (!deps.trackers.canEditTrackers(result)) return;
  try {
    const data = result.data as Record<string, unknown>;
    const hasStats = Array.isArray(data.stats);
    const hasStatus = typeof data.status === "string";
    const snapshot = await loadSnapshot(deps);
    const lockState = lockStateOf(snapshot);
    const personaPatch = buildLockedPersonaTrackerPatch({
      stats: hasStats ? (data.stats as any[]) : [],
      status: hasStatus ? (data.status as string) : "",
      hasStats,
      hasStatus,
      snapshot,
      lockState,
    });
    if (snapshot && Object.keys(personaPatch.updates).length > 0) {
      await writeSnapshot(deps, snapshot, {
        ...personaPatch.updates,
        fieldLocks: serializeMigratedTrackerLocks(lockState),
      });
    }
    if (personaPatch.changed) {
      logger.debug("[game_state_patch] persona-stats origin=%s: %j", deps.origin, personaPatch.patch);
      emitPatch(deps, personaPatch.patch);
    }
  } catch (err) {
    logFailure(err, deps, "persona-stats tracker update");
  }
}

/** Inventory Tracker agent: full item lists or item changes; newly acquired items go into the journal. */
export async function applyInventoryTrackerResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (!deps.trackers.canEditTrackers(result)) return;
  try {
    const snapshot = await loadSnapshot(deps);
    const lockState = lockStateOf(snapshot);
    const previousPlayerStats = parseSnapshotPlayerStats(snapshot);
    const inventoryPatch = buildLockedInventoryTrackerPatch({
      data: result.data as Record<string, unknown>,
      snapshot,
      lockState,
    });
    if (!inventoryPatch.changed) return;
    if (snapshot) {
      await writeSnapshot(deps, snapshot, {
        playerStats: JSON.stringify(inventoryPatch.playerStats),
        fieldLocks: serializeMigratedTrackerLocks(lockState),
      });
    }
    // Sent before the journal write, so a cancelled retry still shows what it already saved.
    logger.debug("[game_state_patch] inventory-tracker origin=%s: %j", deps.origin, inventoryPatch.values);
    emitPatch(deps, inventoryPatch.patch);
    // Compared against this snapshot, so re-running the agent on the same reply logs only items it didn't have yet.
    const acquisitions = findInventoryTrackerAcquisitions(previousPlayerStats, inventoryPatch.playerStats);
    if (acquisitions.length > 0) {
      await writeJournal(deps, (journal) =>
        acquisitions.reduce(
          (nextJournal, item) => addInventoryEntry(nextJournal, item.name, "acquired", item.quantity),
          journal,
        ),
      );
    }
  } catch (err) {
    logFailure(err, deps, "inventory tracker update");
  }
}

/** Custom Tracker agent: the user-defined tracker fields. */
export async function applyCustomTrackerResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (!deps.trackers.canEditTrackers(result)) return;
  try {
    const data = result.data as Record<string, unknown>;
    if (!Array.isArray(data.fields) && !isTrackerRowsUpdate(data.fields)) return;
    const snapshot = await loadSnapshot(deps);
    const lockState = lockStateOf(snapshot);
    const fields =
      resolveTrackerGroupUpdate(
        data.fields,
        parseSnapshotPlayerStats(snapshot).customTrackerFields ?? [],
        lockState,
        "customTrackerFields",
      ) ?? [];
    const customPatch = buildLockedPlayerStatsArrayPatch<any>({
      field: "customTrackerFields",
      values: fields,
      snapshot,
      lockState,
    });
    if (!customPatch.changed) return;
    if (snapshot) {
      await writeSnapshot(deps, snapshot, {
        playerStats: JSON.stringify(customPatch.playerStats),
        fieldLocks: serializeMigratedTrackerLocks(lockState),
      });
    }
    logger.debug("[game_state_patch] custom-tracker origin=%s: %j", deps.origin, customPatch.values);
    emitPatch(deps, customPatch.patch);
  } catch (err) {
    logFailure(err, deps, "custom tracker update");
  }
}

/** Quest Tracker agent: quest updates merged into the active quests, mirrored into the journal. */
export async function applyQuestResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (!deps.trackers.canEditTrackers(result)) return;
  try {
    const data = result.data as Record<string, unknown>;
    const updates = Array.isArray(data.updates) ? data.updates : [];
    logger.debug(
      "[agent-effects] Quest agent result origin=%s updates=%d keys=%s %s",
      deps.origin,
      updates.length,
      Object.keys(data).join(","),
      JSON.stringify(data).slice(0, 500),
    );
    if (updates.length === 0) return;
    const snapshot = await loadSnapshot(deps);
    const questMerge = applyQuestUpdatesToPlayerStats(parseSnapshotPlayerStats(snapshot), updates, {
      autoRemoveFullyCompleted: true,
    });
    const lockState = lockStateOf(snapshot);
    const questPatch = buildLockedPlayerStatsArrayPatch<any>({
      field: "activeQuests",
      values: questMerge.quests,
      snapshot,
      lockState,
      basePlayerStats: questMerge.playerStats,
    });
    if (!questMerge.changed || !questPatch.changed) return;
    if (snapshot) {
      await writeSnapshot(deps, snapshot, {
        playerStats: JSON.stringify(questPatch.playerStats),
        fieldLocks: serializeMigratedTrackerLocks(lockState),
      });
    }
    logger.debug("[game_state_patch] quests origin=%s: %j", deps.origin, questPatch.values);
    emitPatch(deps, questPatch.patch);
    // `upsertQuest` keys on the quest id, so running this again for the same reply updates the entry, not a copy.
    for (const update of questMerge.updates) {
      const questData = buildQuestJournalData(update);
      await writeJournal(deps, (journal) => upsertQuest(journal, questData));
    }
  } catch (err) {
    logFailure(err, deps, "quest tracker update", "warn");
  }
}
