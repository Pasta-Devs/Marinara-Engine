// ──────────────────────────────────────────────
// Storage: Installed Extensions
// ──────────────────────────────────────────────
import { desc, eq, like } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { installedExtensions } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateExtensionInput, InstalledExtension, UpdateExtensionInput } from "@marinara-engine/shared";

type ExtensionRow = typeof installedExtensions.$inferSelect;

function mapExtension(row: ExtensionRow): InstalledExtension {
  return {
    id: row.id,
    name: row.name,
    version: row.version ?? null,
    description: row.description,
    runtime: row.runtime === "server" ? "server" : "client",
    css: row.css ?? null,
    js: row.js ?? null,
    serverJs: row.serverJs ?? null,
    enabled: row.enabled === "true",
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createExtensionsStorage(db: DB) {
  // Lexical helper so create()/update() don't depend on `this` — keeps the
  // storage object safe to destructure or pass as a callback.
  const getById = async (id: string) => {
    const rows = await db.select().from(installedExtensions).where(eq(installedExtensions.id, id));
    const row = rows[0];
    return row ? mapExtension(row) : null;
  };

  const getByName = async (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) return null;
    const extensions = await db
      .select()
      .from(installedExtensions)
      .where(like(installedExtensions.name, `%${normalizedName}%`))
      .orderBy(desc(installedExtensions.installedAt));
    const row = extensions.find((extension) => extension.name.trim().toLowerCase() === normalizedName);
    return row ? mapExtension(row) : null;
  };

  return {
    async list() {
      const rows = await db.select().from(installedExtensions).orderBy(desc(installedExtensions.installedAt));
      return rows.map(mapExtension);
    },

    getById,
    getByName,

    async create(input: CreateExtensionInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(installedExtensions).values({
        id,
        name: input.name,
        version: input.version == null ? null : String(input.version),
        description: input.description ?? "",
        runtime: input.runtime === "server" ? "server" : "client",
        css: input.runtime === "server" ? null : (input.css ?? null),
        js: input.runtime === "server" ? null : (input.js ?? null),
        serverJs: input.runtime === "server" ? (input.serverJs ?? null) : null,
        enabled: input.enabled === false ? "false" : "true",
        installedAt: input.installedAt ?? timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return getById(id);
    },

    async update(id: string, data: UpdateExtensionInput) {
      const updateFields: Partial<typeof installedExtensions.$inferInsert> = {
        updatedAt: now(),
      };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.version !== undefined) updateFields.version = data.version;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.runtime !== undefined) updateFields.runtime = data.runtime === "server" ? "server" : "client";
      if (data.css !== undefined) updateFields.css = data.css;
      if (data.js !== undefined) updateFields.js = data.js;
      if (data.serverJs !== undefined) updateFields.serverJs = data.serverJs;
      if (data.enabled !== undefined) updateFields.enabled = data.enabled ? "true" : "false";
      if (data.runtime === "server") {
        updateFields.css = null;
        updateFields.js = null;
      } else if (data.runtime === "client") {
        updateFields.serverJs = null;
      }
      await db.update(installedExtensions).set(updateFields).where(eq(installedExtensions.id, id));
      return getById(id);
    },

    async remove(id: string) {
      await db.delete(installedExtensions).where(eq(installedExtensions.id, id));
    },
  };
}
