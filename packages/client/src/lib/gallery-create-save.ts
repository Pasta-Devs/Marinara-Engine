// ──────────────────────────────────────────────
// Saving what the gallery's "Create with AI" made: a character sheet goes
// through the editor's own sheet save; a background and every sticker or emoji
// land in the gallery as their own pictures, already labelled for their use.
// ──────────────────────────────────────────────
import { toast } from "sonner";
import type { TFunction } from "i18next";
import type { GalleryCreateKind, GalleryCreateResult } from "../components/ui/AvatarGenerationModal";
import { dataImageUrlToFile } from "./data-image-file";
import { readImageDimensions, type CustomTagPatch } from "./custom-emoji";
import type { GalleryImageUploadInput, GalleryImageUploadMetadata } from "./gallery-image-upload";

export async function saveGalleryCreation(
  result: GalleryCreateResult,
  options: {
    fileStem: string;
    upload: (input: GalleryImageUploadInput) => Promise<Array<{ id: string }>>;
    tag: (args: { imageId: string; patch: CustomTagPatch }) => Promise<unknown>;
    saveCharacterSheet: (dataUrl: string, metadata?: GalleryImageUploadMetadata) => Promise<void>;
    localizeUi: TFunction;
  },
): Promise<void> {
  const { fileStem, upload, tag, localizeUi } = options;
  const { prompt, generation, provider, model, width, height } = result;
  const metadata = { prompt, generation, provider, model, width, height };
  if (result.kind === "character-sheet") {
    await options.saveCharacterSheet(result.dataUrl, metadata);
    return;
  }

  if (result.kind === "background") {
    const [image] = await upload({
      ...metadata,
      files: [dataImageUrlToFile(result.dataUrl, `${fileStem}-background`)],
    });
    if (!image) throw new Error(localizeUi("ui.ui.avatargenerationmodal.failedToSaveGalleryImages"));
    try {
      await tag({ imageId: image.id, patch: { customKind: "background", customName: null } });
    } catch {
      // The picture is saved; only its label failed, so don't fail the save (a retry would upload it twice).
      toast.error(localizeUi("ui.ui.avatargenerationmodal.someNotLabelled", { count: 1 }));
      return;
    }
    toast.success(localizeUi("ui.ui.avatargenerationmodal.backgroundSaved"));
    return;
  }

  if (!("items" in result) || result.items.length === 0) return;
  const kind = result.kind === "emoji-sheet" ? "emoji" : "sticker";
  const files = result.items.map((item) => dataImageUrlToFile(item.dataUrl, `${fileStem}-${kind}-${item.name}`));
  // Cut cells keep the sheet's original prompt/settings; their actual size is saved with each label below.
  const uploaded = await upload({ ...metadata, files });
  const labelled = await Promise.allSettled(
    uploaded.map(async (image, index) => {
      const item = result.items[index];
      if (!image || !item) return;
      const { width, height } = await readImageDimensions(item.dataUrl);
      await tag({ imageId: image.id, patch: { customKind: kind, customName: item.name, width, height } });
    }),
  );
  const unlabelled = labelled.filter((entry) => entry.status === "rejected").length;
  if (unlabelled > 0) {
    toast.error(localizeUi("ui.ui.avatargenerationmodal.someNotLabelled", { count: unlabelled }));
  }
  toast.success(
    localizeUi(
      kind === "emoji" ? "ui.ui.avatargenerationmodal.emojiSaved" : "ui.ui.avatargenerationmodal.stickersSaved",
      { count: uploaded.length },
    ),
  );
}

/**
 * Starting prompts per type: the sheet, stickers and emoji start from the look; a background starts from
 * the story (scenario or setting), which its server prompt turns into a place without people.
 */
export function galleryCreateSeeds(
  appearance: string | undefined,
  setting: string | undefined,
  name?: string,
): Record<GalleryCreateKind, string> {
  const look = appearance?.trim() ?? "";
  // The scenario talks in macros; the background prompt reads better with the names they stand for.
  const place = (setting?.trim() || look)
    .replace(/\{\{\s*char\s*\}\}/giu, name?.trim() || "the character")
    .replace(/\{\{\s*user\s*\}\}/giu, "the user");
  return {
    "character-sheet": look,
    background: place,
    "sticker-sheet": look,
    "emoji-sheet": look,
  };
}
