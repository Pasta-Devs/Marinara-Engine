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
}) {
  const statuses = [];
  let statusAttempts = 0;
  const request = async ({ token, method = "GET", path, body }) => {
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
  return { request, statuses, getStatusAttempts: () => statusAttempts };
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
  assert.equal(status.state, "error");
  assert.equal(getStatusAttempts(), 2);
}

console.info("Owner approval evaluator tests passed.");
