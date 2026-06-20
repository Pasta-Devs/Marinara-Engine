// ──────────────────────────────────────────────
// Routes: Lorebooks
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  createLorebookSchema,
  updateLorebookSchema,
  createLorebookEntrySchema,
  updateLorebookEntrySchema,
  createLorebookFolderSchema,
  updateLorebookFolderSchema,
  LOCAL_SIDECAR_CONNECTION_ID,
  stripMacroComments,
  canReparentFolder,
  type CreateLorebookEntryInput,
  type LorebookEntryTimingState,
  type LorebookEntry,
  type LorebookFolder,
} from "@marinara-engine/shared";
import type { ExportEnvelope } from "@marinara-engine/shared";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createGameStateStorage } from "../services/storage/game-state.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { processLorebooks } from "../services/lorebook/index.js";
import { resolveGameLorebookScopeExclusions } from "../services/lorebook/game-lorebook-scope.js";
import { buildPromptMacroContext, resolveMacrosWithVariableSnapshot } from "../services/prompt/index.js";
import { parseGameStateRow, resolveVisibleGameStateAnchor } from "./generate/generate-route-utils.js";
import {
  syncCharacterBookFromLorebook,
  clearCharacterEmbeddedLorebook,
} from "../services/lorebook/character-book-sync.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../services/llm/local-sidecar.js";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../utils/security.js";
import AdmZip from "adm-zip";

const LOREBOOK_IMAGES_DIR = join(DATA_DIR, "lorebooks", "images");

function toSafeExportName(name: string, fallback: string) {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

type ExportFormat = "native" | "compatible";
type EntryTransferOperation = "copy" | "move";

function parseImageUpload(image: string): { buffer: Buffer; hintedExt: string } {
  let base64 = image;
  let hintedExt = "png";
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:image\/([\w.+-]+);base64,/i);
    if (match?.[1]) {
      hintedExt = match[1].replace("+xml", "");
      base64 = base64.slice(base64.indexOf(",") + 1);
    }
  }
  return { buffer: Buffer.from(base64, "base64"), hintedExt };
}

function getSafeLorebookImagePath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  try {
    return assertInsideDir(LOREBOOK_IMAGES_DIR, join(LOREBOOK_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

function resolveExportFormat(query: unknown, fallback: ExportFormat = "native"): ExportFormat {
  const raw = query && typeof query === "object" ? (query as Record<string, unknown>).format : undefined;
  return raw === "compatible" ? "compatible" : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function stSelectiveLogic(value: unknown): number {
  return value === "or" ? 1 : value === "not" ? 2 : 0;
}

function stRole(value: unknown): number {
  return value === "user" ? 1 : value === "assistant" ? 2 : 0;
}

function resolveScanGenerationTriggers(mode: unknown): string[] {
  const modeTrigger = mode === "game" ? "game" : typeof mode === "string" && mode.trim() ? mode.trim() : "roleplay";
  return Array.from(new Set(["test_scan", modeTrigger, "chat"]));
}

function selectMessagesForLastGenerationScan<T extends { role: string }>(messages: T[]): T[] {
  let lastGeneratedIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role === "assistant" || message.role === "narrator") {
      lastGeneratedIndex = index;
      break;
    }
  }
  if (lastGeneratedIndex < 0) return messages;
  return messages.slice(0, lastGeneratedIndex);
}

function buildCompatibleLorebookExport(lb: Record<string, unknown>, entries: Array<Record<string, unknown>>) {
  const exportedEntries: Record<string, Record<string, unknown>> = {};
  entries.forEach((entry, index) => {
    exportedEntries[String(index)] = {
      uid: index,
      key: asStringArray(entry.keys),
      keysecondary: asStringArray(entry.secondaryKeys),
      comment: String(entry.name ?? `Entry ${index + 1}`),
      content: String(entry.content ?? ""),
      disable: entry.enabled === false,
      constant: entry.constant === true,
      selective: entry.selective === true,
      selectiveLogic: stSelectiveLogic(entry.selectiveLogic),
      order: Number(entry.order ?? 100),
      position: Number(entry.position ?? 0),
      depth: Number(entry.depth ?? 4),
      probability: entry.probability ?? null,
      scanDepth: entry.scanDepth ?? null,
      matchWholeWords: entry.matchWholeWords === true,
      caseSensitive: entry.caseSensitive === true,
      role: stRole(entry.role),
      group: String(entry.group ?? ""),
      groupWeight: entry.groupWeight ?? null,
      sticky: entry.sticky ?? null,
      cooldown: entry.cooldown ?? null,
      delay: entry.delay ?? null,
    };
  });

  return {
    name: String(lb.name ?? "Lorebook"),
    extensions: {
      marinara: {
        exportedAt: new Date().toISOString(),
        source: "Marinara Engine compatibility export",
      },
    },
    entries: exportedEntries,
  };
}

function buildTransferredEntryInput(
  entry: LorebookEntry,
  targetLorebookId: string,
  order: number,
): CreateLorebookEntryInput {
  return {
    lorebookId: targetLorebookId,
    name: entry.name,
    content: entry.content,
    description: entry.description,
    keys: entry.keys,
    secondaryKeys: entry.secondaryKeys,
    enabled: entry.enabled,
    constant: entry.constant,
    selective: entry.selective,
    selectiveLogic: entry.selectiveLogic,
    probability: entry.probability,
    scanDepth: entry.scanDepth,
    matchWholeWords: entry.matchWholeWords,
    caseSensitive: entry.caseSensitive,
    useRegex: entry.useRegex,
    characterFilterMode: entry.characterFilterMode,
    characterFilterIds: entry.characterFilterIds,
    characterTagFilterMode: entry.characterTagFilterMode,
    characterTagFilters: entry.characterTagFilters,
    generationTriggerFilterMode: entry.generationTriggerFilterMode,
    generationTriggerFilters: entry.generationTriggerFilters,
    additionalMatchingSources: entry.additionalMatchingSources,
    position: entry.position,
    depth: entry.depth,
    order,
    role: entry.role,
    sticky: entry.sticky,
    cooldown: entry.cooldown,
    delay: entry.delay,
    ephemeral: entry.ephemeral,
    group: entry.group,
    groupWeight: entry.groupWeight,
    folderId: null,
    preventRecursion: entry.preventRecursion,
    excludeFromVectorization: entry.excludeFromVectorization,
    locked: entry.locked,
    tag: entry.tag,
    relationships: entry.relationships,
    dynamicState: entry.dynamicState,
    activationConditions: entry.activationConditions,
    schedule: entry.schedule,
  };
}

export async function lorebooksRoutes(app: FastifyInstance) {
  const storage = createLorebooksStorage(app.db);

  // ── Lorebooks CRUD ──

  app.get("/", async (req) => {
    const query = req.query as Record<string, string>;
    if (query.category) return storage.listByCategory(query.category);
    if (query.characterId) return storage.listByCharacter(query.characterId);
    if (query.personaId) return storage.listByPersona(query.personaId);
    if (query.chatId) return storage.listByChat(query.chatId);
    return storage.list();
  });

  app.get<{ Params: { filename: string } }>("/images/file/:filename", async (req, reply) => {
    const filepath = getSafeLorebookImagePath(req.params.filename);
    if (!filepath || !existsSync(filepath)) return reply.status(404).send({ error: "Image not found" });

    const buffer = await readFile(filepath);
    const imageInfo = isAllowedImageBuffer(buffer, extname(req.params.filename));
    if (!imageInfo) return reply.status(404).send({ error: "Image not found" });

    return reply
      .header("Content-Type", imageInfo.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(buffer);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const lb = await storage.getById(req.params.id);
    if (!lb) return reply.status(404).send({ error: "Lorebook not found" });
    return lb;
  });

  app.post("/", async (req) => {
    const input = createLorebookSchema.parse(req.body);
    const body = req.body as Record<string, unknown>;
    return storage.create(
      input,
      normalizeTimestampOverrides({
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      }),
    );
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const input = updateLorebookSchema.parse(req.body);
    const updated = await storage.update(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Lorebook not found" });
    await syncCharacterBookFromLorebook(app.db, req.params.id);
    return updated;
  });

  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const lorebook = await storage.getById(req.params.id);
    if (!lorebook) return reply.status(404).send({ error: "Lorebook not found" });

    const body = req.body as { image?: string };
    if (!body.image) return reply.status(400).send({ error: "No image data provided" });

    const { buffer, hintedExt } = parseImageUpload(body.image);
    const imageInfo = isAllowedImageBuffer(buffer, `.${hintedExt}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid lorebook image" });

    const ext = extensionFromImageMime(imageInfo.mimeType);
    await mkdir(LOREBOOK_IMAGES_DIR, { recursive: true });
    const filename = `lorebook-${req.params.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(LOREBOOK_IMAGES_DIR, join(LOREBOOK_IMAGES_DIR, filename));
    await writeFile(filepath, buffer);

    const updated = await storage.update(req.params.id, { imagePath: `/api/lorebooks/images/file/${filename}` });
    if (!updated) return reply.status(404).send({ error: "Lorebook not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    // Capture the linked characterId BEFORE removal — once the row is gone
    // we can no longer recover it, and the character still holds a stale
    // pointer at extensions.importMetadata.embeddedLorebook that needs
    // clearing alongside the V2 character_book mirror.
    const lorebook = (await storage.getById(req.params.id)) as Record<string, unknown> | null;
    const linkedCharacterId = lorebook && typeof lorebook.characterId === "string" ? lorebook.characterId : null;

    const chatsStorage = createChatsStorage(app.db);
    await chatsStorage.removeLorebookFromChatMetadata(req.params.id);
    await storage.remove(req.params.id);

    if (linkedCharacterId) {
      await clearCharacterEmbeddedLorebook(app.db, linkedCharacterId, req.params.id);
    }
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string }; Querystring: { format?: ExportFormat } }>("/:id/export", async (req, reply) => {
    const lb = (await storage.getById(req.params.id)) as Record<string, unknown> | null;
    if (!lb) return reply.status(404).send({ error: "Lorebook not found" });
    const entries = (await storage.listEntries(req.params.id)) as Array<Record<string, unknown>>;
    const folders = await storage.listFolders(req.params.id);
    const format = resolveExportFormat(req.query);
    if (format === "compatible") {
      return reply
        .header(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(String(lb.name || "lorebook"))}.json"`,
        )
        .send(buildCompatibleLorebookExport(lb, entries));
    }
    const envelope: ExportEnvelope = {
      type: "marinara_lorebook",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { lorebook: lb, entries, folders },
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(String(lb.name || "lorebook"))}.marinara.json"`,
      )
      .send(envelope);
  });

  app.post("/export-bulk", async (req, reply) => {
    const { ids, format = "native" } = req.body as { ids?: string[]; format?: ExportFormat };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: "ids array is required" });
    }

    const zip = new AdmZip();
    let exportedCount = 0;
    for (const id of ids) {
      const lb = (await storage.getById(id)) as Record<string, unknown> | null;
      if (!lb) continue;
      const entries = (await storage.listEntries(id)) as Array<Record<string, unknown>>;
      const folders = await storage.listFolders(id);
      if (format === "compatible") {
        zip.addFile(
          `${toSafeExportName(String(lb.name || "lorebook"), `lorebook-${exportedCount + 1}`)}.json`,
          Buffer.from(JSON.stringify(buildCompatibleLorebookExport(lb, entries), null, 2), "utf-8"),
        );
        exportedCount++;
        continue;
      }
      const envelope: ExportEnvelope = {
        type: "marinara_lorebook",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: { lorebook: lb, entries, folders },
      };
      zip.addFile(
        `${toSafeExportName(String(lb.name || "lorebook"), `lorebook-${exportedCount + 1}`)}.marinara.json`,
        Buffer.from(JSON.stringify(envelope, null, 2), "utf-8"),
      );
      exportedCount++;
    }

    if (exportedCount === 0) {
      return reply.status(404).send({ error: "No lorebooks found for the provided ids" });
    }

    return reply
      .header("Content-Type", "application/zip")
      .header(
        "Content-Disposition",
        `attachment; filename="${format === "compatible" ? "compatible-lorebooks.zip" : "marinara-lorebooks.zip"}"`,
      )
      .send(zip.toBuffer());
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

  app.post<{ Params: { id: string } }>("/:id/entries", async (req, reply) => {
    const input = createLorebookEntrySchema.parse({
      ...(req.body as Record<string, unknown>),
      lorebookId: req.params.id,
    });
    try {
      const created = await storage.createEntry(input);
      await syncCharacterBookFromLorebook(app.db, req.params.id);
      return created;
    } catch (err) {
      if (err instanceof Error && err.message === "folderId does not belong to this lorebook") {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string; entryId: string } }>("/:id/entries/:entryId", async (req, reply) => {
    const input = updateLorebookEntrySchema.parse(req.body);
    try {
      const updated = await storage.updateEntry(req.params.entryId, input);
      if (!updated) return reply.status(404).send({ error: "Entry not found" });
      await syncCharacterBookFromLorebook(app.db, req.params.id);
      return updated;
    } catch (err) {
      if (err instanceof Error && err.message === "folderId does not belong to this lorebook") {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete<{ Params: { lorebookId: string; entryId: string } }>(
    "/:lorebookId/entries/:entryId",
    async (req, reply) => {
      await storage.removeEntry(req.params.entryId);
      await syncCharacterBookFromLorebook(app.db, req.params.lorebookId);
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
    const result = await storage.bulkCreateEntries(req.params.id, entries);
    await syncCharacterBookFromLorebook(app.db, req.params.id);
    return result;
  });

  app.post<{ Params: { id: string } }>("/:id/entries/transfer", async (req, reply) => {
    const body = req.body as {
      entryIds?: unknown;
      targetLorebookId?: unknown;
      operation?: unknown;
    };
    const entryIds = Array.isArray(body.entryIds)
      ? Array.from(new Set(body.entryIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
      : [];
    const targetLorebookId = typeof body.targetLorebookId === "string" ? body.targetLorebookId.trim() : "";
    const operation: EntryTransferOperation = body.operation === "move" ? "move" : "copy";

    if (entryIds.length === 0) {
      return reply.status(400).send({ error: "entryIds array is required" });
    }
    if (!targetLorebookId) {
      return reply.status(400).send({ error: "targetLorebookId is required" });
    }
    if (operation === "move" && targetLorebookId === req.params.id) {
      return reply.status(400).send({ error: "Choose a different lorebook to move entries" });
    }

    const sourceLorebook = await storage.getById(req.params.id);
    if (!sourceLorebook) return reply.status(404).send({ error: "Source lorebook not found" });
    const targetLorebook = await storage.getById(targetLorebookId);
    if (!targetLorebook) return reply.status(404).send({ error: "Target lorebook not found" });

    const sourceEntries: LorebookEntry[] = [];
    for (const entryId of entryIds) {
      const entry = (await storage.getEntry(entryId)) as LorebookEntry | null;
      if (entry?.lorebookId === req.params.id) sourceEntries.push(entry);
    }
    if (sourceEntries.length === 0) {
      return reply.status(404).send({ error: "No matching entries found in the source lorebook" });
    }

    const targetEntries = (await storage.listEntries(targetLorebookId)) as LorebookEntry[];
    const maxTargetOrder = targetEntries.reduce((max, entry) => Math.max(max, entry.order ?? 0), 0);
    const created = [];
    for (const [index, entry] of sourceEntries.entries()) {
      created.push(
        await storage.createEntry(
          buildTransferredEntryInput(entry, targetLorebookId, maxTargetOrder + (index + 1) * 10),
        ),
      );
    }

    if (operation === "move") {
      for (const entry of sourceEntries) {
        await storage.removeEntry(entry.id);
      }
      await syncCharacterBookFromLorebook(app.db, req.params.id);
    }
    await syncCharacterBookFromLorebook(app.db, targetLorebookId);

    return {
      operation,
      sourceLorebookId: req.params.id,
      targetLorebookId,
      requested: entryIds.length,
      transferred: sourceEntries.length,
      created,
    };
  });

  app.put<{ Params: { id: string } }>("/:id/entries/reorder", async (req, reply) => {
    const body = req.body as { entryIds?: unknown; folderId?: unknown };
    const entryIds = Array.isArray(body.entryIds)
      ? body.entryIds.filter((id): id is string => typeof id === "string")
      : [];
    if (entryIds.length === 0) {
      return reply.status(400).send({ error: "entryIds array is required" });
    }
    // folderId scopes the reorder to a single container:
    //   undefined → legacy behaviour (renumber every entry in the lorebook)
    //   null      → root-level entries only
    //   string    → entries inside that folder only
    let folderId: string | null | undefined;
    if (body.folderId === null) folderId = null;
    else if (typeof body.folderId === "string") folderId = body.folderId;
    else folderId = undefined;
    return storage.reorderEntries(req.params.id, entryIds, folderId);
  });

  // ── Folders ──

  app.get<{ Params: { id: string } }>("/:id/folders", async (req) => {
    return storage.listFolders(req.params.id);
  });

  app.post<{ Params: { id: string } }>("/:id/folders", async (req, reply) => {
    const input = createLorebookFolderSchema.parse(req.body);
    if (input.parentFolderId !== null) {
      // Nesting under a parent: the parent must exist in this lorebook. A brand-new
      // folder has no descendants, so a missing/foreign parent is the only risk
      // here — the full descendant-cycle check runs on move (PATCH) below.
      const parent = await storage.getFolder(input.parentFolderId, req.params.id);
      if (!parent) {
        return reply.status(400).send({ error: "Parent folder not found in this lorebook" });
      }
    }
    return storage.createFolder(req.params.id, input);
  });

  app.patch<{ Params: { id: string; folderId: string } }>("/:id/folders/:folderId", async (req, reply) => {
    const input = updateLorebookFolderSchema.parse(req.body);
    // Re-parenting: validate against the lorebook's folder set (no self-parent,
    // same lorebook, no descendant cycle) before persisting.
    if (input.parentFolderId !== undefined) {
      const folders = (await storage.listFolders(req.params.id)) as LorebookFolder[];
      const check = canReparentFolder(folders, req.params.folderId, input.parentFolderId);
      if (!check.ok) {
        return reply.status(400).send({ error: check.reason });
      }
    }
    // Scope by lorebookId so /lorebooks/A/folders/B can't update folder B if
    // it actually belongs to lorebook X.
    const updated = await storage.updateFolder(req.params.folderId, input, req.params.id);
    if (!updated) return reply.status(404).send({ error: "Folder not found" });
    return updated;
  });

  app.delete<{ Params: { id: string; folderId: string }; Querystring: { cascade?: string } }>(
    "/:id/folders/:folderId",
    async (req, reply) => {
      // Scope by lorebookId so a request to /lorebooks/A/folders/B cannot
      // reach a folder belonging to lorebook X and reparent its entries.
      // `?cascade=true` deletes the folder's whole subtree instead of promoting it.
      const cascade = req.query.cascade === "true";
      await storage.removeFolder(req.params.folderId, req.params.id, cascade);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string; folderId: string } }>("/:id/folders/:folderId/clone", async (req, reply) => {
    // Deep-clone the folder, its entries, and its whole sub-folder subtree into
    // the same lorebook. Scoped by lorebookId so /lorebooks/A/folders/B can't
    // clone a folder that belongs to lorebook X.
    const existing = await storage.getFolder(req.params.folderId, req.params.id);
    if (!existing) return reply.status(404).send({ error: "Folder not found" });
    const created = await storage.cloneFolder(req.params.folderId, req.params.id);
    return reply.status(201).send(created);
  });

  app.put<{ Params: { id: string } }>("/:id/folders/reorder", async (req, reply) => {
    const body = req.body as { folderIds?: unknown };
    const folderIds = Array.isArray(body.folderIds)
      ? body.folderIds.filter((id): id is string => typeof id === "string")
      : [];
    if (folderIds.length === 0) {
      return reply.status(400).send({ error: "folderIds array is required" });
    }
    return storage.reorderFolders(req.params.id, folderIds);
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
    // CONST entries activate regardless of message content, so the scan
    // must run even when the chat has no messages.

    // Load chat to get characterIds and activeLorebookIds from metadata
    const chat = await chatsStorage.getById(chatId);
    let characterIds: string[] = [];
    let personaId: string | null = null;
    let activeLorebookIds: string[] = [];
    let chatMeta: Record<string, unknown> = {};
    if (chat) {
      personaId = typeof chat.personaId === "string" ? chat.personaId : null;
      if (!personaId && chat.mode !== "game") {
        try {
          const charactersStorage = createCharactersStorage(app.db);
          const activePersona = (await charactersStorage.listPersonas()).find((p: any) => p.isActive === "true");
          personaId = (activePersona?.id as string | undefined) ?? null;
        } catch {
          /* ignore */
        }
      }
      try {
        characterIds =
          typeof chat.characterIds === "string"
            ? JSON.parse(chat.characterIds)
            : ((chat.characterIds as string[]) ?? []);
      } catch {
        /* ignore */
      }
      try {
        chatMeta =
          typeof chat.metadata === "string"
            ? JSON.parse(chat.metadata)
            : ((chat.metadata as Record<string, unknown>) ?? {});
        activeLorebookIds = Array.isArray(chatMeta.activeLorebookIds) ? chatMeta.activeLorebookIds : [];
      } catch {
        /* ignore */
      }
    }

    const lorebookScopeExclusions = resolveGameLorebookScopeExclusions(chat?.mode, chatMeta);
    const scanSourceMessages = selectMessagesForLastGenerationScan(chatMessages);
    const scanMessages = scanSourceMessages.map((m) => ({
      role: (m.role === "narrator" ? "system" : m.role) as string,
      content: typeof m.content === "string" ? m.content : "",
    }));
    const lastInput = [...scanMessages].reverse().find((message) => message.role === "user")?.content;
    const gameStateForScan =
      chat?.mode === "game"
        ? await (async () => {
            try {
              const visibleAnchor = resolveVisibleGameStateAnchor(chatMessages);
              const row = await createGameStateStorage(app.db).getForGeneration(chatId, {
                preferLatestVisible: true,
                visibleAnchor,
              });
              return row
                ? (parseGameStateRow(row as Record<string, unknown>) as unknown as Record<string, unknown>)
                : null;
            } catch {
              return null;
            }
          })()
        : null;

    const lorebookMacroResolvers = await (async () => {
      try {
        const charactersStorage = createCharactersStorage(app.db);
        let personaName = "User";
        let personaDescription = "";
        let personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string } = {};
        if (personaId) {
          const persona = await charactersStorage.getPersona(personaId);
          if (persona) {
            personaName = persona.name || personaName;
            personaDescription = cardPromptText(persona.description);
            personaFields = {
              personality: cardPromptText(persona.personality),
              scenario: cardPromptText(persona.scenario),
              backstory: cardPromptText(persona.backstory),
              appearance: cardPromptText(persona.appearance),
            };
          }
        }
        const macroContext = await buildPromptMacroContext({
          db: app.db,
          characterIds,
          personaName,
          personaDescription,
          personaFields,
          variables: {},
          lastInput,
          chatId,
        });
        return {
          resolveContent: (value: string) => resolveMacrosWithVariableSnapshot(value, macroContext),
        };
      } catch {
        return undefined;
      }
    })();

    const result = await processLorebooks(app.db, scanMessages, gameStateForScan, {
      chatId,
      characterIds,
      personaId,
      activeLorebookIds,
      excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
      excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
      tokenBudget: typeof chatMeta.lorebookTokenBudget === "number" ? chatMeta.lorebookTokenBudget : undefined,
      entryStateOverrides:
        (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) &&
        typeof (chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) === "object"
          ? ((chatMeta.entryStateOverrides ?? chatMeta.lorebookEntryStateOverrides) as Record<
              string,
              { ephemeral?: number | null; enabled?: boolean }
            >)
          : undefined,
      entryTimingStates:
        (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) &&
        typeof (chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) === "object"
          ? ((chatMeta.entryTimingStates ?? chatMeta.lorebookEntryTimingStates) as Record<
              string,
              LorebookEntryTimingState
            >)
          : undefined,
      previewOnly: true,
      generationTriggers: resolveScanGenerationTriggers(chat?.mode),
      resolveContent: lorebookMacroResolvers?.resolveContent,
    });

    const resolvedContentById = new Map(result.activatedEntries.map((entry) => [entry.id, entry.content]));

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
        content:
          resolvedContentById.get(String((e as Record<string, unknown>).id)) ?? (e as Record<string, unknown>).content,
        keys: (e as Record<string, unknown>).keys,
        lorebookId: (e as Record<string, unknown>).lorebookId,
        order: (e as Record<string, unknown>).order,
        constant: (e as Record<string, unknown>).constant,
      })),
      totalTokens: result.totalTokensEstimate,
      totalEntries: result.totalEntries,
      budgetSkippedEntries: result.budgetSkippedEntries,
    };
  });

  // ── Vectorize: generate embeddings for all entries in a lorebook ──

  app.post<{ Params: { id: string } }>("/:id/vectorize", async (req, reply) => {
    const body = req.body as { connectionId: string; model: string; onlyMissing?: boolean };
    if (!body.connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    const useLocalSidecar = body.connectionId === LOCAL_SIDECAR_CONNECTION_ID;
    if (!useLocalSidecar && !body.model) {
      return reply.status(400).send({ error: "model is required" });
    }

    const connStorage = createConnectionsStorage(app.db);
    const conn = useLocalSidecar ? null : await connStorage.getWithKey(body.connectionId);
    if (!useLocalSidecar && !conn) return reply.status(404).send({ error: "Connection not found" });

    const allEntries = await storage.listEntries(req.params.id);
    if (!allEntries.length) return { vectorized: 0, total: 0, skipped: 0 };
    const lorebook = (await storage.getById(req.params.id)) as Record<string, unknown> | null;
    if (lorebook?.excludeFromVectorization === true) {
      return { vectorized: 0, total: allEntries.length, skipped: allEntries.length };
    }
    const vectorizableEntries = allEntries.filter(
      (entry) => !(entry as Record<string, unknown>).excludeFromVectorization,
    );
    const entries = body.onlyMissing
      ? vectorizableEntries.filter((entry) => {
          const embedding = (entry as Record<string, unknown>).embedding;
          return !Array.isArray(embedding) || embedding.length === 0;
        })
      : vectorizableEntries;
    if (!entries.length) return { vectorized: 0, total: allEntries.length, skipped: allEntries.length };

    const provider = useLocalSidecar
      ? getLocalSidecarProvider()
      : (() => {
          const resolvedConn = conn!;
          // Use dedicated embedding base URL if configured, otherwise the connection's base URL
          const embedBaseUrl = resolvedConn.embeddingBaseUrl
            ? (resolvedConn.embeddingBaseUrl as string).replace(/\/+$/, "")
            : (resolvedConn.baseUrl as string);
          return createLLMProvider(
            resolvedConn.provider as string,
            embedBaseUrl,
            resolvedConn.apiKey as string,
            resolvedConn.maxContext,
            resolvedConn.openrouterProvider,
            resolvedConn.maxTokensOverride,
          );
        })();
    const embeddingModel = useLocalSidecar ? LOCAL_SIDECAR_MODEL : body.model;

    // Build text for each entry: combine name, keys, and content
    const texts = (entries as Array<Record<string, unknown>>).map((e) => {
      const keys = [
        ...(Array.isArray(e.keys) ? (e.keys as string[]) : []),
        ...(Array.isArray(e.secondaryKeys) ? (e.secondaryKeys as string[]) : []),
      ].join(", ");
      return `${e.name ?? ""}${keys ? ` [${keys}]` : ""}\n${e.content ?? ""}`.trim();
    });

    // Batch embed (most APIs support multiple texts per call)
    const BATCH_SIZE = 50;
    let vectorized = 0;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batchTexts = texts.slice(i, i + BATCH_SIZE);
      const batchEntries = entries.slice(i, i + BATCH_SIZE);
      const embeddings = await provider.embed(batchTexts, embeddingModel);
      for (let j = 0; j < batchEntries.length; j++) {
        const entry = batchEntries[j] as Record<string, unknown>;
        if (embeddings[j]) {
          await storage.updateEntryEmbedding(entry.id as string, embeddings[j]!);
          vectorized++;
        }
      }
    }

    return { vectorized, total: allEntries.length, skipped: allEntries.length - entries.length };
  });
}
