import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

// Pull requests into staging run only the smoke suite, so one that breaks a full-matrix spec merges green and the
// failure shows up only in the nightly run, where nobody is told about it. The nightly-report job in playwright.yml
// runs this after a full run's shards: it lists what fails, compares that with the previous full run on the same
// branch and names the pull requests merged in between. The nightly-issue job files the text in one issue on staging.

export const ISSUE_TITLE = "[Issue]: The nightly full browser matrix fails on staging";
// GitHub refuses an issue body or comment over 65,536 characters.
export const BODY_LIMIT = 60_000;
// A step summary holds 1 MiB, so the run's summary can list every failure the issue has to leave out.
const SUMMARY_LIMIT = 900_000;
export const RESULTS_ARTIFACT_PREFIX = "playwright-results-";
const SHARD_JOB = /^(desktop-chromium|mobile-chromium|mobile-webkit) (\d+)\/\d+$/u;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

const passed = (result) => result?.status === "expected" || result?.status === "flaky";
const failed = (result) => result?.status === "unexpected";
const testName = (result) => `${result.file} › ${result.title}`;
const countTests = (results) => new Set(results.map(testName)).size;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
// A code span keeps test titles and branch names from rendering as Markdown, mentions or issue links.
const code = (text) => `\`${String(text).replace(/[`\r\n]+/gu, "'")}\``;
const runLink = (run) => `[${run.id}](${run.url})`;
const shortSha = (sha) => code(sha.slice(0, 10));

/**
 * Only what the report reads from a Playwright JSON report. A shard's full report carries its screenshots as base64
 * (one mobile-chromium shard's was 3.4 MB), so each shard keeps this instead.
 */
export function slimReport(report) {
  const suite = (entry) => ({
    title: entry.title,
    specs: (entry.specs ?? []).map((spec) => ({
      title: spec.title,
      file: spec.file,
      tests: (spec.tests ?? []).map(({ projectName, status }) => ({ projectName, status })),
    })),
    suites: (entry.suites ?? []).map(suite),
  });
  return {
    config: { rootDir: report.config?.rootDir },
    errors: (report.errors ?? []).map((error) => ({ message: String(error.message ?? "").slice(0, 2000) })),
    stats: { unexpected: report.stats?.unexpected ?? 0 },
    suites: (report.suites ?? []).map(suite),
  };
}

/** Adds every test of one Playwright JSON report to results, keyed by project, spec file and title path. */
export function collectResults(report, results = new Map()) {
  const folder = basename(report.config?.rootDir ?? "e2e");
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      const file = `${folder}/${spec.file}`;
      const title = [...titles, spec.title].join(" › ");
      for (const test of spec.tests ?? []) {
        const key = `${test.projectName} › ${file} › ${title}`;
        results.set(key, { key, project: test.projectName, file, title, status: test.status });
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  };
  // A top-level suite is the spec file itself, so its title is not part of a test's title path.
  for (const suite of report.suites ?? []) visit(suite, []);
  return results;
}

/** The shard reports download-artifact put in one folder per artifact, keyed by "<project>-<shard>". */
export function readShardReports(dir) {
  const shards = new Map();
  if (!existsSync(dir)) return shards;
  for (const name of readdirSync(dir)) {
    const folder = join(dir, name);
    if (!name.startsWith(RESULTS_ARTIFACT_PREFIX) || !statSync(folder).isDirectory()) continue;
    const reports = readdirSync(folder)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(folder, file), "utf8")));
    shards.set(name.slice(RESULTS_ARTIFACT_PREFIX.length), reports);
  }
  return shards;
}

export function mergeResults(shards) {
  const results = new Map();
  for (const reports of shards.values()) for (const report of reports) collectResults(report, results);
  return results;
}

/** This run's failures against the previous full run's. Without a previous run nothing counts as new or fixed. */
export function compareRuns(current, previous) {
  const failing = [...current.values()].filter(failed);
  if (!previous) return { failing, broke: [], unseen: [], fixed: [] };
  return {
    failing,
    // Passed in the previous run and fails now.
    broke: failing.filter((result) => passed(previous.get(result.key))),
    // No result in the previous run: a new test, a skipped one, or one whose shard did not report.
    unseen: failing.filter((result) => {
      const before = previous.get(result.key);
      return !passed(before) && !failed(before);
    }),
    // Failed in the previous run and passes now. A test without a result in this run is not counted as fixed.
    fixed: [...previous.values()].filter((result) => failed(result) && passed(current.get(result.key))),
  };
}

/** The pull requests whose merge commits are in a compare range, read from the commit messages. */
export function mergedPullRequests(messages) {
  const pulls = new Map();
  for (const message of messages) {
    const merge = /^Merge pull request #(\d+) from (\S+)/u.exec(message);
    if (merge) pulls.set(Number(merge[1]), merge[2]);
  }
  return [...pulls].map(([number, branch]) => ({ number, branch }));
}

/** One Markdown line per failing test, with the projects it fails on. */
function testLines(results) {
  const tests = new Map();
  for (const result of results) tests.set(testName(result), [...(tests.get(testName(result)) ?? []), result.project]);
  return [...tests]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, projects]) => `- ${code(name)} (${[...new Set(projects)].sort().join(", ")})`);
}

/** Appends lines while the text stays under the limit, then says how many were left out. */
function withinLimit(head, lines, limit) {
  let text = head;
  for (const [index, line] of lines.entries()) {
    const more = `\n_…and ${lines.length - index} more. The run's summary lists them all._\n`;
    if (text.length + line.length + 1 + more.length > limit) return `${text}${more}`;
    text += `${line}\n`;
  }
  return text;
}

/**
 * The issue body, the comment for this run and the run summary.
 * shards: [{ name, conclusion, hasResults, failures, errors }] for every browser shard job of the run.
 */
export function renderReport({ run, previousRun, comparison, shards, pulls, compareUrl, limit = BODY_LIMIT }) {
  const { failing, broke, unseen, fixed } = comparison;
  const unfinished = shards.filter((shard) => shard.conclusion !== "success");
  const state = failing.length === 0 && unfinished.length === 0 ? "passing" : "failing";
  const date = run.date ? ` (${run.date})` : "";
  const where = `run ${runLink(run)} on ${shortSha(run.sha)}${date}`;

  if (state === "passing") {
    const comment = `The full browser matrix passed in ${where}, so this issue is closed.\n`;
    return { state, title: ISSUE_TITLE, body: "", comment, summary: `## Nightly full matrix\n\n${comment}` };
  }

  const perProject = new Map();
  for (const result of failing) perProject.set(result.project, (perProject.get(result.project) ?? 0) + 1);
  const counts = [...perProject]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([project, count]) => `${project} ${count}`)
    .join(", ");
  // A shard can fail with no failing test: setup broke, the time budget ran out, or the job died before the report.
  const shardLines = unfinished
    .filter((shard) => !shard.failures)
    .map((shard) => {
      const why = shard.hasResults
        ? (shard.errors[0] ?? `the job ended as ${shard.conclusion}`)
        : `no results: the job ended as ${shard.conclusion} before Playwright wrote its report`;
      return `- ${shard.name}: ${code(why)}`;
    });
  const head = [
    "Pull requests into `staging` run only the smoke suite, so a pull request can break a full-matrix spec and still merge. Each full run on `staging` rewrites this issue with what fails in it. A run that adds failures also comments them, with the pull requests merged since the run before. The issue closes when a full run passes.",
    "",
    `**Latest run:** ${where}: ${plural(countTests(failing), "test fails", "tests fail")}${counts ? ` (${counts})` : ""}.`,
    "",
    ...(shardLines.length > 0 ? ["**Shards that failed without a failing test:**", "", ...shardLines, ""] : []),
    ...(failing.length > 0 ? ["### Failing tests", "", ""] : []),
  ].join("\n");
  const failingLines = testLines(failing);
  const body = withinLimit(head, failingLines, limit);

  let comment = "";
  let fullComment = "";
  const started = [...broke, ...unseen];
  if (previousRun && started.length > 0) {
    const startedTests = countTests(started);
    const unseenTests = countTests(unseen);
    const before =
      broke.length === 0
        ? "has no result for them (new tests, or shards that did not report)"
        : unseenTests > 0
          ? `passed them, except ${unseenTests} it has no result for (a new test, or a shard that did not report)`
          : "passed them";
    const fixedNote =
      fixed.length > 0
        ? ` Since then, ${plural(countTests(fixed), "failing test passes", "failing tests pass")} again.`
        : "";
    const range =
      previousRun.sha === run.sha
        ? "No commits landed between the two runs, so these failures are flaky or come from the runner."
        : pulls.length > 0
          ? [
              `Pull requests merged between the two runs ([compare](${compareUrl})):`,
              "",
              ...pulls.map((pull) => `- #${pull.number} (${code(pull.branch)})`),
            ].join("\n")
          : `No pull request merged between the two runs ([compare](${compareUrl})).`;
    const commentHead = [
      `**${plural(startedTests, "test", "tests")} started failing** in ${where}. The previous full run, ${runLink(previousRun)} on ${shortSha(previousRun.sha)}, ${before}.${fixedNote}`,
      "",
      range,
      "",
      "Started failing:",
      "",
      "",
    ].join("\n");
    comment = withinLimit(commentHead, testLines(started), limit);
    fullComment = withinLimit(commentHead, testLines(started), SUMMARY_LIMIT);
  }

  const previousNote = previousRun
    ? ""
    : "\n_No earlier full run on this branch has results to compare with, so nothing is marked new._\n";
  const fullBody = withinLimit(head, failingLines, SUMMARY_LIMIT);
  const summary = `## Nightly full matrix\n\n${fullBody}${previousNote}${fullComment ? `\n---\n\n${fullComment}` : ""}`;
  return { state, title: ISSUE_TITLE, body, comment, summary };
}

function writeOutputs(file, outputs) {
  for (const [name, value] of Object.entries(outputs)) {
    const delimiter = `EOF_${randomUUID()}`;
    appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
  }
}

function main() {
  const { GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_SHA: sha, GITHUB_REF_NAME: branch } = process.env;
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  if (!repo || !runId || !sha || !branch)
    throw new Error("Run this in GitHub Actions: the GITHUB_* variables are missing.");
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const jsonLines = (text) =>
    text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  const currentShards = readShardReports(process.env.RESULTS_DIR ?? "playwright-results");
  const shards = [];
  for (const job of jsonLines(
    gh(
      "api",
      `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      "--paginate",
      "--jq",
      ".jobs[] | {name, conclusion} | @json",
    ),
  )) {
    const match = SHARD_JOB.exec(job.name);
    if (!match) continue;
    const reports = currentShards.get(`${match[1]}-${match[2]}`) ?? [];
    shards.push({
      name: job.name,
      conclusion: job.conclusion,
      hasResults: reports.length > 0,
      failures: reports.reduce((sum, report) => sum + (report.stats?.unexpected ?? 0), 0),
      errors: reports
        .flatMap((report) => report.errors ?? [])
        .map((error) =>
          String(error.message ?? "")
            .replace(ANSI, "")
            .split("\n")[0]
            .trim(),
        )
        .filter(Boolean),
    });
  }
  shards.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  // Without shard jobs a run would look green and close the issue.
  if (shards.length === 0) throw new Error(`Run ${runId} lists no browser shard jobs.`);

  // The newest finished full run on this branch before this one. A cancelled run is left out: its shards stopped early.
  const runs = JSON.parse(
    gh(
      "api",
      `repos/${repo}/actions/workflows/playwright.yml/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&status=completed&per_page=20`,
      "--jq",
      "[.workflow_runs[] | {id, head_sha, html_url, conclusion}]",
    ),
  );
  const before = runs.find((candidate) => candidate.id < Number(runId) && candidate.conclusion !== "cancelled");
  let previous = null;
  let previousRun = null;
  if (before) {
    const dir = mkdtempSync(join(tmpdir(), "nightly-previous-"));
    try {
      gh(
        "run",
        "download",
        String(before.id),
        "--repo",
        repo,
        "--pattern",
        `${RESULTS_ARTIFACT_PREFIX}*`,
        "--dir",
        dir,
      );
      previous = mergeResults(readShardReports(dir));
      previousRun = { id: before.id, url: before.html_url, sha: before.head_sha };
    } catch (error) {
      console.warn(`Run ${before.id} has no shard results to compare with: ${error.message ?? error}`);
    }
  }

  let pulls = [];
  let compareUrl = "";
  if (previousRun && previousRun.sha !== sha) {
    compareUrl = `${server}/${repo}/compare/${previousRun.sha}...${sha}`;
    const messages = jsonLines(
      gh(
        "api",
        `repos/${repo}/compare/${previousRun.sha}...${sha}`,
        "--paginate",
        "--jq",
        ".commits[].commit.message | @json",
      ),
    );
    pulls = mergedPullRequests(messages);
  }

  const report = renderReport({
    run: {
      id: runId,
      url: `${server}/${repo}/actions/runs/${runId}`,
      sha,
      date: new Date().toISOString().slice(0, 10),
    },
    previousRun,
    comparison: compareRuns(mergeResults(currentShards), previous),
    shards,
    pulls,
    compareUrl,
  });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.summary);
  if (process.env.GITHUB_OUTPUT) {
    const { state, title, body, comment } = report;
    writeOutputs(process.env.GITHUB_OUTPUT, { state, title, body, comment });
  }
  console.info(report.summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // `--slim <report.json>`: a shard shrinks its report in place before uploading it. A shard that never wrote one has
  // nothing to upload.
  if (process.argv[2] === "--slim") {
    const file = process.argv[3];
    if (file && existsSync(file))
      writeFileSync(file, JSON.stringify(slimReport(JSON.parse(readFileSync(file, "utf8")))));
  } else main();
}
