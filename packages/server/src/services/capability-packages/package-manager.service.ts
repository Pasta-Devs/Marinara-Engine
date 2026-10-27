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
  RULESET_MAX_BYTES,
  rulesetCatalogAssetPath,
  isRulesetCatalogAssetPath,
  isInstalledCapabilityReady,
  installedCapabilityRegistrySchema,
  installedCapabilityPackageSchema,
  packagedAgentDefinitionsSchema,
  capabilityReleaseNotesSchema,
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
  RULESET_FIELDS_MAX_BEFORE_1203,
  RULESET_BUILDER_STEPS_MAX_BEFORE_1107,
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
export function resolveCapabilityReleaseNotesUrl(catalogUrl: string | null): string | null {
  if (!catalogUrl) return null;
  const trimmed = catalogUrl.trim();
  if (!trimmed.endsWith("/catalog.json")) return null;
  return `${trimmed.slice(0, -"catalog.json".length)}notes.json`;
}

const RELEASE_NOTES_URL = resolveCapabilityReleaseNotesUrl(CATALOG_URL);
const RELEASE_NOTES_TTL_MS = 5 * 60 * 1000;

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
function featureValues(record: Record<string, unknown>): unknown[] {
  return Object.entries(record).flatMap(([key, value]) =>
    ID_KEYED_MAPS.has(key) && plainRecord(value) ? [] : [value],
  );
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
  if (carriesCreatureSpellcasting) {
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
  // More derived values again, 1.111: an older Engine refused a sheet with more than 240.
  if (!declaresApi(111) && Array.isArray(derivedValues) && derivedValues.length > RULESET_DERIVED_MAX_BEFORE_1106) {
    return `A ruleset with more than ${RULESET_DERIVED_MAX_BEFORE_1106} derived values requires schemaVersion 2 and capabilityApi 1.111 or newer`;
  }
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
  return officialArtifactName(entry, branch)
    ? null
    : `Official package ${entry.manifest.id} must use its canonical Marinara-Agents artifact URL`;
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

/** Installs a catalog entry through the caller's download rather than the network, for regressions. */
export function installCatalogPackageForTests(entry: CapabilityCatalogPackage, download: () => Promise<Buffer>) {
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
    return { ...(await commitPackageInstall(manifest, temporary, activateDuringStartup)), usesDecisions };
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
}

export const capabilityPackageManager = {
  async catalog(
    fetchCatalog: typeof safeFetch = safeFetch,
    previewCatalogUrl: string | null = PREVIEW_CATALOG_URL,
  ): Promise<StampedCapabilityCatalog> {
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
    const decorate = (
      entry: CapabilityCatalogPackage,
      sourceUrl: string,
      preview: boolean,
    ): StampedCapabilityCatalogPackage => ({
      ...entry,
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
    });

    return {
      ...catalog,
      provenance: { kind: isOfficialCatalogUrl(CATALOG_URL) ? "official" : "custom", url: CATALOG_URL },
      // Re-sorted because the two documents are each sorted only within
      // themselves and the client renders catalog order as-is.
      packages: [
        ...catalog.packages.map((entry) => decorate(entry, CATALOG_URL, false)),
        ...(previewCatalogUrl ? previewPackages.map((entry) => decorate(entry, previewCatalogUrl, true)) : []),
      ]
        .filter((entry) => !NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(entry.manifest.id))
        .sort(
          (left, right) =>
            CATALOG_SORT_COLLATOR.compare(left.manifest.name, right.manifest.name) ||
            CATALOG_SORT_COLLATOR.compare(left.manifest.id, right.manifest.id),
        ),
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

  async install(packageId: string, expectedVersion: string, expectedArtifactSha256: string) {
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
