import { useCallback, useState } from "react";
import { toast } from "sonner";

import { exportApi } from "../../../../shared/api/export-api";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import type { ExportFormatChoice } from "../../../../shared/components/ui/ExportFormatDialog";
import type { ParsedCharacterRow } from "../lib/characters-panel-model";

export function useCharactersPanelSelection({
  sortedCharacters,
  deleteCharacter,
}: {
  sortedCharacters: ParsedCharacterRow[];
  deleteCharacter: { mutateAsync: (id: string) => Promise<unknown> };
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedCharacterIds(new Set());
  }, []);

  const toggleSelection = useCallback((characterId: string) => {
    setSelectedCharacterIds((prev) => {
      const next = new Set(prev);
      if (next.has(characterId)) next.delete(characterId);
      else next.add(characterId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCharacterIds(new Set());
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedCharacterIds(new Set(sortedCharacters.map((character) => character.id)));
  }, [sortedCharacters]);

  const handleExportSelected = useCallback(
    async (format: ExportFormatChoice) => {
      if (selectedCharacterIds.size === 0) return;
      setExportingSelected(true);
      setExportDialogOpen(false);
      try {
        exportApi.triggerDownload(await exportApi.charactersBulk([...selectedCharacterIds], format));
        toast.success(`Exported ${selectedCharacterIds.size} character${selectedCharacterIds.size === 1 ? "" : "s"}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to export characters");
      } finally {
        setExportingSelected(false);
      }
    },
    [selectedCharacterIds],
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedCharacterIds];
    if (ids.length === 0) return;

    if (
      !(await showConfirmDialog({
        title: "Delete Characters",
        message: `Delete ${ids.length} character${ids.length === 1 ? "" : "s"}?`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deleteCharacter.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} character${deletedCount === 1 ? "" : "s"}`);
    }

    if (failedIds.length > 0) {
      setSelectedCharacterIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} character${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [selectedCharacterIds, deleteCharacter, exitSelectionMode]);

  return {
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    exportDialogOpen,
    exportingSelected,
    handleDeleteSelected,
    handleExportSelected,
    selectAllVisible,
    selectedCharacterIds,
    selectionMode,
    setExportDialogOpen,
    toggleSelection,
  };
}
