import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRef } from "react";

import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { cn } from "../../../../../shared/lib/utils";
import type { PersonaPanelGroup, PersonaPanelRow } from "../../lib/personas-panel-model";

interface PersonaGroupsSectionProps {
  groups: PersonaPanelGroup[];
  personaMap: Map<string, PersonaPanelRow>;
  groupsExpanded: boolean;
  expandedGroupId: string | null;
  creatingGroup: boolean;
  newGroupName: string;
  editingGroupId: string | null;
  editGroupName: string;
  assigningToGroup: string | null;
  onGroupsExpandedChange: (value: boolean) => void;
  onExpandedGroupIdChange: (groupId: string | null) => void;
  onCreatingGroupChange: (value: boolean) => void;
  onNewGroupNameChange: (value: string) => void;
  onEditingGroupIdChange: (groupId: string | null) => void;
  onEditGroupNameChange: (value: string) => void;
  onAssigningToGroupChange: (groupId: string | null) => void;
  onCreateGroup: () => void;
  onRenameGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onToggleGroupMember: (groupId: string, personaId: string, currentMembers: string[]) => void;
  onExitSelectionMode: () => void;
}

export function PersonaGroupsSection({
  groups,
  personaMap,
  groupsExpanded,
  expandedGroupId,
  creatingGroup,
  newGroupName,
  editingGroupId,
  editGroupName,
  assigningToGroup,
  onGroupsExpandedChange,
  onExpandedGroupIdChange,
  onCreatingGroupChange,
  onNewGroupNameChange,
  onEditingGroupIdChange,
  onEditGroupNameChange,
  onAssigningToGroupChange,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onToggleGroupMember,
  onExitSelectionMode,
}: PersonaGroupsSectionProps) {
  const skipRenameOnBlurRef = useRef(false);

  return (
    <>
      <div className="mt-1">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onGroupsExpandedChange(!groupsExpanded)}
            className="flex items-center gap-1.5 px-1 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
          >
            {groupsExpanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
            <Users size="0.6875rem" />
            Groups ({groups.length})
          </button>
          <button
            onClick={() => {
              onCreatingGroupChange(true);
              onGroupsExpandedChange(true);
            }}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--primary)]"
            title="Create group"
          >
            <FolderPlus size="0.8125rem" />
          </button>
        </div>

        {groupsExpanded && (
          <div className="flex flex-col gap-1 pt-1">
            {creatingGroup && (
              <div className="flex items-center gap-1.5 rounded-xl bg-[var(--secondary)] p-2 ring-1 ring-[var(--border)]">
                <FolderOpen size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={(event) => onNewGroupNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onCreateGroup();
                    if (event.key === "Escape") {
                      onCreatingGroupChange(false);
                      onNewGroupNameChange("");
                    }
                  }}
                  placeholder="Group name..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]/50"
                />
                <button onClick={onCreateGroup} className="rounded p-0.5 text-emerald-400 hover:bg-emerald-400/10">
                  <Plus size="0.75rem" />
                </button>
                <button
                  onClick={() => {
                    onCreatingGroupChange(false);
                    onNewGroupNameChange("");
                  }}
                  className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                >
                  <X size="0.75rem" />
                </button>
              </div>
            )}

            {groups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const isSynthetic = group.isSynthetic === true;
              return (
                <div key={group.id} className="rounded-xl bg-[var(--secondary)]/60 ring-1 ring-[var(--border)]/50">
                  <div className="flex items-center gap-1.5 px-2.5 py-2">
                    <button
                      onClick={() => onExpandedGroupIdChange(isExpanded ? null : group.id)}
                      className="shrink-0 text-[var(--muted-foreground)]"
                    >
                      {isExpanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
                    </button>

                    {editingGroupId === group.id ? (
                      <input
                        autoFocus
                        value={editGroupName}
                        onChange={(event) => onEditGroupNameChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") onRenameGroup(group.id);
                          if (event.key === "Escape") {
                            skipRenameOnBlurRef.current = true;
                            onEditingGroupIdChange(null);
                            onEditGroupNameChange("");
                          }
                        }}
                        onBlur={() => {
                          if (skipRenameOnBlurRef.current) {
                            skipRenameOnBlurRef.current = false;
                            return;
                          }
                          onRenameGroup(group.id);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {group.name} <span className="text-[var(--muted-foreground)]">({group.memberIds.length})</span>
                      </span>
                    )}

                    {!isSynthetic && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => {
                            if (assigningToGroup !== group.id) onExitSelectionMode();
                            onAssigningToGroupChange(assigningToGroup === group.id ? null : group.id);
                          }}
                          className={cn(
                            "rounded-lg p-1 transition-colors",
                            assigningToGroup === group.id
                              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                          )}
                          title="Assign personas"
                        >
                          <UserPlus size="0.75rem" />
                        </button>
                        <button
                          onClick={() => {
                            onEditingGroupIdChange(group.id);
                            onEditGroupNameChange(group.name);
                          }}
                          className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          title="Rename"
                        >
                          <Pencil size="0.75rem" />
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              !(await showConfirmDialog({
                                title: "Delete Group",
                                message: `Delete group "${group.name}"?`,
                                confirmLabel: "Delete",
                                tone: "destructive",
                              }))
                            ) {
                              return;
                            }
                            onDeleteGroup(group.id);
                            if (expandedGroupId === group.id) onExpandedGroupIdChange(null);
                            if (assigningToGroup === group.id) onAssigningToGroupChange(null);
                          }}
                          className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                          title="Delete group"
                        >
                          <Trash2 size="0.75rem" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[var(--border)]/50 px-2.5 py-1.5">
                      {group.memberIds.length === 0 ? (
                        <p className="py-1 text-[0.625rem] italic text-[var(--muted-foreground)]">
                          No members — use <UserPlus size="0.5rem" className="inline" /> to assign personas
                        </p>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {group.memberIds.map((personaId) => {
                            const persona = personaMap.get(personaId);
                            if (!persona) return null;
                            return (
                              <div key={personaId} className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                                  {persona.avatarPath ? (
                                    <img
                                      src={persona.avatarPath}
                                      alt=""
                                      className="h-full w-full rounded-lg object-cover"
                                    />
                                  ) : (
                                    <User size="0.625rem" />
                                  )}
                                </div>
                                <span className="min-w-0 flex-1 truncate">{persona.name}</span>
                                {!isSynthetic && (
                                  <button
                                    onClick={() => onToggleGroupMember(group.id, personaId, group.memberIds)}
                                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                                    title="Remove from group"
                                  >
                                    <UserMinus size="0.625rem" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && !creatingGroup && (
              <p className="px-1 py-1 text-[0.625rem] italic text-[var(--muted-foreground)]">No groups yet</p>
            )}
          </div>
        )}
      </div>

      {assigningToGroup && (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-xs ring-1 ring-[var(--primary)]/30">
          <Users size="0.8125rem" className="text-[var(--primary)]" />
          <span className="flex-1">
            Click personas to add/remove from{" "}
            <strong>{groups.find((group) => group.id === assigningToGroup)?.name}</strong>
          </span>
          <button onClick={() => onAssigningToGroupChange(null)} className="rounded p-0.5 hover:bg-[var(--accent)]">
            <X size="0.8125rem" />
          </button>
        </div>
      )}
    </>
  );
}
