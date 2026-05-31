import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { User } from "lucide-react";

import type { ParsedCharacterRow } from "../lib/characters-panel-model";
import {
  CharacterListRow,
  type CharacterListRowAssigningGroup,
  type CharacterListRowContextMenuRequest,
} from "./CharacterListRow";

export function CharactersListSection({
  characters,
  filteredCount,
  search,
  isLoading,
  isFetching,
  isError,
  selectionMode,
  selectedCount,
  selectedCharacterIds,
  chatCharacterIds,
  hasActiveChat,
  isAssigning,
  assigningGroup,
  onRetry,
  onToggleSelection,
  onToggleGroupMember,
  onOpenCharacterDetail,
  onOpenContextMenu,
  onToggleChatCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  onToggleIncludedTag,
}: {
  characters: ParsedCharacterRow[];
  filteredCount: number;
  search: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  selectionMode: boolean;
  selectedCount: number;
  selectedCharacterIds: ReadonlySet<string>;
  chatCharacterIds: readonly string[];
  hasActiveChat: boolean;
  isAssigning: boolean;
  assigningGroup: CharacterListRowAssigningGroup | null;
  onRetry: () => void;
  onToggleSelection: (characterId: string) => void;
  onToggleGroupMember: (groupId: string, memberId: string, memberIds: string[]) => void;
  onOpenCharacterDetail: (characterId: string) => void;
  onOpenContextMenu: (request: CharacterListRowContextMenuRequest) => void;
  onToggleChatCharacter: (characterId: string) => void;
  onDuplicateCharacter: (character: ParsedCharacterRow) => void;
  onDeleteCharacter: (character: ParsedCharacterRow) => void;
  onToggleIncludedTag: (tag: string) => void;
}) {
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: characters.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 74,
    overscan: 10,
  });

  return (
    <>
      <div className="flex items-center gap-1.5 px-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <User size="0.6875rem" />
        Characters ({filteredCount})
        {isFetching && !isLoading && <span className="text-[0.625rem] font-normal normal-case">· updating</span>}
        {selectionMode && <span className="text-[0.625rem] font-normal normal-case">· {selectedCount} selected</span>}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-xs text-[var(--destructive)]">Characters could not be loaded.</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && filteredCount === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400/20 to-rose-500/20">
            <User size="1.25rem" className="text-[var(--primary)]" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{search ? "No matches found" : "No characters yet"}</p>
        </div>
      )}

      <div ref={listScrollRef} className="max-h-[min(52vh,34rem)] overflow-y-auto pr-1">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const character = characters[virtualRow.index];
            if (!character) return null;
            const isSelected = chatCharacterIds.includes(character.id);
            const isBulkSelected = selectedCharacterIds.has(character.id);

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full pb-1"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <CharacterListRow
                  character={character}
                  hasActiveChat={hasActiveChat}
                  isSelected={isSelected}
                  isBulkSelected={isBulkSelected}
                  selectionMode={selectionMode}
                  isAssigning={isAssigning}
                  assigningGroup={assigningGroup}
                  onToggleSelection={onToggleSelection}
                  onToggleGroupMember={onToggleGroupMember}
                  onOpenCharacterDetail={onOpenCharacterDetail}
                  onOpenContextMenu={onOpenContextMenu}
                  onToggleChatCharacter={onToggleChatCharacter}
                  onDuplicateCharacter={onDuplicateCharacter}
                  onDeleteCharacter={onDeleteCharacter}
                  onToggleIncludedTag={onToggleIncludedTag}
                />
              </div>
            );
          })}
        </div>
      </div>

      {hasActiveChat && !isAssigning && !selectionMode && (
        <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
          Click to edit · Use ✓ to assign/remove from chat
        </p>
      )}
    </>
  );
}
