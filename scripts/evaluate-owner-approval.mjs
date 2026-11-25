import { pathToFileURL } from "node:url";

export const OWNER_APPROVAL_CONTEXT = "Owner approval for outside contributors";

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function githubRequest({ token, method = "GET", path, body }) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "marinara-owner-approval-gate",
    },
    signal: AbortSignal.timeout(15_000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const responseBody = await response.text();
  const data = responseBody ? JSON.parse(responseBody) : undefined;

  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function listPullRequestReviews(request, token, repositoryPath, pullNumber) {
  const reviews = [];

  for (let page = 1; ; page += 1) {
    const batch = await request({
      token,
      path: `/repos/${repositoryPath}/pulls/${pullNumber}/reviews?per_page=100&page=${page}`,
    });
    reviews.push(...batch);
    if (batch.length < 100) break;
  }

  return reviews;
}

// GitHub runs the review evaluator (owner-approval-review.yml) on the default branch, so a run cancelled by a
// concurrency group shows as a failed check on main. Instead, a run ends without publishing when a newer review signal
// for the same pull request exists; that signal's own run publishes. pull-request-triage.yml sets no SIGNAL_RUN_ID.
async function newerReviewSignal({ env, request, token, repositoryPath, pullNumber, headSha }) {
  const signalRunId = Number(env.SIGNAL_RUN_ID);
  if (!signalRunId) return false;
  const workflowId = encodeURIComponent(requireValue(env.SIGNAL_WORKFLOW_ID, "SIGNAL_WORKFLOW_ID"));
  try {
    // Runs come newest first, so the first page holds every newer one unless 100 reviews arrived since.
    const { workflow_runs: runs = [] } = await request({
      token,
      path: `/repos/${repositoryPath}/actions/workflows/${workflowId}/runs?per_page=100`,
    });
    return runs.some(
      (run) =>
        run.id > signalRunId &&
        // A fork's run that waits for approval to start may never start an evaluator.
        run.conclusion !== "action_required" &&
        // A commit can head more than one pull request, so a run that lists pull requests must list this one. Only a
        // fork's run, which lists none, is matched by its head.
        (run.pull_requests?.length > 0
          ? run.pull_requests.some((pullRequest) => pullRequest.number === pullNumber)
          : run.head_sha === env.SIGNAL_HEAD_SHA || run.head_sha === headSha),
    );
  } catch (error) {
    // Publishing a current evaluation twice is harmless; skipping the newest one is not.
    console.warn(`Could not list newer review signals (status ${error?.status ?? "unknown"}); publishing anyway.`);
    return false;
  }
}

export async function evaluateOwnerApproval({ env = process.env, request = githubRequest } = {}) {
  const repository = requireValue(env.GITHUB_REPOSITORY, "GITHUB_REPOSITORY");
  const githubToken = requireValue(env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const pullNumber = Number.parseInt(requireValue(env.PR_NUMBER, "PR_NUMBER"), 10);
  const [organization, repositoryName] = repository.split("/");

  if (!organization || !repositoryName || !Number.isSafeInteger(pullNumber) || pullNumber <= 0) {
    throw new Error("GITHUB_REPOSITORY and PR_NUMBER must identify a valid pull request.");
  }

  const repositoryPath = `${encodeURIComponent(organization)}/${encodeURIComponent(repositoryName)}`;
  const pullRequest = await request({
    token: githubToken,
    path: `/repos/${repositoryPath}/pulls/${pullNumber}`,
  });

  if (pullRequest.state !== "open" || pullRequest.base?.ref !== "staging") {
    console.info(`Skipping #${pullNumber}; it is not an open pull request targeting staging.`);
    return { skipped: true };
  }

  const authorLogin = pullRequest.user?.login;
  const headSha = pullRequest.head?.sha;
  requireValue(authorLogin, "pull request author login");
  requireValue(headSha, "pull request head SHA");

  // Checked before the evaluation and again before every attempt to write the status, so an older run does not write
  // over a newer one's.
  const superseded = async () => {
    if (!(await newerReviewSignal({ env, request, token: githubToken, repositoryPath, pullNumber, headSha }))) {
      return false;
    }
    console.info(`::notice::A newer review signal for #${pullNumber} has its own run, which publishes the status.`);
    return true;
  };
  if (await superseded()) return { skipped: true, superseded: true };

  let state = "failure";
  let description = "Outside contribution requires current SpicyMarinara approval.";
  let internal = authorLogin.toLowerCase() === "spicymarinara";

  const publishStatus = () =>
    request({
      token: githubToken,
      method: "POST",
      path: `/repos/${repositoryPath}/statuses/${encodeURIComponent(headSha)}`,
      body: {
        state,
        context: OWNER_APPROVAL_CONTEXT,
        description,
        target_url: env.RUN_URL,
      },
    });

  try {
    if (!internal) {
      if (env.MEMBERS_TOKEN_CONFIGURED !== "true" || !env.PASTA_DEVS_MEMBERS_TOKEN) {
        state = "error";
        description = "Could not verify Pasta-Devs membership; failing closed.";
      } else {
        try {
          const membership = await request({
            token: env.PASTA_DEVS_MEMBERS_TOKEN,
            path: `/orgs/${encodeURIComponent(organization)}/memberships/${encodeURIComponent(authorLogin)}`,
          });
          internal =
            membership.state === "active" &&
            (membership.role === "admin" || membership.role === "member");
        } catch (error) {
          if (error.status !== 404) {
            state = "error";
            description = "Could not verify Pasta-Devs membership; failing closed.";
            console.error(`Membership lookup failed with status ${error?.status ?? "unknown"}.`);
          }
        }
      }
    }

    if (internal) {
      state = "success";
      description = "Active Pasta-Devs member; owner approval is not required.";
    } else if (state !== "error") {
      const reviews = await listPullRequestReviews(request, githubToken, repositoryPath, pullNumber);
      const decisiveStates = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);
      const latestOwnerReview = reviews
        .filter(
          (review) =>
            review.user?.login?.toLowerCase() === "spicymarinara" &&
            decisiveStates.has(review.state),
        )
        .sort((left, right) => left.id - right.id)
        .at(-1);

      if (latestOwnerReview?.state === "APPROVED" && latestOwnerReview.commit_id === headSha) {
        state = "success";
        description = "Outside contribution approved by SpicyMarinara for the current commit.";
      }
    }
  } catch (error) {
    state = "error";
    description = "Owner approval evaluation failed unexpectedly; failing closed.";
    console.error(
      `Owner approval evaluation failed with status ${error?.status ?? "unknown"}; publishing error status.`,
    );
  }

  const maximumPublishAttempts = 3;
  for (let attempt = 1; ; attempt += 1) {
    if (await superseded()) return { skipped: true, superseded: true };
    try {
      await publishStatus();
      break;
    } catch (error) {
      if (attempt >= maximumPublishAttempts) throw error;
      console.warn(
        `Owner approval status publish attempt ${attempt} failed with status ${error?.status ?? "unknown"}; retrying.`,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  console.info(`${OWNER_APPROVAL_CONTEXT}: ${state} (${description})`);
  return { skipped: false, state, description, internal };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  evaluateOwnerApproval().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
