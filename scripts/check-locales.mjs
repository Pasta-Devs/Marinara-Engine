import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES_DIR = join(ROOT, "packages", "client", "src", "localization", "locales");
const DEFAULT_LOCALE = "en";
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*(?:\.[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*)*$/u;
const INTENTIONALLY_EMPTY_TRANSLATION_KEYS = new Set([
  "ui.lorebooks.lorebookeditor.es",
  "ui.noodle.stageprofileview.s",
]);

function canonicalizeLocale(value) {
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null;
  } catch {
    return null;
  }
}

// Rich-text tags must be well-formed (balanced, properly nested) and use the
// same set of tags as English. Sibling order is intentionally not compared:
// i18next lets translations reorder <Trans> elements for grammar.
function extractTokens(value, context) {
  const interpolation = [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/gu)].map((match) => match[1]).sort();
  const richTextTags = [];
  const openTags = [];
  for (const match of value.matchAll(/<(\/?)([A-Za-z][\w-]*|\d+)((?:\s[^>]*?)?(\/?))>/gu)) {
    const [, closingMark, name, , selfClosingMark] = match;
    if (selfClosingMark === "/") {
      richTextTags.push(`${name}/`);
      continue;
    }
    if (closingMark === "/") {
      if (openTags.pop() !== name) {
        throw new Error(`${context}: rich-text markup is not balanced`);
      }
      continue;
    }
    openTags.push(name);
    richTextTags.push(name);
  }
  if (openTags.length > 0) {
    throw new Error(`${context}: rich-text markup is not balanced`);
  }
  richTextTags.sort();
  return { interpolation, richTextTags };
}

function sameTokens(left, right) {
  return (
    left.interpolation.join("\u0000") === right.interpolation.join("\u0000") &&
    left.richTextTags.join("\u0000") === right.richTextTags.join("\u0000")
  );
}

async function readLocale(filename) {
  const code = basename(filename, extname(filename));
  const canonicalCode = canonicalizeLocale(code);
  if (!canonicalCode || canonicalCode !== code) {
    throw new Error(`${filename}: filename must be a canonical BCP-47 locale`);
  }

  let parsed;
  try {
    parsed = JSON.parse(await readFile(join(LOCALES_DIR, filename), "utf8"));
  } catch (error) {
    throw new Error(`${filename}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filename}: root value must be an object`);
  }

  const metadata = parsed._meta;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${filename}: missing _meta object`);
  }
  if (metadata.locale !== code) {
    throw new Error(`${filename}: _meta.locale must equal ${code}`);
  }
  if (metadata.direction !== "ltr" && metadata.direction !== "rtl") {
    throw new Error(`${filename}: _meta.direction must be ltr or rtl`);
  }

  const messages = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "_meta"));
  const keys = Object.keys(messages);
  const sortedKeys = [...keys].sort((left, right) => left.localeCompare(right, "en"));
  if (keys.join("\u0000") !== sortedKeys.join("\u0000")) {
    throw new Error(`${filename}: translation keys must be sorted alphabetically`);
  }

  for (const [key, value] of Object.entries(messages)) {
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`${filename}: ${key} is not a semantic localization key`);
    }
    const intentionallyEmpty =
      value === "" && code !== DEFAULT_LOCALE && INTENTIONALLY_EMPTY_TRANSLATION_KEYS.has(key);
    if (typeof value !== "string" || (!value.trim() && !intentionallyEmpty)) {
      throw new Error(`${filename}: ${key} must contain non-empty text`);
    }
  }

  return { code, filename, messages };
}

async function main() {
  const filenames = (await readdir(LOCALES_DIR))
    .filter((filename) => filename.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "en"));
  const locales = await Promise.all(filenames.map(readLocale));
  const canonical = locales.find((locale) => locale.code === DEFAULT_LOCALE);
  if (!canonical) {
    throw new Error(`Missing canonical ${DEFAULT_LOCALE}.json locale`);
  }

  const canonicalKeys = Object.keys(canonical.messages);
  if (canonicalKeys.length === 0) {
    throw new Error(`${canonical.filename}: canonical locale cannot be empty`);
  }

  for (const locale of locales) {
    const localeKeys = Object.keys(locale.messages);
    const unknown = localeKeys.filter((key) => !(key in canonical.messages));
    if (unknown.length > 0) {
      throw new Error(`${locale.filename}: unknown keys: ${unknown.join(", ")}`);
    }

    for (const key of localeKeys) {
      const expected = extractTokens(canonical.messages[key], `${canonical.filename}: ${key}`);
      const actual = extractTokens(locale.messages[key], `${locale.filename}: ${key}`);
      if (!sameTokens(expected, actual)) {
        throw new Error(`${locale.filename}: ${key} must preserve English interpolation and rich-text tokens`);
      }
    }

    const coverage = Math.round((localeKeys.length / canonicalKeys.length) * 100);
    console.info(`[localization] ${locale.code}: ${localeKeys.length}/${canonicalKeys.length} keys (${coverage}%)`);
  }
}

main().catch((error) => {
  console.error(`[localization] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
