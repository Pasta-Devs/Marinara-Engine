import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SpriteGenerationModal } from "../../../../../shared/components/ui/SpriteGenerationModal";
import { showAlertDialog, showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { cn } from "../../../../../shared/lib/utils";
import { downloadBlob, loadUrlBlob } from "../../../../../shared/lib/url-blob";
import {
  spriteKeys,
  type SpriteInfo,
  useCleanupSavedSprites,
  useDeleteSprite,
  usePersonaSprites,
  useRestoreSpriteCleanupPoint,
  useSpriteCapabilities,
  useUploadSprite,
  useUploadSprites,
} from "../../../sprites/index";
import {
  displaySpriteExpression,
  getExistingSpriteExpressions,
  getPortraitExpressionNames,
  getSuggestedSpriteExpressions,
  getVisibleSprites,
  normalizeSpriteExpression,
  type PersonaSpriteCategory,
} from "../../lib/persona-sprites-model";
import { PersonaSpriteDeleteDialog } from "./PersonaSpriteDeleteDialog";
import { PersonaSpriteEditors } from "./PersonaSpriteEditors";
import { PersonaSpriteGrid } from "./PersonaSpriteGrid";
import { PersonaSpriteUploadPanel } from "./PersonaSpriteUploadPanel";

// ── Persona Sprites Tab ──

export function PersonaSpritesTab({
  personaId,
  defaultAppearance,
  defaultAvatarUrl,
  imageConnections,
}: {
  personaId: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
  imageConnections: Array<{ id: string; name: string; model?: string | null; provider?: string | null }>;
}) {
  const { data: sprites, isLoading } = usePersonaSprites(personaId);
  const { data: spriteCapabilities } = useSpriteCapabilities();
  const uploadSprite = useUploadSprite();
  const uploadSprites = useUploadSprites();
  const deleteSprite = useDeleteSprite();
  const cleanupSavedSprites = useCleanupSavedSprites();
  const restoreSpriteCleanupPoint = useRestoreSpriteCleanupPoint();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<PersonaSpriteCategory>("expressions");
  const [newExpression, setNewExpression] = useState("");
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleaningSprites, setCleaningSprites] = useState(false);
  const [savedCleanupStrength, setSavedCleanupStrength] = useState(35);
  const [restoringCleanup, setRestoringCleanup] = useState(false);
  const [lastCleanupRestorePointId, setLastCleanupRestorePointId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [framingSprite, setFramingSprite] = useState<SpriteInfo | null>(null);
  const [savingFrame, setSavingFrame] = useState(false);
  const [wandCleanupSprite, setWandCleanupSprite] = useState<SpriteInfo | null>(null);
  const [savingWandCleanup, setSavingWandCleanup] = useState(false);
  const [deleteSpriteRequest, setDeleteSpriteRequest] = useState<SpriteInfo | null>(null);
  const [deletingSprites, setDeletingSprites] = useState<"single" | "all" | null>(null);
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null);
  const [spriteGenOpen, setSpriteGenOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingExpressionRef = useRef("");

  const allSprites = (sprites as SpriteInfo[] | undefined) ?? [];
  const portraitExpressionNames = getPortraitExpressionNames(allSprites);
  const visibleSprites = getVisibleSprites(allSprites, category);
  const existingExpressions = getExistingSpriteExpressions(visibleSprites, category);
  const suggestedExpressions = getSuggestedSpriteExpressions(existingExpressions);
  const spriteGenerationUnavailable = spriteCapabilities?.spriteGenerationAvailable === false;
  const spriteGenerationReason = spriteCapabilities?.reason ?? "Sprite generation is unavailable on this platform.";
  const backgroundCleanupUnavailable = spriteCapabilities?.backgroundRemovalAvailable === false;
  const backgroundCleanupReason = spriteCapabilities?.reason ?? "Background cleanup is unavailable on this platform.";
  const cleanupEngineUnavailable = spriteCapabilities?.cleanupEngine?.installed === false;
  const cleanupEngineReason = spriteCapabilities?.cleanupEngine?.reason ?? "Sprite cleanup is not available.";

  const displayExpression = useCallback((stored: string) => displaySpriteExpression(stored, category), [category]);
  const getErrorMessage = useCallback(
    (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
    [],
  );

  const startUpload = useCallback((expression: string) => {
    if (!expression) return;
    pendingExpressionRef.current = expression;
    fileInputRef.current?.click();
  }, []);

  const startUploadForCategory = useCallback(
    (expression: string) => {
      startUpload(normalizeSpriteExpression(expression, category));
    },
    [category, startUpload],
  );

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const expression = pendingExpressionRef.current || normalizeSpriteExpression(newExpression, category);
    if (!expression) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadSprite.mutateAsync({
          spriteOwnerId: personaId,
          ownerType: "persona",
          expression,
          image: reader.result as string,
        });
        setNewExpression("");
        pendingExpressionRef.current = "";
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to upload sprite."));
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read sprite image.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleFolderUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(file.name));
    if (imageFiles.length === 0) return;

    setFolderProgress({ done: 0, total: imageFiles.length });
    try {
      const uploads: Array<{ expression: string; image: string }> = [];
      const folderCategory = category;
      let skipped = 0;
      for (let index = 0; index < imageFiles.length; index++) {
        const file = imageFiles[index]!;
        const expression = file.name.replace(/\.[^.]+$/, "").trim();
        const normalized = normalizeSpriteExpression(expression, folderCategory);
        if (!normalized) {
          skipped += 1;
          setFolderProgress({ done: index + 1, total: imageFiles.length });
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
        }
        setFolderProgress({ done: index + 1, total: imageFiles.length });
      }
      if (uploads.length > 0) {
        const result = await uploadSprites.mutateAsync({
          spriteOwnerId: personaId,
          ownerType: "persona",
          sprites: uploads,
        });
        if (result.failed.length > 0 || skipped > 0) {
          toast.warning(
            `${result.failed.length + skipped} sprite${result.failed.length + skipped === 1 ? "" : "s"} could not be imported.`,
          );
        } else {
          toast.success(`Imported ${result.imported} sprite${result.imported === 1 ? "" : "s"}.`);
        }
      } else if (skipped > 0) {
        toast.error("No sprites could be imported.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import sprites.");
    } finally {
      setFolderProgress(null);
      event.target.value = "";
    }
  };

  const handleDeleteSingleSprite = useCallback(async () => {
    if (!deleteSpriteRequest) return;
    setDeletingSprites("single");
    try {
      await deleteSprite.mutateAsync({
        spriteOwnerId: personaId,
        ownerType: "persona",
        expression: deleteSpriteRequest.expression,
      });
      setDeleteSpriteRequest(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete sprite."));
    } finally {
      setDeletingSprites(null);
    }
  }, [deleteSprite, deleteSpriteRequest, getErrorMessage, personaId]);

  const handleDeleteVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;
    setDeletingSprites("all");
    let deletedCount = 0;
    let failedCount = 0;
    try {
      for (const sprite of visibleSprites) {
        try {
          await deleteSprite.mutateAsync({
            spriteOwnerId: personaId,
            ownerType: "persona",
            expression: sprite.expression,
          });
          deletedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      if (failedCount > 0) {
        toast.warning(
          `Deleted ${deletedCount} sprite${deletedCount === 1 ? "" : "s"}; ${failedCount} failed to delete.`,
        );
      } else {
        toast.success(`Deleted ${deletedCount} sprite${deletedCount === 1 ? "" : "s"}.`);
      }
      if (deletedCount > 0 || failedCount === 0) setDeleteSpriteRequest(null);
    } finally {
      setDeletingSprites(null);
    }
  }, [deleteSprite, personaId, visibleSprites]);

  const downloadSpriteFile = useCallback(async (sprite: SpriteInfo) => {
    const blob = await loadUrlBlob(sprite.url, { errorMessage: `Failed to download ${sprite.expression}` });
    downloadBlob(blob, sprite.filename || `${sprite.expression}.png`);
  }, []);

  const handleDownloadSprite = useCallback(
    async (sprite: SpriteInfo) => {
      try {
        await downloadSpriteFile(sprite);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to download sprite."));
      }
    },
    [downloadSpriteFile, getErrorMessage],
  );

  const handleExportSprites = useCallback(
    async (spritesToExport: SpriteInfo[], modeLabel: "visible" | "all") => {
      if (spritesToExport.length === 0) return;

      setExporting(true);
      let successCount = 0;

      try {
        for (const sprite of spritesToExport) {
          try {
            await downloadSpriteFile(sprite);
            successCount += 1;
          } catch {
            // Continue exporting remaining sprites.
          }
        }

        if (successCount === 0) {
          await showAlertDialog({
            title: "Export Failed",
            message: "No sprites were exported. Please try again.",
            tone: "destructive",
          });
        } else {
          toast.success(
            modeLabel === "all"
              ? `Exported ${successCount} sprite${successCount === 1 ? "" : "s"}.`
              : `Exported ${successCount} ${category === "full-body" ? "full-body" : "expression"} sprite${successCount === 1 ? "" : "s"}.`,
          );
        }
      } finally {
        setExporting(false);
      }
    },
    [category, downloadSpriteFile],
  );

  const handleCleanVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;

    const modeLabel = category === "full-body" ? "full-body" : "expression";
    if (
      !(await showConfirmDialog({
        title: "Clean Sprite Backgrounds",
        message: `Run background cleanup on ${visibleSprites.length} saved ${modeLabel} sprite${visibleSprites.length === 1 ? "" : "s"} at strength ${savedCleanupStrength}? Marinara will keep a restore point in case the cleanup looks wrong.`,
        confirmLabel: "Clean",
      }))
    ) {
      return;
    }

    setCleaningSprites(true);
    try {
      const result = await cleanupSavedSprites.mutateAsync({
        spriteOwnerId: personaId,
        ownerType: "persona",
        expressions: visibleSprites.map((sprite) => sprite.expression),
        cleanupStrength: savedCleanupStrength,
        engine: "auto",
      });

      if (result.processed > 0) {
        setLastCleanupRestorePointId(result.restorePointId ?? null);
        toast.success(`Cleaned ${result.processed} saved sprite${result.processed === 1 ? "" : "s"} .`);
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} sprite${result.failed.length === 1 ? "" : "s"} could not be cleaned.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to clean saved sprites.");
    } finally {
      setCleaningSprites(false);
    }
  }, [category, cleanupSavedSprites, personaId, savedCleanupStrength, visibleSprites]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupRestorePointId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupPoint.mutateAsync({
        spriteOwnerId: personaId,
        ownerType: "persona",
        restorePointId: lastCleanupRestorePointId,
      });
      if (result.restored > 0) {
        toast.success(
          `Restored ${result.restored} sprite${result.restored === 1 ? "" : "s"} from the cleanup restore point.`,
        );
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} sprite${result.failed.length === 1 ? "" : "s"} could not be restored.`);
      } else {
        setLastCleanupRestorePointId(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore sprite cleanup point.");
    } finally {
      setRestoringCleanup(false);
    }
  }, [lastCleanupRestorePointId, personaId, restoreSpriteCleanupPoint]);

  const handleApplySpriteFrame = useCallback(
    async (croppedDataUrl: string) => {
      if (!framingSprite) return;

      setSavingFrame(true);
      try {
        await uploadSprite.mutateAsync({
          spriteOwnerId: personaId,
          ownerType: "persona",
          expression: framingSprite.expression,
          image: croppedDataUrl,
        });
        toast.success(`Framed ${displayExpression(framingSprite.expression)} sprite.`);
        setFramingSprite(null);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to save framed sprite."));
      } finally {
        setSavingFrame(false);
      }
    },
    [displayExpression, framingSprite, getErrorMessage, personaId, uploadSprite],
  );

  const handleApplyWandCleanup = useCallback(
    async (cleanedDataUrl: string) => {
      if (!wandCleanupSprite) return;

      setSavingWandCleanup(true);
      try {
        await uploadSprite.mutateAsync({
          spriteOwnerId: personaId,
          ownerType: "persona",
          expression: wandCleanupSprite.expression,
          image: cleanedDataUrl,
        });
        toast.success(`Cleaned ${displayExpression(wandCleanupSprite.expression)} sprite.`);
        setWandCleanupSprite(null);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to save cleaned sprite."));
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [displayExpression, getErrorMessage, personaId, uploadSprite, wandCleanupSprite],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Persona Sprites</h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          Upload VN-style sprites for your persona. These are used in Game Mode and roleplay with the Expression Engine.
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]">
        <button
          type="button"
          onClick={() => setCategory("expressions")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            category === "expressions"
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          Facial Expressions
        </button>
        <button
          type="button"
          onClick={() => setCategory("full-body")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            category === "full-body"
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          Full-body
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderUpload}
      />

      <PersonaSpriteUploadPanel
        category={category}
        newExpression={newExpression}
        suggestedExpressions={suggestedExpressions}
        allSpritesCount={allSprites.length}
        visibleSpritesCount={visibleSprites.length}
        uploading={uploading}
        exporting={exporting}
        exportMenuOpen={exportMenuOpen}
        cleaningSprites={cleaningSprites}
        savedCleanupStrength={savedCleanupStrength}
        folderProgress={folderProgress}
        lastCleanupRestorePointId={lastCleanupRestorePointId}
        restoringCleanup={restoringCleanup}
        spriteGenerationUnavailable={spriteGenerationUnavailable}
        spriteGenerationReason={spriteGenerationReason}
        backgroundCleanupUnavailable={backgroundCleanupUnavailable}
        backgroundCleanupReason={backgroundCleanupReason}
        cleanupEngineUnavailable={cleanupEngineUnavailable}
        cleanupEngineReason={cleanupEngineReason}
        onOpenGeneration={() => setSpriteGenOpen(true)}
        onOpenFolderUpload={() => folderInputRef.current?.click()}
        onCleanVisibleSprites={() => void handleCleanVisibleSprites()}
        onToggleExportMenu={() => setExportMenuOpen((open) => !open)}
        onExportVisible={() => {
          setExportMenuOpen(false);
          void handleExportSprites(visibleSprites, "visible");
        }}
        onExportAll={() => {
          setExportMenuOpen(false);
          void handleExportSprites(allSprites, "all");
        }}
        onCleanupStrengthChange={setSavedCleanupStrength}
        onRestoreLastCleanup={() => void handleRestoreLastCleanup()}
        onNewExpressionChange={setNewExpression}
        onStartUpload={startUploadForCategory}
      />

      <PersonaSpriteEditors
        framingSprite={framingSprite}
        savingFrame={savingFrame}
        wandCleanupSprite={wandCleanupSprite}
        savingWandCleanup={savingWandCleanup}
        displayExpression={displayExpression}
        onApplySpriteFrame={handleApplySpriteFrame}
        onCloseFrame={() => setFramingSprite(null)}
        onApplyWandCleanup={handleApplyWandCleanup}
        onCloseWandCleanup={() => setWandCleanupSprite(null)}
      />

      <PersonaSpriteGrid
        category={category}
        isLoading={isLoading}
        visibleSprites={visibleSprites}
        displayExpression={displayExpression}
        onOpenWandCleanup={setWandCleanupSprite}
        onOpenFrame={setFramingSprite}
        onDownload={(sprite) => void handleDownloadSprite(sprite)}
        onReplace={(sprite) => startUpload(sprite.expression)}
        onDelete={setDeleteSpriteRequest}
      />

      <PersonaSpriteDeleteDialog
        category={category}
        deleteSpriteRequest={deleteSpriteRequest}
        deletingSprites={deletingSprites}
        visibleSpriteCount={visibleSprites.length}
        displayExpression={displayExpression}
        onClose={() => setDeleteSpriteRequest(null)}
        onDeleteVisibleSprites={() => void handleDeleteVisibleSprites()}
        onDeleteSingleSprite={() => void handleDeleteSingleSprite()}
      />

      <SpriteGenerationModal
        open={spriteGenOpen}
        onClose={() => setSpriteGenOpen(false)}
        entityId={personaId}
        entityKind="persona"
        initialSpriteType={category === "full-body" ? "full-body" : "expressions"}
        existingExpressionNames={portraitExpressionNames}
        defaultAppearance={defaultAppearance}
        defaultAvatarUrl={defaultAvatarUrl}
        imageConnections={imageConnections}
        spriteCapabilities={spriteCapabilities}
        onSpritesGenerated={() => {
          queryClient.invalidateQueries({ queryKey: spriteKeys.list(personaId, "persona") });
        }}
      />
    </div>
  );
}
