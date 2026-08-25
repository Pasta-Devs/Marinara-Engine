import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE_TAG_PATTERN =
  /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/u;

export function validateReleaseTag(tag, version) {
  const match = RELEASE_TAG_PATTERN.exec(tag);
  if (!match) throw new Error(`Release tag must use vX.Y.Z semantic-version format: ${tag || "(empty)"}`);
  if (match[1] !== version) throw new Error(`Release tag ${tag} must match package.json version ${version}`);
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  validateReleaseTag(process.argv[2] ?? "", packageJson.version);
  console.info(`Release tag ${process.argv[2]} matches package.json version ${packageJson.version}.`);
}
