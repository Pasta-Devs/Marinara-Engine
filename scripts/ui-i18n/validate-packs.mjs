import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LOCALES_DIR = join(ROOT, "ui");
const canonicalPath = process.argv[2] && resolve(process.argv[2]);
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
    parsed = JSON.parse(await readFile(filename === "en.json" ? canonicalPath : join(LOCALES_DIR, filename), "utf8"));
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
  if (!canonicalPath) throw new Error("Usage: node scripts/ui-i18n/validate-packs.mjs <engine-checkout>/packages/client/src/localization/locales/en.json [--write-manifest]");
  const filenames = (await readdir(LOCALES_DIR))
    .filter((filename) => filename.endsWith(".json") && filename !== "manifest.json")
    .sort((left, right) => left.localeCompare(right, "en"));
  if (filenames.includes("en.json")) throw new Error("English stays canonical in Engine, not in ui/");
  const locales = await Promise.all(filenames.map(readLocale));
  const canonical = await readLocale("en.json");
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
      console.warn(`[localization] ${locale.code}: ${unknown.length} stale keys ignored by Engine: ${unknown.join(", ")}`);
    }

    for (const key of localeKeys) {
      if (!(key in canonical.messages)) continue;
      const expected = extractTokens(canonical.messages[key], `${canonical.filename}: ${key}`);
      const actual = extractTokens(locale.messages[key], `${locale.filename}: ${key}`);
      if (!sameTokens(expected, actual)) {
        throw new Error(`${locale.filename}: ${key} must preserve English interpolation and rich-text tokens`);
      }
    }

    const translated = localeKeys.length - unknown.length;
    const coverage = Math.round((translated / canonicalKeys.length) * 100);
    console.info(`[localization] ${locale.code}: ${translated}/${canonicalKeys.length} keys (${coverage}%), ${unknown.length} stale`);
  }

  // Preserve the reviewed wording regression alongside the pack that owns it.
  const korean = locales.find((locale) => locale.code === "ko")?.messages;
  if (korean && (korean["ui.lorebooks.lorebookeditor.es"] !== "" || korean["ui.noodle.stageprofileview.s"] !== "" ||
    korean["ui.lorebooks.lorebookentryrow.beforeCharacter"] !== "캐릭터 정의 전" ||
    korean["ui.lorebooks.lorebookentryrow.afterCharacter"] !== "캐릭터 정의 후" ||
    korean["ui.lorebooks.lorebookentryrow.beforeCompact"] !== "↑캐릭터" ||
    korean["ui.lorebooks.lorebookentryrow.afterCompact"] !== "↓캐릭터" ||
    !korean["ui.lorebooks.lorebookentryrow.positionInThePromptBeforeCharacterAfterCharacterOr"]?.includes("캐릭터 정의 전, 캐릭터 정의 후"))) {
    throw new Error("ko.json: reviewed lorebook placement/suffix regression");
  }
  const files = await Promise.all(filenames.map(async (path) => {
    const content = await readFile(join(LOCALES_DIR, path));
    return { path, sha256: createHash("sha256").update(content).digest("hex"), bytes: content.byteLength };
  }));
  const expectedManifest = JSON.stringify({ files }, null, 2) + "\n";
  const manifestPath = join(LOCALES_DIR, "manifest.json");
  if (process.argv.includes("--write-manifest")) await writeFile(manifestPath, expectedManifest);
  else if (await readFile(manifestPath, "utf8") !== expectedManifest) throw new Error("ui/manifest.json is stale; rerun with --write-manifest");
}

main().catch((error) => {
  console.error(`[localization] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
