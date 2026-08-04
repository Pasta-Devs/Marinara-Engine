import { useCallback, useEffect, useMemo, useState } from "react";

export function useLibrarySelection(visibleIds: string[], queryKey?: string) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [queryKey]);

  const enterSelectionMode = useCallback(() => setSelectionMode(true), []);
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const shouldDeselect = visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
      for (const id of visibleIdSet) {
        if (shouldDeselect) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [visibleIdSet, visibleIds]);

  return {
    selectionMode,
    selectedIds,
    allVisibleSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelected,
    toggleAllVisible,
    setSelectedIds,
  };
}
