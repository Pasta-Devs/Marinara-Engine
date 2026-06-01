import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  MessageCircle,
  Pencil,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { getCharacterTitle } from "../../../../shared/lib/character-display";
import { cn } from "../../../../shared/lib/utils";
import type { ParsedGroupRow } from "../lib/characters-panel-model";
import { CharacterAvatarImage } from "./CharacterAvatarImage";

export type CharacterGroupMemberPreview = {
  name: string;
  comment?: string | null;
  avatarPath: string | null;
  avatarCrop?: unknown;
};

export type CharacterGroupContextMenuRequest = {
  x: number;
  y: number;
  charId: string;
  charName: string;
};

export function CharacterGroupsSection({
  groups,
  groupsExpanded,
  creatingGroup,
  newGroupName,
  expandedGroupId,
  editingGroupId,
  editGroupName,
  assigningToGroup,
  hasActiveChat,
  selectionMode,
  charMap,
  isStartingChat,
  pendingStartCharacterId,
  onToggleGroupsExpanded,
  onCreateGroupStart,
  onCreateGroup,
  onCancelCreateGroup,
  onNewGroupNameChange,
  onExpandedGroupChange,
  onEditingGroupChange,
  onEditGroupNameChange,
  onRenameGroup,
  onDeleteGroup,
  onAddGroupToChat,
  onToggleAssigningToGroup,
  onToggleGroupMember,
  onOpenCharacterDetail,
  onOpenContextMenu,
  onStartNewChat,
}: {
  groups: ParsedGroupRow[];
  groupsExpanded: boolean;
  creatingGroup: boolean;
  newGroupName: string;
  expandedGroupId: string | null;
  editingGroupId: string | null;
  editGroupName: string;
  assigningToGroup: string | null;
  hasActiveChat: boolean;
  selectionMode: boolean;
  charMap: Map<string, CharacterGroupMemberPreview>;
  isStartingChat: boolean;
  pendingStartCharacterId: string | null;
  onToggleGroupsExpanded: () => void;
  onCreateGroupStart: () => void;
  onCreateGroup: () => void;
  onCancelCreateGroup: () => void;
  onNewGroupNameChange: (value: string) => void;
  onExpandedGroupChange: (groupId: string | null) => void;
  onEditingGroupChange: (groupId: string | null) => void;
  onEditGroupNameChange: (value: string) => void;
  onRenameGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroupToChat: (memberIds: string[]) => void;
  onToggleAssigningToGroup: (groupId: string) => void;
  onToggleGroupMember: (groupId: string, memberId: string, memberIds: string[]) => void;
  onOpenCharacterDetail: (memberId: string) => void;
  onOpenContextMenu: (request: CharacterGroupContextMenuRequest) => void;
  onStartNewChat: (memberId: string, memberName: string) => void;
}) {
  return (
    <>
      <div className="mt-1">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleGroupsExpanded}
            className="flex items-center gap-1.5 px-1 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
          >
            {groupsExpanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
            <Users size="0.6875rem" />
            Groups ({groups.length})
          </button>
          <button
            onClick={onCreateGroupStart}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--primary)]"
            title="Create group"
          >
            <FolderPlus size="0.8125rem" />
          </button>
        </div>

        {groupsExpanded && (
          <div className="flex flex-col gap-1 mt-1">
            {creatingGroup && (
              <div className="flex items-center gap-1.5 rounded-xl bg-[var(--secondary)] p-2 ring-1 ring-[var(--primary)]/30">
                <FolderOpen size="0.875rem" className="shrink-0 text-[var(--primary)]" />
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={(event) => onNewGroupNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onCreateGroup();
                    if (event.key === "Escape") onCancelCreateGroup();
                  }}
                  placeholder="Group name…"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]/50"
                />
                <button
                  onClick={onCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="rounded-md p-0.5 text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30"
                >
                  <Check size="0.8125rem" />
                </button>
                <button
                  onClick={onCancelCreateGroup}
                  className="rounded-md p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                >
                  <X size="0.8125rem" />
                </button>
              </div>
            )}

            {groups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const isEditing = editingGroupId === group.id;
              const isAssigning = assigningToGroup === group.id;
              const isSynthetic = group.isSynthetic === true;

              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-transparent transition-all hover:border-[var(--border)]/50"
                >
                  <div
                    className="group relative flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)] cursor-pointer"
                    onClick={() => onExpandedGroupChange(isExpanded ? null : group.id)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-sm">
                      {isExpanded ? <ChevronDown size="0.875rem" /> : <FolderOpen size="0.875rem" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editGroupName}
                          onChange={(event) => onEditGroupNameChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") onRenameGroup(group.id);
                            if (event.key === "Escape") onEditingGroupChange(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className="w-full bg-transparent text-xs font-medium outline-none ring-1 ring-[var(--primary)]/30 rounded px-1 py-0.5"
                        />
                      ) : (
                        <>
                          <div className="truncate text-xs font-medium">{group.name}</div>
                          <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">
                            {group.memberIds.length} character{group.memberIds.length !== 1 ? "s" : ""}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                      {hasActiveChat && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onAddGroupToChat(group.memberIds);
                          }}
                          className="rounded-lg p-1 transition-all hover:bg-[var(--accent)]"
                          title="Add all to chat"
                        >
                          <UserPlus size="0.6875rem" className="text-[var(--primary)]" />
                        </button>
                      )}
                      {!isSynthetic && (
                        <>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleAssigningToGroup(group.id);
                            }}
                            className={cn(
                              "rounded-lg p-1 transition-all hover:bg-[var(--accent)]",
                              isAssigning && "bg-[var(--primary)]/15 text-[var(--primary)]",
                            )}
                            title={isAssigning ? "Done assigning" : "Add/remove members"}
                          >
                            <Users size="0.6875rem" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditingGroupChange(group.id);
                              onEditGroupNameChange(group.name);
                            }}
                            className="rounded-lg p-1 transition-all hover:bg-[var(--accent)]"
                            title="Rename group"
                          >
                            <Pencil size="0.6875rem" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteGroup(group.id);
                            }}
                            className="rounded-lg p-1 transition-all hover:bg-[var(--destructive)]/15"
                            title="Delete group"
                          >
                            <Trash2 size="0.6875rem" className="text-[var(--destructive)]" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-5 flex flex-col gap-0.5 border-l border-[var(--border)]/40 pl-3 pb-2">
                      {group.memberIds.length === 0 && (
                        <div className="py-2 text-[0.625rem] text-[var(--muted-foreground)] italic">
                          No members — click <Users size="0.625rem" className="inline" /> to add characters
                        </div>
                      )}
                      {group.memberIds.map((memberId) => {
                        const member = charMap.get(memberId);
                        if (!member) return null;
                        return (
                          <div
                            key={memberId}
                            onClick={() => onOpenCharacterDetail(memberId)}
                            onContextMenu={(event) => {
                              if (selectionMode || assigningToGroup) return;
                              event.preventDefault();
                              onOpenContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                charId: memberId,
                                charName: member.name,
                              });
                            }}
                            className="group/member flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-all hover:bg-[var(--sidebar-accent)]"
                          >
                            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 text-white">
                              {member.avatarPath ? (
                                <CharacterAvatarImage
                                  src={member.avatarPath}
                                  alt={member.name}
                                  crop={member.avatarCrop}
                                />
                              ) : (
                                <User size="0.75rem" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[0.6875rem]">{member.name}</span>
                              {getCharacterTitle(member) && (
                                <span className="block truncate text-[0.5625rem] italic text-[var(--muted-foreground)]">
                                  {getCharacterTitle(member)}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onStartNewChat(memberId, member.name);
                              }}
                              disabled={isStartingChat || pendingStartCharacterId === memberId}
                              className="rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] group-hover/member:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 max-md:opacity-100"
                              title="Start New Chat"
                              aria-label={`Start New Chat with ${member.name}`}
                            >
                              <MessageCircle size="0.6875rem" />
                            </button>
                            {!isSynthetic && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleGroupMember(group.id, memberId, group.memberIds);
                                }}
                                className="rounded p-0.5 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover/member:opacity-100"
                                title="Remove from group"
                              >
                                <UserMinus size="0.6875rem" className="text-[var(--destructive)]" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && !creatingGroup && (
              <div className="py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                No groups yet — click <FolderPlus size="0.625rem" className="inline" /> to create one
              </div>
            )}
          </div>
        )}
      </div>

      {assigningToGroup && (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-xs ring-1 ring-[var(--primary)]/30">
          <Users size="0.8125rem" className="text-[var(--primary)]" />
          <span className="flex-1">
            Click characters to add/remove from{" "}
            <strong>{groups.find((group) => group.id === assigningToGroup)?.name}</strong>
          </span>
          <button
            onClick={() => onToggleAssigningToGroup(assigningToGroup)}
            className="rounded p-0.5 hover:bg-[var(--accent)]"
          >
            <X size="0.8125rem" />
          </button>
        </div>
      )}
    </>
  );
}
