// Opt-in: boots the real server twice (about 50 s), longer than run-regressions.mjs allows per file, so it is
// named *.slow-regression.ts to stay out of the default suite. Run it directly:
//   node packages/server/node_modules/tsx/dist/cli.mjs scripts/regressions/server-hunt-b3.slow-regression.ts
// A fatal process error (unhandled rejection or uncaught exception) must close
// the app gracefully so the file-backed store flushes writes still sitting in
// its debounce window, instead of a bare process.exit(1) that drops them.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const serverRequire = createRequire(join(root, "packages/server/package.json"));

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((done) => probe.close(() => done()));
  return address.port;
}

// The preload raises the fatal error on demand: once the trigger file exists it
// throws or rejects without a handler, exactly what the process hooks exist for.
const preloadSource = `
import { existsSync } from "node:fs";
const trigger = process.env.MARINARA_FATAL_TRIGGER;
const kind = process.env.MARINARA_FATAL_KIND;
const timer = setInterval(() => {
  if (!trigger || !existsSync(trigger)) return;
  clearInterval(timer);
  if (kind === "exception") throw new Error("server-hunt-b3 uncaught exception");
  void Promise.reject(new Error("server-hunt-b3 unhandled rejection"));
}, 10);
timer.unref();
`;

async function runCase(kind: "rejection" | "exception") {
  const dir = mkdtempSync(join(tmpdir(), "marinara-fatal-flush-"));
  const trigger = join(dir, "fatal.trigger");
  const port = await freePort();
  const preload = join(dir, "fatal-preload.mjs");
  writeFileSync(preload, preloadSource);
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(serverRequire.resolve("tsx/esm")).href,
      "--import",
      pathToFileURL(preload).href,
      join(root, "packages/server/src/index.ts"),
    ],
    {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: dir,
        FILE_STORAGE_DIR: join(dir, "storage"),
        NODE_ENV: "production",
        MARINARA_LITE: "true",
        LOG_LEVEL: "info",
        AUTO_CREATE_DEFAULT_CONNECTION: "false",
        AUTO_OPEN_BROWSER: "false",
        MARINARA_FATAL_TRIGGER: trigger,
        MARINARA_FATAL_KIND: kind,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const exited = new Promise<number | null>((done) => child.once("exit", done));
  const killer = setTimeout(() => child.kill("SIGKILL"), 150_000);
  try {
    const started = Date.now();
    while (!output.includes("Marinara Engine server listening") && child.exitCode === null) {
      assert.ok(Date.now() - started < 120_000, `Server did not start: ${output}`);
      await new Promise((done) => setTimeout(done, 25));
    }
    assert.ok(output.includes("Marinara Engine server listening"), output);

    const value = `fatal-flush-${kind}-${Date.now()}`;
    const response = await fetch(`http://127.0.0.1:${port}/api/app-settings/ui`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Marinara-CSRF": "1" },
      body: JSON.stringify({ value }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(((await response.json()) as { value: string }).value, value);

    // Fire the fatal error well inside the store's 750 ms save debounce.
    writeFileSync(trigger, "1");
    const code = await exited;
    assert.equal(code, 1, `A fatal error must still exit non-zero: ${output}`);
    assert.ok(output.includes("closing gracefully before exit"), output);
    assert.ok(!output.includes("forcing exit now"), `The crash close must finish within the deadline: ${output}`);

    const shard = join(dir, "storage/tables/app_settings/ui.json");
    assert.ok(existsSync(shard), `The acknowledged write was never flushed (${kind}): ${output}`);
    const rows = JSON.parse(readFileSync(shard, "utf8")) as Array<{ value: string }>;
    assert.ok(
      rows.some((row) => row.value === value),
      `The acknowledged write was dropped by the ${kind} exit`,
    );
    assert.ok(!existsSync(join(dir, "storage/.writer-lease")), "A crash close must release the writer lease");
  } finally {
    clearTimeout(killer);
    if (child.exitCode === null) child.kill("SIGKILL");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
}

await runCase("rejection");
await runCase("exception");
console.log("Fatal process errors flush debounced writes and release the lease before exit(1).");
