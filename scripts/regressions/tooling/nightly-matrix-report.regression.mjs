import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ISSUE_TITLE,
  NO_REPORT,
  collectResults,
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
// the previous full run and which pull requests merged in between, or the failures pile up unseen.

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
const previousRun = { id: "100", url: "https://github.com/o/r/actions/runs/100", sha: "a".repeat(40) };
const shard = (name, conclusion, failures = 0, extra = {}) => ({
  name,
  conclusion,
  hasResults: true,
  passed: 1,
  failures,
  errors: [],
  ...extra,
});

const previous = results(
  report("desktop-chromium", { "keeps failing": "unexpected", "breaks tonight": "expected", "is fixed": "unexpected" }),
  report("mobile-webkit", { "breaks tonight": "expected", "loses its shard": "unexpected" }),
);
const current = results(
  report("desktop-chromium", {
    "keeps failing": "unexpected",
    "breaks tonight": "unexpected",
    "is fixed": "expected",
    "is new": "unexpected",
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
const fileIssue = (env) => {
  const result = spawnSync(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      `gh() {
        printf 'gh %s\\n' "$*" >&2
        case "$1 $2" in
          # The server's creator filter, then the step's own --jq filter (its last argument) over the open issues.
          "api "*) [[ "$2" == *"creator=github-actions%5Bbot%5D"* ]] || return 1
            jq -c '[.[] | select(.user.login == "github-actions[bot]")]' <<<"$OPEN_ISSUES" | jq -r "\${@: -1}" ;;
          "issue create") printf 'stdin %s\\n' "$(cat)" >&2; echo "https://github.com/o/r/issues/77" ;;
          *) if [[ "$*" == *"--body-file -"* ]]; then printf 'stdin %s\\n' "$(cat)" >&2; fi ;;
        esac
      }
      ${issueScript}`,
    ],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH, GH_REPO: "o/r", TITLE: ISSUE_TITLE, OPEN_ISSUES: "[]", ...env },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stderr;
};

await runNamedCases([
  {
    name: "a test that passed in the previous full run and fails now is new; one that kept failing is not",
    run: () => {
      const { failing, broke, unseen, fixed } = compareRuns(current, previous);
      const names = (list) => list.map((result) => `${result.project} ${result.title}`).sort();
      assert.deepEqual(names(failing), [
        "desktop-chromium Chat › breaks tonight",
        "desktop-chromium Chat › is new",
        "desktop-chromium Chat › keeps failing",
        "mobile-webkit Chat › breaks tonight",
      ]);
      assert.deepEqual(names(broke), ["desktop-chromium Chat › breaks tonight", "mobile-webkit Chat › breaks tonight"]);
      assert.deepEqual(names(unseen), ["desktop-chromium Chat › is new"]);
      // "loses its shard" has no result tonight, so it is not counted as fixed.
      assert.deepEqual(names(fixed), ["desktop-chromium Chat › is fixed"]);
      assert.equal(failing[0].file, "e2e/chat.e2e.ts");
    },
  },
  {
    name: "without a previous full run nothing is marked new and no comment is posted",
    run: () => {
      const comparison = compareRuns(current, null);
      assert.deepEqual([comparison.broke, comparison.unseen, comparison.fixed], [[], [], []]);
      const rendered = renderReport({
        run,
        previousRun: null,
        comparison,
        shards: [shard("desktop-chromium 1/16", "failure", 3)],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(rendered.state, "failing");
      assert.equal(rendered.comment, "");
      assert.match(rendered.body, /3 tests fail \(desktop-chromium 3, mobile-webkit 1\)/u);
      assert.match(rendered.summary, /No earlier full run on this branch/u);
    },
  },
  {
    name: "the comment names the new failures and the pull requests merged between the two runs",
    run: () => {
      const pulls = mergedPullRequests([
        "Merge pull request #9774 from Pasta-Devs/fix/9765-rp-history-images\n\nfix(rp): keep history images",
        "fix(rp): a commit inside that pull request",
        "Merge pull request #9787 from stonebystone/feat/ruleset-rank-display\n\nfeat: rank display",
        "Merge pull request #9774 from Pasta-Devs/fix/9765-rp-history-images",
      ]);
      assert.deepEqual(pulls, [
        { number: 9774, branch: "Pasta-Devs/fix/9765-rp-history-images" },
        { number: 9787, branch: "stonebystone/feat/ruleset-rank-display" },
      ]);
      const rendered = renderReport({
        run,
        previousRun,
        comparison: compareRuns(current, previous),
        shards: [shard("desktop-chromium 1/16", "failure", 3), shard("mobile-webkit 1/18", "failure", 1)],
        pulls,
        compareUrl: "https://github.com/o/r/compare/a...b",
      });
      assert.equal(rendered.title, ISSUE_TITLE);
      assert.match(rendered.title, /^\[Issue\]: /u);
      assert.match(rendered.comment, /^\*\*2 tests started failing\*\* in run \[200\]/u);
      assert.match(rendered.comment, /passed them, except 1 it has no result for/u);
      assert.match(rendered.comment, /Since then, 1 failing test passes again\./u);
      assert.match(rendered.comment, /^- #9774 \(`Pasta-Devs\/fix\/9765-rp-history-images`\)$/mu);
      assert.match(rendered.comment, /^- #9787 /mu);
      assert.match(
        rendered.comment,
        /^- `e2e\/chat\.e2e\.ts › Chat › breaks tonight` \(desktop-chromium, mobile-webkit\)$/mu,
      );
      assert.match(rendered.comment, /^- `e2e\/chat\.e2e\.ts › Chat › is new` \(desktop-chromium\)$/mu);
      assert.doesNotMatch(rendered.comment, /keeps failing/u);
      // The body lists every failing test once, with all its projects.
      assert.match(rendered.body, /^- `e2e\/chat\.e2e\.ts › Chat › keeps failing` \(desktop-chromium\)$/mu);
      assert.equal(rendered.body.match(/breaks tonight/gu).length, 1);
    },
  },
  {
    name: "failures with no commit between the runs are called flaky",
    run: () => {
      const rendered = renderReport({
        run: { ...run, sha: previousRun.sha },
        previousRun,
        comparison: compareRuns(current, previous),
        shards: [shard("desktop-chromium 1/16", "failure", 3)],
        pulls: [],
        compareUrl: "",
      });
      assert.match(rendered.comment, /No commits landed between the two runs, so these failures are flaky/u);
    },
  },
  {
    name: "the run passes only when every shard succeeded with no failing test",
    run: () => {
      const green = results(report("desktop-chromium", { "keeps failing": "expected" }));
      const comparison = compareRuns(green, previous);
      const passing = renderReport({
        run,
        previousRun,
        comparison,
        shards: [shard("desktop-chromium 1/16", "success")],
        pulls: [],
        compareUrl: "",
      });
      assert.equal(passing.state, "passing");
      assert.match(passing.comment, /passed in run \[200\].*so this issue is closed/u);

      // A shard that broke before or outside its tests keeps the issue open and is named.
      const broken = renderReport({
        run,
        previousRun,
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
        previousRun,
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
        previousRun,
        comparison: compareRuns(results(report("desktop-chromium", { a: "skipped" })), previous),
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
        previousRun: null,
        comparison: compareRuns(results(report("mobile-webkit", many)), null),
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
    },
  },
  {
    name: "the issue job opens one issue, then rewrites it, comments new failures and closes it on a pass",
    run: () => {
      if (process.platform === "win32") return console.log("Skipping the Bash issue step on Windows.");
      const opened = fileIssue({ STATE: "failing", BODY: "list", COMMENT: "new" });
      // The lookup only finds open issues this workflow's bot opened.
      assert.match(opened, /^gh api repos\/o\/r\/issues\?state=open&creator=github-actions%5Bbot%5D&per_page=100 /mu);
      assert.match(
        opened,
        /^gh issue create --title \[Issue\]: The nightly full browser matrix fails on staging --label bug --body-file -$/mu,
      );
      assert.match(opened, /^stdin list$/mu);
      assert.match(opened, /^gh issue comment 77 --body-file -\nstdin new$/mu);

      // Only an issue the bot opened with this exact title counts, never a person's or a pull request; the first one
      // listed is used, and nothing is commented when nothing started failing.
      const bot = { login: "github-actions[bot]" };
      const openIssues = JSON.stringify([
        { number: 5, title: ISSUE_TITLE, user: { login: "SpicyMarinara" } },
        { number: 9, title: ISSUE_TITLE, user: bot, pull_request: {} },
        { number: 11, title: `${ISSUE_TITLE} (old)`, user: bot },
        { number: 12, title: ISSUE_TITLE, user: bot },
        { number: 15, title: ISSUE_TITLE, user: bot },
      ]);
      const updated = fileIssue({ STATE: "failing", BODY: "list", COMMENT: "", OPEN_ISSUES: openIssues });
      assert.match(updated, /^gh issue edit 12 --body-file -\nstdin list$/mu);
      assert.doesNotMatch(updated, /issue (?:create|comment)|issue \w+ (?:5|9|11|15) /u);

      const closed = fileIssue({ STATE: "passing", BODY: "", COMMENT: "passed", OPEN_ISSUES: openIssues });
      assert.match(closed, /^gh issue comment 12 --body-file -\nstdin passed\ngh issue close 12$/mu);
      assert.doesNotMatch(closed, /issue (?:create|edit)/u);

      // A pass with no open issue files nothing.
      assert.doesNotMatch(fileIssue({ STATE: "passing", BODY: "", COMMENT: "passed" }), /gh issue/u);
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
        ]) {
          mkdirSync(join(dir, name));
          writeFileSync(join(dir, name, "results.json"), JSON.stringify(entry));
        }
        const shards = readShardReports(dir);
        assert.deepEqual([...shards.keys()].sort(), ["desktop-chromium-1", "mobile-chromium-3", "mobile-webkit-12"]);
        // The placeholder counts as no report.
        assert.deepEqual(shards.get("mobile-chromium-3"), []);
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
