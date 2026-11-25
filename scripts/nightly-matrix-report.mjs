import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Pull requests into staging run only the smoke suite, so one that breaks a full-matrix spec merges green and the
// failure shows up only in the nightly run, where nobody is told about it. The nightly-report job in playwright.yml
// runs this after a full run's shards: it lists what fails, compares that with the last full runs on the same branch
// and names the pull requests merged since, mentioning their authors. The nightly-issue job files the text in one
// issue on staging.

export const ISSUE_TITLE = "[Issue]: The nightly full browser matrix fails on staging";
// GitHub refuses an issue body or comment over 65,536 characters. Limits count UTF-8 bytes, which is never fewer.
export const BODY_LIMIT = 60_000;
// A step summary holds 1 MiB. The body and the comment get this much each, so the run's summary can list every
// failure the issue has to leave out.
const SUMMARY_LIMIT = 450_000;
// What a shard uploads when Playwright wrote no report, so a re-run replaces the results of the attempt before it.
export const NO_REPORT = { noReport: true };
// A report cut short (the runner died while Playwright wrote it) counts as no report, so one shard cannot stop the rest.
const readReport = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return NO_REPORT;
  }
};
export const RESULTS_ARTIFACT_PREFIX = "playwright-results-";
// A test counts as started failing only when it passed in each of this many earlier full runs. Flaky tests pass most
// nights, so one earlier pass would blame them on every day's merges.
export const HISTORY_RUNS = 3;
// Each run's comment carries this, so a re-run of the same run does not comment again.
export const commentMark = (runId) => `<!-- nightly-matrix-run ${runId} -->`;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u;
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
    stats: { expected: report.stats?.expected ?? 0, unexpected: report.stats?.unexpected ?? 0 },
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
      .map((file) => readReport(join(folder, file)))
      .filter((report) => !report.noReport);
    shards.set(name.slice(RESULTS_ARTIFACT_PREFIX.length), reports);
  }
  return shards;
}

export function mergeResults(shards) {
  const results = new Map();
  for (const reports of shards.values()) for (const report of reports) collectResults(report, results);
  return results;
}

/**
 * This run's failures against the earlier full runs' results, newest first. Without an earlier run nothing counts as
 * new or fixed.
 */
export function compareRuns(current, history) {
  const failing = [...current.values()].filter(failed);
  const window = history.slice(0, HISTORY_RUNS);
  const broke = [];
  const unseen = [];
  const intermittent = [];
  if (window.length === 0) return { failing, broke, unseen, intermittent, fixed: [] };
  for (const result of failing) {
    const earlier = window.map((results) => results.get(result.key));
    // Passed in each of the last HISTORY_RUNS full runs and fails now.
    if (window.length === HISTORY_RUNS && earlier.every(passed)) broke.push(result);
    // Passed in some of them but not in each: flaky, or too few results to tell. No pull request is named for these.
    else if (earlier.some(passed)) intermittent.push(result);
    // No result in any of them: a new test, a skipped one, or one whose shard did not report.
    else if (!earlier.some(failed)) unseen.push(result);
  }
  // Failed in the newest earlier run and passes now. A test without a result in this run is not counted as fixed.
  const fixed = [...window[0].values()].filter((result) => failed(result) && passed(current.get(result.key)));
  return { failing, broke, unseen, intermittent, fixed };
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

/** A pull request's line in a comment, mentioning its author so they hear of it. */
function pullLine(pull) {
  const author = LOGIN.test(pull.author ?? "") ? ` by @${pull.author}` : "";
  return `- #${pull.number}${author} (${code(pull.branch)})`;
}

/** Appends lines while the text stays under the limit in UTF-8 bytes, then says how many were left out. */
function withinLimit(head, lines, limit) {
  let text = head;
  let size = Buffer.byteLength(head);
  for (const [index, line] of lines.entries()) {
    const more = `\n_…and ${lines.length - index} more. The run's summary lists them all._\n`;
    const lineSize = Buffer.byteLength(line) + 1;
    if (size + lineSize + Buffer.byteLength(more) > limit) return `${text}${more}`;
    text += `${line}\n`;
    size += lineSize;
  }
  return text;
}

/** A heading, an intro and as many lines as fit under the limit, after text, then a blank line. */
function section(text, heading, intro, lines, limit) {
  return lines.length === 0 ? text : `${withinLimit(`${text}### ${heading}\n\n${intro}`, lines, limit - 1)}\n`;
}

/**
 * The issue body, the comment for this run and the run summary.
 * previousRuns: [{ id, url, sha }] for the earlier full runs compared, newest first.
 * shards: [{ name, conclusion, hasResults, passed, failures, errors }] for every browser shard job of the run.
 * pulls: [{ number, branch, author }] merged since the newest earlier run.
 */
export function renderReport({ run, previousRuns, comparison, shards, pulls, compareUrl, limit = BODY_LIMIT }) {
  const { failing, broke, unseen, intermittent, fixed } = comparison;
  const unfinished = shards.filter((shard) => shard.conclusion !== "success" || !shard.hasResults);
  // A pass closes the issue, so it needs every shard's report and at least one test that ran and passed.
  const ranTests = shards.some((shard) => shard.passed > 0);
  const state = failing.length === 0 && unfinished.length === 0 && ranTests ? "passing" : "failing";
  const date = run.date ? ` (${run.date})` : "";
  const where = `run ${runLink(run)} on ${shortSha(run.sha)}${date}`;
  const mark = commentMark(run.id);

  if (state === "passing") {
    const comment = `${mark}\nThe full browser matrix passed in ${where}, so this issue is closed.\n`;
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
        : `no results: the job ended as ${shard.conclusion} without a Playwright report`;
      return `- ${shard.name}: ${code(why)}`;
    });
  const head = [
    `Pull requests into \`staging\` run only the smoke suite, so a pull request can break a full-matrix spec and still merge. Each full run on \`staging\` rewrites this issue with what fails in it. When a test that passed in each of the last ${HISTORY_RUNS} full runs fails, or a new test fails, the run comments it and mentions the authors of the pull requests merged since. The issue closes when a full run passes.`,
    "",
    `**Latest run:** ${where}: ${plural(countTests(failing), "test fails", "tests fail")}${counts ? ` (${counts})` : ""}.`,
    "",
    ...(shardLines.length > 0 ? ["**Shards that failed without a failing test:**", "", ...shardLines, ""] : []),
    ...(ranTests ? [] : ["No test ran and passed in this run, so it does not count as a pass.", ""]),
    "",
  ].join("\n");
  const tooFew =
    previousRuns.length < HISTORY_RUNS
      ? ` Only ${plural(previousRuns.length, "earlier full run has", "earlier full runs have")} results so far.`
      : "";
  const intermittentIntro = `These fail now and passed in an earlier full run, but not in each of the last ${HISTORY_RUNS}, so they may be flaky. No pull request is named for them.${tooFew}\n\n`;
  // The intermittent list gets half the limit, so the failing list always fits some lines.
  const sections = (sectionLimit) =>
    section(
      section(head, "Intermittent", intermittentIntro, testLines(intermittent), sectionLimit / 2),
      "Failing tests",
      "",
      testLines(failing),
      sectionLimit,
    );
  const body = sections(limit);

  let comment = "";
  let fullComment = "";
  const started = [...broke, ...unseen];
  if (previousRuns.length > 0 && started.length > 0) {
    const [newest] = previousRuns;
    const startedTests = countTests(started);
    const unseenTests = countTests(unseen);
    const compared = `${plural(previousRuns.length, "earlier full run", "earlier full runs")} (${previousRuns.map((entry) => `${runLink(entry)} on ${shortSha(entry.sha)}`).join(", ")})`;
    const before =
      broke.length === 0
        ? `There is no result for them in the ${compared}: new tests, or shards that did not report.`
        : `They passed in each of the ${compared}${unseenTests > 0 ? `, except ${unseenTests} with no result there (a new test, or a shard that did not report)` : ""}.`;
    const fixedNote =
      fixed.length > 0
        ? ` Since ${runLink(newest)}, ${plural(countTests(fixed), "failing test passes", "failing tests pass")} again.`
        : "";
    const range =
      newest.sha === run.sha
        ? `No commits landed since ${runLink(newest)}, so these failures are flaky or come from the runner.`
        : pulls.length > 0
          ? [
              `Pull requests merged since ${runLink(newest)} ([compare](${compareUrl})). If yours is listed, check whether it broke one of these tests:`,
              "",
              ...pulls.map(pullLine),
            ].join("\n")
          : `No pull request merged since ${runLink(newest)} ([compare](${compareUrl})).`;
    const commentHead = [
      mark,
      `**${plural(startedTests, "test", "tests")} started failing** in ${where}. ${before}${fixedNote}`,
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

  const previousNote =
    previousRuns.length > 0
      ? ""
      : "\n_No earlier full run on this branch has results to compare with, so nothing is marked new._\n";
  const fullBody = sections(SUMMARY_LIMIT);
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
      passed: reports.reduce((sum, report) => sum + (report.stats?.expected ?? 0), 0),
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

  // The newest finished full runs on this branch before this one. A cancelled run is left out: its shards stopped early.
  const runs = JSON.parse(
    gh(
      "api",
      `repos/${repo}/actions/workflows/playwright.yml/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&status=completed&per_page=20`,
      "--jq",
      "[.workflow_runs[] | {id, head_sha, html_url, conclusion}]",
    ),
  );
  // A run that stopped before its shards (a moved expected_sha, say) has no results, so the one before it is tried.
  const history = [];
  for (const before of runs.filter(
    (candidate) => candidate.id < Number(runId) && candidate.conclusion !== "cancelled",
  )) {
    if (history.length === HISTORY_RUNS) break;
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
    } catch (error) {
      console.warn(`Run ${before.id} has no shard results to compare with: ${error.message ?? error}`);
      continue;
    }
    const results = mergeResults(readShardReports(dir));
    if (results.size === 0) continue;
    history.push({ id: before.id, url: before.html_url, sha: before.head_sha, results });
  }
  const [newest] = history;

  let pulls = [];
  let compareUrl = "";
  if (newest && newest.sha !== sha) {
    compareUrl = `${server}/${repo}/compare/${newest.sha}...${sha}`;
    const messages = jsonLines(
      gh(
        "api",
        `repos/${repo}/compare/${newest.sha}...${sha}`,
        "--paginate",
        "--jq",
        ".commits[].commit.message | @json",
      ),
    );
    // The merge commit names the head repository's owner, not the author, so each pull request is looked up.
    const author = (number) => {
      try {
        return gh("api", `repos/${repo}/pulls/${number}`, "--jq", ".user.login").trim();
      } catch (error) {
        console.warn(`Pull request #${number} has no author to mention: ${error.message ?? error}`);
        return "";
      }
    };
    pulls = mergedPullRequests(messages).map((pull) => ({ ...pull, author: author(pull.number) }));
  }

  const report = renderReport({
    run: {
      id: runId,
      url: `${server}/${repo}/actions/runs/${runId}`,
      sha,
      date: new Date().toISOString().slice(0, 10),
    },
    previousRuns: history,
    comparison: compareRuns(
      mergeResults(currentShards),
      history.map((entry) => entry.results),
    ),
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
  // `--slim <report.json>`: a shard shrinks its report in place before uploading it, or writes NO_REPORT when
  // Playwright wrote none.
  if (process.argv[2] === "--slim") {
    const file = process.argv[3];
    if (!file) throw new Error("Usage: node scripts/nightly-matrix-report.mjs --slim <report.json>");
    mkdirSync(dirname(file), { recursive: true });
    const report = readReport(file);
    writeFileSync(file, JSON.stringify(report.noReport ? NO_REPORT : slimReport(report)));
  } else main();
}
