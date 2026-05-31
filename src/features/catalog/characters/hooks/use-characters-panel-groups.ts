import { useCallback, useState } from "react";

import { useCreateGroup, useUpdateGroup } from "./use-characters";

export function useCharactersPanelGroups() {
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [assigningToGroup, setAssigningToGroup] = useState<string | null>(null);

  const toggleGroupsExpanded = useCallback(() => {
    setGroupsExpanded((expanded) => !expanded);
  }, []);

  const startCreateGroup = useCallback(() => {
    setCreatingGroup(true);
    setGroupsExpanded(true);
  }, []);

  const cancelCreateGroup = useCallback(() => {
    setCreatingGroup(false);
    setNewGroupName("");
  }, []);

  const handleCreateGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    createGroup.mutate({ name, characterIds: [] });
    setNewGroupName("");
    setCreatingGroup(false);
  }, [newGroupName, createGroup]);

  const handleRenameGroup = useCallback(
    (groupId: string) => {
      const name = editGroupName.trim();
      if (!name) return;
      updateGroup.mutate({ id: groupId, name });
      setEditingGroupId(null);
      setEditGroupName("");
    },
    [editGroupName, updateGroup],
  );

  const toggleGroupMember = useCallback(
    (groupId: string, charId: string, currentMembers: string[]) => {
      const isMember = currentMembers.includes(charId);
      const newMembers = isMember ? currentMembers.filter((id) => id !== charId) : [...currentMembers, charId];
      updateGroup.mutate({ id: groupId, characterIds: newMembers });
    },
    [updateGroup],
  );

  const toggleAssigningToGroup = useCallback(
    (groupId: string, onOpenNewGroup?: () => void) => {
      if (assigningToGroup !== groupId) {
        onOpenNewGroup?.();
      }
      setAssigningToGroup(assigningToGroup === groupId ? null : groupId);
    },
    [assigningToGroup],
  );

  return {
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
  };
}
