// ──────────────────────────────────────────────
// A ruleset package file, read (RM): the one reader the import, the check and the ruleset editor's open
// share. A ruleset package is one plain JSON file, `<name>.ruleset.json` (see the shared package-file
// module): its manifest, and its ruleset.json and catalogs/<id>.json documents, each as its exact bytes in
// base64. There is no archive to open and nothing compressed, so nothing in it is ever larger than the
// file itself. It is read in memory and never written anywhere: what comes out is the text of its
// manifest, its ruleset, its catalogs and its translations (1.811), each read through the strict schemas,
// or the reasons it was refused. Nothing else in a file is accepted, and nothing in one is ever run, served or loaded as code:
// a ruleset is data.
//
// The file is held to what a ruleset package is:
//   - exactly its four keys (format, version, manifest, files), of the one format and version;
//   - at most its few documents, named exactly as a ruleset package names them, each capped by its kind
//     before a byte of it is decoded, and each strict base64 that decodes back to itself;
//   - each document the one the manifest lists, by its size and its sha256.
// What comes out is each document as it was parsed (`JSON.stringify` of what was read), so a repeated
// key, a byte-order mark or padding in a file never reaches the store.
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import {
  capabilityPackageManifestSchema,
  isRulesetCatalogAssetPath,
  readRulesetLocaleFile,
  rulesetLocaleOfAssetPath,
  RULESET_LOCALE_MAX_BYTES,
  RULESET_LOCALE_MAX_FILES,
  parseRulesetCatalogFile,
  rulesetHangsOnRowIssues,
  rulesetCatalogEntryIssues,
  type RulesetCatalogEntriesById,
  parseRulesetDefinition,
  rulesetShapeIssue,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_MAX_BYTES,
  RULESET_PACKAGE_FILE_FORMAT,
  RULESET_PACKAGE_FILE_VERSION,
  type RulesetDefinition,
} from "@marinara-engine/shared";

/** Its ruleset, at most 12 catalogs (a ruleset declares no more) and its translations (1.811). */
const MAX_FILES = 13 + RULESET_LOCALE_MAX_FILES;
const MANIFEST_MAX_BYTES = 64 * 1024;
/** The ruleset and its catalogs within 16 MB, as before translations, and room for a translation into
 *  every language the Engine speaks. */
const TOTAL_MAX_BYTES = 96 * 1024 * 1024;
// Past the longest note in any ruleset the project ships (5e-2014 has one of 1,016 characters).
const COMMENT_MAX_CHARS = 2000;
/** The `$schema` an author may point at: the Engine's own published schema. */
const OWN_SCHEMA =
  /^https:\/\/raw\.githubusercontent\.com\/Pasta-Devs\/Marinara-Engine\/(?:main|staging)\/docs\/extending\/ruleset\.schema\.json$/;

export type RulesetPackageRead =
  | {
      ok: true;
      definition: RulesetDefinition;
      /** Each document as it was read (re-serialized: no repeated keys, padding or byte-order mark). */
      ruleset: string;
      catalogs: Record<string, string>;
      /** Its translations (1.811), by language: the JSON of the strings each translates, English to it. */
      locales: Record<string, string>;
      manifest: string;
    }
  | { ok: false; issues: string[] };

const refused = (...issues: string[]): RulesetPackageRead => ({ ok: false, issues });
const sha256Of = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** The cap on a file's size, by its name; null for a name a ruleset package does not have. */
function capOf(name: string): number | null {
  if (name === "ruleset.json") return RULESET_MAX_BYTES;
  if (rulesetLocaleOfAssetPath(name)) return RULESET_LOCALE_MAX_BYTES;
  return isRulesetCatalogAssetPath(name) ? RULESET_CATALOG_MAX_BYTES : null;
}

/** Why a document carries more than a ruleset: a long `$comment` anywhere, a `$schema` not the Engine's. */
function extraContent(document: unknown, file: string): string | null {
  // Each issue names where it is, as a schema issue does, so an editor shows it there.
  const walk = (value: unknown, path: string): string | null => {
    const at = (key: string | number) => (path ? `${path}.${key}` : String(key));
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const issue = walk(item, at(index));
        if (issue) return issue;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;
    for (const [key, item] of Object.entries(value)) {
      if (key === "$comment" && (typeof item !== "string" || item.length > COMMENT_MAX_CHARS)) {
        return `${file} ${at(key)}: a $comment is a note of at most ${COMMENT_MAX_CHARS} characters`;
      }
      if (key === "$schema" && (path || typeof item !== "string" || !OWN_SCHEMA.test(item))) {
        return `${file} ${at(key)}: $schema may only name the Engine's own ruleset schema`;
      }
      const issue = walk(item, at(key));
      if (issue) return issue;
    }
    return null;
  };
  return walk(document, "");
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** A ruleset package file (the parsed JSON of a `.ruleset.json`), read and checked whole; nothing in it
 *  is kept unless all of it reads. Never throws: anything unexpected is a package that does not read. */
export function readRulesetPackageFile(value: unknown): RulesetPackageRead {
  try {
    return readPackage(value);
  } catch {
    return refused("The package does not read");
  }
}

function readPackage(value: unknown): RulesetPackageRead {
  // ── The file itself: its four keys, of the one format and version ──
  if (!isRecord(value) || value.format !== RULESET_PACKAGE_FILE_FORMAT) {
    return refused(`The file is not a ruleset package (its "format" is not "${RULESET_PACKAGE_FILE_FORMAT}")`);
  }
  if (value.version !== RULESET_PACKAGE_FILE_VERSION) {
    return refused(
      `The package is of version ${String(value.version)}; this Engine reads version ${RULESET_PACKAGE_FILE_VERSION}`,
    );
  }
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["files", "format", "manifest", "version"])) {
    return refused("A ruleset package holds its format, version, manifest and files, and nothing else");
  }
  const { files: encoded } = value;
  if (!isRecord(encoded)) return refused("The package's files are not a list of named documents");
  const names = Object.keys(encoded);
  if (names.length > MAX_FILES) {
    return refused(`The package has ${names.length} files; a ruleset package has at most ${MAX_FILES}`);
  }

  // ── Every file, by its name and its size, before any is decoded ──
  // Names are matched exactly, and a ruleset package's names are lower case: none can stand twice.
  const issues: string[] = [];
  let total = 0;
  for (const name of names) {
    const cap = capOf(name);
    if (cap === null) {
      issues.push(
        `"${name}" is not a file a ruleset package has (ruleset.json, catalogs/<id>.json, locales/<language>.json)`,
      );
      continue;
    }
    const text = encoded[name];
    if (typeof text !== "string" || !BASE64.test(text)) {
      issues.push(`"${name}" is not base64`);
      continue;
    }
    const size = (text.length / 4) * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0);
    if (size > cap) issues.push(`"${name}" is over its ${cap}-byte limit`);
    total += size;
  }
  if (total > TOTAL_MAX_BYTES) issues.push(`The package holds over ${TOTAL_MAX_BYTES} bytes`);
  if (issues.length) return refused(...issues.slice(0, 20));

  // ── Each file, decoded, as UTF-8 ──
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const texts = new Map<string, { text: string; data: Buffer }>();
  for (const name of names) {
    const data = Buffer.from(encoded[name] as string, "base64");
    if (data.toString("base64") !== encoded[name]) return refused(`"${name}" is not base64`);
    try {
      texts.set(name, { text: decoder.decode(data), data });
    } catch {
      return refused(`"${name}" is not UTF-8 text`);
    }
  }

  // ── The manifest: its own key, held to its size and shape before anything walks it ──
  const manifestShape = rulesetShapeIssue(value.manifest);
  if (manifestShape) return refused(`manifest ${manifestShape}`);
  const manifestText = JSON.stringify(value.manifest ?? null);
  if (Buffer.byteLength(manifestText) > MANIFEST_MAX_BYTES) {
    return refused(`The manifest is over its ${MANIFEST_MAX_BYTES}-byte limit`);
  }

  // ── The documents ──
  const json = (name: string): { value: unknown } | { issue: string } => {
    const file = texts.get(name);
    if (!file) return { issue: `The package has no ${name}` };
    let document: unknown;
    try {
      document = JSON.parse(file.text);
    } catch {
      return { issue: `${name} is not valid JSON` };
    }
    // Its shape before anything walks it: no nesting or list beyond what a ruleset ever has.
    const shape = rulesetShapeIssue(document);
    return shape ? { issue: `${name} ${shape}` } : { value: document };
  };
  const manifestRead = capabilityPackageManifestSchema.safeParse(value.manifest);
  if (!manifestRead.success) {
    return refused(
      ...manifestRead.error.issues
        .slice(0, 5)
        .map((issue) => `manifest ${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }
  const manifest = manifestRead.data;
  const { kind, entrypoints, permissions, localizations, restartRequired, contributions } = manifest;
  // A ruleset package and nothing else: no code to run, nothing to grant, nothing on screen.
  if (kind.length !== 1 || kind[0] !== "ruleset")
    issues.push("manifest: a ruleset package is of the kind ruleset alone");
  if (Object.keys(entrypoints).length) issues.push("manifest: a ruleset package has no entrypoints (no code)");
  if (permissions.length) issues.push("manifest: a ruleset package asks for no permissions");
  if (localizations) issues.push("manifest: a ruleset package has no localizations");
  if (restartRequired) issues.push("manifest: a ruleset package needs no restart");
  const contributionKeys = Object.keys(contributions ?? {});
  if (contributionKeys.length !== 1 || contributionKeys[0] !== "assets") {
    issues.push("manifest: a ruleset package contributes its assets and nothing else");
  }
  const contents = [...texts.keys()].sort();
  const assets = [...(contributions?.assets?.paths ?? [])].sort();
  if (JSON.stringify(assets) !== JSON.stringify(contents)) {
    issues.push("manifest: its assets are not the package's ruleset and catalog files");
  }
  // Both sorted the same way, by code unit (a locale's order puts "_" before "." and before digits).
  const declared = [...manifest.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (JSON.stringify(declared.map((file) => file.path)) !== JSON.stringify(contents)) {
    issues.push("manifest: its files are not the package's ruleset and catalog files");
  } else {
    for (const file of declared) {
      const data = texts.get(file.path)!.data;
      if (data.length !== file.bytes || sha256Of(data) !== file.sha256)
        issues.push(`manifest: ${file.path} is not the file it lists`);
    }
  }
  if (issues.length) return refused(...issues);

  const rulesetJson = json("ruleset.json");
  if ("issue" in rulesetJson) return refused(rulesetJson.issue);
  const extra = extraContent(rulesetJson.value, "ruleset.json");
  if (extra) return refused(extra);
  const parsed = parseRulesetDefinition(rulesetJson.value);
  if (!parsed.ok) return refused(...parsed.issues.map((issue) => `ruleset.json ${issue}`));
  const definition = parsed.definition;

  // Its catalog files, exactly the ones the ruleset names.
  const catalogs: Record<string, string> = {};
  const entriesById: RulesetCatalogEntriesById = {};
  const named = (definition.catalogs ?? []).filter((catalog) => catalog.asset);
  for (const catalog of named) {
    const file = catalog.asset!;
    const document = json(file);
    if ("issue" in document) return refused(`${document.issue} (the catalog "${catalog.id}")`);
    const extraInCatalog = extraContent(document.value, file);
    if (extraInCatalog) return refused(extraInCatalog);
    const read = parseRulesetCatalogFile(definition, catalog.id, document.value);
    if (!read.ok) return refused(...read.issues.slice(0, 10).map((issue) => `${file} ${issue}`));
    catalogs[catalog.id] = JSON.stringify(document.value);
    entriesById[catalog.id] = read.entries;
  }
  const complete = {
    ...definition,
    catalogs: definition.catalogs?.map((catalog) => ({
      ...catalog,
      entries: [...(entriesById[catalog.id] ?? catalog.entries ?? [])],
    })),
  };
  // The pools hang-ons name off list rows, now every catalog's rows are here (1.405).
  const rowIssues = rulesetHangsOnRowIssues(complete);
  if (rowIssues.length) return refused(...rowIssues.slice(0, 10).map((issue) => `ruleset.json ${issue}`));
  for (const catalog of complete.catalogs ?? []) {
    // What names entries of other catalogs: a creature's spells, an entry's amends (1.302), the
    // weapons it conjures (1.306).
    if (
      !catalog.entries?.some(
        (entry) => entry.creature?.spellcasting || entry.mechanics?.amends || entry.mechanics?.conjures,
      )
    )
      continue;
    const issues = rulesetCatalogEntryIssues(complete, catalog, catalog.entries ?? []);
    if (issues.length)
      return refused(...issues.slice(0, 10).map((issue) => `${catalog.id} ${issue.path.join(".")}: ${issue.message}`));
  }
  const unnamed = contents.filter(
    (name) =>
      name !== "ruleset.json" && !rulesetLocaleOfAssetPath(name) && !named.some((catalog) => catalog.asset === name),
  );
  if (unnamed.length) return refused(`${unnamed[0]} is not a catalog the ruleset names`);

  // Its translations (1.811), each the strings it translates and nothing else: display only, never read
  // by a rule.
  const locales: Record<string, string> = {};
  for (const name of contents) {
    const locale = rulesetLocaleOfAssetPath(name);
    if (!locale) continue;
    let document: unknown;
    try {
      document = JSON.parse(texts.get(name)!.text);
    } catch {
      return refused(`${name} is not valid JSON`);
    }
    const read = readRulesetLocaleFile(document, locale);
    if (!read.ok) return refused(read.issue);
    // One that translates nothing (a package's own English listing) is not kept.
    if (Object.keys(read.strings).length) locales[locale] = JSON.stringify(read.strings);
  }

  return {
    ok: true,
    definition,
    ruleset: JSON.stringify(rulesetJson.value),
    catalogs,
    locales,
    manifest: manifestText,
  };
}
