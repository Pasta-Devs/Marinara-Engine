import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The gate's steps run on Ubuntu; native Windows does not require their Bash tooling.
if (process.platform === "win32") {
  console.log("Skipping the POSIX CodeRabbit review gate on Windows; exercise it on Ubuntu or macOS with Bash.");
  process.exit(0);
}

const source = readFileSync(new URL("../../../.github/workflows/coderabbit-review-gate.yml", import.meta.url), "utf8");
assert.ok(
  source.includes(`    if: >
      github.event_name == 'check_run' &&
      github.event.check_run.app.slug == 'coderabbitai' &&
      github.event.check_run.name == 'CodeRabbit'
    runs-on:`),
  "The gate runs only for CodeRabbit's own check run, with every condition required",
);
assert.ok(
  source.includes(`    if: >
      github.event_name == 'pull_request_target' &&
      github.event.pull_request.base.ref == github.event.repository.default_branch
    runs-on:`),
  "The description edit runs only for pull requests into the default branch",
);

/** The Bash of the step named `name`, unindented. */
function step(name) {
  const lines = source.split(`      - name: ${name}\n`)[1]?.split("        run: |\n")[1]?.split("\n");
  assert.ok(lines, `The step "${name}" must exist`);
  const script = [];
  for (const line of lines) {
    if (line.trim() && !line.startsWith("          ")) break;
    script.push(line.slice(10));
  }
  const bash = script.join("\n");
  assert.ok(!bash.includes("${{"), `"${name}" must read the event through env, not workflow expressions`);
  return bash;
}
const gate = step("Set Dottore Review from CodeRabbit's review");
const ignore = step("Add @coderabbitai ignore to the description");

const repo = "Pasta-Devs/Marinara-Engine";
const sha = (c) => c.repeat(40);
const head = sha("a");
const temp = mkdtempSync(join(tmpdir(), "marinara-coderabbit-gate-"));
try {
  // gh mock: serves the open PRs, each commit's combined status, the PR's commits and description; records the rest.
  writeFileSync(
    join(temp, "gh"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const cp = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GATE_CALLS, JSON.stringify(args) + "\\n");
const jq = (input) => {
  const result = cp.spawnSync("jq", ["-r", args[args.indexOf("--jq") + 1]], { input: JSON.stringify(input), encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.exit(result.status ?? 1);
};
const repo = "repos/${repo}/";
if (args[0] === "workflow" && args[1] === "run") process.exit(0);
if (args[0] === "api" && args[1] === "--method") process.exit(0);
if (args[0] === "api" && args[1].startsWith(repo + "pulls?state=open")) jq(JSON.parse(process.env.GATE_PULLS));
const status = args[0] === "api" && /^repos\\/[^/]+\\/[^/]+\\/commits\\/([0-9a-f]{40})\\/status\\?/.exec(args[1]);
if (status) jq({ statuses: JSON.parse(process.env.GATE_STATUSES)[status[1]] ?? [] });
if (args[0] === "api" && /\\/pulls\\/\\d+\\/commits\\?/.test(args[1])) jq(JSON.parse(process.env.GATE_COMMITS));
if (args[0] === "api" && /\\/pulls\\/\\d+$/.test(args[1])) jq({ body: JSON.parse(process.env.GATE_BODY) });
if (args[0] === "api" && args[1].includes("/contents/.github/workflows/dottore-review.yml?ref=")) process.exit(0);
throw new Error("Unexpected gh call: " + JSON.stringify(args));
`,
    { mode: 0o755 },
  );

  const pr = (overrides = {}) => ({
    number: 9086,
    base: { ref: "staging" },
    draft: false,
    head: { sha: head },
    ...overrides,
  });
  const other = { number: 9000, base: { ref: "staging" }, draft: false, head: { sha: sha("b") } };
  const passed = [
    { context: "CodeQL", state: "success" },
    { context: "Dottore Review", state: "success" },
  ];
  const failed = [{ context: "Dottore Review", state: "failure" }];
  // PR commits, oldest first: c reviewed, then d, then the head a.
  const commit = (c, parents = 1) => ({ sha: sha(c), parents: Array.from({ length: parents }, () => ({})) });

  /** Runs `bash` and returns the calls that write: status posts, dispatches and description edits. */
  function run(bash, { pulls = [other, pr()], statuses = {}, commits = [], body = "", env = {} } = {}) {
    const calls = join(temp, "calls.jsonl");
    writeFileSync(calls, "");
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", bash], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        GATE_CALLS: calls,
        GATE_PULLS: JSON.stringify(pulls),
        GATE_STATUSES: JSON.stringify(statuses),
        GATE_COMMITS: JSON.stringify(commits),
        GATE_BODY: JSON.stringify(body),
        GH_TOKEN: "test",
        REPO: repo,
        HEAD_SHA: head,
        CHECK_URL: `https://github.com/${repo}/runs/1`,
        REVIEW_BASES: "staging",
        PR_NUM: "9086",
        ...env,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((args) => args[1] === "--method" || args[0] === "workflow");
  }
  const check = (conclusion, title) => ({ env: { CONCLUSION: conclusion, TITLE: title } });
  const field = (call, name) => call.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const fits = (description) => assert.ok(description.length <= 140, `"${description}" fits 140 characters`);

  // A finished review passes the head.
  const done = check("success", "Finished");
  let writes = run(gate, done);
  assert.equal(writes.length, 1, "A finished CodeRabbit review posts one status");
  assert.ok(writes[0][3].endsWith(`/statuses/${head}`));
  assert.equal(field(writes[0], "state"), "success");
  assert.equal(field(writes[0], "context"), "Dottore Review");
  assert.equal(field(writes[0], "target_url"), `https://github.com/${repo}/runs/1`);
  fits(field(writes[0], "description"));
  assert.equal(run(gate, { ...done, statuses: { [head]: failed } }).length, 1, "It replaces a failed Dottore review");
  assert.equal(
    run(gate, { ...done, pulls: [other] }).length,
    0,
    "A SHA that is no open PR's current head is left alone",
  );
  assert.equal(
    run(gate, { ...done, pulls: [pr({ base: { ref: "main" } })] }).length,
    0,
    "A pull request into a base with no review gets no status",
  );

  // Rate limited: Dottore reviews from the last reviewed head.
  const limited = check("neutral", "Review rate limited");
  const history = [commit("c"), commit("d"), commit("a")];
  writes = run(gate, { ...limited, commits: history, statuses: { [sha("c")]: passed } });
  assert.equal(writes.length, 1, "A rate-limited head dispatches Dottore and posts nothing itself");
  assert.deepEqual(writes[0].slice(0, 7), [
    "workflow",
    "run",
    "dottore-review.yml",
    "--repo",
    repo,
    "--ref",
    "staging",
  ]);
  assert.equal(field(writes[0], "pr_number"), "9086");
  assert.equal(field(writes[0], "review_mode"), "auto");
  assert.equal(field(writes[0], "last_reviewed_sha"), sha("c"), "Dottore reviews only what came after the last review");
  writes = run(gate, { ...limited, commits: history });
  assert.equal(field(writes[0], "last_reviewed_sha"), "", "With no review yet, Dottore chooses where to start");
  assert.equal(run(gate, { ...limited, pulls: [pr({ draft: true })] }).length, 0, "A draft waits until it is ready");
  assert.equal(run(gate, { ...limited, statuses: { [head]: passed } }).length, 0, "A reviewed head needs no Dottore");
  assert.equal(run(gate, check("neutral", "Review failed")).length, 0, "Only the rate limit calls Dottore");

  // A skip with no reason keeps the last review when only merges came after it.
  const skipped = check("skipped", "Review skipped");
  writes = run(gate, {
    ...skipped,
    commits: [commit("c"), commit("d", 2), commit("a", 2)],
    statuses: { [sha("c")]: passed },
  });
  assert.equal(writes.length, 1, "A head that only merged branches in keeps the last review");
  assert.equal(field(writes[0], "target_url"), `https://github.com/${repo}/commit/${sha("c")}`);
  fits(field(writes[0], "description"));
  assert.equal(
    run(gate, { ...skipped, commits: [commit("c"), commit("d"), commit("a", 2)], statuses: { [sha("c")]: passed } })
      .length,
    0,
    "New commits CodeRabbit skipped are not passed",
  );
  assert.equal(
    run(gate, { ...skipped, commits: [commit("c"), commit("a", 2)] }).length,
    0,
    "With no earlier review there is nothing to keep",
  );
  assert.equal(
    run(gate, {
      ...skipped,
      commits: [commit("c"), commit("a", 2)],
      statuses: { [sha("c")]: passed },
      body: "Fixes it.\n\n@CodeRabbitAI ignore",
    }).length,
    0,
    "A pull request that tells CodeRabbit to ignore it gets no stand-in",
  );
  assert.equal(
    run(gate, {
      ...check("skipped", "Review skipped: draft pull request"),
      commits: [commit("c"), commit("a", 2)],
      statuses: { [sha("c")]: passed },
    }).length,
    0,
    "A skip with a reason is not carried",
  );

  // Pull requests into the default branch get @coderabbitai ignore.
  writes = run(ignore, { body: "Promote staging." });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].slice(0, 4), ["api", "--method", "PATCH", `repos/${repo}/pulls/9086`]);
  assert.equal(
    field(writes[0], "body"),
    "Promote staging.\n\n@coderabbitai ignore",
    "The keyword goes after the description",
  );
  assert.equal(
    field(run(ignore, { body: null })[0], "body"),
    "@coderabbitai ignore",
    "An empty description gets only the keyword",
  );
  assert.equal(
    run(ignore, { body: "Hotfix.\n@coderabbitai IGNORE" }).length,
    0,
    "A description with the keyword is kept",
  );
  console.log("CodeRabbit review gate regression passed (17 cases).");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
