// The container build records its branch and commit: both Dockerfiles take BUILD_BRANCH and BUILD_COMMIT and write
// them into the build metadata, after the dependency install so the cache holds, and the container workflows pass
// the branch.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
for (const dockerfile of ["Dockerfile", "Dockerfile.lite"]) {
  const dockerSource = readFileSync(join(REPOSITORY_ROOT, dockerfile), "utf8");
  assert.match(dockerSource, /^ARG BUILD_BRANCH$/mu, `${dockerfile} must accept the source ref as build metadata`);
  assert.match(dockerSource, /meta\.branch = process\.env\.BUILD_BRANCH/u);
}
{
  // The client bundle reads BUILD_COMMIT during `pnpm build`; the ARG must precede it but follow the dependency
  // install, since a per-commit ARG invalidates every later layer.
  const dockerSource = readFileSync(join(REPOSITORY_ROOT, "Dockerfile"), "utf8");
  const installAt = dockerSource.indexOf("pnpm install --frozen-lockfile");
  const argAt = dockerSource.search(/^ARG BUILD_COMMIT$/mu);
  const buildAt = dockerSource.search(/^RUN pnpm build$/mu);
  assert.ok(
    installAt >= 0 && installAt < argAt && argAt < buildAt,
    "Dockerfile must declare ARG BUILD_COMMIT between the dependency install and `pnpm build`",
  );
}
for (const workflow of ["build-container.yml", "build-container-lite.yml"]) {
  const workflowSource = readFileSync(join(REPOSITORY_ROOT, ".github/workflows", workflow), "utf8");
  assert.match(workflowSource, /BUILD_BRANCH=\$\{\{ github\.ref_name \}\}/u);
}
