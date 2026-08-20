#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmod, cp, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const serverRoot = resolve(repositoryRoot, "packages/server");
const defaultBackupRoot = resolve(repositoryRoot, "..", ".marinara-engine-update-backups");
const retainedBackupCount = 2;

async function directoryHasEntries(directory) {
  try {
    return (await readdir(directory)).length > 0;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function normalizeEnvValue(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Mirrors the server's env loading (runtime-config.ts, non-Docker path): the
 * file named by an ambient MARINARA_ENV_FILE (repo-root-relative) or
 * <root>/.env, with dotenv semantics — a key present in the ambient
 * environment always wins over the file's value for that key, and alias
 * fallback (a ?? b) runs on the raw merged values before trimming.
 */
async function readLauncherEnv(root, ambientEnv) {
  const explicit = normalizeEnvValue(ambientEnv.MARINARA_ENV_FILE);
  const envPath = explicit
    ? isAbsolute(explicit)
      ? resolve(explicit)
      : resolve(root, explicit)
    : resolve(root, ".env");
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return (...names) => {
    let raw;
    for (const name of names) {
      raw = ambientEnv[name] !== undefined ? ambientEnv[name] : fileValues[name];
      if (raw !== undefined && raw !== null) break;
    }
    return normalizeEnvValue(raw);
  };
}

/** Mirrors getFileStorageDir: FILE_STORAGE_DIR ?? MARINARA_FILE_STORAGE_DIR, else DATA_DIR/storage. */
export async function resolveLauncherStorageDir({ root = repositoryRoot, env = process.env } = {}) {
  const pick = await readLauncherEnv(root, env);
  const configured = pick("FILE_STORAGE_DIR", "MARINARA_FILE_STORAGE_DIR");
  if (configured) {
    return isAbsolute(configured) ? resolve(configured) : resolve(root, "packages/server", configured);
  }
  return resolve(await resolveLauncherDataDir({ root, env }), "storage");
}

/**
 * Downgrade guard (#4708): compares the ON-DISK storage format (the version
 * the store wrote into storage/manifest.json) against the format the TARGET
 * ref's code understands (its tracked root storage-format.json; absent on
 * refs predating that file = format 2). A build must never run against data
 * written by a newer format — it would silently see empty chat history and
 * could write a conflicting old-format file.
 */
export async function checkTargetStorageFormat({
  root = repositoryRoot,
  env = process.env,
  targetRef,
} = {}) {
  if (!targetRef) throw new Error("checkTargetStorageFormat requires a targetRef");

  // A crash can leave only manifest.json.bak — the on-disk format must not
  // fall back to "nothing to protect" while a backup still declares it.
  let onDiskFormat = null;
  const storageDir = await resolveLauncherStorageDir({ root, env });
  for (const name of ["manifest.json", "manifest.json.bak"]) {
    try {
      const manifest = JSON.parse(await readFile(resolve(storageDir, name), "utf8"));
      if (typeof manifest?.version === "number") {
        onDiskFormat = manifest.version;
        break;
      }
    } catch {
      /* try the backup */
    }
  }
  if (onDiskFormat === null) return { compatible: true, verified: true, onDiskFormat: null, targetFormat: null };

  // CONFIRMED-absent on the target ref -> that build predates the file -> 2.
  // Any git failure (bad ref, timeout, unreadable object) is verified: false
  // instead — misreading it as format 2 would report a false downgrade
  // block. ls-tree distinguishes all three cases in one call: a bad ref
  // throws, a verified ref lists the path when present and prints nothing
  // when absent — git show's own error text cannot tell those apart.
  let targetFormat = null;
  let raw = null;
  try {
    const listed = execFileSync("git", ["ls-tree", "--name-only", targetRef, "--", "storage-format.json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    if (!listed.trim()) {
      targetFormat = 2;
    } else {
      raw = execFileSync("git", ["show", `${targetRef}:storage-format.json`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15_000,
      });
    }
  } catch {
    return { compatible: false, verified: false, onDiskFormat, targetFormat: null };
  }
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      // A malformed committed file stays unverified rather than being misread.
      if (typeof parsed?.storageFormat === "number") targetFormat = parsed.storageFormat;
    } catch {
      /* fall through unverified */
    }
  }
  if (targetFormat === null) return { compatible: false, verified: false, onDiskFormat, targetFormat: null };
  return { compatible: targetFormat >= onDiskFormat, verified: true, onDiskFormat, targetFormat };
}

// Kept in sync with FILE_BACKED_TABLES in packages/server/src/db/file-backed-store.ts.
// Every file-backed table is sharded as of storage format 5.
// (this script must run offline, so it cannot import server code).
const SHARDED_TABLES = [
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
];
const PRIMARY_KEY_COLUMNS = { app_settings: "key", prompt_overrides: "key" };
const UNSHARD_SENTINEL = ".unshard-in-progress";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Shard data files: primaries (*.json) plus .bak-only shards whose primary vanished. */
async function listShardSources(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const primaries = names.filter((name) => name.endsWith(".json"));
  const bakOnly = names.filter(
    (name) => name.endsWith(".json.bak") && !primaries.includes(name.slice(0, -".bak".length)),
  );
  return [...primaries, ...bakOnly];
}

async function readShardRowsOrThrow(dir, name) {
  const path = resolve(dir, name);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    const bak = `${path}.bak`;
    if (name.endsWith(".json") && (await pathExists(bak))) {
      try {
        return JSON.parse(await readFile(bak, "utf8"));
      } catch {
        /* fall through to the error below */
      }
    }
    throw new Error(
      `Cannot parse shard file ${path} (or its .bak). Fix or remove that file, then re-run unshard. Nothing has been changed.`,
    );
  }
}

/**
 * Best-effort running-server detection: a Marinara that is still up would
 * re-shard the data on its next save, silently undoing the conversion (and
 * holding Windows file handles that break the directory renames).
 */
async function assertNoRunningServer(pick) {
  const port = Number(pick("PORT") ?? "7860") || 7860;
  let responded = false;
  try {
    await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    responded = true;
  } catch {
    /* nothing answering -> proceed */
  }
  if (responded) {
    throw new Error(
      `Something is answering on http://127.0.0.1:${port} — a running Marinara re-shards the data on its ` +
        `next save, undoing this conversion. Stop the server, then re-run unshard. Nothing has been changed.`,
    );
  }
}

/** writeFile + fsync before the caller's rename, mirroring the store's atomicWriteFile. */
async function writeFileDurable(path, data) {
  const handle = await open(path, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Downgrade escape hatch (#4708): rebuilds the pre-sharding monolith layout
 * from the per-chat shard files so a format-2 build can read the data again.
 * Run it with the server STOPPED — a running sharded server re-shards on its
 * next flush (a health-endpoint probe refuses the obvious case). Shard
 * directories are renamed to `.post-unshard-<timestamp>` (kept, never
 * deleted), and the manifest is rewritten as format 2 so the launcher guard
 * stops refusing the older target.
 *
 * All reads happen before any write; an unreadable shard aborts the run with
 * the directory untouched. A sentinel marks a run in progress and is removed
 * only on success. While it is present, shard data stays AUTHORITATIVE — the
 * same rule the server's own migration classifier applies to a
 * monolith-beside-shards state: a monolith found next to shard files is
 * renamed to `.pre-unshard-<timestamp>` and rebuilt from the shards, never
 * trusted. That makes a crashed or interrupted run safely re-runnable without
 * ever letting a stale partial monolith (or a genuinely forked one) win over
 * newer shard data.
 */
export async function unshardLauncherStorage({
  root = repositoryRoot,
  env = process.env,
  now = new Date(),
  probeServer = true,
} = {}) {
  const pick = await readLauncherEnv(root, env);
  if (probeServer) await assertNoRunningServer(pick);
  const storageDir = await resolveLauncherStorageDir({ root, env });
  const tablesDir = resolve(storageDir, "tables");
  const unshardSentinel = resolve(tablesDir, UNSHARD_SENTINEL);
  const resumingCrashedUnshard = await pathExists(unshardSentinel);
  const warnings = [];
  const plans = [];

  for (const table of SHARDED_TABLES) {
    const monolithPath = resolve(tablesDir, `${table}.json`);
    const monolithBak = `${monolithPath}.bak`;
    const shardDir = resolve(tablesDir, table);
    const monolithExists = (await pathExists(monolithPath)) || (await pathExists(monolithBak));
    const sources = await listShardSources(shardDir);
    const hasShardData = !!sources && sources.length > 0;
    const migrationCrashed = hasShardData && (await pathExists(resolve(shardDir, ".migrating")));

    if (monolithExists && hasShardData && !migrationCrashed && !resumingCrashedUnshard) {
      throw new Error(
        `Table "${table}" has BOTH a monolith and shard files, and neither is marked in-progress. ` +
          `An older version may have written new history into the monolith after the shards were created; ` +
          `merging the two automatically would guess at ordering. Either start the current version once ` +
          `(it keeps the sharded history and sets the monolith aside as ${table}.json.post-downgrade-<timestamp> ` +
          `— nothing is deleted) and then re-run unshard, or move the side you do not want out of ` +
          `storage/tables/ yourself. Nothing has been changed.`,
      );
    }
    if (monolithExists && (!hasShardData || migrationCrashed)) {
      // Authoritative monolith: either the shards are already renamed away
      // (pre-shard world, or a completed conversion) or a crashed MIGRATION
      // left partial shards the server itself would rebuild from this
      // monolith. Just move any shard remnants aside.
      plans.push({ table, mode: "monolith-kept", monolithPath, shardDir: sources ? shardDir : null });
      continue;
    }
    if (!hasShardData) {
      plans.push({ table, mode: "empty", monolithPath, shardDir: null });
      continue;
    }

    const rows = [];
    for (const name of sources) {
      const parsed = await readShardRowsOrThrow(shardDir, name);
      const list = Array.isArray(parsed) ? parsed : [];
      const records = list.filter((row) => !!row && typeof row === "object" && !Array.isArray(row));
      if (records.length !== list.length) {
        warnings.push(
          `${table}/${name}: skipped ${list.length - records.length} malformed row(s); the original file stays in the renamed shard directory`,
        );
      }
      rows.push(...records);
    }
    // Mirror the store's load normalization: (createdAt, primary key) order, then
    // keep-first dedup on primary key.
    const primaryKey = PRIMARY_KEY_COLUMNS[table] ?? "id";
    rows.sort(
      (a, b) =>
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) ||
        String(a[primaryKey] ?? "").localeCompare(String(b[primaryKey] ?? "")),
    );
    const seenIds = new Set();
    const deduped = [];
    for (const row of rows) {
      const id = typeof row[primaryKey] === "string" ? row[primaryKey] : null;
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      deduped.push(row);
    }
    if (deduped.length !== rows.length) {
      warnings.push(`${table}: dropped ${rows.length - deduped.length} duplicate row id(s) found across shards`);
    }
    plans.push({
      table,
      mode: "rebuild",
      monolithPath,
      shardDir,
      rows: deduped,
      // A monolith beside shard data only reaches rebuild on a resumed run:
      // set it aside (never deleted) before the shards win.
      preserveMonolith: monolithExists,
    });
  }

  // Every read succeeded — now write. The sentinel stays on disk until the
  // whole conversion lands, so an interrupted run resumes under the
  // shards-stay-authoritative rule above instead of aborting or trusting a
  // partial monolith.
  await mkdir(tablesDir, { recursive: true });
  // Durable: after a power loss the sentinel must exist wherever the renames
  // below landed, or the next run aborts as forked instead of resuming.
  await writeFileDurable(unshardSentinel, now.toISOString());
  const timestamp = now.toISOString().replaceAll(":", "-").replace(".", "-");
  const results = [];
  for (const plan of plans) {
    if (plan.mode === "rebuild") {
      if (plan.preserveMonolith) {
        for (const path of [`${plan.monolithPath}.bak`, plan.monolithPath]) {
          if (await pathExists(path)) await rename(path, `${path}.pre-unshard-${timestamp}`);
        }
      }
      const tmp = `${plan.monolithPath}.unshard-tmp`;
      await writeFileDurable(tmp, JSON.stringify(plan.rows));
      await rename(tmp, plan.monolithPath);
    }
    if (plan.shardDir && (await pathExists(plan.shardDir))) {
      await rename(plan.shardDir, `${plan.shardDir}.post-unshard-${timestamp}`);
    }
    results.push(
      plan.mode === "rebuild"
        ? `${plan.table}: rebuilt the monolith from ${plan.rows.length} row(s); shard files kept as ${plan.table}.post-unshard-${timestamp}` +
            (plan.preserveMonolith ? `; the previous monolith was set aside as .pre-unshard-${timestamp}` : "")
        : plan.mode === "monolith-kept"
          ? `${plan.table}: kept the existing monolith${plan.shardDir ? `; shard remnants moved to ${plan.table}.post-unshard-${timestamp}` : ""}`
          : `${plan.table}: no data to convert`,
    );
  }

  // Rewrite the manifest as format 2 — the launcher guard reads it, and a
  // leftover version 3 would keep refusing the downgrade unshard exists to
  // allow. (Format-2 builds themselves never read the version.)
  const manifestFile = resolve(storageDir, "manifest.json");
  let manifestRewritten = false;
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {
    /* missing or unparseable -> the guard cannot read a version from it either */
  }
  if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
    manifest.version = 2;
    manifest.savedAt = now.toISOString();
    delete manifest.shards;
    const serialized = JSON.stringify(manifest, null, 2);
    try {
      await writeFileDurable(manifestFile, serialized);
      await writeFileDurable(`${manifestFile}.bak`, serialized);
      manifestRewritten = true;
    } catch (error) {
      warnings.push(
        `could not rewrite ${manifestFile} as format 2 — the launcher guard will keep refusing the older ` +
          `target until it is fixed by hand (${error instanceof Error ? error.message : error})`,
      );
    }
  } else {
    manifestRewritten = true; // nothing readable for the guard to misjudge
  }
  await rm(unshardSentinel, { force: true });
  return { storageDir, results, warnings, manifestRewritten };
}

export async function resolveLauncherDataDir({
  root = repositoryRoot,
  env = process.env,
} = {}) {
  const pick = await readLauncherEnv(root, env);
  const configured = pick("DATA_DIR");
  if (!configured) return resolve(root, "packages/server/data");
  return isAbsolute(configured) ? resolve(configured) : resolve(root, "packages/server", configured);
}

async function listCompletedBackups(backupRoot) {
  try {
    const entries = await readdir(backupRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("update-"))
      .map((entry) => resolve(backupRoot, entry.name))
      .sort()
      .reverse();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readManifest(backupDir) {
  try {
    return JSON.parse(await readFile(resolve(backupDir, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function snapshotLauncherData({
  root = repositoryRoot,
  backupRoot = defaultBackupRoot,
  env = process.env,
  now = new Date(),
} = {}) {
  const dataDir = await resolveLauncherDataDir({ root, env });
  if (!(await directoryHasEntries(dataDir))) {
    return { created: false, dataDir, backupDir: null };
  }

  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  await chmod(backupRoot, 0o700);
  const timestamp = now.toISOString().replaceAll(":", "-").replace(".", "-");
  const backupName = `update-${timestamp}-${process.pid}`;
  const incompleteDir = resolve(backupRoot, `.incomplete-${backupName}`);
  const backupDir = resolve(backupRoot, backupName);
  const capabilityRuntimeLink = resolve(dataDir, "capability-packages", "node_modules");
  const downloadableDataDirs = ["models", "sidecar-runtime"].map((name) => resolve(dataDir, name));

  await rm(incompleteDir, { recursive: true, force: true });
  try {
    await mkdir(incompleteDir, { recursive: true, mode: 0o700 });
    await cp(dataDir, resolve(incompleteDir, "data"), {
      recursive: true,
      preserveTimestamps: true,
      errorOnExist: true,
      filter: (source) => {
        const sourcePath = resolve(source);
        return (
          sourcePath !== capabilityRuntimeLink &&
          downloadableDataDirs.every(
            (downloadableDir) => sourcePath !== downloadableDir && !sourcePath.startsWith(`${downloadableDir}${sep}`),
          )
        );
      },
    });
    await writeFile(
      resolve(incompleteDir, "manifest.json"),
      `${JSON.stringify({ createdAt: now.toISOString(), dataDir }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(incompleteDir, backupDir);
  } catch (error) {
    await rm(incompleteDir, { recursive: true, force: true });
    throw error;
  }

  const staleBackups = (await listCompletedBackups(backupRoot)).slice(retainedBackupCount);
  await Promise.all(staleBackups.map((path) => rm(path, { recursive: true, force: true })));
  return { created: true, dataDir, backupDir };
}

export async function restoreLauncherDataIfMissing({
  root = repositoryRoot,
  backupRoot = defaultBackupRoot,
  env = process.env,
} = {}) {
  const dataDir = await resolveLauncherDataDir({ root, env });
  if (await directoryHasEntries(dataDir)) {
    return { restored: false, dataDir, backupDir: null };
  }

  for (const backupDir of await listCompletedBackups(backupRoot)) {
    const manifest = await readManifest(backupDir);
    if (manifest?.dataDir !== dataDir) continue;

    const backupDataDir = resolve(backupDir, "data");
    try {
      if (!(await stat(backupDataDir)).isDirectory() || !(await directoryHasEntries(backupDataDir))) continue;
    } catch {
      continue;
    }

    await rm(dataDir, { recursive: true, force: true });
    await mkdir(dirname(dataDir), { recursive: true });
    await cp(backupDataDir, dataDir, { recursive: true, preserveTimestamps: true, errorOnExist: true });
    return { restored: true, dataDir, backupDir };
  }

  return { restored: false, dataDir, backupDir: null };
}

async function main() {
  const command = process.argv[2];
  if (command === "snapshot") {
    const result = await snapshotLauncherData();
    if (result.created) {
      console.log(`  [OK] Protected user data at ${result.backupDir}`);
    } else {
      console.log("  [OK] No existing user data needed an update snapshot.");
    }
    return;
  }

  if (command === "restore-if-missing") {
    const result = await restoreLauncherDataIfMissing();
    if (result.restored) {
      console.log(`  [OK] Restored user data from ${result.backupDir}`);
    }
    return;
  }

  if (command === "check-target") {
    // Exit-code contract, relied on by every launcher and the installer:
    //   0 = compatible target, proceed
    //   2 = REAL format block (the target cannot read the on-disk data)
    //   1 = the check itself failed (usage error, an unverifiable target's
    //       format, or an unexpected exception via main().catch) — consumers
    //       must fail safe but report it as a verification failure, not as a
    //       downgrade block.
    const targetRef = process.argv[3];
    if (!targetRef) throw new Error("Usage: node scripts/protect-launcher-data.mjs check-target <ref>");
    const result = await checkTargetStorageFormat({ targetRef });
    if (result.compatible) {
      return;
    }
    if (!result.verified) {
      console.error(
        "  [WARN] Could not verify the update target's storage format (git error); this is NOT a downgrade block.",
      );
      process.exitCode = 1;
      return;
    }
    console.error(
      `  [BLOCK] Your data uses storage format ${result.onDiskFormat}, but the update target only understands ` +
        `format ${result.targetFormat}. Running it would hide your chat history and could corrupt the data ` +
        `layout. Update to a newer version instead, or see docs/TROUBLESHOOTING.md ("Chats show no messages ` +
        `after switching to an older version") for manual downgrade steps.`,
    );
    process.exitCode = 2;
    return;
  }

  if (command === "unshard") {
    const result = await unshardLauncherStorage();
    for (const warning of result.warnings) console.warn(`  [WARN] ${warning}`);
    for (const line of result.results) console.log(`  [OK] ${line}`);
    if (result.manifestRewritten) {
      console.log(`  [OK] Storage at ${result.storageDir} is back on the monolith layout (format 2); older versions can read it again.`);
    } else {
      console.warn(`  [WARN] Storage at ${result.storageDir} is on the monolith layout, but the manifest still reports the newer format — see the warning above.`);
      process.exitCode = 1;
    }
    return;
  }

  throw new Error("Usage: node scripts/protect-launcher-data.mjs <snapshot|restore-if-missing|check-target <ref>|unshard>");
}

// pathToFileURL handles Windows drive letters; new URL(path, "file:") parses
// "D:" as a URL scheme and crashes fileURLToPath with ERR_INVALID_URL_SCHEME.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`  [ERROR] Could not protect launcher data: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
