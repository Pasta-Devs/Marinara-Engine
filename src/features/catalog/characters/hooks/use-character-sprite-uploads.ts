import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useUploadSprite, useUploadSprites } from "../../sprites/index";
import { normalizeSpriteExpressionForCategory, type SpriteCategory } from "../lib/character-sprites-model";

const SPRITE_FOLDER_UPLOAD_BATCH_SIZE = 12;

type UseCharacterSpriteUploadsArgs = {
  characterId: string;
  category: SpriteCategory;
  newExpression: string;
  setNewExpression: (expression: string) => void;
};

export function useCharacterSpriteUploads({
  characterId,
  category,
  newExpression,
  setNewExpression,
}: UseCharacterSpriteUploadsArgs) {
  const uploadSprite = useUploadSprite();
  const uploadSprites = useUploadSprites();
  const [uploading, setUploading] = useState(false);
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingExpressionRef = useRef("");

  const normalizeExpressionForCategory = (raw: string, forCategory: SpriteCategory = category) => {
    return normalizeSpriteExpressionForCategory(raw, forCategory);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploading) {
      e.target.value = "";
      return;
    }
    const expression = pendingExpressionRef.current || normalizeExpressionForCategory(newExpression);
    if (!expression) {
      e.target.value = "";
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadSprite.mutateAsync({
          characterId,
          expression,
          image: reader.result as string,
        });
        setNewExpression("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload sprite.");
      } finally {
        pendingExpressionRef.current = "";
        setUploading(false);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read sprite image.");
      pendingExpressionRef.current = "";
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startUpload = (expression: string) => {
    if (!expression || uploading) return;
    pendingExpressionRef.current = expression;
    fileInputRef.current?.click();
  };

  const handleFolderUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (uploading) {
      e.target.value = "";
      return;
    }

    const imageFiles = Array.from(files).filter((f) => /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(f.name));
    if (imageFiles.length === 0) return;

    setFolderProgress({ done: 0, total: imageFiles.length });
    try {
      let uploads: Array<{ expression: string; image: string }> = [];
      let imported = 0;
      const failed: Array<{ expression: string; filename?: string; error: string }> = [];
      const folderCategory = category;
      let skipped = 0;
      const flushUploads = async () => {
        if (uploads.length === 0) return;
        const result = await uploadSprites.mutateAsync({ characterId, sprites: uploads });
        imported += result.imported;
        failed.push(...result.failed);
        uploads = [];
      };

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]!;
        const expression = file.name.replace(/\.[^.]+$/, "").trim();
        const normalized = normalizeExpressionForCategory(expression, folderCategory);
        if (!normalized) {
          skipped += 1;
          setFolderProgress({ done: i + 1, total: imageFiles.length });
          continue;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        }).catch(() => {
          skipped += 1;
          return null;
        });

        if (dataUrl) {
          uploads.push({ expression: normalized, image: dataUrl });
          if (uploads.length >= SPRITE_FOLDER_UPLOAD_BATCH_SIZE) {
            await flushUploads();
          }
        }
        setFolderProgress({ done: i + 1, total: imageFiles.length });
      }

      await flushUploads();

      if (imported > 0 || failed.length > 0) {
        if (failed.length > 0 || skipped > 0) {
          toast.warning(
            `${failed.length + skipped} sprite${failed.length + skipped === 1 ? "" : "s"} could not be imported.`,
          );
        } else {
          toast.success(`Imported ${imported} sprite${imported === 1 ? "" : "s"}.`);
        }
      } else if (skipped > 0) {
        toast.error("No sprites could be imported.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import sprites.");
    } finally {
      setFolderProgress(null);
      e.target.value = "";
    }
  };

  return {
    fileInputRef,
    folderInputRef,
    folderProgress,
    handleFolderUpload,
    handleUpload,
    startUpload,
    uploadSprite,
    uploading,
  };
}
