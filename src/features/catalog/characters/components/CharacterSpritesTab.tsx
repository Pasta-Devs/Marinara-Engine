import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  spriteKeys,
  type SpriteInfo,
  useCleanupSavedSprites,
  useDeleteSprite,
  useRestoreSpriteCleanupPoint,
  useSpriteCapabilities,
  useSprites,
} from "../../sprites/index";
import { SpriteGenerationModal } from "../../../../shared/components/ui/SpriteGenerationModal";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import { downloadBlob, loadUrlBlob } from "../../../../shared/lib/url-blob";
import {
  DEFAULT_EXPRESSIONS,
  displaySpriteExpressionForCategory,
  type CharacterSpriteImageConnection,
  type SpriteCategory,
} from "../lib/character-sprites-model";
import { useCharacterSpriteUploads } from "../hooks/use-character-sprite-uploads";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";
import { CharacterSpriteDeleteDialog } from "./CharacterSpriteDeleteDialog";
import { CharacterSpriteEditors } from "./CharacterSpriteEditors";
import { CharacterSpriteGrid } from "./CharacterSpriteGrid";
import { CharacterSpriteInfoCard } from "./CharacterSpriteInfoCard";
import { CharacterSpriteUploadPanel } from "./CharacterSpriteUploadPanel";

export function CharacterSpritesTab({
  characterId,
  defaultAppearance,
  defaultAvatarUrl,
  imageConnections,
}: {
  characterId: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
  imageConnections: CharacterSpriteImageConnection[];
}) {
  const { data: sprites, isLoading } = useSprites(characterId);
  const { data: spriteCapabilities } = useSpriteCapabilities();
  const deleteSprite = useDeleteSprite();
  const cleanupSavedSprites = useCleanupSavedSprites();
  const restoreSpriteCleanupPoint = useRestoreSpriteCleanupPoint();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SpriteCategory>("expressions");
  const [newExpression, setNewExpression] = useState("");
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
  const [spriteGenOpen, setSpriteGenOpen] = useState(false);
  const {
    fileInputRef,
    folderInputRef,
    folderProgress,
    handleFolderUpload,
    handleUpload,
    startUpload,
    uploading,
    uploadSprite,
  } = useCharacterSpriteUploads({
    characterId,
    category,
    newExpression,
    setNewExpression,
  });

  const allSprites = (sprites as SpriteInfo[] | undefined) ?? [];
  const portraitExpressionNames = allSprites
    .filter((s) => !s.expression.toLowerCase().startsWith("full_"))
    .map((s) => s.expression);
  const visibleSprites = allSprites.filter((s) =>
    category === "full-body" ? s.expression.startsWith("full_") : !s.expression.startsWith("full_"),
  );
  const existingExpressions = new Set(
    visibleSprites.map((s) => (category === "full-body" ? s.expression.replace(/^full_/, "") : s.expression)),
  );
  const suggestedExpressions = DEFAULT_EXPRESSIONS.filter((e) => !existingExpressions.has(e));
  const spriteGenerationUnavailable = spriteCapabilities?.spriteGenerationAvailable === false;
  const spriteGenerationReason = spriteCapabilities?.reason ?? "Sprite generation is unavailable on this platform.";
  const backgroundCleanupUnavailable = spriteCapabilities?.backgroundRemovalAvailable === false;
  const backgroundCleanupReason = spriteCapabilities?.reason ?? "Background cleanup is unavailable on this platform.";
  const cleanupEngineUnavailable = spriteCapabilities?.cleanupEngine?.installed === false;
  const cleanupEngineReason = spriteCapabilities?.cleanupEngine?.reason ?? "Sprite cleanup is not available.";

  const displayExpression = useCallback(
    (stored: string) => displaySpriteExpressionForCategory(stored, category),
    [category],
  );
  const getSpriteErrorMessage = useCallback(
    (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
    [],
  );

  const handleDeleteSingleSprite = useCallback(async () => {
    if (!deleteSpriteRequest) return;
    setDeletingSprites("single");
    try {
      await deleteSprite.mutateAsync({ characterId, expression: deleteSpriteRequest.expression });
      setDeleteSpriteRequest(null);
    } catch (error) {
      toast.error(getSpriteErrorMessage(error, "Failed to delete sprite."));
    } finally {
      setDeletingSprites(null);
    }
  }, [characterId, deleteSprite, deleteSpriteRequest, getSpriteErrorMessage]);

  const handleDeleteVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;
    setDeletingSprites("all");
    let deletedCount = 0;
    let failedCount = 0;
    try {
      for (const sprite of visibleSprites) {
        try {
          await deleteSprite.mutateAsync({ characterId, expression: sprite.expression });
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
  }, [characterId, deleteSprite, visibleSprites]);

  const downloadSpriteFile = useCallback(async (sprite: SpriteInfo) => {
    const blob = await loadUrlBlob(sprite.url, { errorMessage: `Failed to download ${sprite.expression}` });
    downloadBlob(blob, sprite.filename || `${sprite.expression}.png`);
  }, []);

  const handleExportSprites = useCallback(
    async (spritesToExport: SpriteInfo[], modeLabel: string) => {
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

        if (successCount > 0) {
          toast.success(
            modeLabel === "all"
              ? `Exported ${successCount} sprite${successCount === 1 ? "" : "s"}.`
              : `Exported ${successCount} ${category === "full-body" ? "full-body" : "expression"} sprite${successCount === 1 ? "" : "s"}.`,
          );
        } else {
          toast.error("No sprites were exported. Please try again.");
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
        characterId,
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
  }, [category, characterId, cleanupSavedSprites, savedCleanupStrength, visibleSprites]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupRestorePointId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupPoint.mutateAsync({
        characterId,
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
  }, [characterId, lastCleanupRestorePointId, restoreSpriteCleanupPoint]);

  const handleApplySpriteFrame = useCallback(
    async (croppedDataUrl: string) => {
      if (!framingSprite) return;

      setSavingFrame(true);
      try {
        await uploadSprite.mutateAsync({
          characterId,
          expression: framingSprite.expression,
          image: croppedDataUrl,
        });
        toast.success(`Framed ${displayExpression(framingSprite.expression)} sprite.`);
        setFramingSprite(null);
      } catch (error) {
        toast.error(getSpriteErrorMessage(error, "Failed to save framed sprite."));
      } finally {
        setSavingFrame(false);
      }
    },
    [characterId, displayExpression, framingSprite, getSpriteErrorMessage, uploadSprite],
  );

  const handleApplyWandCleanup = useCallback(
    async (cleanedDataUrl: string) => {
      if (!wandCleanupSprite) return;

      setSavingWandCleanup(true);
      try {
        await uploadSprite.mutateAsync({
          characterId,
          expression: wandCleanupSprite.expression,
          image: cleanedDataUrl,
        });
        toast.success(`Cleaned ${displayExpression(wandCleanupSprite.expression)} sprite.`);
        setWandCleanupSprite(null);
      } catch (error) {
        toast.error(getSpriteErrorMessage(error, "Failed to save cleaned sprite."));
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [characterId, displayExpression, getSpriteErrorMessage, uploadSprite, wandCleanupSprite],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Character Sprites"
        subtitle="Upload VN-style sprites for different expressions. The Expression Engine agent will select the appropriate sprite during roleplay."
      />

      <CharacterSpriteUploadPanel
        category={category}
        setCategory={setCategory}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        onUpload={handleUpload}
        onFolderUpload={handleFolderUpload}
        newExpression={newExpression}
        setNewExpression={setNewExpression}
        uploading={uploading}
        exporting={exporting}
        cleaningSprites={cleaningSprites}
        savedCleanupStrength={savedCleanupStrength}
        setSavedCleanupStrength={setSavedCleanupStrength}
        restoringCleanup={restoringCleanup}
        lastCleanupRestorePointId={lastCleanupRestorePointId}
        folderProgress={folderProgress}
        spriteGenerationUnavailable={spriteGenerationUnavailable}
        spriteGenerationReason={spriteGenerationReason}
        backgroundCleanupUnavailable={backgroundCleanupUnavailable}
        backgroundCleanupReason={backgroundCleanupReason}
        cleanupEngineUnavailable={cleanupEngineUnavailable}
        cleanupEngineReason={cleanupEngineReason}
        visibleSpritesCount={visibleSprites.length}
        allSpritesCount={allSprites.length}
        exportMenuOpen={exportMenuOpen}
        onToggleExportMenu={() => setExportMenuOpen((open) => !open)}
        onCloseExportMenu={() => setExportMenuOpen(false)}
        onGenerateSprite={() => setSpriteGenOpen(true)}
        onCleanVisible={() => void handleCleanVisibleSprites()}
        onExportVisible={() => void handleExportSprites(visibleSprites, "visible")}
        onExportAll={() => void handleExportSprites(allSprites, "all")}
        onRestoreLastCleanup={() => void handleRestoreLastCleanup()}
        startUpload={startUpload}
        suggestedExpressions={suggestedExpressions}
      />

      <CharacterSpriteEditors
        framingSprite={framingSprite}
        savingFrame={savingFrame}
        wandCleanupSprite={wandCleanupSprite}
        savingWandCleanup={savingWandCleanup}
        displayExpression={displayExpression}
        onApplyFrame={handleApplySpriteFrame}
        onCloseFrame={() => setFramingSprite(null)}
        onApplyWandCleanup={handleApplyWandCleanup}
        onCloseWandCleanup={() => setWandCleanupSprite(null)}
      />

      <CharacterSpriteGrid
        category={category}
        isLoading={isLoading}
        visibleSprites={visibleSprites}
        displayExpression={displayExpression}
        onOpenWandCleanup={setWandCleanupSprite}
        onFrame={setFramingSprite}
        onDownload={(sprite) => void downloadSpriteFile(sprite)}
        onReplace={startUpload}
        onDelete={setDeleteSpriteRequest}
      />

      <CharacterSpriteInfoCard />

      <CharacterSpriteDeleteDialog
        sprite={deleteSpriteRequest}
        visibleSpriteCount={visibleSprites.length}
        category={category}
        deletingSprites={deletingSprites}
        displayExpression={displayExpression}
        onClose={() => setDeleteSpriteRequest(null)}
        onDeleteVisible={() => void handleDeleteVisibleSprites()}
        onDeleteSingle={() => void handleDeleteSingleSprite()}
      />

      <SpriteGenerationModal
        open={spriteGenOpen}
        onClose={() => setSpriteGenOpen(false)}
        entityId={characterId}
        initialSpriteType={category === "full-body" ? "full-body" : "expressions"}
        existingExpressionNames={portraitExpressionNames}
        defaultAppearance={defaultAppearance}
        defaultAvatarUrl={defaultAvatarUrl}
        imageConnections={imageConnections}
        spriteCapabilities={spriteCapabilities}
        onSpritesGenerated={() => {
          queryClient.invalidateQueries({ queryKey: spriteKeys.list(characterId) });
        }}
      />
    </div>
  );
}
