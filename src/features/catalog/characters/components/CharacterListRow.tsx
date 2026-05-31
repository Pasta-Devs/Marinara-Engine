import { Check, Copy, Trash2, User, X } from "lucide-react";

import { getCharacterTitle } from "../../../../shared/lib/character-display";
import { cn } from "../../../../shared/lib/utils";
import { characterAvatarUrl } from "../lib/character-avatar-url";
import { getText } from "../lib/character-library-model";
import { getCharacterPreviewMetadata, getCharacterTags, type ParsedCharacterRow } from "../lib/characters-panel-model";
import { CharacterAvatarImage } from "./CharacterAvatarImage";

export type CharacterListRowContextMenuRequest = {
  x: number;
  y: number;
  charId: string;
  charName: string;
};

export type CharacterListRowAssigningGroup = {
  id: string;
  memberIds: string[];
};

export function CharacterListRow({
  character,
  hasActiveChat,
  isSelected,
  isBulkSelected,
  selectionMode,
  isAssigning,
  assigningGroup,
  onToggleSelection,
  onToggleGroupMember,
  onOpenCharacterDetail,
  onOpenContextMenu,
  onToggleChatCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  onToggleIncludedTag,
}: {
  character: ParsedCharacterRow;
  hasActiveChat: boolean;
  isSelected: boolean;
  isBulkSelected: boolean;
  selectionMode: boolean;
  isAssigning: boolean;
  assigningGroup: CharacterListRowAssigningGroup | null;
  onToggleSelection: (characterId: string) => void;
  onToggleGroupMember: (groupId: string, memberId: string, memberIds: string[]) => void;
  onOpenCharacterDetail: (characterId: string) => void;
  onOpenContextMenu: (request: CharacterListRowContextMenuRequest) => void;
  onToggleChatCharacter: (characterId: string) => void;
  onDuplicateCharacter: (character: ParsedCharacterRow) => void;
  onDeleteCharacter: (character: ParsedCharacterRow) => void;
  onToggleIncludedTag: (tag: string) => void;
}) {
  const charName = getText(character.parsed.name) || "Unnamed";
  const charTitle = getCharacterTitle({ name: charName, comment: character.comment });
  const charTags = getCharacterTags(character);
  const charNameColor = (character.parsed.extensions?.nameColor as string) || undefined;
  const avatarUrl = characterAvatarUrl(character);
  const isInTargetGroup = assigningGroup?.memberIds.includes(character.id) ?? false;
  const previewMetadata = getCharacterPreviewMetadata(character);
  const rowActionLabel = selectionMode
    ? `${isBulkSelected ? "Deselect" : "Select"} ${charName}`
    : assigningGroup
      ? `${isInTargetGroup ? "Remove" : "Add"} ${charName} ${isInTargetGroup ? "from" : "to"} group`
      : `Open ${charName}`;
  const activateRow = () => {
    if (selectionMode) {
      onToggleSelection(character.id);
    } else if (assigningGroup) {
      onToggleGroupMember(assigningGroup.id, character.id, assigningGroup.memberIds);
    } else {
      onOpenCharacterDetail(character.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={rowActionLabel}
      onClick={activateRow}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateRow();
      }}
      onContextMenu={(event) => {
        if (selectionMode || isAssigning) return;
        event.preventDefault();
        onOpenContextMenu({
          x: event.clientX,
          y: event.clientY,
          charId: character.id,
          charName,
        });
      }}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/45",
        selectionMode && isBulkSelected && "ring-1 ring-[var(--primary)]/40 bg-[var(--primary)]/8",
        isSelected && !isAssigning && "ring-1 ring-[var(--primary)]/40 bg-[var(--primary)]/5",
        isAssigning && isInTargetGroup && "ring-1 ring-violet-500/50 bg-violet-500/10",
        isAssigning && !isInTargetGroup && "opacity-60 hover:opacity-100",
      )}
    >
      {selectionMode && (
        <button
          type="button"
          aria-label={isBulkSelected ? "Deselect character" : "Select character"}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            isBulkSelected
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(character.id);
          }}
        >
          <Check size="0.75rem" />
        </button>
      )}

      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-sm">
        {avatarUrl ? (
          <div className="absolute inset-0 overflow-hidden rounded-xl">
            <CharacterAvatarImage
              src={avatarUrl}
              avatarFilePath={character.avatarFilePath}
              avatarFilename={character.avatarFilename}
              alt={charName}
              crop={character.parsed.extensions?.avatarCrop}
            />
          </div>
        ) : (
          <User size="1rem" />
        )}
        {isSelected && !isAssigning && (
          <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] shadow-sm">
            <Check size="0.5625rem" className="text-white" />
          </div>
        )}
        {isAssigning && isInTargetGroup && (
          <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 shadow-sm">
            <Check size="0.5625rem" className="text-white" />
          </div>
        )}
      </div>

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
        {charTitle && <div className="truncate text-[0.625rem] italic text-[var(--muted-foreground)]">{charTitle}</div>}
        {(isAssigning || previewMetadata) && (
          <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
            {isAssigning ? (isInTargetGroup ? "In group — click to remove" : "Click to add to group") : previewMetadata}
          </div>
        )}
        {!isAssigning && charTags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {charTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleIncludedTag(tag);
                }}
                className="cursor-pointer rounded-full bg-[var(--primary)]/8 px-1.5 py-px text-[0.5rem] font-medium text-[var(--primary)]/70 transition-all hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
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

      {!isAssigning && !selectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
          {hasActiveChat && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleChatCharacter(character.id);
              }}
              className={cn(
                "rounded-lg p-1.5 transition-all active:scale-90",
                isSelected
                  ? "text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]",
              )}
              title={isSelected ? "Remove from chat" : "Add to chat"}
            >
              {isSelected ? <X size="0.75rem" /> : <Check size="0.75rem" />}
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateCharacter(character);
            }}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-sky-400/10 hover:text-sky-400 active:scale-90"
            title="Duplicate"
          >
            <Copy size="0.75rem" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeleteCharacter(character);
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
