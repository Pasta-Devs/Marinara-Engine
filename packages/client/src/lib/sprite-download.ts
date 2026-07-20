import { toast } from "sonner";
import { saveBlobToDevice } from "./file-download";

export type DownloadableSprite = {
  url: string;
  filename?: string | null;
  expression: string;
};

/** Fetch and save one sprite while reporting any failure through the shared app toast. */
export async function downloadSpriteFile(sprite: DownloadableSprite): Promise<void> {
  try {
    const response = await fetch(sprite.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${sprite.expression}`);
    }

    await saveBlobToDevice(await response.blob(), sprite.filename || `${sprite.expression}.png`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to download sprite.");
  }
}
