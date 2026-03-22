// ──────────────────────────────────────────────
// Storage: API Connections
// ──────────────────────────────────────────────
import { eq, desc, and } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { apiConnections } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { encryptApiKey, decryptApiKey } from "../../utils/crypto.js";
import type { CreateConnectionInput } from "@marinara-engine/shared";

export function createConnectionsStorage(db: DB) {
  return {
    async list() {
      const rows = await db.select().from(apiConnections).orderBy(desc(apiConnections.updatedAt));
      // Mask API keys in list response
      return rows.map((r: any) => ({ ...r, apiKeyEncrypted: r.apiKeyEncrypted ? "••••••••" : "" }));
    },

    async getById(id: string) {
      const rows = await db.select().from(apiConnections).where(eq(apiConnections.id, id));
      return rows[0] ?? null;
    },

    /** Get connection with decrypted API key (for internal use only). */
    async getWithKey(id: string) {
      const conn = await this.getById(id);
      if (!conn) return null;
      return { ...conn, apiKey: decryptApiKey(conn.apiKeyEncrypted) };
    },

    async getDefault() {
      const rows = await db.select().from(apiConnections).where(eq(apiConnections.isDefault, "true"));
      return rows[0] ?? null;
    },

    async create(input: CreateConnectionInput) {
      const id = newId();
      const timestamp = now();
      // If this is set as default, unset others
      if (input.isDefault) {
        await db.update(apiConnections).set({ isDefault: "false" });
      }
      await db.insert(apiConnections).values({
        id,
        name: input.name,
        provider: input.provider,
        baseUrl: input.baseUrl ?? "",
        apiKeyEncrypted: encryptApiKey(input.apiKey ?? ""),
        model: input.model ?? "",
        maxContext: input.maxContext ?? 128000,
        isDefault: String(input.isDefault ?? false),
        useForRandom: String(input.useForRandom ?? false),
        enableCaching: String(input.enableCaching ?? false),
        embeddingModel: input.embeddingModel ?? "",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: Partial<CreateConnectionInput>) {
      const updateFields: Record<string, unknown> = { updatedAt: now() };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.provider !== undefined) updateFields.provider = data.provider;
      if (data.baseUrl !== undefined) updateFields.baseUrl = data.baseUrl;
      if (data.apiKey !== undefined) updateFields.apiKeyEncrypted = encryptApiKey(data.apiKey);
      if (data.model !== undefined) updateFields.model = data.model;
      if (data.maxContext !== undefined) updateFields.maxContext = data.maxContext;
      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          await db.update(apiConnections).set({ isDefault: "false" });
        }
        updateFields.isDefault = String(data.isDefault);
      }
      if (data.useForRandom !== undefined) {
        updateFields.useForRandom = String(data.useForRandom);
      }
      if (data.enableCaching !== undefined) {
        updateFields.enableCaching = String(data.enableCaching);
      }
      if (data.embeddingModel !== undefined) {
        updateFields.embeddingModel = data.embeddingModel;
      }
      await db.update(apiConnections).set(updateFields).where(eq(apiConnections.id, id));
      return this.getById(id);
    },

    /** Duplicate a connection (including the encrypted API key). */
    async duplicate(id: string) {
      const source = await this.getById(id);
      if (!source) return null;
      const newConnId = newId();
      const timestamp = now();
      await db.insert(apiConnections).values({
        id: newConnId,
        name: `${source.name} (Copy)`,
        provider: source.provider,
        baseUrl: source.baseUrl,
        apiKeyEncrypted: source.apiKeyEncrypted,
        model: source.model,
        maxContext: source.maxContext,
        isDefault: "false",
        useForRandom: source.useForRandom,
        enableCaching: source.enableCaching,
        embeddingModel: source.embeddingModel,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(newConnId);
    },

    /** Get all connections marked for the random pool (with decrypted keys). */
    async listRandomPool() {
      const rows = await db.select().from(apiConnections).where(eq(apiConnections.useForRandom, "true"));
      return rows.map((r: any) => ({ ...r, apiKey: decryptApiKey(r.apiKeyEncrypted) }));
    },

    async remove(id: string) {
      await db.delete(apiConnections).where(eq(apiConnections.id, id));
    },
  };
}
