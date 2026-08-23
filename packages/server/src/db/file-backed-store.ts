// ──────────────────────────────────────────────
// File-Native Storage
// ──────────────────────────────────────────────
//
// Marinara stores user data as JSON table snapshots under DATA_DIR/storage.
// This in-memory table store persists dirty tables back to those files.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readdirSync,
  readFileSync,
  realpathSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { chmod, copyFile, open, rename, unlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { hostname, networkInterfaces } from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import { STORAGE_MIGRATION_NOTICE_SETTINGS_KEY, type StorageMigrationNotice } from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { getFileStorageDir } from "../config/runtime-config.js";
import * as schema from "./schema/index.js";
import { inArray, isFileCondition, isFileOrdering, type FileCondition, type FileOrdering } from "./file-query.js";
import { migrateLegacyNoodleAccountRow } from "./noodle-platform-migration.js";
import { migrateLegacyNoodlePostAccessRow } from "./noodle-access-migration.js";
import { migrateRetiredChatModeRow, RETIRED_CHAT_MODE_TABLES } from "./retired-chat-mode-migration.js";
import {
  getFileTableConfig,
  FileUniqueConstraintError,
  isFileColumn,
  isFileTable,
  type AnyFileColumn,
  type AnyFileTable,
  type FileColumnValue,
} from "./file-schema.js";

type Row = any;
type Table = AnyFileTable;
type Column = AnyFileColumn;
type Projection = Record<string, unknown>;
type Condition = FileCondition | undefined;
type Ordering = FileOrdering | Column;
type ProjectedRow<TProjection extends Projection> = {
  [TKey in keyof TProjection]: FileColumnValue<TProjection[TKey]>;
};

type ColumnMeta = {
  key: string;
  dbName: string;
  column: Column;
  primary: boolean;
  hasDefault: boolean;
  defaultValue: unknown;
};

type TableMeta = {
  name: string;
  table: Table;
  columns: ColumnMeta[];
  byKey: Map<string, ColumnMeta>;
  byDbName: Map<string, ColumnMeta>;
  primaryKey: string | null;
  uniqueConstraints: Array<{ keys: string[]; when?: (row: Row) => boolean }>;
};

type RowContext = {
  rows: Record<string, Row>;
  baseTable: string;
  joined: boolean;
};

type JoinSpec = {
  table: TableMeta;
  condition: Condition;
};

type TableSnapshotManifest = {
  version: number;
  savedAt: string;
  backend: "file-native";
  tables: Record<string, number>;
  /** Shard-file count per sharded table — human diagnostics only, never read back. */
  shards?: Record<string, number>;
};

type StorageWriterLeaseRecord = {
  version: 1 | 2 | 3;
  pid: number;
  hostId: string | null;
  scopeId?: string;
  hostname: string;
  token: string;
  acquiredAt: string;
};

type WriterLeaseLiveness = { server: Server; sockets: Set<Socket>; scopeId: string };
type ActiveStorageWriterLease = { path: string; token: string; liveness: WriterLeaseLiveness | null };

type FileTransactionContext = {
  snapshots: Map<string, Row[]>;
  dirtyTables: Set<string>;
  /** Shard keys written during this transaction, for the durable-rollback re-add (#4708). */
  dirtyShards: Map<string, Set<string>>;
  flushed: boolean;
};

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

function hardenPrivateStorageTree(rootDir: string) {
  if (process.platform === "win32") return;
  const pending = [rootDir];
  const failures: Error[] = [];
  const applyPrivateMode = (path: string, mode: number) => {
    try {
      if ((statSync(path).mode & 0o077) !== 0) chmodSync(path, mode);
      if ((statSync(path).mode & 0o077) !== 0) throw new Error("group or other permission bits remain set");
    } catch (error) {
      try {
        if ((statSync(path).mode & 0o077) === 0) return;
      } catch {
        // Retain the original permission failure below.
      }
      failures.push(new Error(`Could not apply private permissions to ${path}`, { cause: error }));
    }
  };
  while (pending.length > 0) {
    const current = pending.pop()!;
    applyPrivateMode(current, PRIVATE_DIRECTORY_MODE);
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      failures.push(new Error(`Could not inspect storage directory ${current}`, { cause: error }));
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() || (entry.isSocket() && path === writerLeaseLivenessPath(writerLeasePath(rootDir)))) {
        applyPrivateMode(path, PRIVATE_FILE_MODE);
      } else failures.push(new Error(`Storage contains an unsupported filesystem entry: ${path}`));
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "[file-storage] Private storage permissions could not be established");
  }
}

export type QuarantinedStorageTable = {
  table: string;
  files: Array<{
    from: string;
    to: string;
  }>;
};

export type FileNativeStoreController = {
  flush: () => Promise<void>;
  close: () => Promise<void>;
  rootDir: string;
  getQuarantinedTables: () => QuarantinedStorageTable[];
  /**
   * Monotonic per-table write counter (#4705): bumped on every markDirty, so
   * pollers can skip work when a table hasn't changed since their last look.
   * Deliberately NOT rolled back on transaction rollback — a spurious wake is
   * safe, a missed one is not. 0 = never written in this process.
   */
  getTableWriteGeneration: (table: string) => number;
};

export type FileNativeDB = {
  select: {
    (): SelectFromBuilder<undefined>;
    <TProjection extends Projection>(projection: TProjection): SelectFromBuilder<TProjection>;
  };
  count: (table: Table, condition?: Condition) => number;
  insert: (table: Table) => InsertBuilder;
  update: (table: Table) => UpdateSetBuilder;
  delete: (table: Table) => DeleteBuilder;
  transaction: <T>(fn: (tx: FileNativeDB) => Promise<T> | T) => Promise<T>;
  _fileStore: FileNativeStoreController;
};

export type FileNativeStoreTestHooks = {
  beforeTableWrite?: (table: string, serializedRows: string) => Promise<void> | void;
  writerLeaseScopeId?: string;
};

type SelectFromBuilder<TProjection extends Projection | undefined> = {
  from: <TTable extends Table>(
    table: TTable,
  ) => SelectQueryBuilder<TProjection extends Projection ? ProjectedRow<TProjection> : TTable["$inferSelect"]>;
};

type SelectQueryBuilder<TResult> = PromiseLike<TResult[]> & {
  innerJoin: (table: Table, condition: Condition) => SelectQueryBuilder<any>;
  where: (condition: Condition) => SelectQueryBuilder<TResult>;
  orderBy: (...orderings: Ordering[]) => SelectQueryBuilder<TResult>;
  limit: (limit: number) => SelectQueryBuilder<TResult>;
  offset: (offset: number) => SelectQueryBuilder<TResult>;
  run: () => Promise<TResult[]>;
};

type InsertBuilder = {
  values: (rows: Row | Row[]) => InsertValuesBuilder;
};

type UpdateSetBuilder = {
  set: (patch: Row) => UpdateWhereBuilder;
};

type UpdateWhereBuilder = Executable<void> & {
  where: (condition: Condition) => Executable<void>;
};

type DeleteBuilder = Executable<void> & {
  where: (condition: Condition) => Executable<void>;
};

type Executable<T> = PromiseLike<T> & {
  run: () => Promise<T>;
  catch: Promise<T>["catch"];
  finally: Promise<T>["finally"];
};

type InsertValuesBuilder = Executable<void> & {
  onConflictDoUpdate: (config: { target: unknown; set: Row }) => Executable<void>;
};

// Exported so regressions can pin behavior against the CURRENT version
// without chasing literals on every bump. Must equal root storage-format.json
// (the launcher-format-guard regression pins the pairing).
export const STORAGE_VERSION = 5;
export const STORAGE_WRITER_LEASE_FILENAME = ".writer-lease";
export const STORAGE_WRITER_OWNER_FILENAME = "owner.json";
export const STORAGE_WRITER_LIVENESS_FILENAME = "live.sock";
const SAVE_DEBOUNCE_MS = 750;
const SAFETY_SAVE_MS = 10_000;

export const FILE_BACKED_TABLES = [
  "chats",
  "messages",
  "message_swipes",
  "conversation_call_sessions",
  "conversation_call_messages",
  "conversation_call_sounds",
  "characters",
  "character_card_versions",
  "personas",
  "persona_card_versions",
  "character_groups",
  "persona_groups",
  "noodle_accounts",
  "noodle_posts",
  "noodle_account_subscriptions",
  "noodle_post_unlocks",
  "noodle_interactions",
  "noodler_creator_reply_claims",
  "noodler_prepared_posts",
  "noodler_automatic_attempts",
  "noodler_reserve_state",
  "noodler_fan_activity_state",
  "noodle_activity_digests",
  "noodle_refresh_runs",
  "slurp_accounts",
  "slurp_posts",
  "slurp_account_subscriptions",
  "slurp_post_unlocks",
  "slurp_interactions",
  "slurp_creator_reply_claims",
  "slurp_prepared_posts",
  "slurp_automatic_attempts",
  "slurp_reserve_state",
  "slurp_fan_activity_state",
  "slurp_activity_digests",
  "slurp_refresh_runs",
  "lorebooks",
  "lorebook_character_links",
  "lorebook_persona_links",
  "lorebook_folders",
  "lorebook_entries",
  "prompt_presets",
  "prompt_groups",
  "prompt_sections",
  "choice_blocks",
  "api_connections",
  "assets",
  "agent_configs",
  "agent_runs",
  "agent_memory",
  "custom_tools",
  "game_state_snapshots",
  "spatial_context_snapshots",
  "capability_documents",
  "game_engine_state",
  "game_checkpoints",
  "game_scene_videos",
  "game_turn_storyboards",
  "game_turn_storyboard_keyframes",
  "regex_scripts",
  "chat_images",
  "character_images",
  "persona_images",
  "gallery_folders",
  "global_images",
  "custom_emojis",
  "custom_stickers",
  "ooc_influences",
  "conversation_notes",
  "memory_chunks",
  "chat_folders",
  "api_connection_folders",
  "custom_themes",
  "app_settings",
  "achievement_unlocks",
  "chat_presets",
  "prompt_overrides",
  "installed_extensions",
  "library_folders",
  "mari_instructions",
  "mari_workspace_context",
] as const;

type FileBackedTable = (typeof FILE_BACKED_TABLES)[number];

// #5302: every file-backed table uses the existing crash-safe shard pipeline.
// Order remains significant for messages/swipes because swipe ownership is
// resolved through the parent-message index.
export const SHARDED_TABLES = FILE_BACKED_TABLES;

/**
 * Child tables group by their stable owner. Every unlisted table uses its
 * declared primary key, which is the explicit one-record-per-key strategy.
 */
const SHARD_KEY_COLUMNS: Record<string, string> = {
  messages: "chatId",
  conversation_call_sessions: "chatId",
  conversation_call_messages: "chatId",
  character_card_versions: "characterId",
  persona_card_versions: "personaId",
  noodle_posts: "authorAccountId",
  noodle_account_subscriptions: "creatorAccountId",
  noodle_post_unlocks: "postId",
  noodle_interactions: "postId",
  noodler_creator_reply_claims: "postId",
  noodler_prepared_posts: "creatorAccountId",
  slurp_posts: "authorAccountId",
  slurp_account_subscriptions: "creatorAccountId",
  slurp_post_unlocks: "postId",
  slurp_interactions: "postId",
  slurp_creator_reply_claims: "postId",
  slurp_prepared_posts: "creatorAccountId",
  lorebook_character_links: "lorebookId",
  lorebook_persona_links: "lorebookId",
  lorebook_folders: "lorebookId",
  lorebook_entries: "lorebookId",
  prompt_groups: "presetId",
  prompt_sections: "presetId",
  choice_blocks: "presetId",
  agent_runs: "chatId",
  agent_memory: "chatId",
  game_state_snapshots: "chatId",
  spatial_context_snapshots: "chatId",
  game_engine_state: "chatId",
  game_checkpoints: "chatId",
  game_scene_videos: "chatId",
  game_turn_storyboards: "chatId",
  game_turn_storyboard_keyframes: "storyboardId",
  chat_images: "chatId",
  character_images: "characterId",
  persona_images: "personaId",
  ooc_influences: "targetChatId",
  conversation_notes: "targetChatId",
  memory_chunks: "chatId",
  mari_workspace_context: "chatId",
};
const SHARDED_TABLE_SET: ReadonlySet<string> = new Set(SHARDED_TABLES);

/**
 * Shard for child rows whose parent is unknown (orphans in corrupt installs).
 * Chosen to encode to itself for a readable filename; a real owner key equal
 * to this string would merely share the file — rows carry their own keys, so
 * grouping and loading stay unambiguous.
 */
const UNASSIGNED_SHARD_KEY = "orphaned-rows";

/** Sentinel file marking an in-progress monolith->shard migration (#4708). */
const SHARD_MIGRATION_SENTINEL = ".migrating";

const WINDOWS_RESERVED_BASENAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

/**
 * Encodes an ownership key into a safe filename component. This is a
 * SECURITY boundary, not cosmetics: profile import accepts arbitrary ids, so
 * a crafted id must never become a path escape. Every byte outside
 * [a-z0-9-] is percent-encoded — UPPERCASE INCLUDED, because NTFS and APFS
 * are case-insensitive and two ids differing only in case must never share a
 * file; overlong or Windows-reserved results fall back to a hash form.
 * Filenames are containers only — rows carry their own keys — so the encoding
 * never needs decoding.
 */
export function encodeShardKey(rawKey: string): string {
  if (!rawKey) return UNASSIGNED_SHARD_KEY;
  let encoded = "";
  for (const byte of Buffer.from(rawKey, "utf8")) {
    const char = String.fromCharCode(byte);
    encoded += /[a-z0-9-]/.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  const upper = encoded.toUpperCase();
  if (encoded.length > 120 || WINDOWS_RESERVED_BASENAMES.has(upper) || encoded.endsWith(".") || encoded.endsWith(" ")) {
    return `%h${createHash("sha256").update(rawKey, "utf8").digest("hex").slice(0, 32)}`;
  }
  return encoded;
}

const FILE_BACKED_TABLE_SET = new Set<string>(FILE_BACKED_TABLES);
const isWindows = process.platform === "win32";
const warnedFlushFailures = new Set<string>();

function migrateFileBackedRow(table: string, row: Row): Row {
  if (table === "noodle_accounts") return migrateLegacyNoodleAccountRow(row);
  if (table === "noodle_posts") return migrateLegacyNoodlePostAccessRow(row);
  if ((RETIRED_CHAT_MODE_TABLES as readonly string[]).includes(table)) return migrateRetiredChatModeRow(row);
  return row;
}

function fileBackedRowNeedsMigration(table: string, row: Row): boolean {
  if (row.mode === "visual_novel" && (RETIRED_CHAT_MODE_TABLES as readonly string[]).includes(table)) return true;
  if (table === "noodle_accounts") return row.platform === undefined;
  if (table === "noodle_posts") {
    return (row.access !== "public" && row.access !== "locked") || "ppvPrice" in row || "ppv_price" in row;
  }
  return false;
}

// Parent→child delete graph. Exported as the single source of truth: the Mari
// DB CLI (services/mari-db) consumes it for cascade deletes and its
// dangling-reference validator, so every new relation added here reaches both.
/**
 * Tables whose rows are claims against a provider budget: a commit that survives in memory
 * but not on disk would hand back capacity that was already spent, so these flush durably
 * at commit instead of on the batched timer.
 */
const DURABLE_ON_COMMIT_TABLES = new Set<string>([
  "noodler_automatic_attempts",
  "noodler_creator_reply_claims",
  "noodler_reserve_state",
  "noodler_prepared_posts",
  "noodler_fan_activity_state",
  "slurp_automatic_attempts",
  "slurp_creator_reply_claims",
  "slurp_reserve_state",
  "slurp_prepared_posts",
  "slurp_fan_activity_state",
]);

/**
 * Anchor prefix an experience-state import stamps on a row whose exported anchor is not a
 * message of the DESTINATION chat (#5405) — a campaign replayed into a different chat, or one
 * whose anchor message was deleted before the re-import.
 *
 * Two properties make it load-bearing rather than cosmetic:
 *   - The `messages -> game_engine_state` cascade below matches on `messageId` ALONE, never
 *     scoped by chatId. Storing the caller-supplied id verbatim would let the SOURCE chat's
 *     message deletions silently destroy the imported campaign in the destination chat.
 *     A prefixed id can never equal a real `messages.id`, so no cascade can ever match it.
 *   - The row is still perfectly usable: the experience-state GET falls back to the latest
 *     committed/latest row when the visible anchor has no save of its own, which is exactly
 *     how an imported campaign becomes playable.
 * These anchors are therefore DANGLING BY DESIGN, which is why the
 * `game_engine_state.messageId` cascade is listed in CASCADE_DANGLING_EXEMPT_PREFIXES below —
 * otherwise `mari db validate` would report every imported row as an integrity error.
 */
export const IMPORTED_GAME_ENGINE_ANCHOR_PREFIX = "imported:";

/**
 * Child references that are DANGLING BY DESIGN and must not be reported as integrity errors.
 * Keyed by `<child table>.<child key>` of the CASCADES entry they exempt; a ref starting with
 * the mapped prefix is skipped by the dangling-reference walks in `MariDbService.validate` and
 * `validateTouchedRows`. Keep this list tiny — the default must stay "a dangling ref is a bug".
 */
export const CASCADE_DANGLING_EXEMPT_PREFIXES: Readonly<Record<string, string>> = {
  "game_engine_state.messageId": IMPORTED_GAME_ENGINE_ANCHOR_PREFIX,
};

export const CASCADES: Array<{ parent: FileBackedTable; child: FileBackedTable; parentKey: string; childKey: string }> =
  [
    {
      parent: "noodle_accounts",
      child: "noodle_account_subscriptions",
      parentKey: "id",
      childKey: "viewerAccountId",
    },
    {
      parent: "noodle_accounts",
      child: "noodle_account_subscriptions",
      parentKey: "id",
      childKey: "creatorAccountId",
    },
    { parent: "noodle_accounts", child: "noodle_post_unlocks", parentKey: "id", childKey: "viewerAccountId" },
    { parent: "noodle_accounts", child: "noodle_accounts", parentKey: "id", childKey: "noodleAccountId" },
    { parent: "noodle_accounts", child: "noodle_posts", parentKey: "id", childKey: "authorAccountId" },
    { parent: "noodle_posts", child: "noodle_post_unlocks", parentKey: "id", childKey: "postId" },
    { parent: "noodle_posts", child: "noodle_interactions", parentKey: "id", childKey: "postId" },
    { parent: "noodle_posts", child: "noodler_creator_reply_claims", parentKey: "id", childKey: "postId" },
    {
      parent: "noodle_accounts",
      child: "noodler_creator_reply_claims",
      parentKey: "id",
      childKey: "creatorAccountId",
    },
    { parent: "noodle_accounts", child: "noodler_prepared_posts", parentKey: "id", childKey: "creatorAccountId" },
    {
      parent: "slurp_accounts",
      child: "slurp_account_subscriptions",
      parentKey: "id",
      childKey: "viewerAccountId",
    },
    {
      parent: "slurp_accounts",
      child: "slurp_account_subscriptions",
      parentKey: "id",
      childKey: "creatorAccountId",
    },
    { parent: "slurp_accounts", child: "slurp_post_unlocks", parentKey: "id", childKey: "viewerAccountId" },
    { parent: "slurp_accounts", child: "slurp_accounts", parentKey: "id", childKey: "slurpSourceAccountId" },
    { parent: "slurp_accounts", child: "slurp_posts", parentKey: "id", childKey: "authorAccountId" },
    { parent: "slurp_posts", child: "slurp_post_unlocks", parentKey: "id", childKey: "postId" },
    { parent: "slurp_posts", child: "slurp_interactions", parentKey: "id", childKey: "postId" },
    { parent: "slurp_posts", child: "slurp_creator_reply_claims", parentKey: "id", childKey: "postId" },
    {
      parent: "slurp_interactions",
      child: "slurp_interactions",
      parentKey: "id",
      childKey: "parentInteractionId",
    },
    {
      parent: "slurp_interactions",
      child: "slurp_creator_reply_claims",
      parentKey: "id",
      childKey: "parentInteractionId",
    },
    {
      parent: "slurp_interactions",
      child: "slurp_creator_reply_claims",
      parentKey: "id",
      childKey: "replyInteractionId",
    },
    {
      parent: "slurp_accounts",
      child: "slurp_creator_reply_claims",
      parentKey: "id",
      childKey: "creatorAccountId",
    },
    { parent: "slurp_accounts", child: "slurp_prepared_posts", parentKey: "id", childKey: "creatorAccountId" },
    { parent: "chats", child: "messages", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "conversation_call_sessions", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "conversation_call_messages", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "agent_runs", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "agent_memory", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "chat_images", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "memory_chunks", parentKey: "id", childKey: "chatId" },
    // #5073: a Mari workspace chat's attached context is scoped to it and must
    // not outlive it (a leaked shard + stale injection into a reused chat id).
    { parent: "chats", child: "mari_workspace_context", parentKey: "id", childKey: "chatId" },
    // The influences/notes schemas declare onDelete: cascade on BOTH chat
    // FKs, but the graph never carried them — the rows outlived their chats
    // (invisible inside the old monolith; a permanent leaked shard file once
    // the tables sharded, and stale injections if a chat id is ever reused).
    { parent: "chats", child: "ooc_influences", parentKey: "id", childKey: "sourceChatId" },
    { parent: "chats", child: "ooc_influences", parentKey: "id", childKey: "targetChatId" },
    { parent: "chats", child: "conversation_notes", parentKey: "id", childKey: "sourceChatId" },
    { parent: "chats", child: "conversation_notes", parentKey: "id", childKey: "targetChatId" },
    { parent: "chats", child: "game_state_snapshots", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "spatial_context_snapshots", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "game_engine_state", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "game_checkpoints", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "game_scene_videos", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "game_turn_storyboards", parentKey: "id", childKey: "chatId" },
    {
      parent: "game_turn_storyboards",
      child: "game_turn_storyboard_keyframes",
      parentKey: "id",
      childKey: "storyboardId",
    },
    { parent: "messages", child: "message_swipes", parentKey: "id", childKey: "messageId" },
    // Game rows must not outlive their message: mirrors the application-level
    // cleanup in chats.storage.ts deleteGameStateForMessages(), which deletes
    // checkpoints (by snapshotId and messageId), snapshots, and engine state
    // whenever messages are removed.
    { parent: "messages", child: "game_state_snapshots", parentKey: "id", childKey: "messageId" },
    { parent: "messages", child: "spatial_context_snapshots", parentKey: "id", childKey: "messageId" },
    { parent: "messages", child: "game_checkpoints", parentKey: "id", childKey: "messageId" },
    // Matched on messageId ALONE — never scoped by chatId. See
    // IMPORTED_GAME_ENGINE_ANCHOR_PREFIX above for why the experience-state import must not
    // store a foreign chat's message ids verbatim, and for its validate() exemption.
    { parent: "messages", child: "game_engine_state", parentKey: "id", childKey: "messageId" },
    { parent: "game_state_snapshots", child: "game_checkpoints", parentKey: "id", childKey: "snapshotId" },
    { parent: "conversation_call_sessions", child: "conversation_call_messages", parentKey: "id", childKey: "callId" },
    { parent: "characters", child: "character_card_versions", parentKey: "id", childKey: "characterId" },
    { parent: "characters", child: "character_images", parentKey: "id", childKey: "characterId" },
    { parent: "personas", child: "persona_images", parentKey: "id", childKey: "personaId" },
    { parent: "personas", child: "persona_card_versions", parentKey: "id", childKey: "personaId" },
    { parent: "lorebooks", child: "lorebook_character_links", parentKey: "id", childKey: "lorebookId" },
    { parent: "lorebooks", child: "lorebook_persona_links", parentKey: "id", childKey: "lorebookId" },
    { parent: "lorebooks", child: "lorebook_folders", parentKey: "id", childKey: "lorebookId" },
    { parent: "lorebooks", child: "lorebook_entries", parentKey: "id", childKey: "lorebookId" },
    { parent: "prompt_presets", child: "prompt_groups", parentKey: "id", childKey: "presetId" },
    { parent: "prompt_presets", child: "prompt_sections", parentKey: "id", childKey: "presetId" },
    { parent: "prompt_presets", child: "choice_blocks", parentKey: "id", childKey: "presetId" },
    { parent: "agent_configs", child: "agent_runs", parentKey: "id", childKey: "agentConfigId" },
    { parent: "agent_configs", child: "agent_memory", parentKey: "id", childKey: "agentConfigId" },
  ];

const SET_NULL_RELATIONS: Array<{
  parent: FileBackedTable;
  child: FileBackedTable;
  parentKey: string;
  childKey: string;
}> = [
  { parent: "chat_images", child: "game_turn_storyboard_keyframes", parentKey: "id", childKey: "chatImageId" },
  {
    parent: "game_scene_videos",
    child: "game_turn_storyboard_keyframes",
    parentKey: "id",
    childKey: "sceneVideoId",
  },
  {
    parent: "spatial_context_snapshots",
    child: "game_checkpoints",
    parentKey: "id",
    childKey: "spatialSnapshotId",
  },
];

const tableMetasByObject = new WeakMap<object, TableMeta>();
const columnMetasByObject = new WeakMap<object, ColumnMeta>();
const tableMetasByName = new Map<string, TableMeta>();

function tableNameOf(table: Table): string {
  return getFileTableConfig(table).name;
}

function buildTableMetadata() {
  for (const candidate of Object.values(schema)) {
    if (!isFileTable(candidate)) continue;
    const table = candidate;
    const name = tableNameOf(table);
    if (!FILE_BACKED_TABLE_SET.has(name)) continue;
    const tableConfig = getFileTableConfig(table);
    const columns: ColumnMeta[] = tableConfig.columns.map((column) => ({
      key: column.key,
      dbName: column.name,
      column,
      primary: column.primary,
      hasDefault: column.hasDefault,
      defaultValue: column.defaultValue,
    }));
    const meta: TableMeta = {
      name,
      table,
      columns,
      byKey: new Map(columns.map((column) => [column.key, column])),
      byDbName: new Map(columns.map((column) => [column.dbName, column])),
      primaryKey: columns.find((column) => column.primary)?.key ?? null,
      uniqueConstraints: tableConfig.uniqueConstraints.map((constraint) => ({
        keys: [...constraint.keys],
        when: constraint.when,
      })),
    };
    for (const constraint of meta.uniqueConstraints) {
      if (constraint.keys.length === 0 || constraint.keys.some((key) => !meta.byKey.has(key))) {
        throw new Error(`[file-storage] Invalid unique key metadata for ${name}: ${constraint.keys.join(", ")}`);
      }
    }
    tableMetasByObject.set(table, meta);
    tableMetasByName.set(name, meta);
    for (const column of columns) {
      columnMetasByObject.set(column.column, column);
    }
  }

  const missing = FILE_BACKED_TABLES.filter((table) => !tableMetasByName.has(table));
  if (missing.length > 0) {
    throw new Error(`[file-storage] Missing schema metadata for: ${missing.join(", ")}`);
  }
}

buildTableMetadata();

function warnFlushFailure(kind: "file" | "directory", path: string, err: unknown) {
  const key = `${kind}:${path}`;
  if (warnedFlushFailures.has(key)) {
    logger.debug(err, "[file-storage] Failed to fsync %s %s", kind, path);
    return;
  }
  warnedFlushFailures.add(key);
  logger.warn(
    err,
    "[file-storage] Failed to fsync %s %s; crash recovery may rely on the operating system write cache.",
    kind,
    path,
  );
}

async function flushFile(path: string) {
  let handle: import("node:fs/promises").FileHandle | null = null;
  try {
    // Windows FlushFileBuffers requires a writable file handle. Opening the
    // just-written snapshot with r+ keeps fsync effective there without
    // truncating or rewriting the file.
    handle = await open(path, "r+");
    await handle.sync();
  } catch (err) {
    // Best effort only. Some mobile filesystems reject fsync for app data.
    warnFlushFailure("file", path, err);
  } finally {
    if (handle !== null) {
      try {
        await handle.close();
      } catch {
        /* ignore */
      }
    }
  }
}

async function flushDirectory(path: string) {
  if (isWindows) {
    // Node cannot open/flush directory handles on Windows. File handles are
    // still flushed above; the directory metadata flush remains POSIX-only.
    return;
  }

  let handle: import("node:fs/promises").FileHandle | null = null;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (err) {
    // Directory fsync is best effort across filesystems/platforms.
    warnFlushFailure("directory", path, err);
  } finally {
    if (handle !== null) {
      try {
        await handle.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function looksNulFilled(path: string): boolean {
  // Cheap heuristic: a hard-crash-corrupted file shows up as NUL bytes from
  // byte 0, or as 0 length if the truncate landed but no writes flushed.
  // JSON tables/manifests always start with a printable character ([ or {),
  // so either case means the file is unusable as a backup source.
  let fd: number | null = null;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.alloc(1);
    const bytesRead = readSync(fd, buf, 0, 1, 0);
    if (bytesRead === 0) return true;
    return buf[0] === 0;
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

async function atomicWriteFile(path: string, content: string, options: { refreshBackup?: boolean } = {}) {
  mkdirSync(dirname(path), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  const refreshBackup = options.refreshBackup ?? true;
  try {
    // Refresh the .bak via tmp + fsync + rename so a hard crash mid-write
    // can't leave both main and backup zero-filled (NTFS allocates blocks
    // and updates metadata before the cache manager flushes data).
    //
    // Skip the refresh when either:
    //   1. Caller opted out (refreshBackup=false): this write is repairing a
    //      file just recovered from .bak, so the still-corrupt primary is not
    //      valid backup input.
    //   2. The existing main is NUL-corrupted: copying garbage over a valid
    //      .bak would destroy the recovery source.
    if (refreshBackup && existsSync(path) && !looksNulFilled(path)) {
      const bakPath = `${path}.bak`;
      const bakTmpPath = `${bakPath}.tmp-${process.pid}-${Date.now()}`;
      try {
        await copyFile(path, bakTmpPath);
        if (process.platform !== "win32") await chmod(bakTmpPath, PRIVATE_FILE_MODE);
        await flushFile(bakTmpPath);
        await rename(bakTmpPath, bakPath);
        await flushDirectory(dirname(bakPath));
      } catch (err) {
        try {
          if (existsSync(bakTmpPath)) await unlink(bakTmpPath);
        } catch {
          /* ignore */
        }
        logger.error(
          err,
          "[file-storage] Failed to refresh backup durably; backup may be stale and unusable for crash recovery (path=%s)",
          bakPath,
        );
      }
    }
    await writeFile(tmpPath, content, { mode: PRIVATE_FILE_MODE });
    await flushFile(tmpPath);
    await rename(tmpPath, path);
    await flushDirectory(dirname(path));
  } catch (err) {
    try {
      if (existsSync(tmpPath)) await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

type ParseResult<T> = {
  value: T;
  recoveredFromBackup: boolean;
  recoveredFromFallback: boolean;
  unreadablePaths: string[];
};

type QuarantinedFile = QuarantinedStorageTable["files"][number];

function describeStaleness(mainPath: string, backupPath: string): string {
  try {
    const mainMs = statSync(mainPath).mtimeMs;
    const bakMs = statSync(backupPath).mtimeMs;
    const deltaMs = Math.max(0, mainMs - bakMs);
    if (deltaMs < 1000) return "less than a second";
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  } catch {
    return "unknown";
  }
}

function corruptionTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function quarantinePath(path: string, timestamp: string) {
  let candidate = `${path}.corrupt-${timestamp}`;
  let suffix = 1;
  while (existsSync(candidate)) {
    suffix += 1;
    candidate = `${path}.corrupt-${timestamp}-${suffix}`;
  }
  return candidate;
}

async function quarantineUnrecoverableFiles(paths: string[], context: string): Promise<QuarantinedFile[]> {
  const timestamp = corruptionTimestamp();
  const quarantined: QuarantinedFile[] = [];
  const uniquePaths = [...new Set(paths)];
  for (const from of uniquePaths) {
    if (!existsSync(from)) continue;
    const to = quarantinePath(from, timestamp);
    try {
      await rename(from, to);
      quarantined.push({ from, to });
    } catch (err) {
      logger.error(
        err,
        "[file-storage] Failed to quarantine unrecoverable %s file %s; leaving it in place.",
        context,
        from,
      );
    }
  }
  return quarantined;
}

function isRowRecord(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** unlink that tolerates ONLY a missing file; every other failure propagates. */
async function unlinkIgnoringMissing(path: string) {
  try {
    await unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }
}

async function preserveMalformedRowSource(path: string, table: string): Promise<QuarantinedFile[]> {
  if (!existsSync(path)) return [];
  const to = quarantinePath(path, corruptionTimestamp());
  try {
    await copyFile(path, to);
    if (process.platform !== "win32") await chmod(to, PRIVATE_FILE_MODE);
    return [{ from: path, to }];
  } catch (err) {
    logger.error(
      err,
      "[file-storage] Failed to preserve table %s source %s before removing malformed rows.",
      table,
      path,
    );
    return [];
  }
}

function parseJsonFile<T>(path: string, fallback: T): ParseResult<T> {
  if (!existsSync(path)) {
    const backupPath = `${path}.bak`;
    if (existsSync(backupPath)) {
      try {
        const value = JSON.parse(readFileSync(backupPath, "utf8")) as T;
        logger.warn(
          "[file-storage] %s is missing; recovering from %s. A fresh primary snapshot will be written on next save.",
          path,
          backupPath,
        );
        return {
          value,
          recoveredFromBackup: true,
          recoveredFromFallback: false,
          unreadablePaths: [],
        };
      } catch (backupErr) {
        logger.error(
          backupErr,
          "[file-storage] %s is missing and backup %s could not be used; continuing with fallback data.",
          path,
          backupPath,
        );
        return {
          value: fallback,
          recoveredFromBackup: false,
          recoveredFromFallback: true,
          unreadablePaths: [backupPath],
        };
      }
    }
    return { value: fallback, recoveredFromBackup: false, recoveredFromFallback: false, unreadablePaths: [] };
  }
  try {
    return {
      value: JSON.parse(readFileSync(path, "utf8")) as T,
      recoveredFromBackup: false,
      recoveredFromFallback: false,
      unreadablePaths: [],
    };
  } catch (err) {
    const backupPath = `${path}.bak`;
    if (existsSync(backupPath)) {
      const staleness = describeStaleness(path, backupPath);
      try {
        const value = JSON.parse(readFileSync(backupPath, "utf8")) as T;
        logger.error(
          err,
          "[file-storage] %s is corrupt; recovering from %s (backup is %s older). Edits made since the backup are unrecoverable.",
          path,
          backupPath,
          staleness,
        );
        return {
          value,
          recoveredFromBackup: true,
          recoveredFromFallback: false,
          unreadablePaths: [],
        };
      } catch (backupErr) {
        logger.error(
          err,
          "[file-storage] %s is corrupt and backup %s could not be used (backup is %s older); continuing with fallback data. Data in the primary and backup files is unrecoverable.",
          path,
          backupPath,
          staleness,
        );
        logger.error(backupErr, "[file-storage] Backup %s parse failure while recovering %s.", backupPath, path);
        return {
          value: fallback,
          recoveredFromBackup: false,
          recoveredFromFallback: true,
          unreadablePaths: [path, backupPath],
        };
      }
    }
    logger.error(
      err,
      "[file-storage] %s is corrupt and no usable backup exists; continuing with fallback data. Data in this file is unrecoverable.",
      path,
    );
    return { value: fallback, recoveredFromBackup: false, recoveredFromFallback: true, unreadablePaths: [path] };
  }
}

function tableFilePath(rootDir: string, table: string) {
  return join(rootDir, "tables", `${table}.json`);
}

/** Thrown when on-disk data was written by a newer storage format (#4708). */
export class StorageFormatTooNewError extends Error {
  constructor(onDiskVersion: number, supportedVersion: number) {
    super(
      `This data directory was written by storage format ${onDiskVersion}, but this build supports up to ` +
        `format ${supportedVersion}. Update Marinara Engine (or restore a matching backup) instead of ` +
        `running an older build against newer data.`,
    );
    this.name = "StorageFormatTooNewError";
  }
}

export class StorageWriterLeaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageWriterLeaseError";
  }
}

function shardDirPath(rootDir: string, table: string) {
  return join(rootDir, "tables", table);
}

function shardFilePath(rootDir: string, table: string, encodedKey: string) {
  return join(shardDirPath(rootDir, table), `${encodedKey}.json`);
}

/** Shard data files only — never .bak/.tmp/.corrupt/.pre-shard/sentinel/artifact names. */
function isShardDataFileName(name: string) {
  return /^[^.][^\\/]*\.json$/.test(name);
}

/**
 * Shard primaries to load, including bak-only shards: a crash can leave a
 * shard with its primary gone but its `.bak` intact, and readdir would never
 * surface it — the per-file recovery in parseJsonFile only helps files we ask
 * it about (#4708).
 */
function discoverShardPrimaries(entries: string[]): string[] {
  const primaries = new Set(entries.filter(isShardDataFileName));
  for (const name of entries) {
    if (!name.endsWith(".json.bak")) continue;
    const primary = name.slice(0, -".bak".length);
    if (isShardDataFileName(primary)) primaries.add(primary);
  }
  return [...primaries].sort();
}

function manifestPath(rootDir: string) {
  return join(rootDir, "manifest.json");
}

function writerLeasePath(rootDir: string) {
  return join(rootDir, STORAGE_WRITER_LEASE_FILENAME);
}

function writerLeaseOwnerPath(path: string) {
  return join(path, STORAGE_WRITER_OWNER_FILENAME);
}

function writerLeaseLivenessPath(path: string) {
  return join(path, STORAGE_WRITER_LIVENESS_FILENAME);
}

const CURRENT_HOSTNAME = hostname();
const CURRENT_LEGACY_HOST_ID = (() => {
  const machineId = ["/etc/machine-id", "/var/lib/dbus/machine-id"].flatMap((path) => {
    try {
      return [readFileSync(path, "utf8").trim()];
    } catch {
      return [];
    }
  })[0];
  const macs = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .map((entry) => entry.mac.toLowerCase())
    .filter((mac) => mac !== "00:00:00:00:00:00")
    .sort();
  if (!machineId && macs.length === 0) return null;
  return createHash("sha256")
    .update([CURRENT_HOSTNAME, machineId ?? "", ...macs].join("\n"))
    .digest("hex");
})();

function readStableMachineId() {
  if (process.platform === "darwin") {
    try {
      const output = execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1_000,
        maxBuffer: 64 * 1024,
      });
      return output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] ?? null;
    } catch {
      return null;
    }
  }

  if (process.platform === "win32") {
    try {
      const executable = process.env.SystemRoot ? join(process.env.SystemRoot, "System32", "reg.exe") : "reg.exe";
      const output = execFileSync(
        executable,
        ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 1_000,
          maxBuffer: 64 * 1024,
        },
      );
      return output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  return (
    ["/etc/machine-id", "/var/lib/dbus/machine-id"].flatMap((path) => {
      try {
        return [readFileSync(path, "utf8").trim()];
      } catch {
        return [];
      }
    })[0] ?? null
  );
}

const CURRENT_HOST_ID = (() => {
  const machineId = readStableMachineId();
  if (!machineId) return null;
  return createHash("sha256")
    .update(`marinara-writer-lease-v2\n${process.platform}\n${machineId.toLowerCase()}`)
    .digest("hex");
})();

const CURRENT_CONTAINER_WRITER_SCOPE_ID = (() => {
  if (process.platform !== "linux" || process.env.MARINARA_DOCKER !== "true") return null;
  try {
    const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    if (bootId) {
      return createHash("sha256").update(`marinara-writer-lease-boot\n${bootId}`).digest("hex");
    }
  } catch {
    return null;
  }
  return null;
})();

function writerLeaseBelongsToCurrentHost(record: StorageWriterLeaseRecord) {
  if (record.version === 2) {
    return Boolean(CURRENT_HOST_ID && record.hostId === CURRENT_HOST_ID);
  }
  if (CURRENT_LEGACY_HOST_ID && record.hostId === CURRENT_LEGACY_HOST_ID) return true;

  // Version 1 used every visible MAC address in its fingerprint. On macOS,
  // VPN and virtual interfaces can change that list between launches. The
  // hostname fallback is intentionally limited to legacy macOS leases; v2
  // leases always require the stable platform UUID above.
  return process.platform === "darwin" && record.hostname === CURRENT_HOSTNAME;
}

async function startWriterLeaseLiveness(
  path: string,
  token: string,
  scopeId: string | null,
): Promise<WriterLeaseLiveness | null> {
  if (process.platform === "win32" || !scopeId) return null;

  const socketPath = writerLeaseLivenessPath(path);
  // sockaddr_un is shortest on macOS (103 usable bytes). Stay below every
  // supported POSIX limit instead of letting a platform silently truncate it.
  if (Buffer.byteLength(socketPath) > 100) return null;

  // Container PID namespaces can reuse the same internal PID after a recreation.
  // A socket on the shared data mount remains reachable while its writer lives,
  // and the kernel drops the listener even when that container is force-killed.
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.end(token);
  });
  try {
    await new Promise<void>((resolveListen, rejectListen) => {
      const onError = (error: Error) => rejectListen(error);
      server.once("error", onError);
      server.listen(socketPath, () => {
        server.off("error", onError);
        resolveListen();
      });
    });
  } catch (error) {
    rmSync(socketPath, { force: true });
    logger.debug(
      { err: error, path: socketPath },
      "[file-storage] Writer lease socket is unavailable; a stale container lease may require manual recovery.",
    );
    return null;
  }

  server.on("error", (error) => {
    logger.error(error, "[file-storage] Writer lease socket failed");
  });
  server.unref();
  return { server, sockets, scopeId };
}

async function stopWriterLeaseLiveness(liveness: WriterLeaseLiveness | null) {
  if (!liveness) return;
  for (const socket of liveness.sockets) socket.destroy();
  await new Promise<void>((resolveClose, rejectClose) => {
    liveness.server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") rejectClose(error);
      else resolveClose();
    });
  });
}

async function probeWriterLeaseLiveness(path: string, token: string): Promise<"active" | "stale" | "uncertain"> {
  if (process.platform === "win32") return "uncertain";

  return new Promise((resolveProbe) => {
    let response = "";
    let settled = false;
    let timeout: NodeJS.Timeout | null = null;
    const socket = createConnection(writerLeaseLivenessPath(path));
    const finish = (result: "active" | "stale" | "uncertain") => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      socket.destroy();
      resolveProbe(result);
    };
    timeout = setTimeout(() => finish("uncertain"), 1_000);
    timeout.unref();

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      response += chunk;
      if (response.length > 128) finish("uncertain");
    });
    socket.on("end", () => finish(response === token ? "active" : "uncertain"));
    socket.on("error", (error) => {
      const code = (error as NodeJS.ErrnoException).code;
      finish(code === "ECONNREFUSED" ? "stale" : "uncertain");
    });
  });
}

class WriterLeasePendingError extends Error {}

const WRITER_LEASE_RETRY_DELAY_MS = 10;

function invalidWriterLeaseError(path: string, cause: unknown) {
  return new StorageWriterLeaseError(
    `The storage writer lease at ${path} is incomplete or invalid. Stop every Marinara Engine process using this data directory, remove only that lease directory, then retry.`,
    { cause },
  );
}

function parseWriterLease(path: string): { raw: string; record: StorageWriterLeaseRecord } {
  let raw: string;
  try {
    raw = readFileSync(writerLeaseOwnerPath(path), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WriterLeasePendingError(`The storage writer lease at ${path} has no owner record yet.`);
    }
    throw new StorageWriterLeaseError(`Could not read the storage writer lease at ${path}.`, { cause: err });
  }
  try {
    const record = JSON.parse(raw) as StorageWriterLeaseRecord;
    if (
      (record.version !== 1 && record.version !== 2 && record.version !== 3) ||
      !Number.isSafeInteger(record.pid) ||
      record.pid <= 0 ||
      (record.hostId !== null && typeof record.hostId !== "string") ||
      (record.version === 3 && (typeof record.scopeId !== "string" || record.scopeId.length === 0)) ||
      typeof record.hostname !== "string" ||
      typeof record.token !== "string" ||
      typeof record.acquiredAt !== "string"
    ) {
      throw new Error("invalid lease fields");
    }
    return { raw, record };
  } catch (err) {
    throw invalidWriterLeaseError(path, err);
  }
}

function pidDefinitelyExited(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ESRCH";
  }
}

function isTermuxPrivateHomeStorage(rootDir: string) {
  if (process.platform !== "android" || !process.env.HOME) return false;
  try {
    const home = realpathSync(resolve(process.env.HOME));
    const storage = realpathSync(resolve(rootDir));
    return storage === home || storage.startsWith(`${home}${sep}`);
  } catch {
    return false;
  }
}

function fileStoreManifestExists(rootDir: string) {
  return existsSync(manifestPath(rootDir));
}

function tableSnapshotsExist(rootDir: string) {
  return existsSync(join(rootDir, "tables"));
}

function defaultForColumn(column: ColumnMeta) {
  if (column.hasDefault) return typeof column.defaultValue === "function" ? column.defaultValue() : column.defaultValue;
  return null;
}

function normalizeRow(meta: TableMeta, row: Row) {
  const normalized: Row = {};
  for (const column of meta.columns) {
    if (Object.prototype.hasOwnProperty.call(row, column.key)) {
      normalized[column.key] = row[column.key] ?? null;
    } else if (Object.prototype.hasOwnProperty.call(row, column.dbName)) {
      normalized[column.key] = row[column.dbName] ?? null;
    } else {
      normalized[column.key] = defaultForColumn(column);
    }
  }
  return normalized;
}

function prepareInsertRow(meta: TableMeta, row: Row) {
  const normalized = normalizeRow(meta, row);
  for (const key of Object.keys(row)) {
    if (!meta.byKey.has(key) && !meta.byDbName.has(key)) {
      normalized[key] = row[key];
    }
  }
  return normalized;
}

function normalizeConflictTargets(target: unknown) {
  const targets = Array.isArray(target) ? target : target ? [target] : [];
  return targets.map((entry) => getColumnMeta(entry)?.key).filter((entry): entry is string => Boolean(entry));
}

function findMatchingRowIndex(rows: Row[], row: Row, columns: string[]) {
  return rows.findIndex((existing) => columns.every((column) => existing[column] === row[column]));
}

function declaredUniqueConstraints(meta: TableMeta) {
  return [...(meta.primaryKey ? [{ keys: [meta.primaryKey] }] : []), ...meta.uniqueConstraints] as Array<{
    keys: string[];
    when?: (row: Row) => boolean;
  }>;
}

function findUniqueViolation(meta: TableMeta, rows: Row[], row: Row, excludedIndex = -1) {
  for (const constraint of declaredUniqueConstraints(meta)) {
    if (constraint.when && !constraint.when(row)) continue;
    const duplicateIndex = rows.findIndex(
      (existing, index) =>
        index !== excludedIndex &&
        (!constraint.when || constraint.when(existing)) &&
        constraint.keys.every((key) => existing[key] === row[key]),
    );
    if (duplicateIndex !== -1) return constraint;
  }
  return null;
}

function assertUniqueRow(meta: TableMeta, rows: Row[], row: Row, excludedIndex = -1) {
  const violation = findUniqueViolation(meta, rows, row, excludedIndex);
  if (violation) throw new FileUniqueConstraintError(meta.name, violation.keys);
}

function cloneRow(row: Row) {
  return { ...row };
}

function getMeta(table: Table | string) {
  const tableName = typeof table === "string" ? table : tableNameOf(table);
  // Downloaded capability bundles carry their own file-table instances.
  // Keep object identity as the fast path, then resolve only registered Engine
  // table names so package-owned storage code can use the same file-native DB.
  const meta =
    typeof table === "string"
      ? tableMetasByName.get(table)
      : (tableMetasByObject.get(table) ?? tableMetasByName.get(tableName));
  if (!meta) {
    throw new Error(`[file-storage] Unsupported table: ${tableName}`);
  }
  return meta;
}

export type FileTableShardStrategy =
  | { kind: "parent"; column: string }
  | { kind: "primary-key"; column: string }
  | { kind: "message-parent"; column: "messageId" };

const fileTableShardStrategies = new Map<FileBackedTable, FileTableShardStrategy>();

export function getFileTableShardStrategy(table: FileBackedTable): FileTableShardStrategy {
  const cached = fileTableShardStrategies.get(table);
  if (cached) return cached;

  let strategy: FileTableShardStrategy;
  if (table === "message_swipes") {
    strategy = { kind: "message-parent", column: "messageId" };
  } else {
    const configuredColumn = SHARD_KEY_COLUMNS[table];
    const meta = getMeta(table);
    if (configuredColumn) {
      if (!meta.byKey.has(configuredColumn)) {
        throw new Error(`[file-storage] ${table} has no shard-key column named ${configuredColumn}`);
      }
      strategy = { kind: "parent", column: configuredColumn };
    } else {
      const primaryKey = meta.primaryKey;
      if (!primaryKey) throw new Error(`[file-storage] ${table} has no stable shard key`);
      strategy = { kind: "primary-key", column: primaryKey };
    }
  }
  fileTableShardStrategies.set(table, strategy);
  return strategy;
}

function getColumnMeta(column: unknown): ColumnMeta | null {
  if (!isFileColumn(column)) return null;
  const direct = columnMetasByObject.get(column);
  if (direct) return direct;
  if (!column.table) return null;
  let tableMeta = tableMetasByObject.get(column.table);
  if (!tableMeta) {
    tableMeta = tableMetasByName.get(tableNameOf(column.table));
  }
  return tableMeta?.byDbName.get(column.name) ?? null;
}

function isColumn(value: unknown): value is Column {
  return Boolean(getColumnMeta(value));
}

function valueForColumn(ctx: RowContext, column: Column) {
  const meta = getColumnMeta(column);
  if (!meta) return undefined;
  if (!column.table) return undefined;
  const tableName = tableNameOf(column.table);
  return ctx.rows[tableName]?.[meta.key];
}

function resolveValue(value: unknown, ctx: RowContext): unknown {
  if (isColumn(value)) return valueForColumn(ctx, value);
  if (Array.isArray(value)) return value.map((entry) => resolveValue(entry, ctx));
  return value;
}

function compareValues(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function matchesLike(value: unknown, pattern: unknown) {
  // SQL-LIKE semantics: % and _ match across newlines too ([\s\S], not dot) — `.`
  // without the s flag silently failed on multi-line values, which broke substring
  // searches over comment fields and, worse, let a crafted multi-line value escape
  // a notLike() namespace boundary (a non-match inverts to true).
  const escaped = String(pattern ?? "")
    // Escape every regex metacharacter, including * and ? — in SQL LIKE only % and _ are wildcards,
    // so * and ? are literals; leaving them unescaped made "*" throw and "a*b"/"a?b" match non-literally.
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, "[\\s\\S]*")
    .replace(/_/g, "[\\s\\S]");
  return new RegExp(`^${escaped}$`, "i").test(String(value ?? ""));
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function evaluateCondition(condition: Condition, ctx: RowContext): boolean {
  if (!condition) return true;
  if (!isFileCondition(condition)) return false;

  if (condition.kind === "file-logical") {
    return condition.operator === "and"
      ? condition.conditions.every((entry) => evaluateCondition(entry, ctx))
      : condition.conditions.some((entry) => evaluateCondition(entry, ctx));
  }
  if (condition.kind === "file-null-check") {
    const value = resolveValue(condition.value, ctx);
    return condition.operator === "is-null" ? value == null : value != null;
  }
  if (condition.kind === "file-membership") {
    const value = resolveValue(condition.value, ctx);
    const values = condition.values.map((entry) => resolveValue(entry, ctx));
    return condition.operator === "in" ? values.includes(value) : !values.includes(value);
  }
  if (condition.kind === "file-pattern") {
    const matched = matchesLike(resolveValue(condition.value, ctx), resolveValue(condition.pattern, ctx));
    return condition.negate ? !matched : matched;
  }
  if (condition.kind === "file-string-nonblank") {
    const value = resolveValue(condition.value, ctx);
    return typeof value === "string" && value.trim().length > 0;
  }
  if (condition.kind === "file-json-flags-not-true") {
    const record = parseJsonRecord(resolveValue(condition.value, ctx));
    return condition.flags.every((flag) => record[flag] !== true);
  }

  const left = resolveValue(condition.left, ctx);
  const right = resolveValue(condition.right, ctx);
  if (condition.operator === "eq") return left === right;
  if (condition.operator === "ne") {
    if (right == null) return left != null;
    return left !== right;
  }
  const comparison = compareValues(left, right);
  if (condition.operator === "lt") return comparison < 0;
  if (condition.operator === "lte") return comparison <= 0;
  if (condition.operator === "gt") return comparison > 0;
  return comparison >= 0;
}

function orderSpec(ordering: Ordering, ctx: RowContext): { value: unknown; direction: "asc" | "desc" } {
  if (isColumn(ordering)) {
    return { value: resolveValue(ordering, ctx), direction: "asc" };
  }
  if (isFileOrdering(ordering)) {
    return { value: resolveValue(ordering.value, ctx), direction: ordering.direction };
  }
  return { value: undefined, direction: "asc" };
}

function projectRow(ctx: RowContext, projection?: Projection) {
  if (!projection) {
    if (ctx.joined) {
      return Object.fromEntries(Object.entries(ctx.rows).map(([table, row]) => [table, cloneRow(row)]));
    }
    return cloneRow(ctx.rows[ctx.baseTable] ?? {});
  }

  const output: Row = {};
  for (const [key, value] of Object.entries(projection)) {
    output[key] = resolveValue(value, ctx);
  }
  return output;
}

function executable<T>(operation: () => T | Promise<T>): Executable<T> {
  let promise: Promise<T> | null = null;
  const getPromise = () => {
    promise ??= Promise.resolve().then(operation);
    return promise;
  };
  return {
    run: getPromise,
    then: (onfulfilled, onrejected) => getPromise().then(onfulfilled, onrejected),
    catch: (onrejected) => getPromise().catch(onrejected),
    finally: (onfinally) => getPromise().finally(onfinally),
  };
}

class FileTableStore {
  private tables = new Map<string, Row[]>();
  private dirtyTables = new Set<string>();
  /**
   * Pending shard keys (RAW keys, not encoded) per sharded table (#4708).
   * Parallel to dirtyTables — NEVER encoded into it: the transaction context's
   * table-name set doubles as the rollback-snapshot key set, and a synthetic
   * "messages/<id>" entry there would restore a phantom table over the real one.
   */
  private dirtyShards = new Map<string, Set<string>>();
  /** messageId -> chatId, so swipe writes resolve their shard in O(1) (#4708). */
  private messageShardIndex = new Map<string, string>();
  /** ENCODED shard filenames known on disk, so the flush never stats clean shards. */
  private knownShardFiles = new Map<string, Set<string>>();
  /**
   * ENCODED filenames of physical shard files found at load holding rows that
   * belong to OTHER shards. Logical-key dirtying alone never touches such a
   * file (the flush writes the rows' real shards and skips this one), so it
   * would reintroduce its stray rows on every startup. The next flush
   * rewrites each canonically or deletes it; cleared per table afterwards.
   */
  private staleShardFiles = new Map<string, Set<string>>();
  /**
   * messageIds of swipes currently resolving to the unassigned shard. When
   * such a message is later INSERTED, its swipes silently regroup into the
   * chat's shard, so BOTH swipe files must be dirtied (see
   * reindexMovedMessages). Kept tiny — usually empty — so the check costs
   * nothing on the ordinary insert path.
   */
  private orphanSwipeMessageIds = new Set<string>();
  /** Manifest version read by the pre-migration gate; feeds the #4756 notice. */
  private preMigrationManifestVersion: number | null = null;
  /** Tables migrated monolith -> shards THIS boot; feeds the #4756 notice. */
  private migratedTables: string[] = [];
  private shardDirsCreated = new Set<string>();
  /** Monotonic per-table write counters (#4705); bumped in markDirty, never rolled back. */
  private tableWriteGenerations = new Map<string, number>();
  private backupRecoveredPaths = new Set<string>();
  private dirty = false;
  private activeFlush: Promise<void> | null = null;
  private lastFlushError: unknown = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private safetyTimer: NodeJS.Timeout | null = null;
  private beforeExitHandler: (() => void) | null = null;
  // Rollback state for the active transaction lives in this AsyncLocalStorage so
  // it is bound to the transaction's own async call path. Writes from other
  // async call paths wait for the transaction to finish and are therefore never
  // captured by (or reverted with) its rollback snapshots.
  private readonly txContext = new AsyncLocalStorage<FileTransactionContext>();
  private transactionQueue: Promise<void> = Promise.resolve();
  private activeTransactionCount = 0;
  private transactionIdleWaiters = new Set<() => void>();
  private pendingTransactionFlush = false;
  private quarantinedTables: QuarantinedStorageTable[] = [];
  private writerLease: ActiveStorageWriterLease | null = null;
  private writesClosed = false;
  private closePromise: Promise<void> | null = null;

  constructor(
    private readonly rootDir: string,
    private readonly testHooks?: FileNativeStoreTestHooks,
  ) {
    for (const table of FILE_BACKED_TABLES) {
      this.tables.set(table, []);
    }
  }

  private async acquireWriterLease() {
    const path = writerLeasePath(this.rootDir);
    const writerScopeId = this.testHooks?.writerLeaseScopeId ?? CURRENT_CONTAINER_WRITER_SCOPE_ID;
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = randomUUID();
      let created = false;
      try {
        mkdirSync(path, { mode: PRIVATE_DIRECTORY_MODE });
        created = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
          throw new StorageWriterLeaseError(`Could not acquire the storage writer lease at ${path}.`, {
            cause: err,
          });
        }
      }

      if (created) {
        const liveness = await startWriterLeaseLiveness(path, token, writerScopeId);
        try {
          const record: StorageWriterLeaseRecord = {
            version: liveness ? 3 : 2,
            pid: process.pid,
            hostId: CURRENT_HOST_ID,
            ...(liveness ? { scopeId: liveness.scopeId } : {}),
            hostname: CURRENT_HOSTNAME,
            token,
            acquiredAt: new Date().toISOString(),
          };
          writeFileSync(writerLeaseOwnerPath(path), JSON.stringify(record, null, 2), {
            encoding: "utf8",
            flag: "wx",
            mode: PRIVATE_FILE_MODE,
          });
          this.writerLease = { path, token, liveness };
          return;
        } catch (err) {
          try {
            await stopWriterLeaseLiveness(liveness).catch(() => undefined);
          } finally {
            rmSync(path, { recursive: true, force: true });
          }
          throw new StorageWriterLeaseError(`Could not acquire the storage writer lease at ${path}.`, {
            cause: err,
          });
        }
      }

      let existing: ReturnType<typeof parseWriterLease>;
      try {
        existing = parseWriterLease(path);
      } catch (err) {
        if (err instanceof WriterLeasePendingError) {
          if (attempt < 9) {
            await new Promise((resolve) => setTimeout(resolve, WRITER_LEASE_RETRY_DELAY_MS));
            continue;
          }
          throw invalidWriterLeaseError(path, err);
        }
        throw err;
      }

      let staleReason: "liveness" | "pid" | null = null;
      if (existing.record.version === 3) {
        // A socket refusal is proof only within the same host kernel. Shared
        // network storage may expose the socket path to a different machine.
        if (
          writerScopeId &&
          existing.record.scopeId === writerScopeId &&
          (await probeWriterLeaseLiveness(path, existing.record.token)) === "stale"
        ) {
          staleReason = "liveness";
        }
      } else {
        const sameHost = writerLeaseBelongsToCurrentHost(existing.record) || isTermuxPrivateHomeStorage(this.rootDir);
        if (sameHost && pidDefinitelyExited(existing.record.pid)) staleReason = "pid";
      }
      if (!staleReason) {
        throw new StorageWriterLeaseError(
          `Another Marinara Engine process (PID ${existing.record.pid}, host ${existing.record.hostname}) may be using ${this.rootDir}. ` +
            `Close it before retrying. If it no longer exists, verify every process is stopped and remove only ${path}.`,
        );
      }

      const stalePath = `${path}.stale-${token}`;
      try {
        renameSync(path, stalePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new StorageWriterLeaseError(`Could not safely reclaim the exited writer's lease at ${path}.`, {
          cause: err,
        });
      }
      let moved: ReturnType<typeof parseWriterLease>;
      try {
        moved = parseWriterLease(stalePath);
      } catch (err) {
        if (!existsSync(path)) renameSync(stalePath, path);
        throw err;
      }
      if (moved.raw !== existing.raw || moved.record.token !== existing.record.token) {
        if (!existsSync(path)) renameSync(stalePath, path);
        throw new StorageWriterLeaseError(`The storage writer lease at ${path} changed during stale recovery.`);
      }
      rmSync(stalePath, { recursive: true });
      logger.warn(
        { previousPid: existing.record.pid, path, staleReason },
        staleReason === "liveness"
          ? "[file-storage] Reclaimed the writer lease after confirming the previous owner was no longer listening."
          : "[file-storage] Reclaimed the writer lease after confirming its same-host PID exited.",
      );
    }
    throw new StorageWriterLeaseError(`The storage writer lease at ${path} changed repeatedly; retry startup.`);
  }

  private async releaseWriterLease() {
    const active = this.writerLease;
    if (!active) return;
    await stopWriterLeaseLiveness(active.liveness);
    if (!existsSync(active.path)) {
      logger.warn({ path: active.path }, "[file-storage] The writer lease was already removed.");
      this.writerLease = null;
      return;
    }
    let current: ReturnType<typeof parseWriterLease>;
    try {
      current = parseWriterLease(active.path);
    } catch (err) {
      if (err instanceof WriterLeasePendingError) throw invalidWriterLeaseError(active.path, err);
      throw err;
    }
    if (current.record.token !== active.token) {
      throw new StorageWriterLeaseError(`The storage writer lease at ${active.path} belongs to another process.`);
    }
    const releasedPath = `${active.path}.released-${active.token}`;
    try {
      renameSync(active.path, releasedPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.writerLease = null;
        return;
      }
      throw err;
    }
    let moved: ReturnType<typeof parseWriterLease>;
    try {
      moved = parseWriterLease(releasedPath);
    } catch (err) {
      if (!existsSync(active.path)) renameSync(releasedPath, active.path);
      throw err;
    }
    if (moved.record.token !== active.token) {
      if (!existsSync(active.path)) renameSync(releasedPath, active.path);
      throw new StorageWriterLeaseError(`The storage writer lease at ${active.path} changed during release.`);
    }
    rmSync(releasedPath, { recursive: true });
    this.writerLease = null;
  }

  async initialize() {
    mkdirSync(this.rootDir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await this.acquireWriterLease();
    try {
      hardenPrivateStorageTree(this.rootDir);

      // Refuse newer-format data BEFORE any migration side effect: the
      // migration renames monoliths and writes shard files, which must never
      // happen in a directory this build cannot read (#4708).
      this.assertStorageFormatSupported();

      await this.migrateShardedTables();

      if (fileStoreManifestExists(this.rootDir) || tableSnapshotsExist(this.rootDir)) {
        await this.loadFileSnapshots();
      }

      // AFTER the load (the row must land in the loaded table) and BEFORE the
      // startup flush persists it alongside the migrated shards.
      this.recordMigrationNotice();

      if (this.dirty || this.dirtyTables.size > 0) {
        await this.flush(true);
      }

      this.installAutosave();
      logger.info(`[file-storage] Using file-native storage at ${this.rootDir}`);
    } catch (err) {
      try {
        await this.releaseWriterLease();
      } catch (releaseError) {
        throw new AggregateError([err, releaseError], "Storage initialization and writer-lease cleanup failed");
      }
      throw err;
    }
  }

  rows(table: Table | string) {
    return this.tables.get(getMeta(table).name) ?? [];
  }

  /**
   * One-way monolith -> per-chat-shard migration (#4708), classified per
   * table into five states. The renamed `.pre-shard` files ARE the automatic
   * backup: preserved byte-for-byte, exactly once, never auto-deleted. A
   * sentinel file makes crash-recovery decidable — without it, "monolith and
   * shards both exist" is ambiguous between a crashed migration (monolith
   * authoritative) and a downgrade artifact (shards authoritative, monolith
   * quarantined, NEVER merged: the two sides forked and any merge order is a
   * guess).
   */
  private async migrateShardedTables() {
    // Message id -> chatId mapping for grouping swipes. Populated by the
    // messages migration when it runs this boot; rebuilt from the already-
    // migrated message shards when only the swipes migration remains (a crash
    // exactly between the two tables).
    const migrationIndex = new Map<string, string>();
    let expectedTableCounts: Record<string, number> = {};
    try {
      expectedTableCounts =
        parseJsonFile<TableSnapshotManifest | null>(manifestPath(this.rootDir), null).value?.tables ?? {};
    } catch {
      // The full loader reports manifest corruption later. Recovery here is
      // intentionally limited to a trustworthy positive row count.
    }
    for (const table of SHARDED_TABLES) {
      const monolithPath = tableFilePath(this.rootDir, table);
      const monolithBak = `${monolithPath}.bak`;
      let monolithPresent = existsSync(monolithPath) || existsSync(monolithBak);
      const dir = shardDirPath(this.rootDir, table);
      const shardDirPresent = existsSync(dir);
      const sentinelPath = join(dir, SHARD_MIGRATION_SENTINEL);
      const sentinelPresent = shardDirPresent && existsSync(sentinelPath);
      const shardPrimaries = shardDirPresent
        ? discoverShardPrimaries(
            (() => {
              try {
                return readdirSync(dir);
              } catch {
                return [] as string[];
              }
            })(),
          )
        : [];
      const manifestRowCount = expectedTableCounts[table];
      const expectedRowCount =
        typeof manifestRowCount === "number" && Number.isSafeInteger(manifestRowCount) && manifestRowCount > 0
          ? manifestRowCount
          : 0;

      // A copied/restored profile can retain the byte-for-byte pre-shard
      // backup while losing the shard directory itself. Recover only when the
      // manifest proves rows are expected and there are zero shard files;
      // partial shard sets are ambiguous and must never be auto-merged.
      if (!monolithPresent && shardPrimaries.length === 0 && expectedRowCount > 0) {
        const preservedSource = [`${monolithPath}.pre-shard`, `${monolithBak}.pre-shard`].find((path) =>
          existsSync(path),
        );
        if (preservedSource) {
          await copyFile(preservedSource, monolithPath);
          if (process.platform !== "win32") await chmod(monolithPath, PRIVATE_FILE_MODE);
          monolithPresent = true;
          logger.warn(
            "[file-storage] Restoring %s from its preserved pre-shard backup because the manifest expects %d rows but no shard files exist",
            table,
            expectedRowCount,
          );
        }
      }

      if (!monolithPresent) {
        if (sentinelPresent) {
          // The renames completed but the crash hit before the sentinel was
          // removed — the shards are complete.
          await unlink(sentinelPath).catch(() => undefined);
        }
        if (table === "messages" && shardDirPresent && this.swipesMigrationPending()) {
          // Keep the index available ONLY when the swipes migration still has
          // to run this boot (a crash exactly between the two tables). On a
          // normal sharded boot this would re-read every message shard that
          // loadFileSnapshots is about to read anyway, doubling startup work.
          this.buildMigrationIndexFromShards(dir, migrationIndex);
        }
        continue; // fresh install or normal sharded boot
      }

      if (shardDirPresent) {
        // "Downgrade artifact" requires ACTUAL shard data. The migration
        // itself creates monolith+dir with no sentinel for one syscall
        // (mkdir before the sentinel write) — a crash there must classify as
        // a crashed migration, or the monolith would be quarantined in favor
        // of an EMPTY shard dir.
        const hasShardData = shardPrimaries.length > 0;
        if (sentinelPresent || !hasShardData) {
          logger.warn(
            "[file-storage] A previous %s shard migration did not complete; retrying from the untouched monolith",
            table,
          );
          // Remove only the incomplete migration artifacts (shard data files,
          // their .bak/.tmp companions, and the sentinel). Quarantine files
          // (.corrupt-*) in this directory are user-recovery data the store
          // never deletes on its own — a blanket rmSync would break that.
          let leftovers: string[] = [];
          try {
            leftovers = readdirSync(dir);
          } catch {
            /* dir vanished — nothing to clean */
          }
          for (const name of leftovers) {
            if (
              isShardDataFileName(name) ||
              name.endsWith(".json.bak") ||
              name.includes(".tmp-") ||
              name === SHARD_MIGRATION_SENTINEL
            ) {
              rmSync(join(dir, name), { force: true });
            }
          }
        } else {
          // Downgrade artifact: a pre-shard build recreated a monolith while
          // the shards kept living. The shards are authoritative.
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const files: Array<{ from: string; to: string }> = [];
          for (const path of [monolithPath, monolithBak]) {
            if (!existsSync(path)) continue;
            const to = `${path}.post-downgrade-${stamp}`;
            await rename(path, to);
            files.push({ from: path, to });
          }
          this.quarantinedTables.push({ table, files });
          logger.error(
            { table, files },
            "[file-storage] Found a %s monolith alongside shards (written by an older build after the shard " +
              "migration). The shards are authoritative; the conflicting monolith was quarantined, never merged. " +
              "Recover any rows it holds manually if needed.",
            table,
          );
          if (table === "messages" && this.swipesMigrationPending()) {
            this.buildMigrationIndexFromShards(shardDirPath(this.rootDir, table), migrationIndex);
          }
          continue;
        }
      }

      await this.migrateMonolithToShards(table, monolithPath, monolithBak, dir, sentinelPath, migrationIndex);
    }
  }

  /**
   * True while the message_swipes monolith (or its .bak) is still on disk —
   * the only state in which the swipes migration can run this boot and need
   * the messageId -> chatId index. SHARDED_TABLES orders messages first, so
   * nothing has consumed the monolith yet when this is checked.
   */
  private swipesMigrationPending() {
    const swipesMonolith = tableFilePath(this.rootDir, "message_swipes");
    return existsSync(swipesMonolith) || existsSync(`${swipesMonolith}.bak`);
  }

  /** Rebuilds the messageId -> chatId migration index from existing shard files. */
  private buildMigrationIndexFromShards(dir: string, index: Map<string, string>) {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const fileName of discoverShardPrimaries(entries)) {
      for (const candidate of [join(dir, fileName), join(dir, `${fileName}.bak`)]) {
        try {
          const rows = JSON.parse(readFileSync(candidate, "utf8"));
          if (!Array.isArray(rows)) break;
          for (const row of rows) {
            if (isRowRecord(row) && typeof row.id === "string" && typeof row.chatId === "string") {
              index.set(row.id, row.chatId);
            }
          }
          break;
        } catch {
          /* try the .bak; fully unreadable shards are handled by the load pipeline */
        }
      }
    }
  }

  private async migrateMonolithToShards(
    table: string,
    monolithPath: string,
    monolithBak: string,
    dir: string,
    sentinelPath: string,
    migrationIndex: Map<string, string>,
  ) {
    const meta = getMeta(table);
    mkdirSync(dir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await writeFile(sentinelPath, new Date().toISOString(), { encoding: "utf8", mode: PRIVATE_FILE_MODE });

    // The monolith loads through the exact pipeline the flat loader uses, so
    // .bak recovery, malformed-row quarantine, and normalizeRow all apply.
    const { value: rows, recoveredFromBackup } = parseJsonFile<Row[]>(monolithPath, []);
    const parsedRows = Array.isArray(rows) ? rows : [];
    const source = parsedRows.filter(isRowRecord);
    const malformedRowCount = parsedRows.length - source.length;
    if (malformedRowCount > 0) {
      const sourcePath = recoveredFromBackup && existsSync(monolithBak) ? monolithBak : monolithPath;
      const files = await preserveMalformedRowSource(sourcePath, table);
      if (files.length > 0) this.quarantinedTables.push({ table, files });
      logger.error(
        { table, malformedRowCount },
        "[file-storage] Skipped malformed rows while sharding %s; the source file is preserved for manual recovery.",
        table,
      );
    }
    const normalized = source.map((row) => normalizeRow(meta, migrateFileBackedRow(table, row)));

    const rowsByShard = new Map<string, Row[]>();
    for (const row of normalized) {
      // Migration-time twin of shardKeyForRow: it runs BEFORE the load builds
      // messageShardIndex, so swipes resolve through the migrationIndex the
      // messages pass populated instead.
      let key: string;
      if (table === "message_swipes") {
        key = migrationIndex.get(row.messageId) ?? UNASSIGNED_SHARD_KEY;
      } else {
        const value = row[getFileTableShardStrategy(table as FileBackedTable).column];
        key = typeof value === "string" && value ? value : UNASSIGNED_SHARD_KEY;
        if (table === "messages" && typeof row.id === "string" && typeof row.chatId === "string") {
          // Canonical key, never "": swipes must resolve to the same raw key
          // their parent grouped under.
          migrationIndex.set(row.id, key);
        }
      }
      const bucket = rowsByShard.get(key);
      if (bucket) bucket.push(row);
      else rowsByShard.set(key, [row]);
    }
    for (const [key, shardRows] of rowsByShard) {
      await atomicWriteFile(shardFilePath(this.rootDir, table, encodeShardKey(key)), JSON.stringify(shardRows), {
        refreshBackup: true,
      });
    }

    // Only after EVERY shard write: rename the monolith and its .bak aside.
    // The .bak rename is the whole point — the store's fallback loader would
    // otherwise let a downgraded build silently resurrect stale history. The
    // renamed files are the user's automatic pre-migration backup.
    // ORDER MATTERS: the .bak goes first. A crash between the renames then
    // leaves the FRESH primary discoverable for the retry; the reverse order
    // would leave only the one-flush-stale .bak, and the retry would rebuild
    // the shards from it — silently losing the newest messages.
    for (const path of [monolithBak, monolithPath]) {
      if (!existsSync(path)) continue;
      // Never clobber an existing .pre-shard: a later re-migration (after an
      // unshard round trip) would otherwise silently replace the pristine
      // pre-migration original with a rebuilt monolith — the docs promise
      // these files are never deleted by the Engine. Subsequent copies get
      // the timestamped form, matching the .post-downgrade-/.post-unshard-
      // convention.
      const preferred = `${path}.pre-shard`;
      const target = existsSync(preferred) ? `${preferred}-${corruptionTimestamp()}` : preferred;
      await rename(path, target);
    }
    await unlink(sentinelPath).catch(() => undefined);
    // Land the current-version manifest on the next flush.
    this.dirty = true;
    this.migratedTables.push(table);
    logger.info(
      "[file-storage] Sharded %s: %d rows into %d ownership files (originals preserved as .pre-shard)",
      table,
      normalized.length,
      rowsByShard.size,
    );
  }

  async transaction<T>(fn: (tx: FileNativeDB) => Promise<T> | T, tx: FileNativeDB): Promise<T> {
    // Copy-on-write rollback, isolated to this transaction's async context:
    // instead of cloning every table up front (O(total rows) per call, on the
    // per-turn setMemories hot path), snapshot each table only on its first
    // mutation by THIS transaction and restore only those. Other writes wait for
    // this transaction, then run against its committed or restored state.
    if (this.txContext.getStore()) {
      // Nested call: run inside the outer transaction's context so the whole
      // nest rolls back together; the outermost owns snapshot/restore.
      return await fn(tx);
    }
    this.assertWritable();

    let releaseTransaction!: () => void;
    const previousTransaction = this.transactionQueue;
    this.transactionQueue = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    await previousTransaction;
    if (this.activeFlush) await this.activeFlush;

    const ctx: FileTransactionContext = {
      snapshots: new Map<string, Row[]>(),
      dirtyTables: new Set<string>(),
      dirtyShards: new Map<string, Set<string>>(),
      flushed: false,
    };
    const dirtySnapshot = this.dirty;
    const dirtyTablesSnapshot = new Set(this.dirtyTables);
    // Deep copy — a shallow one would let in-transaction writes mutate the
    // snapshot's Sets and corrupt the rollback state (#4708).
    const dirtyShardsSnapshot = new Map([...this.dirtyShards].map(([table, keys]) => [table, new Set(keys)]));
    this.activeTransactionCount++;

    try {
      const result = await this.txContext.run(ctx, () => fn(tx));
      // Flush on commit only for tables whose durability the caller reasons about across a
      // crash (attempt claims must never be replayed as free budget). Everything else keeps
      // the batched flush: this runs on hot per-turn paths like setMemories.
      if ([...ctx.dirtyTables].some((table) => DURABLE_ON_COMMIT_TABLES.has(table))) {
        await this.txContext.run(ctx, () => this.flush(true, true));
      }
      return result;
    } catch (err) {
      for (const tableName of ctx.dirtyTables) {
        const snapshot = ctx.snapshots.get(tableName);
        if (snapshot) this.tables.set(tableName, snapshot);
        // Restoring rows is itself a visible mutation, so it must bump the
        // write generation (#4705): a reader that sampled DURING the
        // transaction may have stored a generation derived from uncommitted
        // rows — without this bump, that stale conclusion would match the
        // live generation after rollback and never be re-examined.
        this.tableWriteGenerations.set(tableName, (this.tableWriteGenerations.get(tableName) ?? 0) + 1);
      }
      this.dirty = dirtySnapshot;
      this.dirtyTables = dirtyTablesSnapshot;
      this.dirtyShards = dirtyShardsSnapshot;
      // Rollback restored the full messages array — the shard index must
      // match the restored rows, not the rolled-back ones (#4708).
      if (ctx.dirtyTables.has("messages")) this.rebuildMessageShardIndex();
      // Same for the orphan markers: a rolled-back parent insert consumed a
      // marker via reindexMovedMessages, and a rolled-back swipe insert may
      // have added one. Rebuild from the restored rows against the rebuilt
      // index, or a later real parent insert would not dirty the unassigned
      // swipe shard.
      if (ctx.dirtyTables.has("messages") || ctx.dirtyTables.has("message_swipes")) {
        this.rebuildOrphanSwipeMessageIds();
      }
      if (ctx.flushed) {
        this.dirty = true;
        for (const tableName of ctx.dirtyTables) this.dirtyTables.add(tableName);
        // Disk was already touched mid-transaction: the affected shards must
        // be rewritten from the restored rows too (#4708).
        for (const [table, keys] of ctx.dirtyShards) {
          const set = this.dirtyShards.get(table) ?? new Set<string>();
          for (const key of keys) set.add(key);
          this.dirtyShards.set(table, set);
        }
        try {
          await this.txContext.run(ctx, () => this.flush(true, true));
        } catch (rollbackError) {
          throw new AggregateError([err, rollbackError], "File-storage transaction and durable rollback both failed");
        }
      }
      throw err;
    } finally {
      this.activeTransactionCount--;
      if (this.activeTransactionCount === 0) {
        for (const resolve of this.transactionIdleWaiters) resolve();
        this.transactionIdleWaiters.clear();
      }
      releaseTransaction();
      if (this.pendingTransactionFlush) {
        this.pendingTransactionFlush = false;
        if (!this.writesClosed) void this.flush();
      }
    }
  }

  private async waitForTransactions(): Promise<void> {
    if (this.activeTransactionCount === 0) return;
    await new Promise<void>((resolve) => this.transactionIdleWaiters.add(resolve));
  }

  private async waitForWritableTurn(): Promise<void> {
    this.assertWritable();
    if (this.activeTransactionCount > 0 && !this.txContext.getStore()) {
      await this.waitForTransactions();
    }
  }

  private assertWritable() {
    if (this.writesClosed && !this.txContext.getStore()) {
      throw new StorageWriterLeaseError("File-native storage is closing or closed and cannot accept writes.");
    }
  }

  /**
   * Snapshot a table's current rows the first time the active transaction mutates
   * it, so a rollback can restore just that table. No-op outside a transaction
   * context (so concurrent non-transactional writes are not captured) or after
   * the table has already been snapshotted this transaction. Must be called
   * BEFORE the in-place mutation so the snapshot captures the pre-mutation state.
   */
  private recordTxMutation(tableName: string) {
    const ctx = this.txContext.getStore();
    if (!ctx) return;
    if (ctx.dirtyTables.has(tableName)) return;
    const currentRows = this.tables.get(tableName);
    ctx.snapshots.set(tableName, currentRows ? currentRows.map((row) => ({ ...row })) : []);
    ctx.dirtyTables.add(tableName);
  }

  select<TProjection extends Projection | undefined = undefined>(
    projection?: TProjection,
  ): SelectFromBuilder<TProjection> {
    return {
      from: (table) => new SelectQuery(this, getMeta(table), projection) as never,
    };
  }

  count(table: Table, condition?: Condition) {
    const meta = getMeta(table);
    let count = 0;
    for (const row of this.rows(meta.name)) {
      if (evaluateCondition(condition, this.contextForRow(meta, row))) count += 1;
    }
    return count;
  }

  insert(table: Table): InsertBuilder {
    const meta = getMeta(table);
    return {
      values: (rows) => {
        const runInsert = (onConflict?: { target: unknown; set: Row }) =>
          executable(async () => {
            await this.waitForWritableTurn();
            this.assertWritable();
            const conflictColumns = normalizeConflictTargets(onConflict?.target);
            const inputRows = Array.isArray(rows) ? rows : [rows];
            const target = this.rows(meta.name);
            const nextRows = target.map(cloneRow);
            const affectedRows: Row[] = [];
            for (const input of inputRows) {
              const row = prepareInsertRow(meta, input);
              const conflictKeys =
                conflictColumns.length > 0 ? conflictColumns : meta.primaryKey ? [meta.primaryKey] : [];
              const duplicateIndex = onConflict ? findMatchingRowIndex(nextRows, row, conflictKeys) : -1;
              if (onConflict && duplicateIndex !== -1) {
                const existing = nextRows[duplicateIndex]!;
                const ctx = this.contextForRow(meta, existing);
                const candidate = cloneRow(existing);
                for (const [key, value] of Object.entries(onConflict.set)) {
                  const column = meta.byKey.get(key) ?? meta.byDbName.get(key);
                  candidate[column?.key ?? key] = resolveValue(value, ctx);
                }
                assertUniqueRow(meta, nextRows, candidate, duplicateIndex);
                // Conflict updates can move a row's shard key (profile import
                // rewrites arbitrary columns) — dirty BOTH the old and new
                // shard or the old file keeps a stale duplicate (#4708).
                affectedRows.push(existing, candidate);
                nextRows[duplicateIndex] = candidate;
              } else {
                assertUniqueRow(meta, nextRows, row);
                affectedRows.push(row);
                nextRows.push(row);
              }
            }
            this.recordTxMutation(meta.name);
            this.tables.set(meta.name, nextRows);
            if (SHARDED_TABLE_SET.has(meta.name)) {
              const shardKeys = this.shardKeysForRows(meta.name, affectedRows);
              if (meta.name === "messages") {
                this.reindexMovedMessages(affectedRows);
              }
              this.markDirty(meta.name, shardKeys);
            } else {
              this.markDirty(meta.name);
            }
          });
        const builder = runInsert() as InsertValuesBuilder;
        builder.onConflictDoUpdate = (config) => runInsert(config);
        return builder;
      },
    };
  }

  update(table: Table): UpdateSetBuilder {
    const meta = getMeta(table);
    return {
      set: (patch) => {
        const runUpdate = (condition?: Condition) =>
          executable(async () => {
            await this.waitForWritableTurn();
            this.assertWritable();
            const target = this.rows(meta.name);
            const changedIndexes: number[] = [];
            const nextRows = target.map((row, index) => {
              const ctx = this.contextForRow(meta, row);
              if (!evaluateCondition(condition, ctx)) return row;
              const candidate = cloneRow(row);
              for (const [key, value] of Object.entries(patch)) {
                const column = meta.byKey.get(key) ?? meta.byDbName.get(key);
                candidate[column?.key ?? key] = resolveValue(value, ctx);
              }
              changedIndexes.push(index);
              return candidate;
            });
            if (changedIndexes.length > 0) {
              for (const index of changedIndexes) {
                assertUniqueRow(meta, nextRows, nextRows[index]!, index);
              }
              this.recordTxMutation(meta.name);
              this.tables.set(meta.name, nextRows);
              if (SHARDED_TABLE_SET.has(meta.name)) {
                const affectedRows: Row[] = [];
                for (const index of changedIndexes) {
                  affectedRows.push(target[index]!, nextRows[index]!);
                }
                const shardKeys = this.shardKeysForRows(meta.name, affectedRows);
                if (meta.name === "messages") {
                  this.reindexMovedMessages(affectedRows);
                }
                this.markDirty(meta.name, shardKeys);
              } else {
                this.markDirty(meta.name);
              }
            }
          });
        const builder = runUpdate() as UpdateWhereBuilder;
        builder.where = (condition) => runUpdate(condition);
        return builder;
      },
    };
  }

  delete(table: Table): DeleteBuilder {
    const meta = getMeta(table);
    const runDelete = (condition?: Condition) =>
      executable(async () => {
        await this.waitForWritableTurn();
        this.assertWritable();
        this.deleteWhere(meta, condition);
      });
    const builder = runDelete() as DeleteBuilder;
    builder.where = (condition) => runDelete(condition);
    return builder;
  }

  async flush(force = false, throwOnError = false, allowClosed = false) {
    const transactionContext = this.txContext.getStore();
    if (this.writesClosed && !transactionContext && !allowClosed) this.assertWritable();
    if (this.activeTransactionCount > 0 && !(force && transactionContext)) {
      this.pendingTransactionFlush = true;
      if (transactionContext) return;
      await this.waitForTransactions();
    }
    if (transactionContext && force) transactionContext.flushed = true;
    if (this.activeFlush) {
      await this.activeFlush;
      if (this.dirty || this.dirtyTables.size > 0) await this.flush(force, throwOnError, allowClosed);
      else if (throwOnError && this.lastFlushError) throw this.lastFlushError;
      return;
    }
    if (!force && !this.dirty && this.dirtyTables.size === 0) return;
    this.dirty = false;
    // Snapshot the dirty set and reset it BEFORE the async write. saveFileSnapshots
    // now yields the event loop, so a markDirty() that interleaves during the I/O
    // must be recorded for the NEXT flush instead of being erased by a post-await
    // clear() — the synchronous version had a zero-width window here.
    const dirtyTables = this.dirtyTables;
    this.dirtyTables = new Set();
    const dirtyShards = this.dirtyShards;
    this.dirtyShards = new Map();
    const flush = (async () => {
      try {
        await this.saveFileSnapshots(dirtyTables, dirtyShards);
        this.lastFlushError = null;
      } catch (err) {
        this.lastFlushError = err;
        this.dirty = true;
        // Re-mark the tables we failed to persist so they retry on the next flush
        // (without clobbering any tables marked dirty during the failed write).
        for (const table of dirtyTables) this.dirtyTables.add(table);
        for (const [table, keys] of dirtyShards) {
          const set = this.dirtyShards.get(table) ?? new Set<string>();
          for (const key of keys) set.add(key);
          this.dirtyShards.set(table, set);
        }
        logger.error(err, "[file-storage] Failed to persist file-native storage");
      }
    })();
    this.activeFlush = flush;
    try {
      await flush;
    } finally {
      if (this.activeFlush === flush) this.activeFlush = null;
    }
    if (throwOnError && this.lastFlushError) throw this.lastFlushError;
  }

  close() {
    if (this.closePromise) return this.closePromise;
    this.writesClosed = true;
    this.closePromise = this.finishClose();
    return this.closePromise;
  }

  private async finishClose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.safetyTimer) {
      clearInterval(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.beforeExitHandler) {
      process.off("beforeExit", this.beforeExitHandler);
      this.beforeExitHandler = null;
    }
    try {
      await this.transactionQueue;
      if (this.activeFlush) await this.activeFlush;
      while (this.dirty || this.dirtyTables.size > 0) {
        await this.flush(true, false, true);
        if (this.lastFlushError) throw this.lastFlushError;
      }
    } catch (err) {
      try {
        await this.releaseWriterLease();
      } catch (releaseError) {
        throw new AggregateError([err, releaseError], "Storage shutdown and writer-lease release both failed");
      }
      throw err;
    }
    await this.releaseWriterLease();
  }

  getQuarantinedTables() {
    return this.quarantinedTables.map((entry) => ({
      table: entry.table,
      files: entry.files.map((file) => ({ ...file })),
    }));
  }

  getTableWriteGeneration(table: string): number {
    return this.tableWriteGenerations.get(table) ?? 0;
  }

  contextForRow(meta: TableMeta, row: Row): RowContext {
    return {
      rows: { [meta.name]: row },
      baseTable: meta.name,
      joined: false,
    };
  }

  markDirty(table: string, shardKeys?: Iterable<string>) {
    // The generation stays keyed on the BARE logical table name for every
    // shard write — the #4705 contract ("something in this table changed")
    // must not become shard-scoped.
    this.tableWriteGenerations.set(table, (this.tableWriteGenerations.get(table) ?? 0) + 1);
    this.dirty = true;
    this.dirtyTables.add(table);
    if (shardKeys) {
      const set = this.dirtyShards.get(table) ?? new Set<string>();
      for (const key of shardKeys) set.add(key);
      this.dirtyShards.set(table, set);
      const ctx = this.txContext.getStore();
      if (ctx) {
        const ctxSet = ctx.dirtyShards.get(table) ?? new Set<string>();
        for (const key of shardKeys) ctxSet.add(key);
        ctx.dirtyShards.set(table, ctxSet);
      }
    }
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
    this.debounceTimer.unref?.();
  }

  /**
   * Shard keys for a set of rows of a sharded table (#4708). An orphan row
   * (no usable chatId, or a swipe with no parent message) lands in the
   * reserved unassigned shard rather than vanishing on the next flush.
   */
  private shardKeysForRows(table: string, rows: Iterable<Row>): Set<string> {
    const keys = new Set<string>();
    for (const row of rows) keys.add(this.shardKeyForRow(table, row));
    return keys;
  }

  /**
   * Raw shard key for one row — the single source of truth for how a table's
   * rows map to ownership files. Child tables use SHARD_KEY_COLUMNS; standalone
   * tables use their primary key; message swipes resolve through their parent.
   */
  private shardKeyForRow(table: string, row: Row): string {
    if (table === "message_swipes") {
      const chatId = this.messageShardIndex.get(row.messageId);
      // Deliberate side effect: every path that resolves a swipe's shard
      // funnels through here (load, insert, update, self-heal, dedup), so
      // this is the single point that learns a swipe is currently orphaned —
      // the knowledge reindexMovedMessages needs when the parent arrives
      // later.
      if (chatId === undefined && typeof row.messageId === "string") {
        this.orphanSwipeMessageIds.add(row.messageId);
      }
      return chatId ?? UNASSIGNED_SHARD_KEY;
    }
    const value = row[getFileTableShardStrategy(table as FileBackedTable).column];
    return typeof value === "string" && value ? value : UNASSIGNED_SHARD_KEY;
  }

  /**
   * Updates the message shard index for written message rows and, when a
   * message MOVED between chats (profile-import upserts can rewrite chatId),
   * dirties the swipes' OLD and NEW shards too. Swipe rows regroup by the
   * live index at flush time — without this, both swipe files would stay
   * clean while the rows changed buckets, duplicating or dropping them.
   */
  private reindexMovedMessages(affectedRows: Row[]) {
    const movedSwipeShards = new Set<string>();
    for (const row of affectedRows) {
      if (typeof row.id !== "string" || typeof row.chatId !== "string") continue;
      const previous = this.messageShardIndex.get(row.id);
      // A first-time index entry is also a "move" when the message ADOPTS
      // orphan swipes: they regroup from the unassigned shard into the chat's
      // shard, and the unassigned file would otherwise keep its stale copies.
      // Set.delete doubles as the membership test and the cleanup.
      // Canonical key, never "": every index consumer compares raw keys, so
      // "" and UNASSIGNED_SHARD_KEY must not alias the same shard file.
      const canonical = row.chatId || UNASSIGNED_SHARD_KEY;
      const adoptsOrphans = previous === undefined && this.orphanSwipeMessageIds.delete(row.id);
      if ((previous !== undefined && previous !== canonical) || adoptsOrphans) {
        movedSwipeShards.add(previous ?? UNASSIGNED_SHARD_KEY);
        movedSwipeShards.add(canonical);
      }
      this.messageShardIndex.set(row.id, canonical);
    }
    if (movedSwipeShards.size > 0) {
      const hasSwipes = (this.tables.get("message_swipes") ?? []).length > 0;
      if (hasSwipes) this.markDirty("message_swipes", movedSwipeShards);
    }
  }

  /** Rebuilds the orphan-swipe markers from the current rows (rollback path). */
  private rebuildOrphanSwipeMessageIds() {
    this.orphanSwipeMessageIds.clear();
    for (const row of this.tables.get("message_swipes") ?? []) {
      if (typeof row.messageId === "string" && !this.messageShardIndex.has(row.messageId)) {
        this.orphanSwipeMessageIds.add(row.messageId);
      }
    }
  }

  /** Rebuilds the messageId -> chatId index from the current messages rows. */
  private rebuildMessageShardIndex() {
    this.messageShardIndex.clear();
    for (const row of this.tables.get("messages") ?? []) {
      if (typeof row.id === "string" && typeof row.chatId === "string") {
        this.messageShardIndex.set(row.id, row.chatId || UNASSIGNED_SHARD_KEY);
      }
    }
  }

  private deleteWhere(meta: TableMeta, condition?: Condition) {
    const target = this.rows(meta.name);
    const kept: Row[] = [];
    const deleted: Row[] = [];
    target.forEach((row) => {
      if (evaluateCondition(condition, this.contextForRow(meta, row))) {
        deleted.push(row);
      } else {
        kept.push(row);
      }
    });
    if (deleted.length === 0) return;
    this.recordTxMutation(meta.name);
    this.tables.set(meta.name, kept);
    if (SHARDED_TABLE_SET.has(meta.name)) {
      this.markDirty(meta.name, this.shardKeysForRows(meta.name, deleted));
    } else {
      this.markDirty(meta.name);
    }
    this.applySetNullRelations(meta.name as FileBackedTable, deleted);
    this.applyCascades(meta.name as FileBackedTable, deleted);
    // Prune the shard index only AFTER cascades: the nested swipe deletion
    // resolves its shard through the parent entries being removed here (#4708).
    if (meta.name === "messages") {
      for (const row of deleted) {
        if (typeof row.id === "string") this.messageShardIndex.delete(row.id);
      }
    }
  }

  private applySetNullRelations(parentTable: FileBackedTable, deletedRows: Row[]) {
    for (const relation of SET_NULL_RELATIONS.filter((entry) => entry.parent === parentTable)) {
      const childMeta = getMeta(relation.child);
      const deletedValues = new Set(deletedRows.map((row) => row[relation.parentKey]));
      const changedRows: Row[] = [];
      for (const row of this.rows(childMeta.name)) {
        if (row[relation.childKey] != null && deletedValues.has(row[relation.childKey])) {
          if (changedRows.length === 0) this.recordTxMutation(childMeta.name);
          row[relation.childKey] = null;
          changedRows.push(row);
        }
      }
      if (changedRows.length > 0) {
        // A sharded child needs its shard keys, like every other mutation
        // path — a bare markDirty leaves dirtyShards empty and the flush
        // never writes the null-out to disk (#4708).
        if (SHARDED_TABLE_SET.has(childMeta.name)) {
          this.markDirty(childMeta.name, this.shardKeysForRows(childMeta.name, changedRows));
        } else {
          this.markDirty(childMeta.name);
        }
      }
    }
  }

  private applyCascades(parentTable: FileBackedTable, deletedRows: Row[]) {
    for (const cascade of CASCADES.filter((entry) => entry.parent === parentTable)) {
      const childMeta = getMeta(cascade.child);
      const deletedValues = new Set(deletedRows.map((row) => row[cascade.parentKey]));
      const childColumn = childMeta.byKey.get(cascade.childKey)?.column;
      if (childColumn) {
        this.deleteWhere(childMeta, inArray(childColumn, Array.from(deletedValues)));
      } else {
        const err = new Error(`Cascade child column ${cascade.child}.${cascade.childKey} is not registered`);
        logger.error(
          { err, parent: parentTable, parentKey: cascade.parentKey, child: cascade.child, childKey: cascade.childKey },
          "[file-storage] Cascade configuration is invalid; child rows were not deleted",
        );
      }
    }
  }

  /**
   * Persists the one-time post-migration notice (#4756) as an app_settings
   * row so the client can explain what just happened. Durable across
   * restarts — a headless first boot cannot lose it. An unacknowledged
   * notice from an earlier migration is merged (its original fromFormat and
   * table list win) rather than overwritten; an acknowledged (empty) value
   * is replaced only when a NEW migration ran this boot. Fresh installs
   * migrate nothing and never write one.
   */
  private recordMigrationNotice() {
    if (this.migratedTables.length === 0) return;
    const rows = this.tables.get("app_settings") ?? [];
    const existing = rows.find((row) => row.key === STORAGE_MIGRATION_NOTICE_SETTINGS_KEY);
    let fromFormat = this.preMigrationManifestVersion;
    let tables = [...this.migratedTables];
    if (existing && typeof existing.value === "string" && existing.value) {
      try {
        const prior = JSON.parse(existing.value) as { fromFormat?: unknown; migratedTables?: unknown };
        // The ORIGINAL fromFormat wins the merge — including an explicit null
        // (no manifest existed); only an absent/invalid property falls back
        // to this boot's value.
        if (prior.fromFormat === null || typeof prior.fromFormat === "number") fromFormat = prior.fromFormat;
        if (Array.isArray(prior.migratedTables)) {
          tables = [
            ...new Set([
              ...prior.migratedTables.filter((entry): entry is string => typeof entry === "string"),
              ...tables,
            ]),
          ];
        }
      } catch {
        /* unparseable prior value -> replace it */
      }
    }
    const notice: StorageMigrationNotice = {
      fromFormat,
      toFormat: STORAGE_VERSION,
      migratedTables: tables,
      migratedAt: new Date().toISOString(),
    };
    const value = JSON.stringify(notice);
    const updatedAt = new Date().toISOString();
    let noticeRow: Row;
    if (existing) {
      noticeRow = existing;
      noticeRow.value = value;
      noticeRow.updatedAt = updatedAt;
    } else {
      noticeRow = { key: STORAGE_MIGRATION_NOTICE_SETTINGS_KEY, value, updatedAt };
      rows.push(noticeRow);
      this.tables.set("app_settings", rows);
    }
    this.markDirty("app_settings", this.shardKeysForRows("app_settings", [noticeRow]));
  }

  /**
   * Forward version gate, run before the shard migration: a manifest written
   * by a NEWER storage format means this build cannot read the directory, so
   * it must not mutate it either. An unparseable or absent manifest falls
   * through to the existing recovery paths — loadFileSnapshots re-checks the
   * version with full .bak recovery.
   */
  private assertStorageFormatSupported() {
    const path = manifestPath(this.rootDir);
    // A crash can leave only manifest.json.bak — parseJsonFile recovers the
    // version from it, so the gate must not short-circuit on a missing
    // primary alone.
    if (!existsSync(path) && !existsSync(`${path}.bak`)) return;
    let version: unknown;
    try {
      version = parseJsonFile<TableSnapshotManifest | null>(path, null).value?.version;
    } catch {
      return;
    }
    // Captured for the post-migration notice (#4756): this is the last read
    // of the PRE-migration manifest, so it is the only place the "migrated
    // from format N" value exists.
    if (typeof version === "number") this.preMigrationManifestVersion = version;
    if (typeof version === "number" && version > STORAGE_VERSION) {
      throw new StorageFormatTooNewError(version, STORAGE_VERSION);
    }
  }

  private async loadFileSnapshots() {
    // The manifest is recoverable from on-disk table files, so a corrupted
    // manifest (e.g. both manifest.json and manifest.json.bak nulled by a
    // hard crash mid-write) shouldn't block startup. Table files recover from
    // .bak when possible, then fall back to [] only when both files are
    // unreadable so startup can still reach the UI.
    let needsManifestRewrite = false;
    let declaredTableCounts: Record<string, number> | undefined;
    try {
      const path = manifestPath(this.rootDir);
      const result = parseJsonFile<TableSnapshotManifest | null>(path, null);
      // Forward version gate: refuse to load data written by a NEWER storage
      // format instead of silently misreading it. Honest scope note: this only
      // protects downgrades ONTO this build and later — the pre-#4708 builds
      // never read the version at all, which is why the primary downgrade
      // guard lives in the launcher/updater.
      const manifestVersion = result.value?.version;
      declaredTableCounts = result.value?.tables;
      if (typeof manifestVersion === "number" && manifestVersion > STORAGE_VERSION) {
        throw new StorageFormatTooNewError(manifestVersion, STORAGE_VERSION);
      }
      // Any manifest whose version is not exactly STORAGE_VERSION must be
      // rewritten promptly — stale (a crash between the migration and its
      // first flush leaves sharded data under a version-2 manifest), absent
      // (tables exist but manifest.json was lost), or non-numeric. The
      // launcher/updater downgrade guard trusts manifest.version, and a
      // lagging or missing value would let it approve a downgrade onto data
      // the older build cannot read (#4708).
      needsManifestRewrite =
        result.recoveredFromBackup || result.recoveredFromFallback || manifestVersion !== STORAGE_VERSION;
      if (result.recoveredFromBackup || result.recoveredFromFallback) {
        this.backupRecoveredPaths.add(path);
      }
    } catch (err) {
      if (err instanceof StorageFormatTooNewError) throw err;
      logger.error(
        err,
        "[file-storage] Manifest unparseable from primary and backup; continuing with empty manifest. A fresh one will be written on next save. (path=%s)",
        manifestPath(this.rootDir),
      );
      needsManifestRewrite = true;
    }
    if (needsManifestRewrite) {
      // Force a manifest rewrite on next save so the corrupt main file gets
      // replaced rather than persistently triggering the .bak fallback path.
      this.dirty = true;
    }

    const counts: Record<string, number> = {};
    for (const table of FILE_BACKED_TABLES) {
      if (SHARDED_TABLE_SET.has(table)) continue; // loaded below via shard discovery (#4708)
      const meta = getMeta(table);
      const path = tableFilePath(this.rootDir, table);
      const {
        value: rows,
        recoveredFromBackup,
        recoveredFromFallback,
        unreadablePaths,
      } = parseJsonFile<Row[]>(path, []);
      const parsedRows = Array.isArray(rows) ? rows : [];
      const source = parsedRows.filter(isRowRecord);
      const malformedRowCount = parsedRows.length - source.length;
      if (malformedRowCount > 0) {
        const sourcePath = recoveredFromBackup && existsSync(`${path}.bak`) ? `${path}.bak` : path;
        const files = await preserveMalformedRowSource(sourcePath, table);
        if (files.length > 0) this.quarantinedTables.push({ table, files });
        logger.error(
          { table, file: sourcePath, malformedRowCount, preservedFiles: files.map((file) => file.to) },
          "[file-storage] Skipped malformed table rows and preserved the source file for manual recovery.",
        );
        this.backupRecoveredPaths.add(path);
        this.dirtyTables.add(table);
        this.dirty = true;
      }
      const normalized = source.map((row) => normalizeRow(meta, migrateFileBackedRow(table, row)));
      this.tables.set(table, normalized);
      counts[table] = normalized.length;
      if (source.some((row) => row.mode === "visual_novel")) {
        // Persist the normalized mode so the rewrite happens once, not on every boot.
        this.dirtyTables.add(table);
        this.dirty = true;
      }
      const needsMigration = source.some((row) => fileBackedRowNeedsMigration(table, row));
      if (needsMigration) {
        // Persist the renamed keys on the next flush, alongside the `visibility` /
        // `publicAccountId` rollback mirrors the migration deliberately retains.
        this.dirtyTables.add(table);
        this.dirty = true;
      }
      if (recoveredFromBackup || recoveredFromFallback) {
        this.backupRecoveredPaths.add(path);
        // Same self-heal: rewrite the corrupt main file from in-memory data on
        // the next flush, while suppressing .bak refresh for that write so a
        // corrupt primary is never copied over the recovery source.
        this.dirtyTables.add(table);
        this.dirty = true;
      }
      if (recoveredFromFallback && unreadablePaths.length > 0) {
        const files = await quarantineUnrecoverableFiles(unreadablePaths, `table ${table}`);
        if (files.length > 0) {
          this.quarantinedTables.push({ table, files });
          logger.error(
            { table, files },
            "[file-storage] Table %s was unrecoverable from primary and backup; quarantined corrupt files and started the table empty. Preserved files require manual recovery.",
            table,
          );
        }
      }
    }

    // Sharded tables (#4708): discover shards by directory listing — readdir
    // also surfaces orphaned shards whose chat no longer exists, which the
    // chats-driven alternative would strand forever. Per-shard recovery uses
    // the exact per-file pipeline the flat loop uses (.bak fallback, malformed
    // row quarantine, normalizeRow). Order matters: messages first, so the
    // shard index exists before swipes need it.
    for (const table of SHARDED_TABLES) {
      const meta = getMeta(table);
      const dir = shardDirPath(this.rootDir, table);
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        /* no shard dir yet — fresh install or pre-migration */
      }
      const dataFiles = discoverShardPrimaries(entries);
      const known = new Set<string>();
      const combined: Row[] = [];
      // Which physical file each row came from (encoded name) — the dedup
      // below needs it to prefer the canonical copy of a duplicated id.
      const rowSource = new Map<Row, string>();
      for (const fileName of dataFiles) {
        const encoded = fileName.slice(0, -".json".length);
        const path = join(dir, fileName);
        const {
          value: rows,
          recoveredFromBackup,
          recoveredFromFallback,
          unreadablePaths,
        } = parseJsonFile<Row[]>(path, []);
        const parsedRows = Array.isArray(rows) ? rows : [];
        const source = parsedRows.filter(isRowRecord);
        const malformedRowCount = parsedRows.length - source.length;
        if (malformedRowCount > 0 && source.length === 0) {
          // EVERY row is malformed — the shard holds nothing usable.
          // Quarantine the files outright (move, not copy): a copy-preserved
          // zombie would reload, re-preserve, and re-log on every startup,
          // because saveShardedTable's zero-row delete only reaches shards
          // with dirty keys and an empty shard never produces one.
          const files = await quarantineUnrecoverableFiles([path, `${path}.bak`], `table ${table} shard ${encoded}`);
          if (files.length > 0) this.quarantinedTables.push({ table, files });
          logger.error(
            { table, shard: encoded, malformedRowCount, preservedFiles: files.map((file) => file.to) },
            "[file-storage] Shard contained only malformed rows; quarantined its files for manual recovery.",
          );
          // Fully quarantined -> not a known shard. If the primary rename
          // failed it is still on disk, so fall through to the copy-preserve
          // path below rather than lose the file.
          if (!existsSync(path)) continue;
        }
        if (malformedRowCount > 0) {
          const sourcePath = recoveredFromBackup && existsSync(`${path}.bak`) ? `${path}.bak` : path;
          const files = await preserveMalformedRowSource(sourcePath, table);
          if (files.length > 0) this.quarantinedTables.push({ table, files });
          logger.error(
            { table, file: sourcePath, malformedRowCount, preservedFiles: files.map((file) => file.to) },
            "[file-storage] Skipped malformed shard rows and preserved the source file for manual recovery.",
          );
          this.backupRecoveredPaths.add(path);
        }
        const needsRowMigration = source.some((row) => fileBackedRowNeedsMigration(table, row));
        const normalized = source.map((row) => normalizeRow(meta, migrateFileBackedRow(table, row)));
        combined.push(...normalized);
        for (const row of normalized) rowSource.set(row, encoded);
        let quarantinedAway = false;
        if (recoveredFromFallback && unreadablePaths.length > 0) {
          const files = await quarantineUnrecoverableFiles(unreadablePaths, `table ${table} shard ${encoded}`);
          if (files.length > 0) {
            this.quarantinedTables.push({ table, files });
            quarantinedAway = files.some((file) => file.from === path);
            logger.error(
              { table, shard: encoded, files },
              "[file-storage] Shard was unrecoverable from primary and backup; quarantined corrupt files. Preserved files require manual recovery.",
            );
          }
        }
        // A shard is "known" only when its primary actually sits on disk: a
        // bak-only shard whose backup was just quarantined has NO file left,
        // and counting it would report a phantom shard in the manifest.
        if (!quarantinedAway && existsSync(path)) known.add(encoded);
        if (normalized.length > 0) {
          const needsRepair =
            recoveredFromBackup || recoveredFromFallback || malformedRowCount > 0 || needsRowMigration;
          const rowKeys = this.shardKeysForRows(table, normalized);
          // A file holding any row whose key does not encode back to the
          // file's own name (hand-edits, stray re-home copies) can never be
          // healed by logical-key dirtying alone: the flush writes the row's
          // REAL shard and skips this physical file, reintroducing the stray
          // rows on every startup. Mark the FILE stale so the flush rewrites
          // it canonically or deletes it.
          const holdsForeignRows = [...rowKeys].some((rawKey) => encodeShardKey(rawKey) !== encoded);
          if (needsRepair) this.backupRecoveredPaths.add(path);
          if (needsRepair || holdsForeignRows) {
            // Self-heal: rewrite from memory on the next flush. The raw keys
            // come from the rows (filenames may be hash forms), and EVERY
            // row's key is dirtied — a recovered file can hold rows for
            // several shards, and dirtying only the first row's key would
            // leave the other destinations stale. Swipes resolve through the
            // message index, which exists because messages load before swipes
            // in SHARDED_TABLES order.
            this.dirty = true;
            this.dirtyTables.add(table);
            const set = this.dirtyShards.get(table) ?? new Set<string>();
            for (const rawKey of rowKeys) set.add(rawKey);
            this.dirtyShards.set(table, set);
          }
          if (holdsForeignRows) {
            const stale = this.staleShardFiles.get(table) ?? new Set<string>();
            stale.add(encoded);
            this.staleShardFiles.set(table, stale);
            logger.warn(
              { table, shard: encoded },
              "[file-storage] Shard file holds rows belonging to other shards; it will be rewritten canonically on the next flush.",
            );
          }
        } else if (recoveredFromBackup) {
          // A corrupt primary recovered from a VALID but EMPTY .bak: there
          // are no row keys to dirty, so mark the FILE stale — the flush
          // removes the corrupt primary and its backup (zero-row shards are
          // deleted by design), instead of re-recovering it every boot.
          this.dirty = true;
          this.dirtyTables.add(table);
          const stale = this.staleShardFiles.get(table) ?? new Set<string>();
          stale.add(encoded);
          this.staleShardFiles.set(table, stale);
        }
      }
      // Belt-and-braces: the monolith preserved one global insertion order;
      // concatenated shards interleave differently. Normalize the order so
      // consumers without an explicit orderBy see a deterministic sequence.
      combined.sort(
        (a, b) =>
          String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) ||
          String(meta.primaryKey ? a[meta.primaryKey] : "").localeCompare(
            String(meta.primaryKey ? b[meta.primaryKey] : ""),
          ),
      );
      // Duplicate primary keys across shards (a stale copy left by an
      // interrupted re-home, or hand-edited files) must not survive into
      // memory. Among copies of one id, a copy living in its CANONICAL shard
      // file beats a foreign copy regardless of sort position — the store
      // last wrote the canonical file authoritatively, and letting a stale
      // foreign copy win would replace the canonical row during
      // self-healing. Equal canonicality keeps the sort-first copy. Losers
      // are dropped and their shards dirtied so the next flush rewrites the
      // stale copies away.
      const logicalKeyOf = (row: Row) => this.shardKeyForRow(table, row);
      const isCanonical = (row: Row) => encodeShardKey(logicalKeyOf(row)) === rowSource.get(row);
      const keptIndexById = new Map<string, number>();
      const deduped: Row[] = [];
      const duplicateShardKeys = new Set<string>();
      let duplicateCount = 0;
      for (const row of combined) {
        const id = meta.primaryKey && typeof row[meta.primaryKey] === "string" ? row[meta.primaryKey] : null;
        if (id && keptIndexById.has(id)) {
          duplicateCount++;
          const keptIndex = keptIndexById.get(id)!;
          const kept = deduped[keptIndex]!;
          let loser = row;
          if (isCanonical(row) && !isCanonical(kept)) {
            deduped[keptIndex] = row;
            loser = kept;
          }
          duplicateShardKeys.add(logicalKeyOf(loser));
          continue;
        }
        if (id) keptIndexById.set(id, deduped.length);
        deduped.push(row);
      }
      if (duplicateCount > 0) {
        logger.warn(
          { table, duplicateCount },
          "[file-storage] Dropped duplicate %s rows found across shards; the affected shards will be rewritten.",
          table,
        );
        this.dirty = true;
        this.dirtyTables.add(table);
        const set = this.dirtyShards.get(table) ?? new Set<string>();
        for (const key of duplicateShardKeys) set.add(key);
        this.dirtyShards.set(table, set);
      }
      this.tables.set(table, deduped);
      counts[table] = deduped.length;
      this.knownShardFiles.set(table, known);
      if (entries.length > 0) this.shardDirsCreated.add(table);
      if (table === "messages") this.rebuildMessageShardIndex();
    }
    if (declaredTableCounts) {
      const mismatches = FILE_BACKED_TABLES.flatMap((table) => {
        const declared = declaredTableCounts?.[table];
        const actual = counts[table] ?? 0;
        if (declared === undefined && actual === 0) return [];
        return typeof declared === "number" && declared === actual ? [] : [{ table, declared, actual }];
      });
      if (mismatches.length > 0) {
        logger.warn(
          { mismatches: mismatches.slice(0, 25), mismatchCount: mismatches.length },
          "[file-storage] Manifest table counts differ from loaded rows; preserving all rows and repairing diagnostics.",
        );
        this.dirty = true;
      }
    }
    logger.info({ tables: counts }, `[file-storage] Loaded file-native data from ${this.rootDir}`);
  }

  /**
   * Persists one sharded table (#4708): only dirty shards and shards whose
   * file is not yet on disk are written — zero existsSync calls for clean
   * shards, which is the entire point on a 750ms flush cadence. Shards whose
   * row count reached zero are deleted (file and .bak) rather than written as
   * [], so deleted chats leave no permanent litter. Returns the shard-file
   * count for the manifest diagnostics.
   */
  private async saveShardedTable(table: string, rows: Row[], dirtyKeys: Set<string>): Promise<number> {
    const known = this.knownShardFiles.get(table) ?? new Set<string>();
    this.knownShardFiles.set(table, known);
    const stale = this.staleShardFiles.get(table);
    // Nothing dirty and nothing to repair: skip the O(rows) regroup — this
    // runs for every sharded table on each flush, so an unrelated write must
    // not scan every stored row on the 750ms flush cadence.
    if (dirtyKeys.size === 0 && (!stale || stale.size === 0)) {
      return known.size;
    }
    const rowsByShard = new Map<string, Row[]>();
    for (const row of rows) {
      const key = this.shardKeyForRow(table, row);
      const bucket = rowsByShard.get(key);
      if (bucket) bucket.push(row);
      else rowsByShard.set(key, [row]);
    }
    if (!this.shardDirsCreated.has(table)) {
      mkdirSync(shardDirPath(this.rootDir, table), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
      this.shardDirsCreated.add(table);
    }
    // Stale physical files (foreign-row holders found at load): force a
    // canonical rewrite when an in-memory shard still maps to the name; the
    // rest are deleted AFTER the write loop, so a crash mid-flush leaves
    // duplicates (healed by the next load) rather than rows that exist only
    // in memory. Cleared per table once the flush lands; a failed flush keeps
    // the marks and retries.
    let effectiveDirty = dirtyKeys;
    const encodedToKey = new Map<string, string>();
    if (stale && stale.size > 0) {
      effectiveDirty = new Set(dirtyKeys);
      for (const key of rowsByShard.keys()) encodedToKey.set(encodeShardKey(key), key);
      for (const encoded of stale) {
        const key = encodedToKey.get(encoded);
        if (key !== undefined) effectiveDirty.add(key);
      }
    }
    for (const [key, shardRows] of rowsByShard) {
      const encoded = encodeShardKey(key);
      if (!effectiveDirty.has(key) && known.has(encoded)) continue;
      const serializedRows = JSON.stringify(shardRows);
      await this.testHooks?.beforeTableWrite?.(`${table}/${encoded}`, serializedRows);
      const path = shardFilePath(this.rootDir, table, encoded);
      await atomicWriteFile(path, serializedRows, { refreshBackup: !this.backupRecoveredPaths.has(path) });
      known.add(encoded);
    }
    if (stale && stale.size > 0) {
      for (const encoded of stale) {
        if (encodedToKey.has(encoded)) continue; // rewritten canonically above
        const path = shardFilePath(this.rootDir, table, encoded);
        // Only a MISSING file is an acceptable unlink outcome: any other
        // failure (EBUSY/EPERM from a scanner holding the handle) must
        // propagate so the flush error path keeps the dirty/stale marks and
        // retries — swallowing it would let `known` claim the file is gone
        // while its rows reload on the next restart.
        await unlinkIgnoringMissing(path);
        await unlinkIgnoringMissing(`${path}.bak`);
        known.delete(encoded);
      }
    }
    for (const key of effectiveDirty) {
      if (rowsByShard.has(key)) continue;
      const encoded = encodeShardKey(key);
      if (!known.has(encoded)) continue;
      const path = shardFilePath(this.rootDir, table, encoded);
      await unlinkIgnoringMissing(path);
      await unlinkIgnoringMissing(`${path}.bak`);
      known.delete(encoded);
    }
    this.staleShardFiles.delete(table);
    return known.size;
  }

  private async saveFileSnapshots(dirtyTables: Set<string>, dirtyShards: Map<string, Set<string>>) {
    mkdirSync(join(this.rootDir, "tables"), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    const tables: Record<string, number> = {};
    const shards: Record<string, number> = {};

    for (const table of FILE_BACKED_TABLES) {
      const rows = this.rows(table);
      tables[table] = rows.length;
      if (SHARDED_TABLE_SET.has(table)) {
        // Sharded tables never touch the flat path — leaving them in this
        // loop's recreate-if-missing branch would silently regrow a full
        // monolith on the very next flush (#4708).
        shards[table] = await this.saveShardedTable(table, rows, dirtyShards.get(table) ?? new Set());
        continue;
      }
      const path = tableFilePath(this.rootDir, table);
      if (dirtyTables.has(table) || !existsSync(path)) {
        const serializedRows = JSON.stringify(rows);
        await this.testHooks?.beforeTableWrite?.(table, serializedRows);
        await atomicWriteFile(path, serializedRows, { refreshBackup: !this.backupRecoveredPaths.has(path) });
      }
    }

    const manifest: TableSnapshotManifest = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      backend: "file-native",
      tables,
      shards,
    };
    const path = manifestPath(this.rootDir);
    const serializedManifest = JSON.stringify(manifest, null, 2);
    await atomicWriteFile(path, serializedManifest, {
      refreshBackup: !this.backupRecoveredPaths.has(path),
    });
    this.backupRecoveredPaths.clear();
  }

  private installAutosave() {
    this.safetyTimer = setInterval(() => {
      void this.flush();
    }, SAFETY_SAVE_MS);
    this.safetyTimer.unref();

    this.beforeExitHandler = () => {
      void this.flush();
    };
    process.on("beforeExit", this.beforeExitHandler);
  }
}

class SelectQuery implements SelectQueryBuilder<any> {
  private joins: JoinSpec[] = [];
  private condition: Condition;
  private orderings: Ordering[] = [];
  private rowLimit: number | null = null;
  private rowOffset = 0;

  constructor(
    private readonly store: FileTableStore,
    private readonly fromMeta: TableMeta,
    private readonly projection?: Projection,
  ) {}

  innerJoin(table: Table, condition: Condition) {
    this.joins.push({ table: getMeta(table), condition });
    return this;
  }

  where(condition: Condition) {
    this.condition = condition;
    return this;
  }

  orderBy(...orderings: Ordering[]) {
    this.orderings = orderings;
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  offset(offset: number) {
    this.rowOffset = offset;
    return this;
  }

  async run() {
    let contexts = this.store.rows(this.fromMeta.name).map((row) => this.store.contextForRow(this.fromMeta, row));

    for (const join of this.joins) {
      const joinedContexts: RowContext[] = [];
      const joinRows = this.store.rows(join.table.name);
      for (const ctx of contexts) {
        joinRows.forEach((row) => {
          const candidate: RowContext = {
            rows: { ...ctx.rows, [join.table.name]: row },
            baseTable: ctx.baseTable,
            joined: true,
          };
          if (evaluateCondition(join.condition, candidate)) {
            joinedContexts.push(candidate);
          }
        });
      }
      contexts = joinedContexts;
    }

    contexts = contexts.filter((ctx) => evaluateCondition(this.condition, ctx));

    if (this.orderings.length > 0) {
      contexts = [...contexts].sort((left, right) => {
        for (const ordering of this.orderings) {
          const leftSpec = orderSpec(ordering, left);
          const rightSpec = orderSpec(ordering, right);
          const comparison = compareValues(leftSpec.value, rightSpec.value);
          if (comparison !== 0) return leftSpec.direction === "desc" ? -comparison : comparison;
        }
        return 0;
      });
    }

    if (this.rowOffset > 0) contexts = contexts.slice(this.rowOffset);
    if (this.rowLimit !== null) contexts = contexts.slice(0, this.rowLimit);
    return contexts.map((ctx) => projectRow(ctx, this.projection));
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export async function createFileNativeDB(testHooks?: FileNativeStoreTestHooks): Promise<FileNativeDB> {
  const rootDir = getFileStorageDir();
  const store = new FileTableStore(rootDir, testHooks);
  await store.initialize();

  const controller: FileNativeStoreController = {
    rootDir,
    flush: () => store.flush(true, true),
    close: () => store.close(),
    getQuarantinedTables: () => store.getQuarantinedTables(),
    getTableWriteGeneration: (table) => store.getTableWriteGeneration(table),
  };

  let db: FileNativeDB;
  db = {
    select: store.select.bind(store) as FileNativeDB["select"],
    count: store.count.bind(store),
    insert: (table) => store.insert(table),
    update: (table) => store.update(table),
    delete: (table) => store.delete(table),
    transaction: (fn) => store.transaction(fn, db),
    _fileStore: controller,
  };
  return db;
}
