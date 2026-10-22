import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { regressionTimeoutMs } from "../run-regressions.mjs";

assert.equal(regressionTimeoutMs("scripts/regressions/server-signal-shutdown.regression.ts"), 270_000);
assert.equal(regressionTimeoutMs("scripts/regressions/restart-supervisor.regression.ts"), 90_000);
assert.equal(regressionTimeoutMs("scripts/regressions/ruleset-combat-director.regression.ts"), 300_000);
assert.equal(regressionTimeoutMs("scripts/regressions/native-export-memory.regression.ts"), 60_000);
assert.equal(regressionTimeoutMs("scripts/regressions/prompt.regression.ts"), 30_000);

// The shard action runs on Ubuntu; native Windows checks do not require Bash.
if (process.platform !== "win32") {
  // Exercise the action's actual shell command; setup must consume the shard's budget too.
  const action = readFileSync(new URL("../../.github/actions/playwright-shard/action.yml", import.meta.url), "utf8");
  const shardRun = action.match(/      run: (>-|\|)\n([\s\S]+)$/u);
  assert(shardRun, "the shard action must expose its run command");
  const lines = shardRun[2]
    .trimEnd()
    .split("\n")
    .map((line) => line.replace(/^ {8}/u, ""));
  const shardScript = (shardRun[1] === ">-" ? lines.join(" ") : lines.join("\n"))
    .replaceAll("${{ inputs.project }}", "desktop-chromium")
    .replaceAll("${{ inputs.shard }}", "1")
    .replaceAll("${{ inputs.total-shards }}", "16");
  const runShard = (minutes, elapsedSeconds) =>
    spawnSync(
      "bash",
      [
        "--noprofile",
        "--norc",
        "-e",
        "-o",
        "pipefail",
        "-c",
        `
    date() { printf '%s\\n' "$FIXTURE_NOW"; }
    pnpm() { printf '%s\\n' "$@"; }
    ${shardScript}
  `,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GLOBAL_TIMEOUT_MINUTES: String(minutes),
          PLAYWRIGHT_SHARD_STARTED_AT: "0",
          FIXTURE_NOW: String(elapsedSeconds),
        },
      },
    );
  for (const [minutes, elapsedSeconds, expectedMs] of [
    [40, 120, 2_280_000],
    [40, 2100, 300_000],
    [40, -120, 2_400_000],
    [0, 7200, 0],
  ]) {
    const result = runShard(minutes, elapsedSeconds);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`--global-timeout=${expectedMs}\\n`, "u"));
  }
  for (const elapsedSeconds of [2400, 2700]) {
    const result = runShard(40, elapsedSeconds);
    assert.equal(result.status, 1, "expired setup must fail, not turn Playwright timeout 0 into unlimited");
    assert.match(result.stderr, /budget.*exhausted/iu);
    assert.equal(result.stdout, "", "Playwright is not started after setup exhausted the budget");
  }
}

// An absolute path through a linked directory must still run the CLI, not exit successfully
// without running anything (for example, /tmp is a symlink to /private/tmp on macOS).
const scripts = fileURLToPath(new URL("../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "marinara-runner-entry-"));
try {
  const linkedScripts = join(dir, "scripts");
  symlinkSync(scripts, linkedScripts, process.platform === "win32" ? "junction" : "dir");
  const list = (entry) => execFileSync(process.execPath, [entry, "--list"], { encoding: "utf8", timeout: 10_000 });
  const canonical = list(join(scripts, "run-regressions.mjs"));
  assert.match(canonical, /scripts\/regressions\/regression-timeout-policy\.regression\.mjs/);
  assert.equal(list(join(linkedScripts, "run-regressions.mjs")), canonical);
  for (const count of ["0", "two"]) {
    const rejected = spawnSync(process.execPath, [join(scripts, "run-regressions.mjs"), "--list", "--concurrency", count], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(rejected.status, 1, `--concurrency ${count} must be refused`);
    assert.match(rejected.stderr, /--concurrency <n>/u);
  }
  // Shards are disjoint, cover every file and each carry one of the slowest files.
  const everyFile = canonical.trim().split("\n");
  const shards = [1, 2, 3].map((index) =>
    execFileSync(process.execPath, [join(scripts, "run-regressions.mjs"), "--list", "--shard", `${index}/3`], {
      encoding: "utf8",
      timeout: 10_000,
    })
      .trim()
      .split("\n"),
  );
  assert.deepEqual(shards.flat().sort(), everyFile);
  assert.equal(new Set(shards.flat()).size, everyFile.length, "a file must run in exactly one shard");
  const slowest = [...everyFile].sort((a, b) => regressionTimeoutMs(b) - regressionTimeoutMs(a)).slice(0, 3);
  for (const [index, shard] of shards.entries()) {
    assert.equal(shard.filter((file) => slowest.includes(file)).length, 1, `shard ${index + 1} takes one of the slowest files`);
  }
  for (const value of ["0/3", "4/3", "1", "a/b"]) {
    const rejected = spawnSync(process.execPath, [join(scripts, "run-regressions.mjs"), "--list", "--shard", value], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(rejected.status, 1, `--shard ${value} must be refused`);
    assert.match(rejected.stderr, /--shard <i>\/<n>/u);
  }
  const imported = execFileSync(process.execPath, ["--input-type=module", "-"], {
    input: `import { regressionTimeoutMs } from ${JSON.stringify(pathToFileURL(join(scripts, "run-regressions.mjs")).href)}; console.log(regressionTimeoutMs('scripts/regressions/prompt.regression.ts'));`,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(imported.trim(), "30000", "importing from stdin must not run the CLI or require a filename");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("Scoped regression timeouts and absolute/symlink CLI entry passed.");
