// ──────────────────────────────────────────────
// Routes: Story Bundles
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  createStoryBundleSchema,
  storyBundleIdParamsSchema,
  updateStoryBundleSchema,
  BUILT_IN_AGENT_MANIFESTS,
} from "@marinara-engine/shared";
import type { ExportEnvelope, StoryBundle, StoryBundleIntro } from "@marinara-engine/shared";
import { createStoryBundlesStorage } from "../services/storage/story-bundles.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { logger } from "../lib/logger.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../utils/security.js";
import {
  readAvatarDataUrl,
  readGalleryForCharacter,
  readImageAsDataUrl,
  readSpritesForId,
} from "../services/export/export-image-helpers.js";

const STORY_BUNDLE_IMAGES_DIR = join(DATA_DIR, "story-bundles", "images");

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

function getSafeStoryBundleImagePath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  try {
    return assertInsideDir(STORY_BUNDLE_IMAGES_DIR, join(STORY_BUNDLE_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

/** Parse a JSON text column into a string array. */
function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** Parse a JSON text column into a typed intro array. */
function parseIntroArray(value: unknown): StoryBundleIntro[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is StoryBundleIntro =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.id === "string" &&
            typeof entry.name === "string" &&
            typeof entry.text === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Parse a JSON text column into an object or null. */
function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Parse the JSON columns into typed arrays for the API response. */
function serializeBundle(row: Record<string, unknown>): StoryBundle {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    imagePath: (row.imagePath as string) ?? null,
    avatarCrop: parseJsonObject(row.avatarCrop) as StoryBundle["avatarCrop"],
    comment: (row.comment as string) ?? "",
    creator: (row.creator as string) ?? "",
    version: (row.version as string) ?? "",
    tags: parseJsonArray(row.tags),
    characterIds: parseJsonArray(row.characterIds),
    personaIds: parseJsonArray(row.personaIds),
    lorebookIds: parseJsonArray(row.lorebookIds),
    presetIds: parseJsonArray(row.presetIds),
    agentIds: parseJsonArray(row.agentIds),
    intros: parseIntroArray(row.intros),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export async function storyBundlesRoutes(app: FastifyInstance) {
  const storage = createStoryBundlesStorage(app.db);
  const charactersStorage = createCharactersStorage(app.db);
  const characterGalleryStorage = createCharacterGalleryStorage(app.db);
  const lorebooksStorage = createLorebooksStorage(app.db);
  const promptsStorage = createPromptsStorage(app.db);
  const agentsStorage = createAgentsStorage(app.db);

  // ── List all story bundles ──
  app.get("/", async (_req, reply) => {
    const bundles = await storage.list();
    return reply.send(bundles.map(serializeBundle));
  });

  // ── Get a single story bundle ──
  app.get("/:id", async (req, reply) => {
    const { id } = storyBundleIdParamsSchema.parse(req.params);
    const bundle = await storage.getById(id);
    if (!bundle) return reply.status(404).send({ error: "Story bundle not found" });
    return reply.send(serializeBundle(bundle));
  });

  // ── Create a story bundle ──
  app.post("/", async (req, reply) => {
    const input = createStoryBundleSchema.parse(req.body);
    const bundle = await storage.create(input);
    if (!bundle) {
      logger.error("Story bundle storage.create returned no bundle");
      return reply.status(500).send({ error: "Failed to create story bundle" });
    }
    return reply.status(201).send(serializeBundle(bundle));
  });

  // ── Update a story bundle ──
  app.patch("/:id", async (req, reply) => {
    const { id } = storyBundleIdParamsSchema.parse(req.params);
    const existing = await storage.getById(id);
    if (!existing) return reply.status(404).send({ error: "Story bundle not found" });
    const input = updateStoryBundleSchema.parse(req.body);
    const bundle = await storage.update(id, input);
    if (!bundle) {
      logger.error("Story bundle storage.update returned no bundle for %s", id);
      return reply.status(500).send({ error: "Failed to update story bundle" });
    }
    return reply.send(serializeBundle(bundle));
  });

  // ── Delete a story bundle ──
  app.delete("/:id", async (req, reply) => {
    const { id } = storyBundleIdParamsSchema.parse(req.params);
    const existing = await storage.getById(id);
    if (!existing) return reply.status(404).send({ error: "Story bundle not found" });
    await storage.remove(id);
    return reply.send({ ok: true });
  });

  // ── Upload a story bundle image ──
  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const bundle = await storage.getById(req.params.id);
    if (!bundle) return reply.status(404).send({ error: "Story bundle not found" });

    const body = req.body as { image?: string };
    if (!body.image) return reply.status(400).send({ error: "No image data provided" });

    const { buffer, hintedExt } = parseImageUpload(body.image);
    const imageInfo = isAllowedImageBuffer(buffer, `.${hintedExt}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid story bundle image" });

    const ext = extensionFromImageMime(imageInfo.mimeType);
    await mkdir(STORY_BUNDLE_IMAGES_DIR, { recursive: true });
    const filename = `story-bundle-${req.params.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(STORY_BUNDLE_IMAGES_DIR, join(STORY_BUNDLE_IMAGES_DIR, filename));
    await writeFile(filepath, buffer);

    const updated = await storage.update(req.params.id, { imagePath: `/api/story-bundles/images/file/${filename}` });
    if (!updated) return reply.status(404).send({ error: "Story bundle not found" });
    return reply.send(serializeBundle(updated));
  });

  // ── Remove a story bundle image ──
  app.delete<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const bundle = await storage.getById(req.params.id);
    if (!bundle) return reply.status(404).send({ error: "Story bundle not found" });

    const existingPath = (bundle.imagePath as string) ?? null;
    if (existingPath) {
      const filename = existingPath.split("?")[0]!.split("/").pop() ?? "";
      const filepath = getSafeStoryBundleImagePath(filename);
      if (filepath && existsSync(filepath)) {
        try {
          await unlink(filepath);
        } catch (error) {
          logger.warn("Failed to delete story bundle image file %s: %s", filepath, error);
        }
      }
    }

    const updated = await storage.update(req.params.id, { imagePath: null, avatarCrop: null });
    if (!updated) return reply.status(404).send({ error: "Story bundle not found" });
    return reply.send(serializeBundle(updated));
  });

  // ── Serve a story bundle image file ──
  app.get<{ Params: { filename: string } }>("/images/file/:filename", async (req, reply) => {
    const filepath = getSafeStoryBundleImagePath(req.params.filename);
    if (!filepath || !existsSync(filepath)) return reply.status(404).send({ error: "Image not found" });

    const buffer = await readFile(filepath);
    const imageInfo = isAllowedImageBuffer(buffer, extname(req.params.filename));
    if (!imageInfo) return reply.status(404).send({ error: "Image not found" });

    return reply
      .header("Content-Type", imageInfo.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(buffer);
  });

  // ── Export a story bundle as .marinara.json ──
  // Embeds full character, persona, and lorebook data so the exported JSON is
  // self-contained. On import, missing entities are detected and offered for
  // creation — same pattern as character → embedded lorebook.
  app.get("/:id/export", async (req, reply) => {
    const { id } = storyBundleIdParamsSchema.parse(req.params);
    const bundle = await storage.getById(id);
    if (!bundle) return reply.status(404).send({ error: "Story bundle not found" });
    const serialized = serializeBundle(bundle);

    // Fetch full data for all referenced entities, including binary assets
    // (avatars, sprites, gallery) as base64 so the export is truly
    // self-contained for PC-to-PC transfer.
    const embeddedCharacters: Record<string, unknown>[] = [];
    for (const charId of serialized.characterIds) {
      const char = await charactersStorage.getById(charId);
      if (char) {
        const charRow = char as Record<string, unknown>;
        const charData = JSON.parse(charRow.data as string);
        const [avatar, sprites, gallery] = await Promise.all([
          readAvatarDataUrl(charRow.avatarPath as string | null | undefined),
          readSpritesForId(charId),
          readGalleryForCharacter(charId, characterGalleryStorage),
        ]);
        embeddedCharacters.push({
          id: charId,
          name: charRow.name,
          data: charData,
          ...(avatar ? { avatar } : {}),
          ...(sprites.length > 0 ? { sprites } : {}),
          ...(gallery.length > 0 ? { gallery } : {}),
        });
      }
    }

    const embeddedPersonas: Record<string, unknown>[] = [];
    for (const personaId of serialized.personaIds) {
      const persona = await charactersStorage.getPersona(personaId);
      if (persona) {
        const personaRow = persona as Record<string, unknown>;
        const [avatar, sprites] = await Promise.all([
          readAvatarDataUrl(personaRow.avatarPath as string | null | undefined),
          readSpritesForId(personaId),
        ]);
        embeddedPersonas.push({
          ...personaRow,
          ...(avatar ? { avatar } : {}),
          ...(sprites.length > 0 ? { sprites } : {}),
        });
      }
    }

    const embeddedLorebooks: Record<string, unknown>[] = [];
    for (const lorebookId of serialized.lorebookIds) {
      const lb = await lorebooksStorage.getById(lorebookId);
      if (lb) {
        const entries = await lorebooksStorage.listEntries(lorebookId);
        const folders = await lorebooksStorage.listFolders(lorebookId);
        embeddedLorebooks.push({
          id: lorebookId,
          lorebook: lb,
          entries,
          folders,
        });
      }
    }

    const embeddedPresets: Record<string, unknown>[] = [];
    for (const presetId of serialized.presetIds) {
      const preset = await promptsStorage.getById(presetId);
      if (preset) {
        const sections = await promptsStorage.listSections(presetId);
        const groups = await promptsStorage.listGroups(presetId);
        const choiceBlocks = await promptsStorage.listChoiceBlocksForPreset(presetId);
        embeddedPresets.push({
          id: presetId,
          preset,
          sections,
          groups,
          choiceBlocks,
        });
      }
    }

    // Read the bundle image as a base64 data URL for self-contained export.
    let bundleImage: string | null = null;
    if (serialized.imagePath) {
      const imageFilename = serialized.imagePath.split("?")[0]!.split("/").pop();
      if (imageFilename) {
        bundleImage = await readImageAsDataUrl(STORY_BUNDLE_IMAGES_DIR, imageFilename);
      }
    }

    // Carry lightweight agent metadata (id → display name) so an importing
    // machine can label missing agents in the install prompt. Agents are
    // provided by capability packages, so they are referenced by id rather
    // than embedded.
    const embeddedAgents: Array<{ id: string; name: string }> = [];
    if (serialized.agentIds.length > 0) {
      const agentConfigs = await agentsStorage.list();
      const configNameByType = new Map<string, string>();
      for (const config of agentConfigs) {
        const row = config as Record<string, unknown>;
        if (typeof row.type === "string" && typeof row.name === "string" && row.name.trim()) {
          configNameByType.set(row.type, row.name.trim());
        }
      }
      for (const agentId of serialized.agentIds) {
        const manifest = BUILT_IN_AGENT_MANIFESTS.find((candidate) => candidate.id === agentId);
        const displayName = manifest?.name ?? configNameByType.get(agentId) ?? agentId;
        embeddedAgents.push({ id: agentId, name: displayName });
      }
    }

    const envelope: ExportEnvelope = {
      type: "marinara_story_bundle",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        name: serialized.name,
        description: serialized.description,
        imagePath: serialized.imagePath,
        avatarCrop: serialized.avatarCrop,
        comment: serialized.comment,
        creator: serialized.creator,
        version: serialized.version,
        tags: serialized.tags,
        characterIds: serialized.characterIds,
        personaIds: serialized.personaIds,
        lorebookIds: serialized.lorebookIds,
        presetIds: serialized.presetIds,
        agentIds: serialized.agentIds,
        intros: serialized.intros,
        embeddedCharacters,
        embeddedPersonas,
        embeddedLorebooks,
        embeddedPresets,
        ...(embeddedAgents.length > 0 ? { embeddedAgents } : {}),
        ...(bundleImage ? { bundleImage } : {}),
      },
    };
    return reply
      .header("Content-Type", "application/json")
      .header(
        "Content-Disposition",
        `attachment; filename="${serialized.name.replace(/[^a-zA-Z0-9_\- ]/g, "_")}.marinara.json"`,
      )
      .send(envelope);
  });
}
