import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import {
  collectCharacterTags,
  getCharacterTags,
  type FavoriteFilter,
  type ParsedCharacterRow,
} from "../lib/characters-panel-model";
import { useUpdateCharacter } from "./use-characters";

export function useCharactersPanelFilters(parsedCharacters: ParsedCharacterRow[]) {
  const updateCharacter = useUpdateCharacter();
  const [includedTags, setIncludedTags] = useState<Set<string>>(new Set());
  const [excludedTags, setExcludedTags] = useState<Set<string>>(new Set());
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [favFilter, setFavFilter] = useState<FavoriteFilter>("all");

  const allTags = useMemo(() => collectCharacterTags(parsedCharacters), [parsedCharacters]);

  const handleDeleteTag = useCallback(
    async (tag: string) => {
      if (
        !(await showConfirmDialog({
          title: "Remove Tag",
          message: `Remove tag "${tag}" from all characters?`,
          confirmLabel: "Remove",
          tone: "destructive",
        }))
      ) {
        return;
      }
      try {
        const affected = parsedCharacters.filter((character) => getCharacterTags(character).includes(tag));
        for (const character of affected) {
          const newTags = getCharacterTags(character).filter((candidate) => candidate !== tag);
          await updateCharacter.mutateAsync({ id: character.id, data: { tags: newTags } });
        }
        setIncludedTags((prev) => {
          if (!prev.has(tag)) return prev;
          const next = new Set(prev);
          next.delete(tag);
          return next;
        });
        setExcludedTags((prev) => {
          if (!prev.has(tag)) return prev;
          const next = new Set(prev);
          next.delete(tag);
          return next;
        });
      } catch {
        toast.error("Failed to remove tag from some characters");
      }
    },
    [parsedCharacters, updateCharacter],
  );

  const toggleIncludedTag = useCallback((tag: string) => {
    setIncludedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
    setExcludedTags((prev) => {
      if (!prev.has(tag)) return prev;
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  }, []);

  const toggleExcludedTag = useCallback((tag: string) => {
    setIncludedTags((prev) => {
      if (!prev.has(tag)) return prev;
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
    setExcludedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const clearTagFilters = useCallback(() => {
    setIncludedTags(new Set());
    setExcludedTags(new Set());
  }, []);

  return {
    allTags,
    clearTagFilters,
    excludedTags,
    favFilter,
    handleDeleteTag,
    includedTags,
    setFavFilter,
    setTagsExpanded,
    tagsExpanded,
    toggleExcludedTag,
    toggleIncludedTag,
  };
}
