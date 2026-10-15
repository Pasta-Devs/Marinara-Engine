// ──────────────────────────────────────────────
// Routes: Connection accounts (shared credentials for several Models)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PROVIDERS,
  connectionModelIdSchema,
  createConnectionAccountSchema,
  createConnectionSchema,
  isChatProvider,
  updateConnectionAccountSchema,
} from "@marinara-engine/shared";
import {
  accountBlocksRows,
  createConnectionAccountsStorage,
  toAccountListItem,
  type ConnectionAccountRow,
} from "../services/storage/connection-accounts.storage.js";
import { createConnectionsStorage, readSavedModelList } from "../services/storage/connections.storage.js";
import { resetMemoryRecallVectorizerCache } from "../services/memory-recall-embedding.js";
import { apiConnections } from "../db/schema/index.js";

const createAccountBodySchema = createConnectionAccountSchema.partial({ name: true }).extend({
  /** First Model under the new account. Empty keeps the picker open for the client. */
  model: z.string().trim().max(500).default(""),
  maxContext: z.number().int().min(1).optional(),
});

const forModelBodySchema = z.object({
  model: connectionModelIdSchema,
  name: z.string().trim().min(1).max(200).optional(),
  maxContext: z.number().int().min(1).optional(),
  maxTokensOverride: z.number().int().min(1).optional(),
});

const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function connectionAccountsRoutes(app: FastifyInstance) {
  const accounts = createConnectionAccountsStorage(app.db);
  const connections = createConnectionsStorage(app.db);

  async function modelCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const row of await app.db.select().from(apiConnections)) {
      if (row.accountId) counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
    }
    return counts;
  }

  async function listItem(account: ConnectionAccountRow) {
    return toAccountListItem(account, (await accounts.linkedRows(account.id)).length);
  }

  // Masked list: keys never leave the server.
  app.get("/", async () => {
    const [rows, counts] = await Promise.all([accounts.list(), modelCounts()]);
    return rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((account) => toAccountListItem(account, counts.get(account.id) ?? 0));
  });

  // Search the saved model lists of enabled accounts. Never calls a provider.
  app.get("/catalog-search", async (req) => {
    const { q, limit } = catalogQuerySchema.parse(req.query);
    const needle = q.toLowerCase();
    const hits: Array<{ accountId: string; model: string; name: string }> = [];
    const rows = await app.db.select().from(apiConnections);
    for (const account of (await accounts.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (accountBlocksRows(account)) continue;
      const source = rows
        .filter((row) => row.accountId === account.id && readSavedModelList(row))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      for (const model of readSavedModelList(source)?.models ?? []) {
        if (needle && !model.id.toLowerCase().includes(needle) && !model.name.toLowerCase().includes(needle)) continue;
        hits.push({ accountId: account.id, model: model.id, name: model.name });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  });

  // Create the account and its first Model together (the add flow).
  app.post("/", async (req, reply) => {
    const { model, maxContext, ...input } = createAccountBodySchema.parse(req.body);
    const providerName = PROVIDERS[input.provider]?.name ?? input.provider;
    const created = await app.db.transaction(async () => {
      const account = await accounts.create({ ...input, name: input.name ?? providerName });
      const row = await connections.create(
        createConnectionSchema.parse({
          name: model || account.name,
          provider: input.provider,
          baseUrl: account.baseUrl,
          model,
          accountId: account.id,
          ...(maxContext !== undefined ? { maxContext } : {}),
        }),
      );
      return { account, connectionId: row?.id ?? null };
    });
    reply.status(201);
    return { account: await listItem(created.account), connectionId: created.connectionId };
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const input = updateConnectionAccountSchema.parse(req.body);
    const updated = await accounts.update(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Connection not found" });
    if (input.apiKey !== undefined || input.baseUrl !== undefined) resetMemoryRecallVectorizerCache();
    return listItem(updated);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const result = await accounts.remove(req.params.id);
    if (result === "not_found") return reply.status(404).send({ error: "Connection not found" });
    if (result !== "deleted") {
      return reply.status(409).send({
        error: "This Connection still has Models. Remove them first.",
        models: result.map((row) => ({ id: row.id, name: row.name, model: row.model })),
      });
    }
    return reply.status(204).send();
  });

  // A quick-switch pick: find the Model for this model id, or create it named after the catalog entry.
  app.post<{ Params: { id: string } }>("/:id/for-model", async (req, reply) => {
    const body = forModelBodySchema.parse(req.body);
    const linked = (await accounts.linkedRows(req.params.id)).filter((row) => isChatProvider(row.provider));
    const catalogName = linked
      .map((row) => readSavedModelList(row)?.models.find((entry) => entry.id === body.model)?.name)
      .find(Boolean);
    const result = await accounts.findOrCreateModel(req.params.id, {
      ...body,
      name: body.name ?? catalogName ?? body.model,
    });
    if (result === "not_found") return reply.status(404).send({ error: "Connection not found" });
    if (result === "not_chat") return reply.status(400).send({ error: "This Connection cannot hold chat Models." });
    return { connectionId: result.connectionId };
  });
}
