// ──────────────────────────────────────────────
// Panel: Characters (overhauled — search, folders, avatars)
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef, type UIEvent } from "react";
import { toast } from "sonner";
import {
  useCharacters,
  useDeleteCharacter,
  useCharacterGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useUpdateCharacter,
  useDuplicateCharacter,
} from "../../hooks/use-characters";
import { api } from "../../lib/api-client";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import {
  Plus,
  Trash2,
  Download,
  User,
  Check,
  Search,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Copy,
  Users,
  X,
  UserMinus,
  ArrowUpDown,
  Tag,
  Hash,
  Star,
} from "lucide-react";
import { getCharacterTitle } from "../../lib/character-display";
import { useUIStore, type CharacterLibrarySort } from "../../stores/ui.store";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { estimateCharacterCardTokens, formatEstimatedTokens } from "../../lib/character-token-count";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { TouchDragHandle } from "../ui/TouchDragHandle";

type CharacterRow = {
  id: string;
  data: string;
  comment?: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
};
type GroupRow = { id: string; name: string; description: string; characterIds: string; avatarPath: string | null };
type ParsedCharacterRow = CharacterRow & { parsed: Record<string, any> };
type ParsedGroupRow = GroupRow & { memberIds: string[] };

function getNextUnnamedFolderName(folders: Array<{ name: string }>) {
  const names = new Set(folders.map((folder) => folder.name.toLowerCase()));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index++;
  return `unnamed ${index}`;
}

function parseDroppedCharacterIds(payload: string): unknown {
  if (!payload) return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function getCharacterTags(char: ParsedCharacterRow): string[] {
  return Array.isArray(char.parsed.tags) ? (char.parsed.tags as string[]).filter(Boolean) : [];
}

function parseCharacterSearchQuery(value: string) {
  const excludedTags: string[] = [];
  const text = value
    .replace(/(?:^|\s)(?:-|!)(?:tag:|#)?(?:"([^"]+)"|(\S+))/gi, (_match, quoted: string, bare: string) => {
      const tag = (quoted ?? bare ?? "").trim();
      if (tag) excludedTags.push(tag.toLowerCase());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return {
    text: text.toLowerCase(),
    excludedTags,
  };
}

function getCharacterPreviewMetadata(char: ParsedCharacterRow): string | null {
  const parts: string[] = [];
  const creator = typeof char.parsed.creator === "string" ? char.parsed.creator.trim() : "";
  const version = typeof char.parsed.character_version === "string" ? char.parsed.character_version.trim() : "";
  const importMetadata =
    char.parsed.extensions?.importMetadata && typeof char.parsed.extensions.importMetadata === "object"
      ? (char.parsed.extensions.importMetadata as Record<string, unknown>)
      : {};
  const cardMetadata =
    importMetadata.card && typeof importMetadata.card === "object"
      ? (importMetadata.card as Record<string, unknown>)
      : {};
  const spec = typeof cardMetadata.spec === "string" ? cardMetadata.spec.trim() : "";
  const specVersion = typeof cardMetadata.specVersion === "string" ? cardMetadata.specVersion.trim() : "";
  const tags = getCharacterTags(char);

  if (creator) parts.push(`by ${creator}`);
  if (version) parts.push(`v${version}`);
  if (spec) parts.push(spec);
  if (specVersion) parts.push(`spec ${specVersion}`);
  if (parts.length > 0) return parts.join(", ");
  if (tags.length > 0) return tags.slice(0, 3).join(", ");
  return null;
}

function usePanelMobileOverlay() {
  const [isMobileOverlay, setIsMobileOverlay] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileOverlay(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobileOverlay;
}

export function CharactersPanel() {
  const { data: characters, isLoading } = useCharacters();
  const { data: groups } = useCharacterGroups();
  const deleteCharacter = useDeleteCharacter();
  const duplicateCharacter = useDuplicateCharacter();
  const updateCharacter = useUpdateCharacter();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const openModal = useUIStore((s) => s.openModal);
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openCharacterLibrary = useUIStore((s) => s.openCharacterLibrary);
  const sort = useUIStore((s) => s.characterLibrarySort);
  const setCharacterLibrarySort = useUIStore((s) => s.setCharacterLibrarySort);
  const search = useUIStore((s) => s.characterPanelSearch);
  const setSearch = useUIStore((s) => s.setCharacterPanelSearch);
  const includedTagValues = useUIStore((s) => s.characterPanelIncludedTags);
  const setCharacterPanelIncludedTags = useUIStore((s) => s.setCharacterPanelIncludedTags);
  const excludedTagValues = useUIStore((s) => s.characterPanelExcludedTags);
  const setCharacterPanelExcludedTags = useUIStore((s) => s.setCharacterPanelExcludedTags);
  const tagsExpanded = useUIStore((s) => s.characterPanelTagsExpanded);
  const setTagsExpanded = useUIStore((s) => s.setCharacterPanelTagsExpanded);
  const favFilter = useUIStore((s) => s.characterPanelFavoriteFilter);
  const setFavFilter = useUIStore((s) => s.setCharacterPanelFavoriteFilter);
  const setCharacterPanelScrollTop = useUIStore((s) => s.setCharacterPanelScrollTop);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [draggedCharacterId, setDraggedCharacterId] = useState<string | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingPanelScrollTopRef = useRef(0);
  const panelScrollFrameRef = useRef<number | null>(null);
  const suppressCharacterClickRef = useRef(false);
  const isMobileOverlay = usePanelMobileOverlay();
  const handleFolderRenameGesture = useFolderRenameGesture();
  const includedTags = useMemo(() => new Set(includedTagValues), [includedTagValues]);
  const excludedTags = useMemo(() => new Set(excludedTagValues), [excludedTagValues]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);

  // Parse character data and filter by search
  const parsedCharacters = useMemo(() => {
    if (!characters) return [];
    return (characters as CharacterRow[]).map((char) => {
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        return { ...char, parsed };
      } catch {
        return { ...char, parsed: { name: "Unknown", description: "" } };
      }
    });
  }, [characters]) as ParsedCharacterRow[];

  const charMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; comment?: string | null; avatarPath: string | null; isFavorite: boolean }
    >();
    for (const c of parsedCharacters) {
      map.set(c.id, {
        name: c.parsed.name ?? "Unknown",
        comment: c.comment,
        avatarPath: c.avatarPath,
        isFavorite: !!c.parsed.extensions?.fav,
      });
    }
    return map;
  }, [parsedCharacters]);

  const parsedCharacterMap = useMemo(
    () => new Map(parsedCharacters.map((character) => [character.id, character])),
    [parsedCharacters],
  );

  const filteredCharacters = useMemo(() => {
    let list = parsedCharacters;
    const query = parseCharacterSearchQuery(search);
    // Filter by favorites
    if (favFilter === "favorites") {
      list = list.filter((c) => c.parsed.extensions?.fav);
    } else if (favFilter === "non-favorites") {
      list = list.filter((c) => !c.parsed.extensions?.fav);
    }
    // Filter by included tags (OR logic)
    if (includedTags.size > 0) {
      const lowerIncludedTags = new Set([...includedTags].map((t) => t.toLowerCase()));
      list = list.filter((c) => {
        const tags = new Set(getCharacterTags(c).map((t) => t.toLowerCase()));
        return [...lowerIncludedTags].some((tag) => tags.has(tag));
      });
    }
    const excludedTagFilters = new Set([
      ...Array.from(excludedTags, (tag) => tag.toLowerCase()),
      ...query.excludedTags,
    ]);
    if (excludedTagFilters.size > 0) {
      list = list.filter((c) => {
        const tags = new Set(getCharacterTags(c).map((tag) => tag.toLowerCase()));
        for (const tag of excludedTagFilters) {
          if (tags.has(tag)) return false;
        }
        return true;
      });
    }
    // Filter by search text
    if (query.text) {
      list = list.filter(
        (c) =>
          (c.parsed.name ?? "").toLowerCase().includes(query.text) ||
          (typeof c.comment === "string" && c.comment.toLowerCase().includes(query.text)) ||
          (c.parsed.description ?? "").toLowerCase().includes(query.text) ||
          getCharacterTags(c).some((t) => t.toLowerCase().includes(query.text)),
      );
    }
    return list;
  }, [parsedCharacters, search, includedTags, excludedTags, favFilter]);

  // Collect all unique tags across characters for the filter bar
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const c of parsedCharacters) {
      for (const t of getCharacterTags(c)) {
        tagSet.add(t);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [parsedCharacters]);

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
        const affected = parsedCharacters.filter((c) => getCharacterTags(c).includes(tag));
        for (const c of affected) {
          const newTags = getCharacterTags(c).filter((t) => t !== tag);
          await updateCharacter.mutateAsync({ id: c.id, data: { tags: newTags } });
        }
        if (includedTags.has(tag)) {
          const next = new Set(includedTags);
          next.delete(tag);
          setCharacterPanelIncludedTags([...next]);
        }
        if (excludedTags.has(tag)) {
          const next = new Set(excludedTags);
          next.delete(tag);
          setCharacterPanelExcludedTags([...next]);
        }
      } catch {
        toast.error("Failed to remove tag from some characters");
      }
    },
    [
      parsedCharacters,
      updateCharacter,
      includedTags,
      excludedTags,
      setCharacterPanelIncludedTags,
      setCharacterPanelExcludedTags,
    ],
  );

  const toggleIncludedTag = useCallback(
    (tag: string) => {
      const nextIncluded = new Set(includedTags);
      if (nextIncluded.has(tag)) {
        nextIncluded.delete(tag);
      } else {
        nextIncluded.add(tag);
      }
      setCharacterPanelIncludedTags([...nextIncluded]);

      if (excludedTags.has(tag)) {
        const nextExcluded = new Set(excludedTags);
        nextExcluded.delete(tag);
        setCharacterPanelExcludedTags([...nextExcluded]);
      }
    },
    [excludedTags, includedTags, setCharacterPanelExcludedTags, setCharacterPanelIncludedTags],
  );

  const clearTagFilters = useCallback(() => {
    setCharacterPanelIncludedTags([]);
    setCharacterPanelExcludedTags([]);
  }, [setCharacterPanelExcludedTags, setCharacterPanelIncludedTags]);

  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters];
    const hasIncludedTags = includedTags.size > 0;
    const matchCounts = hasIncludedTags
      ? new Map(
          list.map((c) => {
            const tags = new Set(getCharacterTags(c).map((t) => t.toLowerCase()));
            return [c.id, [...includedTags].filter((tag) => tags.has(tag.toLowerCase())).length];
          }),
        )
      : null;
    switch (sort) {
      case "name-asc":
        return list.sort((a, b) => {
          if (hasIncludedTags) {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
          }
          return (a.parsed.name ?? "").localeCompare(b.parsed.name ?? "");
        });
      case "name-desc":
        return list.sort((a, b) => {
          if (hasIncludedTags) {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
          }
          return (b.parsed.name ?? "").localeCompare(a.parsed.name ?? "");
        });
      case "newest":
        return list.sort((a, b) => {
          if (hasIncludedTags) {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
          }
          return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        });
      case "oldest":
        return list.sort((a, b) => {
          if (hasIncludedTags) {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
          }
          return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
        });
      case "favorites":
        return list.sort((a, b) => {
          const aFav = a.parsed.extensions?.fav ? 1 : 0;
          const bFav = b.parsed.extensions?.fav ? 1 : 0;
          if (bFav !== aFav) return bFav - aFav;
          if (hasIncludedTags) {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
          }
          return (a.parsed.name ?? "").localeCompare(b.parsed.name ?? "");
        });
      default:
        if (hasIncludedTags) {
          return list.sort((a, b) => {
            const countDiff = (matchCounts!.get(b.id) ?? 0) - (matchCounts!.get(a.id) ?? 0);
            if (countDiff !== 0) return countDiff;
            return (a.parsed.name ?? "").localeCompare(b.parsed.name ?? "");
          });
        }
        return list;
    }
  }, [filteredCharacters, sort, includedTags]);

  const parsedGroups = useMemo<ParsedGroupRow[]>(() => {
    if (!groups) return [];
    return (groups as GroupRow[]).map((g) => {
      const memberIds = (() => {
        try {
          return JSON.parse(g.characterIds);
        } catch {
          return [];
        }
      })() as string[];
      return {
        ...g,
        memberIds,
      };
    });
  }, [groups]);

  const folderedCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of parsedGroups) {
      for (const id of folder.memberIds) ids.add(id);
    }
    return ids;
  }, [parsedGroups]);
  const visibleCharacterById = useMemo(
    () => new Map(sortedCharacters.map((character) => [character.id, character])),
    [sortedCharacters],
  );
  const folderFilterActive =
    search.trim().length > 0 || includedTags.size > 0 || excludedTags.size > 0 || favFilter !== "all";

  const visibleRootCharacters = useMemo(
    () => sortedCharacters.filter((char) => !folderedCharacterIds.has(char.id)),
    [sortedCharacters, folderedCharacterIds],
  );

  const rememberPanelScroll = useCallback(() => {
    const node = panelScrollRef.current;
    if (!node) return;
    pendingPanelScrollTopRef.current = node.scrollTop;
    setCharacterPanelScrollTop(node.scrollTop);
  }, [setCharacterPanelScrollTop]);

  const handlePanelScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (event.currentTarget !== event.target) return;
      pendingPanelScrollTopRef.current = event.currentTarget.scrollTop;
      if (panelScrollFrameRef.current !== null) return;
      panelScrollFrameRef.current = window.requestAnimationFrame(() => {
        panelScrollFrameRef.current = null;
        setCharacterPanelScrollTop(pendingPanelScrollTopRef.current);
      });
    },
    [setCharacterPanelScrollTop],
  );

  const openCharacterDetailFromPanel = useCallback(
    (id: string) => {
      rememberPanelScroll();
      openCharacterDetail(id);
    },
    [openCharacterDetail, rememberPanelScroll],
  );

  useLayoutEffect(() => {
    const node = panelScrollRef.current;
    if (!node || isLoading) return;
    if (isMobileOverlay) return;
    const restoreScroll = () => {
      const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollTop = Math.min(useUIStore.getState().characterPanelScrollTop, maxScrollTop);
    };
    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, isMobileOverlay, parsedGroups.length, sortedCharacters.length, visibleRootCharacters.length]);

  useLayoutEffect(
    () => () => {
      if (panelScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(panelScrollFrameRef.current);
      }
    },
    [],
  );

  const handleCreateFolder = useCallback(() => {
    createGroup.mutate({ name: getNextUnnamedFolderName(parsedGroups), characterIds: [] });
  }, [createGroup, parsedGroups]);

  const handleRenameGroup = useCallback(
    (groupId: string) => {
      const name = editGroupName.trim();
      if (name) updateGroup.mutate({ id: groupId, name });
      setEditingGroupId(null);
      setEditGroupName("");
    },
    [editGroupName, updateGroup],
  );

  const handleDeleteGroup = useCallback(
    async (group: ParsedGroupRow) => {
      const memberCount = group.memberIds.length;
      const ok = await confirmNonEmptyFolderDelete(memberCount, {
        title: "Delete Folder",
        message: `Delete "${group.name}"? Its ${memberCount} character${
          memberCount === 1 ? "" : "s"
        } will stay in the library and move out of the folder.`,
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!ok) return;
      deleteGroup.mutate(group.id);
      if (expandedGroupId === group.id) setExpandedGroupId(null);
    },
    [deleteGroup, expandedGroupId],
  );

  const getDraggedCharacterIds = useCallback(
    (charId: string) =>
      selectionMode && selectedCharacterIds.has(charId) ? Array.from(selectedCharacterIds) : [charId],
    [selectedCharacterIds, selectionMode],
  );

  const moveCharactersToFolder = useCallback(
    async (charIds: string[], folderId: string | null) => {
      const ids = Array.from(new Set(charIds.filter(Boolean)));
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const targetFolder = folderId ? parsedGroups.find((folder) => folder.id === folderId) : null;
      const updates = parsedGroups
        .map((folder) => {
          const withoutCharacter = folder.memberIds.filter((id) => !idSet.has(id));
          const nextMembers =
            targetFolder && folder.id === targetFolder.id
              ? [...withoutCharacter, ...ids.filter((id) => !withoutCharacter.includes(id))]
              : withoutCharacter;
          if (
            nextMembers.length === folder.memberIds.length &&
            nextMembers.every((id, index) => id === folder.memberIds[index])
          ) {
            return null;
          }
          return updateGroup.mutateAsync({ id: folder.id, characterIds: nextMembers });
        })
        .filter((promise): promise is Promise<unknown> => promise !== null);
      if (updates.length > 0) await Promise.all(updates);
    },
    [parsedGroups, updateGroup],
  );

  const handleCharacterDrop = useCallback(
    (folderId: string | null, charIds?: unknown) => {
      const ids = Array.isArray(charIds)
        ? charIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : draggedCharacterId
          ? [draggedCharacterId]
          : [];
      if (ids.length === 0) return;
      void moveCharactersToFolder(ids, folderId);
      setDraggedCharacterId(null);
    },
    [draggedCharacterId, moveCharactersToFolder],
  );

  const finishCharacterTouchDrag = useCallback(
    (characterId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-character-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-character-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.characterFolderId) {
        void moveCharactersToFolder(getDraggedCharacterIds(characterId), folderElement.dataset.characterFolderId);
      } else if (rootElement) {
        void moveCharactersToFolder(getDraggedCharacterIds(characterId), null);
      }
      setDraggedCharacterId(null);
      window.setTimeout(() => {
        suppressCharacterClickRef.current = false;
      }, 0);
    },
    [getDraggedCharacterIds, moveCharactersToFolder],
  );

  const cancelCharacterTouchDrag = useCallback((_characterId: string, wasActive: boolean) => {
    setDraggedCharacterId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressCharacterClickRef.current = false;
      }, 0);
    } else {
      suppressCharacterClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startCharacterTouchDrag } = useTouchFolderDrag({
    onActivate: (characterId) => {
      suppressCharacterClickRef.current = true;
      setDraggedCharacterId(characterId);
    },
    onDrop: finishCharacterTouchDrag,
    onCancel: cancelCharacterTouchDrag,
  });

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

  const handleExportSelected = useCallback(async () => {
    if (selectedCharacterIds.size === 0) return;
    setExportingSelected(true);
    try {
      await api.downloadPost(
        "/characters/export-bulk",
        { ids: [...selectedCharacterIds], format: "native" },
        "marinara-characters.zip",
      );
      toast.success(`Exported ${selectedCharacterIds.size} character${selectedCharacterIds.size === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export characters");
    } finally {
      setExportingSelected(false);
    }
  }, [selectedCharacterIds]);

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

  return (
    <div
      ref={panelScrollRef}
      onScroll={handlePanelScroll}
      className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3"
    >
      <button
        onClick={openCharacterLibrary}
        className="mari-chrome-control mari-chrome-control--primary w-full text-xs"
        title="Open full library"
      >
        <Users size="0.875rem" />
        Open Full Library
      </button>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => openModal("create-character")}
          className="mari-panel-gradient-button mari-panel-gradient--characters flex-1 text-xs"
          title="New"
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          onClick={() => openModal("import-character")}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title="Import"
        >
          <Download size="0.8125rem" />
        </button>
        <button
          onClick={() => {
            if (selectionMode) {
              exitSelectionMode();
            } else {
              setSelectionMode(true);
            }
          }}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            selectionMode && "mari-chrome-control--selected",
          )}
          title="Select"
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search size="0.8125rem" className="mari-chrome-field-icon absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search characters or -tag:"tag name"'
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setCharacterLibrarySort(e.target.value as CharacterLibrarySort)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="favorites">Favorites</option>
          </select>
          <ArrowUpDown
            size="0.625rem"
            className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateFolder}
            className="mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]"
          >
            <FolderPlus size="0.75rem" />
            New Folder
          </button>
        </div>
        {parsedGroups.length > 0 && <p className="mari-folder-helper">Drag and drop characters to folders</p>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {(["all", "favorites", "non-favorites"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setFavFilter(opt)}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              favFilter === opt && "mari-chrome-control--selected",
            )}
          >
            {opt === "all" ? "All" : opt === "favorites" ? "Favs" : "Non-favs"}
          </button>
        ))}
        {allTags.length > 0 && (
          <button
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              (includedTags.size > 0 || excludedTags.size > 0) && "mari-chrome-control--selected",
            )}
          >
            <Tag size="0.625rem" />
            Tags ({allTags.length})
            <ChevronDown size="0.625rem" className={cn("transition-transform", tagsExpanded && "rotate-180")} />
          </button>
        )}
      </div>

      {allTags.length > 0 && tagsExpanded && (
        <div className="flex flex-wrap gap-1">
          {(includedTags.size > 0 || excludedTags.size > 0) && (
            <button
              onClick={clearTagFilters}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
            >
              <X size="0.5rem" /> Clear
            </button>
          )}
          {allTags.map((tag) => {
            const included = includedTags.has(tag);
            const excluded = excludedTags.has(tag);
            return (
              <div
                key={tag}
                role="button"
                tabIndex={0}
                onClick={() => toggleIncludedTag(tag)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleIncludedTag(tag);
                  }
                }}
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact group/tag cursor-pointer",
                  included ? "mari-chrome-control--selected" : excluded ? "mari-chrome-control--danger" : "",
                )}
              >
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag);
                  }}
                  className="rounded-full p-0.5 transition-colors hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]"
                  title={`Delete tag "${tag}"`}
                >
                  <X size="0.5rem" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {parsedGroups.map((group) => {
          const folderMemberIds = folderFilterActive
            ? group.memberIds.filter((memberId) => visibleCharacterById.has(memberId))
            : group.memberIds;
          if (folderFilterActive && folderMemberIds.length === 0) return null;
          const isExpanded = (folderFilterActive && folderMemberIds.length > 0) || expandedGroupId === group.id;
          const isEditing = editingGroupId === group.id;

          return (
            <div
              key={group.id}
              data-character-folder-id={group.id}
              onDragOver={(event) => {
                if (draggedCharacterId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const payload = event.dataTransfer.getData("application/x-marinara-character-ids");
                handleCharacterDrop(group.id, parseDroppedCharacterIds(payload));
              }}
              className="flex flex-col rounded-lg transition-colors"
            >
              {/* Folder header */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${group.name}. Press F2 to rename.`}
                title="Double-click or press F2 to rename."
                className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
                onClick={(event) =>
                  handleFolderRenameGesture(group.id, event, {
                    onSingleClick: () => setExpandedGroupId(isExpanded ? null : group.id),
                    onRename: () => {
                      setEditingGroupId(group.id);
                      setEditGroupName(group.name);
                    },
                  })
                }
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  handleFolderRenameKeyDown(event, {
                    onSingleClick: () => setExpandedGroupId(isExpanded ? null : group.id),
                    onRename: () => {
                      setEditingGroupId(group.id);
                      setEditGroupName(group.name);
                    },
                  });
                }}
              >
                <ChevronRight
                  size="0.75rem"
                  className={cn(
                    "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
                    isExpanded && "rotate-90",
                  )}
                />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          setEditingGroupId(null);
                          setEditGroupName("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleRenameGroup(group.id)}
                      className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-[var(--marinara-chat-chrome-input-border-focus)]"
                    />
                  ) : (
                    <>
                      <div className="truncate text-xs font-medium text-[var(--muted-foreground)]">{group.name}</div>
                    </>
                  )}
                </div>
                {folderMemberIds.length > 0 && (
                  <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {folderMemberIds.length}
                  </span>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteGroup(group);
                    }}
                    className="mari-chrome-control mari-chrome-control--small mari-chrome-control--danger p-1"
                    title="Delete folder"
                  >
                    <Trash2 size="0.6875rem" className="text-[var(--destructive)]" />
                  </button>
                </div>
              </div>

              {/* Expanded: show members */}
              <SmoothFolderContent
                open={isExpanded}
                className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                innerClassName="flex flex-col gap-0.5"
              >
                {folderMemberIds.length === 0 && (
                  <div className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">
                    Drop characters here.
                  </div>
                )}
                {folderMemberIds.map((memberId) => {
                  const member = charMap.get(memberId);
                  if (!member) return null;
                  const fullMember = parsedCharacterMap.get(memberId);
                  const isBulkSelected = selectedCharacterIds.has(memberId);
                  const memberName = fullMember?.parsed.name ?? member.name;
                  const memberTitle = fullMember
                    ? getCharacterTitle({ name: memberName, comment: fullMember.comment })
                    : getCharacterTitle(member);
                  const memberPreviewMetadata = fullMember ? getCharacterPreviewMetadata(fullMember) : null;
                  const memberTags = fullMember ? getCharacterTags(fullMember) : [];
                  const memberTokenEstimate = fullMember ? estimateCharacterCardTokens(fullMember.parsed) : null;
                  const memberNameColor = (fullMember?.parsed.extensions?.nameColor as string) || undefined;
                  const memberAvatarCrop = fullMember?.parsed.extensions?.avatarCrop as AvatarCropValue | undefined;
                  return (
                    <div
                      key={memberId}
                      data-touch-drag-card="character"
                      onClick={() => {
                        if (suppressCharacterClickRef.current) return;
                        if (selectionMode) {
                          toggleSelection(memberId);
                          return;
                        }
                        openCharacterDetailFromPanel(memberId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        if (selectionMode) {
                          toggleSelection(memberId);
                          return;
                        }
                        openCharacterDetailFromPanel(memberId);
                      }}
                      draggable
                      onDragStart={(event) => {
                        const ids = getDraggedCharacterIds(memberId);
                        setDraggedCharacterId(memberId);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-marinara-character-ids", JSON.stringify(ids));
                        event.dataTransfer.setData("text/plain", memberId);
                      }}
                      onDragEnd={() => setDraggedCharacterId(null)}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "group group/member flex touch-pan-y cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-all hover:bg-[var(--sidebar-accent)]",
                        selectionMode &&
                          isBulkSelected &&
                          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
                        draggedCharacterId === memberId && "opacity-50",
                      )}
                    >
                      {selectionMode && (
                        <button
                          type="button"
                          aria-label={isBulkSelected ? "Deselect character" : "Select character"}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                            isBulkSelected
                              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(memberId);
                          }}
                        >
                          <Check size="0.75rem" />
                        </button>
                      )}
                      <TouchDragHandle
                        label="Drag character"
                        size="0.75rem"
                        onTouchStart={(event) => {
                          startCharacterTouchDrag(event, memberId, {
                            allowInteractiveTarget: true,
                            sourceElement: event.currentTarget.closest<HTMLElement>(
                              '[data-touch-drag-card="character"]',
                            ),
                          });
                        }}
                      />
                      <div className="mari-avatar-placeholder mari-avatar-placeholder--character relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                        <div className="absolute inset-0 overflow-hidden rounded-lg">
                          {member.avatarPath ? (
                            <img
                              src={member.avatarPath}
                              alt={memberName}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              style={getAvatarCropStyle(memberAvatarCrop)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <User size="0.75rem" />
                            </div>
                          )}
                        </div>
                        {member.isFavorite && (
                          <div
                            aria-hidden="true"
                            className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-md bg-[var(--background)] text-amber-300 shadow-sm ring-1 ring-[var(--border)]"
                          >
                            <Star size="0.5625rem" className="fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[0.75rem] font-medium"
                          style={
                            memberNameColor
                              ? memberNameColor.startsWith("linear-gradient")
                                ? {
                                    background: memberNameColor,
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "100% 100%",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    color: "transparent",
                                    display: "inline-block",
                                  }
                                : { color: memberNameColor }
                              : undefined
                          }
                        >
                          {memberName}
                        </span>
                        {memberTitle && (
                          <span className="block truncate text-[0.5625rem] italic text-[var(--muted-foreground)]">
                            {memberTitle}
                          </span>
                        )}
                        {memberPreviewMetadata && (
                          <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                            {memberPreviewMetadata}
                          </span>
                        )}
                        {memberTokenEstimate !== null && (
                          <span
                            className="mari-chrome-text-muted flex items-center gap-1 text-[0.5625rem]"
                            title="Estimated from character card text fields; actual tokenizer counts vary by model."
                          >
                            <Hash size="0.5rem" />
                            {formatEstimatedTokens(memberTokenEstimate)}
                          </span>
                        )}
                        {memberTags.length > 0 && (
                          <span className="mt-0.5 flex flex-wrap gap-0.5">
                            {memberTags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleIncludedTag(tag);
                                }}
                                className="mari-chrome-muted-badge cursor-pointer px-1.5 py-px text-[0.5rem] transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
                              >
                                {tag}
                              </span>
                            ))}
                            {memberTags.length > 3 && (
                              <span className="rounded-full bg-[var(--secondary)] px-1.5 py-px text-[0.5rem] text-[var(--muted-foreground)]">
                                +{memberTags.length - 3}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {!selectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void moveCharactersToFolder([memberId], null);
                          }}
                          className="rounded p-0.5 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover/member:opacity-100"
                          title="Remove from folder"
                        >
                          <UserMinus size="0.6875rem" className="text-[var(--destructive)]" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </SmoothFolderContent>
            </div>
          );
        })}
      </div>

      {/* Characters Section Header */}
      <div className="flex items-center gap-1.5 px-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <User size="0.6875rem" />
        Characters ({filteredCharacters.length})
        {selectionMode && (
          <span className="text-[0.625rem] font-normal normal-case">· {selectedCharacterIds.size} selected</span>
        )}
      </div>

      {/* Character list */}
      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filteredCharacters.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="mari-chrome-accent-soft-tile mari-accent-animated animate-float flex h-12 w-12 items-center justify-center rounded-2xl">
            <User size="1.25rem" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{search ? "No matches found" : "No characters yet"}</p>
        </div>
      )}

      {draggedCharacterId && (
        <div
          data-character-folder-root
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const payload = event.dataTransfer.getData("application/x-marinara-character-ids");
            handleCharacterDrop(null, parseDroppedCharacterIds(payload));
          }}
          className="rounded-xl border border-dashed border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-[0.625rem] text-[var(--marinara-chat-chrome-button-text-active)]"
        >
          Drop here to move out of folder
        </div>
      )}

      <div className="stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors">
        {visibleRootCharacters.map((char) => {
          const charName = char.parsed.name ?? "Unnamed";
          const charTitle = getCharacterTitle({ name: charName, comment: char.comment });
          const charTags = getCharacterTags(char);
          const charNameColor = (char.parsed.extensions?.nameColor as string) || undefined;
          const isBulkSelected = selectedCharacterIds.has(char.id);
          const isFavorite = !!char.parsed.extensions?.fav;
          const avatarUrl = char.avatarPath;
          const previewMetadata = getCharacterPreviewMetadata(char);
          const tokenEstimate = estimateCharacterCardTokens(char.parsed);

          return (
            <div
              key={char.id}
              data-touch-drag-card="character"
              onClick={() => {
                if (suppressCharacterClickRef.current) return;
                if (selectionMode) {
                  toggleSelection(char.id);
                } else {
                  openCharacterDetailFromPanel(char.id);
                }
              }}
              draggable
              onDragStart={(event) => {
                const ids = getDraggedCharacterIds(char.id);
                setDraggedCharacterId(char.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-marinara-character-ids", JSON.stringify(ids));
                event.dataTransfer.setData("text/plain", char.id);
              }}
              onDragEnd={() => setDraggedCharacterId(null)}
              className={cn(
                "group relative flex touch-pan-y cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]",
                selectionMode &&
                  isBulkSelected &&
                  "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
                draggedCharacterId === char.id && "opacity-50",
              )}
            >
              {selectionMode && (
                <button
                  type="button"
                  aria-label={isBulkSelected ? "Deselect character" : "Select character"}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    isBulkSelected
                      ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                      : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(char.id);
                  }}
                >
                  <Check size="0.75rem" />
                </button>
              )}
              <TouchDragHandle
                label="Drag character"
                onTouchStart={(event) => {
                  startCharacterTouchDrag(event, char.id, {
                    allowInteractiveTarget: true,
                    sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="character"]'),
                  });
                }}
              />
              {/* Avatar */}
              <div className="mari-avatar-placeholder mari-avatar-placeholder--character relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
                {avatarUrl ? (
                  <div className="absolute inset-0 overflow-hidden rounded-xl">
                    <img
                      src={avatarUrl}
                      alt={charName}
                      className="h-full w-full object-cover"
                      style={getAvatarCropStyle(char.parsed.extensions?.avatarCrop as AvatarCropValue | undefined)}
                    />
                  </div>
                ) : (
                  <User size="1rem" />
                )}
                {isFavorite && (
                  <div
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-md bg-[var(--background)] text-amber-300 shadow-sm ring-1 ring-[var(--border)]"
                  >
                    <Star size="0.625rem" className="fill-current" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-sm font-medium"
                  style={
                    charNameColor
                      ? charNameColor.startsWith("linear-gradient")
                        ? {
                            background: charNameColor,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "100% 100%",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                            color: "transparent",
                            display: "inline-block",
                          }
                        : { color: charNameColor }
                      : undefined
                  }
                >
                  {charName}
                </div>
                {charTitle && (
                  <div className="truncate text-[0.625rem] italic text-[var(--muted-foreground)]">{charTitle}</div>
                )}
                {previewMetadata && (
                  <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{previewMetadata}</div>
                )}
                <div
                  className="mari-chrome-text-muted flex items-center gap-1 text-[0.625rem]"
                  title="Estimated from character card text fields; actual tokenizer counts vary by model."
                >
                  <Hash size="0.5625rem" />
                  {formatEstimatedTokens(tokenEstimate)}
                </div>
                {charTags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {charTags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIncludedTag(tag);
                        }}
                        className="mari-chrome-muted-badge cursor-pointer px-1.5 py-px text-[0.5rem] transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {charTags.length > 3 && (
                      <span className="rounded-full bg-[var(--secondary)] px-1.5 py-px text-[0.5rem] text-[var(--muted-foreground)]">
                        +{charTags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!selectionMode && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateCharacter.mutate(char.id, {
                        onSuccess: () => {
                          toast.success(`Duplicated "${char.parsed?.name ?? "character"}"`);
                        },
                      });
                    }}
                    className="mari-chrome-control mari-chrome-control--small p-1.5"
                    title="Duplicate"
                  >
                    <Copy size="0.75rem" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (
                        !(await showConfirmDialog({
                          title: "Delete Character",
                          message: `Delete "${char.parsed?.name ?? "this character"}"? This cannot be undone.`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        }))
                      ) {
                        return;
                      }
                      deleteCharacter.mutate(char.id);
                    }}
                    className="mari-chrome-control mari-chrome-control--small mari-chrome-control--danger p-1.5"
                    title="Delete"
                  >
                    <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedCharacterIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}
    </div>
  );
}
