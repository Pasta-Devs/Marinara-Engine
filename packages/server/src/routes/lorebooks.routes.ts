// ──────────────────────────────────────────────
// Routes: Lorebooks
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createLorebookSchema,
  updateLorebookSchema,
  createLorebookEntrySchema,
  updateLorebookEntrySchema,
} from "@marinara-engine/shared";
import type { ExportEnvelope } from "@marinara-engine/shared";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { processLorebooks } from "../services/lorebook/index.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import type { APIProvider } from "@marinara-engine/shared";

export async function lorebooksRoutes(app: FastifyInstance) {
  const storage = createLorebooksStorage(app.db);

  // ── Lorebooks CRUD ──

  app.get("/", async (req) => {
    const query = req.query as Record<string, string>;
    if (query.category) return storage.listByCategory(query.category);
    if (query.characterId) return storage.listByCharacter(query.characterId);
    if (query.chatId) return storage.listByChat(query.chatId);
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const lb = await storage.getById(req.params.id);
    if (!lb) return reply.status(404).send({ error: "Lorebook not found" });
    return lb;
  });

  app.post("/", async (req) => {
    const input = createLorebookSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const input = updateLorebookSchema.parse(req.body);
    const updated = await storage.update(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Lorebook not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const lb = (await storage.getById(req.params.id)) as Record<string, unknown> | null;
    if (!lb) return reply.status(404).send({ error: "Lorebook not found" });
    const entries = await storage.listEntries(req.params.id);
    const envelope: ExportEnvelope = {
      type: "marinara_lorebook",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { lorebook: lb, entries },
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(String(lb.name || "lorebook"))}.marinara.json"`,
      )
      .send(envelope);
  });

  // ── Entries CRUD ──

  app.get<{ Params: { id: string } }>("/:id/entries", async (req) => {
    return storage.listEntries(req.params.id);
  });

  app.get<{ Params: { id: string; entryId: string } }>("/:id/entries/:entryId", async (req, reply) => {
    const entry = await storage.getEntry(req.params.entryId);
    if (!entry) return reply.status(404).send({ error: "Entry not found" });
    return entry;
  });

  app.post<{ Params: { id: string } }>("/:id/entries", async (req) => {
    const input = createLorebookEntrySchema.parse({
      ...(req.body as Record<string, unknown>),
      lorebookId: req.params.id,
    });
    return storage.createEntry(input);
  });

  app.patch<{ Params: { id: string; entryId: string } }>("/:id/entries/:entryId", async (req, reply) => {
    const input = updateLorebookEntrySchema.parse(req.body);
    const updated = await storage.updateEntry(req.params.entryId, input);
    if (!updated) return reply.status(404).send({ error: "Entry not found" });
    return updated;
  });

  app.delete<{ Params: { lorebookId: string; entryId: string } }>(
    "/:lorebookId/entries/:entryId",
    async (req, reply) => {
      await storage.removeEntry(req.params.entryId);
      return reply.status(204).send();
    },
  );

  // ── Bulk operations ──

  app.post<{ Params: { id: string } }>("/:id/entries/bulk", async (req) => {
    const body = req.body as { entries: unknown[] };
    const entries = (body.entries ?? []).map((e: unknown) => {
      const { lorebookId, ...rest } = createLorebookEntrySchema.parse({
        ...(e as Record<string, unknown>),
        lorebookId: req.params.id,
      });
      return rest;
    });
    return storage.bulkCreateEntries(req.params.id, entries);
  });

  // ── Search ──

  app.get("/search/entries", async (req) => {
    const query = (req.query as Record<string, string>).q ?? "";
    if (!query) return [];
    return storage.searchEntries(query);
  });

  // ── Active entries (for prompt injection) ──

  app.get("/active/entries", async () => {
    return storage.listActiveEntries();
  });

  // ── Scan chat for activated entries ──

  app.get<{ Params: { chatId: string } }>("/scan/:chatId", async (req, reply) => {
    const { chatId } = req.params;
    const chatsStorage = createChatsStorage(app.db);
    const chatMessages = await chatsStorage.listMessages(chatId);
    if (!chatMessages.length) return reply.send({ entries: [], totalTokens: 0, totalEntries: 0 });

    // Load chat to get characterIds and activeLorebookIds from metadata
    const chat = await chatsStorage.getById(chatId);
    let characterIds: string[] = [];
    let activeLorebookIds: string[] = [];
    if (chat) {
      try {
        characterIds =
          typeof chat.characterIds === "string"
            ? JSON.parse(chat.characterIds)
            : ((chat.characterIds as string[]) ?? []);
      } catch {
        /* ignore */
      }
      try {
        const meta =
          typeof chat.metadata === "string"
            ? JSON.parse(chat.metadata)
            : ((chat.metadata as Record<string, unknown>) ?? {});
        activeLorebookIds = Array.isArray(meta.activeLorebookIds) ? meta.activeLorebookIds : [];
      } catch {
        /* ignore */
      }
    }

    const scanMessages = chatMessages.map((m) => ({
      role: (m.role === "narrator" ? "system" : m.role) as string,
      content: typeof m.content === "string" ? m.content : "",
    }));

    const result = await processLorebooks(app.db, scanMessages, null, {
      chatId,
      characterIds,
      activeLorebookIds,
    });

    // Fetch full entry data for the activated IDs
    const activeEntries =
      result.activatedEntryIds.length > 0
        ? await Promise.all(result.activatedEntryIds.map((id) => storage.getEntry(id))).then((entries) =>
            entries.filter(Boolean),
          )
        : [];

    return {
      entries: activeEntries.map((e) => ({
        id: (e as Record<string, unknown>).id,
        name: (e as Record<string, unknown>).name,
        content: (e as Record<string, unknown>).content,
        keys: (e as Record<string, unknown>).keys,
        lorebookId: (e as Record<string, unknown>).lorebookId,
        order: (e as Record<string, unknown>).order,
        constant: (e as Record<string, unknown>).constant,
      })),
      totalTokens: result.totalTokensEstimate,
      totalEntries: result.totalEntries,
    };
  });

  // ── Vectorize: generate embeddings for all entries in a lorebook ──

  app.post<{ Params: { id: string } }>("/:id/vectorize", async (req, reply) => {
    const body = req.body as { connectionId: string; model: string };
    if (!body.connectionId || !body.model) {
      return reply.status(400).send({ error: "connectionId and model are required" });
    }

    const connStorage = createConnectionsStorage(app.db);
    const conn = await connStorage.getWithKey(body.connectionId);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    const entries = await storage.listEntries(req.params.id);
    if (!entries.length) return { vectorized: 0 };

    const provider = createLLMProvider(conn.provider as string, conn.baseUrl as string, conn.apiKey as string);

    // Build text for each entry: combine name, keys, and content
    const texts = (entries as Array<Record<string, unknown>>).map((e) => {
      const keys = Array.isArray(e.keys) ? (e.keys as string[]).join(", ") : "";
      return `${e.name ?? ""}${keys ? ` [${keys}]` : ""}\n${e.content ?? ""}`.trim();
    });

    // Batch embed (most APIs support multiple texts per call)
    const BATCH_SIZE = 50;
    let vectorized = 0;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batchTexts = texts.slice(i, i + BATCH_SIZE);
      const batchEntries = entries.slice(i, i + BATCH_SIZE);
      const embeddings = await provider.embed(batchTexts, body.model);
      for (let j = 0; j < batchEntries.length; j++) {
        const entry = batchEntries[j] as Record<string, unknown>;
        if (embeddings[j]) {
          await storage.updateEntryEmbedding(entry.id as string, embeddings[j]!);
          vectorized++;
        }
      }
    }

    return { vectorized, total: entries.length };
  });
}
