import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_RUNS,
  ISSUE_TITLE,
  NO_REPORT,
  collectResults,
  commentMark,
  compareRuns,
  mergeResults,
  mergedPullRequests,
  readShardReports,
  renderReport,
  slimReport,
} from "../../nightly-matrix-report.mjs";
import { extractJob, extractNamedStep } from "../../validate-pr-triage.mjs";
import { runNamedCases } from "../fixtures/named-cases.ts";

// The nightly full matrix is the only run of most browser specs, so its report must say what started failing since
// the last full runs and which pull requests merged since, and tell their authors, or the failures pile up unseen.

// A Playwright JSON report: top-level suites are spec files, nested suites are describe blocks.
const report = (project, tests) => ({
  config: { rootDir: "/home/runner/work/Marinara-Engine/Marinara-Engine/e2e" },
  suites: [
    {
      title: "chat.e2e.ts",
      file: "chat.e2e.ts",
      specs: [],
      suites: [
        {
          title: "Chat",
          file: "chat.e2e.ts",
          specs: Object.entries(tests).map(([title, status]) => ({
            title,
            file: "chat.e2e.ts",
            tests: [{ projectName: project, status }],
          })),
        },
      ],
    },
  ],
  errors: [],
  stats: {
    expected: Object.values(tests).filter((status) => status === "expected").length,
    unexpected: Object.values(tests).filter((status) => status === "unexpected").length,
  },
});
const results = (...reports) => mergeResults(new Map(reports.map((entry, index) => [String(index), [entry]])));

const run = { id: "200", url: "https://github.com/o/r/actions/runs/200", sha: "b".repeat(40), date: "2026-11-25" };
const earlierRun = (id, sha) => ({ id, url: `https://github.com/o/r/actions/runs/${id}`, sha: sha.repeat(40) });
// The earlier full runs, newest first.
const previousRuns = [earlierRun("100", "a"), earlierRun("90", "9"), earlierRun("80", "8")];
const shard = (name, conclusion, failures = 0, extra = {}) => ({
  name,
  conclusion,
  hasResults: true,
  passed: 1,
  failures,
  errors: [],
  ...extra,
});

// "flakes" passed in the newest earlier run but failed in the one before it, and "joined lately" has no result in the
// oldest one, so neither passed in each of the last three runs.
const previous = results(
  report("desktop-chromium", {
    "keeps failing": "unexpected",
    "breaks tonight": "expected",
    "is fixed": "unexpected",
    flakes: "expected",
    "joined lately": "expected",
  }),
  report("mobile-webkit", { "breaks tonight": "expected", "loses its shard": "unexpected" }),
);
const older = results(
  report("desktop-chromium", {
    "keeps failing": "unexpected",
    "breaks tonight": "expected",
    flakes: "unexpected",
    "joined lately": "expected",
  }),
  report("mobile-webkit", { "breaks tonight": "expected" }),
);
const oldest = results(
  report("desktop-chromium", { "keeps failing": "unexpected", "breaks tonight": "expected", flakes: "expected" }),
  report("mobile-webkit", { "breaks tonight": "expected" }),
);
const history = [previous, older, oldest];
const current = results(
  report("desktop-chromium", {
    "keeps failing": "unexpected",
    "breaks tonight": "unexpected",
    "is fixed": "expected",
    "is new": "unexpected",
    flakes: "unexpected",
    "joined lately": "unexpected",
  }),
  report("mobile-webkit", { "breaks tonight": "unexpected" }),
);

// The nightly-issue job's step, run with gh replaced by a stub that logs each call and the text piped to it on stderr.
const workflow = readFileSync(new URL("../../../.github/workflows/playwright.yml", import.meta.url), "utf8");
const issueStep = extractNamedStep(
  extractJob(workflow, "nightly-issue"),
  "File the report in the nightly matrix issue",
);
const issueScript = issueStep
  .split("        run: |\n")[1]
  .split("\n")
  .map((line) => line.replace(/^ {10}/u, ""))
  .join("\n");
// The step's --jq filters as Node functions, so the stub needs no jq. A filter the step changes has no twin here, and the
// test fails until one is added.
const jqTwins = {
  ".[] | select(.pull_request == null and .title == env.TITLE) | .number": (issues, env) =>
    issues.filter((issue) => issue.pull_request == null && issue.title === env.TITLE).map((issue) => issue.number),
  '.[] | select(.user.login == "github-actions[bot]" and (.body | contains(env.MARK))) | .id': (comments, env) =>
    comments
      .filter((comment) => comment.user.login === "github-actions[bot]" && comment.body.includes(env.MARK))
      .map((comment) => comment.id),
  ".workflow_runs[] | select(.id > (env.GITHUB_RUN_ID | tonumber)) | .id": (runs, env) =>
    runs.workflow_runs.filter((entry) => entry.id > Number(env.GITHUB_RUN_ID)).map((entry) => entry.id),
  '.jobs[] | select(.name == "nightly-issue" and .conclusion == "success") | .id': (jobs) =>
    jobs.jobs.filter((job) => job.name === "nightly-issue" && job.conclusion === "success").map((job) => job.id),
};
// Runs the twin of the filter in its argument over the JSON on stdin and prints one value a line, as gh --jq does.
const jqTwin = `const twins = { ${Object.entries(jqTwins)
  .map(([filter, twin]) => `${JSON.stringify(filter)}: ${twin}`)
  .join(", ")} };
const twin = twins[process.argv[1]];
if (!twin) throw new Error("No Node twin for the step's --jq filter " + process.argv[1]);
for (const value of twin(JSON.parse(require("node:fs").readFileSync(0, "utf8")), process.env)) console.log(value);`;
const bot = { login: "github-actions[bot]" };
// What the server answers: the open issues (before its creator filter), the issue's comments, the ids of the
// workflow's full runs on staging, newest first, and each run's jobs by run id.
const fileIssue = ({ issues = [], comments = [], runs = [], jobs = {}, ...env }) => {
  const result = spawnSync(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `jq_twin() { printf '%s' "$1" | "$NODE" -e "$JQ_TWIN" "$2"; }
      gh() {
        printf 'gh %s\\n' "$*" >&2
        case "$1 $2" in
          # The step's own --jq filter (its last argument) runs over what the server answers to its query.
          "api "*/comments*) jq_twin "$COMMENTS" "\${@: -1}" ;;
          "api "*/actions/workflows/playwright.yml/runs*)
            [[ "$2" == *"branch=staging&event=workflow_dispatch"* ]] || return 1
            jq_twin "$RUNS" "\${@: -1}" ;;
          "api "*/actions/runs/*/jobs*) [[ "$2" == *"filter=all"* ]] || return 1
            local id=\${2#*/actions/runs/}
            local jobs="JOBS_\${id%%/*}"
            jq_twin "\${!jobs:-$NO_JOBS}" "\${@: -1}" ;;
          "api "*) [[ "$2" == *"creator=github-actions%5Bbot%5D"* ]] || return 1
            jq_twin "$OPEN_ISSUES" "\${@: -1}" ;;
          "issue create") printf 'stdin %s\\n' "$(cat)" >&2; echo "https://github.com/o/r/issues/77" ;;
          *) if [[ "$*" == *"--body-file -"* ]]; then printf 'stdin %s\\n' "$(cat)" >&2; fi ;;
        esac
      }
      ${issueScript}`,
    ],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NODE: process.execPath,
        JQ_TWIN: jqTwin,
        GH_REPO: "o/r",
        GITHUB_RUN_ID: run.id,
        TITLE: ISSUE_TITLE,
        OPEN_ISSUES: JSON.stringify(issues.filter((issue) => issue.user.login === bot.login)),
        COMMENTS: JSON.stringify(comments),
        RUNS: JSON.stringify({ workflow_runs: runs.map((id) => ({ id })) }),
        NO_JOBS: JSON.stringify({ jobs: [] }),
        ...Object.fromEntries(Object.entries(jobs).map(([id, list]) => [`JOBS_${id}`, JSON.stringify({ jobs: list })])),
        ...env,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return `${result.stderr}${result.stdout}`;
};

await runNamedCases([
  {
    name: "only a test that passed in each of the last three full runs counts as started failing",
    run: () => {
      assert.equal(HISTORY_RUNS, 3);
      const names = (list) => list.map((result) => `${result.project} ${result.title}`).sort();
      const { failing, broke, unseen, intermittent, fixed } = compareRuns(current, history);
      assert.deepEqual(names(failing), [
        "desktop-chromium Chat › breaks tonight",
        "desktop-chromium Chat › flakes",
        "desktop-chromium Chat › is new",
        "desktop-chromium Chat › joined lately",
        "desktop-chromium Chat › keeps failing",
        "mobile-webkit Chat › breaks tonight",
      ]);
      assert.deepEqual(names(broke), ["desktop-chromium Chat › breaks tonight", "mobile-webkit Chat › breaks tonight"]);
      assert.deepEqual(names(unseen), ["desktop-chromium Chat › is new"]);
      // Failed in one of the three runs, or has no result in one: maybe flaky, so it names no pull request.
      assert.deepEqual(names(intermittent), [
        "desktop-chromium Chat › flakes",
        "desktop-chromium Chat › joined lately",
      ]);
      // "loses its shard" has no result tonight, so it is not counted as fixed.
      assert.deepEqual(names(fixed), ["desktop-chromium Chat › is fixed"]);
      assert.equal(failing[0].file, "e2e/chat.e2e.ts");

      // With fewer than three earlier runs, one pass is not enough: tonight's failures that passed before are
      // intermittent, and only a test with no earlier result is new.
      const short = compareRuns(current, [previous]);
      assert.deepEqual(short.broke, []);
      assert.deepEqual(names(short.unseen), ["desktop-chromium Chat › is new"]);
      assert.deepEqual(names(short.intermittent), [
        "desktop-chromium Chat › breaks tonight",
        "desktop-chromium Chat › flakes",
        "desktop-chromium Chat › joined lately",
        "mobile-webkit Chat › breaks tonight",
      ]);
      const rendered = renderReport({
        run,
        previousRuns: previousRuns.slice(0, 1),
        comparison: short,
        shards: [shard("desktop-chromium 1/16", "failure", 5)],
        pulls: [{ number: 9774, branch: "Pasta-Devs/fix/x", author: "SpicyMarinara" }],
        compareUrl: "https://github.com/o/r/compare/a...b",
      });
      assert.match(rendered.body, /^### Intermittent\n\n.*Only 1 earlier full run has results so far\.$/mu);
      assert.match(
        rendered.body,
        /^- `e2e\/chat\.e2e\.ts › Chat › breaks tonight` \(desktop-chromium, mobile-webkit\)$/mu,
      );
      assert.match(rendered.comment, /^\*\*1 test started failing\*\* in run \[200\]/mu);
      assert.doesNotMatch(rendered.comment, /breaks tonight|flakes/u);
    },
  },
  {
    name: "without a previous full run nothing is marked new and no comment is posted",
    run: () => {
      const comparison = compareRuns(current, []);
      assert.deepEqual(
        [comparison.broke, comparison.unseen, comparison.intermittent, comparison.fixed],
        [[], [], [], []],
      );
      const rendered = renderReport({
        run,
        previousRuns: [],
        comparison,
        shards: [shard("desktop-chromium 1/16", "failure", 3)],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(rendered.state, "failing");
      assert.equal(rendered.comment, "");
      assert.match(rendered.body, /5 tests fail \(desktop-chromium 5, mobile-webkit 1\)/u);
      assert.doesNotMatch(rendered.body, /### Intermittent/u);
      assert.match(rendered.summary, /No earlier full run on this branch/u);
    },
  },
  {
    name: "the comment names the new failures and mentions the authors of the pull requests merged since",
    run: () => {
      // Staging since the earlier run's commit "base": #9774 by a merge commit, #9801 squashed, #9787 by a merge commit.
      // The commits inside the merged pull requests are not merges, though one ends with an issue number.
      const commit = (sha, parents, message) => ({ sha, parents, message });
      const pulls = mergedPullRequests(
        [
          commit("inside1", ["base"], "fix(rp): keep history images (#9765)"),
          commit("m9774", ["base", "inside1"], "Merge pull request #9774 from Pasta-Devs/fix/9765-rp-history-images"),
          commit("s9801", ["m9774"], "fix(chat): restore history (#9801)\n\n* fix(chat): a squashed commit (#9800)"),
          commit("inside2", ["m9774"], "feat: rank display (#9786)"),
          commit("m9787", ["s9801", "inside2"], "Merge pull request #9787 from stonebystone/feat/rank\n\nfeat: rank"),
        ],
        "m9787",
      );
      assert.deepEqual(pulls, [
        { number: 9774, branch: "Pasta-Devs/fix/9765-rp-history-images" },
        { number: 9801, branch: "" },
        { number: 9787, branch: "stonebystone/feat/rank" },
      ]);
      const rendered = renderReport({
        run,
        previousRuns,
        comparison: compareRuns(current, history),
        shards: [shard("desktop-chromium 1/16", "failure", 5), shard("mobile-webkit 1/18", "failure", 1)],
        // The merge commit names the head repository's owner; the author comes from the pull request.
        pulls: [
          { ...pulls[0], author: "SpicyMarinara" },
          { ...pulls[1], author: "octocat" },
          { ...pulls[2], author: "stonebystone" },
          { number: 9790, branch: "Pasta-Devs/deps", author: "dependabot[bot]" },
        ],
        compareUrl: "https://github.com/o/r/compare/a...b",
      });
      assert.equal(rendered.title, ISSUE_TITLE);
      assert.match(rendered.title, /^\[Issue\]: /u);
      assert.match(
        rendered.comment,
        new RegExp(`^${commentMark("200")}\n\\*\\*2 tests started failing\\*\\* in run \\[200\\]`, "u"),
      );
      assert.match(
        rendered.comment,
        /They passed in each of the 3 earlier full runs \(\[100\]\(.*\) on `aaaaaaaaaa`, \[90\]\(.*\) on `9999999999`, \[80\]\(.*\) on `8888888888`\), except 1 with no result there/u,
      );
      assert.match(rendered.comment, /Since \[100\]\(.*\), 1 failing test passes again\./u);
      assert.match(
        rendered.comment,
        /^Pull requests merged since \[100\]\(.*\)\. If yours is listed, check whether it broke/mu,
      );
      assert.match(rendered.comment, /^- #9774 by @SpicyMarinara \(`Pasta-Devs\/fix\/9765-rp-history-images`\)$/mu);
      // A squash commit does not name the branch.
      assert.match(rendered.comment, /^- #9801 by @octocat$/mu);
      assert.match(rendered.comment, /^- #9787 by @stonebystone /mu);
      // A login that is not a plain user name is not mentioned.
      assert.match(rendered.comment, /^- #9790 \(`Pasta-Devs\/deps`\)$/mu);
      assert.match(
        rendered.comment,
        /^- `e2e\/chat\.e2e\.ts › Chat › breaks tonight` \(desktop-chromium, mobile-webkit\)$/mu,
      );
      assert.match(rendered.comment, /^- `e2e\/chat\.e2e\.ts › Chat › is new` \(desktop-chromium\)$/mu);
      assert.doesNotMatch(rendered.comment, /keeps failing|flakes|joined lately/u);
      // The body lists every failing test once, with all its projects, and the intermittent ones again on their own.
      assert.match(rendered.body, /^- `e2e\/chat\.e2e\.ts › Chat › keeps failing` \(desktop-chromium\)$/mu);
      assert.equal(rendered.body.match(/breaks tonight/gu).length, 1);
      const [intermittent, failing] = rendered.body.split("### Failing tests");
      assert.match(
        intermittent,
        /### Intermittent\n\nThese fail now and passed in an earlier full run, but not in each of the last 3, so they may be flaky\. No pull request is named for them\.\n\n- `e2e\/chat\.e2e\.ts › Chat › flakes` \(desktop-chromium\)\n- `e2e\/chat\.e2e\.ts › Chat › joined lately` \(desktop-chromium\)\n\n$/u,
      );
      assert.match(failing, /flakes/u);
    },
  },
  {
    name: "failures with no commit between the runs are called flaky",
    run: () => {
      const rendered = renderReport({
        run: { ...run, sha: previousRuns[0].sha },
        previousRuns,
        comparison: compareRuns(current, history),
        shards: [shard("desktop-chromium 1/16", "failure", 5)],
        pulls: [],
        compareUrl: "",
      });
      assert.match(rendered.comment, /No commits landed since \[100\]\(.*\), so these failures are flaky/u);
    },
  },
  {
    name: "the run passes only when every shard succeeded with no failing test",
    run: () => {
      const green = results(report("desktop-chromium", { "keeps failing": "expected" }));
      const comparison = compareRuns(green, history);
      const passing = renderReport({
        run,
        previousRuns,
        comparison,
        shards: [shard("desktop-chromium 1/16", "success")],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(passing.state, "passing");
      assert.match(passing.comment, /passed in run \[200\].*so this issue is closed/u);
      assert.ok(passing.comment.startsWith(commentMark("200")));

      // A shard that broke before or outside its tests keeps the issue open and is named.
      const broken = renderReport({
        run,
        previousRuns,
        comparison,
        shards: [
          shard("desktop-chromium 1/16", "success"),
          shard("mobile-webkit 7/18", "failure", 0, { errors: ["Timed out waiting 2400s for the test suite to run"] }),
          shard("mobile-chromium 3/14", "cancelled", 0, { hasResults: false }),
        ],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(broken.state, "failing");
      assert.match(broken.body, /^- mobile-webkit 7\/18: `Timed out waiting 2400s for the test suite to run`$/mu);
      assert.match(broken.body, /^- mobile-chromium 3\/14: `no results: the job ended as cancelled/mu);

      // A green shard without a report, or a run in which no test ran and passed, is not a pass either.
      const noReport = renderReport({
        run,
        previousRuns,
        comparison,
        shards: [
          shard("desktop-chromium 1/16", "success"),
          shard("mobile-webkit 2/18", "success", 0, { hasResults: false }),
        ],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(noReport.state, "failing");
      assert.match(
        noReport.body,
        /^- mobile-webkit 2\/18: `no results: the job ended as success without a Playwright report`$/mu,
      );
      const nothingRan = renderReport({
        run,
        previousRuns,
        comparison: compareRuns(results(report("desktop-chromium", { a: "skipped" })), history),
        shards: [shard("desktop-chromium 1/16", "success", 0, { passed: 0 })],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(nothingRan.state, "failing");
      assert.match(nothingRan.body, /No test ran and passed in this run, so it does not count as a pass\./u);
    },
  },
  {
    name: "titles cannot mention people or link issues, and a long list stays under GitHub's limit",
    run: () => {
      const many = Object.fromEntries(
        Array.from({ length: 600 }, (_, index) => [`case ${index} for @someone in #123 with \`code\``, "unexpected"]),
      );
      const rendered = renderReport({
        run,
        previousRuns: [],
        comparison: compareRuns(results(report("mobile-webkit", many)), []),
        shards: [shard("mobile-webkit 1/18", "failure", 600)],
        pulls: [],
        compareUrl: "",
        limit: 20_000,
      });
      // The limit counts UTF-8 bytes, so the "›" in every line cannot push it over.
      assert.ok(Buffer.byteLength(rendered.body) <= 20_000, `body is ${Buffer.byteLength(rendered.body)} bytes`);
      const listed = rendered.body.match(/^- `.*`.*$/gmu);
      assert.ok(listed.length > 50 && listed.length < 600);
      for (const line of listed) assert.match(line, /^- `[^`]*` \(mobile-webkit\)$/u);
      assert.match(
        rendered.body,
        new RegExp(`_…and ${600 - listed.length} more\\. The run's summary lists them all\\._`, "u"),
      );
      // The run's summary keeps every one of them.
      assert.equal(rendered.summary.match(/^- `.*`.*$/gmu).length, 600);

      // A long intermittent list takes at most half the body, so failing tests are still listed.
      const flaky = renderReport({
        run,
        previousRuns: previousRuns.slice(0, 1),
        comparison: compareRuns(results(report("mobile-webkit", many)), [
          results(report("mobile-webkit", Object.fromEntries(Object.keys(many).map((title) => [title, "expected"])))),
        ]),
        shards: [shard("mobile-webkit 1/18", "failure", 600)],
        pulls: [],
        compareUrl: "",
        limit: 20_000,
      });
      const [intermittentPart, failingPart] = flaky.body.split("### Failing tests");
      assert.ok(Buffer.byteLength(flaky.body) <= 20_000, `body is ${Buffer.byteLength(flaky.body)} bytes`);
      assert.ok(Buffer.byteLength(intermittentPart) <= 10_000);
      assert.ok(failingPart.match(/^- `.*`.*$/gmu).length > 20);
    },
  },
  {
    name: "the issue job opens one assigned issue, then rewrites it, comments new failures once and closes it on a pass",
    run: () => {
      if (process.platform === "win32") return console.log("Skipping the Bash issue step on Windows.");
      const opened = fileIssue({ STATE: "failing", BODY: "list", COMMENT: "new" });
      // The lookup only finds open issues this workflow's bot opened.
      assert.match(opened, /^gh api repos\/o\/r\/issues\?state=open&creator=github-actions%5Bbot%5D&per_page=100 /mu);
      assert.match(
        opened,
        /^gh issue create --title \[Issue\]: The nightly full browser matrix fails on staging --label bug --assignee SpicyMarinara --body-file -$/mu,
      );
      assert.match(opened, /^stdin list$/mu);
      assert.match(
        opened,
        /^gh api repos\/o\/r\/issues\/77\/comments\?per_page=100 .*\ngh issue comment 77 --body-file -\nstdin new$/mu,
      );

      // "Re-run failed jobs" runs the job again for the same run: its comment, found by its mark, is not posted twice.
      // A person's comment quoting the mark, or the mark of another run, does not count.
      const rendered = renderReport({
        run,
        previousRuns,
        comparison: compareRuns(current, history),
        shards: [shard("desktop-chromium 1/16", "failure", 5)],
        pulls: [],
        compareUrl: "",
      });
      const issues = [{ number: 12, title: ISSUE_TITLE, user: bot }];
      const comments = (...entries) => entries.map(([login, body]) => ({ id: 1, user: { login }, body }));
      const again = fileIssue({
        STATE: "failing",
        BODY: "list",
        COMMENT: rendered.comment,
        issues,
        comments: comments(["github-actions[bot]", rendered.comment]),
      });
      assert.match(again, /^gh issue edit 12 --body-file -$/mu);
      assert.doesNotMatch(again, /gh issue comment/u);
      for (const other of [
        comments(["SpicyMarinara", rendered.comment]),
        comments(["github-actions[bot]", rendered.comment.replace(commentMark("200"), commentMark("2000"))]),
      ]) {
        const posted = fileIssue({
          STATE: "failing",
          BODY: "list",
          COMMENT: rendered.comment,
          issues,
          comments: other,
        });
        assert.match(posted, /^gh issue comment 12 --body-file -$/mu);
      }

      // Only an issue the bot opened with this exact title counts, never a person's or a pull request; the first one
      // listed is used, and nothing is commented when nothing started failing.
      const openIssues = [
        { number: 5, title: ISSUE_TITLE, user: { login: "SpicyMarinara" } },
        { number: 9, title: ISSUE_TITLE, user: bot, pull_request: {} },
        { number: 11, title: `${ISSUE_TITLE} (old)`, user: bot },
        { number: 12, title: ISSUE_TITLE, user: bot },
        { number: 15, title: ISSUE_TITLE, user: bot },
      ];
      const updated = fileIssue({ STATE: "failing", BODY: "list", COMMENT: "", issues: openIssues });
      assert.match(updated, /^gh issue edit 12 --body-file -\nstdin list$/mu);
      assert.doesNotMatch(updated, /issue (?:create|comment)|issue \w+ (?:5|9|11|15) /u);

      const closed = fileIssue({ STATE: "passing", BODY: "", COMMENT: "passed", issues: openIssues });
      assert.match(closed, /^gh issue comment 12 --body-file -\nstdin passed\ngh issue close 12$/mu);
      assert.doesNotMatch(closed, /issue (?:create|edit)/u);

      // A pass with no open issue files nothing.
      assert.doesNotMatch(fileIssue({ STATE: "passing", BODY: "", COMMENT: "passed" }), /gh issue/u);
    },
  },
  {
    name: "a re-run of an older run files nothing once a newer full run has filed, and a retry of the newest run still files",
    run: () => {
      if (process.platform === "win32") return console.log("Skipping the Bash issue step on Windows.");
      const issues = [{ number: 12, title: ISSUE_TITLE, user: bot }];
      const issueJob = (conclusion) => [
        { id: 1, name: "nightly-report", conclusion: "success" },
        { id: 2, name: "nightly-issue", conclusion },
      ];
      // This run is 200. Run 300 came after it and filed its report, so this run's pass is out of date and must not
      // close the issue 300 opened, nor this run's failure open one.
      for (const [STATE, COMMENT] of [
        ["passing", "passed"],
        ["failing", "new"],
      ]) {
        const stale = fileIssue({
          STATE,
          BODY: "list",
          COMMENT,
          issues: STATE === "passing" ? issues : [],
          runs: [300, 200, 100],
          jobs: { 300: issueJob("success") },
        });
        assert.match(stale, /^gh api repos\/o\/r\/actions\/runs\/300\/jobs\?filter=all&per_page=100 /mu);
        assert.match(stale, /^Run 300 filed a newer report, so this run's report is not filed\.$/mu);
        assert.doesNotMatch(stale, /gh issue/u);
      }

      // A newer run that never filed (it failed before its report, or its issue job failed) does not count.
      const unfiled = fileIssue({
        STATE: "passing",
        BODY: "",
        COMMENT: "passed",
        issues,
        runs: [400, 300, 200],
        jobs: { 400: issueJob("skipped"), 300: issueJob("failure") },
      });
      assert.match(unfiled, /^gh issue close 12$/mu);

      // A retry of the newest run files again, even though its first attempt filed.
      const retry = fileIssue({
        STATE: "passing",
        BODY: "",
        COMMENT: "passed",
        issues,
        runs: [200, 100],
        jobs: { 200: issueJob("success"), 100: issueJob("success") },
      });
      assert.doesNotMatch(retry, /actions\/runs\/\d+\/jobs/u);
      assert.match(retry, /^gh issue close 12$/mu);
    },
  },
  {
    name: "a shard keeps every test's status and error but drops its screenshots",
    run: () => {
      const full = report("mobile-chromium", { a: "unexpected", b: "expected" });
      const spec = full.suites[0].suites[0].specs[0];
      spec.tests[0].results = [{ status: "failed", attachments: [{ name: "shot.png", body: "x".repeat(100_000) }] }];
      full.errors = [{ message: "Timed out waiting 2400s for the test suite to run", stack: "y".repeat(10_000) }];
      const slim = slimReport(full);
      assert.ok(JSON.stringify(slim).length < 2_000);
      assert.deepEqual([...collectResults(slim).values()], [...collectResults(full).values()]);
      assert.deepEqual(slim.errors, [{ message: "Timed out waiting 2400s for the test suite to run" }]);
      assert.deepEqual(slim.stats, { expected: 1, unexpected: 1 });

      // A shard whose Playwright wrote no report uploads a placeholder, so a re-run replaces its earlier results.
      const dir = mkdtempSync(join(tmpdir(), "nightly-slim-"));
      try {
        const file = join(dir, "playwright-results", "results.json");
        const script = new URL("../../nightly-matrix-report.mjs", import.meta.url);
        const slimmed = spawnSync(process.execPath, [fileURLToPath(script), "--slim", file], {
          encoding: "utf8",
        });
        assert.equal(slimmed.status, 0, slimmed.stderr);
        assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), NO_REPORT);
        // So does a report cut short while Playwright wrote it.
        writeFileSync(file, '{"suites": [');
        const cut = spawnSync(process.execPath, [fileURLToPath(script), "--slim", file], { encoding: "utf8" });
        assert.equal(cut.status, 0, cut.stderr);
        assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), NO_REPORT);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "shard reports are read from one folder per downloaded artifact",
    run: () => {
      const dir = mkdtempSync(join(tmpdir(), "nightly-report-"));
      try {
        for (const [name, entry] of [
          ["playwright-results-desktop-chromium-1", report("desktop-chromium", { a: "unexpected" })],
          ["playwright-results-mobile-webkit-12", report("mobile-webkit", { b: "expected" })],
          ["playwright-desktop-chromium-shard-1-failure", report("desktop-chromium", { c: "unexpected" })],
          ["playwright-results-mobile-chromium-3", NO_REPORT],
          ["playwright-results-mobile-webkit-4", null],
        ]) {
          mkdirSync(join(dir, name));
          // null stands for a report cut short while it was written.
          writeFileSync(join(dir, name, "results.json"), entry ? JSON.stringify(entry) : '{"suites": [');
        }
        const shards = readShardReports(dir);
        assert.deepEqual([...shards.keys()].sort(), [
          "desktop-chromium-1",
          "mobile-chromium-3",
          "mobile-webkit-12",
          "mobile-webkit-4",
        ]);
        // The placeholder and the cut-short report count as no report.
        assert.deepEqual(shards.get("mobile-chromium-3"), []);
        assert.deepEqual(shards.get("mobile-webkit-4"), []);
        assert.deepEqual([...mergeResults(shards).keys()].sort(), [
          "desktop-chromium › e2e/chat.e2e.ts › Chat › a",
          "mobile-webkit › e2e/chat.e2e.ts › Chat › b",
        ]);
        assert.equal(readShardReports(join(dir, "missing")).size, 0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
]);
