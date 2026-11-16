import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Every localizeUi("…") reference must resolve to a key in en.json.
//
// Nothing else catches this. check-locales validates sortedness and coverage counts, and
// localization:ui-check only audits static JSX for un-localized strings — neither notices a
// reference pointing at a key that does not exist, and TypeScript sees only a string literal.
// A dangling key renders as raw text in the UI.
//
// A rename that touches component code and locale JSON separately is exactly how these drift,
// which is how ten Noodle keys broke during the platform rename.

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const en = JSON.parse(
  readFileSync(join(repoRoot, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, unknown>;

// i18next resolves a plural call to suffixed catalog entries, so the base key itself is
// never present. Treat any key with a plural family as resolved.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const pluralBases = new Set(
  Object.keys(en).flatMap((key) => (PLURAL_SUFFIX.test(key) ? [key.replace(PLURAL_SUFFIX, "")] : [])),
);

const files = execFileSync("git", ["ls-files", "packages/client/src"], { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

const missing = new Map<string, string>(); // key -> "key  (file)" for the failure message
for (const file of files) {
  let source: string;
  try {
    source = readFileSync(join(repoRoot, file), "utf8");
  } catch {
    continue; // deleted-but-tracked during a rename
  }
  for (const match of source.matchAll(/localizeUi\(\s*"([^"]+)"/g)) {
    const key = match[1];
    if (!(key in en) && !pluralBases.has(key)) missing.set(key, `${key}  (${file})`);
  }
}

// A known-bad allowlist rather than a hard zero — the tree already carries pre-existing
// dangling keys unrelated to this check's purpose, which is to stop NEW ones. Named rather
// than counted so that fixing one key and breaking another cannot cancel out.
// Shrink this list when you fix one; never grow it.
const KNOWN_MISSING = new Set([
  // Genuinely dangling: no such key and no plural family in en.json.
]);

const unexpected = [...missing].filter(([key]) => !KNOWN_MISSING.has(key)).map(([, display]) => display);
assert.equal(
  unexpected.length,
  0,
  `${unexpected.length} localizeUi keys do not exist in en.json:\n${unexpected.join("\n")}`,
);

const fixed = [...KNOWN_MISSING].filter((key) => !missing.has(key));
assert.equal(fixed.length, 0, `These keys resolve now — remove them from KNOWN_MISSING:\n${fixed.join("\n")}`);

process.stdout.write(`Localization key-reference regression passed (${missing.size} known-missing, none new).\n`);
