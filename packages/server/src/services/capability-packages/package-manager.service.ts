import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  statfs,
  writeFile,
  type FileHandle,
} from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { z } from "zod";
import {
  APP_VERSION,
  containsDecisionStatements,
  parseCapabilityCatalogWithCompat,
  capabilityPackageManifestSchema,
  compareCapabilityPackageVersions,
  getCapabilityApiCompatibilityIssue,
  GM_VERB_TABLE_ASSET_PATH,
  GM_VERB_TABLE_MAX_BYTES,
  RULESET_ASSET_PATH,
  RULESET_CATALOG_EARLIER_MAX_BYTES,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_EARLIER_MAX_BYTES,
  RULESET_LOCALE_MAX_BYTES,
  readRulesetLocaleFile,
  isRulesetLocaleCode,
  rulesetLocalePackFileName,
  rulesetTranslationLanguages,
  RULESET_MAX_BYTES,
  rulesetCatalogAssetPath,
  isRulesetCatalogAssetPath,
  isRulesetLocaleAssetPath,
  isInstalledCapabilityReady,
  installedCapabilityRegistrySchema,
  installedCapabilityPackageSchema,
  packagedAgentDefinitionsSchema,
  capabilityReleaseNotesSchema,
  capabilityStoreEntrySchema,
  capabilityStoreKitSchema,
  type CapabilityStoreListing,
  type CapabilityStoreKit,
  type CapabilityCatalog,
  type CapabilityCatalogPackage,
  type StampedCapabilityCatalog,
  type StampedCapabilityCatalogPackage,
  type PackagedAgentDefinition,
  type CapabilityPackageUpdate,
  type CapabilityPackageVersionNote,
  type CapabilityReleaseNotes,
  type InstalledCapabilityPackage,
  rulesetFakeIssue,
  parseRulesetDefinition,
  RULESET_DERIVED_MAX_BEFORE_179,
  RULESET_DERIVED_MAX_BEFORE_183,
  RULESET_DERIVED_MAX_BEFORE_1106,
  RULESET_DERIVED_MAX_BEFORE_1676,
  RULESET_COMBAT_SENSES_MAX_BEFORE_1690,
  RULESET_FIELDS_MAX_BEFORE_1203,
  RULESET_BUILDER_STEPS_MAX_BEFORE_1107,
  RULESET_BUILDER_STEPS_MAX_BEFORE_1715,
  RULESET_BUILDER_CATALOG_PICKS_MAX_BEFORE_1715,
  RULESET_COMBAT_MODIFIER_TARGETS,
  type RulesetCatalogItem,
} from "@marinara-engine/shared";
import {
  CREATURE_PACK_MAX_BYTES,
  EXPERIENCE_FILE_EXTENSION,
  RULESET_PACKAGE_FILE_EXTENSION,
  RULESET_PACKAGE_FILE_MAX_BYTES,
  ExperienceFileError,
  ExperienceFileReader,
  readExperienceFileManifest,
  WORLD_SHARE_FILE_MAX_BYTES,
  type CapabilityPackageManifest,
  type ExperienceFileEvent,
  type ExperienceMusic,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";
import { sanitizeExperienceAsset } from "./experience-asset-sanitizer.js";
import { readRulesetPackageFile } from "../game/ruleset-package-file.js";
import { logger } from "../../lib/logger.js";
import { openZipArchive, type ZipArchive, type ZipEntry, type ZipEntryBudget } from "../../lib/zip-reader.js";
import { getBuildBranch } from "../../config/build-info.js";
import { sidecarSpeechService } from "../sidecar/sidecar-speech.service.js";

const ROOT = join(DATA_DIR, "capability-packages");
const VERSIONS = join(ROOT, "versions");
const REGISTRY = join(ROOT, "installed.json");
const UPDATE_DECISIONS = join(ROOT, "update-decisions-v1.json");
const AVAILABILITY_MIGRATION = join(ROOT, "availability-migration-v1.json");
const NOODLE_EXTRACTION_MIGRATION = join(ROOT, "noodle-extraction-migration-v1.json");
const HIERARCHICAL_MAPS_SELECTION_CORRECTION = join(ROOT, "hierarchical-maps-selection-correction-v1.json");
const NON_DOWNLOADABLE_CORE_PACKAGE_IDS = new Set(["about-me-keeper"]);
const OFFICIAL_AGENT_RAW_ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents";
type OfficialAgentBranch = "main" | "staging";

function isCanonicalSemverIdentifier(value: string, numericLeadingZeroAllowed: boolean): boolean {
  if (!value) return false;
  let numeric = true;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const digit = code >= 48 && code <= 57;
    const letter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (!digit && !letter && code !== 45) return false;
    if (!digit) numeric = false;
  }
  return numericLeadingZeroAllowed || !numeric || value === "0" || value.charCodeAt(0) !== 48;
}

function isCanonicalSemver(value: string): boolean {
  const buildSeparator = value.indexOf("+");
  if (buildSeparator !== -1 && value.indexOf("+", buildSeparator + 1) !== -1) return false;
  const withoutBuild = buildSeparator === -1 ? value : value.slice(0, buildSeparator);
  const build = buildSeparator === -1 ? "" : value.slice(buildSeparator + 1);
  if (buildSeparator !== -1 && !build.split(".").every((part) => isCanonicalSemverIdentifier(part, true))) {
    return false;
  }

  const prereleaseSeparator = withoutBuild.indexOf("-");
  const core = prereleaseSeparator === -1 ? withoutBuild : withoutBuild.slice(0, prereleaseSeparator);
  const prerelease = prereleaseSeparator === -1 ? "" : withoutBuild.slice(prereleaseSeparator + 1);
  if (prereleaseSeparator !== -1 && !prerelease.split(".").every((part) => isCanonicalSemverIdentifier(part, false))) {
    return false;
  }

  const coreParts = core.split(".");
  return (
    coreParts.length === 3 &&
    coreParts.every((part) => {
      if (!part || (part.length > 1 && part.charCodeAt(0) === 48)) return false;
      for (let index = 0; index < part.length; index += 1) {
        const code = part.charCodeAt(index);
        if (code < 48 || code > 57) return false;
      }
      return true;
    })
  );
}

function isEngineReleaseTagRef(value: string): boolean {
  const tag = value.startsWith("refs/tags/") ? value.slice("refs/tags/".length) : value;
  return tag.startsWith("v") && isCanonicalSemver(tag.slice(1));
}

export function resolveOfficialAgentBranch(engineBranch: string | null = getBuildBranch()): OfficialAgentBranch {
  if (
    !engineBranch ||
    engineBranch === "main" ||
    engineBranch.startsWith("hotfix/") ||
    isEngineReleaseTagRef(engineBranch)
  ) {
    return "main";
  }
  return "staging";
}
function officialCatalogRoot(branch: OfficialAgentBranch): string {
  return `${OFFICIAL_AGENT_RAW_ROOT}/${branch}/catalog`;
}
function officialArtifactRoot(branch: OfficialAgentBranch): string {
  return `${OFFICIAL_AGENT_RAW_ROOT}/${branch}/artifacts`;
}
function officialArtworkRoot(branch: OfficialAgentBranch): string {
  return `${OFFICIAL_AGENT_RAW_ROOT}/${branch}/artwork/agent-covers`;
}
function isOfficialCatalogUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "raw.githubusercontent.com" &&
      /^\/Pasta-Devs\/Marinara-Agents\/(?:main|staging)\/catalog(?:\/|$)/u.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
const ENGINE_RELEASE_VERSION_PATTERN = /^v?(\d+)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
export function resolveCapabilityCatalogUrl(
  engineVersion: string = APP_VERSION,
  configuredUrl: string | undefined = process.env.MARINARA_AGENT_CATALOG_URL,
  branch: OfficialAgentBranch = resolveOfficialAgentBranch(),
): string {
  const override = configuredUrl?.trim();
  if (override) return override;
  const match = ENGINE_RELEASE_VERSION_PATTERN.exec(engineVersion.trim());
  const catalogRoot = officialCatalogRoot(branch);
  return match ? `${catalogRoot}/v${Number(match[1])}/catalog.json` : `${catalogRoot}/catalog.json`;
}
const CATALOG_URL = resolveCapabilityCatalogUrl();

// Packages the catalog repo marks staging-only are cut from the published lanes
// and emitted into an overlay under catalog/preview/ instead (Marinara-Agents
// scripts/catalog-incomplete.mjs). Promotion copies staging to main verbatim, so
// that overlay EXISTS on main and serves 200 there — nothing on the catalog side
// hides it. The only thing keeping an unreleased package away from a stable user
// is this Engine declining to build the URL.
const PREVIEW_CATALOG_SEGMENT = "preview";

/** Whether this Engine may read the staging preview overlay.
 *
 *  Deliberately NOT `resolveOfficialAgentBranch() === "staging"`. That helper is
 *  deny-list shaped — anything that is not `main`, `hotfix/*`, or a release tag
 *  resolves to "staging" — so a checkout on a branch named `master` (which the
 *  launchers themselves treat as a mainline name) would qualify. Being wrong
 *  there merely hands someone a slightly newer package list; being wrong HERE
 *  shows unreleased packages to a stable user, so this gate takes an exact
 *  opt-in. Detached checkouts report no branch and are excluded, which costs a
 *  detached staging tester their preview — the fail-hidden direction, and the
 *  same way those checkouts already resolve for the published catalog. */
export function isPreviewCatalogChannel(engineBranch: string | null = getBuildBranch()): boolean {
  return engineBranch === "staging";
}

/** URL of the staging preview overlay, or null when this Engine must not read one.
 *
 *  Returns null rather than a URL for callers to filter later, so a stable Engine
 *  never holds a preview URL at all and no later code path can fetch one by
 *  mistake. Mirrors resolveCapabilityCatalogUrl's lane derivation, including its
 *  fallback to the legacy alias for a non-release version string. */
export function resolvePreviewCatalogUrl(
  engineVersion: string = APP_VERSION,
  configuredUrl: string | undefined = process.env.MARINARA_AGENT_CATALOG_URL,
  previewChannel: boolean = isPreviewCatalogChannel(),
): string | null {
  // An explicit override IS the whole catalog. Synthesising a preview sibling for
  // someone's local or forked catalog would fetch a URL they never pointed us at.
  if (configuredUrl?.trim()) return null;
  if (!previewChannel) return null;
  // Only ever the staging branch: isPreviewCatalogChannel already required it.
  const previewRoot = `${officialCatalogRoot("staging")}/${PREVIEW_CATALOG_SEGMENT}`;
  const match = ENGINE_RELEASE_VERSION_PATTERN.exec(engineVersion.trim());
  return match ? `${previewRoot}/v${Number(match[1])}/catalog.json` : `${previewRoot}/catalog.json`;
}

/** URL of the release-notes sidecar for a catalog, or null when none can be derived.
 *
 *  Release notes are published as `notes.json` beside the `catalog.json` they
 *  describe, in every lane and in the preview overlay. Deriving the sibling keeps
 *  this working for the official lanes, a fork, and a local file server without a
 *  second environment variable.
 *
 *  A configured catalog URL that does not end in `/catalog.json` yields null rather
 *  than a guess. Appending `notes.json` to an arbitrary operator-supplied path would
 *  fetch a URL nobody pointed us at. */
export function resolveCapabilityReleaseNotesUrl(catalogUrl: string | null, sidecar = "notes.json"): string | null {
  if (!catalogUrl) return null;
  const trimmed = catalogUrl.trim();
  if (!trimmed.endsWith("/catalog.json")) return null;
  return `${trimmed.slice(0, -"catalog.json".length)}${sidecar}`;
}

const RELEASE_NOTES_URL = resolveCapabilityReleaseNotesUrl(CATALOG_URL);
const RELEASE_NOTES_TTL_MS = 5 * 60 * 1000;
/** The Agent Organizer's store data: same sidecar rules, same lifetime as the notes. */
const STORE_URL = resolveCapabilityReleaseNotesUrl(CATALOG_URL, "store.json");

const PREVIEW_CATALOG_URL = resolvePreviewCatalogUrl();
const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 250 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 8_192;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const PACKAGE_ASSET_CONTENT_TYPES = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  // Tilemap/atlas metadata for contributions.assets. Passive data only — anything
  // active (svg, html, js) stays out of this map: it would execute same-origin.
  [".json", "application/json; charset=utf-8"],
  // An Experience's own music (Capability API 1.345): passive media, played by an audio element.
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
]);
const KNOWN_INCOMPATIBLE_RUNTIMES = new Map<string, string>([
  ...["1.0.0", "1.0.3", "1.0.6"].map(
    (version) =>
      [
        `hierarchical-maps@${version}`,
        `World Maps ${version} is incompatible with file-native storage. Update the package before using maps.`,
      ] as const,
  ),
]);

export class CapabilityPackageVersionMismatchError extends Error {}

/** This Engine refuses the package version before downloading it: it needs a newer capability API or Engine version,
 *  or declares something this Engine cannot install. The install route answers 409 with the message. */
export class CapabilityPackageCompatibilityError extends Error {
  override name = "CapabilityPackageCompatibilityError";
}

export function normalizeArchivePath(value: string): string {
  if (!value || value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error("Package contains an unsafe path");
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) {
    throw new Error("Package contains an unsafe path");
  }
  return parts.join("/");
}

/** `normalizeArchivePath` for a caller that treats an unusable path as "not this one" instead of as
 *  an error: matching a declared asset path against a reserved name. */
function tryNormalizeArchivePath(path: string): string | null {
  try {
    return normalizeArchivePath(path);
  } catch {
    return null;
  }
}

function isSymlink(entry: ZipEntry): boolean {
  return ((entry.attr >>> 16) & 0o170000) === 0o120000;
}

/** The archive entry limit, for `openZipArchive` to check before it reads the file list. */
export const PACKAGE_ARCHIVE_BUDGET: ZipEntryBudget = {
  maxEntries: MAX_ARCHIVE_ENTRIES,
  tooManyEntries: "Package contains too many files",
};

export function validatePackageArchiveEntries(zip: ZipArchive, maximumExpandedBytes = MAX_EXPANDED_BYTES) {
  const archiveEntries = zip.getEntries();
  if (archiveEntries.length > MAX_ARCHIVE_ENTRIES) throw new Error(PACKAGE_ARCHIVE_BUDGET.tooManyEntries);
  const entries = archiveEntries.filter((item) => !item.isDirectory);
  const names = new Set<string>();
  let expandedBytes = 0;
  for (const item of entries) {
    const name = normalizeArchivePath(item.entryName);
    // Case-insensitive: NTFS/APFS collapse case, so `Tiles.PNG` and `tiles.png`
    // would extract onto one on-disk file and one of the two declared hashes
    // could never verify again.
    const nameKey = name.toLowerCase();
    if (names.has(nameKey)) throw new Error(`Package contains duplicate file ${name}`);
    if (isSymlink(item)) throw new Error("Package links are not allowed");
    names.add(nameKey);
    expandedBytes += item.size;
    if (expandedBytes > maximumExpandedBytes) throw new Error("Expanded package is too large");
  }
  return entries;
}

function inside(root: string, candidate: string): string {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error("Package contains an unsafe path");
  return target;
}

function runtimeBlockReason(installed: InstalledCapabilityPackage): string | null {
  return (
    getCapabilityApiCompatibilityIssue(installed.manifest) ??
    KNOWN_INCOMPATIBLE_RUNTIMES.get(`${installed.id}@${installed.version}`) ??
    null
  );
}

function isLegacyValidatorActivationFailure(installed: InstalledCapabilityPackage): boolean {
  if (installed.manifest.schemaVersion === 2 && installed.manifest.capabilityApi.major !== 1) return false;
  // ponytail: old registries have messages, not typed causes. Keep these migration matches exact;
  // replace them with activation error codes when the registry records those causes.
  const message = installed.error ?? installed.readinessError;
  return (
    typeof message === "string" &&
    (/^[A-Za-z_$][\w$]*\.innerType is not a function$/.test(message) ||
      message === "Cannot read properties of undefined (reading 'curve')")
  );
}

function assertNotDowngrade(
  current: Pick<InstalledCapabilityPackage, "id" | "version"> | undefined,
  nextVersion: string,
) {
  if (current && compareCapabilityPackageVersions(nextVersion, current.version) < 0) {
    throw new Error(
      `Installed ${current.id} ${current.version} is newer than catalog version ${nextVersion}; refusing to downgrade`,
    );
  }
}

const rawRegistrySchema = installedCapabilityRegistrySchema.extend({ packages: z.array(z.unknown()) });
const installedVersionSchema = installedCapabilityPackageSchema.pick({ id: true, version: true });

async function readRawRegistry() {
  try {
    return rawRegistrySchema.parse(JSON.parse(await readFile(REGISTRY, "utf8")));
  } catch (error) {
    if (!existsSync(REGISTRY)) return { schemaVersion: 1 as const, packages: [] };
    throw error;
  }
}

async function readRegistry() {
  const raw = await readRawRegistry();
  return {
    ...raw,
    packages: raw.packages.flatMap((entry) => {
      const parsed = installedCapabilityPackageSchema.strict().safeParse(entry);
      if (parsed.success) return [parsed.data];
      logger.warn("[capability] Skipping an unsupported installed package record: %s", parsed.error.message);
      return [];
    }),
  };
}

async function readInstalledVersion(packageId: string) {
  for (const entry of (await readRawRegistry()).packages) {
    const parsed = installedVersionSchema.safeParse(entry);
    if (parsed.success && parsed.data.id === packageId) return parsed.data;
  }
}

async function writeRegistry(packages: InstalledCapabilityPackage[]) {
  await mkdir(ROOT, { recursive: true });
  // Operational reads omit unsupported manifests, but writes must retain their raw records.
  // Re-read here so an unrelated readiness/update write cannot erase an unseen sibling.
  const ids = new Set(packages.map((item) => item.id));
  const unsupported = (await readRawRegistry()).packages.filter(
    (entry) =>
      !installedCapabilityPackageSchema.strict().safeParse(entry).success &&
      !(entry && typeof entry === "object" && "id" in entry && typeof entry.id === "string" && ids.has(entry.id)),
  );
  const temporary = `${REGISTRY}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, packages: [...packages, ...unsupported] }, null, 2), {
    mode: 0o600,
  });
  await rename(temporary, REGISTRY);
}

interface CapabilityPackageUpdateDecisions {
  schemaVersion: 1;
  declined: Record<string, { version: string; declinedAt: string }>;
}

function emptyUpdateDecisions(): CapabilityPackageUpdateDecisions {
  return { schemaVersion: 1, declined: {} };
}

async function readUpdateDecisions(): Promise<CapabilityPackageUpdateDecisions> {
  try {
    const parsed = JSON.parse(await readFile(UPDATE_DECISIONS, "utf8")) as Record<string, unknown>;
    if (parsed.schemaVersion !== 1 || !parsed.declined || typeof parsed.declined !== "object") {
      return emptyUpdateDecisions();
    }
    const declined: CapabilityPackageUpdateDecisions["declined"] = {};
    for (const [id, value] of Object.entries(parsed.declined as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const decision = value as Record<string, unknown>;
      if (
        typeof decision.version === "string" &&
        typeof decision.declinedAt === "string" &&
        Number.isFinite(Date.parse(decision.declinedAt))
      ) {
        declined[id] = { version: decision.version, declinedAt: decision.declinedAt };
      }
    }
    return { schemaVersion: 1, declined };
  } catch {
    return emptyUpdateDecisions();
  }
}

async function writeUpdateDecisions(decisions: CapabilityPackageUpdateDecisions) {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${UPDATE_DECISIONS}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify(decisions, null, 2), { mode: 0o600 });
  await rename(temporary, UPDATE_DECISIONS);
}

async function clearDeclinedUpdate(packageId: string) {
  const decisions = await readUpdateDecisions();
  if (!decisions.declined[packageId]) return;
  delete decisions.declined[packageId];
  await writeUpdateDecisions(decisions);
}

async function writeAvailabilityMigration(kind: "fresh" | "legacy") {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${AVAILABILITY_MIGRATION}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(
    temporary,
    JSON.stringify({ schemaVersion: 1, kind, completedAt: new Date().toISOString() }, null, 2),
    {
      mode: 0o600,
    },
  );
  await rename(temporary, AVAILABILITY_MIGRATION);
}

function hasValidCompletionTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

async function readAvailabilityMigrationKind(): Promise<"fresh" | "legacy" | null> {
  try {
    const parsed = JSON.parse(await readFile(AVAILABILITY_MIGRATION, "utf8")) as Record<string, unknown>;
    return parsed.schemaVersion === 1 &&
      (parsed.kind === "fresh" || parsed.kind === "legacy") &&
      hasValidCompletionTimestamp(parsed.completedAt)
      ? parsed.kind
      : null;
  } catch {
    return null;
  }
}

async function readNoodleExtractionMigrationKind(): Promise<"fresh" | "legacy" | null> {
  try {
    const parsed = JSON.parse(await readFile(NOODLE_EXTRACTION_MIGRATION, "utf8")) as Record<string, unknown>;
    return parsed.schemaVersion === 1 &&
      (parsed.kind === "fresh" || parsed.kind === "legacy") &&
      hasValidCompletionTimestamp(parsed.completedAt)
      ? parsed.kind
      : null;
  } catch {
    return null;
  }
}

async function writeNoodleExtractionMigration(kind: "fresh" | "legacy") {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${NOODLE_EXTRACTION_MIGRATION}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(
    temporary,
    JSON.stringify({ schemaVersion: 1, kind, completedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 },
  );
  await rename(temporary, NOODLE_EXTRACTION_MIGRATION);
}

async function writeHierarchicalMapsSelectionCorrection() {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${HIERARCHICAL_MAPS_SELECTION_CORRECTION}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, completedAt: new Date().toISOString() }, null, 2), {
    mode: 0o600,
  });
  await rename(temporary, HIERARCHICAL_MAPS_SELECTION_CORRECTION);
}

async function readHierarchicalMapsSelectionCorrectionComplete(): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(HIERARCHICAL_MAPS_SELECTION_CORRECTION, "utf8")) as Record<
      string,
      unknown
    >;
    return parsed.schemaVersion === 1 && hasValidCompletionTimestamp(parsed.completedAt);
  } catch {
    return false;
  }
}

async function fetchBytes(url: string, maximum: number): Promise<Buffer> {
  const response = await safeFetch(url, {
    policy: { allowedProtocols: ["https:"] },
    maxResponseBytes: maximum,
    signal: AbortSignal.timeout(120_000),
    agentOptions: { bodyTimeout: 120_000, headersTimeout: 30_000 },
  });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function supportsEngineVersion(entry: CapabilityCatalogPackage, engineVersion: string): boolean {
  return (
    compareCapabilityPackageVersions(engineVersion, entry.manifest.engine.min) >= 0 &&
    compareCapabilityPackageVersions(engineVersion, entry.manifest.engine.maxExclusive) < 0
  );
}

/** Whether any row of these entries names a column the ruleset keeps up to date. Read structurally
 *  rather than parsed: the install gate looks at documents nothing has validated yet, and a shape it
 *  does not recognise is not its problem to report. */
/** An entry with a scaled row beside any other row of its list, told apart by name (1.92): an older
 *  Engine refused a scaled row that was not its entry's only one there, scaled or not. */
function entriesCarrySeveralScaledRows(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const rows = plainRecord(entry)?.rows;
      if (!Array.isArray(rows)) return false;
      const perList = new Map<string, { rows: number; scaled: boolean }>();
      for (const row of rows) {
        const record = plainRecord(row);
        if (typeof record?.list !== "string") continue;
        const seen = perList.get(record.list) ?? { rows: 0, scaled: false };
        perList.set(record.list, { rows: seen.rows + 1, scaled: seen.scaled || record.scaled !== undefined });
      }
      return [...perList.values()].some((list) => list.rows > 1 && list.scaled);
    })
  );
}

function entriesCarryScaledRows(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const rows = entry && typeof entry === "object" ? (entry as { rows?: unknown }).rows : undefined;
    return (
      Array.isArray(rows) &&
      rows.some((row) => !!row && typeof row === "object" && (row as { scaled?: unknown }).scaled !== undefined)
    );
  });
}

/** The `mechanics` keys a fight reads, which are new keys in the same strict file: an Engine that
 *  does not know them refuses whichever file holds them. Read structurally, for the same reason
 *  `entriesCarryScaledRows` is. */
const COMBAT_MECHANICS_KEYS = ["targetCount", "autoHit", "applies", "temporary", "scales", "budget"] as const;

function entriesCarryCombatMechanics(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    if (!mechanics || typeof mechanics !== "object") return false;
    return COMBAT_MECHANICS_KEYS.some((key) => (mechanics as Record<string, unknown>)[key] !== undefined);
  });
}

/** What a picked entry does to a CHECK rather than to a fight, which is `mechanics.check` and is
 *  new in 1.30. Read the same structural way, for the same reason: an Engine that does not know the
 *  key refuses the whole file that holds it, inline or in a catalog asset. */
function entriesCarryCheckEffects(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    return !!mechanics && typeof mechanics === "object" && (mechanics as Record<string, unknown>).check !== undefined;
  });
}

/** An opponent in place of rows: another new key in the same strict file, read structurally for the
 *  same reason the two above are. */
function entriesCarryCreatures(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some(
    (entry) => !!entry && typeof entry === "object" && (entry as { creature?: unknown }).creature !== undefined,
  );
}

/** The `mechanics` keys that say what one turn can do, which are new keys in the same strict file.
 *  Read structurally, for the same reason the ones above are. */
const TURN_ECONOMY_MECHANICS_KEYS = ["plus", "free", "gives", "standard", "rider"] as const;

/** The condition effects an Engine before 1.29 knew. Written out rather than read off the shared
 *  enum, because the question this asks is what an OLDER Engine would refuse, which is a fixed list
 *  and not whatever this build happens to implement. */
const OLD_CONDITION_EFFECTS: ReadonlySet<string> = new Set([
  "own-attacks-advantage",
  "own-attacks-disadvantage",
  "attacks-against-advantage",
  "attacks-against-disadvantage",
  "attacks-against-adjacent-advantage",
  "attacks-against-far-disadvantage",
  "attacks-from-adjacent-critical",
  "cannot-act",
  "cannot-react",
  "speed-zero",
  "half-move-to-stand",
  "ends-on-damage",
]);

/** A creature described by a sheet in the ruleset's own terms. The key is new in 1.34, and an Engine
 *  before it refuses the whole strict catalog file, both for the key and for the fixed numbers such
 *  a creature no longer carries. */
function entriesCarryCreatureSheets(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const creature = entry && typeof entry === "object" ? (entry as { creature?: unknown }).creature : undefined;
    return !!creature && typeof creature === "object" && (creature as { sheet?: unknown }).sheet !== undefined;
  });
}

/** A creature that gives its own contest checks, which is 1.43: a new key on the strict creature. */
function entriesCarryCreatureChecks(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const creature = entry && typeof entry === "object" ? (entry as { creature?: unknown }).creature : undefined;
    return !!creature && typeof creature === "object" && (creature as { checks?: unknown }).checks !== undefined;
  });
}

/** A reaction that waits for somebody USING something, or answers only some catalogs' entries,
 *  which is 1.44: a new value and a new key in the same strict reaction object. */
function entriesCarryUsedMoments(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    const reaction =
      mechanics && typeof mechanics === "object" ? (mechanics as Record<string, unknown>).reaction : undefined;
    if (!reaction || typeof reaction !== "object") return false;
    const moment = reaction as Record<string, unknown>;
    return moment.on === "used" || moment.against !== undefined;
  });
}

const USED_MOMENTS_ISSUE =
  "A ruleset whose reactions answer something being used, or only some catalogs' entries, requires schemaVersion 2 and capabilityApi 1.44 or newer";

/** An entry that says WHICH moment it waits for. `reaction: true` has been legal since the key
 *  existed and says only that much; an OBJECT there is 1.33, and an Engine that knows only the
 *  boolean refuses the whole strict catalog file. */
function entriesCarryReactionMoments(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    if (!mechanics || typeof mechanics !== "object") return false;
    const reaction = (mechanics as Record<string, unknown>).reaction;
    return !!reaction && typeof reaction === "object";
  });
}

/** An entry that moves a pool rule's face for the check it is used on, which is 1.37: new keys in
 *  the same strict `mechanics.check`. Read structurally, for the same reason the ones above are. */
function entriesCarryCheckFaces(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    const check = mechanics && typeof mechanics === "object" ? (mechanics as Record<string, unknown>).check : undefined;
    if (!check || typeof check !== "object") return false;
    return (["explode", "double"] as const).some((key) => (check as Record<string, unknown>)[key] !== undefined);
  });
}

function entriesCarryTurnEconomy(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const mechanics = entry && typeof entry === "object" ? (entry as { mechanics?: unknown }).mechanics : undefined;
    if (!mechanics || typeof mechanics !== "object") return false;
    const record = mechanics as Record<string, unknown>;
    // The kind counts too: `rider` is a new value for an old key, and an Engine that knows only the
    // five it had refuses the file whichever way round it is written.
    if (record.kind === "rider") return true;
    return TURN_ECONOMY_MECHANICS_KEYS.some((key) => record[key] !== undefined);
  });
}

/** A creature whose blow carries a second clause, or that carries riders of its own: new keys in
 *  the same strict file again, read the same way. */
function entriesCarryCreatureEconomy(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const creature = entry && typeof entry === "object" ? (entry as { creature?: unknown }).creature : undefined;
    if (!creature || typeof creature !== "object") return false;
    const record = creature as { actions?: unknown; riders?: unknown };
    if (record.riders !== undefined) return true;
    if (!Array.isArray(record.actions)) return false;
    return record.actions.some((action) => {
      const damage = action && typeof action === "object" ? (action as { damage?: unknown }).damage : undefined;
      return !!damage && typeof damage === "object" && (damage as { plus?: unknown }).plus !== undefined;
    });
  });
}

/** A creature action whose `range` is an ordinary distance with a longer one beyond it, which is a
 *  new SHAPE for an old key, or one that carries the `area` it lands in, which is a new key: either
 *  way an Engine that knows neither refuses the file they sit in. Read structurally, for the same
 *  reason the three above are. */
function entriesCarryCreatureRanges(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const creature = entry && typeof entry === "object" ? (entry as { creature?: unknown }).creature : undefined;
    const actions = creature && typeof creature === "object" ? (creature as { actions?: unknown }).actions : undefined;
    if (!Array.isArray(actions)) return false;
    return actions.some((action) => {
      if (!action || typeof action !== "object") return false;
      const { range, area } = action as { range?: unknown; area?: unknown };
      return (!!range && typeof range === "object") || area !== undefined;
    });
  });
}

/** `rulesetDocument` is the package's own `ruleset.json`, parsed, when the install already has its
 *  verified bytes. Catalogs live INSIDE that file, so the manifest alone cannot show them, and the
 *  gate that keeps a package off an Engine too old to serve them has to read it. `catalogDocuments`
 *  are the package's own `catalogs/<id>.json` files, by their normalized path, which install also
 *  holds by then: a scaled row can sit in one of those instead. A document that is absent or
 *  unparseable simply skips the catalog check: install has never validated a ruleset's contents, and
 *  an unusable one is the registry's story to tell, with a log line. */
/** One reason for every 1.37 key, wherever it sits: they arrived together and an older Engine refuses
 *  each of them the same way. */
const SHEET_1_37_ISSUE =
  "A ruleset whose tracks read their maximum off the sheet, hide or always show, or whose sheet summary lists show columns or are named by an enum, requires schemaVersion 2 and capabilityApi 1.37 or newer";

/** The 1.37 keys on the sheet and its summary. Read off the raw document for the same reason every
 *  gate above is: an Engine that does not know them refuses the whole strict file. An enum column
 *  naming a summary list is an old key with a new value, so the list's own column is looked up. */
function rulesetCarriesSheet137Keys(ruleset: { sheet?: unknown; gm?: unknown } | undefined): boolean {
  const record = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  const sheet = record(ruleset?.sheet);
  const tracks = record(sheet?.live)?.tracks;
  const trackKeys =
    Array.isArray(tracks) &&
    tracks.some((track) => {
      const entry = record(track);
      return (
        !!entry && (typeof entry.max === "object" || entry.hideWhen !== undefined || entry.alwaysShow !== undefined)
      );
    });
  if (trackKeys) return true;
  const lists = Array.isArray(sheet?.lists) ? sheet.lists : [];
  const summaryLists = record(record(record(ruleset?.gm)?.sheetSummary))?.lists;
  return (
    Array.isArray(summaryLists) &&
    summaryLists.some((summary) => {
      const entry = record(summary);
      if (!entry) return false;
      if (entry.columns !== undefined) return true;
      const list = lists.map(record).find((candidate) => candidate?.id === entry.list);
      const columns = Array.isArray(list?.columns) ? list.columns : [];
      return columns.map(record).some((column) => column?.id === entry.nameColumn && column?.type === "enum");
    })
  );
}

const MOVED_POOL_RULES_ISSUE =
  "A ruleset whose pool checks can move their rules, add two abilities or read a botch off half the dice requires schemaVersion 2 and capabilityApi 1.37 or newer";

const SHEET_READS_ISSUE =
  "A ruleset whose values read a live track or pool or add up a list, whose skills or saves carry a cap, or that hides on anything but one value requires schemaVersion 2 and capabilityApi 1.39 or newer";

/** Rating grants can also arrive in catalog assets (Capability API 1.152). */
function entriesCarryBuilderRatings147(entries: unknown): boolean {
  return (
    Array.isArray(entries) && entries.some((entry) => plainRecord(plainRecord(entry)?.grants)?.ratings !== undefined)
  );
}

/** The 1.151 builder keys in their step and grant positions, including catalog files. */
function carriesBuilderChoices146(value: unknown, grants = false): boolean {
  const record = plainRecord(value);
  if (!record) return false;
  const choices = (value: unknown, ability = false) =>
    Array.isArray(value) &&
    value.some((value) => {
      const choice = plainRecord(value);
      return (
        choice &&
        ([
          "id",
          "countFrom",
          "max",
          "excludeChoices",
          "tier",
          "only",
          "onDuplicate",
          "quotas",
          "distinctBy",
          "quotaBelow",
        ].some((key) => choice[key] !== undefined) ||
          (ability && choice.from !== undefined))
      );
    });
  if (grants)
    return (
      choices(plainRecord(record.abilities)?.choose, true) ||
      choices(plainRecord(record.trained)?.choose) ||
      choices(plainRecord(record.entries)?.choose)
    );
  const steps = plainRecord(plainRecord(record.sheet)?.builder)?.steps;
  return (
    Array.isArray(steps) &&
    steps.some((value) => {
      const step = plainRecord(value);
      return (
        step &&
        (["when", "requiredWhen", "quotas", "distinctBy", "quotaBelow"].some((key) => step[key] !== undefined) ||
          choices(step.choose))
      );
    })
  );
}

/** The 1.155 builder keys: offer eligibility, sheet-read bounds and discrete ratings, a named
 *  replacement pool on a training choice (a step's or a catalog grant's), and creation rules. */
function carriesBuilderLegality150(value: unknown, grants = false): boolean {
  const record = plainRecord(value);
  if (!record) return false;
  const replaces = (value: unknown) =>
    Array.isArray(value) && value.some((choice) => plainRecord(choice)?.replacementFrom !== undefined);
  if (grants) return replaces(plainRecord(record.trained)?.choose);
  const builder = plainRecord(plainRecord(record.sheet)?.builder);
  if (builder?.constraints !== undefined) return true;
  return (
    Array.isArray(builder?.steps) &&
    builder.steps.some((value) => {
      const step = plainRecord(value);
      return (
        !!step &&
        (replaces(step.choose) ||
          (Array.isArray(step.offers) &&
            step.offers.some((offer) => {
              const record = plainRecord(offer);
              return (
                !!record && ["when", "minFrom", "maxFrom", "allowedRatings"].some((key) => record[key] !== undefined)
              );
            })))
      );
    })
  );
}

/** The 1.156 keys: a worked-out score, a list whose rows apply to a roll, and an entry's effect that
 *  applies only when named on one. */
function carriesContextual151(ruleset: unknown): boolean {
  const sheet = plainRecord(plainRecord(ruleset)?.sheet);
  const has = (value: unknown, key: string) =>
    Array.isArray(value) && value.some((entry) => plainRecord(entry)?.[key] !== undefined);
  return has(sheet?.abilities, "value") || has(sheet?.lists, "contextual");
}

/** The 1.157 keys: starting coins rolled or read off the holder's sheet. */
function carriesStartingCoins152(ruleset: unknown): boolean {
  const gear = plainRecord(plainRecord(ruleset)?.items)?.startingGear;
  const lineCarries = (line: unknown) => {
    const record = plainRecord(line);
    return !!record && (record.roll !== undefined || record.countFrom !== undefined || record.times !== undefined);
  };
  return (
    Array.isArray(gear) &&
    gear.some((entry) => {
      const record = plainRecord(entry);
      const lines = Array.isArray(record?.lines) ? record.lines : [];
      const options = (Array.isArray(record?.choices) ? record.choices : []).flatMap((choice) => {
        const list = plainRecord(choice)?.options;
        return Array.isArray(list) ? list.flatMap((option) => plainRecord(option)?.lines ?? []) : [];
      });
      return [...lines, ...(options as unknown[])].some(lineCarries);
    })
  );
}

/** The 1.158 keys: an initialize step, and a pool or track that starts at a value read off the sheet. */
function carriesStartingValues153(ruleset: unknown): boolean {
  const sheet = plainRecord(plainRecord(ruleset)?.sheet);
  const live = plainRecord(sheet?.live);
  const starts = (value: unknown) =>
    Array.isArray(value) && value.some((entry) => plainRecord(entry)?.startFrom !== undefined);
  const steps = plainRecord(sheet?.builder)?.steps;
  return (
    starts(live?.pools) ||
    starts(live?.tracks) ||
    (Array.isArray(steps) && steps.some((step) => plainRecord(step)?.kind === "initialize"))
  );
}

/** The 1.159 keys: picks or rows paid out of a builder pool, and rows copied from a catalog. */
function carriesPricedChoices154(ruleset: unknown): boolean {
  const steps = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.builder)?.steps;
  return (
    Array.isArray(steps) &&
    steps.some((step) => {
      const record = plainRecord(step);
      return (
        (record?.kind === "catalog" || record?.kind === "rows") &&
        (record.pool !== undefined || record.cost !== undefined || record.from !== undefined)
      );
    })
  );
}

/** The 1.160 keys: creation profiles, and steps that read the sheet as earlier steps make it. */
function carriesProfiles155(ruleset: unknown): boolean {
  const builder = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.builder);
  return (
    builder?.profiles !== undefined ||
    (Array.isArray(builder?.steps) && builder.steps.some((step) => plainRecord(step)?.reads !== undefined))
  );
}

/** The 1.161 key: a list whose rows are checks of their own. */
function carriesRowChecks156(ruleset: unknown): boolean {
  const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
  return Array.isArray(lists) && lists.some((list) => plainRecord(list)?.checks !== undefined);
}

/** The 1.162 keys: scores rolled in order with their own dice, and roll steps. */
function carriesCreationRolls157(ruleset: unknown): boolean {
  const steps = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.builder)?.steps;
  return (
    Array.isArray(steps) &&
    steps.some((step) => {
      const record = plainRecord(step);
      return (
        record?.kind === "roll" || plainRecord(record?.methods)?.rolls !== undefined || record?.default === "rolls"
      );
    })
  );
}

/** The 1.163 keys: a shared sheet set up through a builder, with lists, or with fields read off the
 *  party's characters. */
function carriesPartyCreation158(ruleset: unknown): boolean {
  const party = plainRecord(plainRecord(ruleset)?.party);
  return !!party && (party.builder !== undefined || party.lists !== undefined || party.fromMembers !== undefined);
}

/** The 1.164 keys: spend offers raised and lowered from one start, owned levels, and trades. */
function carriesTrades159(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  const builders = [plainRecord(record?.sheet)?.builder, plainRecord(record?.party)?.builder];
  return builders.some((builder) => {
    const steps = plainRecord(builder)?.steps;
    return (
      Array.isArray(steps) &&
      steps.some((step) => {
        const offers = plainRecord(step)?.offers;
        return (
          Array.isArray(offers) &&
          offers.some((offer) => {
            const each = plainRecord(offer);
            return each?.direction !== undefined || each?.effect !== undefined || each?.exchange !== undefined;
          })
        );
      })
    );
  });
}

/** The 1.205 keys: a list sum that counts rows or reads only rows whose cell equals a value. */
function carriesRowCounts200(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesRowCounts200(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  const sum = plainRecord(record.listSum);
  if (sum && (sum.where !== undefined || sum.count !== undefined)) return true;
  return Object.values(record).some((each) => carriesRowCounts200(each, depth + 1));
}

/** The 1.206 keys: row prices scaled, offset or overridden by a derived value the row names. */
function carriesRowPrices201(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  return [plainRecord(record?.sheet)?.builder, plainRecord(record?.party)?.builder].some((builder) => {
    const steps = plainRecord(builder)?.steps;
    return (
      Array.isArray(steps) &&
      steps.some((step) => {
        const cost = plainRecord(plainRecord(step)?.cost);
        return (
          plainRecord(step)?.kind === "rows" &&
          !!cost &&
          (cost.times !== undefined || cost.add !== undefined || cost.overrides !== undefined)
        );
      })
    );
  });
}

/** The 1.207 key: a spend offer whose price is not supplied yet. */
function carriesUnpriced202(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  return [plainRecord(record?.sheet)?.builder, plainRecord(record?.party)?.builder].some((builder) => {
    const steps = plainRecord(builder)?.steps;
    return (
      Array.isArray(steps) &&
      steps.some((step) => {
        const offers = plainRecord(step)?.offers;
        return (
          Array.isArray(offers) &&
          offers.some((offer) => {
            const each = plainRecord(offer);
            const costs = [
              each?.cost,
              ...(Array.isArray(each?.overrides) ? each.overrides.map((o) => plainRecord(o)?.cost) : []),
            ];
            return costs.some((cost) => plainRecord(cost)?.unpriced !== undefined);
          })
        );
      })
    );
  });
}

/** The 1.208 ceiling: more than 160 sheet fields. */
function carriesManyFields203(ruleset: unknown): boolean {
  const fields = plainRecord(plainRecord(ruleset)?.sheet)?.fields;
  return Array.isArray(fields) && fields.length > RULESET_FIELDS_MAX_BEFORE_1203;
}

function carriesRollAbilities204(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  return [plainRecord(record?.sheet)?.builder, plainRecord(record?.party)?.builder].some((builder) => {
    const steps = plainRecord(builder)?.steps;
    return (
      Array.isArray(steps) &&
      steps.some((step) => {
        const rolls = plainRecord(step)?.rolls;
        return Array.isArray(rolls) && rolls.some((roll) => plainRecord(roll)?.ability !== undefined);
      })
    );
  });
}

function carriesWorkedColumns205(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  return [plainRecord(record?.sheet), plainRecord(record?.party)?.sheet].some((sheet) => {
    const lists = plainRecord(sheet)?.lists;
    return (
      Array.isArray(lists) &&
      lists.some((list) => {
        const columns = plainRecord(list)?.columns;
        return Array.isArray(columns) && columns.some((column) => plainRecord(column)?.sum !== undefined);
      })
    );
  });
}

function carriesPartialBoosts206(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesPartialBoosts206(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  const choose = plainRecord(record.abilities)?.choose;
  if (Array.isArray(choose) && choose.some((choice) => plainRecord(choice)?.partialFrom !== undefined)) return true;
  return Object.values(record).some((each) => carriesPartialBoosts206(each, depth + 1));
}

function carriesRowStances207(ruleset: unknown): boolean {
  const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
  return (
    Array.isArray(lists) &&
    lists.some((list) => {
      const checks = plainRecord(list)?.checks;
      return Array.isArray(checks) && checks.some((check) => plainRecord(check)?.stance !== undefined);
    })
  );
}

function carriesAbilitySpecialties208(ruleset: unknown): boolean {
  const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
  return (
    Array.isArray(lists) && lists.some((list) => plainRecord(plainRecord(list)?.contextual)?.abilities !== undefined)
  );
}

function carriesNoCancel209(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesNoCancel209(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  if (plainRecord(plainRecord(record.contextual)?.check)?.cancel === false) return true;
  return Object.values(record).some((each) => carriesNoCancel209(each, depth + 1));
}

function carriesItemAccess210(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesItemAccess210(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  if (plainRecord(record.grants)?.itemAccess !== undefined) return true;
  return Object.values(record).some((each) => carriesItemAccess210(each, depth + 1));
}

function carriesRowDots211(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  return [plainRecord(record?.sheet)?.builder, plainRecord(record?.party)?.builder].some((builder) => {
    const steps = plainRecord(builder)?.steps;
    return (
      Array.isArray(steps) &&
      steps.some((step) => {
        const each = plainRecord(step);
        const groups = each?.groups;
        const overrides = plainRecord(each?.cost)?.overrides;
        return (
          (Array.isArray(groups) && groups.some((group) => plainRecord(group)?.rows !== undefined)) ||
          (Array.isArray(overrides) && overrides.some((override) => plainRecord(override)?.times !== undefined))
        );
      })
    );
  });
}

function carriesBestRating212(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesBestRating212(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  if (plainRecord(plainRecord(record.contextual)?.check)?.best !== undefined) return true;
  return Object.values(record).some((each) => carriesBestRating212(each, depth + 1));
}

function carriesTrackCosts213(ruleset: unknown, depth = 0): boolean {
  if (depth > 40 || !ruleset || typeof ruleset !== "object") return false;
  if (Array.isArray(ruleset)) return ruleset.some((each) => carriesTrackCosts213(each, depth + 1));
  const record = ruleset as Record<string, unknown>;
  const contextual = plainRecord(record.contextual);
  // A list row that costs anything, or an entry cost that marks a track.
  if (contextual?.cost !== undefined && Array.isArray(record.columns)) return true;
  const cost = contextual?.cost;
  if (Array.isArray(cost) && cost.some((each) => plainRecord(each)?.track !== undefined)) return true;
  return Object.values(record).some((each) => carriesTrackCosts213(each, depth + 1));
}

/** The 1.219 ceiling: an advancement list over 24 fields (up to 64). */
/** The 1.220 key: a catalog borrowed from another installed ruleset. */
function carriesBorrowedCatalog215(ruleset: unknown): boolean {
  const catalogs = plainRecord(ruleset)?.catalogs;
  return Array.isArray(catalogs) && catalogs.some((catalog) => plainRecord(catalog)?.from !== undefined);
}

function carriesLongAdvancement214(ruleset: unknown): boolean {
  const fields = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.advancement)?.fields;
  return Array.isArray(fields) && fields.length > 24;
}

function entriesCarryContextual151(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(entry)?.mechanics)?.contextual !== undefined)
  );
}

function entriesCarryBuilderLegality150(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => carriesBuilderLegality150(plainRecord(entry)?.grants, true));
}

function entriesCarryBuilderChoices146(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => carriesBuilderChoices146(plainRecord(entry)?.grants, true));
}

/** The 1.39 keys a value reference or a `hideWhen` may carry, anywhere in a document. Their names
 *  are camelCase, which no sheet id can be, so walking the whole document finds exactly them rather
 *  than every place a reference may sit (and a catalog file is walked the same way). */
function carriesSheetReads139(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 64) return false;
  if (Array.isArray(value)) return value.some((entry) => carriesSheetReads139(entry, depth + 1));
  const record = value as Record<string, unknown>;
  if (record.liveTrack !== undefined || record.livePool !== undefined || record.listSum !== undefined) return true;
  const hide = record.hideWhen;
  if (hide && typeof hide === "object") {
    const comparison = hide as Record<string, unknown>;
    if (comparison.notEquals !== undefined || comparison.in !== undefined) return true;
  }
  return Object.values(record).some((entry) => carriesSheetReads139(entry, depth + 1));
}

/** And a `cap` on a skill or save, which is an ordinary word, so only those two lists are read. */
function rulesetCapsChecks(ruleset: { sheet?: unknown } | undefined): boolean {
  const sheet = ruleset?.sheet && typeof ruleset.sheet === "object" ? (ruleset.sheet as Record<string, unknown>) : {};
  return (["skills", "saves"] as const).some(
    (key) =>
      Array.isArray(sheet[key]) &&
      (sheet[key] as unknown[]).some(
        (entry) => !!entry && typeof entry === "object" && (entry as Record<string, unknown>).cap !== undefined,
      ),
  );
}

const WOUND_BOXES_ISSUE =
  "A ruleset whose wound tracks are boxes, fill by box, refuse a mark when full or take extra levels from a list, or whose rests heal one kind of harm, requires schemaVersion 2 and capabilityApi 1.40 or newer";

/** The 1.40 keys: on a live track, and on a rest's restore step. Ordinary words, so only those two
 *  places are read. */
function rulesetCarriesWound140Keys(ruleset: { sheet?: unknown; rests?: unknown } | undefined): boolean {
  const record = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  const tracks = record(record(ruleset?.sheet)?.live)?.tracks;
  const trackKeys =
    Array.isArray(tracks) &&
    tracks.some((track) => {
      const entry = record(track);
      return !!entry && (["boxes", "fill", "onFull", "extra"] as const).some((key) => entry[key] !== undefined);
    });
  if (trackKeys) return true;
  const rests = Array.isArray(ruleset?.rests) ? ruleset.rests : [];
  return rests.some((rest) => {
    const restore = record(rest)?.restore;
    return Array.isArray(restore) && restore.some((step) => record(step)?.kind !== undefined);
  });
}

const CONTESTS_ISSUE =
  "A ruleset whose fights have contests, or whose creatures carry contest checks, requires schemaVersion 2 and capabilityApi 1.43 or newer";

/** The 1.43 keys in the ruleset file itself: `checks` and `contests` in the combat block. */
function rulesetCarriesContests143Keys(ruleset: { combat?: unknown } | undefined): boolean {
  const combat =
    ruleset?.combat && typeof ruleset.combat === "object" ? (ruleset.combat as Record<string, unknown>) : undefined;
  return !!combat && (combat.checks !== undefined || combat.contests !== undefined);
}

const CONDITION_NUMBERS_ISSUE =
  "A ruleset whose conditions change numbers or count levels, or end after one use or as a turn begins, requires schemaVersion 2 and capabilityApi 1.45 or newer";

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Maps keyed by a ruleset's own ids (a sheet's `fields`, a row's `values`, a stat block's `checks`,
 *  a worn item's `abilities`): what is under them is the ruleset's data, never a feature, so a column
 *  or a score that happens to be called `magical`, `passive` or `hiding` is not read as one. */
const ID_KEYED_MAPS = new Set([
  "abilities",
  "always",
  "bonuses",
  "byKind",
  "checks",
  "fields",
  "filters",
  "lists",
  "options",
  "saves",
  "sets",
  "skills",
  "stats",
  "valueLabels",
  "values",
]);

/** What a feature scan reads further into: every value but an id-keyed map's. */
/** While one install check runs, each record's values are listed once: the check walks the same document for every
 *  gate, and listing them anew each time made it slow on a large ruleset. Nothing in a check changes the document. */
let featureValuesMemo: WeakMap<object, unknown[]> | null = null;

function featureValues(record: Record<string, unknown>): unknown[] {
  const known = featureValuesMemo?.get(record);
  if (known) return known;
  const values = Object.entries(record).flatMap(([key, value]) =>
    ID_KEYED_MAPS.has(key) && plainRecord(value) ? [] : [value],
  );
  featureValuesMemo?.set(record, values);
  return values;
}

/** The 1.45 keys in the ruleset file itself: `levels` in the combat block, and a combat condition's
 *  `modifiers` or check effects. */
function rulesetCarriesConditionNumbers145Keys(ruleset: { combat?: unknown } | undefined): boolean {
  const combat = plainRecord(ruleset?.combat);
  if (!combat) return false;
  if (combat.levels !== undefined) return true;
  const conditions = Array.isArray(combat.conditions) ? combat.conditions : [];
  return conditions.some((entry) => {
    const condition = plainRecord(entry);
    if (!condition) return false;
    if (condition.modifiers !== undefined) return true;
    const effects = Array.isArray(condition.effects) ? condition.effects : [];
    return effects.includes("own-checks-advantage") || effects.includes("own-checks-disadvantage");
  });
}

/** A condition an entry or a creature's action applies that ends after one use or counts down as
 *  turns begin, which is 1.45: new keys in the same strict `applies`. */
function entriesCarryConditionEndings(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  const endsNewly = (applies: unknown) =>
    Array.isArray(applies) &&
    applies.some((one) => {
      const entry = plainRecord(one);
      return entry?.endsAfter !== undefined || plainRecord(entry?.duration)?.at !== undefined;
    });
  return entries.some((entry) => {
    const record = plainRecord(entry);
    if (endsNewly(plainRecord(record?.mechanics)?.applies)) return true;
    const actions = plainRecord(record?.creature)?.actions;
    return Array.isArray(actions) && actions.some((action) => endsNewly(plainRecord(action)?.applies));
  });
}

const ITEMS_ISSUE = "A ruleset that describes items requires schemaVersion 2 and capabilityApi 1.49 or newer";

const INVENTED_ITEMS_ISSUE =
  "A ruleset that caps or forbids the items its Game Master invents requires schemaVersion 2 and capabilityApi 1.51 or newer";

/** `rarityCaps` and `propose`, which are 1.51: new keys on the strict items block, read structurally
 *  for the same reason the others are. */
function rulesetCarriesInventedItem151Keys(ruleset: { items?: unknown } | undefined): boolean {
  const items = plainRecord(ruleset?.items);
  return items?.rarityCaps !== undefined || items?.propose !== undefined;
}

const ITEM_STAT_ISSUE =
  "A ruleset whose values read the items someone holds requires schemaVersion 2 and capabilityApi 1.52 or newer";

/** An `itemStat` reference, which is 1.52. Its name is camelCase, which no sheet id can be, so
 *  walking the whole document finds exactly it (and a catalog file is walked the same way). */
function carriesItemStat152(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 64) return false;
  if (Array.isArray(value)) return value.some((entry) => carriesItemStat152(entry, depth + 1));
  const record = value as Record<string, unknown>;
  if (record.itemStat !== undefined) return true;
  return Object.values(record).some((entry) => carriesItemStat152(entry, depth + 1));
}

/** An item in place of rows or a creature, which is 1.49: a new key on the strict entry, read
 *  structurally for the same reason the others are. */
function entriesCarryItems(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => plainRecord(entry)?.item !== undefined);
}

const CHECK_EFFECTS_ISSUE =
  "A ruleset whose items change checks while worn or carried, whose conditions or levels name skills, whose modifiers name skills, saves or a mode, or whose rarity caps hold a bonus requires schemaVersion 2 and capabilityApi 1.53 or newer";

const REQUIREMENTS_ISSUE =
  "A ruleset whose items ask something of their wearer or change an ability, or whose condition levels read a derived value, requires schemaVersion 2 and capabilityApi 1.54 or newer";

/** What an item asks of its wearer, and an ability its worn or carried effect changes, which are
 *  1.54: new keys on the strict item and its effects. */
function entriesCarryRequirements(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return (
        item?.requires !== undefined ||
        plainRecord(item?.worn)?.abilities !== undefined ||
        plainRecord(item?.carried)?.abilities !== undefined
      );
    })
  );
}

const WEAPONS_ISSUE =
  "A ruleset whose items are weapons, or whose creatures name what gets through a resistance or an immunity, requires schemaVersion 2 and capabilityApi 1.55 or newer";

/** A weapon's attack, which is 1.55 (a new key on the strict item), and a creature's resistance or
 *  immunity written as an object with what gets through it, where a word was all there was before. */
function entriesCarryWeapons(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      if (plainRecord(record?.item)?.attack !== undefined) return true;
      const creature = plainRecord(record?.creature);
      return (["resist", "immune"] as const).some(
        (key) => Array.isArray(creature?.[key]) && (creature[key] as unknown[]).some((type) => plainRecord(type)),
      );
    })
  );
}

const ARMOR_ISSUE =
  "A ruleset whose items change a fight while worn or carried, or with hardness, requires schemaVersion 2 and capabilityApi 1.56 or newer";

/** What an item's effect does only in a fight, which is 1.56: an effect other than a check's or a
 *  save's, a modifier to anything but checks and saves, and the kinds of harm or conditions it keeps
 *  off (new keys on the strict effect). */
function effectCarriesFightParts(effect: unknown): boolean {
  const record = plainRecord(effect);
  if (!record) return false;
  const checkEffects = [
    "own-checks-advantage",
    "own-checks-disadvantage",
    "own-saves-advantage",
    "own-saves-disadvantage",
  ];
  if (Array.isArray(record.effects) && record.effects.some((one) => !checkEffects.includes(String(one)))) return true;
  if (
    Array.isArray(record.modifiers) &&
    record.modifiers.some((modifier) => !["checks", "saves"].includes(String(plainRecord(modifier)?.to)))
  ) {
    return true;
  }
  return ["resist", "vulnerable", "immune", "conditionImmunities"].some((key) => record[key] !== undefined);
}

/** An item that changes a fight, and a creature's hardness, which are 1.56. */
function entriesCarryArmor(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      if (plainRecord(record?.creature)?.hardness !== undefined) return true;
      const item = plainRecord(record?.item);
      if (!item) return false;
      const requires = Array.isArray(item.requires) ? item.requires : [];
      return [item.worn, item.carried, ...requires.map((requirement) => plainRecord(requirement)?.otherwise)].some(
        effectCarriesFightParts,
      );
    })
  );
}

const AMMO_ISSUE =
  "A ruleset whose weapons shoot ammunition or keep a loaded count requires schemaVersion 2 and capabilityApi 1.57 or newer";

/** A weapon's `ammo` or `clip`, which are 1.57: new keys on the strict attack. */
function entriesCarryAmmo(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const attack = plainRecord(plainRecord(plainRecord(entry)?.item)?.attack);
      return attack?.ammo !== undefined || attack?.clip !== undefined;
    })
  );
}

const WEAPON_WAYS_ISSUE =
  "A ruleset whose weapons have modes, an off-hand attack, a floor or conditions on a hit, or whose combat block names an off-hand budget, requires schemaVersion 2 and capabilityApi 1.58 or newer";

/** A weapon's `modes`, `offHand`, `floor` or `onHit`, which are 1.58: new keys on the strict attack. */
function entriesCarryWeaponWays(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const attack = plainRecord(plainRecord(plainRecord(entry)?.item)?.attack);
      return ["modes", "offHand", "floor", "onHit"].some((key) => attack?.[key] !== undefined);
    })
  );
}

const ITEM_USE_ISSUE =
  "A ruleset whose items are used in a fight or hold charges requires schemaVersion 2 and capabilityApi 1.59 or newer";

/** An item's `use` or `charges`, which are 1.59: new keys on the strict item. */
function entriesCarryItemUse(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return item?.use !== undefined || item?.charges !== undefined;
    })
  );
}

const ITEM_RESTORE_ISSUE =
  "A ruleset whose items restore a pool when used requires schemaVersion 2 and capabilityApi 1.60 or newer";

/** A use's `restore`, which is 1.60: a new key on the strict use. */
function entriesCarryItemRestore(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(plainRecord(entry)?.item)?.use)?.restore !== undefined)
  );
}

const CHARGES_OVER_TIME_ISSUE =
  "A ruleset whose items regain charges on a rest or break when emptied requires schemaVersion 2 and capabilityApi 1.61 or newer";

/** An item's `charges.recharge` or `charges.breaksOn`, which are 1.61: new keys on the strict charges. */
function entriesCarryChargesOverTime(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const charges = plainRecord(plainRecord(plainRecord(entry)?.item)?.charges);
      return charges?.recharge !== undefined || charges?.breaksOn !== undefined;
    })
  );
}

const ITEM_GATE_ISSUE =
  "A ruleset whose items ask a check before they work requires schemaVersion 2 and capabilityApi 1.62 or newer";

/** A use's `gate`, which is 1.62: a new key on the strict use. */
function entriesCarryItemGate(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(plainRecord(entry)?.item)?.use)?.gate !== undefined)
  );
}

const HELD_RIDER_ISSUE =
  "A ruleset whose riders fire on held weapons requires schemaVersion 2 and capabilityApi 1.70 or newer";

/** A rider that names held `weapons`, which is 1.70: a new key on the strict rider. */
function entriesCarryHeldRider(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(plainRecord(entry)?.mechanics)?.rider)?.weapons !== undefined)
  );
}

const MONEY_ISSUE =
  "A ruleset whose layers remove coins, or whose loot tables drop coins, requires schemaVersion 2 and capabilityApi 1.64 or newer";

/** A layer's `currencies`, or a loot line's `coins`, which are 1.64: new keys on the strict layer and line. */
function rulesetCarriesMoney164(ruleset: { layers?: unknown; items?: unknown } | undefined): boolean {
  const layers = Array.isArray(ruleset?.layers) ? ruleset.layers : [];
  const tables = plainRecord(ruleset?.items)?.lootTables;
  return (
    layers.some((layer) => plainRecord(layer)?.currencies !== undefined) ||
    (Array.isArray(tables) &&
      tables.some((table) => {
        const entries = plainRecord(table)?.entries;
        return Array.isArray(entries) && entries.some((entry) => plainRecord(entry)?.coins !== undefined);
      }))
  );
}

const COVER_ISSUE =
  "A ruleset that grades cover (three-quarters, saves, creatures) or has a save that ignores cover requires schemaVersion 2 and capabilityApi 1.74 or newer";

/** A save that ignores cover, on an entry's mechanics, a creature's action or an item's use, which is
 *  1.74: a new key on the strict save. */
function entriesCarryCoverlessSaves(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      const actions = plainRecord(record?.creature)?.actions;
      const saves = [
        plainRecord(record?.mechanics)?.save,
        plainRecord(plainRecord(record?.item)?.use)?.save,
        ...(Array.isArray(actions) ? actions.map((action) => plainRecord(action)?.save) : []),
      ];
      return saves.some((save) => plainRecord(save)?.ignoresCover !== undefined);
    })
  );
}

const MARKET_ISSUE =
  "A ruleset with a market, or whose items name where they are sold or are services, requires schemaVersion 2 and capabilityApi 1.65 or newer";

/** An item's `sold` or `service`, which are 1.65: new keys on the strict item. */
function entriesCarryMarket(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return item?.sold !== undefined || item?.service !== undefined;
    })
  );
}

const MARKET_DAY_ISSUE =
  "A ruleset whose market keeps stock, limits what a place keeps, buys back or has a purse requires schemaVersion 2 and capabilityApi 1.69 or newer";

/** A `sold` (a rule's or an item's) of 1.69: one with a limit. (One naming neither a place nor a
 *  limit is refused at import.) */
const soldOfMarketDay = (sold: unknown): boolean => plainRecord(sold)?.limited !== undefined;

/** An item's `sold` that keeps a limit, which is 1.69. */
function entriesCarryMarketDay(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const sold = plainRecord(plainRecord(entry)?.item)?.sold;
      return soldOfMarketDay(sold);
    })
  );
}

/** The market's 1.69 keys: a purse, a buy-back share, a seller's stock, a rule's limit. */
function rulesetCarriesMarketDay169(ruleset: { items?: unknown } | undefined): boolean {
  const market = plainRecord(plainRecord(ruleset?.items)?.market);
  if (!market) return false;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return (
    market.buyBack !== undefined ||
    list(market.places).some((place) => plainRecord(place)?.purse !== undefined) ||
    list(market.sellers).some((seller) => plainRecord(seller)?.stock !== undefined) ||
    list(market.sold).some(soldOfMarketDay)
  );
}

const HONESTY_ISSUE =
  "A ruleset with risky items, fakes or a dishonest seller requires schemaVersion 2 and capabilityApi 1.79 or newer";

const CRITICAL_RANGE_ISSUE =
  "A ruleset whose attack roll reads a critical range off the sheet requires schemaVersion 2 and capabilityApi 1.81 or newer";
const MULTIPLY_ISSUE =
  "A ruleset with a derived value that multiplies requires schemaVersion 2 and capabilityApi 1.82 or newer";
const AMOUNT_ADD_ISSUE =
  "A ruleset whose catalog entries add a sheet value to their amount requires schemaVersion 2 and capabilityApi 1.83 or newer";

const BUILDER_ISSUE =
  "A ruleset with a guided builder, or catalog entries that grant through one, requires schemaVersion 2 and capabilityApi 1.86 or newer";

/** What a pick through the guided builder grants (1.86): `grants`, a new key on the strict entry. */
function entriesCarryGrants(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => plainRecord(entry)?.grants !== undefined);
}

/** An item's to-hit that reads a bonus off its holder's sheet (1.95): `sheetBonus`, a new key on the
 *  strict to-hit of a weapon's attack and of an item's use. */
function entriesCarryToHitSheetBonus(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return (["attack", "use"] as const).some(
        (key) => plainRecord(plainRecord(item?.[key])?.toHit)?.sheetBonus !== undefined,
      );
    })
  );
}

/** A weapon's damage that reads a bonus off its holder's sheet (1.97): `sheetBonus` (and `oneHanded`),
 *  new keys on the strict damage. */
function entriesCarryDamageSheetBonus(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const damage = plainRecord(plainRecord(plainRecord(plainRecord(entry)?.item)?.attack)?.damage);
      return damage?.sheetBonus !== undefined || damage?.oneHanded !== undefined;
    })
  );
}

/** A weapon's damage dice rerolled off the holder's sheet (1.98): `rerollUpTo`, a new key on the strict
 *  damage. */
function entriesCarryDamageReroll(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some(
      (entry) =>
        plainRecord(plainRecord(plainRecord(plainRecord(entry)?.item)?.attack)?.damage)?.rerollUpTo !== undefined,
    )
  );
}

/** Harm that names what it carries past a resistance's `except` (1.101): `qualities` on an entry's
 *  mechanics or on a creature action's damage, a new key on each strict object. */
function entriesCarryBlowQualities(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      if (plainRecord(record?.mechanics)?.qualities !== undefined) return true;
      const actions = plainRecord(record?.creature)?.actions;
      return (
        Array.isArray(actions) &&
        actions.some((action) => plainRecord(plainRecord(action)?.damage)?.qualities !== undefined)
      );
    })
  );
}

/** A creature action that deals another amount while something holds, or a creature that carries a
 *  shield (1.102): `alternatives` on the strict damage, `shield` on the strict creature. */
function entriesCarryDamageAlternatives(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const creature = plainRecord(plainRecord(entry)?.creature);
      if (creature?.shield !== undefined) return true;
      const actions = creature?.actions;
      return (
        Array.isArray(actions) &&
        actions.some((action) => plainRecord(plainRecord(action)?.damage)?.alternatives !== undefined)
      );
    })
  );
}

/** A creature's size, or a condition that names what escaping it is rolled against (1.103): `size` on
 *  the strict creature, `escapeDc` on the strict applies of a creature action, an entry's mechanics
 *  or an item's use. */
function entriesCarrySizes(entries: unknown): boolean {
  const escapes = (applies: unknown) =>
    Array.isArray(applies) && applies.some((entry) => plainRecord(entry)?.escapeDc !== undefined);
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      const creature = plainRecord(record?.creature);
      if (creature?.size !== undefined) return true;
      if (escapes(plainRecord(record?.mechanics)?.applies)) return true;
      if (escapes(plainRecord(plainRecord(record?.item)?.use)?.applies)) return true;
      const actions = creature?.actions;
      return Array.isArray(actions) && actions.some((action) => escapes(plainRecord(action)?.applies));
    })
  );
}

/** A creature that moves other ways than walking (1.113): `speeds` and `hover` on the strict creature. */
function entriesCarryMoveModes(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const creature = plainRecord(plainRecord(entry)?.creature);
      return creature?.speeds !== undefined || creature?.hover !== undefined;
    })
  );
}

/** An attack that leaves something to strike on later turns (1.122). */
function entriesCarrySummons(entries: unknown): boolean {
  return (
    Array.isArray(entries) && entries.some((entry) => plainRecord(plainRecord(entry)?.mechanics)?.summons !== undefined)
  );
}

/** A creature that casts catalog spells without slots (1.123). */
function entriesCarryCreatureSpellcasting(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(entry)?.creature)?.spellcasting !== undefined)
  );
}

/** A line with a width (1.128), on an entry or a creature action. */
function entriesCarryLineWidth(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      const actions = plainRecord(record?.creature)?.actions;
      return (
        plainRecord(plainRecord(record?.mechanics)?.area)?.width !== undefined ||
        (Array.isArray(actions) &&
          actions.some((action) => plainRecord(plainRecord(action)?.area)?.width !== undefined))
      );
    })
  );
}

/** An effect whose target needs a sense (1.127), on an entry or a creature action. */
function entriesCarrySenseNeeds(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      const actions = plainRecord(record?.creature)?.actions;
      return (
        plainRecord(record?.mechanics)?.needs !== undefined ||
        (Array.isArray(actions) && actions.some((action) => plainRecord(action)?.needs !== undefined))
      );
    })
  );
}

/** A rider that needs an adjacent ally without disadvantage (1.126), on an entry or a creature. */
function entriesCarryRiderNoDisadvantage(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const record = plainRecord(entry);
      const riders = plainRecord(record?.creature)?.riders;
      return [
        plainRecord(plainRecord(record?.mechanics)?.rider),
        ...(Array.isArray(riders) ? riders.map(plainRecord) : []),
      ].some((rider) => Array.isArray(rider?.when) && rider.when.includes("ally-adjacent-no-disadvantage"));
    })
  );
}

/** A creature action that heals or reaches its own side (1.121): new keys on the strict action. */
function entriesCarryCreatureHealing(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const actions = plainRecord(plainRecord(entry)?.creature)?.actions;
      return (
        Array.isArray(actions) &&
        actions.some((action) => {
          const record = plainRecord(action);
          return record?.heal !== undefined || record?.targets !== undefined;
        })
      );
    })
  );
}

/** Anything that halves the health maximum (1.115): a new target of the strict modifier, wherever a
 *  modifier sits (a level, a condition, an item's effect). */
function carriesHealthMax(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealthMax(one, depth + 1));
  const record = value as Record<string, unknown>;
  if (record.to === "health-max") return true;
  return Object.values(record).some((one) => carriesHealthMax(one, depth + 1));
}

/** A reaction that stops only so high, or the check above it (1.116): new keys on the strict moment,
 *  wherever a reaction sits (a catalog entry's mechanics, a creature's action). */
function carriesCounterReach(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesCounterReach(one, depth + 1));
  const record = value as Record<string, unknown>;
  const reaction = plainRecord(record.reaction);
  if (reaction && (reaction.upTo !== undefined || reaction.above !== undefined)) return true;
  return Object.values(record).some((one) => carriesCounterReach(one, depth + 1));
}

/** A reaction that answers named entries, or is also taken at more moments (1.117): new keys on the
 *  strict moment and its `against`. */
function carriesNamedAnswers(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesNamedAnswers(one, depth + 1));
  const record = value as Record<string, unknown>;
  const reaction = plainRecord(record.reaction);
  if (reaction && (reaction.also !== undefined || plainRecord(reaction.against)?.entries !== undefined)) return true;
  return Object.values(record).some((one) => carriesNamedAnswers(one, depth + 1));
}

/** Reactions for others, at turn start, on a save, or for several fallers (1.131). */
function carriesReactionMoments(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesReactionMoments(one, depth + 1));
  const record = value as Record<string, unknown>;
  if (record.duration === "this-action") return true;
  const reaction = plainRecord(record.reaction);
  const moments = [reaction, ...(Array.isArray(reaction?.also) ? reaction.also.map(plainRecord) : [])];
  if (
    moments.some(
      (moment) =>
        moment &&
        ((moment.for !== undefined && moment.for !== "self") ||
          moment.at === "target" ||
          moment.on === "turn-start" ||
          moment.cancelSave !== undefined ||
          plainRecord(moment.against)?.actions !== undefined ||
          (moment.on === "falls" && typeof record.targetCount === "number" && record.targetCount > 1)),
    )
  )
    return true;
  return Object.values(record).some((one) => carriesReactionMoments(one, depth + 1));
}

/** Mechanics offered only while the holder's sheet allows (1.166). */
function carriesUsableWhen(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesUsableWhen(one, depth + 1));
  const record = value as Record<string, unknown>;
  if (plainRecord(record.mechanics)?.usableWhen !== undefined) return true;
  return Object.values(record).some((one) => carriesUsableWhen(one, depth + 1));
}

/** A reaction that catches a fall, at its first moment or one it is also taken at (1.124). */
function carriesFalls(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesFalls(one, depth + 1));
  const record = value as Record<string, unknown>;
  const reaction = plainRecord(record.reaction);
  if (reaction?.on === "falls") return true;
  if (Array.isArray(reaction?.also) && reaction.also.some((one) => plainRecord(one)?.on === "falls")) return true;
  return Object.values(record).some((one) => carriesFalls(one, depth + 1));
}

/** A reaction narrowed to one kind of blow, or to a source its holder sees (1.118): new keys on the
 *  strict moment, at its first moment or one it is `also` taken at. */
function carriesBlowNarrowing(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesBlowNarrowing(one, depth + 1));
  const record = value as Record<string, unknown>;
  const reaction = plainRecord(record.reaction);
  const narrowed = (moment: Record<string, unknown> | undefined) =>
    !!moment && (moment.blow !== undefined || moment.seesSource !== undefined);
  if (narrowed(reaction)) return true;
  if (Array.isArray(reaction?.also) && reaction.also.some((one) => narrowed(plainRecord(one)))) return true;
  return Object.values(record).some((one) => carriesBlowNarrowing(one, depth + 1));
}

/** A catalog entry whose area stays, in catalog files too (1.172). */
function carriesZones(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZones(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.mechanics)?.zone !== undefined) return true;
  return Object.values(record).some((one) => carriesZones(one, depth + 1));
}

/** A box or wall area, or a zone that blocks or has a side, in catalog files too (1.177). */
function carriesWalls(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWalls(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use), record]) {
    if (!mechanics) continue;
    const area = plainRecord(mechanics.area);
    if (area && (area.shape === "box" || area.shape === "wall" || area.ring !== undefined)) return true;
    const zone = plainRecord(mechanics.zone);
    if (zone && (zone.blocks !== undefined || zone.side !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesWalls(one, depth + 1));
}

/** Components, and zones that work on whoever stands in them (1.179): the combat block's
 *  components, what an entry, a creature's action or a condition needs or stops, and a zone's
 *  `inside`, `forbids` or `wards`, in catalog files too. */
function carriesZoneInside(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneInside(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.combat)?.components !== undefined) return true;
  if (record.condition !== undefined && record.forbids !== undefined) return true;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use), record]) {
    if (!mechanics) continue;
    const zone = plainRecord(mechanics.zone);
    if (zone && (zone.inside !== undefined || zone.forbids !== undefined || zone.wards !== undefined)) return true;
    if (mechanics.components !== undefined && (mechanics.budget !== undefined || mechanics.kind !== undefined)) {
      return true;
    }
  }
  return Object.values(record).some((one) => carriesZoneInside(one, depth + 1));
}

/** What ends a condition when its holder attacks or casts, senses a condition or an item gives, a
 *  condition that gives away the unseen, and an item's use that casts (1.180), in catalog files too. */
function carriesSightExtras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSightExtras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.endsWhenHolder !== undefined) return true;
  if (record.condition !== undefined && (record.senses !== undefined || record.cancelsUnseen !== undefined)) {
    return true;
  }
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried), plainRecord(record.otherwise)]) {
    if (effect?.senses !== undefined) return true;
  }
  if (plainRecord(record.use)?.casts !== undefined) return true;
  return Object.values(record).some((one) => carriesSightExtras(one, depth + 1));
}

/** Wards by base level or raised by their cast's steps, saves that say what else they are against or
 *  who passes them outright, a creature's spell components said in place of the entries', and an
 *  item's utility use (1.181), in catalog files too. */
function carriesWardsAndSaves(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWardsAndSaves(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use), record]) {
    if (!mechanics) continue;
    const wards = plainRecord(plainRecord(mechanics.zone)?.wards);
    if (wards && (wards.by !== undefined || wards.maxLevelPerCostStep !== undefined)) return true;
    const save = plainRecord(mechanics.save);
    if (save && (save.against !== undefined || save.succeeds !== undefined)) return true;
  }
  if (plainRecord(record.use)?.kind === "utility") return true;
  const casting = plainRecord(record.spellcasting);
  if (casting) {
    if (casting.components !== undefined) return true;
    const spells = Array.isArray(casting.spells) ? casting.spells : [];
    if (spells.some((spell) => plainRecord(spell)?.components !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesWardsAndSaves(one, depth + 1));
}

const MODIFIER_TARGETS = new Set<string>(RULESET_COMBAT_MODIFIER_TARGETS);

/** A combat condition whose grant is melee only, or that moves tracks as it ends (1.239). */
function carriesFrenzy(ruleset: unknown): boolean {
  const conditions = plainRecord(plainRecord(ruleset)?.combat)?.conditions;
  if (!Array.isArray(conditions)) return false;
  return conditions.some((entry) => {
    const record = plainRecord(entry);
    return plainRecord(record?.grants)?.melee !== undefined || plainRecord(record?.onEnd)?.tracks !== undefined;
  });
}

/** Attack rows changed by what a sheet holds, strikes it grants, entries only after the attack action,
 *  or a condition's granted attacks narrowed by name or to after the attack action (1.242), in
 *  catalogs too. */
/** An entry that changes how another is used (1.253), in catalogs too. */
function carriesMetamagic(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMetamagic(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usesSpentByLevel !== undefined) return true;
  const mechanics = plainRecord(record.mechanics);
  if (mechanics && mechanics.alters !== undefined) return true;
  return Object.values(record).some((one) => carriesMetamagic(one, depth + 1));
}

/** Somebody's own ways of hiding and finding the hidden (1.292): a `hiding` that is not the
 *  fight's own (which names its checks). */
function carriesHidingTraits(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHidingTraits(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const hiding = plainRecord(record.hiding);
  if (hiding && hiding.stealth === undefined) return true;
  return featureValues(record).some((one) => carriesHidingTraits(one, depth + 1));
}

/** An aura that grows, lingers or harms on its targets' turns, a holder who tears free, a hold with a
 *  most, or a creature that hangs on at 1 (1.320). */
function carriesBossAsks(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBossAsks(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // An aura's own `grows`, not a delayed blast's (1.183).
  if ((record.grows !== undefined && record.side !== undefined) || record.lingers !== undefined) return true;
  if (record.heldAtMost !== undefined) return true;
  if (record.hangsOn !== undefined) return true;
  if (plainRecord(record.harms)?.on !== undefined || plainRecord(record.shakeOff)?.self !== undefined) return true;
  return featureValues(record).some((one) => carriesBossAsks(one, depth + 1));
}

/** An item's use that gives its user more of the turn (1.334): the Time-Flour Loaf. */
function carriesItemGives(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemGives(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // A use's, or one of its `moreUses`' as the walk reaches each.
  if (plainRecord(record.use)?.gives !== undefined) return true;
  return featureValues(record).some((one) => carriesItemGives(one, depth + 1));
}

/** A lasting area with a look of its own on a fight's board (1.333). */
function carriesBoardArt(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBoardArt(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof plainRecord(record.zone)?.art === "string") return true;
  return featureValues(record).some((one) => carriesBoardArt(one, depth + 1));
}

/** A use only beside a prop, or a ground change whose occupants stay in it (1.332). */
function carriesNearUseOrFall(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesNearUseOrFall(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usableNear !== undefined) return true;
  if (plainRecord(record.ground)?.occupants !== undefined) return true;
  return featureValues(record).some((one) => carriesNearUseOrFall(one, depth + 1));
}

/** Props and felling in a condition or a creature action (1.331): a condition held only near a
 *  prop, an aura that feeds, an area around props. */
function carriesPropsAndFeeding(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPropsAndFeeding(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.whileNearProp !== undefined || record.aroundProp !== undefined || typeof record.feeds === "number")
    return true;
  return featureValues(record).some((one) => carriesPropsAndFeeding(one, depth + 1));
}

/** A condition that moves the difficulty of the saves its holder calls for (1.328). */
function carriesSaveDifficulty(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSaveDifficulty(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.to === "save-difficulty") return true;
  return featureValues(record).some((one) => carriesSaveDifficulty(one, depth + 1));
}

/** How a sheet, a menu or a card reads, in the ruleset's own words (1.378): a modifier's own label,
 *  a creature trait over the old 400 letters, a text field hidden by a value, a condition left out
 *  of the picker, a track shown once moved, a pool's unit, a list's display, an item toggle's labels,
 *  and an item use's own title. */
function carriesSheetWords(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSheetWords(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    typeof record.to === "string" &&
    (RULESET_COMBAT_MODIFIER_TARGETS as readonly string[]).includes(record.to) &&
    record.label !== undefined
  )
    return true;
  if (
    Array.isArray(record.traits) &&
    record.traits.some((trait) => {
      const text = plainRecord(trait)?.text;
      return typeof text === "string" && text.length > 400;
    })
  )
    return true;
  if (
    record.pickable !== undefined ||
    record.showWhenSet !== undefined ||
    record.onLabel !== undefined ||
    record.offLabel !== undefined
  )
    return true;
  if (plainRecord(record.use)?.title !== undefined) return true;
  return featureValues(record).some((one) => carriesSheetWords(one, depth + 1));
}

/** The 1.378 keys only the ruleset's own sheet carries: a text field's `hideWhen`, a pool's `unit`
 *  and `units`, a list's `display`, and a derived value's `signed`. */
function rulesetCarriesSheetDisplay(ruleset: unknown): boolean {
  const sheet = plainRecord(plainRecord(ruleset)?.sheet);
  const live = plainRecord(sheet?.live);
  const some = (list: unknown, test: (one: Record<string, unknown>) => boolean) =>
    Array.isArray(list) && list.some((one) => !!plainRecord(one) && test(plainRecord(one)!));
  return (
    some(live?.text, (one) => one.hideWhen !== undefined) ||
    some(live?.pools, (one) => one.unit !== undefined || one.units !== undefined) ||
    some(sheet?.lists, (one) => one.display !== undefined) ||
    some(sheet?.derived, (one) => one.signed !== undefined)
  );
}

/** Whether a catalog entry or a condition names its icon (1.338). */
function carriesArtIcon(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesArtIcon(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.icon === "string" && record.icon.startsWith("ic_")) return true;
  return featureValues(record).some((one) => carriesArtIcon(one, depth + 1));
}

/** Whether anything names a list of lair actions for a broken concentration to pick from (1.336). */
function carriesBrokenLairList(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBrokenLairList(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.brokenNextLair)) return true;
  return featureValues(record).some((one) => carriesBrokenLairList(one, depth + 1));
}

/** Lair timing (1.327): a creature action only at whoever has acted this round, one whose broken
 *  concentration picks the next lair action, or a condition lasting until the next lair action. */
function carriesLairTiming(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLairTiming(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duration)?.untilLair !== undefined) return true;
  const creature = plainRecord(record.creature);
  if (
    Array.isArray(creature?.actions) &&
    creature.actions.some((one) => {
      const action = plainRecord(one);
      return action?.actedOnly !== undefined || action?.brokenNextLair !== undefined;
    })
  )
    return true;
  return featureValues(record).some((one) => carriesLairTiming(one, depth + 1));
}

/** A creature's action that draws whoever it lands on toward it (1.326). */
function carriesDraws(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDraws(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const creature = plainRecord(record.creature);
  if (Array.isArray(creature?.actions) && creature.actions.some((one) => plainRecord(one)?.draws !== undefined))
    return true;
  return featureValues(record).some((one) => carriesDraws(one, depth + 1));
}

/** Hanging on at 1 on a condition or a level, or a creature's with the terms 1.400 added. A creature's
 *  plain `uses` and `extraTurn` are 1.320's. */
function carriesHangsOn384(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHangsOn384(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const hangs = plainRecord(record.hangsOn);
  if (hangs) {
    // A creature's block is the record holding its actions; a condition or level holds none.
    if (!Array.isArray(record.actions)) return true;
    if (Object.keys(hangs).some((key) => !["uses", "extraTurn", "label"].includes(key))) return true;
  }
  return featureValues(record).some((one) => carriesHangsOn384(one, depth + 1));
}

/** Regeneration on a condition, a level or a creature (1.396). */
function carriesRegeneration(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRegeneration(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.regenerates)) return true;
  return featureValues(record).some((one) => carriesRegeneration(one, depth + 1));
}

/** A combat condition that gives ways of moving, hovering or levitation (1.395). */
function carriesGivenSpeeds(ruleset: unknown): boolean {
  const combat = plainRecord(plainRecord(ruleset)?.combat);
  const conditions = Array.isArray(combat?.conditions) ? combat.conditions : [];
  return conditions.some((one) => {
    const condition = plainRecord(one);
    return (
      !!condition &&
      (condition.speeds !== undefined || condition.hover !== undefined || condition.levitates !== undefined)
    );
  });
}

/** A call from a catalog entry or an item use (1.394): `calls` anywhere but a creature's action. */
function carriesCatalogCalls(value: unknown, depth = 0, inCreature = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCatalogCalls(one, depth + 1, inCreature));
  const record = plainRecord(value);
  if (!record) return false;
  if (!inCreature && plainRecord(record.calls)) return true;
  return Object.entries(record).some(
    ([key, one]) =>
      !(ID_KEYED_MAPS.has(key) && plainRecord(one)) &&
      carriesCatalogCalls(one, depth + 1, inCreature || key === "creature"),
  );
}

/** Attack gates on who stands beside and who is hurt (1.393): a creature's attack mode with
 *  `allyAdjacent` or `targetHurt`, a rider `when` "target-hurt", or a rider once on its holder's own turn. */
function carriesAttackGates380(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAttackGates380(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.allyAdjacent === true || record.targetHurt === true || record.oncePer === "own-turn") return true;
  if (Array.isArray(record.when) && record.when.includes("target-hurt")) return true;
  return featureValues(record).some((one) => carriesAttackGates380(one, depth + 1));
}

/** What an untrained skill or save adds off the sheet, or an ability check (1.419): Jack of All
 *  Trades, Remarkable Athlete. Read off the sheet's own abilities, skills, saves and sections. */
function carriesUntrainedAdd403(ruleset: unknown): boolean {
  const sheet = plainRecord(plainRecord(ruleset)?.sheet);
  if (!sheet) return false;
  const entries = (key: string) => (Array.isArray(sheet[key]) ? (sheet[key] as unknown[]) : []);
  if (entries("abilities").some((one) => plainRecord(plainRecord(one)?.checkAdd))) return true;
  return ["skills", "saves", "sections"].some((key) =>
    entries(key).some((one) => plainRecord(plainRecord(plainRecord(one)?.untrained)?.add)),
  );
}

/** What ends a catalog's entries' conditions on its target (1.424): Dispel Magic, Cleansing Touch. */
/** A weapon struck over an area, and a strike again near the first (1.428): Whirlwind Attack,
 *  Volley, Horde Breaker. */
/** A condition that keeps its holder from harming anybody, or a behavior measured from a point
 *  (1.457): Symbol of Hopelessness and Fear. */
function carriesHarmlessOrPoint441(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHarmlessOrPoint441(one, depth + 1));
  if (value === "cannot-harm") return true;
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.from !== undefined) return true;
  if (Array.isArray(record.effects) && record.effects.includes("cannot-harm")) return true;
  return featureValues(record).some((one) => carriesHarmlessOrPoint441(one, depth + 1));
}

/** A zone that outlasts its caster (1.456): Glyph of Warding, Symbol. */
function carriesOutlasts440(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOutlasts440(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.outlasts !== undefined && record.rounds !== undefined) return true;
  return featureValues(record).some((one) => carriesOutlasts440(one, depth + 1));
}

/** A zone hidden from its caster's foes (1.455): Glyph of Warding, Symbol. */
function carriesHiddenZones439(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHiddenZones439(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.hidden !== undefined && plainRecord(record.hidden)?.check !== undefined) return true;
  return featureValues(record).some((one) => carriesHiddenZones439(one, depth + 1));
}

/** A glyph that stores one of its caster's own entries (1.454): a spell glyph. */
function carriesStores438(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStores438(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.detonates)?.stores !== undefined) return true;
  return featureValues(record).some((one) => carriesStores438(one, depth + 1));
}

/** A zone that stays as something else once set off (1.453): Symbol's sphere. */
function carriesBecomes437(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBecomes437(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.detonates)?.becomes !== undefined) return true;
  return featureValues(record).some((one) => carriesBecomes437(one, depth + 1));
}

/** An item that crosses hard going freely, or a condition that answers a hit by itself (1.489): the
 *  Ring of Free Action, Holy Aura's flash. */
function carriesFreeActionAndFlash473(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFreeActionAndFlash473(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.whenHit !== undefined) return true;
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried), plainRecord(record.otherwise)]) {
    if (effect?.ignoresHardGround !== undefined) return true;
  }
  return featureValues(record).some((one) => carriesFreeActionAndFlash473(one, depth + 1));
}

/** Hanging on that ends its condition, or wards off being slain outright (1.596): Death Ward. */
function carriesDeathWard580(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDeathWard580(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const hangs = plainRecord(record.hangsOn);
  if (hangs && (hangs.ends !== undefined || hangs.outright !== undefined)) return true;
  return featureValues(record).some((one) => carriesDeathWard580(one, depth + 1));
}

/** A barrier that stops reach, or ends carried over one it keeps out (1.595): Antilife Shell. */
function carriesReachBarrier579(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReachBarrier579(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const kept = plainRecord(record.keepsOut);
  if (kept && (kept.reach !== undefined || kept.endsOnSweep !== undefined)) return true;
  return featureValues(record).some((one) => carriesReachBarrier579(one, depth + 1));
}

/** Targets each within a distance of the first (1.594): Chain Lightning. */
function carriesTargetsNearFirst578(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTargetsNearFirst578(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.targetsWithinFirst === "number") return true;
  return featureValues(record).some((one) => carriesTargetsNearFirst578(one, depth + 1));
}

/** An amount times so many, or split among those caught (1.593): a Wand of Wonder's gems. */
function carriesDividedAmount577(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDividedAmount577(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.amount !== undefined && (record.amountTimes !== undefined || record.dividedAmong !== undefined))
    return true;
  return featureValues(record).some((one) => carriesDividedAmount577(one, depth + 1));
}

/** An entry's or item use's save failed by a margin (1.592): a Wand of Wonder's petrification. */
function carriesEntryFailedBy576(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEntryFailedBy576(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.onSuccess !== undefined && record.failedBy !== undefined) return true;
  return featureValues(record).some((one) => carriesEntryFailedBy576(one, depth + 1));
}

/** A rolled call kept, counted or spent, or an option's own rounds (1.591): an Efreeti Bottle. */
function carriesLastingRoll575(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLastingRoll575(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.rolled === true && (record.keepsRoll !== undefined || record.lifetimeUses !== undefined)) return true;
  if (
    record.rolled === true &&
    Array.isArray(record.options) &&
    record.options.some((option) => {
      const one = plainRecord(option);
      return !!one && (one.rounds !== undefined || one.spendsItem !== undefined || one.pastLifetime !== undefined);
    })
  )
    return true;
  return featureValues(record).some((one) => carriesLastingRoll575(one, depth + 1));
}

/** Item-paid slots held to a most (1.590): the Rod of Absorption's 5th level. */
function carriesPaysSlotsMax574(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPaysSlotsMax574(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.paysSlotsMax !== undefined) return true;
  return featureValues(record).some((one) => carriesPaysSlotsMax574(one, depth + 1));
}

/** Languages split out of one row (1.589): 5e's "Languages: Common and Dwarvish". */
function carriesLanguageSplit573(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLanguageSplit573(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.list !== undefined && record.column !== undefined && record.split !== undefined) return true;
  return featureValues(record).some((one) => carriesLanguageSplit573(one, depth + 1));
}

/** A condition that gives cover to its source or its source's caller (1.588): the Interposing Hand. */
function carriesCoverFor572(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCoverFor572(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.coverFor !== undefined) return true;
  return featureValues(record).some((one) => carriesCoverFor572(one, depth + 1));
}

/** A contest with advantage by size, or a push read off a sheet (1.587): the Forceful Hand. */
function carriesContestReads571(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesContestReads571(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.onWin !== undefined && record.advantageAtMostSize !== undefined) return true;
  if (record.pushRead !== undefined) return true;
  return featureValues(record).some((one) => carriesContestReads571(one, depth + 1));
}

/** A called creature's action that keeps its caller's number off, or grows with the call (1.586):
 *  Arcane Hand's Clenched Fist. */
function carriesCallerSteps570(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallerSteps570(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.budget !== undefined && (record.callerAdds !== undefined || record.perCallerStep !== undefined))
    return true;
  return featureValues(record).some((one) => carriesCallerSteps570(one, depth + 1));
}

/** A condition that counts as others (1.585): Enthrall as charmed. */
function carriesCountsAs569(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCountsAs569(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.countsAs !== undefined) return true;
  return featureValues(record).some((one) => carriesCountsAs569(one, depth + 1));
}

/** A condition that ends through its source (1.584): Enthrall. */
function carriesEndsWhenSource568(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsWhenSource568(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.endsWhenSource !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsWhenSource568(one, depth + 1));
}

/** An item's use that repeats (1.583): a scroll of Telekinesis. Any `use` or `moreUses` with
 *  `repeats`. */
function carriesItemRepeats567(value: unknown, depth = 0, underUse = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemRepeats567(one, depth + 1, underUse));
  const record = plainRecord(value);
  if (!record) return false;
  if (underUse && record.repeats !== undefined) return true;
  for (const [key, one] of Object.entries(record)) {
    if (key === "use" && carriesItemRepeats567(one, depth + 1, true)) return true;
    if (key === "moreUses" && carriesItemRepeats567(one, depth + 1, false)) return true;
  }
  return featureValues(record).some((one) => carriesItemRepeats567(one, depth + 1));
}

/** A save rolled with advantage by a target being fought (1.582): Charm Person. */
function carriesAdvantageIfFought566(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAdvantageIfFought566(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.advantageIfFought !== undefined) return true;
  return featureValues(record).some((one) => carriesAdvantageIfFought566(one, depth + 1));
}

/** A zone that turns shots aside (1.581): Wind Wall. */
function carriesTurnsShots565(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTurnsShots565(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.turnsShots !== undefined) return true;
  return featureValues(record).some((one) => carriesTurnsShots565(one, depth + 1));
}

/** A zone stage that shakes concentration or is a wind (1.580): Storm of Vengeance. */
function carriesStageWind564(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStageWind564(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.stages) &&
    record.stages.some((stage) => {
      const one = plainRecord(stage);
      return !!one && (one.breaksConcentration !== undefined || one.disperses !== undefined);
    })
  )
    return true;
  return featureValues(record).some((one) => carriesStageWind564(one, depth + 1));
}

/** A zone's inside save thrown as it is cast (1.579): Reverse Gravity. */
function carriesInsideOnCast563(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInsideOnCast563(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.ignoresUntilLeaves !== undefined && record.onCast !== undefined) return true;
  return featureValues(record).some((one) => carriesInsideOnCast563(one, depth + 1));
}

/** A contest offered only to an actor holding certain conditions (1.578): Grappler's pin. */
function carriesActorHolds562(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesActorHolds562(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.actorHolds !== undefined && record.onWin !== undefined) return true;
  return featureValues(record).some((one) => carriesActorHolds562(one, depth + 1));
}

/** A condition that puts its holder on its source's side, or whose source throws as its holder dies
 *  (1.577): Magic Jar. */
function carriesControls561(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesControls561(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && (record.controls !== undefined || record.holderDies !== undefined)) return true;
  return featureValues(record).some((one) => carriesControls561(one, depth + 1));
}

/** An item found holding stored entries (1.576): a Ring of Spell Storing's 1d6 - 1 levels. */
function carriesStoresFound560(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStoresFound560(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.stores)?.found !== undefined) return true;
  return featureValues(record).some((one) => carriesStoresFound560(one, depth + 1));
}

/** An item that changes form (1.575): a Rod of Lordly Might. */
function carriesItemForms559(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemForms559(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.category !== undefined && plainRecord(record.forms)?.into !== undefined) return true;
  return featureValues(record).some((one) => carriesItemForms559(one, depth + 1));
}

/** A charge followed by the charging action again (1.574): a warhorse's Trampling Charge. */
function carriesChargeThenItself558(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChargeThenItself558(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const then = plainRecord(plainRecord(record.charge)?.then);
  if (then && typeof record.id === "string" && then.action === record.id) return true;
  return featureValues(record).some((one) => carriesChargeThenItself558(one, depth + 1));
}

/** An item found holding a rolled count of charges (1.573): a Rod of Absorption's 1d10. */
function carriesRolledCharges557(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRolledCharges557(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.charges)?.rolled !== undefined && record.category !== undefined) return true;
  return featureValues(record).some((one) => carriesRolledCharges557(one, depth + 1));
}

/** A worn item whose charges pay for a pool group's uses (1.572): a Rod of Absorption's spells. */
function carriesPaysSlots556(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPaysSlots556(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried)]) {
    if (effect?.paysSlots !== undefined) return true;
  }
  return featureValues(record).some((one) => carriesPaysSlots556(one, depth + 1));
}

/** What an item takes in, counted over its whole existence (1.571): a Rod of Absorption's 50. */
function carriesAbsorbsLifetime555(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAbsorbsLifetime555(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.absorbs)?.lifetime !== undefined) return true;
  return featureValues(record).some((one) => carriesAbsorbsLifetime555(one, depth + 1));
}

/** Absorbing narrowed to seen casters, or paid for with a budget (1.570): a Rod of Absorption. */
function carriesAbsorbsSeenSpends554(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAbsorbsSeenSpends554(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const absorbs = plainRecord(record.absorbs);
  if (absorbs && (absorbs.seen !== undefined || absorbs.spends !== undefined)) return true;
  return featureValues(record).some((one) => carriesAbsorbsSeenSpends554(one, depth + 1));
}

/** What is stored cast by itself at a moment (1.569): Contingency. */
function carriesStoresCastsOn553(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStoresCastsOn553(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.stores)?.castsOn !== undefined) return true;
  return featureValues(record).some((one) => carriesStoresCastsOn553(one, depth + 1));
}

/** Called images rather than creatures (1.568): Mislead's double. */
function carriesIllusionCalls552(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesIllusionCalls552(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.illusion !== undefined) return true;
  return featureValues(record).some((one) => carriesIllusionCalls552(one, depth + 1));
}

/** A check mode narrowed to finding anybody but a condition's source (1.567): Enthrall. */
function carriesExceptSource551(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesExceptSource551(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.exceptSource !== undefined) return true;
  return featureValues(record).some((one) => carriesExceptSource551(one, depth + 1));
}

/** A condition that lifts its holder (1.566): Reverse Gravity. */
function carriesLifts550(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLifts550(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && typeof record.lifts === "number") return true;
  return featureValues(record).some((one) => carriesLifts550(one, depth + 1));
}

/** An entry won over by a contest of checks, or one that moves its target where its user picks
 *  (1.565): Telekinesis. */
function carriesContestAndCarry549(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesContestAndCarry549(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.movesTarget !== undefined) return true;
  if (Array.isArray(plainRecord(record.contest)?.attacker)) return true;
  return featureValues(record).some((one) => carriesContestAndCarry549(one, depth + 1));
}

/** A reaction narrowed by qualities, or by what the one it answers for holds (1.564). */
function carriesReactionQualities548(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReactionQualities548(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.forHolds !== undefined) return true;
  if (plainRecord(record.against)?.qualities !== undefined) return true;
  return featureValues(record).some((one) => carriesReactionQualities548(one, depth + 1));
}

/** A heal shared out among its targets (1.563): Preserve Life. */
function carriesSharedHeal547(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSharedHeal547(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sharesHeal !== undefined) return true;
  return featureValues(record).some((one) => carriesSharedHeal547(one, depth + 1));
}

/** A condition that harms its holder for attacking whoever put it on (1.562): Geas. */
function carriesDefianceHarm546(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDefianceHarm546(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const harms = plainRecord(record.harms);
  if (harms && (harms.at === "attacks-source" || harms.at === "attacks-source-side" || harms.once !== undefined))
    return true;
  return featureValues(record).some((one) => carriesDefianceHarm546(one, depth + 1));
}

/** Languages, and a target test of who understands its user (1.561): Suggestion. */
function carriesLanguages545(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLanguages545(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.understands !== undefined) return true;
  if (plainRecord(record.languages)?.list !== undefined) return true;
  if (Array.isArray(record.languages) && (record.health !== undefined || Array.isArray(record.actions))) return true;
  return featureValues(record).some((one) => carriesLanguages545(one, depth + 1));
}

/** A creature that deals double damage to objects (1.560): Siege Monster. */
function carriesDoubleToObjects544(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDoubleToObjects544(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.doubleToObjects !== undefined) return true;
  return featureValues(record).some((one) => carriesDoubleToObjects544(one, depth + 1));
}

/** A call or an item's use rolled for (1.559): a Bag of Tricks, a Wand of Wonder. */
function carriesRolledTables543(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRolledTables543(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.rolled !== undefined) return true;
  if (record.useTable !== undefined || record.rollsTable !== undefined) return true;
  return featureValues(record).some((one) => carriesRolledTables543(one, depth + 1));
}

/** Creatures built from their caller, or commanded by them (1.558): Arcane Hand. */
function carriesCommandedCalls542(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCommandedCalls542(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls && (calls.fromCaller !== undefined || calls.commandedWith !== undefined)) return true;
  return featureValues(record).some((one) => carriesCommandedCalls542(one, depth + 1));
}

/** A zone in stages (1.557): Storm of Vengeance. */
function carriesZoneStages541(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneStages541(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.zone)?.stages !== undefined) return true;
  return featureValues(record).some((one) => carriesZoneStages541(one, depth + 1));
}

/** Charges or uses that come back after a wait in game time (1.556): a figurine's days. */
function carriesItemWaits540(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemWaits540(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.recharge)?.after !== undefined) return true;
  return featureValues(record).some((one) => carriesItemWaits540(one, depth + 1));
}

/** Cover a wall gives, speeds that are the only ones, regeneration kept off somewhere, and target
 *  tests of fliers, of conditions held or of alternatives (1.555): Blade Barrier, Gaseous Form, a
 *  vampire, Wind Wall. */
function carriesWallCoverAndOnlySpeeds539(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWallCoverAndOnlySpeeds539(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.zone)?.cover !== undefined) return true;
  if (record.onlySpeeds !== undefined) return true;
  if (plainRecord(record.regenerates)?.notIn !== undefined) return true;
  // A bound item's needsWorn groups also say anyOf, but of item refs, not of target tests.
  if (Array.isArray(record.anyOf) && record.anyOf.some((one) => plainRecord(one))) return true;
  if (record.flying !== undefined || Array.isArray(record.holding)) return true;
  return featureValues(record).some((one) => carriesWallCoverAndOnlySpeeds539(one, depth + 1));
}

/** Calls raised from a corpse, or held to a most (1.554): a wraith's Create Specter. */
function carriesCorpseCalls538(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCorpseCalls538(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls && (calls.atCorpse !== undefined || calls.atMost !== undefined)) return true;
  return featureValues(record).some((one) => carriesCorpseCalls538(one, depth + 1));
}

/** A step that takes all it offers and writes what it took to a field (1.773): 5e's subclass. */
function carriesTakesAllField757(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTakesAllField757(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.kind === "catalog" && record.takesAll !== undefined && record.field !== undefined) return true;
  return featureValues(record).some((one) => carriesTakesAllField757(one, depth + 1));
}

/** Help against an opponent beside the helper (1.771): `combat.standardEffects.help`. */
/** A catalog entry that is its exclusive group's default (1.772): the ability score improvement. */
function carriesExclusiveDefault756(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesExclusiveDefault756(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.id === "string" && record.exclusiveDefault !== undefined) return true;
  return featureValues(record).some((one) => carriesExclusiveDefault756(one, depth + 1));
}

function carriesHelpBeside755(ruleset: unknown): boolean {
  const effects = plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.standardEffects);
  return effects?.help !== undefined;
}

/** Cover that drops the ground under the target (1.770): `combat.cover.groundUnderTarget`. */
function carriesGroundUnderTarget754(ruleset: unknown): boolean {
  const cover = plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.cover);
  return cover?.groundUnderTarget !== undefined;
}

/** A catalog entry with variants, or one that is a variant (1.769): Chromatic Orb's kinds. */
function carriesVariants753(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesVariants753(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.id === "string" && (Array.isArray(record.variants) || typeof record.variantOf === "string"))
    return true;
  return featureValues(record).some((one) => carriesVariants753(one, depth + 1));
}

/** A builder step that marks rows already on a list (1.767): a wizard's prepared spells. */
function carriesMarkStep751(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMarkStep751(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.kind === "mark" && record.column !== undefined) return true;
  return featureValues(record).some((one) => carriesMarkStep751(one, depth + 1));
}

/** A builder step that takes all it offers, or limits each entry by its own sheet value (1.766). */
function carriesTakesAll750(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTakesAll750(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.kind === "catalog" && record.takesAll !== undefined) return true;
  if (record.kind === "catalog" && plainRecord(record.upTo)?.per !== undefined) return true;
  return featureValues(record).some((one) => carriesTakesAll750(one, depth + 1));
}

/** A condition that puts others on with it (1.765): unconscious, prone. */
function carriesAlsoApplies749(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAlsoApplies749(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.alsoApplies !== undefined) return true;
  return featureValues(record).some((one) => carriesAlsoApplies749(one, depth + 1));
}

/** A zone whose `enter` catches only a creature moving into it (1.764): Spirit Guardians. */
function carriesEnterOnlyByMoving748(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEnterOnlyByMoving748(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.zone)?.enterOnlyByMoving !== undefined) return true;
  return Object.values(record).some((one) => carriesEnterOnlyByMoving748(one, depth + 1));
}

/** How a creature goes about a fight (1.763): a `behavior` saying its temperament, role, targets,
 *  openers, pack or ambush, on a creature, a creature type or `combat`. A condition's `behavior` says
 *  none of those. */
const BEHAVIOR_KEYS_747 = ["temperament", "role", "targets", "opens", "pack", "ambush"];
function carriesBehavior747(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBehavior747(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior && BEHAVIOR_KEYS_747.some((key) => behavior[key] !== undefined)) return true;
  return featureValues(record).some((one) => carriesBehavior747(one, depth + 1));
}

/** A hungry one (1.784): a behavior whose `temperament`, or one it turns to, is `hungry`. */
function carriesHungry768(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHungry768(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior?.temperament === "hungry") return true;
  if (Array.isArray(behavior?.shifts) && behavior.shifts.some((one) => plainRecord(one)?.to === "hungry")) return true;
  return featureValues(record).some((one) => carriesHungry768(one, depth + 1));
}

/** Ruleset's 10-23 asks (1.787): a `fellsKill`, a creature action's `whileFlying` or `castsOne`, or a
 *  rescue's `against`. */
function carriesAsks771(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAsks771(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.fellsKill !== undefined || record.whileFlying !== undefined || record.castsOne !== undefined) return true;
  if (plainRecord(record.rescue)?.against !== undefined) return true;
  return featureValues(record).some((one) => carriesAsks771(one, depth + 1));
}

/** A priced material an entry needs (1.790): a `material` with a `worth`. */
function carriesMaterial774(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMaterial774(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.material)?.worth !== undefined) return true;
  return featureValues(record).some((one) => carriesMaterial774(one, depth + 1));
}

/** A feature a rest offers (1.789): a `recovers` with `atRest`. */
function carriesRestRecovery773(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRestRecovery773(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.recovers)?.atRest !== undefined) return true;
  return featureValues(record).some((one) => carriesRestRecovery773(one, depth + 1));
}

/** Ruleset's ship-readiness asks (1.788): a fields step's `unansweredAtDefault`, a grant's
 *  `entries.add`, a heal's `outsideFight`, or an item's `aliases`. */
function carriesAsks772(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAsks772(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.unansweredAtDefault !== undefined || record.outsideFight !== undefined) return true;
  if (record.aliases !== undefined && record.item !== undefined) return true;
  if (plainRecord(plainRecord(record.grants)?.entries)?.add !== undefined) return true;
  return featureValues(record).some((one) => carriesAsks772(one, depth + 1));
}

/** An honourable one (1.783): a behavior whose `temperament`, or one it turns to, is `honourable`. */
function carriesHonourable767(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHonourable767(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior?.temperament === "honourable") return true;
  if (Array.isArray(behavior?.shifts) && behavior.shifts.some((one) => plainRecord(one)?.to === "honourable"))
    return true;
  return featureValues(record).some((one) => carriesHonourable767(one, depth + 1));
}

/** A cruel one (1.782): a behavior whose `temperament`, or one it turns to, is `cruel`. */
function carriesCruel766(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCruel766(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior?.temperament === "cruel") return true;
  if (Array.isArray(behavior?.shifts) && behavior.shifts.some((one) => plainRecord(one)?.to === "cruel")) return true;
  return featureValues(record).some((one) => carriesCruel766(one, depth + 1));
}

/** A territorial one (1.781): a behavior whose `temperament`, or one it turns to, is `territorial`,
 *  or with a `territory`. */
function carriesTerritorial765(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTerritorial765(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior?.temperament === "territorial" || behavior?.territory !== undefined) return true;
  if (Array.isArray(behavior?.shifts) && behavior.shifts.some((one) => plainRecord(one)?.to === "territorial"))
    return true;
  return featureValues(record).some((one) => carriesTerritorial765(one, depth + 1));
}

/** An arrogant one (1.780): a behavior whose `temperament`, or one it turns to, is `arrogant`. */
function carriesArrogant764(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesArrogant764(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior?.temperament === "arrogant") return true;
  if (Array.isArray(behavior?.shifts) && behavior.shifts.some((one) => plainRecord(one)?.to === "arrogant"))
    return true;
  return featureValues(record).some((one) => carriesArrogant764(one, depth + 1));
}

/** A temperament that turns (1.779): a behavior with `shifts`. */
function carriesShifts763(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShifts763(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.shifts !== undefined) return true;
  return featureValues(record).some((one) => carriesShifts763(one, depth + 1));
}

/** A fanatic (1.778): a behavior whose `temperament` is `fanatical`. */
function carriesFanatical762(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFanatical762(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.temperament === "fanatical") return true;
  return featureValues(record).some((one) => carriesFanatical762(one, depth + 1));
}

/** A bodyguard (1.777): a behavior with `guards`. */
function carriesGuards761(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesGuards761(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.guards !== undefined) return true;
  return featureValues(record).some((one) => carriesGuards761(one, depth + 1));
}

/** A creature that fights a side alone (1.776): a behavior whose `role` is `solo`. */
function carriesSoloRole760(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSoloRole760(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.role === "solo") return true;
  return featureValues(record).some((one) => carriesSoloRole760(one, depth + 1));
}

/** Losing heart (1.762): `combat.morale`, or a stat block's `morale` score or `leader`. */
/** A guided-builder rows step that asks for a count of rows read off the sheet (1.799): `countFrom` on a
 *  `kind: "rows"` step, as 5e's hit point rolls, one per level after 1st. */
function carriesRowsCountFrom788(ruleset: unknown): boolean {
  const steps = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.builder)?.steps;
  return (
    Array.isArray(steps) &&
    steps.some((value) => {
      const step = plainRecord(value);
      return step?.kind === "rows" && step.countFrom !== undefined;
    })
  );
}

/** How many of its words a text field or column has its holder pick (1.797): `pick` on a `type: "text"`. */
function carriesTextPick786(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTextPick786(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.type === "text" && record.pick !== undefined) return true;
  return featureValues(record).some((one) => carriesTextPick786(one, depth + 1));
}

/** Words a text field or column offers to pick (1.796): `suggestions` on a `type: "text"`. */
function carriesTextSuggestions785(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTextSuggestions785(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.type === "text" && Array.isArray(record.suggestions)) return true;
  return featureValues(record).some((one) => carriesTextSuggestions785(one, depth + 1));
}

/** What a creature has on it as a fight begins (1.795): a creature's `inventory` of item or table lines. */
function carriesCreatureInventory784(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureInventory784(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.inventory) &&
    record.inventory.some((line) => {
      const one = plainRecord(line);
      return !!one && (typeof one.item === "string" || typeof one.table === "string");
    })
  )
    return true;
  return featureValues(record).some((one) => carriesCreatureInventory784(one, depth + 1));
}

function carriesMorale746(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMorale746(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.morale === "number" || plainRecord(record.morale)?.check !== undefined || record.leader === true)
    return true;
  return featureValues(record).some((one) => carriesMorale746(one, depth + 1));
}

/** How much thought a creature puts into a fight (1.761): a stat block's or a creature type's `mind`,
 *  or `combat.minds`. */
const MINDS_745 = new Set(["mindless", "instinct", "cunning", "tactical", "genius"]);
function carriesMinds745(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMinds745(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if ((typeof record.mind === "string" && MINDS_745.has(record.mind)) || plainRecord(record.minds)?.tiers !== undefined)
    return true;
  return featureValues(record).some((one) => carriesMinds745(one, depth + 1));
}

/** What is made lasting a while before it vanishes (1.760): `makesItems.lasts`. 5e's Creation. */
function carriesMadeLasting744(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMadeLasting744(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.makesItems)?.lasts !== undefined) return true;
  return featureValues(record).some((one) => carriesMadeLasting744(one, depth + 1));
}

/** Sight through so much of each material (1.759): a sense's `throughWalls` naming materials, a
 *  cast wall's `material`, or what the board's walls are made of (`boardWalls`). Ring of X-ray Vision. */
function carriesWallMaterials743(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWallMaterials743(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.throughWalls) || plainRecord(record.material) || record.boardWalls !== undefined) return true;
  return featureValues(record).some((one) => carriesWallMaterials743(one, depth + 1));
}

/** A ward picked as it is cast (1.758): Wish's immunity to a single spell. */
function carriesWardPick742(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWardPick742(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.wardPick !== undefined) return true;
  return featureValues(record).some((one) => carriesWardPick742(one, depth + 1));
}

/** A heal of all the health each target is missing (1.757): Wish. */
function carriesHealsAll741(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealsAll741(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.healsAll !== undefined) return true;
  return featureValues(record).some((one) => carriesHealsAll741(one, depth + 1));
}

/** Wish's stress (1.756): an ability lowered to a number only where it is higher (`atMost`), or a
 *  condition's days rolled (`lastsDays: { dice }`), resting days counting more. */
function carriesWishStress740(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWishStress740(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const abilities = plainRecord(record.abilities);
  if (abilities && Object.values(abilities).some((change) => plainRecord(change)?.atMost !== undefined)) return true;
  const days = plainRecord(record.lastsDays);
  if (days && days.dice !== undefined) return true;
  return featureValues(record).some((one) => carriesWishStress740(one, depth + 1));
}

/** A target test asking whether one stands in a zone some entries left (1.755): Magic Jar and Magic
 *  Circle. */
function carriesZoneTargetTest739(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneTargetTest739(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.insideZoneOf !== undefined || record.outsideZoneOf !== undefined) return true;
  return featureValues(record).some((one) => carriesZoneTargetTest739(one, depth + 1));
}

/** A creature with more than 12 actions (1.754): 5e's vampire, with its bat and mist forms. Before
 *  it every list of actions held 12 at most, so any longer one is one. */
function carriesManyActions738(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesManyActions738(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.actions) && record.actions.length > 12) return true;
  return featureValues(record).some((one) => carriesManyActions738(one, depth + 1));
}

/** A zone nobody teleports into, the kinds its strikes reach named as it is cast, or a damage type
 *  named as it is cast (1.753): Forbiddance. */
function carriesForbiddance737(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesForbiddance737(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.kindChoice === "many" || record.damageTypeChoice !== undefined) return true;
  if (plainRecord(record.forbids)?.teleport === "into") return true;
  return featureValues(record).some((one) => carriesForbiddance737(one, depth + 1));
}

/** A change to checks made only for some purposes (1.752): Gloves of Swimming and Climbing. */
function carriesCheckPurposes736(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCheckPurposes736(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.to === "string" && record.for !== undefined) return true;
  return featureValues(record).some((one) => carriesCheckPurposes736(one, depth + 1));
}

/** A condition lasting until midnight, or what one deals as it ends saved against for half (1.751):
 *  Midnight tears. */
function carriesMidnightOrEndSave735(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMidnightOrEndSave735(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.lastsDays === "midnight") return true;
  if (plainRecord(plainRecord(plainRecord(record.onEnd)?.harm)?.save) !== undefined) return true;
  return featureValues(record).some((one) => carriesMidnightOrEndSave735(one, depth + 1));
}

/** A save made as days pass that counts its successes or harms on a failure, or a condition that
 *  keeps the damage it deals off healing (1.750): Pale tincture. */
function carriesDaySaveHarm734(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDaySaveHarm734(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.keepsDamage !== undefined) return true;
  const ends = plainRecord(record.saveEnds);
  if (ends?.at === "days" && (ends.successes !== undefined || ends.harmsOnFail !== undefined)) return true;
  return featureValues(record).some((one) => carriesDaySaveHarm734(one, depth + 1));
}

/** An item of only further uses, rolled for (1.749): a Necklace of Prayer Beads. */
function carriesOnlyMoreUses733(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOnlyMoreUses733(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const item = plainRecord(record.item);
  if (item && item.moreUses !== undefined && item.use === undefined) return true;
  return featureValues(record).some((one) => carriesOnlyMoreUses733(one, depth + 1));
}

/** A further use spending another's count (1.747): a bead of curing. */
function carriesUsesOf731(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUsesOf731(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const more = plainRecord(record.item)?.moreUses;
  if (Array.isArray(more) && more.some((one) => plainRecord(one)?.usesOf !== undefined)) return true;
  return featureValues(record).some((one) => carriesUsesOf731(one, depth + 1));
}

/** A call rolled among what it reads from a catalog (1.748): a bead's Planar Ally. */
function carriesRolledFromCall732(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRolledFromCall732(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls?.rolled !== undefined && calls.from !== undefined) return true;
  return featureValues(record).some((one) => carriesRolledFromCall732(one, depth + 1));
}

/** Further uses' counts rolled for each stack (1.746): a Necklace of Prayer Beads. */
function carriesMoreUsesRolled730(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMoreUsesRolled730(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.item)?.moreUsesRolled !== undefined) return true;
  return featureValues(record).some((one) => carriesMoreUsesRolled730(one, depth + 1));
}

/** An item use that makes items (1.745): a scroll of Goodberry. */
function carriesUseMakesItems729(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUseMakesItems729(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.use)?.makesItems !== undefined) return true;
  return featureValues(record).some((one) => carriesUseMakesItems729(one, depth + 1));
}

/** An item use that costs something used again before a rest (1.744): a Ring of X-ray Vision. */
function carriesAgainBeforeRest728(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAgainBeforeRest728(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.use)?.againBeforeRest !== undefined) return true;
  return featureValues(record).some((one) => carriesAgainBeforeRest728(one, depth + 1));
}

/** A call that ends once its creatures' counted actions are spent (1.742): a Dancing Sword. */
function carriesCallsEndWhenSpent726(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallsEndWhenSpent726(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.endsWhenSpent !== undefined) return true;
  return featureValues(record).some((one) => carriesCallsEndWhenSpent726(one, depth + 1));
}

/** An area that ends as its maker is incapacitated (1.741): an ice devil's Wall of Ice. */
function carriesZoneEndsWithCaller725(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneEndsWithCaller725(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.zone)?.endsWithCaller !== undefined) return true;
  return featureValues(record).some((one) => carriesZoneEndsWithCaller725(one, depth + 1));
}

/** A condition put on only while its applier holds none of some on anybody (1.740): a chain devil's
 *  grapple. */
function carriesAppliesUnlessImposing724(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAppliesUnlessImposing724(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.unlessImposing !== undefined) return true;
  return featureValues(record).some((one) => carriesAppliesUnlessImposing724(one, depth + 1));
}

/** An item use whose call lends weapons while it stands (1.739): a goat of terror's horns. */
function carriesWieldsWhileCalled723(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWieldsWhileCalled723(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.use)?.wieldsWhileCalled !== undefined) return true;
  return featureValues(record).some((one) => carriesWieldsWhileCalled723(one, depth + 1));
}

/** A catalog entry's or an item use's `against` (1.738): Shocking Grasp at metal armor. */
function carriesEntryAgainst722(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEntryAgainst722(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const key of ["mechanics", "use"] as const) {
    if (plainRecord(record[key])?.against !== undefined) return true;
  }
  if (Array.isArray(record.moreUses) && record.moreUses.some((one) => plainRecord(one)?.against !== undefined))
    return true;
  return featureValues(record).some((one) => carriesEntryAgainst722(one, depth + 1));
}

/** A weapon whose bonus may go to its wielder's defense (1.737): a Defender. */
function carriesBonusToDefense721(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBonusToDefense721(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.attack)?.bonusToDefense !== undefined) return true;
  return featureValues(record).some((one) => carriesBonusToDefense721(one, depth + 1));
}

/** A creature's call commanded through one of its caller's actions, or ending as its caller is
 *  incapacitated (1.736): a chain devil's chains. */
function carriesCommandedBy720(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCommandedBy720(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.commandedBy !== undefined) return true;
  const actions = plainRecord(record.creature)?.actions;
  if (
    Array.isArray(actions) &&
    actions.some((one) => plainRecord(plainRecord(one)?.calls)?.endsWithCaller === "incapacitated")
  )
    return true;
  return featureValues(record).some((one) => carriesCommandedBy720(one, depth + 1));
}

/** An aura that spreads only while its holder is ridden (1.735): a goat of terror. */
function carriesAuraWhileRidden719(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAuraWhileRidden719(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.auras) && record.auras.some((one) => plainRecord(one)?.whileRidden !== undefined))
    return true;
  return featureValues(record).some((one) => carriesAuraWhileRidden719(one, depth + 1));
}

/** A condition whose holder understands every language without being understood (1.734): Comprehend
 *  Languages. */
function carriesLanguagesUnderstands718(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLanguagesUnderstands718(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.languages === "understands") return true;
  return featureValues(record).some((one) => carriesLanguagesUnderstands718(one, depth + 1));
}

/** A catalog entry's or an item's call whose creatures leave with their caller (1.733): a Feather
 *  Token's whip. A creature action's calls (1.446) sit on an action with a `name`, never on
 *  `mechanics` or an item's `use`. */
function carriesCallsEndWithCaller717(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallsEndWithCaller717(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.endsWithCaller === "incapacitated") return true;
  for (const key of ["mechanics", "use"] as const) {
    if (plainRecord(plainRecord(record[key])?.calls)?.endsWithCaller !== undefined) return true;
  }
  return featureValues(record).some((one) => carriesCallsEndWithCaller717(one, depth + 1));
}

/** Parts of an item's effect that hold only while charges or uses are left (1.732): a Helm of
 *  Brilliance. */
function carriesWhileLeft716(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWhileLeft716(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.whileLeft !== undefined) return true;
  return featureValues(record).some((one) => carriesWhileLeft716(one, depth + 1));
}

/** A guided-builder catalog step's filter that is a list of values, matching any (1.731): a bard's
 *  Magical Secrets, `{"kind": ["spell", "cantrip"]}`. */
function carriesStepFilterList715(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStepFilterList715(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const filters = plainRecord(record.filters);
  if (record.kind === "catalog" && typeof record.catalog === "string" && filters) {
    if (Object.values(filters).some((one) => Array.isArray(one))) return true;
  }
  return featureValues(record).some((one) => carriesStepFilterList715(one, depth + 1));
}

/** An item's use with the level it casts at, or a utility one that stops what it answers (1.730): a
 *  scroll of Counterspell. */
function carriesItemLevel714(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemLevel714(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const use = plainRecord(record.use);
  if (use && (use.level !== undefined || (use.kind === "utility" && plainRecord(use.reaction)?.cancels))) return true;
  return featureValues(record).some((one) => carriesItemLevel714(one, depth + 1));
}

/** A wall a creature's action lays (1.728): an ice devil's Wall of Ice. A creature's action has a
 *  `name`; a catalog entry's area sits on its `mechanics`, which has none. */
function carriesCreatureWall712(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureWall712(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const area = plainRecord(record.area);
  if (typeof record.name === "string" && area && (area.shape === "wall" || area.ring !== undefined || area.ringOnly))
    return true;
  return featureValues(record).some((one) => carriesCreatureWall712(one, depth + 1));
}

/** A creature's action kept up on its later turns (1.727): a harpy's Luring Song. A creature's
 *  action has a `name`; a catalog entry's `sustains` (1.431) sits on its `mechanics`, which has none. */
function carriesCreatureSustains711(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureSustains711(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sustains !== undefined && typeof record.name === "string" && record.budget !== undefined) return true;
  return featureValues(record).some((one) => carriesCreatureSustains711(one, depth + 1));
}

/** A change narrowed to the holder's attacks or damage at targets that are something (1.726): Demon
 *  Armor. Read on every `modifiers` list, where `at` means nothing else. */
function carriesModifierAt710(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesModifierAt710(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.modifiers) &&
    record.modifiers.some((one) => {
      const modifier = plainRecord(one);
      return modifier?.at !== undefined && (modifier.to === "attacks" || modifier.to === "damage");
    })
  )
    return true;
  return featureValues(record).some((one) => carriesModifierAt710(one, depth + 1));
}

/** A leap onto whoever stands where it lands (1.725): a bulette's Deadly Leap. */
function carriesLeapsOnto709(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLeapsOnto709(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.leapsOnto !== undefined) return true;
  return featureValues(record).some((one) => carriesLeapsOnto709(one, depth + 1));
}

/** A save made with the better of two (1.724): a bulette's Deadly Leap. */
function carriesSaveOr708(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSaveOr708(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.save)?.or !== undefined) return true;
  return featureValues(record).some((one) => carriesSaveOr708(one, depth + 1));
}

/** A carapace that turns entries back on a die (1.723): a tarrasque's. */
function carriesReflects707(value: unknown): boolean {
  const conditions = plainRecord(plainRecord(value)?.combat)?.conditions;
  return Array.isArray(conditions) && conditions.some((entry) => plainRecord(entry)?.reflects !== undefined);
}

/** A condition that bars rests (1.722): a rakshasa's curse. */
function carriesBlocksRests706(value: unknown): boolean {
  const conditions = plainRecord(plainRecord(value)?.combat)?.conditions;
  return Array.isArray(conditions) && conditions.some((entry) => plainRecord(entry)?.blocksRests !== undefined);
}

/** A cast that makes items (1.721): Goodberry. */
function carriesMakesItems705(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMakesItems705(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.makesItems !== undefined) return true;
  return featureValues(record).some((one) => carriesMakesItems705(one, depth + 1));
}

/** Knocking out with a melee blow (1.720). */
function carriesKnockOut704(value: unknown): boolean {
  const dying = plainRecord(plainRecord(plainRecord(value)?.combat)?.dying);
  return dying?.knockOut !== undefined;
}

/** A sense that sees through walls (1.719): 5e's X-ray vision. */
function carriesThroughWalls703(value: unknown): boolean {
  const combat = plainRecord(plainRecord(value)?.combat);
  const senses = combat?.senses;
  return Array.isArray(senses) && senses.some((sense) => plainRecord(sense)?.throughWalls !== undefined);
}

/** A condition braced against forced movement (1.718): Dwarven Plate. */
function carriesPushReduced702(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPushReduced702(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.pushReducedBy !== undefined) return true;
  return featureValues(record).some((one) => carriesPushReduced702(one, depth + 1));
}

/** An item worn by its holder's mount (1.717): Horseshoes of Speed. */
function carriesWornByMount701(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWornByMount701(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.wornBy !== undefined) return true;
  return featureValues(record).some((one) => carriesWornByMount701(one, depth + 1));
}

/** A creature's own jump (1.716): a bulette's Standing Leap. */
function carriesCreatureJump700(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureJump700(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.creature)?.jump !== undefined) return true;
  return featureValues(record).some((one) => carriesCreatureJump700(one, depth + 1));
}

/** An action offered only while its user holds nobody so (1.715): an ankheg's Acid Spray. */
function carriesUnlessImposing699(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUnlessImposing699(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.unlessImposing !== undefined) return true;
  return featureValues(record).some((one) => carriesUnlessImposing699(one, depth + 1));
}

/** A condition held only on ground it names (1.714): a vampire in running water. */
function carriesHeldOnGround698(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldOnGround698(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.heldOnlyIn)?.ground !== undefined) return true;
  return featureValues(record).some((one) => carriesHeldOnGround698(one, depth + 1));
}

/** A character's tags read off several fields (1.713): race and alignment. */
function carriesTagsFromList697(ruleset: unknown): boolean {
  return Array.isArray(plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.creatureTypes)?.tagsFrom);
}

/** A save on damage that leans (1.712): Hideous Laughter. */
function carriesDamagedLean696(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDamagedLean696(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.saveWhenDamaged) !== undefined) return true;
  return featureValues(record).some((one) => carriesDamagedLean696(one, depth + 1));
}

/** A target test of what is worn, or a creature's worn tags (1.711): Shocking Grasp, Heat Metal. */
function carriesWears695(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWears695(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.wears !== undefined && (plainRecord(record.wears) !== undefined || Array.isArray(record.wears)))
    return true;
  return featureValues(record).some((one) => carriesWears695(one, depth + 1));
}

/** The bonus-action spell rule (1.710). */
function carriesBonusSpellRule694(ruleset: unknown): boolean {
  return plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.casting)?.afterBonusSpell !== undefined;
}

/** Massive damage killing outright (1.709). */
function carriesMassiveDamage693(ruleset: unknown): boolean {
  return plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.dying)?.instantDeath !== undefined;
}

/** Easy going on some tiles, or harm walking into some (1.708): Ice Walk, Water Susceptibility. */
function carriesGroundByTile692(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesGroundByTile692(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.easyGround !== undefined || record.harmedEntering !== undefined) return true;
  return featureValues(record).some((one) => carriesGroundByTile692(one, depth + 1));
}

/** A creature's call commanded on a budget, or striking with its caller's attack (1.707): a solar's
 *  Flying Sword. */
function carriesCreatureCallCommanded691(value: unknown, depth = 0, creature = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureCallCommanded691(one, depth + 1, creature));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (creature && calls && (calls.commandedWith !== undefined || calls.fromCaller !== undefined)) return true;
  if (record.creature !== undefined && carriesCreatureCallCommanded691(record.creature, depth + 1, true)) return true;
  return featureValues(record).some((one) => carriesCreatureCallCommanded691(one, depth + 1, creature));
}

/** A switch that frees its item's slots while on, or stays on only so long (1.706): an Animated
 *  Shield. */
function carriesSlotsFreed690(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSlotsFreed690(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const toggle = plainRecord(record.toggle);
  if (toggle?.freesSlots !== undefined || toggle?.rounds !== undefined) return true;
  return featureValues(record).some((one) => carriesSlotsFreed690(one, depth + 1));
}

/** Attacks that ignore some cover (1.705): a Wand of the War Mage. */
function carriesCoverIgnored689(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCoverIgnored689(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.coverIgnored !== undefined) return true;
  return featureValues(record).some((one) => carriesCoverIgnored689(one, depth + 1));
}

/** Actions that never hinder a condition's holder (1.704): Web Walker. */
function carriesUnhinderedBy688(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUnhinderedBy688(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.unhinderedBy !== undefined) return true;
  return featureValues(record).some((one) => carriesUnhinderedBy688(one, depth + 1));
}

/** A zone moved on a check that a mover holding something does better (1.703): a Talisman of the
 *  Sphere. */
function carriesZoneHolding687(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneHolding687(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.move)?.check)?.holding !== undefined) return true;
  return featureValues(record).some((one) => carriesZoneHolding687(one, depth + 1));
}

/** An area of only the cell it is at (1.702): a Sphere of Annihilation. */
function carriesOneCell686(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOneCell686(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.area)?.oneCell !== undefined) return true;
  return featureValues(record).some((one) => carriesOneCell686(one, depth + 1));
}

/** An item that harms whoever it comes into the hands of (1.701): a Talisman of Pure Good. */
function carriesTouchHarms685(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTouchHarms685(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.category === "string" && record.touchHarms !== undefined) return true;
  return featureValues(record).some((one) => carriesTouchHarms685(one, depth + 1));
}

/** An item's stats added to while its wearer meets what a line asks (1.700): a Talisman of Pure
 *  Good's +2 to a good cleric's or paladin's spell attacks. */
function carriesStatsIf684(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStatsIf684(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.category === "string" && record.statsIf !== undefined) return true;
  return featureValues(record).some((one) => carriesStatsIf684(one, depth + 1));
}

/** Tags read off an alignment in words (1.699): a creature's `alignment`, a character's
 *  `creatureTypes.tagsFrom`. */
function carriesAlignmentTags683(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAlignmentTags683(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.creature)?.alignment !== undefined) return true;
  if (plainRecord(record.creatureTypes)?.tagsFrom !== undefined) return true;
  return featureValues(record).some((one) => carriesAlignmentTags683(one, depth + 1));
}

/** A creature's action whose riders go only on a target that is something (1.698): a merrow's
 *  Harpoon on a Huge or smaller target. */
function carriesRidersIs682(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRidersIs682(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.ridersIs !== undefined) return true;
  return featureValues(record).some((one) => carriesRidersIs682(one, depth + 1));
}

/** A zone keeping out more than 8 conditions from whoever is inside (1.697): Magic Circle and
 *  Hallow's "charmed, frightened, or possessed" beside the rest. */
function carriesKeepsOutTwelve681(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKeepsOutTwelve681(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const keeps = plainRecord(record.keepsOut);
  if (
    keeps &&
    ((Array.isArray(keeps.cantGive) && keeps.cantGive.length > 8) ||
      (Array.isArray(keeps.frees) && keeps.frees.length > 8))
  )
    return true;
  return featureValues(record).some((one) => carriesKeepsOutTwelve681(one, depth + 1));
}

/** A creature that goes into whom it lands on (1.696): a ghost's Possession. */
function carriesPossesses680(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPossesses680(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.dismisses)?.possesses !== undefined) return true;
  return featureValues(record).some((one) => carriesPossesses680(one, depth + 1));
}

/** A creature's action whose riders wait on a contest (1.695): a merrow's Harpoon. Only a creature's
 *  actions, which a catalog's `actions` and a block's hold; a catalog entry's own `contest` is 1.565. */
function carriesCreatureContest679(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureContest679(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const actions = Array.isArray(record.actions) ? record.actions : [];
  if (actions.some((action) => plainRecord(action)?.contest !== undefined)) return true;
  return featureValues(record).some((one) => carriesCreatureContest679(one, depth + 1));
}

/** A zone anybody near may move on a check (1.694): a Sphere of Annihilation. */
function carriesZoneCheck678(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneCheck678(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const move = plainRecord(plainRecord(record.zone)?.move);
  if (move?.check !== undefined) return true;
  return featureValues(record).some((one) => carriesZoneCheck678(one, depth + 1));
}

/** A use whose user saves against what it puts on them (1.693): Dust of Sneezing and Choking. */
function carriesSelfSave677(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSelfSave677(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.appliesSelfSaves !== undefined) return true;
  return featureValues(record).some((one) => carriesSelfSave677(one, depth + 1));
}

/** A contest's `takes` picked as a mode of its own (1.692): Telekinesis on an object or a creature. */
function carriesTakesMode676(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTakesMode676(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.contest)?.takesMode !== undefined) return true;
  return featureValues(record).some((one) => carriesTakesMode676(one, depth + 1));
}

/** Items asking any one of what they name, or more than 4 things (1.691): attunement by a cleric,
 *  druid, or warlock. */
function carriesNeedsAny675(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesNeedsAny675(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const binds = plainRecord(record.binds);
  if (binds && (binds.needsAny !== undefined || (Array.isArray(binds.needs) && binds.needs.length > 4))) return true;
  if (
    typeof record.category === "string" &&
    (record.userNeedsAny !== undefined || (Array.isArray(record.userNeeds) && record.userNeeds.length > 4))
  )
    return true;
  return featureValues(record).some((one) => carriesNeedsAny675(one, depth + 1));
}

/** A derived value read from the words of a text field (1.690): 5e's alignment. */
function carriesWordsTable674(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWordsTable674(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.op === "wordsTable") return true;
  return featureValues(record).some((one) => carriesWordsTable674(one, depth + 1));
}

/** Ground a careful walker crosses safely, or that stops a walk (1.689): caltrops. */
function carriesCaltrops673(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCaltrops673(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const terrain = plainRecord(record.terrain);
  if (terrain && (terrain.spareSlowWalkers !== undefined || terrain.endsWalk !== undefined)) return true;
  return featureValues(record).some((one) => carriesCaltrops673(one, depth + 1));
}

/** A condition that stabilizes its dying holder, or rest dice that heal more (1.688): a Periapt of
 *  Wound Closure. */
function carriesWoundClosure672(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWoundClosure672(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.stabilizesWhenDying !== undefined) return true;
  const dice = record.dice;
  if (
    record.restore !== undefined &&
    (Array.isArray(dice) ? dice : [dice]).some((one) => plainRecord(one)?.times !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesWoundClosure672(one, depth + 1));
}

/** A creature's action whose uses each do something else (1.687): an androsphinx's Roar. */
function carriesByUse671(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesByUse671(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.byUse !== undefined) return true;
  return featureValues(record).some((one) => carriesByUse671(one, depth + 1));
}

/** More than 12 combat checks (1.686): 5e's thieves' tools beside its skills. */
function carriesChecks16633(ruleset: unknown): boolean {
  const checks = plainRecord(plainRecord(ruleset)?.combat)?.checks;
  return Array.isArray(checks) && checks.length > 12;
}

/** A creature's action that sends somebody, or itself, out of the fight (1.685): Etherealness. */
function carriesCreatureDismisses669(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureDismisses669(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.dismisses)?.carries !== undefined) return true;
  // A creature's actions are the only list of whole actions a ruleset writes.
  if (Array.isArray(record.actions) && record.actions.some((one) => plainRecord(one)?.dismisses !== undefined))
    return true;
  return featureValues(record).some((one) => carriesCreatureDismisses669(one, depth + 1));
}

/** A condition that ends when its holder is healed, or healed by magic (1.684). */
function carriesEndsHealed668(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsHealed668(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.endsWhen) && record.endsWhen.some((one) => one === "healed" || one === "healed-by-magic"))
    return true;
  return featureValues(record).some((one) => carriesEndsHealed668(one, depth + 1));
}

/** A condition's hits that deal damage, ask a save, or read the blow's damage type (1.683): a poison
 *  on a weapon. */
function carriesOnHitDamage667(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOnHitDamage667(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const onHit = plainRecord(record.onHit);
  if (
    onHit &&
    (onHit.damage !== undefined ||
      onHit.save !== undefined ||
      onHit.failedBy !== undefined ||
      onHit.damageTypes !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesOnHitDamage667(one, depth + 1));
}

/** A condition held only while an ally is seen near (1.682): a bearded devil's Steadfast. */
function carriesAllySeen666(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAllySeen666(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.heldOnlyIn)?.allySeenWithin !== undefined) return true;
  return featureValues(record).some((one) => carriesAllySeen666(one, depth + 1));
}

/** Squeezing between walls, or a condition that moves as a smaller size (1.681): Amorphous. */
function carriesSqueezing665(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSqueezing665(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.squeezesAs !== undefined || record.squeezing !== undefined) return true;
  return featureValues(record).some((one) => carriesSqueezing665(one, depth + 1));
}

/** A condition whose holder shares spaces (1.680): a swarm. */
function carriesSharesSpace664(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSharesSpace664(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sharesSpace !== undefined) return true;
  return featureValues(record).some((one) => carriesSharesSpace664(one, depth + 1));
}

/** Flying out of reach without drawing a strike (1.679): an owl's Flyby. */
function carriesFlyby663(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFlyby663(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.flyby !== undefined) return true;
  return featureValues(record).some((one) => carriesFlyby663(one, depth + 1));
}

/** A creature's slaying held to the low, or a failed save that drops to no health (1.678): a solar's
 *  Slaying Longbow, a sea hag's Death Glare. */
function carriesCreatureSlaying662(value: unknown, depth = 0, creature = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureSlaying662(one, depth + 1, creature));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.slaysHealthAtMost !== undefined || (creature && record.dropsOnFailedSave !== undefined)) return true;
  if (record.creature !== undefined && carriesCreatureSlaying662(record.creature, depth + 1, true)) return true;
  return featureValues(record).some((one) => carriesCreatureSlaying662(one, depth + 1, creature));
}

/** A creature's blow that steadies, or puts something on, whoever it drops (1.677): a giant spider. */
function carriesOnFell661(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOnFell661(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.onFell !== undefined) return true;
  return featureValues(record).some((one) => carriesOnFell661(one, depth + 1));
}

/** A condition whose source hangs on to its holder, or one put on only by an attack with advantage
 *  (1.676): a stirge, a cloaker. */
function carriesAttaches660(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAttaches660(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.attaches !== undefined || record.withAdvantage !== undefined) return true;
  return featureValues(record).some((one) => carriesAttaches660(one, depth + 1));
}

/** Somebody pulled straight toward whoever pulls them (1.675): a balor's whip, Thorn Whip. */
function carriesPull659(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPull659(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.pull === "number") return true;
  return featureValues(record).some((one) => carriesPull659(one, depth + 1));
}

/** A creature's action never used on the same creature again (1.674): Frightful Presence. */
function carriesCreatureOncePerTarget658(value: unknown, depth = 0, creature = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureOncePerTarget658(one, depth + 1, creature));
  const record = plainRecord(value);
  if (!record) return false;
  if (creature && record.oncePerTarget !== undefined) return true;
  if (record.creature !== undefined && carriesCreatureOncePerTarget658(record.creature, depth + 1, true)) return true;
  return featureValues(record).some((one) => carriesCreatureOncePerTarget658(one, depth + 1, creature));
}

/** A save failed badly on a creature's action, or by a total that low anywhere (1.673): a mummy's
 *  Dreadful Glare, a sprite's arrow. */
function carriesFailedBy657(value: unknown, depth = 0, creature = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFailedBy657(one, depth + 1, creature));
  const record = plainRecord(value);
  if (!record) return false;
  const failedBy = plainRecord(plainRecord(record.save)?.failedBy);
  if (failedBy && (creature || failedBy.resultAtMost !== undefined)) return true;
  if (record.creature !== undefined && carriesFailedBy657(record.creature, depth + 1, true)) return true;
  return featureValues(record).some((one) => carriesFailedBy657(one, depth + 1, creature));
}

/** A climb kept off some ground, and slippery ground (1.671): Slippers of Spider Climbing, Grease. */
function carriesClimbNotOn655(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesClimbNotOn655(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.climbNotOn !== undefined || plainRecord(record.terrain)?.slippery !== undefined) return true;
  return featureValues(record).some((one) => carriesClimbNotOn655(one, depth + 1));
}

/** A teleport's familiarity table (1.670): 5e's Teleport. */
function carriesTeleportFamiliarity654(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTeleportFamiliarity654(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const teleport = plainRecord(record.teleport);
  if (teleport && (teleport.familiarity !== undefined || teleport.mishap !== undefined)) return true;
  return featureValues(record).some((one) => carriesTeleportFamiliarity654(one, depth + 1));
}

/** A trap disarmed with a check (1.669): a zone's `disarm`, or the `disarm` standard action. */
function carriesZoneDisarm653(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneDisarm653(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.zone)?.disarm !== undefined) return true;
  for (const key of ["standard", "actions"]) {
    const list = record[key];
    if (Array.isArray(list) && list.includes("disarm")) return true;
  }
  return featureValues(record).some((one) => carriesZoneDisarm653(one, depth + 1));
}

/** A contest that takes what its target holds (1.668): 5e's Telekinesis on an object. */
function carriesContestTakes652(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesContestTakes652(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.contest)?.takes !== undefined) return true;
  return featureValues(record).some((one) => carriesContestTakes652(one, depth + 1));
}

/** What an item asks of its bearer or user, or what waives it (1.667): 5e's attunement by class. */
function carriesItemNeeds651(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemNeeds651(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    plainRecord(record.binds)?.needs !== undefined ||
    (typeof record.category === "string" && record.userNeeds !== undefined)
  )
    return true;
  if (record.needsWaivedBy !== undefined) return true;
  return featureValues(record).some((one) => carriesItemNeeds651(one, depth + 1));
}

/** A call whose creatures may ignore every order (1.665): the obsidian steed. */
function carriesDisobeys649(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDisobeys649(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.disobeys !== undefined) return true;
  return featureValues(record).some((one) => carriesDisobeys649(one, depth + 1));
}

/** A condition an item's use puts on that lasts while the item is worn (1.664). */
function carriesWhileItemWorn648(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWhileItemWorn648(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.whileItemWorn !== undefined) return true;
  return featureValues(record).some((one) => carriesWhileItemWorn648(one, depth + 1));
}

/** A condition that lasts a number of days (1.663): 5e's Quivering Palm. */
function carriesLastsDays647(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLastsDays647(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.lastsDays !== undefined) return true;
  return featureValues(record).some((one) => carriesLastsDays647(one, depth + 1));
}

/** A condition changing its holder's derived values (1.662): 5e's Bull's Strength. */
function carriesDerivedChanges646(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDerivedChanges646(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.derivedChanges)) return true;
  return featureValues(record).some((one) => carriesDerivedChanges646(one, depth + 1));
}

/** A starting gear choice's option offered only to some sheets (1.661): 5e's "(if proficient)". */
function carriesOfferedOption645(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOfferedOption645(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.lines) && record.offeredWhen !== undefined) return true;
  return featureValues(record).some((one) => carriesOfferedOption645(one, depth + 1));
}

/** A mount's own speed past its full-pace load (1.660): 5e's Broom of Flying. */
function carriesSlowedSpeed644(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSlowedSpeed644(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.mountCarries)?.slowedSpeed !== undefined) return true;
  return featureValues(record).some((one) => carriesSlowedSpeed644(one, depth + 1));
}

/** A zone sealing out gases and fog, or blocking shots from afar (1.659): 5e's Cube of Force. */
function carriesSealedZone643(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSealedZone643(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sealsAir === true || (Array.isArray(record.blocks) && record.blocks.includes("ranged"))) return true;
  return featureValues(record).some((one) => carriesSealedZone643(one, depth + 1));
}

/** Attacks at others near its holder made at its holder instead (1.658): 5e's Shield of Missile
 *  Attraction's curse. */
function carriesDrawsAim642(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDrawsAim642(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.drawsAim)) return true;
  return featureValues(record).some((one) => carriesDrawsAim642(one, depth + 1));
}

/** Ammunition with clauses of its own on the shot it is fired as (1.657): 5e's Arrow of Slaying. */
function carriesAmmoRider641(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAmmoRider641(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.ammoRider)) return true;
  return featureValues(record).some((one) => carriesAmmoRider641(one, depth + 1));
}

/** A layer's `items` (its market and loot changes), or a market's own `unsold`, which are 1.813: new
 *  keys on the strict layer and market. */
function rulesetCarriesLayerItems813(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  const layers = Array.isArray(record?.layers) ? record.layers : [];
  return (
    layers.some((layer) => plainRecord(layer)?.items !== undefined) ||
    plainRecord(plainRecord(record?.items)?.market)?.unsold !== undefined
  );
}

/** Ammunition that adds to the attack roll of the shot it rides (1.812): 5e's Arrow +1. */
function carriesAmmoToHit804(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAmmoToHit804(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.ammoRider)?.toHit !== undefined) return true;
  return featureValues(record).some((one) => carriesAmmoToHit804(one, depth + 1));
}

/** A use that gives back spent pools by itself, so many of them (1.656): 5e's Pearl of Power. */
function carriesRecoverCount640(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRecoverCount640(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.recovers)?.count !== undefined) return true;
  return featureValues(record).some((one) => carriesRecoverCount640(one, depth + 1));
}

/** Attacks against its holder at disadvantage only from those who see them (1.655): 5e's Robe of
 *  Scintillating Colors. */
function carriesSeenAgainst639(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSeenAgainst639(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    record.whenSeen === true &&
    Array.isArray(record.effects) &&
    record.effects.includes("attacks-against-disadvantage")
  )
    return true;
  return featureValues(record).some((one) => carriesSeenAgainst639(one, depth + 1));
}

/** A condition kept on only while a sheet value reads above zero (1.653): 5e's Holy Avenger. */
function carriesKeptWhen637(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKeptWhen637(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.keepsOn) && record.keepsOn.some((one) => plainRecord(one))) return true;
  return featureValues(record).some((one) => carriesKeptWhen637(one, depth + 1));
}

/** A save said to be against a quality, or a modifier for such saves (1.652): 5e's gases. */
function carriesSaveQualities636(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSaveQualities636(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    (typeof record.save === "string" || record.to === "saves") &&
    plainRecord(record.against)?.qualities !== undefined
  )
    return true;
  return featureValues(record).some((one) => carriesSaveQualities636(one, depth + 1));
}

/** A condition that chokes its holder anywhere, or whose save waits on what they hold (1.651): 5e's
 *  Dust of Sneezing and Choking. */
function carriesChoking635(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChoking635(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && (record.suffocates !== undefined || record.savesUnless !== undefined))
    return true;
  return featureValues(record).some((one) => carriesChoking635(one, depth + 1));
}

/** A fall made safe only up to a height, or but for some conditions (1.650): 5e's Cat's Grace. */
function carriesSomeFallsSafe634(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSomeFallsSafe634(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.fallsSafely)) return true;
  return featureValues(record).some((one) => carriesSomeFallsSafe634(one, depth + 1));
}

/** A sense that sees things as they truly are (1.649): 5e's Witch Sight. */
function carriesSeesTrue633(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSeesTrue633(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.seesTrue !== undefined) return true;
  return featureValues(record).some((one) => carriesSeesTrue633(one, depth + 1));
}

/** A condition saying its holder understands nothing, or everything (1.648): Feeblemind, Tongues. */
function carriesHeldLanguages632(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldLanguages632(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && (record.languages === "none" || record.languages === "all")) return true;
  return featureValues(record).some((one) => carriesHeldLanguages632(one, depth + 1));
}

/** A condition holding its holder out of time (1.647): 5e's Sequester. */
function carriesStasis631(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStasis631(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.stasis !== undefined) return true;
  return featureValues(record).some((one) => carriesStasis631(one, depth + 1));
}

/** Harm for casting, a condition put on by chance, or an entry stopped by name (1.646): Wish. */
function carriesCastingStress630(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCastingStress630(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.harms)?.at === "casts") return true;
  if (plainRecord(record.forbids)?.entries !== undefined) return true;
  if (typeof record.condition === "string" && typeof record.chance === "number") return true;
  return featureValues(record).some((one) => carriesCastingStress630(one, depth + 1));
}

/** A ward of only some entries (1.645): 5e's Mind Blank. */
function carriesWardEntries629(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWardEntries629(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const wards = plainRecord(record.wards);
  if (wards && (wards.where !== undefined || wards.entries !== undefined)) return true;
  return featureValues(record).some((one) => carriesWardEntries629(one, depth + 1));
}

/** A condition whose commands its holder may break at a cost (1.644): 5e's Geas. */
function carriesDefiance628(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDefiance628(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.harms)?.at === "defies") return true;
  return featureValues(record).some((one) => carriesDefiance628(one, depth + 1));
}

/** A sequence step rolled for, made after another's hit, or left out at will (1.643): a grick. */
function carriesSequenceSteps627(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSequenceSteps627(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    typeof record.action === "string" &&
    (record.dice !== undefined || record.ifHit !== undefined || record.optional !== undefined) &&
    record.times !== undefined
  )
    return true;
  if (
    Array.isArray(record.sequence) &&
    record.sequence.some((step) => {
      const one = plainRecord(step);
      return !!one && (one.dice !== undefined || one.ifHit !== undefined || one.optional !== undefined);
    })
  )
    return true;
  return featureValues(record).some((one) => carriesSequenceSteps627(one, depth + 1));
}

/** A creature's spell slots, or a spell of its trait with its own numbers (1.642): a hag coven. */
function carriesInnateSlots626(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInnateSlots626(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const casting = plainRecord(record.spellcasting);
  if (casting) {
    if (casting.slots !== undefined) return true;
    const spells = Array.isArray(casting.spells) ? casting.spells : [];
    if (spells.some((one) => plainRecord(one)?.saveDifficulty !== undefined || plainRecord(one)?.toHit !== undefined))
      return true;
  }
  return featureValues(record).some((one) => carriesInnateSlots626(one, depth + 1));
}

/** A mount that carries riders by weight, or riders weighed (1.641): a Carpet of Flying. */
function carriesMountWeights625(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMountWeights625(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.mountCarries !== undefined) return true;
  if (plainRecord(record.mounts)?.weights !== undefined) return true;
  return featureValues(record).some((one) => carriesMountWeights625(one, depth + 1));
}

/** An item's use that casts other entries (1.640): a Ring of Three Wishes. */
function carriesItemDuplicates624(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemDuplicates624(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const item = plainRecord(record.item);
  if (item) {
    const uses = [
      item.use,
      ...(Array.isArray(item.moreUses) ? item.moreUses.map((more) => plainRecord(more)?.use) : []),
    ];
    if (uses.some((use) => plainRecord(use)?.duplicates !== undefined)) return true;
  }
  return featureValues(record).some((one) => carriesItemDuplicates624(one, depth + 1));
}

/** An item that adds to its holder's proficiency bonus (1.639): an Ioun Stone of Mastery. */
function carriesProficiencyBonus623(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesProficiencyBonus623(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const key of ["worn", "carried"]) if (plainRecord(record[key])?.proficiencyBonus !== undefined) return true;
  return featureValues(record).some((one) => carriesProficiencyBonus623(one, depth + 1));
}

/** A condition that gives way as its holder first sees somebody (1.638): a Philter of Love. */
function carriesFirstSeen622(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFirstSeen622(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.onFirstSeen !== undefined) return true;
  return featureValues(record).some((one) => carriesFirstSeen622(one, depth + 1));
}

/** A zone lasting past 1000 rounds, closed by its caster, or spreading (1.637): an Eversmoking Bottle,
 *  an Oil of Slipperiness. */
function carriesLongZones621(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLongZones621(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(record.zone);
  if (
    zone &&
    (zone.close !== undefined || zone.spreads !== undefined || (typeof zone.rounds === "number" && zone.rounds > 1000))
  )
    return true;
  return featureValues(record).some((one) => carriesLongZones621(one, depth + 1));
}

/** A check out of a condition that spends its item or bars more tries (1.636): Iron Bands. */
function carriesCheckEndsItem620(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCheckEndsItem620(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const check = plainRecord(record.checkEnds);
  if (check && (check.spendsItem !== undefined || check.failedRetryAfter !== undefined)) return true;
  return featureValues(record).some((one) => carriesCheckEndsItem620(one, depth + 1));
}

/** A condition's harm its saves wear down (1.635): a Potion of Poison. */
function carriesHarmDrops619(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHarmDrops619(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.harms)?.save)?.drops !== undefined) return true;
  return featureValues(record).some((one) => carriesHarmDrops619(one, depth + 1));
}

/** A condition's entry used at numbers of its own (1.634): a Potion of Animal Friendship. */
function carriesFixedConditionActions618(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFixedConditionActions618(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    record.condition !== undefined &&
    Array.isArray(record.actions) &&
    record.actions.some((one) => plainRecord(one)?.entry !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesFixedConditionActions618(one, depth + 1));
}

/** A target test for a creature under nobody else's control (1.633): Pipes of the Sewers. */
function carriesUncontrolled617(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUncontrolled617(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.targetTypes)?.uncontrolled !== undefined) return true;
  return featureValues(record).some((one) => carriesUncontrolled617(one, depth + 1));
}

/** What a condition leaves behind only as it ends some ways (1.632): Pipes of the Sewers. */
function carriesOnEndWhen616(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOnEndWhen616(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.onEnd)?.when !== undefined) return true;
  return featureValues(record).some((one) => carriesOnEndWhen616(one, depth + 1));
}

/** An area that pushes out whoever saved (1.631): a Bead of Force. */
function carriesPushesOutSaved615(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPushesOutSaved615(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.pushesOutSaved !== undefined) return true;
  return featureValues(record).some((one) => carriesPushesOutSaved615(one, depth + 1));
}

/** An item use that may backfire on its user (1.630): a Horn of Blasting. */
function carriesBackfires614(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBackfires614(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.backfires !== undefined) return true;
  return featureValues(record).some((one) => carriesBackfires614(one, depth + 1));
}

/** Another amount dealt instead to what it names (1.629): a Horn of Blasting against glass. */
function carriesAmountAgainst613(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAmountAgainst613(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.amountAgainst !== undefined) return true;
  return featureValues(record).some((one) => carriesAmountAgainst613(one, depth + 1));
}

/** An item's use that needs senses, or an entry once a target over an area (1.628): the Pipes of
 *  Haunting. */
function carriesUseNeeds612(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUseNeeds612(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const uses = [
    record.use,
    ...(Array.isArray(record.moreUses) ? record.moreUses.map((more) => plainRecord(more)?.use) : []),
  ];
  if (record.category !== undefined && uses.some((use) => plainRecord(use)?.needs !== undefined)) return true;
  if (record.oncePerTarget !== undefined && record.area !== undefined) return true;
  return featureValues(record).some((one) => carriesUseNeeds612(one, depth + 1));
}

/** Every `dismisses.while` anywhere in it (1.627), for a way back at will. */
function dismissedWhile611(value: unknown, into: Set<string>, depth = 0): void {
  if (!value || depth > 40) return;
  if (Array.isArray(value)) return value.forEach((one) => dismissedWhile611(one, into, depth + 1));
  const record = plainRecord(value);
  if (!record) return;
  const away = plainRecord(record.dismisses)?.while;
  if (typeof away === "string") into.add(away);
  featureValues(record).forEach((one) => dismissedWhile611(one, into, depth + 1));
}

/** Away under a condition its holder may take off at will (1.627): a Robe of Stars' Astral Plane. */
function carriesAwayAtWill611(ruleset: unknown, documents: readonly unknown[]): boolean {
  const conditions = plainRecord(plainRecord(ruleset)?.combat)?.conditions;
  const endable = new Set(
    (Array.isArray(conditions) ? conditions : []).flatMap((one) => {
      const record = plainRecord(one);
      return record?.endable !== undefined && typeof record.condition === "string" ? [record.condition] : [];
    }),
  );
  if (endable.size === 0) return false;
  const away = new Set<string>();
  dismissedWhile611(ruleset, away);
  for (const document of documents) dismissedWhile611(document, away);
  return [...away].some((id) => endable.has(id));
}

/** A missile caught and kept (1.626): Gloves of Missile Snaring. */
function carriesKeepsCaught610(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKeepsCaught610(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.keepsCaught !== undefined) return true;
  return featureValues(record).some((one) => carriesKeepsCaught610(one, depth + 1));
}

/** A condition lasting its rounds a rolled number of times over (1.625): a Potion of Growth. */
function carriesDurationTimes609(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDurationTimes609(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duration)?.times !== undefined) return true;
  return featureValues(record).some((one) => carriesDurationTimes609(one, depth + 1));
}

/** An item used on past its last charge (1.624): the Wind Fan. */
function carriesOveruse608(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOveruse608(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.charges)?.overuse !== undefined) return true;
  return featureValues(record).some((one) => carriesOveruse608(one, depth + 1));
}

/** An item use whose condition lasts while the item's charges do (1.623): the Boots of Speed. */
function carriesChargesPerRound607(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChargesPerRound607(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.chargesPerRound !== undefined) return true;
  return featureValues(record).some((one) => carriesChargesPerRound607(one, depth + 1));
}

/** A condition its holder may take off at will (1.622): the Ring of Invisibility. */
function carriesEndable606(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndable606(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endable !== undefined) return true;
  return featureValues(record).some((one) => carriesEndable606(one, depth + 1));
}

/** A call that sets down what it calls within some distance of its caller (1.621): Animate Trees. */
function carriesCallWithin605(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallWithin605(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.within !== undefined) return true;
  return featureValues(record).some((one) => carriesCallWithin605(one, depth + 1));
}

/** A call commanded only within some distance of its caller (1.620): the Staff of the Python. */
function carriesCommandedWithin604(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCommandedWithin604(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.commandedWithin !== undefined) return true;
  return featureValues(record).some((one) => carriesCommandedWithin604(one, depth + 1));
}

/** A worn item that keeps creatures of some entries from aiming at its wearer (1.619): the Pipes of
 *  the Sewers' rats. */
function carriesIgnoredBy603(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesIgnoredBy603(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.ignoredBy !== undefined) return true;
  return featureValues(record).some((one) => carriesIgnoredBy603(one, depth + 1));
}

/** A contest that leaves something on a target its user loses to, and a condition that ends as its
 *  holder can't hear its source (1.618): the Pipes of the Sewers. */
function carriesUnswayed602(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUnswayed602(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.contest)?.onLose !== undefined) return true;
  if (plainRecord(record.endsWhenHolder)?.cantHearSource !== undefined) return true;
  return featureValues(record).some((one) => carriesUnswayed602(one, depth + 1));
}

/** A use offered only while its user holds a condition, and a condition kept only while its source
 *  holds one (1.617): the Pipes of the Sewers. */
function carriesUserHolds601(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUserHolds601(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.userHolds !== undefined || plainRecord(record.endsWhenSource)?.lacks !== undefined) return true;
  return featureValues(record).some((one) => carriesUserHolds601(one, depth + 1));
}

function carriesRemainingOf600(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRemainingOf600(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duration)?.remainingOf !== undefined) return true;
  return featureValues(record).some((one) => carriesRemainingOf600(one, depth + 1));
}

/** A call whose creatures are under nobody's control, tamed while holding a condition (1.615): Pipes
 *  of the Sewers. */
function carriesWildCall599(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWildCall599(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls && (calls.side !== undefined || calls.tamedWhile !== undefined)) return true;
  // Charges more that only call more (1.615).
  const step = plainRecord(record.chargeStep);
  if (step && calls && step.amount === undefined && step.targets === undefined && step.push === undefined) return true;
  return featureValues(record).some((one) => carriesWildCall599(one, depth + 1));
}

/** A call offered only where it says, or whose creatures arrive after their caller's turns (1.614): a
 *  vampire's Children of the Night. */
function carriesCallWhere598(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallWhere598(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    record.onlyWhere !== undefined &&
    (record.creature !== undefined || record.from !== undefined || record.options !== undefined)
  )
    return true;
  if (plainRecord(record.calls)?.arrivesIn !== undefined) return true;
  return featureValues(record).some((one) => carriesCallWhere598(one, depth + 1));
}

/** An item that becomes the creature it calls, or a catalog entry's or an item's call its user may
 *  dismiss (1.613): a Staff of the Python. */
function carriesBecomesItem597(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBecomesItem597(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls?.becomesItem !== undefined) return true;
  // A creature action's dismissible is 1.449 (its budget 1.610); a catalog entry's or an item's is new.
  if (calls?.dismissible !== undefined && record.name === undefined) return true;
  return featureValues(record).some((one) => carriesBecomesItem597(one, depth + 1));
}

/** An item spent as what it called dies, or a wait from the departure of what it called, or a
 *  fight's round length (1.612): a Ring of Djinni Summoning. */
function carriesDeparture596(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDeparture596(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.spendsItemOnDeath !== undefined) return true;
  if (plainRecord(plainRecord(record.recharge)?.after)?.fromDeparture !== undefined) return true;
  if (record.economy !== undefined && record.roundSeconds !== undefined) return true;
  return featureValues(record).some((one) => carriesDeparture596(one, depth + 1));
}

/** Called creatures that come against their user unless it meets a requirement (1.611): a Horn of
 *  Valhalla. */
function carriesHostileUnless595(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHostileUnless595(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.hostileUnless !== undefined) return true;
  return featureValues(record).some((one) => carriesHostileUnless595(one, depth + 1));
}

/** Called creatures leashed to their caller, or sent away on a budget of its own (1.610): a
 *  treant's animated trees. */
function carriesCallLeash594(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCallLeash594(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls && (calls.leash !== undefined || plainRecord(calls.dismissible))) return true;
  return featureValues(record).some((one) => carriesCallLeash594(one, depth + 1));
}

/** What obscures for everybody but its caster (1.609): an Insect Cloud. */
function carriesNotForCaster593(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesNotForCaster593(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.obscures)?.notForCaster !== undefined) return true;
  return featureValues(record).some((one) => carriesNotForCaster593(one, depth + 1));
}

/** A condition that ends when its holder is incapacitated, or an aura only to whom its holder sees
 *  (1.608): a knight's Leadership. */
function carriesLeadership592(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLeadership592(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.endsWhenHolder)?.incapacitated !== undefined) return true;
  if (record.distance !== undefined && record.seenByHolder !== undefined) return true;
  return featureValues(record).some((one) => carriesLeadership592(one, depth + 1));
}

/** A creature's move toward a hostile it can see (1.607): an orc's Aggressive. */
function carriesMoveToward591(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMoveToward591(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.move)?.toward !== undefined) return true;
  return featureValues(record).some((one) => carriesMoveToward591(one, depth + 1));
}

/** A creature action that is free or taken before it attacks (1.606): a berserker's Reckless. A
 *  creature's action has a `name`, where a catalog entry's mechanics never do. */
function carriesCreatureFree590(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureFree590(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    record.name !== undefined &&
    record.budget !== undefined &&
    (record.free !== undefined || record.beforeAttack !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesCreatureFree590(one, depth + 1));
}

/** A condition that holds only in some light (1.605): a shadow's Sunlight Weakness. */
function carriesHeldOnlyIn589(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldOnlyIn589(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.heldOnlyIn !== undefined) return true;
  return featureValues(record).some((one) => carriesHeldOnlyIn589(one, depth + 1));
}

/** An entry made again only once its target is down (1.604): Hunter's Mark. */
function carriesAfterTargetDown588(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAfterTargetDown588(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.repeats)?.afterTargetDown !== undefined) return true;
  return featureValues(record).some((one) => carriesAfterTargetDown588(one, depth + 1));
}

/** A zone that lets nobody teleport out of it unsaved (1.603): Forcecage. */
function carriesTeleportSave587(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTeleportSave587(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.forbids)?.teleport)) return true;
  return featureValues(record).some((one) => carriesTeleportSave587(one, depth + 1));
}

/** A wall laid only as a ring, or a zone that blocks spells (1.602): Forcecage. */
function carriesCage586(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCage586(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.area)?.ringOnly !== undefined) return true;
  const zone = plainRecord(record.zone);
  if (Array.isArray(zone?.blocks) && zone.blocks.includes("spells")) return true;
  return featureValues(record).some((one) => carriesCage586(one, depth + 1));
}

/** A behavior that keeps its condition's own actions (1.601): Wind Walk's revert. */
function carriesBehaviorActions585(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBehaviorActions585(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.actions !== undefined) return true;
  return featureValues(record).some((one) => carriesBehaviorActions585(one, depth + 1));
}

/** A creature moved through only by the strong, or filling none of its space (1.600): Arcane Hand. */
function carriesPassableBy584(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPassableBy584(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.passableBy !== undefined || record.fillsSpace === false) return true;
  return featureValues(record).some((one) => carriesPassableBy584(one, depth + 1));
}

/** A condition that ends once its source acts again (1.599): Interposing Hand. */
function carriesEndsWhenSourceActs583(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsWhenSourceActs583(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && plainRecord(record.endsWhenSource)?.acts !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsWhenSourceActs583(one, depth + 1));
}

/** A contest's winner moving with the one it pushes (1.598): Forceful Hand. */
function carriesContestFollows582(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesContestFollows582(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.onWin)?.follows !== undefined) return true;
  return featureValues(record).some((one) => carriesContestFollows582(one, depth + 1));
}

/** More than 12 contests (1.597): 5e's Arcane Hand's own grasp. */
function carriesContests16544(ruleset: unknown): boolean {
  const contests = plainRecord(plainRecord(ruleset)?.combat)?.contests;
  return Array.isArray(contests) && contests.length > 12;
}

/** More than 320 conditions (1.552): 5e's magic items outgrew them. */
function carriesConditions640499(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConditions640499(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.conditions) && record.conditions.length > 320) return true;
  return Object.values(record).some((one) => carriesConditions640499(one, depth + 1));
}

/** Held by self (1.553): Grappler's advantage and pin. */
function carriesHeldBySelf537(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldBySelf537(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.targetHoldsFromSelf)) return true;
  if (record.targetHeldBySelf !== undefined && record.attacker !== undefined) return true;
  if (plainRecord(record.both) && plainRecord(record.both)?.whileTargetHolds !== undefined) return true;
  return featureValues(record).some((one) => carriesHeldBySelf537(one, depth + 1));
}

/** Weapons that corrode on hitting it (1.551): a rust monster's Rust Metal. */
function carriesCorrodesWeapons535(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCorrodesWeapons535(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.corrodesWeapons) && Array.isArray(record.actions)) return true;
  return featureValues(record).some((one) => carriesCorrodesWeapons535(one, depth + 1));
}

/** Heads that die and grow back (1.550): a hydra's Multiple Heads, Reactive Heads and Multiattack. */
function carriesHeads534(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeads534(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.heads) && Array.isArray(record.actions)) return true;
  if (record.perHead !== undefined && typeof record.action === "string") return true;
  return featureValues(record).some((one) => carriesHeads534(one, depth + 1));
}

/** Budgets back every turn (1.549): a marilith's Reactive. */
function carriesRefillsEveryTurn533(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRefillsEveryTurn533(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.refillsEveryTurn) && Array.isArray(record.actions)) return true;
  return featureValues(record).some((one) => carriesRefillsEveryTurn533(one, depth + 1));
}

/** Hanging on as one of its forms (1.548): a vampire's Misty Escape. */
function carriesHangsOnBecomes532(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHangsOnBecomes532(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.hangsOn)?.becomes)) return true;
  return featureValues(record).some((one) => carriesHangsOnBecomes532(one, depth + 1));
}

/** Actions only in a given shape (1.547): a wereboar's Charge. */
function carriesInShape531(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInShape531(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.inShape) && typeof record.budget === "string") return true;
  return featureValues(record).some((one) => carriesInShape531(one, depth + 1));
}

/** What follows a charge (1.546): a lion's Pounce. */
function carriesChargeThen530(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChargeThen530(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.charge) && plainRecord(plainRecord(record.charge)!.then)) return true;
  return featureValues(record).some((one) => carriesChargeThen530(one, depth + 1));
}

/** A gnoll's Rampage (1.545). */
function carriesRampage529(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRampage529(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.rampage) && Array.isArray(record.actions)) return true;
  return featureValues(record).some((one) => carriesRampage529(one, depth + 1));
}

/** Attacks and damage only at a surprised or not-yet-acted target, and hits made criticals (1.544):
 *  Assassinate, a bugbear's Surprise Attack. */
function carriesSurpriseStrikes528(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSurpriseStrikes528(one, depth + 1));
  if (value === "target-surprised" || value === "target-not-yet-acted") return true;
  const record = plainRecord(value);
  if (!record) return false;
  if (record.whenTarget === "surprised" || record.whenTarget === "not-yet-acted") return true;
  if (record.critical === true && record.to === "attacks") return true;
  return featureValues(record).some((one) => carriesSurpriseStrikes528(one, depth + 1));
}

/** A golem's Berserk (1.543): a low-health roll as its turn starts, a condition that sends its
 *  holder at the nearest creature, or one that ends at full health. */
function carriesBerserk527(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBerserk527(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.rollsAtTurnStart) && (record.health !== undefined || Array.isArray(record.actions)))
    return true;
  if (
    typeof record.condition === "string" &&
    (record.endsAtFullHealth === true || plainRecord(record.behavior)?.nearest === true)
  )
    return true;
  return featureValues(record).some((one) => carriesBerserk527(one, depth + 1));
}

/** Conditions harm puts on a creature (1.542): a flesh golem's Aversion of Fire. */
function carriesWhenHarmedBy526(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWhenHarmedBy526(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.whenHarmedBy) && (record.health !== undefined || Array.isArray(record.actions))) return true;
  return featureValues(record).some((one) => carriesWhenHarmedBy526(one, depth + 1));
}

/** Damage types that heal a creature instead (1.541): a flesh golem's Lightning Absorption. */
function carriesHealedBy525(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealedBy525(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.healedBy) && (record.health !== undefined || Array.isArray(record.actions))) return true;
  return featureValues(record).some((one) => carriesHealedBy525(one, depth + 1));
}

/** A creature's burst as it dies (1.540): a mephit's Death Burst. */
function carriesOnDeath524(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOnDeath524(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.onDeath) && Array.isArray(record.actions)) return true;
  return featureValues(record).some((one) => carriesOnDeath524(one, depth + 1));
}

/** A summons that strikes by itself, or stays past 100 rounds (1.539): Faithful Hound. */
function carriesStrikingSummons523(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStrikingSummons523(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const summons = plainRecord(record.summons);
  if (
    summons &&
    (summons.strikesAtTurnStart !== undefined ||
      summons.budget === undefined ||
      (typeof summons.rounds === "number" && summons.rounds > 100))
  )
    return true;
  return featureValues(record).some((one) => carriesStrikingSummons523(one, depth + 1));
}

/** Called creatures that turn on their caller as its concentration breaks (1.538): Conjure Elemental. */
function carriesHostileOnBreak522(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHostileOnBreak522(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.hostileOnBreak !== undefined) return true;
  return featureValues(record).some((one) => carriesHostileOnBreak522(one, depth + 1));
}

/** A call that grows with each step paid (1.537): Animate Dead's two more, Create Undead's options,
 *  Conjure Elemental's challenge rating. */
function carriesSteppedCalls521(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSteppedCalls521(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls) {
    const stepped = (one: Record<string, unknown> | undefined) =>
      !!one &&
      (one.perStep !== undefined || one.fromStep !== undefined || plainRecord(one.upTo)?.perStep !== undefined);
    if (stepped(calls) || (Array.isArray(calls.options) && calls.options.some((one) => stepped(plainRecord(one)))))
      return true;
  }
  return featureValues(record).some((one) => carriesSteppedCalls521(one, depth + 1));
}

/** A further use whose count is rolled for each stack (1.536): a Helm of Brilliance's gems. */
function carriesRolledUses520(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRolledUses520(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.moreUses) &&
    record.moreUses.some((one) => plainRecord(plainRecord(one)?.uses)?.rolled !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesRolledUses520(one, depth + 1));
}

/** An item's use with others' effects beside it (1.535): Thunder and Lightning. */
function carriesAlongside519(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAlongside519(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.moreUses) && record.moreUses.some((one) => plainRecord(one)?.alongside !== undefined))
    return true;
  return featureValues(record).some((one) => carriesAlongside519(one, depth + 1));
}

/** A weapon hit's spend with its own uses, a save or drain, conditions only, or conditions with a
 *  clock beside a save or on its wielder's turns (1.534): a Rod of Lordly Might's properties. */
function carriesSpendUses518(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSpendUses518(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const spends = plainRecord(record.attack)?.spends;
  if (
    Array.isArray(spends) &&
    spends.some((one) => {
      const spend = plainRecord(one);
      if (!spend) return false;
      if (["uses", "save", "drain"].some((key) => spend[key] !== undefined) || spend.amount === undefined) return true;
      return (
        Array.isArray(spend.onHit) &&
        spend.onHit.some((hit) => {
          const entry = plainRecord(hit);
          return !!entry && (entry.of !== undefined || (entry.rounds !== undefined && entry.saveEnds !== undefined));
        })
      );
    })
  )
    return true;
  return featureValues(record).some((one) => carriesSpendUses518(one, depth + 1));
}

/** A zone that sets aside called creatures inside it (1.533): Antimagic Field's summons. */
function carriesSetsAsideCalled517(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSetsAsideCalled517(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.suppresses)?.setsAsideCalled !== undefined) return true;
  return featureValues(record).some((one) => carriesSetsAsideCalled517(one, depth + 1));
}

/** An item's use centred on its user (1.532): the Staff of Thunder and Lightning's Thunderclap. */
function carriesItemUseAround516(value: unknown, depth = 0, inItem = false): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemUseAround516(one, depth + 1, inItem));
  const record = plainRecord(value);
  if (!record) return false;
  if (inItem && plainRecord(record.area)?.around !== undefined) return true;
  // An item's use and its more uses, wherever the item is.
  const item = plainRecord(record.item);
  if (item) {
    const uses = [
      item.use,
      ...(Array.isArray(item.moreUses) ? item.moreUses.map((more) => plainRecord(more)?.use) : []),
    ];
    if (uses.some((use) => carriesItemUseAround516(use, depth + 1, true))) return true;
  }
  return featureValues(record).some((one) => carriesItemUseAround516(one, depth + 1, inItem));
}

/** A condition that may be cut away (1.531): a net. */
function carriesCutFree515(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCutFree515(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.cutFree !== undefined) return true;
  return featureValues(record).some((one) => carriesCutFree515(one, depth + 1));
}

/** A target test that excepts what it never is (1.530): a net's formless creatures. */
function carriesTargetExcept514(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTargetExcept514(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const except = plainRecord(record.except);
  if (except && ["types", "tags", "upToSize", "atLeastSize"].some((key) => except[key] !== undefined)) return true;
  return featureValues(record).some((one) => carriesTargetExcept514(one, depth + 1));
}

/** A condition whose holder walks on water as on ground (1.529): Water Walk. */
function carriesWalksOnLiquid513(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWalksOnLiquid513(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.walksOnLiquid !== undefined) return true;
  return featureValues(record).some((one) => carriesWalksOnLiquid513(one, depth + 1));
}

/** A condition held off while its holder holds others or cannot move (1.528): Cloak of Displacement. */
function carriesHeldOffWhile512(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldOffWhile512(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.heldOffWhile !== undefined) return true;
  return featureValues(record).some((one) => carriesHeldOffWhile512(one, depth + 1));
}

/** A condition that answers whoever touches its holder (1.527): an azer's Heated Body. */
function carriesTouches511(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTouches511(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.whenHit)?.touches !== undefined) return true;
  return featureValues(record).some((one) => carriesTouches511(one, depth + 1));
}

/** A save made as days pass outside a fight (1.526): Feeblemind's, every 30 days. */
function carriesDaySaves510(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDaySaves510(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.saveEnds)?.at === "days") return true;
  return featureValues(record).some((one) => carriesDaySaves510(one, depth + 1));
}

/** A condition that forbids using items, or more than six conditions an entry puts on each by the
 *  steps it is paid at (1.525): Feeblemind, Branding Smite. */
function carriesItemsForbidOrPaidApplies509(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemsForbidOrPaidApplies509(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.forbids)?.items) !== undefined) return true;
  if (
    Array.isArray(record.applies) &&
    record.applies.length > 6 &&
    record.appliesOneOf === undefined &&
    record.applies.every((entry) => plainRecord(plainRecord(entry)?.paidSteps) !== undefined)
  ) {
    return true;
  }
  return featureValues(record).some((one) => carriesItemsForbidOrPaidApplies509(one, depth + 1));
}

/** An item or a creature that stores entries to be cast later (1.524): a Ring of Spell Storing. */
function carriesStores508(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStores508(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.stores) !== undefined) return true;
  return featureValues(record).some((one) => carriesStores508(one, depth + 1));
}

/** A condition or worn item that turns a foe's entry back, or a save change against an entry aimed
 *  at its holder alone (1.523): a Ring of Spell Turning. */
function carriesTurns507(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTurns507(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.turns) !== undefined) return true;
  if (plainRecord(record.against)?.alone !== undefined) return true;
  return featureValues(record).some((one) => carriesTurns507(one, depth + 1));
}

/** A condition or worn item that takes in a foe's entry aimed at its holder alone (1.522): a Rod of
 *  Absorption. */
function carriesAbsorbs506(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAbsorbs506(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.absorbs) !== undefined) return true;
  return featureValues(record).some((one) => carriesAbsorbs506(one, depth + 1));
}

/** A zone that suppresses conditions off some catalogs, or items with some tags (1.521): Antimagic Field. */
function carriesSuppresses505(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSuppresses505(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(record.zone);
  if (plainRecord(zone?.suppresses) !== undefined || plainRecord(zone?.forbids)?.casts !== undefined) return true;
  return featureValues(record).some((one) => carriesSuppresses505(one, depth + 1));
}

/** A condition that wards its holder from entries of a level or lower (1.520): a rakshasa's. */
function carriesConditionWards504(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConditionWards504(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && plainRecord(record.wards) !== undefined) return true;
  return featureValues(record).some((one) => carriesConditionWards504(one, depth + 1));
}

/** An item's further uses that count their own, or more than 8 of them (1.519): a Staff of Thunder and
 *  Lightning, a Helm of Brilliance. */
function carriesOwnUses503(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOwnUses503(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.moreUses) &&
    (record.moreUses.length > 8 || record.moreUses.some((one) => plainRecord(one)?.uses !== undefined))
  )
    return true;
  return featureValues(record).some((one) => carriesOwnUses503(one, depth + 1));
}

/** A condition anybody next to its holder may end with their own check (1.518): dousing a fire. */
function carriesCheckEndsByAny502(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCheckEndsByAny502(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.checkEnds)?.by !== undefined) return true;
  return featureValues(record).some((one) => carriesCheckEndsByAny502(one, depth + 1));
}

/** A condition an entry puts on only when paid so many steps up (1.517): Magic Weapon's +2 and +3. */
function carriesPaidSteps501(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPaidSteps501(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && plainRecord(record.paidSteps) !== undefined) return true;
  return featureValues(record).some((one) => carriesPaidSteps501(one, depth + 1));
}

/** An item use that raises its user's abilities for good (1.516): a Manual of Gainful Exercise. */
function carriesRaises500(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRaises500(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.kind === "string" && plainRecord(record.raises) !== undefined) return true;
  return featureValues(record).some((one) => carriesRaises500(one, depth + 1));
}

/** A condition that changes its holder's abilities (1.515): a Potion of Giant Strength, Feeblemind. */
function carriesConditionAbilities499(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConditionAbilities499(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && plainRecord(record.abilities) !== undefined) return true;
  return featureValues(record).some((one) => carriesConditionAbilities499(one, depth + 1));
}

/** A condition damage stops working until its holder's next turn (1.514): a Cloak of Displacement. */
function carriesHarmStopped498(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHarmStopped498(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.suppressedWhenHarmed !== undefined) return true;
  return featureValues(record).some((one) => carriesHarmStopped498(one, depth + 1));
}

/** An item worn or carried that keeps conditions on its holder or lengthens their jumps (1.513):
 *  an Ioun Stone of Awareness, Boots of Striding and Springing. */
function carriesItemKeepsOn497(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemKeepsOn497(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const key of ["worn", "carried"]) {
    const effect = plainRecord(record[key]);
    if (effect && (effect.keepsOn !== undefined || effect.jumps !== undefined)) return true;
  }
  return featureValues(record).some((one) => carriesItemKeepsOn497(one, depth + 1));
}

/** A breath rule for creatures that breathe only water (1.512): a shark out of the sea. */
function carriesWaterOnly496(ruleset: unknown): boolean {
  const combat = plainRecord(plainRecord(ruleset)?.combat);
  return plainRecord(plainRecord(plainRecord(combat?.underwater)?.breath)?.waterOnly) !== undefined;
}

/** An item's attack with no damage dice, or a weapon condition put on by any hit or ended by its
 *  holder's check (1.511): a blowgun, a net. */
function carriesDicelessAttack495(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDicelessAttack495(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  const damage = plainRecord(attack?.damage);
  if (attack && damage && damage.dice === undefined) return true;
  if (
    Array.isArray(attack?.onHit) &&
    attack.onHit.some((one) => plainRecord(one)?.atLeast === 0 || plainRecord(one)?.checkEnds !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesDicelessAttack495(one, depth + 1));
}

/** A condition or worn item that turns critical hits on its holder into plain ones (1.510). */
function carriesNoCriticals494(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value))
    return value.includes("criticals-against-normal") || value.some((one) => carriesNoCriticals494(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  return featureValues(record).some((one) => carriesNoCriticals494(one, depth + 1));
}

/** A reaction that steps in front of an attack aimed at somebody else, or a defense or aimed moment
 *  narrowed to one kind of attack (1.509): Arrow-Catching Shield. */
function carriesTakesAim493(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTakesAim493(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.takesAim !== undefined) return true;
  if (record.to === "defense" && record.blow !== undefined) return true;
  if (record.on === "aimed" && record.blow !== undefined) return true;
  return featureValues(record).some((one) => carriesTakesAim493(one, depth + 1));
}

/** A condition whose answer to a hit harms the hitter, reaches only so far, or asks no save (1.508):
 *  Fire Shield, an azer's Heated Body. */
function carriesHitBack492(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHitBack492(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const whenHit = record.condition !== undefined ? plainRecord(record.whenHit) : undefined;
  if (whenHit && (whenHit.harms !== undefined || whenHit.within !== undefined || whenHit.save === undefined))
    return true;
  return featureValues(record).some((one) => carriesHitBack492(one, depth + 1));
}

/** A condition that gives its holder turns in a row, time stopped (1.507): Time Stop. */
function carriesStopsTime491(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStopsTime491(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && plainRecord(record.stopsTime)) return true;
  return featureValues(record).some((one) => carriesStopsTime491(one, depth + 1));
}

/** A condition that takes its holder off the board until their next turn (1.506): Blink. */
function carriesBlinks490(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBlinks490(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && plainRecord(record.blinks)) return true;
  return featureValues(record).some((one) => carriesBlinks490(one, depth + 1));
}

/** A condition with illusory duplicates that draw attacks (1.505): Mirror Image. */
function carriesDuplicates489(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDuplicates489(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && plainRecord(record.duplicates)?.thresholds !== undefined) return true;
  return featureValues(record).some((one) => carriesDuplicates489(one, depth + 1));
}

/** Stopping in a foe's space and what entering one does, and landing from a fallen mount (1.504):
 *  Air and Fire Form, a rider's reaction. */
function carriesElementalForms488(ruleset: unknown, depth = 0): boolean {
  const record = plainRecord(ruleset);
  if (depth === 0 && plainRecord(plainRecord(plainRecord(record?.combat)?.mounts)?.fall)?.landsWith !== undefined)
    return true;
  if (!ruleset || depth > 40) return false;
  if (Array.isArray(ruleset)) return ruleset.some((one) => carriesElementalForms488(one, depth + 1));
  if (!record) return false;
  if (record.condition !== undefined && (record.stopsInFoes !== undefined || plainRecord(record.entering))) return true;
  return featureValues(record).some((one) => carriesElementalForms488(one, depth + 1));
}

/** A condition spent by its holder's next weapon hit, or one whose holder's hits put something on
 *  whoever they hit (1.503): Branding Smite. */
function carriesOwnHit487(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOwnHit487(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsAfter === "own-hit") return true;
  if (record.condition !== undefined && plainRecord(record.onHit)) return true;
  return featureValues(record).some((one) => carriesOwnHit487(one, depth + 1));
}

/** A condition spent by its source's attack, or attacks at its holder narrowed to its source (1.502):
 *  True Strike. */
function carriesSourceAttacked486(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSourceAttacked486(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsAfter === "attacked-by-source") return true;
  if (record.to === "attacks-taken" && record.fromSource !== undefined) return true;
  return featureValues(record).some((one) => carriesSourceAttacked486(one, depth + 1));
}

/** A condition that changes its holder's weapons (1.501): Magic Weapon, Shillelagh. */
function carriesConditionWeapon485(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConditionWeapon485(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && plainRecord(record.weapon)) return true;
  return featureValues(record).some((one) => carriesConditionWeapon485(one, depth + 1));
}

/** Dying rolls made as saves, and conditions on them or on healing (1.500): Beacon of Hope. */
function carriesDeathSaves484(ruleset: unknown, depth = 0): boolean {
  const record = plainRecord(ruleset);
  if (depth === 0 && plainRecord(plainRecord(record?.combat)?.dying)?.asSave !== undefined) return true;
  if (!ruleset || depth > 40) return false;
  if (Array.isArray(ruleset)) return ruleset.some((one) => carriesDeathSaves484(one, depth + 1));
  if (!record) return false;
  if (record.condition !== undefined && (record.deathSaves !== undefined || record.healedMax !== undefined))
    return true;
  return featureValues(record).some((one) => carriesDeathSaves484(one, depth + 1));
}

/** Jumping (1.499): the combat block's jumping, or a condition whose holder jumps further. */
function carriesJumping483(ruleset: unknown, depth = 0): boolean {
  const record = plainRecord(ruleset);
  if (depth === 0 && plainRecord(record?.combat)?.jumping !== undefined) return true;
  if (!ruleset || depth > 40) return false;
  if (Array.isArray(ruleset)) return ruleset.some((one) => carriesJumping483(one, depth + 1));
  if (!record) return false;
  if (record.condition !== undefined && record.jumps !== undefined) return true;
  return featureValues(record).some((one) => carriesJumping483(one, depth + 1));
}

/** Fighting under water and holding breath (1.498): the combat block's underwater. */
function carriesUnderwater482(ruleset: unknown): boolean {
  return plainRecord(plainRecord(ruleset)?.combat)?.underwater !== undefined;
}

/** A condition whose holder is dragged along by whoever put it on (1.497): grappled. */
function carriesDragged481(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDragged481(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.dragged !== undefined) return true;
  return featureValues(record).some((one) => carriesDragged481(one, depth + 1));
}

/** Mounted combat (1.496): the combat block's mounts, or a creature that acts as it will ridden. */
function carriesMounts480(ruleset: unknown, depth = 0): boolean {
  const record = plainRecord(ruleset);
  if (depth === 0 && plainRecord(record?.combat)?.mounts !== undefined) return true;
  if (!ruleset || depth > 40) return false;
  if (Array.isArray(ruleset)) return ruleset.some((one) => carriesMounts480(one, depth + 1));
  if (!record) return false;
  if (record.mountIndependent !== undefined) return true;
  return featureValues(record).some((one) => carriesMounts480(one, depth + 1));
}

/** Walking through creatures or solid ground, and what a crowded cell costs (1.495). */
function carriesPassing479(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPassing479(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.passesCreatures !== undefined || record.passesObjects !== undefined) return true;
  if (record.order !== undefined && record.passing !== undefined) return true;
  return featureValues(record).some((one) => carriesPassing479(one, depth + 1));
}

/** An item's use that breaks a layered wall's layer as an entry it names (1.494): a scroll of Passwall. */
function carriesEndsLayersAs478(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsLayersAs478(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsLayersAs !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsLayersAs478(one, depth + 1));
}

/** A row that stands for another entry than the one that writes it (1.493): Pact of the Chain's Find Familiar. */
function carriesStandsFor477(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStandsFor477(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.standsFor !== undefined || record._standsFor !== undefined) return true;
  return featureValues(record).some((one) => carriesStandsFor477(one, depth + 1));
}

/** Layers that stop what passes through them, or spare those picked at cast (1.492): Prismatic Wall. */
function carriesLayerBlocks476(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLayerBlocks476(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const layers = plainRecord(record.layers);
  if (layers) {
    if (plainRecord(layers.spares)) return true;
    if (Array.isArray(layers.rows) && layers.rows.some((row) => plainRecord(row)?.blocks !== undefined)) return true;
  }
  return featureValues(record).some((one) => carriesLayerBlocks476(one, depth + 1));
}

/** An entry aimed at a layered wall to break its layer (1.491): Passwall. */
function carriesEndsLayers475(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsLayers475(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsLayers !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsLayers475(one, depth + 1));
}

/** A wall or globe of layers crossed one at a time, and its flash (1.490): Prismatic Wall. */
function carriesLayers474(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLayers474(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.layers)?.rows !== undefined) return true;
  return featureValues(record).some((one) => carriesLayers474(one, depth + 1));
}

/** An attack given up for one by a creature its maker called (1.488): Pact of the Chain. */
function carriesLendsStrikes472(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLendsStrikes472(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.lendsStrikes !== undefined) return true;
  return featureValues(record).some((one) => carriesLendsStrikes472(one, depth + 1));
}

/** Only one's own called creature as a target, or a call that makes its creature another type
 *  (1.487): Find Familiar's familiar, Voice of the Chain Master. */
function carriesFamiliar471(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFamiliar471(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.calledBySelf !== undefined || record.asTypes !== undefined) return true;
  return featureValues(record).some((one) => carriesFamiliar471(one, depth + 1));
}

/** A walk magic may not lower, slipping free, or an item keeping conditions off by who or what puts
 *  them on (1.486): Freedom of Movement, and its ring. */
function carriesFreedom470(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFreedom470(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.speedKeptFrom !== undefined || record.slipsFree !== undefined) return true;
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried), plainRecord(record.otherwise)]) {
    if (effect?.conditionImmunitiesFrom !== undefined) return true;
  }
  return featureValues(record).some((one) => carriesFreedom470(one, depth + 1));
}

/** A duration said as "until-dispelled" (1.485): Continual Flame. */
function carriesUntilDispelled469(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUntilDispelled469(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.duration === "until-dispelled") return true;
  return featureValues(record).some((one) => carriesUntilDispelled469(one, depth + 1));
}

/** An item holding off a kind of condition (1.484): the Periapt of Health's diseases. The kinds are
 *  read off the ruleset's conditions. */
function carriesWornKindHolds468(value: unknown, kinds: ReadonlySet<string>, depth = 0): boolean {
  if (!value || depth > 40 || kinds.size === 0) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWornKindHolds468(one, kinds, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried), plainRecord(record.otherwise)]) {
    if (Array.isArray(effect?.suppresses) && effect.suppresses.some((one) => kinds.has(String(one)))) return true;
  }
  return featureValues(record).some((one) => carriesWornKindHolds468(one, kinds, depth + 1));
}

/** A save made as its putter's turn starts, or failures that send its holder away (1.483):
 *  Prismatic Spray's Violet ray. */
function carriesSourceSaves467(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSourceSaves467(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const ends = plainRecord(record.saveEnds);
  if (ends?.at === "source-turn-start" || plainRecord(ends?.failures)?.dismisses !== undefined) return true;
  return featureValues(record).some((one) => carriesSourceSaves467(one, depth + 1));
}

/** A duration past 1000 rounds, or one paid high enough to have no clock (1.482): Aid's 8 hours,
 *  Bestow Curse from a 9th-level slot. */
function carriesLongDurations466(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLongDurations466(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const duration = plainRecord(record.duration);
  if (typeof duration?.rounds === "number" && duration.rounds > 1000) return true;
  if (Array.isArray(duration?.bySteps) && duration.bySteps.includes("until-dispelled")) return true;
  return featureValues(record).some((one) => carriesLongDurations466(one, depth + 1));
}

/** A condition that lends its holder's senses to whoever put it on (1.481): a familiar seen through. */
function carriesLendsSenses465(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLendsSenses465(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.lendsSenses !== undefined) return true;
  return featureValues(record).some((one) => carriesLendsSenses465(one, depth + 1));
}

/** A conjured weapon gone once left lying far off (1.480): the pact weapon. */
function carriesConjuredVanishes464(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConjuredVanishes464(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.conjures)?.vanishes !== undefined) return true;
  return featureValues(record).some((one) => carriesConjuredVanishes464(one, depth + 1));
}

/** What an entry applies put on what it calls, or called objects with no turns (1.479): Antipathy on
 *  an object. */
function carriesAppliesToCalled463(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAppliesToCalled463(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.appliesToCalled !== undefined) return true;
  if (plainRecord(record.calls)?.initiative === "none") return true;
  return featureValues(record).some((one) => carriesAppliesToCalled463(one, depth + 1));
}

/** A condition held off on some terrains (1.478): the aboleth's curse, off underwater. */
function carriesOffTerrain462(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOffTerrain462(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.whileOffTerrain !== undefined) return true;
  return featureValues(record).some((one) => carriesOffTerrain462(one, depth + 1));
}

/** An item's effect that softens a fall or holds conditions off (1.477): Ring of Feather Falling,
 *  Periapt of Health. A condition's own are older. */
function carriesWornFallsAndHolds461(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWornFallsAndHolds461(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const effect of [plainRecord(record.worn), plainRecord(record.carried), plainRecord(record.otherwise)]) {
    if (effect?.fallsSafely !== undefined || effect?.suppresses !== undefined) return true;
  }
  return featureValues(record).some((one) => carriesWornFallsAndHolds461(one, depth + 1));
}

/** Conditions kept off when an entry of named catalogs would put them on (1.476): Freedom of Movement. */
function carriesImmunityCatalogs460(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesImmunityCatalogs460(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.conditionImmunitiesFrom) &&
    record.conditionImmunitiesFrom.some((one) => plainRecord(one)?.catalogs !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesImmunityCatalogs460(one, depth + 1));
}

/** A creature that splits in two when harmed (1.475): Black Pudding. */
function carriesSplits459(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSplits459(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(plainRecord(record.splits)?.by)) return true;
  return featureValues(record).some((one) => carriesSplits459(one, depth + 1));
}

/** An entry casting other entries of a catalog (1.474): Wish. */
function carriesDuplicates458(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDuplicates458(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duplicates)?.catalog !== undefined) return true;
  return featureValues(record).some((one) => carriesDuplicates458(one, depth + 1));
}

/** A condition raising its holder's health maximum (1.473): Aid, Heroes' Feast. */
function carriesRaisesMax457(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRaisesMax457(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.raisesMax !== undefined) return true;
  return featureValues(record).some((one) => carriesRaisesMax457(one, depth + 1));
}

/** A condition walking its holder as they end their turn (1.472): Compulsion, acting first. */
function carriesWalksAfter456(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWalksAfter456(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.walks === "after") return true;
  return featureValues(record).some((one) => carriesWalksAfter456(one, depth + 1));
}

/** A damage change counting with no attack roll too (1.471): Bestow Curse's extra necrotic. */
function carriesAlsoUnrolled455(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAlsoUnrolled455(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.alsoUnrolled !== undefined) return true;
  return featureValues(record).some((one) => carriesAlsoUnrolled455(one, depth + 1));
}

/** A damage change narrowed to a blow's damage types, or spent once it adds (1.792): oil. */
function carriesDamageOnTypes777(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDamageOnTypes777(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    (record.to === "damage" || record.to === "damage-taken") &&
    (record.onTypes !== undefined || record.spentOnUse !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesDamageOnTypes777(one, depth + 1));
}

/** A duration set by the cost paid, or concentration only below a step (1.470): Bestow Curse. */
function carriesBySteps454(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBySteps454(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duration)?.bySteps !== undefined || record.concentrationBelowStep !== undefined) return true;
  return featureValues(record).some((one) => carriesBySteps454(one, depth + 1));
}

/** An entry picking one of more than six conditions (1.469): Bestow Curse. */
function carriesManyApplies453(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesManyApplies453(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.appliesOneOf === true && Array.isArray(record.applies) && record.applies.length > 6) return true;
  return featureValues(record).some((one) => carriesManyApplies453(one, depth + 1));
}

/** An entry rolling a ray for each target (1.468): Prismatic Spray. */
function carriesRays452(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRays452(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(plainRecord(record.rays)?.rows)) return true;
  return featureValues(record).some((one) => carriesRays452(one, depth + 1));
}

/** A zone that forbids teleporting (1.467): Hallow's Extradimensional Interference. */
function carriesForbidsTeleport451(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesForbidsTeleport451(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.forbids)?.teleport !== undefined) return true;
  return featureValues(record).some((one) => carriesForbidsTeleport451(one, depth + 1));
}

/** A zone whose inside works on a kind chosen as it is cast (1.466): Hallow. */
function carriesInsideChooses450(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInsideChooses450(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.inside)?.chooses !== undefined) return true;
  return featureValues(record).some((one) => carriesInsideChooses450(one, depth + 1));
}

/** An entry with no zone set up before a fight only (1.465): Heroes' Feast. */
function carriesBeforeFightNoZone449(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBeforeFightNoZone449(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.beforeFight !== undefined && record.zone === undefined) return true;
  return featureValues(record).some((one) => carriesBeforeFightNoZone449(one, depth + 1));
}

/** A condition that walks its holder, or is steered (1.464): Compulsion. */
function carriesSteering448(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSteering448(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (behavior && (behavior.walks !== undefined || behavior.from === "steered")) return true;
  if (record.steers !== undefined) return true;
  return featureValues(record).some((one) => carriesSteering448(one, depth + 1));
}

/** A condition that wastes a turn's budget on a failed save (1.463): Bestow Curse. */
function carriesWastes447(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWastes447(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.behavior)?.wastes !== undefined) return true;
  return featureValues(record).some((one) => carriesWastes447(one, depth + 1));
}

/** An entry set up before a fight only (1.462): Glyph of Warding, Hallow. */
function carriesBeforeFight446(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBeforeFight446(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.beforeFight !== undefined) return true;
  return featureValues(record).some((one) => carriesBeforeFight446(one, depth + 1));
}

/** An entry that takes rounds to cast (1.461): Symbol's minute. */
function carriesCastingRounds445(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCastingRounds445(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.castingRounds !== undefined) return true;
  return featureValues(record).some((one) => carriesCastingRounds445(one, depth + 1));
}

/** A zone whose inside works only on some, or is shrugged off with a save (1.460): Hallow. */
function carriesInsideIsSave444(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInsideIsSave444(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const inside = plainRecord(record.inside);
  if (inside && (inside.is !== undefined || inside.save !== undefined)) return true;
  return featureValues(record).some((one) => carriesInsideIsSave444(one, depth + 1));
}

/** A zone whose ground frees whoever steps in of what those it keeps out put on them (1.459): Hallow. */
function carriesFrees443(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFrees443(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.keepsOut)?.frees !== undefined) return true;
  return featureValues(record).some((one) => carriesFrees443(one, depth + 1));
}

/** A zone that keeps some kinds in and wards those outside from them (1.458): Magic Circle reversed. */
function carriesKeepsInWards442(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKeepsInWards442(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const kept = plainRecord(record.keepsOut);
  if (kept && kept.way === "out" && (kept.attacksInto !== undefined || kept.cantGive !== undefined)) return true;
  return featureValues(record).some((one) => carriesKeepsInWards442(one, depth + 1));
}

/** A zone that keeps some kinds out, or in (1.452): Magic Circle, Hallow. */
function carriesKeepsOut436(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKeepsOut436(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.keepsOut !== undefined && plainRecord(record.keepsOut)?.is !== undefined) return true;
  return featureValues(record).some((one) => carriesKeepsOut436(one, depth + 1));
}

/** A zone set off by somebody entering it, or reaching past its cells (1.451): Glyph of Warding. */
function carriesGlyphs435(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesGlyphs435(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const detonates = plainRecord(record.detonates);
  if (detonates && (detonates.entered !== undefined || detonates.within !== undefined || detonates.by !== undefined))
    return true;
  return featureValues(record).some((one) => carriesGlyphs435(one, depth + 1));
}

/** What lands by the health its target has left, or a dismissal of only some (1.450): Divine Word. */
function carriesHealthTiers434(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealthTiers434(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.targetHealthAtMost !== undefined || record.killsAtMost !== undefined || record.dismissesIs !== undefined)
    return true;
  return featureValues(record).some((one) => carriesHealthTiers434(one, depth + 1));
}

/** Those a creature called sent away as an action (1.449): Summon Demon's dismissal. */
function carriesDismissibleCalls433(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDismissibleCalls433(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.calls)?.dismissible !== undefined) return true;
  return featureValues(record).some((one) => carriesDismissibleCalls433(one, depth + 1));
}

/** One of an entry's applies, picked as it is used (1.448): Primeval Awareness' reach. */
function carriesAppliesOneOf432(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAppliesOneOf432(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.appliesOneOf !== undefined) return true;
  return featureValues(record).some((one) => carriesAppliesOneOf432(one, depth + 1));
}

/** A duration that grows with the cost paid (1.447): Primeval Awareness. */
function carriesDurationPerStep431(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDurationPerStep431(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.duration)?.perStep !== undefined) return true;
  return featureValues(record).some((one) => carriesDurationPerStep431(one, depth + 1));
}

/** A creature's call by options, for rounds or bound to its caller (1.446): Summon Demon. A catalog
 *  entry's calls (its mechanics carry a `kind`) took options and rounds at 1.394. */
function carriesCreatureCalls430(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureCalls430(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls) {
    if (calls.endsWithCaller !== undefined || calls.cantCall !== undefined) return true;
    if (record.kind === undefined && (calls.options !== undefined || calls.rounds !== undefined)) return true;
  }
  return featureValues(record).some((one) => carriesCreatureCalls430(one, depth + 1));
}

/** Rows that recharge after days of game time (1.445): Divine Intervention's seven days. */
function carriesRechargeDays429(ruleset: unknown): boolean {
  const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
  return (
    Array.isArray(lists) && lists.some((list) => plainRecord(plainRecord(list)?.pools)?.rechargeDays !== undefined)
  );
}

/** A presence-only sense (1.444): Primeval Awareness. */
function carriesPresence428(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPresence428(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.condition !== undefined && record.presence !== undefined) return true;
  return featureValues(record).some((one) => carriesPresence428(one, depth + 1));
}

/** Conditions its user picks to end (1.442): Greater Restoration. */
function carriesEndsChosen426(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsChosen426(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.ends)?.chosen !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsChosen426(one, depth + 1));
}

/** A use that works only on a roll (1.441): Divine Intervention, a demon's summoning. */
function carriesUseChance425(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUseChance425(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const chance = plainRecord(record.chance);
  if (chance && chance.sides !== undefined && chance.atMost !== undefined) return true;
  return featureValues(record).some((one) => carriesUseChance425(one, depth + 1));
}

/** A condition ended by its holder gaining another (1.440): Rage, knocked unconscious. */
function carriesEndsOnGains424(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsOnGains424(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.endsWhenHolder)?.gains !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsOnGains424(one, depth + 1));
}

/** Awareness of some kinds only, or past no total cover (1.439): Divine Sense. */
function carriesAwareOf423(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAwareOf423(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const aware = plainRecord(record.aware);
  if (aware && (aware.of !== undefined || aware.uncovered !== undefined)) return true;
  return featureValues(record).some((one) => carriesAwareOf423(one, depth + 1));
}

/** A condition that stops casting from a catalog or concentrating, or that its holder going down
 *  ends (1.438): Rage. */
function carriesRageWays422(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRageWays422(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const forbids = plainRecord(record.forbids);
  if (forbids && (forbids.casts !== undefined || forbids.concentration !== undefined)) return true;
  if (plainRecord(record.endsWhenHolder)?.downed !== undefined) return true;
  return featureValues(record).some((one) => carriesRageWays422(one, depth + 1));
}

/** What is kept in a shape or waived, narrowed to some rows (1.437): a druid's spells. */
function carriesRowsWhere421(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRowsWhere421(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.rowsWhere !== undefined) return true;
  return featureValues(record).some((one) => carriesRowsWhere421(one, depth + 1));
}

/** A condition ended on an idle turn (1.436): Rage, Persistent Rage. */
function carriesEndsIdle420(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsIdle420(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsIdle !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsIdle420(one, depth + 1));
}

/** Actions kept in any shape, and components waived (1.435): Beast Spells, Archdruid. */
function carriesShapeKeeps419(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShapeKeeps419(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.shapeKeeps !== undefined || record.waives !== undefined) return true;
  if (Array.isArray(plainRecord(record.shape)?.keeps)) {
    if ((plainRecord(record.shape)!.keeps as unknown[]).some((one) => typeof one === "string" && one.endsWith("/*")))
      return true;
  }
  return featureValues(record).some((one) => carriesShapeKeeps419(one, depth + 1));
}

/** A rest that gives back one named row's pool, or only while a value off the sheet says so (1.434):
 *  Sorcerous Restoration. */
function carriesRestRows418(ruleset: unknown): boolean {
  const rests = plainRecord(ruleset)?.rests;
  if (!Array.isArray(rests)) return false;
  return rests.some((rest) => {
    const restore = plainRecord(rest)?.restore;
    if (!Array.isArray(restore)) return false;
    return restore.some((op) => {
      const step = plainRecord(op);
      return !!step && (step.row !== undefined || step.when !== undefined);
    });
  });
}

/** A condition ended far OR out of sight, as its holder ends a turn (1.433): Intimidating Presence. */
function carriesEndsAwayOr417(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsAwayOr417(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.endsAway)?.orUnseen !== undefined) return true;
  return featureValues(record).some((one) => carriesEndsAwayOr417(one, depth + 1));
}

/** Ways over the ground (1.432): Land's Stride, Unarmored Movement along walls and across water. */
function carriesGroundWays416(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesGroundWays416(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.ignoresHardGround !== undefined || record.runsAcross !== undefined) return true;
  return featureValues(record).some((one) => carriesGroundWays416(one, depth + 1));
}

/** Kept up on later turns without concentration, and spared only on a made save (1.431):
 *  Intimidating Presence. */
function carriesSustains415(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSustains415(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sustains !== undefined || plainRecord(record.oncePerTarget)?.whenSaved !== undefined) return true;
  return featureValues(record).some((one) => carriesSustains415(one, depth + 1));
}

/** Defense against an attacker that has hit already, and attacks-taken on opportunity attacks only
 *  (1.430): Multiattack Defense, Escape the Horde. */
function carriesAttackerNarrowing414(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAttackerNarrowing414(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.to === "string" && (record.afterHitBy !== undefined || record.opportunity !== undefined))
    return true;
  return featureValues(record).some((one) => carriesAttackerNarrowing414(one, depth + 1));
}

/** Choices on the sheet that changes read, and values off the sheet added to attacks, checks and saves
 *  (1.429): Foe Slayer, Elemental Affinity, Natural Explorer. */
function carriesSheetChoices413(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSheetChoices413(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.resistIn !== undefined || record.damageTypeIn !== undefined) return true;
  if (typeof record.to === "string") {
    if (
      record.atTypesIn !== undefined ||
      record.oncePer !== undefined ||
      record.orDamage !== undefined ||
      record.proficient !== undefined
    )
      return true;
    if (record.add !== undefined && ["attacks", "checks", "saves"].includes(record.to)) return true;
  }
  return featureValues(record).some((one) => carriesSheetChoices413(one, depth + 1));
}

function carriesAreaStrikes412(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAreaStrikes412(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.strikesWith !== undefined && (record.strikesWith !== "melee" || record.reaction === undefined))
    return true;
  if (plainRecord(record.strikesAgain)) return true;
  return featureValues(record).some((one) => carriesAreaStrikes412(one, depth + 1));
}

/** Ending a picked spell, or a lasting area (1.427): Cleansing Touch, Dispel Magic on a wall. */
function carriesEndsChoice411(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsChoice411(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const ends = plainRecord(record.endsSpells);
  if (ends && (ends.chosen !== undefined || ends.zones !== undefined)) return true;
  return featureValues(record).some((one) => carriesEndsChoice411(one, depth + 1));
}

/** A rest that puts a condition on, and a condition whose rule ends it on its holder's attack or
 *  cast (1.426): Tranquility. */
function carriesRestPuts410(ruleset: unknown): boolean {
  const root = plainRecord(ruleset);
  const rests = root?.rests;
  if (Array.isArray(rests) && rests.some((rest) => plainRecord(rest)?.puts !== undefined)) return true;
  const conditions = plainRecord(root?.combat)?.conditions;
  return (
    Array.isArray(conditions) &&
    conditions.some((rule) => {
      const ends = plainRecord(plainRecord(rule)?.endsWhenHolder);
      return !!ends && (ends.attacks !== undefined || ends.casts !== undefined || ends.castsAtFoes !== undefined);
    })
  );
}

/** A cast that ends its caster's condition only when it reaches a foe, and a sanctuary that stops only
 *  some things (1.425): Sanctuary, Nature's Sanctuary. */
function carriesFoeCasts409(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFoeCasts409(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.endsWhenHolder)?.castsAtFoes !== undefined) return true;
  if (plainRecord(plainRecord(record.sanctuary)?.against)) return true;
  return featureValues(record).some((one) => carriesFoeCasts409(one, depth + 1));
}

function carriesEndsSpells408(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEndsSpells408(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.endsSpells)) return true;
  return featureValues(record).some((one) => carriesEndsSpells408(one, depth + 1));
}

/** A sanctuary on a condition (1.423): Sanctuary, Tranquility, Nature's Sanctuary. */
function carriesSanctuary407(ruleset: unknown): boolean {
  const conditions = plainRecord(plainRecord(ruleset)?.combat)?.conditions;
  return Array.isArray(conditions) && conditions.some((one) => plainRecord(plainRecord(one)?.sanctuary));
}

/** An attack that is over as a moment, a source test, a holder's own strike as an answer, and a
 *  missed attack sent elsewhere (1.422): Retaliation, Giant Killer, Stand Against the Tide. */
function carriesAttackedAnswer406(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAttackedAnswer406(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.on === "attacked" || record.missed === true || plainRecord(record.sourceIs)) return true;
  if (record.strikesWith !== undefined || record.redirects === true) return true;
  return featureValues(record).some((one) => carriesAttackedAnswer406(one, depth + 1));
}

/** Healing an amend adds to each it heals, or to its user when it heals somebody else (1.421):
 *  Disciple of Life, Blessed Healer. */
function carriesHealAmend405(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealAmend405(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    Array.isArray(record.amends) &&
    record.amends.some(
      (amend) => plainRecord(plainRecord(amend)?.healAdd) || plainRecord(plainRecord(amend)?.healsSelf),
    )
  )
    return true;
  return featureValues(record).some((one) => carriesHealAmend405(one, depth + 1));
}

/** A catalog entry's long range, and a caught missile thrown back with a die off the sheet (1.420):
 *  Deflect Missiles' throw back as a monk weapon. */
function carriesLongThrow404(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLongThrow404(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.longRange === "number" || plainRecord(record.throwsCaught)) return true;
  return featureValues(record).some((one) => carriesLongThrow404(one, depth + 1));
}

/** More than 20 combat levels (1.419 raised the cap to 40). */
function carriesManyLevels403(ruleset: unknown): boolean {
  const levels = plainRecord(plainRecord(ruleset)?.combat)?.levels;
  return Array.isArray(levels) && levels.length > 20;
}

/** A floor under its holder's checks (1.418): Reliable Talent, Indomitable Might. */
function carriesCheckFloor402(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCheckFloor402(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.checkFloor)) return true;
  return featureValues(record).some((one) => carriesCheckFloor402(one, depth + 1));
}

/** Held off while its holder has something (notWhile), save effects only against what is seen
 *  (whenSeen), and attacks against its holder never with advantage (1.417): Danger Sense, Elusive. */
function carriesUnseenGuard401(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUnseenGuard401(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.notWhile) || record.whenSeen === true) return true;
  if (Array.isArray(record.effects) && record.effects.includes("attacks-against-no-advantage")) return true;
  return featureValues(record).some((one) => carriesUnseenGuard401(one, depth + 1));
}

/** A missile caught and thrown back, and a reaction needing a free slot (1.416): Deflect Missiles. */
function carriesCaught400(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCaught400(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.on === "caught" || record.throwsCaught === true || typeof record.freeSlot === "string") return true;
  return featureValues(record).some((one) => carriesCaught400(one, depth + 1));
}

/** Damage or healing at its most, and an alteration's backlash (1.415): Overchannel, Supreme
 *  Healing. */
function carriesMaximized399(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMaximized399(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.maxHeal === true || plainRecord(record.maximizes) || plainRecord(record.backlash)) return true;
  return featureValues(record).some((one) => carriesMaximized399(one, depth + 1));
}

/** Amends and alterations by a catalog's filter, one roll's damage, half on a save, spared whole or
 *  by level (1.414): the evocation wizard's features. */
function carriesEvocation398(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEvocation398(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sparesWhole === true || record.sparesByLevel === true || record.halfOnSave === true) return true;
  if (record.damageOnce !== undefined) return true;
  if (Array.isArray(record.catalogs) && plainRecord(record.where)) return true;
  if (Array.isArray(record.amends) && record.amends.some((one) => Array.isArray(plainRecord(one)?.catalogs)))
    return true;
  return featureValues(record).some((one) => carriesEvocation398(one, depth + 1));
}

/** A damage modifier adding a value off the sheet, or lessening a fall (1.413): Deflect Missiles and
 *  Slow Fall. */
function carriesLessenedHarm397(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLessenedHarm397(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if ((record.to === "damage" || record.to === "damage-taken") && (record.add !== undefined || record.falls === true))
    return true;
  return featureValues(record).some((one) => carriesLessenedHarm397(one, depth + 1));
}

/** Temporary points as a foe drops (1.412): a condition's or a level's `fellsGrant`. */
function carriesFellsGrant396(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFellsGrant396(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.fellsGrant)) return true;
  return featureValues(record).some((one) => carriesFellsGrant396(one, depth + 1));
}

/** A text column by steps, or a pool refilled at initiative (1.411): Font and Superior Inspiration. */
function carriesInspiration395(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInspiration395(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.refillsAtInitiative)) return true;
  if (Array.isArray(record.texts) && record.from !== undefined) return true;
  return featureValues(record).some((one) => carriesInspiration395(one, depth + 1));
}

/** Pools a use gives back, picked within a budget (1.410): Arcane Recovery's `recovers`. */
function carriesRecovers394(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRecovers394(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.recovers)) return true;
  return featureValues(record).some((one) => carriesRecovers394(one, depth + 1));
}

/** Harm copied to a condition's source (1.409): Warding Bond. */
function carriesCopiedHarm393(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCopiedHarm393(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.copiesHarmToSource !== undefined) return true;
  return featureValues(record).some((one) => carriesCopiedHarm393(one, depth + 1));
}

/** A face rolled again (1.408): a condition's or a level's `rerollsFace`. */
function carriesRerollsFace392(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRerollsFace392(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.rerollsFace !== undefined) return true;
  return featureValues(record).some((one) => carriesRerollsFace392(one, depth + 1));
}

/** Swallow follow-ups (1.407): what a condition put on asks the target to hold, ends on them, or does
 *  to whoever pulls them out; a contest that pulls somebody out; and a condition taking a share of
 *  its source's harm. */
function carriesPullOut391(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPullOut391(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.pulls === true || (typeof record.condition === "string" && record.takesSourceHarm !== undefined))
    return true;
  if (
    typeof record.condition === "string" &&
    record.duration !== undefined &&
    (record.targetHolds !== undefined || record.endsOnTarget !== undefined || record.harmsPuller !== undefined)
  )
    return true;
  return featureValues(record).some((one) => carriesPullOut391(one, depth + 1));
}

/** A floor under defense (1.406): a modifier to defense with `atLeast`. */
function carriesDefenseFloor390(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDefenseFloor390(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.to === "defense" && record.atLeast !== undefined) return true;
  return featureValues(record).some((one) => carriesDefenseFloor390(one, depth + 1));
}

/** Swallowing (1.405): a condition's `inside` with room, a let-out on blows or climbing out of a
 *  corpse; an engulf's room; and a creature action aimed by type or with an `allHit`. */
function carriesSwallow389(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSwallow389(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // A zone's `inside` is an object of its own, of other keys.
  const inside = plainRecord(record.inside);
  if (
    inside &&
    (typeof record.condition === "string" ||
      inside.room !== undefined ||
      inside.releasedWhen !== undefined ||
      inside.corpse !== undefined)
  )
    return true;
  if (plainRecord(record.engulf)?.room !== undefined) return true;
  const creature = plainRecord(record.creature);
  if (
    Array.isArray(creature?.actions) &&
    creature.actions.some(
      (one) => plainRecord(one)?.targetTypes !== undefined || plainRecord(one)?.allHit !== undefined,
    )
  )
    return true;
  return featureValues(record).some((one) => carriesSwallow389(one, depth + 1));
}

/** Hanging on off a list row's pool or only while holding a condition, and a shape's better-of
 *  saves and checks (1.404). `pools` are the sheet's declared pool ids. */
function carriesHangsOnRows388(value: unknown, pools: ReadonlySet<string>, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHangsOnRows388(one, pools, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const hangs = plainRecord(record.hangsOn);
  if (hangs) {
    if (hangs.whileHolding !== undefined) return true;
    if (typeof hangs.spends === "string" && !pools.has(hangs.spends)) return true;
    const tally = plainRecord(hangs.save)?.tally;
    if (typeof tally === "string" && !pools.has(tally)) return true;
  }
  if (plainRecord(record.shape)?.betterOf !== undefined) return true;
  return featureValues(record).some((one) => carriesHangsOnRows388(one, pools, depth + 1));
}

/** Engulfing, being inside, harms on its source's turns or spared by a save, and sized target
 *  tests (1.403). */
function carriesEngulf387(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesEngulf387(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // A zone's `inside` is an object of its own: a condition's is `true`.
  if (plainRecord(record.engulf) || record.inside === true) return true;
  if (record.upToSize !== undefined || record.atLeastSize !== undefined) return true;
  const harms = plainRecord(record.harms);
  if (harms && (harms.save !== undefined || (typeof harms.at === "string" && harms.at.startsWith("source-"))))
    return true;
  return featureValues(record).some((one) => carriesEngulf387(one, depth + 1));
}

/** Calls read from a catalog, capped or scaled by cost, and attack modes on melee alone (1.402). */
function carriesCalls386(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCalls386(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const calls = plainRecord(record.calls);
  if (calls) {
    if (plainRecord(calls.from) || calls.timesPerSteps !== undefined) return true;
    if (Array.isArray(calls.options) && calls.options.some((one) => plainRecord(plainRecord(one)?.from))) return true;
  }
  if (Array.isArray(record.attackModes) && record.attackModes.some((one) => plainRecord(one)?.melee !== undefined))
    return true;
  const creature = plainRecord(record.creature);
  if (creature && carriesCalls386(creature, depth + 1)) return true;
  return featureValues(record).some((one) => carriesCalls386(one, depth + 1));
}

/** Shape forms read from a catalog (1.401). */
function carriesShapeCatalogs(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShapeCatalogs(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(plainRecord(record.forms)?.from)) return true;
  const creature = plainRecord(record.creature);
  if (Array.isArray(creature?.actions) && creature.actions.some((one) => carriesShapeCatalogs(one, depth + 1)))
    return true;
  return featureValues(record).some((one) => carriesShapeCatalogs(one, depth + 1));
}

/** A shape change (1.392): an entry or a creature's action offering `forms`, or a condition with a `shape`. */
function carriesShapes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShapes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const forms = plainRecord(record.forms);
  if (Array.isArray(forms?.into) || plainRecord(forms?.from)) return true;
  if (typeof record.condition === "string" && plainRecord(record.shape)) return true;
  const creature = plainRecord(record.creature);
  if (Array.isArray(creature?.actions) && creature.actions.some((one) => carriesShapes(one, depth + 1))) return true;
  return featureValues(record).some((one) => carriesShapes(one, depth + 1));
}

/** A creature's action that calls creatures into the fight (1.325). */
function carriesCalls(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCalls(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const creature = plainRecord(record.creature);
  if (Array.isArray(creature?.actions) && creature.actions.some((one) => plainRecord(one)?.calls !== undefined))
    return true;
  return featureValues(record).some((one) => carriesCalls(one, depth + 1));
}

/** A creature's action that names upgraded to-hit dice, for a `symbol-pool` fight (1.382). */
function carriesSymbolUpgrades(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSymbolUpgrades(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const creature = plainRecord(record.creature);
  if (Array.isArray(creature?.actions) && creature.actions.some((one) => plainRecord(one)?.upgrades !== undefined))
    return true;
  return featureValues(record).some((one) => carriesSymbolUpgrades(one, depth + 1));
}

/** Whether `combat` or `battle` health names a sheet track with neither levels nor boxes (1.383). */
function healthOnPlainTrack(ruleset: unknown): boolean {
  const record = plainRecord(ruleset);
  const tracks = plainRecord(plainRecord(record?.sheet)?.live)?.tracks;
  if (!Array.isArray(tracks)) return false;
  return [record?.combat, record?.battle].some((block) => {
    const track = plainRecord(plainRecord(block)?.health)?.track;
    if (typeof track !== "string") return false;
    const declared = tracks.map(plainRecord).find((one) => one?.id === track);
    return !!declared && declared.levels === undefined && declared.boxes === undefined;
  });
}

/** A creature's action that leaves an area standing or changes the ground, or an area that lasts
 *  until the next lair action (1.324). */
function carriesCreatureZones(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureZones(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.untilLair !== undefined) return true;
  const creature = plainRecord(record.creature);
  if (
    Array.isArray(creature?.actions) &&
    creature.actions.some((one) => {
      const action = plainRecord(one);
      return action?.zone !== undefined || action?.ground !== undefined;
    })
  )
    return true;
  return featureValues(record).some((one) => carriesCreatureZones(one, depth + 1));
}

/** A blow that reaps what it fells on Held Ground (1.323): the Reaping Hook. */
function carriesReaps(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReaps(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.reaps !== undefined) return true;
  return featureValues(record).some((one) => carriesReaps(one, depth + 1));
}

/** An item's use taken as a reaction (1.322): Liesl's Coffin, the Straw Proxy. */
function carriesItemReactions(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemReactions(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // A use's, or one of its `moreUses`' as the walk reaches each.
  const reaction = plainRecord(record.use)?.reaction;
  if (reaction !== undefined && reaction !== false) return true;
  return featureValues(record).some((one) => carriesItemReactions(one, depth + 1));
}

/** A light that sheds shade, something that gives the unseen away, or a creature light holds still
 *  (1.319). */
function carriesShadeOrAlerts(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShadeOrAlerts(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.shade !== undefined || record.alerts !== undefined || record.stillIn !== undefined) return true;
  return featureValues(record).some((one) => carriesShadeOrAlerts(one, depth + 1));
}

/** An entry or an item's use that clears growth (1.318). */
function carriesClears(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesClears(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.clears !== undefined) return true;
  return featureValues(record).some((one) => carriesClears(one, depth + 1));
}

/** A creature's legendary resistances, and an item's use no bigger than it reaches (1.317). */
function carriesLegendaryResistance(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLegendaryResistance(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.legendaryResistance !== undefined) return true;
  // An item's use no bigger than it reaches (1.317); an entry's own came with 1.314.
  const use = plainRecord(record.use);
  if (use?.targetsUpTo !== undefined) return true;
  if (Array.isArray(record.moreUses) && record.moreUses.some((one) => plainRecord(one)?.targetsUpTo !== undefined))
    return true;
  return featureValues(record).some((one) => carriesLegendaryResistance(one, depth + 1));
}

/** Lair actions and a lair's count (1.315). */
function carriesLair(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLair(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.lair !== undefined || record.lairInitiative !== undefined) return true;
  return featureValues(record).some((one) => carriesLair(one, depth + 1));
}

/** A sphere that shuts its holder away, and an entry aimed only at creatures up to a size (1.314). */
function carriesSphere(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSphere(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sealed !== undefined || record.targetsUpTo !== undefined) return true;
  return featureValues(record).some((one) => carriesSphere(one, depth + 1));
}

/** Maze, Expeditious Retreat's Dash, a casting's choices made again, an ability add on top of sets,
 *  and a binding that needs other items worn (1.313). */
function carriesLeftovers308(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLeftovers308(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.checkEnds !== undefined || Array.isArray(record.takes)) return true;
  if (plainRecord(record.repeats)?.group !== undefined || plainRecord(record.dismisses)?.turns !== undefined)
    return true;
  if (plainRecord(record.binds)?.needsWorn !== undefined) return true;
  const abilities = plainRecord(record.abilities);
  if (
    abilities &&
    Object.values(abilities).some((change) => {
      const one = plainRecord(change);
      return !!one && one.add !== undefined && one.max !== undefined;
    })
  )
    return true;
  return featureValues(record).some((one) => carriesLeftovers308(one, depth + 1));
}

/** A weapon mode whose hit claps around the one it hit (1.312). */
function carriesThunderclap(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesThunderclap(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.modes) && record.modes.some((mode) => plainRecord(mode)?.aroundHit !== undefined))
    return true;
  return featureValues(record).some((one) => carriesThunderclap(one, depth + 1));
}

/** An item use that puts conditions on its reader, creature actions that slay the dying, and a
 *  condition's rule that ends it on moving or acting (1.311). */
function carriesLeftovers306(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLeftovers306(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.dyingOnly !== undefined || record.slaysOnFailedSave !== undefined || record.healsOnSlay !== undefined)
    return true;
  const selfOn = (use: unknown) => plainRecord(use)?.appliesSelf !== undefined;
  const item = plainRecord(record.item);
  if (
    item &&
    (selfOn(item.use) || (Array.isArray(item.moreUses) && item.moreUses.some((more) => selfOn(plainRecord(more)?.use))))
  )
    return true;
  const conditions = plainRecord(record.combat)?.conditions;
  if (Array.isArray(conditions) && conditions.some((rule) => plainRecord(rule)?.endsWhenHolder !== undefined))
    return true;
  return featureValues(record).some((one) => carriesLeftovers306(one, depth + 1));
}

/** A concentration entry's effect made again, and a condition ended by distance from its putter
 *  (1.310). */
function carriesRepeats(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRepeats(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.repeats)?.budget !== undefined || !!plainRecord(record.endsAway)) return true;
  return featureValues(record).some((one) => carriesRepeats(one, depth + 1));
}

/** Hide in Plain Sight's needs, Feral Senses, surprise from a hidden start, and a weapon bound out
 *  of the fight (1.309). */
function carriesHidingNeeds(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHidingNeeds(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const hiding = plainRecord(record.hiding);
  if (
    hiding &&
    (hiding.stillWhile !== undefined || hiding.unseenStrikes !== undefined || hiding.surprises !== undefined)
  )
    return true;
  if (plainRecord(record.conjures)?.boundIn !== undefined) return true;
  return featureValues(record).some((one) => carriesHidingNeeds(one, depth + 1));
}

/** An item's use whose targets grow with the sheet, or that takes the same target again (1.308). */
function carriesItemBeams(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemBeams(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const beams = (use: unknown) => {
    const one = plainRecord(use);
    return !!one && (one.targetsScale !== undefined || one.targetsRepeat !== undefined);
  };
  const item = plainRecord(record.item);
  if (
    item &&
    (beams(item.use) || (Array.isArray(item.moreUses) && item.moreUses.some((more) => beams(plainRecord(more)?.use))))
  )
    return true;
  return featureValues(record).some((one) => carriesItemBeams(one, depth + 1));
}

/** A creature's own action held by its concentration, ends on using a named action, and what a use
 *  puts on its own user (1.307). */
function carriesSelfHeld(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSelfHeld(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.appliesSelf !== undefined) return true;
  if (plainRecord(record.endsWhenHolder)?.uses !== undefined) return true;
  // A creature's action is named and budgeted; a catalog entry's concentration sits in its mechanics.
  if (record.concentration !== undefined && typeof record.name === "string" && typeof record.budget === "string")
    return true;
  return featureValues(record).some((one) => carriesSelfHeld(one, depth + 1));
}

/** Weapons put in hand, and amends that add typed damage or strikes (1.306). */
function carriesConjures(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConjures(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.conjures !== undefined) return true;
  const amends = Array.isArray(record.amends) ? record.amends : [];
  if (amends.some((one) => plainRecord(one)?.damagePlus !== undefined || plainRecord(one)?.strikes !== undefined))
    return true;
  return featureValues(record).some((one) => carriesConjures(one, depth + 1));
}

/** Targets that grow with the sheet, and the same target more than once (1.305). */
function carriesBeams(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBeams(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.targetsScale !== undefined || record.targetsRepeat !== undefined) return true;
  return featureValues(record).some((one) => carriesBeams(one, depth + 1));
}

/** Uses once a creature until a rest (1.304). */
function carriesOncePerTarget(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOncePerTarget(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.oncePerTarget !== undefined) return true;
  return featureValues(record).some((one) => carriesOncePerTarget(one, depth + 1));
}

/** Uses only in some light, and conditions that moving or acting ends (1.303). */
function carriesShadowUses(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesShadowUses(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usableIn !== undefined) return true;
  const ends = plainRecord(record.endsWhenHolder);
  if (ends && (ends.moves !== undefined || ends.acts !== undefined)) return true;
  return featureValues(record).some((one) => carriesShadowUses(one, depth + 1));
}

/** Entries that change another of their holder's each time it is used (1.302). */
function carriesAmends(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAmends(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.amends !== undefined) return true;
  return featureValues(record).some((one) => carriesAmends(one, depth + 1));
}

/** Zones carried with somebody, and copies set down apart (1.301). */
function carriesHeldZones(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldZones(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.carried === "own" || record.carried === "any" || record.copiesWithin !== undefined) return true;
  return featureValues(record).some((one) => carriesHeldZones(one, depth + 1));
}

/** What a higher cost adds only every so many steps, and on what a condition gives (1.300). */
function carriesStepsEvery(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStepsEvery(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.perCostStepsEvery !== undefined) return true;
  return featureValues(record).some((one) => carriesStepsEvery(one, depth + 1));
}

/** Darkness that puts out spell light, magical light, and Daylight's dispelling reach (1.299). */
function carriesDarkAgainstLight(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDarkAgainstLight(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.dispelsLight !== undefined || record.magical !== undefined) return true;
  if (plainRecord(record.dispelsDark)?.within !== undefined) return true;
  return featureValues(record).some((one) => carriesDarkAgainstLight(one, depth + 1));
}

/** A creature's light out under a condition, and light that is sunlight (1.298). */
function carriesSunAndHiddenLight(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSunAndHiddenLight(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.lightOutWhile !== undefined || record.sunlight !== undefined) return true;
  return featureValues(record).some((one) => carriesSunAndHiddenLight(one, depth + 1));
}

/** Zones that shed light or end magical darkness, and light that shows the invisible (1.297). */
function carriesLightZones(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLightZones(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.lights !== undefined || record.dispelsDark !== undefined || record.reveals !== undefined) return true;
  if (plainRecord(record.obscures)?.darkness !== undefined) return true;
  return featureValues(record).some((one) => carriesLightZones(one, depth + 1));
}

/** Lights switched by a creature's own actions, or dim while an item is off (1.296). */
function carriesLightActions(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLightActions(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sheds !== undefined || record.unlit !== undefined || record.offLight !== undefined) return true;
  return featureValues(record).some((one) => carriesLightActions(one, depth + 1));
}

/** A carried light with a name or a price to put out and light again (1.295). */
function carriesLightSwitch(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLightSwitch(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const carried = plainRecord(plainRecord(record.darkness)?.carried);
  if (carried && (carried.label !== undefined || carried.budget !== undefined)) return true;
  return featureValues(record).some((one) => carriesLightSwitch(one, depth + 1));
}

/** The dark kept real, and light shed in it (1.294): `sight.darkness`, a `light` with its reach. */
function carriesDarkness(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDarkness(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.darkness)) return true;
  const light = plainRecord(record.light);
  if (light && (light.bright !== undefined || light.dim !== undefined)) return true;
  return featureValues(record).some((one) => carriesDarkness(one, depth + 1));
}

/** A creature's own modes on attacks (1.293). */
function carriesAttackModes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAttackModes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.attackModes !== undefined) return true;
  return featureValues(record).some((one) => carriesAttackModes(one, depth + 1));
}

/** A creature's own ways of hiding and looking (1.291): modes on its checks, a printed passive,
 *  standard actions with its own budget. */
function carriesCreatureSeeking(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureSeeking(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.checkModes !== undefined) return true;
  // A creature's printed passive; the fight's own `hiding.passive` names the checks beside it.
  if (record.passive !== undefined && record.stealth === undefined && record.perception === undefined) return true;
  // A creature action's permission; a catalog entry's names its budget inside it.
  const standard = plainRecord(record.standard);
  if (standard && standard.budget === undefined) return true;
  return featureValues(record).some((one) => carriesCreatureSeeking(one, depth + 1));
}

/** Looking for the hidden, weighed (1.290): a passive's `passiveMode`, a change to checks to find
 *  somebody. */
function carriesSeekingModes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSeekingModes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.to === "checks-taken" || plainRecord(record.hiding)?.passiveMode !== undefined) return true;
  return featureValues(record).some((one) => carriesSeekingModes(one, depth + 1));
}

/** A fog a wind disperses only after a while (1.289): `dispersed: { after }`. */
function carriesSlowDispersal(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSlowDispersal(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const key of ["obscures", "smoke"]) {
    if (plainRecord(plainRecord(record[key])?.dispersed)) return true;
  }
  return featureValues(record).some((one) => carriesSlowDispersal(one, depth + 1));
}

/** Readying for real (1.288): the fight's `readying`. */
function carriesReadying(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReadying(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.readying)) return true;
  return featureValues(record).some((one) => carriesReadying(one, depth + 1));
}

/** Hiding for real (1.287): the fight's `hiding`, the Search standard action, a creature's Detect. */
function carriesHiding(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHiding(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.hiding) || record.search === true) return true;
  for (const key of ["standard", "actions"]) {
    const list = record[key];
    if (Array.isArray(list) && list.includes("search")) return true;
  }
  return featureValues(record).some((one) => carriesHiding(one, depth + 1));
}

/** A fog only lightly obscuring, or one a strong wind blows away, or that wind (1.286): a Cape of the
 *  Mountebank's thin smoke, a Fog Cloud, a Gust of Wind. */
function carriesLightOrWind(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLightOrWind(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.disperses === true) return true;
  for (const key of ["obscures", "smoke"]) {
    const fog = plainRecord(record[key]);
    if (fog && (fog.light !== undefined || fog.dispersed !== undefined)) return true;
  }
  return featureValues(record).some((one) => carriesLightOrWind(one, depth + 1));
}

/** A legendary move that follows what its action does, or on one named speed (1.285): a dragon's Wing
 *  Attack, then its flight. */
function carriesMoveAfter(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMoveAfter(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const move = plainRecord(record.move);
  if (
    move &&
    move.budget === undefined &&
    (move.speed !== undefined ||
      ["damage", "heal", "applies", "area", "save", "ends", "push", "toHit", "autoHit"].some(
        (key) => record[key] !== undefined,
      ))
  ) {
    return true;
  }
  return featureValues(record).some((one) => carriesMoveAfter(one, depth + 1));
}

/** A spell cast with points between turns (1.284): a sphinx's Cast a Spell, a lich's Cantrip. */
function carriesLegendaryCast(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLegendaryCast(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // Always with its signature: a builder's `casting` column stamp is not one.
  if (plainRecord(record.casting) && plainRecord(record.signature)) return true;
  return featureValues(record).some((one) => carriesLegendaryCast(one, depth + 1));
}

/** A legendary move (1.283): a tarrasque's Move, a mummy lord's Whirlwind of Sand. A lasting area's
 *  own `move` always names its budget, so it is not one. */
function carriesLegendaryMove(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLegendaryMove(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const move = plainRecord(record.move);
  if (move && move.budget === undefined) return true;
  return featureValues(record).some((one) => carriesLegendaryMove(one, depth + 1));
}

/** A burst centred on its user, through walls or not (1.282): Channel Negative Energy. */
function carriesAround(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAround(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const area = plainRecord(record.area);
  if (area && (area.around !== undefined || area.throughWalls !== undefined)) return true;
  return featureValues(record).some((one) => carriesAround(one, depth + 1));
}

/** A blow whose maker regains what it dealt (1.281): Psychic Drain, Vampiric Touch. */
function carriesDrain(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDrain(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.drain)) return true;
  return featureValues(record).some((one) => carriesDrain(one, depth + 1));
}

/** A teleport that strikes before or after it (1.280): a blink dog's bite. */
function carriesTeleportStrike(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTeleportStrike(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.teleport)?.strike !== undefined) return true;
  return featureValues(record).some((one) => carriesTeleportStrike(one, depth + 1));
}

/** A teleport that leaves the fight, takes along only those its user sees, or leaves smoke (1.279). */
function carriesTeleportExtras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTeleportExtras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const teleport = plainRecord(record.teleport);
  if (teleport && (teleport.leaves !== undefined || teleport.carriesSeen !== undefined || teleport.smoke !== undefined))
    return true;
  return featureValues(record).some((one) => carriesTeleportExtras(one, depth + 1));
}

/** What Calm Emotions needs (1.278): a save its user's side may fail, indifference to a whole side,
 *  and endings on being attacked, harmed by what a catalog casts, or a friend harmed in sight. */
function carriesCalm(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCalm(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.alliesMayFail === true || record.endsWhenHarmedFrom !== undefined) return true;
  if (Array.isArray(record.effects) && record.effects.includes("cannot-target-source-side")) return true;
  if (
    Array.isArray(record.endsWhen) &&
    record.endsWhen.some((one) => one === "attacked" || one === "ally-harmed-in-sight")
  )
    return true;
  return featureValues(record).some((one) => carriesCalm(one, depth + 1));
}

/** More than four conditions put on by one entry, item use or creature action (1.277). */
function carriesManyApplies(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesManyApplies(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.applies) && record.applies.length > 4) return true;
  return featureValues(record).some((one) => carriesManyApplies(one, depth + 1));
}

/** A teleport (1.276), on a catalog entry, an item's use or a creature's action. */
function carriesTeleports(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTeleports(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const teleport = plainRecord(record.teleport);
  if (teleport && typeof teleport.distance === "number") return true;
  return featureValues(record).some((one) => carriesTeleports(one, depth + 1));
}

/** A condition held off rather than ended (1.275): near its source as well as in sight, or held off
 *  by another condition. */
function carriesHeldOff(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHeldOff(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && (record.orSourceWithin !== undefined || record.suppresses !== undefined))
    return true;
  return featureValues(record).some((one) => carriesHeldOff(one, depth + 1));
}

/** What 1.274 reads off whoever put a condition on, and what Sympathy and a scroll's chosen kind
 *  need, in catalogs too: a value an applied condition is put on with, temporary points a condition
 *  gives each turn, an aura save against the applier's difficulty, a save on harm from the source,
 *  a walk kept within reach, and a kind named as an item is used. */
function carriesSourceNumbers(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSourceNumbers(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.duration !== undefined && record.value !== undefined) return true;
  if (plainRecord(record.temporary)?.at !== undefined) return true;
  if (plainRecord(record.saveEnds)?.bySource !== undefined) return true;
  if (plainRecord(record.behavior)?.keepsIn !== undefined) return true;
  if (plainRecord(record.save)?.appliedDifficulty !== undefined) return true;
  if (plainRecord(record.use)?.kindChoice !== undefined) return true;
  return featureValues(record).some((one) => carriesSourceNumbers(one, depth + 1));
}

/** A weapon whose charges are spent on its hits (1.273), in catalogs too. */
function carriesChargedHits(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChargedHits(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.attack)?.spends !== undefined) return true;
  return featureValues(record).some((one) => carriesChargedHits(one, depth + 1));
}

/** A last charge's die that turns the item into another (1.272), in catalogs too. */
function carriesBecomes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBecomes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.breaksOn)?.becomes !== undefined) return true;
  return featureValues(record).some((one) => carriesBecomes(one, depth + 1));
}

/** An item's first use named, a use adding a value off its holder's sheet, more charges pushing
 *  farther, and a last charge's die that gives charges back or breaks nothing (1.271), in catalogs
 *  too. */
function carriesStaffExtras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStaffExtras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const uses = [
    record.use,
    ...(Array.isArray(record.moreUses) ? record.moreUses.map((more) => plainRecord(more)?.use) : []),
  ];
  if (uses.some((use) => plainRecord(use)?.amountAdd !== undefined || plainRecord(use)?.label !== undefined))
    return true;
  if (plainRecord(record.chargeStep)?.push !== undefined) return true;
  // A die with no `atMost` always has `regains`.
  if (plainRecord(record.breaksOn)?.regains !== undefined) return true;
  return featureValues(record).some((one) => carriesStaffExtras(one, depth + 1));
}

/** A creature type chosen as a catalog entry is used, auras reaching only that kind or whoever sees
 *  their holder, and a save ending a condition only from far enough away (1.270), in catalogs too. */
function carriesKindChoice(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesKindChoice(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.mechanics)?.kindChoice !== undefined) return true;
  if (typeof record.distance === "number" && typeof record.side === "string") {
    if (record.chosenKind !== undefined || record.orSeen !== undefined) return true;
  }
  if (plainRecord(record.saveEnds)?.beyond !== undefined) return true;
  return Object.values(record).some((one) => carriesKindChoice(one, depth + 1));
}

/** More than 160 conditions, an aura save that keeps its aura off once what it put on ends, and an
 *  item's use whose save difficulty is read off its holder's sheet or that spends more charges for
 *  more (1.269), in catalogs too. */
function carriesStaffUses(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesStaffUses(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.sheetDifficulty !== undefined || record.chargeStep !== undefined) return true;
  if (Array.isArray(record.conditions) && record.conditions.length > 160) return true;
  if (plainRecord(record.save)?.immuneWhenEnds !== undefined) return true;
  return Object.values(record).some((one) => carriesStaffUses(one, depth + 1));
}

/** Auras by what their target is or whoever put a condition on the holder, saves with a fail margin
 *  or averted eyes, and a save ending a condition leaning while its source is in sight (1.268). */
function carriesGazes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesGazes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.distance === "number" && typeof record.side === "string") {
    const save = plainRecord(record.save);
    if (record.targetTypes !== undefined || record.sourcesOf !== undefined) return true;
    if (save && (save.failedBy !== undefined || save.avert !== undefined)) return true;
  }
  if (plainRecord(record.saveEnds)?.seenLean !== undefined) return true;
  return Object.values(record).some((one) => carriesGazes(one, depth + 1));
}

/** Senses any one of which serves, targets kept near each other, an area that grows with its cost, more
 *  uses on an item, and what a stat block holds (1.267), in catalogs too. */
function carriesTargetingMore(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTargetingMore(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.needsAny !== undefined || typeof record.targetsWithin === "number") return true;
  if (record.sizePerCostStep !== undefined || Array.isArray(record.moreUses) || Array.isArray(record.held)) return true;
  return Object.values(record).some((one) => carriesTargetingMore(one, depth + 1));
}

/** A behavior that drops, keeps out or is freed when stuck; a save only out of sight; destroying by
 *  threat tier (1.266), in catalogs too. */
function carriesBehaviorMore(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBehaviorMore(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const behavior = plainRecord(record.behavior);
  if (
    typeof record.condition === "string" &&
    behavior &&
    (behavior.drops !== undefined || behavior.keepsOut !== undefined || behavior.onlyWhenStuck === "any")
  )
    return true;
  if (plainRecord(record.saveEnds)?.unseen !== undefined) return true;
  if (typeof record.condition === "string" && record.destroysUpTo !== undefined) return true;
  return Object.values(record).some((one) => carriesBehaviorMore(one, depth + 1));
}

/** An aura that needs senses, harms at its holder's turn or asks for a save, or a save change
 *  narrowed to what is cast from a catalog (1.265). */
function carriesAuraTurns(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAuraTurns(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    typeof record.distance === "number" &&
    typeof record.side === "string" &&
    (record.needs !== undefined || record.harms !== undefined || record.save !== undefined)
  )
    return true;
  if (plainRecord(record.against)?.casts !== undefined) return true;
  return Object.values(record).some((one) => carriesAuraTurns(one, depth + 1));
}

/** A condition's behavior (1.264), or a save its holder spends their action on. */
function carriesBehavior(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesBehavior(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && plainRecord(record.behavior)) return true;
  if (plainRecord(record.saveEnds)?.at === "action") return true;
  return Object.values(record).some((one) => carriesBehavior(one, depth + 1));
}

/** Auras on a combat condition, or conditions kept on through a fight by a catalog entry or a stat
 *  block (1.263). */
function carriesAuras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAuras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && Array.isArray(record.auras)) return true;
  if (Array.isArray(record.keepsOn)) return true;
  return Object.values(record).some((one) => carriesAuras(one, depth + 1));
}

/** Qualities on a stat block's action (1.262), in catalogs too: a name and a budget, where a
 *  catalog entry has a label. */
function carriesActionQualities(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesActionQualities(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.name === "string" && typeof record.budget === "string" && record.qualities !== undefined)
    return true;
  return Object.values(record).some((one) => carriesActionQualities(one, depth + 1));
}

/** What damage brings on, an onset that turns into another, a cure only some level ends, a
 *  restoredWhenCured rest loss, a heal block for nonmagical heals, or ends on a stat block's action
 *  (1.261), in catalogs too. */
function carriesDiseaseStages(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (typeof value === "string") return value === "cannot-heal-nonmagical";
  if (Array.isArray(value)) return value.some((one) => carriesDiseaseStages(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (
    typeof record.condition === "string" &&
    (record.onDamaged !== undefined || record.expires !== undefined || record.curedOnlyBy !== undefined)
  )
    return true;
  const onRest = plainRecord(record.onRest);
  if (onRest && onRest.restoredWhenCured !== undefined) return true;
  // A stat block's action: a name and a budget, where a catalog entry has a label.
  if (typeof record.name === "string" && typeof record.budget === "string" && record.ends !== undefined) return true;
  return Object.values(record).some((one) => carriesDiseaseStages(one, depth + 1));
}

/** A combat condition that grows worse on a rest (1.260), in catalogs too. */
function carriesConditionRests(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesConditionRests(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.onRest !== undefined) return true;
  return Object.values(record).some((one) => carriesConditionRests(one, depth + 1));
}

/** A rescue on an item's use (1.259), in catalogs too. */
function carriesItemRescues(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemRescues(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const use = plainRecord(record.use);
  if (use && use.rescue !== undefined) return true;
  return Object.values(record).some((one) => carriesItemRescues(one, depth + 1));
}

/** A combat condition's kinds, or a save that ends a condition counted to an end or to what it
 *  becomes (1.258), in catalogs too. */
function carriesDiseases(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDiseases(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  // A combat condition's: a wound track has kinds of its own, and no `condition`.
  if (typeof record.condition === "string" && record.kinds !== undefined) return true;
  const saveEnds = plainRecord(record.saveEnds);
  if (saveEnds && (saveEnds.successes !== undefined || saveEnds.failures !== undefined)) return true;
  return Object.values(record).some((one) => carriesDiseases(one, depth + 1));
}

/** Dice off an ability check or a damage roll, a rescue narrowed to some saves or spending a
 *  budget, or an item's use dealing half on a miss (1.257), in catalogs too. */
function carriesRollAnswers(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRollAnswers(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const use = plainRecord(record.use);
  if (use && use.halfOnMiss !== undefined) return true;
  const mechanics = plainRecord(record.mechanics);
  const lowers = mechanics && plainRecord(mechanics.lowersRoll);
  if (lowers && lowers.also !== undefined) return true;
  const rescue = mechanics && plainRecord(mechanics.rescue);
  if (rescue && (rescue.saves !== undefined || rescue.budget !== undefined)) return true;
  return Object.values(record).some((one) => carriesRollAnswers(one, depth + 1));
}

/** A d20 counted as a 20 or a die of the holder's own on a failed roll, an entry never on its own
 *  user, or conditions one of a kind at a time (1.256), in catalogs too. */
function carriesOwnRescues(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOwnRescues(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.oneAtATime !== undefined) return true;
  const mechanics = plainRecord(record.mechanics);
  if (mechanics && mechanics.notSelf !== undefined) return true;
  const rescue = mechanics && plainRecord(mechanics.rescue);
  if (rescue && (rescue.by === "twenty" || rescue.by === "die")) return true;
  return Object.values(record).some((one) => carriesOwnRescues(one, depth + 1));
}

/** A miss dealing half (1.255), or a condition put on harming more at a higher cost, in catalogs too. */
function carriesAcidArrow(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAcidArrow(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.harmsPerCostStep !== undefined) return true;
  const mechanics = plainRecord(record.mechanics);
  if (mechanics && mechanics.halfOnMiss !== undefined) return true;
  return Object.values(record).some((one) => carriesAcidArrow(one, depth + 1));
}

/** An entry giving back to a pool, past its maximum or not (1.252), in catalogs too. An item's
 *  `use.restore` is older and is not this. */
function carriesFontOfMagic(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesFontOfMagic(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.overMax !== undefined) return true;
  const mechanics = plainRecord(record.mechanics);
  if (mechanics && mechanics.restore !== undefined) return true;
  return Object.values(record).some((one) => carriesFontOfMagic(one, depth + 1));
}

/** A heal its user chooses how many uses of to spend (1.251), in catalogs too. */
function carriesUsesChosen(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUsesChosen(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usesChosen !== undefined) return true;
  return Object.values(record).some((one) => carriesUsesChosen(one, depth + 1));
}

/** Dice off somebody else's roll that hit, or saves evaded (1.250), in catalogs too. */
function carriesCuttingWords(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCuttingWords(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.lowersRoll !== undefined || record.evasion !== undefined) return true;
  return Object.values(record).some((one) => carriesCuttingWords(one, depth + 1));
}

/** A change held back until a roll falls short, or an entry spent on a failed roll (1.249), in
 *  catalogs too. */
function carriesRescue(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesRescue(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.rescue !== undefined) return true;
  return Object.values(record).some((one) => carriesRescue(one, depth + 1));
}

/** A hit answered only when a strike paid for from a budget made it, or one of a group of answers to
 *  its holder's own hit (1.248), in catalogs too. */
function carriesOpenHand(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOpenHand(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.oneOf !== undefined) return true;
  if (record.on === "hit" && record.budget !== undefined) return true;
  return Object.values(record).some((one) => carriesOpenHand(one, depth + 1));
}

/** A use offered only before its holder's first attack, a change to attacks narrowed to a kind of
 *  blow, or more dice on a critical (1.247), in catalogs too. */
function carriesReckless(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReckless(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.beforeAttack !== undefined || record.criticalDice !== undefined) return true;
  if (record.to === "attacks" && (record.attacks !== undefined || record.blow !== undefined)) return true;
  return Object.values(record).some((one) => carriesReckless(one, depth + 1));
}

/** What comes after the attack action, taken with held weapons matched by tags (1.246). */
function carriesAfterAttackItems(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAfterAttackItems(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const after = plainRecord(record.afterAttack);
  if (after && (after.items !== undefined || after.names === undefined)) return true;
  return Object.values(record).some((one) => carriesAfterAttackItems(one, depth + 1));
}

/** A use spending several uses or dropping a failed save to 0, a reaction to a hit by named attacks,
 *  or a condition harming as it ends (1.245), in catalogs too. */
function carriesQuiveringPalm(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesQuiveringPalm(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usesSpent !== undefined || record.dropsOnFailedSave !== undefined) return true;
  if (plainRecord(record.onEnd)?.harm !== undefined) return true;
  const reaction = plainRecord(record.reaction);
  if (reaction?.names !== undefined) return true;
  if (Array.isArray(reaction?.also) && reaction.also.some((one) => plainRecord(one)?.names !== undefined)) return true;
  return Object.values(record).some((one) => carriesQuiveringPalm(one, depth + 1));
}

/** An entry's attack rule matching held weapons or kept only while wielding some, or a granted strike
 *  kept within bounds (1.244), in catalogs too. */
function carriesWeaponMatch(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWeaponMatch(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const rules = Array.isArray(record.attackRows) ? record.attackRows.map((one) => plainRecord(one)) : [];
  if (
    rules.some((rule) => rule && (rule.items !== undefined || rule.wielding !== undefined || rule.names === undefined))
  )
    return true;
  const grant = plainRecord(record.grantsStrike);
  if (grant && (grant.when !== undefined || grant.wielding !== undefined)) return true;
  return Object.values(record).some((one) => carriesWeaponMatch(one, depth + 1));
}

function carriesMartialArts(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMartialArts(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.attackRows !== undefined || record.grantsStrike !== undefined || record.afterAttack !== undefined) {
    return true;
  }
  const grants = plainRecord(record.grants);
  if (grants && (grants.names !== undefined || grants.afterAttack !== undefined)) return true;
  return Object.values(record).some((one) => carriesMartialArts(one, depth + 1));
}

/** A reaction to its holder's own hit or to a weapon's, a use added to that blow, or a cap on the
 *  steps a higher cost adds (1.241), in catalogs too. */
function carriesOwnHit(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesOwnHit(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.addsToBlow !== undefined || record.perCostStepsMax !== undefined) return true;
  const reaction = plainRecord(record.reaction);
  const narrowed = (moment: Record<string, unknown> | undefined) =>
    !!moment && (moment.by !== undefined || moment.weapon !== undefined);
  if (narrowed(reaction)) return true;
  if (Array.isArray(reaction?.also) && reaction.also.some((one) => narrowed(plainRecord(one)))) return true;
  return Object.values(record).some((one) => carriesOwnHit(one, depth + 1));
}

/** A use that throws its holder's initiative twice (1.240), in catalogs too. */
function carriesInitiativeMode(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesInitiativeMode(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.initiativeMode !== undefined) return true;
  return Object.values(record).some((one) => carriesInitiativeMode(one, depth + 1));
}

/** A use that spends another row's uses (1.239), in catalogs too. */
function carriesUsesOf(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesUsesOf(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.usesOf !== undefined) return true;
  return Object.values(record).some((one) => carriesUsesOf(one, depth + 1));
}

/** A use that gives a second turn in a fight's first round (1.238), in catalogs too. */
function carriesExtraTurn(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesExtraTurn(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.extraFirstTurn !== undefined) return true;
  return Object.values(record).some((one) => carriesExtraTurn(one, depth + 1));
}

/** Never surprised, or surprise shaken off by a use (1.237), in catalogs too. */
function carriesSurprise(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSurprise(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.cannotBeSurprised !== undefined || record.ignoresSurpriseWith !== undefined) return true;
  return Object.values(record).some((one) => carriesSurprise(one, depth + 1));
}

/** A use that ends the condition it came from, a cure only of what some creatures put on, or one
 *  that sends somebody out of the fight (1.236), in catalogs too. */
function carriesDismissals(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDismissals(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.endsCondition !== undefined || record.dismisses !== undefined) return true;
  if (plainRecord(record.ends)?.from !== undefined) return true;
  return Object.values(record).some((one) => carriesDismissals(one, depth + 1));
}

/** Conditions that give their holder actions (1.236). */
function conditionsGiveActions(ruleset: unknown): boolean {
  const conditions = plainRecord(plainRecord(ruleset)?.combat)?.conditions;
  return Array.isArray(conditions) && conditions.some((one) => plainRecord(one)?.actions !== undefined);
}

/** A lowered maximum with no save of its own, on the entry's failed save, of one damage type or
 *  healing its maker; damage that leaves at least some health; targets limited by what they hold
 *  (1.235), in catalogs too. */
function carriesDrainsAndHolds(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDrainsAndHolds(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const reduces = plainRecord(record.reducesMax);
  if (
    reduces &&
    (reduces.save === undefined ||
      reduces.onFailedSave !== undefined ||
      reduces.damageType !== undefined ||
      reduces.heals !== undefined)
  )
    return true;
  if (record.leavesAtLeast !== undefined) return true;
  // A contest's targetHolds is a word; this one is an object.
  if (plainRecord(record.targetHolds)) return true;
  return Object.values(record).some((one) => carriesDrainsAndHolds(one, depth + 1));
}

/** A cure that does one of its cures (1.204), in catalogs too. */
function carriesCureOneOf(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCureOneOf(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.cureOneOf !== undefined) return true;
  return Object.values(record).some((one) => carriesCureOneOf(one, depth + 1));
}

/** A creature's blow that lowers the health maximum on a failed save (1.203), in catalogs too. */
function carriesReducesMax(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesReducesMax(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.reducesMax !== undefined) return true;
  return Object.values(record).some((one) => carriesReducesMax(one, depth + 1));
}

/** A condition put on to end with another one put on with it (1.202), in catalogs too. */
function carriesLinkedConditions(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesLinkedConditions(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string" && record.endsWith !== undefined) return true;
  return Object.values(record).some((one) => carriesLinkedConditions(one, depth + 1));
}

/** Tracks an entry moves by levels, health it gives back from sealed, or a broken section's own
 *  step (1.201), in catalogs too. A creature's `tracks` is a record, not a list of moves. */
function carriesTrackMoves(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTrackMoves(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.unseals !== undefined) return true;
  if (Array.isArray(record.tracks) && record.tracks.some((one) => plainRecord(one)?.by !== undefined)) return true;
  const sections = plainRecord(plainRecord(record.zone)?.sections);
  if (plainRecord(sections?.broken)?.perCostStep !== undefined) return true;
  return Object.values(record).some((one) => carriesTrackMoves(one, depth + 1));
}

/** A wall in sections that are struck and broken (1.200), in catalogs too. */
function carriesWallSections(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWallSections(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(record.zone);
  if (zone && zone.sections !== undefined) return true;
  return Object.values(record).some((one) => carriesWallSections(one, depth + 1));
}

/** An entry's health pool that passes over some of its targets (1.199), in catalogs too. */
function carriesHealthPoolSkips(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealthPoolSkips(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const mechanics = plainRecord(record.mechanics);
  if (mechanics && mechanics.healthPoolSkips !== undefined) return true;
  return Object.values(record).some((one) => carriesHealthPoolSkips(one, depth + 1));
}

/** A zone whose triggers deal another damage type than it does as it appears (1.198), in catalogs too. */
function carriesZoneDamageType(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneDamageType(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(record.zone);
  if (zone && zone.damageType !== undefined) return true;
  return Object.values(record).some((one) => carriesZoneDamageType(one, depth + 1));
}

/** A damage modifier that throws a blow's own dice more times over (1.197), wherever modifiers sit. */
function carriesDiceTimes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDiceTimes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.diceTimes !== undefined && typeof record.to === "string") return true;
  return Object.values(record).some((one) => carriesDiceTimes(one, depth + 1));
}

/** An entry whose mechanics share out a pool of health, stop at a health ceiling or kill outright
 *  (1.196), in catalog files too. */
function carriesHealthTargeting(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealthTargeting(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const mechanics = plainRecord(record.mechanics);
  if (
    mechanics &&
    (mechanics.healthPool !== undefined || mechanics.healthAtMost !== undefined || mechanics.kills !== undefined)
  ) {
    return true;
  }
  return Object.values(record).some((one) => carriesHealthTargeting(one, depth + 1));
}

/** A combat condition that makes its holder bigger or smaller (1.195). */
function carriesSizeChanges(value: unknown): boolean {
  const conditions = plainRecord(plainRecord(value)?.combat)?.conditions;
  return Array.isArray(conditions) && conditions.some((entry) => plainRecord(entry)?.size !== undefined);
}

/** Sizes that fill more than one cell on a board (1.194). */
function carriesFootprints(value: unknown): boolean {
  const combat = plainRecord(plainRecord(value)?.combat);
  const order = plainRecord(combat?.sizes)?.order;
  return Array.isArray(order) && order.some((size) => plainRecord(size)?.cells !== undefined);
}

/** A contest rolled against a fixed number, offered on allies, the wounded or the dying, or one that
 *  stabilizes, and a weapon whose damage only a rest restores (1.193), in catalog files too. */
function carriesTreatmentsAndSeals(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesTreatmentsAndSeals(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  if (attack?.healedOnlyByRest !== undefined) return true;
  if (plainRecord(record.harms)?.healedOnlyByRest !== undefined) return true;
  const contests = Array.isArray(record.contests) ? record.contests.map(plainRecord) : [];
  if (
    contests.some(
      (contest) =>
        !!contest &&
        (contest.difficulty !== undefined ||
          contest.targets !== undefined ||
          contest.targetHolds !== undefined ||
          contest.targetDying !== undefined ||
          plainRecord(contest.onWin)?.stabilizes !== undefined),
    )
  ) {
    return true;
  }
  return Object.values(record).some((one) => carriesTreatmentsAndSeals(one, depth + 1));
}

/** A weapon that ignores resistance, a slay that leaves conditions on a made save, or a weapon that
 *  hinders its wielder's others while a mark stands (1.192), in catalog files too. */
function carriesWeaponRiders(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWeaponRiders(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  if (attack) {
    if (attack.ignoresResistance !== undefined || attack.othersWhileMarked !== undefined) return true;
    const slay = Array.isArray(attack.slay) ? attack.slay.map(plainRecord) : [];
    if (slay.some((entry) => entry?.saved !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesWeaponRiders(one, depth + 1));
}

/** A condition that keeps heals off or keeps conditions off by who puts them on, a target floor on
 *  ability scores, or a save narrowed to named actions (1.191), in catalog files too. */
function carriesHealWardsAndActionSaves(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesHealWardsAndActionSaves(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.effects) && record.effects.includes("cannot-heal")) return true;
  if (record.conditionImmunitiesFrom !== undefined) return true;
  if (plainRecord(record.targetTypes)?.abilityAtLeast !== undefined) return true;
  if (record.to === "saves" && plainRecord(record.against)?.actions !== undefined) return true;
  return Object.values(record).some((one) => carriesHealWardsAndActionSaves(one, depth + 1));
}

/** A weapon mode with its own reach, clauses, bolt or charges (1.190), in catalog files too. */
function carriesModeExtras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesModeExtras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  const modes = attack && Array.isArray(attack.modes) ? attack.modes.map(plainRecord) : [];
  if (
    modes.some(
      (mode) =>
        mode &&
        (mode.range !== undefined || mode.plus !== undefined || mode.line !== undefined || mode.charges !== undefined),
    )
  )
    return true;
  return Object.values(record).some((one) => carriesModeExtras(one, depth + 1));
}

/** Conditions that harm each turn, stack or keep to one holder per source, weapons that mark a
 *  sworn enemy, and stat-block actions that name their ability (1.189), in catalog files too. */
function carriesMarksAndWounds(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMarksAndWounds(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.condition === "string") {
    if (record.harms !== undefined || record.stacks !== undefined || record.onePerSource !== undefined) return true;
  }
  const attack = plainRecord(record.attack);
  if (attack) {
    const against = Array.isArray(attack.against) ? attack.against.map(plainRecord) : [];
    if (
      against.some(
        (entry) =>
          entry &&
          (entry.marked !== undefined ||
            entry.mode !== undefined ||
            entry.ignoresCover !== undefined ||
            entry.ignoresLongRange !== undefined),
      )
    )
      return true;
    const plus = Array.isArray(attack.plus) ? attack.plus.map(plainRecord) : [];
    if (plus.some((clause) => clause && clause.marked !== undefined)) return true;
  }
  if (Array.isArray(record.actions) && (record.health !== undefined || record.defense !== undefined)) {
    if (record.actions.some((action) => plainRecord(action)?.ability !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesMarksAndWounds(one, depth + 1));
}

/** More than 80 conditions on the sheet, in a rest's list or in the fight, attacks narrowed by the
 *  ability they're made with, or checks narrowed by ability (1.188), in catalog files too. */
function carriesWideConditionsAndAbilityNarrowing(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWideConditionsAndAbilityNarrowing(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.conditions) && record.conditions.length > 80) return true;
  if (typeof record.to === "string" && MODIFIER_TARGETS.has(record.to)) {
    if (record.abilities !== undefined) return true;
    if (record.to === "attacks" && record.ability !== undefined) return true;
  }
  return Object.values(record).some((one) => carriesWideConditionsAndAbilityNarrowing(one, depth + 1));
}

/** A weapon that hits harder by what it hits, slays, drains, adds only when thrown, or wounds once a
 *  turn or only some targets (1.187), in catalog files too: an item's `attack` is where they live. */
function carriesWeaponKinds(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesWeaponKinds(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  if (attack) {
    if (attack.against !== undefined || attack.slay !== undefined) return true;
    const plus = Array.isArray(attack.plus) ? attack.plus.map(plainRecord) : [];
    if (
      plus.some(
        (clause) => clause && (clause.not !== undefined || clause.blow !== undefined || clause.tempHp !== undefined),
      )
    )
      return true;
    const onHit = Array.isArray(attack.onHit) ? attack.onHit.map(plainRecord) : [];
    if (onHit.some((entry) => entry && (entry.targetIs !== undefined || entry.oncePerTurn !== undefined))) return true;
  }
  return Object.values(record).some((one) => carriesWeaponKinds(one, depth + 1));
}

/** A creature's actions that recharge together, or that charge (1.186), in catalog files too. */
function carriesChargeAndGroups(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesChargeAndGroups(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.charge !== undefined || plainRecord(record.recharge)?.group !== undefined) return true;
  return Object.values(record).some((one) => carriesChargeAndGroups(one, depth + 1));
}

/** What a creature is, read further (1.185): saves rolled twice by it, damage at its most against it,
 *  targets by ability score or condition immunity, and changes to attacks that roll twice, from or
 *  at somebody, or saves against what a kind of creature does. In catalog files too. */
function carriesCreatureKinds(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureKinds(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.maxAgainst !== undefined || plainRecord(record.save)?.modes !== undefined) return true;
  const gates = plainRecord(record.targetTypes);
  if (gates && (gates.abilityAtMost !== undefined || gates.notImmuneTo !== undefined)) return true;
  // A condition's modifier: `to` one of the numbers a condition changes.
  if (typeof record.to === "string" && MODIFIER_TARGETS.has(record.to)) {
    if (record.to === "attacks-taken" || record.from !== undefined || record.atSource !== undefined) return true;
    if (record.to === "attacks" && record.mode !== undefined) return true;
    if (plainRecord(record.against)?.from !== undefined) return true;
  }
  return Object.values(record).some((one) => carriesCreatureKinds(one, depth + 1));
}

/** A creature's action that pushes, or an item's use whose line has a width, in catalog files too
 *  (1.184). */
function carriesCreaturePush(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreaturePush(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const creature = plainRecord(record.creature);
  const actions = Array.isArray(creature?.actions) ? creature.actions : [];
  if (actions.some((action) => plainRecord(action)?.push !== undefined)) return true;
  const area = plainRecord(plainRecord(record.use)?.area);
  if (area?.shape === "line" && area.width !== undefined) return true;
  return Object.values(record).some((one) => carriesCreaturePush(one, depth + 1));
}

/** A zone that goes off later or burns away, in catalog files too (1.183). */
function carriesDetonations(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesDetonations(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use)]) {
    const zone = plainRecord(mechanics?.zone);
    if (zone && (zone.detonates !== undefined || zone.burns !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesDetonations(one, depth + 1));
}

/** A sense given as a number added to the holder's own, a push, a line or cone its caster carries or
 *  turns, or hard going only toward a caster, in catalog files too (1.182). */
function carriesPushAndTurn(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesPushAndTurn(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const senses = plainRecord(record.senses);
  if (senses && Object.values(senses).some((one) => plainRecord(one) !== undefined)) return true;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use)]) {
    if (!mechanics) continue;
    if (mechanics.push !== undefined) return true;
    const zone = plainRecord(mechanics.zone);
    if (!zone) continue;
    if (zone.turn !== undefined || plainRecord(zone.terrain)?.towardCaster !== undefined) return true;
    const shape = plainRecord(mechanics.area)?.shape;
    if (zone.anchor === "caster" && (shape === "line" || shape === "cone")) return true;
  }
  return Object.values(record).some((one) => carriesPushAndTurn(one, depth + 1));
}

/** Senses and seeing (1.178): the combat block's senses or sight, a condition that hides, a zone
 *  that obscures, an area set down several times, "a creature you can see", or a creature's senses,
 *  in catalog files too. */
function carriesSight(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSight(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const combat = plainRecord(record.combat);
  if (combat && (combat.senses !== undefined || combat.sight !== undefined)) return true;
  if (record.condition !== undefined && record.unseen !== undefined) return true;
  // A creature's senses are a record of ranges, where the combat block's are a list.
  if (record.tier !== undefined && plainRecord(record.senses)) return true;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use), record]) {
    if (!mechanics) continue;
    if (plainRecord(mechanics.area)?.copies !== undefined) return true;
    if (plainRecord(mechanics.zone)?.obscures !== undefined) return true;
    if (mechanics.seen !== undefined && (mechanics.budget !== undefined || mechanics.kind !== undefined)) return true;
  }
  return Object.values(record).some((one) => carriesSight(one, depth + 1));
}

/** A catalog entry or item use that ends conditions, steadies the dying or brings back the dead, in
 *  catalog files too (1.176). */
function carriesCures(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCures(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  for (const mechanics of [plainRecord(record.mechanics), plainRecord(record.use)]) {
    if (!mechanics) continue;
    if (mechanics.ends !== undefined || mechanics.stabilizes !== undefined || mechanics.revives !== undefined) {
      return true;
    }
  }
  return Object.values(record).some((one) => carriesCures(one, depth + 1));
}

/** A zone moved to ram or hurting whom it holds, ground that costs several steps or halves speed, or
 *  a hold broken only by its escape DC and checks, in catalog files too (1.175). */
function carriesZoneGround(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneGround(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(plainRecord(record.mechanics)?.zone) ?? plainRecord(plainRecord(record.use)?.zone);
  const terrain = plainRecord(zone?.terrain);
  if (plainRecord(zone?.move)?.ram !== undefined || zone?.whileHeld !== undefined) return true;
  if (record.escapeChecks !== undefined || plainRecord(record.from)?.escapable !== undefined) return true;
  if (terrain && (terrain.costTimes !== undefined || terrain.halvesSpeed !== undefined)) return true;
  return Object.values(record).some((one) => carriesZoneGround(one, depth + 1));
}

/** An escape against the applier's save, a zone that breaks concentration or ends at a damage cap,
 *  or an item use that concentrates or leaves a zone, in catalog files too (1.174). */
function carriesZoneRules(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesZoneRules(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.escapeDc === "save") return true;
  const zone = plainRecord(plainRecord(record.mechanics)?.zone);
  if (zone && (zone.breaksConcentration !== undefined || zone.damageCap !== undefined)) return true;
  const use = plainRecord(record.use);
  if (use && typeof record.category === "string" && (use.zone !== undefined || use.concentration !== undefined)) {
    return true;
  }
  return Object.values(record).some((one) => carriesZoneRules(one, depth + 1));
}

/** A lasting area that moves, drifts, or makes its ground hard going, in catalog files too (1.173). */
function carriesMovingZones(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesMovingZones(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const zone = plainRecord(plainRecord(record.mechanics)?.zone);
  if (zone && (zone.move !== undefined || zone.drift !== undefined || zone.terrain !== undefined)) return true;
  return Object.values(record).some((one) => carriesMovingZones(one, depth + 1));
}

/** A live pool that pays for another group, or a catalog entry whose targets grow with its cost,
 *  in catalog files too (1.171). */
function carriesCostLadder(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCostLadder(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.mechanics)?.targetsPerCostStep !== undefined) return true;
  if (Array.isArray(record.pays) && record.max !== undefined) return true;
  return Object.values(record).some((one) => carriesCostLadder(one, depth + 1));
}

/** An item's switch, or a weapon clause dealt while it is on, in catalog files too (1.170). */
function carriesItemToggles(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemToggles(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (plainRecord(record.toggle) && typeof record.category === "string") return true;
  const plus = plainRecord(record.attack)?.plus;
  if (Array.isArray(plus) && plus.some((one) => plainRecord(one)?.when === "toggled")) return true;
  return Object.values(record).some((one) => carriesItemToggles(one, depth + 1));
}

/** A weapon item's extra damage, or a save on what its hit puts on, in catalog files too (1.169). */
function carriesItemAttackExtras(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesItemAttackExtras(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  const attack = plainRecord(record.attack);
  if (attack?.plus !== undefined) return true;
  if (
    Array.isArray(attack?.onHit) &&
    attack.onHit.some((one) => plainRecord(one)?.save !== undefined || plainRecord(one)?.saveEnds !== undefined)
  )
    return true;
  return Object.values(record).some((one) => carriesItemAttackExtras(one, depth + 1));
}

/** Creature types, a creature's type or tags, or a target test, in catalog files too (1.168). */
function carriesCreatureTypes(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesCreatureTypes(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (record.creatureTypes !== undefined || record.targetIs !== undefined || record.targetTypes !== undefined)
    return true;
  // A creature is the record with actions: its `type` is what it is, never a damage type.
  if (Array.isArray(record.actions) && (record.type !== undefined || record.tags !== undefined)) return true;
  return Object.values(record).some((one) => carriesCreatureTypes(one, depth + 1));
}

/** A condition an entry applies only while its applier's sheet allows, in catalog files too (1.167). */
function carriesAppliesWhen(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesAppliesWhen(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.applies) && record.applies.some((one) => plainRecord(one)?.when !== undefined)) return true;
  return Object.values(record).some((one) => carriesAppliesWhen(one, depth + 1));
}

/** Save modifiers narrowed by what is saved against, including item effects in catalog files (1.134). */
function carriesSaveAgainst(value: unknown, depth = 0): boolean {
  if (!value || depth > 40) return false;
  if (Array.isArray(value)) return value.some((one) => carriesSaveAgainst(one, depth + 1));
  const record = plainRecord(value);
  if (!record) return false;
  if (Array.isArray(record.modifiers) && record.modifiers.some((one) => plainRecord(one)?.against !== undefined))
    return true;
  return Object.values(record).some((one) => carriesSaveAgainst(one, depth + 1));
}

/** A save rolled only when its holder takes damage (1.129), wherever an `applies` is written. */
function carriesDamageOnlySaves(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesDamageOnlySaves(one, depth + 1));
  const record = value as Record<string, unknown>;
  if (plainRecord(record.saveEnds)?.at === "damaged") return true;
  return Object.values(record).some((one) => carriesDamageOnlySaves(one, depth + 1));
}

/** A condition's duration counted on its source's turns (1.119): `of`, a new key on the strict
 *  duration, wherever an `applies` is written. */
function carriesSourceClock(value: unknown, depth = 0): boolean {
  if (depth > 40 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((one) => carriesSourceClock(one, depth + 1));
  const record = value as Record<string, unknown>;
  if (plainRecord(record.duration)?.of !== undefined) return true;
  return Object.values(record).some((one) => carriesSourceClock(one, depth + 1));
}

/** Creatures immune to a track rather than a condition (1.115): 5e's immunity to exhaustion. */
function entriesImmuneToTracks(entries: unknown, tracks: ReadonlySet<string>): boolean {
  return (
    tracks.size > 0 &&
    Array.isArray(entries) &&
    entries.some((entry) => {
      const immunities = plainRecord(plainRecord(entry)?.creature)?.conditionImmunities;
      return Array.isArray(immunities) && immunities.some((one) => typeof one === "string" && tracks.has(one));
    })
  );
}

/** Entries a builder step offers only while the sheet says so (1.99): `offeredWhen`, a new key on the
 *  strict entry. */
function entriesCarryOfferedWhen(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => plainRecord(entry)?.offeredWhen !== undefined);
}

/** Entries a builder step keeps one of (1.94): `exclusive`, a new key on the strict entry. */
function entriesCarryExclusive(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((entry) => plainRecord(entry)?.exclusive !== undefined);
}

/** A skill or save choice that builds on training (1.105): `held`, a new key on the strict choice. */
function entriesCarryHeldChoices(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const choose = plainRecord(plainRecord(plainRecord(entry)?.grants)?.trained)?.choose;
      return Array.isArray(choose) && choose.some((choice) => plainRecord(choice)?.held !== undefined);
    })
  );
}

/** A score choice with a cap (1.96): `upTo`, a new key on the strict choice. */
function entriesCarryChoiceCaps(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const choose = plainRecord(plainRecord(plainRecord(entry)?.grants)?.abilities)?.choose;
      return Array.isArray(choose) && choose.some((choice) => plainRecord(choice)?.upTo !== undefined);
    })
  );
}

/** A score choice that may name one score twice (1.93): `repeat`, a new key on the strict choice. */
function entriesCarryRepeatChoices(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const choose = plainRecord(plainRecord(plainRecord(entry)?.grants)?.abilities)?.choose;
      return Array.isArray(choose) && choose.some((choice) => plainRecord(choice)?.repeat !== undefined);
    })
  );
}

/** Entries of another catalog to choose (1.91): `entries`, a new key on the strict grants. */
function entriesCarryEntryChoices(entries: unknown): boolean {
  return (
    Array.isArray(entries) && entries.some((entry) => plainRecord(plainRecord(entry)?.grants)?.entries !== undefined)
  );
}

/** A sheet value added to a catalog entry's amount (1.83): `amountAdd`, a new key on strict mechanics. */
function entriesCarryAmountAdd(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => plainRecord(plainRecord(entry)?.mechanics)?.amountAdd !== undefined)
  );
}

/** Seller honesty's item keys (1.79): `risky` and `passesFor`, new keys on the strict item. */
function entriesCarryHonesty(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return item?.risky !== undefined || item?.passesFor !== undefined;
    })
  );
}

/** Spotting fakes' item keys (1.802): `tells` and `foolsReveal`, new keys on the strict item. */
function entriesCarrySpotting(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return item?.tells !== undefined || item?.foolsReveal !== undefined;
    })
  );
}

const LOOT_ISSUE =
  "A ruleset with loot tables, or creatures that carry loot, requires schemaVersion 2 and capabilityApi 1.63 or newer";

/** A bestiary creature's `loot`, which is 1.63: a new key on the strict creature. */
function entriesCarryCreatureLoot(entries: unknown): boolean {
  return (
    Array.isArray(entries) && entries.some((entry) => plainRecord(plainRecord(entry)?.creature)?.loot !== undefined)
  );
}

/** A level that reads a derived value, which is 1.54: a new key on the strict level. */
function rulesetCarriesDerivedLevels154(ruleset: { combat?: unknown } | undefined): boolean {
  const levels = plainRecord(ruleset?.combat)?.levels;
  return Array.isArray(levels) && levels.some((level) => plainRecord(level)?.derived !== undefined);
}

/** What an item does while worn or carried, which is 1.53: new keys on the strict item. */
function entriesCarryItemEffects(entries: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.some((entry) => {
      const item = plainRecord(plainRecord(entry)?.item);
      return item?.worn !== undefined || item?.carried !== undefined;
    })
  );
}

/** The 1.53 keys in the ruleset file itself: `skills` on a condition or a level, `skills`, `saves` and
 *  `mode` on one of their modifiers, and a rarity cap's `bonus`. Ordinary words, so only those places
 *  are read. */
function rulesetCarriesCheckEffects153Keys(ruleset: { combat?: unknown; items?: unknown } | undefined): boolean {
  const combat = plainRecord(ruleset?.combat);
  const entries = [combat?.conditions, combat?.levels].flatMap((list) => (Array.isArray(list) ? list : []));
  const named = entries.some((raw) => {
    const entry = plainRecord(raw);
    if (!entry) return false;
    if (entry.skills !== undefined) return true;
    const modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
    return modifiers.some((one) => {
      const modifier = plainRecord(one);
      return modifier?.skills !== undefined || modifier?.saves !== undefined || modifier?.mode !== undefined;
    });
  });
  if (named) return true;
  const caps = plainRecord(ruleset?.items)?.rarityCaps;
  return Array.isArray(caps) && caps.some((cap) => plainRecord(cap)?.bonus !== undefined);
}

const MOVING_INITIATIVE_ISSUE =
  "A ruleset whose fights throw initiative as a pool or let attacks move it requires schemaVersion 2 and capabilityApi 1.48 or newer";

/** The 1.48 keys in the ruleset file itself: initiative thrown as a pool (`initiative.pool` and its
 *  `plus`) and initiative as a number attacks move (`initiative.resource`). */
function rulesetCarriesMovingInitiative148Keys(ruleset: { combat?: unknown } | undefined): boolean {
  const initiative = plainRecord(plainRecord(ruleset?.combat)?.initiative);
  return (
    !!initiative &&
    (initiative.pool !== undefined || initiative.plus !== undefined || initiative.resource !== undefined)
  );
}

const POOL_FIGHT_ISSUE =
  "A ruleset whose fights throw dice pools, soak, throw initiative every round or limit spending per turn requires schemaVersion 2 and capabilityApi 1.47 or newer";

/** The 1.47 keys in the ruleset file itself: the `dice-pool` kind and its `pool` block, an attack
 *  row's `toHit.skill`, `initiative.each` and `spendLimits`. */
function rulesetCarriesPoolFight147Keys(ruleset: { combat?: unknown } | undefined): boolean {
  const combat = plainRecord(ruleset?.combat);
  if (!combat) return false;
  if (combat.kind === "dice-pool" || combat.pool !== undefined || combat.spendLimits !== undefined) return true;
  if (plainRecord(combat.initiative)?.each !== undefined) return true;
  const attacks = Array.isArray(combat.attacks) ? combat.attacks : [];
  return attacks.some((source) => plainRecord(plainRecord(source)?.toHit)?.skill !== undefined);
}

/** A creature that soaks, which is 1.47: a new key on the strict creature. */
function entriesCarryCreatureSoak(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => plainRecord(plainRecord(entry)?.creature)?.soak !== undefined);
}

const HIT_MOMENTS_ISSUE =
  "A ruleset whose reactions answer being hit, or whose creatures react or act on themselves, requires schemaVersion 2 and capabilityApi 1.46 or newer";

/** A reaction on the `hit` moment, and a creature's action that is a reaction or lands on the
 *  creature itself, which are 1.46: a new value in the strict reaction object and new keys in the
 *  strict creature action. */
function entriesCarryHitMoments(entries: unknown): boolean {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const record = plainRecord(entry);
    if (plainRecord(plainRecord(record?.mechanics)?.reaction)?.on === "hit") return true;
    const actions = plainRecord(record?.creature)?.actions;
    return (
      Array.isArray(actions) &&
      actions.some((action) => plainRecord(action)?.reaction !== undefined || plainRecord(action)?.self !== undefined)
    );
  });
}

const LIVE_STATES_ISSUE =
  "A ruleset whose sheet has live states, whose derived values read an enum table, or whose rests put a state back, requires schemaVersion 2 and capabilityApi 1.42 or newer";

/** The 1.42 keys: `states` in the live section, an `enumTable` derived value, and a rest step that
 *  names a `state`. Ordinary words, so only those three places are read. */
function rulesetCarriesLiveStates142Keys(ruleset: { sheet?: unknown; rests?: unknown } | undefined): boolean {
  const record = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  const sheet = record(ruleset?.sheet);
  if (record(sheet?.live)?.states !== undefined) return true;
  const derived = sheet?.derived;
  if (Array.isArray(derived) && derived.some((entry) => record(entry)?.op === "enumTable")) return true;
  const rests = Array.isArray(ruleset?.rests) ? ruleset.rests : [];
  return rests.some((rest) => {
    const restore = record(rest)?.restore;
    return Array.isArray(restore) && restore.some((step) => record(step)?.state !== undefined);
  });
}

const SECTIONS_ISSUE =
  "A ruleset whose abilities, skills or saves sit in sections, or that says what a check does untrained, requires schemaVersion 2 and capabilityApi 1.41 or newer";

/** The 1.41 keys: a `section` on an ability, skill or save, and an `untrained` rule on a skill, a save
 *  or a section. Ordinary words, so only those four lists are read. */
function rulesetCarriesSections141Keys(ruleset: { sheet?: unknown } | undefined): boolean {
  const sheet = ruleset?.sheet && typeof ruleset.sheet === "object" ? (ruleset.sheet as Record<string, unknown>) : {};
  const carries = (key: string, fields: readonly string[]) =>
    Array.isArray(sheet[key]) &&
    (sheet[key] as unknown[]).some(
      (entry) =>
        !!entry &&
        typeof entry === "object" &&
        fields.some((field) => (entry as Record<string, unknown>)[field] !== undefined),
    );
  return (
    carries("abilities", ["section"]) ||
    carries("skills", ["section", "untrained"]) ||
    carries("saves", ["section", "untrained"]) ||
    carries("sections", ["untrained"])
  );
}

export function getCapabilityPackageInstallIssue(
  manifest: CapabilityCatalogPackage["manifest"],
  rulesetDocument?: unknown,
  catalogDocuments?: ReadonlyMap<string, unknown>,
): string | null {
  const outer = featureValuesMemo;
  featureValuesMemo ??= new WeakMap();
  try {
    return capabilityPackageInstallIssueFor(manifest, rulesetDocument, catalogDocuments);
  } finally {
    featureValuesMemo = outer;
  }
}

function capabilityPackageInstallIssueFor(
  manifest: CapabilityCatalogPackage["manifest"],
  rulesetDocument?: unknown,
  catalogDocuments?: ReadonlyMap<string, unknown>,
): string | null {
  if (manifest.kind.includes("turn-game") && !manifest.entrypoints.server) {
    return "Turn-game packages require a server entrypoint";
  }
  if (manifest.permissions.includes("routes") && !manifest.restartRequired) {
    return "Packages with privileged routes must require a restart";
  }
  // The ruleset IS the package, so one that declares the kind without the asset would install and
  // then do nothing at all.
  const declaresRuleset = (manifest.contributions?.assets?.paths ?? []).some((path) => {
    try {
      return normalizeArchivePath(path) === RULESET_ASSET_PATH;
    } catch {
      return false;
    }
  });
  if (manifest.kind.includes("ruleset") && !declaresRuleset) {
    return `Ruleset packages must list ${RULESET_ASSET_PATH} in contributions.assets.paths`;
  }
  // And the other way round: the kind is what makes the contribution explicit, in the catalog and
  // to the registry, so a package cannot slip a ruleset in under another kind. Whether the asset is
  // hash-pinned in files[] is already the manifest schema's rule for every declared asset.
  if (declaresRuleset && !manifest.kind.includes("ruleset")) {
    return `Packages that list ${RULESET_ASSET_PATH} must declare the "ruleset" kind`;
  }
  const ruleset =
    rulesetDocument && typeof rulesetDocument === "object"
      ? (rulesetDocument as {
          clocks?: unknown;
          party?: unknown;
          catalogs?: unknown;
          items?: unknown;
          battle?: unknown;
          combat?: unknown;
          resolution?: unknown;
          layers?: unknown;
          gm?: unknown;
          gmReference?: unknown;
          sheet?: unknown;
          rests?: unknown;
        })
      : undefined;
  const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
  const declaresApi = (minor: number) => !!api && (api.major > 1 || (api.major === 1 && api.minor >= minor));
  /** Whether a catalog, inline or in its own file, gives a creature its loot: 1.63, asked last. */
  let carriesLoot = false;
  let carriesMarket = false;
  let carriesCoverlessSaves = false;
  let carriesMarketDay = false;
  let carriesHonesty = false;
  let carriesSpotting = false;
  let carriesAmountAdd = false;
  let carriesGrants = false;
  let carriesEntryChoices = false;
  let carriesSeveralScaled = false;
  let carriesRepeatChoices = false;
  let carriesChoiceCaps = false;
  let carriesBuilderChoices = carriesBuilderChoices146(ruleset);
  let carriesBuilderLegality = carriesBuilderLegality150(ruleset);
  let carriesContextual = carriesContextual151(ruleset);
  const ratingBuilder = plainRecord(plainRecord(ruleset?.sheet)?.builder);
  let carriesBuilderRatings =
    ratingBuilder?.ratingTiers !== undefined ||
    (Array.isArray(ratingBuilder?.steps) && ratingBuilder.steps.some((step) => plainRecord(step)?.kind === "allocate"));
  let carriesDamageSheetBonus = false;
  let carriesDamageReroll = false;
  let carriesOfferedWhen = false;
  let carriesBlowQualities = false;
  let carriesDamageAlternatives = false;
  let carriesSizes = false;
  let carriesMoveModes = false;
  let carriesHeldChoices = false;
  let carriesExclusive = false;
  let carriesSheetBonus = false;
  let carriesExhaustion = false;
  let carriesCounterReachKeys = false;
  let carriesNamedAnswerKeys = false;
  let carriesBlowNarrowingKeys = false;
  let carriesFallMoments = false;
  let carriesReactionMomentKeys = false;
  let carriesUsableWhenKeys = false;
  let carriesSourceClockKeys = false;
  let carriesCreatureHealing = false;
  let carriesSummons = false;
  let carriesCreatureSpellcasting = false;
  let carriesRiderNoDisadvantage = false;
  let carriesSenseNeeds = false;
  let carriesLineWidth = false;
  let carriesDamageOnlySaveKeys = false;
  // The tracks a level reads and no condition shares a name with: an immunity naming one is new.
  const conditionIds = new Set(
    (Array.isArray(plainRecord(plainRecord(plainRecord(ruleset?.sheet)?.live))?.conditions)
      ? (plainRecord(plainRecord(ruleset?.sheet)?.live)!.conditions as unknown[])
      : []
    ).map((condition) => plainRecord(condition)?.id),
  );
  const leveledTracks = new Set(
    (Array.isArray(plainRecord(ruleset?.combat)?.levels) ? (plainRecord(ruleset?.combat)!.levels as unknown[]) : [])
      .map((level) => plainRecord(level)?.track)
      .filter((track): track is string => typeof track === "string" && !conditionIds.has(track)),
  );
  // Every item by "<catalog>/<entry>", inline and in files, and the fakes among them, so a fake whose
  // target is in another catalog file is checked here, where every file can be read.
  const itemsByRef = new Map<string, RulesetCatalogItem>();
  const fakes: Array<{ ref: string; item: RulesetCatalogItem }> = [];
  const collectItems = (catalogId: unknown, entries: unknown) => {
    if (typeof catalogId !== "string" || !Array.isArray(entries)) return;
    for (const entry of entries) {
      const record = plainRecord(entry);
      const item = plainRecord(record?.item);
      if (typeof record?.id !== "string" || !item) continue;
      const ref = `${catalogId}/${record.id}`;
      itemsByRef.set(ref, item as RulesetCatalogItem);
      if (typeof item.passesFor === "string") fakes.push({ ref, item: item as RulesetCatalogItem });
    }
  };
  const catalogs = ruleset?.catalogs;
  if (Array.isArray(catalogs) && catalogs.length > 0) {
    if (!declaresApi(21)) {
      return "A ruleset with catalogs requires schemaVersion 2 and capabilityApi 1.21 or newer";
    }
    // A catalog file the ruleset names but the package never declared would install fine and then
    // leave the picker with nothing to open. Said at install, where the author can still fix it.
    const declaredPaths = new Set(
      (manifest.contributions?.assets?.paths ?? []).map(tryNormalizeArchivePath).filter((path) => path !== null),
    );
    // A row whose number the ruleset keeps up to date is a new key in a strict file, inline or in a
    // catalog asset, so an Engine that does not know it refuses the file that holds it.
    const scaledIssue = "A ruleset with scaled catalog rows requires schemaVersion 2 and capabilityApi 1.23 or newer";
    const mechanicsIssue =
      "A ruleset whose catalog mechanics reach a fight requires schemaVersion 2 and capabilityApi 1.26 or newer";
    // A bestiary is the catalog's own `holds` plus the `creature` on every entry of it, and the
    // entries may sit in the ruleset file or in the catalog file, so both are read.
    const creatureIssue =
      "A ruleset with a catalog of creatures requires schemaVersion 2 and capabilityApi 1.27 or newer";
    // A distance a fight measures in cells is a new key, or a new shape for an old one, in the same
    // strict file. Same reading, same reason.
    const positionIssue =
      "A ruleset whose fights are measured in cells requires schemaVersion 2 and capabilityApi 1.28 or newer";
    // And what one turn of that fight can do: a second damage clause, several strikes for one
    // budget, an ability that changes the economy, and a rider. New keys, same file, same reason.
    const economyIssue =
      "A ruleset that says what one turn can do requires schemaVersion 2 and capabilityApi 1.29 or newer";
    // And what a picked entry does to a check, which is new in 1.30 and needs no wound track at all.
    const checkIssue =
      "A ruleset whose catalog entries change a check requires schemaVersion 2 and capabilityApi 1.30 or newer";
    // And the moment a reaction waits for, which is new in 1.33.
    const momentIssue =
      "A ruleset whose reactions name the moment they wait for requires schemaVersion 2 and capabilityApi 1.33 or newer";
    // And a creature written in the ruleset's own terms, which is new in 1.34.
    const sheetIssue =
      "A ruleset whose creatures carry a sheet of their own requires schemaVersion 2 and capabilityApi 1.34 or newer";
    // And an entry that moves a pool rule for the check it is used on, which is new in 1.37.
    const facesIssue = MOVED_POOL_RULES_ISSUE;
    for (const catalog of catalogs) {
      const header =
        catalog && typeof catalog === "object"
          ? (catalog as { id?: unknown; asset?: unknown; entries?: unknown; holds?: unknown })
          : {};
      if (header.holds === "creatures" && !declaresApi(27)) return creatureIssue;
      if (header.holds === "items" && !declaresApi(49)) return ITEMS_ISSUE;
      if (entriesCarryItems(header.entries) && !declaresApi(49)) return ITEMS_ISSUE;
      if (entriesCarryScaledRows(header.entries) && !declaresApi(23)) return scaledIssue;
      if (entriesCarryCombatMechanics(header.entries) && !declaresApi(26)) return mechanicsIssue;
      if (entriesCarryCreatures(header.entries) && !declaresApi(27)) return creatureIssue;
      if (entriesCarryCreatureRanges(header.entries) && !declaresApi(28)) return positionIssue;
      if (entriesCarryTurnEconomy(header.entries) && !declaresApi(29)) return economyIssue;
      if (entriesCarryCreatureEconomy(header.entries) && !declaresApi(29)) return economyIssue;
      if (entriesCarryCheckEffects(header.entries) && !declaresApi(30)) return checkIssue;
      if (entriesCarryReactionMoments(header.entries) && !declaresApi(33)) return momentIssue;
      if (entriesCarryCreatureSheets(header.entries) && !declaresApi(34)) return sheetIssue;
      if (entriesCarryCheckFaces(header.entries) && !declaresApi(37)) return facesIssue;
      if (entriesCarryCreatureChecks(header.entries) && !declaresApi(43)) return CONTESTS_ISSUE;
      if (entriesCarryUsedMoments(header.entries) && !declaresApi(44)) return USED_MOMENTS_ISSUE;
      if (entriesCarryConditionEndings(header.entries) && !declaresApi(45)) return CONDITION_NUMBERS_ISSUE;
      if (entriesCarryHitMoments(header.entries) && !declaresApi(46)) return HIT_MOMENTS_ISSUE;
      if (entriesCarryCreatureSoak(header.entries) && !declaresApi(47)) return POOL_FIGHT_ISSUE;
      if (entriesCarryItemEffects(header.entries) && !declaresApi(53)) return CHECK_EFFECTS_ISSUE;
      if (entriesCarryRequirements(header.entries) && !declaresApi(54)) return REQUIREMENTS_ISSUE;
      if (entriesCarryWeapons(header.entries) && !declaresApi(55)) return WEAPONS_ISSUE;
      if (entriesCarryArmor(header.entries) && !declaresApi(56)) return ARMOR_ISSUE;
      if (entriesCarryAmmo(header.entries) && !declaresApi(57)) return AMMO_ISSUE;
      if (entriesCarryWeaponWays(header.entries) && !declaresApi(58)) return WEAPON_WAYS_ISSUE;
      if (entriesCarryItemUse(header.entries) && !declaresApi(59)) return ITEM_USE_ISSUE;
      if (entriesCarryItemRestore(header.entries) && !declaresApi(60)) return ITEM_RESTORE_ISSUE;
      if (entriesCarryChargesOverTime(header.entries) && !declaresApi(61)) return CHARGES_OVER_TIME_ISSUE;
      if (entriesCarryItemGate(header.entries) && !declaresApi(62)) return ITEM_GATE_ISSUE;
      if (entriesCarryHeldRider(header.entries) && !declaresApi(70)) return HELD_RIDER_ISSUE;
      if (entriesCarryCreatureLoot(header.entries)) carriesLoot = true;
      if (entriesCarryMarket(header.entries)) carriesMarket = true;
      if (entriesCarryCoverlessSaves(header.entries)) carriesCoverlessSaves = true;
      if (entriesCarryMarketDay(header.entries)) carriesMarketDay = true;
      if (entriesCarryHonesty(header.entries)) carriesHonesty = true;
      if (entriesCarrySpotting(header.entries)) carriesSpotting = true;
      if (entriesCarryAmountAdd(header.entries)) carriesAmountAdd = true;
      if (entriesCarryGrants(header.entries)) carriesGrants = true;
      if (entriesCarryEntryChoices(header.entries)) carriesEntryChoices = true;
      if (entriesCarrySeveralScaledRows(header.entries)) carriesSeveralScaled = true;
      if (entriesCarryRepeatChoices(header.entries)) carriesRepeatChoices = true;
      if (entriesCarryChoiceCaps(header.entries)) carriesChoiceCaps = true;
      if (entriesCarryBuilderChoices146(header.entries)) carriesBuilderChoices = true;
      if (entriesCarryBuilderLegality150(header.entries)) carriesBuilderLegality = true;
      if (entriesCarryContextual151(header.entries)) carriesContextual = true;
      if (entriesCarryBuilderRatings147(header.entries)) carriesBuilderRatings = true;
      if (entriesCarryDamageSheetBonus(header.entries)) carriesDamageSheetBonus = true;
      if (entriesCarryDamageReroll(header.entries)) carriesDamageReroll = true;
      if (entriesCarryOfferedWhen(header.entries)) carriesOfferedWhen = true;
      if (entriesCarryBlowQualities(header.entries)) carriesBlowQualities = true;
      if (entriesCarryDamageAlternatives(header.entries)) carriesDamageAlternatives = true;
      if (entriesCarrySizes(header.entries)) carriesSizes = true;
      if (entriesCarryMoveModes(header.entries)) carriesMoveModes = true;
      if (carriesCounterReach(header.entries)) carriesCounterReachKeys = true;
      if (carriesNamedAnswers(header.entries)) carriesNamedAnswerKeys = true;
      if (carriesBlowNarrowing(header.entries)) carriesBlowNarrowingKeys = true;
      if (carriesReactionMoments(header.entries)) carriesReactionMomentKeys = true;
      if (carriesUsableWhen(header.entries)) carriesUsableWhenKeys = true;
      if (carriesFalls(header.entries)) carriesFallMoments = true;
      if (carriesSourceClock(header.entries)) carriesSourceClockKeys = true;
      if (entriesCarryCreatureHealing(header.entries)) carriesCreatureHealing = true;
      if (entriesCarrySummons(header.entries)) carriesSummons = true;
      if (entriesCarryCreatureSpellcasting(header.entries)) carriesCreatureSpellcasting = true;
      if (entriesCarryRiderNoDisadvantage(header.entries)) carriesRiderNoDisadvantage = true;
      if (entriesCarrySenseNeeds(header.entries)) carriesSenseNeeds = true;
      if (entriesCarryLineWidth(header.entries)) carriesLineWidth = true;
      if (carriesDamageOnlySaves(header.entries)) carriesDamageOnlySaveKeys = true;
      if (carriesHealthMax(header.entries) || entriesImmuneToTracks(header.entries, leveledTracks)) {
        carriesExhaustion = true;
      }
      if (entriesCarryHeldChoices(header.entries)) carriesHeldChoices = true;
      if (entriesCarryExclusive(header.entries)) carriesExclusive = true;
      if (entriesCarryToHitSheetBonus(header.entries)) carriesSheetBonus = true;
      collectItems(header.id, header.entries);
      const asset = header.asset;
      if (typeof asset !== "string") continue;
      // A path that does not normalize is never a declared one, whatever else failed to normalize.
      const normalized = tryNormalizeArchivePath(asset);
      if (!normalized || !declaredPaths.has(normalized)) {
        return `The ruleset names the catalog file ${asset}, which is not listed in contributions.assets.paths`;
      }
      const document = catalogDocuments?.get(normalized);
      const fileEntries = document && typeof document === "object" ? (document as { entries?: unknown }).entries : null;
      if (entriesCarryScaledRows(fileEntries) && !declaresApi(23)) return scaledIssue;
      if (entriesCarryCombatMechanics(fileEntries) && !declaresApi(26)) return mechanicsIssue;
      if (entriesCarryCreatures(fileEntries) && !declaresApi(27)) return creatureIssue;
      if (entriesCarryCreatureRanges(fileEntries) && !declaresApi(28)) return positionIssue;
      if (entriesCarryTurnEconomy(fileEntries) && !declaresApi(29)) return economyIssue;
      if (entriesCarryCreatureEconomy(fileEntries) && !declaresApi(29)) return economyIssue;
      if (entriesCarryCheckEffects(fileEntries) && !declaresApi(30)) return checkIssue;
      if (entriesCarryReactionMoments(fileEntries) && !declaresApi(33)) return momentIssue;
      if (entriesCarryCreatureSheets(fileEntries) && !declaresApi(34)) return sheetIssue;
      if (entriesCarryCheckFaces(fileEntries) && !declaresApi(37)) return facesIssue;
      if (entriesCarryCreatureChecks(fileEntries) && !declaresApi(43)) return CONTESTS_ISSUE;
      if (entriesCarryUsedMoments(fileEntries) && !declaresApi(44)) return USED_MOMENTS_ISSUE;
      if (entriesCarryConditionEndings(fileEntries) && !declaresApi(45)) return CONDITION_NUMBERS_ISSUE;
      if (entriesCarryHitMoments(fileEntries) && !declaresApi(46)) return HIT_MOMENTS_ISSUE;
      if (entriesCarryCreatureSoak(fileEntries) && !declaresApi(47)) return POOL_FIGHT_ISSUE;
      if (entriesCarryItems(fileEntries) && !declaresApi(49)) return ITEMS_ISSUE;
      if (entriesCarryItemEffects(fileEntries) && !declaresApi(53)) return CHECK_EFFECTS_ISSUE;
      if (entriesCarryRequirements(fileEntries) && !declaresApi(54)) return REQUIREMENTS_ISSUE;
      if (entriesCarryWeapons(fileEntries) && !declaresApi(55)) return WEAPONS_ISSUE;
      if (entriesCarryArmor(fileEntries) && !declaresApi(56)) return ARMOR_ISSUE;
      if (entriesCarryAmmo(fileEntries) && !declaresApi(57)) return AMMO_ISSUE;
      if (entriesCarryWeaponWays(fileEntries) && !declaresApi(58)) return WEAPON_WAYS_ISSUE;
      if (entriesCarryItemUse(fileEntries) && !declaresApi(59)) return ITEM_USE_ISSUE;
      if (entriesCarryItemRestore(fileEntries) && !declaresApi(60)) return ITEM_RESTORE_ISSUE;
      if (entriesCarryChargesOverTime(fileEntries) && !declaresApi(61)) return CHARGES_OVER_TIME_ISSUE;
      if (entriesCarryItemGate(fileEntries) && !declaresApi(62)) return ITEM_GATE_ISSUE;
      if (entriesCarryHeldRider(fileEntries) && !declaresApi(70)) return HELD_RIDER_ISSUE;
      if (entriesCarryCreatureLoot(fileEntries)) carriesLoot = true;
      if (entriesCarryMarket(fileEntries)) carriesMarket = true;
      if (entriesCarryCoverlessSaves(fileEntries)) carriesCoverlessSaves = true;
      if (entriesCarryMarketDay(fileEntries)) carriesMarketDay = true;
      if (entriesCarryHonesty(fileEntries)) carriesHonesty = true;
      if (entriesCarrySpotting(fileEntries)) carriesSpotting = true;
      if (entriesCarryAmountAdd(fileEntries)) carriesAmountAdd = true;
      if (entriesCarryGrants(fileEntries)) carriesGrants = true;
      if (entriesCarryEntryChoices(fileEntries)) carriesEntryChoices = true;
      if (entriesCarrySeveralScaledRows(fileEntries)) carriesSeveralScaled = true;
      if (entriesCarryRepeatChoices(fileEntries)) carriesRepeatChoices = true;
      if (entriesCarryChoiceCaps(fileEntries)) carriesChoiceCaps = true;
      if (entriesCarryBuilderChoices146(fileEntries)) carriesBuilderChoices = true;
      if (entriesCarryBuilderLegality150(fileEntries)) carriesBuilderLegality = true;
      if (entriesCarryContextual151(fileEntries)) carriesContextual = true;
      if (entriesCarryBuilderRatings147(fileEntries)) carriesBuilderRatings = true;
      if (entriesCarryDamageSheetBonus(fileEntries)) carriesDamageSheetBonus = true;
      if (entriesCarryDamageReroll(fileEntries)) carriesDamageReroll = true;
      if (entriesCarryOfferedWhen(fileEntries)) carriesOfferedWhen = true;
      if (entriesCarryBlowQualities(fileEntries)) carriesBlowQualities = true;
      if (entriesCarryDamageAlternatives(fileEntries)) carriesDamageAlternatives = true;
      if (entriesCarrySizes(fileEntries)) carriesSizes = true;
      if (entriesCarryMoveModes(fileEntries)) carriesMoveModes = true;
      if (carriesHealthMax(fileEntries) || entriesImmuneToTracks(fileEntries, leveledTracks)) carriesExhaustion = true;
      if (carriesCounterReach(fileEntries)) carriesCounterReachKeys = true;
      if (carriesNamedAnswers(fileEntries)) carriesNamedAnswerKeys = true;
      if (carriesBlowNarrowing(fileEntries)) carriesBlowNarrowingKeys = true;
      if (carriesReactionMoments(fileEntries)) carriesReactionMomentKeys = true;
      if (carriesUsableWhen(fileEntries)) carriesUsableWhenKeys = true;
      if (carriesFalls(fileEntries)) carriesFallMoments = true;
      if (carriesSourceClock(fileEntries)) carriesSourceClockKeys = true;
      if (entriesCarryCreatureHealing(fileEntries)) carriesCreatureHealing = true;
      if (entriesCarrySummons(fileEntries)) carriesSummons = true;
      if (entriesCarryCreatureSpellcasting(fileEntries)) carriesCreatureSpellcasting = true;
      if (entriesCarryRiderNoDisadvantage(fileEntries)) carriesRiderNoDisadvantage = true;
      if (entriesCarrySenseNeeds(fileEntries)) carriesSenseNeeds = true;
      if (entriesCarryLineWidth(fileEntries)) carriesLineWidth = true;
      if (carriesDamageOnlySaves(fileEntries)) carriesDamageOnlySaveKeys = true;
      if (entriesCarryHeldChoices(fileEntries)) carriesHeldChoices = true;
      if (entriesCarryExclusive(fileEntries)) carriesExclusive = true;
      if (entriesCarryToHitSheetBonus(fileEntries)) carriesSheetBonus = true;
      collectItems(header.id, fileEntries);
    }
  }
  for (const fake of fakes) {
    const issue = rulesetFakeIssue(fake.ref, fake.item, itemsByRef.get(fake.item.passesFor!));
    if (issue) return `The fake "${fake.ref}" cannot pass for "${fake.item.passesFor}": ${issue}`;
  }
  // A fake's tells (1.802) read only a fake, carry only items of this ruleset, and fool only ways of
  // seeing through fakes the items block names.
  const ways =
    (plainRecord(ruleset?.items)?.revealsFakes as Array<{ id?: unknown; items?: unknown }> | undefined) ?? [];
  const revealIds = new Set(ways.map((way) => way?.id));
  for (const way of ways) {
    const wrong = (Array.isArray(way?.items) ? way.items : []).find(
      (ref) => typeof ref !== "string" || !itemsByRef.get(ref)?.passesFor,
    );
    if (wrong !== undefined)
      return `The way "${String(way.id)}" of seeing through fakes reads "${String(wrong)}": it is no fake of this ruleset`;
  }
  for (const [ref, item] of itemsByRef) {
    if ((item.tells || item.foolsReveal) && !item.passesFor)
      return `The item "${ref}" has tells or foolsReveal but is no fake: they read only an item with passesFor`;
    for (const tell of item.tells ?? []) {
      const missing = tell.carries?.anyOf.find((each) => !itemsByRef.has(each));
      if (missing) return `The fake "${ref}" has a tell that carries "${missing}": it is no item of this ruleset`;
    }
    const unknown = item.foolsReveal?.find((id) => !revealIds.has(id));
    if (unknown) return `The fake "${ref}" fools "${unknown}": it is none of items.revealsFakes`;
  }
  // What an item becomes on its last charge (1.272) is an item, in whichever file it is.
  for (const [ref, item] of itemsByRef) {
    const becomes = plainRecord(plainRecord(item.charges)?.breaksOn)?.becomes;
    if (typeof becomes === "string" && (becomes === ref || !itemsByRef.has(becomes))) {
      return `The item "${ref}" cannot become "${becomes}": it is no other item of this ruleset`;
    }
  }
  // The battle block lives inside the ruleset file too, so it is read the same way and for the same
  // reason: an Engine that does not know the key refuses the whole file, and the package would be
  // installed with no rules at all.
  if (ruleset?.battle && typeof ruleset.battle === "object" && !declaresApi(22)) {
    return "A ruleset with a battle block requires schemaVersion 2 and capabilityApi 1.22 or newer";
  }
  // The resolution kind is read the same way and for the same reason. An Engine that knows only
  // `dice-sum` refuses the whole file, so the package would be installed with no rules at all.
  const resolution =
    ruleset?.resolution && typeof ruleset.resolution === "object"
      ? (ruleset.resolution as { kind?: unknown; penaltyFrom?: unknown; spend?: unknown })
      : undefined;
  if (resolution?.kind === "dice-pool" && !declaresApi(24)) {
    return "A ruleset with a dice-pool resolution requires schemaVersion 2 and capabilityApi 1.24 or newer";
  }
  // Layers and the base world-generation slot are new keys in the same strict file, so they are
  // read the same way and for the same reason as everything above: an Engine that does not know
  // the key refuses the whole file, and the package would install with no rules at all.
  if (Array.isArray(ruleset?.layers) && ruleset.layers.length > 0 && !declaresApi(25)) {
    return "A ruleset with layers requires schemaVersion 2 and capabilityApi 1.25 or newer";
  }
  const gm = ruleset?.gm && typeof ruleset.gm === "object" ? (ruleset.gm as { worldGuidance?: unknown }) : undefined;
  if (gm?.worldGuidance !== undefined && !declaresApi(25)) {
    return "A ruleset with gm.worldGuidance requires schemaVersion 2 and capabilityApi 1.25 or newer";
  }
  // The combat block is one more key in the same strict file, read the same way and for the same
  // reason. An inline catalog whose mechanics reach a fight is checked with the catalogs above.
  if (ruleset?.combat && typeof ruleset.combat === "object" && !declaresApi(26)) {
    return "A ruleset with a combat block requires schemaVersion 2 and capabilityApi 1.26 or newer";
  }
  // And the keys inside it that give a fight a board. Same file, same reading, same reason.
  const combat =
    ruleset?.combat && typeof ruleset.combat === "object" ? (ruleset.combat as Record<string, unknown>) : undefined;
  if (combat && !declaresApi(28)) {
    const positioned = ["distance", "ranged", "cover", "opportunity"].some((key) => combat[key] !== undefined);
    const attacks = Array.isArray(combat.attacks)
      ? combat.attacks.some(
          (source) =>
            !!source &&
            typeof source === "object" &&
            (["reach", "range"] as const).some((key) => (source as Record<string, unknown>)[key] !== undefined),
        )
      : false;
    if (positioned || attacks) {
      return "A ruleset whose fights are measured in cells requires schemaVersion 2 and capabilityApi 1.28 or newer";
    }
  }
  // And the keys inside the block that say what one turn can do. Same file, same reading, same
  // reason: an attack list that buys several strikes with one spend, and a condition that narrows
  // the saves it is about, is in sight of its source or ends when its source goes down.
  if (combat && !declaresApi(29)) {
    const strikes = Array.isArray(combat.attacks)
      ? combat.attacks.some(
          (source) =>
            !!source && typeof source === "object" && (source as Record<string, unknown>).strikes !== undefined,
        )
      : false;
    const conditions = Array.isArray(combat.conditions)
      ? combat.conditions.some((entry) => {
          if (!entry || typeof entry !== "object") return false;
          const record = entry as Record<string, unknown>;
          if ((["saves", "whileSourceInSight", "endsWhenSourceDown"] as const).some((key) => record[key] !== undefined))
            return true;
          // A value the old effect list did not hold is refused by an Engine that only knows that
          // list, so it is read here as well as the keys beside it.
          return (
            Array.isArray(record.effects) &&
            record.effects.some((effect) => typeof effect === "string" && !OLD_CONDITION_EFFECTS.has(effect))
          );
        })
      : false;
    // The part of a dodge its flag does not carry. Same reason as the two above: an Engine that does
    // not know the key refuses the whole strict file rather than ignoring it.
    const dodgeSaves = combat.standardEffects !== undefined;
    if (strikes || conditions || dodgeSaves) {
      return "A ruleset that says what one turn can do requires schemaVersion 2 and capabilityApi 1.29 or newer";
    }
  }
  // A weapon held to one strike by a column of its own row. Same file, same reading, same reason as
  // everything above: an Engine that does not know the key refuses the whole ruleset.
  if (combat && !declaresApi(32)) {
    const capped = Array.isArray(combat.attacks)
      ? combat.attacks.some(
          (source) =>
            !!source && typeof source === "object" && (source as Record<string, unknown>).strikesCappedBy !== undefined,
        )
      : false;
    if (capped) {
      return "A ruleset whose weapons cap their own strikes requires schemaVersion 2 and capabilityApi 1.32 or newer";
    }
  }
  // The items block, which is 1.49's. Same file, same reason.
  if (!declaresApi(49) && ruleset?.items !== undefined) return ITEMS_ISSUE;
  // What the Game Master may invent, which is 1.51's. Same file, same reason.
  if (!declaresApi(51) && rulesetCarriesInventedItem151Keys(ruleset)) return INVENTED_ITEMS_ISSUE;
  // What items, conditions and levels do to checks outside a fight, which are 1.53's. Same file, same
  // reason; the items themselves are read with the catalogs above.
  if (!declaresApi(53) && rulesetCarriesCheckEffects153Keys(ruleset)) return CHECK_EFFECTS_ISSUE;
  // A level that reads a derived value, which is 1.54's. Same file, same reason.
  if (!declaresApi(54) && rulesetCarriesDerivedLevels154(ruleset)) return REQUIREMENTS_ISSUE;
  if (!declaresApi(56) && plainRecord(plainRecord(plainRecord(ruleset?.combat)?.pool))?.hardness !== undefined) {
    return ARMOR_ISSUE;
  }
  if (!declaresApi(58) && plainRecord(ruleset?.combat)?.offHand !== undefined) return WEAPON_WAYS_ISSUE;
  // Values that read the items someone holds, which are 1.52's. Same file (and the same catalog
  // files), same reason.
  if (
    !declaresApi(52) &&
    (carriesItemStat152(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemStat152(document)))
  ) {
    return ITEM_STAT_ISSUE;
  }
  // Initiative thrown as a pool, and a number attacks move, which are 1.48's. Same file, same reason.
  if (!declaresApi(48) && rulesetCarriesMovingInitiative148Keys(ruleset)) return MOVING_INITIATIVE_ISSUE;
  // A fight thrown in pools, and what either kind may now throw every round or cap per turn, which
  // are 1.47's. Same file, same reason.
  if (!declaresApi(47) && rulesetCarriesPoolFight147Keys(ruleset)) return POOL_FIGHT_ISSUE;
  // Numbers a condition changes, and levels of a track, which are 1.45's. Same file, same reason.
  if (!declaresApi(45) && rulesetCarriesConditionNumbers145Keys(ruleset)) return CONDITION_NUMBERS_ISSUE;
  // Contests and the checks they read, which are 1.43's. Same file, same reason.
  if (!declaresApi(43) && rulesetCarriesContests143Keys(ruleset)) return CONTESTS_ISSUE;
  // Live states, the enum tables that follow them and the rests that put them back, which are
  // 1.42's. Same file, same reason.
  if (!declaresApi(42) && rulesetCarriesLiveStates142Keys(ruleset)) return LIVE_STATES_ISSUE;
  // Sections on abilities, skills and saves, and untrained rules, which are 1.41's. Same file, same reason.
  if (!declaresApi(41) && rulesetCarriesSections141Keys(ruleset)) return SECTIONS_ISSUE;
  // Wound tracks of boxes, filled by box, refusing when full or lengthened by a list, and rests that
  // heal one kind of harm, which are 1.40's. Same file, same reason.
  if (!declaresApi(40) && rulesetCarriesWound140Keys(ruleset)) return WOUND_BOXES_ISSUE;
  // Values that read the live state or add up a list, caps on checks, and wider hide rules, which are
  // 1.39's. Same file (and the same catalog files), same reason.
  if (
    !declaresApi(39) &&
    (carriesSheetReads139(ruleset) ||
      rulesetCapsChecks(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSheetReads139(document)))
  ) {
    return SHEET_READS_ISSUE;
  }
  // What a check may buy and what rides along on it, which are 1.38's: standing re-throws, a spend
  // that throws again or reads its limit off the sheet, more than two spends, and sheet modifiers.
  if (resolution && !declaresApi(38)) {
    const record = resolution as Record<string, unknown>;
    const spends = Array.isArray(record.spend) ? record.spend : [];
    const newSpend =
      spends.length > 2 ||
      spends.some((entry) => {
        const spend = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return spend.reroll !== undefined || (spend.perCheck !== undefined && typeof spend.perCheck !== "number");
      });
    if (record.reroll !== undefined || record.adjust !== undefined || newSpend) {
      return "A ruleset whose checks take standing re-throws or sheet modifiers, or whose spends throw again, read their limit off the sheet or number more than two, requires schemaVersion 2 and capabilityApi 1.38 or newer";
    }
  }
  // The sheet's own 1.37 keys: a track's maximum off the sheet, a track hidden or always shown, and
  // a summary list's columns or enum name. Same file, same reading, same reason.
  if (!declaresApi(37) && rulesetCarriesSheet137Keys(ruleset)) return SHEET_1_37_ISSUE;
  // A pool check whose rules a check may move, two abilities rolled together, and a botch read off
  // half the dice. New keys in the same strict resolution, so the reading and the reason are the same
  // as everything above.
  if (resolution?.kind === "dice-pool" && !declaresApi(37)) {
    const record = resolution as Record<string, unknown>;
    const moved = (["explode", "double"] as const).some((key) => {
      const rule = record[key];
      return !!rule && typeof rule === "object" && (rule as Record<string, unknown>).min !== undefined;
    });
    const pool = record.pool;
    const paired =
      !!pool && typeof pool === "object" && (pool as Record<string, unknown>).abilityPlusAbility !== undefined;
    const botch = record.botch;
    const ruled = !!botch && typeof botch === "object" && (botch as Record<string, unknown>).rule !== undefined;
    if (moved || paired || ruled) return MOVED_POOL_RULES_ISSUE;
  }
  // Wound tracks. `levels` and `kinds` on a live track, and the track `resolution.penaltyFrom`
  // names, are new keys in the same strict file, so the reading and the reason are the same as
  // everything above: an Engine that does not know them refuses the whole ruleset.
  if (!declaresApi(30)) {
    const woundIssue = "A ruleset with wound tracks requires schemaVersion 2 and capabilityApi 1.30 or newer";
    const sheet =
      ruleset?.sheet && typeof ruleset.sheet === "object" ? (ruleset.sheet as { live?: unknown }) : undefined;
    const live = sheet?.live && typeof sheet.live === "object" ? (sheet.live as { tracks?: unknown }) : undefined;
    const marked = Array.isArray(live?.tracks)
      ? live.tracks.some(
          (track) =>
            !!track &&
            typeof track === "object" &&
            (["levels", "kinds"] as const).some((key) => (track as Record<string, unknown>)[key] !== undefined),
        )
      : false;
    if (marked || resolution?.penaltyFrom !== undefined) return woundIssue;
    // A player spending a resource on a roll is the other half of 1.30 and depends on no track at
    // all, so it is its own reason rather than being folded into the wound-track one.
    if (resolution?.spend !== undefined) {
      return "A ruleset that lets a check spend a resource requires schemaVersion 2 and capabilityApi 1.30 or newer";
    }
  }
  // Loot tables in the items block and a creature's loot, which are 1.63's. Same files, same reason;
  // asked last, so a package that declares an older minor hears first about what that minor lacks.
  if (!declaresApi(63) && (carriesLoot || plainRecord(ruleset?.items)?.lootTables !== undefined)) return LOOT_ISSUE;
  if (!declaresApi(64) && rulesetCarriesMoney164(ruleset)) return MONEY_ISSUE;
  if (!declaresApi(65) && (carriesMarket || plainRecord(ruleset?.items)?.market !== undefined)) return MARKET_ISSUE;
  if (!declaresApi(69) && (carriesMarketDay || rulesetCarriesMarketDay169(ruleset))) return MARKET_DAY_ISSUE;
  // Cover by degrees, 1.74: new keys on the strict cover object and the strict save.
  const cover = plainRecord(plainRecord(ruleset?.combat)?.cover);
  const graded = ["threeQuarters", "saves", "creatures"].some((key) => cover?.[key] !== undefined);
  if (!declaresApi(74) && (graded || carriesCoverlessSaves)) return COVER_ISSUE;
  // Height, 1.75 (combat C6b): a new key on the strict combat block.
  if (!declaresApi(75) && plainRecord(ruleset?.combat)?.elevation !== undefined) {
    return "A ruleset that says what a board's height does requires schemaVersion 2 and capabilityApi 1.75 or newer";
  }
  // The action economy conditions change, 1.76 (combat C6d): new keys on the strict condition, and a
  // budget of no count, which an older Engine refuses.
  const combatBlock = plainRecord(ruleset?.combat);
  const economy = Array.isArray(combatBlock?.conditions)
    ? combatBlock.conditions.some((entry) =>
        ["budgets", "grants", "exclusive", "attacksPerTurn", "onEnd"].some(
          (key) => plainRecord(entry)?.[key] !== undefined,
        ),
      )
    : false;
  const budgets = plainRecord(combatBlock?.economy)?.budgets;
  const emptyBudget = Array.isArray(budgets) && budgets.some((budget) => plainRecord(budget)?.count === 0);
  if (!declaresApi(76) && (economy || emptyBudget)) {
    return "A ruleset whose conditions change the action economy, or with a budget of no count, requires schemaVersion 2 and capabilityApi 1.76 or newer";
  }
  // Sheet migrations, 1.77 (C6e-0): a new key on the strict sheet.
  if (!declaresApi(77) && plainRecord(ruleset?.sheet)?.migrations !== undefined) {
    return "A ruleset whose sheet says how older sheets read on it requires schemaVersion 2 and capabilityApi 1.77 or newer";
  }
  // A rest that shares a pool group's fraction, 1.77 (C6e): a new key on the strict restore step.
  const sharedRest = Array.isArray(ruleset?.rests)
    ? ruleset.rests.some((rest) => {
        const restore = plainRecord(rest)?.restore;
        return Array.isArray(restore) && restore.some((step) => plainRecord(step)?.shared !== undefined);
      })
    : false;
  if (!declaresApi(77) && sharedRest) {
    return "A ruleset whose rest shares a pool group's fraction requires schemaVersion 2 and capabilityApi 1.77 or newer";
  }
  // Starting gear, 1.78 (P1-6): a new key on the strict items block.
  if (!declaresApi(78) && plainRecord(ruleset?.items)?.startingGear !== undefined) {
    return "A ruleset with starting gear requires schemaVersion 2 and capabilityApi 1.78 or newer";
  }
  // Seller honesty, 1.79 (P1-7): risky items and fakes in any catalog, and a seller that is not honest.
  const sellers = plainRecord(plainRecord(ruleset?.items)?.market)?.sellers;
  const dishonest = Array.isArray(sellers) && sellers.some((seller) => plainRecord(seller)?.honest !== undefined);
  if (!declaresApi(79) && (carriesHonesty || dishonest)) return HONESTY_ISSUE;
  // Spotting fakes, 1.802: a fake's tells, a dishonest seller's manner, and the items block's keys.
  const itemsBlock = plainRecord(ruleset?.items);
  if (
    !declaresApi(802) &&
    (carriesSpotting ||
      (Array.isArray(sellers) && sellers.some((seller) => plainRecord(seller)?.manner !== undefined)) ||
      ["namesItAt", "passiveBase", "warnBy", "revealsFakes"].some((key) => itemsBlock?.[key] !== undefined))
  ) {
    return "A ruleset whose fakes can be spotted (tells, foolsReveal, a seller's manner, items.namesItAt, passiveBase, warnBy or revealsFakes) requires schemaVersion 2 and capabilityApi 1.802 or newer";
  }
  // A critical range off the sheet, 1.81: a new key on the strict attack roll.
  if (!declaresApi(81) && plainRecord(plainRecord(combatBlock)?.attackRoll)?.criticalFrom !== undefined) {
    return CRITICAL_RANGE_ISSUE;
  }
  // A derived value that multiplies, 1.82: a new op.
  const derivedValues = plainRecord(ruleset?.sheet)?.derived;
  if (
    !declaresApi(82) &&
    Array.isArray(derivedValues) &&
    derivedValues.some((entry) => plainRecord(entry)?.op === "multiply")
  ) {
    return MULTIPLY_ISSUE;
  }
  // A sheet value added to an amount, 1.83: a new key on strict mechanics, inline or in a catalog file.
  if (!declaresApi(83) && carriesAmountAdd) return AMOUNT_ADD_ISSUE;
  // More derived values than an older Engine reads, 1.84: it refused a sheet with more than 60.
  if (!declaresApi(84) && Array.isArray(derivedValues) && derivedValues.length > RULESET_DERIVED_MAX_BEFORE_179) {
    return `A ruleset with more than ${RULESET_DERIVED_MAX_BEFORE_179} derived values requires schemaVersion 2 and capabilityApi 1.84 or newer`;
  }
  // A coin's name for one, 1.89: a new key on the strict currency unit.
  const currencies = plainRecord(ruleset?.items)?.currencies;
  const singular =
    Array.isArray(currencies) &&
    currencies.some((family) => {
      const units = plainRecord(family)?.units;
      return Array.isArray(units) && units.some((unit) => plainRecord(unit)?.one !== undefined);
    });
  // An item's to-hit read off its holder's sheet, 1.95: a new key on the strict to-hit.
  if (!declaresApi(95) && carriesSheetBonus) {
    return "A ruleset whose items add a bonus to hit read off their holder's sheet requires schemaVersion 2 and capabilityApi 1.95 or newer";
  }
  // Fields shown by the sheet or held to a combined maximum, 1.107: new keys on the strict step.
  const fieldsSteps = plainRecord(plainRecord(ruleset?.sheet)?.builder)?.steps;
  if (
    !declaresApi(107) &&
    Array.isArray(fieldsSteps) &&
    fieldsSteps.some((step) => {
      const fieldsStep = plainRecord(step);
      return fieldsStep?.kind === "fields" && (fieldsStep.shownWhen !== undefined || fieldsStep.total !== undefined);
    })
  ) {
    return "A ruleset whose builder steps show fields only while the sheet allows, or hold fields to a total, requires schemaVersion 2 and capabilityApi 1.107 or newer";
  }
  // Each class's spellcasting references and the builder rows that name it, 1.108.
  const abilitySources = plainRecord(combatBlock)?.abilities;
  if (
    !declaresApi(108) &&
    ((Array.isArray(fieldsSteps) && fieldsSteps.some((step) => plainRecord(step)?.stamp !== undefined)) ||
      (Array.isArray(abilitySources) && abilitySources.some((source) => plainRecord(source)?.byColumn !== undefined)))
  ) {
    return "A ruleset whose classes cast with their own spellcasting ability requires schemaVersion 2 and capabilityApi 1.108 or newer";
  }
  // Starting gear held to the sheet, 1.109: a new key on the strict step.
  if (
    !declaresApi(109) &&
    Array.isArray(fieldsSteps) &&
    fieldsSteps.some((step) => {
      const gearStep = plainRecord(step);
      return gearStep?.kind === "startingGear" && gearStep.strict !== undefined;
    })
  ) {
    return "A ruleset whose builder holds starting gear to the sheet requires schemaVersion 2 and capabilityApi 1.109 or newer";
  }
  // A skill or save choice among what is already trained, 1.105: a new key on the strict choice.
  if (
    !declaresApi(105) &&
    (carriesHeldChoices ||
      (Array.isArray(fieldsSteps) &&
        fieldsSteps.some((step) => {
          const trained = plainRecord(step);
          return (
            trained?.kind === "trained" &&
            Array.isArray(trained.choose) &&
            trained.choose.some((choice) => plainRecord(choice)?.held !== undefined)
          );
        })))
  ) {
    return "A ruleset whose skill or save choices build on training already held requires schemaVersion 2 and capabilityApi 1.105 or newer";
  }
  // A catalog entry a builder step offers only while the sheet says so, 1.99: a new key on the strict entry.
  if (!declaresApi(99) && carriesOfferedWhen) {
    return "A ruleset whose catalog entries are offered only while the sheet allows requires schemaVersion 2 and capabilityApi 1.99 or newer";
  }
  // Valued faces, open-ended rolls and unmodified faces on a summed check, 1.136.
  if (
    !declaresApi(136) &&
    (plainRecord(plainRecord(ruleset?.resolution)?.dice)?.faces !== undefined ||
      plainRecord(ruleset?.resolution)?.openEnded !== undefined ||
      plainRecord(ruleset?.resolution)?.unmodified !== undefined)
  ) {
    return "A ruleset whose dice have valued faces, roll open-ended or mark unmodified faces requires schemaVersion 2 and capabilityApi 1.136 or newer";
  }
  // A pool target read off the sheet, stances and exact faces, 1.137: new keys on the strict resolution.
  if (
    !declaresApi(137) &&
    (plainRecord(ruleset?.resolution)?.stances !== undefined ||
      plainRecord(ruleset?.resolution)?.exact !== undefined ||
      plainRecord(plainRecord(ruleset?.resolution)?.target)?.from !== undefined)
  ) {
    return "A ruleset whose pool reads its target off the sheet, counts by stance or flags exact faces requires schemaVersion 2 and capabilityApi 1.137 or newer";
  }
  // A keep-the-highest resolution kind, 1.138: a new kind in the strict union.
  if (!declaresApi(138) && plainRecord(ruleset?.resolution)?.kind === "dice-highest") {
    return "A ruleset that reads the highest die requires schemaVersion 2 and capabilityApi 1.138 or newer";
  }
  // A roll-against resolution kind, 1.139: a new kind in the strict union.
  if (!declaresApi(139) && plainRecord(ruleset?.resolution)?.kind === "roll-against") {
    return "A ruleset that rolls against the sheet's number requires schemaVersion 2 and capabilityApi 1.139 or newer";
  }
  // Narrative symbol dice, 1.141: a new kind in the strict union.
  if (!declaresApi(141) && plainRecord(ruleset?.resolution)?.kind === "symbol-pool") {
    return "A ruleset that rolls narrative symbols requires schemaVersion 2 and capabilityApi 1.141 or newer";
  }
  if (!declaresApi(143) && ruleset?.clocks !== undefined) {
    return "A ruleset with progress clocks requires schemaVersion 2 and capabilityApi 1.143 or newer";
  }
  if (!declaresApi(144) && ruleset?.party !== undefined) {
    return "A ruleset with a party sheet requires schemaVersion 2 and capabilityApi 1.144 or newer";
  }
  // Permanent sheet advancement, 1.142: a new key on the strict sheet.
  if (!declaresApi(142) && plainRecord(ruleset?.sheet)?.advancement !== undefined) {
    return "A ruleset that allows permanent sheet advancement requires schemaVersion 2 and capabilityApi 1.142 or newer";
  }
  // Full GM rules reference, 1.145: a new key on the strict ruleset.
  if (!declaresApi(145) && ruleset?.gmReference !== undefined) {
    return "A ruleset with a full GM rules reference requires schemaVersion 2 and capabilityApi 1.145 or newer";
  }
  // Minimum damage dice, 1.146: the combat block or a weapon, inline or in a catalog file.
  if (
    !declaresApi(146) &&
    (plainRecord(plainRecord(ruleset?.combat)?.damage)?.minimum !== undefined ||
      [...itemsByRef.values()].some((item) => plainRecord(plainRecord(item.attack)?.damage)?.minimum !== undefined))
  ) {
    return "A ruleset with minimum damage dice requires schemaVersion 2 and capabilityApi 1.146 or newer";
  }
  // One hit that costs the target a turn, 1.147.
  if (!declaresApi(147) && plainRecord(ruleset?.combat)?.daze !== undefined) {
    return "A ruleset whose hits daze requires schemaVersion 2 and capabilityApi 1.147 or newer";
  }
  // Only the remap key is new: the wound kind mapping itself predates 1.148.
  if (!declaresApi(148) && plainRecord(plainRecord(ruleset?.combat)?.damageKinds)?.remap !== undefined) {
    return "A ruleset whose targets remap damage kinds requires schemaVersion 2 and capabilityApi 1.148 or newer";
  }
  // Dice follow-ups, 1.149/1.150: strict keys, including per-check overrides.
  const diceResolution = plainRecord(ruleset?.resolution);
  const diceOverrides = diceResolution?.overrides;
  const diceSettings = [
    diceResolution,
    ...(Array.isArray(diceOverrides) ? diceOverrides.map((entry) => plainRecord(plainRecord(entry)?.set)) : []),
  ];
  if (!declaresApi(149) && diceSettings.some((setting) => plainRecord(setting?.dark)?.outcome !== undefined)) {
    return "A ruleset that chooses which dice decide the outcome requires schemaVersion 2 and capabilityApi 1.149 or newer";
  }
  if (!declaresApi(150) && diceSettings.some((setting) => setting?.allowOwnUpgrade !== undefined)) {
    return "A ruleset that declares own dice upgrades requires schemaVersion 2 and capabilityApi 1.150 or newer";
  }
  if (
    !declaresApi(153) &&
    (ratingBuilder?.pools !== undefined ||
      (Array.isArray(ratingBuilder?.steps) && ratingBuilder.steps.some((step) => plainRecord(step)?.kind === "spend")))
  ) {
    return "A ruleset with shared builder pools or priced purchases requires schemaVersion 2 and capabilityApi 1.153 or newer";
  }
  if (
    !declaresApi(154) &&
    Array.isArray(ratingBuilder?.steps) &&
    ratingBuilder.steps.some((step) => plainRecord(step)?.kind === "rows")
  ) {
    return "A ruleset with guided named rows requires schemaVersion 2 and capabilityApi 1.154 or newer";
  }
  // Catalog entries kept in their own files carry these keys as often as inline ones.
  const inRulesetOrCatalogs = (detect: (document: unknown) => boolean) =>
    detect(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => detect(document));
  if (!declaresApi(220) && carriesBorrowedCatalog215(ruleset)) {
    return "A ruleset with a catalog borrowed from another ruleset requires schemaVersion 2 and capabilityApi 1.220 or newer";
  }
  if (!declaresApi(219) && carriesLongAdvancement214(ruleset)) {
    return "A ruleset whose advancement allows more than 24 fields requires schemaVersion 2 and capabilityApi 1.219 or newer";
  }
  if (!declaresApi(218) && inRulesetOrCatalogs(carriesTrackCosts213)) {
    return "A roll effect that costs a list row or marks a track requires schemaVersion 2 and capabilityApi 1.218 or newer";
  }
  if (!declaresApi(217) && inRulesetOrCatalogs(carriesBestRating212)) {
    return "A roll effect that takes the best rating requires schemaVersion 2 and capabilityApi 1.217 or newer";
  }
  if (!declaresApi(216) && carriesRowDots211(ruleset)) {
    return "Row dots funded at creation requires schemaVersion 2 and capabilityApi 1.216 or newer";
  }
  if (!declaresApi(215) && inRulesetOrCatalogs(carriesItemAccess210)) {
    return "A pick that opens items without carrying them requires schemaVersion 2 and capabilityApi 1.215 or newer";
  }
  if (!declaresApi(214) && inRulesetOrCatalogs(carriesNoCancel209)) {
    return "A roll effect that switches off cancelling requires schemaVersion 2 and capabilityApi 1.214 or newer";
  }
  if (!declaresApi(213) && carriesAbilitySpecialties208(ruleset)) {
    return "A row applied by an ability requires schemaVersion 2 and capabilityApi 1.213 or newer";
  }
  if (!declaresApi(212) && carriesRowStances207(ruleset)) {
    return "A row check in a stance requires schemaVersion 2 and capabilityApi 1.212 or newer";
  }
  if (!declaresApi(211) && inRulesetOrCatalogs(carriesPartialBoosts206)) {
    return "A score choice with partial increases requires schemaVersion 2 and capabilityApi 1.211 or newer";
  }
  if (!declaresApi(210) && carriesWorkedColumns205(ruleset)) {
    return "A list column worked out from other columns requires schemaVersion 2 and capabilityApi 1.210 or newer";
  }
  if (!declaresApi(209) && carriesRollAbilities204(ruleset)) {
    return "A creation roll written to an ability requires schemaVersion 2 and capabilityApi 1.209 or newer";
  }
  if (!declaresApi(208) && carriesManyFields203(ruleset)) {
    return "A ruleset with more than 160 fields requires schemaVersion 2 and capabilityApi 1.208 or newer";
  }
  if (!declaresApi(207) && carriesUnpriced202(ruleset)) {
    return "A ruleset with unpriced spend offers requires schemaVersion 2 and capabilityApi 1.207 or newer";
  }
  if (!declaresApi(206) && carriesRowPrices201(ruleset)) {
    return "A ruleset with row prices scaled, offset or overridden requires schemaVersion 2 and capabilityApi 1.206 or newer";
  }
  if (!declaresApi(205) && inRulesetOrCatalogs(carriesRowCounts200)) {
    return "A ruleset with list sums that count rows or match a cell requires schemaVersion 2 and capabilityApi 1.205 or newer";
  }
  if (!declaresApi(164) && carriesTrades159(ruleset)) {
    return "A ruleset with two-way, owned or traded purchases requires schemaVersion 2 and capabilityApi 1.164 or newer";
  }
  if (!declaresApi(163) && carriesPartyCreation158(ruleset)) {
    return "A ruleset with shared party creation requires schemaVersion 2 and capabilityApi 1.163 or newer";
  }
  if (!declaresApi(162) && carriesCreationRolls157(ruleset)) {
    return "A ruleset with creation rolls kept with their dice requires schemaVersion 2 and capabilityApi 1.162 or newer";
  }
  if (!declaresApi(161) && carriesRowChecks156(ruleset)) {
    return "A ruleset with list rows that are checks of their own requires schemaVersion 2 and capabilityApi 1.161 or newer";
  }
  if (!declaresApi(160) && carriesProfiles155(ruleset)) {
    return "A ruleset with creation profiles or steps that read earlier phases requires schemaVersion 2 and capabilityApi 1.160 or newer";
  }
  if (!declaresApi(159) && carriesPricedChoices154(ruleset)) {
    return "A ruleset with priced builder picks or rows requires schemaVersion 2 and capabilityApi 1.159 or newer";
  }
  if (!declaresApi(158) && carriesStartingValues153(ruleset)) {
    return "A ruleset with starting values set once or read off the sheet requires schemaVersion 2 and capabilityApi 1.158 or newer";
  }
  if (!declaresApi(157) && carriesStartingCoins152(ruleset)) {
    return "A ruleset with starting coins rolled or read off the sheet requires schemaVersion 2 and capabilityApi 1.157 or newer";
  }
  if (!declaresApi(156) && carriesContextual) {
    return "A ruleset with worked-out scores or effects applied to one roll by name requires schemaVersion 2 and capabilityApi 1.156 or newer";
  }
  if (!declaresApi(155) && carriesBuilderLegality) {
    return "A ruleset with conditional builder offers, sheet-read bounds, discrete ratings, replacement pools or creation rules requires schemaVersion 2 and capabilityApi 1.155 or newer";
  }
  if (!declaresApi(152) && carriesBuilderRatings) {
    return "A ruleset with rating allocation stages, tier maps or rating grants requires schemaVersion 2 and capabilityApi 1.152 or newer";
  }
  if (!declaresApi(151) && carriesBuilderChoices) {
    return "A ruleset with counted builder choices, quotas, exclusions or conditional steps requires schemaVersion 2 and capabilityApi 1.151 or newer";
  }
  // Checks that roll their own way, 1.140: a new key on the strict resolution.
  if (!declaresApi(140) && plainRecord(ruleset?.resolution)?.overrides !== undefined) {
    return "A ruleset whose checks roll their own way requires schemaVersion 2 and capabilityApi 1.140 or newer";
  }
  // Outcome bands on a check, 1.135: a new key on the strict resolution.
  if (!declaresApi(135) && plainRecord(ruleset?.resolution)?.outcomes !== undefined) {
    return "A ruleset whose checks land in outcome bands requires schemaVersion 2 and capabilityApi 1.135 or newer";
  }
  // Ways of moving besides walking, 1.113: new keys on the strict creature and the strict economy.
  if (
    !declaresApi(113) &&
    (carriesMoveModes || plainRecord(plainRecord(ruleset?.combat)?.economy)?.movementModes !== undefined)
  ) {
    return "A ruleset whose combatants fly, swim, climb or burrow requires schemaVersion 2 and capabilityApi 1.113 or newer";
  }
  // Levels that halve the health maximum or defeat, and immunity to a track, 1.115: a new modifier
  // target and level key, and a track where a condition was the only word an immunity knew.
  if (
    !declaresApi(115) &&
    (carriesExhaustion ||
      carriesHealthMax(ruleset?.combat) ||
      (Array.isArray(plainRecord(ruleset?.combat)?.levels) &&
        (plainRecord(ruleset?.combat)!.levels as unknown[]).some((level) => plainRecord(level)?.defeats !== undefined)))
  ) {
    return "A ruleset whose levels halve the health maximum or defeat, or whose creatures are immune to a track, requires schemaVersion 2 and capabilityApi 1.115 or newer";
  }
  // Answers that stop only so high, and pools that say their level, 1.116.
  if (
    !declaresApi(116) &&
    (carriesCounterReachKeys ||
      ((plainRecord(plainRecord(ruleset?.sheet)?.live)?.pools as unknown[] | undefined) ?? []).some(
        (pool) => plainRecord(pool)?.level !== undefined,
      ))
  ) {
    return "A ruleset whose answers stop only what was paid no higher than themselves, or whose pools say their level, requires schemaVersion 2 and capabilityApi 1.116 or newer";
  }
  // Answers to named entries, answers at more than one moment, and conditions that keep an entry's
  // harm off, 1.117.
  if (
    !declaresApi(117) &&
    (carriesNamedAnswerKeys ||
      ((plainRecord(ruleset?.combat)?.conditions as unknown[] | undefined) ?? []).some(
        (condition) => plainRecord(condition)?.noDamageFrom !== undefined,
      ))
  ) {
    return "A ruleset whose answers name the entries they answer or more than one moment, or whose conditions keep an entry's harm off, requires schemaVersion 2 and capabilityApi 1.117 or newer";
  }
  // Answers to one kind of blow, or only to a source their holder sees, 1.118.
  if (!declaresApi(118) && carriesBlowNarrowingKeys) {
    return "A ruleset whose answers wait for one kind of blow, or for a source their holder sees, requires schemaVersion 2 and capabilityApi 1.118 or newer";
  }
  // Conditions that run on their source's clock, 1.119: in a catalog entry, a creature's action, a
  // contest or what a condition leaves behind.
  if (!declaresApi(119) && (carriesSourceClockKeys || carriesSourceClock(ruleset?.combat))) {
    return "A ruleset whose conditions count their rounds on the turns of whoever put them on requires schemaVersion 2 and capabilityApi 1.119 or newer";
  }
  // Conditions that hold what their holder uses over to the next turn, 1.120.
  if (
    !declaresApi(120) &&
    ((plainRecord(ruleset?.combat)?.conditions as unknown[] | undefined) ?? []).some(
      (condition) => plainRecord(condition)?.delays !== undefined,
    )
  ) {
    return "A ruleset whose conditions hold what their holder uses over to the next turn requires schemaVersion 2 and capabilityApi 1.120 or newer";
  }
  // Creatures that heal or point an action at their own side, 1.121.
  if (!declaresApi(121) && carriesCreatureHealing) {
    return "A ruleset whose creatures heal, or point an action at their own side, requires schemaVersion 2 and capabilityApi 1.121 or newer";
  }
  // Spells that leave something to strike on later turns, 1.122.
  if (!declaresApi(122) && carriesSummons) {
    return "A ruleset whose spells leave something behind that strikes on later turns requires schemaVersion 2 and capabilityApi 1.122 or newer";
  }
  // Creatures that cast without slots, 1.123.
  if (!declaresApi(123) && carriesCreatureSpellcasting) {
    return "A ruleset whose creatures cast spells without slots requires schemaVersion 2 and capabilityApi 1.123 or newer";
  }
  // Reactions that catch a fall, and conditions that let their holder land safely, 1.124.
  if (
    !declaresApi(124) &&
    (carriesFallMoments ||
      ((plainRecord(ruleset?.combat)?.conditions as unknown[] | undefined) ?? []).some(
        (condition) => plainRecord(condition)?.fallsSafely !== undefined,
      ))
  ) {
    return "A ruleset whose reactions catch a fall requires schemaVersion 2 and capabilityApi 1.124 or newer";
  }
  // Conditions that end on harm, a new save or an ally's action, 1.125.
  if (
    !declaresApi(125) &&
    ((plainRecord(ruleset?.combat)?.conditions as unknown[] | undefined) ?? []).some((condition) =>
      ["endsWhen", "saveWhenDamaged", "shakeOff"].some((key) => plainRecord(condition)?.[key] !== undefined),
    )
  ) {
    return "A ruleset whose conditions end on harm, a new save or being shaken out requires schemaVersion 2 and capabilityApi 1.125 or newer";
  }
  // Riders that need an adjacent ally without disadvantage, 1.126.
  if (!declaresApi(126) && carriesRiderNoDisadvantage) {
    return "A ruleset whose riders need an adjacent ally without disadvantage requires schemaVersion 2 and capabilityApi 1.126 or newer";
  }
  // Effects that need a sense a condition takes away, 1.127.
  if (
    !declaresApi(127) &&
    (carriesSenseNeeds ||
      ((plainRecord(ruleset?.combat)?.conditions as unknown[] | undefined) ?? []).some(
        (condition) => plainRecord(condition)?.lacks !== undefined,
      ))
  ) {
    return "A ruleset whose effects need a sense a condition can take away requires schemaVersion 2 and capabilityApi 1.127 or newer";
  }
  // Lines wider than one cell, 1.128.
  if (!declaresApi(128) && carriesLineWidth) {
    return "A ruleset whose lines are wider than one cell requires schemaVersion 2 and capabilityApi 1.128 or newer";
  }
  // Saves rolled only on damage, 1.129.
  if (!declaresApi(129) && (carriesDamageOnlySaveKeys || carriesDamageOnlySaves(ruleset?.combat))) {
    return "A ruleset whose saves are rolled only on damage requires schemaVersion 2 and capabilityApi 1.129 or newer";
  }
  // Builder stamps read from the offering parent pick, 1.130.
  if (
    !declaresApi(130) &&
    Array.isArray(fieldsSteps) &&
    fieldsSteps.some((step) =>
      Object.values(plainRecord(plainRecord(step)?.stamp) ?? {}).some(
        (value) => plainRecord(value)?.fromWithin !== undefined,
      ),
    )
  ) {
    return "A ruleset whose builder stamps from the offering pick requires schemaVersion 2 and capabilityApi 1.130 or newer";
  }
  // Reactions for others, at turn start, on a save, or for several fallers, 1.131.
  if (!declaresApi(131) && (carriesReactionMomentKeys || carriesReactionMoments(ruleset?.combat))) {
    return "A ruleset whose reactions answer for others, at a turn's start, on a save or for several fallers requires schemaVersion 2 and capabilityApi 1.131 or newer";
  }
  // Conditions, levels, sheet rows and item exceptions keep harm off, 1.132.
  const hideCombat = plainRecord(ruleset?.combat);
  const carriesTypedHides = ["conditions", "levels"].some((key) => {
    const entries = hideCombat?.[key];
    return (
      Array.isArray(entries) &&
      entries.some((entry) =>
        ["resist", "vulnerable", "immune", "conditionImmunities"].some(
          (kind) => plainRecord(entry)?.[kind] !== undefined,
        ),
      )
    );
  });
  const carriesItemExceptions = [...itemsByRef.values()].some((item) =>
    [
      item.worn,
      item.carried,
      ...(Array.isArray(item.requires) ? item.requires.map((need) => plainRecord(need)?.otherwise) : []),
    ].some((effect) =>
      [plainRecord(effect)?.resist, plainRecord(effect)?.immune].some(
        (entries) => Array.isArray(entries) && entries.some((entry) => plainRecord(entry) !== undefined),
      ),
    ),
  );
  if (!declaresApi(132) && (carriesTypedHides || hideCombat?.sheetHides !== undefined || carriesItemExceptions)) {
    return "A ruleset whose conditions, levels, sheet or items with exceptions keep harm off requires schemaVersion 2 and capabilityApi 1.132 or newer";
  }
  // Modifiers to damage dealt or taken, 1.133, including worn and carried items in catalog files.
  const carriesDamageModifiers = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(carriesDamageModifiers);
    const record = plainRecord(value);
    if (!record) return false;
    if (
      Array.isArray(record.modifiers) &&
      record.modifiers.some((one) => plainRecord(one)?.to === "damage" || plainRecord(one)?.to === "damage-taken")
    )
      return true;
    return Object.values(record).some(carriesDamageModifiers);
  };
  if (
    !declaresApi(133) &&
    (carriesDamageModifiers(ruleset) || [...(catalogDocuments?.values() ?? [])].some(carriesDamageModifiers))
  ) {
    return "A ruleset whose modifiers change damage requires schemaVersion 2 and capabilityApi 1.133 or newer";
  }
  // A sheet list with more than 12 columns, 1.165.
  const sheetLists = plainRecord(ruleset?.sheet)?.lists;
  if (
    !declaresApi(165) &&
    Array.isArray(sheetLists) &&
    sheetLists.some((list) => {
      const columns = plainRecord(list)?.columns;
      return Array.isArray(columns) && columns.length > 12;
    })
  ) {
    return "A ruleset with a sheet list of more than 12 columns requires schemaVersion 2 and capabilityApi 1.165 or newer";
  }
  // Mechanics offered only while the holder's sheet allows, 1.166.
  if (!declaresApi(166) && (carriesUsableWhenKeys || carriesUsableWhen(ruleset?.combat))) {
    return "A ruleset whose abilities are usable only while the sheet allows requires schemaVersion 2 and capabilityApi 1.166 or newer";
  }
  // Save modifiers narrowed by conditions, damage or magic, 1.134.
  if (
    !declaresApi(134) &&
    (carriesSaveAgainst(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSaveAgainst(document)))
  ) {
    return "A ruleset whose save modifiers count against conditions, damage or magic requires schemaVersion 2 and capabilityApi 1.134 or newer";
  }
  // Conditions applied only while the applier's sheet allows, 1.167.
  if (
    !declaresApi(167) &&
    (carriesAppliesWhen(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAppliesWhen(document)))
  ) {
    return "A ruleset whose conditions are applied only while the applier's sheet allows requires schemaVersion 2 and capabilityApi 1.167 or newer";
  }
  // Creature types and the target tests that read them, 1.168.
  if (
    !declaresApi(168) &&
    (carriesCreatureTypes(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureTypes(document)))
  ) {
    return "A ruleset with creature types or target tests requires schemaVersion 2 and capabilityApi 1.168 or newer";
  }
  // A weapon's extra damage and saves on what its hit puts on, 1.169.
  if (
    !declaresApi(169) &&
    (carriesItemAttackExtras(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemAttackExtras(document)))
  ) {
    return "A ruleset whose weapons deal extra damage or put on conditions a save resists requires schemaVersion 2 and capabilityApi 1.169 or newer";
  }
  // An item's switch and the clauses dealt while it is on, 1.170.
  if (
    !declaresApi(170) &&
    (carriesItemToggles(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemToggles(document)))
  ) {
    return "A ruleset whose items switch on and off requires schemaVersion 2 and capabilityApi 1.170 or newer";
  }
  // Pools that pay for other groups, and targets that grow with the cost, 1.171.
  if (
    !declaresApi(171) &&
    (carriesCostLadder(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCostLadder(document)))
  ) {
    return "A ruleset whose pools pay for another group or whose targets grow with the cost requires schemaVersion 2 and capabilityApi 1.171 or newer";
  }
  // Areas that stay, 1.172.
  if (
    !declaresApi(172) &&
    (carriesZones(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesZones(document)))
  ) {
    return "A ruleset with lasting zones requires schemaVersion 2 and capabilityApi 1.172 or newer";
  }
  // Areas that move, drift or make their ground hard going, 1.173.
  if (
    !declaresApi(173) &&
    (carriesMovingZones(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMovingZones(document)))
  ) {
    return "A ruleset with zones that move or change the ground requires schemaVersion 2 and capabilityApi 1.173 or newer";
  }
  // Escapes against the applier's save, zones that shake concentration or stop at a damage cap, and
  // items whose use concentrates or leaves a zone, 1.174.
  if (
    !declaresApi(174) &&
    (carriesZoneRules(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneRules(document)))
  ) {
    return "A ruleset with save escapes, concentration-breaking or capped zones, or zones on item uses requires schemaVersion 2 and capabilityApi 1.174 or newer";
  }
  // Zones that ram or hurt whom they hold, ground that costs several steps or halves speed, and
  // holds broken only by their escape DC and checks, 1.175.
  if (
    !declaresApi(175) &&
    (carriesZoneGround(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneGround(document)))
  ) {
    return "A ruleset with zones that ram or hurt whom they hold, ground that costs more or halves speed, or holds broken only by their escape DC and checks requires schemaVersion 2 and capabilityApi 1.175 or newer";
  }
  // Cures that end conditions, steady the dying or bring back the dead, 1.176.
  if (
    !declaresApi(176) &&
    (carriesCures(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCures(document)))
  ) {
    return "A ruleset with cures that end conditions, stabilize the dying or revive the dead requires schemaVersion 2 and capabilityApi 1.176 or newer";
  }
  // Square and cube areas, and walls that block or have a side, 1.177.
  if (
    !declaresApi(177) &&
    (carriesWalls(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesWalls(document)))
  ) {
    return "A ruleset with box or wall areas, or walls that block or have a side, requires schemaVersion 2 and capabilityApi 1.177 or newer";
  }
  // Senses, obscuring zones, hiding conditions, seen-only targets and area copies, 1.178.
  if (
    !declaresApi(178) &&
    (carriesSight(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesSight(document)))
  ) {
    return "A ruleset with combat senses or sight, obscuring zones, hiding conditions, targets that must be seen or areas set down several times requires schemaVersion 2 and capabilityApi 1.178 or newer";
  }
  // Components, and zones that work on whoever stands in them, stop components or ward, 1.179.
  if (
    !declaresApi(179) &&
    (carriesZoneInside(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneInside(document)))
  ) {
    return "A ruleset with combat components, or zones that work on whoever stands inside, stop components or ward off spells, requires schemaVersion 2 and capabilityApi 1.179 or newer";
  }
  // Conditions that end when their holder attacks or casts, granted senses, giving away the unseen, 1.180.
  if (
    !declaresApi(180) &&
    (carriesSightExtras(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSightExtras(document)))
  ) {
    return "A ruleset with conditions that end when their holder attacks or casts, senses given by conditions or items, conditions that give away the unseen, or item uses that cast, requires schemaVersion 2 and capabilityApi 1.180 or newer";
  }
  // Wards by base level or raised per step, save extras, creature spell components, utility uses, 1.181.
  if (
    !declaresApi(181) &&
    (carriesWardsAndSaves(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWardsAndSaves(document)))
  ) {
    return "A ruleset with wards by base level or raised by their cast, saves that say what else they are against or who passes them outright, creature spell components, or utility item uses, requires schemaVersion 2 and capabilityApi 1.181 or newer";
  }
  // Senses added to the holder's own, pushes, lines and cones carried and turned, 1.182.
  if (
    !declaresApi(182) &&
    (carriesPushAndTurn(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPushAndTurn(document)))
  ) {
    return "A ruleset with senses that add to the holder's own, actions that push, lines or cones that move with their caster and turn, or hard going only toward a caster, requires schemaVersion 2 and capabilityApi 1.182 or newer";
  }
  // Creature zones and ground, and areas until the next lair action, 1.324.
  if (
    !declaresApi(324) &&
    (carriesCreatureZones(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureZones(document)))
  ) {
    return "A ruleset with a creature action that leaves an area standing or changes the ground, or an area that lasts until the next lair action, requires schemaVersion 2 and capabilityApi 1.324 or newer";
  }
  // Creatures called into the fight, 1.325.
  if (
    !declaresApi(325) &&
    (carriesCalls(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCalls(document)))
  ) {
    return "A ruleset with a creature action that calls creatures into the fight requires schemaVersion 2 and capabilityApi 1.325 or newer";
  }
  // Drawn toward a creature, 1.326.
  if (
    !declaresApi(326) &&
    (carriesDraws(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesDraws(document)))
  ) {
    return "A ruleset with a creature action that draws whoever it lands on toward it requires schemaVersion 2 and capabilityApi 1.326 or newer";
  }
  const live = plainRecord(plainRecord(plainRecord(ruleset)?.sheet)?.live);
  const pools = new Set(
    (Array.isArray(live?.pools) ? live.pools : []).flatMap((one) => {
      const id = plainRecord(one)?.id;
      return typeof id === "string" ? [id] : [];
    }),
  );
  // A priced material, 1.790.
  if (
    !declaresApi(790) &&
    (carriesMaterial774(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMaterial774(document)))
  )
    return "A ruleset with an entry needing a priced material (material) requires schemaVersion 2 and capabilityApi 1.790 or newer";
  // A feature a rest offers, 1.789.
  if (
    !declaresApi(789) &&
    (carriesRestRecovery773(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRestRecovery773(document)))
  )
    return "A ruleset with a feature a rest offers (recovers.atRest) requires schemaVersion 2 and capabilityApi 1.789 or newer";
  // A default that waits, entries given outright, a heal outside a fight, an item's other names: 1.788.
  if (
    !declaresApi(788) &&
    (carriesAsks772(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesAsks772(document)))
  )
    return "A ruleset with a fields step's unansweredAtDefault, a grant's entries.add, a heal's outsideFight, or an item's aliases requires schemaVersion 2 and capabilityApi 1.788 or newer";
  // Dust at 0, flying-only actions, a spell after a sequence, a narrowed rescue: 1.787.
  if (
    !declaresApi(787) &&
    (carriesAsks771(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesAsks771(document)))
  )
    return "A ruleset with fellsKill, a creature action's whileFlying or castsOne, or a rescue's against requires schemaVersion 2 and capabilityApi 1.787 or newer";
  // Fight poses (who prays, who sneaks), 1.786.
  if (!declaresApi(786) && plainRecord(plainRecord(ruleset)?.combat)?.poses !== undefined)
    return "A ruleset with fight poses (combat.poses) requires schemaVersion 2 and capabilityApi 1.786 or newer";
  // Creature types that never give themselves up, 1.785.
  if (!declaresApi(785) && plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.morale)?.neverSurrender !== undefined)
    return "A ruleset with creature types that never surrender (combat.morale.neverSurrender) requires schemaVersion 2 and capabilityApi 1.785 or newer";
  // A creature that fights a side alone, 1.776.
  if (
    !declaresApi(784) &&
    (carriesHungry768(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHungry768(document)))
  )
    return 'A ruleset with a hungry creature (a behavior whose temperament is "hungry") requires schemaVersion 2 and capabilityApi 1.784 or newer';
  if (
    !declaresApi(783) &&
    (carriesHonourable767(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHonourable767(document)))
  )
    return 'A ruleset with an honourable creature (a behavior whose temperament is "honourable") requires schemaVersion 2 and capabilityApi 1.783 or newer';
  if (
    !declaresApi(782) &&
    (carriesCruel766(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCruel766(document)))
  )
    return 'A ruleset with a cruel creature (a behavior whose temperament is "cruel") requires schemaVersion 2 and capabilityApi 1.782 or newer';
  if (
    !declaresApi(781) &&
    (carriesTerritorial765(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTerritorial765(document)))
  )
    return 'A ruleset with a territorial creature (a behavior whose temperament is "territorial", or with a territory) requires schemaVersion 2 and capabilityApi 1.781 or newer';
  if (
    !declaresApi(780) &&
    (carriesArrogant764(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesArrogant764(document)))
  )
    return 'A ruleset with an arrogant creature (a behavior whose temperament is "arrogant") requires schemaVersion 2 and capabilityApi 1.780 or newer';
  if (
    !declaresApi(779) &&
    (carriesShifts763(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesShifts763(document)))
  )
    return "A ruleset with a creature whose temperament turns (a behavior's shifts) requires schemaVersion 2 and capabilityApi 1.779 or newer";
  if (
    !declaresApi(778) &&
    (carriesFanatical762(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFanatical762(document)))
  )
    return 'A ruleset with a fanatic (a behavior whose temperament is "fanatical") requires schemaVersion 2 and capabilityApi 1.778 or newer';
  if (
    !declaresApi(777) &&
    (carriesGuards761(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesGuards761(document)))
  )
    return "A ruleset with a bodyguard (a behavior's guards) requires schemaVersion 2 and capabilityApi 1.777 or newer";
  if (
    !declaresApi(776) &&
    (carriesSoloRole760(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSoloRole760(document)))
  )
    return 'A ruleset with a creature that fights a side alone (a behavior whose role is "solo") requires schemaVersion 2 and capabilityApi 1.776 or newer';
  // Losing heart when caught unaware or helpless, or half down with no losses on the other side, 1.775.
  const morale759 = plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.morale);
  if (
    !declaresApi(775) &&
    morale759 &&
    ((Array.isArray(morale759.on) && morale759.on.some((one) => one === "surprised" || one === "helpless")) ||
      morale759.halfDownUnanswered !== undefined)
  )
    return "A ruleset whose fighters lose heart when surprised or helpless (combat.morale.on), or only when half down unanswered (combat.morale.halfDownUnanswered), requires schemaVersion 2 and capabilityApi 1.775 or newer";
  // Who plays the other side of a fight, 1.774.
  if (!declaresApi(774) && plainRecord(plainRecord(ruleset)?.gm)?.opposition !== undefined)
    return "A ruleset that says who plays the other side of a fight (gm.opposition) requires schemaVersion 2 and capabilityApi 1.774 or newer";
  // A step that takes all it offers writing what it took to a field, 1.773.
  if (!declaresApi(773) && carriesTakesAllField757(ruleset))
    return "A ruleset with a builder step that takes all it offers and writes them to a field (takesAll with field) requires schemaVersion 2 and capabilityApi 1.773 or newer";
  // A catalog entry that is its group's default, 1.772.
  if (
    !declaresApi(772) &&
    (carriesExclusiveDefault756(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesExclusiveDefault756(document)))
  )
    return "A ruleset with a catalog entry that is its exclusive group's default (exclusiveDefault) requires schemaVersion 2 and capabilityApi 1.772 or newer";
  // Help against an opponent beside the helper, 1.771.
  if (!declaresApi(771) && carriesHelpBeside755(ruleset))
    return "A ruleset whose help is against an opponent beside the helper (standardEffects.help) requires schemaVersion 2 and capabilityApi 1.771 or newer";
  // Cover without the ground under the target, 1.770.
  if (!declaresApi(770) && carriesGroundUnderTarget754(ruleset))
    return "A ruleset that says whether the ground under a target gives cover (cover.groundUnderTarget) requires schemaVersion 2 and capabilityApi 1.770 or newer";
  // A catalog entry with variants, or that is one, 1.769.
  if (
    !declaresApi(769) &&
    (carriesVariants753(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesVariants753(document)))
  )
    return "A ruleset with a catalog entry that has variants (variants, variantOf) requires schemaVersion 2 and capabilityApi 1.769 or newer";
  // A builder step that marks rows already on a list, 1.767.
  if (!declaresApi(767) && carriesMarkStep751(ruleset))
    return "A ruleset with a builder step that marks rows (kind mark) requires schemaVersion 2 and capabilityApi 1.767 or newer";
  // A builder step that takes all it offers, or reads each entry's own limit, 1.766.
  if (!declaresApi(766) && carriesTakesAll750(ruleset))
    return "A ruleset with a builder step that takes all it offers (takesAll) or limits each entry by its own value (upTo.per) requires schemaVersion 2 and capabilityApi 1.766 or newer";
  // A condition that puts others on with it, 1.765.
  if (
    !declaresApi(765) &&
    (carriesAlsoApplies749(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAlsoApplies749(document)))
  )
    return "A ruleset with a condition that puts others on with it (alsoApplies) requires schemaVersion 2 and capabilityApi 1.765 or newer";
  // A zone caught only by moving into it, 1.764.
  if (
    !declaresApi(764) &&
    (carriesEnterOnlyByMoving748(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEnterOnlyByMoving748(document)))
  )
    return "A ruleset with a zone that catches only a creature moving into it (zone enterOnlyByMoving) requires schemaVersion 2 and capabilityApi 1.764 or newer";
  // How a creature goes about a fight, 1.763.
  if (
    !declaresApi(763) &&
    (carriesBehavior747(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBehavior747(document)))
  )
    return "A ruleset with how a creature goes about a fight (a behavior saying its temperament, role, targets, openers, pack or ambush) requires schemaVersion 2 and capabilityApi 1.763 or newer";
  // Losing heart, 1.762.
  if (
    !declaresApi(762) &&
    (carriesMorale746(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMorale746(document)))
  )
    return "A ruleset with losing heart in a fight (combat.morale, or a creature's morale score or leader) requires schemaVersion 2 and capabilityApi 1.762 or newer";
  // How much thought a creature puts into a fight, 1.761.
  if (
    !declaresApi(761) &&
    (carriesMinds745(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesMinds745(document)))
  )
    return "A ruleset with how much thought a creature puts into a fight (a creature's or a creature type's mind, or combat.minds) requires schemaVersion 2 and capabilityApi 1.761 or newer";
  // What is made lasting a while before it vanishes, 1.760.
  if (
    !declaresApi(760) &&
    (carriesMadeLasting744(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMadeLasting744(document)))
  )
    return "A ruleset with what is made lasting a while before it vanishes (makesItems.lasts) requires schemaVersion 2 and capabilityApi 1.760 or newer";
  // Sight through so much of each material, 1.759.
  if (
    !declaresApi(759) &&
    (carriesWallMaterials743(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWallMaterials743(document)))
  )
    return "A ruleset with sight through so much of each material (a sense's throughWalls naming materials, a wall's material, or combat.sight.boardWalls) requires schemaVersion 2 and capabilityApi 1.759 or newer";
  // A ward picked as it is cast, 1.758.
  if (
    !declaresApi(758) &&
    (carriesWardPick742(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWardPick742(document)))
  )
    return "A ruleset with a ward picked as it is cast (wardPick) requires schemaVersion 2 and capabilityApi 1.758 or newer";
  // A heal of all one is missing, 1.757.
  if (
    !declaresApi(757) &&
    (carriesHealsAll741(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealsAll741(document)))
  )
    return "A ruleset with a heal of all the health its targets are missing (healsAll) requires schemaVersion 2 and capabilityApi 1.757 or newer";
  // Wish's stress, 1.756.
  if (
    !declaresApi(756) &&
    (carriesWishStress740(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWishStress740(document)))
  )
    return "A ruleset with an ability lowered only where it is higher (atMost) or a condition's days rolled (lastsDays dice) requires schemaVersion 2 and capabilityApi 1.756 or newer";
  // Target tests of where one stands, 1.755.
  if (
    !declaresApi(755) &&
    (carriesZoneTargetTest739(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneTargetTest739(document)))
  )
    return "A ruleset with a target test of standing in a zone some entries left (insideZoneOf or outsideZoneOf) requires schemaVersion 2 and capabilityApi 1.755 or newer";
  // Creatures with more than 12 actions, 1.754.
  if (
    !declaresApi(754) &&
    (carriesManyActions738(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesManyActions738(document)))
  )
    return "A ruleset with a creature of more than 12 actions requires schemaVersion 2 and capabilityApi 1.754 or newer";
  // A zone nobody teleports into, and kinds and a damage type named as it is cast, 1.753.
  if (
    !declaresApi(753) &&
    (carriesForbiddance737(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesForbiddance737(document)))
  )
    return 'A ruleset with a zone nobody teleports into (forbids.teleport "into"), kinds its zone strikes named as it is cast (kindChoice "many") or a damage type named as it is cast (damageTypeChoice) requires schemaVersion 2 and capabilityApi 1.753 or newer';
  // Changes to checks made only for some purposes, 1.752.
  if (
    !declaresApi(752) &&
    (carriesCheckPurposes736(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCheckPurposes736(document)))
  )
    return 'A ruleset with a change to checks made only for some purposes (a modifier\'s "for") requires schemaVersion 2 and capabilityApi 1.752 or newer';
  // Conditions until midnight, and what one deals as it ends saved against for half, 1.751.
  if (
    !declaresApi(751) &&
    (carriesMidnightOrEndSave735(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMidnightOrEndSave735(document)))
  )
    return 'A ruleset with a condition lasting until midnight (lastsDays "midnight") or one whose onEnd harm is saved against (onEnd.harm.save) requires schemaVersion 2 and capabilityApi 1.751 or newer';
  // Saves made as days pass that count successes or harm on a failure, and damage kept off healing, 1.750.
  if (
    !declaresApi(750) &&
    (carriesDaySaveHarm734(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDaySaveHarm734(document)))
  )
    return 'A ruleset with a save made as days pass that counts successes or harms on a failure (saveEnds "at": "days" with successes or harmsOnFail), or a condition that keepsDamage, requires schemaVersion 2 and capabilityApi 1.750 or newer';
  // An item of only further uses, rolled for, 1.749.
  if (
    !declaresApi(749) &&
    (carriesOnlyMoreUses733(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOnlyMoreUses733(document)))
  )
    return "A ruleset with an item of only further uses, rolled for (moreUses with moreUsesRolled and no use), requires schemaVersion 2 and capabilityApi 1.749 or newer";
  // A call rolled among what it reads from a catalog, 1.748.
  if (
    !declaresApi(748) &&
    (carriesRolledFromCall732(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRolledFromCall732(document)))
  )
    return "A ruleset with a call rolled among what it reads from a catalog (calls.rolled with calls.from) requires schemaVersion 2 and capabilityApi 1.748 or newer";
  // A further use that spends another's count, 1.747.
  if (
    !declaresApi(747) &&
    (carriesUsesOf731(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUsesOf731(document)))
  )
    return "A ruleset with a further use that spends another's count (moreUses[].usesOf) requires schemaVersion 2 and capabilityApi 1.747 or newer";
  // An item whose further uses' counts are rolled for each stack, 1.746.
  if (
    !declaresApi(746) &&
    (carriesMoreUsesRolled730(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMoreUsesRolled730(document)))
  )
    return "A ruleset with an item whose further uses' counts are rolled (item.moreUsesRolled) requires schemaVersion 2 and capabilityApi 1.746 or newer";
  // An item whose use makes items, 1.745.
  if (
    !declaresApi(745) &&
    (carriesUseMakesItems729(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUseMakesItems729(document)))
  )
    return "A ruleset with an item whose use makes items (use.makesItems) requires schemaVersion 2 and capabilityApi 1.745 or newer";
  // An item that costs something used again before a rest, 1.744.
  if (
    !declaresApi(744) &&
    (carriesAgainBeforeRest728(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAgainBeforeRest728(document)))
  )
    return "A ruleset with an item that costs something used again before a rest (use.againBeforeRest) requires schemaVersion 2 and capabilityApi 1.744 or newer";
  // More senses, 1.743: an older Engine refused more than 8.
  {
    const senses = plainRecord(plainRecord(ruleset)?.combat)?.senses;
    if (!declaresApi(743) && Array.isArray(senses) && senses.length > RULESET_COMBAT_SENSES_MAX_BEFORE_1690)
      return `A ruleset with more than ${RULESET_COMBAT_SENSES_MAX_BEFORE_1690} senses (combat.senses) requires schemaVersion 2 and capabilityApi 1.743 or newer`;
  }
  // A call that ends once its creatures' counted actions are spent, 1.742.
  if (
    !declaresApi(742) &&
    (carriesCallsEndWhenSpent726(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallsEndWhenSpent726(document)))
  )
    return "A ruleset with a call that ends once its creatures' counted actions are spent (calls.endsWhenSpent) requires schemaVersion 2 and capabilityApi 1.742 or newer";
  // An area that ends as its maker is incapacitated, 1.741.
  if (
    !declaresApi(741) &&
    (carriesZoneEndsWithCaller725(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneEndsWithCaller725(document)))
  )
    return "A ruleset with an area that ends as its maker is incapacitated (zone.endsWithCaller) requires schemaVersion 2 and capabilityApi 1.741 or newer";
  // A condition put on only while its applier holds none of some on anybody, 1.740.
  if (
    !declaresApi(740) &&
    (carriesAppliesUnlessImposing724(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAppliesUnlessImposing724(document)))
  )
    return "A ruleset with a condition put on only while its applier holds none of some on anybody (applies[].unlessImposing) requires schemaVersion 2 and capabilityApi 1.740 or newer";
  // An item use whose call lends weapons while it stands, 1.739.
  if (
    !declaresApi(739) &&
    (carriesWieldsWhileCalled723(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWieldsWhileCalled723(document)))
  )
    return "A ruleset with an item use whose call lends weapons while it stands (use.wieldsWhileCalled) requires schemaVersion 2 and capabilityApi 1.739 or newer";
  // An entry's attack that rolls differently against a target that is something, 1.738.
  if (
    !declaresApi(738) &&
    (carriesEntryAgainst722(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEntryAgainst722(document)))
  )
    return "A ruleset with a catalog entry's or an item use's attack that rolls differently against some targets (mechanics.against or use.against) requires schemaVersion 2 and capabilityApi 1.738 or newer";
  // A weapon whose bonus may go to its wielder's defense, 1.737.
  if (
    !declaresApi(737) &&
    (carriesBonusToDefense721(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBonusToDefense721(document)))
  )
    return "A ruleset with a weapon whose bonus may go to its wielder's defense (attack.bonusToDefense) requires schemaVersion 2 and capabilityApi 1.737 or newer";
  // A creature's call commanded through one of its caller's actions, or ending as it is
  // incapacitated, 1.736.
  if (
    !declaresApi(736) &&
    (carriesCommandedBy720(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCommandedBy720(document)))
  )
    return "A ruleset with a creature's call commanded through one of its caller's actions or ending as its caller is incapacitated (calls.commandedBy, or calls.endsWithCaller \"incapacitated\" on a creature) requires schemaVersion 2 and capabilityApi 1.736 or newer";
  // An aura that spreads only while its holder is ridden, 1.735.
  if (
    !declaresApi(735) &&
    (carriesAuraWhileRidden719(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAuraWhileRidden719(document)))
  )
    return "A ruleset with an aura that spreads only while its holder is ridden (auras[].whileRidden) requires schemaVersion 2 and capabilityApi 1.735 or newer";
  // A condition whose holder understands every language, 1.734.
  if (
    !declaresApi(734) &&
    (carriesLanguagesUnderstands718(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLanguagesUnderstands718(document)))
  )
    return "A ruleset with a condition whose holder understands every language (languages understands) requires schemaVersion 2 and capabilityApi 1.734 or newer";
  // A catalog entry's or an item's call that ends with its caller, 1.733.
  if (
    !declaresApi(733) &&
    (carriesCallsEndWithCaller717(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallsEndWithCaller717(document)))
  )
    return "A ruleset with a catalog entry's or an item's call that ends with its caller (calls.endsWithCaller) requires schemaVersion 2 and capabilityApi 1.733 or newer";
  // What holds only while charges or uses are left, 1.732.
  if (
    !declaresApi(732) &&
    (carriesWhileLeft716(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWhileLeft716(document)))
  )
    return "A ruleset with an item's effect that holds only while charges or uses are left (whileLeft) requires schemaVersion 2 and capabilityApi 1.732 or newer";
  // A builder step's filter that is a list, 1.731.
  if (
    !declaresApi(731) &&
    (carriesStepFilterList715(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStepFilterList715(document)))
  )
    return "A ruleset with a guided-builder step's filter that lists values (steps[].filters) requires schemaVersion 2 and capabilityApi 1.731 or newer";
  // An item's use at its own level, or one that stops what it answers, 1.730.
  if (
    !declaresApi(730) &&
    (carriesItemLevel714(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemLevel714(document)))
  )
    return "A ruleset with an item's use that casts at a level (use.level) or a utility use that stops what it answers requires schemaVersion 2 and capabilityApi 1.730 or newer";
  // A wall a creature's action lays, 1.728.
  if (
    !declaresApi(728) &&
    (carriesCreatureWall712(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureWall712(document)))
  )
    return 'A ruleset with a wall a creature\'s action lays (actions[].area.shape "wall") requires schemaVersion 2 and capabilityApi 1.728 or newer';
  // A creature's action kept up on later turns, 1.727.
  if (
    !declaresApi(727) &&
    (carriesCreatureSustains711(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureSustains711(document)))
  )
    return "A ruleset with a creature's action kept up on later turns (actions[].sustains) requires schemaVersion 2 and capabilityApi 1.727 or newer";
  // A change at targets that are something, 1.726.
  if (
    !declaresApi(726) &&
    (carriesModifierAt710(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesModifierAt710(document)))
  )
    return "A ruleset with a change to its holder's attacks or damage at targets that are something (modifiers[].at) requires schemaVersion 2 and capabilityApi 1.726 or newer";
  // A leap onto whoever stands where it lands, 1.725.
  if (
    !declaresApi(725) &&
    (carriesLeapsOnto709(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLeapsOnto709(document)))
  )
    return "A ruleset with a creature's leap onto others (leapsOnto) requires schemaVersion 2 and capabilityApi 1.725 or newer";
  // A save made with the better of two, 1.724.
  if (
    !declaresApi(724) &&
    (carriesSaveOr708(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSaveOr708(document)))
  )
    return "A ruleset with a save its target may make with another (save.or) requires schemaVersion 2 and capabilityApi 1.724 or newer";
  // A carapace that turns entries back on a die, 1.723.
  if (!declaresApi(723) && carriesReflects707(ruleset))
    return "A ruleset with a condition that turns entries back on a die (combat.conditions[].reflects) requires schemaVersion 2 and capabilityApi 1.723 or newer";
  // A condition that bars rests, 1.722.
  if (!declaresApi(722) && carriesBlocksRests706(ruleset))
    return "A ruleset with a condition that bars rests (combat.conditions[].blocksRests) requires schemaVersion 2 and capabilityApi 1.722 or newer";
  // A cast that makes items, 1.721.
  if (
    !declaresApi(721) &&
    (carriesMakesItems705(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMakesItems705(document)))
  )
    return "A ruleset with an entry that makes items (makesItems) requires schemaVersion 2 and capabilityApi 1.721 or newer";
  // Knocking out with a melee blow, 1.720.
  if (!declaresApi(720) && carriesKnockOut704(ruleset))
    return "A ruleset with knocking out by a melee blow (combat.dying.knockOut) requires schemaVersion 2 and capabilityApi 1.720 or newer";
  // A sense that sees through walls, 1.719.
  if (
    !declaresApi(719) &&
    (carriesThroughWalls703(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesThroughWalls703(document)))
  )
    return "A ruleset with a sense that sees through walls (combat.senses[].throughWalls) requires schemaVersion 2 and capabilityApi 1.719 or newer";
  // A condition braced against forced movement, 1.718.
  if (
    !declaresApi(718) &&
    (carriesPushReduced702(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPushReduced702(document)))
  )
    return "A ruleset with a condition braced against being moved (pushReducedBy) requires schemaVersion 2 and capabilityApi 1.718 or newer";
  // An item worn by its holder's mount, 1.717.
  if (
    !declaresApi(717) &&
    (carriesWornByMount701(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWornByMount701(document)))
  )
    return "A ruleset with an item worn by its holder's mount (wornBy) requires schemaVersion 2 and capabilityApi 1.717 or newer";
  // A creature's own jump, 1.716.
  if (
    !declaresApi(716) &&
    (carriesCreatureJump700(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureJump700(document)))
  )
    return "A ruleset with a creature that jumps its own distance (creature.jump) requires schemaVersion 2 and capabilityApi 1.716 or newer";
  // An action offered only while its user holds nobody so, 1.715.
  if (
    !declaresApi(715) &&
    (carriesUnlessImposing699(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUnlessImposing699(document)))
  )
    return "A ruleset with an action offered only while its user holds nobody so (unlessImposing) requires schemaVersion 2 and capabilityApi 1.715 or newer";
  // A condition held only on ground it names, 1.714.
  if (
    !declaresApi(714) &&
    (carriesHeldOnGround698(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldOnGround698(document)))
  )
    return "A ruleset with a condition held only on ground it names (heldOnlyIn.ground) requires schemaVersion 2 and capabilityApi 1.714 or newer";
  // A character's tags read off several fields, 1.713.
  if (!declaresApi(713) && carriesTagsFromList697(ruleset))
    return "A ruleset that reads a character's tags off several fields (creatureTypes.tagsFrom as a list) requires schemaVersion 2 and capabilityApi 1.713 or newer";
  // A save on damage that leans, 1.712.
  if (!declaresApi(712) && carriesDamagedLean696(ruleset))
    return "A ruleset with a condition saved against on damage with a lean (saveWhenDamaged.lean) requires schemaVersion 2 and capabilityApi 1.712 or newer";
  // A target test of what is worn, or a creature's worn tags, 1.711.
  if (
    !declaresApi(711) &&
    (carriesWears695(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesWears695(document)))
  )
    return "A ruleset that tests what a target wears, or gives a creature worn tags (wears), requires schemaVersion 2 and capabilityApi 1.711 or newer";
  // The bonus-action spell rule, 1.710.
  if (!declaresApi(710) && carriesBonusSpellRule694(ruleset))
    return "A ruleset with the bonus-action spell rule (combat.casting.afterBonusSpell) requires schemaVersion 2 and capabilityApi 1.710 or newer";
  // Massive damage killing outright, 1.709.
  if (!declaresApi(709) && carriesMassiveDamage693(ruleset))
    return "A ruleset whose massive damage kills outright (combat.dying.instantDeath) requires schemaVersion 2 and capabilityApi 1.709 or newer";
  // Easy going on some tiles, or harm walking into some, 1.708.
  if (
    !declaresApi(708) &&
    (carriesGroundByTile692(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesGroundByTile692(document)))
  )
    return "A ruleset with a condition whose holder goes easily over some tiles or is harmed walking into some (easyGround or harmedEntering) requires schemaVersion 2 and capabilityApi 1.708 or newer";
  // A creature's call commanded on a budget, or striking with its caller's attack, 1.707.
  if (
    !declaresApi(707) &&
    (carriesCreatureCallCommanded691(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureCallCommanded691(document)))
  )
    return "A ruleset with a creature's call commanded on a budget or striking with its caller's attack (calls.commandedWith or calls.fromCaller on a creature) requires schemaVersion 2 and capabilityApi 1.707 or newer";
  // A switch that frees its item's slots while on, or stays on only so long, 1.706.
  if (
    !declaresApi(706) &&
    (carriesSlotsFreed690(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSlotsFreed690(document)))
  )
    return "A ruleset with an item switch that frees its slots or stays on only so long (toggle.freesSlots or toggle.rounds) requires schemaVersion 2 and capabilityApi 1.706 or newer";
  // Attacks that ignore some cover, 1.705.
  if (
    !declaresApi(705) &&
    (carriesCoverIgnored689(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCoverIgnored689(document)))
  )
    return "A ruleset with a condition whose holder's attacks ignore some cover (coverIgnored) requires schemaVersion 2 and capabilityApi 1.705 or newer";
  // Actions that never hinder a condition's holder, 1.704.
  if (
    !declaresApi(704) &&
    (carriesUnhinderedBy688(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUnhinderedBy688(document)))
  )
    return "A ruleset with a condition whose holder some actions never hinder (unhinderedBy) requires schemaVersion 2 and capabilityApi 1.704 or newer";
  // A zone moved on a check that a mover holding something does better, 1.703.
  if (
    !declaresApi(703) &&
    (carriesZoneHolding687(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneHolding687(document)))
  )
    return "A ruleset with a zone moved on a check that a mover holding something does better (zone.move.check.holding) requires schemaVersion 2 and capabilityApi 1.703 or newer";
  // An area of only the cell it is at, 1.702.
  if (
    !declaresApi(702) &&
    (carriesOneCell686(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOneCell686(document)))
  )
    return "A ruleset with an area of only the cell it is at (area.oneCell) requires schemaVersion 2 and capabilityApi 1.702 or newer";
  // An item that harms whoever it comes into the hands of, 1.701.
  if (
    !declaresApi(701) &&
    (carriesTouchHarms685(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTouchHarms685(document)))
  )
    return "A ruleset with an item that harms whoever it comes into the hands of (touchHarms) requires schemaVersion 2 and capabilityApi 1.701 or newer";
  // An item's stats added to while its wearer meets what a line asks, 1.700.
  if (
    !declaresApi(700) &&
    (carriesStatsIf684(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStatsIf684(document)))
  )
    return "A ruleset with an item's stats added to while its wearer meets what it asks (statsIf) requires schemaVersion 2 and capabilityApi 1.700 or newer";
  // Tags read off an alignment in words, 1.699.
  if (
    !declaresApi(699) &&
    (carriesAlignmentTags683(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAlignmentTags683(document)))
  )
    return "A ruleset with tags read off an alignment in words (a creature's alignment, creatureTypes.tagsFrom) requires schemaVersion 2 and capabilityApi 1.699 or newer";
  // A creature's action whose riders go only on a target that is something, 1.698.
  if (
    !declaresApi(698) &&
    (carriesRidersIs682(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRidersIs682(document)))
  )
    return "A ruleset with a creature's action whose riders go only on a target that is something (ridersIs) requires schemaVersion 2 and capabilityApi 1.698 or newer";
  // A zone keeping out more than 8 conditions, 1.697.
  if (
    !declaresApi(697) &&
    (carriesKeepsOutTwelve681(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKeepsOutTwelve681(document)))
  )
    return "A ruleset with a zone keeping out more than 8 conditions (keepsOut.cantGive, keepsOut.frees) requires schemaVersion 2 and capabilityApi 1.697 or newer";
  // A creature that goes into whom it lands on, 1.696.
  if (
    !declaresApi(696) &&
    (carriesPossesses680(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPossesses680(document)))
  )
    return "A ruleset with a creature that goes into whom it lands on (dismisses.possesses) requires schemaVersion 2 and capabilityApi 1.696 or newer";
  // A creature's action whose riders wait on a contest, 1.695.
  if (
    !declaresApi(695) &&
    (carriesCreatureContest679(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureContest679(document)))
  )
    return "A ruleset with a creature's action whose riders wait on a contest (actions[].contest) requires schemaVersion 2 and capabilityApi 1.695 or newer";
  // A zone anybody near may move on a check, 1.694.
  if (
    !declaresApi(694) &&
    (carriesZoneCheck678(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneCheck678(document)))
  )
    return "A ruleset with a zone anybody near may move on a check (zone.move.check) requires schemaVersion 2 and capabilityApi 1.694 or newer";
  // A use whose user saves against what it puts on them, 1.693.
  if (
    !declaresApi(693) &&
    (carriesSelfSave677(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSelfSave677(document)))
  )
    return "A ruleset with a use whose user saves against what it puts on them (appliesSelfSaves) requires schemaVersion 2 and capabilityApi 1.693 or newer";
  // A contest's takes picked as a mode of its own, 1.692.
  if (
    !declaresApi(692) &&
    (carriesTakesMode676(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTakesMode676(document)))
  )
    return "A ruleset with a contest whose takes is a mode of its own (contest.takesMode) requires schemaVersion 2 and capabilityApi 1.692 or newer";
  // Items asking any one of what they name, or more than 4 things, 1.691.
  if (
    !declaresApi(691) &&
    (carriesNeedsAny675(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesNeedsAny675(document)))
  )
    return "A ruleset whose items ask any one of what they name, or more than 4 things (binds.needsAny, userNeedsAny), requires schemaVersion 2 and capabilityApi 1.691 or newer";
  // A derived value read from the words of a text field, 1.690.
  if (
    !declaresApi(690) &&
    (carriesWordsTable674(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWordsTable674(document)))
  )
    return "A ruleset with a derived value read from the words of a text field (derived op wordsTable) requires schemaVersion 2 and capabilityApi 1.690 or newer";
  // Ground a careful walker crosses safely, or that stops a walk, 1.689.
  if (
    !declaresApi(689) &&
    (carriesCaltrops673(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCaltrops673(document)))
  )
    return "A ruleset with ground a careful walker crosses safely, or that stops a walk (terrain spareSlowWalkers, endsWalk) requires schemaVersion 2 and capabilityApi 1.689 or newer";
  // A condition that stabilizes its dying holder, or rest dice that heal more, 1.688.
  if (
    !declaresApi(688) &&
    (carriesWoundClosure672(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWoundClosure672(document)))
  )
    return "A ruleset with a condition that stabilizes its dying holder, or rest dice that heal more (stabilizesWhenDying, a rest's dice times) requires schemaVersion 2 and capabilityApi 1.688 or newer";
  // A creature's action whose uses each do something else, 1.687.
  if (
    !declaresApi(687) &&
    (carriesByUse671(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesByUse671(document)))
  )
    return "A ruleset with a creature's action whose uses each do something else (byUse) requires schemaVersion 2 and capabilityApi 1.687 or newer";
  // More than 12 combat checks, 1.686.
  if (!declaresApi(686) && carriesChecks16633(ruleset)) {
    return "A ruleset with more than 12 combat checks requires schemaVersion 2 and capabilityApi 1.686 or newer";
  }
  // A creature's action that sends somebody out of the fight, 1.685.
  if (
    !declaresApi(685) &&
    (carriesCreatureDismisses669(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureDismisses669(document)))
  )
    return "A ruleset with a creature's action that sends somebody, or the creature itself, out of the fight (a creature action's dismisses) requires schemaVersion 2 and capabilityApi 1.685 or newer";
  // A condition that ends when its holder is healed, 1.684.
  if (
    !declaresApi(684) &&
    (carriesEndsHealed668(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsHealed668(document)))
  )
    return "A ruleset with a condition that ends when its holder regains health (endsWhen healed, healed-by-magic) requires schemaVersion 2 and capabilityApi 1.684 or newer";
  // A condition's hits that deal damage, ask a save, or read the blow's damage type, 1.683.
  if (
    !declaresApi(683) &&
    (carriesOnHitDamage667(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOnHitDamage667(document)))
  )
    return "A ruleset with a condition whose holder's hits deal damage or ask a save (onHit damage, save, failedBy, damageTypes) requires schemaVersion 2 and capabilityApi 1.683 or newer";
  // A condition held only while an ally is seen near, 1.682.
  if (
    !declaresApi(682) &&
    (carriesAllySeen666(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAllySeen666(document)))
  )
    return "A ruleset with a condition held only while its holder sees an ally near (heldOnlyIn.allySeenWithin) requires schemaVersion 2 and capabilityApi 1.682 or newer";
  // Squeezing between walls, or moving as a smaller size, 1.681.
  if (
    !declaresApi(681) &&
    (carriesSqueezing665(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSqueezing665(document)))
  )
    return "A ruleset with squeezing, or a condition whose holder moves as a smaller size (sizes.squeezing, squeezesAs), requires schemaVersion 2 and capabilityApi 1.681 or newer";
  // A condition whose holder shares spaces, 1.680.
  if (
    !declaresApi(680) &&
    (carriesSharesSpace664(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSharesSpace664(document)))
  )
    return "A ruleset with a condition whose holder shares spaces (sharesSpace) requires schemaVersion 2 and capabilityApi 1.680 or newer";
  // Flying out of reach without drawing a strike, 1.679.
  if (
    !declaresApi(679) &&
    (carriesFlyby663(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesFlyby663(document)))
  )
    return "A ruleset with a condition whose holder flies out of reach without drawing a strike (flyby) requires schemaVersion 2 and capabilityApi 1.679 or newer";
  // A creature's slaying held to the low, or its failed save dropping to no health, 1.678.
  if (
    !declaresApi(678) &&
    (carriesCreatureSlaying662(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureSlaying662(document)))
  )
    return "A ruleset with a creature's slaying held to a health, or its failed save dropping to no health (slaysHealthAtMost, dropsOnFailedSave on a creature), requires schemaVersion 2 and capabilityApi 1.678 or newer";
  // A creature's blow that steadies or puts something on whoever it drops, 1.677.
  if (
    !declaresApi(677) &&
    (carriesOnFell661(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOnFell661(document)))
  )
    return "A ruleset with a creature's blow that does something to whoever it drops (onFell) requires schemaVersion 2 and capabilityApi 1.677 or newer";
  // A source hanging on to its holder, or a condition put on only with advantage, 1.676.
  if (
    !declaresApi(676) &&
    (carriesAttaches660(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAttaches660(document)))
  )
    return "A ruleset with a condition whose source hangs on to its holder, or one put on only by an attack with advantage (attaches, withAdvantage), requires schemaVersion 2 and capabilityApi 1.676 or newer";
  // Somebody pulled toward whoever pulls them, 1.675.
  if (
    !declaresApi(675) &&
    (carriesPull659(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesPull659(document)))
  )
    return "A ruleset that pulls somebody toward whoever pulls them (pull) requires schemaVersion 2 and capabilityApi 1.675 or newer";
  // A creature's action never used on the same creature again, 1.674.
  if (
    !declaresApi(674) &&
    (carriesCreatureOncePerTarget658(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureOncePerTarget658(document)))
  )
    return "A ruleset with a creature's action used once on each creature (oncePerTarget on a creature) requires schemaVersion 2 and capabilityApi 1.674 or newer";
  // A save failed badly on a creature's action, or by a total that low, 1.673.
  if (
    !declaresApi(673) &&
    (carriesFailedBy657(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFailedBy657(document)))
  )
    return "A ruleset with a creature's save failed by a margin, or a save failed by a total that low (save.failedBy on a creature, resultAtMost), requires schemaVersion 2 and capabilityApi 1.673 or newer";
  // Number fields held to a combined most, 1.672.
  if (!declaresApi(672) && plainRecord(plainRecord(ruleset)?.sheet)?.totals !== undefined)
    return "A ruleset whose sheet holds fields to a combined most (sheet.totals) requires schemaVersion 2 and capabilityApi 1.672 or newer";
  // A climb kept off some ground, and slippery ground, 1.671.
  if (
    !declaresApi(671) &&
    (carriesClimbNotOn655(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesClimbNotOn655(document)))
  )
    return "A ruleset with a climb kept off some ground or slippery ground (climbNotOn or terrain.slippery) requires schemaVersion 2 and capabilityApi 1.671 or newer";
  // A teleport's familiarity table, 1.670.
  if (
    !declaresApi(670) &&
    (carriesTeleportFamiliarity654(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTeleportFamiliarity654(document)))
  )
    return "A ruleset with a teleport's familiarity table (teleport.familiarity or teleport.mishap) requires schemaVersion 2 and capabilityApi 1.670 or newer";
  // A trap disarmed with a check, 1.669.
  if (
    !declaresApi(669) &&
    (carriesZoneDisarm653(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneDisarm653(document)))
  )
    return "A ruleset with traps disarmed with a check (zone.disarm or the disarm standard action) requires schemaVersion 2 and capabilityApi 1.669 or newer";
  // A contest that takes what its target holds, 1.668.
  if (
    !declaresApi(668) &&
    (carriesContestTakes652(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesContestTakes652(document)))
  )
    return "A ruleset with a contest that takes what its target holds (contest.takes) requires schemaVersion 2 and capabilityApi 1.668 or newer";
  // What an item asks of its bearer or user, or what waives it, 1.667.
  if (
    !declaresApi(667) &&
    (carriesItemNeeds651(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemNeeds651(document)))
  )
    return "A ruleset whose items ask something of their bearer or user (binds.needs, userNeeds or items.needsWaivedBy) requires schemaVersion 2 and capabilityApi 1.667 or newer";
  // A call whose creatures may ignore every order, 1.665.
  if (
    !declaresApi(665) &&
    (carriesDisobeys649(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDisobeys649(document)))
  )
    return "A ruleset with a call whose creatures may ignore every order (calls.disobeys) requires schemaVersion 2 and capabilityApi 1.665 or newer";
  // A condition an item's use puts on that lasts while the item is worn, 1.664.
  if (
    !declaresApi(664) &&
    (carriesWhileItemWorn648(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWhileItemWorn648(document)))
  )
    return "A ruleset with a condition that lasts while the item that put it on is worn (an applied condition's whileItemWorn) requires schemaVersion 2 and capabilityApi 1.664 or newer";
  // A condition that lasts a number of days, 1.663.
  if (
    !declaresApi(663) &&
    (carriesLastsDays647(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLastsDays647(document)))
  )
    return "A ruleset whose conditions last a number of days (an applied condition's lastsDays) requires schemaVersion 2 and capabilityApi 1.663 or newer";
  // A condition changing its holder's derived values, 1.662.
  if (
    !declaresApi(662) &&
    (carriesDerivedChanges646(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDerivedChanges646(document)))
  )
    return "A ruleset whose conditions change their holder's derived values (a combat condition's derivedChanges) requires schemaVersion 2 and capabilityApi 1.662 or newer";
  // A starting gear choice's option offered only to some sheets, 1.661.
  if (
    !declaresApi(661) &&
    (carriesOfferedOption645(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOfferedOption645(document)))
  )
    return "A ruleset with starting gear options offered only to some sheets (offeredWhen on a gear choice's option) requires schemaVersion 2 and capabilityApi 1.661 or newer";
  // A mount's own speed past its full-pace load, 1.660.
  if (
    !declaresApi(660) &&
    (carriesSlowedSpeed644(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSlowedSpeed644(document)))
  )
    return "A ruleset with a mount's own speed past its full-pace load (mountCarries.slowedSpeed) requires schemaVersion 2 and capabilityApi 1.660 or newer";
  // A zone sealing out gases and fog, or blocking shots from afar, 1.659.
  if (
    !declaresApi(659) &&
    (carriesSealedZone643(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSealedZone643(document)))
  )
    return "A ruleset with a zone that seals out gases and fog or blocks shots from afar (zone sealsAir, blocks ranged) requires schemaVersion 2 and capabilityApi 1.659 or newer";
  // Attacks at others near its holder made at its holder instead, 1.658.
  if (
    !declaresApi(658) &&
    (carriesDrawsAim642(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDrawsAim642(document)))
  )
    return "A ruleset with attacks drawn to whoever holds a drawsAim near their target requires schemaVersion 2 and capabilityApi 1.658 or newer";
  // Ammunition with clauses of its own on the shot it is fired as, 1.657.
  if (
    !declaresApi(657) &&
    (carriesAmmoRider641(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAmmoRider641(document)))
  )
    return "A ruleset with ammunition that adds to the shot it is fired as (item ammoRider) requires schemaVersion 2 and capabilityApi 1.657 or newer";
  // A use that gives back spent pools by itself, so many of them, 1.656.
  if (
    !declaresApi(656) &&
    (carriesRecoverCount640(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRecoverCount640(document)))
  )
    return "A ruleset whose uses give back spent pools by count (recovers.count) requires schemaVersion 2 and capabilityApi 1.656 or newer";
  // Attacks against its holder at disadvantage only from those who see them, 1.655.
  if (
    !declaresApi(655) &&
    (carriesSeenAgainst639(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSeenAgainst639(document)))
  )
    return "A ruleset with attacks against a holder at disadvantage only from those who see them (whenSeen beside attacks-against-disadvantage) requires schemaVersion 2 and capabilityApi 1.655 or newer";
  // A condition kept on only while a sheet value reads above zero, 1.653.
  if (
    !declaresApi(653) &&
    (carriesKeptWhen637(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKeptWhen637(document)))
  )
    return "A ruleset with a condition kept on only while a sheet value reads above zero (keepsOn[].when) requires schemaVersion 2 and capabilityApi 1.653 or newer";
  // A save said to be against a quality, or a modifier for such saves, 1.652.
  if (
    !declaresApi(652) &&
    (carriesSaveQualities636(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSaveQualities636(document)))
  )
    return "A ruleset with a save against a quality (save.against.qualities, a modifier's against.qualities) requires schemaVersion 2 and capabilityApi 1.652 or newer";
  // A condition that chokes its holder anywhere, or whose save waits on what they hold, 1.651.
  if (
    !declaresApi(651) &&
    (carriesChoking635(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChoking635(document)))
  )
    return "A ruleset with a condition that chokes its holder or whose save waits on what they hold (suffocates, savesUnless) requires schemaVersion 2 and capabilityApi 1.651 or newer";
  // A fall made safe only up to a height, or but for some conditions, 1.650.
  if (
    !declaresApi(650) &&
    (carriesSomeFallsSafe634(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSomeFallsSafe634(document)))
  )
    return "A ruleset with a fall made safe only up to a height (fallsSafely.upTo) requires schemaVersion 2 and capabilityApi 1.650 or newer";
  // A sense that sees things as they truly are, 1.649.
  if (
    !declaresApi(649) &&
    (carriesSeesTrue633(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSeesTrue633(document)))
  )
    return "A ruleset with a sense that sees things as they truly are (combat.senses[].seesTrue) requires schemaVersion 2 and capabilityApi 1.649 or newer";
  // A condition saying its holder understands nothing, or everything, 1.648.
  if (
    !declaresApi(648) &&
    (carriesHeldLanguages632(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldLanguages632(document)))
  )
    return "A ruleset with a condition saying what its holder understands (languages none or all) requires schemaVersion 2 and capabilityApi 1.648 or newer";
  // A condition holding its holder out of time, 1.647.
  if (
    !declaresApi(647) &&
    (carriesStasis631(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStasis631(document)))
  )
    return "A ruleset with a condition holding its holder out of time (stasis) requires schemaVersion 2 and capabilityApi 1.647 or newer";
  // Harm for casting, a condition put on by chance, or an entry stopped by name, 1.646.
  if (
    !declaresApi(646) &&
    (carriesCastingStress630(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCastingStress630(document)))
  )
    return "A ruleset with harm for casting, a condition put on by chance or an entry stopped by name (harms.at casts, applies[].chance, forbids.entries) requires schemaVersion 2 and capabilityApi 1.646 or newer";
  // A ward of only some entries, 1.645.
  if (
    !declaresApi(645) &&
    (carriesWardEntries629(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWardEntries629(document)))
  )
    return "A ruleset with a ward of only some entries (wards.where, wards.entries) requires schemaVersion 2 and capabilityApi 1.645 or newer";
  // A condition whose commands its holder may break at a cost, 1.644.
  if (
    !declaresApi(644) &&
    (carriesDefiance628(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDefiance628(document)))
  )
    return "A ruleset with a condition whose commands its holder may break at a cost (harms.at defies) requires schemaVersion 2 and capabilityApi 1.644 or newer";
  // A sequence step rolled for, made after another's hit, or left out at will, 1.643.
  if (
    !declaresApi(643) &&
    (carriesSequenceSteps627(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSequenceSteps627(document)))
  )
    return "A ruleset with a sequence step rolled for, made after another's hit or left out at will (sequence[].dice, ifHit, optional) requires schemaVersion 2 and capabilityApi 1.643 or newer";
  // A creature's spell slots, or a spell of its trait with its own numbers, 1.642.
  if (
    !declaresApi(642) &&
    (carriesInnateSlots626(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInnateSlots626(document)))
  )
    return "A ruleset with a creature's spell slots or a spell of its trait with its own numbers (spellcasting.slots, spells[].saveDifficulty) requires schemaVersion 2 and capabilityApi 1.642 or newer";
  // A mount that carries riders by weight, 1.641.
  if (
    !declaresApi(641) &&
    (carriesMountWeights625(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMountWeights625(document)))
  )
    return "A ruleset with a mount that carries riders by weight (mountCarries, mounts.weights) requires schemaVersion 2 and capabilityApi 1.641 or newer";
  // An item's use that casts other entries, 1.640.
  if (
    !declaresApi(640) &&
    (carriesItemDuplicates624(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemDuplicates624(document)))
  )
    return "A ruleset with an item use that casts other entries (use.duplicates) requires schemaVersion 2 and capabilityApi 1.640 or newer";
  // An item that adds to its holder's proficiency bonus, 1.639.
  if (
    !declaresApi(639) &&
    (carriesProficiencyBonus623(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesProficiencyBonus623(document)))
  )
    return "A ruleset with an item that adds to its holder's proficiency bonus (proficiencyBonus) requires schemaVersion 2 and capabilityApi 1.639 or newer";
  // A condition that gives way as its holder first sees somebody, 1.638.
  if (
    !declaresApi(638) &&
    (carriesFirstSeen622(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFirstSeen622(document)))
  )
    return "A ruleset with a condition that gives way as its holder first sees somebody (onFirstSeen) requires schemaVersion 2 and capabilityApi 1.638 or newer";
  // A zone lasting past 1000 rounds, closed by its caster, or spreading, 1.637.
  if (
    !declaresApi(637) &&
    (carriesLongZones621(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLongZones621(document)))
  )
    return "A ruleset with a zone lasting past 1000 rounds, closed by its caster or spreading (zone.rounds, zone.close, zone.spreads) requires schemaVersion 2 and capabilityApi 1.637 or newer";
  // A check out of a condition that spends its item or bars more tries, 1.636.
  if (
    !declaresApi(636) &&
    (carriesCheckEndsItem620(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCheckEndsItem620(document)))
  )
    return "A ruleset with a check out of a condition that spends its item or bars more tries (checkEnds.spendsItem, checkEnds.failedRetryAfter) requires schemaVersion 2 and capabilityApi 1.636 or newer";
  // A condition's harm its saves wear down, 1.635.
  if (
    !declaresApi(635) &&
    (carriesHarmDrops619(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHarmDrops619(document)))
  )
    return "A ruleset with a condition's harm its saves wear down (harms.save.drops) requires schemaVersion 2 and capabilityApi 1.635 or newer";
  // A condition's entry used at numbers of its own, 1.634.
  if (
    !declaresApi(634) &&
    (carriesFixedConditionActions618(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFixedConditionActions618(document)))
  )
    return "A ruleset with a condition's entry used at numbers of its own (actions with entry and saveDifficulty or toHit) requires schemaVersion 2 and capabilityApi 1.634 or newer";
  // A target under nobody else's control, 1.633.
  if (
    !declaresApi(633) &&
    (carriesUncontrolled617(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUncontrolled617(document)))
  )
    return "A ruleset with a target test for a creature under nobody else's control (targetTypes.uncontrolled) requires schemaVersion 2 and capabilityApi 1.633 or newer";
  // What a condition leaves behind only as it ends some ways, 1.632.
  if (
    !declaresApi(632) &&
    (carriesOnEndWhen616(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOnEndWhen616(document)))
  )
    return "A ruleset with a condition leaving something behind only as it ends some ways (onEnd.when) requires schemaVersion 2 and capabilityApi 1.632 or newer";
  // An area that pushes out whoever saved, 1.631.
  if (
    !declaresApi(631) &&
    (carriesPushesOutSaved615(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPushesOutSaved615(document)))
  )
    return "A ruleset with an area that pushes out whoever saved (pushesOutSaved) requires schemaVersion 2 and capabilityApi 1.631 or newer";
  // An item use that may backfire on its user, 1.630.
  if (
    !declaresApi(630) &&
    (carriesBackfires614(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBackfires614(document)))
  )
    return "A ruleset with an item use that may backfire on its user (use.backfires) requires schemaVersion 2 and capabilityApi 1.630 or newer";
  // Another amount dealt instead to what it names, 1.629.
  if (
    !declaresApi(629) &&
    (carriesAmountAgainst613(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAmountAgainst613(document)))
  )
    return "A ruleset with an entry dealing another amount to what it names (amountAgainst) requires schemaVersion 2 and capabilityApi 1.629 or newer";
  // An item's use that needs senses, or an entry once a target over an area, 1.628.
  if (
    !declaresApi(628) &&
    (carriesUseNeeds612(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUseNeeds612(document)))
  )
    return "A ruleset with an item use that needs senses (use.needs) or an entry once a target over an area (oncePerTarget with area) requires schemaVersion 2 and capabilityApi 1.628 or newer";
  // Away under a condition its holder may take off at will, 1.627.
  if (!declaresApi(627) && carriesAwayAtWill611(ruleset, [...(catalogDocuments?.values() ?? [])]))
    return "A ruleset that sends its holder away under a condition they may take off at will (dismisses with endable) requires schemaVersion 2 and capabilityApi 1.627 or newer";
  // A missile caught and kept, 1.626.
  if (
    !declaresApi(626) &&
    (carriesKeepsCaught610(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKeepsCaught610(document)))
  )
    return "A ruleset with a missile caught and kept (keepsCaught) requires schemaVersion 2 and capabilityApi 1.626 or newer";
  // A condition lasting its rounds a rolled number of times over, 1.625.
  if (
    !declaresApi(625) &&
    (carriesDurationTimes609(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDurationTimes609(document)))
  )
    return "A ruleset with a duration rolled in dice (duration.times) requires schemaVersion 2 and capabilityApi 1.625 or newer";
  // An item used on past its last charge, 1.624.
  if (
    !declaresApi(624) &&
    (carriesOveruse608(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOveruse608(document)))
  )
    return "A ruleset with an item used on past its last charge (charges.overuse) requires schemaVersion 2 and capabilityApi 1.624 or newer";
  // An item use whose condition lasts while the item's charges do, 1.623.
  if (
    !declaresApi(623) &&
    (carriesChargesPerRound607(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChargesPerRound607(document)))
  ) {
    return "A ruleset with an item use whose condition lasts while the item's charges do (chargesPerRound) requires schemaVersion 2 and capabilityApi 1.623 or newer";
  }
  // A condition its holder may take off at will, 1.622.
  if (
    !declaresApi(622) &&
    (carriesEndable606(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndable606(document)))
  ) {
    return "A ruleset with a condition its holder may take off at will (endable) requires schemaVersion 2 and capabilityApi 1.622 or newer";
  }
  // A call that sets down what it calls within some distance of its caller, 1.621.
  if (
    !declaresApi(621) &&
    (carriesCallWithin605(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallWithin605(document)))
  ) {
    return "A ruleset with a call that sets down what it calls within some distance of its caller (calls.within) requires schemaVersion 2 and capabilityApi 1.621 or newer";
  }
  // A call commanded only within some distance of its caller, 1.620.
  if (
    !declaresApi(620) &&
    (carriesCommandedWithin604(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCommandedWithin604(document)))
  ) {
    return "A ruleset with a call commanded only within some distance of its caller (calls.commandedWithin) requires schemaVersion 2 and capabilityApi 1.620 or newer";
  }
  // A worn item that keeps creatures of some entries off its wearer, 1.619.
  if (
    !declaresApi(619) &&
    (carriesIgnoredBy603(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesIgnoredBy603(document)))
  ) {
    return "A ruleset with an item that keeps creatures of some entries from aiming at its wearer (ignoredBy) requires schemaVersion 2 and capabilityApi 1.619 or newer";
  }
  // A lost contest's conditions, and one that ends unheard, 1.618.
  if (
    !declaresApi(618) &&
    (carriesUnswayed602(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUnswayed602(document)))
  ) {
    return "A ruleset with a contest that leaves conditions on a target its user loses to (contest.onLose), or a condition that ends as its holder can't hear its source (endsWhenHolder.cantHearSource), requires schemaVersion 2 and capabilityApi 1.618 or newer";
  }
  // A use offered only while its user holds a condition, 1.617.
  if (
    !declaresApi(617) &&
    (carriesUserHolds601(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUserHolds601(document)))
  ) {
    return "A ruleset with a use offered only while its user holds a condition (userHolds), or a condition its source keeps only while holding one (endsWhenSource.lacks), requires schemaVersion 2 and capabilityApi 1.617 or newer";
  }
  // A condition put on for what was left of another, 1.616.
  if (
    !declaresApi(616) &&
    (carriesRemainingOf600(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRemainingOf600(document)))
  ) {
    return "A ruleset with a condition put on for what was left of another (duration.remainingOf) requires schemaVersion 2 and capabilityApi 1.616 or newer";
  }
  // A call whose creatures are under nobody's control, 1.615.
  if (
    !declaresApi(615) &&
    (carriesWildCall599(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWildCall599(document)))
  ) {
    return 'A ruleset with a call whose creatures are under nobody\'s control (calls.side "none", calls.tamedWhile) requires schemaVersion 2 and capabilityApi 1.615 or newer';
  }
  // A call offered only where it says, or arriving after its caller's turns, 1.614.
  if (
    !declaresApi(614) &&
    (carriesCallWhere598(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallWhere598(document)))
  ) {
    return "A ruleset with a call offered only where it says (onlyWhere), or whose creatures arrive after their caller's turns (calls.arrivesIn), requires schemaVersion 2 and capabilityApi 1.614 or newer";
  }
  // An item that becomes the creature it calls, or a dismissible catalog or item call, 1.613.
  if (
    !declaresApi(613) &&
    (carriesBecomesItem597(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBecomesItem597(document)))
  ) {
    return "A ruleset with an item that becomes the creature it calls (calls.becomesItem), or a catalog entry's or an item's call its user may send away (calls.dismissible), requires schemaVersion 2 and capabilityApi 1.613 or newer";
  }
  // An item spent as what it called dies, or a wait from its departure, 1.612.
  if (
    !declaresApi(612) &&
    (carriesDeparture596(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDeparture596(document)))
  ) {
    return "A ruleset with an item spent as what it called dies (calls.spendsItemOnDeath), a wait from a called creature's departure (recharge.after.fromDeparture) or a round's length (combat.roundSeconds) requires schemaVersion 2 and capabilityApi 1.612 or newer";
  }
  // Called creatures that come against their user unless it meets a requirement, 1.611.
  if (
    !declaresApi(611) &&
    (carriesHostileUnless595(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHostileUnless595(document)))
  ) {
    return "A ruleset whose called creatures come against their user unless it meets a requirement (calls.hostileUnless) requires schemaVersion 2 and capabilityApi 1.611 or newer";
  }
  // Called creatures leashed to their caller, or sent away on a budget of its own, 1.610.
  if (
    !declaresApi(610) &&
    (carriesCallLeash594(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallLeash594(document)))
  ) {
    return "A ruleset whose called creatures leave once their caller is too far (calls.leash), or are sent away on a budget of its own (calls.dismissible.budget), requires schemaVersion 2 and capabilityApi 1.610 or newer";
  }
  // What obscures for everybody but its caster, 1.609.
  if (
    !declaresApi(609) &&
    (carriesNotForCaster593(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesNotForCaster593(document)))
  ) {
    return "A ruleset with something that obscures for everybody but its caster (obscures.notForCaster) requires schemaVersion 2 and capabilityApi 1.609 or newer";
  }
  // A condition that ends when its holder is incapacitated, or an aura only to whom its holder sees, 1.608.
  if (
    !declaresApi(608) &&
    (carriesLeadership592(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLeadership592(document)))
  ) {
    return "A ruleset with a condition that ends when its holder is incapacitated, or an aura only its holder's seen get (endsWhenHolder.incapacitated, aura.seenByHolder), requires schemaVersion 2 and capabilityApi 1.608 or newer";
  }
  // A creature's move toward a hostile it can see, 1.607.
  if (
    !declaresApi(607) &&
    (carriesMoveToward591(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMoveToward591(document)))
  ) {
    return "A ruleset with a creature's move toward a hostile it can see (move.toward) requires schemaVersion 2 and capabilityApi 1.607 or newer";
  }
  // A creature action that is free or taken before it attacks, 1.606.
  if (
    !declaresApi(606) &&
    (carriesCreatureFree590(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureFree590(document)))
  ) {
    return "A ruleset with a creature action that is free or taken before it attacks (free, beforeAttack) requires schemaVersion 2 and capabilityApi 1.606 or newer";
  }
  // A condition that holds only in some light, 1.605.
  if (
    !declaresApi(605) &&
    (carriesHeldOnlyIn589(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldOnlyIn589(document)))
  ) {
    return "A ruleset with a condition that holds only in some light (heldOnlyIn) requires schemaVersion 2 and capabilityApi 1.605 or newer";
  }
  // An entry made again only once its target is down, 1.604.
  if (
    !declaresApi(604) &&
    (carriesAfterTargetDown588(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAfterTargetDown588(document)))
  ) {
    return "A ruleset with an entry made again only once its target is down (repeats.afterTargetDown) requires schemaVersion 2 and capabilityApi 1.604 or newer";
  }
  // A zone that lets nobody teleport out of it unsaved, 1.603.
  if (
    !declaresApi(603) &&
    (carriesTeleportSave587(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTeleportSave587(document)))
  ) {
    return "A ruleset with a zone that lets nobody teleport out of it without a save (forbids.teleport save) requires schemaVersion 2 and capabilityApi 1.603 or newer";
  }
  // A wall laid only as a ring, or a zone that blocks spells, 1.602.
  if (
    !declaresApi(602) &&
    (carriesCage586(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCage586(document)))
  ) {
    return 'A ruleset with a wall laid only as a ring (area.ringOnly) or a zone that blocks spells (zone.blocks "spells") requires schemaVersion 2 and capabilityApi 1.602 or newer';
  }
  // A behavior that keeps its condition's own actions, 1.601.
  if (
    !declaresApi(601) &&
    (carriesBehaviorActions585(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBehaviorActions585(document)))
  ) {
    return "A ruleset with a behavior that keeps its condition's own actions (behavior.actions) requires schemaVersion 2 and capabilityApi 1.601 or newer";
  }
  // A creature moved through only by the strong, or filling none of its space, 1.600.
  if (
    !declaresApi(600) &&
    (carriesPassableBy584(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPassableBy584(document)))
  ) {
    return "A ruleset with a creature moved through only by the strong or filling none of its space (passableBy, fillsSpace) requires schemaVersion 2 and capabilityApi 1.600 or newer";
  }
  // A condition that ends once its source acts again, 1.599.
  if (
    !declaresApi(599) &&
    (carriesEndsWhenSourceActs583(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsWhenSourceActs583(document)))
  ) {
    return "A ruleset with a condition that ends once its source takes another action (endsWhenSource.acts) requires schemaVersion 2 and capabilityApi 1.599 or newer";
  }
  // A contest's winner moving with the one it pushes, 1.598.
  if (
    !declaresApi(598) &&
    (carriesContestFollows582(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesContestFollows582(document)))
  ) {
    return "A ruleset with a contest whose winner moves with the one it pushes (onWin.follows) requires schemaVersion 2 and capabilityApi 1.598 or newer";
  }
  // More than 12 contests, 1.597.
  if (!declaresApi(597) && carriesContests16544(ruleset)) {
    return "A ruleset with more than 12 contests requires schemaVersion 2 and capabilityApi 1.597 or newer";
  }
  // Hanging on that ends its condition, or wards off being slain outright, 1.596.
  if (
    !declaresApi(596) &&
    (carriesDeathWard580(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDeathWard580(document)))
  ) {
    return "A ruleset with hanging on that ends its condition or wards off being slain outright (hangsOn ends, outright) requires schemaVersion 2 and capabilityApi 1.596 or newer";
  }
  // A barrier that stops reach, or ends carried over one it keeps out, 1.595.
  if (
    !declaresApi(595) &&
    (carriesReachBarrier579(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesReachBarrier579(document)))
  ) {
    return "A ruleset with a barrier that stops reach or ends as it is carried over one it keeps out (keepsOut reach, endsOnSweep) requires schemaVersion 2 and capabilityApi 1.595 or newer";
  }
  // Targets each within a distance of the first, 1.594.
  if (
    !declaresApi(594) &&
    (carriesTargetsNearFirst578(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTargetsNearFirst578(document)))
  ) {
    return "A ruleset with targets each within a distance of the first (targetsWithinFirst) requires schemaVersion 2 and capabilityApi 1.594 or newer";
  }
  // An amount times so many, or split among those caught, 1.593.
  if (
    !declaresApi(593) &&
    (carriesDividedAmount577(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDividedAmount577(document)))
  ) {
    return "A ruleset with an amount multiplied or split among those an area catches (amountTimes, dividedAmong) requires schemaVersion 2 and capabilityApi 1.593 or newer";
  }
  // An entry's save failed by a margin, 1.592.
  if (
    !declaresApi(592) &&
    (carriesEntryFailedBy576(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEntryFailedBy576(document)))
  ) {
    return "A ruleset with an entry's or item use's save failed by a margin (save.failedBy) requires schemaVersion 2 and capabilityApi 1.592 or newer";
  }
  // A rolled call kept, counted or spent, 1.591.
  if (
    !declaresApi(591) &&
    (carriesLastingRoll575(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLastingRoll575(document)))
  ) {
    return "A ruleset with a rolled call that keeps its roll, counts its uses or spends its item (keepsRoll, lifetimeUses, spendsItem, an option's rounds) requires schemaVersion 2 and capabilityApi 1.591 or newer";
  }
  // Item-paid slots held to a most, 1.590.
  if (
    !declaresApi(590) &&
    (carriesPaysSlotsMax574(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPaysSlotsMax574(document)))
  ) {
    return "A ruleset with an item whose charges pay for slots up to a most (paysSlotsMax) requires schemaVersion 2 and capabilityApi 1.590 or newer";
  }
  // Languages split out of one row, 1.589.
  if (
    !declaresApi(589) &&
    (carriesLanguageSplit573(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLanguageSplit573(document)))
  ) {
    return "A ruleset with several languages in one row (combat.languages.split) requires schemaVersion 2 and capabilityApi 1.589 or newer";
  }
  // A condition that gives cover to its source, 1.588.
  if (
    !declaresApi(588) &&
    (carriesCoverFor572(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCoverFor572(document)))
  ) {
    return "A ruleset with a condition that gives cover against its holder (coverFor) requires schemaVersion 2 and capabilityApi 1.588 or newer";
  }
  // A contest with advantage by size, or a push read off a sheet, 1.587.
  if (
    !declaresApi(587) &&
    (carriesContestReads571(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesContestReads571(document)))
  ) {
    return "A ruleset with a contest rolled with advantage by size or pushing by a sheet's value (advantageAtMostSize, onWin.pushRead) requires schemaVersion 2 and capabilityApi 1.587 or newer";
  }
  // A called creature's action that keeps its caller's number off, or grows with the call, 1.586.
  if (
    !declaresApi(586) &&
    (carriesCallerSteps570(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCallerSteps570(document)))
  ) {
    return "A ruleset with a called creature's action that keeps its caller's number off or grows with the call (callerAdds, perCallerStep) requires schemaVersion 2 and capabilityApi 1.586 or newer";
  }
  // A condition that counts as others, 1.585.
  if (
    !declaresApi(585) &&
    (carriesCountsAs569(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCountsAs569(document)))
  ) {
    return "A ruleset with a condition that counts as another (countsAs) requires schemaVersion 2 and capabilityApi 1.585 or newer";
  }
  // A condition that ends through its source, 1.584.
  if (
    !declaresApi(584) &&
    (carriesEndsWhenSource568(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsWhenSource568(document)))
  ) {
    return "A ruleset with a condition that ends when its source is stopped or unheard (endsWhenSource) requires schemaVersion 2 and capabilityApi 1.584 or newer";
  }
  // An item's use that repeats, 1.583.
  if (
    !declaresApi(583) &&
    (carriesItemRepeats567(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemRepeats567(document)))
  ) {
    return "A ruleset with an item's use made again while its user concentrates (use.repeats) requires schemaVersion 2 and capabilityApi 1.583 or newer";
  }
  // A save rolled with advantage by a target being fought, 1.582.
  if (
    !declaresApi(582) &&
    (carriesAdvantageIfFought566(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAdvantageIfFought566(document)))
  ) {
    return "A ruleset with a save rolled with advantage by a target being fought (advantageIfFought) requires schemaVersion 2 and capabilityApi 1.582 or newer";
  }
  // A zone that turns shots aside, 1.581.
  if (
    !declaresApi(581) &&
    (carriesTurnsShots565(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTurnsShots565(document)))
  ) {
    return "A ruleset with a zone that turns aside attacks from afar with weapons that are not magical (turnsShots) requires schemaVersion 2 and capabilityApi 1.581 or newer";
  }
  // A zone stage that shakes concentration or is a wind, 1.580.
  if (
    !declaresApi(580) &&
    (carriesStageWind564(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStageWind564(document)))
  ) {
    return "A ruleset with a zone stage that breaks concentration or disperses fog (stages breaksConcentration, disperses) requires schemaVersion 2 and capabilityApi 1.580 or newer";
  }
  // A zone's inside save thrown as it is cast, 1.579.
  if (
    !declaresApi(579) &&
    (carriesInsideOnCast563(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInsideOnCast563(document)))
  ) {
    return "A ruleset with a zone whose inside save is thrown as it is cast (inside.save.onCast) requires schemaVersion 2 and capabilityApi 1.579 or newer";
  }
  // A contest offered only to an actor holding certain conditions, 1.578.
  if (
    !declaresApi(578) &&
    (carriesActorHolds562(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesActorHolds562(document)))
  ) {
    return "A ruleset with a contest offered only to an actor holding a condition (actorHolds) requires schemaVersion 2 and capabilityApi 1.578 or newer";
  }
  // A condition that controls its holder, or whose source throws as its holder dies, 1.577.
  if (
    !declaresApi(577) &&
    (carriesControls561(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesControls561(document)))
  ) {
    return "A ruleset with a condition that puts its holder under its source's control (controls, holderDies) requires schemaVersion 2 and capabilityApi 1.577 or newer";
  }
  // An item found holding stored entries, 1.576.
  if (
    !declaresApi(576) &&
    (carriesStoresFound560(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStoresFound560(document)))
  ) {
    return "A ruleset with an item found holding stored entries (stores.found) requires schemaVersion 2 and capabilityApi 1.576 or newer";
  }
  // An item that changes form, 1.575.
  if (
    !declaresApi(575) &&
    (carriesItemForms559(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemForms559(document)))
  ) {
    return "A ruleset with an item that changes form (forms) requires schemaVersion 2 and capabilityApi 1.575 or newer";
  }
  // A charge followed by the charging action again, 1.574.
  if (
    !declaresApi(574) &&
    (carriesChargeThenItself558(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChargeThenItself558(document)))
  ) {
    return "A ruleset with a charge followed by the charging action again (charge then) requires schemaVersion 2 and capabilityApi 1.574 or newer";
  }
  // An item found holding a rolled count of charges, 1.573.
  if (
    !declaresApi(573) &&
    (carriesRolledCharges557(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRolledCharges557(document)))
  ) {
    return "A ruleset with an item found holding a rolled count of charges (charges.rolled) requires schemaVersion 2 and capabilityApi 1.573 or newer";
  }
  // A worn item whose charges pay for a pool group's uses, 1.572.
  if (
    !declaresApi(572) &&
    (carriesPaysSlots556(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPaysSlots556(document)))
  ) {
    return "A ruleset with an item whose charges pay for uses of a pool group (paysSlots) requires schemaVersion 2 and capabilityApi 1.572 or newer";
  }
  // What an item takes in, counted over its whole existence, 1.571.
  if (
    !declaresApi(571) &&
    (carriesAbsorbsLifetime555(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAbsorbsLifetime555(document)))
  ) {
    return "A ruleset with an item that takes in only so much over its whole existence (absorbs.lifetime) requires schemaVersion 2 and capabilityApi 1.571 or newer";
  }
  // Absorbing narrowed to seen casters, or paid for with a budget, 1.570.
  if (
    !declaresApi(570) &&
    (carriesAbsorbsSeenSpends554(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAbsorbsSeenSpends554(document)))
  ) {
    return "A ruleset with absorbing only from a seen caster or paid for with a budget (absorbs.seen, absorbs.spends) requires schemaVersion 2 and capabilityApi 1.570 or newer";
  }
  // What is stored cast by itself at a moment, 1.569.
  if (
    !declaresApi(569) &&
    (carriesStoresCastsOn553(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStoresCastsOn553(document)))
  ) {
    return "A ruleset with something stored that is cast by itself when its moment comes (stores.castsOn) requires schemaVersion 2 and capabilityApi 1.569 or newer";
  }
  // Called images rather than creatures, 1.568.
  if (
    !declaresApi(568) &&
    (carriesIllusionCalls552(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesIllusionCalls552(document)))
  ) {
    return "A ruleset with a call that makes images rather than creatures (calls.illusion) requires schemaVersion 2 and capabilityApi 1.568 or newer";
  }
  // A check mode for finding anybody but a condition's source, 1.567.
  if (
    !declaresApi(567) &&
    (carriesExceptSource551(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesExceptSource551(document)))
  ) {
    return "A ruleset with a check modifier for finding anybody but whoever put the condition on (exceptSource) requires schemaVersion 2 and capabilityApi 1.567 or newer";
  }
  // A condition that lifts its holder, 1.566.
  if (
    !declaresApi(566) &&
    (carriesLifts550(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesLifts550(document)))
  ) {
    return "A ruleset with a condition that lifts its holder into the air (lifts) requires schemaVersion 2 and capabilityApi 1.566 or newer";
  }
  // An entry won by a contest, or one that moves its target where its user picks, 1.565.
  if (
    !declaresApi(565) &&
    (carriesContestAndCarry549(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesContestAndCarry549(document)))
  ) {
    return "A ruleset with an entry won by a contest of checks or one that moves its target where its user picks (mechanics.contest, movesTarget) requires schemaVersion 2 and capabilityApi 1.565 or newer";
  }
  // Reactions narrowed by qualities or by what the one answered for holds, 1.564.
  if (
    !declaresApi(564) &&
    (carriesReactionQualities548(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesReactionQualities548(document)))
  ) {
    return "A ruleset with a reaction narrowed by qualities or by what the one it answers for holds (against.qualities, forHolds) requires schemaVersion 2 and capabilityApi 1.564 or newer";
  }
  // A heal shared out among its targets, 1.563.
  if (
    !declaresApi(563) &&
    (carriesSharedHeal547(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSharedHeal547(document)))
  ) {
    return "A ruleset with a heal shared out among its targets (sharesHeal) requires schemaVersion 2 and capabilityApi 1.563 or newer";
  }
  // Harm for attacking whoever put a condition on, 1.562.
  if (
    !declaresApi(562) &&
    (carriesDefianceHarm546(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDefianceHarm546(document)))
  ) {
    return "A ruleset with a condition that harms its holder for attacking whoever put it on (harms.at attacks-source, attacks-source-side, harms.once) requires schemaVersion 2 and capabilityApi 1.562 or newer";
  }
  // Languages and who understands whom, 1.561.
  if (
    !declaresApi(561) &&
    (carriesLanguages545(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLanguages545(document)))
  ) {
    return "A ruleset with languages read in a fight (combat.languages, a creature's languages, targetTypes.understands) requires schemaVersion 2 and capabilityApi 1.561 or newer";
  }
  // Creatures that deal double damage to objects, 1.560.
  if (
    !declaresApi(560) &&
    (carriesDoubleToObjects544(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDoubleToObjects544(document)))
  ) {
    return "A ruleset with a creature that deals double damage to objects (doubleToObjects) requires schemaVersion 2 and capabilityApi 1.560 or newer";
  }
  // Calls and item uses rolled for, 1.559.
  if (
    !declaresApi(559) &&
    (carriesRolledTables543(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRolledTables543(document)))
  ) {
    return "A ruleset with a call or an item's use rolled for (calls.rolled, useTable, rollsTable) requires schemaVersion 2 and capabilityApi 1.559 or newer";
  }
  // Creatures built from their caller or commanded by them, 1.558.
  if (
    !declaresApi(558) &&
    (carriesCommandedCalls542(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCommandedCalls542(document)))
  ) {
    return "A ruleset with creatures built from their caller or commanded by them (calls.fromCaller, calls.commandedWith) requires schemaVersion 2 and capabilityApi 1.558 or newer";
  }
  // Zones in stages, 1.557.
  if (
    !declaresApi(557) &&
    (carriesZoneStages541(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneStages541(document)))
  ) {
    return "A ruleset with a zone in stages (zone.stages) requires schemaVersion 2 and capabilityApi 1.557 or newer";
  }
  // Charges or uses back after a wait in game time, 1.556.
  if (
    !declaresApi(556) &&
    (carriesItemWaits540(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemWaits540(document)))
  ) {
    return "A ruleset whose items' charges or uses come back after a wait in game time (recharge.after) requires schemaVersion 2 and capabilityApi 1.556 or newer";
  }
  // Wall cover, only speeds, regeneration kept off, fliers and conditions held, 1.555.
  if (
    !declaresApi(555) &&
    (carriesWallCoverAndOnlySpeeds539(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWallCoverAndOnlySpeeds539(document)))
  ) {
    return "A ruleset with a wall that gives cover, speeds that are the only ones, regeneration kept off somewhere, or a target test of fliers, conditions held or alternatives (zone.cover, onlySpeeds, regenerates.notIn, flying, holding, anyOf) requires schemaVersion 2 and capabilityApi 1.555 or newer";
  }
  // Calls raised from a corpse or held to a most, 1.554.
  if (
    !declaresApi(554) &&
    (carriesCorpseCalls538(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCorpseCalls538(document)))
  ) {
    return "A ruleset with a call raised from a corpse or held to a most (calls.atCorpse, calls.atMost) requires schemaVersion 2 and capabilityApi 1.554 or newer";
  }
  // More than 320 conditions, 1.552.
  if (
    !declaresApi(552) &&
    (carriesConditions640499(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesConditions640499(document)))
  ) {
    return "A ruleset with more than 320 conditions requires schemaVersion 2 and capabilityApi 1.552 or newer";
  }
  // Held by self, 1.553.
  if (
    !declaresApi(553) &&
    (carriesHeldBySelf537(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldBySelf537(document)))
  ) {
    return "A ruleset with attacks or contests on a target held by its holder (targetHoldsFromSelf, targetHeldBySelf, onWin.both) requires schemaVersion 2 and capabilityApi 1.553 or newer";
  }
  // Weapons that corrode on hitting it, 1.551.
  if (
    !declaresApi(551) &&
    (carriesCorrodesWeapons535(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCorrodesWeapons535(document)))
  ) {
    return "A ruleset with a creature that corrodes the weapons hitting it (corrodesWeapons) requires schemaVersion 2 and capabilityApi 1.551 or newer";
  }
  // Heads that die and grow back, 1.550.
  if (
    !declaresApi(550) &&
    (carriesHeads534(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeads534(document)))
  ) {
    return "A ruleset with a creature whose heads die and grow back (heads, perHead) requires schemaVersion 2 and capabilityApi 1.550 or newer";
  }
  // Budgets back every turn, 1.549.
  if (
    !declaresApi(549) &&
    (carriesRefillsEveryTurn533(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRefillsEveryTurn533(document)))
  ) {
    return "A ruleset with a creature whose budgets come back every turn (refillsEveryTurn) requires schemaVersion 2 and capabilityApi 1.549 or newer";
  }
  // Hanging on as one of its forms, 1.548.
  if (
    !declaresApi(548) &&
    (carriesHangsOnBecomes532(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHangsOnBecomes532(document)))
  ) {
    return "A ruleset that hangs on at 1 in one of its forms (hangsOn becomes) requires schemaVersion 2 and capabilityApi 1.548 or newer";
  }
  // Actions only in a given shape, 1.547.
  if (
    !declaresApi(547) &&
    (carriesInShape531(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInShape531(document)))
  ) {
    return "A ruleset with creature actions only in a given shape (inShape) requires schemaVersion 2 and capabilityApi 1.547 or newer";
  }
  // What follows a charge, 1.546.
  if (
    !declaresApi(546) &&
    (carriesChargeThen530(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChargeThen530(document)))
  ) {
    return "A ruleset with a charge that lets another action follow (charge then) requires schemaVersion 2 and capabilityApi 1.546 or newer";
  }
  // A gnoll's Rampage, 1.545.
  if (
    !declaresApi(545) &&
    (carriesRampage529(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRampage529(document)))
  ) {
    return "A ruleset with a creature that rampages on after felling one (rampage) requires schemaVersion 2 and capabilityApi 1.545 or newer";
  }
  // Strikes at a surprised or not-yet-acted target, 1.544.
  if (
    !declaresApi(544) &&
    (carriesSurpriseStrikes528(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSurpriseStrikes528(document)))
  ) {
    return "A ruleset with attacks or damage narrowed to a surprised or not-yet-acted target (whenTarget, target-surprised, target-not-yet-acted) or hits made criticals (critical) requires schemaVersion 2 and capabilityApi 1.544 or newer";
  }
  // A golem's Berserk, 1.543.
  if (
    !declaresApi(543) &&
    (carriesBerserk527(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBerserk527(document)))
  ) {
    return "A ruleset with a low-health roll at turn start (rollsAtTurnStart), a condition sending its holder at the nearest creature (behavior nearest) or ending at full health (endsAtFullHealth) requires schemaVersion 2 and capabilityApi 1.543 or newer";
  }
  // Conditions harm puts on a creature, 1.542.
  if (
    !declaresApi(542) &&
    (carriesWhenHarmedBy526(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWhenHarmedBy526(document)))
  ) {
    return "A ruleset with a creature that harm puts conditions on (whenHarmedBy) requires schemaVersion 2 and capabilityApi 1.542 or newer";
  }
  // Damage that heals a creature instead, 1.541.
  if (
    !declaresApi(541) &&
    (carriesHealedBy525(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealedBy525(document)))
  ) {
    return "A ruleset with a creature healed by a damage type (healedBy) requires schemaVersion 2 and capabilityApi 1.541 or newer";
  }
  // A creature's burst as it dies, 1.540.
  if (
    !declaresApi(540) &&
    (carriesOnDeath524(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOnDeath524(document)))
  ) {
    return "A ruleset with a creature that bursts as it dies (onDeath) requires schemaVersion 2 and capabilityApi 1.540 or newer";
  }
  // A summons that strikes by itself, 1.539.
  if (
    !declaresApi(539) &&
    (carriesStrikingSummons523(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStrikingSummons523(document)))
  ) {
    return "A ruleset with a summons that strikes by itself as its summoner's turn starts (summons strikesAtTurnStart) requires schemaVersion 2 and capabilityApi 1.539 or newer";
  }
  // Called creatures that turn on their caller, 1.538.
  if (
    !declaresApi(538) &&
    (carriesHostileOnBreak522(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHostileOnBreak522(document)))
  ) {
    return "A ruleset with called creatures that turn on their caller when its concentration breaks (calls hostileOnBreak) requires schemaVersion 2 and capabilityApi 1.538 or newer";
  }
  // A call that grows with each step paid, 1.537.
  if (
    !declaresApi(537) &&
    (carriesSteppedCalls521(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSteppedCalls521(document)))
  ) {
    return "A ruleset with a call that grows with each step of higher cost (calls perStep, fromStep, upTo perStep) requires schemaVersion 2 and capabilityApi 1.537 or newer";
  }
  // A further use whose count is rolled, 1.536.
  if (
    !declaresApi(536) &&
    (carriesRolledUses520(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRolledUses520(document)))
  ) {
    return "A ruleset with an item's further use whose count is rolled for each item (moreUses uses rolled) requires schemaVersion 2 and capabilityApi 1.536 or newer";
  }
  // An item's use with others' effects beside it, 1.535.
  if (
    !declaresApi(535) &&
    (carriesAlongside519(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAlongside519(document)))
  ) {
    return "A ruleset with an item's use that sets off others beside it (moreUses alongside) requires schemaVersion 2 and capabilityApi 1.535 or newer";
  }
  // A weapon hit's spend with its own uses, a save, a drain or conditions alone, 1.534.
  if (
    !declaresApi(534) &&
    (carriesSpendUses518(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSpendUses518(document)))
  ) {
    return "A ruleset with a weapon hit spending its own uses, a save, a drain or only conditions (attack spends uses, save, drain) requires schemaVersion 2 and capabilityApi 1.534 or newer";
  }
  // A zone that sets aside called creatures, 1.533.
  if (
    !declaresApi(533) &&
    (carriesSetsAsideCalled517(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSetsAsideCalled517(document)))
  ) {
    return "A ruleset with a zone that sets aside creatures called into it (suppresses setsAsideCalled) requires schemaVersion 2 and capabilityApi 1.533 or newer";
  }
  // An item's use centred on its user, 1.532.
  if (
    !declaresApi(532) &&
    (carriesItemUseAround516(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemUseAround516(document)))
  ) {
    return "A ruleset with an item's use centred on its user (use area around) requires schemaVersion 2 and capabilityApi 1.532 or newer";
  }
  // A condition that may be cut away, 1.531.
  if (
    !declaresApi(531) &&
    (carriesCutFree515(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCutFree515(document)))
  ) {
    return "A ruleset whose conditions may be struck at and cut away (cutFree) requires schemaVersion 2 and capabilityApi 1.531 or newer";
  }
  // A target test with an exception, 1.530.
  if (
    !declaresApi(530) &&
    (carriesTargetExcept514(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTargetExcept514(document)))
  ) {
    return "A ruleset with a target test that excepts what it is never (targetIs except) requires schemaVersion 2 and capabilityApi 1.530 or newer";
  }
  // Walking on water, 1.529.
  if (
    !declaresApi(529) &&
    (carriesWalksOnLiquid513(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWalksOnLiquid513(document)))
  ) {
    return "A ruleset whose conditions let their holder walk on water (walksOnLiquid) requires schemaVersion 2 and capabilityApi 1.529 or newer";
  }
  // A condition held off while others hold, 1.528.
  if (
    !declaresApi(528) &&
    (carriesHeldOffWhile512(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldOffWhile512(document)))
  ) {
    return "A ruleset whose conditions are held off while their holder holds others or does what they name (heldOffWhile) requires schemaVersion 2 and capabilityApi 1.528 or newer";
  }
  // A condition answering a touch, 1.527.
  if (
    !declaresApi(527) &&
    (carriesTouches511(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTouches511(document)))
  ) {
    return "A ruleset whose conditions answer whoever touches their holder (whenHit touches) requires schemaVersion 2 and capabilityApi 1.527 or newer";
  }
  // Saves made as days pass, 1.526.
  if (
    !declaresApi(526) &&
    (carriesDaySaves510(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDaySaves510(document)))
  ) {
    return 'A ruleset with a save made as days pass (saveEnds "at": "days") requires schemaVersion 2 and capabilityApi 1.526 or newer';
  }
  // Items a condition forbids, and more than six conditions put on by the steps paid, 1.525.
  if (
    !declaresApi(525) &&
    (carriesItemsForbidOrPaidApplies509(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemsForbidOrPaidApplies509(document)))
  ) {
    return "A ruleset whose conditions forbid using items (forbids.items) or whose entries put on more than six conditions by the steps paid (paidSteps) requires schemaVersion 2 and capabilityApi 1.525 or newer";
  }
  // What an item or a creature stores to be cast later, 1.524.
  if (
    !declaresApi(524) &&
    (carriesStores508(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStores508(document)))
  ) {
    return "A ruleset whose items or creatures store entries to be cast later (stores) requires schemaVersion 2 and capabilityApi 1.524 or newer";
  }
  // What a holder turns back, and saves against what is aimed at them alone, 1.523.
  if (
    !declaresApi(523) &&
    (carriesTurns507(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesTurns507(document)))
  ) {
    return "A ruleset whose conditions or worn items turn back an entry aimed at their holder alone (turns, against.alone) requires schemaVersion 2 and capabilityApi 1.523 or newer";
  }
  // What a holder takes in, 1.522.
  if (
    !declaresApi(522) &&
    (carriesAbsorbs506(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAbsorbs506(document)))
  ) {
    return "A ruleset whose conditions or worn items take in an entry aimed at their holder alone (absorbs) requires schemaVersion 2 and capabilityApi 1.522 or newer";
  }
  // Zones that suppress magic, 1.521.
  if (
    !declaresApi(521) &&
    (carriesSuppresses505(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSuppresses505(document)))
  ) {
    return "A ruleset whose zones suppress conditions or items inside them (a zone's suppresses or forbids casts) requires schemaVersion 2 and capabilityApi 1.521 or newer";
  }
  // Conditions that ward their holders, 1.520.
  if (
    !declaresApi(520) &&
    (carriesConditionWards504(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesConditionWards504(document)))
  ) {
    return "A ruleset whose conditions ward their holders from entries of a level or lower (a condition's wards) requires schemaVersion 2 and capabilityApi 1.520 or newer";
  }
  // Further uses with their own counts, or more than 8, 1.519.
  if (
    !declaresApi(519) &&
    (carriesOwnUses503(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOwnUses503(document)))
  ) {
    return "A ruleset whose items have further uses that count their own, or more than 8 of them (moreUses uses), requires schemaVersion 2 and capabilityApi 1.519 or newer";
  }
  // Conditions anybody next to the holder may end, 1.518.
  if (
    !declaresApi(518) &&
    (carriesCheckEndsByAny502(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCheckEndsByAny502(document)))
  ) {
    return "A ruleset whose conditions anybody next to their holder may end with a check (checkEnds by any) requires schemaVersion 2 and capabilityApi 1.518 or newer";
  }
  // Conditions picked by the steps paid, 1.517.
  if (
    !declaresApi(517) &&
    (carriesPaidSteps501(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPaidSteps501(document)))
  ) {
    return "A ruleset whose entries put conditions on by the steps paid for them (an applies entry's paidSteps) requires schemaVersion 2 and capabilityApi 1.517 or newer";
  }
  // Item uses that raise abilities for good, 1.516.
  if (
    !declaresApi(516) &&
    (carriesRaises500(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRaises500(document)))
  ) {
    return "A ruleset whose items raise their user's abilities for good (an item use's raises) requires schemaVersion 2 and capabilityApi 1.516 or newer";
  }
  // Conditions that change abilities, 1.515.
  if (!declaresApi(515) && carriesConditionAbilities499(ruleset)) {
    return "A ruleset whose conditions change their holder's abilities (a combat condition's abilities) requires schemaVersion 2 and capabilityApi 1.515 or newer";
  }
  // Conditions damage stops until the holder's next turn, 1.514.
  if (!declaresApi(514) && carriesHarmStopped498(ruleset)) {
    return "A ruleset whose conditions stop working when their holder takes damage (suppressedWhenHarmed) requires schemaVersion 2 and capabilityApi 1.514 or newer";
  }
  // Items that keep conditions on or lengthen jumps, 1.513.
  if (
    !declaresApi(513) &&
    (carriesItemKeepsOn497(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemKeepsOn497(document)))
  ) {
    return "A ruleset whose items keep conditions on their holder or lengthen their jumps (an item effect's keepsOn or jumps) requires schemaVersion 2 and capabilityApi 1.513 or newer";
  }
  // Breathing only water, 1.512.
  if (!declaresApi(512) && carriesWaterOnly496(ruleset)) {
    return "A ruleset whose creatures breathe only water (underwater breath waterOnly) requires schemaVersion 2 and capabilityApi 1.512 or newer";
  }
  // Item attacks with no damage dice, and weapon conditions on any hit or ended by a check, 1.511.
  if (
    !declaresApi(511) &&
    (carriesDicelessAttack495(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDicelessAttack495(document)))
  ) {
    return "A ruleset whose items attack with no damage dice, or whose weapons put a condition on with any hit or one a check ends (an attack without damage dice, onHit atLeast 0 or checkEnds) requires schemaVersion 2 and capabilityApi 1.511 or newer";
  }
  // Critical hits on the holder made plain hits, 1.510.
  if (
    !declaresApi(510) &&
    (carriesNoCriticals494(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesNoCriticals494(document)))
  ) {
    return "A ruleset whose conditions or worn items turn critical hits on their holder into plain hits (the criticals-against-normal effect) requires schemaVersion 2 and capabilityApi 1.510 or newer";
  }
  // Stepping in front of an attack, and defense against one kind of attack, 1.509.
  if (
    !declaresApi(509) &&
    (carriesTakesAim493(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTakesAim493(document)))
  ) {
    return "A ruleset whose reactions step in front of an attack aimed at somebody else, or whose defense counts against one kind of attack (takesAim, blow on a defense modifier or an aimed moment) requires schemaVersion 2 and capabilityApi 1.509 or newer";
  }
  // Harm dealt back on a hit, a reach for it, or no save before it, 1.508.
  if (
    !declaresApi(508) &&
    (carriesHitBack492(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHitBack492(document)))
  ) {
    return "A ruleset whose conditions harm whoever hits their holder, only so near, or with no save (whenHit harms, within, or no save) requires schemaVersion 2 and capabilityApi 1.508 or newer";
  }
  // Turns in a row with time stopped, 1.507.
  if (
    !declaresApi(507) &&
    (carriesStopsTime491(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStopsTime491(document)))
  ) {
    return "A ruleset whose conditions stop time for turns in a row (a condition's stopsTime) requires schemaVersion 2 and capabilityApi 1.507 or newer";
  }
  // Off the board until the next turn, on a die as a turn ends, 1.506.
  if (
    !declaresApi(506) &&
    (carriesBlinks490(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBlinks490(document)))
  ) {
    return "A ruleset whose conditions blink their holder off the board until their next turn (a condition's blinks) requires schemaVersion 2 and capabilityApi 1.506 or newer";
  }
  // Illusory duplicates that draw attacks, 1.505.
  if (
    !declaresApi(505) &&
    (carriesDuplicates489(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDuplicates489(document)))
  ) {
    return "A ruleset whose conditions make illusory duplicates that draw attacks (a condition's duplicates) requires schemaVersion 2 and capabilityApi 1.505 or newer";
  }
  // Stopping in a foe's space and what entering one does, and landing from a fallen mount, 1.504.
  if (
    !declaresApi(504) &&
    (carriesElementalForms488(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesElementalForms488(document, 1)))
  ) {
    return "A ruleset whose combatants stop in a foe's space, harm whoever's space they enter, or land from a fallen mount (stopsInFoes, entering, mounts fall landsWith) requires schemaVersion 2 and capabilityApi 1.504 or newer";
  }
  // A condition spent by its holder's next weapon hit, or whose holder's hits put something on, 1.503.
  if (
    !declaresApi(503) &&
    (carriesOwnHit487(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOwnHit487(document)))
  ) {
    return "A ruleset whose conditions end on their holder's next hit or put something on whoever it hits (endsAfter own-hit, a condition's onHit) requires schemaVersion 2 and capabilityApi 1.503 or newer";
  }
  // A condition spent by its source's attack, or attacks at it narrowed to its source, 1.502.
  if (
    !declaresApi(502) &&
    (carriesSourceAttacked486(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSourceAttacked486(document)))
  ) {
    return "A ruleset whose conditions answer only their source's attacks (endsAfter attacked-by-source, fromSource on attacks-taken) requires schemaVersion 2 and capabilityApi 1.502 or newer";
  }
  // A condition that changes its holder's weapons, 1.501.
  if (
    !declaresApi(501) &&
    (carriesConditionWeapon485(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesConditionWeapon485(document)))
  ) {
    return "A ruleset whose conditions change their holder's weapons (a condition's weapon) requires schemaVersion 2 and capabilityApi 1.501 or newer";
  }
  // Dying rolls made as saves, and conditions on them or on healing, 1.500.
  if (
    !declaresApi(500) &&
    (carriesDeathSaves484(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDeathSaves484(document, 1)))
  ) {
    return "A ruleset whose dying rolls are saves, or whose conditions change them or healing (dying asSave, deathSaves, healedMax), requires schemaVersion 2 and capabilityApi 1.500 or newer";
  }
  // Jumping, 1.499.
  if (
    !declaresApi(499) &&
    (carriesJumping483(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesJumping483(document, 1)))
  ) {
    return "A ruleset whose combatants jump (combat jumping, a condition's jumps) requires schemaVersion 2 and capabilityApi 1.499 or newer";
  }
  // Fighting under water and holding breath, 1.498.
  if (!declaresApi(498) && carriesUnderwater482(ruleset)) {
    return "A ruleset whose fights go on under water (combat underwater) requires schemaVersion 2 and capabilityApi 1.498 or newer";
  }
  // A condition whose holder is dragged along by whoever put it on, 1.497.
  if (
    !declaresApi(497) &&
    (carriesDragged481(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDragged481(document)))
  ) {
    return "A ruleset whose conditions drag their holder along with whoever put them on (dragged) requires schemaVersion 2 and capabilityApi 1.497 or newer";
  }
  // Mounted combat, 1.496.
  if (
    !declaresApi(496) &&
    (carriesMounts480(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMounts480(document, 1)))
  ) {
    return "A ruleset whose combatants ride one another (combat mounts, mountIndependent) requires schemaVersion 2 and capabilityApi 1.496 or newer";
  }
  // Walking through creatures or solid ground, and what a crowded cell costs, 1.495.
  if (
    !declaresApi(495) &&
    (carriesPassing479(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPassing479(document)))
  ) {
    return "A ruleset whose movers walk through other creatures or solid ground (sizes passing, passesCreatures, passesObjects) requires schemaVersion 2 and capabilityApi 1.495 or newer";
  }
  // An item's use that breaks a layered wall's layer as an entry it names, 1.494.
  if (
    !declaresApi(494) &&
    (carriesEndsLayersAs478(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsLayersAs478(document)))
  ) {
    return "A ruleset whose items' uses break a layered wall's layer as an entry they name (endsLayersAs) requires schemaVersion 2 and capabilityApi 1.494 or newer";
  }
  // A row that stands for another entry than the one that writes it, 1.493.
  if (
    !declaresApi(493) &&
    (carriesStandsFor477(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStandsFor477(document)))
  ) {
    return "A ruleset whose entries write rows that stand for another entry in a fight (standsFor) requires schemaVersion 2 and capabilityApi 1.493 or newer";
  }
  // Layers that stop what passes through them, or spare those picked at cast, 1.492.
  if (
    !declaresApi(492) &&
    (carriesLayerBlocks476(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLayerBlocks476(document)))
  ) {
    return "A ruleset whose layered walls stop what passes through a layer (layer blocks) or spare those picked as they are cast (spares chosen) requires schemaVersion 2 and capabilityApi 1.492 or newer";
  }
  // An entry aimed at a layered wall to break its layer, 1.491.
  if (
    !declaresApi(491) &&
    (carriesEndsLayers475(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsLayers475(document)))
  ) {
    return "A ruleset whose entries break a layered wall's layer by being aimed at it (endsLayers) requires schemaVersion 2 and capabilityApi 1.491 or newer";
  }
  // A wall or globe of layers crossed one at a time, 1.490.
  if (
    !declaresApi(490) &&
    (carriesLayers474(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLayers474(document)))
  ) {
    return "A ruleset whose zones are layers crossed one at a time (zone layers) requires schemaVersion 2 and capabilityApi 1.490 or newer";
  }
  // Items crossing hard going freely, and conditions answering a hit by themselves, 1.489.
  if (
    !declaresApi(489) &&
    (carriesFreeActionAndFlash473(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFreeActionAndFlash473(document)))
  ) {
    return "A ruleset whose items cross hard going freely (ignoresHardGround on an item) or whose conditions answer a hit by themselves (whenHit) requires schemaVersion 2 and capabilityApi 1.489 or newer";
  }
  // An attack given up for one by a creature its maker called, 1.488.
  if (
    !declaresApi(488) &&
    (carriesLendsStrikes472(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLendsStrikes472(document)))
  ) {
    return "A ruleset whose conditions let an attack be given up for one by a called creature (lendsStrikes) requires schemaVersion 2 and capabilityApi 1.488 or newer";
  }
  // Only one's own called creature, and a call that makes its creature another type, 1.487.
  if (
    !declaresApi(487) &&
    (carriesFamiliar471(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFamiliar471(document)))
  ) {
    return "A ruleset whose entries aim only at what their user called (calledBySelf) or call a creature as another type (calls asTypes) requires schemaVersion 2 and capabilityApi 1.487 or newer";
  }
  // A walk magic may not lower, slipping free, and items keeping conditions off by who puts them on, 1.486.
  if (
    !declaresApi(486) &&
    (carriesFreedom470(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFreedom470(document)))
  ) {
    return "A ruleset whose conditions or items keep a walk from being lowered or slip free (speedKeptFrom, slipsFree, or conditionImmunitiesFrom on an item) requires schemaVersion 2 and capabilityApi 1.486 or newer";
  }
  // A duration said as "until-dispelled", 1.485.
  if (
    !declaresApi(485) &&
    (carriesUntilDispelled469(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUntilDispelled469(document)))
  ) {
    return 'A ruleset whose durations are "until-dispelled" requires schemaVersion 2 and capabilityApi 1.485 or newer';
  }
  // Items holding off a kind of condition, 1.484.
  {
    const conditionsOf = plainRecord(plainRecord(ruleset)?.combat)?.conditions;
    const kinds = new Set(
      (Array.isArray(conditionsOf) ? conditionsOf : []).flatMap((one) => {
        const named = plainRecord(one)?.kinds;
        return Array.isArray(named) ? named.map(String) : [];
      }),
    );
    if (
      !declaresApi(484) &&
      (carriesWornKindHolds468(ruleset, kinds) ||
        [...(catalogDocuments?.values() ?? [])].some((document) => carriesWornKindHolds468(document, kinds)))
    ) {
      return "A ruleset whose items hold off a kind of condition (suppresses naming a kind) requires schemaVersion 2 and capabilityApi 1.484 or newer";
    }
  }
  // Saves made as the putter's turn starts, and failures that send the holder away, 1.483.
  if (
    !declaresApi(483) &&
    (carriesSourceSaves467(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSourceSaves467(document)))
  ) {
    return "A ruleset whose saves are made as the turn of whoever put a condition on starts, or whose failed saves send the holder away (saveEnds source-turn-start, failures dismisses), requires schemaVersion 2 and capabilityApi 1.483 or newer";
  }
  // Durations past 1000 rounds, or with no clock once paid high enough, 1.482.
  if (
    !declaresApi(482) &&
    (carriesLongDurations466(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLongDurations466(document)))
  ) {
    return "A ruleset whose durations run past 1000 rounds, or end only when dispelled once paid high enough (bySteps until-dispelled), requires schemaVersion 2 and capabilityApi 1.482 or newer";
  }
  // Senses lent to whoever put a condition on, 1.481.
  if (
    !declaresApi(481) &&
    (carriesLendsSenses465(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLendsSenses465(document)))
  ) {
    return "A ruleset whose conditions lend their holder's senses to whoever put them on (lendsSenses) requires schemaVersion 2 and capabilityApi 1.481 or newer";
  }
  // Conjured weapons gone once left lying far off, 1.480.
  if (
    !declaresApi(480) &&
    (carriesConjuredVanishes464(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesConjuredVanishes464(document)))
  ) {
    return "A ruleset whose conjured weapons are gone once left lying far off (conjures vanishes) requires schemaVersion 2 and capabilityApi 1.480 or newer";
  }
  // What an entry applies put on what it calls, and called objects with no turns, 1.479.
  if (
    !declaresApi(479) &&
    (carriesAppliesToCalled463(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAppliesToCalled463(document)))
  ) {
    return "A ruleset whose entries put what they apply on what they call, or call what takes no turns (appliesToCalled, initiative none), requires schemaVersion 2 and capabilityApi 1.479 or newer";
  }
  // Conditions held off on some terrains, 1.478.
  if (
    !declaresApi(478) &&
    (carriesOffTerrain462(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOffTerrain462(document)))
  ) {
    return "A ruleset whose conditions are held off on some terrains (whileOffTerrain) requires schemaVersion 2 and capabilityApi 1.478 or newer";
  }
  // Items that soften a fall or hold conditions off, 1.477.
  if (
    !declaresApi(477) &&
    (carriesWornFallsAndHolds461(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWornFallsAndHolds461(document)))
  ) {
    return "A ruleset whose items soften a fall or hold conditions off (fallsSafely or suppresses on an item's effect) requires schemaVersion 2 and capabilityApi 1.477 or newer";
  }
  // Conditions kept off when an entry of named catalogs would put them on, 1.476.
  if (
    !declaresApi(476) &&
    (carriesImmunityCatalogs460(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesImmunityCatalogs460(document)))
  ) {
    return "A ruleset whose conditions are kept off by the catalog of what puts them on (conditionImmunitiesFrom catalogs) requires schemaVersion 2 and capabilityApi 1.476 or newer";
  }
  // Creatures that split in two when harmed, 1.475.
  if (
    !declaresApi(475) &&
    (carriesSplits459(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSplits459(document)))
  ) {
    return "A ruleset whose creatures split in two when harmed (splits) requires schemaVersion 2 and capabilityApi 1.475 or newer";
  }
  // Entries casting other entries of a catalog, 1.474.
  if (
    !declaresApi(474) &&
    (carriesDuplicates458(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDuplicates458(document)))
  ) {
    return "A ruleset whose entries cast other entries of a catalog (duplicates) requires schemaVersion 2 and capabilityApi 1.474 or newer";
  }
  // Conditions raising their holder's health maximum, 1.473.
  if (
    !declaresApi(473) &&
    (carriesRaisesMax457(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRaisesMax457(document)))
  ) {
    return "A ruleset whose conditions raise their holder's health maximum (raisesMax) requires schemaVersion 2 and capabilityApi 1.473 or newer";
  }
  // Conditions walking their holder as they end their turn, 1.472.
  if (
    !declaresApi(472) &&
    (carriesWalksAfter456(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWalksAfter456(document)))
  ) {
    return 'A ruleset whose conditions walk their holder as they end their turn (behavior walks "after") requires schemaVersion 2 and capabilityApi 1.472 or newer';
  }
  // Damage changes counting with no attack roll too, 1.471.
  if (
    !declaresApi(471) &&
    (carriesAlsoUnrolled455(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAlsoUnrolled455(document)))
  ) {
    return "A ruleset whose damage changes count with no attack roll too (alsoUnrolled) requires schemaVersion 2 and capabilityApi 1.471 or newer";
  }
  // Durations set by the cost paid, and concentration only below a step, 1.470.
  if (
    !declaresApi(470) &&
    (carriesBySteps454(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBySteps454(document)))
  ) {
    return "A ruleset whose durations are set by the cost paid, or whose concentration holds only below a step (bySteps, concentrationBelowStep), requires schemaVersion 2 and capabilityApi 1.470 or newer";
  }
  // Entries picking one of more than six conditions, 1.469.
  if (
    !declaresApi(469) &&
    (carriesManyApplies453(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesManyApplies453(document)))
  ) {
    return "A ruleset whose entries pick one of more than six conditions (appliesOneOf) requires schemaVersion 2 and capabilityApi 1.469 or newer";
  }
  // Entries rolling a ray for each target, 1.468.
  if (
    !declaresApi(468) &&
    (carriesRays452(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesRays452(document)))
  ) {
    return "A ruleset whose entries roll a ray for each target (rays) requires schemaVersion 2 and capabilityApi 1.468 or newer";
  }
  // Zones that forbid teleporting, 1.467.
  if (
    !declaresApi(467) &&
    (carriesForbidsTeleport451(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesForbidsTeleport451(document)))
  ) {
    return "A ruleset whose zones forbid teleporting (forbids teleport) requires schemaVersion 2 and capabilityApi 1.467 or newer";
  }
  // Zones whose inside works on a kind chosen as they are cast, 1.466.
  if (
    !declaresApi(466) &&
    (carriesInsideChooses450(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInsideChooses450(document)))
  ) {
    return "A ruleset whose zones work inside on a kind chosen as they are cast (inside chooses) requires schemaVersion 2 and capabilityApi 1.466 or newer";
  }
  // Entries with no zone set up before a fight only, 1.465.
  if (
    !declaresApi(465) &&
    (carriesBeforeFightNoZone449(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBeforeFightNoZone449(document)))
  ) {
    return "A ruleset whose entries with no zone are set up before a fight only (beforeFight) requires schemaVersion 2 and capabilityApi 1.465 or newer";
  }
  // Conditions that walk their holder or are steered, 1.464.
  if (
    !declaresApi(464) &&
    (carriesSteering448(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSteering448(document)))
  ) {
    return "A ruleset whose conditions walk their holder or are steered (behavior walks, from steered, steers) requires schemaVersion 2 and capabilityApi 1.464 or newer";
  }
  // Conditions that waste a turn's budget on a failed save, 1.463.
  if (
    !declaresApi(463) &&
    (carriesWastes447(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWastes447(document)))
  ) {
    return "A ruleset whose conditions waste a turn's budget on a failed save (behavior wastes) requires schemaVersion 2 and capabilityApi 1.463 or newer";
  }
  // Entries set up before a fight only, 1.462.
  if (
    !declaresApi(462) &&
    (carriesBeforeFight446(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBeforeFight446(document)))
  ) {
    return "A ruleset whose entries are set up before a fight only (beforeFight) requires schemaVersion 2 and capabilityApi 1.462 or newer";
  }
  // Entries that take rounds to cast, 1.461.
  if (
    !declaresApi(461) &&
    (carriesCastingRounds445(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCastingRounds445(document)))
  ) {
    return "A ruleset whose entries take rounds to cast (castingRounds) requires schemaVersion 2 and capabilityApi 1.461 or newer";
  }
  // Zones whose inside works only on some, or is shrugged off with a save, 1.460.
  if (
    !declaresApi(460) &&
    (carriesInsideIsSave444(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInsideIsSave444(document)))
  ) {
    return "A ruleset whose zones work inside only on some, or are shrugged off with a save (inside is, save) requires schemaVersion 2 and capabilityApi 1.460 or newer";
  }
  // Zones that free whoever steps in, 1.459.
  if (
    !declaresApi(459) &&
    (carriesFrees443(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesFrees443(document)))
  ) {
    return "A ruleset whose zones free whoever steps in of what those they keep out put on them (keepsOut frees) requires schemaVersion 2 and capabilityApi 1.459 or newer";
  }
  // Zones that keep some kinds in and ward those outside from them, 1.458.
  if (
    !declaresApi(458) &&
    (carriesKeepsInWards442(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKeepsInWards442(document)))
  ) {
    return "A ruleset whose zones keep some kinds in and ward those outside from them (keepsOut way out) requires schemaVersion 2 and capabilityApi 1.458 or newer";
  }
  // Conditions that keep their holder from harming, or behaviors measured from a point, 1.457.
  if (
    !declaresApi(457) &&
    (carriesHarmlessOrPoint441(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHarmlessOrPoint441(document)))
  ) {
    return "A ruleset whose conditions keep their holder from harming anybody (cannot-harm) or measure a behavior from a point (from) requires schemaVersion 2 and capabilityApi 1.457 or newer";
  }
  // Zones that outlast their caster, 1.456.
  if (
    !declaresApi(456) &&
    (carriesOutlasts440(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOutlasts440(document)))
  ) {
    return "A ruleset whose zones outlast their caster (outlasts) requires schemaVersion 2 and capabilityApi 1.456 or newer";
  }
  // Zones hidden from their caster's foes, 1.455.
  if (
    !declaresApi(455) &&
    (carriesHiddenZones439(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHiddenZones439(document)))
  ) {
    return "A ruleset whose zones are hidden from their caster's foes (hidden) requires schemaVersion 2 and capabilityApi 1.455 or newer";
  }
  // Glyphs that store one of their caster's own entries, 1.454.
  if (
    !declaresApi(454) &&
    (carriesStores438(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStores438(document)))
  ) {
    return "A ruleset whose glyphs store one of their caster's own entries (detonates stores) requires schemaVersion 2 and capabilityApi 1.454 or newer";
  }
  // Zones that stay as something else once set off, 1.453.
  if (
    !declaresApi(453) &&
    (carriesBecomes437(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBecomes437(document)))
  ) {
    return "A ruleset whose zones stay as something else once set off (detonates becomes) requires schemaVersion 2 and capabilityApi 1.453 or newer";
  }
  // Zones that keep some kinds out or in, 1.452.
  if (
    !declaresApi(452) &&
    (carriesKeepsOut436(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKeepsOut436(document)))
  ) {
    return "A ruleset whose zones keep some kinds out or in (keepsOut) requires schemaVersion 2 and capabilityApi 1.452 or newer";
  }
  // Zones set off by entering them or reaching past their cells, 1.451.
  if (
    !declaresApi(451) &&
    (carriesGlyphs435(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesGlyphs435(document)))
  ) {
    return "A ruleset whose zones go off as somebody enters them or reach past their cells (detonates entered, within) requires schemaVersion 2 and capabilityApi 1.451 or newer";
  }
  // By the health its target has left, or a dismissal of only some, 1.450.
  if (
    !declaresApi(450) &&
    (carriesHealthTiers434(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealthTiers434(document)))
  ) {
    return "A ruleset whose entries act by the health their target has left (targetHealthAtMost, killsAtMost) or send away only some (dismissesIs) requires schemaVersion 2 and capabilityApi 1.450 or newer";
  }
  // Called creatures sent away as an action, 1.449.
  if (
    !declaresApi(449) &&
    (carriesDismissibleCalls433(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDismissibleCalls433(document)))
  ) {
    return "A ruleset whose creatures may send away those they called as an action (dismissible) requires schemaVersion 2 and capabilityApi 1.449 or newer";
  }
  // One of an entry's applies picked as it is used, 1.448.
  if (
    !declaresApi(448) &&
    (carriesAppliesOneOf432(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAppliesOneOf432(document)))
  ) {
    return "A ruleset whose entries put on one of their applies, picked as they are used (appliesOneOf), requires schemaVersion 2 and capabilityApi 1.448 or newer";
  }
  // A duration that grows with the cost paid, 1.447.
  if (
    !declaresApi(447) &&
    (carriesDurationPerStep431(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDurationPerStep431(document)))
  ) {
    return "A ruleset whose conditions last longer for each step of higher cost paid (perStep) requires schemaVersion 2 and capabilityApi 1.447 or newer";
  }
  // A creature's call by options, for rounds or bound to its caller, 1.446.
  if (
    !declaresApi(446) &&
    (carriesCreatureCalls430(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureCalls430(document)))
  ) {
    return "A ruleset whose creatures call others by options, for rounds or bound to their caller (calls) requires schemaVersion 2 and capabilityApi 1.446 or newer";
  }
  // Recharged after days, 1.445.
  if (!declaresApi(445) && carriesRechargeDays429(ruleset)) {
    return "A ruleset whose list rows recharge after days of game time (rechargeDays) requires schemaVersion 2 and capabilityApi 1.445 or newer";
  }
  // A presence-only sense, 1.444.
  if (
    !declaresApi(444) &&
    (carriesPresence428(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPresence428(document)))
  ) {
    return "A ruleset whose conditions sense only the presence of some kinds of creature (presence) requires schemaVersion 2 and capabilityApi 1.444 or newer";
  }
  // Conditions picked to end, 1.442.
  if (
    !declaresApi(442) &&
    (carriesEndsChosen426(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsChosen426(document)))
  ) {
    return "A ruleset whose entries let their user pick which conditions end (ends chosen) requires schemaVersion 2 and capabilityApi 1.442 or newer";
  }
  // Worked only on a roll, 1.441.
  if (
    !declaresApi(441) &&
    (carriesUseChance425(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUseChance425(document)))
  ) {
    return "A ruleset whose uses work only on a roll (chance) requires schemaVersion 2 and capabilityApi 1.441 or newer";
  }
  // Ended by gaining a condition, 1.440.
  if (
    !declaresApi(440) &&
    (carriesEndsOnGains424(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsOnGains424(document)))
  ) {
    return "A ruleset whose conditions end when their holder gains another condition (endsWhenHolder gains) requires schemaVersion 2 and capabilityApi 1.440 or newer";
  }
  // Awareness from a condition or level, or of some kinds only, 1.439.
  {
    const combat = plainRecord(plainRecord(ruleset)?.combat);
    const held = [combat?.conditions, combat?.levels].some(
      (list) => Array.isArray(list) && list.some((entry) => plainRecord(entry)?.aware !== undefined),
    );
    if (
      !declaresApi(439) &&
      (held ||
        carriesAwareOf423(ruleset) ||
        [...(catalogDocuments?.values() ?? [])].some((document) => carriesAwareOf423(document)))
    ) {
      return "A ruleset whose conditions or levels make their holder aware of the hidden, or whose awareness is of some kinds only (of) or past no total cover (uncovered), requires schemaVersion 2 and capabilityApi 1.439 or newer";
    }
  }
  // No casting or concentrating, and ended by going down, 1.438.
  if (
    !declaresApi(438) &&
    (carriesRageWays422(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRageWays422(document)))
  ) {
    return "A ruleset whose conditions stop casting from a catalog or concentrating (forbids casts, concentration) or end when their holder goes down (endsWhenHolder downed) requires schemaVersion 2 and capabilityApi 1.438 or newer";
  }
  // Narrowed to some rows, 1.437.
  if (
    !declaresApi(437) &&
    (carriesRowsWhere421(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRowsWhere421(document)))
  ) {
    return "A ruleset whose conditions or levels narrow what they keep or waive to some rows (rowsWhere) requires schemaVersion 2 and capabilityApi 1.437 or newer";
  }
  // Ended on an idle turn, 1.436.
  if (
    !declaresApi(436) &&
    (carriesEndsIdle420(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsIdle420(document)))
  ) {
    return "A ruleset whose conditions end on an idle turn (endsIdle) requires schemaVersion 2 and capabilityApi 1.436 or newer";
  }
  // Kept in any shape, and components waived, 1.435.
  if (
    !declaresApi(435) &&
    (carriesShapeKeeps419(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesShapeKeeps419(document)))
  ) {
    return "A ruleset whose conditions or levels keep actions in any shape (shapeKeeps) or waive components (waives) requires schemaVersion 2 and capabilityApi 1.435 or newer";
  }
  // A rest's named row, or a value off the sheet, 1.434.
  if (!declaresApi(434) && carriesRestRows418(ruleset)) {
    return "A ruleset whose rests give back one named row's pool (row) or only while a value off the sheet says so (when) requires schemaVersion 2 and capabilityApi 1.434 or newer";
  }
  // Far or out of sight, 1.433.
  if (
    !declaresApi(433) &&
    (carriesEndsAwayOr417(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsAwayOr417(document)))
  ) {
    return "A ruleset whose conditions end as their holder ends a turn far away or out of sight (endsAway orUnseen) requires schemaVersion 2 and capabilityApi 1.433 or newer";
  }
  // Ways over the ground, 1.432.
  if (
    !declaresApi(432) &&
    (carriesGroundWays416(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesGroundWays416(document)))
  ) {
    return "A ruleset whose conditions or levels ignore ground hard going of itself (ignoresHardGround) or run up heights and across water (runsAcross) requires schemaVersion 2 and capabilityApi 1.432 or newer";
  }
  // Kept up without concentration, and spared only on a made save, 1.431.
  if (
    !declaresApi(431) &&
    (carriesSustains415(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSustains415(document)))
  ) {
    return "A ruleset whose entries are kept up on later turns (sustains) or spare a creature only once it makes its save (oncePerTarget whenSaved) requires schemaVersion 2 and capabilityApi 1.431 or newer";
  }
  // Defense against an attacker that has hit, and opportunity attacks only, 1.430.
  if (
    !declaresApi(430) &&
    (carriesAttackerNarrowing414(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAttackerNarrowing414(document)))
  ) {
    return "A ruleset whose defense changes count only against an attacker that has hit already (afterHitBy) or whose attacks-taken changes count only on opportunity attacks (opportunity) requires schemaVersion 2 and capabilityApi 1.430 or newer";
  }
  // Choices on the sheet, and values off it added to attacks, checks and saves, 1.429.
  if (
    !declaresApi(429) &&
    (carriesSheetChoices413(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSheetChoices413(document)))
  ) {
    return "A ruleset whose changes read choices on the sheet (atTypesIn, resistIn, damageTypeIn), come once a turn or onto damage (oncePer, orDamage), narrow to proficient checks (proficient) or add a value off the sheet to attacks, checks or saves (add) requires schemaVersion 2 and capabilityApi 1.429 or newer";
  }
  // Weapon strikes over an area, and a strike again, 1.428.
  if (
    !declaresApi(428) &&
    (carriesAreaStrikes412(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAreaStrikes412(document)))
  ) {
    return "A ruleset whose entries strike with a weapon over an area (strikesWith with an area) or whose conditions or levels give a strike again near the first (strikesAgain) requires schemaVersion 2 and capabilityApi 1.428 or newer";
  }
  // Ending a picked spell, or a lasting area, 1.427.
  if (
    !declaresApi(427) &&
    (carriesEndsChoice411(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsChoice411(document)))
  ) {
    return "A ruleset whose entries end a spell their user picks (endsSpells chosen) or a lasting area (endsSpells zones) requires schemaVersion 2 and capabilityApi 1.427 or newer";
  }
  // A rest that puts a condition on, and a rule ended by attacking or casting, 1.426.
  if (!declaresApi(426) && carriesRestPuts410(ruleset)) {
    return "A ruleset whose rests put a condition on (puts) or whose conditions' rules end on their holder's attack or cast (endsWhenHolder attacks, casts) requires schemaVersion 2 and capabilityApi 1.426 or newer";
  }
  // A cast at foes, and what a sanctuary stops, 1.425.
  if (
    !declaresApi(425) &&
    (carriesFoeCasts409(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFoeCasts409(document)))
  ) {
    return "A ruleset whose conditions end only on a cast that reaches a foe (castsAtFoes) or whose sanctuaries stop only attacks or casts (sanctuary.against) requires schemaVersion 2 and capabilityApi 1.425 or newer";
  }
  // Ending what a catalog's entries put on, 1.424.
  if (
    !declaresApi(424) &&
    (carriesEndsSpells408(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEndsSpells408(document)))
  ) {
    return "A ruleset whose entries end what a catalog's entries put on (endsSpells) requires schemaVersion 2 and capabilityApi 1.424 or newer";
  }
  // A sanctuary, 1.423.
  if (!declaresApi(423) && carriesSanctuary407(ruleset)) {
    return "A ruleset whose conditions keep attacks off their holder behind a save (sanctuary) requires schemaVersion 2 and capabilityApi 1.423 or newer";
  }
  // An attacked moment and the answers to it, 1.422.
  if (
    !declaresApi(422) &&
    (carriesAttackedAnswer406(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAttackedAnswer406(document)))
  ) {
    return "A ruleset whose reactions answer an attack that is over (on attacked, missed), test whoever caused their moment (sourceIs), strike with their holder's own weapon (strikesWith) or send a missed attack elsewhere (redirects) requires schemaVersion 2 and capabilityApi 1.422 or newer";
  }
  // Healing amends, 1.421.
  if (
    !declaresApi(421) &&
    (carriesHealAmend405(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealAmend405(document)))
  ) {
    return "A ruleset whose entries amend the healing of others (healAdd) or heal their user as they heal somebody else (healsSelf) requires schemaVersion 2 and capabilityApi 1.421 or newer";
  }
  // A long range on a catalog entry, and a thrown back die, 1.420.
  if (
    !declaresApi(420) &&
    (carriesLongThrow404(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLongThrow404(document)))
  ) {
    return "A ruleset whose catalog entries carry a long range (longRange) or throw a caught missile back with a die of their own (throwsCaught die) requires schemaVersion 2 and capabilityApi 1.420 or newer";
  }
  // What untrained adds off the sheet, and an ability check's add, 1.419.
  if (!declaresApi(419) && carriesUntrainedAdd403(ruleset)) {
    return "A ruleset whose untrained skills or saves add a value off the sheet (untrained add) or whose abilities add to their checks (checkAdd) requires schemaVersion 2 and capabilityApi 1.419 or newer";
  }
  if (!declaresApi(419) && carriesManyLevels403(ruleset)) {
    return "A ruleset with more than 20 combat levels requires schemaVersion 2 and capabilityApi 1.419 or newer";
  }
  // A floor under checks, 1.418.
  if (
    !declaresApi(418) &&
    (carriesCheckFloor402(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCheckFloor402(document)))
  ) {
    return "A ruleset whose conditions or levels put a floor under their holder's checks (checkFloor) requires schemaVersion 2 and capabilityApi 1.418 or newer";
  }
  // Held off while, seen saves, no advantage against, 1.417.
  if (
    !declaresApi(417) &&
    (carriesUnseenGuard401(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUnseenGuard401(document)))
  ) {
    return "A ruleset whose conditions or levels are held off by others (notWhile), make saves only against what is seen (whenSeen), or keep advantage off attacks against them (attacks-against-no-advantage) requires schemaVersion 2 and capabilityApi 1.417 or newer";
  }
  // A missile caught and thrown back, 1.416.
  if (
    !declaresApi(416) &&
    (carriesCaught400(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCaught400(document)))
  ) {
    return "A ruleset whose reaction answers a caught missile (on caught, throwsCaught) or needs a free slot (freeSlot) requires schemaVersion 2 and capabilityApi 1.416 or newer";
  }
  // Damage or healing at its most, and backlash, 1.415.
  if (
    !declaresApi(415) &&
    (carriesMaximized399(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMaximized399(document)))
  ) {
    return "A ruleset whose entries maximize damage or healing (maximizes, maxHeal) or harm their user (backlash) requires schemaVersion 2 and capabilityApi 1.415 or newer";
  }
  // Amends and alterations by a filter, one roll's damage, half on a save, spared whole, 1.414.
  if (
    !declaresApi(414) &&
    (carriesEvocation398(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEvocation398(document)))
  ) {
    return "A ruleset whose entries amend or alter by a catalog's filter, add to one damage roll (damageOnce), leave half on a save (halfOnSave) or spare whole or by level requires schemaVersion 2 and capabilityApi 1.414 or newer";
  }
  // A damage modifier off the sheet, or on a fall, 1.413.
  if (
    !declaresApi(413) &&
    (carriesLessenedHarm397(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLessenedHarm397(document)))
  ) {
    return "A ruleset whose damage modifier adds a value off the sheet (add) or lessens a fall (falls) requires schemaVersion 2 and capabilityApi 1.413 or newer";
  }
  // Temporary points as a foe drops, 1.412.
  if (
    !declaresApi(412) &&
    (carriesFellsGrant396(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFellsGrant396(document)))
  ) {
    return "A ruleset whose condition or level grants temporary points as a foe drops (fellsGrant) requires schemaVersion 2 and capabilityApi 1.412 or newer";
  }
  // A scaled text by steps, or a pool refilled at initiative, 1.411.
  if (
    !declaresApi(411) &&
    (carriesInspiration395(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInspiration395(document)))
  ) {
    return "A ruleset whose row sets a text by steps (scaled texts) or refills a pool at initiative (mechanics.refillsAtInitiative) requires schemaVersion 2 and capabilityApi 1.411 or newer";
  }
  // Pools given back within a budget, 1.410.
  if (
    !declaresApi(410) &&
    (carriesRecovers394(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRecovers394(document)))
  ) {
    return "A ruleset whose entry gives back pools its user picks within a budget (mechanics.recovers) requires schemaVersion 2 and capabilityApi 1.410 or newer";
  }
  // Harm copied to whoever put a condition on, 1.409.
  if (
    !declaresApi(409) &&
    (carriesCopiedHarm393(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCopiedHarm393(document)))
  ) {
    return "A ruleset whose condition copies its holder's harm to whoever put it on (copiesHarmToSource) requires schemaVersion 2 and capabilityApi 1.409 or newer";
  }
  // A face rolled again, 1.408.
  if (
    !declaresApi(408) &&
    (carriesRerollsFace392(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRerollsFace392(document)))
  ) {
    return "A ruleset that rolls a face again (a condition's or a level's rerollsFace) requires schemaVersion 2 and capabilityApi 1.408 or newer";
  }
  // Swallow follow-ups: a rider on a held target, a hold ended, a pull out and what it costs, 1.407.
  if (
    !declaresApi(407) &&
    (carriesPullOut391(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPullOut391(document)))
  ) {
    return "A ruleset that pulls somebody out of a creature, puts a condition on only a held target or ends one with it, or shares a holder's harm (a contest's pulls, targetHolds, endsOnTarget or harmsPuller on what an action puts on, or a condition's takesSourceHarm), requires schemaVersion 2 and capabilityApi 1.407 or newer";
  }
  // A floor under defense, 1.406.
  if (
    !declaresApi(406) &&
    (carriesDefenseFloor390(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDefenseFloor390(document)))
  ) {
    return "A ruleset with a floor under defense (a modifier to defense with atLeast) requires schemaVersion 2 and capabilityApi 1.406 or newer";
  }
  // Swallowing: room inside, let out on blows, out of a corpse, and all-hit or typed creature actions, 1.405.
  if (
    !declaresApi(405) &&
    (carriesSwallow389(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSwallow389(document)))
  ) {
    return "A ruleset that holds inside by size, lets out on the blows dealt from inside or out of a fallen holder, or with a creature action aimed by type or with what follows all of a sequence hitting, requires schemaVersion 2 and capabilityApi 1.405 or newer";
  }
  // Hanging on off a list row's pool or while holding a condition, and better-of shapes, 1.404.
  if (!declaresApi(404)) {
    if (
      carriesHangsOnRows388(ruleset, pools) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHangsOnRows388(document, pools))
    ) {
      return "A ruleset that hangs on at 1 off a list row's pool or only while holding a condition, or with a shape's saves and checks the better of two, requires schemaVersion 2 and capabilityApi 1.404 or newer";
    }
  }
  // Engulfing, being inside, source-turn and saved-against harms, and sized target tests, 1.403.
  if (
    !declaresApi(403) &&
    (carriesEngulf387(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesEngulf387(document)))
  ) {
    return "A ruleset with an engulf, a condition that holds its holder inside, a harm on its source's turns or spared by a save, or a target test by size requires schemaVersion 2 and capabilityApi 1.403 or newer";
  }
  // Calls read from a catalog or scaled by cost, and melee-only attack modes, 1.402.
  if (
    !declaresApi(402) &&
    (carriesCalls386(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCalls386(document)))
  ) {
    return "A ruleset with calls read from a catalog or scaled by cost, or an attack mode on melee attacks, requires schemaVersion 2 and capabilityApi 1.402 or newer";
  }
  // Shape forms read from a catalog, 1.401.
  if (
    !declaresApi(401) &&
    (carriesShapeCatalogs(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesShapeCatalogs(document)))
  ) {
    return "A ruleset with shape forms read from a catalog requires schemaVersion 2 and capabilityApi 1.401 or newer";
  }
  // Hanging on at 1 from a condition or level, or on a save or the blow's terms, 1.400.
  if (
    !declaresApi(400) &&
    (carriesHangsOn384(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHangsOn384(document)))
  ) {
    return "A ruleset that hangs on at 1 from a condition or a level, or on a save or the blow's own terms, requires schemaVersion 2 and capabilityApi 1.400 or newer";
  }
  // Regeneration, 1.396.
  if (
    !declaresApi(396) &&
    (carriesRegeneration(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRegeneration(document)))
  ) {
    return "A ruleset with regeneration on a condition, a level or a creature requires schemaVersion 2 and capabilityApi 1.396 or newer";
  }
  // Ways of moving given by conditions, 1.395.
  if (!declaresApi(395) && carriesGivenSpeeds(ruleset)) {
    return "A ruleset with a condition that gives ways of moving, hovering or levitation requires schemaVersion 2 and capabilityApi 1.395 or newer";
  }
  // Calls from catalog entries and item uses, 1.394.
  if (
    !declaresApi(394) &&
    (carriesCatalogCalls(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCatalogCalls(document)))
  ) {
    return "A ruleset with a catalog entry or an item use that calls creatures into the fight requires schemaVersion 2 and capabilityApi 1.394 or newer";
  }
  // Pack Tactics, Blood Frenzy, Colossus Slayer, Divine Strike, 1.393.
  if (
    !declaresApi(393) &&
    (carriesAttackGates380(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAttackGates380(document)))
  ) {
    return "A ruleset with a creature attack mode by an ally beside or a hurt target, a rider on a hurt target, or a rider once on its holder's own turn, requires schemaVersion 2 and capabilityApi 1.393 or newer";
  }
  // Shape changes, 1.392.
  if (
    !declaresApi(392) &&
    (carriesShapes(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesShapes(document)))
  ) {
    return "A ruleset with shape changes requires schemaVersion 2 and capabilityApi 1.392 or newer";
  }
  // How the fight screen shows it: a budget's letters and tone, and `combat.display`, 1.375. A
  // `budgets` that is not a list is left for the ruleset's own check to refuse.
  const shownCombat = plainRecord(plainRecord(ruleset)?.combat);
  const shownBudgets = plainRecord(shownCombat?.economy)?.budgets;
  if (
    !declaresApi(375) &&
    (shownCombat?.display !== undefined ||
      (Array.isArray(shownBudgets) &&
        shownBudgets.some(
          (budget) => plainRecord(budget)?.short !== undefined || plainRecord(budget)?.tone !== undefined,
        )))
  ) {
    return "A ruleset that says how the fight screen shows its budgets, defense or pools requires schemaVersion 2 and capabilityApi 1.375 or newer";
  }
  // The ruleset's own words on its sheet, menu and cards, 1.378.
  if (
    !declaresApi(378) &&
    (rulesetCarriesSheetDisplay(ruleset) ||
      carriesSheetWords(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSheetWords(document)))
  ) {
    return "A ruleset that names its own words for modifiers, toggles or item uses, gives pools units, lists a display, signs a derived value, hides text by a derived value, leaves conditions out of the picker, shows a track once moved, or has a creature trait over 400 letters requires schemaVersion 2 and capabilityApi 1.378 or newer";
  }
  // Which combat styles its games may play, 1.379.
  if (!declaresApi(379) && shownCombat?.styles !== undefined) {
    return "A ruleset that names the combat styles its games may play requires schemaVersion 2 and capabilityApi 1.379 or newer";
  }
  // What a weight is counted in, 1.791.
  if (!declaresApi(791) && plainRecord(plainRecord(plainRecord(ruleset)?.items)?.carry)?.unit !== undefined) {
    return "A ruleset that names what its weights are counted in (items.carry.unit) requires schemaVersion 2 and capabilityApi 1.791 or newer";
  }
  // Damage changes narrowed to a blow's damage types, or spent once they add, 1.792.
  if (
    !declaresApi(792) &&
    (carriesDamageOnTypes777(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDamageOnTypes777(document)))
  ) {
    return "A ruleset whose damage changes count only on some damage types (onTypes) or are spent once they add (spentOnUse) requires schemaVersion 2 and capabilityApi 1.792 or newer";
  }
  // A fight thrown in the ruleset's symbol dice, what its symbols buy, and creatures' upgraded dice,
  // 1.382.
  if (
    !declaresApi(382) &&
    (shownCombat?.kind === "symbol-pool" ||
      shownCombat?.symbols !== undefined ||
      carriesSymbolUpgrades(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSymbolUpgrades(document)))
  ) {
    return "A ruleset whose fights throw its symbol dice, or a creature with upgraded attack dice, requires schemaVersion 2 and capabilityApi 1.382 or newer";
  }
  // Health on a plain track that fills up to its maximum, 1.383. Before it only a wound track (one
  // with levels or boxes) could be health.
  if (!declaresApi(383) && healthOnPlainTrack(ruleset)) {
    return "A ruleset whose fight health is a plain track that fills up requires schemaVersion 2 and capabilityApi 1.383 or newer";
  }
  // An attack row's ability column standing for the best of several abilities, 1.793.
  if (
    !declaresApi(793) &&
    (() => {
      const attacks = plainRecord(plainRecord(ruleset)?.combat)?.attacks;
      return Array.isArray(attacks) && attacks.some((source) => plainRecord(source)?.abilityChoices !== undefined);
    })()
  ) {
    return "A ruleset whose attack rows choose the best of several abilities (abilityChoices) requires schemaVersion 2 and capabilityApi 1.793 or newer";
  }
  // An encounter budget and the worth of a threat tier, 1.803.
  if (
    !declaresApi(803) &&
    (() => {
      const threat = plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.threat);
      const tiers = threat?.tiers;
      return (
        threat?.budget !== undefined ||
        (Array.isArray(tiers) && tiers.some((tier) => plainRecord(tier)?.worth !== undefined))
      );
    })()
  ) {
    return "A ruleset with an encounter budget (combat.threat.budget, or a threat tier's worth) requires schemaVersion 2 and capabilityApi 1.803 or newer";
  }
  // A rest that clears temporary points, 1.804.
  if (
    !declaresApi(804) &&
    (() => {
      const rests = plainRecord(ruleset)?.rests;
      return Array.isArray(rests) && rests.some((rest) => plainRecord(plainRecord(rest)?.clear)?.temp !== undefined);
    })()
  ) {
    return "A ruleset whose rest clears temporary points (clear.temp) requires schemaVersion 2 and capabilityApi 1.804 or newer";
  }
  // A ruleset package file's translations beside it, 1.811 (the manifest schema says so too; an editor's
  // check reads this). The catalog's rulesets carry none: theirs are language packs.
  if (
    !declaresApi(811) &&
    declaresRuleset &&
    (manifest.contributions?.assets?.paths ?? []).some((path) =>
      isRulesetLocaleAssetPath(tryNormalizeArchivePath(path) ?? ""),
    )
  ) {
    return "A ruleset file's translations (locales/<language>.json) require schemaVersion 2 and capabilityApi 1.811 or newer";
  }
  // A list whose rows may be used as rituals, 1.807.
  if (
    !declaresApi(807) &&
    (() => {
      const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
      return Array.isArray(lists) && lists.some((list) => plainRecord(list)?.ritual !== undefined);
    })()
  ) {
    return "A ruleset whose list rows may be used as rituals (a list's ritual) requires schemaVersion 2 and capabilityApi 1.807 or newer";
  }
  // A layer that changes where items are sold or what drops, or a market's own unsold wares, 1.813.
  if (!declaresApi(813) && rulesetCarriesLayerItems813(ruleset)) {
    return "A ruleset whose layers change its market or loot tables (a layer's items), or whose market leaves wares unsold, requires schemaVersion 2 and capabilityApi 1.813 or newer";
  }
  // Ammunition that adds to the attack roll of its shot, 1.812.
  if (
    !declaresApi(812) &&
    (carriesAmmoToHit804(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAmmoToHit804(document)))
  ) {
    return "A ruleset with ammunition that adds to the attack roll of its shot (an ammoRider's toHit) requires schemaVersion 2 and capabilityApi 1.812 or newer";
  }
  // How often a rest may be taken, 1.810.
  if (
    !declaresApi(810) &&
    (() => {
      const rests = plainRecord(ruleset)?.rests;
      return Array.isArray(rests) && rests.some((rest) => plainRecord(rest)?.every !== undefined);
    })()
  ) {
    return "A ruleset whose rests may be taken only so often (a rest's every) requires schemaVersion 2 and capabilityApi 1.810 or newer";
  }
  // Who may use a list's rows as rituals, 1.809.
  if (
    !declaresApi(809) &&
    (() => {
      const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
      return Array.isArray(lists) && lists.some((list) => plainRecord(list)?.ritualNeeds !== undefined);
    })()
  ) {
    return "A ruleset whose rituals need an entry on the sheet (a list's ritualNeeds) requires schemaVersion 2 and capabilityApi 1.809 or newer";
  }
  // Items drawn as they are used, 1.808.
  if (!declaresApi(808) && plainRecord(plainRecord(ruleset)?.items)?.drawOnUse !== undefined) {
    return "A ruleset whose items are drawn as they are used (items.drawOnUse) requires schemaVersion 2 and capabilityApi 1.808 or newer";
  }
  // Signature actions bought at a foe's turn start, 1.805.
  if (!declaresApi(805) && plainRecord(plainRecord(ruleset)?.combat)?.signatureAtTurnStart !== undefined) {
    return "A ruleset whose signature actions are bought at a turn's start (combat.signatureAtTurnStart) requires schemaVersion 2 and capabilityApi 1.805 or newer";
  }
  // A list's pools counted up rather than spent, 1.801.
  if (
    !declaresApi(801) &&
    (() => {
      const lists = plainRecord(plainRecord(ruleset)?.sheet)?.lists;
      return (
        Array.isArray(lists) && lists.some((list) => plainRecord(plainRecord(list)?.pools)?.tallyColumn !== undefined)
      );
    })()
  ) {
    return "A ruleset whose list pools count uses (pools.tallyColumn) requires schemaVersion 2 and capabilityApi 1.801 or newer";
  }
  // A number off the sheet added to hit on an attack list's rows, 1.800.
  if (
    !declaresApi(800) &&
    (() => {
      const attacks = plainRecord(plainRecord(ruleset)?.combat)?.attacks;
      return (
        Array.isArray(attacks) &&
        attacks.some((source) => plainRecord(plainRecord(source)?.toHit)?.sheetBonus !== undefined)
      );
    })()
  ) {
    return "A ruleset whose attack rows add a number off the sheet to hit (toHit.sheetBonus) requires schemaVersion 2 and capabilityApi 1.800 or newer";
  }
  // A sheet migration that sets a column on the list rows it matches, 1.794.
  if (
    !declaresApi(794) &&
    (() => {
      const migrations = plainRecord(plainRecord(ruleset)?.sheet)?.migrations;
      return (
        Array.isArray(migrations) &&
        migrations.some((hop) => {
          const steps = plainRecord(hop)?.steps;
          return Array.isArray(steps) && steps.some((step) => plainRecord(step)?.setColumn !== undefined);
        })
      );
    })()
  ) {
    return "A ruleset whose sheet migrations set a column on list rows (setColumn) requires schemaVersion 2 and capabilityApi 1.794 or newer";
  }
  // A rows step that starts with, and waits on, a count of rows read off the sheet, 1.799.
  if (!declaresApi(799) && carriesRowsCountFrom788(ruleset)) {
    return "A ruleset whose builder rows steps count their rows off the sheet (a rows step's countFrom) requires schemaVersion 2 and capabilityApi 1.799 or newer";
  }
  // How many of a text field's words to pick, 1.797.
  if (!declaresApi(797) && carriesTextPick786(ruleset)) {
    return "A ruleset whose text fields say how many words to pick (a text field's pick) requires schemaVersion 2 and capabilityApi 1.797 or newer";
  }
  // Words a text field offers to pick, 1.796.
  if (!declaresApi(796) && carriesTextSuggestions785(ruleset)) {
    return "A ruleset whose text fields offer words to pick (a text field's suggestions) requires schemaVersion 2 and capabilityApi 1.796 or newer";
  }
  // What a creature has on it as a fight begins, 1.795.
  if (
    !declaresApi(795) &&
    (carriesCreatureInventory784(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureInventory784(document)))
  ) {
    return "A ruleset whose creatures have things on them as a fight begins (a creature's inventory) requires schemaVersion 2 and capabilityApi 1.795 or newer";
  }
  // A ruleset over 256 KB or a catalog file over 1 MB, the ceilings before 1.340.
  if (
    !declaresApi(340) &&
    declaresRuleset &&
    (manifest.files ?? []).some((file) => {
      const path = tryNormalizeArchivePath(file.path);
      if (path === RULESET_ASSET_PATH) return file.bytes > RULESET_EARLIER_MAX_BYTES;
      return !!path && isRulesetCatalogAssetPath(path) && file.bytes > RULESET_CATALOG_EARLIER_MAX_BYTES;
    })
  ) {
    return "A ruleset package whose ruleset.json is over 256 KB or whose catalog file is over 1 MB requires schemaVersion 2 and capabilityApi 1.340 or newer";
  }
  // Icons named by a catalog entry or a condition, 1.338.
  if (
    !declaresApi(338) &&
    (carriesArtIcon(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesArtIcon(document)))
  ) {
    return "A ruleset with an icon on a catalog entry or a condition requires schemaVersion 2 and capabilityApi 1.338 or newer";
  }
  // Rest dice over several pools, 1.337.
  if (
    !declaresApi(337) &&
    Array.isArray(plainRecord(ruleset)?.rests) &&
    (plainRecord(ruleset)!.rests as unknown[]).some((rest) => Array.isArray(plainRecord(rest)?.dice))
  ) {
    return "A ruleset with a rest that spends dice from several pools requires schemaVersion 2 and capabilityApi 1.337 or newer";
  }
  // A broken concentration that picks one of a list of lair actions, 1.336.
  if (
    !declaresApi(336) &&
    (carriesBrokenLairList(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBrokenLairList(document)))
  ) {
    return "A ruleset with a broken concentration that picks one of a list of lair actions requires schemaVersion 2 and capabilityApi 1.336 or newer";
  }
  // Dice a rest spends to heal, 1.335.
  if (
    !declaresApi(335) &&
    Array.isArray(plainRecord(ruleset)?.rests) &&
    (plainRecord(ruleset)!.rests as unknown[]).some((rest) => plainRecord(rest)?.dice !== undefined)
  ) {
    return "A ruleset with a rest that spends dice to heal requires schemaVersion 2 and capabilityApi 1.335 or newer";
  }
  // An item use that gives more of the turn, 1.334.
  if (
    !declaresApi(334) &&
    (carriesItemGives(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemGives(document)))
  ) {
    return "A ruleset with an item use that gives its user more of the turn requires schemaVersion 2 and capabilityApi 1.334 or newer";
  }
  // A lasting area with its own art on the board, 1.333.
  if (
    !declaresApi(333) &&
    (carriesBoardArt(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesBoardArt(document)))
  ) {
    return "A ruleset with a lasting area drawn with its own art on a fight's board requires schemaVersion 2 and capabilityApi 1.333 or newer";
  }
  // A use only beside a prop, or occupants that stay, 1.332.
  if (
    !declaresApi(332) &&
    (carriesNearUseOrFall(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesNearUseOrFall(document)))
  ) {
    return "A ruleset with a use only beside a prop, or a change to the ground that leaves whoever stands there in it, requires schemaVersion 2 and capabilityApi 1.332 or newer";
  }
  // Near a prop, around props, an aura that feeds, 1.331.
  if (
    !declaresApi(331) &&
    (carriesPropsAndFeeding(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesPropsAndFeeding(document)))
  ) {
    return "A ruleset with a condition held only near a prop, an area around props, or an aura that feeds on the felled requires schemaVersion 2 and capabilityApi 1.331 or newer";
  }
  // Save difficulty moved by a condition, 1.328.
  if (
    !declaresApi(328) &&
    (carriesSaveDifficulty(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSaveDifficulty(document)))
  ) {
    return "A ruleset with a condition that moves the difficulty of the saves its holder calls for requires schemaVersion 2 and capabilityApi 1.328 or newer";
  }
  // Lair timing, 1.327.
  if (
    !declaresApi(327) &&
    (carriesLairTiming(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLairTiming(document)))
  ) {
    return "A ruleset with a creature action only at whoever has acted this round, a broken concentration that picks the next lair action, or a condition lasting until the next lair action requires schemaVersion 2 and capabilityApi 1.327 or newer";
  }
  // Blows that reap, 1.323.
  if (
    !declaresApi(323) &&
    (carriesReaps(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesReaps(document)))
  ) {
    return "A ruleset with a blow that reaps requires schemaVersion 2 and capabilityApi 1.323 or newer";
  }
  // Item uses taken as reactions, 1.322.
  if (
    !declaresApi(322) &&
    (carriesItemReactions(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemReactions(document)))
  ) {
    return "A ruleset with an item use taken as a reaction requires schemaVersion 2 and capabilityApi 1.322 or newer";
  }
  // Growing auras, holds with a most, tearing free and hanging on, 1.320.
  if (
    !declaresApi(320) &&
    (carriesBossAsks(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesBossAsks(document)))
  ) {
    return "A ruleset with an aura that grows, lingers or harms on its targets' turns, a hold with a most, tearing free or hanging on requires schemaVersion 2 and capabilityApi 1.320 or newer";
  }
  // Shade and chimes, 1.319.
  if (
    !declaresApi(319) &&
    (carriesShadeOrAlerts(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesShadeOrAlerts(document)))
  ) {
    return "A ruleset with a light that sheds shade, something that alerts or a creature held still by light requires schemaVersion 2 and capabilityApi 1.319 or newer";
  }
  // Clearing growth, 1.318.
  if (
    !declaresApi(318) &&
    (carriesClears(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesClears(document)))
  ) {
    return "A ruleset with an entry or an item use that clears growth requires schemaVersion 2 and capabilityApi 1.318 or newer";
  }
  // Legendary Resistance, 1.317.
  if (
    !declaresApi(317) &&
    (carriesLegendaryResistance(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLegendaryResistance(document)))
  ) {
    return "A ruleset with a creature's legendary resistances or an item use's targetsUpTo requires schemaVersion 2 and capabilityApi 1.317 or newer";
  }
  // Lair actions, 1.315.
  if (
    !declaresApi(315) &&
    (carriesLair(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesLair(document)))
  ) {
    return "A ruleset with a creature's lair actions requires schemaVersion 2 and capabilityApi 1.315 or newer";
  }
  // Resilient Sphere, 1.314.
  if (
    !declaresApi(314) &&
    (carriesSphere(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesSphere(document)))
  ) {
    return "A ruleset with a condition that shuts its holder away from everybody else, or an entry aimed only at creatures up to a size, requires schemaVersion 2 and capabilityApi 1.314 or newer";
  }
  // Maze, Expeditious Retreat, Eyebite's choices again, and the hammer's +4, 1.313.
  if (
    !declaresApi(313) &&
    (carriesLeftovers308(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLeftovers308(document)))
  ) {
    return "A ruleset with a creature sent away that still takes turns, a condition ended by a check, standard actions taken with a use, a casting's choices made again, an ability add capped, or an item bound only with others worn requires schemaVersion 2 and capabilityApi 1.313 or newer";
  }
  // A hammer's thunderclap, 1.312.
  if (
    !declaresApi(312) &&
    (carriesThunderclap(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesThunderclap(document)))
  ) {
    return "A ruleset with a weapon mode whose hit claps around the one it hit requires schemaVersion 2 and capabilityApi 1.312 or newer";
  }
  // Scroll motes, Consume Life and camouflage that wears off, 1.311.
  if (
    !declaresApi(311) &&
    (carriesLeftovers306(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLeftovers306(document)))
  ) {
    return "A ruleset with an item use that puts conditions on its reader, creature actions that slay the dying, or conditions a rule ends when their holder moves or acts requires schemaVersion 2 and capabilityApi 1.311 or newer";
  }
  // Repeats of a concentration entry, and conditions that end at a distance, 1.310.
  if (
    !declaresApi(310) &&
    (carriesRepeats(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesRepeats(document)))
  ) {
    return "A ruleset with an entry made again while its user concentrates on it, or a condition that ends at a distance from whoever put it on, requires schemaVersion 2 and capabilityApi 1.310 or newer";
  }
  // Hide in Plain Sight's needs, Feral Senses, surprise from a hidden start, a ritual-bound weapon, 1.309.
  if (
    !declaresApi(309) &&
    (carriesHidingNeeds(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHidingNeeds(document)))
  ) {
    return "A ruleset with hiding that needs camouflage or a wall, attacks unhindered by not seeing, surprise from a hidden start, or a weapon bound out of the fight requires schemaVersion 2 and capabilityApi 1.309 or newer";
  }
  // Beams and darts on an item's use, 1.308.
  if (
    !declaresApi(308) &&
    (carriesItemBeams(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemBeams(document)))
  ) {
    return "A ruleset with an item use whose targets grow with the sheet, or that takes the same target more than once, requires schemaVersion 2 and capabilityApi 1.308 or newer";
  }
  // Creature concentration, ending on a named action, and conditions on a use's own user, 1.307.
  if (
    !declaresApi(307) &&
    (carriesSelfHeld(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesSelfHeld(document)))
  ) {
    return "A ruleset with creature actions held by concentration, conditions ended by using a named action, or uses that put conditions on their own user requires schemaVersion 2 and capabilityApi 1.307 or newer";
  }
  // Weapons put in hand, and amends that add typed damage or strikes, 1.306.
  if (
    !declaresApi(306) &&
    (carriesConjures(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesConjures(document)))
  ) {
    return "A ruleset with weapons put in hand, or amends that add damage of a type or strikes, requires schemaVersion 2 and capabilityApi 1.306 or newer";
  }
  // Targets that grow with the sheet, or the same target again, 1.305.
  if (
    !declaresApi(305) &&
    (carriesBeams(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesBeams(document)))
  ) {
    return "A ruleset with targets that grow with the sheet, or the same target more than once, requires schemaVersion 2 and capabilityApi 1.305 or newer";
  }
  // Uses once a creature until a rest, 1.304.
  if (
    !declaresApi(304) &&
    (carriesOncePerTarget(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOncePerTarget(document)))
  ) {
    return "A ruleset with uses once a creature until a rest requires schemaVersion 2 and capabilityApi 1.304 or newer";
  }
  // Uses only in some light, and endings on moving or acting, 1.303.
  if (
    !declaresApi(303) &&
    (carriesShadowUses(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesShadowUses(document)))
  ) {
    return "A ruleset with uses only in some light, or conditions that moving or acting ends, requires schemaVersion 2 and capabilityApi 1.303 or newer";
  }
  // What changes another entry each time it is used, 1.302.
  if (
    !declaresApi(302) &&
    (carriesAmends(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesAmends(document)))
  ) {
    return "A ruleset with entries that change another entry each time it is used requires schemaVersion 2 and capabilityApi 1.302 or newer";
  }
  // Zones carried with somebody, and copies set down apart, 1.301.
  if (
    !declaresApi(301) &&
    (carriesHeldZones(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHeldZones(document)))
  ) {
    return "A ruleset with zones carried with somebody, or copies set down apart, requires schemaVersion 2 and capabilityApi 1.301 or newer";
  }
  // A higher cost's more only every so many steps, 1.300.
  if (
    !declaresApi(300) &&
    (carriesStepsEvery(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStepsEvery(document)))
  ) {
    return "A ruleset with what a higher cost adds only every so many steps requires schemaVersion 2 and capabilityApi 1.300 or newer";
  }
  // Darkness against spell light, magical light, and a dispelling reach, 1.299.
  if (
    !declaresApi(299) &&
    (carriesDarkAgainstLight(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDarkAgainstLight(document)))
  ) {
    return "A ruleset with darkness that puts out spell light, magical light, or a dispelling reach, requires schemaVersion 2 and capabilityApi 1.299 or newer";
  }
  // A creature's light out under a condition, and sunlight, 1.298.
  if (
    !declaresApi(298) &&
    (carriesSunAndHiddenLight(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSunAndHiddenLight(document)))
  ) {
    return "A ruleset with creatures whose light goes out under a condition, or light that is sunlight, requires schemaVersion 2 and capabilityApi 1.298 or newer";
  }
  // Zones that shed light or end magical darkness, 1.297.
  if (
    !declaresApi(297) &&
    (carriesLightZones(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLightZones(document)))
  ) {
    return "A ruleset with zones that shed light or end magical darkness, or light that shows the invisible, requires schemaVersion 2 and capabilityApi 1.297 or newer";
  }
  // Lights switched by creatures, and items' light while off, 1.296.
  if (
    !declaresApi(296) &&
    (carriesLightActions(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLightActions(document)))
  ) {
    return "A ruleset with creatures that light or put out their own light, or items that shed light while switched off, requires schemaVersion 2 and capabilityApi 1.296 or newer";
  }
  // A carried light's switch, 1.295.
  if (!declaresApi(295) && carriesLightSwitch(ruleset)) {
    return "A ruleset whose carried light has a name or a price to put out and light again requires schemaVersion 2 and capabilityApi 1.295 or newer";
  }
  // The dark, and light, 1.294.
  if (
    !declaresApi(294) &&
    (carriesDarkness(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesDarkness(document)))
  ) {
    return "A ruleset whose fights are kept dark, or with things that shed light, requires schemaVersion 2 and capabilityApi 1.294 or newer";
  }
  // A creature's own modes on attacks, 1.293.
  if (
    !declaresApi(293) &&
    (carriesAttackModes(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAttackModes(document)))
  ) {
    return "A ruleset with creatures whose attacks are rolled twice where they stand requires schemaVersion 2 and capabilityApi 1.293 or newer";
  }
  // Somebody's own ways of hiding and finding, 1.292.
  if (
    !declaresApi(292) &&
    (carriesHidingTraits(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHidingTraits(document)))
  ) {
    return "A ruleset with somebody's own ways of hiding or of finding the hidden requires schemaVersion 2 and capabilityApi 1.292 or newer";
  }
  // A creature's own ways of hiding and looking, 1.291.
  if (
    !declaresApi(291) &&
    (carriesCreatureSeeking(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureSeeking(document)))
  ) {
    return "A ruleset with a creature that has its own modes on checks, a printed passive Perception, or standard actions with its own budget requires schemaVersion 2 and capabilityApi 1.291 or newer";
  }
  // Looking for the hidden, weighed, 1.290.
  if (
    !declaresApi(290) &&
    (carriesSeekingModes(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSeekingModes(document)))
  ) {
    return "A ruleset with a passive Perception that reads advantage, or a change to checks made to find somebody, requires schemaVersion 2 and capabilityApi 1.290 or newer";
  }
  // A fog dispersed after a while, 1.289.
  if (
    !declaresApi(289) &&
    (carriesSlowDispersal(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSlowDispersal(document)))
  ) {
    return "A ruleset with a fog a wind disperses only after a while requires schemaVersion 2 and capabilityApi 1.289 or newer";
  }
  // Readying, 1.288.
  if (
    !declaresApi(288) &&
    (carriesReadying(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesReadying(document)))
  ) {
    return "A ruleset that readies for real requires schemaVersion 2 and capabilityApi 1.288 or newer";
  }
  // Hiding, Search and Detect, 1.287.
  if (
    !declaresApi(287) &&
    (carriesHiding(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesHiding(document)))
  ) {
    return "A ruleset that hides for real, searches, or has a creature that detects requires schemaVersion 2 and capabilityApi 1.287 or newer";
  }
  // A light fog, a fog the wind blows away, and that wind, 1.286.
  if (
    !declaresApi(286) &&
    (carriesLightOrWind(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLightOrWind(document)))
  ) {
    return "A ruleset with a lightly obscuring fog, or a fog or wind that blows it away, requires schemaVersion 2 and capabilityApi 1.286 or newer";
  }
  // A legendary move after what its action does, or on one speed, 1.285.
  if (
    !declaresApi(285) &&
    (carriesMoveAfter(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMoveAfter(document)))
  ) {
    return "A ruleset with a legendary move after its action or on one speed requires schemaVersion 2 and capabilityApi 1.285 or newer";
  }
  // A spell cast with points, 1.284.
  if (
    !declaresApi(284) &&
    (carriesLegendaryCast(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLegendaryCast(document)))
  ) {
    return "A ruleset with a legendary cast requires schemaVersion 2 and capabilityApi 1.284 or newer";
  }
  // A legendary move, 1.283.
  if (
    !declaresApi(283) &&
    (carriesLegendaryMove(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLegendaryMove(document)))
  ) {
    return "A ruleset with a legendary move requires schemaVersion 2 and capabilityApi 1.283 or newer";
  }
  // A burst centred on its user, 1.282.
  if (
    !declaresApi(282) &&
    (carriesAround(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesAround(document)))
  ) {
    return "A ruleset with a burst centred on its user requires schemaVersion 2 and capabilityApi 1.282 or newer";
  }
  // A blow whose maker regains what it dealt, 1.281.
  if (
    !declaresApi(281) &&
    (carriesDrain(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesDrain(document)))
  ) {
    return "A ruleset with a blow whose maker regains the damage it dealt requires schemaVersion 2 and capabilityApi 1.281 or newer";
  }
  // A teleport with a strike before or after it, 1.280.
  if (
    !declaresApi(280) &&
    (carriesTeleportStrike(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTeleportStrike(document)))
  ) {
    return "A ruleset with a creature's teleport that strikes before or after it requires schemaVersion 2 and capabilityApi 1.280 or newer";
  }
  // Teleports out of the fight, seen passengers and smoke, 1.279.
  if (
    !declaresApi(279) &&
    (carriesTeleportExtras(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTeleportExtras(document)))
  ) {
    return "A ruleset with a teleport that leaves the fight, takes along only those its user sees, or leaves smoke behind requires schemaVersion 2 and capabilityApi 1.279 or newer";
  }
  // Calm Emotions, 1.278.
  if (
    !declaresApi(278) &&
    (carriesCalm(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesCalm(document)))
  ) {
    return "A ruleset with a save its user's side may fail, a condition that keeps its holder off a whole side, or one that ends on an attack, on harm from a catalog or on a friend harmed in sight requires schemaVersion 2 and capabilityApi 1.278 or newer";
  }
  // Five or six conditions put on at once, 1.277.
  if (
    !declaresApi(277) &&
    (carriesManyApplies(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesManyApplies(document)))
  ) {
    return "A ruleset with a spell, an item or a creature action that puts on more than four conditions requires schemaVersion 2 and capabilityApi 1.277 or newer";
  }
  // Teleports, 1.276.
  if (
    !declaresApi(276) &&
    (carriesTeleports(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTeleports(document)))
  ) {
    return "A ruleset with a spell, an item or a creature that teleports requires schemaVersion 2 and capabilityApi 1.276 or newer";
  }
  // A condition held off near its source or by another condition, 1.275.
  if (!declaresApi(275) && carriesHeldOff(ruleset)) {
    return "A ruleset with a condition that holds while its source is near as well as in sight, or one condition that holds others off, requires schemaVersion 2 and capabilityApi 1.275 or newer";
  }
  // Numbers fixed off a condition's applier, Sympathy's reach and save, a scroll's chosen kind, 1.274.
  if (
    !declaresApi(274) &&
    (carriesSourceNumbers(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesSourceNumbers(document)))
  ) {
    return "A ruleset with a condition put on with a value off its applier, temporary points a condition gives each turn, an aura save against its applier's difficulty, a save on harm from a condition's source, a walk kept within reach, or a kind chosen as an item is used, requires schemaVersion 2 and capabilityApi 1.274 or newer";
  }
  // A weapon's charges spent on its hits, 1.273.
  if (
    !declaresApi(273) &&
    (carriesChargedHits(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChargedHits(document)))
  ) {
    return "A ruleset with a weapon whose charges are spent on its hits requires schemaVersion 2 and capabilityApi 1.273 or newer";
  }
  // An item that becomes another on its last charge, 1.272.
  if (
    !declaresApi(272) &&
    (carriesBecomes(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesBecomes(document)))
  ) {
    return "A ruleset with an item that becomes another when its last charge is spent requires schemaVersion 2 and capabilityApi 1.272 or newer";
  }
  // An item's first use named, a use plus its holder's value, pushes a charge, charges back, 1.271.
  if (
    !declaresApi(271) &&
    (carriesStaffExtras(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStaffExtras(document)))
  ) {
    return "A ruleset with an item whose first use is named, an item use adding a value off its holder's sheet, more charges that push farther, or a last charge's die that gives charges back, requires schemaVersion 2 and capabilityApi 1.271 or newer";
  }
  // A creature type chosen as it is used, auras by that kind or by sight, saves from far away, 1.270.
  if (
    !declaresApi(270) &&
    (carriesKindChoice(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesKindChoice(document)))
  ) {
    return "A ruleset with a catalog entry whose creature type is chosen as it is used, an aura reaching only that kind or whoever sees its holder, or a save that ends a condition only from far enough away, requires schemaVersion 2 and capabilityApi 1.270 or newer";
  }
  // Dropping, keeping out, a turn freed when stuck, saves out of sight, destroying by tier, 1.266.
  // Item uses read off the holder's sheet, and more charges spent for more, 1.269.
  if (
    !declaresApi(269) &&
    (carriesStaffUses(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesStaffUses(document)))
  ) {
    return "A ruleset with more than 160 conditions, an aura save whose holder's aura stays off once what it put on ends, an item use whose save difficulty is read off its holder's sheet, or one that spends more charges for more, requires schemaVersion 2 and capabilityApi 1.269 or newer";
  }
  // Auras by target kind or on whoever holds its holder, gaze margins and averting, saves leaning in
  // sight, 1.268.
  if (
    !declaresApi(268) &&
    (carriesGazes(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesGazes(document)))
  ) {
    return "A ruleset with auras reaching only some kinds of creature or whoever holds its holder, an aura save worse when failed by enough or one whose holder's eyes can be averted, or a save rolled leaning while its source is in sight, requires schemaVersion 2 and capabilityApi 1.268 or newer";
  }
  // Senses any one of which serves, targets near each other, areas growing with cost, more item
  // uses, and a stat block's held things, 1.267.
  if (
    !declaresApi(267) &&
    (carriesTargetingMore(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTargetingMore(document)))
  ) {
    return "A ruleset with senses any one of which serves, targets kept near each other, an area that grows with its cost, more uses on an item, or things a stat block holds, requires schemaVersion 2 and capabilityApi 1.267 or newer";
  }
  if (
    !declaresApi(266) &&
    (carriesBehaviorMore(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesBehaviorMore(document)))
  ) {
    return "A ruleset with a condition that drops what its holder holds, keeps them out of a ring, frees a turn begun stuck, a save rolled only out of sight, or a condition that destroys by threat tier, requires schemaVersion 2 and capabilityApi 1.266 or newer";
  }
  // Auras heard, harming or asking saves; save changes against what a catalog casts, 1.265.
  if (
    !declaresApi(265) &&
    (carriesAuraTurns(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAuraTurns(document)))
  ) {
    return "A ruleset with auras that need senses, harm as their holder's turn starts or ask for a save, or saves changed against what a catalog casts, requires schemaVersion 2 and capabilityApi 1.265 or newer";
  }
  // What a condition makes its holder do with their turn, and saves spent an action on, 1.264.
  if (
    !declaresApi(264) &&
    (carriesBehavior(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesBehavior(document)))
  ) {
    return "A ruleset with a condition that decides its holder's turn, or a save spent an action on, requires schemaVersion 2 and capabilityApi 1.264 or newer";
  }
  // Auras, and conditions kept on through a fight, 1.263.
  if (
    !declaresApi(263) &&
    (carriesAuras(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesAuras(document)))
  ) {
    return "A ruleset with auras on a condition, or conditions kept on through a fight, requires schemaVersion 2 and capabilityApi 1.263 or newer";
  }
  // Qualities on a stat block's action, 1.262.
  if (
    !declaresApi(262) &&
    (carriesActionQualities(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesActionQualities(document)))
  ) {
    return "A ruleset with qualities on a creature's action requires schemaVersion 2 and capabilityApi 1.262 or newer";
  }
  // Disease stages: onDamaged, expires, curedOnlyBy, restoredWhenCured, nonmagical heal block,
  // ends on a stat block's action, 1.261.
  if (
    !declaresApi(261) &&
    (carriesDiseaseStages(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDiseaseStages(document)))
  ) {
    return "A ruleset with conditions brought on by damage, onsets that turn into another, cures only some level ends, rest losses a cure gives back, heals only magic gets through, or cures on a creature's action requires schemaVersion 2 and capabilityApi 1.261 or newer";
  }
  // A condition that lowers a maximum on a rest, 1.260.
  if (
    !declaresApi(260) &&
    (carriesConditionRests(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesConditionRests(document)))
  ) {
    return "A ruleset with conditions that lower a maximum on a rest requires schemaVersion 2 and capabilityApi 1.260 or newer";
  }
  // A rescue on an item's use, 1.259.
  if (
    !declaresApi(259) &&
    (carriesItemRescues(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesItemRescues(document)))
  ) {
    return "A ruleset with rescues on an item's use requires schemaVersion 2 and capabilityApi 1.259 or newer";
  }
  // Condition kinds and counted saves, 1.258.
  if (
    !declaresApi(258) &&
    (carriesDiseases(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesDiseases(document)))
  ) {
    return "A ruleset with condition kinds, or saves counted to end a condition or to worsen it, requires schemaVersion 2 and capabilityApi 1.258 or newer";
  }
  // Dice off checks and damage, narrowed or budgeted rescues, an item's half on a miss, 1.257.
  if (
    !declaresApi(257) &&
    (carriesRollAnswers(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesRollAnswers(document)))
  ) {
    return "A ruleset with answers taking dice off checks or damage, rescues narrowed to some saves or spending a budget, or item uses dealing half on a miss, requires schemaVersion 2 and capabilityApi 1.257 or newer";
  }
  // Rescues of a holder's own, entries never on their user, conditions one at a time, 1.256.
  if (
    !declaresApi(256) &&
    (carriesOwnRescues(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesOwnRescues(document)))
  ) {
    return "A ruleset with rescues counting a d20 as 20 or adding a holder's own die, entries never on their user, or conditions one of a kind at a time, requires schemaVersion 2 and capabilityApi 1.256 or newer";
  }
  // A miss dealing half, or a condition harming more at a higher cost, 1.255.
  if (
    !declaresApi(255) &&
    (carriesAcidArrow(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAcidArrow(document)))
  ) {
    return "A ruleset with entries dealing half on a miss, or conditions harming more at a higher cost, requires schemaVersion 2 and capabilityApi 1.255 or newer";
  }
  // An entry changing how another is used, 1.253.
  if (
    !declaresApi(253) &&
    (carriesMetamagic(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMetamagic(document)))
  ) {
    return "A ruleset with entries that change how another is used requires schemaVersion 2 and capabilityApi 1.253 or newer";
  }
  // An entry giving back to a pool, a slot past its maximum, 1.252.
  if (
    !declaresApi(252) &&
    (carriesFontOfMagic(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesFontOfMagic(document)))
  ) {
    return "A ruleset with entries that give back to a pool, or past its maximum, requires schemaVersion 2 and capabilityApi 1.252 or newer";
  }
  // A heal spending as many uses as its user chooses, 1.251.
  if (
    !declaresApi(251) &&
    (carriesUsesChosen(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUsesChosen(document)))
  ) {
    return "A ruleset with heals that spend as many uses as their user chooses requires schemaVersion 2 and capabilityApi 1.251 or newer";
  }
  // Dice off a roll that hit, a half save evaded, 1.250.
  if (
    !declaresApi(250) &&
    (carriesCuttingWords(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCuttingWords(document)))
  ) {
    return "A ruleset with answers that take dice off a roll that hit, or saves evaded, requires schemaVersion 2 and capabilityApi 1.250 or newer";
  }
  // A die added once a roll falls short, a failed roll rolled again or turned, 1.249.
  if (
    !declaresApi(249) &&
    (carriesRescue(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesRescue(document)))
  ) {
    return "A ruleset with changes held back until a roll falls short, or entries spent on a failed roll, requires schemaVersion 2 and capabilityApi 1.249 or newer";
  }
  // A hit answered for a strike from one budget, one answer of a group per hit, 1.248.
  if (
    !declaresApi(248) &&
    (carriesOpenHand(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesOpenHand(document)))
  ) {
    return "A ruleset with answers to a hit by a strike from one budget, or one answer of a group per hit, requires schemaVersion 2 and capabilityApi 1.248 or newer";
  }
  // Before the first attack, attacks narrowed to a kind of blow, more dice on a critical, 1.247.
  if (
    !declaresApi(247) &&
    (carriesReckless(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesReckless(document)))
  ) {
    return "A ruleset with uses offered only before the holder's first attack, changes to attacks narrowed to a kind of blow, or more dice on a critical requires schemaVersion 2 and capabilityApi 1.247 or newer";
  }
  // The attack action taken with a held weapon matched by tags, 1.246.
  if (
    !declaresApi(246) &&
    (carriesAfterAttackItems(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesAfterAttackItems(document)))
  ) {
    return "A ruleset with entries or grants that come after the attack action taken with weapons matched by tags requires schemaVersion 2 and capabilityApi 1.246 or newer";
  }
  // Several uses at once, a failed save to 0, hits by named attacks, harm as a condition ends, 1.245.
  if (
    !declaresApi(245) &&
    (carriesQuiveringPalm(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesQuiveringPalm(document)))
  ) {
    return "A ruleset with uses that spend several uses at once or drop a target that fails its save to 0, reactions to hits by named attacks, or conditions that harm as they end, requires schemaVersion 2 and capabilityApi 1.245 or newer";
  }
  // Held weapons matched by name or tags, what is wielded, rows every sheet has, 1.244.
  if (
    !declaresApi(244) &&
    ((plainRecord(plainRecord(ruleset)?.combat)?.attacks as unknown[] | undefined)?.some?.(
      (source) => plainRecord(source)?.always !== undefined,
    ) ||
      carriesWeaponMatch(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWeaponMatch(document)))
  ) {
    return "A ruleset with attack lists that give every sheet a row, entries that change held weapons' attacks, or rules kept only while wielding certain weapons or granted strikes kept within bounds, requires schemaVersion 2 and capabilityApi 1.244 or newer";
  }
  // Attack rows, granted strikes and the attack action, 1.242.
  if (
    !declaresApi(242) &&
    (carriesMartialArts(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMartialArts(document)))
  ) {
    return "A ruleset with entries that change attack rows, grant strikes or come only after the attack action, or granted attacks narrowed by name or to after it, requires schemaVersion 2 and capabilityApi 1.242 or newer";
  }
  // Answers to one's own hit, added to it, and capped higher costs, 1.241.
  if (
    !declaresApi(241) &&
    (carriesOwnHit(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesOwnHit(document)))
  ) {
    return "A ruleset with reactions to their holder's own hit or to a weapon's, uses added to that blow, or a most for a higher cost's steps, requires schemaVersion 2 and capabilityApi 1.241 or newer";
  }
  // Initiative thrown twice, 1.240.
  if (
    !declaresApi(240) &&
    (plainRecord(plainRecord(plainRecord(ruleset)?.combat)?.initiative)?.checkAbility !== undefined ||
      carriesInitiativeMode(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesInitiativeMode(document)))
  ) {
    return "A ruleset whose initiative is a check made with an ability, or with uses that throw initiative twice, requires schemaVersion 2 and capabilityApi 1.240 or newer";
  }
  // A grant held to melee strikes, tracks moved as a condition ends, 1.239.
  if (
    !declaresApi(239) &&
    (carriesFrenzy(ruleset) ||
      carriesUsesOf(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesUsesOf(document)))
  ) {
    return "A ruleset with conditions whose granted attacks are melee only or that move a track as they end, or uses that spend another row's, requires schemaVersion 2 and capabilityApi 1.239 or newer";
  }
  // A second turn in the first round, 1.238.
  if (
    !declaresApi(238) &&
    (carriesExtraTurn(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesExtraTurn(document)))
  ) {
    return "A ruleset with uses that give a second turn in a fight's first round requires schemaVersion 2 and capabilityApi 1.238 or newer";
  }
  // Conditions that keep surprise off, uses that shake it off, 1.237.
  if (
    !declaresApi(237) &&
    (carriesSurprise(ruleset) || [...(catalogDocuments?.values() ?? [])].some((document) => carriesSurprise(document)))
  ) {
    return "A ruleset with conditions that keep surprise off or uses that shake it off requires schemaVersion 2 and capabilityApi 1.237 or newer";
  }
  // Actions a condition gives, uses that end it, cures by who put it on, sending away, 1.236.
  if (
    !declaresApi(236) &&
    (conditionsGiveActions(ruleset) ||
      carriesDismissals(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDismissals(document)))
  ) {
    return "A ruleset with conditions that give actions, uses that end a condition, cures of only what some creatures put on, or uses that send somebody out of the fight, requires schemaVersion 2 and capabilityApi 1.236 or newer";
  }
  // Lowered maximums without a save of their own, damage that leaves some health, targets by what they hold, 1.235.
  if (
    !declaresApi(235) &&
    (carriesDrainsAndHolds(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDrainsAndHolds(document)))
  ) {
    return "A ruleset with lowered health maximums that need no save of their own, damage that leaves some health, or actions whose targets must hold a condition, requires schemaVersion 2 and capabilityApi 1.235 or newer";
  }
  // A cure that does one of its cures, 1.204.
  if (
    !declaresApi(204) &&
    (carriesCureOneOf(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCureOneOf(document)))
  ) {
    return "A ruleset with cures that do one of their cures requires schemaVersion 2 and capabilityApi 1.204 or newer";
  }
  // Blows that lower the health maximum, 1.203.
  if (
    !declaresApi(203) &&
    (carriesReducesMax(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesReducesMax(document)))
  ) {
    return "A ruleset with creature actions that lower the health maximum on a failed save requires schemaVersion 2 and capabilityApi 1.203 or newer";
  }
  // Conditions that end with another put on with them, 1.202.
  if (
    !declaresApi(202) &&
    (carriesLinkedConditions(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesLinkedConditions(document)))
  ) {
    return "A ruleset with conditions that end with another condition put on with them requires schemaVersion 2 and capabilityApi 1.202 or newer";
  }
  // Tracks moved, sealed health given back, a broken section's step, 1.201.
  if (
    !declaresApi(201) &&
    (carriesTrackMoves(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTrackMoves(document)))
  ) {
    return "A ruleset with entries that move live tracks by levels or give back sealed health, or broken wall sections with their own cost step, requires schemaVersion 2 and capabilityApi 1.201 or newer";
  }
  // Walls in sections, 1.200.
  if (
    !declaresApi(200) &&
    (carriesWallSections(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWallSections(document)))
  ) {
    return "A ruleset with walls in sections that are struck and broken requires schemaVersion 2 and capabilityApi 1.200 or newer";
  }
  // A health pool passing over some, 1.199.
  if (
    !declaresApi(199) &&
    (carriesHealthPoolSkips(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealthPoolSkips(document)))
  ) {
    return "A ruleset with health pools that pass over some of their targets requires schemaVersion 2 and capabilityApi 1.199 or newer";
  }
  // A zone's own damage type at its triggers, 1.198.
  if (
    !declaresApi(198) &&
    (carriesZoneDamageType(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesZoneDamageType(document)))
  ) {
    return "A ruleset with zones that deal another damage type at their triggers requires schemaVersion 2 and capabilityApi 1.198 or newer";
  }
  // A blow's own dice thrown more times over, 1.197.
  if (
    !declaresApi(197) &&
    (carriesDiceTimes(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDiceTimes(document)))
  ) {
    return "A ruleset with damage modifiers that throw a blow's own dice more times over requires schemaVersion 2 and capabilityApi 1.197 or newer";
  }
  // Health pools, health ceilings and killing outright, 1.196.
  if (
    !declaresApi(196) &&
    (carriesHealthTargeting(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealthTargeting(document)))
  ) {
    return "A ruleset with entries that share out a pool of health, affect only those at or below some health, or kill outright requires schemaVersion 2 and capabilityApi 1.196 or newer";
  }
  // Conditions that make their holder bigger or smaller, 1.195.
  if (!declaresApi(195) && carriesSizeChanges(ruleset)) {
    return "A ruleset with conditions that change size requires schemaVersion 2 and capabilityApi 1.195 or newer";
  }
  // Creatures that fill more than one cell, 1.194.
  if (!declaresApi(194) && carriesFootprints(ruleset)) {
    return "A ruleset with sizes that fill more than one cell requires schemaVersion 2 and capabilityApi 1.194 or newer";
  }
  // Contests against a fixed number, on allies, the wounded or the dying, and rest-only wounds, 1.193.
  if (
    !declaresApi(193) &&
    (carriesTreatmentsAndSeals(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesTreatmentsAndSeals(document)))
  ) {
    return "A ruleset with contests rolled against a fixed number, taken on allies, the wounded or the dying, contests that stabilize, or weapons whose damage only a rest restores requires schemaVersion 2 and capabilityApi 1.193 or newer";
  }
  // Weapons through resistance, slays that frighten instead, an oathbow's other weapons, 1.192.
  if (
    !declaresApi(192) &&
    (carriesWeaponRiders(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWeaponRiders(document)))
  ) {
    return "A ruleset with weapons that ignore resistance, slays that frighten on a made save, or weapons that hinder their wielder's others while a mark stands requires schemaVersion 2 and capabilityApi 1.192 or newer";
  }
  // Heals kept off, conditions kept off by source, ability floors and saves against actions, 1.191.
  if (
    !declaresApi(191) &&
    (carriesHealWardsAndActionSaves(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesHealWardsAndActionSaves(document)))
  ) {
    return "A ruleset with conditions that keep heals off or keep conditions off by who puts them on, targets that need an ability score of at least some number, or saves against named actions requires schemaVersion 2 and capabilityApi 1.191 or newer";
  }
  // Weapon modes with their own reach, clauses, bolt or charges, 1.190.
  if (
    !declaresApi(190) &&
    (carriesModeExtras(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesModeExtras(document)))
  ) {
    return "A ruleset with weapon modes that reach their own distance, add damage, send a bolt along the way, or spend charges requires schemaVersion 2 and capabilityApi 1.190 or newer";
  }
  // Wounds that stack and harm, sworn enemies, and creature actions by ability, 1.189.
  if (
    !declaresApi(189) &&
    (carriesMarksAndWounds(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesMarksAndWounds(document)))
  ) {
    return "A ruleset with conditions that harm each turn, stack or keep to one holder per source, weapons that mark a sworn enemy, or creature actions that name their ability requires schemaVersion 2 and capabilityApi 1.189 or newer";
  }
  // More conditions, attacks and checks narrowed by ability, 1.188.
  if (
    !declaresApi(188) &&
    (carriesWideConditionsAndAbilityNarrowing(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWideConditionsAndAbilityNarrowing(document)))
  ) {
    return "A ruleset with more than 80 conditions, attacks narrowed by the ability they're made with, or checks narrowed by ability requires schemaVersion 2 and capabilityApi 1.188 or newer";
  }
  // Weapons by what they hit, slaying, draining, thrown extras and once-a-turn wounds, 1.187.
  if (
    !declaresApi(187) &&
    (carriesWeaponKinds(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesWeaponKinds(document)))
  ) {
    return "A ruleset with weapons that hit harder by what they hit, slay, drain, add only when thrown, or wound once a turn requires schemaVersion 2 and capabilityApi 1.187 or newer";
  }
  // Creature actions that recharge together or charge, 1.186.
  if (
    !declaresApi(186) &&
    (carriesChargeAndGroups(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesChargeAndGroups(document)))
  ) {
    return "A ruleset with creature actions that recharge together or charge requires schemaVersion 2 and capabilityApi 1.186 or newer";
  }
  // Creature kinds read further, 1.185.
  if (
    !declaresApi(185) &&
    (carriesCreatureKinds(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreatureKinds(document)))
  ) {
    return "A ruleset with saves or damage that change by what the target is, targets limited by ability scores or condition immunities, or changes to attacks that roll twice by who is attacking whom, requires schemaVersion 2 and capabilityApi 1.185 or newer";
  }
  // Creature actions that push, item uses with a line's width, 1.184.
  if (
    !declaresApi(184) &&
    (carriesCreaturePush(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesCreaturePush(document)))
  ) {
    return "A ruleset with creature actions that push or item uses whose line has a width requires schemaVersion 2 and capabilityApi 1.184 or newer";
  }
  // Zones that go off later or burn away, 1.183.
  if (
    !declaresApi(183) &&
    (carriesDetonations(ruleset) ||
      [...(catalogDocuments?.values() ?? [])].some((document) => carriesDetonations(document)))
  ) {
    return "A ruleset with zones that go off later or burn away requires schemaVersion 2 and capabilityApi 1.183 or newer";
  }
  // A hang-on off a list row's pool (1.404) names a row a catalog file may write (1.405).
  if (carriesCreatureSpellcasting || carriesHangsOnRows388(ruleset, pools)) {
    // The references can only be checked once the catalog files are beside their headers.
    const complete = {
      ...ruleset,
      catalogs: (Array.isArray(catalogs) ? catalogs : []).map((raw) => {
        const header = plainRecord(raw);
        if (!header || typeof header.asset !== "string") return raw;
        const { asset, ...inline } = header;
        return { ...inline, entries: plainRecord(catalogDocuments?.get(asset))?.entries ?? [] };
      }),
    };
    const parsed = parseRulesetDefinition(complete);
    if (!parsed.ok) return parsed.issues.slice(0, 5).join("; ");
  }
  // Sizes and escape DCs, 1.103: new keys on the strict combat block, contest, creature and applies.
  if (!declaresApi(103)) {
    const combat = plainRecord(ruleset?.combat);
    const contests = combat?.contests;
    if (
      carriesSizes ||
      combat?.sizes !== undefined ||
      (Array.isArray(contests) && contests.some((contest) => plainRecord(contest)?.maxSizeAbove !== undefined))
    ) {
      return "A ruleset whose combatants have sizes or whose holds name an escape DC requires schemaVersion 2 and capabilityApi 1.103 or newer";
    }
  }
  // A creature attack that deals another amount with both hands or when bloodied, 1.102: new keys on the
  // strict creature damage and the strict creature.
  if (!declaresApi(102) && carriesDamageAlternatives) {
    return "A ruleset whose creature attacks deal another amount two-handed or when hurt requires schemaVersion 2 and capabilityApi 1.102 or newer";
  }
  // Harm that carries qualities past a resistance's exception, 1.101: a new key on the strict mechanics
  // and the strict creature damage.
  if (!declaresApi(101) && carriesBlowQualities) {
    return "A ruleset whose spells or creature attacks carry qualities past a resistance (magical) requires schemaVersion 2 and capabilityApi 1.101 or newer";
  }
  // A weapon's damage dice rerolled off the holder's sheet, 1.98: a new key on the strict damage.
  if (!declaresApi(98) && carriesDamageReroll) {
    return "A ruleset whose weapons reroll low damage dice requires schemaVersion 2 and capabilityApi 1.98 or newer";
  }
  // A weapon's damage off the holder's sheet, and an off hand kept full by the sheet, 1.97: new keys
  // on the strict damage and the strict combat.offHand.
  const fullWhen = plainRecord(plainRecord(plainRecord(ruleset?.combat)?.offHand))?.fullWhen;
  if (!declaresApi(97) && (carriesDamageSheetBonus || fullWhen !== undefined)) {
    return "A ruleset whose weapons add damage off the sheet, or whose off hand reads the sheet, requires schemaVersion 2 and capabilityApi 1.97 or newer";
  }
  // A score choice with a cap, 1.96: a new key on the strict choice.
  if (!declaresApi(96) && carriesChoiceCaps) {
    return "A ruleset whose catalog entry offers a score choice with a cap requires schemaVersion 2 and capabilityApi 1.96 or newer";
  }
  // Entries a builder step keeps one of, 1.94: a new key on the strict entry.
  if (!declaresApi(94) && carriesExclusive) {
    return "A ruleset whose catalog entries are exclusive of each other requires schemaVersion 2 and capabilityApi 1.94 or newer";
  }
  // A score choice that may name one score twice, 1.93: a new key on the strict choice.
  if (!declaresApi(93) && carriesRepeatChoices) {
    return "A ruleset whose catalog entry offers a score choice that repeats requires schemaVersion 2 and capabilityApi 1.93 or newer";
  }
  // Several scaled rows for one list in one entry, told apart by name, 1.92: an older Engine refused it.
  if (!declaresApi(92) && carriesSeveralScaled) {
    return "A ruleset whose catalog entry scales a row beside others of its list requires schemaVersion 2 and capabilityApi 1.92 or newer";
  }
  const countSteps = plainRecord(plainRecord(ruleset?.sheet)?.builder)?.steps;
  // Bigger catalog steps and bounded manual base scores, 1.110: an older Engine refused either.
  const biggerOrBounded =
    Array.isArray(countSteps) &&
    countSteps.some((value) => {
      const step = plainRecord(value);
      return (
        (step?.kind === "catalog" &&
          ((typeof step.min === "number" && step.min > 20) || (typeof step.max === "number" && step.max > 20))) ||
        (step?.kind === "abilities" && plainRecord(plainRecord(step.methods)?.manual) !== undefined)
      );
    });
  if (!declaresApi(110) && biggerOrBounded) {
    return "A ruleset whose builder catalog step asks for or takes more than 20 entries, or bounds manual scores, requires schemaVersion 2 and capabilityApi 1.110 or newer";
  }
  // More derived values again, 1.729: an older Engine refused a sheet with more than 400.
  if (!declaresApi(729) && Array.isArray(derivedValues) && derivedValues.length > RULESET_DERIVED_MAX_BEFORE_1676) {
    return `A ruleset with more than ${RULESET_DERIVED_MAX_BEFORE_1676} derived values requires schemaVersion 2 and capabilityApi 1.729 or newer`;
  }
  // More derived values again, 1.111: an older Engine refused a sheet with more than 240.
  if (!declaresApi(111) && Array.isArray(derivedValues) && derivedValues.length > RULESET_DERIVED_MAX_BEFORE_1106) {
    return `A ruleset with more than ${RULESET_DERIVED_MAX_BEFORE_1106} derived values requires schemaVersion 2 and capabilityApi 1.111 or newer`;
  }
  // More builder steps and bigger catalog steps again, 1.768: a wizard's own spellbook step, every
  // spell of the SRD's 20th level, and the mark step after it.
  if (
    !declaresApi(768) &&
    Array.isArray(countSteps) &&
    (countSteps.length > RULESET_BUILDER_STEPS_MAX_BEFORE_1715 ||
      countSteps.some((value) => {
        const step = plainRecord(value);
        return (
          step?.kind === "catalog" &&
          [step.min, step.max].some(
            (count) => typeof count === "number" && count > RULESET_BUILDER_CATALOG_PICKS_MAX_BEFORE_1715,
          )
        );
      }))
  )
    return `A ruleset with more than ${RULESET_BUILDER_STEPS_MAX_BEFORE_1715} builder steps, or a catalog step that asks for or takes more than ${RULESET_BUILDER_CATALOG_PICKS_MAX_BEFORE_1715} entries, requires schemaVersion 2 and capabilityApi 1.768 or newer`;
  // More builder steps, 1.112: an older Engine refused a builder with more than 16.
  if (!declaresApi(112) && Array.isArray(countSteps) && countSteps.length > RULESET_BUILDER_STEPS_MAX_BEFORE_1107) {
    return `A ruleset with more than ${RULESET_BUILDER_STEPS_MAX_BEFORE_1107} builder steps requires schemaVersion 2 and capabilityApi 1.112 or newer`;
  }
  // Entries of a catalog to choose, 1.91: a new key on the strict grants and a new step kind.
  const choosing =
    carriesEntryChoices ||
    (Array.isArray(countSteps) && countSteps.some((step) => plainRecord(step)?.kind === "choices"));
  if (!declaresApi(91) && choosing) {
    return "A ruleset whose builder offers catalog entries to choose requires schemaVersion 2 and capabilityApi 1.91 or newer";
  }
  // A catalog step's count read off the sheet, 1.90: a new key on the strict step.
  const counted = Array.isArray(countSteps) && countSteps.some((step) => plainRecord(step)?.countFrom !== undefined);
  if (!declaresApi(90) && counted) {
    return "A ruleset whose builder reads a step's count off the sheet requires schemaVersion 2 and capabilityApi 1.90 or newer";
  }
  if (!declaresApi(89) && singular) {
    return "A ruleset whose coins name one of themselves requires schemaVersion 2 and capabilityApi 1.89 or newer";
  }
  // More derived values again, 1.88: an older Engine refused a sheet with more than 120.
  if (!declaresApi(88) && Array.isArray(derivedValues) && derivedValues.length > RULESET_DERIVED_MAX_BEFORE_183) {
    return `A ruleset with more than ${RULESET_DERIVED_MAX_BEFORE_183} derived values requires schemaVersion 2 and capabilityApi 1.88 or newer`;
  }
  // A list column a player fills by rolling, 1.85: a new key on the strict column.
  const lists = plainRecord(ruleset?.sheet)?.lists;
  const rolled =
    Array.isArray(lists) &&
    lists.some((list) => {
      const columns = plainRecord(list)?.columns;
      return Array.isArray(columns) && columns.some((column) => plainRecord(column)?.roll !== undefined);
    });
  if (!declaresApi(85) && rolled) {
    return "A ruleset with a list column filled by a roll requires schemaVersion 2 and capabilityApi 1.85 or newer";
  }
  // The guided builder, 1.86: a new key on the strict sheet, and `grants` on the strict entry.
  // A catalog of rows that feeds no list holds only entries that grant, which `grants` already gates.
  if (!declaresApi(86) && (plainRecord(ruleset?.sheet)?.builder !== undefined || carriesGrants)) {
    return BUILDER_ISSUE;
  }
  // A builder step's starting method and a catalog step's limit by a sheet value, 1.87: new keys on the
  // strict steps.
  const builderSteps = plainRecord(plainRecord(ruleset?.sheet)?.builder)?.steps;
  const safer =
    Array.isArray(builderSteps) &&
    builderSteps.some((step) => plainRecord(step)?.default !== undefined || plainRecord(step)?.upTo !== undefined);
  if (!declaresApi(87) && safer) {
    return "A ruleset whose builder starts on a method or limits a step by a sheet value requires schemaVersion 2 and capabilityApi 1.87 or newer";
  }
  return null;
}

export function getCapabilityAgentDetailDefinitionIssue(
  agentId: string,
  agentDefinitions: readonly PackagedAgentDefinition[],
): string | null {
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  return definition && (definition.execution === "feature" || definition.execution === "host")
    ? null
    : `Agent detail contribution ${agentId} must identify a feature or host agent from this package`;
}

/** The names an official entry's artifact may be published under: a ruleset's as its ruleset package file and an
 *  Experience's as its Experience file, each first, else `<id>-<version>.zip`. A zip of either stays a name the
 *  catalog may list (the install refuses it, saying why), so an official catalog that still lists one keeps loading. */
function officialArtifactNames(entry: CapabilityCatalogPackage): string[] {
  const base = `${entry.manifest.id}-${entry.manifest.version}`;
  const { kind } = entry.manifest;
  // The same kinds the install takes as files: a ruleset as its ruleset file, an Experience as its file.
  return [
    ...(kind.includes("ruleset") ? [`${base}${RULESET_PACKAGE_FILE_EXTENSION}`] : []),
    ...(kind.includes("experience") ? [`${base}${EXPERIENCE_FILE_EXTENSION}`] : []),
    `${base}.zip`,
  ];
}

/** Which of its canonical names an official entry's artifact URL is under, on main or the catalog's branch. */
function officialArtifactName(entry: CapabilityCatalogPackage, branch: OfficialAgentBranch): string | null {
  return (
    officialArtifactNames(entry).find(
      (name) =>
        entry.artifact.url === `${officialArtifactRoot("main")}/${name}` ||
        entry.artifact.url === `${officialArtifactRoot(branch)}/${name}`,
    ) ?? null
  );
}

export function getCapabilityPackageArtifactSourceIssue(
  entry: CapabilityCatalogPackage,
  catalogUrl = CATALOG_URL,
): string | null {
  const branch = getOfficialAgentBranchFromCatalogUrl(catalogUrl);
  if (!branch) return null;
  if (!officialArtifactName(entry, branch)) {
    return `Official package ${entry.manifest.id} must use its canonical Marinara-Agents artifact URL`;
  }
  // Its language packs (1.811) sit beside it, each under its own canonical name.
  for (const [locale, pack] of Object.entries(entry.locales ?? {})) {
    const packName = rulesetLocalePackFileName(entry.manifest.id, entry.manifest.version, locale);
    if (
      pack.url !== `${officialArtifactRoot("main")}/${packName}` &&
      pack.url !== `${officialArtifactRoot(branch)}/${packName}`
    )
      return `Official package ${entry.manifest.id} must use its canonical Marinara-Agents ${locale} language pack URL`;
  }
  return null;
}

function getOfficialAgentBranchFromCatalogUrl(catalogUrl: string): OfficialAgentBranch | null {
  for (const branch of ["main", "staging"] as const) {
    if (catalogUrl.startsWith(`${officialCatalogRoot(branch)}/`)) return branch;
  }
  return null;
}

export function resolveCapabilityPackageArtifactUrl(entry: CapabilityCatalogPackage, catalogUrl = CATALOG_URL): string {
  const branch = getOfficialAgentBranchFromCatalogUrl(catalogUrl);
  if (!branch) return entry.artifact.url;
  // On the catalog's own branch, under the name it is published as.
  return `${officialArtifactRoot(branch)}/${officialArtifactName(entry, branch) ?? officialArtifactNames(entry)[0]}`;
}

/** Each language pack's URL (1.811), on the catalog's own branch as the artifact's is. */
function resolveCapabilityPackageLocaleUrls(
  entry: CapabilityCatalogPackage,
  catalogUrl = CATALOG_URL,
): CapabilityCatalogPackage["locales"] {
  const branch = getOfficialAgentBranchFromCatalogUrl(catalogUrl);
  if (!branch || !entry.locales) return entry.locales;
  return Object.fromEntries(
    Object.entries(entry.locales).map(([locale, pack]) => [
      locale,
      {
        ...pack,
        url: `${officialArtifactRoot(branch)}/${rulesetLocalePackFileName(entry.manifest.id, entry.manifest.version, locale)}`,
      },
    ]),
  );
}

export function resolveCapabilityPackageIconUrl(
  entry: CapabilityCatalogPackage,
  catalogUrl = CATALOG_URL,
): string | undefined {
  const branch = getOfficialAgentBranchFromCatalogUrl(catalogUrl);
  if (!branch || !entry.iconUrl) return entry.iconUrl;
  return `${officialArtworkRoot(branch)}/${entry.manifest.id}.png`;
}

async function readInstalledAgentDefinitions(installed: InstalledCapabilityPackage) {
  const entrypoint = installed.manifest.entrypoints.agents;
  if (!entrypoint) return [];
  const file = await verifyInstalledPackageFile(installed, entrypoint);
  return packagedAgentDefinitionsSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

async function hydratePreviousManifest(installed: InstalledCapabilityPackage): Promise<InstalledCapabilityPackage> {
  if (installed.previousManifest || !installed.previousVersion) return installed;
  const manifestFile = inside(VERSIONS, join(VERSIONS, installed.id, installed.previousVersion, "manifest.json"));
  if (!existsSync(manifestFile)) return installed;
  const previousManifest = capabilityPackageManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
  if (previousManifest.id !== installed.id || previousManifest.version !== installed.previousVersion) return installed;
  return { ...installed, previousManifest };
}

async function resolveServableInstalledPackage(
  installed: InstalledCapabilityPackage,
): Promise<InstalledCapabilityPackage | null> {
  if (isInstalledCapabilityReady(installed)) return installed;
  const hydrated = await hydratePreviousManifest(installed);
  if (hydrated.status !== "restart-required" || !hydrated.previousVersion || !hydrated.previousManifest) return null;
  return {
    ...hydrated,
    version: hydrated.previousVersion,
    manifest: hydrated.previousManifest,
  };
}

type VerifiedInstalledPackageFile = { file: string; data: Buffer };

async function readVerifiedInstalledPackageFile(
  installed: InstalledCapabilityPackage,
  relativePath: string,
): Promise<VerifiedInstalledPackageFile> {
  const normalized = normalizeArchivePath(relativePath);
  const declaration = installed.manifest.files.find((item) => normalizeArchivePath(item.path) === normalized);
  if (!declaration) throw new Error(`Package ${installed.id} requested undeclared file ${normalized}`);
  const packageRoot = inside(VERSIONS, join(VERSIONS, installed.id, installed.version));
  const file = inside(packageRoot, join(packageRoot, normalized));
  const [canonicalRoot, canonicalFile, before] = await Promise.all([
    realpath(packageRoot),
    realpath(file),
    lstat(file, { bigint: true }),
  ]);
  if (!before.isFile() || canonicalFile !== inside(canonicalRoot, join(canonicalRoot, normalized))) {
    throw new Error(`Installed package ${installed.id} contains a non-canonical file for ${normalized}`);
  }
  const data = await readFile(file);
  const after = await lstat(file, { bigint: true });
  if (
    !after.isFile() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    data.byteLength !== declaration.bytes ||
    createHash("sha256").update(data).digest("hex") !== declaration.sha256
  ) {
    throw new Error(`Installed package ${installed.id} failed integrity verification for ${normalized}`);
  }
  return { file, data };
}

async function verifyInstalledPackageFile(
  installed: InstalledCapabilityPackage,
  relativePath: string,
): Promise<string> {
  return (await readVerifiedInstalledPackageFile(installed, relativePath)).file;
}

async function verifyInstalledPackageFiles(
  installed: InstalledCapabilityPackage,
): Promise<Map<string, VerifiedInstalledPackageFile>> {
  const verified = new Map<string, VerifiedInstalledPackageFile>();
  for (const declaration of installed.manifest.files) {
    verified.set(
      normalizeArchivePath(declaration.path),
      await readVerifiedInstalledPackageFile(installed, declaration.path),
    );
  }
  return verified;
}

async function readInstalledAgentIds(installed: InstalledCapabilityPackage): Promise<string[]> {
  const ids = new Set([installed.id]);
  try {
    for (const definition of await readInstalledAgentDefinitions(installed)) ids.add(definition.id);
  } catch (error) {
    logger.warn(error, "Could not read agent definitions for package %s during cleanup", installed.id);
  }
  return [...ids];
}

export function findCompatibleCapabilityPackageUpdates(
  installedPackages: InstalledCapabilityPackage[],
  catalog: CapabilityCatalog,
  engineVersion = APP_VERSION,
) {
  const catalogById = new Map(catalog.packages.map((entry) => [entry.manifest.id, entry]));
  return installedPackages.flatMap((installed) => {
    if (NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(installed.id)) return [];
    const entry = catalogById.get(installed.id);
    if (!entry) return [];
    if (compareCapabilityPackageVersions(entry.manifest.version, installed.version) <= 0) return [];
    if (getCapabilityApiCompatibilityIssue(entry.manifest) || !supportsEngineVersion(entry, engineVersion)) return [];
    return [{ installed, entry }];
  });
}

/** Decorate pending updates with the notes published for every version they install:
 *  each version above the installed one, up to and including the target, newest first.
 *
 *  Pure and separate from the fetch so the mapping is testable without a network,
 *  and so a notes document that is absent, unreadable, or has nothing in range for
 *  this package provably returns the update list unchanged. */
export function attachCapabilityReleaseNotes(
  updates: CapabilityPackageUpdate[],
  notes: CapabilityReleaseNotes | null,
): CapabilityPackageUpdate[] {
  if (!notes) return updates;
  return updates.map((update) => {
    const inRange = (notes.packages[update.id]?.versions ?? [])
      .filter(
        (entry) =>
          compareCapabilityPackageVersions(entry.version, update.installedVersion) > 0 &&
          compareCapabilityPackageVersions(entry.version, update.version) <= 0,
      )
      .sort((left, right) => compareCapabilityPackageVersions(right.version, left.version));
    if (inRange.length === 0) return update;
    return { ...update, releaseNotes: inRange, releaseHighlight: inRange.some((entry) => entry.highlight) };
  });
}

export function findPendingCapabilityPackageUpdates(
  installedPackages: InstalledCapabilityPackage[],
  catalog: CapabilityCatalog,
  declinedVersions: Readonly<Record<string, string>> = {},
  engineVersion = APP_VERSION,
): CapabilityPackageUpdate[] {
  return findCompatibleCapabilityPackageUpdates(installedPackages, catalog, engineVersion)
    .filter(({ installed, entry }) => declinedVersions[installed.id] !== entry.manifest.version)
    .map(({ installed, entry }) => ({
      id: installed.id,
      name: entry.manifest.name,
      installedVersion: installed.version,
      version: entry.manifest.version,
      artifactSha256: entry.artifact.sha256,
      restartRequired: entry.manifest.restartRequired,
    }));
}

/** An Experience owns the Game surface. Since 1.373 one comes only as an Experience file, never a package zip. */
function isCatalogExperience(entry: CapabilityCatalogPackage) {
  return (
    entry.manifest.kind.includes("experience") || (entry.manifest.contributions?.slots ?? []).includes("game-surface")
  );
}

function isExperienceFileArtifact(entry: CapabilityCatalogPackage) {
  try {
    return new URL(entry.artifact.url).pathname.toLowerCase().endsWith(EXPERIENCE_FILE_EXTENSION);
  } catch {
    return false;
  }
}

/** A ruleset in the catalog comes as a ruleset package file (Capability API 1.374), never a package zip. */
const RULESET_FILE_CAPABILITY_MINOR = 374;

function isRulesetFileArtifact(entry: CapabilityCatalogPackage) {
  try {
    return new URL(entry.artifact.url).pathname.toLowerCase().endsWith(RULESET_PACKAGE_FILE_EXTENSION);
  } catch {
    return false;
  }
}

/** A downloaded package's files, as a zip's entries are read: by name, size and verified bytes. */
type PackageEntry = { entryName: string; size: number; read(maximum: number): Buffer };

/** A ruleset package file, read by the reader a player's ruleset import uses: its manifest as manifest.json,
 *  then each document as the bytes the manifest lists (which that reader has checked by size and sha256). */
function readRulesetFileEntries(bytes: Buffer): PackageEntry[] {
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("This is not a ruleset package file.");
  }
  const read = readRulesetPackageFile(document);
  if (!read.ok) throw new Error(`The ruleset package file does not read: ${read.issues.join("; ")}`);
  const files = (document as { files: Record<string, string> }).files;
  const manifest = Buffer.from(read.manifest);
  return [
    { entryName: "manifest.json", size: manifest.length, read: () => manifest },
    ...Object.entries(files).map(([name, base64]) => {
      const data = Buffer.from(base64, "base64");
      return { entryName: name, size: data.length, read: () => data };
    }),
  ];
}

// ── A ruleset's language packs (Capability API 1.811) ──
// A catalog ruleset's translations are not in its file: the catalog lists one pack per language,
// `<id>-<version>.<lang>.json`, pinned by sha256 and size. Only the pack in the language the Engine is
// set to is fetched, kept in the installed version's folder under that name. Each install and each
// change of language fetches the one wanted and removes every other, so a version kept for rollback
// holds none. Without a pack (offline, none listed, one that is not the file listed) the ruleset reads
// in English, as it always could; the next install or change of language tries again.

const RULESET_LANGUAGE = join(ROOT, "ruleset-language-v1.json");
/** One change of language at a time, so two pages cannot interleave their fetches and removals. */
let rulesetLanguageQueue: Promise<unknown> = Promise.resolve();

/** The language the Engine was last set to, for the packs: English until a page says otherwise. */
async function readRulesetLanguage(): Promise<string> {
  try {
    const parsed = JSON.parse(await readFile(RULESET_LANGUAGE, "utf8")) as {
      schemaVersion?: unknown;
      language?: unknown;
    };
    return parsed.schemaVersion === 1 && typeof parsed.language === "string" && isRulesetLocaleCode(parsed.language)
      ? parsed.language
      : "en";
  } catch {
    return "en";
  }
}

async function writeRulesetLanguage(language: string) {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${RULESET_LANGUAGE}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, language }), { mode: 0o600 });
  await rename(temporary, RULESET_LANGUAGE);
}

function rulesetLocalePackFile(packageId: string, version: string, locale: string): string {
  const packageRoot = inside(VERSIONS, join(VERSIONS, packageId, version));
  return inside(packageRoot, join(packageRoot, rulesetLocalePackFileName(packageId, version, locale)));
}

/** The packs kept in one installed version's folder, by language. */
async function keptRulesetLocalePacks(packageId: string, version: string): Promise<Map<string, string>> {
  const prefix = `${packageId}-${version}.`;
  const kept = new Map<string, string>();
  const entries = await readdir(inside(VERSIONS, join(VERSIONS, packageId, version)), { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith(".json")) continue;
    const locale = entry.name.slice(prefix.length, -".json".length);
    if (isRulesetLocaleCode(locale)) kept.set(locale, rulesetLocalePackFile(packageId, version, locale));
  }
  return kept;
}

/** A downloaded pack, held to what the catalog lists for it and read as a translation; throws why not. */
function verifyRulesetLocalePack(
  data: Buffer,
  pack: { sha256: string; bytes: number },
  locale: string,
  name: string,
): Record<string, string> {
  if (data.byteLength !== pack.bytes) throw new Error(`${name} is not the size the catalog lists`);
  if (createHash("sha256").update(data).digest("hex") !== pack.sha256)
    throw new Error(`${name} does not match the checksum the catalog lists`);
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
  const read = readRulesetLocaleFile(document, locale, { name, pack: true });
  if (!read.ok) throw new Error(read.issue);
  return read.strings;
}

/** Whether a kept pack's bytes still read as a translation in `locale`, whatever the catalog lists now. */
function stillReadsAsPack(data: Buffer, locale: string, name: string): boolean {
  try {
    const document: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
    return readRulesetLocaleFile(document, locale, { name, pack: true }).ok;
  } catch {
    return false;
  }
}

export type RulesetLocalePackOutcome = "stored" | "kept" | "none" | "failed";

/**
 * Brings one installed ruleset's pack to `language`: the pack the catalog entry lists for it (or for the
 * language it is a kind of) is fetched, checked and kept, unless the very file is already there; then every
 * other pack of the package, in any of its versions, is removed. Without an entry for the installed version
 * (the catalog unread, or no longer listing that version) a pack already kept in the language stays, the
 * rest go. Never throws.
 */
async function syncRulesetLocalePack(
  installed: InstalledCapabilityPackage,
  language: string,
  entry: CapabilityCatalogPackage | null,
  download: (url: string, maximum: number) => Promise<Buffer> = fetchBytes,
): Promise<RulesetLocalePackOutcome> {
  let outcome: RulesetLocalePackOutcome = "none";
  let keep: string | null = null;
  try {
    const kept = await keptRulesetLocalePacks(installed.id, installed.version);
    const languages = rulesetTranslationLanguages(language);
    if (!entry || entry.manifest.id !== installed.id || entry.manifest.version !== installed.version) {
      keep = languages.map((each) => kept.get(each)).find((file) => file !== undefined) ?? null;
      if (keep) outcome = "kept";
    } else {
      const locale = languages.find((each) => entry.locales?.[each]);
      const pack = locale ? entry.locales![locale]! : null;
      if (locale && pack) {
        const file = rulesetLocalePackFile(installed.id, installed.version, locale);
        const name = rulesetLocalePackFileName(installed.id, installed.version, locale);
        const existing = kept.has(locale) ? await readFile(file).catch(() => null) : null;
        let already = false;
        if (existing) {
          try {
            verifyRulesetLocalePack(existing, pack, locale, name);
            already = true;
          } catch {
            // Not the file listed now: fetched again below.
          }
        }
        if (already) {
          keep = file;
          outcome = "kept";
        } else {
          try {
            const data = await download(pack.url, Math.min(pack.bytes + 1, RULESET_LOCALE_MAX_BYTES + 1));
            verifyRulesetLocalePack(data, pack, locale, name);
            const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
            await writeFile(temporary, data, { mode: 0o600 });
            await rename(temporary, file);
            keep = file;
            outcome = "stored";
          } catch (error) {
            logger.warn(
              error,
              "[capability/rulesets] The %s language pack of %s %s was not kept; it reads in English",
              locale,
              installed.id,
              installed.version,
            );
            outcome = "failed";
            // The pack already kept in this language stays until a replacement is stored, while it
            // still reads as a translation.
            if (existing && stillReadsAsPack(existing, locale, name)) keep = file;
          }
        }
      }
    }
    await pruneRulesetLocalePacks(installed.id, keep);
  } catch (error) {
    logger.warn(error, "[capability/rulesets] Could not bring the language packs of %s up to date", installed.id);
    return "failed";
  }
  return outcome;
}

/** Removes every pack of a package, in every version kept, but `keep`. */
async function pruneRulesetLocalePacks(packageId: string, keep: string | null) {
  const versions = await readdir(inside(VERSIONS, join(VERSIONS, packageId)), { withFileTypes: true }).catch(() => []);
  for (const version of versions) {
    if (!version.isDirectory()) continue;
    for (const file of (await keptRulesetLocalePacks(packageId, version.name)).values()) {
      if (file !== keep) await rm(file, { force: true });
    }
  }
}

/** The pack an installed ruleset keeps in `locale`, read: null when none is kept in that language. */
async function readRulesetLocalePack(
  installed: InstalledCapabilityPackage,
  locale: string,
): Promise<{ sha256: string; data: Buffer } | { issue: string } | null> {
  if (!isRulesetLocaleCode(locale)) return null;
  const name = rulesetLocalePackFileName(installed.id, installed.version, locale);
  let data: Buffer;
  try {
    const file = rulesetLocalePackFile(installed.id, installed.version, locale);
    const stats = await lstat(file);
    if (!stats.isFile()) return null;
    if (stats.size > RULESET_LOCALE_MAX_BYTES)
      return { issue: `${name} is ${stats.size} bytes, over the ${RULESET_LOCALE_MAX_BYTES}-byte limit` };
    data = await readFile(file);
  } catch {
    return null;
  }
  return { sha256: createHash("sha256").update(data).digest("hex"), data };
}

/** Installs a catalog entry through the caller's download rather than the network, for regressions. */
export function installCatalogPackageForTests(
  entry: CapabilityCatalogPackage,
  download: (url: string, maximum: number) => Promise<Buffer>,
) {
  return installCatalogPackage(entry, false, download);
}

/** A catalog Experience the Engine will install: a data-only Experience published as an Experience file. */
function isInstallableCatalogExperience(entry: CapabilityCatalogPackage) {
  return entry.manifest.kind.includes("experience") && isExperienceFileArtifact(entry);
}

async function installCatalogPackage(
  entry: CapabilityCatalogPackage,
  activateDuringStartup = false,
  download: (url: string, maximum: number) => Promise<Buffer> = fetchBytes,
) {
  const { manifest, artifact } = entry;
  const isRuleset = manifest.kind.includes("ruleset");
  if (isRuleset && !isRulesetFileArtifact(entry)) {
    throw new Error(
      `${manifest.name} is a ruleset packaged as a zip. Rulesets install only from a ${RULESET_PACKAGE_FILE_EXTENSION} file.`,
    );
  }
  if (isRuleset && artifact.bytes > RULESET_PACKAGE_FILE_MAX_BYTES) {
    throw new Error(`${manifest.name} is larger than a ruleset package file may be`);
  }
  if (
    isRuleset &&
    (manifest.schemaVersion === 1 ||
      (manifest.capabilityApi.major === 1 && manifest.capabilityApi.minor < RULESET_FILE_CAPABILITY_MINOR))
  ) {
    throw new Error(
      `A ruleset published as a ruleset file needs Capability API 1.${RULESET_FILE_CAPABILITY_MINOR} or newer`,
    );
  }
  // A catalog ruleset's translations are its language packs (1.811), never files inside it.
  if (isRuleset && (manifest.contributions?.assets?.paths ?? []).some(isRulesetLocaleAssetPath)) {
    throw new Error(
      `${manifest.name} carries its translations inside its file. A catalog ruleset lists them as language packs.`,
    );
  }

  if (isCatalogExperience(entry) && !isInstallableCatalogExperience(entry)) {
    throw new Error(
      `${manifest.name} is an Experience packaged as a zip. Experiences install only from an ${EXPERIENCE_FILE_EXTENSION} file.`,
    );
  }
  const installIssue = getCapabilityPackageInstallIssue(manifest);
  if (installIssue) throw new CapabilityPackageCompatibilityError(installIssue);
  const initiallyInstalled = await readInstalledVersion(manifest.id);
  assertNotDowngrade(initiallyInstalled, manifest.version);
  const capabilityApiIssue = getCapabilityApiCompatibilityIssue(manifest);
  if (capabilityApiIssue) throw new CapabilityPackageCompatibilityError(capabilityApiIssue);
  if (!supportsEngineVersion(entry, APP_VERSION)) {
    throw new CapabilityPackageCompatibilityError(
      `Package requires Marinara Engine ${manifest.engine.min} to below ${manifest.engine.maxExclusive}`,
    );
  }
  const archive = await download(artifact.url, Math.min(artifact.bytes + 1, MAX_ARTIFACT_BYTES));
  if (archive.byteLength !== artifact.bytes) throw new Error("Downloaded package size does not match the catalog");
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== artifact.sha256) throw new Error("Downloaded package checksum does not match the catalog");
  if (isCatalogExperience(entry)) {
    // The same reader, checks and sanitizing as an Experience file a player imports, held to the catalog's manifest.
    const installed = await installExperienceFile(
      (async function* () {
        yield new Uint8Array(archive);
      })(),
      { expectedManifest: manifest, activateDuringStartup },
    );
    return { ...installed, usesDecisions: false };
  }

  let entries: PackageEntry[];
  if (isRuleset) entries = readRulesetFileEntries(archive);
  else {
    const zip = openZipArchive(archive, PACKAGE_ARCHIVE_BUDGET);
    entries = validatePackageArchiveEntries(zip);
  }
  const manifestEntry = entries.find((item) => item.entryName === "manifest.json");
  if (!manifestEntry || manifestEntry.size > MAX_MANIFEST_BYTES) {
    throw new Error("Package manifest is missing or too large");
  }
  const manifestBytes = manifestEntry.read(MAX_MANIFEST_BYTES);
  const installedManifest = capabilityPackageManifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")));
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) {
    throw new Error("Artifact manifest does not match the catalog");
  }
  const declaredFiles = new Map(installedManifest.files.map((file) => [normalizeArchivePath(file.path), file]));
  if (declaredFiles.size !== installedManifest.files.length)
    throw new Error("Package manifest declares duplicate files");
  // Case-folded too: on the case-insensitive filesystems this app ships to,
  // case-only "distinct" declarations extract onto a single file and the
  // losing declaration's hash can never verify (review finding on #5091).
  const caseFoldedPaths = new Set(installedManifest.files.map((file) => normalizeArchivePath(file.path).toLowerCase()));
  if (caseFoldedPaths.size !== installedManifest.files.length)
    throw new Error("Package manifest declares files that collide on case-insensitive filesystems");
  const payloadEntries = entries.filter((item) => item.entryName !== "manifest.json");
  if (payloadEntries.length !== declaredFiles.size) throw new Error("Package contains undeclared or missing files");
  const verifiedFiles = new Map<string, Buffer>();
  for (const item of payloadEntries) {
    const name = normalizeArchivePath(item.entryName);
    const declaration = declaredFiles.get(name);
    if (!declaration) throw new Error(`Package contains undeclared file ${name}`);
    if (item.size !== declaration.bytes) throw new Error(`Package file size mismatch for ${name}`);
    const data = item.read(declaration.bytes);
    if (createHash("sha256").update(data).digest("hex") !== declaration.sha256) {
      throw new Error(`Package file checksum mismatch for ${name}`);
    }
    verifiedFiles.set(name, data);
  }
  for (const entrypoint of Object.values(installedManifest.entrypoints)) {
    if (entrypoint && !declaredFiles.has(normalizeArchivePath(entrypoint))) {
      throw new Error(`Package entrypoint is not declared: ${entrypoint}`);
    }
  }
  const agentDetailIds = installedManifest.contributions?.agentDetail?.agentIds ?? [];
  if (agentDetailIds.length > 0 && !installedManifest.entrypoints.client) {
    throw new Error("Agent detail contributions require a client entrypoint");
  }
  if (agentDetailIds.length > 0 && !installedManifest.entrypoints.agents) {
    throw new Error("Agent detail contributions require agent definitions");
  }
  let usesDecisions = false;
  if (installedManifest.entrypoints.agents) {
    const agentsPath = normalizeArchivePath(installedManifest.entrypoints.agents);
    const agentsFile = verifiedFiles.get(agentsPath);
    if (!agentsFile) throw new Error("Package agent definitions are missing");
    const agentDefinitions = packagedAgentDefinitionsSchema.parse(JSON.parse(agentsFile.toString("utf8")));
    usesDecisions = containsDecisionStatements(agentDefinitions);
    for (const agentId of agentDetailIds) {
      const detailIssue = getCapabilityAgentDetailDefinitionIssue(agentId, agentDefinitions);
      if (detailIssue) throw new Error(detailIssue);
    }
  }
  // Run again now that the ruleset's verified bytes are here: what the manifest could be judged on
  // was already checked before the download, and this adds the one gate that needs the file itself.
  const rulesetBytes = verifiedFiles.get(RULESET_ASSET_PATH);
  if (rulesetBytes) {
    let rulesetDocument: unknown;
    try {
      rulesetDocument = JSON.parse(rulesetBytes.toString("utf8"));
    } catch {
      rulesetDocument = undefined;
    }
    // The catalog files are here too, and a scaled row can sit in one of them rather than inline.
    const catalogDocuments = new Map<string, unknown>();
    for (const [name, data] of verifiedFiles) {
      if (!isRulesetCatalogAssetPath(name)) continue;
      try {
        catalogDocuments.set(name, JSON.parse(data.toString("utf8")));
      } catch {
        // An unreadable catalog file is the catalog route's story to tell, with the author's own
        // issue lines; it has never been a reason to refuse the install.
      }
    }
    const rulesetIssue = getCapabilityPackageInstallIssue(installedManifest, rulesetDocument, catalogDocuments);
    if (rulesetIssue) throw new Error(rulesetIssue);
  }

  const temporary = join(ROOT, `.install-${manifest.id}-${Date.now()}`);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    await writeFile(join(temporary, "manifest.json"), manifestBytes, { mode: 0o600 });
    for (const [name, data] of verifiedFiles) {
      const output = inside(temporary, join(temporary, name));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, data, { mode: 0o600 });
    }
    const installed = await commitPackageInstall(manifest, temporary, activateDuringStartup);
    // Then its pack in the Engine's language, if the catalog lists one; the version before it keeps none.
    if (isRuleset) await syncRulesetLocalePack(installed, await readRulesetLanguage(), entry, download);
    return { ...installed, usesDecisions };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Moves a package's verified files, written to `temporary`, into place and records it installed. */
async function commitPackageInstall(
  manifest: CapabilityPackageManifest,
  temporary: string,
  activateDuringStartup = false,
): Promise<InstalledCapabilityPackage> {
  const destination = join(VERSIONS, manifest.id, manifest.version);
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await rename(temporary, destination);
  const registry = await readRegistry();
  const registryPrevious = registry.packages.find((item) => item.id === manifest.id);
  const previous = registryPrevious ? await hydratePreviousManifest(registryPrevious) : undefined;
  assertNotDowngrade(await readInstalledVersion(manifest.id), manifest.version);
  const activePrevious =
    previous?.status === "restart-required" && previous.previousVersion && previous.previousManifest
      ? { version: previous.previousVersion, manifest: previous.previousManifest }
      : previous
        ? { version: previous.version, manifest: previous.manifest }
        : null;
  const installed: InstalledCapabilityPackage = {
    id: manifest.id,
    version: manifest.version,
    manifest,
    installedAt: new Date().toISOString(),
    status: manifest.restartRequired && !activateDuringStartup ? "restart-required" : "active",
    error: null,
    readiness: manifest.entrypoints.server ? "pending" : "ready",
    readinessError: null,
    legacy: false,
    ...(activePrevious && activePrevious.version !== manifest.version
      ? { previousVersion: activePrevious.version, previousManifest: activePrevious.manifest }
      : {}),
  };
  await writeRegistry([...registry.packages.filter((item) => item.id !== manifest.id), installed]);
  try {
    await clearDeclinedUpdate(manifest.id);
  } catch (error) {
    logger.warn(error, "Could not clear the deferred update marker for capability package %s", manifest.id);
  }
  return installed;
}

/**
 * Installs an Experience file (Capability API 1.373) as it streams in: a data-only Experience, its manifest
 * checked before any file is kept, each file written straight to disk as it decodes and checked against
 * the manifest's size and sha256, so neither the upload nor any one file is ever held whole. Anything
 * out of place stops the import and removes what it wrote.
 */
async function installExperienceFile(
  source: AsyncIterable<Uint8Array>,
  options: { expectedManifest?: CapabilityPackageManifest; activateDuringStartup?: boolean } = {},
): Promise<InstalledCapabilityPackage> {
  /** A check shared with catalog installs, its refusal told as the file's. */
  const fileCheck = <T>(check: () => T): T => {
    try {
      return check();
    } catch (error) {
      throw new ExperienceFileError(error instanceof Error ? error.message : String(error));
    }
  };
  const reader = new ExperienceFileReader();
  const temporary = join(ROOT, `.import-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  let manifest: CapabilityPackageManifest | null = null;
  let rawManifest: unknown = null;
  let declared = new Map<string, CapabilityPackageManifest["files"][number]>();
  const written = new Set<string>();
  let current: {
    path: string;
    declaration: CapabilityPackageManifest["files"][number];
    hash: ReturnType<typeof createHash>;
    bytes: number;
    handle: FileHandle;
  } | null = null;

  const onManifest = async (raw: unknown) => {
    const read = readExperienceFileManifest(raw);
    if (!read.ok) throw new ExperienceFileError(`This Experience file cannot be imported: ${read.issues.join("; ")}`);
    const next = read.manifest;
    if (options.expectedManifest && JSON.stringify(next) !== JSON.stringify(options.expectedManifest)) {
      throw new ExperienceFileError("The Experience file's manifest does not match the catalog");
    }
    const issue = getCapabilityApiCompatibilityIssue(next) ?? getCapabilityPackageInstallIssue(next);
    if (issue) throw new ExperienceFileError(issue);
    if (
      compareCapabilityPackageVersions(APP_VERSION, next.engine.min) < 0 ||
      compareCapabilityPackageVersions(APP_VERSION, next.engine.maxExclusive) >= 0
    ) {
      throw new ExperienceFileError(
        `This Experience needs Marinara Engine ${next.engine.min} to below ${next.engine.maxExclusive}`,
      );
    }
    const existing = (await readRegistry()).packages.find((item) => item.id === next.id);
    if (existing && !existing.manifest.kind.includes("experience")) {
      throw new ExperienceFileError(
        `${existing.manifest.name} is already installed under the id ${next.id}, and it is not an Experience`,
      );
    }
    const installedVersion = await readInstalledVersion(next.id);
    fileCheck(() => assertNotDowngrade(installedVersion, next.version));
    declared = new Map(next.files.map((file) => [fileCheck(() => normalizeArchivePath(file.path)), file]));
    if (declared.size !== next.files.length) throw new ExperienceFileError("The manifest lists a file twice");
    const caseFolded = new Set([...declared.keys()].map((path) => path.toLowerCase()));
    if (caseFolded.size !== declared.size) {
      throw new ExperienceFileError("The manifest lists files whose names differ only in case");
    }
    if (declared.has("manifest.json")) throw new ExperienceFileError("manifest.json is the manifest's own name");
    const needed = next.files.reduce((total, file) => total + file.bytes, 0);
    await mkdir(ROOT, { recursive: true });
    const space = await statfs(ROOT).catch(() => null);
    if (space && Number(space.bavail) * Number(space.bsize) < needed + 16 * 1024 * 1024) {
      throw new ExperienceFileError("There is not enough free disk space to import this Experience");
    }
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    manifest = next;
    rawManifest = raw;
  };

  try {
    const handle = async (event: ExperienceFileEvent) => {
      switch (event.type) {
        case "manifest":
          await onManifest(event.manifest);
          return;
        case "file-start": {
          const path = fileCheck(() => normalizeArchivePath(event.path));
          const declaration = declared.get(path);
          if (!declaration)
            throw new ExperienceFileError(`The Experience file holds ${path}, which its manifest does not list`);
          const output = inside(temporary, join(temporary, path));
          await mkdir(dirname(output), { recursive: true });
          current = {
            path,
            declaration,
            hash: createHash("sha256"),
            bytes: 0,
            handle: await open(output, "wx", 0o600),
          };
          return;
        }
        case "file-data": {
          const file = current!;
          file.bytes += event.data.length;
          if (file.bytes > file.declaration.bytes) {
            throw new ExperienceFileError(`${file.path} is larger than its manifest says`);
          }
          file.hash.update(event.data);
          await file.handle.write(event.data);
          return;
        }
        case "file-end": {
          const file = current!;
          current = null;
          await file.handle.close();
          if (file.bytes !== file.declaration.bytes) {
            throw new ExperienceFileError(`${file.path} is not the size its manifest says`);
          }
          if (file.hash.digest("hex") !== file.declaration.sha256) {
            throw new ExperienceFileError(`${file.path} does not match its manifest's checksum`);
          }
          written.add(file.path);
          return;
        }
        case "end":
          return;
      }
    };
    for await (const chunk of source) {
      for (const event of reader.push(chunk)) await handle(event);
    }
    for (const event of reader.finish()) await handle(event);
    if (!manifest) throw new ExperienceFileError("The Experience file has no manifest");
    const missing = [...declared.keys()].filter((path) => !written.has(path));
    if (missing.length) {
      throw new ExperienceFileError(`The Experience file is missing ${missing.slice(0, 3).join(", ")}`);
    }
    // Each file is kept only as what it says it is, without its metadata; the installed manifest
    // records the bytes that are stored, so serving still verifies every file.
    const stored = new Map<string, { sha256: string; bytes: number }>();
    for (const path of written) {
      const output = inside(temporary, join(temporary, path));
      const original = await readFile(output);
      const sanitized = sanitizeExperienceAsset(path, original);
      if (sanitized.equals(original)) continue;
      await writeFile(output, sanitized, { mode: 0o600 });
      stored.set(path, { sha256: createHash("sha256").update(sanitized).digest("hex"), bytes: sanitized.length });
    }
    const restate = <T extends { path: string; sha256: string; bytes: number }>(file: T): T => {
      const replaced = stored.get(normalizeArchivePath(file.path));
      return replaced ? { ...file, ...replaced } : file;
    };
    // Set by onManifest inside the reader's callbacks, which TypeScript does not follow.
    const read = manifest as CapabilityPackageManifest;
    const storedManifest: CapabilityPackageManifest = { ...read, files: read.files.map(restate) };
    const raw = rawManifest as { files: Array<{ path: string; sha256: string; bytes: number }> };
    const storedRaw = { ...raw, files: raw.files.map(restate) };
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(storedRaw, null, 2)}\n`, { mode: 0o600 });
    return await commitPackageInstall(storedManifest, temporary, options.activateDuringStartup);
  } finally {
    const unfinished = current as { handle: FileHandle } | null;
    if (unfinished) await unfinished.handle.close().catch(() => undefined);
    await rm(temporary, { recursive: true, force: true });
  }
}

function fetchCatalogDocument(url: string, fetchCatalog: typeof safeFetch) {
  return fetchCatalog(url, {
    policy: { allowedProtocols: ["https:"] },
    maxResponseBytes: 2 * 1024 * 1024,
    allowedContentTypes: ["application/json", "text/plain"],
    // The fixed catalog remains size-capped and must pass its Zod schema even
    // when a network intermediary strips the Content-Type header. text/plain is
    // also what raw.githubusercontent.com answers a missing overlay with, so the
    // absent-overlay case reaches the status check instead of being rejected as
    // a disallowed content type.
    allowMissingContentType: true,
    decodeCompressedResponse: true,
    headers: {
      Accept: "application/json, text/plain;q=0.9",
      "User-Agent": `MarinaraEngine/${APP_VERSION}`,
    },
    signal: AbortSignal.timeout(15_000),
    agentOptions: { bodyTimeout: 15_000, headersTimeout: 15_000 },
  });
}

/** Sort the merged catalog deterministically regardless of the server's locale. */
const CATALOG_SORT_COLLATOR = new Intl.Collator("en");

/** Staging-only entries from the preview overlay, or [] — never throws.
 *
 *  The overlay is absent whenever no package is marked staging-only, which is its
 *  normal steady state, and raw.githubusercontent.com answers that with a 404.
 *  catalog() has no cache and no stale fallback, so letting anything here
 *  propagate would blank the Agents browser and the update prompter for every
 *  package at once — an unreleased package is never worth that. */
async function fetchPreviewCatalogPackages(
  previewCatalogUrl: string | null,
  fetchCatalog: typeof safeFetch,
): Promise<CapabilityCatalogPackage[]> {
  if (!previewCatalogUrl) return [];
  try {
    const response = await fetchCatalogDocument(previewCatalogUrl, fetchCatalog);
    if (response.status === 404) {
      logger.debug("No Agent preview overlay is published at %s", previewCatalogUrl);
      return [];
    }
    if (!response.ok) {
      logger.warn("Agent preview overlay request failed with HTTP %d", response.status);
      return [];
    }
    const { catalog, droppedEntries, droppedIds } = parseCapabilityCatalogWithCompat(await response.json());
    if (droppedEntries > 0) {
      logger.warn(
        "Skipped %d Agent preview overlay entr%s this Engine version cannot parse: %s",
        droppedEntries,
        droppedEntries === 1 ? "y" : "ies",
        droppedIds.join(", "),
      );
    }
    return catalog.packages.filter((entry) => {
      // Dropped rather than fatal, unlike the published path: a tampered stable
      // catalog must stop everything, but one bad preview entry must not.
      const sourceIssue = getCapabilityPackageArtifactSourceIssue(entry, previewCatalogUrl);
      if (sourceIssue) logger.warn("Ignoring an Agent preview overlay entry: %s", sourceIssue);
      return !sourceIssue;
    });
  } catch (error) {
    logger.warn(error, "Could not read the Agent preview overlay; continuing with the published catalog");
    return [];
  }
}

/** Cached merged notes document, or null when nothing could be read.
 *
 *  One cache serves both the update prompt and the catalog detail sheet, so opening
 *  Download Agents right after dismissing a prompt costs no second request. */
let releaseNotesCache: { at: number; notes: CapabilityReleaseNotes | null } | null = null;

/** Read one notes document. Never throws and never rejects: notes are decoration.
 *
 *  Absent (404), unreachable, malformed, or over a cap all mean the same thing to
 *  every caller — no notes — and must leave installing and updating exactly as they
 *  behave on a catalog that publishes none. */
async function fetchReleaseNotesDocument(
  url: string,
  fetchNotes: typeof safeFetch,
): Promise<CapabilityReleaseNotes | null> {
  try {
    const response = await fetchCatalogDocument(url, fetchNotes);
    if (response.status === 404) {
      logger.debug("No Agent release notes are published at %s", url);
      return null;
    }
    if (!response.ok) {
      logger.warn("Agent release notes request failed with HTTP %d", response.status);
      return null;
    }
    const parsed = capabilityReleaseNotesSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn("Ignoring an Agent release notes document this Engine cannot parse: %s", parsed.error.message);
      return null;
    }
    return parsed.data;
  } catch (error) {
    logger.warn(error, "Could not read Agent release notes; continuing without them");
    return null;
  }
}

async function readReleaseNotes(
  fetchNotes: typeof safeFetch = safeFetch,
  notesUrl: string | null = RELEASE_NOTES_URL,
  previewNotesUrl: string | null = resolveCapabilityReleaseNotesUrl(PREVIEW_CATALOG_URL),
): Promise<CapabilityReleaseNotes | null> {
  if (releaseNotesCache && Date.now() - releaseNotesCache.at < RELEASE_NOTES_TTL_MS) return releaseNotesCache.notes;
  if (!notesUrl) {
    releaseNotesCache = { at: Date.now(), notes: null };
    return null;
  }
  const published = await fetchReleaseNotesDocument(notesUrl, fetchNotes);
  // Preview-overlay packages publish their notes in the overlay's own sidecar. A
  // published id always wins, mirroring how catalog() resolves the same collision.
  const preview = previewNotesUrl ? await fetchReleaseNotesDocument(previewNotesUrl, fetchNotes) : null;
  const notes =
    published || preview
      ? { schemaVersion: 1 as const, packages: { ...(preview?.packages ?? {}), ...(published?.packages ?? {}) } }
      : null;
  releaseNotesCache = { at: Date.now(), notes };
  return notes;
}

/** Test seam: drops the cached notes document so a regression can serve a new one. */
export function resetCapabilityReleaseNotesCache() {
  releaseNotesCache = null;
  storeCache.clear();
}

type CapabilityStoreListings = Map<string, CapabilityStoreListing>;
const withStoreListing = (store: CapabilityStoreListing | undefined) => (store ? { store } : {});
type StoreData = { listings: CapabilityStoreListings; kits: CapabilityStoreKit[] };
const storeCache = new Map<string, { at: number } & StoreData>();

/** A sidecar path as an absolute https URL on the sidecar's own origin, or undefined. */
// Same host, not same repo: on raw.githubusercontent.com any repo passes. Images only, so that is fine.
function resolveStoreAssetUrl(path: string | undefined, storeUrl: string): string | undefined {
  if (!path) return undefined;
  try {
    const url = new URL(path, storeUrl);
    return url.protocol === "https:" && url.origin === new URL(storeUrl).origin ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read one store sidecar. Like the notes it is decoration: a missing, unreachable or
 * malformed document yields no listings and the Organizer falls back to catalog
 * categories. Each entry is parsed on its own so one bad entry drops only itself.
 */
async function readStoreListings(storeUrl: string | null, fetchStore: typeof safeFetch): Promise<StoreData> {
  const listings: CapabilityStoreListings = new Map();
  const kits: CapabilityStoreKit[] = [];
  if (!storeUrl) return { listings, kits };
  const cached = storeCache.get(storeUrl);
  if (cached && Date.now() - cached.at < RELEASE_NOTES_TTL_MS) return cached;
  try {
    const response = await fetchCatalogDocument(storeUrl, fetchStore);
    if (response.ok) {
      const document = z
        .object({
          schemaVersion: z.literal(1),
          packages: z.record(z.string().max(80), z.unknown()),
          // Optional extras parse on their own below, so a bad one never drops the listings.
          kits: z.unknown().optional(),
        })
        .safeParse(await response.json());
      for (const [id, raw] of Object.entries(document.success ? document.data.packages : {})) {
        const entry = capabilityStoreEntrySchema.safeParse(raw);
        if (!entry.success) continue;
        const { iconPath, bannerPath, bannerSmallPath, previews, ...rest } = entry.data;
        const previewUrls = (previews ?? []).flatMap((path) => resolveStoreAssetUrl(path, storeUrl) ?? []);
        listings.set(id, {
          ...rest,
          iconUrl: resolveStoreAssetUrl(iconPath, storeUrl),
          bannerUrl: resolveStoreAssetUrl(bannerPath, storeUrl),
          bannerSmallUrl: resolveStoreAssetUrl(bannerSmallPath, storeUrl),
          ...(previewUrls.length ? { previewUrls } : {}),
        });
      }
      const kitList = z
        .array(z.unknown())
        .max(20)
        .safeParse(document.success ? (document.data.kits ?? []) : []);
      for (const raw of kitList.success ? kitList.data : []) {
        const kit = capabilityStoreKitSchema.safeParse(raw);
        if (kit.success) kits.push(kit.data);
      }
      if (!document.success) logger.warn("Ignoring an Agent store document this Engine cannot parse: %s", storeUrl);
    } else if (response.status !== 404) {
      logger.warn("Agent store request failed with HTTP %d", response.status);
    }
  } catch (error) {
    logger.warn(error, "Could not read Agent store data; continuing without it");
  }
  storeCache.set(storeUrl, { at: Date.now(), listings, kits });
  return { listings, kits };
}

export const capabilityPackageManager = {
  async catalog(
    fetchCatalog: typeof safeFetch = safeFetch,
    previewCatalogUrl: string | null = PREVIEW_CATALOG_URL,
  ): Promise<StampedCapabilityCatalog> {
    // Started first so a slow sidecar overlaps the catalog fetch; readStoreListings never rejects.
    const storesPromise = Promise.all([
      readStoreListings(STORE_URL, fetchCatalog),
      readStoreListings(resolveCapabilityReleaseNotesUrl(previewCatalogUrl, "store.json"), fetchCatalog),
    ]);
    const response = await fetchCatalogDocument(CATALOG_URL, fetchCatalog);
    if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
    // Per-entry tolerant: a catalog entry built for a NEWER Engine (unknown
    // manifest keys under this Engine's strict schemas) is dropped with a log
    // instead of failing the whole document — all-or-nothing parsing would
    // brick browsing, install, and updates for every package at once.
    const { catalog, droppedEntries, droppedIds } = parseCapabilityCatalogWithCompat(await response.json());
    if (droppedEntries > 0) {
      logger.warn(
        "Skipped %d Agent catalog entr%s this Engine version cannot parse (likely built for a newer Engine): %s",
        droppedEntries,
        droppedEntries === 1 ? "y" : "ies",
        droppedIds.join(", "),
      );
    }
    for (const entry of catalog.packages) {
      const sourceIssue = getCapabilityPackageArtifactSourceIssue(entry, CATALOG_URL);
      if (sourceIssue) throw new Error(sourceIssue);
    }
    const publishedIds = new Set(catalog.packages.map((entry) => entry.manifest.id));
    const previewPackages = (await fetchPreviewCatalogPackages(previewCatalogUrl, fetchCatalog)).filter((entry) => {
      // The overlay only ever holds packages the published lanes do NOT carry, so
      // an id in both means the catalog build is inconsistent. Keep what stable
      // users already receive and carry on rather than failing the catalog.
      if (!publishedIds.has(entry.manifest.id)) return true;
      logger.warn(
        "Agent preview overlay also lists published package %s; keeping the published entry",
        entry.manifest.id,
      );
      return false;
    });
    const [publishedStore, previewStore] = await storesPromise;
    const decorate = (
      entry: CapabilityCatalogPackage,
      sourceUrl: string,
      preview: boolean,
    ): StampedCapabilityCatalogPackage => ({
      ...entry,
      ...withStoreListing((preview ? previewStore : publishedStore).listings.get(entry.manifest.id)),
      // Assigned here from the source URL and nowhere else. `preview` is absent
      // from the strict downloaded-entry schema, so a published or custom
      // catalog cannot ship an entry that claims preview provenance for itself
      // and then ride through this spread.
      ...(preview ? { preview: true as const } : {}),
      iconUrl: resolveCapabilityPackageIconUrl(entry, sourceUrl),
      artifact: {
        ...entry.artifact,
        url: resolveCapabilityPackageArtifactUrl(entry, sourceUrl),
      },
      ...(entry.locales ? { locales: resolveCapabilityPackageLocaleUrls(entry, sourceUrl) } : {}),
    });

    // Re-sorted because the two documents are each sorted only within
    // themselves and the client renders catalog order as-is.
    const packages = [
      ...catalog.packages.map((entry) => decorate(entry, CATALOG_URL, false)),
      ...(previewCatalogUrl ? previewPackages.map((entry) => decorate(entry, previewCatalogUrl, true)) : []),
    ]
      .filter((entry) => !NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(entry.manifest.id))
      .sort(
        (left, right) =>
          CATALOG_SORT_COLLATOR.compare(left.manifest.name, right.manifest.name) ||
          CATALOG_SORT_COLLATOR.compare(left.manifest.id, right.manifest.id),
      );
    const listedIds = new Set(packages.map((entry) => entry.manifest.id));
    // Kits only name packages this catalog lists, so Install all never asks for an unknown id.
    const kits = publishedStore.kits
      .map((kit) => ({ ...kit, packages: kit.packages.filter((id) => listedIds.has(id)) }))
      .filter((kit) => kit.packages.length > 0);
    return {
      ...catalog,
      provenance: { kind: isOfficialCatalogUrl(CATALOG_URL) ? "official" : "custom", url: CATALOG_URL },
      packages,
      ...(kits.length ? { kits } : {}),
    };
  },

  async pruneNonDownloadableCorePackages() {
    const registry = await readRegistry();
    const removed = registry.packages.filter((item) => NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(item.id));
    if (removed.length === 0) return [];
    await writeRegistry(registry.packages.filter((item) => !NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(item.id)));
    await Promise.all(removed.map((item) => rm(join(VERSIONS, item.id), { recursive: true, force: true })));
    return removed.map((item) => item.id);
  },

  async installed() {
    return Promise.all((await readRegistry()).packages.map(hydratePreviousManifest));
  },

  async diagnostics() {
    return (await readRegistry()).packages.map((installed) => ({
      id: installed.id,
      version: installed.version,
      status: installed.status,
      readiness: installed.readiness,
      ready: isInstalledCapabilityReady(installed),
      hasServer: Boolean(installed.manifest.entrypoints.server),
      hasClient: Boolean(installed.manifest.entrypoints.client),
      capabilityApi: installed.manifest.schemaVersion === 2 ? installed.manifest.capabilityApi : null,
      builtAgainst: installed.manifest.schemaVersion === 2 ? installed.manifest.builtAgainst : null,
      issue: installed.status === "error" || installed.readiness === "error" ? "runtime_error" : null,
    }));
  },

  runtimeBlockReason,

  async agentDefinitions() {
    const registry = await readRegistry();
    const definitions = [];
    const ids = new Set<string>();
    for (const installed of registry.packages) {
      // A restart-required update still has its previous package runtime active. Keep
      // its agent definitions visible until restart, just like the active client module.
      const servable = await resolveServableInstalledPackage(installed);
      if (!servable) continue;
      const parsed = await readInstalledAgentDefinitions(servable);
      for (const definition of parsed) {
        if (ids.has(definition.id)) throw new Error(`Agent ${definition.id} is provided by more than one package`);
        ids.add(definition.id);
        definitions.push({ ...definition, packageId: installed.id });
      }
    }
    return definitions;
  },

  async packageAgentIds(packageId: string) {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    return installed ? readInstalledAgentIds(installed) : [packageId];
  },

  async runtimePackages() {
    const registry = await readRegistry();
    return registry.packages
      .filter(
        (installed) =>
          installed.manifest.entrypoints.server &&
          (installed.status !== "error" || isLegacyValidatorActivationFailure(installed)),
      )
      .map((installed) => ({
        installed,
        serverEntrypoint: inside(
          VERSIONS,
          join(VERSIONS, installed.id, installed.version, normalizeArchivePath(installed.manifest.entrypoints.server!)),
        ),
      }));
  },

  async verifiedRuntimeFiles(installed: InstalledCapabilityPackage) {
    const verified = await verifyInstalledPackageFiles(installed);
    const entrypoint = installed.manifest.entrypoints.server;
    if (!entrypoint) throw new Error(`Capability package ${installed.id} has no server entrypoint`);
    const runtimeEntrypoint = verified.get(normalizeArchivePath(entrypoint));
    if (!runtimeEntrypoint) throw new Error(`Capability package ${installed.id} has no verified server entrypoint`);
    return {
      entrypoint: normalizeArchivePath(entrypoint),
      files: new Map([...verified].map(([path, file]) => [path, file.data])),
    };
  },

  async clientEntrypoint(packageId: string) {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed) return null;
    const servable = await resolveServableInstalledPackage(installed);
    if (!servable) return null;
    const entrypoint = servable.manifest.entrypoints.client;
    if (!entrypoint) return null;
    // The manifest-recorded hash doubles as a strong HTTP validator (ETag): it
    // is the same value the read below re-verifies the bytes against.
    const declaration = servable.manifest.files.find(
      (item) => normalizeArchivePath(item.path) === normalizeArchivePath(entrypoint),
    );
    if (!declaration) return null;
    // The client path verifies by reading on EVERY request — return the
    // verified bytes so the route serves exactly what was hashed instead of
    // re-reading the file a second time.
    const verified = await readVerifiedInstalledPackageFile(servable, entrypoint);
    return {
      installed: servable,
      sha256: declaration.sha256,
      file: verified.file,
      data: verified.data,
    };
  },

  /** Resolve a servable package asset: a path declared either as a Home
   *  browser-tab icon or in the general `contributions.assets.paths` allowlist.
   *  The union is the ONLY thing this generalization changes — containment,
   *  files[] membership, the passive content-type allowlist, and the hash +
   *  TOCTOU re-verification below it are identical for both sources. */
  async packageAsset(packageId: string, assetPath: string) {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed) return null;
    const servable = await resolveServableInstalledPackage(installed);
    if (!servable) return null;
    // Every normalization below treats an unsafe path — requested OR declared —
    // as simply "not servable" (404). Declared paths are manifest-controlled,
    // and a single throwing declaration must not 500 the whole asset surface.
    const normalizedPath = tryNormalizeArchivePath(assetPath);
    if (!normalizedPath) return null;
    // The in-package manifest is metadata about the artifact, never an asset —
    // it cannot be hash-pinned by itself, so refuse it outright.
    if (normalizedPath === "manifest.json") return null;
    const iconPaths = servable.manifest.contributions?.homeBrowserTab?.iconPaths ?? [];
    const declaredAssetPaths = servable.manifest.contributions?.assets?.paths ?? [];
    const widgetIconPaths = (servable.manifest.contributions?.homeWidgets ?? []).flatMap((widget) =>
      widget.iconPath ? [widget.iconPath] : [],
    );
    const allowed = [...iconPaths, ...widgetIconPaths, ...declaredAssetPaths].some(
      (path) => tryNormalizeArchivePath(path) === normalizedPath,
    );
    if (!allowed) return null;
    const declaration = servable.manifest.files.find((item) => tryNormalizeArchivePath(item.path) === normalizedPath);
    if (!declaration) return null;
    const contentType = PACKAGE_ASSET_CONTENT_TYPES.get(extname(normalizedPath).toLowerCase());
    if (!contentType) return null;
    // Every serve reads, hashes, and returns the verified bytes through the
    // same realpath + lstat chain the client entrypoint uses — a stat-only
    // fast path let a write between verification and the route's own read send
    // bytes that were never hashed (review finding on #5092). 304 revalidation
    // means bodies are rarely sent, so per-request hashing costs little.
    // NOTE: an on-disk integrity failure below still THROWS (lifecycle
    // regression pins it) — tampering must be loud, not a quiet 404. Only
    // manifest-shape problems above degrade to "not servable".
    const verified = await readVerifiedInstalledPackageFile(servable, normalizedPath);
    return {
      installed: servable,
      contentType,
      sha256: declaration.sha256,
      file: verified.file,
      /** The exact bytes that were hash-verified; always present. */
      data: verified.data,
    };
  },

  /** The verified bytes of a package's declared GM verb table (#5798), or null when this package has
   *  no verbs the Engine may act on. The whole gate chain lives here because
   *  `readVerifiedInstalledPackageFile` is module-private and this is the one narrow export the verb
   *  runtime gets — it never receives an `InstalledCapabilityPackage`, so nothing else about a
   *  package leaks through the seam.
   *
   *  Readiness rather than servability: `packageAsset` falls back to the PREVIOUS version's manifest
   *  for a `restart-required` package, which would keep serving an old vocabulary the running Engine
   *  no longer matches. `isInstalledCapabilityReady` is the same gate the agent definitions use, so
   *  after an update that needs a restart the verbs stop resolving until one — a log line, and the
   *  turn is otherwise untouched.
   *
   *  The failure tiers ARE the contract, and the turn survives all of them:
   *    - not installed / not ready / no table declared → null, quietly. The overwhelmingly common
   *      case is a package that simply has no verbs.
   *    - a table declared without `chat-write`, declared but unlisted in `files[]`, or larger than
   *      the ceiling → null + `logger.warn`. Each is a packaging mistake whose only symptom would
   *      otherwise be verbs that silently never appear.
   *    - hash/TOCTOU failure → null + `logger.error` naming tampering. Loud on purpose: the bytes on
   *      disk are not the bytes that were installed.
   *
   *  The `chat-write` gate sits ahead of the read rather than in the caller so an unpermitted
   *  package's bytes are never loaded at all — and it is checked AFTER the declaration test so a
   *  package with no table stays silent while a package that ships one and forgot the permission is
   *  told. This is the first place a declared capability permission is enforced anywhere in the
   *  Engine; it widens what `chat-write` means for packages that already hold it (#5798). */
  async gmVerbTableSource(packageId: string): Promise<Buffer | null> {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed) return null;
    if (!isInstalledCapabilityReady(installed)) {
      logger.info(
        "[capability/gm-verbs] Package %s is not ready (status=%s); its verbs stay unavailable until restart",
        packageId,
        installed.status,
      );
      return null;
    }
    const declaredAssetPaths = installed.manifest.contributions?.assets?.paths ?? [];
    if (!declaredAssetPaths.some((path) => tryNormalizeArchivePath(path) === GM_VERB_TABLE_ASSET_PATH)) return null;
    if (!installed.manifest.permissions.includes("chat-write")) {
      logger.warn(
        "[capability/gm-verbs] Package %s declares %s without the chat-write permission; its verbs are refused",
        packageId,
        GM_VERB_TABLE_ASSET_PATH,
      );
      return null;
    }
    const declaration = installed.manifest.files.find(
      (item) => tryNormalizeArchivePath(item.path) === GM_VERB_TABLE_ASSET_PATH,
    );
    if (!declaration) {
      // Declared as an asset but never hash-pinned. The manifest schema only checks the other
      // direction, so this is silent everywhere else in the pipeline.
      logger.warn(
        "[capability/gm-verbs] Package %s declares %s as an asset but does not list it in files[]",
        packageId,
        GM_VERB_TABLE_ASSET_PATH,
      );
      return null;
    }
    // Checked against the DECLARED size, before the read: `files[].bytes` permits up to 100 MB and
    // nothing else caps an asset ahead of loading it into memory.
    if (declaration.bytes > GM_VERB_TABLE_MAX_BYTES) {
      logger.warn(
        "[capability/gm-verbs] Package %s declares a %d-byte verb table over the %d-byte ceiling; refused unread",
        packageId,
        declaration.bytes,
        GM_VERB_TABLE_MAX_BYTES,
      );
      return null;
    }
    try {
      return (await readVerifiedInstalledPackageFile(installed, GM_VERB_TABLE_ASSET_PATH)).data;
    } catch (error) {
      logger.error(
        error,
        "[capability/gm-verbs] Verb table for %s failed integrity verification — the file on disk is not the file that was installed",
        packageId,
      );
      return null;
    }
  },

  /** An installed, ready Experience's map pack music as its manifest declares it (1.345), or null. Read
   *  off the manifest only: what a turn needs to pick a track, without reading the pack's files. */
  /** An Experience's people file (1.346) alone, verified as its other map pack files are, for a turn to
   *  read without the whole pack; null when it ships none or is not installed and ready. */
  async mapPackPeople(packageId: string): Promise<{ version: string; data: Buffer; sha256: string } | null> {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    const path = installed.manifest.contributions?.gameSurface?.mapPack?.people;
    if (!path) return null;
    const declaration = installed.manifest.files.find(
      (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(path),
    );
    if (!declaration || declaration.bytes > WORLD_SHARE_FILE_MAX_BYTES) return null;
    const data = (await readVerifiedInstalledPackageFile(installed, path)).data;
    return { version: installed.version, data, sha256: declaration.sha256 };
  },

  /** Every ready Experience's ruleset overlays (1.355), verified as its other map pack files are, for the
   *  ruleset registry. One that cannot be read is left out with a line saying why. Never throws. */
  async experienceRulesetOverlays(): Promise<
    Array<{ packageId: string; ruleset: string; path: string; data: Buffer; sha256: string }>
  > {
    const out: Array<{ packageId: string; ruleset: string; path: string; data: Buffer; sha256: string }> = [];
    let packages: Awaited<ReturnType<typeof readRegistry>>["packages"];
    try {
      packages = (await readRegistry()).packages;
    } catch (error) {
      logger.warn(error, "[capability/rulesets] The installed packages could not be read; their overlays are left out");
      return out;
    }
    for (const installed of packages) {
      const overlays = installed.manifest.contributions?.gameSurface?.mapPack?.rulesets;
      if (!overlays?.length || !isInstalledCapabilityReady(installed)) continue;
      for (const each of overlays) {
        const declaration = installed.manifest.files.find(
          (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(each.overlay),
        );
        if (!declaration || declaration.bytes > WORLD_SHARE_FILE_MAX_BYTES) {
          logger.warn(
            "[capability/rulesets] %s's overlay %s is not a declared file within the size limit; it is left out",
            installed.id,
            each.overlay,
          );
          continue;
        }
        try {
          const data = (await readVerifiedInstalledPackageFile(installed, each.overlay)).data;
          out.push({
            packageId: installed.id,
            ruleset: each.ruleset,
            path: each.overlay,
            data,
            sha256: declaration.sha256,
          });
        } catch (error) {
          logger.warn(error, "[capability/rulesets] %s's overlay %s could not be read", installed.id, each.overlay);
        }
      }
    }
    return out;
  },

  async mapPackMusic(packageId: string): Promise<ExperienceMusic | null> {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    return installed.manifest.contributions?.gameSurface?.mapPack?.music ?? null;
  },

  /** An Experience's GM setup values (1.372), as its manifest declares them; null when it sets none or is
   *  not ready. */
  async experienceSetupDefaults(packageId: string) {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    return installed.manifest.contributions?.gameSurface?.setup?.defaults ?? null;
  },

  /** An Experience's map pack files (worldgen W9e), verified: its kit, worlds and tile pack, by the
   *  paths its manifest declares, each declared as an asset, hash-pinned in `files[]` and re-verified
   *  against the install-time hash. Null when the package is not installed, not ready, or ships no map
   *  pack; throws (with the reason) when one is declared but cannot be read as installed. */
  async mapPackFiles(packageId: string): Promise<{
    version: string;
    name: string;
    kit: Buffer;
    worlds: Array<{ path: string; data: Buffer }>;
    tiles: Buffer | null;
    /** The tiles file's pinned hash, and the Capability API the package declares (image tiles need 1.80, a story intro 1.339). */
    tilesSha256: string | null;
    capabilityApi: { major: number; minor: number } | null;
    /** Its creature packs (1.344), with their pinned hashes. */
    creatures: Array<{ path: string; data: Buffer; sha256: string }>;
    /** Its music (1.345), as declared: the tracks are served as assets, never read here. */
    music: ExperienceMusic | null;
    /** Its people file (1.346), with its pinned hash. */
    people: { path: string; data: Buffer; sha256: string } | null;
    /** The package's declared asset paths, for the files its people name. */
    assets: string[];
    /** Its ruleset overlays (1.355), with their pinned hashes. */
    rulesets: Array<{ ruleset: string; path: string; data: Buffer; sha256: string }>;
    /** Its image packs for maps made by hand (1.357), with their pinned hashes. */
    dungeons: Array<{ path: string; data: Buffer; sha256: string }>;
  } | null> {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    const mapPack = installed.manifest.contributions?.gameSurface?.mapPack;
    if (!mapPack) return null;
    const read = async (path: string, maxBytes = WORLD_SHARE_FILE_MAX_BYTES) => {
      const declaration = installed.manifest.files.find(
        (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(path),
      );
      if (!declaration) throw new Error(`${path} is not listed in the package's files`);
      // Refused on its DECLARED size, before the read, as a share file is.
      if (declaration.bytes > maxBytes) throw new Error(`${path} is larger than a share file can be`);
      return (await readVerifiedInstalledPackageFile(installed, path)).data;
    };
    return {
      version: installed.version,
      name: installed.manifest.name,
      kit: await read(mapPack.kit),
      worlds: await Promise.all((mapPack.worlds ?? []).map(async (path) => ({ path, data: await read(path) }))),
      tiles: mapPack.tiles ? await read(mapPack.tiles) : null,
      tilesSha256: mapPack.tiles
        ? (installed.manifest.files.find(
            (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(mapPack.tiles!),
          )?.sha256 ?? null)
        : null,
      capabilityApi: installed.manifest.schemaVersion === 2 ? installed.manifest.capabilityApi : null,
      music: mapPack.music ?? null,
      assets: installed.manifest.contributions?.assets?.paths ?? [],
      people: mapPack.people
        ? {
            path: mapPack.people,
            data: await read(mapPack.people),
            sha256:
              installed.manifest.files.find(
                (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(mapPack.people!),
              )?.sha256 ?? "",
          }
        : null,
      rulesets: await Promise.all(
        (mapPack.rulesets ?? []).map(async (each) => ({
          ruleset: each.ruleset,
          path: each.overlay,
          data: await read(each.overlay),
          sha256:
            installed.manifest.files.find(
              (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(each.overlay),
            )?.sha256 ?? "",
        })),
      ),
      dungeons: await Promise.all(
        (mapPack.dungeons ?? []).map(async (path) => ({
          path,
          data: await read(path),
          sha256:
            installed.manifest.files.find(
              (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(path),
            )?.sha256 ?? "",
        })),
      ),
      creatures: await Promise.all(
        (mapPack.creatures ?? []).map(async (path) => ({
          path,
          data: await read(path, CREATURE_PACK_MAX_BYTES),
          sha256:
            installed.manifest.files.find(
              (item) => tryNormalizeArchivePath(item.path) === tryNormalizeArchivePath(path),
            )?.sha256 ?? "",
        })),
      ),
    };
  },

  /** Every ready package's `ruleset.json`, verified, for the ruleset registry. Same discipline as
   *  `gmVerbTableSource`: declared as an asset, hash-pinned in `files[]`, refused on its DECLARED
   *  size before the read, and re-verified against the install-time hash. A ruleset is inert data
   *  that needs no permission, so there is no permission gate here. Never throws. */
  async rulesetSources(): Promise<Array<{ packageId: string; data: Buffer }>> {
    const sources: Array<{ packageId: string; data: Buffer }> = [];
    for (const installed of (await readRegistry()).packages) {
      const declared = installed.manifest.contributions?.assets?.paths ?? [];
      if (!declared.some((path) => tryNormalizeArchivePath(path) === RULESET_ASSET_PATH)) continue;
      if (!installed.manifest.kind.includes("ruleset")) {
        logger.warn(
          "[capability/rulesets] Package %s lists %s without the ruleset kind; its ruleset is refused",
          installed.id,
          RULESET_ASSET_PATH,
        );
        continue;
      }
      if (!isInstalledCapabilityReady(installed)) {
        logger.info(
          "[capability/rulesets] Package %s is not ready (status=%s); its ruleset stays unavailable until restart",
          installed.id,
          installed.status,
        );
        continue;
      }
      const declaration = installed.manifest.files.find(
        (item) => tryNormalizeArchivePath(item.path) === RULESET_ASSET_PATH,
      );
      if (!declaration) {
        logger.warn(
          "[capability/rulesets] Package %s declares %s as an asset but does not list it in files[]",
          installed.id,
          RULESET_ASSET_PATH,
        );
        continue;
      }
      if (declaration.bytes > RULESET_MAX_BYTES) {
        logger.warn(
          "[capability/rulesets] Package %s declares a %d-byte ruleset over the %d-byte ceiling; refused unread",
          installed.id,
          declaration.bytes,
          RULESET_MAX_BYTES,
        );
        continue;
      }
      try {
        sources.push({
          packageId: installed.id,
          data: (await readVerifiedInstalledPackageFile(installed, RULESET_ASSET_PATH)).data,
        });
      } catch (error) {
        logger.error(error, "[capability/rulesets] Ruleset for %s failed integrity verification", installed.id);
      }
    }
    return sources;
  },

  /** One package's `catalogs/<id>.json`, verified, for the catalog route. Same discipline as
   *  `rulesetSources`, and the same reasons: declared as an asset, hash-pinned in `files[]`, refused
   *  on its DECLARED size before the read, and re-verified against the install-time hash.
   *
   *  Three answers, because the route owes the user different words for each: `null` when this
   *  package serves no such catalog file at all (not installed, not ready, not declared), `{ issue }`
   *  when it declares one the Engine will not read, and `{ data }` for the verified bytes. Never
   *  throws. */
  async rulesetCatalogAsset(
    packageId: string,
    catalogId: string,
  ): Promise<{ sha256: string; read: () => Promise<{ data: Buffer } | { issue: string }> } | { issue: string } | null> {
    const assetPath = rulesetCatalogAssetPath(catalogId);
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed) return null;
    if (!isInstalledCapabilityReady(installed)) {
      logger.info(
        "[capability/rulesets] Package %s is not ready (status=%s); its catalogs stay unavailable until restart",
        packageId,
        installed.status,
      );
      return null;
    }
    const declared = installed.manifest.contributions?.assets?.paths ?? [];
    if (!declared.some((path) => tryNormalizeArchivePath(path) === assetPath)) return null;
    const declaration = installed.manifest.files.find((item) => tryNormalizeArchivePath(item.path) === assetPath);
    if (!declaration) {
      logger.warn(
        "[capability/rulesets] Package %s declares %s as an asset but does not list it in files[]",
        packageId,
        assetPath,
      );
      return { issue: `${assetPath} is not listed in the package file manifest` };
    }
    if (declaration.bytes > RULESET_CATALOG_MAX_BYTES) {
      logger.warn(
        "[capability/rulesets] Package %s declares a %d-byte catalog over the %d-byte ceiling; refused unread",
        packageId,
        declaration.bytes,
        RULESET_CATALOG_MAX_BYTES,
      );
      return {
        issue: `${assetPath} is ${declaration.bytes} bytes, over the ${RULESET_CATALOG_MAX_BYTES}-byte limit`,
      };
    }
    // The pinned hash comes back before the bytes are read, so a caller that already holds this
    // exact file (a conditional request) never makes the Engine read and validate it again.
    return {
      sha256: declaration.sha256,
      read: async () => {
        try {
          return { data: (await readVerifiedInstalledPackageFile(installed, assetPath)).data };
        } catch (error) {
          logger.error(
            error,
            "[capability/rulesets] Catalog %s for %s failed integrity verification",
            assetPath,
            packageId,
          );
          return { issue: `${assetPath} is not the file that was installed` };
        }
      },
    };
  },

  /** An installed ruleset package's translation into one language: its language pack (1.811), as
   *  `rulesetCatalogAsset` reads a catalog. Null when none is kept in that language. */
  async rulesetLocaleAsset(
    packageId: string,
    locale: string,
  ): Promise<{ sha256: string; read: () => Promise<{ data: Buffer } | { issue: string }> } | { issue: string } | null> {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed) || installed.id !== installed.manifest.id) return null;
    const pack = await readRulesetLocalePack(installed, locale);
    if (!pack || "issue" in pack) return pack;
    return { sha256: pack.sha256, read: async () => ({ data: pack.data }) };
  },

  /** The language the Engine was last set to (English until a page says otherwise). */
  async rulesetLanguage(): Promise<string> {
    return readRulesetLanguage();
  },

  /** The language the Engine is set to, for the rulesets' packs (1.811): recorded, then each installed
   *  catalog ruleset brought to it (its pack fetched, the old language's removed). Offline, or with a pack
   *  that does not check out, a ruleset reads in English and the next change or install tries again. */
  async setRulesetLanguage(
    language: string,
    loadCatalog: () => Promise<CapabilityCatalog> = () => this.catalog(),
    download: (url: string, maximum: number) => Promise<Buffer> = fetchBytes,
  ): Promise<Record<string, RulesetLocalePackOutcome>> {
    if (!isRulesetLocaleCode(language)) throw new Error(`"${language}" is not a language code`);
    const run = rulesetLanguageQueue.then(async () => {
      await writeRulesetLanguage(language);
      const rulesets = (await readRegistry()).packages.filter(
        (item) =>
          item.manifest.kind.includes("ruleset") && isInstalledCapabilityReady(item) && item.id === item.manifest.id,
      );
      const outcomes: Record<string, RulesetLocalePackOutcome> = {};
      if (!rulesets.length) return outcomes;
      // The catalog only when a pack may be wanted: English needs none, and removes them all.
      let catalog: CapabilityCatalog | undefined;
      if (rulesetTranslationLanguages(language).length) {
        try {
          catalog = await loadCatalog();
        } catch (error) {
          logger.warn(error, "[capability/rulesets] The catalog could not be read for the rulesets' language packs");
        }
      }
      for (const installed of rulesets) {
        const entry = catalog?.packages.find((candidate) => candidate.manifest.id === installed.id) ?? null;
        outcomes[installed.id] = await syncRulesetLocalePack(installed, language, entry, download);
      }
      return outcomes;
    });
    rulesetLanguageQueue = run.catch(() => undefined);
    return run;
  },

  async markRuntimeStatus(
    packageId: string,
    status: InstalledCapabilityPackage["status"],
    error: string | null = null,
  ) {
    const registry = await readRegistry();
    const index = registry.packages.findIndex((installed) => installed.id === packageId);
    if (index < 0) return;
    registry.packages[index] = { ...registry.packages[index]!, status, error };
    await writeRegistry(registry.packages);
  },

  async markRuntimeReadiness(
    packageId: string,
    readiness: InstalledCapabilityPackage["readiness"],
    readinessError: string | null = null,
  ) {
    const registry = await readRegistry();
    const index = registry.packages.findIndex((installed) => installed.id === packageId);
    if (index < 0) return;
    registry.packages[index] = { ...registry.packages[index]!, readiness, readinessError };
    await writeRegistry(registry.packages);
  },

  async rollbackRuntime(packageId: string) {
    const registry = await readRegistry();
    const index = registry.packages.findIndex((installed) => installed.id === packageId);
    const current = index >= 0 ? registry.packages[index] : undefined;
    if (!current?.previousVersion) return null;
    const previousManifestFile = inside(VERSIONS, join(VERSIONS, current.id, current.previousVersion, "manifest.json"));
    if (!existsSync(previousManifestFile)) return null;
    const manifest = capabilityPackageManifestSchema.parse(JSON.parse(await readFile(previousManifestFile, "utf8")));
    const restored: InstalledCapabilityPackage = {
      ...current,
      version: current.previousVersion,
      manifest,
      status: "active",
      error: null,
      readiness: "pending",
      readinessError: null,
      previousVersion: undefined,
      previousManifest: undefined,
    };
    if (runtimeBlockReason(restored)) return null;
    registry.packages[index] = restored;
    await writeRegistry(registry.packages);
    const server = manifest.entrypoints.server;
    return server
      ? {
          installed: restored,
          serverEntrypoint: inside(
            VERSIONS,
            join(VERSIONS, restored.id, restored.version, normalizeArchivePath(server)),
          ),
        }
      : null;
  },

  async migrateLegacyAvailability(legacyInstall: boolean) {
    const existingMigrationKind = await readAvailabilityMigrationKind();
    if (existingMigrationKind) {
      return {
        migrated: false,
        legacy: existingMigrationKind === "legacy",
        complete: true,
      };
    }
    if (!legacyInstall) {
      await writeAvailabilityMigration("fresh");
      return { migrated: false, legacy: false, complete: true };
    }

    // Published lanes only (preview overlay explicitly not fetched): this loop
    // installs and activates EVERY entry it is handed, unattended, at startup.
    // Merging staging-only packages in here would silently install every
    // unfinished package on a tester's machine the first time they upgrade.
    const catalog = await this.catalog(safeFetch, null);
    const installedById = new Map((await this.installed()).map((item) => [item.id, item]));
    for (const entry of catalog.packages) {
      if (installedById.get(entry.manifest.id)?.version === entry.manifest.version) continue;
      // Experiences are the player's choice per game, and a zip one is never accepted.
      if (isCatalogExperience(entry)) continue;
      // A ruleset still published as a zip is refused, and must not stop the rest from installing.
      if (entry.manifest.kind.includes("ruleset") && !isRulesetFileArtifact(entry)) continue;
      await installCatalogPackage(entry, true);
    }
    // Existing-install completion also depends on per-chat selections becoming
    // durable. The startup orchestrator writes the marker only after that work.
    return { migrated: true, legacy: true, complete: false };
  },

  async completeLegacyAvailabilityMigration() {
    await writeAvailabilityMigration("legacy");
  },

  /** Keep the formerly built-in social timelines available only to upgraded profiles. */
  async migrateExtractedNoodleAvailability(existingProfile: boolean) {
    const completedKind = await readNoodleExtractionMigrationKind();
    if (completedKind) return { migrated: false, legacy: completedKind === "legacy" };
    if (!existingProfile) {
      await writeNoodleExtractionMigration("fresh");
      return { migrated: false, legacy: false };
    }

    const alreadyInstalled = (await this.installed()).some((item) => item.id === "noodle");
    if (!alreadyInstalled) {
      // Published lanes only, for the same reason as migrateLegacyAvailability:
      // this path auto-installs what it finds without asking.
      const catalog = await this.catalog(safeFetch, null);
      const entry = catalog.packages.find((candidate) => candidate.manifest.id === "noodle");
      if (!entry) {
        // Engine and Agents are published independently. Do not turn the short
        // catalog propagation window into a startup warning or mark migration
        // complete: a later startup must still install Noodle once it appears.
        return { migrated: false, legacy: true, pending: true as const };
      }
      await installCatalogPackage(entry, true);
    }
    // This marker also records the user's right to uninstall without the next
    // startup treating that choice as an incomplete upgrade.
    await writeNoodleExtractionMigration("legacy");
    return { migrated: !alreadyInstalled, legacy: true };
  },

  async isHierarchicalMapsSelectionCorrectionComplete() {
    return readHierarchicalMapsSelectionCorrectionComplete();
  },

  async completeHierarchicalMapsSelectionCorrection() {
    await writeHierarchicalMapsSelectionCorrection();
  },

  async pendingUpdates(): Promise<CapabilityPackageUpdate[]> {
    const installedPackages = await this.installed();
    if (installedPackages.length === 0) return [];
    const catalog = await this.catalog();
    const decisions = await readUpdateDecisions();
    const declinedVersions = Object.fromEntries(
      Object.entries(decisions.declined).map(([id, decision]) => [id, decision.version]),
    );
    const updates = findPendingCapabilityPackageUpdates(installedPackages, catalog, declinedVersions);
    if (updates.length === 0) return updates;
    // Decoration only: a notes document that is absent or unreadable must leave
    // this list exactly as an Engine without the feature would return it.
    return attachCapabilityReleaseNotes(updates, await readReleaseNotes());
  },

  /** Published notes for one package, newest first, or [] when none exist.
   *
   *  Sorted here rather than trusted: the official build emits newest-first, but a
   *  custom catalog is under no such obligation and the history sheet renders this
   *  order as-is. */
  async releaseNotes(
    packageId: string,
    fetchNotes: typeof safeFetch = safeFetch,
  ): Promise<CapabilityPackageVersionNote[]> {
    const notes = await readReleaseNotes(fetchNotes);
    return [...(notes?.packages[packageId]?.versions ?? [])].sort((left, right) =>
      compareCapabilityPackageVersions(right.version, left.version),
    );
  },

  async declineUpdate(packageId: string, version: string) {
    return (await this.declineUpdates([{ id: packageId, version }])).length > 0;
  },

  /** "Not now" on the updates dialog: every listed update in one catalog read and one decisions write, so a
   *  reload right after it cannot bring back updates a one-by-one loop had not reached yet. Returns the ids
   *  declined; an update that is no longer offered is skipped. */
  async declineUpdates(updates: Array<{ id: string; version: string }>) {
    const candidates = findCompatibleCapabilityPackageUpdates(await this.installed(), await this.catalog());
    const declined = updates.filter(({ id, version }) =>
      candidates.some(({ installed, entry }) => installed.id === id && entry.manifest.version === version),
    );
    if (declined.length === 0) return [];
    const decisions = await readUpdateDecisions();
    const declinedAt = new Date().toISOString();
    for (const { id, version } of declined) decisions.declined[id] = { version, declinedAt };
    await writeUpdateDecisions(decisions);
    return declined.map(({ id }) => id);
  },

  async install(packageId: string, expectedVersion: string, expectedArtifactSha256: string, language?: string) {
    // The page's language, so a ruleset's pack comes in it (1.811).
    if (language && isRulesetLocaleCode(language) && language !== (await readRulesetLanguage())) {
      await writeRulesetLanguage(language);
    }
    const catalog = await this.catalog();
    const entry = catalog.packages.find((candidate) => candidate.manifest.id === packageId);
    if (!entry) throw new Error("Package is not present in the configured catalog");
    if (entry.manifest.version !== expectedVersion || entry.artifact.sha256 !== expectedArtifactSha256) {
      throw new CapabilityPackageVersionMismatchError(
        `This Agent package changed after it was reviewed. Review the current ${entry.manifest.id} package and try again.`,
      );
    }
    const installed = await installCatalogPackage(entry);
    // A package without a server runs as soon as it is installed. One with a server is pruned once it has started.
    if (installed.status === "active" && installed.readiness === "ready") await this.pruneVersions(installed.id);
    return installed;
  },

  /**
   * Deletes the kept versions of a package other than the current one and the one before it, which rollback restores.
   * Runs after an activation or an update succeeds and at startup. A package whose update waits for a restart, or whose
   * runtime has not started yet, keeps everything. Only `versions/<id>` folders of registered packages are touched,
   * never the registry, install folders or package data. Never throws: a version it cannot delete goes next time.
   */
  async pruneVersions(packageId?: string) {
    const removed: string[] = [];
    try {
      for (const installed of (await readRegistry()).packages) {
        if (packageId !== undefined && installed.id !== packageId) continue;
        // The manifest id is validated as a folder name; a registry id that differs from it is not trusted as a path.
        if (installed.id !== installed.manifest.id) continue;
        if (installed.status === "restart-required" || installed.readiness === "pending") continue;
        const keep = new Set([installed.version, installed.previousVersion]);
        const packageRoot = join(VERSIONS, installed.id);
        const entries = await readdir(packageRoot, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isDirectory() || keep.has(entry.name)) continue;
          try {
            await rm(join(packageRoot, entry.name), { recursive: true, force: true });
            removed.push(`${installed.id}@${entry.name}`);
          } catch (error) {
            logger.warn(error, "Could not remove capability package %s version %s", installed.id, entry.name);
          }
        }
      }
    } catch (error) {
      logger.warn(error, "Could not check for old capability package versions");
    }
    if (removed.length > 0) logger.info("Removed old capability package versions: %s", removed.join(", "));
  },

  /** Imports an Experience file (1.373) the user reviewed, read as it streams in. */
  async installExperienceFile(
    source: AsyncIterable<Uint8Array>,
    options?: Parameters<typeof installExperienceFile>[1],
  ) {
    return installExperienceFile(source, options);
  },

  async uninstall(packageId: string) {
    const registry = await readRegistry();
    const existing = registry.packages.find((item) => item.id === packageId);
    if (!existing) return false;
    const agentIds = await readInstalledAgentIds(existing);
    if (existing.manifest.kind.includes("conversation-calls")) {
      await sidecarSpeechService.deleteAllModels();
    }
    await writeRegistry(registry.packages.filter((item) => item.id !== packageId));
    await rm(join(VERSIONS, packageId), { recursive: true, force: true });
    try {
      await clearDeclinedUpdate(packageId);
    } catch (error) {
      logger.warn(error, "Could not clear the deferred update marker for removed capability package %s", packageId);
    }
    return { ...existing, agentIds };
  },
};
