// Three-way merge of an unsaved editor form onto a refetched server copy.
// `base` is the row as the form last loaded or saved it. Server-side changes
// (e.g. an approved Professor Mari edit) land; the user's unsaved edits stay.
// A path both sides changed differently keeps the user's value and is reported.
// Swap `mine` and `server` to resolve those conflicts in the server's favour.

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function rebase(base: unknown, mine: unknown, server: unknown, path: string, conflicts: string[]): unknown {
  if (same(mine, base)) return server;
  if (same(server, base) || same(mine, server)) return mine;
  if (isPlainObject(base) && isPlainObject(mine) && isPlainObject(server)) {
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(server)])) {
      const value = rebase(base[key], mine[key], server[key], path ? `${path}.${key}` : key, conflicts);
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  conflicts.push(path);
  return mine;
}

export function rebaseForm<T>(base: T, mine: T, server: T): { merged: T; conflicts: string[] } {
  const conflicts: string[] = [];
  return { merged: rebase(base, mine, server, "", conflicts) as T, conflicts };
}
