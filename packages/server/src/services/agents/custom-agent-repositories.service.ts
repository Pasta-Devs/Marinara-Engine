import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import AdmZip from "adm-zip";
import { z } from "zod";
import {
  APP_VERSION,
  communityRulesetId,
  CUSTOM_AGENT_IMPORT_SOURCE_SETTING,
  CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING,
  normalizeCustomAgentCapabilities,
  packagedAgentDefinitionsSchema,
  parseAgentSettingsRecord,
  parseRulesetDefinition,
  RULESET_LOCAL_NAMESPACE,
  RULESET_MAX_BYTES,
  type CreateAgentConfigInput,
  type CustomAgentRepository,
  type CustomAgentRepositoryApplyResult,
  type CustomAgentRepositoryChange,
  type CustomAgentRepositoryPreview,
  type CustomAgentRepositoryRulesetChange,
  type CustomAgentRepositoryRulesetResult,
  type PackagedAgentDefinition,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import {
  createGameRulesetsStorage,
  RulesetRefusedError,
  RulesetVersionConflictError,
  type GameRulesetRow,
} from "../storage/game-rulesets.storage.js";
import { normalizeArchivePath, validatePackageArchiveEntries } from "../capability-packages/package-manager.service.js";

const REGISTRY_FILE = join(DATA_DIR, "agents", "custom-repositories.json");
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_DEFINITIONS_BYTES = 1024 * 1024;
const MAX_AGENT_DEFINITIONS = 100;
const MAX_REPOSITORY_RULESETS = 32;
const RULESETS_FOLDER = "rulesets";
const SOURCE_SETTINGS_KEY = "customAgentRepositorySource";
const ALLOWED_ARCHIVE_HOSTS = ["github.com", "codeload.github.com"];
/** Rejects a file that is not valid UTF-8 instead of quietly substituting replacement characters,
 *  which would change the bytes a stored ruleset is hashed and pinned by. */
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

let registryMutationQueue = Promise.resolve();

async function withRegistryMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previousOperation = registryMutationQueue;
  let release: () => void = () => undefined;
  registryMutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previousOperation;
  try {
    return await operation();
  } finally {
    release();
  }
}

const repositorySchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{16}$/u),
    url: z.string().url(),
    owner: z.string().min(1),
    name: z.string().min(1),
    lastDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
    agentCount: z.number().int().min(0).max(MAX_AGENT_DEFINITIONS),
    // Defaulted, not required: registries written before repositories could carry rulesets must
    // still load, or every configured source would disappear at once.
    rulesetCount: z.number().int().min(0).max(MAX_REPOSITORY_RULESETS).default(0),
  })
  .strict();

const registrySchema = z
  .object({
    schemaVersion: z.literal(1),
    repositories: z.array(repositorySchema),
  })
  .strict();

const sourceSchema = z
  .object({
    repositoryId: z.string(),
    repositoryUrl: z.string().url(),
    agentId: z.string(),
  })
  .strict();

type RepositoryIdentity = Pick<CustomAgentRepository, "id" | "url" | "owner" | "name">;
type StoredAgent = Awaited<ReturnType<ReturnType<typeof createAgentsStorage>["list"]>>[number];

/** One `<top>/rulesets/*.json` entry as it came out of the archive. `text` is null when the file is
 *  too large or not valid UTF-8, which makes that one file unusable (`issue` says why) rather than
 *  refusing the whole repository. */
export interface RepositoryRulesetFile {
  file: string;
  text: string | null;
  issue?: string;
}

export interface CustomAgentRepositoryContents {
  definitions: PackagedAgentDefinition[];
  rulesets: RepositoryRulesetFile[];
}

/** One ruleset file after validation: either a ruleset ready to store, or the reasons it is not one.
 *  An unusable file is a single row the user sees and the confirm skips, never a failed repository:
 *  one author's typo must not take the agents and the other rulesets down with it. */
export interface RepositoryRulesetCandidate {
  file: string;
  ruleset: { rulesetId: string; definition: RulesetDefinition; text: string } | null;
  issues: string[];
}

interface RepositorySnapshot {
  repository: RepositoryIdentity;
  digest: string;
  definitions: PackagedAgentDefinition[];
  rulesets: RepositoryRulesetCandidate[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeCustomAgentRepositoryUrl(value: string): RepositoryIdentity {
  const parsed = new URL(value.trim());
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Use a public GitHub repository URL such as https://github.com/owner/repository");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("Use the repository root URL, not a branch, file, or subdirectory URL");
  }
  const owner = parts[0]!;
  const name = parts[1]!.replace(/\.git$/iu, "");
  const validPart = /^[a-z0-9_.-]{1,100}$/iu;
  if (!validPart.test(owner) || !validPart.test(name) || name === "." || name === "..") {
    throw new Error("The GitHub owner or repository name is invalid");
  }

  const url = `https://github.com/${owner.toLowerCase()}/${name.toLowerCase()}`;
  return {
    id: createHash("sha256").update(url).digest("hex").slice(0, 16),
    url,
    owner: owner.toLowerCase(),
    name: name.toLowerCase(),
  };
}

/** Returns null when the archive has no `agents.json` at all, which a rulesets-only repository is
 *  allowed to be. An `agents.json` that lists nothing stays an empty list, exactly as before. */
function readAgentDefinitions(entries: AdmZip.IZipEntry[]): PackagedAgentDefinition[] | null {
  const definitionEntries = entries.filter((entry) => {
    const parts = normalizeArchivePath(entry.entryName).split("/");
    return parts.length === 2 && parts[1] === "agents.json";
  });
  if (definitionEntries.length > 1) {
    throw new Error("Repository archive must contain at most one top-level agents.json file");
  }
  const definitionEntry = definitionEntries[0];
  if (!definitionEntry) return null;

  if (definitionEntry.header.size > MAX_DEFINITIONS_BYTES) throw new Error("agents.json is too large");
  const data = definitionEntry.getData();
  if (data.byteLength > MAX_DEFINITIONS_BYTES) throw new Error("agents.json is too large");
  const definitions = packagedAgentDefinitionsSchema.parse(JSON.parse(data.toString("utf8")));
  if (definitions.length > MAX_AGENT_DEFINITIONS) {
    throw new Error(`A custom repository may contain at most ${MAX_AGENT_DEFINITIONS} agents`);
  }

  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new Error(`agents.json contains duplicate agent id ${definition.id}`);
    if (definition.execution === "feature" || definition.execution === "host") {
      throw new Error(`Agent ${definition.id} requires a package runtime and cannot be imported as a custom agent`);
    }
    ids.add(definition.id);
  }
  return definitions;
}

function readRepositoryRulesets(entries: AdmZip.IZipEntry[]): RepositoryRulesetFile[] {
  const rulesetEntries = entries.filter((entry) => {
    const parts = normalizeArchivePath(entry.entryName).split("/");
    // Direct children of `<top>/rulesets/` only: a deeper path is the author's own working material,
    // not something this lane publishes, and reading it would make the folder's contract unclear.
    return parts.length === 3 && parts[1] === RULESETS_FOLDER && parts[2]!.endsWith(".json");
  });
  if (rulesetEntries.length > MAX_REPOSITORY_RULESETS) {
    throw new Error(`A custom repository may contain at most ${MAX_REPOSITORY_RULESETS} rulesets`);
  }
  return (
    rulesetEntries
      .map((entry) => {
        const file = normalizeArchivePath(entry.entryName).split("/")[2]!;
        // Both the header's claim and the real decompressed length, because a header is only what the
        // archive says about itself. The archive as a whole is already bounded, so one oversized file
        // is that file's problem and not the repository's.
        const tooLarge = { file, text: null, issue: `The file is over the ${RULESET_MAX_BYTES}-byte limit` };
        if (entry.header.size > RULESET_MAX_BYTES) return tooLarge;
        const data = entry.getData();
        if (data.byteLength > RULESET_MAX_BYTES) return tooLarge;
        try {
          return { file, text: utf8Decoder.decode(data) };
        } catch {
          return { file, text: null };
        }
      })
      // By name, so which of two files claiming one ruleset id counts as the duplicate does not depend
      // on the order the archive happens to list them in.
      .sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  );
}

/** Everything a repository publishes, from one pass over one safety-checked archive. A repository
 *  may carry agents, rulesets, or both; an archive with neither has nothing to import and is
 *  refused so the user is told rather than shown an empty preview. Pure, so the regression covers it
 *  without reaching the network. */
export function parseCustomAgentRepositoryContents(archive: Buffer): CustomAgentRepositoryContents {
  const zip = new AdmZip(archive);
  const entries = validatePackageArchiveEntries(zip, MAX_EXPANDED_BYTES);
  const definitions = readAgentDefinitions(entries);
  const rulesets = readRepositoryRulesets(entries);
  if (!definitions && rulesets.length === 0) {
    throw new Error("Repository archive must contain a top-level agents.json file, rulesets/*.json files, or both");
  }
  return { definitions: definitions ?? [], rulesets };
}

export function parseCustomAgentRepositoryArchive(archive: Buffer): PackagedAgentDefinition[] {
  return parseCustomAgentRepositoryContents(archive).definitions;
}

/** Validate each ruleset file and give it the namespaced id it would be installed under. The
 *  document itself always carries the bare id; the repository owner is the namespace, so two authors
 *  can both publish a `v20` and neither can take an official ruleset's id. Pure. */
export function classifyRepositoryRulesets(
  owner: string,
  files: readonly RepositoryRulesetFile[],
): RepositoryRulesetCandidate[] {
  const claimedBy = new Map<string, string>();
  return files.map(({ file, text, issue }): RepositoryRulesetCandidate => {
    const unusable = (...issues: string[]): RepositoryRulesetCandidate => ({ file, ruleset: null, issues });
    // `local/` is where rulesets imported from a file live. A GitHub account that happens to be
    // called "local" must not be able to file its rulesets among the user's own.
    if (owner === RULESET_LOCAL_NAMESPACE) {
      return unusable(`Rulesets cannot be installed from an account named "${RULESET_LOCAL_NAMESPACE}"`);
    }
    if (text === null) return unusable(issue ?? "The file is not valid UTF-8 text");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return unusable("The file is not valid JSON");
    }
    // Reserved ids fail here: `parseRulesetDefinition` already refuses the Engine's own ruleset ids.
    const parsed = parseRulesetDefinition(json);
    if (!parsed.ok) return unusable(...parsed.issues.slice(0, 5));
    const claimed = claimedBy.get(parsed.definition.id);
    if (claimed) return unusable(`${claimed} already publishes the ruleset id "${parsed.definition.id}"`);
    try {
      const rulesetId = communityRulesetId(owner, parsed.definition.id);
      claimedBy.set(parsed.definition.id, file);
      return { file, ruleset: { rulesetId, definition: parsed.definition, text }, issues: [] };
    } catch (error) {
      return unusable(error instanceof Error ? error.message : "The ruleset id cannot be namespaced");
    }
  });
}

async function fetchRepositorySnapshot(value: string): Promise<RepositorySnapshot> {
  const repository = normalizeCustomAgentRepositoryUrl(value);
  try {
    const archiveUrl = `${repository.url}/archive/HEAD.zip`;
    const response = await safeFetch(archiveUrl, {
      policy: {
        allowedProtocols: ["https:"],
        allowedHostnames: ALLOWED_ARCHIVE_HOSTS,
        maxRedirects: 5,
      },
      maxResponseBytes: MAX_ARCHIVE_BYTES,
      allowedContentTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
      allowMissingContentType: true,
      headers: {
        Accept: "application/zip, application/octet-stream;q=0.9",
        "User-Agent": `MarinaraEngine/${APP_VERSION}`,
      },
      signal: AbortSignal.timeout(30_000),
      agentOptions: { bodyTimeout: 30_000, headersTimeout: 15_000 },
    });
    if (!response.ok) throw new Error(`Repository download failed with HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    const contents = parseCustomAgentRepositoryContents(archive);
    const rulesets = classifyRepositoryRulesets(repository.owner, contents.rulesets);
    logger.info(
      "Fetched %d custom agent definitions and %d rulesets from repository %s",
      contents.definitions.length,
      rulesets.length,
      repository.url,
    );
    return {
      repository,
      digest: createHash("sha256").update(archive).digest("hex"),
      definitions: contents.definitions,
      rulesets,
    };
  } catch (error) {
    logger.error(error, "Failed to fetch custom agent repository %s", repository.url);
    throw error;
  }
}

async function readRegistry() {
  if (!existsSync(REGISTRY_FILE)) return { schemaVersion: 1 as const, repositories: [] };
  return registrySchema.parse(JSON.parse(await readFile(REGISTRY_FILE, "utf8")));
}

async function writeRegistry(repositories: CustomAgentRepository[]) {
  await mkdir(dirname(REGISTRY_FILE), { recursive: true });
  const temporary = `${REGISTRY_FILE}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, repositories }, null, 2), { mode: 0o600 });
  await rename(temporary, REGISTRY_FILE);
}

function sourceFor(settings: unknown) {
  return sourceSchema.safeParse(parseAgentSettingsRecord(settings)[SOURCE_SETTINGS_KEY]).data ?? null;
}

function withoutSource(settings: unknown): Record<string, unknown> {
  const parsed = parseAgentSettingsRecord(settings);
  const { [SOURCE_SETTINGS_KEY]: _source, ...rest } = parsed;
  return rest;
}

export function buildRepositoryAgentInput(
  repository: RepositoryIdentity,
  definition: PackagedAgentDefinition,
): CreateAgentConfigInput {
  const requestedSettings: Record<string, unknown> = {
    ...(definition.defaultSettings ?? {}),
    ...(definition.author ? { author: definition.author } : {}),
    ...(definition.defaultTools ? { enabledTools: [...definition.defaultTools] } : {}),
    ...(definition.promptTemplates
      ? { promptTemplates: definition.promptTemplates.map((template) => ({ ...template })) }
      : {}),
    ...(definition.defaultInjectAsSection !== undefined ? { injectAsSection: definition.defaultInjectAsSection } : {}),
    ...(definition.runInterval !== undefined ? { runInterval: definition.runInterval } : {}),
    ...(definition.resultType !== undefined ? { resultType: definition.resultType } : {}),
    ...(definition.modeAllowlist ? { modeAllowlist: [...definition.modeAllowlist] } : {}),
    category: definition.category,
  };
  const requestedCapabilities = normalizeCustomAgentCapabilities({
    ...requestedSettings,
    [CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING]: false,
  });
  const settings: Record<string, unknown> = {
    ...requestedSettings,
    customCapabilities: requestedCapabilities,
    [CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING]: true,
    [CUSTOM_AGENT_IMPORT_SOURCE_SETTING]: "repository",
    [SOURCE_SETTINGS_KEY]: {
      repositoryId: repository.id,
      repositoryUrl: repository.url,
      agentId: definition.id,
    },
  };
  return {
    type: `repo-${repository.id}-${definition.id}`,
    name: definition.name,
    description: definition.description,
    phase: definition.phase,
    connectionId: null,
    imagePath: null,
    promptTemplate: definition.defaultPromptTemplate,
    settings,
  };
}

function changedFields(current: StoredAgent, desired: CreateAgentConfigInput): string[] {
  const fields: string[] = [];
  if (current.name !== desired.name) fields.push("name");
  if (current.description !== desired.description) fields.push("description");
  if (current.phase !== desired.phase) fields.push("phase");
  if (current.promptTemplate !== desired.promptTemplate) fields.push("prompt");
  if (stableJson(parseAgentSettingsRecord(current.settings)) !== stableJson(desired.settings))
    fields.push("settings/tools");
  return fields;
}

function managedAgentsForRepository(agents: StoredAgent[], repositoryId: string) {
  const managed = new Map<string, StoredAgent>();
  for (const agent of agents) {
    const source = sourceFor(agent.settings);
    if (source?.repositoryId !== repositoryId) continue;
    if (managed.has(source.agentId)) throw new Error(`Repository has duplicate local agent ${source.agentId}`);
    managed.set(source.agentId, agent);
  }
  return managed;
}

/** The same digest the storage files a version under, so a preview row and the storage agree on
 *  whether the repository is offering the bytes that are already installed. */
function rulesetDigest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function buildRulesetChanges(
  candidates: readonly RepositoryRulesetCandidate[],
  stored: readonly GameRulesetRow[],
): CustomAgentRepositoryRulesetChange[] {
  const installed = new Map<string, Map<number, string>>();
  for (const row of stored) {
    const versions = installed.get(row.rulesetId) ?? new Map<number, string>();
    versions.set(row.version, row.sha256);
    installed.set(row.rulesetId, versions);
  }
  return candidates.map((candidate) => {
    if (!candidate.ruleset) {
      return {
        file: candidate.file,
        rulesetId: null,
        name: candidate.file,
        version: null,
        status: "invalid",
        coverage: "",
        issues: candidate.issues,
      };
    }
    const { rulesetId, definition, text } = candidate.ruleset;
    const versions = installed.get(rulesetId);
    const current = versions?.get(definition.version);
    return {
      file: candidate.file,
      rulesetId,
      name: definition.name,
      version: definition.version,
      status: current ? (current === rulesetDigest(text) ? "unchanged" : "conflict") : versions ? "new-version" : "new",
      coverage: definition.coverage.summary,
      issues: [],
    };
  });
}

function buildPreview(
  snapshot: RepositorySnapshot,
  agents: StoredAgent[],
  storedRulesets: GameRulesetRow[],
): CustomAgentRepositoryPreview {
  const managed = managedAgentsForRepository(agents, snapshot.repository.id);
  const changes: CustomAgentRepositoryChange[] = snapshot.definitions.map((definition) => {
    const current = managed.get(definition.id);
    const fields = current ? changedFields(current, buildRepositoryAgentInput(snapshot.repository, definition)) : [];
    managed.delete(definition.id);
    return {
      agentId: definition.id,
      name: definition.name,
      status: current ? (fields.length > 0 ? "updated" : "unchanged") : "new",
      changedFields: fields,
      definition,
    };
  });
  for (const [agentId, agent] of managed) {
    changes.push({
      agentId,
      name: agent.name,
      status: "removed",
      changedFields: ["repository source"],
    });
  }
  return {
    repository: snapshot.repository,
    digest: snapshot.digest,
    changes,
    rulesets: buildRulesetChanges(snapshot.rulesets, storedRulesets),
  };
}

function hasContentChanges(preview: CustomAgentRepositoryPreview) {
  // An unusable or conflicting ruleset changes nothing on confirm, so it does not ask for one.
  return (
    preview.changes.some((change) => change.status !== "unchanged") ||
    preview.rulesets.some((ruleset) => ruleset.status === "new" || ruleset.status === "new-version")
  );
}

export function createCustomAgentRepositoriesService(db: DB) {
  const storage = createAgentsStorage(db);
  const rulesetStorage = createGameRulesetsStorage(db);

  async function previewSnapshot(url: string) {
    const snapshot = await fetchRepositorySnapshot(url);
    const [agents, storedRulesets] = await Promise.all([storage.list(), rulesetStorage.list()]);
    return { snapshot, preview: buildPreview(snapshot, agents, storedRulesets) };
  }

  /** Store every usable ruleset the repository publishes. A version that is already installed with
   *  different contents is left exactly as it is: a game pinned to it would otherwise wake up on
   *  other arithmetic, which is the one outcome the pin exists to prevent. */
  async function applyRulesets(snapshot: RepositorySnapshot): Promise<CustomAgentRepositoryRulesetResult> {
    const result: CustomAgentRepositoryRulesetResult = { added: 0, unchanged: 0, skipped: 0 };
    for (const candidate of snapshot.rulesets) {
      if (!candidate.ruleset) {
        result.skipped += 1;
        continue;
      }
      const { rulesetId, definition, text } = candidate.ruleset;
      try {
        const stored = await rulesetStorage.put({
          rulesetId,
          version: definition.version,
          sourceKind: "repository",
          sourceUrl: snapshot.repository.url,
          repositoryId: snapshot.repository.id,
          definition: text,
        });
        result[stored.status] += 1;
      } catch (error) {
        // Either refusal is about this one file. Anything else is the store failing, which has to
        // stop the confirm rather than be counted as a skipped ruleset.
        if (error instanceof RulesetVersionConflictError) {
          logger.warn(
            "Kept installed ruleset %s version %d rather than the differing one in %s",
            rulesetId,
            definition.version,
            snapshot.repository.url,
          );
        } else if (error instanceof RulesetRefusedError) {
          logger.warn("Skipped ruleset %s from %s: %s", rulesetId, snapshot.repository.url, error.message);
        } else {
          throw error;
        }
        result.skipped += 1;
      }
    }
    return result;
  }

  async function applySnapshot(snapshot: RepositorySnapshot) {
    const agents = await storage.list();
    const managed = managedAgentsForRepository(agents, snapshot.repository.id);
    for (const definition of snapshot.definitions) {
      const desired = buildRepositoryAgentInput(snapshot.repository, definition);
      const current = managed.get(definition.id);
      if (current) {
        await storage.update(current.id, {
          name: desired.name,
          description: desired.description,
          phase: desired.phase,
          promptTemplate: desired.promptTemplate,
          settings: desired.settings,
        });
        managed.delete(definition.id);
      } else {
        await storage.create(desired);
      }
    }
    // A definition removed upstream is detached from repository management, but
    // keeps its external-import provenance so the Danger Zone gate still applies.
    // This honors the remote list without deleting the user's runs or memory.
    for (const agent of managed.values()) {
      await storage.update(agent.id, { settings: withoutSource(agent.settings) });
    }
    // Rulesets have no counterpart to the loop above on purpose: a version withdrawn upstream stays
    // installed, because a game may be pinned to it and the author cannot be allowed to end it.
    return applyRulesets(snapshot);
  }

  /** The stored form plus what the confirm just did, which the two callers report identically. */
  function applyResult(
    repository: CustomAgentRepository,
    rulesets: CustomAgentRepositoryRulesetResult,
  ): CustomAgentRepositoryApplyResult {
    return { ...repository, rulesets };
  }

  /** Rulesets the repository publishes that the Engine can actually read. Unusable files are shown
   *  in the preview but are not something the source offers. */
  function usableRulesetCount(snapshot: RepositorySnapshot): number {
    return snapshot.rulesets.filter((candidate) => candidate.ruleset).length;
  }

  return {
    async list() {
      return (await readRegistry()).repositories;
    },

    async preview(url: string) {
      return (await previewSnapshot(url)).preview;
    },

    async add(url: string, expectedDigest: string, confirmed: boolean) {
      return withRegistryMutationLock(async () => {
        if (!confirmed) {
          logger.warn("Rejected custom agent repository add without trust confirmation for %s", url);
          throw new Error("Explicit trust confirmation is required before adding a repository");
        }
        const registry = await readRegistry();
        const { snapshot } = await previewSnapshot(url);
        if (registry.repositories.some((entry) => entry.id === snapshot.repository.id)) {
          throw new Error("This repository is already configured");
        }
        if (snapshot.digest !== expectedDigest) {
          logger.warn("Rejected changed custom agent repository %s after preview", snapshot.repository.url);
          throw new Error("Repository changed after preview; preview it again");
        }
        const rulesets = await applySnapshot(snapshot);
        const repository: CustomAgentRepository = {
          ...snapshot.repository,
          lastDigest: snapshot.digest,
          lastSyncedAt: new Date().toISOString(),
          agentCount: snapshot.definitions.length,
          rulesetCount: usableRulesetCount(snapshot),
        };
        await writeRegistry([...registry.repositories, repository]);
        logger.info(
          "Added custom agent repository %s with %d agents and %d rulesets",
          repository.url,
          repository.agentCount,
          repository.rulesetCount,
        );
        return applyResult(repository, rulesets);
      });
    },

    async sync(repositoryId: string, expectedDigest: string, confirmed: boolean) {
      return withRegistryMutationLock(async () => {
        const registry = await readRegistry();
        const current = registry.repositories.find((entry) => entry.id === repositoryId);
        if (!current) throw new Error("Custom agent repository not found");
        const { snapshot, preview } = await previewSnapshot(current.url);
        if (snapshot.digest !== expectedDigest) {
          logger.warn("Rejected changed custom agent repository %s after preview", snapshot.repository.url);
          throw new Error("Repository changed after preview; preview it again");
        }
        if (hasContentChanges(preview) && !confirmed) {
          logger.warn("Rejected custom agent repository sync without trust confirmation for %s", current.url);
          throw new Error("Explicit trust confirmation is required before applying repository changes");
        }
        const rulesets = await applySnapshot(snapshot);
        const repository: CustomAgentRepository = {
          ...current,
          lastDigest: snapshot.digest,
          lastSyncedAt: new Date().toISOString(),
          agentCount: snapshot.definitions.length,
          rulesetCount: usableRulesetCount(snapshot),
        };
        await writeRegistry(registry.repositories.map((entry) => (entry.id === repositoryId ? repository : entry)));
        logger.info(
          "Synced custom agent repository %s with %d agents and %d rulesets",
          repository.url,
          repository.agentCount,
          repository.rulesetCount,
        );
        return applyResult(repository, rulesets);
      });
    },

    async remove(repositoryId: string) {
      return withRegistryMutationLock(async () => {
        const registry = await readRegistry();
        const repository = registry.repositories.find((entry) => entry.id === repositoryId);
        if (!repository) return false;
        const agents = managedAgentsForRepository(await storage.list(), repositoryId);
        for (const agent of agents.values()) {
          await storage.update(agent.id, { settings: withoutSource(agent.settings) });
        }
        // Forget which source managed these rulesets, never delete them: a game pinned to one has to
        // keep playing after its source is removed, exactly like an imported agent keeps its runs.
        await rulesetStorage.detachRepository(repositoryId);
        await writeRegistry(registry.repositories.filter((entry) => entry.id !== repositoryId));
        logger.info("Removed custom agent repository %s", repository.url);
        return true;
      });
    },
  };
}
