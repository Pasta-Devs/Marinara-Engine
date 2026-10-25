// ──────────────────────────────────────────────
// Routes: Lorebook Markdown / CSV import and export
// Registered inside lorebooksRoutes, so paths sit under /api/lorebooks.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createLorebookSchema,
  LOREBOOK_TEXT_MAX_CHARS,
  exportLorebookText,
  type Lorebook,
  type LorebookEntry,
  type LorebookFolder,
} from "@marinara-engine/shared";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { syncCharacterBookFromLorebook } from "../services/lorebook/character-book-sync.js";
import {
  importLorebookText,
  LorebookTextImportError,
  readLorebookTextImportRequest,
} from "../services/lorebook/text-import.js";

export async function lorebookTextRoutes(app: FastifyInstance) {
  const storage = createLorebooksStorage(app.db);
  // JSON escaping can expand control characters up to six bytes each.
  const importBodyLimit = LOREBOOK_TEXT_MAX_CHARS * 6 + 4096;

  /** Import entries into an existing lorebook. Body: { format, text, duplicateMode }. */
  app.post<{ Params: { id: string } }>("/:id/import-text", { bodyLimit: importBodyLimit }, async (req, reply) => {
    const lorebook = await storage.getById(req.params.id);
    if (!lorebook) return reply.status(404).send({ error: "Lorebook not found" });
    try {
      const request = readLorebookTextImportRequest(req.body);
      return await app.db.transaction(async (tx) => {
        const result = await importLorebookText(createLorebooksStorage(tx), req.params.id, request);
        await syncCharacterBookFromLorebook(tx, req.params.id, { throwOnError: true });
        return result;
      });
    } catch (err) {
      if (err instanceof LorebookTextImportError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  /** Import entries into a new lorebook. Body: { name, format, text, duplicateMode }. */
  app.post("/import-text", { bodyLimit: importBodyLimit }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let request;
    try {
      request = readLorebookTextImportRequest(body);
    } catch (err) {
      if (err instanceof LorebookTextImportError) return reply.status(400).send({ error: err.message });
      throw err;
    }
    const name =
      typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 200) : "Imported lorebook";
    try {
      return await app.db.transaction(async (tx) => {
        const importStorage = createLorebooksStorage(tx);
        const created = (await importStorage.create(createLorebookSchema.parse({ name }))) as { id: string } | null;
        if (!created) throw new Error("Failed to create lorebook");
        return importLorebookText(importStorage, created.id, request);
      });
    } catch (err) {
      if (err instanceof LorebookTextImportError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  app.get<{ Params: { id: string }; Querystring: { format?: string } }>("/:id/export-text", async (req, reply) => {
    const lb = (await storage.getById(req.params.id)) as Lorebook | null;
    if (!lb) return reply.status(404).send({ error: "Lorebook not found" });
    const format = req.query.format === "csv" ? "csv" : "markdown";
    const entries = (await storage.listEntries(req.params.id)) as LorebookEntry[];
    const folders = (await storage.listFolders(req.params.id)) as LorebookFolder[];
    const text = exportLorebookText(format, { name: String(lb.name ?? ""), entries, folders });
    const filename = `${String(lb.name || "lorebook")}.${format === "csv" ? "csv" : "md"}`;
    const fallbackFilename = filename.replace(/[^\x20-\x7E]|["\\/:*?<>|]/g, "_");
    const encodedFilename = encodeURIComponent(filename).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return (
      reply
        .header("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        )
        // The BOM lets spreadsheet apps read non-English text in the CSV as UTF-8.
        .send(format === "csv" ? `﻿${text}` : text)
    );
  });
}
