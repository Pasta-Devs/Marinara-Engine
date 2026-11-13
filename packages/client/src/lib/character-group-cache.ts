export type CachedGroup = { id: string } & Record<string, unknown>;

/** A pending folder edit: a folder id to delete, or the fields of an update. */
export type GroupEdit = string | ({ id: string; characterIds?: string[] } & Record<string, unknown>);

/**
 * Show pending folder edits on top of the server list, in the order they were made. A failed edit is
 * simply no longer pending, so nothing has to be put back and other edits keep their values.
 */
export function applyGroupEdits(groups: CachedGroup[], edits: GroupEdit[]): CachedGroup[] {
  return edits.reduce<CachedGroup[]>((list, edit) => {
    if (typeof edit === "string") return list.filter((group) => group.id !== edit);
    const { id, characterIds, ...fields } = edit;
    // The server stores members as a JSON string.
    const patch = characterIds ? { ...fields, characterIds: JSON.stringify(characterIds) } : fields;
    return list.map((group) => (group.id === id ? { ...group, ...patch } : group));
  }, groups);
}
