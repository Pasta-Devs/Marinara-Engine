// ──────────────────────────────────────────────
// Gallery picture descriptions: read, write, and have the Image reading model write them.
// One place for all six galleries (chat, character, persona, global, custom emojis, custom stickers).
// ──────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { normalizeGalleryDescription, type GalleryDescriptionScope } from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { characterImages, chatImages, globalImages, personaImages } from "../../db/schema/gallery.js";
import { customEmojis } from "../../db/schema/custom-emojis.js";
import { customStickers } from "../../db/schema/custom-stickers.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveFlatMediaFile } from "../../utils/media-file-security.js";
import { getSharp } from "../../utils/sharp.js";
import { generateImageCaptionForDataUrl, type ImageCaptioningRuntime } from "../generation/image-captioning-runtime.js";
import { resolveStoredGalleryFile } from "./gallery-file-lifecycle.js";

/** What a picture is used as; it decides what its description should say. */
export type DescribedPictureKind = "emoji" | "sticker" | "background" | "picture";

export type DescribablePicture = {
  id: string;
  /** Absolute path of the image file, or null when it cannot be found. */
  absolutePath: string | null;
  kind: DescribedPictureKind;
  /** The emoji or sticker name, or a background's place names. */
  label: string | null;
  description: string | null;
};

type PictureRow = {
  id: string;
  filePath: string;
  description?: string | null;
  customKind?: string | null;
  customName?: string | null;
  name?: string;
  chatId?: string;
  characterId?: string;
  personaId?: string;
};

const SCOPE_TABLES = {
  chat: chatImages,
  character: characterImages,
  persona: personaImages,
  global: globalImages,
  emoji: customEmojis,
  sticker: customStickers,
} as const;

function ownerOf(scope: GalleryDescriptionScope, row: PictureRow): string | null {
  if (scope === "chat") return row.chatId ?? null;
  if (scope === "character") return row.characterId ?? null;
  if (scope === "persona") return row.personaId ?? null;
  return null;
}

function picturePath(scope: GalleryDescriptionScope, filePath: string): string | null {
  if (scope === "emoji") return resolveFlatMediaFile(join(DATA_DIR, "custom-emojis"), filePath);
  if (scope === "sticker") return resolveFlatMediaFile(join(DATA_DIR, "custom-stickers"), filePath);
  return resolveStoredGalleryFile(filePath)?.absolutePath ?? null;
}

function pictureKind(scope: GalleryDescriptionScope, row: PictureRow): DescribedPictureKind {
  if (scope === "emoji" || scope === "sticker") return scope;
  if (row.customKind === "emoji" || row.customKind === "sticker" || row.customKind === "background") {
    return row.customKind;
  }
  return "picture";
}

/**
 * The pictures of one gallery, by id. A picture that is missing, or that belongs to another owner than `ownerId`
 * (chat, character and persona galleries), is left out.
 */
export async function loadDescribablePictures(
  db: DB,
  scope: GalleryDescriptionScope,
  ownerId: string | null,
  ids: string[],
): Promise<Map<string, DescribablePicture>> {
  const table = SCOPE_TABLES[scope];
  const found = new Map<string, DescribablePicture>();
  for (const id of new Set(ids)) {
    const rows = (await db.select().from(table).where(eq(table.id, id))) as PictureRow[];
    const row = rows[0];
    if (!row) continue;
    const owner = ownerOf(scope, row);
    if (owner !== null && owner !== ownerId) continue;
    found.set(id, {
      id,
      absolutePath: picturePath(scope, row.filePath),
      kind: pictureKind(scope, row),
      label: scope === "emoji" || scope === "sticker" ? (row.name ?? null) : (row.customName ?? null),
      description: row.description ?? null,
    });
  }
  return found;
}

/** Save (or clear, with null) one picture's description. */
export async function saveGalleryDescription(
  db: DB,
  scope: GalleryDescriptionScope,
  id: string,
  description: string | null,
): Promise<void> {
  const table = SCOPE_TABLES[scope];
  const normalized = normalizeGalleryDescription(description);
  if (scope === "emoji" || scope === "sticker") {
    await db
      .update(table as typeof customEmojis)
      .set({ description: normalized, updatedAt: new Date().toISOString() })
      .where(eq((table as typeof customEmojis).id, id));
    return;
  }
  await db
    .update(table as typeof chatImages)
    .set({ description: normalized })
    .where(eq((table as typeof chatImages).id, id));
}

/** The instructions the Image reading model gets for each kind of picture. */
export function describePicturePrompt(kind: DescribedPictureKind): string {
  const common =
    "Return only the description, with no preamble, quotes or labels. The picture's name, when given, is only a hint: describe what the picture actually shows.";
  switch (kind) {
    case "emoji":
      return `You write short descriptions of custom chat emojis so a chat model can pick the right one for a moment. In one line of at most 15 words, say what it shows and the feeling or reaction it gives, for example "cat peeking over a pillow; shy, embarrassed". Leave out that it is an emoji and colours that don't matter. ${common}`;
    case "sticker":
      return `You write short descriptions of chat stickers so a chat model can pick the right one for a moment. In one line of at most 20 words, say what it shows, any text written on it, and the feeling or reaction it gives, for example "bear hugging a heart, text 'miss you'; warm, affectionate". Leave out that it is a sticker. ${common}`;
    case "background":
      return `You describe chat backgrounds so a chat model knows which place a picture shows. In one or two sentences of at most 40 words, say what kind of place it is, the time of day and the mood. ${common}`;
    default:
      return `You describe gallery pictures for a chat app. In one or two sentences of at most 40 words, say who or what the picture shows and where. ${common}`;
  }
}

function describeFilename(picture: DescribablePicture): string {
  if (picture.kind === "emoji" && picture.label) return `:${picture.label}:`;
  if (picture.kind === "sticker" && picture.label) return `sticker:${picture.label}:`;
  return picture.label || "picture";
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Longest side the model gets: enough to read a sticker's text, small enough to stay cheap. */
const DESCRIBE_MAX_SIDE = 768;
const RAW_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

/** The picture as a data URL the model can read: first frame only, downscaled. Null when it cannot be read. */
export async function readPictureForDescribing(absolutePath: string): Promise<string | null> {
  const sharp = await getSharp();
  if (sharp) {
    try {
      const png = await sharp(absolutePath, { animated: false, limitInputPixels: 8192 * 8192 })
        .resize(DESCRIBE_MAX_SIDE, DESCRIBE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      return null;
    }
  }
  // Without sharp (some Android installs), send small still pictures as they are.
  const mime = MIME_BY_EXT[extname(absolutePath).toLowerCase()];
  if (!mime || mime === "image/gif" || mime === "image/avif") return null;
  try {
    const buffer = await readFile(absolutePath);
    if (buffer.length > RAW_FALLBACK_MAX_BYTES) return null;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Have the Image reading model describe one picture. Throws with a short reason when it cannot. */
export async function describePicture(
  picture: DescribablePicture,
  runtime: ImageCaptioningRuntime,
  signal: AbortSignal,
): Promise<string> {
  if (!picture.absolutePath) throw new Error("The picture's file is missing");
  const dataUrl = await readPictureForDescribing(picture.absolutePath);
  if (!dataUrl) throw new Error("The picture could not be read");
  const caption = await generateImageCaptionForDataUrl(
    describeFilename(picture),
    dataUrl,
    { ...runtime, prompt: describePicturePrompt(picture.kind) },
    signal,
  );
  const description = normalizeGalleryDescription(
    caption
      ?.replace(/^(?:description|caption)\s*:\s*/i, "")
      .replace(/^["“](.*)["”]$/s, "$1")
      .trim(),
  );
  if (!description) throw new Error("The model sent back no description");
  return description;
}
