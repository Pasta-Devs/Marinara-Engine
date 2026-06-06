import { type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { FileText, Hash } from "lucide-react";
import type { LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";
import type { FolderForest } from "../../lib/lorebook-folder-tree";
import type { FolderDropTarget } from "./use-lorebook-editor-drag-drop";
import { cn } from "../../../../../shared/lib/utils";
import { estimateTokens } from "../shared/LorebookFormFields";
import { LorebookEntriesToolbar, LorebookEntrySelectionToolbar, type EntrySortKey } from "./LorebookEntriesToolbar";
import { LorebookEntryRow } from "../entries/LorebookEntryRow";
import { LorebookFolderRow } from "../entries/LorebookFolderRow";
import { LorebookKeywordTestPanel } from "./LorebookKeywordTestPanel";

type PreviewMatch = "matched" | "constant";

export function LorebookEntriesTab({
  lorebookId,
  entries,
  folders,
  folderForest,
  filteredEntries,
  entriesByContainer,
  characters,
  characterTags,
  entrySearch,
  entrySort,
  keywordPreviewOpen,
  keywordPreviewText,
  previewActive,
  previewMatchCount,
  enabledEntryCount,
  entrySelectionMode,
  selectedEntryIds,
  visibleEntryIds,
  transferTargetLorebooks,
  entryTransferTargetId,
  transferPending,
  unvectorizePending,
  showFolderGrouping,
  canReorderEntries,
  canReorderFolders,
  collapsedFolderIds,
  draggingFolderId,
  folderDropTarget,
  folderRootDropActive,
  draggingEntryIdx,
  entryDropIdx,
  dragSourceContainer,
  dropTargetContainer,
  expandedEntryId,
  previewMatches,
  entryListRef,
  entryDragReadyRef,
  folderDragReadyRef,
  onEntrySearchChange,
  onEntrySortChange,
  onToggleSelectionMode,
  onSelectAllVisible,
  onClearSelection,
  onTransferTargetChange,
  onTransferEntries,
  onUnvectorizeSelectedEntries,
  onExitSelectionMode,
  onAddFolder,
  onAddEntry,
  onKeywordPreviewOpenChange,
  onKeywordPreviewTextChange,
  onToggleFolderCollapsed,
  onSetDragSourceContainer,
  onFolderDragStart,
  onFolderHeaderDragOver,
  onFolderDragOverRow,
  onFolderBodyNestDragOver,
  onCommitEntryDrop,
  onCommitFolderDrop,
  onResetFolderDragState,
  onResetEntryDragState,
  onFolderBodyDragOver,
  onRootListDragOver,
  onRootFolderDragOver,
  onEntryDragStart,
  onEntryDragOver,
  onToggleEntryExpanded,
  onToggleEntrySelection,
}: {
  lorebookId: string | null;
  entries: LorebookEntry[];
  folders: LorebookFolder[];
  folderForest: FolderForest<LorebookFolder>;
  filteredEntries: LorebookEntry[];
  entriesByContainer: Map<string | null, LorebookEntry[]>;
  characters: Array<{ id: string; name: string; tags: string[] }>;
  characterTags: string[];
  entrySearch: string;
  entrySort: EntrySortKey;
  keywordPreviewOpen: boolean;
  keywordPreviewText: string;
  previewActive: boolean;
  previewMatchCount: number;
  enabledEntryCount: number;
  entrySelectionMode: boolean;
  selectedEntryIds: Set<string>;
  visibleEntryIds: string[];
  transferTargetLorebooks: Array<{ id: string; name: string }>;
  entryTransferTargetId: string;
  transferPending: boolean;
  unvectorizePending: boolean;
  showFolderGrouping: boolean;
  canReorderEntries: boolean;
  canReorderFolders: boolean;
  collapsedFolderIds: Set<string>;
  draggingFolderId: string | null;
  folderDropTarget: FolderDropTarget | null;
  folderRootDropActive: boolean;
  draggingEntryIdx: number | null;
  entryDropIdx: number | null;
  dragSourceContainer: string | null | undefined;
  dropTargetContainer: string | null | undefined;
  expandedEntryId: string | null;
  previewMatches: Map<string, PreviewMatch>;
  entryListRef: { current: HTMLDivElement | null };
  entryDragReadyRef: { current: number | null };
  folderDragReadyRef: { current: string | null };
  onEntrySearchChange: (value: string) => void;
  onEntrySortChange: (value: EntrySortKey) => void;
  onToggleSelectionMode: () => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onTransferTargetChange: (id: string) => void;
  onTransferEntries: (mode: "copy" | "move") => void;
  onUnvectorizeSelectedEntries: () => void;
  onExitSelectionMode: () => void;
  onAddFolder: () => void;
  onAddEntry: () => void;
  onKeywordPreviewOpenChange: (open: boolean) => void;
  onKeywordPreviewTextChange: (text: string) => void;
  onToggleFolderCollapsed: (folderId: string) => void;
  onSetDragSourceContainer: (containerId: string | null) => void;
  onFolderDragStart: (folderId: string, event: ReactDragEvent<HTMLDivElement>) => void;
  onFolderHeaderDragOver: (folderId: string, event: ReactDragEvent<HTMLDivElement>) => void;
  onFolderDragOverRow: (folderId: string, event: ReactDragEvent<HTMLDivElement>) => void;
  onFolderBodyNestDragOver: (folderId: string, event: ReactDragEvent<HTMLDivElement>) => void;
  onCommitEntryDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onCommitFolderDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onResetFolderDragState: () => void;
  onResetEntryDragState: () => void;
  onFolderBodyDragOver: (folderId: string, event: ReactDragEvent<HTMLDivElement>) => void;
  onRootListDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onRootFolderDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onEntryDragStart: (
    containerId: string | null,
    entryIndex: number,
    entryId: string,
    event: ReactDragEvent<HTMLDivElement>,
  ) => void;
  onEntryDragOver: (containerId: string | null, entryIndex: number, event: ReactDragEvent<HTMLDivElement>) => void;
  onToggleEntryExpanded: (entryId: string) => void;
  onToggleEntrySelection: (entryId: string) => void;
}) {
  // Keep malformed cycle data from rendering the same folder more than once.
  const renderedFolderIds = new Set<string>();
  const renderFolder = (folder: LorebookFolder, ancestorDisabled = false): ReactNode => {
    if (!lorebookId || renderedFolderIds.has(folder.id)) return null;
    renderedFolderIds.add(folder.id);
    const folderEntries = entriesByContainer.get(folder.id) ?? [];
    const childFolders = folderForest.childrenByParent.get(folder.id) ?? [];
    const isCollapsed = collapsedFolderIds.has(folder.id);
    const dropZone = folderDropTarget?.id === folder.id ? folderDropTarget.zone : null;
    return (
      <div key={folder.id} className="space-y-1">
        {dropZone === "before" && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
        <LorebookFolderRow
          folder={folder}
          folders={folders}
          lorebookId={lorebookId}
          entryCount={folderEntries.length}
          isCollapsed={isCollapsed}
          isNestTarget={dropZone === "inside"}
          inheritedDisabled={ancestorDisabled}
          onToggleCollapse={() => onToggleFolderCollapsed(folder.id)}
          draggable={canReorderFolders}
          isDragging={draggingFolderId === folder.id}
          onDragHandleMouseDown={() => {
            if (canReorderFolders) folderDragReadyRef.current = folder.id;
          }}
          onDragStart={(event) => onFolderDragStart(folder.id, event)}
          onDragOver={(event) => {
            event.stopPropagation();
            if (draggingEntryIdx !== null) onFolderHeaderDragOver(folder.id, event);
            else onFolderDragOverRow(folder.id, event);
          }}
          onDrop={(event) => {
            event.stopPropagation();
            if (draggingEntryIdx !== null) onCommitEntryDrop(event);
            else onCommitFolderDrop(event);
          }}
          onDragEnd={() => {
            onResetFolderDragState();
            onResetEntryDragState();
          }}
        />
        {!isCollapsed && (
          <div
            className={cn(
              "ml-2 space-y-1.5 rounded-lg border-l border-[var(--border)] pl-2 transition-colors sm:ml-3 sm:pl-2.5",
              ((dropTargetContainer === folder.id && draggingEntryIdx !== null) ||
                (folderDropTarget?.id === folder.id && folderDropTarget.zone === "inside")) &&
                "bg-amber-400/5 ring-1 ring-amber-400/40",
            )}
            onDragOver={(event) => {
              // Prevent ancestor folder bodies from overwriting the intended nested target.
              event.stopPropagation();
              if (draggingFolderId !== null) onFolderBodyNestDragOver(folder.id, event);
              else onFolderBodyDragOver(folder.id, event);
            }}
            onDrop={(event) => {
              event.stopPropagation();
              if (draggingFolderId !== null) onCommitFolderDrop(event);
              else onCommitEntryDrop(event);
            }}
          >
            {folderEntries.length === 0 && childFolders.length === 0 && (
              <p className="flex min-h-[2.5rem] items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] italic text-[var(--muted-foreground)]">
                Empty — drag an entry here or pick this folder from an entry's folder selector.
              </p>
            )}
            {folderEntries.map((entry, entryIndex) => {
              const isDropTarget = dropTargetContainer === folder.id && draggingEntryIdx !== null;
              const sameContainer = dragSourceContainer === folder.id;
              const showDropBefore =
                isDropTarget &&
                sameContainer &&
                entryDropIdx === entryIndex &&
                draggingEntryIdx !== entryIndex &&
                draggingEntryIdx !== entryIndex - 1;
              const showDropAfter =
                isDropTarget &&
                sameContainer &&
                entryIndex === folderEntries.length - 1 &&
                entryDropIdx === folderEntries.length &&
                draggingEntryIdx !== entryIndex;
              return (
                <div key={entry.id}>
                  {showDropBefore && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
                  <LorebookEntryRow
                    entry={entry}
                    lorebookId={lorebookId}
                    isExpanded={expandedEntryId === entry.id}
                    onToggleExpand={() => onToggleEntryExpanded(entry.id)}
                    characters={characters}
                    characterTags={characterTags}
                    folders={folders}
                    draggable={canReorderEntries}
                    isDragging={sameContainer && draggingEntryIdx === entryIndex}
                    onDragHandleMouseDown={() => {
                      if (canReorderEntries) {
                        entryDragReadyRef.current = entryIndex;
                        onSetDragSourceContainer(folder.id);
                      }
                    }}
                    onDragStart={(event) => onEntryDragStart(folder.id, entryIndex, entry.id, event)}
                    onDragOver={(event) => {
                      if (draggingEntryIdx === null) return;
                      event.stopPropagation();
                      onEntryDragOver(folder.id, entryIndex, event);
                    }}
                    onDrop={(event) => {
                      if (draggingEntryIdx === null) return;
                      event.stopPropagation();
                      onCommitEntryDrop(event);
                    }}
                    onDragEnd={onResetEntryDragState}
                    selectionMode={entrySelectionMode}
                    isSelected={selectedEntryIds.has(entry.id)}
                    onToggleSelected={() => onToggleEntrySelection(entry.id)}
                    previewMatch={previewMatches.get(entry.id)}
                  />
                  {showDropAfter && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
                </div>
              );
            })}
            {childFolders.map((child) => renderFolder(child, ancestorDisabled || folder.enabled === false))}
          </div>
        )}
        {dropZone === "after" && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <LorebookKeywordTestPanel
        open={keywordPreviewOpen}
        text={keywordPreviewText}
        previewActive={previewActive}
        previewMatchCount={previewMatchCount}
        enabledEntryCount={enabledEntryCount}
        onOpenChange={onKeywordPreviewOpenChange}
        onTextChange={onKeywordPreviewTextChange}
      />

      <LorebookEntriesToolbar
        search={entrySearch}
        sort={entrySort}
        selectionMode={entrySelectionMode}
        onSearchChange={onEntrySearchChange}
        onSortChange={onEntrySortChange}
        onToggleSelectionMode={onToggleSelectionMode}
        onAddFolder={onAddFolder}
        onAddEntry={onAddEntry}
      />

      {entrySelectionMode && (
        <LorebookEntrySelectionToolbar
          selectedCount={selectedEntryIds.size}
          visibleEntryCount={visibleEntryIds.length}
          transferTargetLorebooks={transferTargetLorebooks}
          transferTargetId={entryTransferTargetId}
          transferPending={transferPending}
          unvectorizePending={unvectorizePending}
          onSelectAll={onSelectAllVisible}
          onClear={onClearSelection}
          onTransferTargetChange={onTransferTargetChange}
          onCopy={() => onTransferEntries("copy")}
          onMove={() => onTransferEntries("move")}
          onUnvectorize={onUnvectorizeSelectedEntries}
          onDone={onExitSelectionMode}
        />
      )}

      {entries.length > 0 && (
        <div className="flex items-center gap-3 text-[0.6875rem] text-[var(--muted-foreground)]">
          <span>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          {folders.length > 0 && (
            <>
              <span>•</span>
              <span>
                {folders.length} {folders.length === 1 ? "folder" : "folders"}
              </span>
            </>
          )}
          <span>•</span>
          <span className="flex items-center gap-1">
            <Hash size="0.625rem" />
            {entries.reduce((sum, entry) => sum + estimateTokens(entry.content), 0).toLocaleString()} tokens (est.)
          </span>
          {!showFolderGrouping && folders.length > 0 && (
            <span className="ml-auto italic">Folder view paused (clear search and sort by Order)</span>
          )}
        </div>
      )}

      {entries.length === 0 && folders.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
          <p className="text-xs text-[var(--muted-foreground)]">No entries yet — add one to get started</p>
        </div>
      )}

      {lorebookId && showFolderGrouping && (entries.length > 0 || folders.length > 0) && (
        <div className="space-y-3">
          {folderForest.roots.length > 0 && (
            <div className="space-y-1.5">{folderForest.roots.map((folder) => renderFolder(folder))}</div>
          )}

          <div
            ref={entryListRef}
            className={cn(
              "space-y-1.5",
              ((draggingEntryIdx !== null && dragSourceContainer !== null && dropTargetContainer === null) ||
                folderRootDropActive) &&
                "rounded-xl bg-amber-400/5 ring-1 ring-amber-400/40 transition-colors",
            )}
            onDragOver={(event) => (draggingFolderId !== null ? onRootFolderDragOver(event) : onRootListDragOver(event))}
            onDrop={(event) => (draggingFolderId !== null ? onCommitFolderDrop(event) : onCommitEntryDrop(event))}
          >
            {(entriesByContainer.get(null) ?? []).length === 0 && (
              <p
                className={cn(
                  "py-3 text-center text-[0.625rem] italic text-[var(--muted-foreground)] transition-opacity",
                  (draggingEntryIdx !== null && dragSourceContainer !== null) || folderRootDropActive
                    ? "opacity-100"
                    : "opacity-50",
                )}
              >
                {draggingFolderId !== null
                  ? "Drop here to move the folder to the top level"
                  : draggingEntryIdx !== null && dragSourceContainer !== null
                    ? "Drop here to move out of the folder"
                    : "No entries at the root level"}
              </p>
            )}
            {(entriesByContainer.get(null) ?? []).map((entry, entryIndex) => {
              const rootList = entriesByContainer.get(null) ?? [];
              const isDropTarget = dropTargetContainer === null && draggingEntryIdx !== null;
              const sameContainer = dragSourceContainer === null;
              const showDropBefore =
                isDropTarget &&
                sameContainer &&
                entryDropIdx === entryIndex &&
                draggingEntryIdx !== entryIndex &&
                draggingEntryIdx !== entryIndex - 1;
              const showDropAfter =
                isDropTarget &&
                sameContainer &&
                entryIndex === rootList.length - 1 &&
                entryDropIdx === rootList.length &&
                draggingEntryIdx !== entryIndex;
              return (
                <div key={entry.id}>
                  {showDropBefore && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
                  <LorebookEntryRow
                    entry={entry}
                    lorebookId={lorebookId}
                    isExpanded={expandedEntryId === entry.id}
                    onToggleExpand={() => onToggleEntryExpanded(entry.id)}
                    characters={characters}
                    characterTags={characterTags}
                    folders={folders}
                    draggable={canReorderEntries}
                    isDragging={sameContainer && draggingEntryIdx === entryIndex}
                    onDragHandleMouseDown={() => {
                      if (canReorderEntries) {
                        entryDragReadyRef.current = entryIndex;
                        onSetDragSourceContainer(null);
                      }
                    }}
                    onDragStart={(event) => onEntryDragStart(null, entryIndex, entry.id, event)}
                    onDragOver={(event) => {
                      if (draggingEntryIdx === null) return;
                      event.stopPropagation();
                      onEntryDragOver(null, entryIndex, event);
                    }}
                    onDrop={(event) => {
                      if (draggingEntryIdx === null) return;
                      event.stopPropagation();
                      onCommitEntryDrop(event);
                    }}
                    onDragEnd={onResetEntryDragState}
                    selectionMode={entrySelectionMode}
                    isSelected={selectedEntryIds.has(entry.id)}
                    onToggleSelected={() => onToggleEntrySelection(entry.id)}
                    previewMatch={previewMatches.get(entry.id)}
                  />
                  {showDropAfter && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lorebookId && !showFolderGrouping && filteredEntries.length > 0 && (
        <div ref={entryListRef} className="space-y-1.5">
          {filteredEntries.map((entry) => (
            <LorebookEntryRow
              key={entry.id}
              entry={entry}
              lorebookId={lorebookId}
              isExpanded={expandedEntryId === entry.id}
              onToggleExpand={() => onToggleEntryExpanded(entry.id)}
              characters={characters}
              characterTags={characterTags}
              folders={folders}
              draggable={false}
              isDragging={false}
              onDragHandleMouseDown={() => undefined}
              onDragStart={() => undefined}
              onDragOver={() => undefined}
              onDrop={() => undefined}
              onDragEnd={() => undefined}
              selectionMode={entrySelectionMode}
              isSelected={selectedEntryIds.has(entry.id)}
              onToggleSelected={() => onToggleEntrySelection(entry.id)}
              previewMatch={previewMatches.get(entry.id)}
            />
          ))}
        </div>
      )}

      {lorebookId && !showFolderGrouping && filteredEntries.length === 0 && entries.length > 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
          <p className="text-xs text-[var(--muted-foreground)]">No entries match your search</p>
        </div>
      )}
    </div>
  );
}
