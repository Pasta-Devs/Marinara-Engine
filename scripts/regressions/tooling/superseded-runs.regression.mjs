import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// GitHub runs workflow_run, check_run and check_suite workflows on the default branch, so their check runs land on
// main's head commit whatever pull request they serve. A concurrency group there cancels superseded runs, and each
// cancelled run shows as a failed check on main. Such a workflow ends a superseded run successfully instead.
// (The owner-approval evaluator's supersede check is covered by scripts/test-owner-approval.mjs.)
const workflows = new URL("../../../.github/workflows/", import.meta.url);
const read = (name) => readFileSync(new URL(name, workflows), "utf8").replace(/\r\n/gu, "\n");
const defaultBranchEvents = ["workflow_run", "check_run", "check_suite"];
const onDefaultBranch = [];
for (const name of readdirSync(workflows).filter((file) => /\.ya?ml$/u.test(file))) {
  const source = read(name);
  const on = /^on:(.*)\n((?:(?: .*)?\n)*)/mu.exec(source);
  assert.ok(on, `${name} must declare its triggers`);
  const events = on[1].trim()
    ? on[1]
        .replace(/[[\]]/gu, "")
        .split(",")
        .map((event) => event.trim())
    : [...on[2].matchAll(/^ {2}([a-z_]+):/gmu)].map((match) => match[1]);
  if (!events.some((event) => defaultBranchEvents.includes(event))) continue;
  onDefaultBranch.push(name);
  assert.doesNotMatch(source, /^\s*concurrency:/mu, `${name} runs on main, where a cancelled run is a failed check`);
}
for (const name of ["owner-approval-review.yml", "dottore-review-approve.yml", "coderabbit-review-gate.yml"]) {
  assert.ok(onDefaultBranch.includes(name), `${name} must be found as a workflow GitHub runs on the default branch`);
}

// The dispatch's step runs on Ubuntu; native Windows does not require its Bash and jq tools.
if (process.platform === "win32") {
  console.log(
    "Skipping the POSIX Dottore approval dispatch on Windows; exercise it on Ubuntu or macOS with Bash and jq.",
  );
  process.exit(0);
}

const repo = "Pasta-Devs/Marinara-Engine";
const source = read("dottore-review-approve.yml");
const lines = source.split("        run: |\n")[1]?.split("\n");
assert.ok(lines, "The dispatch's Bash step must exist");
const script = [];
for (const line of lines) {
  if (line.trim() && !line.startsWith("          ")) break;
  script.push(line.slice(10));
}
const bash = script.join("\n").replaceAll("${{ github.repository }}", repo);
assert.ok(!bash.includes("${{"), "All workflow expressions in the step must be resolved explicitly");
// The title GitHub gives a dispatch after a successful check run, from the workflow's own run-name.
const titlePrefix = /^run-name: .*format\('([^']*)\{0\}', github\.event\.workflow_run\.head_sha\)/mu.exec(source)?.[1];
assert.ok(titlePrefix, "A dispatch after a successful check names its head in its title");
const title = (sha) => `${titlePrefix}${sha}`;

const head = "a".repeat(40);
const other = "b".repeat(40);
const temp = mkdtempSync(join(tmpdir(), "marinara-dottore-approve-"));
try {
  // gh mock: serves this workflow's runs (a list per call, the last one repeating), the pull request and Dottore's
  // walkthrough through the step's own jq filters; records every call.
  writeFileSync(
    join(temp, "gh"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const cp = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DISPATCH_CALLS, JSON.stringify(args) + "\\n");
const jq = (input) => {
  const result = cp.spawnSync("jq", ["-r", args[args.indexOf("--jq") + 1]], { input: JSON.stringify(input), encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
};
if (args[0] === "api" && args[1] === "repos/${repo}/actions/workflows/dottore-review-approve.yml/runs?per_page=100") {
  if (process.env.DISPATCH_LIST_FAILS) process.exit(1);
  const listings = JSON.parse(process.env.DISPATCH_RUNS);
  const listing = fs.readFileSync(process.env.DISPATCH_CALLS, "utf8").split("dottore-review-approve.yml/runs").length - 2;
  jq({ workflow_runs: listings[Math.min(listing, listings.length - 1)] });
}
if (args[0] === "pr" && args[1] === "view")
  jq({ state: "OPEN", isDraft: false, headRefOid: process.env.HEAD_SHA, baseRefName: "staging" });
if (args[0] === "api" && args[1] === "repos/${repo}/issues/9086/comments?per_page=100")
  jq([{ user: { login: "github-actions[bot]" }, body: "<!-- dottore:walkthrough -->\\n<!-- dottore:last-reviewed-sha=" + process.env.HEAD_SHA + " -->\\n<!-- dottore:discharge -->\\nViable." }]);
if (args[0] === "workflow" && args[1] === "run") process.exit(0);
throw new Error("Unexpected gh call: " + JSON.stringify(args));
`,
    { mode: 0o755 },
  );

  /** Runs the step as dispatch run 500 for `head`; returns its gh calls and output. */
  function run({ runs = [[]], env = {} } = {}) {
    const calls = join(temp, "calls.jsonl");
    writeFileSync(calls, "");
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", bash], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        DISPATCH_CALLS: calls,
        DISPATCH_RUNS: JSON.stringify(runs),
        GITHUB_RUN_ID: "500",
        GH_TOKEN: "test",
        HEAD_SHA: head,
        PR_FROM_RUN: "9086",
        HEAD_OWNER: "Pasta-Devs",
        HEAD_BRANCH: "feature",
        WORKFLOW_NAME: "Pull Request Checks",
        DOTTORE_BASE_REFS: "staging,main",
        ...env,
      },
    });
    assert.equal(result.status, 0, `A superseded or finished dispatch ends successfully: ${result.stderr}`);
    const made = readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return {
      output: result.stdout,
      dispatches: made.filter((args) => args[0] === "workflow" && args[1] === "run"),
      readPullRequest: made.some((args) => args[0] === "pr" && args[1] === "view"),
    };
  }
  const cases = [];
  const expect = (name, fn) => {
    fn();
    cases.push(name);
  };

  expect("the newest dispatch for a discharged head asks for the approval", () => {
    const { dispatches } = run({
      runs: [
        [
          { id: 502, display_title: "Dottore Approval Dispatch" },
          { id: 501, display_title: title(other) },
          { id: 500, display_title: title(head) },
          { id: 499, display_title: title(head) },
        ],
      ],
    });
    assert.equal(dispatches.length, 1, JSON.stringify(dispatches));
    assert.ok(dispatches[0].includes("review_mode=approve"));
    assert.ok(dispatches[0].includes("pr_number=9086"));
  });
  expect("a newer dispatch for the same head ends this one before it reads the pull request", () => {
    const { dispatches, readPullRequest, output } = run({ runs: [[{ id: 501, display_title: title(head) }]] });
    assert.equal(dispatches.length, 0);
    assert.equal(readPullRequest, false);
    assert.match(output, /::notice::/u);
  });
  expect("a dispatch that a newer one overtakes while it reads the pull request does not dispatch too", () => {
    const { dispatches, readPullRequest } = run({ runs: [[], [{ id: 501, display_title: title(head) }]] });
    assert.equal(readPullRequest, true);
    assert.equal(dispatches.length, 0);
  });
  expect("a dispatch that cannot list the newer ones still asks for the approval", () => {
    assert.equal(run({ env: { DISPATCH_LIST_FAILS: "1" } }).dispatches.length, 1);
  });
  console.log(
    `Superseded runs regression passed (${onDefaultBranch.length} default-branch workflows, ${cases.length} cases).`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
