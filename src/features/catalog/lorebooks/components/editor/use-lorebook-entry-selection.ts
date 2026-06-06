import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Lorebook, LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { collectHiddenFolderIds } from "../../lib/lorebook-folder-tree";

type TransferOperation = "copy" | "move";

type TransferEntries = (input: {
  sourceLorebookId: string;
  targetLorebookId: string;
  entryIds: string[];
  operation: TransferOperation;
}) => Promise<{ transferred: number }>;

type UnvectorizeEntries = (input: { lorebookId: string; entryIds: string[] }) => Promise<{ cleared: number }>;

export function useLorebookEntrySelection({
  lorebookId,
  lorebooks,
  entries,
  filteredEntries,
  folders,
  showFolderGrouping,
  collapsedFolderIds,
  onTransferEntries,
  onUnvectorizeEntries,
}: {
  lorebookId: string | null;
  lorebooks: Lorebook[];
  entries: LorebookEntry[];
  filteredEntries: LorebookEntry[];
  folders: LorebookFolder[];
  showFolderGrouping: boolean;
  collapsedFolderIds: Set<string>;
  onTransferEntries: TransferEntries;
  onUnvectorizeEntries: UnvectorizeEntries;
}) {
  const [entrySelectionMode, setEntrySelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [entryTransferTargetId, setEntryTransferTargetId] = useState("");

  const transferTargetLorebooks = useMemo(
    () => lorebooks.filter((book) => book.id !== lorebookId).sort((a, b) => a.name.localeCompare(b.name)),
    [lorebooks, lorebookId],
  );
  // Collapsing a folder hides its whole subtree, so an entry is "visible" only
  // when neither its folder nor any ancestor is collapsed — not just its direct
  // folder. Otherwise "select all visible" would grab entries the user can't see.
  const hiddenFolderIds = useMemo(
    () => collectHiddenFolderIds(folders, collapsedFolderIds),
    [folders, collapsedFolderIds],
  );
  const visibleEntryIds = useMemo(
    () =>
      (showFolderGrouping
        ? entries.filter((entry) => !entry.folderId || !hiddenFolderIds.has(entry.folderId))
        : filteredEntries
      ).map((entry) => entry.id),
    [hiddenFolderIds, entries, filteredEntries, showFolderGrouping],
  );

  useEffect(() => {
    setEntrySelectionMode(false);
    setSelectedEntryIds(new Set());
  }, [lorebookId]);

  useEffect(() => {
    if (entryTransferTargetId && transferTargetLorebooks.some((book) => book.id === entryTransferTargetId)) return;
    setEntryTransferTargetId(transferTargetLorebooks[0]?.id ?? "");
  }, [entryTransferTargetId, transferTargetLorebooks]);

  useEffect(() => {
    const validEntryIds = new Set(entries.map((entry) => entry.id));
    setSelectedEntryIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validEntryIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

  const exitEntrySelectionMode = useCallback(() => {
    setEntrySelectionMode(false);
    setSelectedEntryIds(new Set());
  }, []);

  const toggleEntrySelectionMode = useCallback(() => {
    setEntrySelectionMode((current) => {
      if (current) setSelectedEntryIds(new Set());
      return !current;
    });
  }, []);

  const selectAllVisibleEntries = useCallback(() => {
    setSelectedEntryIds(new Set(visibleEntryIds));
  }, [visibleEntryIds]);

  const clearEntrySelection = useCallback(() => {
    setSelectedEntryIds(new Set());
  }, []);

  const toggleEntrySelection = useCallback((entryId: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const transferSelectedEntries = useCallback(
    async (operation: TransferOperation) => {
      if (!lorebookId || !entryTransferTargetId || selectedEntryIds.size === 0) return;
      const targetLorebookName =
        transferTargetLorebooks.find((book) => book.id === entryTransferTargetId)?.name ?? "the selected lorebook";

      if (
        operation === "move" &&
        !(await showConfirmDialog({
          title: "Move Lorebook Entries",
          message: `Move ${selectedEntryIds.size} selected ${
            selectedEntryIds.size === 1 ? "entry" : "entries"
          } to "${targetLorebookName}"? They will be removed from this lorebook.`,
          confirmLabel: "Move",
        }))
      ) {
        return;
      }

      try {
        const result = await onTransferEntries({
          sourceLorebookId: lorebookId,
          targetLorebookId: entryTransferTargetId,
          entryIds: Array.from(selectedEntryIds),
          operation,
        });
        toast.success(
          `${operation === "move" ? "Moved" : "Copied"} ${result.transferred} ${
            result.transferred === 1 ? "entry" : "entries"
          } to "${targetLorebookName}".`,
        );
        exitEntrySelectionMode();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to ${operation} entries.`);
      }
    },
    [
      entryTransferTargetId,
      exitEntrySelectionMode,
      lorebookId,
      onTransferEntries,
      selectedEntryIds,
      transferTargetLorebooks,
    ],
  );

  const unvectorizeSelectedEntries = useCallback(async () => {
    if (!lorebookId || selectedEntryIds.size === 0) return;
    const selectedIds = Array.from(selectedEntryIds);
    const vectorizedSelectedCount = entries.filter(
      (entry) => selectedEntryIds.has(entry.id) && Array.isArray(entry.embedding) && entry.embedding.length > 0,
    ).length;
    if (vectorizedSelectedCount === 0) {
      toast.info("No selected entries are vectorized.");
      return;
    }
    if (
      !(await showConfirmDialog({
        title: "Unvectorize Entries",
        message: `Clear stored embeddings for ${vectorizedSelectedCount} selected ${
          vectorizedSelectedCount === 1 ? "entry" : "entries"
        }? Keyword and regex matching will keep working.`,
        confirmLabel: "Unvectorize",
      }))
    ) {
      return;
    }
    try {
      const result = await onUnvectorizeEntries({ lorebookId, entryIds: selectedIds });
      toast.success(`Cleared embeddings for ${result.cleared} ${result.cleared === 1 ? "entry" : "entries"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear embeddings.");
    }
  }, [entries, lorebookId, onUnvectorizeEntries, selectedEntryIds]);

  return {
    entrySelectionMode,
    selectedEntryIds,
    visibleEntryIds,
    transferTargetLorebooks,
    entryTransferTargetId,
    setEntryTransferTargetId,
    toggleEntrySelectionMode,
    selectAllVisibleEntries,
    clearEntrySelection,
    exitEntrySelectionMode,
    toggleEntrySelection,
    transferSelectedEntries,
    unvectorizeSelectedEntries,
  };
}
