import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "../..");
const serverRequire = createRequire(join(root, "packages/server/package.json"));
const dir = mkdtempSync(join(tmpdir(), "marinara-restart-supervisor-"));
const probe = createServer();
await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((done) => probe.close(() => done()));
const child = spawn(
  process.execPath,
  [
    join(root, "scripts/run-server.mjs"),
    "--import",
    serverRequire.resolve("tsx/esm"),
    join(root, "scripts/regressions/fixtures/restart-server.ts"),
  ],
  {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dir,
      FILE_STORAGE_DIR: join(dir, "storage"),
      NODE_ENV: "test",
      MARINARA_LITE: "true",
      LOG_LEVEL: "silent",
      AUTO_CREATE_DEFAULT_CONNECTION: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});
const exited = new Promise((done) => child.once("exit", done));
const base = `http://127.0.0.1:${port}`;
async function waitForPid(previous?: number): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (child.exitCode !== null) assert.fail(`Supervisor exited: ${output}`);
    try {
      const response = await fetch(`${base}/__restart-pid`, { signal: AbortSignal.timeout(500) });
      const body = (await response.json()) as { pid: number; parent: number };
      if (body.pid !== previous) {
        assert.equal(body.parent, child.pid, "Replacement must remain owned by the launcher");
        return body.pid;
      }
    } catch {
      /* still booting */
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail(`Server did not become ready: ${output}`);
}
try {
  const original = await waitForPid();
  const invalid = await fetch(`${base}/api/admin/restart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(invalid.status, 400);
  const restarted = await fetch(`${base}/api/admin/restart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"confirm":true}',
  });
  assert.equal(restarted.status, 202);
  const replacement = await waitForPid(original);
  assert.notEqual(replacement, original);
  assert.throws(() => process.kill(original, 0), "The old process must be gone before its replacement serves");
  assert.ok(!output.includes("writer lease"), output);
  for (const launcher of ["start.sh", "start.bat", "start-termux.sh"]) {
    assert.ok(readFileSync(join(root, launcher), "utf8").includes("node ../../scripts/run-server.mjs dist/index.js"));
  }
  for (const manifest of ["package.json", "packages/server/package.json"]) {
    const pkg = JSON.parse(readFileSync(join(root, manifest), "utf8"));
    assert.ok(pkg.scripts.start.includes("scripts/run-server.mjs"), `${manifest} must supervise pnpm start`);
  }
} finally {
  child.kill("SIGTERM");
  await exited;
  rmSync(dir, { recursive: true, force: true });
}
console.log("Real restart route, single launcher ownership, old-process exit and launcher wiring passed.");
