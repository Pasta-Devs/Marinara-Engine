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
  providerIconSite,
  rankModelMatch,
  updateConnectionAccountSchema,
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
import { createConnectionsStorage, readSavedModelList } from "../services/storage/connections.storage.js";
import { resetMemoryRecallVectorizerCache } from "../services/memory-recall-embedding.js";
import { decryptApiKey } from "../utils/crypto.js";
import { modelKeepReason } from "../services/connections/model-stars.js";
import {
  PROVIDER_ICONS_ENABLED_SETTINGS_KEY,
  ensureProviderIcon,
  fetchIconForConnection,
  listProviderIcons,
  providerIconsEnabled,
  readProviderIcon,
} from "../services/connections/provider-icons.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
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
    const ranked: Array<{ rank: number; hit: { accountId: string; model: string; name: string } }> = [];
    const rows = await app.db.select().from(apiConnections);
    for (const account of (await accounts.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (accountBlocksRows(account)) continue;
      const linked = rows.filter((row) => row.accountId === account.id);
      const source = linked
        .filter((row) => readSavedModelList(row))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const starred = new Set(linked.flatMap((row) => parsePinnedModels(row.pinnedModels)));
      const saved = new Set(linked.map((row) => row.model));
      for (const model of readSavedModelList(source)?.models ?? []) {
        const rank = rankModelMatch(q, model, { starred: starred.has(model.id), saved: saved.has(model.id) });
        if (rank >= 0) ranked.push({ rank, hit: { accountId: account.id, model: model.id, name: model.name } });
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
    // The service's icon is fetched once, now (decision 34b); the tile shows initials until it is there.
    fetchIconForConnection(app.db, created.account.provider, created.account.baseUrl);
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

  // ── Provider icons (decision 34b): only cached icons are served; reading never fetches. ──
  const iconState = async () => ({
    enabled: await providerIconsEnabled(app.db),
    icons: await listProviderIcons(app.db),
  });

  app.get("/icons", iconState);

  app.put("/icons/settings", async (req) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    await createAppSettingsStorage(app.db).set(PROVIDER_ICONS_ENABLED_SETTINGS_KEY, String(enabled));
    return iconState();
  });

  app.get("/icons/image", async (req, reply) => {
    const { site } = z.object({ site: z.string().max(300) }).parse(req.query);
    const icon = (await providerIconsEnabled(app.db)) ? await readProviderIcon(site) : null;
    if (!icon) return reply.status(404).send({ error: "No icon" });
    return reply
      .header("Content-Type", icon.type)
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .send(icon.buffer);
  });

  // "Refresh icon": the only way to ask a site again after the first fetch, success or failure.
  app.post<{ Params: { id: string } }>("/:id/refresh-icon", async (req, reply) => {
    const account = await accounts.getById(req.params.id);
    if (!account) return reply.status(404).send({ error: "Connection not found" });
    const site = providerIconSite(account.provider, account.baseUrl);
    if (!site) return reply.status(400).send({ error: "This Connection has no site to take an icon from." });
    if (!(await providerIconsEnabled(app.db))) {
      return reply.status(409).send({ error: "Provider icons are turned off in the Connections settings." });
    }
    return { site, cached: await ensureProviderIcon(app.db, site, true) };
  });
}
