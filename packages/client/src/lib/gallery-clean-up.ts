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
import {
  cleanUpSavedGalleryPiece,
  fitGallerySheetCell,
  fitGallerySheetSet,
  sameGalleryPicture,
} from "./gallery-sheet-cut";

export type CleanableGalleryImage = {
  id: string;
  url: string;
  filePath: string;
  customKind?: string | null;
  hasCleanUpOriginal?: boolean;
};

/** Stickers and emoji in a selection: the only pictures the clean-up applies to. */
export function cleanableGalleryImages<T extends CleanableGalleryImage>(images: T[]): T[] {
  return images.filter((image) => image.customKind === "sticker" || image.customKind === "emoji");
}

async function readAsDataUrl(url: string): Promise<string> {
  // Gallery pictures are served under the API; read them through the client so auth and errors match the upload.
  const path = url.startsWith("/api/") ? url.slice("/api".length) : url;
  const response = await api.raw(path);
  if (!response.ok) throw new Error("The picture could not be loaded");
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
 * (the gallery's `/…/gallery/:imageId/replace` route for that image). A picture that can't be read, or
 * whose backdrop doesn't key out cleanly (a photo or gradient, not a cut-out), is left as it is and counted
 * as not cleaned. Returns how many were cleaned.
 */
export async function cleanUpGalleryImages(
  images: CleanableGalleryImage[],
  options: { replacePath: (imageId: string) => string; localizeUi: TFunction },
): Promise<number> {
  const { localizeUi } = options;
  const targets = cleanableGalleryImages(images);
  if (targets.length === 0) return 0;
  const read = await Promise.allSettled(
    targets.map(async (image) => {
      const original = await readAsDataUrl(image.url);
      const cleaned = await cleanUpSavedGalleryPiece(original);
      if (!cleaned) throw new Error("The backdrop did not key out cleanly");
      return { image, original, cleaned };
    }),
  );
  const ready = read.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  // Stickers picked together stand on one baseline; each emoji fills its own square.
  const stickers = ready.filter((entry) => entry.image.customKind === "sticker");
  const stickerImages = await fitGallerySheetSet(
    stickers.map((entry) => entry.cleaned),
    "sticker",
  );
  const fitted = new Map<CleanableGalleryImage, string>();
  stickers.forEach((entry, index) => fitted.set(entry.image, stickerImages[index]!));
  await Promise.all(
    ready
      .filter((entry) => entry.image.customKind === "emoji")
      .map(async (entry) => fitted.set(entry.image, await fitGallerySheetCell(entry.cleaned, "emoji"))),
  );
  // A picture the passes leave pixel for pixel as it was is already clean: it isn't saved again.
  const changed = await Promise.all(
    ready.map(async (entry) => !(await sameGalleryPicture(entry.original, fitted.get(entry.image)!))),
  );
  const toSave = ready.filter((_, index) => changed[index]);
  const alreadyClean = ready.length - toSave.length;
  const results = await Promise.allSettled(
    toSave.map(async ({ image }) => {
      const dataUrl = fitted.get(image)!;
      const { width, height } = await readImageDimensions(dataUrl);
      const stem = (image.filePath.split(/[\\/]/).pop() ?? "image").replace(/\.[^.]+$/, "");
      const form = new FormData();
      form.append("width", String(width));
      form.append("height", String(height));
      form.append("file", dataImageUrlToFile(dataUrl, `${stem}-clean`));
      await api.upload(options.replacePath(image.id), form);
    }),
  );
  const saved = results.filter((result) => result.status === "fulfilled").length;
  const completed = saved + alreadyClean;
  const failed = targets.length - completed;
  if (failed > 0)
    toast.error(localizeUi("ui.gallery.batch.cleanUpPartial", { completed, count: targets.length, failed }));
  else if (saved === 0) toast.success(localizeUi("ui.gallery.batch.alreadyClean", { count: targets.length }));
  else if (alreadyClean > 0)
    toast.success(localizeUi("ui.gallery.batch.cleanedUpSome", { completed: saved, count: targets.length }));
  else toast.success(localizeUi("ui.gallery.batch.cleanedUp", { count: targets.length }));
  return saved;
}

/** Selected pictures that Clean up changed before, whose earlier picture can be put back. */
export function restorableGalleryImages<T extends CleanableGalleryImage>(images: T[]): T[] {
  return images.filter((image) => image.hasCleanUpOriginal);
}

/**
 * "Undo clean up": put back the picture each image had before it was first cleaned up, through
 * `restorePath` (the gallery's `/…/gallery/:imageId/restore-original` route). Returns how many were put back.
 */
export async function restoreGalleryImages(
  images: CleanableGalleryImage[],
  options: { restorePath: (imageId: string) => string; localizeUi: TFunction },
): Promise<number> {
  const { localizeUi } = options;
  const targets = restorableGalleryImages(images);
  if (targets.length === 0) return 0;
  const results = await Promise.allSettled(targets.map((image) => api.post(options.restorePath(image.id))));
  const completed = results.filter((result) => result.status === "fulfilled").length;
  const failed = targets.length - completed;
  if (failed > 0)
    toast.error(localizeUi("ui.gallery.batch.undoCleanUpPartial", { completed, count: targets.length, failed }));
  else toast.success(localizeUi("ui.gallery.batch.cleanUpUndone", { count: targets.length }));
  return completed;
}
