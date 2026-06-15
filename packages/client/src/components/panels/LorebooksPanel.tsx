// ──────────────────────────────────────────────
// Panel: Lorebooks (overhauled)
// Category tabs, search, click-to-edit, AI generate
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useRef, type ChangeEvent, type DragEvent, type TouchEvent } from "react";
import { toast } from "sonner";
import {
  Plus,
  Download,
  Upload,
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
  Pencil,
  X,
  Trash2,
  Camera,
} from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useLorebooks, useDeleteLorebook, useUpdateLorebook, useUploadLorebookImage } from "../../hooks/use-lorebooks";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import type { Lorebook, LorebookCategory } from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
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
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";

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

export function LorebooksPanel() {
  const [activeCategory, setActiveCategory] = useState<LorebookCategory | "all" | "active">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "newest" | "oldest" | "tokens">("name-asc");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLorebookIds, setSelectedLorebookIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedLorebookId, setDraggedLorebookId] = useState<string | null>(null);
  const lorebookImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetLorebookIdRef = useRef<string | null>(null);
  const lorebookTouchDragRef = useRef<{ id: string; timer: number | null; active: boolean } | null>(null);
  const suppressLorebookClickRef = useRef(false);

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
    [lorebooks, updateLorebook, activeTag],
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
    async (format: ExportFormatChoice) => {
      if (selectedLorebookIds.size === 0) return;
      setExportingSelected(true);
      setExportDialogOpen(false);
      try {
        await api.downloadPost(
          "/lorebooks/export-bulk",
          { ids: [...selectedLorebookIds], format },
          format === "compatible" ? "compatible-lorebooks.zip" : "marinara-lorebooks.zip",
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
      if (!name) return;
      updateLorebookFolder.mutate({ id: folderId, name });
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

  const startLorebookTouchDrag = useCallback(
    (event: TouchEvent, lorebookId: string) => {
      const timer = window.setTimeout(() => {
        lorebookTouchDragRef.current = { id: lorebookId, timer: null, active: true };
        suppressLorebookClickRef.current = true;
        setDraggedLorebookId(lorebookId);
      }, 450);
      lorebookTouchDragRef.current = { id: lorebookId, timer, active: false };
      event.currentTarget.addEventListener(
        "touchcancel",
        () => {
          const current = lorebookTouchDragRef.current;
          if (current?.timer) window.clearTimeout(current.timer);
          lorebookTouchDragRef.current = null;
          setDraggedLorebookId(null);
        },
        { once: true },
      );
    },
    [],
  );

  const finishLorebookTouchDrag = useCallback(
    (event: TouchEvent) => {
      const current = lorebookTouchDragRef.current;
      if (!current) return;
      if (current.timer) window.clearTimeout(current.timer);
      lorebookTouchDragRef.current = null;
      if (!current.active) return;
      const touch = event.changedTouches[0];
      const target = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
      const folderElement = target?.closest("[data-lorebook-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-lorebook-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.lorebookFolderId) {
        moveLorebooksToFolder(getDraggedLorebookIds(current.id), folderElement.dataset.lorebookFolderId);
      } else if (rootElement) {
        moveLorebooksToFolder(getDraggedLorebookIds(current.id), null);
      }
      setDraggedLorebookId(null);
      window.setTimeout(() => {
        suppressLorebookClickRef.current = false;
      }, 0);
    },
    [getDraggedLorebookIds, moveLorebooksToFolder],
  );

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
          onImagePick={() => handlePickLorebookImage(lb.id)}
          selectionMode={selectionMode}
          isSelected={selectedLorebookIds.has(lb.id)}
          onToggleSelect={() => toggleSelection(lb.id)}
          draggable
          isDragging={draggedLorebookId === lb.id}
          onDragStart={(event) => {
            const ids = getDraggedLorebookIds(lb.id);
            setDraggedLorebookId(lb.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-marinara-lorebook-ids", JSON.stringify(ids));
            event.dataTransfer.setData("text/plain", lb.id);
          }}
          onDragEnd={() => setDraggedLorebookId(null)}
          onTouchStart={(event) => startLorebookTouchDrag(event, lb.id)}
          onTouchEnd={finishLorebookTouchDrag}
        />
      );
    },
    [
      deleteLorebook,
      draggedLorebookId,
      finishLorebookTouchDrag,
      getCharacterNames,
      getDraggedLorebookIds,
      getPersonaNames,
      handlePickLorebookImage,
      openLorebookDetail,
      selectedLorebookIds,
      selectionMode,
      startLorebookTouchDrag,
      toggleSelection,
    ],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
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
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-amber-400/15 transition-all hover:shadow-lg hover:shadow-amber-400/25 active:scale-[0.98]"
          title="New"
        >
          <Plus size="0.8125rem" /> <span className="md:hidden">New</span>
        </button>
        <button
          onClick={() => openModal("import-lorebook")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="Import"
        >
          <Download size="0.8125rem" /> <span className="md:hidden">Import</span>
        </button>
        <button
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else setSelectionMode(true);
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
            selectionMode
              ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30"
              : "bg-[var(--secondary)] text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
          )}
          title="Select"
        >
          <Check size="0.8125rem" /> <span className="md:hidden">Select</span>
        </button>
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {selectedLorebookIds.size} selected
          </span>
          <button
            onClick={() => setSelectedLorebookIds(new Set(sorted.map((lb) => lb.id)))}
            disabled={sorted.length === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-amber-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
          >
            Select visible
          </button>
          <button
            onClick={() => setSelectedLorebookIds(new Set())}
            disabled={selectedLorebookIds.size === 0}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedLorebookIds.size === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--destructive)]/12 px-2.5 py-1 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20 disabled:opacity-40"
          >
            <Trash2 size="0.6875rem" />
            Delete
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={selectedLorebookIds.size === 0 || exportingSelected}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[0.625rem] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
          >
            <Upload size="0.6875rem" />
            {exportingSelected ? "Exporting..." : "Export ZIP"}
          </button>
          <button
            onClick={exitSelectionMode}
            className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Done
          </button>
        </div>
      )}

      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Lorebooks"
        description="Native keeps Marinara folders and entry fields. Compatible exports a folderless World Info JSON for other roleplay tools."
        onClose={() => setExportDialogOpen(false)}
        onSelect={handleExportSelected}
      />

      {/* Search + Sort */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            type="text"
            placeholder="Search lorebooks"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-[var(--secondary)] py-2 pl-8 pr-3 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-2.5 pr-7 text-[0.6875rem] outline-none transition-colors focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
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
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {PRIMARY_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.6875rem] font-medium transition-all",
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
              )}
            >
              {cat.label}
            </button>
          );
        })}
        <button
          onClick={() => setTagsExpanded(!tagsExpanded)}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.6875rem] font-medium transition-all",
            tagFilterActive
              ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30"
              : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
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
              className="flex items-center gap-1 rounded-full bg-[var(--destructive)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20"
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
                  "flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium transition-all",
                  isActive
                    ? "bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
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
                "group/tag flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium transition-all",
                activeTag === tag
                  ? "bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
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
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateFolder}
            className="flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)]"
          >
            <FolderPlus size="0.75rem" />
            New Folder
          </button>
        </div>
        {lorebookFolders.length > 0 && (
          <p className="px-2.5 pb-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]/70">
            Drag and drop lorebooks to folders
          </p>
        )}
        {lorebookFolders.map((folder) => {
          const isExpanded = expandedFolderId === folder.id;
          const isEditing = editingFolderId === folder.id;
          const folderItems = folder.itemIds
            .map((id) => lorebookById.get(id))
            .filter((item): item is Lorebook => Boolean(item));
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
                className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
                onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
              >
                <ChevronRight
                  size="0.75rem"
                  className={cn(
                    "shrink-0 text-[var(--muted-foreground)] transition-transform",
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
                        if (event.key === "Enter") handleRenameFolder(folder.id);
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
                    <>
                      <div className="truncate text-xs font-medium text-[var(--muted-foreground)]">{folder.name}</div>
                    </>
                  )}
                </div>
                {folder.itemIds.length > 0 && (
                  <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {folder.itemIds.length}
                  </span>
                )}
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingFolderId(folder.id);
                      setEditFolderName(folder.name);
                    }}
                    className="rounded-lg p-1 transition-colors hover:bg-[var(--accent)]"
                    title="Rename folder"
                  >
                    <Pencil size="0.6875rem" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteLorebookFolder.mutate(folder.id);
                      if (expandedFolderId === folder.id) setExpandedFolderId(null);
                    }}
                    className="rounded-lg p-1 transition-colors hover:bg-[var(--destructive)]/15"
                    title="Delete folder"
                  >
                    <Trash2 size="0.6875rem" className="text-[var(--destructive)]" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--border)]/20 pb-1 pl-1">
                  {folderItems.length === 0 ? (
                    <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">Drop lorebooks here.</p>
                  ) : (
                    folderItems.map((lb) => renderLorebookRow(lb))
                  )}
                </div>
              )}
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
        <div
          data-lorebook-folder-root
          onDragOver={(event) => {
            if (draggedLorebookId) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            const payload = event.dataTransfer.getData("application/x-marinara-lorebook-ids");
            handleLorebookDrop(null, payload ? (JSON.parse(payload) as string[]) : undefined);
          }}
          className={cn(
            "stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors",
            draggedLorebookId && "ring-1 ring-amber-400/20",
          )}
        >
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
  onImagePick,
  selectionMode,
  isSelected,
  onToggleSelect,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchEnd,
}: {
  lorebook: Lorebook;
  characterName?: string;
  personaName?: string;
  onClick: () => void;
  onDelete: () => void;
  onImagePick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLDivElement>) => void;
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
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
        selectionMode && isSelected && "ring-1 ring-amber-400/40 bg-amber-400/10",
        isDragging && "opacity-50",
      )}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
              ? "border-amber-400 bg-amber-400 text-white"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          aria-label={isSelected ? "Deselect lorebook" : "Select lorebook"}
        >
          <span className="text-[0.75rem]">✓</span>
        </button>
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
            "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400/50",
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
      <div className="min-w-0 flex-1">
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
              onDelete();
            }}
            className="rounded-lg p-1.5 transition-all hover:bg-[var(--destructive)]/15 active:scale-90"
            title="Delete"
          >
            <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
          </button>
        </div>
      )}
    </div>
  );
}
