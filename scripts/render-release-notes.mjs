import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const ANDROID_APK_NOTICE = `> [!IMPORTANT]
> **Android APK notice:** The APK is a Termux bootstrap + WebView shell, not a native Android server build. It opens an already-running local Marinara server, and on first launch it can download Termux from F-Droid, hand it to Android's installer, and start Marinara through Termux after Android permission prompts. Follow the [Android wrapper guide](https://github.com/Pasta-Devs/Marinara-Engine/blob/main/android/README.md) if Android blocks the bootstrap handoff.

`;

// GitHub rejects a release body over 125,000 characters; stay below it with room for the notice.
export const RELEASE_BODY_LIMIT = 120_000;

function parseArgs(args) {
  // pnpm 10 forwards a literal `--` separator into argv; skip any leading `--` entries.
  const filtered = args.filter((arg) => arg !== "--");
  const [version, ...rest] = filtered;
  if (!version) {
    throw new Error("Usage: node scripts/render-release-notes.mjs <version> [--output <path>]");
  }

  const outputFlagIndex = rest.findIndex((arg) => arg === "--output");
  const outputPath = outputFlagIndex === -1 ? null : rest[outputFlagIndex + 1];
  if (outputFlagIndex !== -1 && !outputPath) {
    throw new Error("Missing value for --output");
  }

  return {
    version: version.replace(/^v/, ""),
    outputPath: outputPath ? resolve(REPO_ROOT, outputPath) : null,
  };
}

function extractReleaseEntry(changelog, version) {
  // Accept both historical `## [X.Y.Z]` and newer `## vX.Y.Z` heading formats.
  const headingPatterns = [`## [${version}]`, `## v${version}`, `## ${version}`];
  let start = -1;
  let heading = "";
  for (const candidate of headingPatterns) {
    const idx = changelog.indexOf(candidate);
    if (idx !== -1) {
      start = idx;
      heading = candidate;
      break;
    }
  }
  if (start === -1) {
    throw new Error(`CHANGELOG.md does not contain an entry for ${version}`);
  }

  const afterHeading = changelog.slice(start + heading.length);
  // Next section may use either heading style.
  const nextSectionOffset = afterHeading.search(/\n## (\[|v?\d)/);
  const body = (nextSectionOffset === -1 ? afterHeading : afterHeading.slice(0, nextSectionOffset)).trim();

  if (!body) {
    throw new Error(`CHANGELOG.md entry for ${version} is empty`);
  }

  return body + "\n";
}

/**
 * The release body for a version: the Android notice plus its CHANGELOG entry. An entry too long for a GitHub
 * release is cut at the last whole bullet that fits and ends with a link to the full list at the tag.
 */
export function renderReleaseNotes(changelog, version, limit = RELEASE_BODY_LIMIT) {
  const notes = ANDROID_APK_NOTICE + extractReleaseEntry(changelog, version);
  if (notes.length <= limit) return notes;
  const bullets = notes.split(/\n(?=- )/);
  const footer = (omitted) =>
    `\n\n_…and ${omitted} more changes. The complete list is in [CHANGELOG.md](https://github.com/Pasta-Devs/Marinara-Engine/blob/v${version}/CHANGELOG.md)._\n`;
  let kept = bullets.length;
  let body = notes;
  while (kept > 1) {
    kept -= 1;
    // A section heading (and its intro line) left after the last kept bullet has nothing under it, so drop it.
    const keptText = bullets
      .slice(0, kept)
      .join("\n")
      .replace(/\n+#{1,6} [^\n]*(?:\n(?!- )[^\n]*)*$/u, "");
    body = keptText.trimEnd() + footer(bullets.length - kept);
    if (body.length <= limit) return body;
  }
  throw new Error(`Release notes for ${version} exceed ${limit} characters even without any entries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { version, outputPath } = parseArgs(process.argv.slice(2));
    const changelog = await readFile(resolve(REPO_ROOT, "CHANGELOG.md"), "utf8");
    const notes = renderReleaseNotes(changelog, version);

    if (outputPath) {
      await writeFile(outputPath, notes);
    } else {
      process.stdout.write(notes);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
