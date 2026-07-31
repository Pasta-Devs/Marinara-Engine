import {
  createPersonalExtensionSchema,
  PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
  normalizePersonalExtensionCapabilities,
  type CreatePersonalExtensionInput,
  type PersonalExtension,
  type PersonalExtensionRevision,
  type PersonalExtensionSource,
  type UpdatePersonalExtensionInput,
} from "@marinara-engine/shared";
import { desc, eq, like } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { installedExtensions } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { computePersonalExtensionHash } from "./personal-extension-hash.js";

type ExtensionRow = typeof installedExtensions.$inferSelect;
type ExtensionInsert = typeof installedExtensions.$inferInsert;

const MAX_REVISIONS = 10;

function normalizeSource(value: unknown): PersonalExtensionSource {
  return value === "external" || value === "local" || value === "professor_mari" || value === "profile_import"
    ? value
    : "legacy";
}

function parseCapabilities(value: unknown) {
  if (typeof value !== "string") return normalizePersonalExtensionCapabilities(value);
  try {
    return normalizePersonalExtensionCapabilities(JSON.parse(value));
  } catch {
    return [];
  }
}

function capabilitiesForSource(value: unknown, source: PersonalExtensionSource) {
  const capabilities = parseCapabilities(value);
  return source === "professor_mari"
    ? capabilities.filter((capability) => capability !== PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY)
    : capabilities;
}

function parseRevisions(value: unknown): PersonalExtensionRevision[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((revision): PersonalExtensionRevision[] => {
      if (!revision || typeof revision !== "object" || Array.isArray(revision)) return [];
      const record = revision as Record<string, unknown>;
      if (
        typeof record.contentHash !== "string" ||
        typeof record.savedAt !== "string" ||
        (record.runtime !== "client" && record.runtime !== "server")
      ) {
        return [];
      }
      return [
        {
          contentHash: record.contentHash,
          version: typeof record.version === "string" ? record.version : null,
          runtime: record.runtime,
          capabilities: normalizePersonalExtensionCapabilities(record.capabilities),
          css: typeof record.css === "string" ? record.css : null,
          js: typeof record.js === "string" ? record.js : null,
          serverJs: typeof record.serverJs === "string" ? record.serverJs : null,
          savedAt: record.savedAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

function mapExtension(row: ExtensionRow): PersonalExtension {
  const runtime = row.runtime === "server" ? "server" : "client";
  const source = normalizeSource(row.source);
  const executable = {
    runtime,
    capabilities: runtime === "client" ? capabilitiesForSource(row.capabilities, source) : [],
    css: runtime === "client" ? (row.css ?? null) : null,
    js: runtime === "client" ? (row.js ?? null) : null,
    serverJs: runtime === "server" ? (row.serverJs ?? null) : null,
  } as const;
  const actualHash = computePersonalExtensionHash(executable);
  const storedHash = row.contentHash || actualHash;
  const approvedHash = row.approvedHash ?? null;
  return {
    id: row.id,
    name: row.name,
    version: row.version ?? null,
    description: row.description,
    ...executable,
    enabled: row.enabled === "true" && storedHash === actualHash && approvedHash === actualHash,
    contentHash: actualHash,
    approvedHash: approvedHash === actualHash ? approvedHash : null,
    source,
    revisions: parseRevisions(row.revisions),
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function revisionFrom(extension: PersonalExtension): PersonalExtensionRevision {
  return {
    contentHash: extension.contentHash,
    version: extension.version,
    runtime: extension.runtime,
    capabilities: extension.capabilities,
    css: extension.css,
    js: extension.js,
    serverJs: extension.serverJs,
    savedAt: now(),
  };
}

function normalizePayload(input: CreatePersonalExtensionInput, source: PersonalExtensionSource) {
  const parsed = createPersonalExtensionSchema.parse(input);
  const runtime = parsed.runtime === "server" ? "server" : "client";
  if (
    source === "professor_mari" &&
    parsed.capabilities.includes(PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY)
  ) {
    throw new Error("Professor Mari extensions cannot request full page access");
  }
  return {
    name: parsed.name,
    version: parsed.version == null ? null : String(parsed.version),
    description: parsed.description ?? "",
    runtime,
    capabilities: runtime === "client" ? capabilitiesForSource(parsed.capabilities, source) : [],
    css: runtime === "client" ? (parsed.css ?? null) : null,
    js: runtime === "client" ? (parsed.js ?? null) : null,
    serverJs: runtime === "server" ? (parsed.serverJs ?? null) : null,
  } as const;
}

export function createPersonalExtensionsStorage(db: DB) {
  const getById = async (id: string) => {
    const rows = await db.select().from(installedExtensions).where(eq(installedExtensions.id, id));
    const row = rows[0];
    return row ? mapExtension(row) : null;
  };

  const getByName = async (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return null;
    const rows = await db
      .select()
      .from(installedExtensions)
      .where(like(installedExtensions.name, `%${normalizedName}%`))
      .orderBy(desc(installedExtensions.installedAt));
    const row = rows.find((candidate) => candidate.name.trim().toLowerCase() === normalizedName);
    return row ? mapExtension(row) : null;
  };

  const list = async () => {
    const rows = await db.select().from(installedExtensions).orderBy(desc(installedExtensions.installedAt));
    return rows.map(mapExtension);
  };

  return {
    list,

    getById,
    getByName,

    async create(
      input: CreatePersonalExtensionInput,
      options: { source?: PersonalExtensionSource; id?: string; installedAt?: string } = {},
    ) {
      const source = options.source ?? "external";
      const payload = normalizePayload(input, source);
      const id = options.id ?? newId();
      const timestamp = now();
      const contentHash = computePersonalExtensionHash(payload);
      await db.insert(installedExtensions).values({
        id,
        ...payload,
        capabilities: JSON.stringify(payload.capabilities),
        enabled: "false",
        contentHash,
        approvedHash: null,
        source,
        revisions: "[]",
        installedAt: options.installedAt ?? timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return getById(id);
    },

    async update(id: string, data: UpdatePersonalExtensionInput) {
      const existing = await getById(id);
      if (!existing) return null;
      const runtime = data.runtime ?? existing.runtime;
      const payload = normalizePayload(
        {
          name: data.name ?? existing.name,
          version: data.version === undefined ? existing.version : data.version,
          description: data.description ?? existing.description,
          runtime,
          capabilities:
            runtime === "client" ? (data.capabilities === undefined ? existing.capabilities : data.capabilities) : [],
          css: runtime === "client" ? (data.css === undefined ? existing.css : data.css) : null,
          js: runtime === "client" ? (data.js === undefined ? existing.js : data.js) : null,
          serverJs: runtime === "server" ? (data.serverJs === undefined ? existing.serverJs : data.serverJs) : null,
        },
        existing.source,
      );
      const contentHash = computePersonalExtensionHash(payload);
      const executableChanged = contentHash !== existing.contentHash;
      const revisions = executableChanged
        ? [
            revisionFrom(existing),
            ...existing.revisions.filter((revision) => revision.contentHash !== existing.contentHash),
          ].slice(0, MAX_REVISIONS)
        : existing.revisions;
      const update: Partial<ExtensionInsert> = {
        ...payload,
        capabilities: JSON.stringify(payload.capabilities),
        contentHash,
        revisions: JSON.stringify(revisions),
        updatedAt: now(),
      };
      if (executableChanged) {
        update.enabled = "false";
        update.approvedHash = null;
      } else if (data.enabled === false) {
        update.enabled = "false";
      }
      await db.update(installedExtensions).set(update).where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async approve(id: string, contentHash: string) {
      const existing = await getById(id);
      if (!existing) return null;
      if (existing.contentHash !== contentHash) {
        throw new Error("Extension content changed before approval. Review the current code and try again.");
      }
      await db
        .update(installedExtensions)
        .set({ contentHash, approvedHash: contentHash, enabled: "true", updatedAt: now() })
        .where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async disable(id: string) {
      const existing = await getById(id);
      if (!existing) return null;
      await db
        .update(installedExtensions)
        .set({ enabled: "false", updatedAt: now() })
        .where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async disableExternal() {
      const extensions = await list();
      const external = extensions.filter((extension) => extension.source !== "professor_mari" && extension.enabled);
      for (const extension of external) {
        await db
          .update(installedExtensions)
          .set({ enabled: "false", updatedAt: now() })
          .where(eq(installedExtensions.id, extension.id));
      }
      return external.length;
    },

    async rollback(id: string, contentHash: string) {
      const existing = await getById(id);
      if (!existing) return null;
      const revision = existing.revisions.find((candidate) => candidate.contentHash === contentHash);
      if (!revision) throw new Error("Extension revision not found");
      const nextRevisions = [
        revisionFrom(existing),
        ...existing.revisions.filter((candidate) => candidate.contentHash !== contentHash),
      ].slice(0, MAX_REVISIONS);
      await db
        .update(installedExtensions)
        .set({
          version: revision.version,
          runtime: revision.runtime,
          capabilities: JSON.stringify(revision.capabilities),
          css: revision.runtime === "client" ? revision.css : null,
          js: revision.runtime === "client" ? revision.js : null,
          serverJs: revision.runtime === "server" ? revision.serverJs : null,
          enabled: "false",
          contentHash: revision.contentHash,
          approvedHash: null,
          revisions: JSON.stringify(nextRevisions),
          updatedAt: now(),
        })
        .where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async remove(id: string) {
      await db.delete(installedExtensions).where(eq(installedExtensions.id, id));
    },
  };
}
