// ──────────────────────────────────────────────
// Panel: User Personas
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { Check, Download, Plus, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { exportApi } from "../../../../../shared/api/export-api";
import { ExportFormatDialog, type ExportFormatChoice } from "../../../../../shared/components/ui/ExportFormatDialog";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { cn } from "../../../../../shared/lib/utils";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import {
  buildPersonaMap,
  filterPersonas,
  getPersonaTags,
  isPersonaActive,
  parsePersonaGroups,
  parsePersonaTags,
  sortPersonas,
  type PersonaActiveFilter,
  type PersonaGroupRow,
  type PersonaPanelRow,
  type SortOption,
} from "../../lib/personas-panel-model";
import {
  useActivatePersona,
  useCreatePersonaGroup,
  useDeletePersona,
  useDeletePersonaGroup,
  useDuplicatePersona,
  usePersonaGroups,
  usePersonaSummaries,
  useUpdatePersona,
  useUpdatePersonaGroup,
  useUploadPersonaAvatar,
} from "../../hooks/use-personas";
import { PersonaGroupsSection } from "./PersonaGroupsSection";
import { PersonaListItem } from "./PersonaListItem";
import { PersonasFilterBar } from "./PersonasFilterBar";
import { PersonasSelectionToolbar } from "./PersonasSelectionToolbar";

export function PersonasPanel() {
  const { data: personas, isLoading } = usePersonaSummaries();
  const deletePersona = useDeletePersona();
  const duplicatePersona = useDuplicatePersona();
  const updatePersona = useUpdatePersona();
  const activatePersona = useActivatePersona();
  const uploadAvatar = useUploadPersonaAvatar();
  const { data: personaGroupsRaw } = usePersonaGroups();
  const createPGroup = useCreatePersonaGroup();
  const updatePGroup = useUpdatePersonaGroup();
  const deletePGroup = useDeletePersonaGroup();
  const openPersonaDetail = useUIStore((state) => state.openPersonaDetail);
  const openModal = useUIStore((state) => state.openModal);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarTargetId, setAvatarTargetId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<PersonaActiveFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [assigningToGroup, setAssigningToGroup] = useState<string | null>(null);

  const handleCreate = () => {
    openModal("create-persona");
  };

  const handleAvatarClick = (event: MouseEvent, id: string) => {
    event.stopPropagation();
    setAvatarTargetId(id);
    fileRef.current?.click();
  };

  const handleAvatarUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
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
      event.target.value = "";
    },
    [avatarTargetId, uploadAvatar],
  );

  const rawList = useMemo(() => (personas as PersonaPanelRow[] | undefined) ?? [], [personas]);

  const allTags = useMemo(() => getPersonaTags(rawList), [rawList]);

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
        const affected = rawList.filter((persona) => parsePersonaTags(persona).includes(tag));
        for (const persona of affected) {
          const newTags = parsePersonaTags(persona).filter((candidate) => candidate !== tag);
          await updatePersona.mutateAsync({ id: persona.id, tags: newTags });
        }
        if (activeTag === tag) setActiveTag(null);
      } catch {
        toast.error("Failed to remove tag from some personas");
      }
    },
    [activeTag, rawList, updatePersona],
  );

  const personaMap = useMemo(() => buildPersonaMap(rawList), [rawList]);

  const parsedGroups = useMemo(
    () => parsePersonaGroups(personaGroupsRaw as PersonaGroupRow[] | undefined, rawList),
    [personaGroupsRaw, rawList],
  );

  const handleCreateGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    createPGroup.mutate({ name, personaIds: [] });
    setNewGroupName("");
    setCreatingGroup(false);
  }, [createPGroup, newGroupName]);

  const handleRenameGroup = useCallback(
    (groupId: string) => {
      const name = editGroupName.trim();
      if (!name) return;
      updatePGroup.mutate({ id: groupId, name });
      setEditingGroupId(null);
      setEditGroupName("");
    },
    [editGroupName, updatePGroup],
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      deletePGroup.mutate(groupId);
    },
    [deletePGroup],
  );

  const toggleGroupMember = useCallback(
    (groupId: string, personaId: string, currentMembers: string[]) => {
      const isMember = currentMembers.includes(personaId);
      const newMembers = isMember ? currentMembers.filter((id) => id !== personaId) : [...currentMembers, personaId];
      updatePGroup.mutate({ id: groupId, personaIds: newMembers });
    },
    [updatePGroup],
  );

  const filteredList = useMemo(
    () => filterPersonas({ personas: rawList, activeFilter, search, activeTag }),
    [activeFilter, activeTag, rawList, search],
  );

  const list = useMemo(() => sortPersonas(filteredList, sort), [filteredList, sort]);

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

  const selectVisible = useCallback(() => {
    setSelectedPersonaIds(new Set(list.map((persona) => persona.id)));
  }, [list]);

  const clearSelection = useCallback(() => {
    setSelectedPersonaIds(new Set());
  }, []);

  const handleExportSelected = useCallback(
    async (format: ExportFormatChoice) => {
      if (selectedPersonaIds.size === 0) return;
      setExportingSelected(true);
      setExportDialogOpen(false);
      try {
        exportApi.triggerDownload(await exportApi.personasBulk([...selectedPersonaIds], format));
        toast.success(`Exported ${selectedPersonaIds.size} persona${selectedPersonaIds.size === 1 ? "" : "s"}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to export personas");
      } finally {
        setExportingSelected(false);
      }
    },
    [selectedPersonaIds],
  );

  const handleActivate = useCallback(
    (personaId: string) => {
      activatePersona.mutate(personaId);
    },
    [activatePersona],
  );

  const handleDuplicate = useCallback(
    (persona: PersonaPanelRow) => {
      duplicatePersona.mutate(persona.id, {
        onSuccess: () => {
          toast.success(`Duplicated "${persona.name}"`);
        },
      });
    },
    [duplicatePersona],
  );

  const handleDeletePersona = useCallback(
    async (persona: PersonaPanelRow) => {
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
    },
    [deletePersona],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <PersonasFilterBar
        search={search}
        sort={sort}
        activeFilter={activeFilter}
        allTags={allTags}
        activeTag={activeTag}
        tagsExpanded={tagsExpanded}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onActiveFilterChange={setActiveFilter}
        onActiveTagChange={setActiveTag}
        onTagsExpandedChange={setTagsExpanded}
        onDeleteTag={handleDeleteTag}
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <button
          onClick={handleCreate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-emerald-400/15 transition-all hover:shadow-lg hover:shadow-emerald-400/25 active:scale-[0.98]"
          title="New"
        >
          <Plus size="0.8125rem" />
          <span className="md:hidden">New</span>
        </button>
        <button
          onClick={() => openModal("import-persona")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="Import"
        >
          <Download size="0.8125rem" /> <span className="md:hidden">Import</span>
        </button>
        <button
          onClick={() => openModal("persona-maker")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="AI Maker"
        >
          <Sparkles size="0.8125rem" /> <span className="md:hidden">Maker</span>
        </button>
        <button
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else {
              setAssigningToGroup(null);
              setSelectionMode(true);
            }
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
            selectionMode
              ? "bg-emerald-400/15 text-emerald-400 ring-1 ring-emerald-400/30"
              : "bg-[var(--secondary)] text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
          )}
          title="Select"
        >
          <Check size="0.8125rem" />
          <span className="md:hidden">Select</span>
        </button>
      </div>

      {selectionMode && (
        <PersonasSelectionToolbar
          selectedCount={selectedPersonaIds.size}
          visibleCount={list.length}
          exportingSelected={exportingSelected}
          onSelectVisible={selectVisible}
          onClearSelection={clearSelection}
          onOpenExportDialog={() => setExportDialogOpen(true)}
          onDone={exitSelectionMode}
        />
      )}

      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Personas"
        description="Native keeps Marinara persona metadata. Compatible exports simple persona JSON for other tools."
        compatibleDescription="Exports persona fields directly without the Marinara wrapper."
        onClose={() => setExportDialogOpen(false)}
        onSelect={handleExportSelected}
      />

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <PersonaGroupsSection
        groups={parsedGroups}
        personaMap={personaMap}
        groupsExpanded={groupsExpanded}
        expandedGroupId={expandedGroupId}
        creatingGroup={creatingGroup}
        newGroupName={newGroupName}
        editingGroupId={editingGroupId}
        editGroupName={editGroupName}
        assigningToGroup={assigningToGroup}
        onGroupsExpandedChange={setGroupsExpanded}
        onExpandedGroupIdChange={setExpandedGroupId}
        onCreatingGroupChange={setCreatingGroup}
        onNewGroupNameChange={setNewGroupName}
        onEditingGroupIdChange={setEditingGroupId}
        onEditGroupNameChange={setEditGroupName}
        onAssigningToGroupChange={setAssigningToGroup}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        onToggleGroupMember={toggleGroupMember}
        onExitSelectionMode={exitSelectionMode}
      />

      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2].map((item) => (
            <div key={item} className="shimmer h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20">
            <User size="1.25rem" className="text-emerald-400" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {rawList.length === 0 ? "No personas yet — create one!" : "No personas match the current filters."}
          </p>
        </div>
      )}

      <div className="stagger-children flex flex-col gap-1">
        {list.map((persona) => {
          const active = isPersonaActive(persona);
          const targetGroup = assigningToGroup
            ? (parsedGroups.find((group) => group.id === assigningToGroup) ?? null)
            : null;

          return (
            <PersonaListItem
              key={persona.id}
              persona={persona}
              active={active}
              selectionMode={selectionMode}
              isSelected={selectedPersonaIds.has(persona.id)}
              assigningToGroup={Boolean(assigningToGroup)}
              targetGroup={targetGroup}
              onOpen={openPersonaDetail}
              onAvatarClick={handleAvatarClick}
              onToggleSelection={toggleSelection}
              onToggleGroupMember={toggleGroupMember}
              onActivate={handleActivate}
              onDuplicate={handleDuplicate}
              onDelete={handleDeletePersona}
            />
          );
        })}
      </div>
    </div>
  );
}
