import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RotatingFileSink } from "../../packages/server/src/lib/rotating-sink.js";

const root = mkdtempSync(join(tmpdir(), "marinara-diagnostic-log-"));
const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { stdio: "ignore", windowsHide: true });
try {
  assert.ok(child.pid);

  const rotationDir = join(root, "rotation");
  const sink = new RotatingFileSink({ directory: rotationDir, maxBytes: 180, keep: 10 });
  for (let i = 0; i < 40; i++) {
    assert.equal(
      sink.write(JSON.stringify({ level: 30, requestId: `req-${i}`, message: "x".repeat(40) }) + "\n"),
      true,
    );
  }
  sink.end();
  const rotated = readdirSync(rotationDir).filter((name) =>
    /^marinara-\d+-[a-z0-9]+\.log(?:\.\d+-[a-z0-9]+)?$/.test(name),
  );
  assert.ok(
    rotated.some((name) => /\.log\.\d+-[a-z0-9]+$/.test(name)),
    "rotation archive must use timestamp-random suffix",
  );
  assert.ok(rotated.filter((name) => !/\.log$/.test(name)).length <= 10, "inactive retention cap must be enforced");
  for (const name of rotated) {
    assert.ok(statSync(join(rotationDir, name)).isFile());
    for (const line of readFileSync(join(rotationDir, name), "utf8").trim().split("\n").filter(Boolean)) {
      assert.ok(Buffer.byteLength(`${line}\n`) <= 256 * 1024);
      assert.doesNotThrow(() => JSON.parse(line));
    }
  }

  const oversizedDir = join(root, "oversized");
  const oversized = new RotatingFileSink({ directory: oversizedDir, maxBytes: 512 * 1024, keep: 10 });
  const huge = JSON.stringify({
    code: "E_UNICODE",
    errorId: "err-1",
    requestId: "req-1",
    message: "🙂".repeat(200_000),
  });
  assert.equal(oversized.write(huge), true);
  oversized.end();
  const oversizedFile = readdirSync(oversizedDir).find((name) => name.endsWith(".log"))!;
  const oversizedLine = readFileSync(join(oversizedDir, oversizedFile), "utf8").trim();
  const oversizedRecord = JSON.parse(oversizedLine) as Record<string, unknown>;
  assert.equal(oversizedRecord.truncated, true);
  assert.equal(oversizedRecord.code, "E_UNICODE");
  assert.equal(oversizedRecord.errorId, "err-1");
  assert.equal(oversizedRecord.requestId, "req-1");
  assert.ok(Buffer.byteLength(`${oversizedLine}\n`) <= 256 * 1024);

  const preservationDir = join(root, "preservation");
  const childName = `marinara-${child.pid}-livebase.log`;
  const unknownName = "do-not-touch.txt";
  mkdirSync(preservationDir, { recursive: true });
  writeFileSync(join(preservationDir, unknownName), "keep me", { flag: "w" });
  writeFileSync(join(preservationDir, childName), "live", { flag: "w" });
  const staleName = "marinara-999999-stale.log";
  writeFileSync(join(preservationDir, staleName), "stale", { flag: "w" });
  utimesSync(join(preservationDir, staleName), new Date(0), new Date(0));
  const preserving = new RotatingFileSink({ directory: preservationDir, maxBytes: 64, keep: 0, retentionMs: 1 });
  assert.equal(preserving.write(JSON.stringify({ message: "one" }) + "\n"), true);
  preserving.end();
  assert.equal(readFileSync(join(preservationDir, unknownName), "utf8"), "keep me");
  assert.equal(readFileSync(join(preservationDir, childName), "utf8"), "live");
  assert.equal(readdirSync(preservationDir).includes(staleName), false, "ESRCH stale file should be pruned");

  const invalidParent = join(root, "invalid-parent");
  writeFileSync(invalidParent, "not a directory");
  const broken = new RotatingFileSink({ directory: join(invalidParent, "logs"), maxBytes: 64, keep: 1 });
  assert.doesNotThrow(() => assert.equal(broken.write(JSON.stringify({ message: "no throw" }) + "\n"), false));
  broken.end();
} finally {
  child.kill();
  rmSync(root, { recursive: true, force: true });
}
process.stdout.write("Diagnostic log-file regression passed.\n");
