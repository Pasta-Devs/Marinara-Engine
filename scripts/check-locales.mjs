import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCALES_DIR = join(ROOT, "packages", "client", "src", "localization", "locales");
const DEFAULT_LOCALE = "en";
const FANCY_LOCALE = "en-x-fancy";
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*(?:\.[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*)*$/u;

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
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${filename}: ${key} must contain non-empty text`);
    }
  }

  return { code, filename, messages };
}

// A literal key the client renders but English lacks shows up as the raw key text.
async function findMissingUsedKeys(keys) {
  const known = new Set(keys.map((key) => key.replace(/_(?:zero|one|two|few|many|other)$/u, "")));
  const clientSource = join(ROOT, "packages", "client", "src");
  const missing = [];
  for (const entry of await readdir(clientSource, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/u.test(entry.name)) continue;
    const file = join(entry.parentPath, entry.name);
    // Skip comment lines, which show example keys.
    const source = (await readFile(file, "utf8")).replace(/^\s*(?:\*|\/\/).*$/gmu, "");
    for (const [, key] of source.matchAll(/(?<![\w.$])(?:t|localizeUi)\(\s*["'`]([a-z]\w*(?:\.\w+)+)["'`]/gu)) {
      if (!known.has(key)) missing.push(`${relative(ROOT, file)}: ${key}`);
    }
  }
  return missing;
}

// Every searchable settings control names its label and description in English, and the keys must resolve to
// that same text, so the search registry cannot drift from what the Settings panel shows.
async function findRegistryKeyProblems(messages) {
  const source = await readFile(join(ROOT, "packages", "client", "src", "lib", "settings-registry.ts"), "utf8");
  const controls = source.slice(source.indexOf("export const SETTINGS_SEARCHABLE_CONTROLS"));
  // Prettier leaves a string single-quoted when it contains double quotes.
  const string = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;
  // One pass over the single-quoted body: keep escape sequences, unescape \', and escape bare double quotes.
  const parse = (literal) =>
    literal.startsWith("'")
      ? JSON.parse(
          `"${literal.slice(1, -1).replace(/\\(.)|"/gsu, (match, escaped) => (escaped === undefined ? '\\"' : escaped === "'" ? "'" : match))}"`,
        )
      : JSON.parse(literal);
  const entry = new RegExp(
    String.raw`\n    id: ([^\n]+),\n    sectionId: [^\n]+,\n    labelKey: ${string},\n    label:\s*${string},\n    description:\s*${string},\n    descriptionKey: ${string},`,
    "gu",
  );
  const problems = [];
  let found = 0;
  for (const [, id, labelKey, label, description, descriptionKey] of controls.matchAll(entry)) {
    found += 1;
    for (const [field, key, english] of [
      ["labelKey", parse(labelKey), parse(label)],
      ["descriptionKey", parse(descriptionKey), parse(description)],
    ]) {
      if (messages[key] === undefined) problems.push(`${id}: ${field} ${key} is not in en.json`);
      else if (messages[key] !== english)
        problems.push(`${id}: ${field} ${key} no longer matches the registry English`);
    }
  }
  const total = [...controls.matchAll(/\n    id: /gu)].length;
  if (found !== total) problems.push(`${total - found} settings-registry control(s) lack labelKey/descriptionKey`);
  return problems;
}

async function main() {
  // Community packs and their coverage/token validator live on docs-i18n/ui.
  const canonical = await readLocale(`${DEFAULT_LOCALE}.json`);
  const canonicalKeys = Object.keys(canonical.messages);
  if (canonicalKeys.length === 0) {
    throw new Error(`${canonical.filename}: canonical locale cannot be empty`);
  }

  for (const key of canonicalKeys) extractTokens(canonical.messages[key], `${canonical.filename}: ${key}`);

  // The bundled Fancy catalog is partial: it may only override existing English keys, with the same tokens.
  const fancy = await readLocale(`${FANCY_LOCALE}.json`);
  for (const [key, value] of Object.entries(fancy.messages)) {
    if (canonical.messages[key] === undefined) {
      throw new Error(`${fancy.filename}: ${key} is not a key in ${canonical.filename}`);
    }
    const english = extractTokens(canonical.messages[key], `${canonical.filename}: ${key}`);
    const override = extractTokens(value, `${fancy.filename}: ${key}`);
    if (JSON.stringify(override) !== JSON.stringify(english)) {
      throw new Error(`${fancy.filename}: ${key} must keep the interpolation and rich-text tokens of ${canonical.filename}`);
    }
  }

  const missing = await findMissingUsedKeys(canonicalKeys);
  if (missing.length > 0) {
    throw new Error(`keys used in the client are missing from ${canonical.filename}:\n${missing.join("\n")}`);
  }
  const registryProblems = await findRegistryKeyProblems(canonical.messages);
  if (registryProblems.length > 0) {
    throw new Error(
      `settings-registry.ts keys are out of sync with ${canonical.filename}:\n${registryProblems.join("\n")}`,
    );
  }
  console.info(`[localization] en: ${canonicalKeys.length} canonical keys`);
}

main().catch((error) => {
  console.error(`[localization] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
