// ──────────────────────────────────────────────
// Routes: Prompts (Presets, Groups, Sections, Choices)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  createPromptPresetSchema,
  updatePromptPresetSchema,
  createPromptSectionSchema,
  updatePromptSectionSchema,
  createPromptGroupSchema,
  updatePromptGroupSchema,
  createChoiceBlockSchema,
  updateChoiceBlockSchema,
  createFolderEntry,
  isStockMarinaraUniversalPreset,
  type LorebookEntryTimingState,
} from "@marinara-engine/shared";
import type { ExportEnvelope } from "@marinara-engine/shared";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { assemblePrompt, type AssemblerInput } from "../services/prompt/index.js";
import { cardPromptText } from "../services/prompt/card-text.js";
import { resolveLorebookScopeExclusions } from "../services/lorebook/game-lorebook-scope.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { resolveChatUserIdentity } from "../services/chat-user-identity.js";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import AdmZip from "adm-zip";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../utils/security.js";
import { logger } from "../lib/logger.js";

const PROMPT_IMAGES_DIR = join(DATA_DIR, "prompts", "images");
const PROMPT_IMAGE_URL_PREFIX = "/api/prompts/images/file/";
const STOCK_PRESET_READ_ONLY_ERROR =
  "The stock Marinara Universal preset is read-only. Open it to create an editable copy.";

async function rejectStockPresetMutation(
  storage: ReturnType<typeof createPromptsStorage>,
  presetId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const preset = await storage.getById(presetId);
  if (!preset || !isStockMarinaraUniversalPreset(preset)) return false;
  reply.status(409).send({ error: STOCK_PRESET_READ_ONLY_ERROR });
  return true;
}

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

function getSafePromptImagePath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  try {
    return assertInsideDir(PROMPT_IMAGES_DIR, join(PROMPT_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

function getLocalPromptImagePath(imagePath: string | null): string | null {
  if (!imagePath?.startsWith(PROMPT_IMAGE_URL_PREFIX)) return null;
  return getSafePromptImagePath(imagePath.slice(PROMPT_IMAGE_URL_PREFIX.length));
}

async function removePromptImageIfUnreferenced(
  storage: ReturnType<typeof createPromptsStorage>,
  imagePath: string | null,
): Promise<void> {
  const filepath = getLocalPromptImagePath(imagePath);
  if (!filepath) return;

  const presets = await storage.list();
  if (presets.some((preset) => preset.imagePath === imagePath)) return;

  try {
    await unlink(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn(error, "Could not remove unreferenced preset image %s", filepath);
    }
  }
}

function safeAsciiDownloadName(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/:*?<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "preset";
}

async function buildPresetExportEnvelope(storage: ReturnType<typeof createPromptsStorage>, id: string) {
  const preset = await storage.getById(id);
  if (!preset) return null;
  const exportedPreset = { ...preset } as Record<string, unknown>;
  delete exportedPreset.parameters;
  delete exportedPreset.systemKey;
  const [sections, groups, choiceBlocks] = await Promise.all([
    storage.listSections(id),
    storage.listGroups(id),
    storage.listChoiceBlocksForPreset(id),
  ]);
  const envelope: ExportEnvelope = {
    type: "marinara_preset",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { preset: exportedPreset, sections, groups, choiceBlocks },
  };
  return { preset, envelope };
}

export async function promptsRoutes(app: FastifyInstance) {
  const storage = createPromptsStorage(app.db);

  // ═══════════════════════════════════════════
  //  Presets
  // ═══════════════════════════════════════════

  app.get("/", async () => {
    return storage.list();
  });

  app.get("/default", async () => {
    return storage.getDefault();
  });

  app.get<{ Params: { filename: string } }>("/images/file/:filename", async (req, reply) => {
    const filepath = getSafePromptImagePath(req.params.filename);
    if (!filepath) return reply.status(404).send({ error: "Image not found" });

    let buffer: Buffer;
    try {
      buffer = await readFile(filepath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return reply.status(404).send({ error: "Image not found" });
      }
      throw error;
    }
    const imageInfo = isAllowedImageBuffer(buffer, extname(req.params.filename));
    if (!imageInfo) return reply.status(404).send({ error: "Image not found" });

    return reply
      .header("Content-Type", imageInfo.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(buffer);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Preset not found" });
    return preset;
  });

  /** Get a full preset with all its sections, groups, and choice blocks. */
  app.get<{ Params: { id: string } }>("/:id/full", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Preset not found" });
    const [sections, groups, choiceBlocks] = await Promise.all([
      storage.listSections(req.params.id),
      storage.listGroups(req.params.id),
      storage.listChoiceBlocksForPreset(req.params.id),
    ]);
    return { preset, sections, groups, choiceBlocks };
  });

  app.post("/", async (req) => {
    const input = createPromptPresetSchema.parse(req.body);
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
    if (await rejectStockPresetMutation(storage, req.params.id, reply)) return;
    const input = updatePromptPresetSchema.parse(req.body);
    return storage.update(req.params.id, input);
  });

  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Preset not found" });
    if (isStockMarinaraUniversalPreset(preset)) {
      return reply.status(409).send({ error: STOCK_PRESET_READ_ONLY_ERROR });
    }

    const body = req.body as { image?: string };
    if (!body.image) return reply.status(400).send({ error: "No image data provided" });

    const { buffer, hintedExt } = parseImageUpload(body.image);
    const imageInfo = isAllowedImageBuffer(buffer, `.${hintedExt}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid preset image" });

    const ext = extensionFromImageMime(imageInfo.mimeType);
    await mkdir(PROMPT_IMAGES_DIR, { recursive: true });
    const safeId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "-");
    const filename = `preset-${safeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(PROMPT_IMAGES_DIR, join(PROMPT_IMAGES_DIR, filename));
    await writeFile(filepath, buffer);

    const nextImagePath = `${PROMPT_IMAGE_URL_PREFIX}${filename}`;
    const updated = await storage.update(req.params.id, { imagePath: nextImagePath });
    if (!updated) {
      await removePromptImageIfUnreferenced(storage, nextImagePath);
      return reply.status(404).send({ error: "Preset not found" });
    }
    await removePromptImageIfUnreferenced(storage, preset.imagePath);
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (preset && isStockMarinaraUniversalPreset(preset)) {
      return reply.status(409).send({ error: STOCK_PRESET_READ_ONLY_ERROR });
    }
    await storage.remove(req.params.id);
    await removePromptImageIfUnreferenced(storage, preset?.imagePath ?? null);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const result = await storage.duplicate(req.params.id);
    if (!result) return reply.status(404).send({ error: "Preset not found" });
    return result;
  });

  app.post<{ Params: { id: string } }>("/:id/set-default", async (req, reply) => {
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Preset not found" });
    const updated = await storage.setDefault(req.params.id);
    return updated;
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const result = await buildPresetExportEnvelope(storage, req.params.id);
    if (!result) return reply.status(404).send({ error: "Preset not found" });
    const originalFilename = `${result.preset.name || "preset"}.marinara.json`;
    const fallbackFilename = `${safeAsciiDownloadName(result.preset.name || "preset")}.marinara.json`;
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
      )
      .send(result.envelope);
  });

  app.post("/export-bulk", async (req, reply) => {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: "ids array is required" });
    }

    const zip = new AdmZip();
    let exportedCount = 0;
    for (const id of ids) {
      const result = await buildPresetExportEnvelope(storage, id);
      if (!result) continue;
      const entry = createFolderEntry({
        folderName: "Presets",
        itemName: result.preset.name || `preset-${exportedCount + 1}`,
        itemKind: "marinara.preset",
        config: result.envelope,
        fallbackName: `preset-${exportedCount + 1}`,
      });
      zip.addFile(entry.path, Buffer.from(JSON.stringify(entry.manifest, null, 2), "utf-8"));
      exportedCount++;
    }

    if (exportedCount === 0) {
      return reply.status(404).send({ error: "No presets found for the provided ids" });
    }

    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", 'attachment; filename="marinara-presets.zip"')
      .send(zip.toBuffer());
  });

  // ═══════════════════════════════════════════
  //  Groups
  // ═══════════════════════════════════════════

  app.get<{ Params: { id: string } }>("/:id/groups", async (req) => {
    return storage.listGroups(req.params.id);
  });

  app.post<{ Params: { id: string } }>("/:id/groups", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.id, reply)) return;
    const input = createPromptGroupSchema.parse({
      ...(req.body as Record<string, unknown>),
      presetId: req.params.id,
    });
    return storage.createGroup(input);
  });

  app.patch<{ Params: { presetId: string; groupId: string } }>("/:presetId/groups/:groupId", async (req, reply) => {
    const group = await storage.getGroup(req.params.groupId);
    if (!group || group.presetId !== req.params.presetId) {
      return reply.status(404).send({ error: "Prompt group not found" });
    }
    if (await rejectStockPresetMutation(storage, group.presetId, reply)) return;
    const input = updatePromptGroupSchema.parse(req.body);
    return storage.updateGroup(group.id, input);
  });

  app.delete<{ Params: { presetId: string; groupId: string } }>("/:presetId/groups/:groupId", async (req, reply) => {
    const group = await storage.getGroup(req.params.groupId);
    if (!group || group.presetId !== req.params.presetId) {
      return reply.status(404).send({ error: "Prompt group not found" });
    }
    if (await rejectStockPresetMutation(storage, group.presetId, reply)) return;
    await storage.removeGroup(group.id);
    return reply.status(204).send();
  });

  app.put<{ Params: { id: string } }>("/:id/groups/reorder", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.id, reply)) return;
    const { groupIds } = req.body as { groupIds: string[] };
    const ownedGroupIds = new Set((await storage.listGroups(req.params.id)).map((group) => group.id));
    if (groupIds.some((groupId) => !ownedGroupIds.has(groupId))) {
      return reply.status(400).send({ error: "Prompt group does not belong to this preset" });
    }
    await storage.reorderGroups(req.params.id, groupIds);
    return { success: true };
  });

  // ═══════════════════════════════════════════
  //  Sections
  // ═══════════════════════════════════════════

  app.get<{ Params: { id: string } }>("/:id/sections", async (req) => {
    return storage.listSections(req.params.id);
  });

  app.post<{ Params: { id: string } }>("/:id/sections", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.id, reply)) return;
    const input = createPromptSectionSchema.parse({
      ...(req.body as Record<string, unknown>),
      presetId: req.params.id,
    });
    return storage.createSection(input);
  });

  app.patch<{ Params: { presetId: string; sectionId: string } }>(
    "/:presetId/sections/:sectionId",
    async (req, reply) => {
      const section = await storage.getSection(req.params.sectionId);
      if (!section || section.presetId !== req.params.presetId) {
        return reply.status(404).send({ error: "Prompt section not found" });
      }
      if (await rejectStockPresetMutation(storage, section.presetId, reply)) return;
      const input = updatePromptSectionSchema.parse(req.body);
      return storage.updateSection(section.id, input);
    },
  );

  app.delete<{ Params: { presetId: string; sectionId: string } }>(
    "/:presetId/sections/:sectionId",
    async (req, reply) => {
      const section = await storage.getSection(req.params.sectionId);
      if (!section || section.presetId !== req.params.presetId) {
        return reply.status(404).send({ error: "Prompt section not found" });
      }
      if (await rejectStockPresetMutation(storage, section.presetId, reply)) return;
      await storage.removeSection(section.id);
      return reply.status(204).send();
    },
  );

  app.put<{ Params: { id: string } }>("/:id/sections/reorder", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.id, reply)) return;
    const { sectionIds } = req.body as { sectionIds: string[] };
    const ownedSectionIds = new Set((await storage.listSections(req.params.id)).map((section) => section.id));
    if (sectionIds.some((sectionId) => !ownedSectionIds.has(sectionId))) {
      return reply.status(400).send({ error: "Prompt section does not belong to this preset" });
    }
    await storage.reorderSections(req.params.id, sectionIds);
    return { success: true };
  });

  // ═══════════════════════════════════════════
  //  Preset Variables (Choice Blocks)
  // ═══════════════════════════════════════════

  app.get<{ Params: { presetId: string } }>("/:presetId/variables", async (req) => {
    return storage.listChoiceBlocksForPreset(req.params.presetId);
  });

  app.post<{ Params: { presetId: string } }>("/:presetId/variables", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.presetId, reply)) return;
    const input = createChoiceBlockSchema.parse({
      ...(req.body as Record<string, unknown>),
      presetId: req.params.presetId,
    });
    return storage.createChoiceBlock(input);
  });

  app.patch<{ Params: { presetId: string; variableId: string } }>(
    "/:presetId/variables/:variableId",
    async (req, reply) => {
      const variable = await storage.getChoiceBlock(req.params.variableId);
      if (!variable || variable.presetId !== req.params.presetId) {
        return reply.status(404).send({ error: "Preset variable not found" });
      }
      if (await rejectStockPresetMutation(storage, variable.presetId, reply)) return;
      const input = updateChoiceBlockSchema.parse(req.body);
      return storage.updateChoiceBlock(variable.id, input);
    },
  );

  app.delete<{ Params: { presetId: string; variableId: string } }>(
    "/:presetId/variables/:variableId",
    async (req, reply) => {
      const variable = await storage.getChoiceBlock(req.params.variableId);
      if (!variable || variable.presetId !== req.params.presetId) {
        return reply.status(404).send({ error: "Preset variable not found" });
      }
      if (await rejectStockPresetMutation(storage, variable.presetId, reply)) return;
      await storage.removeChoiceBlock(variable.id);
      return reply.status(204).send();
    },
  );

  app.put<{ Params: { presetId: string } }>("/:presetId/variables/reorder", async (req, reply) => {
    if (await rejectStockPresetMutation(storage, req.params.presetId, reply)) return;
    const { variableIds } = req.body as { variableIds: string[] };
    await storage.reorderVariables(req.params.presetId, variableIds);
    return { success: true };
  });

  // ═══════════════════════════════════════════
  //  Prompt Preview (Assembled)
  // ═══════════════════════════════════════════

  /**
   * POST /:id/preview — Preview the assembled prompt for a given chat.
   * Body: { chatId: string, choices?: Record<string, string> }
   */
  app.post<{ Params: { id: string } }>("/:id/preview", async (req, reply) => {
    const { chatId, choices } = req.body as { chatId: string; choices?: Record<string, string> };
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Preset not found" });

    const chats = createChatsStorage(app.db);
    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const characterIds: string[] = JSON.parse(chat.characterIds as string);
    let lorebookCharacterIds = characterIds;
    const chatMessages = await chats.listMessages(chatId);
    let chatMeta: Record<string, unknown> = {};
    try {
      chatMeta =
        typeof chat.metadata === "string"
          ? JSON.parse(chat.metadata)
          : ((chat.metadata as Record<string, unknown>) ?? {});
    } catch {
      chatMeta = {};
    }
    const lorebookScopeExclusions = resolveLorebookScopeExclusions(chat.mode, chatMeta);
    const mappedMessages = chatMessages.map((m: any) => ({
      role: m.role === "narrator" ? ("system" as const) : (m.role as "user" | "assistant" | "system"),
      content: m.content as string,
    }));

    // Resolve persona
    const charStorage = createCharactersStorage(app.db);
    let personaId: string | null = null;
    let personaName = "User";
    let personaDescription = "";
    let personaFields: { personality?: string; scenario?: string; backstory?: string; appearance?: string } = {};
    // Get active persona
    const activePersona = await resolveChatUserIdentity(charStorage, chat);
    if (activePersona) {
      // A character-backed identity must stay in character scope so lorebook
      // and macro processing does not treat it as a persona record. [PR #5583]
      if (activePersona.source === "character") {
        if (!lorebookCharacterIds.includes(activePersona.id)) {
          lorebookCharacterIds = [...lorebookCharacterIds, activePersona.id];
        }
      } else {
        personaId = activePersona.id;
      }
      personaName = activePersona.name;
      personaDescription = cardPromptText(activePersona.description);
      personaFields = {
        personality: cardPromptText(activePersona.personality),
        scenario: cardPromptText(activePersona.scenario),
        backstory: cardPromptText(activePersona.backstory),
        appearance: cardPromptText(activePersona.appearance),
      };
    }

    const [sections, groups, choiceBlocks] = await Promise.all([
      storage.listSections(req.params.id),
      storage.listGroups(req.params.id),
      storage.listChoiceBlocksForPreset(req.params.id),
    ]);

    const assemblerInput: AssemblerInput = {
      db: app.db,
      preset: preset as any,
      sections: sections as any,
      groups: groups as any,
      choiceBlocks: choiceBlocks as any,
      chatChoices: choices ?? {},
      chatId,
      characterIds,
      lorebookCharacterIds,
      personaId,
      personaName,
      personaDescription,
      personaFields,
      chatMessages: mappedMessages,
      activeLorebookIds: Array.isArray(chatMeta.activeLorebookIds) ? (chatMeta.activeLorebookIds as string[]) : [],
      excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
      excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
      chatEmbedding: null,
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
      lorebookTokenBudget: typeof chatMeta.lorebookTokenBudget === "number" ? chatMeta.lorebookTokenBudget : undefined,
      generationTriggers: Array.isArray(chatMeta.generationTriggers)
        ? (chatMeta.generationTriggers as string[])
        : undefined,
      previewOnly: true,
    };

    const result = await assemblePrompt(assemblerInput);
    return {
      messages: result.messages,
      parameters: result.parameters,
      messageCount: result.messages.length,
    };
  });
}
