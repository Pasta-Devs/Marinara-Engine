// The agents catalog serves rulesets (Capability API 1.374) and Experiences (1.373) as one plain JSON file
// each, never a package zip: a zip of either is refused before anything is downloaded, and a file is read
// by the same strict reader a player's import of it uses, held to the manifest the catalog lists.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-catalog-package-files-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

const { experienceFileParts } = await import("../../packages/shared/src/features/world/experience-file.js");
const { capabilityPackageManifestSchema } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");
const { capabilityPackageManager, installCatalogPackageForTests } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const ARTIFACTS = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts";

// ── A ruleset package: the ember-roads example, its first catalog in its own file ──
const example = JSON.parse(
  readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
const ruleset = structuredClone(example);
ruleset.id = "ember-roads-file";
const [first] = ruleset.catalogs as Array<Record<string, any>>;
const catalog = { schemaVersion: 1, catalog: first!.id, entries: first!.entries };
delete first!.entries;
first!.asset = `catalogs/${first!.id}.json`;
const rulesetFiles = [
  { path: "ruleset.json", data: Buffer.from(JSON.stringify(ruleset, null, 2)) },
  { path: `catalogs/${first!.id}.json`, data: Buffer.from(JSON.stringify(catalog)) },
];
function rulesetManifest(edit: Record<string, unknown> = {}) {
  return capabilityPackageManifestSchema.parse({
    schemaVersion: 2,
    id: "ember-roads-file",
    name: "Ember Roads (file)",
    version: "1.0.0",
    description: "",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: rulesetFiles.map((file) => file.path) } },
    files: rulesetFiles.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.length })),
    permissions: [],
    restartRequired: false,
    capabilityApi: { major: 1, minor: 374 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    ...edit,
  });
}
const entryFor = (manifest: ReturnType<typeof rulesetManifest>, url: string, bytes: Buffer) => ({
  manifest,
  artifact: { url, sha256: sha256(bytes), bytes: bytes.length },
});

/** A ruleset package file, as the Agents catalog build and the Engine's ruleset export write it. */
const rulesetFileParts = (manifest: unknown, files: Array<{ path: string; data: Buffer }>) => [
  JSON.stringify({
    format: "marinara-ruleset",
    version: 1,
    manifest,
    files: Object.fromEntries(files.map((file) => [file.path, file.data.toString("base64")])),
  }),
];

// ── Installed from its file, checked as a catalog zip's files were ──
{
  const bytes = Buffer.from(rulesetFileParts(rulesetManifest(), rulesetFiles).join(""));
  const installed = await installCatalogPackageForTests(
    entryFor(rulesetManifest(), `${ARTIFACTS}/ember-roads-file-1.0.0.ruleset.json`, bytes),
    async () => bytes,
  );
  assert.equal(installed.id, "ember-roads-file");
  assert.equal(installed.status, "active");
  const root = join(dataDir, "capability-packages", "versions", "ember-roads-file", "1.0.0");
  for (const file of rulesetFiles) assert.deepEqual(readFileSync(join(root, file.path)), file.data);
  assert.ok(existsSync(join(root, "manifest.json")));
  assert.ok((await capabilityPackageManager.installed()).some((item) => item.id === "ember-roads-file"));
}

// ── What the catalog side refuses ──
/** Refused with this reason; `downloads` says whether the refusal may come after the download. */
const refuse = async (
  entry: ReturnType<typeof entryFor>,
  bytes: Buffer,
  pattern: RegExp,
  message: string,
  downloads = true,
) => {
  let downloaded = false;
  await assert.rejects(
    installCatalogPackageForTests(entry, async () => {
      downloaded = true;
      return bytes;
    }),
    pattern,
    message,
  );
  if (!downloads) assert.equal(downloaded, false, `${message}: refused before anything is downloaded`);
};
{
  const next = rulesetManifest({ version: "1.1.0" });
  const bytes = Buffer.from(rulesetFileParts(next, rulesetFiles).join(""));
  await refuse(
    entryFor(next, `${ARTIFACTS}/ember-roads-file-1.1.0.zip`, bytes),
    bytes,
    /Ember Roads \(file\) is a ruleset packaged as a zip\. Rulesets install only from a \.ruleset\.json file\./,
    "A ruleset zip",
    false,
  );
  const old = rulesetManifest({ version: "1.1.0", capabilityApi: { major: 1, minor: 373 } });
  const oldBytes = Buffer.from(rulesetFileParts(old, rulesetFiles).join(""));
  await refuse(
    entryFor(old, `${ARTIFACTS}/ember-roads-file-1.1.0.ruleset.json`, oldBytes),
    oldBytes,
    /needs Capability API 1\.374 or newer/,
    "A ruleset file that older Engines would be offered",
    false,
  );
  // A file whose manifest is not the catalog's.
  const other = rulesetManifest({ version: "1.1.0", description: "Not the catalog's." });
  const otherBytes = Buffer.from(rulesetFileParts(other, rulesetFiles).join(""));
  await refuse(
    { ...entryFor(next, `${ARTIFACTS}/ember-roads-file-1.1.0.ruleset.json`, otherBytes) },
    otherBytes,
    /Artifact manifest does not match the catalog/,
    "Another manifest",
  );
  // A changed byte in a catalog file.
  const tampered = [rulesetFiles[0]!, { ...rulesetFiles[1]!, data: Buffer.from(JSON.stringify({ ...catalog, x: 1 })) }];
  const tamperedBytes = Buffer.from(rulesetFileParts(next, tampered).join(""));
  await refuse(
    entryFor(next, `${ARTIFACTS}/ember-roads-file-1.1.0.ruleset.json`, tamperedBytes),
    tamperedBytes,
    /ruleset package file does not read: manifest: catalogs\/[^ ]+ is not the file it lists/,
    "A changed catalog",
  );
  // Code in a ruleset file.
  const withCode = [...rulesetFiles, { path: "client.js", data: Buffer.from("alert(1)") }];
  const codeManifest = rulesetManifest({
    version: "1.1.0",
    files: withCode.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.length })),
  });
  const codeBytes = Buffer.from(rulesetFileParts(codeManifest, withCode).join(""));
  await refuse(
    entryFor(codeManifest, `${ARTIFACTS}/ember-roads-file-1.1.0.ruleset.json`, codeBytes),
    codeBytes,
    /"client\.js" is not a file a ruleset package has/,
    "Code",
  );
  // A zip handed over as a ruleset file.
  const zipBytes = Buffer.from("PK\u0003\u0004 not a ruleset file");
  await refuse(
    entryFor(next, `${ARTIFACTS}/ember-roads-file-1.1.0.ruleset.json`, zipBytes),
    zipBytes,
    /This is not a ruleset package file\./,
    "Zip bytes under a ruleset file's name",
  );
  // Nothing refused replaced what was installed.
  assert.equal(
    (await capabilityPackageManager.installed()).find((item) => item.id === "ember-roads-file")?.version,
    "1.0.0",
  );
}

// ── An Experience from the catalog: its file, never a zip ──
{
  const picture = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const files = [{ path: "art/dot.png", data: picture }];
  const manifest = capabilityPackageManifestSchema.parse({
    schemaVersion: 2,
    id: "catalog-experience",
    name: "Catalog Experience",
    version: "1.0.0",
    description: "",
    capabilityApi: { major: 1, minor: 373 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["experience"],
    entrypoints: {},
    contributions: { slots: ["game-surface"], gameSurface: { setup: {} }, assets: { paths: ["art/dot.png"] } },
    files: files.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.length })),
    permissions: [],
  });
  const bytes = Buffer.from(experienceFileParts(manifest, files).join(""));
  await refuse(
    entryFor(manifest, `${ARTIFACTS}/catalog-experience-1.0.0.zip`, bytes),
    bytes,
    /is an Experience packaged as a zip/,
    "An Experience zip",
    false,
  );
  const installed = await installCatalogPackageForTests(
    entryFor(manifest, `${ARTIFACTS}/catalog-experience-1.0.0.experience.json`, bytes),
    async () => bytes,
  );
  assert.equal(installed.id, "catalog-experience");
  assert.equal(installed.manifest.kind[0], "experience");
}

console.log("catalog-package-files: ok");
