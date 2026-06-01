import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import type { LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";

type ReorderEntriesInput = {
  lorebookId: string;
  entryIds: string[];
  folderId: string | null;
};

type ReorderFoldersInput = {
  lorebookId: string;
  folderIds: string[];
};

export function useLorebookEditorDragDrop({
  lorebookId,
  entries,
  folders,
  entriesByContainer,
  showFolderGrouping,
  reorderEntriesPending,
  reorderFoldersPending,
  onReorderEntries,
  onReorderFolders,
}: {
  lorebookId: string | null;
  entries: LorebookEntry[];
  folders: LorebookFolder[];
  entriesByContainer: Map<string | null, LorebookEntry[]>;
  showFolderGrouping: boolean;
  reorderEntriesPending: boolean;
  reorderFoldersPending: boolean;
  onReorderEntries: (input: ReorderEntriesInput) => Promise<unknown> | void;
  onReorderFolders: (input: ReorderFoldersInput) => void;
}) {
  const [draggingEntryIdx, setDraggingEntryIdx] = useState<number | null>(null);
  const entryDragReadyRef = useRef<number | null>(null);
  const [entryDropIdx, setEntryDropIdx] = useState<number | null>(null);
  const [dragSourceContainer, setDragSourceContainer] = useState<string | null | undefined>(undefined);
  const [dropTargetContainer, setDropTargetContainer] = useState<string | null | undefined>(undefined);
  const [draggingFolderIdx, setDraggingFolderIdx] = useState<number | null>(null);
  const folderDragReadyRef = useRef<number | null>(null);
  const [folderDropIdx, setFolderDropIdx] = useState<number | null>(null);
  const entryListRef = useRef<HTMLDivElement | null>(null);

  const canReorderEntries = showFolderGrouping && entries.length > 1 && !reorderEntriesPending;
  const canReorderFolders = showFolderGrouping && folders.length > 1 && !reorderFoldersPending;

  const resetEntryDragState = useCallback(() => {
    setDraggingEntryIdx(null);
    entryDragReadyRef.current = null;
    setEntryDropIdx(null);
    setDragSourceContainer(undefined);
    setDropTargetContainer(undefined);
  }, []);

  const resetFolderDragState = useCallback(() => {
    setDraggingFolderIdx(null);
    folderDragReadyRef.current = null;
    setFolderDropIdx(null);
  }, []);

  const calcEntryDropIdx = useCallback((cardIdx: number, event: ReactDragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return event.clientY < midY ? cardIdx : cardIdx + 1;
  }, []);

  const handleEntryDragStart = useCallback(
    (containerId: string | null, idxInContainer: number, entryId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || entryDragReadyRef.current !== idxInContainer) {
        event.preventDefault();
        return;
      }
      setDraggingEntryIdx(idxInContainer);
      setDragSourceContainer(containerId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", entryId);
    },
    [canReorderEntries],
  );

  const handleEntryDragOver = useCallback(
    (containerId: string | null, idxInContainer: number, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setEntryDropIdx(calcEntryDropIdx(idxInContainer, event));
      setDropTargetContainer(containerId);
    },
    [calcEntryDropIdx, canReorderEntries, draggingEntryIdx],
  );

  const handleFolderHeaderDragOver = useCallback(
    (folderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (draggingEntryIdx !== null) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTargetContainer(folderId);
        setEntryDropIdx(0);
      }
    },
    [draggingEntryIdx],
  );

  const handleFolderBodyDragOver = useCallback(
    (folderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetContainer(folderId);
      const containerEntries = entriesByContainer.get(folderId) ?? [];
      setEntryDropIdx(containerEntries.length);
    },
    [canReorderEntries, draggingEntryIdx, entriesByContainer],
  );

  const handleRootListDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const container = entryListRef.current;
      const rootEntries = entriesByContainer.get(null) ?? [];
      if (!container || rootEntries.length === 0) {
        setDropTargetContainer(null);
        setEntryDropIdx(rootEntries.length);
        return;
      }

      const firstCard = container.firstElementChild as HTMLElement | null;
      const lastCard = container.lastElementChild as HTMLElement | null;
      if (!firstCard || !lastCard) return;

      const firstRect = firstCard.getBoundingClientRect();
      if (event.clientY < firstRect.top) {
        setDropTargetContainer(null);
        setEntryDropIdx(0);
        return;
      }

      const lastRect = lastCard.getBoundingClientRect();
      if (event.clientY > lastRect.bottom) {
        setDropTargetContainer(null);
        setEntryDropIdx(rootEntries.length);
      }
    },
    [canReorderEntries, draggingEntryIdx, entriesByContainer],
  );

  const commitEntryDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sourceIdx = draggingEntryIdx;
      const targetIdx = entryDropIdx;
      const sourceContainer = dragSourceContainer;
      const targetContainer = dropTargetContainer;
      resetEntryDragState();
      if (
        !lorebookId ||
        !canReorderEntries ||
        sourceIdx === null ||
        targetIdx === null ||
        sourceContainer === undefined ||
        targetContainer === undefined
      ) {
        return;
      }

      const sourceList = (entriesByContainer.get(sourceContainer) ?? []).slice();
      const moved = sourceList[sourceIdx];
      if (!moved) return;

      if (sourceContainer === targetContainer) {
        let insertAt = targetIdx;
        if (sourceIdx < insertAt) insertAt--;
        if (sourceIdx === insertAt) return;
        const ids = sourceList.map((entry) => entry.id);
        ids.splice(sourceIdx, 1);
        ids.splice(insertAt, 0, moved.id);
        void Promise.resolve(onReorderEntries({ lorebookId, entryIds: ids, folderId: sourceContainer })).catch(() => {
          /* mutation surfaces errors through React Query */
        });
        return;
      }

      const sourceIds = sourceList.filter((_, idx) => idx !== sourceIdx).map((entry) => entry.id);
      const targetIds = (entriesByContainer.get(targetContainer) ?? []).map((entry) => entry.id);
      const insertAt = Math.max(0, Math.min(targetIdx, targetIds.length));
      targetIds.splice(insertAt, 0, moved.id);
      void (async () => {
        if (sourceIds.length > 0) {
          await onReorderEntries({ lorebookId, entryIds: sourceIds, folderId: sourceContainer });
        }
        await onReorderEntries({ lorebookId, entryIds: targetIds, folderId: targetContainer });
      })().catch(() => {
        /* mutation surfaces errors through React Query */
      });
    },
    [
      canReorderEntries,
      draggingEntryIdx,
      dragSourceContainer,
      dropTargetContainer,
      entriesByContainer,
      entryDropIdx,
      lorebookId,
      onReorderEntries,
      resetEntryDragState,
    ],
  );

  const handleFolderDragStart = useCallback(
    (idx: number, folderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || folderDragReadyRef.current !== idx) {
        event.preventDefault();
        return;
      }
      setDraggingFolderIdx(idx);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", folderId);
    },
    [canReorderFolders],
  );

  const handleFolderDragOverHeader = useCallback(
    (idx: number, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderIdx === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setFolderDropIdx(event.clientY < midY ? idx : idx + 1);
    },
    [canReorderFolders, draggingFolderIdx],
  );

  const commitFolderDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sourceIdx = draggingFolderIdx;
      const targetIdx = folderDropIdx;
      resetFolderDragState();
      if (!lorebookId || !canReorderFolders || sourceIdx === null || targetIdx === null) return;
      let insertAt = targetIdx;
      if (sourceIdx < insertAt) insertAt--;
      if (sourceIdx === insertAt) return;
      const ids = folders.map((folder) => folder.id);
      const [moved] = ids.splice(sourceIdx, 1);
      if (!moved) return;
      ids.splice(insertAt, 0, moved);
      onReorderFolders({ lorebookId, folderIds: ids });
    },
    [canReorderFolders, draggingFolderIdx, folderDropIdx, folders, lorebookId, onReorderFolders, resetFolderDragState],
  );

  return {
    canReorderEntries,
    canReorderFolders,
    draggingEntryIdx,
    entryDragReadyRef,
    entryDropIdx,
    dragSourceContainer,
    setDragSourceContainer,
    dropTargetContainer,
    draggingFolderIdx,
    folderDragReadyRef,
    folderDropIdx,
    entryListRef,
    resetEntryDragState,
    resetFolderDragState,
    handleEntryDragStart,
    handleEntryDragOver,
    handleFolderHeaderDragOver,
    handleFolderBodyDragOver,
    handleRootListDragOver,
    commitEntryDrop,
    handleFolderDragStart,
    handleFolderDragOverHeader,
    commitFolderDrop,
  };
}
