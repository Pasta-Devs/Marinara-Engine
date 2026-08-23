// ──────────────────────────────────────────────
// Import: Marinara Engine native format (.marinara.json)
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import {
  canReparentFolder,
  getFolderImportEntries,
  getFolderManifestConfig,
  isJsonRecord,
  characterDataSchema,
  canonicalizeLegacyPersonaInput,
  normalizeAvatarCrop,
  normalizeConvoBehavior,
  normalizePersonaStats,
  normalizePersonaStringArray,
  normalizeTrackerCardColorConfig,
  personaCreateInputSchema,
  lorebookFilterModeSchema,
  BUILT_IN_AGENT_MANIFESTS,
} from "@marinara-engine/shared";
import type {
  CharacterData,
  ExportEnvelope,
  ExportType,
  LorebookFilterMode,
  LorebookMatchingSource,
} from "@marinara-engine/shared";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../storage/persona-gallery.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { createPromptsStorage } from "../storage/prompts.storage.js";
import { createStoryBundlesStorage } from "../storage/story-bundles.storage.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { normalizeTimestampOverrides, type TimestampOverrides } from "./import-timestamps.js";
import { newId } from "../../utils/id-generator.js";
import { resolveLorebookEntryRole } from "./lorebook-role.js";
import { access, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
import { removeUnattachedAvatarFile } from "../image/avatar-file-lifecycle.js";
import { encodePersonaCreate } from "../personas/persona-projector.js";

function resolveNativeSelectiveLogic(value: unknown): "and" | "and_all" | "or" | "not" | "not_all" {
  return value === "and_all" || value === "or" || value === "not" || value === "not_all" ? value : "and";
}

function resolveNativePosition(value: unknown): number {
  if (typeof value === "string") {
    if (value === "after_char") return 1;
    if (value === "at_depth" || value === "depth") return 2;
    if (value === "outlet") return 7;
    return 0;
  }
  return typeof value === "number" && Number.isInteger(value) && [0, 1, 2, 7].includes(value) ? value : 0;
}

function normalizeDefaultChoices(value: unknown): Record<string, string | string[]> {
  if (!isJsonRecord(value)) return {};
  const normalized: Record<string, string | string[]> = {};
  for (const [key, choice] of Object.entries(value)) {
    if (typeof choice === "string") {
      normalized[key] = choice;
    } else if (Array.isArray(choice) && choice.every((item): item is string => typeof item === "string")) {
      normalized[key] = choice;
    }
  }
  return normalized;
}

// Decode a base64 data URL into validated image bytes. Returns null if the
// payload is missing, malformed, or not a recognized image type — so callers
// can treat optional images as "skip this one" rather than failing the whole
// import.
function decodeImageDataUrl(dataUrl: unknown): { buffer: Buffer; ext: string } | null {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) return null;
  let base64 = dataUrl;
  let hintedExt = ".png";
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:image\/([\w+]+);base64,/);
    if (match?.[1]) hintedExt = `.${match[1].replace("+xml", "")}`;
    const commaIdx = base64.indexOf(",");
    if (commaIdx >= 0) base64 = base64.slice(commaIdx + 1);
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0) return null;
  const info = isAllowedImageBuffer(buffer, hintedExt);
  if (!info) return null;
  return { buffer, ext: extensionFromImageMime(info.mimeType) };
}

interface SavedAvatar {
  avatarPath: string;
  filePath: string;
}

// Decode an `avatar` data URL carried in a native export, validate it as a
// real image, and write it under data/avatars/. The filesystem path lets a
// caller remove the file if attaching it to the imported row fails.
async function saveAvatarFromDataUrl(dataUrl: unknown, prefix: string, id: string): Promise<SavedAvatar | null> {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") return null;
  const decoded = decodeImageDataUrl(dataUrl);
  if (!decoded) {
    logger.warn("Skipped invalid %s avatar data for %s", prefix, id);
    return null;
  }
  const avatarsDir = join(DATA_DIR, "avatars");
  await mkdir(avatarsDir, { recursive: true });
  const filename = `${prefix}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${decoded.ext}`;
  const filepath = assertInsideDir(avatarsDir, join(avatarsDir, filename));
  try {
    await writeFile(filepath, decoded.buffer);
  } catch (error) {
    await removeUnattachedAvatarFile({ filePath: filepath });
    throw error;
  }
  return { avatarPath: `/api/avatars/file/${filename}`, filePath: filepath };
}

// Decode a `bundleImage` data URL carried in a story bundle export, validate
// it as a real image, and write it under data/story-bundles/images/. Returns
// the public API path so the imported bundle keeps its picture across
// machines. Returns null when the payload is absent or invalid.
async function saveStoryBundleImageFromDataUrl(dataUrl: unknown, id: string): Promise<string | null> {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") return null;
  const decoded = decodeImageDataUrl(dataUrl);
  if (!decoded) {
    logger.warn("Skipped invalid story bundle image data for %s", id);
    return null;
  }
  const imagesDir = join(DATA_DIR, "story-bundles", "images");
  await mkdir(imagesDir, { recursive: true });
  const filename = `story-bundle-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${decoded.ext}`;
  const filepath = assertInsideDir(imagesDir, join(imagesDir, filename));
  await writeFile(filepath, decoded.buffer);
  return `/api/story-bundles/images/file/${filename}`;
}

function readLorebookScope(value: unknown): { mode: "all" | "disabled" | "specific"; chatIds: string[] } {
  if (!value || typeof value !== "object") return { mode: "all", chatIds: [] };
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === "disabled" || raw.mode === "specific" ? raw.mode : "all";
  const chatIds = Array.isArray(raw.chatIds)
    ? raw.chatIds.filter((chatId): chatId is string => typeof chatId === "string" && chatId.trim().length > 0)
    : [];
  return { mode, chatIds: Array.from(new Set(chatIds)) };
}

// Restore sprites embedded as [{ filename, data }, ...] in a native export
// by writing each one under data/sprites/<id>/. Filenames are sanitized to
// just an expression stem + an extension matching the actual image bytes, so
// a malicious export can't traverse out of the sprites dir.
async function restoreSprites(sprites: unknown, id: string): Promise<void> {
  if (sprites === undefined || sprites === null) return;
  if (!Array.isArray(sprites)) {
    logger.warn("Skipped invalid sprite collection for %s", id);
    return;
  }
  if (sprites.length === 0) return;
  const dir = join(DATA_DIR, "sprites", id);
  await mkdir(dir, { recursive: true });
  // Track names we've already written this batch so two exported sprites
  // whose stems sanitize to the same string (e.g. "happy!" and "happy?" both
  // collapsing to "happy_") don't silently overwrite each other.
  const usedNames = new Set<string>();
  for (const [index, sprite] of sprites.entries()) {
    if (!sprite || typeof sprite !== "object") {
      logger.warn("Skipped invalid sprite entry %d for %s", index, id);
      continue;
    }
    const entry = sprite as Record<string, unknown>;
    const decoded = decodeImageDataUrl(entry.data);
    if (!decoded) {
      logger.warn("Skipped sprite %d with invalid image data for %s", index, id);
      continue;
    }
    const rawName = typeof entry.filename === "string" ? entry.filename : "";
    const stem =
      rawName
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "")
        ?.replace(/[^a-zA-Z0-9_\- ]/g, "_")
        ?.slice(0, 80) || `sprite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let safeName = `${stem}.${decoded.ext}`;
    let suffix = 1;
    while (usedNames.has(safeName)) {
      safeName = `${stem}-${suffix}.${decoded.ext}`;
      suffix++;
    }
    usedNames.add(safeName);
    try {
      const filepath = assertInsideDir(dir, join(dir, safeName));
      await writeFile(filepath, decoded.buffer);
    } catch (err) {
      logger.warn(err, "Failed to restore sprite %d for %s", index, id);
    }
  }
}

// Restore gallery images embedded as
// [{ filename, data, prompt, provider, model, width, height }, ...]
// in a native character or persona export. Writes each binary under the
// owner's gallery folder and creates a matching metadata row.
async function restoreOwnerGallery(
  gallery: unknown,
  ownerId: string,
  ownerFolder: "characters" | "personas",
  createImage: (input: {
    filePath: string;
    prompt: string;
    provider: string;
    model: string;
    width?: number;
    height?: number;
  }) => Promise<{ id: string } | null>,
): Promise<string | null> {
  if (!Array.isArray(gallery) || gallery.length === 0) return null;
  let characterSheetImageId: string | null = null;
  const dir = join(DATA_DIR, "gallery", ownerFolder, ownerId);
  await mkdir(dir, { recursive: true });
  for (const item of gallery) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const decoded = decodeImageDataUrl(entry.data);
    if (!decoded) continue;
    // Preserve the exported filename: portable card://self/gallery/<file>
    // references in greetings/messages key on it, so a regenerated name breaks
    // every reference after import. Sanitize the stem, always take the
    // extension from the DECODED image (never the envelope), and resolve
    // collisions (merging galleries can legitimately repeat a filename).
    const randomFilename = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${decoded.ext}`;
    let safeFilename = randomFilename();
    const originalName = typeof entry.filename === "string" ? entry.filename : "";
    const originalBase = originalName.split(/[\\/]/).pop()!;
    const originalStem = originalBase
      .replace(/\.[^.]*$/, "")
      .replace(/[^A-Za-z0-9._-]/g, "-")
      .replace(/^\.+/, "")
      // The serve and export paths reject any filename containing "..", so a
      // stem with interior dot-runs — or a trailing dot (also possible after
      // truncation), which recreates ".." once the extension is appended —
      // would be written but never readable.
      .replace(/\.{2,}/g, ".")
      .slice(0, 80)
      .replace(/\.+$/, "");
    // The extension normally comes from the DECODED image (never the envelope),
    // but uploads store ".jpeg" verbatim while extensionFromImageMime returns
    // the canonical "jpg" — the one alias in ALLOWED_GALLERY_EXTS. Keep the
    // original spelling in that case, or portable card://self refs written
    // against the exported name break on the round trip this preserves.
    const originalExt = (/\.([A-Za-z0-9]+)$/.exec(originalBase)?.[1] ?? "").toLowerCase();
    const ext = originalExt === "jpeg" && decoded.ext === "jpg" ? "jpeg" : decoded.ext;
    if (originalStem) {
      for (let attempt = 0; attempt <= 50; attempt++) {
        const candidate = attempt === 0 ? `${originalStem}.${ext}` : `${originalStem}-${attempt + 1}.${ext}`;
        try {
          await access(join(dir, candidate));
          // exists — try the next suffix
        } catch {
          safeFilename = candidate;
          break;
        }
      }
    }
    try {
      const filepath = assertInsideDir(dir, join(dir, safeFilename));
      await writeFile(filepath, decoded.buffer);
      const restored = await createImage({
        filePath: `${ownerFolder}/${ownerId}/${safeFilename}`,
        prompt: typeof entry.prompt === "string" ? entry.prompt : "",
        provider: typeof entry.provider === "string" ? entry.provider : "",
        model: typeof entry.model === "string" ? entry.model : "",
        width: typeof entry.width === "number" ? entry.width : undefined,
        height: typeof entry.height === "number" ? entry.height : undefined,
      });
      if (entry.isCharacterSheet === true && restored) characterSheetImageId = restored.id;
    } catch {
      // skip this image
    }
  }
  return characterSheetImageId;
}

function restoreCharacterGallery(
  gallery: unknown,
  characterId: string,
  galleryStorage: ReturnType<typeof createCharacterGalleryStorage>,
) {
  return restoreOwnerGallery(gallery, characterId, "characters", (input) =>
    galleryStorage.create({ characterId, ...input }),
  );
}

function restorePersonaGallery(
  gallery: unknown,
  personaId: string,
  galleryStorage: ReturnType<typeof createPersonaGalleryStorage>,
) {
  return restoreOwnerGallery(gallery, personaId, "personas", (input) => galleryStorage.create({ personaId, ...input }));
}

function readTimestampOverrides(value: unknown): TimestampOverrides | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const metadata =
    record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : undefined;
  const timestamps =
    record.timestamps && typeof record.timestamps === "object"
      ? (record.timestamps as Record<string, unknown>)
      : metadata?.timestamps && typeof metadata.timestamps === "object"
        ? (metadata.timestamps as Record<string, unknown>)
        : undefined;

  return normalizeTimestampOverrides({
    createdAt: timestamps?.createdAt ?? metadata?.createdAt ?? record.createdAt,
    updatedAt: timestamps?.updatedAt ?? metadata?.updatedAt ?? record.updatedAt,
  });
}

const VALID_MATCHING_SOURCES = new Set<LorebookMatchingSource>([
  "character_name",
  "character_description",
  "character_personality",
  "character_scenario",
  "character_tags",
  "persona_description",
  "persona_tags",
]);

function readMatchingSources(value: unknown): LorebookMatchingSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((source): source is LorebookMatchingSource =>
    VALID_MATCHING_SOURCES.has(source as LorebookMatchingSource),
  );
}

function readFilterMode(value: unknown): LorebookFilterMode {
  const parsed = lorebookFilterModeSchema.safeParse(value);
  return parsed.success ? parsed.data : "any";
}

/**
 * Import a Marinara `.marinara.json` export envelope.
 * Dispatches to the correct handler based on the `type` field.
 */
export async function importMarinara(
  envelope: ExportEnvelope,
  db: DB,
): Promise<{
  success: boolean;
  type: ExportType;
  id?: string;
  name?: string;
  error?: string;
  embeddedImported?: number;
  embeddedSkipped?: number;
  missingAgents?: Array<{ id: string; name: string }>;
}> {
  const normalizedEnvelope = unwrapFolderManifestEnvelope(envelope) ?? envelope;
  if (
    !normalizedEnvelope ||
    typeof normalizedEnvelope !== "object" ||
    !normalizedEnvelope.type ||
    normalizedEnvelope.version !== 1
  ) {
    return { success: false, type: "marinara_character" as ExportType, error: "Invalid Marinara export file" };
  }

  switch (normalizedEnvelope.type) {
    case "marinara_character":
      return importCharacter(normalizedEnvelope.data, db);
    case "marinara_persona":
      return importPersona(normalizedEnvelope.data, db);
    case "marinara_lorebook":
      return importLorebook(normalizedEnvelope.data, db);
    case "marinara_preset":
      return importPreset(normalizedEnvelope.data, db);
    case "marinara_story_bundle":
      return importStoryBundle(normalizedEnvelope.data, db);
    default:
      return {
        success: false,
        type: normalizedEnvelope.type,
        error: `Unknown export type: ${normalizedEnvelope.type}`,
      };
  }
}

function unwrapFolderManifestEnvelope(value: unknown): ExportEnvelope | null {
  if (!isJsonRecord(value)) return null;
  const looksLikeFolderManifest =
    typeof value.kind === "string" || isJsonRecord(value.manifest) || Array.isArray(value.presets);
  if (!looksLikeFolderManifest) return null;
  const entries = getFolderImportEntries(value, ["presets"]);
  for (const entry of entries) {
    const config = getFolderManifestConfig(entry);
    if (isJsonRecord(config) && typeof config.type === "string" && config.version === 1) {
      return config as unknown as ExportEnvelope;
    }
  }
  return null;
}

// ── Character ────────────────────────────────

/** Validate and default a native character payload before it reaches storage. */
export function normalizeNativeCharacterData(data: unknown): CharacterData | null {
  const parsed = characterDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

async function importCharacter(data: unknown, db: DB) {
  const storage = createCharactersStorage(db);
  const galleryStorage = createCharacterGalleryStorage(db);
  const d = data as {
    data?: Record<string, unknown>;
    spec?: string;
    spec_version?: string;
    metadata?: unknown;
    avatar?: unknown;
    sprites?: unknown;
    gallery?: unknown;
  };
  const charData = isJsonRecord(d?.data) ? { ...d.data } : undefined;
  const metadata = d?.metadata && typeof d.metadata === "object" ? (d.metadata as Record<string, unknown>) : null;
  const comment = typeof metadata?.comment === "string" ? metadata.comment : undefined;
  if (!charData || typeof charData !== "object") {
    return { success: false, type: "marinara_character" as const, error: "Invalid character data" };
  }
  const extensions =
    charData.extensions && typeof charData.extensions === "object"
      ? ({ ...(charData.extensions as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const useCharacterSheetAsReference = extensions.useCharacterSheetAsReference === true;
  delete extensions.characterSheetImageId;
  extensions.useCharacterSheetAsReference = false;
  charData.extensions = extensions;
  const existingImportMetadata =
    extensions.importMetadata && typeof extensions.importMetadata === "object"
      ? ({ ...(extensions.importMetadata as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  // Drop any `lorebookId` carried over from the exporter's database. It
  // refers to a row in their lorebook table, not ours, so keeping it
  // leaves an orphan that makes the character editor's "Edit Linked
  // Lorebook" button open a 404 editor stuck on a permanent shimmer
  // (`isLoading || !lorebook`). The user can click "Import Embedded
  // Lorebook" post-import to create a real linked lorebook in this DB.
  const carriedEmbeddedLorebook =
    typeof existingImportMetadata.embeddedLorebook === "object" && existingImportMetadata.embeddedLorebook
      ? (existingImportMetadata.embeddedLorebook as Record<string, unknown>)
      : null;
  if (carriedEmbeddedLorebook && "lorebookId" in carriedEmbeddedLorebook) {
    const { lorebookId: _staleLorebookId, ...sanitized } = carriedEmbeddedLorebook;
    void _staleLorebookId;
    existingImportMetadata.embeddedLorebook = sanitized;
    extensions.importMetadata = existingImportMetadata;
    charData.extensions = extensions;
  }
  const cardSpecMetadata =
    typeof d?.spec === "string" || typeof d?.spec_version === "string"
      ? {
          ...(typeof d.spec === "string" ? { spec: d.spec } : {}),
          ...(typeof d.spec_version === "string" ? { specVersion: d.spec_version } : {}),
        }
      : null;

  if (cardSpecMetadata) {
    extensions.importMetadata = {
      ...existingImportMetadata,
      card: {
        ...(existingImportMetadata.card && typeof existingImportMetadata.card === "object"
          ? (existingImportMetadata.card as Record<string, unknown>)
          : {}),
        ...cardSpecMetadata,
      },
    };
    charData.extensions = extensions;
  }

  const normalizedCharacterData = normalizeNativeCharacterData(charData);
  if (!normalizedCharacterData) {
    return { success: false, type: "marinara_character" as const, error: "Invalid character data" };
  }

  const result = await storage.create(normalizedCharacterData, undefined, readTimestampOverrides(d), comment);
  if (result?.id) {
    const avatar = await saveAvatarFromDataUrl(d.avatar, "character", result.id);
    if (avatar) {
      try {
        const updated = await storage.updateAvatar(result.id, avatar.avatarPath);
        if (!updated) await removeUnattachedAvatarFile({ filePath: avatar.filePath });
      } catch (error) {
        await removeUnattachedAvatarFile({ filePath: avatar.filePath });
        throw error;
      }
    }
    await restoreSprites(d.sprites, result.id);
    const characterSheetImageId = await restoreCharacterGallery(d.gallery, result.id, galleryStorage);
    if (characterSheetImageId) {
      await storage.update(
        result.id,
        { extensions: { characterSheetImageId, useCharacterSheetAsReference } } as Partial<CharacterData>,
        undefined,
        {
          skipVersionSnapshot: true,
          mergeExtensions: true,
        },
      );
    }
  }
  return {
    success: true,
    type: "marinara_character" as const,
    id: result?.id,
    name: normalizedCharacterData.name,
  };
}

// ── Persona ──────────────────────────────────

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return undefined;
}

function issueField(issue: { path: PropertyKey[] }): string | undefined {
  return typeof issue.path[0] === "string" ? issue.path[0] : undefined;
}

/**
 * Native Persona files are a compatibility boundary: preserve valid fields
 * while dropping malformed ones before the same strict create boundary used by
 * direct writes. The tolerant normalizers are deliberately limited to known
 * structured fields; direct values remain strict or are omitted here.
 */
function parseNativePersonaInput(input: Record<string, unknown>) {
  const candidate = canonicalizeLegacyPersonaInput(input) as Record<string, unknown>;
  const strict = personaCreateInputSchema.safeParse(candidate);
  if (strict.success) return strict.data;

  const invalidFields = new Set(strict.error.issues.map(issueField));
  for (const field of invalidFields) {
    switch (field) {
      case "avatarCrop":
        candidate.avatarCrop = normalizeAvatarCrop(candidate.avatarCrop);
        break;
      case "trackerCardColors":
        candidate.trackerCardColors = normalizeTrackerCardColorConfig(candidate.trackerCardColors);
        break;
      case "personaStats":
        candidate.personaStats = normalizePersonaStats(candidate.personaStats) ?? null;
        break;
      case "tags":
      case "savedStatusOptions":
        candidate[field] = normalizePersonaStringArray(candidate[field]);
        break;
      case "convoBehavior":
        candidate.convoBehavior = normalizeConvoBehavior(candidate.convoBehavior) ?? null;
        break;
    }
  }

  const salvaged = personaCreateInputSchema.safeParse(candidate);
  if (salvaged.success) return salvaged.data;

  // Normalizers intentionally leave extension keys alone, so a normalized
  // structured value can still violate a strict known-field rule (for example
  // unsafe tracker paint). Drop each remaining invalid top-level field; an
  // empty native name receives the import default instead.
  for (const issue of salvaged.error.issues) {
    const field = issueField(issue);
    if (field === "name") candidate.name = "Imported Persona";
    else if (field) delete candidate[field];
  }
  return personaCreateInputSchema.parse(candidate);
}

async function importPersona(data: unknown, db: DB) {
  const storage = createCharactersStorage(db);
  const galleryStorage = createPersonaGalleryStorage(db);
  if (!isJsonRecord(data)) {
    return { success: false, type: "marinara_persona" as const, error: "Invalid persona data" };
  }
  const d = data as Record<string, unknown>;
  const timestampOverrides = readTimestampOverrides(d);
  // Alias selection and native-import defaults stay local; the shared adapter
  // owns the legacy structured-field inventory and its decoding policy.
  const personaInput: Record<string, unknown> = {
    name: typeof d.name === "string" ? d.name : "Imported Persona",
    ...(d.avatarCrop === undefined ? {} : { avatarCrop: d.avatarCrop }),
    ...(d.trackerCardColors === undefined ? {} : { trackerCardColors: d.trackerCardColors }),
    ...(d.personaStats === undefined ? {} : { personaStats: d.personaStats }),
    ...(d.tags === undefined ? {} : { tags: d.tags }),
    ...(d.savedStatusOptions === undefined ? {} : { savedStatusOptions: d.savedStatusOptions }),
    ...(d.convoBehavior === undefined ? {} : { convoBehavior: d.convoBehavior }),
    ...(typeof d.versioningEnabled === "boolean" ? { versioningEnabled: d.versioningEnabled } : {}),
  };
  for (const field of [
    "comment",
    "creator",
    "phoneticName",
    "description",
    "personality",
    "scenario",
    "backstory",
    "appearance",
    "nameColor",
    "dialogueColor",
    "boxColor",
    "convoDisplayName",
    "aboutMe",
  ] as const) {
    const value = d[field];
    if (typeof value === "string") personaInput[field] = value;
  }
  const personaVersion = firstString(d.personaVersion, d.persona_version, d.character_version);
  if (personaVersion !== undefined) personaInput.personaVersion = personaVersion;
  const creatorNotes = firstString(d.creatorNotes, d.creator_notes);
  if (creatorNotes !== undefined) personaInput.creatorNotes = creatorNotes;

  const parsed = parseNativePersonaInput(personaInput);
  const { name, description, extra } = encodePersonaCreate(parsed);
  const useCharacterSheetAsReference =
    d.useCharacterSheetAsReference === true || d.useCharacterSheetAsReference === "true";
  const result = await storage.createPersona(
    name,
    description,
    undefined,
    { ...extra, characterSheetImageId: null, useCharacterSheetAsReference: "false" },
    timestampOverrides,
  );
  if (result?.id) {
    let avatar: SavedAvatar | null = null;
    try {
      avatar = await saveAvatarFromDataUrl(d.avatar, "persona", result.id);
      if (avatar) {
        const updated = await storage.updatePersona(result.id, { avatarPath: avatar.avatarPath });
        if (!updated) throw new Error("Imported Persona disappeared before its avatar could be attached");
      }
    } catch (err) {
      if (avatar) await removeUnattachedAvatarFile({ filePath: avatar.filePath });
      logger.warn(err, "Skipped optional persona avatar restore for %s; persona row is already imported", result.id);
    }
    try {
      await restoreSprites(d.sprites, result.id);
    } catch (err) {
      logger.warn(err, "Skipped optional persona sprite restore for %s; persona row is already imported", result.id);
    }
    try {
      const characterSheetImageId = await restorePersonaGallery(d.gallery, result.id, galleryStorage);
      if (characterSheetImageId) {
        await storage.updatePersona(
          result.id,
          { characterSheetImageId, useCharacterSheetAsReference: String(useCharacterSheetAsReference) },
          { skipVersionSnapshot: true },
        );
      }
    } catch (err) {
      logger.warn(err, "Skipped optional persona gallery restore for %s; persona row is already imported", result.id);
    }
  }
  return { success: true, type: "marinara_persona" as const, id: result?.id, name: parsed.name };
}

// ── Lorebook ─────────────────────────────────

async function importLorebook(data: unknown, db: DB) {
  return importLorebookPayload(data, db);
}

async function importLorebookPayload(data: unknown, db: DB) {
  const storage = createLorebooksStorage(db);
  const d = data as {
    lorebook?: Record<string, unknown>;
    entries?: Record<string, unknown>[];
    folders?: Record<string, unknown>[];
  };
  if (!d?.lorebook) {
    return { success: false, type: "marinara_lorebook" as const, error: "Invalid lorebook data" };
  }
  const lb = d.lorebook;
  const newLb = (await storage.create(
    {
      name: String(lb.name ?? "Imported Lorebook"),
      description: String(lb.description ?? ""),
      category: (lb.category as any) ?? "uncategorized",
      scanDepth: Number(lb.scanDepth ?? 2),
      tokenBudget: Number(lb.tokenBudget ?? 2048),
      entryLimit: Number(lb.entryLimit ?? 100),
      recursiveScanning: Boolean(lb.recursiveScanning),
      maxRecursionDepth: Number(lb.maxRecursionDepth ?? 3),
      excludeFromVectorization: Boolean(lb.excludeFromVectorization),
      vectorQueryDepth: Number(lb.vectorQueryDepth ?? 10),
      vectorScoreThreshold: Number(lb.vectorScoreThreshold ?? 0.3),
      vectorMaxResults: Number(lb.vectorMaxResults ?? 10),
      characterId: typeof lb.characterId === "string" ? lb.characterId : null,
      characterIds: Array.isArray(lb.characterIds)
        ? lb.characterIds.filter((value): value is string => typeof value === "string")
        : typeof lb.characterId === "string"
          ? [lb.characterId]
          : [],
      personaId: typeof lb.personaId === "string" ? lb.personaId : null,
      personaIds: Array.isArray(lb.personaIds)
        ? lb.personaIds.filter((value): value is string => typeof value === "string")
        : typeof lb.personaId === "string"
          ? [lb.personaId]
          : [],
      chatId: typeof lb.chatId === "string" ? lb.chatId : null,
      isGlobal: lb.isGlobal === true || lb.isGlobal === "true",
      enabled: lb.enabled !== false,
      scope: readLorebookScope(lb.scope),
      tags: Array.isArray(lb.tags) ? lb.tags.map(String) : [],
      generatedBy: "import",
      sourceAgentId: typeof lb.sourceAgentId === "string" ? lb.sourceAgentId : null,
    },
    readTimestampOverrides(lb),
  )) as Record<string, unknown> | null;

  // Re-create folders in two passes so nesting survives the round-trip. A child
  // folder can be listed before its parent, so pass 1 creates every folder at
  // root and builds the old-ID → new-ID remap; pass 2 re-parents each folder
  // through that remap. Every move is validated with canReparentFolder (the same
  // guard the PATCH route uses), so a malformed/hand-edited export can never
  // persist a cycle — an unresolvable or cyclic parent just leaves that folder at
  // root. Older exports without `folders` skip both passes and entries land at root.
  const folderIdRemap = new Map<string, string>();
  if (newLb && Array.isArray(d.folders) && d.folders.length > 0) {
    const lorebookId = newLb.id as string;
    // Pass 1 — create at root, remembering each folder's exported parent (old ID).
    const pendingReparents: Array<{ newId: string; oldParentId: string }> = [];
    for (const f of d.folders) {
      const oldId = typeof f.id === "string" ? f.id : null;
      const created = (await storage.createFolder(lorebookId, {
        name: String(f.name ?? "Folder"),
        enabled: f.enabled !== false,
        parentFolderId: null,
        order: Number(f.order ?? 0),
      })) as Record<string, unknown> | null;
      const newId = created?.id;
      if (oldId && typeof newId === "string") {
        folderIdRemap.set(oldId, newId);
        const oldParentId = typeof f.parentFolderId === "string" ? f.parentFolderId : null;
        if (oldParentId) pendingReparents.push({ newId, oldParentId });
      }
    }
    // Pass 2 — re-parent through the remap. `folderRows` mirrors the DB state so
    // canReparentFolder sees each applied move; an invalid move (dangling or
    // cyclic parent) is skipped, leaving that folder at root like the editor does.
    const folderRows = Array.from(folderIdRemap.values()).map((id) => ({
      id,
      lorebookId,
      parentFolderId: null as string | null,
    }));
    const rowById = new Map(folderRows.map((row) => [row.id, row]));
    for (const { newId, oldParentId } of pendingReparents) {
      const newParentId = folderIdRemap.get(oldParentId);
      if (!newParentId) continue; // parent wasn't part of the export → leave at root
      if (!canReparentFolder(folderRows, newId, newParentId).ok) continue;
      await storage.updateFolder(newId, { parentFolderId: newParentId }, lorebookId);
      const row = rowById.get(newId);
      if (row) row.parentFolderId = newParentId;
    }
  }

  if (newLb && Array.isArray(d.entries) && d.entries.length > 0) {
    const entries = d.entries.map((e) => {
      const oldFolderId = typeof e.folderId === "string" ? e.folderId : null;
      const newFolderId = oldFolderId ? (folderIdRemap.get(oldFolderId) ?? null) : null;
      return {
        name: String(e.name ?? ""),
        content: String(e.content ?? ""),
        // CodeRabbit-flagged: description, ephemeral, locked, and recursion flags
        // were absent from the previous map, so an exported lorebook would lose
        // these fields on re-import. Knowledge-router matching uses description,
        // ephemeral controls auto-disable countdown, locked protects entries
        // from the Lorebook Keeper agent, and recursion flags gate recursive
        // scanning — all behaviors that should round-trip.
        description: String(e.description ?? ""),
        keys: Array.isArray(e.keys) ? e.keys.map(String) : [],
        secondaryKeys: Array.isArray(e.secondaryKeys) ? e.secondaryKeys.map(String) : [],
        enabled: e.enabled !== false,
        constant: Boolean(e.constant),
        selective: Boolean(e.selective),
        selectiveLogic: resolveNativeSelectiveLogic(e.selectiveLogic),
        probability: e.probability != null ? Number(e.probability) : null,
        scanDepth: e.scanDepth != null ? Number(e.scanDepth) : null,
        matchWholeWords: Boolean(e.matchWholeWords),
        caseSensitive: Boolean(e.caseSensitive),
        useRegex: Boolean(e.useRegex),
        characterFilterMode: readFilterMode(e.characterFilterMode),
        characterFilterIds: Array.isArray(e.characterFilterIds) ? e.characterFilterIds.map(String) : [],
        characterTagFilterMode: readFilterMode(e.characterTagFilterMode),
        characterTagFilters: Array.isArray(e.characterTagFilters) ? e.characterTagFilters.map(String) : [],
        generationTriggerFilterMode: readFilterMode(e.generationTriggerFilterMode),
        generationTriggerFilters: Array.isArray(e.generationTriggerFilters)
          ? e.generationTriggerFilters.map(String)
          : [],
        additionalMatchingSources: readMatchingSources(e.additionalMatchingSources),
        position: resolveNativePosition(e.position),
        outletName: String(e.outletName ?? ""),
        depth: Number(e.depth ?? 4),
        order: Number(e.order ?? 100),
        role: resolveLorebookEntryRole(e.role),
        sticky: e.sticky != null ? Number(e.sticky) : null,
        cooldown: e.cooldown != null ? Number(e.cooldown) : null,
        delay: e.delay != null ? Number(e.delay) : null,
        ephemeral: e.ephemeral != null ? Number(e.ephemeral) : null,
        group: String(e.group ?? ""),
        groupWeight: e.groupWeight != null ? Number(e.groupWeight) : null,
        folderId: newFolderId,
        locked: Boolean(e.locked),
        preventRecursion: e.preventRecursion == null ? true : Boolean(e.preventRecursion),
        excludeRecursion: Boolean(e.excludeRecursion),
        delayUntilRecursion: Boolean(e.delayUntilRecursion),
        excludeFromVectorization: Boolean(e.excludeFromVectorization),
        tag: String(e.tag ?? ""),
        relationships: (e.relationships as any) ?? {},
        dynamicState: (e.dynamicState as any) ?? {},
        activationConditions: (e.activationConditions as any) ?? [],
        schedule: (e.schedule as any) ?? null,
      };
    });
    await storage.bulkCreateEntries(newLb.id as string, entries);
  }

  return {
    success: true,
    type: "marinara_lorebook" as const,
    id: newLb?.id as string,
    name: String(lb.name ?? "Imported Lorebook"),
  };
}

// ── Preset ───────────────────────────────────

async function importPreset(data: unknown, db: DB) {
  const storage = createPromptsStorage(db);
  const d = data as {
    preset?: Record<string, unknown>;
    sections?: Record<string, unknown>[];
    groups?: Record<string, unknown>[];
    choiceBlocks?: Record<string, unknown>[];
  };
  if (!d?.preset) {
    return { success: false, type: "marinara_preset" as const, error: "Invalid preset data" };
  }
  const p = d.preset;

  // Create the base preset
  const newPreset = await storage.create(
    {
      name: String(p.name ?? "Imported Preset"),
      description: String(p.description ?? ""),
      conversationPrompt: String(p.conversationPrompt ?? p.conversation_prompt ?? ""),
      gamePrompt: String(p.gamePrompt ?? p.game_prompt ?? ""),
      variableGroups: safeParseJson(p.variableGroups, []),
      variableValues: safeParseJson(p.variableValues, {}),
      parameters: {},
      wrapFormat: (p.wrapFormat as any) ?? "xml",
      author: String(p.author ?? ""),
    },
    readTimestampOverrides(p),
  );
  if (!newPreset) {
    return { success: false, type: "marinara_preset" as const, error: "Failed to create preset" };
  }

  // Re-create groups with old→new ID mapping
  const groupMap = new Map<string, string>();
  if (Array.isArray(d.groups)) {
    for (const g of d.groups) {
      const newGroup = await storage.createGroup({
        presetId: newPreset.id,
        name: String(g.name ?? ""),
        parentGroupId: null, // fixed below
        order: Number(g.order ?? 100),
        enabled: g.enabled === true || g.enabled === "true",
      });
      if (newGroup) groupMap.set(String(g.id), newGroup.id);
    }
    // Fix parent references
    for (const g of d.groups) {
      if (g.parentGroupId && groupMap.has(String(g.parentGroupId))) {
        const newGId = groupMap.get(String(g.id));
        if (newGId) {
          await storage.updateGroup(newGId, {
            parentGroupId: groupMap.get(String(g.parentGroupId))!,
          });
        }
      }
    }
  }

  // Re-create sections with old→new ID mapping
  const sectionMap = new Map<string, string>();
  if (Array.isArray(d.sections)) {
    for (const s of d.sections) {
      const groupId = s.groupId ? (groupMap.get(String(s.groupId)) ?? null) : null;
      const newSection = await storage.createSection({
        presetId: newPreset.id,
        identifier: String(s.identifier ?? ""),
        name: String(s.name ?? ""),
        content: String(s.content ?? ""),
        role: (s.role as any) ?? "system",
        enabled: s.enabled === true || s.enabled === "true",
        isMarker: s.isMarker === true || s.isMarker === "true",
        groupId,
        markerConfig: s.markerConfig ? safeParseJson(s.markerConfig, null) : null,
        injectionPosition: (s.injectionPosition as any) ?? "ordered",
        injectionDepth: Number(s.injectionDepth ?? 0),
        injectionOrder: Number(s.injectionOrder ?? 100),
        forbidOverrides: s.forbidOverrides === true || s.forbidOverrides === "true",
      });
      if (newSection) sectionMap.set(String(s.id), newSection.id);
    }
  }

  // Re-create choice blocks
  if (Array.isArray(d.choiceBlocks)) {
    for (const v of d.choiceBlocks) {
      await storage.createChoiceBlock({
        presetId: newPreset.id,
        variableName: String(v.variableName ?? ""),
        question: String(v.question ?? ""),
        options: safeParseJson(v.options, []),
        multiSelect: v.multiSelect === true || v.multiSelect === "true",
        separator: String(v.separator ?? ", "),
        randomPick: v.randomPick === true || v.randomPick === "true",
        displayMode: v.displayMode === "buttons" || v.displayMode === "listbox" ? v.displayMode : "auto",
        optionSort: v.optionSort === "alphabetical" ? "alphabetical" : "manual",
      });
    }
  }

  // Remap section/group order arrays
  const oldSectionOrder = safeParseJson(p.sectionOrder, []) as string[];
  const newSectionOrder = oldSectionOrder.map((sid) => sectionMap.get(sid)).filter(Boolean) as string[];
  const oldGroupOrder = safeParseJson(p.groupOrder, []) as string[];
  const newGroupOrder = oldGroupOrder.map((gid) => groupMap.get(gid)).filter(Boolean) as string[];
  const defaultChoices = safeParseJson<unknown>(p.defaultChoices, {});
  await storage.update(newPreset.id, {
    sectionOrder: newSectionOrder,
    groupOrder: newGroupOrder,
    defaultChoices: normalizeDefaultChoices(defaultChoices),
  });

  return {
    success: true,
    type: "marinara_preset" as const,
    id: newPreset.id,
    name: String(p.name ?? "Imported Preset"),
  };
}

// ── Story Bundle ────────────────────────────

async function importStoryBundle(data: unknown, db: DB) {
  const storage = createStoryBundlesStorage(db);
  const charactersStorage = createCharactersStorage(db);
  const lorebooksStorage = createLorebooksStorage(db);
  const promptsStorage = createPromptsStorage(db);
  const d = data as {
    name?: unknown;
    description?: unknown;
    imagePath?: unknown;
    avatarCrop?: unknown;
    bundleImage?: unknown;
    comment?: unknown;
    creator?: unknown;
    version?: unknown;
    tags?: unknown;
    characterIds?: unknown;
    personaIds?: unknown;
    lorebookIds?: unknown;
    presetIds?: unknown;
    agentIds?: unknown;
    intros?: unknown;
    embeddedCharacters?: unknown;
    embeddedPersonas?: unknown;
    embeddedLorebooks?: unknown;
    embeddedPresets?: unknown;
    embeddedAgents?: unknown;
    importEmbedded?: unknown;
  };
  if (!d || typeof d !== "object") {
    return { success: false, type: "marinara_story_bundle" as const, error: "Invalid story bundle data" };
  }
  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (!name) {
    return { success: false, type: "marinara_story_bundle" as const, error: "Story bundle name is required" };
  }
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  const shouldImportEmbedded = d.importEmbedded !== false;

  // Pre-load existing entities for dedup by name
  const existingCharacters = await charactersStorage.list();
  const existingPersonas = await charactersStorage.listPersonas();
  const existingLorebooks = await lorebooksStorage.list();

  // Build name→id lookup maps for dedup
  const existingCharNameMap = new Map<string, string>();
  for (const char of existingCharacters) {
    try {
      const parsed = JSON.parse((char as Record<string, unknown>).data as string);
      const charName = typeof parsed.name === "string" ? parsed.name.trim().toLowerCase() : "";
      if (charName) existingCharNameMap.set(charName, (char as Record<string, unknown>).id as string);
    } catch {
      /* skip unparseable */
    }
  }
  const existingPersonaNameMap = new Map<string, string>();
  for (const persona of existingPersonas) {
    const pName =
      typeof (persona as Record<string, unknown>).name === "string"
        ? ((persona as Record<string, unknown>).name as string).trim().toLowerCase()
        : "";
    if (pName) existingPersonaNameMap.set(pName, (persona as Record<string, unknown>).id as string);
  }
  const existingLorebookNameMap = new Map<string, string>();
  for (const lb of existingLorebooks) {
    const lbName =
      typeof (lb as Record<string, unknown>).name === "string"
        ? ((lb as Record<string, unknown>).name as string).trim().toLowerCase()
        : "";
    if (lbName) existingLorebookNameMap.set(lbName, (lb as Record<string, unknown>).id as string);
  }
  const existingPresets = await promptsStorage.list();
  const existingPresetNameMap = new Map<string, string>();
  for (const preset of existingPresets) {
    const pName =
      typeof (preset as Record<string, unknown>).name === "string"
        ? ((preset as Record<string, unknown>).name as string).trim().toLowerCase()
        : "";
    if (pName) existingPresetNameMap.set(pName, (preset as Record<string, unknown>).id as string);
  }

  // ID remapping: old exported IDs → new imported IDs
  const characterIdMap = new Map<string, string>();
  const personaIdMap = new Map<string, string>();
  const lorebookIdMap = new Map<string, string>();
  const presetIdMap = new Map<string, string>();

  let embeddedImported = 0;
  let embeddedSkipped = 0;

  // Import embedded characters (skip if one with the same name already exists)
  if (shouldImportEmbedded && Array.isArray(d.embeddedCharacters)) {
    for (const embedded of d.embeddedCharacters) {
      if (!embedded || typeof embedded !== "object") continue;
      const ec = embedded as Record<string, unknown>;
      const oldId = typeof ec.id === "string" ? ec.id : "";
      const charData = ec.data;
      if (!charData || typeof charData !== "object") continue;

      // Dedup: check if a character with the same name already exists
      const charName =
        typeof (charData as Record<string, unknown>).name === "string"
          ? ((charData as Record<string, unknown>).name as string).trim().toLowerCase()
          : "";
      if (charName && existingCharNameMap.has(charName)) {
        const existingId = existingCharNameMap.get(charName)!;
        characterIdMap.set(oldId, existingId);
        embeddedSkipped++;
        continue;
      }

      try {
        const result = await importCharacter(
          {
            data: charData as Record<string, unknown>,
            metadata: { comment: `[Story Bundle: ${name}]` },
            avatar: ec.avatar,
            sprites: ec.sprites,
            gallery: ec.gallery,
          },
          db,
        );
        if (result.success && result.id) {
          characterIdMap.set(oldId, result.id);
          embeddedImported++;
          // Track newly imported name so duplicates within the same bundle are also skipped
          if (charName) existingCharNameMap.set(charName, result.id);
        }
      } catch {
        // Skip failed imports
      }
    }
  }

  // Import embedded personas (skip if one with the same name already exists)
  if (shouldImportEmbedded && Array.isArray(d.embeddedPersonas)) {
    for (const embedded of d.embeddedPersonas) {
      if (!embedded || typeof embedded !== "object") continue;
      const ep = embedded as Record<string, unknown>;
      const oldId = typeof ep.id === "string" ? ep.id : "";

      // Dedup: check if a persona with the same name already exists
      const personaName = typeof ep.name === "string" ? (ep.name as string).trim().toLowerCase() : "";
      if (personaName && existingPersonaNameMap.has(personaName)) {
        const existingId = existingPersonaNameMap.get(personaName)!;
        personaIdMap.set(oldId, existingId);
        embeddedSkipped++;
        continue;
      }

      try {
        const { id: _id, ...personaData } = ep;
        void _id;
        const result = await importPersona(personaData, db);
        if (result.success && result.id) {
          personaIdMap.set(oldId, result.id);
          embeddedImported++;
          if (personaName) existingPersonaNameMap.set(personaName, result.id);
        }
      } catch {
        // Skip failed imports
      }
    }
  }

  // Import embedded lorebooks (skip if one with the same name already exists)
  if (shouldImportEmbedded && Array.isArray(d.embeddedLorebooks)) {
    for (const embedded of d.embeddedLorebooks) {
      if (!embedded || typeof embedded !== "object") continue;
      const el = embedded as Record<string, unknown>;
      const oldId = typeof el.id === "string" ? el.id : "";

      // Dedup: check if a lorebook with the same name already exists
      const lbName =
        typeof (el.lorebook as Record<string, unknown> | null)?.name === "string"
          ? ((el.lorebook as Record<string, unknown>).name as string).trim().toLowerCase()
          : "";
      if (lbName && existingLorebookNameMap.has(lbName)) {
        const existingId = existingLorebookNameMap.get(lbName)!;
        lorebookIdMap.set(oldId, existingId);
        embeddedSkipped++;
        continue;
      }

      try {
        const result = await importLorebookPayload(el, db);
        if (result.success && result.id) {
          lorebookIdMap.set(oldId, result.id);
          embeddedImported++;
          if (lbName) existingLorebookNameMap.set(lbName, result.id);
        }
      } catch {
        // Skip failed imports
      }
    }
  }

  // Import embedded presets (skip if one with the same name already exists)
  if (shouldImportEmbedded && Array.isArray(d.embeddedPresets)) {
    for (const embedded of d.embeddedPresets) {
      if (!embedded || typeof embedded !== "object") continue;
      const ep = embedded as Record<string, unknown>;
      const oldId = typeof ep.id === "string" ? ep.id : "";

      // Dedup: check if a preset with the same name already exists
      const presetName =
        typeof (ep.preset as Record<string, unknown> | null)?.name === "string"
          ? ((ep.preset as Record<string, unknown>).name as string).trim().toLowerCase()
          : "";
      if (presetName && existingPresetNameMap.has(presetName)) {
        const existingId = existingPresetNameMap.get(presetName)!;
        presetIdMap.set(oldId, existingId);
        embeddedSkipped++;
        continue;
      }

      try {
        const result = await importPreset(ep, db);
        if (result.success && result.id) {
          presetIdMap.set(oldId, result.id);
          embeddedImported++;
          if (presetName) existingPresetNameMap.set(presetName, result.id);
        }
      } catch {
        // Skip failed imports
      }
    }
  }

  // Remap IDs: use new IDs for entities that were imported, keep old IDs for
  // entities that already exist in this database.
  const remapIds = (ids: string[], map: Map<string, string>): string[] => ids.map((id) => map.get(id) ?? id);

  const finalCharacterIds = remapIds(stringArray(d.characterIds), characterIdMap);
  const finalPersonaIds = remapIds(stringArray(d.personaIds), personaIdMap);
  const finalLorebookIds = remapIds(stringArray(d.lorebookIds), lorebookIdMap);
  const finalPresetIds = remapIds(stringArray(d.presetIds), presetIdMap);
  const finalAgentIds = stringArray(d.agentIds);

  // Detect agents referenced by the bundle that are not available locally, so
  // the client can offer to install the capability package that provides them.
  // An agent is "present" if it is a built-in (from an installed capability
  // package) or a custom agent config. Anything else is missing.
  const agentsStorage = createAgentsStorage(db);
  const agentConfigs = await agentsStorage.list();
  const knownAgentIds = new Set<string>();
  for (const manifest of BUILT_IN_AGENT_MANIFESTS) knownAgentIds.add(manifest.id);
  for (const config of agentConfigs) knownAgentIds.add((config as Record<string, unknown>).type as string);

  // Embedded agent metadata carried in the export (id → display name) so the
  // missing-agent prompt can show a friendly label instead of a raw id.
  const embeddedAgentNames = new Map<string, string>();
  if (Array.isArray(d.embeddedAgents)) {
    for (const entry of d.embeddedAgents) {
      if (!entry || typeof entry !== "object") continue;
      const ea = entry as Record<string, unknown>;
      if (typeof ea.id === "string" && typeof ea.name === "string" && ea.name.trim()) {
        embeddedAgentNames.set(ea.id, ea.name.trim());
      }
    }
  }

  const missingAgents = finalAgentIds
    .filter((agentId) => !knownAgentIds.has(agentId))
    .map((agentId) => ({ id: agentId, name: embeddedAgentNames.get(agentId) ?? agentId }));

  // Intros are inline data — parse and validate, generating new IDs for each.
  const finalIntros = Array.isArray(d.intros)
    ? d.intros
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => ({
          id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : newId(),
          name: typeof entry.name === "string" ? entry.name : "",
          text: typeof entry.text === "string" ? entry.text : "",
        }))
        .filter((entry) => entry.name.length > 0 && entry.text.length > 0)
    : [];

  const result = await storage.create({
    name,
    description: typeof d.description === "string" ? d.description : null,
    imagePath: null,
    comment: typeof d.comment === "string" ? d.comment : "",
    creator: typeof d.creator === "string" ? d.creator : "",
    version: typeof d.version === "string" ? d.version : "",
    tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === "string") : [],
    characterIds: finalCharacterIds,
    personaIds: finalPersonaIds,
    lorebookIds: finalLorebookIds,
    presetIds: finalPresetIds,
    agentIds: finalAgentIds,
    intros: finalIntros,
  });
  if (!result) {
    return { success: false, type: "marinara_story_bundle" as const, error: "Failed to create story bundle" };
  }

  // Restore the bundle picture from the embedded data URL. The exported
  // imagePath points at the source machine's file, so it is only kept when no
  // embedded image is available.
  const importedId = result.id as string;
  let imagePath: string | null = typeof d.imagePath === "string" ? d.imagePath : null;
  if (d.bundleImage !== undefined && d.bundleImage !== null && d.bundleImage !== "") {
    const restored = await saveStoryBundleImageFromDataUrl(d.bundleImage, importedId);
    if (restored) imagePath = restored;
  }
  const avatarCrop = normalizeAvatarCrop(d.avatarCrop);
  if (imagePath !== null || avatarCrop !== null) {
    await storage.update(importedId, { imagePath, avatarCrop });
  }

  return {
    success: true,
    type: "marinara_story_bundle" as const,
    id: importedId,
    name,
    embeddedImported,
    embeddedSkipped,
    missingAgents,
  };
}

/** Safely parse a value that may be a JSON string or already an object. */
function safeParseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
