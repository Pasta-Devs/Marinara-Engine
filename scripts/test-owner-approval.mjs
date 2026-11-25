import assert from "node:assert/strict";
import { evaluateOwnerApproval, OWNER_APPROVAL_CONTEXT } from "./evaluate-owner-approval.mjs";

const basePullRequest = {
  state: "open",
  base: { ref: "staging" },
  head: { sha: "head-sha" },
  user: { login: "OutsideContributor" },
};

function createMock({
  pullRequest = basePullRequest,
  membership,
  membershipError,
  reviews = [],
  reviewsError,
  statusFailures = 0,
  signalRuns = [],
}) {
  const statuses = [];
  let statusAttempts = 0;
  let signalListings = 0;
  const request = async ({ token, method = "GET", path, body }) => {
    if (path.includes("/actions/workflows/")) {
      assert.equal(path, "/repos/Pasta-Devs/Marinara-Engine/actions/workflows/77/runs?per_page=100");
      signalListings += 1;
      const runs = typeof signalRuns === "function" ? signalRuns(signalListings) : signalRuns;
      if (runs instanceof Error) throw runs;
      return { workflow_runs: runs };
    }
    if (method === "POST" && path.endsWith("/statuses/head-sha")) {
      assert.equal(token, "github-token");
      statusAttempts += 1;
      if (statusAttempts <= statusFailures) {
        throw Object.assign(new Error("Status unavailable"), { status: 503 });
      }
      statuses.push(body);
      return body;
    }
    if (path.includes("/pulls/42/reviews")) {
      if (reviewsError) throw reviewsError;
      return reviews;
    }
    if (path.endsWith("/pulls/42")) return pullRequest;
    if (path.includes("/memberships/")) {
      assert.equal(token, "members-token");
      if (membershipError) throw membershipError;
      return membership;
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return { request, statuses, getStatusAttempts: () => statusAttempts, getSignalListings: () => signalListings };
}

async function evaluateCase(options, env = {}) {
  const mock = createMock(options);
  const result = await evaluateOwnerApproval({
    request: mock.request,
    env: {
      GITHUB_REPOSITORY: "Pasta-Devs/Marinara-Engine",
      GITHUB_TOKEN: "github-token",
      MEMBERS_TOKEN_CONFIGURED: "true",
      PASTA_DEVS_MEMBERS_TOKEN: "members-token",
      PR_NUMBER: "42",
      RUN_URL: "https://github.example/actions/runs/1",
      ...env,
    },
  });
  return { ...mock, result };
}

async function runCase(options, env = {}) {
  const outcome = await evaluateCase(options, env);
  assert.equal(outcome.statuses.length, 1);
  assert.equal(outcome.statuses[0].context, OWNER_APPROVAL_CONTEXT);
  return { ...outcome, status: outcome.statuses[0] };
}

{
  const { result, statuses } = await evaluateCase({
    pullRequest: { ...basePullRequest, state: "closed" },
  });
  assert.equal(result.skipped, true);
  assert.equal(statuses.length, 0);
}

{
  const { result, statuses } = await evaluateCase({
    pullRequest: { ...basePullRequest, base: { ref: "main" } },
  });
  assert.equal(result.skipped, true);
  assert.equal(statuses.length, 0);
}

{
  const { result, status } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "MemberDeveloper" } },
    membership: { state: "active", role: "member" },
  });
  assert.equal(result.internal, true);
  assert.equal(status.state, "success");
}

{
  const { result, status } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "OrganizationOwner" } },
    membership: { state: "active", role: "admin" },
  });
  assert.equal(result.internal, true);
  assert.equal(status.state, "success");
}

{
  const { result, status } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "PendingMember" } },
    membership: { state: "pending", role: "member" },
  });
  assert.equal(result.internal, false);
  assert.equal(status.state, "failure");
}

{
  const { status } = await runCase(
    { pullRequest: { ...basePullRequest, user: { login: "SpicyMarinara" } } },
    { MEMBERS_TOKEN_CONFIGURED: "false", PASTA_DEVS_MEMBERS_TOKEN: "" },
  );
  assert.equal(status.state, "success");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({ membershipError: notFound });
  assert.equal(status.state, "failure");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
      { id: 2, state: "CHANGES_REQUESTED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "failure");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "success");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
      { id: 2, state: "DISMISSED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "failure");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
      { id: 2, state: "COMMENTED", commit_id: "head-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "success");
}

{
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  const { status } = await runCase({
    membershipError: notFound,
    reviews: [
      { id: 1, state: "APPROVED", commit_id: "stale-sha", user: { login: "SpicyMarinara" } },
    ],
  });
  assert.equal(status.state, "failure");
}

{
  const { status } = await runCase(
    {},
    { MEMBERS_TOKEN_CONFIGURED: "false", PASTA_DEVS_MEMBERS_TOKEN: "" },
  );
  assert.equal(status.state, "error");
}

{
  const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
  const { status } = await runCase({ membershipError: forbidden });
  assert.equal(status.state, "error");
}

{
  const unavailable = Object.assign(new Error("Service unavailable"), { status: 503 });
  const { status } = await runCase({
    membershipError: Object.assign(new Error("Not Found"), { status: 404 }),
    reviewsError: unavailable,
  });
  assert.equal(status.state, "error");
}

{
  const { status, getStatusAttempts } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "MemberDeveloper" } },
    membership: { state: "active", role: "member" },
    statusFailures: 1,
  });
  assert.equal(status.state, "success");
  assert.equal(getStatusAttempts(), 2);
}

// The review evaluator answers one review signal. A newer signal for the same pull request that has completed supersedes
// it: the run ends without publishing, and the newer signal's run publishes. Without SIGNAL_RUN_ID (the triage job)
// nothing is listed.
const completed = { status: "completed", conclusion: "success" };
{
  const { getSignalListings } = await runCase({
    pullRequest: { ...basePullRequest, user: { login: "MemberDeveloper" } },
    membership: { state: "active", role: "member" },
    signalRuns: [{ id: 2000, ...completed, head_sha: "head-sha", pull_requests: [{ number: 42 }] }],
  });
  assert.equal(getSignalListings(), 0);
}

const signal = { SIGNAL_RUN_ID: "1000", SIGNAL_WORKFLOW_ID: "77", SIGNAL_HEAD_SHA: "reviewed-sha" };
const member = {
  pullRequest: { ...basePullRequest, user: { login: "MemberDeveloper" } },
  membership: { state: "active", role: "member" },
};

for (const newer of [
  { id: 1001, ...completed, head_sha: "later-sha", pull_requests: [{ number: 42 }] },
  { id: 1001, ...completed, head_sha: "later-sha", pull_requests: [{ number: 7 }, { number: 42 }] },
  // A fork's signal lists no pull requests; its head names the pull request.
  { id: 1001, ...completed, head_sha: "head-sha", pull_requests: [] },
  { id: 1001, ...completed, head_sha: "reviewed-sha", pull_requests: [] },
  // The evaluator starts on any completed signal, whatever its conclusion.
  { id: 1001, status: "completed", conclusion: "failure", head_sha: "head-sha", pull_requests: [{ number: 42 }] },
]) {
  const { result, statuses } = await evaluateCase({ ...member, signalRuns: [newer] }, signal);
  assert.equal(result.superseded, true, JSON.stringify(newer));
  assert.equal(statuses.length, 0, JSON.stringify(newer));
}

{
  const { status, getSignalListings } = await runCase(
    {
      ...member,
      signalRuns: [
        // Another pull request's newer signal, a newer one still waiting for approval to run, this run's own signal
        // and an older one: none of them supersedes this run.
        { id: 1003, ...completed, head_sha: "other-sha", pull_requests: [{ number: 7 }] },
        { id: 1002, status: "completed", conclusion: "action_required", head_sha: "head-sha", pull_requests: [] },
        { id: 1000, ...completed, head_sha: "reviewed-sha", pull_requests: [{ number: 42 }] },
        { id: 999, ...completed, head_sha: "head-sha", pull_requests: [{ number: 42 }] },
      ],
    },
    signal,
  );
  assert.equal(status.state, "success");
  assert.equal(getSignalListings(), 2, "checked before the evaluation and again before publishing");
}

{
  // A newer signal that is still queued or running has no evaluator yet, and one stuck in the queue never gets one. The
  // evaluator for it starts after this run publishes, so this run still publishes.
  for (const status of ["queued", "in_progress", "waiting", "pending", "requested"]) {
    const { status: published, getSignalListings } = await runCase(
      {
        ...member,
        signalRuns: [{ id: 1001, status, conclusion: null, head_sha: "head-sha", pull_requests: [{ number: 42 }] }],
      },
      signal,
    );
    assert.equal(published.state, "success", status);
    assert.equal(getSignalListings(), 2, status);
  }
}

{
  // A review submitted while this run evaluates: the older run must not write after the newer one.
  const { result, statuses } = await evaluateCase(
    {
      ...member,
      signalRuns: (listing) =>
        listing === 1 ? [] : [{ id: 1001, ...completed, head_sha: "head-sha", pull_requests: [{ number: 42 }] }],
    },
    signal,
  );
  assert.equal(result.superseded, true);
  assert.equal(statuses.length, 0);
}

{
  // Another pull request whose head is the same commit: its signal is not about this pull request, so this run still
  // publishes this pull request's own result.
  const notFound = Object.assign(new Error("Not Found"), { status: 404 });
  for (const otherPullRequest of [
    { id: 1001, ...completed, head_sha: "head-sha", pull_requests: [{ number: 7 }] },
    { id: 1001, ...completed, head_sha: "reviewed-sha", pull_requests: [{ number: 7 }] },
  ]) {
    const { status } = await runCase({ membershipError: notFound, signalRuns: [otherPullRequest] }, signal);
    assert.equal(status.state, "failure", JSON.stringify(otherPullRequest));
  }
}

{
  // A publish attempt failed, and a newer signal arrived before the retry: the retry must not write over its status.
  const { result, statuses, getStatusAttempts } = await evaluateCase(
    {
      ...member,
      statusFailures: 1,
      signalRuns: (listing) =>
        listing <= 2 ? [] : [{ id: 1001, ...completed, head_sha: "head-sha", pull_requests: [{ number: 42 }] }],
    },
    signal,
  );
  assert.equal(result.superseded, true);
  assert.equal(statuses.length, 0);
  assert.equal(getStatusAttempts(), 1);
}

{
  // With no newer signal, a failed publish attempt is still retried.
  const { status, getStatusAttempts } = await runCase({ ...member, statusFailures: 1 }, signal);
  assert.equal(status.state, "success");
  assert.equal(getStatusAttempts(), 2);
}

{
  // Listing the signals failed: publish rather than risk that no run publishes.
  const { status } = await runCase(
    { ...member, signalRuns: Object.assign(new Error("Server error"), { status: 502 }) },
    signal,
  );
  assert.equal(status.state, "success");
}

console.info("Owner approval evaluator tests passed.");
