// ──────────────────────────────────────────────
// "Clean up" for stickers and emoji already in a gallery: the same passes a
// freshly cut sheet gets (outline specks, green bits, trim), and stickers are
// set on one shared baseline. Each picture is swapped in place, so its name,
// label and spot in the gallery stay.
// ──────────────────────────────────────────────
import { toast } from "sonner";
import type { TFunction } from "i18next";
import { api } from "./api-client";
import { dataImageUrlToFile } from "./data-image-file";
import { readImageDimensions } from "./custom-emoji";
import { cleanUpSavedGalleryPiece, fitGallerySheetCell, fitGallerySheetSet } from "./gallery-sheet-cut";

export type CleanableGalleryImage = {
  id: string;
  url: string;
  filePath: string;
  customKind?: string | null;
};

/** Stickers and emoji in a selection: the only pictures the clean-up applies to. */
export function cleanableGalleryImages<T extends CleanableGalleryImage>(images: T[]): T[] {
  return images.filter((image) => image.customKind === "sticker" || image.customKind === "emoji");
}

async function readAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the picture"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Clean up the stickers and emoji among `images` and swap each picture in place through `replacePath`
 * (the gallery's `/…/gallery/:imageId/replace` route for that image). Returns how many were cleaned.
 */
export async function cleanUpGalleryImages(
  images: CleanableGalleryImage[],
  options: { replacePath: (imageId: string) => string; localizeUi: TFunction },
): Promise<number> {
  const { localizeUi } = options;
  const targets = cleanableGalleryImages(images);
  if (targets.length === 0) return 0;
  const cleaned = await Promise.all(
    targets.map(async (image) => cleanUpSavedGalleryPiece(await readAsDataUrl(image.url))),
  );
  const stickers = targets.flatMap((image, index) => (image.customKind === "sticker" ? [index] : []));
  const fitted: string[] = [];
  // Stickers picked together stand on one baseline; each emoji fills its own square.
  const stickerImages = await fitGallerySheetSet(
    stickers.map((index) => cleaned[index]!),
    "sticker",
  );
  stickers.forEach((index, order) => (fitted[index] = stickerImages[order]!));
  await Promise.all(
    targets.map(async (image, index) => {
      if (image.customKind === "emoji") fitted[index] = await fitGallerySheetCell(cleaned[index]!, "emoji");
    }),
  );
  const results = await Promise.allSettled(
    targets.map(async (image, index) => {
      const dataUrl = fitted[index]!;
      const { width, height } = await readImageDimensions(dataUrl);
      const stem = (image.filePath.split(/[\\/]/).pop() ?? "image").replace(/\.[^.]+$/, "");
      const form = new FormData();
      form.append("width", String(width));
      form.append("height", String(height));
      form.append("file", dataImageUrlToFile(dataUrl, `${stem}-clean`));
      await api.upload(options.replacePath(image.id), form);
    }),
  );
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0)
    toast.error(
      localizeUi("ui.gallery.batch.cleanUpPartial", {
        completed: targets.length - failed,
        count: targets.length,
        failed,
      }),
    );
  else toast.success(localizeUi("ui.gallery.batch.cleanedUp", { count: targets.length }));
  return targets.length - failed;
}
