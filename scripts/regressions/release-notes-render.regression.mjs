import assert from "node:assert/strict";
import { RELEASE_BODY_LIMIT, renderReleaseNotes } from "../render-release-notes.mjs";

const changelog = (entries) =>
  `# Changelog\n\n## [Unreleased]\n\n## [9.9.9]\n\n${entries.join("\n\n")}\n\n## [9.9.8]\n\n- Older entry.\n`;

// Short notes are unchanged: the Android notice plus the whole entry.
const short = renderReleaseNotes(changelog(["- First change.", "- Second change."]), "9.9.9");
assert.match(short, /Android APK notice/u);
assert.match(short, /- First change\.\n\n- Second change\.\n$/u);
assert.doesNotMatch(short, /more changes/u);
assert.doesNotMatch(short, /Older entry/u);

// A release too long for GitHub is cut at a whole bullet and links the full list at the tag.
const entries = Array.from(
  { length: 900 },
  (_, i) => `- Change ${i + 1}: ${"x".repeat(200)}\n  - detail line ${i + 1}`,
);
const long = renderReleaseNotes(changelog(entries), "9.9.9");
assert.ok(long.length <= RELEASE_BODY_LIMIT, `body is ${long.length} characters`);
assert.match(long, /^> \[!IMPORTANT\]/u);
assert.match(long, /- Change 1: x+\n  - detail line 1\n/u);
const kept = long.match(/^- Change \d+:/gmu).length;
assert.ok(kept > 100 && kept < 900);
assert.match(
  long,
  new RegExp(
    `_…and ${900 - kept} more changes\\. The complete list is in \\[CHANGELOG\\.md\\]\\(https://github\\.com/Pasta-Devs/Marinara-Engine/blob/v9\\.9\\.9/CHANGELOG\\.md\\)\\._\\n$`,
    "u",
  ),
);
// The last kept bullet is complete, including its nested detail line.
assert.match(long, new RegExp(`- Change ${kept}: x+\\n  - detail line ${kept}\\n\\n_…and`, "u"));

// A cut that lands just before a section does not leave that section's heading or intro line behind.
const firstSection = ["### First\n", ...Array.from({ length: 5 }, (_, i) => `- First ${i + 1}.`)];
const secondSection = ["### Second\n\nSecond's intro line.\n", `- Second 1: ${"y".repeat(5000)}`, "- Second 2."];
const firstOnly = renderReleaseNotes(changelog(firstSection), "9.9.9");
const cut = renderReleaseNotes(changelog([...firstSection, ...secondSection]), "9.9.9", firstOnly.length + 1000);
assert.match(cut, /### First\n\n\n- First 1\./u);
assert.match(cut, /- First 5\.\n\n_…and 2 more changes\./u);
assert.doesNotMatch(cut, /Second/u);

// The real changelog's newest release renders within the limit.
const { readFile } = await import("node:fs/promises");
const real = await readFile(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
// Every heading style the renderer accepts: "## [X.Y.Z]", "## vX.Y.Z" and "## X.Y.Z".
const heading = real.match(/^## (?:\[(\d+\.\d+\.\d+)\]|v?(\d+\.\d+\.\d+))$/mu);
assert.ok(heading, "No supported release heading found in CHANGELOG.md");
assert.ok(renderReleaseNotes(real, heading[1] ?? heading[2]).length <= RELEASE_BODY_LIMIT);

// A single entry too large for GitHub is left out too; the body keeps the notice and links the full list.
const oversized = renderReleaseNotes(changelog([`- ${"y".repeat(RELEASE_BODY_LIMIT)}`, "- Small."]), "9.9.9");
assert.ok(oversized.length <= RELEASE_BODY_LIMIT);
assert.match(oversized, /Android APK notice/u);
assert.doesNotMatch(oversized, /yyyy/u);
assert.match(oversized, /_…and 2 more changes\./u);

console.log("release-notes-render regression passed");
