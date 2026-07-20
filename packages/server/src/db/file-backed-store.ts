// ──────────────────────────────────────────────
// File-Native Storage
// ──────────────────────────────────────────────
//
// Marinara stores user data as JSON table snapshots under DATA_DIR/storage.
// This in-memory table store persists dirty tables back to those files.
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, readSync, statSync } from "node:fs";
import { copyFile, open, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../lib/logger.js";
import { getFileStorageDir } from "../config/runtime-config.js";
import * as schema from "./schema/index.js";
import { inArray, isFileCondition, isFileOrdering, type FileCondition, type FileOrdering } from "./file-query.js";
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
  version: 2;
  savedAt: string;
  backend: "file-native";
  tables: Record<string, number>;
};

type FileTransactionContext = {
  snapshots: Map<string, Row[]>;
  dirtyTables: Set<string>;
  flushed: boolean;
};

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
};

export type FileNativeDB = {
  select: {
    (): SelectFromBuilder<undefined>;
    <TProjection extends Projection>(projection: TProjection): SelectFromBuilder<TProjection>;
  };
  insert: (table: Table) => InsertBuilder;
  update: (table: Table) => UpdateSetBuilder;
  delete: (table: Table) => DeleteBuilder;
  transaction: <T>(fn: (tx: FileNativeDB) => Promise<T> | T) => Promise<T>;
  _fileStore: FileNativeStoreController;
};

export type FileNativeStoreTestHooks = {
  beforeTableWrite?: (table: string, serializedRows: string) => Promise<void> | void;
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

const STORAGE_VERSION = 2;
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
  "noodle_activity_digests",
  "noodle_refresh_runs",
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
] as const;

type FileBackedTable = (typeof FILE_BACKED_TABLES)[number];

const FILE_BACKED_TABLE_SET = new Set<string>(FILE_BACKED_TABLES);
const TABLES_REVERSE = [...FILE_BACKED_TABLES].reverse();
const isWindows = process.platform === "win32";
const warnedFlushFailures = new Set<string>();

// Parent→child delete graph. Exported as the single source of truth: the Mari
// DB CLI (services/mari-db) consumes it for cascade deletes and its
// dangling-reference validator, so every new relation added here reaches both.
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
    { parent: "noodle_accounts", child: "noodle_accounts", parentKey: "id", childKey: "publicAccountId" },
    { parent: "noodle_accounts", child: "noodle_posts", parentKey: "id", childKey: "authorAccountId" },
    { parent: "noodle_posts", child: "noodle_post_unlocks", parentKey: "id", childKey: "postId" },
    { parent: "chats", child: "messages", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "conversation_call_sessions", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "conversation_call_messages", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "agent_runs", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "agent_memory", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "chat_images", parentKey: "id", childKey: "chatId" },
    { parent: "chats", child: "memory_chunks", parentKey: "id", childKey: "chatId" },
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
  mkdirSync(dirname(path), { recursive: true });
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
    await writeFile(tmpPath, content);
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

function manifestPath(rootDir: string) {
  return join(rootDir, "manifest.json");
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
  const escaped = String(pattern ?? "")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(String(value ?? ""));
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
    return matchesLike(resolveValue(condition.value, ctx), resolveValue(condition.pattern, ctx));
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
  private backupRecoveredPaths = new Set<string>();
  private dirty = false;
  private activeFlush: Promise<void> | null = null;
  private lastFlushError: unknown = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private safetyTimer: NodeJS.Timeout | null = null;
  private beforeExitHandler: (() => void) | null = null;
  private loadedManifest: TableSnapshotManifest | null = null;
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

  constructor(
    private readonly rootDir: string,
    private readonly testHooks?: FileNativeStoreTestHooks,
  ) {
    for (const table of FILE_BACKED_TABLES) {
      this.tables.set(table, []);
    }
  }

  async initialize() {
    mkdirSync(this.rootDir, { recursive: true });

    if (fileStoreManifestExists(this.rootDir) || tableSnapshotsExist(this.rootDir)) {
      await this.loadFileSnapshots();
    }

    if (this.dirty || this.dirtyTables.size > 0) {
      await this.flush(true);
    }

    this.installAutosave();
    logger.info(`[file-storage] Using file-native storage at ${this.rootDir}`);
  }

  rows(table: Table | string) {
    return this.tables.get(getMeta(table).name) ?? [];
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
      flushed: false,
    };
    const dirtySnapshot = this.dirty;
    const dirtyTablesSnapshot = new Set(this.dirtyTables);
    this.activeTransactionCount++;

    try {
      return await this.txContext.run(ctx, () => fn(tx));
    } catch (err) {
      for (const tableName of ctx.dirtyTables) {
        const snapshot = ctx.snapshots.get(tableName);
        if (snapshot) this.tables.set(tableName, snapshot);
      }
      this.dirty = dirtySnapshot;
      this.dirtyTables = dirtyTablesSnapshot;
      if (ctx.flushed) {
        this.dirty = true;
        for (const tableName of ctx.dirtyTables) this.dirtyTables.add(tableName);
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
        void this.flush();
      }
    }
  }

  private async waitForTransactions(): Promise<void> {
    if (this.activeTransactionCount === 0) return;
    await new Promise<void>((resolve) => this.transactionIdleWaiters.add(resolve));
  }

  private async waitForWritableTurn(): Promise<void> {
    if (this.activeTransactionCount > 0 && !this.txContext.getStore()) {
      await this.waitForTransactions();
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

  insert(table: Table): InsertBuilder {
    const meta = getMeta(table);
    return {
      values: (rows) => {
        const runInsert = (onConflict?: { target: unknown; set: Row }) =>
          executable(async () => {
            await this.waitForWritableTurn();
            const conflictColumns = normalizeConflictTargets(onConflict?.target);
            const inputRows = Array.isArray(rows) ? rows : [rows];
            const target = this.rows(meta.name);
            const nextRows = target.map(cloneRow);
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
                nextRows[duplicateIndex] = candidate;
              } else {
                assertUniqueRow(meta, nextRows, row);
                nextRows.push(row);
              }
            }
            this.recordTxMutation(meta.name);
            this.tables.set(meta.name, nextRows);
            this.markDirty(meta.name);
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
              this.markDirty(meta.name);
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
        this.deleteWhere(meta, condition);
      });
    const builder = runDelete() as DeleteBuilder;
    builder.where = (condition) => runDelete(condition);
    return builder;
  }

  async flush(force = false, throwOnError = false) {
    const transactionContext = this.txContext.getStore();
    if (this.activeTransactionCount > 0 && !(force && transactionContext)) {
      this.pendingTransactionFlush = true;
      if (transactionContext) return;
      await this.waitForTransactions();
    }
    if (transactionContext && force) transactionContext.flushed = true;
    if (this.activeFlush) {
      await this.activeFlush;
      if (this.dirty || this.dirtyTables.size > 0) await this.flush(force, throwOnError);
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
    const flush = (async () => {
      try {
        await this.saveFileSnapshots(dirtyTables);
        this.lastFlushError = null;
      } catch (err) {
        this.lastFlushError = err;
        this.dirty = true;
        // Re-mark the tables we failed to persist so they retry on the next flush
        // (without clobbering any tables marked dirty during the failed write).
        for (const table of dirtyTables) this.dirtyTables.add(table);
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

  async close() {
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
    if (this.activeFlush) await this.activeFlush;
    while (this.dirty || this.dirtyTables.size > 0) {
      await this.flush(true);
      if (this.lastFlushError) throw this.lastFlushError;
    }
  }

  getQuarantinedTables() {
    return this.quarantinedTables.map((entry) => ({
      table: entry.table,
      files: entry.files.map((file) => ({ ...file })),
    }));
  }

  contextForRow(meta: TableMeta, row: Row): RowContext {
    return {
      rows: { [meta.name]: row },
      baseTable: meta.name,
      joined: false,
    };
  }

  markDirty(table: string) {
    this.dirty = true;
    this.dirtyTables.add(table);
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
    this.debounceTimer.unref?.();
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
    this.markDirty(meta.name);
    this.applySetNullRelations(meta.name as FileBackedTable, deleted);
    this.applyCascades(meta.name as FileBackedTable, deleted);
  }

  private applySetNullRelations(parentTable: FileBackedTable, deletedRows: Row[]) {
    for (const relation of SET_NULL_RELATIONS.filter((entry) => entry.parent === parentTable)) {
      const childMeta = getMeta(relation.child);
      const deletedValues = new Set(deletedRows.map((row) => row[relation.parentKey]));
      let changed = false;
      for (const row of this.rows(childMeta.name)) {
        if (row[relation.childKey] != null && deletedValues.has(row[relation.childKey])) {
          if (!changed) this.recordTxMutation(childMeta.name);
          row[relation.childKey] = null;
          changed = true;
        }
      }
      if (changed) {
        this.markDirty(childMeta.name);
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

  private async loadFileSnapshots() {
    // The manifest is recoverable from on-disk table files, so a corrupted
    // manifest (e.g. both manifest.json and manifest.json.bak nulled by a
    // hard crash mid-write) shouldn't block startup. Table files recover from
    // .bak when possible, then fall back to [] only when both files are
    // unreadable so startup can still reach the UI.
    let loadedManifest: TableSnapshotManifest | null = null;
    let needsManifestRewrite = false;
    try {
      const path = manifestPath(this.rootDir);
      const result = parseJsonFile<TableSnapshotManifest | null>(path, null);
      loadedManifest = result.value;
      needsManifestRewrite = result.recoveredFromBackup || result.recoveredFromFallback;
      if (result.recoveredFromBackup || result.recoveredFromFallback) {
        this.backupRecoveredPaths.add(path);
      }
    } catch (err) {
      logger.error(
        err,
        "[file-storage] Manifest unparseable from primary and backup; continuing with empty manifest. A fresh one will be written on next save. (path=%s)",
        manifestPath(this.rootDir),
      );
      needsManifestRewrite = true;
    }
    this.loadedManifest = loadedManifest;
    if (needsManifestRewrite) {
      // Force a manifest rewrite on next save so the corrupt main file gets
      // replaced rather than persistently triggering the .bak fallback path.
      this.dirty = true;
    }

    const counts: Record<string, number> = {};
    for (const table of FILE_BACKED_TABLES) {
      const meta = getMeta(table);
      const path = tableFilePath(this.rootDir, table);
      const {
        value: rows,
        recoveredFromBackup,
        recoveredFromFallback,
        unreadablePaths,
      } = parseJsonFile<Row[]>(path, []);
      const normalized = (Array.isArray(rows) ? rows : []).map((row) => normalizeRow(meta, row));
      this.tables.set(table, normalized);
      counts[table] = normalized.length;
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
    logger.info({ tables: counts }, `[file-storage] Loaded file-native data from ${this.rootDir}`);
  }

  private async saveFileSnapshots(dirtyTables: Set<string>) {
    mkdirSync(join(this.rootDir, "tables"), { recursive: true });
    const tables: Record<string, number> = {};

    for (const table of FILE_BACKED_TABLES) {
      const rows = this.rows(table);
      tables[table] = rows.length;
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
    };
    const path = manifestPath(this.rootDir);
    await atomicWriteFile(path, JSON.stringify(manifest, null, 2), {
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
  };

  let db: FileNativeDB;
  db = {
    select: store.select.bind(store) as FileNativeDB["select"],
    insert: (table) => store.insert(table),
    update: (table) => store.update(table),
    delete: (table) => store.delete(table),
    transaction: (fn) => store.transaction(fn, db),
    _fileStore: controller,
  };
  return db;
}
