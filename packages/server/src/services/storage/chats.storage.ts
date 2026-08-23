// ──────────────────────────────────────────────
// Storage: Chats
// ──────────────────────────────────────────────
import {
  eq,
  ne,
  desc,
  and,
  gt,
  lt,
  or,
  inArray,
  isNull,
  isNotNull,
  jsonFlagsNotTrue,
  stringIsNonBlank,
} from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import {
  characters,
  chats,
  messages,
  messageSwipes,
  gameStateSnapshots,
  spatialContextSnapshots,
  gameCheckpoints,
  gameEngineState,
  chatImages,
  gameSceneVideos,
  gameTurnStoryboardKeyframes,
  gameTurnStoryboards,
  oocInfluences,
  conversationNotes,
  agentRuns,
  agentMemory,
  memoryChunks,
  conversationCallSessions,
  conversationCallMessages,
} from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import type { CreateChatInput, CreateMessageInput } from "@marinara-engine/shared";
import {
  ensureTimestampAfter,
  latestTrustedTimestamp,
  normalizeTimestampOverrides,
  type TimestampOverrides,
} from "../import/import-timestamps.js";
import { scheduleNeedsRefresh, type CharacterSchedules, type WeekSchedule } from "../conversation/schedule.service.js";
import type { ConversationStatusOverride } from "@marinara-engine/shared";
import { resolveConversationTimeZone, toZonedWallClockDate } from "../conversation/timezone.js";
import { logger } from "../../lib/logger.js";
import { galleryFileHasReferences, unlinkGalleryFileIfUnreferenced } from "../image/gallery-file-lifecycle.js";

const GALLERY_DIR = join(DATA_DIR, "gallery");
const GAME_SCENE_VIDEOS_DIR = join(DATA_DIR, "game-scene-videos");

/** Total character budget for durable conversation notes per roleplay chat. Oldest pruned on insert. */
export const CONVERSATION_NOTES_BUDGET_CHARS = 4000;

export type MetadataPatch = Record<string, unknown>;
export type MetadataUpdater = (current: MetadataPatch) => MetadataPatch | Promise<MetadataPatch>;
export type ChatDeleteGuardResult = { allowed: true } | { allowed: false; reason: string };

const metadataPatchQueues = new Map<string, Promise<void>>();
const messageExtraPatchQueues = new Map<string, Promise<void>>();
const swipeExtraPatchQueues = new Map<string, Promise<void>>();

async function withPatchQueue<T>(
  queues: Map<string, Promise<void>>,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(operation);
  const queuedVoid = queued.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, queuedVoid);

  try {
    return await queued;
  } finally {
    if (queues.get(key) === queuedVoid) {
      queues.delete(key);
    }
  }
}

export async function withChatMetadataPatchQueue<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
  return withPatchQueue(metadataPatchQueues, chatId, operation);
}

export async function withMessageExtraPatchQueue<T>(messageId: string, operation: () => Promise<T>): Promise<T> {
  return withPatchQueue(messageExtraPatchQueues, messageId, operation);
}

function parseMetadata(raw: unknown): MetadataPatch {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as MetadataPatch) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as MetadataPatch) : {};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeConversationStatusOverrides(current: unknown, incoming: unknown): unknown {
  if (incoming === null) return null;
  if (incoming === undefined) return current;
  if (isPlainRecord(current) && isPlainRecord(incoming)) {
    const merged = { ...current, ...incoming };
    // Strip null tombstones (explicit deletion signals from the client)
    for (const key of Object.keys(merged)) {
      if (merged[key] === null) delete merged[key];
    }
    return merged;
  }
  return incoming;
}

function mergeMetadataPatch(current: MetadataPatch, patch: MetadataPatch): MetadataPatch {
  const merged = { ...current, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "conversationStatusOverrides")) {
    merged.conversationStatusOverrides = mergeConversationStatusOverrides(
      current.conversationStatusOverrides,
      patch.conversationStatusOverrides,
    );
  }
  return merged;
}

// ── Per-chat write ordering (#5406) ──────────────────────────────────────────
// A game-surface Experience keeps its save in two stores: the per-anchor
// game_engine_state row (the authority, rewinds with the story) and a top-level chat-metadata
// key it maintains as a boot cache (chat-global, never rewinds). Nothing let a client tell
// "metadata is ahead because the last session degraded to metadata-only writes" from "the row
// is behind because the player swiped back", so a degraded session's play was simply lost.
//
// The fix is one counter both paths draw from: `chats.writeOrdinalCounter`. Every allocation
// is a read-and-bump of that column performed INSIDE the per-chat metadata patch queue
// (`withChatMetadataPatchQueue`), which is what makes the sequence monotonic even though the
// two writers hold different locks — the experience-state route holds its own per-chat write
// lock and then calls `allocateWriteOrdinal`, which takes the metadata queue on top. The lock
// order is always experience-lock -> metadata-queue and never the reverse, so there is no
// deadlock, and because every allocation funnels through the one queue no two writes can read
// the same counter value. Crashing between an allocation and the write it stamps burns an
// ordinal; the contract is strict ordering, not density, so gaps are fine.
//
// The counter is not trusted on its own, because a metadata blob (mirror included) can be MOVED
// into a chat that never allocated those ordinals — branching, a game "Next Session" carry, a
// restored backup. Every allocation therefore floors the counter by the ordinals the chat's own
// mirror already carries (`writeOrdinalFloor`), and the branch seam additionally raises the
// counter above every engine-row ordinal it copied.

/** Engine-owned metadata key holding `{ "<top-level metadata key>": <write ordinal> }` (#5406). */
export const METADATA_WRITE_ORDINALS_KEY = "metadataWriteOrdinals";

/** Read a stored mirror defensively — it can predate #5406 or have been clobbered by a
 *  whole-blob `updateMetadata`, and only positive safe integers are usable ordinals. */
function readOrdinalMirror(value: unknown): Map<string, number> {
  const entries = new Map<string, number>();
  if (!isPlainRecord(value)) return entries;
  for (const [key, ordinal] of Object.entries(value)) {
    if (key === METADATA_WRITE_ORDINALS_KEY) continue;
    if (typeof ordinal === "number" && Number.isSafeInteger(ordinal) && ordinal > 0) entries.set(key, ordinal);
  }
  return entries;
}

/**
 * The value this chat's next ordinal must beat: its counter, floored by every ordinal its
 * metadata mirror already carries.
 *
 * The mirror can legitimately sit ABOVE the counter, because a metadata blob can be *moved* into
 * a chat whose counter never handed those values out — a chat branch copying the source blob, a
 * game "Next Session" carrying the previous session's metadata, an imported or restored backup.
 * Allocating below a live stamp would make a brand-new write compare as older than a stale one
 * for the rest of that key's life, so BOTH allocators floor here rather than trusting the counter
 * alone.
 */
function writeOrdinalFloor(counter: unknown, metadata: MetadataPatch | null | undefined): number {
  let floor = typeof counter === "number" && Number.isSafeInteger(counter) && counter > 0 ? counter : 0;
  for (const ordinal of readOrdinalMirror(metadata?.[METADATA_WRITE_ORDINALS_KEY]).values()) {
    if (ordinal > floor) floor = ordinal;
  }
  return floor;
}

/** The chat's next write ordinal: one past {@link writeOrdinalFloor}. */
function nextWriteOrdinal(counter: unknown, metadata?: MetadataPatch | null): number {
  return writeOrdinalFloor(counter, metadata) + 1;
}

/**
 * Cap on how much of one metadata value is serialized for change detection. Past it the
 * comparison degrades to reference identity: a multi-megabyte `gameMap` would otherwise be
 * stringified twice on every patch (once for the pre-updater snapshot, once for the merged
 * value) purely to decide whether to move an ordinal.
 *
 * The trade that buys: an oversize value re-sent as a fresh but equal object is counted as a
 * write (harmless over-stamping), and an oversize value mutated in place is NOT seen (the same
 * blind spot the pre-fingerprint code had for every value). Ordering by metadata is a boot cache
 * for packages that keep their save small; a package that wants a multi-megabyte value ordered
 * should split the ordered part out.
 */
const ORDINAL_DIFF_MAX_CHARS = 32_768;

/** Bail-out token thrown from the bounded serializer's replacer. */
const ORDINAL_DIFF_TOO_LARGE = Symbol("ordinal-diff-too-large");

/** Fingerprint standing for "this key is absent", distinct from every JSON serialization. */
const ORDINAL_DIFF_ABSENT = "\u0000absent";

/**
 * Fingerprint one metadata value for change detection, or null when it cannot be compared by
 * value — too large (see {@link ORDINAL_DIFF_MAX_CHARS}) or unserializable (cyclic). The replacer
 * charges every visited node against the budget and bails out, so an oversize value costs a
 * partial walk rather than a full stringify.
 */
function fingerprintMetadataValue(value: unknown): string | null {
  if (value === undefined) return ORDINAL_DIFF_ABSENT;
  let budget = ORDINAL_DIFF_MAX_CHARS;
  try {
    return (
      JSON.stringify(value, (_key, nested: unknown) => {
        budget -= typeof nested === "string" ? nested.length + 2 : 8;
        if (budget < 0) throw ORDINAL_DIFF_TOO_LARGE;
        return nested;
      }) ?? ORDINAL_DIFF_ABSENT
    );
  } catch {
    return null;
  }
}

/**
 * Fingerprint the top-level metadata values an updater could mutate IN PLACE, for the "before"
 * side of {@link metadataValueChanged}. Only object-valued keys need it: a primitive cannot be
 * mutated through the shallow copy the updater receives, so `current[key]` still holds its
 * pre-updater value afterwards and can be fingerprinted lazily.
 */
function fingerprintMetadata(current: MetadataPatch): Map<string, string | null> {
  const fingerprints = new Map<string, string | null>();
  for (const key of Object.keys(current)) {
    const value = current[key];
    if (value !== null && typeof value === "object") fingerprints.set(key, fingerprintMetadataValue(value));
  }
  return fingerprints;
}

/**
 * Did this patch actually write a new value for the key? Stamping a key whose value did not move
 * would falsely advance the ordinal of a package's untouched key — precisely the bogus "metadata
 * is newer" reading that clobbers a good save — so the `{ ...current, changedKey }` updater shape
 * used throughout this file must leave every other key alone.
 *
 * `beforeFingerprint` is captured BEFORE a function updater runs. Comparing against the live
 * `current[key]` afterwards is blind to an updater that mutates a nested value IN PLACE (the tool
 * runtime hands a shallow copy of the live metadata to package-supplied code, so `current[key]`
 * and `merged[key]` are then the same, already-mutated object and every value comparison agrees
 * they match).
 *
 * When either side is un-fingerprintable (oversize, or cyclic) the test degrades to reference
 * identity — the same answer the old `Object.is` fast path gave for those values, in-place blind
 * spot included. See {@link ORDINAL_DIFF_MAX_CHARS} for why that is the right trade.
 */
function metadataValueChanged(beforeFingerprint: string | null, beforeValue: unknown, after: unknown): boolean {
  const afterFingerprint = fingerprintMetadataValue(after);
  if (beforeFingerprint !== null && afterFingerprint !== null) return beforeFingerprint !== afterFingerprint;
  return !Object.is(beforeValue, after);
}

/**
 * Strip the engine-owned mirror out of an incoming patch, so a caller on the metadata PATCH path
 * cannot forge or freeze the ordering: on that path ordinals are only ever server-assigned, and
 * function updaters that spread `current` would otherwise write the mirror back verbatim.
 *
 * This is a property of the queued patch path only. Whole-blob writers (`updateMetadata`, the
 * capability persistence host) rewrite the mirror as part of the blob they carry — see the
 * `updateMetadata` doc comment for why that is in scope.
 */
function stripOrdinalMirrorKey(patch: MetadataPatch): MetadataPatch {
  if (!Object.prototype.hasOwnProperty.call(patch, METADATA_WRITE_ORDINALS_KEY)) return patch;
  const { [METADATA_WRITE_ORDINALS_KEY]: _discarded, ...rest } = patch;
  return rest;
}

type OrdinalStamp = { ordinal: number; mirror: Record<string, number> };

/**
 * Allocate one ordinal for this patch and stamp it onto every top-level key the patch actually
 * changed. All keys in one patch share the ordinal because they were written in the same atomic
 * row update — there is no meaningful order among them. Returns null when nothing changed, so a
 * no-op patch neither burns an ordinal nor rewrites the mirror.
 *
 * `before` is the fingerprint snapshot taken before a function updater ran, or null for a literal
 * patch object (which cannot have mutated `current`, so its live values are still trustworthy).
 */
function stampMetadataWriteOrdinals(
  counter: unknown,
  current: MetadataPatch,
  merged: MetadataPatch,
  patch: MetadataPatch,
  before: Map<string, string | null> | null,
): OrdinalStamp | null {
  const fingerprintBefore = (key: string): string | null =>
    // Not in the snapshot means either "no updater ran" or "a primitive an updater cannot have
    // mutated in place" — in both cases the live value is still the pre-updater one.
    before?.has(key) ? (before.get(key) as string | null) : fingerprintMetadataValue(current[key]);
  const changed = Object.keys(patch).filter(
    (key) =>
      key !== METADATA_WRITE_ORDINALS_KEY && metadataValueChanged(fingerprintBefore(key), current[key], merged[key]),
  );
  if (changed.length === 0) return null;

  const ordinal = nextWriteOrdinal(counter, current);
  const mirror = readOrdinalMirror(current[METADATA_WRITE_ORDINALS_KEY]);
  for (const key of changed) mirror.set(key, ordinal);
  // Drop ordinals for keys the merged metadata no longer carries (a patch value of `undefined`
  // is how callers delete): there is nothing left to order, and this keeps the mirror bounded
  // by the live key set instead of growing with every key the chat has ever held.
  for (const key of [...mirror.keys()]) if (merged[key] === undefined) mirror.delete(key);
  // fromEntries, not literal assignment: a metadata key of "__proto__" must land as an own
  // data property rather than reaching the prototype setter.
  return { ordinal, mirror: Object.fromEntries(mirror) };
}

/** Apply a stamp to the merged metadata in place. */
function applyOrdinalStamp(merged: MetadataPatch, stamp: OrdinalStamp | null): void {
  if (!stamp) return;
  if (Object.keys(stamp.mirror).length > 0) merged[METADATA_WRITE_ORDINALS_KEY] = stamp.mirror;
  else delete merged[METADATA_WRITE_ORDINALS_KEY];
}

function readUnreadCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function readCharacterIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
}

function hasConversationSchedules(value: unknown): value is CharacterSchedules {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

/**
 * A chat opts into schedules explicitly, or implicitly by already having a
 * cached schedule from an earlier opt-in. An unset flag on a chat that has never
 * used schedules means off, so a character gaining a schedule does not silently
 * switch it on in every old chat.
 */
function areConversationSchedulesEnabled(meta: MetadataPatch): boolean {
  if (typeof meta.conversationSchedulesEnabled === "boolean") return meta.conversationSchedulesEnabled;
  return hasConversationSchedules(meta.characterSchedules);
}

/** Resolved presence state for one chat, read from the character cards it uses. */
export type ConversationPresenceState = {
  schedules: CharacterSchedules;
  statusOverrides: Record<string, ConversationStatusOverride>;
};

/** Cheap structural compare, so a resolve that changes nothing skips the metadata write. */
function sameOverrides(current: unknown, next: Record<string, ConversationStatusOverride>): boolean {
  const currentMap = isPlainRecord(current) ? current : {};
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(currentMap).length) return false;
  return keys.every((key) => JSON.stringify(currentMap[key]) === JSON.stringify(next[key]));
}

function sameSchedules(a: CharacterSchedules, b: CharacterSchedules): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => b[key] !== undefined && JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

/** Read one `extensions` field off a serialized character card. */
function readCardExtension(rawData: unknown, key: string): unknown {
  if (typeof rawData !== "string") return undefined;
  try {
    const parsed = JSON.parse(rawData) as { extensions?: Record<string, unknown> };
    return parsed?.extensions?.[key];
  } catch {
    return undefined;
  }
}

/** Serialize a character card with one `extensions` field replaced. */
function writeCardExtension(rawData: unknown, key: string, value: unknown): string | null {
  if (typeof rawData !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(rawData);
    if (!isPlainRecord(parsed)) return null;
    const rawExtensions = parsed.extensions;
    if (rawExtensions !== undefined && rawExtensions !== null && !isPlainRecord(rawExtensions)) return null;
    const extensions = isPlainRecord(rawExtensions) ? rawExtensions : {};
    return JSON.stringify({ ...parsed, extensions: { ...extensions, [key]: value } });
  } catch {
    return null;
  }
}

function readCharacterSchedule(rawData: unknown): WeekSchedule | null {
  const schedule = readCardExtension(rawData, "conversationSchedule");
  return isValidLegacySchedule(schedule) ? schedule : null;
}

/**
 * A manual presence override belongs to the character, so it applies in every
 * Conversation chat. `null` on the card means the user cleared it.
 */
function readCharacterStatusOverride(rawData: unknown): ConversationStatusOverride | null {
  const override = readCardExtension(rawData, "conversationStatusOverride");
  if (!override || typeof override !== "object" || Array.isArray(override)) return null;
  const typed = override as Record<string, unknown>;
  const validStatus =
    typed.status === "online" || typed.status === "idle" || typed.status === "dnd" || typed.status === "offline";
  if (!validStatus || typeof typed.createdAt !== "string" || typed.createdAt.length === 0) return null;
  return override as ConversationStatusOverride;
}

function isValidLegacyStatusOverride(value: unknown): value is ConversationStatusOverride {
  if (!isPlainRecord(value)) return false;
  const status = value.status;
  return (
    (status === "online" || status === "idle" || status === "dnd" || status === "offline") &&
    typeof value.createdAt === "string" &&
    value.createdAt.length > 0
  );
}

function isValidLegacySchedule(value: unknown): value is WeekSchedule {
  if (!isPlainRecord(value) || typeof value.weekStart !== "string" || !isPlainRecord(value.days)) return false;
  if (
    typeof value.inactivityThresholdMinutes !== "number" ||
    !Number.isFinite(value.inactivityThresholdMinutes) ||
    value.inactivityThresholdMinutes < 0 ||
    typeof value.talkativeness !== "number" ||
    !Number.isFinite(value.talkativeness) ||
    value.talkativeness < 0 ||
    value.talkativeness > 100
  ) {
    return false;
  }
  return Object.values(value.days).every(
    (day) =>
      Array.isArray(day) &&
      day.every(
        (block) =>
          (isPlainRecord(block) &&
            typeof block.time === "string" &&
            typeof block.activity === "string" &&
            block.status === "online") ||
          block.status === "idle" ||
          block.status === "dnd" ||
          block.status === "offline",
      ),
  );
}

function parseCharacterIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

function firstScheduleWeekStart(schedules: CharacterSchedules): string | undefined {
  return Object.values(schedules).find((schedule): schedule is WeekSchedule => !!schedule)?.weekStart;
}

function resolveTimestamps(overrides?: TimestampOverrides | null) {
  const normalized = normalizeTimestampOverrides(overrides);
  const createdAt = normalized?.createdAt ?? now();
  return {
    createdAt,
    updatedAt: normalized?.updatedAt ?? createdAt,
  };
}

/** Serialize optional JSON columns while preserving already-encoded metadata. */
function serializeJsonField(value: unknown, fallback: Record<string, unknown>) {
  if (value === undefined || value === null) return JSON.stringify(fallback);
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseExtraRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function freshSwipeMessageExtra(value: unknown): Record<string, unknown> {
  const current = parseExtraRecord(value);
  const next: Record<string, unknown> = {
    displayText: null,
    isGenerated: typeof current.isGenerated === "boolean" ? current.isGenerated : true,
    tokenCount: null,
    generationInfo: null,
  };

  for (const key of [
    "hiddenFromAI",
    "hiddenFromAICharacterIds",
    "hiddenFromUser",
    "isConversationStart",
    "conversationStartForCharacterIds",
    "reactions",
    "personaSnapshot",
  ]) {
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      next[key] = current[key];
    }
  }

  return next;
}

function isUsableTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function parseMessageCursor(before?: string): { createdAt: string; id: string } | null {
  if (!before) return null;
  const separatorIndex = before.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === before.length - 1) return null;
  const createdAt = before.slice(0, separatorIndex);
  if (!isUsableTimestamp(createdAt)) return null;
  let id: string;
  try {
    id = decodeURIComponent(before.slice(separatorIndex + 1));
  } catch {
    return null;
  }
  if (!id.trim() || id.length > 512) return null;
  return {
    createdAt,
    id,
  };
}

export class InvalidMessageCursorError extends Error {
  constructor() {
    super("Invalid message cursor");
    this.name = "InvalidMessageCursorError";
  }
}

async function invalidateMemoryChunksFrom(db: DB, chatId: string, createdAt: string) {
  await db
    .delete(memoryChunks)
    .where(
      and(
        eq(memoryChunks.chatId, chatId),
        isNull(memoryChunks.sourceChatId),
        gt(memoryChunks.lastMessageAt, createdAt),
      ),
    );
  await db
    .delete(memoryChunks)
    .where(
      and(
        eq(memoryChunks.chatId, chatId),
        isNull(memoryChunks.sourceChatId),
        eq(memoryChunks.lastMessageAt, createdAt),
      ),
    );
}

/**
 * Count swipes per message id. Avoids `inArray(messageSwipes.messageId, ids)`,
 * which the file-native store evaluates as `ids.includes()` for every swipe row
 * (re-materializing the ids array each row) — O(swipeRows * ids) = O(n^2) for a
 * large chat and a prime cause of the post-generation stall (#3402). One scan of
 * the swipes table + a Set of the wanted ids is O(totalSwipes) instead.
 */
async function countSwipesByMessageId(db: DB, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const wanted = new Set(ids);
  const rows = await db.select({ messageId: messageSwipes.messageId }).from(messageSwipes);
  for (const row of rows) {
    if (wanted.has(row.messageId)) {
      counts.set(row.messageId, (counts.get(row.messageId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Create the chat storage facade used by routes and importers. */
export function createChatsStorage(db: DB) {
  let chatLastMessageAtBackfilled = false;
  let chatLastMessageAtBackfillPromise: Promise<void> | null = null;

  async function hasGameDeletePayload(chatId: string): Promise<boolean> {
    const existingMessage = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .limit(1);
    if (existingMessage.length > 0) return true;
    const existingSnapshot = await db
      .select({ id: gameStateSnapshots.id })
      .from(gameStateSnapshots)
      .where(eq(gameStateSnapshots.chatId, chatId))
      .limit(1);
    if (existingSnapshot.length > 0) return true;
    const existingCheckpoint = await db
      .select({ id: gameCheckpoints.id })
      .from(gameCheckpoints)
      .where(eq(gameCheckpoints.chatId, chatId))
      .limit(1);
    if (existingCheckpoint.length > 0) return true;
    const existingImage = await db
      .select({ id: chatImages.id })
      .from(chatImages)
      .where(eq(chatImages.chatId, chatId))
      .limit(1);
    if (existingImage.length > 0) return true;
    const existingVideo = await db
      .select({ id: gameSceneVideos.id })
      .from(gameSceneVideos)
      .where(eq(gameSceneVideos.chatId, chatId))
      .limit(1);
    if (existingVideo.length > 0) return true;
    const existingStoryboard = await db
      .select({ id: gameTurnStoryboards.id })
      .from(gameTurnStoryboards)
      .where(eq(gameTurnStoryboards.chatId, chatId))
      .limit(1);
    return existingStoryboard.length > 0;
  }

  async function isProtectedGameDeleteTarget(chat: {
    id: string;
    mode: string | null;
    metadata: unknown;
  }): Promise<boolean> {
    if (chat.mode !== "game") return false;
    const meta = parseMetadata(chat.metadata);
    const hasGameId = typeof meta.gameId === "string" && meta.gameId.trim().length > 0;
    return hasGameId || (await hasGameDeletePayload(chat.id));
  }

  async function checkDeleteTargets(
    rows: Array<{ id: string; mode: string | null; metadata: unknown }>,
    options: { force?: boolean },
    reason: string,
  ): Promise<ChatDeleteGuardResult> {
    if (options.force) return { allowed: true };
    for (const chat of rows) {
      if (await isProtectedGameDeleteTarget(chat)) {
        return { allowed: false, reason };
      }
    }
    return { allowed: true };
  }

  async function deleteGameStateForMessages(messageIds: string[]) {
    const ids = Array.from(new Set(messageIds.filter(Boolean)));
    if (ids.length === 0) return;

    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const snapshots = await db
        .select({ id: gameStateSnapshots.id })
        .from(gameStateSnapshots)
        .where(inArray(gameStateSnapshots.messageId, chunk));
      const snapshotIds = snapshots.map((row) => row.id).filter(Boolean);

      for (let j = 0; j < snapshotIds.length; j += CHUNK) {
        const snapshotChunk = snapshotIds.slice(j, j + CHUNK);
        await db.delete(gameCheckpoints).where(inArray(gameCheckpoints.snapshotId, snapshotChunk));
      }
      await db.delete(gameCheckpoints).where(inArray(gameCheckpoints.messageId, chunk));
      await db.delete(gameStateSnapshots).where(inArray(gameStateSnapshots.messageId, chunk));
      await db.delete(spatialContextSnapshots).where(inArray(spatialContextSnapshots.messageId, chunk));
      await db.delete(gameEngineState).where(inArray(gameEngineState.messageId, chunk));
    }
  }

  async function readLatestMessageAt(chatId: string): Promise<string | null> {
    const rows = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    return rows[0]?.createdAt ?? null;
  }

  async function refreshChatLastMessageAt(chatId: string): Promise<string | null> {
    const lastMessageAt = await readLatestMessageAt(chatId);
    await db.update(chats).set({ lastMessageAt }).where(eq(chats.id, chatId));
    return lastMessageAt;
  }

  async function ensureChatLastMessageAtBackfilled() {
    if (chatLastMessageAtBackfilled) return;
    chatLastMessageAtBackfillPromise ??= (async () => {
      const chatRows = await db.select({ id: chats.id, lastMessageAt: chats.lastMessageAt }).from(chats);
      const missingChatIds = new Set(
        chatRows
          .filter((chat) => !isUsableTimestamp(chat.lastMessageAt))
          .map((chat) => chat.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      );
      if (missingChatIds.size === 0) {
        chatLastMessageAtBackfilled = true;
        return;
      }

      const latestByChat = new Map<string, string>();
      const messageRows = await db
        .select({ chatId: messages.chatId, createdAt: messages.createdAt })
        .from(messages)
        .orderBy(desc(messages.createdAt));
      for (const row of messageRows) {
        if (!missingChatIds.has(row.chatId) || latestByChat.has(row.chatId)) continue;
        latestByChat.set(row.chatId, row.createdAt);
        if (latestByChat.size === missingChatIds.size) break;
      }

      for (const [chatId, lastMessageAt] of latestByChat) {
        await db.update(chats).set({ lastMessageAt }).where(eq(chats.id, chatId));
      }
      chatLastMessageAtBackfilled = true;
    })().finally(() => {
      chatLastMessageAtBackfillPromise = null;
    });
    await chatLastMessageAtBackfillPromise;
  }

  /**
   * Read the character-owned schedules for `characterIds`, skipping any that are
   * stale for `scheduleNow`. The character card is the single source of truth;
   * chats only cache a resolved copy in `metadata.characterSchedules`.
   */
  async function collectFreshConversationSchedules(
    characterIds: string[],
    scheduleNow: Date,
  ): Promise<CharacterSchedules> {
    const wanted = Array.from(new Set(characterIds));
    const freshSchedules: CharacterSchedules = {};
    if (wanted.length === 0) return freshSchedules;

    const rows = await db.select().from(characters).where(inArray(characters.id, wanted));
    for (const row of rows) {
      const schedule = readCharacterSchedule(row.data);
      if (!schedule || scheduleNeedsRefresh(schedule, scheduleNow)) continue;
      freshSchedules[row.id] = schedule;
    }

    return freshSchedules;
  }

  /**
   * Legacy hoist: chats used to own `characterSchedules`. Copy any chat-cached
   * schedule up to a character that has none yet, so pre-existing routines
   * survive the move to character-owned storage. One-way and idempotent.
   */
  async function hoistLegacyChatSchedules(
    cachedSchedules: CharacterSchedules,
    activeCharacterIds: readonly string[],
  ): Promise<boolean> {
    const activeIds = new Set(activeCharacterIds);
    const characterIds = Object.keys(cachedSchedules).filter((characterId) => activeIds.has(characterId));
    if (characterIds.length === 0) return false;

    let hoisted = false;
    for (const characterId of characterIds) {
      const schedule = cachedSchedules[characterId];
      if (!isValidLegacySchedule(schedule)) continue;
      const didHoist = await db.transaction(async (tx) => {
        const rows = await tx.select().from(characters).where(eq(characters.id, characterId));
        const row = rows[0];
        if (!row || readCardExtension(row.data, "conversationSchedule") !== undefined) return false;
        const nextData = writeCardExtension(row.data, "conversationSchedule", schedule);
        if (!nextData) return false;
        await tx.update(characters).set({ data: nextData }).where(eq(characters.id, characterId));
        return true;
      });
      hoisted ||= didHoist;
    }
    return hoisted;
  }

  /**
   * Legacy hoist for manual presence overrides, which used to be chat-scoped.
   * Only fills a card that has never carried an override, so a cleared override
   * (`null` on the card) is not resurrected by a stale chat cache.
   */
  async function hoistLegacyChatOverrides(
    cachedOverrides: unknown,
    activeCharacterIds: readonly string[],
  ): Promise<void> {
    if (!isPlainRecord(cachedOverrides)) return;
    const activeIds = new Set(activeCharacterIds);
    const characterIds = Object.keys(cachedOverrides).filter((characterId) => activeIds.has(characterId));
    if (characterIds.length === 0) return;

    for (const characterId of characterIds) {
      const override = cachedOverrides[characterId];
      if (!isValidLegacyStatusOverride(override)) continue;
      await db.transaction(async (tx) => {
        const rows = await tx.select().from(characters).where(eq(characters.id, characterId));
        const row = rows[0];
        if (!row || readCardExtension(row.data, "conversationStatusOverride") !== undefined) return;
        const nextData = writeCardExtension(row.data, "conversationStatusOverride", override);
        if (!nextData) return;
        await tx.update(characters).set({ data: nextData }).where(eq(characters.id, characterId));
      });
    }
  }

  async function collectConversationPresence(
    characterIds: string[],
    scheduleNow: Date,
  ): Promise<{ schedules: CharacterSchedules; overrides: Record<string, ConversationStatusOverride | null> }> {
    const wanted = Array.from(new Set(characterIds));
    const schedules: CharacterSchedules = {};
    const overrides: Record<string, ConversationStatusOverride | null> = {};
    if (wanted.length === 0) return { schedules, overrides };
    const rows = await db.select().from(characters).where(inArray(characters.id, wanted));
    for (const row of rows) {
      const schedule = readCharacterSchedule(row.data);
      if (schedule && !scheduleNeedsRefresh(schedule, scheduleNow)) schedules[row.id] = schedule;
      overrides[row.id] = readCharacterStatusOverride(row.data);
    }
    return { schedules, overrides };
  }

  async function cleanupChatGallery(chatId: string): Promise<void> {
    const chatGalleryFiles = await db
      .select({ filePath: chatImages.filePath })
      .from(chatImages)
      .where(eq(chatImages.chatId, chatId));

    await db.delete(chatImages).where(eq(chatImages.chatId, chatId));
    for (const image of chatGalleryFiles) {
      await unlinkGalleryFileIfUnreferenced({ db, filePath: image.filePath });
    }

    const localPathPrefix = `${chatId}/`;
    const hasSharedLocalFile = (
      await Promise.all(
        chatGalleryFiles
          .filter((image) => image.filePath.replace(/\\/g, "/").startsWith(localPathPrefix))
          .map((image) => galleryFileHasReferences(db, image.filePath)),
      )
    ).some(Boolean);
    const galleryDir = join(GALLERY_DIR, chatId);
    if (!hasSharedLocalFile && existsSync(galleryDir)) rmSync(galleryDir, { recursive: true, force: true });
  }

  async function removeChatDatabaseRecords(database: DB, chatId: string): Promise<string[]> {
    await database.delete(agentRuns).where(eq(agentRuns.chatId, chatId));
    await database.delete(agentMemory).where(eq(agentMemory.chatId, chatId));
    await database.delete(gameCheckpoints).where(eq(gameCheckpoints.chatId, chatId));
    await database.delete(gameStateSnapshots).where(eq(gameStateSnapshots.chatId, chatId));
    await database.delete(spatialContextSnapshots).where(eq(spatialContextSnapshots.chatId, chatId));
    await database.delete(gameEngineState).where(eq(gameEngineState.chatId, chatId));
    await database.delete(conversationCallMessages).where(eq(conversationCallMessages.chatId, chatId));
    await database.delete(conversationCallSessions).where(eq(conversationCallSessions.chatId, chatId));
    const storyboards = await database
      .select({ id: gameTurnStoryboards.id })
      .from(gameTurnStoryboards)
      .where(eq(gameTurnStoryboards.chatId, chatId));
    for (const storyboard of storyboards) {
      await database
        .delete(gameTurnStoryboardKeyframes)
        .where(eq(gameTurnStoryboardKeyframes.storyboardId, storyboard.id));
    }
    await database.delete(gameTurnStoryboards).where(eq(gameTurnStoryboards.chatId, chatId));
    await database.delete(gameSceneVideos).where(eq(gameSceneVideos.chatId, chatId));
    const galleryFiles = await database
      .select({ filePath: chatImages.filePath })
      .from(chatImages)
      .where(eq(chatImages.chatId, chatId));
    await database.delete(chatImages).where(eq(chatImages.chatId, chatId));
    await database.delete(chats).where(eq(chats.id, chatId));
    return galleryFiles.map((image) => image.filePath);
  }

  async function cleanupDeletedChatFiles(chatId: string, galleryFilePaths: string[]): Promise<void> {
    for (const filePath of galleryFilePaths) {
      try {
        await unlinkGalleryFileIfUnreferenced({ db, filePath });
      } catch (error) {
        logger.warn(error, "Failed to remove gallery file after deleting chat %s", chatId);
      }
    }

    const localPathPrefix = `${chatId}/`;
    const hasSharedLocalFile = (
      await Promise.all(
        galleryFilePaths
          .filter((filePath) => filePath.replace(/\\/g, "/").startsWith(localPathPrefix))
          .map(async (filePath) => {
            try {
              return await galleryFileHasReferences(db, filePath);
            } catch (error) {
              logger.warn(error, "Failed to check gallery references after deleting chat %s", chatId);
              return true;
            }
          }),
      )
    ).some(Boolean);
    const directories = [
      ...(hasSharedLocalFile ? [] : [join(GALLERY_DIR, chatId)]),
      join(GAME_SCENE_VIDEOS_DIR, chatId),
    ];
    for (const directory of directories) {
      if (!existsSync(directory)) continue;
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch (error) {
        logger.warn(error, "Failed to remove files after deleting chat %s", chatId);
      }
    }
  }

  return {
    async list() {
      await ensureChatLastMessageAtBackfilled();
      return db.select().from(chats).orderBy(desc(chats.updatedAt));
    },

    async listRecent(limit: number, offset = 0) {
      return db
        .select()
        .from(chats)
        .orderBy(desc(chats.updatedAt), desc(chats.id))
        .offset(Math.max(0, Math.floor(offset)))
        .limit(Math.max(1, Math.min(100, Math.floor(limit))));
    },

    async getById(id: string) {
      const rows = await db.select().from(chats).where(eq(chats.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateChatInput, timestampOverrides?: TimestampOverrides | null) {
      const id = newId();
      const timestamp = resolveTimestamps(timestampOverrides);
      const recentConversation =
        input.mode === "conversation"
          ? (
              await db
                .select({ metadata: chats.metadata })
                .from(chats)
                .where(eq(chats.mode, "conversation"))
                .orderBy(desc(chats.updatedAt))
                .limit(1)
            )[0]
          : undefined;
      const conversationTimeZone = recentConversation
        ? resolveConversationTimeZone(parseMetadata(recentConversation.metadata))
        : undefined;
      const inheritedSchedules =
        input.mode === "conversation"
          ? await collectFreshConversationSchedules(
              input.characterIds,
              toZonedWallClockDate(new Date(), conversationTimeZone),
            )
          : {};
      const metadata: MetadataPatch = {
        summary: null,
        tags: [],
        enableAgents: true,
        agentOverrides: {},
        activeAgentIds: [],
        activeToolIds: [],
      };
      if (hasConversationSchedules(inheritedSchedules)) {
        metadata.conversationSchedulesEnabled = true;
        metadata.characterSchedules = inheritedSchedules;
        const scheduleWeekStart = firstScheduleWeekStart(inheritedSchedules);
        if (scheduleWeekStart) metadata.scheduleWeekStart = scheduleWeekStart;
      }
      if (conversationTimeZone) metadata.conversationTimeZone = conversationTimeZone;
      await db.insert(chats).values({
        id,
        name: input.name,
        mode: input.mode,
        characterIds: JSON.stringify(input.characterIds),
        groupId: input.groupId ?? null,
        personaId: input.personaId,
        promptPresetId: input.promptPresetId,
        connectionId: input.connectionId,
        metadata: JSON.stringify(metadata),
        lastMessageAt: null,
        createdAt: timestamp.createdAt,
        updatedAt: timestamp.updatedAt,
      });
      return this.getById(id);
    },

    /**
     * Resolve this chat's presence state from the character cards, which own
     * both the schedule and the manual status override, and refresh the chat's
     * cached copies. Overrides resolve even when this chat has schedules
     * switched off — the opt-out is about routines, not manual availability.
     */
    async resolveConversationPresenceState(id: string): Promise<ConversationPresenceState> {
      const chat = await this.getById(id);
      if (!chat || chat.mode !== "conversation") return { schedules: {}, statusOverrides: {} };

      const meta = parseMetadata(chat.metadata);
      const characterIds = parseCharacterIds(chat.characterIds);

      // Hoist before the opt-in gate, so a chat that is switched off does not
      // strand the only copy of a pre-existing schedule in its metadata.
      if (hasConversationSchedules(meta.characterSchedules)) {
        await hoistLegacyChatSchedules(meta.characterSchedules, characterIds);
      }
      if (isPlainRecord(meta.conversationStatusOverrides) && Object.keys(meta.conversationStatusOverrides).length > 0) {
        await hoistLegacyChatOverrides(meta.conversationStatusOverrides, characterIds);
      }

      const presence = await collectConversationPresence(
        characterIds,
        toZonedWallClockDate(new Date(), resolveConversationTimeZone(meta)),
      );
      const cardOverrides = presence.overrides;
      const statusOverrides: Record<string, ConversationStatusOverride> = {};
      for (const [characterId, override] of Object.entries(cardOverrides)) {
        if (override) statusOverrides[characterId] = override;
      }
      const cachedOverrides = isPlainRecord(meta.conversationStatusOverrides)
        ? Object.fromEntries(Object.entries(meta.conversationStatusOverrides).filter(([, value]) => value != null))
        : {};
      if (!sameOverrides(cachedOverrides, statusOverrides)) {
        const staleKeys = isPlainRecord(meta.conversationStatusOverrides)
          ? Object.keys(meta.conversationStatusOverrides).filter((key) => !(key in cardOverrides))
          : [];
        await this.patchMetadata(
          id,
          {
            conversationStatusOverrides: {
              ...cardOverrides,
              ...Object.fromEntries(staleKeys.map((key) => [key, null])),
            },
          },
          { touchUpdatedAt: false },
        );
      }

      const schedules = await this.resolveConversationSchedules(id);
      return { schedules, statusOverrides };
    },

    /** Schedule half of {@link resolveConversationPresenceState}. */
    async resolveConversationSchedules(id: string): Promise<CharacterSchedules> {
      const chat = await this.getById(id);
      if (!chat || chat.mode !== "conversation") return {};

      const meta = parseMetadata(chat.metadata);
      if (!areConversationSchedulesEnabled(meta)) return {};

      const characterIds = parseCharacterIds(chat.characterIds);
      const currentSchedules = hasConversationSchedules(meta.characterSchedules) ? meta.characterSchedules : {};
      const scheduleNow = toZonedWallClockDate(new Date(), resolveConversationTimeZone(meta));

      // The character card is the source of truth; the chat map is a cache that
      // can be stale or hold a schedule the character has since replaced.
      const freshSchedules = await collectFreshConversationSchedules(characterIds, scheduleNow);
      const nextSchedules: CharacterSchedules = {};
      for (const characterId of characterIds) {
        const schedule = freshSchedules[characterId];
        if (schedule) nextSchedules[characterId] = schedule;
      }
      if (sameSchedules(currentSchedules, nextSchedules)) return currentSchedules;
      if (!hasConversationSchedules(nextSchedules)) {
        await this.patchMetadata(id, { characterSchedules: {}, scheduleWeekStart: null }, { touchUpdatedAt: false });
        return {};
      }
      const scheduleWeekStart = firstScheduleWeekStart(nextSchedules);
      await this.patchMetadata(
        id,
        {
          characterSchedules: nextSchedules,
          ...(scheduleWeekStart ? { scheduleWeekStart } : {}),
        },
        { touchUpdatedAt: false },
      );

      return nextSchedules;
    },

    async update(
      id: string,
      data: Partial<CreateChatInput> & { folderId?: string | null; sortOrder?: number },
      opts?: { tx?: Pick<DB, "select" | "update"> },
    ) {
      const conn = opts?.tx ?? db;
      await conn
        .update(chats)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.mode !== undefined && { mode: data.mode }),
          ...(data.characterIds !== undefined && { characterIds: JSON.stringify(data.characterIds) }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.personaId !== undefined && { personaId: data.personaId }),
          ...(data.promptPresetId !== undefined && { promptPresetId: data.promptPresetId }),
          ...(data.connectionId !== undefined && { connectionId: data.connectionId }),
          ...(data.folderId !== undefined && { folderId: data.folderId }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          updatedAt: now(),
        })
        .where(eq(chats.id, id));
      // Caller-level read; uses outer db so it reads committed state when no
      // tx is in flight, or the in-flight tx state when one is provided.
      const rows = await conn.select().from(chats).where(eq(chats.id, id));
      return rows[0] ?? null;
    },

    async touch(id: string, opts?: { tx?: Pick<DB, "select" | "update"> }) {
      const conn = opts?.tx ?? db;
      await conn.update(chats).set({ updatedAt: now() }).where(eq(chats.id, id));
      const rows = await conn.select().from(chats).where(eq(chats.id, id));
      return rows[0] ?? null;
    },

    /**
     * Set the folder assignment for a chat, propagating to every branch that
     * shares its groupId. The sidebar collapses each group to a single visible
     * row whose folder is read from whichever branch is currently the
     * representative — so when one branch is created or deleted and the rep
     * shifts, every branch must already carry the same folderId or the whole
     * tree falls back to Uncategorized.
     *
     * Sibling branches are updated without bumping updatedAt so categorizing
     * a chat doesn't silently reorder its branch history.
     */
    async setFolderForChat(chatId: string, folderId: string | null, opts?: { tx?: Pick<DB, "select" | "update"> }) {
      const conn = opts?.tx ?? db;
      const rows = await conn.select().from(chats).where(eq(chats.id, chatId));
      const chat = rows[0];
      if (!chat) return null;
      if (chat.groupId) {
        await conn.update(chats).set({ folderId }).where(eq(chats.groupId, chat.groupId));
        await conn.update(chats).set({ updatedAt: now() }).where(eq(chats.id, chatId));
      } else {
        await conn.update(chats).set({ folderId, updatedAt: now() }).where(eq(chats.id, chatId));
      }
      const updated = await conn.select().from(chats).where(eq(chats.id, chatId));
      return updated[0] ?? null;
    },

    /** List all chats belonging to a group. */
    async listByGroup(groupId: string) {
      await ensureChatLastMessageAtBackfilled();
      return db.select().from(chats).where(eq(chats.groupId, groupId)).orderBy(desc(chats.updatedAt));
    },

    async canDeleteChat(id: string, options: { force?: boolean } = {}): Promise<ChatDeleteGuardResult> {
      const rows = await db
        .select({ id: chats.id, mode: chats.mode, metadata: chats.metadata })
        .from(chats)
        .where(eq(chats.id, id))
        .limit(1);
      return checkDeleteTargets(
        rows,
        options,
        "Refusing to hard-delete a game campaign without explicit confirmation.",
      );
    },

    async canDeleteGroup(groupId: string, options: { force?: boolean } = {}): Promise<ChatDeleteGuardResult> {
      const rows = await db
        .select({ id: chats.id, mode: chats.mode, metadata: chats.metadata })
        .from(chats)
        .where(eq(chats.groupId, groupId));
      return checkDeleteTargets(
        rows,
        options,
        "Refusing to hard-delete a game campaign group without explicit confirmation.",
      );
    },

    /**
     * Whole-blob metadata replace, outside the patch queue and NOT write-ordinal stamped (#5406).
     *
     * What makes that safe is scope, not innocence: most live callers pass
     * `{ ...freshMeta, changedKey }` and genuinely do change a key, so "a verbatim rewrite is not
     * a new value" is simply false here. A key written through this path keeps whatever ordinal
     * it already had and therefore reads as OLDER than it is. That is tolerable only because
     * every key a capability package can order against is reachable solely through the chat
     * metadata PATCH route, which goes through `patchMetadata`.
     *
     * The rule that follows: a key that becomes package-ordered must never be written here. Move
     * the write to `patchMetadata` rather than adding a caller on this path.
     *
     * The capability persistence host (`updateChatMetadata` / `updateChatActivity` in
     * capability-persistence.service.ts) writes whole metadata blobs the same unstamped way and
     * is in the same category — it carries the mirror through untouched rather than restamping.
     */
    async updateMetadata(id: string, metadata: Record<string, unknown>) {
      await db
        .update(chats)
        .set({ metadata: JSON.stringify(metadata), updatedAt: now() })
        .where(eq(chats.id, id));
      return this.getById(id);
    },

    /**
     * Allocate the chat's next write ordinal (#5406) — the shared sequence behind both
     * `game_engine_state.writeOrdinal` and `metadata.metadataWriteOrdinals`. Returns null only
     * when the chat no longer exists.
     *
     * The read-and-bump runs inside the per-chat metadata patch queue so it serializes against
     * every other allocation, including the ones `patchMetadata` performs inline. Callers that
     * already hold that queue MUST pass `metadataQueueHeld` — the queue is not reentrant.
     * Callers holding a different per-chat lock (the experience-state write lock) may call this
     * directly: the lock order is always their-lock -> metadata-queue, never the reverse.
     *
     * The counter alone is not the floor: the metadata mirror can carry ordinals the counter
     * never handed out (a blob moved in by a branch, a session carry, a restore), so this reads
     * both and allocates above whichever is higher — see {@link writeOrdinalFloor}.
     */
    async allocateWriteOrdinal(id: string, opts: { metadataQueueHeld?: boolean } = {}): Promise<number | null> {
      const allocate = async () => {
        const [row] = await db
          .select({ writeOrdinalCounter: chats.writeOrdinalCounter, metadata: chats.metadata })
          .from(chats)
          .where(eq(chats.id, id));
        if (!row) return null;
        const ordinal = nextWriteOrdinal(row.writeOrdinalCounter, parseMetadata(row.metadata));
        // Counter only — allocating an ordinal is not a user-visible chat edit, so it must not
        // reorder the chat list the way a touched updatedAt would.
        await db.update(chats).set({ writeOrdinalCounter: ordinal }).where(eq(chats.id, id));
        return ordinal;
      };
      return opts.metadataQueueHeld ? allocate() : withChatMetadataPatchQueue(id, allocate);
    },

    /**
     * Raise a chat's write-ordinal counter to at least `floor`, never lowering it (#5406).
     * Chat branching copies the source chat's metadata verbatim — mirror included — and its
     * engine rows with their ordinals, so the branch must also inherit a counter above all of
     * them, or its first allocation would sit below the values it just copied and invert the
     * ordering for the branch's whole life. Idempotent.
     *
     * Like its siblings this runs inside the per-chat metadata patch queue, so a caller that
     * already holds the queue MUST pass `metadataQueueHeld` — the queue is not reentrant and
     * would otherwise deadlock silently.
     */
    async raiseWriteOrdinalFloor(
      id: string,
      floor: number | null | undefined,
      opts: { metadataQueueHeld?: boolean } = {},
    ): Promise<void> {
      if (typeof floor !== "number" || !Number.isSafeInteger(floor) || floor <= 0) return;
      const raise = async () => {
        const [row] = await db
          .select({ writeOrdinalCounter: chats.writeOrdinalCounter })
          .from(chats)
          .where(eq(chats.id, id));
        if (!row) return;
        const current = row.writeOrdinalCounter;
        if (typeof current === "number" && current >= floor) return;
        await db.update(chats).set({ writeOrdinalCounter: floor }).where(eq(chats.id, id));
      };
      if (opts.metadataQueueHeld) await raise();
      else await withChatMetadataPatchQueue(id, raise);
    },

    async patchMetadata(
      id: string,
      patchOrUpdater: MetadataPatch | MetadataUpdater,
      opts: { touchUpdatedAt?: boolean; metadataQueueHeld?: boolean } = {},
    ) {
      const applyPatch = async () => {
        const existing = await this.getById(id);
        if (!existing) return null;

        const current = parseMetadata(existing.metadata);
        // #5406: fingerprint BEFORE the updater runs. `{ ...current }` is a shallow copy, so an
        // updater that mutates a nested value in place mutates `current`'s value too and the
        // post-hoc comparison would see two identical objects and skip the stamp.
        const before = typeof patchOrUpdater === "function" ? fingerprintMetadata(current) : null;
        const raw = typeof patchOrUpdater === "function" ? await patchOrUpdater({ ...current }) : patchOrUpdater;
        const patch = stripOrdinalMirrorKey(raw);
        const merged = mergeMetadataPatch(current, patch);
        // #5406: allocate inline rather than through allocateWriteOrdinal — the queue is
        // already held here, and folding the counter into the same row update makes the stamp
        // and the counter bump one atomic write, so a crash can never leave a mirror entry
        // whose ordinal the counter never advanced past.
        const stamp = stampMetadataWriteOrdinals(existing.writeOrdinalCounter, current, merged, patch, before);
        applyOrdinalStamp(merged, stamp);

        await db
          .update(chats)
          .set({
            metadata: JSON.stringify(merged),
            ...(stamp && { writeOrdinalCounter: stamp.ordinal }),
            ...(opts.touchUpdatedAt !== false && { updatedAt: now() }),
          })
          .where(eq(chats.id, id));
        return this.getById(id);
      };
      return opts.metadataQueueHeld ? applyPatch() : withChatMetadataPatchQueue(id, applyPatch);
    },

    /**
     * Patch metadata and the denormalized `characterIds` column together inside a single per-chat
     * critical section. Both columns are written in one row update under the same metadata patch queue
     * as `patchMetadata`, so a concurrent metadata-queued writer can neither interleave between the two
     * writes nor leave `characterIds` reflecting an older party than the queued-final metadata. The
     * updater receives the fresh metadata and returns the metadata patch plus the `characterIds` array
     * to mirror; the reloaded chat returned reflects both writes. Used by the game party handlers.
     */
    async patchMetadataWithCharacterIds(
      id: string,
      updater: (
        current: MetadataPatch,
      ) =>
        | { metadata: MetadataPatch; characterIds: string[] }
        | Promise<{ metadata: MetadataPatch; characterIds: string[] }>,
      opts: { touchUpdatedAt?: boolean } = {},
    ) {
      return withChatMetadataPatchQueue(id, async () => {
        const existing = await this.getById(id);
        if (!existing) return null;

        const current = parseMetadata(existing.metadata);
        const before = fingerprintMetadata(current);
        const { metadata: raw, characterIds } = await updater({ ...current });
        const patch = stripOrdinalMirrorKey(raw);
        const merged = mergeMetadataPatch(current, patch);
        const stamp = stampMetadataWriteOrdinals(existing.writeOrdinalCounter, current, merged, patch, before);
        applyOrdinalStamp(merged, stamp);

        await db
          .update(chats)
          .set({
            metadata: JSON.stringify(merged),
            characterIds: JSON.stringify(characterIds),
            ...(stamp && { writeOrdinalCounter: stamp.ordinal }),
            ...(opts.touchUpdatedAt !== false && { updatedAt: now() }),
          })
          .where(eq(chats.id, id));
        return this.getById(id);
      });
    },

    async markAutonomousUnread(id: string, input?: { characterId?: string | null; count?: number }) {
      const timestamp = now();
      return this.patchMetadata(id, (current) => {
        const increment = Math.max(1, Math.floor(input?.count ?? 1));
        const currentCount = readUnreadCount(current.autonomousUnreadCount);
        const characterIds = new Set(readCharacterIds(current.autonomousUnreadCharacterIds));
        if (input?.characterId) characterIds.add(input.characterId);

        return {
          ...current,
          autonomousUnreadCount: currentCount + increment,
          autonomousUnreadCharacterIds: Array.from(characterIds),
          autonomousUnreadAt: timestamp,
        };
      });
    },

    async clearAutonomousUnread(id: string) {
      return this.patchMetadata(
        id,
        (current) => {
          if (
            current.autonomousUnreadCount === undefined &&
            current.autonomousUnreadCharacterIds === undefined &&
            current.autonomousUnreadAt === undefined
          ) {
            return current;
          }

          return {
            autonomousUnreadCount: undefined,
            autonomousUnreadCharacterIds: undefined,
            autonomousUnreadAt: undefined,
          };
        },
        { touchUpdatedAt: false },
      );
    },

    async removeLorebookFromChatMetadata(lorebookId: string) {
      const allChats = await this.list();
      for (const chat of allChats) {
        const metadata = parseMetadata(chat.metadata);
        if (!Array.isArray(metadata.activeLorebookIds)) continue;

        const nextActiveLorebookIds = metadata.activeLorebookIds.filter((id) => id !== lorebookId);
        if (nextActiveLorebookIds.length === metadata.activeLorebookIds.length) continue;

        await this.patchMetadata(chat.id, (current) => {
          const currentLorebookIds = Array.isArray(current.activeLorebookIds) ? current.activeLorebookIds : [];
          return {
            activeLorebookIds: currentLorebookIds.filter((id) => id !== lorebookId),
          };
        });
      }
    },

    async remove(id: string) {
      const galleryFilePaths = await db.transaction((tx) => removeChatDatabaseRecords(tx, id));
      await cleanupDeletedChatFiles(id, galleryFilePaths);
    },

    /** Atomically remove a marked Roleplay DM thread only while it is still empty. */
    async removeEmptyRoleplayDmChat(id: string): Promise<boolean> {
      const galleryFilePaths = await db.transaction(async (tx) => {
        const rows = await tx.select().from(chats).where(eq(chats.id, id)).limit(1);
        const chat = rows[0];
        if (!chat) return null;
        const metadata = parseMetadata(chat.metadata);
        if (metadata.roleplayDmThread !== true && typeof metadata.dmOriginChatId !== "string") return null;
        const existingMessages = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.chatId, id))
          .limit(1);
        if (existingMessages.length > 0) return null;
        return removeChatDatabaseRecords(tx, id);
      });
      if (!galleryFilePaths) return false;
      await cleanupDeletedChatFiles(id, galleryFilePaths);
      return true;
    },

    /** Delete all chats in a group (all branches). */
    async removeGroup(groupId: string) {
      // Find all chat IDs in this group, then clean up their data
      const groupChats = await db.select({ id: chats.id }).from(chats).where(eq(chats.groupId, groupId));
      for (const chat of groupChats) {
        await db.delete(agentRuns).where(eq(agentRuns.chatId, chat.id));
        await db.delete(agentMemory).where(eq(agentMemory.chatId, chat.id));
        await db.delete(gameCheckpoints).where(eq(gameCheckpoints.chatId, chat.id));
        await db.delete(gameStateSnapshots).where(eq(gameStateSnapshots.chatId, chat.id));
        await db.delete(spatialContextSnapshots).where(eq(spatialContextSnapshots.chatId, chat.id));
        await db.delete(gameEngineState).where(eq(gameEngineState.chatId, chat.id));
        await db.delete(conversationCallMessages).where(eq(conversationCallMessages.chatId, chat.id));
        await db.delete(conversationCallSessions).where(eq(conversationCallSessions.chatId, chat.id));
        const storyboards = await db
          .select({ id: gameTurnStoryboards.id })
          .from(gameTurnStoryboards)
          .where(eq(gameTurnStoryboards.chatId, chat.id));
        for (const storyboard of storyboards) {
          await db
            .delete(gameTurnStoryboardKeyframes)
            .where(eq(gameTurnStoryboardKeyframes.storyboardId, storyboard.id));
        }
        await db.delete(gameTurnStoryboards).where(eq(gameTurnStoryboards.chatId, chat.id));
        await db.delete(gameSceneVideos).where(eq(gameSceneVideos.chatId, chat.id));
        await cleanupChatGallery(chat.id);
        const videoDir = join(GAME_SCENE_VIDEOS_DIR, chat.id);
        if (existsSync(videoDir)) rmSync(videoDir, { recursive: true, force: true });
      }

      await db.delete(chats).where(eq(chats.groupId, groupId));
    },

    // ── Messages ──

    async lastContactByCharacter(chatId: string): Promise<Record<string, string>> {
      // Aggregate in JS because the file-native query builder intentionally
      // exposes only row selection, filtering, ordering, and pagination.
      // created_at is a TEXT (ISO) column, so lexicographic `>` is chronological.
      const rows = await db
        .select({
          characterId: messages.characterId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), isNotNull(messages.characterId)));
      const result: Record<string, string> = {};
      for (const row of rows) {
        const characterId = row.characterId;
        const createdAt = row.createdAt;
        if (!characterId || !createdAt) continue;
        if (!result[characterId] || createdAt > result[characterId]) {
          result[characterId] = createdAt;
        }
      }
      return result;
    },

    async countMessages(chatId: string): Promise<number> {
      return db.count(messages, eq(messages.chatId, chatId));
    },

    async hasGameDeletePayload(chatId: string): Promise<boolean> {
      return hasGameDeletePayload(chatId);
    },

    async listMessages(chatId: string) {
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(messages.createdAt, messages.id);
      const decorated = rows.map((m, index) => ({ ...m, rowid: index + 1 }));
      const countMap = await countSwipesByMessageId(
        db,
        decorated.map((m) => m.id),
      );
      return decorated.map((m) => ({ ...m, swipeCount: countMap.get(m.id) ?? 0 }));
    },

    /** Paginated: returns the latest `limit` messages (optionally before a cursor). */
    async listMessagesPaginated(chatId: string, limit: number, before?: string) {
      const cursor = parseMessageCursor(before);
      if (before && !cursor) throw new InvalidMessageCursorError();
      return db.transaction(async (tx) => {
        const chatCondition = eq(messages.chatId, chatId);
        const cursorBoundary = cursor
          ? or(
              lt(messages.createdAt, cursor.createdAt),
              and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
            )
          : undefined;
        if (
          cursor &&
          tx.count(
            messages,
            and(chatCondition, eq(messages.createdAt, cursor.createdAt), eq(messages.id, cursor.id)),
          ) !== 1
        ) {
          throw new InvalidMessageCursorError();
        }
        const pageCondition = cursorBoundary ? and(chatCondition, cursorBoundary) : chatCondition;
        const upperRowid = cursorBoundary ? tx.count(messages, pageCondition) : tx.count(messages, chatCondition);
        const rowsDescending = await tx
          .select()
          .from(messages)
          .where(pageCondition)
          .orderBy(desc(messages.createdAt), desc(messages.id))
          .limit(Math.max(1, Math.floor(limit)));
        const reversed = rowsDescending.reverse().map((message, index) => ({
          ...message,
          rowid: upperRowid - rowsDescending.length + index + 1,
        }));
        const countMap = await countSwipesByMessageId(
          tx,
          reversed.map((m) => m.id),
        );
        return reversed.map((m) => ({ ...m, swipeCount: countMap.get(m.id) ?? 0 }));
      });
    },

    /** Bounded message snapshots for surfaces that do not need cursors or swipe metadata. */
    async listMessagePreviews(chatId: string, limit: number) {
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, chatId),
            ne(messages.role, "system"),
            stringIsNonBlank(messages.content),
            jsonFlagsNotTrue(messages.extra, ["hiddenFromUser", "commandOnly"]),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(Math.max(1, Math.floor(limit)));
      return rows.reverse();
    },

    async getMessage(id: string) {
      const rows = await db.select().from(messages).where(eq(messages.id, id));
      return rows[0] ?? null;
    },

    async createMessage(input: CreateMessageInput, timestampOverrides?: TimestampOverrides | null) {
      const id = newId();
      const resolvedTimestamp = resolveTimestamps(timestampOverrides).createdAt;
      const explicitTimestamp = normalizeTimestampOverrides(timestampOverrides)?.createdAt;
      const chatRows = await db
        .select({ lastMessageAt: chats.lastMessageAt })
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .limit(1);
      const timestamp = explicitTimestamp
        ? resolvedTimestamp
        : ensureTimestampAfter(resolvedTimestamp, chatRows[0]?.lastMessageAt);
      await db.insert(messages).values({
        id,
        chatId: input.chatId,
        role: input.role,
        characterId: input.characterId,
        content: input.content,
        activeSwipeIndex: 0,
        extra: JSON.stringify({
          ...parseExtraRecord(input.extra),
          displayText: null,
          isGenerated: input.role !== "user",
          tokenCount: null,
          generationInfo: null,
        }),
        createdAt: timestamp,
      });
      // Create the initial swipe (index 0)
      await db.insert(messageSwipes).values({
        id: newId(),
        messageId: id,
        index: 0,
        content: input.content,
        extra: JSON.stringify(parseExtraRecord(input.extra)),
        createdAt: timestamp,
      });
      await db.update(chats).set({ lastMessageAt: timestamp, updatedAt: timestamp }).where(eq(chats.id, input.chatId));
      return this.getMessage(id);
    },

    /**
     * Bulk-insert messages in a single transaction. Much faster than one-by-one
     * createMessage calls (especially on Windows/NTFS where each transaction fsync is expensive).
     *
     * Callers may pass `createdAt`, message `extra`, `activeSwipeIndex`,
     * and either the first swipe's `swipeExtra` or the full `swipes` list
     * when cloning/importing existing transcripts so attachments, persona
     * snapshots, hidden context flags, alternate swipes, and original
     * timestamps survive the copy.
     *
     * Returns the created message IDs in input order and updates chat.updatedAt once after the batch.
     */
    async createMessagesBatch(
      chatId: string,
      inputs: Array<
        Omit<CreateMessageInput, "chatId"> & {
          createdAt?: string | null;
          extra?: unknown;
          activeSwipeIndex?: number;
          swipeExtra?: unknown;
          swipes?: Array<{
            index: number;
            content: string;
            extra?: unknown;
            createdAt?: string | null;
          }>;
        }
      >,
      timestampOverrides?: TimestampOverrides | null,
    ) {
      if (inputs.length === 0) return [];
      const msgRows: (typeof messages.$inferInsert)[] = [];
      const swipeRows: (typeof messageSwipes.$inferInsert)[] = [];
      const createdIds: string[] = [];
      const batchTimestamps = resolveTimestamps(timestampOverrides);
      const baseTime = Date.parse(batchTimestamps.createdAt);
      const safeBaseTime = Number.isNaN(baseTime) ? Date.now() : baseTime;
      const createdTimestamps: string[] = [];

      for (let idx = 0; idx < inputs.length; idx++) {
        const input = inputs[idx]!;
        const id = newId();
        createdIds.push(id);
        const explicitTimestamp = normalizeTimestampOverrides({
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        })?.createdAt;
        const timestamp = explicitTimestamp ?? new Date(safeBaseTime + idx).toISOString();
        createdTimestamps.push(timestamp);
        msgRows.push({
          id,
          chatId,
          role: input.role,
          characterId: input.characterId,
          content: input.content,
          activeSwipeIndex: input.activeSwipeIndex ?? 0,
          extra: serializeJsonField(input.extra, {
            displayText: null,
            isGenerated: input.role !== "user",
            tokenCount: null,
            generationInfo: null,
          }),
          createdAt: timestamp,
        });
        const inputSwipes = input.swipes?.length
          ? [...input.swipes].sort((a, b) => a.index - b.index)
          : [
              {
                index: 0,
                content: input.content,
                extra: input.swipeExtra,
                createdAt: timestamp,
              },
            ];
        for (const swipe of inputSwipes) {
          swipeRows.push({
            id: newId(),
            messageId: id,
            index: swipe.index,
            content: swipe.content,
            extra: serializeJsonField(swipe.extra, {}),
            createdAt: normalizeTimestampOverrides({ createdAt: swipe.createdAt })?.createdAt ?? timestamp,
          });
        }
      }

      const lastTimestamp = latestTrustedTimestamp(createdTimestamps) ?? batchTimestamps.updatedAt;

      // Batch large imports to bound the amount of work performed per write.
      const CHUNK = 500;
      for (let i = 0; i < msgRows.length; i += CHUNK) {
        await db.insert(messages).values(msgRows.slice(i, i + CHUNK));
      }
      for (let i = 0; i < swipeRows.length; i += CHUNK) {
        await db.insert(messageSwipes).values(swipeRows.slice(i, i + CHUNK));
      }
      await db
        .update(chats)
        .set({ lastMessageAt: lastTimestamp, updatedAt: lastTimestamp })
        .where(eq(chats.id, chatId));
      return createdIds;
    },

    async updateMessageContent(id: string, content: string) {
      return withPatchQueue(messageExtraPatchQueues, id, async () => {
        const existing = await this.getMessage(id);

        // Conversation-mode prompt history prefers `conversationCommandContent` (the raw
        // reply before command stripping) over `content`, so a rewrite of the visible text
        // must also drop the stale raw copy or the edit never reaches the model. Command-only
        // anchors keep theirs: their `content` is empty by design and the raw copy is the
        // message's only text. Written directly rather than via updateMessageExtra, which
        // shares this queue key and would deadlock.
        const existingExtra = parseExtraRecord(existing?.extra);
        const clearCommandContent =
          typeof existingExtra.conversationCommandContent === "string" &&
          existingExtra.conversationCommandContent.trim() !== "" &&
          existingExtra.commandOnly !== true &&
          content !== (existing?.content ?? "");

        const messagePatch: Record<string, unknown> = { content };
        if (clearCommandContent) {
          messagePatch.extra = JSON.stringify({ ...existingExtra, conversationCommandContent: null });
        }
        await db.update(messages).set(messagePatch).where(eq(messages.id, id));
        if (existing) {
          await invalidateMemoryChunksFrom(db, existing.chatId, existing.createdAt);
        }
        // Also sync the edit to the active swipe row so it persists across swipe switches.
        const msg = await this.getMessage(id);
        if (msg) {
          const swipes = await this.getSwipes(id);
          const activeSwipe = swipes.find((s: any) => s.index === msg.activeSwipeIndex);
          if (activeSwipe) {
            const swipePatch: Record<string, unknown> = { content };
            if (clearCommandContent) {
              const swipeExtra = parseExtraRecord(activeSwipe.extra);
              // Clear only a raw copy this swipe itself carries, and never a
              // command-only carrier's.
              if (
                typeof swipeExtra.conversationCommandContent === "string" &&
                swipeExtra.conversationCommandContent.trim() !== "" &&
                swipeExtra.commandOnly !== true
              ) {
                swipePatch.extra = JSON.stringify({ ...swipeExtra, conversationCommandContent: null });
              }
            }
            await db.update(messageSwipes).set(swipePatch).where(eq(messageSwipes.id, activeSwipe.id));
          }
        }
        return msg;
      });
    },

    /** Merge partial data into a message's extra JSON field. */
    async updateMessageExtra(id: string, partial: Record<string, unknown>) {
      return withPatchQueue(messageExtraPatchQueues, id, async () => {
        const msg = await this.getMessage(id);
        if (!msg) return null;
        const existing = parseExtraRecord(msg.extra);
        const merged = { ...existing, ...partial };
        await db
          .update(messages)
          .set({ extra: JSON.stringify(merged) })
          .where(eq(messages.id, id));

        const swipes = await this.getSwipes(id);
        const activeSwipe = swipes.find((s: any) => s.index === msg.activeSwipeIndex);
        if (activeSwipe) {
          const swipeExtra = parseExtraRecord(activeSwipe.extra);
          await db
            .update(messageSwipes)
            .set({ extra: JSON.stringify({ ...swipeExtra, ...partial }) })
            .where(eq(messageSwipes.id, activeSwipe.id));
        }

        return this.getMessage(id);
      });
    },

    /** Merge partial data into a specific swipe and mirror it to the message only if that swipe is active. */
    async updateMessageExtraForSwipe(id: string, swipeIndex: number, partial: Record<string, unknown>) {
      return withPatchQueue(messageExtraPatchQueues, id, async () => {
        const msg = await this.getMessage(id);
        if (!msg) return null;
        const swipes = await this.getSwipes(id);
        const targetSwipe = swipes.find((s: any) => s.index === swipeIndex);
        if (!targetSwipe) return null;

        const swipeExtra = parseExtraRecord(targetSwipe.extra);
        await db
          .update(messageSwipes)
          .set({ extra: JSON.stringify({ ...swipeExtra, ...partial }) })
          .where(eq(messageSwipes.id, targetSwipe.id));

        if (msg.activeSwipeIndex === swipeIndex) {
          const msgExtra = parseExtraRecord(msg.extra);
          await db
            .update(messages)
            .set({ extra: JSON.stringify({ ...msgExtra, ...partial }) })
            .where(eq(messages.id, id));
        }

        return this.getMessage(id);
      });
    },

    /** Atomically claim a marker in one swipe's extra data. */
    async claimMessageExtraForSwipe(id: string, swipeIndex: number, key: string, value: unknown) {
      return withMessageExtraPatchQueue(id, async () => {
        const msg = await this.getMessage(id);
        if (!msg) return false;
        const swipes = await this.getSwipes(id);
        const targetSwipe = swipes.find((swipe: any) => swipe.index === swipeIndex);
        if (!targetSwipe) return false;
        const swipeExtra = parseExtraRecord(targetSwipe.extra);
        if (swipeExtra[key] && typeof swipeExtra[key] === "object") return false;
        await db
          .update(messageSwipes)
          .set({ extra: JSON.stringify({ ...swipeExtra, [key]: value }) })
          .where(eq(messageSwipes.id, targetSwipe.id));
        if (msg.activeSwipeIndex === swipeIndex) {
          const messageExtra = parseExtraRecord(msg.extra);
          await db
            .update(messages)
            .set({ extra: JSON.stringify({ ...messageExtra, [key]: value }) })
            .where(eq(messages.id, id));
        }
        return true;
      });
    },

    /**
     * Bulk-set hiddenFromAI on many messages at once.
     * Reuses updateMessageExtra() for each message (read-parse-merge-write) and
     * syncs the flag to every swipe row so it survives setActiveSwipe() overwrites.
     *
     * Returns the ids this call actually flipped INTO the target state — the
     * messages whose hidden flag, read immediately before the write (no provider
     * or network call in between), differed from `hidden`. Callers that record
     * ownership of a hide (e.g. a summary entry's `hiddenMessageIds`) use this
     * return so ownership is sourced from the mutation itself, never from a stale
     * pre-mutation snapshot. The request is scoped to this chat; use `.length` for
     * a count of changed messages.
     */
    async bulkSetHiddenFromAI(chatId: string, messageIds: string[], hidden: boolean): Promise<string[]> {
      if (messageIds.length === 0) return [];
      const uniqueIds = Array.from(new Set(messageIds));
      const scopedRows: { id: string; extra: string | null }[] = [];
      const CHUNK = 500;
      for (let i = 0; i < uniqueIds.length; i += CHUNK) {
        const batch = uniqueIds.slice(i, i + CHUNK);
        const batchRows = await db
          .select({ id: messages.id, extra: messages.extra })
          .from(messages)
          .where(and(eq(messages.chatId, chatId), inArray(messages.id, batch)));
        scopedRows.push(...batchRows);
      }

      const seen = new Set<string>();
      const flipped: string[] = [];
      try {
        for (const row of scopedRows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          // State read immediately before the write — the moment-of-mutation truth
          // that decides whether THIS call flips the message into the target state.
          let wasHidden = false;
          try {
            const parsed = typeof row.extra === "string" ? JSON.parse(row.extra) : (row.extra ?? {});
            wasHidden = (parsed as { hiddenFromAI?: unknown } | null)?.hiddenFromAI === true;
          } catch {
            wasHidden = false;
          }
          await this.updateMessageExtra(row.id, { hiddenFromAI: hidden });
          // Mirror what the single-message /extra route does: propagate the flag to
          // all swipe rows so setActiveSwipe() cannot clobber it. Done for every
          // scoped row (idempotent when already in the target state) so swipe
          // consistency never depends on whether the main row happened to flip.
          const swipes = await this.getSwipes(row.id);
          for (const swipe of swipes) {
            await this.updateSwipeExtra(row.id, swipe.index, { hiddenFromAI: hidden });
          }
          if (wasHidden !== hidden) flipped.push(row.id);
        }
      } catch (err) {
        // A write failed partway through. The rows we did not reach are untouched,
        // and rows already in the target state were never flipped, so the only
        // partial state is the `flipped` set. Undo exactly those so the call is
        // all-or-nothing and a caller never records ownership of a half-applied
        // batch. (db.transaction() is intentionally avoided in this store — see the
        // bounded bulk-insert path above — so this
        // compensating undo is the atomicity mechanism.) A clean undo preserves
        // the original error. A failed undo is surfaced as a compound failure so
        // callers never mistake a partially restored batch for a clean rollback.
        const undoErrors: unknown[] = [];
        for (const id of flipped) {
          try {
            await this.updateMessageExtra(id, { hiddenFromAI: !hidden });
            const swipes = await this.getSwipes(id);
            for (const swipe of swipes) {
              await this.updateSwipeExtra(id, swipe.index, { hiddenFromAI: !hidden });
            }
          } catch (undoErr) {
            undoErrors.push(undoErr);
            logger.error(undoErr, "bulkSetHiddenFromAI: failed to undo partial hide for message %s", id);
          }
        }
        if (undoErrors.length > 0) {
          throw new AggregateError(
            [err, ...undoErrors],
            `bulkSetHiddenFromAI failed and rollback failed for ${undoErrors.length} of ${flipped.length} flipped messages`,
          );
        }
        throw err;
      }
      return flipped;
    },

    /** Atomically append an attachment to a message's extra JSON field. */
    async appendMessageAttachment(id: string, attachment: Record<string, unknown>) {
      return withPatchQueue(messageExtraPatchQueues, id, async () => {
        const msg = await this.getMessage(id);
        if (!msg) return null;
        const existing = parseExtraRecord(msg.extra);
        const attachments = Array.isArray(existing.attachments) ? existing.attachments : [];
        const merged = { ...existing, attachments: [...attachments, attachment] };
        await db
          .update(messages)
          .set({ extra: JSON.stringify(merged) })
          .where(eq(messages.id, id));
        return this.getMessage(id);
      });
    },

    /** Append an attachment to the message mirror only when the expected swipe is still active. */
    async appendMessageAttachmentForActiveSwipe(id: string, swipeIndex: number, attachment: Record<string, unknown>) {
      return withPatchQueue(messageExtraPatchQueues, id, async () => {
        const msg = await this.getMessage(id);
        if (!msg || (msg.activeSwipeIndex ?? 0) !== swipeIndex) return null;
        const existing = parseExtraRecord(msg.extra);
        const attachments = Array.isArray(existing.attachments) ? existing.attachments : [];
        const merged = { ...existing, attachments: [...attachments, attachment] };
        await db
          .update(messages)
          .set({ extra: JSON.stringify(merged) })
          .where(and(eq(messages.id, id), eq(messages.activeSwipeIndex, swipeIndex)));
        const next = await this.getMessage(id);
        return next && (next.activeSwipeIndex ?? 0) === swipeIndex ? next : null;
      });
    },

    async removeMessage(id: string) {
      const existing = await this.getMessage(id);
      if (existing) await deleteGameStateForMessages([id]);
      await db.delete(messages).where(eq(messages.id, id));
      if (existing) {
        await invalidateMemoryChunksFrom(db, existing.chatId, existing.createdAt);
        await refreshChatLastMessageAt(existing.chatId);
      }
    },

    async removeMessages(ids: string[], chatId?: string) {
      if (ids.length === 0) return;
      const earliestByChat = new Map<string, string>();
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const condition = chatId
          ? and(inArray(messages.id, chunk), eq(messages.chatId, chatId))
          : inArray(messages.id, chunk);
        const existingRows = await db
          .select({ id: messages.id, chatId: messages.chatId, createdAt: messages.createdAt })
          .from(messages)
          .where(condition);
        for (const row of existingRows) {
          const current = earliestByChat.get(row.chatId);
          if (!current || row.createdAt < current) earliestByChat.set(row.chatId, row.createdAt);
        }
        await deleteGameStateForMessages(existingRows.map((row) => row.id));
        await db.delete(messages).where(condition);
      }
      for (const [affectedChatId, createdAt] of earliestByChat) {
        await invalidateMemoryChunksFrom(db, affectedChatId, createdAt);
        await refreshChatLastMessageAt(affectedChatId);
      }
    },

    async getSwipes(messageId: string) {
      return db.select().from(messageSwipes).where(eq(messageSwipes.messageId, messageId)).orderBy(messageSwipes.index);
    },

    /**
     * Read swipe rows for a message set with one linear file-store scan.
     * The file-native store scans the table for `inArray` too, where membership
     * is O(ids) per row; chunking that query would also rescan the table.
     */
    async listSwipesByMessageIds(messageIds: string[]) {
      if (messageIds.length === 0) return [];
      const wanted = new Set(messageIds);
      const rows = await db.select().from(messageSwipes);
      return rows.filter((row) => wanted.has(row.messageId));
    },

    async addSwipe(messageId: string, content: string, silent?: boolean) {
      return withPatchQueue(messageExtraPatchQueues, messageId, async () => {
        const existing = await this.getSwipes(messageId);
        const nextIndex = existing.length;
        const msg = await this.getMessage(messageId);
        const retainedExtra = msg ? freshSwipeMessageExtra(msg.extra) : {};

        // Backfill: save current message extra onto the currently-active swipe
        // so its thinking/generationInfo isn't lost when we switch away
        // (skip when silent — greeting swipes don't need backfill)
        if (!silent && msg) {
          const msgExtra = parseExtraRecord(msg.extra);
          const activeSwipe = existing.find((s: any) => s.index === msg.activeSwipeIndex);
          if (activeSwipe) {
            await db
              .update(messageSwipes)
              .set({ extra: JSON.stringify(msgExtra) })
              .where(eq(messageSwipes.id, activeSwipe.id));
          }
        }

        const id = newId();
        await db.insert(messageSwipes).values({
          id,
          messageId,
          index: nextIndex,
          content,
          extra: JSON.stringify(retainedExtra),
          createdAt: now(),
        });

        // When silent, only insert the swipe row without switching the active index.
        if (!silent) {
          // Set active swipe to the new one and reset message extra for the fresh swipe.
          await db
            .update(messages)
            .set({ activeSwipeIndex: nextIndex, content, extra: JSON.stringify(retainedExtra) })
            .where(eq(messages.id, messageId));
          if (msg) {
            await invalidateMemoryChunksFrom(db, msg.chatId, msg.createdAt);
          }
        }
        return { id, index: nextIndex };
      });
    },

    async setActiveSwipe(messageId: string, index: number) {
      return withPatchQueue(messageExtraPatchQueues, messageId, async () => {
        const swipes = await this.getSwipes(messageId);
        const target = swipes.find((s: any) => s.index === index);
        if (!target) return null;

        // Before switching, save current message content and extra onto the outgoing swipe.
        const msg = await this.getMessage(messageId);
        if (msg) {
          const msgExtra = parseExtraRecord(msg.extra);
          const outgoingSwipe = swipes.find((s: any) => s.index === msg.activeSwipeIndex);
          if (outgoingSwipe) {
            await db
              .update(messageSwipes)
              .set({ content: msg.content, extra: JSON.stringify(msgExtra) })
              .where(eq(messageSwipes.id, outgoingSwipe.id));
          }
        }

        // Sync the target swipe's extra onto the message.
        const swipeExtra = parseExtraRecord(target.extra);
        await db
          .update(messages)
          .set({
            activeSwipeIndex: index,
            content: target.content,
            extra: JSON.stringify(swipeExtra),
          })
          .where(eq(messages.id, messageId));
        if (msg) {
          await invalidateMemoryChunksFrom(db, msg.chatId, msg.createdAt);
        }
        return this.getMessage(messageId);
      });
    },

    async removeSwipe(messageId: string, index: number) {
      return withPatchQueue(messageExtraPatchQueues, messageId, async () => {
        const msg = await this.getMessage(messageId);
        if (!msg) return null;

        const swipes = await this.getSwipes(messageId);
        const target = swipes.find((s: any) => s.index === index);
        if (!target || swipes.length <= 1) return null;

        const remaining = swipes.filter((s: any) => s.index !== index);
        const currentExtra = parseExtraRecord(msg.extra);

        const activeSwipeRemoved = msg.activeSwipeIndex === index;
        let nextActiveSwipeIndex = msg.activeSwipeIndex;
        let nextContent = msg.content;
        let nextExtra = currentExtra;

        if (msg.activeSwipeIndex > index) {
          nextActiveSwipeIndex = msg.activeSwipeIndex - 1;
        } else if (msg.activeSwipeIndex === index) {
          nextActiveSwipeIndex = Math.min(index, remaining.length - 1);
          const replacement = remaining[index] ?? remaining[remaining.length - 1];
          if (replacement) {
            nextContent = replacement.content;
            nextExtra = parseExtraRecord(replacement.extra);
          }
        }

        await db.delete(messageSwipes).where(eq(messageSwipes.id, target.id));
        await db
          .delete(gameStateSnapshots)
          .where(and(eq(gameStateSnapshots.messageId, messageId), eq(gameStateSnapshots.swipeIndex, index)));
        await db
          .delete(spatialContextSnapshots)
          .where(and(eq(spatialContextSnapshots.messageId, messageId), eq(spatialContextSnapshots.swipeIndex, index)));

        const swipesToShift = await db
          .select()
          .from(messageSwipes)
          .where(and(eq(messageSwipes.messageId, messageId), gt(messageSwipes.index, index)));
        for (const swipe of swipesToShift) {
          await db
            .update(messageSwipes)
            .set({ index: swipe.index - 1 })
            .where(eq(messageSwipes.id, swipe.id));
        }

        const snapshotsToShift = await db
          .select()
          .from(gameStateSnapshots)
          .where(and(eq(gameStateSnapshots.messageId, messageId), gt(gameStateSnapshots.swipeIndex, index)));
        for (const snapshot of snapshotsToShift) {
          await db
            .update(gameStateSnapshots)
            .set({ swipeIndex: snapshot.swipeIndex - 1 })
            .where(eq(gameStateSnapshots.id, snapshot.id));
        }

        const spatialSnapshotsToShift = await db
          .select()
          .from(spatialContextSnapshots)
          .where(and(eq(spatialContextSnapshots.messageId, messageId), gt(spatialContextSnapshots.swipeIndex, index)));
        for (const snapshot of spatialSnapshotsToShift) {
          await db
            .update(spatialContextSnapshots)
            .set({ swipeIndex: snapshot.swipeIndex - 1 })
            .where(eq(spatialContextSnapshots.id, snapshot.id));
        }

        // Mirror the prune for turn-game (UNO) snapshots so anchors stay aligned
        // with the message's swipes after one is removed.
        await db
          .delete(gameEngineState)
          .where(and(eq(gameEngineState.messageId, messageId), eq(gameEngineState.swipeIndex, index)));
        const engineSnapshotsToShift = await db
          .select()
          .from(gameEngineState)
          .where(and(eq(gameEngineState.messageId, messageId), gt(gameEngineState.swipeIndex, index)));
        for (const snapshot of engineSnapshotsToShift) {
          await db
            .update(gameEngineState)
            .set({ swipeIndex: snapshot.swipeIndex - 1 })
            .where(eq(gameEngineState.id, snapshot.id));
        }

        await db
          .update(messages)
          .set({
            activeSwipeIndex: nextActiveSwipeIndex,
            content: nextContent,
            extra: JSON.stringify(nextExtra),
          })
          .where(eq(messages.id, messageId));
        if (activeSwipeRemoved) {
          await invalidateMemoryChunksFrom(db, msg.chatId, msg.createdAt);
        }

        return this.getMessage(messageId);
      });
    },

    /** Merge partial data into a swipe's extra JSON field. */
    async updateSwipeExtra(messageId: string, swipeIndex: number, partial: Record<string, unknown>) {
      return withPatchQueue(swipeExtraPatchQueues, `${messageId}:${swipeIndex}`, async () => {
        const swipes = await this.getSwipes(messageId);
        const target = swipes.find((s: any) => s.index === swipeIndex);
        if (!target) return;
        const existing = typeof target.extra === "string" ? JSON.parse(target.extra) : (target.extra ?? {});
        const merged = { ...existing, ...partial };
        await db
          .update(messageSwipes)
          .set({ extra: JSON.stringify(merged) })
          .where(eq(messageSwipes.id, target.id));
      });
    },

    /** Atomically append an attachment to a swipe's extra JSON field. */
    async appendSwipeAttachment(messageId: string, swipeIndex: number, attachment: Record<string, unknown>) {
      return withPatchQueue(swipeExtraPatchQueues, `${messageId}:${swipeIndex}`, async () => {
        const swipes = await this.getSwipes(messageId);
        const target = swipes.find((s: any) => s.index === swipeIndex);
        if (!target) return;
        const existing = typeof target.extra === "string" ? JSON.parse(target.extra) : (target.extra ?? {});
        const attachments = Array.isArray(existing.attachments) ? existing.attachments : [];
        const merged = { ...existing, attachments: [...attachments, attachment] };
        await db
          .update(messageSwipes)
          .set({ extra: JSON.stringify(merged) })
          .where(eq(messageSwipes.id, target.id));
      });
    },

    // ── Chat Connections ──

    /** Bidirectionally link two chats. */
    async connectChats(chatIdA: string, chatIdB: string) {
      const timestamp = now();
      await db.update(chats).set({ connectedChatId: chatIdB, updatedAt: timestamp }).where(eq(chats.id, chatIdA));
      await db.update(chats).set({ connectedChatId: chatIdA, updatedAt: timestamp }).where(eq(chats.id, chatIdB));
    },

    /** Remove the bidirectional link for a chat (and its partner). */
    async disconnectChat(chatId: string) {
      const chat = await this.getById(chatId);
      if (!chat) return;
      const parsed = typeof chat.connectedChatId === "string" ? chat.connectedChatId : null;
      const timestamp = now();
      await db.update(chats).set({ connectedChatId: null, updatedAt: timestamp }).where(eq(chats.id, chatId));
      if (parsed) {
        await db.update(chats).set({ connectedChatId: null, updatedAt: timestamp }).where(eq(chats.id, parsed));
      }
    },

    // ── OOC Influences ──

    /** Create a queued influence from a conversation → its connected roleplay. */
    async createInfluence(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string) {
      const id = newId();
      await db.insert(oocInfluences).values({
        id,
        sourceChatId,
        targetChatId,
        content,
        anchorMessageId: anchorMessageId ?? null,
        consumed: "false",
        createdAt: now(),
      });
      return id;
    },

    /** Get all unconsumed influences targeting a chat. */
    async listPendingInfluences(targetChatId: string) {
      return db
        .select()
        .from(oocInfluences)
        .where(and(eq(oocInfluences.targetChatId, targetChatId), eq(oocInfluences.consumed, "false")))
        .orderBy(oocInfluences.createdAt);
    },

    /** Mark an influence as consumed after it's been injected. */
    async markInfluenceConsumed(id: string) {
      await db.update(oocInfluences).set({ consumed: "true" }).where(eq(oocInfluences.id, id));
    },

    /** Delete all influences associated with a chat (as source or target). */
    async deleteInfluencesForChat(chatId: string) {
      await db.delete(oocInfluences).where(eq(oocInfluences.sourceChatId, chatId));
      await db.delete(oocInfluences).where(eq(oocInfluences.targetChatId, chatId));
    },

    // ── Conversation Notes ──

    /** Create a durable note from a conversation → its connected roleplay, then prune oldest past the char budget. */
    async createNote(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string) {
      const id = newId();
      await db.insert(conversationNotes).values({
        id,
        sourceChatId,
        targetChatId,
        content,
        anchorMessageId: anchorMessageId ?? null,
        createdAt: now(),
      });

      const all = await db
        .select()
        .from(conversationNotes)
        .where(eq(conversationNotes.targetChatId, targetChatId))
        .orderBy(desc(conversationNotes.createdAt), desc(conversationNotes.id));

      const toDelete: string[] = [];
      let total = 0;
      for (let i = 0; i < all.length; i++) {
        total += all[i]!.content.length;
        // Always keep the newest note even if it alone exceeds the budget.
        if (i > 0 && total > CONVERSATION_NOTES_BUDGET_CHARS) {
          toDelete.push(all[i]!.id);
        }
      }
      if (toDelete.length > 0) {
        await db.delete(conversationNotes).where(inArray(conversationNotes.id, toDelete));
      }

      return id;
    },

    /** List all durable notes targeting a chat, oldest first (for stable prompt ordering).
     *  `id` secondary sort gives deterministic ordering when timestamps tie (e.g. multiple
     *  `<note>` tags emitted in a single character response within one millisecond). */
    async listNotes(targetChatId: string) {
      return db
        .select()
        .from(conversationNotes)
        .where(eq(conversationNotes.targetChatId, targetChatId))
        .orderBy(conversationNotes.createdAt, conversationNotes.id);
    },

    /** Delete a single note by id, scoped to its target chat. */
    async deleteNoteForChat(targetChatId: string, id: string) {
      await db
        .delete(conversationNotes)
        .where(and(eq(conversationNotes.targetChatId, targetChatId), eq(conversationNotes.id, id)));
    },

    /** Clear every note targeting a chat. */
    async clearNotes(targetChatId: string) {
      await db.delete(conversationNotes).where(eq(conversationNotes.targetChatId, targetChatId));
    },

    /** Delete all notes associated with a chat (as source or target). */
    async deleteNotesForChat(chatId: string) {
      await db.delete(conversationNotes).where(eq(conversationNotes.sourceChatId, chatId));
      await db.delete(conversationNotes).where(eq(conversationNotes.targetChatId, chatId));
    },
  };
}
