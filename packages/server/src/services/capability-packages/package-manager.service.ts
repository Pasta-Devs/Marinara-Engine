import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import AdmZip from "adm-zip";
import {
  APP_VERSION,
  capabilityCatalogSchema,
  capabilityPackageManifestSchema,
  compareCapabilityPackageVersions,
  getCapabilityApiCompatibilityIssue,
  isInstalledCapabilityReady,
  installedCapabilityRegistrySchema,
  packagedAgentDefinitionsSchema,
  type CapabilityCatalog,
  type CapabilityCatalogPackage,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";
import { sidecarSpeechService } from "../sidecar/sidecar-speech.service.js";

const ROOT = join(DATA_DIR, "capability-packages");
const VERSIONS = join(ROOT, "versions");
const REGISTRY = join(ROOT, "installed.json");
const AVAILABILITY_MIGRATION = join(ROOT, "availability-migration-v1.json");
const NON_DOWNLOADABLE_CORE_PACKAGE_IDS = new Set(["about-me-keeper"]);
const CATALOG_URL = process.env.MARINARA_AGENT_CATALOG_URL?.trim() ||
  "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/catalog.json";
const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 250 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const KNOWN_INCOMPATIBLE_RUNTIMES = new Map([
  [
    "hierarchical-maps@1.0.0",
    "Hierarchical Maps 1.0.0 is incompatible with file-native storage. Update the package before using maps.",
  ],
]);

function normalizeArchivePath(value: string): string {
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
  return (((entry.attr >>> 16) & 0o170000) === 0o120000);
}

function inside(root: string, candidate: string): string {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error("Package contains an unsafe path");
  return target;
}

function runtimeBlockReason(installed: InstalledCapabilityPackage): string | null {
  return getCapabilityApiCompatibilityIssue(installed.manifest) ??
    KNOWN_INCOMPATIBLE_RUNTIMES.get(`${installed.id}@${installed.version}`) ??
    null;
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

async function writeAvailabilityMigration(kind: "fresh" | "legacy") {
  await mkdir(ROOT, { recursive: true });
  const temporary = `${AVAILABILITY_MIGRATION}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, kind, completedAt: new Date().toISOString() }, null, 2), {
    mode: 0o600,
  });
  await rename(temporary, AVAILABILITY_MIGRATION);
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

async function installCatalogPackage(entry: CapabilityCatalogPackage, activateDuringStartup = false) {
  const { manifest, artifact } = entry;
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
  const entries = zip.getEntries().filter((item) => !item.isDirectory);
  const names = new Set<string>();
  let expandedBytes = 0;
  for (const item of entries) {
    const name = normalizeArchivePath(item.entryName);
    if (names.has(name)) throw new Error(`Package contains duplicate file ${name}`);
    if (isSymlink(item)) throw new Error("Package links are not allowed");
    names.add(name);
    expandedBytes += item.header.size;
    if (expandedBytes > MAX_EXPANDED_BYTES) throw new Error("Expanded package is too large");
  }
  const manifestEntry = entries.find((item) => item.entryName === "manifest.json");
  if (!manifestEntry || manifestEntry.header.size > MAX_MANIFEST_BYTES) {
    throw new Error("Package manifest is missing or too large");
  }
  const installedManifest = capabilityPackageManifestSchema.parse(JSON.parse(manifestEntry.getData().toString("utf8")));
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) {
    throw new Error("Artifact manifest does not match the catalog");
  }
  const declaredFiles = new Map(installedManifest.files.map((file) => [normalizeArchivePath(file.path), file]));
  if (declaredFiles.size !== installedManifest.files.length) throw new Error("Package manifest declares duplicate files");
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
  if (installedManifest.entrypoints.agents) {
    const agentsPath = normalizeArchivePath(installedManifest.entrypoints.agents);
    const agentsFile = verifiedFiles.get(agentsPath);
    if (!agentsFile) throw new Error("Package agent definitions are missing");
    packagedAgentDefinitionsSchema.parse(JSON.parse(agentsFile.toString("utf8")));
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
    return installed;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export const capabilityPackageManager = {
  async catalog(): Promise<CapabilityCatalog> {
    const response = await safeFetch(CATALOG_URL, {
      policy: { allowedProtocols: ["https:"] },
      maxResponseBytes: 2 * 1024 * 1024,
      allowedContentTypes: ["application/json", "text/plain"],
      // The fixed catalog remains size-capped and must pass its Zod schema even
      // when a network intermediary strips the Content-Type header.
      allowMissingContentType: true,
      decodeCompressedResponse: true,
      headers: {
        Accept: "application/json, text/plain;q=0.9",
        "User-Agent": `MarinaraEngine/${APP_VERSION}`,
      },
      signal: AbortSignal.timeout(15_000),
      agentOptions: { bodyTimeout: 15_000, headersTimeout: 15_000 },
    });
    if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
    const catalog = capabilityCatalogSchema.parse(await response.json());
    return {
      ...catalog,
      packages: catalog.packages.filter((entry) => !NON_DOWNLOADABLE_CORE_PACKAGE_IDS.has(entry.manifest.id)),
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
      const entrypoint = installed.manifest.entrypoints.agents;
      if (!entrypoint) continue;
      const file = inside(VERSIONS, join(VERSIONS, installed.id, installed.version, normalizeArchivePath(entrypoint)));
      const parsed = packagedAgentDefinitionsSchema.parse(JSON.parse(await readFile(file, "utf8")));
      for (const definition of parsed) {
        if (ids.has(definition.id)) throw new Error(`Agent ${definition.id} is provided by more than one package`);
        ids.add(definition.id);
        definitions.push(definition);
      }
    }
    return definitions;
  },

  async runtimePackages() {
    const registry = await readRegistry();
    return registry.packages
      .filter((installed) => installed.status !== "error" && installed.manifest.entrypoints.server)
      .map((installed) => ({
        installed,
        serverEntrypoint: inside(
          VERSIONS,
          join(
            VERSIONS,
            installed.id,
            installed.version,
            normalizeArchivePath(installed.manifest.entrypoints.server!),
          ),
        ),
      }));
  },

  async clientEntrypoint(packageId: string) {
    const installed = (await readRegistry()).packages.find((item) => item.id === packageId);
    if (!installed || !isInstalledCapabilityReady(installed)) return null;
    const entrypoint = installed.manifest.entrypoints.client;
    if (!entrypoint) return null;
    return {
      installed,
      file: inside(
        VERSIONS,
        join(VERSIONS, installed.id, installed.version, normalizeArchivePath(entrypoint)),
      ),
    };
  },

  async markRuntimeStatus(packageId: string, status: InstalledCapabilityPackage["status"], error: string | null = null) {
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
    const previousManifestFile = inside(
      VERSIONS,
      join(VERSIONS, current.id, current.previousVersion, "manifest.json"),
    );
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
          serverEntrypoint: inside(VERSIONS, join(VERSIONS, restored.id, restored.version, normalizeArchivePath(server))),
        }
      : null;
  },

  async migrateLegacyAvailability(legacyInstall: boolean) {
    if (existsSync(AVAILABILITY_MIGRATION)) return { migrated: false, legacy: legacyInstall, complete: true };
    if (!legacyInstall) {
      await writeAvailabilityMigration("fresh");
      return { migrated: false, legacy: false, complete: true };
    }

    const catalog = await this.catalog();
    const installedById = new Map((await this.installed()).map((item) => [item.id, item]));
    for (const entry of catalog.packages) {
      if (installedById.get(entry.manifest.id)?.version === entry.manifest.version) continue;
      await installCatalogPackage(entry, true);
    }
    await writeAvailabilityMigration("legacy");
    return { migrated: true, legacy: true, complete: true };
  },

  async updateInstalledPackagesToLatest() {
    const installedPackages = await this.installed();
    if (installedPackages.length === 0) return { checked: 0, updated: [], failures: [] };
    const catalog = await this.catalog();
    const candidates = findCompatibleCapabilityPackageUpdates(installedPackages, catalog);
    const updated: Array<{ id: string; previousVersion: string; version: string }> = [];
    const failures: Array<{ id: string; previousVersion: string; version: string; error: unknown }> = [];
    for (const { installed, entry } of candidates) {
      try {
        const next = await installCatalogPackage(entry, true);
        updated.push({ id: next.id, previousVersion: installed.version, version: next.version });
      } catch (error) {
        failures.push({
          id: installed.id,
          previousVersion: installed.version,
          version: entry.manifest.version,
          error,
        });
      }
    }
    return { checked: installedPackages.length, updated, failures };
  },

  async install(packageId: string) {
    const catalog = await this.catalog();
    const entry = catalog.packages.find((candidate) => candidate.manifest.id === packageId);
    if (!entry) throw new Error("Package is not present in the official catalog");
    return installCatalogPackage(entry);
  },

  async uninstall(packageId: string) {
    const registry = await readRegistry();
    const existing = registry.packages.find((item) => item.id === packageId);
    if (!existing) return false;
    if (existing.manifest.kind.includes("conversation-calls")) {
      await sidecarSpeechService.deleteAllModels();
    }
    await writeRegistry(registry.packages.filter((item) => item.id !== packageId));
    await rm(join(VERSIONS, packageId), { recursive: true, force: true });
    return existing;
  },
};
