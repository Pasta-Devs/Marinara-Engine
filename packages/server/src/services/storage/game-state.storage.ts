// ──────────────────────────────────────────────
// Storage: Game State Snapshots
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import { eq, and, ne, asc, desc, inArray, lte } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameStateSnapshots } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { ensureTimestampAfter } from "../import/import-timestamps.js";
import {
  coerceGameStateTextValue,
  applyTrackerFieldLocksToGameStatePatch,
  normalizeWorldCustomFields,
  normalizeTrackerFieldLocks,
  normalizeTrackerFieldLocksForState,
  normalizeTrackerHiddenFields,
  parseTrackerFieldLocks,
  parseTrackerHiddenFields,
  rulesetLiveStatesSchema,
  trackerFieldLocksAreEmpty,
  trackerHiddenFieldsAreEmpty,
  type GameState,
  type RulesetLiveStates,
  type TrackerFieldLocks,
  type TrackerHiddenFields,
} from "@marinara-engine/shared";

export type GameStateVisibleAnchor = { messageId: string; swipeIndex: number };

const MANUAL_OVERRIDE_FIELDS = ["date", "time", "location", "weather", "temperature"] as const;
/** Tracker values whose Tracker Panel edits are recorded as a fingerprint, so the record stays small. */
const MANUAL_EDIT_JSON_FIELDS = ["worldCustomFields", "presentCharacters", "personaStats"] as const;
/** playerStats holds several trackers, so its edits are recorded per key (`playerStats.activeQuests`). */
const PLAYER_STATS_EDIT_PREFIX = "playerStats.";

type GameStateRow = typeof gameStateSnapshots.$inferSelect;
type ManualEditSource = Partial<Record<string, unknown>>;

type GameStateUpdateFields = Partial<
  Pick<
    GameState,
    | "date"
    | "time"
    | "location"
    | "weather"
    | "temperature"
    | "worldCustomFields"
    | "presentCharacters"
    | "playerStats"
    | "personaStats"
    | "fieldLocks"
    | "hiddenTrackerFields"
    | "rulesetLive"
  >
>;

type LockMigrationStateSource = {
  id?: unknown;
  chatId?: unknown;
  messageId?: unknown;
  swipeIndex?: unknown;
  date?: unknown;
  time?: unknown;
  location?: unknown;
  weather?: unknown;
  temperature?: unknown;
  worldCustomFields?: unknown;
  presentCharacters?: unknown;
  recentEvents?: unknown;
  playerStats?: unknown;
  personaStats?: unknown;
  fieldLocks?: unknown;
  hiddenTrackerFields?: unknown;
  createdAt?: unknown;
};

function coerceSnapshotTextFields(fields: Partial<Pick<GameState, (typeof MANUAL_OVERRIDE_FIELDS)[number]>>) {
  return {
    date: coerceGameStateTextValue(fields.date),
    time: coerceGameStateTextValue(fields.time),
    location: coerceGameStateTextValue(fields.location),
    weather: coerceGameStateTextValue(fields.weather),
    temperature: coerceGameStateTextValue(fields.temperature),
  };
}

function parseStoredManualOverrides(value: unknown): Record<string, string> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : null;
}

/** The edits of the five scene fields. The others are stored as fingerprints, which mean nothing in a prompt. */
export function parseSceneManualOverrides(value: unknown): Record<string, string> | null {
  const scene = Object.fromEntries(
    Object.entries(parseStoredManualOverrides(value) ?? {}).filter(([key]) =>
      (MANUAL_OVERRIDE_FIELDS as readonly string[]).includes(key),
    ),
  );
  return Object.keys(scene).length > 0 ? scene : null;
}

function serializeManualOverrides(manualOverrides: Record<string, string> | null | undefined) {
  return manualOverrides && Object.keys(manualOverrides).length > 0 ? JSON.stringify(manualOverrides) : null;
}

function fingerprintTrackerValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex")
    .slice(0, 16);
}

function storedPlayerStats(row: ManualEditSource | null | undefined): Record<string, unknown> {
  const stats = parseSnapshotJson<unknown>(row?.playerStats, null);
  return stats && typeof stats === "object" && !Array.isArray(stats) ? (stats as Record<string, unknown>) : {};
}

/** What an edit record holds for one tracker value: the text of a scene field, a fingerprint otherwise. */
function manualEditValue(row: ManualEditSource | null | undefined, key: string): string | null {
  if ((MANUAL_OVERRIDE_FIELDS as readonly string[]).includes(key)) return coerceGameStateTextValue(row?.[key]) ?? "";
  if ((MANUAL_EDIT_JSON_FIELDS as readonly string[]).includes(key)) {
    return fingerprintTrackerValue(parseSnapshotJson<unknown>(row?.[key], null));
  }
  if (key.startsWith(PLAYER_STATS_EDIT_PREFIX)) {
    return fingerprintTrackerValue(storedPlayerStats(row)[key.slice(PLAYER_STATS_EDIT_PREFIX.length)]);
  }
  return null;
}

/** Record in `overrides` every tracker value a Tracker Panel edit changed from `before` to `after`. */
function recordManualEdits(
  overrides: Record<string, string>,
  before: ManualEditSource | null | undefined,
  after: ManualEditSource,
) {
  const statKeys = new Set([...Object.keys(storedPlayerStats(before)), ...Object.keys(storedPlayerStats(after))]);
  const keys = [
    ...MANUAL_OVERRIDE_FIELDS,
    ...MANUAL_EDIT_JSON_FIELDS,
    ...[...statKeys].map((key) => `${PLAYER_STATS_EDIT_PREFIX}${key}`),
  ];
  for (const key of keys) {
    const edited = manualEditValue(after, key);
    if (edited !== null && edited !== manualEditValue(before, key)) overrides[key] = edited;
  }
}

/** The edits in `overrides` that `row` still holds. A changed value retires its edit for good. */
function retainManualEdits(overrides: Record<string, string> | null | undefined, row: ManualEditSource) {
  return Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([key, value]) => manualEditValue(row, key) === value),
  );
}

function emptyGameStateRow(chatId: string): GameStateRow {
  return {
    id: "",
    chatId,
    messageId: "",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    worldCustomFields: "[]",
    presentCharacters: "[]",
    recentEvents: "[]",
    playerStats: null,
    personaStats: null,
    manualOverrides: null,
    fieldLocks: null,
    hiddenTrackerFields: null,
    rulesetLive: null,
    committed: 0,
    createdAt: "",
  };
}

function serializeFieldLocks(fieldLocks: TrackerFieldLocks | null | undefined) {
  const normalized = normalizeTrackerFieldLocks(fieldLocks);
  return trackerFieldLocksAreEmpty(normalized) ? null : JSON.stringify(normalized);
}

function serializeHiddenTrackerFields(hiddenFields: TrackerHiddenFields | null | undefined) {
  const normalized = normalizeTrackerHiddenFields(hiddenFields);
  return trackerHiddenFieldsAreEmpty(normalized) ? null : JSON.stringify(normalized);
}

/** Live ruleset sheet state is bounded at every read and write: an unreadable or oversized value
 *  reads as none, which the sheet math treats as every pool at its default. */
export function parseStoredRulesetLive(value: unknown): RulesetLiveStates | null {
  const parsed = rulesetLiveStatesSchema.safeParse(parseSnapshotJson<unknown>(value, null));
  return parsed.success && Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

function serializeRulesetLive(value: unknown): string | null {
  const live = parseStoredRulesetLive(value);
  return live ? JSON.stringify(live) : null;
}

function parseSnapshotJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value == null ? fallback : (value as T);
}

function buildLockMigrationState(row: LockMigrationStateSource): GameState {
  return {
    id: typeof row.id === "string" ? row.id : "",
    chatId: typeof row.chatId === "string" ? row.chatId : "",
    messageId: typeof row.messageId === "string" ? row.messageId : "",
    swipeIndex: typeof row.swipeIndex === "number" ? row.swipeIndex : 0,
    date: coerceGameStateTextValue(row.date),
    time: coerceGameStateTextValue(row.time),
    location: coerceGameStateTextValue(row.location),
    weather: coerceGameStateTextValue(row.weather),
    temperature: coerceGameStateTextValue(row.temperature),
    worldCustomFields: normalizeWorldCustomFields(parseSnapshotJson(row.worldCustomFields, [])),
    presentCharacters: parseSnapshotJson(row.presentCharacters, []),
    recentEvents: parseSnapshotJson(row.recentEvents, []),
    playerStats: parseSnapshotJson(row.playerStats, null),
    personaStats: parseSnapshotJson(row.personaStats, null),
    fieldLocks: parseTrackerFieldLocks(row.fieldLocks),
    hiddenTrackerFields: parseTrackerHiddenFields(row.hiddenTrackerFields),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : now(),
  };
}

export function createGameStateStorage(db: DB) {
  return {
    async getLatest(chatId: string) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(eq(gameStateSnapshots.chatId, chatId))
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getRecent(chatId: string, limit = 100, throughCreatedAt?: string | null) {
      return db
        .select()
        .from(gameStateSnapshots)
        .where(
          throughCreatedAt
            ? and(
                eq(gameStateSnapshots.chatId, chatId),
                eq(gameStateSnapshots.committed, 1),
                lte(gameStateSnapshots.createdAt, throughCreatedAt),
              )
            : and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.committed, 1)),
        )
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(Math.max(1, Math.min(500, limit)));
    },

    async getById(id: string, chatId?: string) {
      const condition = chatId
        ? and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.id, id))
        : eq(gameStateSnapshots.id, id);
      const rows = await db.select().from(gameStateSnapshots).where(condition).limit(1);
      return rows[0] ?? null;
    },

    /** Get the latest committed game state — the one the user "accepted" by sending their next message. */
    async getLatestCommitted(chatId: string) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.committed, 1)))
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getForGeneration(
      chatId: string,
      options?: {
        preferLatestVisible?: boolean;
        visibleAnchor?: GameStateVisibleAnchor | null;
        excludeMessageId?: string | null;
        fallbackMessageIds?: string[] | null;
      },
    ) {
      const excludeMessageId = options?.excludeMessageId || null;
      const fallbackMessageIds = Array.from(
        new Set((options?.fallbackMessageIds ?? []).filter((id): id is string => typeof id === "string")),
      );
      const latestCommitted = () =>
        fallbackMessageIds.length > 0
          ? this.getLatestCommittedForMessages(chatId, fallbackMessageIds)
          : excludeMessageId
            ? this.getLatestCommittedExcludingMessage(chatId, excludeMessageId)
            : this.getLatestCommitted(chatId);
      const latestAny = () =>
        fallbackMessageIds.length > 0
          ? this.getLatestForMessages(chatId, fallbackMessageIds)
          : excludeMessageId
            ? this.getLatestExcludingMessage(chatId, excludeMessageId)
            : this.getLatest(chatId);

      const visible =
        options?.preferLatestVisible && options.visibleAnchor?.messageId
          ? await this.getByChatAndMessage(chatId, options.visibleAnchor.messageId, options.visibleAnchor.swipeIndex)
          : null;
      const selected = visible ?? (await latestCommitted()) ?? (await latestAny());
      // A regeneration starts from the reply before the one it replaces, so the Tracker Panel
      // edits made on the replaced reply are laid over that state. Re-run trackers anchors the
      // reply's own swipe, which already holds them.
      if (excludeMessageId && selected?.messageId !== excludeMessageId) {
        return (await this.applyManualEdits(chatId, excludeMessageId, selected)) ?? selected;
      }
      return selected;
    },

    /**
     * `base` with the Tracker Panel edits made on any swipe of `messageId` laid over it, or
     * null when there are none. An edit counts while its row still holds the edited value,
     * so a later tracker run that changes the field retires it.
     */
    async applyManualEdits(chatId: string, messageId: string, base: GameStateRow | null) {
      if (!messageId) return null;
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.messageId, messageId)))
        .orderBy(asc(gameStateSnapshots.swipeIndex));
      let edited: GameStateRow | null = null;
      const laid: Record<string, string> = {};
      // A newer edit of a value retires the reply's older edits of it (retireOtherSwipeEdits),
      // so at most one swipe holds each edit.
      // ponytail: a list (characters, custom world fields, persona stats, one playerStats key)
      // is taken whole from the edited swipe. A per-row diff would carry only the edited rows.
      for (const row of rows) {
        for (const [key, value] of Object.entries(parseStoredManualOverrides(row.manualOverrides) ?? {})) {
          if (manualEditValue(row, key) !== value) continue;
          edited ??= { ...(base ?? emptyGameStateRow(chatId)) };
          laid[key] = value;
          if (key.startsWith(PLAYER_STATS_EDIT_PREFIX)) {
            const statKey = key.slice(PLAYER_STATS_EDIT_PREFIX.length);
            edited.playerStats = JSON.stringify({
              ...storedPlayerStats(edited),
              [statKey]: storedPlayerStats(row)[statKey],
            });
          } else {
            Object.assign(edited, { [key]: row[key as keyof GameStateRow] });
          }
        }
      }
      // The agents are shown the edit record, so it must not keep the base's edits these replaced.
      if (edited) {
        edited.manualOverrides = serializeManualOverrides(
          retainManualEdits({ ...parseStoredManualOverrides(base?.manualOverrides), ...laid }, edited),
        );
      }
      return edited;
    },

    /** A Tracker Panel edit replaces the edits of the same values on the reply's other swipes, so the newest one wins. */
    async retireOtherSwipeEdits(target: { chatId: string; messageId: string; swipeIndex: number }, keys: string[]) {
      if (!target.messageId || keys.length === 0) return;
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, target.chatId),
            eq(gameStateSnapshots.messageId, target.messageId),
            ne(gameStateSnapshots.swipeIndex, target.swipeIndex),
          ),
        );
      for (const row of rows) {
        const overrides = { ...(parseStoredManualOverrides(row.manualOverrides) ?? {}) };
        if (!keys.some((key) => key in overrides)) continue;
        for (const key of keys) delete overrides[key];
        await db
          .update(gameStateSnapshots)
          .set({ manualOverrides: serializeManualOverrides(overrides) })
          .where(and(eq(gameStateSnapshots.chatId, row.chatId), eq(gameStateSnapshots.id, row.id)));
      }
    },

    /** Get latest game state excluding snapshots tied to a specific message (for regen/swipes). */
    async getLatestExcludingMessage(chatId: string, excludeMessageId: string) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), ne(gameStateSnapshots.messageId, excludeMessageId)))
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Get latest committed state excluding snapshots tied to a specific message (for regen/swipes). */
    async getLatestCommittedExcludingMessage(chatId: string, excludeMessageId: string) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, chatId),
            eq(gameStateSnapshots.committed, 1),
            ne(gameStateSnapshots.messageId, excludeMessageId),
          ),
        )
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getLatestForMessages(chatId: string, messageIds: string[]) {
      if (messageIds.length === 0) return null;
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(and(eq(gameStateSnapshots.chatId, chatId), inArray(gameStateSnapshots.messageId, messageIds)))
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async getLatestCommittedForMessages(chatId: string, messageIds: string[]) {
      if (messageIds.length === 0) return null;
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, chatId),
            eq(gameStateSnapshots.committed, 1),
            inArray(gameStateSnapshots.messageId, messageIds),
          ),
        )
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Chat-scoped message lookup (the chatId also keeps the lazy store from loading other chats' shards). */
    async getByChatAndMessage(chatId: string, messageId: string, swipeIndex: number = 0) {
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, chatId),
            eq(gameStateSnapshots.messageId, messageId),
            eq(gameStateSnapshots.swipeIndex, swipeIndex),
          ),
        )
        .orderBy(desc(gameStateSnapshots.createdAt))
        .limit(1);
      return rows[0] ?? null;
    },

    /** Batch-fetch committed snapshots for multiple messages in one chat. Returns a Map of messageId → row. */
    async getCommittedForMessages(
      chatId: string,
      messagesOrIds: Array<string | { id: string; activeSwipeIndex?: number | null }>,
    ) {
      const activeSwipeByMessageId = new Map<string, number>();
      const messageIds = messagesOrIds.map((messageOrId) => {
        if (typeof messageOrId === "string") return messageOrId;
        if (typeof messageOrId.activeSwipeIndex === "number") {
          activeSwipeByMessageId.set(messageOrId.id, messageOrId.activeSwipeIndex);
        }
        return messageOrId.id;
      });
      if (messageIds.length === 0) return new Map<string, typeof gameStateSnapshots.$inferSelect>();
      const rows = await db
        .select()
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, chatId),
            inArray(gameStateSnapshots.messageId, messageIds),
            eq(gameStateSnapshots.committed, 1),
          ),
        )
        .orderBy(desc(gameStateSnapshots.createdAt));
      const map = new Map<string, typeof gameStateSnapshots.$inferSelect>();
      for (const row of rows) {
        const activeSwipeIndex = activeSwipeByMessageId.get(row.messageId);
        if (activeSwipeIndex !== undefined && row.swipeIndex !== activeSwipeIndex) continue;
        if (!map.has(row.messageId)) map.set(row.messageId, row);
      }
      return map;
    },

    /** Mark a specific snapshot as committed. */
    async commit(id: string, chatId?: string) {
      const condition = chatId
        ? and(eq(gameStateSnapshots.chatId, chatId), eq(gameStateSnapshots.id, id))
        : eq(gameStateSnapshots.id, id);
      await db.update(gameStateSnapshots).set({ committed: 1 }).where(condition);
    },

    async create(
      state: Omit<GameState, "id" | "createdAt">,
      manualOverrides?: Record<string, string> | null,
      options?: {
        /** Keep the detailed inventory of the row being replaced, for a caller that carries the
         *  previous turn's stats forward (the world-state tracker). The turn's own inventory tags
         *  wrote that inventory and no tracker works one out, so carrying the stats would undo them. */
        keepReplacedInventory?: boolean;
      },
    ) {
      const latestBeforeInsert = await this.getLatest(state.chatId);
      // Most callers rebuild a snapshot from the fields they know and have never heard of ruleset
      // live state. When such a caller replaces the row of a message + swipe, the live state that
      // row already carried (written right after the message was saved) stays with it.
      const replaced = state.messageId
        ? await this.getByChatAndMessage(state.chatId, state.messageId, state.swipeIndex)
        : null;
      const replacedInventory = (() => {
        if (!options?.keepReplacedInventory || !replaced?.playerStats || !state.playerStats) return undefined;
        const stats = parseSnapshotJson<{ inventory?: unknown } | null>(replaced.playerStats, null);
        return Array.isArray(stats?.inventory) ? stats.inventory : undefined;
      })();
      const playerStats =
        state.playerStats && replacedInventory
          ? { ...state.playerStats, inventory: replacedInventory as NonNullable<typeof state.playerStats>["inventory"] }
          : state.playerStats;
      // Remove any prior snapshot for the same message + swipe so duplicates don't accumulate
      if (state.messageId) {
        await db
          .delete(gameStateSnapshots)
          .where(
            and(
              eq(gameStateSnapshots.chatId, state.chatId),
              eq(gameStateSnapshots.messageId, state.messageId),
              eq(gameStateSnapshots.swipeIndex, state.swipeIndex),
            ),
          );
      }
      const id = newId();
      const trackerValues = {
        ...coerceSnapshotTextFields(state),
        worldCustomFields: JSON.stringify(normalizeWorldCustomFields(state.worldCustomFields)),
        presentCharacters: JSON.stringify(state.presentCharacters),
        recentEvents: JSON.stringify(state.recentEvents),
        playerStats: playerStats ? JSON.stringify(playerStats) : null,
        personaStats: state.personaStats ? JSON.stringify(state.personaStats) : null,
      };
      await db.insert(gameStateSnapshots).values({
        id,
        chatId: state.chatId,
        messageId: state.messageId,
        swipeIndex: state.swipeIndex,
        ...trackerValues,
        // A tracker run that rewrites a row it does not move keeps that row's edits it did not change.
        manualOverrides: serializeManualOverrides(
          retainManualEdits(manualOverrides ?? parseStoredManualOverrides(replaced?.manualOverrides), trackerValues),
        ),
        fieldLocks: serializeFieldLocks(state.fieldLocks),
        hiddenTrackerFields: serializeHiddenTrackerFields(state.hiddenTrackerFields),
        rulesetLive: serializeRulesetLive(state.rulesetLive !== undefined ? state.rulesetLive : replaced?.rulesetLive),
        committed: state.committed ? 1 : 0,
        createdAt: ensureTimestampAfter(now(), latestBeforeInsert?.createdAt),
      });
      return id;
    },

    /** Apply one model-requested field with its lock check and write in the same transaction. */
    async updateFromTool(
      chatId: string,
      field: "location" | "time",
      value: string,
      locationIsAuthoritative: boolean,
      target: {
        messageId: string;
        swipeIndex: number;
        baseSnapshot: typeof gameStateSnapshots.$inferSelect | null;
        compatibilityLocation?: string | null;
      },
    ) {
      if (field === "location" && locationIsAuthoritative) {
        throw new Error("Location is controlled by Spatial Context. Use the game's movement controls.");
      }
      return db.transaction(async (tx) => {
        const store = createGameStateStorage(tx);
        const storedBase = target.baseSnapshot ? await store.getById(target.baseSnapshot.id, chatId) : null;
        // Re-reading the base drops the Tracker Panel edits a regeneration starts from, so lay them over again.
        const base = storedBase
          ? ((await store.applyManualEdits(chatId, target.messageId, storedBase)) ?? storedBase)
          : null;
        const snapshot = (await store.getByChatAndMessage(chatId, target.messageId, target.swipeIndex)) ?? base;
        if (!snapshot) throw new Error("No game-state snapshot is available to update.");
        const patch = applyTrackerFieldLocksToGameStatePatch({ [field]: value }, buildLockMigrationState(snapshot));
        if (patch[field] !== value) throw new Error(`The ${field} field is locked; no change was applied.`);
        const stored = await store.updateByMessage(target.messageId, target.swipeIndex, chatId, patch, undefined, {
          baseSnapshot: base,
          ...(target.compatibilityLocation !== undefined
            ? { compatibilityLocation: target.compatibilityLocation }
            : {}),
        });
        if (stored?.[field] !== value) throw new Error("The game-state update could not be stored.");
        return { [field]: stored[field] };
      });
    },

    async updateLatest(
      chatId: string,
      fields: GameStateUpdateFields,
      /** When true, the edited fields are also recorded as manual overrides. */
      manual?: boolean,
    ) {
      const latest = await this.getLatest(chatId);
      return latest ? this._applyUpdate(latest, fields, manual) : null;
    },

    /**
     * Same as updateLatest but targets a specific (messageId, swipeIndex) snapshot
     * instead of the chronologically newest one. This ensures tracker agents write
     * to the exact same snapshot the world-state agent created for a given swipe.
     *
     * When no snapshot exists for the target (messageId, swipeIndex) — e.g. because
     * the world-state agent is disabled or failed — we clone the provided base
     * snapshot, or the latest snapshot when no base is supplied, into a NEW row for
     * this message+swipe and apply the update there. This avoids corrupting a
     * previous turn's snapshot with new tracker data.
     *
     * options.baseSnapshot is intentionally presence-sensitive: omitted falls back
     * to getLatest(chatId), while an explicit null means no base and creates an
     * empty snapshot for the target. options.compatibilityLocation lets an
     * authoritative location system seed only newly cloned legacy snapshots.
     */
    async updateByMessage(
      messageId: string,
      swipeIndex: number,
      chatId: string,
      fields: GameStateUpdateFields,
      manual?: boolean,
      options?: {
        baseSnapshot?: typeof gameStateSnapshots.$inferSelect | null;
        compatibilityLocation?: string | null;
      },
    ) {
      const snap = await this.getByChatAndMessage(chatId, messageId, swipeIndex);
      if (snap) return this._applyUpdate(snap, fields, manual);

      // No snapshot for this swipe yet — clone the chosen base into a new row
      // so each (messageId, swipeIndex) gets its own snapshot and we don't
      // corrupt a previous turn's data.
      const latest =
        options && Object.prototype.hasOwnProperty.call(options, "baseSnapshot")
          ? options.baseSnapshot
          : await this.getLatest(chatId);
      if (!latest && !messageId) return null;

      const baseState = {
        chatId,
        messageId,
        swipeIndex,
        date: coerceGameStateTextValue(latest?.date),
        time: coerceGameStateTextValue(latest?.time),
        location:
          options && Object.prototype.hasOwnProperty.call(options, "compatibilityLocation")
            ? coerceGameStateTextValue(options.compatibilityLocation)
            : coerceGameStateTextValue(latest?.location),
        weather: coerceGameStateTextValue(latest?.weather),
        temperature: coerceGameStateTextValue(latest?.temperature),
        worldCustomFields: normalizeWorldCustomFields(parseSnapshotJson(latest?.worldCustomFields, [])),
        presentCharacters: latest?.presentCharacters
          ? typeof latest.presentCharacters === "string"
            ? JSON.parse(latest.presentCharacters)
            : latest.presentCharacters
          : [],
        recentEvents: latest?.recentEvents
          ? typeof latest.recentEvents === "string"
            ? JSON.parse(latest.recentEvents)
            : latest.recentEvents
          : [],
        playerStats: latest?.playerStats
          ? typeof latest.playerStats === "string"
            ? JSON.parse(latest.playerStats)
            : latest.playerStats
          : null,
        personaStats: latest?.personaStats
          ? typeof latest.personaStats === "string"
            ? JSON.parse(latest.personaStats)
            : latest.personaStats
          : null,
        fieldLocks: parseTrackerFieldLocks(latest?.fieldLocks),
        hiddenTrackerFields: parseTrackerHiddenFields(latest?.hiddenTrackerFields),
        rulesetLive: parseStoredRulesetLive(latest?.rulesetLive),
      };
      baseState.fieldLocks = normalizeTrackerFieldLocksForState(
        baseState.fieldLocks,
        buildLockMigrationState(baseState),
      );

      const clonedState = { ...baseState };

      // Apply the incoming fields on top of the cloned base
      if (fields.date !== undefined) baseState.date = coerceGameStateTextValue(fields.date);
      if (fields.time !== undefined) baseState.time = coerceGameStateTextValue(fields.time);
      if (fields.location !== undefined) baseState.location = coerceGameStateTextValue(fields.location);
      if (fields.weather !== undefined) baseState.weather = coerceGameStateTextValue(fields.weather);
      if (fields.temperature !== undefined) baseState.temperature = coerceGameStateTextValue(fields.temperature);
      if (fields.worldCustomFields !== undefined)
        baseState.worldCustomFields = normalizeWorldCustomFields(fields.worldCustomFields);
      if (fields.presentCharacters !== undefined) baseState.presentCharacters = fields.presentCharacters as any;
      if (fields.playerStats !== undefined) baseState.playerStats = fields.playerStats as any;
      if (fields.personaStats !== undefined) baseState.personaStats = fields.personaStats as any;
      if (fields.fieldLocks !== undefined) {
        baseState.fieldLocks = normalizeTrackerFieldLocksForState(
          fields.fieldLocks,
          buildLockMigrationState(baseState),
        );
      }
      if (fields.hiddenTrackerFields !== undefined) {
        baseState.hiddenTrackerFields = normalizeTrackerHiddenFields(fields.hiddenTrackerFields);
      }
      if (fields.rulesetLive !== undefined) baseState.rulesetLive = parseStoredRulesetLive(fields.rulesetLive);

      // The record covers only this edit, never the base's own edits.
      const manualOverrides: Record<string, string> = {};
      if (manual) recordManualEdits(manualOverrides, clonedState, baseState);
      await this.create(baseState as any, Object.keys(manualOverrides).length > 0 ? manualOverrides : null);
      await this.retireOtherSwipeEdits({ chatId, messageId, swipeIndex }, Object.keys(manualOverrides));
      return this.getByChatAndMessage(chatId, messageId, swipeIndex);
    },

    /** Internal: apply field updates + optional manual-override tracking to a snapshot row. */
    async _applyUpdate(row: typeof gameStateSnapshots.$inferSelect, fields: GameStateUpdateFields, manual?: boolean) {
      const updates: Record<string, unknown> = {};
      const existingLockMigrationState = buildLockMigrationState(row);
      if (fields.date !== undefined) updates.date = coerceGameStateTextValue(fields.date);
      if (fields.time !== undefined) updates.time = coerceGameStateTextValue(fields.time);
      if (fields.location !== undefined) updates.location = coerceGameStateTextValue(fields.location);
      if (fields.weather !== undefined) updates.weather = coerceGameStateTextValue(fields.weather);
      if (fields.temperature !== undefined) updates.temperature = coerceGameStateTextValue(fields.temperature);
      if (fields.worldCustomFields !== undefined)
        updates.worldCustomFields = JSON.stringify(normalizeWorldCustomFields(fields.worldCustomFields));
      if (fields.presentCharacters !== undefined) updates.presentCharacters = JSON.stringify(fields.presentCharacters);
      if (fields.playerStats !== undefined)
        updates.playerStats = fields.playerStats ? JSON.stringify(fields.playerStats) : null;
      if (fields.personaStats !== undefined)
        updates.personaStats = fields.personaStats ? JSON.stringify(fields.personaStats) : null;
      if (fields.hiddenTrackerFields !== undefined)
        updates.hiddenTrackerFields = serializeHiddenTrackerFields(fields.hiddenTrackerFields);
      if (fields.rulesetLive !== undefined) updates.rulesetLive = serializeRulesetLive(fields.rulesetLive);

      const edits: Record<string, string> = {};
      if (manual || (row.manualOverrides && Object.keys(updates).length > 0)) {
        const updated = { ...row, ...updates };
        // A cleared field is an edit too: the next generation starts from it empty.
        if (manual) recordManualEdits(edits, row, updated);
        updates.manualOverrides = serializeManualOverrides(
          retainManualEdits({ ...parseStoredManualOverrides(row.manualOverrides), ...edits }, updated),
        );
      }

      if (fields.fieldLocks !== undefined) {
        const incomingLockMigrationState = buildLockMigrationState({
          ...row,
          ...(fields.worldCustomFields !== undefined
            ? { worldCustomFields: normalizeWorldCustomFields(fields.worldCustomFields) }
            : {}),
          ...(fields.presentCharacters !== undefined ? { presentCharacters: fields.presentCharacters } : {}),
          ...(fields.playerStats !== undefined ? { playerStats: fields.playerStats } : {}),
          ...(fields.personaStats !== undefined ? { personaStats: fields.personaStats } : {}),
        });
        updates.fieldLocks = serializeFieldLocks(
          normalizeTrackerFieldLocksForState(fields.fieldLocks, incomingLockMigrationState),
        );
      } else if (row.fieldLocks) {
        updates.fieldLocks = serializeFieldLocks(
          normalizeTrackerFieldLocksForState(parseTrackerFieldLocks(row.fieldLocks), existingLockMigrationState),
        );
      }

      if (Object.keys(updates).length === 0) return row;

      await db
        .update(gameStateSnapshots)
        .set(updates)
        .where(and(eq(gameStateSnapshots.chatId, row.chatId), eq(gameStateSnapshots.id, row.id)));
      await this.retireOtherSwipeEdits(row, Object.keys(edits));
      return { ...row, ...updates };
    },

    async deleteForChat(chatId: string) {
      await db.delete(gameStateSnapshots).where(eq(gameStateSnapshots.chatId, chatId));
    },
  };
}
