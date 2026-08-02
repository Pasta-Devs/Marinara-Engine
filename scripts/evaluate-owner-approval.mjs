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
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "marinara-owner-approval-gate",
    },
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
      const latestOwnerReview = reviews
        .filter((review) => review.user?.login?.toLowerCase() === "spicymarinara")
        .sort((left, right) => left.id - right.id)
        .at(-1);

      if (latestOwnerReview?.state === "APPROVED" && latestOwnerReview.commit_id === headSha) {
        state = "success";
        description = "Outside contribution approved by SpicyMarinara for the current commit.";
      }
    }

    await publishStatus();
  } catch (error) {
    state = "error";
    description = "Owner approval evaluation failed unexpectedly; failing closed.";
    console.error(
      `Owner approval evaluation failed with status ${error?.status ?? "unknown"}; publishing error status.`,
    );
    await publishStatus();
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
