import type { KeyboardEvent, MouseEvent } from "react";
import { Camera, Check, Copy, Star, Trash2, User } from "lucide-react";

import { cn } from "../../../../shared/lib/utils";
import type { PersonaPanelGroup, PersonaPanelRow } from "../lib/personas-panel-model";

interface PersonaListItemProps {
  persona: PersonaPanelRow;
  active: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  assigningToGroup: boolean;
  targetGroup: PersonaPanelGroup | null;
  onOpen: (personaId: string) => void;
  onAvatarClick: (event: MouseEvent, personaId: string) => void;
  onToggleSelection: (personaId: string) => void;
  onToggleGroupMember: (groupId: string, personaId: string, currentMembers: string[]) => void;
  onActivate: (personaId: string) => void;
  onDuplicate: (persona: PersonaPanelRow) => void;
  onDelete: (persona: PersonaPanelRow) => void;
}

export function PersonaListItem({
  persona,
  active,
  selectionMode,
  isSelected,
  assigningToGroup,
  targetGroup,
  onOpen,
  onAvatarClick,
  onToggleSelection,
  onToggleGroupMember,
  onActivate,
  onDuplicate,
  onDelete,
}: PersonaListItemProps) {
  const isInTargetGroup = targetGroup ? targetGroup.memberIds.includes(persona.id) : false;
  const handleRowAction = () => {
    if (selectionMode) {
      onToggleSelection(persona.id);
    } else if (targetGroup) {
      onToggleGroupMember(targetGroup.id, persona.id, targetGroup.memberIds);
    } else {
      onOpen(persona.id);
    }
  };
  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleRowAction();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${persona.name}`}
      aria-current={active ? "true" : undefined}
      aria-pressed={selectionMode ? isSelected : targetGroup ? isInTargetGroup : undefined}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
        selectionMode && isSelected && "bg-emerald-400/8 ring-1 ring-emerald-400/40",
        active && "bg-emerald-400/5 ring-1 ring-emerald-400/40",
        assigningToGroup && isInTargetGroup && "bg-violet-500/10 ring-1 ring-violet-500/50",
        assigningToGroup && !isInTargetGroup && "opacity-60 hover:opacity-100",
      )}
      onClick={handleRowAction}
      onKeyDown={handleRowKeyDown}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(persona.id);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            isSelected
              ? "border-emerald-400 bg-emerald-400 text-white"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          aria-label={isSelected ? "Deselect persona" : "Select persona"}
        >
          <Check size="0.75rem" />
        </button>
      )}

      <button
        type="button"
        onClick={(event) => onAvatarClick(event, persona.id)}
        className="group/avatar relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm"
        title="Change avatar"
        aria-label={`Change avatar for ${persona.name}`}
      >
        {persona.avatarPath ? (
          <img src={persona.avatarPath} alt="" loading="lazy" className="h-full w-full rounded-xl object-cover" />
        ) : (
          <User size="1rem" />
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
          <Camera size="0.75rem" className="text-white" />
        </div>
        {active && (
          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 shadow-sm">
            <Star size="0.5rem" className="text-white" />
          </div>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{persona.name}</div>
        {persona.comment && (
          <div className="truncate text-[0.625rem] italic text-[var(--muted-foreground)]">{persona.comment}</div>
        )}
        <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {assigningToGroup
            ? isInTargetGroup
              ? "In group — click to remove"
              : "Click to add to group"
            : persona.description || "No description"}
        </div>
      </div>

      {!selectionMode && (
        <div className="absolute right-2 top-1/2 flex shrink-0 -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
          {!active && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onActivate(persona.id);
              }}
              className="rounded-lg p-1.5 text-emerald-400 transition-all hover:bg-emerald-400/10 active:scale-90"
              title="Set as active"
            >
              <Star size="0.75rem" />
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(persona);
            }}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-sky-400/10 hover:text-sky-400 active:scale-90"
            title="Duplicate"
          >
            <Copy size="0.75rem" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(persona);
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
