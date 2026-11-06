// ──────────────────────────────────────────────
// Ruleset package files (RM): a ruleset with its catalog files as one plain JSON file,
// `<name>.ruleset.json`, in place of a package zip. Nothing in it is compressed, so what it holds is never
// more than the file itself, and it carries no code: its manifest and its ruleset and catalog documents,
// each kept as its exact bytes (base64), named, sized and hashed in the manifest.
//
//   { "format": "marinara-ruleset", "version": 1,
//     "manifest": { …the package manifest, kind ["ruleset"]… },
//     "files": { "ruleset.json": "<base64>", "catalogs/<id>.json": "<base64>", … } }
// ──────────────────────────────────────────────

export const RULESET_PACKAGE_FILE_FORMAT = "marinara-ruleset";
export const RULESET_PACKAGE_FILE_VERSION = 1;
export const RULESET_PACKAGE_FILE_EXTENSION = ".ruleset.json";
/** The most a ruleset package file may be: its documents (16 MB at most, and up to 96 MB with its
 *  translations, 1.811) as base64, and its manifest. */
export const RULESET_PACKAGE_FILE_MAX_BYTES = 132 * 1024 * 1024;

/** Whether a parsed JSON document is a ruleset package file (as opposed to a ruleset on its own). */
export function isRulesetPackageFile(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { format?: unknown }).format === RULESET_PACKAGE_FILE_FORMAT
  );
}

/** Whether a parsed JSON document is a ruleset's language pack (1.811), `<id>-<version>.<lang>.json`: a
 *  translation naming its language, with the ruleset strings it translates. */
export function isRulesetLocalePackFile(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const file = value as { _meta?: { locale?: unknown }; ruleset?: unknown };
  return typeof file._meta?.locale === "string" && !!file.ruleset && typeof file.ruleset === "object";
}
