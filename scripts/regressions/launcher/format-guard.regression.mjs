// #4708 PR 2: the downgrade guard. A build must never be allowed to run
// against data written by a newer storage format — it would show empty chat
// history and could write a conflicting old-format file. These regressions
// drive the REAL scripts:
//   - storage-format.json stays equal to STORAGE_VERSION (a missed bump
//     silently disables the guard),
//   - checkTargetStorageFormat compares the on-disk manifest against the
//     target ref's tracked storage-format.json (absent -> format 2),
//   - the check-target CLI exits 2 with a [BLOCK] message on an incompatible
//     target and 0 on a compatible one,
//   - every launcher (start.sh, start.bat, start-termux.sh) and the in-app
//     updater carry the guard, so a refactor cannot silently drop it,
//   - unshard rebuilds the monolith layout (sorted, deduped), renames shard
//     dirs to .post-unshard-<ts>, rewrites the manifest as format 2, keeps a
//     crashed-migration monolith authoritative, and refuses the ambiguous
//     monolith+shards state without deleting anything.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkTargetStorageFormat,
  resolveLauncherStorageDir,
  unshardLauncherStorage,
} from "../../protect-launcher-data.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// ── storage-format.json must match STORAGE_VERSION ──

const declaredFormat = JSON.parse(readFileSync(join(repositoryRoot, "storage-format.json"), "utf8")).storageFormat;
const storeSource = readFileSync(join(repositoryRoot, "packages/server/src/db/file-backed-store.ts"), "utf8");
const storeVersion = Number(/const STORAGE_VERSION = (\d+)/.exec(storeSource)?.[1]);
assert.equal(
  declaredFormat,
  storeVersion,
  "storage-format.json must equal STORAGE_VERSION in file-backed-store.ts — a missed bump silently disables the downgrade guard",
);

// ── Every entry point carries the guard (source-level pin) ──

for (const launcherPath of ["start.sh", "start-termux.sh", "start.bat"]) {
  const launcherSource = readFileSync(join(repositoryRoot, launcherPath), "utf8");
  assert.ok(
    launcherSource.includes("protect-launcher-data.mjs") && launcherSource.includes("check-target"),
    `${launcherPath} must run the check-target downgrade guard before applying an update`,
  );
  // A blocked target stays blocked on every launch; snapshotting first would
  // re-copy the whole data directory each time for an update that never runs.
  assert.ok(
    launcherSource.indexOf("check-target") < launcherSource.indexOf("protect-launcher-data.mjs snapshot"),
    `${launcherPath} must run check-target BEFORE the data snapshot`,
  );
  // Exit 2 = real format block, other non-zero = the check itself failed.
  // Both fail safe, but the launcher must distinguish the messages.
  assert.ok(
    /-eq 2|errorlevel 2/.test(launcherSource) && launcherSource.includes("could not verify"),
    `${launcherPath} must honor the check-target exit-code contract (2 = block, other = verification failure)`,
  );
  // The shell launchers run under set -e: a bare check-target invocation
  // would kill the whole launcher on a blocked target instead of skipping
  // the update. The || capture keeps the non-zero status handled.
  if (launcherPath.endsWith(".sh")) {
    assert.ok(
      launcherSource.includes('check-target "$TARGET_HEAD" || CHECK_TARGET_STATUS=$?'),
      `${launcherPath} must capture check-target's status errexit-safely (bare invocation dies under set -e)`,
    );
  }
}
const termuxLauncherSource = readFileSync(join(repositoryRoot, "start-termux.sh"), "utf8");
assert.ok(
  termuxLauncherSource.includes("termux-wake-lock") && termuxLauncherSource.includes("termux-wake-unlock"),
  "the Termux launcher must hold an Android wake lock while the server runs",
);
assert.match(
  termuxLauncherSource,
  /trap release_termux_wake_lock EXIT/u,
  "the Termux launcher must release its wake lock whenever the server exits",
);
const wakeLockTrapIndex = termuxLauncherSource.search(/^[ \t]*trap release_termux_wake_lock EXIT[ \t]*$/mu);
const wakeLockAcquireIndex = termuxLauncherSource.search(/^[ \t]*if[ \t]+termux-wake-lock\b[^\n]*;[ \t]*then[ \t]*$/mu);
const serverStartIndex = termuxLauncherSource.lastIndexOf("node dist/index.js");
const persistentLogIndex = termuxLauncherSource.indexOf(
  'exec > >(tee -a "$MARINARA_TERMUX_LOG_FILE") 2>&1',
);
const dependencySetupIndex = termuxLauncherSource.indexOf("resolve_pnpm_runner || exit 1");
assert.ok(
  wakeLockTrapIndex >= 0 && wakeLockAcquireIndex >= 0 && wakeLockTrapIndex < wakeLockAcquireIndex,
  "the Termux launcher must register wake-lock cleanup before acquiring the lock",
);
assert.ok(
  wakeLockAcquireIndex >= 0 && serverStartIndex >= 0 && wakeLockAcquireIndex < serverStartIndex,
  "the Termux launcher must acquire its wake lock before starting the server",
);
assert.doesNotMatch(
  termuxLauncherSource,
  /exec node dist\/index\.js/u,
  "the Termux launcher must retain its shell so the EXIT cleanup trap can run",
);
assert.match(
  termuxLauncherSource,
  /MARINARA_TERMUX_LOG_DIR="\$HOME\/\.marinara-engine\/logs"[\s\S]{0,1600}exec > >\(tee -a "\$MARINARA_TERMUX_LOG_FILE"\) 2>&1/u,
  "the Termux launcher must preserve complete launcher and server output in a durable per-run log",
);
assert.match(
  termuxLauncherSource,
  /if chmod 700 "\$MARINARA_TERMUX_LOG_DIR"[\s\S]{0,900}chmod 600 "\$MARINARA_TERMUX_LOG_FILE"[\s\S]{0,500}Could not restrict permissions/u,
  "the Termux launcher must not persist logs unless their directory and file permissions are restricted",
);
assert.ok(
  persistentLogIndex >= 0 && dependencySetupIndex >= 0 && persistentLogIndex < dependencySetupIndex,
  "the Termux launcher must start persistent logging before dependency setup, updates, and builds",
);
assert.match(
  termuxLauncherSource,
  /node dist\/index\.js\s+MARINARA_SERVER_STATUS=\$\?[\s\S]{0,900}exit "\$MARINARA_SERVER_STATUS"/u,
  "the Termux launcher must preserve the server process exit status",
);
assert.match(
  termuxLauncherSource,
  /MARINARA_TERMUX_LOG_TEE_PID=\$![\s\S]{0,30000}exec 1>&3 2>&4 3>&- 4>&-[\s\S]{0,200}wait "\$MARINARA_TERMUX_LOG_TEE_PID"[\s\S]{0,300}Persistent Termux logging failed with status \$MARINARA_TERMUX_LOG_TEE_STATUS/u,
  "the Termux launcher must flush and report tee failures without replacing the server status",
);
assert.match(
  termuxLauncherSource,
  /if \[ "\$MARINARA_SERVER_STATUS" -ne 0 \]; then[\s\S]{0,160}server exited with status \$MARINARA_SERVER_STATUS/u,
  "the Termux launcher must record a nonzero server exit status",
);
const installerSource = readFileSync(join(repositoryRoot, "win/installer/install.bat"), "utf8");
assert.ok(
  installerSource.includes("check-target") && installerSource.includes("if errorlevel 2"),
  "install.bat must carry the downgrade guard on its update-over-existing-install path, blocking only on exit code 2 " +
    "(exit 1 can come from an older checkout whose script predates the subcommand, and must not break upgrades)",
);
assert.ok(
  installerSource.includes("Could not verify"),
  "install.bat must surface a distinguishable warning (not silence, not a block) when the format check itself fails",
);
for (const dockerfile of ["Dockerfile", "Dockerfile.lite"]) {
  const dockerfileSource = readFileSync(join(repositoryRoot, dockerfile), "utf8");
  assert.ok(
    dockerfileSource.includes("COPY scripts/protect-launcher-data.mjs"),
    `${dockerfile} must ship protect-launcher-data.mjs — docs/TROUBLESHOOTING.md tells Docker users to run unshard in a one-off container`,
  );
}
const updatesRoutesSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/updates.routes.ts"), "utf8");
for (const pinnedFragment of ["checkTargetStorageFormat", ":storage-format.json", "targetFormat >= onDiskFormat"]) {
  assert.ok(
    updatesRoutesSource.includes(pinnedFragment),
    `updates.routes.ts must keep its twin of the launcher guard (missing: ${pinnedFragment}) — the server cannot import scripts/protect-launcher-data.mjs`,
  );
}
const launcherGuardSource = readFileSync(join(repositoryRoot, "scripts/protect-launcher-data.mjs"), "utf8");
for (const pinnedFragment of [":storage-format.json", "targetFormat >= onDiskFormat"]) {
  assert.ok(
    launcherGuardSource.includes(pinnedFragment),
    `protect-launcher-data.mjs guard drifted from its updates.routes.ts twin (missing: ${pinnedFragment})`,
  );
}
// The unshard command keeps private copies of the store's shard constants (it
// must run offline and cannot import server code). Pin them against the store
// source so a rename or a new sharded table cannot silently desynchronize them.
const parseTableList = (source, label) => {
  // Tolerant of whitespace, newlines, and trailing annotations (`as const`):
  // lazy-match through the array's own closing bracket only — table names
  // cannot contain `]`, so the first `]` always ends the literal.
  const raw = /const SHARDED_TABLES[\s\S]*?=\s*\[([\s\S]*?)\]/.exec(source)?.[1];
  assert.ok(raw, `could not find SHARDED_TABLES in ${label}`);
  return raw
    .split(",")
    .map((entry) =>
      entry
        .replace(/\/\/[^\n]*/g, "")
        .trim()
        .replace(/^["']|["']$/g, ""),
    )
    .filter(Boolean);
};
assert.deepEqual(
  parseTableList(launcherGuardSource, "protect-launcher-data.mjs"),
  parseTableList(storeSource, "file-backed-store.ts"),
  "unshard's SHARDED_TABLES copy must match the store's — a new sharded table the script does not fold back " +
    "into a monolith would silently vanish for the downgraded build",
);
assert.ok(
  storeSource.includes('SHARD_MIGRATION_SENTINEL = ".migrating"') && launcherGuardSource.includes('".migrating"'),
  "unshard's migration-sentinel literal must match the store's SHARD_MIGRATION_SENTINEL",
);

// ── checkTargetStorageFormat against a real git fixture ──

function gitFixtureRepo() {
  const repo = mkdtempSync(join(tmpdir(), "marinara-format-guard-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet");
  git("config", "user.email", "regression@example.invalid");
  git("config", "user.name", "Format Guard Regression");
  writeFileSync(join(repo, "README.md"), "fixture\n");
  git("add", "README.md");
  git("commit", "--quiet", "-m", "pre-sharding build (no storage-format.json)");
  const preShardingRef = git("rev-parse", "HEAD").trim();
  writeFileSync(join(repo, "storage-format.json"), `${JSON.stringify({ storageFormat: 3 })}\n`);
  git("add", "storage-format.json");
  git("commit", "--quiet", "-m", "sharded build (format 3)");
  const shardedRef = git("rev-parse", "HEAD").trim();
  return { repo, preShardingRef, shardedRef };
}

function storageFixture(manifestVersion) {
  const dir = mkdtempSync(join(tmpdir(), "marinara-format-storage-"));
  if (manifestVersion !== null) {
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        version: manifestVersion,
        savedAt: "2026-08-08T00:00:00.000Z",
        backend: "file-native",
        tables: {},
      }),
    );
  }
  return dir;
}

{
  const { repo, preShardingRef, shardedRef } = gitFixtureRepo();
  const formatThreeData = storageFixture(3);
  const formatTwoData = storageFixture(2);
  const freshData = storageFixture(null);
  const envFor = (dir) => ({ FILE_STORAGE_DIR: dir });
  try {
    const blocked = await checkTargetStorageFormat({
      root: repo,
      env: envFor(formatThreeData),
      targetRef: preShardingRef,
    });
    assert.deepEqual(
      blocked,
      { compatible: false, verified: true, onDiskFormat: 3, targetFormat: 2 },
      "format-3 data must refuse a target ref that CONFIRMS storage-format.json absent (-> 2)",
    );
    const allowed = await checkTargetStorageFormat({ root: repo, env: envFor(formatThreeData), targetRef: shardedRef });
    assert.equal(allowed.compatible, true, "format-3 data accepts a format-3 target");
    const upgrade = await checkTargetStorageFormat({ root: repo, env: envFor(formatTwoData), targetRef: shardedRef });
    assert.equal(upgrade.compatible, true, "format-2 data accepts a NEWER target (upgrades are always allowed)");
    const sideways = await checkTargetStorageFormat({
      root: repo,
      env: envFor(formatTwoData),
      targetRef: preShardingRef,
    });
    assert.equal(sideways.compatible, true, "format-2 data accepts a format-2 target");
    const fresh = await checkTargetStorageFormat({ root: repo, env: envFor(freshData), targetRef: preShardingRef });
    assert.deepEqual(
      fresh,
      { compatible: true, verified: true, onDiskFormat: null, targetFormat: null },
      "no manifest means nothing to protect — never block a fresh install",
    );
    // A git failure (bad ref, lock, timeout) is NOT the same as a confirmed
    // absence: it must come back unverified, never as a fake format-2 that
    // would misreport a downgrade block.
    const unverified = await checkTargetStorageFormat({
      root: repo,
      env: envFor(formatThreeData),
      targetRef: "0000000000000000000000000000000000000000",
    });
    assert.deepEqual(
      unverified,
      { compatible: false, verified: false, onDiskFormat: 3, targetFormat: null },
      "an unreadable target ref is unverified, not misread as a pre-sharding build",
    );
    // A backup-only manifest still declares the on-disk format: guard state
    // must never fall open because a crash took the primary with it.
    const bakOnlyData = mkdtempSync(join(tmpdir(), "marinara-format-bakonly-"));
    try {
      writeFileSync(
        join(bakOnlyData, "manifest.json.bak"),
        JSON.stringify({ version: 3, savedAt: "2026-08-08T00:00:00.000Z", backend: "file-native", tables: {} }),
      );
      const bakOnly = await checkTargetStorageFormat({
        root: repo,
        env: envFor(bakOnlyData),
        targetRef: preShardingRef,
      });
      assert.deepEqual(
        bakOnly,
        { compatible: false, verified: true, onDiskFormat: 3, targetFormat: 2 },
        "a manifest surviving only as .bak still blocks the downgrade",
      );
    } finally {
      rmSync(bakOnlyData, { recursive: true, force: true });
    }
    // A ref that LISTS storage-format.json but cannot read it (missing blob
    // object) is a read failure, not an absence: unverified, never format 2.
    // Run last — it corrupts the fixture repo's blob on purpose.
    const blobSha = execFileSync("git", ["rev-parse", `${shardedRef}:storage-format.json`], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    rmSync(join(repo, ".git", "objects", blobSha.slice(0, 2), blobSha.slice(2)), { force: true });
    const unreadable = await checkTargetStorageFormat({
      root: repo,
      env: envFor(formatThreeData),
      targetRef: shardedRef,
    });
    assert.deepEqual(
      unreadable,
      { compatible: false, verified: false, onDiskFormat: 3, targetFormat: null },
      "a listed-but-unreadable storage-format.json is unverified, not misread as absent",
    );
  } finally {
    for (const dir of [repo, formatThreeData, formatTwoData, freshData]) rmSync(dir, { recursive: true, force: true });
  }
}

// ── The check-target CLI: exit 2 + [BLOCK] on incompatible, exit 0 otherwise ──

{
  const guardScript = join(repositoryRoot, "scripts", "protect-launcher-data.mjs");
  const newerData = storageFixture(99);
  const currentData = storageFixture(2);
  try {
    const blocked = spawnSync(process.execPath, [guardScript, "check-target", "HEAD"], {
      encoding: "utf8",
      env: { ...process.env, FILE_STORAGE_DIR: newerData },
    });
    assert.equal(blocked.status, 2, "check-target must exit 2 when the target cannot read the data");
    assert.match(blocked.stderr, /\[BLOCK\]/, "the refusal must print a [BLOCK] line for the launcher log");
    const allowed = spawnSync(process.execPath, [guardScript, "check-target", "HEAD"], {
      encoding: "utf8",
      env: { ...process.env, FILE_STORAGE_DIR: currentData },
    });
    assert.equal(allowed.status, 0, "check-target must exit 0 for a compatible target");
    const broken = spawnSync(process.execPath, [guardScript, "check-target"], {
      encoding: "utf8",
      env: { ...process.env, FILE_STORAGE_DIR: currentData },
    });
    assert.equal(broken.status, 1, "a check that could not run exits 1, never 2 — consumers report it differently");
    const unverifiable = spawnSync(
      process.execPath,
      [guardScript, "check-target", "0000000000000000000000000000000000000000"],
      { encoding: "utf8", env: { ...process.env, FILE_STORAGE_DIR: newerData } },
    );
    assert.equal(unverifiable.status, 1, "an unverifiable target exits 1 (verification failure), never 2 (block)");
    assert.match(unverifiable.stderr, /NOT a downgrade block/, "the unverified message says it is not a downgrade");
  } finally {
    for (const dir of [newerData, currentData]) rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: rebuild the monolith layout from shards ──

const row = (id, chatId, createdAt, content) => ({ id, chatId, role: "user", content, createdAt });

function shardedStorageFixture() {
  const dir = mkdtempSync(join(tmpdir(), "marinara-unshard-"));
  mkdirSync(join(dir, "tables", "messages"), { recursive: true });
  mkdirSync(join(dir, "tables", "message_swipes"), { recursive: true });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({
      version: 3,
      savedAt: "2026-08-08T00:00:00.000Z",
      backend: "file-native",
      tables: {},
      shards: { messages: 2, message_swipes: 1 },
    }),
  );
  return dir;
}

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([
      row("m-2", "chat-a", "2026-08-08T10:00:02.000Z", "second"),
      row("m-1", "chat-a", "2026-08-08T10:00:01.000Z", "first"),
    ]),
  );
  writeFileSync(
    join(dir, "tables", "messages", "chat-b.json"),
    JSON.stringify([row("m-3", "chat-b", "2026-08-08T10:00:03.000Z", "third")]),
  );
  writeFileSync(
    join(dir, "tables", "message_swipes", "orphaned-rows.json"),
    JSON.stringify([
      { id: "s-1", messageId: "m-gone", index: 0, content: "orphan", createdAt: "2026-08-08T10:00:04.000Z" },
    ]),
  );
  try {
    const result = await unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false });
    const monolith = JSON.parse(readFileSync(join(dir, "tables", "messages.json"), "utf8"));
    assert.deepEqual(
      monolith.map((entry) => entry.id),
      ["m-1", "m-2", "m-3"],
      "the rebuilt monolith holds every shard's rows in (createdAt, id) order",
    );
    const swipes = JSON.parse(readFileSync(join(dir, "tables", "message_swipes.json"), "utf8"));
    assert.equal(swipes.length, 1, "orphaned-rows shards are folded into the monolith like any other");
    assert.equal(existsSync(join(dir, "tables", "messages")), false, "the shard directory is renamed away");
    assert.ok(
      readdirSync(join(dir, "tables")).some((name) => name.startsWith("messages.post-unshard-")),
      "the shard files are kept as .post-unshard-<timestamp>, never deleted",
    );
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    assert.equal(
      manifest.version,
      2,
      "the manifest is rewritten as format 2 so the guard stops refusing the downgrade",
    );
    assert.equal("shards" in manifest, false, "the shards diagnostic is dropped from the format-2 manifest");
    assert.equal(result.warnings.length, 0, "a clean conversion reports no warnings");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: the direct-chatId table family converts too (PR 3, #4708) ──
// memory_chunks stands in for every table that shards by its own chatId; the
// SHARDED_TABLES pairing pin above guarantees the list itself matches the
// store, and this case proves the conversion handles a non-message table.

{
  const dir = shardedStorageFixture();
  mkdirSync(join(dir, "tables", "memory_chunks"), { recursive: true });
  writeFileSync(
    join(dir, "tables", "memory_chunks", "chat-a.json"),
    JSON.stringify([{ id: "chunk-1", chatId: "chat-a", content: "c", createdAt: "2026-08-08T10:00:00.000Z" }]),
  );
  try {
    await unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false });
    const monolith = JSON.parse(readFileSync(join(dir, "tables", "memory_chunks.json"), "utf8"));
    assert.deepEqual(
      monolith.map((row) => [row.id, row.content]),
      [["chunk-1", "c"]],
      "memory_chunks shards fold back into a monolith with rows intact",
    );
    assert.ok(
      readdirSync(join(dir, "tables")).some((name) => name.startsWith("memory_chunks.post-unshard-")),
      "the chunk shard files are kept as .post-unshard-<timestamp>",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: duplicates keep-first, bak-only shards recovered ──

{
  const dir = shardedStorageFixture();
  const dup = row("m-dup", "chat-a", "2026-08-08T10:00:01.000Z", "original");
  writeFileSync(join(dir, "tables", "messages", "chat-a.json"), JSON.stringify([dup]));
  writeFileSync(
    join(dir, "tables", "messages", "chat-b.json"),
    JSON.stringify([{ ...dup, chatId: "chat-b", createdAt: "2026-08-08T10:00:02.000Z", content: "stale copy" }]),
  );
  writeFileSync(
    join(dir, "tables", "messages", "chat-c.json.bak"),
    JSON.stringify([row("m-c", "chat-c", "2026-08-08T10:00:03.000Z", "bak only")]),
  );
  try {
    await unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false });
    const monolith = JSON.parse(readFileSync(join(dir, "tables", "messages.json"), "utf8"));
    assert.deepEqual(
      monolith.map((entry) => entry.content).sort(),
      ["bak only", "original"],
      "duplicate ids keep the first occurrence and bak-only shards are still recovered",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: crashed migration keeps the monolith authoritative ──

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages.json"),
    JSON.stringify([row("m-1", "chat-a", "2026-08-08T10:00:01.000Z", "authoritative")]),
  );
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([row("m-partial", "chat-a", "2026-08-08T10:00:01.000Z", "partial")]),
  );
  writeFileSync(join(dir, "tables", "messages", ".migrating"), "2026-08-08T00:00:00.000Z");
  try {
    await unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false });
    const monolith = JSON.parse(readFileSync(join(dir, "tables", "messages.json"), "utf8"));
    assert.equal(
      monolith[0].content,
      "authoritative",
      "a crashed migration's monolith is kept, never overwritten from partial shards",
    );
    assert.equal(existsSync(join(dir, "tables", "messages")), false, "the partial shard dir is still moved aside");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: the ambiguous forked state aborts without touching anything ──

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages.json"),
    JSON.stringify([row("m-old", "chat-a", "2026-08-08T10:00:01.000Z", "old-build rows")]),
  );
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([row("m-new", "chat-a", "2026-08-08T10:00:02.000Z", "sharded rows")]),
  );
  try {
    await assert.rejects(
      unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false }),
      /both a monolith and shard files/i,
      "monolith + shards with no in-progress marker is forked history — refuse to guess a merge",
    );
    assert.ok(existsSync(join(dir, "tables", "messages", "chat-a.json")), "the aborted run changed nothing");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.version, 3, "the aborted run left the manifest alone");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: an unreadable shard aborts before any write ──

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([row("m-1", "chat-a", "2026-08-08T10:00:01.000Z", "fine")]),
  );
  writeFileSync(join(dir, "tables", "messages", "chat-b.json"), "{not json");
  try {
    await assert.rejects(
      unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false }),
      /cannot parse shard file/i,
      "an unreadable shard with no .bak must abort the conversion",
    );
    assert.equal(existsSync(join(dir, "tables", "messages.json")), false, "no partial monolith is left behind");
    assert.ok(existsSync(join(dir, "tables", "messages", "chat-a.json")), "the readable shards are untouched");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Storage-dir mirror: server alias + custom env-file are honored ──
// getFileStorageDir reads FILE_STORAGE_DIR ?? MARINARA_FILE_STORAGE_DIR, and
// the env file itself can live wherever MARINARA_ENV_FILE points. A mirror
// that misses either resolves the wrong manifest and the guard silently
// passes on real data.

{
  const dir = mkdtempSync(join(tmpdir(), "marinara-env-mirror-"));
  const storageDir = join(dir, "custom-storage");
  mkdirSync(storageDir, { recursive: true });
  try {
    assert.equal(
      await resolveLauncherStorageDir({ root: dir, env: { MARINARA_FILE_STORAGE_DIR: storageDir } }),
      resolve(storageDir),
      "the MARINARA_FILE_STORAGE_DIR alias must resolve exactly like the server's getFileStorageDir",
    );
    writeFileSync(join(dir, "custom.env"), `FILE_STORAGE_DIR=${storageDir.replaceAll("\\", "\\\\")}\n`);
    assert.equal(
      await resolveLauncherStorageDir({ root: dir, env: { MARINARA_ENV_FILE: join(dir, "custom.env") } }),
      resolve(storageDir),
      "an env file named by MARINARA_ENV_FILE must be read instead of <root>/.env",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: a resumed run keeps SHARDS authoritative, never a partial monolith ──
// A crashed run leaves the sentinel plus possibly a stale partial monolith; a
// live server may even have written newer shards since. Trusting the monolith
// would resurrect the stale snapshot and rename the newer shard data away —
// the exact opposite of the server's own downgrade-artifact rule.

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([row("m-new", "chat-a", "2026-08-08T10:00:02.000Z", "written after the crash")]),
  );
  writeFileSync(
    join(dir, "tables", "messages.json"),
    JSON.stringify([row("m-stale", "chat-a", "2026-08-08T10:00:01.000Z", "stale partial output")]),
  );
  writeFileSync(join(dir, "tables", ".unshard-in-progress"), "2026-08-08T00:00:00.000Z");
  try {
    await unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false });
    const monolith = JSON.parse(readFileSync(join(dir, "tables", "messages.json"), "utf8"));
    assert.deepEqual(
      monolith.map((entry) => entry.id),
      ["m-new"],
      "the resumed run rebuilds from the shards, not the stale partial monolith",
    );
    assert.ok(
      readdirSync(join(dir, "tables")).some((name) => name.startsWith("messages.json.pre-unshard-")),
      "the displaced monolith is set aside as .pre-unshard-<timestamp>, never deleted",
    );
    assert.equal(existsSync(join(dir, "tables", ".unshard-in-progress")), false, "the sentinel is cleared on success");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: a .bak-only monolith beside shards is still the forked-state abort ──

{
  const dir = shardedStorageFixture();
  writeFileSync(
    join(dir, "tables", "messages.json.bak"),
    JSON.stringify([row("m-old", "chat-a", "2026-08-08T10:00:01.000Z", "old-build rows, primary lost")]),
  );
  writeFileSync(
    join(dir, "tables", "messages", "chat-a.json"),
    JSON.stringify([row("m-new", "chat-a", "2026-08-08T10:00:02.000Z", "sharded rows")]),
  );
  try {
    await assert.rejects(
      unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir }, probeServer: false }),
      /both a monolith and shard files/i,
      "an old build's history surviving only in the .bak must still count as a fork — the format-2 loader reads .bak",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── unshard: refuses to run while something answers on the server port ──

{
  const dir = shardedStorageFixture();
  const server = createServer((_req, res) => res.end("ok"));
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = server.address().port;
  try {
    await assert.rejects(
      unshardLauncherStorage({ env: { FILE_STORAGE_DIR: dir, PORT: String(port) } }),
      /answering on http/i,
      "a live server would re-shard on its next save; unshard must refuse instead of racing it",
    );
    assert.equal(existsSync(join(dir, "tables", "messages.json")), false, "the refused run changed nothing");
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.info("Launcher format-guard regressions passed.");
