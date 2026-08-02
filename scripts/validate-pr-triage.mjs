import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function extractNamedStep(workflow, stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow step: ${stepName}`);

  const contentStart = start + marker.length;
  const nextStep = workflow.indexOf("\n      - ", contentStart);
  const nextJobMatch = workflow.slice(contentStart).match(/\n  [A-Za-z_][A-Za-z0-9_-]*:\s*\n/u);
  const nextJob = nextJobMatch?.index === undefined ? -1 : contentStart + nextJobMatch.index;
  const boundaries = [nextStep, nextJob].filter((boundary) => boundary !== -1);
  const end = boundaries.length > 0 ? Math.min(...boundaries) : undefined;

  return workflow.slice(start, end).trimEnd();
}

function extractJob(workflow, jobId) {
  const marker = `  ${jobId}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow job: ${jobId}`);

  const contentStart = start + marker.length;
  const nextJobMatch = workflow.slice(contentStart).match(/\n  [A-Za-z_][A-Za-z0-9_-]*:\s*\n/u);
  const end = nextJobMatch?.index === undefined ? undefined : contentStart + nextJobMatch.index;
  return workflow.slice(start, end).trimEnd();
}

export function validatePullRequestTriage() {
  const triageWorkflow = readFileSync(
    new URL("../.github/workflows/pull-request-triage.yml", import.meta.url),
    "utf8",
  );
  const reviewSignal = readFileSync(
    new URL("../.github/workflows/owner-approval-review-signal.yml", import.meta.url),
    "utf8",
  );
  const reviewEvaluator = readFileSync(
    new URL("../.github/workflows/owner-approval-review.yml", import.meta.url),
    "utf8",
  );
  const approvalEvaluator = readFileSync(new URL("./evaluate-owner-approval.mjs", import.meta.url), "utf8");
  const codeOwners = readFileSync(new URL("../.github/CODEOWNERS", import.meta.url), "utf8");
  const triggersSectionStart = triageWorkflow.indexOf("\non:\n");
  const triggersSectionEnd = triageWorkflow.indexOf("\nconcurrency:\n", triggersSectionStart);
  const jobsSectionStart = triageWorkflow.indexOf("\njobs:\n");

  assert.notEqual(triggersSectionStart, -1, "Missing workflow trigger section");
  assert.notEqual(triggersSectionEnd, -1, "Missing end of workflow trigger section");
  assert.notEqual(jobsSectionStart, -1, "Missing workflow jobs section");
  assert.equal(
    triageWorkflow.slice(triggersSectionStart + 1, triggersSectionEnd),
    "on:\n  pull_request_target:\n    types: [opened, reopened, edited, synchronize, ready_for_review]\n    branches: [staging, main]\n",
  );

  const jobIds = [
    ...triageWorkflow
      .slice(jobsSectionStart + "\njobs:\n".length)
      .matchAll(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/gmu),
  ].map((match) => match[1]);
  assert.ok(jobIds.includes("branch-policy"));
  assert.ok(jobIds.includes("owner-approval"));
  assert.ok(jobIds.includes("template-check"));
  assert.doesNotMatch(triageWorkflow, /pull_request_review|github\.event\.review/u);

  const ownerApprovalJob = extractJob(triageWorkflow, "owner-approval");
  assert.match(ownerApprovalJob, /if: github\.event\.pull_request\.base\.ref == 'staging'/u);
  assert.match(ownerApprovalJob, /statuses: write/u);
  assert.match(ownerApprovalJob, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u);
  assert.match(ownerApprovalJob, /PASTA_DEVS_MEMBERS_TOKEN/u);
  assert.match(ownerApprovalJob, /run: node scripts\/evaluate-owner-approval\.mjs/u);
  assert.doesNotMatch(ownerApprovalJob, /github\.event\.pull_request\.head/u);

  assert.match(
    reviewSignal,
    /on:\n  pull_request_review:\n    types: \[submitted, edited, dismissed\]/u,
  );
  assert.match(reviewSignal, /permissions: \{\}/u);
  assert.doesNotMatch(reviewSignal, /secrets\.|github\.token|actions\/checkout|PASTA_DEVS_MEMBERS_TOKEN/u);

  assert.match(
    reviewEvaluator,
    /on:\n  workflow_run:\n    workflows: \[Owner Approval Review Signal\]\n    types: \[completed\]/u,
  );
  assert.match(
    reviewEvaluator,
    /group: owner-approval-review-\$\{\{ github\.event\.workflow_run\.pull_requests\[0\]\.number \|\| github\.event\.workflow_run\.head_sha \}\}\n  cancel-in-progress: true/u,
  );
  assert.match(reviewEvaluator, /statuses: write/u);
  assert.match(reviewEvaluator, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/u);
  assert.match(reviewEvaluator, /GET \/repos\/\{owner\}\/\{repo\}\/commits\/\{commit_sha\}\/pulls/u);
  assert.match(reviewEvaluator, /commit_sha: context\.payload\.workflow_run\.head_sha/u);
  assert.match(reviewEvaluator, /PASTA_DEVS_MEMBERS_TOKEN/u);
  assert.match(reviewEvaluator, /run: node scripts\/evaluate-owner-approval\.mjs/u);
  assert.doesNotMatch(reviewEvaluator, /ref:.*workflow_run|head_repository/u);

  assert.match(approvalEvaluator, /\/orgs\/\$\{encodeURIComponent\(organization\)\}\/memberships\//u);
  assert.match(approvalEvaluator, /membership\.state === "active"/u);
  assert.match(approvalEvaluator, /membership\.role === "admin" \|\| membership\.role === "member"/u);
  assert.match(approvalEvaluator, /latestOwnerReview\?\.state === "APPROVED"/u);
  assert.match(approvalEvaluator, /latestOwnerReview\.commit_id === headSha/u);
  assert.match(approvalEvaluator, /\/statuses\/\$\{encodeURIComponent\(headSha\)\}/u);
  assert.match(approvalEvaluator, /Owner approval for outside contributors/u);

  const exemptionStep = extractNamedStep(triageWorkflow, "Exempt trusted contributor");
  assert.equal(
    exemptionStep,
    [
      "      - name: Exempt trusted contributor",
      "        if: >-",
      "          github.event.pull_request.author_association == 'MEMBER' ||",
      "          github.event.pull_request.author_association == 'OWNER' ||",
      "          github.event.pull_request.author_association == 'COLLABORATOR'",
      '        run: echo "Trusted contributor; pull request template validation is not required."',
    ].join("\n"),
  );

  assert.match(codeOwners, /^\* @SpicyMarinara$/mu);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validatePullRequestTriage();
  console.info("Pull request workflow gates are stable and use a trusted token-backed staging approval status.");
}
