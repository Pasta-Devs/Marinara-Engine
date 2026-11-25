import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { discoverRegressions, REGRESSION_TIMEOUTS_MS, regressionTimeoutMs } from "../../run-regressions.mjs";

assert.equal(regressionTimeoutMs("scripts/regressions/server/server-signal-shutdown.regression.ts"), 270_000);
assert.equal(regressionTimeoutMs("scripts/regressions/launcher/restart-supervisor.regression.ts"), 90_000);
assert.equal(regressionTimeoutMs("scripts/regressions/game-ruleset/ruleset-combat-director.regression.ts"), 300_000);
assert.equal(regressionTimeoutMs("scripts/regressions/native-export-memory.regression.ts"), 90_000);
assert.equal(regressionTimeoutMs("scripts/regressions/prompt/assembly.regression.ts"), 30_000);

// A moved or renamed file would silently lose its longer limit and time out under CI load.
const discovered = new Set(discoverRegressions());
for (const file of REGRESSION_TIMEOUTS_MS.keys()) {
  assert(discovered.has(file), `${file} has a time limit in run-regressions.mjs but names no regression`);
}

// The shard action runs on Ubuntu; native Windows checks do not require Bash.
if (process.platform !== "win32") {
  // Exercise the action's actual shell command; setup must consume the shard's budget too.
  const action = readFileSync(new URL("../../../.github/actions/playwright-shard/action.yml", import.meta.url), "utf8");
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

  // The shard action's browser install: a runner image's Ubuntu packages come from the Actions cache once
  // one shard has downloaded them, and a mirror too slow for the budget fails setup with a clear error (#9801).
  const installScript = fileURLToPath(
    new URL("../../../.github/actions/playwright-shard/install-browser.sh", import.meta.url),
  );
  const runner = mkdtempSync(join(tmpdir(), "marinara-browser-install-"));
  try {
    const bin = join(runner, "bin");
    mkdirSync(bin);
    const stubs = {
      sudo: 'exec "$@"',
      // apt-get clean empties apt's cache; apt-get install of .deb files installs them (or fails, for a broken cache).
      // Like apt on the runner image, it downloads them from the mirror instead while it can read the image's
      // package lists, which list the same versions.
      "apt-get": `case "$1" in
  clean) rm -f "$APT_ARCHIVES"/*.deb ;;
  install)
    case "$*" in *Dir::State::Lists=*) ;; *) [ -z "$FAKE_MIRROR_DOWN" ] || exit 100 ;; esac
    for arg; do case "$arg" in /*.deb) [ -z "$FAKE_BROKEN_CACHE" ] || exit 100; echo "package \${arg##*/}" >> "$FAKE_SYSTEM" ;; esac; done ;;
esac`,
      // pnpm exec playwright install [--with-deps] <browser>; --with-deps downloads one package from the mirror.
      pnpm: `shift 3
if [ "$1" = --with-deps ]; then
  [ -z "$FAKE_MIRROR_DOWN" ] || exit 100
  : > "$APT_ARCHIVES/libwpe_1_amd64.deb"
  echo "package libwpe_1_amd64.deb" >> "$FAKE_SYSTEM"
  shift
fi
echo "browser $1" >> "$FAKE_SYSTEM"`,
      // GNU timeout exits 124 when the limit passes.
      timeout: `[ -z "$FAKE_MIRROR_STALLED" ] || exit 124
shift
exec "$@"`,
    };
    for (const [name, body] of Object.entries(stubs)) {
      writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, "utf8");
      chmodSync(join(bin, name), 0o755);
    }
    const install = (name, { cached = [], ...fakes } = {}) => {
      const dir = join(runner, name);
      const debs = join(dir, "debs");
      const archives = join(dir, "archives");
      mkdirSync(debs, { recursive: true });
      mkdirSync(archives);
      for (const file of cached) writeFileSync(join(debs, file), "", "utf8");
      // A package the image left in apt's cache is not one this install downloaded.
      writeFileSync(join(archives, "image-leftover_1_amd64.deb"), "", "utf8");
      writeFileSync(join(dir, "output"), "", "utf8");
      writeFileSync(join(dir, "system"), "", "utf8");
      const result = spawnSync("bash", [installScript, "webkit", debs], {
        encoding: "utf8",
        env: {
          ...process.env,
          ...fakes,
          PATH: `${bin}:${process.env.PATH}`,
          APT_ARCHIVES: archives,
          TMPDIR: dir,
          GITHUB_OUTPUT: join(dir, "output"),
          FAKE_SYSTEM: join(dir, "system"),
        },
      });
      return {
        ...result,
        system: readFileSync(join(dir, "system"), "utf8").trim().split("\n").filter(Boolean),
        output: readFileSync(join(dir, "output"), "utf8"),
        saved: readdirSync(debs).sort(),
      };
    };

    const cached = install("cached", {
      cached: ["libwpe_1_amd64.deb", "libmanette_1_amd64.deb"],
      FAKE_MIRROR_DOWN: "1",
    });
    assert.equal(cached.status, 0, `cached packages install without the mirror: ${cached.stderr}`);
    assert.deepEqual(cached.system, ["package libmanette_1_amd64.deb", "package libwpe_1_amd64.deb", "browser webkit"]);
    assert.doesNotMatch(cached.output, /save=true/u, "a cache hit is not saved again");

    const first = install("first");
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(first.system, ["package libwpe_1_amd64.deb", "browser webkit"]);
    assert.deepEqual(first.saved, ["libwpe_1_amd64.deb"], "the first install keeps only the packages it downloaded");
    assert.match(first.output, /^save=true$/mu);

    const stalled = install("stalled", { FAKE_MIRROR_STALLED: "1" });
    assert.equal(stalled.status, 124);
    assert.match(stalled.stdout, /::error::Installing webkit .*took over 10 minutes.*mirror is slow/u);
    assert.deepEqual(stalled.system, [], "Playwright is not reported installed");
    assert.deepEqual(stalled.saved, []);
    assert.doesNotMatch(stalled.output, /save=true/u);

    const broken = install("broken", { cached: ["libwpe_1_amd64.deb"], FAKE_BROKEN_CACHE: "1" });
    assert.equal(broken.status, 0, `a cache that does not install falls back to the mirror: ${broken.stderr}`);
    assert.match(broken.stdout, /::warning::The cached webkit packages did not install/u);
    assert.deepEqual(broken.system, ["package libwpe_1_amd64.deb", "browser webkit"]);
    assert.doesNotMatch(broken.output, /save=true/u, "the cache key already exists, so it is not saved again");
  } finally {
    rmSync(runner, { recursive: true, force: true });
  }
}

// An absolute path through a linked directory must still run the CLI, not exit successfully
// without running anything (for example, /tmp is a symlink to /private/tmp on macOS).
const scripts = fileURLToPath(new URL("../../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "marinara-runner-entry-"));
try {
  const linkedScripts = join(dir, "scripts");
  symlinkSync(scripts, linkedScripts, process.platform === "win32" ? "junction" : "dir");
  const list = (entry) => execFileSync(process.execPath, [entry, "--list"], { encoding: "utf8", timeout: 10_000 });
  const canonical = list(join(scripts, "run-regressions.mjs"));
  assert.match(canonical, /scripts\/regressions\/tooling\/regression-timeout-policy\.regression\.mjs/);
  assert.equal(list(join(linkedScripts, "run-regressions.mjs")), canonical);
  for (const count of ["0", "two"]) {
    const rejected = spawnSync(
      process.execPath,
      [join(scripts, "run-regressions.mjs"), "--list", "--concurrency", count],
      {
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(rejected.status, 1, `--concurrency ${count} must be refused`);
    assert.match(rejected.stderr, /--concurrency <n>/u);
  }
  // Shards are disjoint, cover every file and each carry one of the slowest files.
  const everyFile = canonical.trim().split("\n");
  // The node-shards matrix in .github/workflows/playwright.yml.
  const shardCount = 8;
  const shards = Array.from({ length: shardCount }, (_, offset) => offset + 1).map((index) =>
    execFileSync(
      process.execPath,
      [join(scripts, "run-regressions.mjs"), "--list", "--shard", `${index}/${shardCount}`],
      {
        encoding: "utf8",
        timeout: 10_000,
      },
    )
      .trim()
      .split("\n"),
  );
  assert.deepEqual(shards.flat().sort(), everyFile);
  assert.equal(new Set(shards.flat()).size, everyFile.length, "a file must run in exactly one shard");
  const slowest = [...everyFile].sort((a, b) => regressionTimeoutMs(b) - regressionTimeoutMs(a)).slice(0, shardCount);
  for (const [index, shard] of shards.entries()) {
    assert.equal(
      shard.filter((file) => slowest.includes(file)).length,
      1,
      `shard ${index + 1} takes one of the slowest files`,
    );
  }
  for (const value of ["0/4", "5/4", "1", "a/b"]) {
    const rejected = spawnSync(process.execPath, [join(scripts, "run-regressions.mjs"), "--list", "--shard", value], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(rejected.status, 1, `--shard ${value} must be refused`);
    assert.match(rejected.stderr, /--shard <i>\/<n>/u);
  }
  // Repeated --filter selects the union, and a miss names every filter.
  const filtered = (...filters) =>
    execFileSync(
      process.execPath,
      [join(scripts, "run-regressions.mjs"), "--list", ...filters.flatMap((filter) => ["--filter", filter])],
      { encoding: "utf8", timeout: 10_000 },
    )
      .trim()
      .split("\n");
  const [first, second] = ["regression-timeout-policy", "release-tag-version"];
  assert.deepEqual(filtered(first, second), [...filtered(first), ...filtered(second)].sort());
  const missed = spawnSync(
    process.execPath,
    [join(scripts, "run-regressions.mjs"), "--list", "--filter", "no-such-a", "--filter", "no-such-b"],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(missed.status, 1, "filters that match nothing must fail");
  assert.match(missed.stderr, /no-such-a, no-such-b/u);
  const imported = execFileSync(process.execPath, ["--input-type=module", "-"], {
    input: `import { regressionTimeoutMs } from ${JSON.stringify(pathToFileURL(join(scripts, "run-regressions.mjs")).href)}; console.log(regressionTimeoutMs('scripts/regressions/prompt/assembly.regression.ts'));`,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(imported.trim(), "30000", "importing from stdin must not run the CLI or require a filename");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("Scoped regression timeouts and absolute/symlink CLI entry passed.");
