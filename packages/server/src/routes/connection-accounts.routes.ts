// ──────────────────────────────────────────────
// Routes: Connection accounts (shared credentials for several Models)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  connectionModelIdSchema,
  createConnectionAccountSchema,
  createConnectionSchema,
  parsePinnedModels,
  rankModelMatch,
  updateConnectionAccountSchema,
  type CreateConnectionAccountInput,
  connectionBalanceSource,
  withKeyTail,
} from "@marinara-engine/shared";
import {
  accountBlocksRows,
  accountLabel,
  accountSiblingKey,
  createConnectionAccountsStorage,
  pickLimits,
  toAccountListItem,
  type ConnectionAccountRow,
} from "../services/storage/connection-accounts.storage.js";
import { catalogOf, createConnectionsStorage } from "../services/storage/connections.storage.js";
import { saveConnectionImage } from "./connections.routes.js";
import { resetMemoryRecallVectorizerCache } from "../services/memory-recall-embedding.js";
import { decryptApiKey } from "../utils/crypto.js";
import { modelKeepReason } from "../services/connections/model-stars.js";
import { apiConnections, connectionAccounts } from "../db/schema/index.js";
import { eq } from "../db/file-query.js";
import { logger } from "../lib/logger.js";
import { BalanceError, forgetConnectionBalance, readConnectionBalance } from "../services/connections/balance.js";

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

const splitBodySchema = z.object({
  connectionId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
});

const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ponytail: an in-process queue per key; one server process owns the store. A shared lock if that ever changes.
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
  queues.set(key, next);
  void next
    .catch(() => undefined)
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    });
  return next;
}

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
    // Ranked before the cut (decision 27): starred, saved, then prefix matches, then the rest.
    const ranked: Array<{ rank: number; hit: { accountId: string; provider: string; model: string; name: string } }> =
      [];
    const rows = await app.db.select().from(apiConnections);
    for (const account of (await accounts.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (accountBlocksRows(account)) continue;
      const linked = rows.filter((row) => row.accountId === account.id);
      const source = [...linked]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .find((row) => catalogOf(row, account));
      const catalog = source ? catalogOf(source, account) : null;
      const starred = new Set(linked.flatMap((row) => parsePinnedModels(row.pinnedModels)));
      const saved = new Set(linked.map((row) => row.model));
      for (const model of catalog?.models ?? []) {
        const rank = rankModelMatch(q, model, { starred: starred.has(model.id), saved: saved.has(model.id) });
        if (rank >= 0)
          ranked.push({
            rank,
            hit: { accountId: account.id, provider: source!.provider, model: model.id, name: model.name },
          });
      }
    }
    // Array sort is stable: within a rank, accounts keep their age order and models their catalog order.
    return ranked
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(({ hit }) => hit);
  });

  // Create the account and its first Model together (the add flow).
  app.post("/", async (req, reply) => {
    const { model, maxContext, ...input } = createAccountBodySchema.parse(req.body);
    // An automatic name is told apart from another Connection of the same service by the key's end (decision 28).
    const keyless = !input.apiKey?.trim();
    const label = accountLabel(input, keyless);
    const sibling =
      !input.name &&
      (await accounts.list()).some(
        (account) =>
          accountSiblingKey(account, !decryptApiKey(account.apiKeyEncrypted)) === accountSiblingKey(input, keyless),
      );
    const name = input.name ?? (sibling ? withKeyTail(label, input.apiKey) : label);
    const created = await app.db.transaction(async () => {
      const account = await accounts.create({ ...input, name });
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
    const before = input.apiKey ? await accounts.getById(req.params.id) : null;
    const oldKey = before ? decryptApiKey(before.apiKeyEncrypted) : "";
    const updated = await accounts.update(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Connection not found" });
    forgetConnectionBalance(updated.id);
    if (input.apiKey !== undefined || input.baseUrl !== undefined) resetMemoryRecallVectorizerCache();
    // A new key: name the other Connections that still hold the old one, so the client can offer to update them.
    const sameKey =
      oldKey && oldKey !== input.apiKey
        ? (await accounts.list())
            .filter((other) => other.id !== updated.id && decryptApiKey(other.apiKeyEncrypted) === oldKey)
            .map((other) => ({ id: other.id, name: other.name }))
        : [];
    return { ...(await listItem(updated)), ...(sameKey.length ? { sameKeyAccounts: sameKey } : {}) };
  });

  // What is left on the account, for services with a balance endpoint; `{ balance: null }` for the rest.
  app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>("/:id/balance", async (req, reply) => {
    const account = await accounts.getById(req.params.id);
    if (!account) return reply.status(404).send({ error: "Connection not found" });
    if (accountBlocksRows(account) || !connectionBalanceSource(account)) return { balance: null };
    try {
      return await readConnectionBalance(
        account.id,
        {
          provider: account.provider,
          baseUrl: account.baseUrl,
          apiKey: decryptApiKey(account.apiKeyEncrypted),
          balanceToken: decryptApiKey(account.managementTokenEncrypted),
          balanceUserId: account.balanceUserId,
        },
        req.query.refresh === "true",
      );
    } catch (err) {
      logger.warn("[connections] Balance check failed for %s: %s", account.id, err instanceof Error ? err.message : err);
      return reply.status(502).send({ error: err instanceof BalanceError ? err.message : "The balance check failed" });
    }
  });

  // Upload the Connection's picture (same checks and folder as a Model's). PATCH `icon` changes or resets it.
  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    if (!(await accounts.getById(req.params.id))) return reply.status(404).send({ error: "Connection not found" });
    const saved = await saveConnectionImage(req.params.id, req.body);
    if ("error" in saved) return reply.status(400).send(saved);
    const updated = await accounts.setImage(req.params.id, saved.imagePath);
    if (!updated) return reply.status(404).send({ error: "Connection not found" });
    return listItem(updated);
  });

  /** A new Connection with the same service, address, key, limits and saved model lists; no Models. */
  async function copyAccount(source: ConnectionAccountRow, name: string) {
    const copy = await accounts.create({
      name,
      provider: source.provider as CreateConnectionAccountInput["provider"],
      baseUrl: source.baseUrl,
      apiKey: decryptApiKey(source.apiKeyEncrypted),
      managementToken: decryptApiKey(source.managementTokenEncrypted),
      balanceUserId: source.balanceUserId ?? "",
      showUsageWidget: source.showUsageWidget === "true",
      showUsageFiveHour: source.showUsageFiveHour === "true",
      showUsageWeekly: source.showUsageWeekly === "true",
      treatAsLocalEndpoint: source.treatAsLocalEndpoint === "true",
      enabled: source.enabled === "true",
      maxRequestsPerMinute: source.maxRequestsPerMinute,
      maxParallelJobs: source.maxParallelJobs,
      icon: null,
    });
    // The copy serves the same model list, so the saved catalogs come along.
    await app.db
      .update(connectionAccounts)
      .set({ modelCatalogs: source.modelCatalogs })
      .where(eq(connectionAccounts.id, copy.id));
    return copy;
  }

  // "Move to a new connection": a copy of this Connection (same service, address, key and limits) takes one Model.
  // It splits what the upgrade grouped; the copy keeps its own models from then on.
  app.post<{ Params: { id: string } }>("/:id/split", async (req, reply) => {
    const body = splitBodySchema.parse(req.body);
    const source = await accounts.getById(req.params.id);
    if (!source || !(await linkedModel(source.id, body.connectionId))) {
      return reply.status(404).send({ error: "Model not found in this Connection" });
    }
    const copy = await copyAccount(source, body.name);
    const moved = await connections.moveToAccount(body.connectionId, copy.id);
    if (typeof moved === "string") {
      await accounts.remove(copy.id);
      logger.warn("Split of model %s from connection %s failed: %s", body.connectionId, source.id, moved);
      return reply.status(409).send({ error: "This model cannot move to a new connection.", reason: moved });
    }
    reply.status(201);
    return { account: await listItem(copy) };
  });

  // "Duplicate": a copy of the Connection with a copy of each of its Models. The Model copies keep their names and
  // settings but take no default roles.
  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const source = await accounts.getById(req.params.id);
    if (!source) return reply.status(404).send({ error: "Connection not found" });
    const copy = await app.db.transaction(async () => {
      const created = await copyAccount(source, `${source.name} (Copy)`);
      for (const row of await accounts.linkedRows(source.id)) {
        const duplicate = await connections.duplicate(row.id);
        if (!duplicate) continue;
        await app.db
          .update(apiConnections)
          .set({ accountId: created.id, name: row.name })
          .where(eq(apiConnections.id, duplicate.id));
      }
      return created;
    });
    reply.status(201);
    return { account: await listItem(copy) };
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

  // Save a model (the star, panel Add model, "Make it my Main model"): the account's saved Model for the id, or a new
  // one. A new Model takes the catalog limits and neutral tuning, never a sibling's (decision 25). Saves of one
  // Connection run one at a time, so a double click finds the Model the first click created.
  app.post<{ Params: { id: string } }>("/:id/for-model", async (req, reply) => {
    const body = forModelBodySchema.parse(req.body);
    const result = await oneAtATime(req.params.id, async () => {
      const found = await accounts.findChatModel(req.params.id, body.model);
      if (typeof found !== "object") return found;
      if (found.existing) return { connectionId: found.existing.id, created: false };
      // A saved Model takes its name and limits from the catalog, never from a sibling Model.
      const row = await connections.create(
        createConnectionSchema.parse({
          name: body.name ?? found.catalog.name ?? body.model,
          provider: found.provider,
          baseUrl: found.provider === found.account.provider ? found.account.baseUrl : "",
          model: body.model,
          accountId: found.account.id,
          ...pickLimits(body, found.catalog),
        }),
      );
      return row ? { connectionId: row.id, created: true } : "failed";
    });
    if (result === "not_found") return reply.status(404).send({ error: "Connection not found" });
    if (result === "not_chat") return reply.status(400).send({ error: "This Connection cannot hold chat Models." });
    if (result === "failed") return reply.status(500).send({ error: "Could not save the model" });
    if (result.created) reply.status(201);
    return { connectionId: result.connectionId };
  });

  /** The account's saved Model with this id, or null. */
  async function linkedModel(accountId: string, connectionId: string) {
    return (await accounts.linkedRows(accountId)).find((row) => row.id === connectionId) ?? null;
  }

  // Remove a saved Model's star (decision 30). `removable` tells the client the Model may go: it then hides it,
  // offers Undo, and asks for the removal below when the Undo is gone.
  app.post<{ Params: { id: string; connectionId: string } }>("/:id/models/:connectionId/unstar", async (req, reply) => {
    const result = await oneAtATime(req.params.id, async () => {
      const row = await linkedModel(req.params.id, req.params.connectionId);
      if (!row) return null;
      await connections.setModelPinned(row.id, row.model, false);
      const updated = await linkedModel(req.params.id, row.id);
      const reason = updated ? await modelKeepReason(app.db, updated) : null;
      return { removable: !!updated && reason === null, reason };
    });
    if (!result) return reply.status(404).send({ error: "Model not found" });
    return result;
  });

  // Remove an unstarred saved Model, only when nothing keeps it any more. Chats that used it keep it as their pick.
  app.delete<{ Params: { id: string; connectionId: string } }>("/:id/models/:connectionId", async (req, reply) => {
    const result = await oneAtATime(req.params.id, async () => {
      const row = await linkedModel(req.params.id, req.params.connectionId);
      if (!row) return "not_found" as const;
      const reason = await modelKeepReason(app.db, row);
      if (reason) return reason;
      await connections.remove(row.id, true);
      resetMemoryRecallVectorizerCache();
      return "removed" as const;
    });
    if (result === "not_found") return reply.status(404).send({ error: "Model not found" });
    if (result !== "removed") return reply.status(409).send({ error: "This model is still in use.", reason: result });
    return reply.status(204).send();
  });
}
