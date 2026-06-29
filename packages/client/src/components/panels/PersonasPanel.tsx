// ──────────────────────────────────────────────
// Panel: User Personas
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  usePersonas,
  useDeletePersona,
  useActivatePersona,
  useUploadPersonaAvatar,
  usePersonaGroups,
  useCreatePersonaGroup,
  useUpdatePersonaGroup,
  useDeletePersonaGroup,
  useUpdatePersona,
  useDuplicatePersona,
} from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import {
  Plus,
  Trash2,
  User,
  Camera,
  ArrowUpDown,
  Download,
  Search,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
  Check,
  UserMinus,
  Tag,
} from "lucide-react";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { TouchDragHandle } from "../ui/TouchDragHandle";

type PersonaRow = {
  id: string;
  name: string;
  comment?: string;
  creator?: string;
  personaVersion?: string;
  creatorNotes?: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  avatarPath: string | null;
  /** JSON-encoded AvatarCrop, or empty string when unset. */
  avatarCrop?: string;
  isActive: string | boolean;
  createdAt: string;
  tags?: string;
};

type PersonaGroupRow = { id: string; name: string; description: string; personaIds: string };
type ParsedPersonaGroupRow = PersonaGroupRow & { memberIds: string[] };

type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "tokens";

function getNextUnnamedFolderName(folders: Array<{ name: string }>) {
  const names = new Set(folders.map((folder) => folder.name.toLowerCase()));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index++;
  return `unnamed ${index}`;
}

function parseDroppedPersonaIds(payload: string): unknown {
  if (!payload) return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function estimateTokens(p: PersonaRow): number {
  const text = [p.description, p.personality, p.scenario, p.backstory, p.appearance].join("");
  return Math.ceil(text.length / 4);
}

function getPersonaPreviewMetadata(p: PersonaRow): string | null {
  const parts: string[] = [];
  const creator = p.creator?.trim() ?? "";
  const version = p.personaVersion?.trim() ?? "";

  if (creator) parts.push(`by ${creator}`);
  if (version) parts.push(`v${version}`);

  return parts.length > 0 ? parts.join(", ") : null;
}

function useTouchSafePersonaDragMode() {
  const readTouchSafeMode = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches;
  }, []);
  const [touchSafeMode, setTouchSafeMode] = useState(readTouchSafeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const mobileViewportQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setTouchSafeMode(readTouchSafeMode());

    update();
    coarsePointerQuery.addEventListener("change", update);
    mobileViewportQuery.addEventListener("change", update);
    return () => {
      coarsePointerQuery.removeEventListener("change", update);
      mobileViewportQuery.removeEventListener("change", update);
    };
  }, [readTouchSafeMode]);

  return touchSafeMode;
}

export function PersonasPanel() {
  const { data: personas, isLoading } = usePersonas();
  const deletePersona = useDeletePersona();
  const duplicatePersona = useDuplicatePersona();
  const updatePersona = useUpdatePersona();
  const activatePersona = useActivatePersona();
  const uploadAvatar = useUploadPersonaAvatar();
  const { data: personaGroupsRaw } = usePersonaGroups();
  const createPGroup = useCreatePersonaGroup();
  const updatePGroup = useUpdatePersonaGroup();
  const deletePGroup = useDeletePersonaGroup();
  const openPersonaDetail = useUIStore((s) => s.openPersonaDetail);
  const openModal = useUIStore((s) => s.openModal);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarTargetId, setAvatarTargetId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [search, setSearch] = useState("");
  const [favFilter, setFavFilter] = useState<"all" | "active" | "inactive">("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [draggedPersonaId, setDraggedPersonaId] = useState<string | null>(null);
  const suppressPersonaClickRef = useRef(false);
  const handleFolderRenameGesture = useFolderRenameGesture();
  const touchSafePersonaDragMode = useTouchSafePersonaDragMode();
  const nativePersonaDragEnabled = !touchSafePersonaDragMode;

  const isActive = (p: PersonaRow) => p.isActive === true || p.isActive === "true";

  const handleCreate = () => {
    openModal("create-persona");
  };

  const handleAvatarClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setAvatarTargetId(id);
    fileRef.current?.click();
  };

  const handleAvatarUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !avatarTargetId) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        uploadAvatar.mutate({
          id: avatarTargetId,
          avatar: dataUrl,
          filename: `persona-${avatarTargetId}-${Date.now()}.${file.name.split(".").pop()}`,
        });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [avatarTargetId, uploadAvatar],
  );

  const rawList = useMemo(() => (personas as PersonaRow[] | undefined) ?? [], [personas]);

  const parseTags = (p: PersonaRow): string[] => {
    try {
      return p.tags ? JSON.parse(p.tags) : [];
    } catch {
      return [];
    }
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of rawList) {
      for (const t of parseTags(p)) tagSet.add(t);
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [rawList]);

  const handleDeleteTag = useCallback(
    async (tag: string) => {
      if (
        !(await showConfirmDialog({
          title: "Remove Tag",
          message: `Remove tag "${tag}" from all personas?`,
          confirmLabel: "Remove",
          tone: "destructive",
        }))
      ) {
        return;
      }
      try {
        const affected = rawList.filter((p) => parseTags(p).includes(tag));
        for (const p of affected) {
          const newTags = parseTags(p).filter((t) => t !== tag);
          await updatePersona.mutateAsync({ id: p.id, tags: JSON.stringify(newTags) });
        }
        if (activeTag === tag) setActiveTag(null);
      } catch {
        toast.error("Failed to remove tag from some personas");
      }
    },
    [rawList, updatePersona, activeTag],
  );

  const personaMap = useMemo(() => {
    const map = new Map<string, PersonaRow>();
    for (const p of rawList) map.set(p.id, p);
    return map;
  }, [rawList]);

  const parsedGroups = useMemo<ParsedPersonaGroupRow[]>(() => {
    if (!personaGroupsRaw) return [];
    return (personaGroupsRaw as PersonaGroupRow[]).map((g) => {
      const memberIds = (() => {
        try {
          return JSON.parse(g.personaIds);
        } catch {
          return [];
        }
      })() as string[];
      return {
        ...g,
        memberIds,
      };
    });
  }, [personaGroupsRaw]);

  const folderedPersonaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of parsedGroups) {
      for (const id of folder.memberIds) ids.add(id);
    }
    return ids;
  }, [parsedGroups]);

  const handleCreateFolder = useCallback(() => {
    createPGroup.mutate({ name: getNextUnnamedFolderName(parsedGroups), personaIds: [] });
  }, [createPGroup, parsedGroups]);

  const handleRenameGroup = useCallback(
    (groupId: string) => {
      const name = editGroupName.trim();
      if (name) updatePGroup.mutate({ id: groupId, name });
      setEditingGroupId(null);
      setEditGroupName("");
    },
    [editGroupName, updatePGroup],
  );

  const handleDeleteGroup = useCallback(
    async (group: ParsedPersonaGroupRow) => {
      const memberCount = group.memberIds.length;
      const ok = await confirmNonEmptyFolderDelete(memberCount, {
        title: "Delete Folder",
        message: `Delete "${group.name}"? Its ${memberCount} persona${
          memberCount === 1 ? "" : "s"
        } will stay in the library and move out of the folder.`,
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!ok) return;
      deletePGroup.mutate(group.id);
      if (expandedGroupId === group.id) setExpandedGroupId(null);
    },
    [deletePGroup, expandedGroupId],
  );

  const getDraggedPersonaIds = useCallback(
    (personaId: string) =>
      selectionMode && selectedPersonaIds.has(personaId) ? Array.from(selectedPersonaIds) : [personaId],
    [selectedPersonaIds, selectionMode],
  );

  const movePersonasToFolder = useCallback(
    async (personaIds: string[], folderId: string | null) => {
      const ids = Array.from(new Set(personaIds.filter(Boolean)));
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const targetFolder = folderId ? parsedGroups.find((folder) => folder.id === folderId) : null;
      const updates = parsedGroups
        .map((folder) => {
          const withoutPersona = folder.memberIds.filter((id) => !idSet.has(id));
          const nextMembers =
            targetFolder && folder.id === targetFolder.id
              ? [...withoutPersona, ...ids.filter((id) => !withoutPersona.includes(id))]
              : withoutPersona;
          if (
            nextMembers.length === folder.memberIds.length &&
            nextMembers.every((id, index) => id === folder.memberIds[index])
          ) {
            return null;
          }
          return updatePGroup.mutateAsync({ id: folder.id, personaIds: nextMembers });
        })
        .filter((promise): promise is Promise<unknown> => promise !== null);
      if (updates.length > 0) await Promise.all(updates);
    },
    [parsedGroups, updatePGroup],
  );

  const handlePersonaDrop = useCallback(
    (folderId: string | null, personaIds?: unknown) => {
      const ids = Array.isArray(personaIds)
        ? personaIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : draggedPersonaId
          ? [draggedPersonaId]
          : [];
      if (ids.length === 0) return;
      void movePersonasToFolder(ids, folderId);
      setDraggedPersonaId(null);
    },
    [draggedPersonaId, movePersonasToFolder],
  );

  const finishPersonaTouchDrag = useCallback(
    (personaId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-persona-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-persona-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.personaFolderId) {
        void movePersonasToFolder(getDraggedPersonaIds(personaId), folderElement.dataset.personaFolderId);
      } else if (rootElement) {
        void movePersonasToFolder(getDraggedPersonaIds(personaId), null);
      }
      setDraggedPersonaId(null);
      window.setTimeout(() => {
        suppressPersonaClickRef.current = false;
      }, 0);
    },
    [getDraggedPersonaIds, movePersonasToFolder],
  );

  const cancelPersonaTouchDrag = useCallback((_personaId: string, wasActive: boolean) => {
    setDraggedPersonaId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressPersonaClickRef.current = false;
      }, 0);
    } else {
      suppressPersonaClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startPersonaTouchDrag } = useTouchFolderDrag({
    onActivate: (personaId) => {
      suppressPersonaClickRef.current = true;
      setDraggedPersonaId(personaId);
    },
    onDrop: finishPersonaTouchDrag,
    onCancel: cancelPersonaTouchDrag,
  });

  const filteredList = useMemo(() => {
    let arr = rawList;
    // Filter by active status
    if (favFilter === "active") {
      arr = arr.filter((p) => p.isActive === true || p.isActive === "true");
    } else if (favFilter === "inactive") {
      arr = arr.filter((p) => p.isActive !== true && p.isActive !== "true");
    }
    // Filter by search text
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.comment ?? "").toLowerCase().includes(q) ||
          parseTags(p).some((t) => t.toLowerCase().includes(q)),
      );
    }
    // Filter by active tag
    if (activeTag) {
      arr = arr.filter((p) => parseTags(p).includes(activeTag));
    }
    return arr;
  }, [rawList, favFilter, search, activeTag]);

  const list = useMemo(() => {
    const arr = [...filteredList];
    switch (sort) {
      case "name-asc":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case "newest":
        return arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "oldest":
        return arr.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      case "tokens":
        return arr.sort((a, b) => estimateTokens(b) - estimateTokens(a));
      default:
        return arr;
    }
  }, [filteredList, sort]);

  const visibleRootPersonas = useMemo(
    () => list.filter((persona) => !folderedPersonaIds.has(persona.id)),
    [list, folderedPersonaIds],
  );
  const visiblePersonaById = useMemo(() => new Map(list.map((persona) => [persona.id, persona])), [list]);
  const folderFilterActive = search.trim().length > 0 || activeTag !== null || favFilter !== "all";

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPersonaIds(new Set());
  }, []);

  const toggleSelection = useCallback((personaId: string) => {
    setSelectedPersonaIds((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });
  }, []);

  const handleExportSelected = useCallback(
    async () => {
      if (selectedPersonaIds.size === 0) return;
      setExportingSelected(true);
      try {
        await api.downloadPost(
          "/characters/personas/export-bulk",
          { ids: [...selectedPersonaIds], format: "native" },
          "marinara-personas.zip",
        );
        toast.success(`Exported ${selectedPersonaIds.size} persona${selectedPersonaIds.size === 1 ? "" : "s"}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to export personas");
      } finally {
        setExportingSelected(false);
      }
    },
    [selectedPersonaIds],
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedPersonaIds];
    if (ids.length === 0) return;

    if (
      !(await showConfirmDialog({
        title: "Delete Personas",
        message: `Delete ${ids.length} persona${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deletePersona.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} persona${deletedCount === 1 ? "" : "s"}`);
    }

    if (failedIds.length > 0) {
      setSelectedPersonaIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} persona${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [deletePersona, exitSelectionMode, selectedPersonaIds]);

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          className="mari-panel-gradient-button mari-panel-gradient--personas flex-1 text-xs"
          title="New"
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          onClick={() => openModal("import-persona")}
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
            className="mari-chrome-field-icon absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search personas"
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="tokens">Tokens</option>
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
        {parsedGroups.length > 0 && <p className="mari-folder-helper">Drag and drop personas to folders, double-click or double-tap to rename</p>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {(["all", "active", "inactive"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setFavFilter(opt)}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              favFilter === opt && "mari-chrome-control--selected",
            )}
          >
            {opt === "all" ? "All" : opt === "active" ? "Active" : "Inactive"}
          </button>
        ))}
        {allTags.length > 0 && (
          <button
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className={cn(
              "mari-chrome-control mari-chrome-control--compact",
              activeTag && "mari-chrome-control--selected",
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
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
            >
              <X size="0.5rem" /> Clear
            </button>
          )}
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
                "mari-chrome-control mari-chrome-control--compact group/tag cursor-pointer",
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

      {/* Hidden file input for avatar uploads */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <div className="flex flex-col gap-0.5">
        {/* Folder rows */}
        {parsedGroups.map((group) => {
          const folderMemberIds = folderFilterActive
            ? group.memberIds.filter((personaId) => visiblePersonaById.has(personaId))
            : group.memberIds;
          if (folderFilterActive && folderMemberIds.length === 0) return null;
          const isExpanded = (folderFilterActive && folderMemberIds.length > 0) || expandedGroupId === group.id;
          const isEditing = editingGroupId === group.id;
          return (
            <div
              key={group.id}
              data-persona-folder-id={group.id}
              onDragOver={(event) => {
                if (draggedPersonaId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const payload = event.dataTransfer.getData("application/x-marinara-persona-ids");
                handlePersonaDrop(group.id, parseDroppedPersonaIds(payload));
              }}
              className="flex flex-col rounded-lg transition-colors"
            >
              {/* Folder header */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${group.name}. Double-tap or press F2 to rename.`}
                title="Double-click, double-tap, or press F2 to rename."
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
                      className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-emerald-400/30"
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

                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
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

              {/* Expanded member list */}
              <SmoothFolderContent
                open={isExpanded}
                className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                innerClassName="flex flex-col gap-0.5"
              >
                {folderMemberIds.length === 0 ? (
                  <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">Drop personas here.</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {folderMemberIds.map((pid) => {
                        const p = personaMap.get(pid);
                        if (!p) return null;
                        const isBulkSelected = selectedPersonaIds.has(pid);
                        const personaMetadata = getPersonaPreviewMetadata(p);
                        return (
                          <div
                            key={pid}
                            data-touch-drag-card="persona"
                            onClick={() => {
                              if (suppressPersonaClickRef.current) return;
                              if (selectionMode) {
                                toggleSelection(pid);
                                return;
                              }
                              openPersonaDetail(pid);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (selectionMode) {
                                  toggleSelection(pid);
                                  return;
                                }
                                openPersonaDetail(pid);
                              }
                            }}
                            draggable={nativePersonaDragEnabled}
                            onContextMenu={(event) => {
                              if (touchSafePersonaDragMode) event.preventDefault();
                            }}
                            onDragStart={(event) => {
                              if (!nativePersonaDragEnabled) {
                                event.preventDefault();
                                return;
                              }
                              const ids = getDraggedPersonaIds(pid);
                              setDraggedPersonaId(pid);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("application/x-marinara-persona-ids", JSON.stringify(ids));
                              event.dataTransfer.setData("text/plain", pid);
                            }}
                            onDragEnd={() => setDraggedPersonaId(null)}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "group group/member flex touch-pan-y cursor-pointer items-center gap-2 rounded-lg p-1.5 text-xs transition-all hover:bg-[var(--sidebar-accent)]",
                              touchSafePersonaDragMode && "select-none",
                              selectionMode &&
                                isBulkSelected &&
                                "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
                              draggedPersonaId === pid && "opacity-50",
                            )}
                          >
                            {selectionMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelection(pid);
                                }}
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                  isBulkSelected
                                    ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                                    : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
                                )}
                                aria-label={isBulkSelected ? "Deselect persona" : "Select persona"}
                              >
                                <Check size="0.75rem" />
                              </button>
                            )}
                            <TouchDragHandle
                              label="Drag persona"
                              size="0.75rem"
                              onTouchStart={(event) => {
                                startPersonaTouchDrag(event, pid, {
                                  allowInteractiveTarget: true,
                                  sourceElement: event.currentTarget.closest<HTMLElement>(
                                    '[data-touch-drag-card="persona"]',
                                  ),
                                });
                              }}
                            />
                            <div className="mari-avatar-placeholder mari-avatar-placeholder--persona relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                              {p.avatarPath ? (
                                <img
                                  src={p.avatarPath}
                                  alt=""
                                  className="h-full w-full rounded-lg object-cover"
                                  style={getAvatarCropStyle(parseAvatarCropJson(p.avatarCrop))}
                                />
                              ) : (
                                <User size="0.625rem" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[0.75rem] font-medium">{p.name}</div>
                              {p.comment && (
                                <div className="truncate text-[0.5625rem] italic text-[var(--muted-foreground)]">
                                  {p.comment}
                                </div>
                              )}
                              {personaMetadata && (
                                <div className="truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                                  {personaMetadata}
                                </div>
                              )}
                              <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                                {p.description || "No description"}
                              </div>
                            </div>
                            {!selectionMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void movePersonasToFolder([pid], null);
                                }}
                                className="rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] group-hover/member:opacity-100 max-md:opacity-100"
                                title="Remove from folder"
                              >
                                <UserMinus size="0.625rem" />
                              </button>
                            )}
                          </div>
                        );
                    })}
                  </div>
                )}
              </SmoothFolderContent>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20">
            <User size="1.25rem" className="text-emerald-400" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">No personas yet — create one!</p>
        </div>
      )}

      {draggedPersonaId && (
        <div
          data-persona-folder-root
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const payload = event.dataTransfer.getData("application/x-marinara-persona-ids");
            handlePersonaDrop(null, parseDroppedPersonaIds(payload));
          }}
          className="rounded-xl border border-dashed border-emerald-400/35 bg-emerald-400/5 px-3 py-2 text-[0.625rem] text-emerald-300"
        >
          Drop here to move out of folder
        </div>
      )}

      <div className="stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors">
        {visibleRootPersonas.map((persona) => {
          const active = isActive(persona);
          const isBulkSelected = selectedPersonaIds.has(persona.id);
          const personaMetadata = getPersonaPreviewMetadata(persona);

          return (
            <div
              key={persona.id}
              data-touch-drag-card="persona"
              className={cn(
                "group relative flex touch-pan-y cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
                selectionMode &&
                  isBulkSelected &&
                  "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
                active &&
                  "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
                draggedPersonaId === persona.id && "opacity-50",
                touchSafePersonaDragMode && "select-none",
              )}
              onClick={() => {
                if (suppressPersonaClickRef.current) return;
                if (selectionMode) {
                  toggleSelection(persona.id);
                } else {
                  openPersonaDetail(persona.id);
                }
              }}
              draggable={nativePersonaDragEnabled}
              onContextMenu={(event) => {
                if (touchSafePersonaDragMode) event.preventDefault();
              }}
              onDragStart={(event) => {
                if (!nativePersonaDragEnabled) {
                  event.preventDefault();
                  return;
                }
                const ids = getDraggedPersonaIds(persona.id);
                setDraggedPersonaId(persona.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-marinara-persona-ids", JSON.stringify(ids));
                event.dataTransfer.setData("text/plain", persona.id);
              }}
              onDragEnd={() => setDraggedPersonaId(null)}
            >
              {selectionMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(persona.id);
                  }}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    isBulkSelected
                      ? "border-emerald-400 bg-emerald-400 text-white"
                      : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
                  )}
                  aria-label={isBulkSelected ? "Deselect persona" : "Select persona"}
                >
                  <Check size="0.75rem" />
                </button>
              )}
              <TouchDragHandle
                label="Drag persona"
                onTouchStart={(event) => {
                  startPersonaTouchDrag(event, persona.id, {
                    allowInteractiveTarget: true,
                    sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="persona"]'),
                  });
                }}
              />
              {/* Avatar */}
              <button
                onClick={(e) => handleAvatarClick(e, persona.id)}
                className="mari-avatar-placeholder mari-avatar-placeholder--persona relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm group/avatar"
                title="Change avatar"
              >
                {/* Inner clip wrapper — needed because new-format avatarCrop renders the
                    <img> with position:absolute and dimensions larger than the container.
                    The wrapper provides both `position:relative` (so the absolute img
                    resolves here) and `overflow:hidden` (so the oversized img is clipped
                    to the rounded-xl shape). The wrapper can't be the button itself
                    because the active-indicator star and the camera-hover overlay live
                    outside the avatar bounds via negative offsets / absolute inset-0. */}
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
                  {persona.avatarPath ? (
                    <img
                      src={persona.avatarPath}
                      alt=""
                      loading="lazy"
                      className="h-full w-full rounded-xl object-cover"
                      style={getAvatarCropStyle(parseAvatarCropJson(persona.avatarCrop))}
                    />
                  ) : (
                    <User size="1rem" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                  <Camera size="0.75rem" className="text-white" />
                </div>
                {active && (
                  <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-md bg-emerald-400 shadow-sm">
                    <Check size="0.5rem" className="text-white" />
                  </div>
                )}
              </button>

              {/* Info */}
              <div className={cn("min-w-0 flex-1", !selectionMode && "pr-24")}>
                <div className="truncate text-sm font-medium">{persona.name}</div>
                {persona.comment && (
                  <div className="truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                    {persona.comment}
                  </div>
                )}
                {personaMetadata && (
                  <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{personaMetadata}</div>
                )}
                <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                  {persona.description || "No description"}
                </div>
              </div>

              {/* Actions */}
              {!selectionMode && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                  {!active && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        activatePersona.mutate(persona.id);
	                      }}
	                      className="mari-chrome-control mari-chrome-control--small mari-chrome-control--selected p-1.5"
	                      title="Set as active"
	                    >
                      <Check size="0.75rem" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePersona.mutate(persona.id, {
                        onSuccess: () => {
                          toast.success(`Duplicated "${persona.name}"`);
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
                          title: "Delete Persona",
                          message: `Delete "${persona.name}"? This cannot be undone.`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        }))
                      ) {
                        return;
                      }
                      deletePersona.mutate(persona.id);
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
          selectedCount={selectedPersonaIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}
    </div>
  );
}
