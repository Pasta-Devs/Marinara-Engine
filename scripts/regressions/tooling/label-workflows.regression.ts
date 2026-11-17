// The label workflows: issue-triage.yml (an issue's type label follows its title prefix), pull-request-triage.yml
// (a pull request's type label follows its title prefix or branch) and issue-status-from-prs.yml (an issue gets the
// area labels of the pull requests that close it). Each case runs the workflow's real github-script body against an
// in-memory GitHub.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractNamedStep } from "../../validate-pr-triage.mjs";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const read = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8").replace(/\r\n/gu, "\n");

// The `script: |` block of a workflow step, without its YAML indentation.
function stepScript(workflow: string, stepName: string) {
  const body = extractNamedStep(read(`.github/workflows/${workflow}`), stepName).split("script: |\n")[1];
  assert.ok(body, `${workflow}: "${stepName}" has no script`);
  return body
    .split("\n")
    .map((line) => line.slice(12))
    .join("\n");
}

const AsyncFunction = (async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<void>;
const issueTriage = new AsyncFunction(
  "github",
  "context",
  "core",
  stepScript("issue-triage.yml", "Match the type label to the title prefix"),
);
const pullRequestTriage = new AsyncFunction(
  "github",
  "context",
  "core",
  stepScript("pull-request-triage.yml", "Label by title or branch"),
);
const issueStatus = new AsyncFunction(
  "github",
  "context",
  "core",
  stepScript("issue-status-from-prs.yml", "Label linked issues"),
);

type Item = { title?: string; head?: string; state: "open" | "closed"; isPr?: boolean; labels: Set<string> };

// An in-memory repository: issues and pull requests share numbers and labels, as on GitHub.
function fakeGitHub(items: Record<number, Item>, options: { removeStatus?: number; pulls?: object[] } = {}) {
  const existing = new Set([
    "bug",
    "enhancement",
    "docs",
    "tracking",
    "bugfix",
    "feature",
    "in-pr",
    "fixed-in-staging",
  ]);
  const item = (issue_number: number) => {
    const found = items[issue_number];
    if (!found) throw Object.assign(new Error("Not Found"), { status: 404 });
    return found;
  };
  const issues = {
    get: async ({ issue_number }: { issue_number: number }) => {
      const found = item(issue_number);
      return {
        data: {
          title: found.title,
          state: found.state,
          pull_request: found.isPr ? {} : undefined,
          labels: [...found.labels].map((name) => ({ name })),
        },
      };
    },
    addLabels: async ({ issue_number, labels }: { issue_number: number; labels: string[] }) => {
      for (const name of labels) item(issue_number).labels.add(name);
    },
    removeLabel: async ({ issue_number, name }: { issue_number: number; name: string }) => {
      if (options.removeStatus === 404) item(issue_number).labels.delete(name);
      if (options.removeStatus) throw Object.assign(new Error("Remove failed"), { status: options.removeStatus });
      if (!item(issue_number).labels.delete(name)) throw Object.assign(new Error("Not Found"), { status: 404 });
    },
    createLabel: async ({ name }: { name: string }) => {
      if (existing.has(name)) throw Object.assign(new Error("Already exists"), { status: 422 });
      existing.add(name);
    },
    updateLabel: async () => {},
    listLabelsOnIssue: async ({ issue_number }: { issue_number: number }) => ({
      data: [...item(issue_number).labels].map((name) => ({ name })),
    }),
    listForRepo: async ({ labels }: { labels: string }) => ({
      data: Object.entries(items)
        .filter(([, found]) => found.state === "open" && found.labels.has(labels))
        .map(([number, found]) => ({ number: Number(number), pull_request: found.isPr ? {} : undefined })),
    }),
  };
  const pulls = {
    get: async ({ pull_number }: { pull_number: number }) => {
      const found = item(pull_number);
      return {
        data: {
          number: pull_number,
          title: found.title,
          head: { ref: found.head },
          labels: [...found.labels].map((name) => ({ name })),
        },
      };
    },
    list: async () => ({ data: options.pulls ?? [] }),
  };
  return {
    rest: { issues, pulls },
    paginate: async (method: (params: object) => Promise<{ data: unknown[] }>, params: object) =>
      (await method(params)).data,
  };
}

const core = { info: () => {}, warning: () => {} };
const repo = { owner: "Pasta-Devs", repo: "Marinara-Engine" };
const sorted = (labels: Set<string>) => [...labels].sort();

// --- issue-triage.yml: the type label follows the title prefix.
const issueCases: [string, string, string[], string[], number?][] = [
  ["[Issue]: gets bug", "[Issue]: Install / Start", [], ["bug"]],
  ["a lower-case prefix counts", "[issue]: lower", [], ["bug"]],
  ["[Bug] after a leading space gets bug", "  [Bug] x", [], ["bug"]],
  ["[Feature]: gets enhancement", "[Feature]: x", [], ["enhancement"]],
  ["[docs-i18n] gets docs", "[docs-i18n] docs/a.md", [], ["docs"]],
  ["[Tracking]: gets tracking", "[Tracking]: Make Marinara feel fast", [], ["tracking"]],
  ["the prefix replaces another type label", "[Issue]: x", ["enhancement", "in-pr"], ["bug", "in-pr"]],
  ["every other type label goes", "[Feature]: x", ["bug", "docs"], ["enhancement"]],
  [
    "[Tracking]: replaces a type label and keeps an area",
    "[Tracking]: x",
    ["enhancement", "client"],
    ["client", "tracking"],
  ],
  ["an unknown prefix keeps the labels", "[Feature Request] x", ["bug"], ["bug"]],
  ["a pull request prefix gets nothing", "fix: resolve saved DeepL defaults", [], []],
  ["a prefix later in the title gets nothing", "soup/ [Feature]: x", [], []],
  ["a label someone removed meanwhile is fine", "[Feature]: x", ["bug"], ["enhancement"], 404],
];
const cases: RegressionCase[] = issueCases.map(([name, title, labels, expected, removeStatus]) => ({
  name: `issue: ${name}`,
  run: async () => {
    const items = { 7: { title, state: "open" as const, labels: new Set(labels) } };
    await issueTriage(fakeGitHub(items, { removeStatus }), { repo, payload: { issue: { number: 7 } } }, core);
    assert.deepEqual(sorted(items[7].labels), [...expected].sort());
  },
}));
cases.push({
  name: "issue: a failed label removal fails the step",
  run: async () => {
    const items = { 7: { title: "[Feature]: x", state: "open" as const, labels: new Set(["bug"]) } };
    const github = fakeGitHub(items, { removeStatus: 500 });
    await assert.rejects(issueTriage(github, { repo, payload: { issue: { number: 7 } } }, core), { status: 500 });
  },
});

// --- pull-request-triage.yml: the type label follows the title prefix, then the branch.
const pullRequestCases: [string, string, string, string[], string[]][] = [
  ["fix(scope): gets bugfix", "fix(client): keep the picker open", "kolacheee/picker", [], ["bugfix"]],
  ["feat!: gets feature", "feat(mari)!: let Mari write a card", "kolacheee/mari", [], ["feature"]],
  ["a leading Fix gets bugfix", "Fix the owner-approval trigger", "kolacheee/approval", [], ["bugfix"]],
  ["a leading Fixes gets bugfix", "Fixes the stale picker", "kolacheee/picker", [], ["bugfix"]],
  ["[Issue]: gets bugfix", "[Issue]: x", "kolacheee/x", [], ["bugfix"]],
  ["docs: on a fix/ branch gets neither", "docs: explain the labels", "fix/labels", ["bugfix", "client"], ["client"]],
  ["test: drops feature", "test(e2e): cover the drawer", "kolacheee/e2e", ["feature"], []],
  ["fix: swaps feature for bugfix", "fix: x", "feat/x", ["feature"], ["bugfix"]],
  ["an unknown prefix falls back to a feat/ branch", "Professor Mari: set picks", "feat/mari-picks", [], ["feature"]],
  ["a scope word falls back to a fix/ branch", "soup: x", "fix/soup", [], ["bugfix"]],
  ["no prefix and no branch type keeps the labels", "Update the thing", "kolacheee/thing", ["bugfix"], ["bugfix"]],
  ["a word that starts with fix is no prefix", "Fixture loader leaks", "kolacheee/fixtures", [], []],
];
for (const [name, title, head, labels, expected] of pullRequestCases) {
  cases.push({
    name: `pull request: ${name}`,
    run: async () => {
      const items = { 40: { title, head, isPr: true, state: "open" as const, labels: new Set(labels) } };
      const payload = {
        pull_request: { number: 40, title, head: { ref: head }, labels: labels.map((n) => ({ name: n })) },
      };
      await pullRequestTriage(fakeGitHub(items), { repo, payload }, core);
      assert.deepEqual(sorted(items[40].labels), [...expected].sort());
    },
  });
}

// --- issue-status-from-prs.yml: an issue gets the area labels of the pull requests that close it.
const labelerLabels = [...read(".github/labeler.yml").matchAll(/^([a-z][\w-]*):\s*$/gmu)].map((match) => match[1]);
assert.ok(labelerLabels.includes("client") && labelerLabels.includes("docs"), "labeler.yml labels were not found");

function linkedIssueRun(
  pr: { state: "open" | "closed"; merged?: boolean; base?: string },
  prLabels: string[],
  issue: Item,
) {
  const items: Record<number, Item> = {
    10: issue,
    500: { state: pr.state, isPr: true, labels: new Set(prLabels) },
  };
  const body = "## Linked issue\n\nCloses #10";
  const pulls = pr.state === "open" ? [{ number: 500, body }] : [];
  const payload = {
    pull_request: {
      number: 500,
      body,
      state: pr.state,
      merged: pr.merged ?? false,
      base: { ref: pr.base ?? "staging" },
    },
  };
  return { items, run: () => issueStatus(fakeGitHub(items, { pulls }), { repo, payload }, core) };
}
const openIssue = (...labels: string[]): Item => ({ state: "open", labels: new Set(labels) });

cases.push(
  {
    name: "linked issue: an open pull request's area labels reach the issue, not docs or its type",
    run: async () => {
      const { items, run } = linkedIssueRun(
        { state: "open" },
        ["client", "server", "ci", "docs", "bugfix"],
        openIssue("bug"),
      );
      await run();
      assert.deepEqual(sorted(items[10].labels), ["bug", "ci", "client", "in-pr", "server"]);
    },
  },
  {
    name: "linked issue: every labeler.yml area except docs is copied",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "open" }, [...labelerLabels, "feature"], openIssue());
      await run();
      const areas = labelerLabels.filter((name) => name !== "docs");
      assert.deepEqual(sorted(items[10].labels), [...areas, "in-pr"].sort());
    },
  },
  {
    name: "linked issue: a merged pull request adds its areas with fixed-in-staging",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "closed", merged: true }, ["server"], openIssue("bug", "in-pr"));
      await run();
      assert.deepEqual(sorted(items[10].labels), ["bug", "fixed-in-staging", "server"]);
    },
  },
  {
    name: "linked issue: a pull request closed without merging adds no areas",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "closed" }, ["server"], openIssue("bug", "in-pr"));
      await run();
      assert.deepEqual(sorted(items[10].labels), ["bug"]);
    },
  },
  {
    name: "linked issue: an area set by hand stays",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "open" }, ["client"], openIssue("android"));
      await run();
      assert.deepEqual(sorted(items[10].labels), ["android", "client", "in-pr"]);
    },
  },
  {
    name: "linked issue: a pull request that does not target staging adds nothing",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "open", base: "main" }, ["client"], openIssue("bug"));
      await run();
      assert.deepEqual(sorted(items[10].labels), ["bug"]);
    },
  },
  {
    name: "linked issue: a closed issue is left alone",
    run: async () => {
      const { items, run } = linkedIssueRun({ state: "open" }, ["client"], {
        state: "closed",
        labels: new Set(["bug"]),
      });
      await run();
      assert.deepEqual(sorted(items[10].labels), ["bug"]);
    },
  },
);

await runNamedCases(cases);
