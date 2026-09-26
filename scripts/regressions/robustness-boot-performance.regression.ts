// Boot performance: with STORAGE_CACHE_WINDOWS_BOOT_ID on, the Windows
// writer-lease boot id no longer costs a PowerShell CIM probe (about 1.5 to
// 2 s of blocked module load) on every start. The probe's exact output is
// cached per OS boot in DATA_DIR, reused only while the boot-time estimate
// still matches, and never cached when the probe fails. With the setting
// unset nothing is cached and every start probes, as before.
// The end-to-end part boots a real file-native store on a synthetic temp
// DATA_DIR in child processes (setting off, then cold and warm cache) and
// reports the phase times; on Windows it proves the warm boot reused the
// cached id and that nothing is written under LOCALAPPDATA.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, uptime } from "node:os";
import { join, resolve } from "node:path";

const CHILD_FLAG = "--boot-child";

if (process.argv.includes(CHILD_FLAG)) {
  // Child: one measured boot of the store against FILE_STORAGE_DIR.
  const t0 = performance.now();
  const store = await import("../../packages/server/src/db/file-backed-store.js");
  const t1 = performance.now();
  const db = await store.createFileNativeDB();
  const t2 = performance.now();
  const ownerPath = join(
    process.env.FILE_STORAGE_DIR!,
    store.STORAGE_WRITER_LEASE_FILENAME,
    store.STORAGE_WRITER_OWNER_FILENAME,
  );
  const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as { bootId?: string };
  await db._fileStore.close();
  process.stdout.write(
    JSON.stringify({ importMs: Math.round(t1 - t0), initMs: Math.round(t2 - t1), bootId: owner.bootId ?? null }) + "\n",
  );
  process.exit(0);
}

const root = resolve(import.meta.dirname, "../..");
const tempRoot = mkdtempSync(join(tmpdir(), "marinara-boot-performance-"));
process.env.LOG_LEVEL = "silent";

try {
  const { cachedBootId, BOOT_ID_CACHE_TOLERANCE_MS } =
    await import("../../packages/server/src/db/writer-boot-id-cache.js");

  // 0. Every Windows identity probe runs hidden, so a server started without a
  //    console never flashes a PowerShell or reg.exe window.
  const storeSource = readFileSync(join(root, "packages/server/src/db/file-backed-store.ts"), "utf8");
  // The Windows probes call execFileSync(executable, ...): machine id (reg.exe), boot id and
  // lease owner start time (PowerShell).
  const probeCalls = storeSource
    .split("execFileSync(")
    .slice(1)
    .filter((rest) => rest.trimStart().startsWith("executable,"))
    .map((rest) => rest.slice(0, rest.indexOf("},") + 2));
  assert.ok(probeCalls.length >= 3, "every Windows identity probe is found");
  for (const call of probeCalls) assert.match(call, /windowsHide: true/u, `probe must be hidden: ${call.slice(0, 80)}`);

  // 1. Cache semantics with a fake probe.
  const cachePath = join(tempRoot, "unit", "writer-boot-id.json");
  let probes = 0;
  const probe = (value: string | null) => () => {
    probes++;
    return value;
  };
  const boot = 1_790_000_000_000;
  assert.equal(cachedBootId(cachePath, boot, probe("2026-09-19T13:10:31.2958810Z")), "2026-09-19T13:10:31.2958810Z");
  assert.equal(probes, 1, "cold cache probes once");
  assert.ok(existsSync(cachePath), "successful probe is cached");
  assert.equal(cachedBootId(cachePath, boot + 350, probe("other")), "2026-09-19T13:10:31.2958810Z");
  assert.equal(
    cachedBootId(cachePath, boot - BOOT_ID_CACHE_TOLERANCE_MS, probe("other")),
    "2026-09-19T13:10:31.2958810Z",
  );
  assert.equal(probes, 1, "same boot within tolerance never probes again");

  // A later boot (estimate moved past the tolerance) re-probes and replaces the cache.
  const nextBoot = boot + 3_600_000;
  assert.equal(
    cachedBootId(cachePath, nextBoot, probe("2026-09-19T14:10:31.0000000Z")),
    "2026-09-19T14:10:31.0000000Z",
  );
  assert.equal(probes, 2);
  assert.equal(cachedBootId(cachePath, nextBoot + 10, probe("x")), "2026-09-19T14:10:31.0000000Z");
  assert.equal(probes, 2);

  // A failed probe (timeout, no PowerShell) returns null and is never cached.
  const nullPath = join(tempRoot, "unit", "null-boot-id.json");
  assert.equal(cachedBootId(nullPath, boot, probe(null)), null);
  assert.equal(existsSync(nullPath), false, "null probe result is not cached");
  assert.equal(cachedBootId(nullPath, boot, probe("later")), "later", "next start probes again");

  // Corrupt or wrong-shape caches fall back to the probe and are repaired.
  for (const junk of [
    "not json",
    "null",
    '{"version":2,"approxBootMs":1,"bootId":"x"}',
    '{"version":1,"approxBootMs":1,"bootId":""}',
  ]) {
    writeFileSync(cachePath, junk);
    const before = probes;
    assert.equal(cachedBootId(cachePath, boot, probe("fresh")), "fresh");
    assert.equal(probes, before + 1, `corrupt cache ${junk} probes`);
  }
  // A non-finite estimate never reads or writes the cache.
  const nanPath = join(tempRoot, "unit", "nan-boot-id.json");
  assert.equal(cachedBootId(nanPath, Number.NaN, probe("nan-probe")), "nan-probe");
  assert.equal(existsSync(nanPath), false);
  // An unwritable cache location still returns the probe result.
  const blocker = join(tempRoot, "unit", "blocker");
  writeFileSync(blocker, "file, not a directory");
  assert.equal(cachedBootId(join(blocker, "boot-id.json"), boot, probe("still-ok")), "still-ok");

  // 2. End-to-end boots on a synthetic store (never live data).
  const storageDir = join(tempRoot, "data", "storage");
  const chats = 60;
  const perChat = 120;
  const text = "The caravan rolls on through the valley at dusk. ".repeat(12);
  const { encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
  for (const table of ["chats", "messages"]) mkdirSync(join(storageDir, "tables", table), { recursive: true });
  for (let c = 0; c < chats; c++) {
    const chatId = `fixture-chat-${c}`;
    const shard = `${encodeShardKey(chatId)}.json`;
    writeFileSync(
      join(storageDir, "tables", "chats", shard),
      JSON.stringify([{ id: chatId, name: chatId, mode: "conversation", createdAt: "2026-01-01T00:00:00.000Z" }]),
    );
    const rows = [];
    for (let m = 0; m < perChat; m++) {
      rows.push({
        id: `${chatId}-m${m}`,
        chatId,
        role: m % 2 ? "assistant" : "user",
        content: text,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    }
    writeFileSync(join(storageDir, "tables", "messages", shard), JSON.stringify(rows));
  }

  const localAppData = join(tempRoot, "localappdata");
  mkdirSync(localAppData, { recursive: true });
  const runBoot = (label: string, cacheEnabled: boolean) => {
    const result = spawnSync(
      process.execPath,
      [join(root, "packages/server/node_modules/tsx/dist/cli.mjs"), import.meta.filename, CHILD_FLAG],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120_000,
        windowsHide: true,
        env: {
          ...process.env,
          LOG_LEVEL: "silent",
          LOG_FILE_LEVEL: "silent",
          DATA_DIR: join(tempRoot, "data"),
          FILE_STORAGE_DIR: storageDir,
          LOCALAPPDATA: localAppData,
          STORAGE_CACHE_WINDOWS_BOOT_ID: cacheEnabled ? "true" : "",
        },
      },
    );
    assert.equal(result.status, 0, `${label} boot failed: ${result.stderr}`);
    const line = result.stdout.trim().split("\n").at(-1)!;
    return JSON.parse(line) as { importMs: number; initMs: number; bootId: string | null };
  };

  // First run only warms the tsx transpile cache so the two timed runs compare
  // the boot path rather than TypeScript compilation.
  runBoot("prime", false);
  const bootCachePath = join(tempRoot, "data", ".writer-boot-id.json");
  // Default (setting unset): no cache file anywhere, and a seeded cache is ignored.
  assert.equal(existsSync(bootCachePath), false, "default: the boot id is never cached");
  if (process.platform === "win32") {
    writeFileSync(
      bootCachePath,
      JSON.stringify({ version: 1, approxBootMs: Date.now() - uptime() * 1000, bootId: "fixture-cached-boot" }),
    );
    const uncached = runBoot("default", false);
    assert.notEqual(uncached.bootId, "fixture-cached-boot", "default: a cache file is never read");
  }
  rmSync(bootCachePath, { force: true });
  const cold = runBoot("cold", true);
  if (process.platform === "win32") {
    if (cold.bootId !== null) {
      const written = JSON.parse(readFileSync(bootCachePath, "utf8")) as { bootId: string };
      assert.equal(written.bootId, cold.bootId, "cold boot cached the exact probe output");
    } else {
      // The real probe timed out (heavy load): the failure must not be cached.
      assert.equal(existsSync(bootCachePath), false, "a null cold probe must leave no cache behind");
    }
  }
  if (process.platform === "win32") {
    // Seed the cache for THIS boot with a marker the real probe could never
    // print: the warm boot recording it proves no PowerShell probe ran.
    writeFileSync(
      bootCachePath,
      JSON.stringify({ version: 1, approxBootMs: Date.now() - uptime() * 1000, bootId: "fixture-cached-boot" }),
    );
  }
  const warm = runBoot("warm", true);
  if (process.platform === "win32") {
    assert.equal(warm.bootId, "fixture-cached-boot", "warm boot reused the cached boot id");
    if (cold.bootId !== null) {
      assert.match(cold.bootId, /^\d{4}-\d{2}-\d{2}T/, "cold boot recorded the real LastBootUpTime string");
    }
  }
  assert.deepEqual(readdirSync(localAppData), [], "no boot writes anything under LOCALAPPDATA");
  console.info(
    `Boot performance: cache semantics passed; synthetic store ${chats} chats x ${perChat} messages. ` +
      `cold boot import ${cold.importMs} ms + store init ${cold.initMs} ms; ` +
      `warm boot import ${warm.importMs} ms + store init ${warm.initMs} ms.`,
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
