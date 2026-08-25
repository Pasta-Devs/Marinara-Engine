import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateReleaseTag } from "../check-release-tag.mjs";

assert.equal(validateReleaseTag("v2.4.4", "2.4.4"), "2.4.4");
assert.equal(validateReleaseTag("v2.4.4-beta.1+build.7", "2.4.4-beta.1+build.7"), "2.4.4-beta.1+build.7");
assert.equal(validateReleaseTag("v2.4.4+build.007", "2.4.4+build.007"), "2.4.4+build.007");
assert.throws(() => validateReleaseTag("2.4.4", "2.4.4"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v2.4", "2.4.4"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v01.2.3", "01.2.3"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v2.4.4-rc.01", "2.4.4-rc.01"), /must use vX\.Y\.Z/u);
assert.throws(() => validateReleaseTag("v2.4.5", "2.4.4"), /must match package\.json version/u);

for (const [workflow, invocation] of [
  ["build-apk.yml", /node scripts\/check-release-tag\.mjs "\$tag"/u],
  ["build-container.yml", /RELEASE_TAG: \$\{\{ github\.ref_name \}\}[\s\S]*check-release-tag\.mjs "\$RELEASE_TAG"/u],
  [
    "build-container-lite.yml",
    /RELEASE_TAG: \$\{\{ github\.ref_name \}\}[\s\S]*check-release-tag\.mjs "\$RELEASE_TAG"/u,
  ],
  [
    "build-windows-installer.yml",
    /RELEASE_TAG: \$\{\{ github\.event\.release\.tag_name \|\| github\.event\.inputs\.tag \|\| github\.ref_name \}\}[\s\S]*check-release-tag\.mjs "\$RELEASE_TAG"/u,
  ],
  [
    "publish-github-release.yml",
    /RELEASE_TAG: \$\{\{ github\.event\.inputs\.tag \|\| github\.ref_name \}\}[\s\S]*check-release-tag\.mjs "\$RELEASE_TAG"/u,
  ],
]) {
  const source = readFileSync(new URL(`../../.github/workflows/${workflow}`, import.meta.url), "utf8");
  assert.match(source, invocation, `${workflow} must reject a tag that does not match package.json`);
}

console.info("Release tag/version regressions passed.");
