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

for (const { workflow, validationStep, tagSource, invocation, artifactStep } of [
  {
    workflow: "build-apk.yml",
    validationStep: "Resolve release tag",
    tagSource:
      /EVENT_NAME: \$\{\{ github\.event_name \}\}[\s\S]*INPUT_TAG: \$\{\{ github\.event\.inputs\.tag \|\| '' \}\}[\s\S]*RELEASE_TAG: \$\{\{ github\.event\.release\.tag_name \|\| '' \}\}[\s\S]*REF_NAME: \$\{\{ github\.ref_name \}\}/u,
    invocation: /node scripts\/check-release-tag\.mjs "\$tag"/u,
    artifactStep: "Build release APK",
  },
  {
    workflow: "build-container.yml",
    validationStep: "Verify release tag",
    tagSource: /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/u,
    invocation: /node scripts\/check-release-tag\.mjs "\$RELEASE_TAG"/u,
    artifactStep: "Build and push by digest",
  },
  {
    workflow: "build-container-lite.yml",
    validationStep: "Verify release tag",
    tagSource: /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/u,
    invocation: /node scripts\/check-release-tag\.mjs "\$RELEASE_TAG"/u,
    artifactStep: "Build and push by digest",
  },
  {
    workflow: "build-windows-installer.yml",
    validationStep: "Resolve release tag",
    tagSource:
      /RELEASE_TAG: \$\{\{ github\.event\.release\.tag_name \|\| github\.event\.inputs\.tag \|\| github\.ref_name \}\}/u,
    invocation: /node scripts\/check-release-tag\.mjs "\$RELEASE_TAG"/u,
    artifactStep: "Build installer",
  },
  {
    workflow: "publish-github-release.yml",
    validationStep: "Resolve release tag",
    tagSource: /RELEASE_TAG: \$\{\{ github\.event\.inputs\.tag \|\| github\.ref_name \}\}/u,
    invocation: /node scripts\/check-release-tag\.mjs "\$RELEASE_TAG"/u,
    artifactStep: "Build named source archive",
  },
]) {
  const source = readFileSync(new URL(`../../.github/workflows/${workflow}`, import.meta.url), "utf8");
  const validationMarker = `      - name: ${validationStep}\n`;
  const validationStart = source.indexOf(validationMarker);
  assert.notEqual(validationStart, -1, `${workflow} must contain its ${validationStep} step`);
  const validationEnd = source.indexOf("\n      - name:", validationStart + validationMarker.length);
  const validationSource = source.slice(validationStart, validationEnd === -1 ? undefined : validationEnd);
  assert.match(validationSource, tagSource, `${workflow} must pass the tag through the validation step environment`);
  assert.match(validationSource, invocation, `${workflow} must reject a tag that does not match package.json`);
  assert.ok(
    validationStart < source.indexOf(`      - name: ${artifactStep}\n`),
    `${workflow} must validate the tag before ${artifactStep}`,
  );
}

console.info("Release tag/version regressions passed.");
