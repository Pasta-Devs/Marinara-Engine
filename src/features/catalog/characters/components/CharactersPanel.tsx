import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  useCharacterSummaries,
  useDeleteCharacter,
  useCharacterGroups,
  useDeleteGroup,
  useDuplicateCharacter,
} from "../hooks/use-characters";
import { useCharactersPanelChatActions } from "../hooks/use-characters-panel-chat-actions";
import { useCharactersPanelData } from "../hooks/use-characters-panel-data";
import { useCharactersPanelFilters } from "../hooks/use-characters-panel-filters";
import { useCharactersPanelGroups } from "../hooks/use-characters-panel-groups";
import { useCharactersPanelSelection } from "../hooks/use-characters-panel-selection";
import { parseCharacterSearchQuery } from "../lib/character-search";
import { parseCharacterRows, type ParsedCharacterRow, type SortOption } from "../lib/characters-panel-model";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import { Users } from "lucide-react";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { ExportFormatDialog } from "../../../../shared/components/ui/ExportFormatDialog";
import { CharacterFirstMessageDialog } from "./CharacterFirstMessageDialog";
import { CharacterGroupsSection } from "./CharacterGroupsSection";
import {
  CharacterQuickStartContextMenu,
  type CharacterQuickStartContextMenuState,
} from "./CharacterQuickStartContextMenu";
import { CharactersFilterBar } from "./CharactersFilterBar";
import { CharactersListSection } from "./CharactersListSection";
import { CharactersPanelActionBar } from "./CharactersPanelActionBar";
import { CharactersSelectionToolbar } from "./CharactersSelectionToolbar";

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === "") {
      setDebounced("");
      return;
    }
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);
  return debounced;
}

export function CharactersPanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 180);
  const searchQuery = useMemo(() => parseCharacterSearchQuery(debouncedSearch), [debouncedSearch]);
  const { data: characters, isLoading, isFetching, isError, refetch } = useCharacterSummaries(true, searchQuery.text);
  const { data: groups } = useCharacterGroups();
  const deleteCharacter = useDeleteCharacter();
  const duplicateCharacter = useDuplicateCharacter();
  const deleteGroup = useDeleteGroup();
  const openModal = useUIStore((s) => s.openModal);
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openCharacterLibrary = useUIStore((s) => s.openCharacterLibrary);
  const [contextMenu, setContextMenu] = useState<CharacterQuickStartContextMenuState | null>(null);

  const [sort, setSort] = useState<SortOption>("name-asc");
  const {
    addGroupToChat,
    chatCharacterIds,
    closeFirstMessageConfirm,
    firstMesConfirm,
    handleAddFirstMessage,
    handleStartConversation,
    handleStartNewChat,
    hasActiveChat,
    isStartingChat,
    pendingStartCharacterId,
    toggleCharacter,
  } = useCharactersPanelChatActions();

  // Character data is stored as raw JSON objects.
  const parsedCharacters = useMemo(() => parseCharacterRows(characters), [characters]);
  const {
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
  } = useCharactersPanelFilters(parsedCharacters);

  const {
    assigningToGroup,
    cancelCreateGroup,
    creatingGroup,
    editGroupName,
    editingGroupId,
    expandedGroupId,
    groupsExpanded,
    handleCreateGroup,
    handleRenameGroup,
    newGroupName,
    setAssigningToGroup,
    setEditGroupName,
    setEditingGroupId,
    setExpandedGroupId,
    setNewGroupName,
    startCreateGroup,
    toggleAssigningToGroup,
    toggleGroupMember,
    toggleGroupsExpanded,
  } = useCharactersPanelGroups();

  const { assigningGroup, charMap, filteredCharacters, parsedGroups, sortedCharacters } = useCharactersPanelData({
    assigningToGroup,
    excludedTags,
    favoriteFilter: favFilter,
    groups,
    includedTags,
    parsedCharacters,
    searchExcludedTags: searchQuery.excludedTags,
    sort,
  });

  const {
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    exportDialogOpen,
    exportingSelected,
    handleDeleteSelected,
    handleExportSelected,
    selectAllVisible,
    selectedCharacterIds,
    selectionMode,
    setExportDialogOpen,
    toggleSelection,
  } = useCharactersPanelSelection({ sortedCharacters, deleteCharacter });

  const handleDuplicateCharacter = useCallback(
    (character: ParsedCharacterRow) => {
      duplicateCharacter.mutate(character.id, {
        onSuccess: () => {
          toast.success(`Duplicated "${character.parsed?.name ?? "character"}"`);
        },
      });
    },
    [duplicateCharacter],
  );

  const handleDeleteCharacter = useCallback(
    async (character: ParsedCharacterRow) => {
      if (
        !(await showConfirmDialog({
          title: "Delete Character",
          message: `Delete "${character.parsed?.name ?? "this character"}"? This cannot be undone.`,
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      deleteCharacter.mutate(character.id);
    },
    [deleteCharacter],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <button
        onClick={openCharacterLibrary}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] transition-all hover:border-[var(--primary)]/35 hover:bg-[var(--accent)]"
        title="Open full library"
      >
        <Users size="0.875rem" className="text-[var(--primary)]" />
        Open Full Library
      </button>

      <CharactersFilterBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        favoriteFilter={favFilter}
        onFavoriteFilterChange={setFavFilter}
        allTags={allTags}
        tagsExpanded={tagsExpanded}
        onToggleTagsExpanded={() => setTagsExpanded((expanded) => !expanded)}
        includedTags={includedTags}
        excludedTags={excludedTags}
        onClearTagFilters={clearTagFilters}
        onToggleIncludedTag={toggleIncludedTag}
        onToggleExcludedTag={toggleExcludedTag}
        onDeleteTag={handleDeleteTag}
      />

      <CharactersPanelActionBar
        selectionMode={selectionMode}
        onCreate={() => openModal("create-character")}
        onImport={() => openModal("import-character")}
        onOpenMaker={() => openModal("character-maker")}
        onToggleSelectionMode={() => {
          if (selectionMode) {
            exitSelectionMode();
          } else {
            setAssigningToGroup(null);
            enterSelectionMode();
          }
        }}
      />

      {selectionMode && (
        <CharactersSelectionToolbar
          selectedCount={selectedCharacterIds.size}
          visibleCount={sortedCharacters.length}
          exportingSelected={exportingSelected}
          onSelectVisible={selectAllVisible}
          onClearSelection={clearSelection}
          onDeleteSelected={handleDeleteSelected}
          onExportSelected={() => setExportDialogOpen(true)}
          onDone={exitSelectionMode}
        />
      )}

      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Characters"
        description="Native keeps Marinara metadata. Compatible exports direct Chara Card V2 JSON for other platforms."
        compatibleDescription="Exports direct Chara Card V2 JSON files without the Marinara wrapper."
        onClose={() => setExportDialogOpen(false)}
        onSelect={handleExportSelected}
      />

      <CharacterGroupsSection
        groups={parsedGroups}
        groupsExpanded={groupsExpanded}
        creatingGroup={creatingGroup}
        newGroupName={newGroupName}
        expandedGroupId={expandedGroupId}
        editingGroupId={editingGroupId}
        editGroupName={editGroupName}
        assigningToGroup={assigningToGroup}
        hasActiveChat={hasActiveChat}
        selectionMode={selectionMode}
        charMap={charMap}
        isStartingChat={isStartingChat}
        pendingStartCharacterId={pendingStartCharacterId}
        onToggleGroupsExpanded={toggleGroupsExpanded}
        onCreateGroupStart={startCreateGroup}
        onCreateGroup={handleCreateGroup}
        onCancelCreateGroup={cancelCreateGroup}
        onNewGroupNameChange={setNewGroupName}
        onExpandedGroupChange={setExpandedGroupId}
        onEditingGroupChange={setEditingGroupId}
        onEditGroupNameChange={setEditGroupName}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={(groupId) => deleteGroup.mutate(groupId)}
        onAddGroupToChat={addGroupToChat}
        onToggleAssigningToGroup={(groupId) => toggleAssigningToGroup(groupId, exitSelectionMode)}
        onToggleGroupMember={toggleGroupMember}
        onOpenCharacterDetail={openCharacterDetail}
        onOpenContextMenu={setContextMenu}
        onStartNewChat={(memberId, memberName) => void handleStartNewChat(memberId, memberName)}
      />

      <CharactersListSection
        characters={sortedCharacters}
        filteredCount={filteredCharacters.length}
        search={search}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        selectionMode={selectionMode}
        selectedCount={selectedCharacterIds.size}
        selectedCharacterIds={selectedCharacterIds}
        chatCharacterIds={chatCharacterIds}
        hasActiveChat={hasActiveChat}
        isAssigning={assigningToGroup !== null}
        assigningGroup={assigningGroup}
        onRetry={() => void refetch()}
        onToggleSelection={toggleSelection}
        onToggleGroupMember={toggleGroupMember}
        onOpenCharacterDetail={openCharacterDetail}
        onOpenContextMenu={setContextMenu}
        onToggleChatCharacter={toggleCharacter}
        onDuplicateCharacter={handleDuplicateCharacter}
        onDeleteCharacter={(character) => void handleDeleteCharacter(character)}
        onToggleIncludedTag={toggleIncludedTag}
      />

      {contextMenu && (
        <CharacterQuickStartContextMenu
          menu={contextMenu}
          pendingStartCharacterId={pendingStartCharacterId}
          onClose={() => setContextMenu(null)}
          onStartRoleplay={(menu) => {
            void handleStartNewChat(menu.charId, menu.charName, menu.firstMes, menu.altGreetings);
          }}
          onStartConversation={(menu) => handleStartConversation(menu.charId, menu.charName)}
        />
      )}

      {firstMesConfirm && (
        <CharacterFirstMessageDialog
          confirmation={firstMesConfirm}
          onClose={closeFirstMessageConfirm}
          onAddMessage={handleAddFirstMessage}
        />
      )}
    </div>
  );
}
