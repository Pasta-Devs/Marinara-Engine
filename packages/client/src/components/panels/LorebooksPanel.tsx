// ──────────────────────────────────────────────
// Panel: Lorebooks (overhauled)
// Category tabs, search, click-to-edit, AI generate
// ──────────────────────────────────────────────
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type TouchEvent,
} from "react";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Download,
  Check,
  BookOpen,
  Search,
  UserRound,
  ArrowUpDown,
  Tag,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderPlus,
  X,
  Trash2,
  Camera,
} from "lucide-react";
import { useUIStore, type LorebookPanelCategory, type LorebookPanelSort } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import {
  useLorebooks,
  useCreateLorebook,
  useDeleteLorebook,
  useUpdateLorebook,
  useUploadLorebookImage,
} from "../../hooks/use-lorebooks";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import type { Lorebook, LorebookCategory, LorebookEntry, LorebookFolder } from "@marinara-engine/shared";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { getChatCharacterIds } from "../../lib/chat-macros";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { TouchDragHandle } from "../ui/TouchDragHandle";

const CATEGORIES: Array<{ id: LorebookCategory | "all" | "active"; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "world", label: "World" },
  { id: "character", label: "Character" },
  { id: "npc", label: "NPC" },
  { id: "spellbook", label: "Spellbook" },
  { id: "uncategorized", label: "Other" },
];
const PRIMARY_CATEGORIES = CATEGORIES.filter((category) => category.id === "all" || category.id === "active");
const TAGGED_CATEGORIES = CATEGORIES.filter((category) => category.id !== "all" && category.id !== "active");

const CATEGORY_COLORS: Record<string, string> = {
  world: "from-amber-400 to-orange-500",
  character: "from-amber-400 to-orange-500",
  npc: "from-amber-400 to-orange-500",
  spellbook: "from-amber-400 to-orange-500",
  uncategorized: "from-amber-400 to-orange-500",
  all: "from-amber-400 to-orange-500",
};

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

function remapLorebookEntryRelationships(
  relationships: Record<string, string> | null | undefined,
  entryIdMap: Map<string, string>,
) {
  const remapped: Record<string, string> = {};
  if (!relationships) return remapped;

  for (const [sourceEntryId, relationshipType] of Object.entries(relationships)) {
    const clonedEntryId = entryIdMap.get(sourceEntryId);
    if (clonedEntryId) remapped[clonedEntryId] = relationshipType;
  }

  return remapped;
}

export function LorebooksPanel() {
  const activeCategory = useUIStore((s) => s.lorebookPanelCategory);
  const setActiveCategory = useUIStore((s) => s.setLorebookPanelCategory);
  const searchQuery = useUIStore((s) => s.lorebookPanelSearch);
  const setSearchQuery = useUIStore((s) => s.setLorebookPanelSearch);
  const sort = useUIStore((s) => s.lorebookPanelSort);
  const setSort = useUIStore((s) => s.setLorebookPanelSort);
  const activeTag = useUIStore((s) => s.lorebookPanelActiveTag);
  const setActiveTag = useUIStore((s) => s.setLorebookPanelActiveTag);
  const tagsExpanded = useUIStore((s) => s.lorebookPanelTagsExpanded);
  const setTagsExpanded = useUIStore((s) => s.setLorebookPanelTagsExpanded);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLorebookIds, setSelectedLorebookIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const isMobileOverlay = usePanelMobileOverlay();
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedLorebookId, setDraggedLorebookId] = useState<string | null>(null);
  const lorebookImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetLorebookIdRef = useRef<string | null>(null);
  const suppressLorebookClickRef = useRef(false);
  const handleFolderRenameGesture = useFolderRenameGesture();

  // Active chat context for the "Active" filter
  const activeChat = useChatStore((s) => s.activeChat);
  const activeChatMetadata = activeChat?.metadata;
  const activeLorebookIds: string[] = useMemo(() => {
    if (!activeChatMetadata) return [];
    try {
      const meta = typeof activeChatMetadata === "string" ? JSON.parse(activeChatMetadata) : activeChatMetadata;
      return Array.isArray(meta.activeLorebookIds) ? meta.activeLorebookIds : [];
    } catch {
      return [];
    }
  }, [activeChatMetadata]);
  const activeCharacterIds = useMemo(() => getChatCharacterIds(activeChat), [activeChat]);
  const activePersonaId = activeChat?.personaId ?? null;
  const activeChatId = activeChat?.id ?? null;

  // When "active" category is selected, fetch all lorebooks (no category filter) — we filter client-side
  const { data: lorebooks, isLoading } = useLorebooks(
    activeCategory === "active" || activeCategory === "all" ? undefined : activeCategory,
  );
  const { data: rawCharacters } = useCharacters();
  const { data: rawPersonas } = usePersonas();
  const createLorebook = useCreateLorebook();
  const deleteLorebook = useDeleteLorebook();
  const updateLorebook = useUpdateLorebook();
  const uploadLorebookImage = useUploadLorebookImage();
  const { data: lorebookFolders = [] } = useLibraryFolders("lorebooks");
  const createLorebookFolder = useCreateLibraryFolder("lorebooks");
  const updateLorebookFolder = useUpdateLibraryFolder("lorebooks");
  const deleteLorebookFolder = useDeleteLibraryFolder("lorebooks");
  const moveLorebookItem = useMoveLibraryItem("lorebooks");
  const openModal = useUIStore((s) => s.openModal);
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!rawCharacters) return map;
    for (const c of rawCharacters as Array<{ id: string; data: string | Record<string, unknown> }>) {
      try {
        const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        map.set(c.id, d?.name ?? "Unknown");
      } catch {
        map.set(c.id, "Unknown");
      }
    }
    return map;
  }, [rawCharacters]);
  const personaNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!rawPersonas) return map;
    for (const p of rawPersonas as Array<{ id: string; name: string; comment?: string | null }>) {
      map.set(p.id, p.comment ? `${p.name} - ${p.comment}` : p.name || "Unknown");
    }
    return map;
  }, [rawPersonas]);
  const getCharacterNames = useCallback(
    (lb: Lorebook) => {
      const ids =
        Array.isArray(lb.characterIds) && lb.characterIds.length > 0
          ? lb.characterIds
          : lb.characterId
            ? [lb.characterId]
            : [];
      return ids.map((id) => characterNameById.get(id) ?? id);
    },
    [characterNameById],
  );
  const getPersonaNames = useCallback(
    (lb: Lorebook) => {
      const ids =
        Array.isArray(lb.personaIds) && lb.personaIds.length > 0 ? lb.personaIds : lb.personaId ? [lb.personaId] : [];
      return ids.map((id) => personaNameById.get(id) ?? id);
    },
    [personaNameById],
  );

  const parseTags = (lb: Lorebook): string[] => {
    const raw = lb.tags;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string")
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    return [];
  };

  const allTags = useMemo(() => {
    if (!lorebooks) return [] as string[];
    const tagSet = new Set<string>();
    for (const lb of lorebooks as Lorebook[]) {
      for (const t of parseTags(lb)) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [lorebooks]);
  const categoryTagActive = activeCategory !== "all" && activeCategory !== "active";
  const tagFilterActive = categoryTagActive || !!activeTag;

  const handleDeleteTag = useCallback(
    async (tag: string) => {
      if (
        !(await showConfirmDialog({
          title: "Remove Tag",
          message: `Remove tag "${tag}" from all lorebooks?`,
          confirmLabel: "Remove",
          tone: "destructive",
        }))
      ) {
        return;
      }
      try {
        if (!lorebooks) return;
        const affected = (lorebooks as Lorebook[]).filter((lb) => parseTags(lb).includes(tag));
        for (const lb of affected) {
          const newTags = parseTags(lb).filter((t) => t !== tag);
          await updateLorebook.mutateAsync({ id: lb.id, tags: newTags });
        }
        if (activeTag === tag) setActiveTag(null);
      } catch {
        toast.error("Failed to remove tag from some lorebooks");
      }
    },
    [lorebooks, updateLorebook, activeTag, setActiveTag],
  );

  // Filter by search
  const filtered = useMemo(() => {
    if (!lorebooks) return [];
    let list = lorebooks as Lorebook[];
    // "Active" filter: show lorebooks active in the current chat
    // Mirrors server-side filterRelevantLorebooks: global + pinned + character-linked + persona-linked + chat-scoped
    if (activeCategory === "active") {
      list = list.filter(
        (lb) =>
          lb.enabled &&
          (lb.isGlobal ||
            activeLorebookIds.includes(lb.id) ||
            (Array.isArray(lb.characterIds) && lb.characterIds.some((id) => activeCharacterIds.includes(id))) ||
            (lb.characterId && activeCharacterIds.includes(lb.characterId)) ||
            (Array.isArray(lb.personaIds) && lb.personaIds.includes(activePersonaId ?? "")) ||
            (lb.personaId && lb.personaId === activePersonaId) ||
            (lb.chatId && lb.chatId === activeChatId)),
      );
    }
    if (activeTag) {
      list = list.filter((lb) => parseTags(lb).includes(activeTag));
    }
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (lb: Lorebook) =>
        lb.name.toLowerCase().includes(q) ||
        lb.description.toLowerCase().includes(q) ||
        getCharacterNames(lb).some((name) => name.toLowerCase().includes(q)) ||
        getPersonaNames(lb).some((name) => name.toLowerCase().includes(q)) ||
        parseTags(lb).some((t) => t.toLowerCase().includes(q)),
    );
  }, [
    lorebooks,
    activeCategory,
    activeLorebookIds,
    activeCharacterIds,
    activePersonaId,
    activeChatId,
    searchQuery,
    activeTag,
    getCharacterNames,
    getPersonaNames,
  ]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "newest":
        return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "oldest":
        return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      case "tokens":
        return list.sort((a, b) => (b.tokenBudget ?? 0) - (a.tokenBudget ?? 0));
      default:
        return list;
    }
  }, [filtered, sort]);

  const lorebookById = useMemo(() => new Map(sorted.map((lorebook) => [lorebook.id, lorebook])), [sorted]);
  const folderFilterActive = searchQuery.trim().length > 0 || activeCategory !== "all" || activeTag !== null;

  const folderedLorebookIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of lorebookFolders) {
      for (const id of folder.itemIds) ids.add(id);
    }
    return ids;
  }, [lorebookFolders]);

  const rootLorebooks = useMemo(
    () => sorted.filter((lorebook) => !folderedLorebookIds.has(lorebook.id)),
    [sorted, folderedLorebookIds],
  );

  // Group by category for "all" view
  const grouped = useMemo(() => {
    if (activeCategory !== "all") return null;
    const map = new Map<string, Lorebook[]>();
    for (const lb of rootLorebooks) {
      const cat = lb.category || "uncategorized";
      const list = map.get(cat) ?? [];
      list.push(lb);
      map.set(cat, list);
    }
    return map;
  }, [rootLorebooks, activeCategory]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedLorebookIds(new Set());
  }, []);

  const toggleSelection = useCallback((lorebookId: string) => {
    setSelectedLorebookIds((prev) => {
      const next = new Set(prev);
      if (next.has(lorebookId)) next.delete(lorebookId);
      else next.add(lorebookId);
      return next;
    });
  }, []);

  const handleExportSelected = useCallback(
    async () => {
      if (selectedLorebookIds.size === 0) return;
      setExportingSelected(true);
      try {
        await api.downloadPost(
          "/lorebooks/export-bulk",
          { ids: [...selectedLorebookIds], format: "native" },
          "marinara-lorebooks.zip",
        );
        toast.success(`Exported ${selectedLorebookIds.size} lorebook${selectedLorebookIds.size === 1 ? "" : "s"}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to export lorebooks");
      } finally {
        setExportingSelected(false);
      }
    },
    [selectedLorebookIds],
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedLorebookIds];
    if (ids.length === 0) return;

    if (
      !(await showConfirmDialog({
        title: "Delete Lorebooks",
        message: `Delete ${ids.length} lorebook${ids.length === 1 ? "" : "s"}? All entries inside them will be lost.`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deleteLorebook.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} lorebook${deletedCount === 1 ? "" : "s"}`);
    }

    if (failedIds.length > 0) {
      setSelectedLorebookIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} lorebook${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [selectedLorebookIds, deleteLorebook, exitSelectionMode]);

  const handlePickLorebookImage = useCallback((lorebookId: string) => {
    imageTargetLorebookIdRef.current = lorebookId;
    if (lorebookImageInputRef.current) {
      lorebookImageInputRef.current.value = "";
      lorebookImageInputRef.current.click();
    }
  }, []);

  const handleDuplicateLorebook = useCallback(
    async (lorebook: Lorebook) => {
      try {
        const [folders, entries] = await Promise.all([
          api.get<LorebookFolder[]>(`/lorebooks/${lorebook.id}/folders`),
          api.get<LorebookEntry[]>(`/lorebooks/${lorebook.id}/entries`),
        ]);
        const created = await createLorebook.mutateAsync({
          name: `${lorebook.name} (Copy)`,
          description: lorebook.description,
          category: lorebook.category,
          imagePath: lorebook.imagePath,
          scanDepth: lorebook.scanDepth,
          tokenBudget: lorebook.tokenBudget,
          entryLimit: lorebook.entryLimit,
          recursiveScanning: lorebook.recursiveScanning,
          maxRecursionDepth: lorebook.maxRecursionDepth,
          excludeFromVectorization: lorebook.excludeFromVectorization,
          characterId: lorebook.characterId,
          characterIds: lorebook.characterIds,
          personaId: lorebook.personaId,
          personaIds: lorebook.personaIds,
          chatId: lorebook.chatId,
          isGlobal: lorebook.isGlobal,
          enabled: lorebook.enabled,
          scope: lorebook.scope,
          tags: lorebook.tags,
          generatedBy: lorebook.generatedBy,
          sourceAgentId: lorebook.sourceAgentId,
        });
        const createdId = created.id;
        const folderIdMap = new Map<string, string>();
        const pendingFolders = [...folders].sort((a, b) => a.order - b.order);

        while (pendingFolders.length > 0) {
          let createdInPass = false;
          for (let index = pendingFolders.length - 1; index >= 0; index--) {
            const folder = pendingFolders[index];
            const parentFolderId = folder.parentFolderId ? folderIdMap.get(folder.parentFolderId) : null;
            if (folder.parentFolderId && !parentFolderId) continue;

            const createdFolder = await api.post<LorebookFolder>(`/lorebooks/${createdId}/folders`, {
              name: folder.name,
              enabled: folder.enabled,
              parentFolderId,
              order: folder.order,
            });
            folderIdMap.set(folder.id, createdFolder.id);
            pendingFolders.splice(index, 1);
            createdInPass = true;
          }

          if (!createdInPass) throw new Error("Could not copy lorebook folders");
        }

        if (entries.length > 0) {
          const clonedEntries = entries.map((entry) => {
            const clone: Partial<LorebookEntry> = { ...entry };
            delete clone.id;
            delete clone.lorebookId;
            delete clone.createdAt;
            delete clone.updatedAt;
            delete clone.embedding;
            clone.folderId = entry.folderId ? (folderIdMap.get(entry.folderId) ?? null) : null;
            clone.relationships = {};
            return clone;
          });

          const createdEntries = await api.post<LorebookEntry[]>(`/lorebooks/${createdId}/entries/bulk`, {
            entries: clonedEntries,
          });

          const entryIdMap = new Map<string, string>();
          entries.forEach((entry, index) => {
            const createdEntry = createdEntries[index];
            if (createdEntry) entryIdMap.set(entry.id, createdEntry.id);
          });

          const relationshipUpdates = entries
            .map((entry, index) => {
              const createdEntry = createdEntries[index];
              if (!createdEntry) return null;

              const relationships = remapLorebookEntryRelationships(entry.relationships, entryIdMap);
              if (Object.keys(relationships).length === 0) return null;

              return api.patch<LorebookEntry>(`/lorebooks/${createdId}/entries/${createdEntry.id}`, { relationships });
            })
            .filter((update): update is Promise<LorebookEntry> => Boolean(update));

          await Promise.all(relationshipUpdates);
        }

        toast.success(`Copied "${lorebook.name}"`);
        openLorebookDetail(createdId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to copy lorebook");
      }
    },
    [createLorebook, openLorebookDetail],
  );

  const handleLorebookImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const lorebookId = imageTargetLorebookIdRef.current;
      if (!file || !lorebookId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetLorebookIdRef.current = null;
        toast.error("Choose an image file for the lorebook picture");
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error("Could not read that image");
          return;
        }

        try {
          await uploadLorebookImage.mutateAsync({ id: lorebookId, image });
          toast.success("Lorebook picture updated");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to upload lorebook picture");
        } finally {
          imageTargetLorebookIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetLorebookIdRef.current = null;
        toast.error("Could not read that image");
      };
      reader.readAsDataURL(file);
    },
    [uploadLorebookImage],
  );

  const handleCreateFolder = useCallback(() => {
    createLorebookFolder.mutate(
      { name: getNextUnnamedLibraryFolderName(lorebookFolders) },
      {
        onSuccess: (folder) => {
          setExpandedFolderId(folder.id);
        },
      },
    );
  }, [createLorebookFolder, lorebookFolders]);

  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const name = editFolderName.trim();
      if (name) updateLorebookFolder.mutate({ id: folderId, name });
      setEditingFolderId(null);
      setEditFolderName("");
    },
    [editFolderName, updateLorebookFolder],
  );

  const getDraggedLorebookIds = useCallback(
    (lorebookId: string) =>
      selectionMode && selectedLorebookIds.has(lorebookId) ? Array.from(selectedLorebookIds) : [lorebookId],
    [selectedLorebookIds, selectionMode],
  );

  const moveLorebooksToFolder = useCallback(
    (lorebookIds: string[], folderId: string | null) => {
      moveLorebookItem.mutate({ itemIds: lorebookIds, folderId });
    },
    [moveLorebookItem],
  );

  const handleLorebookDrop = useCallback(
    (folderId: string | null, lorebookIds?: string[]) => {
      if (!draggedLorebookId) return;
      moveLorebooksToFolder(lorebookIds ?? [draggedLorebookId], folderId);
      setDraggedLorebookId(null);
    },
    [draggedLorebookId, moveLorebooksToFolder],
  );

  const finishLorebookTouchDrag = useCallback(
    (lorebookId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-lorebook-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-lorebook-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.lorebookFolderId) {
        moveLorebooksToFolder(getDraggedLorebookIds(lorebookId), folderElement.dataset.lorebookFolderId);
      } else if (rootElement) {
        moveLorebooksToFolder(getDraggedLorebookIds(lorebookId), null);
      }
      setDraggedLorebookId(null);
      window.setTimeout(() => {
        suppressLorebookClickRef.current = false;
      }, 0);
    },
    [getDraggedLorebookIds, moveLorebooksToFolder],
  );

  const cancelLorebookTouchDrag = useCallback((_lorebookId: string, wasActive: boolean) => {
    setDraggedLorebookId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressLorebookClickRef.current = false;
      }, 0);
    } else {
      suppressLorebookClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startLorebookTouchDrag } = useTouchFolderDrag({
    onActivate: (lorebookId) => {
      suppressLorebookClickRef.current = true;
      setDraggedLorebookId(lorebookId);
    },
    onDrop: finishLorebookTouchDrag,
    onCancel: cancelLorebookTouchDrag,
  });

  const renderLorebookRow = useCallback(
    (lb: Lorebook) => {
      const combinedNames = [...getCharacterNames(lb), ...getPersonaNames(lb)].join(", ") || undefined;
      return (
        <LorebookRow
          key={lb.id}
          lorebook={lb}
          characterName={combinedNames}
          personaName={undefined}
          onClick={() => {
            if (suppressLorebookClickRef.current) return;
            if (selectionMode) toggleSelection(lb.id);
            else openLorebookDetail(lb.id);
          }}
          onDelete={async () => {
            if (
              await showConfirmDialog({
                title: "Delete Lorebook",
                message: `Delete "${lb.name}"? All entries will be lost.`,
                confirmLabel: "Delete",
                tone: "destructive",
              })
            ) {
              deleteLorebook.mutate(lb.id);
            }
          }}
          onDuplicate={() => void handleDuplicateLorebook(lb)}
          onImagePick={() => handlePickLorebookImage(lb.id)}
          selectionMode={selectionMode}
          isSelected={selectedLorebookIds.has(lb.id)}
          onToggleSelect={() => toggleSelection(lb.id)}
          draggable={!isMobileOverlay}
          isDragging={draggedLorebookId === lb.id}
          onDragStart={(event) => {
            if (isMobileOverlay) return;
            const ids = getDraggedLorebookIds(lb.id);
            setDraggedLorebookId(lb.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-marinara-lorebook-ids", JSON.stringify(ids));
            event.dataTransfer.setData("text/plain", lb.id);
          }}
          onDragEnd={() => setDraggedLorebookId(null)}
          onTouchStart={(event) => {
            startLorebookTouchDrag(event, lb.id, {
              allowInteractiveTarget: true,
              sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="lorebook"]'),
            });
          }}
        />
      );
    },
    [
      deleteLorebook,
      draggedLorebookId,
      getCharacterNames,
      getDraggedLorebookIds,
      getPersonaNames,
      handleDuplicateLorebook,
      handlePickLorebookImage,
      isMobileOverlay,
      openLorebookDetail,
      selectedLorebookIds,
      selectionMode,
      startLorebookTouchDrag,
      toggleSelection,
    ],
  );

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <input
        ref={lorebookImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLorebookImageSelected}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => openModal("create-lorebook")}
          className="mari-panel-gradient-button mari-panel-gradient--lorebooks flex-1 text-xs"
          title="New"
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          onClick={() => openModal("import-lorebook")}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title="Import"
        >
          <Download size="0.8125rem" />
        </button>
        <button
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else setSelectionMode(true);
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
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder="Search lorebooks"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as LorebookPanelSort)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="tokens">Token Budget</option>
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
        {lorebookFolders.length > 0 && <p className="mari-folder-helper">Drag and drop lorebooks to folders</p>}
      </div>

      {/* Filters */}
      <div className="flex gap-1 md:hidden">
        <label htmlFor="lorebook-category-filter" className="sr-only">
          Lorebook category
        </label>
        <div className="relative min-w-0 flex-1">
          <select
            id="lorebook-category-filter"
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value as LorebookPanelCategory)}
            className="mari-chrome-field h-10 w-full min-w-0 appearance-none truncate py-0 pl-3 pr-8 text-xs"
            title="Lorebook category"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size="0.75rem"
            className="mari-chrome-field-icon pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
          />
        </div>
        <button
          onClick={() => setTagsExpanded(!tagsExpanded)}
          className={cn(
            "mari-chrome-control mari-chrome-control--small shrink-0 whitespace-nowrap px-2 text-[0.6875rem]",
            tagFilterActive && "mari-chrome-control--selected",
          )}
          title={tagsExpanded ? "Collapse tags" : "Expand tags"}
        >
          <Tag size="0.6875rem" />
          Tags
          {tagsExpanded ? <ChevronUp size="0.625rem" /> : <ChevronDown size="0.625rem" />}
        </button>
      </div>

      <div className="hidden flex-wrap gap-1 md:flex">
        {PRIMARY_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "mari-chrome-control mari-chrome-control--small whitespace-nowrap text-[0.6875rem]",
                isActive && "mari-chrome-control--selected",
              )}
            >
              {cat.label}
            </button>
          );
        })}
        <button
          onClick={() => setTagsExpanded(!tagsExpanded)}
          className={cn(
            "mari-chrome-control mari-chrome-control--small whitespace-nowrap text-[0.6875rem]",
            tagFilterActive && "mari-chrome-control--selected",
          )}
          title={tagsExpanded ? "Collapse tags" : "Expand tags"}
        >
          <Tag size="0.6875rem" />
          Tags
          {tagsExpanded ? <ChevronUp size="0.625rem" /> : <ChevronDown size="0.625rem" />}
        </button>
      </div>

      {tagsExpanded && (
        <div className="flex flex-wrap items-center gap-1">
          {tagFilterActive && (
            <button
              onClick={() => {
                setActiveCategory("all");
                setActiveTag(null);
              }}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
            >
              <X size="0.5rem" /> Clear
            </button>
          )}
          {TAGGED_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(isActive ? "all" : cat.id)}
                className={cn(
                  "mari-chrome-control mari-chrome-control--compact hidden cursor-pointer md:inline-flex",
                  isActive && "mari-chrome-control--selected",
                )}
              >
                {cat.label}
              </button>
            );
          })}
          {allTags.map((tag) => (
            <div
              key={tag}
              role="button"
              tabIndex={0}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveTag(activeTag === tag ? null : tag);
                }
              }}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact group/tag cursor-pointer whitespace-nowrap",
                activeTag === tag && "mari-chrome-control--selected",
              )}
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTag(tag);
                }}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]"
                title={`Delete tag "${tag}"`}
              >
                <X size="0.5rem" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {lorebookFolders.map((folder) => {
          const isEditing = editingFolderId === folder.id;
          const folderItems = folder.itemIds
            .map((id) => lorebookById.get(id))
            .filter((item): item is Lorebook => Boolean(item));
          if (folderFilterActive && folderItems.length === 0) return null;
          const isExpanded = (folderFilterActive && folderItems.length > 0) || expandedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              data-lorebook-folder-id={folder.id}
              onDragOver={(event) => {
                if (draggedLorebookId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const payload = event.dataTransfer.getData("application/x-marinara-lorebook-ids");
                handleLorebookDrop(folder.id, payload ? (JSON.parse(payload) as string[]) : undefined);
              }}
              className="flex flex-col rounded-lg transition-colors"
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}. Press F2 to rename.`}
                title="Double-click or press F2 to rename."
                className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
                onClick={(event) =>
                  handleFolderRenameGesture(folder.id, event, {
                    onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                    onRename: () => {
                      setEditingFolderId(folder.id);
                      setEditFolderName(folder.name);
                    },
                  })
                }
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  handleFolderRenameKeyDown(event, {
                    onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                    onRename: () => {
                      setEditingFolderId(folder.id);
                      setEditFolderName(folder.name);
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
                      value={editFolderName}
                      onChange={(event) => setEditFolderName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setEditingFolderId(null);
                          setEditFolderName("");
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      onBlur={() => handleRenameFolder(folder.id)}
                      className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-amber-400/30"
                    />
                  ) : (
                    <div className="mari-chrome-text-muted truncate text-xs font-medium">{folder.name}</div>
                  )}
                </div>
                {(folderFilterActive ? folderItems.length : folder.itemIds.length) > 0 && (
                  <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {folderFilterActive ? folderItems.length : folder.itemIds.length}
                  </span>
                )}
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void confirmNonEmptyFolderDelete(folder.itemIds.length, {
                        title: "Delete Folder",
                        message: `Delete "${folder.name}"? Its ${folder.itemIds.length} lorebook${
                          folder.itemIds.length === 1 ? "" : "s"
                        } will move out of the folder.`,
                        confirmLabel: "Delete",
                        tone: "destructive",
                      }).then((ok) => {
                        if (!ok) return;
                        deleteLorebookFolder.mutate(folder.id);
                        if (expandedFolderId === folder.id) setExpandedFolderId(null);
                      });
                    }}
	                    className="mari-chrome-control mari-chrome-control--small mari-chrome-control--danger p-1"
	                    title="Delete folder"
	                  >
                    <Trash2 size="0.6875rem" className="text-[var(--destructive)]" />
                  </button>
                </div>
              </div>
              <SmoothFolderContent
                open={isExpanded}
                className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                innerClassName="flex flex-col gap-0.5"
              >
                {folderItems.length === 0 ? (
                  <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">Drop lorebooks here.</p>
                ) : (
                  folderItems.map((lb) => renderLorebookRow(lb))
                )}
              </SmoothFolderContent>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20">
            <BookOpen size="1.25rem" className="text-amber-400" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {searchQuery ? "No lorebooks match your search" : "No lorebooks yet"}
          </p>
        </div>
      )}

      {/* Lorebook list */}
      {!isLoading && sorted.length > 0 && (
        <>
          {draggedLorebookId && (
            <div
              data-lorebook-folder-root
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const payload = event.dataTransfer.getData("application/x-marinara-lorebook-ids");
                handleLorebookDrop(null, payload ? (JSON.parse(payload) as string[]) : undefined);
              }}
              className="rounded-xl border border-dashed border-amber-400/35 bg-amber-400/5 px-3 py-2 text-[0.625rem] text-amber-300"
            >
              Drop here to move out of folder
            </div>
          )}

          <div className="stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors">
            {activeCategory === "all" && grouped
              ? // Grouped view
                Array.from(grouped.entries()).map(([category, books]) => {
                  const catMeta = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[6];
                  return (
                    <div key={category} className="mb-2">
                      <div className="mb-1 flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        {catMeta.label}
                        <span className="ml-auto text-[0.625rem] font-normal">{books.length}</span>
                      </div>
                      {books.map((lb) => renderLorebookRow(lb))}
                    </div>
                  );
                })
              : // Flat view
                rootLorebooks.map((lb: Lorebook) => renderLorebookRow(lb))}
          </div>
        </>
      )}

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedLorebookIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}
    </div>
  );
}

function LorebookRow({
  lorebook,
  characterName,
  personaName,
  onClick,
  onDelete,
  onDuplicate,
  onImagePick,
  selectionMode,
  isSelected,
  onToggleSelect,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
}: {
  lorebook: Lorebook;
  characterName?: string;
  personaName?: string;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onImagePick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onTouchStart?: (event: TouchEvent<HTMLButtonElement>) => void;
}) {
  const gradient = CATEGORY_COLORS[lorebook.category] ?? CATEGORY_COLORS.uncategorized;
  const imageContent = lorebook.imagePath ? (
    <img src={lorebook.imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <BookOpen size="1rem" />
  );
  const imageClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
    lorebook.imagePath ? "bg-[var(--muted)]" : `bg-gradient-to-br ${gradient}`,
  );

  return (
    <div
      data-touch-drag-card="lorebook"
      className={cn(
        "group relative flex touch-pan-y cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
        selectionMode &&
          isSelected &&
          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
        isDragging && "opacity-50",
      )}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            isSelected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          aria-label={isSelected ? "Deselect lorebook" : "Select lorebook"}
        >
          <span className="text-[0.75rem]">✓</span>
        </button>
      )}
      {onTouchStart && (
        <TouchDragHandle
          label="Drag lorebook"
          onTouchStart={(event) => {
            onTouchStart(event);
          }}
        />
      )}
      {selectionMode ? (
        <div className={imageClasses}>{imageContent}</div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onImagePick();
          }}
	          className={cn(
	            imageClasses,
	            "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]",
	          )}
          title={lorebook.imagePath ? "Replace lorebook picture" : "Upload lorebook picture"}
          aria-label={lorebook.imagePath ? "Replace lorebook picture" : "Upload lorebook picture"}
        >
          {imageContent}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        </button>
      )}
      <div className={cn("min-w-0 flex-1", !selectionMode && "pr-16")}>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{lorebook.name}</span>
          {!lorebook.enabled && (
            <span className="rounded bg-[var(--muted)]/50 px-1 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
              OFF
            </span>
          )}
        </div>
        <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {characterName || personaName ? (
            <span className="inline-flex items-center gap-1">
              <UserRound size="0.625rem" className="shrink-0" />
              {characterName ?? personaName}
              {lorebook.description ? ` · ${lorebook.description}` : ""}
            </span>
          ) : (
            lorebook.description || "No description"
          )}
        </div>
      </div>
      {!selectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Copy"
          >
            <Copy size="0.75rem" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
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
}
