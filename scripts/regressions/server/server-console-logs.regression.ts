// In-app server console (#9302): lib/log-buffer.ts keeps the last Pino lines in memory, teed in by
// logger.ts's streamWrite hook, and GET /api/admin/logs serves them behind the privileged gate.
// The buffer is bounded by count and by size, tells a poller when it missed lines, and the route's
// own polls never land in it.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-console-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
// info, so request lines exist and the route's silence is tested; json, so no pino-pretty worker.
process.env.LOG_LEVEL = "info";
process.env.LOG_FORMAT = "json";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
delete process.env.ADMIN_SECRET;
delete process.env.BASIC_AUTH_USER;
delete process.env.BASIC_AUTH_PASS;

try {
  const buffer = await import("../../../packages/server/src/lib/log-buffer.js");
  const { recordServerLogLine, getServerLogSnapshot, clearServerLogBuffer } = buffer;

  // 1. A Pino line keeps level, time, message and its own fields; pid/hostname/bootId are dropped.
  clearServerLogBuffer();
  recordServerLogLine(
    JSON.stringify({
      level: 40,
      time: 1_700_000_000_000,
      pid: 1,
      hostname: "h",
      bootId: "b",
      requestId: "r1",
      msg: "[x] hi",
    }) + "\n",
  );
  recordServerLogLine("not json at all\n");
  {
    const snap = getServerLogSnapshot();
    assert.equal(snap.entries.length, 2);
    const [first, second] = snap.entries;
    assert.deepEqual(
      { level: first.level, time: first.time, msg: first.msg, fields: first.fields },
      { level: 40, time: 1_700_000_000_000, msg: "[x] hi", fields: { requestId: "r1" } },
    );
    assert.equal(second.msg, "not json at all", "a non-JSON line is kept as text");
    assert.equal(snap.latestId, second.id);
    assert.equal(snap.truncated, false);
    // afterId returns only newer lines.
    const after = getServerLogSnapshot(first.id);
    assert.deepEqual(
      after.entries.map((entry) => entry.id),
      [second.id],
    );
    assert.equal(getServerLogSnapshot(second.id).entries.length, 0, "nothing new after the latest id");
  }

  // 2. Bounded by count: the oldest lines go, and a poller whose afterId fell out is told so.
  clearServerLogBuffer();
  const startId = getServerLogSnapshot().latestId;
  for (let index = 0; index < buffer.SERVER_LOG_MAX_ENTRIES + 10; index++) {
    recordServerLogLine(JSON.stringify({ level: 30, time: index, msg: `line ${index}` }));
  }
  {
    const all = getServerLogSnapshot();
    assert.equal(all.entries.length, buffer.SERVER_LOG_MAX_ENTRIES);
    assert.equal(all.entries[0]?.msg, "line 10", "the ten oldest lines were evicted");
    const stale = getServerLogSnapshot(all.entries[0]!.id - 5);
    assert.equal(stale.truncated, true, "a poller that missed evicted lines learns it");
    const limited = getServerLogSnapshot(0, 5);
    assert.equal(limited.entries.length, 5);
    assert.equal(limited.entries.at(-1)?.msg, `line ${buffer.SERVER_LOG_MAX_ENTRIES + 9}`, "limit keeps the newest");
    assert.equal(limited.truncated, true);
    assert.ok(startId >= 0);
  }

  // 3. Bounded by size: long messages are cut, and the total stays under the budget.
  clearServerLogBuffer();
  const huge = "p".repeat(buffer.SERVER_LOG_MAX_PART_CHARS * 3);
  for (let index = 0; index < 400; index++) {
    recordServerLogLine(JSON.stringify({ level: 20, time: index, msg: huge, err: { stack: huge } }));
  }
  {
    const snap = getServerLogSnapshot();
    const first = snap.entries[0]!;
    assert.equal(first.msg.length, buffer.SERVER_LOG_MAX_PART_CHARS, "a long message is cut to the cap");
    assert.ok(first.msg.endsWith("…"));
    assert.equal(typeof first.fields?.fields, "string", "an oversized field block is kept as cut text");
    const total = snap.entries.reduce(
      (sum, entry) =>
        sum + entry.msg.length + Math.min(JSON.stringify(entry.fields ?? {}).length, buffer.SERVER_LOG_MAX_PART_CHARS),
      0,
    );
    assert.ok(
      total <= buffer.SERVER_LOG_MAX_CHARS + buffer.SERVER_LOG_MAX_PART_CHARS * 2,
      `size budget holds (${total})`,
    );
    assert.ok(snap.entries.length < 400, "the size budget evicted lines before the count limit did");
  }

  // 4. A broken line never throws into the logger.
  assert.doesNotThrow(() => recordServerLogLine(undefined as unknown as string));

  // 5. The real logger tees into the buffer, and the route serves it behind the privileged gate.
  const { bootId, logger } = await import("../../../packages/server/src/lib/logger.js");
  const { buildApp } = await import("../../../packages/server/src/app.js");
  const app = await buildApp();
  try {
    clearServerLogBuffer();
    logger.warn({ marker: 7 }, "[server-console] marker line");
    const marker = getServerLogSnapshot().entries.find((entry) => entry.msg === "[server-console] marker line");
    assert.ok(marker, "a logger.warn line reaches the buffer");
    assert.equal(marker.level, 40);
    assert.equal(marker.fields?.marker, 7);

    const response = await app.inject({ method: "GET", url: "/api/admin/logs" });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["ratelimit-limit"], "120", "the route has its own rate limit for polling");
    const body = response.json();
    assert.equal(body.logLevel, "info", "the reply names the server's LOG_LEVEL for the hint");
    assert.equal(body.bootId, bootId, "the reply names this process start, so the console can spot a restart");
    assert.match(body.bootId, /^[0-9a-f]{8}$/u);
    assert.ok(body.entries.some((entry: { msg: string }) => entry.msg === "[server-console] marker line"));

    const next = await app.inject({ method: "GET", url: `/api/admin/logs?afterId=${body.latestId}` });
    assert.equal(next.statusCode, 200, next.body);
    const polled = next.json();
    assert.ok(
      !JSON.stringify(polled.entries).includes("/api/admin/logs"),
      "the console's own polls are not logged into the buffer",
    );

    // Some other request at info level does log, so the silence above is the route's, not the level's.
    await app.inject({ method: "GET", url: "/api/health" });
    assert.ok(
      getServerLogSnapshot(polled.latestId).entries.some((entry) => JSON.stringify(entry).includes("/api/health")),
      "ordinary requests still reach the buffer",
    );

    const remote = await app.inject({ method: "GET", url: "/api/admin/logs", remoteAddress: "203.0.113.7" });
    assert.ok(
      remote.statusCode >= 400,
      `a remote caller without the admin secret is refused (got ${remote.statusCode})`,
    );
    assert.ok(!remote.body.includes("marker line"));
  } finally {
    await app.close();
  }
  console.info("Server console logs regression passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
