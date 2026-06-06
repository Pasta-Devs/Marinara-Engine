import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import type { LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";
import { canReparentFolder, type FolderForest } from "../../lib/lorebook-folder-tree";

type ReorderEntriesInput = {
  lorebookId: string;
  entryIds: string[];
  folderId: string | null;
};

type ReorderFoldersInput = {
  lorebookId: string;
  folderIds: string[];
  /** The listed folders adopt this parent; null moves them to root. */
  parentFolderId: string | null;
};

/** Folder row drop zone relative to the hovered folder. */
export type FolderDropZone = "before" | "inside" | "after";
export type FolderDropTarget = { id: string; zone: FolderDropZone };

export function useLorebookEditorDragDrop({
  lorebookId,
  entries,
  folders,
  folderForest,
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
  folderForest: FolderForest<LorebookFolder>;
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
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const folderDragReadyRef = useRef<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<FolderDropTarget | null>(null);
  const [folderRootDropActive, setFolderRootDropActive] = useState(false);
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
    setDraggingFolderId(null);
    folderDragReadyRef.current = null;
    setFolderDropTarget(null);
    setFolderRootDropActive(false);
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
          /* mutation errors surface through React Query */
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
        /* mutation errors surface through React Query */
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
    (folderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || folderDragReadyRef.current !== folderId) {
        event.preventDefault();
        return;
      }
      setDraggingFolderId(folderId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", folderId);
    },
    [canReorderFolders],
  );

  // Header hover chooses before/inside/after; each zone validates its resulting parent.
  const handleFolderDragOverRow = useCallback(
    (targetFolderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderId === null) return;
      setFolderRootDropActive(false);
      if (draggingFolderId === targetFolderId) {
        setFolderDropTarget(null);
        return;
      }
      const target = folders.find((folder) => folder.id === targetFolderId);
      if (!target) {
        setFolderDropTarget(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = event.clientY - rect.top;
      const zone: FolderDropZone =
        offset < rect.height * 0.28 ? "before" : offset > rect.height * 0.72 ? "after" : "inside";
      const newParentId = zone === "inside" ? targetFolderId : target.parentFolderId;
      if (!canReparentFolder(folders, draggingFolderId, newParentId).ok) {
        setFolderDropTarget(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFolderDropTarget({ id: targetFolderId, zone });
    },
    [canReorderFolders, draggingFolderId, folders],
  );

  // Body hover nests into the hovered folder.
  const handleFolderBodyNestDragOver = useCallback(
    (targetFolderId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderId === null) return;
      setFolderRootDropActive(false);
      if (draggingFolderId === targetFolderId) {
        setFolderDropTarget(null);
        return;
      }
      if (!canReparentFolder(folders, draggingFolderId, targetFolderId).ok) {
        setFolderDropTarget(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFolderDropTarget({ id: targetFolderId, zone: "inside" });
    },
    [canReorderFolders, draggingFolderId, folders],
  );

  // Open root area un-nests the folder to top level.
  const handleRootFolderDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderId === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFolderRootDropActive(true);
      setFolderDropTarget(null);
    },
    [canReorderFolders, draggingFolderId],
  );

  const commitFolderDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const draggedId = draggingFolderId;
      const drop = folderDropTarget;
      const toRoot = folderRootDropActive;
      resetFolderDragState();
      if (!lorebookId || !canReorderFolders || !draggedId) return;

      if (!drop) {
        // Root drop appends the folder at top level.
        if (!toRoot) return;
        const rootIds = folderForest.roots.map((folder) => folder.id).filter((id) => id !== draggedId);
        rootIds.push(draggedId);
        onReorderFolders({ lorebookId, folderIds: rootIds, parentFolderId: null });
        return;
      }

      const target = folders.find((folder) => folder.id === drop.id);
      if (!target) return;

      if (drop.zone === "inside") {
        if (!canReparentFolder(folders, draggedId, drop.id).ok) return;
        // Nest drops append to the target's child list.
        const childIds = (folderForest.childrenByParent.get(drop.id) ?? [])
          .map((child) => child.id)
          .filter((id) => id !== draggedId);
        childIds.push(draggedId);
        onReorderFolders({ lorebookId, folderIds: childIds, parentFolderId: drop.id });
        return;
      }

      // Before/after drops join the target's sibling group.
      const newParentId = target.parentFolderId;
      if (!canReparentFolder(folders, draggedId, newParentId).ok) return;
      const siblings =
        (newParentId === null ? folderForest.roots : folderForest.childrenByParent.get(newParentId)) ?? [];
      const orderedIds = siblings.map((folder) => folder.id).filter((id) => id !== draggedId);
      const targetIndex = orderedIds.indexOf(drop.id);
      if (targetIndex === -1) orderedIds.push(draggedId);
      else orderedIds.splice(drop.zone === "before" ? targetIndex : targetIndex + 1, 0, draggedId);
      onReorderFolders({ lorebookId, folderIds: orderedIds, parentFolderId: newParentId });
    },
    [
      canReorderFolders,
      draggingFolderId,
      folderDropTarget,
      folderRootDropActive,
      folderForest,
      folders,
      lorebookId,
      onReorderFolders,
      resetFolderDragState,
    ],
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
    draggingFolderId,
    folderDragReadyRef,
    folderDropTarget,
    folderRootDropActive,
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
    handleFolderDragOverRow,
    handleFolderBodyNestDragOver,
    handleRootFolderDragOver,
    commitFolderDrop,
  };
}
