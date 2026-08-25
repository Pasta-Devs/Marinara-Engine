import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateReleaseTag } from "../check-release-tag.mjs";

assert.equal(validateReleaseTag("v2.4.4", "2.4.4"), "2.4.4");
assert.equal(validateReleaseTag("v2.4.4-beta.1+build.7", "2.4.4-beta.1+build.7"), "2.4.4-beta.1+build.7");
assert.throws(() => validateReleaseTag("2.4.4", "2.4.4"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v2.4", "2.4.4"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v2.4.5", "2.4.4"), /must match package\.json version/u);

for (const [workflow, invocation] of [
  ["build-apk.yml", /node scripts\/check-release-tag\.mjs "\$tag"/u],
  ["build-container.yml", /node scripts\/check-release-tag\.mjs "\$\{\{ github\.ref_name \}\}"/u],
  ["build-container-lite.yml", /node scripts\/check-release-tag\.mjs "\$\{\{ github\.ref_name \}\}"/u],
  ["build-windows-installer.yml", /node scripts\/check-release-tag\.mjs "\$tag"/u],
  ["publish-github-release.yml", /node scripts\/check-release-tag\.mjs "\$TAG"/u],
]) {
  const source = readFileSync(new URL(`../../.github/workflows/${workflow}`, import.meta.url), "utf8");
  assert.match(source, invocation, `${workflow} must reject a tag that does not match package.json`);
}

console.info("Release tag/version regressions passed.");
