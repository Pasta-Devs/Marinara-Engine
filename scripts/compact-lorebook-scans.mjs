#!/usr/bin/env node
// Optional one-time cleanup for stored lorebook scans.
//
// Every stored message and swipe keeps the full text of every activated lorebook entry in `extra.lorebookScan`.
// With large lorebooks that can be most of a chat's storage. With LOREBOOK_COMPACT_STORED_SCANS=true the server
// stops adding this bloat (see packages/server/src/services/lorebook/lorebook-scan-compaction.ts); this script
// removes the copies written before, with the same rule the server uses:
//
//   In each chat, the newest assistant or narrator message (the one Active Context and agent retries read) keeps
//   its entry text, on its row and on its swipes. Ties on createdAt go to the larger id, like the store's order.
//   Every other message row and swipe keeps ids, names, keys, scores and totals only. Nothing else in the rows
//   changes and no row is added or removed.
//
// Running it without the setting is safe too: readers fall back to the entry's stored text, and new generations
// simply keep storing full scans.
//
// Only the live table files are rewritten. The store's own `.json.bak` fallback copies next to them stay as they
// are (still valid, just not smaller); the next time the server saves a table file it copies the compacted file
// over that .bak.
//
// Usage (stop the Marinara server first: it keeps loaded chats in memory and would write them back):
//   node scripts/compact-lorebook-scans.mjs <storage-dir> [--apply] [--backup-dir <dir>] [--force]
//
//   <storage-dir>   The file storage folder (the one holding `tables/`, by default <DATA_DIR>/storage).
//                   A data folder that holds `storage/tables/` is accepted too.
//   --apply         Write changes. Without it the script is a dry run that only reports sizes.
//   --backup-dir    Where --apply copies the messages and message_swipes tables first. Defaults to
//                   <parent of storage-dir>/backups/lorebook-scan-compaction-<time>.
//   --force         Run even though a storage writer lease exists (only after a crash left a stale lease).
//
// Very large chats may need more heap: node --max-old-space-size=8192 scripts/compact-lorebook-scans.mjs
// Restore: stop the server and copy the backed up table files back into <storage-dir>/tables/.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const TABLES = ["messages", "message_swipes"];
const MARKER = "contentStripped";
const WRITER_LEASE = ".writer-lease";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node scripts/compact-lorebook-scans.mjs <storage-dir> [--apply] [--backup-dir <dir>] [--force]",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
let backupRoot = null;
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--apply" || arg === "--force") continue;
  if (arg === "--backup-dir") {
    backupRoot = args[index + 1] ?? usage("--backup-dir needs a folder");
    index += 1;
    continue;
  }
  if (arg === "--help" || arg === "-h") usage();
  if (arg.startsWith("--")) usage(`Unknown option ${arg}`);
  positional.push(arg);
}
if (positional.length !== 1) usage("Pass exactly one storage folder.");

let storageDir = resolve(positional[0]);
if (!existsSync(join(storageDir, "tables")) && existsSync(join(storageDir, "storage", "tables"))) {
  storageDir = join(storageDir, "storage");
}
const tablesDir = join(storageDir, "tables");
if (!existsSync(tablesDir)) usage(`No tables folder found under ${storageDir}`);

if (existsSync(join(storageDir, WRITER_LEASE)) && !force) {
  console.error(
    `${join(storageDir, WRITER_LEASE)} exists, so a Marinara server may be using this storage. ` +
      "Stop it first. If no server is running (a crash left the lease behind), re-run with --force.",
  );
  process.exit(1);
}

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const hasContent = (scan) =>
  isRecord(scan) &&
  Array.isArray(scan.activatedEntries) &&
  scan.activatedEntries.some((entry) => isRecord(entry) && typeof entry.content === "string");
const compact = (scan) => ({
  ...scan,
  activatedEntries: scan.activatedEntries.map((entry) => {
    if (!isRecord(entry) || !("content" in entry)) return entry;
    const { content: _content, ...rest } = entry;
    return rest;
  }),
  [MARKER]: true,
});
const parseExtra = (row) => {
  if (!isRecord(row) || typeof row.extra !== "string" || !row.extra.includes('"lorebookScan"')) return null;
  try {
    const extra = JSON.parse(row.extra);
    return isRecord(extra) ? extra : null;
  } catch {
    return null;
  }
};

/** Table data files: a sharded table is tables/<table>/<shard>.json, an unsharded one is tables/<table>.json. */
function tableFiles(table) {
  const shardDir = join(tablesDir, table);
  if (existsSync(shardDir) && statSync(shardDir).isDirectory()) {
    // Same rule as the store's isShardDataFileName: skip .bak/.tmp/.corrupt and other dot-prefixed names.
    return readdirSync(shardDir)
      .filter((name) => /^[^.][^\\/]*\.json$/.test(name))
      .map((name) => join(shardDir, name));
  }
  const flat = join(tablesDir, `${table}.json`);
  return existsSync(flat) ? [flat] : [];
}
function readRows(file) {
  const raw = readFileSync(file, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error(`${file} is not a row array; stopping without changes`);
  return { raw, rows };
}

// Pass 1: the newest assistant or narrator message in each chat keeps its scan (row and swipes). An impersonated
// user turn can hold a newer scan, but nothing reads it, so it is compacted like any older message.
const keep = new Map(); // chatId -> { id, createdAt }
for (const file of tableFiles("messages")) {
  for (const row of readRows(file).rows) {
    if (!isRecord(row) || (row.role !== "assistant" && row.role !== "narrator")) continue;
    const current = keep.get(row.chatId);
    const createdAt = String(row.createdAt);
    const id = String(row.id);
    if (!current || createdAt > current.createdAt || (createdAt === current.createdAt && id > current.id)) {
      keep.set(row.chatId, { id, createdAt });
    }
  }
}
const keepIds = new Set([...keep.values()].map((item) => item.id));

let backupDir = null;
if (apply) {
  backupDir = resolve(
    backupRoot ??
      join(
        dirname(storageDir),
        "backups",
        `lorebook-scan-compaction-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      ),
  );
  for (const table of TABLES) {
    const files = tableFiles(table);
    if (files.length === 0) continue;
    const target = join(backupDir, table);
    mkdirSync(target, { recursive: true });
    for (const file of files) copyFileSync(file, join(target, file.slice(dirname(file).length + 1)));
  }
  console.log(`Backup: ${backupDir}`);
}

// Pass 2: compact.
let before = 0;
let after = 0;
let compactedRows = 0;
for (const table of TABLES) {
  for (const file of tableFiles(table)) {
    const { raw, rows } = readRows(file);
    let changed = 0;
    for (const row of rows) {
      if (keepIds.has(table === "messages" ? row.id : row.messageId)) continue;
      const extra = parseExtra(row);
      if (!extra || !hasContent(extra.lorebookScan)) continue;
      row.extra = JSON.stringify({ ...extra, lorebookScan: compact(extra.lorebookScan) });
      changed += 1;
    }
    const next = changed ? JSON.stringify(rows) : raw;
    before += Buffer.byteLength(raw);
    after += Buffer.byteLength(next);
    compactedRows += changed;
    if (changed && apply) {
      const tmp = `${file}.tmp-compact-${process.pid}`;
      writeFileSync(tmp, next);
      JSON.parse(readFileSync(tmp, "utf8"));
      renameSync(tmp, file);
    }
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `${apply ? "Compacted" : "Would compact"} ${compactedRows} rows; messages + swipes ${mb(before)} -> ${mb(after)}; ` +
    `${keepIds.size} chats keep their newest scan.`,
);
if (!apply) console.log("Dry run only. Re-run with --apply while the server is stopped.");
