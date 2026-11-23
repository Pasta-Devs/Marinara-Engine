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
      github.event.pull_request.base.ref == github.event.repository.default_branch &&
      github.event.pull_request.user.login == 'SpicyMarinara' &&
      github.event.pull_request.head.repo.full_name == github.repository &&
      (github.event.pull_request.head.ref == 'staging' || startsWith(github.event.pull_request.head.ref, 'hotfix/'))
    runs-on:`),
  "Only the pull requests main accepts get the ignore line, so a contributor's PR retargeted to staging keeps its review",
);
assert.ok(
  source.includes(`    if: >
      github.event_name == 'pull_request_target' &&
      github.event.action == 'edited' &&
      github.event.changes.base.ref.from == github.event.repository.default_branch &&
      github.event.pull_request.base.ref != github.event.repository.default_branch
    runs-on:`),
  "Only a pull request moved off the default branch loses the line",
);
const dottoreWorkflow = readFileSync(new URL("../../../.github/workflows/dottore-review.yml", import.meta.url), "utf8");
assert.ok(
  dottoreWorkflow.includes(`run-name: "Dottore Review: PR #\${{ inputs.pr_number }} (\${{ inputs.review_mode }})"`),
  "Dottore's runs name their pull request, which the gate reads to see a review already running",
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
const retarget = step("Remove @coderabbitai ignore and ask Dottore");

const repo = "Pasta-Devs/Marinara-Engine";
const sha = (c) => c.repeat(40);
const head = sha("a");
const temp = mkdtempSync(join(tmpdir(), "marinara-coderabbit-gate-"));
try {
  // gh mock: serves the open PRs, each commit's combined status, the PR's commits and description and Dottore's
  // runs; records every call.
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
if (args[0] === "api" && args[1].startsWith(repo + "actions/workflows/dottore-review.yml/runs?"))
  jq({ workflow_runs: JSON.parse(process.env.GATE_RUNS) });
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
  // PR commits, oldest first: c passed its review, then d, then the head a.
  const history = [{ sha: sha("c") }, { sha: sha("d") }, { sha: head }];
  const running = (number) => ({ status: "in_progress", display_title: `Dottore Review: PR #${number} (auto)` });

  /** Runs `bash` and returns the calls that write: status posts, dispatches and description edits. */
  function run(bash, { pulls = [other, pr()], statuses = {}, commits = history, body = "", runs = [], env = {} } = {}) {
    const calls = join(temp, "calls.jsonl");
    writeFileSync(calls, "");
    // Each case starts a dozen Node processes for the gh mock, which takes seconds on a busy runner.
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", bash], {
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        GATE_CALLS: calls,
        GATE_PULLS: JSON.stringify(pulls),
        GATE_STATUSES: JSON.stringify(statuses),
        GATE_COMMITS: JSON.stringify(commits),
        GATE_BODY: JSON.stringify(body),
        GATE_RUNS: JSON.stringify(runs),
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
  const cases = [];
  const expect = (name, fn) => {
    fn();
    cases.push(name);
  };
  /** The single Dottore dispatch among `writes`, and nothing else. */
  const dispatched = (writes) => {
    assert.equal(writes.length, 1, JSON.stringify(writes));
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
    return writes[0];
  };

  // A finished review passes the head.
  const done = check("success", "Finished");
  expect("a finished CodeRabbit review posts one status", () => {
    const writes = run(gate, done);
    assert.equal(writes.length, 1);
    assert.ok(writes[0][3].endsWith(`/statuses/${head}`));
    assert.equal(field(writes[0], "state"), "success");
    assert.equal(field(writes[0], "context"), "Dottore Review");
    assert.equal(field(writes[0], "target_url"), `https://github.com/${repo}/runs/1`);
    fits(field(writes[0], "description"));
  });
  expect("it replaces a failed Dottore review", () =>
    assert.equal(run(gate, { ...done, statuses: { [head]: failed } }).length, 1),
  );
  expect("a SHA that is no open PR's current head is left alone", () =>
    assert.equal(run(gate, { ...done, pulls: [other] }).length, 0),
  );
  expect("a pull request into a base with no review gets no status", () =>
    assert.equal(run(gate, { ...done, pulls: [pr({ base: { ref: "main" } })] }).length, 0),
  );
  expect("a newer pull request into main with the same head does not hide the staging one", () => {
    const promotion = pr({ number: 9500, base: { ref: "main" } });
    assert.equal(run(gate, { ...done, pulls: [promotion, other, pr()] }).length, 1);
  });

  // Rate limited: Dottore reviews from the last passed head, once.
  const limited = check("neutral", "Review rate limited");
  expect("a rate-limited head dispatches Dottore from the last passed head", () => {
    const writes = run(gate, { ...limited, statuses: { [sha("c")]: passed } });
    assert.equal(field(dispatched(writes), "last_reviewed_sha"), sha("c"));
  });
  expect("with no passed head yet Dottore chooses where to start", () =>
    assert.equal(field(dispatched(run(gate, limited)), "last_reviewed_sha"), ""),
  );
  expect("a commit list that does not end at the head gives no starting point", () => {
    // GitHub lists at most 250 commits: here the head and the newest commits are missing, and c passed long ago.
    const truncated = [{ sha: sha("c") }, { sha: sha("d") }];
    const writes = run(gate, { ...limited, commits: truncated, statuses: { [sha("c")]: passed } });
    assert.equal(field(dispatched(writes), "last_reviewed_sha"), "");
  });
  expect("a draft waits until it is ready", () =>
    assert.equal(run(gate, { ...limited, pulls: [pr({ draft: true })] }).length, 0),
  );
  expect("a head that already passed needs no Dottore", () =>
    assert.equal(run(gate, { ...limited, statuses: { [head]: passed } }).length, 0),
  );
  expect("a pull request that tells CodeRabbit to ignore it gets no stand-in", () =>
    assert.equal(run(gate, { ...limited, body: "Promote.\n\n@CodeRabbitAI ignore" }).length, 0),
  );
  expect("a second rate-limited run does not restart the review a first one started", () =>
    assert.equal(run(gate, { ...limited, runs: [running(9086)] }).length, 0),
  );
  expect("a review running for another pull request does not count", () =>
    dispatched(
      run(gate, {
        ...limited,
        runs: [running(90861), { status: "completed", display_title: "Dottore Review: PR #9086 (auto)" }],
      }),
    ),
  );
  expect("after Dottore's review of the head failed, a new request starts another", () =>
    dispatched(run(gate, { ...limited, runs: [running(9086)], statuses: { [head]: failed } })),
  );
  expect("only the rate limit and skips call Dottore", () =>
    assert.equal(run(gate, check("neutral", "Review failed")).length, 0),
  );

  // Skipped: Dottore checks the head from the last passed one, so a hand-made merge is still reviewed.
  expect("a bare skip dispatches Dottore from the last passed head", () => {
    const writes = run(gate, { ...check("skipped", "Review skipped"), statuses: { [sha("c")]: passed } });
    assert.equal(field(dispatched(writes), "last_reviewed_sha"), sha("c"));
  });
  expect("a branch still carrying the old config that turned automatic reviews off gets Dottore", () =>
    dispatched(run(gate, check("skipped", "Review skipped: automatic reviews are disabled"))),
  );
  expect("a skipped draft waits", () =>
    assert.equal(
      run(gate, { ...check("skipped", "Review skipped: draft pull request"), pulls: [pr({ draft: true })] }).length,
      0,
    ),
  );
  expect("a skip on a pull request that tells CodeRabbit to ignore it gets nothing", () =>
    assert.equal(
      run(gate, { ...check("skipped", "Review skipped"), body: "Fixes it.\n\n@coderabbitai ignore" }).length,
      0,
    ),
  );

  // Promotions and hotfixes into the default branch get @coderabbitai ignore, marked as the gate's own line.
  const mark = "<!-- coderabbit-review-gate: keeps CodeRabbit off pull requests into main -->";
  const added = `@coderabbitai ignore\n${mark}`;
  expect("the keyword goes after the description", () => {
    const writes = run(ignore, { body: "Promote staging." });
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].slice(0, 4), ["api", "--method", "PATCH", `repos/${repo}/pulls/9086`]);
    assert.equal(field(writes[0], "body"), `Promote staging.\n\n${added}`);
  });
  expect("an empty description gets only the keyword", () =>
    assert.equal(field(run(ignore, { body: null })[0], "body"), added),
  );
  expect("a description with the keyword is kept", () =>
    assert.equal(run(ignore, { body: "Hotfix.\n@coderabbitai IGNORE" }).length, 0),
  );

  // A promotion or hotfix moved to staging gets its review back.
  const moved = { BASE: "staging", DRAFT: "false" };
  const lostLine = (body, expected, options = {}) => {
    const writes = run(retarget, { body, env: moved, ...options });
    assert.deepEqual(writes[0].slice(0, 4), ["api", "--method", "PATCH", `repos/${repo}/pulls/9086`]);
    assert.equal(field(writes[0], "body"), expected);
    return writes.slice(1);
  };
  expect("a retargeted pull request loses the line and gets a full Dottore review", () => {
    const rest = lostLine(`Hotfix.\n\n${added}`, "Hotfix.");
    assert.equal(rest.length, 1, JSON.stringify(rest));
    assert.deepEqual(rest[0].slice(0, 7), [
      "workflow",
      "run",
      "dottore-review.yml",
      "--repo",
      repo,
      "--ref",
      "staging",
    ]);
    assert.equal(field(rest[0], "pr_number"), "9086");
    assert.equal(field(rest[0], "review_mode"), "full");
  });
  expect("the line is found after later edits added text below it", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}\n\nNotes added later.`, "Hotfix.\n\nNotes added later.").length, 1),
  );
  expect("a description re-saved in the web editor, with CRLF line breaks, loses the line too", () =>
    assert.equal(lostLine(`Hotfix.\r\nNotes.\r\n\r\n${added.replace("\n", "\r\n")}`, "Hotfix.\r\nNotes.").length, 1),
  );
  expect("a CRLF description that ends in a line break after the line loses it too", () =>
    assert.equal(lostLine(`Hotfix.\r\n\r\n${added.replace("\n", "\r\n")}\r\n`, "Hotfix.\r").length, 1),
  );
  expect("a description that was only the line is emptied", () => assert.equal(lostLine(added, "").length, 1));
  expect("a keyword the author wrote stays, with nothing edited", () =>
    assert.equal(run(retarget, { body: "Skip review: @coderabbitai ignore\n\nNotes.", env: moved }).length, 0),
  );
  expect("a draft loses the line but waits for its review", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}`, "Hotfix.", { env: { ...moved, DRAFT: "true" } }).length, 0),
  );
  expect("a base with no review loses the line and gets no Dottore", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}`, "Hotfix.", { env: { ...moved, BASE: "release" } }).length, 0),
  );
  expect("moved back and forth, a head that already passed is not reviewed again", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}`, "Hotfix.", { statuses: { [head]: passed } }).length, 0),
  );
  expect("a review already running for it is not restarted", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}`, "Hotfix.", { runs: [running(9086)] }).length, 0),
  );
  expect("a head whose review failed gets a new one", () =>
    assert.equal(lostLine(`Hotfix.\n\n${added}`, "Hotfix.", { statuses: { [head]: failed } }).length, 1),
  );
  console.log(`CodeRabbit review gate regression passed (${cases.length} cases).`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
