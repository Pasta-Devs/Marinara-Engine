import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import AdmZip from "adm-zip";
import { z } from "zod";
import {
  APP_VERSION,
  packagedAgentDefinitionsSchema,
  parseAgentSettingsRecord,
  type CreateAgentConfigInput,
  type CustomAgentRepository,
  type CustomAgentRepositoryChange,
  type CustomAgentRepositoryPreview,
  type PackagedAgentDefinition,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch } from "../../utils/security.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { normalizeArchivePath, validatePackageArchiveEntries } from "../capability-packages/package-manager.service.js";

const REGISTRY_FILE = join(DATA_DIR, "agents", "custom-repositories.json");
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_DEFINITIONS_BYTES = 1024 * 1024;
const MAX_AGENT_DEFINITIONS = 100;
const SOURCE_SETTINGS_KEY = "customAgentRepositorySource";
const ALLOWED_ARCHIVE_HOSTS = ["github.com", "codeload.github.com"];

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

interface RepositorySnapshot {
  repository: RepositoryIdentity;
  digest: string;
  definitions: PackagedAgentDefinition[];
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

export function parseCustomAgentRepositoryArchive(archive: Buffer): PackagedAgentDefinition[] {
  const zip = new AdmZip(archive);
  const entries = validatePackageArchiveEntries(zip, MAX_EXPANDED_BYTES);
  const definitionEntries = entries.filter((entry) => {
    const parts = normalizeArchivePath(entry.entryName).split("/");
    return parts.length === 2 && parts[1] === "agents.json";
  });
  if (definitionEntries.length !== 1) {
    throw new Error("Repository archive must contain exactly one top-level agents.json file");
  }

  const definitionEntry = definitionEntries[0]!;
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
    if (definition.execution === "feature") {
      throw new Error(`Agent ${definition.id} requires a package runtime and cannot be imported as a custom agent`);
    }
    ids.add(definition.id);
  }
  return definitions;
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
    const definitions = parseCustomAgentRepositoryArchive(archive);
    logger.info("Fetched %d custom agent definitions from repository %s", definitions.length, repository.url);
    return {
      repository,
      digest: createHash("sha256").update(archive).digest("hex"),
      definitions,
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
  const settings: Record<string, unknown> = {
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

function buildPreview(snapshot: RepositorySnapshot, agents: StoredAgent[]): CustomAgentRepositoryPreview {
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
  return { repository: snapshot.repository, digest: snapshot.digest, changes };
}

function hasContentChanges(preview: CustomAgentRepositoryPreview) {
  return preview.changes.some((change) => change.status !== "unchanged");
}

export function createCustomAgentRepositoriesService(db: DB) {
  const storage = createAgentsStorage(db);

  async function previewSnapshot(url: string) {
    const snapshot = await fetchRepositorySnapshot(url);
    return { snapshot, preview: buildPreview(snapshot, await storage.list()) };
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
    // A definition removed upstream becomes an ordinary local custom agent.
    // This honors the remote list without deleting the user's runs or memory.
    for (const agent of managed.values()) {
      await storage.update(agent.id, { settings: withoutSource(agent.settings) });
    }
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
        await applySnapshot(snapshot);
        const repository: CustomAgentRepository = {
          ...snapshot.repository,
          lastDigest: snapshot.digest,
          lastSyncedAt: new Date().toISOString(),
          agentCount: snapshot.definitions.length,
        };
        await writeRegistry([...registry.repositories, repository]);
        logger.info("Added custom agent repository %s with %d agents", repository.url, repository.agentCount);
        return repository;
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
        await applySnapshot(snapshot);
        const repository: CustomAgentRepository = {
          ...current,
          lastDigest: snapshot.digest,
          lastSyncedAt: new Date().toISOString(),
          agentCount: snapshot.definitions.length,
        };
        await writeRegistry(registry.repositories.map((entry) => (entry.id === repositoryId ? repository : entry)));
        logger.info("Synced custom agent repository %s with %d agents", repository.url, repository.agentCount);
        return repository;
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
        await writeRegistry(registry.repositories.filter((entry) => entry.id !== repositoryId));
        logger.info("Removed custom agent repository %s", repository.url);
        return true;
      });
    },
  };
}
