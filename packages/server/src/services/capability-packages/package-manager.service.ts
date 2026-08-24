import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import AdmZip from "adm-zip";
import {
  APP_VERSION,
  parseCapabilityCatalogWithCompat,
  capabilityPackageManifestSchema,
  compareCapabilityPackageVersions,
  getCapabilityApiCompatibilityIssue,
  isInstalledCapabilityReady,
  installedCapabilityRegistrySchema,
  packagedAgentDefinitionsSchema,
  type CapabilityCatalog,
  type CapabilityCatalogPackage,
  type StampedCapabilityCatalog,
  type StampedCapabilityCatalogPackage,
  type PackagedAgentDefinition,
  type CapabilityPackageUpdate,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
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

function isSymlink(entry: AdmZip.IZipEntry): boolean {
  return ((entry.attr >>> 16) & 0o170000) === 0o120000;
}

export function validatePackageArchiveEntries(zip: AdmZip, maximumExpandedBytes = MAX_EXPANDED_BYTES) {
  const archiveEntries = zip.getEntries();
  if (archiveEntries.length > MAX_ARCHIVE_ENTRIES) throw new Error("Package contains too many files");
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
    expandedBytes += item.header.size;
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

function assertNotDowngrade(current: InstalledCapabilityPackage | undefined, nextVersion: string) {
  if (current && compareCapabilityPackageVersions(nextVersion, current.version) < 0) {
    throw new Error(
      `Installed ${current.id} ${current.version} is newer than catalog version ${nextVersion}; refusing to downgrade`,
    );
  }
}

async function readRegistry() {
  try {
    return installedCapabilityRegistrySchema.parse(JSON.parse(await readFile(REGISTRY, "utf8")));
  } catch (error) {
    if (!existsSync(REGISTRY)) return { schemaVersion: 1 as const, packages: [] };
    throw error;
  }
}

async function writeRegistry(packages: InstalledCapabilityPackage[]) {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${REGISTRY}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, packages }, null, 2), { mode: 0o600 });
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

export function getCapabilityPackageInstallIssue(manifest: CapabilityCatalogPackage["manifest"]): string | null {
  if (manifest.kind.includes("turn-game") && !manifest.entrypoints.server) {
    return "Turn-game packages require a server entrypoint";
  }
  if (manifest.permissions.includes("routes") && !manifest.restartRequired) {
    return "Packages with privileged routes must require a restart";
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

export function getCapabilityPackageArtifactSourceIssue(
  entry: CapabilityCatalogPackage,
  catalogUrl = CATALOG_URL,
): string | null {
  const branch = getOfficialAgentBranchFromCatalogUrl(catalogUrl);
  if (!branch) return null;
  const artifactName = `${entry.manifest.id}-${entry.manifest.version}.zip`;
  const stableUrl = `${officialArtifactRoot("main")}/${artifactName}`;
  const channelUrl = `${officialArtifactRoot(branch)}/${artifactName}`;
  return entry.artifact.url === stableUrl || entry.artifact.url === channelUrl
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
  return `${officialArtifactRoot(branch)}/${entry.manifest.id}-${entry.manifest.version}.zip`;
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

async function installCatalogPackage(entry: CapabilityCatalogPackage, activateDuringStartup = false) {
  const { manifest, artifact } = entry;
  const installIssue = getCapabilityPackageInstallIssue(manifest);
  if (installIssue) throw new Error(installIssue);
  const initiallyInstalled = (await readRegistry()).packages.find((item) => item.id === manifest.id);
  assertNotDowngrade(initiallyInstalled, manifest.version);
  const capabilityApiIssue = getCapabilityApiCompatibilityIssue(manifest);
  if (capabilityApiIssue) throw new Error(capabilityApiIssue);
  if (!supportsEngineVersion(entry, APP_VERSION)) {
    throw new Error(`Package requires Marinara Engine ${manifest.engine.min} to below ${manifest.engine.maxExclusive}`);
  }
  const archive = await fetchBytes(artifact.url, Math.min(artifact.bytes + 1, MAX_ARTIFACT_BYTES));
  if (archive.byteLength !== artifact.bytes) throw new Error("Downloaded package size does not match the catalog");
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== artifact.sha256) throw new Error("Downloaded package checksum does not match the catalog");

  const zip = new AdmZip(archive);
  const entries = validatePackageArchiveEntries(zip);
  const manifestEntry = entries.find((item) => item.entryName === "manifest.json");
  if (!manifestEntry || manifestEntry.header.size > MAX_MANIFEST_BYTES) {
    throw new Error("Package manifest is missing or too large");
  }
  const installedManifest = capabilityPackageManifestSchema.parse(JSON.parse(manifestEntry.getData().toString("utf8")));
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
    const data = item.getData();
    if (data.byteLength !== declaration.bytes) throw new Error(`Package file size mismatch for ${name}`);
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
  if (installedManifest.entrypoints.agents) {
    const agentsPath = normalizeArchivePath(installedManifest.entrypoints.agents);
    const agentsFile = verifiedFiles.get(agentsPath);
    if (!agentsFile) throw new Error("Package agent definitions are missing");
    const agentDefinitions = packagedAgentDefinitionsSchema.parse(JSON.parse(agentsFile.toString("utf8")));
    for (const agentId of agentDetailIds) {
      const detailIssue = getCapabilityAgentDetailDefinitionIssue(agentId, agentDefinitions);
      if (detailIssue) throw new Error(detailIssue);
    }
  }

  const temporary = join(ROOT, `.install-${manifest.id}-${Date.now()}`);
  const destination = join(VERSIONS, manifest.id, manifest.version);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    await writeFile(join(temporary, "manifest.json"), manifestEntry.getData(), { mode: 0o600 });
    for (const [name, data] of verifiedFiles) {
      const output = inside(temporary, join(temporary, name));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, data, { mode: 0o600 });
    }
    await mkdir(dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);
    const registry = await readRegistry();
    const previous = registry.packages.find((item) => item.id === manifest.id);
    assertNotDowngrade(previous, manifest.version);
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
      ...(previous && previous.version !== manifest.version ? { previousVersion: previous.version } : {}),
    };
    await writeRegistry([...registry.packages.filter((item) => item.id !== manifest.id), installed]);
    try {
      await clearDeclinedUpdate(manifest.id);
    } catch (error) {
      logger.warn(error, "Could not clear the deferred update marker for capability package %s", manifest.id);
    }
    return installed;
  } finally {
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
    return (await readRegistry()).packages;
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
      if (!isInstalledCapabilityReady(installed)) continue;
      const parsed = await readInstalledAgentDefinitions(installed);
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
      .filter((installed) => installed.status !== "error" && installed.manifest.entrypoints.server)
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
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    const entrypoint = installed.manifest.entrypoints.client;
    if (!entrypoint) return null;
    // The manifest-recorded hash doubles as a strong HTTP validator (ETag): it
    // is the same value the read below re-verifies the bytes against.
    const declaration = installed.manifest.files.find(
      (item) => normalizeArchivePath(item.path) === normalizeArchivePath(entrypoint),
    );
    if (!declaration) return null;
    // The client path verifies by reading on EVERY request — return the
    // verified bytes so the route serves exactly what was hashed instead of
    // re-reading the file a second time.
    const verified = await readVerifiedInstalledPackageFile(installed, entrypoint);
    return {
      installed,
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
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    // Every normalization below treats an unsafe path — requested OR declared —
    // as simply "not servable" (404). Declared paths are manifest-controlled,
    // and a single throwing declaration must not 500 the whole asset surface.
    const tryNormalize = (path: string): string | null => {
      try {
        return normalizeArchivePath(path);
      } catch {
        return null;
      }
    };
    const normalizedPath = tryNormalize(assetPath);
    if (!normalizedPath) return null;
    // The in-package manifest is metadata about the artifact, never an asset —
    // it cannot be hash-pinned by itself, so refuse it outright.
    if (normalizedPath === "manifest.json") return null;
    const iconPaths = installed.manifest.contributions?.homeBrowserTab?.iconPaths ?? [];
    const declaredAssetPaths = installed.manifest.contributions?.assets?.paths ?? [];
    const allowed = [...iconPaths, ...declaredAssetPaths].some((path) => tryNormalize(path) === normalizedPath);
    if (!allowed) return null;
    const declaration = installed.manifest.files.find((item) => tryNormalize(item.path) === normalizedPath);
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
    const verified = await readVerifiedInstalledPackageFile(installed, normalizedPath);
    return {
      installed,
      contentType,
      sha256: declaration.sha256,
      file: verified.file,
      /** The exact bytes that were hash-verified; always present. */
      data: verified.data,
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
    return findPendingCapabilityPackageUpdates(installedPackages, catalog, declinedVersions);
  },

  async declineUpdate(packageId: string, version: string) {
    const installedPackages = await this.installed();
    const catalog = await this.catalog();
    const candidate = findCompatibleCapabilityPackageUpdates(installedPackages, catalog).find(
      ({ installed, entry }) => installed.id === packageId && entry.manifest.version === version,
    );
    if (!candidate) return false;
    const decisions = await readUpdateDecisions();
    decisions.declined[packageId] = { version, declinedAt: new Date().toISOString() };
    await writeUpdateDecisions(decisions);
    return true;
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
    return installCatalogPackage(entry);
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
